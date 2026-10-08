# HA2610-IMPL — running status

Branch `pilot/HA2610-impl`, based on `origin/pilot/HA2610-compat` @ 66187c68 (origin/main 31fe5d7c + 478dc675 + the analysis doc).
Plan: `docs/operations/HA_2026_10_COMPATIBILITY_HE.md` section 4 ("תוכנית התאמה מסודרת", 11 rows); its section 9 has the same table
in Hebrew. If this agent is stopped, continue from "Next step" below. Push after every step.

| Plan row | Item | State | Commit |
|---|---|---|---|
| 1 | `for` rule aligned to HA 2026.10 | DONE before this branch | 478dc675 |
| 2 | Username normalisation regression tests (case twins, inner space, bootstrap once) | DONE | e9396b71 |
| 3 | Audit-log username filter normalised (strip + casefold, empty matches nothing) | DONE | e9396b71 |
| 4 | Read-only scan (`services/ha_compat.py`, `GET /automations/compat`, `system.configure`), card in Settings > Automations shown only with findings, evidence spec + PNGs | DONE | 7bbc44db, 5446a8bc, 395b54db, a70f2f8a, 8a0c6f10 |
| 5 | Manual run refused as Unauthorized -> 403 `requires_ha_admin` (run ops only; no bridge change) | DONE | 6e763466 |
| 6 | Fake HA validation profiles 2026.9 / 2026.10 (probatio wording, `for` rule; HA's exact sentence for the rule NOT verified) | DONE | 76e6d28d |
| 7 | Connection probe: port 80 refused only when the target is the HA host | DONE | 075da7f1 |
| 8 | Lab verification after the owner upgrades | OWNER-SIDE, not done | - |
| 9 | WisKey gate env 2026.10 | coordination note below; gate env untouched | - |
| 10 | upstream watch registry | PARTIAL: keywords only (ha-core, ha-supervisor, ha-dev-blog) | 91ef1b44 |
| 11 | climate / water_heater `temperature_unit` | DONE | 03a2d661 |
| docs | compat doc section 9, user guide (43, 80, combined HTML), `docs/release/NEXT-DRAFT.md`, API inventory, AUTOMATIONS_API.md rows 24 + §3.3 | DONE | ab66f8c4 + this commit |

## Tests (runner, real runs; SHAs as printed in the runner header)

- 075da7f1 backend: test_nvr_connection, test_cr022_security_review, test_cr022_security_third_review, test_multi_nvr - 135 passed.
- e9396b71 backend: test_username_normalisation, test_access - 12 passed.
- 76e6d28d backend: test_fake_ha_config, test_automations_api, test_bridge_config_service, test_bridge_config_drift, test_automations_probe - 82 passed.
- 7bbc44db backend: test_ha2610_compat (scan part), test_automations_access - 17 passed.
- 395b54db tsc ok; evidence-ha2610-compat.spec.ts 6 passed (first version, scheme variants).
- a70f2f8a spec: evidence-ha2610-compat + evidence-automations-list + unit-automations - 114 passed.
- Final full re-run at the branch head: see "Final verification" below.

## Not done / open

- Row 10 rest: new registry items `ha-auth-provider`, `ha-config-validation`, `ha-int-mqtt`; the ha-core 2026.10.0 checkpoint (after the lab
  check); the `wiskey-hikvision-intercom` feed 404.
- Bridge: it still answers `unauthorized` for both "no control of the entity" and "a step needs an administrator". A later bridge
  version could answer a distinct code for an Unauthorized raised during the call (needs a bridge version bump; not done here).
- The scan reads the mirror only: an item whose configuration Arx cannot read (YAML without id, integration scenes) is not scanned.
- Templated service names (`action: "{{ ... }}"`) are not judged.

## Coordination note for the WisKey team (gate environment) - plan row 9

To: WisKey team, via the shared handoff folder. From: Arx.
Home Assistant 2026.10 is out. Arx 2.4.x runs on it without code changes; the next Arx release adds a read-only compatibility check.
Our gate environment for the joint gate (`gate-env/3`) is pinned to HA 2026.9.4. Proposal: in the next joint round, add a 2026.10.x
recipe next to 2026.9.4 and run the gate once on both. Things in 2026.10 that may touch `hikvision_intercom`: usernames are normalised
(trimmed, lower-case) by the `homeassistant` auth provider; `mqtt.publish` / `mqtt.dump` need an administrator on a manual run; a
state condition with `for` refuses a state list, an attribute or an input-helper state. Please confirm whether your integration or its
blueprints use any of these, and whether you want the switch now or when you ask for it (owner question 5 in the compat doc). We do
not change the gate environment until you agree.

## Next step

Final verification at the branch head (backend: the touched suites; spec: evidence-ha2610-compat + unit-automations; tsc), then the
closing report. Expected conflicts on merge: `frontend/src/api/automations.ts` (error-code union, adapter), `contracts/API_INVENTORY.md`
(regenerate), `management/upstream_watch.json` (the main checkout has uncommitted edits), `docs/user-guide/he/GUIDE_ALL_HE.html` (rebuild).
