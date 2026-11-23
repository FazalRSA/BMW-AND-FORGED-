-- M Donington Grey metallic, one of the three M colours of the 2020 BMW X5 M launch range (BMW USA's launch release
-- "The new 2020 BMW X5 M and X6 M": Donington Grey, Marina Bay Blue and Toronto Red; BMW's 10/2019 press kit: "drei M
-- spezifische Farben"), which the paints table did not have (mirrors data/configuratorData.ts BMW_PAINTS). Code C28
-- from touch-up paint suppliers (paintscratch, Automotive Touchup), not a BMW document. The hex value is an estimate
-- from photos, not colour-managed data. OWNER TO CONFIRM. Per-finish numbers are the live ones for Metallic
-- (20261007090000_bmw_paint_corrections.sql). Run before the car's own migration
-- (20261117107000_car_x5m_f95_frames_only.sql), whose paint_ids name this row. Safe to re-run: an existing row is left
-- alone.

insert into public.paints (id, name, code, hex, type, roughness, metalness, clearcoat, clearcoat_roughness, sort_order, active)
select v.id, v.name, v.code, v.hex, v.type, v.roughness, v.metalness, v.clearcoat, v.clearcoat_roughness,
       (select coalesce(max(sort_order), 0) from public.paints) + v.n, true
from (values
  (1, 'donington_grey', 'Donington Grey', 'C28', '#62686a', 'Metallic', 0.45, 0.8, 1.0, 0.05)
) as v(n, id, name, code, hex, type, roughness, metalness, clearcoat, clearcoat_roughness)
on conflict (id) do nothing;
