"""Frigate configuration: zones and a curated set of camera settings (FRGS, docs/changes/CR-029-FRIGATE-PROVIDER.md section 13).

Device I/O and pure rules only, like `frigate_control.py`: no SQLite, no audit, no permission decisions (those are
`services/frigate_config_svc.py`).

What Arx knows about Frigate's configuration is the SCHEMA below (`SETTINGS`, `ZONE_FIELDS`), written for Frigate 0.18 by hand: a small,
allow-listed subset of the camera section that is safe to edit from an operator product. Nothing outside it can be written: a settings
write names one section of ONE camera and only keys of that section that are in `SETTINGS`; a zone write names one zone of ONE camera.
The rest of Frigate's configuration (inputs with credentials, detectors, MQTT, go2rtc, users, global sections) is never read out of
`/api/config` here and never written.

The current values come from the existing read path (`GET /api/config`, on `GET_ALLOWED`), reduced to the fields of the schema. The
optional comparison with the instance's own JSON schema (`GET /api/config/schema.json`, a control read, `CONTROL_GET_ALLOWED`) only
reports which of our fields that Frigate does not know; it never widens what Arx writes.

Wire shape of the write (NOT verified against a live Frigate; it sits in `_set` alone so the supervised session can fix it in one place):
`PUT /api/config/set` with `{"requires_restart": 0, "update_topic": "config/cameras/<cam>/<section>", "config_data": {"cameras":
{"<cam>": {"<section>": {...}}}}}`; an empty string as a value removes that key (Frigate then uses its default), which is how a zone is
deleted. Frigate persists this in its configuration file: unlike the runtime toggles of F2 it survives a restart.
"""
from __future__ import annotations

import json
import math
import re
from typing import Any

from ...errors import ApiError
from .frigate import FrigateAdapter

SCHEMA_VERSION = "arx-frigate-0.18/1"
ZONE_NAME = re.compile(r"^[a-z0-9_]{1,40}$")   # Frigate zone names (lower case, digits, underscore); UNVERIFIED upper bound
ZONE_POINTS_MIN = 3
ZONE_POINTS_MAX = 40
ZONES_MAX = 24
LABEL = re.compile(r"^[a-z0-9_]{1,40}$")
LABELS_MAX = 30
# The labels offered in a picker (Frigate's default COCO model; a label the camera already tracks is always kept)
KNOWN_LABELS = ("person", "car", "bicycle", "motorcycle", "bus", "truck", "dog", "cat", "bird", "horse", "package", "face", "license_plate")
PRECISION = 4

# The curated camera settings. key = dotted path inside ONE camera's section of the config; section = its first part (one write = one
# section, because Frigate takes one update topic per write). Types: int | number | labels. `default` is Frigate 0.18's documented default.
SETTINGS: tuple[dict[str, Any], ...] = (
    {"key": "detect.fps", "section": "detect", "type": "int", "min": 1, "max": 30, "default": 5, "unit": "fps"},
    {"key": "motion.threshold", "section": "motion", "type": "int", "min": 1, "max": 255, "default": 30},
    {"key": "motion.contour_area", "section": "motion", "type": "int", "min": 1, "max": 1000, "default": 10},
    {"key": "motion.lightning_threshold", "section": "motion", "type": "number", "min": 0.3, "max": 1.0, "step": 0.05, "default": 0.8},
    {"key": "objects.track", "section": "objects", "type": "labels", "default": ["person"]},
    {"key": "snapshots.retain.default", "section": "snapshots", "type": "int", "min": 0, "max": 365, "default": 10, "unit": "days"},
    {"key": "record.alerts.retain.days", "section": "record", "type": "int", "min": 0, "max": 365, "default": 10, "unit": "days"},
    {"key": "record.detections.retain.days", "section": "record", "type": "int", "min": 0, "max": 365, "default": 10, "unit": "days"},
    {"key": "review.alerts.labels", "section": "review", "type": "labels", "default": ["person", "car"]},
)
SETTING = {s["key"]: s for s in SETTINGS}
SECTIONS = tuple(dict.fromkeys(s["section"] for s in SETTINGS))
ZONE_FIELDS: tuple[dict[str, Any], ...] = (
    {"key": "points", "type": "polygon", "min_points": ZONE_POINTS_MIN, "max_points": ZONE_POINTS_MAX},
    {"key": "objects", "type": "labels", "default": []},
    {"key": "inertia", "type": "int", "min": 1, "max": 10, "default": 3},
    {"key": "loitering_time", "type": "int", "min": 0, "max": 3600, "default": 0, "unit": "s"},
)


def schema() -> dict[str, Any]:
    """The schema as Arx knows it (static; the same for every recorder)."""
    return {"version": SCHEMA_VERSION, "sections": list(SECTIONS), "settings": [dict(s) for s in SETTINGS],
            "zone": {"fields": [dict(f) for f in ZONE_FIELDS], "name_pattern": ZONE_NAME.pattern, "max_zones": ZONES_MAX},
            "labels": list(KNOWN_LABELS), "persists": True}


# ---------------------------------------------------------------------------------------------- validation (pure)

def zone_name(name: str) -> str:
    if not ZONE_NAME.fullmatch(name or ""):
        raise ApiError(422, "frigate_zone_name_invalid", "שם האזור אינו תקין (אותיות לטיניות קטנות, ספרות וקו תחתון).", details={"pattern": ZONE_NAME.pattern})
    return name


def labels(value: Any, *, field: str) -> list[str]:
    if not isinstance(value, list) or len(value) > LABELS_MAX or not all(isinstance(x, str) and LABEL.fullmatch(x) for x in value):
        raise ApiError(422, "frigate_config_value_invalid", "רשימת העצמים אינה תקינה.", details={"key": field})
    return sorted(set(value))


def points(value: Any) -> list[list[float]]:
    """A polygon in relative frame coordinates (0..1, x right, y down; never mirrored), 3..40 points, no repeated point, non-zero area."""
    if not isinstance(value, list) or not ZONE_POINTS_MIN <= len(value) <= ZONE_POINTS_MAX:
        raise ApiError(422, "frigate_zone_points_invalid", "לאזור צריכות להיות בין 3 ל־40 נקודות.", details={"min": ZONE_POINTS_MIN, "max": ZONE_POINTS_MAX})
    out: list[list[float]] = []
    for p in value:
        if not (isinstance(p, (list, tuple)) and len(p) == 2 and all(isinstance(c, (int, float)) and not isinstance(c, bool) and math.isfinite(c) and 0 <= c <= 1 for c in p)):
            raise ApiError(422, "frigate_zone_points_invalid", "נקודת אזור מחוץ לתמונה.")
        out.append([round(float(p[0]), PRECISION), round(float(p[1]), PRECISION)])
    if len({tuple(p) for p in out}) != len(out):
        raise ApiError(422, "frigate_zone_points_invalid", "יש נקודות כפולות באזור.")
    area = sum(out[i][0] * out[(i + 1) % len(out)][1] - out[(i + 1) % len(out)][0] * out[i][1] for i in range(len(out))) / 2
    if abs(area) < 1e-4:
        raise ApiError(422, "frigate_zone_points_invalid", "האזור קטן מדי.")
    return out


def _int(value: Any, lo: int, hi: int, key: str) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or int(value) != value or not lo <= value <= hi:
        raise ApiError(422, "frigate_config_value_invalid", "הערך מחוץ לטווח.", details={"key": key, "min": lo, "max": hi})
    return int(value)


def setting_value(key: str, value: Any) -> Any:
    """One value of `SETTINGS`, checked against its type and range; None = remove the key (Frigate's default applies)."""
    spec = SETTING.get(key)
    if spec is None:
        raise ApiError(422, "frigate_config_key_unknown", "ההגדרה אינה מוכרת.", details={"key": str(key)[:60]})
    if value is None:
        return None
    if spec["type"] == "int":
        return _int(value, spec["min"], spec["max"], key)
    if spec["type"] == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not spec["min"] <= value <= spec["max"]:
            raise ApiError(422, "frigate_config_value_invalid", "הערך מחוץ לטווח.", details={"key": key, "min": spec["min"], "max": spec["max"]})
        return round(float(value), 3)
    return labels(value, field=key)


def zone_in(body: dict[str, Any]) -> dict[str, Any]:
    """A zone as Arx writes it: points, objects (empty = every object), inertia and loitering time (None = Frigate's default)."""
    z = {"points": points(body.get("points")), "objects": labels(body.get("objects") or [], field="objects"),
         "inertia": None if body.get("inertia") is None else _int(body.get("inertia"), 1, 10, "inertia"),
         "loitering_time": None if body.get("loitering_time") is None else _int(body.get("loitering_time"), 0, 3600, "loitering_time")}
    return z


# ---------------------------------------------------------------------------------------------- reading (the effective config)

def _dig(doc: Any, path: list[str]) -> Any:
    for k in path:
        if not isinstance(doc, dict):
            return None
        doc = doc.get(k)
    return doc


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def parse_points(coords: Any, width: int | None, height: int | None) -> list[list[float]] | None:
    """Frigate keeps a zone's polygon as "x1,y1,x2,y2,..." (or a list of "x,y" strings), relative (0..1) or in detect pixels. Returned
    relative, rounded; None when it cannot be read (such a zone is shown read-only)."""
    if isinstance(coords, list):
        coords = ",".join(str(c) for c in coords)
    if not isinstance(coords, str):
        return None
    vals = [_num(x) for x in coords.split(",") if x.strip() != ""]
    if len(vals) < 2 * ZONE_POINTS_MIN or len(vals) % 2 or any(v is None for v in vals):
        return None
    pts = [[vals[i], vals[i + 1]] for i in range(0, len(vals), 2)]
    if any(c > 1 for p in pts for c in p):
        if not width or not height:
            return None
        pts = [[p[0] / width, p[1] / height] for p in pts]
    return [[round(min(max(p[0], 0.0), 1.0), PRECISION), round(min(max(p[1], 0.0), 1.0), PRECISION)] for p in pts]


def zone_view(name: str, raw: Any, width: int | None, height: int | None) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    objs = raw.get("objects")
    if isinstance(objs, str):
        objs = [objs]
    pts = parse_points(raw.get("coordinates"), width, height)
    return {"name": name, "points": pts, "editable": pts is not None and len(pts) <= ZONE_POINTS_MAX,
            "objects": sorted({o for o in objs if isinstance(o, str) and LABEL.fullmatch(o)}) if isinstance(objs, list) else [],
            "inertia": raw.get("inertia") if isinstance(raw.get("inertia"), int) and not isinstance(raw.get("inertia"), bool) else None,
            "loitering_time": raw.get("loitering_time") if isinstance(raw.get("loitering_time"), int) and not isinstance(raw.get("loitering_time"), bool) else None}


def comparable(zone: dict[str, Any] | None) -> dict[str, Any] | None:
    """The part of a zone a write sets (for "is it still what the change left?" and the read-back)."""
    if zone is None:
        return None
    inertia, loiter = zone.get("inertia"), zone.get("loitering_time")
    # an unset field and Frigate's default are the same state (the effective config shows the default once the key is removed)
    return {"points": zone.get("points"), "objects": sorted(zone.get("objects") or []), "inertia": 3 if inertia is None else inertia,
            "loitering_time": 0 if loiter is None else loiter}


def same_setting(key: str, a: Any, b: Any) -> bool:
    """Two values of one setting are the same state; None (unset) equals the documented default."""
    d = SETTING[key]["default"]
    a, b = d if a is None else a, d if b is None else b
    if isinstance(a, list) and isinstance(b, list):
        return sorted(a) == sorted(b)
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) < 1e-6
    return a == b


def _setting_from(cam: dict[str, Any], key: str) -> Any:
    spec = SETTING[key]
    v = _dig(cam, key.split("."))
    if spec["type"] == "labels":
        return sorted({x for x in v if isinstance(x, str)}) if isinstance(v, list) else None
    if spec["type"] == "int":
        return int(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and float(v).is_integer() else None
    return round(float(v), 3) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


class FrigateConfig:
    """Config reads and the one config write of one recorder; safe to build per request."""

    def __init__(self, adapter: FrigateAdapter) -> None:
        self.adapter = adapter
        self.http = adapter.http

    def camera(self, camera: str) -> dict[str, Any]:
        """ONE camera's zones and curated settings from the effective config. Only these fields leave this function (the inputs with
        their credentials, ONVIF and the rest of the document stay here)."""
        FrigateAdapter._camera(camera)
        cfg = self.http.get_json("/api/config")
        cam = _dig(cfg, ["cameras", camera])
        if not isinstance(cam, dict):
            raise ApiError(404, "not_found", "המצלמה לא נמצאה ב־Frigate.", details={"op": "config"})
        w, h = _dig(cam, ["detect", "width"]), _dig(cam, ["detect", "height"])
        w = w if isinstance(w, int) and w > 0 else None
        h = h if isinstance(h, int) and h > 0 else None
        zones_raw = cam.get("zones") if isinstance(cam.get("zones"), dict) else {}
        zones = [zone_view(n, z, w, h) for n, z in sorted(zones_raw.items()) if isinstance(n, str) and ZONE_NAME.fullmatch(n)][:ZONES_MAX * 2]
        return {"frame": {"width": w, "height": h}, "zones": zones, "settings": {s["key"]: _setting_from(cam, s["key"]) for s in SETTINGS}}

    def zone(self, camera: str, name: str) -> dict[str, Any] | None:
        for z in self.camera(camera)["zones"]:
            if z["name"] == name:
                return z
        return None

    def frigate_schema_check(self) -> dict[str, Any]:
        """Compare our fields with the instance's own JSON schema (a control read). {"checked": bool, "missing": [keys]}; a Frigate that does
        not serve the schema answers checked=False (nothing is concluded)."""
        try:
            doc = self.http.get_json("/api/config/schema.json", optional=True, control=True, max_bytes=3_000_000)
        except ApiError as exc:
            if exc.code in ("frigate_route_missing", "not_found", "source_forbidden"):
                return {"checked": False, "missing": []}
            raise
        cam = _camera_schema(doc)
        if cam is None:
            return {"checked": False, "missing": []}
        missing = [s["key"] for s in SETTINGS if not _has_path(doc, cam, s["key"].split("."))]
        for leaf in ("coordinates", "objects", "inertia", "loitering_time"):
            if not _has_path(doc, cam, ["zones", "*", leaf]):
                missing.append(f"zones.*.{leaf}")
        return {"checked": True, "missing": missing}

    # ------------------------------------------------------------------------------------------ the write (ONE call)

    def _set(self, camera: str, section: str, data: dict[str, Any]) -> None:
        """THE config write: one section of one camera. UNVERIFIED wire shape (module docstring)."""
        FrigateAdapter._camera(camera)
        body = {"requires_restart": 0, "update_topic": f"config/cameras/{camera}/{section}", "config_data": {"cameras": {camera: {section: data}}}}
        self.http.write("config", "PUT", "/api/config/set", body)

    def write_zone(self, camera: str, name: str, zone: dict[str, Any] | None) -> None:
        """Create / replace one zone, or remove it (`zone=None`). Unset optional fields are removed so Frigate's default applies."""
        zone_name(name)
        if zone is None:
            self._set(camera, "zones", {name: ""})
            return
        coords = ",".join(f"{c:.{PRECISION}f}".rstrip("0").rstrip(".") if c not in (0, 1) else str(int(c)) for p in zone["points"] for c in p)
        self._set(camera, "zones", {name: {"coordinates": coords, "objects": zone["objects"] or "",
                                            "inertia": "" if zone.get("inertia") is None else zone["inertia"],
                                            "loitering_time": "" if zone.get("loitering_time") is None else zone["loitering_time"]}})

    def write_settings(self, camera: str, section: str, values: dict[str, Any]) -> None:
        """Several keys of ONE section (validated by the caller); None removes a key."""
        if section not in SECTIONS:
            raise ApiError(422, "frigate_config_section_unknown", "הקבוצה אינה מוכרת.", details={"section": str(section)[:30]})
        data: dict[str, Any] = {}
        for key, val in values.items():
            if SETTING.get(key, {}).get("section") != section:
                raise ApiError(422, "frigate_config_key_unknown", "ההגדרה אינה שייכת לקבוצה.", details={"key": str(key)[:60]})
            node = data
            parts = key.split(".")[1:]
            for p in parts[:-1]:
                node = node.setdefault(p, {})
            node[parts[-1]] = "" if val is None else val
        self._set(camera, section, data)


# ---------------------------------------------------------------------------------------------- the instance schema walk

def _resolve(doc: Any, node: Any, depth: int = 0) -> Any:
    while isinstance(node, dict) and "$ref" in node and depth < 20:
        ref = node["$ref"]
        if not isinstance(ref, str) or not ref.startswith("#/"):
            return None
        node = _dig(doc, ref[2:].split("/"))
        depth += 1
    return node


def _children(doc: Any, node: Any) -> list[Any]:
    node = _resolve(doc, node)
    if not isinstance(node, dict):
        return []
    out = [node]
    for k in ("anyOf", "allOf", "oneOf"):
        for alt in node.get(k) or []:
            out.extend(_children(doc, alt))
    return out


def _has_path(doc: Any, node: Any, path: list[str]) -> bool:
    if not path:
        return True
    head, rest = path[0], path[1:]
    for n in _children(doc, node):
        if head == "*":
            ap = n.get("additionalProperties")
            if isinstance(ap, dict) and _has_path(doc, ap, rest):
                return True
            continue
        props = n.get("properties")
        if isinstance(props, dict) and head in props and _has_path(doc, props[head], rest):
            return True
    return False


def _camera_schema(doc: Any) -> Any:
    if not isinstance(doc, dict):
        return None
    cams = _dig(doc, ["properties", "cameras"])
    for n in _children(doc, cams):
        ap = n.get("additionalProperties")
        if isinstance(ap, dict):
            return ap
    return None


def dumps(v: Any) -> str:
    return json.dumps(v, sort_keys=True)


__all__ = ["FrigateConfig", "SETTINGS", "SETTING", "SECTIONS", "ZONE_FIELDS", "schema", "zone_in", "setting_value", "zone_name", "comparable", "SCHEMA_VERSION"]
