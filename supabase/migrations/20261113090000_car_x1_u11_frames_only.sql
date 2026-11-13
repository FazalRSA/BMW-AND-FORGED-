-- BMW X1 (U11) M Sport, the fourth frames-only car: Blendkit Royalty Free "BMW X1 M Sportpaket" (Zifir3D), shown only
-- as pre-rendered images, so model_url stays NULL and the browser never downloads its GLB. Frames in
-- public/renders/x1_u11, wheel layout in public/renders/manifest.json (docs/ADD_PREPARED_CAR.md, "Frames-only cars").
-- Mirrors data/configuratorData.ts.
-- Figures: sDrive18i M Sport as sold in South Africa (bmw.co.za technical data): 115 kW, 230 Nm, 0-100 km/h 9.0 s;
-- 18-inch M Sport wheels standard, rim width not published (18 x 8J is an estimate). OWNER TO CONFIRM. Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('x1_u11', 'BMW X1', 'X1 M Sport U11', 'U11', 'U11 X1', '1.5L Turbo Inline-3',
  '156 HP / 115 kW', '230 Nm (170 lb-ft)', '0-100 km/h in 9.0s',
  '{"front":"18 x 8J","rear":"18 x 8J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'suv', null, 7, true, 0, 4.5,
  array['alpine_white','mineral_white','black_sapphire','brooklyn_grey','portimao_blue','skyscraper_grey','fire_red',
        'storm_bay'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
