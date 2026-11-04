# SETTINGS-CARDS-ACCORDION-2402 — "כרטיסים: נפתחים במקום" (the classic accordion) as an option of the intercom settings cards

Branch `pilot/SETTINGS-CARDS-ACCORDION-2402`, cut from `origin/release/2401-train` at `604305354` (the 2.40.1 version commit, which holds
the SETTINGS-INTERCOM-CARDS-2401 merge). Ships with 2.40.2. No merge, no version bump, no changelog entry, no UI rebuild, no tag. No
lab, Home Assistant, WisKey or station contact: every test runs against mocks / fakes.

## 1. The decision

Owner 04.11 night, round 20 Q2 = **a**: keep the 2401 desktop design (the header column with the open card beside it) as the default,
and add a Settings option for the classic accordion on a desktop - cards open in place, one at a time; on a short screen the settings
content then scrolls (accepted by the owner for this option). The phone does not change.

## 2. One more value, not a sub-setting - why

`access.settings_layout` gains a fourth value: `cards` (default) | **`accordion`** | `tabs` | `list`.

- The four are one choice (exactly one layout applies), so they are one select, as the owner's own labels read
  ("כרטיסים: כותרות בצד (ברירת מחדל)" / "כרטיסים: נפתחים במקום"). A sub-setting would need a second row that appears and disappears
  with the first select, and a stored value that means nothing in two of the three layouts.
- It follows the pattern of the neighbouring display keys (one enumerated key, validated by a pattern, one row). Stored values keep
  their meaning; old clients that do not know `accordion` read it as the default (`parseAccessLayout`), never a broken page.
- Server (`routers/settings.py`): pattern `^(cards|accordion|tabs|list)$`, `system.configure`, audited as every product setting; a
  corrupt stored value still reads as `cards`; the default is unchanged.

Labels (the select of the row "סידור הלשונית", card "אזור WisKey והטמעה" in a / the first card in b and c):
"כרטיסים: כותרות בצד (ברירת מחדל)" · "כרטיסים: נפתחים במקום" · "שתי לשוניות" · "רשימה אחת". The default mark is in the select only; the
card's summary line names the layout without it ("... · כרטיסים: נפתחים במקום"). The row's hint now says both card kinds in the same
length as before: "כרטיס אחד פתוח בכל פעם, לצד הכותרות או מתחת לכותרת · שתי לשוניות: ... · רשימה אחת: ...".

## 3. What it draws

`components/sw-fold-cards.ts` gets `inplace` (reflected): it never takes the wide arrangement, so the open card unfolds right under its
header at every width (the same DOM and styles as the narrow arrangement 2401 already used on phones and tablets), and the open card is
never given a height of its own (no inner scroll; the page scrolls vertically when the card is taller than the window, never sideways).
A second press folds the open card; all may be closed (the host passes `wide = false` for accordion). The open card is remembered per
user as in 2401; `&card=` links and `?tab=access-voice` work the same. When a long card above folds and moves the pressed header, the
header is scrolled back into view (`block: 'nearest'`, in place only). On a desktop the accordion column is 880 px wide (the list's
width). Layouts cards / tabs / list are unchanged; the phone draws the same stacked cards in cards and in accordion.

## 4. Measured (runner, `layout-settings-cards-accordion-2402` @ `fba3fea83`)

Each card opened in turn (admin persona, every card's real content): the card starts under its header and ends above the next header,
in the one column; one card open; sideways overflow of the document, the shell's main, the cards and the open card all 0. Vertical page
scroll (allowed in this layout), px:

| Card | 1440x900 | 1366x768 |
|---|---|---|
| screens | 275 | 407 |
| area | 272 | 404 |
| display | 74 | 206 |
| announce | 278 | 410 |
| calls | 130 | 262 |
| parity | 0 | 77 |
| checklist | 192 | 324 |
| pairing | 271 | 403 |
| diagnostics | 0 | 5 |

The default layout (cards) keeps its 2401 fit: `layout-settings-intercom-cards-2401` passed again at both sizes on this branch.

## 5. Tests

| Check | Where / SHA | Result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` (src + tests) | workstation @ 52931c73a and the final head | exit 0 |
| Unit `unit-settings-cards-accordion-2402` (new, 5) + `unit-settings-intercom-cards-2401` (follows the new labels and value) + `unit-settings-index` + source lints (tokens, a11y, RTL, menu, empty-state icons) | workstation @ fba3fea83 | **67 passed** |
| Unit `unit-settings-cards-accordion-2402` + `unit-settings-intercom-cards-2401` | workstation @ 52931c73a | **20 passed** |
| Backend `test_settings_cards_accordion_2402` (new, 5) + `test_settings_intercom_cards_2401` + `test_ui_settings` | workstation, project `.venv` | **28 passed** |
| Backend, the same + `test_ui_tabs_config`, `test_intercom_authority`, `test_remote_hardening` | workstation, project `.venv` @ the final head | **72 passed** |
| `layout-settings-cards-accordion-2402` (new) + `layout-` / `evidence-settings-intercom-cards-2401`, desktop + mobile (`spec`) | runner @ fba3fea83 | **15 passed, 9 skipped** (project-scoped) |
| Baselines, `preview`, desktop + mobile, workers 1, `--update-snapshots=changed`: `pixel-settings-cards-accordion-2402`, `pixel-settings-intercom-cards-2401`, `pixel-access-s12` | runner @ 52931c73a | 14 passed; **1 PNG written** (the new `accordion-display-1366`); no existing image rewritten |
| Final, `preview` **without** refresh, desktop + mobile + tablet, workers 1: the three pixel specs, `visual-matrix`, `layout-settings-cards-accordion-2402`, `layout-` / `evidence-settings-intercom-cards-2401`, `layout-settings-nav-fit-402`, `evidence-access-s12`, `evidence-tts-default-2400`, `evidence-incoming-call` | runner @ cf351064a | **184 passed, 80 skipped, 0 failed** |
| `scripts/release_check.py` | workstation @ the final head | every item `[ok]` (one version 2.40.1, tag `v2.40.1` exists); RESULT: ready |

New specs: `unit-settings-cards-accordion-2402`, `test_settings_cards_accordion_2402.py` (default still cards, round trip + audit,
the other three still accepted, near misses refused, admin only, stored accordion reads back, corrupt value -> cards),
`layout-settings-cards-accordion-2402` (per card at 1440x900 / 1366x768: in place, one open, never sideways; second press folds; the
layout row cards -> accordion -> cards; on the phone accordion == cards), `pixel-settings-cards-accordion-2402` (one new baseline).

Baselines: only the new `accordion-display-1366-desktop-linux.png` (looked at: one 880 px column, the display card open under its tinted
header, the next headers below it). The 2401 card images (whose area-card summary line carries the layout's name) stayed within the
specs' 40-pixel tolerance with the new label, so --update-snapshots=changed rewrote none of them (and the no-refresh run passed).

Runner: `gate_status.json` and `pgrep release_gate` checked before every job; the 2.40.1 targeted gate (`0e8c3109b`) had ended (`pass`)
before the first job of this branch. A `backend` job of this branch that this agent did not start ran once on the runner; the next job of this
branch waited until it had ended. `.tmp_*` of this branch's runner worktree removed (950 MB).

## 6. NOT_RUN

- The full unit sweep, the full backend suite, the release gate, `build:addon`; Windows pixel baselines.
- The accordion in the other skins and in dark (classic light only).
- The user guide does not describe the layout row yet (as after 2401).
- `release/2401-train` moved on after `604305354` (`5e86c569f`, `d6e20460f`, `c74d32ec6` - the last renames the 2401 pixel spec's test
  titles); not merged here, as instructed. `c74d32ec6` touches `pixel-settings-intercom-cards-2401.spec.ts`, which this branch does not edit.
- Any lab, Home Assistant, WisKey or station contact (none allowed).

## 7. Rollback

Choose another layout in "סידור הלשונית" (or `PATCH /settings {"access.settings_layout": "cards"}`). Code rollback: revert the branch; a
stored `accordion` then reads as `cards`.
