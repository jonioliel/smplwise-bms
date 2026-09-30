# entrant-claude — comparison round 1, three skins on one structure

Deliverable for `docs/design/handoff/COMPARISON_TASK_HE.md`, extended after owner feedback (round 1a): the Domus
direction departs from today's card grid (DomusUI-style room screen and building view), every screen has a **list
mode** next to its card mode, and the whole shell is delivered as **three switchable skins** with an identical
structure (`SKINS_HE.md`).

| Skin | Boards | Renders | Tokens | Contrast report |
|---|---|---|---|---|
| 1 · hi-tech Domus (`skins/domus.mjs`) | `boards/` | `renders/` | `tokens.json`, `tokens.css`, `tokens-light.css`, `tokens-dark.css` | `contrast-report-domus.json` |
| 2 · iOS / Apple (`skins/ios.mjs`) | `boards/ios/` | `renders/ios/` | `tokens-ios.json`, `tokens-ios.css`, `tokens-ios-light.css`, `tokens-ios-dark.css` | `contrast-report-ios.json` |
| 3 · Tesla clean hi-tech (`skins/tesla.mjs`) | `boards/tesla/` | `renders/tesla/` | `tokens-tesla.json`, `tokens-tesla.css`, `tokens-tesla-light.css`, `tokens-tesla-dark.css` | `contrast-report-tesla.json` |

Per skin, 42 boards (Domus 43): 4 foundations + component sheet + home / area / wall × cards and list × 1440×900 and
390×full height × light and dark (24) + the area states board + **`home-kpi-1440-{light,dark}`** (the home with the
optional widgets: KPI strip, climate strip, building tree) + **`home-panel-1440-{light,dark}`** (home direction ב,
"לוח צד": widgets column + KPI strip — the status-panel composition, Tesla-styled in the Tesla skin) + **8 full-board
LTR mirrors** of home and area (`boards/<skin>/mirrors/*-ltr.html`, `renders/<skin>/mirrors/*-ltr.png`; `dir="ltr"`
on `<html>`, nothing else changes) + Domus only: `area-1440-dark-opaque` (opaque-fallback proof). `boards/index.html`
switches between skins and boards.

This is the **final Claude design package** (owner decision 2026-10-01: no round 2 for the outside designer). The
strongest assets of entrant A were imported as ideas, rewritten in our tokens and rules; the list with sources is in
`SKINS_HE.md` ("מה נלקח מהתוצר של Astra"). `node contract-check.mjs` confirms every TOKEN_CONTRACT.md name has a direct
value or an alias row (0 missing).

Round-1 judge fixes (2026-10-01): LTR mirrors rendered; the 20 contract knobs that had no value or mapping now have
values in every skin (`skins/domus.mjs` group `knobs`) and rows in `TOKEN_MAP.md`; iOS and Tesla ship separate
light/dark token CSS; Domus light and iOS light were reworked to be distinguishable at a glance (coloured canvas +
real glass + floating rail vs flat grey canvas + white grouped containers without outline); no engineering terms
(`MSE`, stream quota, NVR model) on operator boards; live camera tiles carry a text chip "חי"; offline / no-permission
tiles put the camera name on its own row (no collision on the 390 wall); saved contrast reports per skin (0 below
target); text-2 / text-3 are distinguishable in every skin and scheme.

- `TOKEN_MAP.md` — one map for all skins (same 224 names; new semantic name → old `--sw-*` / `--dv-*` names) + an
  explicit contract-coverage table (one row per `--dv-*` / `--lv-*` / `--nav-*` / component-local name).
- `RATIONALE_HE.md`, `SKINS_HE.md`, `CHECKLIST.md` — rationale, the skin layer, self-scores per skin.
- `src/` — the shared structure (`screens.mjs`, `boards.mjs`, `css.mjs`, `icons.mjs`), token access (`tokens.mjs`),
  skin registry (`skin.mjs`), helpers (`token-helpers.mjs`). `skins/` — one file per skin: full token set (light +
  dark) + bounded component rules + copy for the foundation boards.
- Rebuild: `node build.mjs [filter] [--no-render] [--skin=domus|ios|tesla|all]` (filters: `mirrors/`, `home-kpi`,
  `wall-390`, …). Contrast: `node inspect.mjs contrast --skin=<id>` prints every pair computed from the skin's tokens
  over its real canvas, ends with "N below target" and writes `contrast-report-<id>.json`. Rendering uses the
  frontend's Playwright; fonts are local (`boards/fonts/`).

No product code, no Lit components, nothing outside this folder.
