-- BMW M4 Competition Coupé with M xDrive (G82, 2024 facelift), a frames-only car: Blendkit Royalty Free "BMW M4 Coupe
-- 2024" (Zifir3D), shown only as pre-rendered images, so model_url stays NULL and the browser never downloads its GLB.
-- Frames in public/renders/m4_g82, wheel layout in public/renders/manifest.json (docs/ADD_PREPARED_CAR.md, "Frames-only
-- cars"). Mirrors data/configuratorData.ts.
-- Figures: BMW's technical data sheet for the M4 Competition Coupé with M xDrive (BMW Media Information 01/2024) and the
-- South African launch reports (cars.co.za, citizen.co.za, toprated.co.za: the only M4 Coupé sold there besides the CS),
-- which quote the same figures: 390 kW (530 PS), 650 Nm, 0-100 km/h 3.5 s, 9.5J x 19 front and 10.5J x 20 rear,
-- 4,801 mm long. Bolt pattern and centre bore are the G-series hub values (not in the data sheet; 66.6 mm not confirmed
-- against a BMW document). Paints: from BMW South Africa's configurator for this car (docs/bmw-factory-paints.md,
-- section 5): the eight no-cost series colours and the BMW Individual special-order Frozen Portimao Blue, which is X1E
-- (frozen_portimao_blue) on the G8x M3/M4; C6R is the G87/F74 code for the same name. OWNER TO CONFIRM. Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('m4_g82', 'BMW M4 Competition', 'M4 Competition G82', 'G82', 'G82 M4 Competition', '3.0L S58 Twin-Turbo Inline-6',
  '523 HP / 390 kW', '650 Nm (479 lb-ft)', '0-100 km/h in 3.5s',
  '{"front":"19 x 9.5J","rear":"20 x 10.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'coupe', null, 11, true, 0, 4.801,
  array['sao_paulo_yellow','isle_of_man_green','portimao_blue','toronto_red','brooklyn_grey','skyscraper_grey',
        'black_sapphire','alpine_white','frozen_portimao_blue'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
