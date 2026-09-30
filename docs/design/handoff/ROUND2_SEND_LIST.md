# Round 2 send list — Astra (entrant A)

What the owner sends to Astra for round 2, and nothing more. Assembled as `exports/astra-round2/` +
`exports/astra-round2.zip` (gitignored; rebuild with the commands at the end). No screenshots of the owner's running
system are included — Astra already holds them from round 1 and may reference them by filename only.

## Folder layout

```
astra-round2/
  README.md                          ← 10-line index (Hebrew), reading order
  ROUND2_ASTRA_BRIEF_HE.md           ← the brief (docs/design/handoff/ROUND2_ASTRA_BRIEF_HE.md)
  ROUND1_FEEDBACK_ASTRA_HE.md        ← judge findings on her round 1 only (docs/design/handoff/ROUND1_FEEDBACK_ASTRA_HE.md)
  ROUND2_SEND_LIST.md                ← this file
  COMPARISON_TASK_HE.md              ← round-1 task (scoring rubric §5, score sheet §6 still apply)
  TOKEN_CONTRACT.md                  ← 228 names, families, fixed engineering values
  COMPONENT_INVENTORY.md             ← components and their states
  UI_COPY_RULES.md                   ← no platform branding outside settings
  SKINS_HE.md                        ← how a skin layer is bounded (from entrant B; model only, not values)
  structure/
    boards/                          ← the shared structure as static HTML (open from disk)
      fonts/                         ← Heebo woff2 (OFL)
      home-{1440,390}-{light,dark}.html      home-list-{1440,390}-{light,dark}.html
      area-{1440,390}-{light,dark}.html      area-list-{1440,390}-{light,dark}.html
      wall-{1440,390}-{light,dark}.html      wall-list-{1440,390}-{light,dark}.html
      home-kpi-1440-{light,dark}.html          ← the home with the optional widgets (KPI strip, climate strip, tree)
      mirrors/{home,area}-{1440,390}-{light,dark}-ltr.html
      area-states.html  components.html  foundations-{color,type,shape,motion}.html  index.html
    renders/                         ← the same boards as PNG (the "key PNGs" list in the brief §2)
      home-1440-light.png home-1440-dark.png home-390-light.png home-390-dark.png
      area-1440-light.png area-1440-dark.png area-390-light.png area-390-dark.png
      wall-1440-light.png wall-1440-dark.png wall-390-light.png wall-390-dark.png
      home-list-*.png area-list-*.png wall-list-*.png (12)
      home-kpi-1440-{light,dark}.png
      mirrors/*-ltr.png (8)
      area-states.png components.png foundations-color.png foundations-type.png foundations-shape.png foundations-motion.png
```

The structure boards are taken after the judge fixes of 2026-10-01 (commit `0278f6a4` on `pilot/design-compare-claude`):
no engineering terms on operator boards, live tiles with the "חי" chip, LTR mirrors, optional-widget home variant.

## Sources (repository paths)

| Sent as | Source |
|---|---|
| `ROUND2_ASTRA_BRIEF_HE.md`, `ROUND1_FEEDBACK_ASTRA_HE.md`, `ROUND2_SEND_LIST.md`, `COMPARISON_TASK_HE.md`, `TOKEN_CONTRACT.md`, `COMPONENT_INVENTORY.md` | `docs/design/handoff/` (branch `pilot/design-round2`) |
| `UI_COPY_RULES.md` | `docs/design/UI_COPY_RULES.md` |
| `SKINS_HE.md` | `docs/design/compare/entrant-claude/SKINS_HE.md` (worktree `.claude/worktrees/compare-claude`, branch `pilot/design-compare-claude`) |
| `structure/boards/*`, `structure/renders/*` | `docs/design/compare/entrant-claude/boards/*.html` + `boards/fonts/` and `renders/*.png` — the Domus (root) skin only, which is the structure reference. The iOS / Tesla skin folders of entrant B are **not** sent (they would anchor her skins) |

## Deliberately excluded

- `docs/design/handoff/current/*.png` and `docs/design/reference/**` — screenshots of the owner's system; she has them from round 1.
- `docs/design/compare/JUDGE_REPORT_HE.md` in full — entrant B's scores and the hybrid table stay internal; the A-only extract is sent.
- Entrant B's `skins/*.mjs`, `tokens*.json`, `boards/ios/`, `boards/tesla/`, `renders/ios/`, `renders/tesla/`, `src/`.
- `DESIGN_HANDOFF_HE.md`, `SCREEN_INVENTORY.md`, `REFERENCE_BOARD.md`, `DOMUSUI_EXTRACTION.md` — unchanged since round 1; she holds them.

## Rebuild

From `C:\cloude\smplwisebms` (PowerShell), with the compare-claude worktree present:

```powershell
.\scripts\design\build_astra_round2.ps1
```

The script copies the files above into `exports\astra-round2\`, writes `README.md`, and zips to `exports\astra-round2.zip`.
It refuses to run if any `.png` under `docs/design/handoff/current/` would be included.
