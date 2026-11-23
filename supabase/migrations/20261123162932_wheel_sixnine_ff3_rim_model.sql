-- sixnine_ff3: 3D rim ff-3-sixnine-v3.glb packed by scripts/ingest-rim.mjs on 2026-11-23.
-- Served from the repo at /models/rims/sixnine_ff3-v2.glb; on the car it replaces the wheel's photo face (the rim page keeps its spin).
update public.wheels set model_url = '/models/rims/sixnine_ff3-v2.glb', model_flip = false, updated_at = now() where id = 'sixnine_ff3';
