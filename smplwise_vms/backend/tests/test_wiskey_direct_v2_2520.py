"""WISKEY-DIRECT-V2-2520 (row R7, FAKES ONLY): direct transport v2 with the KeySet kid, `direct/capabilities_v3` +
`direct/pairing_status_v2` discovery, PAIRING-Q2 = a (one current pairing, ambiguity refuses, no revoke over the wire) and B2-ABI
(each signed read <= 58 s, UNKNOWN never replayed).

The WisKey here is an in-memory v2 fake written in THIS file from WisKey rc19's published contracts (full-management-v1 `direct-*.v2`,
`direct--pairing_status_v2.*`; examples copied unchanged to tests/fixtures/wiskey_rc19/direct-v2/) and its source as read (not run):
`direct_bridge_api.py`, `trusted_actions/direct_bridge_origin.py`, `existing_bridge_auth.py`, `direct_bridge_discovery.py`. Its request
check is an independent implementation of the KeySet v2 recipe; its reply MAC follows the ARX-DEFINED v2 reply recipe (WisKey hands the
bytes to the Arx bridge's `native_keyset`, which bridge 0.10.8 does not have - see docs/changes/WISKEY-DIRECT-V2-2520.md). Nothing here
contacts a network, Home Assistant, a station or WisKey; it proves nothing about the real WisKey."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
from w10_fake_direct import Closed, MemorySocket

from smplwise.services import bridge_keys as bk
from smplwise.services import ha_bridge
from smplwise.services import wiskey_direct_catalog as wdc
from smplwise.services import wiskey_direct_discovery as dd
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_media_bridge as bridge

FIX = Path(__file__).parent / "fixtures" / "wiskey_rc19" / "direct-v2"
MATERIAL = "synthetic-r7-rotated-material-not-a-real-key"
KID = "g1-0123abcd"
KEY = ha_bridge.BridgeKey(MATERIAL, KID)
LEGACY = "synthetic-r7-legacy-pairing-secret"
DOMAIN = "hikvision_intercom"
REPO = "00000000-0000-4000-8000-0000000000a7"


def fixture(name: str) -> Any:
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def v2_sig(material: str, kid: str, ts: int, nonce: str, body: dict[str, Any]) -> str:
    """An independent implementation of the KeySet v2 request signature."""
    digest = hashlib.sha256(canonical(body)).hexdigest()
    return hmac.new(material.encode("utf-8"), f"v2.{kid}.{ts}.{nonce}.{digest}".encode("utf-8"), hashlib.sha256).hexdigest()


def v2_reply(material: str, kid: str, connection_ref: str, frame: dict[str, Any]) -> dict[str, Any]:
    """The Arx-defined v2 reply wrapper, written independently."""
    sig = hmac.new(material.encode("utf-8"), b"wiskey-direct-reply.v2." + canonical({"connection_ref": connection_ref, "frame": frame, "kid": kid}),
                   hashlib.sha256).hexdigest()
    return {"kind": "wiskey-direct-reply.v2", "connection_ref": connection_ref, "kid": kid, "frame": frame, "sig": sig}


def cap_v3(kid: str = KID, names: tuple[str, ...] = ("users/create", "users/get"), **over: Any) -> dict[str, Any]:
    names = tuple(sorted(set(names) | {"direct/capabilities_v3", "direct/pairing_status_v2", "direct/time"}))
    doc = {"schema_version": 3, "protocol": "wiskey-direct-ws.v2", "families": sorted({n.split("/")[0] for n in names}),
           "commands": [{"name": n, "envelope": "wiskey-direct-ws.v2", "api_contract": None, "explicit_parameter_version": None} for n in names],
           "limits": {"max_frame_bytes": 1048576, "max_command_ttl_seconds": 15}, "station_media_contract": "wiskey-station-media.v1",
           "stations": [], "resources": {"features": None},
           "lifecycle": {"pairing_rotation": "old_connection_invalidated_reconnect_required", "kid_in_v1": False,
                         "event_cursor_resume": True, "reconnect_adopts_old_resources": False},
           "physical_result": "unproven",
           "transport_authentication": {"version": 2, "kid": kid, "rotation_source": "smplwise_bridge.KeySet", "fallback_after_key_refusal": False},
           "manual_service_write": {"contract": "wiskey-native-service-write.v3", "read": "service_grants/current_v3",
                                    "writer": "genuine_HA_owner_service_grants_preview_commit_v3", "created_on_startup": False}}
    doc.update(over)
    return doc


def pairing_doc(kid: str | None = KID, version: int = 2, **over: Any) -> dict[str, Any]:
    doc = {"format": "wiskey-pairing-status.v2", "verified": True, "direction": "arx_to_native", "protocol_version": version, "kid": kid,
           "verified_at": datetime.now(timezone.utc).isoformat(), "freshness_s": 60, "principal_kind": "pairing_service",
           "source": "loaded_smplwise_bridge_keyset" if version == 2 else "loaded_smplwise_bridge_legacy_entry"}
    doc.update(over)
    return doc


# ================================================================ the v2 fake

class V2Server:
    """WisKey's v2 direct socket as Arx sees it. A refused connect closes without a word; a refused command answers `Unauthorized`."""

    def __init__(self, *, material: str = MATERIAL, kid: str = KID, entry: str = "fixture-entry-1") -> None:
        self.material, self.kid, self.entry = material, kid, entry
        self.opened = 0
        self.nonces: set[str] = set()
        self.received: list[tuple[str, str, dict[str, Any]]] = []  # (command, kind, parameters) of every ADMITTED command
        self.raw: list[dict[str, Any]] = []  # every command frame that arrived (admitted or not)
        self.script: dict[str, Any] = {}
        self.hello_protocol = "wiskey-direct-ws.v2"
        self.identity_override: dict[str, Any] = {}
        self.capabilities = cap_v3(kid)
        self.pairing: dict[str, Any] | None = None  # None: the matching document
        self.tamper = None
        self.tasks: list[asyncio.Task[Any]] = []
        self.sockets: list[MemorySocket] = []

    async def opener(self) -> MemorySocket:
        self.opened += 1
        client, server = MemorySocket.pair()
        self.sockets.append(server)
        self.tasks.append(asyncio.get_running_loop().create_task(self._serve(server)))
        return client

    def _check(self, message: Any, challenge: str, *, connect: bool, subject: str | None = None) -> dict[str, Any]:
        fields = {"kind", "command", "query_owner_id", "issued_at", "expires_at", "parameters", "kid", "ts", "nonce", "sig"}
        if not isinstance(message, dict) or set(message) != {"id", "type", "bridge"} or not isinstance(message["bridge"], dict):
            raise PermissionError("invalid_fields")
        b = message["bridge"]
        if set(b) != fields or b["kid"] != self.kid or re.fullmatch(r"[0-9a-f]{32}", b["nonce"] or "") is None:
            raise PermissionError("Unauthorized")
        body = {k: v for k, v in b.items() if k not in ("kid", "ts", "nonce", "sig")}
        want = v2_sig(self.material, b["kid"], b["ts"], b["nonce"], body)
        now = datetime.now(timezone.utc)
        if not hmac.compare_digest(want, b["sig"]) or abs(now.timestamp() - b["ts"]) > 60 or b["nonce"] in self.nonces:
            raise PermissionError("Unauthorized")
        issued, expires = datetime.fromisoformat(b["issued_at"]), datetime.fromisoformat(b["expires_at"])
        if not timedelta(0) < expires - issued <= timedelta(seconds=15) or issued > now + timedelta(seconds=2) or now >= expires:
            raise PermissionError("Unauthorized")
        if connect:
            if (message["id"] != 1 or message["type"] != DOMAIN + "/direct/connect" or body["kind"] != "wiskey-direct-connect.v2"
                    or body["command"] != "direct/connect" or body["query_owner_id"] != "pairing" or body["parameters"] != {"challenge": challenge}):
                raise PermissionError("Unauthorized")
        else:
            command = message["type"].removeprefix(DOMAIN + "/")
            if (body["kind"] not in ("wiskey-bridge-command.v2", "wiskey-peer-query.v2") or body["command"] != command
                    or body["query_owner_id"] != subject):
                raise PermissionError("Unauthorized")
        self.nonces.add(b["nonce"])
        return body

    async def _serve(self, sock: MemorySocket) -> None:
        challenge = uuid.uuid4().hex
        subject = "arx-service:" + self.entry

        async def send(frame: dict[str, Any]) -> None:
            wrapped = v2_reply(self.material, self.kid, challenge, frame)
            if self.tamper is not None:
                wrapped = self.tamper(wrapped)
            await sock.send(json.dumps(wrapped))

        try:
            await sock.send(json.dumps({"type": "hello", "protocol": self.hello_protocol, "challenge": challenge}))
            try:
                self._check(json.loads(await sock.recv()), challenge, connect=True)
            except PermissionError:
                await sock.close()  # WisKey never echoes unauthenticated input
                return
            identity = {"protocol": "wiskey-direct-ws.v2", "query_owner_id": subject, "principal_kind": "pairing_service",
                        "connection_ref": challenge, "repository_id": REPO, "kid": self.kid, **self.identity_override}
            await send({"id": 1, "type": "result", "success": True, "result": identity})
            last = 1
            while True:
                message = json.loads(await sock.recv())
                self.raw.append(message)
                mid = message.get("id")
                if type(mid) is not int or mid <= last:
                    await sock.close()
                    return
                last = mid
                try:
                    body = self._check(message, challenge, connect=False, subject=subject)
                except PermissionError as exc:
                    await send({"id": mid, "type": "result", "success": False, "error": {"code": str(exc), "message": "Direct bridge request refused"}})
                    continue
                command = body["command"]
                self.received.append((command, body["kind"], body["parameters"]))
                act = self.script.get(command)
                if act == "silent":
                    continue
                if act == "close":
                    await sock.close()
                    return
                if isinstance(act, dict) and "error" in act:
                    await send({"id": mid, "type": "result", "success": False, "error": {"code": act["error"], "message": ""}})
                    continue
                if command == "direct/capabilities_v3":
                    result = self.capabilities
                elif command == "direct/time":
                    result = {"schema_version": 1, "server_utc": datetime.now(timezone.utc).isoformat(), "max_ts_skew_seconds": 60,
                              "max_issued_future_seconds": 2, "max_command_ttl_seconds": 15}
                elif command == "direct/pairing_status_v2":
                    result = self.pairing if self.pairing is not None else pairing_doc(self.kid)
                else:
                    result = act["result"] if isinstance(act, dict) else {"echo": command}
                await send({"id": mid, "type": "result", "success": True, "result": result})
        except (Closed, ConnectionError, json.JSONDecodeError):
            return

    async def stop(self) -> None:
        for s in self.sockets:
            await s.close()
        for t in self.tasks:
            t.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)


class NeverOpener:
    def __init__(self) -> None:
        self.calls = 0

    async def __call__(self) -> Any:
        self.calls += 1
        raise AssertionError("this opener must not be used")


def run(coro: Any) -> Any:
    return asyncio.run(coro)


# ================================================================ key -> protocol, the signing recipes

def test_protocol_follows_the_key_set_current_key_only() -> None:
    assert bridge.protocol_for_key(LEGACY) == 1
    assert bridge.protocol_for_key(ha_bridge.BridgeKey(LEGACY, bk.LEGACY_KID)) == 1  # g0-legacy keeps v1 unchanged
    assert bridge.protocol_for_key(KEY) == 2
    for key, code in ((None, "bridge_not_paired"), ("", "bridge_not_paired"),
                      (ha_bridge.BridgeKey(MATERIAL, "g1-NOTHEX!"), "bridge_key_unversioned")):
        with pytest.raises(bridge.MediaBridgeError) as exc:
            bridge.protocol_for_key(key)
        assert exc.value.code == code


def test_v2_connect_is_the_contract_shape_signed_by_the_keyset_v2_recipe() -> None:
    challenge = "ab" * 16
    proof = bridge.sign_connect(KEY, challenge, now=1_900_000_000, version=2)
    example = fixture("direct-connect-request.v2.valid.json")["bridge"]
    assert set(proof) == set(example) and proof["kind"] == example["kind"] == "wiskey-direct-connect.v2"
    assert proof["kid"] == KID and re.fullmatch(r"[0-9a-f]{32}", proof["nonce"])
    body = {k: v for k, v in proof.items() if k not in ("kid", "ts", "nonce", "sig")}
    assert proof["sig"] == v2_sig(MATERIAL, KID, proof["ts"], proof["nonce"], body)
    assert proof["parameters"] == {"challenge": challenge} and proof["query_owner_id"] == "pairing"


@pytest.mark.parametrize("key,version,code", [(KEY, 1, "bridge_key_rotated"), (LEGACY, 2, "bridge_key_unversioned"),
                                              (None, 2, "bridge_not_paired")])
def test_a_key_never_signs_the_other_protocol(key: Any, version: int, code: str) -> None:
    with pytest.raises(bridge.MediaBridgeError) as exc:
        bridge.sign_connect(key, "ab" * 16, now=1_900_000_000, version=version)
    assert exc.value.code == code


def test_v2_command_proof_has_the_signed_request_v2_shape_and_maps_kinds() -> None:
    signer = bridge.BridgeSigner(lambda: KEY, protocol_version=2)
    proof = signer.command_proof("direct/pairing_status_v2", "arx-service:fixture-entry-1", {})
    example = fixture("direct--pairing_status_v2.signed-request.v2.valid.json")["bridge"]
    assert set(proof) == set(example) and proof["kind"] == "wiskey-bridge-command.v2" and proof["kid"] == KID
    assert signer.command_proof("peer_bindings/get", "arx-service:e", {}, kind=bridge.PEER_QUERY_KIND)["kind"] == "wiskey-peer-query.v2"
    with pytest.raises(bridge.MediaBridgeError) as exc:
        signer.command_proof("users/get", "arx-service:e", {}, kind="wiskey-other.v9")
    assert (exc.value.code, exc.value.outcome) == ("proof_invalid", "not_sent")
    # two proofs of the same request never share a nonce: there is no way to send one signed body twice
    assert signer.command_proof("direct/time", "arx-service:e", {})["nonce"] != signer.command_proof("direct/time", "arx-service:e", {})["nonce"]
    with pytest.raises(bridge.MediaBridgeError):  # the v1 signer still refuses a rotated key (no kid on v1)
        bridge.BridgeSigner(lambda: KEY).command_proof("direct/time", "arx-service:e", {})
    with pytest.raises(bridge.MediaBridgeError) as exc:  # a v1 signer never signs a v2 kind
        bridge.BridgeSigner(lambda: LEGACY).command_proof("direct/time", "arx-service:e", {}, kind=bridge.KIND_V2)
    assert exc.value.code == "proof_invalid"


def test_v2_reply_is_verified_before_it_is_read() -> None:
    ref = "cd" * 16
    frame = {"id": 2, "type": "result", "success": True, "result": {}}
    good = v2_reply(MATERIAL, KID, ref, frame)
    assert bridge.reply_mac(KEY, ref, frame, version=2) == good["sig"]
    assert bridge.open_reply(KEY, ref, good, version=2) == frame
    bad = [
        {**good, "kid": "g2-89abcdef"},  # another key id (contract-valid shape)
        v2_reply(MATERIAL, "g2-89abcdef", ref, frame),  # correctly signed for another kid: still not this connection's key
        {**good, "sig": "0" * 64},
        {**good, "connection_ref": "ef" * 16},
        {**good, "kind": "wiskey-direct-reply.v1"},
        {k: v for k, v in good.items() if k != "kid"},  # a v1-shaped reply on a v2 connection
        {**good, "frame": {**frame, "id": 3}},
        v2_reply("another-material", KID, ref, frame),
    ]
    for message in bad:
        with pytest.raises(bridge.MediaBridgeError) as exc:
            bridge.open_reply(KEY, ref, message, version=2)
        assert exc.value.code == "reply_unauthenticated"
    with pytest.raises(bridge.MediaBridgeError):  # a v2 reply is never accepted by the v1 reader
        bridge.open_reply(LEGACY, ref, good)
    example = fixture("direct--pairing_status_v2.signed-reply.v2.valid.json")
    assert set(example) == set(good)  # the wrapper keys are the contract's


def test_v2_identity_reader_is_closed_and_bound_to_the_signing_kid() -> None:
    ref = "0" * 32
    valid = fixture("direct-identity.v2.valid.json")
    identity = bridge.read_identity(valid, ref, version=2, kid="g0-legacy")
    assert identity["kid"] == "g0-legacy" and identity["protocol_version"] == 2
    for name in ("direct-identity.v2.wrong-type-or-constant.json", "direct-identity.v2.forbidden-extra.json",
                 "direct-identity.v2.missing-required.json"):
        with pytest.raises(bridge.MediaBridgeError) as exc:
            bridge.read_identity(fixture(name), ref, version=2, kid="g0-legacy")
        assert exc.value.code == "direct_identity_invalid"
    with pytest.raises(bridge.MediaBridgeError) as exc:
        bridge.read_identity(valid, ref, version=2, kid=KID)
    assert exc.value.code == "direct_kid_mismatch"
    for over in ({"repository_id": None}, {"repository_id": "repo-1"}, {"query_owner_id": "arx-service:a b"},
                 {"protocol": "wiskey-direct-ws.v1"}, {"connection_ref": "1" * 32}):
        with pytest.raises(bridge.MediaBridgeError) as exc:
            bridge.read_identity({**valid, **over}, ref, version=2, kid="g0-legacy")
        assert exc.value.code == "direct_identity_invalid"
    with pytest.raises(bridge.MediaBridgeError):  # a v2 identity is not a v1 one
        bridge.read_identity(valid, ref)
    connect_reply = fixture("direct-connect-reply.v2.valid.json")
    assert bridge.read_identity(connect_reply["frame"]["result"], ref, version=2, kid=connect_reply["kid"])["kid"] == "g0-legacy"


def test_v2_result_may_name_the_v1_bridge_schema_only() -> None:
    ok = {"id": 2, "type": "result", "success": True, "result": {}, "bridge_schema": bridge.KIND}
    assert bridge.verify_command_result(ok, bridge.KIND_V2) == {}
    with pytest.raises(bridge.MediaBridgeError) as exc:
        bridge.verify_command_result({**ok, "bridge_schema": "wiskey-peer-query.v1"}, bridge.KIND_V2)
    assert (exc.value.code, exc.value.outcome) == ("invalid_response", "unknown")
    with pytest.raises(bridge.MediaBridgeError):  # unchanged for v1: only the sent kind
        bridge.verify_command_result({**ok, "bridge_schema": bridge.KIND_V2}, bridge.KIND)


# ================================================================ the transport

def test_a_rotated_key_connects_v2_and_signs_every_command_v2() -> None:
    async def go() -> None:
        server, v1 = V2Server(), NeverOpener()
        t = bridge.DirectApiTransport(v1, lambda: KEY, opener_v2=server.opener)
        link = await t.connect(bridge.PURPOSE_COMMAND)
        try:
            assert (link.protocol_version, link.kid, link.query_owner_id) == (2, KID, "arx-service:fixture-entry-1")
            assert t.last_identity == {"query_owner_id": "arx-service:fixture-entry-1", "repository_id": REPO,
                                       "principal_kind": "pairing_service", "protocol_version": 2, "kid": KID}
            status = await link.call_command("direct/pairing_status_v2", {}, timeout=5)
            assert status["kid"] == KID and status["protocol_version"] == 2
            await link.call_command("peer_bindings/get", {}, kind=bridge.PEER_QUERY_KIND, timeout=5)
            assert server.received == [("direct/pairing_status_v2", "wiskey-bridge-command.v2", {}),
                                       ("peer_bindings/get", "wiskey-peer-query.v2", {})]
            assert v1.calls == 0 and "rotated-material" not in repr(link) + repr(t)
        finally:
            await link.close()
            await server.stop()

    run(go())


def test_a_rotated_key_without_the_v2_opener_keeps_the_old_refusal_and_opens_nothing() -> None:
    v1 = NeverOpener()
    t = bridge.DirectApiTransport(v1, lambda: KEY)
    with pytest.raises(bridge.MediaBridgeError) as exc:
        run(t.connect(bridge.PURPOSE_COMMAND))
    assert exc.value.code == "bridge_key_rotated" and v1.calls == 0 and not t.v2_enabled


def test_a_legacy_key_never_touches_the_v2_path() -> None:
    v2 = NeverOpener()

    async def v1_opener() -> Any:
        raise OSError("unreachable in this test")

    t = bridge.DirectApiTransport(v1_opener, lambda: LEGACY, opener_v2=v2)
    with pytest.raises(bridge.MediaBridgeError) as exc:
        run(t.connect(bridge.PURPOSE_COMMAND))
    assert exc.value.code == "direct_unreachable" and v2.calls == 0 and t.last_attempt_version == 1


@pytest.mark.parametrize("case,code", [
    ("wrong_material", "direct_connect_refused"),  # WisKey refuses the key: closes without a word
    ("v1_hello", "direct_hello_invalid"),
    ("identity_kid", "direct_kid_mismatch"),
    ("tampered_reply", "reply_unauthenticated"),
])
def test_a_v2_refusal_ends_the_attempt_no_v1_no_home_assistant(case: str, code: str) -> None:
    class Fallback:
        kind = "signed_bridge_ws"
        calls = 0

        async def connect(self, purpose: str) -> Any:
            Fallback.calls += 1
            raise AssertionError("never after a v2 attempt")

    async def go() -> None:
        server, v1 = V2Server(), NeverOpener()
        if case == "wrong_material":
            server.material = "another-pairing-material"
        elif case == "v1_hello":
            server.hello_protocol = "wiskey-direct-ws.v1"
        elif case == "identity_kid":
            server.identity_override = {"kid": "g2-89abcdef"}
        else:
            server.tamper = lambda m: {**m, "sig": "0" * 64}
        direct = bridge.DirectApiTransport(v1, lambda: KEY, opener_v2=server.opener)
        auto = bridge.AutoTransport(direct, Fallback())
        try:
            with pytest.raises(bridge.MediaBridgeError) as exc:
                await auto.connect(bridge.PURPOSE_VIDEO)
            assert exc.value.code == code
            assert v1.calls == 0 and Fallback.calls == 0 and server.opened == 1 and server.received == []
        finally:
            await server.stop()

    run(go())


def test_two_pairings_answering_for_one_key_refuse_the_second_connection() -> None:
    async def go() -> None:
        first, second = V2Server(entry="entry-a"), V2Server(entry="entry-b")
        openers = [first.opener, second.opener]

        async def opener() -> Any:
            return await openers.pop(0)()

        t = bridge.DirectApiTransport(NeverOpener(), lambda: KEY, opener_v2=opener)
        link = await t.connect(bridge.PURPOSE_COMMAND)
        await link.close()
        with pytest.raises(bridge.MediaBridgeError) as exc:
            await t.connect(bridge.PURPOSE_COMMAND)
        assert (exc.value.code, exc.value.outcome) == ("pairing_ambiguous", "closed")
        assert second.received == []  # nothing was sent on the ambiguous connection
        await first.stop()
        await second.stop()

    run(go())


@pytest.mark.parametrize("timeout", [58.01, 59, 130, 0, -1, True])
def test_b2_abi_a_v2_read_waits_at_most_58_s_and_nothing_is_sent_otherwise(timeout: Any) -> None:
    async def go() -> None:
        server = V2Server()
        t = bridge.DirectApiTransport(NeverOpener(), lambda: KEY, opener_v2=server.opener)
        link = await t.connect(bridge.PURPOSE_COMMAND)
        try:
            with pytest.raises(bridge.MediaBridgeError) as exc:
                await link.call_command("direct/time", {}, timeout=timeout)
            assert (exc.value.code, exc.value.outcome) == ("timeout_exceeds_abi", "not_sent") and server.raw == []
            assert (await link.call_command("direct/time", {}, timeout=bridge.MAX_CALL_TIMEOUT_S))["schema_version"] == 1
        finally:
            await link.close()
            await server.stop()

    run(go())


def test_an_unknown_outcome_is_never_replayed_and_a_late_answer_is_dropped() -> None:
    async def go() -> None:
        server = V2Server()
        server.script["users/create"] = "silent"
        t = bridge.DirectApiTransport(NeverOpener(), lambda: KEY, opener_v2=server.opener)
        link = await t.connect(bridge.PURPOSE_COMMAND)
        try:
            with pytest.raises(bridge.MediaBridgeError) as exc:
                await link.call_command("users/create", {"data": {}}, timeout=0.2)
            assert exc.value.outcome == "unknown"
            # the next request is a NEW frame with a new nonce; the doubtful one is never sent again
            await link.call_command("direct/time", {}, timeout=5)
            sent = [m["bridge"]["command"] for m in server.raw]
            assert sent == ["users/create", "direct/time"]
            assert len({m["bridge"]["nonce"] for m in server.raw}) == 2
        finally:
            await link.close()
            await server.stop()

    run(go())


def test_a_refused_signature_is_final_and_not_retried() -> None:
    async def go() -> None:
        server = V2Server()
        t = bridge.DirectApiTransport(NeverOpener(), lambda: KEY, opener_v2=server.opener)
        link = await t.connect(bridge.PURPOSE_COMMAND)
        try:
            server.material = "rotated-away-on-the-server"  # WisKey no longer verifies this key
            with pytest.raises(bridge.MediaBridgeError):  # the reply itself no longer verifies: the link closes, outcome unknown
                await link.call_command("users/get", {"user_id": "u"}, timeout=2)
            assert len(server.raw) == 1 and link.closed
        finally:
            await link.close()
            await server.stop()

    run(go())


def test_a_key_that_changes_under_an_open_v2_connection_is_never_used_on_it() -> None:
    async def go() -> None:
        server = V2Server()
        current = {"key": KEY}
        t = bridge.DirectApiTransport(NeverOpener(), lambda: current["key"], opener_v2=server.opener)
        link = await t.connect(bridge.PURPOSE_COMMAND)
        try:
            current["key"] = ha_bridge.BridgeKey("next-material", "g2-89abcdef")
            with pytest.raises(bridge.MediaBridgeError) as exc:
                await link.call_command("direct/time", {}, timeout=5)
            assert (exc.value.code, exc.value.outcome) == ("bridge_key_changed", "not_sent")
            assert link.closed and server.raw == []
        finally:
            await link.close()
            await server.stop()

    run(go())


def test_the_v2_socket_path_is_wiskeys_v2_view(monkeypatch: Any) -> None:
    from smplwise.services import ha_user_auth

    monkeypatch.setattr(ha_user_auth, "core_ws_url", lambda settings: "ws://core.invalid:8123/api/websocket")
    assert bridge.direct_ws_url(None) == "ws://core.invalid:8123" + bridge.DIRECT_PATH
    assert bridge.direct_ws_url(None, version=2) == "ws://core.invalid:8123/api/hikvision_intercom/arx_bridge/v2/ws"
    with pytest.raises(bridge.MediaBridgeError):
        bridge.websocket_opener(None, version=3)


# ================================================================ discovery v3 + pairing status

def test_the_v3_document_is_read_only_for_this_connections_kid() -> None:
    cap = dd.read_capabilities(cap_v3(), "ref", protocol_version=2, kid=KID)
    assert (cap.protocol_version, cap.kid, cap.manual_service_write_v3) == (2, KID, True) and cap.lists("users/create")
    for auth in ({"version": 2, "kid": "g2-89abcdef", "rotation_source": "smplwise_bridge.KeySet", "fallback_after_key_refusal": False},
                 {"version": 2, "kid": KID, "rotation_source": "smplwise_bridge.KeySet", "fallback_after_key_refusal": True},
                 {"version": 2, "kid": KID, "rotation_source": "smplwise_bridge.KeySet", "fallback_after_key_refusal": 0},
                 {"version": 1, "kid": None, "rotation_source": "smplwise_bridge.KeySet", "fallback_after_key_refusal": False},
                 {"version": 2, "kid": KID, "rotation_source": "other", "fallback_after_key_refusal": False}):
        with pytest.raises(dd.DiscoveryError) as exc:
            dd.read_capabilities(cap_v3(transport_authentication=auth), "ref", protocol_version=2, kid=KID)
        assert exc.value.code == "transport_auth_mismatch"
    no_auth = cap_v3()
    no_auth.pop("transport_authentication")
    with pytest.raises(dd.DiscoveryError) as exc:
        dd.read_capabilities(no_auth, "ref", protocol_version=2, kid=KID)
    assert exc.value.code == "capabilities_invalid"
    with pytest.raises(dd.DiscoveryError) as exc:  # a v3 document is never read as the v1 one
        dd.read_capabilities(cap_v3(), "ref")
    assert exc.value.code == "capabilities_invalid"
    v1_envelope = cap_v3()
    v1_envelope["commands"][0] = {**v1_envelope["commands"][0], "envelope": "wiskey-direct-ws.v1"}
    with pytest.raises(dd.DiscoveryError):
        dd.read_capabilities(v1_envelope, "ref", protocol_version=2, kid=KID)
    with pytest.raises(dd.DiscoveryError) as exc:
        dd.read_capabilities(cap_v3(schema_version=1), "ref", protocol_version=2, kid=KID)
    assert exc.value.code == "capabilities_unsupported"
    lifecycle = {**cap_v3()["lifecycle"], "reconnect_adopts_old_resources": True}
    with pytest.raises(dd.DiscoveryError) as exc:
        dd.read_capabilities(cap_v3(lifecycle=lifecycle), "ref", protocol_version=2, kid=KID)
    assert exc.value.code == "lifecycle_unsupported"
    other = dd.read_capabilities(cap_v3(manual_service_write={"contract": "x"}), "ref", protocol_version=2, kid=KID)
    assert not other.manual_service_write_v3 and other.rejected_blocks == ("manual_service_write",)


def test_the_pairing_status_reader_is_the_closed_contract() -> None:
    valid = dd.read_pairing_status(fixture("direct--pairing_status_v2.result.valid.json"), "ref", observed_at=0.0)
    assert valid.freshness_s == 60
    for name in ("direct--pairing_status_v2.result.wrong-type-or-constant.json", "direct--pairing_status_v2.result.forbidden-extra.json",
                 "direct--pairing_status_v2.result.missing-required.json"):
        with pytest.raises(dd.DiscoveryError) as exc:
            dd.read_pairing_status(fixture(name), "ref", observed_at=0.0)
        assert exc.value.code == "pairing_status_invalid"
    for over in ({"verified": False}, {"verified": 1}, {"freshness_s": 120}, {"direction": "native_to_arx"}, {"kid": "nope"},
                 {"verified_at": "2026-01-01T00:00:00"}, {"protocol_version": 3}, {"protocol_version": True}, {"source": "guess"}):
        with pytest.raises(dd.DiscoveryError):
            dd.read_pairing_status(pairing_doc(**over), "ref", observed_at=0.0)


def test_only_the_one_current_pairing_binds() -> None:
    ok = dd.read_pairing_status(pairing_doc(), "ref", observed_at=0.0)
    assert ok.binding_refusal(2, KID) is None
    assert ok.binding_refusal(2, "g2-89abcdef") == "pairing_mismatch"
    assert ok.binding_refusal(1, None) == "pairing_mismatch"
    legacy = dd.read_pairing_status(pairing_doc(kid=None, version=1), "ref", observed_at=0.0)
    assert legacy.binding_refusal(1, None) is None and legacy.binding_refusal(2, KID) == "pairing_mismatch"
    # WisKey's synthetic example mixes protocol 1 with the keyset source: a shape check passes, the binding never does
    example = dd.read_pairing_status(fixture("direct--pairing_status_v2.result.valid.json"), "ref", observed_at=0.0)
    assert example.binding_refusal(1, None) == example.binding_refusal(2, KID) == "pairing_mismatch"


def _discovery_call(docs: dict[str, Any], log: list[str]) -> Any:
    async def call(command: str, parameters: Any) -> Any:
        log.append(command)
        assert parameters == {}
        return docs[command]

    return call


def test_v2_discovery_reads_capabilities_v3_time_and_the_pairing_and_refuses_a_mismatch() -> None:
    now = [100.0]
    disc = dd.DirectDiscovery(mono=lambda: now[0])
    time_doc = {"schema_version": 1, "server_utc": datetime.now(timezone.utc).isoformat(), "max_ts_skew_seconds": 60,
                "max_issued_future_seconds": 2, "max_command_ttl_seconds": 15}
    docs = {"direct/capabilities_v3": cap_v3(), "direct/time": time_doc, "direct/pairing_status_v2": pairing_doc()}
    log: list[str] = []
    run(disc.refresh("ref", _discovery_call(docs, log), protocol_version=2, kid=KID))
    assert log == ["direct/capabilities_v3", "direct/time", "direct/pairing_status_v2"]
    assert disc.transport_refusal("ref", "users/create") is None and disc.pairing.kid == KID
    now[0] += 61  # the pairing observation is used for its freshness only, then read again
    assert disc.stale() and disc.transport_refusal("ref", "users/create") == "pairing_stale"
    run(disc.refresh("ref", _discovery_call(docs, log), protocol_version=2, kid=KID))
    assert log[-1] == "direct/pairing_status_v2" and disc.transport_refusal("ref", "users/create") is None
    mismatch = dd.DirectDiscovery(mono=lambda: now[0])
    docs["direct/pairing_status_v2"] = pairing_doc(kid="g2-89abcdef")
    run(mismatch.refresh("ref2", _discovery_call(docs, []), protocol_version=2, kid=KID))
    assert mismatch.last_error == "pairing_mismatch" and mismatch.transport_refusal("ref2", "users/create") == "pairing_mismatch"
    v1 = dd.DirectDiscovery()  # a v1 connection never asks for the v2 reads
    v1_log: list[str] = []
    v1_cap = {**cap_v3(), "schema_version": 1, "protocol": "wiskey-direct-ws.v1"}
    v1_cap.pop("transport_authentication")
    v1_cap.pop("manual_service_write")
    v1_cap["commands"] = [{**c, "envelope": "wiskey-direct-ws.v1"} for c in v1_cap["commands"]]
    v1_cap["lifecycle"] = {**v1_cap["lifecycle"], "event_cursor_resume": False}
    run(v1.refresh("ref3", _discovery_call({"direct/capabilities": v1_cap, "direct/time": time_doc}, v1_log)))
    assert v1_log == ["direct/capabilities", "direct/time"] and v1.pairing is None and v1.transport_refusal("ref3") is None


# ================================================================ the join: selection, no fallback, owner-only commands, status

@pytest.fixture()
def v2env() -> Any:
    server = V2Server()
    transport = bridge.DirectApiTransport(NeverOpener(), lambda: KEY, opener_v2=server.opener)
    session = join.DirectCommandSession(transport)
    j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True)
    saved, join.JOIN = join.JOIN, j  # direct_status reads the installed join
    yield server, session, j
    join.JOIN = saved
    try:
        session.run_sync(server.stop(), 5)
    except Exception:  # noqa: BLE001
        pass
    session.close()


def test_the_join_selects_v2_only_after_capabilities_time_and_the_pairing(v2env: Any) -> None:
    server, session, j = v2env
    assert j.selected("users/create")
    assert [c for c, _k, _p in server.received] == ["direct/capabilities_v3", "direct/time", "direct/pairing_status_v2"]
    assert all(k == "wiskey-bridge-command.v2" for _c, k, _p in server.received)
    status = join.direct_status(KEY)
    assert status["pairing_state"] == "verified" and status["kid"] == KID and status["protocol_version"] == 2
    assert status["revoke_in"] == "wiskey_owner_screen" and MATERIAL not in json.dumps(status)


def test_a_pairing_mismatch_is_not_selected_and_never_falls_back(v2env: Any) -> None:
    server, session, j = v2env
    server.pairing = pairing_doc(kid="g9-00000000")
    assert not j.selected("users/create")
    refusal = session.transport_refusal("users/create")
    assert refusal == "pairing_mismatch" and not join.fallback_permitted("not_sent", refusal)
    with pytest.raises(bridge.MediaBridgeError) as exc:
        session.run_sync(session.call("users/create", {"data": {}}, timeout=5), 10)
    assert exc.value.outcome == "not_sent" and "users/create" not in [c for c, _k, _p in server.received]


def test_owner_only_grant_and_revoke_commands_never_travel_on_the_direct_envelope(v2env: Any) -> None:
    server, session, _j = v2env
    for command in sorted(wdc.WISKEY_OWNER_ONLY):
        with pytest.raises(bridge.MediaBridgeError) as exc:
            session.run_sync(session.call(command, {}, timeout=5), 10)
        assert (exc.value.code, exc.value.outcome) == ("owner_action_in_wiskey", "not_sent")
    assert server.opened == 0 and server.raw == []  # refused before a socket was even needed
    assert wdc.direct_refusal("service_grants/current_v3") is None  # the READ of the grant stays possible (row R8)
    assert not any("revoke" in c or "delete" in c for c in wdc.DIRECT_READS_V2)


def test_fallback_rule_after_a_v2_refusal() -> None:
    for code in ("direct_v2_refused:direct_connect_refused", "direct_v2_refused:reply_unauthenticated", "bridge_key_changed",
                 "pairing_ambiguous", "pairing_mismatch", "transport_auth_mismatch", "timeout_exceeds_abi"):
        assert not join.fallback_permitted("not_sent", code)
    assert join.fallback_permitted("not_sent", "direct_connect_refused")  # v1 rule unchanged
    assert join.fallback_permitted("not_sent", "direct_unreachable")


def test_a_v2_connect_refusal_in_the_session_is_prefixed_and_final() -> None:
    server = V2Server()
    server.material = "another-pairing-material"
    session = join.DirectCommandSession(bridge.DirectApiTransport(NeverOpener(), lambda: KEY, opener_v2=server.opener))
    try:
        with pytest.raises(bridge.MediaBridgeError) as exc:
            session.run_sync(session.call("users/create", {"data": {}}, timeout=5), 10)
        assert exc.value.outcome == "not_sent" and exc.value.code == "direct_v2_refused:direct_connect_refused"
        assert not join.fallback_permitted("not_sent", exc.value.code) and server.received == []
    finally:
        try:
            session.run_sync(server.stop(), 5)
        except Exception:  # noqa: BLE001
            pass
        session.close()


def test_direct_status_without_a_join_keeps_unknown() -> None:
    saved = join.JOIN
    join.JOIN = None
    try:
        assert join.direct_status(LEGACY)["selection"] == "v1_pairing_key"
        s = join.direct_status(KEY)
        assert (s["protocol_version"], s["kid"], s["installed"], s["pairing"], s["pairing_state"]) == (2, KID, False, None, "unknown")
        assert join.direct_status(None)["selection"] == "bridge_not_paired"
    finally:
        join.JOIN = saved


def test_startup_installs_a_rotated_key_only_with_a_v2_socket(tmp_path: Path) -> None:
    from test_wkjoin_295 import _settings

    saved = join.JOIN
    try:
        join.JOIN = None
        assert join.startup(None, _settings(tmp_path), opener=NeverOpener(), open_lineage=False, provider_reader=lambda: True,
                            key_reader=lambda: KEY) is None  # injected v1 socket only: as before, nothing installed
        server = V2Server()
        j = join.startup(None, _settings(tmp_path), opener=NeverOpener(), opener_v2=server.opener, open_lineage=False,
                         provider_reader=lambda: True, key_reader=lambda: KEY)
        try:
            assert j is not None and j.selected("users/create")
        finally:
            try:
                j.session.run_sync(server.stop(), 5)
            except Exception:  # noqa: BLE001
                pass
            join.shutdown()
    finally:
        join.JOIN = saved


# ================================================================ the bridge-key status route

def test_bridge_key_status_shows_the_direct_transport_without_material(settings: Any, monkeypatch: Any) -> None:
    from conftest import as_user
    from fastapi.testclient import TestClient

    from smplwise.db import Database, set_setting
    from smplwise.main import create_app
    from smplwise.services import bridge_rotation as br

    from smplwise.services import bridge_rotation_peer as peers

    bk.reset_for_tests()
    monkeypatch.setattr(br, "wiskey_present", lambda: False)
    peers.set_peer_for_tests(None)
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/me")
    c.get("/api/v1/me", headers=as_user("dana"))
    with Database(settings.db_path).connection() as conn:
        set_setting(conn, "bridge.secret", LEGACY)
    body = c.get("/api/v1/system/bridge-key").json()
    dt = body["direct_transport"]
    assert (dt["protocol_version"], dt["selection"], dt["kid"], dt["pairing_state"], dt["revoke_in"]) == \
        (1, "v1_pairing_key", None, "unknown", "wiskey_owner_screen")
    monkeypatch.setattr(ha_bridge, "signing_key", lambda conn: KEY)
    text = c.get("/api/v1/system/bridge-key").text
    dt = json.loads(text)["direct_transport"]
    assert (dt["protocol_version"], dt["kid"]) == (2, KID) and MATERIAL not in text and LEGACY not in text
    denied = c.get("/api/v1/system/bridge-key", headers=as_user("dana"))
    assert denied.status_code == 403 and "direct_transport" not in denied.text
    bk.reset_for_tests()
