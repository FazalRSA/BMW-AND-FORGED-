# Emails: one branded mailer, sent from admin@forgedsa.co.za

Every customer-facing email and the team's lead notices go out through **one n8n workflow, "FORGEDSA · Mailer"**,
from **admin@forgedsa.co.za**, in one layout (dark Carbon card, Forged Gold hairline, orange action button, signature
and a POPIA / disclaimer footer). Plain text is sent alongside the HTML.

| Event | Who gets what | Trigger |
|---|---|---|
| `lead` (PDF download or enquiry) | the **team** (forgedsa1@gmail.com): "New enquiry / New PDF download", reply goes to the customer. The **customer**: an enquiry receipt, or their build link after a PDF download | `leads_notify_webhook` on `public.leads` |
| `welcome` | a **new customer**, once their address is confirmed (Google sign-in on either site) | `users_notify_welcome_*` on `auth.users` |
| Supabase Auth mail (admin invite, password reset, ...) | admins | Supabase Auth, templates in `supabase/templates/` |

## How it fits together

```
Postgres trigger -> private.notify_mailer() -- signed event (HMAC) --> n8n webhook "Mail event"
                                                                        '- Code "Build emails" (checks the signature, renders HTML + text)
                                                                           '- Send Email (SMTP, admin@forgedsa.co.za)
```

- **Source of truth:** `emails/*.mjs` (`config.mjs` = every business detail, `render.mjs` = layout and footer,
  `templates.mjs` = the emails, `mailer.mjs` = signature check and routing, `auth.mjs` = Supabase Auth mail).
  `bun run emails:build` writes `n8n/mailer.code.js` (the Code node) and `supabase/templates/*.html`;
  `bun run lint` fails when they are stale. `bun run emails:test` runs the tests; `bun run emails:preview <dir>`
  renders every email and screenshots it at 640 and 390 px.
- **Safety:** the webhook address is secret *and* every event is signed
  `hmac_sha256(key, sent_at.event.id.email.customer_copy)`; the mailer refuses a bad or stale (+-15 min) signature, so
  nobody can use the address to send mail. The customer's own copy is sent only when the database says so
  (`customer_copy`: the signed-in owner of a confirmed address, or the first lead from that address in 24 hours), and it
  repeats nothing a stranger typed (names that are not from the catalogue are left out, links are stripped, the greeting is
  only a plain first name). Subjects and addresses are stripped of line breaks. A flood guard stops mail past 30 leads or
  30 sign-ups in 10 minutes.
- **No secrets in the repo.** The webhook address and signing key live in Supabase Vault and in the n8n workflow only.
  The repo copy of the Code node keeps the placeholder `__MAILER_SIGNING_KEY__`.

## Switching it on (owner steps, about 10 minutes)

Until step 3 the **old lead email keeps working exactly as before** (Gmail, to forgedsa1@gmail.com).

1. **SMTP login in n8n.** Create the mailbox `admin@forgedsa.co.za` in your hosting's cPanel if it does not exist.
   In n8n, Credentials, add *SMTP*: host `mail.forgedsa.co.za`, port `465`, SSL on, user `admin@forgedsa.co.za`, the mailbox
   password. Name it "FORGEDSA SMTP (admin@forgedsa.co.za)". Open the workflow **FORGEDSA · Mailer**, pick it in the last
   node, **Publish**. (The domain's MX is `mail.forgedsa.co.za` and its SPF already allows that host. A transactional
   provider such as Resend or Brevo with its own DKIM is the better long-term sender; only this one node would change.)
2. **DNS (the hosting DNS panel for forgedsa.co.za).** In cPanel, *Email Deliverability*: make sure **DKIM** and **SPF**
   are valid for the domain, then add a DMARC record: TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:admin@forgedsa.co.za`.
   Move to `p=quarantine` after a few weeks of clean reports. Without DKIM and DMARC, Gmail and Outlook treat the mail as suspect.
3. **Tell Claude "mailer is published"**, or do it yourself in the Supabase SQL editor (the address is the webhook's
   production URL, the key is the `MAILER_SIGNING_KEY` constant in the Code node; both are in the n8n workflow):
   ```sql
   select vault.create_secret('<webhook production URL>', 'mailer_webhook_url');
   select vault.create_secret('<signing key>', 'mailer_signing_key');
   ```
   To switch back at any time: `delete from vault.secrets where name in ('mailer_webhook_url','mailer_signing_key');`
   (the lead trigger then falls back to `lead_webhook_url`).
4. **Test.** Insert a lead with an address you own and check the mails; delete the test lead. Check n8n Executions.
5. **Supabase Auth mail (optional, admins only).** Supabase, Authentication, *SMTP Settings*: the same mailbox (sender
   `FORGEDSA <admin@forgedsa.co.za>`), then *Email Templates*: paste each file from `supabase/templates/`
   (`confirmation`, `invite`, `magic_link`, `recovery`, `email_change`, `reauthentication`) and set the subjects from
   `emails/auth.mjs`. Customers sign in with Google and never see these.

## Details still needed from the owner (left empty, so hidden)

`emails/config.mjs`, `legal`: registered company name, registration number, VAT number (section 32(4) of the Companies Act
asks for the name and registration number on electronic notices; confirm with your accountant or attorney what has to
appear on email), the Information Officer's name and mailbox (defaults to admin@forgedsa.co.za), and TikTok / YouTube links
(the app and the website disagreed; none is shown). Fill them in, `bun run emails:build`, then update the live Code node
(`update_workflow`, `setNodeParameter /jsCode`, the repo copy with the key put back, then Publish).

## Not covered yet

- **The website's own enquiry workflow ("FORGED · Website Leads")** still sends through Gmail, with its own look and to
  fazal@novahavens.com. Moving it to this mailer is a small follow-up (add a `website_lead` event and template).
- **Marketing email** is not sent by anything. The opt-in (`profiles.marketing_opt_in`, with `marketing_opt_in_at` as the
  consent record) is ready; a campaign needs an unsubscribe link and the sender identity in every message (POPIA s69).
- **Replays:** an event captured within its 15 minutes could be re-sent to the same recipient; deduplicating `event:id`
  in n8n would close that.
