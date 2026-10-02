# Release test policy (risk-based)

Owner decision 2026-10-02: small releases ship fast with a focused suite; the full, comprehensive suite is reserved for large releases.
Never claim a pass that was not run; every release report states exactly which tier ran.

## Tiers

| Tier | When | What runs | Typical time |
|---|---|---|---|
| **S - small** | Fixes, settings, one screen, no shared-component or security change | `scripts/release_check.py`; backend tests of the touched modules + their direct neighbours (grep the changed file names in `smplwise_vms/backend/tests`); Playwright specs of the touched screens on all three projects (desktop, tablet, mobile); `tsc --noEmit`; a 10-minute smoke set (login/shell, home, area, security live, multimedia, settings open) | 40-70 min |
| **M - medium** | A shared component or style (`sw-page`, `sw-tabs`, tokens, `media-page`), a new setting with a /me/prefs path, a bridge change | Tier S + every spec that references the shared component (grep) + the whole backend directory of the touched domain (settings, access, automations, media...) | 1.5-2 h |
| **L - large** | New migration, RBAC/permission change, bridge allow-list, authentication, backup/restore, a new screen family, a skin/theme layer, anything an owner review flags | The FULL backend suite + the FULL Playwright suite on the dist preview + the dev-server specs + the camera-card fixture spec (the 0.1.151/0.1.152 routine) | 2.5-3 h |

A release takes the highest tier any of its changes needs. When in doubt, go one tier up.

## Always, whatever the tier
- `release_check.py` green (versions, migrations contiguous, bridge copies identical, UI built).
- Security-relevant changes (permissions, auth, request bodies, secrets, destructive actions) get a review before release.
- A nightly full run of backend + Playwright on the integration branch (when the machine is idle) keeps a current full-suite number, so a small release is never based on a stale full result.
- Known time-of-day-dependent tests (quiet hours) are run in daytime, or fixed with a frozen clock.
- Specs that import `/src/...` need the Vite dev server; the camera-card spec needs its fixture backend.
- Evidence screenshots overwritten by a run are restored (`git checkout -- docs/...`) unless the change is intended.

## Release steps (all tiers)
1. Integration branch merged, version bumped (`config.yaml`, `Dockerfile` label, `smplwise/__init__.py`, CHANGELOG head, API inventory), UI built into `smplwise_vms/www`.
2. Tier suites green; a red test is fixed or explained as pre-existing with evidence, never ignored.
3. Bilingual release notes (Hebrew and English): what was added, bugs fixed, how to enable.
4. Merge to the integration/main branches and push; the owner installs.
