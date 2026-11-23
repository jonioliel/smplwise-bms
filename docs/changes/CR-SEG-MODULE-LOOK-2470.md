# CR-SEG-MODULE-LOOK-2470

2.47.0 row. Branch `pilot/CR-SEG-MODULE-LOOK-2470`, base `origin/release/2450-train` (b643e8e7a). Owner decision 20.11 (~00:45):
the unified `sw-segmented` settings key of 2.45.0 (34 px, semibold 600, slight radius, blue chosen key in light) is not his style.
He keeps the module looks and wants the MODULE LOOK EVERYWHERE, the settings pages 2.45.0 moved to the settings key and presence
included, and a comparison first. Not touched: home v3 operator screen (`home/`), tables, `shell/sw-app.ts`, `management/tasks.json`.

## 1. The module look (derived)

Measured on the seven modules (the computed key of each, from the N41 comparison tool `private/planning/module_looks_2026-11-20/`):

| module | key desktop | key phone | font | weight off / on | radius | track | border | chosen ink (light) |
|---|---|---|---|---|---|---|---|---|
| calendars | 30 | 44 | 13 | 400 / 600 | pill | surface-3 | none | heading |
| electricity / water / generator (one sheet) | 34 | 44 | 13 | 400 / 600 | pill | surface-3 | none | text |
| temperature | 28 | 28 | 13 | 400 / 600 | pill | surface-2 | none | text |
| notices | 28 | 28 | 13 | 400 / 500 | 16-18 | surface-2 | yes | text |
| maintenance | 28 | 38 | 13 | 400 / 600 | 8-10 | lighter | none | text |
| **module look** | **28** | **44** | **13** | **400 / 600** | **pill** | **surface-3** | **none** | **text (solid surface)** |

Majority per knob. Desktop key height is a tie by module count (3 x 34, 3 x 28, 1 x 30): 28 taken (3 of the 5 separate module
sheets; the ~36 px track lines up with the settings rows' fields; the owner named 34 px as part of what he rejected) - open question 1.
Dark: the chosen key stays the light pill (`--sw-seg-key` / `--sw-seg-key-ink`), as in every module.

## 2. The component (`components/sw-segmented.ts`)

New defaults: radius / key radius `--sw-r-pill`; key 28 px, 12 px sides; `--sw-fs-sm`; weight regular, chosen semibold (a host that
sets only `--sw-seg-fw` keeps that weight on the chosen key, as before); chosen key `var(--sw-seg-key, var(--sw-surface-solid))` in
`var(--sw-seg-key-ink, var(--sw-text))`; on a phone (max-width 767 px, coarse pointer) the default key is 44 px tall (a host that
sets `--sw-seg-h` keeps its height; the 44 px target grows around it). `size="sm"` geometry unchanged (28 px, 10 px sides).

## 3. Who changes, who stays

- Own-look hosts that relied on an old default pin it (one commented block each), so they draw as before: access request dialog,
  camera source dialog, frigate admin panels, cast picker, incidents settings, insights, area quick sheet, explore presence (map /
  list switch), investigate reviews, plan studio material head, schedule conditions / entity picker, system-tickets (TKUI6 host),
  WisKey events / people, the personal home panel (`shell/sw-home-personal.ts`, one `--sw-seg-on-bg` line), temperature (its chosen
  key kept its translucent surface). Modules whose sheet already sets every changed knob need no change: calendars, electricity /
  water / generator, notices, maintenance; glass hosts (`styles/media-glass.ts`) set them all too.
- Take the module look: every settings page on the old default (design, brand logos, home screen, plan view (keeps 44 px), timeline
  colours (sm), mapping, multimedia, update (keeps 44 px), schedules, automations, quiet windows, list display settings, ...),
  presence + building presence (their bordered-track knobs removed), nav size and the home-screen options (their 36 / 32 px medium
  keys removed - settings pages, open question 2), and every other screen that drew the plain default (e.g. tickets list
  view switch, nav-size presets, home edit panel - not edited, it inherits the default).
- Bubble skin (frozen, not selectable): not pinned; where it relied on the defaults it takes the module key text.

## 4. Owner comparison page (local, not published)

`private/planning/settings_seg_look_2026-11-20.html` (+ `settings_seg_look_2026-11-20/`, tools in its `tools/`): per settings page
+ presence, "today (2.45.0)" vs "module look" (+ "before 2.45.0" where it differed - see NOT_RUN), desktop 1440 / phone 390, light /
dark, classic / domus; radios "module look / keep today" (module look preselected) and a copy-answers button. Captured on the PC
from Vite dev servers: the 2.45.0 train worktree (today) and this branch (module look), demo fixtures.

## Tests actually run (workstation, Windows)

- `npx tsc --noEmit -p tsconfig.json`: exit 0 (after the component, pins and presence changes).
- ESLint on the 22 touched source files: 0 errors (the test files are ignored by the config).
- Unit (`playwright.unit.config.ts`), every unit spec that reads a touched file (78 files): 768 passed, 1 failed (the touch-rule
  regex of `unit-sw-segmented`, updated for the new phone rule) -> `unit-sw-segmented` re-run: 16 passed, 0 failed.
- Crawl of 389 demo routes on the 2.45.0 train (desktop, classic light) to list every visible sw-segmented host: done (inventory
  only; the branch-vs-train diff of the crawl was NOT_RUN, see below).

## NOT_RUN

- Browser / evidence specs of the touched screens on a dev server: NOT_RUN (usage limit; stopped by the lead).
- The crawl diff train vs branch (`zz-seglook-crawl`, local only) that would prove each own-look host unchanged: NOT_RUN.
- "Before 2.45.0" captures (2.44.0 dev server): NOT_RUN - the page shows today vs module look only.
- Runner: `~/work/seglook-run1.sh 4e42dfe15` was queued (no gate running at queue time): preview build, every spec file with a Linux
  baseline (52) without `-u`, then `--update-snapshots=changed` on the failing files and a verify pass; results in
  `~/work/seglook-out1/summary.txt` + `snaps.tgz`. NOT reviewed and NO baselines taken into the branch yet. Expected to move:
  `pixel-sw-segmented` (6, the specimen), the settings / presence shots in `visual-matrix` and the evidence files that open a
  settings page; expected NOT to move: every module file (`audit30-f-calendars`, electricity / maintenance / notices shots).
  Next agent: look at each changed image, take only the intended ones, list them here.
- Entry check (`branch_check.sh`): not queued.

## Open questions (recommendation taken)

1. Desktop key height of the module look: 28 (taken) or 34 (electricity / water / generator)? Recommendation: 28.
2. Nav size and home-screen options lost their own 36 / 32 px medium keys (settings pages, module look). Keep? Recommendation: yes.
3. Own-look screens outside the modules (dialogs, WisKey, investigate, frigate, glass pages) keep their keys. Move them to the
   module look too? Recommendation: not now - after the owner answers the page, one row per family.
4. Phone: default key 44 px tall (the majority of the modules). Recommendation: keep.
