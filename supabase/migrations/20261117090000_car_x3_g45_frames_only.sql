-- BMW X3 M50 xDrive (G45), the fifth frames-only car: Blendkit Royalty Free "Bmw x3 m50 2025" (Zifir3D), shown only as
-- pre-rendered images, so model_url stays NULL and the browser never downloads its GLB. Frames in public/renders/x3_g45,
-- wheel layout in public/renders/manifest.json (docs/ADD_PREPARED_CAR.md, "Frames-only cars"). Mirrors
-- data/configuratorData.ts.
-- Figures: BMW South Africa launch material: 293 kW, 580 Nm, 0-100 km/h 4.6 s, 20-inch wheels standard; rim widths are
-- not published (20 x 8.5J / 20 x 9.5J is an estimate). OWNER TO CONFIRM. Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('x3_g45', 'BMW X3 M50', 'X3 M50 xDrive G45', 'G45', 'G45 X3 M50', '3.0L Turbo Inline-6 48V Mild Hybrid',
  '398 HP / 293 kW', '580 Nm (428 lb-ft)', '0-100 km/h in 4.6s',
  '{"front":"20 x 8.5J","rear":"20 x 9.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'suv', null, 8, true, 0, 4.755,
  array['alpine_white','mineral_white','black_sapphire','brooklyn_grey','skyscraper_grey','fire_red','portimao_blue',
        'frozen_pure_grey'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
