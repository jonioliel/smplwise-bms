# entrant-claude — comparison round 1, three skins on one structure

Deliverable for `docs/design/handoff/COMPARISON_TASK_HE.md`, extended after owner feedback (round 1a): the Domus
direction departs from today's card grid (DomusUI-style room screen and building view), every screen has a **list
mode** next to its card mode, and the whole shell is delivered as **three switchable skins** with an identical
structure (`SKINS_HE.md`).

| Skin | Boards | Renders | Tokens |
|---|---|---|---|
| 1 · hi-tech Domus (`skins/domus.mjs`) | `boards/` | `renders/` | `tokens.json`, `tokens.css`, `tokens-light.css`, `tokens-dark.css` |
| 2 · iOS / Apple (`skins/ios.mjs`) | `boards/ios/` | `renders/ios/` | `tokens-ios.json`, `tokens-ios.css` |
| 3 · Tesla clean hi-tech (`skins/tesla.mjs`) | `boards/tesla/` | `renders/tesla/` | `tokens-tesla.json`, `tokens-tesla.css` |

Per skin, 30 boards: 4 foundations + component sheet + home / area / wall × cards and list × 1440×900 and 390×full
height × light and dark (24) + the area states board. `boards/index.html` switches between skins and boards.

- `TOKEN_MAP.md` — one map for all skins (same 203 names; new semantic name → old `--sw-*` / `--dv-*` names).
- `RATIONALE_HE.md`, `SKINS_HE.md`, `CHECKLIST.md` — rationale, the skin layer, self-scores per skin.
- `src/` — the shared structure (`screens.mjs`, `boards.mjs`, `css.mjs`, `icons.mjs`), token access (`tokens.mjs`),
  skin registry (`skin.mjs`), helpers (`token-helpers.mjs`). `skins/` — one file per skin: full token set (light +
  dark) + bounded component rules + copy for the foundation boards.
- Rebuild: `node build.mjs [filter] [--no-render] [--skin=domus|ios|tesla|all]`. Contrast dump:
  `node inspect.mjs contrast --skin=<id>` (all pairs computed from the skin's tokens over its real canvas; the run
  ends with "N below target"). Rendering uses the frontend's Playwright; fonts are local (`boards/fonts/`).

No product code, no Lit components, nothing outside this folder.
