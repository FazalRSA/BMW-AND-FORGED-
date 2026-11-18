-- BMW M3 CS (G80, 2023 limited run), a frames-only car: Blendkit Royalty Free "Bmw m3 cs" (Zifir3D), shown only as
-- pre-rendered images, so model_url stays NULL and the browser never downloads its GLB. Frames in
-- public/renders/m3_cs_g80, wheel layout in public/renders/manifest.json (docs/ADD_PREPARED_CAR.md, "Frames-only cars").
-- Mirrors data/configuratorData.ts.
-- Figures: BMW's technical data sheet for the M3 CS (BMW Media Information 01/2023) and the South African launch reports
-- (cars.co.za, citizen.co.za: 20 cars, all sold), which quote the same figures: 405 kW (550 PS), 650 Nm, 0-100 km/h 3.4 s,
-- 9.5J x 19 front and 10.5J x 20 rear, 4,795 mm long. Bolt pattern and centre bore are the G-series hub values (not in
-- the data sheet; 66.6 mm not confirmed against a BMW document). OWNER TO CONFIRM.
-- Paints: BMW sold this car in four only (Signal Green, Frozen Solid White, Brooklyn Grey, Sapphire Black metallic =
-- black_sapphire). The first two come from 20261117095000_paints_limited_run_colours.sql: run that first.
-- Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('m3_cs_g80', 'BMW M3 CS', 'M3 CS G80', 'G80', 'G80 M3 CS', '3.0L S58 Twin-Turbo Inline-6',
  '543 HP / 405 kW', '650 Nm (479 lb-ft)', '0-100 km/h in 3.4s',
  '{"front":"19 x 9.5J","rear":"20 x 10.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'sedan', null, 9, true, 0, 4.795,
  array['signal_green','frozen_solid_white','brooklyn_grey','black_sapphire'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
