"""Response models of routers/wiskey_installer_platform.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'GET /access-control/installer/platform/export', 'POST /access-control/installer/platform/config/apply', 'POST /access-control/installer/platform/config/preview', 'POST /access-control/installer/platform/config/read', 'POST /access-control/installer/platform/import/apply', 'POST /access-control/installer/platform/import/preview', 'POST /access-control/installer/platform/maintenance/enqueue', 'POST /access-control/installer/platform/maintenance/jobs/{job_id}/cancel', 'POST /access-control/installer/platform/maintenance/preview', 'POST /access-control/installer/platform/retention/apply', 'POST /access-control/installer/platform/retention/preview', 'POST /access-control/installer/platform/webhook/key', 'PUT /access-control/installer/platform/stations/{station_id}', 'PUT /access-control/installer/platform/webhook'})


class WiskeyInstallerPlatformPlatformViewPlatformError(ExactModel):
    code: str
    wiskey_code: str
    message: str


class WiskeyInstallerPlatformPlatformViewPlatform(ExactModel):
    state: str
    error: WiskeyInstallerPlatformPlatformViewPlatformError | None
    fetched_at: Any
    data: Any


class WiskeyInstallerPlatformPlatformViewTyped(ExactModel):
    webhook_key: str
    import_apply: str
    retention_apply: str
    config_apply: str
    maint_enqueue: str


class WiskeyInstallerPlatformPlatformView(ExactModel):
    platform: WiskeyInstallerPlatformPlatformViewPlatform
    capacity: WiskeyInstallerPlatformPlatformViewPlatform
    integrity: WiskeyInstallerPlatformPlatformViewPlatform
    maintenance: WiskeyInstallerPlatformPlatformViewPlatform
    demo: WiskeyInstallerPlatformPlatformViewPlatform
    stations: Any
    typed: WiskeyInstallerPlatformPlatformViewTyped
