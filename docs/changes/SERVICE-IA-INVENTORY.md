# Service-management area - information-architecture inventory (STEP 1, read-only)

Date: 2026-10-23 · Source of truth: `origin/main` @ `c37c75c91` (2.12.3), plus the planned 2.15.0 branches `origin/pilot/MAINT215-295` @ `85375d754`, `origin/pilot/INSIGHT215-295` @ `f89aa2f30`, `origin/pilot/FLEET215-295` @ `5d89e7c31`. A branch `pilot/SVC215-295` does not exist on `origin` (a local `svc215-work` exists and has no diff against `origin/main`) - the "SVC215" planning item is therefore recorded as UNKNOWN below.
Method: `git show` / `git grep` on `origin/main`; three independent read-only sweeps (Appendices A-C) went below the tab level per the owner's binding addition of 23.10 (every filter, remembered preference, view mode, bulk action, menu, shortcut, export, drawer tab, inline flow, counter, query parameter, deep link, per-role variation, empty/error/off state). Anything that could not be settled from the source is marked **UNKNOWN**, never guessed. Nothing was edited or run.
Naming: the module's names are configurable (D33, `frontend/src/tickets/naming.ts`); Hebrew labels below are the defaults as rendered today.

## 0. The area in one picture (today)

```
rail / phone bottom bar:  ראשי · אבטחה · מפה · מולטימדיה · WisKey · תשתיות · [בקשות שירות]   (NAV_A, nav.ts:778-790; the area is offered only while tickets.enabled)
                                                                             │
level-1 pill row (TICKETS_TABS, nav.ts:712-723, one flat row of NINE entries, filtered per permission):
   סקירה · שלי · המחלקה · לוח מנהל · הכול · מטפלים וספקים · בקשות הצעת מחיר · חשבון ספקים · גישת חוץ
     │      └──────┬──────┘    │       │        │                  │                 │            └ only when access.external.placement = tickets | both
     │             │           │       │        │                  │                 └ #/tickets/accounts  (tickets.costs.view)
     │             │           │       │        │                  └ #/tickets/rfqs  (tickets.external | tickets.costs)  [?rfq= board, &view=compare, ?new=1&from=]
     │             │           │       │        └ #/tickets/handlers  (tickets.configure | tickets.manage)  [?seg=handlers|vendors|contacts|review]
     │             │           │       └ #/tickets/all  (tickets.all_departments)
     │             │           └ #/tickets/board  (tickets.manage + server manager gate)  [?state= ?place= ?assignee= ?pane=handlers ?t= ?new=1]
     │             └ ONE screen <tickets-list> at #/tickets/mine | /department (tickets.view | tickets.create / tickets.view) - the scope is ALSO a segment inside the page head (tickets-list.ts:427-429)
     └ #/tickets/overview  (tickets.manage + server manager gate)  [?dept=]
full-screen detail: #/tickets/<16-hex id>  (no tab is active; back link = last scope)        settings: הגדרות › ניהול השירות  #/system/tickets?tab=<9 tabs>
```

Facts that shape every proposal:
1. **"שלי / המחלקה / הכול" are already one screen.** The three area tabs and the page-head scope segment (`data-scope-seg`) drive the same `<tickets-list>`; only the URL segment differs (`tickets/model.ts:44-56`). Cards / table / calendar are already view modes of that one screen (`list-view-switch.ts`), and the board's own view switch sends the user back to the list in the chosen mode (`tickets-board.ts:300-306`).
2. **The board is a different screen**, not a view: different `?state=` vocabulary, `?place=`, `?assignee=`, `?pane=handlers`, the floors tree, grouping, the closed strip, the "today" row, the stuck banner, 30-s polling, manager-only server gate (Appendix A §5).
3. **The level-1 row is the only thing `ui.tabs` configures in this area** (section `tickets`, nav.ts:1424); the settings' nine sub-tabs, the handlers segments and the RFQ sub-views are not registry sections (Appendix C §B2).
4. **Every inbound deep link uses today's hrefs and is persisted** in `notifications.link` rows (Appendix C §D1); public vendor / handler links are outside the hash router and are unaffected by any IA change (Appendix C §D4).
5. **Six unit specs pin the exact id list, order and INDEX of `TICKETS_TABS`** (Appendix C §C2): `unit-tickets-board.spec.ts:121-128` (exact nine ids), `unit-tickets-handlers.spec.ts:25-32` (`TICKETS_TABS[5]`), `unit-tickets-overview.spec.ts:267-274` (`[0]`), `unit-tickets-rfq.spec.ts:265-270` (`.at(-2)`), `unit-tickets-vendor-accounts.spec.ts:104-108` (last non-external), `unit-tickets-naming.spec.ts:102-127` (the eight visible labels), plus `unit-tabset-registry.spec.ts:62-86,130-138` and `unit-tabs-config.spec.ts:112-158` (section ids).

## 1. Screens, tabs, sub-tabs, drawer tabs and dialog-level capabilities (summary; detail with file:line in Appendices A-B)

Legend for "who sees it": the TAB_PERMISSIONS entry (nav.ts:1073-1091) or the screen's own `can.*` gate; "any scope" unless noted. ⟂ = the server narrows every row by its single visibility rule regardless.

| # | Surface | Route | Who sees it | Job | Sub-surfaces (tabs / segments / views / dialogs) |
|---|---|---|---|---|---|
| 1 | **Manager overview** `<tickets-overview>` (MGRDASH) | `#/tickets/overview[?dept=]` | `tickets.manage` + server manager gate (nav:1080; to:405-409) | "What needs me today" for a department manager: numbers row, stuck-where, handler load, overdue, approvals, agenda, throughput, department comparison | department chips; period selector (shared with handler cards, localStorage); fold/unfold per card (remembered); "all overdue" / "show all" expansions; links out to board, accounts, RFQ board, ticket costs tab; polling 60 s / 10 min; offline, partial, unavailable, empty, loading, not-manager, module-off states |
| 2 | **Requests list** `<tickets-list>` (CR-038 S1, TKUI4, TKCAL, S6b) | `#/tickets/mine` · `/department` · `/all` (+`?status= ?dept= ?q= ?t=<id> ?new=1 ?tab= ?view=timeline ?assign=`) | mine: `tickets.view` or `tickets.create`; department: `tickets.view`; all: `tickets.all_departments` | The one list of requests the viewer may see, narrowed by scope | scope segment (mine/department/all, radiogroup); state filter (open · unassigned · handling · done · closed · all); department chips; text search; filter button + card filter row (priority, handler, flags - not remembered); counts per scope/state/department (`tickets/facets`); inbound-queue chip (managers); "my numbers" 4 tiles; "+ חדשה" (`tickets.create`); **view switch cards / table / calendar / board** (cards-vs-table remembered on the server per user; calendar wanted remembered in the browser); pagination; cards poll 20 s; the card "⋯" menu (open, timeline, status moves, assign, delete - gated by `can.*`); toasts; drawer `<ticket-detail mode="drawer">` or full page by `ui.detail`; create sheet/dialog by `ui.new_ticket`; states loading / module-off (link to Settings for `system.configure`) / forbidden / error / empty per scope / no departments / no match |
| 2a | **Table mode** `<tickets-table>` | same routes, server pref `view=table` | same | Dense work queue | column chooser (order, visibility), sort, density, page size, **saved views (max 20, private)** + default view, the "what is happening" column pref, table filters popover, multi-select + sticky bulk bar (status, assign, delete), inline status and handler cells with cell menus, keyboard navigation, CSV export of the filter, monthly report CSV, 20-s polling, skeleton / error / empty, phone layout below 768 px |
| 2b | **Calendar mode** (`calendar-view.ts`) | same routes, `calendar-mode.ts` (browser) | same | Week view of due / scheduled requests | Sunday-first week, phone day view, prev/next/today, arrow keys, legend, counts, event card opens the drawer, "load more", empty week, card filters apply |
| 3 | **Manager board** `<tickets-board>` (CR-038 S6) | `#/tickets/board[?state= ?dept= ?place= ?assignee= ?q= ?t= ?new=1 ?pane=handlers]` | `tickets.manage` + server manager gate (nav:1081; tb:340-345) | The department manager's triage board | pane switch cards / handlers (embedded `<tickets-handlers embedded>`); department chips with counts; state strip (הכול · ממתינות לי · תקועות · ללא מטפל · נסגרו השבוע / סגורות); handler filter chip; floors tree / chips / chips+tree (D19, `ui.board_floors`) and the per-user "hide tree" (`/me/prefs`); text search; card filter row; view switch (back to the list modes); "+ חדשה"; "today" row; stuck banner; grouping ממתין לי / תקועות / בטיפול by assignee (D20); closed section collapsed (D21); board card = list card with the warning line; drawer / create; truncation notice; 30-s polling; states loading / empty / no match / error / not a manager / module off; tree keyboard |
| 4 | **Request detail** `<ticket-detail>` (TKUI1) | drawer `?t=<id>` on 2/3, or full page `#/tickets/<id>` (D18 `ui.detail`) | whoever the server lists the ticket to (role-resolved `can.*`) | One request: header + status block + 4 tabs | size switch drawer 520 / wide 640 / full (`drawer-prefs.ts`, per browser; default `ui.drawer_size`); phone full / half sheet (`ui.phone_sheet`); tabs **סקירה · שיחה · עלויות · היסטוריה** in that order (`drawer-model.ts`), default tab `ui.detail_tab` (Settings) with `?tab=` aliases conv/conversation/messages, costs/cost, history/timeline, overview; badges on שיחה (unread) and עלויות (waiting for me); status block: one primary + one quiet action + "⋯" menu (status moves, waiting toggle, reminder, cancel, reopen, duplicate-of, delete, copy link, expand); dialogs: assign (internal / external contact, `?assign=contact:<id>` prefill), note / message, close, return, cancel, reopen, delete (`delete-dialog.ts`), code lock, camera viewfinder (`ui.camera_viewfinder`), link panel (copy / new / revoke); Overview: people, now, facts, photos, device history fold; Conversation: sub-tabs עם הספק / הצוות with two composers and drafts, keyboard asymmetry; Costs: quote + payment-demand cards, approve / adjust / reject, revisions fold; History: timeline, files, link audit; `ticket-changed` / `ticket-gone` events; flash / stale / 409 reload; polling while open |
| 5 | **Create form** `<ticket-create>` (D22) | `?new=1` on 2/3 (sheet or dialog by `ui.new_ticket`); also from a device window / the map (`map-create.ts`) | `tickets.create` (`meta.can.create`) | Open a request | fields: department (offered by membership / open-to-all), category, priority, title, description, place via location picker + plan room, device, photos; duplicate hint; idempotency key; optional assign step (vendor picked → the drawer opens with the external-assign dialog prefilled, TKUI1) |
| 6 | **Handlers and vendors** `<tickets-handlers>` (owner 2026-10-14, TKUI6) | `#/tickets/handlers[?seg=handlers|vendors|contacts|review]`; embedded at `#/tickets/board?pane=handlers` | `tickets.configure` or `tickets.manage` (nav:1083); the `review` segment only for `tickets.configure` | Who may handle a request, how to reach them, and the readiness of outbound sending | segments with counts (radio group, arrow keys): **מטפלים** (members with an account via `handlers-members.ts` + employees without an account), **ספקים**, **אנשי קשר**, **דורש בחינה** (NEEDSREVIEW: two cards, confirm dialog, thresholds); department chips (a department manager: his departments only); text search; "+" per segment (`u6AddHandler / u6AddVendor / u6AddContact`); handled-period selector (HANDLERLOAD, browser) and load counts on cards (managers); readiness strip ONLY when something is missing (items link to `#/system/tickets`, `?tab=channel`, `?tab=permissions`, `#/system/messaging-accounts`); directory rows: quick channel radios (WhatsApp / e-mail / copy), code chip, vendor marker filter + chip + editor (VENDMARK), sw-drawer editor (configurer vs department-manager mode, hourly-rate fields, phone verification row and states, live-link warning, identity card), export (JSON), erase, phone masking for managers; portal requests card (`tickets-portal-requests`); states empty / error / module-off; polling via `live-refresh` |
| 7 | **Requests for quotation** `<tickets-rfqs>` (TKRFQ2) | `#/tickets/rfqs[?state= ?dept= ?q=]`, `?rfq=<id>` (board), `?rfq=<id>&view=compare`, `?new=1[&from=<ticket>]` | `tickets.external` or `tickets.costs` (nav:1086) ⟂ | Ask several vendors, compare, award, order, terms | list: department chips, state strip with counts, text search, "+ חדשה", KPI tiles incl. the **questions tile**, rows with the vendors' status bar, "show on map", load more, back-from-detail refresh; board (`rfq-board.ts`): phases, header, compare link, send, "more" menu, pending-questions card, banners, KPI tiles, vendors table, remind-all, per-vendor menu, add vendors (link to `#/tickets/handlers?seg=vendors`), dialogs (question, message, quote, files), files card (RFQ-VENDOR-UPLOAD), order step (`rfq-order.ts`), terms step per award (`rfq-terms.ts`, move editor), timeline, refusal mapping; compare (`rfq-compare.ts`): filter, sort, currency groups, pick quotes with scope per pick, approve bar, confirm dialog, award execution, drafts dialog, ask/answer; new sheet (`rfq-new.ts`): fields, per-vendor channel/code, source-ticket chip, preview, actions, idempotency, validation; states loading / empty / no match / error / forbidden / module off / "not available on this server" |
| 7a | **RFQ questions badge** (`rfq-questions-store.ts`, RFQQUESTIONS) | nav only | managers of RFQs (badge for all viewers switchable in Settings) | Vendor questions waiting | number on the "בקשות הצעת מחיר" tab, a dot on the dropdown chip, a small count on the area icon in the rail / bottom bar (`areaBadge`, nav.ts:729-744); polled; refreshed by the board's actions |
| 8 | **Vendors account** `<tickets-vendor-accounts>` (TK258) | `#/tickets/accounts` (no query params) | `tickets.costs.view` (nav:1084) ⟂ | What is owed / paid / waiting per vendor and currency | period and status filters (not in the URL); summary tables per currency (never summed across currencies); claims table, each row linking to its request; bulk "mark as paid" (`tickets.costs`); CSV export of the current filter (server, formula-guarded); states loading / error / forbidden |
| 9 | **External access** `<access-external-screen>` (SHAREDID-293) | `#/tickets/external` when `access.external.placement` = tickets \| both (else `#/wiskey/external`); `?grant= ?digest=1 ?request=1 ?drift=1` | `access.external.grant` at any scope (nav:1091) | Approve / revoke outside persons' access | KPI buttons as filters, default filter, list filters, rows, side panels, pending-technicians panel, drawer with actions, approve / confirmed-gone / digest / drift / settings / request dialogs, revoke all, identity-card gate; banners; polling. The placement switch lives on the screen itself (system administrator) |
| 10 | **User-menu / shell items of the module** | `sw-user-menu.ts:461` (`tickets-staff-mine`: the user's own no-login work links / mobile), `tickets-my-numbers` (list head), `tickets-inbound-chip` (list head, managers) | per component | personal items | not tabs; unaffected by the tab structure |
| 11 | **Settings › ניהול השירות** `<system-tickets>` | `#/system/tickets?tab=general|departments|locations|display|channel|messages|costs|rules|permissions` (+ legacy `?tab=contacts` → `#/tickets/handlers?seg=vendors`) | tab: `system.configure` or `tickets.configure` at installation scope (nav:1087,1146); per sub-tab: display/channel/costs/rules = `system.configure`; messages/locations = `tickets.configure`; general/departments/permissions always offered (settings-tabs.ts:17-21) | Everything the installation configures for the module | **כללי**: module switch, display name (D33), handlers link card, public handler page / address (`public-settings.ts`), link lifetime (D5), vendor send hours (D4), urgent-as-critical (D28), notification matrix + digest (`notify-matrix.ts`), working-hours calendar (SLACAL), RFQ terms (payment schedule, award notice, reminders, badge for all viewers), RFQ vendor uploads; **מחלקות**: list + add + deleted/restore, editor (details, delete, categories with device domains, members + roles + notify, priorities, rules/overrides, SLA grid, opening templates); **מיקומים**: list, editor, per-department default; **תצוגה**: detail mode D18, new-request mode D22, drawer default tab / size / phone sheet, camera viewfinder, board D19-D21 + handled days, long press D17, overview (MGRDASH) options; **ערוץ הודעות**: WhatsApp switch, buttons, reply window, e-mail fallback, phone verification, managers' full phones, uses/accounts, health, reports to vendors; **תבניות הודעה**: purpose × language × department editor with preview; **כספים**: installation defaults, per-department mode, allowed line kinds; **פתיחה אוטומטית** (TKRULES): switch, rules list/editor, dry run; **הרשאות**: role × permission matrix, holders, personal grants (D25, `rbac.assign`). Fixed `role=tablist` with roving keys; the settings index lists only general / departments / permissions |

The handlers page, the RFQ screens, the vendors account, the overview and the board each carry their own page head (large title, department chips, state strip, search, "+"): five copies of one frame (`tickets-list.ts:418-442` is the reference anatomy).

## 2. Who sees what today (permission → tabs), from TAB_PERMISSIONS and the screens' own gates

| Holder (typical role) | Level-1 tabs offered | Notes |
|---|---|---|
| `tickets.create` only (an employee who may open requests) | שלי | mine shows what they opened; "+ חדשה" |
| `tickets.view` (handler / operator) | שלי · המחלקה | the inbound chip and "my numbers" need more |
| `tickets.view` + `tickets.all_departments` | + הכול | |
| `tickets.manage` + manager membership (department manager) | + סקירה · לוח מנהל · מטפלים וספקים (his departments, masked phones) | the server's manager gate decides on the overview / board even when the tab shows |
| `tickets.external` or `tickets.costs` | + בקשות הצעת מחיר | `tickets.costs` approves; `tickets.external` opens |
| `tickets.costs.view` (finance) | + חשבון ספקים | |
| `tickets.configure` (module administrator) | + מטפלים וספקים (full), the `review` segment, Settings (name, departments, locations, templates, permissions) | |
| `system.configure` (system administrator) | Settings (switch, display, channel, costs, rules, public page, matrix, calendar, RFQ terms) | |
| `access.external.grant` | + גישת חוץ when placed here | |

## 3. Planned 2.15.0 additions that add screens

| Bundle (branch) | State | New screens / pages | Where the branch already placed them | Permissions / switch |
|---|---|---|---|---|
| **Maintenance and field** (`pilot/MAINT215-295`, CR-MAINT215, rows r084-r088) | backend slice 1 + approved mockup `docs/design/mockups/maintenance-215/index.html` | 1 פנקס אישורים ובדיקות (certificates, mandatory inspections, supplier documents; task sheet + supplier card), 2 תחזוקה מונעת (preventive plans), 3 סבבים ובדיקות (rounds + digital checklist, one checkpoint per phone screen), 4 תגי QR/NFC (tags, printing); a "יומן תזכורות" link | a level-1 section "תחזוקה ובקרה" inside `#/tickets/...` with those four as its level-2 row (the mockup's PLACEMENT note) | `maintenance.view / perform / manage`; `maintenance.enabled` OFF by default; no "open a request" action while the tickets module is off (owner 2026-10-20); notifications `maintenance.due_soon / overdue` |
| **Insights and monthly building report** (`pilot/INSIGHT215-295`, CR-INSIGHT215) | backend slice 1 + mockup `docs/design/mockups/insight-215/index.html` | 1 דוחות בניין (month, language, section picker, preview, PDF), 2 the PDF paper, 3 doors drill-down, 4 waste drill-down, 5 settings (three switches, door pairs, thresholds), 6 states | a level-1 section (the mockup's SECTION_LABEL) inside `#/tickets/...` with "מסך סקירה" (the manager overview) and "דוחות בניין" as its level-2 row | `insights.read`, `insights.manage`, `reports.building`; switches `insights.doors.enabled`, `insights.waste.enabled`, `reports.building.enabled` OFF by default |
| **Fleet / health report** (`pilot/FLEET215-295`) | backend + a settings-page mockup | a health-report settings page and a receiver overview | Settings (system), not the service area | not in scope of this IA |
| "SVC215" | **UNKNOWN** - no `origin/pilot/SVC215-295`; local `svc215-work` has no diff | - | - | owner question |
| Expansion ideas 9 / 13 / 24 (vendor score, quote comparison, department budget) | ideas only (`private/planning/EXPANSION_IDEAS_2026-10-20.md:227-229, 382`); **nothing on main**: `git grep -i budget|reputation` finds no tickets code | would add: vendor score on the vendor card, budget bar on the overview, a budget editor per department | not placed | not built - the proposal reserves a place, builds nothing |

## 4. Where every choice is remembered (the preferences that must survive a restructure)

| Preference | Store | Read / write |
|---|---|---|
| list scope, state, department, text; board state / department / place / handler / text; RFQ state / department / text; overview department | URL only | `tickets/model.ts:44-68`, `board-model.ts`, `rfq-model.ts:414-448`, `to:363-374` |
| last list scope (the detail page's back link) | memory | `tickets/model.ts:70-77` |
| cards vs table | server `/me/prefs` | `api/tickets-table.ts:140-141,277-300` |
| calendar wanted | browser | `tickets/calendar-mode.ts:5-22` |
| table columns, order, sort, density, page size, default saved view; saved views (≤ 20, private) | server | `tt:183-202,291-297`, `table-toolbar.ts:123-168,215` |
| "what is happening" column | browser | `list-prefs.ts:5-26` |
| board tree hidden | server `/me/prefs` (D30) | `api/tickets-board.ts:98-103` |
| board prefs (view) | server | `tb:304` `saveBoardPrefs` |
| drawer size | browser; default from Settings `ui.drawer_size` | `drawer-prefs.ts:9-25` |
| drawer default tab, detail mode, new-ticket mode, phone sheet, camera viewfinder, board D19-D21, handled days, long press, overview options | installation `tickets/settings ui.*` | `api/tickets.ts:188-199`, Appendix C §A4 |
| conversation sub-tab, drafts, half/full sheet | component state / browser | `td:121-123`, `conversation-tab.ts:73` |
| overview folded cards, yesterday deltas, "handled" period | browser | `overview-model.ts:591-605`, `to:42,571-577`, `handler-load.ts:46-70` |
| vendor marker filter | browser (UNKNOWN whether per user or per browser) | `contacts-directory.ts:633-637` |
| tab order / hidden per section; tab bar style; presentation mode (tabs / hybrid / dropdown) per group | installation `ui.tabs`, `ui.tabs_mode[_groups]`; user `/me/prefs` for the mode | Appendix C §B |
| areas order | user `/me/prefs nav.order`, else `ui.tabs.areas.order` | `nav-order.ts` |

## 5. Inbound deep links (all persisted in `notifications.link` or sent by WhatsApp / e-mail text) - the compatibility surface

`#/tickets/<id>` (every `ticket.*` source) · `#/tickets` (digest, staff mobile, phone verify) · `#/tickets/rfqs?rfq=<id>` and `#/tickets/rfqs` (every `rfq.*` source) · `#/tickets/overview` and `#/tickets/overview?dept=<id>` (dash digest / busy department) · `#/tickets/handlers?seg=review` (needs-review reminder) · `#/tickets/handlers?seg=vendors` (portal technician request) · `#/tickets/external?grant=<id>|?digest=1` (when placed here) · `#/system/tickets` (channel down). Push notifications land on `#/notifications/<id>` and follow the stored `link` from there (Appendix C §D2). Frontend-internal links: Appendix C §D3. Backend tests that pin them: `test_tickets_monitor.py:79`, `test_tickets_mgrdash_alerts.py:107`, `test_tickets_notify_matrix.py:132`, `test_tickets_rfq_notify.py:83`, `test_sharedid_293.py:309`.

## 6. The navigation machinery the area depends on (file:line)

| Piece | Where |
|---|---|
| hrefs and `TICKETS_TABS` | `frontend/src/shell/nav.ts:703-723` |
| `isTicketsAreaHref`, RFQ badge, `areaBadge` | nav.ts:724-744 |
| module switch `applyTicketsHidden` / `ticketsModuleOn` | nav.ts:747-758 |
| `NAV_A` tickets entry (href `#/tickets/mine`), `NavTabId` | nav.ts:787-794 |
| `AREA_TABS.tickets`, settings tab entry | nav.ts:850, 875 |
| `activeAreaTab` case 'tickets' | nav.ts:919-921 |
| `crumbsOf` | nav.ts:930-943 |
| `TAB_PERMISSIONS` tickets rows | nav.ts:1073-1091 |
| `INSTALLATION_ONLY_HREFS` (settings tab) | nav.ts:1146 |
| `visibleTabs` (external filter keyed on identity `items === TICKETS_TABS`), `permittedTabs` (`TICKETS_OFF`) | nav.ts:1160-1193 |
| `visibleAreas` (area dropped while off) | nav.ts:1200-1218 |
| `TAB_SECTIONS` registry (`tickets`, level 1, `available: ticketsModuleOn`) and `sectionIdOf` | nav.ts:1412-1427, 1452-1466 |
| level-2 precedent: `INFRA_ELECTRICITY_PAGES`, `INFRA_GENERATOR_PAGES`, `infraPageTabs`, `infraEntryHref` | nav.ts:~630-700 |
| `legacyRedirect` (hand-written branches), `demoRedirect` | nav.ts:1351-1372, 1314-1318; callers `sw-app.ts:2177-2194, 2287-2291` |
| router case 'tickets' (detail, overview lazy chunk, board, handlers, accounts, rfqs, first-visible-tab fallback) | `frontend/src/shell/sw-app.ts:2410-2427` |
| chrome rows (level-1 pill row, level-2 `tabpair`, dropdown / hybrid, phone sections) | sw-app.ts:2815-2830 (`renderChrome`), `tabs-mode.ts` |
| settings strip (fixed tablist) | `frontend/src/screens/system-tickets.ts:1049-1050`, `tickets/settings-tabs.ts` |
| `ui.tabs` editor | `frontend/src/screens/system-tabs.ts` at `#/system/diagnostics?tab=tabs` |
| server `ui.tabs` normalisation (slugs only, no registry knowledge) | `smplwise_vms/backend/smplwise/routers/settings.py:539-615` |
| nav order ids (server) | `services/user_prefs.py:16-34` |

## 7. Items the sweeps could not settle (UNKNOWN - for the owner / lead, not guessed)

1. Whether the vendor marker filter and the handled-period selector are per user or per browser (they read localStorage; no server pref was found).
2. A `tickets.configure`-only holder opening `#/system/tickets?tab=display` directly: the tab is accepted but the document is not loaded (Appendix C §A0 "edge case"); whether anything else intercepts it.
3. The Home Assistant Companion app: no code sends a tickets deep link to it (push lands on `#/notifications/<id>`); whether any external integration stores `#/tickets/...` hrefs outside this repository.
4. "SVC215" - no branch on origin.
5. `handlers-glass.ts` and `costs-demands.ts` mounting points were only partially traced (Appendix B §1.7 / §3).
6. Specs for `tickets-staff-mine` / `tickets-my-numbers`: none found by selector grep.
7. Whether `#/tickets/external` is covered by any spec (Appendix B §5.4: no spec asserts it; `evidence-sharedid-293.spec.ts` drives `#/wiskey/external`).

---

The three appendices below are the unedited sweep reports (model output of read-only agents; every row carries its file:line; "UNKNOWN" where the source did not settle it).


# Appendix A - list, table, calendar, detail drawer, create, board, overview (sweep 1)

# Tickets screens: capability inventory (read-only, origin/main @ c37c75c91)

Paths are relative to `frontend/src/` unless they start with `tests/`. I read the source and did not run the app. I read the Playwright and unit specs only by file name, first comment line and targeted greps. Anything I could not read is marked UNKNOWN.

Short names used below:
- **`tl`** = `screens/tickets-list.ts`
- **`tt`** = `screens/tickets-table.ts`
- **`td`** = `tickets/ticket-detail.ts`
- **`tb`** = `screens/tickets-board.ts`
- **`to`** = `screens/tickets-overview.ts`

## 0. Cross-cutting facts

### 0.1 Routes and query parameters

| Route / param | Meaning | Read at |
|---|---|---|
| `#/tickets` or an unknown scope | Redirects to the first visible tab of the area. If none is visible it falls back to `#/tickets/mine`. | `shell/sw-app.ts:2418-2422` |
| `#/tickets/<16-hex id>` | Full-page detail. `tickets-detail` passes `?tab=`, `?view=timeline` (mapped to the history tab) and `?assign=`. The back link goes to `lastScope()`, which is in-memory only and defaults to `mine`. | `tickets/model.ts:21-23`, `screens/tickets-detail.ts:58-64` |
| `#/tickets/mine\|department\|all` | List. An unknown scope reads as `mine` when it is the list. | `tickets/model.ts:44-56` |
| `?status=` | One of `open` (default, omitted), `unassigned`, `handling`, `done`, `closed`, `all`. | `tickets/model.ts:14,46-51` |
| `?dept=` | Department id, clipped to 64 characters. | `tickets/model.ts:49` |
| `?q=` | Text search, clipped to 80 characters. | `tickets/model.ts:50` |
| `?t=<id>` | Opens the drawer (list and board). | `tickets/model.ts:54-55` |
| `?new=1` | Opens the create sheet or dialog. | `tickets/model.ts:55` |
| `?tab=conv\|costs\|history\|overview` | Aliases also accepted: `conversation`, `messages`, `cost`, `timeline`. | `tickets/drawer-model.ts:23-31`, `tl:504` |
| `?view=timeline` | Opens the History tab and scrolls to `#timeline`. | `tl:504`, `td:475` |
| `?assign=contact:<id>` | Opens the external-assign dialog pre-filled once, then `assign-consumed` strips it. | `td:468-474`, `tl:505-506` |
| Board `?state=` | `all\|waiting\|stuck\|unassigned\|closed`. | `tickets/board-model.ts:24,35` |
| Board `?place=` | Regexed to `none` or `site\|building\|floor\|zone\|area:<id>`. | `tickets/board-model.ts:30,36` |
| Board `?pane=handlers` | Shows the embedded handlers directory instead of cards. | `tickets/board-model.ts:46`, `tb:588` |
| Board `?assignee=` | `none\|user:<id>\|contact:<id>`. | `tickets/board-model.ts:31,39` |
| Board `?dept=`, `?q=`, `?t=`, `?new=1` | Same meaning as on the list. | `tickets/board-model.ts:34-44` |
| Overview `?dept=<id>` | The only overview parameter; matched against `DEPT_RE`. | `to:363-374` |
| `#/tickets/rfqs?rfq=<id>` | Link out from the overview tab. | `tickets/overview-tab.ts:173-185` |
| `#/tickets/handlers?seg=vendors` | Link target from readiness items. | `tickets/readiness-model.ts:10` (the `?seg=vendors` form is pinned in tests, see §6) |

- **Parameters dropped by list rewrites.** Every `setFilters` rewrite goes through `listHref`, which only carries `status`, `dept`, `q` and `t`. So `?tab`, `?view` and `?assign` are dropped on any later filter change (`tl:312-315`, `tickets/model.ts:59-68`).
- **Hash-only routing, no real 404.** An unknown `#/tickets/<x>` renders the list and redirects. I found no separate "unknown route" state.
- **Area tabs.** `TICKETS_TABS` is declared in `shell/nav.ts:696-707`.

| Tab id | Order | Permission (`TAB_PERMISSIONS`) | Line |
|---|---|---|---|
| overview | 1 | `tickets.manage` | `nav.ts:1080` |
| mine | 2 | `tickets.view` or `tickets.create` | `nav.ts:1077` |
| department | 3 | `tickets.view` | `nav.ts:1078` |
| board | 4 | `tickets.manage` | `nav.ts:1081` |
| all | 5 | `tickets.all_departments` | `nav.ts:1079` |
| handlers | 6 | `tickets.configure` or `tickets.manage` | `nav.ts:1083` |
| rfqs | 7 | `tickets.external` or `tickets.costs` | `nav.ts:1086` |
| accounts | 8 | `tickets.costs.view` | `nav.ts:1084` |
| external | 9 | `access.external.grant`; only when placement is `tickets` or `both` | `nav.ts:1091` |

- **Tab visibility.** Tabs are hidden while the module is off (`nav.ts:1185`), and the owner can reorder or hide them via `ui.tabs` (`unit-tabset-registry.spec.ts:144-146`).
- **Module-off rule.** `applyTicketsHidden` hides the whole area until `tickets.enabled` is true (`nav.ts:765-775`).

### 0.2 Persistence map (where each choice is remembered)

| Choice | Store | Key | Read / write at |
|---|---|---|---|
| List filters: scope, state, department, text | URL | `status`, `dept`, `q` | `tickets/model.ts:44-68` |
| Last scope, for the page's back link | in-memory | `LAST_SCOPE` | `tickets/model.ts:70-77` |
| Cards vs table | server `/me/prefs` | `tickets.board.view` | `api/tickets-table.ts:140-141,277-300`, `tl:223,368-371` |
| Calendar mode | `sessionStorage`, per tab | `sw.tickets.list.calendar` | `tickets/calendar-mode.ts:5-22` |
| Table "what is happening" column | `localStorage` | `sw.tickets.table.sentence` | `tickets/list-prefs.ts:5-26` |
| Table columns, order, sort, density, page size, default saved view | server `/me/prefs` | `tickets.board.{columns,sort,density,limit,default_view}` | `tt:183-202,291-297` |
| Table saved views (max 20, private) | server | `tableApi().views/createView/deleteView` | `tickets/table-toolbar.ts:123-168,215` |
| Card filter row (priority, handler, flags) | component state only | none | `tl:86`, `tb:79-80`; lost on navigation |
| Board tree hidden | server `/me/prefs` | `tickets.board.tree_hidden` | `api/tickets-board.ts:98-103` |
| Board state, department, place, text, handler | URL | see §0.1 | `tickets/board-model.ts` |
| Drawer size | `localStorage` | `sw.tickets.drawerSize` | `tickets/drawer-prefs.ts:9-25` |
| Drawer default tab, size, phone sheet, detail mode, create-form mode | installation setting `ui.*` | `ui.detail_tab`, `ui.drawer_size`, `ui.phone_sheet`, `ui.detail`, `ui.new_ticket`, `ui.camera_viewfinder` | `api/tickets.ts:188-199` |
| Active tab, phone sheet half/full, conversation sub-tab and drafts, history filter and "show all" | component state only | none | `td:121-123`, `tickets/conversation-tab.ts:73`, `tickets/history-tab.ts:31-32` |
| Overview folded cards | `localStorage` | `sw.tickets.overview.folded` | `tickets/overview-model.ts:591-605` |
| Overview yesterday-delta numbers | `localStorage`, per department or all | `sw.tickets.overview.kpis.<dept\|all>` | `to:42,571-577` |
| Overview and handler-card "handled" period | `localStorage` | `sw.tickets.handlers.handledDays` | `tickets/handler-load.ts:46-70`, `to:524-557` |
| Overview "all overdue" and "show all" expansions, stuck-reason chip | component state only | none | `to:90,92,104` |

### 0.3 Polling

| Screen | Interval | Notes | Line |
|---|---|---|---|
| Shared `LiveRefresh` | 20 s, plus on tab visible and on window focus, minimum gap 1 s, never while hidden | Used by list, table and board. | `tickets/live-refresh.ts:7-8,34-48` |
| List cards | 20 s | `refreshQuiet` skips when the view is the table (and not calendar), when extra pages are loaded, or while loading more. | `tl:99-104` |
| Table | Its own `LiveRefresh`, 20 s | Skips while a menu, move dialog or bulk dialog is open, or when more than one page is loaded. | `tt:103,254-259` |
| Board | 20 s via `LiveRefresh`, quiet | Source comments say "30 s" (`tb:61,359`); the code uses the 20 s default. | `tb:91` |
| Overview | 60 s main refresh | Plus a ten-minute slow part (RFQs, handled counts, claims, payments). Also re-reads on a `notification` push (5 s throttle) and on browser `online`. | `to:40-43,117,325-356` |
| Inbound-queue chip | 60 s | | `tickets/inbound-queue.ts:84` |
| List clock | 60 s | Updates `now` only. | `tl:180` |
| Running clock | Shared minute ticker, no per-second timers | `<ticket-elapsed>`. | `tickets/elapsed-clock.ts:5-9` |
| Drawer / detail | No polling found | Reloads only on a 409 or 404 refusal, or after an action. | `td:462-518` |

### 0.4 Dead or drifting code

- **`tickets/table-switch.ts`** (`boardViewSwitch`, `BOARD_VIEWS = cards|table`) is not used by any screen. It appears only in a file-list in `tests/unit-tickets-table.spec.ts:159`.
- **`tickets/list-prefs.ts`** says in its header that it also keeps "whether the filter row of the cards is left open". Only `sw.tickets.table.sentence` exists.
- **`tickets/work-calendar-card.ts`** is a Settings card (`screens/system-tickets.ts:760`). **`tickets/staff-mine.ts`** is in the user menu (`shell/sw-user-menu.ts:560`). **`tickets/board-settings.ts`** and **`tickets/overview-settings.ts`** are rows of the Settings > display card. None render on the list, board or overview screens.
- **Table page size.** `layout.limit` (25/50/100/200) is read from prefs and sent to the server (`tickets/table-model.ts:17-18,178-181`, `tt:224,295`). The toolbar has no control for it.
- **`ui.handled_days`** and the other settings-only items are read-only on these screens.

---

## 1. `#/tickets/mine|department|all`: `screens/tickets-list.ts` (`<tickets-list>`)

### 1.1 Page frame, filters, counters

| Capability | Behaviour | Remembered? | Gate / variation | file:line |
|---|---|---|---|---|
| Title | The module's configured plural. The header compacts after 40 px of scroll. | n/a | n/a | `tl:420,196-200` |
| Scope segment (radiogroup: mine / department / all) | Each button shows a count. A click is a history push to `listHref(scope, f)`, keeping state, department and text. | URL path | The tab itself is gated: `tickets.view`/`tickets.create` (mine), `tickets.view` (department), `tickets.all_departments` (all). The server's visibility rule decides every row. | `tl:427-429`, `nav.ts:1077-1079` |
| State filter (open, unassigned, handling, done, closed, all) | History push via `setFilters`. Default `open` is omitted from the URL. Two rows of three on a phone. | URL `?status=` | none | `tl:430-432`, `tickets/model.ts:14,141-144`, `tl:143-153` |
| Department chips | Shown only when more than one department is in `meta.departments`. First chip is "all departments". Counts come from `facets`. | URL `?dept=` | The department list is the caller's own from `/meta`. | `tl:402,421-424` |
| Text search | 300 ms debounce, `replaceRoute` (no history entry), `maxlength` 80, searches number / title / device. | URL `?q=` | none | `tl:317-322,435` |
| "Filter" button and row | Only for cards or calendar. Priority chips come from the held rows, plus a handler select (any / none / each holder) and flags stuck, waiting-for-me, cost-to-approve. A flag is offered only when the rows carry it. The button label shows the active count. "Clear" is disabled when nothing is active. | No (component state only) | Client-side over the held rows, so it never widens server visibility. | `tl:411-412,436,441`, `tickets/list-filter-row.ts:19-43`, `tickets/list-filters.ts:11-58` |
| Counters | Scope totals, state totals and department totals from `tickets/facets`. They are read again on every non-"more" page load, including the quiet 20 s refresh. A failed read leaves that number out. Before the counts arrive, invisible two-digit placeholders stop layout shift. | n/a | none | `tl:288-302,406-409` |
| Inbound-queue chip | A chip appears only when WhatsApp replies are unmatched. It opens a dialog and the component polls every 60 s. | n/a | `meta.can.manage`, plus `isApi()` inside the chip. The route answers `[]` otherwise. | `tl:434`, `tickets/inbound-queue.ts:17-24,84-96,138-150` |
| My numbers (4 tiles) | Open with me, waiting for me, overdue, visits today. Only on scope `mine` when the screen is ready. It does its own `list({scope:'mine',status:'open',limit:200})` on every `source`/`module`/`manager` change. | n/a | Setting `ui.dash_handler_numbers`: `managers` hides it from non-managers. Hidden when the viewer has zero open requests. | `tl:501`, `tickets/my-numbers.ts:35-66`, `tickets/overview-model.ts:20,85-88,612-622` |
| Sort / group on cards | Not offered. Order is the server's. | n/a | UNKNOWN: the backend sort order. | n/a |
| Pagination | Cursor "load more" button. | n/a | n/a | `tl:271-274,493` |
| Create button | "+ new" in the header, and "new" in the empty state. Writes `?new=1`. | URL `?new=1` | `meta.can.create`. | `tl:438,481` |

### 1.2 View modes

| Capability | Behaviour | Remembered? | Gate | file:line |
|---|---|---|---|---|
| View switch (radiogroup) | Registry of four modes: cards, table, board, calendar. The active mode also shows its label. | n/a | The board entry needs `meta.can.manage`. | `tickets/list-view-switch.ts:20-30`, `tl:439` |
| Cards | A `.cgrid` of `<ticket-card>`. Skeleton cards (6 on desktop, 3 on phone) while loading. | Server `tickets.board.view=cards` | none | `tl:456-457,492` |
| Table | Embeds `<tickets-table>`, see §2. | Server `tickets.board.view=table` | none | `tl:468-473` |
| Calendar | Embeds `<tickets-calendar>` over the same held list and card filters. It has its own "load more". | `sessionStorage` per tab | none | `tl:487-491`, `tickets/calendar-mode.ts:5-22` |
| Board | Navigates to `#/tickets/board`. | n/a | `meta.can.manage` | `tl:388` |
| Precedence | If the server pref is `table` and the calendar flag is on, calendar wins. A stored `kanban` value reads as cards. | n/a | n/a | `tl:223,468` |

### 1.3 Card, card menu, drawer launch

| Capability | Behaviour | file:line |
|---|---|---|
| Card anatomy | Title link, where-line, status chip with sub-state, sentence, at most 3 chips, footer with number, elapsed clock, timeline link, and 2 avatars. | `tickets/ticket-card.ts:132-166`, `tickets/list-card-model.ts:26-60,64-94` |
| Chip budget | Priority, department, then one of cost-to-approve / stuck / reopened. The cost and stuck chips are managerial-only. | `tickets/list-card-model.ts:51-59` |
| Card "⋯" menu | A top-layer popover with: open (drawer), full screen, copy link. | `tickets/ticket-card.ts:101-109` |
| Menu gating | "Full screen" is shown unless `ui.detail == 'drawer'`. | `tickets/ticket-card.ts:106`, `tl:483` |
| Menu keys | Esc closes; ArrowUp / ArrowDown / Home / End move between items (focus wraps); outside click closes. | `tickets/ticket-card.ts:71,89-95`, `tickets/overlay-menu.ts:77-85` |
| Card actions | `open` writes `hrefOf(id)`. `full` writes `#/tickets/<id>`. `copy` copies `origin + path + search + #/tickets/<id>` and toasts, or toasts the URL if the clipboard fails. | `tl:334-342` |
| Timeline link | Adds `&view=timeline` to the drawer href, so it opens History. | `tl:328-332`, `tickets/ticket-card.ts:162` |
| `ui.detail` modes | `drawer`, `fullscreen`, `drawer_fullscreen` (default). In `fullscreen` mode all card hrefs are `#/tickets/<id>`. | `tl:324-332` |
| Picked highlight | `data-picked` on the open card or row. | `tl:492` |
| Role of the reader | `roleFor(item, meta)` gives requester / handler / manager. It drives the status sentence and the chips. | `tickets/list-card-model.ts:32-39` |

### 1.4 Create, drawer, toasts

| Capability | Behaviour | Gate | file:line |
|---|---|---|---|
| `<ticket-create>` | Rendered only when the module is enabled and `meta.can.create`. `open` follows `?new=1` once the screen is ready. Mode `sheet` (620 px drawer) or `dialog`, set by `ui.new_ticket`. | `meta.can.create` | `tl:508-509`, `tickets/ticket-create.ts:38,82-88` |
| On created | Toast ("created", "absorbed", or "n photos failed"). A new `?t=<id>` opens the drawer, or `#/tickets/<id>` in fullscreen mode. If a vendor was picked, `?assign=contact:<id>` is added. The page then reloads. | none | `tl:373-383` |
| `<ticket-detail mode="drawer">` | Created lazily after the first `?t=`. `open` is true when `ticketId` is set and the screen is ready. It passes `scope`, `focusTimeline`, `initialTab`, `defaultTab`, `sizeSetting`, `sheetSetting`, `cameraViewfinder` and `assignContact`. | `?tab=` and `?assign=` are read from the route | `tl:210,504-507` |
| `ticket-changed` | Patches the card in place from the detail, and the table row. Then a quiet refresh and a table refresh. | none | `tl:356-365` |
| `ticket-gone` | Closes the drawer. A deleted ticket toasts and leaves the list immediately. The table drops it too. | none | `tl:347-354` |
| Toast | Shows 3.5 s (ok) or 7 s (bad), `role="status"`. | none | `tl:304-308,510` |

### 1.5 States

| State | When | Content | file:line |
|---|---|---|---|
| loading | First fetch | Skeleton `ticket-card`s (or 7/2 glass blocks in calendar). | `tl:451-458` |
| module off | `module.enabled=false`, or 404 `feature_disabled` | "module off" box, plus a "to settings" link when `can('system.configure')`. | `tl:228-231,241,459-460` |
| forbidden | 403 from module / meta / list | Lock icon plus message. | `tl:240,461-462` |
| error | Any other error | Message, a hidden error detail, and a retry button that re-runs `boot()`. | `tl:243,463-464` |
| empty | No rows and filters are default | Per-scope text. A "new" button if `meta.can.create`. | `tl:477-481` |
| no departments | Scope `department`, and the caller has no `my_role` in any department | Special message. | `tl:479` |
| no match (server filters) | Rows empty and `q`, `dept` or `status != open` | "Clear filters" resets to `NO_FILTERS`. | `tl:477-478` |
| no match (card filters) | Held rows exist but all are filtered out | "Clear card filters" button, plus "load more" if there is a next cursor. | `tl:484-486` |
| unknown | Backend ordering and `facets` caps ("2000+ scan cap") | See `tickets/list-counts.ts:44-47`. | n/a |

### 1.6 Keyboard and print/export on the list

- **Shortcuts.** The list itself has no keyboard shortcuts. The card menu and the table have their own (§2).
- **Export.** None on cards. CSV and the monthly report are in the table toolbar only.
- **Print.** I found no print capability anywhere in these screens (searched `print` in `screens/tickets-*.ts` and `tickets/*.ts`).

---

## 2. List "table" mode: `screens/tickets-table.ts` (`<tickets-table>`) with `table-model.ts`, `table-toolbar.ts`, `table-bulk.ts`

| Capability | Behaviour | Remembered? | Gate | file:line |
|---|---|---|---|---|
| Base filters | Scope, state, department and text come from the list. | URL (list) | n/a | `tt:204-206`, `tickets/table-model.ts:126-134` |
| Sort | Header buttons: click flips the primary key. Another column becomes the only key (newest first for created, activity, stuck, cost). Shift+click flips in place, or adds or replaces a second key (maximum 2). `aria-sort` is on the primary key. Default sort is activity descending. | Server `tickets.board.sort` | n/a | `tickets/table-model.ts:15-16,35,93-121`, `tt:611-614` |
| Columns | 12 base columns: number, title, department, priority, status, assignee, place, device, created, activity, stuck, sla. Defaults are the 8 without device, created, stuck and sla. Number and title are always on. Cost and cost-status are added with `setCostColumns`. | Server `tickets.board.columns` | Cost columns need `tickets.costs.view`, or demo mode. | `tickets/table-model.ts:11-14,22-33,51-78`, `tt:135` |
| "What is happening" column | A client-only extra column placed after the title. It is hidden on a phone. | `localStorage` `sw.tickets.table.sentence` | n/a | `tt:536-548`, `tickets/table-toolbar.ts:177-179` |
| Column chooser popover | Show/hide, move up/down, "reset". Not shown on phone. | Server (layout) | n/a | `tickets/table-toolbar.ts:172-194,276-279` |
| Saved views popover | Apply, star = default, delete (two-step confirm), "save current" with a name (maximum 60 characters, 20 views). Errors: name taken, views full. | Server views plus `default_view` pref | Private to the user. | `tickets/table-toolbar.ts:123-168,196-218`, `tt:187-199` |
| Default view | Applied on table open. It writes `status/dept/q` back to the list via the `table-filters` event. | Server | n/a | `tt:183-202,304-310`, `tl:472` |
| Table's own filters popover | Priority (urgent, high, normal, low), assignee (any, none, me, plus holders of loaded rows), waiting-for-manager, stuck, cost status (cost viewers only), created from/to. The button shows a count. Clear is disabled when empty. | No (component state) | Cost filter needs `tickets.costs.view`. | `tickets/table-model.ts:37-40,170-172`, `tickets/table-toolbar.ts:242-269,285` |
| Density | Toggle comfortable / compact. | Server `tickets.board.density` | n/a | `tickets/table-toolbar.ts:288-289` |
| Page size | Not exposed in the UI. | Server `tickets.board.limit` | n/a | see §0.4 |
| Count | "N", "1", or "N+" when more pages exist. | n/a | n/a | `tickets/table-toolbar.ts:291` |
| CSV export | Button "CSV". It sends current filters, sort, columns and language. Errors `export_too_large` and `export_rate` get their own text. | n/a | `meta.can.manage` | `tickets/table-toolbar.ts:296`, `tt:336-348` |
| Monthly report (CSV) | Popover with from/to dates (required, ordered, at most 366 days) and group by department or vendor. | n/a | `meta.can.manage` | `tickets/table-toolbar.ts:221-240,292-295`, `tickets/table-model.ts:150-168` |
| Row open | Click (not on buttons, inputs, labels, links or menus) or Enter on a focused row writes `hrefOf(id)`. | n/a | n/a | `tt:360-368,417-419` |
| Inline status cell | A button opens a menu of the moves the server allows (`transitions`), with the "waiting for part" sub-state hidden. A move with `note_required` opens a note dialog. A 409 `ticket_stale` re-reads the row. | n/a | Only if the row has `transitions`. | `tt:564-568,477-498,464-471`, `tickets/model.ts:111-113` |
| Inline handler cell | A button opens a radio menu of eligible handlers (`ticketsApi().assignees(dept, id)`). Account holders and staff contacts are one list. | n/a | Only if `r.can.assign`. | `tt:569-577,446-455,500-504,630-634` |
| Cell menus | Opaque top-layer popovers placed at the trigger. Esc closes and refocuses. Tab closes. | n/a | n/a | `tt:155-175,620-635` |
| Multi-select | Header checkbox selects the page, tri-state. Row checkbox, with Shift for ranges. | In-state, kept across polls for rows still present | `canSelect = !phone && meta.can.manage` | `tt:356-358,370-374`, `tickets/table-model.ts:214-243` |
| Keyboard | Arrow Up/Down, Home, End, PageUp/PageDown (±10) move row focus. Enter opens. Space toggles selection (Shift+Space does a range). Ctrl/Cmd+A selects the page. Esc closes a menu or clears the selection. `/` focuses the search box. A visually hidden help text names these keys. | n/a | Select keys need `canSelect()`. | `tt:381-426,652`, `tickets/table-model.ts:246-258` |
| Bulk bar (sticky bottom) | "N selected", then assign, remind, change priority, close (note required), delete, clear. One request to `POST tickets/bulk` carrying each row's revision. The answer is per ticket: "done X of Y" plus counts of non-ok results. Failed rows stay selected. | n/a | Delete only with `canAnywhere('tickets.delete')`. | `tickets/table-bulk.ts:148-159,63-65,88-108`, `tickets/table-model.ts:300-309`, `tt:512-522` |
| Bulk delete | `<tickets-delete-dialog>` with the number of targets (maximum 50). A single deleted row emits `ticket-deleted`. | n/a | `tickets.delete`, plus manager rights where the ticket lies | `tickets/table-bulk.ts:129-135`, `tickets/delete-model.ts:6-19`, `tt:506-510` |
| Phone (below 768 px) | A compact list of links: title, status chip, sentence, number plus assignee, age. No selection, no column chooser, no cell menus. | n/a | n/a | `tt:657-668,99-102` |
| Skeleton, error, empty | 8 skeleton rows (4 on phone). Error with a retry. Empty says "no match" with a clear-extra button only when the table's own filters are active. | n/a | n/a | `tt:670-689` |
| Polling | 20 s via `LiveRefresh`; the header comment says 30 s. | n/a | n/a | `tt:54-55,103,254-259` |
| Toast | 4 s (ok) or 8 s (bad). | n/a | n/a | `tt:261-265` |

---

## 3. Calendar mode: `tickets/calendar-view.ts`, `calendar-model.ts`, `calendar-mode.ts` (inside the list)

| Capability | Behaviour | Remembered? | Gate | file:line |
|---|---|---|---|---|
| Week view (Sunday first) | 7 day columns. Events are the visit time (`eta_at`, while not closed or cancelled) and the SLA targets: ack, stuck, resolve (while not done). Default zone `Asia/Jerusalem` (the `tz` property). | none | n/a | `tickets/calendar-model.ts:11-15,141-162`, `tickets/calendar-view.ts:549-556` |
| Phone view | One day at a time: a 7-button day strip, a day box, and a horizontal swipe of at least 48 px (RTL-aware). | none | n/a | `tickets/calendar-view.ts:558-568,450-466` |
| Navigation | Prev/next week (or day on phone), "today", a range title that is `aria-live`. | none | n/a | `tickets/calendar-view.ts:531-539` |
| Keys | Inside `[data-cal-nav]`: ArrowLeft/ArrowRight (direction-aware), PageUp/PageDown, Home = today. | none | n/a | `tickets/calendar-view.ts:431-448` |
| Legend | 4 entries: visit (info), resolve (quiet), resolve under 24 h (warn), resolve crossed (bad). | none | n/a | `tickets/calendar-view.ts:507-512`, `tickets/calendar-model.ts:205-211` |
| Counts | Week count. A note for unscheduled open requests. | none | n/a | `tickets/calendar-view.ts:527,541` |
| Event card | A link to `hrefOf(id)`. Shows time, kind, "#number title", the status sentence (3-line clamp) and the elapsed clock. `aria-current` marks the open drawer item. | none | Role from `roleOf` | `tickets/calendar-view.ts:489-501` |
| Empty week | A state box, plus a "jump to nearest week with events" button when one exists. | none | n/a | `tickets/calendar-view.ts:543-544` |
| "Load more" | Fires `cal-load-more`, which loads the next list page. | none | n/a | `tickets/calendar-view.ts:545`, `tl:490` |
| Card filters | The same filter row as cards (priority, handler, flags). | none | n/a | `tl:411,484,489` |

---

## 4. Drawer and full page: `tickets/ticket-detail.ts` (`<ticket-detail>`, `mode="drawer|page"`)

### 4.1 Frame, sizes, deep links

| Capability | Behaviour | Remembered? | Gate | file:line |
|---|---|---|---|---|
| Hosts | Drawer inside list or board (`sw-drawer modal`), or the page `#/tickets/<id>`. | n/a | `ui.detail` | `td:1206-1231,1233-1256` |
| Header | Title (2-line clamp), number, place, one priority chip, size switch (or phone sheet toggle), and the "⋯" button. | n/a | n/a | `td:949-966,1214-1217` |
| Size switch | Desktop only. Three sizes: drawer 520 px, wide 640 px (default), full 100vw. The module sets the default and the viewer's own choice wins. | `localStorage` `sw.tickets.drawerSize` | `ui.drawer_size` | `tickets/drawer-model.ts:97-114`, `tickets/drawer-prefs.ts:9-25`, `td:416,962-966` |
| Phone sheet | `ui.phone_sheet`: `full` or `half`. A toggle button replaces the size switch. The half sheet shows only the status block, the "Now" rows and "show all". It hides the tabs. | Setting only, per open | `ui.phone_sheet` | `td:452,968-972,1208-1225` |
| Phone width | `100vw` or `100dvh` full; `88dvh` max in half. | n/a | n/a | `td:1209-1211` |
| Page extras | Back link to `listHref(scope)`. "To drawer" link when `ui.detail == 'drawer_fullscreen'`. | n/a | n/a | `td:1239-1243` |
| Page scope | The back link uses `lastScope()`. The board passes `'department'`. | in-memory | n/a | `td:100`, `tb:618`, `screens/tickets-detail.ts:62` |
| Close | Esc and the backdrop close the drawer (`sw-drawer` captures Esc at the document). An open "⋯" menu or confirmation keeps Esc for itself (`data-nested-open`). | n/a | n/a | `components/sw-drawer.ts:45-53,325-341`, `td:1214-1215` |
| Initial tab | Priority: `?tab=` > `?view=timeline` > `ui.detail_tab` > Overview. | Setting only | n/a | `tickets/drawer-model.ts:34-36`, `td:451,457-459` |
| States | Skeleton (header plus status block plus 3 rows); `gone` (404): "not found"; `failed`: message plus retry. | n/a | n/a | `td:1199-1204,476-480` |
| Flash message | Sticky banner, 3.5 s (ok) or 7 s (bad). A 409 or 404 triggers a reload. | n/a | n/a | `td:483-518,1040-1043` |

### 4.2 Status block, actions, "⋯" menu

| Capability | Behaviour | Gate | file:line |
|---|---|---|---|
| Status block | Handler avatar, one status chip with sub-label, one polite-live sentence, SLA badge only when near or crossed, one ranked warning line, a read-only 6-step flow (hidden for cancelled and returned), and the action area. | `viewerRole(t)` | `tickets/status-block.ts:42-65` |
| Primary action | Exactly one. An approval outranks everything. Otherwise handler: acknowledge, start, done, or back from waiting. Manager: close a done request, assign a new one, reassign a returned one, reopen (quiet), or the soft "update to {name}" / "resend link" push. Requester: none. | Server `transitions` and `can.assign`, `cost.can_decide` | `tickets/drawer-model.ts:166-194` |
| Quiet action | At most one. The handler's "mark waiting for part". | role == handler | `tickets/drawer-model.ts:197-203` |
| "⋯" menu | Top-layer popover. Order: update, waiting toggle, "change state" moves, assign/reassign, return, set ETA, edit, full page, cancel (danger), reopen, delete (danger). A requester sees only edit and full page. | `can.assign`, `can.return`, `can.eta`, `can.edit_fields`, `can.delete`, `transitions`, `ui.detail == drawer_fullscreen` | `tickets/drawer-model.ts:209-242`, `td:975-993` |
| Menu keys | Esc closes and refocuses; Tab closes; arrows/Home/End. | n/a | `td:631-643` |
| Dialogs | **move**: close, cancel or reopen, with a note (required for cancel, close with required note, and `note_required` moves); a duplicate-of number for cancel; a cost-gate override with a reason when `can_override`. **assign**: see 4.5. **return**: radio "cannot handle / not mine", plus a required reason. **eta**: `datetime-local`, save or clear. **edit**: a field is enabled only if in `can.edit_fields`; department, category, priority, location picker. **owner**: pick a person or "no one", with a reason. | per `can.*` | `td:1100-1190,697-879,725-771` |
| Delete | `<tickets-delete-dialog>`: type the ticket number, a required reason (maximum 300), one request. Rendered only if `t.can.delete`. After deletion the drawer closes and emits `ticket-gone {deleted}`; the page navigates to the list. A second delete of an id already deleted this session counts as success. | `tickets.delete` plus manager rights | `td:920-934`, `tickets/delete-dialog.ts:19-60`, `tickets/delete-model.ts:6-19` |

### 4.3 Tabs

- **Order and default.** The tab list is `overview, conv, costs, history` (`tickets/drawer-model.ts:19-20`). The default is `overview`, overridden by `ui.detail_tab` or `?tab=`.
- **Rendering.** It is an ARIA tablist with a roving tabindex. ArrowLeft/ArrowRight follow reading direction, plus Home/End (`tickets/drawer-tabs.ts:19-34`, `tickets/drawer-model.ts:83-93`).
- **One scroll container per tab.** Only the active tab is rendered (`td:1064-1079`).
- **No tab is hidden by permission.** `tabItems()` always returns all four tabs (`tickets/drawer-model.ts:66-80`). Gating happens inside the tab content.
- **Tab switch scroll.** Switching to `conv` scrolls to the bottom; the other tabs go to the top (`td:578-585`).

| Tab | Capability | Gate / variation | file:line |
|---|---|---|---|
| Overview | **People**: handler card (name, kind, since, channel, link line, "reassign"), internal owner line with "change/set" for a manager of an open request, requester line. A limited viewer or an older server shows no owner line. | Reassign needs `can.assign` and an assignee. Owner change needs `canChangeOwner`. | `tickets/overview-tab.ts:78-115` |
| Overview | **Link panel** (managers only, from the server `link` block): state chip, staff / code / locked tags, opened count, copy link, copy whole text, "send again", "new link" (confirm), "revoke" (confirm). | `l.can.copy/new/revoke/resend` | `tickets/link-panel.ts:118-150` |
| Overview | **Code-lock card** (when a verification code lock is active): "send new link". | `card.show`, `card.canNew` | `tickets/code-lock.ts:25-40` |
| Overview | **Now** (up to 4 rows, empty ones hidden): ETA, last message (→ conversation tab), cost line (→ costs tab, with amount if `can_view`), SLA target while far. | n/a | `tickets/overview-tab.ts:117-139` |
| Overview | **Facts**: location (+ "show on map" if `plan_area` is sent), place, device, department · category, priority, opened, RFQ origin (with siblings and vendor files), duplicate-of link, close note, folded description (more/less). "Edit" button. | Edit needs `can.edit_fields.length`. Vendor files only with `tickets.costs.view`. | `tickets/overview-tab.ts:141-200` |
| Overview | **Photos**: one row, then "+N" to expand in place. Add (file input; JPEG/PNG), per-photo remove, internal tag once a vendor was ever assigned. | `can.attach`, `a.can_delete` | `td:996-1015` |
| Overview | **Live camera tile**: opt-in. Needs `ui.camera_viewfinder`, `can.attach`, a secure context, and `getUserMedia`. Dialog with shoot, retake, use, cancel; Esc stops the stream; the file input is the fallback. | `ui.camera_viewfinder` | `td:1019-1038`, `tickets/camera-viewfinder.ts:11-25,244-246`, `tickets/camera-viewfinder-model.ts:19-20` |
| Overview | **Device history** fold (frozen 24 h history, counts only). | `device_context` present | `tickets/overview-tab.ts:187-200`, `td:1059` |
| Overview | **Map element** (`<ticket-map-element>`): own load, picker and vendor preview. | n/a (UNKNOWN in detail: `tickets/map-element.ts` not read) | `td:1076-1077` |
| Conversation | **Sub-tabs** "with vendor" / "team" (aria-pressed toggle). Present only once an outside contact was ever assigned (`marksInternal`). Otherwise a single "notes" feed. Unread badge on the vendor sub-tab. | `marksInternal(t)` | `tickets/conversation-tab.ts:165-203,205-218` |
| Conversation | **Composers**: one at a time. Team composer is `can.note`, internal, with an optional photo (`can.attach`). Vendor composer needs `canWriteVendor` (`can.vendor_message`, else `note_external` plus a contact assignee, and never on closed or cancelled) and an optional photo (`can.attach_external`). | as listed | `tickets/conversation-tab.ts:293-326`, `tickets/conversation-tab.ts:48-55` |
| Conversation | **Keys**: team sends on Enter (Shift+Enter = new line). Vendor sends only on Ctrl/Cmd+Enter. IME composing is ignored. Maximum 2000 characters. | n/a | `tickets/conversation-model.ts:250-254`, `tickets/conversation-tab.ts:150-154,307-309` |
| Conversation | **Forward**: "send to vendor" on an internal note pre-fills the vendor composer; a "clear draft" button. | `canForward` | `tickets/conversation-tab.ts:121-125,229-247` |
| Conversation | **Feed window**: the last 20 items; "earlier messages" expands in place. Day separators. "Show more" for bodies over 420 characters or 8 lines. | n/a | `tickets/conversation-model.ts:258-264`, `tickets/conversation-tab.ts:44,229-247` |
| Conversation | **Outbox delivery rows**: purpose, plain-words delivery line, "send now", "resend". "Send update" appears when `external_stale` and `link.can.resend`. | `m.can.send_now`, `m.can.resend` | `tickets/conversation-tab.ts:278-291,181-190` |
| Conversation | Cost-event rows link to the costs tab. | n/a | `tickets/conversation-tab.ts:262-269` |
| Costs | Empty text if the ticket has no `cost` block. Loading, error with retry, and "staff" state (no money surface for staff contacts). Stage chip, vendor quote card (approve, partial approval with a line picker, ask for correction, reject), approved baseline, payment-demand card (embedded), instalment demands, a fold for the kinds a vendor may charge, a fold for what the vendor must send, and a manager "enter quote on behalf". After a decision, a "send message to vendor?" dialog (default is not sending). A quote past its validity needs an extra confirmation checkbox. | Amounts need `tickets.costs.view`. Actions follow server `quoteActions` / `can_decide`. | `tickets/costs-tab.ts:594-638,405-414,230` |
| History | **Filter chips** all / messages / notes / status / costs, with counts. A chip is disabled when its count is 0. The window is the newest 60 rows with "show all". | n/a | `tickets/history-tab.ts:13,51-74`, `tickets/conversation-model.ts:118-124` |
| History | **Files** list: link to each photo with time, mine, internal or vendor-visible. **Audit** card: link audit rows plus the link panel. | audit visible to managers (link data is manager-only) | `tickets/history-tab.ts:90-114` |

### 4.4 Badges and counters

| Badge | Rule | file:line |
|---|---|---|
| Conversation tab badge | Replies after the viewer's last action: `inbound`, `late_reply`, or a `note` by a `contact` actor. | `tickets/drawer-model.ts:45-50` |
| Costs tab badge | 1 when a submitted payment demand and `can_decide`. | `tickets/drawer-model.ts:53-55` |
| Overview, History | No badge. | `tickets/drawer-model.ts:75,78` |

### 4.5 Inline assign flows

| Flow | Behaviour | Gate | file:line |
|---|---|---|---|
| Assign dialog (in the drawer) | A kind selector of three groups: with an account, employees without an account, vendors and contacts. The first two are one picker over the `handlers` list (key `h:<key>`). The third is run by `ExternalAssign`: contact search with vendor/contact headings, "require code" (raise only), "share device history" (only if available), the exact outgoing text preview, refusals by code, "send now vs hours" choice, cost-claim mode, navigation-link switch, access-needed switch. A group that cannot be used shows a reason with a link to the setting. | `tickets.external` where the ticket lies (`can.assign_external` or `external` from the answer), plus the handler page being set up | `td:1123-1146,773-795`, `tickets/external-assign.ts:143-147,218-227,238-280,299-325` |
| Internal note and handler message | An internal note travels with the assignment (never external). A separate optional handler message is sent after it. A failed message never undoes the assignment. | n/a | `td:773-817` |
| Create-sheet assign | A radio list: "assign later" (default), then groups account / staff / vendor, with a search box once there are more than 6 entries. A vendor is never assigned by create. The request is created unassigned and the drawer opens with `?assign=contact:<id>`. | Handler picker only if the chosen department has `can_manage`. Vendor group needs `tickets.external` plus a ready handler page, otherwise it is shown disabled with a reason. | `tickets/ticket-create.ts:364-393,299-302`, `tickets/create-assign-model.ts:1-50` |

### 4.6 Create form (`tickets/ticket-create.ts`)

| Capability | Behaviour | file:line |
|---|---|---|
| Fields in order | Device block (if opened from a device), map-element line (if opened from the map), department, category, opening template (if the department has templates), title (required, 120 characters), "similar tickets" hint, priority chips, description (4000 characters), location picker, photos (up to 10, JPEG/PNG; uploaded after creation), handler picker. | `tickets/ticket-create.ts:324-361` |
| Departments offered | Only `can_create` departments. None gives a "no department" state. | `tickets/ticket-create.ts:141-143,322` |
| Duplicate hint | After 4 or more title characters, debounced 350 ms, it searches `list({scope:'visible',status:'open',q,limit:3})`. | `tickets/ticket-create.ts:212-224` |
| Idempotency | Carries a `client_request_id`. A result of `absorbed` is possible. | `tickets/ticket-create.ts:77,276-278` |
| Location picker | Select of active organisation locations, "no location", or "other (free text)" (maximum 200 characters). With no locations the picker is the old free-text field. | `tickets/location-picker.ts:19-30`, `tickets/org-locations-model.ts:12-14,45-48` |
| Entry points | `?new=1` on list and board; the device window (`components/device-activity.ts`); the map (`tickets/map-create.ts`, offered when the module is on and `tickets.create` is held). | `tickets/map-create.ts:15-33` |
| Submit | Disabled while busy or when there are no creatable departments. | `tickets/ticket-create.ts:395-401` |

---

## 5. Manager board `#/tickets/board`: `screens/tickets-board.ts` (+ `board-model.ts`, `board-tree.ts`, `board-today.ts`, `board-settings.ts`)

| Capability | Behaviour | Remembered? | Gate | file:line |
|---|---|---|---|---|
| Access | Tab needs `tickets.manage` client-side. The server also needs a manager membership or all-departments. A non-manager gets a 403 and `forbidden` ("not a manager"). | n/a | `tickets.manage` | `nav.ts:1081`, `tb:340-345,581-582` |
| Pane switch (cards / handlers) | A segment in the title row, shown only when `meta.can.manage`. | URL `?pane=handlers` | `meta.can.manage` | `tb:463-466` |
| Handlers pane | Embeds `<tickets-handlers embedded>`. The filter bar is hidden while it is active. | URL | n/a | `tb:588`, `tickets/board-model.ts:46` |
| Department chips | Shown when more than one department. Counts per department. | URL `?dept=` | n/a | `tb:474-477` |
| State strip | all, waiting for me, stuck, unassigned; then "closed this week" or "closed (all)" or nothing, by `ui.closed_strip` (`week` / `all` / `hidden`). Tooltip shows the oldest open age for that state. | URL `?state=` | Setting `closed_strip` | `tb:478-480,293-299`, `tickets/board-model.ts:80-90` |
| Handler filter chip | A removable chip when `?assignee=` is set; the overview's load rows link here. | URL `?assignee=` | n/a | `tb:481` |
| Floors | Layout from `ui.board_floors`: `tree` (side tree, user can hide), `chips`, or `chips_tree` (chips plus a tree panel behind the tree filter button). On phone, always chips. | Server `tickets.board.tree_hidden` | Setting `board_floors` | `tickets/board-model.ts:98-104`, `tb:454-471,483,600-603` |
| Tree | `role=tree`: "all floors" plus nested nodes with per-floor collapse and open counts. | collapse in state | n/a | `tickets/board-tree.ts:76-120` |
| Text search | Same 300 ms debounce and `replaceRoute`. | URL `?q=` | n/a | `tb:400-405,484` |
| Card filter row | Same component as the list. Applied to `[...items, ...closed]`. | No | n/a | `tb:485,489`, `tickets/list-filter-row.ts` |
| View switch | `listViewSwitch('board', true, pickMode)`: the board entry is always shown here. Cards or table go back to the list and save `tickets.board.view`. Calendar sets the session flag and goes to the list. | Server (view), session (calendar) | n/a | `tb:300-309,487` |
| Create | `?new=1` button, if `meta.can.create`. | URL | n/a | `tb:486` |
| "Today" row | Up to 2 timed visits (ETAs today, assigned), the next SLA target of today, and what waits for the manager. Buttons open the ticket. Board only. | n/a | n/a | `tb:531-540`, `tickets/board-today.ts:23-40` |
| Stuck banner | A banner with a "go" button to `state=stuck`. Hidden when already on `stuck`. | n/a | n/a | `tb:594-596` |
| Grouping | `ui.grouping`: `always`, `no_status_filter` (default; only when the state is `all`), `never`. Never for `closed`. Sections: waiting for me, stuck, handling (grouped by assignee when more than one). | Setting | n/a | `tickets/board-model.ts:67-71`, `tb:547-569` |
| Handler group header | Avatar, name, count, oldest age, 4-segment load meter (red at full load). | n/a | n/a | `tb:514-529`, `tickets/board-today.ts:57-62` |
| Closed section | Only when state is `all`, `closed_strip != hidden`, and closed rows exist. A toggle shows quiet link rows (number, title, assignee, when). | component state | n/a | `tb:560-568,542-545` |
| Board card | `<ticket-card .board>`: the one ranked warning line replaces the chips. Same "⋯" menu and actions as the list. | n/a | n/a | `tb:497-503`, `tickets/list-card-model.ts:98-122` |
| Drawer and create | As the list, with `scope='department'`. Opens `?t=`. Supports `?tab=`, `?view=timeline`, `?assign=`. | URL | n/a | `tb:618-633` |
| Truncation | A note when the server truncates the result. | n/a | n/a | `tb:606` |
| Polling | 20 s via `LiveRefresh`, quiet. A failure on a quiet load keeps the last data. | n/a | n/a | `tb:91,361-385` |
| States | loading (6 skeleton board cards, 3 on phone); off; forbidden ("not a manager"); error with retry; empty ("empty board"); no match (state-specific text) with a clear button; no match of the card filters with a clear button. | n/a | n/a | `tb:572-586,547-559` |
| Board settings rows (not on this screen) | In Settings > display: floors layout, grouping, closed strip, handled days (1/7/30). | server settings | `system.configure` (UNKNOWN: exact permission checked inside `screens/system-tickets.ts`) | `tickets/board-settings.ts:58-65` |
| Keyboard | Only the tree (Enter/Space on a row), the card menu, and the drawer. The board itself has none. | n/a | n/a | `tickets/board-tree.ts` |

---

## 6. Manager overview `#/tickets/overview`: `screens/tickets-overview.ts` (+ `overview-model.ts`, `overview-settings.ts`)

| Capability | Behaviour | Remembered? | Gate | file:line |
|---|---|---|---|---|
| Access | Tab needs `tickets.manage`. Built on existing routes only. The server's visibility rule decides every row. 403 gives `forbidden` ("not a manager"). | n/a | `tickets.manage` | `nav.ts:1080`, `to:405-409` |
| Department chips | Shown when more than one department. "all" label differs for `all_departments`. Selecting uses `replaceRoute`. | URL `?dept=` | n/a | `to:586-598,636-639` |
| "Updated" stamp, link to board | Timestamp; the board link keeps the department. Hidden on phone. | n/a | n/a | `to:640-642` |
| Offline state | When no answer at all: the last numbers stay greyed with their time. A 5xx on a quiet refresh keeps the data. | n/a | n/a | `to:430-440,633` |
| Numbers row (KPI tiles) | Open, stuck, waiting for me (link to board), overdue (reveals the overdue card), and waiting for my approval (only if the summary or approval count is available). Yesterday deltas. | Deltas in `localStorage` | The approval tile needs `tickets.costs.view` (or the summary route). | `to:647-667,564-577` |
| Cards (widget grid) | stuck-where, who-waits, handler load, overdue, approvals, payments, RFQs, upcoming agenda, throughput (with a period segment), opened-vs-closed daily chart, department comparison. | Fold state in `localStorage` | Department comparison only when `all_departments` and more than one department. Payments card needs `tickets.costs.view` and `tickets.costs`. Placement of the comparison: `ui.dash_compare` top / below_numbers / bottom. | `to:1007-1035`, `to:481-483` |
| Fold / unfold | Chevron per card. On phone, throughput, daily and departments start folded unless the viewer chose otherwise. | `localStorage` `sw.tickets.overview.folded` | n/a | `to:578-585,610-617`, `tickets/overview-model.ts:589-605` |
| Stuck-where | Reason chips with counts, and a per-place tree (each row links to the board with `state=stuck&place=`). | `reason` in state | n/a | `to:675-698` |
| Handler load | Rows link to the board filtered to that handler. A "busy" tag when over the threshold (default `dash_busy` 8, per department override), "handled" counts. Vendors are tagged, separate or hidden by `dash_vendors`. | Period in `localStorage` | Settings `dash_vendors`, `dash_busy`, `dash_busy_departments` | `to:700-737`, `tickets/overview-model.ts:36-39,72-88` |
| Overdue | Shows 6 rows with "show all". Mixes board rows, RFQ rows and instalment rows. | state | n/a | `to:760-777`, `tickets/overview-model.ts:352` |
| Approvals | Shows 5 per group. Rows link to the ticket with `&tab=costs`, or to the RFQ. | state | `tickets.costs.view` | `to:874-899`, `tickets/overview-model.ts:552` |
| Agenda | 14 days. Entry kinds: vendor visit, staff visit, work start, RFQ due, payment. | n/a | n/a | `to:778-800`, `tickets/overview-model.ts:406-407` |
| Throughput period | A segment today / 7d / 30d. Also reloads the handler cards' handled counts. | `localStorage` | n/a | `to:550-557,824-828` |
| Departments table | Table plus mobile cards. A row links to the same overview filtered to that department. | n/a | n/a | `to:956-980` |
| Partial / unavailable states | Per-card "not available" with retry (summary, payments, RFQ part). | n/a | n/a | `to:802,902,789` |
| Empty | "empty all" box with a "new" link to `listHref('mine', NO_FILTERS, {create:true})` when `meta.can.create`. | n/a | n/a | `to:1005-1007` |
| Loading | Skeleton grid and a 5-tile skeleton KPI row. | n/a | n/a | `to:986-989,647-648` |
| Other states | module off, error with retry. | n/a | n/a | `to:393-409,999-1001` |
| Polling | Main refresh every 60 s via `LiveRefresh`. The slow part every 10 min, and when the department changes. A notification push triggers a re-read (5 s throttle). | n/a | n/a | `to:40-43,117,325-356,412-443` |
| Overview settings rows (not on this screen) | In Settings > display: handler numbers, vendors, busy threshold (global and per department), comparison placement, morning-summary hour, department-stuck threshold. | server settings | UNKNOWN: exact permission checked inside `screens/system-tickets.ts` | `tickets/overview-settings.ts:99-125` |
| Keyboard | None found beyond native link, button and chip behaviour. | n/a | n/a | n/a |

---

## 7. Test coverage

Spec file names with first-line intent (Hebrew shown only where short):

**Per screen**

| Area | Specs |
|---|---|
| List (cards, filters, counts, model) | `evidence-tickets.spec.ts` (slice 1, desktop/phone, light/dark), `evidence-tickets-ui4.spec.ts` (TKUI4, list in three modes), `layout-tickets.spec.ts` (slice 1 layout guard), `unit-tickets-model.spec.ts` (routes, filters, presentation), `unit-tickets-list.spec.ts` (TKUI4 pure logic), `unit-tickets-live-refresh.spec.ts`, `unit-tickets-elapsed.spec.ts`, `unit-tickets-status-sentence.spec.ts`, `unit-tickets-overlay-menu.spec.ts` |
| Table | `evidence-tickets-table.spec.ts`, `layout-tickets-table.spec.ts`, `unit-tickets-table.spec.ts` |
| Calendar | `evidence-tickets-calendar.spec.ts`, `layout-tickets-calendar.spec.ts`, `unit-tickets-calendar.spec.ts` |
| Drawer and page | `evidence-tickets-drawer.spec.ts` (TKUI1), `layout-tickets-drawer.spec.ts` (exactly one scroller per tab), `unit-tickets-drawer-model.spec.ts` |
| Conversation / History | `evidence-tickets-conversation.spec.ts`, `layout-tickets-conversation.spec.ts`, `unit-tickets-conversation.spec.ts`, `layout-tickets-tabs.spec.ts` (TKUI7: conversation, history and costs tabs) |
| Costs tab | `evidence-tickets-costs.spec.ts`, `unit-tickets-costs.spec.ts`, `unit-tickets-quotes.spec.ts`, `unit-tickets-3b.spec.ts`, `evidence-tickets-3b.spec.ts` |
| Create and assign | `evidence-tickets-create-assign.spec.ts`, `unit-tickets-create-assign.spec.ts`, `unit-tickets-assign-message.spec.ts`, `unit-tickets-assign-nav.spec.ts`, `unit-tickets-assignees.spec.ts`, `unit-tickets-org-locations.spec.ts`, `unit-tickets-location-change.spec.ts`, `evidence-tickets-s4.spec.ts`, `layout-tickets-s4.spec.ts`, `evidence-tickets-s5b.spec.ts` (link panel) |
| Delete | `evidence-tickets-delete.spec.ts`, `layout-tickets-delete.spec.ts`, `unit-tickets-delete.spec.ts` |
| Code lock | `unit-tickets-code-gate.spec.ts` |
| Device / map entry | `evidence-tickets-device.spec.ts`, `unit-tickets-device.spec.ts`, `evidence-tickets-map-internal.spec.ts`, `evidence-tickets-map.spec.ts`, `layout-tickets-map.spec.ts`, `unit-tickets-map.spec.ts` |
| Board | `evidence-tickets-board.spec.ts`, `layout-tickets-board.spec.ts`, `unit-tickets-board.spec.ts` |
| Overview | `evidence-tickets-overview.spec.ts` (+ `-p3`, `-p4`, `-p5`), `unit-tickets-overview.spec.ts` (+ `-p3`, `-p4`, `-p5`) |
| Module-off gating | `unit-tickets-gate-295.spec.ts` (while the module is off no "open a service request" entry renders anywhere) |
| Generic UX audits | `uxrest-audit.spec.ts`, `uxrest-focus.spec.ts`, `uxrest-states.spec.ts` (exploratory drivers, no assertions I could confirm), `layout-page-background.spec.ts` |

I did not read assertion bodies for most of these, so line-level coverage claims below are limited to the greps I ran.

**Specs that pin the exact tab list or route list**

| Spec : line | What it pins |
|---|---|
| `tests/unit-tickets-board.spec.ts:123-124` | `TICKETS_TABS.map(id)` equals exactly `['overview','mine','department','board','all','handlers','rfqs','accounts','external']` (9 entries). The board label is `'לוח מנהל'`. |
| `tests/unit-tickets-handlers.spec.ts:25-29,33-34,53-54,63` | `TICKETS_TABS[5]` is `handlers` (a positional pin), with its href, label and `TAB_PERMISSIONS` `['tickets.configure','tickets.manage']`. `handlersHref()` gives `'#/tickets/handlers'` and `handlersHref('vendors')` gives `'#/tickets/handlers?seg=vendors'`. Readiness blocks link to those hrefs. |
| `tests/unit-tickets-overview.spec.ts:267-272` | `TICKETS_TABS[0]` is overview, with its href and label `'סקירה'`. `TAB_PERMISSIONS[overview]` equals `['tickets.manage']`. `tabAllowed` is checked for `tickets.view` (false) and `tickets.manage` (true). |
| `tests/unit-tickets-rfq.spec.ts:265-269` | The rfqs tab and its href. `TICKETS_TABS.at(-2)` is `accounts`, so the external tab must stay last. RFQ permissions equal `['tickets.external','tickets.costs']`. |
| `tests/unit-tickets-vendor-accounts.spec.ts:104` | After filtering out `external`, the last tab is `accounts`. |
| `tests/unit-tickets-naming.spec.ts:109,123-124` | The visible tab labels, for a user holding everything, equal exactly 8 labels: `['סקירה','שלי','המחלקה','לוח מנהל','הכול','מטפלים וספקים','בקשות הצעת מחיר','חשבון ספקים']`. With only `tickets.view` the visible ids are `['mine','department']`. With only `tickets.create` they are `['mine']`. |
| `tests/unit-tabset-registry.spec.ts:68,74,76,89,138-146` | Section id `tickets`. The registry's tickets list equals `TICKETS_TABS` minus `external`, but `TAB_SECTIONS` for tickets contains `external`. `visibleTabs` equals that same list. The `ui.tabs` order and hidden override (`['all','mine']` first, `department` hidden). |
| `tests/unit-rfq-questions.spec.ts:104` | Finds the `rfqs` tab and checks its badge. |
| `tests/layout-page-background.spec.ts:30` | A hard-coded route list including `#/tickets/accounts\|all\|board\|department\|handlers\|mine\|overview\|rfqs`. |
| `tests/uxrest-audit.spec.ts:7`, `tests/uxrest-focus.spec.ts:6`, `tests/uxrest-states.spec.ts:8` | Route lists include `/tickets/mine`, `/tickets/board` (and `/tickets/rfqs` in the audit). They are drivers of exploration, not asserts on the tab list. |
| `tests/evidence-tickets-handlers.spec.ts:165,242,252,254` | `href` equals `'#/tickets/handlers'` and `'#/tickets/handlers?seg=vendors'` on the data hooks. |
| `tests/unit-tickets-assignees.spec.ts:56` | `staffBlock` yields href `'#/tickets/handlers'`. |

**Specs that pin the drawer tab list**

- `tests/unit-tickets-drawer-model.spec.ts:42`: `DRAWER_TABS` equals `['overview','conv','costs','history']`. Also `tabKey`/`tabItems` names and badges at `:58-72`.
- `tests/layout-tickets-drawer.spec.ts:11,120-137`: the same 4 tabs, count of 4, default selected is `overview`, exactly one tab with `tabindex=0`, and arrow-key traversal.

**Other pins**

- **View modes.** `tests/unit-tickets-list.spec.ts:230-233` and `tests/unit-tickets-calendar.spec.ts:171-173` pin `visibleModes(false)` as `['cards','table','calendar']` and `visibleModes(true)` as `['cards','table','board','calendar']`. `tests/evidence-tickets-ui4.spec.ts:150` counts 4 `[data-view]` buttons.
- **Table columns.** `tests/unit-tickets-table.spec.ts:26` pins `COLUMN_KEYS` to the 12 base keys.
- **Query-parameter deep links.** 18 ticket specs reference `?new=1`, `?assign=`, `?tab=`, `?status=`, `?dept=` and similar. The heaviest are `evidence-tickets-drawer.spec.ts` (5 hits), `unit-tickets-model.spec.ts` (5) and `unit-tickets-board.spec.ts` (4). I did not read them, so I do not know which parameter combinations are asserted, for example `?pane=handlers` or `?assignee=`.

**Coverage gaps I could see by file name only (UNKNOWN until the specs are read)**
- No spec named for the inbound-queue chip, my-numbers, the camera viewfinder or the work-calendar card. `unit-tickets-work-calendar.spec.ts` covers the card's pure logic only.
- No Playwright spec named for the table CSV and monthly-report download.

# Appendix B - handlers and vendors, RFQ, vendors account, external access (sweep 2)

Everything below is from reading the worktree at `c37c75c91`; nothing was edited. Paths are relative to `frontend/src/` unless they start with `tests/`. "UNKNOWN" marks what the frontend source alone can't settle.

## 0. Cross-cutting

### 0.1 Tab entries, permissions and routing

| Item | Detail | file:line |
|---|---|---|
| Tickets tabs | `handlers` (`#/tickets/handlers`), `rfqs` (`#/tickets/rfqs`), `accounts` (`#/tickets/accounts`), `external` (`#/tickets/external`). `handlers` is index 5; `external` comes last. | `shell/nav.ts:708-722` |
| Tab permission, handlers | `tickets.configure` or `tickets.manage` | `shell/nav.ts:1083` |
| Tab permission, rfqs | `tickets.external` or `tickets.costs` | `shell/nav.ts:1086` |
| Tab permission, accounts | `tickets.costs.view` | `shell/nav.ts:1084` |
| Tab permission, external (both hrefs) | `access.external.grant` at any scope. The wiskey href is explicitly exempt from the installation-only rule. | `shell/nav.ts:1090-1091`, `:1157` |
| External tab placement | Setting `access.external.placement` = `access` / `tickets` / `both`. The tickets tab is filtered out when the value is `access`, and the wiskey tab is dropped when it is `tickets`. A system admin changes it on the screen itself and the tab moves at once. | `shell/nav.ts:42-61`, `:166`, `:1163`, `:1424`; `screens/access-external.ts:967` |
| Tab-section visibility | The tickets section is available only while `ticketsModuleOn()`. A stored `ui.tabs` (order/hidden) reshapes the tabs. | `shell/nav.ts:1424`, `:1166-1170` |
| Active-tab mapping | `s[1]` in overview, department, all, board, handlers, accounts, rfqs, external. | `shell/nav.ts:921` |
| Routes | `#/tickets/handlers` → `<tickets-handlers>` with no route prop. `#/tickets/accounts` → `<tickets-vendor-accounts>`. `#/tickets/rfqs` → `<tickets-rfqs .route>`. `#/tickets/external` and `#/wiskey/external` → `<access-external-screen .route>`. | `shell/sw-app.ts:2419-2422`, `:2357` |
| WisKey hidden | `#/wiskey/external` is rendered after the `WISKEY_HIDDEN` check, so hiding WisKey blocks it too. `#/tickets/external` has no such guard. | `shell/sw-app.ts:2346-2357` |

### 0.2 RFQ questions badge (`tickets/rfq-questions-store.ts`)

| Aspect | Detail | file:line |
|---|---|---|
| Source | `GET tickets/rfqs/questions/summary` returns `{pending, unread, requests}`. The nav count is `navCount(summary)` = `max(0, floor(summary.pending))`. | `tickets/rfq-questions-store.ts:26`; `tickets/rfq-questions.ts:58-60`; `api/tickets-rfq.ts:537`, `:699` |
| Scope (per the file doc) | Vendor questions waiting in open requests the user manages. The server decides; the frontend does no per-user maths. | `tickets/rfq-questions-store.ts:1-7` |
| Started | By the shell when the tickets module is on. Started in the `/me`-modules branch and again in the product-settings branch. | `shell/sw-app.ts:1620`, `:1675` |
| Polling | Every 120 s, only while the tab is visible. Also re-read 2 s (debounced) after any `notifyStore` change, e.g. a new `rfq.question` notification. | `tickets/rfq-questions-store.ts:15`, `:43-48` |
| Manual refresh triggers | After a manager opens a thread (`markRead`), answers, resolves, or sends a message. | `tickets/rfq-board.ts:387`, `:628`, `:632`, `:635`; `tickets/rfq-message-dialog.ts:71-75` |
| Stop | 403, 404 or 405 stops polling and resets the count to 0. A non-`isApi()` session never starts it. | `tickets/rfq-questions-store.ts:28`, `:40`, `:52-59` |
| Where shown: tab | The RFQ tab gets `badge = n` and `alert = true`. `sw-tabs` renders `data-tab-badge="rfqs"`. | `shell/nav.ts:729-739`; `components/sw-tabs.ts:12`, `:379` |
| Where shown: area icon | `areaBadge('tickets')` returns the count while the module is on. It renders as `data-nav-badge="tickets"` on the rail/bottom bar, showing `99+` above 99, with aria label `navQuestionsAria`. | `shell/nav.ts:741-744`; `shell/sw-app.ts:2767-2771` |
| Where shown: elsewhere | The list-row badge, the board header/section/vendor badges, the compare column badge, and the "questions" KPI tile on the RFQ list. | see §2 |
| Related setting | `rfq.question_badge_all_viewers` toggle, in Settings. | `screens/system-tickets.ts:658-675` |
| Effect of that setting | UNKNOWN. The frontend only writes it. | `screens/system-tickets.ts:675` |

### 0.3 Embedded mode

`tickets-board` (the manager board) renders `<tickets-handlers embedded>` when `?pane=handlers`.
- The pane switcher is `data-board-pane`, with `data-pane="cards"|"handlers"`. It is shown only when `meta.can.manage` (`screens/tickets-board.ts:459-465`, `:588`).
- The route param is parsed in `tickets/board-model.ts:46`.
- `boardHref` keeps `pane=handlers` (`tests/unit-tickets-dept-handlers.spec.ts:56-59` asserts `#/tickets/board?dept=x&pane=handlers`).
- Embedded changes in the handlers page: no title row (`screens/tickets-handlers.ts:399`). Department chips are narrowed to `d.can_manage` (`:392`). The segment is not read from or written to the URL (`:164`, `:189`, `:200`). The root gets class `embedded` and `data-embedded` (`:397`).
- The embedded page can still show the `review` segment to a `can.configure` viewer, because `segments()` ignores `embedded` (`:233-235`).

## 1. Handlers and vendors (`#/tickets/handlers`, `screens/tickets-handlers.ts`)

### 1.1 Segments, URL and shared chrome

| Capability | Detail | Who sees it | Remembered? | file:line |
|---|---|---|---|---|
| Segments | `handlers` (default), `vendors`, `contacts`, `review`. | `review` only if `meta.can.configure` (`handlersSegments(configure)`). If a non-editor opens `?seg=review`, `seg` is reset to `handlers` once meta arrives. The URL is not rewritten. | URL `?seg=` (omitted for `handlers`) | `tickets/readiness-model.ts:12-17`; `screens/tickets-handlers.ts:181-203` |
| Segment URL writes | `setSeg` calls `replaceRoute('/tickets/handlers', {seg})`. A `hashchange` re-reads the seg. Not done when embedded. | all | URL | `screens/tickets-handlers.ts:188-203` |
| Segment pill counts | handlers = distinct active-department user members + employees. vendors, contacts = list lengths. A failed read leaves the pill bare. | all; `review` count editors only | not stored | `:206-230`, `:238-250` |
| Segment keyboard | `role=radiogroup` with roving tabindex. Arrows follow text direction (RTL: ArrowLeft is forward), Home/End jump, focus follows. | all | no | `:332-340`, `:404-405`; `tickets/settings-tabs.ts:25-34` |
| Department chips | "All" plus one chip per department. Rendered only if `depts.length > 1` and not on `review`. The embedded variant is narrowed to managed departments. | all | `dept` component state only, reset if the department disappears (`:181-184`) | `:407-410`, `:390-392` |
| Text search | `maxlength=80`, shorter placeholder on phone. Hidden on `review`. Passed to children as `.query`. The contacts list re-queries the server after a 250 ms debounce. Members are filtered client-side by name. | all | state only | `:413-414`; `tickets/contacts-directory.ts:256-259`; `tickets/handlers-members.ts:414-419` |
| "+" create button | Label `u6AddHandler`, `u6AddVendor` or `u6AddContact`. On `handlers` it toggles the add-member panel (`aria-expanded`). Otherwise it calls `startNew()` on the child. Hidden on `review`. | `canAdd = !review && (seg !== 'handlers' \|\| meta.can.configure ?? true \|\| handlerDepartments.length>0)` | n/a | `:315-325`, `:396`, `:415` |
| "+" caveat | On `vendors`/`contacts` the button is shown to anyone. `startNew` does nothing unless `canEdit \|\| mgr \|\| rows===null`. A read-only manager therefore sees a dead button. | | | `:396`; `tickets/contacts-directory.ts:264-266` |
| Employees' own "+" | A second `+ ctNew_employee` button in the "employees" section, via the `newbtn` property. | `(canEdit \|\| mgr) && (locked !== 'employee' \|\| canEditStaff \|\| mgr)` | | `tickets/contacts-directory.ts:653` |
| Notices | The `notice` event shows a green line for 3 s, or a red line until the next action. It refreshes counts and loads. | | | `screens/tickets-handlers.ts:297-309`, `:419-420` |

### 1.2 Per-segment content

| Segment | Content | Gate / viewer variation | file:line |
|---|---|---|---|
| `handlers` | `<tickets-handlers-members>` (accounts, by department) plus `<tickets-contacts kind="employee" head newbtn>` (employees without an account). | A configurer uses `GET tickets/admin/departments`. On 403/404 it falls back to manager mode (`GET dept-handlers` overview). If that also fails, the section is hidden. | `screens/tickets-handlers.ts:382-386`; `tickets/handlers-members.ts:164-192` |
| `vendors` | `<tickets-portal-requests>` card, then `<tickets-contacts kind="vendor">`. | The portal card is mounted only for `can.configure \|\| can.technician_requests`. It renders nothing when empty or on error. | `screens/tickets-handlers.ts:371-376`; `tickets/portal-requests.ts:61-67`, `:84-97` |
| `contacts` | `<tickets-contacts kind="person">` | | `screens/tickets-handlers.ts:381` |
| `review` | `<tickets-needs-review>` | Mounted only if `can.configure` (never a denied call). | `:377-380` |

### 1.3 Handled-period selector, load stats, readiness strip

| Capability | Detail | Gate | Remembered | file:line |
|---|---|---|---|---|
| Handled-period selector | A `<select data-handled-period>` with 1/7/30 days ("handled · N days"). Shown on `handlers` only and only when `loads` is non-null. | Department managers only (`managedDepartments(...).length`). Non-managers get no loads and no selector. | **localStorage** `sw.tickets.handlers.handledDays`. Without a choice it follows the server default (`r.default_days`, falling back to 7). | `screens/tickets-handlers.ts:289-295`, `:359-367`, `:272-287`; `tickets/handler-load.ts:43-73` |
| Load stats on cards | open / waiting-for-them / stuck, plus "handled" with the period label. Derived from the manager board's items (`boardApi().board({})`). A failure shows no numbers and never an error. | `seesLoad(managed, personDepartments)`: only a manager of one of the person's departments. An employee with no departments counts for any managed department. | not stored | `screens/tickets-handlers.ts:256-268`; `tickets/handler-load.ts:11-34`; `tickets/handlers-members.ts:289-298`; `tickets/contacts-directory.ts:579-604` |
| Readiness strip | `role=status` banner with a "not ready" title, a summary line and one link per missing item. Shown only if something is missing. Data comes from `GET tickets/readiness`. A failure shows nothing. | any viewer of the page | n/a | `screens/tickets-handlers.ts:343-351`, `:168` |
| Strip items (key → text → href) | `page_off`, `address`, `key` → `#/system/tickets`. `switch` → `#/system/tickets?tab=channel`. `account` → `#/system/messaging-accounts` (named only when the switch is on). | | | `tickets/readiness-model.ts:20-25`, `:53-62` |
| Not-on-strip hrefs | `permissions` href `#/system/tickets?tab=permissions` is used by `outsideBlock` for the assign dialog. `asgManage` links go to `#/tickets/handlers` or `#/tickets/handlers?seg=vendors`. | | | `tickets/readiness-model.ts:24`, `:68-93` |
| Departments link | In the members section when no departments exist: `#/system/tickets?tab=departments`. | | | `tickets/handlers-members.ts:439` |
| Polling | Both members and contacts use `LiveRefresh` (every 20 s while the tab is visible, plus on visibility and focus). Contacts re-read only while no editor or create form is open. Members skip while `busy` or hidden. The page itself has no timer. | | | `tickets/live-refresh.ts:7-37`; `tickets/contacts-directory.ts:230-232`; `tickets/handlers-members.ts:144-146` |
| Empty / error states | The page has no own loading or error screen. A contacts 403 shows `data-contacts-denied` ("no permission"). A members 403/404 for non-managers hides the section. An empty list shows `sw-state-panel` (`ctNone` when filtered, `ctEmpty_<kind>` otherwise). | | | `tickets/contacts-directory.ts:646-649`, `:768`; `tickets/handlers-members.ts:429-440` |
| Module-off | No explicit module-off state on this page. UNKNOWN beyond the tab being hidden when the module is off. | | | |

### 1.4 `tickets-contacts` (`tickets/contacts-directory.ts`): per-row capabilities

| Capability | Detail | Gate | file:line |
|---|---|---|---|
| Card (vendor/employee) | Initials tile, name, sub (phone · language, or "no account"), "personal link" chip on employees, inactive chip, stats, department chips, "created in" chip. | | `:585-613` |
| Person row | Name, vendor/company, marker chip, phone, language, three channel marks. | | `:616-624` |
| Quick channel radios (whatsapp/email/copy) | One-click `PATCH` of `preferred_channel`. | Enabled only when `canEdit` (server `can_edit` = `tickets.configure`). Otherwise displayed disabled. | `:558-577` |
| Code chip | `require_code` on/off display (vendors only). | | `:610` |
| Marker filter | Segmented radiogroup `all / permanent / temporary` (VENDMARK-295). Client-side, over rows already loaded. Not for the `employee` kind. | any viewer with a non-empty list | `:633-637`, `:544-547`; `tickets/vendor-marker.ts:10-30` |
| Marker chip | Permanent/temporary on vendors and persons. Nothing for an employee or an unknown flag. Information only. | | `:627-630`; `tickets/vendor-marker.ts:16-30` |
| Marker editor segment | `temporary \| permanent` in the editor. | Hidden for employees and in manager mode. Sent only for vendor/person. | `:733`, `:356` |
| Drawer (`sw-drawer`) | Opens on a card/row click: read-only body for viewers who can't edit, editor otherwise. Heading is the name or "new <kind>". | | `:769-780` |
| Editor, configurer | Kind switch (only when not locked), name, company, vendor (persons), phone, phone-verify toggle, email, channel, language, history sharing (default/on/off), require-code, cost defaults (cost claim, VAT exempt/default, hourly rate and currency), departments multi-chip, notes, active. | `tickets.configure` | `:698-765` |
| Hourly rate fields | Shown only if `!isApi() \|\| canAnywhere('tickets.costs.view')`. | `tickets.costs.view` | `:678-696` |
| Editor, manager mode | Subset: name, company, vendor, phone, email, channel, language, history, require-code, active. Plus the "create in department" select (if more than one), the "shared with every department" toggle (default off, not for employees), and the vendor "already listed?" exact-phone lookup with attach. Existing rows get attach/detach department chips. | `mgr` = `!canEdit && handler_departments.length>0` | `:269`, `:373-383`, `:449-534`, `:738`; `tickets/dept-handlers-model.ts:31-78` |
| Manager row edit | Only for rows with server `manager_editable`; otherwise read-only plus attach/detach. | | `:306-307`; `tickets/dept-handlers-model.ts:31-42` |
| Kinds a creator may add | Directory-only holders (`can_edit_staff===false` and not a manager) get person/vendor only; others also employee. Used when the kind is not locked (old settings tab; not reachable from the page). | | `:702`; `tickets/dept-handlers-model.ts:76-78` |
| Phone verification row | `<tickets-phone-verify>` in the editor. Hidden for managers; shown for a configurer once the full row loads. | configurer | `:721-724`; `tickets/phone-verify.ts:84-110` |
| Phone-verify states | confirmed tag; required+user-linked hint; required → send code (60 s cooldown), 6-digit input, verify; unconfirmed → "I'm sure it's his number" (needs the server token). Emits `changed`. | | `tickets/phone-verify.ts:84-110` |
| Export (JSON) | A "contact-<id8>.json" download per contact. | configurer only (not manager) | `:435-447`, `:754` |
| Erase | Confirm group, "also erase history" checkbox for configurers (not managers). Manager erase uses the dept-handlers route. | configurer or `manager_editable` | `:418-433`, `:755-763` |
| Live-link warning | Warns when a phone/email change would revoke N live links, and reports N revoked after save. | | `:719-720`, `:403-406` |
| Identity card | `<access-identity-card compact>` for `person` rows (read-only and editor). It renders nothing without the right (`tickets.configure`, `tickets.directory`, or `access.external.grant` anywhere). | | `:673`, `:757`; `access-external/model.ts:318-319` |
| Phone masking | The phone is masked unless `phone_full`. A masked number is never sent back. | server-decided | `:51`, `:665` |

### 1.5 `tickets-handlers-members` (`tickets/handlers-members.ts`)

| Capability | Detail | Gate | file:line |
|---|---|---|---|
| Cards per person | One card per user/group with every department membership. Chips: manager, WhatsApp, "mobile pending". Counts when allowed. | | `:360-387` |
| Manage panel | Toggle `data-member-toggle` opens a panel: role segmented (manager/member), "notify new" toggle for managers, remove, mobile line. | role/remove/notify need `d.can_edit_members` | `:301-313`, `:382-385` |
| Mobile line, configurer | Number, language, save, WhatsApp-on-assignment toggle, phone-verify switch. Calls `PUT /tickets/admin/staff/{user_id}`. | `tickets.configure` | `:242-266` |
| Mobile line, manager | Editable only for a plain member with server `mobile_editable`, via `memberMobile`. The number is typed anew because the shown one is masked. Otherwise read-only text with a "masked" chip. | | `:335-358`; `tickets/dept-handlers-model.ts:70-72` |
| Remove (manager) | Only plain members with an account where `can_edit_members`. | | `:316-324`; `tickets/dept-handlers-model.ts:15-17` |
| Add panel | Opened by the page "+" via the `adding` property. Department select (if more than one editable), a user/group picker, a role select (configurers only), and Add. Closes via the `add-done` event. | A manager adds a plain user only. The directory comes from `deptHandlersApi().people()`, with no groups. | `:389-410`, `:268-280` |

### 1.6 `tickets-needs-review` (`review` segment)

| Capability | Detail | file:line |
|---|---|---|
| Two cards | "pending" technicians that nobody accepted (older than the threshold; row action reject-and-delete) and "idle" people with no activity (row action delete now). Each row has a door-system tag when linked. | `tickets/needs-review.ts:229-247` |
| Confirmation dialog | Per row. Reject uses `needsReviewApi.reject`, delete uses `.erase`. A door-linked row shows a note that door removal is separate. Dialog errors stay in the dialog. | `:176-207`, `:249-266` |
| Thresholds card | Pending days 7-365, idle months 1-60. Shown only if the installation settings document is readable (otherwise absent). Saved with `saveInstallation`. | `:157-168`, `:209-227`, `:268-284` |
| Counter | The pill number = pending + idle, via the `review-count` event. | `:151`; `screens/tickets-handlers.ts:248-250` |
| Error | `data-review-failed` line when there is no report. | `:287` |

### 1.7 Portal requests, privacy contact, inbound queue, staff mobile, own numbers

| Component | Where mounted | Gate / behavior | file:line |
|---|---|---|---|
| `tickets-portal-requests` | Handlers page → `vendors` segment (above the directory). | `can.configure \|\| can.technician_requests`. Groups by vendor. Approve creates the technician row (number unconfirmed). Reject changes nothing. Empty or 403 renders nothing. | `screens/tickets-handlers.ts:374`; `tickets/portal-requests.ts:61-97` |
| `privacy-contact.ts` | **Not on these screens.** It validates the privacy contact and link in the system tickets general tab. | `public-settings.ts` | `tickets/public-settings.ts:14`, `:218-219`; `tickets/privacy-contact.ts:6-37` |
| `tickets-inbound-chip` | The tickets **list** header (`tickets-list`), not handlers. | `meta.can.manage` and `isApi()`. A chip appears only if the queue is non-empty (dialog: claim, attach to a candidate ticket, dismiss). Polled every 60 s. Emits `ticket-changed`. | `screens/tickets-list.ts:434`; `tickets/inbound-queue.ts:81-102`, `:138-159` |
| `tickets-staff-mine` | **Account menu** (`sw-user-menu`) → `<details data-my-staff-mobile>` "נייד לקישורי עבודה". Lazy-imported on open. | `api && !gated && ticketsEnabled() && canAnywhere('tickets.view')`. Hidden on 403/404. Shows own number masked, confirm/withdraw, code step when verification is required, WhatsApp toggle. | `shell/sw-user-menu.ts:461`, `:554-560`; `tickets/staff-mine.ts:46-134` |
| `tickets-my-numbers` | The tickets list when `scope === 'mine'` and the screen is ready (row of 4 KPI tiles). | `module.enabled` and `showsOwnNumbers(ui.dash_handler_numbers, manager)`: a manager always, others unless set to "managers only". Renders nothing with zero open items or on failure. Reads `list({scope:'mine', status:'open', limit:200})`. | `screens/tickets-list.ts:501`; `tickets/my-numbers.ts:39-67`; `tickets/overview-model.ts:86-88` |
| `tickets-phone-verify` | Contacts editor and members mobile line (see §1.4/§1.5). | | `tickets/phone-verify.ts` |
| `vendor-marker` | `contacts-directory` list and editor. | | §1.4 |
| `handlers-glass` | Style module only. | | |

### 1.8 Settings redirects into this page

| Item | file:line |
|---|---|
| The old Settings `?tab=contacts` redirects to `#/tickets/handlers?seg=vendors`. | `screens/system-tickets.ts:391-394` |
| Settings keeps a link card `[data-to-handlers]` to `#/tickets/handlers`. | `screens/system-tickets.ts:744` |
| RFQ add-vendor dialog and the "new RFQ" vendor list link to `#/tickets/handlers?seg=vendors`. | `tickets/rfq-board.ts:645`; `tickets/rfq-new.ts:420` |

## 2. Requests for quotation (`#/tickets/rfqs`)

### 2.1 URL / deep links (`tickets/rfq-model.ts:414-448`)

| Param | Meaning | Notes |
|---|---|---|
| (none) | List view. State defaults to `open`. | |
| `?state=` | One of `open, all, draft, sent, collecting, due_passed, awarded, ordered, closed, cancelled`. | Unknown → `open`. A `sent` or `ordered` value is accepted from the URL but has no chip (observation). |
| `?dept=` | Department filter. | Free string. |
| `?q=` | Search text. | |
| `?rfq=<id>` | Opens the vendors board. | id must match `^[\w-]{1,64}$`, else the list. |
| `&view=compare` | The comparison view. | Only with `rfq`. |
| `?new=1[&from=<ticket id>]` | New-request sheet. | `from` must be 16 lowercase hex chars, else dropped. `from` is written only when creating. |
| `rfqHref` canonicalization | With an `id`, the list filters are dropped. Without an `id`, only non-default `state`/`dept`/`q` are written. | |

- Remembered in the URL only; no localStorage anywhere in RFQ files (checked).
- The list search writes `?q=` after 250 ms via `replaceRoute` (`screens/tickets-rfqs.ts:156-160`). Filter chips use a hash push (`go(href)`, `:32-39`).
- No in-app link producing `?new=1&from=` was found in the frontend source. It is parsed and unit-tested, and the producer is UNKNOWN.
- Inbound links to `?rfq=`: the notification mock (`api/notifications-mock.ts:90`), the ticket drawer's origin fact (`tickets/overview-tab.ts:184`), and overview rows (`screens/tickets-overview.ts:768`, `:792`, `:884`, `:913`, `:945`). The overview "approvals" tile links `#/tickets/accounts` (`:665`).

### 2.2 List (`screens/tickets-rfqs.ts`)

| Capability | Detail | Gate | Remembered | file:line |
|---|---|---|---|---|
| Boot sequence | `ticketsApi().module()` → `m.enabled` (module-off) → `ticketsRfqApi().meta()` → `list({state:'all', limit:200})`. | | | `:97-142` |
| Screen states | `loading` (skeleton), `ready`, `error` (retry button re-runs `boot`), `forbidden` (403), `off` (module disabled, or the `feature_disabled` code), `unavailable` ("not available on this server": 405/422, or 404 with a non-RFQ code). | | | `:30`, `:97-124`, `:260-275`; `api/tickets-rfq.ts:725-731` |
| Empty states | No requests: a state box with a "new" button if `canCreate`. Filtered to nothing: a "no match" box with a clear-filters button (`data-rfq-clear`). | | | `:279-284` |
| Department chips | "All" plus per department. Shown if more than one department in `meta`. | Departments from the RFQ meta (server visibility). | URL `dept` | `:186-189` |
| State strip | `radiogroup data-rfq-strip`, counts per state computed client-side from the loaded page, scoped to the department filter. Chips always shown: `open`, `all`; others only if count>0 or selected. Chips available: `open, draft, collecting (=sent+collecting), due_passed, awarded, closed, cancelled, all`. | | URL `state` | `:178-179`, `:190-193`; `api/tickets-rfq.ts:31`; `tickets/rfq-model.ts:41-52` |
| Text search | `data-rfq-search`. Matches title, ref, department name, or a number in any form (`7`, `RFQ-07`, `#7`). Applied client-side. | | URL `q` | `:195-196`; `tickets/rfq-model.ts:54-60` |
| "+ New" | `data-rfq-new-btn`: `go(rfqHref({...r, creating:true}))`. The empty-state version also exists. | `canCreate()` = any `meta.departments[].can_create` | URL `new=1` | `:162-164`, `:197`, `:280` |
| KPI tiles | open / collecting / decide / quotes / no-reply, over open requests, scoped to the department filter. | | | `:202-211`; `tickets/rfq-model.ts:62-75` |
| Questions tile | Appears (red) only when the total pending questions in view > 0; sums `i.questions.pending`. | | | `:205-207` |
| Row | A link to `rfqHref({id})`: ref, state chip, question badge (`data-rfq-q-badge="row"`, red while a question is unread), title, department, place, due (passed or in), owner, vendor status bar (quoted/declined/opened/no-reply), lowest total, quoted count. | Lowest total shown only when the server sends `lowest_total_minor`. | | `:213-241`, `:249-254` |
| Row "show on map" | A sibling link when the server sent `plan_area`. | | | `:244-247` |
| Load more | A "load more" button when `next_cursor` is set. | | cursor | `:285` |
| Toasts | `data-rfq-toast`: 3.5 s ok, 7 s error. | | | `:144-148`, `:305` |
| Back-from-detail refresh | Quiet reload when the view returns to `list`. Also after any notice. | | | `:93`, `:150-154` |
| Polling | None on the list or board. UNKNOWN beyond the nav badge poll. | | | |
| Crumbs | "area" link to `#/tickets`. | | | `:182` |

### 2.3 Board (`?rfq=<id>`, `tickets/rfq-board.ts`)

| Capability | Detail | Gate (server `can.*`) | file:line |
|---|---|---|---|
| Phases | loading, ready, error (retry), missing (404, back link to list). | | `:106-121`, `:685-703` |
| Header | Crumbs `#/tickets` ‹ list (`data-rfq-crumb`) ‹ ref. Title, sub, created-by, due, window. State chip. Header question badge. Source-ticket link `#/tickets/<id>` (`data-rfq-source`). "Show on map" link. | | `:260-285` |
| Compare link | Header link (`data-rfq-to-compare`), the vendor-card link (`data-rfq-compare-n`) and a per-row link (`data-rfq-row-compare`), all to `rfqHref({id, view:'compare'})`. | `d.can.see_amounts` and live quotes>0 (per row: a quote exists) | `:280`, `:475`, `:489` |
| Send | `data-rfq-send` opens the send dialog: a mode choice `auto` (vendor page; disabled if the page is off) or `manual`, an optional navigation-link checkbox (if the request has a location), an invitation preview, and the list of files vendors get. Idempotent via `clientRequestId`. | `d.can.send` | `:281`, `:574-592`, `:163-168` |
| "More" menu | Dialog menu (`role=menu`): edit (draft: title/description/place/kinds; others: due and work window), add vendors, close, cancel, delete. | per item: `can.edit`, `can.add_vendor`, `can.close`, `can.cancel`, `can.delete` | `:282`, `:287-295`, `:648-675` |
| Pending-questions card | `data-rfq-questions=N`, oldest first, with age, quote version, "via WhatsApp (unverified)" chip, Answer and "Handled" buttons. Opening a question marks it read (`markRead`) and refreshes the badge. | answer/resolve buttons need `d.can.answer` | `:396-416`, `:381-393` |
| Banners | Pending second approval (confirm/decline, with the notice tick), awarded (with notice line, "send now", ticket link `#/tickets/<id>` `data-rfq-order-ticket`), vendor postponement (acknowledge), cancelled reason. | second-approval actions need `see_amounts` and `mayDecide`; notice send needs `a.notice.can.send`; postponement ack needs `a.postponement.can.acknowledge` | `:297-351` |
| KPI tiles | invited / opened / quoted / declined / no-reply / lowest. | lowest needs `see_amounts` | `:359-367` |
| Vendors table | Name, question badge plus note chip, channel icon, per-vendor **code switch**, state chip with decline reason, sent, opened, quote total/date, row actions: Remind (`v.can.remind`), Compare (quote + `see_amounts`), the "⋯" vendor menu. | code switch needs `meta.vendor_options && d.can.edit && typeof v.require_code==='boolean'` and a state other than awarded/removed. A 409 `vendor_code_locked` disables the off-switch. | `:459-479`, `:424-452` |
| Remind-all | Shown when `d.can.remind` and more than one vendor is remindable. | `d.can.remind` | `:488` |
| Vendor menu items | write to vendor (`v.can.message`), quote on behalf (`quote_on_behalf`), withdraw quote, decline on behalf (`decline_on_behalf`), revoke link (`link.state==='live' && d.can.edit`), remove (`v.can.remove`). | as listed | `:598-609` |
| Add vendors | A checkbox list of invitable contacts (vendor/person, active, not an account holder, not other-department-only) excluding those already added. Falls back to a link to `#/tickets/handlers?seg=vendors`. | `d.can.add_vendor` | `:636-647`; `tickets/rfq-model.ts:206-210` |
| Dialogs | remind, send, more, vendor, remove, revoke, withdraw, decline, quote (`tickets-rfq-quote-dialog`), answer (`tickets-rfq-question-dialog`), resolve, message (`tickets-rfq-message-dialog`), add, edit, close, cancel (reason plus a notify tick if any quote was submitted), delete, second-decline (reason required). | | `:44-52`, `:559-683` |
| Files card | `tickets-rfq-files`. Shown if `meta.attachments` or files exist. Editable only with `d.can.attach`. Drag and drop, file picker and camera capture, per-file caption, "visible to vendors" tick, remove. Upload order is sequential and files are added `visible_vendors:true` from the board. | | `:502-531`; `tickets/rfq-files.ts:151-209` |
| Order step | `<tickets-rfq-order>`, shown when any award is approved. | | `:697` |
| Terms step | `<tickets-rfq-terms>`, shown when any approved award has `terms`. | | `:698` |
| Timeline | `eventLine(...)` rows; unknown kinds read "other". | | `:547-555`; `tickets/rfq-model.ts:266-289` |
| Refusal mapping | `rfqError` → `err_<code>` for known codes, else the server message. | | `tickets/rfq-new.ts:47-50`; `tickets/rfq-model.ts:392-410` |
| Events | `notice` → toast on the list screen; `gone` (after delete) → back to the list. | | `:123-125`, `:222-224`; `screens/tickets-rfqs.ts:298` |

### 2.4 Order, terms, dialogs (children of the board)

| Component | Capability | Gate | file:line |
|---|---|---|---|
| `tickets-rfq-order` | One card per approved award: scope line, approved baseline (amount only with `see_amounts`), the form (execution from/to defaults from the quote's window, documents as text), "open vendor's item" (**sends nothing**), then a link to `#/tickets/<id>` and "preview and send". The preview dialog shows the exact text, channel, and any refusal; only its button sends. Notes how many unselected vendors get nothing. | create form: `a.can.order`; send: `a.can.send_order` | `tickets/rfq-order.ts:183-259`, `:110-166` |
| `tickets-rfq-terms` | Per approved award with terms: approved payment schedule (amounts need cost view), source (vendor / manager / default), planned arrival, the vendor's proposed date with accept/reject, an editable rejection notice with an explicit "send", reminders count. | accept/reject: `t.can.decide_arrival`; demands/paid/cancel: `t.can.demand`; move instalment: `t.can.reschedule`; move arrival: `t.can.reschedule_arrival`; notify vendor: `t.can.notify_vendor`; resend order: `a.can.resend_order` | `tickets/rfq-terms.ts:225-251`, `:254-262`, `:264-294` |
| Move editor | Date (and end date for arrival), optional reason, "notify the vendor" tick (default off) revealing an editable message, optional "re-send the work order" with a preview. | | `:196-222` |
| `tickets-rfq-question-dialog` | Step 1: the answer text, scope `vendor` (default) or `all` (editable shown question, optional "name the asker"), "notify" tick. Step 2: a preview listing each recipient. Nothing is stored until "send". Answer limit 2000 chars, shown question 1000. | `d.can.answer` (via the board buttons) | `tickets/rfq-question-dialog.ts:15-137`; `tickets/rfq-questions.ts:9-10`, `:39-55` |
| `tickets-rfq-message-dialog` | Private thread with one vendor plus a new clarification (max 2000). Vendor files are listed as downloads (or "attached" if costs-hidden). "Notify" default off for a manual channel. Free text never travels by WhatsApp or e-mail; only the templated `rfq_update`. | opened if `v.can.message` | `tickets/rfq-message-dialog.ts:15-113` |
| `tickets-rfq-quote-dialog` | A quote entered on the vendor's behalf: line editor (max 30 lines, the request's allowed kinds), currency, includes-VAT, work window, note, vendor ref. The preview is display-only. The entering person can never approve it (409 `self_approval`). | `v.can.quote_on_behalf` | `tickets/rfq-quote-dialog.ts:19-143` |
| `quote-form.ts` | **Not an RFQ component.** `ticket-quote-form` is the ticket-level on-behalf quote dialog, opened by the ticket detail's Costs tab. | | `tickets/costs-tab.ts:317` |
| `costs-demands.ts` | **Not on these screens.** `ticket-costs-demands` is a lazy chunk in the ticket Costs tab, with "mark paid" per instalment when the server flags `can_pay`. | | `tickets/costs-tab.ts:587-591`; `tickets/costs-demands.ts:61-69` |

### 2.5 Compare (`&view=compare`, `tickets/rfq-compare.ts`)

| Capability | Detail | Gate | Remembered | file:line |
|---|---|---|---|---|
| Load | `get(rfq)` plus `comparison(rfq)` in parallel. | | | `:86-104` |
| States | loading, ready, error (retry), forbidden (403 → "no amounts" box with a back link), empty (no quotes, back link). | The cost view is needed for the comparison. | | `:529-535`, `:564` |
| Filter | `all` / `in_window` (the latter disabled when 0). Counts from `c.filters`. | | **component state only; not remembered** | `:51`, `:551-554` |
| Sort | by price or by date (undated last). | | **not remembered** | `:52`, `:555-558`; `tickets/rfq-model.ts:306-315` |
| Currency groups | The comparison currency is first and the only ranked one. Other currencies are shown apart and unranked. Totals are never summed across currencies. | | | `:565-568`; `tickets/rfq-model.ts:293-304` |
| Table rows | per line kind, subtotal, VAT, total (lowest tag), work window (earliest tag, in/out of window), validity, lines (expandable), note, vendor files, vendor ref, payment proposal, messages/ask, scope (when something is picked). | | | `:411-450` |
| Pick quotes | Checkbox per column. | `d.can.award && q.can.award && q.state==='submitted'` | | `:118-120`, `:378` |
| Scope per pick | `all`, "only <kind>" (when more than one kind), or chosen lines (when more than one line). | | | `:391-409` |
| Approve bar | `data-cmp-bar`: approve (or "split N" when two or more picks) plus a per-vendor sum. Sticky on mobile (see tests). | `d.can.award` | | `:467-478` |
| Confirm dialog | Selected items; a warning if vendor questions are unanswered (counts all pending plus the selected vendors that asked); award text; split note; second-approval hint (only above the department threshold, in its currency); optional schedule editor per quote (if `meta.schedule_arrival`: edit the proposal, planned arrival date); award-notice block per vendor (if `meta.award_notice` is `confirm`/`auto`; a tick in confirm mode, a skip tick in auto mode). | | | `:480-503`, `:229-246`, `:288-321` |
| Award execution | Posts `award` in order, with `finalize` only on the last; stops at a pending second approval. | | | `:146-180` |
| Drafts dialog | After an award (not pending): the server's editable winner drafts (ticked) and optional "not selected" drafts (unticked), each with a notify tick. Nothing is sent by itself. | | | `:505-527`, `:324-364` |
| Ask/answer | Per column: "ask" / "messages (n)" / "answer (n pending)" opens the message dialog. | `v.can.message` | | `:443-447` |
| Crumbs | `#/tickets` ‹ list ‹ board (`data-cmp-back`). | | | `:546` |

### 2.6 New request sheet (`?new=1[&from=]`, `tickets/rfq-new.ts`)

| Capability | Detail | Gate | file:line |
|---|---|---|---|
| Mount | A `sw-drawer` always mounted on the list screen when `ready && canCreate()`. `.open` is the route's `creating`; `.sourceTicket` is `from`. Closing writes `rfqHref({...r, creating:false, from:''})` with `replaceRoute`. | `canCreate()` | `screens/tickets-rfqs.ts:303-304`; `tickets/rfq-new.ts:468-474` |
| Fields | Title (max 120), description (max 4000), department (only `can_create` ones), place or organisation location picker (the "other" free text is capped at 200), due date/time (default today + `default_due_days` at 12:00), work window, allowed line kinds (labour locked on), files (only if `meta.attachments`), vendor search and checklist. | | `:365-433`; `tickets/rfq-model.ts:18-22`, `:119-122` |
| Per-vendor channel/code | Channel radios (whatsapp/email/manual, disabled when the contact lacks the number or address) and a code tick only if `meta.vendor_options`. Otherwise read-only chips. The contact's own `require_code` can't be lowered. | | `:192-214` |
| Source-ticket chip | `data-rfq-from` link `#/tickets/<source_ticket_id>`. | | `:374` |
| Preview | The invitation preview (collapsible), the starter template `rfq_invite`, with the files line. | | `:328-338`, `:424-430`; `tickets/rfq-model.ts:239-243` |
| Actions | "Continue to send" (validates including a vendor; opens a confirm dialog with mode `auto`/`manual`, a nav-link checkbox, the preview, the files list, then send). "Save draft" (validates without vendors). Cancel. `rfq-saved` event leads to a toast plus navigation to `rfqHref({id})`. | | `:287-324`, `:435-466`; `screens/tickets-rfqs.ts:288-292` |
| Idempotency | `crid` fixed per open; the draft is created once (`ensureCreated`); files are uploaded after creation, in order, stopping on any refusal. | | `:281-285`, `:248-263` |
| Validation errors | Shown only after the first attempt. | | `:357-363`; `tickets/rfq-model.ts:172-184` |

## 3. Vendors account (`#/tickets/accounts`, `tickets/vendor-accounts.ts`)

| Capability | Detail | Gate | Remembered | file:line |
|---|---|---|---|---|
| Access | If `isApi() && !can('tickets.costs.view')` the page shows `forbidden`. Server 403 also shows `forbidden`. | `tickets.costs.view` | | `:155-158`, `:171-174`, `:349` |
| Query params | None (route is `#/tickets/accounts` only). | | | |
| Filters | from, to (period; a reversed period is refused, no request sent), vendor (select from `data.vendors`), department (from `data.departments`), currency (`CURRENCIES`), status bucket (`due`, `paid`, `open`). Each change re-queries `GET tickets/costs/claims`. | | **not remembered** (component state) | `:250-276`, `:180-186`; `tickets/vendor-account-model.ts:19-36` |
| Status mapping | due = approved, paid = paid, open = submitted. | | | `tickets/vendor-account-model.ts:10-16` |
| Summary tables | One block per currency (sorted by code), one row per vendor (most to pay first, then most awaiting, then name) plus a total row. Never summed across currencies. Clicking a vendor row sets the vendor filter. | | | `:278-300`; `tickets/vendor-account-model.ts:52-67` |
| Claims table | One claim per row: select box, ticket link `#/tickets/<ticket_id>` (`data-va-link`), title, vendor, department, status bucket, date (paid date for paid), amount. A row click navigates to the ticket. | | | `:302-322` |
| Bulk "mark as paid" | Select-all and per-row boxes for payable rows (approved, `can_mark_paid`, has a ticket). Selection is pruned to still-payable rows on reload. The button shows the count. The dialog shows a per-currency sum, a payment reference (max 60, required) and a payment date (required, max today). `POST tickets/costs/mark-paid` with revisions. The result is a per-item outcome: `already_paid` counts as done; failures are listed with reason. | `canMark` = `data.can_mark_paid && (!isApi() \|\| can('tickets.costs'))` | | `:324-346`, `:214-233`; `tickets/vendor-account-model.ts:70-101` |
| CSV export | `data-va-csv`, `GET tickets/costs/export.csv?group_by=vendor&…&rows=claim`. Disabled with no rows. Errors shown. | any viewer who can load | | `:188-195`, `:331`; `api/tickets-costs.ts:447` |
| States | loading, error with retry, forbidden, empty (`emptyReport`), `truncated` warning line. | | | `:348-363` |
| Polling | None. | | | |
| Keyboard | UNKNOWN (inherited from `sw-table`). | | | |
| `vendor-account-model.ts` | Pure model; the CSV cell guard is used by the demo store. | | | `:103-111` |
| `costs-demands.ts` | Not on this screen (see §2.4). | | | |

## 4. External access (`#/tickets/external` and `#/wiskey/external`, `screens/access-external.ts`)

Both routes render the same element.

### 4.1 Route params and deep links

| Param | Effect | file:line |
|---|---|---|
| `?grant=<id>` | Opens that grant's drawer, only if the id is in the loaded list. | `:294-298` |
| `?digest=1` | Opens the full weekly digest dialog. | `:299` |
| `?request=1` | Opens the manual request dialog (`noPerm` variant if the viewer may not request or the feature is off). | `:300`, `:853-855` |
| `?drift=1` | Opens the drift dialog. | `:301` |
| Notes | `applyRoute` runs once (`routed` flag), after the first successful load. Filters/search are not in the URL. | `:290-292`, `:129` |

### 4.2 Capabilities

| Capability | Detail | Gate | Remembered | file:line |
|---|---|---|---|---|
| Data / polling | `listGrants(true)` on load and every 15 s while visible and no dialog is open; also on `visibilitychange`→visible and `online`. A failed poll with a list on screen keeps it and shows a "stale" banner with a retry. | | | `:35`, `:270-275`, `:304-321`, `:1057-1060` |
| Initial states | error panel with retry (no data and an error); loading panel. | | | `:1101-1102` |
| Banners | "feature off", "N revoking" (open button), WisKey offline (with last-known time and "check again"), stale. | | | `:1119-1123`, `:1048-1062` |
| Header buttons | New request (`data-open-request`): `data.may_request && !off`. Export CSV (`data-export-csv`): disabled with no grants or while exporting; a rate-limited response `export_rate` shows a toast. Settings and Revoke-all: `data.system_admin` only. | as stated | | `:1108-1118`, `:348-363` |
| Revoke all | Confirm dialog requiring the typed word `בטל הכל`. Disabled when off or with no live grants. | system admin | | `:39`, `:1115-1116` |
| KPI buttons | Five buckets: `attention, waiting, moving, active, history`. A click filters to that bucket, and a second click returns to `live`. | | **state only** | `:1126-1128`; `access-external/model.ts:10-13` |
| Default filter | `live` = every bucket except history. | | | `access-external/model.ts:79-92` |
| List filters | Search (person name or source ref), a door/station dropdown (from the grants' stations), a source dropdown (ticket / RFQ order / manual), and a "shown N" chip. | | **state only** | `:1064-1096`; `access-external/model.ts:79-99` |
| Empty states | Off+empty, empty (with a "new request" action if allowed), or no-match (with "show all open"). | | | `:1070-1076` |
| Row | Person, company/category, source+ref, door chips (plus widening adds), window dates/hours, state badge plus why-text, code chip or "not needed". Clicking opens the drawer. | | | `:1079-1085` |
| Side panels | Digest panel (hidden when off or no digest), drift panel (only when `drift.enabled`), rules panel (feature state, limits, an "extended identity" locked row). | | | `:1009-1040`, `:928-936` |
| Pending technicians panel | Vendor-typed technicians nobody decided; sorted; approve (`acceptContact`) and reject-and-delete (`rejectPendingContact`) after a confirm. Hidden if empty or if the server answered 403. | deciders | | `:992-1005`, `:324-330` |
| Drawer | State badge and callout, revoking box, read-back box, amendment diff, sync/unknown explainers, ladder plus "more why", doors table, window, code state (PIN grants: never shows the code), card block (card grants: number input cleared on press; reading a card is disabled), closure reference, **identity card**, timeline, read-back result line, per-grant **history (system admin only)**, footer actions. | | | `:513-568`, `:595-641` |
| Drawer actions (from `actionsOf`) | accept: draft state. refuse: pending, or has a widening. approve: pending or widening, **and** not `self_requested` unless the viewer is a system admin. retry: state `approved`. rotate: active PIN grant with a code state sent/not-delivered/unknown and under 3 sends. revoke: states pushing/accepted/verified/sync/unknown. gone: system admin, revoking, link `wiskey_missing`. readNow: unknown/revoking/accepted/verified. Retry and read-back are disabled while WisKey is offline. | per action as listed | | `access-external/model.ts:172-185`; `screens/access-external.ts:651-669` |
| Approve dialog | Narrow-only: pick a subset of doors (min 1), narrow the date window (max `max_days`, within the original), a "told the person" tick when no page or approver notice exists, a preview of the message, a "what happens after" flow. Refuse button also present. | | | `:673-756` |
| Confirmed-gone dialog | Three checks, a clean reference, the typed word. | system admin | | `:758-793` |
| Digest dialog | Counts, gaps (with "read back"), slow revokes, approvers, codes. | | | `:808-849` |
| Drift dialog | Rows with per-kind explanations and actions: push name (`r.can.push_name` and a name diff), read back (`r.can.read_now` and a read-kind diff), open grant. | | | `:867-926` |
| Settings dialog | placement (access/tickets/both), digest channel (app / app+WhatsApp), day, hour, name sync (manual/auto). Saves via `putScreenSettings`, then `applyExternalPlacement`. | system admin | | `:938-970` |
| Request dialog | `access-request-dialog` (separate module). | `may_request` | | `:857-865` |
| Identity-card gate | `mayOpenIdentityCard`: `access.external.grant` anywhere, or `tickets.configure`, or `tickets.directory`. | | | `access-external/model.ts:316-320`; `access-external/identity-card.ts:90-91` |
| Where the identity card appears elsewhere | The handlers contacts editor/read-only body for `person` rows. | | | `tickets/contacts-directory.ts:673`, `:757` |
| Module-off / forbidden | The screen has no tickets-module-off or forbidden panel. "Off" means the access-external feature (`data.enabled`). A server 403 on the first load shows the generic error panel. UNKNOWN whether a missing `access.external.grant` shows anything other than the tab being hidden. | | | `:1101`, `:1119` |

## 5. Test coverage (`frontend/tests`)

### 5.1 Handlers / directory

| Spec | What it asserts about routes / hrefs (and what it covers) |
|---|---|
| `evidence-tickets-handlers.spec.ts` | Clicking the vendors segment gives `toHaveURL(/#\/tickets\/handlers\?seg=vendors/)` (65-67). Direct goto `?seg=contacts` (70). Readiness hrefs: `page_off`/`address` → `#/system/tickets` (152-153), `switch` → `#/system/tickets?tab=channel` (154), `account` → `#/system/messaging-accounts` (158). Settings link card `[data-to-handlers]` href is `#/tickets/handlers` (165). The old `?tab=contacts` lands on `?seg=vendors` (168). Assign-dialog blocked links: `no_members`/`no_employees` → `#/tickets/handlers` (242, 252), `no_contacts` → `#/tickets/handlers?seg=vendors` (254, and the click lands on it, 256), `page_off` → `#/system/tickets` (246), `switch` → `#/system/tickets?tab=channel` (289). Also covers add/manager/remove, TKSTAFF1 mobile, employee create, manager w/o the settings right (masked phones, nothing editable). |
| `evidence-tickets-ui6.spec.ts` | gotos `/tickets/handlers` and `?seg=vendors`. Covers load counts for managers only, the handled-period selector with its remembered choice (161-181), vendor cards/contacts/drawer, the readiness banner (218), and the settings tabs' arrow keys. |
| `evidence-tickets-s4.spec.ts` | gotos `?seg=vendors` and `?seg=contacts`; a manager sees masked phones and edits nothing; an edit sends only what changed. |
| `layout-tickets-s4.spec.ts` | Layout of `handlers-contacts` (`?seg=contacts`) and `handlers-members`. |
| `evidence-tickets-needs-review.spec.ts` | goto `?seg=review`. Asserts the review radio `aria-checked=true`, pill text `2`, thresholds save, and reject/delete dialogs. A department manager has 0 review segments and `handlers` stays `aria-checked` (137-141). The URL is not asserted. |
| `evidence-vendmark-295.spec.ts` | gotos `?seg=vendors` and `?seg=contacts`; chips, filter, editor; with the module off the marker brings no ticket action. |
| `unit-tickets-handlers.spec.ts` | `TICKETS_TABS[5]` is `handlers` with `TICKETS_HANDLERS_HREF === HANDLERS_HREF`. `TAB_PERMISSIONS` is `['tickets.configure','tickets.manage']`. `activeAreaTab` is `handlers`. `handlersHref('vendors')` is `#/tickets/handlers?seg=vendors`. `missingItems` and `outsideBlock` logic. |
| `unit-tickets-needs-review.spec.ts` | The review segment is shown to `tickets.configure` holders only, and last; word coverage. |
| `unit-tickets-ui6.spec.ts` | Loads by assignee key, managers-only visibility, `rovingIndex`, handled-period parse/store/merge. |
| `unit-tickets-dept-handlers.spec.ts` | `parseBoardRoute('pane=handlers&dept=x')` and `boardHref` = `#/tickets/board?dept=x&pane=handlers` (57-59). Pure rules; source-text lint that components use the manager routes (76-86). |
| `unit-tickets-dept-handlers-decisions.spec.ts` | Not shared by default; lookup sends only full numbers and the phone is in the body, not the URL; mobile editable flag; creating-department label. |
| `unit-vendor-marker-295.spec.ts`, `unit-portal-requests-model.spec.ts`, `unit-phone-verify.spec.ts`, `unit-privacy-contact.spec.ts` | Pure model/text only; no routes. |
| `unit-tickets-assignees.spec.ts` | `staffBlock` yields the `no_employees` href `#/tickets/handlers` (56). |
| `evidence-tickets-s5b.spec.ts` | Inbound chip and dialog (claim, text revealed only after the claim), on the tickets list. |
| Specs for `tickets-staff-mine` / `tickets-my-numbers` | None found by selector grep (UNKNOWN beyond that). |

### 5.2 RFQ

| Spec | What it asserts |
|---|---|
| `evidence-tickets-rfq2.spec.ts` | Strip counts: `open`=4, `all`=5 (51-52). Clicking `cancelled` puts `state=cancelled` in the URL (59-61). No-match state (66). State boxes `loading/empty/error/unavailable` (84-95). Goto `/tickets/rfqs?new=1` on a contract-v0.9 server (146). Board `?rfq=RFQ7` (171, 181, 204). `&view=compare` (230, 238, 242, 279, 315). No-amounts persona (309, 315). Close and cancel flows. |
| `evidence-tickets-rfq4.spec.ts` | `?rfq=RFQ5` and `?rfq=RFQ7`. The item drawer's origin link has `href="#/tickets/rfqs?rfq=<RFQ5>"` (149). Order card, preview-then-send-once, split award, refusal text. |
| `evidence-tickets-rfq-code.spec.ts` | Board code switch, `vendor_code_locked`, and no switch without vendor options. |
| `layout-tickets-rfq2.spec.ts` | List, board, compare, `compare-currencies` and `/tickets/rfqs?new=1`: no overflow, RTL, 44 px targets. The compare frame scrolls on a phone. Keyboard Tab/Enter on list rows, and the URL contains `rfq=` (90-98). |
| `layout-tickets-rfq4.spec.ts` | Order form layout and keyboard. |
| `layout-tickets-rfq-bar.spec.ts` | Compare, mobile only: the approve bar hugs the bottom; picking quotes enables approve; two quotes open the split flow. |
| `layout-tickets-rfq-questions.spec.ts` | Board and compare (`&view=compare`) layout; the list row and compare column carry the badge; the nav count: `[data-tab-badge="rfqs"], [data-nav-badge="tickets"]` is visible (59); the answer dialog; the award confirmation warning. |
| `unit-tickets-rfq.spec.ts` | `parseRfqRoute` / `rfqHref` exact outputs (224-237): defaults; bogus state → `open`; `rfq=abc123` → board; `&view=compare`; a script-ish id → `''`; `new=1&from=00000000000c1042` kept; bad `from` dropped; `rfqHref({id,view:'compare',state:'closed'})` = `#/tickets/rfqs?rfq=r1&view=compare`; `rfqHref({creating:true, from})` = `#/tickets/rfqs?new=1&from=…`. Tab href and label; `TAB_PERMISSIONS[TICKETS_RFQS_HREF]` equals `['tickets.external','tickets.costs']` (270); `activeAreaTab` is `rfqs` with `rfq=r1` (271). Plus filters, tiles, status bar, dates, draft checks, invitable rules, preview, currency groups, award maths, split, second-approval hint, timeline, refusals, texts. |
| `unit-rfq-questions.spec.ts` | `applyRfqQuestions(3)` sets `tab.badge=3`, `tab.alert=true`, `areaBadge('tickets')=3`; module off → 0; reset clears (103-117). Badge/award-warning/answer-body rules. |
| `unit-tickets-rfq-order.spec.ts`, `unit-tickets-rfq-terms.spec.ts` | Order and terms models/words and the demo store; no routes. |
| `unit-rfq-attachments.spec.ts`, `unit-rfq-award-notice.spec.ts`, `unit-rfq-notify.spec.ts`, `unit-rfq-vendor-upload.spec.ts`, `unit-rfq-question-settings.spec.ts` | Titles read only; no `#/` route assertions were found by grep (one `.href =` lint in the upload spec). |
| `layout-page-background.spec.ts` | Includes `#/tickets/accounts`, `#/tickets/handlers`, `#/tickets/rfqs` in its page-background sweep (30). |
| Fixtures | `tests/tickets-rfq-mocks.ts` replays the demo RFQ store behind `page.route`, including the questions summary (94). |

### 5.3 Vendors account

| Spec | What it asserts |
|---|---|
| `evidence-tickets-vendor-accounts.spec.ts` | goto `/tickets/accounts`. Blocks per currency (never added), the tab is active, row link `data-va-link` href `#/tickets/000000000000c001` (141), the filters become the server query, bulk mark-paid with per-currency sums and revisions, CSV of the current filter, view-only (no boxes), states loading/empty/error-with-retry/forbidden. |
| `unit-tickets-vendor-accounts.spec.ts` | Buckets, summary, ties, bulk rules, outcome, query, CSV guard. Tab test: `accounts` is the last scope tab before `external`; label `חשבון ספקים`; `TAB_PERMISSIONS['#/tickets/accounts']` is `['tickets.costs.view']`; `activeAreaTab` is `accounts` (102-108). |
| `unit-costs-demands.spec.ts` | The ticket Costs-tab demands chunk (lazy import, no static import, `can_pay` only, 5 KB budget). |

### 5.4 External access

| Spec | What it asserts |
|---|---|
| `evidence-sharedid-293.spec.ts` | Default goto `/wiskey/external`. KPIs and states, verified only with proof, drawer, approve narrows only and sends exactly the doors and window shown, confirmed-gone gating, a non-admin approver gets no gone/attach/settings, the digest, the identity card (name drift, attach), decision 6: clicking `[data-setting="placement:both"]` and save, PUT body contains `placement:'both'` (160-172). The "feature off, empty" shipped build. |
| `evidence-accessreq-293.spec.ts` | Request dialog. `?request=1` with no permission shows the short refusal (188). |
| `evidence-grantsmin-295.spec.ts` | `?drift=1`: drift panel/dialog, actions, empty state, feature-off hides the panel, CSV export and its once-a-minute rate limit. |
| `evidence-grants3-295.spec.ts` | `?grant=<id>` opens the drawer for a card grant and its history (170). |
| `evidence-sharedui-295.spec.ts` | Read-back wait, stale, offline, empty list offers a new request, identity card load failure. |
| `evidence-secfix2-295.spec.ts` | Pending-technicians panel: lists, rejects through the existing route, hidden on 403 or empty. |
| `unit-access-external.spec.ts` | Pure model: states, buckets, read-back rules, narrowing in the installation zone, word coverage in 4 languages, `mayOpenIdentityCard` (DIRPERM-295). |
| `unit-tabs-config.spec.ts` | Imports `applyExternalPlacement` only to reset it to `null` (line 59); no placement assertions found. |
| **Gap** | No spec asserts `#/tickets/external` or `EXTERNAL_TICKETS_HREF` (grep found none). `TAB_PERMISSIONS` for `EXTERNAL_WISKEY_HREF` and `EXTERNAL_TICKETS_HREF` (`shell/nav.ts:1090-1091`) are likewise unasserted. |

## 6. Findings worth flagging

1. **Dead "+" on read-only directories.** The "+ vendor" and "+ contact" buttons show for every viewer of the page, but `startNew()` is a no-op for a read-only manager (`screens/tickets-handlers.ts:396`; `tickets/contacts-directory.ts:264-266`).
2. **`review` in embedded mode.** The embedded board pane can still show the `review` segment to a `can.configure` viewer (`screens/tickets-handlers.ts:233-235`).
3. **Unreachable RFQ URL states.** The route accepts `state=sent` and `state=ordered`, which have no chip, so nothing highlights (`tickets/rfq-model.ts:417` vs `api/tickets-rfq.ts:31`).
4. **Per-user filters are not stored.** Compare filter/sort, vendor-accounts filters and external-access filters are component state only. The only stored view preference in these screens is the handled period (localStorage). RFQ list filters live in the URL only.
5. **Module-off handling is uneven.** The RFQ list has an explicit off state. Handlers, accounts and external have none of their own (UNKNOWN beyond the tab hiding).

Not determined: the server-side rule behind the nav badge count, what `question_badge_all_viewers` changes, any frontend producer of `?new=1&from=`, keyboard behaviour inside `sw-table` on the accounts page, and specs for `tickets-staff-mine` / `tickets-my-numbers`.

# Appendix C - settings tabs, ui.tabs, tests that pin the tabs, inbound links (sweep 3)

# Read-only capability inventory: service-management tabs, `ui.tabs`, pinning tests, inbound links

I read everything at `origin/main` @ c37c75c91 and edited nothing. Paths are relative to the worktree root. `ST` means `frontend/src/screens/system-tickets.ts`. `TK` means `frontend/src/tickets/`. `nav` means `frontend/src/shell/nav.ts`. Anything I could not determine is marked UNKNOWN.

---

## PART A. Settings › service management (`#/system/tickets?tab=…`)

### A0. Frame, routing and gating

| Item | Detail | file:line |
|---|---|---|
| Route | `#/system/tickets`. It is the `tickets` tab of the system area (`AREA_TABS.system`), with href `TICKETS_SETTINGS_HREF`. | nav:707, nav:875 |
| Who gets the settings tab in the shell | any of `system.configure` or `tickets.configure`, installation scope only (`INSTALLATION_ONLY_HREFS`) | nav:1087, nav:1146 |
| Tab ids (9) | `general, departments, locations, display, channel, messages, costs, rules, permissions` | TK/settings-tabs.ts:6-9 |
| Which tabs the strip offers | `display, channel, costs, rules` need `system.configure`. `messages, locations` need `tickets.configure`. `general, departments, permissions` are always offered. With no backend (demo) all nine show. | settings-tabs.ts:17-21 |
| Tab strip | A hard-coded `role=tablist` (`data-tickets-settings-tabs`), roving focus with RTL-aware arrow keys, Home and End. It is not driven by `ui.tabs` or by tabs-mode. | ST:1049-1050, settings-tabs.ts:25-34, ST:400-406 |
| `?tab=` reading | `readTab` takes `?tab=` and accepts it if `isSettingsTab`. It does not check `visibleTabs`. `general` is the default. | ST:389-397 |
| URL write | `setTab` calls `replaceRoute('/system/tickets', tab==='general' ? undefined : {tab})`. | ST:408-412 |
| Hashchange | re-reads the tab and reloads it | ST:381-387 |
| Old `?tab=contacts` | `queueMicrotask(() => location.replace('#/tickets/handlers?seg=vendors'))`. The test pins this. | ST:391-395 |
| Module off | Only the General tab body renders, with the module card showing the switch and "module off". Other cards are hidden because `enabled` is false. | ST:746, ST:1051 |
| Module switch effect | PATCH `settings {tickets.enabled}` then `applyTicketsHidden`, so the area appears or leaves the nav at once. | ST:503-520 |
| Settings index entries | Only 3 are listed: General (`#/system/tickets`), `?tab=departments` and `?tab=permissions` (both `sub:true`). The tabs locations, display, channel, messages, costs and rules have no index entry. | frontend/src/screens/system-index.ts:113-115 |
| Index active-entry mapping | maps `?tab=` back to an index href | system-index.ts:181-184 |
| Dropdown placement | `/system/tickets` declines dd-place 2, 3 and 4 and falls back to 1, because the ninth tab collides with the chip. | frontend/src/shell/dd-place-fit.ts:43 |
| Server gates (summary) | `GET/PUT tickets/settings` and the notify-matrix meta need `system.configure`. Admin departments, categories, priorities, SLA, templates, members, directory, holders and locations need `tickets.configure` through `_configurer`. `PUT tickets/name` needs `tickets.configure`. Channel needs `system.configure`. Message-templates need `tickets.configure`. Rules need `system.configure`. Dept costs need `tickets.configure`. | smplwise_vms/backend/smplwise/routers/tickets_admin.py:50-52, 64-74, 321-323, 477-480, 554, 1139-1154, 1232; tickets_messages.py:79-108, 356-467; tickets_rules.py:29,64-100; tickets_costs.py:554-575 |
| Edge case from the code | A user with only `tickets.configure` who opens `?tab=display` directly gets `tab='display'`. `loadTab` skips loading the doc, so `displayTab()` shows the loading panel. Whether anything else intercepts this is UNKNOWN. | ST:396, ST:463-464, ST:800 |

**Links OUT of settings**

| Link | Where | Target | file:line |
|---|---|---|---|
| Handlers link card (`data-card="handlers-link"`, `data-to-handlers`) | General tab, shown when `enabled && (tickets.configure || canAnywhere('tickets.manage'))` | `TICKETS_HANDLERS_HREF` = `#/tickets/handlers` | ST:722, ST:742-745 |
| `?tab=contacts` redirect | readTab | `#/tickets/handlers?seg=vendors` | ST:391-395 |
| Roles link `data-to-roles` | Permissions › matrix card | `#/system/access` | ST:975 |
| Users link `data-to-users` | Permissions › holders card | `#/system/access` | ST:995 |
| No-assign fallback | Permissions › grant card | `#/system/access` | ST:1020 |
| Channel "manage accounts" button `data-channel-manage` | Channel › uses card | `v.accounts_href` or `#/system/messaging-accounts` | TK/settings-channel.ts:227 |
| Location nav link `data-location-nav` | Locations list row | external `nav_url` (new tab), not internal | TK/settings-locations.ts:314 |

**Links INTO settings from the area**
- Module-off panel: `<a href="#/system/tickets" data-open-settings>`, shown only with `system.configure`. (frontend/src/screens/tickets-list.ts:460)
- Readiness items point to `#/system/tickets` (page and address), `?tab=channel` and `?tab=permissions`; `accounts` points to `#/system/messaging-accounts`. (TK/readiness-model.ts:20-25)
- The department-members empty state points to `?tab=departments` (`data-to-departments`). (TK/handlers-members.ts:439)

### A1. General tab (`general`). Layout: left column then right column, `sgrid` (ST:746-764)

| Capability | Where (tab › card) | Gate | Query / deep link | file:line |
|---|---|---|---|---|
| Module on/off switch (`tickets.enabled`) | General › module card (`data-card="module"`, `data-tickets-enabled`) | toggle enabled only with `system.configure` (UI). PATCH `/settings` needs `system.configure`. | none (the default tab) | ST:728-730, ST:503-520, ST:719 |
| Module display name, D33 (per-language `module`/`one`/`many`/`gender`, he default and "other languages" fold, live preview, default reset) | General › module card (`data-name-editor`) | edit needs `tickets.configure` (UI `mayName`; server `PUT tickets/name`, tickets_admin.py:477-480) | none | ST:588-602, ST:731-739, ST:534-555 |
| Handler link card | General › `handlers-link` | see A0 | none | ST:742-745 |
| Handler page / public address ("דף המטפלים"): state, org name, privacy contact and link, theme, vendor portal on/off with closed months, require confirmed number, rfqs, technician_requests, public address with probe, path prefix, advanced folds (trusted CIDRs, client-IP header, legacy `/t` paths) | General › `tickets-public-card` (`data-card="public"`) | `system.configure` (whole doc). Address, prefix, CIDRs and header are read-only on a remote session. | none | TK/public-settings.ts:28-289 (portalRows 186-209, address 250-260, prefix 261-270, advanced 271-287); ST:751 |
| Link lifetime D5: sliding days (1-90), cap days (7-365), grace hours (0-168) | General › `links` card (`data-card="links"`) | `system.configure` | none | ST:604-626 |
| Vendor send hours D4 (from/to) | General › `hours` card | `system.configure` | none | ST:629-642 |
| Urgent as critical D28 (installation default) | General › `hours` card (`data-inst-urgent`) | `system.configure` | none | ST:643-645 |
| Notification matrix and daily digest: `matrix_enabled`, `digest_enabled`, `urgent_immediate`, site digest time, per-dept picker, per-dept digest time and recipients (managers, users, roles), per-dept channel overrides (`inapp` always on), per-event now/digest/off cells, per-priority SLA-urgent bypass | General › `data-card="notify-matrix"` › `ticket-notify-matrix` | only `isApi() && system.configure`. Server: `GET tickets/settings/notify-matrix` and `PUT tickets/settings`. | none | ST:757-759; TK/notify-matrix.ts:28-193 (toggles 174-176, time 177-180, dept 181-191) |
| Working-hours calendar (SLACAL): enabled, weekdays, daily window, per-day hours, holidays, hold internal reminders, auto-close mode, link-unopened clock, per-dept inherit/always/own | General › `tickets-work-calendar-card` (`data-card="work-calendar"`) | `system.configure` | none | ST:760; TK/work-calendar-card.ts:26-213 |
| RFQ terms: schedule_arrival switch (default off), arrival-reminder hours, question-reminder hours, "badge for all viewers", instalment-reminder hours, award notice (confirm/auto/off), postpone-late hours | General › `rfq-terms` card (the "payment schedule / award notice" items you listed) | `system.configure` | none | ST:649-716 (rows 660, 663, 668, 673, 676/706, 677/696, 678/683) |
| RFQ vendor uploads: master switch plus 5 limits (`max_files` ≤10, `max_uploads` ≤30, `max_image_mb` ≤8, `max_doc_mb` ≤10, `max_total_mb` ≤50). `max_uploads` must be ≥ `max_files`. | General › `rfq-vendor-uploads` card | `system.configure` | none | ST:47-53, ST:769-791 |

`TK/rfq-terms.ts` is not settings-level. It is the per-RFQ detail component `<tickets-rfq-terms>`: one terms card per approved award on the RFQ detail (TK/rfq-terms.ts:34, 272, 300). The settings for it are the General › RFQ card above. `rules-model.ts` and `org-locations-model.ts` are pure models for the rules and locations tabs.

### A2. Departments tab (`departments`). `?tab=departments` (in the settings index)

Left column: the department list card and the deleted-departments card. Right: `tickets-dept-editor`. (ST:900-923). Gate: the whole tab loads from `GET tickets/admin/departments`, which needs `tickets.configure`. If it fails with 403 the page shows `setNoPermission` (ST:479). The tab itself is always offered.

| Capability | Where | Gate | file:line |
|---|---|---|---|
| Department list with summary counts (categories, priorities, members) and inactive tag | Departments › `dept-list` | `tickets.configure` | ST:905-917 |
| Add department (name only; the server derives the key) | Departments › `dept-list` footer (`data-dept-add`) | `tickets.configure` | ST:837-854, ST:913-916 |
| Deleted departments + restore | Departments › `dept-deleted` (`<details>`, `data-dept-restore`) | `tickets.configure` (audited) | ST:868-893 |
| Details: name, description, active, open-to-all, reopen days (1-90) | Editor › `dept-basics` | `tickets.configure` | TK/settings-dept.ts:118-142 |
| Delete department with confirm (blocked when open tickets exist; restorable) | Editor › `dept-basics` | `tickets.configure` | settings-dept.ts:139-171 |
| Categories: chips, add, remove, edit parent, default priority, device `domains` (regex slug list, max 20) | Editor › `dept-basics` › categories row (`data-cat-editor`) | `tickets.configure` | settings-dept.ts:179-208 |
| Members: add user or group, role manager/member, `notify_new` toggle for managers, remove | Editor › `dept-basics` › members row | `tickets.configure` and (manager of the dept or `tickets.all_departments`); the UI uses `d.can_edit_members`. Server: tickets_admin.py header lines 1-8, 1073, 1096. | settings-dept.ts:212-237 |
| Priorities: rename, alert severity (info/alert/critical), make default, active | Editor › `dept-priorities` | `tickets.configure` | settings-dept.ts:241-259 |
| Rules: share history with external handler (D3/D23), auto-close after N days (D10, 1-30), urgent-as-critical override (inherit/yes/no), link lifetime override (own toggle plus 3 fields), vendor send hours override | Editor › `dept-policy` | `tickets.configure` | settings-dept.ts:263-327 |
| SLA grid: thresholds in min/h/d (empty = off), 2 reminder counters, per priority. A table on desktop, per-priority cards on a phone. One save, 409 `sla_stale`. | Editor › `dept-sla` › `tickets-sla-grid` | `tickets.configure` (`PUT …/departments/{id}/sla`, tickets_admin.py:920) | TK/settings-sla.ts:22-141 |
| Opening templates: name, title, category, priority, body (≤4000), active, delete; max 50 | Editor › `dept-templates` | `tickets.configure` | settings-dept.ts:331-380 |

### A3. Locations tab (`locations`). `?tab=locations` (no index entry). Gate: `tickets.configure`

| Capability | file:line |
|---|---|
| List with default and inactive chips, in-use count, linked plan area, nav link. Actions: edit, make default, activate/deactivate, remove (hidden when in use; confirm). | TK/settings-locations.ts:306-322, 214-237 |
| Inline editor: name (unique), sort order, street, city, details, lat/lng, plan room (ORGPLAN-291), active, default | settings-locations.ts:274-304 |
| Add (capped at `max`) | settings-locations.ts:341-347 |
| Per-department default location card (`locations-departments`) | settings-locations.ts:324-334, 239-249 |
| API | `tickets/admin/locations`, `tickets/admin/locations/plan-areas`, `PUT …/departments/{id}/location` (tickets_admin.py:1232-1311) |

### A4. Display tab (`display`). `?tab=display`. Gate: `system.configure`. All values live in `PUT tickets/settings` `ui.*`. Rendered at ST:799-822.

| Capability | Where | Key / attribute | file:line |
|---|---|---|---|
| Detail mode D18 (drawer / fullscreen / drawer+fullscreen) | Display › `display` card ("פתיחה והצגה") | `ui.detail`, `data-ui-detail` | ST:805-806 |
| New-request mode D22 (sheet/dialog) | same card | `ui.new_ticket`, `data-ui-new` | ST:807-808 |
| Drawer default tab (overview/conv/costs/history) | same card (`drawerSettingsRows`) | `ui.detail_tab`. Rendered only if the key exists in the doc. | TK/settings-drawer.ts:13-22; ST:829-833 |
| Drawer size (drawer/wide/full) | same card | `ui.drawer_size` | settings-drawer.ts:23-24 |
| Phone sheet (full/half) | same card | `ui.phone_sheet` | settings-drawer.ts:25-26 |
| Live in-page camera viewfinder kill switch (default off) | same card | `ui.camera_viewfinder` | settings-drawer.ts:30-37 |
| Board floors D19 (tree/chips/chips_tree), grouping D20 (no_status_filter/always/never), closed strip D21 (all/week/hidden), handled-days default (1/7/30) | Display › `display-board` › `ticket-board-settings` | `ui.board_floors`, `grouping`, `closed_strip`, `handled_days`; `data-ui-board` | TK/board-settings.ts:58-65, 50-56; ST:813-815 |
| D17 long press (sheet/menu) | Display › `display-device` | `device_long_press`; also `setLongPressMode` live | ST:575-586, ST:816 |
| Overview (MGRDASH): who sees handler numbers (managers/own/everyone), vendors in load card (tagged/separate/hidden), busy threshold (default plus per active department), department-comparison place (top/below_numbers/bottom), morning-digest hour (0-23), "stuck department" threshold | Display › `display-overview` › `ticket-overview-settings` | `ui.dash_handler_numbers, dash_vendors, dash_busy, dash_busy_departments, dash_compare, dash_digest_hour, dash_dept_stuck` | TK/overview-settings.ts:111-120, 100-109, 76-98; ST:817-819 |

The server's `ui` model for the board and dash keys is at tickets_admin.py:99-111.

### A5. Channel tab (`channel`). `?tab=channel` (linked from readiness). Gate: `system.configure`

All of it is inside `<tickets-channel-settings>` (`GET/PUT tickets/channel`). (TK/settings-channel.ts:257-263)

| Capability | Where | file:line |
|---|---|---|
| WhatsApp master switch (default off), reply buttons (default off), reply-match window (1-336 h), e-mail fallback D13, mail-server state read-only | Channel › `channel-whatsapp` | settings-channel.ts:187-209 |
| Phone-number verification required (`phone_verify.required`) | same card | settings-channel.ts:207-209 |
| "Department managers see full phone numbers" (`directory.managers_full_phones`, saved via `PUT tickets/settings`) | same card, only if the server returns it | settings-channel.ts:210-212, 130-145 |
| Uses and accounts (read-only), per-dept toggle, warnings, button to messaging-accounts | Channel › `channel-uses` | settings-channel.ts:216-229 |
| Account state and last send | Channel › `channel-accounts` | settings-channel.ts:231-240 |
| Queue health tiles | Channel › `channel-health` | settings-channel.ts:242-255 |
| Reports to vendors (VENDORQ2-295): `to_contacts`, `email`, `documents` switches (the last two disabled until the first is on), document hours and max opens | Channel › `tickets-reports-settings` (`data-card="reports-settings"`), mounted only here | TK/reports-settings.ts:95-107, 76-93; settings-channel.ts:262 |

### A6. Messages tab (`messages`). `?tab=messages`. Gate: `tickets.configure`

`<tickets-message-templates>`. A picker for purpose × language × department ("all" = installation). An editor card (`template-editor`) with starter/custom/inactive state, a textarea with placeholder buttons, live server preview and problems list, plus save, cancel, edit/new, delete and active toggle. (TK/settings-message-templates.ts:211-258). Endpoints are `tickets/admin/message-templates[/…]` (tickets_messages.py:356-467).

### A7. Costs tab (`costs`). `?tab=costs`. Gate: `system.configure` for the installation document (`GET/PUT tickets/settings` `costs` block). The department cards additionally need `tickets.configure`; they are simply absent if that call fails.

| Capability | Where | file:line |
|---|---|---|
| Default requirement mode (required/optional/off), currencies (≤5), VAT %, claim window days, require invoice, max claim total, review flag amount, retention days | Costs › `costs-installation` | TK/settings-costs.ts:164-184 |
| Per-department cost-claim mode (with "default") and window days | Costs › `costs-departments` | settings-costs.ts:186-201 |
| Allowed line kinds (labor fixed): installation list and per department | Costs › `costs-kinds` | settings-costs.ts:203-223 |

### A8. Rules tab "פתיחה אוטומטית" (`rules`). `?tab=rules`. Gate: `system.configure` only (a `tickets.configure` holder is not enough; tickets_rules.py:2,29)

All inside `<tickets-rules-settings>` (`GET/PUT tickets/rules`, `POST tickets/rules/test`). (TK/settings-rules.ts)

| Capability | file:line |
|---|---|
| Master kill switch `enabled`, installation default daily limit (≤ `hard_daily_max`) | settings-rules.ts:409-419 |
| Rule list: source label, department, effective daily limit, today's count; chips (disabled, invalid, limit reached); actions edit, test, enable/disable, remove (confirm) | settings-rules.ts:380-400 |
| Rule editor: name, source (alert source), hold minutes, subject id, department, priority, category, daily limit, title and description with placeholders, `on_clear` (comment / comment_close), enabled | settings-rules.ts:334-378 |
| Dry run "בדיקת כלל" (writes nothing): would-create, matches/held, sample alerts, preview | settings-rules.ts:317-332, 282-308 |
| Add (disabled when full or there are no departments) | settings-rules.ts:423-424 |

### A9. Permissions tab (`permissions`). `?tab=permissions` (in the index). The tab is always offered; data loads from `GET tickets/admin/holders` and `…/directory` (`tickets.configure`). A failure shows an error state with retry (`permsFailed`, ST:1036-1040).

| Capability | Where | Gate | file:line |
|---|---|---|---|
| Role × 6 ticket permissions matrix (`view, create, manage, external, all_departments, configure`; the last three are tagged "sensitive"), custom-role tag, per-role chips on phone | Permissions › `matrix` | tickets.configure (read) | ST:70-72, ST:962-977 |
| Holders by person or by permission (via role / group / personal grant, scope, expiry, deny, inactive) | Permissions › `holders` | tickets.configure (read) | ST:979-997, 954-960 |
| Personal grants (D25): pick user, scope (installation / site / building / floor from `loadTree`), optional end date, toggle one of 6 permissions. Implemented as `createBinding` / `revokeBinding` with role `tickets_<perm>`. | Permissions › `grant` | UI shows the controls only for `canAnywhere('rbac.assign')`; the server enforces rbac.assign and delegation rules | ST:999-1022, 931-952 |

---

## PART B. `ui.tabs` (TABSET-293)

### B1. Stored shape

- **Setting.** `ui.tabs` is an installation product setting, default `"{}"` (routers/settings.py:90). It is stored as compact JSON text (settings.py:1130) and read back as an object by `_stored_tabs` (settings.py:416, 555-560).
- **Value.** An object keyed by section id: `{ "<section>": { order: string[], hidden: string[], style?: 'pill'|'underline'|'underline-compact' }, "styles": { level1?: TabStyle, level2?: TabStyle } }`.
- **Types.** `TabsSectionConfig` / `TabsConfig` / `TabStyle` / `TabStyleDefaults` are at frontend/src/api/media.ts:11-26.
- **Reserved key.** `styles` is not a section (nav:397, nav:414-415, settings.py:547-548).
- **Backend validation.** `normalize_tabs` at settings.py:562-615:
  - section and tab ids must match the slug `^[a-z0-9][a-z0-9_.-]{0,47}$` (settings.py:542);
  - at most 64 sections, ≤64 ids per list, ≤16 KB of JSON;
  - de-duplicates with first occurrence winning;
  - `order` and `hidden` are always present;
  - keys other than `order`, `hidden` and `style` give a 422;
  - `styles` takes only `level1`/`level2` from the three styles.
- **The backend does not know the registry.** A stored id is never checked against real tab ids (comment at settings.py:539-541).
- **Write.** `PATCH /settings` requires `system.configure` at installation scope. The whole `ui.tabs` value replaces the old one and is never merged (settings.py:852-864; test_ui_tabs_config.py:40-47). It is audited with the value.

### B2. Section-id → array mapping (the registry)

- `TAB_SECTIONS` (nav:1412-1427), in order: `areas, devices, security, security.live, security.investigate, explore, multimedia, wiskey, infra, infra.electricity, infra.generator, tickets, system, system.security`.
- `sectionIdOf` maps by **array identity** through a lazily built Map (nav:1452-1466): `DEVICES_TABS→devices`, `SECTION_TABS.live→security.live`, `SECTION_TABS.investigate→security.investigate`, `EXPLORE_TABS→explore`, `WISKEY_TABS→wiskey`, `MULTIMEDIA_TABS→multimedia`, `INFRA_TABS→infra`, `TICKETS_TABS→tickets`, `AREA_TABS.system→system`, `SECURITY_SETTINGS_TABS→system.security`.
- Sections handled outside `sectionIdOf`:
  - `security` (level 1, the Live/Investigate/Alarm sections): `configureTabs('security', list)` at nav:954, over `SECURITY_SECTIONS` (nav:834).
  - `areas` (the rail and bottom bar, `bar:false`): `configureTabs('areas', list, false)` at nav:1217, plus `defaultNavOrder()` at nav:1222-1226.
  - `infra.electricity` / `infra.generator`: `infraPageTabs` (nav:649), used by the infra screens (screens/infra-electricity.ts:103, screens/infra-generator.ts:169).
- `areaRowSection(area, section)` (nav:1432-1436): for the security area it returns `security.<section>`; for other areas it returns the area id if it is in `TAB_SECTIONS`.
- For tickets, `TAB_SECTIONS.tickets.tabs()` is `TICKETS_TABS` minus `external`, unless `EXTERNAL_PLACEMENT !== 'access'`. It is listed in the editor only while `ticketsModuleOn()` (nav:1424).
- **The nine settings sub-tabs (general … permissions) are not a `ui.tabs` section.** The system area section lists the system tabs, including a single `tickets` entry (nav:851-880). `system.security` has its own entry. This is relevant for any plan that turns the service-management settings into configurable tabs.
- **Order of operations in `visibleTabs`** (nav:1160-1175): external filter → `permittedTabs` (permissions, `TICKETS_OFF`, hidden hrefs, etc.) → `configureTabs(sectionIdOf(items), permitted)`. With no backend (`!api`) `ui.tabs` is not applied. `visibleTabs` and `sectionIdOf` rely on **identity** with `TICKETS_TABS` (nav:1163 uses `items === TICKETS_TABS`).

### B3. Rules: stale ids, new ids, hidden, locks

| Case | Behaviour | file:line |
|---|---|---|
| Stored `order` names an id that no longer exists | Ignored at render: `byId.get(id)` is undefined and skipped. The editor keeps it in `extraOrder`/`extraHidden`, so it survives saves. The server stores it (it cannot validate). | nav:499-504, system-tabs.ts:266-280, settings.py:539-541 |
| Stored `hidden` names a missing id | Ignored; `shown` only filters present items. | nav:507-508 |
| NEW tab id (not in stored order) | Appended after the named ones in default registry order, and it is visible (not hidden). | nav:505 |
| Section config empty (no order and no hidden) | The caller's items are returned untouched. | nav:496 |
| `hidden` would empty the row | The ordered permitted list is shown instead. "Hiding is not a lock-out." | nav:509 |
| `LOCKED_TABS` | `{ system: ['general'] }`: the way back to the tabs editor can never be hidden. | nav:484, nav:507-508 |
| Entry href of a section | The first visible tab once the section is configured, otherwise the default href if it is still a tab, else the first tab. | nav:514-519 |
| Devices migration | A stored `schedules` id is dropped from `devices` order and hidden (it became a segment of "קברניט"). | nav:401-405 |
| Normalize on read (frontend) | Accepts an object or a JSON string; slug-checks section and tab ids; dedups; a section with nothing to say is dropped; never throws. | nav:380-410 |
| Editor model | Shows registry ids in the draft's order, then the rest. A section equal to the default is deleted from the draft. The last visible tab's switch is disabled. | system-tabs.ts:250-280, 480 |

### B4. Level 1 vs level 2

- `TabLevel` is 1 or 2 (nav:421); the `level` field is on the section definition (nav:1387-1390).
- **Level 1** is the first bar of an area: `areas` (no bar), `devices`, `security` (the section strip), `explore`, `multimedia`, `wiskey`, `infra`, `tickets`, `system`.
- **Level 2** is the sub-tabs: `security.live`, `security.investigate`, `infra.electricity`, `infra.generator`, `system.security`.
- `tabStyleOf(sectionId, level?)` resolves: the section's own `style`, then `ui.tabs.styles.level1/2`, then built-in (L1 `pill`, L2 `underline-compact`) (nav:419, 467-471).
- The editor's L1 default choices are pill/underline and L2 choices are compact/underline/pill (system-tabs.ts:24).
- The level-1 row of an area (for example `tickets`) is rendered by `sw-app.renderChrome` with `rowStyle = tabStyleOf(areaRowSection(area, section))` (sw-app.ts:2727, 2822).

### B5. Editor screen

- **Location.** `<system-tabs-config>` is mounted at Settings › General › sub-tab `tabs`, address `#/system/diagnostics?tab=tabs` (frontend/src/screens/system-diagnostics.ts:107, 1604).
- **Gate.** The save button is enabled only if `r.can_edit && can('system.configure')`; non-admins see "נדרשת הרשאת מנהל מערכת" (system-tabs.ts:238, 511-514).
- **Contents.**
  - It renders `<system-tabs-mode>`, a "סגנון סרגל" card, then one card per `TAB_SECTIONS` entry whose `available()` is true (system-tabs.ts:500-507).
  - Each card has a style select, a list with a drag handle, ▲/▼ buttons and a visibility toggle per tab, and "אפס לברירת המחדל".
- **Save.** It does `patchSettings({'ui.tabs': payload()})`, `invalidateSettings()` and `applyTabsConfig`. The shell follows without a reload (system-tabs.ts:350-374).
- **How the shell loads it.** `applyTabsConfig` is called when product settings load (sw-app.ts:1680). `onTabsConfig` listeners re-render the nav; the tickets display name changing also fires them (nav:373-376, 478).

### B6. Presentation modes (`tabs` / `hybrid` / `dropdown`), frontend/src/shell/tabs-mode.ts

- **Modes and groups.**
  - `TabMode = tabs | hybrid | dropdown` (tabs-mode.ts:22).
  - `TabGroup = home | area | multimedia | security | settings` (:23, :33); the Hebrew labels are at :34.
- **Mode resolution.** `resolveTabMode(group)` is evaluated in this order (:238-245): user's group override, user's global, installation's group override, installation's global, then `tabs`.
- **What decides the mode.** `tabModeOf(group)` just returns that mode on every width (:251-253).
- **Hybrid.** `HYBRID_MAX_ITEMS = 3` (:38): up to three items stay a bar, more become a dropdown. This is used at sw-app.ts:2825.
- **Which group the tickets area belongs to.** `tabGroupOf(area)` (nav:1440-1446) returns `security` for security, `settings` for system, `multimedia` for multimedia, and `area` for everything else including `tickets`. The main rail and bottom bar are not a group.
- **Where the row gets its mode.** `rowModeProps` (sw-app.ts:2841-2845), then the `sw-tabs` with `variant`/`adaptive`/`dd-*` at sw-app.ts:2822.
- **Where it is stored.**
  - Installation: `ui.tabs_mode` (default `tabs`) and `ui.tabs_mode_groups`. They are set by `system-tabs-mode.ts:264` through `PATCH /settings` (settings.py:93-94, 655-656, 880-884).
  - User: the same keys in `/me/prefs` (me.py:132-133). Null means "follow the installation".
  - Backend validators: services/tabs_mode.py (MODES, GROUPS, normalize/stored).
  - The services/tabs_mode.py docstring still says "the frontend applies the mode on the phone only", but the frontend comment says it has applied on every width since 0.1.157 (tabs-mode.ts:10-14).
- **Dropdown look dials.** Style, size, ring, panel, phone and place each follow the same global-plus-per-group, installation-plus-user pattern (tabs-mode.ts:124-145, 256-278).
- **Settings navigation on a phone.** `ui.dd_settings_nav` (personal only, `tabs`/`dropdown`) is PHONENAV-295 (tabs-mode.ts:99-106).
- **The service-management settings strip does not use any of this.** `system-tickets.ts` imports nothing from tabs-mode; its strip is a fixed segmented tablist.

### B7. Per-user nav order

- **Ids.** `NAV_A` is the default order of the areas (nav:778-790): `devices, security, explore, multimedia, wiskey, infra, tickets`. `NAV_TAB_IDS` is derived from it (nav:794); `NavTabId` is at nav:793.
- **Frontend store.** frontend/src/shell/nav-order.ts:
  - `normalizeOrder` keeps known ids, drops duplicates and unknowns, then appends missing ones in the default order (:19-23), the same rule as the server.
  - `loadNavOrder`, `saveNavOrder` and `resetNavOrder` use `/me/prefs` `nav.order` (:92-148) with a per-user localStorage cache (`sw.nav.order`).
  - The effective order is `own ?? defaultNavOrder()` (:68). `defaultNavOrder` uses the admin's `ui.tabs.areas.order` (nav:1222-1226), and `onTabsConfig` refreshes users who have no own order (nav-order.ts:73-75).
- **Dialog.** `<sw-nav-order>` is the user-facing "סדר הלשוניות" dialog; the avatar item is fixed last (frontend/src/shell/sw-nav-order.ts:326, 346). It reorders areas only.
- **Server.** services/user_prefs.py:
  - `NAV_TAB_IDS` is a tuple that ends with `tickets` (:16-20).
  - `normalize_nav_order` is at :23-34.
  - The validators are at :38; `me.py:128` accepts `nav.order`.
  - A new area is appended last, so a stored order never moves.
  - Tests: test_media_api.py:511-512, test_tickets_module.py:143-144.
- **Not user-orderable.** The tabs inside an area (for example tickets scope tabs) have no per-user order. Only the admin `ui.tabs` order and hidden list apply. The rail's `areas` entry uses `reorder=false`, so the user's own order wins there (nav:1217).

---

## PART C. Tests that pin the current tickets tab list or routes

Because the tickets tab list is pinned by array **index** in several places, any insertion, removal or reorder of `TICKETS_TABS` entries will fail these.

### C1. The two files you named

**`frontend/tests/unit-tabset-registry.spec.ts`** (node only)
- :48-72 — every `AREA_TABS` area has a `TAB_SECTIONS` section and `sectionIdOf` finds it. In particular:
  - `sectionIdOf(TICKETS_TABS)==='tickets'` (:62);
  - `byId['tickets']` equals `ids(TICKETS_TABS)` without `external` (:67);
  - with `access.external.placement='both'`, `external` appears (:68-69);
  - section ids match the slug regex and are unique.
- :76-86 — with nothing configured, `visibleTabs(TICKETS_TABS, true, ALL)` ids equal all `TICKETS_TABS` ids minus `external`, after `applyTicketsHidden({'tickets.enabled':'true'})`.
- :130-138 — the tickets card is listed only while the area is on. `ui.tabs {tickets:{order:['all','mine'],hidden:['department']}}` gives a row starting `['all','mine']` without `department`.
- :140-149 — the registry words exist in he/en/ar/ru, and `tst('ticketsWhere',{name:'קריאות'},'he')==='לשוניות קריאות'`.

**`frontend/tests/uxrest-audit.spec.ts`:7** is an exploratory contrast and overflow audit. Its default route list includes `/tickets/mine, /tickets/board, /tickets/rfqs, /system/tickets, /system/messaging-accounts`. It asserts nothing about tab ids; it writes JSON to `docs/design/evidence/UXREST-295/`. It does not break on a restructure, but those routes need to still load. The same route lists are at `uxrest-focus.spec.ts:6` and `uxrest-states.spec.ts:8`, and neither asserts tab ids.

### C2. Specs that assert tab ids, order, hrefs, labels or counts

| Spec : line | What it asserts |
|---|---|
| unit-tickets-board.spec.ts:121-128 | `TICKETS_TABS` ids **exactly** `['overview','mine','department','board','all','handlers','rfqs','accounts','external']`; board label 'לוח מנהל'; `TAB_PERMISSIONS['#/tickets/board']==['tickets.manage']`; `activeAreaTab` for `/tickets/board` is `board` |
| unit-tickets-overview.spec.ts:267-274 | `TICKETS_TABS[0]` is `overview`, its href is `TICKETS_OVERVIEW_HREF`, label 'סקירה'; `TAB_PERMISSIONS[overview]==['tickets.manage']`; `tabAllowed` is false for `tickets.view`, true for `tickets.manage`; `activeAreaTab` is `overview` |
| unit-tickets-handlers.spec.ts:25-32 | `TICKETS_TABS[5]` is `handlers` (**index 5**), href `TICKETS_HANDLERS_HREF`, label 'מטפלים וספקים'; `TAB_PERMISSIONS[handlers]==['tickets.configure','tickets.manage']`; `activeAreaTab` is `handlers` |
| unit-tickets-rfq.spec.ts:265-270 | `rfqs` tab href `TICKETS_RFQS_HREF`, label 'בקשות הצעת מחיר'; `TICKETS_TABS.at(-2)` is `accounts` (**position from the end**); perms `['tickets.external','tickets.costs']`; `activeAreaTab` for `/tickets/rfqs?rfq=r1` is `rfqs` |
| unit-tickets-vendor-accounts.spec.ts:104-108 | last tab excluding `external` is `accounts`, label 'חשבון ספקים'; `TAB_PERMISSIONS['#/tickets/accounts']==['tickets.costs.view']`; `activeAreaTab` is `accounts` |
| unit-tickets-naming.spec.ts:102-127 | the system settings tab label follows the module name; `searchSettings` for 'מחלקות' finds `#/system/tickets?tab=departments`. **The full label list** of `visibleTabs(AREA_TABS.tickets,true,ALL)` equals `['סקירה','שלי','המחלקה','לוח מנהל','הכול','מטפלים וספקים','בקשות הצעת מחיר','חשבון ספקים']`. `tickets.view` alone gives `['mine','department']`; `tickets.create` alone gives `['mine']`. The settings tab needs `tickets.configure` at installation scope (false when not installation-scoped). |
| unit-tickets-model.spec.ts:35-50 | `listHref('mine')==='#/tickets/mine'`; department href with query; `listHref('all',…,{create:true})==='#/tickets/all?new=1'`; `areaOf('/tickets/mine')==='tickets'`; `activeAreaTab` is `department` / `all` / `mine` (bare `/tickets`) / `''` (a ticket id route) |
| unit-rfq-questions.spec.ts:104-111 | `TICKETS_TABS.find(id==='rfqs')` gets `badge=3` and `alert=true`; `areaBadge('tickets')===3` |
| unit-tickets-ui6.spec.ts:33-41 | `SETTINGS_TABS` equals `['general','departments','locations','display','channel','messages','costs','rules','permissions']` (test title says "eight" but nine are listed). `visibleTabs` per permission: none → `['general','departments','permissions']`; `tickets.configure` → `['general','departments','locations','messages','permissions']`; `system.configure` → `['general','departments','display','channel','costs','rules','permissions']`; demo → all. `isSettingsTab('display')` is true, `isSettingsTab('contacts')` is false. |
| unit-tickets-ui6.spec.ts:57 | source-scan: `system-tickets.ts`, `settings-tabs.ts`, etc. must not contain the Hebrew word "קריאה/ות/ת" |
| unit-tickets-rules.spec.ts:107-111 | `SETTINGS_TABS` contains `rules`; `tickets.configure` alone does NOT get it; `system.configure` does |
| unit-reports-settings.spec.ts:68-73 | source-scan: `settings-channel.ts` contains `<tickets-reports-settings>`; `settings-tabs.ts` matches `/t === 'channel'[^?]*\? system/` (a regex on the source of `visibleTabs`) |
| unit-tabs-config.spec.ts:112,114,158 | `TAB_SECTIONS` ids exactly the 14-item list (includes `tickets`); `byId['areas']` is `['devices','security','explore','multimedia','wiskey','infra','tickets']`; `defaultNavOrder` is `['explore','security','devices','multimedia','wiskey','infra','tickets']` under a config |
| unit-messaging-accounts.spec.ts:122 | `TAB_PERMISSIONS['#/system/messaging-accounts']==['system.configure','messaging.accounts.manage']` |
| evidence-tickets-ui6.spec.ts:226-269 | 9 tabs exist and are clickable, each with its wait selector. `[data-tickets-settings-tabs] [role=tab]` count is 9. Display tab asserts counts: `[data-ui-detail]`×3, `[data-ui-new]`×2, `[data-long-press]`×1; clicking `dialog` PUTs `tickets/settings` with `{ui:{new_ticket:'dialog'}}`. General has `[data-card="links"]`, `hours`, `tickets-public-card`, and **no** `[data-card="display"]`. Keyboard test: arrow keys move General→Departments (RTL), End goes to permissions, one tab stop. |
| evidence-tickets-s5b.spec.ts:216-224 | on desktop the strip contains the texts 'ערוץ הודעות' and 'תבניות הודעה' |
| evidence-tickets-handlers.spec.ts:152-167 | readiness hrefs `#/system/tickets` (page_off, address) and `#/system/tickets?tab=channel` (switch); `system-tickets [data-card="handlers-link"] [data-to-handlers]` has href `#/tickets/handlers`; no tab with text 'ספקים ואנשי קשר'; `/system/tickets?tab=contacts` lands on `#/tickets/handlers?seg=vendors` |
| evidence-tickets.spec.ts:138-150, 165-192 | `[data-nav="tickets"]` count is 0 while the module is off; with a renamed module its `aria-label` is 'תקלות'. Settings general/departments/permissions render (`[data-name-editor]`, `[data-dept="dept-maintenance"]`, `[data-holder]`). With the module off, `[data-name-editor]` has count 0. |
| evidence-tickets-s2.spec.ts:45,63,89,105,124,131,143,150 | drives `/system/tickets`, `?tab=departments`, `?tab=permissions` |
| evidence-tickets-board.spec.ts:144,149; evidence-tickets-overview-p5.spec.ts:20; evidence-camera-viewfinder.spec.ts:175 | open `/system/tickets?tab=display` |
| layout-tickets.spec.ts:28-40 | layout sweeps for `/tickets/mine` (+ `?t=…`, `?new=1`) and for `/system/tickets`, `?tab=departments`, `?tab=permissions` |
| layout-dd-place.spec.ts:42-43, 259-263 | tickets area `/tickets/mine` and settings `/system/tickets` each need one chip. `DD_PLACE_DECLINED_SCREENS` equals `{'/system/tickets':['2','3','4']}`. |
| layout-uxfix-nav-295.spec.ts:59, 76 | route lists include `/tickets/all` |
| tk260-expand-nav.spec.ts:32-53 | `#/tickets/mine?t=<id>` → full screen `#/tickets/<id>` |
| evidence-tickets-s4.spec.ts, evidence-tickets-ui6.spec.ts:149-219, evidence-tickets-handlers.spec.ts | `/tickets/handlers` and `?seg=vendors|contacts` routes |
| evidence-tickets-rfq4.spec.ts:149 | `[data-rfq-origin]` href is `#/tickets/rfqs?rfq=<id>` |
| many other evidence-tickets-* and layout-tickets-* specs | Drive `#/tickets/mine`, `/all?t=…&tab=costs|conv|overview`, `/tickets/board`; there `?tab=` is the **ticket drawer** tab (conv/costs/overview/history), not a settings tab. I did not enumerate every line. |

Other files matched on the generic `visibleTabs(` pattern (`unit-schedules-nav`, `unit-automations-list`, `unit-elevators`, `unit-generator`, `unit-temperature`, `unit-nvr-cameras-logic`, `unit-wiskey-switches`, `unit-security-public`, `unit-capabilities`, `unit-media-players-layout`, `unit-settings-index`) do not assert tickets tabs.

### C3. Backend tests

| Test | What it pins |
|---|---|
| backend/tests/test_ui_tabs_config.py:20-49 | default `ui.tabs` is `{}` (object, not a string); the round-trip normalizes (dedupes, fills `hidden: []`); the whole value is replaced; `{}` clears; an audit row carries the value |
| test_ui_tabs_config.py:~60-95 | 422 for bad shapes and ids (upper case, unicode, `a/b`, 49 chars, unknown keys, non-lists); size caps (64 sections, 64 ids per list, 16 KB) |
| test_tabs_mode.py:18-88 | the tabs-mode validator, installation PATCH (403 for a non-admin), `/me/prefs` null handling |
| test_media_api.py:511-512 | `NAV_TAB_IDS == ('devices','security','explore','multimedia','wiskey','infra','tickets')`; `normalize_nav_order(['wiskey','devices'])` appends the rest |
| test_tickets_module.py:143-144 | `NAV_TAB_IDS[-1]=='tickets'`; `normalize_nav_order(['infra','devices'])[-1]=='tickets'` |
| test_nav_size.py:92 | default `/me/prefs` `nav.order` list |
| test_home_screen.py:599-614 | `nav.order` writes and rejects |
| test_migrations.py:46 | a legacy `nav.order` row is still readable |

No backend test knows the tickets tab ids (the backend only sees slugs).

---

## PART D. Inbound links into `#/tickets/*` and `#/system/tickets`

### D1. Server-side senders (`link` stored in the notification row at emit time)

`notify._default_link` supplies the default and is called when the row is inserted (notify.py:98-112, :303), so the string is **persisted in `notifications.link`**. Old rows keep whatever href they were created with.

| Link | Who sends it | When | file:line |
|---|---|---|---|
| `#/tickets/<ticket_id>` | `notify._default_link` for `subject_kind='ticket'`. Used by every `ticket.*` source (new_unassigned, assigned, reminder, stuck, returned, question, done, reply_unmatched, send_failed, contact_changed, cost_submitted, cost_missing). | on a ticket event; the assignee's one-tap "received" is there | notify.py:110; notify_bridge.py:7; tickets/notify_sources.py:31-43 |
| `#/tickets` (no id) | the same default when `subject_id` is empty | | notify.py:110 |
| `#/tickets/rfqs?rfq=<rfq_id>` or `#/tickets/rfqs` | `_default_link` for `subject_kind='rfq'`. Sources `rfq.quote_received/declined/question/due_passed/arrival/question_unanswered/instalment_overdue/vendor_postponement/instalment_due_tomorrow`. | RFQ events | notify.py:111; tickets/rfq_notify.py:21,191; notify_sources.py:56-82 |
| `#/tickets/overview` | `ticket.dash_digest`, the manager's personal morning summary | janitor, weekdays, at/after the configured hour | tickets/dashboard_alerts.py:176 |
| `#/tickets/overview?dept=<dept_id>` | `ticket.dash_busy_department`, busy-department alert (off by default) | when a department's stuck count ≥ threshold | dashboard_alerts.py:189 |
| `#/tickets` | `ticket.digest` (notify-matrix daily digest). Origin carries `ticket_id`, `department_id`; the `subject_id` is the first ticket, but an explicit link overrides the default. | digest slot per user per department | tickets/notify_matrix.py:262 (test: test_tickets_notify_matrix.py:132) |
| `#/tickets/handlers?seg=review` | "needs review" yearly/periodic reminder (`REPORT_LINK`) | needs_review reminder | services/needs_review.py:48, 233-234 |
| `#/tickets/handlers?seg=vendors` | `ticket.portal_tech_request`, a vendor-portal technician-update request awaiting approval | a vendor submits the request | tickets/portal_more.py:312-314 |
| `#/system/tickets` | `ticket.channel_down`, WhatsApp account disconnected (installation level, `subject_kind='system'`) | channel state changes | tickets/notify_bridge.py:398-400 |
| `#/tickets` | `ticket.staff_mobile`, the user's own mobile for no-login work links was marked or changed | an admin marks or edits the mobile | tickets/staff_links.py:368-372; tickets/phone_verify.py:432-437 |
| `#/tickets/external` or `#/wiskey/external` (+ `?grant=<id>`, `?digest=1`) | the external-access screen, depending on `access.external.placement` | external-access events | services/access_external.py:152-160, 461, 668; access_grants.py:2817-2821 (test: test_sharedid_293.py:309) |

Backend tests that pin these: test_tickets_monitor.py:79 (`#/tickets/<id>`), test_tickets_mgrdash_alerts.py:107 (`#/tickets/overview`), test_tickets_notify_matrix.py:132 (`#/tickets`), test_tickets_rfq_notify.py:83 (`#/tickets/rfqs?rfq=<id>`), test_sharedid_293.py:309.

### D2. Push / companion deep links

| Link | Who | When | file:line |
|---|---|---|---|
| Web-push payload `url` is `#/notifications/<notification_id>`, plus `tag=arx-n-<id>` | notification channel `notify_channels` builds every in-app notification push (including ticket ones) | each push | notify_channels.py:239 |
| Service worker `notificationclick` opens `data.url` through `openTarget`; ack/snooze are POSTed with one-time tokens | PWA | on tap | frontend/src/pwa/sw.ts:246-257 |
| The shell parses the `#/notifications/<id>` hash and focuses that row in the notification center | frontend | on load | frontend/src/shell/sw-app.ts:1732 |
| From the center, "open" navigates to the row's stored `n.link` | frontend | on action | frontend/src/components/notify-center.ts:613 |
| The digest detail shows `#/tickets/<ticket_id>` per item | frontend | rendering a digest notification | frontend/src/components/notify-detail.ts:312 |
| Mock mirrors the server: `ticket → #/tickets/<id>`, `rfq → #/tickets/rfqs?rfq=<id>` | demo | | frontend/src/api/notifications-mock.ts:89-90 |
| Door action URL `#/doors/<id>?confirm=<nid>` (not tickets) | | | notify_channels.py:255 |
| Test push is `#/system/notifications` | | | notify_channels.py:409; push.py:618 |
| Home Assistant Companion tickets deep link | UNKNOWN. I found no code that sends HA companion pushes with a tickets URL. `companion` is only a reserved settings flag (`critical_sound_safety`, notify_settings.py:109, 119). | | |

So no ticket push goes to `#/tickets/...` directly. The click lands on `#/notifications/<id>`, and the row's stored `link` is followed from there. That makes the persisted `link` strings the real compatibility surface.

### D3. Frontend-internal senders (non-exhaustive)

- `ST:393,744` (settings to handlers); `readiness-model.ts:10-25`; `handlers-members.ts:439`; `tickets-list.ts:460`.
- RFQ board and compare to ticket ids, `/tickets/handlers?seg=vendors`, `/tickets/rfqs` (`rfq-board.ts:266,277,312,645`, `rfq-new.ts:374,420`, `rfq-compare.ts:546`, `rfq-model.ts:419,447`, `rfq-order.ts:179`).
- Overview rows: `#/tickets/overview?…`, `#/tickets/accounts`, `…&tab=costs` (`screens/tickets-overview.ts:665,882,918,961,974`).
- Handlers screen: `#/tickets/board?pane=handlers` (`screens/tickets-handlers.ts:44`).
- Temperature detail links to a ticket id (`frontend/src/temperature/detail.ts:428`).
- The calendar view, vendor accounts, tickets-table and the drawer expand all use `#/tickets/<id>`.

### D4. Non-hash public links

Vendor and handler pages use `<base_url>/<path_prefix>/<token>`. The default prefix is `support`, legacy `/t/<token>` is kept through `public.legacy_t_paths`, and e-mail redeem uses `/t/r/<rid>` (tickets/links.py:248-277; handler_links.py:115-120; public_http.py:326, 354). These sit outside the SPA hash router, so a hash-route rename does not affect them.

### D5. The existing redirect mechanism (how old hrefs are mapped today)

| Piece | What it does | file:line |
|---|---|---|
| `legacyRedirect(route, access?)` | Returns a new path (`/…`, query preserved) or null. Handles `explore/entities → system/entities` (permission-aware: `system.configure` goes to settings, others to the map, null while the session is loading), `system/devices → /investigate/health`, and `system?tab=alarm → /system/security/manage`. It runs with and without a backend. | nav:1351-1372 |
| `demoRedirect(path, api)` | Only `/investigate/rules/<id> → /investigate/rules` with a backend | nav:1314-1318 |
| Caller 1: `redirectDemo(route)` | Checks kiosk, then `legacyRedirect`, then `demoRedirect`; applies the result with `window.location.replace('#'+target)`. | sw-app.ts:2177-2189; called at :1645 and in the route handler at :1742 |
| Caller 2: `renderRoute` safety net | Calls `legacyRedirect` again and replaces the location in a microtask. | sw-app.ts:2287-2291 |
| `legacyAccess()` | `{api, ready: mode!=='loading', can: canNav}` | sw-app.ts:2192-2194 |
| Tickets-specific redirects | (a) `#/tickets` and any unknown second segment fall to the first visible tab of `AREA_TABS.tickets`, default `#/tickets/mine` (sw-app.ts:2423-2426). (b) A 16-hex segment is the ticket detail (`isTicketId`, tickets/model.ts:21-23; sw-app.ts:2413). (c) `?tab=contacts` is handled inside the settings screen, not in `legacyRedirect` (ST:391-395). (d) `tickets-handlers` accepts only `?seg=` among `REVIEW_SEGMENTS` and falls back to `handlers` (tickets-handlers.ts:184-194). | |
| `START_ROUTES` | `{explore, live, wall, events, playback, devices}` only. There is no tickets start route. | nav:1017 |
| `landingTarget(start, api, can, order)` | Keeps the start route if it is one of the area's visible tabs and the area is in the rail, otherwise goes to the first visible area. The tickets area is excluded unless the module is on. | nav:1238-1246; used at sw-app.ts:1687,1692 |
| `parseRouteLite` / router modes | The `tickets` mode is in `MODES` | nav:1249-1253; frontend/src/router.ts:9,18 |
| `activeAreaTab` for tickets | `overview/department/all/board/handlers/accounts/rfqs/external` map to themselves; a missing second segment or `mine` is `mine`; anything else (a ticket id) is `''`. | nav:919-921 |
| `crumbsOf` | Takes the label of the tab found by `activeAreaTab` from `AREA_TABS[area]` | nav:930-943 |

Implications from the code (not guesses):
- There is no generic old-to-new map table. Redirects are hand-written `if` branches inside `legacyRedirect`.
- A new tickets href map would plug in next to those branches.
- Any renamed route must stay reachable for the `link` strings already stored in `notifications` rows, for bookmarks, and for the test specs in Part C.