# CR-INITIALS-2443 - one initials rule on every avatar

Branch `pilot/CR-INITIALS-2443`, cut from `origin/release/2438-train` @ `5bcea468d` (the newest train head on 18.11 evening; the
train had not moved between the two branches of this evening). MASTER_PLAN row `CR-INITIALS-2436` (review 08:F09; owner decision
O6 = a, "one rule everywhere, some avatars change letters"). Planning group G6 in `REMAINING_WORK_2026-11-18.md`. No version bump,
no merge, no tag. Frontend only.

## Why

Six private copies drew the initials of a name, each differently: first + second word or first + last word, two letters of one word
or one, upper-cased or not, and two of them indexed `x[0]` (half a surrogate pair for a letter outside the BMP). The same person got
different letters on different screens. The shared, tested rule is `components/avatar-initials.ts` (`avatarInitials`, used by
`sw-avatar`): letters only, counted in graphemes, first letter of the first and of the LAST word (a roman-numeral / Jr / Sr suffix is
not the last word), never a Hebrew + Latin pair, upper-cased on the two-word path; one word -> its first two letters.

## What

Each copy now delegates to `avatarInitials`; the exported names stay, so no importer changed (rfq-board, rfq-compare, rfq-new,
rfq-order, rfq-terms, overview-tab, wiskey-person-drawer keep their imports).
- `access-control/people-logic.ts` `initials` (WisKey person photo frame) -> `avatarInitials(name)`.
- `tickets/contacts-directory.ts`, `tickets/handlers-members.ts` (module-private) -> `const initials = avatarInitials`.
- `tickets/list-card-model.ts` `initials` (ticket list / board card avatar pair) -> `avatarInitials(name)`.
- `tickets/rfq-model.ts` `initials` (RFQ vendor rows) -> `avatarInitials(name) || '?'`: a name with no letter keeps the "?" these
  rows always drew (the `.av` spans have no person-icon fallback like `sw-avatar`).
- `tickets/status-block.ts` `initials` (ticket status block / overview) -> `avatarInitials(name ?? '')`.

Visible differences (intended, O6 = a), for example from the test mocks:
- three or more words: first + LAST word (`קליימה-טק מיזוג אוויר`: card `קט` -> `קא`; `מפעיל שער ראשי` `מש` -> `מר`);
- one Hebrew word in the contacts / members tiles: two letters instead of one (`חניון` `ח` -> `חנ`);
- digits never make an initial (`קומה 2` `ק2` -> `קו`), a mixed Hebrew + Latin name shows one letter (`NVR ראשי` `Nר` -> `N`);
- Latin two-word names are upper-cased everywhere (contacts / members drew them lower-case);
- one Latin word keeps its case (`viewer`: card `VI` -> `vi`) - that is how `sw-avatar` already draws it (see owner question).

Out of the row's file list, left as they are (lead follow-up, not done here): `access-external/request-dialog.ts` (private
`initials()` method, splits on hyphens too) and `components/device-activity-logic.ts` (actor initials, `[...w][0]`, no upper-case).
Both are further copies the review did not list.

Test: `tests/unit-polish-classic-domus-297.spec.ts` (the `avatarInitials` unit), new test "every screen that draws initials uses the
one rule": the four exported copies equal `avatarInitials` (rfq: `|| '?'`) over 11 worst-case names (lower case, three words,
`אלון ד.`, a hyphen, letters outside the BMP, Hebrew + Latin, a roman suffix, an emoji, empty), null / undefined for the status
block, and a source check that the two Lit screens alias the shared rule and no split-and-index body is left in the six files.
Negative check: with the `src/` changes stashed the new test fails (`people-logic: "dana levi"` -> `dl`, expected `DL`).

## Tests actually run (workstation, 18.11 evening, `--workers=1`)

- `npx tsc --noEmit`: clean (0 errors, exit 0) on the tree of `888ad05f8`; it finished just after that push.
- `npx playwright test -c playwright.unit.config.ts` `unit-polish-classic-domus-297`, `unit-tickets-list`, `unit-people-logic`,
  `unit-tickets-rfq`: 81 passed (existing initials expectations unchanged and still green).
- Same config, `unit-tickets-rfq-order`, `unit-tickets-rfq-terms`, `unit-public-rfq`, `unit-rfq-attachments`,
  `unit-rfq-award-notice`, `unit-rfq-vendor-upload`: 49 passed.

## NOT_RUN - refresh on the runner after 2.43.8

Baselines that move (the board mock's vendor `קליימה-טק מיזוג אוויר` changes letters):
- `evidence-audit30c-tickets.spec.ts` (board / list shots, toHaveScreenshot), `pixel-audit30a-glass-bridge.spec.ts`
  (`tickets-board-dark`), `pixel-home-fb-2431.spec.ts` (the tickets shots) - run, refresh what differs.
Evidence shots with avatars (PNG only, no compare): the tickets detail / RFQ / contacts / departments evidence specs
(`evidence-tickets-*`, `evidence-public-rfq.spec.ts`), WisKey person drawer (`evidence-wiskey-people*.spec.ts`).
- Ticket / RFQ behaviour specs that read avatar text, if any, on the runner gate.
- No entry check queued (18.11 evening rule: push only until the 2.43.8 release gate has finished).

## B - the two copies left outside the row (`pilot/CR-INITIALS-B-2443`)

Owner rule: unanswered = recommendation a. Cut from `pilot/CR-INITIALS-2443` @ `f9845046b`. Frontend only, no version bump.

- `access-external/request-dialog.ts` private `initials()` method (person row, picked-person header, approver avatars): was split on
  spaces AND hyphens, `w[0]` of the first two parts. Now `avatarInitials(name) || '?'`. The method name stays. The `.av` spans have no
  person-icon fallback (like the RFQ rows), so a name with no letter keeps a "?" instead of an empty circle. Visible: a hyphenated
  Latin name is one word (`Jean-Pierre` -> `Je`, was `JP`), three-word names use the last word, lower-case names are upper-cased.
- `components/device-activity-logic.ts` `actorView().initials` (person actor in the device activity feed): was `[...w][0]` of the first
  two words, no upper-case. Now `avatarInitials(name)`. No special fallback needed: the call site (`device-activity.ts`) already
  draws the person glyph when `initials` is empty (emoji-only or digit-only name). Non-person actors still return `''`.

Test: new `tests/unit-initials-b-2443.spec.ts` (2 tests): actorView equals `avatarInitials` over 11 worst-case names plus explicit
cases (three words `דכ`, `dana levi` -> `DL`, non-BMP letters, emoji -> `''`, automation -> `''`); source check that the dialog method
delegates and has no split-and-index body (a Lit class is not importable in Node). Negative check: with `src/` stashed both tests fail.

Tests actually run (workstation, `--workers=1`): `unit-initials-b-2443`, `unit-device-activity`, `unit-access-external`,
`unit-polish-classic-domus-297`: 47 passed. `npx tsc --noEmit`: clean (exit 0).

NOT_RUN: pixel / evidence specs that show these initials (`evidence-device-activity*.spec.ts`, the access-request dialog evidence
and any request-dialog pixel baseline) - runner, after the 2.43.8 gate. No entry check queued.
