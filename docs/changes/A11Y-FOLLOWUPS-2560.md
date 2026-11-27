# A11Y-FOLLOWUPS-2560 - the accessibility items A11Y-NEW-2550 left open

Branch `pilot/A11Y-FOLLOWUPS-2560`, base `origin/release/2550-train` at `11bfcad19`. Target 2.56. Frontend only; no backend, wire, setting
or migration change; nothing was run against the lab, a device, Home Assistant or WisKey. The five open questions of
`A11Y-NEW-2550.md` were taken at the owner's rule (unanswered = recommendation a); question 4 (the two screens not yet on the train) is not
part of this row.

## What changed

| # | Item (A11Y-NEW-2550 "Left") | Change | Files |
|---|---|---|---|
| 1 | Rooms timeline on a DST day: "01 x2" read as "01 times 2"; the skipped hour only a `title` | The resident bar's one-line note (same wording, ink and size; `role="note"`, `data-cal-dst`) now sits above the rooms axis when the window holds the skipped or the repeated hour. The "x2" is `aria-hidden`; a visually hidden ", twice" follows the hour, so the label is read "01, twice" (English "twice") | `calendars/view-rooms.ts`, `i18n/lang/en/i18n/msg/calendars.ts` |
| 2 | Live regions arrive already filled | One announcer: `components/announcer.ts` keeps ONE polite and ONE assertive region (always present, empty, direct children of the body, light DOM), mounted by `sw-app` at start-up. `announce(text, 'polite' \| 'assertive')` clears, then fills a frame later (the same text twice is still announced) and clears itself after 6 s. Migrated: the generator mute outcomes (`data-notice` assertive, `data-mute-info` polite), the NVR pulse / revert / notify outcomes (`data-nvr-system-msg`, `data-nvr-result`: success polite, unknown / refused assertive), the legacy import result (polite) and its two refusals (assertive). The visible lines keep their text, class and focus behaviour but carry no `role` of their own (nothing is read twice) | `components/announcer.ts` (new), `shell/sw-app.ts`, `generator/gen-alerts-page.ts`, `screens/system-setup.ts`, `components/sw-legacy-import.ts` |
| 3a | Generator alert cards: `role="button"` holding the acknowledge button (nested-interactive) | The card is a plain `div`. The title row is the one real `button` (`data-alert-open`, described by the time line) and its `::after` stretches over the whole card: a click anywhere opens the alert, Enter / Space work as before, the acknowledge `sw-button` sits above it (`z-index: 1`). The focus ring is drawn on the stretched `::after` (same `--sw-focus*` tokens) | `generator/gen-alerts-page.ts`, `generator/gen-styles.ts` |
| 3b | Area row link: its `aria-label` replaced the content (label-content-name-mismatch) | No `aria-label`; the link is named by its own content (the name and the counts shown) followed by a visually hidden tail ("... N devices, <unknown locks / alarm>, enter area") that says what the bare numbers are. WCAG 2.5.3 holds because the visible text is the start of the name | `screens/devices-building.ts`, `i18n/lang/en/i18n/msg/devices.ts` |
| 4 | Step-up by passkey / phone only: the action line cannot describe an `sw-button` (another shadow root) | `sw-button` gets a `description` property: a visually hidden span inside its shadow root, named by the inner button's `aria-describedby` (nothing is rendered when it is empty). The step-up dialog passes the action line and the expiry to its passkey, phone-key and phone-approval buttons | `components/sw-button.ts`, `components/sw-step-up-dialog.ts` |

Visible changes: only (1) - one line of small grey text above the rooms axis on the two DST days a year (the rooms shrink by one line).
Cards, rows and the step-up dialog draw exactly as before. No colour, size or token was added (design ratchet below).

## Not migrated (and why)

- The reconnect screen's `sw-state-panel` keeps its own `role="status"` text (one region, not nested - fixed in A11Y-NEW-2550; the screen
  runs before the app shell exists, so there is no announcer there).
- The WisKey credential line (`data-wiskey-cred-msg`) in `system-setup.ts` and the other screens of the app that still render `role="status"`
  / `role="alert"` lines: outside the scope of A11Y-NEW-2550. `announce()` is the one place to move them to, screen by screen (open question 1).
- Left 5 of A11Y-NEW-2550 (a controlled switch says nothing while its save is in flight) is not in this row.

## Tests

Runner, slot B, `~/work/p2520_a11yfu_run.sh` (`vite build` + `vite preview`); the spec is `frontend/tests/a11y-new-2550.spec.ts`
(extended: 18 new tests x desktop + phone where not phone-only; the role assertions of the migrated lines now check the announcer regions).

| Run | Command | Exit | Result |
|---|---|---|---|
| before | the extended spec on the base `11bfcad19` | 1 | 32 failed (all the new tests and the migrated-line checks: DST note, "01, twice", announcer, alert cards, area row, passkey-only step-up), 30 passed, 2 skipped |
| after, first run | the spec at `86c8b7aaf` | 1 | 58 passed, 4 failed: only my own area-row test compared the visible text and the spoken text with different whitespace; the axe check of the same test passed. Fixed in `0f6ca47f9` (compares the content order) |
| after (final) | the spec at `c7c92c09e` | 0 | **62 passed**, 2 skipped (phone-only DST tests on desktop) |
| related evidence | `evidence-gen-mute-2540`, `evidence-nvr-undo-force-2540`, `evidence-physical-confirm-2540`, `legacy-import-ui-2550`, `evidence-dst-timeline-2540`, `evidence-area-honest-count-2540`, `evidence-client-resilience-2540`, `evidence-generator`, `a11y-dialog-focus-2310`, `a11y-polished-2342` (desktop + mobile) at `86c8b7aaf` | 0 each | 6, 6, 10, 16, 9, 12, 18, 16, 8, 14 passed (the rest skipped by design) |
| pixels | `pixel-area-honest-count-2540`, `pixel-legacy-import-2550`, `pixel-nvr-undo-force-2540` at `86c8b7aaf` | 0 each | 4, 6, 4 passed, baselines unchanged |
| pixels | `pixel-dst-timeline-2540` at `86c8b7aaf` | 1 | 1 failed (phone, autumn, light: the new note line), 7 passed - refreshed with `-u` on the runner at `c7c92c09e` (exit 0, 8 passed): one Linux baseline rewritten, `dst-rooms-autumn-light-mobile-linux.png` |
| unit | `-c playwright.unit.config.ts` `unit-step-up-ui`, `unit-a11y-polished-lint`, `unit-round4-leftovers-2390`, `unit-area-row`, `unit-generator`, `unit-i18n-lang-packs-2443`, `unit-i18n-en-ratchet-2490`, `unit-modal-stack-2441` at `c7c92c09e` | 0 | 87 passed |
| types | `npx tsc --noEmit -p tsconfig.json`; `npm run typecheck` | 0 / 0 | 0 errors |
| lint | `npx eslint` on the 10 touched source files | 0 | clean |
| ratchets | `scripts/design_ratchet.py`; `node scripts/unused-exports.mjs --enforce` | 0 / 0 | no count above the baseline. (The first run caught 5 new px literals - the hidden-text styles of the announcer and `sw-button` - and an unused exported type; fixed by `em` sizes, the shared `srOnlyStyles` fragment and a file-local type) |

Compare page: `private/planning/a11y-followups-2560_compare_2026-11-27.html` (local, not in Git).

NOT_RUN: a real screen-reader pass (NVDA / VoiceOver); the full sweep `a11y-sweep-2490`; the tablet project; the whole release gate; the
dark-scheme and spring-day pixel baselines of the DST screen are unchanged (their windows hold no extra line, or were already passing).

## Open questions (recommendation first)

1. Other screens' status / alert lines: a) move them to `announce()` as each screen is touched (no sweep row); b) one sweep row over all
   `role="status"` / `role="alert"` lines (about 60 files); c) leave them.
2. The stretched-button card pattern (3a) now exists on the generator alerts; the same nested-interactive class may exist on other list
   cards: a) check them in the next full sweep (`a11y-sweep-2490`); b) a row now; c) leave.
3. A real screen-reader pass (NVDA / VoiceOver) of the announcer, the "01, twice" label and the area row tail: a) the owner's accessibility
   pass of the 2.56 release; b) skip.
