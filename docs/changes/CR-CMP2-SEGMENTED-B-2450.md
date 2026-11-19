# CR-CMP2-SEGMENTED-B-2450

2.45.0 row, continuation of `CR-CMP2-SELECTS-2450` (base of this branch: `origin/pilot/CR-CMP2-SELECTS-2450` at 18911c376, not
the train). Owner answers of 19.11: N10 (selects and forms to the shared components, screen by screen), N11 (`sw-segmented`), N12
(row switches and the home `.hsw` stay), N13 (smaller toggles are fine). Not touched: tables (`CR-CMP2-TABLES-2450`), `shell/sw-app.ts`,
`router.ts`, `management/tasks.json`. One commit per area / form, so the train can drop a part.

## 1. The component (`components/sw-segmented.ts`)

- `radio`: a group a screen named a radio group keeps its semantics (`radiogroup` / `radio` + `aria-checked`); each key keeps
  `aria-pressed` beside it, exactly as the hand-built groups did (their specs read either attribute; the look reads `aria-pressed`).
- New knobs, so a host keeps its key through the shadow root: `--sw-seg-fg`, `--sw-seg-fs`, `--sw-seg-fw`, `--sw-seg-on-fw`,
  `--sw-seg-key-min-w`, `--sw-seg-count-bg` / `--sw-seg-count-on-bg`. A host shapes the key itself with `::part(key)` when it must
  (the tickets display tab lets the key text wrap on a phone).
- Glass hosts (owner question pending, recommended option taken): `styles/media-glass.ts` draws `sw-segmented` as its glass `.seg`
  (track `--dv-surface-3`, thumb `--mm-seg-thumb` / `--mm-seg-fg-on`, 32 / 30 px keys, 44 px under touch, the bubble targets) through
  the knobs. `styles/settings.ts` hands the knobs back (`unset` = inherit) where a host takes the settings sheet after the glass one -
  the same cascade the hand-built `.seg` rules had, so the TKUI6 knobs a page sets on `:host` (system-tickets) still reach the key.
- `styles/bubble-chrome.ts`: the bubble skin's pill track / pill keys / solid thumb reach `sw-segmented` the same way (same selector
  weight as its `.seg` rules, so a screen's own bubble rule still wins where it did).
- Module sheets keep their module's key through the knobs instead of a hand-built `.seg` copy: `calendars/styles.ts`,
  `electricity/styles.ts` (also water and generator), `temperature/styles.ts`, `notices/styles.ts`, `maintenance/styles.ts`, the
  presence pages. Settings pages take the ONE settings key (POLISH4-WP1, owner Q3a): system-mapping, system-home-screen,
  system-palette-editor, system-timeline-colors (small key), system-multimedia (its accent-filled divided keys are gone),
  system-update (keeps its 44 px key).
- Behaviour kept: a press reports the choice (`change`, `{ value }`) and the screen confirms by re-rendering `value`; guards such as
  "only when it differs" stay in the screens' handlers. Non-string values (numbers, booleans, `null` defaults) map through `String()`
  and back through the screen's own list. Every `data-*` hook stays on its key (`attrs`) or on the group (`sw-segmented` itself).
  Three groups that were named by `aria-labelledby` carry the same words as `label` (a shadow root cannot point at a light-DOM id).

## 2. Segmented groups moved (129 of the 247 hand-built groups)

One commit per area: system-tickets (5), calendars (17, incl. system-calendars / system-calendar-sync), tickets module (29), electricity
and water (25), the remaining settings pages (17: update, mapping, home-screen, multimedia, schedules, quiet windows, app sign-in,
palette editor, timeline colours, presence, building presence), generator (8), temperature (9), notices (9), maintenance (5 + the
task form's kind switch), system-notices (4). (The 248 of the previous note counted the component's own `class="seg"` too.) `tests/unit-sw-segmented.spec.ts` guards the 72 converted files (no hand-built group may
come back) besides the 5 of CR-CMP2-SELECTS-2450.

Found on the way and fixed: `elec-formula-editor` - the wizard listens to the editor host's own `change`; the mode key's composed
`change` would have reached it. The key's event stops inside the editor. A scan of every host of a converted control for a parent
`@change` listener found no other case.

`styles/settings.ts` `settingsPillSegKeyStyles` is gone (its two users, the presence pages, moved). DARK-SEG-ALL inventory
(`unit-dark-polish-beds`): the seven rules that went are dropped.

## 3. Mixed forms into sw-field (owner N10, one form per commit)

| Form | Fields | Note |
|---|---|---|
| `maintenance/task-form.ts` | 17 | inputs, date, number, textareas and selects; ids / `label for` / `aria-invalid` / `data-maint-field` stay on the controls |
| `screens/system-notices.ts` | 30 | settings, board creation, board detail; the short fields keep 90 px on `sw-field.short`; the `data-v` select hook is unchanged |
| `screens/system-local-users.ts` | 15 | the fields sit in sw-field inside their labels (the label still names its control); checkboxes keep their own look |
| `screens/system-intercom-ops.ts` | 9 | toolbar filter selects stay native inside sw-field, with the search field (one toolbar look) |

Each form's own input / select skin is gone (an outer rule would beat `::slotted`), so a form has one look.

## 4. Left (118 hand-built groups in 67 files), recorded rather than guessed

- Tab strips (`role="tablist"`, keep `sw-tabs`-like semantics): system-calendar-sync providers, elec-account-page, devices-automations /
  devices-schedules kinds - not segmented controls.
- Rich keys (icons inside the key, two-line keys, roving tabindex): tickets list view switch, RFQ sort / channel, assignee kinds,
  tickets-handlers tabs, devices view switches, access-external request dialog, system-nav-size "current" badge - need an icon / content
  slot on the component first (recommendation from the previous row stands).
- Chip rows that only reuse the class name (`.seg` = bordered chips with gaps, accent fill): door-windows rules / holidays / open-for,
  wiskey-access-diag - they are chips, not a track; moving them would change the control, not only its code.
- Inside a table cell: the RFQ compare scope cell (`CR-CMP2-TABLES-2450`'s area).
- Inside a label with per-key reasons: temperature WhatsApp vendor channels.
- Not reached in this row (time): home-edit-panel (10), sw-home-personal (8), system-notifications (7, glass), the glass list screens
  (tickets board / list / overview / RFQs state strips, devices schedules / automations filters), multimedia screens / editor /
  players / media remote / player panel (glass), notify-center / notify-whatsapp-section, investigate, schedule editor family,
  scenarios, home widgets, and single groups in about 25 more files. The glass mapping above is in place for them.

## Baselines refreshed (runner, linux)

Runner pass at b210d5365 in `~/work/cmp2seg` (nice -n 19, `--workers=1`, after `gate_status.json` showed the 2.43.9 re-gate done; the
2.44.0 gate started right after, so no further runner work). Pixel files that open a converted screen, without `-u` first:
`pixel-sw-segmented`, `pixel-notice-tv-portrait-chips`, `pixel-audit30a-glass-bridge`, `pixel-round4-leftovers-2390`,
`pixel-home-fb-2431`, `pixel-access-s12`, `pixel-settings-intercom-cards-2401`, `visual-matrix`: 175 passed, 125 skipped, 3 failed.

- REFRESHED (looked at: the calendar-type filter is now sw-segmented with count pills, the module's pill key):
  `frontend/tests/pixel-round4-leftovers-2390.spec.ts-snapshots/cal-manage-classic-light-1024-desktop-linux.png`,
  `frontend/tests/pixel-round4-leftovers-2390.spec.ts-snapshots/cal-manage-domus-light-1024-desktop-linux.png`.
- `visual-matrix` `devices-home ready light` (tablet) failed once and was byte-identical after `-u`: a flake, not taken. The `-u` pass
  rewrote every shot of the two files (`--update-snapshots=all`); only the two failing calendar images were taken into the branch.
- After the update, the two files verified without `-u`: 98 passed, 16 skipped, 0 failed.
- The workfolder was removed afterwards (`git worktree remove`, the node_modules link, the output folder).

## Tests actually run

Workstation (Windows):

- `npx tsc --noEmit -p tsconfig.json`: exit 0 after every area (last at the head of the code commits). `npx tsc --noEmit -p
  tsconfig.tests.json`: exit 0.
- ESLint on every touched file: 0 errors, 0 warnings. `node scripts/unused-exports.mjs --enforce`: OK (no export outside the baseline).
- Unit (`playwright.unit.config.ts`): every unit spec that reads a touched file (+ token lint, dark-polish beds, a11y lint,
  sw-segmented), 93 spec files: 852 passed, 2 failed - two source contracts that read the old save path
  (`unit-settings-rows-2380`, `unit-tickets-1440-column-setting-2360`), updated in b210d5365 and re-run: 20 passed. The adoption
  guard after its extension: 9 passed. (An earlier pass after the first areas: 200 passed, 0 failed.)
- Browser specs against a Vite dev server on the PC (`--workers=1`, desktop project):
  - pass A (calendars, electricity, water, sys-audit quickfix, DARK-SEG-ALL, 16 files, 205 tests): 197 started, 2 failed with
    `Execution context was destroyed` (the dev server reloaded while I edited other files - no assertion failed), then stopped by me
    to keep editing; the last 8 (`layout-electricity` skins after domus) NOT_RUN. `layout-electricity-meters` re-ran in pass B.
  - pass B (no edits during the run; tickets ui6 / s2 / audit30c / costs / handlers / rfq2 / overview-p3, generator, genalert,
    home-screen, intercom-ops, local-user-create, maintenance, mapping-assist, notices, notice page, palettes, presence settings,
    system-multimedia, system-update-apply, temperature, timeline colours, calendars settings, electricity wizard,
    `layout-electricity-meters`; 25 files): 301 passed, 39 skipped, 0 failed.
- Screens looked at in the evidence output: tickets settings display tab (dark, the Blue Wash key), electricity wizard (formula
  mode key), generator charts, temperature detail; the two refreshed calendar baselines.

## NOT_RUN

- `layout-electricity` for the skins after domus (tesla, crystal, infra, soft, bubble) - pass A was stopped; classic was interrupted
  by a dev-server reload. Mobile / tablet projects of the evidence specs. Specs of the system-notices / local-users / intercom-ops
  forms beyond those named above.
- Runner evidence / layout specs on a preview build (the 2.44.0 gate started); the entry check (`branch_check.sh`) - not queued.
- No lab / device test (UI only).

## Open questions (recommendation taken, for the owner's page)

1. Glass screens (notifications, multimedia, schedules, tickets glass pages): keep each screen's glass key on `sw-segmented` through
   the knobs, or let them take the settings key? Recommendation (taken): keep the glass look through the knobs.
2. Module keys (calendars, electricity / water / generator, temperature, notices, maintenance, presence): this row kept each module's
   key through the knobs. Unify them to the one settings key later? Recommendation: yes, in one later row (delete the knob blocks),
   after the owner sees them side by side.
3. Radio groups keep `aria-pressed` beside `aria-checked` (as before). Drop it after a spec sweep? Recommendation: yes, a small row.
4. Chip rows named `.seg` (door-windows, wiskey diagnostics): leave them as chips, or move them to a shared chip-choice component?
   Recommendation: a shared chip-choice row, not sw-segmented.
5. Tab strips drawn as segments (calendar sync providers, the electricity account page, the devices kinds): move to `sw-tabs` (pill
   variant)? Recommendation: yes, separately.
