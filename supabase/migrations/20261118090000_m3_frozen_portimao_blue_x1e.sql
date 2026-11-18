-- The M3 Competition (m3_g80) and M3 Competition Touring (m3_touring_g81) listed Frozen Portimao Blue as the C6R row
-- (frozen_portimao_blue_c6r), which is the M2's and M235's code. BMW South Africa's configurator lists it on the G8x
-- M3 and M4 as X1E, a BMW Individual special order (docs/bmw-factory-paints.md, sections 3 and 4; the M4 Competition
-- already uses it). Both rows exist with the same colour and finish, so only the code customers see changes.
-- Safe to re-run: array_replace leaves an array without the C6R id as it is.
update public.cars
set paint_ids = array_replace(paint_ids, 'frozen_portimao_blue_c6r', 'frozen_portimao_blue'),
    updated_at = now()
where id in ('m3_g80', 'm3_touring_g81');
