"""Camera discovery scans (ONVIF-DISCOVER-2500): the scan job, the one-attempt credential rule, the known-device marks, the limits,
RBAC and the audit. Design docs/design/onvif-discovery-2412/DESIGN.md sections 4, 8, 9, 13 (owner decisions 2026-11-22) and 14.

Owner decisions applied here:
- Q55: the only engine is the unicast sweep (services/camera_discovery/sweep.py); go2rtc and the bridge are not engines in phase 1.
- Q56: a scan covers only the site's own network, at most 1,024 addresses (services/camera_discovery/ranges.py).
- Q57: the same user and password may be used for all selected cameras - ONE attempt per camera per press, never an automatic retry,
  never a list of default passwords. A camera that refused a user / password pair is not sent that same pair again in this scan; at
  most GUARD_FAILURES refused attempts per camera address in GUARD_WINDOW_S (across scans), then it is "stopped so the camera does
  not lock" (`locked_guard`) without being contacted; at most one authenticated request in flight per camera.
- Q58: a camera already coming through a recorder is marked `behind_recorder` and is not `addable`; one already added without a
  recorder is `standalone`. Neither is ever sent the password.
- Q59: a device that looks like a recorder has kind `nvr` (the recorder wizard offers "add as a recorder"); it is not `addable` as a
  camera and is not sent the camera password.
- Q60: no periodic scan, no notice: a scan starts only from `start_scan` (an administrator's press).
- Q61: nothing is ever written to a recorder (no channel add), a camera, or go2rtc. Nothing is saved: the job lives in memory for
  `cameras.discovery_job_ttl_min` after its last use (a restart drops it); the credentials typed for it live only inside it.

Who may scan: `system.configure` at the installation (design section 7: the permission of the recorder connection and of the cameras
without a recorder), checked by every entry point (rbac.require: a refusal is the audited 403). A job is seen, identified and
cancelled by the administrator who started it or by a system administrator.

Limits: one running scan per installation; SCANS_PER_HOUR_INSTALL scans an hour per installation and SCANS_PER_10MIN_USER per
person (design D5); IDENTIFY_PER_10MIN_USER identification presses per person; the sweep's own pacing and deadline.

Audit (never a password, a user name, a full URL, a serial or a MAC): `camera.discovery.scan` - one row per scan, written when it
starts (range, number of addresses, engines) and completed in place when it ends (state, counts, duration); refused starts are
`denied` rows with the reason. `camera.discovery.identify` - one row per press (device count, results by class, same_for_all).
`camera.discovery.cancel`.

The routes (routers/camera_discovery.py), the wire models and the settings registration are the ONVIF-API row (ONVIF-API-2500).
ONVIF-CLIENT-2500: the identifier is the fuller client (onvif_client.py: HTTP Digest once per press when the camera asks for it, the
media profiles and stream addresses), the add step (`add`, `camera.discovery.add`: camera ids and refusal codes) and the preview
(`preview_source`, for `POST /cameras/source/test`). A refusal about request fields names them (ADR-019 D1: `details.fields`
and `details.problems`, FIELDS_OF); a 429 is retryable and carries `retry_after_s` (the route adds the Retry-After header)."""
from __future__ import annotations

import collections
import hashlib
import hmac
import json
import logging
import secrets
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

from ...audit import audit
from ...config import Settings
from ...db import Database, database_of, get_setting, now_iso, unlocked
from ...errors import ApiError
from ...rbac import INSTALLATION, Principal, is_system_admin, require
from ...test_reset import register_reset
from ..tickets.ratelimit import ScopedRateLimiter
from .. import source_policy
from . import known, onvif_client, onvif_http, ranges, sweep, wsd

log = logging.getLogger("smplwise.camera_discovery")

PERMISSION = "system.configure"
ENGINES = ("unicast",)  # Q55

# settings (registered in services/settings_store.DEFAULTS and validated by PATCH /settings - ONVIF-API-2500; read here with their
# defaults and clamped, so a value stored before the validation existed is still safe)
K_MODE = "cameras.discovery"  # off | manual
K_RANGE_MAX = "cameras.discovery_range_max"  # a prefix length (/20../28) - never more than ranges.MAX_ADDRESSES addresses
K_ALLOWED = "cameras.discovery_allowed_ranges"  # csv CIDRs; empty = the site networks
K_RATE = "cameras.discovery_rate_pps"  # 10..200
K_HTTP = "cameras.discovery_http_fallback"  # on | off
K_TTL = "cameras.discovery_job_ttl_min"  # 5..60
DEFAULTS = {K_MODE: "manual", K_RANGE_MAX: "/22", K_ALLOWED: "", K_RATE: "50", K_HTTP: "off", K_TTL: "15"}

SCANS_PER_HOUR_INSTALL = 6
SCANS_PER_10MIN_USER = 3
IDENTIFY_PER_10MIN_USER = 20
GUARD_FAILURES = 3
GUARD_WINDOW_S = 15 * 60.0
IDENTIFY_WORKERS = 4
MAX_IDENTIFY_DEVICES = 64
MAX_DEVICES = 2048
JOB_MAX_AGE_S = 60 * 60.0
SCAN_DEADLINE_S = 10 * 60.0

_SCAN_LIMITS_INSTALL = ((3600.0, SCANS_PER_HOUR_INSTALL),)
_SCAN_LIMITS_USER = ((600.0, SCANS_PER_10MIN_USER),)
_IDENTIFY_LIMITS = ((600.0, IDENTIFY_PER_10MIN_USER),)
_GUARD_LIMITS = ((GUARD_WINDOW_S, GUARD_FAILURES),)

MSG = {
    "discovery_off": "חיפוש מצלמות ברשת כבוי בהגדרות.",
    "scan_running": "חיפוש מצלמות כבר פועל. המתינו לסיומו או עצרו אותו.",
    "range_invalid": "טווח הכתובות אינו תקין.",
    "range_too_large": "הטווח גדול מדי: אפשר לחפש עד 1,024 כתובות בכל פעם.",
    "range_refused": "אפשר לחפש רק ברשת של האתר עצמו.",
    "site_network_unknown": "לא ניתן לזהות את רשת האתר, ולכן אי אפשר לחפש מצלמות.",
    "rate_limited": "יותר מדי חיפושים ברצף; נסו שוב מאוחר יותר.",
    "scan_not_found": "החיפוש הסתיים או אינו קיים. התחילו חיפוש חדש.",
    "scan_not_active": "החיפוש נעצר. התחילו חיפוש חדש.",
    "device_unknown": "אחד המכשירים שנבחרו אינו ברשימת החיפוש.",
    "credentials_invalid": "יש להזין שם משתמש וסיסמה.",
    "same_for_all_required": "כדי לנסות כמה מצלמות בבת אחת יש לבחור 'אותו משתמש וסיסמה לכולן'.",
}


# ADR-019 D1 (ONVIF-API-2500): a refusal about request fields names them - `details.fields` (names) and `details.problems`
# ([{field, code, message}], `code` = the refusal's own code) - next to its endpoint extras (`max_addresses`, `retry_after_s`)
FIELDS_OF: dict[str, tuple[str, ...]] = {
    "range_invalid": ("range",),
    "range_too_large": ("range",),
    "range_refused": ("range",),
    "device_unknown": ("device_ids",),
    "same_for_all_required": ("same_for_all",),
}


def _error(status: int, code: str, *, fields: tuple[str, ...] | None = None, **details: Any) -> ApiError:
    message = MSG.get(code, MSG["range_invalid"])
    names = list(fields if fields is not None else FIELDS_OF.get(code, ()))
    if names:
        details = {"fields": names, "problems": [{"field": f, "code": code, "message": message} for f in names], **details}
    return ApiError(status, code, message, retryable=status == 429, details=details or None)


# ---------------------------------------------------------------- the policy (settings)

@dataclass(frozen=True)
class Policy:
    mode: str
    max_addresses: int
    allowed: tuple[Any, ...]
    rate_pps: int
    http_fallback: bool
    job_ttl_s: float


def _int(raw: Any, default: int, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(str(raw).strip().lstrip("/"))))
    except (TypeError, ValueError):
        return default


def policy(conn: sqlite3.Connection) -> Policy:
    def raw(key: str) -> Any:
        value = get_setting(conn, key)
        return DEFAULTS[key] if value is None else value

    mode = str(raw(K_MODE)).strip().lower()
    prefix = _int(raw(K_RANGE_MAX), 22, ranges.MIN_PREFIX, 28)
    return Policy(
        mode=mode if mode in ("off", "manual") else "manual",
        max_addresses=min(ranges.MAX_ADDRESSES, 2 ** (32 - prefix)),
        allowed=tuple(ranges.parse_allowed(raw(K_ALLOWED))),
        rate_pps=_int(raw(K_RATE), 50, 10, 200),
        http_fallback=str(raw(K_HTTP)).strip().lower() in ("on", "true", "1"),
        job_ttl_s=60.0 * _int(raw(K_TTL), 15, 5, 60),
    )


# ---------------------------------------------------------------- identification (the ONVIF-CLIENT row plugs in here)

class Identifier(Protocol):
    """`clock`: the device clock, no credentials. `information`: ONE press of one camera - the credential attempt and, after `ok`,
    the reads that make it a video source. Every request the camera refuses is reported to `guard.refused()`, and `guard.allow()`
    is asked before any credential request after the first (ONVIF-CLIENT-2500: the one HTTP Digest answer of a press)."""

    def clock(self, target: onvif_http.Target) -> onvif_http.Clock | None: ...

    def information(self, target: onvif_http.Target, username: str, password: str, offset_s: float | None,
                    guard: onvif_client.Guard) -> onvif_http.DeviceInfo: ...


# ONVIF-CLIENT-2500: GetSystemDateAndTime, ONE GetDeviceInformation (PasswordDigest; HTTP Digest once when the camera asks for it),
# then GetServices / GetCapabilities, Media2 / Media1 GetProfiles + GetStreamUri, GetSnapshotUri
OnvifIdentifier = onvif_client.OnvifClient


class _DeviceGuard:
    """The lockout guard of one camera address, as the client sees it (GUARD_FAILURES refusals in GUARD_WINDOW_S, across scans)."""

    def __init__(self, limiter: ScopedRateLimiter, key: str) -> None:
        self.limiter, self.key = limiter, key

    def allow(self) -> bool:
        return self.limiter.check(self.key, _GUARD_LIMITS) <= 0

    def refused(self) -> None:
        self.limiter.record(self.key, _GUARD_LIMITS)


# ---------------------------------------------------------------- the job

@dataclass
class Device:
    id: str
    address: str
    port: int | None
    engines: list[str]
    kind: str
    known: str
    known_ref: str | None
    types: tuple[str, ...] = ()
    scope_types: tuple[str, ...] = ()
    manufacturer: str | None = None
    model: str | None = None
    name: str | None = None
    firmware: str | None = None
    clock_offset_s: float | None = None
    auth: str = "not_tried"
    attempts: int = 0
    target: onvif_http.Target | None = field(default=None, repr=False)
    endpoint: str | None = field(default=None, repr=False)
    creds: tuple[str, str] | None = field(default=None, repr=False)
    refused: set[str] = field(default_factory=set, repr=False)  # keyed digests of user / password pairs this device refused
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    # ONVIF-CLIENT-2500: what the media reads of the last successful press found (cleared with the credentials)
    media: str = "none"  # media2 | media | none
    auth_mode: str | None = None  # wsse | digest
    profiles: list[onvif_client.Profile] = field(default_factory=list, repr=False)
    snapshot_uri: str | None = field(default=None, repr=False)
    fingerprint: str | None = field(default=None, repr=False)  # the keyed standalone fingerprint (no serial is kept)

    @property
    def addable(self) -> bool:
        """Q58 / Q59: never a recorder, never a camera Arx already has (alone or through a recorder)."""
        return self.kind != "nvr" and self.known == "none" and self.target is not None

    def suggested(self) -> dict[str, str | None]:
        main, sub = onvif_client.suggest(self.profiles)
        return {"main": main.token if main else None, "sub": sub.token if sub else None}

    def forget(self) -> None:
        """The typed credentials and what was read with them (cancel, expiry, a refused press, an added camera)."""
        self.creds = None
        self.profiles = []
        self.snapshot_uri = None
        self.media, self.auth_mode = "none", None

    def view(self) -> dict[str, Any]:
        return {"id": self.id, "address": self.address, "port": self.port, "engines": list(self.engines), "kind": self.kind, "known": self.known,
                **({"known_ref": self.known_ref} if self.known_ref else {}), "addable": self.addable, "manufacturer": self.manufacturer,
                "model": self.model, "name": self.name, "firmware": self.firmware, "clock_offset_s": self.clock_offset_s, "auth": self.auth,
                "has_service": self.target is not None, **({"recorder_prefill": self.recorder_prefill()} if self.offer_recorder else {}),
                "media": self.media, **({"auth_mode": self.auth_mode} if self.auth_mode else {}), "profiles": [p.view() for p in self.profiles],
                "suggested": self.suggested(), "snapshot": self.snapshot_uri is not None}

    @property
    def offer_recorder(self) -> bool:
        """Q59: a device that looks like a recorder and is not this installation's recorder already - "add as a recorder"."""
        return self.kind == "nvr" and self.known not in ("recorder", "behind_recorder")

    def recorder_prefill(self) -> dict[str, Any]:
        """What the recorder wizard is opened with (ONVIF-API-2500): the address and the HTTP port that answered, the vendor when
        the device says it is one Arx has an adapter for, a suggested name. Never a credential: the wizard asks for them."""
        maker = (self.manufacturer or "").strip().lower()
        name = " ".join(x for x in (self.manufacturer, self.model) if x) or None
        return {"host": self.address, "http_port": self.port or 80, **({"vendor": "hikvision"} if maker.startswith("hikvision") else {}),
                **({"name": name[:80]} if name else {})}


@dataclass
class Job:
    id: str
    owner_id: str
    range: str
    total: int
    engines: tuple[str, ...]
    started_at: str
    started_mono: float
    key: bytes = field(repr=False)
    state: str = "running"  # running | done | cancelled | failed
    checked: int = 0
    finished_at: str | None = None
    touched_mono: float = 0.0
    devices: dict[str, Device] = field(default_factory=dict)
    by_key: dict[str, str] = field(default_factory=dict, repr=False)
    overflow: int = 0
    audit_row: int | None = None
    cancel: threading.Event = field(default_factory=threading.Event, repr=False)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    snap: known.Snapshot | None = field(default=None, repr=False)
    stats: sweep.Stats | None = field(default=None, repr=False)
    ttl_s: float = 15 * 60.0

    def counts(self) -> dict[str, int]:
        devs = list(self.devices.values())
        return {"found": len(devs), "cameras": sum(d.kind == "camera" for d in devs), "recorders": sum(d.kind == "nvr" for d in devs),
                "unknown": sum(d.kind == "unknown" for d in devs), "known": sum(d.known != "none" for d in devs),
                "addable": sum(d.addable for d in devs)}

    def summary(self) -> dict[str, Any]:
        with self.lock:
            return {"id": self.id, "state": self.state, "range": self.range, "engines": list(self.engines), "started_at": self.started_at,
                    "finished_at": self.finished_at, "progress": {"checked": self.checked, "total": self.total}, "counts": self.counts()}

    def view(self) -> dict[str, Any]:
        with self.lock:
            devices = sorted(self.devices.values(), key=lambda d: tuple(int(p) for p in d.address.split(".")) if d.address.count(".") == 3 else (999,))
            return {"id": self.id, "state": self.state, "range": self.range, "engines": list(self.engines), "started_at": self.started_at,
                    "finished_at": self.finished_at, "progress": {"checked": self.checked, "total": self.total}, "counts": self.counts(),
                    "devices": [d.view() for d in devices]}

    def wipe(self) -> None:
        """Forget every typed credential of the job (expiry, cancel)."""
        with self.lock:
            for d in self.devices.values():
                d.forget()
                d.refused.clear()


def _digest(key: bytes, *parts: str) -> str:
    return hmac.new(key, "\x00".join(parts).encode("utf-8"), hashlib.sha256).hexdigest()[:24]


class Manager:
    """The process's scan jobs (memory only). Seams for tests: `transport_factory`, `identifier`, `run_inline`, `clock`."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._jobs: dict[str, Job] = {}
        self.clock: Callable[[], float] = time.monotonic
        self.transport_factory: Callable[[], sweep.Transport] = sweep.UdpTransport
        self.identifier: Identifier = OnvifIdentifier()
        self.run_inline = False  # tests: run the sweep on the calling thread
        self.resolve: Callable[[str], list[str]] = source_policy.resolve_host  # recorder hosts configured by name
        self.listen_s = 4.0
        self.limits = ScopedRateLimiter("camera_discovery", horizon_s=3600.0, clock=lambda: self.clock())
        self.guard = ScopedRateLimiter("camera_discovery_auth", horizon_s=GUARD_WINDOW_S, clock=lambda: self.clock())
        self._threads: list[threading.Thread] = []

    # ------------------------------------------------------------ bookkeeping

    def reset(self) -> None:
        with self._lock:
            jobs = list(self._jobs.values())
            self._jobs.clear()
        for j in jobs:
            j.cancel.set()
            j.wipe()
        for t in list(self._threads):
            t.join(timeout=5.0)
        self._threads.clear()
        self.__init__()  # type: ignore[misc]

    def _expire(self) -> None:
        now = self.clock()
        gone: list[Job] = []
        with self._lock:
            for jid, j in list(self._jobs.items()):
                idle = now - max(j.touched_mono, j.started_mono)
                if j.state != "running" and (idle > j.ttl_s or now - j.started_mono > JOB_MAX_AGE_S):
                    gone.append(self._jobs.pop(jid))
        for j in gone:
            j.wipe()

    def _job(self, conn: sqlite3.Connection, principal: Principal, scan_id: Any) -> Job:
        self._expire()
        with self._lock:
            job = self._jobs.get(str(scan_id)) if isinstance(scan_id, str) else None
        if job is None or not (job.owner_id == principal.user_id or is_system_admin(conn, principal.user_id)):
            raise _error(404, "scan_not_found")  # another administrator's job is "not found", not "forbidden": no existence leak
        job.touched_mono = self.clock()
        return job

    def running(self) -> Job | None:
        with self._lock:
            return next((j for j in self._jobs.values() if j.state == "running"), None)

    # ------------------------------------------------------------ capabilities

    def capabilities(self, conn: sqlite3.Connection, settings: Settings, principal: Principal) -> dict[str, Any]:
        """What the scan screen needs before a scan: on / off, the suggested range, the limits."""
        require(conn, principal, PERMISSION, INSTALLATION)
        pol = policy(conn)
        ifaces = ranges.site_interfaces(settings)
        return {"enabled": pol.mode != "off", "engines": [{"id": "unicast", "available": bool(ifaces), **({} if ifaces else {"reason": "site_network_unknown"})}],
                "suggested_range": ranges.suggested_range(ifaces), "max_addresses": pol.max_addresses, "running": self.running() is not None}

    # ------------------------------------------------------------ start

    def start_scan(self, conn: sqlite3.Connection, settings: Settings, principal: Principal, range_text: Any = None,
                   request_id: str | None = None) -> dict[str, Any]:
        require(conn, principal, PERMISSION, INSTALLATION)

        def refuse(status: int, code: str, **details: Any) -> ApiError:
            audit(conn, actor=principal, action="camera.discovery.scan", decision="denied", resource_type="installation", resource_id="*",
                  reason=code, request_id=request_id, details={"range": range_text[:64]} if isinstance(range_text, str) and range_text else None)
            return _error(status, code, **details)

        pol = policy(conn)
        if pol.mode == "off":
            raise refuse(409, "discovery_off")
        self._expire()
        if self.running() is not None:
            raise refuse(409, "scan_running")
        ifaces = ranges.site_interfaces(settings)
        if range_text is None or (isinstance(range_text, str) and not range_text.strip()):
            range_text = ranges.suggested_range(ifaces)
            if range_text is None:
                raise refuse(422, "site_network_unknown")
        try:
            plan = ranges.plan(range_text, ifaces, allowed=list(pol.allowed), max_addresses=pol.max_addresses)
        except ranges.RangeRefused as exc:
            raise refuse(422, exc.code, max_addresses=pol.max_addresses) from None
        wait = max(self.limits.check("install", _SCAN_LIMITS_INSTALL), self.limits.check(f"user:{principal.user_id}", _SCAN_LIMITS_USER))
        if wait > 0 or not self.limits.hit("install", _SCAN_LIMITS_INSTALL):
            raise refuse(429, "rate_limited", retry_after_s=int(wait) + 1)
        self.limits.hit(f"user:{principal.user_id}", _SCAN_LIMITS_USER)
        snap = known.snapshot(conn, settings)
        now = self.clock()
        engines = ENGINES + (("http",) if pol.http_fallback else ())
        job = Job(id=secrets.token_hex(8), owner_id=principal.user_id, range=str(plan.network), total=len(plan.targets), engines=engines,
                  started_at=now_iso(), started_mono=now, touched_mono=now, key=secrets.token_bytes(32), snap=snap, ttl_s=pol.job_ttl_s)
        with self._lock:
            if any(j.state == "running" for j in self._jobs.values()):  # a second press that raced the first
                raise refuse(409, "scan_running")
            self._jobs[job.id] = job
        job.audit_row = audit(conn, actor=principal, action="camera.discovery.scan", decision="allowed", resource_type="camera_discovery",
                              resource_id=job.id, request_id=request_id,
                              details={"range": job.range, "addresses": job.total, "engines": list(engines), "rate_pps": pol.rate_pps})
        config = sweep.Config(rate_pps=pol.rate_pps, listen_s=self.listen_s, deadline_s=SCAN_DEADLINE_S, http_fallback=pol.http_fallback)
        db = database_of(conn)
        if self.run_inline:
            with unlocked(conn):  # the start row is committed; the run completes it through its own connection
                self._run(job, plan.targets, config, db)
        else:
            t = threading.Thread(target=self._run, args=(job, plan.targets, config, db), name=f"camera-discovery-{job.id}", daemon=True)
            self._threads = [x for x in self._threads if x.is_alive()] + [t]
            t.start()
        return job.view()

    # ------------------------------------------------------------ the sweep (its own thread; no database connection held)

    def _run(self, job: Job, targets: tuple[str, ...], config: sweep.Config, db: Database | None) -> None:
        started = self.clock()
        state = "failed"
        try:
            if job.snap is not None:
                known.resolve_recorder_names(job.snap, self.resolve)

            def progress(n: int) -> None:
                job.checked = n

            job.stats = sweep.sweep(targets, config=config, on_found=lambda f: self._found(job, f), cancelled=job.cancel, on_progress=progress,
                                    transport_factory=self.transport_factory, clock=self.clock)
            state = "cancelled" if job.stats.cancelled else "done"
        except Exception as exc:  # noqa: BLE001 - a scan must end in a state; the reason is a class name, never a value
            log.warning("camera discovery scan %s failed: %s", job.id, type(exc).__name__)
        with job.lock:
            job.state = state
            job.finished_at = now_iso()
        job.touched_mono = self.clock()
        if state == "cancelled":
            job.wipe()
        self._finish_audit(job, db, round(self.clock() - started, 1))

    def _finish_audit(self, job: Job, db: Database | None, duration_s: float) -> None:
        if db is None or job.audit_row is None:
            return
        s = job.stats
        details = {"range": job.range, "addresses": job.total, "engines": list(job.engines), "state": job.state, "duration_s": duration_s,
                   **job.counts(), **({"sent": s.sent, "answers": s.answers, "rejected": s.rejected, "http_checked": s.http_checked,
                                       "timed_out": s.timed_out} if s else {}), **({"overflow": job.overflow} if job.overflow else {})}
        try:
            with db.connection() as w:
                w.execute("UPDATE audit_log SET details_json = ? WHERE id = ?", (json.dumps(details, ensure_ascii=False), job.audit_row))
        except sqlite3.Error as exc:
            log.warning("camera discovery scan %s: the audit row was not completed (%s)", job.id, type(exc).__name__)

    def _found(self, job: Job, f: sweep.Found) -> None:
        m = f.match
        port = f.target.port if f.target is not None else None
        key = (m.endpoint if m is not None and m.endpoint else None) or f"{f.address}:{port or 0}"
        with job.lock:
            did = job.by_key.get(key)
            dev = job.devices.get(did) if did else None
            if dev is None:
                if len(job.devices) >= MAX_DEVICES:
                    job.overflow += 1
                    return
                did = "d" + _digest(job.key, "device", key)[:12]
                kn, ref = known.by_address(job.snap, f.address) if job.snap is not None else ("none", None)
                dev = Device(id=did, address=f.address, port=port, engines=[], kind="unknown", known=kn, known_ref=ref, endpoint=m.endpoint if m else None)
                job.by_key[key] = did
                job.devices[did] = dev
            if f.engine not in dev.engines:
                dev.engines.append(f.engine)
            if dev.target is None and f.target is not None:
                dev.target, dev.port = f.target, f.target.port
            if f.clock_offset_s is not None:
                dev.clock_offset_s = f.clock_offset_s
            if m is not None:
                dev.types = tuple(dict.fromkeys(dev.types + m.types))
                dev.scope_types = tuple(dict.fromkeys(dev.scope_types + m.scope_types))
                dev.manufacturer = dev.manufacturer or m.manufacturer
                dev.model = dev.model or m.model
                dev.name = dev.name or m.name
            dev.kind = "nvr" if dev.known == "recorder" else wsd.classify(dev.types, dev.scope_types, dev.model, dev.name)

    # ------------------------------------------------------------ view / cancel

    def list_scans(self, conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
        """The scans this person may see (their own; every scan for a system administrator), newest first, without the devices -
        what the scan screen needs to find a running scan again after a reload (ONVIF-API-2500)."""
        require(conn, principal, PERMISSION, INSTALLATION)
        self._expire()
        with self._lock:
            jobs = sorted(self._jobs.values(), key=lambda j: j.started_mono, reverse=True)
        admin: bool | None = None
        out = []
        for job in jobs:
            if job.owner_id != principal.user_id:
                admin = is_system_admin(conn, principal.user_id) if admin is None else admin
                if not admin:
                    continue
            out.append(job.summary())
        return {"scans": out}

    def get(self, conn: sqlite3.Connection, principal: Principal, scan_id: Any) -> dict[str, Any]:
        require(conn, principal, PERMISSION, INSTALLATION)
        return self._job(conn, principal, scan_id).view()

    def cancel(self, conn: sqlite3.Connection, principal: Principal, scan_id: Any, request_id: str | None = None) -> dict[str, Any]:
        require(conn, principal, PERMISSION, INSTALLATION)
        job = self._job(conn, principal, scan_id)
        was = job.state
        job.cancel.set()
        if was != "running":
            with job.lock:
                job.state = "cancelled"
        job.wipe()
        audit(conn, actor=principal, action="camera.discovery.cancel", decision="allowed", resource_type="camera_discovery", resource_id=job.id,
              request_id=request_id, details={"was": was})
        return {"cancelled": True}

    # ------------------------------------------------------------ identification: ONE credential attempt per device per press

    def identify(self, conn: sqlite3.Connection, settings: Settings, principal: Principal, scan_id: Any, *, device_ids: Any, username: Any,
                 password: Any, same_for_all: bool = False, request_id: str | None = None) -> dict[str, Any]:
        require(conn, principal, PERMISSION, INSTALLATION)
        job = self._job(conn, principal, scan_id)
        if job.state not in ("running", "done"):
            raise _error(409, "scan_not_active")
        bad = tuple(name for name, value, cap in (("username", username, onvif_http.USER_MAX), ("password", password, onvif_http.PASSWORD_MAX))
                    if not isinstance(value, str) or not (value.strip() if name == "username" else value) or len(value) > cap)
        if bad:
            raise _error(422, "credentials_invalid", fields=bad)  # names the field only: never the value
        ids = list(dict.fromkeys(device_ids)) if isinstance(device_ids, list) and all(isinstance(x, str) for x in device_ids) else []
        if not ids or len(ids) > MAX_IDENTIFY_DEVICES:
            raise _error(422, "device_unknown")
        if len(ids) > 1 and not same_for_all:
            raise _error(422, "same_for_all_required")
        with job.lock:
            devices = [job.devices.get(i) for i in ids]
        if any(d is None for d in devices):
            raise _error(422, "device_unknown")
        wait = self.limits.check(f"identify:{principal.user_id}", _IDENTIFY_LIMITS)
        if wait > 0 or not self.limits.hit(f"identify:{principal.user_id}", _IDENTIFY_LIMITS):
            raise _error(429, "rate_limited", retry_after_s=int(wait) + 1)
        snap = known.snapshot(conn, settings)  # fresh: a camera added meanwhile is known now
        if job.snap is not None:
            snap.recorder_hosts.update({a: r for a, r in job.snap.recorder_hosts.items() if a not in snap.recorder_hosts})  # names resolved by the scan
        pair = _digest(job.key, "creds", username.strip(), password)
        with unlocked(conn):  # the device calls never hold the database write lock
            with ThreadPoolExecutor(max_workers=IDENTIFY_WORKERS, thread_name_prefix="onvif-identify") as pool:
                list(pool.map(lambda d: self._attempt(job, d, username.strip(), password, pair, snap), devices))  # type: ignore[arg-type]
        results = collections.Counter(d.auth for d in devices if d is not None)
        audit(conn, actor=principal, action="camera.discovery.identify", decision="allowed", resource_type="camera_discovery", resource_id=job.id,
              request_id=request_id, details={"devices": len(devices), "same_for_all": bool(same_for_all), "results": dict(sorted(results.items()))})
        with job.lock:
            return {"devices": [d.view() for d in devices if d is not None]}

    def _attempt(self, job: Job, dev: Device, username: str, password: str, pair: str, snap: known.Snapshot) -> None:
        def outcome(auth: str) -> None:
            with job.lock:
                dev.auth = auth

        with job.lock:
            kn, ref = known.by_address(snap, dev.address)
            if kn != "none" and dev.known == "none":
                dev.known, dev.known_ref = kn, ref
                if kn == "recorder":
                    dev.kind = "nvr"
            blocked = dev.known != "none" or dev.kind == "nvr"
        if blocked:
            return outcome("skipped")  # Q58 / Q59: never sent the camera password
        if dev.target is None:
            return outcome("not_onvif")
        guard_key = f"dev:{dev.address}"
        if self.guard.check(guard_key, _GUARD_LIMITS) > 0:
            return outcome("locked_guard")  # "stopped so the camera does not lock": not contacted
        if pair in dev.refused:
            return outcome("wrong_password")  # the same pair was refused already: not sent again
        if not dev.lock.acquire(blocking=False):
            return outcome("busy")  # one authenticated request in flight per device
        try:
            if dev.clock_offset_s is None:
                clk = self.identifier.clock(dev.target)  # no credentials
                if clk is None or not clk.onvif:
                    return outcome("no_answer" if clk is None else "not_onvif")
                dev.clock_offset_s = clk.offset_s
            # THE attempt (ONVIF-CLIENT-2500: the client reports every refusal to the guard and asks it before the one HTTP Digest answer)
            info = self.identifier.information(dev.target, username, password, dev.clock_offset_s, _DeviceGuard(self.guard, guard_key))
            with job.lock:
                dev.attempts += 1
                dev.auth = info.auth
                if info.auth != "ok":
                    dev.forget()
                    if info.failed_auth:
                        dev.refused.add(pair)  # never sent again in this scan (a guard stop is not a refusal of the pair)
                    return
                dev.manufacturer = info.manufacturer or dev.manufacturer
                dev.model = info.model or dev.model
                dev.firmware = info.firmware or dev.firmware
                kn, ref = known.by_identity(snap, info.model, info.serial)
                if kn != "none":
                    dev.known, dev.known_ref = kn, ref
                dev.kind = "nvr" if dev.known == "recorder" else wsd.classify(dev.types, dev.scope_types, dev.model, dev.name, info.hardware_id)
                if dev.kind == "unknown":
                    dev.kind = "camera"  # it answered an authenticated ONVIF device read and nothing says recorder
                if not dev.addable:
                    dev.forget()
                    return
                dev.creds = (username, password)
                dev.fingerprint = (known.camera_fingerprint(snap.salt, known.STANDALONE, info.model, info.serial)
                                   if snap.salt is not None and info.serial else None)
                if isinstance(info, onvif_client.Identified):
                    dev.media, dev.auth_mode = info.media, info.auth_mode
                    dev.profiles, dev.snapshot_uri = list(info.profiles), info.snapshot_uri
        finally:
            dev.lock.release()

    # ------------------------------------------------------------ for the add step (ONVIF-API row)

    def credentials_for(self, conn: sqlite3.Connection, principal: Principal, scan_id: Any, device_id: Any) -> tuple[onvif_http.Target, str, str] | None:
        """The identified, addable device's service and the credentials that worked - for the server-side add / preview only."""
        job = self._job(conn, principal, scan_id)
        with job.lock:
            dev = job.devices.get(device_id) if isinstance(device_id, str) else None
            if dev is None or not dev.addable or dev.creds is None or dev.target is None:
                return None
            return dev.target, dev.creds[0], dev.creds[1]

    # ------------------------------------------------------------ the preview and the add step (ONVIF-CLIENT-2500)

    @staticmethod
    def _refusal_of(dev: Device | None) -> str | None:
        """Why a found device cannot become a camera without a recorder (None: it can) - Q58 / Q59 first, then the press."""
        if dev is None:
            return "device_unknown"
        if dev.known == "behind_recorder":
            return "behind_recorder"  # Q58: it already comes through the recorder - never added, not even as a separate camera
        if dev.kind == "nvr" or dev.known == "recorder":
            return "is_recorder"  # Q59: "add as a recorder" in the recorder wizard instead
        if dev.known == "standalone":
            return "already_added"
        if dev.target is None or dev.creds is None or dev.auth != "ok":
            return "not_identified"
        if not any(p.uri for p in dev.profiles):
            return "no_stream"
        return None

    @staticmethod
    def _sources(dev: Device, main_token: Any, sub_token: Any) -> tuple[onvif_client.Profile, onvif_client.Profile | None]:
        """The chosen main / sub profiles (the suggestion when not given). Raises AddRefused(`profile_unknown` / `no_stream`)."""
        by_token = {p.token: p for p in dev.profiles}
        suggested = dev.suggested()
        main_t = main_token if main_token not in (None, "") else suggested["main"]
        sub_t = sub_token if sub_token not in (None, "") else (suggested["sub"] if main_token in (None, "") else None)
        main = by_token.get(main_t) if isinstance(main_t, str) else None
        sub = by_token.get(sub_t) if isinstance(sub_t, str) else None
        if main is None or (sub_t not in (None, "") and sub is None):
            raise AddRefused("profile_unknown")
        if not main.uri or (sub is not None and not sub.uri):
            raise AddRefused("no_stream")
        return main, (sub if sub is not None and sub.token != main.token else None)

    def preview_source(self, conn: sqlite3.Connection, principal: Principal, scan_id: Any, device_id: Any, profile: str,
                       token: Any = None) -> str:
        """The full stream address (credentials inside) of a found, identified camera's `profile` (main | sub - the suggestion, or
        `token`) for `POST /cameras/source/test`'s preview form: assembled HERE, on the server, so it never travels through the
        browser. The caller checks it with the source policy and tests it; it is never stored, returned, logged or audited.
        ApiError 404 `scan_not_found` (another person's scan too), 409 `scan_not_active`, 422 with the add step's codes."""
        require(conn, principal, PERMISSION, INSTALLATION)
        job = self._job(conn, principal, scan_id)
        if job.state not in ("running", "done"):
            raise _error(409, "scan_not_active")
        with job.lock:
            dev = job.devices.get(device_id) if isinstance(device_id, str) else None
            code = self._refusal_of(dev)
            if code is not None or dev is None or dev.creds is None:
                raise _error(422, code or "not_identified", fields=("device_id",))
            try:
                if token not in (None, ""):
                    main, sub = self._sources(dev, token, None)
                    chosen: onvif_client.Profile | None = main
                else:
                    main, sub = self._sources(dev, None, None)
                    chosen = sub if profile == "sub" and sub is not None else main
            except AddRefused as exc:
                raise _error(422, exc.code, fields=("profile_token",) if token not in (None, "") else ("device_id",)) from None
            assert chosen is not None and chosen.uri is not None
            return onvif_client.with_credentials(chosen.uri, dev.creds[0], dev.creds[1])

    def add(self, conn: sqlite3.Connection, settings: Settings, principal: Principal, scan_id: Any, *, cameras: Any,
            request_id: str | None = None) -> dict[str, Any]:
        """`POST /cameras/discovery/scans/{id}/add` (design 4.5 / 7, Q58 / Q59): each chosen camera through the existing
        `camera_sources.create_standalone` - its main / sub addresses shaped from the camera's own stream addresses with the pair
        that worked, checked by the source policy there and sealed there, origin `onvif`. One camera at a time, partial success
        reported; a device behind the recorder, a recorder, an already added or an unidentified camera is refused per row. The
        caller checked go2rtc (`webrtc_server_required`) and the body shape. Audited once (`camera.discovery.add`: camera ids and
        refusal codes - never an address, a user name or a password); every camera also has its `camera.standalone.create` row."""
        from .. import camera_sources  # not at import time: it pulls the go2rtc adapter and the connection store

        require(conn, principal, PERMISSION, INSTALLATION)
        job = self._job(conn, principal, scan_id)
        if job.state not in ("running", "done"):
            raise _error(409, "scan_not_active")
        rows = cameras if isinstance(cameras, list) else []
        if not rows or len(rows) > MAX_IDENTIFY_DEVICES or not all(isinstance(r, dict) and isinstance(r.get("device_id"), str) for r in rows):
            raise _error(422, "device_unknown", fields=("cameras",))
        snap = known.snapshot(conn, settings)  # fresh: a camera added meanwhile (or by another person) is known now
        added: list[dict[str, str]] = []
        failed: list[dict[str, str]] = []
        seen: set[str] = set()

        def refuse(did: str, code: str, message: str | None = None) -> None:
            failed.append({"device_id": did, "code": code, "message": message or ADD_MSG.get(code, ADD_MSG["not_identified"])})

        for row in rows:
            did = row["device_id"]
            if did in seen:
                refuse(did, "device_duplicate")
                continue
            seen.add(did)
            with job.lock:
                dev = job.devices.get(did)
                if dev is not None:
                    kn, ref = known.by_address(snap, dev.address)
                    if kn != "none" and dev.known == "none":
                        dev.known, dev.known_ref = kn, ref
                        if kn == "recorder":
                            dev.kind = "nvr"
                        dev.forget()
                code = self._refusal_of(dev)
                if code is None and dev is not None and dev.creds is not None:
                    try:
                        main, sub = self._sources(dev, row.get("main_profile"), row.get("sub_profile"))
                    except AddRefused as exc:
                        code = exc.code
                    else:
                        user, password = dev.creds
                        plan = {"main_url": onvif_client.with_credentials(main.uri or "", user, password),
                                "sub_url": onvif_client.with_credentials(sub.uri, user, password) if sub is not None and sub.uri else None,
                                "origin": self._origin(dev, main, sub, snap),
                                "probe": {p_name: p for p_name, p in (("main", main), ("sub", sub)) if p is not None},
                                "fingerprint": dev.fingerprint, "name": self._name(dev, row.get("name"))}
            if code is not None or dev is None:
                refuse(did, code or "device_unknown")
                continue
            try:
                cam = camera_sources.create_standalone(
                    conn, settings, principal, name=plan["name"], area_id=row.get("area_id"), main_url=plan["main_url"], sub_url=plan["sub_url"],
                    request_id=request_id, origin="onvif", origin_json=plan["origin"], device_fingerprint=plan["fingerprint"],
                    probe={k: {"codec": p.codec, "codec_label": camera_sources.CODEC_LABEL.get(p.codec or ""), "width": p.width, "height": p.height}
                           for k, p in plan["probe"].items()})
            except ApiError as exc:
                refuse(did, exc.code, exc.user_message)
                continue
            with job.lock:
                dev.known, dev.known_ref = "standalone", str(cam["id"])
                dev.forget()  # added: the pair of this camera is not kept any longer
            added.append({"device_id": did, "camera_id": str(cam["id"])})
        codes = collections.Counter(f["code"] for f in failed)
        audit(conn, actor=principal, action="camera.discovery.add", decision="allowed" if added else "denied", resource_type="camera_discovery",
              resource_id=job.id, request_id=request_id, reason=None if added else "nothing_added",
              details={"requested": len(rows), "added": [a["camera_id"] for a in added], "origin": "onvif",
                       **({"failed": dict(sorted(codes.items()))} if codes else {})})
        return {"added": added, "failed": failed}

    @staticmethod
    def _name(dev: Device, typed: Any) -> str:
        """The typed name, else design 4.5's `<manufacturer> <model> - <last octet>`."""
        if isinstance(typed, str) and typed.strip():
            return typed.strip()
        octet = dev.address.rsplit(".", 1)[-1] if dev.address.count(".") == 3 else dev.address
        label = " ".join(x for x in (dev.manufacturer, dev.model) if x) or "מצלמה"
        return f"{label} - {octet}"[:120]

    @staticmethod
    def _origin(dev: Device, main: onvif_client.Profile, sub: onvif_client.Profile | None, snap: known.Snapshot) -> dict[str, Any]:
        """`camera_stream_sources.onvif_json` (migration 0217): where the camera came from - no credential, serial or MAC."""
        out: dict[str, Any] = {"manufacturer": dev.manufacturer, "model": dev.model, "firmware": dev.firmware, "media": dev.media,
                               "auth_mode": dev.auth_mode, "main_profile": main.token, "sub_profile": sub.token if sub else None,
                               "device_host": dev.address, "device_port": dev.port}
        if dev.endpoint and snap.salt is not None:
            out["endpoint_hmac"] = hmac.new(snap.salt, f"onvif-endpoint|{dev.endpoint}".encode("utf-8"), hashlib.sha256).hexdigest()[:16]
        return out


class AddRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


ADD_MSG = {
    "device_unknown": "המכשיר אינו ברשימת החיפוש.",
    "device_duplicate": "המצלמה נבחרה פעמיים.",
    "behind_recorder": "המצלמה כבר מגיעה דרך המקליט, ולכן אי אפשר להוסיף אותה.",
    "is_recorder": "המכשיר הזה הוא מקליט: אפשר להוסיף אותו כמקליט.",
    "already_added": "המצלמה כבר במערכת.",
    "not_identified": "יש לזהות את המצלמה (שם משתמש וסיסמה) לפני ההוספה.",
    "no_stream": "המצלמה לא מסרה כתובת וידאו; אפשר להוסיף אותה ידנית.",
    "profile_unknown": "הפרופיל שנבחר אינו של המצלמה הזו.",
}
MSG.update(ADD_MSG)


MANAGER = Manager()
register_reset(__name__, ("MANAGER",), MANAGER.reset)
