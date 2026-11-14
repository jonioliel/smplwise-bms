"""Ephemeral, administrator-owned card collection with explicit revision-bound approval."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from contextvars import ContextVar, copy_context
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from ..client.capture import CapturedCard, CardCaptureClient
from ..exceptions import HikvisionTimeoutError, HikvisionUnsupportedError
from .models import AccessError, text_field
from .commit_tasks import finish_owned_commit

if TYPE_CHECKING:
    from .manager import AccessManager

SESSION_SECONDS = 120
MAX_SESSIONS = 3
_capture_collectors = ContextVar("wiskey_capture_collectors", default=())


@dataclass(slots=True, repr=False)
class CaptureSession:
    id: str
    actor: str
    station_id: str
    user_id: str
    revision: int
    reader_id: int
    state: str = "preparing"
    card: CapturedCard | None = None
    error: str | None = None
    task: asyncio.Task[None] | None = None
    timer: asyncio.TimerHandle | None = None
    permission_timer: asyncio.TimerHandle | None = None
    authorize: Callable[[], bool] | None = None

    def public(self) -> dict[str, Any]:
        return {
            "session_id": self.id,
            "station_id": self.station_id,
            "user_id": self.user_id,
            "revision": self.revision,
            "state": self.state,
            "error": self.error,
            "card": self.card.public() if self.card else None,
        }


@dataclass(frozen=True, repr=False)
class _EnrollmentOwner:
    manager: Any
    repository: Any
    sessions: dict
    births: dict
    factory: Any


@dataclass(frozen=True, repr=False)
class _CaptureOwner:
    root: Any
    loop: Any
    session: Any
    identity: tuple
    task: list
    expiry: list
    permission: list
    pending: list
    created: Any
    life: list
    phase: list
    card: list
    joined: list
    deferred: list
    failures: list
    watched: list


class CardEnrollment:
    def __init__(self, manager: AccessManager) -> None:
        self.manager = manager
        self.sessions: dict[str, CaptureSession] = {}
        self._creation = _EnrollmentOwner(
            manager, manager.repository, self.sessions, {}, []
        )

    def _roots_current(self) -> bool:
        root = self._creation
        return (
            self.manager is root.manager and self.sessions is root.sessions
            and root.manager.repository is root.repository
            and (not root.factory or root.manager._task_factory is root.factory[0])
        )

    def _owned(self, session: CaptureSession) -> _CaptureOwner | None:
        owner = self._creation.births.get(id(session))
        return owner if type(owner) is _CaptureOwner and owner.session is session and owner.root is self._creation else None

    @staticmethod
    def _inside(owner: _CaptureOwner) -> bool:
        return owner.task[0] is not None and asyncio.current_task() is owner.task[0] or any(
            original is owner and active[0] for original, active in _capture_collectors.get()
        )

    def _current(self, owner: _CaptureOwner) -> bool:
        if not self._roots_current() or owner.root is not self._creation or owner.life[0]:
            return False
        row, values = owner.session, owner.identity
        if owner.root.births.get(id(row)) is not owner or owner.root.sessions.get(values[0]) is not row:
            return False
        actual = (row.id, row.actor, row.station_id, row.user_id, row.revision, row.reader_id)
        return bool(
            all(type(value) is type(expected) and (value is expected or value == expected)
                for value, expected in zip(actual, values[:6]))
            and row.authorize is values[6]
            and type(row.state) is str and row.state == owner.phase[0] and row.card is owner.card[0]
            and row.timer is owner.expiry[0] and row.permission_timer is owner.permission[0]
            and (row.task is owner.task[0] or row.task is None and (
                owner.pending[0] is not None or owner.task[0] is not None and asyncio.Task.done(owner.task[0])
            ))
        )

    def _guard(self, owner: _CaptureOwner) -> None:
        if not self._current(owner):
            self._drop_owned(owner)
            raise AccessError("capture_not_found")
        allowed = self._authorized(owner.identity[6])
        if not self._current(owner):
            self._drop_owned(owner)
            raise AccessError("capture_not_found")
        if not allowed:
            self._drop_owned(owner)
            raise AccessError("unauthorized")

    def _forget(self, owner: _CaptureOwner) -> None:
        task = owner.task[0]
        if owner.life[0] and not owner.failures and owner.created.is_set() and (task is None or asyncio.Task.done(task)):
            if owner.root.births.get(id(owner.session)) is owner:
                owner.root.births.pop(id(owner.session), None)

    def _watch_task(self, owner: _CaptureOwner) -> None:
        if not owner.watched[0]:
            owner.watched[0] = True
            asyncio.Task.add_done_callback(
                owner.task[0], lambda _task: CardEnrollment._forget(self, owner)
            )

    def _drop_owned(self, owner: _CaptureOwner) -> asyncio.Task[None] | None:
        task = owner.task[0]
        if owner.life[0]:
            return task
        owner.life[0] = True
        owner.deferred[0] = CardEnrollment._inside(owner)
        row = owner.session
        if owner.root.sessions.get(owner.identity[0]) is row:
            owner.root.sessions.pop(owner.identity[0], None)
        owner.card[0] = row.card = None
        for label, resource in (("expiry", owner.expiry), ("permission", owner.permission)):
            cancel = resource[1]
            resource[:] = [None, None]
            if cancel is not None:
                try:
                    cancel()
                except Exception:
                    owner.failures.append(label)
        if task is not None and not owner.deferred[0] and task is not asyncio.current_task():
            asyncio.Task.cancel(task)
        self._forget(owner)
        return task

    def _retire_birth(self, session: CaptureSession) -> asyncio.Task[None] | None:
        """Private original-resource cleanup port; no actor or write authority."""
        owner = self._owned(session)
        if owner is None:
            return None
        task = self._drop_owned(owner)
        if owner.failures:
            raise AccessError("capture_failed")
        return task

    async def _join_birth(self, owner: _CaptureOwner) -> None:
        if CardEnrollment._inside(owner):
            return
        if owner.joined[0] is None:
            async def finish() -> None:
                await owner.created.wait()
                task = owner.task[0]
                if task is not None:
                    await asyncio.gather(task, return_exceptions=True)
                self._forget(owner)
            scope = copy_context()
            scope.run(_capture_collectors.set, tuple(
                item for item in _capture_collectors.get() if item[0] is not owner
            ))
            owner.joined[0] = asyncio.create_task(finish(), context=scope)
        await finish_owned_commit(owner.joined[0])
        if owner.failures:
            raise AccessError("capture_failed")

    def _phase(self, owner: _CaptureOwner, state: str) -> None:
        self._guard(owner)
        owner.phase[0] = owner.session.state = state

    def _arm_permission(self, owner: _CaptureOwner) -> None:
        self._guard(owner)
        previous = owner.permission[1]
        holder = [None]
        holder[0] = asyncio.get_running_loop().call_later(
            0.5, lambda: CardEnrollment._permission_tick(self, owner, holder[0])
        )
        owner.permission[:] = [holder[0], holder[0].cancel]
        owner.session.permission_timer = holder[0]
        if previous is not None:
            try:
                previous()
            except Exception:
                owner.failures.append("permission")

    def _permission_tick(self, owner: _CaptureOwner, timer: Any) -> None:
        if timer is None or owner.life[0] or owner.permission[0] is not timer or owner.phase[0] == "applying":
            return
        try:
            self._arm_permission(owner)
        except AccessError:
            return

    def _expiry_tick(self, owner: _CaptureOwner, timer: Any) -> None:
        if timer is not None and not owner.life[0] and owner.expiry[0] is timer and owner.phase[0] != "applying":
            self._drop_owned(owner)

    def _client(self, station_id: str) -> CardCaptureClient:
        if not self._roots_current():
            raise AccessError("capture_not_found")
        if self.manager._closed:
            raise AccessError("manager_closed")
        station = self.manager._station(station_id)
        return CardCaptureClient(self.manager._driver(station).client)

    def _get(self, session_id: str, actor: str) -> CaptureSession:
        if not self._roots_current():
            raise AccessError("capture_not_found")
        session = self._creation.sessions.get(session_id)
        if session is None or session.actor != actor:
            raise AccessError("capture_not_found")
        owner = self._owned(session)
        if owner is None:
            raise AccessError("capture_not_found")
        self._guard(owner)
        return session

    @staticmethod
    def _authorized(authorize: Callable[[], bool] | None) -> bool:
        try:
            return authorize is None or authorize() is True
        except Exception:
            # Losing the policy source must not preserve a captured credential.
            return False

    def _check_permission(self, session_id: str) -> None:
        session = self._creation.sessions.get(session_id)
        owner = self._owned(session) if session is not None else None
        if owner is not None and not owner.life[0] and owner.phase[0] != "applying":
            try:
                self._arm_permission(owner)
            except AccessError:
                return

    async def capabilities(self, station_id: str) -> dict[str, Any]:
        try:
            async with asyncio.timeout(35):
                return (await self._client(station_id).async_capabilities()).public()
        except HikvisionUnsupportedError:
            raise AccessError("capture_unsupported") from None

    def start(
        self,
        station_id: str,
        user_id: str,
        revision: int,
        reader_id: int,
        actor: str,
        *,
        authorize: Callable[[], bool] | None = None,
    ) -> dict[str, Any]:
        if not self._roots_current():
            raise AccessError("capture_not_found")
        root = self._creation
        # Pre-first-use manager assembly is allowed. The publication port is
        # sealed before any authorizer/client/repository callback can replace it.
        if not root.factory:
            root.factory.append(root.manager._task_factory)
        if not self._authorized(authorize):
            raise AccessError("unauthorized")
        if not self._roots_current():
            raise AccessError("capture_not_found")
        if any(
            type(root.births.get(id(row))) is not _CaptureOwner
            or root.births[id(row)].session is not row
            or root.births[id(row)].identity[0] != identity
            for identity, row in root.sessions.items()
        ):
            raise AccessError("capture_station_busy")
        self._client(station_id)
        user = root.repository.get(user_id)
        if type(revision) is not int or revision != user.revision:
            raise AccessError("revision_conflict")
        if not actor or type(reader_id) is not int or not 0 <= reader_id <= 8:
            raise AccessError("invalid_fields")
        if any(owner.identity[2] == station_id for owner in root.births.values()):
            raise AccessError("capture_station_busy")
        if len(root.births) >= MAX_SESSIONS:
            raise AccessError("capture_limit")
        if not self._roots_current():
            raise AccessError("capture_not_found")
        session = CaptureSession(uuid4().hex, actor, station_id, user_id, revision, reader_id)
        session.authorize = authorize
        owner = _CaptureOwner(
            root, asyncio.get_running_loop(), session, (session.id, actor, station_id, user_id, revision, reader_id, authorize),
            [None], [None, None], [None, None], [None], asyncio.Event(),
            [False, False], ["preparing"], [None], [None], [False], [], [False],
        )
        root.births[id(session)] = owner
        root.sessions[session.id] = session
        coroutine = None
        try:
            expiry = [None]
            expiry[0] = asyncio.get_running_loop().call_later(
                SESSION_SECONDS, lambda: CardEnrollment._expiry_tick(self, owner, expiry[0])
            )
            owner.expiry[:] = [expiry[0], expiry[0].cancel]
            session.timer = expiry[0]
            coroutine = CardEnrollment._collect(self, session)
            owner.pending[0] = coroutine
            task = root.factory[0](coroutine, "Hikvision card collection")
            if (
                not isinstance(task, asyncio.Task)
                or asyncio.Task.get_loop(task) is not owner.loop
                or owner.task[0] is not None and owner.task[0] is not task
                or not (asyncio.Task.get_coro(task) is coroutine
                    or owner.task[0] is task and owner.life[1] and asyncio.Task.done(task))
            ):
                raise AccessError("capture_failed")
            owner.task[0] = task
            if session.task is None:
                session.task = task
            CardEnrollment._watch_task(self, owner)
            owner.pending[0] = None
            if owner.life[0]:
                if not owner.deferred[0] and not asyncio.Task.done(task):
                    asyncio.Task.cancel(task)
                raise AccessError("capture_not_found")
            self._guard(owner)
            if authorize is not None:
                self._arm_permission(owner)
        except BaseException as error:
            if coroutine is not None and owner.task[0] is None:
                coroutine.close()
            owner.pending[0] = None
            self._drop_owned(owner)
            if isinstance(error, AccessError) or not isinstance(error, Exception):
                raise
            raise AccessError("capture_failed") from None
        finally:
            owner.created.set()
            self._forget(owner)
        return session.public()

    async def _collect(self, session: CaptureSession) -> None:
        owner = self._owned(session)
        task = asyncio.current_task()
        if owner is None or owner.life[0] or owner.life[1] or not isinstance(task, asyncio.Task):
            return
        if asyncio.Task.get_loop(task) is not owner.loop or asyncio.get_running_loop() is not owner.loop:
            return
        if owner.task[0] is not None and owner.task[0] is not task:
            return
        if owner.pending[0] is not None and asyncio.Task.get_coro(task) is not owner.pending[0]:
            return
        owner.life[1] = True
        owner.task[0] = task
        # An eager factory can throw after native entry instead of returning.
        # Its independently observed actual Task still needs a done receipt.
        CardEnrollment._watch_task(self, owner)
        active = [True]
        marker = _capture_collectors.set((*_capture_collectors.get(), (owner, active)))
        try:
            self._guard(owner)
            async with asyncio.timeout(70):
                client = self._client(owner.identity[2])
                capabilities, capture = client.async_capabilities, client.async_capture
                self._guard(owner)
                caps = await capabilities()
                self._guard(owner)
                if owner.identity[5] not in caps.readers:
                    raise AccessError("capture_reader_invalid")
                self._guard(owner)
                card = await capture(
                    caps, owner.identity[5], on_waiting=lambda: CardEnrollment._phase(self, owner, "waiting")
                )
                self._guard(owner)
                owner.card[0] = session.card = card
                owner.phase[0] = session.state = "captured"
        except asyncio.CancelledError:
            raise
        except Exception as err:
            if owner.life[0]:
                return
            # Never retain raw exceptions/device messages or expose credential content.
            owner.phase[0] = session.state = "error"
            owner.card[0] = session.card = None
            session.error = (
                "capture_timeout"
                if isinstance(err, (TimeoutError, HikvisionTimeoutError))
                else "capture_unsupported"
                if isinstance(err, HikvisionUnsupportedError)
                else err.code
                if isinstance(err, AccessError)
                else "capture_failed"
            )
        finally:
            active[0] = False
            _capture_collectors.reset(marker)
            if session.task is task:
                session.task = None

    def status(self, session_id: str, actor: str) -> dict[str, Any]:
        return self._get(session_id, actor).public()

    def _expire(self, session_id: str) -> None:
        session = self._creation.sessions.get(session_id)
        owner = self._owned(session) if session is not None else None
        if owner is not None and owner.phase[0] != "applying":
            self._drop_owned(owner)

    def _drop(self, session: CaptureSession) -> asyncio.Task[None] | None:
        owner = self._owned(session)
        return self._drop_owned(owner) if owner is not None else None

    async def cancel(self, session_id: str, actor: str) -> None:
        session = self._creation.sessions.get(session_id)
        if session is None:
            return
        session = self._get(session_id, actor)
        owner = self._owned(session)
        if owner.phase[0] == "applying":
            raise AccessError("capture_applying")
        self._drop_owned(owner)
        await self._join_birth(owner)

    async def close_station(self, station_id: str) -> None:
        owners = [owner for owner in tuple(self._creation.births.values())
            if owner.identity[2] == station_id and owner.phase[0] != "applying"]
        for owner in owners:
            self._drop_owned(owner)
        async def finish() -> None:
            first = None
            for owner in owners:
                try:
                    await self._join_birth(owner)
                except (Exception, asyncio.CancelledError) as error:
                    if first is None:
                        first = error
            if first is not None:
                raise first
        await finish_owned_commit(asyncio.create_task(finish()))

    async def confirm(self, session_id: str, actor: str, label: str) -> dict[str, Any]:
        session = self._get(session_id, actor)
        owner = self._owned(session)
        if owner.phase[0] != "captured" or owner.card[0] is None:
            raise AccessError("capture_not_ready")
        label = text_field(label, 64, empty=True)
        self._guard(owner)
        try:
            user = owner.root.repository.get(owner.identity[3])
        except AccessError:
            self._drop(session)
            raise
        self._guard(owner)
        if user.revision != owner.identity[4]:
            self._drop(session)
            raise AccessError("revision_conflict")
        number = owner.card[0].number
        if any(card.card_no.value == number for card in user.cards):
            self._drop(session)
            raise AccessError("card_conflict")
        # The captured technology is not the access-control cardType enum.
        cards = [
            {"id": card.id, "label": card.label, "enabled": card.enabled} for card in user.cards
        ]
        cards.append(
            {"card_no": number, "label": label, "card_type": "normalCard", "enabled": True}
        )
        self._phase(owner, "applying")
        try:
            return await owner.root.manager.async_update(
                user.id, {"cards": cards}, revision=owner.identity[4]
            )
        finally:
            self._drop(session)
