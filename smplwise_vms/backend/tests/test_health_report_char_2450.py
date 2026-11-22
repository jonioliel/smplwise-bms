"""CR-BE-COMPLEXITY-2450 - characterisation of `services.health_report.build` (code review 03:F22: "start with health_report.build,
a list of independent checks"), recorded BEFORE the function was split into one helper per check family.

Every scenario pins the report's behaviour - which checks appear, in which order, their status, their label, the shape of their
detail text (digits folded to '#': ages and sizes move) and their meta keys, plus the overall status, mode and capability block -
under deterministic stand-ins for the parts that touch the machine or the network (disk usage, folder sizes, the device probes,
the crash record, the vendor-portal and transit counters). The recording lives in tests/fixtures/health_report_char_2450.json;
`SW_RECORD_CHAR=1` re-records it (only ever on the commit BEFORE a refactor, never to make a refactor pass)."""
from __future__ import annotations

import dataclasses
import json
import os
import re
from collections import namedtuple
from pathlib import Path

import pytest

from smplwise.db import Database, now_iso
from smplwise.main import create_app
from smplwise.services import health_report as hr
from smplwise.services import backup as backup_svc
from smplwise.services import autosync, events_derive, events_ingest, secrets_store, thumbnails
from smplwise.services.tickets import public_portal
from smplwise.services.transit import health as transit_health

GOLDEN = Path(__file__).resolve().parent / "fixtures" / "health_report_char_2450.json"
DIGITS = re.compile(r"\d+")
_Usage = namedtuple("_Usage", "total used free")

PROBE_OK = {"status": "ok", "detail": "probe ok 12 ms", "configured": True, "version": "1.2.3"}
PROBE_DOWN = {"status": "error", "detail": "probe refused", "configured": True}
RESTARTS = {"count_total": 2, "crashes_24h": 1, "safe_mode": False, "last_at": "2026-11-19T01:02:03Z", "last_signal": "SIGSEGV",
            "last_uptime_s": 40, "supervised": True}
NO_RESTARTS = {"count_total": 0, "crashes_24h": 0, "safe_mode": False, "last_at": None, "last_signal": None, "last_uptime_s": None,
               "supervised": False}
PORTAL_BUSY = {"running": True, "depth": 3, "max": 50, "accepted": 9, "dropped": 2, "dropped_1h": 1, "last_drop_at": 1}
PORTAL_IDLE = {"running": False, "depth": 0, "max": 50, "accepted": 0, "dropped": 0, "dropped_1h": 0, "last_drop_at": None}
TRANSIT_OFF = {"state": "off"}
NO_BACKUPS = {"full_probed_down", "ha_only_no_go2rtc"}  # every other scenario has one fresh backup (else every report is an error)


def _transit(state: str) -> dict:
    return {"state": state, "age_s": 300 if state != "down" else None, "last_ok_at": "2026-11-19T00:00:00", "last_good_at": "2026-11-19T00:00:00",
            "outage": state == "source_down", "errors": 4, "codes_in_use": 2, "last_error": "timeout" if state != "ok" else None}


# name -> (settings changes, probe, nvr probe, go2rtc probe, restarts, lingering secret options, portal stats, transit view, free bytes)
SCENARIOS = {
    "default_no_probe": ({}, False, PROBE_OK, PROBE_OK, NO_RESTARTS, [], PORTAL_IDLE, TRANSIT_OFF, 50 * 1024**3),
    "full_probed_ok": ({"nvr_user": "u", "nvr_password": "p", "go2rtc_url": "http://go2rtc.fixture.test:1984"}, True, PROBE_OK, PROBE_OK,
                       NO_RESTARTS, [], PORTAL_IDLE, TRANSIT_OFF, 50 * 1024**3),
    "full_probed_down": ({"nvr_user": "u", "nvr_password": "p", "go2rtc_url": "http://go2rtc.fixture.test:1984"}, True, PROBE_DOWN, PROBE_DOWN,
                         RESTARTS, ["nvr_password"], PORTAL_BUSY, _transit("stale"), 1024**3),
    "nvr_without_go2rtc": ({"nvr_user": "u", "nvr_password": "p", "go2rtc_url": None}, True, PROBE_OK, PROBE_OK,
                           NO_RESTARTS, [], PORTAL_IDLE, _transit("ok"), 100 * 1024**2),
    "ha_only_probed_go2rtc": ({"nvr_host": None, "nvr_user": None, "nvr_password": None, "go2rtc_url": "http://go2rtc.fixture.test:1984"}, True,
                              PROBE_OK, PROBE_OK, NO_RESTARTS, [], PORTAL_IDLE, _transit("source_down"), 50 * 1024**3),
    "ha_only_no_go2rtc": ({"nvr_host": None, "nvr_user": None, "nvr_password": None, "go2rtc_url": None}, True, PROBE_OK, PROBE_OK,
                          RESTARTS, [], PORTAL_BUSY, _transit("down"), 50 * 1024**3),
    "ha_only_not_probed": ({"nvr_host": None, "nvr_user": None, "nvr_password": None, "go2rtc_url": "http://go2rtc.fixture.test:1984"}, False,
                           PROBE_OK, PROBE_OK, NO_RESTARTS, ["ha_token"], PORTAL_IDLE, TRANSIT_OFF, 50 * 1024**3),
}


def _fold(value):
    if isinstance(value, str):
        return DIGITS.sub("#", value)
    if isinstance(value, dict):
        return {k: _fold(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_fold(v) for v in value]
    return value


def _project(report: dict) -> dict:
    return {
        "keys": sorted(report),
        "status": report["status"],
        "mode": report["mode"],
        "probe_ttl_s": report["probe_ttl_s"],
        "capabilities": _fold(report["capabilities"]),
        "installation": _fold(report["installation"]),
        "checks": [{"id": c["id"], "status": c["status"], "label": c["label"], "detail": _fold(c["detail"]), "meta": sorted(c.get("meta") or {})}
                   for c in report["checks"]],
    }


def _run(settings, monkeypatch, name: str) -> dict:
    changes, probe, nvr, go, restarts, lingering, portal, transit, free = SCENARIOS[name]
    s = dataclasses.replace(settings, **changes)
    monkeypatch.setattr(hr.shutil, "disk_usage", lambda _p: _Usage(100 * 1024**3, 100 * 1024**3 - free, free))
    monkeypatch.setattr(hr, "_dir_size", lambda _p: 4096)
    monkeypatch.setattr(hr, "_probe_nvr", lambda _s: dict(nvr))
    monkeypatch.setattr(hr, "_probe_go2rtc", lambda _s: dict(go))
    monkeypatch.setattr(hr, "_restarts_view", lambda _s: dict(restarts))
    monkeypatch.setattr(secrets_store, "LINGERING_OPTIONS", list(lingering))
    monkeypatch.setattr(public_portal, "worker_stats", lambda: dict(portal))
    monkeypatch.setattr(transit_health, "view", lambda _conn, _now: dict(transit))
    backups = [] if name in NO_BACKUPS else [{"name": "arx-backup-1.zip", "kind": "manual", "created_at": now_iso()}]
    monkeypatch.setattr(backup_svc, "list_backups", lambda _s: list(backups))
    # RELEASE-2450-TRAIN gate run 1: the report reads four module-level job states that no per-test reset puts back yet
    # (tests/singletons_unregistered.txt); a test earlier in the same shard left one of them failed and `default_no_probe` came out
    # `error`. The characterisation starts from their import-time values.
    monkeypatch.setattr(events_ingest, "STATE", events_ingest.IngestState())
    monkeypatch.setattr(events_derive, "STATE", {"last_run": None, "last_ok": None, "last_error": None, "derived": 0})
    monkeypatch.setattr(autosync, "STATE", dict(autosync._EMPTY_STATE))
    monkeypatch.setattr(thumbnails, "STATE", {"queued": 0, "generated": 0, "failed": 0, "last_error": None, "busy": None})
    hr.invalidate()
    with Database(settings.db_path).connection() as conn:
        return _project(hr.build(s, conn, probe=probe))


@pytest.fixture
def app_settings(settings):
    create_app(settings)  # the schema
    return settings


def test_health_report_build_is_characterised(app_settings, monkeypatch):
    got = {name: _run(app_settings, monkeypatch, name) for name in SCENARIOS}
    if os.environ.get("SW_RECORD_CHAR") == "1":
        GOLDEN.write_text(json.dumps(got, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    want = json.loads(GOLDEN.read_text(encoding="utf-8"))
    assert sorted(got) == sorted(want)
    for name in SCENARIOS:
        assert got[name] == want[name], name


def test_the_scenarios_cover_every_check_family():
    want = json.loads(GOLDEN.read_text(encoding="utf-8"))
    ids = {c["id"] for sc in want.values() for c in sc["checks"]}
    assert {"db", "storage", "nvr", "go2rtc", "ha_sync", "bridge", "events_ingest", "events_derive", "discovery", "video_webrtc", "thumbnails",
            "exports", "sessions", "backups", "portal_start", "transit", "process_restarts", "secret_options"} <= ids
    assert {sc["status"] for sc in want.values()} >= {"warn", "error"}
    assert {c["status"] for sc in want.values() for c in sc["checks"] if c["id"] == "go2rtc"} >= {"ok", "error", "off", "warn"}
