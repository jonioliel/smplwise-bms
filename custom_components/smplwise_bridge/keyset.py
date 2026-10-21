"""The bridge's HMAC key set and the rotation peer (CR-WISKEY-HMAC-ROTATION-295 sections 4 and 6; activation slice HMACACT-295).

Dependency-free (hashlib / hmac only), so the same code runs inside Home Assistant Core and in plain unit tests, like `signing.py`.
It is the counterpart of the add-on's `services/bridge_keys.py` + `bridge_rotation.py` and shares nothing with them but the wire format:

- `g0-legacy` is the pairing secret from the config entry. While it is the signing key every outbound message is the OLD kid-less
  recipe (`signing.sign`), so an add-on that predates the rotation (or an add-on that has not started one yet) keeps verifying
  everything this bridge sends; inbound kid-less messages verify against it for as long as it is the signing key or the old key of an
  open rotation (the downgrade guard: after the first completed rotation no kid-less message verifies).
- Signature v2: `HMAC-SHA256(key, "v2.<kid>.<ts>.<nonce>.<sha256_hex(canonical body)>")`, wire = body + {kid, ts, nonce, sig}.
- Verify order (FABLEFIX-295 H-02): format, then the constant-time compare FIRST (a dummy key when the kid is unknown or not
  verifiable), then window / high-water / replay. Every refusal of a message that did not prove the key answers `bad_signature`.
- High-water (H-04): the largest accepted `ts` per kid is part of the persisted state; after a restart a message at or below it is a
  replay. The nonce cache itself is process-local.
- The rotation ops `begin / probe / commit / retire / abort / status` (`handle_control`): K_next is derived from K_cur with HKDF-SHA256
  (RFC 5869, written out here to stay dependency-free; a test pins it to the add-on's `cryptography` HKDF), the 180 s two-key cap
  runs on the monotonic clock, and every state change is `dirty` until the caller has persisted `state()` (write-ahead: the caller
  persists BEFORE it returns the answer).

Rotation is hygiene, not leak recovery (H-03): whoever holds K_cur and can read the local channel can derive K_next and can drive
this peer into a rotation the add-on does not know about. Suspect a leak -> re-pair.

Nothing here logs or returns a key, salt, proof, nonce or signature in an error."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from typing import Any, Callable

KID_RE = re.compile(r"^g[0-9]{1,9}-(legacy|[0-9a-f]{8})$")
LEGACY_KID = "g0-legacy"
NONCE_RE = re.compile(r"^[0-9a-f]{32}$")
SIG_RE = re.compile(r"^[0-9a-f]{64}$")
WIRE = ("kid", "ts", "nonce", "sig")
WINDOW_S = 60
CAP_S = 180
PROTOCOL = "smplwise-bridge-rotation-v1"
CAPABILITY = "rotation_v1"
DERIVE_INFO = "smplwise-bridge-rotation-v1"
PROOF_LABEL = "rotation-ack|"
MODES = ("routine", "hard_cut")
STATE_VERSION = 1
_DUMMY = secrets.token_urlsafe(32)  # never a real key: keeps the compare's cost the same when no key can be used


def canonical(body: dict[str, Any]) -> str:
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _mac(material: str, data: bytes) -> str:
    return hmac.new(material.encode("utf-8"), data, hashlib.sha256).hexdigest()


def _body_hash(body: dict[str, Any]) -> str:
    return hashlib.sha256(canonical(body).encode("utf-8")).hexdigest()


def v1_sig(material: str, body: dict[str, Any], ts: int, nonce: str) -> str:
    return _mac(material, f"{ts}.{nonce}.{_body_hash(body)}".encode("utf-8"))


def v2_sig(material: str, kid: str, body: dict[str, Any], ts: int, nonce: str) -> str:
    return _mac(material, f"v2.{kid}.{ts}.{nonce}.{_body_hash(body)}".encode("utf-8"))


def hkdf_sha256(ikm: bytes, salt: bytes, info: bytes, length: int = 32) -> bytes:
    """RFC 5869 extract-and-expand (length <= 32 * 255)."""
    prk = hmac.new(salt, ikm, hashlib.sha256).digest()
    out, block, i = b"", b"", 1
    while len(out) < length:
        block = hmac.new(prk, block + info + bytes([i]), hashlib.sha256).digest()
        out += block
        i += 1
    return out[:length]


def derive_next(material_cur: str, salt: bytes, kid_next: str, gen_next: int) -> str:
    info = f"{DERIVE_INFO}|{kid_next}|{int(gen_next)}".encode("utf-8")
    return base64.urlsafe_b64encode(hkdf_sha256(material_cur.encode("utf-8"), salt, info)).decode("ascii").rstrip("=")


def proof(material_next: str, rotation_id: str) -> str:
    return _mac(material_next, (PROOF_LABEL + rotation_id).encode("utf-8"))


class KeySet:
    """The bridge's keys. `legacy` is the pairing secret (or None once it was retired); `state` the persisted rest."""

    def __init__(self, legacy: str | None, state: dict[str, Any] | None = None, *, now: Callable[[], float] = time.time,
                 mono: Callable[[], float] = time.monotonic) -> None:
        self._now, self._mono = now, mono
        self._legacy_in = legacy
        st = state if isinstance(state, dict) and state.get("v") == STATE_VERSION else {}
        self.legacy_retired = bool(st.get("legacy_retired"))
        self.legacy = None if self.legacy_retired or not legacy else legacy
        keys = st.get("keys")
        self.keys: dict[str, str] = {k: v for k, v in keys.items() if isinstance(k, str) and isinstance(v, str)} if isinstance(keys, dict) else {}
        self.signing: str = st.get("signing") if isinstance(st.get("signing"), str) else LEGACY_KID
        self.old: str | None = st.get("old") if isinstance(st.get("old"), str) else None
        self.next: str | None = st.get("next") if isinstance(st.get("next"), str) else None
        rot = st.get("rotation")
        self.rotation: dict[str, Any] | None = dict(rot) if isinstance(rot, dict) else None
        hw = st.get("hw")
        self.hw: dict[str, int] = {k: int(v) for k, v in hw.items() if isinstance(k, str) and isinstance(v, int)} if isinstance(hw, dict) else {}
        self._boot_hw = dict(self.hw)
        self._seen: dict[str, float] = {}
        self._t0_mono: float | None = None
        if self.rotation and not self.rotation.get("closed"):
            # the cap runs on the monotonic clock; after a restart the wall clock tells how much of it is already used
            used = max(0.0, self._now() - float(self.rotation.get("t0_wall") or 0.0))
            self._t0_mono = self._mono() - used
        self.dirty = False
        self.legacy_wiped = False  # the caller blanks the config entry's copy of the pairing code once this turns True
        if self.signing != LEGACY_KID and self.signing not in self.keys:  # a damaged state: fall back to the pairing secret if it is still there
            self.signing, self.old, self.next = LEGACY_KID, None, None
        self._cap()

    # ------------------------------------------------------------ state

    def reload(self, state: dict[str, Any] | None) -> None:
        """Go back to a saved state (a failed save). The replay cache is kept."""
        seen = self._seen
        self.__init__(self._legacy_in, state, now=self._now, mono=self._mono)  # type: ignore[misc]
        self._seen = seen

    def state(self) -> dict[str, Any]:
        live = {self.signing, self.old, self.next}
        return {"v": STATE_VERSION, "signing": self.signing, "keys": {k: v for k, v in self.keys.items() if k in live}, "old": self.old, "next": self.next,
                "legacy_retired": self.legacy_retired, "rotation": self.rotation, "hw": self.hw}

    def capabilities(self) -> dict[str, Any]:
        return {"rotation": CAPABILITY}

    def _material(self, kid: str | None) -> str | None:
        if kid is None:
            return None
        if kid == LEGACY_KID:
            return self.legacy
        return self.keys.get(kid)

    def _drop(self, kid: str | None) -> None:
        if kid is None:
            return
        if kid == LEGACY_KID:
            if self.legacy is not None:
                self.legacy_wiped = True
            self.legacy, self.legacy_retired = None, True
        else:
            self.keys.pop(kid, None)
        self.dirty = True

    def _cap(self) -> None:
        """The hard cap: two keys never verify past t0 + 180 s on the monotonic clock."""
        r = self.rotation
        if r is None or r.get("closed") or self._t0_mono is None:
            return
        if self._mono() - self._t0_mono > CAP_S:
            if r.get("committed"):
                self._drop(self.old)
                self.old = None
            else:
                self._drop(self.next)
                self.next = None
            r["closed"] = True
            self.dirty = True

    def verifiable(self) -> set[str]:
        self._cap()
        return {k for k in (self.signing, self.next, self.old) if k is not None and self._material(k) is not None}

    # ------------------------------------------------------------ sign

    def sign(self, body: dict[str, Any], ts: int | None = None, nonce: str | None = None) -> dict[str, Any]:
        """An ordinary outbound message. Kid-less (the old recipe, byte for byte) while the signing key is the pairing secret."""
        self._cap()
        material = self._material(self.signing)
        if material is None:
            raise ValueError("no signing key")
        ts = int(ts) if ts else int(self._now())
        if self.signing == LEGACY_KID:
            nonce = nonce or secrets.token_hex(8)
            return {**body, "ts": ts, "nonce": nonce, "sig": v1_sig(material, body, ts, nonce)}
        nonce = nonce or secrets.token_hex(16)
        return {**body, "kid": self.signing, "ts": ts, "nonce": nonce, "sig": v2_sig(material, self.signing, body, ts, nonce)}

    def _sign_v2(self, kid: str, body: dict[str, Any]) -> dict[str, Any]:
        material = self._material(kid)
        assert material is not None
        ts, nonce = int(self._now()), secrets.token_hex(16)
        return {**body, "kid": kid, "ts": ts, "nonce": nonce, "sig": v2_sig(material, kid, body, ts, nonce)}

    # ------------------------------------------------------------ verify

    def _check(self, message: Any, now: float | None = None) -> tuple[str | None, str | None]:
        """(kid, None) for a valid, recent, unseen message; (None, code) otherwise. Every refusal before the MAC proves the sender holds
        a key is `bad_signature` (H-02)."""
        now = self._now() if now is None else now
        verifiable = self.verifiable()
        if not isinstance(message, dict):
            return None, "bad_format"
        kidless = "kid" not in message
        kid = LEGACY_KID if kidless else message.get("kid")
        ts, nonce, sig = message.get("ts"), message.get("nonce"), message.get("sig")
        if (not isinstance(kid, str) or not KID_RE.fullmatch(kid) or isinstance(ts, bool) or not isinstance(ts, int)
                or not isinstance(nonce, str) or not nonce or not isinstance(sig, str) or not SIG_RE.fullmatch(sig)
                or (not kidless and not NONCE_RE.fullmatch(nonce))):
            return None, "bad_format"
        body = {k: v for k, v in message.items() if k not in WIRE}
        material = self._material(kid) if kid in verifiable else None
        if kidless:
            digest = v1_sig(material or _DUMMY, body, ts, nonce)
        else:
            digest = v2_sig(material or _DUMMY, kid, body, ts, nonce)
        if material is None or not hmac.compare_digest(digest, sig):
            return None, "bad_signature"
        if abs(now - ts) > WINDOW_S:
            return None, "stale"
        if ts <= self._boot_hw.get(kid, 0):
            return None, "replay"
        for n, t in list(self._seen.items()):
            if now - t > WINDOW_S * 2:
                self._seen.pop(n, None)
        if nonce in self._seen:
            return None, "replay"
        self._seen[nonce] = now
        if ts > self.hw.get(kid, 0):
            self.hw[kid] = ts
            self.dirty = True
        return kid, None

    def verify(self, message: dict[str, Any], now: float | None = None) -> str | None:
        """The `Verifier.verify` interface: None when valid, else a short reason."""
        return self._check(message, now)[1]

    # ------------------------------------------------------------ the rotation ops

    def _answer(self, op: str, msg: dict[str, Any], ok: bool, **fields: Any) -> dict[str, Any]:
        body = {"protocol": PROTOCOL, "op": op, "rotation_id": msg.get("rotation_id"), "reply_to": msg.get("nonce"), "ok": ok, **fields}
        return self._sign_v2(self.signing, body)

    def handle_control(self, msg: Any, now: float | None = None) -> dict[str, Any]:
        """One signed control message -> the signed answer (always signed with the key this peer signs with AFTER the op). A message that does
        not verify gets an UNSIGNED refusal (HA-01)."""
        kid, code = self._check(msg, now)
        if kid is None:
            # HA-01: a message that did not prove a key gets NO signed answer - a signed refusal would make this service a signing
            # oracle (any Home Assistant user who can call services could have the bridge sign a body of their choosing)
            return {"ok": False, "code": code or "bad_signature"}
        op = msg.get("op")
        if msg.get("protocol") != PROTOCOL or op not in ("begin", "probe", "commit", "retire", "abort", "status"):
            return self._answer("unknown", msg, False, code="bad_request")
        rid = msg.get("rotation_id")
        if not isinstance(rid, str) or not 1 <= len(rid) <= 64:
            return self._answer(op, msg, False, code="bad_request")
        return getattr(self, f"_op_{op}")(kid, msg)

    def _op_probe(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        return self._answer("probe", msg, True)

    def _open(self) -> bool:
        return self.rotation is not None and not self.rotation.get("closed")

    def _op_begin(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        if kid != self.signing or self._open() or self.next is not None:
            return self._answer("begin", msg, False, code="not_allowed")
        kid_next, gen, mode, overlap = msg.get("kid_next"), msg.get("gen_next"), msg.get("mode"), msg.get("overlap_s")
        try:
            salt = base64.b64decode(str(msg.get("salt")), validate=True)
        except (ValueError, TypeError):
            salt = b""
        if (not isinstance(kid_next, str) or not KID_RE.fullmatch(kid_next) or kid_next.endswith("-legacy") or isinstance(gen, bool) or not isinstance(gen, int)
                or gen < 1 or not kid_next.startswith(f"g{gen}-") or len(salt) != 32 or mode not in MODES
                or isinstance(overlap, bool) or not isinstance(overlap, int) or not 0 <= overlap <= 120 or kid_next in self.keys):
            return self._answer("begin", msg, False, code="bad_request")
        material = self._material(self.signing)
        assert material is not None
        self.keys[kid_next] = derive_next(material, salt, kid_next, gen)
        self.next = kid_next
        self._t0_mono = self._mono()
        self.rotation = {"id": msg["rotation_id"], "t0_wall": self._now(), "committed": False, "closed": False, "mode": mode, "overlap_s": overlap}
        self.dirty = True
        return self._answer("begin", msg, True, proof=proof(self.keys[kid_next], msg["rotation_id"]))

    def _is(self, msg: dict[str, Any]) -> dict[str, Any] | None:
        r = self.rotation
        return r if r is not None and r.get("id") == msg.get("rotation_id") else None

    def _op_commit(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        r = self._is(msg)
        if r is None or r.get("closed") or r.get("committed") or self.next is None or kid != self.next:
            return self._answer("commit", msg, False, code="not_allowed")
        self.old, self.signing, self.next = self.signing, self.next, None
        r["committed"] = True
        if r.get("mode") == "hard_cut":  # no instant with two valid keys
            self._drop(self.old)
            self.old = None
        self.dirty = True
        return self._answer("commit", msg, True)

    def _op_retire(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        r = self._is(msg)
        if r is None or not r.get("committed") or kid != self.signing:
            return self._answer("retire", msg, False, code="not_allowed")
        if self.old is not None:
            self._drop(self.old)
            self.old = None
        r["closed"] = True
        self.dirty = True
        return self._answer("retire", msg, True)

    def _op_abort(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        r = self._is(msg)
        if r is None:
            return self._answer("abort", msg, False, code="unknown_rotation")
        if not r.get("committed"):
            if kid != self.signing:
                return self._answer("abort", msg, False, code="not_allowed")
            self._drop(self.next)
            self.next = None
            r["closed"] = True
            self.dirty = True
            return self._answer("abort", msg, True)
        if self.old is not None and kid == self.old and not r.get("closed"):  # R3: switch back while the old key is still held
            dropped, self.signing, self.old = self.signing, self.old, None
            self._drop(dropped)
            r["closed"], r["committed"] = True, False
            self.dirty = True
            return self._answer("abort", msg, True)
        return self._answer("abort", msg, False, code="not_allowed")

    def _op_status(self, kid: str, msg: dict[str, Any]) -> dict[str, Any]:
        r = self._is(msg)
        state = "unknown_rotation" if r is None else ("committed" if r.get("committed") else ("aborted" if r.get("closed") else "not_committed"))
        return self._answer("status", msg, True, rotation=state, active_kid=self.signing, old_key_present=self.old is not None)
