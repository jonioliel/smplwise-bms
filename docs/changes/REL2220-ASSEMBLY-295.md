# REL2220-ASSEMBLY-295 - assembly record for release/2220

Base `origin/main` 223fff4ad (v2.20.0). Merges (all `--no-ff`, no conflicts): HOME-295 (aaee9b7e7), ANNOUNCEB-295 (283f39da1), TPLV2-295 (325abfa26).
The pilot branches sit on `release/2210` (2.21.0 candidate), so that stack arrives with them; no merge conflict occurred.
Migrations: 0178 (ANNOUNCEB) only; bus times are out of scope (2.23.0); TPLV2 and HOME have none.
Version bump 2.22.0 in Dockerfile, config.yaml, `__init__.py`. API inventory regenerated: 1584 routes.
Test results: see the lead's report; any test not listed there is NOT_RUN.

## Second pass (2026-10-26)

Merged, in order, onto `release/2220` (`663db24e3`): `origin/release/2211m` (2.21.1, `b82ad4518`; `origin/main` was still v2.20.1), `origin/pilot/HOMEINFO-295` (`e16735d04`), `origin/pilot/NOTICEREMOVE-295` (`d81d8119e`).

Conflicts and resolution:
- `Dockerfile`, `config.yaml`, `__init__.py`: kept 2.22.0.
- `CHANGELOG.md`: 2.22.0 entry first, then the 2.21.1 and 2.21.0 entries (the 2.21.1 sentence "does not include the 2.21.0 line" was reworded).
- `contracts/API_INVENTORY.md`: took this branch, then regenerated (see the release report for the count).
- `frontend/src/notice-tv/tv.css`: kept both blocks (ANNOUNCEB `.ann` and TVOPT header rules).
- `frontend/src/notice-tv/main.ts`: TVOPT `nightLogoMode(...)` with the HOME-295 system default `invert` instead of `plate`.
- `frontend/tests/unit-screen-display.spec.ts`, `backend/tests/test_polish_display_settings.py`: POLISH2 expectations with the HOME-295 default info style `auto`.
- `www` / `www-public`: auto-merged from 2211m; stale, must be rebuilt on the runner.
- `frontend/src/screens/devices-building.ts` (HOMEINFO vs HOME-295): by hand. The edit-bar choice (thin row / widgets) patches `home.info_style` at once and keeps the options form draft/base equal; the edit view derives bar/cards through `effectiveInfo()` (auto resolves by the view); `moveAmong` replaces `moveWidget` for drag in the drawn cards; unused `moveWidget` import removed.
- NOTICEREMOVE: clean.
