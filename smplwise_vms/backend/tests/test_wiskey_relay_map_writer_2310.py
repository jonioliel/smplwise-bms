"""WISKEY-RELAYMAP-2310: the production writer of the WisKey relay map (`wiskey_relay_map`).

Until this slice nothing in production wrote a row, so every emergency / door automation through the WisKey Native was refused
`relay_map_missing`. The writer is an explicit owner/operator approval per WisKey station (config entry id): for each api relay the
physical relay it drives, or "disabled". One station revision (`wiskey_relay_map_stations`, migration 0187) guards every save by CAS
(stale -> 409, nothing written); each save is audited (who, when, station, before / after); a change that touches a door with a door
automation needs a typed confirmation. One active row per (station, api_relay) and per (station, physical_relay); no row is invented.
The map is information for WisKey grants: nothing is sent to a station, a door or WisKey from this screen.

FAKES ONLY: a served WisKey copy from FakeWisKeyFeed; no Home Assistant, no WisKey, no station, no door."""
from __future__ import annotations

import json
from typing import Any

import pytest
from conftest import as_user, bind
from fake_trusted_bridge import FakeWisKeyFeed, station
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso
from smplwise.main import create_app
from smplwise.services import backup, intercom_sync
from smplwise.services import wiskey_feature_exec as fx
from smplwise.services import wiskey_relay_map as rm

API = "/api/v1"
URL = f"{API}/wiskey/relay-map"
ST = "01JRELAYMAPSTATIONENTRY000A"  # synthetic opaque config entry ids
ONE = "01JRELAYMAPSTATIONENTRY000B"


@pytest.fixture(autouse=True)
def _clean():
    intercom_sync.SYNC.reset()
    yield
    intercom_sync.SYNC.reset()


class World:
    def __init__(self, settings: Any, monkeypatch: Any) -> None:
        self.feed = FakeWisKeyFeed([station(ST, "כניסה ראשית", relays=[1, 2]), station(ONE, "דלת צד", relays=[1])]).install(monkeypatch)
        self.settings = settings
        self.c = TestClient(create_app(settings))
        self.db = Database(settings.db_path)
        self.c.get(f"{API}/me", headers=as_user("joni"))

    def get(self, user: str = "joni") -> Any:
        return self.c.get(URL, headers=as_user(user))

    def save(self, station_id: str, rows: list[tuple[int, int | None]], revision: int, user: str = "joni", **extra: Any) -> Any:
        body = {"expected_revision": revision, "rows": [{"api_relay": a, "physical_relay": p} for a, p in rows], "confirmed": True, **extra}
        return self.c.put(f"{URL}/{station_id}", json=body, headers=as_user(user))

    def table(self) -> list[tuple[Any, ...]]:
        with self.db.connection() as conn:
            return [tuple(r) for r in conn.execute("SELECT station_id, api_relay, physical_relay, revision, active FROM wiskey_relay_map ORDER BY station_id, api_relay")]

    def audits(self) -> list[dict[str, Any]]:
        with self.db.connection() as conn:
            rows = conn.execute("SELECT * FROM audit_log WHERE action = 'wiskey.relay_map.approved' AND decision = 'allowed' ORDER BY rowid").fetchall()
            return [dict(r) for r in rows]

    def automate(self, station_id: str, relay: int) -> None:
        policy = {"doors": [{"station_id": station_id, "relay": relay}]}
        with self.db.connection() as conn:
            conn.execute("INSERT INTO door_automations(id, automation_item_id, name, state, policy_json, policy_revision, created_by, created_at, updated_at) "
                         "VALUES (?,?,?,?,?,?,?,?,?)", (f"da_{station_id[-4:]}{relay}", "auto_x", "פתיחה בבוקר", "draft", json.dumps(policy), 1, "dev-joni", now_iso(), now_iso()))


@pytest.fixture()
def w(settings, monkeypatch) -> World:
    return World(settings, monkeypatch)


def _station(body: dict[str, Any], station_id: str) -> dict[str, Any]:
    return next(s for s in body["stations"] if s["id"] == station_id)


# ================================================================ read

def test_the_screen_lists_each_station_with_its_api_relays_and_revision_zero_before_any_approval(w):
    r = w.get()
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["can_edit"] is True and body["has_copy"] is True
    s = _station(body, ST)
    assert s["name"] == "כניסה ראשית" and s["revision"] == 0 and s["approved_at"] is None
    assert [x["physical_index"] for x in s["relays"]] == [1, 2]
    assert [(x["api_relay"], x["physical_relay"], x["active"]) for x in s["rows"]] == [(1, None, False), (2, None, False)]
    assert w.table() == [], "reading invents no row"


def test_a_site_admin_sees_the_map_read_only_and_cannot_save(w):
    bind(w.c, w.settings, "dana", "site_admin", "installation", "*")
    r = w.get("dana")
    assert r.status_code == 200 and r.json()["can_edit"] is False
    assert w.save(ST, [(1, 1), (2, 2)], 0, user="dana").status_code == 403
    assert w.table() == []


def test_an_operator_sees_nothing(w):
    bind(w.c, w.settings, "otto", "operator", "installation", "*")
    assert w.get("otto").status_code == 403
    assert w.save(ST, [(1, 1), (2, 2)], 0, user="otto").status_code == 403
    assert w.table() == []


# ================================================================ save: CAS, rows, audit

def test_an_approval_writes_the_rows_advances_the_station_revision_and_is_audited(w):
    r = w.save(ST, [(1, 2), (2, 1)], 0)
    assert r.status_code == 200, r.text
    assert r.json()["revision"] == 1
    assert w.table() == [(ST, 1, 2, 1, 1), (ST, 2, 1, 1, 1)]
    s = _station(w.get().json(), ST)
    assert s["revision"] == 1 and s["approved_at"] and s["approved_by"]
    (a,) = w.audits()
    details = json.loads(a["details_json"])
    assert a["resource_id"] == ST and a["decision"] == "allowed"
    assert details["revision_before"] == 0 and details["revision"] == 1
    assert details["before"] == [{"api_relay": 1, "physical_relay": None}, {"api_relay": 2, "physical_relay": None}]
    assert details["after"] == [{"api_relay": 1, "physical_relay": 2}, {"api_relay": 2, "physical_relay": 1}]


def test_a_stale_revision_is_refused_409_and_nothing_is_written(w):
    assert w.save(ST, [(1, 1), (2, 2)], 0).status_code == 200
    before = w.table()
    r = w.save(ST, [(1, 2), (2, 1)], 0)
    assert r.status_code == 409 and r.json()["code"] == "revision_conflict"
    assert w.table() == before and len(w.audits()) == 1
    assert w.save(ST, [(1, 2), (2, 1)], 1).json()["revision"] == 2


def test_two_api_relays_on_one_physical_relay_are_refused(w):
    r = w.save(ST, [(1, 1), (2, 1)], 0)
    assert r.status_code == 422 and r.json()["code"] == "relay_map_duplicate_physical"
    assert w.table() == [] and w.audits() == []


def test_an_api_relay_listed_twice_or_missing_is_refused(w):
    assert w.save(ST, [(1, 1), (1, 2)], 0).status_code == 422
    assert w.save(ST, [(1, 1)], 0).status_code == 422
    assert w.table() == []


def test_a_physical_relay_the_station_does_not_have_is_refused(w):
    r = w.save(ONE, [(1, 2), (2, None)], 0)
    assert r.status_code == 422 and r.json()["code"] == "relay_map_unknown_relay"
    assert w.table() == []


def test_an_unknown_station_is_404(w):
    assert w.save("01JNOSUCHSTATION0000000000", [(1, 1), (2, None)], 0).status_code == 404


def test_disabling_an_api_relay_without_a_row_invents_no_row(w):
    r = w.save(ONE, [(1, 1), (2, None)], 0)
    assert r.status_code == 200, r.text
    assert w.table() == [(ONE, 1, 1, 1, 1)], "api relay 2 had no row and gets none"


def test_disabling_a_mapped_api_relay_deactivates_its_row(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    assert w.save(ST, [(1, 1), (2, None)], 1).status_code == 200
    assert w.table() == [(ST, 1, 1, 1, 1), (ST, 2, 2, 2, 0)], "unchanged row keeps its revision; the disabled one is kept inactive"


def test_a_save_without_a_change_is_refused_and_does_not_advance(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    r = w.save(ST, [(1, 1), (2, 2)], 1)
    assert r.status_code == 422 and r.json()["code"] == "relay_map_unchanged"
    assert _station(w.get().json(), ST)["revision"] == 1


def test_a_swap_is_one_atomic_save(w):
    w.save(ST, [(1, 1), (2, 2)], 0)
    assert w.save(ST, [(1, 2), (2, 1)], 1).status_code == 200
    assert w.table() == [(ST, 1, 2, 2, 1), (ST, 2, 1, 2, 1)]


def test_the_explicit_confirmation_is_required(w):
    r = w.c.put(f"{URL}/{ST}", json={"expected_revision": 0, "rows": [{"api_relay": 1, "physical_relay": 1}, {"api_relay": 2, "physical_relay": 2}]},
                headers=as_user("joni"))
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    assert w.table() == []


# ================================================================ typed confirmation for a door with automations

def test_a_change_that_touches_an_automated_door_needs_the_typed_word(w):
    w.automate(ST, 2)
    assert _station(w.get().json(), ST)["automated_relays"] == [2]
    r = w.save(ST, [(1, 2), (2, None)], 0)
    assert r.status_code == 422 and r.json()["code"] == "confirm_required" and r.json()["details"]["doors"] == [2]
    assert w.table() == []
    assert w.save(ST, [(1, 2), (2, None)], 0, confirm_text="לא").status_code == 422
    r = w.save(ST, [(1, 2), (2, None)], 0, confirm_text=rm.CONFIRM_WORD)
    assert r.status_code == 200, r.text
    assert json.loads(w.audits()[0]["details_json"])["automated_doors"] == [2]


def test_a_change_on_other_doors_needs_no_typed_word(w):
    w.automate(ST, 2)
    assert w.save(ST, [(1, 1), (2, None)], 0).status_code == 200


# ================================================================ the consumers

def test_a_saved_map_makes_the_door_lookup_resolve_and_feeds_the_policy(w):
    w.save(ST, [(1, 2), (2, 1)], 0)
    with w.db.connection() as conn:
        assert fx.relay_row_for_door(conn, ST, 1) == fx.RelayRow(ST, 2, 1, 1)
        assert fx.relay_row_for_door(conn, ST, 2) == fx.RelayRow(ST, 1, 2, 1)
        assert fx.relay_row(conn, ST, 2) == fx.RelayRow(ST, 2, 1, 1)


def test_an_incomplete_map_keeps_refusing_the_unmapped_door(w):
    w.save(ST, [(1, 1), (2, None)], 0)
    with w.db.connection() as conn:
        assert fx.relay_row_for_door(conn, ST, 1) == fx.RelayRow(ST, 1, 1, 1)
        assert fx.relay_row_for_door(conn, ST, 2) is None, "physical relay 2 has no active row: still relay_map_missing"
        assert fx.relay_row(conn, ST, 2) is None


def test_the_service_refuses_a_stale_revision_without_writing(w):
    with w.db.connection() as conn:
        rm.save(conn, station_id=ST, rows={1: 1, 2: 2}, expected_revision=0, by="dev-joni", known_relays=[1, 2])
    with pytest.raises(rm.RelayMapError) as e, w.db.connection() as conn:
        rm.save(conn, station_id=ST, rows={1: 2, 2: 1}, expected_revision=0, by="dev-joni", known_relays=[1, 2])
    assert e.value.code == "revision_conflict"
    assert w.table() == [(ST, 1, 1, 1, 1), (ST, 2, 2, 1, 1)]


def test_the_station_revision_table_never_travels_in_a_backup():
    assert "wiskey_relay_map_stations" in backup.NEVER_EXPORTED_TABLES
