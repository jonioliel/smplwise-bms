"""T068 long soak harness (tests/soak/soak_long.py + soak_long_backend.py).

Fast checks always run (pure helpers, the fake go2rtc and the fake Home Assistant + WisKey over real local sockets, ~2 s).
The short end-to-end run of the whole harness (backend process, fakes, clients, CSV) is opt-in, like the other soaks:

    SW_SOAK=1 python -m pytest tests/test_soak_long.py -s -p no:cacheprovider
    (SW_SOAK_LONG_MIN: minutes of load, default 1.5)
"""
from __future__ import annotations

import asyncio
import csv
import json
import os
import sys
from pathlib import Path

import pytest

SOAK = Path(__file__).resolve().parent / "soak"
if str(SOAK) not in sys.path:
    sys.path.insert(0, str(SOAK))

import soak_long  # noqa: E402
import soak_long_backend  # noqa: E402


def test_summaries_and_kinds() -> None:
    assert soak_long_backend.summarize_ms([])["p50_ms"] is None
    s = soak_long_backend.summarize_ms(sorted([0.001 * i for i in range(1, 101)]))
    assert s["n"] == 100 and s["max_ms"] == 100.0 and 49 <= s["p50_ms"] <= 51 and 94 <= s["p95_ms"] <= 96 and 98 <= s["p99_ms"] <= 100
    assert soak_long.pct([], 0.5) is None and soak_long.pct([1.0, 2.0, 3.0], 0.95) == 3.0
    assert soak_long_backend.ws_kind("/api/v1/media/live/cam1/ws") == "live"
    assert soak_long_backend.ws_kind("/api/v1/events/ws") == "events"
    assert soak_long_backend.ws_kind("/api/v1/me/ws") == "other"
    assert len(soak_long.CSV_HEADER) == len(set(soak_long.CSV_HEADER))
    for col in ("rss_mb", "cpu_pct", "fds", "db_bytes", "wal_bytes", "loop_lag_p99_ms", "ws_live_open", "ws_events_open", "live_sessions",
                "api_p50_ms", "api_p95_ms", "err_5xx", "err_total_cum"):
        assert col in soak_long.CSV_HEADER


def test_lag_monitor_window_is_taken_and_cleared() -> None:
    lag = soak_long_backend.LagMonitor(period=0.01)

    async def go() -> None:
        task = asyncio.create_task(lag.run())
        await asyncio.sleep(0.15)
        task.cancel()

    asyncio.run(go())
    first = lag.take()
    assert first["n"] >= 3 and first["max_ms"] is not None
    assert lag.take()["n"] == 0


def test_metrics_window_and_expected_codes() -> None:
    m = soak_long.Metrics()
    m.record("cameras", 0.010, 200)
    m.record("cameras", 0.030, 500)
    m.record("export_create", 0.020, 507)  # expected backpressure answer: not an error
    m.record("me", 0.020, 404)
    m.client_error("me", TimeoutError())
    w = m.take()
    assert (w["n"], w["5xx"], w["4xx"], w["client"]) == (4, 1, 1, 1)
    assert w["max"] == 30.0
    assert m.take()["n"] == 0 and m.cum["5xx"] == 1


def test_fake_go2rtc_registry_and_media_socket() -> None:
    import httpx
    from websockets.sync.client import connect

    g2 = soak_long.FakeGo2rtc()
    g2.start()
    try:
        base = f"http://127.0.0.1:{g2.port}"
        assert httpx.put(base + "/api/streams", params={"name": "smplwise_x", "src": "rtsp://127.0.0.1/x"}).status_code == 200
        assert "smplwise_x" in httpx.get(base + "/api/streams").json()
        assert httpx.get(base + "/api/streams", params={"src": "nope"}).status_code == 404
        with connect(f"ws://127.0.0.1:{g2.port}/api/ws?src=smplwise_x", open_timeout=5) as ws:
            ws.send(json.dumps({"type": "mse", "value": "avc1.640029"}))
            assert json.loads(ws.recv(timeout=5))["type"] == "mse"
            assert isinstance(ws.recv(timeout=5), bytes)
        assert httpx.delete(base + "/api/streams", params={"src": "smplwise_x"}).status_code == 200
        assert g2.streams == {}
    finally:
        g2.stop()


def test_fake_ha_serves_many_entities_and_wiskey() -> None:
    from websockets.sync.client import connect

    ha = soak_long.FakeHaWiskey(rate=50, sensors=40)
    ha.start()
    try:
        with connect(f"ws://127.0.0.1:{ha.port}", open_timeout=5) as ws:
            assert json.loads(ws.recv(timeout=5))["type"] == "auth_required"
            ws.send(json.dumps({"type": "auth", "access_token": "soak-token"}))
            assert json.loads(ws.recv(timeout=5))["type"] == "auth_ok"
            ws.send(json.dumps({"id": 1, "type": "get_states"}))
            assert len(json.loads(ws.recv(timeout=5))["result"]) == 80
            ws.send(json.dumps({"id": 2, "type": "hikvision_intercom/no_such_command"}))
            answer = json.loads(ws.recv(timeout=5))
            assert answer["id"] == 2 and answer["success"] is False and answer["error"]["code"] == "unknown_command"
            ws.send(json.dumps({"id": 3, "type": "subscribe_events", "event_type": "state_changed"}))
            seen = [json.loads(ws.recv(timeout=5)) for _ in range(4)]
            assert any(f.get("type") == "event" for f in seen)
        assert ha.wiskey_frames == 1 and len(ha.wiskey.received) <= 200
    finally:
        ha.stop()
        ha.close()


@pytest.mark.skipif(os.environ.get("SW_SOAK") != "1", reason="opt-in soak (SW_SOAK=1)")
def test_short_soak_run(tmp_path: Path) -> None:
    minutes = float(os.environ.get("SW_SOAK_LONG_MIN", "1.5"))
    rc = soak_long.main(["--run-dir", str(tmp_path), "--minutes", str(minutes), "--interval", "10", "--nvr-every", "25", "--ha-every", "35",
                         "--go2rtc-every", "45", "--ha-sensors", "100", "--viewers", "2", "--event-sockets", "2", "--operators", "3"])
    summary = json.loads((tmp_path / "summary.json").read_text(encoding="utf-8"))
    assert rc == 0 and summary["reason"] == "duration", summary["reason"]
    rows = list(csv.DictReader(open(tmp_path / "samples.csv", encoding="utf-8")))
    assert len(rows) >= max(3, int(minutes * 6) - 2), len(rows)
    for col in ("rss_mb", "cpu_pct", "threads", "fds", "db_bytes", "wal_bytes", "loop_lag_p99_ms", "api_p50_ms", "api_p95_ms"):
        assert any(r[col] not in ("", None) for r in rows), col
    assert all(r["err_5xx"] == "0" for r in rows), [r["err_5xx"] for r in rows]
    assert "stats_unavailable" not in " ".join(r["note"] for r in rows)
    last = rows[-1]
    assert int(last["live_opened_cum"]) + int(last["live_failed_cum"]) >= 1
    assert int(last["events_ws_connects_cum"]) >= 2
    assert int(last["fake_restarts_cum"]) >= 1
    assert summary["fakes"]["go2rtc"].get("ws_accepted", 0) >= 1
    assert summary["fakes"]["wiskey_frames"] >= 1
    assert not summary["stuck_client_threads"]
    assert summary["client_cumulative"].get("5xx", 0) == 0
