"""Response models of routers/access_station_permissions.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-station-permissions/people/{person_id}', 'POST /access-station-permissions/people/{person_id}/stations/{station_id}/approve', 'POST /access-station-permissions/people/{person_id}/stations/{station_id}/refuse', 'POST /access-station-permissions/people/{person_id}/stations/{station_id}/sync', 'PUT /access-station-permissions/people/{person_id}/stations/{station_id}', 'PUT /access-station-permissions/settings'})


class AccessStationPermissionsSettings(ExactModel):
    station_permissions: str
    go_live_permitted: bool
