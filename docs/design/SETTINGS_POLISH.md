# SET-polish - the settings, schedules and automations screens (design record) - 2026-10-10

Branch `pilot/SET-polish`, from `pilot/DU1-design-unification` (c151ae20, the unified token layer). Owner direction: raise
the settings screens (every tab), the schedule grid / editor and the automation list / builder to a high design level -
hierarchy, navigation inside the settings, forms, density, list and card views, states, keyboard focus, RTL, every width,
light and dark, every skin - with management in the settings only, operator screens clean, no behaviour or API change.
This record is the Design ADR of the intentional visual changes (DESIGN_CONTRACT).

Invariants kept: `--sw-*` tokens only (the DU1 drift guard passes), the skins inside their 50-rule budget, the shell's tab
row and `ui.tabs` untouched, every `data-*` hook the specs read kept, no setting, route or endpoint added or changed.

## 1. What the screens looked like (evidence `docs/design/evidence/settings-polish/before/`)

- Seventeen top-level settings tabs in one pill row, twelve more sub-tabs on "כללי", and nothing that groups them or finds
  them: a person looking for "גיבוי" or "WebRTC" had to know which of the 29 places it lives in.
- The content sat in a 760 px column at the start side of a 1440 px page (`before/settings-general-classic-light-1440.png`).
- Every `system-*` screen carried its own copy of the label / control row, the hint, the "saved" / error line and the save
  footer - 9 vs 10 px rows, 220 vs 280 px controls, a sticky bar on the schedules page and an inline "שמור" on the next, a
  green sentence for "saved" here and a `color:` inline style there.
- The page title said "הגדרות המערכת · אזור זמן, מדיניות אחסון..." on every sub-tab.
- Deleting a backup used `window.confirm`.
- The schedules list's "today" strip wrapped into five rows above the first card on a phone.

## 2. Decisions

### 2.1 A settings index and a navigation column (`screens/system-index.ts`, `screens/system-nav.ts`)

Every destination under הגדרות, grouped the way people look for things - **מראה ותצוגה · משתמשים ואבטחה · התראות ואוטומציה ·
מדיה · מערכת ותשתית** - each with its deep link and the words one types to find it (Hebrew and the technical names a settings
screen keeps). The column sits at the start side of every settings page on a wide screen: a search field, the groups, the
sub-pages folded except under the current screen, the current one marked (`aria-current`). Under 1024 px (tablet, phone) the
column becomes the search row above the page (up to 1100 px, the reference tablet width included). Typing filters the index (every word must match the label, the keywords or
the parent), ArrowUp / ArrowDown walk the results, Enter opens, Escape clears; the results are plain anchors to the same
hash routes the tab row uses. Visibility follows the tab row's own rule (`visibleTabs(AREA_TABS.system, ...)`): a top-level
entry is offered only while its tab is, its sub-entries with it, and the security sub-pages follow the security tabs. The
wizard (a guided flow) and, on a wide screen, the notifications page (it draws a section navigation of its own) get no column.

Deep links the screens now honour both ways: הגדרות › כללי writes `?tab=` when a sub-tab is picked and follows it while
mounted; משתמשים והרשאות the same with its `?tab=`; מולטימדיה follows `?tab=` while mounted (it already wrote it).

### 2.2 One stylesheet for the settings forms (`styles/settings.ts`)

`settingsStyles` is what every settings screen adopts instead of its own copy: `.sections` (880 px), `.grouplabel`, `.row`
(label + hint at the start, the control at the end, stacked on a phone), `.check` / `.val` fact rows with tones, `.hint`,
`.msg` (an inline status pill with an icon: ok / err / warn, `role=status` / `alert`), `.foot` (a card's footer with a rule
above it), `.savebar` (the sticky bar: unsaved / saved / error, the actions at the end), `.danger`, `.actions`, `.two`, `.seg`,
and the invalid state of a control (`[aria-invalid]` and `:user-invalid`: a red ring, no JavaScript). Adopted by diagnostics,
tabs, schedules, automations, connections, access, security and multimedia; the class names are the ones the screens and the
specs already used, so nothing was renamed.

### 2.3 Headers

Settings pages carry the "הגדרות" crumb (the sub-pages of אבטחה "הגדרות › אבטחה"); הגדרות › כללי is titled by its sub-tab
("גיבוי ושחזור") with one line about it, instead of the same sentence on every tab. The cameras page keeps the heading
"הגדרות מצלמות" the multi-NVR spec asserts.

### 2.4 Confirmations

The backup delete asks in the product's dialog (name, date, size, what the deletion means) with a danger button; the
restore dialog and the typed-word confirmations were already so.

### 2.5 Skins

One or two rules each, inside the budget: Domus (rule 10) pill links with the current one lifted like a tab; Tesla (rule 11)
a rule at the column's edge and an accent bar instead of a fill; Bubble pill links at 36 px.

### 2.6 The 2.4.4 cards and the switch colour that follows the accent

Rebased onto 2.4.4 (origin/main 3e804087): צבעי המותג, סוגי ההתקנים, צבעוניות הזכוכית and the self-update switch are in the
settings now. צבעי המותג adopts the shared stylesheet, and its switch row gets a third kind of value (owner 2026-10-11):
**"כמו צבע ההדגשה"** - `ui.toggle_on = "accent"`, admitted for the switch only (backend `brand_colors.normalize(value, key)`,
422 for `ui.accent`), written as `--sw-toggle-on: var(--sw-accent)` so it follows the skin's accent or the one chosen above,
now and whenever it changes; Hebrew and English strings, backend and frontend tests. The index lists סוגי ההתקנים under חשמל
והתקנים (`?tab=devices&section=device-types`, the card's own scroll anchor).

### 2.7 Operator screens

The schedules and automations screens (glass language, CR-014 / CR-017) were already at the level asked for; the one
change is the schedules "today" strip, which is one scrolling line on a phone. The schedule editor, the week / table views,
the automation builder and the drawers are unchanged (their states, empty boxes and banners already exist). The notifications
settings page (its own glass design with a section navigation) is unchanged beyond the phone search row.

## 3. Evidence

`docs/design/evidence/settings-polish/before/` and `.../after/`: `<screen>-<skin>-<scheme>-<width>.png` for the general,
tabs, media, devices, remote, health, backup, notifications, access, security, audit, storage, update, connections,
schedules, automations, multimedia, infrastructure and wall settings, the schedules list (cards, table, week), the schedule
editor, the automations list, the scenes and the automation builder - classic light at 1440 and 390, classic dark and Domus
light at 1440; after only: Domus dark, Tesla light / dark, Bubble light (1440) and dark (390), classic at 1024 on six key
screens. Demo mode, fixed clock, `?design=a&look=performance:full`. Script: `frontend/scripts/settings-shots.mjs`.

The win32 pixel baselines of `tests/evidence-design-foundation.spec.ts` for the settings screen (1440 and 390) were
regenerated on the workstation (the navigation column is on them); the linux baselines were not (the runner's `linux-pixel`
job regenerates them there - the pixel check skips when no baseline of the platform exists).

## 4. Not done / next

- The remaining settings screens with their own form CSS (update, storage, audit, wall, entities, the electricity sections,
  notifications) keep it; adopting `settingsStyles` there is the same mechanical step, one screen at a time.
- A `?card=` anchor into a card of a long sub-tab (the index links to the tab, not the card).
- The notifications page's own section navigation and the settings column are two navigations on one page on a wide screen;
  the column yields to it today. Folding its sections into the index is the day the page adopts the shared language.
