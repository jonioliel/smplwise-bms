# Design handoff v1.3 ("SW A")

The 50-screen design package the owner delivered on 2026-09-15 (`SMPLWISE_50_PNG_FILES.zip` +
`SMPLWISE_50_DESIGN_HANDOFF_HE.txt`). The product calls this design **SW A**; the earlier three boards
remain available as **SW B** (הגדרות → כללי → עיצוב הממשק, names editable).

- `SMPLWISE_50_DESIGN_HANDOFF_HE.txt` — the full handoff document (tokens, shell geometry, map contract,
  per-screen specs M01–M50). It is the source of truth for SW A.
- `key-screens/` — twelve reference screens downscaled to 1260 px (JPEG) for quick orientation.
- The full-resolution PNGs (2520×1575 / 1290×2796, 30 MB) are not committed; they live with the owner and
  in the workstation's `private-evidence/design-sw-a/png/`.

Implementation notes (0.1.9): tokens in `frontend/src/styles/tokens.css` (`:root[data-design="a"]`), the
four-area shell in `frontend/src/shell/sw-app.ts` (`renderA`), the editor per M12 in
`frontend/src/screens/explore-plan-editor.ts`, the local plan stylization per M11 in
`smplwise_vms/backend/smplwise/services/plan_stylize.py`. Bearing convention adopted from §ו: 0° = up,
clockwise.
