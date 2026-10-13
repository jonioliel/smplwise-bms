"""CR-038 slice 4: the module key `k_tickets` as the rest of the module uses it - one object per process (`KEYS`), configured at
start-up with the add-on's data directory and a `has_keyed_rows` check over the store.

Creation rule (code review W12 / V4): a key is minted only when there is none AND the store reports that no row depends on a
key (no link, no contact with a phone key). A /data restored without secrets/ therefore never mints a fresh key that would kill
every live link and silently unmatch every phone - the caller gets ModuleKeyError and the health page says "restore secrets/".
Nothing on the public listener's request path ever creates a key (`current(create=True)` is called from the manager-side
actions that need one: an assignment that mints a link, a contact saved with a phone, the module switch turned on).

The public-core library is moving to key ids (V4: `tickets_key.<id>` + `tickets_key.current`, `ModuleKey.current()`); this
wrapper speaks to both shapes so the module works on either: with the single-file key the id is LEGACY_ID."""
from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Callable

from .module_key import ModuleKey, ModuleKeyError

LEGACY_ID = "000000000000"


class KeyRing:
    def __init__(self) -> None:
        self._mk: Any = None
        self._has_rows: Callable[[], bool] | None = None
        self._lock = threading.Lock()

    def configure(self, data_dir: Path, has_keyed_rows: Callable[[], bool]) -> None:
        with self._lock:
            self._has_rows = has_keyed_rows
            try:
                self._mk = ModuleKey(Path(data_dir), has_links=has_keyed_rows)  # key ids (public-core V4)
            except TypeError:
                self._mk = ModuleKey(Path(data_dir))  # the single-file key

    @property
    def configured(self) -> bool:
        return self._mk is not None

    def _require(self) -> Any:
        if self._mk is None:
            raise ModuleKeyError("the tickets module key is not configured")
        return self._mk

    @property
    def has_ids(self) -> bool:
        return hasattr(self._require(), "current")

    def current(self, *, create: bool = False) -> tuple[str, bytes]:
        """(id, key) of the key new derivations use. `create=True` mints the first key under the rule of the module docstring."""
        mk = self._require()
        if hasattr(mk, "current"):
            return mk.current(create=create)
        if create:
            check = self._has_rows
            try:
                mk.get()
                return LEGACY_ID, mk.get()
            except ModuleKeyError:
                pass
            try:
                in_use = bool(check()) if check is not None else True
            except Exception:  # noqa: BLE001 - an unanswered check is a refusal, never a new key
                raise ModuleKeyError("could not check for existing links; no tickets module key was created") from None
            if in_use:
                raise ModuleKeyError("links exist but the tickets module key is missing - restore secrets/ instead")
            return LEGACY_ID, mk.get(create=True)
        return LEGACY_ID, mk.get()

    def get(self, key_id: str | None = None) -> bytes:
        """The key a row names (`key_id`), or the current key when None."""
        mk = self._require()
        if hasattr(mk, "current"):
            return mk.get(key_id)
        return mk.get()

    def __call__(self, key_id: str | None = None) -> bytes:
        return self.get(key_id)

    def ids(self) -> tuple[str, ...]:
        mk = self._require()
        if hasattr(mk, "ids"):
            return tuple(mk.ids())
        try:
            mk.get()
            return (LEGACY_ID,)
        except ModuleKeyError:
            return ()

    def status(self) -> dict[str, object]:
        """For the health page: never key material."""
        if self._mk is None:
            return {"state": "not_configured"}
        mk = self._mk
        if hasattr(mk, "status"):
            return dict(mk.status())
        try:
            mk.get()
            return {"state": "ok", "current": LEGACY_ID, "keys": 1}
        except ModuleKeyError:
            return {"state": "absent", "current": None, "keys": 0}

    def reload(self) -> None:
        mk = self._mk
        if mk is not None:
            mk.reload()

    # ---------------------------------------------------------------- rotation (key ids only; the single-file key cannot rotate safely)

    def can_rotate(self) -> bool:
        return self._mk is not None and hasattr(self._mk, "stage")

    def stage(self) -> tuple[str, bytes]:
        """A new key beside the current one (unused until `commit`): (id, key)."""
        mk = self._require()
        key_id = mk.stage()
        return key_id, mk.get(key_id)

    def commit(self, key_id: str) -> None:
        self._require().commit(key_id)

    def retire_unused(self, in_use: set[str]) -> int:
        """Delete the key files no row names any more (never the current key). The caller passes the ids rows name."""
        mk = self._mk
        if mk is None or not hasattr(mk, "retire"):
            return 0
        try:
            current = mk.current()[0]
        except ModuleKeyError:
            return 0
        n = 0
        for key_id in self.ids():
            if key_id != current and key_id not in in_use:
                try:
                    n += 1 if mk.retire(key_id) else 0
                except ModuleKeyError:
                    continue
        return n

    def __repr__(self) -> str:  # never key material
        return f"KeyRing(configured={self._mk is not None})"


KEYS = KeyRing()
