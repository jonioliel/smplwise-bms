# CR-ORG-LOCATIONS - organisation locations for service requests and RFQs

Status: implemented on `pilot/ORGLOC` (from `origin/integ/264` @ `75f41b19`), not integrated, not released. Owner request 2026-10-17;
defaults chosen by the lead, owner answers to the three open questions received the same day (section 6).

## 1. Request

The "מיקום" field of the new request-for-quotation form (and of the other service-request creation forms) was free text. It must
offer the ORGANISATION's locations instead: defined once in Settings at address level, permanent and editable, several locations
managed in an organised way.

## 2. Decisions (as built)

1. **Settings.** Settings > service management > new tab **"מיקומים"** (next to "מחלקות"; visible with `tickets.configure`). A location
   has: name (required, unique case-insensitively, inactive ones included; <= 40), street and number (<= 60), city (<= 30), free
   additional details (building / floor / entrance / access instructions; <= 200), optional coordinates (lat / lng, both or neither),
   active / inactive, an optional organisation default (at most one, must be active), sort order. At least a street or a city.
   Add / edit / deactivate / activate / make default. **A location named by any request or RFQ is never hard-deleted**
   (`409 location_in_use`, audited as denied); an unreferenced one can be deleted. The Settings list shows a navigation link
   (coordinates, else an address search) - staff only.
2. **Department defaults** (owner answer (b)). Optional per-department default (`ticket_departments.default_location_id`, nullable);
   it wins over the organisation default; both are optional. Deactivating or deleting a location clears the department defaults that
   pointed at it.
3. **Pickers.** The RFQ form (`frontend/src/tickets/rfq-new.ts`) and the service-request form (`frontend/src/tickets/ticket-create.ts`)
   get one shared picker (`frontend/src/tickets/location-picker.ts`): "no location", the active locations ("name - street, city"),
   **"other (free text)"** = the old free-text place, so nothing regresses. Preselected: department default, else organisation
   default, else none; with no locations at all (or the list unavailable) the old free-text field is shown as before.
4. **Reference + snapshot.** A request / RFQ stores `location_id` (reference) AND `location_snapshot` (JSON: name, street, city,
   details, lat, lng) taken at creation. Editing or deactivating the location later never rewrites a request. An RFQ's location can
   change only while it is a draft (a new snapshot then); after the send it is locked (`rfq_field_locked`). A work order created from
   an RFQ copies the reference and the snapshot to its ticket. Old free-text places stay valid; no old row is rewritten.
5. **Vendors.** New template placeholder **`{location}`** = "name · street, city" (details stay on the request's page). It is also
   the value of `{place}` when the request has no free-text place, so the existing starter texts (which already carry a `{place}`
   line) show the location without a starter change. The value is in a message / page **only of the request that names the
   location**; no public route lists locations; the vendor's RFQ page and the handler page show the full text (with the details)
   only after their code gate. Staff notifications (RFQ managers) show the location's NAME only.
6. **Navigation link in messages** (owner answer (c)). Off by default; a per-request switch **"לצרף קישור ניווט להודעה"** in the RFQ
   send dialog (both the new-RFQ sheet and the RFQ board), shown only for a location with coordinates (`ticket_rfqs.location_nav`).
   The link is the short `https://maps.google.com/?q=<lat>,<lng>` form (<= 50 characters; the `{location}` value stays within its
   200-character cap at the field limits). The RFQ preview builds the same text the outbox will render. On the public RFQ page the map
   address is shown as text (that page builds no links by policy, `unit-public-rfq`), and only in that exact short form.
7. **Read access.** `GET /tickets/locations` (active locations: name, street, city, details, default flags, the short map link; never
   the raw coordinates, never the reference counts): whoever holds tickets.view / tickets.create / tickets.external /
   tickets.all_departments at any scope, or tickets.configure. Everything under `/tickets/admin/locations` and
   `PUT /tickets/admin/departments/{id}/location`: `tickets.configure` (installation), every write audited (ids and field names only).
   All routes sit behind the module switch (uniform 404 while off).
8. **Text hygiene.** Plain text only: controls / bidi / zero-width characters stripped, URLs refused in every text field (a WhatsApp
   message would turn them into links), lengths capped server-side; SQL and markup are stored literally and rendered as text
   (parameterised SQL, Lit / DOM text nodes).
9. **Plan / map areas** (owner answer (a)). Not built. `ticket_org_locations.plan_zone_id` (nullable, unused) is reserved for a later
   OPTIONAL link from a location to a plan area / room (e.g. an air-conditioner RFQ referencing the room on the map).

## 3. Data (migration `0101_org_locations.sql`; the provisional number was kept at the integ/264 integration)

Additive only: `CREATE TABLE ticket_org_locations` (+ unique name index `COLLATE NOCASE`, a partial unique index for the single
default, an order index); nullable `location_id` (REFERENCES `ticket_org_locations`) + `location_snapshot` on `tickets` and
`ticket_rfqs`; `ticket_rfqs.location_nav` (DEFAULT 0); `ticket_departments.default_location_id` (nullable, REFERENCES). The
REFERENCES clauses make a hard delete of a referenced row fail even if the service check were bypassed. Rollback: the columns are
unused by older code; the table can be dropped after the columns are cleared.

## 4. API

| Route | Who | Notes |
|---|---|---|
| `GET /tickets/locations` | view / create / external / all_departments / configure | active only; `default_id`, `department_defaults` |
| `GET /tickets/admin/locations` | configure | all, with lat / lng, `nav_url`, `references`, `revision` |
| `POST /tickets/admin/locations` | configure | 409 `location_name_taken`, 409 `locations_limit` (200), 422 by field |
| `PATCH /tickets/admin/locations/{id}` | configure | optional `revision` (409 `stale`) |
| `DELETE /tickets/admin/locations/{id}` | configure | 409 `location_in_use` when a request / RFQ names it |
| `PUT /tickets/admin/departments/{id}/location` | configure | `{location_id: id or null}`; an inactive / unknown id is 422 |
| `POST /tickets` | unchanged | + `location_id`, + `place_text` ("other") |
| `POST /tickets/rfqs`, `PATCH` (draft) | unchanged | + `location_id`, + `location_nav` |
| `POST /tickets/rfqs/{id}/send` | unchanged | + optional `location_nav` |

Ticket detail: `location` (`id`, `name`, `address`, `details`, `text`, `message`, `map_url`, `has_coordinates`). RFQ contract: v1.4
change-log entry in `docs/tickets/RFQ_BACKEND_CONTRACT.md`.

## 5. Not built / limits

- The RFQ board's draft editor changes the location of a draft with the same picker as the new-RFQ sheet (release 2.8.2; a new
  snapshot is taken, the map-link switch goes back off; nothing is sent when the person did not touch the field). After the send it
  stays locked.
- Changing a ticket's location after creation is not offered (the snapshot is the creation-time record).
- The locations do not feed the plan / map (section 2.9).
- Nothing here was tested against real WhatsApp, a real phone or the lab.

## 6. Owner questions (asked 2026-10-17, answered the same day)

(a) Should locations also feed the plan / maps areas? **Answer:** later, as an OPTIONAL link; design for it, do not build it now ->
`plan_zone_id` reserved. (b) Per-department default location? **Answer:** both an organisation default and a department default,
both optional; the department's wins -> built. (c) Include coordinates / navigation link in vendor messages by default? **Answer:** no;
a per-message option in the preview dialog, default off -> built for RFQ messages (section 5 for tickets).

(d) Should the service-request external-assign dialog get the same navigation-link switch? **Answer (owner 2026-10-17):** yes, same
mechanism, default off -> built on `pilot/ORGLOC-NAV` (section 7).

## 7. Navigation-link switch in the service-request external assign dialog (owner answer (d), 2026-10-17)

Branch `pilot/ORGLOC-NAV` (from `origin/pilot/ORGLOC` @ `dec0130c`). Not integrated, not released.

- **UI.** The "שליחה לגורם חיצוני" dialog (`frontend/src/tickets/external-assign.ts`) shows the same switch as the RFQ send dialog
  ("לצרף קישור ניווט להודעה", off by default) under the chosen contact's options, **only** when the preview says the request's location
  has coordinates (`location_nav.available`). Toggling asks the server for the preview again, so the preview text is the text that will
  be sent. Pure logic: `frontend/src/tickets/assign-nav-model.ts`; strings reuse `navOn` / `navOnSub` (he / en).
- **API.** `POST /tickets/{id}/assign/preview` and `POST /tickets/{id}/assign` take `location_nav` (bool, default false). Preview answers
  `location_nav: {available, on}` (booleans only - never coordinates).
- **Refusals (choice: explicit 422, never silently ignored).** `location_nav: true` on a request with no location or a location without
  coordinates -> `422 validation` field `location_nav` code `no_coordinates` (preview and assign; nothing written). With an inside assignee
  (user) -> 422 `not_allowed`. The permission gates run first: a caller who may not manage the request / may not send outside gets the
  usual 403 / 404, never a hint about the flag.
- **Storage.** `ticket_assignments.location_nav` (migration **`0106_assignment_location_nav.sql`** - provisional 0107, renumbered at the integ/264
  integration; one `ALTER TABLE ... ADD COLUMN ... DEFAULT 0`, additive). Unavoidable: an assignment has no spare column, and a
  reminder / new link / resend renders its text later from the ticket. `messaging.message_params(..., assignment_id=...)` reads the stored
  choice, so the assign message, the SLA reminders, the closed / reassigned notices and a new link all keep the same text. The choice
  belongs to that one assignment (a reassignment starts at off) and counts only while the snapshot still has coordinates.
- **Where the link appears.** The `{place}` / `{location}` value of the outgoing message (the short `https://maps.google.com/?q=lat,lng`
  form, within the 200-character cap) and the manager's manual "copy link" text. The public handler page is unchanged: it shows the
  location text only after its code gate and builds no map link; no public route lists locations or coordinates.
- **Side effect (note).** The manual "copy link" text (`external.render_message`) now carries the request's location (it used the free-text
  place only before); the map link is added only with the switch.
- **Tests.** `backend/tests/test_tickets_org_locations.py` (flag without coordinates, with an inside assignee, by a non-manager, default
  off, preview equals sent text, reminders / copy / new link keep the choice, no leak to other requests or the public page) and
  `frontend/tests/unit-tickets-assign-nav.spec.ts`.
