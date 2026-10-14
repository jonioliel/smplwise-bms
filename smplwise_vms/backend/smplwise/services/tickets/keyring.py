"""CR-038 slice 4: the module key `k_tickets` as the rest of the module uses it - one object per process (`KEYS`), configured at
start-up with the add-on's data directory and the store's "does any row depend on a key" check (module_key.ModuleKey with key
ids, code review V4).

Creation rule (code review W12, public-core notes wiring item 11): a key is minted ONLY by the "module on" paths - the settings
route that turns `tickets.enabled` on, and the start-up of an installation whose module is already on - and only when there is
no key AND no row depends on one (no link, no contact with a phone key). A /data restored without secrets/ therefore never mints
a fresh key that would kill every live link and silently unmatch every phone: the caller gets ModuleKeyError and the health page
says "restore secrets/". Every other path reads: `current()` for a new derivation, `get(row.key_id)` for a row's own key.
Nothing on the public listener's request path ever creates a key."""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Callable

from .module_key import ModuleKey, ModuleKeyError


class KeyRing:
    def __init__(self) -> None:
        self._mk: ModuleKey | None = None
        self._lock = threading.Lock()

    def configure(self, data_dir: Path, has_keyed_rows: Callable[[], bool]) -> None:
        with self._lock:
            self._mk = ModuleKey(Path(data_dir), has_links=has_keyed_rows)

    @property
    def configured(self) -> bool:
        return self._mk is not None

    def _require(self) -> ModuleKey:
        mk = self._mk
        if mk is None:
            raise ModuleKeyError("the tickets module key is not configured")
        return mk

    def current(self, *, create: bool = False) -> tuple[str, bytes]:
        """(id, key) of the key new derivations use; `create=True` only on the "module on" paths (module docstring)."""
        return self._require().current(create=create)

    def ensure(self) -> str | None:
        """The "module on" paths: the current key id, minted when there is none and nothing depends on one. None (and an
        error line by the caller) when the key cannot exist safely - a restore without secrets/."""
        try:
            return self._require().current(create=True)[0]
        except ModuleKeyError:
            return None

    def get(self, key_id: str | None = None) -> bytes:
        """The key a row names (`key_id`), or the current key when None."""
        return self._require().get(key_id)

    def __call__(self, key_id: str | None = None) -> bytes:
        return self.get(key_id)

    def ids(self) -> tuple[str, ...]:
        return tuple(self._require().ids())

    def status(self) -> dict[str, object]:
        """For the health page: never key material."""
        if self._mk is None:
            return {"state": "not_configured"}
        return dict(self._mk.status())

    def reload(self) -> None:
        if self._mk is not None:
            self._mk.reload()

    # ---------------------------------------------------------------- rotation (public-core notes wiring item 11)

    def can_rotate(self) -> bool:
        return self._mk is not None and self.status().get("state") == "ok"

    def stage(self) -> tuple[str, bytes]:
        """A new key beside the current one (unused until `commit`): (id, key)."""
        mk = self._require()
        key_id = mk.stage()
        return key_id, mk.get(key_id)

    def commit(self, key_id: str) -> None:
        self._require().commit(key_id)

    def retire_unused(self, in_use: set[str]) -> int:
        """Delete the key files no row needs any more (never the current key). `in_use`: the ids live links and phone keys name."""
        mk = self._mk
        if mk is None:
            return 0
        try:
            current = mk.current()[0]
        except ModuleKeyError:
            return 0
        n = 0
        for key_id in mk.ids():
            if key_id != current and key_id not in in_use:
                try:
                    n += 1 if mk.retire(key_id) else 0
                except ModuleKeyError:
                    continue
        return n

    def __repr__(self) -> str:  # never key material
        return f"KeyRing(configured={self._mk is not None})"


KEYS = KeyRing()
