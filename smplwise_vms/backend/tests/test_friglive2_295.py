"""FRIGLIVE2-295: what the live run on the owner's Frigate 0.18.0 (2026-10-22) found, fixed and pinned (CR-FRIGATE-LIVE-0180-REPORT section 8).

(a) the FIRST recorder (`nvr-1`) added as Frigate after the start answered a misleading 404 `not_found` instead of 409
    `recorder_pending_restart`: the process runs `nvr-1` with the start-up connection (default vendor, a placeholder host on a developer
    backend), so "no host" was the wrong test.
(b) a Frigate `viewer` account reads everything Arx uses EXCEPT `/api/recordings/storage` (403): the storage view names the usage as
    unavailable (`role_limited`) instead of failing the whole request with 503 `source_forbidden`.
(c) `/api/profile/active` is admin-only too: a 403 on that fallback leaves the active profile unknown instead of failing the read.
Fake Frigate / stubs only; nothing here talks to a real server.
"""
from __future__ import annotations

import dataclasses
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from smplwise.errors import ApiError
from smplwise.services.recorders import frigate_control as fc
from smplwise.services.recorders import frigate_http as fh
from smplwise.services.recorders import frigate_io

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)

NOW = "2026-10-22T00:00:00Z"


def _store_frigate_row(w: World, rid: str) -> None:
    with w.app.state.db.connection() as conn:
        conn.execute("INSERT INTO recorder_connections(recorder_id, vendor, host, http_port, username, password_enc, enabled, source, updated_at) "
                      "VALUES (?, 'frigate', 'frigate-1.test', 8971, 'u', 'x', 1, 'ui', ?) "
                      "ON CONFLICT(recorder_id) DO UPDATE SET vendor = 'frigate', host = 'frigate-1.test', enabled = 1", (rid, NOW))


# ---------------------------------------------------------------------------------------------- (a) the first recorder, stored after the start

@pytest.mark.parametrize("host", ["nvr-placeholder.test", "hik-nvr.test", ""])
def test_the_first_recorder_stored_as_frigate_after_the_start_answers_pending_restart(world, host):
    """The process still runs nvr-1 with the start-up connection (the default vendor): a Frigate row for nvr-1 waits for the restart."""
    _store_frigate_row(world, "nvr-1")
    started_as = dataclasses.replace(world.s, nvr_vendor="hikvision", nvr_host=host or None)
    with world.app.state.db.connection(mode="read") as conn, pytest.raises(ApiError) as ei:
        frigate_io.adapter_for(conn, started_as, "nvr-1")
    assert ei.value.status == 409 and ei.value.code == "recorder_pending_restart"
    assert ei.value.details["restart_required"] is True and ei.value.retryable is True


def test_a_loaded_frigate_first_recorder_is_served(world):
    _store_frigate_row(world, "nvr-1")
    with world.app.state.db.connection(mode="read") as conn:
        assert frigate_io.adapter_for(conn, world.s, "nvr-1").recorder_id == "nvr-1"
    assert world.call("GET", f"{BASE}/status").status_code == 200


def test_a_hikvision_first_recorder_is_still_not_a_frigate_one(world):
    """No stored Frigate row: another vendor's recorder id keeps the 404 of these routes (nothing pending)."""
    with world.app.state.db.connection() as conn:
        conn.execute("DELETE FROM recorder_connections WHERE recorder_id = 'nvr-1'")
    started_as = dataclasses.replace(world.s, nvr_vendor="hikvision", nvr_host="nvr-placeholder.test")
    with world.app.state.db.connection(mode="read") as conn, pytest.raises(ApiError) as ei:
        frigate_io.adapter_for(conn, started_as, "nvr-1")
    assert ei.value.code == "not_found"


# ---------------------------------------------------------------------------------------------- (b) storage with a viewer account

def test_storage_with_a_viewer_account_names_the_usage_unavailable(world):
    world.fake.viewer_blocks = {"/api/recordings/storage"}
    r = world.call("GET", f"{BASE}/storage")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["cameras"] == [] and d["usage_unavailable"] == "role_limited"
    assert d["policy"] == "motion", "the parts a viewer may read are still served"


def test_storage_with_an_admin_account_has_no_unavailable_part(world):
    d = world.call("GET", f"{BASE}/storage").json()
    assert d["usage_unavailable"] is None and {c["key"] for c in d["cameras"]} >= {"cam_front"}


def test_storage_still_fails_when_the_session_itself_is_refused(world, monkeypatch):
    from smplwise.services.recorders import frigate as fr

    def refused(self):
        raise fh.forbidden("/api/recordings/storage", 401)

    monkeypatch.setattr(fr.FrigateAdapter, "storage_usage", refused)
    r = world.call("GET", f"{BASE}/storage")
    assert r.status_code == 503 and r.json()["code"] == "source_forbidden"


# ---------------------------------------------------------------------------------------------- (c) the active-profile fallback

class _Http:
    def __init__(self, status: int):
        self.status = status

    def get_json(self, path, *a, **kw):
        if path == "/api/profiles":
            return [{"name": "away"}, {"name": "home"}]  # a document without `active_profile`: the fallback is read
        raise fh.forbidden(path, self.status)


def test_a_viewer_403_on_the_active_profile_fallback_leaves_it_unknown():
    out = fc.FrigateControl(SimpleNamespace(http=_Http(403))).active_profile()
    assert out == {"names": ["away", "home"], "active": None}


def test_a_401_on_the_active_profile_fallback_still_fails():
    with pytest.raises(ApiError) as ei:
        fc.FrigateControl(SimpleNamespace(http=_Http(401))).active_profile()
    assert ei.value.code == "source_forbidden"
