# DESIGN-RULEBOOK-2438 - the authoritative design rulebook (documentation only)

Branch `pilot/DESIGN-RULEBOOK-2438`, from origin/main `0a8fb55e1`. No product code changed.

## What
- `docs/design/system/DESIGN.md` is rewritten as the authoritative rulebook. It describes both rulebooks the owner decided to keep
  (round 32, Q-DES-1 option ג): **Domus** (primary) and the **glass style**. Contents: principles; tokens for Domus (colour, type,
  spacing, radius, elevation, motion) and for glass, read from `frontend/src/design/tokens.ts`, `design/skins/domus.ts`,
  `skins/polish-motion.ts`, `styles/devices-themes.ts`, `styles/media-glass.ts`; the classic values beside Domus (classic is still the
  code's default skin); components and their states; layout rules; the round-32 design decisions with which are settings;
  accessibility (computed contrast numbers, reduced motion, RTL); when to use Domus and when glass; three OPEN questions with their
  options (dialog / drawer unification, the selected chip, the settings structure); a document map; Appendix A, "where the code
  disagrees with this book", with files and lines for the cleanup branches.
- The previous `DESIGN.md` (the "Arx Infra" proposal of 2026-10-27) is renamed `DESIGN_ARX_INFRA_PROPOSAL_2026-10-27.md` and marked
  superseded. Status banners added to `system/TOKENS.md` (superseded as the product's token reference), `system/COMPONENT_RULES.md`
  (current), `DESIGN_CONTRACT.md` (superseded), `MOTION_RULES.md` (current; one stale number flagged).

## Why
The design document described a look the product does not draw, so every new screen followed one of two sources and the differences
kept growing (uniformity audit of 2026-11-12, finding 1). The owner chose to keep both languages and asked for one document that
describes both.

## How the values were checked
- Token tables: read from the source files at `0a8fb55e1`; the Domus override list was also printed by a throwaway script that
  imports `tokens.ts` and `skins/domus.ts` (bundled with the repo's esbuild) and compared with the tables.
- Contrast numbers in §10.1: computed by the same script with the WCAG 2 formula from the token values (translucent layers composited
  over the flat `--sw-bg`). They are computed values, not browser measurements.
- Appendix A: each item re-read in the current files (file and line quoted). Page-scroll amounts in A.12 are quoted from the
  2026-11-12 audit of v2.43.1 and were not re-measured.
- Design skills used: impeccable (`context`, the `document` playbook: DESIGN.md format and section order), emil-design-eng (the motion
  findings of Appendix A.14 and A.18), ui-ux-pro-max (`search.py --domain ux`: colour-only state and contrast guidance, used in §10
  and §13.2).

## Tests
- `py -3.12 scripts/release_check.py`: run, RESULT "ready for the owner's approval".
- NOT_RUN: frontend type check, unit, layout, pixel and contrast specs, backend tests, the runner entry check (documentation only; no
  file under `frontend/` or `smplwise_vms/` changed).

## Known limits
- Nothing was measured in a browser. Items marked "inferred" in Appendix A come from reading the CSS.
- `pilot/AUDIT30-COMBINED-2435` is not merged; some Appendix A lines may already be changed there.
- The three OPEN questions and the round-33 question "which rulebook do new screens follow" are not decided here.
- Home interface, notice TV and the public ticket page are out of scope.

## Rollback
Revert the commit; no code, data or setting is involved.
