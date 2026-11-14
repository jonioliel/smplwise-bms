"""TK259 - `public.theme` (light / dark / auto, default light): stored and validated like the neighbouring public.* settings, changeable
from a remote session too (it is a look, not an address), and handed to the vendor page in the ticket view (also on the code screen)."""
from __future__ import annotations

import time

import pytest

from smplwise.routers import tickets_admin
from tickets_s4_world import API, Clock, build_s4


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def view_theme(s4, token) -> str:
    client, _ = s4.public(Clock(time.time()))
    r = client.get("/t/api/ticket", headers={"x-ticket-token": token})
    assert r.status_code == 200, r.text
    return r.json()["theme"]


def put_theme(s4, value):
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    return s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"theme": value}})


def test_the_default_is_light_and_the_page_gets_it(s4):
    assert s4.c.get(f"{API}/tickets/settings").json()["public"]["theme"] == "light"
    _t, token = s4.sent()
    assert view_theme(s4, token) == "light"


@pytest.mark.parametrize("value", ["dark", "auto", "light"])
def test_each_mode_is_saved_and_reaches_the_page(s4, value):
    _t, token = s4.sent()
    r = put_theme(s4, value)
    assert r.status_code == 200, r.text
    assert r.json()["public"]["theme"] == value
    assert view_theme(s4, token) == value


def test_an_unknown_mode_is_refused(s4):
    for bad in ("blue", "", "DARK"):
        assert put_theme(s4, bad).status_code == 422
    assert s4.c.get(f"{API}/tickets/settings").json()["public"]["theme"] == "light"


def test_the_theme_may_be_changed_from_a_remote_session_but_the_address_may_not(s4, monkeypatch):
    monkeypatch.setattr(tickets_admin, "is_remote", lambda request: True)
    assert put_theme(s4, "dark").status_code == 200
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"base_url": "https://t-x.example.org", "theme": "auto"}})
    assert r.status_code == 403 and r.json()["code"] == "local_only"


def test_the_code_screen_carries_the_theme_too(s4):
    _t, token = s4.sent()
    assert put_theme(s4, "dark").status_code == 200
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_links SET require_code = 1")
    assert view_theme(s4, token) == "dark"
