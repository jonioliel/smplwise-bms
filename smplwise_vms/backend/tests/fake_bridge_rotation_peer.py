"""A fake rotation peer (CR-WISKEY-HMAC-ROTATION-295 section 6) - the bridge side of the key rotation, modelled for tests only.

Its own implementation of the v2 signature and the HKDF derivation (it does not import services/bridge_keys, so a wire-format
mistake on either side shows up as a refusal), its own key set, nonce cache and clock, the 180 s two-key cap (decision 23), and
failure injection per operation:

- `reject`      the peer refuses (signed answer, ok false, code `peer_refused`)
- `drop`        no answer and nothing applied (PeerUnreachable)
- `drop_after`  applied, then no answer (PeerUnreachable) - the "commit landed but the answer was lost" case
- `bad_proof`   `begin` answers a wrong proof
- `unsigned`    the answer carries no signature
- `wrong_reply` the answer is bound to another request
- `foreign_key` the answer is signed with a key Arx does not know

`silent` (bool) makes every call PeerUnreachable (a dead bridge). Only synthetic keys; never a real bridge."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from typing import Any, Callable

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from smplwise.services.bridge_rotation_peer import CAPABILITY, PeerUnreachable

PROTOCOL = "smplwise-bridge-rotation-v1"
CAP_S = 180
WINDOW_S = 60
WIRE = ("kid", "ts", "nonce", "sig")


def _canonical(body: dict[str, Any]) -> str:
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _sig(material: str, kid: str, ts: int, nonce: str, body: dict[str, Any]) -> str:
    data = f"v2.{kid}.{ts}.{nonce}.{hashlib.sha256(_canonical(body).encode('utf-8')).hexdigest()}".encode("utf-8")
    return hmac.new(material.encode("utf-8"), data, hashlib.sha256).hexdigest()


def _derive(material: str, salt: bytes, kid: str, gen: int) -> str:
    raw = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=f"smplwise-bridge-rotation-v1|{kid}|{gen}".encode("utf-8")).derive(material.encode("utf-8"))
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


class FakePeer:
    def __init__(self, legacy_material: str, clock: Callable[[], float], *, capability: str | None = CAPABILITY) -> None:
        self.clock = clock
        self.capability = capability
        self.keys: dict[str, str] = {"g0-legacy": legacy_material}
        self.signing = "g0-legacy"
        self.old: str | None = None        # the previous key, verify-only during the overlap
        self.next: str | None = None       # derived on `begin`, verify-only until `commit`
        self.rotation: dict[str, Any] | None = None
        self.fail: dict[str, str] = {}
        self.silent = False
        self.seen: dict[str, float] = {}
        self.calls: list[str] = []
        self.received: list[dict[str, Any]] = []   # every message as received (for the secret scan)
        self.salts: list[bytes] = []
        self.on_call: Callable[[str], None] | None = None  # e.g. advance the clock in the middle of a rotation
        self.reject_probe: Callable[[str], bool] | None = None  # a probe under a kid this returns True for is refused

    # ------------------------------------------------------------ the peer's own view

    def accepted(self) -> set[str]:
        self._cap()
        out = {self.signing}
        if self.next:
            out.add(self.next)
        if self.old:
            out.add(self.old)
        return out

    def material(self, kid: str) -> str:
        return self.keys[kid]

    def _cap(self) -> None:
        """The hard cap: two keys never verify past t0 + 180 s on the peer's clock."""
        r = self.rotation
        if r is None or r.get("closed"):
            return
        if self.clock() > r["t0"] + CAP_S:
            if r["committed"]:
                if self.old:
                    self.keys.pop(self.old, None)
                    self.old = None
            elif self.next:
                self.keys.pop(self.next, None)
                self.next = None
            r["closed"] = True

    def _verify(self, msg: dict[str, Any]) -> tuple[str | None, str | None]:
        kid, ts, nonce, sig = msg.get("kid"), msg.get("ts"), msg.get("nonce"), msg.get("sig")
        if not isinstance(kid, str) or not isinstance(ts, int) or not isinstance(nonce, str) or not isinstance(sig, str):
            return None, "bad_format"
        if kid not in self.accepted():
            return None, "key_unknown"
        if abs(self.clock() - ts) > WINDOW_S:
            return None, "stale"
        body = {k: v for k, v in msg.items() if k not in WIRE}
        if not hmac.compare_digest(_sig(self.keys[kid], kid, ts, nonce, body), sig):
            return None, "bad_signature"
        if nonce in self.seen:
            return None, "replay"
        self.seen[nonce] = self.clock()
        return kid, None

    def sign(self, body: dict[str, Any], kid: str | None = None) -> dict[str, Any]:
        kid = kid or self.signing
        ts, nonce = int(self.clock()), secrets.token_hex(16)
        return {**body, "kid": kid, "ts": ts, "nonce": nonce, "sig": _sig(self.keys[kid], kid, ts, nonce, body)}

    def _answer(self, op: str, msg: dict[str, Any], ok: bool, **fields: Any) -> dict[str, Any]:
        body = {"protocol": PROTOCOL, "op": op, "rotation_id": msg.get("rotation_id"), "reply_to": msg.get("nonce"), "ok": ok, **fields}
        mode = self.fail.get(op)
        if mode == "wrong_reply":
            body["reply_to"] = secrets.token_hex(16)
        if mode == "unsigned":
            return body
        if mode == "foreign_key":
            ts, nonce = int(self.clock()), secrets.token_hex(16)
            return {**body, "kid": "g9-0badf00d", "ts": ts, "nonce": nonce, "sig": _sig("not-a-shared-key", "g9-0badf00d", ts, nonce, body)}
        return self.sign(body)

    # ------------------------------------------------------------ the Peer interface

    def capabilities(self) -> dict[str, Any]:
        return {"rotation": self.capability}

    def call(self, op: str, msg: dict[str, Any]) -> dict[str, Any]:
        self.calls.append(op)
        self.received.append(dict(msg))
        if self.on_call:
            self.on_call(op)
        if self.silent or self.fail.get(op) == "drop":
            raise PeerUnreachable()
        self._cap()
        kid, code = self._verify(msg)
        if op == "probe":
            if kid is not None and self.reject_probe is not None and self.reject_probe(kid):
                return self._answer(op, msg, False, code="peer_refused")
            return self._answer(op, msg, kid is not None, **({} if kid else {"code": code}))
        if kid is None:
            return self._answer(op, msg, False, code=code)
        if self.fail.get(op) == "reject":
            return self._answer(op, msg, False, code="peer_refused")
        answer = getattr(self, f"_op_{op}")(kid, msg)
        if self.fail.get(op) == "drop_after":
            raise PeerUnreachable()
        return answer

    def _op_begin(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        if kid != self.signing or (self.rotation and not self.rotation.get("closed")):
            return self._answer("begin", msg, False, code="not_allowed")
        salt = base64.b64decode(msg["salt"])
        self.salts.append(salt)
        nk = msg["kid_next"]
        self.keys[nk] = _derive(self.keys[self.signing], salt, nk, int(msg["gen_next"]))
        self.next = nk
        self.rotation = {"id": msg["rotation_id"], "t0": self.clock(), "committed": False, "mode": msg["mode"], "overlap_s": msg["overlap_s"]}
        proof = hmac.new(self.keys[nk].encode("utf-8"), ("rotation-ack|" + msg["rotation_id"]).encode("utf-8"), hashlib.sha256).hexdigest()
        if self.fail.get("begin") == "bad_proof":
            proof = "0" * 64
        return self._answer("begin", msg, True, proof=proof)

    def _op_commit(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        r = self.rotation
        if r is None or r["id"] != msg["rotation_id"] or kid != self.next:
            return self._answer("commit", msg, False, code="not_allowed")
        self.old, self.signing, self.next = self.signing, self.next, None
        r["committed"] = True
        if r["mode"] == "hard_cut":
            self.keys.pop(self.old, None)
            self.old = None
        return self._answer("commit", msg, True)

    def _op_retire(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        r = self.rotation
        if r is None or r["id"] != msg["rotation_id"] or not r["committed"] or kid != self.signing:
            return self._answer("retire", msg, False, code="not_allowed")
        if self.old:
            self.keys.pop(self.old, None)
            self.old = None
        r["closed"] = True
        return self._answer("retire", msg, True)

    def _op_abort(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        r = self.rotation
        if r is None or r["id"] != msg["rotation_id"]:
            return self._answer("abort", msg, False, code="unknown_rotation")
        if not r["committed"]:
            if self.next:
                self.keys.pop(self.next, None)
                self.next = None
            r["closed"] = True
            return self._answer("abort", msg, True)
        if self.old and kid == self.old:  # R3: switch back while the old key is still held
            dropped, self.signing, self.old = self.signing, self.old, None
            self.keys.pop(dropped, None)
            r["closed"] = True
            r["committed"] = False
            return self._answer("abort", msg, True)
        return self._answer("abort", msg, False, code="not_allowed")

    def _op_status(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        r = self.rotation
        state = "unknown_rotation" if r is None or r["id"] != msg["rotation_id"] else ("committed" if r["committed"] else ("aborted" if r.get("closed") else "not_committed"))
        return self._answer("status", msg, True, rotation=state, active_kid=self.signing, old_key_present=self.old is not None)
