"""WISKEY-TALK-CAPS-2382 (FAKES ONLY): the station media provider decides on WisKey's SIGNED `direct/capabilities` when the feed's overview
does not list the W10 commands (WisKey 2.0.1-rc.10: 258 overview commands, none of the six W10 ones; all six in direct/capabilities).

WisKey here is the in-memory fake direct server of tests/test_wkjoin_295.py (`JoinServer`: hello, signed direct/connect with its own HMAC
check and a nonce register that refuses any replay, both discovery reads in WisKey's shapes) and, for the descriptor and the talk, the fake
station of tests/w10_fake_station.py behind the signed bridge. Nothing contacts a network, Home Assistant, a station or WisKey."""
from __future__ import annotations

import asyncio
import copy
import json
import sqlite3
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from test_intercom import camera_feed, fake_go2rtc, feed  # noqa: F401 - fixtures
from test_wiskey_media_v11 import transport_for
from test_wkjoin_295 import JoinServer
from w10_fake_station import SECRET, FakeStation

from smplwise.services import ha_bridge, intercom_sync
from smplwise.services import intercom_media as im
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_media_caps as caps
from smplwise.services import wiskey_media_contract as w10

FIX = Path(__file__).parent / "fixtures" / "wiskey_w10"
READINESS = "/api/v1/access-control/station-media/readiness"
MEDIA = "/api/v1/access-control/stations/{}/media"
W10_NAMES = set(w10.COMMANDS)
OTHER_NAMES = {"overview", "users/get", "media/call", "media/signal"}


def overview(*, with_w10: bool = False) -> dict[str, Any]:
    """The feed's `overview.api`: the W10 fixture, or (default) the rc.10 lab shape - the same list without the six W10 commands."""
    body = copy.deepcopy(json.loads((FIX / "overview_api.json").read_text(encoding="utf-8")))
    if not with_w10:
        body["commands"] = [c for c in body["commands"] if c not in w10.COMMANDS and c.removeprefix(w10.DOMAIN + "/") not in w10.COMMANDS]
    return body


def db(choice: str = "auto") -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (im.PROVIDER_KEY, choice))
    return conn


def set_choice(conn: sqlite3.Connection, choice: str) -> None:
    conn.execute("UPDATE settings SET value = ? WHERE key = ?", (choice, im.PROVIDER_KEY))


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


@pytest.fixture()
def wk(monkeypatch):
    """WisKey: the feed ready with the rc.10 overview (no W10), a pairing key that signs, and the fake direct server whose signed
    direct/capabilities lists the six W10 commands - each changeable per test. The TTL clock is the test's."""
    server = JoinServer()
    server.discovered = W10_NAMES | OTHER_NAMES
    state: dict[str, Any] = {"feed": "ready", "api": overview(), "key": SECRET}
    monkeypatch.setattr(intercom_sync.SYNC, "served", lambda s: (state["feed"], {} if state["feed"] == "ready" else None))
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda s: state["api"])
    monkeypatch.setattr(ha_bridge, "signing_key", lambda conn: state["key"])
    clock = Clock()
    monkeypatch.setattr(caps, "_mono", clock)
    # the signed provider itself on the fake station (an in-memory test database has no settings database for its own key reader); the
    # selection rule in front of it - the listing, the key check - is the real one
    provider = im.WiskeyBridgeProvider(transport_for(FakeStation()), discovery=lambda _s: state["api"])
    provider.signing_ready = lambda: caps.key_fingerprint(state["key"]) is not None  # type: ignore[attr-defined] - the signer's rule
    monkeypatch.setattr(im, "bridge_provider", lambda settings, conn: provider)
    saved_join = join.JOIN
    join.JOIN = None
    im.set_provider(None)
    caps.set_opener_for_tests(server.opener)
    yield SimpleNamespace(server=server, state=state, clock=clock)
    caps.set_opener_for_tests(None)
    join.JOIN = saved_join
    provider.video.close()
    im.MEDIA.reset()
    caps.invalidate()


def connects(server: JoinServer) -> int:
    return server.opened


def reads(server: JoinServer, command: str = "direct/capabilities") -> int:
    return sum(1 for c, _k, _p in server.received if c == command)


def local_descriptor() -> im.Descriptor:
    raw = {"schema": im.SCHEMA, "station_id": "entry-a", "session": "local-abcdefghijklmnop", "revision": 1,
           "issued_at": im._ts(1_800_000_000), "expires_at": im._ts(1_800_000_300),
           "video": {"profiles": [{"id": "main", "codec": "h264", "transports": ["mse"]}]}, "audio": {"listen": True, "talk": False}}
    return im.parse_descriptor(raw, station_id="entry-a", provider="local", now=1_800_000_010)


# ================================================================ W10 only in the signed direct/capabilities

def test_w10_only_in_the_signed_capabilities_selects_wiskey_and_talk(wk, settings):
    conn = db("auto")
    found = im.listing(settings, conn)
    assert (found.overview_video, found.overview_talk) == (False, False), "the rc.10 overview lists none of the six"
    assert found.video and found.talk and found.source == "capabilities"
    assert found.signed is not None and found.signed.ok and found.signed.source == caps.SOURCE_READ
    chosen = im.provider_for(settings, conn)
    assert isinstance(chosen, im.WiskeyBridgeProvider), "auto + the key signs + W10 in the signed document: WisKey's provider"
    r = im.readiness(settings, conn)
    assert r["missing"] == [] and r["active"] == "wiskey" and r["video_ready"] and r["talk_ready"]
    assert r["wiskey"]["listed_in"] == "capabilities" and r["wiskey"]["video_listed"] and r["wiskey"]["talk_listed"]
    cap = r["wiskey"]["capabilities"]
    assert cap["state"] == "read" and cap["video_listed"] and cap["talk_listed"] and cap["reason"] is None and cap["source"] == "read"
    assert SECRET not in json.dumps(r), "the key never appears in the answer"
    # one signed read for all of it: connect + capabilities + time once, every frame with its own nonce
    assert connects(wk.server) == 1 and reads(wk.server) == 1 and reads(wk.server, "direct/time") == 1
    assert len(wk.server.nonces) == 3
    assert [p for c, _k, p in wk.server.received] == [{}, {}], "discovery is read with exactly empty signed parameters"


def test_the_bridge_provider_keeps_talk_when_only_the_signed_document_lists_it(wk, settings):
    station = FakeStation()
    p = im.WiskeyBridgeProvider(transport_for(station), discovery=lambda _s: overview())
    try:
        conn = db("auto")
        d = p.describe(conn, replace(settings, go2rtc_url="http://go2rtc.invalid:1984"),
                       {"id": "entry-a", "online": True, "camera_entity": "camera.entry_a"})
        assert d.provider == "wiskey" and d.talk_transport == "pcmu_frames", "talk is not stripped: the signed document lists the talk commands"
        ch = p.talk_open(settings, "entry-a", d, actor_id="op-1", actor_name="Dana", request_id="rid-1")
        assert isinstance(ch, im.WiskeyBridgeTalkChannel), "the talk open re-check reads the cached signed listing (no I/O, no conn)"
        assert connects(wk.server) == 1, "the describe and the talk re-check reused the one signed read"
    finally:
        p.video.close()


def test_the_old_overview_path_still_works_without_any_signed_read(wk, settings):
    wk.state["api"] = overview(with_w10=True)
    conn = db("auto")
    found = im.listing(settings, conn)
    assert found.video and found.talk and found.source == "overview" and found.signed is None
    assert isinstance(im.provider_for(settings, conn), im.WiskeyBridgeProvider)
    r = im.readiness(settings, conn)
    assert r["missing"] == [] and r["wiskey"]["listed_in"] == "overview" and r["wiskey"]["capabilities"]["state"] == "not_needed"
    assert connects(wk.server) == 0, "W10 listed in the overview: nothing is read from the direct socket"


def test_the_overview_listing_video_only_takes_talk_from_the_signed_document(wk, settings):
    wk.state["api"] = {**overview(with_w10=True), "commands": [c for c in overview(with_w10=True)["commands"] if c != w10.TALK_FLOOR]}
    found = im.listing(settings, db("auto"))
    assert found.overview_video and not found.overview_talk and found.video and found.talk and found.source == "capabilities"


# ================================================================ listed in neither

def test_listed_in_neither_source_stays_local_and_says_not_listed(wk, settings):
    wk.server.discovered = set(OTHER_NAMES)
    conn = db("auto")
    assert im.provider_for(settings, conn) is im._local
    r = im.readiness(settings, conn)
    assert r["missing"] == ["video_not_listed", "talk_not_listed"] and r["active"] == "local"
    assert r["wiskey"]["capabilities"]["state"] == "read" and not r["wiskey"]["capabilities"]["video_listed"]
    assert r["wiskey"]["listed_in"] is None
    assert im.talk_gap(settings, conn, local_descriptor()) == "not_listed"


def test_video_listed_but_talk_in_neither_is_talk_not_listed(wk, settings):
    wk.server.discovered = {w10.DESCRIBE, w10.STREAM_LEASE} | OTHER_NAMES
    r = im.readiness(settings, db("auto"))
    assert r["missing"] == ["talk_not_listed"] and r["video_ready"] and not r["talk_ready"] and r["active"] == "wiskey"


# ================================================================ the signed read refused / failed

@pytest.mark.parametrize("arrange, reason, kind", [
    (lambda s: setattr(s, "secret", "another-pairing-secret"), "direct_connect_refused", "refused"),  # WisKey does not accept the key
    (lambda s: s.script.__setitem__("direct/capabilities", {"error": "Unauthorized"}), "discovery_refused:Unauthorized", "refused"),
    (lambda s: s.script.__setitem__("direct/capabilities", {"error": "command_unavailable"}), "discovery_refused:command_unavailable", "incompatible"),
    (lambda s: setattr(s, "refuse_open", True), "direct_unreachable", "unreachable"),
    (lambda s: setattr(s, "clock_offset_s", 30.0), "clock_skew", "clock"),
])
def test_a_refused_or_failed_signed_read_stays_local_with_the_reason(wk, settings, arrange, reason, kind):
    arrange(wk.server)
    conn = db("auto")
    assert im.provider_for(settings, conn) is im._local, "nothing signed confirmed W10: Arx's own source"
    r = im.readiness(settings, conn)
    assert r["missing"] == ["capabilities_unread"], "not 'not listed': the signed document could not be read"
    cap = r["wiskey"]["capabilities"]
    assert cap["state"] == "unread" and cap["reason"] == reason and cap["reason_kind"] == kind
    assert not r["video_ready"] and r["active"] == "local"
    assert im.talk_gap(settings, conn, local_descriptor()) == "capabilities_unread"
    assert set(r["missing"]) <= set(im.READINESS_CODES)


def test_a_lost_answer_is_unread_and_never_re_sent(wk, settings, monkeypatch):
    monkeypatch.setattr(caps, "READ_TIMEOUT_S", 1.0)
    wk.server.script["direct/capabilities"] = "drop"
    conn = db("auto")
    r = im.readiness(settings, conn)
    assert r["missing"] == ["capabilities_unread"] and r["wiskey"]["capabilities"]["reason_kind"] == "unreachable"
    assert reads(wk.server) == 1 and connects(wk.server) == 1
    im.provider_for(settings, conn)
    im.readiness(settings, conn)
    assert reads(wk.server) == 1 and connects(wk.server) == 1, "the failure is cached: nothing is retried inside FAIL_TTL_S"


def test_without_a_key_that_signs_nothing_is_read_and_pairing_is_the_reason(wk, settings):
    for key in (None, "", ha_bridge.BridgeKey("rotated-material", "k-2")):
        wk.state["key"] = key
        conn = db("auto")
        assert im.listing(settings, conn).signed is None
        assert im.provider_for(settings, conn) is im._local
        r = im.readiness(settings, conn)
        assert r["missing"] in (["pairing_missing"], ["pairing_key_rotated"]), "no unsigned path, and no claim about what is listed"
        assert r["wiskey"]["capabilities"]["state"] == "not_read"
        assert im.talk_gap(settings, conn, local_descriptor()) == "pairing"
    assert connects(wk.server) == 0, "never an unsigned (or unsignable) read"


def test_the_local_choice_reads_nothing_for_the_drawer(wk, settings):
    conn = db("local")
    assert im.provider_for(settings, conn) is im._local
    assert im.talk_gap(settings, conn, local_descriptor()) == "provider_local"
    assert connects(wk.server) == 0


# ================================================================ the cache: TTL, invalidation, nonces

def test_the_listing_is_cached_for_the_ttl_and_read_again_after_it(wk, settings):
    conn = db("auto")
    for _ in range(5):
        assert im.listing(settings, conn).talk
        im.provider_for(settings, conn)
    assert connects(wk.server) == 1
    wk.clock.now += caps.TTL_S - 1
    assert im.listing(settings, conn).talk and connects(wk.server) == 1
    wk.clock.now += 2
    wk.server.discovered = set(OTHER_NAMES)  # WisKey changed in the meantime: seen at the next read
    assert not im.listing(settings, conn).talk and connects(wk.server) == 2
    assert im.provider_for(settings, conn) is im._local


def test_a_failed_read_waits_its_own_shorter_ttl(wk, settings):
    wk.server.refuse_open = True
    conn = db("auto")
    assert im.listing(settings, conn).unread
    wk.server.refuse_open = False
    wk.clock.now += caps.FAIL_TTL_S - 1
    assert im.listing(settings, conn).unread, "still the cached failure"
    wk.clock.now += 2
    assert im.listing(settings, conn).talk, "after FAIL_TTL_S: a new signed read"
    assert caps.FAIL_TTL_S < caps.TTL_S


def test_a_key_change_invalidates_the_cache(wk, settings):
    conn = db("auto")
    assert im.listing(settings, conn).talk and connects(wk.server) == 1
    wk.state["key"] = "a-new-pairing-secret"  # a re-pair: the old document must not decide for the new key
    found = im.listing(settings, conn)
    assert connects(wk.server) == 2, "a new key reads afresh"
    assert found.unread and found.signed.reason == "direct_connect_refused", "the fake still holds the old secret: refused"
    wk.server.secret = "a-new-pairing-secret"
    wk.state["key"] = SECRET
    assert im.listing(settings, conn).unread, "back to the first key: its own (new) entry is not the old one"
    assert connects(wk.server) == 3


def test_a_provider_change_invalidates_the_cache(wk, settings):
    conn = db("local")
    assert im.readiness(settings, conn)["wiskey"]["capabilities"]["state"] == "read" and connects(wk.server) == 1
    set_choice(conn, "auto")
    assert isinstance(im.provider_for(settings, conn), im.WiskeyBridgeProvider)
    assert connects(wk.server) == 2, "the choice changed: the document is read again for it"
    im.provider_for(settings, conn)
    assert connects(wk.server) == 2


def test_invalidate_and_set_provider_drop_the_entry(wk, settings):
    conn = db("auto")
    im.listing(settings, conn)
    caps.invalidate()
    im.listing(settings, conn)
    im.set_provider(None)
    im.listing(settings, conn)
    assert connects(wk.server) == 3


def test_every_signed_frame_spends_a_fresh_nonce_and_nothing_is_replayed(wk, settings):
    conn = db("auto")
    for _ in range(3):
        caps.invalidate()
        assert im.listing(settings, conn).talk
    assert connects(wk.server) == 3 and reads(wk.server) == 3 and reads(wk.server, "direct/time") == 3
    assert len(wk.server.nonces) == 9, "connect + capabilities + time, three times: nine distinct nonces (the fake refuses a replay)"


# ================================================================ the direct join's document (no I/O)

def test_the_direct_join_document_is_used_when_the_join_is_up(wk, settings):
    transport = bridge.DirectApiTransport(wk.server.opener, lambda: SECRET)
    session = join.DirectCommandSession(transport)
    j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True)
    try:
        assert j.selected("users/get"), "the join is up: authenticated, discovery read on its connection"
        before = (connects(wk.server), reads(wk.server), len(wk.server.nonces))
        join.JOIN = j
        found = im.listing(settings, db("auto"))
        assert found.talk and found.signed.source == caps.SOURCE_JOIN
        assert (connects(wk.server), reads(wk.server), len(wk.server.nonces)) == before, "no new socket, no signed frame: the join's document"
    finally:
        join.JOIN = None
        session.close()


def test_a_join_that_is_not_up_is_not_used(wk, settings):
    transport = bridge.DirectApiTransport(wk.server.opener, lambda: SECRET)
    session = join.DirectCommandSession(transport)
    j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True)
    try:
        join.JOIN = j  # installed, but its socket never opened
        found = im.listing(settings, db("auto"))
        assert found.talk and found.signed.source == caps.SOURCE_READ and connects(wk.server) == 1
    finally:
        join.JOIN = None
        session.close()


def test_never_read_on_an_event_loop_thread(wk, settings):
    async def on_loop() -> Any:
        return caps.listing(settings, db("auto"), "auto")

    assert asyncio.run(on_loop()) is None and connects(wk.server) == 0


def test_reason_kinds_cover_the_reader_codes():
    assert caps.reason_kind(None) is None
    assert caps.reason_kind("discovery_unknown:outcome_unknown") == "unreachable"
    assert caps.reason_kind("discovery_refused:Unauthorized") == "refused"
    assert caps.reason_kind("lifecycle_unsupported") == "incompatible"
    assert caps.reason_kind("ttl_exceeds_server_max") == "clock"
    assert caps.reason_kind("read_error:ValueError") == "failed"


# ================================================================ the endpoints (the drawer and the Settings row)

@pytest.fixture()
def drawer(feed, fake_go2rtc, monkeypatch):  # noqa: F811
    """The real app on the test feed (station entry-a online), provider `auto`, media `video_talk`, the rc.10 overview, and WisKey's
    signed provider on the fake station (its transports are the only fake: the selection rule is the real one)."""
    c, s = camera_feed(feed)
    server = JoinServer()
    server.discovered = W10_NAMES | OTHER_NAMES
    station = FakeStation()
    p = im.WiskeyBridgeProvider(transport_for(station), discovery=lambda _s: overview())
    p.signing_ready = lambda: True  # type: ignore[attr-defined]
    monkeypatch.setattr(intercom_sync.SYNC, "api_facts", lambda st: overview())
    monkeypatch.setattr(ha_bridge, "signing_key", lambda conn: SECRET)
    monkeypatch.setattr(im, "bridge_provider", lambda settings, conn: p)
    im.set_provider(None)
    caps.set_opener_for_tests(server.opener)
    assert c.patch("/api/v1/settings", json={"access.station_media": "video_talk", "access.station_media_provider": "auto"}).status_code == 200
    yield SimpleNamespace(client=c, server=server)
    caps.set_opener_for_tests(None)
    p.video.close()
    im.MEDIA.reset()
    caps.invalidate()


def test_the_drawer_offers_talk_from_wiskey_when_only_the_signed_document_lists_it(drawer):
    body = drawer.client.get(MEDIA.format("entry-a")).json()
    assert body["state"] == "ready", body
    assert body["talk"]["available"] is True and body["talk"]["reason"] is None and body["talk"]["transport"] == "pcmu_frames"
    r = drawer.client.get(READINESS).json()
    assert r["active"] == "wiskey" and r["missing"] == [] and r["talk_ready"] is True and r["wiskey"]["listed_in"] == "capabilities"
    assert set(r) == {"choice", "active", "mode", "wiskey", "missing", "video_ready", "talk_ready"}
    assert drawer.server.opened == 1


def test_the_drawer_and_the_row_say_capabilities_unread_when_the_signed_read_is_refused(drawer):
    drawer.server.script["direct/capabilities"] = {"error": "Unauthorized"}
    body = drawer.client.get(MEDIA.format("entry-a")).json()
    assert body["state"] == "ready" and body["talk"] == {"available": False, "reason": "capabilities_unread"}, "Arx's own video, and why no talk"
    r = drawer.client.get(READINESS).json()
    assert r["missing"] == ["capabilities_unread"] and r["active"] == "local"
    assert r["wiskey"]["capabilities"]["reason"] == "discovery_refused:Unauthorized" and r["wiskey"]["capabilities"]["reason_kind"] == "refused"


def test_the_drawer_says_not_listed_when_neither_source_lists_talk(drawer):
    drawer.server.discovered = set(OTHER_NAMES)
    body = drawer.client.get(MEDIA.format("entry-a")).json()
    assert body["state"] == "ready" and body["talk"] == {"available": False, "reason": "not_listed"}
    assert drawer.client.get(READINESS).json()["missing"] == ["video_not_listed", "talk_not_listed"]
