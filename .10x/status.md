# Status
**Feature:** presentation-ready · **Phase:** Verification complete; delivery waits on the owner (merge PR #40, deploy)
**Date:** 2026-11-12

| Phase | State |
|---|---|
| 0-3 | done (spec, ADR-001, plan) |
| 4 Implementation | done: wheel reflections on the stage, sign-in inbox line |
| 5 Verification | done: lint, build, shoot.cjs sheets, journey.cjs phone + desktop pass |
| 6 Delivery | owner: merge #40, production deploy, real-phone check |

## Open, owner only
- Google provider in Supabase (docs/ACCOUNTS.md steps 1-4).
- Dealer login: create the Supabase Auth user for the allowlisted dealer email (Auto Confirm or Invite).
- Tripo API key, if the one-wheel spike is still wanted.
