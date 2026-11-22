"""Response models of routers/wiskey_installer_lifecycle.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations


# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-control/installer/lifecycle', 'GET /access-control/installer/lifecycle/jobs/{job_id}/plan', 'GET /access-control/installer/lifecycle/review', 'POST /access-control/installer/lifecycle/jobs/{job_id}/apply', 'POST /access-control/installer/lifecycle/jobs/{job_id}/remove', 'POST /access-control/installer/lifecycle/jobs/{job_id}/verify', 'POST /access-control/installer/lifecycle/prepare', 'POST /access-control/installer/onboarding', 'POST /access-control/installer/onboarding/{flow_id}/abort', 'POST /access-control/installer/onboarding/{flow_id}/steps/{step_id}'})
