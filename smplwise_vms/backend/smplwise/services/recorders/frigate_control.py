"""Frigate runtime control, phase F2 "control and act" (NN5, docs/changes/CR-029-FRIGATE-PROVIDER.md; study section 7.6).

Device I/O only, like the rest of the adapter: no SQLite, no audit, no permission decisions (those are `services/frigate_control_svc`).
Every function here is ONE write (or one read of the state it changes) and belongs to exactly one write class of
`frigate_http.WRITE_ALLOWED`; none of them is reachable from an F1 read path. Nothing is queued and nothing is retried: a failed or
unanswered write is reported, never repeated.

Wire shapes that were NOT verified against a live Frigate (the study never wrote anything): `PUT /api/camera/{cam}/set/{feature}` with
a JSON body `{"value": "ON" | "OFF"}`, `PUT /api/camera/*/set/profile` with `{"value": "<name>" | "none"}`, `POST /api/reviews/viewed`
with `{"ids": [...]}`, `DELETE /api/review/{id}/viewed`, `POST|DELETE /api/events/{id}/retain`, `POST /api/events/{id}/sub_label` with
`{"subLabel": "<text>"}`, and the PTZ message `{"topic": "<cam>/ptz", "payload": "<command>"}` on `/ws`. Each lives in exactly one place
below so the first supervised write on the owner's instance can correct it in one line. The state read-back uses the effective
`GET /api/config` (a runtime toggle is expected to show there); when it does not, the change is logged as `unverified`, not as failed.
"""
from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable
from typing import Any

from ...errors import ApiError
from .frigate import CAMERA_KEY, FrigateAdapter
from .frigate_http import ANALYTICS_FEATURES, RECORD_FEATURES, ID, LABEL, OBJ, q

# feature -> where its switch lives in a camera's section of the effective config
FEATURE_PATHS: dict[str, tuple[str, ...]] = {
    "detect": ("detect", "enabled"),
    "motion": ("motion", "enabled"),
    "audio": ("audio", "enabled"),
    "review_alerts": ("review", "alerts", "enabled"),
    "review_detections": ("review", "detections", "enabled"),
    "notifications": ("notifications", "enabled"),
    "improve_contrast": ("motion", "improve_contrast"),
    "birdseye": ("birdseye", "enabled"),
    "ptz_autotracker": ("onvif", "autotracking", "enabled"),
    "enabled": ("enabled",),
    "recordings": ("record", "enabled"),
    "snapshots": ("snapshots", "enabled"),
}
FEATURE_CLASS = {**{f: "analytics" for f in ANALYTICS_FEATURES}, **{f: "record" for f in RECORD_FEATURES}}
PROFILE_NAME = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
EVENT_ID = re.compile(rf"^{ID}$")
SUB_LABEL_MAX = 60
OBJECT_ID = re.compile(rf"^{OBJ}$")
LABEL_NAME = re.compile(rf"^{LABEL}$")
NAME_MAX = 80
EXPORT_MAX_S = 7200.0          # one export covers at most two hours of ONE camera
EVENT_MAX_S = 600              # a manual event with a duration lasts at most ten minutes; an open one must be ended by hand
LIST_MAX = 300

# PTZ: single steps only. There is no patrol, no loop, no autotrack start: a command is one message and one physical step.
PTZ_STEPS = ("MOVE_UP", "MOVE_DOWN", "MOVE_LEFT", "MOVE_RIGHT", "ZOOM_IN", "ZOOM_OUT", "STOP")
PTZ_PRESET = re.compile(r"^preset_[A-Za-z0-9_-]{1,32}$")
WS_CONNECT: Callable[..., Any] | None = None   # tests: a fake `websockets.sync.client.connect`
WS_TIMEOUT_S = 6.0


def normalize_ptz(command: str) -> str:
    """`move_left` / `MOVE_LEFT` -> `MOVE_LEFT`; `preset_door` stays as written; anything else is refused (422)."""
    c = (command or "").strip()
    if PTZ_PRESET.fullmatch(c):
        return c
    if c.upper() in PTZ_STEPS:
        return c.upper()
    raise ApiError(422, "ptz_command_invalid", "פקודת PTZ אינה מותרת (צעד בודד, זום, עצירה או נקודה שמורה בלבד).", details={"allowed": list(PTZ_STEPS) + ["preset_<name>"]})


def feature_class(feature: str) -> str:
    cls = FEATURE_CLASS.get(feature)
    if cls is None:
        raise ApiError(422, "frigate_feature_unknown", "המתג אינו מוכר.", details={"feature": feature[:40]})
    return cls


def _dig(doc: Any, path: tuple[str, ...]) -> bool | None:
    for key in path:
        if not isinstance(doc, dict):
            return None
        doc = doc.get(key)
    return doc if isinstance(doc, bool) else None


def state_hash(features: dict[str, bool | None]) -> str:
    return hashlib.sha256(json.dumps(features, sort_keys=True).encode("utf-8")).hexdigest()[:16]


class FrigateControl:
    """The F2 operations of one recorder. Constructed over a `FrigateAdapter` (its HTTP session); safe to build per request."""

    def __init__(self, adapter: FrigateAdapter) -> None:
        self.adapter = adapter
        self.http = adapter.http

    # ------------------------------------------------------------------------------------------ reads of the state a write changes

    def read_features(self, camera: str) -> dict[str, bool | None]:
        """Every known switch of one camera as the effective config shows it (True / False, None = not reported). Only these booleans
        are read out of `/api/config`: the rest of the document (stream URLs with credentials) never leaves this function."""
        FrigateAdapter._camera(camera)
        cfg = self.http.get_json("/api/config")
        cams = cfg.get("cameras") if isinstance(cfg, dict) else None
        cam = cams.get(camera) if isinstance(cams, dict) else None
        if not isinstance(cam, dict):
            raise ApiError(404, "not_found", "המצלמה לא נמצאה ב־Frigate.", details={"op": "config"})
        return {f: _dig(cam, p) for f, p in FEATURE_PATHS.items()}

    def active_profile(self) -> dict[str, Any]:
        """{"names": [...], "active": str | None}; a Frigate without profiles answers an empty list."""
        names: list[str] = []
        active: str | None = None
        try:
            doc = self.http.get_json("/api/profiles", optional=True)
        except ApiError as exc:
            if exc.code != "frigate_route_missing":
                raise
            doc = []
        if isinstance(doc, list):
            names = [str(x.get("name") if isinstance(x, dict) else x) for x in doc if (x.get("name") if isinstance(x, dict) else x)]
        elif isinstance(doc, dict):
            names = [str(k) for k in doc]
        try:
            act = self.http.get_json("/api/profile/active", optional=True)
        except ApiError as exc:
            if exc.code != "frigate_route_missing":
                raise
            act = None
        if isinstance(act, dict):
            act = act.get("name") or act.get("profile") or act.get("active")
        if isinstance(act, str) and act and act.lower() != "none":
            active = act
        return {"names": sorted(set(n for n in names if PROFILE_NAME.fullmatch(n)))[:40], "active": active}

    def event(self, event_id: str) -> dict[str, Any]:
        if not EVENT_ID.fullmatch(event_id or ""):
            raise ApiError(422, "frigate_event_invalid", "מזהה אירוע לא תקין.")
        doc = self.http.get_json(f"/api/events/{q(event_id)}")
        if not isinstance(doc, dict):
            raise ApiError(503, "source_invalid", "תשובת Frigate אינה מסמך תקין.", details={"op": "event"})
        return {"id": event_id, "retain": bool(doc.get("retain_indefinitely")), "sub_label": doc.get("sub_label") if isinstance(doc.get("sub_label"), str) else None}

    def event_detail(self, event_id: str) -> dict[str, Any]:
        """One tracked object / manual event as a small, fixed document (read-back of a manual create / end)."""
        if not EVENT_ID.fullmatch(event_id or ""):
            raise ApiError(422, "frigate_event_invalid", "מזהה אירוע לא תקין.")
        doc = self.http.get_json(f"/api/events/{q(event_id)}")
        if not isinstance(doc, dict):
            raise ApiError(503, "source_invalid", "תשובת Frigate אינה מסמך תקין.", details={"op": "event"})
        end = doc.get("end_time")
        return {"id": event_id, "camera": doc.get("camera") if isinstance(doc.get("camera"), str) else None, "label": doc.get("label") if isinstance(doc.get("label"), str) else None,
                "start_time": doc.get("start_time") if isinstance(doc.get("start_time"), (int, float)) else None,
                "end_time": end if isinstance(end, (int, float)) and not isinstance(end, bool) else None}

    def list_exports(self) -> list[dict[str, Any]]:
        """Frigate exports as small fixed rows: file paths and thumbnails never leave the adapter (they name Frigate's disk)."""
        doc = self.http.get_json("/api/exports", control=True)
        if not isinstance(doc, list):
            raise ApiError(503, "source_invalid", "תשובת Frigate אינה מסמך תקין.", details={"op": "exports"})
        out = []
        for x in doc[:LIST_MAX]:
            if isinstance(x, dict) and isinstance(x.get("id"), str) and OBJECT_ID.fullmatch(x["id"]):
                out.append({"id": x["id"], "camera": x.get("camera") if isinstance(x.get("camera"), str) else None, "name": (x.get("name") or "")[:NAME_MAX] if isinstance(x.get("name"), str) else "",
                            "date": x.get("date") if isinstance(x.get("date"), (int, float)) else None, "in_progress": bool(x.get("in_progress")),
                            "case_id": x.get("export_case_id") if isinstance(x.get("export_case_id"), str) else None})
        return out

    def list_cases(self) -> list[dict[str, Any]]:
        doc = self.http.get_json("/api/cases", control=True)
        if not isinstance(doc, list):
            raise ApiError(503, "source_invalid", "תשובת Frigate אינה מסמך תקין.", details={"op": "cases"})
        out = []
        for x in doc[:LIST_MAX]:
            if isinstance(x, dict) and isinstance(x.get("id"), str) and OBJECT_ID.fullmatch(x["id"]):
                out.append({"id": x["id"], "name": (x.get("name") or "")[:NAME_MAX] if isinstance(x.get("name"), str) else "",
                            "description": (x.get("description") or "")[:200] if isinstance(x.get("description"), str) else "",
                            "created_at": x.get("created_at") if isinstance(x.get("created_at"), (int, float)) else None})
        return out

    def ptz_info(self, camera: str) -> dict[str, Any]:
        FrigateAdapter._camera(camera)
        try:
            doc = self.http.get_json(f"/api/{camera}/ptz/info", optional=True, control=True)
        except ApiError as exc:
            if exc.code in ("frigate_route_missing", "not_found"):
                return {"available": False, "presets": []}
            raise
        if not isinstance(doc, dict) or not doc:
            return {"available": False, "presets": []}
        presets = [str(p) for p in (doc.get("presets") or []) if isinstance(p, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,32}", p)][:50]
        return {"available": True, "presets": presets}

    # ------------------------------------------------------------------------------------------ writes (one call each)

    def set_feature(self, camera: str, feature: str, on: bool) -> None:
        """W1 / W2: one runtime switch of ONE camera (`*` is not a camera key and is refused by the allow-list)."""
        FrigateAdapter._camera(camera)
        klass = feature_class(feature)
        self.http.write(klass, "PUT", f"/api/camera/{camera}/set/{feature}", {"value": "ON" if on else "OFF"})

    def set_profile(self, name: str | None) -> None:
        """W3: the active profile for the whole Frigate (`None` = no profile). Frigate clears the runtime toggles on a switch."""
        if name is not None and not PROFILE_NAME.fullmatch(name):
            raise ApiError(422, "frigate_profile_invalid", "שם פרופיל לא תקין.")
        self.http.write("profile", "PUT", "/api/camera/*/set/profile", {"value": name or "none"})

    def mark_reviewed(self, ids: list[str]) -> None:
        """Mark review items viewed in Frigate (its flag belongs to the account Arx uses)."""
        for rid in ids:
            if not re.fullmatch(ID, rid):
                raise ApiError(422, "frigate_review_invalid", "מזהה פריט סקירה לא תקין.")
        if ids:
            self.http.write("review", "POST", "/api/reviews/viewed", {"ids": list(ids)})

    def unmark_reviewed(self, review_id: str) -> None:
        if not re.fullmatch(ID, review_id):
            raise ApiError(422, "frigate_review_invalid", "מזהה פריט סקירה לא תקין.")
        self.http.write("review", "DELETE", f"/api/review/{q(review_id)}/viewed")

    def set_retain(self, event_id: str, on: bool) -> None:
        if not EVENT_ID.fullmatch(event_id or ""):
            raise ApiError(422, "frigate_event_invalid", "מזהה אירוע לא תקין.")
        self.http.write("events", "POST" if on else "DELETE", f"/api/events/{q(event_id)}/retain")

    def set_sub_label(self, event_id: str, label: str | None) -> None:
        if not EVENT_ID.fullmatch(event_id or ""):
            raise ApiError(422, "frigate_event_invalid", "מזהה אירוע לא תקין.")
        label = (label or "").strip()
        if len(label) > SUB_LABEL_MAX or any(ord(ch) < 32 for ch in label):
            raise ApiError(422, "frigate_sub_label_invalid", "התווית אינה תקינה.", details={"max": SUB_LABEL_MAX})
        self.http.write("events", "POST", f"/api/events/{q(event_id)}/sub_label", {"subLabel": label or None})

    # ------------------------------------------------------------------------------------------ F2b writes (wire shapes NOT verified)

    @staticmethod
    def _name(value: str | None) -> str:
        v = (value or "").strip()
        if not v or len(v) > NAME_MAX or any(ord(ch) < 32 for ch in v):
            raise ApiError(422, "frigate_name_invalid", "השם אינו תקין.", details={"max": NAME_MAX})
        return v

    @staticmethod
    def _object(value: str | None) -> str:
        if not OBJECT_ID.fullmatch(value or ""):
            raise ApiError(422, "frigate_object_invalid", "מזהה לא תקין.")
        return value or ""

    def create_export(self, camera: str, start: float, end: float, name: str) -> str:
        """`POST /api/export/{cam}/start/{start}/end/{end}` with `{"name", "playback": "realtime"}`; the new export's id is read from the
        answer (`export_id`). Returns "" when the answer carries no id (the caller then finds it by name in the list)."""
        FrigateAdapter._camera(camera)
        if not (end > start and end - start <= EXPORT_MAX_S and start > 0):
            raise ApiError(422, "frigate_export_range_invalid", "טווח הייצוא אינו תקין.", details={"max_s": int(EXPORT_MAX_S)})
        reply = self.http.write("exports", "POST", f"/api/export/{camera}/start/{start:.3f}/end/{end:.3f}", {"name": self._name(name), "playback": "realtime"})
        try:
            doc = reply.json()
        except ApiError:
            return ""
        eid = doc.get("export_id") if isinstance(doc, dict) else None
        return eid if isinstance(eid, str) and OBJECT_ID.fullmatch(eid) else ""

    def rename_export(self, export_id: str, name: str) -> None:
        self.http.write("exports", "PATCH", f"/api/export/{q(self._object(export_id))}/rename", {"name": self._name(name)})

    def delete_export(self, export_id: str) -> None:
        self.http.write("exports", "DELETE", f"/api/export/{q(self._object(export_id))}")

    def create_case(self, name: str, description: str | None) -> str:
        """`POST /api/cases` with `{"name", "description"}`; the case id is read from the answer (`id`)."""
        desc = (description or "").strip()
        if len(desc) > 200 or any(ord(ch) < 32 for ch in desc):
            raise ApiError(422, "frigate_name_invalid", "התיאור אינו תקין.", details={"max": 200})
        reply = self.http.write("cases", "POST", "/api/cases", {"name": self._name(name), "description": desc})
        try:
            doc = reply.json()
        except ApiError:
            return ""
        cid = doc.get("id") if isinstance(doc, dict) else None
        return cid if isinstance(cid, str) and OBJECT_ID.fullmatch(cid) else ""

    def rename_case(self, case_id: str, name: str) -> None:
        self.http.write("cases", "PATCH", f"/api/cases/{q(self._object(case_id))}", {"name": self._name(name)})

    def delete_case(self, case_id: str) -> None:
        self.http.write("cases", "DELETE", f"/api/cases/{q(self._object(case_id))}")

    def create_event(self, camera: str, label: str, *, duration_s: int | None, sub_label: str | None) -> str:
        """`POST /api/events/{cam}/{label}/create` with `{"sub_label", "duration", "include_recording": true, "score": 0, "draw": {}}`; returns
        the new event id (`event_id` in the answer) or "" when the answer carries none. `duration_s=None` leaves the event open until it is ended."""
        FrigateAdapter._camera(camera)
        if not LABEL_NAME.fullmatch(label or ""):
            raise ApiError(422, "frigate_label_invalid", "התווית אינה תקינה.")
        if duration_s is not None and not 1 <= duration_s <= EVENT_MAX_S:
            raise ApiError(422, "frigate_event_duration_invalid", "משך האירוע אינו תקין.", details={"max_s": EVENT_MAX_S})
        sub = (sub_label or "").strip() or None
        if sub is not None and (len(sub) > SUB_LABEL_MAX or any(ord(ch) < 32 for ch in sub)):
            raise ApiError(422, "frigate_sub_label_invalid", "התווית אינה תקינה.", details={"max": SUB_LABEL_MAX})
        reply = self.http.write("events", "POST", f"/api/events/{camera}/{label}/create",
                                {"sub_label": sub, "duration": duration_s, "include_recording": True, "score": 0, "draw": {}})
        try:
            doc = reply.json()
        except ApiError:
            return ""
        eid = doc.get("event_id") if isinstance(doc, dict) else None
        return eid if isinstance(eid, str) and EVENT_ID.fullmatch(eid) else ""

    def end_event(self, event_id: str, end_time: float) -> None:
        """`PUT /api/events/{id}/end` with `{"end_time": <epoch seconds>}`."""
        if not EVENT_ID.fullmatch(event_id or ""):
            raise ApiError(422, "frigate_event_invalid", "מזהה אירוע לא תקין.")
        self.http.write("events", "PUT", f"/api/events/{q(event_id)}/end", {"end_time": round(float(end_time), 3)})

    def ptz(self, camera: str, command: str) -> None:
        """W4: ONE PTZ message over `/ws`. The caller (service) has already checked the release flag, the class, the permission and the
        lease. A failure is raised as it happened; this function never retries and never repeats a step."""
        FrigateAdapter._camera(camera)
        cmd = normalize_ptz(command)
        connect = WS_CONNECT
        if connect is None:
            from websockets.sync.client import connect as ws_connect

            connect = ws_connect
        url, headers, ssl_ctx = self.http.websocket_url(), self.http.websocket_headers(), self.http.websocket_ssl()
        kwargs: dict[str, Any] = {"additional_headers": headers, "open_timeout": WS_TIMEOUT_S, "max_size": 100_000}
        if ssl_ctx is not None:
            kwargs["ssl"] = ssl_ctx
        try:
            with connect(url, **kwargs) as ws:
                ws.send(json.dumps({"topic": f"{camera}/ptz", "payload": cmd}))
        except Exception as exc:  # noqa: BLE001 - a socket problem is "outcome unknown" for a physical step: report it, do not repeat it
            raise ApiError(503, "frigate_write_unknown", "לא ידוע אם פקודת ה־PTZ בוצעה. בדקו במצלמה לפני ניסיון נוסף.", details={"op": "ptz", "error": type(exc).__name__}) from exc


__all__ = ["FrigateControl", "FEATURE_PATHS", "FEATURE_CLASS", "PTZ_STEPS", "normalize_ptz", "state_hash", "feature_class", "CAMERA_KEY"]
