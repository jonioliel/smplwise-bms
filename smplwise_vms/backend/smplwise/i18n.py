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


CAT_KEY = "i18n.cat"


class Cat(Msg):
    """Texts written one after the other (a sentence built from parts, a list joined by a word): its `str` value is the parts' values
    concatenated (so the Hebrew equals the concatenation it replaced), and each part - a `Msg` or a plain string (data: a name, a number)
    - is rendered in the language on its own."""

    parts: tuple[Any, ...]

    def __new__(cls, *parts: Any) -> "Cat":
        self = str.__new__(cls, "".join(str.__str__(p) if isinstance(p, str) else str(p) for p in parts))
        self.key = CAT_KEY
        self.params = {}
        self.parts = parts
        return self

    def __reduce__(self) -> tuple[Any, ...]:
        return (Cat, self.parts)

    def render(self, lang: str) -> str:
        if lang == DEFAULT_LANG:
            return str.__str__(self)
        return "".join(text(p, lang) for p in self.parts)


LIT_KEY = "i18n.lit"


class Lit(Msg):
    """A text already worded in each language (third pass: a role name whose `{tickets}` token is filled with the installation's own name
    of the tickets module in each language, services/tickets/naming.py): its `str` value is the Hebrew, `render(lang)` the text of `lang`
    (Hebrew when it has none)."""

    texts: dict[str, str]

    def __new__(cls, texts: Mapping[str, str]) -> "Lit":
        self = str.__new__(cls, texts[DEFAULT_LANG])
        self.key = LIT_KEY
        self.params = {}
        self.texts = dict(texts)
        return self

    def __reduce__(self) -> tuple[Any, ...]:
        return (Lit, (self.texts,))

    def render(self, lang: str) -> str:
        if lang == DEFAULT_LANG:
            return str.__str__(self)
        return str(self.texts.get(lang) or self.texts[DEFAULT_LANG])


def cat(*parts: Any) -> Any:
    """The parts one after the other: a `Cat` when any part is a `Msg`, else the plain concatenation (no wrapper around data)."""
    if any(isinstance(p, Msg) for p in parts):
        return Cat(*parts)
    return "".join(str(p) for p in parts)


def join(sep: Any, items: Any) -> Any:
    """`sep.join(items)` where the separator and the items may be `Msg`s (the separator "or" / "and" is a word of the language)."""
    items = list(items)
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    parts: list[Any] = [items[0]]
    for it in items[1:]:
        parts += [sep, it]
    return cat(*parts)


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


def localize_for(conn: Any, principal: Any, value: Any) -> Any:
    """`value` for the requesting principal (third pass: the routes that show role and scope names, schedules' refusals): rendered in
    their interface language; a Hebrew reader gets the value as it is (every `Msg`'s string value is the Hebrew), with no copy."""
    lang = lang_of(conn, principal)
    return value if lang == DEFAULT_LANG else localize(value, lang)


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
