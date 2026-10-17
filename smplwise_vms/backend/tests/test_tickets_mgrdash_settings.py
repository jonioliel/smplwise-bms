"""MGRDASH phase 1 (owner decisions 2026-10-17): the manager overview's display settings in `tickets.settings.ui` - who sees a handler's
own numbers, where vendors go in the load card, the per-department "busy" threshold (default 8) and where the department comparison sits.
Negative first: the values outside the allow-lists are refused (422) and never stored, only system.configure writes them, a corrupt stored
value reads as the default; then the defaults and the round trip through GET /tickets/module (every signed-in user of the module) and
GET /tickets/board (the managers)."""
from __future__ import annotations

import json

import pytest

from smplwise.db import Database
from smplwise.services.tickets import settings_doc
from tickets_world import API, build


@pytest.fixture()
def w(settings):
    return build(settings)


def doc(w) -> dict:
    r = w.c.get(f"{API}/tickets/settings")
    assert r.status_code == 200, r.text
    return r.json()


def put_ui(w, ui: dict, headers: dict | None = None):
    return w.c.put(f"{API}/tickets/settings", json={"revision": doc(w)["revision"], "ui": ui}, headers=headers or {})


# ---------------------------------------------------------------- refusals

@pytest.mark.parametrize("ui", [
    {"dash_handler_numbers": "all"},
    {"dash_handler_numbers": ""},
    {"dash_vendors": "none"},
    {"dash_busy": 0},
    {"dash_busy": 100},
    {"dash_busy": "8"},
    {"dash_busy": True},
    {"dash_busy": 8.0},
    {"dash_busy_departments": {"maint": 0}},
    {"dash_busy_departments": {"maint": 100}},
    {"dash_busy_departments": {"maint": "8"}},
    {"dash_busy_departments": {"bad key!": 8}},
    {"dash_busy_departments": {"": 8}},
    {"dash_busy_departments": ["maint", 8]},
    {"dash_compare": "side"},
    {"dash_unknown": "x"},
])
def test_values_outside_the_allow_lists_are_refused_and_not_stored(w, ui):
    before = doc(w)
    r = put_ui(w, ui)
    assert r.status_code == 422, r.text
    assert doc(w) == before


def test_too_many_department_thresholds_are_refused(w):
    big = {f"d{i}": 5 for i in range(settings_doc.BUSY_MAP_MAX + 1)}
    assert put_ui(w, {"dash_busy_departments": big}).status_code == 422
    assert doc(w)["ui"]["dash_busy_departments"] == {}


@pytest.mark.parametrize("user", ["mona", "tom", "nora"])
def test_only_system_configure_writes_them(w, user):
    r = put_ui(w, {"dash_busy": 5}, headers=w.h(user))
    assert r.status_code == 403
    assert doc(w)["ui"]["dash_busy"] == 8


def test_a_corrupt_stored_value_reads_as_the_default(w):
    with Database(w.settings.db_path).connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                     (settings_doc.SETTING_KEY, json.dumps({"revision": 3, "ui": {"dash_busy": 500, "dash_vendors": "x", "dash_busy_departments": {"a": -1},
                                                                                   "dash_handler_numbers": 7, "dash_compare": None}})))
    ui = doc(w)["ui"]
    assert ui["dash_busy"] == 8 and ui["dash_vendors"] == "tagged" and ui["dash_busy_departments"] == {}
    assert ui["dash_handler_numbers"] == "own" and ui["dash_compare"] == "below_numbers"


# ---------------------------------------------------------------- defaults and the round trip

def test_the_defaults_are_the_owner_decisions(w):
    ui = doc(w)["ui"]
    assert ui["dash_handler_numbers"] == "own"  # option b: each handler sees his own numbers
    assert ui["dash_vendors"] == "tagged"  # vendors in the same list with a tag
    assert ui["dash_busy"] == 8  # busy at 8 open requests
    assert ui["dash_busy_departments"] == {}
    assert ui["dash_compare"] == "below_numbers"  # the comparison under the numbers row (option a)


def test_saved_values_reach_the_module_and_the_board(w):
    r = put_ui(w, {"dash_handler_numbers": "managers", "dash_vendors": "separate", "dash_busy": 5,
                   "dash_busy_departments": {"maint": 12, "clean": 3}, "dash_compare": "bottom"})
    assert r.status_code == 200, r.text
    ui = r.json()["ui"]
    assert ui["dash_busy_departments"] == {"maint": 12, "clean": 3} and ui["dash_busy"] == 5
    mod = w.c.get(f"{API}/tickets/module", headers=w.h("tom")).json()["ui"]
    assert mod["dash_handler_numbers"] == "managers" and mod["dash_vendors"] == "separate" and mod["dash_compare"] == "bottom"
    board = w.c.get(f"{API}/tickets/board", headers=w.h("mona"))
    assert board.status_code == 200 and board.json()["ui"]["dash_busy"] == 5


def test_the_department_thresholds_can_be_cleared(w):
    assert put_ui(w, {"dash_busy_departments": {"maint": 12}}).status_code == 200
    assert put_ui(w, {"dash_busy_departments": {}}).status_code == 200
    assert doc(w)["ui"]["dash_busy_departments"] == {}


def test_the_change_is_audited_with_the_changed_keys(w):
    assert put_ui(w, {"dash_busy": 6}).status_code == 200
    with Database(w.settings.db_path).connection() as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'tickets.settings.update' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row is not None and "ui.dash_busy" in json.loads(row[0])["changed"]


def test_the_settings_do_not_open_the_board_to_a_handler(w):
    # "everyone" is a display choice: the manager board (and its numbers) stay closed to a handler
    assert put_ui(w, {"dash_handler_numbers": "everyone"}).status_code == 200
    assert w.c.get(f"{API}/tickets/board", headers=w.h("tom")).status_code == 403
    assert w.c.get(f"{API}/tickets/handler-load", headers=w.h("tom")).status_code == 403
