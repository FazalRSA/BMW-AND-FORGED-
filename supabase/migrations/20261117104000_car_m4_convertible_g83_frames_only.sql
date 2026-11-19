-- BMW M4 Competition Convertible with M xDrive (G83, 2024 facelift), a frames-only car: Blendkit Royalty Free "BMW M4
-- Convertible 2025" (Zifir3D), shown only as pre-rendered images, so model_url stays NULL and the browser never downloads
-- its GLB. Frames in public/renders/m4_convertible_g83, wheel layout in public/renders/manifest.json
-- (docs/ADD_PREPARED_CAR.md, "Frames-only cars"). Mirrors data/configuratorData.ts. The id is the one the legacy
-- placeholder row had (deleted on 2026-11-11, archived in archive.legacy_cars); this replaces it.
-- Figures: BMW's technical data sheet for the M4 Competition Convertible with M xDrive (BMW Group, 01/2024, also attached
-- to BMW Group South Africa's launch release: the only M4 Convertible sold there) and cars.co.za's South African launch
-- report, which quote the same figures: 390 kW (530 PS), 650 Nm, 0-100 km/h 3.7 s, 9.5J x 19 front and 10.5J x 20 rear,
-- 4,801 mm long. Bolt pattern and centre bore are the G-series hub values (not in the data sheet; 66.6 mm not confirmed
-- against a BMW document). Paints: from BMW South Africa's configurator for this car (docs/bmw-factory-paints.md,
-- section 6): the launch colour BMW Individual Velvet Orchid II first, the eight no-cost series colours, and the BMW
-- Individual Frozen Deep Grey (P7X, frozen_deep_grey). OWNER TO CONFIRM. Safe to re-run.

insert into public.cars (id, name, badge, generation, chassis_code, engine, power, torque, acceleration,
  recommended_wheel_fitment, body_style, model_url, sort_order, active, model_rotation_deg, model_length_m, paint_ids)
values ('m4_convertible_g83', 'BMW M4 Convertible', 'M4 Convertible G83', 'G83', 'G83 M4 Convertible',
  '3.0L S58 Twin-Turbo Inline-6', '523 HP / 390 kW', '650 Nm (479 lb-ft)', '0-100 km/h in 3.7s',
  '{"front":"19 x 9.5J","rear":"20 x 10.5J","pcd":"5x112","cb":"66.6mm"}'::jsonb, 'convertible', null, 13, true, 0, 4.801,
  array['velvet_orchid_ii','isle_of_man_green','portimao_blue','toronto_red','sao_paulo_yellow','brooklyn_grey',
        'skyscraper_grey','black_sapphire','alpine_white','frozen_deep_grey'])
on conflict (id) do update set
  name = excluded.name, badge = excluded.badge, generation = excluded.generation, chassis_code = excluded.chassis_code,
  engine = excluded.engine, power = excluded.power, torque = excluded.torque, acceleration = excluded.acceleration,
  recommended_wheel_fitment = excluded.recommended_wheel_fitment, body_style = excluded.body_style,
  model_url = null, model_length_m = excluded.model_length_m, paint_ids = excluded.paint_ids, active = true,
  sort_order = excluded.sort_order, updated_at = now();
