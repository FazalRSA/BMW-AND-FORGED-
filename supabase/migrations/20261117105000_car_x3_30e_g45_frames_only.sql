-- BMW X3 30e xDrive (G45), Standard Model, as a frames-only car (car id x3_30e_g45): Blendkit Royalty Free "Bmw x3 2025"
-- (Zifir3D), shown only as pre-rendered images, so model_url stays NULL and the browser never downloads its GLB. Frames in
-- public/renders/x3_30e_g45, wheel layout in public/renders/manifest.json (docs/ADD_PREPARED_CAR.md, "Frames-only cars").
-- Mirrors data/configuratorData.ts. The model is badged "X3 30e" and has the plug-in hybrid's charging flap, so it is
-- labelled the 30e xDrive (sold in South Africa in the Standard line), not the 20d the id was chosen for.
-- Figures: BMW technical specifications 06/2024 (X3 30e xDrive: 220 kW / 299 hp and 450 Nm system output, 0-100 km/h
-- 6.2 s, 8.5J x 19 with 245/50 R19), BMW Group South Africa (19-inch wheels standard on the 30e) and cars.co.za (SA:
-- 220 kW, 450 Nm, 6.2 s). PCD and centre bore are G-series hub values, not in BMW's sheet. Paints: the SA configurator's
-- Standard Model palette as read for the X3 20d xDrive, assumed the same for the 30e. OWNER TO CONFIRM. Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('x3_30e_g45', 'BMW X3 30e xDrive', 'X3 30e xDrive G45', 'G45', 'G45 X3 30e', '2.0L Turbo Inline-4 Plug-in Hybrid',
  '299 HP / 220 kW', '450 Nm (332 lb-ft)', '0-100 km/h in 6.2s',
  '{"front":"19 x 8.5J","rear":"19 x 8.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'suv', null, 14, true, 0, 4.755,
  array['alpine_white','black_sapphire','mineral_white','skyscraper_grey','sophisto_grey_brilliant_effect','dune_grey',
        'arctic_race_blue','fire_red','tanzanite_blue_ii'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  updated_at = now();
