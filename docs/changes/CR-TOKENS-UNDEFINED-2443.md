# CR-TOKENS-UNDEFINED-2443 - no `var(--sw-*)` names an undefined property; one keyboard row in investigate-search

Branch `pilot/CR-TOKENS-UNDEFINED-2443`, cut from `origin/release/2438-train` @ `5bcea468d` (the newest train head on 18.11
evening). MASTER_PLAN row `CR-TOKENS-UNDEFINED-2436` (review 07:F9; owner decision O18 = a, "fix, small visual change, new
baselines"). Planning group G5 in `REMAINING_WORK_2026-11-18.md`. No version bump, no merge, no tag. Frontend only.

## Why

A `var(--sw-x)` with no fallback whose name is neither a design token nor declared anywhere makes the whole declaration invalid at
computed-value time: a `color` silently takes the inherited (stronger) colour, a `border` shorthand draws nothing. A `var()` whose
fallback names such a property is a dead fallback (harmless, but it suggests a token that does not exist).

## What

Visible (moves pixels, intended, O18 = a):
- `--sw-text-muted` (never defined) -> `--sw-text-3` (the muted text level), so the hints are muted as designed:
  `components/sw-search-access.ts` (`.hint`), `components/wk-listen-button.ts` (`.msg`), `screens/system-building-presence.ts`
  (`.muted`), `screens/system-presence.ts` (`.muted`), `screens/wiskey-bulk-people.ts` (`.muted`, `.diff .k`).
- `--sw-line` (never defined) -> `--sw-border`: `screens/investigate-search.ts` `.row` - the semantic result row now has its 1 px
  border (the row grows by 2 px per axis).

Pixel-neutral (dead fallbacks removed; the outer token always exists, so the fallback never applied):
- `var(--sw-danger-text, var(--sw-err))` -> `var(--sw-danger-text)`: `screens/installer-clock.ts`, `screens/installer-styles.ts`.
- `var(--sw-danger, var(--sw-err))` -> `var(--sw-danger)`: `screens/installer-platform.ts`, and `styles/settings.ts`
  (`settingsFieldInvalidStyles`). **Outside the row's file list**: the review missed this one (the shared invalid-field rule that
  installer-clock and installer-styles include); without it the new unit stays red. One line, pixel-neutral.
- `var(--sw-accent, var(--sw-primary))` -> `var(--sw-accent)`: `components/sw-partner-api-card.ts`.
- `var(--sw-surface-2, var(--sw-bg-2))` -> `var(--sw-surface-2)`: `components/wk-door-tech.ts`.

Row extras:
- `investigate-search.ts` "also its keyboard row" (review 06:A11Y-1, `investigate-search.ts:366`): the demo match cards (`.res`,
  click opens the playback) get `role="link"`, `tabindex="0"` and Enter / Space, the same pattern as the semantic result rows above
  them. The `.res:focus-visible` ring already existed. Pixel-neutral (a focus ring only on keyboard focus).
- `wiskey-bulk-people.ts` "also its confirm" (review 06:CMP-1, `wiskey-bulk-people.ts:320`): nothing left to do - the file holds no
  native `confirm()` any more on the train head (the confirm step is the typed-count confirmation of the server job).

Test (`tests/unit-designtokens-297.spec.ts`, extended):
- New: every `var(--sw-*)` without a fallback, in every `.ts` / `.css` file under `frontend/src` (nested fallbacks included), names
  a token of `design/tokens.ts` **or** a custom property the source itself declares (`--sw-x:`). The row's wording says "exists in
  design/tokens.ts"; read literally that would fail on 24 legitimate component-local properties (`--sw-dw-*`, `--sw-gw-*`,
  `--sw-m-t/d/w`, `--sw-safe-top`, the public-ticket page properties, ...), so the rule accepts a source declaration too. The five
  names of the finding are pinned as "declared nowhere".
- New: every clickable result card of investigate-search (`.row`, `.res`) is a keyboard target.
- Negative check: with the `src/` changes stashed, both new tests fail (13 offending references listed, then the `.res` card).

## Tests actually run (workstation, 18.11 evening)

- `npx tsc --noEmit`: clean (0 errors).
- `npx playwright test -c playwright.unit.config.ts tests/unit-designtokens-297.spec.ts --workers=1`: 11 passed (9 existing + 2 new).

## NOT_RUN - refresh on the runner after 2.43.8

Baselines / evidence that may move (only the muted-text and border changes draw differently; run them, refresh what differs):
- `pixel-wiskey-station-media.spec.ts`, `pixel-wiskey-talk-dial-2382.spec.ts` (the listen-button message `.msg`, if shown).
- `screens.spec.ts`, `visual-matrix.spec.ts` (any shot of settings › mobile app / presence, settings › diagnostics › media, the
  WisKey people CSV dialog).
- Evidence shots (no baseline compare, PNG only): `evidence-presence-settings.spec.ts`, `evidence-presence-count-2400.spec.ts`,
  `evidence-presence-design-2300.spec.ts`, `evidence-semantic.spec.ts`, `r5-investigate-shoot.spec.ts`,
  `evidence-wiskey-station-media.spec.ts`.
- Behaviour specs of the touched screens: `unit-bulk-people.spec.ts`, `evidence-semantic.spec.ts`, `evidence-wiskey-installer.spec.ts`,
  `pixel-wiskey-door-tech.spec.ts`, `unit-partner-api.spec.ts` (expected unchanged).
- No entry check queued (18.11 evening rule: push only until the 2.43.8 release gate has finished).
