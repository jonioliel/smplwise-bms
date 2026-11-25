# I18N-RUNTIME-ERRORS-2520 - run-time refusal texts in English; the service worker's own words in the user's language

Branch `pilot/I18N-RUNTIME-ERRORS-2520`, cut from `pilot/I18N-REST-2520` (`f493b96a9`). Target 2.52.0.

Spec (lead, 25.11; owner rule: unanswered = the recommendation - I18N-REST-2520 open questions 2 and 4, option a):
1. the 257 refusal messages built at run time (names / numbers inside the sentence) were Hebrew only for an English user: turn them,
   module by module, into a template form `smplwise/error_text.py` renders in English; Hebrew output byte for byte unchanged; lower the
   ratchet `docs/i18n/BE_ERRORS_EN_RATCHET.json` as far as possible (aim 0);
2. the service worker's push action labels and offline page: a small Hebrew / English table chosen by the user's language.
Avoid the files of the 2.52 WisKey rows; list the overlaps.

## 1. Result in numbers

| measure (`py -3.12 scripts/i18n_backend_errors.py`) | before (`f493b96a9`) | after |
| --- | ---: | ---: |
| run-time (f-string) Hebrew refusal texts | **257** in 101 modules | **3** in 2 modules (the WisKey rows' files, section 4) |
| run-time templates `tpl()` with English | - | 231 distinct / 256 sites in 99 modules |
| constant Hebrew refusal texts with English | 2,304 / 3,429 sites, 0 missing | unchanged, 0 missing |
| fixed product words passed into the templates, with English (`words`) | - | 179 |

## 2. Backend: `tpl()` - a Hebrew template, its params, an English template

`smplwise/error_text.py` gains `Tpl` (a `Msg`, smplwise/i18n.py) and `tpl(template, **params)`:
- **Hebrew unchanged.** The value of `tpl("עד {limit} תווים.", limit=40)` is the Hebrew template filled with the params, each param
  formatted as the f-string formatted it (`format(value, "")`; a format spec such as `{lo:g}` became the param `format(lo, "g")`). So
  every log line, audit detail, test literal and Hebrew answer sees exactly the bytes the f-string gave. Checked for all 254 rewritten
  sites by evaluating the old f-string and the new `tpl()` with the same sample values (Hebrew text, numbers, a float, a value holding
  braces): 254 / 254 equal (scratch check, not committed; the property is pinned by the new test file).
- **English.** `smplwise/error_text_tpl_en.json`: `"templates"` {Hebrew template: English template} and `"words"` {Hebrew: English}.
  `Tpl.render("en")` fills the English template; each param is rendered on its own: a `Msg` / `Tpl` / `Lit` renders itself, a fixed
  product word (an operation's name - "שמירת לוח הזמנים", a bill state, a weekday, a WisKey reason, a settings label) is looked up in
  `"words"` and then in the constant refusal table (an earlier error's `user_message` passed on), anything else is data (a station's
  name, a number, a code) and is shown as it is. A template the table lacks answers its Hebrew (never a key, never empty).
- **Wording.** By hand, British spelling, sentence case, the glossary's words ("station", "WisKey refused", "try again in {wait}
  seconds"). Sentences that open with an operation name keep it first ("{what}: sent, but no clear answer was received ({code}). ...").
  Two places use both names: the TOU "missing price" refusal now passes the band and the season as `Lit` (their saved English name,
  else the Israeli template's, else the Hebrew); the intercom "WisKey did not confirm" fragment became a `tpl()` itself.
- **How the 254 sites were rewritten.** Mechanically (an AST rewrite: the f-string's literal text becomes the template, each `{expr}`
  a named param - `station['name']` -> `name`, `MAX_NAME` -> `max_name`, `from` -> `from_`), one `from ..error_text import tpl` per
  module (`err_tpl` in `automation_blueprints.py`, whose functions use a local `tpl`); then the English and the words by hand.
  One extra site was worded the same way: `access_control_door_tech.py` `f"{what}: {exc.user_message}"` -> `tpl("{what}: {message}")`.

`smplwise/errors.py`:
- a `Msg` inside `details` (a per-field `problems[].message`, the TOU / schedule / automation error lists, `details["ui.tabs"]`) is
  rendered in the answer's language, so an English answer never carries a Hebrew detail beside an English `user_message`; a Hebrew
  answer returns the same `details` object as before (no copy). `translatable()` is also true for such details;
- `_problems()` keeps a `Msg` message (it used to `str()` it - same Hebrew value);
- `ServiceInvalid.__str__` returns the `Msg` it was raised with (same value), so the routers that answer `str(exc)` (notices, transit,
  calendar) keep the English.

`scripts/i18n_backend_errors.py`: also reads `tpl()` / `err_tpl()` calls - a template without English, or a Hebrew literal param that is
not in `"words"`, is `missing`; a Hebrew f-string passed as a `tpl()` param counts as run-time. The ratchet file was lowered with
`--ratchet` (no raise).

## 3. Service worker (offline page, notification buttons)

- `frontend/src/pwa/offline-page.ts`: `offlineHtml(lang)` from a he / en table; `OFFLINE_HTML` (= `offlineHtml('he')`) is byte for byte
  the page before (checked with node: equal, 2,538 characters). English: `lang="en" dir="ltr"`, "No connection to the server", "Try again".
- `frontend/src/pwa/push-v2.ts`: `LABELS` {he, en} and `swLang()`; `parsePush(raw, maxActions, lang = 'he')`: Hebrew keeps the server's
  button title (the table only when the server sent none) - as before; English uses the table's English for the three known buttons
  (the server words them in Hebrew): Acknowledge, Mute for an hour, Open the door (the words of the app's English packs).
- How the worker knows the language: the app already sends the worker an `arx-context` message on every start (register.ts); it now
  carries `lang: currentUiLang()`. The worker keeps it in memory and in its meta cache (a worker started later by a push still knows
  it). Hebrew until the app has said otherwise (= today). A language change reloads the page, so the next start tells the worker.
- `sw.ts`: the offline fallback answers `offlineHtml(await workerLang())`; a push is shown with that language's buttons, `lang` set to it
  and `dir: 'auto'` for English (the server's title and body are still Hebrew - see open question 2).
- `docs/i18n/EN_RATCHET.json` kept 834 -> 837 (`--ratchet --allow-raise`, a reviewed raise): the Hebrew side of the worker's own he / en
  table is marked `i18n-keep` (the offline page used to be one Hebrew template literal, now four table entries). `MISSING_KEYS_EN.*`
  regenerated by the same run (it also picked up the `msg/devices` key count of the base branch, 919 -> 956, a stale view there).

## 4. Overlaps with the 2.52 train rows

- Not touched (their WisKey rows change the same functions): `routers/access_control_station_ops.py` (2 run-time texts in `_error`, changed
  by WISKEY-R4 and WISKEY-SCHED-READS) and `services/wiskey_visits.py` (1, in `settle`, changed by WISKEY-R6 and WISKEY-SCHED-READS).
  They are the 3 left in the ratchet. At the train merge: `tpl("{what} נכשל לפי WisKey ({code}).", ...)` etc. (the English templates
  for the station_ops pair are the same as the triage ones: add them to `error_text_tpl_en.json`), then `--ratchet`.
- Touched, another hunk: `services/settings_store.py` (WISKEY-SCHED-READS adds a default near line 424; this row changes the import
  block and `normalize_tabs`, lines ~821-852) - a plain merge.
- The WisKey rows that add new run-time refusal f-strings will fail `test_i18n_errors_en_2520` / `test_i18n_runtime_errors_2520` at the
  merge until they use `tpl()` with an English template (the intended ratchet).
- NOTIFY-RECIPIENT-LANG-2520 (another row, open question 1 of I18N-REST): if it words the push payload's button titles per recipient,
  the worker's English table stays the fallback and both say the same words.

## 5. Files

- backend: `smplwise/error_text.py`, `error_text_tpl_en.json` (new), `errors.py`; 99 modules under `smplwise/routers/` and
  `smplwise/services/` (the `tpl()` rewrite; `services/energy_tou.py` also `_both()`); `tests/test_i18n_runtime_errors_2520.py` (new).
- scripts / docs: `scripts/i18n_backend_errors.py`; `docs/i18n/BE_ERRORS_EN_RATCHET.json`, `EN_RATCHET.json`, `MISSING_KEYS_EN.md` / `.json`.
- frontend: `src/pwa/offline-page.ts`, `push-v2.ts`, `sw.ts`, `register.ts`; `tests/unit-sw-lang-2520.spec.ts` (new).

## 6. Tests (real runs)

Runner (slot B, job `p2520_i18nruntime_run2.sh`, HEAD `af5b9a3e3` = the code of this branch; 25.11 14:04-14:46 IL):

| check | command | result |
| --- | --- | --- |
| backend lint | `scripts/gate/lint_backend.py --strict` | exit 0, 0 findings |
| wire types | `scripts/gen_wire_types.py --check` | exit 0 |
| refusal-text inventory | `scripts/i18n_backend_errors.py` | exit 0: 231 templates / 256 sites, 0 without English, 3 run-time left |
| backend shard A: every test file that pins a converted Hebrew text (18) + the i18n / error-envelope / ADR-019 tests (26 files) | pytest `-m "not timing_lane"` | **641 passed** |
| backend shard B1 / B2: the test files named after the 99 changed modules (187 files, two processes) | pytest `-m "not timing_lane"` | B1 **10,571 passed**; B2 **13,853 passed, 4 skipped, 1 failed** - `test_notify_channels.py::test_rule_alerts_are_notifications_folded_and_acknowledged_both_ways` (an acknowledge-propagation check, no refusal text involved); the same file alone on the runner: **19 passed**, the test alone on the PC: passed - an order / timing flake of the mixed shard, not this change |
| frontend types | `tsc --noEmit -p tsconfig.json`; `npm run typecheck` | exit 0; exit 0 |
| eslint (5 changed files) | `eslint --pass-on-unpruned-suppressions` | 0 errors (1 "file ignored" warning: the new spec is outside the lint config, as the other unit specs) |
| unit suite | `playwright test -c playwright.unit.config.ts --workers=2` | **5,237 passed, 3 failed, 15 skipped** - the 3 are `unit-mfa-passkeys-2490` (202, 259, 285): `ERR_CONNECTION_REFUSED localhost:4173`, they need a preview server; the same 3 fail on the base branch |
| offline page captures (before he / after he / after en; desktop + phone; light + dark) | scratch spec, not committed | 12 / 12 |

PC (one file per process): `tests/test_i18n_runtime_errors_2520.py` **8 passed**; `test_i18n_errors_en_2520.py` 9 passed;
`test_i18n_backend_2490.py` 14 passed; `test_energy_tou_billing.py` 19 passed, 2 skipped; frontend `unit-sw-lang-2520` 3 passed,
`unit-notify-center` 20 passed, `unit-i18n-en-ratchet-2490` 6 passed. Scratch checks: the 254 rewritten sites, old f-string vs `tpl()`
with the same sample values: 254 / 254 equal; `OFFLINE_HTML` before / after: equal (node).

An earlier runner job that ran the WHOLE backend suite in 9 single-process shards was stopped by me after 20 minutes (about 5 % of the
first shard: the suite is ~7 h of CPU in one process each) and replaced by the targeted job above.

NOT_RUN: the rest of the backend suite (~860 test files that neither pin a converted text nor are named after a changed module), the
pixel suite (no Hebrew screen changed: the offline page's Hebrew is the same string; there is no English pixel baseline), the release
gate, any browser check of a real push notification (a system notification cannot be captured; the buttons are covered by the unit spec),
a live check against a real backend in English. No lab.

Compare page (Hebrew, local): `private/planning/i18n-runtime-errors-2520_compare_2026-11-25.html` (12 sample refusals Hebrew / English,
the three buttons, the offline page before / after in both schemes on desktop and phone).

## 7. Open questions (recommendation first)

1. The 3 run-time texts in the WisKey rows' files. (a) convert them at the 2.52 train merge (section 4); (b) a follow-up row after 2.52.
2. A push notification's title and body are still the server's Hebrew for an English user (only the buttons follow the language).
   (a) the server renders each delivery in the recipient's `ui.lang` (NOTIFY-RECIPIENT-LANG-2520, if that row covers push); (b) keep.
3. Hebrew f-strings that build a message outside an error call (a variable built first, then raised) are not counted by the inventory.
   (a) leave for now - the count of direct refusals is 0 outside the WisKey files; widen the inventory in a later row; (b) widen it now.
