# SmplWise fleet receiver (CR-FLEET215)

A small Cloudflare Worker that receives the daily, signed health report of each **enrolled** SmplWise Arx installation and gives
SmplWise one overview of the fleet: green / amber / red / silent, old version, readiness score. Design, field-by-field schema
justification, threat model and privacy review: `docs/changes/CR-FLEET215.md`.

Status: **skeleton, written and unit-tested only** (`npm test`: vitest with an in-memory KV and throwaway Ed25519 keys, plus one
fixture signed by the add-on's Python signer). **Not deployed.** Deploying it needs the owner's decisions in the change record
(section 12): where it runs, who may read the overview, and the data-processing terms with the customers.

## What it stores

| Key | Value | Lifetime |
|---|---|---|
| `inst:<installation id>` | enrollment: the customer label (typed by SmplWise, never sent by the installation), the public key(s) with key id, added / retired | until deleted |
| `last:<installation id>` | the last accepted report, its sequence number and receive time | until deleted |
| `hist:<installation id>:<YYYY-MM-DD>` | one report per day | 400 days (KV expiry) |

A report holds versions, subsystem states from a closed set and counters only (the closed schema is `src/schema.json`, generated from
the add-on's code). No secret of any installation is stored here: authentication is the Ed25519 signature of a key that SmplWise
enrolled explicitly.

## How an installation is enrolled

1. On the installation (Arx › Settings, a system administrator): switch the health report on; copy the one-line enrollment code
   (`arx-fleet-1.<id>.<kid>.<public key>` - public data only). The installer sets the add-on option `fleet_report_url` to this
   Worker's URL.
2. Here: `POST /v1/admin/installations` with `{"code": "<the code>", "label": "<customer name>"}` and `Authorization: Bearer <ADMIN_TOKEN>`.
3. A different key for an enrolled id (the installation was reinstalled or rotated its key) is refused unless the request says
   `"replace_key": true`; the old key is then retired and reports signed with it are refused.

## Routes

| Route | Who | What |
|---|---|---|
| `POST /v1/report` | an enrolled installation | verify + store (202), or a closed error code |
| `GET /v1/health` | anyone | `{ok: true}` |
| `GET /v1/admin/installations` | ADMIN_TOKEN | the overview with totals |
| `POST /v1/admin/installations` | ADMIN_TOKEN | enroll / relabel / replace a key |
| `GET /v1/admin/installations/<id>` | ADMIN_TOKEN | enrollment + last report |
| `DELETE /v1/admin/installations/<id>` | ADMIN_TOKEN | forget an installation |

## Checks

`npm ci && npm run typecheck && npm test`. After a schema change in `smplwise_vms/backend/smplwise/services/fleet_report.py`, run
`tools/gen_fixtures.py` with the backend's Python to regenerate `src/schema.json` and `test/fixtures/signed_report.json`; the backend
test `tests/test_fleet_receiver_fixtures_215.py` fails while they are out of date.
