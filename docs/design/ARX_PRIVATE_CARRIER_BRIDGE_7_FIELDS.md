# Arx private carrier bridge (B8), revised to seven private fields

Status: **PROPOSED ONLY, DESIGN ONLY, 2026-10-18; owner clarifications 22.1 and 22.2 approved 2026-10-20 (see "Owner decisions" below).** Item `ARX-B8R`. This document is not an implementation permit, not a
transport permit, not adoption of B8, and consumes none of P1-P7. Nothing is built, installed, switched on or run. No
code, runner, lab host, Home Assistant, NVR, go2rtc or WisKey tree was touched. Arx RBAC is the only authority; WisKey is
the engine. Until the owner approves AND it is built, `users/create` and `users/update` stay on the existing W2 path.

Supersedes (as a proposal) the five-field design `ARX_PRIVATE_CARRIER_BRIDGE_DESIGN.md`, sha256
`5aa4fbbca5633391ef0304bd271269b3d5024a817e0713b18a1c150f62d05d70`, branch `pilot/B8-CARRIER-DESIGN` @ `4e07891f`.
The transport (T3 pull, encrypted constant-length answer), the sequence, the failure model, the crypto and the test
plan of that document are **kept unchanged** except where section 3 below lists a change. This revision is written to be
readable on its own: every value that matters is stated here. Examples are synthetic.

Inputs read: the five-field design (above; sha256 verified identical on `integ/271` and in the proposal folder);
Arx reply to WR120R (`ARX_REPLY_TO_WISKEY_WR120R_REVIEW_2026-10-18_HE.md`, sha256 `62d7113b...a172`, sections WR120R-04,
WR120R-06, 3.1, 3.2); Arx code on `integ/271`, read-only (`routers/access_control.py` `PersonData`,
`services/intercom_writes.py`, `services/intercom_authority.py`, `rbac.py`, `services/access_grants.py`).
`W_M7_PRIVATE_BOUNDS.json` from WisKey has **not** been received.

## Owner decisions (2026-10-20, evening round 3) - recorded here

- **22.1 = a (open question 3):** persons that Arx itself generates for external access grants (`services/access_grants.py`) keep
  sending `responsible_person` and `access_purpose` on the existing W2 path after go-live. This is an approved, **documented
  exception**, not a hidden fallback. The carrier route rule 3 (non-human principals stay on W2) is the mechanism.
- **22.2 = a (open question 7 / P3 reading):** the AEAD tag and the constant-length padded ciphertext are not a "hash or length of a
  sensitive value". Section 5 rule 4 is therefore confirmed as written.
- **Not changed by these answers:** this document is still design only. The Arx-side build waits for WisKey's closed bounds for the seven
  keys (W-M7, `W_M7_PRIVATE_BOUNDS.json`, not received). P1 (implementation permit) stays OFF; `CARRIER_GO_LIVE_PERMITTED = False`.
  Open questions 1, 2, 4, 5, 6 and 8 keep their delegated recommended answers (a) until W-M7 arrives.

---

## 1. What this revision changes in one paragraph

WisKey's option A moves `responsible_person` and `access_purpose` from the public side to the private side. The private
group therefore has **seven** keys: `employee_no`, `phone`, `pin`, `cards`, `photo`, `responsible_person`,
`access_purpose`. The public side shrinks accordingly. Arx also states explicitly that it never sends `profile` through
the carrier. The carrier transport itself does not change.

## 2. The seven private fields (limits are PROPOSED Arx mirrors until W-M7 arrives)

All seven are optional individually; the group as a whole must be non-empty for a carrier request. Absence means
"unchanged" (update) or "not set" (create). Explicit `null` means "clear" only where the type allows null. The limits
below are the bounds Arx's own validators enforce today and are offered as a comparison baseline. **When WisKey's
`W_M7_PRIVATE_BOUNDS.json` arrives, WisKey's bounds replace these; any difference is an Arx change, not a WisKey one.**

| # | Key | Type | Limits (Arx mirror) | Clear with null | Arx source of the mirror |
|---|---|---|---|---|---|
| 1 | `employee_no` | string | `^[A-Za-z0-9_-]{1,32}$` | no (not nullable) | `PersonData` |
| 2 | `phone` | string or null | max 32 chars, `^\+?[0-9 ()-]+$`, 7..15 digits | yes | `PersonData` |
| 3 | `pin` | string or null | `^[0-9]{1,128}$` | yes | `PersonData` |
| 4 | `cards` | array of card | max 255 items; each card is a closed object: exactly one of `id` (uuid) or `card_no` (`^[A-Za-z0-9_-]{1,32}$`), plus `label` (max 64, no control chars), `card_type` (const `normalCard`), `enabled` (boolean); ids and numbers unique in the array | n/a (empty array = no cards) | `CardData` |
| 5 | `photo` | string or null | `data:image/jpeg;base64,...`, max 44000 chars encoded; decoded JPEG at most 32768 bytes and 1..512 x 1..512 pixels | yes | `photo_value` |
| 6 | `responsible_person` **(new in private)** | string or null | max 64 characters, no control characters (U+0000..U+001F) | yes | `PersonData.responsible_person`, `_no_control` |
| 7 | `access_purpose` **(new in private)** | string or null | max 128 characters, no control characters | yes | `PersonData.access_purpose`, `_no_control` |

Notes on the two new fields:
- Length unit for 6 and 7 is characters as Arx counts them (Python `str` length, i.e. Unicode code points), not bytes. W-M7
  must state WisKey's unit. If WisKey counts bytes or UTF-16 units, Arx adopts WisKey's unit (open question 4).
- Normalisation: Arx's validator does not trim or case-fold these two. Whether WisKey trims is unknown (W-M7).
- Both are free text entered by an operator and typically contain personal names and business reasons, which is why they
  belong on the private side: they never ride in a signed message, a service call, a log, an audit row or a count.
- Arx already classifies both as sensitive-level data (`SENSITIVE_FIELDS`, `PERSON_SENSITIVE_KEYS`, editor sensitive
  keys). The private group is now exactly the W2 "sensitive write set", with `employee_no` conditional (section 6).

Explicitly **not** private and **not** sent by the carrier: `profile` (public in WisKey rev2; Arx classifies it as
read-sensitive but its editor never writes it; the revised design states that Arx sends no `profile` in a carrier
request, per WR120R-04). `access_category`, `permission_overrides`, `door_permissions`, `access_policy_revision`,
`access_timing_draft`, `access_timing_policy` remain public parameters (B6) and follow WisKey's local rev2/rev3 shape as
a proposal (W-M4).

## 3. Diff against the five-field design (section references are to that document)

| Area | Five-field version | Revised (seven fields) |
|---|---|---|
| Constraint C12 | private keys within `{employee_no, phone, pin, cards, photo}` | within `{employee_no, phone, pin, cards, photo, responsible_person, access_purpose}` |
| Payload 10.3 `private` object | 5 properties | 7 properties (schema in section 4 below) |
| Public parameters in 10.3 | mirror of the 5 public data fields (display_name, active, valid_from, valid_until, group_ids) | mirror of WisKey's local rev2/rev3 public set as PROPOSED, without `profile` and without `responsible_person` / `access_purpose` (reference to W-M4 replaces the "until W-M4" wording) |
| Interface 6.6 `CarrierPayload.private_parameters` | non-empty subset of 5 keys | non-empty subset of 7 keys |
| Route selection 6.2 item 2 (photo route stays on W2 until W-M5) | W2 | unchanged: stays W2 until WisKey's private-only update is agreed as a separate adoption |
| Route selection 6.2 item 4 (at least one private key) | any of 5 keys | any of 7 keys. A draft that sets only `responsible_person` or `access_purpose` is carrier-eligible only if it also has a public key (item 6) |
| Route selection 6.2 item 5 (a draft with `responsible_person` or `access_purpose` goes W2) | those two keys force W2 | those two keys no longer force W2; they are private. `permission_overrides`, `door_permissions`, `access_policy_revision`, `access_category`, `access_timing_*` still follow WisKey's rev2 public schema; `access_timing_policy` is limited to null in rev2, so a draft that sets it to a non-null value stays on W2 |
| Route selection 6.2 item 6 (update needs a public key) | until W-M5 | unchanged; lifted only if WisKey's private-only update is adopted separately |
| Payload size | 65536 padded bytes | unchanged. Two more optional strings add at most 64x4 + 128x4 = 768 UTF-8 bytes to the worst-case plaintext; the oversize rule (local `not_sent` 422) still decides |
| Padding / ciphertext length | 65536 / 65552 bytes / 87403 chars | unchanged. No new length leak: padding already hides the number of keys |
| Leak scan N19 and length test N20 | sentinels for 5 keys | sentinels for 7 keys, including non-ASCII text for 6 and 7 |
| Validator rules | disjointness private vs `data` for 5 keys | disjointness for 7 keys; `data` must contain none of the seven |
| W-M6 | open WisKey decision (two receivers or relaxed rules) | recorded as **decided by WisKey, static**: one shared private-capable receiver, choice (b), CODE `c0b2d94c`, `source_mutations.py` L172-190; evidence NOT_RUN in runs 054 and 322; conditions 1-5 in the Arx reply section 3.1 |
| W-M7 | open: WisKey's closed bounds for 5 keys | open WisKey input for 7 keys, `W_M7_PRIVATE_BOUNDS.json`, with a locator per bound and `NONE` where WisKey has none |
| W-M8 (A or B for the two fields) | open | closed: option A chosen by WisKey |
| K2 contradiction (Arx sensitive vs WisKey private set) | recorded | closed by option A |
| Self-containment | refers to Arx code files for bounds | this document states every limit; no Arx code is needed to read it |
| Everything else (T3 transport, crypto 6.5, slots 6.3, fetch 6.4, TTLs, single use, failure table, messages 10.1 and 10.2, permits P1-P7, rollout R0-R4) | as written | **unchanged**; see the five-field document by hash for the unchanged text |

## 4. Payload `private` definition (replaces the `private` `$def` of 10.3)

Draft 2020-12; the rest of the 10.3 envelope (protocol, request_id, parameter_reference, action, public_parameters,
private_parameters) is unchanged. `additionalProperties: false`, `minProperties: 1`. The `card` `$def` is unchanged.

```json
{
  "$id": "urn:smplwise:arx:private-carrier:v2:private-group-PROPOSED",
  "type": "object",
  "additionalProperties": false,
  "minProperties": 1,
  "properties": {
    "employee_no": {"type": "string", "pattern": "^[A-Za-z0-9_-]{1,32}$"},
    "phone": {"type": ["string", "null"], "maxLength": 32, "pattern": "^\\+?[0-9 ()-]+$"},
    "pin": {"type": ["string", "null"], "pattern": "^[0-9]{1,128}$"},
    "cards": {"type": "array", "maxItems": 255, "items": {"$ref": "#/$defs/card"}},
    "photo": {"type": ["string", "null"], "maxLength": 44000,
              "pattern": "^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$"},
    "responsible_person": {"type": ["string", "null"], "maxLength": 64, "pattern": "^[^\\x00-\\x1f]*$"},
    "access_purpose": {"type": ["string", "null"], "maxLength": 128, "pattern": "^[^\\x00-\\x1f]*$"}
  }
}
```

Validator rules beyond the schema: `phone` 7..15 digits; `photo` decodes to a JPEG of at most 32768 bytes and
1..512 x 1..512; card numbers and ids unique; none of the seven keys appears in public `data`; `valid_from` and
`valid_until` set together (public). Synthetic valid example:

```json
{"phone": "000-0000000", "responsible_person": "Synthetic Manager", "access_purpose": "synthetic test purpose"}
```

Synthetic invalid examples for vectors (one defect each): `responsible_person` of 65 characters; `access_purpose` of 129
characters; a control character in either; `responsible_person` as a number; `access_purpose` also present in public
`data`; `profile` anywhere in the request; the empty object.

## 5. Privacy rules (apply to all seven fields; C5 and C6 stay binding)

1. No value, no hash, no length, no character count, no byte count, no digest and no truncation of the real value of any
   of the seven fields appears in logs, audit rows, evidence files, test reports, exception text, `ApiError.details`,
   the database, the WAL, metrics or diagnostics. This includes derived facts such as "was empty", "was longer than N"
   or "differs from the previous value". Presence is recorded as the field **name** only (as W2 audit does today).
2. The two new text fields are the highest-risk fields for accidental logging because they are human-readable names and
   reasons. No log template may interpolate them; log lines use fixed templates with a code argument only (N21).
3. Evidence (WisKey `W_M7_PRIVATE_BOUNDS.json` and its tests, Arx vectors) contains schema bounds and synthetic values
   only. A bound is a number from source code, never a measurement of a real value.
4. The AEAD tag and the constant-length padded ciphertext remain the only length-hiding mechanism. Owner confirmation
   (P3) was needed that they do not violate "no hash or length" (open question 7): **confirmed by the owner on 2026-10-20 (22.2 = a).**
5. The editor read model keeps `responsible_person` and `access_purpose` behind `access.people.sensitive`; the carrier
   changes only the write transport.
6. Test fakes contain no real names or business reasons. Sentinels: for example `SENTINEL-RESP-01`,
   `SENTINEL-PURPOSE-01`, plus one with non-ASCII letters.

## 6. Arx-side storage and RBAC implications

- **Storage:** none new. Slots remain memory-only in the add-on (15 s, single use). Arx's own database does not store
  `responsible_person` or `access_purpose` for a person (they live in WisKey and are read back through `users/get`);
  that does not change. The audit row keeps field **names** of the seven keys, `transport: carrier|w2` and
  `carrier_witness`, never values.
- **RBAC:** the gate does not change. A carrier request needs the same authority as the W2 write: `access.people.manage`
  on the station scope, plus `access.people.sensitive` for any of `phone`, `pin`, `cards`, `photo`, `responsible_person`,
  `access_purpose`, and for `employee_no` only when the setting `access.employee_no_sensitive` is on. The two new fields
  are already in `SENSITIVE_FIELDS`, so there is no permission change. WisKey adds no organizational policy (C8).
- **Authority re-check at fetch** (permission revision and epochs equal the signed ones) is unchanged and now also covers
  a revoked `access.people.sensitive` between sign and fetch.
- **Internal principal caveat:** `services/access_grants.py` (external access grants) writes `responsible_person` and
  `access_purpose` with Arx-generated text when it creates a person. Route rule 3 keeps non-human principals on W2, so
  that path is unaffected, but after go-live those two fields still travel on the W2 frame for that path. This is a
  recorded consequence, not a hidden fallback (open question 3). **Approved by the owner on 2026-10-20 (22.1 = a) as a documented exception.**
- **Editor and reconcile:** after a carrier success Arx does the same `users/get` read for the editor projection (B7).
  The projection masks the two fields for callers without `access.people.sensitive`, as today.
- **Settings:** unchanged: `access.private_carrier` default `off`, `CARRIER_GO_LIVE_PERMITTED = False`.
- **Drift tests (proposed):** build-time test that the payload schema's private key set equals WisKey's seven keys and
  that the Arx sensitive set equals the private set plus the `employee_no` conditional.

## 7. Dependencies and WisKey inputs (state of knowledge)

| ID | Item | State |
|---|---|---|
| W-M1 | production caller of `MemorySourceInputs.issue` and preparer | open (WisKey) |
| W-M2 | who registers `trusted_operation` and composes `CandidateHost` | open; K1 contradiction recorded |
| W-M3 | source of public parameters (proposed: in the carrier payload) | open |
| W-M4 | public schema vs W2 fields | WisKey local rev2 has 12 public fields, the two text fields moved private; a local OFF candidate, not adoption; `access_timing_policy` limited to null in rev2 |
| W-M5 | private-only update | WisKey local candidate, not adoption |
| W-M6 | receiver composition | decided by WisKey statically, choice (b); evidence NOT_RUN; WisKey to confirm in one line |
| W-M7 | closed bounds for the seven keys | requested; not received (the Arx build waits for it) |
| W-M8 | option A or B | closed: option A |

## 8. Test plan delta (PLANNED, NOT_RUN)

Same fakes and N01-N21 as the five-field plan, with: N12 extended (unknown key such as `profile`, `responsible_person`
over 64, `access_purpose` over 129, control character, number in place of string); N19 and N20 using the seven
sentinels; P01 extended to a create with `responsible_person`, `access_purpose` and phone; a new case N22 "update with
only a private key" refused to W2 routing until WisKey's private-only update is adopted. All with fakes; no live system.

## 9. Open questions for the owner

1. **Basis for the two new limits (64 and 128).** Arx's own validators use them today.
   a) Keep the Arx mirror as the proposal and replace with WisKey's W-M7 numbers when they arrive. **(recommended)**
   b) Wait for W-M7 before fixing any number in the proposal.
   c) Choose different limits now (owner specifies).
2. **Unit of the limits (characters or bytes).**
   a) Characters, as Arx counts today, unless W-M7 says otherwise. **(recommended)**
   b) UTF-8 bytes.
   c) Follow WisKey's W-M7 whatever it is.
3. **Internal Arx-generated persons (external access grants)** still send the two fields on W2 after go-live. **ANSWERED 2026-10-20: a.**
   a) Leave on W2 as a documented exception. **(recommended)**
   b) Require them to use the carrier too (needs a service-principal carrier design; larger scope).
   c) Stop writing these two fields for generated persons (product change).
4. **If WisKey's unit or normalisation differs** (for example it trims or counts bytes).
   a) Arx adopts WisKey's rule and adds a pre-send check so no late rejection reaches the operator. **(recommended)**
   b) Arx keeps its rule and lets WisKey refuse.
5. **Private-only updates** (no public key in the draft).
   a) Keep on W2 until WisKey's private-only update (W-M5) is adopted by a separate agreed decision. **(recommended)**
   b) Ask WisKey to adopt the local candidate now.
6. **`profile`.** Arx never sends it through the carrier.
   a) Confirm. **(recommended)**
   b) Allow it later as a public parameter by a separate decision.
7. **P3 reading** (the AEAD tag and constant-length ciphertext are not a "hash or length of a sensitive value"). **ANSWERED 2026-10-20: a.**
   a) Confirm. **(recommended)**
   b) Reject; a design without ciphertext must then be found, which weakens T3.
8. **Where this revision goes.**
   a) Send to WisKey as PROPOSED only, as input for W-M7 integration. **(recommended)**
   b) Hold until W-M7 arrives and send one merged document.

Unchanged from the five-field design: P1 (implementation permit, OFF), P2 (new internal route), P4-P7 (lab install, lab
TEST, go-live, W2 retention). None is requested or granted by this document.

## 10. Verification status

Read and cross-checked: the five-field design and the Arx reply sections listed above; Arx code for the field limits
(`PersonData`: `responsible_person` max 64, `access_purpose` max 128, no control characters; sensitive sets in
`intercom_writes.py` and `intercom_authority.py`). The sha256 of the five-field design was checked equal in the
proposal folder and on `integ/271`. **Not verified / NOT_RUN:** JSON Schema validation of the snippet in section 4,
every test in section 8, WisKey's real bounds (W-M7 not received), WisKey's unit and normalisation for the two new
fields, HA recorder behaviour, any cryptographic code. No live system, device, token, key or lab address was used.
