# CR-I18N-CONFIRM-WORDS-2442 - the typed confirmation words: Hebrew or the fixed English word

Branch `pilot/CR-I18N-CONFIRM-WORDS-2442`, based on `origin/pilot/CR-I18N-COMBINED-B-2442` (4f1c8988f; `main` 2.43.7 is contained).
Owner decision 17.11 on question 1 of `docs/changes/CR-I18N-API-2442.md` (option b, the recommendation): the words an operator
types before a dangerous action were compared by the server in Hebrew only, so an operator of the English interface had to type
Hebrew. The server now accepts the English word too, and each interface language shows its own word.

## The rule

A check of a typed word accepts exactly one of two texts:

- the **Hebrew word**, compared exactly as that check compared it before this change (the surrounding white space removed; the
  installer writes also fold inner white space and Unicode form, the managed-install switches compare in NFC - both as before);
- its **one fixed English counterpart**: the surrounding white space removed, ASCII only, letter case ignored.

Nothing else: no partial match, no inner-space folding of the English word, no Unicode case folding (a text with a non-ASCII
character is never the English word), no synonym, no other action's word. A missing, empty or non-text value is refused as before.

## One table

`smplwise_vms/backend/smplwise/services/confirm_words.py` (new) holds every word: `WORDS[key] = (Hebrew, English)`, and
`typed_lang(key, typed)` answers `"he"`, `"en"` or `None`. The module checks its own table when it is imported (the English is
lower-case ASCII letters with single spaces; the Hebrew holds no ASCII letter, so the two can never be confused; one Hebrew word
never has two English words). Every router / service constant that held a word (`SAVE_WORD`, `REMOVE_WORD`,
`ALLOW_DISARM_WORD`, `LOCAL_PURGE_WORD`, `LOOKUP_WIDE_WORD`, `PULSE_PHRASE`, `REINIT_WORD`, `CONFIRM_WORD`, `GONE_WORD`,
`REVOKE_ALL_WORD` x2, `DELETE_WORD`, `PHRASES`, `ADOPT_PHRASE`, the installer `typed_word`s, the door-code template) now reads
it from the table; no router keeps a copy (tested: no string constant of the backend outside the table equals a word, and the
old comparison shape `.strip() != X_WORD` is gone).

The frontend carries the same table in `frontend/src/i18n/confirm-words.ts` (a unit spec reads the Python file and compares keys,
words and order).

## The actions (22 words, every server check of a typed word that is a fixed word)

The task named five; the search of the backend (the Hebrew words, `confirm`, `typed`, `phrase`) found seventeen more of the same
kind. All of them go through the table, because a second, Hebrew-only family of words would have left the English operator
exactly where the owner decision found him.

| # | Action (route) | Hebrew | English | Audit row that records `confirm_word` |
|---|---|---|---|---|
| 1 | Save an NVR connection whose test could not reach the NVR (`PUT /nvr/connection`, `POST /recorders`, `PUT /recorders/{id}/connection` - one shared check) | שמור | save | `nvr.connection.update` |
| 2 | Remove the NVR / a recorder (`DELETE /nvr/connection`, `DELETE /recorders/{id}`) | הסר | remove | `nvr.connection.remove`, `nvr.recorder.remove` |
| 3 | Allow scheduled alarm disarming (`PATCH /settings`, `schedules.allow_disarm` -> true) | אפשר נטרול | allow disarm | `schedules.allow_disarm` |
| 4 | Switch the irreversible purge of local users on (`PATCH /settings`, `privacy.local_purge` -> on) | מחיקה לצמיתות | delete permanently | `privacy.local_purge.setting` |
| 5 | Widen the lookup of old intercom actions to audit readers (`PUT /access/capture-lease/settings`) | הרחב בירור | widen lookup | `settings.changed` |
| 6 | Installer wizard, the step that pulses the door relay (`POST .../installer/onboarding/{flow}/steps/mapping`) | פתיחת דלת לבדיקה | open door for test | `intercom.installer.onboarding_step` |
| 7 | Installer: set the host's time server (`POST .../installer/clock/host-apply`) | שעון השרת | server clock | `intercom.installer.clock_host_apply` |
| 8 | Installer: reveal the webhook signing key (`POST .../installer/platform/webhook/key`) | הצגת המפתח | show key | `intercom.installer.platform_webhook_key` |
| 9 | Installer: apply an imported configuration (`POST .../platform/import/apply`) | ייבוא תצורה | import configuration | `intercom.installer.platform_import_apply` |
| 10 | Installer: delete event records (`POST .../platform/retention/apply`) | מחיקת אירועים | delete events | `intercom.installer.platform_retention_apply` |
| 11 | Installer: apply a fleet change to the stations (`POST .../platform/config/apply`) | החלה על העמדות | apply to stations | `intercom.installer.platform_config_apply` |
| 12 | Installer: queue a maintenance write (`POST .../platform/maintenance/enqueue`) | תזמון תחזוקה | schedule maintenance | `intercom.installer.platform_maintenance_enqueue` |
| 13 | Re-initialise the WisKey write lineage (`POST .../wiskey-lineage/reinitialise`) | אתחול | reinitialise | `wiskey.lineage.reinitialise` |
| 14 | Approve a relay map that touches a door with a door automation (`PUT` relay map) | אשר | confirm | `wiskey.relay_map.approved` |
| 15 | External access: close a revocation by manual confirmation (`POST /access-grants/{id}/confirm-gone`) | נמחק | deleted | `access.grant.confirm_gone` |
| 16 | External access: revoke all (`POST /access-grants/revoke-all`) | בטל הכל | revoke all | `access.grant.revoke_all` |
| 17 | External access: delete the person Arx created (`POST /access-grants/links/{id}/delete-person`) | מחק | delete | `access.person_link.delete` |
| 18 | Visitors: revoke all (`POST /access/visitors/revoke-all`) | בטל מבקרים | revoke visitors | `access.visitor.revoke_all` |
| 19 | WisKey managed install: the managed switch and the start-up switch (`PUT /wiskey/managed/switch`) | מאשר ניהול התקנה | approve managed install | `settings.changed` |
| 20 | WisKey managed install: the accepted Core-image risk (same route) | מאשר סיכון סביבה | approve environment risk | `settings.changed` |
| 21 | WisKey managed install: adoption (`POST /wiskey/managed/adopt`) | מאשר העברה לניהול | approve move to managed | `wiskey.managed.adopt` |
| 22 | Write a public door code (`POST /access-control/stations/{id}/codes/{slot}`) | קוד {slot} | code {slot} | the code write's own audit action |

**Not changed, on purpose** (they are not words of a language): what the operator types is DATA the screen shows - a station's
name (installer station sync / door relay inversion / lifecycle apply and remove, the acceptance-test door pulse), a user name
(HA user removal), a count (bulk people, ticket deletion), an employee number, a door name. The installer check takes the
English counterpart only when the expected text is the operation's own fixed phrase; a station that happens to be named like a
word gets no English alternative (tested). The backup / restart confirmations (`RESTORE`, `EXPORT`, `ROTATE`, `RESTART`) were
ASCII already and are untouched.

## The audit row

Each allowed row of the table above carries `confirm_word: "he"` or `"en"` - which of the two words was typed. The typed text
itself is still never stored (the existing "never stored" assertions stay; the new tests assert it for the English word too).
Where the word is not asked (a tested NVR save, a switch turned off, a relay-map change that touches no automated door, a
narrower lookup scope) the row has no `confirm_word`. Denied rows are as they were.

Design note for the lead: "records which word was typed" is implemented as the language of the accepted word, not the text. The
word of a language is fixed, so `"en"` names it exactly, and the rule "the typed confirmation is never stored" (tests since
REL2140 / owner 2026-10-04) stays true.

## Frontend

- `src/i18n/confirm-words.ts` (new): `confirmWord(key)` - the word to show (English interface: the English word; Hebrew and every
  other language: the Hebrew word, the fallback of every catalogue); `confirmWordMatches` / `confirmWordTyped` - the server's
  rule, so the confirm button enables for either word in either interface; `shownConfirmWord` / `serverWordMatches` - for a word
  the server sends in its view (relay map `confirm_word`, installer `typed` / `host_typed_phrase`, managed-install `phrases`, the
  door-code template): shown in the interface language, compared by the same rule; a text that is not a fixed word (a station's
  name) is shown and compared as it is.
- The screens show the interface's word and **send what the operator typed** (the NVR form and "revoke all" used to send the
  Hebrew constant whatever was typed): `nvr-connection-form`, `system-lookup-scope`, `system-schedules` (+ the demo store
  `schedules-mock`), `access-external` (confirmed gone, revoke all), `identity-card` (delete person), `wiskey-relay-map`,
  `system-security-wiskey-managed`, `wk-door-tech`, `wk-installer-confirm` (new request field `typedFixed`, set by the installer
  clock / lifecycle / platform screens for their fixed phrases; a station's name is unchanged).
- The five api constants (`SAVE_WORD`, `REMOVE_WORD`, `ALLOW_DISARM_WORD`, `LOOKUP_WIDE_WORD`, `PULSE_PHRASE`) stay exported and
  read the Hebrew word from the table; the Hebrew literals left `src/api/`, so the four `TYPED` entries of the api lint
  (`tests/unit-i18n-api-2442.spec.ts`) were removed (the lint's own self-test now uses the `tts-default.ts` entry).
- One word that only the browser compares - the calendar "delete all guest details" confirmation ("מחיקה", setting
  `purge_confirm = type_word`) - follows the same rule from a separate small table (`CLIENT_CONFIRM_WORDS`: "delete"), so the
  English sentence no longer asks for a Hebrew word. The two sentences in `src/i18n/msg/system-a.ts` became `{word}` templates.
- Hebrew screens are unchanged: the same word is shown, and the Hebrew word is accepted as before.
- Server error sentences (`user_message`) still name the Hebrew word in every language, as every server text does (the known
  rule of the CAL-ELEC / API notes); the screens' own prompt is what the operator reads before typing.
- Not used any more, left in place: the catalogue keys `gone_word` / `del_word` of `src/i18n/access-external.ts` (four language
  tables).
- No screen exists yet for words 4, 13 and 18 (local purge, lineage re-initialise, revoke all visitors): backend only.

## Security review - the guard of each action is not weakened beyond the one English word

What was checked for every action of the table (code read + the tests named below):

1. **The comparison.** Before: `typed.strip() == HEBREW` (installer: white space folded + NFC; managed install: trimmed + NFC,
   at most 200 characters). After: the same comparison for the Hebrew word, OR `typed.strip()` is ASCII and its lower case
   equals the one English word of that action. The accepted set grew by exactly the case variants of one ASCII word (with
   surrounding white space). Refused, by test, for every action: a wrong word, the English word with one letter more / less,
   with punctuation, in full-width letters, with Cyrillic look-alike letters, with no / two / hyphenated inner space, the Hebrew
   word cut, both words together, another action's word in either language; and for the matcher itself: a non-ASCII letter that
   upper-cases into ASCII (U+017F), a dotless i, a tab or a no-break space instead of the space, and every non-text value.
2. **The order and the other conditions are untouched.** The typed word was never the only guard, and nothing else moved:
   - 1: `save_untested` is still required, only `source_unavailable` / `timeout` may be saved untested (bad credentials and a
     refused host never - tested with the English word), `nvr.configure` at the installation, the revision check after the probe.
   - 2: `nvr.configure`, `if_revision`.
   - 3, 4: a system administrator only (denied row as before); 4 additionally local channel only; the stop direction (false /
     off) needs no word.
   - 5: `system.configure` + system administrator (tested: the English word from a site administrator is 403); the word is
     asked only when the scope actually widens.
   - 6-12: the installer gate, `confirmed: true`, the envelope (expiry, duplicate), the rate limits and - for 9-12 - the review
     id are all checked as before; a refused phrase sends nothing to WisKey (tested per operation).
   - 13: system administrator, interactive session.
   - 14: `confirmed: true`, the revision, the validation; the word is asked only for an automated door.
   - 15: system administrator, interactive, the three checks, the reference, the grant state (tested with the English word).
   - 16, 18: system administrator (tested with the English word for 16). 17: the grant permission + `people.manage`, origin.
   - 19-21: system administrator; the dependent switches still need the managed switch; each switch takes only ITS phrase in
     either language (tested: the other phrase in English is refused).
   - 22: the door-admin gate, the envelope, the station / door / code-value rules, the cooldown; the phrase names the slot in
     both languages ("code 2" does not confirm slot 3).
3. **Station names are not widened.** The installer accepts the English counterpart only when the expected text is the
   operation's own fixed phrase (`expected == op.typed_word`); the station-scoped operations have no fixed phrase.
4. **Nothing new is stored or returned.** No response shape changed. The audit detail is the two-letter language code. The
   typed text is not logged, stored or echoed (unchanged).
5. **Brute force.** The space of accepted texts is public in both languages (the screen prints the word); the word is a
   deliberate-action check, not a secret, so a second public word changes nothing about guessing.

## Existing tests changed (the behaviour is intended, the test was stale)

- Four tests used a text that is now the English word as their WRONG word; they send another wrong word now:
  `test_nvr_connection.py::test_an_unreachable_nvr_is_saved_only_with_the_typed_confirmation` ("save" -> "yes"),
  `test_nvr_connection.py::test_vendor_change_with_cameras_needs_remove_first` and
  `test_multi_nvr.py::test_removing_a_recorder_keeps_its_history_...` ("remove" -> "delete"),
  `test_wiskey_door_tech.py::test_a_code_needs_the_typed_confirmation_and_valid_digits` ("code 2" for slot 2 -> "code 3", "code2").
- Four tests pinned the exact audit details of an allowed row; they now expect `confirm_word: "he"` too:
  `test_lookup_scope.py::test_n15_wider_value_needs_the_confirmation_word_and_is_audited_before_after`,
  `test_schedules_more_actions.py::test_disarm_is_allowed_by_default_and_a_system_administrator_may_restrict_it`,
  `test_wiskey_managed_install_2382.py::test_on_with_the_phrase_is_written_audited_and_installs_nothing`,
  `test_wiskey_install_answers_2400.py::test_the_startup_switch_needs_the_managed_switch_and_its_phrase_and_goes_off_with_it`.
- `frontend/tests/unit-i18n-api-2442.spec.ts`: the four `TYPED` entries of the kept-Hebrew list are gone with the literals (the
  list only shrinks), and the lint's self-test uses the `tts-default.ts` entry instead of `nvr-connection.ts`.
- Seen, not from this branch, not changed: `test_wiskey_door_tech.py::test_a_code_needs_the_typed_confirmation_and_valid_digits`
  failed once on `assert bad not in r.text` with `bad = "12"` - the two digits were inside the random correlation id of the
  answer. It passed on the next run. A flaky assertion of the existing test (about one run in a few dozen); it needs a ticket.

## Tests actually run (workstation)

Backend (`.venv` Python 3.12, `pytest -p no:xdist`; the workstation was shared with other agents, so the runs were slow):

- `tests/test_confirm_words_2442.py` (new): **50 passed** - the table, the matcher for every key (both words accepted, a wrong
  word and 9-13 near-misses per key refused, non-text values), the ASCII-only rule, the door-code slot, the kept Hebrew
  comparison of the installer, "no copy of a word outside the table", "every check goes through the table".
- The per-action tests (`-k cw2442`, added beside each action's own tests in 15 files; each runs for Hebrew and for English: a
  wrong word and the near-misses refused with nothing written or sent, then the word accepted and `confirm_word` in the audit
  row): **50 selected, 50 passed** (46 on the first run; 4 failed on the test's own setup - the NVR test hit the connection-test
  rate limit, the door-code test compared the whole error details - fixed and rerun: 7 passed for those two files).
- The existing tests of the same actions, selected by name in the 24 files that touch them (`-k "confirm or typed or word or
  phrase or remov or untested or disarm or purge or gone or revoke or delete_now or adopt or switch or reinit or code or wider
  or host_apply or pulse or webhook or import or retention or fleet or maintenance or automated or close_route or exact or
  phrases"`, with the new tests): 287 selected - **284 passed, 3 failed**; the three (two stale audit assertions, one flaky
  existing assertion - see above) were rerun after the fix together with the table tests: **53 passed, 0 failed**.
- `python -m compileall` of `smplwise/`: clean. `import smplwise.main`: ok.

Frontend (Node 24, `--workers=1`):

- `npx tsc --noEmit`: clean on the final tree.
- Playwright unit config: `tests/unit-confirm-words-2442.spec.ts` (new, 7 cases) with the 22 other unit specs that import a changed
  module and `unit-access-external` (the api lint and its completeness cases, the i18n core / registry specs, schedules,
  door-tech, installer, managed install, relay map): **252 passed, 0 failed** on the final tree. (An earlier run of the set had
  one failure, `unit-i18n-core` "every catalogue module registers its tables": the new module now registers both tables.)
- `npx vite build`, then the main config on a private preview port (4347), `--project=desktop`, the browser specs of the
  changed dialogs in Hebrew: `evidence-nvr-connection`, `evidence-wiskey-managed-2382`, `evidence-wiskey-installer`,
  `evidence-calendars-settings-2310`: **89 passed, 9 skipped (declared by the specs), 0 failed**; `evidence-sharedid-293`,
  `evidence-wiskey-door-tech`, `evidence-schedules-list`: **56 passed, 0 failed**. The regenerated evidence images were
  discarded, `dist/` deleted.
- `node scripts/i18n_missing_keys.mjs` (no `--write`): 145 catalogues, 28,196 keys, 20 missing (unchanged); hard-coded Hebrew
  outside the catalogues 4,660 literals.

## NOT_RUN

- Backend: the other 407 tests of those 24 files and the rest of the backend suite; ruff / pyflakes (not installed in the
  workstation environment). No runner job and no entry check (the task said so).
- Frontend: the whole node unit set (only the 24 unit specs above); tablet and mobile projects; every pixel suite; the other
  evidence / layout suites; the page unit specs (`SW_UNIT_PAGES=1`).
- **The English screens were not opened in a browser**: the English word in each dialog is proven by the unit spec (the word
  per language, the matcher, the sources of the screens), not by a browser run. The browser specs above run in Hebrew.
- `docs/i18n/MISSING_KEYS_EN.md` / `.json` were not regenerated.
- No lab or device access.

## Pixels to refresh

None expected: Hebrew screens show the same words. In English the prompt shows the English word (no English baselines exist).

## Owner questions

1. The English words are a first choice (table above). Any of them to change before release? They are one line each in the
   two tables.
   a. Keep them. (recommended)
   b. Change specific words (name them).
