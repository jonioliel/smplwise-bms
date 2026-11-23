"""I18N-BACKEND-2490: the user-visible texts the server builds for a screen - the setup wizard, the readiness report and the error
envelope's `user_message` - in the interface language of the user who asked (`ui.lang`, services/user_prefs.py), Hebrew otherwise.

A text is a `Msg`: a stable key from a catalogue (`<namespace>.<name>`), its params, and - as a `str` - its Hebrew rendering. So
everything that already handles the text as a string (a cache shared by every user, a log line, an audit detail, the fleet report,
a test that compares it with a literal) keeps seeing exactly the Hebrew it saw before this change, byte for byte. Only the edge that
answers ONE request turns it into the requester's language: `localize(value, lang)` walks the answer and renders every `Msg` in
`lang` (its params too, so a link label inside a sentence follows the sentence).

Rules (owner answer N53 / Q15, as for the default names of services/default_names.py):
- the language is the requesting user's `ui.lang` (`default_names.lang_of`); no user (a background job, a refusal before sign-in)
  or no stored value = Hebrew, the product's language;
- nothing stored is rewritten: a `Msg` written to the database or a file is its Hebrew string from then on;
- the English is written by hand, with the words of the frontend's English catalogues (frontend/src/i18n/lang/en/...);
- a key without an English text answers its Hebrew (never a key, never an empty string).
"""
from __future__ import annotations

import re
from typing import Any, Mapping

LANGS: tuple[str, ...] = ("he", "en")
DEFAULT_LANG = "he"

# key -> {"he": template, "en": template}; filled by register() at the import of each module that owns texts
CATALOGUE: dict[str, dict[str, str]] = {}

_SLOT = re.compile(r"\{(\w+)\}")


def register(namespace: str, table: Mapping[str, tuple[str, str]]) -> None:
    """Add one module's texts: {name: (hebrew, english)} under `<namespace>.<name>`. A key registered twice must say the same."""
    for name, (he, en) in table.items():
        key = f"{namespace}.{name}"
        entry = {"he": he, "en": en}
        if CATALOGUE.get(key, entry) != entry:
            raise ValueError(f"i18n key registered twice with different texts: {key}")
        CATALOGUE[key] = entry


def fill(template: str, params: Mapping[str, Any]) -> str:
    """`{name}` slots filled in ONE pass (a value that itself holds braces is never read as a slot); an unknown slot stays.
    A value is rendered as an f-string renders it (`str(value)`), so the Hebrew of a `Msg` equals the f-string it replaced."""
    return _SLOT.sub(lambda m: str(params[m.group(1)]) if m.group(1) in params else m.group(0), template)


class Msg(str):
    """A server text with its key and params; its `str` value is the Hebrew rendering."""

    key: str
    params: dict[str, Any]

    def __new__(cls, key: str, **params: Any) -> "Msg":
        entry = CATALOGUE[key]  # KeyError = a key missing from the catalogue (a bug, caught by the tests)
        self = super().__new__(cls, fill(entry["he"], params))
        self.key = key
        self.params = params
        return self

    def __reduce__(self) -> tuple[Any, ...]:  # copy / deepcopy / pickle keep the key
        return (_rebuild, (self.key, self.params))

    def render(self, lang: str) -> str:
        """This text in `lang` (Hebrew when the catalogue has no text in that language)."""
        if lang == DEFAULT_LANG:
            return str.__str__(self)  # a plain str copy of the Hebrew
        entry = CATALOGUE[self.key]
        template = entry.get(lang) or entry[DEFAULT_LANG]
        return fill(template, {k: localize(v, lang) for k, v in self.params.items()})


def _rebuild(key: str, params: dict[str, Any]) -> Msg:
    return Msg(key, **params)


def t(key: str, **params: Any) -> Msg:
    """The text `key` with its params (its value is the Hebrew)."""
    return Msg(key, **params)


def localize(value: Any, lang: str) -> Any:
    """`value` with every `Msg` inside it (dict values, list / tuple items, nested) rendered in `lang` as a plain `str`. Other values
    are returned as they are; containers are copied, never changed in place (a cached answer is shared by every user)."""
    if isinstance(value, Msg):
        return value.render(lang)
    if isinstance(value, dict):
        return {k: localize(v, lang) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [localize(v, lang) for v in value]
    return value


def text(value: Any, lang: str) -> str:
    """One text in `lang`: a `Msg` rendered, any other value as `str`."""
    return value.render(lang) if isinstance(value, Msg) else str(value)


def lang_of(conn: Any, principal: Any) -> str:
    """The requesting principal's interface language (services/default_names.lang_of: `ui.lang`, Hebrew without one)."""
    from .services.default_names import lang_of as _lang_of

    return _lang_of(conn, principal)


# ---------------------------------------------------------------- the error envelope's language (main.py's handlers)

STATE_USER = "sw_ui_user"  # request.state attribute: the user id of the request's resolved principal (auth._principal)


def remember_user(request: Any, principal: Any) -> None:
    """Note who is asking, so an error answered later in this request (after the route's own connection is gone) can be
    worded in that user's language."""
    try:
        setattr(request.state, STATE_USER, getattr(principal, "user_id", None))
    except Exception:  # noqa: BLE001 - a request without a state (a test double) simply stays Hebrew
        pass


def request_lang(request: Any) -> str:
    """The interface language of the request's user, read on a short read-only connection of its own; Hebrew when nobody was
    resolved (a refusal before sign-in) or anything about the read fails - an error answer never fails because of its wording."""
    user_id = getattr(getattr(request, "state", None), STATE_USER, None)
    if not user_id:
        return DEFAULT_LANG
    try:
        from .services.default_names import lang_of_user

        with request.app.state.db.connection(mode="read", label="i18n.error_lang") as conn:
            return lang_of_user(conn, user_id)
    except Exception:  # noqa: BLE001 - see above
        return DEFAULT_LANG
