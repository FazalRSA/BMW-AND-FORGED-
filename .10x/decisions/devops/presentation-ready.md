# DevOps: presentation-ready
- Ships with the normal flow: owner merges PR #40, then a production deploy from that main SHA (forgedsa-deploy-and-release skill). Production is still the 8 Oct build until then.
- Rollback: revert the fix(wheels) commit, or open the site with ?wheelEnv=0.1 variants to compare; no data or schema to roll back.
