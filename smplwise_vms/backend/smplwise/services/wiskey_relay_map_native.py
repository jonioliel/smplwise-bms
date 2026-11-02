"""WISKEY-RC7-ADOPT-2331 (rc.7 map row 6): the Native transfer adapter of the relay map export (WisKey Mac rc.7 contribution
`services/wiskey_relay_map_native.py` against Arx 876d0edf, adopted semantically - docs/changes/WISKEY-RC7-ADOPT-2331.md).

No replacement map and no second journal: the export record comes from the original exporter (services/wiskey_relay_map_export.py,
migration 0194) and the transport is the existing direct port (services/wiskey_capture_port.py), whose hello / reply MAC, connection
and correlation are already verified by the direct transport.

- `publish`: ONE original DB transaction commits the full export BEFORE any socket I/O; then `installation/relay_map_source_v1`
  (closed shape, binding = the authenticated port identity) and ONE `installation/relay_map_stage_v1`. The ACK is checked against the
  exact record (seq, content digest, repository) and means durable STAGING of exact facts only - never activation, loaded, ready or a
  door state (`activation = not_performed`, `loaded = ready = false`). A verified ACK marks the export acked locally by
  `native:<entry_id>` (the MAC-verified subject, never an upstream string). No retry, no grant, no restart, no quiesce, no ECC.
  A reply that does not verify is `relay_export_invalid_ack` with outcome `unknown` (never replayed).
- `publish_selected`: the post-approval sync of routers/wiskey_relay_map.py - only with the owner's `wiskey.auto_install` switch ON
  (owner decision 1B: nothing turns it on), only while the direct join selects both commands, stage v1 only, within the caller's
  absolute deadline.
- `prepare_quiesced`: v1 / v2 prepare of a staged export. Its ONLY intended caller is the original controller's `maintenance_v1`
  (REPLY_TO_WISKEY_RC7_INTAKE section 3), which is NOT_BUILT until WisKey confirms the ABI; it therefore demands a maintenance token
  and no production module calls it (pinned by tests/test_wiskey_rc7_adopt_2331.py).
"""
from __future__ import annotations

from typing import Any

from . import wiskey_call_budget as budget
from . import wiskey_relay_map_export as exporter
from .wiskey_capture_port import PortError

SOURCE = "installation/relay_map_source_v1"
STAGE = "installation/relay_map_stage_v1"
PREPARE = "installation/relay_map_prepare_v1"
STAGE_V2 = "installation/relay_map_stage_v2"
PREPARE_V2 = "installation/relay_map_prepare_v2"
COMMANDS = (SOURCE, STAGE, PREPARE, PREPARE_V2, STAGE_V2)
CONTRACT = "wiskey-relay-map-transfer.v1"
CONTRACT_V2 = "wiskey-relay-map-activation.v2"
ACK_CONTRACT = "wiskey-relay-map-ack.v1"
SOURCE_FIELDS = frozenset({"contract", "schema_version", "binding", "inventory", "anti_rollback_scope", "full_restore_continuity"})
ACK_FIELDS = frozenset({"contract", "schema_version", "state", "code", "seq", "content_digest", "repository_id", "projection_sha256",
                        "activation", "loaded", "ready"})
DEFAULT_TIMEOUT_S = 10.0


def _source(port: Any, timeout_s: float) -> dict[str, Any]:
    source = dict(port.call(SOURCE, {}, timeout_s=budget.remaining(timeout_s)))
    if (set(source) != SOURCE_FIELDS or source.get("contract") != CONTRACT or type(source.get("schema_version")) is not int
            or source["schema_version"] != 1):
        raise PortError("relay_export_invalid_source_response", "refused")
    identity = port.identity()
    binding = source["binding"]
    if (not isinstance(binding, dict) or binding.get("repository_id") != identity.repository_id
            or binding.get("bridge_entry_id") != identity.entry_id or binding.get("query_owner_id") != identity.query_owner_id
            or binding.get("connection_ref") != identity.connection_ref):
        raise PortError("relay_export_source_binding_changed", "refused")
    return source


def _ack(reply: Any, record: dict[str, Any], source: dict[str, Any]) -> dict[str, Any]:
    if (not isinstance(reply, dict) or set(reply) != ACK_FIELDS
            or reply["contract"] != ACK_CONTRACT or type(reply["schema_version"]) is not int or reply["schema_version"] != 1
            or type(reply["seq"]) is not int or reply["seq"] != record["seq"] or reply["content_digest"] != record["content_digest"]
            or reply["repository_id"] != source["binding"]["repository_id"] or reply["state"] not in {"staged", "unchanged", "prepared"}
            or reply["activation"] != "not_performed" or reply["loaded"] is not False or reply["ready"] is not False
            or not isinstance(reply["projection_sha256"], str) or len(reply["projection_sha256"]) != 64
            or any(c not in "0123456789abcdef" for c in reply["projection_sha256"])):
        raise PortError("relay_export_invalid_ack", "unknown")
    return reply


def publish(db: Any, port: Any, *, by: str, timeout_s: float = DEFAULT_TIMEOUT_S, version: int = 1) -> dict[str, Any]:
    """One committed snapshot, one authenticated stage and one verified ACK. The caller hands an already selected direct port. No frame
    is sent under a DB or generation lock; a failed COMMIT raises before anything is sent."""
    if version not in (1, 2):
        raise PortError("relay_export_version_unavailable", "not_sent")
    with budget.scope(timeout_s):
        with db.connection(label="relay export commit-before-publish") as conn:
            record = exporter.export(conn, by=by).full()
        # Leaving the connection context commits (or raises). This point never moves into the transaction or a generation lock.
        source = _source(port, timeout_s)
        payload = {"contract": CONTRACT if version == 1 else CONTRACT_V2, "schema_version": version, "binding": source["binding"],
                   "record": record}
        reply = _ack(dict(port.call(STAGE if version == 1 else STAGE_V2, payload, timeout_s=budget.remaining(timeout_s))), record, source)
        if reply["code"] is not None:
            return {"state": "staged_activation_blocked", "ack": reply, "record": record}
        if reply["state"] not in {"staged", "unchanged"}:
            raise PortError("relay_export_invalid_ack_stage", "unknown")
        identity = port.identity()  # the MAC-verified direct subject, not an upstream by-string
        with db.connection(label="relay export authenticated staged ack") as conn:
            acked = exporter.ack(conn, seq=record["seq"], content_digest=record["content_digest"], by="native:" + identity.entry_id).full()
        return {"state": "staged", "ack": reply, "record": acked}


def prepare_quiesced(db: Any, port: Any, staged: dict[str, Any], *, maintenance_token: str, timeout_s: float = DEFAULT_TIMEOUT_S,
                     version: int = 1) -> dict[str, Any]:
    """Prepare a staged export - ONLY inside the original controller's authorized quiescent `maintenance_v1` (NOT_BUILT: the caller
    passes the maintenance token it holds by CAS). This adapter never unloads an entry and never asks for a restart; the token is
    not sent (the ABI is not agreed yet) and is only required so that no other path can reach this function."""
    if not isinstance(maintenance_token, str) or not maintenance_token:
        raise PortError("relay_export_maintenance_required", "not_sent")
    if version not in (1, 2):
        raise PortError("relay_export_version_unavailable", "not_sent")
    with budget.scope(timeout_s):
        record = staged["record"]
        with db.connection(mode="read", label="relay export still current") as conn:
            current = exporter.get(conn, record["seq"])
            if current.stale or not current.current or current.kind != "export":
                raise PortError("relay_export_not_current", "not_sent")
        source = _source(port, timeout_s)
        payload = {"contract": CONTRACT if version == 1 else CONTRACT_V2, "schema_version": version, "binding": source["binding"],
                   "seq": record["seq"], "content_digest": record["content_digest"], "projection_sha256": staged["ack"]["projection_sha256"]}
        reply = dict(port.call(PREPARE if version == 1 else PREPARE_V2, payload, timeout_s=budget.remaining(timeout_s)))
        return _ack(reply, record, source)


def publish_selected(db: Any, *, by: str, deadline: float) -> dict[str, Any]:
    """The automatic post-approval software sync (stage v1 only). Owner decision 1B: nothing at all - no join lookup, no I/O - unless
    the owner switched `wiskey.auto_install` on; then only through the existing selection rule."""
    from .wiskey_auto_install import switch_on_db
    from .wiskey_direct_join import installed

    if not switch_on_db(db):
        return {"state": "switch_off"}
    with budget.until(deadline):
        join = installed()
        if join is None or not join.selected(SOURCE) or not join.selected(STAGE):
            return {"state": "not_selected"}
        return publish(db, join.capture_port, by=by, timeout_s=budget.remaining(DEFAULT_TIMEOUT_S))
