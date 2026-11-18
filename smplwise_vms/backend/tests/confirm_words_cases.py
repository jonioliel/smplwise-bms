"""CR-I18N-CONFIRM-WORDS-2442: the texts every per-action test of a typed confirmation sends (services/confirm_words.py).

`good(key, lang)` is the accepted text of a language (the English one in mixed case with spaces around it: trimmed, case ignored);
`bad(key)` is a wrong word plus the near-misses that must stay refused."""
from __future__ import annotations

from typing import Any

from smplwise.services import confirm_words as cw

LANGS = ("he", "en")


def good(key: str, lang: str, **fmt: Any) -> str:
    if lang == "he":
        return cw.he(key, **fmt)
    word = cw.en(key, **fmt)
    return "  " + "".join(ch.upper() if i % 2 == 0 else ch for i, ch in enumerate(word)) + " "


def near_misses(key: str, **fmt: Any) -> list[str]:
    he, en = cw.he(key, **fmt), cw.en(key, **fmt)
    other = next(k for k in cw.WORDS if k != key and "{" not in cw.WORDS[k].he and cw.WORDS[k].he != cw.WORDS[key].he)
    out = [
        en + "s",                 # one letter more
        en[:-1],                  # one letter less
        en + ".",                 # punctuation
        "".join(chr(ord(ch) + 0xFEE0) if ch.isalpha() else ch for ch in en),  # full-width letters
        en.replace("e", "е").replace("o", "о").replace("a", "а"),  # Cyrillic look-alikes
        he[:-1],                  # the Hebrew word cut
        he + " " + en,            # both words
        en + " " + he,
        cw.en(other),             # another action's English word
        cw.he(other),             # another action's Hebrew word
    ]
    if " " in en:
        out += [en.replace(" ", ""), en.replace(" ", "  ", 1), en.replace(" ", "-")]  # no space, two spaces, a hyphen
    accepted = {he, en}
    return [text for text in dict.fromkeys(out) if text not in accepted]


def bad(key: str, **fmt: Any) -> list[str]:
    """A plainly wrong word first, then the near-misses."""
    return ["yes", *near_misses(key, **fmt)]
