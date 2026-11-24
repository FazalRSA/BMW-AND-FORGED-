-- The configurator's FSA002 and FSA003 now match the website (Forgedwebsite src/data/catalogue.ts).
-- FSA002 is the forked-spoke wheel, in Hyper Black and Polished Face (the 15-spoke gold wheel it used to show is the FSA003).
-- FSA003 is the fifteen-spoke wheel, in Gold, Silver and Hyper Black. Prices are unchanged: they already match the website
-- (FSA003 R75 000 in every finish, FSA002 Polished Face R85 000 through price_by_finish).
update public.wheels set
  subtitle = 'Forked-spoke monoblock',
  spoke_count = 10,
  description = 'Forked-spoke forged monoblock in Hyper Black or Polished Face. In stock for the M3 Competition Sedan (G80): PCD 5×112 · ET8/15 · CB 66.6.',
  highlights = array['Forged monoblock', 'Hyper Black or Polished Face', 'PCD 5×112 · ET8/15 · CB 66.6'],
  available_variants = array['hyper_black', 'polished_face'],
  default_variant = 'hyper_black',
  updated_at = now()
where id = 'forged_fsa002';

update public.wheels set
  description = 'Fifteen straight, evenly spaced spokes from a five-lug hub to a slim outer lip, in Gold, Silver or Hyper Black. In stock for the M3 Sedan and M3 Competition Sedan (G80): PCD 5×112 · ET8/15 · CB 66.6.',
  highlights = array['Fifteen straight spokes', 'Gold, Silver or Hyper Black', 'PCD 5×112 · ET8/15 · CB 66.6'],
  available_variants = array['gold', 'silver', 'hyper_black'],
  updated_at = now()
where id = 'forged_fsa_03';
