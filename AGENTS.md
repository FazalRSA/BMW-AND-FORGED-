# AGENTS.md

<!-- handoff:learnings:begin -->
## Session Learnings (auto-updated by handoff)

### Implicit Rules
- Stack: React 19, Vite 6, Three.js, bun, Supabase, Vercel, n8n; typecheck with bun run lint
- PR flow: draft PR after push, subscribe PR activity, attribution footer on PR and commits
- Brand and copy in config/brand.ts; catalogue source of truth is Supabase, data/configuratorData.ts is fallback
- Permission mode is set in the UI dropdown; settings.json only sets allow rules
- Scratchpad is session-scoped; do not rely on it persisting

### Key Decisions
- Decision: allow rules in .claude/settings.json for git, bun/npm, node, ffmpeg and basic file commands only — Reason: cut prompts without pre-approving credential lookups or external installs
- Decision: build video with local /hyperframes skill, not hosted MCP — Reason: user chose skill; hosted compose disabled for CLI
- Decision: 16:9, about 90s, British female VO with best voice model — Reason: user spec for BMW pitch

<!-- handoff:learnings:end -->
