"""CR-I18N-CONFIRM-WORDS-2442 (owner decision 17.11): the shared table of typed confirmation words (services/confirm_words.py).

A check accepts the Hebrew word or its ONE fixed English counterpart (trimmed, ASCII, case ignored) and nothing looser. The per-action
tests live beside each action's own tests (they use `confirm_words_cases`); this file proves the table, the matcher and that no
router or service keeps a copy of a word."""
from __future__ import annotations

import ast
import re
import unicodedata
from pathlib import Path

import pytest
from confirm_words_cases import LANGS, bad, good, near_misses

from smplwise.services import confirm_words as cw

ROOT = Path(__file__).resolve().parents[1] / "smplwise"
FMT = {"door_code": {"slot": 7}}
KEYS = sorted(cw.WORDS)


def fmt(key: str) -> dict:
    return FMT.get(key, {})


def test_the_table_is_the_owner_list_and_each_word_has_one_english_counterpart():
    # the five words of the owner decision, as they were, each with its English word
    assert cw.WORDS["nvr_save_untested"] == ("שמור", "save")
    assert cw.WORDS["nvr_remove"] == ("הסר", "remove")
    assert cw.WORDS["schedules_allow_disarm"] == ("אפשר נטרול", "allow disarm")
    assert cw.WORDS["capture_lookup_wide"] == ("הרחב בירור", "widen lookup")
    assert cw.WORDS["installer_pulse"] == ("פתיחת דלת לבדיקה", "open door for test")
    assert len(cw.WORDS) == 22
    for key, word in cw.WORDS.items():
        assert word.en.isascii() and word.en == word.en.lower() and word.en == " ".join(word.en.split()), key
        assert not any(ch.isascii() and ch.isalpha() for ch in word.he.replace("{slot}", "")), key
        assert unicodedata.normalize("NFC", word.he) == word.he and word.he == word.he.strip(), key
    by_he: dict[str, set[str]] = {}
    for word in cw.WORDS.values():
        by_he.setdefault(word.he, set()).add(word.en)
    assert all(len(v) == 1 for v in by_he.values()), "one Hebrew word never has two English counterparts"
    assert all(cw.key_of(word.he) is not None for word in cw.WORDS.values())
    assert cw.key_of("Main gate") is None and cw.key_of("") is None, "a station's name is not a word of the table"


@pytest.mark.parametrize("key", KEYS)
def test_the_hebrew_word_and_the_english_word_are_accepted(key):
    f = fmt(key)
    assert cw.typed_lang(key, cw.he(key, **f), **f) == "he"
    assert cw.typed_lang(key, f"  {cw.he(key, **f)}\n", **f) == "he", "trimmed, as before"
    assert cw.typed_lang(key, cw.en(key, **f), **f) == "en"
    assert cw.typed_lang(key, cw.en(key, **f).upper(), **f) == "en"
    assert cw.typed_lang(key, cw.en(key, **f).title(), **f) == "en"
    for lang in LANGS:
        assert cw.typed_lang(key, good(key, lang, **f), **f) == lang


@pytest.mark.parametrize("key", KEYS)
def test_a_wrong_word_and_every_near_miss_are_refused(key):
    f = fmt(key)
    assert len(near_misses(key, **f)) >= 9
    for text in bad(key, **f):
        assert cw.typed_lang(key, text, **f) is None, (key, text)
    for text in (None, "", "   ", 0, 1, True, b"save", ["save"], {"confirm": "save"}):
        assert cw.typed_lang(key, text, **f) is None, (key, text)


def test_the_english_path_is_ascii_only_and_never_folds_unicode_case_or_inner_spaces():
    assert cw.typed_lang("nvr_save_untested", "SAVE") == "en"
    assert cw.typed_lang("nvr_save_untested", "ſave") is None, "U+017F (long s) upper-cases to S: not ASCII, refused"
    assert cw.typed_lang("capture_lookup_wide", "widen lookup") == "en"
    assert cw.typed_lang("capture_lookup_wide", "wıden lookup") is None, "a dotless i is not i"
    assert cw.typed_lang("capture_lookup_wide", "widen\tlookup") is None and cw.typed_lang("capture_lookup_wide", "widen  lookup") is None
    assert cw.typed_lang("capture_lookup_wide", "widen lookup") is None, "a no-break space is not a space"
    assert cw.typed_lang("access_delete_person", "deleted") is None and cw.typed_lang("access_gone", "delete") is None, "each action its own word"
    assert cw.typed_lang("nvr_remove", "save") is None and cw.typed_lang("nvr_save_untested", "הסר") is None


def test_the_door_code_phrase_names_its_own_slot_in_both_languages():
    assert cw.he("door_code", slot=3) == "קוד 3" and cw.en("door_code", slot=3) == "code 3"
    assert cw.typed_lang("door_code", "קוד 3", slot=3) == "he" and cw.typed_lang("door_code", " Code 3 ", slot=3) == "en"
    for text in ("code 2", "קוד 2", "code3", "code 03", "code 13", "code {slot}", "קוד {slot}", "code  3"):
        assert cw.typed_lang("door_code", text, slot=3) is None, text


def test_the_callers_own_hebrew_comparison_is_kept_and_never_applied_to_the_english_word():
    def collapse(text: str) -> str:  # the installer's comparison (services/wiskey_installer.normalized)
        return " ".join(unicodedata.normalize("NFC", text).split())

    assert cw.typed_lang("installer_host_clock", "שעון  השרת ", he_norm=collapse) == "he", "the installer always folded inner spaces of ITS phrase"
    assert cw.typed_lang("installer_host_clock", "שעון  השרת ") is None, "the default comparison only trims"
    assert cw.typed_lang("installer_host_clock", "server  clock", he_norm=collapse) is None, "the English word is never folded"
    assert cw.typed_lang("installer_host_clock", " Server Clock ", he_norm=collapse) == "en"


def test_no_router_or_service_keeps_its_own_copy_of_a_word():
    """One shared table: outside services/confirm_words.py no string constant of the backend is one of the words (a docstring that
    names a word inside a sentence is not a copy)."""
    words = {w.he for w in cw.WORDS.values()} | {w.en for w in cw.WORDS.values() if " " in w.en}
    copies = []
    for path in sorted(ROOT.rglob("*.py")):
        if path.name == "confirm_words.py":
            continue
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value.strip() in words:
                copies.append(f"{path.relative_to(ROOT)}:{node.lineno} {node.value!r}")
    assert copies == []


def test_every_check_of_a_typed_word_goes_through_the_table():
    """The comparison shape the old checks used (`.strip() != X_WORD` / `_PHRASE`) is gone from the routers and services, and the
    matcher is called from exactly the places the change note lists."""
    old = re.compile(r"strip\(\)\s*(!=|==)\s*[\w.]*(_WORD|_PHRASE|confirm_phrase\()")
    hits = [f"{p.relative_to(ROOT)}:{i}" for p in sorted(ROOT.rglob("*.py")) for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1) if old.search(line)]
    assert hits == []
    users = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*.py") if "confirm_words.typed_lang(" in p.read_text(encoding="utf-8")}
    assert users == {
        "routers/nvr_connection.py", "routers/recorders.py", "routers/settings_patch/identity.py", "routers/capture_lease.py", "routers/wiskey_installer_common.py",
        "routers/wiskey_lineage.py", "services/wiskey_relay_map.py", "services/access_external.py", "services/access_grants.py",
        "services/access_visitors.py", "services/wiskey_managed_install.py", "services/wiskey_door_tech.py",
    }
