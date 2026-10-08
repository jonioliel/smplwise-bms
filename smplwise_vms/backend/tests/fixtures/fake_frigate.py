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
        "motion": {"enabled": True, "improve_contrast": True},
        "review": {"alerts": {"enabled": True}, "detections": {"enabled": True}},
        "notifications": {"enabled": False},
        "birdseye": {"enabled": True},
        "onvif": {"host": "192.0.2.11" if onvif else "", "user": PLANTED_TOKEN_USER if onvif else None, "password": PLANTED_PASSWORD if onvif else None,
                  "autotracking": {"enabled": False}},
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
        # F2 (control): the write side. `writes` lists every accepted write as (method, path, body); `write_role_ok` False = the account
        # is a viewer (403 on every write); `reflect_runtime` False = a toggle is acknowledged but the effective config does not show it;
        # `write_status` forces that status on the next write only.
        self.writes: list[tuple[str, str, Any]] = []
        self.write_role_ok = True
        self.reflect_runtime = True
        self.write_status: int | None = None
        self.profiles = ["home", "away"]
        self.active_profile: str | None = None
        self.event_state: dict[str, dict[str, Any]] = {}
        # F2b: exports, cases and manual events. `export_reply_id` / `case_reply_id` False = the create answer carries no id (Arx must find it
        # by name in the list); `seq` numbers the generated ids.
        self.exports: list[dict[str, Any]] = [{"id": "cam_front_foreign", "camera": "cam_front", "name": "made in Frigate", "date": T0 - 5000.0, "video_path": "/media/frigate/exports/foreign.mp4",
                                              "thumb_path": "/media/frigate/exports/foreign.jpg", "in_progress": False, "export_case_id": None}]
        self.cases: list[dict[str, Any]] = [{"id": "case_foreign", "name": "made in Frigate", "description": "", "created_at": T0 - 4000.0, "updated_at": T0 - 4000.0}]
        self.export_reply_id = True
        # F2b clip read: `clip` is the body served for any clip.mp4 GET; `clip_status` / `clip_ctype` force an answer; `clip_hits` lists the clip GETs
        self.clip = b"\x00\x00\x00ftypmp42" + b"fake-clip-bytes-" * 64
        self.clip_status = 200
        self.clip_ctype = "video/mp4"
        self.clip_hits: list[str] = []
        self.case_reply_id = True
        self.event_reply_id = True
        self.seq = 0
        # FRGS config writes: `config_reflect` False = `PUT /api/config/set` is acknowledged but the effective config does not change;
        # `schema_served` False = `/api/config/schema.json` answers 404; `schema_drop` names camera-schema leaves left out of it
        self.config_reflect = True
        self.schema_served = True
        self.schema_drop: set[str] = set()

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

    FEATURE_PATHS = {"detect": ("detect", "enabled"), "motion": ("motion", "enabled"), "audio": ("audio", "enabled"), "review_alerts": ("review", "alerts", "enabled"),
                     "review_detections": ("review", "detections", "enabled"), "notifications": ("notifications", "enabled"), "improve_contrast": ("motion", "improve_contrast"),
                     "birdseye": ("birdseye", "enabled"), "ptz_autotracker": ("onvif", "autotracking", "enabled"), "enabled": ("enabled",), "recordings": ("record", "enabled"),
                     "snapshots": ("snapshots", "enabled")}

    def _write(self, request: httpx.Request, path: str) -> httpx.Response:
        """The F2 write routes of Frigate 0.18 as the adapter calls them (shapes NOT verified against a live instance)."""
        import re

        m = request.method
        if self.write_status is not None:
            st, self.write_status = self.write_status, None
            return httpx.Response(st, json={"message": "forced"})
        if not self.write_role_ok:
            return httpx.Response(403, json={"message": "Access denied for viewer"})
        try:
            body = json.loads(request.content) if request.content else None
        except ValueError:
            return httpx.Response(400, json={"message": "bad body"})
        mm = re.fullmatch(r"/api/camera/([^/]+)/set/([a-z_]+)", path)
        if m == "PUT" and mm:
            cam, feat = mm.groups()
            val = (body or {}).get("value")
            if feat == "profile" and cam == "*":
                if val != "none" and val not in self.profiles:
                    return httpx.Response(400, json={"message": "unknown profile"})
                self.active_profile = None if val == "none" else val
                self.writes.append((m, path, body))
                return self._json({"success": True})
            if cam not in self.cameras or feat not in self.FEATURE_PATHS or val not in ("ON", "OFF"):
                return httpx.Response(400, json={"message": "bad feature"})
            if self.reflect_runtime:
                node = self.cameras[cam]
                keys = self.FEATURE_PATHS[feat]
                for k in keys[:-1]:
                    node = node.setdefault(k, {})
                node[keys[-1]] = val == "ON"
            self.writes.append((m, path, body))
            return self._json({"success": True})
        if m == "POST" and path == "/api/reviews/viewed":
            ids = (body or {}).get("ids") or []
            for r in self.reviews:
                if r["id"] in ids:
                    r["has_been_reviewed"] = True
            self.writes.append((m, path, body))
            return self._json({"success": True})
        mm = re.fullmatch(r"/api/review/([^/]+)/viewed", path)
        if m == "DELETE" and mm:
            for r in self.reviews:
                if r["id"] == mm.group(1):
                    r["has_been_reviewed"] = False
            self.writes.append((m, path, body))
            return self._json({"success": True})
        mm = re.fullmatch(r"/api/events/([^/]+)/(retain|sub_label)", path)
        if mm:
            eid, what = mm.groups()
            st = self.event_state.setdefault(eid, {"retain": False, "sub_label": None})
            if what == "retain" and m in ("POST", "DELETE"):
                st["retain"] = m == "POST"
            elif what == "sub_label" and m == "POST":
                st["sub_label"] = (body or {}).get("subLabel")
            else:
                return httpx.Response(405)
            self.writes.append((m, path, body))
            return self._json({"success": True})
        if m == "PUT" and path == "/api/config/set":
            return self._config_set(body)
        return self._write_f2b(request, path, body)

    def _config_set(self, body: Any) -> httpx.Response:
        """FRGS: `PUT /api/config/set` with `{"requires_restart", "update_topic", "config_data"}` as the adapter sends it (shape NOT verified).
        Only camera sections are accepted here (the adapter never sends anything else); "" removes a key, as Frigate does."""
        data = (body or {}).get("config_data") if isinstance(body, dict) else None
        cams = data.get("cameras") if isinstance(data, dict) else None
        if not isinstance(cams, dict) or set(data) != {"cameras"} or any(c not in self.cameras for c in cams):
            return httpx.Response(400, json={"success": False, "message": "bad config_data"})
        if self.config_reflect:
            for cam, section in cams.items():
                _merge(self.cameras[cam], section)
        self.writes.append(("PUT", "/api/config/set", body))
        return self._json({"success": True, "message": "Config successfully updated, restart to apply" if body.get("requires_restart") else "Config successfully updated"})

    def config_schema(self) -> dict[str, Any]:
        """A small JSON schema in pydantic's shape ($defs + $ref) with the camera fields the adapter compares."""
        def obj(**props: Any) -> dict[str, Any]:
            return {"type": "object", "properties": props}

        num = {"type": "number"}
        cam = obj(detect=obj(fps=num, width=num, height=num), motion=obj(threshold=num, contour_area=num, lightning_threshold=num),
                  objects=obj(track={"type": "array"}), snapshots=obj(retain=obj(default=num)),
                  record=obj(alerts=obj(retain=obj(days=num)), detections=obj(retain=obj(days=num))), review=obj(alerts=obj(labels={"anyOf": [{"type": "array"}, {"type": "null"}]})),
                  zones={"type": "object", "additionalProperties": {"$ref": "#/$defs/ZoneConfig"}})
        zone = obj(coordinates={"type": "string"}, objects={"type": "array"}, inertia=num, loitering_time=num)
        for leaf in self.schema_drop:
            sec, _, key = leaf.partition(".")
            if sec == "zones":
                zone["properties"].pop(key, None)
            else:
                cam["properties"].get(sec, {}).get("properties", {}).pop(key, None)
        return {"$defs": {"CameraConfig": cam, "ZoneConfig": zone}, "type": "object",
                "properties": {"cameras": {"type": "object", "additionalProperties": {"$ref": "#/$defs/CameraConfig"}}}}
    def _write_f2b(self, request: httpx.Request, path: str, body: Any) -> httpx.Response:
        """F2b write routes (exports, cases, manual events) as the adapter calls them (shapes NOT verified against a live instance)."""
        import re

        m = request.method
        mm = re.fullmatch(r"/api/export/([^/]+)/start/([0-9.]+)/end/([0-9.]+)", path)
        if m == "POST" and mm:
            cam, a, b = mm.groups()
            if cam not in self.cameras or float(b) <= float(a) or not (body or {}).get("name"):
                return httpx.Response(400, json={"message": "bad export"})
            self.seq += 1
            eid = f"{cam}_{self.seq:06d}"
            self.exports.append({"id": eid, "camera": cam, "name": body["name"], "date": float(a), "video_path": f"/media/frigate/exports/{eid}.mp4", "thumb_path": f"/media/frigate/exports/{eid}.jpg",
                                 "in_progress": False, "export_case_id": None})
            self.writes.append((m, path, body))
            return self._json({"success": True, "message": "Starting export of recording.", **({"export_id": eid} if self.export_reply_id else {})})
        mm = re.fullmatch(r"/api/export/([^/]+)/rename", path)
        if m == "PATCH" and mm:
            for x in self.exports:
                if x["id"] == mm.group(1):
                    x["name"] = (body or {}).get("name") or x["name"]
                    self.writes.append((m, path, body))
                    return self._json({"success": True})
            return httpx.Response(404, json={"message": "Export not found"})
        mm = re.fullmatch(r"/api/export/([^/]+)", path)
        if m == "DELETE" and mm:
            n = len(self.exports)
            self.exports = [x for x in self.exports if x["id"] != mm.group(1)]
            if len(self.exports) == n:
                return httpx.Response(404, json={"message": "Export not found"})
            self.writes.append((m, path, body))
            return self._json({"success": True})
        if m == "POST" and path == "/api/cases":
            if not (body or {}).get("name"):
                return httpx.Response(400, json={"message": "bad case"})
            self.seq += 1
            case = {"id": f"case_{self.seq:06d}", "name": body["name"], "description": body.get("description") or "", "created_at": T0, "updated_at": T0}
            self.cases.append(case)
            self.writes.append((m, path, body))
            return self._json(case if self.case_reply_id else {"success": True})
        mm = re.fullmatch(r"/api/cases/([^/]+)", path)
        if mm and m in ("PATCH", "DELETE"):
            for c in self.cases:
                if c["id"] == mm.group(1):
                    if m == "PATCH":
                        c["name"] = (body or {}).get("name") or c["name"]
                    else:
                        self.cases.remove(c)
                    self.writes.append((m, path, body))
                    return self._json({"success": True})
            return httpx.Response(404, json={"message": "Case not found"})
        mm = re.fullmatch(r"/api/events/([^/]+)/([A-Za-z0-9_-]+)/create", path)
        if m == "POST" and mm:
            cam, label = mm.groups()
            if cam not in self.cameras:
                return httpx.Response(404, json={"message": "camera"})
            self.seq += 1
            eid = f"{1791228000 + self.seq}.000001-man{self.seq:03d}"
            dur = (body or {}).get("duration")
            self.event_state[eid] = {"retain": False, "sub_label": (body or {}).get("sub_label"), "camera": cam, "label": label, "start_time": T0, "end_time": (T0 + dur) if dur else None}
            self.writes.append((m, path, body))
            return self._json({"success": True, "message": "Successfully created manual event.", **({"event_id": eid} if self.event_reply_id else {})})
        mm = re.fullmatch(r"/api/events/([^/]+)/end", path)
        if m == "PUT" and mm:
            st = self.event_state.get(mm.group(1))
            if st is None:
                return httpx.Response(404, json={"message": "Event not found"})
            st["end_time"] = (body or {}).get("end_time") or T0
            self.writes.append((m, path, body))
            return self._json({"success": True})
        return httpx.Response(405)

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
        token = None
        for part in request.headers.get("cookie", "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == "frigate_token":
                token = v
        if token not in self.tokens:
            return httpx.Response(401, json={"message": "Unauthorized"})
        self.authed_requests += 1
        if request.method != "GET":
            return self._write(request, path)
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
        if path == "/api/config/schema.json":
            return self._json(self.config_schema()) if self.schema_served else httpx.Response(404, json={"message": "not found"})
        if path == "/api/openapi.json":
            return self._json(self.openapi_doc()) if self.openapi else httpx.Response(404)
        if path == "/api/go2rtc/streams":
            return self._json({"cam_front": {"producers": []}} if self.restream else {})
        if path == "/api/recordings/storage":
            return self._json({"cam_front": {"usage": 82902.75, "bandwidth": 120.0, "usage_percent": 4.2}, "cam_yard": {"usage": 24509.63, "bandwidth": 80.0, "usage_percent": 1.2}})
        if path == "/api/review/activity/motion":
            a, b = float(q["after"]), float(q["before"])
            return self._json([{"start_time": T0 - 600 + 30 * i, "motion": 10.5 + i, "camera": "cam_front,cam_yard"} for i in range(10) if a <= T0 - 600 + 30 * i <= b])
        if path.endswith("/clip.mp4") and (path.startswith("/api/events/") or "/start/" in path):
            self.clip_hits.append(path)
            if self.clip_status != 200:
                return httpx.Response(self.clip_status, json={"message": "no clip"})
            return httpx.Response(200, content=self.clip, headers={"content-type": self.clip_ctype, "content-length": str(len(self.clip))})
        if path == "/api/exports":
            return self._json([dict(x) for x in self.exports])
        if path == "/api/cases":
            return self._json([dict(x) for x in self.cases])
        if path == "/api/profiles":
            return self._json(list(self.profiles))
        if path == "/api/profile/active":
            return httpx.Response(200, content=json.dumps(self.active_profile), headers={"content-type": "application/json"})
        if path.startswith("/api/events/") and path.count("/") == 3:
            eid = path.rsplit("/", 1)[1]
            known = {d for r in self.reviews for d in r["data"]["detections"]}
            if eid not in known and eid not in self.event_state:
                return httpx.Response(404, json={"message": "Event not found"})
            st = self.event_state.setdefault(eid, {"retain": False, "sub_label": None})
            return self._json({"id": eid, "camera": st.get("camera", "cam_front"), "label": st.get("label", "person"), "sub_label": st["sub_label"], "retain_indefinitely": st["retain"],
                               "start_time": st.get("start_time", T0 - 100), "end_time": st.get("end_time", T0 - 90)})
        parts0 = path.strip("/").split("/")
        if len(parts0) == 4 and parts0[0] == "api" and parts0[2:] == ["ptz", "info"]:
            return self._json({"name": parts0[1], "presets": ["door", "gate"]} if parts0[1] == "cam_front" else {})
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


def _merge(node: dict[str, Any], patch: dict[str, Any]) -> None:
    for k, v in patch.items():
        if v == "":
            node.pop(k, None)
        elif isinstance(v, dict):
            child = node.get(k)
            if not isinstance(child, dict):
                child = node[k] = {}
            _merge(child, v)
        else:
            node[k] = v


class FakeWsConnect:
    """A stand-in for `websockets.sync.client.connect` that records what is sent (PTZ messages). `fail` makes the connection raise."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.sent: list[dict[str, Any]] = []
        self.fail = False

    def __call__(self, url: str, **kwargs: Any) -> "FakeWsConnect":
        if self.fail:
            raise OSError("ws down")
        self.calls.append(url)
        return self

    def __enter__(self) -> "FakeWsConnect":
        return self

    def __exit__(self, *a: Any) -> None:
        return None

    def send(self, msg: str) -> None:
        self.sent.append(json.loads(msg))


def settings_for(base: Any, **extra: Any) -> Any:
    """`base` (the conftest `settings`) pointed at the fake, vendor frigate, HTTP on the fake's port (`scheme: http` keeps the
    mock transport simple; the TLS modes have their own tests)."""
    import dataclasses

    return dataclasses.replace(base, nvr_host=HOST, nvr_http_port=8971, nvr_rtsp_port=554, nvr_user=USER, nvr_password=PASSWORD,
                               nvr_vendor="frigate", nvr_extra={"scheme": "http", **extra})
