# ANNOUNCE2-297 - announcements: the owner's answers of 27.10 (close lock, translation provider, no review gate)

Branch `pilot/ANNOUNCE2-297`, cut from `pilot/ANNOUNCE-297` (`5cb654028`). Target 2.26.0. No migration (settings rows only). No API change
(the `translate.provider` setting takes one more value).

| owner answer | what the product does |
|---|---|
| Emergency close lock on a wall display (27.10): 15 seconds by default, the value is a setting 0-600 | Already built in ANNOUNCE-297 (`announce.screens.critical_close_s`, default 15, whole seconds 0-600; the server refuses fractions, strings, booleans and out-of-range values; Settings > multimedia > announcements > screens). This branch adds `step="1"` / numeric keyboard to the field and pins the rule with tests. |
| Translation provider (27.10): not OpenAI by default; a free Google-based translation is the default; OpenAI stays selectable; the provider is a setting; no secrets in code | New provider `google` behind the existing `Translator` / `PROVIDERS` interface, the default value of `announce.translate.provider`. It needs no key: one POST to the fixed host `translate.googleapis.com` (not a setting), the text in the request body (never in the address), a bounded wait and answer, failures mapped to codes (429 = rate limited) that never carry the text; the seam `GOOGLE_CALL` keeps tests offline. OpenAI stays as `cloud` ("OpenAI" in the list) with its key in the secrets store. Unchanged: translation is OFF until switched on, and switching on needs the recorded approval for the chosen provider (Google too, since the text leaves the building); a provider change needs a new approval. |
| Emergency free-text button and "I checked the translation" (27.10): never blocked; translation is an aid and must not delay sending | The "I reviewed the translation" checkbox and its gate are removed from the announce form: the send and the free-text emergency buttons depend only on the text, the place and the channel. Each machine-translated field keeps a short, quiet mark ("תרגום אוטומטי", neutral colour, was "תרגום אוטומטי – לבדיקה" in amber); the mark still travels with the announcement to the screens, the history and the audit. The server never required a review (unchanged). |

Settings card wording: the provider list is "כבוי / Google (חינם, ללא מפתח) / OpenAI"; the hint says the translation fills an editable draft
and never holds back sending.

Which Google offering (to verify, not assumed): the provider calls the free, keyless web endpoint `translate.googleapis.com/translate_a/single`
(`client=gtx`), the one Google's own web clients and many open-source tools use. It has no key, no account and no published price, but also
no published terms of use for third-party products, no SLA and no published quota: it may throttle (mapped to "rate limited") or change
without notice. The official, paid alternative is the Google Cloud Translation API (a key and a billing account; it has a monthly free
allowance per its price list, to be checked before use). It fits behind the same interface as one more provider, with its key in the
secrets store like the OpenAI key.

To confirm with the owner: the approval step for Google is kept (the announcement text is sent to Google once the switch is on). If the owner
wants Google to work without the recorded approval, that is a one-line rule change in `announce_translate.merge`.

Files: `services/announce_translate.py` (google provider, default), `announce/model.ts` (the review rule removed),
`screens/devices-announce.ts` (no checkbox, no gate, quiet mark), `screens/system-announcements.ts` (Google option, numeric field),
`i18n/announce.ts` (four languages), comments in `routers/announcements.py`, `services/announcements.py`, `api/announcements.ts`.

Tests: backend `test_announce2_297.py` (new: the close-lock range, Google default without a key, OpenAI selectable with its own approval, the
Google request shape and answer parsing, error codes, the emergency free text with machine parts), `test_announce_translate_297.py` (the
default provider); unit `unit-announce2-297.spec.ts` (new), `unit-announce-297.spec.ts` (the review test removed, the key list);
Playwright (runner) `evidence-announce-297.spec.ts` (no gate, Google default, three providers).
