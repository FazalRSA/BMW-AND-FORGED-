-- Melbourne Red metallic, the red of the BMW 2 Series Coupé (G42) before its 2024 update, which the paints table did not
-- have (mirrors data/configuratorData.ts BMW_PAINTS). cars.com's colour list for the 2022 M240i xDrive Coupé names it
-- (with Thundernight, Brooklyn Grey, Mineral White, Black Sapphire and Alpine White); Fire Red only reached the two-door
-- with the 2024 update ("Fire Red metallic and Skyscraper Grey metallic that are available for the first time for the
-- two-door model", BMW Group Asia's 2024 Singapore launch release). Code A75 from paint suppliers (The Spray Source,
-- paintscratch), not a BMW document. The hex value is an estimate from photos, not colour-managed data. OWNER TO
-- CONFIRM. Per-finish numbers are the live ones for Metallic (20261007090000_bmw_paint_corrections.sql). Run before the
-- car's own migration (20261117108000_car_m240i_g42_frames_only.sql), whose paint_ids name this row. Safe to re-run: an
-- existing row is left alone.

insert into public.paints (id, name, code, hex, type, roughness, metalness, clearcoat, clearcoat_roughness, sort_order, active)
select v.id, v.name, v.code, v.hex, v.type, v.roughness, v.metalness, v.clearcoat, v.clearcoat_roughness,
       (select coalesce(max(sort_order), 0) from public.paints) + v.n, true
from (values
  (1, 'melbourne_red', 'Melbourne Red', 'A75', '#901c26', 'Metallic', 0.45, 0.8, 1.0, 0.05)
) as v(n, id, name, code, hex, type, roughness, metalness, clearcoat, clearcoat_roughness)
on conflict (id) do nothing;
