"""Bounded external reader for the original Arx exporter; no authority or I/O.

The exporter snapshot is unchanged. Its SHA256 covers only that snapshot.
Publication metadata must ALSO be authenticated by the existing bridge carrier.
Station CAS, row mapping revisions and export sequence are separate domains.
"""

from __future__ import annotations

import hashlib
import json
import re
from copy import deepcopy
from datetime import datetime

from .trusted_actions.validation import Refusal, strict_json

SCHEMA = "arx.wiskey.relay_map_snapshot.v1"
SOURCE = {
    "system": "smplwise_arx",
    "map": "wiskey_relay_map",
    "station_revisions": "wiskey_relay_map_stations",
    "direction": "arx_to_native",
}
MAX_INTEGER = 9007199254740991
MAX_STATIONS = 200
MAX_BYTES = 262144
RECORD_FIELDS = {
    "seq",
    "kind",
    "rollback_of",
    "content_digest",
    "exported_by",
    "exported_at",
    "acked_by",
    "acked_at",
    "state",
    "stale",
    "current",
    "newer_approvals",
    "snapshot",
}


def _bad(code="relay_export_invalid"):
    raise Refusal(code)


def fields(value, keys):
    if type(value) is not dict or set(value) != set(keys):
        _bad()


def integer(value, low=0, high=MAX_INTEGER):
    if type(value) is not int or not low <= value <= high:
        _bad()
    return value


def text(value, *, nullable=False, maximum=128):
    if nullable and value is None:
        return value
    if (
        type(value) is not str
        or not 1 <= len(value) <= maximum
        or any(ord(c) < 32 or ord(c) == 127 for c in value)
    ):
        _bad()
    try:
        value.encode("utf-8", errors="strict")
    except UnicodeError:
        _bad()
    return value


def timestamp(value, *, nullable=False):
    if nullable and value is None:
        return
    text(value, maximum=64)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.utcoffset() is None:
            _bad()
    except ValueError:
        _bad()


def canonical_json(value):
    try:
        return json.dumps(
            value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
        ).encode("utf-8")
    except (TypeError, ValueError, UnicodeError, RecursionError):
        _bad()


def content_digest(snapshot):
    return "sha256:" + hashlib.sha256(canonical_json(snapshot)).hexdigest()


def read_snapshot(value):
    """Validate exact external fields/types/bounds, retaining every original byte value.

    Null provenance is valid for legacy rows. No null field is manufactured for
    absent provenance; absent required fields refuse. No Unicode normalization.
    """
    if type(value) in (str, bytes):
        value = strict_json(value, limit=MAX_BYTES)
    fields(value, {"schema", "source", "coverage", "stations", "row_count", "tombstone_count"})
    if value["schema"] != SCHEMA or value["coverage"] != "full":
        _bad()
    fields(value["source"], SOURCE)
    if value["source"] != SOURCE:
        _bad("relay_export_source_mismatch")
    stations = value["stations"]
    if type(stations) is not list or len(stations) > MAX_STATIONS:
        _bad()
    ids, row_count, tombstones = [], 0, 0
    for station in stations:
        fields(
            station,
            {
                "station_id",
                "station_revision",
                "approved_by",
                "approved_at",
                "rows",
                "unmapped_api_relays",
            },
        )
        ids.append(text(station["station_id"]))
        integer(station["station_revision"])
        text(station["approved_by"], nullable=True, maximum=256)
        timestamp(station["approved_at"], nullable=True)
        rows = station["rows"]
        if type(rows) is not list or len(rows) > 2:
            _bad()
        apis, active_physical = [], []
        for row in rows:
            fields(
                row,
                {
                    "api_relay",
                    "physical_relay",
                    "active",
                    "row_revision",
                    "confirmed_by",
                    "updated_at",
                },
            )
            apis.append(integer(row["api_relay"], 1, 2))
            integer(row["physical_relay"], 1, 2)
            integer(row["row_revision"], 1)
            if type(row["active"]) is not bool:
                _bad()
            text(row["confirmed_by"], nullable=True, maximum=256)
            timestamp(row["updated_at"], nullable=True)
            if row["active"]:
                active_physical.append(row["physical_relay"])
            else:
                tombstones += 1
        unmapped = station["unmapped_api_relays"]
        if (
            apis != sorted(set(apis))
            or len(active_physical) != len(set(active_physical))
            or type(unmapped) is not list
            or any(type(a) is not int or a not in (1, 2) for a in unmapped)
            or unmapped != [a for a in (1, 2) if a not in apis]
        ):
            _bad()
        row_count += len(rows)
    if ids != sorted(set(ids)):
        _bad()
    integer(value["row_count"], 0, MAX_STATIONS * 2)
    integer(value["tombstone_count"], 0, MAX_STATIONS * 2)
    if value["row_count"] != row_count or value["tombstone_count"] != tombstones:
        _bad()
    if len(canonical_json(value)) > MAX_BYTES:
        _bad("relay_export_capacity")
    return deepcopy(value)


def read_record(value):
    """The exact ExportRecord.full() document, separately from snapshot v1."""
    fields(value, RECORD_FIELDS)
    integer(value["seq"], 1)
    if type(value["kind"]) is not str or value["kind"] not in {"export", "rollback"}:
        _bad()
    if value["kind"] == "export":
        if value["rollback_of"] is not None:
            _bad()
    else:
        integer(value["rollback_of"], 1, value["seq"] - 1)
    for key in ("stale", "current"):
        if type(value[key]) is not bool:
            _bad()
    text(value["exported_by"], maximum=256)
    timestamp(value["exported_at"])
    text(value["acked_by"], nullable=True, maximum=256)
    timestamp(value["acked_at"], nullable=True)
    if value["state"] not in ("exported", "acked"):
        _bad()
    if (value["acked_by"] is None) != (value["acked_at"] is None):
        _bad()
    if (value["state"] == "acked") != (value["acked_at"] is not None):
        _bad()
    newer = value["newer_approvals"]
    if type(newer) is not list or len(newer) > MAX_STATIONS * 2:
        _bad()
    for sid in newer:
        text(sid)
    if newer != sorted(set(newer)):
        _bad()
    snap = read_snapshot(value["snapshot"])
    digest = value["content_digest"]
    if type(digest) is not str or re.fullmatch(r"sha256:[0-9a-f]{64}", digest) is None:
        _bad()
    if content_digest(snap) != digest:
        _bad("relay_export_digest_mismatch")
    if len(canonical_json(value)) > MAX_BYTES:
        _bad("relay_export_capacity")
    return deepcopy(value)


def immutable_record(value):
    """Mutable original ACK/status fields do not change a publication's identity."""
    return {
        k: deepcopy(value[k])
        for k in (
            "seq",
            "kind",
            "rollback_of",
            "content_digest",
            "snapshot",
            "exported_by",
            "exported_at",
        )
    }


def require_forward(previous, current):
    """Observed source horizon, never an incremented Native counter or authority.

    This guards a surviving Native projection. It makes no anti-rollback claim
    across replacement/restoration of BOTH databases and projection history.
    """
    old, new = read_record(previous), read_record(current)
    if new["seq"] < old["seq"]:
        _bad("relay_export_stale_sequence")
    if new["seq"] == old["seq"]:
        if immutable_record(new) != immutable_record(old):
            _bad("relay_export_sequence_conflict")
        return
    before = {s["station_id"]: s for s in old["snapshot"]["stations"]}
    after = {s["station_id"]: s for s in new["snapshot"]["stations"]}
    if set(before) - set(after):
        _bad("relay_export_history_would_disappear")
    for sid, prior in before.items():
        now = after[sid]
        if now["station_revision"] < prior["station_revision"]:
            _bad("relay_export_revision_regression")
        if now["station_revision"] == prior["station_revision"] and now != prior:
            _bad("relay_export_station_revision_conflict")
        rows = {r["api_relay"]: r for r in now["rows"]}
        for row in prior["rows"]:
            updated = rows.get(row["api_relay"])
            if updated is None:
                _bad("relay_export_tombstone_required")
            if updated["row_revision"] < row["row_revision"]:
                _bad("relay_export_revision_regression")
            if updated["row_revision"] == row["row_revision"] and updated != row:
                _bad("relay_export_row_revision_conflict")


def project(snapshot, inventory, *, include_inactive=False):
    """Return startup.v2 station facts only for exact complete active coverage.

    Inventory is from original ConfigEntry/managed_locks, never upstream labels.
    Inactive/unmapped facts are valid snapshots, but cannot silently become an
    active grant in the closed existing startup.v2 contract.
    """
    snap = read_snapshot(snapshot)
    supplied = {s["station_id"]: s for s in snap["stations"]}
    if set(supplied) - set(inventory):
        _bad("relay_export_station_mismatch")
    wanted = {sid for sid, item in inventory.items() if item["relays"]}
    if wanted - set(supplied):
        _bad("relay_export_inventory_incomplete")
    output = []
    for sid in sorted(supplied):
        station, native = supplied[sid], inventory[sid]
        relays = {tuple(row) for row in native["relays"]}
        have = {(r["api_relay"], r["physical_relay"]) for r in station["rows"]}
        if relays != have:
            _bad("relay_export_inventory_mismatch")
        if not include_inactive and any(not row["active"] for row in station["rows"]):
            _bad("relay_export_inactive_mapping_requires_versioned_activation")
        if not relays:
            continue
        output.append(
            {
                "entry_id": sid,
                "identity": native["identity"],
                "relays": [
                    {
                        "api_relay": row["api_relay"],
                        "physical_relay": row["physical_relay"],
                        "mapping_revision": row["row_revision"],
                        **({"active": row["active"]} if include_inactive else {}),
                    }
                    for row in station["rows"]
                ],
            }
        )
    return output
