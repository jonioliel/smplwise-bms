"""The v3-addendum vector package for the WisKey trusted caller (`wiskey-trusted-door-v1`), generated and drift-checked.

The package lives in `docs/wiskey-exchange/vectors/trusted-door-v1/v3-addendum/` and is copied unchanged into the
WisKey exchange folder next to `v3/`. It complements `GOLDEN_VECTORS.json` (v1 + v2) and `GOLDEN_VECTORS_v3.json`, which
stay byte-for-byte unchanged (their hashes are checked here and by the package's own stdlib checker).

What the addendum adds, as agreed in the 2026-10-04 exchange (ARX_ACK_TO_V3_ADDENDUM_ACK_2026-10-04):

- `schema`: the corrected `status_unknown` response schema (reason only `pending` | `not_found_or_expired`) and one
  negative case per reason that may no longer appear there.
- `station`: unknown / not loaded / no verified active mapping -> `state/relay_not_allowed` after the capability check
  and before the pending record, with no fallback to a lock or to another station.
- `capabilities`: the read-only `smplwise_bridge.trusted_door_capabilities` hint (schema_version 1), as an Arx-side
  selection/cache model.
- `clock`: the Supervisor time-sync signal (`dt_synchronized`, `dt_utc`, 30 s freshness) on top of the v3 snapshot.
- `anchor`: bootstrap, high-water and the owner-only re-anchor with HMAC-generation rotation, as event scenarios.

Every clock, anchor and capabilities case is a MODEL ONLY (`model_only: true`, `verified: false`): nothing here is an
implementation, and nothing was run against a real system. The reference functions below are TEST code only.

- `pytest tests/test_wiskey_v3_addendum.py` fails on any drift.
- `python tests/test_wiskey_v3_addendum.py --write` rewrites the addendum JSON, MANIFEST.json and SHA256SUMS.

The HMAC key is the public TEST constant of the existing vectors. It is not, and must never become, a pairing secret.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_wiskey_golden_vectors as gv  # noqa: E402

ADDENDUM_DIR = gv.REPO / "docs" / "wiskey-exchange" / "vectors" / "trusted-door-v1" / "v3-addendum"
ADDENDUM_FILE = ADDENDUM_DIR / "GOLDEN_VECTORS_v3_addendum.json"
MANIFEST_FILE = ADDENDUM_DIR / "MANIFEST.json"
SUMS_FILE = ADDENDUM_DIR / "SHA256SUMS"
CHECKER = ADDENDUM_DIR / "check_v3_addendum.py"
CONTRACT_DIR = gv.VECTORS_FILE.parent

PACKAGE = "v3-addendum"
ADDENDUM_VERSION = 1
V3_FILE_SHA256 = "f162f8a8a551be9ce0016844067261473df7e404fedeeb864899ed78b95b1263"
V3_COMMIT = "2439a57a"
V3_CASES = 82

# Files of the earlier packages, pinned by SHA-256 (LF checkout). Paths are relative to the addendum folder in the
# exchange layout (`trusted-door-v1/v3-addendum/`); the checker also understands the repository layout.
PINNED_EARLIER_FILES = [
    {"path": "../GOLDEN_VECTORS.json", "package": "v1+v2", "sha256": gv.V2_FILE_SHA256},
    {"path": "../DTO_DRAFT.md", "package": "v2", "sha256": "07d19c77027d4909f56d6929e2c8338d3e482425f7ca6616e9d0315aa7a6eaeb"},
    {"path": "../NOTE_FOR_WISKEY_v2.md", "package": "v2", "sha256": "52f6c49db7805e588f9f40153988864d8d431fc31de5b064beb54b7c69e7005b"},
    {"path": "../v3/GOLDEN_VECTORS_v3.json", "package": "v3", "sha256": V3_FILE_SHA256},
    {"path": "../v3/DTO_DRAFT_v3.md", "package": "v3", "sha256": "8885d19dcd4a5d30458223dab0b934101ac1031e4822b0c3947edb78370f83ae"},
    {"path": "../v3/NOTE_FOR_WISKEY_v3.md", "package": "v3", "sha256": "35524d41a54df4e88f32af14a8d6e634bb24ce64f9c65fa5f52ef2c73f9177d2"},
]

GROUPS = ("schema", "station", "capabilities", "clock", "anchor")
MODEL_ONLY_GROUPS = ("capabilities", "clock", "anchor")
T0 = gv.T0
T0_MS = T0 * 1000
ST_NOW = gv._epoch(gv.V2_STATUS["issued_at"])
FLOOR_ISO = "2026-01-01T00:00:00Z"
FLOOR_MS = gv.CLOCK_FLOOR * 1000
SAMPLE_MAX_AGE_MS = 30_000
CAPS_SERVICE = "smplwise_bridge.trusted_door_capabilities"

STATUS_UNKNOWN_REASONS = ("pending", "not_found_or_expired")
NO_LONGER_STATUS_REASONS = ("unconfirmed", "interrupted", "outcome_persistence_failed")

# ---------------------------------------------------------------- corrected response schemas

RESPONSE_SCHEMAS: dict[str, dict[str, Any]] = copy.deepcopy(gv.RESPONSE_SCHEMAS)
RESPONSE_SCHEMAS["status_unknown"] = gv._obj({
    "result": {"const": "unknown"}, "request_id": gv._uuid(), "target_request_id": gv._uuid(),
    "reason": {"enum": list(STATUS_UNKNOWN_REASONS)}})

NO_EFFECTS = {**gv.NO_EFFECTS, "fallback_used": False}
OPENED = {**gv.OPENED, "fallback_used": False}
READ = {**gv.READ, "fallback_used": False}
CLOCK_BLOCKED = {**gv.CLOCK_BLOCKED, "fallback_used": False}


# ---------------------------------------------------------------- helpers

def _rid(tag: str) -> str:
    h = hashlib.sha256(f"v3-addendum-request:{tag}".encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-4{h[13:16]}-8{h[17:20]}-{h[20:32]}"


def _nonce(tag: str) -> str:
    return hashlib.sha256(f"v3-addendum-nonce:{tag}".encode()).hexdigest()[:32]


def _fresh(tag: str, **changes: Any) -> dict[str, Any]:
    return {**gv.DOOR_OPEN, "request_id": _rid(tag), "nonce": _nonce(tag), **changes}


def _status(tag: str, **changes: Any) -> dict[str, Any]:
    return {**gv.V2_STATUS, "request_id": _rid(tag), "nonce": _nonce(tag), **changes}


def _iso_ms(ms: int) -> str:
    s, r = divmod(ms, 1000)
    return datetime.fromtimestamp(s, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S") + f".{r:03d}000+00:00"


def _rejected(stage: str, code: str, rid: str) -> dict[str, Any]:
    return {"result": "rejected", "stage": stage, "code": code, "request_id": rid}


# ---------------------------------------------------------------- reference: clock signal (MODEL ONLY)

DT_UTC_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|\+00:00)")


def dt_utc_valid(value: Any) -> bool:
    """Model rule only: RFC 3339 UTC (`Z` or `+00:00`), optional fraction, a real date. The exact Supervisor spelling and
    supported versions are pinned in COMPAT.md (planned 2026-10-08), not here."""
    if not isinstance(value, str) or not DT_UTC_RE.fullmatch(value):
        return False
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def clock_signal_healthy(sig: dict[str, Any]) -> bool:
    """The Supervisor `/host/info` signal as the bridge sees it. Healthy only with an available Supervisor, a sample read
    without error after the last bridge restart, at most 30 000 ms old by the bridge's monotonic clock (inclusive),
    `dt_synchronized` exactly boolean true and a valid UTC `dt_utc`. `use_ntp` and other sources are ignored."""
    if sig.get("supervisor") != "available":
        return False
    s = sig.get("sample")
    if s is None or s.get("read") != "ok" or s.get("bridge_restarted_since_read"):
        return False
    age = s.get("age_ms")
    if type(age) is not int or not 0 <= age <= SAMPLE_MAX_AGE_MS:
        return False
    body = s.get("body")
    if not isinstance(body, dict) or body.get("dt_synchronized") is not True:
        return False
    return dt_utc_valid(body.get("dt_utc"))


def addendum_door_service(service: str, service_data: Any, now: int | None, setup: dict[str, Any] | None,
                          raw_inner: bytes | None = None) -> tuple[dict[str, Any], dict[str, bool]]:
    """v3 reference path plus the addendum rules: the clock signal is checked first in stage `time` (after the stateless
    window checks of the reference, which only matters with two defects); the station registry is reduced to the verified
    active mapping (`station_relays`), so an unknown, unloaded or unverified station has no relay at all; no fallback."""
    if setup is not None:
        if "station_registry" in setup:
            assert setup["station_relays"] == _effective_relays(setup["station_registry"])
        try:
            dto = gv.contract_validate_v3(service, service_data, now, raw_inner=raw_inner)
        except gv.V3Reject:
            dto = None
        if dto is not None and "clock_signal" in setup and not clock_signal_healthy(setup["clock_signal"]):
            return _rejected("time", "clock_invalid", dto.request_id), dict(CLOCK_BLOCKED)
    resp, effects = gv.reference_door_service(service, service_data, now, setup, raw_inner=raw_inner)
    return resp, {**effects, "fallback_used": False}


def _effective_relays(registry: dict[str, Any]) -> dict[str, list[int]]:
    return {st: list(e["physical_indexes"]) for st, e in registry.items() if e["loaded"] and e["mapping"] == "verified_active"}


# ---------------------------------------------------------------- reference: trusted_door_capabilities (MODEL ONLY)

class _Malformed(Exception):
    pass


def _strict_json(text: str) -> Any:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        keys = [k for k, _ in items]
        if len(keys) != len(set(keys)):
            raise _Malformed("duplicate key")
        return dict(items)

    def no_const(_: str) -> Any:
        raise _Malformed("constant")

    def no_float(_: str) -> Any:
        raise _Malformed("float")

    try:
        return json.loads(text, object_pairs_hook=pairs, parse_constant=no_const, parse_float=no_float)
    except ValueError:
        raise _Malformed("json") from None


def validate_capabilities(text: str) -> tuple[str, dict[str, Any] | None]:
    """('ok', response) | ('unknown_schema', None) | ('malformed', None). Closed schema_version 1."""
    try:
        obj = _strict_json(text)
    except _Malformed:
        return "malformed", None
    if not isinstance(obj, dict) or "schema_version" not in obj or type(obj["schema_version"]) is not int:
        return "malformed", None
    if obj["schema_version"] != 1:
        return "unknown_schema", None
    if set(obj) != {"schema_version", "stations"} or not isinstance(obj["stations"], list):
        return "malformed", None
    seen: set[str] = set()
    for e in obj["stations"]:
        if not isinstance(e, dict) or set(e) != {"station", "allowed_relays", "mapping_revision"}:
            return "malformed", None
        st, relays, rev = e["station"], e["allowed_relays"], e["mapping_revision"]
        if not isinstance(st, str) or not gv._plain_text(st, gv.MAX_STATION) or st in seen:
            return "malformed", None
        seen.add(st)
        if not isinstance(rev, str) or not gv._plain_text(rev, 128):
            return "malformed", None
        if not isinstance(relays, list) or len(set(map(repr, relays))) != len(relays):
            return "malformed", None
        if any(type(r) is not int or not 1 <= r <= gv.SAFE_MAX for r in relays):
            return "malformed", None
    return "ok", obj


def _selection(cache: dict[str, Any] | None, reason_if_none: str) -> dict[str, Any]:
    if cache is None:
        return {"enabled": False, "reason": reason_if_none, "stations": {}}
    stations = {e["station"]: list(e["allowed_relays"]) for e in cache["stations"]}
    enabled = any(stations.values())
    return {"enabled": enabled, "reason": "ok" if enabled else "empty_list", "stations": stations}


REFRESH_TRIGGERS = ("discovery", "reload", "revision_change", "open_rejected_relay_not_allowed", "bridge_restart")


def capabilities_model(case: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None, dict[str, bool]]:
    """Arx-side handling of the capabilities hint: (selection, cache_after, actions). A hint for display and selection
    only, never an authorization; every open is still checked by WisKey against its active mapping."""
    actions = {"refresh_requested": False, "open_retried": False, "alternate_relay_tried": False,
               "lock_fallback": False, "stale_list_used": False}
    cache = case["cache_before"]
    trigger = case["trigger"]
    if trigger in REFRESH_TRIGGERS:
        cache = None  # invalidated first: an old list is never shown while the refresh runs or after it fails
        actions["refresh_requested"] = True
    elif trigger == "display" and cache is None:
        actions["refresh_requested"] = True
    call = case["service_call"]
    if call is None:
        return _selection(cache, "no_valid_list"), cache, actions
    if call["outcome"] != "ok":
        return _selection(None, call["outcome"]), None, actions
    verdict, parsed = validate_capabilities(call["response_json"])
    if verdict != "ok":
        return _selection(None, verdict), None, actions
    return _selection(parsed, ""), parsed, actions


# ---------------------------------------------------------------- reference: anchor scenarios (MODEL ONLY)

def _ms(iso: str) -> int:
    return gv._epoch(iso) * 1000


def anchor_model(case: dict[str, Any]) -> list[dict[str, Any]]:
    """Runs a scenario and returns the observed result of each step (compared with each step's `expect`)."""
    st = copy.deepcopy(case["initial_state"])
    st.update({"write_blocked": False, "gen_at_stop": None, "old_generation_rejected_verified": False})
    out: list[dict[str, Any]] = []

    def clock_ok(utc_ms: int, healthy: bool = True) -> bool:
        hw = st["high_water_utc_ms"]
        return healthy and hw is not None and not st["write_blocked"] and utc_ms >= hw

    for step in case["steps"]:
        op = step["op"]
        if op == "bootstrap":
            if st["high_water_utc_ms"] is not None:
                raise AssertionError("bootstrap only without an anchor")
            if not step["signal_healthy"] or step["utc_ms"] < FLOOR_MS or step["anchor_write"] != "ok":
                r = {"result": "refused", "code": "clock_invalid"}
            else:
                st["high_water_utc_ms"] = step["utc_ms"]
                r = {"result": "anchor_set", "code": None}
            r["high_water_utc_ms"] = st["high_water_utc_ms"]
        elif op == "sample":
            hw = st["high_water_utc_ms"]
            if not step["signal_healthy"]:
                r = {"result": "ignored"}
            elif hw is not None and step["utc_ms"] <= hw:
                r = {"result": "unchanged"}  # never an automatic decrease
            elif step["anchor_write"] != "ok":
                st["write_blocked"] = True
                r = {"result": "write_failed"}
            else:
                st["high_water_utc_ms"] = step["utc_ms"]
                st["write_blocked"] = False
                r = {"result": "advanced"}
            r.update(high_water_utc_ms=st["high_water_utc_ms"], write_blocked=st["write_blocked"])
        elif op == "open":
            env = step["envelope"]
            utc = step["utc_ms"]
            if env["hmac_generation"] != st["hmac_generation"]:
                r = {"result": "rejected", "stage": "signature", "code": "bad_signature"}
            elif not clock_ok(utc):
                r = {"result": "rejected", "stage": "time", "code": "clock_invalid"}
            elif utc < _ms(env["issued_at"]):
                r = {"result": "rejected", "stage": "time", "code": "not_yet_valid"}
            elif utc >= _ms(env["expires_at"]):
                r = {"result": "rejected", "stage": "time", "code": "expired"}
            else:
                st["high_water_utc_ms"] = max(st["high_water_utc_ms"], utc)  # written before the dispatch
                st["replay"].append(env["nonce"])
                r = {"result": "dispatched", "stage": None, "code": None}
            r["high_water_utc_ms"] = st["high_water_utc_ms"]
        elif op == "replay_purge":
            r = {"result": "allowed" if clock_ok(step["utc_ms"]) else "blocked"}
        elif op == "stop_trusted_calls":
            st["trusted_calls"] = "stopped"
            st["gen_at_stop"] = st["hmac_generation"]
            r = {"trusted_calls": "stopped"}
        elif op == "rotate_hmac_generation":
            st["hmac_generation"] += 1
            r = {"hmac_generation": st["hmac_generation"]}
        elif op == "verify_old_generation_rejected":
            rotated = st["gen_at_stop"] is not None and st["hmac_generation"] > st["gen_at_stop"]
            st["old_generation_rejected_verified"] = rotated
            probe = ({"stage": "signature", "code": "bad_signature"} if rotated else None)
            r = {"verified": rotated, "probe_result": probe}
        elif op == "re_anchor_decrease":
            missing = None
            if not st["rotation_procedure_approved"]:
                result = "unavailable"
            else:
                if step["requested_by"] != "owner":
                    missing = "owner_required"
                elif st["trusted_calls"] != "stopped":
                    missing = "trusted_calls_running"
                elif not (st["gen_at_stop"] is not None and st["hmac_generation"] > st["gen_at_stop"]):
                    missing = "hmac_generation_not_rotated"
                elif not st["old_generation_rejected_verified"]:
                    missing = "old_generation_not_verified_rejected"
                if missing:
                    result = "refused"
                elif step["anchor_write"] != "ok":
                    result = "aborted"  # atomic: the old high-water stays
                else:
                    st["high_water_utc_ms"] = step["new_high_water_utc_ms"]
                    st["write_blocked"] = False
                    result = "applied"
            r = {"result": result, "missing": missing, "high_water_utc_ms": st["high_water_utc_ms"],
                 "utc_monotonic_rebaselined": result == "applied", "pending": list(st["pending"]), "replay": list(st["replay"])}
        elif op == "resume_trusted_calls":
            st["trusted_calls"] = "running"
            r = {"trusted_calls": "running"}
        else:
            raise AssertionError(op)
        out.append(r)
    return out


# ---------------------------------------------------------------- case construction

def _registry(**stations: dict[str, Any]) -> dict[str, Any]:
    base = {"test_station_entrance": {"loaded": True, "mapping": "verified_active", "physical_indexes": [1, 2]}}
    return {**base, **stations}


def _station_setup(registry: dict[str, Any], **over: Any) -> dict[str, Any]:
    return gv._setup(station_relays=_effective_relays(registry), station_registry=registry, lock_fallback_configured=True, **over)


def _signal(age_ms: int = 0, *, supervisor: str = "available", read: str = "ok", restarted: bool = False,
            body: dict[str, Any] | None = None, utc_ms: int | None = None, **other: Any) -> dict[str, Any]:
    now_ms = T0_MS if utc_ms is None else utc_ms
    if body is None:
        body = {"dt_synchronized": True, "dt_utc": _iso_ms(now_ms - age_ms), "use_ntp": True}
    sample = {"read": read, "age_ms": age_ms, "bridge_restarted_since_read": restarted, "body": body if read == "ok" else None}
    sig: dict[str, Any] = {"supervisor": supervisor, "sample": sample if supervisor == "available" else None}
    if other:
        sig["ignored_other_sources"] = other
    return sig


def _signal_body(**over: Any) -> dict[str, Any]:
    b = {"dt_synchronized": True, "dt_utc": _iso_ms(T0_MS), "use_ntp": True, **over}
    return {k: v for k, v in b.items() if v is not _ABSENT}


_ABSENT = object()

CAPS_OK = {"schema_version": 1, "stations": [
    {"station": "test_station_entrance", "allowed_relays": [1, 2], "mapping_revision": "rev-0001"},
    {"station": "test_station_side", "allowed_relays": [2], "mapping_revision": "rev-0007"}]}


def _caps_text(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _caps_with(**station_over: Any) -> dict[str, Any]:
    doc = copy.deepcopy(CAPS_OK)
    doc["stations"][0].update(station_over)
    return doc


def _cases() -> list[dict[str, Any]]:
    C: list[dict[str, Any]] = []

    def signed(vid: str, group: str, expect: str, stage: str | None, code: str | None, reason: str, *,
               service: str = "door_open", now: int = T0, **payload: Any) -> None:
        C.append({"kind": "signed", "id": vid, "group": group, "service": service, "expect": expect, "reject_stage": stage,
                  "reject_code": code, "now": now, "reason": reason, **payload})

    W = gv._signed_wire

    # --- schema: status_unknown.reason is only pending | not_found_or_expired
    target = gv.DOOR_OPEN["request_id"]
    for reason in NO_LONGER_STATUS_REASONS:
        tag = f"status_reason_{reason}"
        rid = _rid(tag)
        signed(f"status_unknown_reason_{reason}_is_invalid", "schema", "stateful", None, None,
               f"door_open_status for an open stored as unknown/{reason}. The only valid answer is stored_result with outcome "
               f"unknown/{reason}. A top-level status_unknown with reason {reason} is forbidden: the corrected status_unknown "
               f"schema refuses it (the v3 schema still allowed it).",
               service="door_open_status", now=ST_NOW, wire=W(_status(tag)),
               state_setup=gv._setup(records=[gv._record(state="unknown", reason=reason)]),
               expected_side_effects=READ, response_schema="stored_result",
               expected_response={"result": "stored_result", "request_id": rid, "target_request_id": target,
                                  "outcome": {"result": "unknown", "reason": reason}},
               forbidden_responses=[{
                   "why": f"status_unknown.reason is only pending or not_found_or_expired; {reason} belongs in door_open_unknown or in a stored_result outcome",
                   "must_fail_schema": "status_unknown", "accepted_by_v3_schema": True,
                   "response": {"result": "unknown", "request_id": rid, "target_request_id": target, "reason": reason}}])

    # --- station: unknown / not loaded / no verified active mapping -> state/relay_not_allowed, no fallback
    def station(vid: str, expect: str, stage: str | None, code: str | None, reason: str, tag: str, wire_over: dict[str, Any],
                registry: dict[str, Any], effects: dict[str, bool] = NO_EFFECTS, response: dict[str, Any] | None = None,
                schema: str | None = None, **setup_over: Any) -> None:
        extra = {"expected_response": response, "response_schema": schema} if response else {}
        signed(vid, "station", expect, stage, code, reason, wire=W(_fresh(tag, **wire_over)),
               state_setup=_station_setup(registry, **setup_over), expected_side_effects=effects, **extra)

    side = "test_station_side"
    station("station_unknown_relay_not_allowed", "stateful", "state", "relay_not_allowed",
            "station test_station_unknown is not registered with WisKey. Refused after the capability check and before any "
            "pending record. No fallback to a lock entity (one is configured) and none to test_station_entrance.",
            "st_unknown", {"station": "test_station_unknown"}, _registry())
    station("station_not_loaded_relay_not_allowed", "stateful", "state", "relay_not_allowed",
            "test_station_side is registered but its entry is not loaded; its last known mapping {1, 2} is not active. "
            "Refused; no fallback to test_station_entrance (loaded, relay 1 mapped) or to a lock.",
            "st_not_loaded", {"station": side},
            _registry(test_station_side={"loaded": False, "mapping": "verified_active", "physical_indexes": [1, 2]}))
    station("station_mapping_unverified_relay_not_allowed", "stateful", "state", "relay_not_allowed",
            "test_station_side is loaded but its mapping {1, 2} is not verified. Only a verified active mapping counts.",
            "st_unverified", {"station": side},
            _registry(test_station_side={"loaded": True, "mapping": "unverified", "physical_indexes": [1, 2]}))
    station("station_mapping_none_relay_not_allowed", "stateful", "state", "relay_not_allowed",
            "test_station_side is loaded and has no mapping at all.",
            "st_none", {"station": side}, _registry(test_station_side={"loaded": True, "mapping": "none", "physical_indexes": []}))
    station("station_unknown_case_variant_no_other_station", "stateful", "state", "relay_not_allowed",
            "station Test_Station_Entrance differs from the loaded test_station_entrance only by case. Exact match: unknown; "
            "never resolved to the other station.",
            "st_case", {"station": "Test_Station_Entrance"}, _registry())
    station("station_unknown_after_capability_check", "stateful", "state", "capability_missing",
            "Unknown station AND no capability. The capability check runs first in stage state, so the code is "
            "capability_missing (two defects on purpose: this case binds the order capability -> relay mapping).",
            "st_cap_first", {"station": "test_station_unknown"}, _registry(), capability="missing")
    station("station_unknown_before_pending_record", "stateful", "state", "relay_not_allowed",
            "Unknown station AND a pending-record write that would fail. The mapping check runs before the pending record, so "
            "the code is relay_not_allowed, not storage_unavailable (two defects on purpose: binds mapping -> pending).",
            "st_before_pending", {"station": "test_station_unknown"}, _registry(), storage="fails_before_send")
    station("station_loaded_verified_control", "stateful", None, None,
            "Control: test_station_entrance is loaded with the verified active mapping {1, 2}; relay 2 is acknowledged.",
            "st_control", {"params": {"relay": 2}}, _registry(), effects=OPENED,
            response={"result": "acknowledged", "request_id": _rid("st_control")}, schema="door_open_acknowledged")

    # --- capabilities: smplwise_bridge.trusted_door_capabilities (Arx-side model)
    no_actions = {"refresh_requested": False, "open_retried": False, "alternate_relay_tried": False, "lock_fallback": False,
                  "stale_list_used": False}
    refresh = {**no_actions, "refresh_requested": True}
    ok_sel = {"enabled": True, "reason": "ok", "stations": {"test_station_entrance": [1, 2], "test_station_side": [2]}}

    def caps(vid: str, reason: str, *, trigger: str, cache_before: dict[str, Any] | None, service_call: dict[str, Any] | None,
             selection: dict[str, Any], cache_after: dict[str, Any] | None, actions: dict[str, bool],
             open_response: dict[str, Any] | None = None) -> None:
        c = {"kind": "capabilities_model", "id": vid, "group": "capabilities", "expect": "model", "reason": reason,
             "service": CAPS_SERVICE, "trigger": trigger, "cache_before": cache_before, "service_call": service_call,
             "expected_selection": selection, "expected_cache_after": cache_after, "expected_actions": actions}
        if open_response is not None:
            c["open_response"] = open_response
        C.append(c)

    def ok_call(obj: Any) -> dict[str, Any]:
        return {"outcome": "ok", "response_json": obj if isinstance(obj, str) else _caps_text(obj)}

    def disabled(why: str) -> dict[str, Any]:
        return {"enabled": False, "reason": why, "stations": {}}

    caps("caps_schema_v1_list_ok", "schema_version 1 with two stations: selection enabled with exactly these relays.",
         trigger="discovery", cache_before=None, service_call=ok_call(CAPS_OK), selection=ok_sel, cache_after=CAPS_OK, actions=refresh)
    empty = {"schema_version": 1, "stations": []}
    caps("caps_empty_station_list_disables_selection", "A valid empty list: relay selection is disabled (nothing is guessed).",
         trigger="discovery", cache_before=None, service_call=ok_call(empty),
         selection={"enabled": False, "reason": "empty_list", "stations": {}}, cache_after=empty, actions=refresh)
    one_empty = _caps_with(allowed_relays=[])
    caps("caps_station_with_empty_relays_disabled",
         "test_station_entrance is unavailable and has an empty list: selection is disabled for it only; test_station_side stays selectable.",
         trigger="discovery", cache_before=None, service_call=ok_call(one_empty),
         selection={"enabled": True, "reason": "ok", "stations": {"test_station_entrance": [], "test_station_side": [2]}},
         cache_after=one_empty, actions=refresh)
    all_empty = copy.deepcopy(one_empty)
    all_empty["stations"][1]["allowed_relays"] = []
    caps("caps_all_stations_empty_relays_disabled", "Every station has an empty list: selection disabled.",
         trigger="reload", cache_before=CAPS_OK, service_call=ok_call(all_empty),
         selection={"enabled": False, "reason": "empty_list", "stations": {"test_station_entrance": [], "test_station_side": []}},
         cache_after=all_empty, actions=refresh)
    for outcome, why in (("service_missing", "The service is not registered (bridge without it)."),
                         ("timeout", "The service did not answer in time."),
                         ("error", "The service call failed.")):
        caps(f"caps_{outcome}_disables_no_stale_list",
             f"{why} A valid list was cached before the reload; it is NOT used: selection disabled, cache cleared, no guess.",
             trigger="reload", cache_before=CAPS_OK, service_call={"outcome": outcome}, selection=disabled(outcome),
             cache_after=None, actions=refresh)
    malformed = [
        ("caps_malformed_truncated_json", "Truncated JSON.", '{"schema_version":1,"stations":['),
        ("caps_malformed_missing_schema_version", "schema_version is missing.", {"stations": CAPS_OK["stations"]}),
        ("caps_malformed_schema_version_string", "schema_version is the string \"1\", not an integer.", {**CAPS_OK, "schema_version": "1"}),
        ("caps_malformed_schema_version_bool", "schema_version is true, not an integer.", {**CAPS_OK, "schema_version": True}),
        ("caps_malformed_relay_zero", "allowed_relays contains 0 (a physical_index is >= 1).", _caps_with(allowed_relays=[0, 1])),
        ("caps_malformed_relay_bool", "allowed_relays contains true.", _caps_with(allowed_relays=[True])),
        ("caps_malformed_relay_float", "allowed_relays contains 1.0.", _caps_text(CAPS_OK).replace('"allowed_relays":[1,2]', '"allowed_relays":[1.0,2]', 1)),
        ("caps_malformed_duplicate_relay", "allowed_relays contains 1 twice.", _caps_with(allowed_relays=[1, 1])),
        ("caps_malformed_unknown_field", "A station carries an extra field (api_id: a hardware detail that must never be exposed).", _caps_with(api_id=7)),
        ("caps_malformed_duplicate_station", "The same station twice.", {"schema_version": 1, "stations": [CAPS_OK["stations"][0], CAPS_OK["stations"][0]]}),
        ("caps_malformed_duplicate_json_key", "The key `stations` twice in the JSON text.",
         '{"schema_version":1,"stations":[],"stations":' + _caps_text(CAPS_OK["stations"]) + "}"),
        ("caps_malformed_empty_revision", "mapping_revision is the empty string.", _caps_with(mapping_revision="")),
        ("caps_malformed_not_an_object", "The response is a list.", _caps_text(CAPS_OK["stations"])),
    ]
    for vid, why, payload in malformed:
        caps(vid, f"{why} Malformed: selection disabled, previous list dropped, nothing guessed.",
             trigger="reload", cache_before=CAPS_OK, service_call=ok_call(payload), selection=disabled("malformed"),
             cache_after=None, actions=refresh)
    caps("caps_unknown_schema_version_2",
         "schema_version 2 with a v1-looking body: unknown schema, selection disabled; the body is not interpreted.",
         trigger="discovery", cache_before=None, service_call=ok_call({**CAPS_OK, "schema_version": 2}),
         selection=disabled("unknown_schema"), cache_after=None, actions=refresh)
    rna = {"result": "rejected", "stage": "state", "code": "relay_not_allowed", "request_id": _rid("caps_rna")}
    side_gone = copy.deepcopy(CAPS_OK)
    side_gone["stations"][1].update(allowed_relays=[], mapping_revision="rev-0008")
    caps("caps_relay_not_allowed_invalidates_and_refreshes",
         "An open of test_station_side relay 2 came back rejected state/relay_not_allowed. The cache is invalidated and refreshed; "
         "the open is not retried, no other relay and no lock is tried. The fresh list no longer offers relay 2 there.",
         trigger="open_rejected_relay_not_allowed", cache_before=CAPS_OK, service_call=ok_call(side_gone), open_response=rna,
         selection={"enabled": True, "reason": "ok", "stations": {"test_station_entrance": [1, 2], "test_station_side": []}},
         cache_after=side_gone, actions=refresh)
    caps("caps_relay_not_allowed_refresh_timeout_disables",
         "relay_not_allowed, and the refresh then times out: selection disabled, the old list is not reused.",
         trigger="open_rejected_relay_not_allowed", cache_before=CAPS_OK, service_call={"outcome": "timeout"}, open_response=rna,
         selection=disabled("timeout"), cache_after=None, actions=refresh)
    caps("caps_bridge_restart_invalidates_cache",
         "The bridge restarted; the refresh has not answered yet. The cached list is gone: selection disabled until a fresh list arrives.",
         trigger="bridge_restart", cache_before=CAPS_OK, service_call=None, selection=disabled("no_valid_list"),
         cache_after=None, actions=refresh)
    caps("caps_bridge_restart_then_fresh_list", "After the restart the refresh answers: selection from the fresh list only.",
         trigger="bridge_restart", cache_before=CAPS_OK, service_call=ok_call(side_gone),
         selection={"enabled": True, "reason": "ok", "stations": {"test_station_entrance": [1, 2], "test_station_side": []}},
         cache_after=side_gone, actions=refresh)
    rev2 = {"schema_version": 1, "stations": [{"station": "test_station_entrance", "allowed_relays": [1], "mapping_revision": "rev-0002"}]}
    caps("caps_revision_change_refreshes", "mapping_revision changed: refresh, and the new list replaces the old one.",
         trigger="revision_change", cache_before=CAPS_OK, service_call=ok_call(rev2),
         selection={"enabled": True, "reason": "ok", "stations": {"test_station_entrance": [1]}}, cache_after=rev2, actions=refresh)
    caps("caps_display_uses_valid_cache", "Showing the selection with a valid cached list and no invalidating event: no call.",
         trigger="display", cache_before=CAPS_OK, service_call=None, selection=ok_sel, cache_after=CAPS_OK, actions=no_actions)

    # --- clock: Supervisor signal (MODEL ONLY)
    def clock(vid: str, expect: str, stage: str | None, code: str | None, reason: str, sig: dict[str, Any], *,
              clk: dict[str, Any] | None = None, now: int = T0, wire: dict[str, Any] | None = None, service: str = "door_open",
              effects: dict[str, bool] = CLOCK_BLOCKED, response: dict[str, Any] | None = None, schema: str | None = None,
              records: list[dict[str, Any]] | None = None) -> None:
        extra = {"expected_response": response, "response_schema": schema} if response else {}
        signed(vid, "clock", expect, stage, code, reason + " MODEL ONLY: not verified against a real Supervisor.",
               service=service, now=now, wire=wire if wire is not None else W(_fresh(vid)),
               state_setup=gv._setup(clock=clk if clk is not None else gv._clock(), records=records or [], clock_signal=sig),
               expected_side_effects=effects, **extra)

    def ack(vid: str) -> dict[str, Any]:
        return {"response": {"result": "acknowledged", "request_id": _rid(vid)}, "schema": "door_open_acknowledged", "effects": OPENED}

    blocked = ("time", "clock_invalid")
    a = ack("clock_signal_ok")
    clock("clock_signal_ok", "stateful", None, None, "dt_synchronized true, valid dt_utc, sample just read (age 0 ms).",
          _signal(0), **a)
    clock("clock_signal_dt_synchronized_false", "stateful", *blocked, "dt_synchronized is false.", _signal(0, body=_signal_body(dt_synchronized=False)))
    clock("clock_signal_dt_synchronized_missing", "stateful", *blocked, "dt_synchronized is absent from the sample.",
          _signal(0, body=_signal_body(dt_synchronized=_ABSENT)))
    clock("clock_signal_dt_synchronized_string", "stateful", *blocked, "dt_synchronized is the string \"true\": only boolean true counts.",
          _signal(0, body=_signal_body(dt_synchronized="true")))
    clock("clock_signal_use_ntp_alone", "stateful", *blocked, "use_ntp is true but dt_synchronized is absent: use_ntp is not a sync signal.",
          _signal(0, body=_signal_body(dt_synchronized=_ABSENT, use_ntp=True)))
    clock("clock_signal_read_error", "stateful", *blocked, "Reading /host/info failed (error).", _signal(0, read="error"))
    clock("clock_signal_read_timeout", "stateful", *blocked, "Reading /host/info timed out.", _signal(0, read="timeout"))
    a = ack("clock_signal_age_30000ms_allowed")
    clock("clock_signal_age_30000ms_allowed", "stateful", None, None,
          "The sample is exactly 30 000 ms old by the bridge's monotonic clock: still valid (inclusive).", _signal(30_000), **a)
    clock("clock_signal_age_30001ms_blocked", "stateful", *blocked, "The sample is 30 001 ms old: stale.", _signal(30_001))
    clock("clock_signal_invalid_after_bridge_restart", "stateful", *blocked,
          "The sample (1 000 ms old, synchronized) was read before a bridge restart: no valid sample until a new read.",
          _signal(1_000, restarted=True))
    clock("clock_signal_dt_utc_unparseable", "stateful", *blocked, "dt_utc is not a date.", _signal(0, body=_signal_body(dt_utc="not-a-date")))
    clock("clock_signal_dt_utc_missing", "stateful", *blocked, "dt_utc is absent.", _signal(0, body=_signal_body(dt_utc=_ABSENT)))
    clock("clock_signal_dt_utc_no_offset", "stateful", *blocked, "dt_utc has no UTC offset (local time is not UTC).",
          _signal(0, body=_signal_body(dt_utc="2026-10-03T12:00:00.000000")))
    clock("clock_signal_dt_utc_impossible_date", "stateful", *blocked, "dt_utc is 2026-02-30: not a real date.",
          _signal(0, body=_signal_body(dt_utc="2026-02-30T12:00:00.000000+00:00")))
    clock("clock_signal_no_supervisor_no_fallback", "stateful", *blocked,
          "No Supervisor (an installation without it). No automatic fallback, even though the OS reports NTP synchronized.",
          _signal(0, supervisor="absent", os_ntp_synchronized=True))
    a = ack("clock_signal_fresh_divergence_2000ms_allowed")
    clock("clock_signal_fresh_divergence_2000ms_allowed", "stateful", None, None,
          "Fresh healthy sample and |divergence| exactly 2000 ms: allowed (the v3 boundary is unchanged).",
          _signal(0), clk=gv._clock(divergence_ms=2000), **a)
    clock("clock_signal_fresh_divergence_plus_2001ms_blocked", "stateful", *blocked,
          "A fresh healthy sample does not replace the divergence check: +2001 ms blocks.", _signal(0), clk=gv._clock(divergence_ms=2001))
    clock("clock_signal_fresh_divergence_minus_2001ms_blocked", "stateful", *blocked,
          "-2001 ms blocks too (absolute value).", _signal(0), clk=gv._clock(divergence_ms=-2001))
    clock("clock_signal_fresh_below_high_water_blocked", "stateful", *blocked,
          "A fresh healthy sample does not replace the high-water check: UTC is 1 ms below the stored high-water.",
          _signal(0), clk=gv._clock(anchor_ms=T0_MS + 1))
    base = W(gv.DOOR_OPEN)
    clock("clock_signal_fresh_no_future_tolerance", "reject", "time", "not_yet_valid",
          "A fresh healthy sample does not allow a future issued_at: now = issued_at - 1.",
          _signal(0, utc_ms=(T0 - 1) * 1000), clk=gv._clock(utc_now_ms=(T0 - 1) * 1000), now=T0 - 1, wire=base, effects=NO_EFFECTS)
    clock("clock_signal_sample_utc_is_not_current_time", "reject", "time", "expired",
          "The sample (29 000 ms old, valid) says dt_utc = issued_at + 1 s; the current UTC is issued_at + 30 s = expires_at. "
          "Using the sample's UTC as the current time would accept; the correct answer is expired.",
          _signal(29_000, utc_ms=(T0 + 30) * 1000), clk=gv._clock(utc_now_ms=(T0 + 30) * 1000), now=T0 + 30, wire=base,
          effects=NO_EFFECTS)
    clock("clock_signal_false_blocks_status", "stateful", *blocked,
          "door_open_status with dt_synchronized false: blocked as well; the stored outcome is not read.",
          _signal(0, utc_ms=ST_NOW * 1000, body={"dt_synchronized": False, "dt_utc": _iso_ms(ST_NOW * 1000), "use_ntp": True}),
          clk=gv._clock(utc_now_ms=ST_NOW * 1000), now=ST_NOW, wire=W(_status("clock_status")), service="door_open_status",
          records=[gv._record()])

    # --- anchor: scenarios (MODEL ONLY)
    def scenario(vid: str, reason: str, initial: dict[str, Any], steps: list[dict[str, Any]]) -> None:
        state = {"high_water_utc_ms": None, "hmac_generation": 1, "trusted_calls": "running", "pending": [], "replay": [],
                 "rotation_procedure_approved": False, **initial}
        C.append({"kind": "anchor_scenario", "id": vid, "group": "anchor", "expect": "model",
                  "reason": reason + " MODEL ONLY: the anchor procedure is a draft (ANCHOR_PROCEDURE_DRAFT.md), not an implementation.",
                  "initial_state": state, "steps": steps})

    def env(tag: str, issued: int, gen: int = 1) -> dict[str, Any]:
        return {"request_id": _rid(tag), "nonce": _nonce(tag), "hmac_generation": gen, "issued_at": gv._iso(issued),
                "expires_at": gv._iso(issued + 30)}

    def open_(utc_ms: int, e: dict[str, Any], result: str, stage: str | None, code: str | None, hw: int | None) -> dict[str, Any]:
        return {"op": "open", "utc_ms": utc_ms, "envelope": e,
                "expect": {"result": result, "stage": stage, "code": code, "high_water_utc_ms": hw}}

    def sample(utc_ms: int, healthy: bool, write: str, result: str, hw: int | None, blocked_: bool) -> dict[str, Any]:
        return {"op": "sample", "signal_healthy": healthy, "utc_ms": utc_ms, "anchor_write": write,
                "expect": {"result": result, "high_water_utc_ms": hw, "write_blocked": blocked_}}

    def boot(utc_ms: int, healthy: bool, write: str, ok: bool) -> dict[str, Any]:
        return {"op": "bootstrap", "signal_healthy": healthy, "utc_ms": utc_ms, "anchor_write": write,
                "expect": {"result": "anchor_set" if ok else "refused", "code": None if ok else "clock_invalid",
                           "high_water_utc_ms": utc_ms if ok else None}}

    def reanchor(by: str, new_hw: int, write: str, result: str, missing: str | None, hw_after: int | None,
                 pending: list[str], replay: list[str]) -> dict[str, Any]:
        return {"op": "re_anchor_decrease", "requested_by": by, "new_high_water_utc_ms": new_hw, "anchor_write": write,
                "expect": {"result": result, "missing": missing, "high_water_utc_ms": hw_after,
                           "utc_monotonic_rebaselined": result == "applied", "pending": pending, "replay": replay}}

    stop = {"op": "stop_trusted_calls", "expect": {"trusted_calls": "stopped"}}
    resume = {"op": "resume_trusted_calls", "expect": {"trusted_calls": "running"}}

    def rotate(gen: int) -> dict[str, Any]:
        return {"op": "rotate_hmac_generation", "expect": {"hmac_generation": gen}}

    def verify(ok: bool) -> dict[str, Any]:
        return {"op": "verify_old_generation_rejected",
                "expect": {"verified": ok, "probe_result": {"stage": "signature", "code": "bad_signature"} if ok else None}}

    def purge(utc_ms: int, allowed: bool) -> dict[str, Any]:
        return {"op": "replay_purge", "utc_ms": utc_ms, "expect": {"result": "allowed" if allowed else "blocked"}}

    hw0 = T0_MS - 3_600_000
    ahead = T0_MS + 86_400_000  # a high-water one day ahead (for example a wrong clock was once trusted)
    scenario("anchor_bootstrap_at_floor_exact_ok",
             f"Healthy signal and UTC exactly {FLOOR_ISO} (the floor is inclusive): the first anchor is written atomically.",
             {}, [boot(FLOOR_MS, True, "ok", True)])
    scenario("anchor_bootstrap_one_ms_below_floor_refused", "Healthy signal but UTC 1 ms below the floor: no anchor.",
             {}, [boot(FLOOR_MS - 1, True, "ok", False)])
    scenario("anchor_bootstrap_unhealthy_signal_refused",
             "UTC well above the floor but the signal is not healthy: no anchor. A valid message time alone never bootstraps.",
             {}, [boot(T0_MS, False, "ok", False), open_(T0_MS, env("a_unhealthy", T0), "rejected", "time", "clock_invalid", None)])
    scenario("anchor_bootstrap_write_failure_blocks",
             "Healthy signal, UTC above the floor, but the anchor cannot be written: no anchor, opens and replay purge stay blocked.",
             {}, [boot(T0_MS, True, "fails", False), open_(T0_MS, env("a_bootfail", T0), "rejected", "time", "clock_invalid", None),
                  purge(T0_MS, False)])
    scenario("anchor_bootstrap_then_open_advances_high_water",
             "Bootstrap 10 s before the open; the open's healthy UTC advances the high-water BEFORE the dispatch.",
             {}, [boot(T0_MS - 10_000, True, "ok", True), open_(T0_MS, env("a_bootopen", T0), "dispatched", None, None, T0_MS)])
    scenario("anchor_high_water_advances_from_healthy_sample_only",
             "An unhealthy sample with a later UTC is ignored; the healthy sample advances the high-water.",
             {"high_water_utc_ms": hw0},
             [sample(T0_MS, False, "ok", "ignored", hw0, False), sample(T0_MS, True, "ok", "advanced", T0_MS, False)])
    scenario("anchor_high_water_write_failure_blocks",
             "The high-water write fails: opens and replay purge are blocked until a later write succeeds; nothing is decreased.",
             {"high_water_utc_ms": hw0},
             [sample(T0_MS, True, "fails", "write_failed", hw0, True),
              open_(T0_MS, env("a_wf1", T0), "rejected", "time", "clock_invalid", hw0), purge(T0_MS, False),
              sample(T0_MS + 1000, True, "ok", "advanced", T0_MS + 1000, False),
              open_(T0_MS + 1000, env("a_wf2", T0 + 1), "dispatched", None, None, T0_MS + 1000), purge(T0_MS + 1000, True)])
    scenario("anchor_no_automatic_decrease",
             "A healthy sample 60 s below the high-water does not lower it; opens stay blocked.",
             {"high_water_utc_ms": T0_MS},
             [sample(T0_MS - 60_000, True, "ok", "unchanged", T0_MS, False),
              open_(T0_MS - 60_000, env("a_nodec", T0 - 60), "rejected", "time", "clock_invalid", T0_MS)])
    scenario("anchor_blocked_until_utc_reaches_high_water",
             "Without a generation change the block lasts until UTC >= high-water: 1 ms below is blocked, exactly equal is allowed.",
             {"high_water_utc_ms": T0_MS},
             [open_(T0_MS - 1, env("a_hw_below", T0 - 1), "rejected", "time", "clock_invalid", T0_MS), purge(T0_MS - 1, False),
              open_(T0_MS, env("a_hw_equal", T0 - 1), "dispatched", None, None, T0_MS), purge(T0_MS, True)])
    scenario("anchor_re_anchor_unavailable_until_procedure_approved",
             "Today's default: the HMAC rotation procedure is not approved, so a decrease is unavailable even after every step; "
             "the block stays until UTC >= high-water.",
             {"high_water_utc_ms": ahead},
             [stop, rotate(2), verify(True), reanchor("owner", T0_MS, "ok", "unavailable", None, ahead, [], []), resume,
              open_(T0_MS, env("a_unavail", T0, gen=2), "rejected", "time", "clock_invalid", ahead)])
    old_env = env("a_old_gen", T0, gen=1)
    pend = [_rid("a_pending_open")]
    replay = [_nonce("a_replay_1"), _nonce("a_replay_2")]
    scenario("anchor_re_anchor_full_procedure",
             "Hypothetical approved procedure. An envelope of generation 1 is blocked (never consumed). Calls stopped, generation "
             "rotated to 2, old-generation rejection verified, owner decreases the high-water atomically, UTC/monotonic re-baselined, "
             "calls resumed. pending and replay are unchanged. The old unconsumed envelope, now inside its time window, is "
             "rejected signature/bad_signature; a generation-2 envelope is dispatched.",
             {"high_water_utc_ms": ahead, "pending": pend, "replay": replay, "rotation_procedure_approved": True},
             [open_(T0_MS, old_env, "rejected", "time", "clock_invalid", ahead), stop, rotate(2), verify(True),
              reanchor("owner", T0_MS, "ok", "applied", None, T0_MS, pend, replay), resume,
              open_(T0_MS + 5000, old_env, "rejected", "signature", "bad_signature", T0_MS),
              open_(T0_MS + 6000, env("a_new_gen", T0 + 6, gen=2), "dispatched", None, None, T0_MS + 6000)])
    scenario("anchor_re_anchor_refused_without_generation_change",
             "No rotation: the decrease is refused and the block persists until UTC reaches the high-water.",
             {"high_water_utc_ms": ahead, "rotation_procedure_approved": True},
             [stop, verify(False), reanchor("owner", T0_MS, "ok", "refused", "hmac_generation_not_rotated", ahead, [], []), resume,
              open_(T0_MS, env("a_norot_1", T0), "rejected", "time", "clock_invalid", ahead),
              open_(ahead, env("a_norot_2", ahead // 1000), "dispatched", None, None, ahead)])
    scenario("anchor_re_anchor_refused_calls_not_stopped", "Rotation without stopping trusted calls first: refused.",
             {"high_water_utc_ms": ahead, "rotation_procedure_approved": True},
             [rotate(2), verify(False), reanchor("owner", T0_MS, "ok", "refused", "trusted_calls_running", ahead, [], [])])
    scenario("anchor_re_anchor_refused_old_generation_not_verified",
             "Calls stopped and generation rotated, but the rejection of old-generation signatures was not verified: refused.",
             {"high_water_utc_ms": ahead, "rotation_procedure_approved": True},
             [stop, rotate(2), reanchor("owner", T0_MS, "ok", "refused", "old_generation_not_verified_rejected", ahead, [], [])])
    scenario("anchor_re_anchor_refused_not_owner", "Every step done, but the request is not from the owner (Arx RBAC): refused.",
             {"high_water_utc_ms": ahead, "rotation_procedure_approved": True},
             [stop, rotate(2), verify(True), reanchor("site_admin", T0_MS, "ok", "refused", "owner_required", ahead, [], [])])
    scenario("anchor_re_anchor_write_failure_is_atomic",
             "Every step done, but the decrease cannot be written: aborted, the old high-water stays and opens stay blocked.",
             {"high_water_utc_ms": ahead, "rotation_procedure_approved": True},
             [stop, rotate(2), verify(True), reanchor("owner", T0_MS, "fails", "aborted", None, ahead, [], []), resume,
              open_(T0_MS, env("a_atomic", T0, gen=2), "rejected", "time", "clock_invalid", ahead)])
    return C


def _signed_vector(c: dict[str, Any]) -> dict[str, Any]:
    v: dict[str, Any] = {"id": c["id"], "group": c["group"], "category": c["group"], "kind": "signed", "expect": c["expect"],
                         "reason": c["reason"], "reject_stage": c["reject_stage"], "reject_code": c["reject_code"],
                         "service": c["service"], "now": c["now"], "now_iso": gv._iso(c["now"])}
    if c["group"] in MODEL_ONLY_GROUPS:
        v["model_only"] = True
        v["verified"] = False
    inner = gv._text(c["wire"])
    v["signed_message_json"] = inner
    v["service_data_json"] = gv._service_data_json(inner)
    v["state_setup"] = c["state_setup"]
    v["expected_side_effects"] = c["expected_side_effects"]
    wire = c["wire"]
    if c["expect"] in ("accept", "stateful"):
        body_sha, hmac_input, auth_sha = gv._digests(wire)
        v["signed_body"] = {k: x for k, x in wire.items() if k not in ("ts", "nonce", "sig")}
        v["canonical_utf8"] = gv.current_canonical(v["signed_body"])
        v["body_sha256"] = body_sha
        v["hmac_input"] = hmac_input
        v["authenticated_message_sha256"] = auth_sha
        v["sig"] = wire["sig"]
        v["expected_dto"] = gv._expected_dto(wire)
    if "expected_response" in c:
        v["response_schema"], v["expected_response"] = c["response_schema"], c["expected_response"]
    else:
        assert c["reject_stage"] in gv.POST_SCHEMA_STAGES, c["id"]
        v["response_schema"] = "rejected_after_schema_pass"
        v["expected_response"] = _rejected(c["reject_stage"], c["reject_code"], wire["request_id"])
    if "forbidden_responses" in c:
        v["forbidden_responses"] = c["forbidden_responses"]
    return v


def build_cases() -> list[dict[str, Any]]:
    out = []
    for c in _cases():
        if c["kind"] == "signed":
            out.append(_signed_vector(c))
        else:
            v = {"id": c["id"], "group": c["group"], "category": c["group"], **{k: x for k, x in c.items() if k not in ("id", "group")}}
            v["model_only"] = True
            v["verified"] = False
            out.append(v)
    return out


def _counts(cases: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {}
    for g in GROUPS:
        sel = [c for c in cases if c["group"] == g]
        row = {e: sum(1 for c in sel if c["expect"] == e) for e in ("accept", "reject", "stateful", "model")}
        counts[g] = {**{k: n for k, n in row.items() if n}, "total": len(sel)}
    counts["total"] = {"total": len(cases)}
    return counts


SUPERSEDES = [
    {"target": "../v3/GOLDEN_VECTORS_v3.json#/response_schemas/status_unknown",
     "replaced_by": "GOLDEN_VECTORS_v3_addendum.json#/response_schemas/status_unknown",
     "why": "status_unknown.reason is only pending | not_found_or_expired (WisKey answer (e), agreed by Arx). The v3 schema also "
            "allowed unconfirmed, interrupted and outcome_persistence_failed. No v3 case changes outcome: every v3 status_unknown "
            "expected_response uses pending or not_found_or_expired.",
     "negative_cases": [f"status_unknown_reason_{r}_is_invalid" for r in NO_LONGER_STATUS_REASONS]},
    {"target": "../v3/GOLDEN_VECTORS_v3.json#case:size_8193_bytes_invalid_utf8_utf8_first/signed_message_code_points",
     "replaced_by": "GOLDEN_VECTORS_v3_addendum.json#/metadata_corrections/0",
     "why": "Code points are not defined for invalid UTF-8. The refusal (encoding/invalid_utf8) and the byte count (8193) stay binding."},
]
CARRIED_SUPERSEDES = [{"vectors_version": 2, "id": "status_station_mismatch_vs_open_record",
                       "replaced_by": "status_station_mismatch_answers_not_found", "declared_in": "../v3/GOLDEN_VECTORS_v3.json#/supersedes"}]
COMPLEMENTS = [
    {"file": "../GOLDEN_VECTORS.json", "vectors_version": 2, "arx_commit": gv.V2_COMMIT, "file_sha256": gv.V2_FILE_SHA256,
     "cases": {"vectors (v1)": 29, "contract_vectors (v2)": gv.V2_CONTRACT_VECTORS},
     "rule": "unchanged and binding, except the v2 case superseded by v3"},
    {"file": "../v3/GOLDEN_VECTORS_v3.json", "vectors_version": 3, "arx_commit": V3_COMMIT, "file_sha256": V3_FILE_SHA256,
     "cases": {"contract_vectors_v3": V3_CASES},
     "rule": "unchanged and binding, except response_schemas.status_unknown and one metadata field (see supersedes)"},
]
GROUP_COMPLEMENTS = {
    "schema": {"complements_v3_cases": ["status_target_unknown_unconfirmed", "status_target_interrupted", "status_target_pending",
                                        "status_target_missing_answers_not_found"],
               "note": "adds the outcome_persistence_failed status case and the three forbidden top-level reasons"},
    "station": {"complements_v3_cases": ["relay_physical_index_1_allowed", "relay_physical_index_2_mapping_without_1",
                                         "relay_1_not_in_mapping_with_gap", "relay_3_not_in_mapping", "relay_max_safe_integer_not_in_mapping",
                                         "capability_missing"],
                "closes_open_item": "DTO_DRAFT_v3.md section 11 W-f"},
    "capabilities": {"complements_v3_cases": [], "note": "new read-only service; a hint for display and selection only, never an authorization"},
    "clock": {"complements_v3_cases": ["clock_health_ok", "clock_divergence_2000ms_allowed", "clock_divergence_plus_2001ms_blocks",
                                       "clock_divergence_minus_2001ms_blocks", "clock_utc_regressed_below_anchor_blocks",
                                       "clock_no_anchor_blocks", "clock_no_anchor_blocks_status", "clock_healthy_is_not_a_skew_allowance",
                                       "time_no_forward_skew_1s", "time_no_forward_skew_2s"],
              "note": "a v3 clock case has no clock_signal: read it as 'signal healthy and fresh, not under test'"},
    "anchor": {"complements_v3_cases": ["clock_no_anchor_blocks", "clock_utc_regressed_below_anchor_blocks"],
               "closes_open_item": "DTO_DRAFT_v3.md section 11 W-b (as a draft procedure, not verified)"},
}


def build_document() -> dict[str, Any]:
    cases = build_cases()
    return {
        "format": "smplwise-arx/wiskey-trusted-caller/golden-vectors",
        "format_version": 1,
        "protocol": gv.PROTOCOL,
        "vectors_version": 3,
        "package": PACKAGE,
        "addendum_version": ADDENDUM_VERSION,
        "generated_by": "smplwise_vms/backend/tests/test_wiskey_v3_addendum.py --write (synthetic; do not edit by hand)",
        "status": "DRAFT, Arx 2026-10-04, for delivery 2026-10-06 (ARX_ACK_TO_V3_ADDENDUM_ACK_2026-10-04). See README.md.",
        "complements": COMPLEMENTS,
        "supersedes": SUPERSEDES,
        "carried_supersedes": CARRIED_SUPERSEDES,
        "test_hmac_key": {"value": gv.TEST_SECRET, "encoding": "UTF-8 bytes of the string are the HMAC key",
                          "warning": "TEST CONSTANT ONLY (the same public constant as v1-v3). Never use as, or derive, a pairing secret."},
        "contract_addendum": {
            "status_unknown_reasons": list(STATUS_UNKNOWN_REASONS),
            "door_open_unknown_reasons": list(gv.OPEN_UNKNOWN_REASONS),
            "stored_outcome_unknown_reasons": list(gv.STORED_UNKNOWN_REASONS),
            "station_rule": "door_open for a station that is not registered, whose entry is not loaded, or that has no verified active mapping is state/relay_not_allowed: after the capability check, before any pending record. No fallback to a lock entity or to another station; station is matched exactly.",
            "capabilities_service": {
                "service": CAPS_SERVICE, "call": "read-only, return_response", "schema_version": 1,
                "response_schema": {"schema_version": "integer, exactly 1",
                                    "stations": "list of {station, allowed_relays, mapping_revision}, closed objects, station unique",
                                    "station": "string, the opaque ConfigEntry.entry_id, 1-128 code points, no C0/DEL/C1",
                                    "allowed_relays": "list of unique integers >= 1 (physical_index of the verified active mapping only); empty = selection disabled for that station",
                                    "mapping_revision": "opaque string, 1-128 code points, no C0/DEL/C1, compared for equality only (Arx proposal; WisKey to confirm)"},
                "rules": ["a hint for display and selection only, never an authorization; every open is checked against WisKey's active mapping and Arx RBAC stays the only authority",
                          "service missing, timeout, error, malformed or unknown schema_version: selection disabled, cached list dropped, no guessing, no lock fallback",
                          "refresh on discovery, reload and mapping_revision change; relay_not_allowed invalidates the cache and refreshes, with no retry and no alternate relay",
                          "the cache is invalidated by a bridge restart",
                          "mapping_revision is not part of the signed door_open envelope"],
            },
            "clock_signal": {
                "model_only": True, "verified": False,
                "source": "Supervisor /host/info of the host that runs the bridge: dt_synchronized and dt_utc",
                "rule": "healthy only if the Supervisor is available, the sample was read without error after the last bridge restart, its age by the bridge's monotonic clock is <= 30000 ms (inclusive), dt_synchronized is exactly boolean true and dt_utc is a valid UTC time. Otherwise time/clock_invalid; no fallback (use_ntp or OS NTP status are ignored).",
                "does_not_replace": "the floor, the stored high-water, the 2000 ms divergence check and the no-future-tolerance window, all checked on every open",
                "sample_max_age_ms": SAMPLE_MAX_AGE_MS,
                "dt_utc_model_rule": "RFC 3339 UTC with Z or +00:00, optional fraction of 1-6 digits, a real date (model only; the exact Supervisor format and versions go to COMPAT.md, planned 2026-10-08)",
            },
            "anchor": {
                "model_only": True, "verified": False,
                "floor_utc": FLOOR_ISO, "floor_utc_ms": FLOOR_MS, "floor_inclusive": True,
                "procedure": "ANCHOR_PROCEDURE_DRAFT.md",
                "rule": "bootstrap only with a healthy signal AND UTC >= floor, written atomically (write failure blocks); the high-water advances only from healthy samples, before dispatch and before replay purge; write failure blocks; never an automatic decrease; a decrease only by the owner after: trusted calls stopped, HMAC-material generation rotated, old-generation signatures verified rejected, then an atomic decrease and a UTC/monotonic re-baseline; pending and replay are kept; without a generation change the block lasts until UTC >= high-water. Unavailable until the HMAC rotation procedure is approved.",
            },
        },
        "metadata_corrections": [
            {"file": "../v3/GOLDEN_VECTORS_v3.json", "case_id": "size_8193_bytes_invalid_utf8_utf8_first",
             "field": "signed_message_code_points", "v3_value": 8179, "corrected_value": "not_applicable",
             "why": "the input is not valid UTF-8, so a code-point count is not defined (the v3 value counted U+FFFD replacements). The refusal encoding/invalid_utf8 and signed_message_utf8_bytes = 8193 stay binding."},
        ],
        "case_format": {
            "kind": "signed | capabilities_model | anchor_scenario",
            "signed": "the v3 case fields (signed_message_json, service_data_json, digests, expected_dto for accept/stateful, state_setup, expected_side_effects, response_schema, expected_response, forbidden_responses); expected_side_effects adds fallback_used (always false)",
            "state_setup_additions": {
                "station_registry": "station -> {loaded, mapping: verified_active | unverified | none, physical_indexes}; station_relays is the verified active part of it (stations not listed are unknown)",
                "lock_fallback_configured": "true = a lock entity exists for the door; it must still never be used as a fallback",
                "clock_signal": "{supervisor: available | absent, sample: null | {read: ok | error | timeout, age_ms, bridge_restarted_since_read, body: the /host/info subset or null}, ignored_other_sources?}",
            },
            "capabilities_model": "trigger (discovery | reload | revision_change | open_rejected_relay_not_allowed | bridge_restart | display), cache_before, service_call (null = no answer yet | {outcome: ok, response_json} | {outcome: service_missing | timeout | error}), open_response?, expected_selection {enabled, reason, stations}, expected_cache_after, expected_actions",
            "anchor_scenario": "initial_state, then steps in order; each step has op, inputs and expect (the observable result). Ops: bootstrap, sample, open, replay_purge, stop_trusted_calls, rotate_hmac_generation, verify_old_generation_rejected, re_anchor_decrease, resume_trusted_calls. hmac_generation is an abstract label: no second key exists in this package.",
            "model_only": "true on every capabilities, clock and anchor case; verified is false: no runtime or real system was involved",
        },
        "response_schema_dialect": "JSON Schema 2020-12 subset: type, const, enum, pattern, properties, required, additionalProperties, oneOf (as in v3).",
        "response_schemas": RESPONSE_SCHEMAS,
        "counts": _counts(cases),
        "cases": cases,
    }


PACKAGE_FILES = [
    {"path": "GOLDEN_VECTORS_v3_addendum.json", "role": "vectors (generated)"},
    {"path": "MANIFEST.json", "role": "manifest (generated)"},
    {"path": "README.md", "role": "documentation (English)"},
    {"path": "NOTE_FOR_WISKEY_v3_addendum.md", "role": "short note (Hebrew)"},
    {"path": "ANCHOR_PROCEDURE_DRAFT.md", "role": "draft procedure, not verified"},
    {"path": "check_v3_addendum.py", "role": "offline stdlib checker"},
    {"path": "SHA256SUMS", "role": "SHA-256 of every other file in this folder"},
]


def build_manifest() -> dict[str, Any]:
    doc = build_document()
    return {
        "format": "smplwise-arx/wiskey-trusted-caller/vector-package-manifest",
        "format_version": 1,
        "protocol": gv.PROTOCOL,
        "package": PACKAGE,
        "addendum_version": ADDENDUM_VERSION,
        "vectors_version": 3,
        "date": "2026-10-04",
        "delivery_target": "2026-10-06",
        "status": "DRAFT for WisKey reading and verification; documents and synthetic vectors only; no runtime, no live run",
        "files": PACKAGE_FILES,
        "earlier_files_pinned": PINNED_EARLIER_FILES,
        "v1_vectors_canonical_sha256": gv.V1_VECTORS_SHA256,
        "complements": COMPLEMENTS,
        "supersedes": SUPERSEDES,
        "carried_supersedes": CARRIED_SUPERSEDES,
        "group_complements": GROUP_COMPLEMENTS,
        "counts": doc["counts"],
        "model_only_groups": list(MODEL_ONLY_GROUPS),
        "not_verified": ["any runtime: there is no door_open, door_open_status or trusted_door_capabilities service",
                         "a real Supervisor /host/info, its versions and its exact dt_utc format (COMPAT.md, planned 2026-10-08)",
                         "SQLite durability of the high-water, concurrency, restarts",
                         "the HMAC rotation procedure (draft planned 2026-10-12); it is separate from the Ed25519 package-signer procedure"],
        "checker": "python check_v3_addendum.py  (stdlib only, offline; exit 0 = all checks passed)",
    }


def render(doc: dict[str, Any]) -> str:
    return gv.render_v3(doc)


def sums_text() -> str:
    lines = []
    for p in sorted(ADDENDUM_DIR.iterdir(), key=lambda q: q.name):
        if p.is_file() and p.name != "SHA256SUMS":
            lines.append(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- tests


def test_addendum_files_have_not_drifted():
    assert ADDENDUM_FILE.read_text(encoding="utf-8") == render(build_document())
    assert MANIFEST_FILE.read_text(encoding="utf-8") == render(build_manifest())


def test_sha256sums_cover_every_file():
    assert SUMS_FILE.read_text(encoding="utf-8") == sums_text()
    assert sorted(f["path"] for f in PACKAGE_FILES) == sorted(p.name for p in ADDENDUM_DIR.iterdir() if p.is_file())


def test_earlier_packages_unchanged():
    assert hashlib.sha256(gv.VECTORS_FILE.read_bytes()).hexdigest() == gv.V2_FILE_SHA256
    assert hashlib.sha256(gv.VECTORS_V3_FILE.read_bytes()).hexdigest() == V3_FILE_SHA256
    assert gv._v1_vectors_sha(json.loads(gv.VECTORS_FILE.read_text(encoding="utf-8"))["vectors"]) == gv.V1_VECTORS_SHA256
    for f in PINNED_EARLIER_FILES:
        name = f["path"].rsplit("/", 1)[-1]
        assert hashlib.sha256((CONTRACT_DIR / name).read_bytes()).hexdigest() == f["sha256"], name


def test_case_ids_unique_and_new():
    ids = [c["id"] for c in build_cases()]
    old = {v["id"] for v in gv.build_contract_vectors()} | {v["id"] for v in gv.build_contract_vectors_v3()}
    assert len(ids) == len(set(ids)) and not set(ids) & old


def test_signed_cases_agree_with_the_reference():
    for v in build_cases():
        if v["kind"] != "signed":
            continue
        sd = json.loads(v["service_data_json"])
        resp, effects = addendum_door_service(v["service"], sd, v["now"], v["state_setup"])
        assert resp == v["expected_response"], (v["id"], resp)
        assert effects == v["expected_side_effects"], (v["id"], effects)
        assert gv.schema_ok(RESPONSE_SCHEMAS[v["response_schema"]], resp), v["id"]
        if resp["result"] == "rejected":
            assert (resp["stage"], resp["code"]) == (v["reject_stage"], v["reject_code"]), v["id"]
            assert not effects["pending_created"] and not effects["dispatched"] and not effects["status_read"], v["id"]
        if v["expect"] == "stateful":
            assert gv.contract_validate_v3(v["service"], sd, v["now"]).as_json() == v["expected_dto"], v["id"]
        for f in v.get("forbidden_responses", ()):
            assert not gv.schema_ok(RESPONSE_SCHEMAS[v["response_schema"]], f["response"]), v["id"]
            if "must_fail_schema" in f:
                assert not gv.schema_ok(RESPONSE_SCHEMAS[f["must_fail_schema"]], f["response"]), v["id"]
                assert gv.schema_ok(gv.RESPONSE_SCHEMAS[f["must_fail_schema"]], f["response"]) == f["accepted_by_v3_schema"], v["id"]


def test_station_cases_never_fall_back():
    for v in build_cases():
        if v["group"] == "station":
            assert v["expected_side_effects"]["fallback_used"] is False
            if v["expected_response"]["result"] == "rejected":
                assert v["state_setup"]["lock_fallback_configured"] is True and not v["expected_side_effects"]["dispatched"]


def test_capabilities_cases_agree_with_the_model():
    n = 0
    for v in build_cases():
        if v["kind"] != "capabilities_model":
            continue
        sel, cache, actions = capabilities_model(v)
        assert (sel, cache, actions) == (v["expected_selection"], v["expected_cache_after"], v["expected_actions"]), v["id"]
        assert not actions["open_retried"] and not actions["alternate_relay_tried"] and not actions["lock_fallback"], v["id"]
        assert not actions["stale_list_used"], v["id"]
        n += 1
    assert n >= 20


def test_anchor_cases_agree_with_the_model():
    for v in build_cases():
        if v["kind"] == "anchor_scenario":
            got = anchor_model(v)
            assert got == [s["expect"] for s in v["steps"]], (v["id"], got)


def test_corrected_status_unknown_keeps_every_v3_case():
    for v in gv.build_contract_vectors_v3():
        if v["response_schema"] == "status_unknown":
            assert gv.schema_ok(RESPONSE_SCHEMAS["status_unknown"], v["expected_response"]), v["id"]
    for r in NO_LONGER_STATUS_REASONS:
        inst = {"result": "unknown", "request_id": gv.STATUS_REQUEST_ID, "target_request_id": gv.DOOR_OPEN["request_id"], "reason": r}
        assert not gv.schema_ok(RESPONSE_SCHEMAS["status_unknown"], inst)
        assert gv.schema_ok(gv.RESPONSE_SCHEMAS["status_unknown"], inst)


def test_metadata_correction_points_at_the_v3_value():
    v3 = {v["id"]: v for v in json.loads(gv.VECTORS_V3_FILE.read_text(encoding="utf-8"))["contract_vectors_v3"]}
    for m in build_document()["metadata_corrections"]:
        assert v3[m["case_id"]][m["field"]] == m["v3_value"]


def test_model_only_marking():
    for v in build_cases():
        assert (v.get("model_only") is True) == (v["group"] in MODEL_ONLY_GROUPS), v["id"]
        if v["group"] in MODEL_ONLY_GROUPS:
            assert v["verified"] is False, v["id"]


def test_accept_and_stateful_messages_verify_with_the_existing_verifier():
    for v in build_cases():
        if v["kind"] == "signed" and v["expect"] == "stateful":
            wire = json.loads(v["signed_message_json"])
            assert gv.bridge_signing.Verifier(gv.TEST_SECRET).verify(dict(wire), now=wire["ts"]) is None, v["id"]


def test_standalone_checker_passes():
    r = subprocess.run([sys.executable, str(CHECKER)], capture_output=True, text=True, encoding="utf-8", timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr


if __name__ == "__main__":
    if "--write" in sys.argv:
        ADDENDUM_DIR.mkdir(parents=True, exist_ok=True)
        ADDENDUM_FILE.write_bytes(render(build_document()).encode("utf-8"))
        MANIFEST_FILE.write_bytes(render(build_manifest()).encode("utf-8"))
        SUMS_FILE.write_bytes(sums_text().encode("utf-8"))
        print(f"wrote {ADDENDUM_FILE.name}, {MANIFEST_FILE.name}, {SUMS_FILE.name}")
    else:
        print(render(build_document()))
