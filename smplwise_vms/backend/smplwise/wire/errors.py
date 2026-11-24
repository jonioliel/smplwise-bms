"""The error envelope as models - ADR-019 Step 0, item 1 (documentation and type generation only).

No route answers with these models and no handler builds through them: `smplwise/main.py` and `errors.ApiError.payload()` keep building
the five-key dict (ADR-015, MASTER_SPEC ch. 32). They describe that dict so `scripts/gen_wire_types.py` can write
`frontend/src/api/generated/wire-errors.ts`, the type `ApiErrorBody` in `frontend/src/api/client.ts` is taken from, and so the field
keys of ADR-019 D1 have one written definition.

ADR-019 D1: an error about one or more input fields carries, under `details`, `fields` (names, REQUIRED when the refusal names a field)
and optionally `problems` (one entry per field and reason). The rest of `details` stays endpoint-specific (limits, `revision`, `reason`,
`message_en`, ...); `details.errors` is the global handler's raw pydantic list. During the migration a family still sends its legacy key
(`field`, `key`, `fields` as objects / a map, a domain `errors` list) next to the canonical ones."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FieldProblem(BaseModel):
    """One field and one reason (ADR-019 D1 `details.problems[]`)."""

    model_config = ConfigDict(extra="forbid")

    field: str = Field(description="Dotted path of the field relative to the body or the query (`doors.pairs[0].lock_entity_id`, `name`, `body`).")
    code: str = Field(description="A stable machine word: the pydantic error type (`missing`, `string_too_long`, `extra_forbidden`, ...) or a domain word.")
    message: str = Field(default="", description="The server's Hebrew text for this field, when it has one (absent otherwise).")


class FieldErrorDetails(BaseModel):
    """The canonical field keys of an error's `details` (ADR-019 D1); other keys of `details` are endpoint-specific."""

    model_config = ConfigDict(extra="allow")

    fields: list[str] = Field(default_factory=list, description="The fields the refusal names, each once, in the order of the problems.")
    problems: list[FieldProblem] = Field(default_factory=list, description="Per-field reasons, when the endpoint has them.")


class ErrorEnvelope(BaseModel):
    """Every error answer of the main app (ADR-015, MASTER_SPEC ch. 32). The public ticket app (CR-038) has its own vocabulary."""

    model_config = ConfigDict(extra="allow")

    code: str = Field(description="Stable machine code (`validation`, `forbidden`, a domain code); `http_<status>` is the client's fallback.")
    user_message: str = Field(description="The Hebrew text a screen may show.")
    retryable: bool
    correlation_id: str
    details: dict[str, Any] = Field(description="Non-sensitive details; for a field error see FieldErrorDetails.")


# the models gen_wire_types.py writes, in this order
MODELS: tuple[type[BaseModel], ...] = (ErrorEnvelope, FieldErrorDetails, FieldProblem)
