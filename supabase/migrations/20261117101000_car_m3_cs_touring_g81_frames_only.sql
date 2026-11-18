-- BMW M3 CS Touring (G81, 2025), a frames-only car: Blendkit Royalty Free "BMW M3 CS Touring 2025" (Zifir3D), shown only
-- as pre-rendered images, so model_url stays NULL and the browser never downloads its GLB. Frames in
-- public/renders/m3_cs_touring_g81, wheel layout in public/renders/manifest.json (docs/ADD_PREPARED_CAR.md,
-- "Frames-only cars"). Mirrors data/configuratorData.ts.
-- Figures: BMW's technical data sheet for the M3 CS Touring (BMW Media information 01/2025) and BMW Group South Africa's
-- release of 30 Jan 2025: 405 kW (550 PS), 650 Nm, 0-100 km/h 3.5 s, 9.5J x 19 front and 10.5J x 20 rear, 4,796 mm long.
-- Bolt pattern and centre bore are the G-series hub values (not in the data sheet). OWNER TO CONFIRM.
-- Paints: BMW offers this car in four only (British Racing Green, Laguna Seca Blue, Frozen Solid White, Sapphire Black
-- metallic = black_sapphire). The first three come from 20261117095000_paints_limited_run_colours.sql: run that first.
-- Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('m3_cs_touring_g81', 'BMW M3 CS Touring', 'M3 CS Touring G81', 'G81', 'G81 M3 CS Touring',
  '3.0L S58 Twin-Turbo Inline-6', '543 HP / 405 kW', '650 Nm (479 lb-ft)', '0-100 km/h in 3.5s',
  '{"front":"19 x 9.5J","rear":"20 x 10.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'touring', null, 10, true, 0, 4.796,
  array['british_racing_green','laguna_seca_blue','frozen_solid_white','black_sapphire'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
