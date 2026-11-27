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

TESTS_PLACEHOLDER

## Open questions (recommendation first)

1. Other screens' status / alert lines: a) move them to `announce()` as each screen is touched (no sweep row); b) one sweep row over all
   `role="status"` / `role="alert"` lines (about 60 files); c) leave them.
2. The stretched-button card pattern (3a) now exists on the generator alerts; the same nested-interactive class may exist on other list
   cards: a) check them in the next full sweep (`a11y-sweep-2490`); b) a row now; c) leave.
3. A real screen-reader pass (NVDA / VoiceOver) of the announcer, the "01, twice" label and the area row tail: a) the owner's accessibility
   pass of the 2.56 release; b) skip.
