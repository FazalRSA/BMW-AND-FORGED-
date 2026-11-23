-- Shared accounts (configurator + website) and the mail events behind the branded emails.
--
-- One identity for both sites: the website signs customers in with the same Supabase project, so a Google
-- account is one user, one profile and one garage whichever site they sign in on. This migration adds what
-- both sites need on top of 20261110150000_customer_accounts.sql:
--   1. a consent record for marketing email (POPIA s69): the moment the choice was last changed;
--   2. export_my_data() and delete_my_account(): a customer's own access and deletion rights, in the app;
--   3. the mail events: private.notify_mailer() posts a signed event to the n8n "FORGEDSA · Mailer"
--      workflow; the leads trigger uses it, and a new trigger on auth.users sends the welcome email once an
--      address is confirmed (never to an unconfirmed sign-up, so nobody can be mailed by typing their address).
--
-- Nothing here changes a live row. Until the vault secrets `mailer_webhook_url` and `mailer_signing_key`
-- exist the new mail paths do nothing and the leads trigger keeps posting to `lead_webhook_url` exactly as
-- before, so the switch to the new mailer is made by the owner, after the SMTP credential is in n8n
-- (docs/EMAILS.md). Secrets are never in this file.

-- ----------------------------------------------------------------------------------------------
-- 1. Marketing consent record
-- ----------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists marketing_opt_in_at timestamptz;
comment on column public.profiles.marketing_opt_in_at is 'When marketing_opt_in was last switched on or off (set by trigger, never by the customer). POPIA s69 consent record.';

create or replace function public.stamp_marketing_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.marketing_opt_in_at := case when new.marketing_opt_in then now() end;
  elsif new.marketing_opt_in is distinct from old.marketing_opt_in then
    new.marketing_opt_in_at := now();
  else
    new.marketing_opt_in_at := old.marketing_opt_in_at;
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_marketing_consent() from public, anon, authenticated;

drop trigger if exists stamp_marketing_consent on public.profiles;
create trigger stamp_marketing_consent
  before insert or update on public.profiles
  for each row execute function public.stamp_marketing_consent();

-- ----------------------------------------------------------------------------------------------
-- 2. A customer's own data: export and delete
-- ----------------------------------------------------------------------------------------------
-- Everything stored about the caller, as one JSON document. Only fields the customer supplied or that
-- describe their own account: the dealers' internal status and notes on an enquiry are not theirs to
-- export and are left out.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to export your data' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'sign_in_methods', (select coalesce(jsonb_agg(i.provider), '[]'::jsonb) from auth.identities i where i.user_id = u.id)
      )
      from auth.users u where u.id = uid
    ),
    'profile', (
      select jsonb_build_object('email', p.email, 'display_name', p.display_name, 'avatar_url', p.avatar_url, 'phone', p.phone, 'city', p.city,
                                'primary_car_id', p.primary_car_id, 'chassis_code', p.chassis_code, 'exterior_paint_id', p.exterior_paint_id,
                                'brake_system', p.brake_system, 'preferred_finish_id', p.preferred_finish_id,
                                'marketing_opt_in', p.marketing_opt_in, 'marketing_opt_in_at', p.marketing_opt_in_at, 'created_at', p.created_at, 'updated_at', p.updated_at)
      from public.profiles p where p.id = uid
    ),
    'saved_builds', (
      select coalesce(jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'payload', s.payload, 'created_at', s.created_at, 'updated_at', s.updated_at) order by s.created_at desc), '[]'::jsonb)
      from public.saved_configurations s where s.user_id = uid
    ),
    'enquiries', (
      select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'created_at', l.created_at, 'source', l.source, 'name', l.name, 'email', l.email, 'phone', l.phone, 'message', l.message, 'consultation', l.consultation, 'config_code', l.config_code, 'configuration', l.configuration, 'region', l.region) order by l.created_at desc), '[]'::jsonb)
      from public.leads l where l.user_id = uid
    )
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Deletes the caller's account: the login, the profile and the saved builds (the garage). Enquiries and
-- PDF requests they sent stay with the business as sales records, detached from the account (their
-- user_id becomes null through the foreign key); the app says so before asking, and an erasure of those
-- is done by writing to the business. An admin cannot use this: their login is managed in the dashboard.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in to delete your account' using errcode = '28000';
  end if;
  if (select private.is_admin()) then
    raise exception 'An admin login is removed from the Supabase dashboard, not from here' using errcode = '42501';
  end if;
  delete from public.saved_configurations where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ----------------------------------------------------------------------------------------------
-- 3. Mail events
-- ----------------------------------------------------------------------------------------------
-- Posts one signed event to the mailer. The mailer re-computes the signature
--   hmac_sha256(mailer_signing_key, sent_at || '.' || event || '.' || id || '.' || data.email || '.' || data.customer_copy)
-- and refuses anything outside +-15 minutes, so neither the webhook address nor a captured request can be
-- used to send mail to anyone else (the recipient and the copy flag are part of what is signed).
-- Returns false (and does nothing) while either vault secret is missing.
create or replace function private.notify_mailer(p_event text, p_id text, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_url text;
  signing_key text;
  sent_at bigint := extract(epoch from now())::bigint;
  signature text;
begin
  select decrypted_secret into hook_url from vault.decrypted_secrets where name = 'mailer_webhook_url' limit 1;
  select decrypted_secret into signing_key from vault.decrypted_secrets where name = 'mailer_signing_key' limit 1;
  if coalesce(hook_url, '') = '' or coalesce(signing_key, '') = '' then
    return false;
  end if;
  signature := encode(
    extensions.hmac(
      sent_at::text || '.' || p_event || '.' || coalesce(p_id, '') || '.' || coalesce(p_data ->> 'email', '') || '.' || coalesce(p_data ->> 'customer_copy', ''),
      signing_key, 'sha256'),
    'hex');
  perform net.http_post(
    url := hook_url,
    body := jsonb_build_object('event', p_event, 'id', p_id, 'sent_at', sent_at, 'signature', signature, 'data', p_data),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
  return true;
exception when others then
  raise warning 'mailer event % not sent: %', p_event, sqlerrm;
  return false;
end;
$$;
revoke all on function private.notify_mailer(text, text, jsonb) from public, anon, authenticated;

-- Leads: same lookups and flood guard as before; the payload goes to the new mailer when it is set up
-- (one event, the mailer sends the team notice and the customer's copy), otherwise to the old workflow.
create or replace function private.notify_lead_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_url text;
  mailer_ready boolean;
  cfg jsonb := coalesce(new.configuration, '{}'::jsonb);
  payload jsonb;
begin
  select decrypted_secret into hook_url from vault.decrypted_secrets where name = 'lead_webhook_url' limit 1;
  mailer_ready := exists (select 1 from vault.decrypted_secrets where name = 'mailer_webhook_url' and coalesce(decrypted_secret, '') <> '')
              and exists (select 1 from vault.decrypted_secrets where name = 'mailer_signing_key' and coalesce(decrypted_secret, '') <> '');
  if not mailer_ready and coalesce(hook_url, '') = '' then
    return new;
  end if;

  -- Flood guard: past 30 leads in 10 minutes, stop emailing (leads are still saved and listed in
  -- /admin → Enquiries), so a script cannot get the sending mailbox throttled or suspended.
  if (select count(*) from public.leads l where l.created_at > now() - interval '10 minutes') > 30 then
    raise warning 'lead webhook skipped: more than 30 leads in 10 minutes';
    return new;
  end if;

  -- The lead stores display names; look the rest up so the email can show swatches, the wheel image and price.
  -- Stocked wheels have site-relative image_url values (/rim-images/*.webp), which an email client cannot
  -- resolve, so they are sent as absolute URLs on the production origin.
  payload := jsonb_build_object(
    'id', new.id,
    'created_at', new.created_at,
    'source', new.source,
    'name', new.name,
    'email', new.email,
    'phone', new.phone,
    'message', new.message,
    'consultation', new.consultation,
    'config_code', new.config_code,
    'region', new.region,
    'signed_in', new.user_id is not null,
    -- The customer's own copy goes only to the owner of a confirmed address (signed in as that email), or
    -- as the first message to an address in 24 hours: typing someone else's address cannot make this
    -- mailbox send more than one receipt a day to them, and the receipt repeats none of what was typed.
    'customer_copy', coalesce(new.email, '') <> '' and (
      (new.user_id is not null and exists (
         select 1 from auth.users u
         where u.id = new.user_id and u.email_confirmed_at is not null and lower(u.email) = lower(new.email)))
      or not exists (
         select 1 from public.leads l
         where lower(l.email) = lower(new.email) and l.id <> new.id and l.created_at > now() - interval '24 hours')
    ),
    'size', cfg ->> 'size',
    'car', coalesce(
      (select jsonb_build_object('name', c.name, 'badge', c.badge, 'generation', c.generation)
         from public.cars c where c.id = cfg ->> 'carId' or (cfg ->> 'carId' is null and c.name = cfg ->> 'car') limit 1),
      jsonb_build_object('name', cfg ->> 'car')),
    'paint', coalesce(
      (select jsonb_build_object('name', p.name, 'code', p.code, 'hex', p.hex, 'type', p.type)
         from public.paints p where p.id = cfg ->> 'paintId' or (cfg ->> 'paintId' is null and p.name = cfg ->> 'paint')
         order by p.active desc limit 1),
      jsonb_build_object('name', cfg ->> 'paint')),
    'wheel', coalesce(
      (select jsonb_build_object('name', w.name, 'code', w.code, 'style', w.style,
                                 'image_url', case when w.image_url like '/%' then 'https://forged-configurator.vercel.app' || w.image_url else w.image_url end,
                                 'price_usd', greatest(coalesce((w.price_by_finish ->> (cfg ->> 'finishId'))::numeric, 0),
                                                       coalesce((w.price_by_size ->> (cfg ->> 'size'))::numeric, w.price_per_set)))
         from public.wheels w where w.id = cfg ->> 'wheelId' or (cfg ->> 'wheelId' is null and w.name = cfg ->> 'wheel')
         order by w.active desc limit 1),
      jsonb_build_object('name', cfg ->> 'wheel')),
    'finish', coalesce(
      (select jsonb_build_object('name', f.name, 'color_name', f.color_name, 'hex', f.hex)
         from public.wheel_finishes f where f.id = cfg ->> 'finishId' or (cfg ->> 'finishId' is null and f.name = cfg ->> 'finish')
         order by f.active desc limit 1),
      jsonb_build_object('name', cfg ->> 'finish'))
  );

  if mailer_ready and private.notify_mailer('lead', new.id::text, payload) then
    return new;
  end if;
  if coalesce(hook_url, '') <> '' then
    perform net.http_post(
      url := hook_url,
      body := payload,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  end if;
  return new;
exception when others then
  raise warning 'lead webhook not sent: %', sqlerrm;
  return new;
end;
$$;
revoke all on function private.notify_lead_webhook() from public, anon, authenticated;

-- New customers: one welcome email, sent when an address becomes confirmed (a Google sign-in arrives
-- confirmed; an email + password sign-up only after the link in the confirmation email is used), so an
-- unconfirmed sign-up with someone else's address is never mailed. Admin and dealer logins are not
-- customers and get none. The name comes from the account's metadata, which the person signing up
-- controls: links are stripped and it is cut to 60 characters (the mailer cleans it again). Flood guard as for leads.
create or replace function private.notify_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.email, '') = '' or new.email_confirmed_at is null then
    return new;
  end if;
  if exists (select 1 from public.admin_users a where a.email = lower(new.email))
     or exists (select 1 from public.dealer_users d where lower(d.email) = lower(new.email)) then
    return new;
  end if;
  if (select count(*) from auth.users u where u.created_at > now() - interval '10 minutes') > 30 then
    raise warning 'welcome email skipped: more than 30 sign-ups in 10 minutes';
    return new;
  end if;
  perform private.notify_mailer(
    'welcome', new.id::text,
    jsonb_build_object(
      'email', new.email,
      'name', left(regexp_replace(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), ''), '(https?://|www\.)\S*', '', 'gi'), 60)
    )
  );
  return new;
exception when others then
  raise warning 'welcome email not sent: %', sqlerrm;
  return new;
end;
$$;
revoke all on function private.notify_user_confirmed() from public, anon, authenticated;

drop trigger if exists users_notify_welcome_insert on auth.users;
create trigger users_notify_welcome_insert
  after insert on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function private.notify_user_confirmed();

drop trigger if exists users_notify_welcome_confirm on auth.users;
create trigger users_notify_welcome_confirm
  after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.notify_user_confirmed();
