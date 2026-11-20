-- BMW M240i xDrive Coupé (G42, 2022-2024, before the 2024 update) as a frames-only car (car id m240i_g42): Blendkit
-- Royalty Free "BMW M240i coupe" (Zifir3D), shown only as pre-rendered images, so model_url stays NULL and the browser
-- never downloads its GLB. Frames in public/renders/m240i_g42, wheel layout in public/renders/manifest.json
-- (docs/ADD_PREPARED_CAR.md, "Frames-only cars"). Mirrors data/configuratorData.ts.
-- Figures: BMW Group South Africa (13 June 2024) and South African launch reports (cars.co.za, Double Apex): 285 kW,
-- 500 Nm, 0-100 km/h 4.3 s; BMW technical data sheet (06/2024): 4,548 mm long, 8J x 19 front and 8.5J x 19 rear. Bolt
-- pattern from genuine-wheel listings; centre bore and the B58 code are not in BMW's sheet; BMW does not publish the
-- offsets. Paints: the 2022-2024 car's range only, to match the car shown, the launch colour Thundernight first and
-- Melbourne Red (A75) as its red, added by 20261117107900_paints_melbourne_red.sql, which must run first (the 2024
-- update's Fire Red came with gloss-black trim the frames do not show); Frozen Portimao Blue under C6R (the M2 G87's
-- code; the G42's own code is not confirmed). OWNER TO CONFIRM. Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('m240i_g42', 'BMW M240i', 'M240i xDrive G42', 'G42', 'G42 M240i xDrive', '3.0L B58 Turbo Inline-6',
  '387 HP / 285 kW', '500 Nm (369 lb-ft)', '0-100 km/h in 4.3s',
  '{"front":"19 x 8J","rear":"19 x 8.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'coupe', null, 17, true, 0, 4.548,
  array['thundernight','alpine_white','mineral_white','black_sapphire','brooklyn_grey','portimao_blue','melbourne_red',
        'frozen_pure_grey','frozen_portimao_blue_c6r'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
