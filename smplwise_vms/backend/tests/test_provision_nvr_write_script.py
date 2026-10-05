"""scripts/provision_nvr_write.py (the one sanctioned entry point for writes to the real Provision NVR) against the fake device:
whitelist, dry run (redacted, nothing written), before-value log + restore store before any write, verify by read-back,
restore-from-log, and no credential / address in what it prints or logs."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, FakeProvision  # noqa: E402

spec = importlib.util.spec_from_file_location("provision_nvr_write", ROOT / "scripts" / "provision_nvr_write.py")
pnw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pnw)


@pytest.fixture()
def world(tmp_path):
    from smplwise.services.recorders import provision_isr as pisr

    pisr.clear_auth_cache()
    fake = FakeProvision()
    fake.shape = "live"
    # the write paths below need a recorder that accepts SetAlarmServerConfig; the owner's 1.4.7 unit does not (no
    # GetSupportedAPIs, v1 answer shape) - that case is the NN2A protocol-fix tests at the end of this file
    fake.supported_apis = ["GetAlarmServerConfig", "SetAlarmServerConfig"]
    env = tmp_path / "lab.env"
    env.write_text(f"PROVISION_NVR_URL=http://{HOST}:80\nPROVISION_NVR_USER={USER}\nPROVISION_NVR_PASS={PASSWORD}\n", encoding="utf-8")
    lines: list[str] = []

    def run(*argv: str) -> int:
        return pnw.main(["--env", str(env), "--scheme", "http", "--log-dir", str(tmp_path / "log"), "--restore-dir", str(tmp_path / "restore"), *argv],
                        transport=fake.transport(), out=lines.append)

    return fake, run, lines, tmp_path


def _log(tmp_path) -> list[dict]:
    p = tmp_path / "log" / "nvr-write-log.jsonl"
    return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines()] if p.exists() else []


def test_whitelist_only():
    with pytest.raises(SystemExit):
        pnw.build_parser().parse_args(["reboot"])
    with pytest.raises(SystemExit):
        pnw.build_parser().parse_args(["factory-reset"])
    assert pnw.OPERATIONS == ("set-alarm-server", "set-encoding", "restore-from-log")


def test_dry_run_prints_redacted_body_and_writes_nothing(world):
    fake, run, lines, tmp = world
    assert run("--dry-run", "set-alarm-server", "--server", "192.0.2.77", "--port", "18091") == 0
    text = "\n".join(lines)
    assert "<serverAddr><![CDATA[<IP>]]></serverAddr>" in text and "<serverPort>18091</serverPort>" in text and "dry-run" in text
    assert fake.writes == [] and _log(tmp) == []
    for secret in (HOST, USER, PASSWORD, "192.0.2.77"):
        assert secret not in text


def test_alarm_server_write_verify_and_restore(world):
    fake, run, lines, tmp = world
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 0
    entries = _log(tmp)
    assert [e["phase"] for e in entries] == ["before", "verified"] and entries[0]["before"] == {"configured": False, "port": None}
    assert fake.alarm_server["addr"] == "ha.local.test" and fake.writes == ["SetAlarmServerConfig"]
    eid = entries[0]["entry"]
    assert run("restore-from-log", "--entry", eid) == 0
    assert fake.alarm_server["addr"] == "" and _log(tmp)[-1]["phase"] == "verified" and _log(tmp)[-2]["restore_of"] == eid
    assert "enableHeartbeat" not in fake.set_alarm_bodies[0], "only the device's own fields"


def test_restore_puts_back_heartbeat_exactly(world):
    fake, run, lines, tmp = world
    fake.shape = "doc"  # the guide's form: address, port, heartbeat on/off and interval
    fake.alarm_server = {"addr": "old.server.test", "port": 9000, "heartbeat": False, "interval": 120}
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 0
    assert fake.alarm_server["heartbeat"] is True and fake.alarm_server["interval"] == 30, "the write changed the heartbeat"
    assert run("restore-from-log", "--entry", _log(tmp)[0]["entry"]) == 0
    a = fake.alarm_server
    assert (a["addr"], a["port"], a["heartbeat"], a["interval"]) == ("old.server.test", 9000, False, 120)
    assert _log(tmp)[-1]["phase"] == "verified"


def test_restore_puts_back_the_url_path_exactly(world):
    fake, run, lines, tmp = world
    fake.alarm_server_url = True
    fake.alarm_server = {"addr": "old.server.test", "port": 9000, "heartbeat": False, "interval": 30, "url": "/old/SendAlarmStatus"}
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091", "--path", "/tok123/SendAlarmStatus") == 0
    assert fake.alarm_server["url"] == "/tok123/SendAlarmStatus"
    assert run("restore-from-log", "--entry", _log(tmp)[0]["entry"]) == 0
    assert (fake.alarm_server["addr"], fake.alarm_server["port"], fake.alarm_server["url"]) == ("old.server.test", 9000, "/old/SendAlarmStatus")


def test_restore_record_holds_every_prior_value(world):
    fake, run, lines, tmp = world
    fake.shape = "doc"
    fake.alarm_server = {"addr": "old.server.test", "port": 9000, "heartbeat": True, "interval": 60}
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 0
    rec = json.loads((tmp / "restore" / f"{_log(tmp)[0]['entry']}.json").read_text(encoding="utf-8"))
    assert rec["values"] == {"serverAddr": "old.server.test", "serverPort": "9000", "enableHeartbeat": "true", "heartbeatInterval": "60"}


def test_restore_document_escapes_cdata():
    from smplwise.services.recorders import provision_isr_xml as px

    doc = px.alarm_server_restore_document({"serverAddr": "", "serverPort": "", "url": "/a]]><x/>"})
    assert px.alarm_server_values(doc)["url"] == "/a]]><x/>"
    with pytest.raises(ValueError):
        px.alarm_server_restore_document({"serverAddr": "bad host!"})
    with pytest.raises(ValueError):
        px.alarm_server_restore_document({"heartbeatInterval": "1;2"})


def test_encoding_write_verify_and_restore(world):
    fake, run, lines, tmp = world
    assert run("set-encoding", "--channel", "1", "--stream", "main", "--set", "bitrate_kbps=2048", "--set", "gop=40") == 0
    e = _log(tmp)
    assert e[0]["before"] == {"bitrate_kbps": 3072, "gop": 50} and e[-1]["phase"] == "verified" and e[-1]["after"] == {"bitrate_kbps": 2048, "gop": 40}
    assert fake.streams[1][1]["maxBitRate"] == "2048"
    assert run("restore-from-log", "--entry", e[0]["entry"]) == 0
    assert fake.streams[1][1]["maxBitRate"] == "3072" and fake.streams[1][1]["GOP"] == "50"


def test_refusals(world):
    fake, run, lines, tmp = world
    assert run("set-encoding", "--channel", "1", "--stream", "main", "--set", "password=x") == 2
    assert run("set-encoding", "--channel", "1", "--stream", "main", "--set", "resolution=1;rm") == 2
    assert run("restore-from-log", "--entry", "../../etc") == 2
    assert run("set-alarm-server", "--server", "bad host!", "--port", "1") == 2
    assert fake.writes == []


def test_stops_at_the_first_401(world):
    fake, run, lines, tmp = world
    fake.auth = "digest"  # the script speaks Basic: the device refuses
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 5
    assert "source_forbidden" in lines[-1] and fake.writes == [] and _log(tmp) == []


def test_encoding_dry_run_is_redacted_and_writes_nothing(world):
    fake, run, lines, tmp = world
    assert run("--dry-run", "set-encoding", "--channel", "1", "--stream", "sub", "--set", "fps=10") == 0
    text = "\n".join(lines)
    assert "POST /SetVideoStreamConfig/1" in text and "<frameRate>10</frameRate>" in text and "dry-run" in text
    assert "rtsp://" not in text and HOST not in text and PASSWORD not in text and USER not in text
    assert fake.writes == [] and _log(tmp) == []


@pytest.mark.parametrize("op", ["reboot", "factory-reset", "format-disk", "upgrade-firmware", "set-network", "modify-password", "add-user", "ptz"])
def test_every_other_operation_is_refused(op):
    with pytest.raises(SystemExit):
        pnw.build_parser().parse_args([op])


def test_log_has_no_secret(world):
    fake, run, lines, tmp = world
    run("set-alarm-server", "--server", "192.0.2.77", "--port", "18091")
    raw = (tmp / "log" / "nvr-write-log.jsonl").read_text(encoding="utf-8")
    for secret in (HOST, USER, PASSWORD, "192.0.2.77"):
        assert secret not in raw

# ---------------------------------------------------------------------------------------------- NN2A (2026-10-05)

def test_full_previous_answer_saved_before_the_write(world):
    fake, run, lines, tmp = world
    fake.alarm_server = {"addr": "old.server.test", "port": 9000, "heartbeat": False, "interval": 30}
    seen_before_write = []
    real = fake._SetAlarmServerConfig

    def spy(request, ch):
        seen_before_write.extend(p.name for p in (tmp / "log").glob("alarm-server-before-*.xml"))
        return real(request, ch)

    fake._SetAlarmServerConfig = spy
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 0
    eid = _log(tmp)[0]["entry"]
    assert seen_before_write == [f"alarm-server-before-{eid}.xml"], "saved BEFORE the write"
    snap = (tmp / "log" / f"alarm-server-before-{eid}.xml").read_text(encoding="utf-8")
    assert "old.server.test" in snap and "<serverPort" in snap and "alarmServer" in snap, "the device's own answer, unmodified"
    assert "old.server.test" not in "\n".join(lines), "the snapshot is never printed"


def test_dry_run_saves_no_snapshot(world):
    fake, run, lines, tmp = world
    assert run("--dry-run", "set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 0
    assert not list(tmp.glob("log/alarm-server-before-*.xml")) and fake.writes == []


def test_diverged_read_back_restores_exactly_once(world):
    fake, run, lines, tmp = world
    fake.alarm_server = {"addr": "old.server.test", "port": 9000, "heartbeat": False, "interval": 30}
    real = fake._SetAlarmServerConfig
    calls = []

    def mangle(request, ch):  # the device stores something else than what was sent (first write only)
        calls.append(1)
        r = real(request, ch)
        if len(calls) == 1:
            fake.alarm_server["port"] = 1234
        return r

    fake._SetAlarmServerConfig = mangle
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 3
    assert len(calls) == 2, "one write + one restore, no retry"
    assert (fake.alarm_server["addr"], fake.alarm_server["port"]) == ("old.server.test", 9000)
    phases = [e["phase"] for e in _log(tmp)]
    assert phases == ["before", "diverged", "before", "verified"] and _log(tmp)[2]["restore_of"] == _log(tmp)[0]["entry"]
    assert "restored and verified" in lines[-1]


def test_no_auto_restore_only_prints_the_command(world):
    fake, run, lines, tmp = world
    real = fake._SetAlarmServerConfig

    def mangle(request, ch):
        r = real(request, ch)
        fake.alarm_server["port"] = 1234
        return r

    fake._SetAlarmServerConfig = mangle
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091", "--no-auto-restore") == 3
    assert fake.writes == ["SetAlarmServerConfig"] and "restore-from-log --entry" in lines[-1]


def test_refused_write_with_device_unchanged_restores_nothing(world):
    fake, run, lines, tmp = world
    fake.fail["SetAlarmServerConfig"] = 5
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 6
    assert fake.writes == ["SetAlarmServerConfig"], "never retried, no restore write"
    assert [e["phase"] for e in _log(tmp)] == ["before", "write-failed", "unchanged"]


def test_server_auto_uses_the_local_address_and_prints_none(world, monkeypatch):
    from smplwise.services.recorders import provision_events as pe

    fake, run, lines, tmp = world
    monkeypatch.setattr(pe, "_local_address_towards", lambda host: "192.0.2.55")
    assert run("set-alarm-server", "--server", "auto", "--port", "18091") == 0
    assert fake.alarm_server["addr"] == "192.0.2.55" and "192.0.2.55" not in "\n".join(lines)
    monkeypatch.setattr(pe, "_local_address_towards", lambda host: None)
    assert run("set-alarm-server", "--server", "auto", "--port", "18091") == 2


# ---------------------------------------------------------------------------------------------- NN2A protocol fix (2026-10-05)

def test_v1_nvr_is_refused_before_any_request_or_journal(world):
    """The 2026-10-05 live attempt: firmware 1.4.7 answers GetAlarmServerConfig with a serverAddr + serverPort stub, has no
    GetSupportedAPIs, and rejected the Set. The script now stops before the journal, the snapshot and the write."""
    fake, run, lines, tmp = world
    fake.supported_apis = None
    assert run("set-alarm-server", "--server", "192.0.2.77", "--port", "18091") == 2
    assert fake.writes == [] and _log(tmp) == [] and not list(tmp.glob("log/alarm-server-before-*.xml"))
    assert "support: no (v1_nvr_ipc_only)" in lines and lines[-1].startswith("refused:")
    lines.clear()
    assert run("--dry-run", "set-alarm-server", "--server", "192.0.2.77", "--port", "18091") == 2
    assert any(x.startswith("body: ") for x in lines) and "support: no (v1_nvr_ipc_only)" in lines and fake.writes == []
    assert "192.0.2.77" not in "\n".join(lines)


def test_supported_apis_without_the_set_is_refused(world):
    fake, run, lines, tmp = world
    fake.supported_apis = ["GetDeviceInfo", "GetAlarmServerConfig"]
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 2
    assert "support: no (supported_apis)" in lines and fake.writes == []


def test_v2_nvr_shape_sends_switch_and_restores_it(world):
    fake, run, lines, tmp = world
    fake.supported_apis = None
    fake.alarm_server_switch = False
    fake.alarm_server = {"addr": "", "port": 8010, "heartbeat": False, "interval": 30, "url": "AlarmStatus"}
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 0
    assert "support: yes (v2_nvr_shape)" in lines
    body = fake.set_alarm_bodies[-1]
    assert body.index("<switch>true</switch>") < body.index("<serverAddr>") and fake.alarm_server_switch is True
    eid = _log(tmp)[0]["entry"]
    assert run("restore-from-log", "--entry", eid) == 0
    assert fake.alarm_server_switch is False and fake.alarm_server["addr"] == "" and fake.alarm_server["url"] == "AlarmStatus"


def test_write_failure_records_what_the_device_said(world):
    fake, run, lines, tmp = world
    fake.fail["SetAlarmServerConfig"] = 3
    assert run("set-alarm-server", "--server", "ha.local.test", "--port", "18091") == 6
    failed = [e for e in _log(tmp) if e["phase"] == "write-failed"][0]
    assert failed["code"] == "source_error" and failed["detail"] == {"status": 400, "device_code": 3, "reason": "invalid_xml_content"}
    assert '"device_code": 3' in "\n".join(lines) and fake.writes == ["SetAlarmServerConfig"]


def test_restore_document_round_trips_switch():
    from smplwise.services.recorders import provision_isr_xml as px

    doc = px.alarm_server_restore_document({"switch": "false", "serverAddr": "", "serverPort": ""})
    assert doc.index("<switch>false</switch>") < doc.index("<serverAddr>") and px.alarm_server_values(doc)["switch"] == "false"
    with pytest.raises(ValueError):
        px.alarm_server_restore_document({"switch": "yes"})

# ------------------------------------------------------------------------------------------------ NN2B: encoding write safeguards

def test_encoding_dry_run_reports_support_mode_validation_and_the_restore_values(world):
    fake, run, lines, tmp = world
    assert run("--dry-run", "set-encoding", "--channel", "1", "--stream", "main", "--set", "gop=40") == 0
    text = "\n".join(lines)
    assert "support: writable; write mode: whole" in text and "validation: every value is inside" in text
    assert '"gop": 50' in text and "restore-from-log" in text and "dry-run: nothing written" in text
    assert fake.writes == [] and _log(tmp) == []
    lines.clear()
    fake.supported_apis = ["GetSupportedAPIs", "SetVideoStreamConfig", "GetStreamCaps"]
    from smplwise.services.recorders import provision_isr as pisr

    pisr.clear_auth_cache()
    assert run("--dry-run", "set-encoding", "--channel", "1", "--stream", "main", "--set", "gop=40") == 0
    text = "\n".join(lines)
    assert "write mode: partial" in text and text.count("&lt;item") + text.count("<item id=") == 1 and "<frameRate>" not in text
    assert fake.writes == []


def test_encoding_value_outside_the_device_caps_is_refused_before_anything_is_recorded(world):
    fake, run, lines, tmp = world
    assert run("set-encoding", "--channel", "1", "--stream", "main", "--set", "resolution=320x240") == 4
    assert "validation: REFUSED (resolution)" in "\n".join(lines)
    assert fake.writes == [] and _log(tmp) == [] and not list((tmp / "restore").glob("*.json"))


def test_encoding_support_gate_refuses_without_a_journal_entry(world):
    fake, run, lines, tmp = world
    fake.set_refused = {1: 4}
    assert run("set-encoding", "--channel", "1", "--stream", "main", "--set", "gop=40") == 4  # the device refuses the one write
    assert fake.writes == ["SetVideoStreamConfig"] and "nothing was changed on the device" in lines[-1]
    lines.clear()
    assert run("set-encoding", "--channel", "1", "--stream", "main", "--set", "gop=41") == 4  # now the gate stops it before a request
    text = "\n".join(lines)
    assert "NOT writable (device_refused)" in text and fake.writes == ["SetVideoStreamConfig"]


def test_encoding_diverged_readback_restores_once(world):
    fake, run, lines, tmp = world
    fake.set_effect = "partial"
    calls = []

    def hook(f, ch):
        calls.append(ch)
        if len(calls) >= 2:
            f.set_effect = "apply"  # the restore write is applied in full

    fake.set_hook = hook
    assert run("set-encoding", "--channel", "1", "--stream", "main", "--set", "bitrate_kbps=2048", "--set", "gop=40") == 3
    text = "\n".join(lines)
    assert "DIVERGED" in text and "restored and verified" in text
    assert fake.writes == ["SetVideoStreamConfig"] * 2, "one write and one restore, nothing else"
    assert fake.streams[1][1]["maxBitRate"] == "3072" and fake.streams[1][1]["GOP"] == "50"
    assert [e["phase"] for e in _log(tmp)] == ["before", "diverged", "before", "verified"]


def test_encoding_diverged_without_auto_restore_only_prints_the_command(world):
    fake, run, lines, tmp = world
    fake.set_effect = "partial"
    assert run("set-encoding", "--channel", "1", "--stream", "main", "--set", "bitrate_kbps=2048", "--set", "gop=40", "--no-auto-restore") == 3
    assert fake.writes == ["SetVideoStreamConfig"] and "restore with: restore-from-log --entry" in lines[-1]


def test_encoding_unknown_outcome_is_read_back_and_never_rewritten(world):
    fake, run, lines, tmp = world
    fake.set_after = "drop"
    assert run("set-encoding", "--channel", "1", "--stream", "main", "--set", "gop=40") == 7
    text = "\n".join(lines)
    assert "OUTCOME UNKNOWN" in text and "No further write was made" in text and fake.writes == ["SetVideoStreamConfig"]
    assert _log(tmp)[-1]["phase"] == "unknown-readback"
