"""WISKEY-MEDIA-V2-2530: station media (video, talk, listen) over WisKey's signed direct transport v2 - an opt-in, default OFF.

Why: row R7 (docs/changes/WISKEY-DIRECT-V2-2520.md, open question 4) gave the direct transport a v2 with the key id (`kid`) of the bridge
key set, but left the station media path on v1, so a rotated key keeps the media refusal `bridge_key_rotated`. Owner decision 25.11:
media over v2 is a separate part, usable only once the bridge that verifies and signs v2 for WisKey (`smplwise_bridge.native_keyset`,
bridge 0.10.9, WISKEY-BRIDGE-KEYSET-2520) runs. This module is that decision, and nothing else:

    SETTING_KEY = "access.station_media_direct_v2"   off (default) | on - a system administrator's switch (audited)
    BRIDGE_REQUIRED = "0.10.9"                       the bridge the running Arx last saw (`bridge.integration_version`) must be at
                                                     least this; an unknown version is "not installed"
    enabled(conn) -> bool                            the switch is on AND the bridge is new enough - the ONLY gate the media path reads
    key_problem(key) -> None | not_paired | key_rotated   the signing rule of the media path while enabled (v1 for the pairing secret and
                                                     `g0-legacy`, v2 for a rotated KeySet key with a valid kid)

What `enabled` changes (services/intercom_media.py, services/wiskey_media_caps.py), and only while it is True:
- the media provider's `DirectApiTransport` gets WisKey's v2 socket (`opener_v2`), so a rotated key opens a v2 connection (R7's signer,
  kid on the wire, v2 kinds, B2-ABI timeouts, `bridge_key_changed`); a pairing secret / `g0-legacy` key still opens v1 exactly as before;
- the signed Home Assistant path (v1 only) is never opened for a rotated key, and after a v2 attempt nothing falls back (R7's
  `AutoTransport` rule) - a v2 refusal or an unknown outcome stands, nothing is retried or re-signed;
- the signed capabilities read and its cache follow the same key: a rotated key reads `direct/capabilities_v3`, `direct/time` and
  `direct/pairing_status_v2` on its own v2 socket (the closed readers of R7);
- `provider_for` / `signing_problem` / `readiness` count a rotated key as one that signs.
While False (the default, and on every bridge below 0.10.9) every one of those paths is the code as it was, byte for byte.

What it does NOT change: the listen gate of R5 (a listen still needs the fresh descriptor's offer, refused before `talk_open`), the
station media switch (`access.station_media`) and the provider choice (`access.station_media_provider`), any permission, the bridge key
rotation rule. Rotation stays BLOCKED while WisKey is installed (`bridge_rotation`: `wiskey_present`, owner Q8): while it is, the key is
never rotated, `protocol_for_key` is 1 for every key, and this switch has no effect at all. It becomes live only after the owner lifts
that block (a separate decision; docs/changes/WISKEY-MEDIA-V2-2530.md section 5).

No I/O beyond two settings reads; never raises; never logs or returns a key."""
from __future__ import annotations

from typing import Any

SETTING_KEY = "access.station_media_direct_v2"
CHOICES = ("off", "on")
DEFAULT = "off"
BRIDGE_REQUIRED = "0.10.9"
BRIDGE_VERSION_KEY = "bridge.integration_version"


def _version_tuple(text: Any) -> tuple[int, ...]:
    if not isinstance(text, str) or not text.strip():
        return ()
    out = []
    for part in text.strip().split("."):
        digits = "".join(ch for ch in part if ch.isdigit())
        out.append(int(digits) if digits else 0)
    return tuple(out)


def setting(conn: Any) -> str:
    """The stored switch; `off` when unknown (no connection, an older database, a value this build does not know)."""
    if conn is None:
        return DEFAULT
    from ..db import get_setting

    try:
        value = get_setting(conn, SETTING_KEY, DEFAULT) or DEFAULT
    except Exception:  # noqa: BLE001 - an older database without the settings row: off
        return DEFAULT
    return value if value in CHOICES else DEFAULT


def bridge_version(conn: Any) -> str | None:
    """The bridge version the running Arx last saw (set by the bridge's own hello), or None."""
    if conn is None:
        return None
    from ..db import get_setting

    try:
        value = get_setting(conn, BRIDGE_VERSION_KEY)
    except Exception:  # noqa: BLE001
        return None
    return value if isinstance(value, str) and value.strip() else None


def bridge_ok(conn: Any) -> bool:
    """True when the bridge Arx last saw is BRIDGE_REQUIRED or newer; an unknown version is not."""
    seen = _version_tuple(bridge_version(conn))
    return bool(seen) and seen >= _version_tuple(BRIDGE_REQUIRED)


def enabled(conn: Any) -> bool:
    """The one gate of the media path: the switch is on AND the bridge that serves v2 for WisKey is installed and running."""
    return setting(conn) == "on" and bridge_ok(conn)


def state(conn: Any) -> dict[str, Any]:
    """Public facts for a change note / diagnostics (never a key): the switch, the bridge version seen, whether the gate is open."""
    return {"setting": setting(conn), "bridge_version": bridge_version(conn), "bridge_required": BRIDGE_REQUIRED,
            "bridge_ok": bridge_ok(conn), "enabled": enabled(conn)}


def key_problem(key: Any) -> str | None:
    """Why `key` cannot sign a media command while v2 media is enabled (`not_paired` / `key_rotated`), else None. v1 for the pairing
    secret and `g0-legacy` (the v1 signer's own rule), v2 for a rotated KeySet key with a valid kid (R7's `protocol_for_key`); a rotated key
    whose kid is not a valid key id cannot sign either protocol (`key_rotated`, as the v1 rule names any rotated key). Pure; no key leaves."""
    from . import wiskey_media_bridge as bridge

    try:
        if bridge.protocol_for_key(key) == 1:
            bridge._key_text(key)  # noqa: SLF001 - the v1 signer's own check, so the two rules cannot drift apart
    except bridge.MediaBridgeError as exc:
        return "key_rotated" if exc.code in ("bridge_key_rotated", "bridge_key_unversioned") else "not_paired"
    except Exception:  # noqa: BLE001 - an unreadable key is "not paired"
        return "not_paired"
    return None


def is_rotated(key: Any) -> bool:
    """True for a key that only v2 can carry (a KeySet key whose kid is not `g0-legacy`, valid or not). Pure."""
    from . import wiskey_media_bridge as bridge

    try:
        return bridge.protocol_for_key(key) == 2
    except bridge.MediaBridgeError as exc:
        return exc.code == "bridge_key_unversioned"
    except Exception:  # noqa: BLE001
        return False
