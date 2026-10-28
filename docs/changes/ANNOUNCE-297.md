# ANNOUNCE-297 - voice announcements, stage C: automatic translation; screens close rule and machine mark

Branch `pilot/ANNOUNCE-297` from `v2.23.2` (1b0ddd85c). Board items r366 (announcements on screens) and r373 (automatic translation).
Stage A (speakers) is `ANNOUNCE-295`, stage B (the text on screens) is `ANNOUNCEB-295` (`docs/changes/ANNOUNCEB-295.md`).
**No migration.** The highest number on this base and on every recent remote branch is 0179; this change needs none (see "Storage").

## 1. Screens (r366)

Stage B already shows the announcement on the allowed screens (notice TV boards and wall displays) under the same switch, scopes, quiet hours
(suppress / queue / lower / allow), rate limit, emergency priority (an emergency is shown first and longer) and audit as the speakers, without
scrolling (the text size steps down with the amount of text). This stage adds what was still open:

* **Dismiss rule.** A wall display may close a normal announcement at once; an **emergency** one only after `announce.screens.critical_close_s`
  seconds from when that display first showed it (default **15**, 0 = at once, 0-600; Settings › Multimedia › announcements › screens). The close
  button is disabled until then. A notice TV board has no close at all. The sender can always take an announcement off every screen
  (`POST /announcements/{id}/screens/stop`, stage B) and it leaves by itself when its time ends. `GET /wall/announcement` serves the value.
* **Reduced motion.** The TV overlay now fades in (0.24 s) and has no animation at all under `prefers-reduced-motion: reduce`; the wall overlay
  does the same (the wall's global reduced-motion rule already removes every animation).
* **Machine-translation mark.** A block the sender took from the automatic translation shows "תרגום אוטומטי / Machine translation /
  Машинный перевод / ترجمة آلية" under its text, in that block's own language (TV and wall). The size rule counts the mark, so it still fits.

## 2. Automatic translation (r373)

Hebrew → Arabic, English, Russian, as a **draft for review**. Nothing leaves the building by default.

| Guard | How |
|---|---|
| Off by default | `announce.translate.enabled` = false, `announce.translate.provider` = `off`. While off, the request is refused before any provider is built. |
| Owner approval | Switching on needs an approval recorded for the chosen provider (`translate: {approve: true}`, `system.configure`): who and when are stored in `announce.translate.approval` and audited (`media.announce.config`). Choosing another provider needs a new approval. The product rule is that the owner gives it. |
| Key | Never a setting: the secrets store, name `announce_translate_key` (Settings › Connections › Secrets, write-only, sealed per install). Never logged, audited, returned or put in an error. |
| Fixed host | The built-in `cloud` provider posts to a fixed https endpoint (OpenAI-compatible chat completions, `gpt-4o-mini`, temperature 0); the host is not a setting, so a setting cannot redirect the key. |
| Bounded | 15 s timeout, 64 KB answer, at most 20 provider calls a minute per process (429 `translate_rate_limited`), an answer longer than an announcement is refused (`translate_too_long`), never cut. |
| Write lock | The provider call runs outside the request's database write lock. |

**Pluggable.** `services/announce_translate.py`: a `Translator` protocol (`translate(text, source, target) -> str`), a provider registry
`PROVIDERS` (+ `register()`), the built-in `cloud` provider behind the seam `CLOUD_CALL`, and `FakeTranslator` (deterministic, offline) for tests.

**Cache.** In memory, per process: up to 256 entries for 7 days, keyed by provider, languages and text (SHA-256). A translation settings
change empties it. The same Hebrew sentence is not sent twice.

**Review before sending.** `POST /announcements/translate {text, targets?}` (`media.announce`) returns `{provider, source, items[{language, text,
machine: true, cached}]}` and announces nothing. The announce form (ראשי › הכרזות) shows a "תרגום" button only while the server says translation is
ready; the drafts fill and select their languages, each marked "תרגום אוטומטי – לבדיקה", and stay editable. **Send (and the free-text emergency
button) stay disabled until "בדקתי את התרגום" is ticked**; changing the Hebrew text clears the tick. A part is sent with `machine: true`.

**Storage.** A machine-translated part is stored as `[language, text, "mt"]` in the existing `announcements.texts_json` (no schema change). The mark
is kept when a held (quiet hours) announcement is released, shown on the screens, listed in the history (`machine_translated`) and named in the
audit (`machine_translated`). Hebrew can never be marked; a mark on a language that is not sent is refused (422).

**Audit.** `media.announce.translate` per request: provider, target languages, text length, cached count, the refusal code. Never the text, never
the key.

## API

| Route | Notes |
|---|---|
| `POST /announcements/translate` | new; 404 `translate_off`, 409 `translate_not_configured`, 429 `translate_rate_limited`, 502 `translate_failed` / `translate_rejected` / `translate_unreachable` / `translate_too_long` |
| `GET/PUT /announcements/config` | `config.translate {enabled, provider, source, targets, approval, key_set}`; PUT `translate {enabled?, provider?, targets?, approve?}`; `screens.critical_close_s` |
| `GET /announcements/areas` | adds `translate_enabled`, `translate_targets` |
| `POST /announcements`, `POST /announcements/emergency` | a part may carry `machine: true` |
| `GET /announcements/history` | rows add `machine_translated` |
| `GET /wall/announcement` | adds `critical_close_s`; a text may carry `machine: true` |

API inventory 1594 -> 1595.

## Tests

* `smplwise_vms/backend/tests/test_announce_translate_297.py` (11): off by default and refused before any provider is built; approval bound to the
  provider, validation, permission; drafts marked machine, nothing announced, cache hit, cache emptied on change, text never in the audit; text
  cleaning and permission; provider failures as codes, too-long refused; the call cap; the cloud provider reads the key from the secrets store
  through the seam and never leaks it; the default cloud call maps a network error to a code without the key; the mark kept in storage, history,
  audit and speech order; the mark and the close rule on the wall route; the mark kept through a quiet-hours release. `urllib.request.urlopen`
  is replaced by a failing stub in every test, so no test can reach a network.
* `smplwise_vms/backend/tests/test_announce_screens_b295.py`: the wall route answer now includes `critical_close_s`.
* `frontend/tests/unit-announce-297.spec.ts` (7): translate button rule, applying a draft, edit / empty keeps or drops the mark, the review gate,
  the screen mark (escaped, own language, size), the close rule, string parity.
* `frontend/tests/evidence-announce-297.spec.ts` (3, desktop project, mocked wire): the form's translate flow at 1366x768 without scrolling, the
  review gate and the sent body; the TV page with four full-length languages (three marked) inside the screen at 1366x768 and 1080x1920;
  the Settings card off by default and locked until the approval is recorded.

## Design pass (owner rule 27.10: installed design skills)

Screens reviewed in a real browser (Chromium, mocked wire) at 1366x768, 390x844 and the TV page at 1366x768 / 1080x1920, with realistic
worst-case data (four languages at the 200-character limit, a long Russian translation).

| Skill | Found | Done |
|---|---|---|
| impeccable (`detect`, craft floor) | detector: no findings; the translate control was a small `sw-button` that did not match the language chips beside it | translate is now a chip of the same family |
| break-ui | TV: four full-length languages (realistic with translation) overflowed the `s` size and cut the last language; phone: a long translation was clipped inside the 56 px field | new `xs` size step (TV + wall); fields grow with their text (`field-sizing: content`, 56-160 px) |
| emil-design-eng | the disabled emergency close button gave no feedback; fades used the weak built-in ease-out; chips had no press feedback | the close button shows the seconds left; `cubic-bezier(0.23, 1, 0.32, 1)`; chips scale to 0.97 on press |
| mobile-native | field font under 16 px zooms the page on iOS focus; the review checkbox was a small target; tap delay on chips | 16 px fields and a 44 px review row under `pointer: coarse`; `touch-action: manipulation`, no text selection on chips |
| ui-ux-pro-max | loading and disabled states checked: "מתרגם…" with the button disabled, the mark is text not colour only | held, no change |
| taste-skill (lint, app screen) | every flag is in incumbent code (the B295 overlay gradients, existing borders and shadows); the new code adds none | none |
| motion (not loaded; checked by hand) | the TV and wall overlays fade in 0.24 s; nothing moves | no animation under `prefers-reduced-motion` |

## Not done / limits

* No provider is enabled anywhere and no real translation call was made; the cloud provider is exercised only through its fake seam.
* The cache is per process and in memory (lost on restart) by design: no translated text is stored outside the announcements themselves.
* The wall display's emergency close lock is covered by unit specs and the backend route, not by a browser spec.
* Real-device behaviour (TV browser, tablet wall) is NOT_RUN.
