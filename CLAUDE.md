# CLAUDE.md

<!-- handoff:learnings:begin -->
## Session Learnings (auto-updated by handoff)

### Implicit Rules
- Stack: React 19, Vite 6, Three.js, bun, Supabase, Vercel, n8n; typecheck with bun run lint
- PR flow: draft PR after push, subscribe PR activity, attribution footer on PR and commits
- Brand and copy in config/brand.ts; catalogue source of truth is Supabase, data/configuratorData.ts is fallback
- Permission mode is set in the UI dropdown; settings.json only sets allow rules
- Scratchpad is session-scoped; do not rely on it persisting
- Wheel catalogue = the owner's stock sheet (docs/WHEEL_INVENTORY.md): real names FSA001-004/FF-1/FF-3, ZAR prices stored as USD/18.2; hide (active=false), never delete
- /configure is the owner's viewer look (services/viewerStudio.ts, engine.setLook) + ViewerPanel; verify visual work with scripts/render/shoot.cjs and ?look=viewer before claiming done
- Harness runs (journey.cjs, e2e.cjs) stub Supabase writes; never create real leads (each one emails the owner)
- Prepared cars/rims go in with scripts/ingest-car.mjs / scripts/ingest-rim.mjs (docs/ADD_PREPARED_CAR.md); migrations are written, not applied (no Supabase access from the sandbox)

### Key Decisions
- Decision: allow rules in .claude/settings.json for git, bun/npm, node, ffmpeg and basic file commands only — Reason: cut prompts without pre-approving credential lookups or external installs
- Decision: build video with local /hyperframes skill, not hosted MCP — Reason: user chose skill; hosted compose disabled for CLI
- Decision: 16:9, about 90s, British female VO with best voice model — Reason: user spec for BMW pitch
- Decision: customer accounts via Google on Supabase Auth with a garage; admin allowlist untouched — Reason: owner's choice (2026-11-10 plan)
- Decision: legacy Sketchfab cars and photo-traced wheels hidden, not removed — Reason: reactivation in /admin when packages/stock arrive

<!-- handoff:learnings:end -->
