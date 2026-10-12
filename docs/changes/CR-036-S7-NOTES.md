# CR-036 slice S7 - the native people screen ("אנשים"): notes, decisions, gaps

Branch `pilot/WISKEY-native-s7-people`, from `pilot/WISKEY-native-s3-s4` (ce6ef97e), with `origin/main` 2.4.6 (095ca474) merged in
to get the Crystal skin (one trivial conflict: the import line of `routers/settings.py`; both import lists kept). Nothing here
contacted a WisKey, Home Assistant, station or device: every test runs against `tests/fake_wiskey.py` or a mocked backend. Live
behaviour is NOT_RUN until slice S14.

Read with `docs/changes/CR-036-WISKEY-NATIVE-SCREENS.md` (sections 2, 3.2, 3.7; both owner-answer sections),
`docs/changes/CR-036-S3-S4-INTERFACE-NOTES.md` (the adapter, the 25 typed reads, the Authority helpers) and
`docs/design/WISKEY_SCREENS_DESIGN.md` (section 3.2 and 3.2a, the mock-up gallery).

## 1. What exists now

| Piece | Where | One line |
|---|---|---|
| The screen | `frontend/src/screens/wiskey-people.ts` | filters, search, sort, "load more" paging with the snapshot, cards / list / table, selection and the bulk bar, the states |
| The person's page | `screens/wiskey-person-drawer.ts` | modal drawer: details (validity and timing views), access (per-station sync state), groups, the sensitive section, the audited photo |
| The message dialog | `screens/wiskey-message-dialog.ts` | one person or a selection; FAKES ONLY (section 5) |
| Typed client | `api/access-people.ts` | `GET /access-control/{people, people/{id}, people/{id}/photo, stations, groups, features}` |
| Pure logic | `access-control/people-logic.ts`, `messaging-logic.ts` | filters to query params, paging, sensitivity per level, columns, selection; the dialog's rules - Node-tested |
| Fakes of the dialog | `api/messaging-fake.ts` | the static preview's in-browser fake and the DRAFT http contract; no real send path |
| Strings | `i18n/access-people.ts` | Hebrew, one flat dictionary; no platform names, no internal codes |
| Tab gating | `shell/nav.ts` `NATIVE_WISKEY_TABS`, `tabAllowed` | the native People tab needs `access.people.read` at ANY scope |
| Backend | `intercom_adapter.py`, `intercom_authority.py`, `routers/access_control_reads.py` | credential kinds, `phone_set`, minimal list rows, `credential` / `profile` filters, `employee_no_visible` |
| Fakes | `tests/fake_wiskey.py`, `fixtures/wiskey_rc37/whatsapp_templates_get.json` | `users/query` follows WisKey's real matching; `whatsapp/*` responders |

The existing person editor (`wiskey-person-editor.ts`), the PIN generator and the card capture (`wiskey-card-capture.ts`) are
UNTOUCHED: "עריכה" in the person's page and "הוספת אדם" open the same element with the same events (`editor-saved`,
`editor-deleted`, `editor-close`). Their gate moves in slice S11.

## 2. Typed endpoints used

All `GET /api/v1/access-control/...`, nothing else (the screen never calls a legacy `/intercom/people*` route and never names a
WisKey command): `features` (once, for the photo / groups / messaging availability), `stations` (names for the filter and the
person's access list, the display zone), `groups` (labels, the profile field definitions for the sensitive level, the photo switch),
`people` (the list), `people/{id}` (one person's page), `people/{id}/photo` (only on "הצג תמונה"). Change notices come over the
existing data-free `intercom/ws` push (refetch), not a WisKey proxy.

### Query parameters of `GET people` (the screen sends exactly these)

`query` (name, and the employee number where the caller sees it - Arx matches it, WisKey never gets the text), `station`, `group`,
`rights` (assigned | unassigned | disabled), `state` (active | inactive | expired | upcoming | archived), `credential` (pin | no_pin
| card | no_card, sensitive), `profile` (repeated `field=value`, at most eight, exact, sensitive), `sort` (name | name_desc |
employee), `offset`, `limit` (50), `snapshot` (the previous page's). Reply additions of this slice: `people.employee_no_visible`;
each row: `credentials {pin, cards}` and `phone_set` (sensitive level only).

## 3. Decisions and the safest defaults recorded (owner answers 2026-10-12 applied)

1. **Employee number is not sensitive (answer 2).** A normal visible, searchable, sortable column for everyone who sees names. It
   follows the administrator setting `access.employee_no_sensitive` (S3, default off) through the page's `employee_no_visible`: when
   the setting hides it, the column, the "או מס׳ עובד" search hint and the number order go.
2. **Photo, phone and credentials are sensitive by permission (answer 2).** The photo only through the audited endpoint, fetched on
   "הצג תמונה" (one audited view per click; opening the page costs none; hiding is not a view). The phone only in one person's page.
   Credentials: S4 had put them "in no read view at all"; the owner's later answer makes credentials a sensitive FIELD LEVEL, so
   the sensitive level now gets the KINDS only - `{pin: bool, cards: n enabled}` - and never a card number, a mask, a label or the PIN.
   A redacted category is unknown (null), never "has none". This relaxes the S4 sentence on purpose (recorded here, not silent).
3. **List rows are minimal.** A list row carries no phone, photo flag, profile values, responsible person, purpose or timing (they
   belong to one person's page); of the sensitive fields it carries `credentials` (kinds) and `phone_set` (for the row action).
   200 rows never hold 200 phone numbers. One S4 assertion (`test_people_by_identity`) was updated for this.
4. **Field filters never become an oracle.** `credential` and `profile` need `access.people.sensitive` somewhere (an audited 403
   otherwise; the screen does not offer them without it). WisKey is asked to apply them only when the caller is unrestricted at the
   sensitive level; otherwise Arx scans and matches them itself, and only on people it shows at the sensitive level - a names-level
   person never matches, so the filter tells a caller nothing about values they cannot read (test:
   `test_a_names_level_person_never_matches_a_field_filter_for_a_partly_sensitive_caller`). The frame builder (`users_query`) still
   drops them unless the adapter asks for them (contract test updated).
5. **A viewer sees the "not available to you" panel, never an empty list.** The People tab of the native screen needs
   `access.people.read` at any scope (a station-scoped operator holds it below installation scope); while the screen is the embedded
   panel the tab keeps `access.read` (WisKey's own permissions decide inside the frame). A direct URL for a viewer shows the panel
   and makes no people request.
6. **WhatsApp (answers 9 and 10): templates AND free text, bulk in stage 1, the WisKey side (W11) unanswered, so FAKES ONLY** -
   section 5. The free-text box starts empty and a template is copied in only when picked; a template with a credential
   placeholder is never offered; a typed `{pin}` or "הקוד שלך 4821" is not sent (a best-effort guard on what the sender types).
7. **View and columns are per browser (localStorage), not `/me/prefs`.** `/me/prefs` is a closed key list (backend + client + tests);
   a per-user server preference is a follow-up if the owner wants it across devices.
8. **Stale handling.** A "load more" that comes back `stale` keeps the rows (deduplicated) and says "הרשימה השתנתה" with a restart;
   a refetch after a change notice asks for everything shown in ONE request (up to 200 rows; a longer list is marked changed
   instead); a service that drops after a list was shown keeps the list marked as the last known. `total_all` is null for a
   restricted caller, so "N of M" is never shown for them.
9. **No "expiring soon" filter.** WisKey's states are active / inactive / expired / upcoming / archived; "expiring soon" is not one
   (the mock-up's chip). It needs a WisKey-side filter or a longer Arx scan - listed as a gap.

## 4. Tab gating (the S3/S4 carry-over)

`shell/nav.ts`: `NATIVE_WISKEY_TABS = { '#/wiskey/people': { screen: 'people', need: ['access.people.read'] } }`; `tabAllowed` uses
it only while `WISKEY_UI.people === 'smplwise'`, at any scope; every other WisKey tab is unchanged. Slices S6 / S8 / S9 add their
own rows here. `tests/unit-people-nav.spec.ts` pins: embedded = `access.read` at installation scope; native = `access.people.read` at
any scope; a viewer is not offered the tab; a station-scoped operator is; the other tabs are unchanged.

## 5. The message dialog - fakes only, and where the real path will plug in

THERE IS NO REAL SEND PATH. The backend has no message route; nothing in product code calls a `whatsapp/*` WisKey command. The
dialog is built against two fakes in `frontend/src/api/messaging-fake.ts` (named so):

- `createFakeDemoTransport()` - the static preview (no backend): scripted people, a small quota, nothing leaves the page.
- `createFakeDraftTransport()` - the DRAFT http contract below. The screen creates it only when the server's `features` reply lists
  `messaging` as available; the real backend never does in this build, so in production the dialog is never offered. The Playwright
  mock (`tests/wiskey-people-mock.ts`) implements the routes, which makes it the executable form of the contract.

The fake WisKey (`tests/fake_wiskey.py` `_whatsapp`) answers `whatsapp/status | templates_get | templates_update | preview | send |
history` with the response keys rc.37's `whatsapp_api.py` shows (`status {available, history, accounts}`, `preview {token,
recipient, message, warnings}`, `send {accepted}`) plus two PROPOSED additions (`consent`, `quota`); switches `wa_available`,
`wa_quota`, `wa_unregistered`, a person's `whatsapp_consent`. Its approved template catalogue carries `{name}` and `{organization}`
only. rc.37's OWN templates embed the PIN (`{pin}`, `{credential_section}`): the Arx adapter must never forward those - W11 must say
how the Arx catalogue is separated from WisKey's.

### The draft contract (all under `/api/v1/access-control/`)

| Route | Body | Reply |
|---|---|---|
| `GET messaging` | - | `messaging: {enabled, can_send, can_reveal_phone, free_text, bulk_max, text_max, templates[{id,label,body}], quota{limit,used,resets_in_s}\|null}` |
| `POST messaging/recipients` | `{person_ids[]}` | `recipients[{person_id, name, phone_masked\|null, has_phone, consent granted\|declined\|unknown}]` |
| `POST people/{id}/messages` | `{template_id\|null, text, client_request_id, confirmed:true}` | `{sent_at}` or an error |

Errors: 403 `message_forbidden`, 409 `message_no_consent`, 422 `message_no_phone`, 422 `message_forbidden_content`, 422
`message_too_long`, 403 `message_free_text_disabled`, 429 `message_rate_limited` (`details.retry_after_s`), 503
`message_service_unavailable`, 502 `message_not_registered`, 504 `message_uncertain`, 410 `message_expired`. A bulk send is the
browser calling the single route one person at a time, sequentially, a failure never stopping the rest (a rate refusal stops the run).
"Sent" never means "delivered" (no receipt is assumed); an uncertain outcome is said as such and never retried.

Hidden-phone mode: `can_reveal_phone: false` -> `phone_masked: null` -> the recipient card says "מספר מוסתר" and the sender still
sends (the server holds the number). Administrator settings reach the dialog through `messaging` (`free_text`, `bulk_max`, the
templates, the quota) - the ones to build as Arx settings with the backend slice: `access.messaging_free_text` (default true),
`access.messaging_bulk_max` (default 50), the template catalogue (edited in Settings, answer 9 - NOT built here).

### The audit hook (documented, to be implemented with the route)

`intercom.person.message`, one row per recipient, under the real actor: `resource_type intercom_person`, `resource_id <person id>`,
`details {template_id | "free", chars: n, text_sha256 (free text only), bulk_id (a bulk run), outcome: sent | refused | not_sent |
unknown, reason}`. NEVER the message text, a PIN, a card or the phone number (the design's "phone's last two digits" is dropped:
the row needs none). The attempt row is written before the send and the outcome row after, as the existing envelope of
`routers/access_control.py` does (`client_request_id`, no retry on unknown, duplicate refusal for 600 s). A refusal (consent,
credential content, rate) is audited as `denied`. The photo view row (`intercom.person.photo_view`) exists already (S4).

### WisKey questions W11 must answer (from the dialog's needs)

The send command for one person and whether it accepts free text or only templates; who owns the template catalogue and how it is
kept free of credential placeholders; the consent / opt-out model and where it is stored; delivery receipts (the design assumes
none); hourly / daily limits and the provider's error codes (not-on-WhatsApp, rejected, uncertain); whether the service identity
may send at all; whether the preview token can be replaced by Arx's own one-shot.

## 6. Tests (what was actually run)

See the report of the run at the end of this file (section 9). Files: backend `tests/test_intercom_people_s7.py` (15),
`tests/test_fake_wiskey_whatsapp.py` (7), the updated `tests/test_intercom_adapter.py`, `tests/test_wiskey_contract.py`; frontend
unit `tests/unit-people-logic.spec.ts`, `unit-messaging-logic.spec.ts`, `unit-people-nav.spec.ts`, `unit-people-strings.spec.ts`;
Playwright `tests/evidence-wiskey-people-native.spec.ts` (mocked backend, desktop / tablet / mobile, five skins x light / dark),
`tests/layout-wiskey-people.spec.ts` (the layout guard, 320..1440), `tests/pixel-wiskey-people.spec.ts` (Linux baselines, new
states only); the mock `tests/wiskey-people-mock.ts`.

## 7. Gaps (honest list)

- Messaging is dark: no backend route, no real transport, no template editor (Settings, answer 9), no message history in the
  person's page (needs W11's `history`). The mock-up's "הודעות" section is not built for that reason.
- No "expiring soon" filter (decision 9). No saved filter per user (the plan's `/me/prefs` idea, decision 7).
- The embedded panel's own live specs (`evidence-wiskey-people.spec.ts`, `-editor`, `-capture`, `-credentials`) target the OLD DOM
  and run only against the live fixture (`SW_LIVE=1`); they are not in the gate. The editor and capture components they drive are
  unchanged; this slice proves the hand-over with mocked-backend specs (the editor element opens from the page and from "הוספת
  אדם", and the page closes first). The fixture backend (`tests/fixtures/wiskey_fake_ha.py`) lists no `api.commands`, so the typed
  reads answer `unsupported` there - the fixture needs a command list before those specs can drive this screen.
- The rail label of the area still reads "WisKey" (`shell/nav.ts`): a platform name outside Settings, to be re-worded by S12 / S6.
- Hebrew only (no English column).
- The "unavailable" panel links to Settings for administrators (`#/system/diagnostics?tab=access-control`); S10 owns the page.
- Per-station technical errors (the administrator's text) show as the server sent them (a code), not translated.
- A person shared with a station the caller cannot see is read-only for them (`editable: false` hides "עריכה"); the legacy editor
  endpoints still gate at installation scope until S11.

## 8. Hand-off: conflict-prone files

`frontend/src/shell/nav.ts` (the tab table and `tabAllowed`; S6 / S8 / S9 add rows to `NATIVE_WISKEY_TABS`),
`smplwise_vms/backend/smplwise/services/intercom_adapter.py` (`people`, `project_person`, `users_query`), `intercom_authority.py`
(`view_person`), `routers/access_control_reads.py` (the `people` route), `tests/fake_wiskey.py`, `tests/test_intercom_adapter.py`
(one assertion), `tests/test_wiskey_contract.py` (one block), `routers/settings.py` (the merge of main: the import line only),
`frontend/src/screens/wiskey-people.ts` (rewritten; it still exports `syncBadge` for the editor). New files do not collide:
`wiskey-person-drawer.ts`, `wiskey-message-dialog.ts`, `api/access-people.ts`, `api/messaging-fake.ts`, `access-control/people-logic.ts`,
`access-control/messaging-logic.ts`, `i18n/access-people.ts`, `playwright.unit.config.ts` (a Node-only config for the unit loop).
