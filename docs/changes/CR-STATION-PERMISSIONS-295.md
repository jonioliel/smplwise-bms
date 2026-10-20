# CR-STATION-PERMISSIONS-295 - per-station access for a person, as a first-class Arx permission (WisKey)

**CR number:** provisional; the lead assigns the next free CR number at integration.
**Status:** BUILT behind a switch that is OFF and cannot be turned on in this build (branch `pilot/STATIONPERM-295` from
`origin/main` @ 61ddf6a91). Owner decision 2026-10-20 night, round 4 item 7 ("Station permissions: build"); backlog id
`wiskey-station-permissions` (origin: archived WisKey task W5, "a permission type per access-control station in Arx").
**Migration:** `0142_access_station_permissions.sql` - **PROVISIONAL number** (the lead renumbers at integration; last on main = 0127,
0140 is taken provisionally by GRANTS3-295).
**Nothing here is an approval to switch anything on.** `GO_LIVE_PERMITTED` stays False, the eight WisKey switches stay OFF, no real
WisKey, station, door or reader was contacted; every test uses fakes (`tests/fake_wiskey.FakeAccessEngine`).

Companions: `CR-ARX-WISKEY-SHARED-IDENTITY.md` (links, external grants, engine port), its build notes (STATIONSYNC round 11),
`CR-033-WISKEY-DOOR-PATH.md` (station scope `access_control_station`, station chain), `CR-036-WISKEY-NATIVE-SCREENS.md` (S3 projection,
S11 people writes), `docs/security/HA_IDENTITY_RBAC_HE.md`.

## 1. The gap

| Today (main 61ddf6a91) | Gap |
|---|---|
| A WisKey person reaches a station through WisKey **groups** (`group_ids`, not writable from Arx) or a **personal override** (`permission_overrides[station] = allow / deny`) with the relays in `door_permissions`. | The personal override is only a field inside WisKey's record. Arx has no record of who decided that a person may (or may not) use a station, when, and why. |
| The S11 person editor writes the whole override map, gated by `access.people.manage` on **every** station of the person. | A manager responsible for one entrance cannot grant or block that one entrance for a person who also uses stations outside his reach; and nothing distinguishes "allowed through a group" from "allowed personally". |
| External grants (`access_grants`) carry a door map, but only for time-bounded external people. | Staff and regular people have no per-station, auditable decision in Arx. |

## 2. Model (D1)

One Arx row per (WisKey person, station): **the person's personal decision for that station**.

| Column | Meaning |
|---|---|
| `wiskey_person_id`, `station_id` | ids only (WisKey's opaque person id, the station's config entry id); unique together |
| `effect` | `allow` (personal access, relays listed) / `deny` (blocked, beats any group) / `inherit` (no personal entry: the station follows the person's groups). NULL only while the first request waits |
| `relays_json` | the relays of an `allow` (`[1]`, `[1,2]`); `[]` otherwise |
| `decided_by`, `decided_at`, `approval_revision` | who decided the current effect, when, and the permission revision at that moment |
| `request_effect`, `request_relays_json`, `requested_by`, `requested_at` | a WIDENING asked by a request-only manager, waiting for a holder of the permission |
| `sync_state` | `none` (nothing decided yet), `pending` (decided in Arx, not in WisKey yet), `applied` (a fresh read proved it), `unverified` (written, the read did not prove it), `failed` (WisKey refused) |
| `wiskey_revision`, `proof_at`, `last_error`, `attempts` | the WisKey person revision after Arx's write, when the read-back proved it, the closed error code of the last push |
| `revision` | compare-and-set for concurrent Arx edits (the client sends the revision it loaded, 0 for a new row) |

No name, no phone, no PIN, no card, no schedule in the row. History lives in the audit log (section 7).

**Groups.** Arx never writes `group_ids`. The view shows per station where access comes from: `group` (enabled with no personal
entry), `personal` (allow), `blocked` (deny), or none. A block always wins over a group; "follow groups" removes the personal entry.

**Schedules / timing policy (mode, schedule and bindings stay together).** This feature NEVER writes `access_timing_policy`. The policy is
read whole (`EnginePerson.timing_policy`) and judged whole:
- `ha` mode or no policy: nothing to check.
- `native` mode: an `allow` of a station is refused (`station_permission_timing_binding`) unless the policy already binds that station
  to its device slots - Arx cannot invent slots, and writing a binding alone would split the policy. A `deny` / `inherit` never touches
  the policy (a binding for a blocked station grants nothing; keeping it lets the station be re-allowed without losing its slots).
- a malformed policy or one with unknown keys: an `allow` is refused (`station_permission_timing_unreadable`); a block still goes through.

**Bindings (Arx RBAC).** Who may decide is an ordinary Arx role binding at station scope (`access_control_station`), site, building or
installation - the CR-033 chain with deny-overrides. Nothing new in the bindings table.

**External grants.** A WisKey person whose Arx link has a live external grant (`access_grants` state in LIVE) is owned by the grant (its
scope proof covers the whole door map): every station decision for that person is refused (`station_permission_grant_live`, 409).

## 3. RBAC (D2)

New permission **`access.people.stations`** - "access control: allow or block a person's access per station". Sensitive, station-scoped
(added to `rbac.STATION_PERMISSIONS`), never implied. Built-in holders: `system_admin` and `site_admin` (owner decision 2026-10-21). The
assignment stays editable like every other sensitive permission: an administrator grants or removes it per role and per station
(custom roles, station-scope bindings, deny bindings).

| Action | Required (each judged on the ONE station being changed) |
|---|---|
| See the person's station decisions | the person is visible (`access.people.read` on one of the person's stations, or unrestricted); rows on stations without `access.people.read` are omitted |
| Widen: `allow`, more relays, `inherit` from `deny` | `access.people.stations` on the station, interactive session |
| Request a widening (request-only manager, the ACCESSREQ decision (b) pattern) | `access.people.manage` on the station without `access.people.stations` -> stored as a request |
| Approve / refuse a request | `access.people.stations` on the station; the requester may not approve his own request unless he is a system administrator (ACCESSREQ decision (a)) |
| Narrow: `deny`, fewer relays, `inherit` from `allow` | `access.people.stations` OR `access.people.manage` on the station (revoking must be easy) - applied at once |
| Retry the push / read back | the same as a narrowing |

- **Not every station of the person:** unlike the S11 editor, a decision needs the permission on the changed station only. The write
  replaces the complete `permission_overrides` map built from a FRESH read at its revision (compare-and-set), so every other station's
  entry is carried over byte for byte; a restricted or malformed read refuses the write (`projection_restricted`).
- **No self-service:** a decision on the WisKey person linked to the caller's own Arx user (`access_person_links` subject `user`) is
  refused (`station_permission_self`) unless the caller is a system administrator.
- **Local (Arx-only) identities** decide only when `access.external.local_approvers` is on (the external-grant rule reused).
- Bearer-token clients are refused for widenings (interactive human only, the PG rule).

## 4. What is written to WisKey (FAKES ONLY in this build)

One `users/update` per decision, on the service channel, through the engine port (`Engine.set_station_access`):

```json
{"permission_overrides": { ...the complete map from the fresh read, with this station set or removed... },
 "door_permissions": {"<station>": [relays]}}   // only for an allow; {} otherwise
```

Never `group_ids`, never `access_timing_policy`, never validity, active, PIN or cards. The live implementation
(`WiskeyServiceEngine.set_station_access`) refuses with `not_permitted` while `access_grants.GO_LIVE_PERMITTED` is False - so in this
build no decision reaches a real WisKey whatever the settings say. Its WisKey shape is SOURCE-DERIVED (reply 2, 2026-10-18), NOT_RUN.

## 5. Revocation semantics

- **Block (`deny`) is the revocation.** It applies at once (a narrowing needs no approval), beats any group, and is `applied` only when a
  fresh read shows the station out of the enabled assignments AND the override `deny` AND the central sync status reports no pending
  revocation (`Engine.revocation_pending`; on main it takes the person id, the STATIONSYNC branch adds the revision - the call adapts to
  either signature). Anything less stays `unverified` and the screen says so.
- **Follow groups (`inherit`)** removes the personal entry. It is a narrowing from `allow` and a widening from `deny`.
- **Outcome unknown** (WisKey may have saved): `unverified`, never retried blindly; "check again" reads first.
- **WisKey unreachable / not permitted:** `pending`, nothing sent; "send again" retries.
- **Person not found in WisKey:** NOT proof of absence (a scoped answer looks the same): `unverified`, rows kept.
- **Switch turned off:** the routes answer 404 and nothing is written to WisKey; WisKey keeps what it has. Before turning the feature off,
  block what must not stay open.
- **Permission lost by the decider:** the decision stands (staff access is not tied to the manager's tenure; the external-grant R7
  re-decision does not apply). Open owner question 1.
- **A request** that is refused or superseded leaves the current effect untouched.

## 6. Switch

`access.station_permissions` (`off` default). `PUT /access-station-permissions/settings` refuses `on` with
`409 station_permissions_not_permitted` while `GO_LIVE_PERMITTED` is False (system administrator only, audited). The key is security policy:
an archive restore never changes it (backup preserved keys).

## 7. Audit (ids only)

`access.station_permission.allow | block | inherit | request | approve | refuse | push | readback` with `resource_type =
access_control_station`, `resource_id = station id`, details `{person: <wiskey id>, effect, state, code}`. Refusals are audited with
their reason (`denied`). Never a relay map (D06 rule), a name, a phone, a PIN or a card.

## 8. API (`/api/v1`)

| Route | |
|---|---|
| `GET  /access-station-permissions/settings` / `PUT` | system administrator |
| `GET  /access-station-permissions/people/{person_id}` | the person's stations: source, personal decision, sync state, the caller's rights per station |
| `PUT  /access-station-permissions/people/{person_id}/stations/{station_id}` | `{effect, relays, revision}` - decide (or request) |
| `POST .../stations/{station_id}/approve` / `refuse` | `{revision}` |
| `POST .../stations/{station_id}/sync` | `{revision}` - send again / read back |

## 9. UI

The person's page, tab "גישה" (wiskey-person-drawer): under the station list, a compact "Station permissions" block (only when the
switch is on and the caller may see it): one row per station - name, source chip (group / personal / blocked), sync chip, and the
actions the server allows (Allow / Block / Follow groups; Approve / Refuse for a request), with a one-line confirmation for a block.
Words in he / en / ar / ru (`i18n/station-permissions.ts`; ar / ru dev-marked for native review). The product name is "WisKey"; no
platform branding. No hint paragraphs.

## 10. Owner decisions and UNPROVEN WisKey behaviour

Decided (owner, 2026-10-21):
1. A station decision STANDS when the person who made it later loses `access.people.stations` (no re-decision; built so).
2. A manager with `access.people.manage` on a station (without `access.people.stations`) may REQUEST a widening; a holder decides
   (built so).
3. Default holders of `access.people.stations`: `system_admin` AND `site_admin`; editable per role / per station by an administrator.

UNPROVEN (needs a real station; NOT tested, only fakes were used - the fake models the answers below as assumptions):
4a. When Arx removes a person's personal `allow` entry for a station and none of the person's groups grants that station, does WisKey
    (and the station device) then deny the person at that station - or does the station keep its previous assignment?
4b. For a person whose `access_timing_policy` is in `native` mode, when Arx writes `deny` for a station that still has a binding in the
    policy's `bindings`, does WisKey accept the update and keep that binding unchanged (without rejecting the write or dropping the
    binding)?

## 11. Rollback

Additive: one table, one permission, one switch (off). Older code ignores the table. Removing the permission from roles needs no
migration (custom roles keep an unknown permission harmlessly). WisKey keeps whatever was written (nothing in this build).
