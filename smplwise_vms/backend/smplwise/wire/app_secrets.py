"""Response models of routers/app_secrets.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""
from __future__ import annotations

from . import ExactModel

# routes without a JSON body
NO_JSON: frozenset[str] = frozenset()
# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet
# (scripts/wire_ratchet.py) until they are modelled
UNMODELLED: frozenset[str] = frozenset({'POST /system/secrets/{name}/test'})


class AppSecretsSecretsSecret(ExactModel):
    name: str
    label_he: str
    label_en: str
    restart_required: bool
    testable: bool
    configured: bool
    state: str
    source: str | None
    updated_at: str | None
    updated_by: str | None
    updated_by_name: str | None


class AppSecretsSecrets(ExactModel):
    secrets: list[AppSecretsSecretsSecret]
    in_addon: bool


class AppSecretsSaveSecretSecret(ExactModel):
    name: str
    label_he: str
    label_en: str
    restart_required: bool
    testable: bool
    configured: bool
    state: str
    source: str
    updated_at: str
    updated_by: str
    updated_by_name: str


class AppSecretsSaveSecret(ExactModel):
    saved: bool
    restart_required: bool
    secret: AppSecretsSaveSecretSecret


class AppSecretsClearSecret(ExactModel):
    cleared: bool
    restart_required: bool
    secret: AppSecretsSaveSecretSecret
