"""Opt-in actual native media lifetimes; no public registration or activation.

Only the joint authenticated/current source can grant track consent. Instance
labels never anchor authority or owned cleanup. RTC requires provider teardown.
"""

from __future__ import annotations

import asyncio
import weakref
from dataclasses import dataclass
from typing import Any

from ..trusted_actions.source_bindings import same_ports
from ..trusted_actions.validation import Refusal
from .arx_door_execution import NativeDoorTarget
from .arx_execution_authority import FeatureLease
from .arx_execution_journal import FeatureExecutionJournal

_ISSUER = object()
_TRACKS = frozenset({"video_receive", "audio_receive", "microphone_send"})
_PERMITS = weakref.WeakKeyDictionary()
_MEDIA = weakref.WeakKeyDictionary()


@dataclass(frozen=True)
class _Permit:
    owner: object  # weak original coordinator, avoids a global ownership cycle
    connection: object
    user: object
    resources: list  # bridge weakref, original request/view, started, stopped, video closed


@dataclass(frozen=True)
class _Media:
    dependencies: tuple
    direction: str
    lock: object
    validation_port: object
    state: list  # original task/coroutine, record, permit weakref, closing/cancelled, phase


class NativeMediaPermit:
    """Identity-issued permit; copying/grafting labels cannot recreate its roots."""

    def __init__(self, issuer, coordinator, connection):
        if issuer is not _ISSUER or coordinator not in _MEDIA:
            raise Refusal("Unauthorized")
        self._coordinator, self._connection = coordinator, connection
        self._bridge, self._request = None, None
        self._started = self._stopped = False
        _PERMITS[self] = _Permit(
            weakref.ref(coordinator), connection, connection.user, [None, None, False, False, False]
        )

    def _original(self, *, cleanup=False):
        item = _PERMITS.get(self) if type(self) is NativeMediaPermit else None
        owner = item.owner() if item is not None else None
        if owner is None:
            raise Refusal("binding_denied")
        if not cleanup and (
            self._coordinator is not owner
            or self._connection is not item.connection
            or item.connection.user is not item.user
            or self._bridge is not (item.resources[0]() if item.resources[0] else None)
            or self._request is not item.resources[1]
            or self._started is not item.resources[2]
            or self._stopped is not item.resources[3]
        ):
            raise Refusal("binding_denied")
        return owner, item

    def check(self, track="session"):
        owner, item = self._original()
        if item.resources[3]:
            raise Refusal("binding_denied")
        owner.check()
        wanted = (
            ("audio_receive", "microphone_send")
            if owner.direction == "two_way_audio"
            else ("video_receive",)
        )
        if track != "session":
            if track not in wanted:
                raise Refusal("Unauthorized")
            wanted = (track,)
        roots = _MEDIA[owner]
        for name in wanted:
            roots.dependencies[0].require("media/" + name)
        roots.dependencies[1].check()
        self._original()

    def check_owned(self):
        owner, _item = self._original(cleanup=True)
        owner._owned_check()

    def bridge_authorized(self, *, user=None, station_id=None):
        """Original source grant only; no panel role/User flag is fabricated."""
        from ..arx_native_feature_source import NativeBridgeFeatureSource

        if not NativeMediaPermit.bridge_origin(self, user=user, station_id=station_id):
            return False
        NativeMediaPermit.check(self)
        owner, item = NativeMediaPermit._original(self)
        lease, target, *_ = _MEDIA[owner].dependencies
        source = getattr(lease.message._boundary.verify_transport, "__self__", None)
        return bool(
            type(source) is NativeBridgeFeatureSource
            and (user is None or user is item.user)
            and (station_id is None or station_id == target.grant.station_id)
            and NativeBridgeFeatureSource.is_current(
                source,
                item.connection,
                lease.message.verification,
            )
        )

    def bridge_origin(self, *, user=None, station_id=None):
        """Classify an already checked permit; this method grants no authority.

        AudioBridge.valid calls the complete check_bridge immediately before
        this classification, with no await or foreign callback between them.
        """
        from ..arx_native_feature_source import NativeBridgeFeatureSource

        owner, item = NativeMediaPermit._original(self)
        lease, target, *_ = _MEDIA[owner].dependencies
        source = getattr(lease.message._boundary.verify_transport, "__self__", None)
        return bool(
            type(source) is NativeBridgeFeatureSource
            and not item.resources[3]
            and (user is None or user is item.user)
            and (station_id is None or station_id == target.grant.station_id)
        )

    def stop(self):
        _owner, item = self._original(cleanup=True)
        item.resources[3] = self._stopped = True

    def bind_bridge(self, bridge):
        self.check()
        _owner, item = self._original()
        if item.resources[0] is not None or item.resources[1] is not None:
            raise Refusal("operation_conflict")
        item.resources[0], self._bridge = weakref.ref(bridge), bridge

    def check_bridge(self, bridge, track="session"):
        self.check(track)
        _owner, item = self._original()
        if (
            item.resources[0] is None
            or item.resources[0]() is not bridge
            or bridge.connection is not item.connection
        ):
            raise Refusal("binding_denied")

    def started_audio(self, bridge):
        from ..audio_api import _audio_owner
        from ..client.audio import AudioSession

        self.check_bridge(bridge)
        session = _audio_owner(bridge).resource[0]
        if AudioSession.feature_observation(session)["started"] is not True:
            raise Refusal("status_unknown")
        self._started_once()

    def started_video(self, request, view, runtime):
        self.check_video(request, view, runtime)
        self._started_once()

    def _started_once(self):
        owner, item = self._original()
        if not item.resources[2]:
            owner._save("streaming")
            item.resources[2] = self._started = True

    def bind_request(self, request, view):
        from ..arx_media_ingress import request_subject

        self.check("video_receive")
        owner, item = self._original()
        target = _MEDIA[owner].dependencies[1]
        if (
            owner.direction != "video_only"
            or item.resources[0] is not None
            or item.resources[1] is not None
            or request_subject(request) is not item.user
            or view is not target._hass.data.get("hikvision_intercom", {}).get("mse_view")
        ):
            raise Refusal("binding_denied")
        item.resources[1] = self._request = request, view

    def check_video(self, request, view, runtime):
        from ..arx_media_ingress import request_subject

        self.check("video_receive")
        owner, item = self._original()
        binding = item.resources[1]
        if (
            binding is None
            or binding[0] is not request
            or binding[1] is not view
            or request_subject(request) is not item.user
            or runtime is not _MEDIA[owner].dependencies[1].runtime
        ):
            raise Refusal("binding_denied")

    def finished_video(self, request, view, runtime):
        owner, item = self._original(cleanup=True)
        binding = item.resources[1]
        if (
            binding is None
            or binding[0] is not request
            or binding[1] is not view
            or runtime is not _MEDIA[owner].dependencies[1].runtime
        ):
            raise Refusal("binding_denied")
        # Only the actual native MSE request calls this after both original
        # upstream exit and downstream close completed, including cancellation.
        item.resources[4] = True


class MediaExecutionCoordinator:
    """One actual finite native lifetime, using the original durable operation."""

    def __init__(
        self, lease: FeatureLease, target: NativeDoorTarget, journal: FeatureExecutionJournal
    ) -> None:
        if (
            type(lease) is not FeatureLease
            or type(target) is not NativeDoorTarget
            or type(journal) is not FeatureExecutionJournal
        ):
            raise Refusal("Unauthorized")
        self._assemble(lease, target, journal, lease.message.request.parameters.get("direction"))
        self.check()

    def _assemble(self, lease, target, journal, direction, validation=None):
        self.lease, self.target, self.journal = lease, target, journal
        self._validation, self._direction = validation, direction
        self._task = self._record = self._permit = None
        self._closing = False
        self._state, self._owned = [], object()  # labels only, not authoritative roots
        self._lock = asyncio.Lock()
        roots = _Media(
            (lease, target, journal, validation, self._owned, self._state),
            direction,
            self._lock,
            validation.owner.check_media_step if validation is not None else None,
            [None, None, None, None, False, False, "prepared"],
        )
        _MEDIA[self] = roots

    @classmethod
    def for_validation(cls, step, journal):
        """Same original validation lease/attempt; never mint a nested media DTO."""
        from .arx_validation_execution import (
            ValidationCoordinator,
            ValidationExecutionJournal,
            ValidationMediaStep,
        )

        if (
            type(step) is not ValidationMediaStep
            or type(step.owner) is not ValidationCoordinator
            or type(journal) is not ValidationExecutionJournal
            or type(step.lease) is not FeatureLease
            or type(step.target) is not NativeDoorTarget
        ):
            raise Refusal("Unauthorized")
        step.owner.check_media_step(step)
        value = cls.__new__(cls)
        value._assemble(step.lease, step.target, journal, step.direction, step)
        value.check()
        return value

    @property
    def direction(self):
        item = _MEDIA.get(self)
        if type(item) is not _Media:
            raise Refusal("binding_denied")
        return item.direction

    def _roots(self):
        roots = _MEDIA.get(self)
        if type(roots) is not _Media:
            raise Refusal("binding_denied")
        return roots

    def _owned_check(self):
        roots = self._roots()
        target, step = roots.dependencies[1], roots.dependencies[3]
        if step is not None:
            if not same_ports((roots.validation_port,), (step.owner.check_media_step,)):
                raise Refusal("binding_denied")
            roots.validation_port(step, cleanup=True)
        target.check_owned()
        return roots

    def _stable(self, *, ownership_only=False):
        roots = self._roots() if ownership_only else self._owned_check()
        deps, state = roots.dependencies, roots.state
        if (
            any(
                a is not b
                for a, b in zip(
                    (
                        self.lease,
                        self.target,
                        self.journal,
                        self._validation,
                        self._owned,
                        self._state,
                    ),
                    deps,
                    strict=True,
                )
            )
            or self._state
            or self._direction != roots.direction
            or self._lock is not roots.lock
            or self._task is not state[0]
            or self._record is not state[2]
            or self._permit is not (state[3]() if state[3] else None)
            or self._closing is not state[4]
        ):
            raise Refusal("binding_denied")
        return roots

    def check(self):
        roots = self._stable()
        lease, target, _journal, step, *_ = roots.dependencies
        lease.check()
        target.check()
        if roots.state[4] or self.direction not in {"video_only", "two_way_audio"}:
            raise Refusal("Unauthorized")
        if step is None:
            params, private = lease.message.request.parameters, lease.private_input
            if (
                lease.message.request.get("feature") != "live_media"
                or params["station_id"] != target.grant.station_id
                or target.grant not in lease.policy.stations
                or not hasattr(private, "keys")
                or set(private) != {"kind", "consent_ref", *_TRACKS}
                or private["kind"] != "live_media"
                or private["consent_ref"] != params["consent_ref"]
                or params["direction"] != self.direction
            ):
                raise Refusal("Unauthorized")
        else:
            roots.validation_port(step)
            if (
                lease.message.request.get("feature") != "live_validation"
                or step.lease is not lease
                or step.target is not target
                or step.direction != self.direction
                or step.connection is not lease.message._connection
            ):
                raise Refusal("Unauthorized")
            private = step.consent
            if set(private) != {"consent_ref", *_TRACKS}:
                raise Refusal("Unauthorized")
        wanted = (
            {"video_receive"}
            if self.direction == "video_only"
            else {"audio_receive", "microphone_send"}
        )
        if any(
            type(private[name]) is not bool or private[name] is not (name in wanted)
            for name in _TRACKS
        ):
            raise Refusal("Unauthorized")
        for name in wanted:
            lease.require("media/" + name)
        target.check()
        self._stable()

    def _body(self, phase):
        return {"kind": "media", "direction": self.direction, "phase": phase}

    def _save(self, phase, *, completion=False):
        roots = self._roots() if completion else self._stable()
        lease, _target, journal, step, *_ = roots.dependencies
        if step is not None:
            before = roots.state[6]
            if completion:
                if before not in {"attempted", "streaming"} or phase not in {"closed", "unknown"}:
                    raise Refusal("binding_denied")
            else:
                self.check()
                if (before, phase) not in {("prepared", "attempted"), ("attempted", "streaming")}:
                    raise Refusal("binding_denied")
            roots.state[6] = phase
        else:
            record = roots.state[2]
            before = journal.read(record)
            journal.save(record, before["revision"], self._body(phase), completion=completion)

    def _begin(self):
        self.check()
        roots = _MEDIA[self]
        lease, _target, journal, step, *_ = roots.dependencies
        if roots.state[0] is not None or roots.state[2] is not None:
            raise Refusal("operation_conflict")
        if step is not None:
            record, fresh = object(), True
        else:
            record, fresh = journal.begin(lease, self._body("prepared"))
        roots.state[2] = self._record = record
        if not fresh:
            return None
        self._save("attempted")
        task = asyncio.current_task()
        roots.state[0:2] = [task, task.get_coro()]
        self._task = task
        permit = NativeMediaPermit(_ISSUER, self, lease.message._connection)
        roots.state[3], self._permit = weakref.ref(permit), permit
        return permit

    async def audio(self, connection: Any, subscription: int | None) -> dict[str, Any]:
        from ..audio_api import _audio_owner, start_feature_audio

        roots = self._stable()
        lease, target, _journal, step, *_ = roots.dependencies
        if (
            connection is not lease.message._connection
            or type(subscription) is not int
            or subscription <= 0
            or (
                step is not None
                and (connection is not step.connection or subscription != step.subscription)
            )
        ):
            raise Refusal("binding_denied")
        async with roots.lock:
            if self.direction != "two_way_audio":
                raise Refusal("Unauthorized")
            permit = self._begin()
            if permit is None:
                return self.receipt()
            bridge, phase = None, "unknown"
            try:
                bridge = start_feature_audio(
                    target._hass, connection, target.runtime, subscription, permit
                )
                await _audio_owner(bridge).task[0]
            finally:
                try:
                    if bridge is not None:
                        await bridge.async_close()
                        from ..client.audio import AudioSession

                        session = _audio_owner(bridge).resource[0]
                        phase = (
                            "closed"
                            if AudioSession.feature_observation(session)["close_confirmed"] is True
                            else "unknown"
                        )
                finally:
                    permit.stop()
                    self._save(phase, completion=True)
            return self.receipt()

    async def video(self, view: Any, request: Any) -> dict[str, Any]:
        from ..mse_api import MSEView

        roots = self._stable()
        _lease, target, _journal, step, *_ = roots.dependencies
        if (
            self.direction != "video_only"
            or type(view) is not MSEView
            or (step is not None and (request is not step.request or view is not step.view))
        ):
            raise Refusal("Unauthorized")
        async with roots.lock:
            permit = self._begin()
            if permit is None:
                return self.receipt()
            phase = "unknown"
            try:
                permit.bind_request(request, view)
                await view.serve_feature(request, target.grant.station_id, permit)
                phase = "closed"
            finally:
                if _PERMITS[permit].resources[4]:
                    phase = "closed"
                permit.stop()
                self._save(phase, completion=True)
            return self.receipt()

    async def rtc(self, *_args, **_kwargs):
        self.check()
        raise Refusal("rtc_revocable_provider_required")

    async def close(self) -> None:
        from ..media_lifetime import join_owned

        # Use original module-owned task/coroutine and permit even after every
        # exposed label/root was grafted. No foreign Task is ever cancelled.
        roots = self._roots()
        roots.state[4] = self._closing = True
        permit = roots.state[3]() if roots.state[3] else None
        if permit is not None:
            permit.stop()
        task, coroutine = roots.state[:2]
        if task is None or task is asyncio.current_task() or task.done():
            return
        if task.get_coro() is not coroutine:
            raise Refusal("binding_denied")
        if not roots.state[5]:
            roots.state[5] = True
            if not task.cancelling():
                task.cancel()
        _result, cancelled = await join_owned(asyncio.gather(task, return_exceptions=True))
        if cancelled:
            raise asyncio.CancelledError

    def receipt(self) -> dict[str, Any]:
        # Internal durable outcome read, not fresh effect authority. A runtime
        # rebind cannot prevent recording the original stream's completed close.
        roots = self._stable(ownership_only=True)
        permit = roots.state[3]() if roots.state[3] else None
        started = bool(permit is not None and _PERMITS[permit].resources[2])
        if roots.dependencies[3] is not None:
            return {**self._body(roots.state[6]), "started": started, "physical_result": "unknown"}
        value = roots.dependencies[2].read(roots.state[2])
        return {
            "original": value["original"],
            **value["body"],
            "started": started,
            "physical_result": "unknown",
        }
