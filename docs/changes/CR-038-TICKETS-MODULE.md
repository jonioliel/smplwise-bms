# CR-038 — Tickets (קריאות שירות): an optional fault-management module with external handler links and a WhatsApp channel

**Numbering:** CR-038 is the next free number on 2026-10-13. Checked: `docs/changes/` on `origin/main` (highest CR-036), every
`origin/integ/*` and `origin/pilot/*` branch (CR-035 on `pilot/WISKEY-importer`, CR-036 notes on `integ/248`/`integ/249`,
**CR-037 on `pilot/ST8-ifc`**), and a text search for `CR-038`..`CR-049` in `docs/`, `management/`, `private/` on every remote
branch (no hit).

**Status:** DESIGN ONLY. No product code, no migration file, no test exists yet. Branch `pilot/TICKETS-spec` (from `origin/main`
at `b26c1b7d`, release 2.4.8). Nothing here has been run against a real Home Assistant, a real `ha-whatsapp` installation, a real
phone or a real Cloudflare tunnel. Every claim about existing code below was read in the repository at that commit (or on the
named branch) and cites the file; every claim about `ha-whatsapp` was read on its public documentation pages on 2026-10-13
(`faserf.github.io/ha-whatsapp/` - services, events, webhooks, limitations) and is marked `[WA-DOC]`. Facts that need a live
check are marked **UNVERIFIED**.

**Owner requirements:** the binding brief of 2026-10-13 (recorded in section 1). First release = scope "B": everything except
automatic creation from alert/automation rules, for which only the hook is designed (section 18).

**Related:** CR-018 (notification core: sources, recipients, escalation - the module's internal alerts ride on it), CR-008
(remote access through a Cloudflare tunnel, the threat model of a public surface), CR-028 (the cast relay: the precedent for a
separate unauthenticated listener), CR-027 (device tokens: store only a hash, failure counters), CR-032 (device activity: the
24-hour history the ticket captures), CR-036 slice WA (WhatsApp from the people screen: the precedent for a send envelope,
outcome classes and pacing), WXPERM (`docs/changes/WXPERM-ACCESS-PERMISSIONS-NOTES.md` on `origin/pilot/WXPERM`: every gate is a
permission, organization-defined roles), `docs/security/HA_IDENTITY_RBAC_HE.md`, memory note "data-store direction" (owner
decision 2026-10-01: the database engine is decided when ticketing is specified - see open question Q11).

---

## 1. The request (owner, 2026-10-13, condensed and translated)

1. A maintenance manager creates a ticket by hand (automatic creation later) and hands it to **another user**, **a person who
   is not a user**, or **an external vendor**. The system generates a **link**; the assignee opens it **without an account** and
   updates the handling. The link travels over **WhatsApp** through the `ha-whatsapp` integration (add-on + integration).
2. The WhatsApp channel sits behind an abstract **ticket message channel** (official WhatsApp Business API, SMS or e-mail can be
   added later), with pacing and a queue, a dedicated-number recommendation, an audit per send (envelope only: no phone number,
   no link token in logs), a fallback to in-app notification / e-mail, and clear UX when WhatsApp is disconnected. Replies and
   button taps ("received", "in progress") may update the status; a sender is matched to a ticket safely.
3. External link security: default = single-purpose unguessable token link (hash only, scope = exactly that ticket, expiry
   e.g. 14 days or on close, revocable, rate-limited, separate unauthenticated route namespace with strict CSP, no HA branding,
   mobile-first Hebrew RTL page, size/type-limited photo upload with server-side image validation). **Also built now (option B):**
   a per-vendor / per-contact "require verification code" setting - a short one-time code in a separate message must be entered
   before updates are allowed (attempt limits, expiry).
4. On the page the assignee can set the status (received / in progress / waiting for a part / done), add notes and photos and
   give an ETA. The assignee **cannot reassign**: handling returns to the assigner (the manager), who reassigns.
5. Manager tracking: who handles each ticket, how long it has been open, what waits for the manager, what is stuck. "Stuck"
   thresholds per **department and priority** (e.g. urgent 1 h, normal 3 days) with defaults; reminders to the assignee and
   alerts to the manager through the existing notifications engine.
6. **Dynamic departments** defined per customer (maintenance, cleaning, HR, ...), each with its own categories, priorities,
   templates, SLA thresholds and managers. The module is **optional**.
7. Permissions by organization-defined roles (WXPERM style); a department manager sees only their department; some managers see
   all; a ticket-view permission gates everything, including the device tab.
8. Tickets from devices: a long press on a device offers "open a ticket"; the device window gets a **new tab "קריאות"** after the
   existing tabs, visible only with the view permission, listing the device's tickets with a create action. The ticket carries
   device, floor, area/room ("air conditioner, floor 1, room 102" reaches the handler) and automatically attaches the device's
   last 24 h of history.
9. First release = all of the above except auto-creation from rules (hook designed). Clean operator screens, no HA branding
   outside Settings, five skins, RBAC + audit as elsewhere, Hebrew UI through i18n.

## 2. Goals and non-goals

**Goals (release 1):** the eight points above, end to end, behind one module switch that is OFF by default; nothing changes
for a customer who never turns it on (no nav entry, no device tab, no listener, no HA event subscription, no notification
sources visible).

**Non-goals (release 1):**
- Automatic ticket creation from rules / automations / notifications (phase 2; the creation service and its dedupe key are
  designed in section 18 so phase 2 is one action kind plus a picker).
- An official WhatsApp Business API, SMS, or Telegram channel (the channel interface admits them; none is built).
- Delivery / read receipts. `ha-whatsapp` HA events carry none `[WA-DOC]`; its webhook is documented for incoming messages
  only. The product never says "delivered" or "read" - only "handed to WhatsApp".
- Work orders with costs, stock / spare parts inventory, purchase orders, vendor invoicing, contracts, recurring preventive
  maintenance plans, customer-facing (tenant) portal. (Possible later CRs; the data model leaves room - `category`, `origin`.)
- A per-user notification preference model (CR-018 owner decision 4b stands: no per-user preferences).
- Business-hours SLA calendars (Q7; release 1 counts calendar time).
- Moving the database engine (Q11; release 1 stays on the main SQLite file behind a module storage layer).
- Writing anything to the `ha-whatsapp` integration's configuration (webhook, auto-responder, groups): Arx only calls the two
  send services and listens to events.

## 3. Glossary

| Term | Meaning |
|---|---|
| Ticket (קריאה) | One fault / request, owned by one department, with a status, a priority, a place and a timeline. Human reference `#<number>`. |
| Department (מחלקה) | An administrator-defined unit (maintenance, cleaning, HR, ...) with its own categories, priorities, SLA rules, message templates, managers and members. |
| Manager (מנהל מחלקה) | A user who holds `tickets.manage` and is a **manager member** of the ticket's department, or holds `tickets.all_departments`. Assigns, reassigns, closes. |
| Assigner | The manager who made the current assignment. Returned handling goes back to them (and to every manager of the department). |
| Assignee (מטפל) | Who handles the ticket now: an internal **user**, or a directory **contact** (a person who is not a user, or a vendor). Exactly one at a time. |
| Contact (איש קשר) / Vendor (ספק) | Directory entries for non-users. A vendor is a company; it may have contact persons. Phone (E.164 digits), e-mail, preferred channel, `require_code`. |
| Handler link (קישור טיפול) | The external page URL for one assignment of one ticket, carrying a 192-bit token in the URL **fragment**. |
| Verification code (קוד אימות) | Option B: a 6-digit one-time code sent in a separate message; required before the page accepts updates for contacts marked `require_code`. |
| Message channel | The abstract outbound/inbound interface (`TicketChannel`): WhatsApp (`ha-whatsapp`) in release 1, e-mail as fallback, others later. |
| Outbox | The durable queue of outbound ticket messages (`ticket_outbox`), drained by one paced worker. |
| Inbound | A reply / button tap arriving as an HA event and matched (or not) to a ticket. |
| SLA rule | Per department x priority: acknowledge-within, stuck-after (no update), stuck-after while waiting for a part, resolve-within, reminder cadence. |
| Stuck (תקועה) | An open ticket past one of its SLA thresholds. Computed, never a status. |
| Waiting for manager (ממתין למנהל) | A computed flag: unassigned, returned, done awaiting close, an unmatched reply, a failed send, an expired link on an open ticket. |
| Public listener | A separate HTTP listener (container port 18093) that serves only the handler page and its API. |

## 4. Facts this design rests on (read in code, `origin/main` @ `b26c1b7d` unless stated)

| Area | Fact | Where |
|---|---|---|
| Optional modules | There is **no generic module registry**. Modules are gated by (a) capabilities derived from the installation (`capabilities.py`, video/HA only), (b) a settings flag in the `settings` table plus per-feature server checks and nav hiding (`schedules.enabled`, `multimedia.enabled` - `routers/settings.py` `DEFAULTS` ~l.311/327; `services/schedules.py:134 feature_on`; `routers/multimedia.py` answers 404 `feature_disabled`; `frontend/src/shell/nav.ts` `applySchedulesHidden` / `applyMultimediaHidden` add hrefs to `HIDDEN_HREFS`), (c) data-driven visibility (the infrastructure area `infra`: `electricity/visibility.ts`, `generator/access.ts`), (d) add-on options (`frigate_enabled`, `cast_relay`; three places kept equal by a test: `config.yaml` options + schema, `services/self_update.py OPTION_TYPES` l.86). Every router is mounted unconditionally (`main.py` l.300-406). | as cited |
| Migrations | `db.Database.migrate()` (`db.py` l.406-423) runs `migrations/NNNN_name.sql` in order inside its own BEGIN/COMMIT (files carry none). Highest on `main`: `0075_plan_bakes.sql`. Highest anywhere: **`0078_intercom_door_map.sql` on `origin/integ/249`** (0076, 0077, 0078 there; `pilot/DEVTYPE-settings` also uses 0076 and will be renumbered at its integration). Parallel branches renumber at integration (`db.GUARDED_MIGRATIONS`, comments in 0061). | `db.py`, branch listing |
| Settings | `settings(key, value TEXT)`; JSON documents under one dotted key (`access.messaging` on `integ/249` is deliberately NOT in `routers/settings.py DEFAULTS` so `GET /settings`, readable by every signed-in user, never carries it). Optimistic `revision` on documents (`energy.billing`, `access.messaging`). | `db.py:619-625`, CR-036 WA notes |
| RBAC | Flat dotted permissions, no wildcards; `PERMISSION_LABELS` (`routers/access.py:30-260`) is the validity list; built-in roles in `roles.json` (viewer, kiosk, operator, editor, site_admin, system_admin; `door_opener` on `integ/249`); `sensitive_permissions_not_implied` must be named explicitly in a custom role's sensitive list; `SYSTEM_PERMISSIONS` (`routers/access.py:261`) only in built-in roles; custom roles table `custom_roles` (0011); `rbac.require(conn, principal, perm, target)` audits refusals; scope types installation/site/building/floor/camera (+ `access_control_station` on `integ/249`). Frontend: `api/session.ts can / canAnywhere / canNav`; `shell/nav.ts TAB_PERMISSIONS`. | `rbac.py`, `roles.json`, `routers/access.py` |
| Users | `users(id, username, display_name, source, active, ...)` - **no phone, no e-mail**. No endpoint lists users for a non-admin picker (`GET /identity/users` needs `identity.directory.read`). Holders of a permission are computed by iterating active users and calling `authorize` (pattern: `routers/alarm.py:834`). | `0001_init.sql:8`, `routers/access.py:680` |
| Audit | `audit(conn, *, actor, action, decision, resource_type, resource_id, reason, request_id, details, under)`; table `audit_log`; retention 365 days; anonymous refusals are throttled (`ha_user_auth.REFUSAL_AUDITS`). | `audit.py:85` |
| Notifications | `notify.emit(conn, Signal(...))` (`services/notify.py:211`); sources are the `SOURCES` tuple in `services/notify_policy.py:55` (module precedent: `_generator_sources()` l.104 + recipient rule `generator` + subject kind `generator` + visibility branch `notify_visibility.py:174`); `CATEGORIES` l.22, `SUBJECT_KINDS` l.26, `RECIPIENT_RULES` l.23, `CHANNELS_V1` l.24, `CHANNELS_RESERVED = ("ha_mobile", "whatsapp")` l.25 (rejected 422 `channel_reserved`). Escalation exists for `critical` only (`notify.escalation_tick`, global settings). **No reminders** for non-critical rows. Users receive only what they may see (`Reach.can_see`, `notify_visibility.py:138`). | as cited |
| E-mail | SMTP config in `notify_settings.email_json`, password in `<data>/secrets/notify_email`; the channel only mails the administrator's fixed list (`notify_email.run_job` refuses other addresses, l.1022) and caps 6 mails/min; `smtp_send(cfg, to, rendered)` (l.531) is a plain function reusable for another address. | `services/notify_email.py` |
| HA calls | `ha_client.call_service(settings, domain, service, data, return_response=False, timeout=15)` (`services/ha_client.py:523`) POSTs `/api/services/<d>/<s>[?return_response]` with the Supervisor token; it maps **every** `httpx.HTTPError` (connect error and read timeout alike) to 503 `ha_unavailable retryable` - a send adapter must classify these itself (section 9.4). | `ha_client.py` |
| HA events | `ha_sync` keeps one HA websocket; subscriptions in `on_ready` (state_changed l.833, `_automations_start` l.959 with `AUTOMATION_EVENTS` l.93); unified dispatcher `on_message` l.784 routes by subscription id / `event_type` and drops unknown types. | `services/ha_sync.py` |
| Device window | The only **tabbed** device surface is the `<device-activity>` sheet (`frontend/src/components/device-activity.ts`): `type Tab = 'activity' \| 'schedules'` (l.32), tabs rendered from `(['activity','schedules'] as Tab[]).map(...)` (l.284), keyboard `onTabKey` (l.299), labels `deviceActivity.tabActivity` "פעילות" / `tabSchedules` "תזמונים" (`i18n/he.ts` ~l.749-756). It opens on the window event `OPEN_EVENT` with `ActivityOpen {target{id=entity_id, kind, name, state}, area?: area NAME, tab, menu?}` (`device-activity-press.ts:28`). | as cited |
| Long press | `ActivityPress` (`device-activity-press.ts`, `LONG_PRESS_MS = 500` l.15) on the area screen (`screens/devices-area.ts:539`), bubble pills (`devices-area-bubble.ts`) and the tiles panel (`devices-tiles-panel.ts:209`); it fires only on elements carrying `data-activity`, which `activityTag()` (l.39) sets **only for rows the server flags `activity`** (the electrical domains of `device_activity.ACTIVITY_DOMAINS`). Right-click / menu key / Shift+F10 open a 2-item menu ("פעילות" / "תזמונים", `device-activity.ts renderMenu` ~l.242). The floor map card (`screens/explore-floor-map.ts renderCard` l.2548) and the settings catalogue (`explore-entities.ts`) have no long press and no tabs. | as cited |
| Device history | `GET /api/v1/devices/{entity_id}/activity` (`routers/devices.py:154-187`); server function `device_activity.list_activity(conn, entity_id, *, since, until, actor, kind, limit, cursor, connected)` (`services/device_activity.py:533`), **no permission check inside** (the router does `ha_scope.scoped_rows(..., "devices.read", ...)` and `SECURITY_PERMISSIONS` for locks/alarm panels); only `ACTIVITY_DOMAINS` (l.49) are tracked; retention 90 days. Other entities: `ha_state_history` (0009, states only, 30 days). | as cited |
| Device place | No single entity-to-place function. Physical: `map_anchors (resource_type 'ha_entity')` → `floors` → `buildings` → `sites`; room = `spatial_zones` polygon (`correlation._zone_at` l.138, `correlation._anchor` l.149; camera precedent `routers/events.py:_location` l.711); placements helper `ha_scope.placements` (l.101). Organisational: `ha_entities.area_id/area_name/ha_floor_name`. Key = `entity_id`; `registry_id` survives renames. | as cited |
| Public surface | Only `/arx` is tunnelled (CR-008), behind add-on option `remote_access` (off by default); `RemoteChannel` adds CSP + headers on that channel only; Ingress trust = peer `172.30.32.2` (`auth.py:121`); the peer check lives only in `resolve_principal`, so a route with no principal dependency is reachable by other add-ons on the hassio network. The cast relay (`services/cast_relay.py`) is "the ONLY unauthenticated listener", a separate server on container port 18092 started only with the add-on option `cast_relay`, HMAC-derived tokens never stored, strict path regex, per-token buckets, no logging. `tests/test_remote_access.py:498 PUBLIC_ON_REMOTE` whitelists public routes. Anonymous remote requests are capped at 64 KiB (`body_limit.REMOTE_ANONYMOUS_MAX`). | as cited |
| Token patterns | Store `sha256(token)` only (`notify_action_tokens`, `mobile_devices.token_hash`); failure buckets 20/min per key + 300/min global (`presence.py:57-58`, `routers/notifications.py:160`); TOTP attempt lock `second_factor._Failures` (5 in 300 s → 600 s lock, table `auth_totp_failures`). | as cited |
| Images | `services/image_guard.py` (`check_pixels` before decode; process-wide 60 MP); re-encode pattern without EXIF in `services/wall_photos.py:add_photo` (l.104-131: JPEG/PNG/WebP, 8 MB, 40 MP, `exif_transpose`, RGB, 1920 px, fresh JPEG q85, random name) and `routers/ui_background.reencode` (magic-byte sniff, `draft`, `_decode_slot` semaphore → 429 `busy`, `write_atomic`). | as cited |
| Frontend build | One Vite config, inputs `index.html` + `src/pwa/sw.ts`; output `smplwise_vms/www`; **no separate public entry**; the `/arx/` boot (`arx/pre-gate.ts`, `arx/boot.ts`) shows a login when there is no session. | `frontend/vite.config.ts` |
| Rules hook | The Arx-owned rules engine: `ACTION_KINDS = ("notify", "ha_notify", "announce")` (`services/rules.py:22`), mirrored by the `Action.kind` regex (`routers/rules.py:53`). CR-017 edits HA automations; it is not an Arx action engine. | as cited |
| Janitor | `main.py janitor_tick` (l.30-161) runs every 30 s in a threadpool; each module adds a guarded step; startup at `_start_janitor` (l.409). | `main.py` |

**Contradictions recorded (not resolved here):** (1) `AGENTS.md` says "four primary navigation modes"; the product already has
nine top-level modes (`router.ts MODES`) and this CR proposes one more (Q1). (2) `docs/changes/CR-018-NOTIFICATIONS.md` §6.5
reserves WhatsApp as a CR-018 channel "designed later"; this CR builds a **ticket** message channel, not a CR-018 channel - the
adapter is written so CR-018 can register it later (section 9.8). (3) CR-036 slice WA sends WhatsApp **through WisKey**; this CR
sends through **`ha-whatsapp`**. If both end up on the same WhatsApp number their pacing must be shared (Q5).

## 5. Architecture and module boundaries

```
                 (Ingress / /arx remote, signed-in users)                     (internet, no account)
  frontend/src/tickets/*  ── api/tickets.ts ──►  routers/tickets*.py           public page bundle (www-public/)
  device-activity "קריאות" tab                     │                                 │  fetch, X-Ticket-Token
                                                   ▼                                 ▼
                                   services/tickets/  (one package, one storage layer)        services/tickets/public_app.py
                                   ├─ store.py      all SQL of the module                     (separate FastAPI app, port 18093,
                                   ├─ model.py      state machine, validation                  only /t/* routes; started only when
                                   ├─ access.py     visibility = permission x department        option tickets_public AND module on)
                                   ├─ create.py     create_ticket() - the phase-2 hook
                                   ├─ place.py      entity -> site/building/floor/room
                                   ├─ device_context.py  24 h history snapshot
                                   ├─ links.py      token derive / verify / revoke, codes
                                   ├─ attachments.py image validation + storage
                                   ├─ sla.py        thresholds, stuck / waiting computation, monitor tick
                                   ├─ notify_bridge.py   CR-018 sources + recipient rule + visibility
                                   ├─ channel.py    TicketChannel interface + registry
                                   ├─ channel_whatsapp.py  ha-whatsapp adapter (send, status, inbound parse)
                                   ├─ channel_email.py     SMTP adapter reusing notify_email.smtp_send
                                   ├─ outbox.py     queue + paced worker thread
                                   ├─ inbound.py    HA event -> match -> action
                                   └─ retention.py  janitor step
```

- **Backend routers:** `routers/tickets.py` (tickets, timeline, assignments, attachments, board), `routers/tickets_admin.py`
  (departments, categories, priorities, SLA, templates, members, settings, channel status/test), `routers/tickets_contacts.py`
  (directory). All mounted under `/api/v1` like every router; every handler first calls `tickets.access.module_on(conn)` and
  answers 404 `feature_disabled` when the module is off (the `multimedia` precedent).
- **Public app:** `services/tickets/public_app.py` builds a **second, minimal FastAPI app** that contains only the `/t/*`
  routes, its own body-limit table, its own security-headers middleware and no static mount except the public bundle. It runs in
  the add-on process on container port **18093** as an extra `uvicorn.Server` task started in `_start_janitor` (`main.py:409`)
  next to the cast relay (l.525) - only when the new add-on option `tickets_public` is true. The main app (port 8099) mounts
  **none** of these routes (a test asserts `/t/*` and `/api/v1/public/*` are 404 on 8099, Ingress and `/arx`). Rationale in 10.1.
- **Frontend (internal):** `frontend/src/tickets/` (module-local components and a module-local text catalogue `tickets/text.ts`
  in the `frigate-text.ts` style, wired into `i18n`), `frontend/src/api/tickets.ts` (+ `tickets-mock.ts` demo store, the
  `api/schedules.ts` pattern), screens `screens/tickets-list.ts`, `tickets-board.ts`, `tickets-detail.ts`, settings screens
  `screens/system-tickets.ts` (tabs) and the device tab component `tickets/device-tickets-tab.ts`.
- **Frontend (public):** a **second Vite entry** `frontend/public-ticket.html` + `frontend/src/public-ticket/main.ts` built to
  `smplwise_vms/www-public/` (no Lit shell, no router, no skins, no service worker, no shared chunk with the app; budget
  <= 60 KB gzip; a build test fails if it imports anything from `shell/`, `api/session.ts` or the Ingress/remote boot).
- **Storage:** the main SQLite file (`smplwise.db`), all SQL inside `services/tickets/store.py` so a later move to another file or
  engine touches one module (data-store direction note; Q11). Attachments under `<data>/tickets/<ticket_id>/<random>.jpg`.
  Write rate is low (human actions, a 60 s monitor), so the separate-file argument of `energy.db` (once-a-minute sampler vs the
  single writer) does not apply.

## 6. Module enablement

| Layer | Switch | Default | Effect when off |
|---|---|---|---|
| In-app | setting `tickets.enabled` ("true"/"false"; in `routers/settings.py DEFAULTS` + `SettingsPatch` alias, the `schedules.enabled` precedent) | `"false"` | every `/api/v1/tickets*` route except `GET /tickets/module` answers 404 `feature_disabled`; nav area and device tab hidden (`applyTicketsHidden` in `shell/nav.ts`, called from `sw-app.ts` next to `applySchedulesHidden`); the HA event subscription for WhatsApp is not made; the SLA monitor and outbox worker idle; notification sources stay registered but `enabled=False` is forced. Data is kept. |
| Add-on option | `tickets_public: false` (`config.yaml` options + schema + `self_update.OPTION_TYPES`; `ports: 18093/tcp: null`, description "Handler page for service tickets (optional)") | off | the public listener is not started; external assignment is refused with 409 `public_link_unavailable` and the settings page says what is missing. |
| Settings document | `tickets.settings` (JSON, revision-checked, NOT in `DEFAULTS`) | see 14.1 | public base URL, link TTL, channel config, pacing, retention. |

Turning the module on requires `system.configure` and writes audit `tickets.module.enable`. Turning it off does not delete data,
revokes nothing by itself, but every public request then answers the uniform 404 (links are effectively suspended, and come
back if the module is turned on again before they expire). A capability-style flag `tickets` is added to `/me` (`modules:
{tickets: true|false}`) so the shell does not need the full settings read.

## 7. Data model (migrations 0079-0082)

**Migration range:** highest on any remote ref is 0078 (`integ/249`). This CR reserves **0079-0082** and follows the repo rule:
if another branch lands one of these numbers first, the tickets migrations are renumbered at integration (the files are
additive and independent of each other's numbers).

| File | Slice | Content |
|---|---|---|
| `0079_tickets_core.sql` | 1 (+2 uses it) | departments, members, categories, priorities, SLA rules, templates, sequence, tickets, assignments, events, attachments, device context |
| `0080_ticket_contacts_links.sql` | 4 (+7) | contacts, contact-departments, links, link sessions, link codes, link access log |
| `0081_ticket_messaging.sql` | 5 | outbox, inbound log |
| `0082` | spare | reserved for a slice-6 schema need found during build (none planned) |

Conventions: TEXT ids (`db.ID_RE`-compatible random ids), UTC ISO-8601 `...Z` times, `revision` for optimistic locking,
soft delete with `deleted_at` on configuration rows, no BEGIN/COMMIT in files, header comment citing CR-038.

### 7.1 `0079_tickets_core.sql`

```sql
CREATE TABLE ticket_departments (
  id                    TEXT PRIMARY KEY,
  key                   TEXT NOT NULL,                 -- 'maintenance', 'cleaning', 'hr' ... (slug, unique among live rows)
  name                  TEXT NOT NULL,                 -- Hebrew display name
  description           TEXT NOT NULL DEFAULT '',
  icon                  TEXT,                          -- icon id from the existing icon set
  color                 TEXT,                          -- a --sw-* token name, never a raw colour
  sort_order            INTEGER NOT NULL DEFAULT 0,
  active                INTEGER NOT NULL DEFAULT 1,
  require_manager_close INTEGER NOT NULL DEFAULT 1,    -- 1: 'done' waits for a manager to close (Q6)
  share_history_external INTEGER NOT NULL DEFAULT 1,   -- 1: the handler page shows the short device-history list (section 12.3)
  reopen_days           INTEGER NOT NULL DEFAULT 14,   -- a closed ticket can be reopened for this long
  open_to_all           INTEGER NOT NULL DEFAULT 1,    -- 1: any holder of tickets.create may open tickets here (not only members)
  revision              INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
);
CREATE UNIQUE INDEX idx_ticket_departments_key ON ticket_departments (key) WHERE deleted_at IS NULL;

CREATE TABLE ticket_department_members (                -- WHERE a ticket permission applies (section 8)
  department_id TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  subject_kind  TEXT NOT NULL CHECK (subject_kind IN ('user', 'group')),
  subject_id    TEXT NOT NULL,                         -- users.id or groups.id
  member_role   TEXT NOT NULL CHECK (member_role IN ('manager', 'member')),
  notify_new    INTEGER NOT NULL DEFAULT 1,            -- managers: alert on a new unassigned ticket
  added_by      TEXT NOT NULL,
  added_at      TEXT NOT NULL,
  PRIMARY KEY (department_id, subject_kind, subject_id)
);
CREATE INDEX idx_ticket_members_subject ON ticket_department_members (subject_kind, subject_id);

CREATE TABLE ticket_priorities (                        -- per department; seeded with 4 rows per new department
  id              TEXT PRIMARY KEY,
  department_id   TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  key             TEXT NOT NULL CHECK (key IN ('urgent', 'high', 'normal', 'low')),
  name            TEXT NOT NULL,
  rank            INTEGER NOT NULL,                    -- 0 = most urgent
  notify_severity TEXT NOT NULL CHECK (notify_severity IN ('info', 'alert', 'critical')),
  is_default      INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  UNIQUE (department_id, key)
);

CREATE TABLE ticket_categories (
  id                  TEXT PRIMARY KEY,
  department_id       TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  parent_id           TEXT REFERENCES ticket_categories(id),   -- one optional level ('HVAC' > 'air conditioner')
  name                TEXT NOT NULL,
  default_priority_id TEXT REFERENCES ticket_priorities(id),
  domains_json        TEXT NOT NULL DEFAULT '[]',     -- HA domains / device types that preselect this category from a device
  sort_order          INTEGER NOT NULL DEFAULT 0,
  active              INTEGER NOT NULL DEFAULT 1,
  deleted_at          TEXT
);
CREATE INDEX idx_ticket_categories_dept ON ticket_categories (department_id, sort_order);

CREATE TABLE ticket_sla_rules (                         -- one row per department x priority; NULL = threshold off
  department_id             TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  priority_id               TEXT NOT NULL REFERENCES ticket_priorities(id) ON DELETE CASCADE,
  unassigned_after_min      INTEGER,                  -- new ticket with no assignee -> waiting for manager + alert
  ack_within_min            INTEGER,                  -- assigned but not 'received'
  stuck_after_min           INTEGER,                  -- no update while acknowledged / in progress
  stuck_waiting_min         INTEGER,                  -- no update while waiting for a part
  resolve_within_min        INTEGER,                  -- from creation to done
  remind_every_min          INTEGER,                  -- assignee reminder cadence once a threshold is crossed
  max_reminders             INTEGER NOT NULL DEFAULT 2,
  manager_alert_after_steps INTEGER NOT NULL DEFAULT 1,   -- alert managers after this many unanswered reminders (0 = at once)
  revision                  INTEGER NOT NULL DEFAULT 1,
  updated_by                TEXT,
  updated_at                TEXT NOT NULL,
  PRIMARY KEY (department_id, priority_id)
);

CREATE TABLE ticket_templates (
  id            TEXT PRIMARY KEY,
  department_id TEXT REFERENCES ticket_departments(id) ON DELETE CASCADE,   -- NULL = installation-wide
  kind          TEXT NOT NULL CHECK (kind IN ('ticket', 'message')),
  purpose       TEXT,           -- message: 'assign' | 'reminder' | 'code' | 'closed' | 'reassigned'
  name          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',        -- ticket: prefilled title
  body          TEXT NOT NULL DEFAULT '',        -- ticket: prefilled description; message: text with allow-listed placeholders
  category_id   TEXT REFERENCES ticket_categories(id),
  priority_key  TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  revision      INTEGER NOT NULL DEFAULT 1,
  updated_by    TEXT,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE INDEX idx_ticket_templates_dept ON ticket_templates (department_id, kind);

CREATE TABLE ticket_sequence (name TEXT PRIMARY KEY, value INTEGER NOT NULL);   -- 'ticket' -> last number (Q13)

CREATE TABLE tickets (
  id                    TEXT PRIMARY KEY,
  number                INTEGER NOT NULL UNIQUE,      -- human reference '#1042'
  department_id         TEXT NOT NULL REFERENCES ticket_departments(id),
  category_id           TEXT REFERENCES ticket_categories(id),
  priority_id           TEXT NOT NULL REFERENCES ticket_priorities(id),
  title                 TEXT NOT NULL,                -- <= 120 chars, plain text
  description           TEXT NOT NULL DEFAULT '',     -- <= 4000 chars, plain text
  status                TEXT NOT NULL CHECK (status IN ('new', 'assigned', 'acknowledged', 'in_progress', 'waiting_part',
                                                         'done', 'returned', 'closed', 'cancelled')),
  origin                TEXT NOT NULL CHECK (origin IN ('manual', 'device', 'rule', 'inbound')),
  -- place (frozen at creation, editable by a manager)
  entity_id             TEXT,                         -- ha_entities.entity_id at creation
  registry_id           TEXT,                         -- survives an HA rename
  device_name           TEXT,                         -- name at creation ('מזגן חדר 102')
  site_id               TEXT, building_id TEXT, floor_id TEXT, zone_id TEXT, area_id TEXT,
  place_text            TEXT NOT NULL DEFAULT '',     -- 'קומה 1 · חדר 102' composed at creation (section 12.2)
  -- people
  created_by            TEXT NOT NULL,                -- users.id
  created_by_name       TEXT NOT NULL DEFAULT '',
  assigner_user_id      TEXT,                         -- the manager who made the current assignment
  current_assignment_id TEXT,                         -- ticket_assignments.id (NULL = unassigned)
  -- clocks
  eta_at                TEXT,                         -- the assignee's ETA
  ack_due_at            TEXT, stuck_due_at TEXT, resolve_due_at TEXT,   -- computed by sla.py at every change
  last_activity_at      TEXT NOT NULL,                -- any timeline event that counts as progress (13.2)
  last_external_activity_at TEXT,                     -- last update through a handler link or an applied inbound reply
  waiting_on            TEXT NOT NULL DEFAULT 'manager' CHECK (waiting_on IN ('manager', 'assignee', 'none')),
  waiting_reason        TEXT,                         -- 'unassigned' | 'returned' | 'done' | 'reply' | 'send_failed' | 'link_expired'
  stuck_level           INTEGER NOT NULL DEFAULT 0,   -- 0 none; 1 reminder(s) sent; 2 managers alerted
  stuck_kind            TEXT,                         -- 'unassigned' | 'ack' | 'stuck' | 'waiting' | 'overdue'
  reminders_sent        INTEGER NOT NULL DEFAULT 0,
  next_check_at         TEXT,                         -- the SLA monitor's next look at this row
  -- phase 2 hook
  rule_ref              TEXT,                         -- 'rule:<id>' / 'automation:<id>' (NULL in release 1)
  dedupe_key            TEXT,                         -- an open ticket with the same key absorbs a repeat (section 18)
  -- bookkeeping
  revision              INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  closed_at             TEXT,
  closed_by             TEXT,
  close_note            TEXT,
  purge_after           TEXT                          -- set at close: closed_at + retention (section 15)
);
CREATE INDEX idx_tickets_dept_status ON tickets (department_id, status, last_activity_at);
CREATE INDEX idx_tickets_open_check ON tickets (next_check_at) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_tickets_entity ON tickets (entity_id, created_at DESC);
CREATE INDEX idx_tickets_registry ON tickets (registry_id, created_at DESC);
CREATE INDEX idx_tickets_waiting ON tickets (waiting_on, department_id) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_tickets_created_by ON tickets (created_by, created_at DESC);
CREATE INDEX idx_tickets_purge ON tickets (purge_after) WHERE purge_after IS NOT NULL;
CREATE UNIQUE INDEX idx_tickets_open_dedupe ON tickets (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status NOT IN ('closed', 'cancelled');

CREATE TABLE ticket_assignments (
  id               TEXT PRIMARY KEY,
  ticket_id        TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  assignee_kind    TEXT NOT NULL CHECK (assignee_kind IN ('user', 'contact')),
  user_id          TEXT,                              -- assignee_kind = 'user'
  contact_id       TEXT,                              -- assignee_kind = 'contact' (ticket_contacts, 0080)
  assignee_name    TEXT NOT NULL,                     -- display name at assignment (the timeline stays readable after an erase)
  channel          TEXT NOT NULL CHECK (channel IN ('inapp', 'whatsapp', 'email', 'manual')),
  assigned_by      TEXT NOT NULL,
  assigned_at      TEXT NOT NULL,
  acknowledged_at  TEXT,
  last_update_at   TEXT,
  ended_at         TEXT,
  end_reason       TEXT CHECK (end_reason IN ('reassigned', 'returned', 'closed', 'cancelled')),
  return_reason    TEXT,                              -- the assignee's words when handing back (<= 500)
  CHECK ((assignee_kind = 'user' AND user_id IS NOT NULL) OR (assignee_kind = 'contact' AND contact_id IS NOT NULL))
);
CREATE INDEX idx_ticket_assignments_ticket ON ticket_assignments (ticket_id, assigned_at);
CREATE INDEX idx_ticket_assignments_user ON ticket_assignments (user_id) WHERE ended_at IS NULL;
CREATE INDEX idx_ticket_assignments_contact ON ticket_assignments (contact_id) WHERE ended_at IS NULL;

CREATE TABLE ticket_events (                           -- the timeline (append-only; edits are new rows)
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id        TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  at               TEXT NOT NULL,
  kind             TEXT NOT NULL,   -- created | edited | assigned | status | note | photo | eta | returned | reassigned
                                    -- | closed | reopened | cancelled | link_sent | link_opened | link_revoked | code_sent
                                    -- | code_verified | code_locked | reminder | stuck | manager_alerted | inbound
                                    -- | message_failed | message_fallback | device_context
  actor_kind       TEXT NOT NULL CHECK (actor_kind IN ('user', 'contact', 'system', 'inbound')),
  actor_user_id    TEXT,
  actor_contact_id TEXT,
  actor_name       TEXT NOT NULL DEFAULT '',
  assignment_id    TEXT,
  from_status      TEXT,
  to_status        TEXT,
  body             TEXT,           -- a note: plain text <= 2000, never HTML; NULL for other kinds
  data_json        TEXT NOT NULL DEFAULT '{}',   -- small structured details (ETA, outbox id, attachment id) - never a phone or token
  via              TEXT NOT NULL CHECK (via IN ('app', 'link', 'whatsapp', 'email', 'system')),
  visible_external INTEGER NOT NULL DEFAULT 1    -- 0: internal-only note (a manager's remark) - never on the handler page
);
CREATE INDEX idx_ticket_events_ticket ON ticket_events (ticket_id, id);

CREATE TABLE ticket_attachments (
  id              TEXT PRIMARY KEY,
  ticket_id       TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_id        INTEGER,                        -- the 'photo' timeline row
  kind            TEXT NOT NULL CHECK (kind IN ('photo')),
  path            TEXT NOT NULL,                  -- relative to <data>/tickets/ ; random name
  sha256          TEXT NOT NULL,
  bytes           INTEGER NOT NULL,
  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  uploaded_by_kind TEXT NOT NULL CHECK (uploaded_by_kind IN ('user', 'contact')),
  uploaded_by     TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  deleted_at      TEXT,
  deleted_by      TEXT
);
CREATE INDEX idx_ticket_attachments_ticket ON ticket_attachments (ticket_id, created_at);

CREATE TABLE ticket_device_context (                -- the 24 h history snapshot (section 12.3), frozen at creation
  ticket_id     TEXT PRIMARY KEY REFERENCES tickets(id) ON DELETE CASCADE,
  entity_id     TEXT NOT NULL,
  captured_at   TEXT NOT NULL,
  window_from   TEXT NOT NULL,
  window_to     TEXT NOT NULL,
  source        TEXT NOT NULL CHECK (source IN ('device_activity', 'state_history', 'none')),
  items_json    TEXT NOT NULL DEFAULT '[]',       -- <= 200 items, newest first, the list_activity item shape minus person names
  coverage_json TEXT NOT NULL DEFAULT '{}',       -- gaps / availability as list_activity reports them
  truncated     INTEGER NOT NULL DEFAULT 0,
  withheld      TEXT                              -- 'permission' when the creator could not see this device's history
);
```

### 7.2 `0080_ticket_contacts_links.sql`

```sql
CREATE TABLE ticket_contacts (
  id               TEXT PRIMARY KEY,
  kind             TEXT NOT NULL CHECK (kind IN ('person', 'vendor')),
  vendor_id        TEXT REFERENCES ticket_contacts(id),  -- a person who works for a vendor
  user_id          TEXT,                                 -- set when this entry is the phone/e-mail of an internal user (section 8.1)
  display_name     TEXT NOT NULL,
  company          TEXT NOT NULL DEFAULT '',
  phone_e164       TEXT,                                 -- digits only, country code, no '+' (ha-whatsapp target format)
  phone_key        TEXT,                                 -- HMAC-SHA256(k_tickets, phone_e164) hex: the inbound match index
  email            TEXT,
  preferred_channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (preferred_channel IN ('whatsapp', 'email', 'manual')),
  require_code     INTEGER NOT NULL DEFAULT 0,           -- option B (section 10.5)
  notes            TEXT NOT NULL DEFAULT '',             -- internal only, <= 1000
  active           INTEGER NOT NULL DEFAULT 1,
  created_by       TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_assigned_at TEXT,
  erased_at        TEXT,                                 -- personal data removed (section 15.2); the row stays as a tombstone
  revision         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_ticket_contacts_phone ON ticket_contacts (phone_key) WHERE phone_key IS NOT NULL AND erased_at IS NULL;
CREATE INDEX idx_ticket_contacts_vendor ON ticket_contacts (vendor_id);
CREATE UNIQUE INDEX idx_ticket_contacts_user ON ticket_contacts (user_id) WHERE user_id IS NOT NULL AND erased_at IS NULL;

CREATE TABLE ticket_contact_departments (           -- which departments may assign to this contact (empty = all)
  contact_id    TEXT NOT NULL REFERENCES ticket_contacts(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES ticket_departments(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, department_id)
);

CREATE TABLE ticket_links (                         -- one per external assignment; tokens are derived, never stored
  id               TEXT PRIMARY KEY,                -- 128-bit random id, the HMAC input
  ticket_id        TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  assignment_id    TEXT NOT NULL REFERENCES ticket_assignments(id) ON DELETE CASCADE,
  contact_id       TEXT NOT NULL REFERENCES ticket_contacts(id),
  generation       INTEGER NOT NULL DEFAULT 1,      -- bump = every earlier token dies
  token_hash       TEXT NOT NULL UNIQUE,            -- sha256(current token) hex: the lookup key
  require_code     INTEGER NOT NULL,                -- snapshot of the contact's setting at mint time (raised, never lowered, by a later change)
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  revoked_at       TEXT,
  revoked_reason   TEXT CHECK (revoked_reason IN ('closed', 'cancelled', 'reassigned', 'returned', 'manual', 'resent', 'module_key')),
  first_opened_at  TEXT,
  last_opened_at   TEXT,
  open_count       INTEGER NOT NULL DEFAULT 0,
  update_count     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ticket_links_ticket ON ticket_links (ticket_id);
CREATE INDEX idx_ticket_links_expiry ON ticket_links (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE ticket_link_sessions (                 -- option B: issued after a correct code; header value, hashed
  id_hash      TEXT PRIMARY KEY,                    -- sha256(session value)
  link_id      TEXT NOT NULL REFERENCES ticket_links(id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL                         -- 12 h, never past the link's own expiry
);
CREATE INDEX idx_ticket_link_sessions_link ON ticket_link_sessions (link_id);

CREATE TABLE ticket_link_codes (
  id            TEXT PRIMARY KEY,
  link_id       TEXT NOT NULL REFERENCES ticket_links(id) ON DELETE CASCADE,
  code_hash     TEXT NOT NULL,                       -- HMAC-SHA256(k_tickets, link_id | code)
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,                       -- 10 min
  attempts      INTEGER NOT NULL DEFAULT 0,
  consumed_at   TEXT,
  outbox_id     TEXT
);
CREATE INDEX idx_ticket_link_codes_link ON ticket_link_codes (link_id, created_at DESC);

CREATE TABLE ticket_link_failures (                 -- per-link attempt accounting (the second_factor._Failures pattern)
  link_id      TEXT PRIMARY KEY REFERENCES ticket_links(id) ON DELETE CASCADE,
  window_start TEXT NOT NULL,
  failures     INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);

CREATE TABLE ticket_link_access (                   -- what the manager sees under "opened"; no IP, no user agent string
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id     TEXT NOT NULL REFERENCES ticket_links(id) ON DELETE CASCADE,
  at          TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('open', 'update', 'code_ok', 'code_bad', 'locked')),
  client_key  TEXT NOT NULL                          -- HMAC(k_tickets, /64-or-/24 network | UA family)[:16]: "how many devices", nothing more
);
CREATE INDEX idx_ticket_link_access_link ON ticket_link_access (link_id, at);
```

### 7.3 `0081_ticket_messaging.sql`

```sql
CREATE TABLE ticket_outbox (
  id                  TEXT PRIMARY KEY,
  ticket_id           TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  assignment_id       TEXT,
  link_id             TEXT,                          -- the worker derives the URL from (link_id, generation) at send time
  recipient_kind      TEXT NOT NULL CHECK (recipient_kind IN ('contact', 'test')),
  contact_id          TEXT,                          -- the phone / e-mail are read from the directory at send time, never copied here
  channel             TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  purpose             TEXT NOT NULL CHECK (purpose IN ('assign', 'reminder', 'code', 'closed', 'reassigned', 'test')),
  template_id         TEXT,
  template_revision   INTEGER,
  params_json         TEXT NOT NULL DEFAULT '{}',    -- placeholders except {link} and {code}; never a phone, token or code
  state               TEXT NOT NULL CHECK (state IN ('queued', 'sending', 'sent', 'refused', 'unknown', 'not_sent', 'cancelled', 'superseded')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  not_before          TEXT NOT NULL,
  priority            INTEGER NOT NULL DEFAULT 1,    -- 0 = code (sent first), 1 = assign, 2 = reminder
  outcome_code        TEXT,                          -- 'ha_unavailable', 'service_not_found', 'timeout', 'rate', 'no_phone', ...
  provider_message_id TEXT,                          -- whatsapp send_message response (UNVERIFIED shape, section 9.3)
  reply_nonce         TEXT UNIQUE,                   -- 64-bit random, embedded in button ids 't:<nonce>:<action>'
  fallback_of         TEXT,                          -- the failed outbox row this one replaces
  requested_by        TEXT,                          -- users.id or 'system'
  created_at          TEXT NOT NULL,
  sent_at             TEXT,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_ticket_outbox_queue ON ticket_outbox (state, priority, not_before) WHERE state IN ('queued', 'sending');
CREATE INDEX idx_ticket_outbox_ticket ON ticket_outbox (ticket_id, created_at);
CREATE INDEX idx_ticket_outbox_contact_sent ON ticket_outbox (contact_id, sent_at) WHERE state = 'sent';
CREATE INDEX idx_ticket_outbox_provider ON ticket_outbox (provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE ticket_inbound (
  id               TEXT PRIMARY KEY,
  received_at      TEXT NOT NULL,                    -- when Arx got the event
  provider_at      TEXT,                             -- the event's own timestamp
  event_type       TEXT NOT NULL,                    -- whatsapp_message_received | whatsapp_button_pressed
  msg_type         TEXT,                             -- chat | button_reply | list_reply | ...
  sender_key       TEXT NOT NULL,                    -- HMAC(k_tickets, sender_number) - never the number
  dedupe_key       TEXT NOT NULL UNIQUE,             -- sha256(sender_key | provider_at | type | selected_id | content)
  contact_id       TEXT,
  ticket_id        TEXT,
  outbox_id        TEXT,
  result           TEXT NOT NULL CHECK (result IN ('status', 'note', 'ignored', 'ambiguous', 'unknown_sender', 'stale', 'duplicate', 'refused')),
  action           TEXT,                             -- acknowledged | in_progress
  content          TEXT,                             -- kept ONLY for result 'ambiguous' / 'note' (<= 1000, plain); NULL otherwise
  handled_by       TEXT,                             -- a manager who resolved an ambiguous reply
  handled_at       TEXT
);
CREATE INDEX idx_ticket_inbound_open ON ticket_inbound (result, received_at) WHERE result = 'ambiguous' AND handled_at IS NULL;
CREATE INDEX idx_ticket_inbound_ticket ON ticket_inbound (ticket_id, received_at);
```

### 7.4 Settings, secrets, files, backup

- `tickets.enabled` ("false"), `tickets.settings` (JSON document, section 14.1, revision-checked; a corrupt value reads as safe
  defaults with the module's external features off - fail closed, the `access.messaging` precedent).
- Module key `k_tickets`: 32 random bytes in `<data>/secrets/tickets_key` (mode 600, created on first enable, never in the DB,
  never in a project backup, never in an API response). It derives link tokens, keys phone numbers and codes. Rotation (Settings,
  `system.configure`, confirmation) revokes every link with reason `module_key` and recomputes `phone_key` for all contacts in one
  transaction.
- Attachments: `<data>/tickets/<ticket_id>/<16 hex>.jpg`, rows store the relative path; `confine()` the path on every read
  (`floor_images.confine` precedent). The directory joins `backup.RESTORABLE_ROOTS` so a restore brings the photos back.
- Project backup (`services/backup.py PROJECT_TABLES`): the **configuration** tables (departments, members, priorities,
  categories, SLA rules, templates) travel; tickets, events, attachments, contacts, links, outbox and inbound are operational data
  and do not (the `events` / `notifications` precedent). The HA add-on backup (`backup: hot`) holds all of `/data` as today.

## 8. Permissions (RBAC)

Principle (WXPERM): every gate is a permission; roles are defined by the organization. **WHERE** a permission applies is
answered by department membership (and by place scope when the ticket has a place); **WHAT** is answered by the permission.
Departments are deliberately **not** a new RBAC scope type: a new scope type touches `rbac.scope_chain`, the binding editor, the
delegation rules and every scope test (integ/249 shows the size of that change for stations); membership inside the module is
local, matches the owner's model ("each department has its managers"), and is administered on the department page.

| Permission | Label (Hebrew) | Meaning | Sensitive | Default built-in roles |
|---|---|---|---|---|
| `tickets.view` | צפייה בקריאות | See tickets (own, assigned to me, and my departments'); the nav area and the device tab "קריאות" exist only with it | no | operator, site_admin, system_admin |
| `tickets.create` | פתיחת קריאות | Open a ticket (screen, device) in a department the user is a member of, or any active department if the department allows "anyone may open" (department flag, default on) | no | operator, site_admin, system_admin |
| `tickets.handle` | טיפול בקריאות | Be assignable as an internal handler; update tickets assigned to me | no | operator, site_admin, system_admin |
| `tickets.manage` | ניהול קריאות במחלקה | Manager actions in departments where the user is a **manager member**: assign, reassign, close, cancel, reopen, edit, internal notes, resolve ambiguous replies | no | site_admin, system_admin |
| `tickets.all_departments` | כל המחלקות | `tickets.view` / `tickets.manage` apply in every department without membership | **yes** | system_admin |
| `tickets.external` | שליחה לגורם חיצוני | Assign to a directory contact (non-user / vendor), send / resend / revoke handler links, see contacts' full phone numbers | **yes** | site_admin, system_admin |
| `tickets.contacts.manage` | ניהול אנשי קשר וספקים | Create / edit / erase directory entries, set "require verification code" | **yes** | site_admin, system_admin |
| `tickets.configure` | הגדרת מחלקות | Departments, categories, priorities, SLA matrix, templates, members | no | system_admin |
| (existing) `system.configure` | - | Module switch, public address, channel (WhatsApp account, status entity, pacing), retention, key rotation | system | system_admin |

`viewer`, `kiosk`, `editor`, `door_opener`: none. Every new permission goes into `PERMISSION_LABELS`, `roles.json` (and
`contracts/examples/role-catalog.design.json`), `sensitive_permissions_not_implied` for the three sensitive ones, and the
frontend permission labels.

**Visibility rule** (`services/tickets/access.py visible(conn, principal, ticket)`, used by every read, every list, the device
tab, notification visibility and the board):

```
module on
AND authorize(principal, 'tickets.view', place_target(ticket))           # place_target = ('floor', floor_id) if the ticket has
                                                                          # a floor, else ('site', ...), else INSTALLATION
AND ( holds 'tickets.all_departments' (same target)
      OR is_member(principal, ticket.department_id)                       # direct or through a group, manager or member
      OR ticket.created_by == principal.user_id
      OR current internal assignee == principal.user_id )
```

Members who are not managers see their department's tickets (a technician sees the queue); a manager additionally needs
`tickets.manage`. A deny binding on the place chain removes the ticket (deny beats allow, `rbac.authorize`). Lists are filtered
in SQL by department membership first (indexed) and then by the place check per row (bounded page size 50).

**Assignee picker** (`GET /tickets/assignees?department_id=`): needs `tickets.manage` in that department; lists active users who
hold `tickets.handle` on the ticket's place (the `alarm.py:834` iteration, cached per `permission_revision`) - names only, no
bindings - plus, with `tickets.external`, the directory contacts allowed for the department.

### 8.1 Internal API (`/api/v1`, Ingress or `/arx` session; every route: module on, then permission, then visibility)

| Route | Gate | What |
|---|---|---|
| `GET /tickets/module` | signed in | `{enabled, public_ready, channel: {whatsapp: state}}` - the only route answering while the module is off |
| `GET /tickets?scope=mine\|department\|all&status=&department_id=&priority=&assignee=&entity_id=&cursor=` | `tickets.view` | page of 50, visibility-filtered; `scope=all` needs `tickets.all_departments` |
| `POST /tickets` | `tickets.create` (+ membership or `open_to_all`) | body: department, category, priority, title, description, `entity_id?`, `assign?`, `client_request_id`; device creation resolves place + history snapshot server-side (the client never sends a place) |
| `GET /tickets/{id}` | visible | detail + timeline + attachments + device context + allowed actions for this caller |
| `PATCH /tickets/{id}` | manager (or creator while `new`) | editable fields of 11.3; `revision` required (409 `ticket_stale`) |
| `POST /tickets/{id}/status` | per 11.2 | `{to, note?, revision}` |
| `POST /tickets/{id}/assign` | manager; `tickets.external` for a contact | `{assignee: {kind: user\|contact, id}, channel?, template_id?, note?, revision}`; ends the current assignment, revokes its link, mints a link for a contact, queues the message |
| `POST /tickets/{id}/notes` | visible + (manager \| current assignee \| creator) | `{text, internal: bool}` (`internal` only for managers) |
| `POST /tickets/{id}/attachments` / `GET .../attachments/{aid}` / `DELETE ...` | as notes / visible / manager or uploader within 10 min | multipart image (10.6) |
| `POST /tickets/{id}/eta` | current internal assignee or manager | `{eta_at}` |
| `POST /tickets/{id}/return` | current internal assignee | `{reason}` |
| `POST /tickets/{id}/link/resend` / `.../link/new` / `.../link/revoke` / `.../link/copy` | manager + `tickets.external` | resend the current link / new generation / revoke / return the URL once (audited) |
| `GET /tickets/board?department_id=` | `tickets.manage` (member manager) or all-departments | the four board sections (13.5) |
| `GET /tickets/inbound?state=ambiguous` / `POST /tickets/inbound/{id}/attach` / `.../dismiss` | manager of a candidate department | ambiguous replies |
| `GET /tickets/assignees?department_id=` | manager | 8 |
| `GET /tickets/by-entity/{entity_id}` | `tickets.view` | the device tab list (by `registry_id`, then `entity_id`) + `can_create` |
| `GET/POST/PATCH/DELETE /tickets/admin/departments[...]`, `.../categories`, `.../priorities`, `.../sla`, `.../templates`, `.../members` | `tickets.configure` | revision-checked documents, 422 field problems |
| `GET/POST/PATCH /tickets/contacts[...]`, `POST .../{id}/erase`, `GET .../{id}/export` | `tickets.contacts.manage` (list read: `tickets.external` or `tickets.manage`, phones masked without `tickets.external`) | directory |
| `GET/PUT /tickets/settings`, `POST /tickets/channel/test`, `GET /tickets/health`, `POST /tickets/key/rotate`, `PUT /settings` `tickets.enabled` | `system.configure` | 14.1, 17 |

Errors use the existing `ApiError` envelope with Hebrew messages: 404 `feature_disabled` / `ticket_not_found` (uniform for
invisible tickets), 403 `forbidden`, 409 `ticket_stale` / `invalid_transition` / `public_link_unavailable` / `assignee_not_allowed`
/ `channel_unavailable`, 413 / 415 / 422 for uploads and bodies, 429 with `retry_after_s`.

**Internal users as assignees** (Q4): an internal assignee works in Arx (signed in). The CR-018 notification `ticket.assigned`
always reaches them; if the user also has a directory entry linked by `ticket_contacts.user_id` with a phone, the WhatsApp message
carries a deep link to `#/tickets/<id>` on the remote address (sign-in required, no token). No handler-page token is ever minted
for an internal user.

## 9. The ticket message channel and WhatsApp

### 9.1 The interface (`services/tickets/channel.py`)

```python
class TicketChannel(Protocol):
    key: str                                   # 'whatsapp' | 'email' (later 'wa_business', 'sms')
    def status(self) -> ChannelStatus: ...     # state: connected | disconnected | unknown | not_configured; since; last_ok_at;
                                               # last_error_code; detail_for_admin (Settings only)
    def can_reach(self, contact: Contact) -> Reach: ...         # ok | no_address | opted_out | channel_down
    def send(self, msg: OutboundMessage) -> SendResult: ...     # never raises for an outcome; classifies (9.4)
    def supports_buttons(self) -> bool: ...
    def parse_inbound(self, event: dict) -> InboundMessage | None: ...   # None = not ours / not parseable
```

`OutboundMessage` = (recipient address resolved at send time from the directory, rendered text, optional buttons with ids
`t:<reply_nonce>:<action>`). `SendResult` = (`sent` | `refused` | `unknown` | `not_sent`, `outcome_code`,
`provider_message_id`). The registry maps a key to an adapter; the outbox worker, the inbound handler and the settings page see
only the interface. An official WhatsApp Business adapter later implements the same five methods (receipts would then fill an
optional `delivered_at`).

### 9.2 Outbox and paced worker (`services/tickets/outbox.py`)

- Every outbound message is first **written** (outbox row + timeline row + audit row, one transaction), then sent by one daemon
  thread `tickets-outbox` (started in `_start_janitor`, stopped in `_stop_janitor`). If the row cannot be written, nothing is
  sent (the CR-036 rule).
- One message in flight at a time per channel. Pacing (settings `tickets.settings.pacing`, defaults chosen for a personal-number
  Baileys session; `[WA-DOC]` gives no numbers, only "don't send hundreds per minute"):
  - minimum gap between two WhatsApp sends: **15 s + random 0-10 s** (human-like spacing);
  - at most **30 per hour** and **150 per day** per WhatsApp account (installation-wide);
  - at most **4 per hour** to one recipient (codes count; a 5th waits);
  - verification codes jump the queue (`priority 0`) but still respect the per-recipient cap;
  - quiet hours: reminders (purpose `reminder`) are held during the CR-018 quiet window (`notify_settings.in_quiet_hours`) unless
    the ticket's priority maps to `critical`; assignments and codes are never held (a person is waiting).
- `not_sent` (provably never left: HA unreachable before the request, service missing, channel disconnected, no phone) → retried
  up to 3 times over 30 min, then **fallback** (9.5). `refused` → no retry, fallback. `unknown` (timeout after the request was
  sent, connection dropped mid-request, malformed response) → **never retried** automatically (a retry could duplicate a message
  with a working link); the manager sees "ייתכן שנשלח" with a "שלח שוב" action.
- A newer message of the same purpose for the same assignment supersedes a queued older one (`superseded`); a revoked link
  cancels its queued messages.
- When the channel is `disconnected`, the worker does not call it; rows wait up to `hold_when_down_min` (default 15) and then go
  to fallback.

### 9.3 WhatsApp adapter (`services/tickets/channel_whatsapp.py`)

- Calls **only** `whatsapp.send_message` and (when `use_buttons` is on) `whatsapp.send_buttons` through
  `ha_client.call_service(settings, "whatsapp", <service>, data, return_response=True)` - a hard-coded allow-list of two services
  in the adapter; nothing else in the `whatsapp` domain is ever called (no `configure_webhook`, `send_image`, groups, auto
  responder). `data = {"account": <paired number>, "target": <digits>, "message": <text>}`; `send_buttons` adds
  `buttons: [{"id": "t:<nonce>:ack", "displayText": "התקבל"}, {"id": "t:<nonce>:wip", "displayText": "בטיפול"}]` and
  `footer`. `[WA-DOC]` documents that `send_message` with `response_variable` returns `success` and `message_id`; whether the
  REST `?return_response` path returns the same object is **UNVERIFIED** (slice 5 checks it on the owner's installation, read +
  one approved test send). If no `message_id` comes back, button matching uses the nonce only (9.6) - nothing depends on it.
- **Buttons default OFF** (`use_buttons: false`): `[WA-DOC]` warns modern multi-device clients may show text only. The default
  message asks for a **numbered text reply** ("1 = התקבל, 2 = בטיפול"), which every client can send. Polls are not used (votes
  need the original poll in the bot's memory `[WA-DOC]`).
- Media: none in release 1 (photos stay in Arx; `send_image` needs a URL reachable by the add-on and would put a photo URL in
  WhatsApp).
- Status: `ha-whatsapp` documents no connection entity on the pages read (UNVERIFIED). The administrator picks, in Settings, the
  integration's **connection-status entity** from the entity catalogue (any entity; "connected" = state in a configurable set,
  default `on`, `connected`, `online`); Arx reads it from its `ha_entities` mirror (no extra HA call). Without an entity, status
  is derived from sends: two consecutive `not_sent` with `service_not_found` / HA errors → `disconnected`; a `sent` → `connected`.
  A "שליחת בדיקה" button in Settings sends one fixed text to a number the administrator types (purpose `test`, rate 3/h, audited).
- The 14-day rule `[WA-DOC]` (the phone must connect at least every 14 days or every linked device is logged out): the settings
  page shows "last successful send" and the status; when status turns `disconnected` a CR-018 signal `ticket.channel_down`
  (category system) reaches `system.configure` holders; the guide tells the installer to keep the dedicated phone charged and
  online and to re-pair from the add-on when logged out.
- **Dedicated number (recommendation, Q5):** a separate WhatsApp (Business app) number used only for tickets, on a phone that
  stays on site. Reasons: ban risk is per number (Baileys is unofficial; `[WA-DOC]`: "may ... lead to a permanent account ban");
  one `ha-whatsapp` instance pairs one number `[WA-DOC]`; mixing with a person's chats exposes ticket links in their chat
  history; sharing with the access-control messages (CR-036 WA, via WisKey) would need one shared pacing budget.

### 9.4 Outcome classification (adapter, not `call_service`)

`ha_client.call_service` maps every `httpx.HTTPError` to one 503. The adapter therefore calls a thin variant
`ha_client.call_service_classified(...)` (new, same request) that distinguishes: `httpx.ConnectError` / `ConnectTimeout` →
`not_sent` (`ha_unavailable`); HTTP 400/404 → `not_sent` (`service_not_found`: integration missing); 401/403 → `not_sent`
(`ha_forbidden`); `ReadTimeout` / `RemoteProtocolError` after the body was written → `unknown` (`timeout`); HTTP 500 →
`unknown` (`ha_error`: HA may have called the integration); 200 with `success: false` in the response → `refused`; 200
otherwise → `sent`. The 15 s timeout stays.

### 9.5 Fallbacks

Order per recipient, decided when a send ends `not_sent` after retries, `refused`, or the channel is down:
1. **Internal user:** CR-018 notification `ticket.assigned` (always created anyway; the inbox and push reach the user).
2. **Contact with e-mail:** the same text by e-mail through `channel_email.py`, which reuses `notify_email.smtp_send(cfg, to,
   rendered)` with the existing SMTP configuration (a separate per-module counter, 10/hour; the CR-018 admin recipient list is
   not involved). If SMTP is not configured, skip.
3. **Nobody reachable:** the ticket goes to "waiting for manager" with reason `send_failed`; the ticket page shows one line
   "ההודעה לא נשלחה" and two actions: "העתק קישור" (copies the handler URL so the manager can send it himself - the only place
   a link is shown in the UI, `tickets.external`, audited `ticket.link.copy`) and "שלח שוב".

### 9.6 Inbound matching (`services/tickets/inbound.py`)

Subscription: when the module is on and the WhatsApp channel is configured, `ha_sync` subscribes to
`whatsapp_message_received` and `whatsapp_button_pressed` (a new `TICKET_EVENTS` tuple next to `AUTOMATION_EVENTS`, l.93; a
branch in `on_message`, l.784, that hands the raw event to `inbound.submit(event)` - a bounded queue drained by the outbox thread,
so the websocket thread never writes). The raw event is **never logged** (it holds a phone number and message text).

**Trust boundary (stated plainly):** an HA event is not authenticated by WhatsApp. Any HA administrator, automation or script can
fire `whatsapp_message_received` with any `sender_number` (HA `fire_event`). Therefore inbound messages are **advisory**: they can
only move a ticket **forward** to `acknowledged` or `in_progress`, or add a note marked "via WhatsApp (unverified sender)"; they
can never set `done`, `waiting_part`, return, close, change an ETA, or touch a ticket whose contact has `require_code` on (a
reply from such a contact is recorded as a note only). Everything with consequence happens on the handler page (token + optional
code) or in Arx.

Matching steps:
1. Ignore unless `type` in (`chat`, `text`, `button_reply`, `list_reply`) or the event is `whatsapp_button_pressed`; ignore group
   senders (`@g.us`), empty content, content over 1000 characters (kept as `ignored`).
2. `sender_key = HMAC(k_tickets, digits(sender_number))`. **Freshness:** `provider_at` older than 10 minutes, or more than 2
   minutes in the future → `stale` (protects against a re-delivered backlog after a reconnect). **Dedupe:** `dedupe_key` unique
   for 24 h → `duplicate` (the received event has no message id `[WA-DOC]`, so the key is built from sender, timestamp, type,
   selected id and content).
3. **Button tap** (`selected_id` / `button_id` = `t:<nonce>:<action>`): look up `ticket_outbox.reply_nonce`; the row must belong
   to a contact whose `phone_key == sender_key`, its link must be live, and its assignment current. If all hold → apply the
   action. A nonce from another sender → `refused` (audited). `whatsapp_button_pressed.message_id`, when present and stored, is a
   second check.
4. **Text reply:** candidates = live assignments of contacts with `phone_key == sender_key` whose last `sent` outbox row is within
   `reply_window_h` (default 72). Parse: a ticket reference `#?\d{1,7}` anywhere narrows candidates to that number; an action
   word or digit: `1` / "התקבל" / "קיבלתי" / "received" / "ok" → `acknowledged`; `2` / "בטיפול" / "מטפל" / "in progress" →
   `in_progress`; anything else → note.
   - exactly one candidate → apply (status if forward-only and allowed, else note);
   - zero candidates (unknown sender, or no recent message) → `unknown_sender`, nothing stored but the envelope;
   - several candidates and no reference → `ambiguous`: the text is kept (<= 1000 chars, 30 days) and every candidate ticket's
     managers see "תשובה לא משויכת" in "waiting for me"; a manager attaches it to one ticket or dismisses it.
5. **No automatic replies** in release 1 (Q14): every auto-reply is an extra message on a ban-sensitive number and a way for a
   stranger to probe which numbers are known.
6. Every applied action is a timeline row (`actor_kind = 'inbound'`, `via = 'whatsapp'`) and an audit row `ticket.inbound`
   (envelope: result, ticket, outbox id; no number, no content).
7. A sender who is an internal user with a directory phone (`ticket_contacts.user_id`) gets the same advisory treatment for
   tickets assigned to that user.

### 9.7 Message templates and content rules

Message templates (`ticket_templates kind='message'`) per purpose, department-specific or installation-wide, Hebrew, with an
allow-list of placeholders: `{name}`, `{number}`, `{title}`, `{place}`, `{device}`, `{priority}`, `{organization}`, `{link}`,
`{code}` (code template only), `{manager}`. Saved templates are validated: unknown placeholders, control characters, a URL that
is not `{link}`, more than 1000 rendered characters → 422 field problems. `{link}` is mandatory in `assign`/`reminder`
templates for contacts; `{code}` is mandatory in, and allowed only in, the `code` template, and the code message contains **no
link and no ticket title** (separate channel discipline: forwarding the link message alone is not enough). Starter templates
ship for each purpose. Default `assign` text:

```
שלום {name},
קריאה {number}: {title}
{place}
לעדכון הטיפול: {link}
לאישור מהיר השב 1 = התקבל, 2 = בטיפול
```

The rendered text is never stored (the outbox keeps template id + revision + params without `{link}` / `{code}`); the timeline
shows "נשלחה הודעת וואטסאפ" with the template name.

### 9.8 Relation to CR-018

The ticket channel is not a CR-018 delivery channel in release 1 (CR-018 delivers only to users; tickets talk to non-users). The
adapter is written so CR-018 can later register a `whatsapp` channel that wraps the same `TicketChannel` (removing it from
`CHANNELS_RESERVED`) - a separate decision.

## 10. External handler links

### 10.1 Where the page lives (decision with recommendation, Q2)

| Option | How | Pros | Cons |
|---|---|---|---|
| **A (recommended)** - dedicated listener + dedicated hostname | Public app on container port 18093 (add-on option `tickets_public`); a Cloudflare tunnel route `t-<customer>.<arx-domain>` → `http://<addon-host>:18093` (D11/D14 of CR-008: the provisioning script creates it on the Arx zone). Container ports are reachable by `cloudflared` on the add-on network without a host port mapping; LAN exposure only if the owner maps 18093 (not needed). | **Separate origin** from HA and `/arx` (an XSS in the vendor page cannot read `hassTokens` or the Arx session; Arx/HA cookies never reach it); the listener contains only `/t/*` routes - no route-enumeration risk, no Ingress trust, no reliance on `PUBLIC_ON_REMOTE`; independent of `remote_access`. | One more tunnel hostname per customer; one more listener in the process. Reachability via `cloudflared` on the container port is **UNVERIFIED** on the owner's setup (slice 4 checks it with the owner). |
| B - under the remote channel | `/arx/t/...` on the existing `remote_access` tunnel | No new hostname | Same origin as HA and Arx (`hassTokens` in a manager's browser who opens a link); needs `remote_access` on; every remote-channel guard (`RemoteChannel`, `pre-gate.ts`, `PUBLIC_ON_REMOTE`, the 64 KiB anonymous cap) must be punched through for uploads. |

Release 1 builds **A only**. Without a configured `public_base_url` (https, a hostname, no path beyond `/`), external
assignment is disabled with a clear reason in Settings and in the assign dialog.

### 10.2 Token

- `token = base64url(HMAC-SHA256(k_tickets, "tkt|" + link_id + "|" + generation))[:32]` (192 bits). Never stored; derivable for
  a resend or the manager's "copy link"; `ticket_links.token_hash = sha256(token)` is the lookup index (one indexed read). The
  owner's "store only a hash" holds: the database has the hash, the derivation key is outside the database and outside project
  backups (the cast relay `token_for` precedent).
- **URL form:** `https://t-<customer>.<arx-domain>/t/#<token>` - the token is in the **fragment**, which browsers never send in
  the request line, in `Referer`, or to Cloudflare logs. The page script reads `location.hash`, keeps the token in memory (and
  `sessionStorage` for reloads), replaces the address bar with `/t/` (`history.replaceState`), and sends it as
  `X-Ticket-Token` on every API call. A GET of `/t/` returns the same static shell for everyone, so a link-preview fetcher
  (WhatsApp clients fetch previews) learns nothing and changes nothing; the shell carries no Open Graph data and
  `X-Robots-Tag: noindex, nofollow`.
- **Scope:** exactly one ticket, one assignment, one contact. No endpoint takes a ticket id from the client.
- **Expiry:** `link_ttl_days` (default 14, range 1-90) from minting; a resend while the assignment is current does **not**
  extend it unless the manager chooses "קישור חדש" (bump generation, new expiry, old token dead). Revoked at once on close,
  cancel, reassign, return, manual revoke, key rotation.
- **Rate limits** (public app, in-memory buckets + `block_counters` persistence via the existing `RateLimiter`): unknown token
  → 20 failures/min per client network (`/64` or `/24`, from `CF-Connecting-IP`, trusted because the listener is only reachable
  through the tunnel; without that header, the peer address) and 300/min installation-wide, then 429 for everyone unknown; a
  known token → 60 requests/min, 20 updates/hour, 10 photos/hour, 30 photos total per assignment; code endpoints as in 10.5.
- **Uniform answers:** unknown, expired, revoked, module off, ticket purged → the same `404 {code: "link_unavailable"}` and the
  same page text ("הקישור אינו זמין עוד. לפרטים פנו למי ששלח לכם אותו."). Timing: the lookup is one indexed hash read in every
  case.

### 10.3 Public API (public app, port 18093; JSON; `X-Ticket-Token` header required on every `/t/api/*`)

| Route | What | Notes |
|---|---|---|
| `GET /t/` | static page shell (HTML, JS, CSS from `www-public/`) | identical for everyone |
| `GET /t/api/ticket` | the handler view: number, title, description, department name, priority name, place text, device name, the short history list (if the department shares it), the assignee's own timeline items and the manager's external-visible notes, photos (thumbnails), current status, ETA, the allowed actions, `code_required` / `code_ok`, the organization name | never: other assignees, internal notes, phone numbers, user ids, HA names, other tickets |
| `POST /t/api/status` | `{status: acknowledged\|in_progress\|waiting_part\|done, note?}` | forward and lateral moves only per 11.2; idempotent |
| `POST /t/api/note` | `{text}` (<= 2000, plain) | |
| `POST /t/api/eta` | `{eta_at}` (UTC ISO, within 90 days, not in the past) | |
| `POST /t/api/photo` | multipart, one image | section 10.6 |
| `GET /t/api/photo/{attachment_id}` | the photo (the assignment's ticket only) | `Cache-Control: private, no-store` |
| `POST /t/api/return` | `{reason}` (required, <= 500) | handing back to the manager (11.2); the page then becomes read-only |
| `POST /t/api/code/send` | ask for a verification code | 10.5 |
| `POST /t/api/code/verify` | `{code}` → `{session}` | 10.5 |

Every write: token valid + (code session valid when `require_code`) + assignment current + ticket not closed/cancelled + module
on; `client_request_id` (UUID) for idempotency (a repeat returns the first answer); a timeline row, an audit row (actor =
synthetic principal `contact:<id>`, `source = "ticket_link"`), and `last_activity_at` / `last_external_activity_at` updated.
Strict JSON (`extra = forbid`), `Content-Type: application/json` required (non-JSON → 415), no CORS headers at all.

### 10.4 Security headers of the public app

`Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self';
form-action 'none'; frame-ancestors 'none'; base-uri 'none'; manifest-src 'none'`; `X-Frame-Options: DENY`;
`Referrer-Policy: no-referrer`; `X-Content-Type-Options: nosniff`; `Cross-Origin-Opener-Policy: same-origin`;
`Cross-Origin-Resource-Policy: same-origin`; `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
(photos come through `<input type="file" accept="image/*">`, which needs no camera permission); `Cache-Control: no-store` on
the API; `X-Robots-Tag: noindex, nofollow`; no `Server` banner; the request log of this listener records method, route
template, status and duration only - never the path's fragment (never sent), headers, bodies or client addresses.

### 10.5 Option B: verification code (per contact)

- `ticket_contacts.require_code = 1` (set by `tickets.contacts.manage`; the vendor's row applies to its persons unless a person
  overrides it upward). Snapshotted into the link at mint; turning it on later raises live links of that contact at once;
  turning it off applies to new links only.
- With `require_code`, `GET /t/api/ticket` returns only number, department, organization and `code_required: true` until a code
  session exists (no title, place or description - a forwarded link alone discloses nothing beyond "a ticket exists").
- `POST /t/api/code/send`: sends a 6-digit code (uniform random, `secrets.randbelow`) through the contact's channel as a
  **separate message** with the `code` template (no link, no title). Limits: 1 per 60 s, 3 per hour, 6 per day per link; the
  previous unconsumed code is invalidated. Stored as `HMAC(k_tickets, link_id | code)`. Expiry 10 minutes.
- `POST /t/api/code/verify`: compares with `hmac.compare_digest`; 5 wrong codes per link in 15 minutes → link locked for 30
  minutes (`ticket_link_failures`; the `second_factor._Failures` pattern), the manager is told on the ticket ("נעילת קוד") and
  can unlock by resending a new link. A correct code is single-use and returns a 256-bit session value (stored as a hash in
  `ticket_link_sessions`, 12 h, never past link expiry) that the page sends as `X-Ticket-Session`; a new generation kills it.
- If the contact has no reachable channel for the code, the manager sees "לא ניתן לשלוח קוד" before assigning and must pick
  another contact or switch the setting.

### 10.6 Photo upload (public and internal share one validator, `attachments.py`)

- One file per request; per-route body cap 10 MiB + 64 KiB slack in the public app's own limit table; anything else on the
  public app is capped at 16 KiB.
- Accepted: JPEG, PNG, WebP, sniffed by magic bytes (the declared type and the file name are ignored); HEIC is refused with a
  clear message (iPhones convert to JPEG for web uploads by default; **UNVERIFIED** for every iOS version - the page tells the user
  to send "most compatible").
- `image_guard.check_pixels(im, 40_000_000)` before decode; decode under a semaphore (one decode at a time per process, 429
  `busy` after 5 s - `ui_background._decode_slot`); `ImageOps.exif_transpose`; convert to RGB; downscale to 2048 px long side;
  re-encode to a **fresh JPEG q82** (strips EXIF including GPS, ICC, XMP, thumbnails, any trailing polyglot payload); random
  16-hex file name; atomic write (`write_atomic`); SHA-256 recorded. The original bytes are never stored or served.
- Served only through authorized routes (`/api/v1/tickets/{id}/attachments/{aid}` with visibility, or the public route for the
  link's own ticket) with `Content-Type: image/jpeg`, `Content-Disposition: inline; filename="ticket-<number>.jpg"`,
  `nosniff`.
- Per-ticket cap 60 photos (all sources); per-installation directory cap 2 GiB with a refusal (507 `storage_full`) and a CR-018
  `system.health` style signal.

### 10.7 The page (UX)

Mobile-first, Hebrew RTL, one column, large touch targets (>= 44 px), no Arx/HA branding, the organization name at the top,
neutral styling from a small CSS file using the same token names (no skin switching), light/dark by `prefers-color-scheme`.
Sections: ticket card (number, title, place, device, priority), status buttons (התקבל / בטיפול / ממתין לחלק / בוצע - the current
one highlighted, invalid ones absent), ETA picker, note box, photo add (camera or gallery), the conversation timeline (what this
handler did + the manager's external-visible notes), and "החזרה למנהל" (with a required reason) at the bottom behind a
confirmation. States: loading, code required, locked, read-only after return, closed (the link is revoked on close, so a closed
ticket shows the uniform "unavailable" page), error with retry. Works without cookies; no third-party resources.

## 11. Ticket lifecycle

### 11.1 States

| Status | Hebrew | Meaning | waiting_on |
|---|---|---|---|
| `new` | חדשה | created, nobody assigned | manager (`unassigned`) |
| `assigned` | הועברה לטיפול | handed to an assignee, not yet acknowledged | assignee |
| `acknowledged` | התקבלה | the assignee confirmed receipt | assignee |
| `in_progress` | בטיפול | being handled | assignee |
| `waiting_part` | ממתינה לחלק | handling paused for a part / external dependency | assignee (own SLA threshold) |
| `done` | בוצעה | the assignee reports completion | manager (`done`) if the department requires manager close, else auto-closed |
| `returned` | הוחזרה למנהל | the assignee handed it back (cannot do it / wrong department / needs reassignment) | manager (`returned`) |
| `closed` | סגורה | final; a manager closed it (or auto-close after done) | none |
| `cancelled` | בוטלה | final; not to be handled (duplicate, mistaken) | none |

### 11.2 Transitions and who may do them

| From → To | Manager (`tickets.manage` in dept) | Internal assignee (current, `tickets.handle`) | External assignee (link) | Inbound WhatsApp | System |
|---|---|---|---|---|---|
| (create) → `new` | yes | creators with `tickets.create` | - | - (phase 2: `inbound` origin) | phase 2 (rule) |
| `new`/`returned` → `assigned` | yes (assign) | - | - | - | - |
| `assigned`/`acknowledged`/`in_progress`/`waiting_part`/`done` → `assigned` (reassign to another assignee) | yes (ends the current assignment `reassigned`, revokes its link) | - | - | - | - |
| `assigned` → `acknowledged` | yes (on behalf, noted) | yes | yes | yes (advisory) | - |
| `assigned`/`acknowledged`/`waiting_part` → `in_progress` | yes | yes | yes | yes (advisory, not from `waiting_part`) | - |
| `acknowledged`/`in_progress` → `waiting_part` | yes | yes | yes | no | - |
| `waiting_part` → `in_progress` | yes | yes | yes | no | - |
| `acknowledged`/`in_progress`/`waiting_part` → `done` | yes | yes | yes | **no** | - |
| any open assigned state → `returned` | - (a manager reassigns instead) | yes (reason required) | yes (reason required) | no | - |
| `done` → `closed` | yes | - | - | - | auto when `require_manager_close = 0` |
| `done` → `in_progress` (not accepted) | yes (reopens handling, note required) | - | - | - | - |
| open (any but `closed`/`cancelled`) → `closed` | yes (close without done, note required) | - | - | - | - |
| open → `cancelled` | yes (reason) | - | - | - | - |
| `closed` → `assigned` / `new` (reopen) | yes, within `reopen_days` | - | - | - | - |

The assignee can **never** assign or reassign (no API takes an assignee from them). `returned` ends their assignment, revokes the
link, and puts the ticket in the manager's "waiting for me" with the reason. Every transition: revision check (409
`ticket_stale` with the current row), timeline row, audit row `ticket.status` (from, to, actor kind), SLA recomputation,
notification signals (section 13).

### 11.3 Editable fields

Managers: title, description, category, priority (recomputes SLA dues from creation time), department (move: only with
`tickets.manage` in both departments; ends the assignment if the assignee is not allowed in the new department), place.
Creators may edit title/description while the ticket is `new`. Assignees edit nothing but status, notes, photos, ETA.

## 12. Device integration

### 12.1 Entry points (frontend)

| Surface | Today | Change |
|---|---|---|
| `<device-activity>` sheet (`components/device-activity.ts`) | tabs `activity`, `schedules` (l.32, l.284) | `type Tab = 'activity' \| 'schedules' \| 'tickets'`; the tabs array becomes computed: `activity` and `schedules` only when the device has activity tracking (today's behaviour for those rows), **`tickets` last**, only when the module is on and `canAnywhere('tickets.view')`; label "קריאות" with the count of open visible tickets as the existing `cnt` badge; `onTabKey` (l.299) iterates the computed list; the panel is the new `<device-tickets-tab entity-id=...>` (list of this device's tickets visible to the user, newest open first, status chip, age, assignee name; a "פתיחת קריאה" button when `tickets.create`). `ActivityOpen.tab` (`device-activity-press.ts:28`) gains `'tickets'`. |
| Long press (`ActivityPress`) | fires only on `data-activity` elements, set by `activityTag()` (l.39) for rows the server flags `activity` | `activityTag()` also returns a target for **any** catalogued entity row when the module is on and the user holds `tickets.view` (kind `none` = no activity tab); the long press then opens the sheet: on rows with activity it opens on `activity` as today, on rows without it opens on `tickets`. The right-click / menu-key menu (`renderMenu`) gains a third item "פתיחת קריאה" (with `tickets.create`) that opens the sheet on `tickets` with the create form open. (Q3: whether a long press should go straight to the create form.) |
| Hosts | `devices-area.ts:539`, `devices-area-bubble.ts`, `devices-tiles-panel.ts:209` | no host change beyond `activityTag()`; their `data-activity` sites already exist (l.1542/1679/1707/1726/1734, bubble l.501-586, tiles l.815). |
| Floor map card (`explore-floor-map.ts renderCard` l.2548, entity body `apiEntityBody` l.2400) | no tabs, no long press | one action "קריאות" in the existing `<details class="more">` block (clean screen: nothing on the face of the card) that dispatches `OPEN_EVENT` with `tab: 'tickets'`; markers do not get a long press in release 1 (the 2D canvas and 3D picking have no press infrastructure; the 3D walk long-press of `map/walk-touch.ts` is a selection gesture). |
| Settings catalogue (`explore-entities.ts`) | drawer | no change (management screen). |

`device-activity` is a single shell-level instance (`shell/sw-app.ts:86`), so the tab appears everywhere the sheet opens.

### 12.2 Place resolution (`services/tickets/place.py locate_entity(conn, entity_id)`)

1. Physical placement: current `map_anchors` row (`resource_type = 'ha_entity'`, `effective_to IS NULL`) via
   `correlation._anchor(conn, 'ha_entity', entity_id)` (l.149) → floor, building, site (soft-deleted rows ignored); room =
   `correlation._zone_at(conn, floor_id, x, y)` (l.138, smallest containing `spatial_zones` polygon). Several anchors (an entity
   placed on two floors, `ha_scope.placements` l.101): the first by floor level, the others listed in `place_text`.
2. Fallback without an anchor: `ha_entities.area_id/area_name` and `ha_floor_name`, and the zone linked to that HA area
   (`plan_area_links.area_to_zone`, `services/plan_area_links.py:129`).
3. `place_text` = "<floor name> · <room / area name>" (+ building when the site has several), e.g. "קומה 1 · חדר 102"; the
   handler message renders `{device}, {place}` → "מזגן חדר 102, קומה 1 · חדר 102" (the device name is the HA friendly name, the
   room name comes from the plan or HA area).
4. The ticket stores the ids and the text; the place target for RBAC is the floor (else site, else installation).
5. Rename safety: `registry_id` is stored; the device tab lists tickets by `registry_id` first, then `entity_id`.

### 12.3 The 24-hour history snapshot (`services/tickets/device_context.py`)

At creation from a device (or when a manager attaches a device later):
- Permission: the snapshot is taken **as the creator**: `ha_scope.scoped_rows(conn, principal, "devices.read", [{"entity_id": ...}])`
  must allow the entity, and for locks / alarm panels the router's `SECURITY_PERMISSIONS` rule (`routers/devices.py:154-187`)
  is replicated; otherwise `withheld = 'permission'` and nothing is captured (the ticket says "היסטוריה לא צורפה").
- Source 1 (tracked domains, `device_activity.ACTIVITY_DOMAINS`): `device_activity.list_activity(conn, entity_id, since=now-24h,
  until=None, actor=None, kind=None, limit=200, cursor=None, connected=ha_sync.STATE.connected)` (l.533); items keep `at`,
  `kind`, `from`/`to` state, `changed`, `actor.type`; **person names are dropped** (`actor.name` only when `actor.type` is not
  `person`); `coverage` kept.
- Source 2 (other entities): `SELECT state, changed_at FROM ha_state_history WHERE entity_id = ? AND changed_at >= ? ORDER BY
  changed_at DESC LIMIT 200` (30-day table).
- Stored in `ticket_device_context` (frozen; later history changes do not alter the ticket). Shown in the internal ticket
  detail as a compact timeline; on the handler page (when the department's `share_history_external` is on, Q8) as at most 10
  lines "14:05 · כבוי → פועל · אוטומציה" - no person names, no attribute dumps.

## 13. Manager tracking, SLA, reminders and escalation

### 13.1 Defaults (seeded for every new department; editable per department x priority)

| Priority | Unassigned | Acknowledge within | Stuck (no update) | Stuck while waiting for a part | Resolve within | Remind every | Notify severity |
|---|---|---|---|---|---|---|---|
| urgent (דחוף) | 15 min | 30 min | **1 h** | 1 day | 8 h | 30 min | critical |
| high (גבוה) | 1 h | 2 h | 8 h | 3 days | 2 days | 4 h | alert |
| normal (רגיל) | 4 h | 1 day | **3 days** | 7 days | 7 days | 1 day | alert |
| low (נמוך) | 1 day | 3 days | 7 days | 14 days | 30 days | 3 days | info |

Calendar time in release 1 (Q7). `max_reminders` 2, managers alerted after the first unanswered reminder.

### 13.2 What counts as progress

Any assignee action (status, note, photo, ETA), any manager action, an applied inbound action. Opening the link does not count
(a preview fetch could open it). `waiting_part` uses its own threshold. An ETA in the future suppresses the "stuck" (not the
"overdue") reminder until the ETA passes.

### 13.3 The monitor (`services/tickets/sla.py`)

A guarded step in `main.py janitor_tick` (runs every 30 s; the step self-throttles to 60 s with the `_LAST` pattern). It reads
open tickets with `next_check_at <= now` (index `idx_tickets_open_check`), computes the crossed thresholds, and in one write
transaction per ticket: sets `stuck_kind` / `stuck_level` / `waiting_on`, writes timeline rows, enqueues assignee reminders, and
emits CR-018 signals; then sets the next `next_check_at` (the earliest future due). Idempotent: a crossed threshold is acted on
once per level (stored `stuck_level`, `reminders_sent`).

Ladder per crossed threshold:
1. Remind the assignee: internal → CR-018 signal `ticket.reminder` (recipient = the assignee); external → outbox `reminder`
   message through the channel (with the link, paced, quiet-hours aware).
2. After `manager_alert_after_steps` unanswered reminders (or at once for `unassigned`, `returned`, `done`) → CR-018 signal
   `ticket.stuck` to the department's managers (recipient rule `ticket_managers`), severity from the priority.
3. After `max_reminders` → no more reminders; the ticket stays in "stuck" on the board until someone acts.

### 13.4 CR-018 integration (`services/tickets/notify_bridge.py`)

- New category `tickets` (`notify_policy.CATEGORIES`, and the two frontend lists in `frontend/src/api/notifications.ts`, l.29
  and l.258), subject kind `ticket` (`SUBJECT_KINDS`), recipient rules `ticket_managers` and `ticket_assignee`
  (`RECIPIENT_RULES` + a branch in `notify.recipients_for`, `notify.py:158`, the `generator` precedent), a visibility branch
  `kind == "ticket"` in `notify_visibility.Reach.can_see` (l.138) that calls `tickets.access.visible`, and a `_default_link`
  branch (`notify.py:98`) → `#/tickets/<id>`.
- Sources (`_ticket_sources()` appended to `SOURCES` like `_generator_sources()`; `enabled` forced off while the module is off):

| Source | When | Recipients | Default severity | Dedupe key / resolve |
|---|---|---|---|---|
| `ticket.new_unassigned` | a new ticket with no assignee (managers with `notify_new`) | ticket_managers | from priority | `ticket:<id>:unassigned` / resolved on assign |
| `ticket.assigned` | assigned to an internal user | ticket_assignee | from priority | `ticket:<id>:assign:<assignment>` / resolved on ack |
| `ticket.reminder` | SLA reminder to an internal assignee | ticket_assignee | from priority | `ticket:<id>:remind:<n>` |
| `ticket.stuck` | threshold crossed past the reminders | ticket_managers | from priority | `ticket:<id>:stuck:<kind>` / resolved on progress |
| `ticket.returned` | the assignee returned it | ticket_managers | alert | `ticket:<id>:returned` / resolved on reassign |
| `ticket.done` | done, awaiting manager close | ticket_managers | info | `ticket:<id>:done` / resolved on close |
| `ticket.reply_unmatched` | an ambiguous WhatsApp reply | ticket_managers (of each candidate) | info | `ticket-inbound:<id>` / resolved when handled |
| `ticket.send_failed` | a message could not be sent and no fallback reached | ticket_managers | alert | `ticket:<id>:send` / resolved on the next successful send |
| `ticket.channel_down` | the WhatsApp channel went disconnected | `managers` (system) + `system.configure` | alert | `ticket-channel:whatsapp` / resolved on reconnect |

  The ticket's priority maps to the signal severity (`ticket_priorities.notify_severity`), so urgent tickets pass quiet hours
  (`critical`) and get CR-018's own escalation to administrators if nobody acknowledges (CR-018 §8.3) - the administrator can
  turn that off per source in the existing matrix. Notification text names the place and the ticket number only.
- Acknowledging a ticket notification in the CR-018 centre does not change the ticket (the ticket has its own actions).

### 13.5 The manager board (`#/tickets/board`)

Sections (each a compact list, newest risk first; counts in the section header; filters: department (only mine by default),
priority, assignee):
1. **ממתין לי** - `waiting_on = 'manager'`: unassigned, returned (with the reason), done awaiting close, unmatched replies,
   failed sends, expired links on open tickets, code lock-outs.
2. **תקועות** - `stuck_kind` set: which threshold, since when, reminders sent.
3. **בטיפול** - grouped by assignee (user / contact / vendor): each with open count, oldest age, last activity, ETA.
4. **נסגרו לאחרונה** - collapsed by default.

Columns everywhere: `#number`, title, place, department, assignee, age ("פתוחה 2 ימים"), last activity, status chip. Live
refresh through the existing `/me/ws` style push is out of scope; the board polls every 30 s while visible.

## 14. Settings and screens

### 14.1 `tickets.settings` document (JSON, `system.configure`, revision-checked)

```json
{
  "revision": 1,
  "organization_name": "",
  "public_base_url": "",                    // https://t-<customer>.<arx-domain> ; validated https + hostname
  "link_ttl_days": 14,                      // 1-90
  "code": { "length": 6, "ttl_min": 10, "max_attempts": 5, "lock_min": 30 },
  "whatsapp": {
    "enabled": false,
    "account": "",                          // the paired number, digits only (shown masked except in this form)
    "status_entity_id": null,               // optional catalogue entity that reports the connection
    "connected_states": ["on", "connected", "online"],
    "use_buttons": false,
    "reply_window_h": 72,
    "pacing": { "min_gap_s": 15, "jitter_s": 10, "per_hour": 30, "per_day": 150, "per_recipient_hour": 4, "hold_when_down_min": 15 }
  },
  "email_fallback": true,
  "retention": { "closed_days": 730, "contacts_inactive_days": 365, "inbound_days": 30, "outbox_days": 90, "link_access_days": 90 }
}
```

### 14.2 Screens

- **Operator area "קריאות"** (`#/tickets/...`; Q1 recommends its own top-level area): tabs "שלי" (assigned to me / opened by
  me), "המחלקה" (my departments), "לוח מנהל" (managers only), "הכול" (`tickets.all_departments` only). New `Mode` `tickets` in
  `router.ts` (`MODES`), `parseRouteLite` in `nav.ts`, `NAV_A`, `AREA_TABS`, `TAB_PERMISSIONS`, `services/user_prefs.py NAV_TAB_IDS`,
  `sw-app.ts renderScreen`. Ticket detail `#/tickets/<id>`: header, place line (link to the map when anchored), device link,
  assignee + channel line ("וואטסאפ · נשלח 14:02" / "ייתכן שנשלח" / "לא נשלח"), actions by permission, timeline, photos,
  history snapshot. Create sheet: department, category (preselected from device domain), priority, title, description, photos,
  "העבר לטיפול" (optional, managers). Clean-screen rule: no explanatory paragraphs; statuses as chips; one-line states.
- **Settings › קריאות שירות** (`#/system/tickets`, tab id `tickets`, in `AREA_TABS.system`, `SETTINGS_GROUPS` of
  `screens/system-index.ts`): sub-tabs (`?tab=`): כללי (switch, organization name, public address with a "בדיקת כתובת" probe
  that fetches `<base>/t/healthz` from the add-on, link expiry, retention, key rotation), מחלקות (list; editor with categories,
  priorities, SLA matrix grid, members, templates, flags), אנשי קשר וספקים (directory; `tickets.contacts.manage`; phone shown
  masked "•••• 4567" except to `tickets.external`), ערוץ הודעות (WhatsApp: on/off, account, status entity, buttons, pacing,
  test send, last successful send, channel status; this is a settings screen, so naming the integration is allowed here, but
  the UI text says "וואטסאפ" and "תשתית המערכת", never "Home Assistant"), תבניות הודעה.
- **The WhatsApp-disconnected UX** (operator side): the assign dialog shows one line "וואטסאפ לא מחובר - ההודעה תישלח במייל"
  / "... - העתק קישור ושלח בעצמך" according to the fallback; the ticket shows the delivery line; nothing else on operator
  screens. Administrators get `ticket.channel_down`.
- Five skins: the new screens use existing components (`sw-page`, `sw-card`, `sw-sheet`, `sw-tabs`, chips) and `--sw-*` tokens only;
  any skin-specific rule stays within each skin's 50-rule budget; layout-guard specs extended.

## 15. Retention and privacy

### 15.1 Retention (janitor step `tickets.retention.janitor`, self-throttled to hourly)

| Data | Kept | Then |
|---|---|---|
| Closed / cancelled tickets with events, attachments, device context, assignments, links | `closed_days` (default 730, range 90-3650) after close (`purge_after`) | hard delete rows + files |
| Open tickets | while open | - |
| Outbox rows | 90 days | delete (the timeline keeps "message sent") |
| Inbound rows | 30 days (`ambiguous` content: 30 days or when handled, whichever first) | delete |
| Link access rows | 90 days | delete |
| Codes, link sessions | 1 day after expiry | delete |
| Expired / revoked links | with their ticket | - |
| Audit rows | existing 365 days | existing prune |
| Contacts | while active; inactive (not assigned) for `contacts_inactive_days` → flagged "לבדיקה" in the directory | erased only by a person (15.2) |

### 15.2 External people's data

- Stored about a non-user: name, company, phone, e-mail, notes, which tickets they handled, what they wrote and uploaded. Purpose:
  handling the organization's tickets. Shown only to holders of the ticket permissions; full phone only to `tickets.external`.
- **Erase** (`tickets.contacts.manage`, confirmation, audited `ticket.contact.erase`): replaces name with "איש קשר שנמחק", clears
  phone, phone_key, e-mail, notes; revokes live links; queued messages cancelled; the timeline keeps the frozen `assignee_name`
  / `actor_name` unless "מחק גם מההיסטוריה" is chosen, which rewrites those to the tombstone name (notes and photos the person
  added stay as ticket content - the organization's record - and are removed with the ticket at retention).
- Export of a contact's data (on request of the person): `GET /tickets/contacts/{id}/export` (JSON of the row and of the
  timeline items authored through their links), `tickets.contacts.manage`, audited.
- The WhatsApp messages themselves live in the dedicated phone and in the recipient's WhatsApp; Arx cannot delete them. The
  guide says so.

## 16. Security and privacy review

| # | Threat | Mitigation | Residual |
|---|---|---|---|
| T1 | **Token guessing / enumeration** | 192-bit derived token; lookup by hash; uniform 404 for unknown/expired/revoked/off; 20 failures/min per network + 300/min global then 429; no ticket ids accepted from the public client; sequential ticket numbers never act as credentials | negligible |
| T2 | **Link forwarding** (the vendor forwards the WhatsApp message) | scope = one ticket; expiry 14 days; revocation on close/reassign/return/manual; the page shows no other tickets, no phone numbers, no internal notes; option B code sent separately for sensitive vendors (title and place hidden until the code); manager sees opens from distinct devices (`client_key`) | without option B, whoever holds the message can update that ticket until it expires or closes - accepted by the owner's default |
| T3 | **Token leakage in transit / logs** | token in the URL fragment (not in the request line, Referer or Cloudflare logs); `Referrer-Policy: no-referrer`; public listener logs route templates only; Arx never logs outbox texts, tokens, codes or event payloads; a log-scan test greps captured logs for the test token, the test phone and the test code | the full URL **is inside the WhatsApp message text** handed to `whatsapp.send_message`: Home Assistant may record the service call and `ha-whatsapp` fires `whatsapp_message_sent` with `content` `[WA-DOC]`, which HA's recorder can store - **UNVERIFIED** which of these HA keeps by default. HA administrators are inside the trust boundary; the guide recommends excluding the `whatsapp_message_*` event types from the recorder. |
| T4 | **XSS through notes / names / titles** | all user text is plain text (length-capped, control characters stripped), rendered with Lit text bindings / `textContent` in the public page - never `innerHTML`, `unsafeHTML` or Markdown; strict CSP with `script-src 'self'`, no inline script; message templates validated | low |
| T5 | **Hostile uploads** (bombs, polyglots, SVG, EXIF/GPS leaks, path tricks) | magic-byte allow-list (JPEG/PNG/WebP), pixel check before decode, process-wide bomb threshold (`image_guard`), decode semaphore, full re-encode to fresh JPEG (no metadata, no trailing bytes), random names, confined paths, per-link/hour and per-ticket caps, served with fixed type + `nosniff` | Pillow vulnerabilities (dependency watch, `upstream_watch.json`) |
| T6 | **Replay / forgery of inbound events** | inbound is advisory (forward-only to acknowledged/in progress, notes marked unverified; never done/close/return; contacts with option B: notes only); freshness window 10 min; dedupe 24 h; button nonces bound to the sender's phone key and the live link; no auto-replies | an HA administrator can fake a reply - they could do more anyway |
| T7 | **Phone-number exposure** | numbers only in `ticket_contacts.phone_e164`; inbound uses an HMAC key, never stores the sender's number; outbox stores no number; audit/timeline/logs never carry numbers; API masks except to `tickets.external`; numbers never in URLs | the database file and add-on backups hold numbers (like the rest of the organization's data) |
| T8 | **Session/CSRF on the public app** | no cookies; the token and the code session travel in custom headers (a cross-site form or image cannot set them; no CORS, so a cross-origin script cannot send them); JSON-only writes | - |
| T9 | **Brute force of the verification code** | 6 digits, 10-min expiry, 5 attempts per link per 15 min → 30-min lock, 3 codes/hour, single use, HMAC-hashed, constant-time compare | ~5/10^6 per window |
| T10 | **Abuse of the channel (spam / ban)** | sends only from authenticated manager actions and the SLA monitor; pacing and daily caps; codes capped; no auto-replies; test sends capped; dedicated number recommended | Baileys ban risk remains (unofficial client) |
| T11 | **Privilege leaks between departments** | one `visible()` function used by every list, detail, device tab, notification visibility and board query; tests per path with a member / non-member / all-departments / deny-binding matrix | - |
| T12 | **Public listener as a pivot** | separate app object with only `/t/*`; no DB write gate held across image work (`unlocked(conn)` pattern); its own body limits; not started unless the option is on; reachable only through the tunnel unless the owner maps a port; a route-enumeration test asserts the app's route set | - |
| T13 | **Message content injection** (a manager-typed title going to WhatsApp) | templates render with plain placeholders; titles are plain text; no URL other than `{link}` allowed in templates | a manager can still write anything in a title - it is their message |
| T14 | **Retention / GDPR-like duties for external people** | retention table 15.1, erase and export (15.2), minimal fields, purpose-bound display | messages already delivered to WhatsApp cannot be recalled |
| T15 | **Key compromise** | `k_tickets` in `/data/secrets` (mode 600), not in DB or project backups; rotation revokes all links | a host-level compromise exposes everything anyway |

Physical-safety note: tickets never trigger device actions; a device ticket never controls the device. Nothing in this module
calls an HA service other than the two WhatsApp send services.

## 17. Observability

- **Health** (`GET /api/v1/tickets/health`, `system.configure`; shown in Settings › קריאות שירות › כללי and in the diagnostics
  screen): module on, public listener running + last request time, public base URL probe result, outbox depth by state, oldest
  queued age, sends last 24 h by outcome, channel status + since + last success, inbound last 24 h by result, links live / expired
  / locked, SLA monitor last run + duration, attachment directory size.
- **Logs:** logger `smplwise.tickets.*`; ids only (ticket id, outbox id, link id prefix 6 chars); never phone, token, code,
  message text, event payload; warnings for channel down, monitor errors, upload refusals (reason code only).
- **Audit actions:** `tickets.module.enable|disable`, `tickets.settings.update` (revision + changed keys, never values of
  account/phones), `ticket.create|edit|assign|status|note|photo|eta|return|close|cancel|reopen`, `ticket.link.mint|resend|
  revoke|copy`, `ticket.code.send|verify|lock`, `ticket.message.send` (outbox id, channel, purpose, outcome - never text,
  number, token), `ticket.inbound` (result, ticket id), `ticket.contact.create|update|erase|export`,
  `ticket.department.create|update|delete`, `ticket.sla.update`, `ticket.template.update`, `ticket.key.rotate`; public refusals
  throttled like `REFUSAL_AUDITS`.
- **Upstream watch:** add `FaserF/ha-whatsapp` (add-on + integration) to `management/upstream_watch.json` (owner rule: every
  integration we depend on is tracked).

## 18. Phase 2 hook: creation by rules

`services/tickets/create.py`:

```python
@dataclass(frozen=True)
class TicketSpec:
    department_key: str
    title: str
    description: str = ""
    category_id: str | None = None
    priority_key: str = "normal"
    entity_id: str | None = None          # device-originated: place + 24 h history are resolved as for a person
    origin: Literal["manual", "device", "rule", "inbound"] = "manual"
    rule_ref: str | None = None
    dedupe_key: str | None = None         # an OPEN ticket with this key absorbs the repeat (a 'note' timeline row, count) instead of a new ticket
    assign_to: AssigneeRef | None = None  # only for manual/device; rules in phase 2 never assign to external contacts by default

def create_ticket(conn, spec: TicketSpec, actor: Actor) -> CreateResult: ...   # created | absorbed | refused(reason)
```

Release 1 uses it for every manual and device creation (one code path). Phase 2 adds: `"ticket"` to `services/rules.py:22
ACTION_KINDS` and the `routers/rules.py:53` regex, a per-kind permission check (`tickets.create` + `rules.manage`), the action
form (department, template, priority), the actor `system:rule:<id>` (department policy decides whether rule tickets may be
created), and `dedupe_key = "rule:<rule_id>:<entity|camera>"`. Estimated 6-8 agent-hours once release 1 exists. A HA-side
`smplwise_bridge.create_ticket` service is a separate decision (it changes `custom_components`).

## 19. Test plan by layer

| Layer | What | Tool / place |
|---|---|---|
| Unit (backend) | state machine table (every row of 11.2 allowed / refused per actor); SLA calculator with a fake clock (each threshold, ETA suppression, waiting_part clock, idempotent ladder); token derivation / hash / generation bump; code issue / verify / lock; inbound parser (Hebrew/English words, digits, references, groups, long text) and matcher (one / none / several candidates, nonce of another sender, stale, duplicate, require_code contact); template validation; place resolution (anchor, several floors, zone, HA-area fallback, none); history snapshot (tracked, untracked, withheld, person names dropped); outcome classification of the adapter (connect error, read timeout, 4xx, 5xx, success false) | `smplwise_vms/backend/tests/test_tickets_*.py` |
| Backend API | every internal route with permission matrix (viewer / operator member / operator non-member / manager / manager other department / all-departments / deny binding / module off → 404); optimistic revision 409; assignee picker; device tab listing by `registry_id`; notifications created with the right recipients and visibility; backup PROJECT_TABLES content | pytest + existing fixtures |
| Public app | route enumeration (only `/t/*`); main app 404 for `/t/*` on Ingress and `/arx`; headers (CSP etc.) on every response; uniform 404 for unknown/expired/revoked/off/purged; rate limits (429); JSON-only and size caps; every write path with and without code session; return makes the page read-only; idempotent `client_request_id` | pytest with an ASGI client on the public app |
| Uploads (hostile) | decompression bomb, huge dimensions, truncated JPEG, PNG with trailing ZIP, SVG/HTML renamed .jpg, HEIC, EXIF GPS present → stripped (assert re-read has no EXIF), 10 MiB + 1 byte, 61st photo | pytest with generated files |
| Channel / outbox | fake `ha-whatsapp` (`tests/fake_ha_whatsapp.py`: records `call_service` payloads, configurable outcomes, injects events); pacing (gap, per-hour, per-day, per-recipient, codes first); quiet-hours hold for reminders only; supersede; fallback to e-mail (fake SMTP) and to "waiting for manager"; channel down/up signals; never retry `unknown` | pytest |
| Log hygiene | run the full send + inbound + public flows with a capturing log handler; assert the test phone, token, code and message text appear nowhere in logs or audit rows | pytest |
| Migrations | 0079-0081 apply on an empty DB and on a 2.4.8 DB copy fixture; foreign keys; indexes exist | existing migration tests |
| Frontend unit | tabs computation of `device-activity` (with / without activity, with / without permission, module off); `activityTag` for non-tracked rows; text catalogue completeness; public page state reducer | node unit tests (`frontend/tests/unit-*`) |
| Playwright (internal) | list, board, detail, create sheet, device tab (area screen long press, menu item, map card "more" action), settings tabs; desktop / tablet / mobile / RTL; loading / empty / error / ready; five skins; layout guards; visual baselines for new screens only | `--workers=1` locally; full runs on the runner |
| Playwright (public page) | mobile 375 px + desktop; code flow; photo upload; return; unavailable page; dark mode; no external requests (network assertion); bundle size budget | separate spec project against the public app |
| Live (owner-approved only) | one read of the `ha-whatsapp` entities and the `return_response` shape; one test send to the owner's own number; one inbound reply from the owner's phone; one tunnel route to 18093 | **NOT_RUN** until the owner approves each action (CLAUDE.md: no writes / messages without task-specific approval) |

Tier: **L** (a new unauthenticated surface, uploads, outbound messages).

## 20. Slices, effort and order

Effort in agent-hours (one capable agent; includes tests and docs of the slice, excludes runner queue time).

| # | Slice | Contents | Effort | Depends on |
|---|---|---|---|---|
| 1 | Skeleton + internal tickets | module switch + `/me` flag; migration 0079 (all core tables, one seeded "אחזקה" department with priorities + default SLA); `services/tickets` store/model/access/create; internal routes (CRUD, timeline, status, notes, photos internal, assign to internal users, assignee picker); permissions in `PERMISSION_LABELS` / `roles.json` / labels; audit; nav area + list + detail + create sheet; i18n catalogue; demo store | 22-28 | - |
| 2 | Departments + SLA | settings screens (departments, categories, priorities, SLA grid, members, ticket templates); revision-checked admin routes; SLA due computation on every change (no monitor yet); department scoping tests | 14-18 | 1 |
| 3 | Device tab | `device-activity` third tab, `activityTag` for all entities, menu item, map card action, `place.py`, `device_context.py`, device-originated creation, category preselect by domain | 12-16 | 1 (2 for category preselect) |
| 4 | Public page + links + directory | migration 0080; contacts directory (screens, masking, erase/export); `links.py`; public app on 18093 + add-on option + port; second Vite entry + page; public API; uploads validator; headers; rate limits; assignment to contacts with channel `manual` (copy link) | 22-28 | 1, 2 |
| 5 | WhatsApp channel + inbound | migration 0081; channel interface, WhatsApp + e-mail adapters, outcome classification, outbox worker + pacing, fallbacks, message templates, settings tab, status entity, test send, `ha_sync` subscription, inbound parser + matcher + ambiguous queue, fake `ha-whatsapp` | 20-26 | 4 |
| 6 | Stuck / escalation + board | SLA monitor in the janitor, reminder ladder, CR-018 sources / category / recipient rules / visibility branch, manager board screen | 14-18 | 2, 5 (external reminders) |
| 7 | Verification code (option B) | contact flag, code send/verify/lock, code session, page states, manager lock-out view | 8-10 | 4, 5 |
| 8 | Guide + review + gate | DOCS.md section + Hebrew user guide (installer: dedicated number, pairing, 14-day rule, tunnel route, recorder exclusion), security review of the public surface, upstream watch entry, bilingual changelog lines, tier-L gate on the runner | 8-12 (+ gate runtime) | all |

**Total: 120-156 agent-hours** (≈ 4-5 working days with 3 agents in parallel after slice 1). Phase 2 rule action: 6-8 more.

**Recommended order:** 1 → 2 → (3 ∥ 4) → 5 → (6 ∥ 7) → 8. Slice 1 is the single owner of the shared files (`roles.json`,
`routers/access.py PERMISSION_LABELS`, `shell/nav.ts`, `router.ts`, `sw-app.ts`, migration 0079); later slices touch shared CR-018
files (`notify_policy.py`, `notify.py`, `notify_visibility.py`) only in slice 6, and `ha_sync.py` only in slice 5.

## 21. Risks

1. **First anonymous write surface** in the product (public listener + uploads). Mitigated by isolation (separate app, origin,
   port, option) and the tests of section 19; a dedicated security review in slice 8 before any customer enables it.
2. **WhatsApp via an unofficial client** (Baileys): number bans, no receipts, logout after 14 days without the phone, buttons
   that may not render. Mitigated by pacing, a dedicated number, fallbacks, "handed over" wording, the status line; the
   interface admits the official API later.
3. **Inbound trust and matching**: HA events can be fired by anyone with HA admin rights; replies lack message ids. Mitigated by
   the advisory-only rule, nonces, freshness and dedupe, and manager handling of ambiguous replies.
4. **Link text persistence outside Arx** (the vendor's chat, HA's recorder/logbook). Mitigated by expiry/revocation, option B,
   and a recorder exclusion recommendation; cannot be eliminated.
5. **Department scoping outside the RBAC scope model**: a second "where" dimension that every query must respect. Mitigated by
   one `visible()` function and a matrix of permission tests per path, including notifications and the device tab.
6. **Device window fragmentation**: four different device surfaces; only the activity sheet has tabs, and long press exists only
   on area/tile screens. The CR adds the tab there and a map-card action; other surfaces (bubble skin sheet without the activity
   sheet, 3D) stay without a direct entry in release 1.
7. **Tunnel / hostname provisioning** per customer for the public page (owner or installer action; UNVERIFIED reachability of a
   second container port through `cloudflared`).
8. **Personal data of non-users** (phones, names, photos): retention and erase must work from day one.
9. **Parallel migration numbers** (0079-0082 may be taken by another branch first): renumber at integration.

## 22. Open questions (for the owner; recommendations marked)

| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | Where does the module live in the menu? | (a) its own area "קריאות" (b) under "תשתיות" (c) under "מכשירים" | (a) - tickets span departments beyond infrastructure |
| Q2 | Public address of the handler page | (a) a dedicated address per customer (separate listener) (b) under the existing remote address `/arx/t` | (a) - isolation from HA and Arx sessions |
| Q3 | Long press on a device | (a) opens the device window, new tab "קריאות" with a "פתיחת קריאה" button (b) opens the new-ticket form directly | (a) - keeps today's long press, one more tap |
| Q4 | An internal user as assignee | (a) a WhatsApp/in-app message with a link to Arx that requires sign-in (b) the same token link as externals | (a) - users already have an identity |
| Q5 | WhatsApp number | (a) a dedicated number only for tickets (b) shared with the access-control messages | (a) - ban risk and pacing per number |
| Q6 | "Done" by the handler | (a) waits for the manager to close (per department, default) (b) closes automatically | (a) |
| Q7 | Stuck clock | (a) calendar time in release 1 (b) working hours per department | (a) now, (b) later if needed |
| Q8 | Device history on the handler page | (a) up to 10 lines, no person names (default, per department switch) (b) none (c) full | (a) |
| Q9 | What a WhatsApp reply may change | (a) only "received" / "in progress" + a note; "done" only on the page (b) also "done" | (a) - replies are not authenticated |
| Q10 | Keep closed tickets | (a) 2 years (b) 1 year (c) 7 years | (a), adjustable |
| Q11 | Data store | (a) the existing database with a separate storage layer (b) a separate database file (c) Postgres | (a) - low write rate; the layer keeps (b)/(c) possible |
| Q12 | Channel for the verification code | (a) a separate WhatsApp message, e-mail as fallback (b) wait for SMS | (a) |
| Q13 | Ticket number | (a) one running number per installation "#1042" (b) per department prefix "MNT-1042" | (a) |
| Q14 | Automatic replies to unmatched WhatsApp messages | (a) none; the manager sees them (b) one automatic reply per sender per hour | (a) - fewer messages on the number |

## 23. Sources

- `ha-whatsapp` documentation, read 2026-10-13: `https://faserf.github.io/ha-whatsapp/` (overview), `services.html`
  (`send_message` fields `account`, `target`, `message`, optional `quote`/`reply_to`/`expiration`; `response_variable` returns
  `success`, `message_id`; `send_buttons` with `buttons[{id, displayText}]`, `footer`, the warning about multi-device clients),
  `events.html` (`whatsapp_message_received`: type, sender, sender_number, sender_name, content, selected_id, vote, media_url,
  timestamp - no message id; `whatsapp_button_pressed`: sender, sender_number, sender_name, button_id, button_text, message_id,
  timestamp; `whatsapp_message_sent` with `id`, `content`, `recipient_number`, `entry_id`, `session_id`), `webhooks.html`
  (incoming messages only, `X-Webhook-Token`; no receipts documented), `limitations.html` (Baileys, ban risk, 14-day phone
  rule, one number per instance, media URL reachability, buttons/polls caveats). `[WA-DOC]`
- Repository files as cited in sections 4-19 (`origin/main` @ `b26c1b7d`; `origin/integ/249`; `origin/pilot/WXPERM`).
