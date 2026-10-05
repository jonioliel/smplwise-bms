"""scripts/provision_push_probe.py (NN2A validation listener): the product's PushListener / PushReceiver in address mode for
the lab recorder only, one redacted line per message, raw bodies kept under the evidence dir, exit codes by what arrived."""
from __future__ import annotations

import importlib.util
import json
import threading
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("provision_push_probe", ROOT / "scripts" / "provision_push_probe.py")
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

V1_STATUS = b"""<config version="1.0" xmlns="http://www.ipc.com/ver10"><alarmStatusInfo><motionAlarm type="boolean" id="2">true</motionAlarm></alarmStatusInfo>
<dataTime><![CDATA[2026-10-05 12:00:00]]></dataTime><deviceInfo><deviceName><![CDATA[x]]></deviceName><sn><![CDATA[SERIAL-123]]></sn></deviceInfo></config>"""
V1_BEAT = b"""<config version="1.0" xmlns="http://www.ipc.com/ver10"><deviceInfo><deviceName><![CDATA[x]]></deviceName><sn><![CDATA[SERIAL-123]]></sn></deviceInfo></config>"""


def _run(tmp_path, posts, *extra, source="127.0.0.1"):
    lines: list[str] = []
    ready = threading.Event()
    port: list[int] = []
    stop = threading.Event()
    rc: list[int] = []
    env = tmp_path / "lab.env"
    env.write_text(f"PROVISION_NVR_URL=https://{source}:443\nPROVISION_NVR_USER=u\nPROVISION_NVR_PASS=p\n", encoding="utf-8")

    def target():
        rc.append(probe.main(["--env", str(env), "--bind", "127.0.0.1", "--port", "0", "--seconds", "20",
                              "--evidence-dir", str(tmp_path / "ev"), *extra],
                             out=lines.append, on_ready=lambda p: (port.append(p), ready.set()), stop=stop))

    t = threading.Thread(target=target)
    t.start()
    assert ready.wait(10)
    codes = []
    with httpx.Client(timeout=5) as c:
        for path, body in posts:
            codes.append(c.post(f"http://127.0.0.1:{port[0]}{path}", content=body).status_code)
    if "--until-event" not in extra:
        stop.set()
    t.join(15)
    assert not t.is_alive()
    return rc[0], codes, lines, tmp_path / "ev"


def test_a_real_event_is_reported_and_kept_as_evidence(tmp_path):
    rc, codes, lines, ev = _run(tmp_path, [("/SendAlarmStatus", V1_BEAT), ("/SendAlarmStatus", V1_STATUS)], "--until-event")
    assert rc == 0 and codes == [200, 200]
    text = "\n".join(lines)
    assert "VMD ch2 active" in text and "heartbeat" in text
    assert "SERIAL-123" not in text and "127.0.0.1" not in text, "no serial / address printed"
    run_dir = next(ev.iterdir())
    raws = sorted(p.name for p in run_dir.glob("*.xml"))
    assert raws == ["0001_SendAlarmStatus.xml", "0002_SendAlarmStatus.xml"]
    assert (run_dir / "0002_SendAlarmStatus.xml").read_bytes() == V1_STATUS, "raw body kept unmodified (private evidence)"
    s = json.loads((run_dir / "summary.json").read_text(encoding="utf-8"))
    assert s["status"] == 1 and s["heartbeat"] == 1 and s["edges"] == 1 and s["alarm_kinds"] == ["VMD"]


def test_heartbeats_only_exit_1(tmp_path):
    rc, codes, lines, ev = _run(tmp_path, [("/SendAlarmStatus", V1_BEAT)])
    assert rc == 1 and codes == [200]


def test_other_sources_are_refused_and_nothing_counts(tmp_path):
    rc, codes, lines, ev = _run(tmp_path, [("/SendAlarmStatus", V1_STATUS)], source="192.0.2.10")
    assert rc == 2 and codes == [403]
    s = json.loads((next(ev.iterdir()) / "summary.json").read_text(encoding="utf-8"))
    assert s["refused_other_sources"] == 1 and s["messages"] == 0
    assert not list(next(ev.iterdir()).glob("*.xml")), "a refused body is never stored"
