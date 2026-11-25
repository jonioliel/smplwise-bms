"""I18N-REST-2520: the English of the server's constant refusal texts - the `user_message` an `ApiError` (or one of the error helpers
and error classes that build one) is raised with as a plain Hebrew literal.

Before this table an English user saw those texts in Hebrew unless the raising code had put a `details.message_en` beside them
(I18N-BACKEND-2490 step 2). The table is keyed by the Hebrew text itself, as the frontend's source-text tables are (`tr('<Hebrew>')`,
frontend/src/i18n/msg.ts): nothing at the 2,300 raising sites changes, a Hebrew reader gets the same bytes as before, and the English is
chosen only where the envelope is answered (errors.ApiError.message_in, after the `Msg` and `details.message_en` steps).

- `error_text_en.json` (beside this module): {Hebrew: English}, written by hand with the words of the frontend's English catalogues
  (docs/i18n/GLOSSARY_EN.md). A text the table lacks answers its Hebrew, as before.
- Texts built at run time (f-strings with names and numbers) are not in it: they become `Msg`s of a catalogue when their module is
  worked on (smplwise/i18n.py). scripts/i18n_backend_errors.py counts both kinds per module and keeps a ratchet
  (docs/i18n/BE_ERRORS_EN_RATCHET.json, read by tests/test_i18n_errors_en_2520.py): a constant without English, or a new run-time
  Hebrew text, fails the test.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

TABLE_FILE = Path(__file__).with_name("error_text_en.json")


@lru_cache(maxsize=1)
def table() -> dict[str, str]:
    """The Hebrew -> English table (read once)."""
    return json.loads(TABLE_FILE.read_text(encoding="utf-8"))


def english(message: object) -> str | None:
    """The English of a constant Hebrew refusal text, or None (not a string, or not in the table)."""
    if type(message) is not str:  # a Msg renders itself; anything else is not a text of this table
        return None
    return table().get(message) or None
