# CR-WA-PACING-295 - the reservation port: wire, auth, lease and outcome contract (Arx side)

Status: Arx implements this contract with fakes (branch `pilot/WAPACE-295`; migration 0144, built as provisional 0150). WisKey has not built a client; nothing here
is live. Companion of `CR-WA-PACING-295.md` (budget, classes, counters) and WisKey's `whatsapp_pacing_status_v1` (counters, read by Arx).
Until WisKey adopts this contract for every shared sender, Arx reports `shared_budget_guaranteed: false`.

Words: MUST / MUST NOT bind WisKey's client; Arx's behaviour is the code in `services/wa_pacing.py` (`WaReservations`) and
`routers/messaging_accounts.py`, tested in `tests/test_wa_pacing.py`.

## 1. Scope: whose sends are reserved

- WisKey reserves a slot **only for a send it initiates itself** (an automation, a station, a door-event notice).
- WisKey MUST NOT reserve for a send it executes **at Arx's request** (`whatsapp/send` from the Arx people screen): Arx recorded it before asking
  (`intercom_messages`) and already counts it. Reserving it too would charge the same send twice.
- `wiskey_own.charged_*` in the status contract has the same scope (WisKey-initiated only).

## 2. Authentication (nothing new is invented)

What exists in the repo, and what it can carry:

| Mechanism | Direction | Usable here? |
|---|---|---|
| Bridge pairing secret + HMAC (`ha_bridge.sign/verify`, `/ha/bridge/ping`, `/directory`) | HA integration `smplwise` -> Arx | No: the secret belongs to Arx's own bridge; giving it to WisKey would make WisKey able to push directories and would be a new trust grant. |
| Trusted-caller signed messages (`trusted_caller`, `trusted_door`, `lease_events`, `capture_lease_route`) | Arx -> WisKey (through the bridge) | No: wrong direction. |
| WKPEER registry (`wiskey_peer_registry`) | Arx reads WisKey's binding of a querying principal | No: it authenticates WisKey's side to Arx's queries, off and fake-backed. |
| Ingress identity headers | human via the Supervisor proxy, trusted by peer address | No: WisKey is not a proxy. |
| **HA bearer token of an owner-created HA user on the remote channel** (`/arx/...`, `ha_user_auth.remote_principal`: validated against HA core, then Arx RBAC) | any caller holding a Long-Lived Access Token | **Yes - the only one.** |

Decision: WisKey authenticates as a **dedicated HA user created by the owner** (Arx never creates HA users, groups or tokens), with that user's
Long-Lived Access Token, calling `https://<host>/arx/api/v1/...`. Arx authorises it with a **custom role that holds only
`messaging.pacing.reserve`** (new permission, sensitive, in no built-in role, not implied by `messaging.accounts.manage`), bound at the installation
scope. The port refuses everything else: a holder of `messaging.accounts.manage` alone gets 403 on the port, and the port principal gets 403 on the pacing
settings and on every other route.

Requirements and limits, stated honestly:
1. The add-on option `remote_access` must be on (the `/arx` channel exists only then). **If the owner does not want that channel**, the smallest alternative is a
   relay through Arx's own bridge integration (a new bridge service call that signs with the existing pairing key and posts to a bridge-only route). That is a
   change in the bridge integration, not in this repo, and is NOT built or proposed for build now.
2. The principal MUST NOT be the configured service identity user (that user is refused at sign-in, `service_account`) and MUST NOT be an HA administrator.
   Enforced (F3B-295): a caller that holds an active `system_admin` binding or whose home-system `is_admin` flag is set is refused 403 `port_principal_forbidden` on the three port routes (audited, reason `system_admin_not_allowed` / `ha_admin_not_allowed`). The permission stays in no role.
3. Never in a log or document: the token. Arx stores none (it is validated against HA and cached in memory only).
4. WisKey keeps and reuses the token; repeated failed validation hits Arx's sign-in rate limit (`rate_limited` 429).
5. On a fresh installation the first caller to reach Arx is bootstrapped as system administrator (`maybe_bootstrap`); this installation is already bootstrapped.

## 3. Wire format

Base: `/api/v1` (on the remote channel `/arx/api/v1`). JSON in and out, UTF-8. `Authorization: Bearer <token>`. Times are UTC ISO-8601 with `Z`.
`request_id`: 8-128 characters of `[A-Za-z0-9_.:-]`, **chosen by WisKey, unique per send**, the idempotency key. Reusing a `request_id` with a different `sender_ref` or `class` than its first `reserve` is refused (`granted: false`, `reason: request_id_conflict`) and charges nothing; a true repeat keeps its meaning.
`sender_ref`: WisKey's opaque sender id, bound to an Arx account by the administrator (`senders` map in the pacing settings). A `sender_ref` Arx does not
know is denied `sender_unknown`.
`class`: `alert | code | ticket | reminder` (the shares in `CR-WA-PACING-295.md`; an operational alert is admitted through backoff and throttle, counted).

### 3.1 `POST /messaging/whatsapp/pacing/reserve`

Request: `{"sender_ref": "...", "class": "alert", "request_id": "wk-2026-10-21-000123"}` - no other field (422 on extras).

Granted (HTTP 200): `{"granted": true, "repeated": false, "lease": {"request_id": "...", "expires_at": "2026-10-21T10:01:00.000Z"}}`.
Denied (HTTP 200): `{"granted": false, "reason": "<code>", "retry_after_s": 12}` - `retry_after_s` is null when retrying cannot help.

| `reason` | Meaning | `retry_after_s` |
|---|---|---|
| `burst`, `minute`, `hour`, `day` | the window for this class is full (account total, Arx senders + WisKey) | seconds until a slot frees (>= 1) |
| `backoff` | the provider slowed the account (ladder 60 s .. 30 min) | until the backoff ends |
| `wiskey_throttle` | WisKey's own verified `throttled_until` is in force | until then |
| `sender_unknown` | `sender_ref` not mapped to an Arx account | null |
| `class_unknown` | `class` is not one of the four | null |
| `lease_ceiling` | the port principal already holds its share (50 % of each window's cap, counted leases only, any class, any mode) or 20 live leases on the account | seconds until a slot frees (>= 1) |
| `already_released` | this `request_id` was settled; use a new one | null |
| `lease_expired` | this `request_id`'s lease ran out unreleased; use a new one (and release the old id) | null |

A denial is a decision, not a failure, so it is HTTP 200. With the budget mode `off` every well-formed reserve is granted (the lease is still recorded).

### 3.2 `POST /messaging/whatsapp/pacing/release`

Request: `{"request_id": "...", "outcome": "accepted_by_provider", "slowdown": {"scope": "account", "retry_after_s": 90}}` - `slowdown` optional.
Response (HTTP 200): `{"released": true, "repeated": false, "outcome": "accepted_by_provider", "late": false, "conflict": false}`, or
`{"released": false, "reason": "unknown_request | outcome_unknown | slowdown_invalid"}`.

### 3.3 `GET /messaging/whatsapp/pacing/lease/{request_id}` (reconciliation)

`{"found": false}` or `{"found": true, "state": "granted | expired | released", "outcome": null | "<outcome>", "counted": true, "class": "ticket",
"granted_at": "...", "expires_at": "..."}`. `expired` = past `expires_at` with no release yet (still counted).

### 3.4 HTTP statuses (not decisions)

| Status | `error.code` | When |
|---|---|---|
| 200 | - | every decision above, granted or denied, released or not |
| 401 | `unauthenticated` | no / invalid token |
| 403 | `forbidden` | token valid, principal lacks `messaging.pacing.reserve` (audited) |
| 404 | `not_found` | the remote channel is off |
| 422 | `validation` | malformed body, `request_id` pattern, extra fields, `retry_after_s` < 1 or > 86400 |
| 429 | `rate_limited` | Arx's sign-in limiter (bad tokens) |
| 503 | - | Arx cannot validate the token against Home Assistant |

The error envelope is Arx's standard `{code, user_message, retryable, correlation_id, details}`. **Any 5xx, 429, timeout or transport failure is "Arx unreachable" for the
fail-open rule (section 7).** A 200 denial is never "unreachable".

## 4. Leases

- Default life **60 s**, set by the administrator (`lease_ttl_s`, 10-300 s). The maximum is **300 s**. Time is Arx's clock; `expires_at` is authoritative.
- A lease is an accounting reservation, granted for ONE send. It counts as a send from `granted_at`.
- **No renewal.** A send that cannot dispatch within its lease releases it (`expired` or `not_sent`) and reserves again with a new `request_id`.
- WisKey MUST NOT dispatch under a lease after `expires_at`. If it did dispatch, it releases `accepted_by_provider` or `unknown` (late, section 5).
- Reserving an expired or settled `request_id` is refused (`lease_expired`, `already_released`), never re-granted.
- A repeat of `reserve` for a live lease returns the same lease (`repeated: true`), counts once, and does not extend it.

## 5. Release outcomes and what they do to the counters

| `outcome` | Meaning (WisKey's proof) | The slot | Metric |
|---|---|---|---|
| `accepted_by_provider` | the provider accepted the message | stays counted | `sent` +1 |
| `not_sent` | WisKey **proves** nothing reached the provider (never dispatched, or a provider refusal before acceptance) | **handed back** | - |
| `unknown` | dispatched; accepted or not is not proven (timeout after write, uncertain status) | **stays counted, never credited**; WisKey MUST NOT resend | - |
| `expired` | the lease ran out **before any dispatch**; WisKey did not use it | handed back like `not_sent` | - |

- A lease that simply expires with **no release** is never credited: it stays counted (the send may have left). It shows as `expired` in section 3.3 until WisKey settles it.
- A **late** release (after `expires_at`) settles exactly like an on-time one - proof is proof - and is answered `late: true`. Expiry **after dispatch** is `unknown`/`accepted_by_provider`, never `expired`.
- **Idempotent**: the first outcome stands. A repeat with the same outcome answers `repeated: true, conflict: false`; a different outcome answers `repeated: true, conflict: true` with the stored outcome (nothing changes; WisKey logs the conflict).
- `slowdown` reports a provider slow-down that caused the failure and never changes the outcome: `scope: account` starts or extends the account backoff (using `retry_after_s` when given, capped at 30 min, otherwise the 60 s doubling ladder); `scope: pair` is only counted (WisKey names no recipient Arx can key).
- `unknown` is also what Arx writes into its own reading of an unreleased lease: it is never turned into a refund by Arx.

## 6. Reconciliation and no double charge

One send, one count - always:
1. **By `request_id`.** A send WisKey reserved is counted by its lease, from the grant. WisKey keeps its open `request_id`s and, after a restart or a lost answer, asks section 3.3 for each and settles it (`release`) with its true outcome. Arx never decides an outcome for WisKey.
2. **Against `wiskey_own.charged_*`.** `charged_*` includes WisKey's reservations (its own contract), so while leases exist for an account Arx **does not** add `charged_*`; it adds only `wiskey_own.charged_unreserved_1m/1h/24h` - the same counters **without** any send that carries a granted Arx lease (reconciled by `request_id`). WisKey MUST publish `charged_unreserved_*` before it reserves through the port. If leases exist and `charged_unreserved_*` is missing or incomplete, Arx reports the account's WisKey load as **unknown** (never zero) and adds nothing.
3. **Against `intercom_messages`.** Sends Arx requested are counted there only (section 1).
4. Before WisKey's first lease on an account (no leases in 24 h), Arx uses `charged_*` exactly as in the status contract.

Arx counts each send once; WisKey publishes each send once in `charged_*` and, additionally, marks which of them were reserved.

## 7. Fail-open and its limits (WisKey's local fallback)

When Arx is unreachable (section 3.4: transport failure, timeout, 5xx, 429), WisKey MAY send under its own conservative local cap instead of waiting for Arx. The limits:
- the local default for WisKey-initiated sends is **at most 3 per minute** (policy, not a provider quota);
- it MUST NOT bypass a **verified provider slowdown** (its own knowledge of 429 / 130429 / 131048 / 131056): it honours its own `throttled_until` and publishes it;
- it MUST NOT retry a send that ended **unknown**;
- those sends have no lease: they are published in `charged_unreserved_*` and Arx counts them from the next status read; WisKey never reserves after the fact for a send already dispatched;
- while any fallback send happened, or until every shared sender has adopted the contract, `shared_budget_guaranteed` stays **false** on both sides;
- Arx never makes its own alerts depend on the port: alerts are counted, not gated by it.

A 200 denial is NOT a reason to fail open: WisKey waits `retry_after_s` (or drops to its local cap only after the **age limit of its own queue**, visibly, as `pacing_expired`).

## 8. Error codes and vocabulary (summary)

- Provider/platform: `rate_limited` (account-wide: 429, 130429, 131048), `pair_rate_limited` (131056), reported by WisKey on release as `slowdown.scope = account | pair`.
- Message end states that Arx accepts from WisKey's send replies: `rate_limited`, `pair_rate_limited`, `pacing_expired` (not sent), `whatsapp_send_uncertain`, `status_unknown` (unknown - never resent).
- Reserve reasons: `burst minute hour day backoff wiskey_throttle sender_unknown class_unknown already_released lease_expired`.
- Release reasons: `unknown_request outcome_unknown slowdown_invalid`.

## 9. Order of work (no step waits for another)

1. WisKey, now, no port needed: counters + `sender_ref` mapping + error classes + local ledger/queue + a fake port client written to this document.
2. Owner: create the dedicated HA user and token (never pasted anywhere), decide `remote_access`; the administrator maps `sender_ref` to the Arx account and creates the role.
3. Joint: one integration run with fakes on both sides against these routes; only then the live switch and the claim `shared_budget_guaranteed: true`.

## 10. Open items

- `remote_access` on or the bridge relay (section 2) - owner decision.
- Whether the port principal needs a per-`sender_ref` scope (today: any mapped `sender_ref`).
- WisKey has to add `whatsapp/pacing_status_v1` to its command list (`overview.api.commands`) and implement the envelope of section 11. Until it does, Arx's read
  is closed `pacing_route_not_listed` and every mapped sender is unknown.
- Tests of this contract: `tests/test_wa_pacing.py` and `tests/test_wa_pacing_coverage_295.py` (fakes only; no WisKey client exists in this repository).

## 11. The status read Arx makes: `whatsapp/pacing_status_v1` (PACING12-295)

The counters of section 6 (`wiskey_own.charged_*`, `charged_unreserved_*`) reach Arx through ONE read over the add-on's WisKey session.
Code: `services/intercom_messaging_adapter.py` (`refresh_pacing`, `_pacing_exchange`), `services/wa_pacing.py` (`choose_pacing_route`,
`project_pacing_envelope`, `parse_wiskey_status`, `WaPacer.wiskey_view` / `wiskey_coverage`), `services/wiskey_channels.py` (channel `pacing`).

### 11.1 Discovery, then an explicit route

1. Discovery: Arx reads the commands WisKey lists for the add-on's user (`overview.api.commands`, the same capability negotiation the other adapters use).
2. Choice: Arx uses the route `hikvision_intercom/whatsapp/pacing_status_v1` **only** when that exact name is listed. It is sent on its own guarded channel
   `pacing` (that channel allows this command and nothing else; the `messaging` channel does not allow it).
3. Fail closed. No endpoint or auth is guessed and **nothing falls back to `whatsapp/status`** for pacing (`whatsapp/status` no longer carries any pacing
   field Arx reads). The closed reasons, each leaving every mapped sender **unknown**:

| `closed_reason` | When |
|---|---|
| `discovery_unknown` | no served WisKey copy yet, or its command list is missing / not a list |
| `api_incompatible` | WisKey's `min_client` is newer than Arx's `API_CONTRACT` |
| `pacing_route_not_listed` | the list does not contain `whatsapp/pacing_status_v1` (a similar name does not count) |
| `route_error` | the read was sent and failed (WisKey error, timeout, busy, session gone, refusal) |
| `envelope_invalid` | the answer is not an object, `accounts` is not a list, or `accounts_total` is not a whole number 0..1 000 000 |
| `schema_version_missing` | the envelope has no `pacing_schema_version` |
| `schema_version_misplaced` | the envelope has none but the entries carry it (the pre-PACING12 per-account layout) |
| `schema_version_unsupported` | `pacing_schema_version` is not 1 (accepted spellings: `1`, `"1"`, `"v1"`, `"whatsapp_pacing_status_v1"`) |
| `coverage_inconsistent` | `accounts_total` is below the number of entries sent |
| `not_read` / `stale` | no read yet / the last read is older than 5 minutes |

### 11.2 The envelope (WisKey's answer)

```json
{"pacing_schema_version": 1, "accounts_total": 2,
 "accounts": [{"sender_ref": "wk-sender-1", "sender_match_verified": true, "counters_complete": true,
               "wiskey_own": {"charged_1m": 0, "charged_1h": 3, "charged_24h": 20,
                              "charged_unreserved_1m": 0, "charged_unreserved_1h": 1, "charged_unreserved_24h": 4},
               "throttled_until": null, "throttle_scope": null, "retry_after_s": null}]}
```

- `pacing_schema_version` belongs on the **envelope**. An entry need not repeat it; an entry that does with a value other than 1 is dropped (counted `invalid`).
- `accounts_total` (optional) is WisKey's own number of senders. When WisKey sends fewer entries than it has, it MUST say so here; absent = the list is complete.
- Counters: a non-negative whole number up to 10 000 (`retry_after_s` up to 86 400); anything else (negative, float, bool, string, out of range, null) is
  **unknown**, never clamped and never zero. Unknown keys are dropped. A duplicate `sender_ref` keeps the first entry (the rest are `invalid`).

### 11.3 Coverage: no silent truncation

Arx keeps at most **10** senders of one read, and the projection always says what it covered:

`coverage = {total, received, returned, invalid, truncated}` - `total` = `accounts_total` or the entries sent; `received` = entries sent; `returned` =
senders Arx kept; `invalid` = unusable or duplicate entries; `truncated` = `returned < total` (WisKey sent fewer than it has, an entry was unusable, or
Arx's cap cut the list).

Consumers treat **missing != zero**: a mapped sender absent from the read is `unknown` - its counters add nothing to the budget, and the administrator's
view (`GET /messaging/whatsapp/pacing`) says so per account (`wiskey.unknown: true`, `wiskey.coverage: covered | not_covered`, `wiskey.reason`: the read's
closed reason, `truncated`, `sender_absent`, `unverified`, `counters_incomplete` or `unreserved_unknown`) and for the read as a whole
(`wiskey_coverage = {closed_reason, total, received, returned, invalid, truncated}`).

The same rule applies to the WhatsApp account list of `whatsapp/status` (the message dialog): it is capped at 10, with `accounts_total` and
`accounts_truncated`; a configured account beyond the cut is `account_not_covered`, not `account_missing`.
