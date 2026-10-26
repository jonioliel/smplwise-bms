# REL2230-ASSEMBLY-295 - assembly record for the 2.23.0 candidate (pilot/BUSTIMES-295-r)

Base `origin/release/2220` f2f3540f8 (2.22.0 candidate). Merged: `pilot/BUSTIMES-295` (338cb4c19: bus times, the BUSRT-295 engine cherry-picked as f5b2c44b0,
estimate + distance, refresh controls) and `origin/pilot/BUSRT-295` (3506f6a6e, recorded with `-X ours` because its engine files are already in, with the distance addition).
Conflicts: `frontend/src/notice-tv/main.ts` (the one-row header render of TVOPT-295 keeps `sideBus` / `stripBus`), `frontend/src/notice-tv/tv.css` (both blocks kept),
`smplwise_vms/backend/smplwise/services/notices/model.py` (both display defaults kept).
Migration: 0179 stays (next free after 0178; TPLV2 landed without one).
Version bump 2.23.0 in Dockerfile, config.yaml, `__init__.py`; CHANGELOG entry (bilingual); API inventory regenerated (1594 routes).
`www` / `www-public` are NOT rebuilt (needs the runner). Test results: see the report; anything not listed there is NOT_RUN.
