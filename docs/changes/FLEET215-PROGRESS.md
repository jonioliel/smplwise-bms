# FLEET215-295 progress (interrupted: owner reboot, 2026-10-23)

Branch `pilot/FLEET215-295`, cut from `origin/main` @ 90cd7d9ae. Work in progress, NOT tested: no test has been run yet (0 run,
0 passed). No runner worktree was created. No process of this task is running.

## Written (untested)
- `smplwise_vms/backend/smplwise/services/fleet_keys.py` - fleet Ed25519 key, random installation id and sequence number in
  `<data>/keys/fleet/` (files only, never in the DB or backups), domain-separated signing (`CONTEXT`), enrollment code.
- `services/fleet_report.py` - closed schema `SCHEMA_KEYS` + `validate()` (fail closed), `collect()` (counters/states only),
  `assemble()`, canonical JSON, two keys (add-on option `fleet_report_url` -> `SW_FLEET_REPORT_URL` AND setting `fleet.report_enabled`,
  OFF), `send_once()`, `tick()`, `worker_loop()`, `fleet_report_log`, `schema_json()`.
- `services/readiness.py` - weighted checklist from setup_wizard state + counts (14 items, not-applicable rules, `missing` ids).
- `services/demo_mode.py` - switch `demo.enabled` (OFF), constant example dataset, every object `example: true`.
- `routers/fleet.py` (GET/PUT /fleet/report, /enrollment, /preview, /log, POST /send; system.configure + system admin, audited) and
  `routers/readiness.py` (GET /readiness, GET/PUT /demo, GET /demo/dataset). Registered in `main.py`; worker started (SW_FLEET_WORKER=0 off).
- Migration `0149_fleet_report_log.sql` (provisional). `backup.py`: `fleet_report_log` never exported; `fleet.` / `demo.` setting prefixes kept.
- Add-on option `fleet_report_url`: config.yaml options+schema, config.py, self_update.OPTION_TYPES, DOCS.md, DOCS_HE.md.
- `services/fleet-receiver/` Cloudflare Worker skeleton: `src/index.ts`, `src/schema.ts`, `src/crypto.ts`, `test/receiver.test.ts`,
  `tools/gen_fixtures.py`, README, wrangler.toml, package.json (no package-lock yet).
- `tests/test_fleet_report_215.py` (negative-first: switch off sends/creates nothing, payload scan for forbidden keys/sentinels, schema
  refusals, tampered body/signature, routes/permissions/audit).

## Half done / missing
- `services/fleet-receiver/src/schema.json` and `test/fixtures/signed_report.json` NOT generated yet (run tools/gen_fixtures.py on the runner).
- `docs/changes/CR-FLEET215.md` NOT written; `test_the_whole_key_set_is_exactly_the_documented_schema` needs it (every schema key path in backticks).
- Tests not written: `tests/test_readiness_demo_215.py`, `tests/test_fleet_receiver_fixtures_215.py` (fixture + schema.json drift check).
- API inventory not regenerated; package-lock for fleet-receiver not created.

## Next 5 steps
1. On the runner: `git worktree add -f ~/work/fleet215 origin/pilot/FLEET215-295`; run `~/smplwisebms/.venv/bin/python services/fleet-receiver/tools/gen_fixtures.py`, copy both outputs into the branch.
2. Write CR-FLEET215.md (schema field justification, threat model, privacy review, signing/keys, receiver design + data model, readiness rules, demo rules, not built, owner questions).
3. Write the readiness/demo tests and the fixture drift test; run targeted pytest on the runner (`tests/test_fleet_report_215.py` etc. plus `test_docs_config_consistency.py test_self_update_s3_fixes.py test_backup.py`); fix.
4. `npm install --package-lock-only` in services/fleet-receiver, then on the runner `npm ci && npm run typecheck && npm test`.
5. `python scripts/api_inventory.py` on the runner; commit; remove the runner worktree; report.

## Open owner questions (draft, recommendation first)
1. Include `counts.users_active` / `system_admins` (counts only)? Recommend: yes.
2. Receiver as a separate Worker (recommended) or a route inside the push relay?
3. Key rotation: re-enroll by hand (slice 1) or a rotation message signed by the old key (slice 2)? Recommend slice 2.
4. Admin overview behind Cloudflare Access in addition to ADMIN_TOKEN? Recommend yes.
5. Data-processing terms with customers before the first enrollment (who signs)?
