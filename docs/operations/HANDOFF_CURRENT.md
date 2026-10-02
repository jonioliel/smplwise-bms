# Handoff (current)

Keep this file current at every milestone: a session with no memory of the conversation must be able to continue from it. No secrets, lab addresses, serials or MACs here.

Updated: 2026-10-02 afternoon, by the primary Claude account (quota about 72% weekly, reset 2026-10-06 23:59 local).

## House rules
- The product owner (Hebrew) wants Hebrew replies with numbered questions and a/b/c options; code, commits and repository documents in English. Every update ends with progress percentages (`scripts/progress.py`), carries ETAs, and release notes are bilingual.
- Release authority: release on my own when the tier suite is green; ask first if anything is red. Test tiers: `docs/release/TEST_POLICY.md`. No device writes (NVR, go2rtc, HA users, recordings, network) without the owner's task-specific approval.
- Never echo `secrets/` values. Music Assistant token for the lab is in `secrets/ma_hoffnung.env` (the owner revokes it at the end).
- Models: Sonnet for small work, Opus or Fable for design and security. The owner wants the Fable quota used for quality work.
- Switch to the second account only at about 99% of the weekly quota; keep everything committed in small steps so an interruption loses nothing.

## Branch state
- `integ/0152`: release candidate 0.1.152 (final backend suite was running; frontend suites green). Release = merge into `g0/intake` and `main`, push, bilingual notes.
- `integ/0153`: 0.1.153 integration (worktree `C:\cloude\smplwise-0153`): wave1 + phone fixes merged, CR-019 S1 deliberately reverted. Pending: tabs dropdown with two chips in one row (`pilot/tabs-dropdown-0153`).
- `pilot/bubble-foundation` (agent): Bubble skin foundation for 0.1.154.
- `pilot/design-bubble-taste` (approved mockup), `pilot/design-bubble-research`, `pilot/design-bubble-catalogue`: reference docs.
- Merged nowhere yet and not pushed to GitHub: coordination protocol `pilot/coord-protocol-v2`, upstream watch (merged in `integ/0152`), CR-020 docs `pilot/CR020-nvr-settings-arch`.

## Owner inputs still missing
Bubble palette taste; Frigate and Provision-ISR NVR access and questions (waiting); electricity bill specification; list of infrastructure components; announcements decision; the iOS plan lives in another session.

## Next actions
1. Finish and release 0.1.152, then 0.1.153 (tier M).
2. Merge Bubble foundation (0.1.154, tier L), then the screens in 0.1.155 and the following versions of `docs/release/ROADMAP.md`.
3. Check the weekly quota (`get_usage`) at every milestone; tell the owner at 85% and at 95%.
