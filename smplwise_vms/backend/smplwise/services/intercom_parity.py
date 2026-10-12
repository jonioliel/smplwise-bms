"""CR-036 S12 (section 6.2, step 1): the parity report - does each native access-control screen show what the WisKey panel
shows, apart from what Arx RBAC filters out on purpose?

For each screen the report reads the SAME WisKey command twice over the add-on's read channel:

- the **source**: a direct, unfiltered read (the service identity sees everything - CR-036 2.1), projected through the
  adapter's closed superset projection;
- the **native** view: the very adapter method the screen's typed endpoint calls (services/intercom_adapter.py), for the
  report's SUBJECT (the caller, or another Arx user an administrator names);

and computes the **expected** native set from the source by the projection filter's own rules (services/intercom_authority.py).
Per screen: `match` (native = source), `filtered` (native = expected and smaller: the rule that filtered is named),
`mismatch` (native is neither - a defect in the native path, or the data changed between the two reads: run it again),
`partial` (a side stopped at its scan cap, so no verdict), `not_permitted` (the subject may not open the screen),
`unsupported` (this WisKey does not offer the command: nothing was sent) or `unavailable` (WisKey did not answer).

What leaves this module: counts, a completeness flag and a KEYED digest of the ids per side (HMAC-SHA-256 with a key made
when the process starts, so digests compare only inside one report and cannot be matched against a list of ids). Never a
name, a person, an event, an id list or a value. Nothing is cached; one report runs at a time (a second one is refused).

Cost: one report is at most about 30 WisKey reads (people and events scans capped at MAX_PAGES pages per side) on the shared
read lane - it is asked for by an administrator's button, never polled.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from ..config import Settings
from ..errors import ApiError
from ..rbac import Principal
from . import intercom_adapter as adapter
from . import intercom_authority as ia
from . import intercom_sync

log = logging.getLogger("smplwise.intercom")

MAX_PAGES = 5  # per side and screen: people and events stop here (1 000 rows at WisKey's 200-row page) and say "partial"
NATIVE_PAGE = 200
_KEY = os.urandom(32)
_RUNNING = threading.Lock()

# screen -> (adapter feature, the permission its native view needs, the native route)
SCREENS: dict[str, tuple[str | None, str, str]] = {
    "stations": (None, ia.READ, "#/wiskey/devices"),
    "people": ("people", ia.PEOPLE_READ, "#/wiskey/people"),
    "events": ("events", ia.EVENTS_READ, "#/wiskey/events"),
    "groups": ("groups", ia.PEOPLE_READ, "#/system/access-control/groups"),
    "schedules": ("schedules", ia.STATIONS_READ, "#/wiskey/schedules"),
    "alerts": ("alerts", ia.ADMIN_READ, "#/system/access-control"),
}
OUTCOMES = ("match", "filtered", "mismatch", "partial", "not_permitted", "unsupported", "unavailable")


def _now() -> datetime:
    """The end of the entry-log window (a function, so tests can place the window over the fake's events)."""
    return datetime.now(timezone.utc).replace(microsecond=0)


def digest(ids: list[str] | None) -> str | None:
    """A keyed digest of a set of ids (order and duplicates do not matter); None for no set."""
    if ids is None:
        return None
    body = "\n".join(sorted(set(ids))).encode("utf-8")
    return hmac.new(_KEY, body, hashlib.sha256).hexdigest()[:20]


def principal_of(conn: sqlite3.Connection, user_id: str) -> Principal | None:
    """An active Arx user as a principal (the report's subject when an administrator names one)."""
    row = conn.execute("SELECT id, username, display_name, active FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None or not row["active"]:
        return None
    return Principal(user_id=row["id"], username=row["username"] or "", display_name=row["display_name"] or "", source="parity")


class _Side:
    """One side of a comparison: the ids it holds and whether it holds all of them."""

    def __init__(self, ids: list[str], complete: bool, count: int | None = None) -> None:
        self.ids = ids
        self.complete = complete
        self.count = len(set(ids)) if count is None else count

    def public(self) -> dict[str, Any]:
        return {"count": self.count, "complete": self.complete, "digest": digest(self.ids) if self.complete else None}


class _Unavailable(Exception):
    def __init__(self, reason: str | None) -> None:
        super().__init__(reason or "unavailable")
        self.reason = reason or "unavailable"


def _ready(reply: dict[str, Any], key: str) -> Any:
    value = reply.get(key)
    if reply.get("state") != "ready" or value is None:
        raise _Unavailable(reply.get("last_error") or reply.get("state"))
    return value


class Report:
    """One report for one subject. `caller` reads the source (its id is the WisKey rate bucket's key - Arx's own lanes);
    `subject` is whose native view is compared."""

    def __init__(self, settings: Settings, caller: ia.Authority, subject: ia.Authority, hours: int) -> None:
        self.settings = settings
        self.caller = caller
        self.subject = subject
        self.hours = hours
        self.who = caller.principal.user_id
        now = _now()
        self.start = (now - timedelta(hours=hours)).isoformat()
        self.end = now.isoformat()

    # -- the raw (unfiltered) reads: the adapter's own frames and closed projections, on its read channel
    def _raw(self, key: str, send: Callable[..., Any], project: Callable[[Any], Any], command: str) -> Any:
        return _ready(adapter.ADAPTER._read(self.settings, self.who, key, send, project, command=command), key)

    def source_people(self) -> tuple[_Side, list[dict[str, Any]]]:
        people: list[dict[str, Any]] = []
        offset, snapshot, complete = 0, "", False
        for _page in range(MAX_PAGES):
            at, snap = offset, snapshot
            page = self._raw("people", lambda call, at=at, snap=snap: adapter.users_query(call, {}, at, adapter.SCAN_PAGE, snap), adapter.project_people_page, "users/query")
            snapshot = snapshot or page["snapshot"]
            people.extend(page["records"])
            if page["next_offset"] is None:
                complete = True
                break
            offset = page["next_offset"]
        return _Side([p["id"] for p in people], complete), people

    def source_events(self) -> tuple[_Side, list[dict[str, Any]]]:
        events: list[dict[str, Any]] = []
        before, complete = None, False
        for _page in range(MAX_PAGES):
            at = before
            page = self._raw("events", lambda call, at=at: adapter.events_list(call, {"start": self.start, "end": self.end, "limit": adapter.SCAN_PAGE, "before": at}),
                             adapter.project_event_page, "events/list")
            events.extend(page["records"])
            if page["next"] is None:
                complete = True
                break
            before = page["next"]
        return _Side([e["id"] for e in events], complete), events

    # -- the screens
    def stations(self) -> dict[str, Any]:
        sup = intercom_sync.SYNC.stations_superset(self.settings)
        if sup["stations"] is None:
            raise _Unavailable(sup.get("state"))
        source = _Side([s["id"] for s in sup["stations"]], True)
        expected = [s["id"] for s in sup["stations"] if ia.view_station(self.subject, s) is not None]
        native = None
        if self.subject.anywhere(ia.READ):
            reply = adapter.ADAPTER.stations(self.settings, self.subject)
            native = _Side([s["id"] for s in _ready(reply, "stations")], True)
        return self._verdict("stations", source, expected, native)

    def people(self) -> dict[str, Any]:
        source, supersets = self.source_people()
        expected = [p["id"] for p in supersets if ia.person_level_of(self.subject, p) != ia.NONE]
        native = None
        if self.subject.anywhere(ia.PEOPLE_READ):
            ids: list[str] = []
            offset, snapshot, complete, total = 0, None, False, None
            for _page in range(MAX_PAGES):
                reply = adapter.ADAPTER.people(self.settings, self.subject, query="", filters={}, offset=offset, limit=NATIVE_PAGE, snapshot=snapshot)
                page = _ready(reply, "people")
                ids.extend(r["id"] for r in page["records"])
                total = page["total"] if total is None else total
                snapshot = page.get("snapshot") or snapshot
                if page["next_offset"] is None:
                    complete = bool(page.get("complete", True))
                    break
                offset = page["next_offset"]
            native = _Side(ids, complete, count=len(set(ids)) if complete else total)
        return self._verdict("people", source, expected, native)

    def events(self) -> dict[str, Any]:
        source, supersets = self.source_events()
        expected = [e["id"] for e in supersets if ia.view_event(self.subject, e) is not None]
        native = None
        if self.subject.anywhere(ia.EVENTS_READ):
            ids: list[str] = []
            before, complete = None, False
            for _page in range(MAX_PAGES):
                reply = adapter.ADAPTER.events(self.settings, self.subject, {"start": self.start, "end": self.end}, limit=NATIVE_PAGE, before=before)
                page = _ready(reply, "events")
                ids.extend(r["id"] for r in page["records"])
                if page["next"] is None:
                    complete = bool(page.get("complete", True))
                    break
                before = page["next"]
            native = _Side(ids, complete)
        return self._verdict("events", source, expected, native)

    def groups(self) -> dict[str, Any]:
        raw = self._raw("groups", adapter.profiles_settings, adapter.project_groups, "profiles/settings_get")
        source = _Side([g["id"] for g in raw["groups"]], True)
        expected = [g["id"] for g in ia.view_groups(self.subject, raw)["groups"]]
        native = None
        if self.subject.anywhere(ia.PEOPLE_READ):
            reply = adapter.ADAPTER.groups(self.settings, self.subject)
            native = _Side([g["id"] for g in _ready(reply, "groups")["groups"]], True)
        return self._verdict("groups", source, expected, native)

    def schedules(self) -> dict[str, Any]:
        raw = self._raw("schedules", adapter.schedules_list, adapter.project_schedule_library, "schedules/list")
        source = _Side([s["id"] for s in raw], True)
        wide = self.subject.unrestricted(ia.STATIONS_READ)
        expected = source.ids if wide else []  # installation-wide in WisKey: a station-scoped caller is not offered the library
        native = None
        if wide:
            # the route's own gate (`require_unrestricted`) passes for this subject, so the adapter call writes no refusal
            reply = adapter.ADAPTER.schedules(self.settings, self.subject, "library")
            native = _Side([s["id"] for s in _ready(reply, "schedules")], True)
        elif self.subject.anywhere(ia.STATIONS_READ):
            native = _Side([], True)
        return self._verdict("schedules", source, expected, native, rule_restricted="installation_wide")

    def alerts(self) -> dict[str, Any]:
        raw = self._raw("alerts", lambda call: adapter.fleet_alerts(call, "", True), adapter.project_alerts, "fleet/alerts")

        def key(item: dict[str, Any]) -> str:
            return f"{item.get('station_id')}|{item.get('kind')}|{item.get('id')}"

        source = _Side([key(i) for i in raw["items"]], bool(raw.get("fetched_all")))
        expected = [key(i) for i in raw["items"] if ia.status_station(self.subject, i.get("station_id"))]
        native = None
        if self.subject.anywhere(ia.ADMIN_READ):
            reply = adapter.ADAPTER.alerts(self.settings, self.subject, kind="", include_suppressed=True, offset=0, limit=adapter.SCAN_PAGE)
            page = _ready(reply, "alerts")
            native = _Side([key(i) for i in page["items"]], bool(page.get("complete")))
        return self._verdict("alerts", source, expected, native)

    # -- the verdict
    def _verdict(self, screen: str, source: _Side, expected: list[str], native: _Side | None, rule_restricted: str = "station_scope") -> dict[str, Any]:
        feature, permission, route = SCREENS[screen]
        row: dict[str, Any] = {"screen": screen, "feature": feature, "permission": permission, "route": route, "source": source.public(),
                               "expected_count": len(set(expected)), "native": None if native is None else native.public(), "rule": None, "reason": None}
        if native is None:
            row.update(outcome="not_permitted", rule="permission")
            return row
        if len(set(native.ids)) > len(set(source.ids)) and source.complete:
            row["outcome"] = "mismatch"  # the native view holds something the unfiltered read does not: never expected
            return row
        if not (source.complete and native.complete):
            row["outcome"] = "partial"
            return row
        if set(native.ids) == set(source.ids):
            row["outcome"] = "match"
        elif set(native.ids) == set(expected):
            row.update(outcome="filtered", rule=rule_restricted)
        else:
            row["outcome"] = "mismatch"
        return row

    def run_screen(self, screen: str) -> dict[str, Any]:
        feature, permission, route = SCREENS[screen]
        if feature is not None:
            available, reason = adapter.feature_state(intercom_sync.SYNC.api_facts(self.settings), feature)
            if available is False:
                return {"screen": screen, "feature": feature, "permission": permission, "route": route, "source": None, "expected_count": None, "native": None,
                        "outcome": "unsupported", "rule": None, "reason": reason}
        try:
            return getattr(self, screen)()
        except _Unavailable as exc:
            reason = exc.reason
        except ApiError as exc:
            reason = exc.code
        except Exception as exc:  # noqa: BLE001 - a screen that cannot be compared is reported, never guessed
            log.warning("parity: %s could not be compared (%s)", screen, type(exc).__name__)
            reason = "error"
        return {"screen": screen, "feature": feature, "permission": permission, "route": route, "source": None, "expected_count": None, "native": None,
                "outcome": "unavailable", "rule": None, "reason": reason if isinstance(reason, str) and adapter.CODE.fullmatch(reason) else "error"}


def report(settings: Settings, caller: ia.Authority, subject: Principal, *, hours: int) -> dict[str, Any]:
    """The parity report of `subject`'s native views (the caller's own, or another user's when the route allowed it). Reply:
    `{state, configured, last_error, fetched_at, parity, sync}`; `parity` is null unless the feed is ready (nothing is asked)."""
    head = adapter._feed(settings)
    if head["state"] != "ready":
        return {**head, "parity": None, "sync": intercom_sync.STATE.as_dict()}
    if not _RUNNING.acquire(blocking=False):
        raise ApiError(409, "intercom_parity_busy", "בדיקת התאמה כבר רצה - נסו שוב בעוד רגע.", retryable=True)
    own = subject.user_id == caller.principal.user_id
    try:
        run = Report(settings, caller, caller if own else ia.Authority(caller.conn, subject), hours)
        rows = [run.run_screen(screen) for screen in SCREENS]
    finally:
        _RUNNING.release()
    summary = {o: sum(1 for r in rows if r["outcome"] == o) for o in OUTCOMES}
    return {
        **head,
        "last_error": None,
        "fetched_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "parity": {
            "window_hours": hours,
            "window": {"start": run.start, "end": run.end},
            "subject": {"user_id": subject.user_id, "display_name": subject.display_name or subject.username or subject.user_id, "self": own},
            "screens": rows,
            "summary": summary,
        },
        "sync": intercom_sync.STATE.as_dict(),
    }
