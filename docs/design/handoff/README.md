# Designer handoff package (2026-09-30, inventories refreshed 2026-10-09 for product 2.4.2)

The self-contained brief for redesigning the whole SmplWise Arx UI in one design language. Written for a designer or design agent who has
never seen the code. Owner-facing narrative in Hebrew, inventories in English.

**Refresh 2026-10-09.** The three inventories (`SCREEN_INVENTORY.md`, `COMPONENT_INVENTORY.md`, `TOKEN_CONTRACT.md`) were rewritten from the
code of `main` @ `31fe5d7c` (product **2.4.2**). Everything that did not exist in product 0.1.148 (2026-09-30) is marked **NEW**; things that
exist but changed shape are marked **CHANGED**. `CHANGES_SINCE_0.1.148.md` is the one-page summary of the delta. The brief
(`DESIGN_HANDOFF_HE.md`), the reference board, the Codex handoff note and the comparison task were NOT rewritten: they still describe the
0.1.148 round and carry a status banner. **Where any document disagrees with the code, the code is the source of truth**
(`frontend/src/design/tokens.ts`, `frontend/src/design/skins/*.ts`, `frontend/tests/unit-design-tokens.spec.ts`).

| File | Language | Purpose | State |
|---|---|---|---|
| `CHANGES_SINCE_0.1.148.md` | EN | One page: what is new or changed since 0.1.148 (areas, screens, components, tokens, skins, permissions) | **NEW** 2026-10-09 |
| `SCREEN_INVENTORY.md` | EN | Every route / screen with permissions, viewports, screenshot source, components, states; permission-gated variants; roles | refreshed 2026-10-09 (2.4.2) |
| `COMPONENT_INVENTORY.md` | EN | Every custom element (shared, shell, feature families) and the recurring patterns, with variants, states and RTL notes | refreshed 2026-10-09 (2.4.2) |
| `TOKEN_CONTRACT.md` | EN | The token architecture (one table, skins, schemes, look dials, performance), the full `--sw-*` table with light / dark values, the `--dv-*` and knob families, fixed vs free | refreshed 2026-10-09 (2.4.2) |
| `DESIGN_HANDOFF_HE.md` | HE | The 0.1.148 brief: scope, product in one page, direction, hard constraints, deliverable format, acceptance criteria, process | 0.1.148 (banner) |
| `REFERENCE_BOARD.md` | EN | The curated screenshots in `current/` (0.1.148 era) and the external references; §1a lists newer screenshot sets | 0.1.148 + pointer section |
| `HANDOFF_CODEX_HE.md` | HE | How the owner hands the package to an outside agent and compares results fairly | 0.1.148 |
| `COMPARISON_TASK_HE.md` | HE | The bounded round-1 task given to two entrants, with the scoring rubric | 0.1.148 (closed round) |
| `AI_DESIGN_TOOLS_SURVEY_HE.md` | HE | Survey of AI design tools | background |
| `current/` | — | 55 PNG screenshots of the 0.1.148 build and the then-approved mockups (`<screen>-<viewport>.png`). **Not re-shot for 2.4.2** | stale chrome |

The current brief for the Astra round (2026-10-08) is not in this folder; it travels with the package as `astra/ASTRA_DESIGN_BRIEF_2026-10-08_HE.md`.

Returned designs go to `returned/<entrant>/`; the decision to `returned/DECISION_HE.md`.
