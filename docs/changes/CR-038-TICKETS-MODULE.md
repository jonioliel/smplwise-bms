# CR-038 — Tickets (קריאות שירות): an optional fault-management module with external handler links and a WhatsApp channel

**Numbering:** CR-038 is the next free number on 2026-10-13. Checked: `docs/changes/` on `origin/main` (highest CR-036), every
`origin/integ/*` and `origin/pilot/*` branch (CR-035 on `pilot/WISKEY-importer`, CR-036 notes on `integ/248`/`integ/249`,
**CR-037 on `pilot/ST8-ifc`**), and a text search for `CR-038`..`CR-049` in `docs/`, `management/`, `private/` on every remote
branch (no hit).

**Status:** **APPROVED FOR BUILD by the owner on 2026-10-13** (spec r2.4 and the mock-up v2 served on port 8796 during the
review). Still a design: no product code, no migration file, no test exists yet. **D31 (vendor cost claims, section 11A)
was added after the approval** and the owner answered its four questions the same day (D32). Branch `pilot/TICKETS-spec` (from `origin/main`
at `b26c1b7d`, release 2.4.8). Nothing here has been run against a real Home Assistant, a real `ha-whatsapp` installation, a real
phone or a real Cloudflare tunnel. Every claim about existing code below was read in the repository at that commit (or on the
named branch) and cites the file; every claim about `ha-whatsapp` was read on its public documentation pages on 2026-10-13
(`faserf.github.io/ha-whatsapp/` - services, events, webhooks, limitations) and is marked `[WA-DOC]`. Facts that need a live
check are marked **UNVERIFIED**.

**Owner requirements:** the binding brief of 2026-10-13 (recorded in section 1) and the owner's decisions of 2026-10-13 on the
independent review (section 1A). First release = scope "B": everything except automatic creation from alert/automation rules,
for which only the hook is designed (section 18).

**Revision history:**
- r1 (2026-10-13, `b1dddd59`): first design, 14 open questions.
- r2 (2026-10-13): the independent security/design review (`private/planning/TICKETS_SPEC_REVIEW_2026-10-13.md`, read-only,
  not in the repository) and the owner's decisions on it are folded in: public-listener isolation, department-scoping holes,
  safe data-exposure defaults, link lifecycle (sliding expiry, grace, durations in Settings), inbound robustness, e-mail link
  transport, log/SSRF/idempotency/text hygiene; the new requirement **WhatsApp account selection per use** (section 9.9);
  migrations, slices and effort re-estimated (section 20). Every review item and where it is handled: section 1B. Items still
  open: section 22.
- r2.1 (2026-10-13): owner decision D17 - two long-press behaviours selectable in Settings (12.1).
- r2.2 (2026-10-13): owner decisions D18-D24 - display settings of the tickets screens, three-level control of device
  history for vendors, and a first-class board table view (13.6); open questions now OQ1-OQ5.
- r2.3 (2026-10-13): owner decisions D25-D29 close OQ1-OQ5: `tickets.external` restored as a separate sensitive
  permission, grantable to one specific user (8.2); vendor-page languages; queued messages follow an account change; urgent
  quiet-hours bypass as an installation + department setting; "send now" for holders of `tickets.external`. No owner
  question remains open (22).
- r2.4 (2026-10-13): owner decision D30 (the board's area tree can be hidden per user). **Owner approval of the spec and
  of mock-up v2 (port 8796) for development.**
- r2.5 (2026-10-13): owner requirement D31 - cost claims from external vendors (section 11A), migration 0083, two new
  sensitive permissions, slice 9; owner questions CQ1-CQ4.
- r2.6 (2026-10-13): owner answers on D31 (D32) - claim requirement chosen per assignment (default optional), 7-year
  retention, one approver with a configurable high-amount flag, VAT included / excluded chosen by the vendor per claim,
  camera capture of invoices on the vendor page (multi-page, client-side cleanup), OCR hook. No owner question is open.
- r2.7 (2026-10-13): owner requirement D33 - the module's user-facing name is a setting (14.3); internal ids stay `tickets`.

**Related:** CR-018 (notification core: sources, recipients, escalation - the module's internal alerts ride on it), CR-008
(remote access through a Cloudflare tunnel, the threat model of a public surface), CR-028 (the cast relay: the precedent for a
separate unauthenticated listener), CR-027 (device tokens: store only a hash, failure counters), CR-032 (device activity: the
24-hour history the ticket captures), CR-036 slice WA (WhatsApp from the people screen: the precedent for a send envelope,
outcome classes and pacing), WXPERM (`docs/changes/WXPERM-ACCESS-PERMISSIONS-NOTES.md` on `origin/pilot/WXPERM`: every gate is a
permission, organization-defined roles), `docs/security/HA_IDENTITY_RBAC_HE.md`, memory note "data-store direction" (owner
decision 2026-10-01: the database engine is decided when ticketing is specified - Q11, decided by D16: the same SQLite file behind a storage layer).

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
10. (added 2026-10-13, after the review) **WhatsApp account selection.** The owner runs `ha-whatsapp` with possibly several
    linked numbers. In Settings the owner chooses, per use, which linked account sends: ticket messages (installation default),
    an optional per-department override, and the verification-code messages (default = the installation's ticket account);
    other modules can register their own uses later. The account list is read from what `ha-whatsapp` exposes in Home
    Assistant, with a manual-entry fallback; each account shows its connection state; pacing is per account (a number shared by
    two uses shares one budget); a warning when a ticket account is also used for something else; changing or losing an
    account never causes a silent resend, and an `unknown` outcome stays `unknown`. Changing the mapping is a sensitive
    permission. Design: section 9.9.

## 1A. Owner decisions of 2026-10-13 (binding)

| # | Decision | Where in this CR |
|---|---|---|
| D1 | All five blocks of the review's required changes are accepted: (1) isolate the public listener's resources; (2) close the department-scoping visibility and escalation holes; (3) safe data-exposure defaults; (4) link lifecycle; (5) inbound robustness and transport gaps - **plus** the lower-ranked required items (SSRF rules, e-mail link transport, log/error hygiene, idempotency storage, text hygiene, internal attachment body limit + security note, time-zone rule). | 1B (item by item) |
| D2 | Verification code = **6 digits**. A 4-digit code is never offered (not even as a setting). | 10.5, 14.1 (`code.length` is fixed, not a setting) |
| D3 | Device history on the handler page is **OFF by default**, opt-in (refined by D23), and **never** for the `lock`, `alarm_control_panel`, `cover` and `camera` domains whatever the switch says. | 7.1 (`share_history_external DEFAULT 0`), 12.3 |
| D4 | Vendor-facing **send hours**, default 07:00-21:00 in the installation's time zone, configurable per installation and per department; reminders and other non-urgent vendor messages respect them (also for `critical`); manager alerts are not affected. | 9.2, 14.1 |
| D5 | Link lifetime = **sliding expiry**, capped at **90 days** from minting by default, with a **24-hour read-only grace** after close; the sliding window (days), the cap (days) and the grace (hours) are **changeable in Settings**, with a per-department override. | 10.2, 10.7, 14.1, 7.1 |
| D6 | (Q12, the review's rule) If the handler link went by the e-mail fallback, the verification code must go by WhatsApp; if that is impossible, the assignment is refused for code-protected assignments. | 9.5, 10.5 |
| D7 | (Q7) Calendar time for the SLA clock in release 1; vendor send hours (D4) are in release 1; working-hours SLA calendars later. | 13.1 |
| D8 | (Q8) Resolved by D3. | 12.3 |
| D9 | WhatsApp account selection per use (item 10 above) is part of release 1; the account mapping is gated by a **sensitive** permission. | 9.9, 8 |
| D10 | Statuses stay: new → sent → received → in progress → waiting for a part → done (by the assignee) → closed (by a manager only). A **per-department setting** (Settings) may merge done/closed: **automatic close N days after "done"** (option B). Default = the two-step version (a manager closes). Replaces r1's Q6 / `require_manager_close`. | 11.1, 11.2, 7.1 (`auto_close_after_days`) |
| D11 | Stuck rules stay as designed (no update after X, unassigned after X) **plus "link not opened after 24 h"**; **every** threshold is editable in Settings per department x priority. | 13.1, 7.1 (`link_unopened_min`) |
| D12 | The handler page has a **"לא שלי" (not mine)** button: it returns the ticket to the manager and revokes the link, and it **requires a free-text reason**. | 10.3, 10.7, 11.2 |
| D13 | Fallback when WhatsApp is down: in-app notification (internal users and the managers), e-mail for contacts with an address, "copy link" for the others. **SMS is a future work item** (not in release 1); the channel interface is ready for it. | 9.5, 18A |
| D14 | The timeline shows "נשלח - מסירה לא ידועה" (sent, delivery unknown) and "הקישור נפתח ב-<time>" (link opened at). | 9.7, 14.2 |
| D15 | Permissions as drawn in the mock-up: view (also gates the device tab), create, manage, see all departments, settings; r1's `tickets.handle` and `tickets.contacts.manage` are folded into them (section 8). **The folding of `tickets.external` is reversed by D25.** The WhatsApp account mapping (D9) is a separate, installation-level messaging permission. | 8 |
| D16 | All other earlier mock-up / r1 questions keep the recommended defaults: own menu area (Q1), dedicated address and listener (Q2), long press opens the device window with the "קריאות" tab (Q3; refined by D17), internal users sign in (Q4), dedicated WhatsApp number recommended (Q5), replies change only received / in progress + notes (Q9), keep closed tickets 2 years (Q10), same database behind a storage layer (Q11), one running number (Q13), no automatic replies (Q14). | 22 |
| D17 | Long press on a device has **two behaviours, chosen in Settings** (installation setting, Settings › קריאות שירות › כללי): (a) **default = today's behaviour** - the long press opens the device window (activity sheet) whose last tab is "קריאות" with the create action; (b) the mock-up's behaviour - the long press opens a small **opaque** menu: "פתיחת קריאה", "הקריאות של הרכיב", "פתיחת המכשיר", "היסטוריה". Nothing changes for customers who do not use the module. Refines Q3 / D16. | 12.1, 14.1 |
| D18 | Ticket details open in a **drawer with an "open full screen" button** (default). Setting: drawer / full screen / drawer + full-screen button. | 13.7, 14.1 `ui.detail` |
| D19 | Floors on the board: default = a **side tree of areas** (collapsible, hidden on phone). Setting: chips only / side tree / chips + tree behind the filter button. | 13.7, 14.1 `ui.board_floors` |
| D20 | Grouping into ממתין לי / תקועות / בטיפול: default = **only when no status filter is active**. Setting: always / only without status filter / never. | 13.7, 14.1 `ui.grouping` |
| D21 | The state strip shows **"סגורות (הכול)"** by default instead of "נסגרו השבוע". Setting: this week / all closed / hidden. | 13.7, 14.1 `ui.closed_strip` |
| D22 | New ticket opens in a **side sheet** (default). Setting: side sheet / centred dialog. | 13.7, 14.1 `ui.new_ticket` |
| D23 | Device history for the vendor has **three control levels**: per department (default off), per vendor, and a per-ticket checkbox in the assign dialog; **never** for lock / alarm panel / cover / camera. | 12.3, 7.1, 7.2 |
| D24 | The board's **table view is first-class**: views cards (default) / table / kanban, remembered per user; sortable columns, sticky header, column chooser, saved filters, multi-select with bulk actions (assign, remind, change priority, close), inline status / assignee change, CSV export, keyboard navigation, density toggle, compact list on a phone; server-side sort / filter / pagination through the single `visible()` gate. | 13.6, 8.1, 20 (slice 6b) |
| D25 | Sending a ticket to an **external** contact / vendor is a **separate sensitive permission** `tickets.external` (restored; r2's folding into manage reversed). Every `tickets.*` permission (view, create, manage, all departments, external, settings) can be given to **one specific user**, in addition to roles, with audit. | 8, 8.2 |
| D26 | Vendor page and messages in **Hebrew, English, Arabic or Russian**, chosen per contact. | 7.1, 7.2, 9.7, 10.7 |
| D27 | Messages still queued when the ticket WhatsApp account changes **leave from the new account**; an `unknown` outcome is never re-sent silently. | 9.9.4 |
| D28 | Urgent tickets **pass the managers' quiet hours by default**; a setting with an installation default and a per-department override. | 7.1, 13.4, 14.1 |
| D29 | The first assignment message outside vendor send hours **waits for the morning**; "שלח עכשיו" is available to **anyone holding `tickets.external`** who can see the ticket (also a user granted it individually), not only to managers. | 9.2, 8.1 |
| D30 | The board's side **area tree is hideable by each user** (a hide / show control on the board, remembered per user) and can be turned **fully off** by the installation setting (`board_floors = chips`) - the tree is not relevant for every customer. Effort: negligible (inside slice 6). | 13.7 |
| D31 | After an **external** vendor reports done, the vendor submits a **cost claim** (lines: labor hours x rate, parts, travel, other; currency default ILS; VAT handling; auto total; notes; invoice / receipt as photo or PDF; optional invoice number); the manager approves, approves with adjustment, or rejects back to the vendor; revisions never overwritten; status none / submitted / approved / rejected / paid with a manual "mark as paid"; no payment integration (hook only); reporting and CSV; a required claim blocks closing unless overridden with a reason; new sensitive permission(s), grantable per user. | 11A |
| D32 | Owner answers on D31: (1) **cost claim required / optional / off is chosen per assignment** by the manager in the assign dialog, preselected from vendor → department → installation default **optional**; (2) claims and invoices kept **7 years**; (3) **one approver**, high-amount flag above a configurable amount (default 10,000 ILS); (4) the **vendor chooses per claim** whether entered amounts include or exclude VAT (default from the vendor record), the server computes the other figure; the vendor can **photograph invoices with the phone camera** on the page (multi-page, retake, crop / rotate / contrast on the client, compressed images, server re-encode, assembled document view for the manager); OCR is a future task with a hook. | 11A |
| D33 | The module's **user-facing name is configurable** (singular / plural per language, default "קריאה" / "קריאות"), edited in Settings with the settings permission; every user-facing text uses it; internal identifiers stay `tickets`. | 14.3 |

D18-D22 (and D17) are **installation settings** under Settings › קריאות שירות › כללי (`system.configure`); the per-user
choices of D24 (view, columns, density, sort, saved filters) are personal and stored per user.

Earlier owner choices that stand (brief of 2026-10-13): token link by default + per-vendor verification-code option; the
assignee sets status / notes / photos / ETA and cannot reassign (handling returns to the manager); stuck thresholds per
department x priority; dynamic departments; role-based permissions with some managers seeing all departments; the device tab
"קריאות" after the existing tabs, visible only with the ticket-view permission; release-1 scope B (hook only for rule-based
creation).

## 1B. Review disposition (every item of the review and where it is handled)

Review numbering: T = threat table, C = contradiction with code, G = daily-use gap, R = ranked required change (review 4.1),
N = nice-to-have (review 4.2). "Adopted" = in release 1; "Backlog" = recorded in section 18A, not built in release 1.

| Item | Disposition | Section |
|---|---|---|
| R1 / T17 / C1 - listener resources | Adopted: own thread + own event loop + own threadpool limiter; `access_log=False`, `server_header=False`, `limit_concurrency=16`, `timeout_keep_alive=5`, no signal capture; body read deadline; rate limit before any DB read; one in-flight upload per link; Cloudflare rate-limit rule as a required install step | 5, 10.1, 10.2 |
| R1 / T7 / C2 - uploads | Adopted: own decode semaphore in `attachments.py`; 16 MP budget; JPEG via `draft()`; 8 MiB cap; **no WebP**; whole decode in `try/except`; storage cap checked before decode; data volume | 10.6 |
| R2 / T18 / C7 - visibility | Adopted: placeless tickets authorised on "any held scope" (`rbac.permissions_anywhere`); internal notes member/manager-only; `by-entity` requires `devices.read` on the entity; assignee picker visibility stated | 8 |
| R2 / T19 / C17 - escalation | Adopted: `tickets.configure` (the "settings" permission, which also manages the contact directory) sensitive; `tickets.external` sensitive (D25); member edits only in departments one already manages (or with `tickets.all_departments`); template edits audited with a diff; contact assignment refused for a contact row with `user_id` (409 `assignee_not_allowed`); a contact's phone change revokes its live links and signals managers | 8, 8.1, 15.2 |
| R3 / T14 - device history | Adopted as D3 | 12.3 |
| R3 / T15 - photo visibility | Adopted: `ticket_attachments.visible_external` (manager uploads internal by default, the assignee's own external) | 7.1, 10.3 |
| R3 / T13 - PII | Adopted: ambiguous reply text shown only after a manager claims it; the assign dialog previews the exact outgoing text; `tickets.enabled`, `tickets.settings`, `messaging.whatsapp` in `backup.SETTINGS_KEEP`; `{department}` next to the number | 9.6, 9.7, 7.4 |
| R3 / C4 - backup | Adopted (same as above); the CR-036 `access.messaging` gap is recorded for that CR, not fixed here | 7.4 |
| R4 / C10 / C11 / G - link lifetime | Adopted as D5: sliding expiry, initial expiry >= the priority's resolve window, cap, 24 h read-only grace | 10.2, 10.7 |
| R4 / C9 / T5b - code budget | Adopted: codes excluded from the per-recipient message cap; own caps | 9.2, 10.5 |
| R5 / T12 - inbound | Adopted: late replies become flagged late notes (no status change), not drops; nonce path works without a phone number (LID); slice 5b's live check records the real `sender_number` / `timestamp` / `entry_id` shapes before the matcher is final | 9.6, 19 |
| R6 / T11 - SSRF | Adopted: address probe validated (https, hostname, no private/loopback/link-local/hassio targets), `follow_redirects=False`, 5 s, body never shown, local-only (`BLOCKED_ON_REMOTE`); inbound `media_url` is never fetched (a rule) | 14.2, 9.6 |
| R7 / T3(2) - e-mail link | Adopted: e-mail carries a **redeem link** (`/t/r/<id>`) whose GET is a static page; the token is released only by a button press, at most 3 times within 24 h; stated as weaker in the guide | 10.2, 9.5 |
| R8 / T16 - logs | Adopted: public app's own 422 envelope without `input`; uvicorn access log off, "Invalid HTTP request" records dropped by a filter; log-scan test covers uvicorn loggers; `httpx` at WARNING | 10.4, 17, 19 |
| R9 / T22 - idempotency | Adopted: table `ticket_requests` (24 h) | 7.1, 10.3 |
| R10 / T9 - text hygiene | Adopted: strip Unicode `Cc` and `Cf` from every text field on both surfaces; no auto-linkify anywhere; never `unsafeHTML` | 16 |
| R11 / C3 / C13 | Adopted: `body_limit.LIMITS` row for the internal attachment route; a `docs/security/` note for the token-authorised media exception (written in slice 4) | 10.6, 20 |
| R12 / C12 - time zone | Adopted: installation `time.zone` on the page, in messages and in send hours | 10.7, 9.7 |
| T1(a) - `CF-Connecting-IP` | Adopted: trusted only when the peer is inside `trusted_proxy_cidrs` (default the hassio network `172.30.32.0/23`), else the peer address | 10.2 |
| T1(b) - 429 text | Adopted: 429 shows "נסו שוב בעוד דקה", never the "unavailable" text | 10.2 |
| T2 | Adopted: rate-limit check before the DB read | 10.2 |
| T3(3) | Adopted: "סיום" button forgets the token in the tab | 10.7 |
| T3(4) | Adopted: the recorder exclusion of `whatsapp_message_*` events is a **required** install step | 20 (slice 8) |
| T4 | Adopted: "require code" per assignment as well as per contact (raise only); forwarding documented as the expected use | 10.5 |
| T5(a) | Adopted: the lock card has a one-tap "שלח קישור חדש" | 10.5 |
| T6 | Adopted: Cloudflare rate-limiting rule (required install step) | 20 (slice 8) |
| T8 | Adopted: cap checked before decode (cached directory size, 60 s), data volume | 10.6 |
| T10 | No change needed (no `Sec-Fetch-Site` reliance) | 16 |
| T20 | Recorded as residual: an HA add-on backup holds the key and the DB | 7.4, 16 |
| T21 | Adopted as D4 | 9.2 |
| C5 - `RateLimiter` | Adopted: the limiter gains a `scope` parameter and the tickets scope its own flush/restore step | 10.2 |
| C6 - `call_service` | Corrected: the status split exists; only the connect-vs-read exception split is new | 4, 9.4 |
| C8 - listener when module off | Resolved: the listener starts on the add-on option alone and answers the uniform 404 while the module is off | 5, 6 |
| C14 | Adopted: each live send (test send, code, reminder, inbound reply) is a separately approved action | 19 |
| C15, C16 | Stay recorded | 4 |
| G - reopen | Adopted: `reopen_count`, `reopened` message purpose ("קריאה {number} נפתחה מחדש") | 7.1, 9.7, 11.2 |
| G - duplicates | Adopted: create sheet shows open tickets of the device; `duplicate_of` | 7.1, 14.2 |
| G - vendor documents | Adopted (text only): the page says documents go to the manager by the usual way; PDF is backlog | 10.7, 18A |
| G - offline | Adopted: draft note kept in `sessionStorage`, retried with the same `client_request_id` | 10.7 |
| G - page language | Adopted (D26): he / en / ar / ru per contact | 7.2, 9.7, 10.7 |
| G - notification fatigue | Partly adopted: `notify_new` on for the first manager only; `urgent_is_critical` (D28: installation default on + department override); digest and per-department matrix are backlog | 7.1, 13.4 |
| G - "who is the manager" | Adopted: the page shows the assigner's display name; the "ask the manager" note type is backlog | 10.7 |
| G - search / reporting | Adopted: text filter in the list; CSV export is backlog | 8.1 |
| G - edits after sending | Adopted: "נשלח לפני השינוי" flag + "שלח עדכון" | 7.1, 11.3 |
| G - internal acknowledgement | Adopted: the notification deep link lands on the ticket with one-tap "התקבל" | 13.4 |
| G - map card chip | Adopted: open-ticket count chip on the map card | 12.1 |
| N - ETag / fetch on focus | Adopted: no polling on the page; fetch on focus | 10.7 |
| N - health counters | Adopted: public listener last 5xx, rate-limit trips | 17 |
| N - Cloudflare zone features off | Adopted in the guide (Rocket Loader, e-mail obfuscation, Bot Fight Mode off for `t-*`) | 20 (slice 8) |
| Review Q1-Q6, Q9-Q11, Q13, Q14 | The review agrees with the r1 recommendations; the owner kept them (D16), Q6 replaced by D10 | 1A |

**Not honoured / changed from the review's wording** (with the reason):
- The review offered "one-shot redirector that 302s once". A one-shot GET redirect is consumed by the very mail scanners that
  prefetch links (Safe Links-style), so the vendor's own click would then fail. This CR uses a redeem page whose GET is static
  and whose token release needs a button press (section 10.2). Same goal, different mechanism.
- The review allowed the alternative "a `ThreadingHTTPServer` with a hand-written router". Not chosen: the public API has ten
  routes with multipart parsing; a uvicorn server on its own thread and event loop gives the same isolation from the main loop
  with the existing FastAPI validation (section 10.1).
- `urgent_is_critical` default: the review suggested default off; this CR keeps urgent tickets `critical` by default (so a
  flood or a stuck lift reaches a manager during quiet hours) behind an installation setting with a per-department override
  - the owner's decision D28.

## 2. Goals and non-goals

**Goals (release 1):** the points above (1-10), end to end, behind one module switch that is OFF by default; nothing changes
for a customer who never turns it on (no nav entry, no device tab, no HA event subscription, no notification sources visible,
and no listener unless the separate add-on option `tickets_public` is also turned on - section 6).

**Non-goals (release 1):**
- Automatic ticket creation from rules / automations / notifications (phase 2; the creation service and its dedupe key are
  designed in section 18 so phase 2 is one action kind plus a picker).
- An official WhatsApp Business API, SMS, or Telegram channel (the channel interface admits them; none is built). SMS is a
  listed future work item (D13, section 18A).
- Automatic switching between WhatsApp accounts when one is down (a different sender number is a visible change for the
  recipient and a separate pacing budget; the fallback order of 9.5 applies instead).
- Delivery / read receipts. `ha-whatsapp` HA events carry none `[WA-DOC]`; its webhook is documented for incoming messages
  only. The product never says "delivered" or "read" - only "handed to WhatsApp".
- Work orders with costs, stock / spare parts inventory, purchase orders, vendor invoicing, contracts, recurring preventive
  maintenance plans, customer-facing (tenant) portal. (Possible later CRs; the data model leaves room - `category`, `origin`.)
- A per-user notification preference model (CR-018 owner decision 4b stands: no per-user preferences).
- Business-hours SLA calendars (D7; release 1 counts calendar time; vendor send hours ARE in release 1, D4).
- Moving the database engine (Q11; release 1 stays on the main SQLite file behind a module storage layer).
- Writing anything to the `ha-whatsapp` integration's configuration (webhook, auto-responder, groups): Arx only calls the two
  send services and listens to events.

## 3. Glossary

| Term | Meaning |
|---|---|
| Ticket (קריאה) | One fault / request, owned by one department, with a status, a priority, a place and a timeline. Human reference `#<number>`. |
| Department (מחלקה) | An administrator-defined unit (maintenance, cleaning, HR, ...) with its own categories, priorities, SLA rules, message templates, managers and members. |
| Manager (מנהל מחלקה) | A user who holds `tickets.manage` and is a **manager member** of the ticket's department, or holds `tickets.manage` + `tickets.all_departments`. Assigns, reassigns, closes. |
| Assigner | The manager who made the current assignment. Returned handling goes back to them (and to every manager of the department). |
| Assignee (מטפל) | Who handles the ticket now: an internal **user**, or a directory **contact** (a person who is not a user, or a vendor). Exactly one at a time. |
| Contact (איש קשר) / Vendor (ספק) | Directory entries for non-users. A vendor is a company; it may have contact persons. Phone (E.164 digits), e-mail, preferred channel, `require_code`. |
| Handler link (קישור טיפול) | The external page URL for one assignment of one ticket, carrying a 192-bit token in the URL **fragment**. |
| Verification code (קוד אימות) | Option B: a 6-digit one-time code sent in a separate message; required before the page accepts updates for contacts marked `require_code` and for assignments where the manager asked for it. |
| Message channel | The abstract outbound/inbound interface (`TicketChannel`): WhatsApp (`ha-whatsapp`) in release 1, e-mail as fallback, others later. |
| Outbox | The durable queue of outbound ticket messages (`ticket_outbox`), drained by one paced worker. |
| Inbound | A reply / button tap arriving as an HA event and matched (or not) to a ticket. |
| SLA rule | Per department x priority: acknowledge-within, stuck-after (no update), stuck-after while waiting for a part, resolve-within, reminder cadence. |
| Stuck (תקועה) | An open ticket past one of its SLA thresholds. Computed, never a status. |
| Waiting for manager (ממתין למנהל) | A computed flag: unassigned, returned, done awaiting close, an unmatched reply, a failed send, an expired link on an open ticket. |
| Public listener | A separate HTTP listener (container port 18093) that serves only the handler page and its API. |
| WhatsApp account (חשבון וואטסאפ) | One linked WhatsApp number in `ha-whatsapp` = one Home Assistant config entry. Arx identifies it by the config entry id (discovered) or by a typed `account` value (manual). |
| Use (שימוש) | A purpose that sends WhatsApp messages and needs an account: `tickets.messages`, `tickets.messages` per department, `tickets.codes`; other modules register their own (9.9). |
| Send hours (שעות שליחה לספקים) | The local-time window in which non-urgent messages to contacts may leave (default 07:00-21:00, D4). |
| Sliding expiry / cap / grace | A link's expiry moves forward on activity (sliding window), never past a hard cap from minting; after close it stays readable for a grace period (D5). |
| Redeem link | The e-mail form of a handler link: `/t/r/<id>`, a static page whose button releases the real token (10.2). |

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
| HA calls | `ha_client.call_service(settings, domain, service, data, return_response=False, timeout=15)` (`services/ha_client.py:523`) POSTs `/api/services/<d>/<s>[?return_response]` with the Supervisor token. It already maps HTTP 400/404 → `service_not_found`, 401/403 → `ha_forbidden`, other ≥300 → `ha_error` (l.531-538); only the **exception** path is undistinguished: connect error and read timeout both become 503 `ha_unavailable` (l.529-530). The send adapter needs only that split (section 9.4; r1 overstated the change). `ha_client.get_state(settings, entity_id)` (l.60) reads one state with its full attributes (read-only). | `ha_client.py` |
| HA entity mirror | `ha_sync._refresh_registry` (l.1015-1030) reads `config/entity_registry/list` and `config/device_registry/list`; `ha_entities` keeps `platform`, `unique_id`, `config_entry_id`, `device_id`, `device_class`, `state`, `available` (`apply_registry` l.343-366) - enough to group an integration's entities by config entry without a new HA call. Attributes are mirrored only through the `ATTR_ALLOW` set (l.40-93), which does **not** contain `phone_number` (and must not: entity attributes reach every user who may read the device). | `ha_sync.py` |
| Backup of settings | `settings` is a `PROJECT_TABLES` member; only keys in `SETTINGS_KEEP` / `SETTINGS_KEEP_PREFIXES` (`services/backup.py:61-87`) stay out of an archive and are never restored from one. | `backup.py` |
| Body limits | `body_limit.LIMITS` (l.141-155): every unlisted route is capped at 1 MiB; upload routes have their own row. | `body_limit.py` |
| Rate limiter | `ha_user_auth.RateLimiter` (l.603) is hard-wired to scope `signin` with its own flush/restore in the janitor (`main.py` l.130-135, 410-415). | `ha_user_auth.py` |
| Scope union | `rbac.authorize` evaluates one `(permission, target)` pair (l.138); `rbac.permissions_anywhere(conn, principal)` (l.207) lists permissions held on any scope. | `rbac.py` |
| Time zone | The installation zone is the `time.zone` setting (`main.py` l.451-453 `_tz`). | `main.py` |
| Server stack | `uvicorn[standard]==0.53.0`, `fastapi==0.141.1`, `pillow==12.3.0` (`requirements.txt`). | `requirements.txt` |
| HA events | `ha_sync` keeps one HA websocket; subscriptions in `on_ready` (state_changed l.833, `_automations_start` l.959 with `AUTOMATION_EVENTS` l.93); unified dispatcher `on_message` l.784 routes by subscription id / `event_type` and drops unknown types. | `services/ha_sync.py` |
| Device window | The only **tabbed** device surface is the `<device-activity>` sheet (`frontend/src/components/device-activity.ts`): `type Tab = 'activity' \| 'schedules'` (l.32), tabs rendered from `(['activity','schedules'] as Tab[]).map(...)` (l.284), keyboard `onTabKey` (l.299), labels `deviceActivity.tabActivity` "פעילות" / `tabSchedules` "תזמונים" (`i18n/he.ts` ~l.749-756). It opens on the window event `OPEN_EVENT` with `ActivityOpen {target{id=entity_id, kind, name, state}, area?: area NAME, tab, menu?}` (`device-activity-press.ts:28`). | as cited |
| Long press | `ActivityPress` (`device-activity-press.ts`, `LONG_PRESS_MS = 500` l.15) on the area screen (`screens/devices-area.ts:539`), bubble pills (`devices-area-bubble.ts`) and the tiles panel (`devices-tiles-panel.ts:209`); it fires only on elements carrying `data-activity`, which `activityTag()` (l.39) sets **only for rows the server flags `activity`** (the electrical domains of `device_activity.ACTIVITY_DOMAINS`). Right-click / menu key / Shift+F10 open a 2-item menu ("פעילות" / "תזמונים", `device-activity.ts renderMenu` ~l.242). The floor map card (`screens/explore-floor-map.ts renderCard` l.2548) and the settings catalogue (`explore-entities.ts`) have no long press and no tabs. | as cited |
| Device history | `GET /api/v1/devices/{entity_id}/activity` (`routers/devices.py:154-187`); server function `device_activity.list_activity(conn, entity_id, *, since, until, actor, kind, limit, cursor, connected)` (`services/device_activity.py:533`), **no permission check inside** (the router does `ha_scope.scoped_rows(..., "devices.read", ...)` and `SECURITY_PERMISSIONS` for locks/alarm panels); only `ACTIVITY_DOMAINS` (l.49) are tracked; retention 90 days. Other entities: `ha_state_history` (0009, states only, 30 days). | as cited |
| Device place | No single entity-to-place function. Physical: `map_anchors (resource_type 'ha_entity')` → `floors` → `buildings` → `sites`; room = `spatial_zones` polygon (`correlation._zone_at` l.138, `correlation._anchor` l.149; camera precedent `routers/events.py:_location` l.711); placements helper `ha_scope.placements` (l.101). Organisational: `ha_entities.area_id/area_name/ha_floor_name`. Key = `entity_id`; `registry_id` survives renames. | as cited |
| Public surface | Only `/arx` is tunnelled (CR-008), behind add-on option `remote_access` (off by default); `RemoteChannel` adds CSP + headers on that channel only; Ingress trust = peer `172.30.32.2` (`auth.py:121`); the peer check lives only in `resolve_principal`, so a route with no principal dependency is reachable by other add-ons on the hassio network. The cast relay (`services/cast_relay.py`) is "the ONLY unauthenticated listener", a separate server on container port 18092 started only with the add-on option `cast_relay`, HMAC-derived tokens never stored, strict path regex, per-token buckets, no logging. `tests/test_remote_access.py:498 PUBLIC_ON_REMOTE` whitelists public routes. Anonymous remote requests are capped at 64 KiB (`body_limit.REMOTE_ANONYMOUS_MAX`). | as cited |
| Token patterns | Store `sha256(token)` only (`notify_action_tokens`, `mobile_devices.token_hash`); failure buckets 20/min per key + 300/min global (`presence.py:57-58`, `routers/notifications.py:160`); TOTP attempt lock `second_factor._Failures` (5 in 300 s → 600 s lock, table `auth_totp_failures`). | as cited |
| Images | `services/image_guard.py` (`check_pixels` before decode; process-wide 60 MP); re-encode pattern without EXIF in `services/wall_photos.py:add_photo` (l.104-131: JPEG/PNG/WebP, 8 MB, 40 MP, `exif_transpose`, RGB, 1920 px, fresh JPEG q85, random name) and `routers/ui_background.reencode` (magic-byte sniff, `draft`, `write_atomic`; its `_decode_slot` semaphore → 429 `busy` is **router-private**, l.135-144, and is not reused here). | as cited |
| Frontend build | One Vite config, inputs `index.html` + `src/pwa/sw.ts`; output `smplwise_vms/www`; **no separate public entry**; the `/arx/` boot (`arx/pre-gate.ts`, `arx/boot.ts`) shows a login when there is no session. | `frontend/vite.config.ts` |
| Rules hook | The Arx-owned rules engine: `ACTION_KINDS = ("notify", "ha_notify", "announce")` (`services/rules.py:22`), mirrored by the `Action.kind` regex (`routers/rules.py:53`). CR-017 edits HA automations; it is not an Arx action engine. | as cited |
| Janitor | `main.py janitor_tick` (l.30-161) runs every 30 s in a threadpool; each module adds a guarded step; startup at `_start_janitor` (l.409). | `main.py` |

**Contradictions recorded (not resolved here):** (1) `AGENTS.md` says "four primary navigation modes"; the product already has
nine top-level modes (`router.ts MODES`) and this CR proposes one more (Q1). (2) `docs/changes/CR-018-NOTIFICATIONS.md` §6.5
reserves WhatsApp as a CR-018 channel "designed later"; this CR builds a **ticket** message channel, not a CR-018 channel - the
adapter is written so CR-018 can register it later (section 9.8). (3) CR-036 slice WA sends WhatsApp **through WisKey**; this CR
sends through **`ha-whatsapp`**. If both end up on the same WhatsApp number their pacing must be shared: Arx cannot see WisKey's
number, so the account page has a manual "also used outside Arx" mark that raises the shared-use warning (9.9). (4)
`ha-whatsapp`'s own pages disagree on accounts per add-on instance: `limitations.html` says one instance pairs one number,
`configuration.html` says several numbers can be paired through one instance, each with its own config entry and `session_id`.
This design is keyed by **config entry**, which is one number in both readings. (5) `events.html` lists no account identifier on
`whatsapp_message_received` / `whatsapp_button_pressed`; the integration source on GitHub (`main`, read 2026-10-13) adds
`entry_id` and `session_id` to both. The design uses `entry_id` when present and works without it (9.6, 9.9).

### 4.1 `ha-whatsapp` facts for account selection (read 2026-10-13)

`[WA-DOC]` = documentation pages; `[WA-SRC]` = the integration source at `github.com/FaserF/ha-whatsapp`, branch `main`,
`custom_components/whatsapp/` (no commit pinned; the owner's installed version may differ - every `[WA-SRC]` fact is
**UNVERIFIED on the owner's installation** until slice 5a's read-only live check).

| Fact | Source | Used for |
|---|---|---|
| Integration domain `whatsapp`; services `whatsapp.send_message`, `whatsapp.send_buttons` (and others Arx never calls) take an optional `account`. | `[WA-DOC]` services | the send call |
| `account` resolution: omitted → the only client, or an error "Multiple WhatsApp accounts found" when there are several; else matched as **config entry id**, then config entry **unique_id** ("my_number"), then entry **title** (a title match logs a warning recommending entry id or unique id); no match → `ServiceValidationError` "account ... not found". | `[WA-SRC]` `__init__.py get_client_for_account` | Arx always sends the **entry id** for a discovered account (stable, never ambiguous); a manual account sends the typed value unchanged |
| One config entry per paired number: unique_id = the number (`my_number`) after QR/phone pairing, else the `session_id`, or a discovery system id / `host:port`; title `WhatsApp (<number>)` or `WhatsApp`. | `[WA-SRC]` `config_flow.py`; `[WA-DOC]` configuration | grouping, labels |
| Entities per entry: a connectivity binary sensor (`unique_id = "<entry_id>_connection"`, translation key `connection`, `is_on` = the add-on reports `connected`), attributes including `phone_number`, `connection_state` (`connected` / `disconnected` / `updating` / `restarting`), version and counters; two more binary sensors (moderation, Telegram bridge; disabled by default); sensors (messages sent, last message - its attributes carry the **content and target of the last message**, chats); buttons (reconnect, diagnostic test); switches. | `[WA-SRC]` `binary_sensor.py`; `[WA-DOC]` configuration, features | discovery and connection state |
| The integration's own option "Mask Sensitive Data" exists; whether it masks `phone_number` is unknown. | `[WA-DOC]` configuration | the label falls back when masked |
| Session expiry raises an HA **repair issue** ("re-scan the QR code"); no connection-change event is fired on the bus. | `[WA-DOC]` configuration; `[WA-SRC]` | status comes from the binary sensor state |
| `whatsapp_message_received` / `whatsapp_button_pressed` carry `entry_id` and `session_id` (the button event = the received payload + `button_id`); `whatsapp_message_sent` carries `entry_id`, `session_id` and the account's own number as `sender_number`. | `[WA-SRC]` `__init__.py` (not in `[WA-DOC]`) | inbound account filter |
| Config entries are also readable through HA's config-entries API (REST `/api/config/config_entries/entry`, WS `config_entries/get`), which needs an **admin** token; whether the add-on's Supervisor token is accepted there is **UNVERIFIED**. | HA core behaviour `[EXT]` | not used in release 1 (optional extra in the live check) |

Consequences for Arx: the account list is built **read-only from the existing entity mirror** (entities with `platform =
'whatsapp'` grouped by `config_entry_id`; the connectivity binary sensor gives the state). The number for a label is read
**on demand** with `ha_client.get_state` of that binary sensor, only by the account settings screen, and only its last four
digits are kept. Arx never reads or mirrors the "last message" sensor (it holds message content and a recipient).

## 5. Architecture and module boundaries

```
                 (Ingress / /arx remote, signed-in users)                     (internet, no account)
  frontend/src/tickets/*  ── api/tickets.ts ──►  routers/tickets*.py           public page bundle (www-public/)
  device-activity "קריאות" tab                     │                                 │  fetch, X-Ticket-Token
                                                   ▼                                 ▼
                                   services/tickets/  (one package, one storage layer)        services/tickets/public_app.py
                                   ├─ store.py      all SQL of the module                     (separate FastAPI app, port 18093,
                                   ├─ model.py      state machine, validation                  only /t/* routes; own thread + event
                                   ├─ access.py     visibility = permission x department        loop; started on option tickets_public;
                                   │                                                            uniform 404 while the module is off)
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

                                   services/messaging_accounts.py   (installation-level, NOT inside tickets: WhatsApp
                                                                     account discovery, use registry + mapping, shared
                                                                     per-account pacing ledger - section 9.9)
                                   routers/messaging_accounts.py    (Settings API of the above)
```

- **Backend routers:** `routers/tickets.py` (tickets, timeline, assignments, attachments, board), `routers/tickets_admin.py`
  (departments, categories, priorities, SLA, templates, members, settings, channel status/test), `routers/tickets_contacts.py`
  (directory). All mounted under `/api/v1` like every router; every handler first calls `tickets.access.module_on(conn)` and
  answers 404 `feature_disabled` when the module is off (the `multimedia` precedent).
- **Public app:** `services/tickets/public_app.py` builds a **second, minimal FastAPI app** that contains only the `/t/*`
  routes, its own body-limit table, its own security-headers middleware, its own exception handlers and no static mount except
  the public bundle. It runs in the add-on process on container port **18093** as a `uvicorn.Server` on its **own daemon
  thread with its own event loop** (`tickets-public`), started from `_start_janitor` (`main.py:409`) next to the cast relay
  (l.525) when the add-on option `tickets_public` is true - **whatever the module switch says** (C8 resolved: while the module
  is off every `/t/*` request answers the uniform 404; this matches the cast relay, which starts on its option alone). Server
  configuration and isolation rules: 10.1. The main app (port 8099) mounts **none** of these routes (a test asserts `/t/*`
  and `/api/v1/public/*` are 404 on 8099, Ingress and `/arx`).
- **Frontend (internal):** `frontend/src/tickets/` (module-local components and a module-local text catalogue `tickets/text.ts`
  in the `frigate-text.ts` style, wired into `i18n`), `frontend/src/api/tickets.ts` (+ `tickets-mock.ts` demo store, the
  `api/schedules.ts` pattern), screens `screens/tickets-list.ts`, `tickets-board.ts`, `tickets-detail.ts`, settings screens
  `screens/system-tickets.ts` (tabs) and the device tab component `tickets/device-tickets-tab.ts`.
- **Frontend (public):** a **second Vite entry** `frontend/public-ticket.html` + `frontend/src/public-ticket/main.ts` built to
  `smplwise_vms/www-public/` (no Lit shell, no router, no skins, no service worker, no shared chunk with the app; budget
  <= 60 KB gzip; a build test fails if it imports anything from `shell/`, `api/session.ts` or the Ingress/remote boot).
- **Storage:** the main SQLite file (`smplwise.db`), all SQL inside `services/tickets/store.py` so a later move to another file or
  engine touches one module (data-store direction note; Q11, kept by D16). Attachments under
  `<data>/tickets/<ticket_id>/<random>.jpg` (the data volume, never `/tmp`).
  Write rate is low (human actions, a 60 s monitor), so the separate-file argument of `energy.db` (once-a-minute sampler vs the
  single writer) does not apply.

## 6. Module enablement

| Layer | Switch | Default | Effect when off |
|---|---|---|---|
| In-app | setting `tickets.enabled` ("true"/"false"; in `routers/settings.py DEFAULTS` + `SettingsPatch` alias, the `schedules.enabled` precedent) | `"false"` | every `/api/v1/tickets*` route except `GET /tickets/module` answers 404 `feature_disabled`; nav area and device tab hidden (`applyTicketsHidden` in `shell/nav.ts`, called from `sw-app.ts` next to `applySchedulesHidden`); the HA event subscription for WhatsApp is not made; the SLA monitor and outbox worker idle; notification sources stay registered but `enabled=False` is forced. Data is kept. |
| Add-on option | `tickets_public: false` (`config.yaml` options + schema + `self_update.OPTION_TYPES`; `ports: 18093/tcp: null`, description "Handler page for service tickets (optional)") | off | the public listener is not started; external assignment is refused with 409 `public_link_unavailable` and the settings page says what is missing. When on, the listener runs even while the module is off and answers the uniform 404 to everything. |
| Settings document | `tickets.settings` (JSON, revision-checked, NOT in `DEFAULTS`) | see 14.1 | public base URL, link durations, send hours, channel options, pacing, retention. |
| Settings document | `messaging.whatsapp` (JSON, revision-checked, NOT in `DEFAULTS`; owned by `services/messaging_accounts.py`) | empty | accounts, use mapping, per-account pacing (9.9). |

Turning the module on requires `system.configure` and writes audit `tickets.module.enable`. Turning it off does not delete data,
revokes nothing by itself, but every public request then answers the uniform 404 (links are effectively suspended, and come
back if the module is turned on again before they expire; the expiry clock keeps running while off). The SLA monitor and the
outbox worker idle while the module is off (queued messages stay queued; on re-enable, messages whose purpose is stale - a
reminder for a ticket closed meanwhile - are cancelled by the normal rules before the worker sends). A capability-style flag
`tickets` is added to `/me` (`modules: {tickets: true|false}`) so the shell does not need the full settings read.

`tickets.enabled`, `tickets.settings` and `messaging.whatsapp` join `backup.SETTINGS_KEEP` (review C4): they describe this
installation (its address, its WhatsApp numbers, its switch) and must neither travel in a project backup nor be restored into
another installation.

## 7. Data model (migrations 0079-0084)

**Migration range:** highest on any remote ref is 0078 (`integ/249`) as of r1; re-check at implementation start. This CR
reserves **0079-0084** and follows the repo rule: if another branch lands one of these numbers first, the tickets migrations
are renumbered at integration (the files are additive and independent of each other's numbers).

| File | Slice | Content |
|---|---|---|
| `0079_tickets_core.sql` | 1 (+2 uses it) | departments, members, categories, priorities, SLA rules, templates, sequence, tickets, assignments, events, attachments, device context, request idempotency |
| `0080_ticket_contacts_links.sql` | 4 (+7) | contacts, contact-departments, links, link sessions, link codes, link failures, link access log, e-mail redeem ids |
| `0081_ticket_messaging.sql` | 5b | outbox, inbound log |
| `0082_messaging_accounts.sql` | 5a | the shared per-account send ledger (pacing across uses and modules) - **new in r2** (it used the r1 spare) |
| `0083_ticket_costs.sql` | 9 | cost claims, revisions, decisions, files; cost columns on departments, contacts, tickets (11A.10) - **new in r2.5** |
| `0084` | spare | reserved for a schema need found during build (none planned) |

r2 schema changes against r1, in one list: `ticket_departments` gains the history default 0, `auto_close_after_days`
(replaces `require_manager_close`), link-duration and send-hour overrides, `urgent_is_critical`; `ticket_sla_rules` gains
`link_unopened_min`; `tickets` gains `duplicate_of`, `reopen_count`, `external_stale`; `ticket_events.visible_external`
defaults to 0; `ticket_attachments` gains `visible_external`; new `ticket_requests`; `ticket_contacts` gains `lang`;
`ticket_assignments` gains `require_code` and `return_kind`; `ticket_links` gains `cap_at`, `grace_until`, `sent_via`; new
`ticket_link_redeems`; `ticket_link_codes` gains `channel`; `ticket_outbox` gains `use_key`, `account_key`, `held_reason`,
new purposes and state `held`; `ticket_inbound` gains `account_key` and result `late`; new `messaging_send_ledger`.

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
  auto_close_after_days INTEGER,                       -- D10: NULL = two-step (a manager closes 'done'); N (1-30) = automatic
                                                       -- close N days after 'done' unless a manager acted first
  share_history_external INTEGER NOT NULL DEFAULT 0,   -- D3/D23: the department's DEFAULT for the per-ticket checkbox (12.3);
                                                       -- never for lock / alarm_control_panel / cover / camera, whatever this says
  urgent_is_critical    INTEGER,                       -- D28 override; NULL = installation value (14.1, default true). 1: priorities
                                                       -- with notify_severity 'critical' keep it; 0: capped at 'alert' (no
                                                       -- quiet-hours bypass, no CR-018 escalation)
  link_sliding_days     INTEGER,                       -- D5 per-department overrides; NULL = installation value (14.1)
  link_cap_days         INTEGER,
  link_grace_hours      INTEGER,
  send_hours_json       TEXT,                          -- D4 override: {"from":"07:00","to":"21:00"}; NULL = installation value
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
  notify_new    INTEGER NOT NULL DEFAULT 0,            -- managers: alert on a new unassigned ticket; the service sets 1 for the
                                                       -- department's FIRST manager only (review: notification fatigue)
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
  link_unopened_min         INTEGER,                  -- D11: a handler link sent but never opened (default 1440 = 24 h)
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
  purpose       TEXT,           -- message: 'assign' | 'reminder' | 'code' | 'closed' | 'reassigned' | 'reopened' | 'update'
                                --          | 'cost_rejected' | 'cost_approved' | 'cost_reopened' (11A)
  name          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',        -- ticket: prefilled title
  body          TEXT NOT NULL DEFAULT '',        -- ticket: prefilled description; message: text with allow-listed placeholders
  category_id   TEXT REFERENCES ticket_categories(id),
  priority_key  TEXT,
  lang          TEXT NOT NULL DEFAULT 'he' CHECK (lang IN ('he', 'en', 'ar', 'ru')),   -- D26: message templates per language
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
  waiting_reason        TEXT,                         -- 'unassigned' | 'returned' | 'not_mine' | 'done' | 'reply' | 'late_reply'
                                                      -- | 'send_failed' | 'link_expired' | 'contact_changed' | 'code_locked'
  stuck_level           INTEGER NOT NULL DEFAULT 0,   -- 0 none; 1 reminder(s) sent; 2 managers alerted
  stuck_kind            TEXT,                         -- 'unassigned' | 'unopened' | 'ack' | 'stuck' | 'waiting' | 'overdue'
  reminders_sent        INTEGER NOT NULL DEFAULT 0,
  next_check_at         TEXT,                         -- the SLA monitor's next look at this row
  -- phase 2 hook
  rule_ref              TEXT,                         -- 'rule:<id>' / 'automation:<id>' (NULL in release 1)
  dedupe_key            TEXT,                         -- an open ticket with the same key absorbs a repeat (section 18)
  -- r2 (review daily-use gaps)
  duplicate_of          TEXT REFERENCES tickets(id),  -- set when cancelled as a duplicate; the original gets a note
  reopen_count          INTEGER NOT NULL DEFAULT 0,
  external_stale        INTEGER NOT NULL DEFAULT 0,   -- 1: title/description/place/priority edited after the current
                                                      -- assignment message left ("נשלח לפני השינוי"); cleared by "שלח עדכון"
  done_at               TEXT,                         -- D10: when 'done' was reached; auto close = done_at + auto_close_after_days
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
  return_kind      TEXT CHECK (return_kind IN ('cannot_handle', 'not_mine')),   -- D12: 'not_mine' = the "לא שלי" button
  return_reason    TEXT,                              -- the assignee's words when handing back (required, 1-500)
  share_history    INTEGER NOT NULL DEFAULT 0,        -- D23: the per-ticket checkbox "לשתף היסטוריית מכשיר" (12.3)
  require_code     INTEGER NOT NULL DEFAULT 0,        -- review T4: the manager may require a code for THIS assignment
                                                      -- (raise only: the contact's own setting can never be lowered here)
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
                                    -- | message_failed | message_fallback | message_unknown | device_context
                                    -- | link_extended | link_expired | link_unopened | late_reply | duplicate | update_sent
                                    -- | auto_closed | contact_changed
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
  visible_external INTEGER NOT NULL DEFAULT 0    -- safe default (r2): 1 only for the assignee's own rows and for manager notes
                                                 -- explicitly marked "גלוי למטפל" (default on in the assign dialog's note,
                                                 -- off in the timeline note box)
);
CREATE INDEX idx_ticket_events_ticket ON ticket_events (ticket_id, id);

CREATE TABLE ticket_requests (                    -- review T22: idempotency of writes that carry client_request_id
  scope              TEXT NOT NULL,               -- 'link:<link_id>' (public) | 'user:<users.id>' (internal)
  client_request_id  TEXT NOT NULL,               -- UUID from the client
  route              TEXT NOT NULL,               -- route template; a reused id on another route -> 409 request_id_reused
  status_code        INTEGER NOT NULL,
  response_json      TEXT NOT NULL,               -- the first answer, replayed for a repeat (never holds a phone, token or code)
  at                 TEXT NOT NULL,
  PRIMARY KEY (scope, client_request_id)
);
CREATE INDEX idx_ticket_requests_at ON ticket_requests (at);   -- pruned after 24 h

CREATE TABLE ticket_saved_views (                -- D24: a user's saved filters / table layouts (private to the user)
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,                     -- <= 60 chars
  view_json   TEXT NOT NULL,                     -- {view, filters, sort, columns, density}; validated against the same whitelists as the API
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_ticket_saved_views_user ON ticket_saved_views (user_id);   -- at most 20 per user
CREATE INDEX idx_tickets_sort_activity ON tickets (last_activity_at DESC, id);
CREATE INDEX idx_tickets_sort_created ON tickets (created_at DESC, id);

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
  visible_external INTEGER NOT NULL DEFAULT 0,    -- review T15: manager / internal uploads 0 unless marked "גלוי למטפל";
                                                  -- the external assignee's own uploads 1
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
  share_history    INTEGER,                              -- D23: per-vendor default for the history checkbox; NULL = the department's
  lang             TEXT NOT NULL DEFAULT 'he' CHECK (lang IN ('he', 'en', 'ar', 'ru')),   -- page + message language;
                                                         -- D26: all four selectable; he / ar render RTL, en / ru LTR
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
  require_code     INTEGER NOT NULL,                -- contact setting OR assignment setting at mint time (raised, never lowered, later)
  sent_via         TEXT CHECK (sent_via IN ('whatsapp', 'email', 'manual')),   -- how the link last left (D6 code-channel rule)
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,                   -- D5 sliding expiry: moved forward on activity, never past cap_at (10.2)
  cap_at           TEXT NOT NULL,                   -- created_at + cap days (a later LOWER cap setting pulls it in at once)
  grace_until      TEXT,                            -- set at close / cancel: read-only page until then (10.7)
  revoked_at       TEXT,
  revoked_reason   TEXT CHECK (revoked_reason IN ('closed', 'cancelled', 'reassigned', 'returned', 'not_mine', 'manual',
                                                  'resent', 'module_key', 'contact_changed', 'contact_erased')),
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
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
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

CREATE TABLE ticket_link_redeems (                  -- review T3(2): the e-mail form of a link (10.2)
  id_hash      TEXT PRIMARY KEY,                    -- sha256(redeem id); the id itself (128-bit) is only in the e-mail
  link_id      TEXT NOT NULL REFERENCES ticket_links(id) ON DELETE CASCADE,
  generation   INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,                       -- created_at + 24 h
  uses         INTEGER NOT NULL DEFAULT 0           -- at most 3 token releases
);
CREATE INDEX idx_ticket_link_redeems_link ON ticket_link_redeems (link_id);
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
  purpose             TEXT NOT NULL CHECK (purpose IN ('assign', 'reminder', 'code', 'closed', 'reassigned', 'reopened',
                                                       'update', 'cost_rejected', 'cost_approved', 'cost_reopened', 'test')),
  use_key             TEXT NOT NULL,                 -- 9.9: 'tickets.messages' | 'tickets.codes' (WhatsApp rows); 'email' otherwise
  department_id       TEXT,                          -- for the per-department account override (resolved at claim time)
  account_key         TEXT,                          -- 9.9: the WhatsApp account, written when the worker CLAIMS the row
                                                     -- ('sending'), never at queue time; NULL for e-mail rows
  template_id         TEXT,
  template_revision   INTEGER,
  params_json         TEXT NOT NULL DEFAULT '{}',    -- placeholders except {link} and {code}; never a phone, token or code
  state               TEXT NOT NULL CHECK (state IN ('queued', 'held', 'sending', 'sent', 'refused', 'unknown', 'not_sent',
                                                     'cancelled', 'superseded')),
  held_reason         TEXT CHECK (held_reason IN ('send_hours', 'channel_down', 'account_unmapped', 'module_off')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  not_before          TEXT NOT NULL,                 -- send hours (D4) move it to the window's next opening
  priority            INTEGER NOT NULL DEFAULT 1,    -- 0 = code (sent first), 1 = assign / update / reopened, 2 = reminder / closed / reassigned
  outcome_code        TEXT,                          -- 'ha_unavailable', 'service_not_found', 'timeout', 'rate', 'no_phone', ...
  provider_message_id TEXT,                          -- whatsapp send_message response (UNVERIFIED shape, section 9.3)
  reply_nonce         TEXT UNIQUE,                   -- 64-bit random, embedded in button ids 't:<nonce>:<action>'
  fallback_of         TEXT,                          -- the failed outbox row this one replaces
  requested_by        TEXT,                          -- users.id or 'system'
  created_at          TEXT NOT NULL,
  sent_at             TEXT,
  updated_at          TEXT NOT NULL
);
CREATE INDEX idx_ticket_outbox_queue ON ticket_outbox (state, priority, not_before) WHERE state IN ('queued', 'held', 'sending');
CREATE INDEX idx_ticket_outbox_ticket ON ticket_outbox (ticket_id, created_at);
CREATE INDEX idx_ticket_outbox_contact_sent ON ticket_outbox (contact_id, sent_at) WHERE state = 'sent';
CREATE INDEX idx_ticket_outbox_provider ON ticket_outbox (provider_message_id) WHERE provider_message_id IS NOT NULL;

CREATE TABLE ticket_inbound (
  id               TEXT PRIMARY KEY,
  received_at      TEXT NOT NULL,                    -- when Arx got the event
  provider_at      TEXT,                             -- the event's own timestamp
  event_type       TEXT NOT NULL,                    -- whatsapp_message_received | whatsapp_button_pressed
  msg_type         TEXT,                             -- chat | button_reply | list_reply | ...
  sender_key       TEXT,                             -- HMAC(k_tickets, digits(sender_number)) - never the number; NULL when the
                                                     -- event carries no usable number (LID addressing, review T12b)
  account_key      TEXT,                             -- 9.9: 'entry:<entry_id>' when the event carries entry_id, else NULL
  dedupe_key       TEXT NOT NULL UNIQUE,             -- sha256(account_key | sender | provider_at | type | selected_id | content)
  contact_id       TEXT,
  ticket_id        TEXT,
  outbox_id        TEXT,
  result           TEXT NOT NULL CHECK (result IN ('status', 'note', 'late', 'ignored', 'ambiguous', 'unknown_sender', 'stale',
                                                   'duplicate', 'refused')),
  action           TEXT,                             -- acknowledged | in_progress
  content          TEXT,                             -- kept ONLY for 'ambiguous' / 'note' / 'late' (<= 1000, plain, Cc/Cf stripped)
  handled_by       TEXT,                             -- a manager who resolved an ambiguous reply
  handled_at       TEXT
);
CREATE INDEX idx_ticket_inbound_open ON ticket_inbound (result, received_at) WHERE result = 'ambiguous' AND handled_at IS NULL;
CREATE INDEX idx_ticket_inbound_ticket ON ticket_inbound (ticket_id, received_at);
```

Events from WhatsApp accounts that are not, and were not within `reply_window_h`, mapped to a ticket use are dropped before
any row is written (only a counter in health): the module never stores private chats of other numbers (9.9).

### 7.3A `0082_messaging_accounts.sql` (new in r2, owned by `services/messaging_accounts.py`)

```sql
CREATE TABLE messaging_send_ledger (               -- one row per WhatsApp send attempt that may have left (sent / unknown);
  id             INTEGER PRIMARY KEY AUTOINCREMENT, -- the pacing budget of an ACCOUNT, shared by every use and module
  account_key    TEXT NOT NULL,                     -- 'entry:<config_entry_id>' | 'manual:<id>' (9.9)
  use_key        TEXT NOT NULL,                     -- 'tickets.messages', 'tickets.codes', later other modules' uses
  recipient_key  TEXT NOT NULL,                     -- HMAC(k_messaging, digits) - never the number
  kind           TEXT NOT NULL CHECK (kind IN ('message', 'code', 'test')),
  at             TEXT NOT NULL
);
CREATE INDEX idx_messaging_ledger_account ON messaging_send_ledger (account_key, at);
CREATE INDEX idx_messaging_ledger_recipient ON messaging_send_ledger (account_key, recipient_key, at);
-- pruned after 2 days (the longest pacing window is one day)
```

`k_messaging` is a separate 32-byte key in `<data>/secrets/messaging_key` (same handling as `k_tickets`, 7.4), so another
module can use the ledger without the tickets key.

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
  categories, SLA rules, templates) travel; tickets, events, attachments, contacts, links, outbox, inbound, requests and the
  messaging ledger are operational data and do not (the `events` / `notifications` precedent). `tickets.enabled`,
  `tickets.settings` and `messaging.whatsapp` are in `SETTINGS_KEEP` (section 6). Department rows carry overrides (link
  durations, send hours) - they travel with the department, which is intended (they are policy, not installation identity).
- **Residual (review T20):** the HA add-on backup (`backup: hot`) holds all of `/data`, **including `k_tickets` and the
  database**: whoever steals an HA backup can derive every live link token. Same residual as the cast relay secret. The
  installer guide says HA backups are as sensitive as the HA admin password.

## 8. Permissions (RBAC)

Principle (WXPERM): every gate is a permission; roles are defined by the organization. **WHERE** a permission applies is
answered by department membership (and by place scope when the ticket has a place); **WHAT** is answered by the permission.
Departments are deliberately **not** a new RBAC scope type: a new scope type touches `rbac.scope_chain`, the binding editor, the
delegation rules and every scope test (integ/249 shows the size of that change for stations); membership inside the module is
local, matches the owner's model ("each department has its managers"), and is administered on the department page.

**The eight ticket permissions (D15 as drawn in the mock-up, `tickets.external` restored by D25, the two cost permissions of D31):**

| Permission | Label (Hebrew) | Meaning | Sensitive | Default built-in roles |
|---|---|---|---|---|
| `tickets.view` | צפייה בקריאות | See tickets (own, assigned to me, my departments'); the nav area and the device tab "קריאות" exist only with it; **a member of a department who holds it can be assigned as an internal handler** and updates the tickets assigned to them (r1's `tickets.handle`) | no | operator, site_admin, system_admin |
| `tickets.create` | פתיחת קריאות | Open a ticket (screen, device) in a department the user is a member of, or any active department that allows "anyone may open" (department flag, default on) | no | operator, site_admin, system_admin |
| `tickets.manage` | ניהול קריאות | Manager actions in departments where the user is a **manager member**: assign (internal users; directory contacts / vendors **only together with `tickets.external`**), reassign, close, cancel, reopen, edit, internal notes, revoke handler links, resolve unmatched replies, read the contact directory (masked phones) for those departments | no | site_admin, system_admin |
| `tickets.external` | שליחה לגורם חיצוני | **D25.** Send to outside contacts / vendors: with manager rights - assign to a contact, send / resend / new / copy handler links; on its own (any visible ticket) - "שלח עכשיו" for a message held by send hours (D29); see contacts' full phone numbers for the departments one manages | **yes** | site_admin, system_admin |
| `tickets.all_departments` | כל המחלקות | `tickets.view` / `tickets.manage` apply in every department without membership | **yes** | system_admin |
| `tickets.configure` | הגדרות קריאות | Departments, categories, priorities, SLA matrix, link-duration and send-hour overrides, message templates, members, **the contact / vendor directory** (create, edit, erase, export, "require verification code" - r1's `tickets.contacts.manage`) | **yes** (review T19) | system_admin |
| `tickets.costs.view` | צפייה בעלויות | **D31** - see cost claims, amounts, invoice files, cost columns and reports (11A.8) | **yes** | site_admin, system_admin |
| `tickets.costs` | אישור עלויות | **D31** - approve / adjust / reject claims, mark paid, claims on the vendor's behalf, close-gate override (11A.8) | **yes** | system_admin |

Installation-level permissions used by the module (not ticket permissions):

| Permission | Label | Meaning | Sensitive | Default |
|---|---|---|---|---|
| (existing) `system.configure` | - | Module switch, public address, installation link durations and send hours, channel options, retention, key rotation, read-only view of the WhatsApp account mapping (masked) | system | system_admin |
| `messaging.accounts.manage` (**new**, D9) | בחירת חשבונות וואטסאפ | Add / remove / label WhatsApp accounts and **map accounts to uses** (installation default, per-department override, codes, other modules' uses) | **yes** | system_admin |

`viewer`, `kiosk`, `editor`, `door_opener`: none. Every new permission goes into `PERMISSION_LABELS`, `roles.json` (and
`contracts/examples/role-catalog.design.json`), `sensitive_permissions_not_implied` for the six sensitive ones
(`tickets.all_departments`, `tickets.external`, `tickets.configure`, `tickets.costs.view`, `tickets.costs`,
`messaging.accounts.manage`), and the frontend permission
labels.

**What folding r1's two remaining extra permissions trades off (D15, recorded):** (1) being assignable is no longer a
separate grant: any member of the department with `tickets.view` is assignable; the department's member list is the control.
(2) Directory editing (phones, "require code") sits with the sensitive settings permission, which keeps review T19(4)
intact. External sending is **not** folded (D25).

**Escalation rules (review T19):**
- Member edits: `tickets.configure` **and** (manager member of that department **or** `tickets.all_departments`). Nobody can
  add themself as manager of a department they do not already manage; the first manager of a new department is set by its
  creator, who must hold `tickets.all_departments` or becomes that first manager.
- Message templates reach outsiders: edits need `tickets.configure` (sensitive) and the audit row carries the before/after text
  diff (template text is configuration, not personal data).
- `POST /tickets/{id}/assign {kind: contact}` on a `ticket_contacts` row with `user_id` set → 409 `assignee_not_allowed`
  (an internal user never receives a token link, Q4 / D16).
- A contact's phone or e-mail change while it has live links → those links are revoked (`contact_changed`), each affected
  ticket goes to "waiting for manager" (`contact_changed`) and the department's managers get CR-018 `ticket.contact_changed`.

**Visibility rule** (`services/tickets/access.py visible(conn, principal, ticket)`, used by every read, every list, the device
tab, notification visibility and the board):

```
module on
AND place_ok(principal, ticket)
      # ticket with a place: authorize(principal, 'tickets.view', place_target(ticket))
      #   place_target = ('floor', floor_id) if the ticket has a floor, else ('site', site_id)
      # ticket WITHOUT a place: 'tickets.view' in rbac.permissions_anywhere(conn, principal) (review T18-1: a floor-scoped
      #   user keeps the placeless tickets they created or handle); department membership does the real gating below
AND ( (holds 'tickets.all_departments' on the same target / anywhere for placeless)
      OR is_member(principal, ticket.department_id)                       # direct or through a group, manager or member
      OR ticket.created_by == principal.user_id
      OR current internal assignee == principal.user_id )
```

**What a visible ticket shows** depends on why it is visible (review T18-2):
- members and managers of the department (and `tickets.all_departments`): everything, including internal notes and internal
  photos;
- a creator or internal assignee who is **not** a member: the ticket card, status, assignee name and the timeline rows with
  `visible_external = 1` plus their own rows - never internal notes or internal photos.

Members who are not managers see their department's tickets (a technician sees the queue); manager actions additionally need
`tickets.manage`. A deny binding on the place chain removes the ticket (deny beats allow, `rbac.authorize`). Lists are
filtered in SQL by department membership first (indexed) and then by the place check per row (bounded page size 50).

**Device tab** (`GET /tickets/by-entity/{entity_id}`, review T18-3): first `ha_scope.scoped_rows(conn, principal,
"devices.read", [{"entity_id": ...}])` must allow the entity (and the `SECURITY_PERMISSIONS` rule for locks / alarm panels,
`routers/devices.py`); otherwise 404 `ticket_not_found`-style uniform answer. Then the visibility rule per ticket.

**Assignee picker** (`GET /tickets/assignees?department_id=`): needs manager rights in that department; lists active users who
are members of the department and hold `tickets.view` on the ticket's place (the `alarm.py:834` iteration, cached per
`permission_revision`) - names only, no bindings - plus the directory contacts allowed for the department. A manager of one
department therefore learns the names of that department's members only (review T18-5: acceptable, stated).

### 8.1 Internal API (`/api/v1`, Ingress or `/arx` session; every route: module on, then permission, then visibility)

| Route | Gate | What |
|---|---|---|
| `GET /tickets/module` | signed in | `{enabled, public_ready, channel: {whatsapp: state}}` - the only route answering while the module is off |
| `GET /tickets?scope=mine\|department\|all&status=&department_id=&priority=&assignee=&entity_id=&floor_id=&area=&stuck=&waiting=&q=&sort=&limit=&cursor=` | `tickets.view` | visibility-filtered page (default 50, max 200), server-side sort and keyset pagination (13.6); `scope=all` needs `tickets.all_departments`; `q` = text filter on number / title / device name |
| `POST /tickets` | `tickets.create` (+ membership or `open_to_all`) | body: department, category, priority, title, description, `entity_id?`, `assign?`, `client_request_id`; device creation resolves place + history snapshot server-side (the client never sends a place); the answer lists **open tickets of the same device** visible to the caller (`open_for_entity`), and the create sheet asks for them first (duplicate hint, r2) |
| `GET /tickets/{id}` | visible | detail + timeline + attachments + device context + allowed actions for this caller |
| `PATCH /tickets/{id}` | manager (or creator while `new`) | editable fields of 11.3; `revision` required (409 `ticket_stale`) |
| `POST /tickets/{id}/status` | per 11.2 | `{to, note?, revision}` |
| `POST /tickets/{id}/assign/preview` | manager | `{assignee, template_id?, note?}` → the **exact outgoing text** with the link shown as "[קישור]", the account label and channel that will be used, the send-hours outcome ("יישלח ב-07:00") and any refusal (`code_channel_unavailable`, `public_link_unavailable`) - review T13-3; no side effect |
| `POST /tickets/{id}/assign` | manager; **+ `tickets.external` for a contact** (D25) | `{assignee: {kind: user\|contact, id}, channel?, template_id?, note?, note_external?, require_code?, share_history?, cost_claim?, send_now?, revision}`; ends the current assignment, revokes its link, mints a link for a contact, queues the message; 409 `assignee_not_allowed` for a contact row with `user_id`; 409 `code_channel_unavailable` (D6) |
| `POST /tickets/{id}/notes` | visible + (member / manager \| current assignee \| creator) | `{text, external: bool}` (`external` only for managers; default false in the timeline box) |
| `POST /tickets/{id}/attachments` / `GET .../attachments/{aid}` / `DELETE ...` | as notes / visible per the "what a visible ticket shows" rule / manager or uploader within 10 min | multipart image (10.6); `external` flag as for notes; `body_limit.LIMITS` gains the row `ticket_attachment` (8 MiB + 64 KiB, review C3) |
| `POST /tickets/{id}/eta` | current internal assignee or manager | `{eta_at}` |
| `POST /tickets/{id}/return` | current internal assignee | `{kind: cannot_handle\|not_mine, reason}` (reason required, 1-500) |
| `POST /tickets/{id}/send-update` | manager | re-sends the current text (purpose `update`) after an edit; clears `external_stale` |
| `POST /tickets/{id}/link/resend` / `.../link/new` / `.../link/revoke` / `.../link/copy` | manager; resend / new / copy also need `tickets.external` | resend the current link (extends the sliding expiry) / new generation (new cap) / revoke / return the URL once (audited) |
| `POST /tickets/{id}/outbox/{outbox_id}/send-now` | visible + `tickets.external` (D29; not necessarily a manager) | releases a message `held` by send hours (`held_reason = 'send_hours'`) for immediate sending; audited `ticket.message.send_now`; refused for other hold reasons |
| `GET /tickets/facets?<same filters as the list>` | `tickets.view` | counts per status (state strip, D21), per floor / area (tree, D19), per department, per stuck kind - over the visible set (13.6) |
| `POST /tickets/bulk` | manager (checked per ticket) | D24 bulk actions (13.6) |
| `GET /tickets/export.csv?<filters>&columns=` | `tickets.manage` (any department) | D24 CSV export of visible rows (13.6) |
| `GET/POST/PATCH/DELETE /tickets/views[...]` | `tickets.view` (own rows only) | saved filters / layouts (D24) |
| `GET /tickets/board?department_id=` | `tickets.manage` (member manager) or all-departments | the four board sections (13.5) |
| `GET /tickets/inbound?state=ambiguous` / `POST /tickets/inbound/{id}/claim` / `.../attach` / `.../dismiss` | manager of a candidate department | unmatched replies: the list shows sender display name + time only; `claim` ("זה שלי") reveals the text to the claiming manager (audited), then `attach` to one of their tickets or `dismiss` (review T13-2) |
| `GET /tickets/assignees?department_id=` | manager | 8 |
| `GET /tickets/by-entity/{entity_id}` | `tickets.view` **and** `devices.read` on the entity | the device tab list (by `registry_id`, then `entity_id`) + `can_create` |
| `GET/POST/PATCH/DELETE /tickets/admin/departments[...]`, `.../categories`, `.../priorities`, `.../sla`, `.../templates`, `.../members` | `tickets.configure` (members: + the escalation rule above) | revision-checked documents, 422 field problems |
| `GET/POST/PATCH /tickets/contacts[...]`, `POST .../{id}/erase`, `GET .../{id}/export` | write / erase / export: `tickets.configure`; list read: `tickets.manage` (contacts allowed for the caller's departments; full phone only with `tickets.external`) | directory |
| `GET/PUT /tickets/settings`, `POST /tickets/address/probe`, `POST /tickets/channel/test`, `GET /tickets/health`, `POST /tickets/key/rotate`, `PUT /settings` `tickets.enabled` | `system.configure` | 14.1, 17; `address/probe` and `channel/test` are in `remote_channel.BLOCKED_ON_REMOTE` (local only, review T11) |
| `GET /messaging/whatsapp` | `system.configure` or `messaging.accounts.manage` | accounts (masked labels, state), registered uses and their mapping, warnings (9.9) |
| `PUT /messaging/whatsapp` / `POST /messaging/whatsapp/refresh` | `messaging.accounts.manage` | revision-checked mapping document; `refresh` re-reads the entity mirror and the on-demand labels (9.9) |

Errors use the existing `ApiError` envelope with Hebrew messages: 404 `feature_disabled` / `ticket_not_found` (uniform for
invisible tickets), 403 `forbidden`, 409 `ticket_stale` / `invalid_transition` / `public_link_unavailable` / `assignee_not_allowed`
/ `channel_unavailable` / `code_channel_unavailable` / `request_id_reused`, 413 / 415 / 422 for uploads and bodies, 429 with
`retry_after_s`.

**Internal users as assignees** (Q4, kept by D16): an internal assignee works in Arx (signed in). The CR-018 notification
`ticket.assigned` always reaches them; its deep link lands on the ticket with a one-tap "התקבל" (a CR-018 "ack" of the
notification does not acknowledge the ticket - the page says nothing about it, the button does it). If the user also has a
directory entry linked by `ticket_contacts.user_id` with a phone, the WhatsApp message carries a deep link to `#/tickets/<id>`
on the remote address (sign-in required, no token). No handler-page token is ever minted for an internal user (enforced by the
409 above, not only by this text).

> **Amendment 2026-10-16 (TKSTAFF1, owner request; security design review `TKSTAFF1_LINK_SECURITY_DESIGN_2026-10-16`, GO with
> conditions).** The invariant above ("no handler-page token is ever minted for an internal user") is **reversed for one scoped
> case**: an internal employee with an account who is the CURRENT assignee of a ticket, and whose directory row
> (`ticket_contacts.user_id`) has a mobile and the user's own "WhatsApp for my assignments" switch on, gets a WhatsApp message
> with a no-login **staff link** (`ticket_links.kind = 'staff'`). Reason: staff in the field update tickets from the phone without
> signing in, as vendors do. Trust boundary: *a staff link authorises the external-handler actions on one assignment of one ticket
> to whoever holds the message. It carries no identity. Everything the user may do beyond that requires signing in.* Rules: the
> page is the external view unchanged (never the user's visibility); writes are `actor_kind = 'contact'` / `via = 'link'`, audit
> actor `contact:<id>` - never the user's principal; no cost-claim or quote surface; a verification code by default
> (`staff_links.require_code`, raise only); `staff_links.*` lifetime (sliding 3 days, cap 14 days, grace 1 hour); WhatsApp only (no
> e-mail redeem, no "copy link"); revoked on reassignment, return, close, user deactivation, leaving the department or losing
> `tickets.view` there (`user_inactive`), the directory row set inactive or its mobile changed (`contact_changed`), and every
> revocation cancels the link's queued messages. The contact path keeps refusing a row that names a user (409
> `assignee_not_allowed`); the staff path is `services/tickets/staff_links.py`, reached only from the internal-user assignment.
> "New request" notices to `notify_new` managers stay signed-in deep links (no token). Precondition shipped with it: deep review B3
> (the reply button nonce bound to the link generation).
>
> **Addendum 2026-10-16 (independent security review of TKSTAFF1, lead decisions).** (1) Since TKSTAFF1 a staff member's OWN
> assignment names their directory row in `ticket_assignments.contact_id`: **`contact_id IS NOT NULL` no longer means "external
> assignment"; only `assignee_kind = 'contact'` does** - every cost / quote reader must follow this (`quotes.public_quote` / `submit`
> do). Every cost route (claim, claim file, quote) passes `link_context(claim_surface=True)` and answers a staff token with the
> uniform 404. (2) A number set by a `tickets.configure` holder is **pending until the signed-in employee confirms exactly that number**
> in their own account ("החשבון שלי" › "נייד לקישורי עבודה", `GET / PUT /tickets/me/staff-mobile`, last four digits only, an opaque
> token of the number shown); every change of the number clears the confirmation and tells the employee in the app (source
> `ticket.staff_mobile`); until confirmed no staff link is minted and the members card says so. The "WhatsApp on assignment" switch
> belongs to the employee; a configurer may only turn it off. (3) Unlinking `user_id` from a directory row revokes its live links.
> (4) Revocation window: deactivation by the HA directory push and removal from a department revoke at once; a change that removes
> membership through an HA group or `tickets.view` through a binding is caught by the SLA monitor's recheck (about 30 seconds, while
> the module is on). App-push-first (security design section 8 item 7) is not built - owner decision pending.

### 8.2 Giving a ticket permission to one specific user (D25)

**How RBAC works today (read in code):** there are no direct per-permission grants. A **binding** (`bindings` table, 0001 /
0032) gives a **role** to a subject - `subject_kind = 'user'` (one user) or `'group'` - at a scope (installation / site /
building / floor / camera), with `effect` allow / deny, an optional `expires_at`, `assigned_by` and `revoked_at`;
`rbac.authorize` (l.138) walks the subject's active bindings and the role's permission list. Bindings are created through
`POST /access/bindings` after `routers/access.py validate_binding` (l.803: `rbac.assign` on the scope, delegation limits
`check_delegation`, no duplicate) and audited `rbac.bind` / `rbac.unbind` (l.863 / 896). Custom roles (0011) may carry
sensitive permissions only by naming them explicitly, and never system permissions - the existing way to give one sensitive
permission to one person is a custom role bound to that user (the `PERMISSION_LABELS` comment at l.54 says so).

**Design (no new RBAC mechanism):** the module ships **eight single-permission built-in roles** in `roles.json` (the six below plus `tickets_costs_view` and
`tickets_costs` of D31, 11A.8):
`tickets_view` (צפייה בקריאות), `tickets_create` (פתיחת קריאות), `tickets_manage` (ניהול קריאות), `tickets_all_departments`
(כל המחלקות בקריאות), `tickets_external` (שליחה לגורם חיצוני), `tickets_configure` (הגדרות קריאות). Giving one of them to a
specific user = an ordinary **user binding** of that role at installation scope (or a site / building / floor scope, which then
limits it to tickets placed there - placeless tickets follow the "any held scope" rule of 8), optionally with an expiry. It adds
to whatever the user's roles already give; a deny binding still wins. Consequences:
- **Audit** is the existing `rbac.bind` / `rbac.unbind` row (subject, role, scope, expiry, actor), plus the permission
  revision bump that already invalidates caches and the assignee-picker cache.
- **Who may grant:** `rbac.assign` on the scope, as for any binding. The sensitive single-permission roles
  (`tickets_all_departments`, `tickets_external`, `tickets_configure`, `tickets_costs_view`, `tickets_costs`) are **not** in the default `rbac.delegable_roles`
  allow-list, so a delegated (site) administrator cannot hand them out unless the owner adds them; the three others are
  delegable by default.
- **Where:** the existing user permissions screen (bindings) offers these roles like any other; Settings › קריאות שירות gains a
  sub-tab **"הרשאות"** listing the users who hold any `tickets.*` permission and through what (role / group / direct grant), with
  "הוספת הרשאה למשתמש" (user, permission, scope, optional expiry) that calls the same binding route - one mechanism, one audit.
- Department membership (8) is still needed for department-scoped actions: a user granted `tickets_manage` must also be a
  manager member of a department (or hold `tickets.all_departments`) to manage its tickets; `tickets_external` alone allows
  only "שלח עכשיו" on tickets the user can see (D29).

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
`t:<reply_nonce>:<action>`, and for WhatsApp the **account** resolved at claim time from the use mapping, 9.9).
`status()` and `can_reach()` take the account for WhatsApp (state is per account). `SendResult` = (`sent` | `refused` |
`unknown` | `not_sent`, `outcome_code`, `provider_message_id`). The registry maps a key to an adapter; the outbox worker, the
inbound handler and the settings page see only the interface. An official WhatsApp Business adapter, and the **SMS** adapter
listed as future work (D13, 18A), implement the same five methods (receipts would then fill an optional `delivered_at`); the
outbox `channel` CHECK and the fallback order (9.5) are the only places that name channels.

### 9.2 Outbox and paced worker (`services/tickets/outbox.py`)

- Every outbound message is first **written** (outbox row + timeline row + audit row, one transaction), then sent by one daemon
  thread `tickets-outbox` (started in `_start_janitor`, stopped in `_stop_janitor`). If the row cannot be written, nothing is
  sent (the CR-036 rule).
- One message in flight at a time **per WhatsApp account** (and one per e-mail channel). Pacing is **per account** and lives in
  the account definition (9.9), not in the tickets settings, because two uses (or two modules) on one number share one budget;
  the budget is counted in `messaging_send_ledger` (rows `sent` and `unknown` count - an `unknown` may have left). Defaults
  chosen for a personal-number Baileys session (`[WA-DOC]` gives no numbers, only "don't send hundreds per minute"):
  - minimum gap between two sends on one account: **15 s + random 0-10 s** (human-like spacing);
  - at most **30 per hour** and **150 per day** per account (codes included - the number's ban risk does not care why);
  - at most **4 messages per hour** to one recipient per account - **codes excluded** (review C9 / T5b); codes have their own
    caps (10.5) and at most 6 per hour to one recipient across all links;
  - verification codes jump the queue (`priority 0`).
- **Send hours (D4).** Messages to contacts leave only inside the send window of the ticket's department (override) or of the
  installation (default 07:00-21:00, installation `time.zone`, every day). Outside it:
  - `reminder`, `closed`, `reassigned`, `reopened`, `update` are `held` (`held_reason = 'send_hours'`, `not_before` = the next
    opening) - **also for `critical` priorities** (review T21); the manager alerts of CR-018 are not affected;
  - `code` is never held (the vendor asked for it a second ago);
  - `assign` (D29): held until the opening; the assign dialog shows "יישלח ב-07:00" and a "שלח עכשיו" choice (`send_now`),
    preselected for priorities whose severity is `critical`; later, anyone holding `tickets.external` who can see the ticket can
    release the held message from the ticket page ("שלח עכשיו", `send-now` route).
  - The CR-018 quiet-hours rule of r1 for reminders is replaced by this window (one rule for vendors, one for users).
- **Held while the module is off** (`held_reason = 'module_off'`): the worker does not send; on re-enable the normal
  supersede / cancel rules run first.
- `not_sent` (provably never left: HA unreachable before the request, service missing, account not found, account
  disconnected, no phone) → retried up to 3 times over 30 min, then **fallback** (9.5). `refused` → no retry, fallback.
  `unknown` (timeout after the request was sent, connection dropped mid-request, HTTP 500, malformed response) → **never
  retried** automatically and **never re-routed** (a retry could duplicate a message with a working link); the state stays
  `unknown` for good; the manager sees "ייתכן שנשלח" with a "שלח שוב" action, which creates a **new** outbox row (the old row
  keeps `unknown`).
- A newer message of the same purpose for the same assignment supersedes a queued / held older one (`superseded`); a revoked
  link cancels its queued and held messages.
- When the row's account is `disconnected` / `missing`, the worker does not call it; rows are `held` (`channel_down`) up to
  `hold_when_down_min` (per account, default 15) and then go to fallback. A row whose use has **no** account mapped is `held`
  (`account_unmapped`) for the same time, then falls back. Account changes and disconnects in detail: 9.9.4.

### 9.3 WhatsApp adapter (`services/tickets/channel_whatsapp.py`)

- Calls **only** `whatsapp.send_message` and (when `use_buttons` is on) `whatsapp.send_buttons` through
  `ha_client.call_service(settings, "whatsapp", <service>, data, return_response=True)` - a hard-coded allow-list of two services
  in the adapter; nothing else in the `whatsapp` domain is ever called (no `configure_webhook`, `send_image`, groups, auto
  responder). `data = {"account": <account value>, "target": <digits>, "message": <text>}`, where `<account value>` is the
  config **entry id** of a discovered account or the typed value of a manual account (9.9; `account` is always sent, even with
  one account, so a second paired number never turns sends into "Multiple WhatsApp accounts found" errors); `send_buttons` adds
  `buttons: [{"id": "t:<nonce>:ack", "displayText": "התקבל"}, {"id": "t:<nonce>:wip", "displayText": "בטיפול"}]` and
  `footer`. `[WA-DOC]` documents that `send_message` with `response_variable` returns `success` and `message_id`; whether the
  REST `?return_response` path returns the same object is **UNVERIFIED** (slice 5 checks it on the owner's installation, read +
  one approved test send). If no `message_id` comes back, button matching uses the nonce only (9.6) - nothing depends on it.
- **Buttons default OFF** (`use_buttons: false`): `[WA-DOC]` warns modern multi-device clients may show text only. The default
  message asks for a **numbered text reply** ("1 = התקבל, 2 = בטיפול"), which every client can send. Polls are not used (votes
  need the original poll in the bot's memory `[WA-DOC]`).
- Media: none in release 1 (photos stay in Arx; `send_image` needs a URL reachable by the add-on and would put a photo URL in
  WhatsApp).
- Status is **per account** (9.9.2): a discovered account's state comes from its connectivity binary sensor in the
  `ha_entities` mirror (`[WA-SRC]`, no extra HA call); a manual account may name a status entity, else its state is derived
  from sends (two consecutive `not_sent` with `service_not_found` / `account_not_found` / HA errors → `disconnected`; a `sent` →
  `connected`). A "שליחת בדיקה" button per account in Settings sends one fixed text to a number the administrator types
  (purpose `test`, 3/h per account, audited, ledger kind `test`; each use of it during development is a separately approved
  live action, review C14).
- The 14-day rule `[WA-DOC]` (the phone must connect at least every 14 days or every linked device is logged out; the
  integration then raises an HA repair issue): the account page shows "last successful send" and the state; when an account
  that is mapped to a use turns `disconnected` / `missing`, the CR-018 signal `ticket.channel_down` (category system, dedupe per
  account) reaches `system.configure` and `messaging.accounts.manage` holders; the guide tells the installer to keep the
  dedicated phone charged and online and to re-pair from the add-on when logged out.
- **Dedicated number (Q5, kept by D16):** a separate WhatsApp (Business app) number used only for tickets, on a phone that
  stays on site. Reasons: ban risk is per number (Baileys is unofficial; `[WA-DOC]`: "may ... lead to a permanent account ban");
  mixing with a person's chats exposes ticket links in their chat history; sharing with the access-control messages (CR-036 WA,
  via WisKey) shares one pacing budget that Arx cannot see. The dedicated phone is **inside the trust boundary**: it holds every
  link ever sent. The account page warns when a ticket account is shared (9.9.3).

### 9.4 Outcome classification (adapter, not `call_service`)

`ha_client.call_service` already classifies HTTP statuses (400/404 → `service_not_found`, 401/403 → `ha_forbidden`, other ≥300
→ `ha_error`) but turns every `httpx.HTTPError` exception into one 503 (review C6). The adapter therefore calls a thin variant
`ha_client.call_service_classified(...)` (new, same request, same status mapping) that only adds the exception split:
`httpx.ConnectError` / `ConnectTimeout` → `not_sent` (`ha_unavailable`); `ReadTimeout` / `RemoteProtocolError` after the body
was written → `unknown` (`timeout`). Mapping to outcomes: `service_not_found` → `not_sent`; `ha_forbidden` → `not_sent`;
HTTP 400 whose body names the account ("account ... not found" / "Multiple WhatsApp accounts", `ServiceValidationError`
`[WA-SRC]`) → `not_sent` (`account_not_found`, the account is marked `missing` until the next mirror refresh); HTTP 500 →
`unknown` (`ha_error`: HA may have called the integration); 200 with `success: false` in the response → `refused`; 200
otherwise → `sent`. How HA reports a `ServiceValidationError` over REST (status code and body) is **UNVERIFIED** (slice 5b's
fake follows HA core's documented behaviour; the live check confirms). The 15 s timeout stays.

### 9.5 Fallbacks

Order per recipient (D13), decided when a send ends `not_sent` after retries, `refused`, or the account is down / unmapped past
`hold_when_down_min`. An `unknown` outcome never triggers a fallback (it may have arrived).
1. **Internal user:** CR-018 in-app notification `ticket.assigned` (always created anyway; the inbox and push reach the user).
   The department's managers also get `ticket.send_failed` in-app whenever a contact could not be reached by WhatsApp.
2. **Contact with an e-mail address:** the same text by e-mail through `channel_email.py`, which reuses
   `notify_email.smtp_send(cfg, to, rendered)` with the existing SMTP configuration (a separate per-module counter, 10/hour; the
   CR-018 admin recipient list is not involved). The e-mail carries the **redeem link** `/t/r/<id>`, never the fragment token
   (10.2). If SMTP is not configured, skip.
   **Code-protected assignments (D6):** the e-mail fallback is used for the link only if the code can still go by WhatsApp
   (the codes account is connected and the contact has a phone); otherwise skip to step 3.
3. **Nobody reachable:** the ticket goes to "waiting for manager" with reason `send_failed`; the ticket page shows one line
   "ההודעה לא נשלחה" and two actions: "העתק קישור" (copies the handler URL so the manager can send it himself - the only place
   a link is shown in the UI, manager with `tickets.external`, audited `ticket.link.copy`; `ticket_links.sent_via = 'manual'`) and "שלח שוב".
4. (future, 18A) SMS slots in between 1 and 2 when built; nothing in release 1 refers to it.

Nothing is ever re-sent on WhatsApp after a fallback succeeded, even if the account reconnects (one delivery path per message).

### 9.6 Inbound matching (`services/tickets/inbound.py`)

Subscription: when the module is on, `tickets.settings.whatsapp.enabled` is true and at least one ticket use has a WhatsApp
account mapped, `ha_sync` subscribes to
`whatsapp_message_received` and `whatsapp_button_pressed` (a new `TICKET_EVENTS` tuple next to `AUTOMATION_EVENTS`, l.93; a
branch in `on_message`, l.784, that hands the raw event to `inbound.submit(event)` - a bounded queue (200, overflow dropped and
counted) drained by the outbox thread, so the websocket thread never writes). The raw event is **never logged** (it holds a phone
number and message text). Its `media_url` is **never fetched** - a rule, not an omission (review T11-3).

**Account filter (first step, 9.9):** when the event carries `entry_id` (`[WA-SRC]`; UNVERIFIED on the installed version), it
is processed only if `entry:<entry_id>` is mapped to a ticket use now, or sent a ticket outbox row within `reply_window_h`;
anything else (the owner's other numbers, the intercom, private chats) is dropped **before** any row is written (a counter in
health only). Without `entry_id`, every event is processed as in r1 and `account_key` stays NULL.

**Trust boundary (stated plainly):** an HA event is not authenticated by WhatsApp. Any HA administrator, automation or script can
fire `whatsapp_message_received` with any `sender_number` (HA `fire_event`). Therefore inbound messages are **advisory**: they can
only move a ticket **forward** to `acknowledged` or `in_progress`, or add a note marked "via WhatsApp (unverified sender)"; they
can never set `done`, `waiting_part`, return, close, change an ETA, or change the status of a ticket whose live link requires a
code (a reply for such a link is recorded as a note only). Everything with consequence happens on the handler page (token + optional
code) or in Arx.

Matching steps:
1. Ignore unless `type` in (`chat`, `text`, `button_reply`, `list_reply`) or the event is `whatsapp_button_pressed`; ignore group
   senders (`@g.us`), empty content, content over 1000 characters (kept as `ignored`).
2. `sender_key = HMAC(k_tickets, digits(sender_number))` when `sender_number` yields 8-15 digits; otherwise (empty, an `@lid`
   identifier, anything non-numeric - review T12b, WhatsApp LID addressing `[EXT, unverified]`) `sender_key = NULL`.
   **Freshness (review T12a):** `provider_at` more than 2 minutes in the future, or older than `reply_window_h` → `stale`
   (envelope only). Older than **10 minutes** but inside the window → processed as a **late** reply: it can never change a
   status; its text becomes a note flagged "התקבלה באיחור" (`result = 'late'`) and the ticket goes to "waiting for manager"
   (`late_reply`) - a vendor's "1" sent while the dedicated phone was offline is shown, not dropped. **Dedupe:** `dedupe_key`
   unique for 24 h → `duplicate` (the received event has no message id `[WA-DOC]`, so the key is built from account, sender,
   timestamp, type, selected id and content).
3. **Button tap** (`selected_id` / `button_id` = `t:<nonce>:<action>`): look up `ticket_outbox.reply_nonce`; its link must be
   live and its assignment current; when the event's `account_key` is known it must equal the row's `account_key`. Sender check:
   if `sender_key` is not NULL it must equal the contact's `phone_key` (else `refused`, audited); if `sender_key` is NULL the
   **nonce alone** decides (it exists only inside the message sent to that contact - the same trust as the link holder; the
   action is advisory anyway). `whatsapp_button_pressed.message_id`, when present and stored, is a second check.
4. **Text reply** (needs `sender_key`; NULL → `unknown_sender`): candidates = live assignments of contacts with `phone_key ==
   sender_key` whose last `sent` outbox row is within `reply_window_h` (default 72) and - when the event's account is known - was
   sent from that account. Parse: a ticket reference `#?\d{1,7}` anywhere narrows candidates to that number; an action word or
   digit: `1` / "התקבל" / "קיבלתי" / "received" / "ok" → `acknowledged`; `2` / "בטיפול" / "מטפל" / "in progress" →
   `in_progress`; anything else → note.
   - exactly one candidate → apply (status if forward-only and allowed, else note);
   - zero candidates (unknown sender, or no recent message) → `unknown_sender`, nothing stored but the envelope;
   - several candidates and no reference → `ambiguous`: the text is kept (<= 1000 chars, 30 days); the managers of every
     candidate ticket's department see "תשובה לא משויכת" in "waiting for me" with the **sender's display name and the time
     only**; the text is revealed only to a manager who claims it ("זה שלי", audited), who then attaches it to one of their
     tickets or dismisses it (review T13-2: no cross-department text leak).
5. **No automatic replies** in release 1 (Q14): every auto-reply is an extra message on a ban-sensitive number and a way for a
   stranger to probe which numbers are known.
6. Every applied action is a timeline row (`actor_kind = 'inbound'`, `via = 'whatsapp'`) and an audit row `ticket.inbound`
   (envelope: result, ticket, outbox id; no number, no content).
7. A sender who is an internal user with a directory phone (`ticket_contacts.user_id`) gets the same advisory treatment for
   tickets assigned to that user.

### 9.7 Message templates and content rules

Message templates (`ticket_templates kind='message'`) per purpose, department-specific or installation-wide, Hebrew, with an
allow-list of placeholders: `{name}`, `{number}`, `{department}`, `{title}`, `{place}`, `{device}`, `{priority}`,
`{organization}`, `{link}`, `{code}` (code template only), `{manager}`, `{eta}`, `{module_name}`, `{module_name_plural}`
(D33, 14.3). Saved templates are validated: unknown
placeholders, Unicode `Cc` / `Cf` characters (control, bidi, zero-width - review T9), a URL that is not `{link}`, more than
1000 rendered characters → 422 field problems. `{link}` is mandatory in `assign` / `reminder` / `reopened` / `update`
templates for contacts; `{code}` is mandatory in, and allowed only in, the `code` template, and the code message contains **no
link and no ticket title** (separate channel discipline: forwarding the link message alone is not enough). Starter templates
ship for each purpose. Times (`{eta}`) render in the installation's `time.zone` (review C12). **Languages (D26):** each purpose has a template per
language (`ticket_templates.lang`); the contact's `lang` picks it, falling back to Hebrew when a department has no template in
that language; starter templates ship in he / en / ar / ru (the ar / ru starters need a native speaker's review before the
release - a build item of slice 8, not an owner question). `{department}` sits next to the
number in every starter template so "#1042" is never ambiguous (review Q13). Default `assign` text:

```
שלום {name},
קריאה {number} ({department}): {title}
{place}
לעדכון הטיפול: {link}
לאישור מהיר השב 1 = התקבל, 2 = בטיפול
```

Default `reopened` text begins "קריאה {number} ({department}) נפתחה מחדש". The assign dialog shows the exact rendered text
before sending (`assign/preview`, review T13-3). The rendered text is never stored (the outbox keeps template id + revision +
params without `{link}` / `{code}`).

**Timeline wording (D14):** a WhatsApp send that ended `sent` is shown as "נשלח בוואטסאפ - מסירה לא ידועה · 14:02" (the
product never claims delivery or reading); `unknown` as "ייתכן שנשלח · 14:02"; `not_sent` / `refused` as "לא נשלח"; the
first open of the link as "הקישור נפתח ב-14:05" (later opens update the line's count: "נפתח 3 פעמים, אחרון 16:40"). An e-mail
send reads "נשלח במייל - מסירה לא ידועה". Times are local (installation zone).

### 9.8 Relation to CR-018

The ticket channel is not a CR-018 delivery channel in release 1 (CR-018 delivers only to users; tickets talk to non-users). The
adapter is written so CR-018 can later register a `whatsapp` channel that wraps the same `TicketChannel` (removing it from
`CHANNELS_RESERVED`) - a separate decision. `CHANNELS_RESERVED` stays untouched in release 1 (review C16).

### 9.9 WhatsApp accounts and uses (`services/messaging_accounts.py`, new in r2 - D9)

An installation-level service, outside the tickets package, so that other modules can later send through a chosen account with
the same pacing. Tickets is its first client. It never writes to `ha-whatsapp` or to Home Assistant.

#### 9.9.1 Accounts

An **account** is one linked WhatsApp number. Two kinds:

| Kind | Key | Identity sent as `account` | Where it comes from |
|---|---|---|---|
| discovered | `entry:<config_entry_id>` | the config entry id | the entity mirror: `ha_entities` rows with `platform = 'whatsapp'`, grouped by `config_entry_id` (4.1). No new HA call; appears/disappears with the normal registry refresh. |
| manual (fallback) | `manual:<random id>` | the typed value, unchanged (digits of the number, or an entry id) | typed by a holder of `messaging.accounts.manage` when discovery finds nothing (an `ha-whatsapp` version without the entities, entities disabled, or a renamed platform). |

Per discovered account Arx derives, read-only:
- **connection entity** = the entity of the group whose `unique_id` ends in `_connection` (`[WA-SRC]`), else the group's
  `binary_sensor` with `device_class = 'connectivity'`; if none, the account has no status entity (state from sends, as manual);
- **state**: connection entity `on` → `connected`, `off` → `disconnected`, `unavailable` / `unknown` / HA websocket down →
  `unknown`; account group gone from the registry → `missing`;
- **label**: typed by the administrator; suggested on first discovery as "וואטסאפ ····<last 4>" from the connection entity's
  `phone_number` attribute, read **on demand** with `ha_client.get_state` when the account page is opened (never mirrored, never
  logged; only the last four digits are kept in the document). If the attribute is absent or masked ("Mask Sensitive Data"),
  the suggestion is "וואטסאפ <first 6 chars of the entry id>".

The mapping document `messaging.whatsapp` (settings key, revision-checked, `SETTINGS_KEEP`, never in `GET /settings`):

```json
{
  "revision": 3,
  "accounts": [
    { "key": "entry:01JABC...", "kind": "discovered", "label": "וואטסאפ קריאות ····4567", "last4": "4567",
      "shared_outside": false,                    // admin mark: "also used outside Arx" (WisKey, the intercom, a person)
      "pacing": { "min_gap_s": 15, "jitter_s": 10, "per_hour": 30, "per_day": 150, "per_recipient_hour": 4, "hold_when_down_min": 15 },
      "removed": false },
    { "key": "manual:k3f9", "kind": "manual", "label": "מספר ישן", "account": "972501234567",
      "status_entity_id": null, "connected_states": ["on", "connected", "online"],
      "shared_outside": true, "pacing": { ... }, "removed": false }
  ],
  "uses": {
    "tickets.messages": "entry:01JABC...",          // (a) installation default for ticket messages
    "tickets.messages@dept:<department_id>": "manual:k3f9",   // (b) optional per-department override
    "tickets.codes": null                            // (c) null = inherit (a)
  }
}
```

The manual `account` value is not secret but it is a phone number: masked in every API answer except to
`messaging.accounts.manage`, never in audit (audit carries account **keys** only).

#### 9.9.2 Uses (the registry other modules join)

A **use** is declared in code (like CR-018 sources), not in the database:

```python
@dataclass(frozen=True)
class UseSpec:
    key: str                 # 'tickets.messages'
    module: str              # 'tickets'
    label_he: str            # 'הודעות קריאות שירות'
    inherits: str | None     # 'tickets.codes' -> 'tickets.messages' (resolution falls back to the installation value of this use)
    per_department: bool     # True -> the settings screen offers overrides 'tickets.messages@dept:<id>'
    required: bool           # True -> the module's WhatsApp channel is "not configured" until it resolves
    active: Callable[[sqlite3.Connection], bool]   # shown / resolved only while the owning module is on

USES: tuple[UseSpec, ...] = (*tickets_uses(),)   # a later module appends its own tuple, nothing else changes

def resolve(conn, use_key: str, *, department_id: str | None = None) -> AccountRef | None: ...
```

Tickets registers (owner requirement 10):

| Use | Meaning | Resolution order |
|---|---|---|
| `tickets.messages` | assignment, reminder, closed, reassigned, reopened, update messages | `tickets.messages@dept:<ticket's department>` → `tickets.messages` → none (`account_unmapped`) |
| `tickets.codes` | verification codes | `tickets.codes` → **`tickets.messages` (installation value, not the department override)** → none |

The `tickets.codes` default follows the owner's wording "default = same as (a)" literally: the code comes from the
installation's ticket number even when a department sends its links from its own number. That is acceptable (a different number
for the code is, if anything, a stronger separate channel); if the owner prefers "same number as the link", it is a one-line
change in the resolution order (recorded, not asked).

**Pacing is per account** (9.2): every use resolved to the same account draws from one ledger budget; a manual account and a
discovered account that are in fact the same number are not detected automatically - the screen **refuses** a manual value
equal to a discovered account's entry id, and **warns** (amber "ייתכן שזה אותו מספר") when the manual value's last four
digits equal a discovered account's `last4` (a heuristic, stated); beyond that it relies on the administrator.

#### 9.9.3 The settings screen (Settings › "חשבונות וואטסאפ", `#/system/messaging-accounts`)

A settings screen (naming WhatsApp is allowed; HA is called "תשתית המערכת"). Read: `system.configure` or
`messaging.accounts.manage`; edit: `messaging.accounts.manage`. Two parts:
1. **Accounts:** one row per account: label, last four digits, state chip (מחובר / מנותק / לא ידוע / לא נמצא), "since",
   last successful send, today's sends / daily cap, the uses mapped to it, pacing (expandable), "שליחת בדיקה", and for manual
   accounts the typed value and optional status entity. "רענון" re-reads the mirror (`POST /messaging/whatsapp/refresh`).
   "הוספה ידנית" adds a manual account.
2. **Uses:** one row per active use, grouped by module: a picker of accounts (discovered first), "ללא" for optional uses,
   "כמו ..." for inheriting uses; for per-department uses, an expandable list of departments with "ברירת המחדל" or an account.
   The tickets settings tab "ערוץ הודעות" shows the same ticket rows read-only with a link here.

**Warnings** (on this screen and in the tickets channel tab; never on operator screens):
- a ticket use's account is also mapped to a use of **another module** → amber "המספר משותף גם ל<מודול> - קצב שליחה משותף";
- a ticket use's account is marked `shared_outside` → amber "המספר משמש גם מחוץ למערכת";
- a mapped account is `disconnected` / `missing` / `unknown` → red / grey chip on the use row;
- a required use (`tickets.messages`) is unmapped while the module is on → red "לא נבחר חשבון - הודעות לא יישלחו בוואטסאפ";
- (info) codes and messages resolve to the same account → no warning (the default).

Saving: revision check (409 `settings_stale`); a change that moves a use while messages are queued for it shows the count first
("3 הודעות ממתינות יישלחו מהחשבון החדש") and asks to confirm; audit `messaging.accounts.update` with the changed use keys and
account keys (before / after), never numbers.

#### 9.9.4 Account changes and disconnects (never a silent resend; `unknown` stays `unknown`)

The outbox resolves the account **when the worker claims a row** (`queued` → `sending`), and records it in
`ticket_outbox.account_key`. Therefore:

| Situation | `queued` / `held` rows | `sending` (in flight) | `sent` | `unknown` | Replies |
|---|---|---|---|---|---|
| Use moved to another account | leave from the **new** account at their turn (they never left, so this is not a resend; owner decision D27); the timeline line of each such message names the account label it left from | finishes on the account it was claimed with; its outcome stands | unchanged | **stays `unknown`**; never re-sent; "שלח שוב" (a manager's act) creates a new row on the current mapping | accepted from the **old** account for `reply_window_h` (the row's `account_key` is the reference) |
| Account `disconnected` / `unknown` | `held` (`channel_down`) up to `hold_when_down_min`, then fallback (9.5); **no automatic switch** to another account | the request either returns (outcome stands) or times out (`unknown`) | unchanged | stays `unknown` | n/a |
| Account reconnects | still-held rows leave normally; rows that already fell back are **not** sent again on WhatsApp | - | - | stays `unknown` | resume |
| Account `missing` (config entry gone, e.g. re-paired as a new entry) | as disconnected; the use keeps pointing at the missing key (so nothing is silently re-routed); `ticket.channel_down` tells administrators to map the new account | as above | unchanged | stays `unknown` | until `reply_window_h` |
| Use unmapped (set to "ללא") | `held` (`account_unmapped`), then fallback | as above | unchanged | stays `unknown` | until `reply_window_h` |
| Pacing after a move | the new account has its own ledger budget; the old account's sends keep counting against the old account | | | | |

Codes: a code already sent stays valid on its own expiry whichever account sent it; a new code uses the current
`tickets.codes` resolution. Links are not tied to an account (the account only carries the message), so moving a use never
revokes a link.

#### 9.9.5 What is read-only available and what needs a live look

| Item | Status |
|---|---|
| Grouping entities by `platform = 'whatsapp'` + `config_entry_id` from the existing mirror | available in code today (`ha_sync`), no new HA call |
| The connectivity binary sensor, its `unique_id` suffix `_connection`, its `phone_number` / `connection_state` attributes | `[WA-SRC]` - **UNVERIFIED** on the owner's installed version |
| `account` = entry id accepted by `send_message` / `send_buttons` | `[WA-SRC]` - **UNVERIFIED** on the installed version |
| `entry_id` on received / button events | `[WA-SRC]` only (not in `[WA-DOC]`) - **UNVERIFIED** |
| Config entry titles through HA's config-entries API with the Supervisor token | **UNVERIFIED**; not needed |
| REST status/body of a `ServiceValidationError` (unknown account) | **UNVERIFIED** |
| Whether two config entries can live in one add-on instance on the owner's setup | docs contradict each other (4, item 4) - irrelevant to the design, relevant to the installer guide |

Slice 5a's live check (owner-approved, read-only: one `get_states` / registry read of the `whatsapp` platform, one
`get_state` of each connection entity, no send) settles the second row before the discovery code is final. The third and
fourth rows need slice 5b's separately approved test send (to the owner's own number, with `account` = entry id) and one test
reply from the owner's phone; until then the matcher and the sender are built against the fake and both shapes (with and
without `entry_id`) are tested.

## 10. External handler links

### 10.1 Where the page lives (decision with recommendation, Q2)

| Option | How | Pros | Cons |
|---|---|---|---|
| **A (recommended)** - dedicated listener + dedicated hostname | Public app on container port 18093 (add-on option `tickets_public`); a Cloudflare tunnel route `t-<customer>.<arx-domain>` → `http://<addon-host>:18093` (D11/D14 of CR-008: the provisioning script creates it on the Arx zone). Container ports are reachable by `cloudflared` on the add-on network without a host port mapping; LAN exposure only if the owner maps 18093 (not needed). | **Separate origin** from HA and `/arx` (an XSS in the vendor page cannot read `hassTokens` or the Arx session; Arx/HA cookies never reach it); the listener contains only `/t/*` routes - no route-enumeration risk, no Ingress trust, no reliance on `PUBLIC_ON_REMOTE`; independent of `remote_access`. | One more tunnel hostname per customer; one more listener in the process. Reachability via `cloudflared` on the container port is **UNVERIFIED** on the owner's setup (slice 4 checks it with the owner). |
| B - under the remote channel | `/arx/t/...` on the existing `remote_access` tunnel | No new hostname | Same origin as HA and Arx (`hassTokens` in a manager's browser who opens a link); needs `remote_access` on; every remote-channel guard (`RemoteChannel`, `pre-gate.ts`, `PUBLIC_ON_REMOTE`, the 64 KiB anonymous cap) must be punched through for uploads. |

Release 1 builds **A only** (Q2, kept by D16). Without a configured `public_base_url` (https, a hostname, no path beyond `/`),
external assignment is disabled with a clear reason in Settings and in the assign dialog. Conditions (review Q2): the port stays
unmapped on the host; the forwarded client address is trusted only from known peers (10.2); a Cloudflare rate-limiting rule and
"zone script features off" for the `t-*` hostname are required install steps (slice 8).

**Server isolation (review R1 / T17 / C1 - D1).** The public app shares the add-on process with the main app; these rules keep
an anonymous flood from degrading the product:

| Rule | Value | Why |
|---|---|---|
| Own daemon thread `tickets-public` with its **own asyncio event loop** running `uvicorn.Server(config).serve()` | - | the main app's loop, its threadpool and its websocket work are not shared |
| Own anyio threadpool limiter for sync handlers | 4 tokens | public sync work cannot exhaust the main app's 40-token default |
| `uvicorn.Config(..., access_log=False, server_header=False, date_header=False, log_config=None, proxy_headers=False, forwarded_allow_ips=None)` | - | no per-request access line with paths and client addresses (review T16-1); no `Server` banner; no uvicorn-side forwarded-header trust (the app decides, 10.2) |
| `limit_concurrency` | 16 | slowloris-style connection hoarding is bounded; excess gets 503 |
| `timeout_keep_alive` | 5 s | idle connections are closed early |
| `h11_max_incomplete_event_size` | 16 KiB | header floods |
| Body read deadline (the public app's own body-limit middleware) | 10 s for JSON, 60 s for a photo | a 1 KB/s upload cannot hold a parser for minutes |
| Signal handling | none: `uvicorn.Server` skips signal capture outside the main thread (uvicorn 0.53 `capture_signals`) - the slice asserts it with a test, and `_stop_janitor` sets `server.should_exit` and joins the thread (5 s) | the add-on's stop must not hang (review T17, `[EXT]`: verify against the pinned uvicorn in slice 4) |
| Rate-limit check **before** any database read | - | 300 unknown-token requests/min never become 300 SQLite reads (review T2) |
| One in-flight upload per link | 429 `busy` for a second concurrent upload | per-token concurrency |
| Own decode semaphore (10.6) | 1 decode at a time, 5 s wait → 429 | the administrator's own uploads never wait for anonymous ones |
| SQLite writes | every accepted write is one short transaction through the normal write gate; no gate held across image work (`unlocked(conn)`) | writes are rate-limited to 20 updates/h per link, so the shared gate sees human-scale traffic |

r1 suggested "an extra `uvicorn.Server` task next to the cast relay" in the main loop; that is replaced by the thread above.
The review's alternative (a `ThreadingHTTPServer` with a hand-written router, the cast relay pattern) was not chosen: the
public API needs multipart parsing and strict JSON validation, which FastAPI already gives; the thread + loop gives the same
isolation from the main loop.

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
- **Lifetime (D5 - sliding expiry, cap, grace; all durations in Settings):**
  - Settings (14.1): `links.sliding_days` (default **14**, range 1-90), `links.cap_days` (default **90**, range 7-365, ≥
    `sliding_days`), `links.grace_hours` (default **24**, range 0-168); each overridable per department (`ticket_departments.
    link_sliding_days / link_cap_days / link_grace_hours`, NULL = installation value). The effective values are those of the
    ticket's department at the moment of each computation.
  - At mint: `cap_at = created_at + cap_days`; `expires_at = min(cap_at, now + max(sliding_days, resolve_within(priority) + 1
    day))`, where an empty (off) resolve threshold counts as 0 - the first expiry always covers the priority's resolve window (review C10: a low-priority 30-day ticket gets a
    31-day first window, not 14).
  - **Sliding:** every assignee action through the link (status, note, photo, ETA, a verified code), every manager resend, and
    every reminder sent for the assignment move `expires_at` to `min(cap_at, now + sliding_days)` (never backwards). Opening the
    page alone does not extend (a preview fetch must not keep a link alive; an open without the header does not even count).
  - **Cap reached:** the link expires; the ticket goes to "waiting for manager" (`link_expired`) - the manager's "קישור חדש"
    (bump generation) mints a new token with a new cap.
  - **Setting changes:** a lower `cap_days` pulls `cap_at` (and `expires_at`) of live links in at once (exposure shrinks
    immediately); a higher one applies to new links only. A changed `sliding_days` applies from the next extension. A changed
    `grace_hours` applies to tickets closed after the change. (The same raise/lower asymmetry as `require_code`.)
  - **Close / cancel:** the link is not revoked at once: `grace_until = now + grace_hours`; until then the page is **read-only**
    ("הקריאה נסגרה, תודה" + the handler's own timeline); afterwards it answers the uniform 404 (review C11). With `grace_hours =
    0` the link is revoked at close as in r1.
  - **Revoked at once (no grace):** reassign, return / "לא שלי" (D12), manual revoke, key rotation, contact phone/e-mail
    change, contact erase, new generation. After a return the page renders the final confirmation from the return response
    itself; the next request already gets 404.
  - A resend while the assignment is current sends the same live token (and extends the sliding expiry); "קישור חדש" bumps the
    generation (new token, new cap, old token dead).
- **Rate limits** (public app; in-memory buckets with persistence through `RateLimiter`, which gains a `scope` parameter - scope
  `tickets_link` - and its own flush/restore step in the janitor, review C5): checked **before** any database read.
  - Client network key: `/64` (IPv6) or `/24` (IPv4) of `CF-Connecting-IP` **only when the TCP peer is inside
    `tickets.settings.public.trusted_proxy_cidrs`** (default `["172.30.32.0/23"]`, the hassio network where `cloudflared`
    runs); any other peer (a mapped host port, the LAN) is keyed by its own address and the header is ignored (review T1a).
  - Unknown token → 20 failures/min per client network and 300/min installation-wide, then 429 for everyone unknown. Known
    token → 60 requests/min, 20 updates/hour, 10 photos/hour, 30 photos total per assignment; code endpoints as in 10.5;
    redeem endpoint 10/min per network.
  - The 429 page text is "יש עומס. נסו שוב בעוד דקה." - never the "unavailable" text (review T1b).
- **Uniform answers:** unknown, expired, revoked, past grace, module off, ticket purged → the same `404 {code:
  "link_unavailable"}` and the same page text ("הקישור אינו זמין עוד. לפרטים פנו למי ששלח לכם אותו."). Timing: after the
  rate-limit check, the lookup is one indexed hash read in every case.
- **E-mail form - redeem link (review R7 / T3-2):** corporate mail scanners rewrite links into their own query parameters and
  log them, so an e-mail never carries the fragment token. It carries `https://t-<customer>.<arx-domain>/t/r/<rid>` (`rid` =
  128-bit random, stored as `sha256` in `ticket_link_redeems`, valid 24 h). `GET /t/r/<rid>` returns the **same static shell**
  (no lookup, no side effect - a scanner's prefetch consumes nothing); the page shows one button "פתיחת הקריאה"; the press
  sends `POST /t/api/redeem {rid}`, which returns the current token (at most **3** releases per `rid`, within 24 h) and the page
  continues exactly as `/t/#<token>` (token in memory, address bar replaced). Honest residual, stated in the guide: whoever
  reads the scanner's logs within 24 h can redeem; the e-mail form is weaker than WhatsApp, and code-protected assignments
  still need the WhatsApp code (D6).

### 10.3 Public API (public app, port 18093; JSON; `X-Ticket-Token` header required on every `/t/api/*`)

| Route | What | Notes |
|---|---|---|
| `GET /t/`, `GET /t/r/<rid>` | static page shell (HTML, JS, CSS from `www-public/`) | identical for everyone, no lookup |
| `GET /t/healthz` | `{"ok": true}` - for the administrator's address probe | no lookup, no token |
| `POST /t/api/redeem` | `{rid}` → `{token}` | e-mail form, 10.2 |
| `GET /t/api/ticket` | the handler view: number, title, description, department name, priority name, place text, device name, the short history list (only if the department shares it and the device domain allows it, 12.3), the assignee's own timeline items and the manager's notes and photos marked `visible_external`, current status, ETA, the allowed actions, `code_required` / `code_ok`, `read_only` (grace), the organization name, the assigner's display name, `time_zone` | never: other assignees, internal notes, internal photos, phone numbers, user ids, HA names, other tickets |
| `POST /t/api/status` | `{status: acknowledged\|in_progress\|waiting_part\|done, note?, client_request_id}` | forward and lateral moves only per 11.2; idempotent |
| `POST /t/api/note` | `{text, client_request_id}` (<= 2000, plain) | |
| `POST /t/api/eta` | `{eta_at, client_request_id}` (UTC ISO; picked in the installation zone; within 90 days, not in the past) | |
| `POST /t/api/photo` | multipart, one image, `client_request_id` form field | section 10.6; one in flight per link |
| `GET /t/api/photo/{attachment_id}` | a photo of the assignment's ticket that is `visible_external` | `Cache-Control: private, no-store` |
| `POST /t/api/return` | `{kind: cannot_handle\|not_mine, reason, client_request_id}` - reason **required** (1-500) for both | D12: "לא שלי" = `not_mine`; returns the ticket to the manager and revokes the link at once (10.2); "לא אוכל לטפל" = `cannot_handle`, same effect, different reason code for the board |
| `POST /t/api/code/send` | ask for a verification code | 10.5 |
| `POST /t/api/code/verify` | `{code}` → `{session}` | 10.5 |

Every write: rate limit + token valid + (code session valid when the link requires a code) + assignment current + ticket not
closed / cancelled / in grace + module on; `client_request_id` (UUID) mandatory, stored in `ticket_requests` (scope
`link:<id>`) for 24 h - a repeat returns the first answer, a reused id on another route → 409 `request_id_reused`; a timeline
row, an audit row (actor = synthetic principal `contact:<id>`, `source = "ticket_link"`), `last_activity_at` /
`last_external_activity_at` updated and the sliding expiry extended. Strict JSON (`extra = forbid`), `Content-Type:
application/json` required (non-JSON → 415), no CORS headers at all. Every text field is stripped of Unicode `Cc` and `Cf`
characters before length checks (review T9; note: this also removes LRM/RLM marks and emoji joiners - accepted).

**Public error envelope (review T16-2):** the public app has its own exception handlers: 422 answers carry `{code, field}`
pairs only - never pydantic's `input`, `ctx` or `url`; no `ApiError.details` from internal code paths reach it.

### 10.4 Security headers of the public app

`Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self';
form-action 'none'; frame-ancestors 'none'; base-uri 'none'; manifest-src 'none'`; `X-Frame-Options: DENY`;
`Referrer-Policy: no-referrer`; `X-Content-Type-Options: nosniff`; `Cross-Origin-Opener-Policy: same-origin`;
`Cross-Origin-Resource-Policy: same-origin`; `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
(photos come through `<input type="file" accept="image/*">`, which needs no camera permission); `Cache-Control: no-store` on
the API; `X-Robots-Tag: noindex, nofollow`; no `Server` banner (`server_header=False`). Logging (review T16): uvicorn's access
log is off for this server; the app's own one-line request logger records method, **route template**, status and duration only
- never the path (the `/t/r/<rid>` id is in the path), the fragment (never sent), headers, bodies or client addresses; a
logging filter on `uvicorn.error` drops "Invalid HTTP request received" records (they may carry raw request bytes) and counts
them for health. The public bundle must not need `'unsafe-inline'`; Cloudflare features that inject scripts (Rocket Loader,
e-mail obfuscation, Bot Fight Mode challenges) are turned off for the `t-*` hostname (install guide), or the CSP breaks the page.

### 10.5 Option B: verification code (per contact, and per assignment)

- `ticket_contacts.require_code = 1` (set by `tickets.configure`; the vendor's row applies to its persons unless a person
  overrides it upward). **Per assignment (review T4):** the assign dialog has "לדרוש קוד אימות" - preselected and locked on when
  the contact requires it, otherwise optional (`ticket_assignments.require_code`); a manager can raise, never lower. The link
  snapshots `contact OR assignment` at mint; turning the contact setting on later raises that contact's live links at once;
  turning it off applies to new links only.
- **Forwarding is the expected use** of a plain link (a vendor's office forwards to its technician). A code-protected link breaks
  that flow (the code reaches the office phone, not the technician) - the dialog says so in one line ("הקוד יישלח לטלפון של איש
  הקשר"), which is why the per-assignment choice exists.
- With a code required, `GET /t/api/ticket` returns only number, department, organization and `code_required: true` until a
  code session exists (no title, place or description - a forwarded link alone discloses nothing beyond "a ticket exists").
- `POST /t/api/code/send`: sends a **6-digit** code (D2; uniform random, `secrets.randbelow(10**6)`, zero-padded; the length is
  not a setting) as a **separate message** with the `code` template (no link, no title), through the `tickets.codes` account
  (9.9). Limits: 1 per 60 s, 3 per hour, 6 per day per link, 6 per hour per recipient across links; codes do **not** count
  against the per-recipient message cap (9.2). The previous unconsumed code is invalidated. Stored as `HMAC(k_tickets, link_id
  | code)`. Expiry 10 minutes. Never held by send hours.
- **Code channel rule (D6, review Q12):** the code goes by WhatsApp. If WhatsApp cannot carry it: when the link itself went by
  WhatsApp or was copied by the manager, the code may fall back to e-mail (a different channel from the link); **when the link
  went by the e-mail fallback (`sent_via = 'email'`), the code must go by WhatsApp** - otherwise `code/send` answers 503
  `code_unavailable` ("לא ניתן לשלוח קוד כרגע. פנו למנהל"). At assignment time the same rule is checked: a code-protected
  assignment whose code could not be delivered on a channel different from the link's is **refused** with 409
  `code_channel_unavailable` ("לא ניתן לשלוח קוד לאיש קשר זה כרגע"), and the manager picks another contact, waits, or (if only
  the assignment - not the contact - asked for the code) removes the per-assignment requirement. Honest framing (guide): the code
  protects against a **forwarded message**, not against someone holding the contact's phone.
- `POST /t/api/code/verify`: compares with `hmac.compare_digest`; 5 wrong codes per link in 15 minutes → link locked for 30
  minutes (`ticket_link_failures`; the `second_factor._Failures` pattern); the ticket goes to "waiting for manager"
  (`code_locked`) and the manager's card "נעילת קוד" has a one-tap **"שלח קישור חדש"** (new generation + new code session
  required; review T5a: anyone holding a forwarded link can cause a lock-out - accepted, with a fast way out). A correct code is
  single-use and returns a 256-bit session value (stored as a hash in `ticket_link_sessions`, 12 h, never past link expiry)
  that the page sends as `X-Ticket-Session`; a new generation kills it.

### 10.6 Photo upload (public and internal share one validator, `attachments.py`)

- One file per request; per-route body cap **8 MiB** + 64 KiB slack (public app's own limit table; internal route: a new
  `body_limit.LIMITS` row `ticket_attachment`, review C3); anything else on the public app is capped at 16 KiB. Phones produce
  2-5 MB JPEGs.
- Accepted: **JPEG and PNG only**, sniffed by magic bytes (the declared type and the file name are ignored). **WebP is refused**
  on both routes (review T7-3: a large decoder attack surface, and phones send JPEG; one validator, one rule). HEIC is refused
  with a clear message (iPhones convert to JPEG for web uploads by default; **UNVERIFIED** for every iOS version - the page tells
  the user to send "most compatible").
- Order (one function in `services/tickets/attachments.py`, used by both routes): installation storage cap check (cached
  directory size, refreshed at most every 60 s; over 2 GiB → 507 `storage_full`, before reading the body further) → magic bytes
  → open lazily → `image_guard.check_pixels(im, 16_000_000)` (**16 MP**, review T7-1; not the administrator's 40 MP) → JPEG:
  `im.draft('RGB', (2048, 2048))` before load (the `ui_background.reencode` pattern) → decode under the module's **own**
  `threading.BoundedSemaphore(1)` (5 s wait → 429 `busy`; review C2: `ui_background._decode_slot` is router-private and must
  not be shared with anonymous uploads) → `ImageOps.exif_transpose` (after the pixel check) → RGB → downscale to 2048 px long
  side → re-encode to a **fresh JPEG q82** (strips EXIF including GPS, ICC, XMP, thumbnails, any trailing polyglot payload) →
  random 16-hex file name → atomic write (`write_atomic`) → SHA-256 recorded. The whole decode is wrapped in `try/except
  Exception` → 422 `image_invalid` (review T7-4). The original bytes are never stored or served. Pillow stays on the dependency
  watch (`upstream_watch.json` `py-pillow`).
- Served only through authorized routes (`/api/v1/tickets/{id}/attachments/{aid}` with visibility, or the public route for the
  link's own ticket) with `Content-Type: image/jpeg`, `Content-Disposition: inline; filename="ticket-<number>.jpg"`,
  `nosniff`.
- Per-ticket cap 60 photos (all sources); per-installation directory cap 2 GiB with a refusal (507 `storage_full`) and a CR-018
  `system.health` style signal.
- Served photos on the public route are a **deliberate exception** to "every media asset is authorized by a principal"
  (AGENTS.md): the bearer token is the authorization. Slice 4 records it in `docs/security/` with the token model (review C13),
  as CR-028 did for the cast relay.

### 10.7 The page (UX)

Mobile-first, Hebrew RTL, one column, large touch targets (>= 44 px), no Arx/HA branding, the organization name at the top,
neutral styling from a small CSS file using the same token names (no skin switching), light/dark by `prefers-color-scheme`.
Sections: ticket card (number, department, title, place, device, priority, "נשלח על ידי <assigner display name>"), status
buttons (התקבל / בטיפול / ממתין לחלק / בוצע - the current one highlighted, invalid ones absent), ETA picker, note box, photo add
(camera or gallery), the conversation timeline (what this handler did + the manager's notes and photos marked for the handler),
and at the bottom, behind a confirmation each and with a **required free-text reason**: **"לא שלי"** (D12 - the ticket is not
for me: back to the manager, link revoked) and "לא אוכל לטפל" (same effect, different reason code). One line under the photo
button: "מסמכים (למשל הצעת מחיר) - נא לשלוח למנהל בדרך המקובלת" (PDF upload is backlog). A "סיום" button forgets the token in
this tab (clears memory and `sessionStorage`; review T3-3).

States: loading, code required, locked, **read-only grace after close** ("הקריאה נסגרה, תודה" + own timeline, D5), final
confirmation after "לא שלי" / return (rendered from the return response; the link is already dead), unavailable (uniform),
busy (429: "יש עומס. נסו שוב בעוד דקה."), error with retry.

Times on the page are shown in the installation's time zone (`time_zone` from the API, review C12); the zone abbreviation is
shown only when the browser's zone differs; the ETA picker works in that zone. **Offline / bad reception:** a typed note and a
picked photo are kept as a draft in `sessionStorage`; a failed write is retried with the **same** `client_request_id` (no
duplicates) with the line "נשמר במכשיר, יישלח כשתהיה קליטה"; no service worker. The page fetches the ticket on load and on
`visibilitychange` to visible - no polling. Works without cookies; no third-party resources.
Language (D26): the contact's `lang` - Hebrew and Arabic RTL, English and Russian LTR; the page's ~40 strings and the
status names exist in all four (a small catalogue inside the public bundle, still within the 60 KB budget).

## 11. Ticket lifecycle

### 11.1 States

| Status | Hebrew | Meaning | waiting_on |
|---|---|---|---|
The owner's status line (D10): **new → sent → received → in progress → waiting for a part → done → closed**. The two side
states `returned` (the assignee handed it back, including "לא שלי") and `cancelled` (duplicate / mistaken) are kept because
D12 and the duplicate flow need them; they are not on the main line.

| Status | Hebrew | Meaning | waiting_on |
|---|---|---|---|
| `new` | חדשה | created, nobody assigned | manager (`unassigned`) |
| `assigned` | נשלחה | handed to an assignee (message queued / sent, or in-app for a user), not yet acknowledged | assignee |
| `acknowledged` | התקבלה | the assignee confirmed receipt | assignee |
| `in_progress` | בטיפול | being handled | assignee |
| `waiting_part` | ממתינה לחלק | handling paused for a part / external dependency | assignee (own SLA threshold) |
| `done` | בוצעה | the assignee reports completion | manager (`done`) - two-step (default); with `auto_close_after_days = N` the system closes it N days later unless a manager acted |
| `returned` | הוחזרה למנהל | the assignee handed it back: "לא שלי" or "לא אוכל לטפל", with a reason | manager (`returned` / `not_mine`) |
| `closed` | סגורה | final; **a manager** closed it, or the department's automatic close after N days | none |
| `cancelled` | בוטלה | final; not to be handled (duplicate - `duplicate_of` set - or mistaken) | none |

### 11.2 Transitions and who may do them

| From → To | Manager (`tickets.manage` in dept) | Internal assignee (current; a department member with `tickets.view`) | External assignee (link) | Inbound WhatsApp | System |
|---|---|---|---|---|---|
| (create) → `new` | yes | creators with `tickets.create` | - | - (phase 2: `inbound` origin) | phase 2 (rule) |
| `new`/`returned` → `assigned` | yes (assign) | - | - | - | - |
| `assigned`/`acknowledged`/`in_progress`/`waiting_part`/`done` → `assigned` (reassign to another assignee) | yes (ends the current assignment `reassigned`, revokes its link) | - | - | - | - |
| `assigned` → `acknowledged` | yes (on behalf, noted) | yes | yes | yes (advisory) | - |
| `assigned`/`acknowledged`/`waiting_part` → `in_progress` | yes | yes | yes | yes (advisory, not from `waiting_part`) | - |
| `acknowledged`/`in_progress` → `waiting_part` | yes | yes | yes | no | - |
| `waiting_part` → `in_progress` | yes | yes | yes | no | - |
| `acknowledged`/`in_progress`/`waiting_part` → `done` | yes | yes | yes | **no** | - |
| any open assigned state → `returned` | - (a manager reassigns instead) | yes ("לא שלי" / "לא אוכל לטפל", reason required) | yes (same, reason required - D12) | no | - |
| `done` → `closed` | yes | - | - | - | auto at `done_at + auto_close_after_days` when the department sets it (D10); the SLA monitor does it, timeline `auto_closed` |
| `done` → `in_progress` (not accepted) | yes (reopens handling, note required; cancels a pending auto close) | - | - | - | - |
| open (any but `closed`/`cancelled`) → `closed` | yes (close without done, note required) | - | - | - | - |
| open → `cancelled` | yes (reason; "כפולה" sets `duplicate_of` and writes a note on the original) | - | - | - | - |
| `closed` → `assigned` / `new` (reopen) | yes, within `reopen_days` (`reopen_count + 1`; a reassignment to the same contact sends the `reopened` message, which names the ticket as reopened; the page then shows that contact's earlier external timeline of this ticket) | - | - | - | - |

**Closed is manager-only (D10):** a pending **required cost claim** blocks closing unless overridden with a reason (11A.3); no assignee, link or inbound path can close; the only non-manager close is the department's
automatic close after N days, which is a setting a manager's department chose. While a `done` ticket waits for the automatic
close it stays in "ממתין לי" with "ייסגר אוטומטית ב-<date>", so a manager can still reject it.

The assignee can **never** assign or reassign (no API takes an assignee from them). `returned` ends their assignment, revokes
the link at once, and puts the ticket in the manager's "waiting for me" with the kind and the reason. Every transition:
revision check (409 `ticket_stale` with the current row), timeline row, audit row `ticket.status` (from, to, actor kind), SLA
recomputation, notification signals (section 13).

### 11.3 Editable fields

Managers: title, description, category, priority (recomputes SLA dues from creation time), department (move: only with
`tickets.manage` in both departments; ends the assignment if the assignee is not allowed in the new department), place.
Creators may edit title/description while the ticket is `new`. Assignees edit nothing but status, notes, photos, ETA.
An edit of title, description, place or priority after the current assignment's message left sets `external_stale`; the
ticket shows "נשלח לפני השינוי" with "שלח עדכון" (purpose `update`, the current text, respects send hours); the handler page
always shows the current values anyway.

## 11A. Cost claims from external vendors (D31, added after the approval of r2.4)

A vendor (an external contact) who reports **done** then submits a **cost claim** (פירוט דרישת עלות) so the organisation can pay
and the event is documented. Nothing in this section pays anyone: there is **no payment integration**; "paid" is a manual mark
with a payment reference, and a clean hook is left for a later integration (11A.9). The owner's answers of the same day
(D32) are applied below; no question about claims is open.

### 11A.1 When a claim is asked for (D32: per assignment)

The choice is made **per assignment**, by the manager who sends the ticket to the external vendor: the assign dialog (and the
bulk assign of 13.6) has "דרישת עלות: חובה / רשות / בלי", stored in `ticket_assignments.cost_claim`. Its preselection comes
from the most specific default that is set:

| Level | Default setting | Values | Default |
|---|---|---|---|
| Vendor / contact | `ticket_contacts.cost_claim` | `required` / `optional` / `off`, NULL = next level | NULL (e.g. `off` for a vendor on a fixed service contract) |
| Department | `ticket_departments.cost_claim` | same | NULL |
| Installation | `tickets.settings.costs.mode` | same | **`optional`** |

The manager may change it in the dialog before sending, and later on the ticket while no claim was submitted (audited
`ticket.cost.requirement`); the value at `done` is snapshotted into the claim (`ticket_cost_claims.required`). Only **external**
assignments get a claim; internal users never do. A claim is asked after the assignment reaches `done`. After a return of kind
"לא אוכל לטפל" (cannot handle) a claim is **optional** whatever was chosen (a diagnosis visit may cost money); after "לא שלי"
none is asked. A vendor can always declare **"ללא חיוב"** (no charge, e.g. warranty work): a claim with zero lines and
`no_charge = 1`, reviewed like any other.

### 11A.2 The vendor-page step after "done"

After the vendor taps "בוצע", the page shows the claim form (required: the page stays on it, with "אשלים אחר כך" available;
optional: a "הגשת דרישת עלות" card). Fields:
- **Line items** (at most 30): `labor` - hours (0.25 steps, ≤ 200) x hourly rate (prefilled from the vendor's
  `labor_rate_minor` when set); `parts` - description, quantity, unit price; `travel` - description, amount; `other` -
  description (required), amount. Every description ≤ 120 characters, `Cc` / `Cf` stripped.
- **Currency:** one per claim, ISO 4217 code from `costs.currencies` (default `["ILS"]`, so no picker is shown by default);
  every line is in that currency.
- **VAT (D32):** the vendor chooses on each claim, with one toggle "הסכומים כוללים מע"מ / לפני מע"מ", whether the amounts
  entered **include** or **exclude** VAT; the toggle's default comes from the vendor record (`ticket_contacts.vat_default`,
  default `excluded`). The server computes the other figure at `costs.vat_rate_bp` (default 1800 = 18%): excluded → VAT =
  subtotal x rate, total = subtotal + VAT; included → VAT = total x rate / (1 + rate), net = total - VAT. A vendor marked
  `vat_exempt` (עוסק פטור) has no toggle: `none`. The form shows net, VAT and total, **computed in the browser for display
  only** - the server recomputes everything (11A.4) and its numbers are the record.
- **Vendor reference / invoice number** (optional, ≤ 40 characters), **notes** (optional, ≤ 1000).
- **Invoice / receipt documents** (optional unless `costs.require_invoice` - default false): photographed with the phone
  camera or picked from the gallery / files (11A.6A), or a PDF (11A.6). Limit per revision: **up to 3 documents**, each either
  one PDF or **up to 10 photographed pages**, and at most **25 files** in total. (r2.5 allowed 3 files; raised because one
  photographed invoice is often 2-4 pages and a page is a file - the document count, which is what a reviewer reads, stays 3.)
- "שליחה" submits a **revision**. Until a manager decides, the vendor may submit a corrected revision (it supersedes the
  pending one). After a rejection the page shows the manager's reason and the form prefilled from the rejected revision.
  After approval it shows the approved total (and the adjustment reason when adjusted) read-only. The vendor never sees internal
  notes, other assignments' claims or other vendors' costs.
- Language and direction follow the contact's `lang` (D26); amounts use the contact language's number format with the currency
  symbol; the page never converts currencies.

### 11A.3 Lifecycle

`none` → `submitted` → (`rejected` → `submitted`)* → `approved` → `paid`; `paid` → `approved` only by "ביטול סימון תשלום" with a
reason. A required claim that has not been submitted shows on the ticket and the board as "ממתין לדרישת עלות" (`cost_status =
'awaiting'`). `tickets.cost_status` and `cost_total_minor` are denormalised for the board (values `not_required`, `awaiting`,
`submitted`, `rejected`, `approved`, `paid`).

**Closing (D10 interaction):** while a **required** claim is not `approved` / `paid`, the ticket cannot move to `closed`: the
manager's close gets 409 `cost_claim_pending` unless the manager overrides with a reason ("סגירה בלי דרישת עלות מאושרת",
audited `ticket.close.override_claim`). The automatic close after N days skips such tickets and lists them in "ממתין לי". A claim
may still be submitted and reviewed after an overridden close, inside the claim window (11A.5).

### 11A.4 Amounts, rounding and caps (server rules)

- All money is stored as **integers in minor units** (agorot for ILS), never floating point; inputs are decimal strings with at
  most 2 decimals (`^\d{1,9}(\.\d{1,2})?$`).
- Line total = quantity x unit price (labor: hours x rate), rounded half-up to the minor unit per line; subtotal = sum of lines;
  VAT per the vendor's toggle (`excluded`: subtotal x rate; `included`: the entered sum is the total and VAT = total x rate /
  (1 + rate)), rounded half-up once; the other figure follows. Per-kind totals (labor, parts, travel, other) are stored for reporting.
- Values sent by the client for totals are ignored; the answer returns the server's computation, and the page shows it.
- `costs.max_claim_total_minor` (default 1,000,000.00) - above it 422 `claim_too_large` (fat-finger / tampering guard);
  `costs.review_flag_above_minor` (default 10,000.00) - above it the manager sees an amber "סכום גבוה" chip.
- The VAT mode and rate in force at submission are stored in the revision; a later settings change never re-prices it.

### 11A.5 Link access for the claim step (longer than the 24-hour grace)

The claim step has its **own window**: `claim_until` = (the moment the assignment reached `done`, or the latest rejection)
+ `costs.claim_window_days` (default **14**, range 1-90, department override `ticket_departments.claim_window_days`). Until then
the link opens in **claim mode** even if the ticket was closed (override), the link's sliding expiry or cap has passed, or the
24-hour read-only grace ended: `GET /t/api/ticket` returns the minimal ticket card + the claim, and only the claim routes
accept writes. A link revoked for any reason **other than** a "לא אוכל לטפל" return (reassign, "לא שלי", manual revoke,
contact change, erase, key rotation, new generation) never opens claim mode; after a "cannot handle" return the link is dead for
everything except the optional claim, inside its window. The verification code (10.5) applies to claim mode exactly as to the rest of the page.
When `claim_until` passes without a claim, the ticket goes to "ממתין לי" (`claim_missing`); the manager can reopen the window
once ("פתח שוב להגשה", new `claim_until`, the vendor gets a `cost_reopened` message with the link) or enter the claim on the
vendor's behalf.

### 11A.6 Invoice files (photos and PDFs)

- Photos: exactly the 10.6 path (JPEG / PNG, 16 MP, re-encoded).
- PDF (the review's hostile-upload rules, adapted - a PDF cannot be re-encoded without a renderer, which the add-on does not
  have and will not add for this):
  - magic bytes `%PDF-` at offset 0, and an `%%EOF` in the last 1 KiB; at most **10 MiB** (public and internal body-limit rows
    `ticket_cost_file`: 10 MiB + 64 KiB);
  - refused (422 `pdf_refused`) when a byte scan finds `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`, `/RichMedia`, `/XFA`,
    `/OpenAction`, `/AA` or `/Encrypt` (encrypted files cannot be scanned). **Stated limit:** names inside compressed object
    streams escape a byte scan; the scan is a filter, not a guarantee - the next two rules are the real control;
  - stored under a random name in `<data>/tickets/<ticket_id>/costs/`, never parsed, rendered, thumbnailed or previewed by Arx;
  - served **only as a download** to authorised internal users: `Content-Type: application/pdf`, `Content-Disposition:
    attachment; filename="ticket-<number>-invoice-<n>.pdf"`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy:
    sandbox`, `Cache-Control: private, no-store`; never inline in the app; the vendor page shows only name and size of its own
    files and offers no re-download;
  - SHA-256 recorded; the same file uploaded twice in one claim is refused (`duplicate_file`).
- Upload flow: `POST /t/api/claim/file` stores a **pending** file (24 h; one upload in flight per link; at most 40 files per
  hour and 30 pending files per link - enough for 3 documents of 10 pages with retakes) with an optional `document_key` and
  `page_no`, and returns an id; the submission references the ids and their order; unreferenced pending files are purged by the
  janitor.
- Storage: claim files count in the 2 GiB attachment cap (10.6).

### 11A.6A Photographing an invoice on the vendor page (D32)

- **Capture:** "צילום חשבונית" uses `<input type="file" accept="image/jpeg,image/png" capture="environment">`, which opens the
  phone's own camera app; "בחירה מהגלריה / מקובץ" is the same input without `capture` (and the PDF picker). The page is served
  only over HTTPS (the Cloudflare hostname), so it is a secure context; release 1 does **not** use a live in-page viewfinder
  (`getUserMedia`): the native camera gives better focus and flash handling, needs no in-page camera permission, and the
  public CSP / `Permissions-Policy: camera=()` stay unchanged. (A live viewfinder later would need `camera=(self)` and a
  permission prompt - recorded, not built.)
- **Camera refused or unavailable** (the OS or browser denies camera access to the browser app, a WhatsApp in-app browser that
  ignores `capture`, a desktop): the input then shows the gallery / file picker or returns nothing; the page detects "no file
  returned" and shows one line "לא ניתן לפתוח את המצלמה - אפשר לבחור תמונה מהגלריה או מקובץ" with the gallery button
  focused, and "פתיחה בדפדפן" advice for in-app browsers. No retry loop, no permission nagging.
- **Pages:** after each shot the page shows the page with "צילום מחדש", "סיבוב" (90°), "חיתוך" (a drag rectangle) and
  "שיפור ניגודיות" (grayscale + auto-levels; a toggle, original kept until upload), then "הוספת עמוד" or "סיום מסמך". Pages
  can be reordered and deleted before submitting. All editing is done on a `<canvas>` in the browser, one page in memory at a
  time; the result is downscaled to 2048 px on the long side and compressed to JPEG quality 0.8 (typically 250-600 KB) before
  upload, which also keeps uploads usable on poor reception (the 10.7 retry rules apply).
- **Server:** every page is an ordinary image upload and goes through the 10.6 validator (magic bytes, 16 MP, re-encode to a
  fresh JPEG, no EXIF / GPS) - client-side processing is a convenience, never a trust boundary. Pages carry `document_key`
  and `page_no`.
- **Manager view:** the claim card shows each document as one item; opening it shows a page viewer (pages in order,
  thumbnails, zoom, rotate for viewing). "הורדה כ-PDF" assembles the re-encoded page images into one PDF on the server with
  `fpdf2` (already a dependency) - images only, no text layer, no active content - served with the 11A.6 download headers.
- **Bundle:** the capture / edit code is a lazily loaded chunk of the public bundle (≤ 25 KB gzip), fetched only on the claim
  step; the initial page budget (60 KB) is unchanged; no third-party library.
- **OCR - future task, hook only:** `ticket_cost_files.ocr_status` (NULL in release 1) and `services/tickets/costs.py
  on_document_ready(document)` - called when a claim revision with documents is submitted; it does nothing in release 1. A later
  OCR step could prefill lines or check totals against the invoice (18A).

### 11A.7 Manager side

- **Ticket page:** a "עלות" card: status chip, total with currency, per-kind breakdown, vendor reference, files (download),
  revision history (every revision with who / when / total, decisions with reason), and actions by permission:
  - **אישור** - approve the current revision as is;
  - **אישור עם תיקון** - the reviewer edits lines or the total; this creates a **manager revision** (`source = 'manager'`,
    `kind = 'adjustment'`, mandatory reason) referencing the vendor's revision, and approves it; the vendor sees the approved
    total and the reason;
  - **דחייה** - mandatory reason; sent back to the vendor (message purpose `cost_rejected`, with the link; send hours apply)
    and `claim_until` restarts;
  - **סימון כשולם** - payment reference (≤ 60) and payment date; **ביטול סימון** with a reason;
  - **הזנת דרישה בשם הספק** - a holder of `tickets.costs` enters a claim (e.g. a paper invoice), `source = 'manager'`.
- **Never overwrite:** revisions are immutable; decisions are rows of their own; a changed setting never changes a stored
  revision.
- **Notifications:** CR-018 source `ticket.cost_submitted` (to holders of `tickets.costs` who can see the ticket, category
  tickets, severity info); `ticket.cost_missing` when `claim_until` passes on a required claim (to the department managers who
  hold `tickets.costs.view`). Vendor messages: `cost_rejected` (always), `cost_approved` (setting `costs.notify_vendor_approved`,
  default true; text "דרישת העלות לקריאה {number} אושרה" - no amount in WhatsApp).

### 11A.8 Permissions (two new, both sensitive, both grantable per user - 8.2)

| Permission | Label | Meaning | Sensitive | Default built-in roles |
|---|---|---|---|---|
| `tickets.costs.view` | צפייה בעלויות | see amounts, lines, files and revision history on tickets the user can see; cost columns, cost filters and cost reports / CSV | **yes** | site_admin, system_admin |
| `tickets.costs` | אישור עלויות | approve / adjust / reject claims, mark paid / unmark, enter a claim on the vendor's behalf, reopen the claim window, override the close gate (with `tickets.manage`) | **yes** | system_admin |

The approval routes check **both** `tickets.costs` and `tickets.costs.view` (a reviewer must see what they approve); the role
editor warns when a role holds the first without the second. Without `tickets.costs.view` a user sees only the status chip ("הוגשה דרישת עלות"),
never amounts, files or vendor rates (fields removed server-side, columns absent from the table and CSV). Cost permissions are
checked on the ticket's place target and only for visible tickets (8); a finance user who reviews all departments holds
`tickets.view` + `tickets.all_departments` + both cost permissions, without `tickets.manage`. Two more single-permission roles
join 8.2: `tickets_costs_view`, `tickets_costs`.

### 11A.9 Reporting and the payment hook

- **Table / board (13.6):** columns "עלות" (approved total, else submitted total in grey) and "סטטוס עלות"; filter by cost
  status; only for `tickets.costs.view` holders.
- **Report** `GET /tickets/costs/report?group_by=vendor|department|device|room|month&from=&to=&status=&currency=`: sums of
  approved and of submitted-pending amounts **per currency** (never summed across currencies, no FX conversion), count of
  tickets and claims, per-kind totals; rows pass `visible()`; period by approval date (or submission date for pending). Screen:
  tab "עלויות" in the tickets area (only with `tickets.costs.view`).
- **CSV** `GET /tickets/costs/export.csv` (same filters; one row per claim or per line, chosen): the 13.6 rules - 5 000 rows,
  1 per minute per user, UTF-8 with BOM, formula-injection prefix, installation time zone; amounts as plain decimals with a
  separate currency column; no phone numbers, no internal notes, no file contents; audit `ticket.costs.export`.
- **Payment hook (no integration in scope):** every approval, mark-paid and unmark writes a row to `ticket_cost_decisions`
  and calls `services/tickets/costs.py emit_cost_event(kind, claim)` - in release 1 it only emits the CR-018 signal and nothing
  else; a later payment / accounting integration subscribes there or reads "approved, not paid" through the report API.

### 11A.10 Data model (migration `0083_ticket_costs.sql` - takes the spare; `0084` becomes the spare)

```sql
ALTER TABLE ticket_departments ADD COLUMN cost_claim TEXT CHECK (cost_claim IN ('required', 'optional', 'off'));
ALTER TABLE ticket_departments ADD COLUMN claim_window_days INTEGER;
ALTER TABLE ticket_contacts ADD COLUMN cost_claim TEXT CHECK (cost_claim IN ('required', 'optional', 'off'));
ALTER TABLE ticket_contacts ADD COLUMN vat_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ticket_contacts ADD COLUMN vat_default TEXT NOT NULL DEFAULT 'excluded' CHECK (vat_default IN ('included', 'excluded'));
ALTER TABLE ticket_assignments ADD COLUMN cost_claim TEXT CHECK (cost_claim IN ('required', 'optional', 'off'));   -- D32, per assignment
ALTER TABLE ticket_contacts ADD COLUMN labor_rate_minor INTEGER;          -- prefill of the hourly rate
ALTER TABLE ticket_contacts ADD COLUMN rate_currency TEXT;
ALTER TABLE tickets ADD COLUMN cost_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE tickets ADD COLUMN cost_total_minor INTEGER;                  -- approved total, else latest submitted
ALTER TABLE tickets ADD COLUMN cost_currency TEXT;

CREATE TABLE ticket_cost_claims (
  id                   TEXT PRIMARY KEY,
  ticket_id            TEXT NOT NULL REFERENCES tickets(id),        -- no cascade: financial records outlive the ticket (11A.11)
  assignment_id        TEXT NOT NULL UNIQUE,                        -- one claim per external assignment
  contact_id           TEXT NOT NULL,
  required             INTEGER NOT NULL,                            -- the effective mode at 'done' (snapshot)
  status               TEXT NOT NULL CHECK (status IN ('awaiting', 'submitted', 'rejected', 'approved', 'paid')),
  currency             TEXT NOT NULL,                               -- ISO 4217
  no_charge            INTEGER NOT NULL DEFAULT 0,
  current_revision_id  TEXT,
  approved_revision_id TEXT,
  approved_total_minor INTEGER,
  approved_by          TEXT, approved_at TEXT,
  paid_at              TEXT, paid_by TEXT, payment_ref TEXT, payment_date TEXT,
  claim_until          TEXT,                                        -- 11A.5
  snapshot_json        TEXT NOT NULL,                               -- number, title, department, place, device, vendor company /
                                                                    -- name at 'done' - keeps the record readable after ticket purge
  purge_after          TEXT,                                        -- 11A.11
  revision             INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX idx_cost_claims_ticket ON ticket_cost_claims (ticket_id);
CREATE INDEX idx_cost_claims_status ON ticket_cost_claims (status, updated_at);
CREATE INDEX idx_cost_claims_contact ON ticket_cost_claims (contact_id, approved_at);

CREATE TABLE ticket_cost_revisions (                 -- immutable once written
  id              TEXT PRIMARY KEY,
  claim_id        TEXT NOT NULL REFERENCES ticket_cost_claims(id),
  seq             INTEGER NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('vendor', 'manager')),
  kind            TEXT NOT NULL CHECK (kind IN ('submission', 'adjustment', 'on_behalf')),
  based_on        TEXT,                              -- the vendor revision an adjustment corrects
  lines_json      TEXT NOT NULL,                     -- validated lines, minor units
  labor_minor     INTEGER NOT NULL, parts_minor INTEGER NOT NULL, travel_minor INTEGER NOT NULL, other_minor INTEGER NOT NULL,
  subtotal_minor  INTEGER NOT NULL,
  vat_mode        TEXT NOT NULL CHECK (vat_mode IN ('excluded', 'included', 'none')),   -- the vendor's toggle (D32) or exempt
  vat_rate_bp     INTEGER NOT NULL,
  vat_minor       INTEGER NOT NULL,
  total_minor     INTEGER NOT NULL,
  currency        TEXT NOT NULL,
  vendor_ref      TEXT,
  notes           TEXT,
  reason          TEXT,                              -- mandatory for an adjustment
  created_by_kind TEXT NOT NULL CHECK (created_by_kind IN ('contact', 'user')),
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  UNIQUE (claim_id, seq)
);

CREATE TABLE ticket_cost_decisions (                 -- append-only
  id           TEXT PRIMARY KEY,
  claim_id     TEXT NOT NULL REFERENCES ticket_cost_claims(id),
  revision_id  TEXT,
  action       TEXT NOT NULL CHECK (action IN ('approve', 'adjust', 'reject', 'mark_paid', 'unmark_paid', 'reopen_window',
                                               'override_close', 'superseded')),
  reason       TEXT,
  amount_minor INTEGER,
  payment_ref  TEXT,
  by_user      TEXT NOT NULL,
  at           TEXT NOT NULL
);
CREATE INDEX idx_cost_decisions_claim ON ticket_cost_decisions (claim_id, at);

CREATE TABLE ticket_cost_files (
  id          TEXT PRIMARY KEY,
  claim_id    TEXT REFERENCES ticket_cost_claims(id),   -- NULL while pending (uploaded, not yet submitted)
  revision_id TEXT,
  link_id     TEXT,                                     -- the uploader's link while pending
  kind        TEXT NOT NULL CHECK (kind IN ('photo', 'pdf')),
  document_key TEXT,                                    -- groups photographed pages into one document (11A.6A)
  page_no     INTEGER,
  ocr_status  TEXT,                                     -- OCR hook, NULL in release 1
  path        TEXT NOT NULL,
  sha256      TEXT NOT NULL,
  bytes       INTEGER NOT NULL,
  uploaded_by_kind TEXT NOT NULL CHECK (uploaded_by_kind IN ('contact', 'user')),
  uploaded_by TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_cost_files_claim ON ticket_cost_files (claim_id);
CREATE INDEX idx_cost_files_pending ON ticket_cost_files (created_at) WHERE claim_id IS NULL;
```

`ticket_requests` (7.1) gives the claim routes their idempotency. Cost tables are operational data (not in a project backup).

### 11A.11 Privacy and retention of financial data

- Claims, revisions, decisions and files are kept for `costs.retention_days` after approval / payment (default **2555 days =
  7 years**, D32 - the usual bookkeeping horizon), **independently of the ticket's own retention**: when the ticket is purged
  (15.1), its claims stay with `snapshot_json` (no ticket link), and are deleted with their files at their own `purge_after`.
  Unapproved claims of purged tickets follow the ticket.
- **Contact erase (15.2):** the claim keeps the company name, vendor reference, amounts and files (a financial record the
  organisation must keep); the person's name, phone and e-mail are removed from the snapshot as everywhere else; the guide says
  this. Contact export (15.2) includes the person's claims.
- Amounts, rates and files are visible only to `tickets.costs.view` holders; logs and audit carry ids, status and totals only -
  never line descriptions, notes or file contents; audit actions `ticket.cost.submit|approve|adjust|reject|mark_paid|
  unmark_paid|reopen_window|on_behalf|file_upload|file_download`, `ticket.close.override_claim`, `ticket.costs.export`,
  `ticket.costs.report`.

### 11A.12 API sketch

Public (port 18093; token + code session when required; claim mode per 11A.5; `client_request_id` on writes):

| Route | What |
|---|---|
| `GET /t/api/claim` | claim status, the vendor's own revisions (totals, lines, decision reasons visible to the vendor), the form settings (currency, VAT mode / rate / exempt, rate prefill, limits, `claim_until`) |
| `POST /t/api/claim/file` | multipart, one photo (a page) or PDF, optional `document_key` + `page_no` → pending file id |
| `POST /t/api/claim` | `{lines[], currency, amounts_include_vat, vendor_ref?, notes?, no_charge?, documents: [{file_ids[] in page order}], client_request_id}` → the server-computed revision; 409 `claim_closed` after approval; 422 field problems |

Internal (`/api/v1`):

| Route | Gate | What |
|---|---|---|
| `GET /tickets/{id}/costs` | visible + `tickets.costs.view` (else status only) | claims, revisions, decisions, files list |
| `POST /tickets/{id}/costs/{claim_id}/approve` / `adjust` / `reject` | `tickets.costs` (+ view) | `{revision_id, lines?, reason?, revision}` - optimistic `revision` of the claim (409 `claim_stale`) |
| `POST /tickets/{id}/costs/{claim_id}/mark-paid` / `unmark-paid` | `tickets.costs` | `{payment_ref, payment_date}` / `{reason}` |
| `POST /tickets/{id}/costs/{claim_id}/reopen-window` | `tickets.costs` | new `claim_until`, `cost_reopened` message |
| `POST /tickets/{id}/costs` | `tickets.costs` | a claim on the vendor's behalf (multipart files allowed) |
| `GET /tickets/{id}/costs/files/{file_id}` | `tickets.costs.view` | download only (11A.6) |
| `GET /tickets/costs/report` / `GET /tickets/costs/export.csv` | `tickets.costs.view` | 11A.9 |
| `POST /tickets/{id}/status {to: closed, override_claim_reason}` | manager + `tickets.costs` for the override | 11A.3 |

### 11A.13 Threats added by cost claims

| # | Threat | Mitigation | Residual |
|---|---|---|---|
| S21 | **Tampered amounts** (a forwarded-link holder, or a client that sends its own totals) | the server recomputes every total from lines; client totals ignored; integer minor units; caps and the "סכום גבוה" flag; immutable revisions and append-only decisions; every claim needs a human approval by a sensitive permission; adjustments need a reason; the vendor-page code (10.5) applies to claims | whoever holds a live link can submit a claim in the vendor's name - the reviewer is the control (one approver, D32; a second approver above an amount is backlog) |
| S22 | **Claim after link expiry / revocation** | the separate claim window (11A.5) opens only the claim routes, only for links that were not revoked, and ends at `claim_until`; reopening is a manager action | - |
| S23 | **Double submission** | `client_request_id` replay; one pending revision at a time (a new one supersedes, recorded); one claim per assignment (UNIQUE); duplicate files refused by hash | - |
| S24 | **Currency confusion** | one ISO 4217 currency per claim from an allow-list (default ILS only); reports and CSV per currency, never summed across currencies, no FX; VAT mode and rate frozen in the revision | - |
| S25 | **Hostile PDFs** | magic / trailer check, size cap, active-content byte scan, encrypted PDFs refused, never parsed or rendered by Arx, download-only with `CSP: sandbox` and `nosniff`, never shown on the vendor page | a malicious PDF can still reach a reviewer's own PDF viewer; the guide says to open invoices in an up-to-date viewer; rasterising PDFs is backlog (18A) |
| S27 | **Photographed pages** (client-side editing tampered with, huge or crafted images) | client processing is convenience only; every page passes the 10.6 validator and re-encode; per-link file caps; the assembled manager PDF contains only re-encoded images | - |
| S26 | **Cost data leaks** (to managers without the permission, to other vendors, into CSV / logs) | fields removed server-side without `tickets.costs.view`; the vendor sees only its own assignment's claim; CSV formula-injection prefix and no phones / notes; logs and audit carry ids and totals only | - |

### 11A.14 Settings (`tickets.settings.costs`, `system.configure`; department and vendor overrides as in 11A.1)

```json
"costs": {
  "mode": "optional",                       // D32: default of the per-assignment choice (vendor / department override first)
  "currencies": ["ILS"],                    // ISO 4217; the first is the default
  "vat_rate_bp": 1800,                      // 18.00 %
  "claim_window_days": 14,                  // 1-90; department override
  "require_invoice": false,
  "max_claim_total_minor": 100000000,       // 1,000,000.00
  "review_flag_above_minor": 1000000,       // 10,000.00 - D32: configurable high-amount flag, one approver
  "notify_vendor_approved": true,
  "retention_days": 2555                    // D32: 7 years; 730-3650
}
```

## 12. Device integration

### 12.1 Entry points (frontend)

| Surface | Today | Change |
|---|---|---|
| `<device-activity>` sheet (`components/device-activity.ts`) | tabs `activity`, `schedules` (l.32, l.284) | `type Tab = 'activity' \| 'schedules' \| 'tickets'`; the tabs array becomes computed: `activity` and `schedules` only when the device has activity tracking (today's behaviour for those rows), **`tickets` last**, only when the module is on and `canAnywhere('tickets.view')`; label "קריאות" with the count of open visible tickets as the existing `cnt` badge; `onTabKey` (l.299) iterates the computed list; the panel is the new `<device-tickets-tab entity-id=...>` (list of this device's tickets visible to the user, newest open first, status chip, age, assignee name; a "פתיחת קריאה" button when `tickets.create`). `ActivityOpen.tab` (`device-activity-press.ts:28`) gains `'tickets'`. |
| Long press (`ActivityPress`) | fires only on `data-activity` elements, set by `activityTag()` (l.39) for rows the server flags `activity` (the electrical domains of `device_activity.ACTIVITY_DOMAINS`); opens the sheet on `activity`. Right-click / menu key / Shift+F10 open the 2-item menu (`renderMenu`) | **Two modes, setting `tickets.settings.device_long_press` (D17), see the matrix below this table.** The right-click / menu-key menu gains "פתיחת קריאה" (with `tickets.create`) in both modes. The create form first lists open tickets of this device visible to the user ("קריאות פתוחות למכשיר זה: #1041" with "פתח את הקיימת") - the duplicate hint. The tab and the menu's ticket items require `devices.read` on the entity as well as `tickets.view` (8). |
| Hosts | `devices-area.ts:539`, `devices-area-bubble.ts`, `devices-tiles-panel.ts:209` | no host change beyond `activityTag()`; their `data-activity` sites already exist (l.1542/1679/1707/1726/1734, bubble l.501-586, tiles l.815). |
| Floor map card (`explore-floor-map.ts renderCard` l.2548, entity body `apiEntityBody` l.2400) | no tabs, no long press | one action "קריאות" in the existing `<details class="more">` block that dispatches `OPEN_EVENT` with `tab: 'tickets'`, and on the face of the card only a small **count chip** of open visible tickets when > 0 (a state chip, no text - allowed by the clean-screen rule; review gap "map card"); markers do not get a long press in release 1 (the 2D canvas and 3D picking have no press infrastructure; the 3D walk long-press of `map/walk-touch.ts` is a selection gesture). |
| Settings catalogue (`explore-entities.ts`) | drawer | no change (management screen). |

**Long press by device and mode (D17).** "Tracked" = a row the server flags `activity` (today the only rows with a long press); "other" = any other catalogued entity row on the same hosts (area screen, bubble pills, tiles panel). A short tap is unchanged everywhere.

| Situation | Tracked device | Other device |
|---|---|---|
| Module off, or the user lacks `tickets.view` / `devices.read` (the setting is ignored) | **as today**: sheet on `activity` | **as today**: no long press |
| Module on, mode (a) `sheet` - **default** | sheet on `activity`; tabs פעילות, תזמונים, **קריאות last** | sheet with the **קריאות tab only**, opened on it |
| Module on, mode (b) `menu` | opaque menu: פתיחת קריאה · הקריאות של הרכיב · פתיחת המכשיר · היסטוריה | opaque menu: פתיחת קריאה · הקריאות של הרכיב · פתיחת המכשיר (no היסטוריה - not tracked) |

Menu items: "פתיחת קריאה" (needs `tickets.create`) opens the sheet on `tickets` with the create form open; "הקריאות של הרכיב" opens the sheet on `tickets` (count of open visible tickets shown); "פתיחת המכשיר" runs the host's own tap action for that row (no new device view); "היסטוריה" opens the sheet on `activity`. Items the user may not use are absent. The menu is the existing `renderMenu` popup extended, so right-click and long press show the same menu in mode (b); it is **opaque** (solid `--sw-surface` background in every skin, no glass / blur), keyboard-operable, closes on Escape or outside tap, RTL-aligned to the press point. The mode reaches the shell through `/me` (`modules: {tickets: true, tickets_long_press: "sheet"|"menu"}`). The map card, 3D and the settings catalogue are unaffected by the setting (12.1 rows above).

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
  detail as a compact timeline to whoever may see the ticket's internal content (8) **and** holds `devices.read` on the entity.
- **Handler page (D3, D23):** shown only when the **assignment's** checkbox "לשתף היסטוריית מכשיר" is ticked
  (`ticket_assignments.share_history = 1`). The checkbox in the assign dialog is preselected from the vendor / contact
  (`ticket_contacts.share_history`, when set) else from the department (`share_history_external`, default 0) - so with no
  setting changed it is unticked, and the manager decides per ticket. The checkbox is **absent** when the ticket has no
  device, no snapshot (`withheld` / `none`), or the entity's domain is `lock`, `alarm_control_panel`, `cover` or `camera`
  (a hard-coded list in `device_context.py`, `EXTERNAL_HISTORY_NEVER`; the server refuses `share_history` for them whatever
  the client sends - these histories say when a building was unlocked, disarmed or opened). When shared, the page shows at
  most 10 lines "14:05 · כבוי → פועל · אוטומציה" - no person names, no attribute dumps, times in the installation zone.
  Per-department default: `tickets.configure`; per-vendor default: directory editors (`tickets.configure`); per ticket: the
  assigning manager.

## 13. Manager tracking, SLA, reminders and escalation

### 13.1 Defaults (seeded for every new department; editable per department x priority)

| Priority | Unassigned | Link not opened | Acknowledge within | Stuck (no update) | Stuck while waiting for a part | Resolve within | Remind every | Notify severity |
|---|---|---|---|---|---|---|---|---|
| urgent (דחוף) | 15 min | **24 h** | 30 min | **1 h** | 1 day | 8 h | 30 min | critical |
| high (גבוה) | 1 h | **24 h** | 2 h | 8 h | 3 days | 2 days | 4 h | alert |
| normal (רגיל) | 4 h | **24 h** | 1 day | **3 days** | 7 days | 7 days | 1 day | alert |
| low (נמוך) | 1 day | **24 h** | 3 days | 7 days | 14 days | 30 days | 3 days | info |

**Every** cell, plus `max_reminders` (default 2) and `manager_alert_after_steps` (default 1), is editable in Settings per
department x priority (D11: the SLA grid of the department editor, `tickets.configure`); an empty cell turns that threshold
off. "Link not opened" applies only to external assignments (a link that has had no header-carrying request since it was sent;
the 24 h default is the owner's - for `urgent` it will usually be overtaken by "acknowledge within 30 min" first, which is
intended). Calendar time in release 1 (D7); vendor-bound reminders still wait for the send hours (D4), so an urgent reminder
due at 02:00 leaves at 07:00 while the manager alert at 02:00 is not delayed. The automatic close after N days (D10) is driven
by the same monitor.

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
   message through the channel (with the same live link, paced, held outside the send hours; it extends the sliding expiry).
2. After `manager_alert_after_steps` unanswered reminders (or at once for `unassigned`, `returned` / `not_mine`, `done`) →
   CR-018 signal `ticket.stuck` to the department's managers (recipient rule `ticket_managers`), severity from the priority.
3. After `max_reminders` → no more reminders; the ticket stays in "stuck" on the board until someone acts.

The same tick closes `done` tickets whose `done_at + auto_close_after_days` has passed (D10; the department value at that
moment; timeline `auto_closed`, audit actor `system`, link grace starts), and sets `link_expired` on open tickets whose link
passed its expiry or cap.

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
| `ticket.reply_unmatched` | an ambiguous WhatsApp reply, or a late one | ticket_managers (of each candidate) | info | `ticket-inbound:<id>` / resolved when handled; the notification never carries the reply text |
| `ticket.send_failed` | a message to a contact could not go by WhatsApp (fallback used or nobody reachable) | ticket_managers | alert | `ticket:<id>:send` / resolved on the next successful send |
| `ticket.contact_changed` | a contact's phone / e-mail changed while it had live links (links revoked) | ticket_managers | alert | `ticket:<id>:contact` / resolved on reassign or new link |
| `ticket.channel_down` | a WhatsApp account mapped to a ticket use went disconnected / missing, or a required use is unmapped | `managers` (system) + `system.configure` + `messaging.accounts.manage` | alert | `ticket-channel:<account_key>` / resolved on reconnect / remap |

  The ticket's priority maps to the signal severity (`ticket_priorities.notify_severity`); with the department's
  `urgent_is_critical` true (D28: installation setting, default true, per-department override) urgent tickets pass the managers' quiet hours (`critical`) and get CR-018's
  own escalation to administrators if nobody acknowledges (CR-018 §8.3); with 0 the severity is capped at `alert`. The
  administrator can also turn escalation off per source in the existing matrix. Notification text names the place and the
  ticket number only. `notify_new` is on only for each department's first manager by default (review: notification fatigue);
  a per-department notification matrix and a daily digest are backlog (18A).
- Acknowledging a ticket notification in the CR-018 centre does not change the ticket; the notification's deep link opens the
  ticket with the one-tap "התקבל" for an internal assignee (8.1).

### 13.5 The manager board (`#/tickets/board`)

Sections (each a compact list, newest risk first; counts in the section header; filters: department (only mine by default),
priority, assignee):
1. **ממתין לי** - `waiting_on = 'manager'`: unassigned, returned / "לא שלי" (with the reason), done awaiting close (with the
   automatic-close date when the department uses it), unmatched and late replies, failed sends, expired links on open tickets,
   code lock-outs (with "שלח קישור חדש"), contact changed.
2. **תקועות** - `stuck_kind` set: which threshold (including "הקישור לא נפתח"), since when, reminders sent.
3. **בטיפול** - grouped by assignee (user / contact / vendor): each with open count, oldest age, last activity, ETA.
4. **נסגרו לאחרונה** - collapsed by default.

These sections are the **cards** view (the default view, D24). Columns everywhere: `#number`, title, place, department,
assignee, age ("פתוחה 2 ימים"), last activity, status chip. Live refresh through the existing `/me/ws` style push is out of
scope; the board polls every 30 s while visible (the table and kanban views poll the same way, keeping selection and scroll).

### 13.6 Board views and the table (D24)

**Views:** cards (default) / table / kanban, switched in the board header; the choice, the table's columns and order, the
density and the last sort are remembered **per user** (`user_prefs` key `tickets.board`, validated by `_choice` / list
validators like the existing keys). Below 768 px every view falls back to a **compact list** (number, title, status chip, age;
tap opens the ticket; no multi-select, no kanban).

**Table:**
- Sticky header; sortable columns (click; Shift+click adds a second key); column chooser (show / hide / reorder, "reset");
  columns: ticket no., title, department, priority, status, assignee, location (`place_text`), device, age (`created_at`),
  last update (`last_activity_at`), stuck reason (`stuck_kind` + since), SLA (the nearest due - ack / stuck / resolve - shown as
  "בעוד 3 ש׳" or "חריגה 2 ימים").
- **Saved filters** (`ticket_saved_views`, private, at most 20 per user): name + filters + sort + columns + density; one can be
  marked as the user's default.
- **Multi-select** (checkbox column, Shift-range, "select page") with a bulk bar: **assign, remind, change priority, close**.
- **Inline edits:** the status chip opens a menu of the transitions allowed for this caller (11.2); the assignee cell opens a
  picker - an internal user is assigned at once; a contact / vendor opens the compact assign confirmation with the message
  preview, send-hours line and code / history checkboxes (never a silent external send).
- **Keyboard:** ↑/↓ move the row focus, Enter opens the ticket (drawer or full screen per D18), Space toggles selection,
  Ctrl/Cmd+A selects the page, `/` focuses search, Esc clears the selection; ARIA `grid` roles; arrow semantics follow RTL.
- **Density** toggle (comfortable / compact). **CSV export** of the current filter and visible columns.
- The table honours D19 (floor tree / chips) and D20 does not apply (the table is never grouped).

**Kanban:** columns חדשה · נשלחה · התקבלה · בטיפול · ממתינה לחלק · בוצעה · הוחזרה (closed / cancelled are not columns).
Dragging a card calls the same status route; drop zones of transitions the caller may not make are disabled; a drop on
"נשלחה" opens the assign dialog (an assignment always needs a choice of assignee).

**API rules (server side):**
- **Sort:** `sort=<key>:<asc|desc>[,<key>:<dir>]` from a whitelist (`number, title, department, priority, status, assignee,
  place, device, created, activity, stuck, sla`); anything else → 422. Ties are broken by `id`.
- **Filter:** department[], priority[], status[], assignee (`user:<id>` / `contact:<id>` / `none`), floor / area, stuck,
  waiting-for-manager, created from / to, `q`; the same whitelist validates saved views.
- **Pagination:** keyset (`cursor` = opaque base64 of the last row's sort values + id; tampering only moves the position inside
  the caller's visible set); `limit` 25 / 50 / 100 / 200.
- **RBAC:** every row passes the single `visible()` function (8). The SQL query applies a **superset prefilter** (department
  membership / all departments / creator / internal assignee, indexed) and `visible()` then checks each row (place scope,
  deny bindings); a page is filled by scanning at most 5 x `limit` candidate rows - if not filled, the page returns short with
  a `next_cursor` (the client keeps loading). Facet counts use the same path, capped at 2 000 scanned rows ("2000+").
  Columns that need more than view rights are blanked per row (e.g. internal-only fields for a non-member creator, 8).
- **Bulk** (`POST /tickets/bulk {action, items: [{id, revision}], params, client_request_id}`): at most 50 tickets; each item
  is checked separately (visible, manager rights in its department, allowed transition, revision) and runs in its **own**
  transaction - the answer lists `ok | stale | forbidden | invalid_transition | not_found` per id (not all-or-nothing, stated in
  the UI: "בוצע ב-12 מתוך 14"). `assign` to a contact needs `tickets.external` and queues one message per ticket (normal pacing and send hours; the
  confirmation says how many messages will leave); `remind` = internal signal or a `reminder` message, at most one manual
  reminder per ticket per hour; `priority` takes a priority **key** mapped per department; `close` requires a note. Audit: one
  row per ticket plus one `ticket.bulk` row (action, counts).
- **CSV export** (`GET /tickets/export.csv`): `tickets.manage` in at least one department; rows = the caller's visible set for
  the filter, at most **5 000** rows (more → 413 `export_too_large`, "צמצמו את הסינון"), 1 export per minute per user, streamed,
  UTF-8 with BOM (Excel and Hebrew), times in the installation zone; only the table's columns - never phone numbers, internal
  notes or links; cells beginning with `= + - @`, tab or CR are prefixed with `'` (CSV formula injection); audit
  `ticket.export` (filter, row count).

### 13.7 Display settings of the tickets screens (D18-D22, installation-wide)

| Setting (`tickets.settings.ui.*`) | Values | Default | Effect |
|---|---|---|---|
| `detail` (D18) | `drawer` / `fullscreen` / `drawer_fullscreen` | `drawer_fullscreen` | how a ticket opens from the list, board, table and device tab; the full-screen form is `#/tickets/<id>` |
| `board_floors` (D19, D30) | `chips` / `tree` / `chips_tree` | `tree` | floors / areas filter: chips above the list; or a side tree (sites › buildings › floors › areas, per-floor collapse, counts from facets; hidden on phone, where chips are used); or chips with the tree behind the filter button. **D30:** with `tree` / `chips_tree` each user can hide or show the tree with a control on the board (remembered per user in `user_prefs` `tickets.board.tree_hidden`; hiding it shows the chips instead); `chips` turns the tree fully off for the installation (no control shown) |
| `grouping` (D20) | `always` / `no_status_filter` / `never` | `no_status_filter` | whether the cards view groups into ממתין לי / תקועות / בטיפול |
| `closed_strip` (D21) | `week` / `all` / `hidden` | `all` | the last item of the state strip: "נסגרו השבוע", "סגורות (הכול)" or nothing |
| `new_ticket` (D22) | `sheet` / `dialog` | `sheet` | the create form as a side sheet or a centred dialog |

The values reach every signed-in user through `GET /tickets/module` (`ui: {...}`), so no settings read is needed.

## 14. Settings and screens

### 14.1 `tickets.settings` document (JSON, `system.configure`, revision-checked)

```json
{
  "revision": 1,
  "organization_name": "",
  "public": {
    "base_url": "",                         // https://t-<customer>.<arx-domain> ; validated: https, a DNS hostname (no IP literal), no path
    "trusted_proxy_cidrs": ["172.30.32.0/23"]   // peers whose CF-Connecting-IP is believed (10.2)
  },
  "links": {                                // D5 - department overrides in ticket_departments
    "sliding_days": 14,                     // 1-90
    "cap_days": 90,                         // 7-365, >= sliding_days
    "grace_hours": 24                       // 0-168
  },
  "staff_links": {                          // TKSTAFF1 (amendment 2026-10-16, 8.1): the staff link - installation only
    "sliding_days": 3,                      // 1-90
    "cap_days": 14,                         // 7-365, >= sliding_days; a LOWER value pulls in live staff links only
    "grace_hours": 1,                       // 0-168
    "require_code": true                    // raise only: the user's directory row (require_code) still raises it
  },
  "send_hours": { "from": "07:00", "to": "21:00" },   // D4, installation time.zone, every day; department override;
                                                      // "from" < "to" required (a window across midnight is refused 422 in
                                                      // release 1); from == to is refused; DST days follow the zone rules
  "code": { "ttl_min": 10, "max_attempts": 5, "lock_min": 30 },   // the length is fixed at 6 (D2), not a setting
  "whatsapp": {                             // accounts and their pacing live in messaging.whatsapp (9.9), not here
    "enabled": false,
    "use_buttons": false,
    "reply_window_h": 72
  },
  "display_name": { ... },                 // D33: the block of 14.3
  "urgent_is_critical": true,              // D28: installation default; ticket_departments.urgent_is_critical overrides
  "costs": { ... },                        // D31: the block of 11A.14
  "device_long_press": "sheet",            // D17: "sheet" (default, today's behaviour) | "menu" (the mock-up's opaque menu)
  "ui": {                                  // D18-D22, section 13.7
    "detail": "drawer_fullscreen", "board_floors": "tree", "grouping": "no_status_filter",
    "closed_strip": "all", "new_ticket": "sheet"   // board_floors "chips" = the tree fully off (D30)
  },
  "email_fallback": true,
  "retention": { "closed_days": 730, "contacts_inactive_days": 365, "inbound_days": 30, "outbox_days": 90, "link_access_days": 90 }
}
```

Who edits what: the whole document `system.configure`; the per-department overrides of links, send hours, history sharing,
automatic close and `urgent_is_critical` are fields of the department (`tickets.configure`). The Settings screen shows the
installation value next to each override ("ברירת מחדל: 14 ימים").

### 14.2 Screens

- **Operator area "קריאות"** (`#/tickets/...`; Q1 recommends its own top-level area): tabs "שלי" (assigned to me / opened by
  me), "המחלקה" (my departments), "לוח מנהל" (managers only), "הכול" (`tickets.all_departments` only). New `Mode` `tickets` in
  `router.ts` (`MODES`), `parseRouteLite` in `nav.ts`, `NAV_A`, `AREA_TABS`, `TAB_PERMISSIONS`, `services/user_prefs.py NAV_TAB_IDS`,
  `sw-app.ts renderScreen`. The list has a text filter (number / title / device). Ticket detail `#/tickets/<id>`: header,
  place line (link to the map when anchored), device link, assignee + delivery lines (D14: "נשלח בוואטסאפ - מסירה לא ידועה ·
  14:02", "הקישור נפתח ב-14:05" / "ייתכן שנשלח" / "לא נשלח"), "נשלח לפני השינוי" + "שלח עדכון" when stale, actions by
  permission, timeline, photos (internal ones marked), history snapshot. Create sheet: open tickets of the device first
  (duplicate hint), department, category (preselected from device domain), priority, title, description, photos, "העבר
  לטיפול" (optional, managers). Assign dialog: assignee, the exact message preview, the account / channel line, send-hours line
  with "שלח עכשיו", "לדרוש קוד אימות", a note with "גלוי למטפל". Clean-screen rule: no explanatory paragraphs; statuses as
  chips; one-line states.
- **Settings › קריאות שירות** (`#/system/tickets`, tab id `tickets`, in `AREA_TABS.system`, `SETTINGS_GROUPS` of
  `screens/system-index.ts`): sub-tabs (`?tab=`): כללי (switch, organization name, public address with a "בדיקת כתובת" probe,
  **link durations** (sliding days, cap days, grace hours), **send hours**, **long press on a device** (D17: "חלון המכשיר" / "תפריט קצר"), **display** (D18-D22: פרטי קריאה, קומות בלוח, קיבוץ, פס מצבים, קריאה חדשה), retention, key rotation), מחלקות (list; editor
  with categories, priorities, the full SLA grid incl. "קישור לא נפתח", members, templates, flags: automatic close after N
  days, history to the handler, urgent as critical, and the overrides of link durations and send hours), אנשי קשר וספקים
  (directory incl. the per-vendor history default of D23; edit with `tickets.configure`; managers read the contacts of their departments with the full phone), ערוץ
  הודעות (WhatsApp: on/off, buttons, reply window, the ticket uses' account mapping **read-only with a link to "חשבונות
  וואטסאפ"** and its warnings, per-account state and last successful send; this is a settings screen, so naming the integration
  is allowed here, but the UI text says "וואטסאפ" and "תשתית המערכת", never "Home Assistant"), תבניות הודעה.
- **Settings › חשבונות וואטסאפ** (`#/system/messaging-accounts`, 9.9.3; installation-level, not inside tickets).
- **"בדיקת כתובת" (review T11):** `POST /tickets/address/probe` fetches `<base>/t/healthz`. The base URL is validated (https;
  a DNS name, never an IP literal; the resolved addresses must not be loopback, link-local, RFC 1918, CGNAT, the hassio network
  `172.30.32.0/23`, or the names `homeassistant` / `supervisor` / `localhost`), `follow_redirects=False`, timeout 5 s, response
  body never shown - the answer is only "reachable / not reachable / wrong answer" with the status class; the route is in
  `remote_channel.BLOCKED_ON_REMOTE` (local sessions only), rate 6/min. No other admin-typed URL is fetched by the module.
- **The WhatsApp-disconnected UX** (operator side, D13): the assign dialog shows one line "וואטסאפ לא מחובר - ההודעה תישלח
  במייל" / "... - העתק קישור ושלח בעצמך" according to the fallback (for an internal user: "תישלח התראה במערכת"); the ticket
  shows the delivery line; nothing else on operator screens. Managers get `ticket.send_failed` in-app; administrators get
  `ticket.channel_down`.
- Five skins: the new screens use existing components (`sw-page`, `sw-card`, `sw-sheet`, `sw-tabs`, chips) and `--sw-*` tokens only;
  any skin-specific rule stays within each skin's 50-rule budget; layout-guard specs extended.

### 14.3 The module's display name (D33)

Internal identifiers stay `tickets` everywhere (routes, tables, permission ids, settings keys, CSS / element names). Every
**user-facing** text takes the name from one setting, so the module can be renamed later without a code change.

- **Setting** `tickets.settings.display_name` (edited in Settings › קריאות שירות › כללי by `tickets.configure`; audit
  `tickets.display_name.update` with before / after):

  ```json
  "display_name": {
    "he": { "one": "קריאה",   "many": "קריאות",  "gender": "f" },
    "en": { "one": "ticket",  "many": "tickets", "gender": "n" },
    "ar": { "one": "طلب",     "many": "طلبات",   "gender": "m" },
    "ru": { "one": "заявка",  "many": "заявки",  "gender": "f",
            "forms": { "acc_one": "заявку", "gen_one": "заявки", "gen_many": "заявок" } }
  }
  ```

  Each value 1-30 characters, `Cc` / `Cf` stripped, no `{` `}`. `gender` exists because Hebrew, Arabic and Russian verbs and
  adjectives agree with the noun ("קריאה נשלחה" / "אירוע נשלח"); Russian also needs a few case forms. The Settings form asks
  only for the forms a language's catalogue uses and shows a live preview of five sample sentences per language.
- **Helper:** frontend `tickets/module-name.ts` - `mn(form: 'one' | 'many' | string, lang?)` and a catalogue convention: strings
  in `tickets/text.ts`, the public-page catalogue and the backend message catalogue write `{mn}` / `{mn_many}` / `{mn:acc_one}`
  for the noun and `{g:f=...|m=...|n=...}` for an agreeing word; one formatter (`formatModuleText`) resolves both. Backend
  `services/tickets/naming.py` - `module_name(conn, lang, form)` and the same formatter, used for notification texts, e-mails,
  CSV headers, permission / role labels, outbox rendering and the public API's `labels`. The names reach the shell through
  `GET /tickets/module` (`display_name`), the vendor page through `GET /t/api/ticket` (`labels` for the contact's language).
- **Where it applies:** nav entry and area tabs, page titles, the device tab "קריאות" and its count, the long-press menu items
  (D17), notifications (CR-018 texts are rendered at emit time - rows already delivered keep the old wording), permission and
  role labels (`PERMISSION_LABELS` entries of `tickets.*` and the single-permission roles become label **templates** rendered
  when the access screens list them; audit rows keep ids), Settings tabs and headings, board / table headings, CSV headers (in
  the requester's language), e-mails, the vendor page in all four languages (D26), and the message templates.
- **Message templates:** the starter templates use `{module_name}` / `{module_name_plural}` (e.g. "{module_name} {number}
  ({department}): {title}"); the placeholders render in the **contact's** language. Templates an administrator already
  edited keep their own text: a rename never rewrites them; the Settings form says "N תבניות כוללות את השם הקודם" with a link
  to each.
- **Lint / test (forbids hard-coding):** `test_tickets_module_name_lint` (backend) and `unit-tickets-module-name` (frontend)
  scan the user-facing string sources of the module - `frontend/src/tickets/**`, `frontend/src/public-ticket/**`, the tickets
  entries of `i18n/he.ts`, `services/tickets/**` message catalogues, starter templates, notification texts, permission labels,
  CSV header maps - for the default words in the four languages (קריאה, קריאות, ticket, tickets, Ticket, Tickets, طلب, طلبات,
  заявка, заявки and their listed case forms) and fail on any match outside `module-name` defaults and code identifiers. A
  rename test sets a different name (e.g. "פנייה" / "פניות", masculine "אירוע" / "אירועים") and asserts the nav, the device tab,
  a notification, a CSV header, an outbox render and the vendor page show it, with gender agreement in Hebrew.
- **Effort:** about +2 agent-hours in slice 1 (helper, setting, lint, rename test); everything else is the normal cost of
  writing those strings once.

## 15. Retention and privacy

### 15.1 Retention (janitor step `tickets.retention.janitor`, self-throttled to hourly)

| Data | Kept | Then |
|---|---|---|
| Closed / cancelled tickets with events, attachments, device context, assignments, links | `closed_days` (default 730, range 90-3650) after close (`purge_after`) | hard delete rows + files |
| Open tickets | while open | - |
| Outbox rows | 90 days | delete (the timeline keeps "message sent") |
| Inbound rows | 30 days (`ambiguous` / `late` content: 30 days or when handled, whichever first) | delete |
| Link access rows | 90 days | delete |
| Codes, link sessions, redeem ids | 1 day after expiry | delete |
| Request idempotency rows (`ticket_requests`) | 24 h | delete |
| Messaging ledger rows | 2 days | delete |
| Cost claims, revisions, decisions, invoice files (D31) | `costs.retention_days` (default 2555 = 7 years) after approval / payment, independent of the ticket (11A.11) | delete rows + files |
| Pending (unsubmitted) claim files | 24 h | delete |
| Expired / revoked links | with their ticket | - |
| Audit rows | existing 365 days | existing prune |
| Contacts | while active; inactive (not assigned) for `contacts_inactive_days` → flagged "לבדיקה" in the directory | erased only by a person (15.2) |

### 15.2 External people's data

- Stored about a non-user: name, company, phone, e-mail, language, notes, which tickets they handled, what they wrote and
  uploaded. Purpose: handling the organization's tickets. Shown only to holders of the ticket permissions; the full phone to
  `tickets.configure` and to holders of `tickets.external` who manage a department the contact is allowed for (D25).
- **Erase** (`tickets.configure`, confirmation, audited `ticket.contact.erase`): replaces name with "איש קשר שנמחק", clears
  phone, phone_key, e-mail, notes; revokes live links (`contact_erased`); queued and held messages cancelled; the timeline keeps
  the frozen `assignee_name` / `actor_name` unless "מחק גם מההיסטוריה" is chosen, which rewrites those to the tombstone name
  (notes and photos the person added stay as ticket content - the organization's record - and are removed with the ticket at
  retention).
- **Phone / e-mail change** of a contact with live links: links revoked (`contact_changed`), managers told (8, 13.4) - a
  directory editor cannot redirect a live link to a phone of their choosing (review T19-4).
- Export of a contact's data (on request of the person): `GET /tickets/contacts/{id}/export` (JSON of the row and of the
  timeline items authored through their links), `tickets.configure`, audited.
- The WhatsApp messages themselves live in the dedicated phone and in the recipient's WhatsApp; Arx cannot delete them. The
  guide says so.

## 16. Security and privacy review

Updated in r2 with the independent review (its T-numbers in brackets). Text-handling rule for both surfaces (review T9):
every free-text field (titles, descriptions, notes, return reasons, contact names, inbound text, template text) is stripped of
Unicode categories `Cc` and `Cf` (control, bidi overrides U+202A-202E / U+2066-2069, zero-width) before validation; text is
rendered only with Lit text bindings / `textContent`; `unsafeHTML`, Markdown and **auto-linkifying of URLs are forbidden** in
both the internal app (which has no CSP under Ingress) and the public page.

| # | Threat | Mitigation | Residual |
|---|---|---|---|
| S1 [T1, T2] | **Token guessing / enumeration, timing** | 192-bit derived token; lookup by hash after the rate-limit check; uniform 404 for unknown / expired / revoked / past grace / off / purged; 20 failures/min per network (trusted-proxy rule) + 300/min global then 429 with a "try again" text; no ticket ids accepted from the public client; sequential ticket numbers never act as credentials | the global 429 can delay a fresh link's first open during a flood (Cloudflare rate limiting in front reduces it) |
| S2 [T4] | **Link forwarding** | scope = one ticket; sliding expiry with a 90-day cap; revocation on reassign / return / "לא שלי" / manual / contact change; read-only grace after close; the page shows no other tickets, no phone numbers, no internal notes or photos; code per contact or per assignment (title and place hidden until the code); manager sees opens from distinct devices (`client_key`) | without a code, whoever holds the message can update that ticket while the link lives - accepted by the owner's default; forwarding to a technician is the expected use |
| S3 [T3] | **Token leakage in transit / logs / mail scanners** | token in the URL fragment; `Referrer-Policy: no-referrer`; e-mail carries a redeem link whose GET is static (10.2); public listener: no access log, route templates only; Arx never logs outbox texts, tokens, codes, redeem ids or event payloads; log-scan test over both servers' loggers; "סיום" forgets the token | the full URL is inside the WhatsApp message text: HA's recorder can store `whatsapp_message_sent` (`content`) and the integration's "last message" sensor shows the last content (`[WA-SRC]`) - the recorder exclusion of `whatsapp_message_*` events and of that sensor is a **required install step**; the redeem id is readable in a scanner's logs for 24 h (3 releases) |
| S4 [T9] | **XSS / bidi spoofing through text** | the text rule above; strict CSP on the public page; templates validated | low |
| S5 [T7, T8] | **Hostile uploads, decompression, storage** | JPEG/PNG only by magic bytes; 16 MP before decode; JPEG `draft`; own decode semaphore; 8 MiB; full re-encode; random names; confined paths; caps per link / ticket / installation checked before decode; `try/except` around decode; fixed type + `nosniff` | Pillow vulnerabilities (dependency watch) |
| S6 [T12] | **Replay / forgery of inbound events** | advisory only (forward-only to acknowledged / in progress, notes marked unverified; never done / close / return; code-protected contacts: notes only); account filter by `entry_id`; late replies become flagged notes with no status effect; dedupe 24 h; nonces bound to the live link and, when a number is present, to the sender's phone key; no auto-replies | an HA administrator can fake a reply - they could do more anyway; without a phone number (LID) a nonce alone authorises an advisory action |
| S7 [T13] | **Phone-number and PII exposure** | numbers only in `ticket_contacts.phone_e164` and the manual-account value; HMAC keys elsewhere; outbox / ledger store no number; audit / timeline / logs never carry numbers; unmatched reply text shown only after a manager claims it; assign preview shows the exact outgoing text; installation settings out of project backups (`SETTINGS_KEEP`); the account label keeps 4 digits | the database file and HA add-on backups hold numbers and the module key |
| S8 [T14, T15] | **Data to outsiders** | device history off by default, opt-in per department, never for lock / alarm panel / cover / camera; photos and notes internal unless marked for the handler | what a manager marks external is their choice |
| S9 [T10] | **Session / CSRF on the public app** | no cookies; token and code session in custom headers; no CORS; JSON-only writes | - |
| S10 [T5] | **Code brute force; lock-out as DoS** | 6 digits (fixed); 10-min expiry; 5 attempts per link per 15 min → 30-min lock; 3 codes/h per link; single use; HMAC; constant-time compare; one-tap new link for the manager | ~5/10^6 per window; a link holder can lock the vendor out for 30 min |
| S11 [T21] | **Channel abuse → number ban; night messages** | sends only from authenticated manager actions, the SLA monitor and code requests; per-account pacing shared by all uses; send hours for vendor-bound messages; no auto-replies; test sends capped; dedicated number recommended; shared-account warnings | Baileys ban risk remains (unofficial client) |
| S12 [T18, T19] | **Privilege leaks and escalation between departments** | one `visible()` function (placeless tickets on any held scope; internal content for members / managers only; device tab requires `devices.read`); `tickets.configure` sensitive; member edits only where one already manages; template diffs audited; no token for internal users; contact changes revoke links; account mapping behind a sensitive permission. **Amended 2026-10-16 (TKSTAFF1, 8.1):** "no token for internal users" now reads "no token for internal users except the scoped staff link of the CURRENT assignee (external-handler scope, link actor, no claim surface, code by default, 14-day cap, revoked on deactivation / membership loss / row change)" | any member with `tickets.view` is assignable (D15); single-user grants (8.2) are visible only in the bindings lists - the "הרשאות" sub-tab shows them in one place; a forwarded staff message together with its forwarded code (within 10 minutes) acts on that one assignment; a lost unlocked phone is not protected by the code (report it: the manager revokes or reassigns) |
| S13 [T17] | **DoS on the shared process / public listener as a pivot** | own thread + event loop + threadpool limiter; concurrency 16; keep-alive 5 s; body deadlines; rate limit before DB; one upload per link; own decode semaphore; separate app object with only `/t/*`; route-enumeration test; Cloudflare rate-limit rule | the SQLite write gate and the GIL are still shared (public writes are rate-limited) |
| S14 [T11] | **SSRF** | the address probe validates the target, connects to the validated address (no second resolution), never follows redirects, never shows the body; local-only; inbound `media_url` never fetched; the public app has no redirect parameter | - |
| S15 [T16] | **Log and error leaks** | no access log; route-template logging; invalid-request records filtered; public 422 without `input`; `httpx` at WARNING | - |
| S16 [T22] | **Replay of public writes** | `client_request_id` stored 24 h in `ticket_requests` | - |
| S17 | **Message content injection** (a manager-typed title, a template) | plain placeholders; no URL other than `{link}`; templates behind a sensitive permission with an audited diff | a manager can still write anything in a title - it is their message |
| S18 | **Retention / GDPR-like duties for external people** | retention table 15.1, erase and export (15.2), minimal fields, purpose-bound display | messages already delivered to WhatsApp cannot be recalled |
| S19 [T20] | **Key compromise / backups** | `k_tickets`, `k_messaging` in `/data/secrets` (mode 600), not in DB or project backups; rotation revokes all links | an HA add-on backup holds keys + DB; a host-level compromise exposes everything anyway |
| S20 | **Account mapping tampering** (redirecting ticket messages to another number) | `messaging.accounts.manage` is sensitive and system_admin-only by default; every change audited (keys before/after); a moved use shows the queued count before saving; `unknown` sends never re-routed | an administrator with the permission can choose any linked number - inside the trust boundary |
| S21-S26 | **Cost claims** (tampered amounts, claim after expiry, double submission, currency confusion, hostile PDFs, cost data leaks) | section 11A.13 | 11A.13 |

Physical-safety note: tickets never trigger device actions; a device ticket never controls the device. Nothing in this module
calls an HA service other than the two WhatsApp send services.

## 17. Observability

- **Health** (`GET /api/v1/tickets/health`, `system.configure`; shown in Settings › קריאות שירות › כללי and in the diagnostics
  screen): module on, public listener running + last request time + **last 5xx** + **rate-limit trips last 24 h** + dropped
  invalid-request records, public base URL probe result, outbox depth by state (incl. `held` by reason), oldest queued age,
  sends last 24 h by outcome **per account**, account states + since + last success, inbound last 24 h by result + events
  dropped by the account filter + inbound queue overflows, links live / in grace / expired / locked, SLA monitor last run +
  duration, attachment directory size.
- **Logs:** logger `smplwise.tickets.*`; ids only (ticket id, outbox id, link id prefix 6 chars); never phone, token, code,
  message text, event payload; warnings for channel down, monitor errors, upload refusals (reason code only).
- **Audit actions:** `tickets.module.enable|disable`, `tickets.settings.update` (revision + changed keys, never values of
  account/phones), `ticket.create|edit|assign|status|note|photo|eta|return|close|cancel|reopen`, `ticket.link.mint|resend|
  revoke|copy`, `ticket.code.send|verify|lock`, `ticket.message.send` (outbox id, channel, purpose, outcome - never text,
  number, token), `ticket.inbound` (result, ticket id), `ticket.contact.create|update|erase|export`,
  `ticket.department.create|update|delete`, `ticket.member.add|remove`, `ticket.sla.update`, `ticket.template.update` (with
  the before/after text diff), `ticket.inbound.claim`, `ticket.key.rotate`, `messaging.accounts.update` (use keys and account
  keys before/after, never numbers), `messaging.accounts.test`; public refusals throttled like `REFUSAL_AUDITS`.
- **Log hygiene (review T16):** `httpx` stays at WARNING (`main.py:169`) for the whole process (the public server is in the
  same process); WhatsApp service payloads are never put in `ApiError.details`; the log-scan test (19) captures the
  `uvicorn.error`, `uvicorn.access` and `smplwise.*` loggers of both servers.
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

## 18A. Future work and backlog (recorded, not in release 1)

| Item | Source | Note |
|---|---|---|
| **SMS channel** | owner D13 | a `TicketChannel` adapter (`key = 'sms'`) + outbox CHECK value + one step in the fallback order (9.5); provider choice is a separate decision |
| Official WhatsApp Business API channel | r1 | same interface; would bring delivery receipts |
| Rule-based ticket creation (phase 2) | brief | section 18 |
| Working-hours SLA calendars | D7 | |
| PDF / document attachments (re-rendered or sandboxed) | review gap | the page points vendors to the usual way meanwhile |
| "Ask the manager" note type on the page | review gap | raises `waiting_on = manager` (reason `question`) |
| CSV export / monthly counts per department and vendor | review gap | release 1 has the text filter only |
| Per-department notification matrix, daily digest of `done` / `closed` | review gap | release 1: `notify_new` for the first manager only, `urgent_is_critical` |
| Separate handler and directory permissions | D15 trade-off | no data change needed |
| Payment / accounting integration | D31 | subscribes to `emit_cost_event` or reads the report API (11A.9) |
| Rasterising invoice PDFs to images (safe preview) | D31 | needs a sandboxed renderer the add-on does not have |
| Two-person approval above an amount | D32 (not chosen now) | a later setting |
| OCR of photographed / PDF invoices | D32 | hook `on_document_ready`, column `ocr_status` (11A.6A) |
| Live in-page camera viewfinder | D32 | needs `Permissions-Policy: camera=(self)` and a permission prompt |
| More vendor-page languages | D26 | one catalogue file + templates per language |
| Pacing shared with WisKey's own WhatsApp sends | 4, contradiction 3 | needs WisKey to report its sends; release 1 has the "used outside Arx" mark |

## 19. Test plan by layer

| Layer | What | Tool / place |
|---|---|---|
| Unit (backend) | state machine table (every row of 11.2 allowed / refused per actor, incl. "לא שלי" with and without reason, automatic close after N days and its cancellation by a reopen); SLA calculator with a fake clock (each threshold incl. "link not opened", ETA suppression, waiting_part clock, idempotent ladder, every threshold editable and empty = off); link lifetime (first expiry ≥ resolve window, sliding extension by each action type, no extension by a header-less open, cap, lower-cap pull-in, grace read-only, immediate revoke cases, department overrides); token derivation / hash / generation bump; redeem ids (static GET, 3 releases, 24 h); code issue / verify / lock, per-assignment raise-only, code channel rule (D6) in every combination of link channel and WhatsApp state; send hours (held purposes, codes never held, `send_now`, critical still held for vendors, zone handling incl. a DST change day, a window across midnight refused with 422); inbound parser (Hebrew/English words, digits, references, groups, long text, Cc/Cf stripped) and matcher (one / none / several candidates, nonce of another sender, nonce without a number, LID sender, late vs stale, duplicate, code-protected contact, account filter with and without `entry_id`); template validation; place resolution; history snapshot (tracked, untracked, withheld, person names dropped, security domains never external); outcome classification of the adapter (connect error, read timeout, 4xx, unknown account, 5xx, success false); text hygiene | `smplwise_vms/backend/tests/test_tickets_*.py` |
| Unit (messaging accounts) | discovery from a mirror fixture (one entry, two entries, entity disabled, no connectivity sensor, platform renamed → manual only); state mapping (on / off / unavailable / missing / HA down); use resolution (department override, codes inherit the installation value, unmapped); pacing ledger shared by two uses on one account and separate across accounts, codes excluded from the per-recipient cap; account change with queued / held / sending / sent / unknown rows (9.9.4 table, row by row); disconnect → hold → fallback → no WhatsApp resend after reconnect; warnings (shared with another module, shared outside, unmapped required use, manual duplicate heuristic); number never in audit or logs | `test_messaging_accounts*.py` |
| Backend API | table API: sort whitelist, keyset pagination stability, short pages under the visibility check, facets cap, bulk per-item results and audit, export gate / 5 000 cap / formula-injection escaping / no phones; D23 server refusal of `share_history` for security domains; every internal route with the permission matrix (viewer / operator member / operator non-member / floor-scoped creator of a placeless ticket / manager / manager of another department / all-departments / deny binding / module off → 404); internal notes and photos hidden from non-member creators; `by-entity` without `devices.read`; `tickets.configure` member edits outside one's departments refused; contact with `user_id` → 409; contact phone change revokes links; optimistic revision 409; assignee picker lists department members only; notifications created with the right recipients and visibility; `messaging.accounts.manage` gate and audit; `SETTINGS_KEEP` contents and a backup round trip that carries no ticket settings; `body_limit` row for internal attachments | pytest + existing fixtures |
| Public app | route enumeration (only `/t/*`); main app 404 for `/t/*` on Ingress and `/arx`; listener answers 404 while the module is off; headers (CSP etc.) on every response; uniform 404 for unknown / expired / revoked / past grace / off / purged; rate limits (429 text) checked before any DB access (assert no query on an over-limit request); trusted-proxy rule for `CF-Connecting-IP`; JSON-only and size caps; body read deadline; one upload in flight per link; every write path with and without code session; idempotency replay and `request_id_reused`; return / "לא שלי" revoke at once; 422 envelope without `input`; server config values (`access_log`, `server_header`, `limit_concurrency`, `timeout_keep_alive`) and no signal capture off the main thread; stop joins the thread | pytest with an ASGI client + one real-socket test of the threaded server |
| Uploads (hostile) | decompression bomb, 16 MP + 1 pixel, truncated JPEG, PNG with trailing ZIP, WebP refused, SVG/HTML renamed .jpg, HEIC, EXIF GPS present → stripped (assert re-read has no EXIF), 8 MiB + 1 byte, 61st photo, storage cap reached before decode, semaphore busy → 429 while an admin background upload is unaffected | pytest with generated files |
| Channel / outbox | fake `ha-whatsapp` (`tests/fake_ha_whatsapp.py`: records `call_service` payloads incl. `account`, configurable outcomes incl. unknown-account errors, injects events with and without `entry_id`, exposes a registry fixture with one or two accounts); pacing per account; send hours; supersede; fallback to in-app / e-mail (fake SMTP, redeem link, never the fragment) / "waiting for manager"; code-protected fallback rule; account down/up signals; never retry or re-route `unknown` | pytest |
| Cost claims (D31) | mode resolution (installation / department / vendor, done vs cannot-handle vs not-mine); server computation (minor units, per-line rounding, VAT excluded / included / none / exempt, caps, flag, client totals ignored); revisions immutable, supersede, reject → resubmit, adjust with reason, mark / unmark paid; close gate and override; auto close skips; claim window after close / expiry / grace, never after revocation, reopen; permission matrix (view vs approve, vendor sees only its own claim, fields stripped); hostile PDFs (JS, OpenAction, EmbeddedFile, encrypted, no trailer, oversize, wrong magic, duplicate hash) and download headers; per-assignment requirement and its preselection chain; VAT toggle both ways and exempt; camera flow (Playwright with a fake file for `capture`, refused / no-file path, multi-page add / retake / rotate / crop / contrast, reorder, upload retry) and the assembled manager PDF; report per currency; CSV gates and escaping; retention after ticket purge; Playwright: vendor claim step in he / ar (RTL) and en (LTR), manager review dialogs, table cost columns | pytest + Playwright |
| Log hygiene | run the full send + inbound + public flows (both servers) with a capturing handler on the root, `uvicorn.*` and `smplwise.*` loggers; assert the test phone, token, redeem id, code and message text appear nowhere in logs or audit rows | pytest |
| Migrations | 0079-0083 apply on an empty DB and on a 2.4.8 DB copy fixture; foreign keys; indexes exist | existing migration tests |
| Frontend unit | tabs computation of `device-activity` (with / without activity, with / without permission, module off); the D17 long-press matrix row by row (module off, no permission, mode sheet / menu x tracked / other) and the menu items per permission; `activityTag` for non-tracked rows; text catalogue completeness; public page state reducer (grace, not-mine confirmation, busy, offline draft retry with the same request id) | node unit tests (`frontend/tests/unit-*`) |
| Playwright (internal) | list (text filter), board (cards / table / kanban; sort, column chooser, saved view, multi-select + bulk with partial results, inline status and assignee, keyboard path, density, CSV download, phone compact list; each D18-D22 setting value), detail (delivery lines of D14, stale flag + "שלח עדכון"), create sheet (duplicate hint), assign dialog (preview, send hours, code, account line), device tab (area screen long press in both modes incl. the opaque menu in all five skins, menu item, map card "more" action + count chip), settings tabs incl. link durations, send hours, SLA grid, department overrides, WhatsApp accounts screen with warnings; desktop / tablet / mobile / RTL; loading / empty / error / ready; five skins; layout guards; visual baselines for new screens only | `--workers=1` locally; full runs on the runner |
| Playwright (public page) | mobile 375 px + desktop; code flow; photo upload; "לא שלי" with required reason; grace page; redeem page; unavailable and busy pages; dark mode; no external requests (network assertion); bundle size budget | separate spec project against the public app |
| Live (owner-approved only, each action separately - review C14) | 5a: one read-only registry/state read of the `whatsapp` platform and one `get_state` per connection entity (no send); 5b: one test send to the owner's own number with `account` = entry id, one inbound reply and one button tap from the owner's phone (records the real `sender_number`, `timestamp`, `entry_id` shapes before the matcher is final); 4: one tunnel route to 18093 | **NOT_RUN** until the owner approves each action (CLAUDE.md: no writes / messages without task-specific approval) |

Tier: **L** (a new unauthenticated surface, uploads, outbound messages).

## 20. Slices, effort and order

Effort in agent-hours (one capable agent; includes tests and docs of the slice, excludes runner queue time). r1 numbers in
brackets.

| # | Slice | Contents | Effort (r1) | Depends on |
|---|---|---|---|---|
| 1 | Skeleton + internal tickets | module switch + `/me` flag + `SETTINGS_KEEP`; the six permissions incl. `tickets.external` and the six single-permission roles + delegation defaults (D25, 8.2); D18 / D22 display settings (drawer / full screen, sheet / dialog); migration 0079 (all core tables incl. r2 columns and `ticket_requests`, one seeded "אחזקה" department with priorities + default SLA); `services/tickets` store/model/access/create; visibility rule with placeless any-scope and internal-content split; internal routes (CRUD, timeline, status incl. return kinds, notes / photos with the external flag, assign to internal users, assignee picker, text filter, duplicate hint + `duplicate_of`, reopen count, send-update flag); the five permissions + labels + sensitive list; Cc/Cf text hygiene; internal attachment body-limit row; audit; nav area + list + detail + create sheet; i18n catalogue with the configurable module name, helper and lint (D33); demo store | 34-42 (22-28) | - |
| 2 | Departments + SLA | settings screens (departments, categories, priorities, the full SLA grid incl. "link not opened", members with the escalation rule, ticket templates with diff audit; department flags: automatic close, history to the handler, urgent as critical, link-duration and send-hour overrides); revision-checked admin routes; SLA due computation on every change (no monitor yet); department scoping tests | 16-21 (14-18) | 1 |
| 3 | Device tab | `device-activity` third tab, `activityTag` for all entities, the two long-press modes of D17 (setting, `/me` flag, opaque menu extending `renderMenu`), menu item, map card action + count chip, `place.py`, `device_context.py` (security-domain rule), device-originated creation, `by-entity` with `devices.read`, category preselect by domain; D23 history checkbox | 16-22 (12-16) | 1 (2 for category preselect) |
| 4 | Public page + links + directory | migration 0080; contacts directory (screens, phone visibility, erase/export, phone-change revocation); `links.py` (sliding expiry, cap, grace, redeem ids); public app on 18093 on its own thread/loop with the isolation table of 10.1 + add-on option + port; trusted-proxy rate limiting (`RateLimiter` scope parameter); second Vite entry + page (grace, "לא שלי", "סיום", offline draft, time zone, busy page); public API incl. idempotency and the 422 envelope; uploads validator (16 MP, JPEG/PNG, own semaphore); headers and log filter; address probe with SSRF rules; assignment to contacts with channel `manual` (copy link); assign preview; per-vendor history default (D23); page in he / en / ar / ru with RTL / LTR (D26); `docs/security/` note on token-authorised media | 39-50 (22-28) | 1, 2 |
| 5a | WhatsApp accounts (installation-level) | migration 0082; `services/messaging_accounts.py` (discovery from the mirror, on-demand label read, states, use registry + resolution, mapping document + `SETTINGS_KEEP`, per-account pacing ledger, warnings); `messaging.accounts.manage`; routes; Settings › חשבונות וואטסאפ screen; read-only live check (owner-approved) | 12-15 (new) | 1 |
| 5b | Ticket channel + inbound | migration 0081; channel interface, WhatsApp adapter (account from the mapping, exception split, unknown-account classification) + e-mail adapter (redeem link), outbox worker with per-account pacing, send hours, `held` states, account-change / disconnect behaviour of 9.9.4, fallbacks of D13 incl. the code-protected rule, message templates per language (D26) and preview, D14 timeline lines, "send now" route for `tickets.external` (D29), settings tab, test send, `ha_sync` subscription with the account filter, inbound parser + matcher (late, LID / nonce-only, claim-before-reveal ambiguous queue), fake `ha-whatsapp`; live send/reply check (owner-approved) | 26-32 (20-26) | 4, 5a |
| 6 | Stuck / escalation + board | SLA monitor in the janitor (incl. "link not opened", automatic close, link expiry), reminder ladder (send-hours aware, sliding extension), CR-018 sources / category / recipient rules / visibility branch incl. `contact_changed` and per-account `channel_down`, `urgent_is_critical`, `notify_new` first-manager default, manager board screen (cards view) with D19 floors tree / chips, D20 grouping, D21 state strip, facets route, one-tap "התקבל" deep link | 19-25 (14-18) | 2, 5b (external reminders) |
| 6b | Board table + kanban (D24) | table view (sticky header, sort, column chooser, density, keyboard, inline status / assignee), kanban, phone compact list, saved views (`ticket_saved_views`, `user_prefs` key), list API sort / keyset pagination / short pages, bulk route + bar, CSV export route, tests incl. Playwright | 18-24 (new) | 6 |
| 7 | Verification code (option B) | contact flag + per-assignment flag, code send/verify/lock through `tickets.codes`, D6 code-channel rule at assign and at send, code session, page states, lock card with one-tap new link | 10-13 (8-10) | 4, 5b |
| 9 | Cost claims (D31) | migration 0083; `services/tickets/costs.py` (mode resolution, computation, lifecycle, close gate, claim window, decisions, payment hook); PDF / photo file path with the 11A.6 rules and body-limit rows; public claim routes + the vendor-page claim step (4 languages) incl. camera capture, page editor, multi-page documents (D32); manager cost card, review dialogs, revision history, on-behalf entry; the two permissions + roles; CR-018 sources and vendor messages; report screen, cost columns, CSV; per-assignment requirement in the assign dialog; assembled-PDF download; OCR hook; retention; tests | 36-48 (new) | 4, 5b, 6b (columns) |
| 8 | Guide + review + gate | DOCS.md section + Hebrew user guide (installer: dedicated number, pairing, 14-day rule, choosing accounts per use, tunnel route, **required**: recorder exclusion of `whatsapp_message_*` and the last-message sensor, Cloudflare rate-limit rule and script features off for `t-*`, HA backups are sensitive; manager: link durations, send hours, codes and forwarding), security review of the public surface, upstream watch entry (`FaserF/ha-whatsapp`), bilingual changelog lines, tier-L gate on the runner | 10-15 (8-12) (+ gate runtime) | all |

**Total: 236-307 agent-hours** (r1: 120-156; **+116 to +151, about +97%**; D33 +2 in slice 1). r2.5 / r2.6 (D31, D32 - cost claims with camera capture) added slice 9 (36-48; the camera, page editor and multi-page documents are +6-8, the per-assignment choice +1). Before it: 198-257. r2.3 (D25-D29) added 9-10: `tickets.external` and the single-user grant roles + "הרשאות" sub-tab (+3 in slice 1), languages (+4-5 in slice 4, +2 in slice 5b), D28 / D29 inside slices 5b / 6. r2.1 (D17) added 2-3; r2.2 (D18-D24) added 25-33: the table / kanban slice 6b (18-24), board settings D19-D21 (+3-4 in slice 6), D18 / D22 (+2-3 in slice 1), D23 (+2 in slices 3 / 4). Where the increase comes from: listener isolation,
link lifecycle and the redeem page (+12-16 in slice 4); the new WhatsApp accounts slice 5a (+12-15) and its effect on the
channel (+4 in 5b); department-scoping and data-exposure fixes, duplicates, reopen, text filter (+5-6 in slice 1); settings
for every threshold and the department overrides (+2-3); the owner's new items (automatic close, "link not opened", "לא שלי",
D14 lines) about +4 spread over slices 1, 2, 4, 6. No open owner question changes it any more.
Calendar: about **10 working days with 3 agents in parallel** after slice 1 (r1: 4-5). Phase 2 rule action: 6-8 more.

**Recommended order:** 1 → (2 ∥ 5a) → (3 ∥ 4) → 5b → ((6 → 6b → 9) ∥ 7) → 8. Slice 1 is the single owner of the shared files
(`roles.json`, `routers/access.py PERMISSION_LABELS` - it also adds `messaging.accounts.manage` so 5a does not touch them -,
`shell/nav.ts`, `router.ts`, `sw-app.ts`, `backup.SETTINGS_KEEP`, migration 0079); later slices touch shared CR-018 files
(`notify_policy.py`, `notify.py`, `notify_visibility.py`) only in slice 6, `ha_sync.py` only in slice 5b, `body_limit.py` only
in slice 1, `remote_channel.BLOCKED_ON_REMOTE` only in slice 4 (5a's test-send route joins it in 5a - a one-line, separately
reviewed change).

## 21. Risks

1. **First anonymous write surface** in the product (public listener + uploads). Mitigated by isolation (separate app, origin,
   port, option, own thread and loop, concurrency limits) and the tests of section 19; a dedicated security review in slice 8
   before any customer enables it.
2. **WhatsApp via an unofficial client** (Baileys): number bans, no receipts, logout after 14 days without the phone, buttons
   that may not render. Mitigated by per-account pacing, send hours, a dedicated number, fallbacks, "delivery unknown" wording,
   the status line; the interface admits the official API and SMS later.
3. **`ha-whatsapp` facts read from source, not the installed version** (account resolution by entry id, the connectivity
   sensor, `entry_id` on inbound events). Mitigated by the manual-account fallback, a matcher that works without `entry_id`,
   and the owner-approved live checks of slices 5a / 5b before the code is final. The integration is young and changes often:
   it joins the upstream watch.
4. **Inbound trust and matching**: HA events can be fired by anyone with HA admin rights; replies lack message ids; LID
   addressing may hide numbers. Mitigated by the advisory-only rule, nonces, the account filter, late-note handling, dedupe and
   manager handling of ambiguous replies.
5. **Link text persistence outside Arx** (the vendor's chat, HA's recorder / logbook, the integration's "last message" sensor,
   mail scanners). Mitigated by sliding expiry with a cap, revocation, codes, the redeem link and the required recorder
   exclusion; cannot be eliminated.
6. **The existing entity mirror may already hold the integration's "last message" sensor** (its state or allowed attributes may
   carry message text, `[WA-SRC]`) - this is outside the tickets module (the general mirror reads every entity). Recorded for
   the owner: slice 5a's read-only check looks at what that sensor's state contains; if it is message text, a separate small
   change should exclude `platform = 'whatsapp'` sensors of that kind from the mirror (not built here without approval).
7. **Department scoping outside the RBAC scope model**: a second "where" dimension that every query must respect. Mitigated by
   one `visible()` function and a matrix of permission tests per path, including notifications and the device tab.
8. **Single-user grants** (D25, 8.2): six more built-in roles in the role picker and grants that live in bindings, not roles.
   Mitigated by clear Hebrew names, the "הרשאות" sub-tab that lists every holder and how they hold it, the audit of every bind,
   and the sensitive roles staying out of delegation by default.
9. **Device window fragmentation**: four different device surfaces; only the activity sheet has tabs, and long press exists only
   on area/tile screens. The CR adds the tab there and a map-card action and chip; other surfaces (bubble skin sheet without the
   activity sheet, 3D) stay without a direct entry in release 1.
10. **Tunnel / hostname provisioning** per customer for the public page (owner or installer action; UNVERIFIED reachability of a
    second container port through `cloudflared`).
11. **Personal data of non-users** (phones, names, photos): retention and erase must work from day one.
12. **Parallel migration numbers** (0079-0084 may be taken by another branch first): renumber at integration.

## 22. Open questions

**No owner question is open.** All fourteen r1 questions are closed (Q6, Q7, Q8, Q12 by D10, D7, D3, D6; the other ten by
D16), the r2 questions OQ1-OQ5 by D25-D29, and the cost-claim questions CQ1-CQ4 by D32 (per-assignment requirement with
default optional; 7-year retention; one approver with a configurable high-amount flag; VAT included / excluded chosen by the
vendor per claim).

**Still open - build-time verifications, not owner questions** (none blocks slice 1):
1. `ha-whatsapp` on the owner's installed version: the connectivity sensor and its attributes, `account` = entry id, `entry_id`
   on inbound events, the REST shape of an unknown-account error (9.9.5) - slices 5a / 5b live checks, **each owner-approved**.
2. What the integration's "last message" sensor puts in the general entity mirror today (risk 6) - read-only look in 5a.
3. `return_response` shape of `send_message` over REST (9.3) - slice 5b's approved test send.
4. Reachability of container port 18093 through `cloudflared` on the add-on network (10.1) - slice 4 with the owner.
5. uvicorn 0.53 signal capture off the main thread (10.1) - a test in slice 4.
6. Migration numbers 0079-0084 against the branches open at implementation start.
7. Native-speaker review of the Arabic and Russian page strings and starter templates (D26) - slice 8.

## 23. Sources

- `ha-whatsapp` documentation, read 2026-10-13: `https://faserf.github.io/ha-whatsapp/` (overview), `services.html`
  (`send_message` fields `account`, `target`, `message`, optional `quote`/`reply_to`/`expiration`; `response_variable` returns
  `success`, `message_id`; `send_buttons` with `buttons[{id, displayText}]`, `footer`, the warning about multi-device clients),
  `events.html` (`whatsapp_message_received`: type, sender, sender_number, sender_name, content, selected_id, vote, media_url,
  timestamp - no message id, no account; `whatsapp_button_pressed`: sender, sender_number, sender_name, button_id,
  button_text, message_id, timestamp; `whatsapp_message_sent` with `id`, `content`, `recipient_number`, `entry_id`,
  `session_id`), `configuration.html` (several accounts, one config entry and `session_id` each; entities "WhatsApp
  Connected", "Messages Sent", "Last Message", "Chats"; repair issue on session expiry; "Mask Sensitive Data" option),
  `features.html` (multiple accounts, connection sensors, reconnect / diagnostic buttons), `webhooks.html` (incoming messages
  only, `X-Webhook-Token`; no receipts documented), `limitations.html` (Baileys, ban risk, 14-day phone rule, "one instance ...
  one phone number", media URL reachability, buttons/polls caveats). `[WA-DOC]`
- `ha-whatsapp` integration source, `github.com/FaserF/ha-whatsapp`, branch `main`, read 2026-10-13 (no commit pinned):
  `custom_components/whatsapp/__init__.py` (`get_client_for_account`: entry id → unique id → title; events fired with
  `entry_id` and `session_id`), `config_flow.py` (unique id = the account's number, else session id / discovery id; title
  `WhatsApp (<number>)`), `binary_sensor.py` (connectivity sensor `<entry_id>_connection`, attributes `phone_number`,
  `connection_state`). `[WA-SRC]`
- The independent review `private/planning/TICKETS_SPEC_REVIEW_2026-10-13.md` (main checkout, gitignored folder; not copied
  into the repository).
- Repository files as cited in sections 4-19 (`origin/main` @ `b26c1b7d`; `origin/integ/249`; `origin/pilot/WXPERM`).
