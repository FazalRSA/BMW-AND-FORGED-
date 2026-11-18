-- Five factory colours for the limited-run cars added on 2026-11-17 (mirrors data/configuratorData.ts BMW_PAINTS).
-- The M3 CS (Frozen Solid White, Signal Green, Brooklyn Grey, Black Sapphire), the M3 CS Touring (British Racing
-- Green, Laguna Seca Blue, Frozen Solid White, Black Sapphire) and the M4 CSL (Frozen Brooklyn Grey, Alpine White,
-- Black Sapphire) are sold in three or four colours only, so they show their real ones, as the M4 CS does.
-- Codes: P91, P56 and P8X from paint databases (carpaints.co, car-editor.com, touch-up suppliers). British Racing
-- Green is a BMW Individual paint whose code is not published; it is a solid colour (BMW's releases call only
-- Sapphire Black metallic, and UK dealers list it as "British Racing Green Solid"). Laguna Seca Blue's 448 is the
-- original E46 code. Hex values are estimates from BMW's press photos. OWNER TO CONFIRM.
-- Per-finish numbers are the live ones (20261007090000_bmw_paint_corrections.sql). Run before the cars' own
-- migrations (20261117100000 onward), whose paint_ids name these rows. Safe to re-run: existing rows are left alone.

insert into public.paints (id, name, code, hex, type, roughness, metalness, clearcoat, clearcoat_roughness, sort_order, active)
select v.id, v.name, v.code, v.hex, v.type, v.roughness, v.metalness, v.clearcoat, v.clearcoat_roughness,
       (select coalesce(max(sort_order), 0) from public.paints) + v.n, true
from (values
  (1, 'frozen_solid_white',   'Frozen Solid White',   'P91',        '#e9e9e6', 'Frozen',   0.55, 0.4, 0.0, 0.5),
  (2, 'signal_green',         'Signal Green',         'P56',        '#249a48', 'Uni',      0.5,  0.0, 1.0, 0.05),
  (3, 'frozen_brooklyn_grey', 'Frozen Brooklyn Grey', 'P8X',        '#a4a9ac', 'Frozen',   0.55, 0.4, 0.0, 0.5),
  (4, 'british_racing_green', 'British Racing Green', 'Individual', '#1f3d2b', 'Uni',      0.5,  0.0, 1.0, 0.05),
  (5, 'laguna_seca_blue',     'Laguna Seca Blue',     '448',        '#3a8fd1', 'Uni',      0.5,  0.0, 1.0, 0.05)
) as v(n, id, name, code, hex, type, roughness, metalness, clearcoat, clearcoat_roughness)
on conflict (id) do nothing;
