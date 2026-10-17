"""CR-ARX-WISKEY-SHARED-IDENTITY: the access engine port - the few WisKey person operations an external-person grant needs.

WisKey is the access engine (credentials, door map, validity, timing); Arx decides (AUTH01). The grant service
(services/access_grants.py) talks to WisKey ONLY through this port, so the whole flow runs against a fake in tests
(tests/fake_wiskey.py `FakeAccessEngine`) and nothing in a test can reach a station, a door or a reader.

`WiskeyServiceEngine` is the live implementation over the existing S11 people writes (the SERVICE channel, the config lane of
`intercom_sync.SYNC.action`: sent once, never queued, never retried). It refuses every call while the owner's separate go-live
permit is not in the build (`access_grants.GO_LIVE_PERMITTED`, a code constant that is False) - so in this build no grant ever
reaches a real WisKey, whatever the settings say. It was written against the shipped S11 shapes and has NOT been run against a
WisKey (NOT_RUN; the W-a..W-e questions of the CR section 9 are open).

Error kinds (`EngineError.kind`): `not_found`, `revision_conflict`, `pin_conflict`, `not_sent` (nothing reached WisKey - safe to
try again later), `unknown` (sent, no clear answer - never retried blindly: the next step is a fresh read), `refused` (WisKey
answered an error), `not_permitted` (the go-live permit is not in the build)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

KEEP = object()  # `apply(pin=KEEP)`: leave the person's PIN as it is (a narrowing push)

ERROR_KINDS = ("not_found", "revision_conflict", "pin_conflict", "not_sent", "unknown", "refused", "not_permitted")


class EngineError(Exception):
    def __init__(self, kind: str, code: str = "") -> None:
        super().__init__(kind)
        self.kind = kind if kind in ERROR_KINDS else "refused"
        self.code = (code or "")[:64]


@dataclass(frozen=True)
class EnginePerson:
    """A WisKey person as the grant service needs it. Never a PIN value (only `pin_configured`), never a card value."""

    id: str
    revision: int
    display_name: str = ""
    active: bool = False
    valid_from: str | None = None
    valid_until: str | None = None
    doors: dict[str, list[int]] = field(default_factory=dict)
    stations: tuple[str, ...] = ()  # every station the person is assigned to (door map, overrides, assignments)
    pin_configured: bool = False
    timing: dict[str, Any] | None = None
    category: str = "unknown"


class Engine(Protocol):
    def create_person(self, *, display_name: str, employee_no: str, category: str, responsible_person: str, access_purpose: str) -> EnginePerson: ...

    def get_person(self, person_id: str) -> EnginePerson: ...

    def apply(self, person_id: str, revision: int, *, doors: dict[str, list[int]], valid_from: str, valid_until: str,
              timing: dict[str, Any] | None, active: bool, pin: Any = KEEP) -> EnginePerson: ...

    def strip(self, person_id: str, revision: int) -> EnginePerson: ...

    def pin_generate(self, person_id: str) -> str: ...

    def rename(self, person_id: str, revision: int, display_name: str) -> EnginePerson: ...

    def delete(self, person_id: str, revision: int) -> None: ...


# ---------------------------------------------------------------- the live engine (refused in this build)

def _doors_of(raw: Any) -> dict[str, list[int]]:
    out: dict[str, list[int]] = {}
    if isinstance(raw, dict):
        for sid, relays in raw.items():
            if isinstance(sid, str) and isinstance(relays, list):
                out[sid] = sorted({r for r in relays if isinstance(r, int) and not isinstance(r, bool)})
    return out


def person_from_raw(raw: Any) -> EnginePerson:
    """A WisKey person record (users/get or a save's answer, rc.37 shapes as S11 reads them) -> EnginePerson. Raises ValueError
    on anything that is not a person record (after a write that is "outcome unknown")."""
    if not isinstance(raw, dict) or not isinstance(raw.get("id"), str) or not isinstance(raw.get("revision"), int):
        raise ValueError("unexpected person record")
    doors = _doors_of(raw.get("door_permissions"))
    stations = set(doors)
    overrides = raw.get("permission_overrides")
    if isinstance(overrides, dict):
        stations |= {k for k in overrides if isinstance(k, str)}
    assignments = raw.get("assignments")
    if isinstance(assignments, dict):
        stations |= {k for k in assignments if isinstance(k, str)}
    policy = raw.get("access_timing_policy") if isinstance(raw.get("access_timing_policy"), dict) else None
    return EnginePerson(
        id=raw["id"], revision=raw["revision"], display_name=str(raw.get("display_name") or "")[:32], active=bool(raw.get("active")),
        valid_from=raw.get("valid_from") if isinstance(raw.get("valid_from"), str) else None,
        valid_until=raw.get("valid_until") if isinstance(raw.get("valid_until"), str) else None,
        doors=doors, stations=tuple(sorted(stations)), pin_configured=bool(raw.get("pin_configured")),
        timing=policy.get("schedule") if policy and isinstance(policy.get("schedule"), dict) else None,
        category=raw.get("access_category") if raw.get("access_category") in ("staff", "visitor", "contractor") else "unknown",
    )


class WiskeyServiceEngine:
    """The S11 people writes on the service channel. Every method refuses (`not_permitted`) while the go-live permit is not in the
    build; nothing below the guard has run against a WisKey (NOT_RUN)."""

    WHO = "system:access_grants"

    def __init__(self, settings: Any) -> None:
        self.settings = settings

    def _guard(self) -> None:
        from . import access_grants

        if not access_grants.go_live_permitted():
            raise EngineError("not_permitted", "access_grants_not_permitted")

    @staticmethod
    def _map(exc: Exception) -> EngineError:
        from ..errors import ApiError

        if isinstance(exc, ApiError):
            details = exc.details if isinstance(getattr(exc, "details", None), dict) else {}
            wcode = str(details.get("wiskey_code") or "")
            if exc.code in ("intercom_person_not_found",) or wcode == "user_not_found":
                return EngineError("not_found", wcode or exc.code)
            if exc.code == "intercom_revision_conflict" or wcode == "revision_conflict":
                return EngineError("revision_conflict", wcode or exc.code)
            if wcode in ("pin_conflict", "intercom_pin_conflict") or exc.code == "intercom_pin_conflict":
                return EngineError("pin_conflict", wcode or exc.code)
            outcome = details.get("outcome")
            if outcome == "not_sent":
                return EngineError("not_sent", wcode or exc.code)
            if outcome == "unknown" or exc.code == "intercom_outcome_unknown":
                return EngineError("unknown", wcode or exc.code)
            return EngineError("refused", wcode or exc.code)
        if isinstance(exc, ValueError):
            return EngineError("unknown", "invalid_response")
        return EngineError("unknown", type(exc).__name__)

    def _write(self, send: Any) -> EnginePerson:
        from . import intercom_sync

        try:
            reply = intercom_sync.SYNC.action(self.settings, "person", send, person_from_raw_dict, self.WHO, lane="config")
        except Exception as exc:  # noqa: BLE001 - mapped to the closed kinds
            raise self._map(exc) from None
        raw = reply.get("person")
        if not isinstance(raw, dict):
            raise EngineError("unknown", "invalid_response")
        return person_from_raw(raw)

    def create_person(self, *, display_name: str, employee_no: str, category: str, responsible_person: str, access_purpose: str) -> EnginePerson:
        self._guard()
        from . import intercom_client

        data = {"display_name": display_name[:32], "employee_no": employee_no, "access_category": category, "responsible_person": responsible_person[:64],
                "access_purpose": access_purpose[:128], "active": False}
        return self._write(lambda call: intercom_client.users_create(call, data, True))

    def get_person(self, person_id: str) -> EnginePerson:
        self._guard()
        from . import intercom_client, intercom_sync

        try:
            reply = intercom_sync.SYNC.command(self.settings, "person", lambda call: intercom_client.users_get(call, person_id), person_from_raw_dict, who=self.WHO)
        except Exception as exc:  # noqa: BLE001
            raise self._map(exc) from None
        raw = reply.get("person")
        if not isinstance(raw, dict):
            raise EngineError("not_sent", str(reply.get("last_error") or reply.get("state") or "unavailable"))
        return person_from_raw(raw)

    def apply(self, person_id: str, revision: int, *, doors: dict[str, list[int]], valid_from: str, valid_until: str,
              timing: dict[str, Any] | None, active: bool, pin: Any = KEEP) -> EnginePerson:
        self._guard()
        from . import intercom_client

        data: dict[str, Any] = {"door_permissions": doors, "valid_from": valid_from, "valid_until": valid_until, "active": active,
                                "access_timing_policy": {"mode": "ha", "schedule": timing, "bindings": {}} if timing else None}
        if pin is not KEEP:
            data["pin"] = pin
        return self._write(lambda call: intercom_client.users_update(call, person_id, revision, data, True))

    def strip(self, person_id: str, revision: int) -> EnginePerson:
        self._guard()
        from . import intercom_client

        data = {"pin": None, "door_permissions": {}, "active": False, "access_timing_policy": None}
        return self._write(lambda call: intercom_client.users_update(call, person_id, revision, data, True))

    def pin_generate(self, person_id: str) -> str:
        self._guard()
        from . import intercom_client, intercom_sync

        try:
            reply = intercom_sync.SYNC.command(self.settings, "pin", lambda call: intercom_client.users_pin_generate(call, person_id), intercom_sync.project_pin,
                                               who=self.WHO)
        except Exception as exc:  # noqa: BLE001
            raise self._map(exc) from None
        pin = (reply.get("pin") or {}).get("pin") if isinstance(reply.get("pin"), dict) else None
        if not isinstance(pin, str):
            raise EngineError("not_sent", "pin_unavailable")
        return pin

    def rename(self, person_id: str, revision: int, display_name: str) -> EnginePerson:
        self._guard()
        from . import intercom_client

        return self._write(lambda call: intercom_client.users_update(call, person_id, revision, {"display_name": display_name[:32]}, True))

    def delete(self, person_id: str, revision: int) -> None:
        self._guard()
        from . import intercom_client, intercom_sync

        try:
            intercom_sync.SYNC.action(self.settings, "deleted", lambda call: intercom_client.users_delete(call, person_id, revision), intercom_sync.project_accepted,
                                      self.WHO, lane="config")
        except Exception as exc:  # noqa: BLE001
            raise self._map(exc) from None


def person_from_raw_dict(raw: Any) -> dict[str, Any]:
    """The projection the sync layer serves under `person`: the raw record checked to be a person (kept as a dict; the grant
    service maps it with `person_from_raw`)."""
    person_from_raw(raw)
    return dict(raw)
