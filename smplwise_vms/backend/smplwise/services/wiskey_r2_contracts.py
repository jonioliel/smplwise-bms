"""WISKEY-R2-ALIGN-2272: closed readers for the WisKey R2 contracts (consumers only - nothing here sends, installs or writes).

* `read_readiness` - `installation/readiness_v1` (`wiskey-installation-readiness.v1`): "expected / staged / installed / loaded" for both
  components. `ready` needs all four digest sets equal, the two components present, and a boot / connection / bridge boot id; anything
  else is refused (`installation_readiness_invalid`) or reported as `not_ready` with the closed reason. It proves nothing about hardware,
  cloud approval or a grant (Arx never creates one).
* `read_event_retention` - `events/retention_policy_v1` (`wiskey-event-retention.v1`): the retention the install really applies; the
  defaults (30 days / 5000 records) are not a guarantee, `minimum_days_guaranteed` is always false.
* `outcome_known` / `PUBLIC_OUTCOMES` - the code table (`contracts/wiskey/r2/public_outcomes.compact.json`): a wire value is never
  rewritten; an unknown code is an unrecognised refusal, never success and never `not_sent`.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from .wiskey_auto_install import InstallationError

COMPONENTS = ("smplwise_bridge", "hikvision_intercom")
_SHA = re.compile(r"^[0-9a-f]{64}$")
_ID = re.compile(r"^[^\x00-\x1f\x7f]{1,128}$")
READY_REASONS = frozenset({None, "generation_missing", "generation_invalid", "generation_not_installed", "bridge_not_loaded",
                           "distribution_digest_mismatch", "generation_or_distribution_unavailable", "restart_pending", "restart_request_failed"})
RESTART_STATES = frozenset({"not_requested", "requested", "failed", "unknown", "completed"})
_READINESS_KEYS = frozenset({"contract", "schema_version", "state", "reason", "generation_id", "boot_id", "process_id", "expected", "staged",
                             "installed", "loaded", "bridge_boot_id", "restart", "connection_ref", "bridge_entry_id", "installation_id",
                             "grant_ref", "cloud_resources_state"})


def _bad() -> InstallationError:
    return InstallationError("installation_readiness_invalid")


def _digests(value: Any, *, partial: bool = False) -> dict[str, Any]:
    if type(value) is not dict or not set(value) <= set(COMPONENTS) or (not partial and set(value) != set(COMPONENTS)):
        raise _bad()
    for v in value.values():
        if not (v is None or (type(v) is str and _SHA.match(v))):
            raise _bad()
    return value


def read_readiness(reply: Any, manifest: dict[str, Any] | None = None) -> dict[str, Any]:
    """Validate a `installation/readiness_v1` answer. When the install manifest (the checked `wiskey-local-installation.v1` document) is
    given, the answer's installation / bridge entry identity must be the manifest's first entry (a mismatch is refused: the caller must
    reconnect, never trust an answer of another installation)."""
    if (type(reply) is not dict or set(reply) != _READINESS_KEYS or reply["contract"] != "wiskey-installation-readiness.v1"
            or type(reply["schema_version"]) is not int or reply["schema_version"] != 1
            or reply["state"] not in ("ready", "not_ready") or reply["reason"] not in READY_REASONS):
        raise _bad()
    for key in ("boot_id", "connection_ref", "bridge_entry_id", "installation_id"):
        if type(reply[key]) is not str or not _ID.match(reply[key]):
            raise _bad()
    if type(reply["process_id"]) is not int or isinstance(reply["process_id"], bool) or reply["process_id"] < 1:
        raise _bad()
    for key in ("generation_id", "bridge_boot_id"):
        if not (reply[key] is None or type(reply[key]) is str):
            raise _bad()
    if type(reply["cloud_resources_state"]) is not str or type(reply["grant_ref"]) is not dict:
        raise _bad()
    restart = reply["restart"]
    if restart is not None and (type(restart) is not dict or set(restart) != {"state", "boot_id"} or restart["state"] not in RESTART_STATES
                                or not (restart["boot_id"] is None or type(restart["boot_id"]) is str)):
        raise _bad()
    expected, staged, installed = (_digests(reply[k]) for k in ("expected", "staged", "installed"))
    loaded = _digests(reply["loaded"], partial=True)
    if reply["state"] == "ready":
        # ready = the four digest sets agree for both components, in one process, with a verified bridge boot and a generation
        if (reply["reason"] is not None or not reply["generation_id"] or not reply["bridge_boot_id"]
                or any(None in d.values() for d in (expected, staged, installed)) or set(loaded) != set(COMPONENTS)
                or not (expected == staged == installed == loaded)):
            raise _bad()
    elif reply["reason"] is None:
        raise _bad()
    if manifest is not None:
        row = manifest["entries"][0]
        if (reply["installation_id"] != manifest["installation_id"] or reply["bridge_entry_id"] != row["entry_id"]
                or reply["grant_ref"] != row["grant_ref"]):
            raise InstallationError("installation_changed_reconnect_required")
    return reply


def read_event_retention(reply: Any) -> dict[str, Any]:
    """Validate `events/retention_policy_v1`. Returns the closed document; `effective` is what this install really applies."""
    if (type(reply) is not dict or set(reply) != {"contract", "schema_version", "effective", "order", "delivery", "age_basis", "minimum_days_guaranteed"}
            or reply["contract"] != "wiskey-event-retention.v1" or reply["schema_version"] != 1 or type(reply["schema_version"]) is not int
            or reply["order"] != "local_acceptance_sequence" or reply["delivery"] != "at_least_once" or reply["age_basis"] != "received_at"
            or reply["minimum_days_guaranteed"] is not False):
        raise InstallationError("event_retention_invalid")
    eff = reply["effective"]
    if type(eff) is not dict or set(eff) != {"days", "count", "bytes"}:
        raise InstallationError("event_retention_invalid")
    for key, lo, hi in (("days", 1, 365), ("count", 1, 20000)):
        if type(eff[key]) is not int or isinstance(eff[key], bool) or not lo <= eff[key] <= hi:
            raise InstallationError("event_retention_invalid")
    b = eff["bytes"]
    if not (b is None or (type(b) is int and not isinstance(b, bool) and 262144 <= b <= 25165824)):
        raise InstallationError("event_retention_invalid")
    return reply


OUTCOMES_PATH = Path(__file__).resolve().parents[4] / "contracts" / "wiskey" / "r2" / "public_outcomes.compact.json"


@lru_cache(maxsize=1)
def public_outcomes() -> dict[str, Any]:
    """The compact R2 code table (read only, cached). Missing in an image without `contracts/` -> `{}` (callers fail closed)."""
    try:
        return json.loads(OUTCOMES_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def outcome_known(wire_value: Any) -> bool:
    """True for a wire code that appears in the R2 table. The value itself is never rewritten; False means unrecognised -
    treat as an uncertain refusal (no retry, no conversion to success or `not_sent`)."""
    return type(wire_value) is str and wire_value in public_outcomes().get("CODES", {})
