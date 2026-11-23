-- BMW X5 M Competition (F95, 2020-2023, before the 2023 facelift) as a frames-only car (car id x5m_f95): Blendkit
-- Royalty Free "BMW X5 M Competition" (Zifir3D), shown only as pre-rendered images, so model_url stays NULL and the
-- browser never downloads its GLB. Frames in public/renders/x5m_f95, wheel layout in public/renders/manifest.json
-- (docs/ADD_PREPARED_CAR.md, "Frames-only cars"). Mirrors data/configuratorData.ts.
-- Figures: BMW's technical data sheet "Specifications of the BMW X5 M, valid from 03/2021" (Competition: 460 kW /
-- 625 hp, 750 Nm, 0-100 km/h 3.8 s, 4,938 mm long, wheelbase 2,972 mm, 10.5J x 21 front and 11.5J x 22 rear) and BMW
-- South Africa's launch release of 7 July 2020 (Competition only in South Africa; the same 460 kW, 750 Nm and 3.8 s,
-- 21-inch front and 22-inch rear M wheels standard). PCD and centre bore are G-series hub values from fitment guides,
-- not in BMW's sheet. Paints: the launch range in BMW USA's launch release, Marina Bay Blue (the launch colour) first
-- with the other two M colours (Toronto Red, Donington Grey), plus BMW Individual Frozen Black (offered for the X5 M from
-- autumn 2020). Manhattan and Ametrin are added to the paints table by 20261117105900_paints_x5_facelift_colours.sql and
-- Donington Grey by 20261117106900_paints_x5m_donington_grey.sql, which must both run first. OWNER TO CONFIRM. Safe to
-- re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('x5m_f95', 'BMW X5 M Competition', 'X5 M Competition F95', 'F95', 'F95 X5 M Competition', '4.4L S63 Twin-Turbo V8',
  '625 HP / 460 kW', '750 Nm (553 lb-ft)', '0-100 km/h in 3.8s',
  '{"front":"21 x 10.5J","rear":"22 x 11.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'suv', null, 16, true, 0, 4.938,
  array['marina_bay_blue','toronto_red','donington_grey','carbon_black','black_sapphire','alpine_white','mineral_white',
        'manhattan','tanzanite_blue_ii','ametrin','frozen_black'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
