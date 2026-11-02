# CALMSG-POLISH-2331: calendars and messaging settings, polish wave 1

Branch `pilot/CALMSG-POLISH-2331`, cut from `origin/main` (`52a8d9129`). Refinement only (impeccable `polish` + emil-design-eng): the
incumbent visual language of the polished settings screens (R5-SYSTEM-297, HOMEFABLE-297, POLISH-CONTROL-297) is kept; no shared
token, component, shell or navigation file was edited. Tokens only (no px font sizes, no radius literals, no hex). Every option,
setting and piece of data stays; nothing was removed.

Scope: Settings › יומנים (`screens/system-calendars.ts`), Settings › חיבורי יומן (`screens/system-calendar-sync.ts`), Settings › ערוץ
ההודעות (`screens/system-messaging-accounts.ts`), and a critique of the calendars page views (`calendars/*`).

## 1. Critique (before)

Captured from the real build (vite preview, port 4204) against the calendars demo data and the messaging mock layer (invented data) at
desktop 1440x900 and 1920x1080, tablet 1180x820 and 1024x768, phone 390x844; light, and dark at 1440 / 390. Screenshots:
`docs/evidence/CALMSG-POLISH-2331/before/` and `after/` (calendars page views kept at 1440 only), page overflow per screen and size in
`before/overflow.tsv` / `after/overflow.tsv`.

### Settings › יומנים

| # | Severity | Finding |
|---|---|---|
| C1 | P1 defect | "אישור לכל יומן" (table): the panel's rows-per-page measure counted the table header as room for rows, so the last body row was drawn half cut off under the panel edge (1440x900: the 11th calendar). |
| C2 | P2 | "התנהגות": 22 settings in one unordered list (menu placement next to guest purge next to resident rules) - 2 pages on a desktop, 8 on a phone, no way to go to a topic. |
| C3 | P2 | Table selects (`appearance: none`) had no arrow: "ללא אישור", "2 שע׳ לפני" read as static pills, not as choices. |
| C4 | P2 | No focus ring on the radio cards (overlap), the steppers, the reset link and the permission link rows; no hover on any of them (keyboard users lost their place). |
| C5 | P3 | The page title used a fixed `--sw-fs-2xl` and had no "הגדרות" crumb, unlike every `sw-page` settings screen and the calendars page (`--sw-h1` skin scale). |
| C6 | P3 | Phone, behaviour tab: the tallest row (a two-line hint) sets the row height of the page, leaving a row's worth of empty panel. Kept (see 4). |

### Settings › חיבורי יומן

| # | Severity | Finding |
|---|---|---|
| S1 | P2 | Flags: the time range of the "when" line rendered reversed in the RTL line ("11:30–10:00" for 10:00–11:30); the title's range was right only by luck of its neighbours. |
| S2 | P2 | The three provider cards ended at different heights with the actions at different heights, and "לפני 3 דק׳" wandered (beside "השהיה" on one card, alone on a line on the next). |
| S3 | P2 | The four sync rules floated under the flags with no heading; a viewer without "יומנים: הגדרות" saw disabled switches with no reason. |
| S4 | P2 | Phone: each flag's title was cut to two or three words beside the two decision buttons. |
| S5 | P3 | The title sat inside the panel, while Settings › יומנים puts it above; no crumb (as C5). |

### Settings › ערוץ ההודעות

| # | Severity | Finding |
|---|---|---|
| M1 | P2 | Department rows (אחזקה / ניקיון / משאבי אנוש) looked exactly like the use row they belong to - the nesting was invisible; the "מחלקות (3)" toggle had no open / closed cue. |
| M2 | P2 | No focus ring on the text inputs and the link buttons; no hover on the account rows; an invalid pacing field was marked only by the text under it. |
| M3 | P3 | Token drift: a `999px` pill radius on the tags and a literal `0.6` disabled opacity. |
| M4 | P3 | Selecting an account on a one-column layout scrolled smoothly even with reduced motion requested. |
| M5 | open | The page scrolls (before -> after: 662 -> 637 px at 1440x900; the rest within a few px): 662 px at 1440x900, 482 at 1920x1080, 1020 at 1180x820, 948 at 1024x768, 2771 at 390. It is a draft form with a sticky save bar (the shared settings pattern), not a control screen; fitting it means splitting it into sub-tabs. Owner decision, not changed here (see 4). |

### Calendars page views (`calendars/*`)

Week, month, rooms timeline, approvals, management and maintenance were built from the approved round-8 mock-up (CALENDARS-UI-2310) and
already carry that pass: no page scroll at any size (overflow 0 everywhere), paging instead of scroll, states, focus on the shared
`.btn` / `.chipb`. Findings recorded, no edits in this wave:

- Rooms timeline: the "now" pill (10:40) covers the 11:00 hour label.
- The time axes (rooms timeline, the approvals decision strip) run left to right in an RTL page; consistent across the module and as in
  the mock-up - an owner question if it should be reconsidered, not a defect.
- Management at 1024x768: 7 rows a page with room for an eighth (the same tallest-row measure as C6).

## 2. Changes

| Screen | Change |
|---|---|
| Settings › יומנים | C1: the table's header height is taken off the room before rows are counted (no cut row). C2: every behaviour row has a topic (תצוגה, בקשות ואישורים, הזמנות, דיירים, סנכרון ופרטיות); a topic filter above the rows ("הכל" by default, so every row and every existing test path stays as before; a count on a topic shows how many of its settings differ from the default); on the phone the filter is a select. The rows are ordered by topic, the placement first. C3: a chevron at the end of every table select. C4: focus ring, hover wash and press scale (0.97, reduced motion: none) on the radio cards, steppers, reset, the permission rows (their "חברים ותפקידים" chip fills on hover) and table rows. C5: "הגדרות" crumb above the title; the title uses the skin's h1 tokens. |
| Settings › חיבורי יומן | S1: the time range is one isolated LTR run in the flag title and the "when" line. S2: the card's actions sit on the card's floor; the last sync time ("לפני 3 דק׳", titled "הסנכרון האחרון") moves under the state chip on every card. S3: "כללי הסנכרון" heading over the rules, with "צפייה בלבד" and the needed right when the viewer cannot change them. S4: on the phone the two decisions go under the entry, the title gets the full width. S5: the title row (crumb, h1, the no-password note, "חיבור חדש") moves above the panel like Settings › יומנים. |
| Settings › ערוץ ההודעות | M1: department rows are indented one step and lighter, with a smaller label; the "מחלקות (n)" toggle has a chevron that turns when open. M2: focus ring on inputs and link buttons, a hover wash on account rows, a danger border on an invalid field. M3: `--sw-r-pill`, `--sw-disabled-opacity`. M4: the scroll into view honours reduced motion. |

## 3. Tests

Run locally (workstation, vite preview build of this branch on port 4204):

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| unit specs: unit-token-lint, unit-lead-reserve, unit-uxfix-rtl, unit-calendars-ui-2310, unit-calendars-connect-2330, unit-messaging-accounts, unit-calendars-switch-reach (desktop) | 57 passed |
| `evidence-calmsg-polish-2331` (desktop project at 1440/1920/1180/1024, mobile at 390) | 32 passed (after); calendars settings and sync: page overflow 0 at every size, sideways 0 everywhere (`after/overflow.tsv`) |
| `evidence-calendars-settings-2310`, `evidence-calendars-connect-2330`, `evidence-messaging-accounts`, `layout-messaging-accounts`, `evidence-breakui-messaging` (desktop, tablet, mobile) | 137 passed, 35 skipped (by design per project), 5 failed - all five a 60 s test timeout in `page.goto` / `waitForTimeout` while the workstation was saturated (16 agents, out of memory): evidence-messaging-accounts "the screen" and "departments" (desktop + mobile), evidence-calendars-settings-2310 "worst-case data" (tablet). A serial rerun with a longer timeout was stopped on the coordinator's order (memory): NOT_RUN, to run on the runner gate. |
| impeccable detector on the three screens | no findings |

The screenshots written by `evidence-messaging-accounts` into `docs/design/evidence/tickets-s5a/` were reverted (not part of this
change). New evidence spec:
`frontend/tests/evidence-calmsg-polish-2331.spec.ts` (captures before / after at the five sizes, records page and sideways overflow,
asserts no page scroll on the calendars settings screens and no sideways overflow anywhere):

    SW_BASE_URL=http://127.0.0.1:4204/ CALMSG_PHASE=after npx playwright test tests/evidence-calmsg-polish-2331.spec.ts --project=desktop --project=mobile --workers=2

## 4. Not done / open

- M5: the messaging settings page scrolls (a form with a save bar). Fitting it into one screen = splitting it into sub-tabs
  ("חשבונות ושימושים" / "החשבון הנבחר" / "קצב ומדיניות"): owner decision.
- C6 / management 1024: the rows-per-page measure takes the tallest row for every row. A cumulative measure would fit one more row on
  some pages; it touches the paging logic shared by the settings tabs (and the tests that page through it), left for a later wave.
- Shell observations outside this scope (for the shell / settings-navigation owners, not changed here): the settings navigation
  repeats the calendars tabs as a sub-list under "יומנים" (a second, parallel tab strip); the infrastructure group shows an entry
  named after the home platform's product, against the no-platform-branding rule.

## 5. Pixel baselines likely affected

No committed `toHaveScreenshot` baseline covers `#/system/calendars`, `#/system/calendar-sync` or `#/system/messaging-accounts`
(searched `frontend/tests/*.spec.ts`: the only pixel specs naming messaging are the WisKey ones, `pixel-wiskey-messaging` /
`pixel-wiskey-people`, which render other screens). Expected to differ: the lead's private evidence screenshots of
`evidence-calendars-settings-2310` (`settings-*`, sync) and `evidence-messaging-accounts` (`docs/design/evidence/tickets-s5a/`, the
department rows). If the runner's visual matrix walks every settings route, those three routes change (title row, behaviour filter, table
chevrons, card layout, department rows); the calendars page views are not touched.
