-- x3_g45: live model served from the repo at /models/x3_g45.glb (the car's own tyres, discs and calipers; frames stay for the stage at rest).
-- Blendkit Royalty Free model by Zifir3D Fedorov; the author agreed to live serving (2026-11-25), see public/models/CREDITS.md.
-- Apply only after the GLB is deployed, or the car has no model to load. Only the model fields change; specs and paints are untouched.
insert into public.cars (id, name, badge, generation, chassis_code, body_style, model_url, model_rotation_deg, model_length_m,
  paint_mesh_match, hide_mesh_match, active)
values ('x3_g45', 'BMW X3 M50', 'X3 M50 xDrive G45', 'G45', 'G45 X3 M50',
  'suv', '/models/x3_g45.glb', 0, 4.755, '(^|[^a-z])paint($|[^a-z])', '(^|[^a-z])rim($|[^a-z])', true)
on conflict (id) do update set
  model_url = excluded.model_url, model_rotation_deg = excluded.model_rotation_deg, model_length_m = excluded.model_length_m,
  paint_mesh_match = excluded.paint_mesh_match, hide_mesh_match = excluded.hide_mesh_match, active = true, updated_at = now();
