"""T070: the migration dry run reads the legacy add-on's options, override and event store, maps them to the VMS,
matches camera aliases by channel, explains the time offset, turns PINs into people + roles, and never prints a
secret or a full host. Alias writes go to the VMS only, and only when asked."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("migrate_legacy", ROOT / "scripts" / "migrate_legacy.py")
ml = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(ml)

OPTIONS = {"nvr_ip": "203.0.113.40", "nvr_port": 90, "nvr_rtsp_port": 554, "nvr_user": "viewer", "nvr_password": "TopSecret!", "app_pin": "1234", "technician_pin": "2468", "pin_length": 4, "session_minutes": 60, "snapshot_seconds": 2, "go2rtc_url": "http://203.0.113.41:1984", "go2rtc_ingress_path": "", "log_level": "INFO", "event_search_debug": False}
OVERRIDE = {"camera_names": {"1": "כניסה ראשית", "2": "לובי", "7": "חניה"}, "manual_recording": [{"track": "101"}], "recording_display_offset_mode": "auto_plus_manual", "recording_display_offset_direction": "subtract", "recording_display_offset_minutes": 120}
VMS_CAMERAS = {"cameras": [
    {"id": "c1", "channel": 1, "name": "Camera 01", "name_source": "Camera 01", "alias": None},
    {"id": "c2", "channel": 2, "name": "Lobby", "name_source": "Lobby", "alias": "לובי"},
    {"id": "c3", "channel": 3, "name": "Camera 03", "name_source": "Camera 03", "alias": None},
]}


def _write(tmp_path: Path):
    (tmp_path / "options.json").write_text(json.dumps(OPTIONS), encoding="utf-8")
    (tmp_path / "override.json").write_text(json.dumps(OVERRIDE, ensure_ascii=False), encoding="utf-8")
    (tmp_path / "events.jsonl").write_text('{"storedAt": "2026-09-01T10:00:00Z", "type": "VMD"}\n{"storedAt": "2026-09-02T11:00:00Z", "type": "VMD"}\nnot json\n', encoding="utf-8")
    (tmp_path / "cams.json").write_text(json.dumps(VMS_CAMERAS, ensure_ascii=False), encoding="utf-8")


def test_dry_run_report_maps_cameras_time_users_and_hides_secrets(tmp_path):
    _write(tmp_path)
    out_json = tmp_path / "report.json"
    out_md = tmp_path / "report.md"
    rc = ml.main(["--options", str(tmp_path / "options.json"), "--override", str(tmp_path / "override.json"), "--events", str(tmp_path / "events.jsonl"), "--vms-cameras", str(tmp_path / "cams.json"), "--json", str(out_json), "--markdown", str(out_md), "--keep", str(tmp_path / "keep")])
    assert rc == 0
    rep = json.loads(out_json.read_text(encoding="utf-8"))
    md = out_md.read_text(encoding="utf-8")
    # secrets and hosts never appear
    for secret in ("TopSecret!", "1234", "2468", "203.0.113.40", "203.0.113.41"):
        assert secret not in md and secret not in json.dumps(rep, ensure_ascii=False)
    assert rep["nvr"] == {"host": "[…].40", "http_port": 90, "rtsp_port": 554, "user": "viewer", "password": "set"}
    # cameras by channel: copy, keep, missing, vms-only
    by = {c["channel"]: c for c in rep["cameras"]}
    assert by[1]["action"] == "set_alias" and by[1]["vms_camera_id"] == "c1"
    assert by[2]["action"] == "same"
    assert by[7]["action"] == "no_vms_camera"
    assert by[3]["action"] == "vms_only"
    # legacy auto (+120) with manual -120 = 0: no time warning; the VMS shows NVR wall-clock times
    assert rep["time"]["effective_minutes"] == 0 and not any("shifted" in w for w in rep["warnings"])
    # PINs become people and roles; manual recording and the event store are named as not migrated
    assert rep["users"]["app_pin"] == "set" and "Home Assistant user" in rep["users"]["vms"]
    assert rep["manual_recording"]["rows"] == 1 and any("manual-recording" in w for w in rep["warnings"])
    assert rep["events"]["rows"] == 2 and rep["events"]["first"] == "2026-09-01T10:00:00Z"
    assert rep["writes"] == {"nvr": "none", "vms": "only camera aliases, and only with --apply-aliases"}
    assert "## Rollback" in md and "Start the legacy add-on again" in md
    # the archive copy exists
    kept = list((tmp_path / "keep").glob("legacy-*/options.json"))
    assert kept and json.loads(kept[0].read_text(encoding="utf-8"))["nvr_user"] == "viewer"


def test_time_offset_warning_and_vms_host_comparison(tmp_path):
    _write(tmp_path)
    ov = {**OVERRIDE, "recording_display_offset_mode": "manual", "recording_display_offset_direction": "add", "recording_display_offset_minutes": 30}
    (tmp_path / "override.json").write_text(json.dumps(ov), encoding="utf-8")
    (tmp_path / "vms_options.json").write_text(json.dumps({"nvr_host": "203.0.113.99", "nvr_http_port": 90, "nvr_rtsp_port": 554}), encoding="utf-8")
    out_json = tmp_path / "r.json"
    assert ml.main(["--options", str(tmp_path / "options.json"), "--override", str(tmp_path / "override.json"), "--vms-options", str(tmp_path / "vms_options.json"), "--json", str(out_json), "--markdown", str(tmp_path / "r.md")]) == 0
    rep = json.loads(out_json.read_text(encoding="utf-8"))
    assert rep["time"]["effective_minutes"] == 30 and any("+30 minutes" in w for w in rep["warnings"])
    assert rep["nvr"]["vms_same_host"] is False and rep["nvr"]["vms_same_ports"] is True
    assert any("different NVR host" in w for w in rep["warnings"])
    assert "203.0.113.99" not in (tmp_path / "r.md").read_text(encoding="utf-8")


def test_apply_aliases_writes_only_empty_vms_aliases(monkeypatch):
    rows, _ = ml.plan_cameras(OVERRIDE, VMS_CAMERAS["cameras"])
    sent: list[tuple[str, str, bytes]] = []

    class Resp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=30):  # noqa: ARG001
        sent.append((req.get_method(), req.full_url, req.data))
        return Resp()

    monkeypatch.setattr(ml.urllib.request, "urlopen", fake_urlopen)
    done = ml.apply_aliases(rows, "http://vms.local:8099", "joni")
    assert [d["channel"] for d in done] == [1], "only the empty alias is written; the identical one and the VMS-only camera are left alone"
    assert sent[0][0] == "PATCH" and sent[0][1].endswith("/api/v1/cameras/c1") and json.loads(sent[0][2])["alias"] == "כניסה ראשית"
    done_force = ml.apply_aliases([{**r, "action": "keep_vms_alias", "legacy_alias": "x"} if r["channel"] == 2 else r for r in rows], "http://vms.local:8099", None, force=True)
    assert sorted(d["channel"] for d in done_force) == [1, 2]
