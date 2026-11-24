"""Request base model that OBSERVES unknown keys (ADR-019 D2, L14 step 1).

A web-UI request model that is tolerant today (pydantic's default `extra="ignore"`) silently drops a key it does not declare: a
renamed field, a draft spread from a GET answer into a PUT. Before such a model may become `extra="forbid"` something has to prove
that no screen sends an extra key. `RequestModel` is that proof's instrument, in the style of `WireModel` (smplwise/wire/__init__.py):

* behaviour does not change: `extra="ignore"`, the unknown key is dropped exactly as before;
* a `model_validator(mode="before")` compares the incoming keys with the model's field names and aliases; for each unknown key it logs
  one line per (model, key) per process and counts it (`counts()`; the /health diagnostics block shows the totals);
* `SW_REQUEST_STRICT=1` (set by the backend tests, like `SW_WIRE_STRICT`) raises instead, so a test that sends an extra key fails;
  `SW_REQUEST_OBSERVE_DUMP=<file>` (a test aid) appends every unknown (model, key) to a file, strict or not.

A subclass that sets `extra="forbid"` or `extra="allow"` has decided already and is not observed. The log line names the model and the
key (field names of the API, never a value) and the request's correlation id when there is one."""
from __future__ import annotations

import functools
import logging
import os
import threading
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator

from ..test_reset import register_reset

log = logging.getLogger(__name__)
_LOCK = threading.Lock()
_SEEN: dict[tuple[str, str], int] = {}  # (model, key) -> how many requests carried it in this process
_MAX_KEYS = 500  # bounded like wire._REPORTED: a client sending random keys cannot grow the table without limit
_OVERFLOW = [0]


def strict() -> bool:
    """`SW_REQUEST_STRICT=1`: an unknown key raises (tests); otherwise it is logged once and dropped as before."""
    return os.environ.get("SW_REQUEST_STRICT") == "1"


@functools.cache
def _known(cls: type[BaseModel]) -> frozenset[str]:
    names: set[str] = set()
    for name, info in cls.model_fields.items():
        names.add(name)
        for alias in (info.alias, info.validation_alias):
            if isinstance(alias, str):
                names.add(alias)
            elif alias is not None:  # AliasChoices / AliasPath
                for choice in getattr(alias, "choices", ()):
                    if isinstance(choice, str):
                        names.add(choice)
                    elif getattr(choice, "path", None) and isinstance(choice.path[0], str):
                        names.add(choice.path[0])
    return frozenset(names)


def _correlation() -> str:
    try:
        from ..correlation_id import CURRENT
        return CURRENT.get() or "-"
    except Exception:  # noqa: BLE001 - observation never breaks a request
        return "-"


def _note(model: str, keys: list[str]) -> None:
    fresh: list[str] = []
    with _LOCK:
        for key in keys:
            ident = (model, key)
            if ident in _SEEN:
                _SEEN[ident] += 1
            elif len(_SEEN) < _MAX_KEYS:
                _SEEN[ident] = 1
                fresh.append(key)
            else:
                _OVERFLOW[0] += 1
    for key in fresh:
        log.warning("request carries an undeclared key: %s.%s (dropped as before; correlation_id=%s)", model, key, _correlation())


def _dump(model: str, keys: list[str]) -> None:
    """Test aid: `SW_REQUEST_OBSERVE_DUMP=<file>` appends `model<TAB>key` for every unknown key seen (also in strict mode, where the
    request is refused), so a whole backend suite run lists every (model, key) the tests send extra. Unset in production."""
    path = os.environ.get("SW_REQUEST_OBSERVE_DUMP")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf8") as f:
            f.writelines(f"{model}\t{k}\n" for k in keys)
    except OSError:
        pass


def counts() -> dict[str, Any]:
    """Diagnostics: `{distinct, total, overflow, items}` - the (model, key) pairs seen by this process, most frequent first (at most 20)."""
    with _LOCK:
        rows = sorted(_SEEN.items(), key=lambda kv: (-kv[1], kv[0]))
        return {"distinct": len(rows), "total": sum(n for _, n in rows) + _OVERFLOW[0], "overflow": _OVERFLOW[0],
                "items": [{"model": m, "key": k, "count": n} for (m, k), n in rows[:20]]}


def _reset() -> None:
    with _LOCK:
        _SEEN.clear()
        _OVERFLOW[0] = 0


register_reset(__name__, ("_SEEN", "_OVERFLOW"), _reset)  # tests start from an empty table (tests/test_singletons_registered.py)


class RequestModel(BaseModel):
    """Base of a tolerant web-UI request body: unknown keys are dropped as before, but logged and counted (strict mode: refused)."""

    model_config = ConfigDict(extra="ignore", protected_namespaces=())

    @model_validator(mode="before")
    @classmethod
    def _observe(cls, data: Any) -> Any:
        if not isinstance(data, dict) or cls.model_config.get("extra", "ignore") != "ignore":
            return data
        unknown = sorted(k for k in data if isinstance(k, str) and k not in _known(cls))
        if unknown:
            _dump(cls.__name__, unknown)
            if strict():
                raise ValueError(f"{cls.__name__}: undeclared keys {unknown}")
            _note(cls.__name__, unknown)
        return data
