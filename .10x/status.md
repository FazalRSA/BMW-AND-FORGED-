# Status

This file tracks every feature currently active under `.10x/`. One section per feature.

## repo-cleanup-and-navigation

**Phase:** Delivery complete (docs-only change; scaled down — no DBA/QA/Security/SRE phases needed,
nothing in the app's runtime behaviour, schema, or data changed)

### Done
- [x] Design: ADR-001 written (`.10x/adrs/001-docs-navigation-and-cleanup.md`)
- [x] Implementation: `docs/MAP.md`, `docs/RIM_PHOTO_TO_3D_SPEC.md` written; `agents.md`/`skills.md`
      deduped into `AGENTS.md`/`docs/SKILLS.md`; `PHOTOREAL_SPEC.md` and `NO_BLENDER_AND_UI_PLAN.md`
      archived; every stale cross-reference fixed and checked with `grep`
- [x] Verification: `bun run lint` and `bun run build` run clean (docs-only, but checked anyway)
- [x] Delivery: committed, pushed, PR #24 opened and subscribed; merged `main` back in on 2026-11-12
      to resolve a conflict with the concurrent `presentation-ready` feature's own `.10x/` files

### Not in scope for this task
- `docs/PLATES_MASTER_PLAN.md` left as-is (separate open initiative, PR #13, not this session's)
- No code, schema, or catalogue changes

## presentation-ready

**Feature:** presentation-ready · **Phase:** Discovery complete, Phase 0 spec written, WAITING FOR OWNER APPROVAL
**Date:** 2026-11-12

| Phase | State |
|---|---|
| Discovery | done (decisions/*/_index.md tagged [DISCOVERED]) |
| 0 Brainstorming | spec written: specs/2026-11-12-presentation-ready-design.md |
| 1-6 | not started |

### Blockers
- Owner approval of the spec and the presentation date.
- Tripo API key (tsk_...) not provided.
- Google provider off in Supabase (owner dashboard steps, docs/ACCOUNTS.md).
- Dealer allowlisted email has no Supabase Auth user.

**Note (added while resolving a merge conflict from `repo-cleanup-and-navigation`, 2026-11-12):**
this feature's own Drive and multi-image-reconstruction exploration overlaps with
`docs/RIM_PHOTO_TO_3D_SPEC.md`'s "Pilot log" (a separate session ran a Meshy-via-Higgsfield
multi-image pilot on FSA004 from the same "WEBSITE wheels" Drive folder, also blocked on
credits/an API key, just a different provider — Tripo here, Meshy/Higgsfield there). Worth
reconciling before both run the same spend twice.
