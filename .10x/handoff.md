# Handoff

This file carries context for every feature currently active under `.10x/`. One section per
feature — see `status.md` for current phase/blockers per feature.

## repo-cleanup-and-navigation

Done and shipped (see `status.md`).

**Update 2026-11-11, later:** the owner asked to actually run the rim-photo-to-3D pilot. FSA-07 had
no real multi-angle photos in the repo (only its already-traced grey mask — and it's now deleted
from the repo entirely, per the legacy-cleanup migration that landed on `main` in the meantime), so
the pilot moved to **FSA004** using real turntable photos from the owner's Drive ("WEBSITE wheels" →
"FSA4") — a better subject anyway, since FSA004 already has a ground-truth GLB to measure against.
Both photos are uploaded and confirmed in the Higgsfield media library, the `multi_image_to_3d` job
is preflighted (20 credits), but the connected Higgsfield workspace has 0 credits and the owner
chose not to top up right now. **Nothing was submitted, nothing was charged.** Full resume
instructions (exact media IDs and params) are in `docs/RIM_PHOTO_TO_3D_SPEC.md` → "Pilot log" —
resuming is one `generate_3d` call once the workspace has credits.

If `docs/PLATES_MASTER_PLAN.md`'s PR #13 merges later, revisit the "historical/separate initiative"
table in `docs/MAP.md` — it will need to move from "separate, unmerged" to either "current" or
"archived", depending on what actually landed.

**See also:** the `presentation-ready` feature below independently explored the *same* Drive folder
and the *same* multi-image-reconstruction idea (different provider — Tripo there, Meshy/Higgsfield
here), and is blocked the same way (no credits/API key). Worth the owner reconciling the two before
either one actually spends credit, so the same wheel isn't reconstructed twice at cost.

## presentation-ready

**From:** discovery + brainstorming · **To:** CTO/PM (phase 1) once the owner approves.

Read specs/2026-11-12-presentation-ready-design.md first. Key facts:
- The six rims already are good GLBs; the photoreal gap is lighting and finishes, not geometry (docs/ingest/stock-wheels.jpg).
- Tripo is installed (0.11.2); dry runs: 40 credits single image geometry-only v3.1 detailed, 30 credits two-photo multiview. Use only as a one-wheel spike.
- Drive > WEBSITE wheels (folder id 1-O0emTrsTXfFzrUGRcdlB9CDMcF6Au7d) holds per-wheel reference photos; no FF-1 folder.
- Logins: admin works; dealer has no auth user; Google provider off.

Next: on approval, write cto/ and product-manager/presentation-ready.md, then ADR-001 (wheel-only lighting environment) in phase 2.
