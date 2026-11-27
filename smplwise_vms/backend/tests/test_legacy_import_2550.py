"""LEGACY-MIGRATION-2550 (T070): the import from the legacy "Hikvision NVR Panel" add-on (v1.5.27).

The reader (services/legacy_source.py) takes copies - loose files, a ZIP / TAR of them under any name, its own export, an
unprotected Home Assistant backup - and keeps nothing secret; the dry run (POST /migration/legacy/dry-run) reports every item and
writes nothing; the apply (POST /migration/legacy/apply) is bound to the plan digest, needs a system administrator in an interactive
session and the typed confirm word, writes a backup first, fills only EMPTY camera aliases, is idempotent and audited.

Fixtures (tests/fixtures/legacy_v1527/) are synthetic: `.invalid` hosts and made-up secret markers that must never appear in any
output."""
from __future__ import annotations

import gzip
import io
import json
import re
import tarfile
import zipfile
from dataclasses import asdict
from pathlib import Path

import pytest

from conftest import as_user
from smplwise.db import Database, now_iso
from smplwise.services import legacy_import as li
from smplwise.services import legacy_source as ls

API = "/api/v1/migration/legacy"
FIX = Path(__file__).resolve().parent / "fixtures" / "legacy_v1527"
OPTIONS = (FIX / "options.json").read_bytes()
OVERRIDE = (FIX / "override.json").read_bytes()
EVENTS = (FIX / "event_store.jsonl").read_bytes()
# every secret and host of the fixtures: none of them may leave the reader
SECRETS = ("Synthetic-NVR-Secret-1", "Synthetic-Override-Secret-2", "97531", "86420", "SYNTHETIC-INGRESS-TOKEN", "nvr.example.invalid",
           "go2rtc.example.invalid")
CONFIRM = {"confirm": "ייבוא מהמערכת הישנה"}


def _no_secret(text: str) -> None:
    text = re.sub(r"[0-9a-f]{16,64}", "#", text)  # digests and ids may hold any digit run
    for s in SECRETS:
        assert s not in text, s


def _zip(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)
    return buf.getvalue()


def _tar(files: dict[str, bytes], gz: bool = False) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz" if gz else "w") as t:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            t.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def _ha_backup(protected: bool = False, with_addon: bool = True) -> bytes:
    addon = _tar({"./addon.json": json.dumps({"version": "1.5.27", "user": {"options": {**json.loads(OPTIONS), "log_level": "DEBUG"}},
                                               "system": {}}).encode(),
                  "./data/options.json": OPTIONS}, gz=True)
    config = _tar({"./homeassistant.json": b"{}", "./data/configuration.yaml": b"default_config:\n",
                   "./data/hikvision_nvr_override.json": OVERRIDE, "./data/hikvision_nvr_event_store.jsonl": EVENTS,
                   "./data/.storage/core.config_entries": b'{"data": {}}', "./data/other_integration.json": b'{"version": 1}'}, gz=True)
    meta = {"slug": "abcd1234", "name": "Synthetic", "type": "partial", "protected": protected, "compressed": True,
            "addons": [{"slug": "local_hikvision_nvr", "name": "Hikvision NVR Panel", "version": "1.5.27"}] if with_addon else [],
            "homeassistant": {"version": "2026.11.0"}}
    files = {"./backup.json": json.dumps(meta).encode(), "./homeassistant.tar.gz": config}
    if with_addon:
        files["./local_hikvision_nvr.tar.gz"] = addon
    return _tar(files)


def _content(src: ls.LegacySource) -> dict:
    d = asdict(src)
    for k in ("container", "sha256", "size", "ignored", "warnings", "found", "legacy_version"):
        d.pop(k)
    return d


# ---------------------------------------------------------------- the reader

def test_loose_files_are_read_and_nothing_secret_is_kept():
    src = ls.read_parts(options=OPTIONS, override=OVERRIDE, events=EVENTS)
    assert src.found == ["options", "override", "events"]
    assert src.secrets_present == {"options.nvr_password": True, "options.app_pin": True, "options.technician_pin": True,
                                   "options.go2rtc_ingress_path": True, "override.nvr_password": True}
    assert src.options["pin_length"] == 5, "a known option whose name holds 'pin' is not a secret"
    assert "nvr_ip" not in src.options and "go2rtc_url" not in src.options and "nvr_password" not in src.override
    assert src.nvr_host_digest == ls.host_digest("nvr.example.invalid") and src.go2rtc_url_digest == ls.host_digest("http://go2rtc.example.invalid:1984")
    assert src.override["camera_names"]["1"] == "כניסה ראשית"
    assert src.events == {"present": True, "rows": 3, "first": "2026-09-01T10:00:00Z", "last": "2026-09-03T12:00:00Z"}
    assert "legacy_version_unknown" in src.warnings
    _no_secret(json.dumps(asdict(src), ensure_ascii=False))
    _no_secret(json.dumps(src.to_export(), ensure_ascii=False))


def test_zip_and_tar_with_renamed_members_read_like_the_loose_files():
    base = _content(ls.read_parts(options=OPTIONS, override=OVERRIDE, events=EVENTS))
    renamed = {"copy/a.json": OPTIONS, "copy/b.json": OVERRIDE, "copy/deeper/c.jsonl": EVENTS, "__MACOSX/copy/._a.json": b"junk",
               "copy/notes.json": b'{"hello": "world"}'}
    for raw, container in ((_zip(renamed), "zip"), (_tar(renamed), "tar"), (_tar(renamed, gz=True), "tar")):
        src = ls.read_bytes(raw)
        assert src.container == container
        assert _content(src) == base
        assert src.ignored == 1  # notes.json is not the legacy add-on's


def test_an_unprotected_home_assistant_backup_is_read_and_a_protected_one_refused():
    src = ls.read_bytes(_ha_backup())
    assert src.container == "ha_backup" and src.legacy_version == "1.5.27"
    assert set(src.found) == {"options", "override", "events", "addon_meta"}
    assert src.options["log_level"] == "INFO", "data/options.json (what the add-on ran with) wins over addon.json"
    assert "several_options" in src.warnings and "legacy_version_unknown" not in src.warnings
    assert src.override["camera_names"]["7"] == "מחסן" and src.events["rows"] == 3
    _no_secret(json.dumps(asdict(src), ensure_ascii=False))
    with pytest.raises(ls.SourceError) as e:
        ls.read_bytes(_ha_backup(protected=True))
    assert e.value.code == "protected_backup"
    only_config = ls.read_bytes(_ha_backup(with_addon=False))
    assert "backup_without_legacy_addon" in only_config.warnings and "options" not in only_config.found


@pytest.mark.parametrize("raw, code", [
    (b"", "empty"),
    (b"hello world", "unsupported_format"),
    (b'{"a": 1}', "not_legacy"),
    (b"PK\x03\x04not a zip", "unreadable_zip"),
])
def test_what_is_not_a_legacy_file_is_refused_with_a_stable_code(raw, code):
    with pytest.raises(ls.SourceError) as e:
        ls.read_bytes(raw)
    assert e.value.code == code


def test_too_large_inputs_are_refused_before_reading():
    with pytest.raises(ls.SourceError) as e:
        ls.read_bytes(b"{" + b" " * 64 + b"}", max_bytes=16)
    assert e.value.code == "too_large"
    bomb = _zip({"big.json": b"{" + b" " * (ls.MAX_MEMBER_BYTES + 10) + b"}", "o.json": OPTIONS})
    src = ls.read_bytes(bomb)
    assert "member_too_large" in src.warnings and src.found == ["options"]


def test_the_export_is_secret_free_and_reads_back_the_same():
    src = ls.read_parts(options=OPTIONS, override=OVERRIDE, events=EVENTS)
    doc = src.to_export()
    assert doc["format"] == ls.EXPORT_FORMAT
    again = ls.read_bytes(json.dumps(doc, ensure_ascii=False).encode("utf-8"))
    assert again.container == "export" and _content(again) == _content(src)
    # a secret slipped into an edited export is reduced again
    doc["options"]["app_pin"] = "11111"
    doc["override"]["nvr_password"] = "Synthetic-NVR-Secret-1"
    third = ls.read_bytes(json.dumps(doc).encode())
    assert "app_pin" not in third.options and third.secrets_present["options.app_pin"] is True
    _no_secret(json.dumps(asdict(third)))
    assert "11111" not in json.dumps(asdict(third))


def test_a_gzipped_json_and_a_single_event_store_are_read():
    src = ls.read_bytes(gzip.compress(OVERRIDE))
    assert src.found == ["override"] and src.container == "json"
    ev = ls.read_bytes(EVENTS)
    assert ev.container == "jsonl" and ev.events["rows"] == 3


# ---------------------------------------------------------------- the API

def _seed(settings) -> None:
    """Arx cameras on the first recorder: 1 no alias, 2 the same alias, 3 another alias, 4 no legacy name; channel 7 is missing."""
    db = Database(settings.db_path)
    now = now_iso()
    with db.connection() as conn:
        conn.execute("INSERT OR IGNORE INTO recorders(id, name, last_seen_at, created_at) VALUES ('nvr-1', 'NVR', ?, ?)", (now, now))
        for cid, ch, alias in (("cam-1", 1, None), ("cam-2", 2, "לובי"), ("cam-3", 3, "חניה B"), ("cam-4", 4, "")):
            conn.execute("INSERT INTO cameras(id, recorder_id, channel, name_source, alias, sort_order, created_at, updated_at) VALUES (?, 'nvr-1', ?, ?, ?, ?, ?, ?)",
                         (cid, ch, f"Camera {ch:02d}", alias, ch, now, now))


def _alias(settings, cid: str):
    with Database(settings.db_path).connection() as conn:
        return conn.execute("SELECT alias FROM cameras WHERE id = ?", (cid,)).fetchone()[0]


def _audit(settings, action: str) -> list[dict]:
    with Database(settings.db_path).connection() as conn:
        rows = conn.execute("SELECT action, decision, reason, resource_id, details_json FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()
    return [{"decision": r[1], "reason": r[2], "resource_id": r[3], "details": json.loads(r[4]) if r[4] else None} for r in rows]


@pytest.fixture()
def bundle() -> bytes:
    return _zip({"options.json": OPTIONS, "override.json": OVERRIDE, "events.jsonl": EVENTS})


def test_the_dry_run_reports_every_item_and_writes_nothing(client, settings, bundle):
    client.get("/api/v1/me")
    _seed(settings)
    r = client.post(f"{API}/dry-run", content=bundle, headers={"Content-Type": "application/zip"})
    assert r.status_code == 200, r.text
    rep = r.json()
    _no_secret(r.text)
    assert rep["schema"] == li.SCHEMA and rep["source"]["container"] == "zip" and len(rep["plan_digest"]) == 64
    by = {i["id"]: i for i in rep["items"]}
    assert (by["cameras.ch1"]["action"], by["cameras.ch1"]["value"], by["cameras.ch1"]["target"]) == ("update", "כניסה ראשית", {"camera_id": "cam-1", "channel": 1})
    assert by["cameras.ch2"]["action"] == "same"
    assert by["cameras.ch3"]["action"] == "keep" and by["cameras.ch3"]["target"]["arx_alias"] == "חניה B"
    assert by["cameras.ch7"]["action"] == "skip" and by["cameras.ch7"]["code"] == "no_arx_camera"
    assert by["cameras.ch4"]["action"] == "info" and by["cameras.ch4"]["code"] == "arx_only_camera"
    assert any(i["code"] == "bad_channel" and i["action"] == "skip" for i in rep["items"])
    # the connection is compared, never copied: another host / HTTP port / user, the same RTSP port, the password left to a person
    assert (by["connection.host"]["action"], by["connection.host"]["code"]) == ("manual", "conn_host_other")
    assert by["connection.http_port"]["action"] == "manual" and by["connection.rtsp_port"]["action"] == "same"
    assert by["connection.user"]["action"] == "manual" and by["connection.password"]["action"] == "manual"
    assert by["options.go2rtc_url"]["code"] == "go2rtc_missing"
    assert by["people.app_pin"]["action"] == "manual" and by["people.technician_pin"]["action"] == "manual"
    assert by["options.snapshot_seconds"]["action"] == "skip" and by["options.pin_length"]["action"] == "skip"
    # auto +120 (Israel's standard offset) and manual -120: 0, no warning
    assert by["time.display_offset"]["code"] == "offset_zero" and rep["time"]["effective_minutes"] == 0
    assert by["manual_recording.row0"]["action"] == "manual" and by["manual_recording.row1"]["code"] == "manual_recording_ended"
    assert by["events.store"]["target"] == {"rows": 3}
    assert by["override.unknown.legacy_extra_flag"]["action"] == "skip"
    assert {"layouts.live_grid", "schedules.recording", "notifications.all"} <= set(by)
    codes = {w["code"] for w in rep["warnings"]}
    assert "manual_recording_running" in codes and "display_offset" not in codes
    assert rep["summary"]["update"] == 1 and rep["summary"]["create"] == 0
    assert rep["writes"]["nvr"] == "none" and rep["applied_before"] == []
    # nothing written: the alias is still empty, one audit row with the counts and no secret
    assert _alias(settings, "cam-1") is None
    rows = _audit(settings, "migration.legacy.dry_run")
    assert len(rows) == 1 and rows[0]["decision"] == "allowed" and rows[0]["details"]["summary"]["update"] == 1
    _no_secret(json.dumps(rows, ensure_ascii=False))


def test_the_apply_is_bound_to_the_plan_backs_up_first_and_is_idempotent(client, settings, bundle):
    client.get("/api/v1/me")
    _seed(settings)
    digest = client.post(f"{API}/dry-run", content=bundle).json()["plan_digest"]
    r = client.post(f"{API}/apply", params={"plan_digest": digest, **CONFIRM}, content=bundle)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["applied"] == 1 and out["cameras"] == [{"camera_id": "cam-1", "channel": 1}] and out["already_applied"] is False
    assert out["backup"]["name"].startswith(li.BACKUP_KIND + "-") and (settings.data_dir / "backups" / out["backup"]["name"]).is_file()
    assert _alias(settings, "cam-1") == "כניסה ראשית"
    assert _alias(settings, "cam-2") == "לובי" and _alias(settings, "cam-3") == "חניה B", "an existing alias is never overwritten"
    cam_rows = [a for a in _audit(settings, "camera.update") if a["resource_id"] == "cam-1"]
    assert cam_rows and cam_rows[-1]["details"] == {"alias": "כניסה ראשית", "via": "legacy_import"}
    applied = _audit(settings, "migration.legacy.apply")
    assert applied[-1]["decision"] == "allowed" and applied[-1]["details"]["backup"] == out["backup"]["name"]
    assert applied[-1]["details"]["confirm_word"] == "he"
    _no_secret(json.dumps(applied, ensure_ascii=False))
    # the same file again: a new plan with nothing to write, no backup, recorded as already applied
    rep2 = client.post(f"{API}/dry-run", content=bundle).json()
    assert rep2["summary"]["update"] == 0 and len(rep2["applied_before"]) == 1
    r2 = client.post(f"{API}/apply", params={"plan_digest": rep2["plan_digest"], "confirm": "  ImPoRt LeGaCy "}, content=bundle)
    assert r2.status_code == 200, r2.text
    assert (r2.json()["applied"], r2.json()["backup"], r2.json()["already_applied"]) == (0, None, True)
    assert len(list((settings.data_dir / "backups").glob(f"{li.BACKUP_KIND}-*.zip"))) == 1
    status = client.get(API).json()
    assert [run["applied"] for run in status["runs"]] == [0, 1]
    assert status["confirm"] == {"he": "ייבוא מהמערכת הישנה", "en": "import legacy"}


def test_the_apply_refuses_a_changed_plan_a_missing_word_and_a_failed_backup(client, settings, bundle, monkeypatch):
    client.get("/api/v1/me")
    _seed(settings)
    digest = client.post(f"{API}/dry-run", content=bundle).json()["plan_digest"]
    r = client.post(f"{API}/apply", params={"plan_digest": digest, "confirm": "import"}, content=bundle)
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"
    r = client.post(f"{API}/apply", params={"plan_digest": "0" * 64, **CONFIRM}, content=bundle)
    assert r.status_code == 409 and r.json()["code"] == "legacy_plan_changed"
    # Arx changed after the dry run (someone named camera 1): the old digest no longer applies
    client.patch("/api/v1/cameras/cam-1", json={"alias": "שער"})
    r = client.post(f"{API}/apply", params={"plan_digest": digest, **CONFIRM}, content=bundle)
    assert r.status_code == 409 and r.json()["code"] == "legacy_plan_changed"
    assert _alias(settings, "cam-1") == "שער"
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE cameras SET alias = NULL WHERE id = 'cam-1'")
    digest = client.post(f"{API}/dry-run", content=bundle).json()["plan_digest"]

    from smplwise.services import backup as backup_svc

    def boom(*a, **k):
        raise OSError("disk full")

    monkeypatch.setattr(backup_svc, "create", boom)
    r = client.post(f"{API}/apply", params={"plan_digest": digest, **CONFIRM}, content=bundle)
    assert r.status_code == 409 and r.json()["code"] == "legacy_backup_failed"
    assert _alias(settings, "cam-1") is None, "no backup, no change"
    reasons = [a["reason"] for a in _audit(settings, "migration.legacy.apply")]
    assert reasons == ["plan_changed", "plan_changed", "backup_failed"]


def test_only_a_system_administrator_and_a_readable_file(client, settings, bundle):
    client.get("/api/v1/me")
    for method, path in (("get", API), ("post", f"{API}/dry-run"), ("post", f"{API}/apply")):
        kw = {"content": bundle} if method == "post" else {}
        params = {"plan_digest": "0" * 64, **CONFIRM} if path.endswith("apply") else None
        r = getattr(client, method)(path, headers=as_user("dana"), params=params, **kw)
        assert r.status_code == 403, (path, r.text)
    r = client.post(f"{API}/dry-run", content=_ha_backup(protected=True))
    assert r.status_code == 422 and r.json()["code"] == "legacy_backup_protected"
    r = client.post(f"{API}/dry-run", content=b"plain text")
    assert r.status_code == 422 and r.json()["code"] == "legacy_source_invalid" and r.json()["details"]["reason"] == "unsupported_format"
    r = client.post(f"{API}/dry-run", content=b"{" + b" " * ls.MAX_INPUT_BYTES + b"}")
    assert r.status_code == 413 and r.json()["code"] == "payload_too_large", "the body-size middleware answers before a byte is read"
    from smplwise import body_limit as bl

    assert bl.route_limit("POST", f"{API}/apply", settings) == (ls.MAX_INPUT_BYTES, "legacy_import")
    assert bl.route_limit("POST", f"{API}/dry-run", settings) == (ls.MAX_INPUT_BYTES, "legacy_import")


def test_the_report_speaks_english_to_an_english_reader(settings, client):
    client.get("/api/v1/me")
    _seed(settings)
    src = ls.read_parts(options=OPTIONS, override=OVERRIDE, events=EVENTS)
    with Database(settings.db_path).connection() as conn:
        rep = li.plan(conn, settings, src, "en")
    heb = re.compile("[֐-׿]")
    for it in rep["items"]:
        assert not heb.search(it["note"]), it
    for w in rep["warnings"]:
        assert not heb.search(w["note"]), w


def test_a_nonzero_legacy_display_offset_is_a_warning(settings, client):
    client.get("/api/v1/me")
    ov = {**json.loads(OVERRIDE), "recording_display_offset_mode": "auto"}
    src = ls.read_parts(options=OPTIONS, override=json.dumps(ov).encode())
    with Database(settings.db_path).connection() as conn:
        rep = li.plan(conn, settings, src, "he")
    assert rep["time"]["effective_minutes"] == 120
    assert any(w["code"] == "display_offset" for w in rep["warnings"])
    assert next(i for i in rep["items"] if i["id"] == "time.display_offset")["code"] == "offset_nonzero"
