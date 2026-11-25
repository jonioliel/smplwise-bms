"""WISKEY-RELAY-INV-2520 (row R3 of docs/changes/WISKEY-RESYNC-2520.md; WisKey master ids R5, B4, F1): Arx's READ-ONLY consumer of
WisKey's `stations/relay_inventory_v1` - what WisKey knows about one station's relays, shown next to Arx's own relay map.

| WisKey command                  | contract (WisKey PRODUCT 3e7bfc58, 2.0.1-rc.19)        | WisKey permission                          |
|---------------------------------|--------------------------------------------------------|--------------------------------------------|
| `stations/relay_inventory_v1`   | docs/contracts/relay-inventory-v1 (schema 1, api 1)    | READ, `stations: view` + the station scope |

The command is a READ in WisKey's api_contract (`READ_COMMANDS`), so the frame is `{type, station_id}` only - no `api_contract`, no other
key. WisKey answers from the station profile it loaded (no device read, no storage write, no relay). It leaves Arx on the closed
`relay_inventory` channel (services/wiskey_channels.py, registered by WISKEY-RESYNC-2520), once, never queued, never retried, and only
when WisKey lists the command for the add-on's identity in `overview.api.commands` (capability discovery: an unlisted command, an
unknown command list, no served copy or a WisKey that needs a newer client send NOTHING; the lab's rc.10 does not list it).

What the answer is NOT, and Arx never turns it into:
- a relay test. WisKey's `non_actuating_test` is pinned `{supported: false, reason: relay_test_unsupported_v1}`; there is no harmless
  relay test, a `dry_run` flag does not make one, and Arx neither sends one nor offers one. A physical mapping / pulse check stays an
  owner approval per door and time, outside this read.
- a physical count. `api_outputs.ids` / `count` are the remote-control API outputs the station profile reported at load (1 and / or 2),
  not physical relays; `count: null` with `evidence: not_observed` means "not observed", never zero relays. `physical_relay_count` is
  pinned null and `physical_verified` pinned false: shown as "unknown" / "not verified".
- a role. Every role is pinned `unknown` (labels cannot establish a door / gate role): shown as unknown, never guessed from a name.
- an approval. `configured_mapping` is WisKey's SAVED configuration (`confirmation: saved_configuration`), not a measurement; Arx's own
  relay map (services/wiskey_relay_map.py) is Arx's approval and stays exactly as it was - nothing here writes it, and `single_relay` is
  never inferred from `api_outputs.count`.

Closed projection: the contract's result schema is closed (`additionalProperties: false` everywhere) and pins its constants, so the
document is CHECKED, not copied: an undeclared key, a value of the wrong type (`"false"` is not `false`, `true` is not `1`), a constant
that says anything else (a role other than `unknown`, a physical count, `physical_verified: true`, a supported relay test), an id outside
1 / 2, an inconsistent output block or another station's id refuses the whole document (`contract_mismatch`) - Arx never shows a part of
an answer that claims more than the contract allows.

The caller's permission is Arx's (routers/wiskey_relay_map.py, the relay map card's own permission on the station's chain, audited 403
before anything is sent). WisKey's refusal of the add-on identity (`unauthorized`) is `forbidden`; its local refusal `station_unloaded`
(the station's runtime is not loaded) is `unavailable` - neither is retried, and no other command is sent instead. Tests:
tests/test_wiskey_relay_inventory_2520.py (fake SYNC and WisKey's own synthetic contract examples only)."""
from __future__ import annotations

import re
from typing import Any

from ..config import Settings
from ..errors import ApiError
from . import intercom_client, intercom_sync
from .intercom_client import IntercomError

COMMAND = "stations/relay_inventory_v1"
CHANNEL = "relay_inventory"  # services/wiskey_channels.py RELAY_INVENTORY (registered by WISKEY-RESYNC-2520)
KEY = "relay_inventory"  # the reply key of intercom_sync.command
READ_TIMEOUT_S = 25.0  # WisKey answers from the loaded profile (no device read); the feed's ordinary read limit
UNKNOWN = "unknown"

API_IDS = (1, 2)  # WisKey: the supported remote-control API output ids
EVIDENCE = ("device_capability_at_load", "not_observed")
TEST_UNSUPPORTED = "relay_test_unsupported_v1"
STATION_UNLOADED = "station_unloaded"

RESULT_KEYS = frozenset({"schema", "station_id", "api_outputs", "configured_mapping", "physical_relay_count", "physical_verified", "non_actuating_test"})
OUTPUT_KEYS = frozenset({"ids", "count", "evidence", "roles"})
ROLE_KEYS = frozenset({"api_id", "role"})
MAPPING_KEYS = frozenset({"physical_index", "api_id", "confirmation", "role"})
TEST_KEYS = frozenset({"supported", "reason"})
CODE = re.compile(r"[a-z0-9][a-z0-9_.:/-]{0,95}")

NOT_READY = frozenset({"ha_not_configured", "connecting", "ha_unavailable", "not_installed", "idle"})


class ContractMismatch(ValueError):
    """The document breaks the closed relay-inventory-v1 result schema: refused as a whole, never shown in part."""


# ---------------------------------------------------------------- the closed projection

def _closed(v: Any, keys: frozenset[str], what: str) -> dict[str, Any]:
    """An object with exactly the contract's keys (every key of these objects is required; no undeclared key)."""
    if not isinstance(v, dict) or set(v) != keys:
        raise ContractMismatch(what)
    return v


def _const(value: Any, wanted: Any, what: str) -> None:
    """A contract constant: the exact JSON value, type included (`0` is not `false`, `"false"` is not `false`)."""
    if type(value) is not type(wanted) or value != wanted:
        raise ContractMismatch(what)


def _api_id(v: Any, what: str) -> int:
    if type(v) is not int or v not in API_IDS:
        raise ContractMismatch(what)
    return v


def _outputs(v: Any) -> dict[str, Any]:
    o = _closed(v, OUTPUT_KEYS, "api_outputs")
    raw_ids = o["ids"]
    if not isinstance(raw_ids, list) or len(raw_ids) > len(API_IDS):
        raise ContractMismatch("api_outputs.ids")
    ids = [_api_id(x, "api_outputs.ids") for x in raw_ids]
    if len(set(ids)) != len(ids):
        raise ContractMismatch("api_outputs.ids")
    count = o["count"]
    if count is not None and (type(count) is not int or count not in (1, 2)):
        raise ContractMismatch("api_outputs.count")
    evidence = o["evidence"]
    if not isinstance(evidence, str) or evidence not in EVIDENCE:
        raise ContractMismatch("api_outputs.evidence")
    # one meaning only: observed = a count equal to the ids; not observed = no count (null, never 0) and no id
    if evidence == "device_capability_at_load":
        if count is None or count != len(ids):
            raise ContractMismatch("api_outputs.count")
    elif count is not None or ids:
        raise ContractMismatch("api_outputs.not_observed")
    raw_roles = o["roles"]
    if not isinstance(raw_roles, list) or len(raw_roles) > len(API_IDS):
        raise ContractMismatch("api_outputs.roles")
    roles = []
    for r in raw_roles:
        r = _closed(r, ROLE_KEYS, "api_outputs.roles")
        _const(r["role"], UNKNOWN, "api_outputs.roles.role")
        roles.append({"api_id": _api_id(r["api_id"], "api_outputs.roles.api_id"), "role": UNKNOWN})
    if sorted(r["api_id"] for r in roles) != sorted(ids):
        raise ContractMismatch("api_outputs.roles")
    return {"ids": sorted(ids), "count": count, "evidence": evidence, "roles": sorted(roles, key=lambda r: r["api_id"])}


def _mapping(v: Any) -> list[dict[str, Any]]:
    if not isinstance(v, list) or len(v) > len(API_IDS):
        raise ContractMismatch("configured_mapping")
    rows = []
    for item in v:
        m = _closed(item, MAPPING_KEYS, "configured_mapping")
        _const(m["confirmation"], "saved_configuration", "configured_mapping.confirmation")
        _const(m["role"], UNKNOWN, "configured_mapping.role")
        rows.append({"physical_index": _api_id(m["physical_index"], "configured_mapping.physical_index"),
                     "api_id": _api_id(m["api_id"], "configured_mapping.api_id"), "confirmation": "saved_configuration", "role": UNKNOWN})
    return sorted(rows, key=lambda r: (r["physical_index"], r["api_id"]))


def project(raw: Any, station_id: str) -> dict[str, Any]:
    """`stations/relay_inventory_v1` -> the closed inventory of `station_id` (see the module note). Raises ContractMismatch."""
    doc = _closed(raw, RESULT_KEYS, "result")
    _const(doc["schema"], 1, "schema")
    _const(doc["station_id"], station_id, "station_id")  # the answer is about the station asked for, or it is not shown
    _const(doc["physical_relay_count"], None, "physical_relay_count")
    _const(doc["physical_verified"], False, "physical_verified")
    test = _closed(doc["non_actuating_test"], TEST_KEYS, "non_actuating_test")
    _const(test["supported"], False, "non_actuating_test.supported")
    _const(test["reason"], TEST_UNSUPPORTED, "non_actuating_test.reason")
    return {
        "station_id": station_id,
        "api_outputs": _outputs(doc["api_outputs"]),
        "configured_mapping": _mapping(doc["configured_mapping"]),
        "physical_relay_count": None,  # unknown - never a number Arx made up, never the API output count
        "physical_verified": False,
        "non_actuating_test": {"supported": False, "reason": TEST_UNSUPPORTED},
    }


# ---------------------------------------------------------------- the read

async def send(call: intercom_client.Call, station_id: str) -> Any:
    """ONE frame: `{type, station_id}` (a READ command: no `api_contract`, no other key)."""
    frame = await call(intercom_client.command_type(COMMAND), station_id=station_id)
    if isinstance(frame, dict) and frame.get("success") is True:
        return frame.get("result")
    if isinstance(frame, dict) and frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = error.get("code")
        raise IntercomError(code if isinstance(code, str) and CODE.fullmatch(code) else "other", COMMAND)
    raise IntercomError("invalid_response", COMMAND)


def availability(settings: Settings) -> tuple[bool, str | None]:
    """(listed, reason) from the served copy's `api` facts. Fail closed: no served copy, an unknown command list or a WisKey that needs
    a newer client means nothing is sent."""
    facts = intercom_sync.SYNC.api_facts(settings)
    if facts is None:
        return False, "no_copy"
    min_client = facts.get("min_client")
    if isinstance(min_client, int) and not isinstance(min_client, bool) and min_client > intercom_client.API_CONTRACT:
        return False, "api_incompatible"
    names = facts.get("commands")
    if not isinstance(names, (list, set, frozenset, tuple)):
        return False, "commands_unknown"
    return (True, None) if COMMAND in names else (False, "not_listed")


def _answer(state: str, reason: str | None, code: str | None = None, fetched_at: Any = None, data: Any = None) -> dict[str, Any]:
    return {"state": state, "reason": reason, "wiskey_code": code, "fetched_at": fetched_at, "data": data}


def read(settings: Settings, station_id: str, who: str) -> dict[str, Any]:
    """One inventory read of one station: `{state, reason, wiskey_code, fetched_at, data}`. `state`: `ready` (with `data`), `unsupported`
    (this WisKey does not list the command: nothing sent), `forbidden` (WisKey refused the add-on identity), `unavailable` (no live
    session, or WisKey's `station_unloaded`), `busy` (Arx's or WisKey's rate limit / slots) or `error` (`contract_mismatch` / another
    WisKey code). `data` is null unless ready. The caller has checked Arx's permission and that the station is in the served copy."""
    listed, reason = availability(settings)
    if not listed:
        return _answer("unsupported", reason)
    mismatch: list[str] = []

    def projected(raw: Any) -> Any:
        try:
            return project(raw, station_id)
        except ContractMismatch:
            mismatch.append("contract_mismatch")
            raise

    try:
        reply = intercom_sync.SYNC.command(settings, KEY, lambda call: send(call, station_id), projected, who=who, timeout=READ_TIMEOUT_S,
                                           channel=CHANNEL)
    except ApiError as exc:  # WisKey's request-level refusal (e.g. `station_not_found`): no other command is tried
        wiskey = exc.details.get("wiskey_code") if isinstance(exc.details, dict) else None
        return _answer("unavailable", "wiskey_station_unknown", wiskey if isinstance(wiskey, str) else exc.code)
    data = reply.get(KEY)
    state, code = str(reply.get("state") or "error"), reply.get("last_error")
    code = code if isinstance(code, str) and code else None
    if state == "ready" and data is not None:
        return _answer("ready", None, None, reply.get("fetched_at"), data)
    if mismatch:
        return _answer("error", "contract_mismatch")
    if state == "forbidden" or code == "unauthorized":
        return _answer("forbidden", "wiskey_refused", code)
    if code == STATION_UNLOADED:
        return _answer("unavailable", STATION_UNLOADED, code)
    if state == "unsupported" or code in ("unknown_command", "not_listed"):
        return _answer("unsupported", "wiskey_unknown_command", code)
    if state == "rate_limited" or code in ("rate_limited", "busy"):
        return _answer("busy", code or state, code)
    if state in NOT_READY:
        return _answer("unavailable", state, code)
    return _answer("error", code or state, code)
