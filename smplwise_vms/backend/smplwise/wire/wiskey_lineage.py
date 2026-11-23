"""Response models of routers/wiskey_lineage.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /access-control/wiskey-lineage/reinitialise', 'POST /access-control/wiskey-lineage/{operation_id}/close', 'POST /access-control/wiskey-lineage/{operation_id}/resolve'})


class WiskeyLineageView(ExactModel):
    installed: bool
    lineage: Any
    discovery: Any = None
