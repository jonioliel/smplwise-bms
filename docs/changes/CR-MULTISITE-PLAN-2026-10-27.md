# Multi-site implementation plan, updated 2026-10-27 (board rows r116 and r271)

**Status:** plan (documentation only). No product code, no migration file, no runner job, no device contact.
**Base:** `origin/main` at v2.23.2 (`1b0ddd85c`). Code references below were re-checked on this base.
**Formal change request:** `CR-041` (`docs/changes/CR-041-MULTISITE-LIVE-LINK.md`), status PROPOSED, exists only on
`origin/pilot/MULTISITE-PLAN-295` (not on `main`). This document does not replace CR-041; it updates the implementation plan
(`docs/architecture/MULTISITE_PLAN.md` on the same pilot branch) against the current `main` and adds agent types, ETAs and the
questions that are still open.
**Test tier when built:** L (new public surface, new persistent state, cross-installation protocol).

## 0. Sources and what the owner actually decided

Sources read (read-only): owner answers 333-341 (batch 11, 2026-10-24); answers 367-379 (`private/review/OWNER_OPEN_QUESTIONS_2026-10-24.html`,
answer keys `ms2-1` .. `ms2-13`); the ten answers of 2026-10-26 (`private/review/MULTISITE_ANSWERS_2026-10-26.md`, questions in
`MULTISITE_QUESTIONS_HE_2026-10-26.html`); board rows r116 and r271 (`private/dashboard/tasks.json`); the earlier analysis
`private/planning/MULTISITE_COST_AND_PLAN_2026-10-24.md`; the pilot plan and CR-041.

### 0.1 Answers 367-379 (verbatim meaning, letters as option index)

| # | Topic | Answer | Free text (translated) |
|---|-------|--------|------------------------|
| 367 | Who holds the unified screen | a: one of the existing site servers | - |
| 368 | How data moves between servers | free text | "Both; it must be updated ONLINE with no delay" |
| 369 | What leaves a site | b: counts and states, plus building names if the site admin ticks it | "with an option to change in Settings" |
| 370 | Click on a remote building | a: opens that site in a new tab, separate login | "with an option to change in Settings" |
| 371 | Network path | b: also local / private network, by an explicit setting that is off by default | - |
| 372 | Refresh of remote sites | free text | "Online with no delay; the moment there is a change it is visible centrally" |
| 373 | Who sees remote sites | a and b | "I decide per role and can add an 'all buildings' permission" |
| 374 | Live alerts from remote sites | a: counts first, live alerts in the next stage | - |
| 375 | Key lifetime | a, plus free text | "The key renews automatically without intervention, at the interval you recommend, in an orderly server-to-server process" |
| 376 | Build order | a: overview + connected sites first, then the corner switcher | - |
| 377 | Phone with several servers | a: later, after the unified screen works | - |
| 378 | Separate device source per building | a: only when a customer needs it, last | - |
| 379 | Change request | a: open one on the strength of the approval | - |

### 0.2 Decisions of 2026-10-26

1. Link down: "not updated, last update N ago" after a short editable threshold (proposed default 15 s); automatic resync on reconnect.
2. Connection mode: **both in parallel from day one** (hub-initiated stream AND site-initiated push). This differs from the
   recommendation (stream first).
3. Key rotation: every 30 days, token valid 90 days, 24 h overlap; all editable in Settings.
4. Remote live alerts: counts and states now; alert titles only if the site admin ticks a share approval (permissions stage).
5. LAN / private-address links: explicit system-admin switch, default off, optional per-link allowed-address list.
6. Who may change multi-site thresholds: system admin by default, grantable per role.
7. Rotation keeps failing: notify both site admins at the warning threshold (default 14 days before expiry); a person re-pairs;
   the link stays read-only.
8. Remote building without an account there: open anyway; the site login screen explains.
9. Build order: one live overview stage (structure, link, real-time update), then permissions and key rotation.
10. One formal change request covering the live link, the receive endpoint and automatic key rotation (opened as CR-041).

Earlier decisions still in force: 333 (approved mock-up, keep the existing look), 334 (one shared device source by default,
optional per building), 335 (corner switcher next to search), 336 (opening view: setting plus personal choice), 337 (one invoice
sequence per installation, option to separate), 338 (new building inherits "all buildings"), 339 (live alerts from all buildings
the user may see, changeable), 340 (permissions read-only on the phone), 341 (modes A and B must work together).

### 0.3 Not decided (do not treat as decided)

- Approval of CR-041 itself. Decision 10 told us to open it; the owner has not approved its text. No slice merges before that.
- Single sign-on across installations ("later one login across installations" in the r116 title). Never answered; out of this plan.
- Whether a hub's "all buildings" binding covers remote buildings (section 4.2, question 2).
- Several smaller points listed in section 10.
- Board note on r116 (owner, 2026-10-23): the owner asked to talk this task through "in the coming days". Question 1 asks
  whether that conversation should precede stage 1.

### 0.4 Contradictions recorded, not resolved

1. `MASTER_SPEC_HE.md` line 1151 puts "multi-site enterprise" outside the initial scope. Resolved only by approving CR-041.
2. The pilot plan (section 9) states "no open questions". This document disagrees: the points in section 0.3 are not covered by any
   answer. The pilot plan's statement should be corrected when that branch is integrated.
3. CR-041 and the pilot plan live on `pilot/MULTISITE-PLAN-295`, which was cut before v2.23.2. The partner interface they depend on
   is now on `main` (`migrations/0169_partner_api.sql`, `services/partner/`), so the earlier warning "slice 1 must branch from the
   2.16.0 head" no longer applies.
4. The partner ASGI app (`services/partner/api_app.py`) is request/response with a static route table and per-minute rate limits
   (`partner.rate_per_min` default 60). A long-lived stream does not fit that model as is; slice 1b must add a streaming route with
   its own connection cap instead of counting a stream against the per-minute request limit. Recorded, design in section 5.
5. No per-setting edit permission mechanism was found on `main` (no `settings.<key>.edit` style permission). Decision 6 ("grantable
   per role") therefore needs a small generic mechanism; it is costed in slice 2a, not assumed to exist.

## 1. Architecture in one paragraph

Any Arx installation can be a **hub** (367). Its **building directory** = its own buildings (mode A, the existing
`sites -> buildings -> floors` tree) + remote buildings received over **links** (mode B). A link is read-only, authenticated and
sequence-numbered, and carries only a closed-schema summary (counts and states; names and alert titles only with the site admin's
tick). Each link runs two transports from day one (decision 2): a **hub-initiated stream** (the hub opens an outbound HTTPS stream to
the site's partner listener) and a **site-initiated push** (the site posts signed messages to the hub's receive endpoint). Both feed
one state per link, de-duplicated by sequence number. A slow reconcile is only a safety net. The hub never controls anything at a site:
the partner `NEVER_SCOPES` list stays, and no write scope exists for federation. Clicking a remote building opens that site's own
address in a new tab with its own login (370, decision 8).

```
 Site 2 --(push: signed delta/heartbeat)--> Hub receive endpoint
   ^                                          |
   +---(stream: hub opens outbound HTTPS)-----+   one state per link, dedup by sequence
                                              |   directory = local buildings + remote buildings
 Site 3 <--------- same, per link ----------->+   reconcile (snapshot) = safety net only
```

## 2. Data model changes

### 2.1 Reused as is (verified on v2.23.2)

- Location tree: `sites`, `buildings`, `floors` (`migrations/0001_init.sql`).
- RBAC: `rbac.SCOPE_ORDER` (installation, site, building, floor, camera, access_control_station), `rbac.scope_chain()` (line 171),
  `rbac.authorize()` (line 261), explicit deny wins. "All buildings" = an installation-scope binding, so 338 needs no code.
- Partner substrate: `services/partner/core.py` (`SCOPES` line 50, `NEVER_SCOPES` line 53, `validate_restriction` line 200,
  `reach_of` line 237, `rotate_token` line 496 with overlap, settings `partner.token_default_days` 90 / `token_max_days` 365 /
  `rotation_overlap_hours` 24 / `expiry_notice_days` 14); `webhooks.py` (HMAC-signed bodies, secret rotation with overlap);
  `ssrf.py` (`address_refused` refuses private, CGNAT, loopback, link-local).
- Sealed secrets: `services/connection_store.seal_service_secret` (line 208) / `open_service_secret`.
- Closed-schema pattern: `services/fleet_report.validate()` (line 171) and its injectable `TRANSPORT` (line 58).
- Backup exclusion list: `services/backup.NEVER_EXPORTED_TABLES` (line 88).
- Modules that already carry a building or floor: tickets (0079), maintenance (0155), notices (0165), incidents (0168), station
  scope (0077), presence `site_id` (0057).

### 2.2 New, hub side

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `federation_links` | One row per remote site | id, local label, endpoint host (display only), endpoint URL sealed, stream credential sealed (held by the hub, issued by the site), state (pending / live / stale / read_only / revoked / paused), transports enabled, last_seq, last_event_at, last_reconcile_at, last_error_class, lan_allowed flag, allowed-address list, created_by/at |
| `federation_state` | Last good state per remote building | link_id, opaque building ref, validated body, seq, site_ts, received_at |
| `federation_inbound` | Credentials the hub issued to sites for push | link_id, partner token id (scope `federation.push`), HMAC signing secret sealed, generation |
| `federation_link_buildings` | Per-link remote-building visibility on the hub (permissions stage) | link_id, building ref, local label, visibility rule |

### 2.3 New, site side

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `federation_peers` | One row per hub this site is linked to | id, partner client id (consent object), push endpoint URL sealed, push credential sealed (held by the site, issued by the hub), share_names flag, share_alert_titles flag (site admin only), ref key sealed, state |
| `federation_outbox` | Short buffer of outgoing deltas per peer for retry and gap repair | peer_id, seq, body, created_at (bounded, pruned) |

The **opaque building ref** is an HMAC of the building id with the peer's ref key. The ref key belongs to the peer (link), not to
the token, so it survives key rotation; two hubs cannot correlate ids.

### 2.4 Key rotation state (both sides)

`federation_keys`: link or peer id, direction (stream / push), generation, valid_from, valid_to, state (active / pending / retiring /
retired), last_attempt_at, failure_count, warned_at. Sealed material only; token text never stored in clear.

### 2.5 Code-only changes (no migration)

- Partner `SCOPES` gains `summary.read`, `summary.stream` (site side) and `federation.push` (hub side). Scopes are a code tuple, not
  a table. `NEVER_SCOPES` unchanged.
- All `federation_*` tables join `NEVER_EXPORTED_TABLES`; demo mode refuses every federation route and task.
- New permissions: `sites.federation.view`, `sites.federation.manage` (plus per-setting edit permissions, section 4.3). Whether
  permissions are seeded by migration or by code follows the existing convention; verify in slice 1a.

### 2.6 Later slices (mode A gaps, unchanged in substance)

`recorders.building_id` (cameras derive), building columns on alarm tables, rules/cases/events filtered through camera -> recorder ->
building, settings scope per building, optional separate invoice sequence (337), `sources` table and `source_id` tags (334 option,
customer demand only).

## 3. Migrations needed (unnumbered; numbers are assigned at integration)

| Migration | Slice | Contents | Backfill |
|-----------|-------|----------|----------|
| Federation core | 1a | `federation_links`, `federation_state`, `federation_peers`, `federation_outbox`, `federation_inbound`, settings seeds for the stage-1 thresholds | none (new tables) |
| Federation permissions | 2a | `federation_link_buildings`, permission rows for `sites.federation.view/manage` and per-setting edit permissions, role defaults (system admin) | none |
| Federation keys | 3 | `federation_keys`, rotation settings seeds | generation 1 rows for existing links, if any exist by then |
| Building columns for recorders and alarms | 9 | `recorders.building_id`, alarm table building columns | to the first building, so behaviour is unchanged |
| Building-scoped settings and invoice sequence | 9 | settings scope columns; optional separate sequence | installation scope by default |
| Device sources | 8 | `sources`, `source_id` on `ha_*` rows | single default source |

Rule: no existing table is altered in stages 1-2. Each migration has a forward test on a seeded copy and a "switch off = no change"
regression (golden comparison of existing API responses).

## 4. Permission model

### 4.1 Local buildings (mode A)

Unchanged engine: role bindings at installation / site / building / floor scope, `rbac.authorize` at building scope, explicit deny
wins. "All buildings" = installation-scope binding; a new building inherits it (338). The permission matrix screen (mock-up screen 3)
is a view and editor over existing bindings, with an "effective access" preview. Phone: read-only (340).

### 4.2 Remote buildings (mode B)

- Seeing any remote building requires `sites.federation.view` (default system admin, grantable per role, 373).
- Per role, per remote building: an entry in `federation_link_buildings` maps the remote ref to a visibility rule (roles allowed, or
  "all buildings").
- **Open (question 2):** does the hub's installation-scope "all buildings" binding also cover remote buildings? Recommendation: no,
  remote buildings are granted explicitly per link (or per link "all buildings of this site"), because the site admin consented to
  share with the hub, not with every hub user.
- Managing links requires `sites.federation.manage` (system admin only, like `partner.manage`).
- The site decides what leaves it: the token restriction (`reach_of`) limits buildings; `share_names` and `share_alert_titles` are
  set at the site by the site admin and enforced at the site when building messages. The hub cannot widen any of them.
- Remote live alerts reach a hub user only if the user may see that remote building, through `services/notify_visibility.py`
  (one recipient rule, not per sender).

### 4.3 Settings permissions (decision 6)

Every multi-site threshold is a setting with an edit permission, default system admin, grantable per role. No such per-setting
mechanism exists on `main` today (section 0.4 item 5); slice 2a adds a small generic one (permission id per settings group
`settings.multisite.edit`, `settings.federation_keys.edit`, `settings.federation_network.edit`). Until slice 2a lands, only system
admins can change them (safe default).

### 4.4 Settings and defaults (all editable)

| Setting | Default | Source |
|---------|---------|--------|
| Overview enabled / hub enabled / site sharing enabled | off / off / off | plan rule |
| Transports per link | both | decision 2 |
| Heartbeat interval / "not updated" threshold | 5 s / 15 s | decision 1 (15 s was the proposed default in the question) |
| Reconcile interval (safety net) | 15 min | plan |
| Reconnect backoff min / max | 1 s / 60 s | plan |
| Key replacement interval / token lifetime / overlap | 30 d / 90 d / 24 h | decision 3 |
| Early warning before expiry when rotation keeps failing | 14 d | decision 7 |
| Private / LAN / CGNAT targets for links | off, system admin, optional per-link list | decision 5 |
| Share building names / share alert titles | off per peer, site admin | 369, decision 4 |
| Remote building click | new tab, open even without an account | 370, decision 8 |
| Message size cap / links per hub / messages per second per link / concurrent streams per site | 64 KB / 20 / 20 / 5 | plan (lead proposal, editable) |
| Opening view for multi-building users | overview | 336 |

## 5. Sync design (online, no delay)

1. **Message types** (closed schema, exact key set at every level, fail closed on both ends, same rule as `fleet_report.validate`):
   `hello` (protocol version, capabilities), `snapshot`, `delta`, `heartbeat`, `rotate`, `ack`. Every message carries a per-link
   monotonic `seq` and the site timestamp. Deltas carry the new value (idempotent), never an increment.
2. **Content:** per shared building: opaque ref, counts and states from closed enums (cameras ok/offline, open alarms by severity,
   open service requests, open incidents, certificates expiring within 30 days, generator/elevator fault counts where the module is
   on), Arx version. Optional building name (share_names). Never: person names, phone numbers, entity ids, camera ids, frames, event
   texts, addresses, IPs, and alert titles unless share_alert_titles is ticked.
3. **Change detection at the site:** one internal "summary changed" hook on the same sources the summary reads (no polling of the site
   database by the hub). Coalesce to at most one delta per building per second.
4. **Stream (hub-initiated):** the hub opens an outbound HTTPS stream to `/p/v1/summary/stream` on the site's partner listener with
   the `summary.stream` token. Server-sent events are the recommended framing (one direction is all that is needed, works through the
   existing tunnel and proxies, simpler than WebSocket for a read-only feed); the final choice is fixed in slice 0. The stream has its
   own connection cap and idle timeout and does not consume the per-minute request budget.
5. **Push (site-initiated):** the site posts to the hub's receive endpoint (`/p/v1/federation/inbound`, on the hub's partner
   listener) with the `federation.push` token, and an HMAC body signature in the existing partner webhook format. Size and rate caps,
   closed schema, replay rejected by `seq` and timestamp window.
6. **Convergence:** one state per link. A message with `seq <= last_seq` is a duplicate and dropped; a gap requests one `snapshot`
   (over the stream, or over a `GET /p/v1/summary` if only push is up). Reconnect always starts with `snapshot`.
7. **Freshness:** a remote card is "live" while heartbeats arrive within the threshold; otherwise "not updated, last update N ago".
   Never a stale value shown as live. Measured latency and clock skew are shown in the link health card.
8. **Version skew:** `hello` carries a protocol major/minor. Unknown major = link refused with a clear "update needed" state; unknown
   minor fields are refused by the closed schema, so the sender must only send fields the peer announced. (Question 7.)
9. **Network path:** the public address through the existing tunnel by default. Private, LAN and CGNAT addresses only with the
   system-admin switch (decision 5), implemented as a separate allowance next to `ssrf.address_refused`, never by weakening the
   partner rule. Redirects never followed; TLS verified.

## 6. Automatic key rotation

- Two credential directions per link: stream credential (issued by the site, held by the hub) and push credential (issued by the hub,
  held by the site). Each holder rotates its own credential over the channel it already uses, so a push-only link rotates without any
  hub-to-site call.
- Protocol: at the interval (30 d) the holder sends `rotate` with a fresh nonce; the issuer creates generation N+1 through the
  existing `rotate_token` (same scopes, same restriction, never wider), returns it once sealed to the nonce; the holder stores it
  sealed, switches, sends `ack`; N retires at the end of the overlap (24 h).
- Failure: retry with backoff; at 14 days before expiry notify both site admins; a person re-pairs; the link stays read-only. A
  failed rotation never widens access, never extends a token.
- Separate key purpose and context string; never the evidence-signing key or the fleet key.

## 7. Security review points

The security review (slice 4) must cover at least:

1. New public surface: stream route and hub receive endpoint on the partner listener; default off; connection caps; slow-client and
   many-stream exhaustion; idle timeouts.
2. Authentication: bearer token hashing at the issuer, sealing at the holder, never returned by any route, never in logs, audit,
   backup or settings export.
3. Push integrity: HMAC signature, timestamp window, replay via `seq`, body size cap before parsing.
4. Closed schema: exact keys at every level on both ends; fuzzing with extra, missing, mistyped and oversize fields.
5. Data minimisation asserted on the wire: with share switches off no name and no alert title leaves the site.
6. Opaque refs: no correlation across hubs; refs stable across rotation; no building id leakage in error messages.
7. SSRF: link URLs validated at creation and at every connect (DNS rebinding); LAN allowance only with the switch and inside the
   per-link list; no redirects.
8. Rotation state machine: no path that widens scope or extends expiry; overlap honoured; revocation at the site ends the link at once.
9. Authorization on the hub: `sites.federation.view` plus per-link building visibility; explicit deny; "all buildings" semantics
   (question 2); scope-leak tests for every overview route.
10. Mode A leak tests: a user bound to building A asking for an id in building B gets the same 404 on every route that gains a building
    filter (slices 6 and 9).
11. Demo mode and restore: federation refused in demo; a restore onto another box carries no links or keys.
12. Audit at both ends without token text, URL path or body.
13. Denial of service on the site: a hub cannot force expensive summary recomputation (coalescing, snapshot rate limit).

## 8. Test plan by tier

All automated tests run against fakes: `httpx.MockTransport`, an in-process fake peer, a fake clock and a seeded two-building,
two-site database. No lab host, no real credentials, no lab addresses in fixtures.

| Tier | When | Contents |
|------|------|----------|
| S (per commit, targeted) | every slice | schema validator (exact keys, types, size); seq / gap / dedup logic; freshness state machine with the fake clock; settings resolution; permission resolution unit tests |
| M (per slice, before merge to the integration branch) | 1a-1e, 2a, 2b, 3, 5 | fake-peer integration: stream and push each alone and together, injected loss / reordering / duplication, reconnect resync, revocation, LAN switch on/off with and without list, share switches asserted on the wire, rate and size caps, rotation success and each failure step, overlap expiry, push-only rotation, early warning to both admins; authorization matrix per role and building incl. explicit deny and "all buildings"; Playwright for overview, link health, Settings cards, permission matrix, link-down and permission-denied states in every skin and theme, phone width, no scrolling in control screens |
| L (release gate) | the release that contains stage 1, and again for stage 2 | full suite; golden comparison of existing API responses with every federation switch off; backup / export exclusion; demo refusal; migration forward test on a seeded copy; scope-leak tests per router; the security review findings closed |
| Equipment (manual, owner approval at the time) | after stage 2 | latency and reconnect between two real installations; one real key rotation; reported NOT_RUN until done |

## 9. Slices, agent types, hours and ETA

Hours are agent-hours, estimates (not measurements). Lead integration and gate time is not included. "Opus" for protocol, security
and state-machine work; "Sonnet" for UI over a fixed backend contract; "Fable" for the public-surface security review (owner policy),
with Opus as fallback if Fable budget is not available.

| # | Slice | Agent | Hours | Depends on | Equipment |
|---|-------|-------|-------|------------|-----------|
| 0 | CR-041 approval (owner); fix SSE vs WebSocket; freeze schema v1 (`hello/snapshot/delta/heartbeat/rotate/ack`) | lead + Opus | 2-4 | owner approval | no |
| **Stage 1: one live overview** | | | | | |
| 1a | Federation core migration; site summary reader and closed schema; `summary.read` scope; hub link CRUD with sealed credentials; local-buildings overview API (mode A, building-scope authorize); demo refusal; backup exclusion | Opus | 9-12 | 0 | no |
| 1b | Hub-initiated stream: site stream route on the partner app with its own caps; hub stream client; deltas, heartbeat, seq/gap/snapshot, freshness, auto resync | Opus | 8-12 | 1a | no (fake peer) |
| 1c | Site-initiated push: hub receive endpoint, `federation.push` scope, HMAC signing, outbox and retry at the site | Opus | 6-9 | 1a | no |
| 1d | Dual-transport convergence and dedup; reconcile safety net; LAN allowance switch with per-link list; stage-1 thresholds as settings | Opus | 5-8 | 1b, 1c | no |
| 1e | UI: overview screen from the existing home cards; remote mark, live / "not updated" line; Settings "Connected sites" (add, pause, remove, test) and "Multi-site" cards; link health card | Sonnet | 6-9 | 1a API contract (can start in parallel with 1b/1c on a mocked API) | no |
| **Stage 2: permissions and key rotation** | | | | | |
| 2a | Permissions backend: `sites.federation.view/manage`, `federation_link_buildings`, remote visibility rule, per-setting edit permissions, site-side share approvals (names, alert titles), remote counts and titles into `notify_visibility` | Opus | 8-12 | stage 1 | no |
| 2b | Permission matrix screen per role and building with effective-access preview; phone read-only view | Sonnet | 6-9 | 2a contract | no |
| 3 | Automatic key rotation both directions; `federation_keys` migration; retries, early warning to both site admins, read-only on failure; audit | Opus | 9-16 | stage 1 (parallel with 2a/2b) | one real rotation, later |
| 4 | Security review of the whole federation surface (section 7) and fixes | Fable (Opus fallback) review + Opus fixes | 5-9 | 1a-1e, 2a, 3 | no |
| **Later (own task cards, inside the approved direction)** | | | | | |
| 5 | Corner switcher next to search; opening-view setting plus personal choice | Sonnet | 8-12 | stage 1 | visual check on a real multi-building box |
| 6 | Building filter on modules that already carry a building (service requests, maintenance, notices, incidents, energy) with scope-leak tests | Opus | 12-18 | 2a | no |
| 7 | Phone app with several servers (installation list, notices tagged by site); multi-server support in `mobile/` not verified | Sonnet | 8-16 | stage 2 | real phone build |
| 8 | Separate device source per building (customer demand only) | Opus | 24-40 | 6 | second real device source |
| 9 | Recorders / cameras / alarms per building with backfill; notifications per building; per-building settings overrides; optional separate invoice sequence | Opus | 28-42 | 6 | backfill dry-run on a copy of a real database |

**Totals (agent-hours):**
- Stage 1 including slice 0: 36-54.
- Stage 2 (2a, 2b, 3) plus the review (4): 28-46.
- Full federation path (0, 1a-1e, 2a, 2b, 3, 4): **64-100**.
- Later slices 5-9: 80-128.
- Everything: **144-228**.

Compared with the pilot plan (58-92 / 138-220): about +6-8 hours, from the separate UI slice 1e that the pilot plan folded into 1a,
the streaming route that does not fit the partner app's request/response model (section 0.4 item 4), and the per-setting edit
permission mechanism that does not exist yet (item 5).

**ETA ranges (calendar, estimates).** Day 0 = the day the owner approves CR-041 and answers questions 1-3. Assumes 2-3 agents in
parallel and the normal release pipeline.

| Milestone | Working days after day 0 | If day 0 = 2026-10-28 |
|-----------|--------------------------|-----------------------|
| Slice 0 done | 0-1 | 28-29.10 |
| Stage 1 on an integration branch, M tier green | 3-5 | 31.10-04.11 |
| Stage 2 + security review done, M tier green | 6-10 | 05.11-11.11 |
| First release gate containing stage 1 (off by default) | next release train after stage 1 | early November |
| Equipment validation (two real installations) | after stage 2, on owner approval | not scheduled |
| Later slices 5-9 | 3-6 weeks after stage 2, by owner priority | late November - December |

## 10. Open questions for the owner

Recommendation is option (a) in each, marked.

1. **Talk before building.** On the board you asked to discuss multi-site in the coming days. When do agents start stage 1?
   a. After a short review of this plan with you (one conversation), then start the same day **(recommended)**
   b. Start stage 1 now; discuss in parallel
2. **"All buildings" and remote sites.** Does an "all buildings" permission on the central server also cover buildings that come from
   other sites?
   a. No. Remote buildings are granted explicitly, per site or per building, per role **(recommended: the site agreed to share with the
      central server, not with every user on it)**
   b. Yes, "all buildings" covers local and remote buildings alike
3. **Approve the formal change request** (CR-041: live link, receive endpoint, automatic key rotation, both connection modes from day
   one).
   a. Approve as written, with this plan's updated hours and dates **(recommended)**
   b. Approve stage 1 only; stage 2 needs a second approval
   c. Changes needed (write which)
4. **Remote alerts on the phone.** When a remote site's counts or (approved) titles change, do phones of central-server users get a
   push notification?
   a. Not yet: on the central server's screens only, until the phone-with-several-servers stage **(recommended)**
   b. Yes, already in stage 2, through the central server's existing push
5. **Testing on real equipment.** The live link and one real key replacement need two real installations once.
   a. Ask you for a specific pair and a time window when stage 2 is done **(recommended)**
   b. Only at the first customer installation
6. **Single sign-on across installations** (in the board title "later one login"). Never decided.
   a. Not in this plan; revisit after stage 2 works **(recommended; estimated 40-80 agent-hours on its own)**
   b. Plan it now as part of the same change request
7. **Different versions on different sites.** What happens when a site runs an older version than the central server?
   a. The link works if the protocol is compatible; otherwise the card shows "site needs an update" **(recommended)**
   b. All linked sites must always run the same version
8. **Commercial side.** Is linking sites part of the product for every customer, or a licensed option?
   a. Decide later; it is built behind its own switch, so either works **(recommended)**
   b. Included for everyone
   c. Licensed option per linked site

## 11. Verification status

Nothing in this document was run or tested; it is a plan. All hours and dates are estimates. Code references were read on
`origin/main` v2.23.2 (`1b0ddd85c`) and must be re-checked on the integration head when slice 1a starts. `management/tasks.json` and
`management/test_catalog.json` were not edited; task and requirement ids are assigned when CR-041 is approved and the slices are cut.
