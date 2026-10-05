"""A fake Frigate 0.18 server for the F1 adapter tests (NN5, CR-029). No network: used through `httpx.MockTransport(fake.handle)`.

Every answer has the SHAPE of the real instance studied read-only on 2026-10-05 (version text, `/api/stats`, `/api/config` with
credential-bearing camera inputs, `/api/review` and `/api/events` rows, 10-second `recordings` segments, the fMP4 VOD playlist,
`/api/recordings/storage`, `/api/review/activity/motion`), rebuilt by hand with INVENTED values: generic camera keys
(`cam_front`, `cam_yard`, `cam_garage`), documentation addresses, no real host name, user name, password, camera name, id or
frame. The planted secrets (`PLANTED_PASSWORD`, `PLANTED_TOKEN_USER`) exist only so tests can prove they never leave the adapter.

Knobs (plain attributes; `reset()` restores them): `version`, `login_ok`, `down`, `expire_after` (every token stops working
after that many authenticated requests: 401 -> the adapter must log in again), `viewer` (a viewer account cannot read
/api/config or /api/openapi.json when `viewer_blocks` says so), `openapi` (document served or 404), `restream` (go2rtc streams
listed), `reviews`, `events`, `segments` ({camera: [segment]}), `latest_status`. `hits` lists every request ("GET /api/version"),
`non_get` every non-GET request: F1 must leave only the login in it."""
from __future__ import annotations

import json
import threading
from typing import Any

import httpx

HOST = "frigate.test"
USER = "arx-viewer"
PASSWORD = "viewer-pass-1"
PLANTED_PASSWORD = "hunter2-camera-secret"
PLANTED_TOKEN_USER = "cam-admin-user"
T0 = 1791228000.0  # a fixed instant (epoch seconds) the fixtures are built around
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00fake-frigate-still\xff\xd9"
WEBP = b"RIFF\x1a\x00\x00\x00WEBPVP8 fake-frigate-thumb"
INIT = b"\x00\x00\x00\x18ftypiso5fake-init"
SEG = b"\x00\x00\x00\x10moofdata-fake-seg"
PLAYLIST = """#EXTM3U
#EXT-X-TARGETDURATION:16
#EXT-X-ALLOW-CACHE:YES
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-VERSION:6
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-MAP:URI="init-v1.mp4"
#EXTINF:15.992,
seg-1-v1.m4s
#EXTINF:9.998,
seg-2-v1.m4s
#EXTINF:3.000,
seg-3-v1.m4s
#EXT-X-ENDLIST
"""


def camera_config(key: str, *, enabled: bool = True, w: int = 1920, h: int = 1080, snapshots: bool = False, onvif: bool = False, record: bool = True,
                  friendly: str | None = None) -> dict[str, Any]:
    inputs = [{"path": f"rtsp://{PLANTED_TOKEN_USER}:{PLANTED_PASSWORD}@192.0.2.10:554/stream-{key}", "roles": ["detect", "record"]}]
    return {
        "enabled": enabled, "enabled_in_config": enabled, "friendly_name": friendly,
        "ffmpeg": {"inputs": inputs, "output_args": {"record": "preset-record-generic"}},
        "ffmpeg_cmds": [{"roles": ["detect"], "cmd": f"ffmpeg -i rtsp://{PLANTED_TOKEN_USER}:{PLANTED_PASSWORD}@192.0.2.10:554/stream-{key} -f rawvideo"}],
        "detect": {"enabled": True, "width": w, "height": h, "fps": 5},
        "record": {"enabled": record},
        "snapshots": {"enabled": snapshots},
        "audio": {"enabled": False},
        "onvif": {"host": "192.0.2.11" if onvif else "", "user": PLANTED_TOKEN_USER if onvif else None, "password": PLANTED_PASSWORD if onvif else None},
        "objects": {"track": ["person", "car"] if key == "cam_front" else ["person"]},
        "zones": {"porch": {"coordinates": "0.1,0.1,0.5,0.5"}} if key == "cam_front" else {},
    }


def segment(cam: str, start: float, motion: int = 5, objects: int = 0) -> dict[str, Any]:
    return {"id": f"{start:.1f}-{cam[:5]}x", "start_time": start, "end_time": start + 9.99, "segment_size": 0.24, "motion": motion, "objects": objects,
            "motion_heatmap": {"4": motion}, "duration": 9.99}


def review(rid: str, cam: str, start: float, end: float | None, severity: str = "alert", objects: tuple[str, ...] = ("person",),
           zones: tuple[str, ...] = (), detections: tuple[str, ...] = ()) -> dict[str, Any]:
    return {"id": rid, "camera": cam, "start_time": start, "end_time": end, "severity": severity, "thumb_path": f"/media/frigate/clips/review/thumb-{cam}-{rid}.webp",
            "has_been_reviewed": False,
            "data": {"detections": list(detections) or [f"{start + 1:.6f}-det{rid[-3:]}"], "objects": list(objects), "verified_objects": [], "sub_labels": [], "zones": list(zones),
                     "audio": [], "thumb_time": start + 4, "metadata": None}}


class FakeFrigate:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.reset()

    def reset(self) -> None:
        self.version = "0.18.0-77a66e7"
        self.login_ok = True
        self.down = False
        self.expire_after: int | None = None
        self.viewer_blocks: set[str] = set()      # path prefixes a viewer role may not read (answered 403)
        self.openapi = True
        self.restream = False
        self.latest_status = 200
        self.cameras = {"cam_front": camera_config("cam_front", onvif=True, friendly="Front door"), "cam_yard": camera_config("cam_yard", w=2560, h=1440),
                        "cam_garage": camera_config("cam_garage", enabled=False)}
        self.reviews = [
            review("1791227000.100000-aaa111", "cam_front", T0 - 1000, T0 - 960, "alert", ("person",), ("porch",)),
            review("1791227500.200000-bbb222", "cam_yard", T0 - 500, T0 - 470, "detection", ("car",)),
            review("1791227900.300000-ccc333", "cam_front", T0 - 100, None, "alert", ("person", "dog")),
        ]
        self.events: list[dict[str, Any]] = []
        self.segments: dict[str, list[dict[str, Any]]] = {
            "cam_front": [segment("cam_front", T0 - 600 + 10 * i, 5 + i % 3, 2 if i % 4 == 0 else 0) for i in range(20)] + [segment("cam_front", T0 - 300 + 10 * i) for i in range(10)],
            "cam_yard": [], "cam_garage": [],
        }
        self.tokens: set[str] = set()
        self.issued = 0
        self.authed_requests = 0
        self.hits: list[str] = []
        self.non_get: list[str] = []
        self.logins = 0
        self.date_header: str | None = "Mon, 05 Oct 2026 18:00:03 GMT"
        self.stats_fps = {"cam_front": 5.0, "cam_yard": 4.9, "cam_garage": 0.0}

    # ------------------------------------------------------------------------------------------ documents

    def config(self) -> dict[str, Any]:
        return {
            "cameras": self.cameras,
            "detectors": {"coral1": {"type": "edgetpu", "device": "usb:0"}, "coral2": {"type": "edgetpu", "device": "usb:1"}},
            "mqtt": {"enabled": False, "host": "192.0.2.20", "user": PLANTED_TOKEN_USER, "password": "__FRIGATE_SAVED_CREDENTIAL__"},
            "record": {"enabled": True, "continuous": {"days": 0}, "motion": {"days": 10}, "alerts": {"pre_capture": 10, "post_capture": 15, "retain": {"days": 30, "mode": "motion"}},
                       "detections": {"retain": {"days": 30, "mode": "motion"}}},
            "review": {"alerts": {"labels": ["person", "car"]}},
            "semantic_search": {"enabled": True}, "face_recognition": {"enabled": False}, "lpr": {"enabled": False}, "genai": {"provider": None},
            "birdseye": {"enabled": False}, "notifications": {"enabled": False},
        }

    def stats(self) -> dict[str, Any]:
        cams = {k: {"camera_fps": f, "process_fps": f, "skipped_fps": 0.0, "detection_fps": f, "detection_enabled": True, "expected_fps": 5.0,
                    "reconnects_last_hour": 0, "stalls_last_hour": 0} for k, f in self.stats_fps.items()}
        return {"cameras": cams, "detectors": {"coral1": {"inference_speed": 8.5, "detection_start": 0.0, "pid": 1}, "coral2": {"inference_speed": 8.9, "detection_start": 0.0, "pid": 2}},
                "service": {"uptime": 86400, "version": self.version, "latest_version": "0.18.0",
                            "storage": {"/media/frigate/recordings": {"total": 1_000_000, "used": 400_000, "free": 600_000, "mount_type": "ext4"},
                                        "/tmp/cache": {"total": 4000, "used": 100, "free": 3900, "mount_type": "tmpfs"},
                                        "/dev/shm": {"total": 512, "used": 100, "free": 412, "mount_type": "tmpfs"}}}}

    def openapi_doc(self) -> dict[str, Any]:
        paths = ["/version", "/stats", "/config", "/review", "/review/{review_id}", "/review/summary", "/review/activity/motion", "/events", "/events/search", "/timeline",
                 "/{camera_name}/recordings", "/{camera_name}/latest.{extension}", "/export/{camera_name}/start/{start_time}/end/{end_time}", "/camera/{camera_name}/set/{feature}/{state}",
                 "/config/set", "/go2rtc/streams"]
        return {"openapi": "3.1.0", "paths": {p: {} for p in paths}}

    # ------------------------------------------------------------------------------------------ transport

    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handle)

    def _json(self, data: Any, status: int = 200) -> httpx.Response:
        return httpx.Response(status, json=data)

    def handle(self, request: httpx.Request) -> httpx.Response:
        with self.lock:
            return self._handle(request)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        q = dict(request.url.params)
        self.hits.append(f"{request.method} {path}")
        if self.down:
            raise httpx.ConnectError("down", request=request)
        if request.method != "GET":
            self.non_get.append(f"{request.method} {path}")
        if request.method == "POST" and path == "/api/login":
            body = json.loads(request.content or b"{}")
            if not self.login_ok or body.get("user") != USER or body.get("password") != PASSWORD:
                return httpx.Response(401, json={"message": "Login failed"})
            self.logins += 1
            self.issued += 1
            token = f"jwt-fake-{self.issued}"
            self.tokens.add(token)
            return httpx.Response(200, json={}, headers={"set-cookie": f"frigate_token={token}; Path=/; HttpOnly; SameSite=Lax"})
        if request.method != "GET":
            return httpx.Response(405)
        token = None
        for part in request.headers.get("cookie", "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == "frigate_token":
                token = v
        if token not in self.tokens:
            return httpx.Response(401, json={"message": "Unauthorized"})
        self.authed_requests += 1
        if self.expire_after is not None and self.authed_requests > self.expire_after:
            self.tokens.discard(token)
            self.expire_after = None
            return httpx.Response(401, json={"message": "Token expired"})
        for prefix in self.viewer_blocks:
            if path.startswith(prefix):
                return httpx.Response(403, json={"message": "Access denied for viewer"})
        if path == "/api/version":
            h = {"date": self.date_header} if self.date_header else {}
            return httpx.Response(200, text=self.version, headers=h)
        if path == "/api/stats":
            return self._json(self.stats())
        if path == "/api/config":
            return self._json(self.config())
        if path == "/api/openapi.json":
            return self._json(self.openapi_doc()) if self.openapi else httpx.Response(404)
        if path == "/api/go2rtc/streams":
            return self._json({"cam_front": {"producers": []}} if self.restream else {})
        if path == "/api/recordings/storage":
            return self._json({"cam_front": {"usage": 82902.75, "bandwidth": 120.0, "usage_percent": 4.2}, "cam_yard": {"usage": 24509.63, "bandwidth": 80.0, "usage_percent": 1.2}})
        if path == "/api/review/activity/motion":
            a, b = float(q["after"]), float(q["before"])
            return self._json([{"start_time": T0 - 600 + 30 * i, "motion": 10.5 + i, "camera": "cam_front,cam_yard"} for i in range(10) if a <= T0 - 600 + 30 * i <= b])
        if path == "/api/review/summary":
            return self._json({"last24Hours": {"reviewed_alert": 0, "reviewed_detection": 0, "total_alert": 2, "total_detection": 1}})
        if path == "/api/review":
            if "limit" not in q or "after" not in q:
                return httpx.Response(400)
            a, b = float(q["after"]), float(q["before"])
            rows = [r for r in self.reviews if r["start_time"] > a and r["start_time"] < b and (not q.get("severity") or r["severity"] == q["severity"])]
            return self._json(sorted(rows, key=lambda r: -r["start_time"])[: int(q["limit"])])
        if path.startswith("/api/review/"):
            rid = path.rsplit("/", 1)[1]
            for r in self.reviews:
                if r["id"] == rid:
                    return self._json(r)
            return httpx.Response(404, json={"message": "Review item not found"})
        if path == "/api/events":
            return self._json(self.events)
        if path.startswith("/api/events/") and path.endswith("/thumbnail.jpg"):
            return httpx.Response(200, content=JPEG, headers={"content-type": "image/jpeg"})
        if path.startswith("/clips/review/thumb-"):
            if any(r["id"] in path for r in self.reviews):
                return httpx.Response(200, content=WEBP, headers={"content-type": "image/webp"})
            return httpx.Response(404)
        parts = path.strip("/").split("/")
        if len(parts) == 3 and parts[0] == "api" and parts[2] == "latest.jpg":
            if parts[1] not in self.cameras:
                return httpx.Response(404)
            if self.latest_status != 200:
                return httpx.Response(self.latest_status)
            return httpx.Response(200, content=JPEG + (b"h" + q["h"].encode() if "h" in q else b""), headers={"content-type": "image/jpeg"})
        if len(parts) == 3 and parts[0] == "api" and parts[2] == "recordings":
            segs = [s for s in self.segments.get(parts[1], []) if s["end_time"] > float(q["after"]) and s["start_time"] < float(q["before"])]
            return self._json(segs)
        if len(parts) == 4 and parts[0] == "api" and parts[2:] == ["recordings", "summary"]:
            return self._json([{"day": "2026-10-05", "events": 3, "hours": [{"hour": "18", "events": 2, "motion": 120, "objects": 9, "duration": 300}]}])
        if parts[0] == "vod" and len(parts) >= 6:
            name = parts[-1]
            if name == "index.m3u8":
                return httpx.Response(200, text=PLAYLIST, headers={"content-type": "application/vnd.apple.mpegurl"})
            if name.startswith("init-"):
                return httpx.Response(200, content=INIT, headers={"content-type": "video/mp4"})
            if name.startswith("seg-"):
                return httpx.Response(200, content=SEG, headers={"content-type": "video/iso.segment"})
        return httpx.Response(404, json={"message": "not found"})


def settings_for(base: Any, **extra: Any) -> Any:
    """`base` (the conftest `settings`) pointed at the fake, vendor frigate, HTTP on the fake's port (`scheme: http` keeps the
    mock transport simple; the TLS modes have their own tests)."""
    import dataclasses

    return dataclasses.replace(base, nvr_host=HOST, nvr_http_port=8971, nvr_rtsp_port=554, nvr_user=USER, nvr_password=PASSWORD,
                               nvr_vendor="frigate", nvr_extra={"scheme": "http", **extra})
