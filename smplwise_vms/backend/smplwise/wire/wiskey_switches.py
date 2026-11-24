"""Response models of routers/wiskey_switches.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset()


class WiskeySwitchesSwitches(ExactModel):
    """SMALLFIXA-295 (review 3 G-01): the four wiskey.acr5_* switches and the consumer's go-live permit, plus (S1) wiskey.auto_install and its build permit (system administrator)."""
    switches: dict[str, str]
    go_live_permitted: bool
    auto_install_permitted: bool
