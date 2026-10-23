# Service-management area - information-architecture proposal (STEP 2)

Date: 2026-10-23 · Basis: `SERVICE-IA-INVENTORY.md` (same date; `origin/main` @ `c37c75c91`) · Status: proposal for the owner's decision, no code changed · Mockup: `docs/design/mockups/service-ia-215/index.html` (STEP 3).
Owner's brief: the area "became too many screens with sub-screens and must be organised far more conveniently, WITHOUT losing any capability; the easier it is to use, the better it will be adopted". Binding addition of 23.10: no capability embedded in an old screen may be lost or arrive changed; a capability parity matrix per capability with its verification; merging into "views" only where every capability survives; slice 1 = navigation only.
Every proposed item carries its Hebrew label (the module's names stay configurable, D33 - "בקשות" below is the default `tt('area')` family).

## 1. Verdict on the lead's hypothesis

The hypothesis (four job-based sections, ≤ 5 pages each, views instead of tabs, role-based visibility, phone bar fits four, every old URL kept) is **adopted with three corrections** that the inventory forces:

| Hypothesis item | Verdict | Why (evidence in the inventory) |
|---|---|---|
| One requests screen with views "mine / my department / all / board / calendar" as chips instead of tabs | **Adopted for mine / department / all / calendar - they already ARE one screen** (`<tickets-list>` with the scope segment at `tickets-list.ts:427-429` and the view switch cards / table / calendar). The only change is to stop duplicating the three scopes as level-1 tabs. **Rejected for the board**: `#/tickets/board` is a different screen (own `?state=` vocabulary, `?place=`, `?assignee=`, `?pane=handlers`, floors tree, grouping, closed strip, today row, stuck banner, 30-s polling, server manager gate - inventory §0 fact 2). Merging it as a chip would alter all of that. It stays a page of the same section, reached by the view switch that already links list ↔ board (`tickets-board.ts:300-306`). | parity rule of 23.10 |
| Four top sections, ≤ 5 pages each | Adopted: **בקשות (2 pages) · תחזוקה ובקרה (4) · ספקים וכספים (4, +1 reserved) · סקירה ודוחות (3)**. | §2 |
| Vendor reputation, department budget, vendor documents under ספקים וכספים | Vendor documents exist only as MAINT215 `vendor_document` tasks (the ledger) - placed in תחזוקה ובקרה by that branch; the vendor card gets a *link* to them (slice 4). Vendor score and department budget are **not built** (ideas 9/13/24 only) - the proposal reserves `#/tickets/vendors/budget` and the vendor-card row, builds nothing. | inventory §3 |
| The phone bottom bar fits the four sections | The bottom bar is the AREAS bar (ראשי · אבטחה · מפה · … · בקשות שירות, `NAV_A`), shared by every area; replacing it inside one area is a shell change with its own risks. **Proposed default**: the bar stays the areas bar; inside the area the four sections are the level-1 pill row with **short phone labels** (בקשות · תחזוקה · ספקים · סקירה) that fit 375 px without scrolling (mockup, phone view). **Option for the owner (Q3)**: swap the bar to the four sections while inside the area, with "עוד" back to the areas. | `sw-app.ts` phone chrome |
| Every old URL keeps working through a redirect map | Adopted, and made cheaper: **no existing href is renamed**. The sections are a navigation grouping over the existing routes; the redirect map therefore has only the four new section entry hrefs plus the existing fallbacks. Notifications, bookmarks, WhatsApp texts and the evidence specs keep their hrefs untouched. | inventory §5 |
| Settings › ניהול השירות pages | **Out of the four sections on purpose** (management stays in Settings - owner rule "clean operator screens" 2026-09-30). The nine sub-tabs are kept as they are in slices 1-3; a grouping of the nine into four groups is slice 5 (optional, owner Q6). The two new modules add their switches as cards of existing Settings tabs, not new tabs (§6). | §6 |

## 2. The proposed structure

Level 1 (pill row, `ui.tabs` section `tickets`) = the four sections. Level 2 (compact underline row, `ui.tabs` sections `tickets.<section>`) = the section's pages, exactly the electricity / generator pattern (`INFRA_ELECTRICITY_PAGES`, `infraPageTabs`, `infraEntryHref`, nav.ts ≈630-700). A section is offered when at least one of its pages is (the `SECURITY_SETTINGS_HREF` rule, nav.ts:1185) and opens on its first visible page. A level-2 row with a single visible page is not drawn (the shell already draws a row only for `tabs.length > 1`).

| Section (Hebrew / short phone label) | id | Page (Hebrew) | Page id | Href (canonical, UNCHANGED where it exists today) | Offered to (TAB_PERMISSIONS, unchanged) | Source screen |
|---|---|---|---|---|---|---|
| **בקשות** / בקשות | `requests` | רשימה (scope segment שלי · המחלקה · הכול inside; views כרטיסים · טבלה · לוח שנה) | `list` | `#/tickets/mine` · `#/tickets/department` · `#/tickets/all` (one page id, three hrefs; the row highlights `list` for any of them) | mine: `tickets.view` \| `tickets.create`; department: `tickets.view`; all: `tickets.all_departments` | `<tickets-list>` |
| | | לוח מנהל | `board` | `#/tickets/board` | `tickets.manage` (+ server gate) | `<tickets-board>` |
| | | *(section action)* בקשה חדשה | - | `#/tickets/<scope>?new=1` (= `listHref(scope, …, {create:true})`) | `tickets.create` | `<ticket-create>` |
| **תחזוקה ובקרה** / תחזוקה | `maintenance` | פנקס אישורים ובדיקות | `ledger` | `#/tickets/maintenance/ledger` (new, MAINT215) | `maintenance.view` + `maintenance.enabled` | MAINT215 mockup p.1 |
| | | תחזוקה מונעת | `plans` | `#/tickets/maintenance/plans` (new) | same | MAINT215 p.2 |
| | | סבבים ובדיקות | `rounds` | `#/tickets/maintenance/rounds` (new) | same (`perform` to walk) | MAINT215 p.3 |
| | | תגי QR/NFC | `tags` | `#/tickets/maintenance/tags` (new) | `maintenance.manage` (view for scan) | MAINT215 p.4 |
| **ספקים וכספים** / ספקים | `vendors` | מטפלים וספקים (segments מטפלים · ספקים · אנשי קשר · דורש בחינה inside) | `handlers` | `#/tickets/handlers[?seg=]` | `tickets.configure` \| `tickets.manage` | `<tickets-handlers>` |
| | | בקשות הצעת מחיר (list · board `?rfq=` · compare `&view=compare` · new `?new=1` inside) | `rfqs` | `#/tickets/rfqs` | `tickets.external` \| `tickets.costs` | `<tickets-rfqs>` |
| | | חשבון ספקים | `accounts` | `#/tickets/accounts` | `tickets.costs.view` | `<tickets-vendor-accounts>` |
| | | גישת חוץ (only while `access.external.placement` = tickets \| both) | `external` | `#/tickets/external` | `access.external.grant` | `<access-external-screen>` |
| | | *(reserved, not built)* תקציב מחלקות | `budget` | `#/tickets/vendors/budget` | - | idea 24 |
| **סקירה ודוחות** / סקירה | `reports` | מסך סקירה | `overview` | `#/tickets/overview[?dept=]` | `tickets.manage` (+ server gate) | `<tickets-overview>` |
| | | דוחות בניין | `building` | `#/tickets/reports/building` (new, INSIGHT215) | `reports.building` + switch | INSIGHT215 mockup p.1-2 |
| | | תובנות (דלתות · בזבוז as a segment) | `insights` | `#/tickets/reports/insights[?kind=doors\|waste]` (new) | `insights.read` + switches | INSIGHT215 p.3-4 |
| *(section entry hrefs, new, redirect only)* | | | | `#/tickets/requests` · `#/tickets/maintenance` · `#/tickets/vendors` · `#/tickets/reports` → the section's first visible page | | router fallback |
| Full-screen detail | - | - | - | `#/tickets/<id>` - belongs to section `requests`, no page active (as today) | | `<tickets-detail>` |
| Settings | - | ניהול השירות (9 sub-tabs, unchanged) | - | `#/system/tickets?tab=…` | `system.configure` \| `tickets.configure` | `<system-tickets>` |

Breadcrumb (`crumbsOf`): area › section › page, e.g. בקשות שירות › ספקים וכספים › חשבון ספקים (the system › security precedent, nav.ts:938). Document title and the phone head follow it.

## 3. Who sees what (role-based visibility falls out of the existing permissions - no new permission)

| Persona (typical holdings) | Sections and pages offered | Level-1 row |
|---|---|---|
| **עובד** - `tickets.create` (opens requests) | בקשות › רשימה (scope שלי only; "+ בקשה חדשה") | hidden (one section) - the area opens straight on the list |
| **מטפל** - `tickets.view` (+ `maintenance.perform`) | בקשות › רשימה (שלי · המחלקה) · תחזוקה ובקרה › the four pages (walk rounds, mark plans) | בקשות · תחזוקה |
| **מנהל מחלקה** - `tickets.manage` + membership (+ `maintenance.manage`) | בקשות › רשימה · לוח מנהל · תחזוקה ובקרה · ספקים וכספים › מטפלים וספקים (his departments) · סקירה ודוחות › מסך סקירה | all four |
| **כספים** - `tickets.costs`, `tickets.costs.view` | ספקים וכספים › בקשות הצעת מחיר · חשבון ספקים (+ בקשות if `tickets.view`) | per holdings |
| **מנהל המודול** - `tickets.configure` | + the `review` segment, full directory, Settings tabs | per holdings |
| **מנהל מערכת** - `system.configure` (+ `reports.building`, `insights.read`) | everything above + סקירה ודוחות › דוחות בניין · תובנות + Settings | all four |
| **מאשר גישת חוץ** - `access.external.grant` | ספקים וכספים › גישת חוץ (when placed here) | |

The mockup's role switch (עובד / מטפל / מנהל / מנהל מערכת) draws exactly these rows.

## 4. One-to-one mapping, old → new (every item of the inventory; nothing disappears)

Status vocabulary (owner 23.10): UNCHANGED (same screen, same href, same place in the row) · MOVED (same screen and href, a different place in the navigation) · MERGED-AS-VIEW (a separate navigation entry becomes a view of an existing screen - allowed only where every capability survives) · REMOVED-ONLY-IF-OWNER-SAYS-SO (nothing proposed).

| Old item (today) | Old href | New place | New href | Status | Capability change |
|---|---|---|---|---|---|
| Level-1 tab סקירה | `#/tickets/overview` | סקירה ודוחות › מסך סקירה | same | MOVED | none |
| Level-1 tab שלי | `#/tickets/mine` | בקשות › רשימה, scope segment "שלי" | same | MERGED-AS-VIEW | none - the segment exists today (`tickets-list.ts:427`); the level-1 duplicate goes |
| Level-1 tab המחלקה | `#/tickets/department` | בקשות › רשימה, segment "המחלקה" | same | MERGED-AS-VIEW | none (as above) |
| Level-1 tab הכול | `#/tickets/all` | בקשות › רשימה, segment "הכול" | same | MERGED-AS-VIEW | none (as above); the segment must hide a scope the viewer lacks exactly as `TAB_PERMISSIONS` hides the tab today - verify in slice 2 (parity row L-02) |
| Level-1 tab לוח מנהל | `#/tickets/board` | בקשות › לוח מנהל | same | MOVED | none |
| Calendar (view of the list) | `#/tickets/<scope>` + browser pref | unchanged | same | UNCHANGED | none |
| Table (view of the list) | same | unchanged | same | UNCHANGED | none |
| Full-screen detail | `#/tickets/<id>` | unchanged (section בקשות, no page active) | same | UNCHANGED | none |
| Drawer `?t=`, create `?new=1`, `?tab=`, `?view=timeline`, `?assign=` | on list / board | unchanged | same | UNCHANGED | none |
| Level-1 tab מטפלים וספקים (+ `?seg=`) | `#/tickets/handlers` | ספקים וכספים › מטפלים וספקים | same | MOVED | none; the embedded copy at `#/tickets/board?pane=handlers` unchanged |
| Level-1 tab בקשות הצעת מחיר (+ `?rfq= &view=compare ?new=1&from=`) | `#/tickets/rfqs` | ספקים וכספים › בקשות הצעת מחיר | same | MOVED | none; the questions badge moves to the level-2 entry and adds a dot on the section (parity N-03) |
| Level-1 tab חשבון ספקים | `#/tickets/accounts` | ספקים וכספים › חשבון ספקים | same | MOVED | none |
| Level-1 tab גישת חוץ (placement tickets \| both) | `#/tickets/external` | ספקים וכספים › גישת חוץ | same | MOVED | none; `#/wiskey/external` untouched |
| Area entry (rail / bottom bar) | `#/tickets/mine` (`NAV_A`) | unchanged; `entryHref` resolves to the first visible page as today | same | UNCHANGED | none |
| RFQ questions badge on the area icon | nav | unchanged | - | UNCHANGED | none |
| Settings › ניהול השירות, 9 sub-tabs | `#/system/tickets?tab=…` | unchanged | same | UNCHANGED | none (slice 5 may group them - owner Q6) |
| Settings legacy `?tab=contacts` → handlers | `#/system/tickets?tab=contacts` | unchanged | same | UNCHANGED | none |
| User-menu item (staff links), my-numbers tiles, inbound chip | shell / list head | unchanged | - | UNCHANGED | none |
| Planned MAINT215 pages (4) | none today | תחזוקה ובקרה › 4 pages | `#/tickets/maintenance/*` | NEW | as designed on the branch |
| Planned INSIGHT215 report + insights | none today | סקירה ודוחות › דוחות בניין · תובנות | `#/tickets/reports/*` | NEW | as designed on the branch |
| Ideas: vendor score, department budget, vendor documents on the vendor card | none | reserved places only | `#/tickets/vendors/budget` (reserved) | NOT BUILT | none |

## 5. CAPABILITY PARITY MATRIX

One row per capability of the inventory (Appendices A-C of `SERVICE-IA-INVENTORY.md` are the evidence with file:line). "Verified by" names the spec that already covers the capability and must keep passing **unchanged**, or the new spec required. Rows whose screen is untouched by this proposal are UNCHANGED by construction: the proposal changes `nav.ts`, the shell rows and the router fallback, never a screen file (slices 1-3). Classification of anything the inventory could not settle is UNKNOWN.

### 5.1 Navigation and cross-cutting

| Id | Capability | Old location | New location | Status | Verified by |
|---|---|---|---|---|---|
| N-01 | Area offered only while `tickets.enabled`; hidden by default so an operator never sees it flash | `visibleAreas` nav.ts:1212 | same | UNCHANGED | `evidence-tickets.spec.ts:138-150`, `unit-tickets-gate-295.spec.ts` |
| N-02 | Area label = the configured plural (D33); every row label a getter | nav.ts:789, TICKETS_TABS getters | the four sections keep getters; section names are new strings in `tickets/text.ts` (`tt('secRequests')` …) - the module's configured name still drives the area label and "בקשות" | UNCHANGED (+ 4 new strings) | `unit-tickets-naming.spec.ts:102-127` (expected label list CHANGES - see §9) |
| N-03 | RFQ questions badge: number on the RFQ tab, dot on the dropdown chip, count on the area icon | nav.ts:729-744 `applyRfqQuestions` on `TICKETS_TABS` | number on the level-2 `rfqs` entry, dot on the level-1 "ספקים וכספים" entry (new), count on the area icon unchanged | UNCHANGED + 1 addition | `unit-rfq-questions.spec.ts:104-111` (the `find(id==='rfqs')` target array CHANGES), `layout-tickets-rfq-questions.spec.ts` |
| N-04 | Per-tab permission gating (`TAB_PERMISSIONS`), installation-only rule for the settings tab, `tabAllowed` | nav.ts:1073-1091, 1146-1158 | identical entries keyed by the same hrefs; sections derive from their pages | UNCHANGED | `unit-tickets-*.spec.ts` permission asserts (hrefs unchanged), `unit-tickets-naming.spec.ts:123-124` |
| N-05 | External placement `access | tickets | both` moves the tab between areas | nav.ts:42-61, 1163, 1424 | same switch; the filter keys on `TICKETS_VENDORS_PAGES` instead of `TICKETS_TABS` | UNCHANGED | `unit-tabset-registry.spec.ts:68-69`, `unit-tabs-config.spec.ts` (placement reset), NEW: a spec that asserts `#/tickets/external` appears under the vendors section (gap: no spec covers `#/tickets/external` today - inventory §7.7) |
| N-06 | `ui.tabs` order / hidden for the area row; a new tab is appended; hiding never empties a row; the editor lists the section only while the module is on | nav.ts:484-519, 1424 | level 1 = 4 sections; level 2 = 4 page sections; stored legacy ids migrated (§8) | UNCHANGED behaviour, CHANGED ids | `unit-tabset-registry.spec.ts:62-86,130-138`, `unit-tabs-config.spec.ts:112-158` (expected ids CHANGE), backend `test_ui_tabs_config.py` unchanged |
| N-07 | Tab presentation mode (tabs / hybrid / dropdown), bar style per level, dropdown placement | `tabs-mode.ts`, `tabStyleOf`, `dd-place-fit.ts:43` | level-1 row = `pill`, level-2 = `underline-compact` (TAB_STYLE_DEFAULTS); hybrid turns a 4-5-page row into a chip as it does for the generator pages | UNCHANGED | `layout-dd-place.spec.ts:42-43,259-263` (`/tickets/mine` now has TWO rows → expected chip count CHANGES) |
| N-08 | Per-user areas order (`nav.order`), areas hidden by the admin | `nav-order.ts`, `user_prefs.py` | untouched | UNCHANGED | `test_media_api.py:511`, `test_tickets_module.py:143`, `unit-tabs-config.spec.ts:158` |
| N-09 | `#/tickets` and an unknown segment open the first visible tab; `#/tickets/mine` fallback | sw-app.ts:2423-2426 | the same fallback, extended: an unknown segment that names a section opens its first visible page; otherwise the first visible section's first page | UNCHANGED + extension | `unit-tickets-model.spec.ts:35-50` (bare `/tickets` → `mine`), NEW unit rows for the four section hrefs |
| N-10 | `activeAreaTab` / `crumbsOf` for every route | nav.ts:919-921, 930-943 | `activeAreaTab` = section id; new `ticketsPageOf` = page id; crumbs area › section › page | CHANGED (internal) | `unit-tickets-board/overview/handlers/rfq/vendor-accounts/model.spec.ts` `activeAreaTab` asserts (expected value CHANGES from page id to section id, or the spec switches to `ticketsPageOf`) |
| N-11 | Inbound deep links (`#/tickets/<id>`, `#/tickets`, `/rfqs?rfq=`, `/overview[?dept=]`, `/handlers?seg=review|vendors`, `/external?grant=|digest=1`, `#/system/tickets`) | backend `notify.py:110-111`, `dashboard_alerts.py:176,189`, `needs_review.py:48`, `portal_more.py:314`, `access_external.py:156` | untouched - every href stays canonical | UNCHANGED | `test_tickets_monitor.py:79`, `test_tickets_mgrdash_alerts.py:107`, `test_tickets_notify_matrix.py:132`, `test_tickets_rfq_notify.py:83`, `test_sharedid_293.py:309`; frontend `evidence-tickets-rfq4.spec.ts:149` |
| N-12 | Push → `#/notifications/<id>` → stored link | `notify_channels.py:239`, `sw.ts:246`, `notify-center.ts:613` | untouched | UNCHANGED | existing notify specs |
| N-13 | Public vendor / handler pages (`/support/<token>`, legacy `/t/`) | outside the hash router | untouched | UNCHANGED | public-ticket specs |
| N-14 | Settings legacy `?tab=contacts` redirect | `system-tickets.ts:391-395` | untouched | UNCHANGED | `evidence-tickets-handlers.spec.ts:167` |
| N-15 | Links OUT of settings to the area (`data-to-handlers`, readiness hrefs) | `system-tickets.ts:744`, `readiness-model.ts:20-25` | untouched (hrefs unchanged) | UNCHANGED | `evidence-tickets-handlers.spec.ts:152-165` |
| N-16 | Module-off behaviour: every area route answers "module off"; only the settings switch is offered; no "open a request" action anywhere (incl. MAINT215) | screens + `tickets/gate.ts` | untouched; the new sections obey the same gate; תחזוקה ובקרה has its own switch and hides its "open a request" rows when tickets are off | UNCHANGED | `unit-tickets-gate-295.spec.ts`, `evidence-tickets-board.spec.ts:138`, MAINT215 `test_maintenance_215.py` |
| N-17 | Phone: areas bottom bar, 44-px targets, sections row on the phone (`renderSections(section, true)`) | sw-app.ts:2822-2828 | the level-1 row uses the short labels on phones (`TabItem.short`, new optional field read by `sw-tabs` on `phone`) | UNCHANGED + short labels | `layout-uxfix-nav-295.spec.ts:59,76`, `layout-tickets.spec.ts:28-40`, NEW phone-width layout rows for the two rows |

### 5.2 Requests list (`#/tickets/mine|department|all`, Appendix A §1-3)

| Id | Capability | Old | New | Status | Verified by |
|---|---|---|---|---|---|
| L-01 | Large title = configured name; compacts while scrolling (TKUI4) | list head | same | UNCHANGED | `evidence-tickets.spec.ts`, `layout-tickets.spec.ts` |
| L-02 | Scope segment שלי / המחלקה / הכול (radiogroup) writing `#/tickets/<scope>` | `tickets-list.ts:427-429` | same; becomes the ONLY place the scope is chosen | UNCHANGED (the duplicate tabs go) | `evidence-tickets.spec.ts` (scope buttons), `unit-tickets-model.spec.ts:35-50`; **verify in slice 2**: the segment hides a scope the viewer may not open (today the three level-1 tabs are permission-filtered by `TAB_PERMISSIONS`; whether the segment already filters identically is UNKNOWN - Appendix A §1.1 cites nav.ts:1077-1079 but the sweep did not read the filter). If it does not, slice 2 adds the same `tabAllowed` filter to `SCOPES` - a one-line change with a unit row. |
| L-03 | State filter open · unassigned · handling · done · closed · all (`?status=`) | `tl:430-432` | same | UNCHANGED | `evidence-tickets.spec.ts`, `unit-tickets-model.spec.ts` |
| L-04 | Department chips (`?dept=`), counts per scope / state / department (`tickets/facets`) | `tl:402,421-424,288-302` | same | UNCHANGED | `evidence-tickets.spec.ts` (TKUI4 counts) |
| L-05 | Text search (`?q=`, 80 chars) | `tl:317-322,435` | same | UNCHANGED | `evidence-tickets.spec.ts` |
| L-06 | Filter button + card filter row (priority, handler, flags; not remembered) | `tl:411-412,436,441`, `list-filter-row.ts` | same | UNCHANGED | `evidence-tickets-ui6.spec.ts` / `layout-tickets*.spec.ts` (filter row) |
| L-07 | Inbound-queue chip (managers) with its claim dialog | `tl:434`, `inbound-queue.ts` | same | UNCHANGED | `evidence-tickets-s5b.spec.ts` |
| L-08 | "My numbers" four tiles | `tl:501`, `my-numbers.ts` | same | UNCHANGED | UNKNOWN - no spec found by selector grep (inventory §7.6) → NEW unit/evidence row required before slice 2 |
| L-09 | "+ חדשה" (`tickets.create`) → `?new=1`; sheet or dialog by `ui.new_ticket` | `tl:438,481,508-509` | same, plus the section-level "בקשה חדשה" action pointing to the same href (slice 3) | UNCHANGED (+1 entry point) | `evidence-tickets.spec.ts` (`?new=1`), `evidence-tickets-create-assign.spec.ts`, `tk260-expand-nav.spec.ts` |
| L-10 | View switch cards / table / calendar / board; cards-vs-table on the server per user; calendar wanted in the browser; precedence rules | `list-view-switch.ts`, `tl:223,468`, `calendar-mode.ts` | same | UNCHANGED | `evidence-tickets-table.spec.ts`, `evidence-tickets-calendar.spec.ts`, `evidence-tickets-board.spec.ts` (switch back) |
| L-11 | Pagination, 20-s polling while visible, on focus and after every mutation | `tl:99-104,271-274,493` | same | UNCHANGED | `evidence-tickets.spec.ts` (refetch asserts) |
| L-12 | Card anatomy, chip budget ≤ 3, "⋯" card menu (open, timeline, status moves, assign, delete) gated by `can.*`, menu keys, urgent border | `ticket-card.ts:71-166`, `list-card-model.ts` | same | UNCHANGED | `evidence-tickets-ui6.spec.ts`, `unit-tickets-overlay-menu.spec.ts`, `unit-tickets-ui6.spec.ts` |
| L-13 | Card opens the drawer or the full page by `ui.detail` (`drawer / fullscreen / drawer_fullscreen`); picked highlight | `tl:324-332,492` | same | UNCHANGED | `evidence-tickets-drawer.spec.ts`, `tk260-expand-nav.spec.ts:32-53` |
| L-14 | `ticket-changed` / `ticket-gone` handling (drawer closes, list drops the row) | `tl:347-365` | same | UNCHANGED | `evidence-tickets-delete.spec.ts` |
| L-15 | States: loading, module off (link to Settings for `system.configure`), forbidden, error, empty per scope, no departments, no match (server / card filters) | `tl:228-243,451-486` | same | UNCHANGED | `evidence-tickets.spec.ts` states, `uxrest-states.spec.ts` |
| L-16 | Toasts | `tl:304-308,510` | same | UNCHANGED | as above |
| T-01 | Table: base filters inherited, sort, column chooser (order, visibility), density, page size, count | `tickets-table.ts`, `table-model.ts`, `table-toolbar.ts` | same | UNCHANGED | `evidence-tickets-table.spec.ts`, `unit-tickets-table*.spec.ts` (UNKNOWN exact names beyond Appendix A §7) |
| T-02 | Saved views (max 20, private) + default view; "what is happening" column pref (browser) | `table-toolbar.ts:123-168,215`, `list-prefs.ts` | same | UNCHANGED | `evidence-tickets-table.spec.ts` |
| T-03 | Table filters popover | `table-model.ts:37-40,170-172` | same | UNCHANGED | same |
| T-04 | CSV export of the current filter; monthly report CSV | `table-toolbar.ts:221-240,292-296`, `tt:336-348` | same | UNCHANGED | same |
| T-05 | Row open, inline status cell, inline handler cell, cell menus, multi-select, keyboard navigation | `tt:155-175,356-426,464-504,564-577,620-652` | same | UNCHANGED | same + `unit-tickets-table-keys` (UNKNOWN name) |
| T-06 | Sticky bulk bar (status, assign, delete with the delete dialog) | `table-bulk.ts` | same | UNCHANGED | `evidence-tickets-delete.spec.ts`, `evidence-tickets-table.spec.ts` |
| T-07 | Phone layout < 768, skeleton / error / empty, polling, toast | `tt:657-689,254-265` | same | UNCHANGED | `layout-tickets-table` (UNKNOWN exact name) |
| C-01 | Calendar: Sunday-first week, phone day view, prev / next / today, arrow keys, legend, counts, event card → drawer, empty week, load more, card filters apply | `calendar-view.ts`, `calendar-model.ts` | same | UNCHANGED | `evidence-tickets-calendar.spec.ts`, `layout-tickets-calendar` (UNKNOWN exact name) |

### 5.3 Request detail, create, assign (Appendix A §4)

| Id | Capability | Old | New | Status | Verified by |
|---|---|---|---|---|---|
| D-01 | Drawer 520 / wide 640 / full size switch, remembered per browser, default `ui.drawer_size` | `drawer-model.ts:97-114`, `drawer-prefs.ts` | same | UNCHANGED | `evidence-tickets-drawer.spec.ts` |
| D-02 | Phone full / half sheet (`ui.phone_sheet`), phone width rule | `td:452,968-972,1208-1225` | same | UNCHANGED | same (phone rows) |
| D-03 | Tabs סקירה · שיחה · עלויות · היסטוריה in that order; default `ui.detail_tab`; `?tab=` aliases; `?view=timeline` | `drawer-model.ts:23-36`, `drawer-tabs.ts` | same | UNCHANGED | `evidence-tickets-drawer.spec.ts`, `unit-tickets-drawer` (UNKNOWN name), `evidence-tickets-conversation.spec.ts` |
| D-04 | Badges: שיחה unread, עלויות waiting-for-me | `drawer-model.ts:45-55` | same | UNCHANGED | same |
| D-05 | Status block: one primary, one quiet, "⋯" menu (status moves, waiting toggle, reminder, cancel, reopen, duplicate, delete, copy link, expand), menu keys | `status-block.ts`, `drawer-model.ts:166-242`, `td:631-643,975-99x` | same | UNCHANGED | `evidence-tickets-drawer.spec.ts`, `unit-tickets-status-sentence` (UNKNOWN name) |
| D-06 | Dialogs: assign (internal / external, `?assign=contact:` prefill consumed once), note / message, close, return, cancel, reopen, delete, code lock, camera viewfinder, link panel (copy / new / revoke) | `td:697-879,1100-1190`, `external-assign.ts`, `delete-dialog.ts`, `code-lock.ts`, `camera-viewfinder.ts`, `link-panel.ts` | same | UNCHANGED | `evidence-tickets-create-assign.spec.ts`, `evidence-tickets-delete.spec.ts`, `unit-tickets-code-gate.spec.ts`, `evidence-camera-viewfinder.spec.ts`, `evidence-tickets-s4.spec.ts` (links) |
| D-07 | Overview tab content (people, now, facts, photos, device history fold) | `overview-tab.ts` | same | UNCHANGED | `evidence-tickets-drawer.spec.ts`, `evidence-tickets-device.spec.ts` |
| D-08 | Conversation: sub-tabs עם הספק / הצוות, two composers, drafts, keyboard asymmetry, delivery lines | `conversation-tab.ts`, `conversation-model.ts` | same | UNCHANGED | `evidence-tickets-conversation.spec.ts` |
| D-09 | Costs tab: quote + demand cards, approve / adjust / reject, revisions fold, demands chunk | `costs-tab.ts`, `costs-demands.ts` | same | UNCHANGED | `evidence-tickets-costs.spec.ts`, `unit-costs-demands.spec.ts` |
| D-10 | History: timeline, files, link audit | `history-tab.ts` | same | UNCHANGED | `evidence-tickets-conversation.spec.ts` (history rows) |
| D-11 | Full page `#/tickets/<id>`: back link to the last scope, page extras | `screens/tickets-detail.ts:58-64`, `td:1239-1243` | same; the back link still goes to `#/tickets/<lastScope>` which now highlights section בקשות › רשימה | UNCHANGED | `tk260-expand-nav.spec.ts` |
| D-12 | Flash / stale / 409 reload, polling while open, loading / error / forbidden / gone states | `td:462-518,1199-1204` | same | UNCHANGED | `evidence-tickets-drawer.spec.ts` |
| K-01 | Create form fields, departments offered, duplicate hint, idempotency, location picker + plan room, device, photos, submit | `ticket-create.ts`, `location-picker.ts` | same | UNCHANGED | `evidence-tickets-create-assign.spec.ts`, `unit-tickets-create` (UNKNOWN name) |
| K-02 | Create from a device window / the map (`map-create.ts` entry points) | `map-create.ts:15-33` | same | UNCHANGED | `evidence-tickets-device.spec.ts` |
| K-03 | Assign step after create (vendor → drawer opens with the external-assign dialog prefilled) | `ticket-create.ts:364-393`, `tl:378` | same | UNCHANGED | `evidence-tickets-create-assign.spec.ts` |

### 5.4 Manager board (Appendix A §5)

| Id | Capability | Old | New | Status | Verified by |
|---|---|---|---|---|---|
| B-01 | Access: `tickets.manage` tab + server manager gate; "not a manager" state | nav.ts:1081, `tb:340-345,581-582` | same (level-2 entry under בקשות) | MOVED (nav only) | `evidence-tickets-board.spec.ts:128`, `unit-tickets-board.spec.ts:121-128` (tab-list assert CHANGES) |
| B-02 | Pane switch cards / handlers (`?pane=handlers`, embedded directory narrowed to his departments) | `tb:463-466,588`, `board-model.ts:46` | same | UNCHANGED | `unit-tickets-dept-handlers.spec.ts` (`parseBoardRoute('pane=handlers…')`), `evidence-tickets-handlers.spec.ts:140` |
| B-03 | Department chips with counts, state strip (הכול · ממתינות לי · תקועות · ללא מטפל · closed strip by D21), handler filter chip, text search, card filter row | `tb:400-405,474-489` | same | UNCHANGED | `evidence-tickets-board.spec.ts:72-78,86` |
| B-04 | Floors tree / chips / chips+tree (D19, `ui.board_floors`), per-user tree hidden (D30, `/me/prefs`), tree keyboard | `board-tree.ts`, `board-model.ts:98-104`, `api/tickets-board.ts:98-103` | same | UNCHANGED | `evidence-tickets-board.spec.ts:101-112` |
| B-05 | View switch back to the list modes (cards / table / calendar) | `tb:300-309,487` | same | UNCHANGED | `evidence-tickets-board.spec.ts` |
| B-06 | "+ חדשה", drawer and create on the board, `?t=`, `?new=1` | `tb:486,618-633` | same | UNCHANGED | `evidence-tickets-board.spec.ts` |
| B-07 | "Today" row, stuck banner, grouping ממתין לי / תקועות / בטיפול by assignee (D20), handler group header, closed section collapsed, truncation notice | `tb:514-569,594-606`, `board-today.ts` | same | UNCHANGED | `evidence-tickets-board.spec.ts:86-99`, `unit-tickets-board.spec.ts` |
| B-08 | 30-s polling while visible; states loading / empty / no match / error / module off; renamed module label | `tb:91,361-385,572-586` | same | UNCHANGED | `evidence-tickets-board.spec.ts:135-159` |

### 5.5 Manager overview (Appendix A §6)

| Id | Capability | Old | New | Status | Verified by |
|---|---|---|---|---|---|
| O-01 | Access (`tickets.manage` + server gate), "not a manager", module off, offline state | nav.ts:1080, `to:393-440` | level-2 entry under סקירה ודוחות | MOVED (nav only) | `evidence-tickets-overview.spec.ts:110,117`, `unit-tickets-overview.spec.ts:267-274` (`TICKETS_TABS[0]` assert CHANGES) |
| O-02 | Department chips (`?dept=`), "updated" stamp + link to the board | `to:363-374,586-598,636-642` | same | UNCHANGED | `evidence-tickets-overview.spec.ts` |
| O-03 | Numbers row, cards 1-11 (stuck-where, handler load, overdue, approvals, agenda, throughput, departments table), fold / unfold remembered, "all overdue" / "show all" | `to:647-1035`, `overview-model.ts` | same | UNCHANGED | `evidence-tickets-overview*.spec.ts`, `unit-tickets-overview*.spec.ts` |
| O-04 | Period selector shared with handler cards (browser), yesterday deltas | `handler-load.ts:46-70`, `to:42,524-577` | same | UNCHANGED | `evidence-tickets-overview-p3.spec.ts:139` |
| O-05 | Links out: board, accounts, RFQ board `?rfq=`, ticket `&tab=costs` | `to:665,882,918,961,974` | same hrefs | UNCHANGED | `evidence-tickets-rfq4.spec.ts:149`, `evidence-tickets-overview-p4.spec.ts` |
| O-06 | Polling 60 s / 10 min, partial / unavailable / empty / loading | `to:40-43,117,325-356` | same | UNCHANGED | `evidence-tickets-overview-p3.spec.ts:161-163` |
| O-07 | Morning digest and busy-department notifications link here (`#/tickets/overview[?dept=]`) | `dashboard_alerts.py:176,189` | same | UNCHANGED | `test_tickets_mgrdash_alerts.py:107` |

### 5.6 Handlers and vendors (Appendix B §1)

| Id | Capability | Old | New | Status | Verified by |
|---|---|---|---|---|---|
| H-01 | Tab for `tickets.configure | tickets.manage`; label "מטפלים וספקים" | nav.ts:718,1083 | level-2 entry under ספקים וכספים | MOVED (nav only) | `unit-tickets-handlers.spec.ts:25-32` (`TICKETS_TABS[5]` assert CHANGES) |
| H-02 | Segments מטפלים · ספקים · אנשי קשר · דורש בחינה (`?seg=`, radio group, arrow keys, counts; review only for configurers; unknown seg → handlers) | `tickets-handlers.ts:184-250,332-340`, `readiness-model.ts:12-17` | same | UNCHANGED | `evidence-tickets-handlers.spec.ts:60-70`, `evidence-tickets-needs-review.spec.ts:66`, `unit-tickets-needs-review.spec.ts` |
| H-03 | Department chips (a manager: his departments), text search, "+" per segment, employees' own "+" | `:315-325,390-415`, `contacts-directory.ts:264,653` | same | UNCHANGED | `evidence-tickets-s4.spec.ts`, `evidence-tickets-ui6.spec.ts:149-219` |
| H-04 | Handled-period selector (browser) and load counts (managers) | `:289-295,359`, `handler-load.ts` | same | UNCHANGED (store = UNKNOWN per user vs browser, inventory §7.1) | `unit-tickets-ui6.spec.ts` (loads by assignee key) |
| H-05 | Readiness strip only when something is missing; items link to Settings pages | `:343-351`, `readiness-model.ts:20-25` | same hrefs | UNCHANGED | `evidence-tickets-handlers.spec.ts:150-158` |
| H-06 | Directory rows: quick channel radios, code chip, vendor marker filter / chip / editor, drawer editor (configurer vs manager mode), hourly-rate fields, phone verification row and states, live-link warning, identity card, phone masking | `contacts-directory.ts:51-780`, `vendor-marker.ts`, `phone-verify.ts` | same | UNCHANGED | `evidence-vendmark-295.spec.ts`, `unit-vendor-marker-295.spec.ts`, `evidence-tickets-s4.spec.ts`, `unit-tickets-dept-handlers*.spec.ts`, `layout-tickets-s4.spec.ts` |
| H-07 | Export (JSON), erase (confirm, audited) | `contacts-directory.ts:418-447,754-763` | same | UNCHANGED | `evidence-tickets-s4.spec.ts` |
| H-08 | Members cards, manage panel, add panel, mobile line, remove (manager), departments link | `handlers-members.ts` | same | UNCHANGED | `evidence-tickets-handlers.spec.ts:81-140`, `unit-tickets-dept-handlers-decisions.spec.ts` |
| H-09 | Needs-review: two cards, confirmation dialog, thresholds card, counter | `needs-review.ts` | same | UNCHANGED | `evidence-tickets-needs-review.spec.ts`, `unit-tickets-needs-review.spec.ts` |
| H-10 | Portal requests card (technician update requests) | `portal-requests.ts` | same | UNCHANGED | `unit-portal-requests-model.spec.ts`; evidence = UNKNOWN |
| H-11 | Embedded mode inside the board (no title, his departments, segment kept in the element) | `tickets-handlers.ts:44` | same | UNCHANGED | `evidence-tickets-handlers.spec.ts:140` |
| H-12 | Deep links `?seg=review` (reminder), `?seg=vendors` (portal request, RFQ "add vendors") | `needs_review.py:48`, `portal_more.py:314`, `rfq-board.ts:645` | same | UNCHANGED | backend needs-review tests, `evidence-tickets-rfq4.spec.ts` |
| H-13 | States empty / error / module off; polling | `contacts-directory.ts:646-649` | same | UNCHANGED | `evidence-tickets-s4.spec.ts` |

### 5.7 Requests for quotation (Appendix B §2)

| Id | Capability | Old | New | Status | Verified by |
|---|---|---|---|---|---|
| R-01 | Tab (`tickets.external | tickets.costs`), label, badge | nav.ts:719,1086 | level-2 entry under ספקים וכספים | MOVED (nav only) | `unit-tickets-rfq.spec.ts:265-270` (`.at(-2)` assert CHANGES) |
| R-02 | URL model: `?state= ?dept= ?q= ?rfq=<id> &view=compare ?new=1&from=`; canonicalisation | `rfq-model.ts:414-448` | same | UNCHANGED | `unit-tickets-rfq.spec.ts` (22 exact outputs) |
| R-03 | List: boot sequence, states incl. "not available on this server", department chips, state strip with counts, search, "+ חדשה", KPI tiles incl. questions tile, rows with vendor status bar, "show on map", load more, toasts, back-from-detail refresh, crumbs | `tickets-rfqs.ts` | same | UNCHANGED | `evidence-tickets-rfq2.spec.ts`, `layout-tickets-rfq2.spec.ts` |
| R-04 | Board: phases, header, compare link, send, "more" menu, pending-questions card, banners, KPI tiles, vendors table, remind-all, per-vendor menu, add vendors, dialogs (question, message, quote, files), files card, order step, terms step + move editor, timeline, refusal mapping | `rfq-board.ts`, `rfq-order.ts`, `rfq-terms.ts`, `rfq-files.ts`, `rfq-*-dialog.ts` | same | UNCHANGED | `evidence-tickets-rfq4.spec.ts`, `evidence-tickets-rfq-code.spec.ts`, `layout-tickets-rfq4.spec.ts`, `layout-tickets-rfq-questions.spec.ts`, `unit-tickets-rfq-order.spec.ts`, `unit-tickets-rfq-terms.spec.ts`, `unit-rfq-attachments.spec.ts`, `unit-rfq-award-notice.spec.ts`, `unit-rfq-vendor-upload.spec.ts` |
| R-05 | Compare: filter, sort, currency groups, pick quotes with scope, approve bar (mobile hugs the bar), confirm dialog, award execution, drafts dialog, ask / answer | `rfq-compare.ts` | same | UNCHANGED | `layout-tickets-rfq-bar.spec.ts`, `layout-tickets-rfq2.spec.ts`, `evidence-tickets-rfq4.spec.ts` |
| R-06 | New sheet: fields, per-vendor channel / code, source-ticket chip, preview, idempotency, validation | `rfq-new.ts` | same | UNCHANGED | `evidence-tickets-rfq2.spec.ts`, `unit-tickets-rfq.spec.ts` |
| R-07 | Questions badge store: polling, manual refresh after board actions, stop while off; "badge for all viewers" setting | `rfq-questions-store.ts`, `system-tickets.ts:658-675` | same store; target entry moves (N-03) | UNCHANGED | `unit-rfq-questions.spec.ts` |
| R-08 | Notification links `#/tickets/rfqs?rfq=<id>` | `rfq_notify.py:21` | same | UNCHANGED | `test_tickets_rfq_notify.py:83` |

### 5.8 Vendors account (Appendix B §3)

| Id | Capability | Old | New | Status | Verified by |
|---|---|---|---|---|---|
| A-01 | Tab (`tickets.costs.view`), label | nav.ts:720,1084 | level-2 entry under ספקים וכספים | MOVED (nav only) | `unit-tickets-vendor-accounts.spec.ts:104-108` (last-tab assert CHANGES) |
| A-02 | Period / status filters (not in the URL), per-currency summary tables, claims table with links to requests, bulk "mark as paid" (`tickets.costs`), CSV export, states | `vendor-accounts.ts`, `vendor-account-model.ts` | same | UNCHANGED | `evidence-tickets-vendor-accounts.spec.ts`, `unit-tickets-vendor-accounts.spec.ts` |

### 5.9 External access (Appendix B §4)

| Id | Capability | Old | New | Status | Verified by |
|---|---|---|---|---|---|
| X-01 | Tab under the service area when placed here; placement switch on the screen; `#/wiskey/external` twin | nav.ts:722,1091,1163 | level-2 entry under ספקים וכספים; wiskey twin untouched | MOVED (nav only) | NEW spec required (gap: nothing asserts `#/tickets/external` today) |
| X-02 | `?grant= ?digest=1 ?request=1 ?drift=1`; KPI filters; list; side panels; pending technicians; drawer + actions; approve / confirmed-gone / digest / drift / settings / request dialogs; revoke all; identity-card gate; banners; polling; states | `access-external.ts`, `access-external/model.ts` | same | UNCHANGED | `evidence-sharedid-293`, `evidence-accessreq-293`, `evidence-grantsmin-295`, `evidence-grants3-295`, `evidence-sharedui-295`, `evidence-secfix2-295`, `unit-access-external` |

### 5.10 Settings › ניהול השירות (Appendix C §A)

| Id | Capability | Old | New | Status | Verified by |
|---|---|---|---|---|---|
| S-01 | Nine sub-tabs, per-permission offering, fixed roving tablist, `?tab=` read / write, hashchange, module-off body, dropdown placement rule | `settings-tabs.ts`, `system-tickets.ts:381-412,1049` | untouched in slices 1-4 | UNCHANGED | `unit-tickets-ui6.spec.ts:33-41`, `evidence-tickets-ui6.spec.ts:226-269`, `unit-tickets-rules.spec.ts`, `layout-dd-place.spec.ts:259-263` |
| S-02 | Every card of the nine tabs (Appendix C §A1-A9: module switch, name, public page, links, hours, matrix, calendar, RFQ terms, uploads, departments editor incl. SLA grid and templates, locations, display D17/D18/D22 + drawer + board + overview rows, channel incl. reports to vendors, templates, costs, rules + dry run, permissions matrix / holders / grants) | as cited | untouched | UNCHANGED | `evidence-tickets-s2.spec.ts`, `evidence-tickets-s5b.spec.ts`, `evidence-tickets-ui6.spec.ts`, `evidence-camera-viewfinder.spec.ts:175`, `evidence-tickets-board.spec.ts:144`, `unit-reports-settings.spec.ts`, `unit-messaging-accounts.spec.ts:122`, backend `tickets_admin` / `tickets_rules` / `tickets_costs` tests |
| S-03 | New module switches: `maintenance.enabled` (MAINT215), `insights.*.enabled` + `reports.building.enabled` (INSIGHT215) and their settings | not on main | **a card on Settings › ניהול השירות › כללי** ("מודולים נלווים": the three switches with a link to each module's settings) and the modules' own settings as cards of the existing tabs (maintenance reminders → כללי; insights thresholds → a 10th tab only if the owner wants - Q6) | NEW | the branches' tests; NEW UI specs with the slices |
| S-04 | Settings index entries (general / departments / permissions) and search | `system-index.ts:113-115,181-184` | untouched | UNCHANGED | `unit-tickets-naming.spec.ts` (`searchSettings('מחלקות')`), `unit-settings-index.spec.ts` |

### 5.11 Planned 2.15.0 pages (NEW - parity with their approved mockups, not with main)

| Id | Capability | Branch design | Proposal | Status | Verified by |
|---|---|---|---|---|---|
| M-01..04 | Ledger (KPIs as filters, places tree / select, table → phone cards, task sheet with renewal + history, supplier card with documents and the expired-insurance confirmation), plans, rounds (run = one checkpoint per phone screen), tags (print); states; role variants; "no open-request action while tickets are off" | `maintenance-215/index.html` | the four pages of תחזוקה ובקרה, unchanged from the approved mockup | NEW | `test_maintenance_215.py` (backend); NEW UI specs with the UI slice |
| I-01..03 | Building report (month, language, sections, preview, PDF, "not included" with reasons), doors / waste drill-downs, settings, states | `insight-215/index.html` | מסך סקירה · דוחות בניין · תובנות under סקירה ודוחות; insights settings in Settings | NEW | `test_insight215_*.py`; NEW UI specs |

### 5.12 UNKNOWN (for the owner / lead - not classified)

U-1 store of the vendor-marker filter and the handled period (per user or per browser) · U-2 `tickets.configure`-only direct open of `?tab=display` · U-3 external systems holding `#/tickets/...` hrefs outside the repository (Companion app sends none) · U-4 "SVC215" scope · U-5 mounting of `handlers-glass.ts` · U-6 specs for `tickets-staff-mine` / `tickets-my-numbers` · U-7 whether the list's scope segment already filters by permission (L-02).

## 6. Settings placement for the two new modules (no new section in the area)

- Settings › ניהול השירות › כללי gains one card **"מודולים נלווים"**: תחזוקה ובקרה (`maintenance.enabled`), תובנות (`insights.doors.enabled`, `insights.waste.enabled`), דוח בניין חודשי (`reports.building.enabled`) - each with its permission note and a link to its settings. `system.configure` (and `insights.manage` for the insight switches, as the branch requires).
- The maintenance reminder lead days and the insight thresholds / door pairs live on their own cards; whether they are cards of כללי or a 10th tab is owner Q6. The INSIGHT215 mockup draws a settings screen; it is reused as that card.
- Nothing of the nine existing tabs moves in slices 1-4.

## 7. nav.ts / router / registry changes (file:line on `origin/main` @ c37c75c91)

| # | File:line | Change |
|---|---|---|
| 1 | `frontend/src/shell/nav.ts:703-711` | keep every href constant; add `TICKETS_MAINT_LEDGER_HREF … TAGS_HREF` (`#/tickets/maintenance/<page>`), `TICKETS_REPORT_BUILDING_HREF`, `TICKETS_INSIGHTS_HREF`, `TICKETS_BUDGET_HREF` (reserved), and the four section entry hrefs `#/tickets/requests|maintenance|vendors|reports` |
| 2 | `nav.ts:712-723` | **`TICKETS_TABS` becomes the four sections** `[{id:'requests', label: tt('secRequests'), short: tt('secRequestsShort'), href: TICKETS_MINE_HREF}, {id:'maintenance', …, href: ledger}, {id:'vendors', …, href: TICKETS_HANDLERS_HREF}, {id:'reports', …, href: TICKETS_OVERVIEW_HREF}]`; add `TICKETS_REQUESTS_PAGES` (`list` → mine, `board`), `TICKETS_MAINTENANCE_PAGES` (4), `TICKETS_VENDORS_PAGES` (`handlers, rfqs, accounts, external`), `TICKETS_REPORTS_PAGES` (`overview, building, insights`) - the `INFRA_*_PAGES` shape (nav.ts ≈649) |
| 3 | `nav.ts:729-739` `applyRfqQuestions` | badge target = `TICKETS_VENDORS_PAGES.find(rfqs)`; also set `dot` on `TICKETS_TABS.find(vendors)` (new optional `TabItem.dot`, drawn by `sw-tabs` like the dropdown chip dot) |
| 4 | `nav.ts:789` `NAV_A` | unchanged (`href: TICKETS_MINE_HREF`) |
| 5 | `nav.ts:850` `AREA_TABS.tickets` | stays `TICKETS_TABS` (now the sections); add `export const TICKETS_PAGE_ROWS: Record<TicketsSection, TabItem[]>` |
| 6 | `nav.ts:919-921` `activeAreaTab` | return the SECTION: `s[1]` in overview/building/insights → `reports`; handlers/rfqs/accounts/external/vendors → `vendors`; maintenance → `maintenance`; mine/department/all/board/requests/(none) → `requests`; a ticket id → `requests` (the row shows the section, no page); add `export function ticketsPageOf(r): string` (`list` for mine/department/all, else `s[1]` or `s[2]`) |
| 7 | `nav.ts:930-943` `crumbsOf` | for `a === 'tickets'`: `[area, section.label, page.label]` (the `system/security` precedent at :938) |
| 8 | `nav.ts:1073-1091` `TAB_PERMISSIONS` | keep every row; add `[ledger/plans/rounds]: ['maintenance.view']`, `[tags]: ['maintenance.view']`, `[building]: ['reports.building']`, `[insights]: ['insights.read']`; sections carry **no** entry - `visibleTabs(TICKETS_TABS)` offers a section when `visibleTabs(TICKETS_PAGE_ROWS[id]).length > 0` (the `SECURITY_SETTINGS_HREF` clause at :1185 generalised) and rewrites its href to the first visible page (the `infraEntryHref` clause at :1188-1192) |
| 9 | `nav.ts:1163` | the `external` placement filter keys on `TICKETS_VENDORS_PAGES`; module gates for maintenance / insights: `MAINT_OFF`, `INSIGHTS_OFF` flags set from the session like `applyTicketsHidden` (:747-758) and checked in `permittedTabs` (:1185) |
| 10 | `nav.ts:1212` `visibleAreas` | unchanged |
| 11 | `nav.ts:1412-1427` `TAB_SECTIONS` | `tickets` (level 1, the sections) + `tickets.requests`, `tickets.maintenance`, `tickets.vendors`, `tickets.reports` (level 2, `available` per module switch); `tst()` words in he/en/ar/ru (`i18n/tab-sections.ts`) |
| 12 | `nav.ts:1452-1466` `sectionIdOf` | add the four page arrays |
| 13 | `nav.ts:380-410` `normalizeTabsConfig` | migrate a stored `tickets` entry whose ids are the old page ids (the `devices.schedules` precedent at :401-405): `overview → tickets.reports`, `board → tickets.requests`, `handlers|rfqs|accounts|external → tickets.vendors` (order and hidden preserved per target section); `mine|department|all` dropped (they are a segment, not tabs); the `tickets` level-1 entry rebuilt as the sections in the order their first migrated page appears |
| 14 | `nav.ts:1351-1372` `legacyRedirect` | add the section entry hrefs: `/tickets/requests|maintenance|vendors|reports` → first visible page of that section (permission-aware, `null` while loading, like the `explore/entities` branch) |
| 15 | `frontend/src/shell/sw-app.ts:2410-2427` router | keep every case; add `maintenance/<page>`, `reports/building`, `reports/insights`, `vendors/budget` (a "not built" panel until it exists); the unknown-segment fallback uses the section's first visible page |
| 16 | `sw-app.ts:2815-2830` `renderChrome` | for `area === 'tickets'`: draw the level-2 `tabpair` from `TICKETS_PAGE_ROWS[activeAreaTab]` exactly as infra does (`infraPageTabs`); hide the level-1 row when only one section is visible (owner Q4); phone: `short` labels |
| 17 | `frontend/src/components/sw-tabs.ts` | optional `short` label on phones; optional `dot` on an item (if not already supported by the dropdown-chip dot) |
| 18 | `frontend/src/tickets/text.ts` (+ en/ar/ru) | `secRequests/Maintenance/Vendors/Reports` (+ `…Short`), `pageList`, `pageBoard`, `newRequestAction` |
| 19 | `frontend/src/i18n/tab-sections.ts` | labels / "where" for the five registry sections |
| 20 | `frontend/src/screens/system-tabs.ts` | no change (it iterates `TAB_SECTIONS`) |
| 21 | `frontend/src/tickets/readiness-model.ts:10`, `board-model.ts:11`, `overview-model.ts`, `rfq-model.ts:447` | no change (hrefs unchanged) |
| 22 | backend | **none** for slices 1-3 (`ui.tabs` stores slugs; `nav.order` unchanged; notification links unchanged) |

## 8. Effect on the user-configurable tab order / hiding (`ui.tabs`)

- Today the editor shows one card "לשוניות בקשות שירות" with nine rows. After slice 1 it shows **five cards**: the sections (4 rows) and one card per section's pages (2 / 4 / 4-5 / 3 rows). Hiding a whole section hides its pages' row; hiding every page of a section hides the section (the "hiding never empties the area" rule, nav.ts:509, still applies at the area level).
- A stored `ui.tabs.tickets` from before slice 1 is migrated on read (§7 item 13) and re-saved in the new shape the next time the administrator saves the editor; the server never validates ids, so no backend change and no migration script (the `devices.schedules` precedent).
- Users have no per-tab order inside an area today and none after; the areas order (`nav.order`) is untouched.
- Tab bar styles: level 1 `pill`, level 2 `underline-compact` by default (`TAB_STYLE_DEFAULTS`), each overridable per section as today. Presentation mode: hybrid turns a page row with > 3 items into a chip (ספקים וכספים, תחזוקה ובקרה) - the generator pages already behave so.

## 9. Tests that pin the current tabs (must change in slice 1, nothing else)

| Spec : line | Today | Slice 1 change |
|---|---|---|
| `unit-tickets-board.spec.ts:121-128` | `TICKETS_TABS` ids = the nine; `activeAreaTab('/tickets/board') === 'board'` | ids = `['requests','maintenance','vendors','reports']`; `TICKETS_REQUESTS_PAGES` ids = `['list','board']`; `activeAreaTab === 'requests'`, `ticketsPageOf === 'board'` |
| `unit-tickets-handlers.spec.ts:25-32` | `TICKETS_TABS[5]` is `handlers` | `TICKETS_VENDORS_PAGES[0]` is `handlers`; `activeAreaTab === 'vendors'` |
| `unit-tickets-overview.spec.ts:267-274` | `TICKETS_TABS[0]` is `overview` | `TICKETS_REPORTS_PAGES[0]` is `overview`; section `reports` |
| `unit-tickets-rfq.spec.ts:265-270` | `.at(-2)` is `accounts` | `TICKETS_VENDORS_PAGES` ids = `['handlers','rfqs','accounts','external']` |
| `unit-tickets-vendor-accounts.spec.ts:104-108` | last non-external is `accounts` | same assert on `TICKETS_VENDORS_PAGES` |
| `unit-tickets-naming.spec.ts:109,123-124` | visible labels = the eight | visible section labels = `['בקשות','ספקים וכספים','סקירה ודוחות']` for a holder of every tickets permission (תחזוקה appears only with the module on + `maintenance.view`); `tickets.view` alone → `['בקשות']`; page-row asserts added |
| `unit-rfq-questions.spec.ts:104-111` | badge on `TICKETS_TABS.find(rfqs)` | on `TICKETS_VENDORS_PAGES.find(rfqs)` + dot on the section |
| `unit-tabset-registry.spec.ts:62-86,130-138` | section `tickets` = nine ids minus external | `tickets` = 4 section ids; `tickets.vendors` includes `external` only with placement `both|tickets`; the `ui.tabs {tickets:{order:['all','mine'],hidden:['department']}}` case becomes a migration case (`{tickets:{order:['board','overview']}}` → `tickets` order `['requests','reports']`) |
| `unit-tabs-config.spec.ts:112,114` | `TAB_SECTIONS` ids = 14 | 18 (four new level-2 ids) |
| `unit-tickets-model.spec.ts:35-50` | `activeAreaTab` is `department` / `all` / `mine` / `''` | `requests` for all four; `ticketsPageOf` is `list` / `list` / `list` / `''` |
| `layout-dd-place.spec.ts:42-43` | `/tickets/mine` needs one chip | two rows → expectation per the infra rows' existing rule |
| `evidence-tickets-*.spec.ts`, `layout-tickets-*.spec.ts`, backend link tests | drive URLs | **no change** (hrefs unchanged) - they are the parity proof and must stay green |

## 10. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Identity-keyed logic (`items === TICKETS_TABS`, `sectionIdOf` by array identity, nav.ts:1163,1452) silently stops matching when arrays are rebuilt | keep the exported constants, add the page arrays to both maps, cover with `unit-tabset-registry` rows |
| 2 | The list's scope segment may not filter by permission like the tabs did (U-7) | verify before slice 2; one-line `tabAllowed` filter + unit row if needed |
| 3 | A level-1 row of one item (employee) looks like a stray button | hide the row when a single section is visible (Q4); the mockup shows it |
| 4 | Two chrome rows cost vertical space on phones (the main complaint area) | short labels; hybrid / dropdown mode already configurable per group; the level-2 row disappears for single-page sections (employee, finance) |
| 5 | `ui.tabs` migration of stored orders: a wrong mapping would hide a page an administrator never hid | migration maps only known ids; unknown ids are kept in `extraOrder` as today; unit cases per mapping |
| 6 | Specs that assert `activeAreaTab` values | listed in §9; change in the same commit as `nav.ts` |
| 7 | The RFQ questions badge is the one capability that visually moves (level-1 number → level-2 number + section dot); a manager used to the number on the row may miss it | the section dot + the area-icon count stay; owner Q5 may ask for the number on the section too |
| 8 | Notifications already stored with `#/tickets/...` links | untouched by design (no href renamed) |
| 9 | Section names collide with the configurable module name ("בקשות" vs a renamed module, e.g. "פניות") | `secRequests` derives from `tt('area')`'s configured plural (D33), so a rename flows through |
| 10 | The two new modules land before or after the IA slices | the sections exist from slice 1 with `available()` false until the module switch is on; the branches plug their pages into `TICKETS_MAINTENANCE_PAGES` / `TICKETS_REPORTS_PAGES` |

## 11. Migration / rollout in slices (smallest first)

| Slice | Content | Capability change | Shippable alone | Specs |
|---|---|---|---|---|
| **1 - navigation only** | nav.ts items 1-14 (sections, page rows, registry, permissions, `activeAreaTab`/`ticketsPageOf`, crumbs, `ui.tabs` migration, redirects), `sw-app.ts` chrome row + router fallback, `sw-tabs` short/dot, texts, i18n. **No screen file touched.** The list page keeps its scope segment; every href stays. | **none** (the three scope tabs stop being duplicated as level-1 entries; the segment on the page is unchanged) | yes - release 2.13.x candidate | all existing evidence / layout / backend specs green unchanged; only the §9 unit specs change |
| 2 - parity verification | L-02 (segment permission filter), L-08 and H-10 evidence rows, X-01 spec for `#/tickets/external`, phone layout rows for the two chrome rows | none | yes | new specs only |
| 3 - section action "בקשה חדשה" | the shell draws the action at the end of the level-2 row of בקשות (desktop) and as a FAB above the bottom bar (phone, Q2) for `tickets.create`, pointing to `listHref(scope, …, {create:true})`; the page-head buttons stay | +1 entry point | yes | `evidence-tickets.spec.ts` row |
| 4 - the two 2.15.0 modules plug in | MAINT215 UI slice fills `TICKETS_MAINTENANCE_PAGES`; INSIGHT215 UI slice fills `building` / `insights`; Settings "מודולים נלווים" card; vendor card gets the "מסמכים" link to the ledger | new pages (their own CRs) | per branch | their own specs |
| 5 - optional, owner decision | group the nine settings sub-tabs into four groups (כללי+תצוגה · מחלקות+מיקומים+הרשאות · ערוצים (ערוץ+תבניות) · כספים+פתיחה אוטומטית) keeping every `?tab=` id and the roving tablist; phone bottom bar swap (Q3) | none (grouping only) | yes | `unit-tickets-ui6.spec.ts:33-41`, `evidence-tickets-ui6.spec.ts:226-269` change |

Rollback of slice 1 = revert one commit (no data, no backend, no stored-preference change that the migration cannot read back: a `ui.tabs` entry saved in the new shape after slice 1 contains only unknown ids for the old code, which the old `configureTabs` ignores - the old nine-tab row then shows in the default order).

## 12. Questions the owner must answer

1. **Section names** (defaults proposed): בקשות · תחזוקה ובקרה · ספקים וכספים · סקירה ודוחות; phone short labels בקשות · תחזוקה · ספקים · סקירה. (a) accept, (b) change.
2. **"בקשה חדשה" placement**: (a) as today in the page head only (slice 1), (b) also a persistent action at the end of the section row on desktop + a phone FAB (slice 3). Recommend b.
3. **Phone bar**: (a) keep the areas bar, sections as a pill row with short labels (default), (b) swap the bar to the four sections while inside the area with "עוד" back to the areas. Recommend a.
4. **Single-section users**: hide the level-1 row when only one section is visible (employee)? Recommend yes.
5. **RFQ questions badge**: (a) number on the page entry + dot on the section (proposed), (b) number on the section too.
6. **Settings**: (a) keep the nine sub-tabs; new modules as cards of כללי (proposed), (b) group the nine into four groups (slice 5), (c) a 10th tab "מודולים נלווים".
7. **Board as a page, not a view** (parity rule): confirm.
8. **Reserved places** (תקציב מחלקות, vendor score, vendor documents on the card): keep reserved (nothing built) - confirm, or drop from the mockup.
9. **UNKNOWN items U-1..U-7** (§5.12): any the owner wants settled before slice 1 (U-7 is the only one that can affect parity, and it is verified in slice 2 anyway).

## Owner review 24.10 decisions

Source: the owner's review of the mockups, 2026-10-24 (`private/planning/OWNER_MOCKUP_REVIEW_2026-10-24_raw.txt`, item 9). Question numbers below are those of the review form; where they differ from this document's own question list the matching section is named. Recorded as the owner's decisions; the build follows them.

Mockup approved with these answers:

- **Settings-driven:** many items are **editable in settings** (the standing rule): the section names, the order and visibility of the sections and the placement choices proposed above are configurable rather than fixed.
- **Bottom bar on the phone (form Q4; this document's Q3):** **the areas bar as today**, and it is **editable** (option a; the bar is not swapped to the four sections).
