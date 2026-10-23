# CR-FLEET215: fleet monitoring agent, readiness score and demo mode (target 2.15.0)

Status: slice 1 built on `pilot/FLEET215-295` (from `origin/main`), owner-approved bundle. Migration number `0154` (built as provisional `0149`, renumbered at the 2.15.0 integration, release/2150)
(`0149_fleet_report_log.sql`; the lead renumbers at integration, nothing else depends on the number). Fakes only: no receiver is deployed,
no installation sends anything, the report is OFF by default.

## 1. What this adds

1. A daily, signed health report from an enrolled installation to a small SmplWise receiver (a Cloudflare Worker skeleton in
   `services/fleet-receiver/`): versions, subsystem states from a closed set, counters. Nothing else.
2. A readiness score ("the installation is 78% ready") with a closed list of what is missing (Settings card and the report's `readiness`).
3. Demo mode: a constant, clearly labelled example dataset for installing and selling, never mixed with real data.

## 2. Two keys must both be on

The report leaves only when BOTH are set: the add-on option `fleet_report_url` (installer, becomes `SW_FLEET_REPORT_URL`) AND the Arx
setting `fleet.report_enabled` (customer consent, system administrator only). Either off: nothing is built, signed, numbered, stored or sent.
Outbound HTTPS only (like the push relay): no listener, no inbound route, no redirects followed, 10 s timeout, body capped at 8 KiB.

## 3. The closed schema (field-by-field justification)

The report is validated against `SCHEMA_KEYS` before signing and fails closed on any deviation: unknown key, missing key, wrong type,
string outside its pattern or enum. Free text cannot pass: the only strings are the schema constant, a random id, a minute-resolution
timestamp, version strings (`[0-9A-Za-z._+-]{1,40}`) and enum members. Each field and why it exists:

| Field | Why |
|---|---|
| `schema` | constant `smplwise-fleet-report/1`; the receiver refuses other versions |
| `installation_id` | random 32-hex id, not derived from the box, the customer or the bundle id; the receiver's join key |
| `seq` | monotonic sequence number (replay protection; kept outside the database so a restore cannot rewind it) |
| `generated_at` | UTC minute, tells "silent" from "alive" |
| `mode` | `full` or `ha_only`; explains why NVR components are absent |
| `demo_mode` | boolean only, so a demo box is not mistaken for a customer |
| `overall` | ok / warn / error roll-up for the traffic light |
| `uptime_h` | hours since start; detects restart loops |
| `versions` | which releases run in the field |
| `versions.addon` | add-on version, finds old installations |
| `versions.bridge` | installed bridge version |
| `versions.bridge_required` | the bridge version this add-on needs; mismatch means pairing work |
| `versions.ha` | host platform version (version string only) |
| `versions.go2rtc` | media server version |
| `versions.db_schema` | applied migration number |
| `components` | state of each subsystem, enum values only |
| `components.db` | database state |
| `components.storage` | data folder / disk state |
| `components.nvr` | recorder connection state |
| `components.go2rtc` | media server state |
| `components.ha_sync` | home system sync state |
| `components.bridge` | bridge connection state |
| `components.events_ingest` | event intake state |
| `components.events_derive` | derived event state |
| `components.discovery` | discovery job state |
| `components.thumbnails` | thumbnail job state |
| `components.exports` | export job state |
| `components.backups` | backup job state |
| `components.frigate` | optional Frigate connection state |
| `counts` | sizes, counters only |
| `counts.cameras` | camera count, sizing and support |
| `counts.recorders` | recorder count |
| `counts.recorders_by_vendor` | recorder count per vendor |
| `counts.recorders_by_vendor.hikvision` | Hikvision recorders |
| `counts.recorders_by_vendor.provision_isr` | Provision-ISR recorders |
| `counts.recorders_by_vendor.frigate` | Frigate servers |
| `counts.recorders_by_vendor.none` | cameras without a recorder |
| `counts.ha_entities` | catalogued home entities |
| `counts.floors_published` | published floor plans (readiness context) |
| `counts.users_active` | active people (count only; open owner question 1) |
| `counts.system_admins` | system administrators (count only; zero is a support case) |
| `alerts_open` | open alerts by severity, counters only |
| `alerts_open.info` | informational |
| `alerts_open.alert` | alerts |
| `alerts_open.critical` | critical |
| `disk` | data disk |
| `disk.free_pct` | free percent, null when unknown |
| `disk.free_gb` | free whole GB |
| `disk.total_gb` | total whole GB |
| `backup` | backup health |
| `backup.count` | backups kept |
| `backup.last_age_h` | age of the newest backup in hours |
| `backup.offbox_targets` | configured off-box targets (a number, never a target) |
| `update` | update availability |
| `update.check` | outcome of the last update check, enum |
| `update.available` | an update is available |
| `update.latest` | latest version string seen |
| `readiness` | the readiness block |
| `readiness.score` | 0-100 |
| `readiness.ready` | all required items met |
| `readiness.missing` | ids of unmet applicable items, from a fixed list |

## 4. What is never sent

No name (customer, person, site, floor, camera, device), no address, no host, no IP, no MAC, no serial, no token, no URL, no email, no
phone, no event, no image, no log line, no error text, no entity id, no setting value. Tests scan the built payload for forbidden keys and
planted sentinel values in a populated database, and prove that an extra field aborts the send before signing. The customer label lives only
at the receiver, typed by SmplWise at enrollment, and is never sent by the installation.

## 5. Threat model

| Threat | Mitigation |
|---|---|
| a code change leaks a field | closed schema, exact key set, fail closed; a test requires every schema path to be justified in this record |
| forged reports | Ed25519 signature; the receiver trusts only keys enrolled explicitly |
| replay | strictly increasing `seq` per installation; state kept outside the database |
| cross-protocol signing | signed bytes are `CONTEXT + body` (domain separation) |
| key linkage to evidence bundles | separate key and separate random id; the evidence key and the bundle id are not reused |
| clone by restore | key, id and sequence live in `<data>/keys/fleet/`, never in the database or a backup |
| receiver compromise | holds counters and public keys only, no secret of any installation |
| SSRF via the URL | the URL is an add-on option set by the installer, no redirects; the database never stores it |
| unwanted telemetry | OFF by default, two keys, administrator-only switch, audited, exact bodies shown in `GET /fleet/report/log` |

## 6. Signing and keys

`services/fleet_keys.py`: Ed25519 key, random installation id and sequence number under `<data>/keys/fleet/`, private half mode 0600, never
exported, returned or backed up. Key id is `signing.kid_of` (first 16 hex of SHA-256 of the public key). The enrollment code is
`arx-fleet-1.<id>.<kid>.<public key>` (public data only).

## 7. Receiver design and data model

Cloudflare Worker with KV, `services/fleet-receiver/`: `inst:<id>` enrollment (label typed by SmplWise, public keys, retired keys),
`last:<id>` last accepted report, `hist:<id>:<date>` one report per day with 400-day expiry. Routes: `POST /v1/report`, `GET /v1/health`,
admin routes behind `ADMIN_TOKEN`. Status per installation: green, amber, red or silent. A different key for an enrolled id is refused
unless the admin request says `replace_key`. Skeleton, unit-tested with fakes, not deployed.

## 8. Readiness rules

Fourteen weighted items (six required, weight 3) computed only from state the add-on already keeps (setup wizard step state, backup folder,
counts, disk); no probe, no write, no network. `score = round(100 * met weight / applicable weight)`; `ready` = all applicable required
items met. Items that do not apply (no recorder in `ha_only`, service departments while the module is off) count neither way and are
never listed as missing. Output has ids, he/en labels and a settings link only.

## 9. Demo mode

`demo.enabled` is OFF by default, system administrator only, audited. The dataset is a constant in `services/demo_mode.py`: never written to
a real table, never read by a real query, never counted by health, readiness or the report (which carries only `demo_mode`), never in a
backup. Every object has `example: true` and the envelope has a label (he "נתוני דוגמה" / en "Example data"). Turning it off is the whole
cleanup. Names are invented and say they are examples; no real person, place, host or camera image. Slice 1 serves it at
`GET /demo/dataset`; other screens opt in later.

## 10. Backend surface

`GET/PUT /fleet/report`, `GET /fleet/report/enrollment`, `/preview`, `/log`, `POST /fleet/report/send`; `GET /readiness`,
`GET/PUT /demo`, `GET /demo/dataset`. All need `system.configure` plus system administrator and are audited. Worker
`fleet_report.worker_loop` (first send after 5 min, then daily, retry after 3 h; `SW_FLEET_WORKER=0` disables). Table `fleet_report_log`
(last 30 attempts, exact body), never in a project backup.

## 11. Not built in slice 1

Settings UI, receiver deployment, key rotation message, a rendered overview page, feeding screens from the demo dataset, alerting on silence.

## 12. Open owner questions (recommendation first)

1. Include `counts.users_active` and `counts.system_admins` (counts only)? Recommend yes.
2. Receiver as a separate Worker (recommended) or a route in the push relay?
3. Key rotation: manual re-enroll in slice 1, or a rotation message signed by the old key in slice 2? Recommend slice 2.
4. Admin overview behind Cloudflare Access in addition to `ADMIN_TOKEN`? Recommend yes.
5. Data-processing terms with customers before the first enrollment: who signs?

## Owner review 24.10 decisions

Source: the owner's review of the mockups, 2026-10-24 (`private/planning/OWNER_MOCKUP_REVIEW_2026-10-24_raw.txt`, item 7). Question numbers below are those of the review form; where they differ from this document's own question list the matching section is named. Recorded as the owner's decisions; the build follows them.

Mockup v2 approved with these answers:

- **Silent threshold (form Q4; the mockup used 36 hours):** **not needed if not set**: there is no default number of hours after which an installation counts as "not reporting"; the rule applies only when the owner sets a value.
- **Install row (form Q6: what is missing in an installation's row):** add the **contact person** (the contact and the installed version).
- **Double readiness (form Q7):** **yes, one screen**: "installation readiness" appears on one screen only, shared with the readiness check (CR-READY96), not duplicated here and there.

**Integration note (READYFLEET-295):** parts 2 and 3 of this record (the readiness score and demo mode) are superseded by CR-READY96:
the fleet report's readiness block is a projection of CR-READY96's `readiness.evaluate()`, and demo mode is CR-READY96's separate demo
database. See `docs/changes/READYFLEET-295.md`.
