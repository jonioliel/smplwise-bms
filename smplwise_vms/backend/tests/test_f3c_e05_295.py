"""F3C-295 E-05: a duplicate client_request_id that races the pre-check (UNIQUE constraint of 0137) answers 409 duplicate_request, not 500."""
from __future__ import annotations

import sqlite3
import uuid

import pytest
from fake_doorwin_adapters import ProductWorld

from smplwise.services import door_emergency as de


@pytest.fixture()
def pw(settings, monkeypatch):
    w = ProductWorld(settings, monkeypatch, go_live=True)
    w.emergency_on()
    return w


def _start(pw):
    p = pw.post("/doors/emergency/prepare", action="start", kind="lock_secure", scope_type="installation", scope_id="*", drill=False)
    assert p.status_code == 200
    return pw.post("/doors/emergency/incidents", confirm_token=p.json()["confirm_token"], confirmed=True, reason="", client_request_id=str(uuid.uuid4()))


def test_the_raced_unique_constraint_is_a_409(pw, monkeypatch):
    def boom(*a, **k):
        raise sqlite3.IntegrityError("UNIQUE constraint failed: door_emergency_incidents.request_id")

    monkeypatch.setattr(de, "start", boom)
    r = _start(pw)
    assert r.status_code == 409 and r.json()["code"] == "duplicate_request"
    assert pw.rows("SELECT COUNT(*) AS n FROM door_emergency_incidents")[0]["n"] == 0


def test_another_integrity_error_is_not_swallowed(pw, monkeypatch):
    def boom(*a, **k):
        raise sqlite3.IntegrityError("NOT NULL constraint failed: door_emergency_incidents.kind")

    monkeypatch.setattr(de, "start", boom)
    with pytest.raises(sqlite3.IntegrityError):
        _start(pw)
