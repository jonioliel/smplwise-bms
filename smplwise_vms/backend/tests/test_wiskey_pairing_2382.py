"""WISKEY-PAIRING-2382: the "חיבור Arx ל-WisKey" status block - every state of GET /system/wiskey-pairing, the read-only probe against the
in-memory fake of WisKey's direct socket (tests/w10_fake_direct.py via test_wkjoin_295.JoinServer: its own HMAC, it closes a refused connect
without a word as WisKey does), and the guided re-pair. Synthetic keys only; nothing contacts WisKey, Home Assistant or a station."""
from __future__ import annotations

import json
import time

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_wkjoin_295 import JoinServer
from w10_fake_station import SECRET

from smplwise import remote_channel
from smplwise.db import Database, now_iso, set_setting
from smplwise.main import create_app
from smplwise.services import bridge_keys as bk
from smplwise.services import bridge_rotation as br
from smplwise.services import intercom_sync
from smplwise.services import wiskey_media_contract as w10
from smplwise.services import wiskey_pairing as wp

API = "/api/v1/system/wiskey-pairing"
MEDIA = set(w10.COMMANDS)
DISCOVERY = {"direct/capabilities", "direct/time"}


@pytest.fixture()
def world(settings):
    bk.reset_for_tests()
    wp.reset_for_tests()
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/me")
    db = Database(settings.db_path)
    saved = intercom_sync.STATE.wiskey_version
    yield {"c": c, "db": db, "settings": settings}
    intercom_sync.STATE.wiskey_version = saved
    wp.reset_for_tests()
    bk.reset_for_tests()


def _pair(w, secret: str = SECRET, *, fresh: bool = True) -> None:
    with w["db"].connection() as conn:
        set_setting(conn, "bridge.secret", secret)
        set_setting(conn, "bridge.paired_at", "2026-11-03T08:00:00+00:00")
        set_setting(conn, "bridge.integration_version", "0.10.2")
        set_setting(conn, "bridge.directory_at", now_iso() if fresh else "2026-11-01T08:00:00+00:00")


def _server(secret: str = SECRET, commands: set[str] | None = None) -> JoinServer:
    s = JoinServer(secret=secret)
    s.discovered = DISCOVERY | (MEDIA if commands is None else commands)
    wp.set_opener_for_tests(s.opener)
    return s


def _feed(monkeypatch, commands) -> None:
    from smplwise.services import intercom_media

    monkeypatch.setattr(intercom_media, "_feed_discovery", lambda settings: None if commands is None else {"commands": commands})


def _lines(body) -> dict:
    return {ln["key"]: ln for ln in body["lines"]}


def _probe(w):
    r = w["c"].post(f"{API}/probe")
    assert r.status_code == 200, r.text
    return r.json()


# ================================================================ states

def test_not_paired_no_key_everything_says_how_to_fix(world):
    body = world["c"].get(API).json()
    ln = _lines(body)
    assert list(ln) == ["bridge", "component", "key", "acceptance", "discovery", "provider", "rotation", "last_error"]
    assert body["verdict"] == "not_paired" and body["paired"] is False and body["talk_ready"] is False
    assert ln["bridge"]["state"] == "blocked" and ln["bridge"]["reason"] == "bridge_not_paired"
    assert ln["key"]["state"] == "blocked" and ln["key"]["reason"] == "key_missing" and ln["key"]["facts"]["present"] is False
    assert ln["acceptance"]["reason"] == "probe_not_run" and ln["acceptance"]["state"] == "unknown"
    assert body["repair"] == {**body["repair"], "available": True, "reason": "key_missing", "announce": False}
    for line in body["lines"]:  # every non-ok line carries a plain Hebrew "how to fix"; an ok line none
        assert (line["fix"] is None) == (line["state"] == "ok"), line
        if line["fix"]:
            assert any("֐" <= ch <= "׿" for ch in line["fix"]) and "Home Assistant" not in line["fix"] + line["text"]


def test_paired_and_accepted_with_all_six_commands(world, monkeypatch):
    _pair(world)
    intercom_sync.STATE.wiskey_version = "2.0.1-rc.10"
    srv = _server()
    body = _probe(world)
    ln = _lines(body)
    assert body["verdict"] == "paired" and body["paired"] is True
    assert ln["bridge"]["state"] == "ok" and ln["bridge"]["facts"]["active_version"] == "0.10.2"
    assert ln["component"]["state"] == "ok" and ln["component"]["facts"] == {"version": "2.0.1-rc.10", "mode": "manual", "feed_state": intercom_sync.STATE.state}
    assert ln["key"]["state"] == "ok" and ln["key"]["facts"]["can_sign"] is True and ln["key"]["facts"]["fingerprint"] == wp.fingerprint(SECRET)
    assert ln["acceptance"]["state"] == "ok" and ln["acceptance"]["facts"]["service_subject"] is True and ln["acceptance"]["facts"]["repository"] is True
    assert ln["discovery"]["state"] == "ok" and all(ln["discovery"]["facts"]["listed"].values()) and ln["discovery"]["facts"]["source"] == "direct"
    assert ln["last_error"]["state"] == "ok"
    assert body["repair"]["available"] is False
    sent = [cmd for cmd, _kind, _p in srv.received]
    assert sent == ["direct/capabilities", "direct/time"], "the probe sends reads only"
    # the default media path is Arx's own: paired, but talk does not ride WisKey until the owner picks "auto"
    assert ln["provider"]["state"] == "blocked" and body["talk_ready"] is False
    assert any("מקור הווידאו והדיבור" in s and "WisKey (וידאו ודיבור)" in s for s in body["owner_steps"])
    with world["db"].connection() as conn:
        set_setting(conn, "access.station_media_provider", "auto")
        set_setting(conn, br.FLAG_KEY, "off")
    # lab 03.11: `auto`, but the service feed's overview.api.commands lists no W10 command - provider_for keeps Arx's own source
    body = world["c"].get(API).json()
    pl = _lines(body)["provider"]
    assert pl["state"] == "blocked" and pl["reason"] == "provider_feed_gate" and pl["facts"]["feed_reason"] == "discovery_unknown" and pl["facts"]["choice"] == "auto"
    assert body["talk_ready"] is False and "discovery_unknown" in pl["text"]
    _feed(monkeypatch, list(w10.COMMANDS))
    body = world["c"].get(API).json()
    assert body["talk_ready"] is True and _lines(body)["provider"]["state"] == "ok" and _lines(body)["rotation"]["state"] == "ok"
    assert all(ln["state"] == "ok" for ln in body["lines"]), [(x["key"], x["reason"]) for x in body["lines"]]


def test_wiskey_refuses_a_different_key(world):
    _pair(world, "a-different-synthetic-pairing-code-0001")
    _server(secret=SECRET)
    body = _probe(world)
    ln = _lines(body)
    assert ln["key"]["state"] == "ok"
    assert ln["acceptance"]["state"] == "blocked" and ln["acceptance"]["reason"] == "refused" and ln["acceptance"]["facts"]["code"] == "direct_connect_refused"
    assert body["verdict"] == "not_paired" and body["repair"]["available"] is True and body["repair"]["reason"] == "refused"
    assert ln["last_error"]["state"] == "warn" and ln["last_error"]["facts"]["probe"] == "direct_connect_refused"
    assert body["owner_steps"] and "SMPLWISE Bridge" in body["owner_steps"][0]


def test_unreachable_direct_api_is_unknown_not_refused(world):
    _pair(world)
    s = _server()
    s.refuse_open = True
    body = _probe(world)
    ln = _lines(body)
    assert ln["acceptance"]["state"] == "unknown" and ln["acceptance"]["reason"] == "unreachable"
    assert body["verdict"] == "unknown" and body["paired"] is None and body["repair"]["available"] is False


def test_rotated_key_is_refused_before_anything_is_sent(world):
    _pair(world)
    with world["db"].connection() as conn:
        bk.adopt_legacy(conn, world["settings"].data_dir)
        bk.set_state(conn, bk.LEGACY_KID, "retired")
        bk.insert(conn, world["settings"].data_dir, kid="g1-aaaaaaaa", generation=1, state="current", material=bk.new_material(), rotation_id=None)
    srv = _server()
    body = _probe(world)
    ln = _lines(body)
    assert ln["key"]["reason"] == "key_rotated" and ln["key"]["facts"]["kid"] == "g1-aaaaaaaa" and ln["key"]["facts"]["fingerprint"] is None
    assert ln["acceptance"]["reason"] == "probe_key" and ln["rotation"]["reason"] == "rotation_done"
    assert srv.opened == 0, "a rotated key opens no socket"
    assert body["repair"]["reason"] == "key_rotated"


def test_unreadable_key_set(world, monkeypatch):
    _pair(world)
    with world["db"].connection() as conn:
        bk.adopt_legacy(conn, world["settings"].data_dir)
    real = bk.status
    monkeypatch.setattr(bk, "status", lambda conn, data_dir, limit=10: {**real(conn, data_dir, limit), "current": {**real(conn, data_dir, limit)["current"], "readable": False}})
    ln = _lines(world["c"].get(API).json())
    assert ln["key"]["reason"] == "key_unreadable" and ln["key"]["state"] == "blocked"


@pytest.mark.parametrize("commands,reason", [(set(w10.VIDEO_COMMANDS), "discovery_talk_missing"), (set(), "discovery_media_missing")])
def test_discovery_without_the_media_or_talk_commands(world, commands, reason):
    _pair(world)
    _server(commands=commands)
    ln = _lines(_probe(world))
    assert ln["acceptance"]["state"] == "ok"
    assert ln["discovery"]["state"] == "blocked" and ln["discovery"]["reason"] == reason


def test_clock_skew_is_reported(world):
    _pair(world)
    s = _server()
    s.clock_offset_s = 30.0
    ln = _lines(_probe(world))
    assert ln["discovery"]["reason"] == "discovery_clock" and ln["discovery"]["facts"]["clock"] == "clock_skew"


def test_bridge_silent_and_update_pending(world):
    _pair(world, fresh=False)
    ln = _lines(world["c"].get(API).json())
    assert ln["bridge"]["state"] == "warn" and ln["bridge"]["reason"] == "bridge_silent"
    from smplwise.services import bridge_install

    _pair(world)
    saved = bridge_install.STATE.get("installed_version")
    bridge_install.STATE["installed_version"] = "0.10.3"
    try:
        ln = _lines(world["c"].get(API).json())
        assert ln["bridge"]["reason"] == "bridge_update_pending"
    finally:
        bridge_install.STATE["installed_version"] = saved


def test_rotation_switch_on_is_a_warning_with_a_fix(world):
    _pair(world)
    ln = _lines(world["c"].get(API).json())
    assert ln["rotation"]["state"] == "warn" and ln["rotation"]["reason"] == "rotation_risk" and ln["rotation"]["fix"]


def test_probe_is_rate_limited_and_audited_without_secrets(world):
    _pair(world)
    srv = _server()
    _probe(world)
    _probe(world)  # within 5 s: the last answer, nothing sent again
    assert srv.opened == 1
    body = world["c"].get(API).json()
    raw = json.dumps(body, ensure_ascii=False)
    assert SECRET not in raw and "entry-1" not in raw
    with world["db"].connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'wiskey.pairing.probe'").fetchall()
    assert len(rows) == 1 and SECRET not in rows[0][0]
    assert json.loads(rows[0][0])["accepted"] is True


def test_get_sends_nothing(world):
    _pair(world)
    srv = _server()
    world["c"].get(API)
    assert srv.opened == 0


# ================================================================ guided re-pair

def test_repair_rbac_confirm_and_not_needed(world, settings):
    c = world["c"]
    with world["db"].connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('cfg_x', 'cfg_x', ?, ?, ?)",
                     (json.dumps(["system.configure"]), now_iso(), now_iso()))
    c.get("/api/v1/me", headers=as_user("cfgu"))
    bind(c, settings, "cfgu", "cfg_x", "installation", "*")
    c.get("/api/v1/me", headers=as_user("vera"))
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert c.get(API, headers=as_user("cfgu")).status_code == 200
    assert c.get(API, headers=as_user("vera")).status_code == 403
    assert c.post(f"{API}/probe", headers=as_user("vera")).status_code == 403
    r = c.post(f"{API}/probe", headers=as_user("cfgu"))
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin"
    r = c.post(f"{API}/repair", json={"confirm": True}, headers=as_user("cfgu"))
    assert r.status_code == 403 and r.json()["code"] == "not_system_admin"
    assert c.post(f"{API}/repair", json={"confirm": False}).status_code == 422
    _pair(world)
    _server()
    _probe(world)
    r = c.post(f"{API}/repair", json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "repair_not_needed"
    with world["db"].connection(mode="read") as conn:
        reasons = [r[0] for r in conn.execute("SELECT reason FROM audit_log WHERE action = 'wiskey.pairing.repair' AND decision = 'denied'").fetchall()]
    assert reasons == ["not_system_admin", "repair_not_needed"]
    with world["db"].connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'wiskey.pairing.probe' AND decision = 'denied' AND reason = 'not_system_admin'").fetchone()[0] == 1


def test_repair_of_a_rotated_key_gives_a_new_plain_code_and_pauses_rotation(world):
    _pair(world)
    with world["db"].connection() as conn:
        bk.adopt_legacy(conn, world["settings"].data_dir)
        bk.set_state(conn, bk.LEGACY_KID, "retired")
        bk.insert(conn, world["settings"].data_dir, kid="g1-bbbbbbbb", generation=1, state="current", material=bk.new_material(), rotation_id=None)
    r = world["c"].post(f"{API}/repair", json={"confirm": True})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["announced"] is False and out["rotation_paused"] is True  # no Supervisor in tests: the owner types the code
    assert isinstance(out["pairing_code"], str) and len(out["pairing_code"]) >= 24
    assert any("SMPLWISE Bridge" in s for s in out["steps"])
    ln = _lines(out["status"])
    assert ln["key"]["state"] == "ok" and ln["key"]["facts"]["kid"] == "plain" and ln["rotation"]["state"] == "ok"
    assert ln["acceptance"]["reason"] == "probe_not_run", "the previous probe is forgotten"
    with world["db"].connection(mode="read") as conn:
        assert not bk.adopted(conn) and br.mode(conn) == "off"
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'wiskey.pairing.repair' AND decision = 'allowed'").fetchone()
        assert row is not None and out["pairing_code"] not in row[0]
        assert json.loads(row[0]) == {"reason": "key_rotated", "announced": False, "rotation_paused": True}
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'settings.changed' AND details_json LIKE '%wiskey.pairing.repair%'").fetchone()[0] == 1
    # the new code is the one WisKey's fake now accepts once the bridge carries it
    _server(secret=out["pairing_code"])
    assert _probe(world)["verdict"] == "paired"


def test_repair_keeps_rotation_when_asked(world):
    r = world["c"].post(f"{API}/repair", json={"confirm": True, "pause_rotation": False})
    assert r.status_code == 200 and r.json()["rotation_paused"] is False
    with world["db"].connection(mode="read") as conn:
        assert br.mode(conn) == "on"


def test_repair_refused_while_a_rotation_runs(world):
    with world["db"].connection() as conn:
        conn.execute("INSERT INTO bridge_rotations(id, mode, state, kid_from, kid_to, gen_from, gen_to, overlap_s, started_at) VALUES (?,?,?,?,?,?,?,?,?)",
                     ("rot-x", "routine", "published", "g0-legacy", "g1-cccccccc", 0, 1, 90, now_iso()))
    r = world["c"].post(f"{API}/repair", json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "rotation_in_progress"


def test_the_block_is_local_only():
    assert any(p == API for p in remote_channel.BLOCKED_ON_REMOTE)


def test_fingerprint_is_short_and_not_the_key():
    fp = wp.fingerprint(SECRET)
    assert len(fp) == 9 and fp[4] == "-" and fp.replace("-", "") not in SECRET
    assert wp.fingerprint(SECRET) == fp and wp.fingerprint(SECRET + "x") != fp


def test_probe_timeout_is_unknown(world, monkeypatch):
    _pair(world)
    _server()
    monkeypatch.setattr(wp, "PROBE_TIMEOUT_S", 0.0)
    ln = _lines(_probe(world))
    assert ln["acceptance"]["state"] == "unknown" and ln["acceptance"]["facts"]["code"] == "probe_timeout"
    assert time.time() > 0


@pytest.mark.parametrize("api,reason,state", [(None, "discovery_unknown", "blocked"), ([], "not_listed", "blocked"),
                                               (list(w10.VIDEO_COMMANDS), None, "warn"), (list(w10.COMMANDS), None, "ok")])
def test_provider_line_shows_the_feed_listing_reason(world, monkeypatch, api, reason, state):
    with world["db"].connection() as conn:
        set_setting(conn, "access.station_media_provider", "auto")
    _feed(monkeypatch, api)
    pl = _lines(world["c"].get(API).json())["provider"]
    assert pl["state"] == state and pl["facts"]["feed_reason"] == reason and pl["facts"]["choice"] == "auto"
    dl = _lines(world["c"].get(API).json())["discovery"]
    assert dl["facts"]["feed_reason"] == reason


def test_feed_listing_api_incompatible(world, monkeypatch):
    from smplwise.services import intercom_media

    monkeypatch.setattr(intercom_media, "_feed_discovery", lambda settings: {"commands": list(w10.COMMANDS), "min_client": 10 ** 6})
    assert wp.feed_listing(world["settings"]) == (False, False, "api_incompatible")


# ================================================================ T3 "מצב WisKey": built-but-off features, each with its reason

def _features(body) -> dict:
    return {f["key"]: f for f in body["features"]}


def test_features_list_the_checklist_with_reasons_and_fixes(world):
    body = world["c"].get(API).json()
    feats = _features(body)
    for key in ("direct_api", "w10_video", "w10_talk", "w10_sound", "listen", "native_people_writes", "service_writer", "readback", "csv_preview",
                "capture_lease", "door_release", "programs_save", "door_windows", "emergency_open", "emergency_lock", "door_automations",
                "feature_host", "live_media_feature", "template_send", "template_queue", "event_cursor", "relay_map_stage", "job_approvals",
                "managed_install", "generation_journal"):
        assert key in feats, key
    for f in body["features"]:
        assert f["state"] in ("on", "off", "blocked", "unknown"), f
        if f["state"] != "on":
            assert f["reasons"], f
        for r in f["reasons"]:
            assert r["kind"] in ("SET", "POL", "PAIR", "WK", "OWN", "RUN") and any("֐" <= ch <= "׿" for ch in r["text"])
            assert "Home Assistant" not in r["text"] + (r["fix"] or "")
    codes = lambda k: [r["code"] for r in feats[k]["reasons"]]  # noqa: E731
    # a fresh installation: no key, provider local, policy B
    assert codes("direct_api") == ["provider_local", "key_missing"]
    assert "media_off" in codes("w10_talk") and "feed_not_listed" in codes("w10_talk")
    assert codes("managed_install") == ["policy_b", "owner_on_not_permitted"]
    assert "service_grant_manual" in codes("service_writer")
    assert codes("capture_lease") == ["not_built"] and codes("emergency_lock") == ["lock_unsupported"]
    assert "listen_no_downlink" in codes("listen")


def test_features_follow_the_pairing_and_the_switches(world, monkeypatch):
    from smplwise.services import wiskey_direct_join

    _pair(world)
    _server()
    with world["db"].connection() as conn:
        set_setting(conn, "access.station_media_provider", "auto")
        set_setting(conn, "access.station_media", "video_talk")
    feats = _features(world["c"].get(API).json())
    assert [r["code"] for r in feats["direct_api"]["reasons"]] == ["join_not_started", "not_proven"]
    assert any(r["kind"] == "RUN" for r in feats["direct_api"]["reasons"])
    monkeypatch.setattr(wiskey_direct_join, "JOIN", object())
    feats = _features(_probe(world))
    assert feats["direct_api"]["state"] == "on" and feats["direct_api"]["reasons"] == []
    # the lab 03.11: signed path fine, but the feed lists no W10 command -> talk still blocked, and says why
    assert [r["code"] for r in feats["w10_talk"]["reasons"]] == ["feed_not_listed"]
    assert "discovery_unknown" in feats["w10_talk"]["reasons"][0]["text"]
    _feed(monkeypatch, list(w10.COMMANDS))
    feats = _features(world["c"].get(API).json())
    assert feats["w10_talk"]["state"] == "on" and feats["w10_video"]["state"] == "on"
    with world["db"].connection() as conn:
        set_setting(conn, "doors.windows.enabled", "on")
    assert _features(world["c"].get(API).json())["door_windows"]["state"] == "on"


def test_a_broken_feature_check_is_unknown_not_on(world, monkeypatch):
    from smplwise.services import intercom_doors

    monkeypatch.setattr(intercom_doors, "unmapped_summary", lambda conn: 1 / 0)
    f = _features(world["c"].get(API).json())["door_release"]
    assert f["state"] == "unknown" and f["reasons"][0]["code"] == "check_failed"


def test_feature_status_reads_only(world):
    with world["db"].connection(mode="read") as conn:
        before = conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0], conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    world["c"].get(API)
    with world["db"].connection(mode="read") as conn:
        after = conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0], conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    assert before == after


def test_provider_line_uses_the_talk_dial_row_and_its_readiness_codes(world, monkeypatch):
    """WISKEY-TALK-DIAL-2382 owns the row and GET /access-control/station-media/readiness: the same label, value words and closed codes here."""
    pl = _lines(world["c"].get(API).json())["provider"]
    assert pl["label"] == "מקור הווידאו והדיבור" and "Arx (וידאו בלבד)" in pl["text"]
    assert pl["facts"]["row"]["label"] == "מקור הווידאו והדיבור" and pl["facts"]["row"]["href"].endswith("tab=access-control")
    assert set(pl["facts"]["readiness"]) <= set(wp.READINESS_CODES) and "pairing_missing" in pl["facts"]["readiness"]
    _pair(world)
    with world["db"].connection() as conn:
        bk.adopt_legacy(conn, world["settings"].data_dir)
        bk.set_state(conn, bk.LEGACY_KID, "retired")
        bk.insert(conn, world["settings"].data_dir, kid="g1-dddddddd", generation=1, state="current", material=bk.new_material(), rotation_id=None)
    _feed(monkeypatch, [])
    codes = _lines(world["c"].get(API).json())["provider"]["facts"]["readiness"]
    assert codes[-3:] == ["video_not_listed", "talk_not_listed", "pairing_key_rotated"]


def test_the_probe_sends_only_the_two_discovery_reads():
    """T06 admission (tests/test_t06_admission_295.py pins wiskey_pairing.py as a signing caller): its only signed commands are the two
    discovery reads, through DirectDiscovery - no command name of its own is put on the wire."""
    import ast
    from pathlib import Path

    from smplwise.services import wiskey_direct_discovery as dd

    src = Path(wp.__file__).read_text(encoding="utf-8")
    literals = {n.value for n in ast.walk(ast.parse(src)) if isinstance(n, ast.Constant) and isinstance(n.value, str) and "/" in n.value and " " not in n.value}
    assert not {x for x in literals if x.startswith(("users/", "media/talk", "stations/", "features/", "jobs/", "installation/"))}
    assert (dd.CAPABILITIES, dd.TIME) == ("direct/capabilities", "direct/time")
