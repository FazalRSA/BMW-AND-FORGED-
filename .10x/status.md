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

**Decision (2026-11-12, `repo-cleanup-and-navigation` session):** this feature's own Drive and
multi-image-reconstruction exploration overlapped with `docs/RIM_PHOTO_TO_3D_SPEC.md`'s "Pilot
log" — same idea (multi-image AI reconstruction of a stocked wheel from the "WEBSITE wheels" Drive
folder), two providers, both blocked. **Resolved in favour of the Meshy-via-Higgsfield pilot**
(`repo-cleanup-and-navigation`'s): it was further along — FSA004's two real angle photos already
uploaded and confirmed, the job already preflighted at 20 credits — and its remaining blocker is a
plain credit top-up, not a new API key/credential to provision. The other session
(`session_015obiwacWWAXLcwnsYzmqUf`, branch `claude/clever-brahmagupta-xnnpfj`) was messaged on
2026-11-12 and asked to hold off on its own Tripo multi-image spike; the rest of its
`presentation-ready` work (lighting/finishes, dealer/Google auth) is unaffected and should continue.
If that session disagrees with this call, it said so in its reply — check before assuming it holds.
