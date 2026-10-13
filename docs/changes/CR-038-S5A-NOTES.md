# CR-038 slice 5a - WhatsApp account selection per use: implementation notes

Branch `pilot/TICKETS-s5a`, cut from `origin/pilot/TICKETS-s1` @ `02f6a57a` with `origin/pilot/TICKETS-msg-core` @ `73d123db` merged
(conflict in `services/tickets/__init__.py` resolved by keeping both docstrings). Spec: `docs/changes/CR-038-TICKETS-MODULE.md`
sections 7.3A, 8 (`messaging.accounts.manage`), 9.2, 9.3, 9.9 (9.9.1-9.9.5), 14.2, 15.1, 17, 19, 20 (row 5a); decisions D9, D13, D27,
D33. Nothing here ran against a real Home Assistant, `ha-whatsapp`, phone or network: fakes and fixtures only.

## 1. What slice 5a delivers

**Migration `0082_messaging_accounts.sql`** - the shared per-account send ledger `messaging_send_ledger` exactly as section 7.3A
(two indexes, no number column; `recipient_key` = HMAC with `k_messaging`). Independent of 0080 / 0081 (the reserved numbers of
slices 4 and 5b); `Database.migrate()` applies gaps, so the order of integration does not matter. `messaging_accounts.LEDGER_DDL` is
now read from the migration file itself (found by name `*_messaging_accounts.sql`), so the SQLite ledger of the message core is tested
against what the database gets. The ledger is operational data: not a project-backup table; the janitor prunes it after 2 days.

**`services/messaging_runtime.py`** - the message core's `messaging_accounts.py` wired into the product:
- the `messaging.whatsapp` document on the `settings` table (`load_doc` / `store_doc`; already in `backup.SETTINGS_KEEP` by slice 1;
  never in `GET /settings`);
- the account service on the REAL entity mirror: `service(conn)` for a request, `accounts_service(db)` for a worker thread (short read
  connections per call; the document, the registry and the module switch are read when asked, so a moved use applies to the next
  claim, D27); one process-wide `SendStateTracker` (`TRACKER`) shared by routes and the worker;
- the registration point other modules join: `register_uses(provider)`, `register_departments(module, fn)`,
  `register_label_renderer(module, fn, module_label)`; tickets registers its two uses, its active departments and the D33 renderer;
- `DbSendLedger(db)`, `messaging_key(data_dir)` (`<data>/secrets/messaging_key`, 32 bytes, 0600, atomic create), `recipient_key()`;
- `janitor(db)` (hourly; called from `main.py janitor_tick`);
- `view()` - the Settings answer; `resolution_moves()` - which (use, department) changes account between two documents and how many
  queued messages would leave from the new account;
- the hooks of slice 5b: `QUEUED_COUNTER(conn, use_key, department_id)` and `TEST_SENDER(conn, account_ref, digits, requested_by)`.

**`routers/messaging_accounts.py`** (mounted in `main.py`, installation-level, NOT behind the tickets module gate):

| Route | Gate | What |
|---|---|---|
| `GET /messaging/whatsapp` | `messaging.accounts.manage` (edit) or `system.configure` (read-only) at installation scope | accounts (key, kind, label or suggestion, last four, state + source, in mirror, stored, shared outside, pacing, uses mapped, sends in the last 24 h, last send), active uses with label (D33-rendered), inheritance, per-department rows, queued counts, raw mapping, warnings, channels (WhatsApp / e-mail / in-app / SMS `soon`), module labels, pacing ranges, `test_send.enabled`. A manual account's typed value only for `messaging.accounts.manage` |
| `PUT /messaging/whatsapp` | `messaging.accounts.manage` | the whole document, revision-checked (409 `settings_stale`); 422 field problems from `validate_doc` (unknown use / account, manual value rules, manual = discovered entry id refused, pacing ranges); `last4` is never a client field (the server keeps the refresh's digits, a manual account's come from its value); 409 `queued_messages` with `details.moves` when a use with queued / held messages changes account, until `confirm_queued: true`; audit `messaging.accounts.update` (use keys + account keys before / after, account keys added / removed / changed, the moved count - never a number, value or label) |
| `POST /messaging/whatsapp/refresh` | `messaging.accounts.manage` | forget the `missing` marks, re-read the mirror, read each connection entity ON DEMAND (`ha_client.get_state`, outside the write lock) and keep only the last four digits; first-seen accounts get a stored entry with the suggested label; revision bumps only when something changed; audit `messaging.accounts.refresh` (counts only) |
| `POST /messaging/whatsapp/test` | `messaging.accounts.manage`, local channel only | 409 `test_send_off` until slice 5b registers `TEST_SENDER` AND the owner approved live sends (`SW_MESSAGING_TEST_SEND=1`); the typed number is never stored, logged or audited; audit `messaging.accounts.test` (account key, state) |

`remote_channel.BLOCKED_ON_REMOTE` gains `/api/v1/messaging/whatsapp/test` (the one-line change section 20 assigns to 5a).

**Settings › ערוץ ההודעות** (`#/system/messaging-accounts`, `screens/system-messaging-accounts.ts`) in the style of mock-up v2's
"ערוץ ההודעות" tab: the card "חשבונות וואטסאפ" (state chips מחובר / מנותק / לא ידוע / לא נמצא, last four, the uses each account carries,
24-hour sends against the daily cap, the amber "משותף" chip, "רענון", the source tag naming "תשתית המערכת"), the use rows (the
installation default, codes "כמו ..." by default, one row per department behind "מחלקות (N)", their warnings), "הזנה ידנית" (a dialog;
a discovered entry id is refused), the card "ערוצים" (SMS shown disabled as "בקרוב", D13), and "החשבון הנבחר" (label, "משמש גם מחוץ
למערכת", pacing shared by the account's uses, manual value and status entity, removal when unused, the test send - disabled with one
line until it is allowed). A save bar; a move with queued messages shows "N הודעות ממתינות יישלחו מהחשבון החדש" and asks first. A
`system.configure` reader sees everything read-only, manual values masked to their last four. Opaque surfaces: native selects and
`sw-dialog`; `--sw-*` tokens only; Bubble through the shared `bubbleChrome` (no skin rule added). Strings: `i18n/messaging-accounts.ts`
(Hebrew, English column); the use labels and module names arrive rendered with the tickets module's configured name (D33), so no text of
the screen names that module. Pure model: `messaging/accounts-model.ts`. Demo store in `api/messaging-accounts.ts` (fake data).

**Shell one-liners** (additive): `shell/nav.ts` (`AREA_TABS.system` entry `messaging-accounts`, `TAB_PERMISSIONS` = system.configure or
messaging.accounts.manage, `INSTALLATION_ONLY_HREFS`), `shell/sw-app.ts` (import + the `system` case), `screens/system-index.ts` (entry
with search words). The permission itself was catalogued by slice 1 (roles.json / PERMISSION_LABELS / sensitive list untouched here).

## 2. Readings taken (safest reading; recorded, not asked)

1. **Screen name.** The spec calls the screen "חשבונות וואטסאפ"; the mock-up and the lead's brief call the tab "ערוץ ההודעות". The tab and
   page are "ערוץ ההודעות" (it also carries the channels card and SMS "בקרוב"); the first card is "חשבונות וואטסאפ". The route is the
   spec's `#/system/messaging-accounts`.
2. **The mock-up shows whole numbers** ("+972 50-000-0099"); the spec keeps only the last four (9.9.1, S7). The spec wins: "····0099".
3. **"Last successful send"** is shown as the last ledger row of the account (a send that may have left: `sent` or `unknown`) - the only
   durable per-account record before 5b; 5b may refine it from outbox outcomes.
4. **"Today's sends"** is a rolling 24 hours, the same window as the `per_day` cap it is compared with.
5. **Inactive uses** (tickets module off) are not shown and not resolved (`UseSpec.active`); the routes themselves stay open
   (installation-level). The mapping of an inactive use is kept as stored (the client sends back the raw `mapping`).
6. **Test send switch.** "OFF unless the owner approves live checks" = the environment switch `SW_MESSAGING_TEST_SEND=1` in addition to
   the outbox hook. A product decision for release (a Settings switch, or always on once checked) is the owner's after the live check.
7. **The use labels** of the message core were literal Hebrew with the default module name; they are now D33 templates
   (`"הודעות {tickets}"`, `"קודי אימות ל{tickets}"`) rendered by the route.
8. **Merge reconciliation:** slice 1's D33 lint forbids the default name anywhere in `services/tickets`; the message core's
   `templates.py` wrote it in its defaults. `templates.py` now reads the Hebrew / English nouns from `naming.DEFAULTS` (same values).
   The two naming schemes still differ (slice 1: `tickets.name` with `{ticket}` / `{tickets}`, Arabic "بلاغ"; message core:
   `tickets.settings.display_name` with `{module_name}`, Arabic "طلب") - recorded for slice 5b to unify; not changed here.
9. **Removal.** A manual account, or a discovered one no longer in the mirror, can be removed only when no use points at it; a mapped
   account that disappears from the mirror keeps its mapping and turns `missing` (9.9.4: never silently re-routed).

## 3. Hooks for slice 5b

- `messaging_runtime.accounts_service(db)` -> the outbox's `Accounts` port; `messaging_runtime.DbSendLedger(db)` + `ma.PacingGate` (keep
  ONE gate per process: it holds the jitter); `messaging_runtime.messaging_key(settings.data_dir)` -> `Ports.messaging_key`.
- Set `messaging_runtime.QUEUED_COUNTER = lambda conn, use, dept: <queued + held rows of ticket_outbox for the use (and department)>`
  (the screen's queued counts and the 409 confirm start working with no other change).
- Set `messaging_runtime.TEST_SENDER = lambda conn, ref, digits, who: outbox.enqueue(purpose='test', test_target=digits,
  test_account_key=ref.key, requested_by=who, ...)` returning `{id, state}`; with `SW_MESSAGING_TEST_SEND=1` the button opens.
- `ha_sync` account filter: `accounts_service(db).mapped_keys('tickets')`.
- `ticket.channel_down` (slice 6): `messaging_accounts.state_transitions(before, after, mapped)` over `accounts_service(db).statuses()`.
- The tickets settings tab "ערוץ הודעות" (5b) shows the ticket rows read-only: `GET /messaging/whatsapp` filtered to `module ==
  'tickets'`, with a link to `#/system/messaging-accounts`.
- Migration 0081 is free; the migration-list tests (`test_migrations`, `test_media_api`, `test_media_players_api`, `test_notify_core`)
  now list 82 - add 80 / 81 there at integration.

## 4. UNVERIFIED (needs the owner-approved read-only live check; NOT_RUN - no live access in this slice)

- `ha-whatsapp` entities carry `platform = 'whatsapp'` and a `config_entry_id` in the general mirror (`ha_entities`);
- the connectivity binary sensor `unique_id = '<entry_id>_connection'` with `on` / `off`, and its `phone_number` attribute (and whether
  "Mask Sensitive Data" masks it - the label then falls back to the entry id);
- whether the add-on's Supervisor token may read that entity's state through `GET /api/states/<entity>` (the on-demand label read);
- what the integration's "last message" sensor puts into the general mirror (spec risk 6: if it is message text, a separate small change
  should exclude it from the mirror - not built here);
- whether one add-on instance holds several config entries on the owner's setup (docs disagree; the design is keyed by config entry).
Fallback while unverified: a manual account (typed `account` value, optional status entity) works without any discovery.

## 5. Tests

Backend (local, Python 3.12 venv): `test_messaging_accounts_api.py` (20: read gate matrix, masking, discovery and states from the
mirror, D33 labels incl. a rename, module switch, PUT mapping + audit, refusals, last4 kept by the server, refresh never storing a
number, unreachable platform, a missing entry keeps its mapping, manual account + same-number warning, the queued-move confirm, the
test send gate, local-only, settings / backup exclusion), `test_messaging_accounts_runtime.py` (10: migration 0082 shape = LEDGER_DDL,
on top of a 0079 database, the DB ledger with pacing shared by three uses, janitor, module key, the worker service, another module's
use and the shared-module warning, 24-hour counts); the message core's `test_messaging_accounts.py` unchanged and green; the
migration-list tests know 0082; `test_remote_access` blocks the test send. Frontend: `unit-messaging-accounts.spec.ts` (7),
`evidence-messaging-accounts.spec.ts` (desktop 1440 + phone 390, light / dark, classic / domus; images in
`docs/design/evidence/tickets-s5a/`, reviewed), `layout-messaging-accounts.spec.ts` (five skins x two themes x widths 320-1440;
runner). Counts and runner results: see the slice report.
