-- BMW M3 Competition Touring (G81, 2024 facelift), the third frames-only car: Blendkit Royalty Free "BMW M3 Touring
-- 2025" (Zifir3D), shown only as pre-rendered images, so model_url stays NULL and the browser never downloads its GLB.
-- Frames in public/renders/m3_touring_g81, wheel layout in public/renders/manifest.json (docs/ADD_PREPARED_CAR.md,
-- "Frames-only cars"). Mirrors data/configuratorData.ts.
-- Figures: Competition M xDrive LCI, 530 PS / 390 kW, 650 Nm, 0-100 km/h 3.6 s; fitment as the M3 G80 (9.5J x 19
-- front, 10.5J x 20 rear). OWNER TO CONFIRM. Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('m3_touring_g81', 'BMW M3 Touring', 'M3 Touring G81', 'G81', 'G81 M3 Touring',
  '3.0L S58 Twin-Turbo Inline-6', '523 HP / 530 PS', '650 Nm (479 lb-ft)', '0-100 km/h in 3.6s',
  '{"front":"19 x 9.5J","rear":"20 x 10.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'touring', null, 6, true, 0, 4.8,
  array['isle_of_man_green','brooklyn_grey','portimao_blue','sao_paulo_yellow','toronto_red','fire_red',
        'skyscraper_grey','black_sapphire','alpine_white','frozen_portimao_blue_c6r','frozen_pure_grey'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
