-- The default wheel is the car's own rims in satin bronze: the owner's viewer look (the M2 CS reference
-- renders: bronze mesh wheels, red calipers). No rim file is mounted for it. The engine shows the car's own
-- rim meshes and paints them with the chosen finish. Mirrored in data/configuratorData.ts (WHEEL_DESIGNS).
--
-- PLACEHOLDERS for the owner to decide in /admin > Wheels before customers see it: the name ("Bronze Mesh"),
-- the size (19") and the price (the FSA004 price, R 70 000 = 3846.15 USD).

-- 1. Two flags: a wheel with stock_rims mounts no rim file, and a car with stock_rims_finished lets its own
--    rim mesh take the wheel finish (only the M2 CS: the viewer's bronzed look).
alter table public.wheels add column if not exists stock_rims boolean not null default false;
alter table public.cars add column if not exists stock_rims_finished boolean not null default false;
comment on column public.wheels.stock_rims is 'The car''s own rims are shown; no rim file is mounted for this design.';
comment on column public.cars.stock_rims_finished is 'With a stock-rims wheel, the car''s own rim mesh takes the wheel finish (the viewer''s bronzed M2 CS).';

-- 2. The M2 CS takes the finish on its own rim.
update public.cars set stock_rims_finished = true, updated_at = now() where id = 'm2_g87';

-- 3. The default design: first in the list (sort_order -1), finish bronze only.
insert into public.wheels (id, code, name, subtitle, style, spoke_type, spoke_count, standard_sizes, price_per_set, price_by_size, price_by_finish,
  description, highlights, available_variants, default_variant, image_url, image_extrude, model_url, model_flip, rear_model_url, stock_rims, sort_order, active)
values
  ('stock_bronze', 'STOCK', 'Bronze Mesh', 'The car''s own rims', 'Factory', 'mesh', 5, array['19"'], 3846.15,
   '{"19\"": 3846.15}'::jsonb, '{}'::jsonb,
   'The car''s own rims, in satin bronze.',
   array['The car''s own rims', 'Satin bronze finish'],
   array['bronze'], 'bronze', null, false, null, false, null, true, -1, true)
on conflict (id) do update set
  code = excluded.code, name = excluded.name, subtitle = excluded.subtitle, style = excluded.style, spoke_type = excluded.spoke_type,
  spoke_count = excluded.spoke_count, standard_sizes = excluded.standard_sizes, price_per_set = excluded.price_per_set,
  price_by_size = excluded.price_by_size, price_by_finish = excluded.price_by_finish, description = excluded.description,
  highlights = excluded.highlights, available_variants = excluded.available_variants, default_variant = excluded.default_variant,
  image_url = excluded.image_url, image_extrude = excluded.image_extrude, model_url = excluded.model_url, model_flip = excluded.model_flip,
  rear_model_url = excluded.rear_model_url, stock_rims = excluded.stock_rims, sort_order = excluded.sort_order,
  active = excluded.active, updated_at = now();
