# CHECKLIST — self-assessment against COMPARISON_TASK_HE.md §5 (entrant-claude, three skins, after the round-1 judge fixes)

Scores 1–5, one line of reasoning each, with the board to check. The judge's round-1 scores are in brackets
(`docs/design/compare/JUDGE_REPORT_HE.md`); where the judge scored lower than the previous self-score, the fix is named.
R1 reads "fidelity to the skin's own direction" for skins 2 and 3.

| # | Criterion | Domus | iOS | Tesla | Reasoning / evidence |
|---|---|---|---|---|---|
| R1 | Direction fidelity | 4 [4] | 4 [4] | 4 [4] | Domus: a coloured lavender-blue canvas with visible warm/cool blooms, glass at .52 with a top sheen and white hairline, floating rail with shadow, 44px titles, warm/cool/green glows (`renders/home-1440-light.png`). iOS: flat `#f2f2f7` / true black, white grouped containers without outline, 8/10/12 radii, filled icon squares, grey pills, blue text buttons, 51×31 switch (`renders/ios/home-1440-light.png`). Tesla: black/white, 1px rules, 48/500 titles, 72 numerals, inverted segmented, accent toggle. Not 5: the layout is shared, so the Tesla composition the judge liked in entrant A (status panel) exists only as the owner's home direction ב, not rendered here. |
| R2 | Consistency across screens | 5 [5] | 5 [5] | 5 [5] | One structure file for all skins; the same rail, corner, view switch, floor button, section header, tile, row, badge, dot and camera chip in every screen and mode. |
| R3 | RTL | 5 [3] | 5 [3] | 5 [3] | Fixed: 8 full-board LTR mirrors per skin (`renders/<skin>/mirrors/home-1440-light-ltr.png` …); the tab / strip / count-picker fades are logical and flip under `[dir="ltr"]`; numbers isolated; geometry (camera scenes) not mirrored. |
| R4 | Dark + contrast | 5 [5] | 5 [5] | 5 [4] | Saved `contrast-report-<skin>.json`: 72 / 68 / 68 pairs, 0 below target, min 3.05 / 3.41 / 3.36 (the 3:1 indicator pairs). Fixed: Tesla light text-2/text-3 now `#3f4247` / `#606368` (were nearly identical); iOS and Domus light hierarchies widened too. |
| R5 | Phone + touch targets | 4 [4] | 4 [4] | 4 [4] | Fixed: offline / no-permission / connecting tiles put the camera name on its own bottom row (`renders/<skin>/wall-390-light.png`), no collision with the state word. Not 5: the count picker on the 390 wall still scrolls (entrant A's two-row grid is the better answer and is queued for the hybrid); the floor heading can wrap on 390. |
| R6 | State coverage | 5 [4] | 5 [4] | 5 [4] | Fixed: live tiles carry the text chip "חי" (dark pill + green dot), so every one of the 7 tile states is shape + text (`renders/<skin>/wall-1440-dark.png`, `components.png`); area states as full screens in context; the empty state lost its hint line. |
| R7 | Implementability vs token contract | 5 [4] | 5 [4] | 5 [4] | Fixed: the 20 missing knobs (`--dv-kpi-compact-*` ×8, `--dv-tree-*` ×4, `--dv-*-min` ×5, `--dv-icon-ring-pad/-on-bg`, `--dv-color-scheme`) have values in every skin and rows in `TOKEN_MAP.md`; 223 identical names per skin; base CSS uses them (`.kpis`, `.tree-panel`, `.atile`); skin rules 18 / 45 / 46 (≤ 50). |
| R8 | Restraint and clarity | 5 [4] | 5 [4] | 5 [4] | Fixed: no `MSE`, no stream quota, no NVR model on any operator board or in the component sheet; the wall facts row is states + refresh cadence only; the camera list shows "איכות" in words. |
| R9 | Originality within constraints | 4 [4] | 3 [3] | 4 [4] | Unchanged: skin layer with counted rules, room cards with ambient chips, three list modes, `-text` state companions, the optional-widget home variant. iOS is by nature the least original. |
| R10 | Export completeness | 5 [4] | 5 [4] | 5 [4] | Fixed: JSON + combined CSS + separate light and dark CSS for every skin, saved contrast report per skin, one TOKEN_MAP covering all 228 contract names, RATIONALE (with the fix table), SKINS, this checklist; 40 boards per skin open from disk. |

**Totals (self): Domus 47 / 50 · iOS 46 / 50 · Tesla 47 / 50** (judge, round 1: 41 / 40 / 40). The self-scores are
again above the judge's; every point above the round-1 judge score is tied to a named fix in the table.

Constraint check (§3), all skins: 1 RTL + full LTR mirrors ✓ · 2 rail, no top bar ✓ · 3 44px ✓ · 4 no paragraphs/badges/hints ✓ · 5 no platform names ✓ ("תשתית המערכת" once, in an error state) and no engineering terms ✓ · 6 permission-driven visibility ✓ (read-only board) · 7 WisKey in the rail, frame untouched ✓ · 8 cheap wall ✓ · 9 light+dark, contrast (saved report), fallback, reduced-motion ✓ · 10 geometry not mirrored, no copied code ✓ (DomusUI: structure ideas only).

Not done from §1 / round 1a / the judge's "what to merge" list: the temperature dial, the camera illustrations, the
two-row count picker, the opaque-fallback proof board and the extra component families (timeline, table, popover,
24-hour grid) — listed under "מה פתוח" in `RATIONALE_HE.md`; they belong to the hybrid merge, not to this skin layer.
