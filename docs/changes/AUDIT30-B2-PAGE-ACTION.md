# AUDIT30-B2-PAGE-ACTION - design audit round 30, follow-up of branch B: the page's primary action

Branch `pilot/AUDIT30-B2-PAGE-ACTION`, cut from `pilot/AUDIT30-B-SHARED` @ `cfff3be25` (branch B, queued for its entry check as is).
Plan: `private/design-system-2026-10-27/round30/system-audit/FIXES.md` item B6 (finding #8). Lead 12.11: B takes B6 (answer to
question 2 = א); the owner gate Q5 is built on option א (lead: Q1 = א confirmed). Frontend only; one file changed:
`frontend/src/components/sw-page.ts` (branch B's ownership list). No version bump, no migration, nothing under `frontend/src/home/**`.

## What changed

`sw-page` has a new named slot **`primary`**: the one primary action of the screen.

| Width | Where it renders |
|---|---|
| 768 px and up | in the header row, after the `actions` slot (the end of the row), in the flow, the ordinary key size |
| up to 767 px | one floating action: `position: fixed; inset-block-end: calc(var(--sw-bottomnav-h) + 12px + env(safe-area-inset-bottom)); inset-inline-end: 14px`, `z-index: calc(var(--sw-z-drawer) - 1)` (under drawers and dialogs), `--sw-shadow-3`, a pill 52 px high with its label (a 52 px circle for `iconOnly round`), press `scale(0.97)` in `--sw-t-fast`, no hover lift; the page body gets `padding-block-end: 64px` so the last row stays reachable |

Backward compatible: an empty slot draws nothing (the wrapper is `display: none` until an element is assigned; the host carries
`has-primary` while one is, a `hidden` element does not count). The `actions` slot is unchanged; no existing screen uses `primary`,
so no screen moves until a branch adopts it.

## API (for C, F, I)

```ts
html`<sw-page heading="יומנים">
  <sw-button slot="actions" icon="filter" label="סינון">סינון</sw-button>
  <sw-button slot="primary" variant="primary" icon="plus" label="חדש" @click=${this.create}>חדש</sw-button>
  ...
</sw-page>`
```
- Put exactly one control in `primary`: the screen's main create / start action (calendars "חדש", tickets "קריאה חדשה").
  Move it OUT of `actions`; leave secondary actions in `actions`.
- Use `<sw-button variant="primary">` with a label (the label stays visible on the phone pill). For an icon-only key add
  `iconOnly round` and a `label` (its accessible name).
- The phone sizing is done with scoped tokens on the slotted element (`--sw-ctl-h-*: 52px`, `--sw-r-sm` / `--sw-r-xs` = pill,
  `--sw-fs-sm` / `--sw-fs-xs` = `--sw-fs-md`, `--sw-hover-lift: 0px`), so any control built on those tokens follows.
- The wrapper is exposed as `part="primary"` and `[data-page-primary]` (tests).

## Tests

| Where | Command | Result |
|---|---|---|
| workstation | `npx tsc --noEmit` | pass |
| workstation | `npx playwright test -c playwright.unit.config.ts tests/unit-audit30b2-page-action.spec.ts tests/unit-audit30b-shared.spec.ts` | **9 passed** |
| workstation | `SW_BASE_URL=<local vite preview> npx playwright test tests/evidence-audit30b2-page-action.spec.ts --project=desktop --project=tablet --project=mobile` | **10 passed, 5 skipped** (project skips by design; the 2 pixel tests have no win32 baseline: comparison skipped, annotated) |
| runner | RUNNER_PLACEHOLDER | |

Measured (phone, 390 x 844): the wrapper is `fixed`, 14 px from the left (RTL end) edge, 62 px above the bottom (bottom nav 50 + 12),
the key 52 px high (76-78 px wide with "חדש"; icon-only 52 x 52), body padding 64 px. Desktop / tablet: `static`, inside the header
row, under 52 px. Screenshots: `docs/design/evidence/AUDIT30-B2-PAGE-ACTION/page-primary-{light,dark}-{1440,768,375}.png`.

Design skills: emil-design-eng (press `scale(0.97)` on the transform curve, no hover lift on touch, no entrance animation for an
element seen many times a day), impeccable craft floor (offset + blur shadow from the ladder, focus ring kept from sw-button, the
last content row not hidden under the floating key), ui-ux-pro-max (touch target >= 44 px: 52 px).

## Recorded, not done here

- Q3 = א for the other skins (domus, tesla, crystal, infra, soft, bubble draw their own selected chip): a separate task later
  (lead 12.11).
- Adoption: F (calendars "חדש"), C (tickets), I (devices / schedules / automations).

## Rollback

Revert the merge commit. No data involved.
