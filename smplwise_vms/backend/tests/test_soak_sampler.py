"""scripts/soak: the read-only soak sampler and its analyzer, against fake HTTP responses (no network, no device)."""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import pytest

SOAK = Path(__file__).resolve().parents[3] / "scripts" / "soak"
sys.path.insert(0, str(SOAK))
import analyze_soak as an  # noqa: E402
import soak_sampler as ss  # noqa: E402

T0 = 1_790_000_000.0
MIB = 1048576


def sample_once(c, f, st, now):
    return ss.sample_once(c, f, st, now, getattr(f, "sup", None))


def run(c, f, **kw):
    return ss.run(c, f, sup=getattr(f, "sup", None), **kw)


def cfg(tmp_path: Path, **kw) -> ss.Config:
    base = dict(ha_url="http://ha.invalid:8123", ha_token="TOKEN-SECRET", slug="slug_x", addon_url="http://addon.invalid:8099",
                interval_s=60.0, logs_every=2, out=tmp_path / "soak.csv")
    base.update(kw)
    return ss.Config(**base)


class Fake:
    """Routes by URL suffix; records every request so the one-GET-per-endpoint budget can be asserted."""

    def __init__(self, mem_mib=150.0, version="2.2.0", state="started", holds=100, accepted=10, fail=()):
        self.mem, self.version, self.state, self.holds, self.accepted, self.fail = mem_mib, version, state, holds, accepted, set(fail)
        self.calls: list[str] = []
        self.sup_calls: list[list[str]] = []
        self.headers: list[dict[str, str]] = []

    def sup(self, endpoints: list[str]) -> list[ss.SupResult]:
        """The supervisor reads (one WebSocket connection in production), in the order add-on stats, info, core stats."""
        self.sup_calls.append(list(endpoints))
        if any("ha.invalid" in f for f in self.fail):
            return [ss.SupResult(False, error="ws_ConnectError") for _ in endpoints]
        return [
            ss.SupResult(True, {"cpu_percent": 0.5, "memory_usage": int(self.mem * MIB), "memory_percent": 3.0}),
            ss.SupResult(True, {"state": self.state, "version": self.version}),
            ss.SupResult(True, {"cpu_percent": 1.0, "memory_percent": 3.5}),
        ]

    def __call__(self, url: str, headers: dict[str, str]) -> ss.Fetched:
        self.calls.append(url)
        self.headers.append(headers)
        for f in self.fail:
            if f in url:
                return ss.Fetched(None, None, b"", "ConnectError")
        ok = lambda o: ss.Fetched(200, 5.0, json.dumps(o).encode())  # noqa: E731
        if url.endswith("/stats") and "/addons/" in url:
            return ok({"result": "ok", "data": {"cpu_percent": 0.5, "memory_usage": int(self.mem * MIB), "memory_percent": 3.0}})
        if url.endswith("/info"):
            return ok({"result": "ok", "data": {"state": self.state, "version": self.version}})
        if url.endswith("/core/stats"):
            return ok({"result": "ok", "data": {"cpu_percent": 1.0, "memory_percent": 3.5}})
        if "/logs" in url:
            return ss.Fetched(200, 9.0, b"x INFO a\nx ERROR b\nx WARNING c\nTraceback (most recent)\nApplication startup complete\n")
        if url.endswith("/healthz"):
            return ok({"status": "ok"})
        if url.endswith("/health/summary"):
            return ok({"status": "ok", "items": []})
        if url.endswith("/health"):
            return ok({
                "nvr_configured": True, "go2rtc_configured": True,
                "db": {"ok": True, "write_lock": {"holds": self.holds, "busy_errors": 0, "gate_timeouts": 0, "waits_over_1s": 0, "max_wait_recent_s": 0.01}},
                "discovery": {"cameras": 12, "cameras_last_error": None, "streams_last_error": None},
                "events": {"ingest": {"connected": True}}, "home_assistant": {"connected": True},
                "backpressure": {"data_disk": {"free_mb": 5000}, "ingest_queue": {"accepted": self.accepted, "dropped": 0, "failed": 0, "depth": 1},
                                 "exports": {"waiting": 0, "paused_disk_full": 0}},
            })
        return ss.Fetched(404, 1.0, b"", "http_404")


def test_one_get_per_endpoint_per_sample_and_row_content(tmp_path):
    c, f, st = cfg(tmp_path), Fake(), ss.State()
    rows = sample_once(c, f, st, T0)
    assert len(rows) == 1
    r = rows[0]
    assert len(f.calls) == 4  # 3 add-on + 1 log read (first sample); the supervisor reads go through the WebSocket
    assert len({u.split("?")[0] for u in f.calls}) == 4  # strictly one request per endpoint
    assert f.sup_calls == [["/addons/slug_x/stats", "/addons/slug_x/info", "/core/stats"]]
    assert r["addon_mem_mib"] == 150.0 and r["cameras"] == 12 and r["nvr_reachable"] == 1 and r["go2rtc_reachable"] == 1
    assert r["lat_health_ms"] == 5.0 and r["http_health"] == 200 and r["lock_holds"] == 100 and r["data_disk_free_mb"] == 5000
    assert r["log_errors"] == 1 and r["log_tracebacks"] == 1 and r["log_starts"] == 1
    assert r["threads"] is None and r["open_fds"] is None and r["db_bytes"] is None  # not exposed today
    assert r["restart"] == 0 and r["error"] == ""
    sample_once(c, f, st, T0 + 60)
    assert not any("/logs" in u for u in f.calls[4:])  # logs_every=2: the second sample skips the log read


def test_tokens_only_in_headers_never_in_rows(tmp_path):
    c, f = cfg(tmp_path, addon_token="ADDON-SECRET"), Fake()
    rows = sample_once(c, f, ss.State(), T0)
    assert all("SECRET" not in str(v) and "invalid" not in str(v) for v in rows[0].values())
    assert any(h.get("Authorization") == "Bearer ADDON-SECRET" for h in f.headers)
    assert all(h.get("Authorization", "").startswith("Bearer ") for h in f.headers if "Authorization" in h)
    assert all(u.startswith(("http://ha.invalid", "http://addon.invalid")) for u in f.calls)
    assert not any("/stats" in u or "/info" in u or "/core/" in u for u in f.calls)


def test_no_addon_url_skips_addon_endpoints(tmp_path):
    f = Fake()
    rows = sample_once(cfg(tmp_path, addon_url=""), f, ss.State(), T0)
    assert not any("addon.invalid" in u for u in f.calls)
    assert rows[0].get("lat_health_ms") is None and rows[0]["addon_mem_mib"] == 150.0


def test_network_loss_records_error_and_continues(tmp_path):
    f = Fake(fail=("addon.invalid",))
    r = sample_once(cfg(tmp_path), f, ss.State(), T0)[0]
    assert "addon_health:ConnectError" in r["error"] and r["http_health"] == 0 and r["addon_mem_mib"] == 150.0
    r = sample_once(cfg(tmp_path), Fake(fail=("ha.invalid",)), ss.State(), T0)[0]
    assert "sup_stats:ws_ConnectError" in r["error"] and r["addon_mem_mib"] is None and r["http_health"] == 200


def test_gap_marked_after_sleep_or_outage(tmp_path):
    c, f, st = cfg(tmp_path), Fake(), ss.State()
    sample_once(c, f, st, T0)
    rows = sample_once(c, f, st, T0 + 3600)
    assert [r["event"] for r in rows] == ["gap", "sample"] and rows[0]["gap_s"] == 3600.0
    assert [r["event"] for r in sample_once(c, f, st, T0 + 3660)] == ["sample"]


def test_restart_detection(tmp_path):
    c, st = cfg(tmp_path), ss.State()
    sample_once(c, Fake(), st, T0)
    assert sample_once(c, Fake(holds=100, accepted=10), st, T0 + 60)[-1]["restart"] == 0
    r = sample_once(c, Fake(holds=3, accepted=0), st, T0 + 120)[-1]
    assert r["restart"] == 1 and "counter_reset:lock_holds" in r["restart_reason"]
    r = sample_once(c, Fake(holds=50, accepted=5, version="2.3.0"), st, T0 + 180)[-1]
    assert "version_change" in r["restart_reason"]
    sample_once(c, Fake(holds=60, accepted=6, version="2.3.0", state="stopped"), st, T0 + 240)
    r = sample_once(c, Fake(holds=70, accepted=7, version="2.3.0", state="started"), st, T0 + 300)[-1]
    assert "state_back_to_started" in r["restart_reason"]
    st2 = ss.State()
    a = {"uptime_s": 500.0}
    assert ss.detect_restart(st2, a) == "" and ss.detect_restart(st2, {"uptime_s": 5.0}) == "uptime_reset"


def test_csv_header_once_atomic_append_and_torn_line(tmp_path):
    p = tmp_path / "d" / "o.csv"
    ss.append_rows(p, [{"at_utc": "x", "seq": 1, "event": "sample"}])
    ss.append_rows(p, [{"at_utc": "y", "seq": 2, "event": "sample"}])
    lines = p.read_text(encoding="utf-8").splitlines()
    assert lines[0] == ",".join(ss.HEADER) and len(lines) == 3
    with p.open("ab") as fh:
        fh.write(b"torn,partial")  # a killed process left no newline
    ss.append_rows(p, [{"at_utc": "z", "seq": 3, "event": "sample"}])
    rows = list(csv.reader(p.open(encoding="utf-8")))
    assert rows[-1][0] == "z" and rows[-2][0] == "torn"
    p.write_text("a,b\n1,2\n", encoding="utf-8")
    with pytest.raises(ss.ConfigError):
        ss.append_rows(p, [{"at_utc": "q"}])


def test_run_duration_resume_and_stop(tmp_path):
    c = cfg(tmp_path, duration_h=0.5, interval_s=600.0)
    now = {"t": T0}
    sleeps: list[float] = []

    def sleep(s):
        sleeps.append(s)
        now["t"] += s

    n = run(c, Fake(), clock=lambda: now["t"], sleep=sleep)
    assert n == 3  # t=0, 600, 1200; 1800 s reaches the end
    ev = [r["event"] for r in csv.DictReader(c.out.open(encoding="utf-8"))]
    assert ev[0] == "start" and ev[-1] == "stop" and ev.count("sample") == 3
    now["t"] += 7200  # a second run appends to the same file (resume after a stop)
    run(cfg(tmp_path, duration_h=0.0, interval_s=600.0), Fake(), clock=lambda: now["t"], sleep=sleep, max_samples=1)
    assert sum(1 for _ in csv.DictReader(c.out.open(encoding="utf-8"))) == 3 + 2 + 1 + 1 + 1  # +start/stop, +start, sample, stop


def test_sleep_inside_loop_marks_gap_without_burst(tmp_path):
    c = cfg(tmp_path, interval_s=60.0)
    now = {"t": T0}

    def sleep(s):
        now["t"] += s
        if now["t"] >= T0 + 60 and not now.get("slept"):
            now["slept"] = True
            now["t"] += 5 * 3600  # the machine slept five hours

    run(c, Fake(), clock=lambda: now["t"], sleep=sleep, max_samples=3)
    ev = [r["event"] for r in csv.DictReader(c.out.open(encoding="utf-8"))]
    assert ev.count("gap") == 1 and ev.count("sample") == 3


def test_validate_and_check_never_prints_secrets(tmp_path, capsys, monkeypatch):
    assert any("HA_TOKEN" in p for p in ss.validate_config(cfg(tmp_path, ha_token="")))
    assert any("interval" in p for p in ss.validate_config(cfg(tmp_path, interval_s=1)))
    assert ss.validate_config(cfg(tmp_path)) == []
    envf = tmp_path / "lab.env"
    envf.write_text("HA_URL=http://host.invalid:8123\nHA_TOKEN=SUPERSECRET\nSOAK_ADDON_SLUG=abc_slug\n", encoding="utf-8")
    for k in ("HA_URL", "HA_TOKEN", "SOAK_ADDON_SLUG", "SOAK_ADDON_URL", "SOAK_ADDON_TOKEN"):
        monkeypatch.delenv(k, raising=False)
    rc = ss.main(["--check", "--env-file", str(envf), "--out", str(tmp_path / "o.csv")])
    out = capsys.readouterr().out
    assert rc == 0 and "RESULT: OK" in out and "SUPERSECRET" not in out and "host.invalid" not in out and "abc_slug" not in out
    assert not (tmp_path / "o.csv").exists()  # --check does not sample or write
    monkeypatch.setenv("HA_TOKEN", "")
    rc = ss.main(["--check", "--env-file", str(tmp_path / "missing.env"), "--out", str(tmp_path / "o.csv")])
    assert rc == 2 and "INVALID" in capsys.readouterr().out


# ----------------------------------------------------------------------------------------------- WebSocket supervisor reads

class FakeHaWs:
    """Local in-process fake of the HA WebSocket API (stdlib sockets, one thread per connection).
    mode: ok | auth_invalid | http401 | drop_after_auth | drop_after_first | hang | bad_json | cmd_error"""

    ANSWERS = {
        "/addons/slug_x/stats": {"cpu_percent": 0.5, "memory_usage": 150 * MIB, "memory_percent": 3.0},
        "/addons/slug_x/info": {"state": "started", "version": "2.2.1"},
        "/core/stats": {"cpu_percent": 1.0, "memory_percent": 3.5},
    }

    def __init__(self, mode="ok"):
        import socket
        import threading
        self.mode, self.connections, self.commands, self.auth_tokens = mode, 0, [], []
        self.srv = socket.socket()
        self.srv.bind(("127.0.0.1", 0))
        self.srv.listen(8)
        self.port = self.srv.getsockname()[1]
        self.t = threading.Thread(target=self._serve, daemon=True)
        self.t.start()

    def close(self):
        self.srv.close()

    def _serve(self):
        import threading
        while True:
            try:
                conn, _ = self.srv.accept()
            except OSError:
                return
            self.connections += 1
            threading.Thread(target=self._conn, args=(conn,), daemon=True).start()

    @staticmethod
    def _exact(conn, n):
        buf = b""
        while len(buf) < n:
            c = conn.recv(n - len(buf))
            if not c:
                raise EOFError
            buf += c
        return buf

    def _read(self, conn):
        b0, b1 = self._exact(conn, 2)
        n = b1 & 0x7F
        if n == 126:
            n = int.from_bytes(self._exact(conn, 2), "big")
        mask = self._exact(conn, 4) if b1 & 0x80 else b"\0\0\0\0"
        data = bytes(b ^ mask[i % 4] for i, b in enumerate(self._exact(conn, n)))
        return json.loads(data.decode())

    @staticmethod
    def _send(conn, obj, raw=None):
        data = raw if raw is not None else json.dumps(obj).encode()
        if len(data) < 126:
            hdr = bytes([0x81, len(data)])
        else:
            hdr = bytes([0x81, 126]) + len(data).to_bytes(2, "big")
        conn.sendall(hdr + data)

    def _conn(self, conn):
        import base64
        import hashlib
        import time
        try:
            conn.settimeout(15)
            head = b""
            while b"\r\n\r\n" not in head:
                head += conn.recv(4096)
            if self.mode == "http401":
                conn.sendall(b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                return
            key = [ln.split(b":", 1)[1].strip() for ln in head.split(b"\r\n") if ln.lower().startswith(b"sec-websocket-key")][0]
            acc = base64.b64encode(hashlib.sha1(key + b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest())
            conn.sendall(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acc + b"\r\n\r\n")
            self._send(conn, {"type": "auth_required", "ha_version": "x"})
            auth = self._read(conn)
            self.auth_tokens.append(auth.get("access_token"))
            if self.mode == "auth_invalid":
                self._send(conn, {"type": "auth_invalid", "message": "Invalid access token"})
                return
            self._send(conn, {"type": "auth_ok"})
            if self.mode == "drop_after_auth":
                return
            for k in range(3):
                cmd = self._read(conn)
                self.commands.append(cmd)
                if self.mode == "hang":
                    time.sleep(5)
                    return
                if self.mode == "bad_json":
                    self._send(conn, None, raw=b"not json{")
                    return
                if self.mode == "cmd_error" and k == 1:
                    self._send(conn, {"id": cmd["id"], "type": "result", "success": False, "error": {"code": "unknown_error", "message": "x"}})
                    continue
                self._send(conn, {"id": cmd["id"], "type": "result", "success": True, "result": self.ANSWERS[cmd["endpoint"]]})
                if self.mode == "drop_after_first":
                    return
        except (EOFError, OSError, ValueError):
            pass
        finally:
            conn.close()


def _ws_impls():
    impls = [pytest.param(ss.ws_fetch_stdlib, id="stdlib")]
    try:
        import websockets  # noqa: F401
        impls.append(pytest.param(ss.ws_fetch_websockets, id="websockets"))
    except ImportError:
        pass
    return impls


EPS = ["/addons/slug_x/stats", "/addons/slug_x/info", "/core/stats"]


@pytest.fixture
def ws_srv():
    made = []

    def make(mode="ok"):
        s = FakeHaWs(mode)
        made.append(s)
        return s

    yield make
    for s in made:
        s.close()


@pytest.mark.parametrize("impl", _ws_impls())
def test_ws_three_answers_in_order_one_connection(tmp_path, ws_srv, impl):
    srv = ws_srv()
    res = impl(cfg(tmp_path, ha_url=f"http://127.0.0.1:{srv.port}"), EPS)
    assert [r.ok for r in res] == [True, True, True]
    assert res[0].data["memory_usage"] == 150 * MIB and res[1].data["state"] == "started" and res[2].data["memory_percent"] == 3.5
    assert [c["endpoint"] for c in srv.commands] == EPS and all(c["type"] == "supervisor/api" and c["method"] == "get" for c in srv.commands)
    assert [c["id"] for c in srv.commands] == [2, 3, 4] and srv.auth_tokens == ["TOKEN-SECRET"] and srv.connections == 1


@pytest.mark.parametrize("impl", _ws_impls())
@pytest.mark.parametrize("mode,err", [
    ("auth_invalid", "ws_auth_failed"), ("http401", None), ("drop_after_auth", None), ("bad_json", "ws_bad_reply"),
])
def test_ws_failures_fail_every_endpoint_with_a_named_error(tmp_path, ws_srv, impl, mode, err):
    srv = ws_srv(mode)
    res = impl(cfg(tmp_path, ha_url=f"http://127.0.0.1:{srv.port}"), EPS)
    assert len(res) == 3 and not any(r.ok for r in res)
    assert all(r.error.startswith("ws_") for r in res)
    if err:
        assert {r.error for r in res} == {err}
    assert len({r.error for r in res}) == 1


@pytest.mark.parametrize("impl", _ws_impls())
def test_ws_connection_dropped_midway_keeps_the_answers_already_read(tmp_path, ws_srv, impl):
    srv = ws_srv("drop_after_first")
    res = impl(cfg(tmp_path, ha_url=f"http://127.0.0.1:{srv.port}"), EPS)
    assert [r.ok for r in res] == [True, False, False] and res[0].data["cpu_percent"] == 0.5 and res[1].error.startswith("ws_")


@pytest.mark.parametrize("impl", _ws_impls())
def test_ws_command_error_fails_only_that_endpoint(tmp_path, ws_srv, impl):
    res = impl(cfg(tmp_path, ha_url=f"http://127.0.0.1:{ws_srv('cmd_error').port}"), EPS)
    assert [r.ok for r in res] == [True, False, True] and res[1].error == "ws_result:unknown_error"


@pytest.mark.parametrize("impl", _ws_impls())
def test_ws_refused_and_bad_url(tmp_path, impl):
    import socket
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()  # nothing listens here any more
    res = impl(cfg(tmp_path, ha_url=f"http://127.0.0.1:{port}"), EPS)
    assert len(res) == 3 and all(not r.ok and r.error.startswith("ws_") for r in res)
    res = impl(cfg(tmp_path, ha_url="ftp://x"), EPS)
    assert {r.error for r in res} == {"ws_unavailable:bad_url"}


@pytest.mark.parametrize("impl", _ws_impls())
def test_ws_hang_times_out(tmp_path, ws_srv, impl, monkeypatch):
    monkeypatch.setattr(ss, "WS_TIMEOUT_S", 0.5)
    res = impl(cfg(tmp_path, ha_url=f"http://127.0.0.1:{ws_srv('hang').port}"), EPS)
    assert not any(r.ok for r in res) and {r.error for r in res} == {"ws_timeout"}


def test_ws_url_scheme_mapping():
    assert ss.ws_url("http://h:8123") == "ws://h:8123/api/websocket"
    assert ss.ws_url("https://h/") == "wss://h/api/websocket"
    with pytest.raises(ValueError):
        ss.ws_url("h:8123")


def test_sample_through_a_real_ws_server_and_error_column(tmp_path, ws_srv):
    """End to end: the production supervisor fetcher, a fake HA, the log tail still over (fake) REST, header unchanged."""
    srv = ws_srv()
    c = cfg(tmp_path, ha_url=f"http://127.0.0.1:{srv.port}")
    f = Fake()
    r = ss.sample_once(c, f, ss.State(), T0, ss.make_supervisor(c))[0]
    assert r["addon_mem_mib"] == 150.0 and r["state"] == "started" and r["version"] == "2.2.1" and r["core_cpu_pct"] == 1.0
    assert r["log_errors"] == 1 and r["error"] == "" and any("/logs?lines=" in u for u in f.calls)
    assert srv.connections == 1
    bad = ws_srv("auth_invalid")
    c2 = cfg(tmp_path, ha_url=f"http://127.0.0.1:{bad.port}")
    r = ss.sample_once(c2, Fake(), ss.State(), T0, ss.make_supervisor(c2))[0]
    assert r["error"] == "sup_stats:ws_auth_failed;sup_info:ws_auth_failed;sup_core:ws_auth_failed"
    assert r["addon_mem_mib"] is None and r["http_health"] == 200 and r["log_errors"] == 1
    assert "TOKEN-SECRET" not in str(r.values())


def test_stdlib_fallback_chosen_when_websockets_missing(tmp_path, monkeypatch):
    import builtins
    real = builtins.__import__

    def fake_import(name, *a, **k):
        if name == "websockets":
            raise ImportError(name)
        return real(name, *a, **k)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    seen = []
    monkeypatch.setattr(ss, "ws_fetch_stdlib", lambda c, e: seen.append("stdlib") or [])
    ss.make_supervisor(cfg(tmp_path))(EPS)
    assert seen == ["stdlib"]


def test_header_unchanged_so_existing_files_resume():
    assert ss.HEADER[:4] == ["at_utc", "seq", "event", "gap_s"] and ss.HEADER[-1] == "error" and len(ss.HEADER) == 47


def test_env_overrides_file(tmp_path):
    envf = tmp_path / "e.env"
    envf.write_text("HA_TOKEN=fromfile\nHA_URL=http://a.invalid\n", encoding="utf-8")
    ns = argparse.Namespace(env_file=str(envf), interval=60.0, duration=0.0, logs_every=5, out=str(tmp_path / "o.csv"))
    c = ss.load_config(ns, {"HA_TOKEN": "fromenv"})
    assert c.ha_token == "fromenv" and c.ha_url == "http://a.invalid"


# ----------------------------------------------------------------------------------------------- analyzer

def build_csv(tmp_path: Path, hours=26.0, leak=0.0, restart_at=None, gap=None) -> Path:
    c = cfg(tmp_path, interval_s=300.0)
    st, f = ss.State(), Fake()
    ss.append_rows(c.out, [{"at_utc": ss.utc(T0), "seq": 0, "event": "start"}])
    t, i = T0, 0
    while t <= T0 + hours * 3600:
        if gap and gap[0] <= t < gap[0] + gap[1]:
            t += 300
            continue
        f.mem = 150.0 + leak * (t - T0) / 3600.0
        f.holds, f.accepted = 100 + i, 10 + i
        if restart_at and t >= T0 + restart_at * 3600 and not getattr(f, "done", False):
            f.done, f.holds, f.accepted = True, 1, 0
            i = 0
        ss.append_rows(c.out, sample_once(c, f, st, t))
        t += 300
        i += 1
    return c.out


def test_analyze_pass_and_markdown(tmp_path):
    p = build_csv(tmp_path)
    data = an.load([p])
    res = an.analyze(data)
    assert res["hours"] >= 26 and res["gap_fraction"] == 0 and not res["restarts"]
    cl = {i: s for i, s, _ in an.checklist(res, an.FALLBACK_ACCEPTANCE)}
    assert cl["soak של 24 שעות"] == an.PASS
    assert cl["אין דליפת זיכרון (שיפוע בקטע הרציף הארוך ביותר)"] == an.PASS
    assert cl["leaks ברמת threads / fds / DB / WAL"] == an.NOT_MEASURED
    assert cl["דיסק מלא"] == an.NOT_MEASURED
    out = tmp_path / "s.md"
    assert an.main([str(p), "--out", str(out), "--tasks", str(Path(__file__).resolve().parents[3] / "management" / "tasks.json")]) == 0
    md = out.read_text(encoding="utf-8")
    assert "צ'קליסט קבלה T068" in md and "מגמות ושיפוע" in md and "catalogue scale" in md and "/health" in md
    assert "invalid" not in md and "SECRET" not in md


def test_analyze_leak_restart_and_gap(tmp_path):
    res = an.analyze(an.load([build_csv(tmp_path, hours=30, leak=5.0)]))
    cl = {i: s for i, s, _ in an.checklist(res, an.FALLBACK_ACCEPTANCE)}
    assert cl["אין דליפת זיכרון (שיפוע בקטע הרציף הארוך ביותר)"] == an.FAIL
    sub = tmp_path / "b"
    sub.mkdir()
    res = an.analyze(an.load([build_csv(sub, hours=30, restart_at=10)]))
    assert len(res["restarts"]) == 1 and len(res["segments"]) == 2 and res["longest_hours"] < 25
    sub2 = tmp_path / "c"
    sub2.mkdir()
    res = an.analyze(an.load([build_csv(sub2, hours=30, gap=(T0 + 5 * 3600, 6 * 3600))]))
    assert len(res["gaps"]) == 1 and res["gap_fraction"] > 0.05
    cl = {i: s for i, s, _ in an.checklist(res, an.FALLBACK_ACCEPTANCE)}
    assert cl["soak של 24 שעות"] == an.PARTIAL


def test_percentile_slope_and_short_run():
    assert an.percentile([1.0, 2.0, 3.0, 4.0, 100.0], 50) == 3.0 and an.percentile([1.0, 2.0, 3.0, 4.0, 100.0], 99) == 100.0
    rows = [{"ts": float(i * 3600), "v": 2.0 * i} for i in range(5)]
    sl, n = an.slope_per_hour(rows, "v")
    assert abs(sl - 2.0) < 1e-9 and n == 5
    assert an.slope_per_hour(rows[:2], "v")[0] is None


def test_acceptance_read_from_tasks_json_and_png_optional(tmp_path):
    tasks = Path(__file__).resolve().parents[3] / "management" / "tasks.json"
    acc = an.load_acceptance(tasks)
    assert any("catalogue scale" in a for a in acc) and any("disk full" in a for a in acc)
    data = an.load([build_csv(tmp_path, hours=2)])
    why = an.draw_png(data, tmp_path / "c.png")
    if why is None:
        assert (tmp_path / "c.png").stat().st_size > 0
    else:
        assert "matplotlib" in why
