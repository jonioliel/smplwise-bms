"""The key-set binding WisKey's native component asks for on its direct transport v2 (WISKEY-BRIDGE-KEYSET-2520, bridge 0.10.9).

WisKey rc19 does not verify a signed message that carries a key id (`kid`) itself, and it does not sign its v2 replies itself: its
`trusted_actions/existing_bridge_auth.py` and `trusted_actions/direct_bridge_origin.py` import THIS module
(`custom_components.smplwise_bridge.native_keyset`) and hand both jobs to the bridge, which holds the keys. `manual_service_grants.py`
binds an owner's service grant to the pairing through `source_fingerprint`. The surface, exactly what WisKey imports and calls:

    Unavailable                          the one exception every refusal below raises; `str(exc)` / `exc.code` is a fixed code, never a
                                         key, a signature, a nonce or anything from the message
    await verify(hass, message)          a v2 message (`kid` on the wire) -> a KeyBinding; Unavailable otherwise
    KeyBinding.check() -> (entry, kid)   the binding is still current: same setup of the same loaded entry, the kid still verifiable
                                         (WisKey calls it before every use and every 0.25 s for an open socket - cheap and synchronous)
    KeyBinding.sign_reply(encoded) -> hex  HMAC-SHA256(material of kid, b"wiskey-direct-reply.v2." + encoded); `encoded` must be the exact
                                         canonical JSON of {connection_ref, frame, kid} with the binding's own kid
    legacy_allowed(hass, entry) -> bool  may the pairing secret still verify WisKey's kid-less v1 frames for this entry
    source_fingerprint(hass, entry) -> 64 hex   a one-way tag of the PAIRING (stable across key rotations, new after a re-pair)
    attach(hass, entry, keyset, saver)   the bridge's own setup registers its live KeySet + Persister (returns the detach callable,
                                         handed to `entry.async_on_unload`); WisKey's HA tests call it the same way

Rules (security):
- The key material never leaves this module or `keyset.py`: no function returns it, no exception or repr names it, a KeyBinding carries
  nothing (its record lives in a module-private weak map). Lookup is by kid in the attached entry's OWN key set - no second key store.
- v2 only: a message without `kid` is refused (`bridge_protocol_unsupported`), so nothing here ever falls back to the kid-less v1 recipe;
  the pairing secret's own kid `g0-legacy` is refused on v2 too (`bridge_key_unversioned`) - Arx signs v2 only with a rotated key
  (`wiskey_media_bridge.protocol_for_key`).
- The signature check is the key set's own (`KeySet._check`: format, then the constant-time compare FIRST with a dummy key when the kid
  cannot be used, then the 60 s window, the persisted high-water mark and the nonce cache). An unknown, retired, aborted or capped kid
  is refused; two loaded entries holding the same kid refuse as ambiguous (PAIRING-Q2: one current pairing, never a silent choice).
- Replay: WisKey keeps its own nonce cache (`existing_bridge_auth`: 120 s, in process) and owns replay inside a running process. This
  layer adds what only the bridge can: the nonce is also entered in the key set's cache, and the per-kid high-water mark is SAVED before
  the message is admitted (`bridge_highwater_not_persisted` otherwise), so after a Home Assistant restart - when every in-memory nonce
  cache is empty - a captured message of the last 60 s is refused by the saved mark. One save per kid and second at most (a message in a
  second that is already saved needs no write).
- Re-pair (WISKEY-BRIDGE-REPAIR-2520): an attachment counts only while its entry still carries the pairing its key set belongs to,
  read live on every call (`_same_pairing`). A new pairing code written into the entry voids the old setup AT ONCE, before the update
  listener's reload detaches it: `verify` refuses every kid of the old key set (no check, no save), open bindings stop `check()` and
  `sign_reply`, `source_fingerprint` raises and `legacy_allowed` is False - all `bridge_pairing_changed`. The new pairing is served
  only by the new setup the reload attaches.
- A refusal never says why beyond its code, and every code means the same to WisKey: `Unauthorized`.

Dependency-free (no Home Assistant import), like `keyset.py`: the entry's state is read by value (`"loaded"`), so the module runs in
plain unit tests with fakes."""
from __future__ import annotations

import hashlib
import hmac
import json
import weakref
from collections.abc import Callable
from typing import Any

from ._common import canonical
from .const import CONF_PAIRING_CODE, DOMAIN
from .keyset import KID_RE, LEGACY_KID, KeySet, Persister, legacy_fingerprint

DATA_KEY = f"{DOMAIN}_native_keyset"
REPLY_KIND = "wiskey-direct-reply.v2"
REPLY_PREFIX = (REPLY_KIND + ".").encode("utf-8")
REPLY_FIELDS = frozenset({"connection_ref", "frame", "kid"})
MAX_REPLY_BYTES = 1_048_576  # what Arx reads back on a direct socket (wiskey_media_bridge.DIRECT_MAX_FRAME_BYTES)
SOURCE_LABEL = "smplwise-native-source.v1|"


class Unavailable(Exception):
    """A refusal of this binding. Its only text is a fixed code."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class _Attachment:
    """One setup of one entry: its live key set and the Persister that saves it."""

    __slots__ = ("__weakref__", "entry", "keyset", "saver")

    def __init__(self, entry: Any, keyset: KeySet, saver: Persister) -> None:
        self.entry, self.keyset, self.saver = entry, keyset, saver

    def __repr__(self) -> str:  # never the key set
        return "<native_keyset attachment>"


class KeyBinding:
    """What `verify` hands WisKey: proof that one message verified under one kid of one entry's key set. Carries no attribute."""

    __slots__ = ("__weakref__",)

    def __repr__(self) -> str:
        return "<native_keyset binding>"

    def check(self) -> tuple[Any, str]:
        """(entry, kid) while the binding is current; Unavailable once the entry was reloaded / unloaded / removed, its pairing code
        changed (a re-pair, even before the reload) or the kid is no longer one the key set verifies (retired, aborted, past the 180 s
        cap, a hard cut)."""
        att, kid = _record(self)
        return att.entry, kid

    def sign_reply(self, encoded: bytes) -> str:
        """The v2 reply MAC (the recipe of Arx's `wiskey_media_bridge.reply_mac(version=2)`): HMAC-SHA256(material of the kid, UTF-8
        "wiskey-direct-reply.v2." + `encoded`). Signs ONLY the canonical JSON of exactly {connection_ref, frame, kid} naming this
        binding's kid (so this is not a signing oracle for other bytes or another key)."""
        att, kid = _record(self)
        if type(encoded) is not bytes or not 0 < len(encoded) <= MAX_REPLY_BYTES:
            raise Unavailable("bridge_reply_invalid")
        try:
            body = json.loads(encoded.decode("utf-8"), parse_constant=_no_constant)
            again = canonical(body).encode("utf-8")  # WisKey's spelling; a non-finite number never re-encodes to its input bytes
        except (ValueError, UnicodeError, RecursionError, TypeError):
            raise Unavailable("bridge_reply_invalid") from None
        ref = body.get("connection_ref") if type(body) is dict else None
        if (type(body) is not dict or set(body) != REPLY_FIELDS or type(ref) is not str or len(ref) != 32
                or any(c not in "0123456789abcdef" for c in ref) or type(body["frame"]) is not dict or body["kid"] != kid or again != encoded):
            raise Unavailable("bridge_reply_invalid")
        material = att.keyset._material(kid)  # the bridge's own key set, inside the bridge
        if material is None:
            raise Unavailable("bridge_key_retired")
        return hmac.new(material.encode("utf-8"), REPLY_PREFIX + encoded, hashlib.sha256).hexdigest()


_BINDINGS: weakref.WeakKeyDictionary[KeyBinding, tuple[Any, _Attachment, str]] = weakref.WeakKeyDictionary()


def _no_constant(_name: str) -> Any:
    raise ValueError("constant")


def _registry(hass: Any) -> dict[str, _Attachment]:
    data = getattr(hass, "data", None)
    if not isinstance(data, dict):
        raise Unavailable("bridge_source_changed")
    reg = data.get(DATA_KEY)
    return reg if isinstance(reg, dict) else {}


def _loaded(entry: Any) -> bool:
    state = getattr(entry, "state", None)
    return getattr(state, "value", state) == "loaded"


def _current(hass: Any, att: _Attachment) -> bool:
    """The attachment is the live setup of a loaded entry that Home Assistant still holds."""
    entry = att.entry
    entry_id = getattr(entry, "entry_id", None)
    try:
        held = hass.config_entries.async_get_entry(entry_id)
    except Exception:  # noqa: BLE001 - an entry registry we cannot read: closed
        return False
    return _registry(hass).get(entry_id) is att and held is entry and _loaded(entry) and att.saver.keyset is att.keyset


def _same_pairing(entry: Any, ks: KeySet) -> bool:
    """The entry still carries the pairing its attached key set belongs to (WISKEY-BRIDGE-REPAIR-2520). Read live from the entry on every
    call, so a re-pair (Supervisor discovery or the owner writing a new pairing code into the entry) voids this setup's bindings, its
    kids, its fingerprint and the legacy path AT ONCE - not only after the update listener's reload has detached it.

    The same pairing is: the key set's pairing secret itself while it still holds it; once the secret is retired, the blank the bridge
    writes (HA-06) or that retired code (a restart between the key save and the entry update) - recognised by the one-way tag the key set
    keeps (`legacy_fp`). Any other value - a new code, a blank the bridge did not write, a non-string, unreadable data - is a change."""
    data = getattr(entry, "data", None)
    if not hasattr(data, "get"):  # a dict or Home Assistant's read-only mapping; anything else cannot be compared: closed
        return False
    code = data.get(CONF_PAIRING_CODE)
    if code is None:
        code = ""  # the bridge reads a missing code as blank (`__init__`: `entry.data.get(CONF_PAIRING_CODE) or ""`)
    if not isinstance(code, str):
        return False
    if ks.legacy is not None:
        return bool(code) and hmac.compare_digest(code.encode("utf-8"), ks.legacy.encode("utf-8"))
    if not code:
        return True
    return ks.legacy_fp is not None and hmac.compare_digest(legacy_fingerprint(code), ks.legacy_fp)


def _record(binding: Any) -> tuple[_Attachment, str]:
    rec = _BINDINGS.get(binding) if type(binding) is KeyBinding else None
    if rec is None:
        raise Unavailable("bridge_binding_unknown")
    hass, att, kid = rec
    if not _current(hass, att):
        raise Unavailable("bridge_source_changed")
    if not _same_pairing(att.entry, att.keyset):
        raise Unavailable("bridge_pairing_changed")
    if kid not in att.keyset.verifiable():
        raise Unavailable("bridge_key_retired")
    return att, kid


def _attached(hass: Any, entry: Any) -> _Attachment:
    """The current attachment of `entry` while it still carries its pairing; Unavailable otherwise."""
    att = _registry(hass).get(getattr(entry, "entry_id", None))
    if att is None or att.entry is not entry or not _current(hass, att):
        raise Unavailable("bridge_source_changed")
    if not _same_pairing(entry, att.keyset):
        raise Unavailable("bridge_pairing_changed")
    return att


def attach(hass: Any, entry: Any, keyset: KeySet, saver: Persister) -> Callable[[], None]:
    """Register this setup's key set for `entry` (replacing a previous setup's, whose bindings then stop checking). Returns the detach."""
    if not isinstance(keyset, KeySet) or not isinstance(saver, Persister) or saver.keyset is not keyset:
        raise ValueError("keyset")
    att = _Attachment(entry, keyset, saver)
    reg = hass.data.setdefault(DATA_KEY, {})
    reg[entry.entry_id] = att

    def detach() -> None:
        if reg.get(entry.entry_id) is att:
            del reg[entry.entry_id]

    return detach


async def verify(hass: Any, message: Any) -> KeyBinding:
    """One v2 message (WisKey has already checked its shape and canonical body) -> a KeyBinding, after the key set verified it and its
    high-water mark is saved. Raises Unavailable with a fixed code otherwise."""
    if type(message) is not dict or "kid" not in message:
        raise Unavailable("bridge_protocol_unsupported")
    kid = message["kid"]
    if type(kid) is not str or not KID_RE.fullmatch(kid):
        raise Unavailable("bridge_bad_format")
    if kid == LEGACY_KID:
        raise Unavailable("bridge_key_unversioned")
    found = [att for att in list(_registry(hass).values()) if _current(hass, att) and kid in att.keyset.verifiable()]
    if not found:
        raise Unavailable("bridge_key_unknown")
    if len(found) > 1:
        raise Unavailable("bridge_key_ambiguous")
    att = found[0]
    if not _same_pairing(att.entry, att.keyset):  # a re-pair not yet reloaded: the old pairing's keys open nothing (before any check / save)
        raise Unavailable("bridge_pairing_changed")
    checked, code = att.keyset._check(message)  # the key set's own verify path (format, MAC first, window, replay)
    if checked != kid:
        raise Unavailable(f"bridge_{code or 'bad_signature'}")
    ts = message["ts"]
    if att.saver.saved_through(kid, ts):
        att.saver.save_soon()  # nothing to wait for; a mark lowered by a rolled-back save is saved again soon
    else:
        try:
            await att.saver.persist()
        except Exception:  # noqa: BLE001 - not saved: a restart could forget the mark, so the message is not admitted
            raise Unavailable("bridge_highwater_not_persisted") from None
        if not att.saver.saved_through(kid, ts):  # a concurrent rotation save failed and rolled the mark back
            raise Unavailable("bridge_highwater_not_persisted")
    binding = KeyBinding()
    _BINDINGS[binding] = (hass, att, kid)
    binding.check()
    return binding


def legacy_allowed(hass: Any, entry: Any) -> bool:
    """True only while `entry` is loaded and attached, its key set still verifies with the pairing secret (`g0-legacy` is the signing
    key, or the old / next key of an open rotation) and the entry's pairing code IS that secret. False otherwise - after the first
    completed rotation (retire, hard cut, the 180 s cap) even before the entry's copy is blanked, for an unloaded or unattached entry,
    and when the entry carries a different code than the loaded key set (a re-pair not yet reloaded)."""
    try:
        att = _attached(hass, entry)
    except Unavailable:
        return False
    ks = att.keyset
    legacy = ks.legacy
    if legacy is None or LEGACY_KID not in ks.verifiable():
        return False
    data = getattr(entry, "data", None)
    code = data.get(CONF_PAIRING_CODE) if hasattr(data, "get") else None  # a dict or Home Assistant's read-only mapping
    return isinstance(code, str) and bool(code) and hmac.compare_digest(code.encode("utf-8"), legacy.encode("utf-8"))


def source_fingerprint(hass: Any, entry: Any) -> str:
    """64 hex: SHA-256 over a label, the entry id and the one-way tag of the pairing code (`keyset.legacy_fingerprint`, the same tag the
    key set keeps after it retired the code). Unchanged by key rotations of that pairing; a re-pair (a new code, K-02) gives a new value.
    Unavailable when the entry is not loaded / attached, when it no longer carries that pairing (`bridge_pairing_changed`: a re-pair is
    refused at once, before the reload - the old value is never answered for a new code) or the pairing's tag is unknown (a retired code
    from before the tag existed)."""
    att = _attached(hass, entry)
    ks = att.keyset
    tag = legacy_fingerprint(ks.legacy) if ks.legacy is not None else ks.legacy_fp
    if not tag:
        raise Unavailable("bridge_pairing_unknown")
    return hashlib.sha256(f"{SOURCE_LABEL}{entry.entry_id}|{tag}".encode()).hexdigest()
