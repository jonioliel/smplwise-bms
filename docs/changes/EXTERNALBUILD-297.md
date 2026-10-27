# EXTERNALBUILD-297 - external access built to full scope (readiness, graceful write path, service-writer adapter, one-time code, visitors)

Branch: `pilot/EXTERNALBUILD-297`, cut from tag `v2.23.2` (`ab0caf9ea`). Spec read first: `private/review/external-access-spec-2026-10-27.md`
(EXTERNALSPEC-297, slices X0-X6). Owner direction 2026-10-27 (via the lead, in Hebrew): **full intake ("קליטה מלאה"), no new restrictions or
refusal gates**; build the whole scope in code; no default changes; activation is a settings action the owner does later in a session with the lead.

Fakes only. Nothing in this branch was run against WisKey, Home Assistant, a station, a door, a reader, a keypad or WhatsApp.

## 1. What was built, per slice

| Slice | Built | Where |
|---|---|---|
| X0 | User guide 52 rewritten where it said "locked in code" / "unreleased"; new section for this branch. Board r381 note/ETA updated by the lead's board (private) | `docs/user-guide/he/52-external-access_HE.md` |
| X1 | Read-only readiness check: API `GET /access-grants/readiness` (system administrator; 403 otherwise), a block in the external-access screen's Settings dialog (with the main on/off switch), CLI `scripts/eccact_activation_status.py --readiness --db PATH` | `services/access_readiness.py`, `routers/access_grants.py`, `frontend/src/screens/access-external.ts` |
| X2 (replaced) | No refusal. While WisKey's direct connection is selected, the grant engine uses the service writer when one is available, otherwise it **falls back automatically to the local service channel** (the path every `local` installation uses); the chosen path and its reason are recorded and shown in the readiness block. Revokes take the same path and are never blocked | `services/access_grant_engine.py` `WiskeyServiceEngine._write` |
| X3 | Owner-session runbook (English + Hebrew summary) | `docs/operations/EXTERNAL_ACCESS_LIVE_SESSION_RUNBOOK.md` |
| X5 | The direct-connection service-writer adapter behind a clean port, tested against a fake wire; the expected contract documented (section 5). The wire itself is not built (`WIRE_BUILT = False`) because WisKey has not published the contract | `services/access_service_writer.py` |
| One-time code (vendors) | `code_mode = 'single_entry'` beside the window code: chosen in the request (form + API) or by the approver (narrowing only); the code message says "for one entry only"; an entry watch reads WisKey's granted events and withdraws the grant after the first entry at one of its doors | `services/access_grants.py`, `services/access_entries.py`, request dialog |
| Visitors (CR-VISITOR105) | Invitations on the same grant engine, OFF by default (`access.visitors`): host permission `access.visitor.invite`, the approval envelope (routes, never refuses), visitor-entrance flag, number confirmation by the host-typed code before any door code, single entry, entry log, arrival notice to the host, re-decision on the host's permission, cancel / revoke-all, 30-day erase, hidden from the tickets directory | `services/access_visitors.py`, `routers/access_visitors.py`, `services/access_entries.py` |
| X6 | Built: it is the same mechanism as the one-time code (small; the only migration is additive, no table rebuild) | as above |

## 2. Decisions taken in this build (recorded, not hidden)

- **Contradiction C-EB1 (recorded):** owner answers q37 = א (no one-time code) and q38 = א (visitors frozen) vs the owner's direction of
  2026-10-27 ("full intake, no restrictions"). The newer direction was applied: both are built; nothing is enabled by default.
- **Contradiction C-EB2:** CR-VISITOR105 D11 proposed a code constant `VISITORS_LIVE_PERMITTED = False`. Not built (owner direction: no new
  gates; activation is a settings action). The visitor switch `access.visitors` (default off) plus `access.external_grants` are the gates.
- **WKINT-295 refusal superseded:** `WiskeyServiceEngine._write` used to refuse `not_sent native_human_actor_required` while the direct path was
  selected ("never a silent second path"). It now falls back to the service channel and records the fallback (not silent: readiness block +
  log line + `access_service_writer.last_path()`). `docs/changes/WKINT-295-WISKEY-INTEGRATION.md` and `W031-295.md` describe the old rule.
- **Visitor grants carry `source_ref = NULL`** (CR-VISITOR105 said the invite id): a grant's `source_ref` names a ticket and the R5 trigger
  revoked such a grant as "ticket ended". The invite row points at the grant instead.
- **The envelope routes, never refuses** (owner direction): an invitation over a cap, longer than the envelope or on a non-visitor-entrance
  station is stored as `requested` for a second person. Identity rules are kept (they are not limits): the host's own number, a staff /
  user number or a vendor technician's number is never a visitor (409 `access_visitor_number`); one live grant per person.
- **Visitor number confirmation:** the public visitor page (CR V3) is not built; the host asks for the verification code to go to the
  visitor's number and types back the code the visitor reads to him (`/access/visitors/{id}/verify/send|check`, the tickets phone-verification
  path with its caps). No door code is generated before that (`awaiting_confirmation` in the worker).
- **Single entry is best effort:** WisKey has no use-counted PIN. The gap between the entry and the strip is the poll interval plus the write.
- **The one-time code on a widening:** a request that both widens a decided grant and asks for a one-time code keeps the code type of the
  approved grant until the widening is approved (the held widening carries the scope only).

## 3. Data model (migration)

`smplwise_vms/backend/smplwise/migrations/0180_external_codes_visitors.sql` - number 0180 (built as provisional on v2.23.2, which ends at 0179;
confirmed at the 2.24.1 integration on release/2241; DOORWRITE-297 follows as 0181). Additive only:
- `access_grants.code_mode TEXT NOT NULL DEFAULT 'window' CHECK (code_mode IN ('window','single_entry'))`, `access_grants.first_entry_at TEXT`
  (ALTER TABLE ADD COLUMN, no rebuild);
- new tables `access_visitor_invites`, `access_visitor_entries`, `access_station_visitor_entrance`.

Rollback: the previous version never reads the new columns or tables. Before a downgrade run "revoke all" (external) and "revoke all
visitors" so no one-time / visitor PIN outlives the code that would end it; WisKey's validity window expires it anyway.

Settings added (key/value, all defaults unchanged behaviour): `access.visitors` (off), `access.visitors.max_hours` (24, cap 72),
`.max_ahead_days` (30/90), `.host_live_max` (3/10), `.host_day_max` (5/20), `.installation_live_max` (30/100), `.erase_after_days` (30/365),
`.single_entry_default` (off); runtime cursor `access.external.entry_cursor`.

Permission added: `access.visitor.invite` (station-scoped, sensitive, built-in holder `system_admin` only; demo mode blocks it).
Notification source added: `access.visitor.arrived` (to the host only; door name and time; never the visitor's name, number or image).

## 4. API

- `GET /api/v1/access-grants/readiness` - system administrator.
- `POST /api/v1/access-grants` and `POST /api/v1/access-grants/{id}/approve` take `code_mode` (`window` | `single_entry`).
- Visitors (`routers/access_visitors.py`): `GET|POST /access/visitors`, `GET|DELETE /access/visitors/{id}`, `POST /access/visitors/{id}/verify/send`,
  `POST /access/visitors/{id}/verify/check`, `PUT /access/visitors/entrances/{station}`, `POST /access/visitors/revoke-all`,
  `GET|PUT /access/visitors/settings`. While the visitor switch (or the external access) is off every route but the settings answers 404.

## 5. The service-writer contract Arx expects from WisKey (to send to WisKey; PROPOSED, NOT_RUN)

Problem: the grant worker is a background process (`system:access_grants`). WisKey's `wiskey-native-bridge-write.v1` admits only a human actor
in an active interactive session. Arx asks WisKey for ONE of:

**A. A service-actor write command on the direct connection (preferred; the adapter is built for this shape):**
1. `direct/capabilities` lists the capability `native_service_actor_write_v1` and the command `users/service_write_v1` on the authenticated
   direct connection (Arx selects it only when both are listed, through the existing join selection rule).
2. Request parameters (signed like every direct command):
   ```json
   {"contract": "wiskey-native-service-write.v1",
    "action": "users/create | users/update | users/delete | cards/add | cards/remove",
    "target": {"user_id": "<WisKey person id, absent for create>", "expected_revision": 7},
    "data": { "...the same business shape the service channel sends today (users/create data, users/update data incl. pin / pin:null, ...)" },
    "attribution": {"service_actor": "arx-service:<config entry>", "decided_by": "arx_rbac", "grant_ref": "<Arx grant id>",
                    "approved_by": "<Arx user id of the human approver>", "approval_revision": 42, "reason": "provision | revoke | ..."}}
   ```
3. Answer: `{"ok": true, "person": <ManagedUser.public>}` (`users/delete`: `{"ok": true}`); errors carry WisKey's code and an `outcome`
   (`not_sent` = nothing was saved, `refused` = a verified pre-commit refusal, `unknown` = may have been saved). Codes Arx maps:
   `user_not_found`, `revision_conflict`, `pin_conflict`; anything else by outcome.
4. Idempotency / replay: Arx never re-sends an `unknown` write; it reads the person fresh first. WisKey may add an operation id + receipt
   (as in native-bridge-write.v1); the adapter's frame has room for it.
5. Authority: Arx RBAC decides (AUTH01). WisKey records the service actor and the human approver attribution; it does not re-decide.

**B. Or:** the existing `wiskey-native-bridge-write.v1` admits an actor `{kind: "service", service_id: "arx-service:<entry>"}` with channel
`background` and the same attribution object. Then `DirectServiceWriter._wire` builds the W1 descriptor instead of the frame above.

When WisKey answers: implement `DirectServiceWriter._wire` (send the frame on `join.capture_port` / the command port, parse the answer),
set `WIRE_BUILT = True`, and add a crash test with `tests/w10_fake_direct.py`. One more wiring item: an `unknown` answer on this path must
also close the per-person write gate the service channel keeps (`intercom_sync.SYNC.write_gate`, R3-06), so the next write to that person waits
for a fresh read - the service channel does this inside `SYNC.action`; the adapter path checks the gate before sending but does not set it yet.
Nothing else in the engine, worker or readiness changes.

Also still open for WisKey (unchanged from the spec section 7): readback admission for the add-on identity (`users/access_state_v2`),
revocation-proof timing, offline-station expiry (W-a), PIN uniqueness / quarantine (W-b), keypad lockout and denied events (W-c), whether
`employee_no` is always present on a PIN `access_granted` event (needed by the one-time code and the visitor entry log).

## 6. Tests

`smplwise_vms/backend/tests/test_externalbuild_297.py` (fakes only): X2 fallback (selected / local / not selected), X5 adapter (frame,
attribution, PIN dropped after the call, closed error mapping, malformed writes never sent, unavailable while the wire is not built), X1
(403 for non-admins, every missing prerequisite named in Hebrew, unknown never ok, fallback + v2 ready, CLI read-only over a DB file),
one-time code (entry at the right door ends the grant, wrong door / other person / before the window ignored, window codes not watched,
approver narrows only), visitors (off by default, envelope approval, no code before confirmation, outside the envelope -> second person,
host permission per station, re-decision revokes, staff / technician number refused, single entry + entry log + arrival notice without the
name, cancel, expiry unconfirmed + erase, only the host reaches the number check, audit rows without name / number / PIN, revoke-all word).

Regression run locally (see the agent report for the exact commands and outcomes). Frontend: `tsc --noEmit` clean. No Playwright spec was
added or run for the readiness block (NOT_RUN; screenshots listed as missing in the guide).

## 7. Not built (honest list)

- The public visitor page (CR V3), the host's "my visitors" and the managers' per-station visitor screens (CR V6: need an owner-approved mockup),
  SMS delivery (no SMS channel).
- The live service-writer wire (waits for WisKey, section 5).
- Any live run: X4 is the owner's session (runbook).
