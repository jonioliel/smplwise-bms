# Handoff (current)

Keep this file current at every milestone: a session with no memory of the conversation must be able to continue from it. No secrets, lab addresses, serials or MACs here.

Updated: 2026-10-02 16:30, by the primary Claude account (weekly quota 83% all models / 56% Fable, reset 2026-10-07 00:00 local).

## House rules
- The product owner (Hebrew) wants Hebrew replies with numbered questions and a/b/c options; code, commits and repository documents in English. Every update ends with progress percentages (`scripts/progress.py`), carries ETAs, and release notes are bilingual.
- Release authority: release on my own when the tier suite is green; ask first if anything is red. Test tiers: `docs/release/TEST_POLICY.md`. No device writes (NVR, go2rtc, HA users, recordings, network) without the owner's task-specific approval.
- Never echo `secrets/` values. Music Assistant token for the lab is in `secrets/ma_hoffnung.env` (the owner revokes it at the end).
- Models: Sonnet for small work, Opus or Fable for design and security. The owner wants the Fable quota used for quality work.
- Switch to the second account only at about 99% of the weekly quota; keep everything committed in small steps so an interruption loses nothing.

## Branch state (2026-10-02 16:30)
- **0.1.152 RELEASED** (merge 8d3b3fe4 on `g0/intake` and `main`, pushed). Bridge 0.6.0: the owner restarts the platform once.
- **`integ/0153` = the combined 0.1.153** (worktree `C:\cloude\smplwise-0153`, tier L): phone fixes, tabs dropdown (tab pair), caps 128, HA 2026.10 compat, CR-019 protected switches (migration 0049), CR-020 S1 read-only cameras table, Bubble foundation (`ui.look`, skin `bubble`, sw-sheet, sw-pill, dock), guide pages, bilingual changelog written, UI built. The full suite was running: backend in two shards (`backend_a.log`, `backend_b.log`) and Playwright on the dist preview port 4176 (`pw153_full.log`). Known on the preview run: specs that import `/src/...` (tabs-pair, tabs-dropdown, layout-bubble, media-remote, media-queue, media-player-panel) must be re-run on a Vite dev server; check `evidence-alarm.spec.ts:101` (settings > security tabs changed by the cameras tab) as a possible real regression. Release = merge into `g0/intake`, push `g0/intake` and `g0/intake:main`.
- `pilot/bubble-screens` (Fable agent): Bubble on multimedia (first commit 151002ba), home and area in progress; next release 0.1.154.
- `pilot/palettes-data`: ten palettes + validator (data only; the loader/editor is not built).
- Reference/decision branches: `pilot/design-bubble-taste` (approved mockup), `pilot/design-bubble-research`, `pilot/design-bubble-catalogue`, `pilot/CR020-nvr-settings-arch`.
- Not pushed to GitHub: `pilot/coord-protocol-v2`; the private companion repo `smplwise-arx-private` has the memory and START_HERE_HE.md.

## Owner inputs still missing
Bubble palette taste; Frigate and Provision-ISR NVR access and questions (waiting); electricity bill specification; list of infrastructure components; announcements decision; the iOS plan lives in another session.

## Next actions
1. Finish and release 0.1.152, then 0.1.153 (tier M).
2. Merge Bubble foundation (0.1.154, tier L), then the screens in 0.1.155 and the following versions of `docs/release/ROADMAP.md`.
3. Check the weekly quota (`get_usage`) at every milestone; tell the owner at 85% and at 95%.
