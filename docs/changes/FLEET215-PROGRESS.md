# FLEET215-295 progress (slice 1 complete, 2026-10-23)

Branch `pilot/FLEET215-295`, cut from `origin/main` @ 90cd7d9ae. Change record: `docs/changes/CR-FLEET215.md`.
Provisional migration: `0149_fleet_report_log.sql` (the lead renumbers at integration; only this one file carries the number, plus the
`db_schema` figure in `services/fleet-receiver/tools/gen_fixtures.py` fixture body - regenerate the fixture after a renumber).

## Done in slice 1
- Backend: `services/fleet_keys.py`, `fleet_report.py`, `readiness.py`, `demo_mode.py`; routers `fleet.py`, `readiness.py`; migration 0149;
  backup exclusions; add-on option `fleet_report_url` (config.yaml, config.py, self_update, DOCS.md, DOCS_HE.md).
- Receiver skeleton `services/fleet-receiver/` with generated `src/schema.json`, signed interop fixture, `package-lock.json`.
- Change record CR-FLEET215.md (schema justification per field, threat model, privacy, keys, receiver, readiness, demo, owner questions).
- Tests: `test_fleet_report_215.py`, `test_readiness_demo_215.py`, `test_fleet_receiver_fixtures_215.py`.
- `contracts/API_INVENTORY.md` regenerated (1208 routes).

## Test results (runner, targeted only)
- pytest: test_fleet_report_215, test_readiness_demo_215, test_fleet_receiver_fixtures_215, test_docs_config_consistency,
  test_self_update_s3_fixes, test_backup: 104 passed, 1 failed (a test-isolation bug in the new demo test, fixed afterwards).
- pytest test_readiness_demo_215.py after the fix: 18 passed.
- fleet-receiver: `npm ci`, `npm run typecheck` clean, `npm test` 15 passed.
- NOT_RUN: the API-inventory consistency test after regeneration, the whole suite, any frontend check (no UI in slice 1).

## Remaining (slice 2 and integration)
1. Settings UI card (readiness, report switch, preview/log, demo switch) and the demo label on screens that opt in.
2. Receiver: deploy decisions (owner), overview page, silence alerting, key rotation message.
3. Lead: renumber the migration, bump version/changelog/release notes, run the API-inventory test in the gate.

## Open owner questions (recommendation first)
1. Include `counts.users_active` / `system_admins` (counts only)? Recommend: yes.
2. Receiver as a separate Worker (recommended) or a route inside the push relay?
3. Key rotation: re-enroll by hand (slice 1) or a rotation message signed by the old key (slice 2)? Recommend slice 2.
4. Admin overview behind Cloudflare Access in addition to ADMIN_TOKEN? Recommend yes.
5. Data-processing terms with customers before the first enrollment (who signs)?
