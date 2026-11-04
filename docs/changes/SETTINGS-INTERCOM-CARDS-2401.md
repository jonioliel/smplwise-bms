# SETTINGS-INTERCOM-CARDS-2401 — "מתגי מסכי כניסה" as collapsible cards (with two tabs or one list as options)

Branch `pilot/SETTINGS-INTERCOM-CARDS-2401`, cut from `origin/release/2400-train` at `ac87047b2` (the 2.40.0 version commit, before
its UI build), `origin/main` (v2.40.0, `d6294fc51`, test fixes only) merged in. Ships as 2.40.1. No merge to main, no version bump,
no changelog entry, no UI rebuild (`www` is main's 2.40.0 build), no tag. No lab, Home Assistant, WisKey or station contact: every
test runs against mocks / fakes.

## 1. The decision

Owner 04.11 evening, round 19 Q6 = **a**, "with the ability to change to b or c in Settings". The Settings tab "מתגי מסכי כניסה"
(group "בקרת כניסה") was taller than one screen and scrolled; the 2.40.0 fixed-engine rows added 165 px. Owner rule: no scrolling in
control screens.

- **a (default) - collapsible cards.** Every section is a card; its header shows the title and a one-line summary of the saved
  values; one card is open at a time (opening one closes the other); the last open card is remembered per user.
- **b - two tabs.** "מתגי מסכי כניסה" and a new "הכרזות וקול".
- **c - one list.** The 2.40.0 page.

A new installation setting chooses between them: `access.settings_layout` = `cards` | `tabs` | `list`, default `cards`
(`routers/settings.py`: default, `PATCH /settings` pattern `^(cards|tabs|list)$`, `system.configure`, audited as every product
setting, a corrupt stored value reads as `cards`). Its row, **"סידור הלשונית"** (choices "כרטיסים מתקפלים" / "שתי לשוניות" /
"רשימה אחת"), is in the tab itself: in a, in the card "אזור WisKey והטמעה"; in b and c, in the first card. It applies after the
card's save, like the other rows. The pattern is the one of the neighbouring rows (`ui.hide_wiskey`, `access.phone_embed`): a backend
key with validation, a row with a select, saved with the card's own button.

## 2. Layout a, how it fits

1366x768 leaves about 540 px under the page title and the tab row (the content starts at y = 205). Ten card headers stacked with a card
unfolded between them cannot fit there (ten headers alone take ~470 px). So, by the width of the list (a container measure, not the
window's; `components/sw-fold-cards.ts`, `FOLD_WIDE_MIN` = 820 px):

- **wide (desktop):** the headers form a column at the start side (232-280 px); the open card stands beside them from the top. The
  open card gets the window's remaining height minus the page's bottom padding (`--fold-room`, 32 px kept free). A card whose content
  is naturally longer than that would scroll inside itself (`data-fold-scroll`) and never the page - **with the data measured, no card
  needs it** (section 5).
- **narrow (phone, tablet):** the headers stack and the open card unfolds under its own header; a second tap folds it (all may be
  closed). On a wide list one card is always open (an empty side would be a hole).

Header: a button, title (15 / 600) over the summary line (12, one line with an ellipsis, the full text as its tooltip), at least 44 px;
`aria-expanded`; the open header is tinted (accent soft + accent title); press feedback, hover only under a fine pointer, focus ring;
the open card fades in (180 ms, strong ease-out), opacity only under reduced motion. Inside a card the settings rows are a step denser
(`--sw-set-row-pad` 8 px 14 px, `--sw-set-row-gap` 4 px - two new custom properties of `styles/settings.ts` whose fallbacks are the old
values, so no other page changes), and the card components draw no heading of their own (the header carries it).

The open card is remembered per user in this browser: `localStorage['sw.settings.access-cards.open.<HA user id>']`, every read and
write in try/catch (a private window simply does not remember). `#/system/diagnostics?tab=access-control&card=<id>` opens a card (in
b it opens the card's tab); `?tab=access-voice` lands on the announcements card in a and c. A card with unsaved changes says
"יש שינויים שלא נשמרו" first in its summary. Closed cards stay mounted (hidden), so a draft in one card survives opening another.

## 3. The cards and their summary lines

| # | Card (id) | What is in it | Summary line (examples) |
|---|---|---|---|
| 1 | מתגי מסכי כניסה (`screens`) | the five per-screen switches, the fixed row, save `data-save-access-ui` | "Arx: מרכז הכניסה, פעילות, אנשים · השאר WisKey מוטמע" / "כל המסכים: WisKey מוטמע" / "כל המסכים: Arx" |
| 2 | אזור WisKey והטמעה (`area`) | show / hide the area, phone embedding, **סידור הלשונית**, the three notes (embed, embed API, the warning), save `data-save-access-area` | "האזור מוצג · הטמעה בטלפון: כבויה · כרטיסים מתקפלים" |
| 3 | תצוגת מסך התחנות (`display`) | call hint, talk button, video and talk (+ source, longest talk, listening while on) | "רמז שיחה: כל מי שרואה את התחנה · דיבור: מוצג · וידאו: כבוי" |
| 4 | הכרזות (`announce`) | announcement targets, fixed engine and language (TTS-DEFAULT-ENGINE-2400), quick phrases (the box opens at 3 lines inside a card) | "תחנה, מקום או כל התחנות · מנוע: ברירת המחדל · משפטים מובנים" |
| 5 | שיחות נכנסות מעמדות (`calls`) | the incoming-call banner (system administrators; hidden when the server has no such setting) | "כבוי" / "לכל מי שרשאי לענות · כל העמדות · עם צלצול" / "לתפקידים נבחרים (2) · 1 עמדות · בלי צלצול" |
| 6 | השוואה למסכי האינטרקום (`parity`) | the parity report (access.admin.read) | "עוד לא הורצה" / "12 תואמים · 2 מסוננים · 0 לא תואמים" |
| 7 | בדיקה ידנית צד לצד (`checklist`) | the side-by-side checklist; inside a card the five screens stand side by side | "3 מתוך 10 נבדקו" |
| 8 | חיבור Arx ל-WisKey (`pairing`) | the pairing status (system administrators); inside a card the feature list and the conflicts / alerts section open on their own "הצגה" key | "מצומד · דיבור מוכן" |
| 9 | WisKey רואה את Arx כ־ (`diagnostics`) | the on-request identity check (system administrators) | "עדיין לא נבדק" / "זהות השירות: מחובר · ערוץ הרקע: משתמש בזהות השירות" |
| 10 | בדיקת קבלה לעמדות (`validation`) | the link to the acceptance tool (access.stations.manage) | "לכל עמדה, רצה רק בלחיצה" |

The summaries are of the SAVED values. Cards 1-2 are drawn by `system-diagnostics.ts` from the settings; cards 3-10 are the existing
components, which report their summary (`access-fold-summary`, `emitFoldSummary` in `access-control/settings-cards-logic.ts`) and whether
they draw anything for this viewer. A viewer without a card's permission does not get its header.

## 4. Layout b - the split

| Tab | Contents |
|---|---|
| "מתגי מסכי כניסה" (`?tab=access-control`) | the 2.40.0 switches card (+ the layout row), "תצוגת מסך התחנות" **without** the announcement rows, the parity report and checklist, the pairing, "WisKey רואה את Arx כ־", the acceptance check |
| "הכרזות וקול" (`?tab=access-voice`, new, right after it in the tab row) | "הכרזות" (targets, fixed engine and language, quick phrases) and "שיחות נכנסות מעמדות" |

Why this split: the announcement engine and the call banner are about voice and sound and are changed together; the first tab keeps the
screen switches and what each screen shows, and the WisKey checks that decide whether a screen can be switched. The settings column
keeps its rows (owner decision 402): "הכרזות וקול" has no row; on that tab the column marks "מתגי מסכי כניסה" (`activeEntry` in
`screens/system-index.ts`), and the settings search finds it through that entry's words ("הכרזות וקול", "מנוע הקראה"). Layout b does not promise to fit the screen: the first tab still scrolls at 1366x768 (it is the owner's alternative).

Layout c is the 2.40.0 list plus the one layout row.

## 5. Fit, measured (runner, `layout-settings-intercom-cards-2401`, @ `8d3d45577`)

Admin persona with every card's real content (mocked backend: the access-control mock, the parity mock, a call-banner setting, a paired
pairing status with 8 lines and 2 features). Each card opened in turn; the page overflow (document, the shell's main, the screen's
wrapper, the screen - the NOSCROLL probe), the open card's own overflow, its bottom and the last header against the window.

| Card | 1440x900: open card, px (bottom) | 1366x768: open card, px (bottom) | page / inner scroll |
|---|---|---|---|
| screens | 499 (704) | 518 (723) | 0 / 0 |
| area | 496 (701) | 515 (720) | 0 / 0 |
| display | 279 (484) | 279 (484) | 0 / 0 |
| announce | 502 (707) | 502 (707) | 0 / 0 |
| calls | 335 (540) | 335 (540) | 0 / 0 |
| parity | 150 (355) | 150 (355) | 0 / 0 |
| checklist | 497 (702) | 474 (679) | 0 / 0 |
| pairing | 476 (681) | 476 (681) | 0 / 0 |
| diagnostics | 78 (283) | 78 (283) | 0 / 0 |

Last header (9 headers): 641 px at both sizes; the spec also requires room for a tenth (the acceptance-check card, not drawn for this
persona): 641 + 48 <= 768. The first round (`86b55745a`) failed at 1366x768 - the switches card 6 px over, no room for the tenth header,
the pairing card scrolling inside (+417 px) - and was fixed by the 44 px headers, the denser rows, the folded pairing sections and the
32 px kept under the open card. The pairing card's length depends on the installation (owner steps, re-pair, a long conflicts list
once opened); beyond the room it scrolls inside its card, never the page.

## 6. Tests

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` (src + tests) | workstation @ 97466f793, ba4569d79 and the final head | exit 0 |
| Unit `unit-settings-intercom-cards-2401` (new, 15 tests) + 28 related files (settings index, intercom ops, TTS default, wxmedset, talk max, live validation, parity logic, wiskey stations / triage / embed connector, and the source lints: tokens, a11y, menu, RTL, empty-state icons, date format, page background, dark polish) | workstation @ 7b23d6f0c | **278 passed** |
| Unit `unit-settings-intercom-cards-2401` + `unit-settings-index` + `unit-intercom-ops` | workstation @ the final head | **34 passed** |
| Backend `test_settings_intercom_cards_2401` (new, 5) + `test_ui_settings` | workstation, project `.venv` | **23 passed** |
| Backend, every file that imports the settings defaults / model (13 files, incl. the two above) | workstation, project `.venv` @ 97466f793 | **821 passed, 1 skipped** |
| `layout-settings-intercom-cards-2401` + `evidence-settings-intercom-cards-2401`, desktop + mobile (`spec` job) | runner @ 86b55745a | evidence 8 passed; layout **3 failed** (section 5; the phone case was a spec bug: it folded the card open on arrival) |
| the same | runner @ 8d3d45577 | **11 passed, 5 skipped** (tablet / project-scoped) |
| Regression `preview`, desktop + mobile + tablet, workers 1: the 25 existing `pixel-*` without refresh, `visual-matrix`, `evidence-intercom-ops`, `evidence-wiskey-installer`, `evidence-wiskey-live-validation-2390`, `layout-settings-nav-fit-402`, `layout-settings-nav-295`, `evidence-incoming-call`, `evidence-access-s12`, `layout-access-s12`, `evidence-tts-default-2400`, `evidence-wxmedset`, `evidence-wiskey-pairing-2382`, `evidence-wiskey-triage-2400`, `evidence-wiskey-talk-dial-2382`, `evidence-wiskey-talk-caps-2382`, `evidence-settings-cards-2380`, the two new specs | runner @ 8d3d45577 | 677 passed, 479 skipped, **26 failed**: `pixel-access-s12` 6 (section 7) and `evidence-settings-cards-2380` 20 (next row) |
| `evidence-settings-cards-2380`, `spec` job (dev server), desktop + mobile + tablet | runner @ 4eef8bb70 | **20 passed, 4 skipped** - its 20 `preview` failures are the known preview-only ones (RELEASE-2400-TRAIN 2.5), not this change |
| Final, `preview` **without** refresh, desktop + mobile + tablet, workers 1: `pixel-access-s12`, `pixel-settings-intercom-cards-2401`, `visual-matrix`, `layout-settings-nav-fit-402`, `layout-settings-nav-295`, `layout-` / `evidence-settings-intercom-cards-2401`, `evidence-access-s12`, `layout-access-s12`, `evidence-tts-default-2400`, `evidence-incoming-call`, `evidence-wiskey-pairing-2382`, `evidence-wiskey-triage-2400`, `evidence-wxmedset` | runner @ 4eef8bb70 | **236 passed, 124 skipped, 0 failed** |
| `scripts/release_check.py` | workstation @ 97466f793 / @ 4eef8bb70 | before the main merge every item `[ok]` but the tag; after it every item `[ok]` (one version 2.40.0, tag `v2.40.0` exists, migrations 205); RESULT: ready |

Runner: before every job `gate_status.json` was read and `pgrep release_gate` checked. A 2.40.0 re-gate started at 18:51 local while
this branch waited; no job of this branch ran until it had ended (`pass`). Jobs of the other agents (wall toolbar) ran beside these.

New specs: `unit-settings-intercom-cards-2401` (layout values, card ids, which card opens, remembered card per user incl. a storage
that throws, summaries, the event, the wiring of every existing hook), `test_settings_intercom_cards_2401.py` (default, round trip +
audit, refusals, admin-only, corrupt value), `layout-settings-intercom-cards-2401` (fit per card at 1440x900 / 1366x768; the phone:
no sideways scroll, 44 px headers, open / fold), `evidence-settings-intercom-cards-2401` (headers and summaries, one open, remembered
after reload, `&card=`, `?tab=access-voice`, the controls saved from their cards, a -> b -> c -> a through the layout row, read-only
for a viewer without `system.configure`), `pixel-settings-intercom-cards-2401` (new baselines, section 7).

Existing specs: `tests/access-control-mocks.ts` now serves `access.settings_layout = list`, so the specs written before this change keep
driving the single list they describe (their selectors, counts and baselines unchanged); `evidence-incoming-call` reaches the call
banner through `&card=calls` (its mock has no layout key, so it sees the default cards).

## 7. Pixel baselines (runner, `preview`, workers 1, Linux)

- **Re-taken, `pixel-access-s12` (11 PNG, `96927ac7d`):** classic / domus display and parity 1440 / 390, classic parity-operator
  1440 / 390, classic checklist 390. These specs drive layout c (the mock pins it); their cards are one row lower because of the new
  layout row in the switches card. Old vs new, compared by script (pixels differing by more than 16 levels, bounding box) and by eye on
  old / new / difference sheets: same content and size (two domus parity images 1 px shorter); the differences are glyph anti-aliasing
  at the new sub-pixel offset (261 to 11 621 px; the domus display card the most). Only this tab's images changed: the 25 other pixel
  specs and `visual-matrix` passed without refresh.
- **New, `pixel-settings-intercom-cards-2401` (5 PNG, `ba4569d79` and `4eef8bb70`):** `cards-screens-1440`, `cards-announce-1440`,
  `cards-display-1366` (desktop), `cards-screens-390` (phone), `tabs-voice-1440` (layout b). Looked at: the header column at the start
  side, the open header tinted, the open card beside it, the settings column marking "מתגי מסכי כניסה" (also on the voice tab - the
  first take showed a search entry as an extra indented row and "מראה ותצוגה" marked; both fixed before the re-take).
- The `.tmp_*` folder of this branch's runner worktree was removed (388 MB); other branches' folders were not touched.

## 8. NOT_RUN

- The full unit sweep (all `tests/unit-*.spec.ts`), the full backend suite, the release gate, `build:addon`.
- Windows pixel baselines; the tablet project of the new pixel spec (desktop and phone only, by design).
- Layout a in the other skins (domus, tesla, crystal, infra, soft) and dark: the fit was measured in classic light only.
- The user guide (`docs/user-guide/he/80-settings_HE.md`) does not describe the cards / the layout row yet.
- Any lab, Home Assistant, WisKey or station contact (none allowed).

## 9. Rollback

Set "סידור הלשונית" to "רשימה אחת" (or `PATCH /settings {"access.settings_layout": "list"}`): the tab is the 2.40.0 list again (+ the
layout row). Code rollback: revert the branch's commits; the stored key is then ignored (unknown keys are not read).
