"""The Frigate adapter, phase F1 "see and play": read-only (NN5, docs/changes/CR-029-FRIGATE-PROVIDER.md; study
docs/research/FRIGATE_STUDY.md sections 6-8).

What it does: connection (URL + viewer account through the recorder's encrypted connection), capability discovery
(`/api/version`, `/api/config` summary, `/api/openapi.json` routes), health (reachability, detector / camera fps, storage,
per-camera status, certificate; mapped into the CR-026 `HealthReading`), the camera list with enabled / disabled state, review
items and tracked objects, latest-frame stills, recordings, coverage inputs, and the HLS VOD playlist. It writes NOTHING to
Frigate: `frigate_http.GET_ALLOWED` is the allow-list, the one POST is the login.

Rules kept from the other adapters (ADP section 1): device I/O only (no SQLite, no audit, no permission decisions),
synchronous and bounded, declared not guessed (`capabilities().features` come from discovery, never from a version number; the
version only gates the minimum), errors are `ApiError` with the shared codes, and no address, user name, password, token or
stream URL leaves this module: `/api/config` holds camera RTSP URLs with credentials, so only a whitelisted summary of it is
ever returned (`summarize_config`)."""
from __future__ import annotations

import datetime as dt
import email.utils
import re
import threading
import time
from collections.abc import Callable
from typing import Any, ClassVar

import httpx

from ...config import Settings
from ...errors import ApiError
from .base import (ChannelInfo, ChannelReading, DiskReading, HealthReading, RecorderCapabilities, RecorderHealth, StreamEncoding, StreamOptions,
                   StreamSnapshot, WriteOutcome)
from .frigate_http import (IMAGE_MAX_BYTES, OPENAPI_MAX_BYTES, PLAYLIST_MAX_BYTES, SEGMENT_MAX_BYTES, FrigateHttp, q)

VENDOR = "frigate"
MIN_VERSION = (0, 18)              # owner decision 2026-10-05: minimum Frigate 0.18
DEFAULT_PORT = 8971
HEALTH_TIMEOUT_S = 4.0
CONFIG_TTL_S = 60.0
CERT_TTL_S = 6 * 3600.0
CAMERA_KEY = re.compile(r"^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,64}$")  # security review 2.2.0 L6: never "." / ".." (httpx folds dot segments)

_CONFIG: dict[str, tuple[float, dict[str, Any]]] = {}      # device_key -> (expires at, discovery document)
_CERTS: dict[str, tuple[float, dict[str, Any]]] = {}
_LOCK = threading.Lock()
_monotonic = time.monotonic
PEER_CERTIFICATE_HOOK: Callable[..., dict[str, Any]] | None = None  # tests
TRANSPORT: httpx.BaseTransport | None = None  # tests: httpx.MockTransport(fake.handle) for every adapter built by the registry


def clear_cache() -> None:
    with _LOCK:
        _CONFIG.clear()
        _CERTS.clear()


def parse_version(text: str) -> tuple[int, ...] | None:
    """`0.18.0-77a66e7` -> (0, 18, 0). None when the answer is not a version (a proxy's HTML page, an error text)."""
    m = re.match(r"\s*v?(\d+)\.(\d+)(?:\.(\d+))?", text or "")
    return tuple(int(x) for x in m.groups() if x is not None) if m else None


def version_ok(v: tuple[int, ...] | None) -> bool:
    return v is not None and tuple(v[:2]) >= MIN_VERSION


def _num(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _flag(section: Any, default: bool = False) -> bool:
    if isinstance(section, dict):
        return bool(section.get("enabled", default))
    return default


# ---------------------------------------------------------------------------------------------- config summary

def summarize_config(cfg: dict[str, Any]) -> dict[str, Any]:
    """A WHITELISTED summary of Frigate's effective `/api/config`: cameras (key, name, enabled, detect size / fps, record and
    snapshot switches, tracked labels, zone names, PTZ presence), detectors (name + type), the global feature switches and the
    retention policy. Nothing else is copied: no stream path, no user, no password, no MQTT section, no command line."""
    cams_in = cfg.get("cameras") if isinstance(cfg.get("cameras"), dict) else {}
    g_record = cfg.get("record") if isinstance(cfg.get("record"), dict) else {}
    g_review = cfg.get("review") if isinstance(cfg.get("review"), dict) else {}
    cameras: list[dict[str, Any]] = []
    for key, c in cams_in.items():
        if not isinstance(c, dict) or not CAMERA_KEY.fullmatch(str(key)):
            continue
        det = c.get("detect") if isinstance(c.get("detect"), dict) else {}
        rec = c.get("record") if isinstance(c.get("record"), dict) else {}
        objs = c.get("objects") if isinstance(c.get("objects"), dict) else {}
        zones = c.get("zones") if isinstance(c.get("zones"), dict) else {}
        onvif = c.get("onvif") if isinstance(c.get("onvif"), dict) else {}
        enabled = bool(c.get("enabled", True))
        cameras.append({
            "key": str(key),
            "name": str(c.get("friendly_name") or key)[:80],
            "enabled": enabled,
            "enabled_in_config": bool(c.get("enabled_in_config", enabled)),
            "detect": {"enabled": _flag(det, True), "width": _num(det.get("width")), "height": _num(det.get("height")), "fps": _num(det.get("fps"))},
            "record": {"enabled": _flag(rec, True) if rec else False},
            "snapshots": _flag(c.get("snapshots")),
            "audio": _flag(c.get("audio")),
            "ptz": bool(onvif.get("host")),
            "labels": [str(x) for x in (objs.get("track") or []) if isinstance(x, str)][:32],
            "zones": sorted(str(z) for z in zones)[:32],
        })
    detectors = [{"name": str(n), "type": str(d.get("type") or "")} for n, d in (cfg.get("detectors") or {}).items() if isinstance(d, dict)]
    alerts = g_record.get("alerts") if isinstance(g_record.get("alerts"), dict) else {}
    detections = g_record.get("detections") if isinstance(g_record.get("detections"), dict) else {}
    motion = g_record.get("motion") if isinstance(g_record.get("motion"), dict) else {}
    cont = g_record.get("continuous") if isinstance(g_record.get("continuous"), dict) else g_record.get("retain") if isinstance(g_record.get("retain"), dict) else {}

    def days(sec: Any) -> float | None:
        if not isinstance(sec, dict):
            return None
        inner = sec.get("retain") if isinstance(sec.get("retain"), dict) else sec
        return _num(inner.get("days"))

    retention = {
        "record_enabled": _flag(g_record, True) if g_record else False,
        "continuous_days": days(cont), "motion_days": days(motion), "alerts_days": days(alerts), "detections_days": days(detections),
        "mode": str((alerts.get("retain") or {}).get("mode") if isinstance(alerts.get("retain"), dict) else "") or None,
        "pre_s": _num(alerts.get("pre_capture")), "post_s": _num(alerts.get("post_capture")),
    }
    alert_labels = ((g_review.get("alerts") or {}).get("labels") if isinstance(g_review.get("alerts"), dict) else None) or []
    features = {
        "snapshots": any(c["snapshots"] for c in cameras),
        "recordings": retention["record_enabled"] and any(c["record"]["enabled"] for c in cameras),
        "semantic_search": _flag(cfg.get("semantic_search")),
        "face_recognition": _flag(cfg.get("face_recognition")),
        "lpr": _flag(cfg.get("lpr")),
        "genai": bool(isinstance(cfg.get("genai"), dict) and (cfg["genai"].get("provider") or cfg["genai"].get("enabled"))),
        "audio": any(c["audio"] for c in cameras),
        "ptz": any(c["ptz"] for c in cameras),
        "birdseye": _flag(cfg.get("birdseye")),
        "notifications": _flag(cfg.get("notifications")),
    }
    return {"cameras": cameras, "detectors": detectors, "features": features, "retention": retention,
            "review_alert_labels": [str(x) for x in alert_labels if isinstance(x, str)][:16]}


def route_features(paths: set[str] | None) -> dict[str, bool | None]:
    """What `/api/openapi.json` says exists (None = the document was not readable, e.g. a viewer role: unknown, not False)."""
    if paths is None:
        return {k: None for k in ("review_items", "timeline", "search_text", "exports_native", "runtime_toggles", "config_write", "motion_search")}

    def has(*needles: str) -> bool:
        return any(any(n in p for n in needles) for p in paths)

    return {"review_items": "/review" in paths, "timeline": "/timeline" in paths, "search_text": "/events/search" in paths,
            "exports_native": has("/export/"), "runtime_toggles": has("/camera/{camera_name}/set/"), "config_write": "/config/set" in paths,
            "motion_search": has("motion_search", "/motion")}


# ---------------------------------------------------------------------------------------------- the adapter

class FrigateAdapter:
    """`RecorderAdapter` for a Frigate server (read-only in F1). `channel_map` (source_ref -> synthetic channel number) is set by
    callers that know the cameras table; without it channels are numbered 1..n in Frigate's config order."""

    vendor: ClassVar[str] = VENDOR

    def __init__(self, recorder_id: str, settings: Settings, *, transport: httpx.BaseTransport | None = None) -> None:
        self.recorder_id = recorder_id
        self._settings = settings
        self.http = FrigateHttp(recorder_id, settings, transport=transport or TRANSPORT)
        self.channel_map: dict[str, int] = {}
        self.health_zone: str | None = None

    # ------------------------------------------------------------------------------------------ discovery

    @property
    def device_key(self) -> str:
        return self.http.device_key

    def version(self) -> tuple[str, tuple[int, ...] | None, float | None]:
        """(version text, parsed, clock drift seconds from the HTTP `Date` header minus the host's clock)."""
        t0 = time.time()
        reply = self.http.get("/api/version", max_bytes=1000, timeout=HEALTH_TIMEOUT_S)
        t1 = time.time()
        text = reply.text().strip()[:64]
        drift: float | None = None
        date = reply.headers.get("date")
        if date:
            try:
                server = email.utils.parsedate_to_datetime(date).timestamp()
                drift = round(server - (t0 + t1) / 2, 1)  # Date has 1 s resolution: a drift under ~1 s is noise
            except (TypeError, ValueError):
                drift = None
        return text, parse_version(text), drift

    def discover(self, *, refresh: bool = False) -> dict[str, Any]:
        """Capability discovery, cached CONFIG_TTL_S per device: {version, version_ok, summary, features {key: bool|None}, routes,
        discovered_at}. A version below the minimum is `version_ok: False` (the caller refuses the recorder: 409
        `frigate_version_unsupported`); the document is still returned so the screen can say why."""
        key = self.device_key
        if not refresh:
            with _LOCK:
                hit = _CONFIG.get(key)
            if hit and hit[0] > _monotonic():
                return hit[1]
        text, parsed, _drift = self.version()
        ok = version_ok(parsed)
        if parsed is None:
            raise ApiError(503, "source_invalid", "התשובה אינה של Frigate.", details={"op": "version"})
        summary: dict[str, Any] = {"cameras": [], "detectors": [], "features": {}, "retention": {}, "review_alert_labels": []}
        paths: set[str] | None = None
        streams: dict[str, Any] | None = None
        if ok:
            cfg = self.http.get_json("/api/config")
            if not isinstance(cfg, dict):
                raise ApiError(503, "source_invalid", "תשובת Frigate אינה מסמך תקין.", details={"op": "config"})
            summary = summarize_config(cfg)
            paths = self._openapi_paths()
            try:
                st = self.http.get_json("/api/go2rtc/streams", optional=True)
                streams = st if isinstance(st, dict) else None
            except ApiError as exc:
                if exc.code not in ("frigate_route_missing", "source_forbidden"):
                    raise
        routes = route_features(paths)
        feats = summary["features"]
        has_cams = bool(summary["cameras"])
        enabled = {
            "review_items": routes["review_items"] if routes["review_items"] is not None else has_cams,
            "object_events": has_cams,
            "snapshots_latest": has_cams,
            "recordings": bool(feats.get("recordings")),
            "hls_playback": bool(feats.get("recordings")),
            "restream": bool(streams),
            "audio_events": bool(feats.get("audio")),
            "search_text": bool(routes["search_text"]),
            "search_semantic": bool(feats.get("semantic_search")),
            "timeline": bool(routes["timeline"]),
            "ptz": bool(feats.get("ptz")),
            "faces": bool(feats.get("face_recognition")),
            "lpr": bool(feats.get("lpr")),
            "genai": bool(feats.get("genai")),
            "exports_native": bool(routes["exports_native"]),
            "runtime_toggles": bool(routes["runtime_toggles"]),
            "config_write": bool(routes["config_write"]),
        }
        doc = {"version": text, "version_ok": ok, "min_version": ".".join(str(x) for x in MIN_VERSION), "summary": summary,
               "features": {k: v for k, v in enabled.items()}, "routes_known": paths is not None,
               "restream_streams": sorted(streams) if isinstance(streams, dict) else [],
               "discovered_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
        with _LOCK:
            _CONFIG[key] = (_monotonic() + CONFIG_TTL_S, doc)
        return doc

    def _openapi_paths(self) -> set[str] | None:
        try:
            doc = self.http.get_json("/api/openapi.json", max_bytes=OPENAPI_MAX_BYTES, optional=True)
        except ApiError as exc:
            if exc.code in ("frigate_route_missing", "source_forbidden", "source_too_large", "source_invalid"):
                return None
            raise
        paths = doc.get("paths") if isinstance(doc, dict) else None
        return {str(p) for p in paths} if isinstance(paths, dict) else None

    def cached_discovery(self) -> dict[str, Any] | None:
        with _LOCK:
            hit = _CONFIG.get(self.device_key)
        return hit[1] if hit else None

    # ------------------------------------------------------------------------------------------ RecorderAdapter

    def capabilities(self) -> RecorderCapabilities:
        """Declared from the last discovery (cached, no I/O): `features` are the discovered abilities that are on. Before a
        discovery the set is empty. Live is "none" until a restream exists (stills only); playback is HLS; events arrive by
        WebSocket with polling backfill ("push")."""
        doc = self.cached_discovery()
        feats = frozenset(k for k, v in ((doc or {}).get("features") or {}).items() if v)
        return RecorderCapabilities(
            vendor=self.vendor, read_encodings=True, write_encodings=False, encoding_fields=frozenset({"resolution", "fps"}),
            add_channel=False, remove_channel=False, max_channels=None,
            live="rtsp" if "restream" in feats else "none", playback="hls", events="push", health_detail=True, features=feats)

    def health(self) -> RecorderHealth:
        """Reachability + version. Reachable but older than the minimum is reported as not usable (`nvr_not_supported`)."""
        try:
            text, parsed, drift = self.version()
        except ApiError as exc:
            if exc.code in ("nvr_not_configured", "recorder_unavailable"):
                raise
            return RecorderHealth(online=False, model=None, firmware=None, error=exc.code)
        if parsed is None:
            return RecorderHealth(online=False, model=None, firmware=None, error="source_invalid")
        if not version_ok(parsed):
            return RecorderHealth(online=False, model="Frigate", firmware=text, error="nvr_not_supported", clock_drift_s=drift)
        return RecorderHealth(online=True, model="Frigate", firmware=text, error=None, clock_drift_s=drift)

    def channel_of(self, key: str, order: list[str] | None = None) -> int:
        if key in self.channel_map:
            return self.channel_map[key]
        taken = set(self.channel_map.values())
        n = 1
        for k in (order or []):
            if k in self.channel_map:
                continue
            while n in taken:
                n += 1
            if k == key:
                return n
            taken.add(n)
        while n in taken:
            n += 1
        return n

    def cameras(self) -> list[dict[str, Any]]:
        """The camera list of the last (or a fresh) discovery with the synthetic channel number and `online` from /stats."""
        doc = self.discover()
        if not doc["version_ok"]:
            raise ApiError(409, "frigate_version_unsupported", "גרסת Frigate נמוכה מהמינימום הנתמך.", details={"min": doc["min_version"]})
        cams = doc["summary"]["cameras"]
        order = [c["key"] for c in cams]
        online = self._online_by_camera()
        out = []
        for c in cams:
            out.append({**c, "channel": self.channel_of(c["key"], order), "online": online.get(c["key"]) if c["enabled"] else None})
        return out

    def list_channels(self) -> list[ChannelInfo]:
        return [ChannelInfo(source_ref=c["key"], channel=c["channel"], name=c["name"], online=c["online"]) for c in self.cameras()]

    def read_stream_encodings(self) -> dict[str, list[StreamEncoding]]:
        """Facts only: the DETECT stream's size and fps from the config (Frigate does not own the record encoder; the camera's own
        inputs are credentials-bearing and never read)."""
        out: dict[str, list[StreamEncoding]] = {}
        for c in self.cameras():
            d = c["detect"]
            enc: dict[str, object] = {}
            if d.get("width") and d.get("height"):
                enc["resolution"] = f"{int(d['width'])}x{int(d['height'])}"
            if d.get("fps"):
                enc["fps"] = float(d["fps"])
            out[c["key"]] = [StreamEncoding(stream_ref="detect", role="sub", enabled=bool(d.get("enabled")), encoding=enc)]
        return out

    def stream_options(self, stream_ref: str, codec: str | None = None) -> StreamOptions:
        return StreamOptions(writable=False, reason="frigate_does_not_own_the_encoder", options=None, write_via=None)

    def read_stream(self, stream_ref: str) -> StreamSnapshot:
        raise ApiError(409, "nvr_not_supported", "Frigate אינו מאפשר שינוי הצפנה מ־Arx.", details={"op": "read_stream"})

    def write_stream_encoding(self, stream_ref: str, expect_etag: str, element: str, write_via: str) -> WriteOutcome:
        raise ApiError(409, "nvr_not_supported", "Frigate אינו מאפשר שינוי הצפנה מ־Arx.", details={"op": "write_stream_encoding"})

    # ------------------------------------------------------------------------------------------ health detail (CR-026)

    def _online_by_camera(self) -> dict[str, bool | None]:
        try:
            stats = self.http.get_json("/api/stats", optional=True)
        except ApiError as exc:
            if exc.code in ("source_unavailable", "source_forbidden", "source_timeout", "recorder_unavailable", "tls_pin_mismatch", "tls_pin_missing"):
                raise
            return {}
        cams = stats.get("cameras") if isinstance(stats, dict) else None
        out: dict[str, bool | None] = {}
        for k, v in (cams or {}).items():
            fps = _num(v.get("camera_fps")) if isinstance(v, dict) else None
            out[str(k)] = None if fps is None else fps > 0
        return out

    def read_health(self) -> HealthReading:
        """`/api/stats` (cameras, detectors, storage mounts), `/api/recordings/storage` (MB per hour) and the `Date` header of
        `/api/version` (clock). A part that fails is named in `errors`; a refusal or an unreachable server stops the read."""
        stop = {"source_forbidden", "source_unavailable", "source_timeout", "deadline_exceeded", "source_not_configured", "recorder_unavailable",
                "tls_pin_mismatch", "tls_pin_missing"}
        errors: dict[str, str] = {}

        def part(name: str, fn: Callable[[], Any]) -> Any:
            try:
                return fn()
            except ApiError as exc:
                # a 403 on ONE route is a role limit (a viewer may not read it): the part is named, the read goes on. A 401 (the
                # session itself is refused), an unreachable server or a pin problem stops the read.
                if exc.code in stop and not (exc.code == "source_forbidden" and exc.details.get("status") == 403):
                    raise
                errors[name] = exc.code
                return None

        stats = self.http.get_json("/api/stats")  # without /stats there is nothing to read: any refusal stops the read
        stats = stats if isinstance(stats, dict) else {}
        usage = part("storage", lambda: self.http.get_json("/api/recordings/storage", optional=True))
        doc = self.cached_discovery() or part("config", self.discover) or {"summary": {"cameras": []}}
        cams_cfg = {c["key"]: c for c in doc["summary"]["cameras"]}
        order = [c["key"] for c in doc["summary"]["cameras"]]

        # storage mounts -> disks (the recordings mount; a Frigate without that name falls back to the biggest real mount)
        mounts = ((stats.get("service") or {}).get("storage") or {}) if isinstance(stats.get("service"), dict) else {}
        real = {p: m for p, m in mounts.items() if isinstance(m, dict) and p not in ("/dev/shm", "/tmp/cache") and _num(m.get("total"))}
        pick = [p for p in real if "recordings" in p] or sorted(real, key=lambda p: -float(real[p]["total"]))[:1]
        disks: tuple[DiskReading, ...] | None = tuple(
            DiskReading(ref=str(i + 1), state="ok" if (_num(real[p].get("free")) or 0) > 0 else "error", raw=None,
                        total_mb=int(real[p]["total"]), free_mb=int(_num(real[p].get("free")) or 0)) for i, p in enumerate(pick))
        if not disks:
            errors["disks"] = "no_mount"
            disks = None

        channels: list[ChannelReading] = []
        per_camera: list[dict[str, Any]] = []
        for key, v in (stats.get("cameras") or {}).items():
            if not isinstance(v, dict) or key not in cams_cfg:
                continue
            c = cams_cfg[key]
            if not c["enabled"]:
                continue
            fps = _num(v.get("camera_fps"))
            connected = None if fps is None else fps > 0
            record_state = ("recording" if c["record"]["enabled"] else "idle") if connected else None
            channels.append(ChannelReading(channel=self.channel_of(key, order), connected=connected, record_state=record_state))
            per_camera.append({"key": key, "fps": fps, "expected_fps": _num(v.get("expected_fps")), "skipped_fps": _num(v.get("skipped_fps")),
                               "detection_fps": _num(v.get("detection_fps")), "reconnects_last_hour": _num(v.get("reconnects_last_hour")),
                               "stalls_last_hour": _num(v.get("stalls_last_hour"))})
        detectors = [{"name": n, "inference_ms": _num(d.get("inference_speed"))} for n, d in (stats.get("detectors") or {}).items() if isinstance(d, dict)]
        bandwidth = sum(_num(v.get("bandwidth")) or 0 for v in usage.values() if isinstance(v, dict)) if isinstance(usage, dict) else None
        free_mb = sum(d.free_mb or 0 for d in disks) if disks else None
        hours_left = round(free_mb / bandwidth, 1) if free_mb is not None and bandwidth else None
        details = {
            "version": ((stats.get("service") or {}).get("version") if isinstance(stats.get("service"), dict) else None),
            "uptime_s": _num((stats.get("service") or {}).get("uptime")) if isinstance(stats.get("service"), dict) else None,
            "detectors": detectors,
            "skipped_fps_total": round(sum(c["skipped_fps"] or 0 for c in per_camera), 2),
            "cameras": per_camera,
            "storage": {"bandwidth_mb_per_h": round(bandwidth, 1) if bandwidth else None, "hours_left": hours_left, "basis": "recent bandwidth"},
            "recording_policy": (doc.get("summary") or {}).get("retention"),
        }
        drift = part("clock", lambda: self.version()[2])
        cert = part("certificate", self.certificate_facts)
        return HealthReading(disks=disks, channels=tuple(channels), clock_drift_s=drift, clock_sync=None,
                             disk_alarms=(), certificate=cert, errors=errors, details=details)

    def certificate_facts(self) -> dict[str, Any] | None:
        """Pinned HTTPS only: the certificate's expiry (one TLS handshake, no credentials), cached CERT_TTL_S per device."""
        if self.http.scheme != "https" or self.http.tls_mode() != "pin":
            return None
        key = self.device_key
        with _LOCK:
            hit = _CERTS.get(key)
        if hit and hit[0] > _monotonic():
            return dict(hit[1])
        from . import provision_isr as pisr

        peer = PEER_CERTIFICATE_HOOK or pisr.PEER_CERTIFICATE
        try:
            got = peer(self._settings.nvr_host or "", int(self._settings.nvr_http_port), HEALTH_TIMEOUT_S)
        except OSError as exc:
            from .frigate_http import unavailable

            raise unavailable("tls", exc) from exc
        facts = {"not_after": got.get("not_after"), "self_signed": got.get("self_signed")}
        with _LOCK:
            _CERTS[key] = (_monotonic() + CERT_TTL_S, facts)
        return dict(facts)

    # ------------------------------------------------------------------------------------------ analytics reads

    def review_items(self, after: float, before: float, *, severity: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"after": f"{after:.3f}", "before": f"{before:.3f}", "limit": min(max(int(limit), 1), 500)}
        if severity in ("alert", "detection"):
            params["severity"] = severity
        data = self.http.get_json("/api/review", params)
        return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []

    def review_item(self, review_id: str) -> dict[str, Any]:
        data = self.http.get_json(f"/api/review/{q(review_id)}")
        if not isinstance(data, dict):
            raise ApiError(503, "source_invalid", "תשובת Frigate אינה מסמך תקין.", details={"op": "review"})
        return data

    def events(self, after: float, before: float, *, camera: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"after": f"{after:.3f}", "before": f"{before:.3f}", "limit": min(max(int(limit), 1), 500)}
        if camera:
            params["camera"] = camera
        data = self.http.get_json("/api/events", params)
        return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []

    def motion_activity(self, after: float, before: float) -> list[dict[str, Any]]:
        data = self.http.get_json("/api/review/activity/motion", {"after": f"{after:.0f}", "before": f"{before:.0f}"})
        return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []

    def review_summary(self) -> Any:
        return self.http.get_json("/api/review/summary")

    # ------------------------------------------------------------------------------------------ pictures

    def _image(self, path: str, params: dict[str, Any] | None = None) -> tuple[bytes, str]:
        reply = self.http.get(path, params, max_bytes=IMAGE_MAX_BYTES)
        ctype = reply.headers.get("content-type", "").split(";")[0].strip().lower()
        if not ctype.startswith("image/") or not reply.body:
            raise ApiError(503, "source_invalid", "Frigate לא החזיר תמונה.", details={"op": "image"})
        return reply.body, ctype

    def latest_jpeg(self, camera: str, height: int | None = None) -> tuple[bytes, str]:
        self._camera(camera)
        params = {"h": int(height)} if height else None
        return self._image(f"/api/{camera}/latest.jpg", params)

    def review_thumbnail(self, camera: str, review_id: str) -> tuple[bytes, str]:
        self._camera(camera)
        return self._image(f"/clips/review/thumb-{camera}-{review_id}.webp")

    def event_thumbnail(self, event_id: str) -> tuple[bytes, str]:
        return self._image(f"/api/events/{q(event_id)}/thumbnail.jpg")

    def recording_snapshot(self, camera: str, ts: float) -> tuple[bytes, str]:
        self._camera(camera)
        return self._image(f"/api/{camera}/recordings/{ts:.0f}/snapshot.jpg")

    # ------------------------------------------------------------------------------------------ recordings and playback

    @staticmethod
    def _camera(camera: str) -> None:
        if not CAMERA_KEY.fullmatch(camera or ""):
            raise ApiError(422, "camera_invalid", "מזהה מצלמה לא תקין.")

    def recordings(self, camera: str, after: float, before: float) -> list[dict[str, Any]]:
        self._camera(camera)
        data = self.http.get_json(f"/api/{camera}/recordings", {"after": f"{after:.0f}", "before": f"{before:.0f}"}, max_bytes=4_000_000)
        return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []

    def recordings_summary(self, camera: str, timezone: str) -> list[dict[str, Any]]:
        self._camera(camera)
        data = self.http.get_json(f"/api/{camera}/recordings/summary", {"timezone": timezone})
        return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []

    def storage_usage(self) -> dict[str, Any]:
        data = self.http.get_json("/api/recordings/storage")
        return data if isinstance(data, dict) else {}

    def vod_playlist(self, camera: str, start: float, end: float) -> str:
        self._camera(camera)
        reply = self.http.get(f"/vod/{camera}/start/{start:.0f}/end/{end:.0f}/index.m3u8", max_bytes=PLAYLIST_MAX_BYTES)
        text = reply.text()
        if not text.startswith("#EXTM3U"):
            raise ApiError(503, "source_invalid", "Frigate לא החזיר רשימת הפעלה.", details={"op": "vod"})
        return text

    def vod_asset(self, camera: str, start: float, end: float, name: str) -> tuple[bytes, str]:
        self._camera(camera)
        reply = self.http.get(f"/vod/{camera}/start/{start:.0f}/end/{end:.0f}/{name}", max_bytes=SEGMENT_MAX_BYTES, timeout=20.0)
        return reply.body, reply.headers.get("content-type", "video/mp4")


# ---------------------------------------------------------------------------------------------- registration

def register(*, selectable: bool = False) -> Callable[[], None] | None:
    """Register the adapter and its connection-form spec through `registry.register_vendor`. `selectable=False` keeps Frigate
    "coming soon" in the catalogue (CR-022 D1) until the live validation checklist passes on the owner's instance; the
    feature flag is the catalogue status (and, per installation, the recorder's own vendor choice)."""
    from . import registry

    VF = registry.VendorField
    fields = (
        VF("host", "כתובת", "host", True),
        VF("http_port", "פורט HTTPS (מאומת)", "port", True),
        VF("username", "שם משתמש (חשבון צופה)", "text", True),
        VF("password", "סיסמה", "password", True, secret=True),
        VF("scheme", "חיבור", "select", False, options=(("https", "HTTPS (מוצפן)"), ("http", "HTTP")), advanced=False),
        VF("tls_mode", "תעודת HTTPS", "select", False, options=(("pin", "נעיצת תעודת המכשיר"), ("verify", "אימות רגיל"), ("trust", "לסמוך על כל תעודה")), advanced=False),
        VF("tls_pin", "טביעת אצבע של התעודה (SHA-256)", "text", False, advanced=True),
        VF("poll_interval_s", "מרווח דגימת אירועים (שניות)", "text", False, advanced=True),
    )
    # rtsp_port is unused in F1 (no restream); Frigate's own 8554 is a refused port on any host (it is go2rtc's), so the form default is 554
    spec = registry.VendorSpec(VENDOR, "Frigate", "available" if selectable else "planned", {"http_port": DEFAULT_PORT, "rtsp_port": 554}, fields)
    return registry.register_vendor(spec, FrigateAdapter)
