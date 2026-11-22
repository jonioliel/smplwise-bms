"""Response models of routers/capture_lease.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class CaptureLeaseLeaseSettings(ExactModel):
    capture_lease: str
    capture_lease_available: bool
    capture_lease_go_live_permitted: bool
    capture_lease_seconds: Num
    capture_lease_seconds_values: list[Num]
    lookup_scope: str
    lookup_scope_values: list[str]
    degraded: bool
    ledger_busy: bool
    clock_untrusted: bool
