# NOTIFY-LANG-SENDERS-2520 - the senders around the notification pipeline speak the recipient's language

Branch `pilot/NOTIFY-LANG-SENDERS-2520`, cut from `origin/pilot/NOTIFY-RECIPIENT-LANG-2520` (`7b55e0e76`). Target 2.52.0. Answers open
question 3 of `NOTIFY-RECIPIENT-LANG-2520.md` with its recommendation (a): each sender outside the main delivery path, users first, with the
same helper (`services/notify_delivery_lang.py`) and the same template approach.

## What

The four senders the base row listed, found and handled:

| sender | where | before | now |
| --- | --- | --- | --- |
| notice-board push | `services/notices/push.py` | already a source of the pipeline (`notice.published`) | **no code change needed**: since the base row the push / phone app / centre carry the fixed words (severity, "new notification", action buttons, resolve text "Notice removed from the board") in each recipient's language. The notice's title and body are what the author wrote - data, never translated (notices have no English version). A test now proves it end to end. |
| calendar attendee notices - Arx users / residents with an account (in app, push, phone app) | `services/calendar/attendee_notices._inapp` | English reader: "Invitation to an event" + `ישיבת ועד · יום ג׳ 03.11 12:00–13:00` (the day and time were Hebrew params) | English reader: `ישיבת ועד · Tue 03.11 12:00–13:00` (and "· recurring"). The row's stored Hebrew title and body are unchanged. |
| calendar attendee notices - residents without an account, external guests (WhatsApp today; SMS / e-mail plug in later) | `attendee_notices.message_text` / `dispatch` | Hebrew only | a resident gets his directory language (`ticket_contacts.lang`, the one tickets and visitor messages already use) when Arx offers it (he / en); a guest gets Hebrew - the invitation records no language (the guest form takes name, phone, e-mail), and the code takes a recorded one if a later row adds it. Any other value (ar, ru, none, unreadable) = Hebrew. |
| insights monthly report (e-mail / WhatsApp) | `services/insights_delivery.py` | one language for everyone, chosen by the administrator (he / en); an English mail still had the Hebrew footer, right-to-left marks and a right-to-left page | the language setting gets a third value **"each recipient's language"** (`recipient`): a WhatsApp recipient's `ui.lang`, an e-mail address's the language of the Arx user(s) whose own e-mail it is (`address_langs`, as the notification e-mail); decided when the month is planned and kept on the send row. Default stays `he` (today's behaviour). An English report mail is now English through and through (English footer, no RTL marks, `dir="ltr"`). |
| electricity bill draft | `services/energy_notify.py` | already a source of the pipeline (`energy.bill_draft`) with English templates; the period (`09/2026`) is language-free | **no code change needed** (test added). No other energy sender exists (the bills themselves are not sent by Arx). |

Unchanged on purpose: WhatsApp templates of the notification channel (`services/notify_whatsapp.py`), speaker announcements, the calendar
organizer notices (`services/calendar/notices.py`: no channel is registered and they carry no text), Hebrew output.

### The mechanism for a wording param (`notify_policy.I18N_PARAM`)

The pipeline stores a row's Hebrew title / body and its params; an English recipient gets the source's English templates rendered from the
same params (base row). A param that is *wording* rather than a name - the calendar's day and time - would stay Hebrew inside an English
sentence. New reserved param `_i18n` = `{lang: {param: value}}`: `render(source, params, "en")` replaces those params with their English
values, only when the source has English templates (never an English value inside a Hebrew sentence) and only for a param the signal has.
The Hebrew render never reads it, so the stored row, the Hebrew push / mail / centre and `note_in`'s guard are as before. Params are not on
the wire (not in any API answer). Only the calendar attendee source uses it.

## Files

- `smplwise_vms/backend/smplwise/services/notify_policy.py`: `I18N_PARAM`, `_overlay`, `render` applies it for another language.
- `smplwise_vms/backend/smplwise/services/calendar/attendee_notices.py`: `when_text(..., lang)`, `message_text(..., lang)`, `_message_en`,
  `external_lang`; `_inapp` adds the English day / time; `dispatch` sends each external text in `external_lang`.
- `smplwise_vms/backend/smplwise/services/insights_delivery.py`: `LANGS` (he / en / recipient), `plan` resolves `recipient` per row,
  `email_message` passes the language to the mail page / RTL marks / footer.
- `frontend/src/screens/insights-settings.ts`, `frontend/src/api/insights.ts`, `frontend/src/i18n/insights.ts`,
  `frontend/src/i18n/lang/en/i18n/insights.ts`: the third option "השפה של כל נמען" / "Each recipient's language" in Settings › Infrastructure ›
  Insights and reports › scheduled delivery › message language (the default selection, Hebrew, looks exactly as before).
- `smplwise_vms/backend/tests/test_notify_lang_senders_2520.py` (new).

Not touched: `smplwise/error_text.py`, `error_text_en.json`, the service worker (`frontend/src/pwa/*`), WhatsApp templates, announcements,
any WisKey row file, any migration (the insights send row already has a `lang` column).

## Tests

PC (one file per process, `C:\cloude\smplwisebms\.venv`):

| check | command | result |
| --- | --- | --- |
| Hebrew byte-identity (one-off script, not committed): base `7b55e0e76` vs this branch. Every catalogue source rendered in Hebrew AND English for 6 param sets (on the branch also with an `_i18n` block present - must not change Hebrew); calendar `when_text` and `message_text` (4 kinds) for 2 events x 2 calendars x 3 organizers x 2 titles x 2 zones x 2 starts x 2 ends x all-day x recurring x occurrence; insights WhatsApp text + report mail (subject, text, HTML) in Hebrew for 3 summaries x 2 link bases | `senders_dump.py <tree>` twice + `he_compare.py` | **9,609 outputs compared, 0 differences** (Hebrew renders 960, English renders 960, calendar `when` 1,536, calendar messages 6,144, insights Hebrew 9); English notification renders without `_i18n` also identical; only the 6 English report mails differ (intended) |
| new tests | `pytest tests/test_notify_lang_senders_2520.py` | the first run showed 2 wrong expectations in the new test (a clipped trailing space; Hebrew room name in an English text = data), fixed; the re-run on the PC hit the 15-minute timeout (PC memory) - run on the runner instead, below |
| ruff (changed backend files + new test) | `py -3.12 -m ruff check ...` | All checks passed |

Runner (slot B, job `p2520_notifysenders_run.sh`, HEAD `f97782e11`, 25.11 13:17-13:47 server time):

| check | command | result |
| --- | --- | --- |
| backend lint | `scripts/gate/lint_backend.py --strict` | exit 0, 0 findings |
| wire types | `scripts/gen_wire_types.py --check` | exit 0 |
| refusal-text inventory | `scripts/i18n_backend_errors.py` | exit 0 (without English: 0) |
| shard 1: this row's tests, `test_notify_recipient_lang_2520`, `test_i18n_backend_2490` / `b` / `c`, `test_singletons_registered` (6 files) | pytest | exit 0, **78 passed** |
| shard 2: every `test_notif*` / `test_notify*` file (20 files) | pytest | exit 0, **312 passed** |
| shard 3: every `test_calendar*` and `test_insight*` file, `test_energy_elecbill77`, `test_energy_billing_api` (14 files) | pytest | exit 0, **2,135 passed** |
| shard 4: every `test_notice*` file (20 files) | pytest | exit 0, **1,799 passed** |
| frontend tsc (app / tests) | `npx tsc --noEmit -p tsconfig.json` / `tsconfig.tests.json` | exit 0 / 0, 0 errors |
| eslint (the 4 changed frontend files) | `npx eslint ...` | exit 0 |
| i18n split dry run / missing-keys report | `node scripts/i18n-split-langs.mjs --dry` / `node scripts/i18n_missing_keys.mjs` | exit 0 / exit 0 (Hebrew in the English pack: 0) |
| unused exports / design ratchet | `node scripts/unused-exports.mjs` / `scripts/design_ratchet.py` | exit 0 / exit 0, no count above the baseline |
| frontend unit tests (all) | `npx playwright test -c playwright.unit.config.ts --workers=2` | **5,234 passed, 15 skipped, 3 failed** - the 3 are `unit-mfa-passkeys-2490.spec.ts` (202, 259, 285): `page.goto ... ERR_CONNECTION_REFUSED at localhost:4173`, they need a preview server this job does not start; nothing of this row is on that path |

NOT_RUN: the release gate and the backend suite outside the runner shards; pixel baselines (no screen changes its look by default: the new
option is inside the closed language select; no compare page made for that reason - see question 3); a real WhatsApp / SMTP / push service
(fakes only); no lab, no live device.

## Open questions (recommendation first)

1. External calendar guests have no language on record, so they stay Hebrew. (a) keep (no new field); (b) a follow-up row adds an optional
   language to the guest form (migration + API + UI), which `external_lang` already reads.
2. A resident whose directory language is Arabic or Russian gets the Hebrew calendar text (Arx offers he / en). (a) keep Hebrew (the rule
   "unknown = Hebrew"); (b) English for any non-Hebrew language; (c) add Arabic / Russian texts for this message.
3. The new "each recipient's language" option in the insights delivery is not on a pixel baseline / compare page (the closed select looks the
   same). (a) accept; (b) add an evidence shot with the select open.
4. The insights report keeps the administrator's single language as the default. (a) keep `he` as the default (today's behaviour);
   (b) make "each recipient's language" the default for new installations.
