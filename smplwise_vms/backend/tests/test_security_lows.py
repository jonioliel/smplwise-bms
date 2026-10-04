"""Security review Lows (2026-10-04): L1 device XML must be UTF-8 (no DOCTYPE hidden behind another encoding);
L3 the live recorder health check is answered from a short cache under a burst. L2 is asserted in
test_installation_capabilities.py (health's per-recorder block)."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.services import xmlsafe
from smplwise.services.recorders import provision_isr as pisr

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import FakeProvision, settings_for  # noqa: E402

DOC = '<?xml version="1.0"?><config><a>1</a></config>'
EVIL = '<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE x [<!ENTITY e "boom">]><config>&e;</config>'


def test_utf8_documents_parse():
    assert xmlsafe.parse(DOC).find("a").text == "1"
    assert xmlsafe.parse(b"\xef\xbb\xbf" + DOC.encode()).find("a").text == "1"
    assert xmlsafe.parse(DOC.replace('version="1.0"', 'version="1.0" encoding="utf-8"')).find("a").text == "1"


@pytest.mark.parametrize("raw", [
    EVIL.encode("utf-16"),  # BOM + UTF-16: the byte-level DOCTYPE check would not see "<!DOCTYPE"
    EVIL.encode("utf-16-le"),  # no BOM, NUL bytes
    EVIL.encode("utf-32"),
    '<?xml version="1.0" encoding="UTF-7"?><config/>'.encode(),
    '<?xml version="1.0" encoding="ISO-8859-1"?><config/>'.encode(),
])
def test_other_encodings_are_refused(raw):
    with pytest.raises(xmlsafe.UnsafeXml):
        xmlsafe.parse(raw)


def test_doctype_still_refused():
    with pytest.raises(xmlsafe.UnsafeXml):
        xmlsafe.parse(EVIL.replace(' encoding="UTF-16"', ""))


def test_recorder_health_burst_is_cached(settings, monkeypatch):
    from smplwise.main import create_app
    from smplwise.routers import recorders as rr

    pisr.clear_auth_cache()
    fake = FakeProvision()
    fake.shape = "live"
    fake.install(monkeypatch)
    app = create_app(settings_for(settings, auth="basic", osd_names=False))
    with TestClient(app) as c:
        first = c.get("/api/v1/recorders/nvr-1/health")
        assert first.status_code == 200, first.text
        n = sum(1 for h in fake.hits if "GetDeviceInfo" in h)
        for _ in range(5):
            r = c.get("/api/v1/recorders/nvr-1/health")
            assert r.status_code == 200 and r.json()["cached"] is True
        assert sum(1 for h in fake.hits if "GetDeviceInfo" in h) == n, "the burst never reached the device"
        app.state.recorder_health_cache["nvr-1"] = (time.monotonic() - rr.HEALTH_CACHE_S - 1, first.json())
        assert "cached" not in c.get("/api/v1/recorders/nvr-1/health").json(), "expired entries are re-checked"


def test_address_document_cdata_cannot_be_closed():
    """Low: the old single replace("]]>", "") re-formed "]]>" from "]]]]>>>"; px.cdata splits every occurrence."""
    from smplwise.services import xmlsafe as xs
    from smplwise.services.recorders import provision_isr_xml as px

    for evil in ("]]]]>>>", "a]]><x/>", "]]>]]>"):
        root = xs.parse(pisr._address_document(evil))
        assert px.text(root, "serverAddress") == evil and len(list(root)) == 1


def test_ffmpeg_inputs_are_whitelisted_and_env_minimal(monkeypatch):
    import datetime as dt

    from smplwise.services.recorders import provision_playback as pp

    seen = []

    class P:
        returncode, stdout = 0, b"\xff\xd8jpeg"

    monkeypatch.setattr(pp.subprocess, "run", lambda args, **kw: seen.append((args, kw)) or P())
    snap = pp.SnapshotAt(data=b"\x00\x00\x00\x01", content_type="video/h264", codec="h264", requested_at=dt.datetime.now(dt.timezone.utc))
    assert pp.to_jpeg(snap, ffmpeg="ffmpeg") == b"\xff\xd8jpeg"
    args, kw = seen[0]
    assert args[args.index("-protocol_whitelist") + 1] == "pipe" and args.index("-protocol_whitelist") < args.index("-i")
    assert "SUPERVISOR_TOKEN" not in kw["env"] and "PATH" in kw["env"]
    src = Path(pp.__file__).read_text(encoding="utf-8")
    assert '"-protocol_whitelist", "rtsp,rtp,tcp,udp", "-i", playback_uri' in src