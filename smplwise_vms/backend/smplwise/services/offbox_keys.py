"""DATASTORE-295 phase 2: the keyring of the off-box copies (SWXB keys, services/backup_offbox.py).

`<data>/keys/offbox_keyring.json` (mode 0600): {"v": 1, "active": <key id>, "keys": {<key id>: {"key": base64, "created_at", "source",
"exported_at"}}}. Held OUTSIDE the database; the `keys/` folder never enters a project archive (backup._rel) and is never restorable
(backup.restorable). Rules:

- a new copy is sealed with the ACTIVE key; `open_file` picks any key of the ring by the id in the copy's header;
- rotation adds a fresh key and makes it active - the old keys stay, so every older copy (and the retention's deletes of them) keeps
  working; a key is never removed by Arx;
- export: the administrator may see each key ONCE (`export_key`), after an explicit confirmation in the API; the ring records when.
  The exported text (`SWXB-KEY-1:<id>:<base64>`) carries its id, so `import_key` on a new installation (after a disaster) checks it
  matches before adding it - an imported key becomes active only on a ring that has no key yet;
- phase 1's single key file (`offbox_backup.key`) is imported into the ring once and left in place.

No function here logs or returns key material, except `export_key` (its one caller is the confirmed API call)."""
from __future__ import annotations

import base64
import binascii
import datetime as dt
import json
import logging
import os
import re
import secrets
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .backup_offbox import KEY_BYTES, OffboxError, default_key_path, key_id

log = logging.getLogger("smplwise.backup.offbox")

KEYRING_FILE = "offbox_keyring.json"
EXPORT_PREFIX = "SWXB-KEY-1"
EXPORT_RE = re.compile(r"^SWXB-KEY-1:([0-9a-f]{16}):([A-Za-z0-9+/]{43}=)$")
_LOCK = threading.Lock()


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@dataclass
class Keyring:
    path: Path
    active: str | None = None
    keys: dict[str, dict[str, Any]] = field(default_factory=dict)

    def key_map(self) -> dict[str, bytes]:
        return {kid: base64.b64decode(e["key"]) for kid, e in self.keys.items()}

    def active_key(self) -> bytes:
        if not self.active or self.active not in self.keys:
            raise OffboxError("key_missing", "no active off-box key")
        return base64.b64decode(self.keys[self.active]["key"])

    def summary(self) -> dict[str, Any]:
        """For the API: ids, dates, flags - never key material."""
        rows = [{"id": kid, "created_at": e.get("created_at"), "source": e.get("source"), "exported": bool(e.get("exported_at")),
                 "exported_at": e.get("exported_at"), "active": kid == self.active} for kid, e in self.keys.items()]
        rows.sort(key=lambda r: (not r["active"], r["created_at"] or ""), reverse=False)
        return {"active": self.active, "keys": rows}


def keyring_path(data_dir: Path) -> Path:
    return Path(data_dir) / "keys" / KEYRING_FILE


def _read(path: Path) -> Keyring:
    kr = Keyring(path)
    if not path.exists():
        return kr
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        for kid, e in (raw.get("keys") or {}).items():
            k = base64.b64decode(e["key"], validate=True)
            if len(k) != KEY_BYTES or key_id(k) != kid:
                raise ValueError("key id")
            kr.keys[kid] = {"key": e["key"], "created_at": e.get("created_at"), "source": e.get("source") or "generated",
                            "exported_at": e.get("exported_at")}
        active = raw.get("active")
        kr.active = active if active in kr.keys else None
    except (ValueError, KeyError, TypeError, AttributeError, binascii.Error):
        raise OffboxError("keyring_invalid", "the off-box keyring file is not valid") from None
    return kr


def _write(kr: Keyring) -> None:
    kr.path.parent.mkdir(parents=True, exist_ok=True)
    tmp = kr.path.with_name(kr.path.name + ".tmp")
    tmp.unlink(missing_ok=True)
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump({"v": 1, "active": kr.active, "keys": kr.keys}, f, indent=1)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, kr.path)


def _add(kr: Keyring, key: bytes, source: str) -> str:
    kid = key_id(key)
    if kid not in kr.keys:
        kr.keys[kid] = {"key": base64.b64encode(key).decode("ascii"), "created_at": _now(), "source": source, "exported_at": None}
    return kid


def load(data_dir: Path, *, create: bool = False) -> Keyring:
    """The ring; with `create`, a first key is generated when it has none. Phase 1's single key file is imported once."""
    with _LOCK:
        kr = _read(keyring_path(data_dir))
        changed = False
        legacy = default_key_path(data_dir)
        if legacy.exists():
            try:
                raw = base64.b64decode(legacy.read_text(encoding="ascii").strip(), validate=True)
            except (ValueError, UnicodeDecodeError, binascii.Error):
                raw = b""
            if len(raw) == KEY_BYTES and key_id(raw) not in kr.keys:
                kid = _add(kr, raw, "phase1-file")
                kr.active = kr.active or kid
                changed = True
        if create and not kr.active:
            kr.active = _add(kr, secrets.token_bytes(KEY_BYTES), "generated")
            changed = True
            log.info("off-box backup key created (id %s); export it once from Settings and keep it outside this machine", kr.active)
        if changed:
            _write(kr)
        return kr


def rotate(data_dir: Path) -> Keyring:
    """A fresh active key; every older key stays in the ring (older copies remain readable)."""
    load(data_dir)
    with _LOCK:
        kr = _read(keyring_path(data_dir))
        kr.active = _add(kr, secrets.token_bytes(KEY_BYTES), "rotated")
        _write(kr)
        log.info("off-box backup key rotated: new active key %s (%d keys kept)", kr.active, len(kr.keys))
        return kr


def export_key(data_dir: Path, kid: str | None = None) -> tuple[str, str]:
    """(key id, export text) of the active key (or `kid`) - ONCE per key: a second export is `key_already_exported`."""
    load(data_dir)
    with _LOCK:
        kr = _read(keyring_path(data_dir))
        kid = kid or kr.active
        if not kid or kid not in kr.keys:
            raise OffboxError("key_missing", "no such off-box key")
        e = kr.keys[kid]
        if e.get("exported_at"):
            raise OffboxError("key_already_exported", "this key was already exported")
        e["exported_at"] = _now()
        _write(kr)
        return kid, f"{EXPORT_PREFIX}:{kid}:{e['key']}"


def import_key(data_dir: Path, text: str) -> str:
    """Add an exported key (a disaster recovery on a new installation). Active only when the ring had no key."""
    m = EXPORT_RE.fullmatch((text or "").strip())
    if not m:
        raise OffboxError("key_import_invalid", "not an exported off-box key")
    try:
        key = base64.b64decode(m.group(2), validate=True)
    except (ValueError, binascii.Error):
        raise OffboxError("key_import_invalid", "not an exported off-box key") from None
    if len(key) != KEY_BYTES or key_id(key) != m.group(1):
        raise OffboxError("key_import_invalid", "the key does not match its id")
    load(data_dir)
    with _LOCK:
        kr = _read(keyring_path(data_dir))
        kid = _add(kr, key, "imported")
        kr.keys[kid]["exported_at"] = kr.keys[kid].get("exported_at") or _now()  # the administrator holds it already
        if not kr.active:
            kr.active = kid
        _write(kr)
        return kid


def set_active(data_dir: Path, kid: str) -> Keyring:
    with _LOCK:
        kr = _read(keyring_path(data_dir))
        if kid not in kr.keys:
            raise OffboxError("key_missing", "no such off-box key")
        kr.active = kid
        _write(kr)
        return kr
