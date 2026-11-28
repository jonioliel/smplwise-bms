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


def test_backup_export_writes_a_secret_free_document_arx_reads_back(tmp_path, capsys):
    """LEGACY-MIGRATION-2550: --backup reads a Home Assistant backup with Arx's own reader; --export writes the secret-free document."""
    import io
    import tarfile

    def tar(files: dict[str, bytes], gz: bool) -> bytes:
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz" if gz else "w") as t:
            for name, data in files.items():
                info = tarfile.TarInfo(name)
                info.size = len(data)
                t.addfile(info, io.BytesIO(data))
        return buf.getvalue()

    addon = tar({"./addon.json": json.dumps({"version": "1.5.27", "user": {"options": OPTIONS}}).encode(), "./data/options.json": json.dumps(OPTIONS).encode()}, True)
    config = tar({"./data/legacy_override_copy.json": json.dumps(OVERRIDE, ensure_ascii=False).encode("utf-8")}, True)
    meta = {"slug": "s1", "protected": False, "addons": [{"slug": "local_hikvision_nvr", "version": "1.5.27"}]}
    backup = tmp_path / "backup.tar"
    backup.write_bytes(tar({"./backup.json": json.dumps(meta).encode(), "./local_hikvision_nvr.tar.gz": addon, "./homeassistant.tar.gz": config}, False))
    out = tmp_path / "export.json"
    assert ml.main(["--backup", str(backup), "--export", str(out)]) == 0
    import re

    hexes = re.compile(r"[0-9a-f]{16,64}")  # digests (the file's SHA-256, the host digests) may hold any digit run
    printed = hexes.sub("#", capsys.readouterr().out)
    text = hexes.sub("#", out.read_text(encoding="utf-8"))
    for secret in ("TopSecret!", "1234", "2468", "203.0.113.40", "203.0.113.41"):
        assert secret not in text and secret not in printed
    doc = json.loads(text)
    assert doc["format"] == "smplwise-legacy-export/1" and doc["legacy_version"] == "1.5.27"
    assert doc["override"]["camera_names"]["1"] == "כניסה ראשית" and doc["secrets_present"]["options.nvr_password"] is True
    reader = ml.legacy_reader()
    again = reader.read_bytes(out.read_bytes())
    assert again.container == "export" and again.override["camera_names"] == doc["override"]["camera_names"]
    # a protected backup is refused with its reason
    meta["protected"] = True
    backup.write_bytes(tar({"./backup.json": json.dumps(meta).encode()}, False))
    assert ml.main(["--backup", str(backup)]) == 2


# ---- review CD2-21: an alias write that fails half-way still leaves a full report; the time offset comes from the IANA zone + date

def _fake_vms(monkeypatch, fail_ids: set[str]):
    import io
    import urllib.error

    sent: list[str] = []

    class Resp:
        status = 200

        def __init__(self, body: bytes = b"{}"):
            self._b = body

        def read(self):
            return self._b

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    cams = {"cameras": [{"id": "c1", "channel": 1, "name": "Camera 01", "alias": None}, {"id": "c2", "channel": 2, "name": "Lobby", "alias": None},
                        {"id": "c7", "channel": 7, "name": "Parking", "alias": None}]}

    def fake_urlopen(req, timeout=30):  # noqa: ARG001
        url = req.full_url
        if req.get_method() == "GET":
            body = cams if url.endswith("/api/v1/cameras") else {"settings": {"time.zone": "Asia/Jerusalem"}}
            return Resp(json.dumps(body).encode("utf-8"))
        cid = url.rsplit("/", 1)[1]
        sent.append(cid)
        if cid in fail_ids:
            raise urllib.error.HTTPError(url, 500, "server error", {}, io.BytesIO(b"secret server text"))
        return Resp()

    monkeypatch.setattr(ml.urllib.request, "urlopen", fake_urlopen)
    return sent


def test_a_failing_alias_write_is_a_failed_row_the_others_are_still_written_and_the_report_is_written(tmp_path, monkeypatch):
    _write(tmp_path)
    sent = _fake_vms(monkeypatch, {"c2"})
    out_json, out_md = tmp_path / "r.json", tmp_path / "r.md"
    rc = ml.main(["--options", str(tmp_path / "options.json"), "--override", str(tmp_path / "override.json"), "--vms-url", "http://vms.local:8099",
                  "--apply-aliases", "--json", str(out_json), "--markdown", str(out_md)])
    assert rc == 1, "an incomplete write is not a success"
    assert sent == ["c1", "c2", "c7"], "the camera after the failure is still tried"
    rep = json.loads(out_json.read_text(encoding="utf-8"))
    by = {a["channel"]: a for a in rep["applied_aliases"]}
    assert by[1]["result"] == "written" and by[7]["result"] == "written"
    assert by[2]["result"] == "failed" and by[2]["error"] == "http_500" and by[2]["before"] is None
    assert rep["writes"]["vms"] == "2 camera aliases written, 1 failed"
    assert any("alias writes incomplete" in w for w in rep["warnings"])
    md = out_md.read_text(encoding="utf-8")
    assert "## Alias writes" in md and "secret server text" not in md and "secret server text" not in out_json.read_text(encoding="utf-8")


def test_an_interrupt_stops_the_writes_and_still_reports_what_was_written(monkeypatch):
    rows, _ = ml.plan_cameras({"camera_names": {"1": "a", "2": "b", "3": "c"}}, [{"id": f"c{i}", "channel": i, "alias": None} for i in (1, 2, 3)])
    calls: list[str] = []

    class Resp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout=30):  # noqa: ARG001
        calls.append(req.full_url)
        if len(calls) == 2:
            raise KeyboardInterrupt
        return Resp()

    monkeypatch.setattr(ml.urllib.request, "urlopen", fake_urlopen)
    done = ml.apply_aliases(rows, "http://vms.local:8099", None)
    assert [(d["channel"], d["result"]) for d in done] == [(1, "written"), (2, "not_attempted"), (3, "not_attempted")]
    assert len(calls) == 2


def test_the_legacy_auto_offset_comes_from_the_zone_and_the_date_not_a_fixed_120(tmp_path):
    _write(tmp_path)
    ov = {**OVERRIDE, "recording_display_offset_mode": "auto"}
    (tmp_path / "override.json").write_text(json.dumps(ov), encoding="utf-8")

    def time_of(*extra):
        out = tmp_path / "t.json"
        assert ml.main(["--options", str(tmp_path / "options.json"), "--override", str(tmp_path / "override.json"), "--json", str(out),
                        "--markdown", str(tmp_path / "t.md"), *extra]) == 0
        return json.loads(out.read_text(encoding="utf-8"))["time"]

    summer = time_of("--zone", "Asia/Jerusalem", "--date", "2026-07-15")
    assert summer["utc_offset_minutes"] == 180 and summer["dst"] is True, "the true offset of a summer day, from the IANA rules"
    assert summer["standard_offset_minutes"] == 120 and summer["auto_minutes"] == 120, "the device quirk (T1): the NVR reports standard time"
    assert "KNOWN_QUIRKS T1" in summer["auto_source"]
    winter = time_of("--zone", "Asia/Jerusalem", "--date", "2026-01-15")
    assert winter["utc_offset_minutes"] == 120 and winter["dst"] is False and winter["auto_minutes"] == 120
    ny = time_of("--zone", "America/New_York", "--date", "2026-07-15")
    assert ny["auto_minutes"] == -300 and ny["utc_offset_minutes"] == -240 and ny["effective_minutes"] == -300, "another zone is not +120"
    given = time_of("--nvr-utc-offset-minutes", "60", "--date", "2026-07-15")
    assert given["auto_minutes"] == 60 and given["auto_source"].startswith("given")
    md = (tmp_path / "t.md").read_text(encoding="utf-8")
    assert "zone Asia/Jerusalem on 2026-07-15: UTC+180 min (daylight saving" in md
