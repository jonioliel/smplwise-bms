# CHECKLIST — self-assessment against COMPARISON_TASK_HE.md §5 (entrant-claude)

Scores 1–5, one line of reasoning each. Honest: where the boards fall short, it is written here.

| # | Criterion | Self | Reasoning |
|---|---|---|---|
| R1 | Direction fidelity ("hi-tech Domus") | 4 | Canvas with warm/cool blooms, three glass levels with a nesting rule, 40 px titles, iOS controls, warm/cool/green glows — one system in every board. Not 5: the canvas is a gradient only; a wallpaper option (ocean/forest) was not designed. |
| R2 | Consistency across the 3 screens | 5 | The same rail, corner, tabs, segmented, card, tile, badge and dot appear in all three; KPI tile and camera tile share radius, name typography and status dot; only the material differs (by rule). |
| R3 | RTL | 4 | All CSS logical; numbers/IDs isolated LTR; chevrons mirror; LTR mirror shown for rail, bottom bar, tabs, segmented, toggle. Not 5: LTR mirrors of the full home/area boards are not rendered (only component-level). |
| R4 | Dark + contrast | 5 | Dark designed on its own (blue-black base, softer blooms, highlight .10, deeper shadows); 34 computed pairs printed on the colour board, all ≥ 4.5:1 (text) / ≥ 3:1 (icons), composited over the real canvas; solid fallback per level. |
| R5 | Phone + touch targets | 4 | 390 boards for all three screens, bottom bar, 44 px targets, widgets as a snap row, one-column area, 2-column wall. Not 5: the widget row hides the quick actions behind a scroll; the count segmented on the phone scrolls. |
| R6 | State coverage | 4 | Area board: loading · empty · error · unavailable (domain + device) · read-only; camera tile ×7 states; component states as listed. Not 5: no "connecting/stale" tile inside the 16-wall itself (they are on the sheet), no pending/optimistic device tile in the area board (on the sheet). |
| R7 | Implementability vs token contract | 5 | Every `--sw-*` and `--dv-*` colour has a light+dark value or a mapping row; motion/easing/focus specified; no component uses a value outside the tokens (checked by construction: all CSS reads `var(--sw-*)`). |
| R8 | Restraint and clarity | 4 | No paragraphs on operator screens; row = thing + state + control; confirmation = question + count + one caveat + 2 buttons + collapsed details; no platform names. Not 5: the home is dense at 1440×900 (fits exactly); the state panels carry a one-line hint each. |
| R9 | Originality within constraints | 4 | Own answers: floating glass rail, cheap opaque video tiles that stay in the family, `-text` state companions, shape-coded tile states, bulk-off as a widget + per-domain ghost. Not 5: the page anatomy follows the approved mockups closely, by brief. |
| R10 | Export completeness | 5 | `tokens.json` (light+dark, no nulls), `tokens-light.css`, `tokens-dark.css` (+ auto), `tokens.css`, `TOKEN_MAP.md`, `RATIONALE_HE.md`, this checklist; boards open from disk; contrast check runs automatically in the colour board. |

**Total (self): 44 / 50**

Constraint check (§3): 1 RTL ✓ · 2 rail, no top bar ✓ · 3 44 px ✓ · 4 no paragraphs/badges ✓ · 5 no platform names ✓ (the phrase "תשתית המערכת" appears once, in an error state) · 6 permission-driven visibility ✓ (read-only board) · 7 WisKey area present in the rail, frame untouched ✓ · 8 cheap wall ✓ (no blur/shadow/animation on tiles) · 9 light+dark, contrast, fallback, reduced-motion ✓ · 10 geometry not mirrored, no copied code ✓.

Not done: nothing from §1. Known gaps are listed under "מה פתוח" in `RATIONALE_HE.md`.
