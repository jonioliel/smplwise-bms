"""Response models of routers/wiskey_managed.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from typing import Any

from . import ExactModel, Num

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'PUT /wiskey/managed/keep-runs'})


class WiskeyManagedManagedSwitches(ExactModel):
    enabled: str
    core_risk: str
    startup: str


class WiskeyManagedManagedPhrases(ExactModel):
    enabled: str
    core_risk: str
    startup: str
    adopt: str


class WiskeyManagedManagedBundle(ExactModel):
    state: str
    code: str | None
    version: str | None
    digest: str | None
    product_CODE: str | None
    files: Num | None


class WiskeyManagedManagedInstalledMarkers(ExactModel):
    component: str = None
    config: str = None


class WiskeyManagedManagedInstalled(ExactModel):
    state: str
    ownership: str
    version: str | None
    label: str | None
    digest: str | None
    profile: str | None
    markers: WiskeyManagedManagedInstalledMarkers


class WiskeyManagedManagedAdoption(ExactModel):
    version: str
    label: str
    digest: str
    at: str
    backup: str


class WiskeyManagedManagedJobStep(ExactModel):
    at: str
    code: str | None
    name: str
    state: str


class WiskeyManagedManagedJob(ExactModel):
    id: str
    kind: str
    state: str
    code: str | None
    plan: str | None
    from_version: str | None
    to_version: str | None
    steps: list[WiskeyManagedManagedJobStep]
    started_at: str | None
    finished_at: str
    core_gate: str | None
    risk_accepted: bool | None
    storage_restored: bool | None
    rollback_of: str | None
    origin: str | None


class WiskeyManagedManaged(ExactModel):
    """WISKEY-MANAGED-INSTALL-2382: installed / shipped WisKey versions, ownership, plan, switches and the last run (system administrator)."""
    switches: WiskeyManagedManagedSwitches
    phrases: WiskeyManagedManagedPhrases
    keep_runs: Num
    keep_runs_range: list[Num]
    backup_max_age_h: Num
    startup_attempt: Any
    bundle: WiskeyManagedManagedBundle
    installed: WiskeyManagedManagedInstalled
    plan: str
    runnable: bool
    adoptable: bool
    adoption: WiskeyManagedManagedAdoption | None
    job: WiskeyManagedManagedJob | None
    running: bool
    rollback_available: bool
    unattended_permitted: bool


class WiskeyManagedPutSwitchBundle(ExactModel):
    state: str
    code: Any
    version: str
    digest: str
    product_CODE: str
    files: Num


class WiskeyManagedPutSwitchInstalledMarkers(ExactModel):
    component: str
    config: str


class WiskeyManagedPutSwitchInstalled(ExactModel):
    state: str
    ownership: str
    version: str | None
    label: str | None
    digest: str | None
    profile: str | None
    markers: WiskeyManagedPutSwitchInstalledMarkers


class WiskeyManagedPutSwitch(ExactModel):
    """WISKEY-MANAGED-INSTALL-2382: turn the managed installation (or the accepted Core-image risk) on with the typed phrase, or off (system administrator)."""
    switches: WiskeyManagedManagedSwitches
    phrases: WiskeyManagedManagedPhrases
    keep_runs: Num
    keep_runs_range: list[Num]
    backup_max_age_h: Num
    startup_attempt: Any
    bundle: WiskeyManagedPutSwitchBundle
    installed: WiskeyManagedPutSwitchInstalled
    plan: str
    runnable: bool
    adoptable: bool
    adoption: WiskeyManagedManagedAdoption | None
    job: Any
    running: bool
    rollback_available: bool
    unattended_permitted: bool


class WiskeyManagedPostCheckItem(ExactModel):
    name: str
    state: str
    code: str | None


class WiskeyManagedPostCheck(ExactModel):
    """WISKEY-MANAGED-INSTALL-2382: the dry run of a managed upgrade - preflight, Core gate, full-backup check; reads only (system administrator)."""
    plan: str
    items: list[WiskeyManagedPostCheckItem]
    ready: bool


class WiskeyManagedPostAdoptInstalled(ExactModel):
    state: str
    ownership: str
    version: str
    label: str
    digest: str
    profile: str
    markers: WiskeyManagedPutSwitchInstalledMarkers


class WiskeyManagedPostAdopt(ExactModel):
    """WISKEY-MANAGED-INSTALL-2382: convert the manual WisKey install into "managed by Arx" (typed phrase, private backup, audited; no config write)."""
    switches: WiskeyManagedManagedSwitches
    phrases: WiskeyManagedManagedPhrases
    keep_runs: Num
    keep_runs_range: list[Num]
    backup_max_age_h: Num
    startup_attempt: Any
    bundle: WiskeyManagedPutSwitchBundle
    installed: WiskeyManagedPostAdoptInstalled
    plan: str
    runnable: bool
    adoptable: bool
    adoption: WiskeyManagedManagedAdoption
    job: Any
    running: bool
    rollback_available: bool
    unattended_permitted: bool


class WiskeyManagedPostUpgradeJobStep(ExactModel):
    name: str
    state: str
    code: str | None
    at: str


class WiskeyManagedPostUpgradeJob(ExactModel):
    id: str
    kind: str
    state: str
    code: str | None
    plan: str
    from_version: str | None
    to_version: str
    steps: list[WiskeyManagedPostUpgradeJobStep]
    started_at: str
    finished_at: str
    core_gate: str
    risk_accepted: bool
    storage_restored: bool
    rollback_of: Any
    origin: str


class WiskeyManagedPostUpgrade(ExactModel):
    """WISKEY-MANAGED-INSTALL-2382: start the managed install / upgrade / conversion (backup check, Core stop/start, verified swap, compare, rollback)."""
    job: WiskeyManagedPostUpgradeJob


class WiskeyManagedPostRollbackJobStep(ExactModel):
    name: str
    state: str
    code: Any
    at: str


class WiskeyManagedPostRollbackJob(ExactModel):
    id: str
    kind: str
    state: str
    code: Any
    plan: str
    from_version: str
    to_version: str
    steps: list[WiskeyManagedPostRollbackJobStep]
    started_at: str
    finished_at: str
    core_gate: Any
    risk_accepted: bool
    storage_restored: bool
    rollback_of: str
    origin: str


class WiskeyManagedPostRollback(ExactModel):
    """WISKEY-MANAGED-INSTALL-2382: put back the WisKey tree the last managed run replaced (Core stop/start, compare)."""
    job: WiskeyManagedPostRollbackJob
