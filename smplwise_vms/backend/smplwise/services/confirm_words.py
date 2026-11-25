"""CR-I18N-CONFIRM-WORDS-2442 (owner decision 17.11): the ONE table of the fixed words an operator types before a dangerous action.

Until this module every router compared the typed text with its own Hebrew constant, so an operator who works in the English
interface had to type Hebrew. Each word now has exactly one fixed English counterpart, and a check accepts:

- the Hebrew word, compared exactly as that check always compared it (the caller's own normalisation - by default the surrounding
  white space is removed and nothing else); or
- the English counterpart: the surrounding white space removed, ASCII only, letter case ignored. Nothing else - no partial match, no
  inner-space folding, no Unicode case folding, no synonym.

A text that is neither is refused as before. `typed_lang` answers which of the two was typed (`"he"` / `"en"`), and the caller writes
that into its audit row as `confirm_word`; the typed text itself is never stored.

The frontend carries the same table (frontend/src/i18n/confirm-words.ts; a unit spec compares the two files) to show each interface
language its own word. Texts that are DATA are not here and stay as they are: a station's name, a user name, a count of rows, a
ticket number (the operator types what the screen shows, in any language).
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any, NamedTuple


class Word(NamedTuple):
    he: str
    en: str


# key -> (Hebrew, English). `{slot}`-style placeholders are filled by the caller's keyword arguments in BOTH words.
WORDS: dict[str, Word] = {
    "nvr_save_untested": Word("שמור", "save"),                            # PUT /nvr/connection, POST /recorders, PUT /recorders/{id}/connection
    "nvr_remove": Word("הסר", "remove"),                                  # DELETE /nvr/connection, DELETE /recorders/{id}
    "schedules_allow_disarm": Word("אפשר נטרול", "allow disarm"),         # PATCH /settings schedules.allow_disarm -> true
    "privacy_local_purge": Word("מחיקה לצמיתות", "delete permanently"),   # PATCH /settings privacy.local_purge -> on
    "capture_lookup_wide": Word("הרחב בירור", "widen lookup"),            # PUT /access/capture-lease/settings (the wider lookup scope)
    "installer_pulse": Word("פתיחת דלת לבדיקה", "open door for test"),    # installer onboarding `mapping` step (WisKey pulses the relay)
    "installer_host_clock": Word("שעון השרת", "server clock"),            # installer clock/host-apply
    "installer_webhook_key": Word("הצגת המפתח", "show key"),              # installer platform/webhook/key
    "installer_import_apply": Word("ייבוא תצורה", "import configuration"),  # installer platform/import/apply
    "installer_retention_apply": Word("מחיקת אירועים", "delete events"),  # installer platform/retention/apply
    "installer_config_apply": Word("החלה על העמדות", "apply to stations"),  # installer platform/config/apply
    "installer_maint_enqueue": Word("תזמון תחזוקה", "schedule maintenance"),  # installer platform/maintenance/enqueue
    "lineage_reinit": Word("אתחול", "reinitialise"),                      # POST wiskey lineage reinitialise
    "relay_map_confirm": Word("אשר", "confirm"),                          # relay map change that touches an automated door
    "access_gone": Word("נמחק", "deleted"),                               # external access: close a revoke by manual confirmation
    "access_revoke_all": Word("בטל הכל", "revoke all"),                   # external access: revoke all
    "access_delete_person": Word("מחק", "delete"),                        # external access: delete the person Arx created
    "visitors_revoke_all": Word("בטל מבקרים", "revoke visitors"),         # visitors: revoke all
    "managed_enabled": Word("מאשר ניהול התקנה", "approve managed install"),  # WisKey managed install switch (also the start-up switch)
    "managed_core_risk": Word("מאשר סיכון סביבה", "approve environment risk"),  # WisKey managed install: accepted Core-image risk
    "managed_adopt": Word("מאשר העברה לניהול", "approve move to managed"),  # WisKey managed install: adoption
    "legacy_import_apply": Word("ייבוא מהמערכת הישנה", "import legacy"),  # LEGACY-MIGRATION-2550: POST /migration/legacy/apply
    "door_code": Word("קוד {slot}", "code {slot}"),                       # public door code write (slot 1-16)
}

LANGS = ("he", "en")


def _check_table() -> None:
    """Import-time proof of the table's rules: an English word is lower-case ASCII with single inner spaces, the Hebrew holds no ASCII
    letter (so the two can never be confused), and one Hebrew word never has two English counterparts."""
    seen: dict[str, str] = {}
    for key, word in WORDS.items():
        bare = word.en.replace("{slot}", "")
        if not (word.en.isascii() and word.en == word.en.lower() and word.en == " ".join(word.en.split()) and bare.replace(" ", "").isalpha()):
            raise AssertionError(f"confirm word {key}: the English word must be lower-case ASCII letters with single spaces")
        if not word.he or word.he != word.he.strip() or any(ch.isascii() and ch.isalpha() for ch in word.he.replace("{slot}", "")):
            raise AssertionError(f"confirm word {key}: the Hebrew word must be trimmed and hold no ASCII letter")
        if seen.setdefault(word.he, word.en) != word.en:
            raise AssertionError(f"confirm word {key}: the same Hebrew word has two English counterparts")


_check_table()
_KEY_OF_HE = {word.he: key for key, word in WORDS.items()}


def he(key: str, **fmt: Any) -> str:
    """The Hebrew word (the one every server text and every stored document names)."""
    return WORDS[key].he.format(**fmt) if fmt else WORDS[key].he


def en(key: str, **fmt: Any) -> str:
    """The fixed English counterpart (lower case)."""
    return WORDS[key].en.format(**fmt) if fmt else WORDS[key].en


def key_of(he_word: str) -> str | None:
    """The key of a FIXED Hebrew word, None for any other text (a station's name, ...). Words with a placeholder are not found here."""
    return _KEY_OF_HE.get(he_word)


def _strip(text: str) -> str:
    return text.strip()


def typed_lang(key: str, typed: Any, *, he_norm: Callable[[str], str] = _strip, **fmt: Any) -> str | None:
    """Which word was typed: `"he"`, `"en"`, or None when the text is neither (the action is then refused).

    `he_norm` is the comparison the calling check always used for its Hebrew word (default: surrounding white space removed), applied
    to both sides, so the Hebrew path of every check is unchanged. The English path is the same everywhere: trimmed, ASCII, case
    ignored."""
    if not isinstance(typed, str):
        return None
    if he_norm(typed) == he_norm(he(key, **fmt)):
        return "he"
    text = typed.strip()
    if text.isascii() and text.lower() == en(key, **fmt):
        return "en"
    return None
