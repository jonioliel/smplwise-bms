"""Response models of routers/wiskey_installer_technical.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations


# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-control/installer/technical/stations/{station_id}', 'PUT /access-control/installer/technical/stations/{station_id}/doors/{door}'})
