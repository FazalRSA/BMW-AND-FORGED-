-- The M340i Touring is not sold in South Africa (owner, 2026-11-25): archive the row, then remove it from the catalogue.
-- Checked before writing: no profiles use it as primary_car_id and no lead mentions it. Restore from archive.legacy_cars if ever needed.
insert into archive.legacy_cars select * from public.cars where id = 'm340i_touring_g21'
  and not exists (select 1 from archive.legacy_cars a where a.id = 'm340i_touring_g21');
delete from public.cars where id = 'm340i_touring_g21';
