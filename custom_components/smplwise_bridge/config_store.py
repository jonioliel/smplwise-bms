"""The file layer of `smplwise_bridge.config_item` (CR-017, bridge 0.6.0): reads and writes the three files Home Assistant's own editor writes -
`automations.yaml` (a list of items with an `id`), `scripts.yaml` (a dict keyed by the script's object id), `scenes.yaml` (a list with an `id`) -
in the same format, with the guarantees the contract asks of the single enforcement point (AUTOMATIONS_API.md section 4):

- a compare-and-set against the revision the user edited (`base_revision`), evaluated by the caller while it holds this module's lock;
- a ring of 10 backups of the previous file under `<config>/smplwise_bridge_backups/`;
- an atomic write (a temporary file in the same directory, then `os.replace`) and a re-read that must equal what was meant to be written.

A file that carries YAML tags (`!include`, `!secret`, ...) is never rewritten: Home Assistant resolves them on load, so writing the loaded data back would
inline them. Reading such a file is refused too (`yaml_tags_present`), and the add-on shows the item as not editable here.

Synchronous on purpose (it runs in an executor); standard library plus PyYAML, which Home Assistant itself ships. The YAML dump is Home Assistant's
(`homeassistant.util.yaml.dump`) when it can be imported, else PyYAML with the same options. Never logs a config, a value or a path of an item.
"""
from __future__ import annotations

import copy
import datetime as dt
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Callable

from . import config_policy as policy

FILES = {"automation": "automations.yaml", "script": "scripts.yaml", "scene": "scenes.yaml"}
BACKUP_DIR = "smplwise_bridge_backups"
BACKUPS_KEEP = 10
_TAG_RE = re.compile(r"(?:^|[\s\[{,:-])!(?:include\w*|secret|env_var|input)\b", re.MULTILINE)  # Home Assistant's YAML tags (a comment that names one is refused too: closed)


class StoreError(Exception):
    """A refusal of the file layer: `code` is the answer's `error`."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _dump(data: Any) -> str:
    """Home Assistant's own YAML dump (insertion order kept, unicode kept, null written as an empty value)."""
    try:
        from homeassistant.util.yaml import dump  # type: ignore[import-not-found]

        return dump(data)
    except ImportError:
        import yaml

        return yaml.dump(data, default_flow_style=False, allow_unicode=True, sort_keys=False, Dumper=yaml.SafeDumper).replace(": null\n", ":\n")


def _load_text(text: str) -> Any:
    import yaml

    return yaml.safe_load(text)


class ConfigStore:
    def __init__(self, config_dir: str | os.PathLike[str], *, keep: int = BACKUPS_KEEP, now: Callable[[], dt.datetime] | None = None) -> None:
        self.dir = Path(config_dir)
        self.keep = keep
        self._now = now or (lambda: dt.datetime.now(dt.timezone.utc))

    # ------------------------------------------------------------------ reading

    def path(self, kind: str) -> Path:
        return self.dir / FILES[kind]

    def _read(self, kind: str) -> tuple[Any, str | None]:
        """(the loaded data, the text) of one file; an absent or empty file is an empty list / dict."""
        p = self.path(kind)
        empty: Any = {} if kind == "script" else []
        if not p.exists():
            return empty, None
        try:
            text = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            raise StoreError("file_unreadable") from None
        if _TAG_RE.search(text):
            raise StoreError("yaml_tags_present")
        try:
            data = _load_text(text)
        except Exception:  # noqa: BLE001 - a YAML error text may quote the file: only the code leaves
            raise StoreError("file_unreadable") from None
        if data is None:
            data = empty
        if kind == "script":
            if not isinstance(data, dict):
                raise StoreError("file_shape")
        elif not isinstance(data, list) or not all(isinstance(x, dict) for x in data):
            raise StoreError("file_shape")
        return data, text

    def get(self, kind: str, item_id: str) -> dict[str, Any] | None:
        """The item as the config API's GET answers it: automations and scenes carry their `id`, a script is the dict under its key."""
        data, _ = self._read(kind)
        if kind == "script":
            item = data.get(item_id)
            return copy.deepcopy(item) if isinstance(item, dict) else None
        return next((copy.deepcopy(x) for x in data if x.get("id") == item_id), None)

    def revision(self, kind: str, item_id: str) -> str | None:
        item = self.get(kind, item_id)
        return policy.revision_of(item) if item is not None else None

    # ------------------------------------------------------------------ writing (the caller holds its write lock)

    def upsert(self, kind: str, item_id: str, config: dict[str, Any], base_revision: str | None) -> tuple[str | None, str]:
        """Compare-and-set, backup, atomic write, verify. Returns (revision before or None for a create, revision after). Raises StoreError:
        `exists` (a create of an id that is there), `not_found`, `stale` (the stored revision is not `base_revision`), the file errors, `write_failed`."""
        data, text = self._read(kind)
        current = data.get(item_id) if kind == "script" else next((x for x in data if x.get("id") == item_id), None)
        if base_revision is None:
            if current is not None:
                raise StoreError("exists")
        else:
            if current is None:
                raise StoreError("not_found")
            if policy.revision_of(current) != base_revision:
                raise StoreError("stale")
        before = policy.revision_of(current) if current is not None else None
        new_item = copy.deepcopy(config)
        if kind == "script":
            data[item_id] = new_item
        elif current is None:
            data.append(new_item)
        else:
            data[data.index(current)] = new_item
        self._commit(kind, data, text)
        try:
            after = self.revision(kind, item_id)
        except StoreError:
            after = None
        if after is None or after != policy.revision_of(config):
            self._restore(kind, text)  # what is on disk is not what was meant: put the previous file back
            raise StoreError("write_failed")
        return before, after

    def delete(self, kind: str, item_id: str, base_revision: str | None) -> str:
        """Remove one item (compare-and-set when `base_revision` is given). Returns the revision it had."""
        data, text = self._read(kind)
        current = data.get(item_id) if kind == "script" else next((x for x in data if x.get("id") == item_id), None)
        if current is None:
            raise StoreError("not_found")
        before = policy.revision_of(current)
        if base_revision is not None and before != base_revision:
            raise StoreError("stale")
        if kind == "script":
            del data[item_id]
        else:
            data.remove(current)
        self._commit(kind, data, text)
        try:
            still = self.revision(kind, item_id)
        except StoreError:
            still = ""
        if still is not None:
            self._restore(kind, text)
            raise StoreError("write_failed")
        return before

    def _commit(self, kind: str, data: Any, previous_text: str | None) -> None:
        p = self.path(kind)
        try:
            if previous_text is not None:
                self._backup(p, previous_text)
            self._atomic_write(p, _dump(data))
        except OSError:
            raise StoreError("write_failed") from None

    def _restore(self, kind: str, previous_text: str | None) -> None:
        """Put the file back as it was (the verification after a write failed); best effort - the backup ring still holds the text."""
        p = self.path(kind)
        try:
            if previous_text is None:
                p.unlink(missing_ok=True)
            else:
                self._atomic_write(p, previous_text)
        except OSError:
            pass

    @staticmethod
    def _atomic_write(p: Path, text: str) -> None:
        """A temporary file in the same directory, flushed, then `os.replace` (Home Assistant's own approach): a reader sees the old file or the new one."""
        p.parent.mkdir(parents=True, exist_ok=True)
        mode = (p.stat().st_mode & 0o7777) if p.exists() else 0o644  # keep the permissions the owner chose
        fd, tmp = tempfile.mkstemp(dir=str(p.parent), prefix=f".{p.name}.", suffix=".smplwise.tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(text)
                fh.flush()
                os.fsync(fh.fileno())
            try:
                os.chmod(tmp, mode)
            except OSError:
                pass
            os.replace(tmp, p)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    def _backup(self, p: Path, text: str) -> None:
        """Keep the previous text of the file in the ring (10 newest per file)."""
        bdir = self.dir / BACKUP_DIR
        bdir.mkdir(parents=True, exist_ok=True)
        stamp = self._now().astimezone(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        (bdir / f"{p.name}.{stamp}.bak").write_text(text, encoding="utf-8", newline="\n")
        ring = sorted(bdir.glob(f"{p.name}.*.bak"))
        for old in ring[:-self.keep]:
            try:
                old.unlink()
            except OSError:
                pass

    def backups(self, kind: str) -> list[Path]:
        return sorted((self.dir / BACKUP_DIR).glob(f"{FILES[kind]}.*.bak"))
