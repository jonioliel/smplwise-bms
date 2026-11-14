"""T074: scripts/gate/video_timing.py - time to camera / time to recording numbers from the add-on's own log lines and audit rows
(docs/changes/T074-VISUAL-METRICS-2405.md). Pure functions and the CLI on temporary files; no device, no runner."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path

import pytest

GATE = Path(__file__).resolve().parents[3] / "scripts" / "gate"
if str(GATE) not in sys.path:
    sys.path.insert(0, str(GATE))

import video_timing as vt  # noqa: E402

NOW = dt.datetime(2026, 11, 6, 12, 0, tzinfo=dt.timezone.utc)
SECRET_IDS = ("sess0a1b2c", "cam_lobby_7", "joni", "192.0.2.10", "rtsp://", "door:p@", "smplwise_pb_")

LOG = """\
2026-11-05 10:00:01 INFO smplwise.media live session sess0a1b2c ended: client_closed (transport mse, first media 1200 ms, answer - ms)
2026-11-05 10:00:02 INFO smplwise.media live session s2 ended: client_closed (transport webrtc, first media - ms, answer 300 ms)
2026-11-05 10:00:03 INFO smplwise.media live session s3 ended: upstream_failure (transport -, first media - ms, answer - ms)
2026-11-05 10:00:04 INFO smplwise.media live session s4 ended: client_closed (transport mse, first media 2500 ms)
2026-11-05 10:00:05 INFO smplwise.playback playback session p1 g0 socket closed: upstream_closed (5000 bytes, first media 3100 ms)
2026-11-05 10:00:06 INFO smplwise.playback playback session p1 g0 socket closed: client_closed (9000 bytes, first media 3100 ms)
2026-11-05 10:00:07 INFO smplwise.playback playback session p1 g1 socket closed: superseded (0 bytes, first media - ms)
2026-11-05 10:00:08 INFO smplwise.playback playback session p1 g2 socket closed: client_closed (700 bytes, first media 1400 ms)
2026-11-05 10:00:09 INFO smplwise.playback playback session p2 g0 socket closed: client_closed (0 bytes, first media - ms)
2026-11-05 10:00:10 INFO smplwise.playback playback session old g0 socket closed: client_closed (100 bytes)
2026-11-05 10:00:11 WARNING smplwise.media live session s5 (camera cam_lobby_7): go2rtc error timeout: dial tcp <host> i/o timeout
"""


def _write(tmp_path: Path, name: str, text: str) -> Path:
    p = tmp_path / name
    p.write_text(text, encoding="utf-8")
    return p


def test_percentiles_are_nearest_rank():
    assert vt.percentile([], 90) is None
    assert vt.percentile([5], 50) == 5
    v = list(range(1, 11))       # 1..10
    assert (vt.percentile(v, 50), vt.percentile(v, 90), vt.percentile(v, 95), vt.percentile(v, 100)) == (5, 9, 10, 10)
    assert vt.stats([300, 100, 200]) == {"n": 3, "p50": 200, "p90": 300, "p95": 300, "max": 300}


def test_the_log_lines_of_live_and_playback_are_read_and_de_duplicated(tmp_path):
    c = vt.Collector()
    vt.read_log(c, _write(tmp_path, "addon.log", LOG))
    s = c.samples()
    assert sorted(s["live.mse.first_media_ms"]) == [1200, 2500] and s["live.webrtc.answer_ms"] == [300]
    assert s["playback.start.first_media_ms"] == [3100], "two sockets of one generation count once"
    assert s["playback.seek.first_media_ms"] == [1400], "a superseded generation that never relayed media is no seek sample"
    r = c.ratios()
    assert r["live.no_media_ratio"] == {"no_media": 1, "total": 4, "ratio": 0.25}
    assert r["playback.no_media_ratio"] == {"no_media": 1, "total": 2, "ratio": 0.5}
    assert c.pb_unmeasured == 1, "an old playback line (no `first media`) is unmeasured, not no-media"
    assert c.sources == [{"kind": "log", "lines": 11, "matched": 10}]


def test_audit_rows_old_versions_are_left_out_and_sources_merge_by_session(tmp_path):
    rows = {"rows": [
        {"action": "video.live.stop", "resource_type": "camera", "resource_id": "cam_lobby_7", "actor_username": "joni",
         "details": {"session": "sess0a1b2c", "transport": "mse", "ttff_ms": 1200, "reason": "client_closed"}},
        {"action": "video.live.stop", "resource_type": "station", "details": {"session": "s9", "transport": None,
                                                                             "upstream_error": "timeout", "upstream_error_text": "dial tcp <host> i/o timeout"}},
        {"action": "video.live.stop", "resource_type": "camera", "details": {"session": "pre240", "seconds": 4, "bytes_down": 0}},
        {"action": "video.playback.stop", "details_json": json.dumps({"session": "p1", "first_media_ms": 3100, "seek_media_ms": [900, 1100]})},
        {"action": "video.playback.stop", "details": {"session": "p3", "first_media_ms": None, "bytes_down": 0}},
        {"action": "video.playback.stop", "details": {"session": "pre074", "bytes_down": 10}},
        {"action": "video.playback.start", "details": {"session": "p1"}},
        {"action": "video.live.stop", "details": "not a dict"}]}
    c = vt.Collector()
    vt.read_audit_json(c, _write(tmp_path, "audit.json", json.dumps(rows)))
    vt.read_log(c, _write(tmp_path, "addon.log", LOG))
    s = c.samples()
    assert sorted(s["live.mse.first_media_ms"]) == [1200, 2500], "the session in both sources is counted once"
    assert s["playback.start.first_media_ms"] == [3100]
    assert sorted(s["playback.seek.first_media_ms"]) == [900, 1100], "the audit row's seeks win over the log for the same session"
    assert c.live_unmeasured == 1 and c.pb_unmeasured == 2   # pre-2.40.0 live row; pre-T074 playback row + old log line
    assert c.errors() == {"timeout": 1}
    assert c.by_surface() == {"camera": 1, "station": 1, "unknown": 3}
    assert c.ratios()["playback.no_media_ratio"] == {"no_media": 2, "total": 3, "ratio": 0.6667}


def test_the_database_is_read_only_and_windowed(tmp_path):
    db = tmp_path / "smplwise.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE audit_log (id INTEGER PRIMARY KEY, at TEXT, actor_user_id TEXT, actor_username TEXT, action TEXT, "
                 "resource_type TEXT, resource_id TEXT, decision TEXT, reason TEXT, request_id TEXT, permission_revision INTEGER, details_json TEXT)")
    rows = [("2026-11-05T09:00:00Z", "video.live.stop", "camera", {"session": "a", "transport": "webrtc", "answer_ms": 220}),
            ("2026-11-05T09:01:00Z", "video.playback.stop", "camera", {"session": "b", "first_media_ms": 4100}),
            ("2026-10-01T09:00:00Z", "video.live.stop", "camera", {"session": "old", "transport": "mse", "ttff_ms": 99999}),
            ("2026-11-05T09:02:00Z", "rbac.update", "user", {"session": "x"})]
    for at, action, rt, d in rows:
        conn.execute("INSERT INTO audit_log (at, action, resource_type, decision, details_json) VALUES (?, ?, ?, 'allowed', ?)", (at, action, rt, json.dumps(d)))
    conn.commit()
    conn.close()
    before = db.read_bytes()
    c = vt.Collector()
    vt.read_db(c, db, 7, now=NOW)
    s = c.samples()
    assert s["live.webrtc.answer_ms"] == [220] and s["playback.start.first_media_ms"] == [4100] and s["live.mse.first_media_ms"] == []
    assert c.sources == [{"kind": "db", "rows": 2, "used": 2, "since": "2026-10-30T12:00:00Z"}]
    assert db.read_bytes() == before, "opened read-only: the file is not touched"


def _rep_with(values: dict[str, list[int]], ratios=None, th=None):
    c = vt.Collector()
    for i, v in enumerate(values.get("mse", [])):
        c.live_session(f"m{i}", "mse", v, None)
    for i, v in enumerate(values.get("webrtc", [])):
        c.live_session(f"w{i}", "webrtc", None, v)
    for i, v in enumerate(values.get("start", [])):
        c.playback_start(f"p{i}", v)
    th = th or {"min_samples": 3, "limits": {"live.mse.first_media_ms": {"p90": 3000}, "live.webrtc.answer_ms": {"p90": 1000},
                                              "playback.no_media_ratio": {"max": 0.3}}}
    return vt.build_report(c, th, now=NOW)


def test_thresholds_pass_breach_and_insufficient():
    rep = _rep_with({"mse": [1000, 1500, 2000, 2500], "webrtc": [200, 300], "start": [5000, None, 6000]})
    st = {(ch["metric"], ch["stat"]): ch["state"] for ch in rep["checks"]}
    assert st[("live.mse.first_media_ms", "p90")] == "pass"
    assert st[("live.webrtc.answer_ms", "p90")] == "insufficient", "2 samples < min_samples 3: not evaluated"
    assert st[("playback.no_media_ratio", "max")] == "breach"     # 1 of 3 = 0.333 > 0.3
    assert rep["verdict"] == "breach"
    assert _rep_with({"mse": [1000, 1200, 1300]})["verdict"] == "pass"
    assert _rep_with({})["verdict"] == "not_evaluated", "no samples is never a pass"


def test_threshold_files_are_validated_and_the_shipped_one_is_provisional(tmp_path):
    th = vt.load_thresholds(None)
    assert th["status"].startswith("PROVISIONAL") and set(th["limits"]) == set(vt.METRICS) | set(vt.RATIOS)
    for bad in ({"limits": {"live.unknown": {"p90": 1}}}, {"limits": {"live.mse.first_media_ms": {"p99": 1}}},
                {"limits": {"live.no_media_ratio": {"p90": 0.1}}}, {"limits": {"live.mse.first_media_ms": {"p90": -1}}}):
        with pytest.raises(ValueError):
            vt.load_thresholds(_write(tmp_path, "t.json", json.dumps(bad)))


def test_the_cli_report_enforce_exit_codes_and_privacy(tmp_path, capsys):
    log = _write(tmp_path, "addon.log", LOG)
    audit = _write(tmp_path, "audit.json", json.dumps({"rows": [{"action": "video.live.stop", "resource_type": "camera", "resource_id": "cam_lobby_7",
                                                                  "actor_username": "joni", "details": {"session": "zz", "transport": "mse", "ttff_ms": 1000,
                                                                  "upstream_error": "auth", "upstream_error_text": "rtsp://door:p@192.0.2.10 401"}}]}))
    out_json, out_md = tmp_path / "vt.json", tmp_path / "vt.md"
    assert vt.main(["report", "--log", str(log), "--audit-json", str(audit), "--json", str(out_json), "--md", str(out_md)]) == 0
    text = out_json.read_text(encoding="utf-8") + out_md.read_text(encoding="utf-8") + capsys.readouterr().out
    for leak in SECRET_IDS + ("zz", "p1", "s2", "401"):
        assert leak not in text.replace("p50", "").replace("p90", "").replace("p95", "").replace("ms", ""), leak
    rep = json.loads(out_json.read_text(encoding="utf-8"))
    assert rep["metrics"]["live.mse.first_media_ms"]["n"] == 3 and rep["upstream_errors"] == {"auth": 1}
    assert "Time to camera / time to recording (T074)" in out_md.read_text(encoding="utf-8")
    strict = _write(tmp_path, "strict.json", json.dumps({"min_samples": 1, "limits": {"live.mse.first_media_ms": {"max": 1100}}}))
    loose = _write(tmp_path, "loose.json", json.dumps({"min_samples": 1, "limits": {"live.mse.first_media_ms": {"max": 99999}}}))
    many = _write(tmp_path, "many.json", json.dumps({"min_samples": 500, "limits": {"live.mse.first_media_ms": {"p90": 1}}}))
    assert vt.main(["report", "--log", str(log), "--thresholds", str(strict)]) == 0, "without --enforce the numbers never fail"
    assert vt.main(["report", "--log", str(log), "--thresholds", str(strict), "--enforce"]) == 1
    assert vt.main(["report", "--log", str(log), "--thresholds", str(loose), "--enforce"]) == 0
    assert vt.main(["report", "--log", str(log), "--thresholds", str(many), "--enforce"]) == 3
    assert vt.main(["report", "--log", str(tmp_path / "missing.log")]) == 2
    assert vt.main(["report", "--thresholds", str(_write(tmp_path, "bad.json", "{not json"))]) == 2
