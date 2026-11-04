"""WISKEY-MANAGED-INSTALL-2382: version ordering of the WisKey component (docs/changes/WISKEY-MANAGED-INSTALL-2382.md section 2).

Two rules:
- SemVer precedence: `2.0.0-rc.38 < 2.0.0-rc.39 < 2.0.0 < 2.0.1-rc.1 < 2.0.1-rc.10 < 2.0.1`; numeric pre-release identifiers compare as
  numbers (`rc.9 < rc.10`, a string compare says the opposite); build metadata (`+arx-align.20261029.04`) is ignored for precedence.
- A label is NOT an identity (WisKey shipped two different trees as `2.0.0-rc.38`): equal precedence with other content is never treated
  as "the same" and never as an upgrade. The portable digest (`wiskey-posix-tree-sha256.v1`) and the product CODE decide.

`plan(installed, bundled)` is pure: it never reads a file or a setting. The known trees (`wiskey_known_trees.json`, WisKey's
VERSION_PROFILE_MAP + LEGACY_FILES and the Arx bundles) give a digest its label, product CODE and profile."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$")
KNOWN_TREES_PATH = Path(__file__).with_name("wiskey_known_trees.json")
MANUAL_PROFILE = "owner_manual_existing"
MANAGED_PROFILE = "managed_original_authority_flow"

# the plans; the first four may run, the rest are closed refusals
RUNNABLE = ("install", "upgrade", "convert")
PLANS = (*RUNNABLE, "up_to_date", "downgrade_refused", "same_version_different_content", "version_unknown", "bundle_missing")


def key(version: Any) -> tuple[Any, ...] | None:
    """A sortable precedence key, None when `version` is not a semantic version. Build metadata is dropped."""
    m = _SEMVER.match(version) if isinstance(version, str) and len(version) <= 128 else None
    if m is None:
        return None
    pre = m.group(4)
    if pre is not None and any(p.isdigit() and len(p) > 1 and p.startswith("0") for p in pre.split(".")):
        return None  # SemVer: numeric identifiers have no leading zero
    ids = tuple((0, int(p), "") if p.isdigit() else (1, 0, p) for p in pre.split(".")) if pre else ()
    # a release sorts after every pre-release of the same core; a shorter pre-release list sorts first when it is a prefix (tuple order)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)), 0 if pre else 1, ids)


def compare(a: Any, b: Any) -> int | None:
    """-1 / 0 / 1 by precedence, None when either is not a version."""
    ka, kb = key(a), key(b)
    if ka is None or kb is None:
        return None
    return (ka > kb) - (ka < kb)


@lru_cache(maxsize=1)
def _known() -> tuple[dict[str, Any], ...]:
    try:
        doc = json.loads(KNOWN_TREES_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ()
    rows = doc.get("trees") if isinstance(doc, dict) else None
    return tuple(r for r in rows if isinstance(r, dict)) if isinstance(rows, list) else ()


def known_trees() -> list[dict[str, Any]]:
    return [dict(r) for r in _known()]


def identify(digest: str | None) -> dict[str, Any] | None:
    """The known tree with this portable digest (label, product_CODE, profile), or None."""
    if not isinstance(digest, str):
        return None
    for row in _known():
        if row.get("component_digest") == digest:
            return dict(row)
    return None


def plan(installed: dict[str, Any] | None, bundled: dict[str, Any] | None) -> str:
    """`installed` / `bundled`: {"version", "digest", "product_CODE"?, "profile"?}; `installed` None = nothing installed.
    Returns one of PLANS (closed codes, never a version text)."""
    if not bundled or not bundled.get("digest"):
        return "bundle_missing"
    if installed is None:
        return "install" if key(bundled.get("version")) is not None else "version_unknown"
    if installed.get("digest") == bundled["digest"]:
        return "up_to_date"
    order = compare(bundled.get("version"), installed.get("version"))
    if order is None:
        return "version_unknown"
    if order > 0:
        return "upgrade"
    if order < 0:
        return "downgrade_refused"
    same_product = bool(installed.get("product_CODE")) and installed.get("product_CODE") == bundled.get("product_CODE")
    if same_product and installed.get("profile") == MANUAL_PROFILE and bundled.get("profile") == MANAGED_PROFILE:
        return "convert"
    return "same_version_different_content"
