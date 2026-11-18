-- BMW M4 CSL (G82, 2022 limited run of 1,000), a frames-only car: Blendkit Royalty Free "Bmw m4 csl" (Zifir3D), shown
-- only as pre-rendered images, so model_url stays NULL and the browser never downloads its GLB. Frames in
-- public/renders/m4_csl_g82, wheel layout in public/renders/manifest.json (docs/ADD_PREPARED_CAR.md, "Frames-only cars").
-- Mirrors data/configuratorData.ts.
-- Figures: BMW's technical data sheet for the M4 CSL (BMW Group, 05/2022) and the South African launch reports
-- (cars.co.za, citizen.co.za: 15 of the 1,000 cars, all sold), which quote the same figures: 405 kW (550 PS), 650 Nm,
-- 0-100 km/h 3.7 s, 9.5J x 19 front and 10.5J x 20 rear, 4,794 mm long. Bolt pattern and centre bore are the G-series
-- hub values (not in the data sheet; 66.6 mm not confirmed against a BMW document). OWNER TO CONFIRM.
-- Paints: BMW sold this car in three only (Frozen Brooklyn Grey metallic, Alpine White, Sapphire Black metallic =
-- black_sapphire). The first comes from 20261117095000_paints_limited_run_colours.sql: run that first.
-- Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('m4_csl_g82', 'BMW M4 CSL', 'M4 CSL G82', 'G82', 'G82 M4 CSL', '3.0L S58 Twin-Turbo Inline-6',
  '543 HP / 405 kW', '650 Nm (479 lb-ft)', '0-100 km/h in 3.7s',
  '{"front":"19 x 9.5J","rear":"20 x 10.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'coupe', null, 12, true, 0, 4.794,
  array['frozen_brooklyn_grey','alpine_white','black_sapphire'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
