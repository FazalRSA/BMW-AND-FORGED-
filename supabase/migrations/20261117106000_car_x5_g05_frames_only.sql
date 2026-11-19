-- BMW X5 xDrive50e (G05, 2023 facelift), xLine look, as a frames-only car (car id x5_g05): Blendkit Royalty Free
-- "Bmw x5 2023" (Zifir3D), shown only as pre-rendered images, so model_url stays NULL and the browser never downloads its
-- GLB. Frames in public/renders/x5_g05, wheel layout in public/renders/manifest.json (docs/ADD_PREPARED_CAR.md,
-- "Frames-only cars"). Mirrors data/configuratorData.ts. The model carries only an "X5" badge but has the plug-in
-- hybrid's charging flap on the left front wing, so it is labelled the xDrive50e (sold in South Africa since Q3 2023).
-- Figures: BMW Group technical data sheet "BMW X5" 02/2023 (xDrive50e: 360 kW / 489 hp and 700 Nm system output,
-- 0-100 km/h 4.8 s, 4,935 mm long, wheelbase 2,975 mm); the BMW Group's launch release "The new BMW X5 and the new
-- BMW X6" (8 February 2023) gives the same 360 kW, 700 Nm and 4.8 s. South Africa: TimesLive (9 February 2023: sales
-- from Q3 2023, xLine and 20-inch wheels standard) and The Citizen (10 July 2023: South African prices). The 20 x 9J /
-- 20 x 10.5J mixed set (BMW style 738) is an estimate for South Africa. PCD and centre bore are G-series hub values, not
-- in BMW's sheet. Paints: the facelift palette, the launch colour Blue Ridge Mountain first (the launch release names
-- it, Brooklyn Grey, Skyscraper Grey and Frozen Pure Grey as new for all models; the rest are BMW's 2024 X5 palette,
-- less M Marina Bay Blue, M60i only). Blue Ridge Mountain, Manhattan and Ametrin are added to the paints table
-- by 20261117105900_paints_x5_facelift_colours.sql, which must run first. OWNER TO CONFIRM. Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('x5_g05', 'BMW X5 xDrive50e', 'X5 xDrive50e G05', 'G05', 'G05 X5 xDrive50e', '3.0L Turbo Inline-6 Plug-in Hybrid',
  '489 HP / 360 kW', '700 Nm (516 lb-ft)', '0-100 km/h in 4.8s',
  '{"front":"20 x 9J","rear":"20 x 10.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'suv', null, 15, true, 0, 4.935,
  array['blue_ridge_mountain','mineral_white','alpine_white','black_sapphire','carbon_black','brooklyn_grey',
        'skyscraper_grey','manhattan','dravit_grey','tanzanite_blue_ii','ametrin','frozen_pure_grey'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
