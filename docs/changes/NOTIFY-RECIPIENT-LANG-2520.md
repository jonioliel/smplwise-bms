# NOTIFY-RECIPIENT-LANG-2520 - notifications go out in each recipient's language

Branch `pilot/NOTIFY-RECIPIENT-LANG-2520`, cut from `origin/pilot/I18N-REST-2520` (`f493b96a9`, the row that made the notification
centre show 124 of 160 notification types in English). Target 2.52.0. Answers open question 1 of `I18N-REST-2520.md` with its
recommendation (a).

## What

Before: the notification centre showed an English reader the English title / body, but every delivery - browser push, e-mail, the
phone app, WhatsApp - sent the stored Hebrew.

Now, per recipient:

| channel | recipient | language | what is translated |
| --- | --- | --- | --- |
| Web Push (browser) | an Arx user | that user's stored `ui.lang` | title, body, severity word, "new notification", "ended", the action buttons (Acknowledge / Mute for an hour / Open the door) |
| phone app (relay) | an Arx user | that user's stored `ui.lang` | the stored message the phone fetches (title, body - same as Web Push); the relay call itself carries no text, as before |
| e-mail | an installation-level address | the `ui.lang` of the active Arx user(s) whose own e-mail (`users.email`) is that address, when they agree | subject, title, the mail's labels and footer, the digest, the test mail; the English mail is `lang="en" dir="ltr"`, no RTL marks |
| WhatsApp | - | **unchanged** | nothing: its message texts are approved templates owned outside this team (services/notify_whatsapp.py). Left Hebrew / as it was. |
| announce (speakers) | the installation | unchanged | not a person; out of scope |

Unknown language -> Hebrew: no stored `ui.lang`, a value that is not offered, no matching user for a mail address, or users with
different languages sharing one address. A Hebrew recipient gets the same bytes as before (checked, see Tests).

The rule for the title / body is the notification centre's (I18N-REST-2520), now shared: the row keeps its Hebrew and the signal's
params; for an English recipient the source's English templates (`services/notify_policy_en.py`) are rendered from those params - only
when the stored Hebrew is exactly what the source's Hebrew templates give for the same params (an older row, or a body built from its
own `_template`, goes out as stored). Names inside the params (places, devices) are data and stay as written. Nothing is written back.
The resolve notice's text is the source's English resolve text when the notice carries the source's own Hebrew one; a text of its own
stays as given.

Also: the browser's and the phone app's test push are in the caller's (device owner's) language; the mail "test" button sends each
configured address its own language. A per-generator source (`generator.<type>@<id>`) now finds its alert type's English template
(before, it fell back to Hebrew in the centre as well - a gap in the I18N-REST-2520 lookup).

## Why

Owner rule (recommendation of I18N-REST-2520 Q1): a user who reads Arx in English gets the notification about it in English on every
channel the team owns, using the same tables the centre uses.

## Files

- `smplwise_vms/backend/smplwise/services/notify_delivery_lang.py` (new): the shared rule - `note_in` (the row in a language),
  `resolve_text_in`, `TEXT_EN` (the channels' fixed words keyed by their Hebrew, worded as the frontend's push preview
  `msg/api-notify`), `word`, `severity_label`, `user_langs` (one statement per 500 users), `address_langs`.
- `services/notify_channels.py`: `Dispatch.lang(user_id)` (all recipients' languages in one statement on the planning connection,
  shared by every channel) and `Dispatch.note(lang)`; `payload_v2(..., lang="he")`; Web Push plans each target's language and sends
  the payload in it; the test push.
- `services/mobile_push.py`: the app channel stores each device's message in its owner's language (one text per language); the test push.
- `services/notify_email.py`: `compose_notification` / `compose_digest` / `compose_test` / `_page` / `_rtl` take `lang` (default `he`);
  the channel renders one mail per language of the configured addresses; `_Batch` carries the mail and the digest item per language and
  each address's language; `HeldItem.lang` (default `he`); `send_test(..., langs=None)`.
- `services/push.py`: the legacy v1 test push (`/push/test`) in the caller's language.
- `services/notify.py`: `_in_reader_language` uses `note_in` (same behaviour).
- `services/notify_policy.py`: `base_key()`; `render(..., "en")` looks a per-generator source up by its type.
- `services/notify_policy_en.py`: docstring only.
- `routers/notifications.py`: `POST /notify/email/test` passes the addresses' languages (no API change).
- `tests/test_notify_recipient_lang_2520.py` (new).

Not touched: `smplwise/error_text.py`, `error_text_en.json`, the service worker (`frontend/src/pwa/*`; I18N-RUNTIME-ERRORS-2520 owns
them). The worker already shows the action titles the payload carries (`pwa/push-v2.ts`: `a.title || LABEL[id]`), so the English
buttons arrive without touching it. No WisKey row file, no frontend file, no API shape, no migration.

## Tests

PC (one file per process, `C:\cloude\smplwisebms\.venv`):

| check | command | result |
| --- | --- | --- |
| Hebrew byte-identity (one-off script, not committed): base `f493b96a9`'s `compose_notification` / `compose_digest` / `compose_test` / `payload_v2` vs this branch, Hebrew, every mode x level x severity x place x count x link x installer x resolve text | `python he_identity_check.py f493b96a9` | **5,767 combinations identical** |
| new tests | `pytest tests/test_notify_recipient_lang_2520.py` | exit 0, **13 passed** |
| ruff (changed files) | `ruff check ...` | the new test file has 4 F811 (`fake_push` fixture imported and used as a parameter - the same pattern as `test_notify_channels.py` etc.); product files clean |

Runner (slot B): RESULT_RUNNER

NOT_RUN: the release gate; the frontend (nothing changed there); a real SMTP server, a real push service or the real relay (fakes
only: the in-process SMTP on 127.0.0.1, the fake push service, an httpx mock of the relay); no lab, no live device.

## Open questions (recommendation first)

1. E-mail goes to installation-level addresses, not users. The address's language comes from the Arx user whose own e-mail
   (`users.email`, "for the notification e-mail channel only") is that address.
   (a) keep this (no new setting; an address nobody owns stays Hebrew); (b) add a language per address in the outgoing-mail settings
   (a new field + screen); (c) one language for all mail, chosen by the administrator.
2. WhatsApp keeps its own approved templates (he / ar / ru / en already exist in services/notify_whatsapp.py, chosen there).
   (a) leave to the WhatsApp owners - nothing changed here; (b) a follow-up row that maps `ui.lang` to their template language.
3. Other senders outside the notification pipeline still send Hebrew: the insights delivery (e-mail / WhatsApp), the calendar attendee
   notices (guests are not users), the notice-board push, the energy notices. (a) follow-up rows per sender, users first; (b) leave.
4. A digest mail held across a language change of its address uses the language at the last hold (the earlier lines keep the title in the
   language they were held in). (a) accept (rare, minutes long); (b) re-render the titles at send time.
