# FLAKY-FIX-2520 - the two intermittent specs of the 2.52 train, fixed at the cause

Base `origin/main` = v2.51.0 (`3d71fb183`), branch `pilot/FLAKY-FIX-2520`. Source: `docs/changes/RELEASE-2520-TRAIN.md` (on
`release/2520-train`), section 4, problems 2 and 6. Both causes are in the product, not in the specs.

## 1. `camera-discovery-2500` "the whole flow": axe colour-contrast at step 1

**Symptom.** About half the runs at main: axe `color-contrast` on every muted text of the wizard at step 1 ("scan setup"), with
blended colours (e.g. `.sub` `#868f9f` on `#f7f9fc` = 3.09); every later step 0. A test-side wait for `document.getAnimations()`
did not help.

**Diagnosis** (runner, a diagnostic copy of step 1 that samples every frame from the click and lists the animations of EVERY shadow
root at the moment axe runs; not committed):

- At the axe call the only running finite animation inside the wizard is `sw-dialog > .backdrop` `opacity` (the scrim's entrance,
  `--sw-t-slow` 280 ms), sampled at progress 0.00 - 0.88; the backdrop's computed opacity is 0 - 0.88. The box's own opacity is 1
  throughout. The violations' blended colours are exactly the texts at that group opacity.
- The box is a CHILD of `.backdrop`, so the scrim's opacity fade faded the whole dialog with it, on the phone too (where the design
  says the sheet only rises by a mask and explicitly keeps the box at opacity 1).
- In headless Chromium under load the animation clock advances per produced frame: the 280 ms fade took 300 - 600 ms of wall
  time (first frame of the open to the end), so a test that reaches axe ~100 - 300 ms after the dialog attaches lands inside it.
- `document.getAnimations()` in Chromium does not return animations whose target is in a shadow tree (only a document-level
  animation was listed while the backdrop's transition ran in `sw-dialog`'s shadow root) - why the train's test-side wait changed
  nothing.
- The box's own starting style (`opacity: 0; transform: scale(0.96) translateY(6px)`) never applied: the `@starting-style` block
  stood BEFORE the `.box` rule, and a starting style only wins over earlier rules of the same specificity. The designed "box lands
  from 96 %" never happened; what users saw was the whole dialog fading in through the scrim.

**Fix** (`frontend/src/components/sw-dialog.ts`, CSS only, tokens only):

- The scrim fades its colour (`background-color` from `transparent` to `--sw-overlay`) instead of the layer's opacity; the glass
  skins' blur of the page behind (crystal, bubble) eases in with it (`backdrop-filter` from `none`, marked important in the starting
  style only because the skin rule is more specific).
- The box lands by transform only (`scale(0.96) translateY(6px)` -> none on `--sw-spring-dialog`), from a starting style now placed
  after the `.box` rule. Nothing that holds text has an opacity below 1 at any frame: the dialog's texts are at full contrast from
  the first frame. Phone: unchanged mask rise; the dead `@starting-style` inside the phone block is gone (the sheet has no
  transition). Reduced motion zeroes the durations as before. Every dialog of the app (`sw-dialog`) gets this.
- The resting look is unchanged (same colours, same size, same position).

## 2. `evidence-mfa-screens-2510:88` "a cancelled step-up keeps the key and says so"

**Symptom.** 2 of 3 desktop runs at main: `[data-device-keys-error]` not found after the step-up cancel.

**Cause.** `sw-device-keys.revoke()` sets the refusal's reason, then reloads the list in `finally`; `load()` clears `error` on
success. The reason was shown for one round trip and then wiped - the spec passed only when it happened to look in between. A real
defect: the person never got to read why the key was kept.

**Fix.** The revoke keeps its reason across the reload (a failed reload shows its own reason instead). The same pattern had the same
defect in `sw-access-tokens` (revoke, revoke all) and `sw-remote-sessions` (revoke, revoke all); fixed the same way.

**Spec.** `evidence-mfa-screens-2510:88` now counts the element's finished reloads, waits for the one after the cancel and its render,
and only then checks the reason - so it fails EVERY time on the old code instead of passing by chance (proved below).
`unit-dialog-toplayer-2381` follows the new starting style (and checks no `opacity:` declaration is left in the dialog's styles and the
box's starting transform comes after the `.box` rule).

## Files

- `frontend/src/components/sw-dialog.ts` - the entrance (CSS).
- `frontend/src/components/sw-device-keys.ts`, `sw-access-tokens.ts`, `sw-remote-sessions.ts` - the reason survives the reload.
- `frontend/tests/evidence-mfa-screens-2510.spec.ts`, `frontend/tests/unit-dialog-toplayer-2381.spec.ts`.
- Train-owned files: none (see open question C).

## Tests

Runner, slot B (`~/work/slotb.sh ~/work/flakyfix_run.sh <ref> <label> <repeat> <specs>`): `vite build`, `vite preview` on
`localhost`, `npx playwright test ... --project=desktop --project=mobile --workers=2 --retries=0`, axe-core from the main checkout's
`node_modules`. "Diag" = an uncommitted copy of step 1 that runs axe (colour-contrast only) at the same moment as the spec, logs the
animations of every shadow root, then runs axe again after the dialog settled; default skin + crystal.

| run | commit | exit | result |
|---|---|---|---|
| `camera-discovery-2500` "the whole flow", x10 | main `3d71fb183` | 1 | **7 failed**, 13 passed (20 runs) |
| `evidence-mfa-screens-2510` "a cancelled step-up", x10 | main `3d71fb183` | 1 | **4 failed**, 16 passed |
| diag step 1, x10 (default skin) | main `3d71fb183` | 1 | **12 failed**, 8 passed; at the first axe 6 - 21 wizard contrast nodes, after settling 0 in 20/20 |
| diag step 1, x10 (default + crystal) | branch `43828d697` | 0 | **40 passed**; contrast 0 at the first axe in 40/40 |
| `camera-discovery-2500` "the whole flow", x10 | branch `43828d697` | 0 | **20 passed** |
| `evidence-mfa-screens-2510` "a cancelled step-up", x10 | branch `43828d697` | 0 | **20 passed** |
| `camera-discovery-2500` "the whole flow", **x20** | branch `43828d697` | 0 | **40 passed** |
| `evidence-mfa-screens-2510` "a cancelled step-up", **x20** | branch `43828d697` | 0 | **40 passed** |
| whole `evidence-mfa-screens-2510` file, x3 | branch `43828d697` | 0 | 78 passed, 6 skipped (tablet) |
| whole `camera-discovery-2500` file, x3 | branch `43828d697` | 0 | 30 passed |
| the NEW `:88` spec with the OLD `sw-device-keys.ts` (reverted to `3d71fb183`), x5 | branch + revert | 1 | **10 failed / 10** - all at "element(s) not found" for the reason: the spec now catches the defect every time |
| `tsc --noEmit -p tsconfig.json` / `npm run typecheck` / `npm run lint` | `43828d697` | 0 / 0 / 0 | 0 errors / 0 errors / clean |
| `scripts/design_ratchet.py` | `43828d697` | 0 | no count above the baseline (color-literal 1986, px-literal 25639) |
| `playwright.unit.config.ts`: `unit-dialog-toplayer-2381` + `unit-designtokens-297` | `43828d697` | 0 | 17 passed |
| pixel specs that show an `sw-dialog` (`pixel-access-events`, `-dialog-toplayer-2381`, `-nvr-encoding-batch`, `-plan-wizard-2433/2434`, `-wiskey-access-diag`, `-door-tech`, `-messaging`, `-people-writes`, `-people`, `-schedule-writes`, `-stations`, `-triage-2400`, `-mfa-screens-2510`), desktop + mobile, existing baselines | `43828d697` | 0 | 152 passed, 18 skipped - **no baseline changed** (the resting look is identical), none refreshed |

Compare page (local): `private/planning/flaky_fix_2520_compare_2026-11-25.html` - the wizard 100 ms into its entrance (every
animation of the dialog paused there) and at rest, main vs branch, desktop + phone, light + dark.

NOT_RUN: the full gate; the other skins' pixel cases beyond the specs above (the resting dialog is unchanged, so no baseline can
move); Safari / WebKit (`@starting-style` of `background-color` and `backdrop-filter` is standard; a browser without it shows the
dialog at once, as before).

## Open questions

A. The dialog's entrance is now "scrim fades, box lands" with no fade of the box. a) keep it (recommended: the texts are readable
   from the first frame, and it is what POLISH-CLASSIC-DOMUS-297 described) b) add a box fade back (accepts ~0.2 s of text below
   contrast; the axe specs would then need a wait for the shadow-root animations).
B. The 2.52 gate: a) no quarantine for the two specs - this branch joins the 2.52 train instead (recommended) b) quarantine them
   anyway with a ticket.
C. Train overlap: none of the six files is changed by `release/2520-train`, the WisKey rows or DESIGN-LITERALS-2510 (checked with
   `git diff 3d71fb183 <branch> -- <files>`). a) merge in any order (recommended).
D. `sw-drawer`, `sw-dropdown` and `home-styles` also use `@starting-style`; not audited here for the same order mistake or a fade of
   text-holding layers. a) a small follow-up audit row (recommended) b) leave.
