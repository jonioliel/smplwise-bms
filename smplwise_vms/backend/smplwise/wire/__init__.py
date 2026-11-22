"""Response models of the HTTP API ("wire" models) - code review 07:F8 step 2, MASTER_PLAN 3.6 "Response models and generated
client types".

A route declares what it answers with `@router.get(path, **wire(Model))`: FastAPI validates the returned dict against the model and
serialises it through the model, the OpenAPI document names the shape, and `scripts/gen_wire_types.py` writes the TypeScript types
the frontend's API modules use (`frontend/src/api/generated/`), so a change of a response is a compile-time error in the client
instead of a run-time surprise.

The models describe the JSON the routes already sent, key for key and in the same order. Three rules keep the answer identical:

* `exclude_unset`: a key a route sometimes leaves out (money without `energy.bills`, a detail-only list) is declared with a default
  and is absent from the answer whenever the route did not set it - never `null` instead of absent.
* number types follow the value: an `int` field never receives a float and the reverse (`1` would become `1.0`); booleans are `bool`.
* drift never breaks a running installation. `WireModel` accepts undeclared keys (they pass through) and, when a value does not fit
  its declared type, logs the drift once and answers the route's dict as it was (the pre-model serialisation). Under
  `SW_WIRE_STRICT=1` (the backend tests set it) both cases raise instead, so a test that reaches the drift fails.

The tests also compare every modelled answer with the pre-model serialisation of the same dict (tests/support/wire_oracle.py)."""
from __future__ import annotations

import logging
import os
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError, model_validator

log = logging.getLogger(__name__)
_REPORTED: set[tuple[str, str]] = set()


def strict() -> bool:
    """`SW_WIRE_STRICT=1`: drift raises (tests); otherwise it is logged once and the answer goes out unchanged."""
    return os.environ.get("SW_WIRE_STRICT") == "1"


def _drift(model: str, what: str) -> None:
    key = (model, what)
    if key in _REPORTED:
        return
    if len(_REPORTED) < 500:
        _REPORTED.add(key)
    log.error("response contract drift in %s: %s (the answer is sent as the route built it)", model, what)


def _reset_reported() -> None:
    _REPORTED.clear()


from ..test_reset import register_reset  # noqa: E402 - imports nothing from the package

# RELEASE-2450-TRAIN: the once-per-drift log set is module state; tests start from an empty set (test_singletons_registered)
register_reset(__name__, ("_REPORTED",), _reset_reported)


class WireModel(BaseModel):
    """Base of every response model: undeclared keys pass through (strict mode: refused), a value of the wrong type falls back to the
    route's own dict for this object (strict mode: refused)."""

    model_config = ConfigDict(extra="allow", protected_namespaces=())

    @model_validator(mode="wrap")
    @classmethod
    def _contract(cls, data: Any, handler: Any) -> Any:
        try:
            out = handler(data)
        except ValidationError as exc:
            if strict() or not isinstance(data, dict):
                raise
            first = exc.errors(include_url=False)[0]
            _drift(cls.__name__, f"{'.'.join(str(p) for p in first.get('loc', ()))}: {first.get('type')}")
            return cls.model_construct(_fields_set=set(data), **data)
        extra = out.__pydantic_extra__
        if extra:
            if strict():
                raise ValueError(f"{cls.__name__}: undeclared keys {sorted(extra)}")
            _drift(cls.__name__, f"undeclared keys {sorted(extra)}")
        return out


class ExactModel(WireModel):
    """A wire model whose values are never converted (RESPONSE-MODELS-E-2480): pydantic's strict mode, so `2.0` never becomes `2` in an
    `int` field, `1` never `True` in a `bool` field and `"5"` never `5` in a number. A value of another type is drift like any other
    (strict tests: refused; otherwise the object goes out as the route built it), so the answer stays byte-identical even where the
    model was written from recorded answers and the code alone. Nested dicts are still read into nested models."""

    model_config = ConfigDict(extra="allow", protected_namespaces=(), strict=True)


def wire(model: Any) -> dict[str, Any]:
    """The route-decorator arguments of a modelled answer: the model (or a union of models when the route answers one of several
    shapes), and keys the route did not set stay absent."""
    return {"response_model": model, "response_model_exclude_unset": True}


# A JSON number whose int / float type is the value's own (a reading, a ratio, a stored number): pydantic's smart union keeps `1` as `1`
# and `1.0` as `1.0`, where a plain `float` field would turn `1` into `1.0` and an `int` field `2.0` into `2`. TypeScript: `number`.
Num = int | float
