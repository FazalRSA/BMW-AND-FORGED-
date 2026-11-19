-- Three factory colours of the BMW X5 facelift (G05 LCI, 2023) that the paints table did not have (mirrors
-- data/configuratorData.ts BMW_PAINTS). Blue Ridge Mountain metallic is the facelift's launch colour: the BMW Group's
-- launch release "The new BMW X5 and the new BMW X6" (8 February 2023) lists it first among the new colours for all
-- models. Manhattan metallic and BMW Individual Ametrin metallic are on BMW's 2024 X5 palette (US dealer colour pages).
-- Codes: C35 and C3D from two touch-up paint suppliers (paintscratch, Automotive Touchup), X1B from those and BMW
-- Ireland's 2019 X5 brochure. Hex values are estimates from photos, not colour-managed data. OWNER TO CONFIRM.
-- Per-finish numbers are the live ones for Metallic (20261007090000_bmw_paint_corrections.sql). Run before the car's
-- own migration (20261117106000_car_x5_g05_frames_only.sql), whose paint_ids name these rows. Safe to re-run: existing
-- rows are left alone.

insert into public.paints (id, name, code, hex, type, roughness, metalness, clearcoat, clearcoat_roughness, sort_order, active)
select v.id, v.name, v.code, v.hex, v.type, v.roughness, v.metalness, v.clearcoat, v.clearcoat_roughness,
       (select coalesce(max(sort_order), 0) from public.paints) + v.n, true
from (values
  (1, 'blue_ridge_mountain', 'Blue Ridge Mountain', 'C35', '#3a5563', 'Metallic', 0.45, 0.8, 1.0, 0.05),
  (2, 'manhattan',           'Manhattan',           'C3D', '#646d63', 'Metallic', 0.45, 0.8, 1.0, 0.05),
  (3, 'ametrin',             'Ametrin',             'X1B', '#4b3d43', 'Metallic', 0.45, 0.8, 1.0, 0.05)
) as v(n, id, name, code, hex, type, roughness, metalness, clearcoat, clearcoat_roughness)
on conflict (id) do nothing;
