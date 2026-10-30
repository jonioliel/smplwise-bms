"""Versioned evidence projection of Arx's ONE SQLite generation journal.

Not a decision journal: generation/state/claim always come from the original
wiskey_install_generation functions. Invalidate before any component mutation;
only publish current committed state with a verified paired distribution image.
Native owns grants and append-only execution dedup; Arx only reads those grants.
"""

from __future__ import annotations
import hashlib, json, os, secrets
from pathlib import Path
from typing import Any
from .wiskey_distribution_digest import digest

RELATIVE = ".storage/hikvision_intercom.arx_installation/controller.v1.json"
EVIDENCE_KEY = "wiskey.installation.generation_evidence.v1"
OBSERVATION_KEY = "wiskey.installation.readiness_observation.v1"
HISTORY_KEY = "wiskey.installation.r2_history.v1"
NAMES = ("smplwise_bridge", "hikvision_intercom")


def pair_digest(expected):
    return hashlib.sha256(
        json.dumps(expected, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def context(source):
    from .bridge_install import ha_config_dir, source_dir

    cfg = ha_config_dir()
    bridge = source_dir()
    if cfg is None or bridge is None:
        return None
    return cfg, {
        "smplwise_bridge": digest(bridge),
        "hikvision_intercom": digest(source),
    }


def _private_dir(root):
    parent = (Path(root) / RELATIVE).parent
    if parent.is_symlink():
        raise ValueError("projection_private_directory_required")
    parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(parent, 0o700)
    return parent


def invalidate(root):
    # nothing to withdraw (and nothing is created in the owner's config directory) when no projection was ever published
    path = Path(root) / RELATIVE
    if not path.parent.is_dir():
        return
    parent = _private_dir(root)
    path.unlink(missing_ok=True)
    _sync(parent)


def _sync(parent):
    if os.name == "nt":  # a directory cannot be opened for fsync on Windows (developer workstation only; the add-on runs on Linux)
        return
    fd = os.open(parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _write(root, value):
    parent = _private_dir(root)
    path = Path(root) / RELATIVE
    tmp = parent / (".controller." + secrets.token_hex(8) + ".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(value, f, sort_keys=True, separators=(",", ":"))
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
        _sync(parent)
    finally:
        tmp.unlink(missing_ok=True)


def publish(db, root, expected, *, generation_id, claim=None, restart_boot_id=None):
    from ..db import get_setting, set_setting
    from . import wiskey_install_generation as gen

    # DB first, journal lock second, exactly as the authoritative mutation APIs.
    with db.write_aside(label="publish committed Arx generation projection") as conn:
        with gen.JOURNAL_LOCK:
            current = gen.read(db, conn)
            if (
                current is None
                or current["generation_id"] != generation_id
                or current["digest"] != pair_digest(expected)
                or claim is not None
                and current["claim"] != claim
            ):
                return None
            previous = json.loads(get_setting(conn, EVIDENCE_KEY) or "{}")
            if (
                restart_boot_id is None
                and previous.get("generation_id") == generation_id
            ):
                restart_boot_id = previous.get("restart_boot_id")
            actual = {}
            for name in NAMES:
                try:
                    actual[name] = digest(Path(root) / "custom_components" / name)
                except (OSError, ValueError):
                    pass
            phase = "installed" if actual == expected else "installing"
            document = {
                "format": "wiskey-arx-generation-projection.v1",
                "schema_version": 1,
                "controller": "arx-sqlite:wiskey.installation.generation",
                "generation_id": current["generation_id"],
                "source_digest": current["digest"],
                "claim_id": current["claim"],
                "state": current["state"],
                "phase": phase,
                "expected": expected,
                "staged": expected if phase == "installed" else {},
                "installed": actual,
                "restart_boot_id": restart_boot_id,
            }
            # This setting is observation/migration evidence, not another claim.
            set_setting(conn, EVIDENCE_KEY, json.dumps(document, sort_keys=True))
            # Current authoritative state was committed before caller entered;
            # only derived evidence is written in this transaction.
            _write(root, document)
            return document


def migrate_r2(db, conn, root, expected, legacy_native_digest):
    from ..db import get_setting, set_setting
    from . import wiskey_install_generation as gen
    from .wiskey_auto_install import read_private_json

    if conn is None:
        with db.write_aside(label="archive R2 intent without replay") as owned:
            return migrate_r2(db, owned, root, expected, legacy_native_digest)
    if get_setting(conn, HISTORY_KEY) is not None:
        return
    records = []
    base = (Path(root) / RELATIVE).parent
    for p in [base / "generation.json", *sorted((base / "generations").glob("*.json"))]:
        if not p.exists():
            continue
        doc = read_private_json(p)
        records.append(
            {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "document": doc}
        )
    legacy = get_setting(conn, gen.RESTART_DIGEST_KEY)
    carry = legacy == legacy_native_digest
    for item in records:
        doc = item["document"]
        if doc.get("expected") == expected and (
            doc.get("native_restart") is not None
            or doc.get("restart", {}).get("state")
            in {"requested", "failed", "unknown", "completed"}
        ):
            carry = True
    if gen.read(db, conn) is None and carry:
        set_setting(conn, gen.RESTART_DIGEST_KEY, pair_digest(expected))
    set_setting(
        conn,
        HISTORY_KEY,
        json.dumps(
            {
                "format": "wiskey-r2-intent-archive.v1",
                "schema_version": 1,
                "records": records,
                "legacy_restart_digest": legacy,
                "mapped_pair_digest": pair_digest(expected) if carry else None,
            },
            sort_keys=True,
        ),
    )


def save_observation(db, journal, answer, state):
    from ..db import set_setting
    from . import wiskey_install_generation as gen

    with db.write_aside(label="observe readiness without restarting") as conn:
        with gen.JOURNAL_LOCK:
            current = gen.read(db, conn)
            if (
                current is None
                or current["generation_id"] != journal["generation_id"]
                or current["claim"] != journal["claim"]
            ):
                return "stale"
            set_setting(
                conn,
                OBSERVATION_KEY,
                json.dumps(
                    {
                        "format": "wiskey-readiness-observation.v1",
                        "schema_version": 1,
                        "generation_id": journal["generation_id"],
                        "claim_id": journal["claim"],
                        "state": state,
                        "readiness": answer,
                    },
                    sort_keys=True,
                ),
            )
            return "recorded"
