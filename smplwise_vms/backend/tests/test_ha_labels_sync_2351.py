"""HA-LABELS-SYNC-2351: the home system's label registry and the labels of its areas reach Arx through the same registry refresh as
floors / areas (CR-007), are stored in the mirror (migration 0192) and are read - read-only - by the mapping assistant's GET route, so the
"בתווית" rules and label conflicts work on a real site.

The real HaSync session runs against the fake Home Assistant of test_ha_structure_refresh (extended with a label registry and area labels):
the listing, the event-driven refresh (`label_registry_updated`, `area_registry_updated`), deletion, an idempotent resync, an old core
without labels, and that no HA call is made while a write transaction is open."""
from __future__ import annotations

import copy
import threading
from typing import Any

from conftest import seed_tree
from fastapi.testclient import TestClient
from test_ha_structure_refresh import FakeHa, _ok, app_s, fast, notices, registry_event, run_session  # noqa: F401 - fixtures

from smplwise.services import ha_sync

API = "/api/v1"

LABELS = [
    {"label_id": "bldg_a", "name": "בניין א", "color": "indigo", "icon": "mdi:office-building", "description": None, "created_at": 0, "modified_at": 0},
    {"label_id": "shared", "name": "משותף", "color": None, "icon": None, "description": "parking and lobby", "created_at": 0, "modified_at": 0},
    {"label_id": "night", "name": "לילה", "color": "blue", "icon": None, "description": None, "created_at": 0, "modified_at": 0},
]


class LabelHa(FakeHa):
    """FakeHa with a label registry and labels on its areas (HA 2024.4+ shape: area entries carry `labels` = label ids)."""

    def __init__(self) -> None:
        super().__init__()
        self.labels = copy.deepcopy(LABELS)
        tags = {"office": ["bldg_a"], "lobby": ["shared", "bldg_a"], "garden": []}
        for a in self.areas:
            a["labels"] = list(tags.get(a["area_id"], []))
        self.during_tx: list[tuple[str, int]] = []  # (call, write transactions open at that moment)

    async def call(self, msg_type: str, **kw: Any) -> dict[str, Any]:
        self.during_tx.append((msg_type, OPEN_TX[0]))
        if msg_type == "config/label_registry/list" and msg_type not in self.fail:
            self.calls.append(msg_type)
            return _ok(copy.deepcopy(self.labels))
        return await super().call(msg_type, **kw)

    def area(self, area_id: str) -> dict[str, Any]:
        return next(a for a in self.areas if a["area_id"] == area_id)


OPEN_TX = [0]
OPENED = [0]  # write transactions opened in all (proves the counter is wired)
_tx_lock = threading.Lock()


def _count_write_transactions(monkeypatch, db) -> None:
    """Wrap the database's connection() so every open write transaction is counted (the fake HA records the count at each call)."""
    real = db.connection

    from contextlib import contextmanager

    @contextmanager
    def counted(mode: str = "write", *a: Any, **kw: Any):
        if mode == "read":
            with real(mode, *a, **kw) as conn:
                yield conn
            return
        with real(mode, *a, **kw) as conn:
            with _tx_lock:
                OPEN_TX[0] += 1
                OPENED[0] += 1
            try:
                yield conn
            finally:
                with _tx_lock:
                    OPEN_TX[0] -= 1

    monkeypatch.setattr(db, "connection", counted)


def _mirror(app) -> tuple[list[tuple], list[tuple], str | None]:
    with app.state.db.connection(mode="read") as conn:
        labels = [tuple(r) for r in conn.execute("SELECT label_id, name, color, icon, description, position FROM ha_labels ORDER BY position").fetchall()]
        area_labels = [tuple(r) for r in conn.execute("SELECT area_id, label_id, position FROM ha_area_labels ORDER BY area_id, position").fetchall()]
        synced = conn.execute("SELECT synced_at FROM ha_label_sync WHERE id = 1").fetchone()[0]
    return labels, area_labels, synced


def _read(c: TestClient, site: str) -> dict[str, Any]:
    r = c.get(f"{API}/sites/{site}/mapping")
    assert r.status_code == 200, r.text
    return r.json()["items"]


def test_labels_and_area_assignments_are_listed_stored_and_read_by_the_assistant(app_s, monkeypatch):
    app, s = app_s
    c = TestClient(app)
    site = seed_tree(c)["site"]
    items0 = _read(c, site)
    assert items0["labels"] == [] and items0["labels_synced_at"] is None  # never listed yet
    fake = LabelHa()

    async def script(on_event, on_message, settle):
        await settle(1)

    run_session(app, s, fake, script, monkeypatch)
    assert "label_registry_updated" in fake.subscribed and "label_registry_updated" in ha_sync.REGISTRY_EVENTS
    labels, area_labels, synced = _mirror(app)
    assert [lb[:2] for lb in labels] == [("bldg_a", "בניין א"), ("shared", "משותף"), ("night", "לילה")]
    assert labels[0][2:4] == ("indigo", "mdi:office-building") and labels[1][4] == "parking and lobby"
    assert area_labels == [("lobby", "shared", 0), ("lobby", "bldg_a", 1), ("office", "bldg_a", 0)]
    assert synced
    items = _read(c, site)
    by_area = {a["id"]: a["labels"] for a in items["areas"]}
    assert by_area["lobby"] == ["משותף", "בניין א"]  # names, in the area's own order
    assert by_area["office"] == ["בניין א"] and by_area["garden"] == [] and by_area["empty_room"] == []
    assert {lb["id"]: lb["areas"] for lb in items["labels"]} == {"bldg_a": 2, "shared": 1, "night": 0}
    assert items["labels"][0] == {"id": "bldg_a", "name": "בניין א", "color": "indigo", "icon": "mdi:office-building", "areas": 2}
    assert items["labels_synced_at"] == synced


def test_an_assignment_change_and_a_rename_arrive_by_registry_events(app_s, monkeypatch):
    app, s = app_s
    c = TestClient(app)
    site = seed_tree(c)["site"]
    fake = LabelHa()
    seen: dict[str, Any] = {}

    async def script(on_event, on_message, settle):
        await settle(1)
        fake.area("garden")["labels"] = ["night"]
        fake.area("lobby")["labels"] = ["shared"]
        on_message(registry_event("area_registry_updated", action="update", area_id="garden"))
        await settle(2)
        seen["after_area"] = {a["id"]: a["labels"] for a in _read(c, site)["areas"]}
        fake.labels[0]["name"] = "מגדל א"
        on_message(registry_event("label_registry_updated", action="update", label_id="bldg_a"))
        await settle(3)
        seen["after_label"] = {a["id"]: a["labels"] for a in _read(c, site)["areas"]}

    _, msgs = run_session(app, s, fake, script, monkeypatch)
    assert seen["after_area"]["garden"] == ["לילה"] and seen["after_area"]["lobby"] == ["משותף"]
    assert seen["after_label"]["office"] == ["מגדל א"]
    n = notices(msgs)
    assert [m["reason"] for m in n] == ["area_registry_updated", "label_registry_updated"] and all(m["changed"] for m in n)


def test_a_deleted_label_leaves_the_catalogue_and_every_area(app_s, monkeypatch):
    app, s = app_s
    c = TestClient(app)
    site = seed_tree(c)["site"]
    fake = LabelHa()
    seen: dict[str, Any] = {}

    async def script(on_event, on_message, settle):
        await settle(1)
        # HA deletes the label; its own area registry drops it from the areas a moment later - here the area event comes FIRST missing,
        # so for one refresh an area still names the deleted id: it is kept in the mirror and skipped on read
        fake.labels = [lb for lb in fake.labels if lb["label_id"] != "bldg_a"]
        on_message(registry_event("label_registry_updated", action="remove", label_id="bldg_a"))
        await settle(2)
        seen["between"] = _read(c, site)
        for a in fake.areas:
            a["labels"] = [x for x in a["labels"] if x != "bldg_a"]
        on_message(registry_event("area_registry_updated", action="update", area_id="lobby"))
        await settle(3)

    run_session(app, s, fake, script, monkeypatch)
    assert "bldg_a" not in {lb["id"] for lb in seen["between"]["labels"]}
    assert {a["id"]: a["labels"] for a in seen["between"]["areas"]}["lobby"] == ["משותף"]  # the stale id is skipped on read
    labels, area_labels, _ = _mirror(app)
    assert {lb[0] for lb in labels} == {"shared", "night"}
    assert area_labels == [("lobby", "shared", 0)]
    assert {a["id"]: a["labels"] for a in _read(c, site)["areas"]}["office"] == []


def test_a_resync_with_nothing_changed_is_idempotent(app_s, monkeypatch):
    app, s = app_s
    fake = LabelHa()
    seen: dict[str, Any] = {}

    async def script(on_event, on_message, settle):
        await settle(1)
        seen["first"] = _mirror(app)[:2]
        on_message(registry_event("label_registry_updated", action="update", label_id="night"))
        await settle(2)
        seen["second"] = _mirror(app)[:2]

    sync, msgs = run_session(app, s, fake, script, monkeypatch)
    assert seen["first"] == seen["second"]
    assert sync._last_done is not None and sync._last_done[1] is False  # the refresh ran and said "no change"
    assert notices(msgs) == []


def test_an_old_core_without_labels_keeps_the_previous_label_mirror(app_s, monkeypatch):
    app, s = app_s
    c = TestClient(app)
    site = seed_tree(c)["site"]
    fake = LabelHa()

    async def script(on_event, on_message, settle):
        await settle(1)
        fake.fail.add("config/label_registry/list")  # refused (unknown command on an old core, or a transient error)
        fake.area("garden")["labels"] = ["night"]
        on_message(registry_event("area_registry_updated", action="update", area_id="garden"))
        await settle(2)

    run_session(app, s, fake, script, monkeypatch)
    labels, area_labels, _ = _mirror(app)
    assert {lb[0] for lb in labels} == {"bldg_a", "shared", "night"}  # not wiped by a failed listing
    assert ("garden", "night", 0) in area_labels  # the area listing itself still answered
    assert {a["id"]: a["labels"] for a in _read(c, site)["areas"]}["garden"] == ["לילה"]


def test_no_home_system_call_is_made_inside_a_write_transaction(app_s, monkeypatch):
    app, s = app_s
    _count_write_transactions(monkeypatch, app.state.db)
    OPENED[0] = 0
    fake = LabelHa()

    async def script(on_event, on_message, settle):
        await settle(1)
        fake.labels.append({"label_id": "b", "name": "בניין ב", "color": None, "icon": None, "description": None})
        on_message(registry_event("label_registry_updated", action="create", label_id="b"))
        await settle(2)

    run_session(app, s, fake, script, monkeypatch)
    listings = [(t, n) for t, n in fake.during_tx if t.startswith("config/")]
    assert sum(1 for t, _ in listings if t == "config/label_registry/list") == 2
    assert all(n == 0 for _, n in listings), listings
    assert OPENED[0] >= 4  # the mirror writes did go through the counted connection (two refreshes, several transactions each)
    assert ("b", "בניין ב") in [lb[:2] for lb in _mirror(app)[0]]


def test_apply_structure_keeps_the_label_mirror_when_labels_are_not_given(app_s):
    app, s = app_s
    c = TestClient(app)
    site = seed_tree(c)["site"]
    with app.state.db.connection() as conn:
        ha_sync.apply_structure(conn, [{"area_id": "hall", "name": "א · לובי", "floor_id": None, "labels": ["a"]}], [], [{"label_id": "a", "name": "בניין א"}])
    assert {a["id"]: a["labels"] for a in _read(c, site)["areas"]} == {"hall": ["בניין א"]}
    with app.state.db.connection() as conn:
        ha_sync.apply_structure(conn, [{"area_id": "hall", "name": "א · לובי", "floor_id": None, "labels": ["a"]}], [])  # labels omitted: kept
    assert {a["id"]: a["labels"] for a in _read(c, site)["areas"]} == {"hall": ["בניין א"]}
    with app.state.db.connection() as conn:
        ha_sync.apply_structure(conn, [{"area_id": "hall", "name": "א · לובי", "floor_id": None}], [])  # an area entry with no labels key
    assert {a["id"]: a["labels"] for a in _read(c, site)["areas"]} == {"hall": []}
