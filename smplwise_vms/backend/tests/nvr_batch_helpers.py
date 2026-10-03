"""Shared helpers of the CR-020 S2C batch tests (test_nvr_stream_batch*.py): the fake NVR with five channels - mains 1-4
H.264 with SVC on, main 5 H.265 - an app on it, and small request / polling helpers. Fakes only: no real device."""
from __future__ import annotations

import json
import time

import httpx
import pytest
from fastapi.testclient import TestClient
from test_nvr_stream_write import SECRETS, audits, camera_ids, ready, rows, stream, with_nvr  # noqa: F401 - re-exported

from smplwise.main import create_app
from smplwise.services import nvr_batch

CHANNELS = 5


def setup_fake(f, channels: int = CHANNELS) -> None:
    f.nvr["channels"] = channels
    f.nvr["encodings"] = {"main": {"codec": "H.264", "svc": True, "width": 2560, "height": 1440, "bitrate_kbps": 3072, "quality": 60, "fps": 25, "bitrate_mode": "VBR", "profile": "High"},
                          "sub": {"codec": "H.264", "svc": None, "width": 640, "height": 360, "bitrate_kbps": 512, "bitrate_mode": "CBR", "fps": 20, "profile": "Baseline"}}
    f.nvr["encodings_by_channel"] = {5: {"main": {"codec": "H.265", "svc": True, "profile": "Main"}}} if channels >= 5 else {}
    f.nvr["arrived"] = 0

    def arrived(request) -> None:  # counts a PUT when it ARRIVES (before put_hold_s), so a test acts while it is held
        with f.lock:
            f.nvr["arrived"] += 1

    f.nvr["on_put"] = arrived


@pytest.fixture()
def fast_unknown(monkeypatch):
    monkeypatch.setattr(nvr_batch, "UNKNOWN_CHECK_DELAY_S", 0.0)


def make_app(settings, channels: int = CHANNELS):
    return create_app(with_nvr(settings))


def tgt(c: TestClient, cid: str, ref: str, headers: dict | None = None) -> dict:
    return {"camera_id": cid, "stream_ref": ref, "if_match": stream(c, cid, ref, headers)["etag"]}


def targets(c: TestClient, ids: dict[int, str], chans, headers: dict | None = None) -> list[dict]:
    return [tgt(c, ids[ch], f"{ch}01", headers) for ch in chans]


def start(c: TestClient, tg: list[dict], headers: dict | None = None, **body) -> httpx.Response:
    payload = {"confirm": True, "changes": {"svc": False}, "targets": tg, **body}
    return c.post("/api/v1/nvr/stream-batches", json=payload, headers=headers or {})


def wait_done(c: TestClient, bid: str, headers: dict | None = None, timeout: float = 30.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        assert nvr_batch.wait_idle(timeout)
        r = c.get(f"/api/v1/nvr/stream-batches/{bid}", headers=headers or {})
        assert r.status_code == 200, r.text
        body = r.json()
        if body["state"] != "running":
            return body
        time.sleep(0.02)
    raise AssertionError("the batch did not end")


def wait_put(fake, n: int, timeout: float = 10.0) -> None:
    deadline = time.monotonic() + timeout
    while fake.nvr.get("arrived", 0) < n and time.monotonic() < deadline:
        time.sleep(0.005)
    assert fake.nvr.get("arrived", 0) >= n, "the PUT never arrived"


def puts(fake) -> list[str]:
    return [w.rsplit("/", 1)[-1] for w in fake.writes if w.startswith("nvr PUT")]


def batch_rows(app, bid: str) -> list[dict]:
    return rows(app, "SELECT * FROM nvr_changes WHERE batch_id = ? ORDER BY batch_index", bid)


def statuses(body: dict) -> list[tuple[str, str | None]]:
    return [(i["status"], i["error_code"]) for i in body["items"]]


def details(a: dict) -> dict:
    return json.loads(a["details_json"])


def device_svc(fake, ch: int) -> bool | None:
    return fake._encoding(ch, "main").get("svc")
