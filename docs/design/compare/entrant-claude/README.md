# entrant-claude — comparison round 1 ("hi-tech Domus")

Deliverable for `docs/design/handoff/COMPARISON_TASK_HE.md`.

- `boards/` — one self-contained HTML file per board (opens from disk; fonts are local under `boards/fonts/`). `boards/index.html` is the switcher.
- `renders/` — PNG of every board at its viewport (1440×900 · 390×full height · sheets 1440×full).
- `tokens.json`, `tokens.css`, `tokens-light.css`, `tokens-dark.css`, `TOKEN_MAP.md` — token export.
- `RATIONALE_HE.md`, `CHECKLIST.md` — rationale and self-score.
- `src/`, `build.mjs`, `inspect.mjs` — the generator (Node, no dependencies beyond the frontend's Playwright for rendering). Rebuild: `node build.mjs` (add `--no-render` to skip PNGs).

No product code, no Lit components, nothing outside this folder.
