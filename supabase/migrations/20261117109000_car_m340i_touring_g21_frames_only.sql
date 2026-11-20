-- BMW M340i xDrive Touring (G21, 2022 facelift) as a frames-only car (car id m340i_touring_g21): Blendkit Royalty Free
-- "BMW 3-Series Touring" (Zifir3D), shown only as pre-rendered images, so model_url stays NULL and the browser never
-- downloads its GLB. Frames in public/renders/m340i_touring_g21, wheel layout in public/renders/manifest.json
-- (docs/ADD_PREPARED_CAR.md, "Frames-only cars"). Mirrors data/configuratorData.ts. The download is the 3 Series Touring
-- as a 330e M Sport; the M340i's own parts (mesh kidney grille, M mirror caps in high-gloss black, Shadowline trim and
-- roof rails, trapezoid tailpipes, M340i badge) were built onto it in the private copy (BMW press kit 05/2022).
-- BMW does not sell the 3 Series Touring in South Africa (only the M3 Touring); BMW South Africa sells the M340i as a
-- Sedan (285 kW, 0-100 km/h 4.3 s). The figures are therefore the Touring's own, from BMW's European press kit and
-- technical data sheets (05/2022, 05/2024): 275 kW (374 hp), 500 Nm, 0-100 km/h 4.6 s, 4,714 mm long, wheelbase
-- 2,851 mm. 19-inch M wheels per BMW's press release of 17 May 2022 (the data sheet also lists 7.5J x 18 / 8.5J x 18);
-- the 19 x 8J / 19 x 8.5J widths (styles 791 M / 995 M) are from parts listings, an estimate. PCD and centre bore are
-- G-series hub values, not in BMW's sheet. Paints: BMW's 3 Series colours offered on the M340i (the 2022 launch range and the 2024 update's Arctic Race
-- Blue and Fire Red). OWNER TO CONFIRM. Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('m340i_touring_g21', 'BMW M340i Touring', 'M340i Touring G21', 'G21', 'G21 M340i xDrive Touring',
  '3.0L B58 Turbo Inline-6 48V Mild Hybrid', '374 HP / 275 kW', '500 Nm (369 lb-ft)', '0-100 km/h in 4.6s',
  '{"front":"19 x 8J","rear":"19 x 8.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'touring', null, 18, true, 0, 4.714,
  array['brooklyn_grey','alpine_white','mineral_white','black_sapphire','skyscraper_grey','portimao_blue',
        'arctic_race_blue','fire_red','frozen_pure_grey'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
