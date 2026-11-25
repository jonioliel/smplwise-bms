"""WISKEY-LISTEN-GATE-2520 (row R5 of docs/changes/WISKEY-RESYNC-2520.md, WisKey C4): the listen gate follows the LAST NEGOTIATED
signed discovery (`station_talk_audio`, opt-in `media/talk_open.parameters.listen`, default false) and fails closed.

Software only: the feature-status row is computed from in-memory facts, and the runtime refusal is checked against the in-memory fake
WisKey station (tests/w10_fake_station.py). No real station, no audio, no lab, nothing sent anywhere else."""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from smplwise.services import wiskey_direct_discovery as dd
from smplwise.services import wiskey_direct_join
from smplwise.services import wiskey_feature_status as wfs
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_media_contract as w10

LISTEN_CMDS = [w10.DESCRIBE, w10.STREAM_LEASE, w10.TALK_OPEN, w10.TALK_FRAME, w10.TALK_FLOOR, w10.TALK_CLOSE]


class FakeFacts:
    """The four facts `_listen` reads; `direct` is what Facts.direct() would answer (reasons)."""

    def __init__(self, *, listen: str = "on", direct: list[dict[str, Any]] | None = None, caps: Any = None, accepted: Any = True) -> None:
        self._listen, self._direct, self.caps, self.accepted = listen, direct or [], caps, accepted

    def setting(self, key: str, default: str = "off") -> str:
        assert key == "access.station_listen"
        return self._listen

    def direct(self) -> list[dict[str, Any]]:
        return list(self._direct)


def probe_caps(*, talk_audio: bool, commands: list[str] | None = None, rejected: list[str] | None = None, **extra: Any) -> dict[str, Any]:
    out = {"schema_version": 1, "protocol": bridge.DIRECT_PROTOCOL, "commands": sorted(LISTEN_CMDS if commands is None else commands),
           "families": [], "talk_audio": talk_audio, "stations": 1, "clock": None, "skew_s": 0.0}
    if rejected is not None:
        out["rejected_blocks"] = rejected
    out.update(extra)
    return out


def codes(reasons: list[dict[str, Any]]) -> list[str]:
    return [r["code"] for r in reasons]


@pytest.fixture(autouse=True)
def no_join(monkeypatch):
    """No direct join unless a test installs one."""
    monkeypatch.setattr(wiskey_direct_join, "installed", lambda: None)


# ================================================================ the feature-status row (fail closed)

def test_no_negotiated_discovery_is_unknown_never_on():
    reasons = wfs._listen(FakeFacts(caps=None))
    assert codes(reasons) == ["listen_unknown"]
    assert wfs._state(reasons) == wfs.UNKNOWN


def test_the_probe_setting_value_proves_nothing():
    """`access.station_listen = probe` accepts an unknown descriptor for a shared session; it never makes the row `on`."""
    reasons = wfs._listen(FakeFacts(listen="probe", caps=None))
    assert codes(reasons) == ["listen_unknown"] and wfs._state(reasons) == wfs.UNKNOWN


def test_discovery_without_the_opt_in_keeps_listen_no_downlink():
    reasons = wfs._listen(FakeFacts(caps=probe_caps(talk_audio=False)))
    assert codes(reasons) == ["listen_no_downlink"] and wfs._state(reasons) == wfs.BLOCKED


def test_a_version_or_protocol_label_never_decides():
    caps = probe_caps(talk_audio=False, protocol="wiskey-direct-ws.v2", schema_version=3, version="2.0.1-rc.19")
    assert codes(wfs._listen(FakeFacts(caps=caps))) == ["listen_no_downlink"]


def test_the_exact_opt_in_with_the_listen_commands_is_on():
    reasons = wfs._listen(FakeFacts(caps=probe_caps(talk_audio=True)))
    assert reasons == [] and wfs._state(reasons) == wfs.ON


def test_listen_needs_only_describe_open_close_not_floor_or_frames():
    caps = probe_caps(talk_audio=True, commands=[w10.DESCRIBE, w10.TALK_OPEN, w10.TALK_CLOSE])
    assert wfs._listen(FakeFacts(caps=caps)) == []


def test_commands_named_with_the_wiskey_domain_are_read():
    caps = probe_caps(talk_audio=True, commands=[f"{w10.DOMAIN}/{c}" for c in LISTEN_CMDS])
    assert wfs._listen(FakeFacts(caps=caps)) == []


def test_the_opt_in_without_talk_open_is_blocked_and_names_what_is_missing():
    caps = probe_caps(talk_audio=True, commands=[w10.DESCRIBE, w10.TALK_CLOSE])
    reasons = wfs._listen(FakeFacts(caps=caps))
    assert codes(reasons) == ["direct_no_media"] and w10.TALK_OPEN in reasons[0]["text"]
    assert wfs._state(reasons) == wfs.BLOCKED


def test_a_block_in_another_shape_is_rejected_not_offered():
    reasons = wfs._listen(FakeFacts(caps=probe_caps(talk_audio=False, rejected=["station_talk_audio"])))
    assert codes(reasons) == ["listen_offer_rejected"] and wfs._state(reasons) == wfs.BLOCKED


@pytest.mark.parametrize("accepted", [None, False])
def test_a_probe_wisKey_did_not_accept_is_not_a_negotiated_discovery(accepted):
    reasons = wfs._listen(FakeFacts(caps=probe_caps(talk_audio=True), accepted=accepted))
    assert codes(reasons) == ["listen_unknown"]


def test_the_setting_off_stays_off_even_when_offered():
    reasons = wfs._listen(FakeFacts(listen="off", caps=probe_caps(talk_audio=True)))
    assert codes(reasons) == ["listen_off"] and wfs._state(reasons) == wfs.OFF


def test_setting_off_and_unknown_is_unknown():
    reasons = wfs._listen(FakeFacts(listen="off", caps=None))
    assert codes(reasons) == ["listen_off", "listen_unknown"] and wfs._state(reasons) == wfs.UNKNOWN


def test_the_signed_path_reasons_still_block_an_offered_listen():
    key = wfs._reason("key_missing")
    reasons = wfs._listen(FakeFacts(direct=[key], caps=probe_caps(talk_audio=True)))
    assert codes(reasons) == ["key_missing"] and wfs._state(reasons) == wfs.BLOCKED
    # a definite blocker wins over "not known"
    assert wfs._state(wfs._listen(FakeFacts(direct=[key], caps=None))) == wfs.BLOCKED


def test_the_state_rule_for_unknown_codes():
    unknown, off, wk = wfs._reason("listen_unknown"), wfs._reason("listen_off"), wfs._reason("listen_no_downlink")
    assert wfs._state([]) == wfs.ON
    assert wfs._state([off]) == wfs.OFF and wfs._state([unknown]) == wfs.UNKNOWN and wfs._state([off, unknown]) == wfs.UNKNOWN
    assert wfs._state([wk, unknown]) == wfs.BLOCKED
    assert wfs._state([wfs._reason("probe_unknown")]) == wfs.BLOCKED, "other rows keep their rule (probe_unknown is not an UNKNOWN code)"


def test_new_reasons_are_closed_hebrew_and_kinds_are_known():
    for code in ("listen_no_downlink", "listen_offer_rejected", "listen_unknown"):
        r = wfs._reason(code)
        assert r["kind"] in ("SET", "POL", "PAIR", "WK", "OWN", "RUN") and any("֐" <= ch <= "׿" for ch in r["text"]) and r["fix"]
        assert "Home Assistant" not in r["text"] + r["fix"]


# ---------------------------------------------------------------- the direct join's CURRENT document comes first

def _capabilities_doc(talk_audio: Any) -> dict[str, Any]:
    from test_wkjoin_295 import JoinServer

    doc = JoinServer().capabilities_doc()
    doc.pop("station_talk_audio", None)
    if talk_audio is not None:
        doc["station_talk_audio"] = talk_audio
    return doc


def _join(monkeypatch, cap: Any, *, ref: str = "conn-1", refusal: str | None = None, configured: bool = True) -> None:
    link = SimpleNamespace(connection_ref=ref, closed=False)
    session = SimpleNamespace(_link=link, discovery=SimpleNamespace(capabilities=cap), transport_refusal=lambda _c=None: refusal)
    join = SimpleNamespace(session=session, configured=lambda: configured)
    monkeypatch.setattr(wiskey_direct_join, "installed", lambda: join)


@pytest.mark.parametrize("block,offered,rejected", [
    (dict(dd.TALK_AUDIO_CAP), True, False),
    (None, False, False),
    ({**dd.TALK_AUDIO_CAP, "default": True}, False, True),  # a default-on listen is another contract: never read as the opt-in
    ({**dd.TALK_AUDIO_CAP, "opt_in": "media/listen_open"}, False, True),
])
def test_the_joins_current_document_is_read_through_the_closed_reader(monkeypatch, block, offered, rejected):
    cap = dd.read_capabilities(_capabilities_doc(block), "conn-1")
    _join(monkeypatch, cap)
    offer = wfs._listen_offer(FakeFacts(caps=None))
    assert offer is not None and offer["source"] == "join" and offer["offered"] is offered and offer["rejected"] is rejected


def test_the_join_wins_over_an_older_probe(monkeypatch):
    cap = dd.read_capabilities(_capabilities_doc(None), "conn-1")
    _join(monkeypatch, cap)
    assert codes(wfs._listen(FakeFacts(caps=probe_caps(talk_audio=True)))) == ["listen_no_downlink"]


@pytest.mark.parametrize("ref,refusal,configured", [("conn-OLD", None, True), ("conn-1", "wiskey_direct_not_connected", True),
                                                    ("conn-1", None, False)])
def test_a_join_document_not_bound_to_the_live_connection_is_not_used(monkeypatch, ref, refusal, configured):
    cap = dd.read_capabilities(_capabilities_doc(dict(dd.TALK_AUDIO_CAP)), ref)
    _join(monkeypatch, cap, refusal=refusal, configured=configured)
    assert codes(wfs._listen(FakeFacts(caps=None))) == ["listen_unknown"]
    assert wfs._listen(FakeFacts(caps=probe_caps(talk_audio=False)))[0]["code"] == "listen_no_downlink"


def test_an_unreadable_join_falls_back_to_the_probe(monkeypatch):
    def boom() -> Any:
        raise RuntimeError("x")

    monkeypatch.setattr(wiskey_direct_join, "installed", boom)
    assert wfs._listen(FakeFacts(caps=probe_caps(talk_audio=True))) == []


def test_the_row_is_registered_and_uses_the_gate():
    row = [r for r in wfs.ROWS if r[1] == "listen"]
    assert len(row) == 1 and row[0][4] is wfs._listen and row[0][0] == 57


def test_reading_the_row_sends_nothing(monkeypatch):
    """The gate reads process memory only: no socket, no signed frame."""

    async def refuse(*_a: Any, **_k: Any) -> Any:
        raise AssertionError("the feature status must not connect")

    monkeypatch.setattr(bridge.DirectApiTransport, "connect", refuse)
    assert codes(wfs._listen(FakeFacts(caps=None))) == ["listen_unknown"]
