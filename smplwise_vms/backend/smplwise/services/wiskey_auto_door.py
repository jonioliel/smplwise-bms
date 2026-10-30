"""WISKEY-OWNER26-297 (W-018, owner26 Q2 "auto"): the original door-automation caller on WisKey's Native `door_automations` feature.

`door_automation._fire_door` decides a fire (every gate, the attempt row committed first) and hands ONE door to a `DoorSender`. This module
is the live sender behind that seam. It sends exactly what the Native `AutomationDoorCoordinator` (WisKey CODE e732562e,
`access/arx_door_execution.py`) admits:

- feature `door_automations` through `features/start` of the existing direct `FeatureAdapters` (`DirectJoin.features_or_none`); nothing new
  on the wire and no new signing caller;
- the ORIGINAL automation actor from Arx's own block row, never a fabricated user: `automation_id` = the block id, `run_id` = the fire's
  door request id, `trigger_id` = the matched `last_triggered` stamp, `creator_user_id` = who created the block, `approver_user_id` = who
  armed it, `grant_revision` = the block's policy revision (= the request's `authority_revision`, WisKey's equality rule);
- the CURRENT policy judged for exactly that creator and approver (`wiskey_feature_exec.resolve_policy`, deny wins): the pulse needs
  `door/pulse`, i.e. `access.doors.open` on the door's station for BOTH of them, and a confirmed relay map; otherwise nothing is sent;
- params `station_id`, `relay` (the physical relay of the confirmed map), `mapping_revision`, `automation_ref` (= automation_id) and
  `expiry` = the fire's own `not_after`, which is also the execution deadline.

Outcomes (the `DoorSender` vocabulary): `not_sent` when nothing left Arx (no selected direct connection, no block / actor / relay map,
incomplete policy, a pre-flight refusal), `refused` for a closed host refusal, `sent` only for a finished receipt whose phase is
`acknowledged`, `unknown` for everything else (no answer, a running operation at the deadline, an off-contract receipt). One request id is
admitted once (`wiskey_feature_intents`): never retried, never replayed.

Nothing here turns the feature on: `door_automation.GO_LIVE_PERMITTED` stays False, so `_switch_reason` refuses (`feature_off`) before
any sender is called in this build. Tests reach this sender with the permit patched on and a fake direct port only."""
from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone
from typing import Any, Callable

from ..rbac import Principal
from . import wiskey_feature_exec as fx
from .wiskey_feature_direct import FeatureWireError

FEATURE = "door_automations"
PERMISSION = "door/pulse"
POLL_GAP_S = 0.5


def _features_from_join() -> Any:
    from . import wiskey_direct_join as wdj

    join = wdj.JOIN
    return join.features_or_none() if join is not None else None


FEATURES_PROVIDER: Callable[[], Any] = _features_from_join  # tests: a fake FeatureAdapters provider


def _automation_now() -> datetime:
    from . import door_automation as da

    return da.now()


def scope_ref_of(block_id: str, station_id: str, relay: int) -> str:
    return "auto:" + hashlib.sha256(f"{block_id}\x1f{station_id}\x1f{relay}".encode("utf-8")).hexdigest()[:32]


def _utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _principal(conn: Any, user_id: Any) -> Principal | None:
    if not isinstance(user_id, str) or not user_id:
        return None
    row = conn.execute("SELECT id, username, display_name, source, active FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None or not row["active"]:
        return None
    return Principal(user_id=row["id"], username=row["username"] or "", display_name=row["display_name"] or "", source=row["source"] or "")


RECEIPT_KEYS = frozenset({"original", "phase", "physical_result", "replay_available"})  # AutomationDoorCoordinator.receipt (e732562e)


def receipt_phase(receipt: Any) -> str | None:
    """The pulse phase of a finished `door_automations` receipt; None when the receipt is not the closed Native shape. `acknowledged`
    is the native receipt of the pulse, never a physical observation (`physical_result` is always `unknown`)."""
    if (not isinstance(receipt, dict) or set(receipt) != RECEIPT_KEYS or receipt.get("physical_result") != "unknown"
            or receipt.get("replay_available") is not False or not isinstance(receipt.get("phase"), str)):
        return None
    return receipt["phase"]


class NativeDoorSender:
    """`door_automation.DoorSender` over the Native `door_automations` feature. `db` is Arx's Database; `features` returns the
    `FeatureAdapters` of the selected direct connection, or None."""

    def __init__(self, db: Any, *, features: Callable[[], Any] | None = None, clock: Callable[[], datetime] | None = None,
                 sleep: Callable[[float], None] = time.sleep, monotonic: Callable[[], float] = time.monotonic) -> None:
        self.db = db
        self.features = features or FEATURES_PROVIDER
        self.clock = clock or _automation_now  # the fire path's own clock (door_automation.now: UTC, test-settable)
        self.sleep = sleep
        self.monotonic = monotonic

    def open(self, *, operator: Principal, station_id: str, relay: int, request_id: str, not_after: datetime) -> tuple[str, str | None]:
        from . import door_automation as da

        if not da.is_operator(operator):
            return "not_sent", "not_an_operator"
        block_id = operator.user_id[len(da.OPERATOR_PREFIX):]
        try:
            adapters = self.features()
        except Exception:  # noqa: BLE001 - an unreadable selection is "not selected"
            adapters = None
        if adapters is None or self.db is None:
            return "not_sent", "transport_not_selected"
        deadline = self.monotonic() + max(0.0, (not_after - self.clock()).total_seconds())
        with self.db.connection(label="door automation native start") as conn:
            row = da.get(conn, block_id)
            if row is None or row["state"] != "armed":
                return "not_sent", "not_armed"
            creator, approver = _principal(conn, row["created_by"]), _principal(conn, row["armed_by"])
            if creator is None or approver is None:
                return "not_sent", "actor_unknown"
            mapped = fx.relay_row_for_door(conn, station_id, relay)  # WISKEY-RC5-2310: `relay` is the door's physical relay
            if mapped is None:
                return "not_sent", "relay_map_missing"
            try:
                actor = fx.automation_actor(automation_id=row["id"], run_id=request_id, trigger_id=row["corroborated_trigger"] or request_id,
                                            creator_user_id=creator.user_id, approver_user_id=approver.user_id, grant_revision=row["policy_revision"])
                body, snapshot = adapters.prepare(
                    conn, feature=FEATURE, actor=actor, principals=[creator, approver], authority_ref=f"door-automation:{row['id']}",
                    authority_revision=row["policy_revision"], scope_ref=scope_ref_of(row["id"], station_id, relay), parameter_reference=request_id,
                    params={"station_id": station_id, "relay": mapped.physical_relay, "mapping_revision": mapped.revision,
                            "automation_ref": row["id"], "expiry": _utc(not_after)},
                    now=self.clock(), source_epoch=str(row["policy_revision"]), actor_session_active=True, targets=[(station_id, mapped.api_relay)],
                    execution_expires_at=not_after, request_id=request_id)
            except FeatureWireError as exc:
                return "not_sent", exc.code
            except fx.FeatureError as exc:
                return "not_sent", exc.code
            if PERMISSION not in snapshot["permissions"]:
                return "not_sent", "permission_missing"
            try:
                started = adapters.start(conn, body, snapshot)
            except FeatureWireError as exc:
                return ("unknown" if exc.outcome == "unknown" else "not_sent" if exc.outcome == "not_sent" else "refused"), exc.code
            except fx.FeatureError as exc:  # duplicate request id: one attempt only
                return "not_sent", exc.code
            if started.state == "not_sent":
                return "not_sent", started.code
            if started.state == "refused":
                return "refused", started.code
            if started.state != "admitted" or not started.operation_ref:
                return "unknown", started.code or "unknown"
            return self._await(conn, adapters, body["request_id"], started.operation_ref, deadline)

    def _await(self, conn: Any, adapters: Any, request_id: str, operation_ref: str, deadline: float) -> tuple[str, str | None]:
        """Completion reads until the fire's own deadline. A failed READ settles nothing; a still-running operation is `unknown`."""
        from .wiskey_feature_direct import _commit

        while True:
            try:
                res = adapters.client.result(operation_ref)
            except FeatureWireError:
                res = None
            if res is not None and res.state != "running":
                phase = receipt_phase(res.receipt) if res.state == "finished" else None
                if phase == "acknowledged":
                    fx.settle_feature(conn, request_id, "accepted", "acknowledged")
                    _commit(conn)
                    return "sent", "acknowledged"
                fx.settle_feature(conn, request_id, "unknown", "receipt_unknown")
                _commit(conn)
                return "unknown", phase or res.state
            if self.monotonic() + POLL_GAP_S > deadline:
                return "unknown", "running"
            self.sleep(POLL_GAP_S)
