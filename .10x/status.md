# Status

**Feature:** repo-cleanup-and-navigation
**Phase:** Delivery complete (docs-only change; scaled down — no DBA/QA/Security/SRE phases needed,
nothing in the app's runtime behaviour, schema, or data changed)

## Done
- [x] Design: ADR-001 written (`.10x/adrs/001-docs-navigation-and-cleanup.md`)
- [x] Implementation: `docs/MAP.md`, `docs/RIM_PHOTO_TO_3D_SPEC.md` written; `agents.md`/`skills.md`
      deduped into `AGENTS.md`/`docs/SKILLS.md`; `PHOTOREAL_SPEC.md` and `NO_BLENDER_AND_UI_PLAN.md`
      archived; every stale cross-reference fixed and checked with `grep`
- [x] Verification: `bun run lint` and `bun run build` run clean (docs-only, but checked anyway)
- [x] Delivery: committed, pushed, draft PR opened and subscribed

## Not in scope for this task
- `docs/PLATES_MASTER_PLAN.md` left as-is (separate open initiative, PR #13, not this session's)
- No code, schema, or catalogue changes
