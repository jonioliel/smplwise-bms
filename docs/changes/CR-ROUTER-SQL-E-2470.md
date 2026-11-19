# CR-ROUTER-SQL-E-2470 - SQL out of the routers, batch E (9-12 statements): nothing left to move

Branch `pilot/CR-ROUTER-SQL-E-2470`, base `origin/pilot/CR-ROUTER-SQL-C-2450` at `d228cb84c`, then
`origin/pilot/CR-ROUTER-SQL-B-2450` at `205434ecc` merged in (commit `3ba4843c4`). Review finding **05:P2-07**. Target 2.47.0.
No code change of its own: no version bump, no migration, no route change, no frontend change, no pixel change.

## Range and result

Briefed range: every open router with 9-12 SQL statements, excluding `ha.py`, `energy_billing`, `energy_meters`, `water`,
`water_billing`, `wiskey*` / `intercom*`, and every router present on `origin/pilot/CR-ROUTER-SQL-D-2460`.

Inventory at the merged base (C + B), `grep -cE '\.execute(many|script)?\('` over `smplwise/routers/` (sub-packages included):

| Router | Statements | Status |
|---|---|---|
| `ha.py` | 24 | excluded (own row) |
| `energy_billing.py` | 20 | excluded |
| `water.py` | 16 | excluded |
| `water_billing.py` | 13 | excluded |
| `search.py` | 9 | moved by batch D (`e4689f2b0` on `origin/pilot/CR-ROUTER-SQL-D-2460`) |
| `remote.py` | 9 | moved by batch D (`96c86e08f`) |
| `multimedia.py` | 9 | moved by batch D (`e501d460b`) |
| `energy_meters.py` | 3 | excluded |
| `wiskey_installer_common.py` | 2 | excluded |
| `wiskey_relay_map.py` | 1 | excluded |

Every other router holds 0 statements at the merged base (the first step, B and C moved them). The only three routers in the
9-12 band are on batch D (fetched at `eafbc5c5d` before deciding), so **batch E moves no router**. The 10-statement routers of
the original inventory (`access_custom_roles`, `calendar`, `notifications`, `recorders`, `views`) and the 12-statement ones
(`doors`, `notices`, `rules`, `tickets_costs`) were moved by batch B.

Programme state after C + B + D are combined: every router outside the excluded list holds 0 `.execute(` calls; open are only
`ha.py` (own row) and the excluded energy / water / WisKey routers.

Note for whoever combines the branches: `origin/pilot/CR-ROUTER-SQL-D-2460` is based on B, not on C. B and C share no file;
D's three routers are untouched by C.

## Checks actually run (on this branch, the C + B merge)

- `ruff check smplwise` (rule set F, blocking lane): **All checks passed**.
- `scripts/gate/lint_backend.py --root .`: **0 findings**.
- Import of every module under `smplwise.routers` and `smplwise.services` (workstation venv): **996 modules, 0 failures**.

NOT_RUN: backend pytest (no code of this row; the C and B suites are recorded in their own change notes), frontend, runner,
pixels.
