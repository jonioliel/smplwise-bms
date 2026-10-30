"""Finite, source-authorized native validation; no route or activation.

The fixed steps observe the actual pinned station client and may perform one
separately authorized native momentary pulse. Configuration and HTTP command
acknowledgements never establish physical relay behavior or a human witness.
"""

from __future__ import annotations

import asyncio
import weakref
from copy import deepcopy
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

import httpx

from .. import arx_preview_features as features
from ..client.effect_scope import RequestRule, native_effect_scope
from ..client.technical import number, read_door
from ..media_lifetime import join_owned
from ..trusted_actions.envelope import freeze, thaw
from ..trusted_actions.validation import Refusal, reference
from .arx_door_execution import NativeDoorTarget
from .arx_execution_authority import FeatureLease
from .arx_execution_journal import FeatureExecutionJournal
from .arx_feature_intents import absolute_time
from .models import AccessError

VALIDATION_KIND = "native_validation.v1"
PERMISSIONS = {
    "identity": "validation/identity",
    "door_capabilities": "validation/door_capabilities",
    "door_read": "validation/door_read",
    "pulse": "door/pulse",
    "video": "validation/media",
    "two_way_audio": "validation/media",
}
OBSERVATIONS = {
    "identity": {"identity_matched": True},
    "door_capabilities": {"pulse_advertised": True},
    "door_read": {"configuration_read": True},
    "pulse": {"command_acknowledged": True},
    "video": {"native_session_closed": True},
    "two_way_audio": {"native_session_closed": True},
}
_OWNERS = weakref.WeakKeyDictionary()
_MEDIA = weakref.WeakKeyDictionary()


@dataclass(frozen=True, repr=False, eq=False)
class ValidationMediaInput:
    """Original native inputs, never decoded from feature JSON or consent text."""

    step_id: str
    connection: object
    request: object = None
    view: object = None
    subscription: int | None = None


@dataclass(frozen=True, repr=False, eq=False)
class ValidationMediaStep:
    """Identity-issued native step permit; construction alone grants nothing."""

    owner: object
    lease: FeatureLease
    target: NativeDoorTarget
    direction: str
    consent: object
    connection: object
    request: object
    view: object
    subscription: int | None
    duration_seconds: int
    deadline: object
    step_id: str


@dataclass(frozen=True, repr=False)
class _Execution:
    task: asyncio.Task
    coroutine: object
    record: object
    cancel_requested: list


@dataclass(frozen=True, repr=False)
class _Ownership:
    dependencies: tuple
    roots: tuple
    execution: list
    media: list


async def _inspect_pulse(client, relay):
    """Read exact native capability without changing the emergency command enum."""
    caps = await client._get("/ISAPI/AccessControl/RemoteControl/door/capabilities")
    root = caps.get("RemoteControlDoor")
    if (
        type(root) is not dict
        or type(root.get("cmd")) is not dict
        or type(root.get("doorNo")) is not dict
    ):
        raise AccessError("operation_unsupported")
    options, bounds = root["cmd"].get("@opt"), root["doorNo"]
    if type(options) is not str or len(options) > 256:
        raise AccessError("operation_unsupported")
    if "open" not in options.split(",") or not number(bounds.get("@min")) <= relay <= number(
        bounds.get("@max")
    ):
        raise AccessError("operation_unsupported")


class ValidationExecutionJournal(FeatureExecutionJournal):
    """Existing durable journal with a closed completion-only step grammar."""

    @staticmethod
    def _completion(before: dict[str, Any], after: dict[str, Any]) -> bool:
        if before.get("kind") != VALIDATION_KIND:
            return FeatureExecutionJournal._completion(before, after)
        if (
            set(before) != {"kind", "owner_go", "checklist_ref", "steps"}
            or set(after) != set(before)
            or after["kind"] != VALIDATION_KIND
            or before["owner_go"] != after["owner_go"]
            or before["checklist_ref"] != after["checklist_ref"]
            or type(before["steps"]) is not list
            or type(after["steps"]) is not list
            or not 1 <= len(before["steps"]) == len(after["steps"]) <= 64
        ):
            return False
        changed = False
        for old, new in zip(before["steps"], after["steps"], strict=True):
            if old == new:
                continue
            changed = True
            if (
                set(old)
                != (
                    {"step_id", "action", "target", "phase", "observation"}
                    | ({"media"} if old.get("action") in {"video", "two_way_audio"} else set())
                )
                or set(new) != set(old)
                or old["action"] not in PERMISSIONS
                or any(new[k] != old[k] for k in ("step_id", "action", "target"))
                or new.get("media") != old.get("media")
            ):
                return False
            if old["phase"] == "prepared" and new["phase"] in {"aborted", "denied"}:
                if old["observation"] is not None or new["observation"] is not None:
                    return False
            elif old["phase"] == "attempted" and new["phase"] in {"acknowledged", "unknown"}:
                expected = OBSERVATIONS[old["action"]] if new["phase"] == "acknowledged" else None
                if old["observation"] is not None or new["observation"] != expected:
                    return False
            else:
                return False
        return changed


class ValidationCoordinator:
    """An authenticated ordered checklist against exact original native targets.

    The policy's private input comes from the current authenticated source, never
    action JSON. Its owner-go and exact ordered steps are bound by that source to
    the original message, authority revision, actor, peer and finite deadline.
    Duplicate or recovered attempts return evidence and never replay a step.
    """

    def __init__(
        self,
        lease: FeatureLease,
        targets: tuple,
        journal: ValidationExecutionJournal,
        *,
        media_inputs: tuple = (),
    ):
        if (
            type(lease) is not FeatureLease
            or type(journal) is not ValidationExecutionJournal
            or type(targets) is not tuple
            or not 1 <= len(targets) <= 64
            or any(type(t) is not NativeDoorTarget for t in targets)
            or lease.message.request.get("feature") != "live_validation"
        ):
            raise Refusal("Unauthorized")
        lease.require("validation/run")
        params, request = lease.message.request.parameters, lease.message.request
        source = thaw(lease.private_input)
        if (
            type(source) is not dict
            or set(source) != {"kind", "owner_go", "checklist_ref", "steps"}
            or source["kind"] != VALIDATION_KIND
            or source["checklist_ref"] != params["checklist_ref"]
        ):
            raise Refusal("binding_denied")
        owner_go = source["owner_go"]
        if (
            type(owner_go) is not dict
            or set(owner_go)
            != {"reference", "owner_user_id", "authority_revision", "approved", "expiry"}
            or owner_go["reference"] != params["owner_go_ref"]
            or owner_go["approved"] is not True
            or type(owner_go["authority_revision"]) is not int
            or owner_go["authority_revision"] != request.get("authority_revision")
            or owner_go["expiry"] != params["expiry"]
        ):
            raise Refusal("Unauthorized")
        reference(owner_go["owner_user_id"])
        if type(source["steps"]) is not list or not 1 <= len(source["steps"]) <= 64:
            raise Refusal("invalid_fields")
        by_key = {
            (t.grant.station_id, t.grant.physical_relay, t.grant.mapping_revision): t
            for t in targets
        }
        if len(by_key) != len(targets) or set(t.grant for t in targets) != set(
            lease.policy.stations
        ):
            raise Refusal("binding_denied")
        steps, seen, used = [], set(), set()
        media = {}
        for step in source["steps"]:
            is_media = type(step) is dict and step.get("action") in {"video", "two_way_audio"}
            if (
                type(step) is not dict
                or set(step)
                != (
                    {"step_id", "action", "station_id", "physical_relay", "mapping_revision"}
                    | ({"consent", "duration_seconds"} if is_media else set())
                )
                or step["action"] not in PERMISSIONS
            ):
                raise Refusal("invalid_fields")
            reference(step["step_id"])
            if (
                step["step_id"] in seen
                or type(step["physical_relay"]) is not int
                or type(step["mapping_revision"]) is not int
            ):
                raise Refusal("binding_denied")
            key = step["station_id"], step["physical_relay"], step["mapping_revision"]
            if key not in by_key:
                raise Refusal("binding_denied")
            lease.require(PERMISSIONS[step["action"]])
            if is_media:
                consent = step["consent"]
                wanted = (
                    {"video_receive"}
                    if step["action"] == "video"
                    else {"audio_receive", "microphone_send"}
                )
                if (
                    type(consent) is not dict
                    or set(consent)
                    != {"consent_ref", "video_receive", "audio_receive", "microphone_send"}
                    or any(
                        type(consent[k]) is not bool or consent[k] is not (k in wanted)
                        for k in {"video_receive", "audio_receive", "microphone_send"}
                    )
                    or type(step["duration_seconds"]) is not int
                    or not 1 <= step["duration_seconds"] <= 180
                ):
                    raise Refusal("Unauthorized")
                reference(consent["consent_ref"])
                for track in wanted:
                    lease.require("media/" + track)
                media[step["step_id"]] = freeze(
                    {"consent": consent, "duration_seconds": step["duration_seconds"]}
                )
            seen.add(step["step_id"])
            used.add(key)
            steps.append((step["step_id"], step["action"], by_key[key]))
        if used != set(by_key):
            raise Refusal("binding_denied")
        if (
            type(media_inputs) is not tuple
            or any(type(v) is not ValidationMediaInput for v in media_inputs)
            or {v.step_id for v in media_inputs} != set(media)
            or len(media_inputs) != len(media)
        ):
            raise Refusal("binding_denied")
        input_snapshots = []
        for value in media_inputs:
            reference(value.step_id)
            action = next(action for sid, action, _ in steps if sid == value.step_id)
            if value.connection is not lease.message._connection:
                raise Refusal("binding_denied")
            if action == "video":
                if value.view is None or value.request is None or value.subscription is not None:
                    raise Refusal("binding_denied")
            elif (
                value.view is not None
                or value.request is not None
                or type(value.subscription) is not int
                or value.subscription <= 0
            ):
                raise Refusal("binding_denied")
            input_snapshots.append(
                (
                    value,
                    value.step_id,
                    value.connection,
                    value.request,
                    value.view,
                    value.subscription,
                )
            )
        self.lease, self.targets, self.journal = lease, targets, journal
        self._owned = lease, targets, journal
        self._steps = tuple(steps)
        self._initial = freeze(
            {
                "kind": VALIDATION_KIND,
                "owner_go": owner_go,
                "checklist_ref": source["checklist_ref"],
                "steps": [
                    {
                        "step_id": sid,
                        "action": action,
                        "target": target.description(),
                        "phase": "prepared",
                        "observation": None,
                        **({"media": thaw(media[sid])} if sid in media else {}),
                    }
                    for sid, action, target in steps
                ],
            }
        )
        self._ports = read_door, _inspect_pulse
        self._stop, self._lock = asyncio.Event(), asyncio.Lock()
        self._roots = self._steps, self._initial, self._ports, self._stop, self._lock
        self._record, self._task = None, None
        _OWNERS[self] = _Ownership(
            self._owned,
            self._roots,
            [None],
            [media_inputs, tuple(input_snapshots), None, None, None],
        )
        self._current()

    def _ownership(self):
        owner = _OWNERS.get(self)
        if type(owner) is not _Ownership:
            raise Refusal("binding_denied")
        execution = owner.execution[0]
        if (
            self._owned is not owner.dependencies
            or self._roots is not owner.roots
            or any(
                a is not b
                for a, b in zip(
                    (self.lease, self.targets, self.journal), owner.dependencies, strict=True
                )
            )
            or any(
                a is not b
                for a, b in zip(
                    (self._steps, self._initial, self._ports, self._stop, self._lock),
                    owner.roots,
                    strict=True,
                )
            )
            or (execution is None and (self._record is not None or self._task is not None))
            or (
                execution is not None
                and (
                    self._record is not execution.record
                    or self._task is not execution.task
                    or execution.task.get_coro() is not execution.coroutine
                )
            )
        ):
            raise Refusal("binding_denied")
        return owner

    def _current(self):
        owner = self._ownership()
        if owner.roots[3].is_set():
            raise Refusal("binding_denied")
        self.lease.require("validation/run")
        if (
            any(action in {"video", "two_way_audio"} for _, action, _ in owner.roots[0])
            and features.PLAN_FLAGS.get("live_media") is not True
        ):
            # New media effects require both feature gates. Once observed OFF,
            # this job remains stopped; original resource cleanup is separate.
            owner.roots[3].set()
            raise Refusal("feature_disabled")
        for _, action, target in self._steps:
            target.check()
            self.lease.require(PERMISSIONS[action])

    async def _step(self, action, target):
        def current():
            self._current()
            target.check()
            self.lease.require(PERMISSIONS[action])

        current()
        if action in {"video", "two_way_audio"}:
            await self._media_step(action, target)
            current()
            return
        if action == "pulse":
            # The native pulse fences itself at every actual HTTP attempt,
            # including the original runtime's queue and Digest retries.
            with native_effect_scope(target._client, current, target._rules("open")):
                await target.pulse(self.lease)
            current()
            return
        client, relay = target._client, target.grant.api_relay
        paths = {
            "identity": ("/ISAPI/System/deviceInfo",),
            "door_capabilities": ("/ISAPI/AccessControl/RemoteControl/door/capabilities",),
            "door_read": (
                f"/ISAPI/AccessControl/Door/param/{relay}/capabilities",
                f"/ISAPI/AccessControl/Door/param/{relay}",
            ),
        }[action]
        rules = tuple(RequestRule("GET", httpx.URL(client.settings.base_url + p)) for p in paths)
        with native_effect_scope(client, current, rules):
            if action == "identity":
                await client.async_confirm_identity()
            elif action == "door_capabilities":
                await self._ports[1](client, relay)
            else:
                # The result contains names/configuration; retain no raw value.
                await self._ports[0](client, relay)
        current()

    def _save_phase(self, index, phase, *, completion=False):
        owner = _OWNERS[self]
        journal, record = owner.dependencies[2], owner.execution[0].record
        if not completion:
            self._current()
        old = journal.read(record)
        body = deepcopy(old["body"])
        step = body["steps"][index]
        step["phase"] = phase
        step["observation"] = OBSERVATIONS[step["action"]] if phase == "acknowledged" else None
        journal.save(record, old["revision"], body, completion=completion)

    def _abort_unstarted(self):
        owner = _OWNERS[self]
        journal, record = owner.dependencies[2], owner.execution[0].record
        old = journal.read(record)
        body = deepcopy(old["body"])
        for step in body["steps"]:
            if step["phase"] == "prepared":
                step["phase"] = "aborted"
        if body != old["body"]:
            journal.save(record, old["revision"], body, completion=True)

    def check_media_step(self, step: ValidationMediaStep, *, cleanup=False):
        """Current native media checks; cleanup retains only original ownership."""
        owner = _OWNERS.get(self)
        issued = _MEDIA.get(step) if type(step) is ValidationMediaStep else None
        if (
            type(owner) is not _Ownership
            or issued is None
            or issued[0] is not self
            or owner.media[3] is not step
        ):
            raise Refusal("binding_denied")
        # Owned cleanup uses the pinned target even if a token label changed.
        if cleanup:
            issued[1][2].check_owned()
            return
        issued[1][2].check()
        self._current()
        values = (
            step.owner,
            step.lease,
            step.target,
            step.direction,
            step.consent,
            step.connection,
            step.request,
            step.view,
            step.subscription,
            step.duration_seconds,
            step.deadline,
            step.step_id,
        )
        expected = issued[1]
        if (
            any(values[i] is not expected[i] for i in (0, 1, 2, 4, 5, 6, 7))
            or any(
                type(values[i]) is not type(expected[i]) or values[i] != expected[i]
                for i in (3, 8, 9, 10, 11)
            )
            or step.lease is not owner.dependencies[0]
            or owner.execution[0].task.done()
            or owner.execution[0].task.cancelling()
            or step.lease.message._boundary.clock().now >= step.deadline
        ):
            raise Refusal("binding_denied")
        record = owner.dependencies[2].read(owner.execution[0].record)
        native = record["body"]["steps"][owner.media[2]]
        if (
            native["step_id"] != step.step_id
            or native["phase"] != "attempted"
            or native["target"] != step.target.description()
            or native["media"]
            != {"consent": thaw(step.consent), "duration_seconds": step.duration_seconds}
        ):
            raise Refusal("binding_denied")

    async def _media_step(self, action, target):
        from .arx_media_execution import MediaExecutionCoordinator

        owner = self._ownership()
        worker = owner.execution[0]
        if (
            asyncio.current_task() is not worker.task
            or worker.task.get_coro() is not worker.coroutine
        ):
            raise Refusal("binding_denied")
        index = owner.media[2]
        sid = owner.roots[0][index][0]
        value = next(v for v in owner.media[0] if v.step_id == sid)
        expected_input = next(snapshot for snapshot in owner.media[1] if snapshot[0] is value)
        if (
            value.step_id != expected_input[1]
            or value.connection is not expected_input[2]
            or value.request is not expected_input[3]
            or value.view is not expected_input[4]
            or type(value.subscription) is not type(expected_input[5])
            or value.subscription != expected_input[5]
        ):
            raise Refusal("binding_denied")
        metadata = owner.roots[1]["steps"][index]["media"]
        now = self.lease.message._boundary.clock().now
        deadline = now + timedelta(seconds=metadata["duration_seconds"])
        if deadline > absolute_time(self.lease.message.request.parameters["expiry"]):
            raise Refusal("binding_denied")
        step = ValidationMediaStep(
            self,
            self.lease,
            target,
            "video_only" if action == "video" else "two_way_audio",
            metadata["consent"],
            value.connection,
            value.request,
            value.view,
            value.subscription,
            metadata["duration_seconds"],
            deadline,
            sid,
        )
        owner.media[3] = step
        _MEDIA[step] = (
            self,
            (
                step.owner,
                step.lease,
                step.target,
                step.direction,
                step.consent,
                step.connection,
                step.request,
                step.view,
                step.subscription,
                step.duration_seconds,
                step.deadline,
                step.step_id,
            ),
        )
        self.check_media_step(step)
        controller = MediaExecutionCoordinator.for_validation(step, owner.dependencies[2])
        owner.media[4] = controller
        operation = asyncio.create_task(
            controller.video(step.view, step.request)
            if action == "video"
            else controller.audio(step.connection, step.subscription)
        )
        try:
            done, _ = await asyncio.wait((operation,), timeout=step.duration_seconds)
            if done:
                operation.result()
        finally:
            try:
                _, cancelled_close = await join_owned(controller.close())
                _, cancelled_join = await join_owned(
                    asyncio.gather(operation, return_exceptions=True)
                )
                if cancelled_close or cancelled_join:
                    raise asyncio.CancelledError
            finally:
                owner.media[4] = None
        try:
            result = controller.receipt()
            if result.get("phase") != "closed" or result.get("started") is not True:
                raise Refusal("status_unknown")
        finally:
            owner.media[3] = None

    async def run(self) -> dict[str, Any]:
        self._current()
        owner = self._ownership()
        async with owner.roots[4]:
            self._current()
            if owner.execution[0] is not None:
                return self.receipt()
            task = asyncio.current_task()
            record, fresh = self.journal.begin(self.lease, thaw(self._initial))
            owner.execution[0] = _Execution(task, task.get_coro(), record, [False])
            self._task, self._record = task, record
            if not fresh:
                return self.receipt()
            try:
                for index, (_, action, target) in enumerate(self._steps):
                    self._current()
                    owner.media[2] = index
                    self._save_phase(index, "attempted")
                    phase = "unknown"
                    try:
                        await self._step(action, target)
                        phase = "acknowledged"
                    finally:
                        self._save_phase(index, phase, completion=True)
            finally:
                try:
                    self._abort_unstarted()
                finally:
                    owner.media[2:5] = [None, None, None]
            return self.receipt()

    async def abort(self) -> None:
        """Stop admission and join the exact owned native operation's cleanup."""
        # Constructor-owned roots survive replacement of public labels. Never
        # cancel a Task merely because it was grafted onto this coordinator.
        owner = _OWNERS.get(self)
        if type(owner) is not _Ownership:
            raise Refusal("binding_denied")
        owner.roots[3].set()
        execution = owner.execution[0]
        task = execution.task if execution is not None else None
        if task is None or task is asyncio.current_task() or task.done():
            return
        if task.get_coro() is not execution.coroutine:
            raise Refusal("binding_denied")
        if not execution.cancel_requested[0]:
            execution.cancel_requested[0] = True
            if not task.cancelling():
                task.cancel()
        cancelled = False
        while not task.done():
            try:
                await asyncio.shield(task)
            except asyncio.CancelledError:
                if asyncio.current_task().cancelling():
                    cancelled = True
        # The original worker's outcome remains in its durable receipt. Abort
        # does not convert that outcome into permission to send another command.
        if cancelled:
            raise asyncio.CancelledError

    def receipt(self) -> dict[str, Any]:
        owner = self._ownership()
        self.lease.check()
        if owner.execution[0] is None:
            raise Refusal("binding_denied")
        record = owner.dependencies[2].read(owner.execution[0].record)
        return {
            "original": record["original"],
            "owner_go": record["body"]["owner_go"],
            "checklist_ref": record["body"]["checklist_ref"],
            "steps": record["body"]["steps"],
            "physical_result": "unknown",
            "human_witness": "unknown",
            "replay_available": False,
        }
