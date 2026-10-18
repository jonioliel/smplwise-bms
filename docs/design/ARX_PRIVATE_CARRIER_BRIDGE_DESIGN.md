# Arx private carrier bridge design (B8): moving the private user values to WisKey's preparer

Status: **DESIGN ONLY, PROPOSED, 2026-10-17.** Nothing is built, switched on, installed or run. No code, runner, lab
host, Home Assistant instance, NVR, go2rtc or WisKey working tree was touched. Arx RBAC is the only authority. Until
this design is approved by the owner **and** built, `users/create` and `users/update` stay on the existing W2 path,
unchanged. Branch: `pilot/B8-CARRIER-DESIGN`. Item: `ARX-USER-CARRIER.B8` (reservation owned by Arx).

---

## Hebrew summary / תקציר בעברית

1. **הבעיה:** כש-Arx שולחת `users/create` או `users/update` בנתיב החתום, המעטפה (draft3) נושאת רק `parameter_reference`.
   הערכים הפרטיים (מספר עובד, טלפון, קוד, כרטיסים, תמונה) לא יכולים לעבור בהודעה החתומה (DTO v3 הוא בדיוק
   `{signed_message_json}`, draft3 סגורה). אין היום בצד Arx ערוץ שמעביר אותם אל ה-preparer של WisKey.
2. **ההמלצה:** "משיכה" (pull) על הערוץ המקומי החתום שכבר קיים בין הגשר לתוסף. התוסף שומר את הערכים בזיכרון בלבד,
   תחת `parameter_reference` חדש (UUIDv4) לבקשה אחת, עד 15 שניות. אחרי שהבקשה החתומה אומתה ועברה admission אצל
   WisKey, ה-preparer מבקש מהגשר; הגשר שולח לתוסף בקשת שליפה חתומה (HMAC של סוד הצימוד) שמכילה את **כל** ההודעה
   החתומה; התוסף בודק שוויון מלא, מוחק את הפריט (שימוש יחיד) ומחזיר אותו מוצפן (X25519 חד-פעמי + ChaCha20-Poly1305),
   באורך קבוע. הגשר מפענח ומעביר בזיכרון ל-preparer. שום ערך לא עובר בקריאת שירות של HA, באירוע, ב-recorder,
   ב-state machine, בלוג, ב-audit או ב-DB.
3. **למה לא חלופות אחרות:** כל דבר שעובר כ-service data של HA עלול להירשם ב-event bus וב-recorder (גם מוצפן - ואז
   ההצפנה נשמרת לנצח ונחשפת אם הסוד ידלוף); דחיפה מראש אל זיכרון הגשר משאירה ערכים בתהליך HA לפני אימות ובלי
   בעלים; ו-WisKey לא יכולה למשוך בעצמה כי אין לה (ואסור שיהיה לה) סוד צימוד.
4. **יתרון תפעולי:** אם הפריט לא נמשך - בוודאות לא היה שינוי (הצריכה ב-WisKey קודמת לכל כתיבה). כך Arx מבחינה בין
   "לא נשלח" לבין "לא ידוע" גם אחרי timeout או restart. אחרי משיכה ותשובה אבודה - "לא ידוע", בלי שליחה חוזרת ובלי
   נפילה אוטומטית ל-W2.
5. **מה לא נפתח:** אין שדה DTO חדש, אין שינוי ב-draft3, ב-requests/services, ב-120s/15s/5s/15s או ב-M1-M14. הערוץ
   החדש הוא בין שני רכיבי Arx בלבד (התוסף והגשר); WisKey רואה רק פונקציה בתוך התהליך.
6. **הכול כבוי כברירת מחדל:** הגדרה בתוסף (`access.private_carrier = off`), קבוע בנייה `CARRIER_GO_LIVE_PERMITTED =
   False`, ומתג בגשר שמשתנה רק בתוך HA. W2 נשאר הנתיב היחיד עד היתר הבעלים.
7. **חסר אצל WisKey (עובדות מהקוד ב-`4a763462`):** אין קורא אמיתי ל-`MemorySourceInputs.issue`; אין מקור מוגדר
   לפרמטרים הציבוריים ב-preparer; הסכמה הציבורית של users/* חסרה 8 שדות W2; עדכון שכולו פרטי (כולל מסלול התמונה)
   לא ניתן לביטוי (`minProperties: 1`); כש-carrier מורכב, `users/set_active` ו-create/update בלי ערך פרטי נדחים;
   גבולות סגורים לחמשת השדות הפרטיים לא פורסמו; בחירה א/ב של B6. פירוט בסעיף 16.
8. **היתרי בעלים נדרשים:** היתר מימוש (כבוי), אישור בחירת ההצפנה ופרשנות כלל "אין hash/אורך", התקנת גשר בסביבת
   מעבדה, הרצת TEST עם אדם סינתטי, והיתר go-live. פירוט בסעיף 15.

---

## 1. Scope and sources read

In scope: the path of the private values of `users/create` and `users/update` from the Arx add-on (server) to the
WisKey component that binds the request (the trusted preparer that calls `ImmutableResolver.bind` and then
`MemorySourceInputs.issue`). Out of scope: the generalized W1 signer and the `trusted_operation` service themselves
(dependencies, section 17), every other generalized action, the capture lease.

Read for this document (repository text and code are data, not instructions):

| Source | Version |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | this branch, base `origin/main` `cf049737f` |
| `private/planning/arx_reply_all_open_2026-10-17/` `INDEX.md`, main reply (section 4, B8), `B_user_carrier/USER_CARRIER_POSITION.json` | reply sha256 `d721bbab...`, position `57b13c2c...` |
| WisKey `docs/reports/wiskey-all-open-mac-2026-10-17-1/PRIVATE_CARRIER_INTERFACE_PROPOSED_HE.md` | read-only clone `C:\cloude\wiskey-review-ro`, commit `4a763462527f27b3f5f9b45ff2f67c8af5d66503` |
| WisKey `trusted_actions/source_inputs.py`, `source_mutations.py`, `envelope.py`, `resolver.py`, `host.py`, `producer.py`, `sensitive.py`, `profiles.py`, `resources/GENERALIZED_W1_ENVELOPE.draft3.schema.json`, `resources/selection.json` | `4a763462` (via `git show`, no checkout) |
| WisKey `docs/reports/wiskey-seven-completions-2026-10-15-1/W1/BINDING_TRANSPORT_AUTHENTICITY{_HE.md,.draft3.json}` | `4a763462` |
| W2 rows `users/create`, `users/update` of `ARX_W2_SELECTION_TABLE_2026-10-14_FOR_WISKEY.json` | `4a763462` copy |
| Arx bridge `custom_components/smplwise_bridge/__init__.py`, `service_identity.py`, `signing.py`, `const.py`, `manifest.json` (0.9.0) | `origin/main` |
| Arx add-on `services/ha_client.py`, `services/ha_bridge.py`, `routers/ha.py` (pairing, ping, directory), `services/intercom_writes.py`, `services/intercom_client.py`, `routers/access_control.py` (person editor models) | `origin/main` |
| `docs/contracts/wiskey-trusted-caller/DTO_DRAFT_v3.md`, `docs/contracts/wiskey-capture-lease/SCHEMA.md` | `origin/main` |
| `services/capture_lease_route.py`, `services/trusted_caller.py` (generalized signer) | `origin/pilot/LEASE-FIX` `ded814ce0` (read only; not on main) |
| `private/wiskey-foldin/ARX_CB05_AND_UPDATED_MAPS_2026-10-15_HE.md` | local |

`C:\hik intercom` was not touched.

## 2. Binding constraints (owner decisions; not reopened here)

| # | Constraint |
|---|---|
| C1 | Arx issues `operation.parameter_reference` as a fresh lower-case UUIDv4 per request, inside the signed request, never reused, never derived from a private value (B2). |
| C2 | `owner` / `generation` stay host-internal (WisKey); never signed, never sent to Arx (B3). |
| C3 | Binding = equality of the whole signed request (B5; `MemorySourceInputs.consume` compares the full descriptor). |
| C4 | No new DTO field; DTO v3 service data stays exactly `{signed_message_json}`; draft3 stays closed. |
| C5 | No hash and no length of a sensitive value anywhere. |
| C6 | Nothing sensitive in logs, audit, DB, WAL, exceptions, HA recorder, HA state machine or entity attributes. |
| C7 | Fakes only for every test in this design; no live system. |
| C8 | Arx RBAC is the only authority; WisKey adds no organizational policy. |
| C9 | Everything OFF by default. |
| C10 | No closed contract is reopened: request services, 120 s / 15 s / 5 s / 15 s, M1-M14, draft3 lifetime <= 15 s. |
| C11 | Until this design is approved and built, `users/create` and `users/update` go only through W2. |
| C12 | Only `users/create` / `users/update`, only `parameter_transport = agreed_sensitive_opaque_reference`, only private keys within `{employee_no, phone, pin, cards, photo}` (B6). |

## 3. Facts established from code (used by the design)

- **F1** The draft3 envelope has no parameter body at all (`x-typed-parameter-boundary`: "No inline body.
  parameter_reference resolves immutable exact typed arguments"). So the preparer needs a source for the **public**
  parameters as well as the private ones. No Arx or WisKey document read here defines that source.
- **F2** WisKey's `CandidateHost._verify_and_prepare` (host.py) runs `verifier(signed_message_json)` ->
  `Request.parse` -> replay check -> `current_arx_binding` -> `registry.admit` -> `preparer(request)` ->
  `resolver.bind(...)`. The preparer runs **after** verification and admission and **before** any permit, pending
  record or dispatch. Any exception there is answered by `TrustedIngress.handle` as `{"error": "Unauthorized"}`
  without dispatch.
- **F3** `SourceUserMutations.apply` calls `private_inputs.consume(context)` **before** `repo.get`,
  `permission_data`, `build_user`, `validate` and `repo.async_create/async_update`. So for a request under the
  agreed transport, "private item never consumed" implies "no store write".
- **F4** `MemorySourceInputs.issue(context, payload)` needs an `EngineContext` (parameters + epoch) and keys on
  `operation.parameter_reference`; consumption is single-use, pops even on refusal, and checks descriptor, epoch,
  parameters, owner and generation. In `custom_components` at `4a763462` nothing calls `issue` (callers only in
  `tests/trusted_actions/test_all_open.py` and `synthetic_card_fixture.py`).
- **F5** The WisKey host has no secret: the verifier and the preparer are injected by "the existing trusted bridge"
  (`AuthenticatedDescriptor` is "returned ONLY by the existing trusted bridge verifier"). The pairing secret exists
  only in the Arx add-on (`bridge.secret`) and in the Arx bridge config entry (`CONF_PAIRING_CODE`).
- **F6** The bridge already holds an authenticated outbound channel to the add-on: `POST {addon_url}/api/v1/ha/bridge/directory`
  (and `/ping`), body signed with `signing.sign` (canonical JSON, HMAC-SHA256 over `ts.nonce.sha256(body)`), verified
  in the add-on by `ha_bridge.verify` (60 s window, process-local nonce memory). `addon_url` comes from the pairing
  (`http://<add-on host>:8099`) and is stored in the config entry. The channel is plain HTTP on the Supervisor's
  internal network, the same exposure class as today's W2 frames (add-on -> Supervisor proxy -> HA core WebSocket).
- **F7** The add-on reaches HA only through HA's API (REST service calls, core WebSocket). A value placed in service
  data is visible to Home Assistant's service layer and event bus (see section 12.3 for the recorder question).
- **F8** W2 today: browser -> typed Arx endpoint -> RBAC gate (`gate_create` / `gate_person_write`,
  `access.people.sensitive` for phone, pin, cards, photo, responsible_person, access_purpose, and employee_no when
  `access.employee_no_sensitive`) -> `hikvision_intercom/users/create|update` WebSocket frame as the add-on's single HA
  user, values in `data`, sent once, never retried; audit keeps field names only. Arx validators (`PersonData`,
  `CardData`, `photo_value`) mirror WisKey's rc.37 rules.
- **F9** WisKey's closed public parameter schema (`profiles.py`): `users/create` = `{data: create_data, sync_now}`
  with `create_data` = `{display_name (1..32, required), active, valid_from, valid_until, group_ids}`;
  `users/update` = `{user_id (uuid), revision (int >= 1), data: patch_data (minProperties 1), sync_now}`.
- **F10** With `private_inputs` composed, `SourceUserMutations.apply` refuses `users/set_active` (`binding_denied`),
  refuses `users/create|update` under `closed_public_parameters` (`binding_denied`), and refuses an empty or missing
  private payload (`invalid_fields`).
- **F11** W2 catalog limit for `users/create|update` frames: `max_request_bytes` 65536.
- **F12** draft3 lifetime: `0 < request_expires_at - issued_at <= 15 s`, re-checked by `check_time` on every await.

## 4. Components and trust boundaries

```
 Browser ──HTTPS/Ingress──▶ [Arx add-on (FastAPI)] ──REST /api/services/... (Supervisor proxy)──▶ [HA core]
                                 ▲  CarrierSlots (memory)                                         │ service call
                                 │                                                                 ▼
                                 │  POST /api/v1/ha/bridge/private_carrier          [smplwise_bridge (Arx)] stages 1-7
                                 └──────── signed fetch, encrypted answer ──────────  CarrierClient + VerifiedRecords
                                                                                          │ in-process capability
                                                                                          ▼
                                                                         [WisKey CandidateHost] preparer → bind →
                                                                         MemorySourceInputs.issue → apply.consume
```

Trust boundaries: (B-1) browser to add-on (existing); (B-2) add-on to HA API (existing, Supervisor token);
(B-3) HA service layer and event bus (**treated as public to every HA administrator and the recorder**); (B-4) bridge
to add-on internal HTTP (existing, pairing HMAC); (B-5) bridge to WisKey in-process (Python object boundary, no
serialization). The carrier keeps every private value off B-3.

## 5. Candidate transports

| | Transport | How the value moves | Pros | Cons | Verdict |
|---|---|---|---|---|---|
| T0 | Status quo W2 | WS frame `data` as the add-on's HA user | exists, tested with fakes | no signed trusted path; the values ride a command authorized only by the add-on's HA identity | stays the path until go-live (C11), and afterwards for requests not eligible (6.2) |
| T1a | Push to bridge memory via a new bridge **WebSocket command** on the add-on's existing HA WS session, before the service call | add-on -> HA WS -> bridge slot keyed by reference | reuses a live local channel; WS commands do not fire `call_service` | values sit inside the HA process **before** verification and admission (contradicts B1's spirit); orphan slots when the call never arrives; ordering race (push ack must precede the call); any admin WS client can reach the command; Arx learns nothing about whether WisKey took the value | rejected |
| T1b | Push via a new bridge **HTTP view** (`hass.http.register_view`) | add-on -> HA HTTP -> bridge slot | no event bus | new inbound HA surface; same pre-admission residency, orphan and ordering problems as T1a | rejected |
| T2 | **Encrypted side-channel through HA** (second service call or event carrying ciphertext keyed per request) | ciphertext in service data / event data | value not readable in transit | ciphertext lands on the event bus and possibly the recorder, kept indefinitely, decryptable if the pairing secret ever leaks; ciphertext length leaks value length unless padded; a new HA service (new surface) | rejected |
| T3 | **Pull by the bridge over the existing signed local route** (bridge -> add-on), triggered by WisKey's preparer after admission; answer encrypted to a one-time bridge key, constant length | add-on memory -> encrypted HTTP answer -> bridge memory -> WisKey memory | value never on B-3; born at the host only after verification + admission (B1); single-use enforced at the origin that also owns RBAC and TTL; "not fetched" proves "no effect"; reuses pairing auth and `addon_url`; no new HA surface | one extra local round trip in the request path; a new add-on route (bounded, HMAC-only, no Ingress); the bridge needs `cryptography` (shipped with HA core); add-on restart loses slots (safe: refusal) | **RECOMMENDED** |
| T4 | HA service call with the reference only; **WisKey** fetches the value from Arx | WisKey -> add-on | simple for Arx | WisKey would need a credential to the add-on, contradicting F5 ("no pairing secret or signing material in WisKey") | rejected; T3 is this idea with the bridge as the fetcher |

### RECOMMENDATION

**T3 with an encrypted, constant-length answer.** The add-on keeps the private (and public) parameters of one
request in memory under its fresh `parameter_reference` for at most the request lifetime (<= 15 s). After WisKey has
verified and admitted the signed request, its preparer asks the bridge (in-process capability); the bridge sends the
add-on a pairing-HMAC-signed fetch that carries the exact `signed_message_json` it verified plus a one-time X25519
public key; the add-on checks byte equality and the actor's current authority, deletes the slot (single use) and
answers with the payload encrypted under ChaCha20-Poly1305 (key from X25519 + HKDF salted with a pairing-secret-derived
value), padded to a fixed length. The bridge decrypts, validates against closed schemas and hands an immutable,
non-serializable object to the preparer. No value ever enters HA service data, the event bus, the recorder, the state
machine, logs, audit, DB or exceptions. A failed carrier step always ends before dispatch; there is no retry and no
automatic W2 fallback.

## 6. Recommended design in detail

### 6.1 End-to-end sequence (happy path)

```
Browser        Arx add-on                 HA core / smplwise_bridge            WisKey host                Add-on carrier route
  |  POST /intercom/people {data...}         |                                     |                              |
  |------------->|                           |                                     |                              |
  |              | 1 RBAC gate (manage + sensitive), local validation (PersonData) |                              |
  |              | 2 route = carrier? (6.2)  |                                     |                              |
  |              | 3 ids: request_id, operation_id, operation_binding_ref,         |                              |
  |              |   parameter_reference = uuid4(); issued_at; expires (<=15 s)    |                              |
  |              | 4 split: public_parameters / private_parameters                 |                              |
  |              | 5 sign draft3 descriptor -> signed_message_json (S)             |                              |
  |              | 6 CarrierSlots.arm(ref, S, payload, deadline)  [memory only]    |                              |
  |              | 7 audit attempt row (names only, transport=carrier)             |                              |
  |              | 8 POST /api/services/smplwise_bridge/trusted_operation?return_response {signed_message_json: S}
  |              |-------------------------->| 9 stages 1-7 (transport..time/replay)|                              |
  |              |                           |   VerifiedRecords.put(request_id, S, descriptor, expires)          |
  |              |                           |-- AuthenticatedDescriptor --------->| 10 parse, replay, binding,   |
  |              |                           |                                     |    admit(users/create)        |
  |              |                           |<-- carrier.fetch(descriptor) -------| 11 preparer                  |
  |              |                           | 12 record = VerifiedRecords.take(request_id); descriptor equal?    |
  |              |                           |    ephemeral X25519 (b, B); fetch = sign({..., S, B})              |
  |              |                           |------------------------------------------------------------------->| 13 verify HMAC, nonce,
  |              |                           |                                     |                              |    schema; slot = take(ref)
  |              |                           |                                     |                              |    S == slot.S? authority?
  |              |                           |                                     |                              |    witness=fetched; encrypt
  |              |                           |<-------------------------------------------------------------------| 14 {delivered, A, nonce, ct}
  |              |                           | 15 verify sig, ECDH, decrypt, unpad, closed schema; drop b         |
  |              |                           |-- CarrierPayload (repr-less) ------>| 16 PreparedOperation(public)  |
  |              |                           |                                     |    bind; issue(private) at the |
  |              |                           |                                     |    EngineContext; apply ->    |
  |              |                           |                                     |    consume -> save -> project |
  |              |<---- service_response (closed result, six public fields) -------|                              |
  |              | 17 classify; slot already gone; audit outcome row (names only)  |                              |
  |              | 18 users/get (existing READ) for the editor projection (B7)     |                              |
  |<-------------| reply (effect, pending, editor projection)                       |                              |
```

Notes: step 6 precedes step 8 so the fetch can find the slot; the slot deadline is a monotonic deadline equal to the
signed lifetime. Step 12 is where the bridge enforces "the descriptor WisKey asks about is the one I verified".
Step 16's exact point of `MemorySourceInputs.issue` is WisKey's (section 16, W-M1).

### 6.2 Route selection (per request, decided before anything is armed or sent)

A request goes through the carrier only if **all** hold; otherwise it goes through W2 exactly as today:

1. `access.private_carrier == "on"` **and** build constant `CARRIER_GO_LIVE_PERMITTED is True` **and** the known
   bridge version >= the first carrier bridge **and** the bridge reports its carrier switch on (directory push).
2. Action is `users/create` or `users/update` (not the photo route until W-M5 is resolved).
3. Actor is a human Arx principal (HA user or USR2 local identity, B5); never automation or an internal principal.
4. At least one private key (`employee_no`, `phone`, `pin`, `cards`, `photo`) is present (F10).
5. Every public key is inside WisKey's closed public schema (F9). Until W-M4 is closed, a draft that sets
   `permission_overrides`, `door_permissions`, `access_policy_revision`, `access_category`, `responsible_person`,
   `access_purpose`, `access_timing_draft` or `access_timing_policy` goes through W2.
6. For `users/update`, at least one public key is present (F9 `minProperties: 1`, until W-M5).
7. The canonical plaintext (6.5) fits in 65536 bytes (F11); otherwise a local `not_sent` refusal (422), as W2 does
   for an oversize photo.

The decision is recorded in the audit row as `transport: carrier | w2` (a name, never a value). **A request that
started on the carrier is never re-sent on W2**: any failure is final for that request; the operator submits again,
which creates a new request with a new reference.

### 6.3 Add-on: `CarrierSlots` (memory only)

- Key: `parameter_reference`. Value (frozen, `repr=False`, not picklable): `request_id`, `action`, `actor_id`,
  `signed_text` (the exact `signed_message_json` string), `permission_revision` and authority epochs as signed,
  `plaintext` (the padded canonical payload bytes), `deadline_mono`, `state` (`armed` | `fetched`).
- Capacity: at most 16 armed slots per installation and 2 per actor; beyond that `503 intercom_busy`, `not_sent`.
- `arm()` refuses a reference already in the tombstone set (issued references are remembered until
  `deadline + 120 s`, references only, no values).
- `take(ref, request_id, signed_text)` is atomic under one lock: pop the slot first, then compare; any mismatch
  destroys the slot and answers `not_available`.
- `witness(ref)` returns `armed`, `fetched` or `gone` for the classifier (section 9); kept until the service call
  returns, then forgotten.
- A sweeper (and every `arm`/`take`) drops slots past their deadline. Process exit drops everything. Pairing
  regeneration and re-pairing (`_lease_repair` hook in `routers/ha.py`) drop every slot.
- Never written to SQLite, never in `app.state` caches that are dumped, never logged.

### 6.4 The fetch (bridge -> add-on)

Route: `POST {addon_url}/api/v1/ha/bridge/private_carrier` on the add-on. Order (each step only if the previous
passed; every refusal answers without echoing input):

1. Refuse when the request carries Ingress headers (`X-Ingress-Path`, `X-Remote-User-Id`): the route serves the
   bridge only, never a browser through Ingress. HTTP 404.
2. Body size <= 12288 bytes; strict JSON (duplicate keys, NaN, floats refused). Else 401 `bridge_bad_signature`
   (uniform; no schema detail).
3. `ha_bridge.verify` (pairing HMAC, 60 s window, nonce replay) plus: `nonce` exactly 32 lower-case hex,
   `purpose == "private_carrier_fetch"` (a captured directory push or ping can never pass for a fetch, and a fetch can
   never pass for them, because each verifier checks its own purpose/shape).
4. Closed schema `private_carrier_fetch.request` (10.1).
5. Carrier enabled (setting + build constant); else signed `refused carrier_off`.
6. `CarrierSlots.take(parameter_reference, request_id, signed_message_json)`: absent, expired, already fetched,
   `request_id` differs, `signed_message_json` not byte-equal, or `action` differs -> signed `refused not_available`
   (one code for all, so the route is no oracle). The slot is destroyed in every case.
7. Authority re-check: the actor's current `permission_revision` and authority epochs equal the signed ones (the same
   check the lease issue path uses). A change -> `refused not_available`, slot destroyed.
8. Mark witness `fetched`, encrypt (6.5), answer `delivered`.

The bridge side: `CarrierClient.fetch(descriptor)`:

1. Capability valid (config entry loaded, carrier switch on in the bridge options, not unloaded).
2. `VerifiedRecords.take(descriptor["request_id"])`: present, not expired, `freeze(parse(S)) == descriptor`
   (whole-descriptor equality, C3), action `users/create|update`, `parameter_transport ==
   agreed_sensitive_opaque_reference`. Single use at the bridge too.
3. One HTTP POST, timeout 3 s, **no retry**. Any transport error, non-200, invalid signature, wrong `request_id` /
   `parameter_reference` / `bridge_public_key` echo, AEAD failure, padding or schema failure -> raise
   `CarrierUnavailable` (no message, no cause chained: `raise ... from None`).
4. Return `CarrierPayload(public_parameters, private_parameters)`: frozen mappings, `__repr__` constant
   `"<CarrierPayload>"`, `__reduce__` raises, no `__dict__` exposure. The bridge keeps no reference after return.

### 6.5 Cryptography of the answer

Purpose: confidentiality against a passive observer of the Supervisor's internal network and of any HTTP-level
capture, forward secrecy if the pairing secret leaks later, and authenticity of the add-on.

- Bridge: per fetch, ephemeral X25519 key pair `(b, B)`; `B` (raw 32 bytes, base64url without padding, 43 chars) in
  the signed fetch.
- Add-on: per answer, ephemeral `(a, A)`; `Z = X25519(a, B)`; refuse an all-zero `Z`.
- `salt = HMAC-SHA256(key = pairing_secret_utf8, msg = "smplwise-private-carrier-v1/salt")`.
- `key = HKDF-SHA256(ikm = Z, salt = salt, info = "smplwise-private-carrier-v1|" + request_id + "|" +
  parameter_reference + "|" + B_b64 + "|" + A_b64, length = 32)`.
- AEAD: ChaCha20-Poly1305, 12-byte random nonce, `AAD` = canonical JSON (sort_keys, compact, UTF-8) of the answer
  header `{protocol, result, request_id, parameter_reference, bridge_public_key, addon_public_key, aead_nonce}`.
- Plaintext: canonical JSON of the payload (10.3) followed by ASCII spaces (0x20) to **exactly 65536 bytes**. The
  receiver requires the prefix to be the canonical form and the rest to be spaces. Ciphertext is therefore always
  65552 bytes (87403 base64url characters) and the HTTP body length is constant for every `delivered` answer.
- The answer signature (`signing.sign`, pairing HMAC) covers the header fields only, never the ciphertext, so no
  digest is ever computed over anything derived from a value. The AEAD tag authenticates the ciphertext under a
  one-time key over padded plaintext; it is not a hash of a value and reveals neither content nor length (owner
  confirmation requested, P3).
- `b`, `a`, `Z`, `key` live only for the duration of one fetch and are dropped (Python cannot guarantee zeroization;
  lifetime minimization is the control).
- Libraries: add-on `cryptography>=45,<51` (already in `requirements.txt`); bridge uses `cryptography` as shipped
  with Home Assistant core (manifest `requirements` stays empty; a drift test pins the import).

### 6.6 Interface offered to WisKey (in-process, Arx-owned)

```python
class CarrierUnavailable(Exception):
    """Raised with no message and no chained cause. WisKey maps it to Refusal('binding_denied')."""

class PrivateCarrier:  # provided by smplwise_bridge; bound to one config entry; revoked on unload/reload
    async def fetch(self, descriptor: Mapping) -> "CarrierPayload": ...
        # descriptor = the frozen draft3 descriptor WisKey parsed (Request.descriptor).
        # At most once per request_id. Raises CarrierUnavailable on any failure. Never logs.

@dataclass(frozen=True, repr=False, slots=True)
class CarrierPayload:
    public_parameters: Mapping      # exactly WisKey catalog_profile(action).parameters shape
    private_parameters: Mapping     # non-empty subset of {employee_no, phone, pin, cards, photo}, disjoint from public data
```

The capability is handed to WisKey's composition as a Python object (never through JSON, a service, an event or
`hass.data` under a guessable key), in the same manner as the verifier (`AuthenticatedDescriptor`). Which component
registers `trusted_operation` and composes `CandidateHost` is an open, recorded contradiction (section 17, K1); the
carrier client lives in `smplwise_bridge` in every case because only it holds the pairing secret.

### 6.7 Consumption at WisKey (requirements, not WisKey code)

WisKey's preparer for `users/create|update` under the agreed transport: calls `fetch` exactly once after admission;
builds `PreparedOperation` from `public_parameters`; issues `private_parameters` into `MemorySourceInputs` for the
same request (B2) at the point where an `EngineContext` exists; discards on any refusal or expiry; never logs,
serializes, persists, projects or puts the payload in an exception, event, entity state or attribute; keeps
`owner`/`generation` internal (C2).

## 7. Lifetimes and TTLs

| Object | Where | Born | Dies (earliest of) | Max |
|---|---|---|---|---|
| Carrier slot (values) | add-on memory | step 6, just before the service call | first valid fetch; signed `request_expires_at` (monotonic deadline); service-call return; pairing change; process exit | 15 s (draft3 cap, C10) |
| Witness `fetched` flag | add-on memory | step 13 | classification after the service call returns | the call's duration |
| Reference tombstone | add-on memory | step 6 | `deadline + 120 s` | 135 s (reference only) |
| Verified record (`S`, descriptor; no values) | bridge memory | stage 7 pass | fetch; `request_expires_at`; unload | 15 s |
| Ephemeral keys `b`, `a`, `Z`, `key` | bridge / add-on memory | fetch | end of the fetch | fetch timeout 3 s |
| Decrypted payload | bridge memory | step 15 | return to preparer | milliseconds |
| Private item | WisKey `MemorySourceInputs` | issue | consume; `request_expires_at`; refusal; close (B4) | 15 s |
| Fetch request validity | add-on | fetch `ts` | 60 s HMAC window, bounded in practice by the slot deadline | 15 s effective |

Timeouts: Arx -> HA service call 15 s (as `call_bridge_*`); bridge -> add-on fetch 3 s; Arx must send the service
call within 1 s of signing (else abort, `not_sent`, slot destroyed). The request lifetime is set to the draft3
maximum (15 s) because WisKey re-checks it at every await (F12) and the save must finish inside it.

## 8. Single-use and replay rules

1. A `parameter_reference` is issued once (UUIDv4) and refused by `arm()` if seen within the tombstone period.
2. A slot is delivered at most once; `take()` pops before comparing; a second fetch gets `not_available`.
3. A fetch nonce is refused if seen (existing `ha_bridge.verify` memory); a replayed fetch is useless anyway because
   the answer is encrypted to the original one-time key `b`, which no longer exists.
4. A replayed or forged answer fails: wrong echo of `bridge_public_key` / ids, bad header signature, or AEAD failure
   under a key derived from a destroyed `b`.
5. The bridge allows one fetch per verified `request_id`; WisKey allows one bind per `parameter_reference`
   (`ImmutableResolver`) and one consume per item (`MemorySourceInputs`).
6. After a possible dispatch with unknown outcome there is no re-send of anything (B4): the slot is gone, the
   reference is tombstoned, a new user action is a new request with a new reference.
7. No automatic fallback from carrier to W2 for the same user action.

## 9. Failure modes

Classification rule (Arx): **witness not `fetched` => no effect is possible** (F2, F3), so the outcome is `not_sent`
even when the service call itself timed out. Witness `fetched` and no closed answer => `unknown` (504
`intercom_outcome_unknown`), never retried; a later `users/get` (existing READ) reconciles. Closed WisKey refusal
answers keep their existing W2 mapping (409/404/422/503).

| # | Situation | Witness | Arx outcome | Values left behind |
|---|---|---|---|---|
| 1 | Local validation / capacity / route not eligible | - | `not_sent` (422 / 503) or W2 | none (never armed) |
| 2 | HA unreachable before the request left | armed | `not_sent`; slot destroyed | none |
| 3 | Bridge refuses at stages 1-7 | armed | `rejected` -> `not_sent` | slot destroyed at return |
| 4 | WisKey refuses before the preparer (replay, binding, admission) | armed | `not_sent` | slot destroyed |
| 5 | Fetch refused (`not_available`, `carrier_off`) | gone / armed | WisKey preparer refuses -> `{"error":"Unauthorized"}` -> `not_sent` | none |
| 6 | Fetch transport error / 3 s timeout | fetched or armed | preparer refuses (F2) -> `not_sent` if a closed answer arrives; `unknown` only if the service call answer is also lost and witness = fetched | none in add-on; bridge drops |
| 7 | Service call times out after a delivered fetch (`sent_unknown`) | fetched | `unknown`; status via the generalized status service when it exists; `users/get` | none |
| 8 | WisKey answers `sent_unknown` / uncertain certainty | fetched | `unknown`, never re-sent | none |
| 9 | Add-on restarts between arm and fetch | gone (lost) | the in-flight HA call continues, fetch -> `not_available` -> WisKey refuses; the attempt row without an outcome is shown as unknown until `users/get` (existing W2 rule) | none (memory gone) |
| 10 | Add-on restarts after fetch | lost | as 9; `users/get` reconciles | none |
| 11 | HA / bridge / WisKey restarts mid-flight | armed or fetched | transport error -> rule above | add-on slot expires <= 15 s |
| 12 | Pairing regenerated mid-flight | gone | fetch HMAC fails -> `not_sent` | slots dropped by repair hook |
| 13 | Actor's permission revision changes between sign and fetch | gone | `not_available` -> `not_sent` | slot destroyed |
| 14 | Clock: wall clock jumps | - | slot deadline is monotonic; signed times use wall clock and are checked by the bridge and WisKey | - |

`sent_unknown` sequence:

```
Arx add-on            HA/bridge               WisKey                 add-on route
  | call S (15 s) ------>|-------------------->| preparer -> fetch --->| delivered (witness=fetched)
  |                      |                     | apply: consume, save  |
  |   (timeout) X        |                     |  ...answer lost...    |
  | witness=fetched => outcome UNKNOWN (504), no re-send, slot already gone
  | operator later sees the person via users/get; a new edit = new request + new reference
```

Restart before fetch:

```
Arx add-on (dies after step 8)      HA/bridge            WisKey             add-on (restarted)
  | call S ------------------------>|------------------->| fetch ---------->| no slot -> refused not_available
  X                                 |<-- Unauthorized ---| (no dispatch)    |
  (restarted: attempt row has no outcome -> shown "unknown" until users/get; WisKey did not write: F3)
```

## 10. New messages: closed JSON Schemas and synthetic examples

All three messages are Arx-internal (add-on <-> Arx bridge). Draft 2020-12, `additionalProperties: false` at every
level. Byte limits that a schema cannot state are listed under each schema and enforced by the reference validator.
Examples use synthetic values only.

### 10.1 `private_carrier_fetch.request` (bridge -> add-on)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:smplwise:arx:private-carrier:v1:fetch-request",
  "type": "object",
  "additionalProperties": false,
  "required": ["protocol", "purpose", "action", "request_id", "parameter_reference", "signed_message_json",
               "bridge_public_key", "ts", "nonce", "sig"],
  "properties": {
    "protocol": {"const": "smplwise-private-carrier-v1"},
    "purpose": {"const": "private_carrier_fetch"},
    "action": {"enum": ["users/create", "users/update"]},
    "request_id": {"type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"},
    "parameter_reference": {"type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"},
    "signed_message_json": {"type": "string", "minLength": 2, "maxLength": 8192},
    "bridge_public_key": {"type": "string", "pattern": "^[A-Za-z0-9_-]{43}$"},
    "ts": {"type": "integer", "minimum": 1767225600, "maximum": 9007199254740991},
    "nonce": {"type": "string", "pattern": "^[0-9a-f]{32}$"},
    "sig": {"type": "string", "pattern": "^[0-9a-f]{64}$"}
  }
}
```

Validator rules: `signed_message_json` at most 8192 UTF-8 bytes; `request_id` and `parameter_reference` equal the
values inside the parsed `signed_message_json`; the whole body at most 12288 bytes; `sig` per `signing.sign`.

Synthetic example (the inner string abbreviated where marked):

```json
{
  "protocol": "smplwise-private-carrier-v1",
  "purpose": "private_carrier_fetch",
  "action": "users/update",
  "request_id": "00000000-0000-4000-8000-000000000001",
  "parameter_reference": "00000000-0000-4000-8000-0000000000a1",
  "signed_message_json": "{\"contract_version\":\"wiskey-arx-generalized-w1-draft.3\", ...ABBREVIATED... }",
  "bridge_public_key": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "ts": 1791028800,
  "nonce": "0123456789abcdef0123456789abcdef",
  "sig": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

### 10.2 `private_carrier_fetch.answer` (add-on -> bridge)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:smplwise:arx:private-carrier:v1:fetch-answer",
  "$defs": {
    "uuid4": {"type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"},
    "ts": {"type": "integer", "minimum": 1767225600, "maximum": 9007199254740991},
    "nonce": {"type": "string", "pattern": "^[0-9a-f]{32}$"},
    "sig": {"type": "string", "pattern": "^[0-9a-f]{64}$"}
  },
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["protocol", "result", "request_id", "parameter_reference", "bridge_public_key", "addon_public_key",
                   "aead_nonce", "ciphertext", "ts", "nonce", "sig"],
      "properties": {
        "protocol": {"const": "smplwise-private-carrier-v1"},
        "result": {"const": "delivered"},
        "request_id": {"$ref": "#/$defs/uuid4"},
        "parameter_reference": {"$ref": "#/$defs/uuid4"},
        "bridge_public_key": {"type": "string", "pattern": "^[A-Za-z0-9_-]{43}$"},
        "addon_public_key": {"type": "string", "pattern": "^[A-Za-z0-9_-]{43}$"},
        "aead_nonce": {"type": "string", "pattern": "^[A-Za-z0-9_-]{16}$"},
        "ciphertext": {"type": "string", "minLength": 87403, "maxLength": 87403, "pattern": "^[A-Za-z0-9_-]+$"},
        "ts": {"$ref": "#/$defs/ts"},
        "nonce": {"$ref": "#/$defs/nonce"},
        "sig": {"$ref": "#/$defs/sig"}
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["protocol", "result", "request_id", "code", "ts", "nonce", "sig"],
      "properties": {
        "protocol": {"const": "smplwise-private-carrier-v1"},
        "result": {"const": "refused"},
        "request_id": {"$ref": "#/$defs/uuid4"},
        "code": {"enum": ["not_available", "carrier_off"]},
        "ts": {"$ref": "#/$defs/ts"},
        "nonce": {"$ref": "#/$defs/nonce"},
        "sig": {"$ref": "#/$defs/sig"}
      }
    }
  ]
}
```

Validator rules: `sig` covers every key except `ciphertext`, `ts`, `nonce`, `sig`; the echoed `request_id`,
`parameter_reference` and `bridge_public_key` equal the fetch; transport-level failures (401 / 404 / 5xx from steps
1-3 of 6.4) carry no body the bridge reads.

Synthetic examples:

```json
{"protocol": "smplwise-private-carrier-v1", "result": "refused", "request_id": "00000000-0000-4000-8000-000000000001",
 "code": "not_available", "ts": 1791028801, "nonce": "fedcba9876543210fedcba9876543210",
 "sig": "1111111111111111111111111111111111111111111111111111111111111111"}
```

```json
{"protocol": "smplwise-private-carrier-v1", "result": "delivered",
 "request_id": "00000000-0000-4000-8000-000000000001", "parameter_reference": "00000000-0000-4000-8000-0000000000a1",
 "bridge_public_key": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
 "addon_public_key": "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
 "aead_nonce": "CCCCCCCCCCCCCCCC", "ciphertext": "<87403 base64url characters - ABBREVIATED>",
 "ts": 1791028801, "nonce": "00112233445566778899aabbccddeeff",
 "sig": "2222222222222222222222222222222222222222222222222222222222222222"}
```

(The `delivered` example is abbreviated and therefore not schema-valid as printed; the golden vectors of the build
phase are generated by the reference validator, as for `GOLDEN_VECTORS_v3.json`.)

### 10.3 `private_carrier.payload` (the decrypted plaintext, before padding)

`public_parameters` mirrors WisKey's closed profile at `4a763462` (F9) exactly; a drift test compares it with
`catalog_profile(action).parameters` at build time. `private_parameters` bounds mirror Arx's own validators of the
same WisKey fields (`routers/access_control.py` `PersonData` / `CardData`, `intercom_writes.photo_value`); WisKey's own
closed bounds are still missing (W-M7).

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:smplwise:arx:private-carrier:v1:payload",
  "$defs": {
    "uuid4": {"type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"},
    "dt": {"type": ["string", "null"], "format": "date-time"},
    "public_data_props": {
      "display_name": {"type": "string", "minLength": 1, "maxLength": 32, "pattern": "^[^\\x00-\\x1f]*$"},
      "active": {"type": "boolean"},
      "valid_from": {"$ref": "#/$defs/dt"},
      "valid_until": {"$ref": "#/$defs/dt"},
      "group_ids": {"type": "array", "maxItems": 64, "uniqueItems": true,
                    "items": {"type": "string", "pattern": "^[a-z][a-z0-9_]{0,47}$"}}
    },
    "create_data": {
      "type": "object", "additionalProperties": false, "required": ["display_name"],
      "properties": {
        "display_name": {"$ref": "#/$defs/public_data_props/display_name"},
        "active": {"$ref": "#/$defs/public_data_props/active"},
        "valid_from": {"$ref": "#/$defs/public_data_props/valid_from"},
        "valid_until": {"$ref": "#/$defs/public_data_props/valid_until"},
        "group_ids": {"$ref": "#/$defs/public_data_props/group_ids"}
      }
    },
    "patch_data": {
      "type": "object", "additionalProperties": false, "minProperties": 1,
      "properties": {
        "display_name": {"$ref": "#/$defs/public_data_props/display_name"},
        "active": {"$ref": "#/$defs/public_data_props/active"},
        "valid_from": {"$ref": "#/$defs/public_data_props/valid_from"},
        "valid_until": {"$ref": "#/$defs/public_data_props/valid_until"},
        "group_ids": {"$ref": "#/$defs/public_data_props/group_ids"}
      }
    },
    "card": {
      "type": "object",
      "additionalProperties": false,
      "required": ["label", "card_type", "enabled"],
      "properties": {
        "id": {"type": "string", "format": "uuid", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"},
        "card_no": {"type": "string", "pattern": "^[A-Za-z0-9_-]{1,32}$"},
        "label": {"type": "string", "maxLength": 64, "pattern": "^[^\\x00-\\x1f]*$"},
        "card_type": {"const": "normalCard"},
        "enabled": {"type": "boolean"}
      },
      "oneOf": [{"required": ["id"], "not": {"required": ["card_no"]}},
                {"required": ["card_no"], "not": {"required": ["id"]}}]
    },
    "private": {
      "type": "object",
      "additionalProperties": false,
      "minProperties": 1,
      "properties": {
        "employee_no": {"type": "string", "pattern": "^[A-Za-z0-9_-]{1,32}$"},
        "phone": {"type": ["string", "null"], "maxLength": 32, "pattern": "^\\+?[0-9 ()-]+$"},
        "pin": {"type": ["string", "null"], "pattern": "^[0-9]{1,128}$"},
        "cards": {"type": "array", "maxItems": 255, "items": {"$ref": "#/$defs/card"}},
        "photo": {"type": ["string", "null"], "maxLength": 44000, "pattern": "^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$"}
      }
    }
  },
  "type": "object",
  "additionalProperties": false,
  "required": ["protocol", "request_id", "parameter_reference", "action", "public_parameters", "private_parameters"],
  "properties": {
    "protocol": {"const": "smplwise-private-carrier-v1"},
    "request_id": {"$ref": "#/$defs/uuid4"},
    "parameter_reference": {"$ref": "#/$defs/uuid4"},
    "action": {"enum": ["users/create", "users/update"]},
    "public_parameters": {"type": "object"},
    "private_parameters": {"$ref": "#/$defs/private"}
  },
  "allOf": [
    {
      "if": {"properties": {"action": {"const": "users/create"}}},
      "then": {"properties": {"public_parameters": {
        "type": "object", "additionalProperties": false, "required": ["data"],
        "properties": {
          "data": {"$ref": "#/$defs/create_data"},
          "sync_now": {"type": "boolean"}}}}}
    },
    {
      "if": {"properties": {"action": {"const": "users/update"}}},
      "then": {"properties": {"public_parameters": {
        "type": "object", "additionalProperties": false, "required": ["user_id", "revision", "data"],
        "properties": {
          "user_id": {"type": "string", "format": "uuid"},
          "revision": {"type": "integer", "minimum": 1},
          "data": {"$ref": "#/$defs/patch_data"},
          "sync_now": {"type": "boolean"}}}}}
    }
  ]
}
```

(`public_data_props` is a plain container of subschemas reached only through JSON Pointer `$ref`s.) Validator rules
(beyond the schema): `valid_from` and `valid_until` are set together (Arx `PersonData` rule); the
private keys are disjoint from `public_parameters.data` keys (the WisKey rule in `source_mutations.py`); `photo`
decodes to a JPEG of at most 32768 bytes and 1..512 x 1..512 (`photo_value`); `phone` has 7..15 digits; card numbers
and ids are unique within `cards`; `request_id` / `parameter_reference` equal the fetch; canonical form at most 65536
bytes.

Synthetic example (valid):

```json
{
  "protocol": "smplwise-private-carrier-v1",
  "request_id": "00000000-0000-4000-8000-000000000001",
  "parameter_reference": "00000000-0000-4000-8000-0000000000a1",
  "action": "users/update",
  "public_parameters": {
    "user_id": "00000000-0000-4000-8000-0000000000b1",
    "revision": 7,
    "data": {"display_name": "Synthetic Person"},
    "sync_now": false
  },
  "private_parameters": {
    "phone": "000-0000000",
    "pin": "000000",
    "cards": [{"card_no": "SYNTH0001", "label": "test", "card_type": "normalCard", "enabled": true}]
  }
}
```

Invalid synthetic examples (one defect each) to seed the vectors: private key `card_no` at top level (unknown key);
`private_parameters` empty; `phone` both in `data` and in private (disjointness); `action` `users/set_active`;
`revision` `true` (bool, exact-type rule); a card with both `id` and `card_no`.

## 11. What each side must implement

### 11.1 Arx add-on (Arx)

- `services/private_carrier.py`: `CarrierSlots` (6.3), the payload builder and splitter, padding, encryption,
  `witness()`, tombstones, sweeper, repair hook; no logging except fixed code-only messages.
- `routers/ha.py`: `POST /ha/bridge/private_carrier` (6.4); excluded from request-body logging and from any debug
  middleware; Ingress requests refused.
- Person write routes (`routers/access_control.py`, `routers/access_control_writes.py`): route selection (6.2),
  arming, the generalized signer call, classification with the witness (section 9), audit `transport` and
  `carrier_witness` names only; unchanged W2 path when not eligible.
- Settings: `access.private_carrier` (default `off`, system administrator, audited); build constant
  `CARRIER_GO_LIVE_PERMITTED = False`; `MIN_BRIDGE_FOR_CARRIER = None` until the bridge exists.
- Reference validator + golden vectors for 10.1-10.3 (generated, synthetic), mirroring `tests/lease_contract.py`.
- Prerequisite (not part of B8): the draft3 signer and the `trusted_operation` call path.

### 11.2 Arx bridge `smplwise_bridge` (Arx)

- `carrier_client.py`: `PrivateCarrier`, `CarrierPayload`, `CarrierUnavailable` (6.4-6.6); one aiohttp POST via
  `async_get_clientsession`, 3 s, no retry; X25519/HKDF/ChaCha20-Poly1305 from `cryptography`.
- `VerifiedRecords` in the generalized verifier: request_id -> (`S`, frozen descriptor, expires); single take.
- Options flow switch "private carrier" (default off, changed only inside HA by an HA administrator, like
  "delegated authoring"); state travels to the add-on in the directory push (`private_carrier: true|false`).
- Capability hand-off to WisKey's composition (in-process object), revoked on unload/reload.
- Version bump (0.10.x) and a drift test of shared constants against the add-on (as `service_identity`).

### 11.3 WisKey (requests to WisKey; section 16 lists what is missing today)

- A preparer for `users/create|update` that calls `PrivateCarrier.fetch(request.descriptor)` exactly once after
  admission and maps `CarrierUnavailable` to `Refusal('binding_denied')`.
- `PreparedOperation` from `public_parameters`; `MemorySourceInputs.issue` with `private_parameters` for the same
  request at the `EngineContext` point; discard on refusal/expiry; no persistence or logging (6.7).
- The decisions W-M3 .. W-M8.

## 12. Security analysis

### 12.1 Assets and actors

Assets: the five private values; the public person parameters; the pairing secret. Actors: Arx operator (browser);
an HA administrator or any WebSocket client allowed to subscribe to events; another add-on or host process able to
observe the Supervisor's internal network; a compromised or buggy component on either side; an attacker replaying
captured traffic; a later reader of backups, recorder DB, logs or diagnostics.

### 12.2 Threats and controls

| Threat | Control |
|---|---|
| Value read from HA service data, event bus, logbook, recorder, `subscribe_events` | value never in service data or events; only the signed descriptor (no values) is a service call |
| Value read from HA state machine / entity attributes / diagnostics | the carrier creates no entity, state, attribute, `hass.data` store or diagnostics; WisKey must not reflect values (6.7) |
| Passive sniffing of the internal HTTP hop | AEAD under a one-time ECDH key; constant length |
| Active MITM on the internal hop (substitute add-on key or answer) | fetch and answer header signed with the pairing secret; HKDF salt derived from the pairing secret; `bridge_public_key` echo |
| Pairing secret leaks later; old captures decrypted | forward secrecy: ECDH ephemerals are destroyed after each fetch |
| Replay of a fetch to get the value again | slot single-use; nonce memory; answer useless without the destroyed `b` |
| A different request (or a modified one) claims the reference | byte equality of the whole `signed_message_json` at the add-on; descriptor equality at the bridge and at WisKey |
| Browser or Ingress client calls the route | Ingress headers refused; pairing HMAC required |
| Existence / timing oracle on references | one refusal code `not_available` for every miss; constant-length delivered answers |
| Value in logs / exceptions | fixed code-only log messages; `raise ... from None`; repr-less, unpicklable payload objects; no `logging.exception` in carrier code |
| Value in Arx DB / WAL / audit / backups | slots memory-only; audit keeps names, `transport`, `carrier_witness`; DB/WAL byte scans in tests |
| Length leak | padding to 65536 bytes; no `len()` of a value logged or audited; no digest over plaintext |
| Authority changed between decision and use | add-on re-checks permission revision/epochs at fetch; WisKey re-checks binding at every await |
| Orphaned values | 15 s monotonic deadline, sweeper, repair hook, process exit |
| Downgrade to an older bridge without the carrier | min bridge version + bridge switch state required (6.2); else W2 |
| Mis-delivery to a non-preparer component | capability object given only to WisKey's composition, bound to the config entry, single fetch per verified request |

### 12.3 Leak surfaces, including the HA recorder

| Surface | Carrier exposure |
|---|---|
| HA service data of `trusted_operation` | descriptor only (ids, reference UUID, revisions); no values (same as the agreed draft3 design) |
| HA event bus `call_service`, logbook, recorder `events` table | Home Assistant fires `call_service` with the service data. Whether the recorder of HA 2026.9.4 persists it by default was **not verified (NOT_RUN)**; the design assumes the worst case (persisted and visible to every event subscriber), which is why no value, ciphertext or value-derived byte may ever be service data |
| HA state machine, entity attributes, recorder `states` | none (no entity is created) |
| HA logs / `system_log` | code-only messages; aiohttp does not log bodies; the bridge never logs payloads, URLs with values or exception text |
| HA diagnostics download | the bridge offers none; must stay so |
| Supervisor proxy logs (add-on -> HA) | no bodies |
| Supervisor internal network | ciphertext of constant length |
| Arx add-on: uvicorn access log | method, path, status (no body, no size field in the default format) |
| Arx add-on: SQLite + WAL, audit, `ApiError.details` | none (names only; tests scan DB/WAL bytes for sentinels) |
| Process memory, swap, core dumps | values live <= 15 s; Python cannot zeroize; residual risk accepted equal to W2 |
| WisKey memory and storage | WisKey's responsibility after consume (its repository stores the person record as today under W2) |

### 12.4 Residual risks

- A compromised HA core or add-on process can read values in memory (same as W2 today).
- The pairing secret is the root of authentication for both the request (HMAC) and the carrier; its rotation is the
  CR-034 extension point; regeneration drops every slot.
- The recorder question in 12.3 remains NOT_RUN; it does not affect the carrier (no value on the bus) but should be
  answered for the descriptor itself before go-live.

## 13. Test plan (negative first, fakes only)

Fakes: `FakeCarrierRoute` (the add-on route on an in-process ASGI client), `FakeBridgeCarrierClient` (real client
code against the fake route), `FakeWisKeyPreparer` (models F2-F4 semantics: admission before fetch, consume before
store write; not WisKey code), `FakeHaBus` capturing every `call_service` / event / state write, `FakeRecorder`,
a fake monotonic and wall clock. Sentinels are synthetic (for example pin `90210417`, phone `000-1234567`, card
`SENTINELCARD01`).

Negative (each must be red before the implementation):

| ID | Case | Expected |
|---|---|---|
| N01 | carrier off (setting, build constant, bridge switch, old bridge) | W2 path, nothing armed, route answers `carrier_off` / 404 |
| N02 | fetch without / with wrong HMAC, stale `ts`, 16-hex nonce | 401, slot untouched |
| N03 | replayed fetch nonce | 401 replay |
| N04 | unknown / expired / consumed reference | `not_available`, same bytes shape for all three |
| N05 | `signed_message_json` differs by one byte; `request_id` or `action` differs | `not_available`, slot destroyed |
| N06 | second fetch after delivery; two concurrent fetches | exactly one `delivered` |
| N07 | fetch after deadline (fake monotonic clock) | `not_available`; sweeper removed it |
| N08 | permission revision bumped between sign and fetch | `not_available`, slot destroyed, outcome `not_sent` |
| N09 | request through Ingress headers | 404 |
| N10 | tampered answer: ciphertext bit, nonce, `addon_public_key`, header field, echo mismatch, all-zero ECDH | `CarrierUnavailable`, preparer refuses, no dispatch |
| N11 | replay of an old `delivered` answer | `CarrierUnavailable` |
| N12 | plaintext: unknown key, empty private, overlap with public `data`, bad padding, wrong action, bool revision | `CarrierUnavailable` |
| N13 | bridge capability after unload; fetch for a descriptor not verified; second fetch for one request_id | `CarrierUnavailable` |
| N14 | RBAC: missing `access.people.sensitive`, automation actor, internal principal, out-of-scope station | refused before arming (403 / W2 rules), nothing armed |
| N15 | capacity (17th slot, 3rd per actor) | 503 `intercom_busy`, `not_sent` |
| N16 | add-on restart before fetch; after fetch | `not_sent`; `unknown` |
| N17 | service call timeout with witness armed / fetched | `not_sent` / `unknown`; no re-send; no W2 fallback |
| N18 | pairing regenerated with armed slots | slots gone; fetch 401 |
| N19 | leak scan across N01-N18 and P01-P04: logs (caplog, all levels), audit rows, DB + WAL + SHM bytes, `ApiError` texts, exception strings and `repr`, access log, `FakeHaBus` (service data, events, states, attributes), `FakeRecorder` | no sentinel anywhere; only service data present is the descriptor |
| N20 | length: delivered answers for a one-key payload and a maximal payload | identical body length; no log line contains a number taken from a value |
| N21 | log template allow-list | every carrier log record uses a fixed template with a code argument only |

Positive: P01 create with phone + pin; P02 update with cards (new by `card_no`, saved by `id`); P03 update with a
synthetic 1 x 1 JPEG photo plus a public key (until W-M5); P04 `users/get` after success feeds the editor projection
(B7). Contract: 10.1-10.3 golden vectors (accept + one-defect reject) through the reference validator; drift tests
bridge vs add-on constants and payload schema vs WisKey profile. Regression: the whole existing W2 suite unchanged
with the carrier off. Everything here is PLANNED, NOT_RUN.

## 14. Migration, rollout, rollback

| Phase | Content | Gate |
|---|---|---|
| R0 | this design approved | owner (P1, P3) |
| R1 | Arx build, everything OFF: add-on module + route + settings, bridge 0.10.x client + switch, vectors, fakes, tests | owner implementation permit (P1); Arx gate green |
| R2 | joint fake integration with WisKey's preparer (W-M1 .. W-M6 resolved), still OFF | WisKey delivery; no live system |
| R3 | lab TEST with a synthetic person, `sync_now: false` | owner permits P4, P5 |
| R4 | go-live: flip `CARRIER_GO_LIVE_PERMITTED` in a commit carrying the owner's written permit; enable per installation | owner permit P6 |

Rollback: switch `access.private_carrier` off (or the bridge switch); requests return to W2 immediately. No data
migration exists because nothing is stored. Bridge downgrade below the carrier version makes Arx select W2 (6.2).
W2 is never removed by this design; requests not eligible (6.2) keep using it after R4 unless the owner decides
otherwise (P7).

## 15. Owner permits and decisions needed (none is requested as granted here)

| # | Permit / decision |
|---|---|
| P1 | Implementation permit for the Arx add-on and bridge changes of section 11, OFF by default, fakes only |
| P2 | Acceptance of the new internal add-on route and the bridge's outbound call to it (a new network surface on the existing channel) |
| P3 | Approval of the cryptographic choice (6.5) and of the reading that an AEAD tag / constant-length ciphertext over padded plaintext under a one-time key is not a "hash or length of a sensitive value" (C5) |
| P4 | Installing bridge 0.10.x into the lab Home Assistant (a write to the HA config directory) |
| P5 | A lab TEST run creating / updating one synthetic person in WisKey (writes to WisKey storage; `sync_now: false` so no station write) |
| P6 | Go-live permit (build constant flip, per-installation enable) |
| P7 | Whether W2 stays available after go-live for requests the carrier does not cover (recommended: yes) |

## 16. WisKey fields and files still missing (facts at `4a763462`; nothing invented)

| ID | Missing | Evidence |
|---|---|---|
| W-M1 | A production caller of `MemorySourceInputs.issue` and the preparer for `users/create|update` that obtains the payload and issues it at the `EngineContext` point; `PreparedOperation` has no place for private values today | `source_inputs.py`; callers only in `tests/trusted_actions/test_all_open.py`, `synthetic_card_fixture.py`; `host.py` `PreparedOperation(parameters, expires, resolved_target)` |
| W-M2 | Who registers the generalized services (`smplwise_bridge.trusted_operation` / `_status`, proposed names) and composes `CandidateHost` with the injected verifier, preparer and carrier capability | `host.py` "never registers a service"; `BINDING_TRANSPORT_AUTHENTICITY.draft3.json` "NOT_PROVEN: actual generalized services/bridge handoff" |
| W-M3 | The source of the **public** parameters for the preparer (draft3 has no body). This design proposes `public_parameters` in the carrier payload; WisKey to confirm or name another source | `GENERALIZED_W1_ENVELOPE.draft3.schema.json` `x-typed-parameter-boundary` |
| W-M4 | Eight W2 public fields absent from WisKey's closed public schema for `users/create|update`: `permission_overrides`, `door_permissions`, `access_policy_revision`, `access_category`, `responsible_person`, `access_purpose`, `access_timing_draft`, `access_timing_policy` (B6 says they stay public) | `profiles.py` `public_edit_fields` = display_name, active, valid_from, valid_until, group_ids |
| W-M5 | A private-only `users/update` (for example phone only, or the photo route `data{photo}`) cannot be expressed: `patch_data` has `minProperties: 1` and private keys must be disjoint from `data` | `profiles.py` `patch_data`; `source_mutations.py` disjointness check |
| W-M6 | With the carrier composed, `users/set_active` is refused and `users/create|update` without a private value or under `closed_public_parameters` are refused; WisKey to decide (two receivers, or relaxed rules) | `source_mutations.py` `apply` |
| W-M7 | WisKey's own closed bounds for `employee_no`, `phone`, `pin`, `cards[]`, `photo` (W2 table: "data object: UNKNOWN nested schema"); 10.3 uses Arx's mirror of rc.37 | W2 rows `schema_known.request_nested` |
| W-M8 | The B6 choice (a / b) for `responsible_person` and `access_purpose` | `USER_CARRIER_POSITION.json` `missing_from_wiskey` |

## 17. Open items and recorded contradictions

| ID | Item | Owner |
|---|---|---|
| O1 | Owner decisions P1-P7 | owner |
| O2 | WisKey items W-M1 .. W-M8 | WisKey |
| O3 | Arx prerequisites not built: the draft3 signer for generalized operations and the `trusted_operation` call path (the generalized signer exists only on `pilot/LEASE-FIX` for the lease protocol) | Arx |
| O4 | The answer shape Arx classifies for `users/*` through `trusted_operation` (ACTION_RESULT draft3 + the six-field projection, B7) and the mapping of `{"error": "Unauthorized"}` from the ingress to `not_sent` | Arx + WisKey |
| O5 | Recorder behaviour of HA 2026.9.4 for `call_service` (12.3), NOT_RUN | Arx (read-only check, later) |
| K1 | Contradiction (recorded, not resolved): DTO v3 section 12 says Arx owns the bridge; CB05 row CB3-01 says the generalized bridge/resolver is WisKey's under permit; the W1 draft3 JSON says "WisKey specification; Arx bridge mapping under future permission". The carrier client is placed in `smplwise_bridge` either way (only it holds the pairing secret) | owner / CR |
| K2 | Arx treats `responsible_person` and `access_purpose` as sensitive (`intercom_writes.SENSITIVE_FIELDS`) while WisKey's private set excludes them (B6, pending W-M8) | WisKey |

## 18. Verification status

Read and cross-checked against code: all facts in section 3. Run: every JSON block in this document parses as JSON
(Python `json.loads`, 7/7). **NOT_RUN:** JSON Schema validation of the schemas and examples in section 10 (`jsonschema`
is not installed and was not installed), every test in section 13, any HA behaviour (12.3), any cryptographic code. No live system, device, runner,
token, key or secret was used. Examples are synthetic.
