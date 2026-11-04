"""WISKEY-MANAGED-INSTALL-2382: WisKey installs and upgrades through Arx (owner decision 03.11: "להבא נתקין דרכנו").
Design: docs/changes/WISKEY-MANAGED-INSTALL-2382.md.

The OWNER-STARTED path, next to the unattended one (`wiskey_auto_install`, WisKey M12 policy B - unchanged: switch OFF, build constant
`OWNER_ON_PERMITTED = False`, Core gate, manual markers). It does what the owner did by hand on 03.11 with WisKey's
`tools/manual_existing_upgrade.py`, run by Arx and checked at every step:

  preflight -> Core gate -> full platform backup check -> registry snapshot -> stop Core (Supervisor) -> stopped-state private backup
  -> verified swap -> start Core -> registry compare -> (failure) automatic rollback

Rules
- Owner switch `wiskey.managed.enabled` (off | on; missing / null / unreadable = off). The ONE writer is `set_switch` (called only by
  `PUT /wiskey/managed/switch`, system administrator, audited); ON needs the typed phrase. OFF is always allowed and also turns the
  accepted-risk switch off. Switching on installs nothing: every run is a separate owner request.
- Accepted-risk switch `wiskey.managed.core_risk` (same writer, its own phrase): lets an owner-started run accept the Core gate's
  `unverified` / `core_runtime_provenance_unavailable` verdict - and nothing else (`unsupported`, `refused`, `unavailable` still stop).
- A manual install is never replaced before the owner adopts it (`adopt`: typed phrase, private backup, audit row, no config write).
  Unknown trees, links, markers with other content are refused - "preserve and review".
- Never a downgrade: `wiskey_versions.plan` (precedence + digest + product CODE).
- Supervisor calls only through `self_update` (the one allow-list). No platform backup is ever created, restored or downloaded.
- No secret, path or token in a view, an audit row or a log line: closed codes, versions and digests only.

Owner decisions 04.11 (round 18; docs/changes/WISKEY-INSTALL-ANSWERS-2400.md):
- Q3 = B: a forward run may ALSO start by itself when the add-on starts (`startup_reconcile`), but only with the managed switch ON AND
  its own owner switch `wiskey.managed.startup` ON (off by default, the managed switch's typed phrase, goes off with the managed switch).
  The start-up run is the SAME orchestrated run (Core gate, 24 h full backup, private backup, stop / swap / start / compare, automatic
  rollback); it never adopts a manual install, never rolls back, never runs a downgrade, and it takes the Core gate STRICTLY (only
  `supported`; the accepted-risk switch never applies to it). One attempt per shipped bundle digest: a start-up run that stopped Core
  (or did not finish) is not repeated for the same bundle until the owner turns the start-up switch on again. The unattended policy-B
  path (`wiskey_auto_install`, `OWNER_ON_PERMITTED = False`) is NOT opened by this.
- Q4 = A: the full platform backup must be at most 24 h old (`BACKUP_MAX_AGE_S`). Q5 = A: Arx never creates it (no Supervisor call does).
- Q6 = B: the accepted-risk switch stays as built (off; never switched on by code). Q7 = A: the three typed phrases stay.
- Q8 = B: how many recent runs keep their previous tree and private backup is an installation setting (`wiskey.managed.keep_runs`,
  default 5 = the owner's number of 04.11, 1-10, system administrator, audited); it takes effect at the next successful run's
  clean-up.

Seams for tests: `PLATFORM` (the Supervisor / Core side), `SPAWN` (the worker thread), `SLEEP` / `CLOCK` / `WALL`."""
from __future__ import annotations

import asyncio
import datetime as dt
import hashlib
import json
import logging
import os
import re
import secrets
import shutil
import stat
import threading
import time
import unicodedata
from pathlib import Path
from typing import Any, Callable

from . import wiskey_versions as wv
from .wiskey_distribution_digest import digest as tree_digest, digest_rows, files as tree_files

log = logging.getLogger("smplwise.wiskey.managed")

DOMAIN = "hikvision_intercom"
K_ENABLED = "wiskey.managed.enabled"
K_RISK = "wiskey.managed.core_risk"
K_ADOPTION = "wiskey.managed.adoption"
K_JOB = "wiskey.managed.job"
K_INSTALLED = "wiskey.managed.installed"  # the tree the last successful managed run left installed (digest, version, job)
K_STARTUP = "wiskey.managed.startup"  # owner decision 04.11 Q3 = B: a forward run may also start at add-on start-up (default off)
K_STARTUP_ATTEMPT = "wiskey.managed.startup_attempt"  # the last start-up attempt (bundle digest, job id, time) - one per bundle digest
K_KEEP_RUNS = "wiskey.managed.keep_runs"  # owner decision 04.11 Q8 = B: how many recent runs keep their previous tree + private backup
SWITCH_KEYS = (K_ENABLED, K_RISK, K_STARTUP)
DEPENDENT_KEYS = (K_RISK, K_STARTUP)  # need the managed switch ON, and go OFF with it
SWITCH_NAMES = {"enabled": K_ENABLED, "core_risk": K_RISK, "startup": K_STARTUP}
# Owner decision 04.11 Q7 = A: the three typed phrases stay as they are. The start-up switch adds no fourth phrase: it asks for the
# managed switch's own phrase again (the same approval, given once more for the start-up path).
PHRASES = {K_ENABLED: "מאשר ניהול התקנה", K_RISK: "מאשר סיכון סביבה", K_STARTUP: "מאשר ניהול התקנה"}
ADOPT_PHRASE = "מאשר העברה לניהול"

COMPONENT_MARKER = "_manual_upgrade_profile.json"
CONFIG_MARKER = "hikvision_intercom_manual_upgrade.json"
MANUAL_PROFILE_DOC = {"format": "wiskey-manual-existing-upgrade.v1", "schema_version": 1, "mode": "owner_manual_existing",
                      "automatic_authority": False, "parallel_arx_installation": False}
STAGE_ROOT = ".smplwise-wiskey-managed"  # inside the config tree (same filesystem as custom_components: atomic renames)
JOB_ID_RE = re.compile(r"^\d{8}T\d{6}Z-[0-9a-f]{6}$")
REGISTRY_FILES = ("core.config_entries", "core.device_registry", "core.entity_registry")

BACKUP_MAX_AGE_S = 24 * 3600     # owner decision 04.11 Q4 = A: at most 24 h (the owner takes it - Q5 = A; Arx never creates one)
STOP_CONFIRM_S = 90.0            # the core API must stop answering within this after the stop call
STOP_TIMEOUT_S = 300.0           # the Supervisor answers the stop call once the container is down
START_TIMEOUT_S = 600.0
START_DEADLINE_S = 600.0         # the core API must answer again within this
SETTLE_DEADLINE_S = 240.0        # the WisKey entries must be back (same ids, loaded) within this
POLL_S = 3.0
KEEP_RUNS = 5                    # owner decision 04.11 Q8 = B (number given 04.11): keep the last 5; the default of the setting K_KEEP_RUNS
KEEP_RUNS_MIN, KEEP_RUNS_MAX = 1, 10
STARTUP_CORE_WAIT_S = 600.0      # at add-on start-up, wait at most this long for the core API before giving up (nothing touched)
SPACE_FACTOR = 3
CORE_RISK_STATE, CORE_RISK_CODE = "unverified", "core_runtime_provenance_unavailable"

SLEEP: Callable[[float], None] = time.sleep
CLOCK: Callable[[], float] = time.monotonic
WALL: Callable[[], float] = time.time


def _spawn(fn: Callable[[], None]) -> None:
    threading.Thread(target=fn, name="wiskey-managed-run", daemon=True).start()


SPAWN: Callable[[Callable[[], None]], None] = _spawn
_RUN_LOCK = threading.Lock()


class ManagedRefused(Exception):
    """A closed refusal (`code`, HTTP `status`); `details` carries closed values only (a plan code, a step name)."""

    def __init__(self, code: str, status: int = 409, details: dict[str, Any] | None = None) -> None:
        super().__init__(code)
        self.code, self.status, self.details = code, status, details or {}


class StepFailed(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


# ---------------------------------------------------------------- settings helpers

def _get(conn: Any, key: str) -> str | None:
    from ..db import get_setting

    try:
        return get_setting(conn, key)
    except Exception:  # noqa: BLE001 - unreadable = absent
        return None


def _get_json(conn: Any, key: str) -> dict[str, Any] | None:
    try:
        value = json.loads(_get(conn, key) or "null")
    except (TypeError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def mode(conn: Any, key: str) -> str:
    return "on" if _get(conn, key) == "on" else "off"


def enabled(conn: Any) -> bool:
    return mode(conn, K_ENABLED) == "on"


def _read(db: Any, fn: Callable[[Any], Any]) -> Any:
    with db.connection(mode="read", label="wiskey managed read") as conn:
        return fn(conn)


def _write_json(db: Any, key: str, value: dict[str, Any] | None) -> None:
    from ..db import set_setting

    with db.write_aside(label="wiskey managed state") as conn:
        set_setting(conn, key, json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) if value is not None else "")


def _audit(db: Any, action: str, decision: str, *, reason: str | None = None, details: dict[str, Any] | None = None, conn: Any = None,
           actor: Any = None, request_id: str | None = None) -> None:
    from ..audit import audit

    def write(c: Any) -> None:
        audit(c, actor=actor, action=action, decision=decision, resource_type="installation", resource_id=DOMAIN, reason=reason,
              request_id=request_id, details=details or {})

    try:
        if conn is not None:
            write(conn)
        else:
            with db.write_aside(label="wiskey managed audit") as c:
                write(c)
    except Exception as exc:  # noqa: BLE001 - an audit failure is logged, the run's own record still says what happened
        log.warning("wiskey managed audit unavailable (%s)", type(exc).__name__)


# ---------------------------------------------------------------- the owner switches (the ONE writer)

def _phrase_ok(given: Any, expected: str) -> bool:
    return isinstance(given, str) and len(given) <= 200 and unicodedata.normalize("NFC", given.strip()) == unicodedata.normalize("NFC", expected)


def check_switch(conn: Any, key: Any, value: Any, confirm: Any) -> None:
    if key not in SWITCH_KEYS:
        raise ManagedRefused("unknown_switch", 422)
    if value not in ("off", "on"):  # a null / missing / any other value is never ON
        raise ManagedRefused("validation", 422)
    if value == "on":
        if not _phrase_ok(confirm, PHRASES[key]):
            raise ManagedRefused("confirmation_required", 422)
        if key in DEPENDENT_KEYS and not enabled(conn):
            raise ManagedRefused("managed_off", 409)


def set_switch(conn: Any, key: str, value: str, confirm: Any = None) -> list[tuple[str, str, str]]:
    """check_switch() then write; returns (key, before, after) per written key. The only production write of K_ENABLED / K_RISK /
    K_STARTUP (test-enforced). Turning the managed switch off also turns every dependent switch (accepted risk, start-up) off. Turning
    the start-up switch ON re-arms it: the record of the last start-up attempt is cleared, so the next add-on start may try once more."""
    from ..db import set_setting

    check_switch(conn, key, value, confirm)
    out: list[tuple[str, str, str]] = []
    for k in SWITCH_KEYS:  # the closed list drives the writes
        if k == key:
            before = mode(conn, k)
            set_setting(conn, k, value)
            out.append((k, before, value))
    if key == K_ENABLED and value == "off":
        for dep in DEPENDENT_KEYS:  # the closed list drives the writes; only ever OFF here
            if mode(conn, dep) == "on":
                set_setting(conn, dep, "off")
                out.append((dep, "on", "off"))
    if key == K_STARTUP and value == "on" and _get_json(conn, K_STARTUP_ATTEMPT):
        set_setting(conn, K_STARTUP_ATTEMPT, "")
        out.append((K_STARTUP_ATTEMPT, "recorded", "cleared"))
    return out


# ---------------------------------------------------------------- the number of recent runs kept (owner decision 04.11 Q8 = B)

def keep_runs(conn: Any) -> int:
    """The installation's number of recent runs whose previous tree and private backup are kept; KEEP_RUNS when unset or invalid."""
    raw = _get(conn, K_KEEP_RUNS)
    if isinstance(raw, str) and re.fullmatch(r"[0-9]{1,2}", raw):
        n = int(raw)
        if KEEP_RUNS_MIN <= n <= KEEP_RUNS_MAX:
            return n
    return KEEP_RUNS


def set_keep_runs(conn: Any, value: Any) -> tuple[int, int]:
    """The ONE writer of K_KEEP_RUNS (called by `PUT /wiskey/managed/keep-runs`, system administrator, audited). An integer in
    KEEP_RUNS_MIN..KEEP_RUNS_MAX (never a bool, a string or a float). Deletes nothing by itself: the next successful run's clean-up keeps
    this many. Returns (before, after)."""
    from ..db import set_setting

    if type(value) is not int or not KEEP_RUNS_MIN <= value <= KEEP_RUNS_MAX:
        raise ManagedRefused("validation", 422)
    before = keep_runs(conn)
    set_setting(conn, K_KEEP_RUNS, str(value))
    return before, value


# ---------------------------------------------------------------- the bundle (what Arx ships)

_BUNDLE_CACHE: dict[str, Any] = {"key": None, "value": None}


def bundle_source() -> Path | None:
    from . import bridge_install
    from . import wiskey_auto_install as wai

    return wai.native_source(bridge_install.source_dir())


def bundle_info(source: Path | None = None) -> dict[str, Any]:
    """The shipped bundle, verified: byte-exact to its pin, managed profile, product CODE, file count and recomputed digest; no manual
    marker inside. {"state": "ok", version, digest, product_CODE, profile, files, bytes} or {"state": <closed code>}."""
    from . import wiskey_auto_install as wai

    src = source if source is not None else bundle_source()
    if src is None:
        return {"state": "bundle_missing"}
    pin_path = src.parent / wai.PIN_NAME
    try:
        cache_key = (str(src), pin_path.stat().st_mtime_ns, (src / "manifest.json").stat().st_mtime_ns)
    except OSError:
        return {"state": "bundle_missing"}
    if _BUNDLE_CACHE["key"] == cache_key:
        return dict(_BUNDLE_CACHE["value"])
    try:
        rows = tree_files(src)
        pin = wai.verify_pin(src)
        version = json.loads((src / "manifest.json").read_text(encoding="utf-8")).get("version")
    except wai.InstallationError as exc:
        return {"state": "bundle_invalid", "code": exc.code}
    except (OSError, ValueError):
        return {"state": "bundle_invalid", "code": "bundle_unreadable"}
    digest = digest_rows(rows)
    if (pin.get("profile") != wv.MANAGED_PROFILE or not isinstance(pin.get("product_CODE"), str)
            or re.fullmatch(r"[0-9a-f]{40}", pin["product_CODE"]) is None or pin.get("file_count") != len(rows)
            or pin.get("component_digest_recomputed") != digest or pin.get("component_version") != version
            or any(r["path"] == COMPONENT_MARKER for r in rows) or wv.key(version) is None):
        return {"state": "bundle_invalid", "code": "bundle_pin_mismatch"}
    value = {"state": "ok", "version": version, "digest": digest, "product_CODE": pin["product_CODE"], "profile": pin["profile"],
             "files": len(rows), "bytes": sum(r["bytes"] for r in rows)}
    _BUNDLE_CACHE.update(key=cache_key, value=value)
    return dict(value)


# ---------------------------------------------------------------- what is installed

def _marker_state(path: Path) -> str:
    """absent | manual (a regular file whose content is exactly WisKey's manual profile) | invalid (a link, other content, unreadable)."""
    if not os.path.lexists(path):
        return "absent"
    try:
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_size > 4096:
            return "invalid"
        return "manual" if json.loads(path.read_text(encoding="utf-8")) == MANUAL_PROFILE_DOC else "invalid"
    except (OSError, ValueError):
        return "invalid"


def classify(cfg: Path) -> dict[str, Any]:
    """Read-only facts about `<cfg>/custom_components/hikvision_intercom` and the two markers. Never follows a link."""
    target = Path(cfg) / "custom_components" / DOMAIN
    markers = {"component": _marker_state(target / COMPONENT_MARKER), "config": _marker_state(Path(cfg) / CONFIG_MARKER)}
    if not os.path.lexists(target):
        return {"state": "missing", "markers": markers}
    if target.is_symlink() or not target.is_dir():
        return {"state": "link", "markers": markers}
    try:
        rows = tree_files(target)
        version = json.loads((target / "manifest.json").read_text(encoding="utf-8")).get("version")
    except (OSError, ValueError):
        return {"state": "unreadable", "markers": markers}
    digest = digest_rows(rows)
    known = wv.identify(digest)
    return {"state": "present", "markers": markers, "version": version if isinstance(version, str) else None, "digest": digest,
            "files": len(rows), "label": known.get("label") if known else None,
            "product_CODE": known.get("product_CODE") if known else None, "profile": known.get("profile") if known else None,
            "known": known is not None}


def ownership(conn: Any, installed: dict[str, Any]) -> str:
    """missing | arx_managed | adopted | manual | legacy | unknown | link | unreadable | marker_invalid."""
    state = installed.get("state")
    if state != "present":
        return state if state in ("missing", "link", "unreadable") else "unknown"
    if "invalid" in installed["markers"].values():
        return "marker_invalid"
    record = _get_json(conn, K_INSTALLED)
    if record and record.get("digest") == installed["digest"] and "manual" not in installed["markers"].values():
        return "arx_managed"
    adoption = _get_json(conn, K_ADOPTION)
    if adoption and adoption.get("digest") == installed["digest"]:
        return "adopted"
    if "manual" in installed["markers"].values() or installed.get("profile") == wv.MANUAL_PROFILE:
        return "manual"
    if installed.get("known"):
        return "legacy"
    return "unknown"


def _plan(installed: dict[str, Any], bundle: dict[str, Any]) -> str:
    if bundle.get("state") != "ok":
        return "bundle_missing"
    current = None if installed.get("state") == "missing" else installed
    return wv.plan(current, bundle)


# ---------------------------------------------------------------- the view (secret-free, path-free)

def _config_dir() -> Path | None:
    from .bridge_install import ha_config_dir

    return ha_config_dir()


def _public_job(job: dict[str, Any] | None) -> dict[str, Any] | None:
    if not job:
        return None
    keep = ("id", "kind", "state", "code", "plan", "from_version", "to_version", "steps", "started_at", "finished_at", "core_gate",
            "risk_accepted", "storage_restored", "rollback_of", "origin")
    return {k: job.get(k) for k in keep}


def rollback_target(conn: Any, cfg: Path | None, installed: dict[str, Any]) -> dict[str, Any] | None:
    """The last finished forward run whose previous tree is still in its stage directory, while the installed tree is still exactly what
    that run installed. None = no owner rollback is possible."""
    job = _get_json(conn, K_JOB)
    if (cfg is None or not job or job.get("kind") not in ("install", "upgrade", "convert") or job.get("state") not in ("succeeded", "interrupted")
            or not JOB_ID_RE.match(str(job.get("id"))) or installed.get("digest") != job.get("to_digest")):
        return None
    if job.get("from_digest") and not (Path(cfg) / STAGE_ROOT / job["id"] / "previous").is_dir():
        return None
    return job


def view(conn: Any, settings: Any = None) -> dict[str, Any]:
    from . import wiskey_auto_install as wai

    cfg = _config_dir()
    bundle = bundle_info()
    installed = classify(cfg) if cfg is not None else {"state": "not_mapped", "markers": {}}
    own = ownership(conn, installed) if cfg is not None else "not_mapped"
    plan = _plan(installed, bundle) if cfg is not None else "not_mapped"
    job = _get_json(conn, K_JOB)
    adoption = _get_json(conn, K_ADOPTION)
    attempt = _get_json(conn, K_STARTUP_ATTEMPT)
    return {
        "switches": {"enabled": mode(conn, K_ENABLED), "core_risk": mode(conn, K_RISK), "startup": mode(conn, K_STARTUP)},
        "phrases": {"enabled": PHRASES[K_ENABLED], "core_risk": PHRASES[K_RISK], "startup": PHRASES[K_STARTUP], "adopt": ADOPT_PHRASE},
        "keep_runs": keep_runs(conn),
        "keep_runs_range": [KEEP_RUNS_MIN, KEEP_RUNS_MAX],
        "backup_max_age_h": BACKUP_MAX_AGE_S // 3600,
        "startup_attempt": {k: attempt.get(k) for k in ("digest", "job", "at")} if attempt else None,
        "bundle": {k: bundle.get(k) for k in ("state", "code", "version", "digest", "product_CODE", "files")},
        "installed": {"state": installed.get("state"), "ownership": own, "version": installed.get("version"),
                      "label": installed.get("label"), "digest": installed.get("digest"), "profile": installed.get("profile"),
                      "markers": installed.get("markers", {})},
        "plan": plan,
        "runnable": plan in wv.RUNNABLE and own in ("missing", "arx_managed", "adopted"),
        "adoptable": own in ("manual", "legacy"),
        "adoption": {k: adoption.get(k) for k in ("version", "label", "digest", "at", "backup")} if adoption else None,
        "job": _public_job(job),
        "running": bool(job and job.get("state") == "running"),
        "rollback_available": rollback_target(conn, cfg, installed) is not None and not (job and job.get("state") == "running"),
        "unattended_permitted": wai.owner_on_permitted(),
    }


# ---------------------------------------------------------------- the platform side (Supervisor + Core), a seam for tests

class SupervisorPlatform:
    """The real platform: Supervisor calls through `self_update` (the one allow-list), the Core API / socket through `ha_client`, the
    Core gate through `wiskey_core_runtime_gate`. Never raises for a network problem."""

    def __init__(self, settings: Any) -> None:
        self.settings = settings

    def configured(self) -> bool:
        from . import self_update

        return self_update.configured(self.settings)

    def core_api_up(self) -> bool:
        from . import ha_client

        try:
            ha_client.get_config(self.settings)
            return True
        except Exception:  # noqa: BLE001 - not answering = not up
            return False

    def stop_core(self) -> str:
        from . import self_update

        return self_update.call(self.settings, "POST", self_update.P_CORE_STOP, timeout=STOP_TIMEOUT_S).kind

    def start_core(self) -> str:
        from . import ha_sync, self_update

        try:
            ha_sync.note_restart_initiated()  # Arx's own link reconnects fast instead of backing off
        except Exception:  # noqa: BLE001
            pass
        return self_update.call(self.settings, "POST", self_update.P_CORE_START, timeout=START_TIMEOUT_S).kind

    def backups(self) -> list[dict[str, Any]] | None:
        from . import self_update

        reply = self_update.call(self.settings, "GET", self_update.P_BACKUPS)
        rows = (reply.data or {}).get("backups") if reply.kind == "ok" else None
        return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else None

    def core_gate(self) -> dict[str, Any]:
        from .wiskey_core_runtime_gate import read_core

        return read_core(self.settings)

    def snapshot(self) -> dict[str, Any] | None:
        from . import ha_client

        async def collect() -> dict[str, Any] | None:
            stop = asyncio.Event()
            out: dict[str, Any] = {}

            async def ready(call: Any) -> None:
                try:
                    out["entries"] = await call("config_entries/get", domain=DOMAIN)
                    out["devices"] = await call("config/device_registry/list")
                    out["entities"] = await call("config/entity_registry/list")
                finally:
                    stop.set()

            async with asyncio.timeout(45):
                await ha_client.ws_session(self.settings, ready, lambda _e: None, stop)
            if not all(isinstance(out.get(k), dict) and out[k].get("success") is True for k in ("entries", "devices", "entities")):
                return None
            return snapshot_from(out["entries"]["result"], out["devices"]["result"], out["entities"]["result"])

        try:
            return asyncio.run(collect())
        except Exception:  # noqa: BLE001
            return None


PLATFORM: Callable[[Any], Any] = SupervisorPlatform


def snapshot_from(entries: Any, devices: Any, entities: Any) -> dict[str, Any] | None:
    """The WisKey part of the registry: entries (id -> state), the devices of those entries, the entities of the domain. Pure."""
    if not all(isinstance(x, list) for x in (entries, devices, entities)):
        return None
    ids = {e["entry_id"]: str(e.get("state")) for e in entries if isinstance(e, dict) and e.get("domain", DOMAIN) == DOMAIN
           and isinstance(e.get("entry_id"), str)}
    devs = sorted(d["id"] for d in devices if isinstance(d, dict) and isinstance(d.get("id"), str)
                  and set(d.get("config_entries") or ()) & set(ids))
    ents = sorted([e["entity_id"], e.get("unique_id"), e.get("device_id")] for e in entities
                  if isinstance(e, dict) and isinstance(e.get("entity_id"), str) and (e.get("platform") == DOMAIN or e.get("config_entry_id") in ids))
    return {"entries": dict(sorted(ids.items())), "devices": devs, "entities": ents}


def compare_snapshots(before: dict[str, Any], after: dict[str, Any] | None) -> str | None:
    """None when `after` keeps everything of `before`; else the first closed difference."""
    if after is None:
        return "snapshot_unavailable"
    if set(after["entries"]) != set(before["entries"]):
        return "entries_changed"
    if any(state == "loaded" and after["entries"][eid] != "loaded" for eid, state in before["entries"].items()):
        return "entry_not_loaded"
    if after["devices"] != before["devices"]:
        return "devices_changed"
    if after["entities"] != before["entities"]:
        return "entities_changed"
    return None


# ---------------------------------------------------------------- file helpers (no link is ever followed)

def _inventory(path: Path) -> dict[str, str]:
    """{relative path: sha256} of a file or a directory tree; a link or a special file raises ValueError."""
    path = Path(path)
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode):
        raise ValueError("link_refused")
    if stat.S_ISREG(info.st_mode):
        return {".": hashlib.sha256(path.read_bytes()).hexdigest()}
    if not stat.S_ISDIR(info.st_mode):
        raise ValueError("special_file_refused")
    out: dict[str, str] = {}
    for p in sorted(path.rglob("*")):
        mode = p.lstat().st_mode
        if stat.S_ISLNK(mode):
            raise ValueError("link_refused")
        rel = p.relative_to(path).as_posix()
        if "__pycache__" in Path(rel).parts or p.suffix == ".pyc":
            continue
        if stat.S_ISREG(mode):
            out[rel] = hashlib.sha256(p.read_bytes()).hexdigest()
        elif not stat.S_ISDIR(mode):
            raise ValueError("special_file_refused")
    return out


def _copy(src: Path, dst: Path) -> None:
    if src.is_dir() and not src.is_symlink():
        shutil.copytree(src, dst, symlinks=True, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst, follow_symlinks=False)
    if _inventory(dst) != _inventory(src):
        raise ValueError("backup_verification_failed")


def _private_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(path, 0o700)
    except OSError:
        pass
    return path


def _backup_root(settings: Any) -> Path:
    return Path(settings.data_dir) / "wiskey-managed" / "backups"


def private_backup(settings: Any, cfg: Path, backup_id: str, *, with_storage: bool = True) -> dict[str, Any]:
    """Copy the component, both markers and (optionally) the registry + `hikvision_intercom.*` storage into the add-on's own data
    directory, verified file by file. Returns a receipt (names and counts, no content)."""
    root = _private_dir(_backup_root(settings) / backup_id)
    cfg = Path(cfg)
    receipt: dict[str, Any] = {"id": backup_id, "component": False, "markers": [], "storage": []}
    target = cfg / "custom_components" / DOMAIN
    if os.path.lexists(target):
        _copy(target, root / "component")
        receipt["component"] = True
    for name, path in ((COMPONENT_MARKER, target / COMPONENT_MARKER), (CONFIG_MARKER, cfg / CONFIG_MARKER)):
        if os.path.lexists(path):
            _copy(path, root / "markers" / name)
            receipt["markers"].append(name)
    storage = cfg / ".storage"
    if with_storage and storage.is_dir() and not storage.is_symlink():
        for p in sorted(storage.iterdir()):
            if p.name in REGISTRY_FILES or p.name.startswith(DOMAIN + "."):
                _copy(p, root / "storage" / p.name)
                receipt["storage"].append(p.name)
    (root / "RECEIPT.json").write_text(json.dumps(receipt, sort_keys=True), encoding="utf-8")
    return receipt


def _entry_schema(cfg: Path) -> dict[str, list[Any]] | None:
    """{entry_id: [version, minor_version]} of the WisKey entries in `.storage/core.config_entries` (read with Core stopped)."""
    try:
        doc = json.loads((Path(cfg) / ".storage" / "core.config_entries").read_text(encoding="utf-8"))
        return {e["entry_id"]: [e.get("version"), e.get("minor_version")] for e in doc["data"]["entries"] if e.get("domain") == DOMAIN}
    except (OSError, ValueError, KeyError, TypeError):
        return None


def _prune(settings: Any, cfg: Path, keep_ids: set[str], keep: int = KEEP_RUNS) -> None:
    """Keep the newest `keep` (the installation setting K_KEEP_RUNS, 1-10) stage directories and private backups (only names Arx
    created), and every id in `keep_ids`."""
    keep = keep if type(keep) is int and KEEP_RUNS_MIN <= keep <= KEEP_RUNS_MAX else KEEP_RUNS
    for root in (Path(cfg) / STAGE_ROOT, _backup_root(settings)):
        try:
            ids = sorted((p.name for p in root.iterdir() if p.is_dir() and not p.is_symlink() and JOB_ID_RE.match(p.name)), reverse=True)
        except OSError:
            continue
        for old in ids[keep:]:
            if old not in keep_ids:
                shutil.rmtree(root / old, ignore_errors=True)


def new_id() -> str:
    return dt.datetime.fromtimestamp(WALL(), dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + secrets.token_hex(3)


def _now_iso() -> str:
    return dt.datetime.fromtimestamp(WALL(), dt.timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------- adoption

def adopt(db: Any, settings: Any, confirm: Any, *, actor: Any = None, request_id: str | None = None) -> dict[str, Any]:
    """The owner's explicit conversion of a manual / recognised legacy install into "managed by Arx". Private backup, adoption record,
    one audit row. NOTHING in the config tree is changed: the markers leave with the next stopped-Core swap."""
    if not _phrase_ok(confirm, ADOPT_PHRASE):
        raise ManagedRefused("confirmation_required", 422)
    cfg = _config_dir()
    if cfg is None:
        raise ManagedRefused("ha_config_not_mapped")
    if not _RUN_LOCK.acquire(blocking=False):
        raise ManagedRefused("job_running")
    try:
        if not _read(db, enabled):
            raise ManagedRefused("managed_off")
        if (_read(db, lambda c: _get_json(c, K_JOB)) or {}).get("state") == "running":
            raise ManagedRefused("job_running")
        installed = classify(cfg)
        own = _read(db, lambda c: ownership(c, installed))
        if own == "adopted":
            raise ManagedRefused("already_adopted")
        if own == "marker_invalid":
            raise ManagedRefused("manual_marker_invalid")
        if own not in ("manual", "legacy") or not installed.get("known"):
            raise ManagedRefused("installed_tree_not_recognized", details={"ownership": own})
        backup_id = new_id()
        try:
            private_backup(settings, cfg, backup_id)
        except (OSError, ValueError) as exc:
            raise ManagedRefused("backup_failed", 409, {"error": type(exc).__name__}) from None
        if classify(cfg).get("digest") != installed["digest"]:
            raise ManagedRefused("installed_tree_changed")
        record = {"digest": installed["digest"], "version": installed["version"], "label": installed["label"],
                  "profile": installed["profile"], "product_CODE": installed["product_CODE"], "markers": installed["markers"],
                  "backup": backup_id, "at": _now_iso()}
        _write_json(db, K_ADOPTION, record)
        _audit(db, "wiskey.managed.adopt", "allowed", actor=actor, request_id=request_id,
               details={"version": record["version"], "label": record["label"], "digest": record["digest"], "backup": backup_id,
                        "markers": record["markers"], "config_written": False})
        return record
    finally:
        _RUN_LOCK.release()


# ---------------------------------------------------------------- checks (also the dry-run of the screen)

def _backup_verdict(rows: list[dict[str, Any]] | None, now: float) -> str | None:
    if rows is None:
        return "backups_unreadable"
    newest: float | None = None
    for r in rows:
        content = r.get("content") if isinstance(r.get("content"), dict) else {}
        if r.get("type") != "full" or content.get("homeassistant") is False:
            continue
        try:
            at = dt.datetime.fromisoformat(str(r.get("date")).replace("Z", "+00:00"))
        except ValueError:
            continue
        if at.tzinfo is None:
            continue
        newest = max(newest or 0.0, at.timestamp())
    if newest is None:
        return "full_backup_missing"
    if now - newest > BACKUP_MAX_AGE_S or newest - now > 300:
        return "full_backup_stale"
    return None


def gate_verdict(result: Any, risk_on: bool) -> tuple[str | None, str, bool]:
    """(refusal code or None, gate state, risk accepted?)."""
    state = result.get("state") if isinstance(result, dict) else None
    code = result.get("code") if isinstance(result, dict) and isinstance(result.get("code"), str) else "core_runtime_unavailable"
    if state == "supported":
        return None, "supported", False
    if state == CORE_RISK_STATE and code == CORE_RISK_CODE:
        return (None, state, True) if risk_on else ("core_gate_unverified", state, False)
    return code or "core_runtime_unavailable", str(state or "unavailable"), False


def preflight(db: Any, *, kind: str = "forward") -> dict[str, Any]:
    """The cheap synchronous checks (no network): switch, mapping, bundle, ownership, plan, space. Raises ManagedRefused."""
    cfg = _config_dir()
    if cfg is None:
        raise ManagedRefused("ha_config_not_mapped")
    with db.connection(mode="read", label="wiskey managed preflight") as conn:
        if not enabled(conn):
            raise ManagedRefused("managed_off")
        job = _get_json(conn, K_JOB)
        if job and job.get("state") == "running":
            raise ManagedRefused("job_running")
        installed = classify(cfg)
        own = ownership(conn, installed)
        if kind == "rollback":
            target = rollback_target(conn, cfg, installed)
            if target is None:
                raise ManagedRefused("rollback_unavailable")
            return {"cfg": cfg, "installed": installed, "ownership": own, "target": target}
    bundle = bundle_info()
    if bundle.get("state") != "ok":
        raise ManagedRefused("bundle_invalid", details={"code": bundle.get("code") or bundle.get("state")})
    if own not in ("missing", "arx_managed", "adopted"):
        raise ManagedRefused("adoption_required" if own in ("manual", "legacy") else "installed_tree_not_recognized", details={"ownership": own})
    plan = _plan(installed, bundle)
    if plan not in wv.RUNNABLE:
        raise ManagedRefused("plan_refused", details={"plan": plan})
    try:
        free = shutil.disk_usage(cfg).free
    except OSError:
        free = 0
    if free < SPACE_FACTOR * int(bundle.get("bytes") or 0):
        raise ManagedRefused("not_enough_space")
    return {"cfg": cfg, "installed": installed, "ownership": own, "bundle": bundle, "plan": plan}


def check(db: Any, settings: Any) -> dict[str, Any]:
    """The screen's dry run: every check a run would make before stopping anything, as a list. Reads only."""
    platform = PLATFORM(settings)
    items: list[dict[str, Any]] = []
    plan = None
    try:
        pre = preflight(db)
        plan = pre["plan"]
        items.append({"name": "preflight", "state": "pass", "code": None})
    except ManagedRefused as exc:
        items.append({"name": "preflight", "state": "fail", "code": exc.code, **({"plan": exc.details.get("plan")} if exc.details.get("plan") else {})})
    if not platform.configured():
        items.append({"name": "supervisor", "state": "fail", "code": "supervisor_unreachable"})
    else:
        risk_on = _read(db, lambda c: mode(c, K_RISK) == "on")
        refusal, state, accepted = gate_verdict(platform.core_gate(), risk_on)
        items.append({"name": "core_gate", "state": "fail" if refusal else ("warn" if accepted else "pass"), "code": refusal or (CORE_RISK_CODE if accepted else None)})
        verdict = _backup_verdict(platform.backups(), WALL())
        items.append({"name": "backup_check", "state": "fail" if verdict else "pass", "code": verdict})
    return {"plan": plan, "items": items, "ready": all(i["state"] != "fail" for i in items)}


# ---------------------------------------------------------------- the run

def _job_update(db: Any, job: dict[str, Any]) -> None:
    _write_json(db, K_JOB, job)


class _Run:
    def __init__(self, db: Any, settings: Any, job: dict[str, Any], platform: Any) -> None:
        self.db, self.settings, self.job, self.p = db, settings, job, platform

    # step bookkeeping
    def step(self, name: str) -> None:
        self.job["steps"].append({"name": name, "state": "running", "code": None, "at": _now_iso()})
        _job_update(self.db, self.job)

    def done(self, state: str = "done", code: str | None = None) -> None:
        self.job["steps"][-1].update(state=state, code=code)
        _job_update(self.db, self.job)

    def fail(self, code: str) -> None:
        self.done("failed", code)

    def finish(self, state: str, code: str | None = None) -> None:
        self.job.update(state=state, code=code, finished_at=_now_iso())
        _job_update(self.db, self.job)
        _audit(self.db, "wiskey.managed.run", "allowed" if state == "succeeded" else "denied", reason=code,
               details={"job": self.job["id"], "kind": self.job["kind"], "state": state, "from": self.job.get("from_version"),
                        "to": self.job.get("to_version"), "core_gate": self.job.get("core_gate"), "origin": self.job.get("origin", "owner"),
                        "risk_accepted": self.job.get("risk_accepted"), "storage_restored": self.job.get("storage_restored")})

    # platform waits
    def wait(self, cond: Callable[[], bool], deadline_s: float) -> bool:
        end = CLOCK() + deadline_s
        while True:
            if cond():
                return True
            if CLOCK() >= end:
                return False
            SLEEP(POLL_S)

    def stop_core(self) -> None:
        self.step("stop_core")
        kind = self.p.stop_core()
        if kind not in ("ok", "dropped"):
            self.fail("core_stop_refused")
            raise StepFailed("core_stop_refused")
        if not self.wait(lambda: not self.p.core_api_up(), STOP_CONFIRM_S):
            self.fail("core_did_not_stop")
            raise StepFailed("core_did_not_stop")
        self.done()

    def start_core(self, name: str = "start_core") -> bool:
        self.step(name)
        kind = self.p.start_core()
        if kind not in ("ok", "dropped", "unreachable") and not self.p.core_api_up():
            self.fail("core_start_refused")
            return False
        if not self.wait(self.p.core_api_up, START_DEADLINE_S):
            self.fail("core_did_not_start")
            return False
        self.done()
        return True

    def verify(self, before: dict[str, Any], name: str = "verify") -> bool:
        self.step(name)
        last: list[str | None] = ["snapshot_unavailable"]

        def ok() -> bool:
            last[0] = compare_snapshots(before, self.p.snapshot())
            return last[0] is None

        if self.wait(ok, SETTLE_DEADLINE_S):
            self.done()
            return True
        self.fail(last[0] or "verify_failed")
        return False


def _stage(cfg: Path, job_id: str) -> Path:
    return Path(cfg) / STAGE_ROOT / job_id


def _swap(cfg: Path, job_id: str, source: Path, expect_from: str | None, expect_to: str) -> None:
    """Core is stopped. Candidate copied and verified, previous tree kept in the stage, config marker moved into the stage. Raises
    StepFailed after putting everything back."""
    target = Path(cfg) / "custom_components" / DOMAIN
    stage = _private_dir(_stage(cfg, job_id))
    current = classify(cfg)
    if (current.get("digest") if current.get("state") == "present" else None) != expect_from:
        raise StepFailed("installed_tree_changed")
    candidate = stage / "candidate"
    shutil.copytree(source, candidate, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"))
    if tree_digest(candidate) != expect_to:
        shutil.rmtree(candidate, ignore_errors=True)
        raise StepFailed("candidate_verification_failed")
    (Path(cfg) / "custom_components").mkdir(exist_ok=True)
    previous = stage / "previous"
    if expect_from is not None:
        target.rename(previous)
    try:
        candidate.rename(target)
    except OSError:
        if previous.exists():
            previous.rename(target)
        raise StepFailed("swap_failed") from None
    try:
        if tree_digest(target) != expect_to:
            raise ValueError("installed_verification_failed")
    except ValueError:
        target.rename(stage / "failed_candidate")
        if previous.exists():
            previous.rename(target)
        raise StepFailed("installed_verification_failed") from None
    marker = Path(cfg) / CONFIG_MARKER
    if os.path.lexists(marker):
        _private_dir(stage / "markers")
        os.replace(marker, stage / "markers" / CONFIG_MARKER)


def _restore(settings: Any, cfg: Path, stage_id: str, backup_id: str | None, expect_from: str | None, restore_storage: bool) -> None:
    """Core is stopped. Put the stage's previous tree back (or remove a fresh install), the config marker back, and - only when asked -
    the registry + WisKey storage from the private backup. Raises StepFailed when the result is not the expected tree."""
    target = Path(cfg) / "custom_components" / DOMAIN
    stage = _stage(cfg, stage_id)
    aside = stage / ("failed_candidate" if not (stage / "failed_candidate").exists() else "failed_candidate." + secrets.token_hex(3))
    previous = stage / "previous"
    if expect_from is not None and not previous.is_dir():
        raise StepFailed("previous_tree_missing")
    if os.path.lexists(target):
        target.rename(aside)
    if expect_from is not None:
        previous.rename(target)
    marker = stage / "markers" / CONFIG_MARKER
    if os.path.lexists(marker):
        os.replace(marker, Path(cfg) / CONFIG_MARKER)
    if restore_storage and backup_id:
        src = _backup_root(settings) / backup_id / "storage"
        for p in sorted(src.iterdir()) if src.is_dir() else ():
            dst = Path(cfg) / ".storage" / p.name
            if dst.is_dir() and not dst.is_symlink():
                shutil.rmtree(dst)
            _copy(p, dst) if p.is_dir() else shutil.copy2(p, dst)
    now = classify(cfg)
    if (now.get("digest") if now.get("state") == "present" else None) != expect_from:
        raise StepFailed("rollback_verification_failed")


def start(db: Any, settings: Any, kind: str, *, actor: Any = None, request_id: str | None = None, origin: str = "owner") -> dict[str, Any]:
    """Start one run (`forward` = install / upgrade / convert by plan, or `rollback`). The cheap checks run here (409 at once); the rest
    are steps of the job. `origin` is `owner` (a request) or `startup` (`startup_reconcile`: forward only, strict Core gate; the attempt is
    recorded before the worker starts). Returns the public job."""
    if origin not in ("owner", "startup") or (origin == "startup" and kind != "forward"):
        raise ManagedRefused("validation", 422)
    if not _RUN_LOCK.acquire(blocking=False):
        raise ManagedRefused("job_running")
    try:
        pre = preflight(db, kind=kind)
        job_id = new_id()
        if kind == "rollback":
            t = pre["target"]
            job = {"id": job_id, "kind": "rollback", "plan": "rollback", "rollback_of": t["id"], "state": "running", "code": None,
                   "from_version": t.get("to_version"), "from_digest": t.get("to_digest"), "to_version": t.get("from_version"),
                   "to_digest": t.get("from_digest"), "prior_installed": t.get("prior_installed"), "steps": [], "started_at": _now_iso(),
                   "finished_at": None, "core_gate": None, "risk_accepted": False, "storage_restored": False}
        else:
            installed, bundle = pre["installed"], pre["bundle"]
            job = {"id": job_id, "kind": pre["plan"], "plan": pre["plan"], "rollback_of": None, "state": "running", "code": None,
                   "from_version": installed.get("version"), "from_digest": installed.get("digest") if installed.get("state") == "present" else None,
                   "to_version": bundle["version"], "to_digest": bundle["digest"],
                   "prior_installed": _read(db, lambda c: _get_json(c, K_INSTALLED)), "steps": [], "started_at": _now_iso(),
                   "finished_at": None, "core_gate": None, "risk_accepted": False, "storage_restored": False}
        job["origin"] = origin
        _job_update(db, job)
        if origin == "startup":  # recorded BEFORE the worker starts: a crash mid-run still counts as this bundle's attempt
            _write_json(db, K_STARTUP_ATTEMPT, {"digest": job["to_digest"], "job": job_id, "at": _now_iso()})
        _audit(db, "wiskey.managed.run_started", "allowed", actor=actor, request_id=request_id,
               details={"job": job_id, "kind": job["kind"], "from": job["from_version"], "to": job["to_version"], "origin": origin})
    except BaseException:
        _RUN_LOCK.release()
        raise

    def body() -> None:
        try:
            run(db, settings, job, pre["cfg"])
        except Exception as exc:  # noqa: BLE001 - never leave the record "running"
            log.warning("wiskey managed run crashed (%s)", type(exc).__name__)
            if job.get("state") == "running":
                job.update(state="failed", code="run_crashed", finished_at=_now_iso())
                _job_update(db, job)
        finally:
            _RUN_LOCK.release()

    SPAWN(body)
    return _public_job(job) or {}


def run(db: Any, settings: Any, job: dict[str, Any], cfg: Path) -> None:
    r = _Run(db, settings, job, PLATFORM(settings))
    rollback = job["kind"] == "rollback"
    stage_id = job["rollback_of"] if rollback else job["id"]

    # 1-3: checks that stop nothing
    r.step("preflight")
    if not r.p.configured():
        r.fail("supervisor_unreachable")
        return r.finish("aborted", "supervisor_unreachable")
    if not r.p.core_api_up():
        r.fail("core_not_running")
        return r.finish("aborted", "core_not_running")
    r.done()
    if not rollback:  # a rollback restores a tree that ran here before: no gate, no fresh full backup needed (it is the way back)
        r.step("core_gate")
        # a start-up run takes the gate strictly: only `supported` passes; the accepted-risk switch covers owner-started runs only
        risk_on = job.get("origin", "owner") == "owner" and _read(db, lambda c: mode(c, K_RISK) == "on")
        refusal, state, accepted = gate_verdict(r.p.core_gate(), risk_on)
        job.update(core_gate=state, risk_accepted=accepted)
        if refusal:
            r.fail(refusal)
            return r.finish("aborted", refusal)
        r.done("done", CORE_RISK_CODE if accepted else None)
        r.step("backup_check")
        verdict = _backup_verdict(r.p.backups(), WALL())
        if verdict:
            r.fail(verdict)
            return r.finish("aborted", verdict)
        r.done()
    r.step("snapshot_before")
    before = r.p.snapshot()
    if before is None:
        r.fail("snapshot_unavailable")
        return r.finish("aborted", "snapshot_unavailable")
    r.done()

    # 4-6: Core stopped from here on
    try:
        r.stop_core()
    except StepFailed as exc:
        return r.finish("aborted", exc.code)  # Core was not (verifiably) stopped: nothing else is done
    r.step("backup_local")
    schema_before = _entry_schema(cfg)
    try:
        private_backup(settings, cfg, job["id"])
    except (OSError, ValueError):
        r.fail("backup_failed")
        r.start_core()
        return r.finish("aborted", "backup_failed")
    r.done()
    r.step("swap")
    try:
        if rollback:
            _restore(settings, cfg, stage_id, None, job["to_digest"], False)
        else:
            source = bundle_source()
            if source is None or bundle_info(source).get("digest") != job["to_digest"]:
                raise StepFailed("bundle_changed")
            _swap(cfg, job["id"], source, job["from_digest"], job["to_digest"])
    except StepFailed as exc:
        r.fail(exc.code)
        r.start_core()
        return r.finish("aborted", exc.code)
    except OSError:
        r.fail("swap_failed")
        r.start_core()
        return r.finish("aborted", "swap_failed")
    r.done()

    # 7-8: start and compare
    if r.start_core() and r.verify(before):
        if rollback:
            _write_json(db, K_INSTALLED, job.get("prior_installed"))
        else:
            _write_json(db, K_INSTALLED, {"digest": job["to_digest"], "version": job["to_version"], "job": job["id"], "at": _now_iso()})
            _prune(settings, cfg, {job["id"]}, _read(db, keep_runs))
        return r.finish("succeeded")

    # automatic rollback
    failure = job["steps"][-1].get("code") or "verify_failed"
    try:
        r.stop_core()
    except StepFailed:
        return r.finish("rollback_failed", failure)
    r.step("rollback")
    schema_after = _entry_schema(cfg)
    restore_storage = schema_after is not None and schema_before is not None and schema_after != schema_before
    try:
        if rollback:
            # rolling a rollback back: the tree that was installed when this rollback started is in the private backup
            _restore_from_backup(settings, cfg, job["id"], stage_id, job["from_digest"])
        else:
            _restore(settings, cfg, job["id"], job["id"], job["from_digest"], restore_storage)
        job["storage_restored"] = bool(restore_storage and not rollback)
    except (StepFailed, OSError, ValueError) as exc:
        r.fail(getattr(exc, "code", "rollback_restore_failed"))
        r.start_core("start_core_after_rollback")
        return r.finish("rollback_failed", failure)
    r.done()
    if r.start_core("start_core_after_rollback") and r.verify(before, "verify_after_rollback"):
        return r.finish("rolled_back", failure)
    return r.finish("rollback_failed", failure)


def _restore_from_backup(settings: Any, cfg: Path, backup_id: str, stage_id: str, expect: str | None) -> None:
    """Undo a failed owner rollback (Core stopped): the tree installed when it started comes back from its private backup, and the
    config marker the rollback put back returns to the forward run's stage when that tree had none."""
    target = Path(cfg) / "custom_components" / DOMAIN
    backup = _backup_root(settings) / backup_id
    aside = _private_dir(_stage(cfg, backup_id)) / "failed_candidate"
    if os.path.lexists(target):
        target.rename(aside)
    if (backup / "component").is_dir():
        shutil.copytree(backup / "component", target)
    marker = Path(cfg) / CONFIG_MARKER
    if os.path.lexists(marker) and not os.path.lexists(backup / "markers" / CONFIG_MARKER):
        os.replace(marker, _private_dir(_stage(cfg, stage_id) / "markers") / CONFIG_MARKER)
    now = classify(cfg)
    if (now.get("digest") if now.get("state") == "present" else None) != expect:
        raise StepFailed("rollback_verification_failed")


# ---------------------------------------------------------------- start-up recovery

def recover_interrupted(db: Any, settings: Any) -> str | None:
    """An Arx restart while a run was active: mark it `interrupted`; put the previous tree back if the target is missing; start Core if
    it is not answering. Never swaps forward. Returns the outcome or None (nothing to recover)."""
    job = _read(db, lambda c: _get_json(c, K_JOB))
    if not job or job.get("state") != "running" or not JOB_ID_RE.match(str(job.get("id"))):
        return None
    cfg = _config_dir()
    actions: list[str] = []
    if cfg is not None:
        target = Path(cfg) / "custom_components" / DOMAIN
        stage_id = job.get("rollback_of") if job.get("kind") == "rollback" else job["id"]
        previous = _stage(cfg, str(stage_id)) / "previous"
        if not os.path.lexists(target) and previous.is_dir():
            try:
                previous.rename(target)
                actions.append("previous_restored")
            except OSError:
                actions.append("previous_restore_failed")
    platform = PLATFORM(settings)
    try:
        if platform.configured() and not platform.core_api_up():
            actions.append("core_started" if platform.start_core() in ("ok", "dropped") else "core_start_refused")
    except Exception:  # noqa: BLE001
        actions.append("core_start_failed")
    job.update(state="interrupted", code="arx_restarted", finished_at=_now_iso())
    _job_update(db, job)
    _audit(db, "wiskey.managed.run", "denied", reason="arx_restarted", details={"job": job["id"], "kind": job.get("kind"), "actions": actions})
    return "interrupted"


def recover_interrupted_safe(db: Any, settings: Any) -> None:
    try:
        recover_interrupted(db, settings)
    except Exception as exc:  # noqa: BLE001 - start-up must not fail
        log.warning("wiskey managed recovery failed (%s)", type(exc).__name__)


# ---------------------------------------------------------------- start-up reconcile (owner decision 04.11, round 18 Q3 = B)

AUDIT_STARTUP = "wiskey.managed.startup"


def _retry_allowed(attempt: dict[str, Any], job: dict[str, Any] | None) -> bool:
    """A start-up attempt for the same bundle may be repeated only when it ended `aborted` before Core was ever asked to stop (the
    checks refused: nothing on the box was touched) - never after a stop, a swap, a rollback, an interruption or a success."""
    if not job or job.get("id") != attempt.get("job") or job.get("state") != "aborted":
        return False
    return not any(isinstance(s, dict) and s.get("name") == "stop_core" for s in job.get("steps") or ())


def _audit_startup(db: Any, decision: str, reason: str | None, details: dict[str, Any]) -> None:
    """One `wiskey.managed.startup` row per NEW outcome (the same reason and details as the latest row are not repeated at every start)."""
    from ..audit import audit

    def write(c: Any) -> None:
        last = c.execute("SELECT reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid DESC LIMIT 1", (AUDIT_STARTUP,)).fetchone()
        if last is not None and last[0] == reason and json.loads(last[1] or "{}") == details:
            return
        audit(c, actor=None, action=AUDIT_STARTUP, decision=decision, resource_type="installation", resource_id=DOMAIN, reason=reason,
              details=details)

    try:
        with db.write_aside(label="wiskey managed startup audit") as c:
            write(c)
    except Exception as exc:  # noqa: BLE001 - the audit never blocks the start-up
        log.warning("wiskey managed start-up audit unavailable (%s)", type(exc).__name__)


def _closed(details: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in details.items() if k in ("plan", "ownership", "code")}


def startup_reconcile(db: Any, settings: Any) -> str:
    """At add-on start-up (after `recover_interrupted`): start ONE forward run by itself when, and only when,
    - the managed switch AND the start-up switch are ON (both owner steps with the typed phrase; missing / unreadable = off);
    - the installed tree is one a run may replace WITHOUT an owner step (missing, Arx-managed, or already adopted by the owner - a manual
      install still needs the owner's adoption) and the plan is install / upgrade / convert (never a downgrade); the shipped bundle is
      byte-exact to its pin; there is room;
    - this bundle digest was not already attempted at start-up (see `_retry_allowed`);
    - the core API answers within STARTUP_CORE_WAIT_S.
    The run itself is the owner path's run (`start(..., origin="startup")`): strict Core gate, full backup <= 24 h, private backup,
    stop / swap / start / compare, automatic rollback. Returns a closed outcome; every refusal but "off" / "up_to_date" /
    "already_attempted" is audited once. Never raises."""
    try:
        on, startup_on, attempt, job = _read(db, lambda c: (enabled(c), mode(c, K_STARTUP) == "on", _get_json(c, K_STARTUP_ATTEMPT),
                                                             _get_json(c, K_JOB)))
    except Exception:  # noqa: BLE001 - an unreadable database is "off"
        return "off"
    if not (on and startup_on):
        return "off"
    bundle = bundle_info()
    if attempt and bundle.get("state") == "ok" and attempt.get("digest") == bundle.get("digest") and not _retry_allowed(attempt, job):
        return "already_attempted"
    try:
        pre = preflight(db)
    except ManagedRefused as exc:
        if exc.code == "plan_refused" and exc.details.get("plan") == "up_to_date":
            return "up_to_date"
        _audit_startup(db, "denied", exc.code, _closed(exc.details))
        return exc.code
    platform = PLATFORM(settings)
    try:
        if not platform.configured():
            _audit_startup(db, "denied", "supervisor_unreachable", {})
            return "supervisor_unreachable"
        end = CLOCK() + STARTUP_CORE_WAIT_S
        while not platform.core_api_up():
            if CLOCK() >= end:
                _audit_startup(db, "denied", "core_not_running", {})
                return "core_not_running"
            SLEEP(POLL_S)
    except Exception:  # noqa: BLE001
        _audit_startup(db, "denied", "platform_unavailable", {})
        return "platform_unavailable"
    try:
        started = start(db, settings, "forward", origin="startup")
    except ManagedRefused as exc:
        _audit_startup(db, "denied", exc.code, _closed(exc.details))
        return exc.code
    _audit_startup(db, "allowed", None, {"job": started.get("id"), "plan": pre["plan"], "from": started.get("from_version"),
                                         "to": started.get("to_version")})
    return "started"


def startup_safe(db: Any, settings: Any) -> None:
    """The add-on start-up thread: recover an interrupted run first, then the start-up reconcile. Never raises."""
    recover_interrupted_safe(db, settings)
    try:
        startup_reconcile(db, settings)
    except Exception as exc:  # noqa: BLE001 - start-up must not fail
        log.warning("wiskey managed start-up reconcile failed (%s)", type(exc).__name__)
