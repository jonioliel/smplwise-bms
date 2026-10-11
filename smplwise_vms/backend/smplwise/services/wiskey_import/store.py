"""The importer's own files and its kill switch.

Everything the importer writes lives under `<data dir>/wiskey_import/` (never in the exchange folder, never in the platform
configuration in stage 1):
  work/                  throwaway git sandboxes (removed after each intake)
  intakes/<intake id>/   report.json (always) and manifest.json (PASS only) - written once, never rewritten
  staging/<intake id>/   the verified installable bytes of a passing install candidate (install.stage)
  journal/               install journals (install.Journal; not used by any route in stage 1)

The exchange folder is read only: `SW_WISKEY_EXCHANGE_DIR`, else `<platform config>/smplwise_exchange/ready` (PKG02 location).
The kill switch `wiskey.import_enabled` is "false" by default: with it off no intake runs and no install can be planned.
No database table is needed (no migration): reports are files, the switch is one settings row, actions are audit rows.
"""
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from ...config import Settings
from ...db import get_setting, set_setting
from .common import PACKAGE_NAME, canonical_json

K_ENABLED = "wiskey.import_enabled"


def enabled(conn: sqlite3.Connection) -> bool:
    return (get_setting(conn, K_ENABLED, "false") or "false") == "true"


def set_enabled(conn: sqlite3.Connection, on: bool) -> None:
    set_setting(conn, K_ENABLED, "true" if on else "false")


def root(settings: Settings) -> Path:
    return settings.data_dir / "wiskey_import"


def work_root(settings: Settings) -> Path:
    return root(settings) / "work"


def intakes_dir(settings: Settings) -> Path:
    return root(settings) / "intakes"


def staging_root(settings: Settings) -> Path:
    return root(settings) / "staging"


def journal_dir(settings: Settings) -> Path:
    return root(settings) / "journal"


def exchange_root() -> Path | None:
    env = os.environ.get("SW_WISKEY_EXCHANGE_DIR")
    if env:
        p = Path(env)
    else:
        from .. import bridge_install

        cfg = bridge_install.ha_config_dir()
        if cfg is None:
            return None
        p = cfg / "smplwise_exchange" / "ready"
    return p if p.is_dir() and not p.is_symlink() else None


def list_packages(exchange: Path | None) -> list[str]:
    """Package folder names in the exchange folder (real directories with a valid name only; nothing is opened)."""
    if exchange is None:
        return []
    out = []
    try:
        for entry in os.scandir(exchange):
            if entry.is_dir(follow_symlinks=False) and PACKAGE_NAME.match(entry.name):
                out.append(entry.name)
    except OSError:
        return []
    return sorted(out)


def save_intake(settings: Settings, report: dict[str, Any], manifest: dict[str, Any] | None) -> Path:
    d = intakes_dir(settings) / report["intake_id"]
    d.mkdir(parents=True, exist_ok=False)  # write once: an intake id is never reused
    (d / "report.json").write_bytes(json.dumps(report, ensure_ascii=False, indent=1, sort_keys=True).encode("utf-8"))
    if manifest is not None:
        (d / "manifest.json").write_bytes(canonical_json(manifest))
    return d


def load_intake(settings: Settings, intake_id: str) -> dict[str, Any] | None:
    if not (intake_id.isascii() and intake_id.isalnum() and len(intake_id) == 32):
        return None
    d = intakes_dir(settings) / intake_id
    try:
        report = json.loads((d / "report.json").read_bytes())
    except (OSError, ValueError):
        return None
    try:
        manifest = json.loads((d / "manifest.json").read_bytes())
    except (OSError, ValueError):
        manifest = None
    return {"report": report, "manifest": manifest}


def summary(report: dict[str, Any]) -> dict[str, Any]:
    return {k: report.get(k) for k in ("intake_id", "package", "result", "first_failure", "started_at", "finished_at", "manifest_sha256")} | {
        "profile_id": (report.get("profile") or {}).get("id")}


def list_intakes(settings: Settings, limit: int = 20) -> list[dict[str, Any]]:
    d = intakes_dir(settings)
    if not d.is_dir():
        return []
    out = []
    for sub in d.iterdir():
        try:
            out.append(summary(json.loads((sub / "report.json").read_bytes())))
        except (OSError, ValueError):
            continue
    out.sort(key=lambda s: s.get("finished_at") or "", reverse=True)
    return out[:limit]
