"""Fixture backend for tests/evidence-wiskey-actions.spec.ts (T054, CR-005 phase 3) and the fixture parts of
tests/evidence-wiskey-events.spec.ts (CR-005 phase 1b activity log) and tests/evidence-wiskey-people.spec.ts (phase 1b
people directory): the REAL SMPLWISE backend, whose
Home Assistant WebSocket is an in-process fake that answers like WisKey (`hikvision_intercom/*`). No real Home
Assistant, WisKey or door station can be reached from this process: HA_URL is forced to a `.test` host (a reserved
name that never resolves) and every `websockets.connect` goes to the fake; it refuses to start inside the add-on.

Run it (a fresh data dir each time; the SMPLWISE port and the control port are yours to choose):

    SW_PORT=8347 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/wiskey_fake_ha.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_WISKEY_FIXTURE=1 SW_API_PORT=8347 SW_WISKEY_CONTROL=http://127.0.0.1:8357 \
        SW_BASE_URL=http://127.0.0.1:4187/ npx playwright test tests/evidence-wiskey-actions.spec.ts --project=desktop --workers=1

Fixture WisKey 4.2.0-fake, four stations:
    gate   "שער ראשי"  ringing, 1 lock      lobby "לובי"  idle, 2 locks
    office "משרד"      in a call, 1 lock    store "מחסן"  offline, 1 lock
answer -> in_call, reject / hangUp -> idle, each followed by WisKey's data-free `refresh` push, as the real one does;
a signal that does not match the call state is refused `device_unavailable`, as WisKey's device check does.

Control API (SW_WISKEY_CONTROL_PORT, default SW_PORT + 10, 127.0.0.1 only), JSON:
    POST /reset                         stations and modes back to the table above; the sent log is cleared
    POST /station {id, call_state}      set a station's call state and push `refresh`
    POST /mode {unlock}                 how stations/test_unlock answers: "accept" ({accepted: true}, the default) or
                                        "unexpected" (success: true with a result of an unexpected shape) or
                                        "unconfirmed" (WisKey's `release_unconfirmed`: the door may have opened)
    GET  /sent                          every hikvision_intercom/* frame the fake received, in order
    POST /events/add {count}            add `count` access events newer than any other and push `refresh` (WisKey's
                                        EventManager.changed() does the same on every accepted event)
    POST /events/prune {keep}           keep only the newest `keep` events: an older `before` cursor then expires
    POST /events/delay {seconds}        answer every events/list that much later (0-10 s; 0 after /reset), so a test
                                        can hold a request in flight
    POST /people/touch {id}             edit a person: revision + 1 (WisKey's directory snapshot changes), their
                                        assignments back to `pending` (the stations' pending_user_count rises, which is
                                        what changes SMPLWISE's overview projection) and push `refresh`
    POST /people/remove {id, notify?}   delete a person (the stations' managed_user_count falls); pushes `refresh`
                                        unless `notify` is false
    POST /limits {scan_page?, max_scan_pages?, user_burst?, user_rate?}
                                        set the SMPLWISE backend's own people-search scan and read rate-bucket
                                        constants IN THIS PROCESS (intercom_sync SCAN_PAGE / MAX_SCAN_PAGES /
                                        USER_BURST / USER_RATE) and reset the buckets, so a test can reach the
                                        `complete: false` outcomes deterministically; /reset restores the defaults

The event cache starts with EVENT_COUNT deterministic access events (newest first: 08:00 Asia/Jerusalem on 2026-09-27,
then every 7 minutes back), answered by `events/list` with WisKey's own EventCache.query semantics (events.py): exact
station / result / authentication / door, casefolded `person` substring over "<employee_no> <person_name>", start /
end bounds, `limit` 1-200, `before` = the previous page's last id (an unknown id is `invalid_fields`, "Event cursor
expired"), and `next` = the page's last id only while more rows match. Rows carry WisKey's full row (masked card,
portrait, evidence, major / minor), so the SMPLWISE projection is exercised too.

The people directory starts with PEOPLE_COUNT deterministic people (see `person()`), answered by `users/query` with
WisKey's own `access/user_directory.py` semantics (`query_users`): the station / rights / state / credential / group /
profile filters, the three sorts (employee = natural order), offset clamped to the last page, `snapshot` = a token
over (id, revision) pairs and `stale` = the caller's snapshot differs from it - and WisKey's real text matching (name,
employee number, phone digits, card last-4) should SMPLWISE ever send a text, which it must not. `users/get` answers
one full Person or `user_not_found`. Records carry WisKey's full public Person (phone, cards, PIN flag, profile values,
photo flag, revisions), so the SMPLWISE projection is exercised too.
"""
from __future__ import annotations

import asyncio
import copy
import datetime
import hashlib
import json
import os
import re
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("wiskey_fake_ha: refusing to run inside the Home Assistant add-on")

BACKEND = Path(__file__).resolve().parents[3] / "smplwise_vms" / "backend"
sys.path.insert(0, str(BACKEND))
FAKE_HOST = "fake-wiskey.test"
os.environ["HA_URL"] = f"http://{FAKE_HOST}:8123"
os.environ["HA_TOKEN"] = "fake-fixture-token"

import websockets  # noqa: E402

LIMIT_NAMES = ("SCAN_PAGE", "MAX_SCAN_PAGES", "USER_BURST", "USER_RATE")  # intercom_sync constants the /limits control may set
LIMIT_DEFAULTS: dict[str, Any] = {}  # filled on first use (the backend is imported only after `websockets.connect` is replaced)

ZONE = {"kind": "iana", "name": "Asia/Jerusalem"}
VERSION = "4.2.0-fake"


def station(sid: str, name: str, call_state: str, locks: list[dict[str, Any]], online: bool = True) -> dict[str, Any]:
    return {
        "id": sid, "name": name, "online": online, "call_state": call_state if online else "unavailable", "sync_state": "synced" if online else "offline",
        "lock_enabled": bool(locks), "integrated_locks": locks, "last_error": None, "last_seen": "2026-09-27T08:00:00+03:00",
        "pending_user_count": 0, "managed_user_count": 12, "clock": {"zone": ZONE},
        "entities": {"online": f"binary_sensor.{sid}_online", "call_status": f"sensor.{sid}_call_status"},
        "last_access": {"timestamp": "2026-09-27T07:59:00+03:00", "time_source": "device", "person_name": "Dana", "employee_no": "1001", "authentication": "card", "result": "granted", "event_type": "access_granted", "recovered": False, "door": 1} if online else None,
    }


def initial_stations() -> list[dict[str, Any]]:
    return [
        station("gate", "שער ראשי", "ringing", [{"physical_index": 1, "api_id": 1, "name": "שער"}]),
        station("lobby", "לובי", "idle", [{"physical_index": 1, "api_id": 1, "name": "כניסה"}, {"physical_index": 2, "api_id": 7, "name": "מחסום"}]),
        station("office", "משרד", "in_call", [{"physical_index": 1, "api_id": 1, "name": None}]),
        station("store", "מחסן", "idle", [{"physical_index": 1, "api_id": 1, "name": None}], online=False),
    ]


TTS_ENGINES = {"default": "tts.piper", "engines": [
    {"engine_id": "tts.piper", "name": "Piper (local)", "supported_languages": ["en", "he"], "default_language": "he"},
    {"engine_id": "tts.google_translate_en_com", "name": "Google Translate", "supported_languages": ["en", "iw"], "default_language": "en"},
]}


EVENT_COUNT = 130  # more than one 100-row page, so "load more" has a second page
EVENT_BASE = datetime.datetime(2026, 9, 27, 8, 0, tzinfo=datetime.timezone(datetime.timedelta(hours=3)))
EVENT_STATIONS = ("gate", "lobby", "office", "store")
EVENT_PEOPLE = (("Dana Cohen", "1001"), ("Yossi Levi", "1017"), (None, "2044"), ("Maya Katz", "1033"), (None, None))


def access_event(n: int, when: datetime.datetime) -> dict[str, Any]:
    """Event number `n` (0 = the first generated, older numbers are older in time for the initial set). Every 5th is
    denied, every 11th has an unknown result and method; the rest are granted, card and PIN alternating."""
    name, employee = EVENT_PEOPLE[n % len(EVENT_PEOPLE)]
    result = "unknown" if n % 11 == 0 else "denied" if n % 5 == 0 else "granted"
    auth = "unknown" if result == "unknown" else "pin" if n % 2 else "card"
    station_id = EVENT_STATIONS[n % len(EVENT_STATIONS)]
    iso = when.isoformat()
    return {
        "id": f"ev-{n:04d}", "station_id": station_id, "timestamp": iso, "received_at": when.astimezone(datetime.timezone.utc).isoformat(),
        "time_source": "device", "person_name": name, "employee_no": employee, "door": 2 if station_id == "lobby" and n % 3 == 0 else 1,
        "authentication": auth, "result": result, "event_type": {"granted": "access_granted", "denied": "access_denied"}.get(result, "door_unlocked"),
        "card": "****1234" if auth == "card" else None, "recovered": n % 13 == 0, "major": 5, "minor": 1,
        "portrait": None, "evidence": {"identity_state": "identified" if employee else "no_identity", "origin": "device_event", "arrival_delay_seconds": 0},
        "api_door": 1, "source": "stream",
    }


def initial_events() -> list[dict[str, Any]]:
    return [access_event(i, EVENT_BASE - datetime.timedelta(minutes=7 * i)) for i in range(EVENT_COUNT)]


def _instant(value: Any) -> datetime.datetime | None:
    if not isinstance(value, str) or len(value) > 40:
        return None
    try:
        parsed = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else None


def query_events(rows: list[dict[str, Any]], filters: dict[str, Any]) -> dict[str, Any] | None:
    """WisKey's EventCache.query (events.py:301-387) for the filters SMPLWISE sends; None = `invalid_fields`."""
    allowed = {"station_id", "person", "result", "authentication", "event_type", "door", "start", "end", "limit", "before"}
    if set(filters) - allowed:
        return None
    limit = filters.get("limit", 100)
    if type(limit) is not int or not 1 <= limit <= 200:
        return None
    start, end = _instant(filters.get("start")), _instant(filters.get("end"))
    if ("start" in filters and start is None) or ("end" in filters and end is None) or (start and end and start >= end):
        return None
    matches = []
    for row in sorted(rows, key=lambda r: (_instant(r["timestamp"]), r["id"]), reverse=True):
        when = _instant(row["timestamp"])
        if when is None or (start and when < start) or (end and when > end):
            continue
        if any(f in filters and row[f] != filters[f] for f in ("station_id", "result", "authentication", "event_type", "door")):
            continue
        if "person" in filters and filters["person"].casefold() not in f"{row['employee_no'] or ''} {row['person_name'] or ''}".casefold():
            continue
        matches.append(row)
    before = filters.get("before")
    if before:
        index = next((i for i, row in enumerate(matches) if row["id"] == before), None)
        if index is None:
            return None  # "Event cursor expired"
        matches = matches[index + 1:]
    page = matches[:limit]
    return {
        "records": copy.deepcopy(page), "next": page[-1]["id"] if len(matches) > limit else None, "retention_days": 30, "capacity": 5000,
        "membership_basis": None, "storage_failed": False, "stations": {sid: {"stream": "connected", "history": "recovered"} for sid in EVENT_STATIONS},
    }


# ---------------------------------------------------------------- people directory (WisKey access/user_directory.py)

PEOPLE_COUNT = 130  # more than two pages of WisKey's default 50, so paging has a middle page
FIRST_NAMES = ("Dana", "Yossi", "Maya", "Oren", "Noa", "Avi", "Tamar", "Eli", "Shira", "Amit")
LAST_NAMES = ("Cohen", "Levi", "Katz", "Barak", "Shalev", "Mizrahi", "Peretz", "Friedman", "Azulay", "Golan", "Segal", "Dahan", "Rosen")
HEBREW_NAMES = {0: "דנה כהן", 7: "יוסי לוי", 21: "מאיה כץ"}  # a few RTL names among the ASCII ones
PEOPLE_STATIONS = ("gate", "lobby", "office", "store")


def assignment(sid: str, enabled: bool, locks: list[int], sync_state: str, revision: int) -> dict[str, Any]:
    return {
        "config_entry_id": sid, "enabled": enabled, "allowed_locks": locks, "schedule_template": None,
        "desired_revision": revision, "applied_revision": revision if sync_state == "synced" else revision - 1,
        "sync_state": sync_state, "last_sync_at": "2026-09-01T00:00:00+00:00" if sync_state == "synced" else None,
        "last_error": "device_unavailable" if sync_state == "error" else None,
    }


def person(n: int) -> dict[str, Any]:
    """Person number `n` (0-based): id u001..., employee number 1000 + n, a name from the two lists (10 x 13 are
    coprime, so 130 distinct names; a few Hebrew), a phone (+97250 + 7 digits), a card on every 3rd, a PIN on every
    2nd; every 9th inactive; validity expired / upcoming / current on n % 10 == 3 / 6 / 9, else permanent;
    assignments by n % 4: gate + lobby synced / gate pending / lobby synced + store offline / none (and every 8th of
    the "none" group an office assignment that is disabled and in error); groups on n % 5 == 0 / 1."""
    name = HEBREW_NAMES.get(n, f"{FIRST_NAMES[n % len(FIRST_NAMES)]} {LAST_NAMES[n % len(LAST_NAMES)]}")
    validity = {3: ("2025-01-01T00:00:00+00:00", "2026-01-01T00:00:00+00:00"), 6: ("2027-01-01T00:00:00+00:00", "2028-01-01T00:00:00+00:00"), 9: ("2026-01-01T00:00:00+00:00", "2027-12-31T00:00:00+00:00")}.get(n % 10, (None, None))
    revision = 1
    kind = n % 4
    if kind == 0:
        assignments = {"gate": assignment("gate", True, [1], "synced", revision), "lobby": assignment("lobby", True, [1, 2], "synced", revision)}
    elif kind == 1:
        assignments = {"gate": assignment("gate", True, [1], "pending", revision)}
    elif kind == 2:
        assignments = {"lobby": assignment("lobby", True, [1], "synced", revision), "store": assignment("store", True, [1], "offline", revision)}
    else:
        assignments = {"office": assignment("office", False, [1], "error", revision)} if n % 8 == 7 else {}
    return {
        "id": f"u{n + 1:03d}", "employee_no": str(1000 + n), "display_name": name, "phone": f"+97250{n:07d}", "active": n % 9 != 8,
        "user_type": "normal", "valid_from": validity[0], "valid_until": validity[1], "revision": revision,
        "created_at": "2026-01-01T00:00:00+00:00", "updated_at": "2026-09-01T00:00:00+00:00", "identity_locked": False,
        "profile": {"department": ("Engineering", "Operations", "Security")[n % 3]}, "group_ids": (["staff"], ["staff", "contractors"], [], [], [])[n % 5],
        "permission_overrides": {}, "photo_configured": False, "pin_configured": n % 2 == 0,
        "cards": [{"id": f"c{n + 1:03d}", "masked_number": f"•••• {(7000 + n) % 10000:04d}", "label": "Main", "card_type": "normalCard", "enabled": True}] if n % 3 == 0 else [],
        "assignments": assignments, "access_timing_draft": None, "access_timing_policy": None, "timing_readbacks": {},
    }


def initial_people() -> list[dict[str, Any]]:
    return [person(i) for i in range(PEOPLE_COUNT)]


class _Invalid(Exception):
    pass


def _text(value: Any, maximum: int = 160) -> str:
    if not isinstance(value, str) or len(value) > maximum or any(ord(c) < 32 for c in value):
        raise _Invalid
    return value.strip()


def _natural(value: str) -> tuple[tuple[int, Any], ...]:
    return tuple((0, int(part)) if part.isdigit() else (1, part.casefold()) for part in re.split(r"(\d+)", value) if part)


def snapshot_token(people: list[dict[str, Any]]) -> str:
    """WisKey `snapshot_token`: changes whenever a public record's revision changes (or one comes / goes)."""
    payload = sorted((p["id"], p["revision"]) for p in people)
    return hashlib.sha256(json.dumps(payload, ensure_ascii=True, separators=(",", ":")).encode()).hexdigest()[:24]


def query_users(people: list[dict[str, Any]], msg: dict[str, Any]) -> dict[str, Any] | None:
    """WisKey's `query_users` (access/user_directory.py) for a `users/query` frame; None = `invalid_fields`."""
    try:
        if set(msg) - {"id", "type", "query", "filters", "offset", "limit", "snapshot"}:
            raise _Invalid
        text = _text(msg.get("query", "")).casefold()
        raw = msg.get("filters")
        if not isinstance(raw, dict) or set(raw) - {"group", "profile", "station", "rights", "state", "credential", "sort"}:
            raise _Invalid
        f = {"group": _text(raw.get("group", ""), 128), "station": _text(raw.get("station", ""), 128), "rights": _text(raw.get("rights", ""), 32),
             "state": _text(raw.get("state", ""), 32), "credential": _text(raw.get("credential", ""), 32), "sort": _text(raw.get("sort", "employee"), 32)}
        profile = raw.get("profile", {})
        if not isinstance(profile, dict) or len(profile) > 32:
            raise _Invalid
        f["profile"] = {_text(k, 64): _text(v, 256) for k, v in profile.items() if _text(v, 256)}
        if f["rights"] not in {"", "assigned", "unassigned", "disabled"} or f["state"] not in {"", "active", "inactive", "expired", "upcoming"} \
                or f["credential"] not in {"", "pin", "no_pin", "card", "no_card"} or f["sort"] not in {"name", "name_desc", "employee"}:
            raise _Invalid
        offset, limit = msg.get("offset"), msg.get("limit")
        if type(offset) is not int or not 0 <= offset <= 10_000_000 or type(limit) is not int or not 1 <= limit <= 200:
            raise _Invalid
        requested = _text(msg.get("snapshot", ""), 64)
    except _Invalid:
        return None
    now = datetime.datetime.now(datetime.timezone.utc)
    digits = re.sub(r"\D", "", text)

    def matches(u: dict[str, Any]) -> bool:
        if f["group"] and f["group"] not in u["group_ids"]:
            return False
        if any(v and u["profile"].get(k) != v for k, v in f["profile"].items()):
            return False
        if text and text not in f"{u['display_name']} {u['employee_no']} {u['phone']}".casefold():
            phone = bool(re.fullmatch(r"[+0-9 ()-]+", text)) and len(digits) >= 3 and digits in re.sub(r"\D", "", u["phone"])
            card = len(text) == 4 and text.isdigit() and any(c["masked_number"].endswith(text) for c in u["cards"])
            if not phone and not card:
                return False
        assignments = u["assignments"]
        selected = [assignments[f["station"]]] if f["station"] and f["station"] in assignments else [] if f["station"] else list(assignments.values())
        if f["station"] and not f["rights"] and not selected:
            return False
        if f["rights"] == "assigned" and not any(a["enabled"] for a in selected):
            return False
        if f["rights"] == "unassigned" and selected:
            return False
        if f["rights"] == "disabled" and not any(not a["enabled"] for a in selected):
            return False
        if f["state"] == "active" and not u["active"] or f["state"] == "inactive" and u["active"]:
            return False
        if f["state"] == "expired" and (_instant(u["valid_until"]) is None or _instant(u["valid_until"]) > now):
            return False
        if f["state"] == "upcoming" and (_instant(u["valid_from"]) is None or _instant(u["valid_from"]) <= now):
            return False
        has_card = any(c["enabled"] for c in u["cards"])
        c = f["credential"]
        return not (c == "pin" and not u["pin_configured"] or c == "no_pin" and u["pin_configured"] or c == "card" and not has_card or c == "no_card" and has_card)

    rows = [u for u in people if matches(u)]
    if f["sort"] == "employee":
        rows.sort(key=lambda u: (_natural(u["employee_no"]), u["id"]))
    else:
        rows.sort(key=lambda u: u["id"])
        rows.sort(key=lambda u: u["display_name"].casefold(), reverse=f["sort"] == "name_desc")
    total = len(rows)
    effective = min(offset, ((total - 1) // limit) * limit) if total else 0
    current = snapshot_token(people)
    return {
        "records": copy.deepcopy(rows[effective:effective + limit]), "total": total, "total_all": len(people), "offset": effective, "limit": limit,
        "next_offset": effective + limit if effective + limit < total else None, "previous_offset": max(0, effective - limit) if effective else None,
        "snapshot": current, "stale": bool(requested and requested != current),
    }


class World:
    """The fake WisKey's state, shared by the fake socket (feed loop thread) and the control server (its own thread)."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.reset()
        self.fake: FakeHa | None = None
        self.loop: asyncio.AbstractEventLoop | None = None

    def reset(self) -> None:
        with self.lock:
            self.stations = initial_stations()
            self.unlock_mode = "accept"
            self.sent: list[dict[str, Any]] = []
            self.events = initial_events()
            self.added = 0
            self.events_delay = 0.0
            self.people = initial_people()

    def push_refresh(self) -> None:
        if self.fake is not None and self.loop is not None:
            self.loop.call_soon_threadsafe(self.fake.refresh)


def set_limits(values: dict[str, Any]) -> dict[str, Any]:
    """The /limits control (and /reset with no values): the given intercom_sync constants - the rest back to their
    defaults - and the read buckets reset, in the SMPLWISE backend running in this process."""
    from smplwise.services import intercom_sync  # imported here: the backend must not load before websockets.connect is replaced

    if not LIMIT_DEFAULTS:
        LIMIT_DEFAULTS.update({name: getattr(intercom_sync, name) for name in LIMIT_NAMES})
    for name, default in LIMIT_DEFAULTS.items():
        setattr(intercom_sync, name, type(default)(values.get(name.lower(), default)))
    intercom_sync.SYNC._buckets_reset()  # noqa: SLF001 - a test control over the in-process backend
    return {name: getattr(intercom_sync, name) for name in LIMIT_NAMES}


WORLD = World()


def ok(msg: dict[str, Any], result: Any = None) -> dict[str, Any]:
    return {"id": msg["id"], "type": "result", "success": True, "result": result}


def fail(msg: dict[str, Any], code: str) -> dict[str, Any]:
    return {"id": msg["id"], "type": "result", "success": False, "error": {"code": code, "message": code}}


class FakeHa:
    """Home Assistant's WebSocket API as `ha_client.ws_session` uses it (auth handshake, then result / event frames)."""

    def __init__(self) -> None:
        self.q: asyncio.Queue = asyncio.Queue()
        self.wiskey_sub: int | None = None
        WORLD.fake = self

    async def __aenter__(self) -> "FakeHa":
        WORLD.loop = asyncio.get_running_loop()
        self.q.put_nowait({"type": "auth_required", "ha_version": "2026.9.0"})
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    async def recv(self) -> str:
        return json.dumps(await self.q.get())

    def __aiter__(self) -> "FakeHa":
        return self

    async def __anext__(self) -> str:
        return json.dumps(await self.q.get())

    def push(self, frame: dict[str, Any]) -> None:
        self.q.put_nowait(frame)

    def refresh(self) -> None:
        if self.wiskey_sub is not None:
            self.push({"id": self.wiskey_sub, "type": "event", "event": {"kind": "refresh"}})

    async def send(self, raw: str) -> None:
        msg = json.loads(raw)
        kind = msg.get("type", "")
        if kind == "auth":
            self.push({"type": "auth_ok", "ha_version": "2026.9.0"})
            return
        with WORLD.lock:
            if kind.startswith("hikvision_intercom/"):
                WORLD.sent.append(msg)
            by_id = {s["id"]: s for s in WORLD.stations}
            if kind == "hikvision_intercom/overview":
                self.push(ok(msg, {"version": VERSION, "api": {"version": 1, "min_client": 0}, "default_zone": ZONE, "user_count": len(WORLD.people), "users": [], "stations": copy.deepcopy(WORLD.stations)}))
            elif kind == "hikvision_intercom/subscribe":
                self.wiskey_sub = msg["id"]
                self.push(ok(msg))
            elif kind == "hikvision_intercom/stations/test_unlock":
                if WORLD.unlock_mode == "unconfirmed":
                    self.push(fail(msg, "release_unconfirmed"))
                else:
                    self.push(ok(msg, {"accepted": True} if WORLD.unlock_mode == "accept" else {"queued": "maybe"}))
            elif kind == "hikvision_intercom/media/signal":
                s = by_id.get(msg.get("station_id"))
                want = "ringing" if msg.get("command") in ("answer", "reject") else "in_call"
                if s is None or not s["online"] or s["call_state"] != want:
                    self.push(fail(msg, "device_unavailable"))
                    return
                before = s["call_state"]
                s["call_state"] = "in_call" if msg["command"] == "answer" else "idle"
                self.push(ok(msg, {"command": msg["command"], "acknowledged": True, "physical_result": "unverified", "before_state": before, "observed_state": s["call_state"], "observation": "state_changed", "checked_at": "2026-09-27T08:01:00+00:00"}))
                asyncio.get_running_loop().call_later(0.3, self.refresh)
            elif kind == "hikvision_intercom/events/list":
                filters = msg.get("filters")
                page = query_events(WORLD.events, filters) if isinstance(filters, dict) and set(msg) == {"id", "type", "filters"} else None
                frame = ok(msg, page) if page is not None else fail(msg, "invalid_fields")
                if WORLD.events_delay:
                    asyncio.get_running_loop().call_later(WORLD.events_delay, self.push, frame)
                else:
                    self.push(frame)
            elif kind == "hikvision_intercom/users/query":
                page = query_users(WORLD.people, msg)
                self.push(ok(msg, page) if page is not None else fail(msg, "invalid_fields"))
            elif kind == "hikvision_intercom/users/get":
                match = next((p for p in WORLD.people if p["id"] == msg.get("user_id")), None) if set(msg) == {"id", "type", "user_id"} else None
                self.push(ok(msg, copy.deepcopy(match)) if match is not None else fail(msg, "user_not_found"))
            elif kind == "hikvision_intercom/tts/engines":
                self.push(ok(msg, copy.deepcopy(TTS_ENGINES)))
            elif kind == "hikvision_intercom/tts/start":
                self.push(ok(msg))
                fmt = {"format": "hikvision_intercom.tts"}
                loop = asyncio.get_running_loop()
                loop.call_later(0.4, self.push, {"id": msg["id"], "type": "event", "event": {**fmt, "state": "generating"}})
                loop.call_later(1.0, self.push, {"id": msg["id"], "type": "event", "event": {**fmt, "state": "speaking", "duration_seconds": 1.5, "packet_count": 15}})
                loop.call_later(2.5, self.push, {"id": msg["id"], "type": "event", "event": {**fmt, "state": "completed", "duration_seconds": 1.5, "bytes_written": 12000, "physical_result": "unverified"}})
            elif kind.startswith("hikvision_intercom/"):
                self.push(fail(msg, "unknown_command"))
            elif kind == "get_config":
                self.push(ok(msg, {"state": "RUNNING", "version": "2026.9.0", "components": []}))
            else:  # HA core commands SMPLWISE's other background services may send (states, registries, subscriptions)
                self.push(ok(msg, []))


def connect(url: str, **_kw: Any) -> FakeHa:
    if FAKE_HOST not in url:
        raise OSError(f"wiskey_fake_ha: refusing a connection to {url}")
    return FakeHa()


websockets.connect = connect  # type: ignore[assignment]


class Control(BaseHTTPRequestHandler):
    def _json(self, status: int, body: Any) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self) -> dict[str, Any]:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/sent":
            with WORLD.lock:
                return self._json(200, list(WORLD.sent))
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        body = self._body()
        if self.path == "/reset":
            WORLD.reset()
            set_limits({})  # the SMPLWISE backend's own search / rate constants back to their defaults, buckets full
            WORLD.push_refresh()
            return self._json(200, {"ok": True})
        if self.path == "/station":
            with WORLD.lock:
                s = next((x for x in WORLD.stations if x["id"] == body.get("id")), None)
                if s is None:
                    return self._json(404, {"error": "no_such_station"})
                s["call_state"] = str(body.get("call_state"))
            WORLD.push_refresh()
            return self._json(200, {"ok": True})
        if self.path == "/events/add":
            count = body.get("count")
            if type(count) is not int or not 1 <= count <= 50:
                return self._json(422, {"error": "count must be 1..50"})
            with WORLD.lock:
                newest = max(_instant(r["timestamp"]) for r in WORLD.events) if WORLD.events else EVENT_BASE
                for i in range(count):
                    WORLD.added += 1
                    WORLD.events.append(access_event(1000 + WORLD.added, newest + datetime.timedelta(minutes=i + 1)))
                # WisKey's overview carries each station's last access record: a new access event changes it, which is
                # what makes SMPLWISE's feed relay `intercom_refresh` to browsers (it relays only real changes)
                last = WORLD.events[-1]
                for s in WORLD.stations:
                    if s["id"] == last["station_id"] and s["online"]:
                        s["last_access"] = {k: last[k] for k in ("timestamp", "time_source", "person_name", "employee_no", "authentication", "result", "event_type", "recovered", "door")}
            WORLD.push_refresh()
            return self._json(200, {"ok": True})
        if self.path == "/events/delay":
            seconds = body.get("seconds")
            if not isinstance(seconds, (int, float)) or isinstance(seconds, bool) or not 0 <= seconds <= 10:
                return self._json(422, {"error": "seconds must be 0..10"})
            with WORLD.lock:
                WORLD.events_delay = float(seconds)
            return self._json(200, {"ok": True})
        if self.path == "/events/prune":
            keep = body.get("keep")
            if type(keep) is not int or keep < 0:
                return self._json(422, {"error": "keep must be >= 0"})
            with WORLD.lock:
                WORLD.events = sorted(WORLD.events, key=lambda r: (_instant(r["timestamp"]), r["id"]), reverse=True)[:keep]
            return self._json(200, {"ok": True})
        if self.path == "/people/touch":
            with WORLD.lock:
                p = next((x for x in WORLD.people if x["id"] == body.get("id")), None)
                if p is None:
                    return self._json(404, {"error": "no_such_person"})
                p["revision"] += 1
                p["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                # as in WisKey, an edited person's assignments go back to `pending` until the stations are reconciled,
                # and each such station's pending_user_count rises: that is what changes SMPLWISE's overview projection
                # and makes its feed relay `intercom_refresh` to browsers (it relays only real changes)
                for sid, a in p["assignments"].items():
                    a["desired_revision"] = p["revision"]
                    a["sync_state"] = "pending"
                    for s in WORLD.stations:
                        if s["id"] == sid:
                            s["pending_user_count"] += 1
            WORLD.push_refresh()
            return self._json(200, {"ok": True, "revision": p["revision"]})
        if self.path == "/people/remove":
            with WORLD.lock:
                p = next((x for x in WORLD.people if x["id"] == body.get("id")), None)
                if p is None:
                    return self._json(404, {"error": "no_such_person"})
                WORLD.people = [x for x in WORLD.people if x is not p]
                for sid in p["assignments"]:
                    for s in WORLD.stations:
                        if s["id"] == sid and s["managed_user_count"]:
                            s["managed_user_count"] -= 1
            if body.get("notify", True):
                WORLD.push_refresh()
            return self._json(200, {"ok": True})
        if self.path == "/limits":
            if set(body) - {"scan_page", "max_scan_pages", "user_burst", "user_rate"} or any(isinstance(v, bool) or not isinstance(v, (int, float)) or v < 0 for v in body.values()):
                return self._json(422, {"error": "scan_page, max_scan_pages, user_burst, user_rate: non-negative numbers"})
            return self._json(200, {"ok": True, "limits": set_limits(body)})
        if self.path == "/mode":
            if body.get("unlock") not in ("accept", "unexpected", "unconfirmed"):
                return self._json(422, {"error": "unlock must be accept, unexpected or unconfirmed"})
            with WORLD.lock:
                WORLD.unlock_mode = body["unlock"]
            return self._json(200, {"ok": True})
        self._json(404, {"error": "not_found"})

    def log_message(self, *_args: Any) -> None:
        pass


def main() -> None:
    port = int(os.environ.get("SW_WISKEY_CONTROL_PORT") or int(os.environ.get("SW_PORT", "8099")) + 10)
    server = ThreadingHTTPServer(("127.0.0.1", port), Control)
    threading.Thread(target=server.serve_forever, name="wiskey-fixture-control", daemon=True).start()
    print(f"wiskey_fake_ha: WisKey {VERSION} fixture; control API on http://127.0.0.1:{port}", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
