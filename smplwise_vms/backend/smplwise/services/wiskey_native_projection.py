"""Versioned evidence projection of Arx's ONE SQLite generation journal.

Not a decision journal: generation/state/claim always come from the original
wiskey_install_generation functions. Invalidate before any component mutation;
only publish current committed state with a verified paired distribution image.
Native owns grants and append-only execution dedup; Arx only reads those grants.
"""

from __future__ import annotations
import hashlib, json, os, secrets, threading
from pathlib import Path
from typing import Any
from contextlib import contextmanager
import time
from .wiskey_distribution_digest import digest

try:  # POSIX only (the add-on runs on Linux); absent on the Windows development workstation
    import fcntl as _fcntl
except ImportError:  # pragma: no cover - platform dependent
    _fcntl = None

RELATIVE = ".storage/hikvision_intercom.arx_installation/controller.v1.json"
FENCE_NAME = "generation.lock"
FENCE_WAIT_S = 2.0
FENCE_UNSUPPORTED = "generation_fence_unsupported"
EVIDENCE_KEY = "wiskey.installation.generation_evidence.v1"
OBSERVATION_KEY = "wiskey.installation.readiness_observation.v1"
HISTORY_KEY = "wiskey.installation.r2_history.v1"
# WisKey M12 policy B, slice S3: the wire projection of the committed maintenance intent (relay-maintenance-v1), next to controller.v1
# in the same private directory and under the same fence. Written only by publish_maintenance (DB -> JOURNAL_LOCK -> fence).
MAINTENANCE_RELATIVE = ".storage/hikvision_intercom.arx_installation/maintenance.v1.json"
NAMES = ("smplwise_bridge", "hikvision_intercom")


def fence_supported():
    return _fcntl is not None


def require_fence():
    """WISKEY-RC7-ADOPT-2331 (rc.7 map row 5b): a platform without `fcntl` REFUSES every projection write or delete with the typed
    `generation_fence_unsupported` - it never writes without the fence and never skips it silently."""
    if _fcntl is None:
        from .wiskey_auto_install import InstallationError

        raise InstallationError(FENCE_UNSUPPORTED)


_HELD: dict[str, list] = {}  # private directory -> [thread ident, depth]: the fence this process holds (S3, re-entry by its holder)
_HELD_LOCK = threading.Lock()


@contextmanager
def generation_fence(root):
    """WISKEY-RC7-ADOPT-2331 (rc.7 map row 5): the original `generation.lock` next to the projection, shared only with Native's
    start-up executor. A PUBLICATION fence only (decision WISKEY-R2-ALIGN-2272 stands: no file journal): the lock file holds no
    state, no counter and no claim - it is never read or written, only flock'ed; the ONE journal stays in SQLite
    (`wiskey.installation.generation`). Order: Arx DB -> JOURNAL_LOCK -> this fence; Native takes only the fence and never calls Arx
    or its SQLite connection while holding it. No socket I/O under it. Busy for more than FENCE_WAIT_S: TimeoutError
    `generation_fence_busy`. No fcntl: `generation_fence_unsupported` (`require_fence`).

    WisKey M12 S3: a generation / claim writer keeps the fence until its write transaction ENDS (wiskey_install_generation._store,
    db.on_transaction_end) - also inside the add-on start-up transaction. The thread that holds it may enter it again (depth count)
    instead of waiting on its own flock; every other thread and process waits as before."""
    require_fence()
    parent = _private_dir(root)
    key, me = str(parent.resolve()), threading.get_ident()
    with _HELD_LOCK:
        held = _HELD.get(key)
        again = held is not None and held[0] == me
        if again:
            held[1] += 1
    if again:
        try:
            yield
        finally:
            with _HELD_LOCK:
                held[1] -= 1
        return
    fd = os.open(parent / FENCE_NAME, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        deadline = time.monotonic() + FENCE_WAIT_S
        while True:
            try:
                _fcntl.flock(fd, _fcntl.LOCK_EX | _fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise TimeoutError("generation_fence_busy") from None
                time.sleep(min(.01, max(0, deadline - time.monotonic())))
        with _HELD_LOCK:
            _HELD[key] = [me, 1]
        try:
            yield
        finally:
            with _HELD_LOCK:
                _HELD.pop(key, None)
            _fcntl.flock(fd, _fcntl.LOCK_UN)
    finally:
        os.close(fd)


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
    with generation_fence(root):  # rc.7 row 5: the delete runs under the publication fence (refused without fcntl)
        path.unlink(missing_ok=True)
        (Path(root) / MAINTENANCE_RELATIVE).unlink(missing_ok=True)  # S3: no maintenance admission outlives its controller
        _sync(path.parent)


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


def publish_maintenance(db, root, *, generation_id, token):
    """WisKey M12 policy B, slice S3 (relay-maintenance-v1, contribution M12-POLICY-B.20261102.01 adopted semantically): write the
    COMMITTED maintenance intent of the ONE SQLite journal, exactly as stored, to `maintenance.v1.json`. Order DB -> JOURNAL_LOCK ->
    fence, no transport I/O. The controller projection is never written or removed here: `invalidated` retires the maintenance
    admission only. Returns the intent state, or `stale` (another generation / token, no committed intent, or no published
    `installed` + `restart_requested` controller for this generation). Without fcntl: `generation_fence_unsupported`."""
    from . import wiskey_install_generation as gen

    require_fence()
    with db.write_aside(label="publish committed maintenance v1") as conn:
        with gen.JOURNAL_LOCK:
            cur = gen.read(db, conn)
            intent = None if cur is None else cur.get(gen.MAINTENANCE_KEY)
            if (cur is None or cur["generation_id"] != generation_id or not isinstance(intent, dict)
                    or intent.get("token") != token or cur["digest"] != intent.get("source_digest")):
                return "stale"
            with generation_fence(root):
                from .wiskey_auto_install import InstallationError, read_private_json

                try:
                    controller = read_private_json(Path(root) / RELATIVE)
                except InstallationError:
                    return "stale"
                if (not isinstance(controller, dict) or controller.get("generation_id") != generation_id
                        or controller.get("source_digest") != cur["digest"] or controller.get("phase") != "installed"
                        or controller.get("state") != gen.REQUESTED):
                    return "stale"  # never manufacture installed / loaded state, never touch the controller
                parent = _private_dir(root)
                path = Path(root) / MAINTENANCE_RELATIVE
                tmp = parent / (".maintenance." + secrets.token_hex(8) + ".tmp")
                try:
                    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
                    with os.fdopen(fd, "w") as stream:
                        json.dump(intent, stream, sort_keys=True, separators=(",", ":"))
                        stream.flush()
                        os.fsync(stream.fileno())
                    os.replace(tmp, path)
                    _sync(parent)
                finally:
                    tmp.unlink(missing_ok=True)
            return str(intent["state"])


def publish(db, root, expected, *, generation_id, claim=None, restart_boot_id=None):
    from ..db import get_setting, set_setting
    from . import wiskey_install_generation as gen

    require_fence()  # rc.7 row 5b: refuse before any DB write on a platform without the fence
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
            with generation_fence(root):  # rc.7 row 5: DB -> JOURNAL_LOCK -> fence
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
