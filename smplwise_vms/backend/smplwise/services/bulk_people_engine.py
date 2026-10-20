"""CR-BULKPEOPLE-295: the access engine port of bulk people import / edit - the few WisKey operations a bulk job needs.

The bulk service (services/bulk_people.py) talks to WisKey ONLY through this port, so the whole pipeline runs against a fake in tests
(tests/test_bulkpeople_295.FakeBulkEngine) and nothing in a test can reach WisKey, a station, a door or a reader.

`WiskeyBulkEngine` is the live implementation over the existing S11 seam (services/intercom_client `users/query`, `users/get`,
`users/create`, `users/update`, `profiles/settings_get` through `intercom_sync.SYNC`; people writes on the config lane: sent once,
never queued, never retried). WisKey has no bulk command: Arx writes row by row. Every WRITE is refused (`not_permitted`) while the
owner's separate go-live permit is not in the build (`bulk_people.GO_LIVE_PERMITTED`, a code constant that is False). The reads are
the same reads the people screens already make. NOT_RUN against any WisKey.

Errors are `access_grant_engine.EngineError` (one closed set of kinds for every engine port): `not_found`, `revision_conflict`,
`not_sent` (nothing reached WisKey), `unknown` (sent, no clear answer - never re-sent), `refused` (WisKey answered an error; `code`
says which), `not_permitted`."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from .access_grant_engine import EngineError, EnginePerson, person_from_raw

MAX_SCAN_PAGES = 50
SCAN_PAGE = 200


@dataclass(frozen=True)
class BulkPerson:
    """One WisKey person as the bulk service needs it: the closed superset the projection filter decides on
    (intercom_adapter.project_person) and the engine view (enabled doors, override values, group ids - each with its `known` flag)."""

    superset: dict[str, Any]
    engine: EnginePerson


def from_raw(raw: Any) -> BulkPerson:
    """A WisKey person record -> BulkPerson; ValueError when it is not a person record."""
    from .intercom_adapter import project_person

    superset = project_person(raw)
    if superset is None:
        raise ValueError("unexpected person record")
    return BulkPerson(superset, person_from_raw(raw))


class BulkEngine(Protocol):
    def list_people(self, who: str) -> list[BulkPerson]:
        """Every person WisKey holds (the service identity sees all; the caller's view is cut by the projection filter)."""
        ...

    def get_person(self, person_id: str, who: str) -> BulkPerson: ...

    def groups(self, who: str) -> dict[str, list[str] | None]:
        """group id -> the stations it grants (None = unknown)."""
        ...

    def create(self, data: dict[str, Any], who: str) -> BulkPerson: ...

    def update(self, person_id: str, revision: int, data: dict[str, Any], who: str) -> BulkPerson: ...


def _raw_page(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("records", []), list):
        raise ValueError("unexpected users/query answer")
    return {"records": [r for r in raw.get("records") or [] if isinstance(r, dict)], "next_offset": raw.get("next_offset"),
            "snapshot": raw.get("snapshot") if isinstance(raw.get("snapshot"), str) else ""}


def _raw_person(raw: Any) -> dict[str, Any]:
    person_from_raw(raw)  # raises on a non-person answer
    return dict(raw)


class WiskeyBulkEngine:
    """The S11 seam on the service channel. Writes refuse without the go-live permit; nothing here has run against a WisKey."""

    def __init__(self, settings: Any) -> None:
        self.settings = settings

    @staticmethod
    def _guard() -> None:
        from . import bulk_people

        if not bulk_people.go_live_permitted():
            raise EngineError("not_permitted", "bulk_people_not_permitted")

    @staticmethod
    def _map(exc: Exception) -> EngineError:
        from .access_grant_engine import WiskeyServiceEngine

        return WiskeyServiceEngine._map(exc)

    def list_people(self, who: str) -> list[BulkPerson]:
        from . import intercom_adapter, intercom_sync

        out: list[BulkPerson] = []
        offset, snap = 0, ""
        for _ in range(MAX_SCAN_PAGES):
            try:
                reply = intercom_sync.SYNC.command(self.settings, "people", lambda call, at=offset, s=snap: intercom_adapter.users_query(call, {}, at, SCAN_PAGE, s),
                                                   _raw_page, who=who, channel="read", slot_wait=2.0)
            except Exception as exc:  # noqa: BLE001
                raise self._map(exc) from None
            page = reply.get("people")
            if page is None:
                raise EngineError("not_sent", str(reply.get("last_error") or reply.get("state") or "unavailable")[:64])
            snap = snap or page["snapshot"]
            for raw in page["records"]:
                try:
                    out.append(from_raw(raw))
                except ValueError:
                    continue  # not a person record: never shown, never written
            following = page["next_offset"]
            if not isinstance(following, int) or isinstance(following, bool) or following <= offset:
                return out
            offset = following
        raise EngineError("not_sent", "scan_limit")

    def get_person(self, person_id: str, who: str) -> BulkPerson:
        from . import intercom_client, intercom_sync

        target = intercom_sync.person_target(person_id)
        if intercom_sync.SYNC.write_gate(target) == "outcome_pending":
            raise EngineError("not_sent", "outcome_pending")
        try:
            reply = intercom_sync.SYNC.command(self.settings, "person", lambda call: intercom_client.users_get(call, person_id), _raw_person, who=who, target=target)
        except Exception as exc:  # noqa: BLE001
            raise self._map(exc) from None
        raw = reply.get("person")
        if not isinstance(raw, dict):
            raise EngineError("not_sent", str(reply.get("last_error") or reply.get("state") or "unavailable")[:64])
        return from_raw(raw)

    def groups(self, who: str) -> dict[str, list[str] | None]:
        from . import intercom_adapter, intercom_sync

        try:
            reply = intercom_sync.SYNC.command(self.settings, "groups", intercom_adapter.profiles_settings, intercom_adapter.project_groups, who=who, channel="read")
        except Exception as exc:  # noqa: BLE001
            raise self._map(exc) from None
        groups = reply.get("groups")
        if not isinstance(groups, dict):
            raise EngineError("not_sent", str(reply.get("last_error") or reply.get("state") or "unavailable")[:64])
        return {g["id"]: g.get("station_ids") for g in groups.get("groups") or []}

    def _write(self, send: Any, who: str, person_id: str | None) -> BulkPerson:
        from . import intercom_sync

        target = intercom_sync.person_target(person_id) if person_id is not None else None
        try:
            reply = intercom_sync.SYNC.action(self.settings, "person", send, _raw_person, who, lane="config", target=target)
        except Exception as exc:  # noqa: BLE001
            raise self._map(exc) from None
        raw = reply.get("person")
        if not isinstance(raw, dict):
            raise EngineError("unknown", "invalid_response")
        try:
            return from_raw(raw)
        except ValueError:
            raise EngineError("unknown", "invalid_response") from None

    def create(self, data: dict[str, Any], who: str) -> BulkPerson:
        self._guard()
        from . import intercom_client

        return self._write(lambda call: intercom_client.users_create(call, data, True), who, None)

    def update(self, person_id: str, revision: int, data: dict[str, Any], who: str) -> BulkPerson:
        self._guard()
        from . import intercom_client

        return self._write(lambda call: intercom_client.users_update(call, person_id, revision, data, True), who, person_id)
