"""T006: scripts/lab/t006_seek_collect.py - the lab measurement of the playback media anchor is evaluated from the add-on's own
audit rows (start / seek / stop with the T074 timing fields), the OSD readings the lead types from the owner's screenshots and
optional go2rtc stream lists. It never passes without OSD readings, matches every plan point to a generation, classifies a
wrong recording or a time-zone shift, and keeps session / camera / user ids out of its report."""
from __future__ import annotations

import datetime as dt
import importlib.util
import json
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("t006_seek_collect", ROOT / "scripts" / "lab" / "t006_seek_collect.py")
sc = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(sc)

PLAN = json.loads((ROOT / "scripts" / "lab" / "t006_seek_plan.json").read_text(encoding="utf-8"))
DAY = dt.date(2026, 11, 5)
TZ = ZoneInfo("Asia/Jerusalem")
SID = "a1b2c3d4e5"
CAM = "cam0123456789abc"


def _utc(local_hms: str) -> str:
    t = dt.datetime.combine(DAY, dt.time.fromisoformat(local_hms), tzinfo=TZ).astimezone(dt.timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


LOCALS = ["10:00:00", "10:10:00", "10:10:07", "10:47:31", "10:05:13", "12:30:44", "10:00:29", "17:15:02"]


def _rows(seek_ms=(2100, 2400, 1900, 2600, 3100, 2200, 2800), first_ms=3000, locals_=LOCALS, stop=True):
    rows = [{"action": "video.playback.start", "at": "2026-11-06T08:00:00Z", "actor_username": "owner", "resource_id": CAM,
             "details": {"session": SID, "requested_at": _utc(locals_[0]), "start_at": _utc(locals_[0])}}]
    for g, loc in enumerate(locals_[1:], start=1):
        rows.append({"action": "video.playback.seek", "at": "2026-11-06T08:01:00Z", "resource_id": CAM,
                     "details": {"session": SID, "generation": g, "start_at": _utc(loc)}})
    if stop:
        rows.append({"action": "video.playback.stop", "at": "2026-11-06T08:10:00Z", "resource_id": CAM,
                     "details": {"session": SID, "generation": len(locals_) - 1, "bytes_down": 123, "first_media_ms": first_ms, "seek_media_ms": list(seek_ms)}})
    # another user's unrelated session must not be picked
    rows.append({"action": "video.playback.start", "details": {"session": "zzzzzzzzzz", "requested_at": "2026-11-05T05:00:00Z", "start_at": "2026-11-05T05:00:00Z"}})
    return rows


def _osd(offsets=(-1, -2, 0, -3, -1, -2, 0, -4)):
    out = {}
    for i, off in enumerate(offsets):
        arx = sc.hms_seconds("11:00:00") + i * 100
        out[f"P{i}"] = {"osd": arx + off, "arx": arx}
    return out


def test_plan_points_are_on_the_day_and_in_order_of_the_plan():
    pts = sc.expected_points(PLAN, DAY)
    assert [p["local"] for p in pts] == LOCALS
    assert pts[0]["utc"] == dt.datetime(2026, 11, 5, 8, 0, tzinfo=dt.timezone.utc)  # winter: +02:00 (no fixed offset assumed)
    summer = sc.expected_points(PLAN, dt.date(2026, 7, 5))
    assert summer[0]["utc"].hour == 7  # summer: +03:00, from the IANA zone


def test_a_dst_change_day_is_refused():
    plan = json.loads(json.dumps(PLAN))
    plan["base_local"] = "02:30:00"  # Israel springs forward on Friday 2026-03-27 at 02:00
    with pytest.raises(sc.InputError):
        sc.expected_points(plan, dt.date(2026, 3, 27))


def test_full_run_passes_and_keeps_ids_out():
    rep = sc.evaluate(PLAN, DAY, _rows(), osd=_osd(), gop_s=4, streams_before={"intercom_door", "smplwise_nvr-1_ch1_sub"},
                      streams_after={"intercom_door", "smplwise_nvr-1_ch1_sub"})
    assert rep["checks"] == {"request": "PASS", "accuracy": "PASS", "timing": "PASS", "cleanup": "PASS"}
    assert rep["verdict_at011"] == "PASS" and rep["verdict_at012_cleanup"] == "PASS"
    assert [r["generation"] for r in rep["points"]] == list(range(8))
    assert rep["points"][0]["first_media_ms"] == 3000 and rep["points"][7]["first_media_ms"] == 2800
    blob = json.dumps(rep) + sc.to_markdown(rep)
    for secret in (SID, CAM, "owner", "intercom_door", "zzzzzzzzzz"):
        assert secret not in blob


def test_without_osd_readings_it_is_never_a_pass():
    rep = sc.evaluate(PLAN, DAY, _rows(), osd=None)
    assert rep["checks"]["accuracy"] == "NOT_EVALUATED" and rep["verdict_at011"] == "INCOMPLETE"


def test_offsets_classified_wrong_recording_tz_shift_and_tolerance():
    th = PLAN["thresholds"]
    assert sc.classify(-3, 4, th) == "ok" and sc.classify(2, 4, th) == "ok"
    assert sc.classify(-7, 4, th) == "out_of_tolerance" and sc.classify(3, 4, th) == "out_of_tolerance"
    assert sc.classify(3600, 4, th) == "tz_shift" and sc.classify(-7199, 4, th) == "tz_shift"
    assert sc.classify(600, 4, th) == "wrong_recording"
    rep = sc.evaluate(PLAN, DAY, _rows(), osd=_osd(offsets=(-1, -2, 0, -3, 3600, -2, 0, -4)), gop_s=4)
    assert rep["checks"]["accuracy"] == "FAIL" and rep["verdict_at011"] == "FAIL"
    assert rep["points"][4]["accuracy"] == "tz_shift"


def test_live_drift_is_subtracted_before_the_tolerance():
    rep = sc.evaluate(PLAN, DAY, _rows(), osd=_osd(offsets=(4, 3, 5, 2, 4, 3, 5, 2)), gop_s=4)
    assert rep["checks"]["accuracy"] == "FAIL"
    rep = sc.evaluate(PLAN, DAY, _rows(), osd=_osd(offsets=(4, 3, 5, 2, 4, 3, 5, 2)), gop_s=4, drift_s=4)
    assert rep["checks"]["accuracy"] == "PASS" and rep["points"][0]["offset_raw_s"] == 4 and rep["points"][0]["offset_s"] == 0


def test_missing_point_moved_start_and_slow_seek():
    rows = _rows(locals_=LOCALS[:6], seek_ms=(2100, 2400, 1900, 2600, 3100))
    rep = sc.evaluate(PLAN, DAY, rows, osd=_osd())
    assert rep["checks"]["request"] == "INCOMPLETE" and rep["checks"]["timing"] == "INCOMPLETE"
    moved = _rows()
    moved[0]["details"]["requested_at"] = _utc("09:59:00")
    assert sc.evaluate(PLAN, DAY, moved, osd=_osd())["checks"]["request"] == "FAIL"
    slow = sc.evaluate(PLAN, DAY, _rows(seek_ms=(2100, 2400, 1900, 2600, 3100, 2200, 12000)), osd=_osd())
    assert slow["checks"]["timing"] == "FAIL" and any("seek max" in p for p in slow["problems"])
    nomedia = sc.evaluate(PLAN, DAY, _rows(first_ms=None), osd=_osd())
    assert nomedia["checks"]["timing"] == "FAIL"
    nostop = sc.evaluate(PLAN, DAY, _rows(stop=False), osd=_osd())
    assert nostop["checks"]["timing"] == "INCOMPLETE"


def test_cleanup_finds_a_left_stream_and_a_removed_foreign_stream():
    left = {f"smplwise_pb_inst_{SID}_g7", "intercom_door"}
    rep = sc.evaluate(PLAN, DAY, _rows(), osd=_osd(), streams_before={"intercom_door", "frigate_x"}, streams_after=left)
    assert rep["checks"]["cleanup"] == "FAIL" and rep["cleanup"]["session_streams_left"] == 1 and rep["cleanup"]["foreign_removed"] == 1
    assert rep["verdict_at011"] == "PASS"  # the cleanup verdict is reported separately (AT012)


def test_no_session_found_is_incomplete():
    rep = sc.evaluate(PLAN, DAY, [], osd=_osd())
    assert rep["verdict_at011"] == "INCOMPLETE" and rep["points"] == []


def test_cli_reads_files_and_exit_codes(tmp_path):
    audit = tmp_path / "audit.json"
    audit.write_text(json.dumps({"rows": [{**r, "details_json": json.dumps(r["details"])} if i == 0 else r for i, r in enumerate(_rows())]}), encoding="utf-8")
    audit_rows = json.loads(audit.read_text(encoding="utf-8"))["rows"]
    audit_rows[0].pop("details")
    audit.write_text(json.dumps({"rows": audit_rows}), encoding="utf-8")
    osd = tmp_path / "osd.csv"
    lines = ["point,osd_local,arx_local,note"] + [f"P{i},11:0{i}:0{max(0, 3 - (i % 3))},11:0{i}:03," for i in range(8)]
    osd.write_text("\n".join(lines) + "\n", encoding="utf-8")
    log = tmp_path / "addon.log"
    log.write_text(f"2026-11-06 INFO playback session {SID} g6 socket closed: superseded (999 bytes, first media - ms)\n"
                   f"2026-11-06 INFO playback session {SID} g7 socket closed: closed (999 bytes, first media 2800 ms)\n", encoding="utf-8")
    before, after = tmp_path / "b.json", tmp_path / "a.json"
    before.write_text(json.dumps({"intercom_door": {}}), encoding="utf-8")
    after.write_text(json.dumps({"intercom_door": {}}), encoding="utf-8")
    out = tmp_path / "r.json"
    args = ["--date", "2026-11-05", "--audit-json", str(audit), "--osd", str(osd), "--log", str(log), "--json", str(out), "--md", str(tmp_path / "r.md")]
    assert sc.main(args + ["--streams-before", str(before), "--streams-after", str(after)]) == 0
    rep = json.loads(out.read_text(encoding="utf-8"))
    assert rep["cleanup"]["socket_close_reasons"] == {"closed": 1, "superseded": 1}
    assert sc.main(args) == 3  # cleanup not evaluated: not a pass
    bad = tmp_path / "bad.csv"
    bad.write_text("point,osd_local,arx_local\nP0,25:00:00,10:00:00\n", encoding="utf-8")
    assert sc.main(["--date", "2026-11-05", "--audit-json", str(audit), "--osd", str(bad)]) == 2
