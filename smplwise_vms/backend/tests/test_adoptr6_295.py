"""ADOPTR6-295: adoption of the Mac reply-6 delivery (M1-M6) per the Windows review (docs/changes/ADOPTR6-295-ADOPTION-RECEIPT.md).
FAKES ONLY: the WisKey side is the fake direct server (test_wkjoin_295.JoinServer), the CSV preview host (test_wkr5_csv_295.CsvPort) or channel
doubles; nothing here reaches a network, Home Assistant, a station, a door, a microphone, a speaker or a provider.

- W-010 / WR6-01: a resolve read's receipt belongs to THAT read (previous call left a receipt, then a local mismatch: no second network call,
  the previous receipt unused, the verdict stays unknown) - and the ONE selection point of the two WK4ADOPT peer reads.
- W-001 + W-002 / M5 (WMR6-DOWNLINK-02): on the candidate router a revoke / an expiry ends the downlink through its EXPLICIT close (fence +
  drain + join), and the CURRENT admission is checked before every packet reaches the browser - the talk route and the listen route.
- W-006 / M3: the people CSV reader on the nine answers (multi-line source_line, upsert rows, the start window, the native receipt)."""
from __future__ import annotations

import asyncio
import json
import sqlite3 as _sqlite3
import time
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import pytest
from conftest import as_user
from intercom_station_scope import station_scope  # noqa: F401 - a fixture (csvw)
from test_wk4adopt_295 import MIG_0145, P_BINDING, P_OWNER, P_REPO, P_REV, _client, _intent, _row, peer_env  # noqa: F401 - fixture
from test_wkf01f02_295 import ChannelDouble, SocketDouble, session, settle
from test_wkjoin_295 import JoinServer
from test_wkr5_csv_295 import API, confirm, csvw, enable, intents, preview  # noqa: F401 - fixture
from w10_fake_station import SECRET

from smplwise.routers import intercom_listen as router_il
from smplwise.routers import intercom_media as router_im
from smplwise.services import intercom_listen as il
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_intents as wi
from smplwise.services import wiskey_listen_adapter as ad
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_peer as wp
from smplwise.services import wiskey_peer_registry as wr
from smplwise.services import wiskey_people_csv as wpc

PACKET = bytes([0x55]) * 800
FRAME = bytes([0x7F]) * 160
# the router checks the session end and publishes with NO await in between: the two clock reads differ by microseconds, not by a packet
CHECK_TO_PUBLISH_S = 0.01

# ================================================================ W-010 / WR6-01: per-invocation receipt


def _all_frames(env: Any) -> int:
    return len(env.server.received)


@pytest.mark.parametrize("first, first_outcome", [
    ({"result": {"schema_version": 1, "state": "unknown", "receipt": None}}, "result"),
    ({"result": {"schema_version": 1, "state": "found", "receipt": {"central_state": "committed", "device_application": "unknown",
                                                                    "signed_capture_covered": False, "person_revision": 5}}}, "result"),
    ({"error": "original_reference_mismatch"}, "refused"),
])
def test_wr6_01_a_previous_receipt_is_never_the_receipt_of_a_later_local_mismatch(peer_env, first, first_outcome):  # noqa: F811
    """WR6-01 (Windows review, Arx-only): call 1 leaves a receipt (a result OR a verified refusal); call 2 is refused LOCALLY by
    `resolve_parameters` (the original names another peer). No second frame of ANY command leaves, the returned receipt is None (not the
    first one), the history holds only the call that happened, and the verdict is UNKNOWN - no replay, no false-commit claim."""
    peer_env.server.script["peer_bindings/get"] = {"result": _row()}
    peer_env.server.script["peer_receipts/resolve"] = first
    current = _client(peer_env).current().peer
    original = wp.ResolveOriginal.of(current, descriptor_epoch="epoch-7", descriptor={"request": {"id": "req-1"}})
    _verdict, first_receipt = peer_env.resolve.read(current, original)
    assert first_receipt is not None and first_receipt.outcome == first_outcome and not first_receipt.replay_permitted
    other = wp._mint_peer(value="peer-other", peer_binding_ref=P_BINDING, peer_binding_revision=P_REV, repository_id=P_REPO,
                          query_owner_id=P_OWNER)
    foreign = wp.ResolveOriginal.of(other, descriptor_epoch="epoch-7", descriptor={"request": {"id": "req-2"}})
    frames_before = _all_frames(peer_env)
    verdict, receipt = peer_env.resolve.read(current, foreign)
    assert _all_frames(peer_env) == frames_before, "no second network call of any command"
    assert receipt is None and receipt is not first_receipt, "the earlier receipt is not attributed to this unsent read"
    assert (verdict.state, verdict.settles, verdict.replay_permitted, verdict.code) == ("unknown", False, False, "original_reference_mismatch")
    assert peer_env.resolve.receipts == [first_receipt]


def test_wr6_01_resolve_intent_after_a_local_mismatch_keeps_the_intent_unknown_and_unsendable(peer_env):  # noqa: F811
    peer_env.server.script["peer_bindings/get"] = {"result": _row()}
    peer_env.server.script["peer_receipts/resolve"] = {"result": {"schema_version": 1, "state": "unknown", "receipt": None}}
    current = _client(peer_env).current().peer
    c = _sqlite3.connect(":memory:")
    c.executescript(MIG_0145.read_text(encoding="utf-8"))
    o = _intent(c, current)
    original = wp.ResolveOriginal.of(current, descriptor_epoch="epoch-7", descriptor={"request": {"id": "req-1"}, "action": "users/update"})
    wi.resolve_intent(c, o, original, current, peer_env.resolve)  # a real read that left a receipt
    other = wp._mint_peer(value="peer-other", peer_binding_ref=P_BINDING, peer_binding_revision=P_REV, repository_id=P_REPO,
                          query_owner_id=P_OWNER)
    frames_before = _all_frames(peer_env)
    result, verdict, receipt = wi.resolve_intent(c, o, wp.ResolveOriginal.of(other, descriptor_epoch="epoch-7", descriptor={"r": 2}), current,
                                                 peer_env.resolve)
    assert (result, wi.state(c, o), receipt, verdict.state) == ("open", "unknown", None, "unknown")
    assert _all_frames(peer_env) == frames_before and wi.state(c, o) != "never_committed"
    with pytest.raises(wi.IntentError):
        wi.mark_sent(c, o)  # an UNKNOWN intent is never sent again: no replay


# ================================================================ W-010: the one selection point of the WK4ADOPT peer reads

@pytest.fixture()
def jenv() -> Any:
    server = JoinServer()
    session_ = join.DirectCommandSession(bridge.DirectApiTransport(server.opener, lambda: SECRET))
    j = join.DirectJoin(session_, provider_ok=lambda: True, key_ok=lambda: True)
    j.registry_transport = wr.LiveRegistryTransport(j.capture_port)
    j.resolve_transport = wi.LiveResolveTransport(j.capture_port)
    yield SimpleNamespace(server=server, session=session_, join=j)
    try:
        session_.run_sync(server.stop(), 5)
    except Exception:  # noqa: BLE001
        pass
    session_.close()


def test_the_join_hands_out_the_peer_reads_only_while_their_command_is_selected(jenv):
    assert jenv.join.registry_or_none() is jenv.join.registry_transport
    assert jenv.join.resolve_or_none() is jenv.join.resolve_transport
    assert [c for c, _k, _p in jenv.server.received if c.startswith("peer_")] == [], "selecting sends no peer read"
    jenv.server.discovered = {"users/create"}  # a WisKey whose discovery does not list the two peer reads
    jenv.session.discovery.forget()
    assert jenv.join.registry_or_none() is None and jenv.join.resolve_or_none() is None


def test_the_peer_reads_are_refused_without_the_auto_choice_or_the_key():
    server = JoinServer()
    s = join.DirectCommandSession(bridge.DirectApiTransport(server.opener, lambda: SECRET))
    try:
        for provider_ok, key_ok in ((False, True), (True, False)):
            j = join.DirectJoin(s, provider_ok=lambda v=provider_ok: v, key_ok=lambda v=key_ok: v)
            j.registry_transport, j.resolve_transport = object(), object()
            assert j.registry_or_none() is None and j.resolve_or_none() is None
        assert server.received == []
    finally:
        try:
            s.run_sync(server.stop(), 5)
        except Exception:  # noqa: BLE001
            pass
        s.close()


def test_no_product_module_calls_the_resolve_read_outside_the_join_and_its_own_module():
    """The honest caller map (W-010): `resolve_intent` / the join's `resolve_transport` have NO route or job caller in this build - the
    recovery of an UNKNOWN intent is not scheduled (no new scheduler). A new caller must update this test and the adoption receipt."""
    from pathlib import Path

    root = Path(wi.__file__).resolve().parents[1]
    callers = sorted(str(p.relative_to(root)).replace("\\", "/") for p in root.rglob("*.py")
                     if ("resolve_intent(" in (t := p.read_text(encoding="utf-8")) or "resolve_or_none(" in t or ".resolve_transport" in t))
    assert callers == ["services/wiskey_direct_join.py", "services/wiskey_intents.py"]


# ================================================================ W-001 + W-002 / M5: the talk route (router `_pump.from_station`)

class SpyDownlink(ad.ReceiveDownlink):
    made: list["SpyDownlink"] = []

    def __init__(self, *a: Any, **kw: Any) -> None:
        super().__init__(*a, **kw)
        self.closes: list[str] = []
        SpyDownlink.made.append(self)

    async def close(self, reason: str) -> None:
        self.closes.append(reason)
        await super().close(reason)


@pytest.fixture()
def spy(monkeypatch) -> Any:
    SpyDownlink.made = []
    monkeypatch.setattr(router_im, "ReceiveDownlink", SpyDownlink)
    return SpyDownlink


class Lease:
    """A lease double with the router's two checks: the awaited `confirm` (current admission) and the synchronous `should_stop`."""

    def __init__(self) -> None:
        self.denied = False
        self.confirm_denied = False
        self.confirms = 0

    async def confirm(self) -> bool:
        self.confirms += 1
        return not self.confirm_denied

    def should_stop(self) -> bool:
        return self.denied


class TimedSocket(SocketDouble):
    def __init__(self) -> None:
        super().__init__()
        self.sent_at: list[float] = []

    async def send_bytes(self, data: bytes) -> None:
        self.sent_at.append(time.time())
        await super().send_bytes(data)


def _assert_explicitly_closed(dl: SpyDownlink) -> None:
    assert dl.closes, "the downlink's explicit close ran (natural _end alone is not the fence)"
    assert dl._fenced and dl._queue.qsize() <= 1, "fenced and drained (only the sentinel may remain)"
    assert dl._task is not None and dl._task.done(), "the producer is joined"
    assert dl._close_task is not None and dl._close_task.done()


@pytest.mark.parametrize("how", ["revoke_by_watch", "revoke_before_publish", "confirm_refused"])
def test_a_revoke_during_a_talk_closes_the_downlink_explicitly_and_publishes_nothing_after_it(spy, how):
    async def scenario() -> None:
        ws, ch, t, lease = TimedSocket(), ChannelDouble(), session(30), Lease()
        task = asyncio.create_task(router_im._pump(ws, t, ch, lease))
        ch.audio.put_nowait(PACKET)
        await settle(lambda: len(ws.sent_bytes) == 1)
        if how == "confirm_refused":
            lease.confirm_denied = True  # the access generation moved; the awaited re-check says no
        else:
            lease.denied = True
        if how == "revoke_before_publish":
            for _ in range(3):
                ch.audio.put_nowait(PACKET)  # admitted by the producer AFTER the revoke: never published
        outcome = await asyncio.wait_for(task, 3)
        assert outcome == "access_lost"
        assert ws.sent_bytes == [PACKET], "nothing reaches the browser after the revoke"
        (dl,) = spy.made
        _assert_explicitly_closed(dl)
        assert ch.receivers == 0, "the receive of the original channel is joined"
        assert lease.confirms >= 1, "the current admission was confirmed before the one publication"

    asyncio.run(scenario())


def test_the_session_expiry_during_a_talk_closes_the_downlink_and_nothing_is_published_at_or_after_it(spy):
    async def scenario() -> None:
        ws, ch, t, lease = TimedSocket(), ChannelDouble(), session(0.6), Lease()
        task = asyncio.create_task(router_im._pump(ws, t, ch, lease))
        while not task.done():
            ch.audio.put_nowait(PACKET)
            await asyncio.sleep(0.05)
        assert task.result() == "expired"
        assert ws.sent_bytes and all(at < t.expires_at + CHECK_TO_PUBLISH_S for at in ws.sent_at), "no packet after the session end"
        (dl,) = spy.made
        _assert_explicitly_closed(dl)

    asyncio.run(scenario())


def test_a_natural_upstream_end_keeps_the_admitted_tail_only_while_the_admission_still_holds(spy):
    """M5 semantics on the router: a natural `_end` keeps the tail it admitted (component rule) - but each tail packet still passes the
    router's current admission, so a revoke between the end and the tail publishes nothing of it."""
    async def scenario() -> None:
        ws, ch, t, lease = TimedSocket(), ChannelDouble(), session(30), Lease()
        lease.denied = True  # revoked before the tail is served
        ch.audio.put_nowait(PACKET)
        ch.audio.put_nowait(bridge.MediaBridgeError("connection_closed", "closed"))  # the station's sound ends naturally
        outcome = await asyncio.wait_for(router_im._pump(ws, t, ch, lease), 3)
        assert outcome == "access_lost" and ws.sent_bytes == []
        _assert_explicitly_closed(spy.made[0])

    asyncio.run(scenario())


# ================================================================ W-002 / M5: the listen route (router `_pump.to_browser`)

class ListenChannel:
    """The listen channel shape (frames / wait_closed / close) over a real ReceiveDownlink, its receive fed by a queue."""

    def __init__(self) -> None:
        self.q: asyncio.Queue[bytes | Exception] = asyncio.Queue()
        self.downlink = ad.ReceiveDownlink(self._receive)

    async def _receive(self) -> bytes:
        item = await self.q.get()
        if isinstance(item, Exception):
            raise item
        return item

    async def open(self) -> None:
        await self.downlink.open()

    def frames(self) -> Any:
        return self.downlink.frames()

    async def wait_closed(self) -> str:
        return await self.downlink.wait_closed()

    async def close(self, reason: str) -> None:
        await self.downlink.close(reason)


def _listen_session(seconds: float = 30) -> il.ListenSession:
    now = time.time()
    return il.ListenSession(id="l" * 24, station_id="entry-a", user_id="u1", username="op", request_id="r1", mode="on", created_at=now,
                            expires_at=now + seconds)


@pytest.mark.parametrize("how", ["should_stop", "confirm_refused"])
def test_listen_publishes_no_admitted_tail_after_a_revoke(how):
    """The gap this item closed: before ADOPTR6-295 `to_browser` published every queued frame with no admission check, so a revoke
    reached the browser only at the watch's next 1 s tick and a naturally ended downlink's whole tail was published regardless."""
    async def scenario() -> None:
        ws, s, lease, ch = TimedSocket(), _listen_session(), Lease(), ListenChannel()
        await ch.open()
        ch.q.put_nowait(FRAME)
        task = asyncio.create_task(router_il._pump(ws, s, ch, lease))
        await settle(lambda: len(ws.sent_bytes) == 1)
        if how == "confirm_refused":
            lease.confirm_denied = True
        else:
            lease.denied = True
        for _ in range(3):
            ch.q.put_nowait(FRAME)
        ch.q.put_nowait(RuntimeError("audio_connection_lost"))  # natural end with an admitted tail
        outcome = await asyncio.wait_for(task, 3)
        assert outcome == "access_lost" and ws.sent_bytes == [FRAME] and s.frames == 1
        await ch.close(outcome)  # what listen_ws does with the outcome (see the ASGI test below)
        assert ch.downlink._fenced and ch.downlink._task.done()

    asyncio.run(scenario())


def test_listen_expiry_publishes_nothing_at_or_after_the_end():
    async def scenario() -> None:
        ws, s, lease, ch = TimedSocket(), _listen_session(0.5), Lease(), ListenChannel()
        await ch.open()
        task = asyncio.create_task(router_il._pump(ws, s, ch, lease))
        while not task.done():
            ch.q.put_nowait(FRAME)
            await asyncio.sleep(0.04)
        assert task.result() == "expired" and ws.sent_bytes and all(at < s.expires_at + CHECK_TO_PUBLISH_S for at in ws.sent_at)

    asyncio.run(scenario())


def test_listen_without_a_revoke_still_delivers_the_admitted_tail_of_a_natural_end():
    async def scenario() -> None:
        ws, s, lease, ch = TimedSocket(), _listen_session(), Lease(), ListenChannel()
        await ch.open()
        for _ in range(3):
            ch.q.put_nowait(FRAME)
        ch.q.put_nowait(RuntimeError("audio_connection_lost"))
        outcome = await asyncio.wait_for(router_il._pump(ws, s, ch, lease), 3)
        assert outcome == "upstream_closed" and ws.sent_bytes == [FRAME] * 3 and lease.confirms == 3

    asyncio.run(scenario())


# ---------------------------------------------------------------- the same through the real listen socket (TestClient, synthetic downlink)

from test_intercom import camera_feed, fake_go2rtc, feed  # noqa: E402,F401 - fixtures
from test_intercom_media import audit_rows, fake_provider  # noqa: E402,F401 - fixtures

from smplwise.services import leases  # noqa: E402


@pytest.fixture()
def _listen_reset() -> Any:
    il.LISTEN.reset()
    yield
    il.LISTEN.reset()


def test_listen_ws_closes_its_channel_explicitly_with_the_revoke_reason(feed, fake_go2rtc, fake_provider, monkeypatch, _listen_reset):  # noqa: F811
    closes: list[tuple[str, bool]] = []
    original = ad.SyntheticDownlink.close

    async def recorded(self: ad.SyntheticDownlink, reason: str) -> None:
        await original(self, reason)
        closes.append((reason, self._fenced))

    monkeypatch.setattr(ad.SyntheticDownlink, "close", recorded)
    c, s = camera_feed(feed)
    r = c.patch("/api/v1/settings", json={"access.station_listen": "on"})
    assert r.status_code == 200, r.text
    fake_provider.listen_end = None
    monkeypatch.setattr(leases, "RECHECK_S", 0.0)
    t = c.post("/api/v1/access-control/stations/entry-a/listen").json()
    with c.websocket_connect(f"/{t['ws_path']}") as ws:
        ws.receive_text()
        assert c.patch("/api/v1/settings", json={"access.station_listen": "off"}).status_code == 200
        for _ in range(200):
            message = ws.receive()
            assert message.get("type") != "websocket.close", "closed before the closing text"
            if message.get("text"):
                assert json.loads(message["text"]) == {"type": "listen/closed", "value": "access_lost"}
                break
    assert closes and closes[-1] == ("access_lost", True), "listen_ws called the explicit close (fenced) with the revoke reason"


# ================================================================ W-005 / W-013 / M6: the static alignment, pinned (no activation)

# Transcribed from the Mac reply-6 M6_CAPTURE_TEMPLATE_COMPATIBILITY.json (native CODE 6a8a0a2c; the three native file hashes are unchanged
# from the earlier delivery 924df3e9 that MAC_TABLE names): action -> (native symbol, native file sha256, closed inner keys).
M6_SEVEN = {
    "capture_start": ("NativeCaptureComposition.start", "bcf54e340c2b629cb14ed5cbaaf4f2068c9d29f51580f80021c9640a7d4b27c1", ("lease",)),
    "capture_status": ("NativeCaptureComposition.status", "bcf54e340c2b629cb14ed5cbaaf4f2068c9d29f51580f80021c9640a7d4b27c1", ("lease_ref", "session_id")),
    "capture_confirm": ("NativeCaptureComposition.confirm", "bcf54e340c2b629cb14ed5cbaaf4f2068c9d29f51580f80021c9640a7d4b27c1",
                        ("lease_ref", "session_id", "label")),
    "capture_cancel": ("ExperimentalLeaseHost.step", "d662756464cc674b158d7a0f2b42c87552f90ba7a70a76678f6bf0b9228e0c2f", ("lease_ref", "session_id")),
    "lease_revoke": ("CaptureLeaseHost.event", "f179e6984374eddfbed677733dbe83fb49eb53cb3c228d50da4b9f43decac2ba",
                     ("stream_id", "sequence", "scope", "lease_ref", "permission_revision", "reason", "revoked_at")),
    "lease_heartbeat": ("CaptureLeaseHost.event", "f179e6984374eddfbed677733dbe83fb49eb53cb3c228d50da4b9f43decac2ba",
                        ("stream_id", "sequence", "live_leases", "permission_revision")),
    "lease_stream_reset": ("CaptureLeaseHost.event", "f179e6984374eddfbed677733dbe83fb49eb53cb3c228d50da4b9f43decac2ba",
                           ("stream_id", "previous_stream_id", "sequence", "reason")),
}


def test_m6_the_seven_card_capture_actions_match_the_reviewed_native_source_and_nothing_is_enabled():
    from smplwise.services import intercom_messaging_adapter as ima
    from smplwise.services import wiskey_capture_map as cm

    assert {a: (sym, path_hash[1], keys) for a, (sym, path_hash, keys) in cm.MAC_TABLE.items()} == M6_SEVEN
    assert len(cm.DTO9_KEYS) == 9 and "protocol" not in cm.DTO9_KEYS and "protocol" in cm.WIRE_KEYS, "protocol + DTO9"
    assert cm.MAPPING_ENABLED is False, "CAPMAP stays off; no mapping transport is selected by this work"
    assert ima.TEMPLATE_SEND_SUPPORTED is False, "the original Arx permit is not changed or activated"


# ================================================================ W-006 / M3: the nine answers on the reader

def test_a_multi_line_record_is_named_by_the_line_it_ends_on_and_mapped_to_arxs_record_number():
    data = b'employee_no,display_name\n9001,"Synthetic\nTwo Lines"\n\n9002,Second\n'
    assert wpc.source_lines(data) == {3: 1, 5: 3}, "line 3 ends record 1; the blank line 4 is record 2 (skipped); line 5 ends record 3"


def test_the_column_map_takes_every_original_header_exactly_and_the_native_limits_refuse_locally():
    assert wpc.column_map(b"\xef\xbb\xbfemployee_no,display_name,phone\n1,a,b\n") == {"employee_no": "employee_no", "display_name": "display_name",
                                                                                    "phone": "phone"}
    with pytest.raises(wpc.CsvError) as err:
        wpc.column_map(b"display_name,phone\nA,1\n")
    assert (err.value.code, err.value.fields) == ("csv_invalid_headers", ("employee_no",))
    with pytest.raises(wpc.CsvError) as err:
        wpc.source_lines(("employee_no,display_name\n" + "".join(f"{i},n{i}\n" for i in range(501))).encode())
    assert err.value.code == "csv_too_many_rows" and err.value.outcome == "local"
    with pytest.raises(wpc.CsvError) as err:
        wpc.column_map(("employee_no,display_name," + ",".join(f"c{i}" for i in range(31)) + "\n").encode())
    assert err.value.code == "csv_invalid_headers"


def test_the_metadata_refs_are_labels_within_the_native_bounds():
    assert all(wpc._metadata_ref_ok(v) for v in (wpc.OWNERSHIP_POLICY_REF, wpc.REVISION_POLICY_REF, "csv-" + "a" * 40))
    assert not any(wpc._metadata_ref_ok(v) for v in ("", "x" * 129, "a\nb", 5, None))


def test_a_start_whose_own_request_window_passed_is_refused_locally_and_never_edited():
    now = datetime(2026, 10, 25, 12, 0, 0, tzinfo=timezone.utc)
    req = {"request_expires_at": "2026-10-25T12:00:10Z", "execution_expires_at": "2026-10-25T12:03:00Z"}
    assert wpc.start_window_open(req, now) is True
    assert wpc.start_window_open(req, now + timedelta(seconds=10)) is False
    assert wpc.start_window_open({**req, "execution_expires_at": "2026-10-25T11:59:00Z"}, now) is False
    fresh = wpc.Preview(wpc.SCHEMA, "a", "b", (), now + timedelta(seconds=60), "r1", {"request": dict(req), "policy_snapshot": {}})
    adapters = SimpleNamespace(client=SimpleNamespace(start=lambda *a, **k: pytest.fail("nothing may be started")))
    with pytest.raises(wpc.CsvError) as err:
        wpc.start(None, adapters, fresh, now=now + timedelta(seconds=11))  # type: ignore[arg-type]
    assert (err.value.code, err.value.outcome) == ("preview_window_passed", "not_sent")
    assert fresh.start["request"] == req, "the original start is never edited or extended"


def test_the_native_receipt_is_a_central_commit_and_never_a_device_proof():
    base = {"id": "j", "kind": "import", "state": "completed_with_errors", "revision": 2, "created_at": "x", "updated_at": "y", "approval": None,
            "total": 3, "saved": 2, "failed": 1, "pending": 0, "errors": [{"row": 4, "code": "invalid_fields"}], "device_application": "unknown",
            "source_binding": {"schema": "wiskey-arx-native-row-receipt.v1", "rows": {
                "1": {"user_id": "u1", "person_revision": 1, "source_line": 2, "origin_ref": "o1", "state": "central_committed"},
                "2": {"user_id": "u2", "person_revision": 4, "source_line": 3, "origin_ref": "o2", "state": "central_committed"}}}}
    got = wpc.read_receipt(base)
    assert got == {"total": 3, "saved": 2, "failed": 1, "pending": 0, "job_state": "completed_with_errors",
                   "errors": [{"line": 4, "code": "invalid_fields"}], "central_committed_lines": [2, 3], "device_application": "unknown"}
    for bad in ({**base, "device_application": "delivered"}, {**base, "state": "done"}, {**base, "saved": -1}, {**base, "extra": 1},
                {k: v for k, v in base.items() if k != "source_binding"}, {**base, "errors": [{"row": "4", "code": "x"}]}):
        assert wpc.read_receipt(bad) is None


def test_a_multi_line_file_previews_with_wiskeys_end_lines_and_arxs_row_numbers(csvw):  # noqa: F811
    w = csvw
    enable(w)
    body = 'employee_no,display_name\n9001,"Synthetic\nTwo Lines"\n9002,Second\n'
    _, r = preview(w, body)
    assert r.status_code == 200, r.text
    assert [(x["source_line"], x["row"]) for x in r.json()["preview"]["rows"]] == [(3, 1), (4, 2)]


def test_upsert_is_explicit_and_its_update_rows_carry_wiskeys_person_and_revision(csvw):  # noqa: F811
    w = csvw
    enable(w)
    w.port.existing = {"9001": ("user-9001", 6)}
    job = w.staged("employee_no,display_name\n9001,Renamed\n9002,New Person\n")
    url = f"{API}/jobs/{job['id']}/wiskey-preview"
    body = b"employee_no,display_name\n9001,Renamed\n9002,New Person\n"
    r = w.c.post(url, content=body, headers={**as_user("root"), "Content-Type": "text/csv"})
    assert r.status_code == 409 and r.json()["code"] == "people_csv_refused", "create refuses an existing employee_no (WisKey's answer)"
    r = w.c.post(url + "?mode=upsert", content=body, headers={**as_user("root"), "Content-Type": "text/csv"})
    assert r.status_code == 200, r.text
    view = r.json()["preview"]
    assert (view["creates"], view["updates"]) == (1, 1) and [x["op"] for x in view["rows"]] == ["update", "create"]
    assert [p["policy_snapshot"]["private_input"]["mode"] for c, p in w.port.calls] == ["create", "upsert"]
    r = w.c.post(url + "?mode=sync", content=body, headers={**as_user("root"), "Content-Type": "text/csv"})
    assert r.status_code == 422, "no delete / sync / replace mode exists"
    r = confirm(w, job["id"], view["preview_digest"], "2")
    assert r.status_code == 200, r.text
    assert [p["policy_snapshot"]["private_input"]["mode"] for c, p in w.port.calls if c == wpc.COMMAND][-1] == "upsert", \
        "the fresh preview at confirm keeps the previewed mode"
    assert len(intents(w)) == 1
