-- Finish names as one word, the way the FORGED website and Sixnine write them (PureBronze,
-- GlossBlack, LiquidMetal). Owner's request, 2026-11-23. Ids are unchanged, so share codes,
-- saved builds, leads and prices keep pointing at the same finishes; only the visible names move.
--
-- 1. Every finish name loses its spaces ("Gloss Black" -> "GlossBlack").
update public.wheel_finishes
set name = replace(name, ' ', '')
where name like '% %';

-- 2. The colour name where it only repeated the finish name. Descriptive colour names
--    ("Satin Bronze", "Polished Aluminium", "Chrome") stay as they are.
update public.wheel_finishes
set color_name = replace(color_name, ' ', '')
where color_name in ('Gloss Black', 'Hyper Black');

-- 3. Wheel descriptions and highlights that name a finish.
create or replace function pg_temp.one_word_finishes(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(replace(replace(t,
    'Pure Bronze', 'PureBronze'),
    'Gloss Black', 'GlossBlack'),
    'Liquid Metal', 'LiquidMetal'),
    'Hyper Black', 'HyperBlack'),
    'Black Matte', 'BlackMatte'),
    'Polished Face', 'PolishedFace')
$$;

update public.wheels
set description = pg_temp.one_word_finishes(description),
    highlights = array(
      select pg_temp.one_word_finishes(h)
      from unnest(highlights) with ordinality as x(h, n)
      order by n
    )
where description ~ '(Pure Bronze|Gloss Black|Liquid Metal|Hyper Black|Black Matte|Polished Face)'
   or array_to_string(highlights, '|') ~ '(Pure Bronze|Gloss Black|Liquid Metal|Hyper Black|Black Matte|Polished Face)';
