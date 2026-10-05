"""CR-020 phase D: one encoding change on many (or all) streams of one recorder - "set every camera to H.264"
(docs/architecture/NVR_SETTINGS_API.md 3.8, CR-020 section 10).

Owner request 2026-10-04: change ALL the encodings of ALL the cameras in one operation. This module adds the two things the
SVC batch of phase C did not have, and reuses everything else unchanged:

1. A read-only PLAN per stream (`plan_stream`, pure): the target settings the person chose ("leave as is" = the field is
   absent) reconciled with what THIS stream's device offers - the closest valid resolution / frame rate / quality, a bitrate
   or GOP clamped into the device's range, the profile the new codec needs, a field the stream does not have or that smart
   codec locks left as it is (with a note), or the whole stream marked "cannot be applied" with a Hebrew reason when the
   requested value has no valid counterpart (a codec, a bitrate mode the device does not offer; no capability document).
   Every planned change passes the S2A validation (`nvr_settings.validate_changes`) against the same options before it is
   offered: an invalid write is never planned, so never sent.
2. `POST /nvr/encoding-batches/preview` answers that plan (before -> after per stream, skipped streams with the reason, the
   number of changes); `POST /nvr/encoding-batches` re-plans from a FRESH device read and starts the batch only when every
   target's etag and planned change are exactly what the person confirmed (409 `stale` / `plan_changed` otherwise).

The batch itself is the phase C machinery (services/nvr_batch.py): one placeholder `nvr_changes` row per stream carrying its
planned `{field: [from, to]}`, the background runner (one camera at a time, the S2A guarded two-phase write per item with a
fresh read and its own etag check, stop at the first failure, the unknown-outcome rule with the 45 s read-only check, the
hard deadline per item, the permission re-checked before each item), stop, the device lock that refuses single writes, the
start-up recovery, undo-all as a new reversed batch, and batch runtime state outside every backup. Same permission
(`nvr.configure`, a system permission), audit rows `nvr.stream.batch` with `mode: "encoding"`. The routes are refused on
the remote channel (remote_channel.BLOCKED_ON_REMOTE, and the undo of an encoding batch in routers/nvr_batch.py). No
response, audit row or log line carries a device address, a device user name, a password, a serial number or a MAC.
"""
from __future__ import annotations

import math
import re
import sqlite3
from dataclasses import dataclass, field
from typing import Any

from ..config import Settings
from ..db import commit_now, unlocked
from ..errors import ApiError
from . import nvr, nvr_batch, nvr_settings
from .recorders import registry
from .recorders.base import StreamOptions

WRITE_PERMISSION = nvr_settings.WRITE_PERMISSION
MODE = "encoding"
# The target fields a person can set for many streams at once (a whitelist; profile is never chosen by the person - the
# planner keeps it, or picks the one the new codec needs and shows it; B-frames are not written in S2).
TARGET_FIELDS = ("codec", "resolution", "fps", "bitrate_mode", "bitrate_kbps", "quality", "gop", "svc", "smart_codec")
# A planned change may also carry the profile the codec switch needs.
PLAN_FIELDS = (*TARGET_FIELDS, "profile")
CODECS = ("H.264", "H.265")  # the codecs a bulk change may ask for (owner: "set all of them to H.264 etc.")
MIN_TARGETS = 1  # the person chose many streams; when the plan leaves one that needs a change, a batch of one is still one confirmation
MAX_TARGETS = nvr_batch.MAX_TARGETS
PREVIEW_DEADLINE_S = 120.0  # the whole preview's device reads (one LIST + one capability discovery per stream, cached 10 min)
RES_RE = re.compile(r"^(\d{2,5})x(\d{2,5})$")

# the one short line per note / skip (server-side Hebrew; the screen shows it as text)
NOTE_HE = {
    "closest": "הערך אינו נתמך במצלמה; נבחר הקרוב ביותר.",
    "clamped": "מחוץ לטווח של המצלמה; הותאם לגבול.",
    "profile_codec": "הפרופיל הנוכחי אינו קיים בקידוד החדש.",
    "codec_resolution": "הרזולוציה הנוכחית אינה קיימת בקידוד החדש.",
    "not_in_stream": "לא קיים בזרם הזה; נשאר כמו שהוא.",
    "not_offered": "המצלמה אינה מאפשרת לשנות; נשאר כמו שהוא.",
    "locked_smart": "נעול כש־Smart codec פעיל; נשאר כמו שהוא.",
    "quality_cbr": "איכות קיימת רק בקצב משתנה; נשארה כמו שהיא.",
}
SKIP_HE = {
    "capabilities_unreadable": "ה־NVR אינו מפרסם את יכולות הזרם.",
    "not_writable": "ה־NVR אינו מאפשר לשנות את הזרם הזה.",
    "device_refused": "ה־NVR סירב לשינוי בזרם הזה; הוא אינו מעביר כתיבה למצלמה הזו.",
    "write_api_missing": "ה־NVR אינו מפרסם פקודת כתיבה להגדרות הזרם.",
    "no_caps": "ה־NVR אינו מפרסם יכולות לזרם הזה, ולכן אי אפשר לאמת ערכים.",
    "codec_not_offered": "המצלמה אינה תומכת בקידוד הזה.",
    "codec_not_supported": "אי אפשר לשנות את הקידוד בזרם הזה.",
    "profile_unavailable": "אין פרופיל מתאים בקידוד החדש.",
    "resolution_unavailable": "המצלמה אינה מפרסמת רזולוציות לקידוד הזה.",
    "bitrate_mode_not_offered": "המצלמה אינה תומכת בסוג הקצב הזה.",
    "invalid_for_device": "השינוי אינו תקין למצלמה הזו.",
    "offline": "המצלמה אינה מקוונת.",
    "not_found": "הזרם לא נמצא ב־NVR.",
    "no_reading": "אין קריאה עדכנית של הזרם.",
    "pending": "שינוי אחר של הזרם מתבצע.",
    "source_timeout": "ה־NVR לא ענה בזמן.",
    "source_unavailable": "ה־NVR אינו זמין.",
}


# ------------------------------------------------------------------------------------------------ the body

def _invalid(message: str, **details: Any) -> ApiError:
    return ApiError(422, "validation", message, details=details or None)


def _typed(name: str, v: Any) -> bool:
    """Strict JSON types and sane bounds of one target / planned field (the device's own options decide the rest)."""
    if name == "codec":
        return isinstance(v, str) and v in CODECS
    if name == "profile":
        return isinstance(v, str) and bool(nvr.SAFE_TOKEN.match(v)) and len(v) <= 32
    if name == "resolution":
        return isinstance(v, str) and bool(RES_RE.fullmatch(v))
    if name == "fps":
        return v == "full" or (isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(float(v)) and 0 < float(v) <= 1000)
    if name == "bitrate_mode":
        return v in ("CBR", "VBR")
    if name == "bitrate_kbps":
        return isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 1_000_000
    if name == "quality":
        return isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 100
    if name == "gop":
        return isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= 10_000
    if name in ("svc", "smart_codec"):
        return isinstance(v, bool)
    return False


def parse_settings(raw: Any) -> dict[str, Any]:
    """The target settings: an object of whitelisted fields, at least one; an absent field is "leave as is"."""
    if not isinstance(raw, dict) or not raw:
        raise _invalid("יש לבחור לפחות הגדרה אחת לשינוי.", field="settings")
    unknown = sorted(str(k)[:32] for k in raw if k not in TARGET_FIELDS)
    if unknown:
        raise ApiError(422, "batch_field_not_allowed", "שדה לא מוכר.", details={"fields": unknown[:5], "allowed": list(TARGET_FIELDS)})
    for k, v in raw.items():
        if not _typed(k, v):
            raise _invalid("ערך בסוג לא תקין.", field=k)
    return dict(raw)


@dataclass(frozen=True)
class Target:
    camera_id: str
    stream_ref: str
    if_match: str | None = None
    changes: dict[str, Any] | None = None


def parse_targets(raw: Any, *, planned: bool) -> list[Target]:
    """Preview: `[{camera_id, stream_ref}]`; start (`planned`): `[{camera_id, stream_ref, if_match, changes}]` - the exact
    change the preview showed for that stream. A camera may appear once per stream (main and sub), a stream once."""
    if not isinstance(raw, list) or not MIN_TARGETS <= len(raw) <= MAX_TARGETS:
        raise _invalid("יש לבחור לפחות זרם אחד.", field="targets", min=MIN_TARGETS, max=MAX_TARGETS)
    keys = {"camera_id", "stream_ref", "if_match", "changes"} if planned else {"camera_id", "stream_ref"}
    out: list[Target] = []
    refs: set[str] = set()
    for i, t in enumerate(raw):
        ok = (isinstance(t, dict) and set(t) == keys and isinstance(t["camera_id"], str) and nvr_batch.CAMERA_ID_RE.fullmatch(t["camera_id"])
              and isinstance(t["stream_ref"], str) and nvr_batch.STREAM_REF_RE.fullmatch(t["stream_ref"]))
        if ok and planned:
            ch = t["changes"]
            ok = (isinstance(t["if_match"], str) and bool(nvr_batch.ETAG_RE.fullmatch(t["if_match"])) and isinstance(ch, dict) and bool(ch)
                  and all(k in PLAN_FIELDS and _typed(k, v) for k, v in ch.items()))
        if not ok:
            raise _invalid("יעד לא תקין.", index=i)
        if t["stream_ref"] in refs:
            raise _invalid("אותו זרם נבחר פעמיים.", index=i, duplicate=True)
        refs.add(t["stream_ref"])
        out.append(Target(t["camera_id"], t["stream_ref"], t.get("if_match"), dict(t["changes"]) if planned else None))
    return out


def parse_recorder(raw: Any) -> str | None:
    if raw is not None and (not isinstance(raw, str) or not nvr_batch.RECORDER_RE.fullmatch(raw)):
        raise _invalid("מזהה NVR לא תקין.", field="recorder_id")
    return raw


def parse_preview_body(body: Any) -> tuple[dict[str, Any], list[Target], str | None]:
    if not isinstance(body, dict):
        raise _invalid("בקשה לא תקינה.")
    extra = set(body) - {"settings", "targets", "recorder_id"}
    if extra:
        raise _invalid("בקשה לא תקינה.", extra=sorted(str(k)[:32] for k in extra)[:5])
    return parse_settings(body.get("settings")), parse_targets(body.get("targets"), planned=False), parse_recorder(body.get("recorder_id"))


def parse_start_body(body: Any) -> tuple[dict[str, Any], list[Target], str | None]:
    """`confirm` first (only the JSON literal true; a missing confirmation never reaches a device read), then the shape."""
    if not isinstance(body, dict) or body.get("confirm") is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את השינוי.")
    extra = set(body) - {"confirm", "settings", "targets", "recorder_id"}
    if extra:
        raise _invalid("בקשה לא תקינה.", extra=sorted(str(k)[:32] for k in extra)[:5])
    return parse_settings(body.get("settings")), parse_targets(body.get("targets"), planned=True), parse_recorder(body.get("recorder_id"))


# ------------------------------------------------------------------------------------------------ the plan (pure)

@dataclass
class Plan:
    status: str  # "change" | "unchanged" | "skip"
    changes: dict[str, Any] = field(default_factory=dict)
    fields: dict[str, list[Any]] = field(default_factory=dict)
    notes: list[dict[str, Any]] = field(default_factory=list)
    reason: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {"status": self.status, "changes": self.changes, "fields": self.fields, "notes": self.notes, "reason": self.reason,
                "message": SKIP_HE.get(self.reason or "") if self.reason else None}


def _skip(reason: str) -> Plan:
    return Plan(status="skip", reason=reason)


def _pixels(r: str) -> int | None:
    m = RES_RE.fullmatch(r or "")
    return int(m.group(1)) * int(m.group(2)) if m else None


def closest_resolution(wanted: str, allowed: list[str]) -> str:
    """The offered resolution nearest in pixel count (a tie: the smaller one - never more load than asked)."""
    target = _pixels(wanted) or 0
    valid = [r for r in allowed if _pixels(r) is not None]
    return min(valid, key=lambda r: (abs((_pixels(r) or 0) - target), _pixels(r) or 0)) if valid else allowed[0]


def closest_number(wanted: float, allowed: list[Any]) -> Any:
    """The offered value nearest to `wanted` (a tie: the lower one)."""
    return min(allowed, key=lambda v: (abs(float(v) - float(wanted)), float(v)))


def _clamp(v: int, bounds: Any) -> int | None:
    if not isinstance(bounds, dict) or not isinstance(bounds.get("min"), int) or not isinstance(bounds.get("max"), int):
        return None
    return max(bounds["min"], min(bounds["max"], v))


def plan_stream(current: dict[str, Any], options: dict[str, Any] | None, target: dict[str, Any]) -> Plan:
    """Reconcile the target settings with ONE stream. `current`: the stream as the LIST shows it (`_stream_dict`); `options`:
    its capability discovery (for the codec it will have); `target`: the validated settings (absent = leave as is).
    Notes: `adjusted` (a value other than the one asked, with the reason) and `kept` (a field this stream keeps as it is).
    The result's changes have passed `nvr_settings.validate_changes` against these same options."""
    if not options:
        return _skip("capabilities_unreadable")
    unsupported = set((current.get("fields") or {}).keys())
    changes: dict[str, Any] = {}
    notes: list[dict[str, Any]] = []

    def note(kind: str, name: str, reason: str, requested: Any = None, value: Any = None) -> None:
        notes.append({"kind": kind, "field": name, "reason": reason, "message": NOTE_HE[reason], "requested": requested, "value": value})

    def put(name: str, requested: Any, value: Any, reason: str = "closest") -> None:
        changes[name] = value
        if not nvr_settings._same(requested, value):
            note("adjusted", name, reason, requested, value)

    # codec (and the profile the new codec needs)
    codec_now = current.get("codec")
    codec_after = codec_now
    if "codec" in target:
        if "codec" in unsupported:
            return _skip("codec_not_supported")
        if target["codec"] not in (options.get("codec") or []):
            return _skip("codec_not_offered")
        codec_after = target["codec"]
        changes["codec"] = codec_after
    switching = codec_after != codec_now
    profile_now = current.get("profile")
    if switching and profile_now is not None:
        allowed = list((options.get("profile") or {}).get(str(codec_after)) or [])
        if profile_now not in allowed:
            if not allowed:
                return _skip("profile_unavailable")
            pick = profile_now if profile_now in allowed else ("Main" if "Main" in allowed else allowed[0])
            changes["profile"] = pick
            note("adjusted", "profile", "profile_codec", profile_now, pick)

    # resolution: asked for, or the current one when the new codec does not offer it
    res_allowed = list((options.get("resolution") or {}).get(str(codec_after)) or [])
    res_now = current.get("resolution")
    if "resolution" in target:
        if "resolution" in unsupported:
            note("kept", "resolution", "not_in_stream", target["resolution"])
        elif not res_allowed:
            return _skip("resolution_unavailable")
        elif target["resolution"] in res_allowed:
            changes["resolution"] = target["resolution"]
        else:
            put("resolution", target["resolution"], closest_resolution(target["resolution"], res_allowed))
    elif switching and res_now and res_allowed and res_now not in res_allowed and "resolution" not in unsupported:
        put("resolution", res_now, closest_resolution(str(res_now), res_allowed), "codec_resolution")

    # frame rate
    if "fps" in target:
        fps_list = [f for f in (options.get("fps") or []) if isinstance(f, (int, float))]
        want = target["fps"]
        if "fps" in unsupported:
            note("kept", "fps", "not_in_stream", want)
        elif want == "full":
            if options.get("fps_full"):
                changes["fps"] = "full"
            elif fps_list:
                put("fps", "full", max(fps_list))
            else:
                note("kept", "fps", "not_offered", want)
        elif fps_list:
            put("fps", want, closest_number(float(want), fps_list))
        else:
            note("kept", "fps", "not_offered", want)

    # smart codec first: when it is on after the change it locks the fields the device names (GOP, bitrate mode, quality)
    smart_after = current.get("smart_codec")
    if "smart_codec" in target:
        if "smart_codec" in unsupported or not options.get("smart_codec") or current.get("smart_codec") is None:
            note("kept", "smart_codec", "not_in_stream", target["smart_codec"])
        else:
            changes["smart_codec"] = target["smart_codec"]
            smart_after = target["smart_codec"]
    locked = set((options.get("locks") or {}).get("smart_codec") or []) if smart_after is True else set()

    mode_after = current.get("bitrate_mode")
    if "bitrate_mode" in target:
        if "bitrate_mode" in locked and target["bitrate_mode"] != mode_after:
            note("kept", "bitrate_mode", "locked_smart", target["bitrate_mode"])
        elif "bitrate_mode" in unsupported:
            note("kept", "bitrate_mode", "not_in_stream", target["bitrate_mode"])
        elif target["bitrate_mode"] not in (options.get("bitrate_mode") or []):
            return _skip("bitrate_mode_not_offered")
        else:
            changes["bitrate_mode"] = target["bitrate_mode"]
            mode_after = target["bitrate_mode"]

    if "bitrate_kbps" in target:
        want = target["bitrate_kbps"]
        v = _clamp(want, options.get("bitrate_kbps"))
        if "bitrate_kbps" in unsupported and not (mode_after == "CBR" and "bitrate_mode" in changes):
            note("kept", "bitrate_kbps", "not_in_stream", want)
        elif v is None:
            note("kept", "bitrate_kbps", "not_offered", want)
        else:
            put("bitrate_kbps", want, v, "clamped")

    if "quality" in target:
        want = target["quality"]
        q_list = [q for q in (options.get("quality") or []) if isinstance(q, int)]
        if "quality" in locked and not nvr_settings._same(want, current.get("quality")):
            note("kept", "quality", "locked_smart", want)
        elif "quality" in unsupported:
            note("kept", "quality", "not_in_stream", want)
        elif mode_after != "VBR":
            note("kept", "quality", "quality_cbr", want)
        elif not q_list:
            note("kept", "quality", "not_offered", want)
        else:
            put("quality", want, closest_number(want, q_list))

    if "gop" in target:
        want = target["gop"]
        v = _clamp(want, options.get("gop"))
        if "gop" in locked and not nvr_settings._same(want, current.get("gop")):
            note("kept", "gop", "locked_smart", want)
        elif "gop" in unsupported:
            note("kept", "gop", "not_in_stream", want)
        elif v is None:
            note("kept", "gop", "not_offered", want)
        else:
            put("gop", want, v, "clamped")

    if "svc" in target:
        if "svc" in unsupported or not options.get("svc") or current.get("svc") is None:
            note("kept", "svc", "not_in_stream", target["svc"])
        else:
            changes["svc"] = target["svc"]

    # the S2A gate: the planned change must pass exactly the validation the item's write will run
    try:
        effective, fields, _unchanged = nvr_settings.validate_changes(current, options, changes)
    except ApiError:
        return Plan(status="skip", notes=notes, reason="invalid_for_device")
    if not effective:
        return Plan(status="unchanged", notes=notes)
    return Plan(status="change", changes=effective, fields=fields, notes=notes)


# ------------------------------------------------------------------------------------------------ device reads + plan

def _recorder_of(conn: sqlite3.Connection, targets: list[Target], recorder_id: str | None) -> tuple[str, dict[str, sqlite3.Row]]:
    ids = sorted({t.camera_id for t in targets})
    rows: dict[str, sqlite3.Row] = {}
    for start in range(0, len(ids), 500):
        chunk = ids[start:start + 500]
        for r in conn.execute(f"SELECT id, recorder_id, channel FROM cameras WHERE id IN ({','.join('?' * len(chunk))})", chunk).fetchall():
            rows[r["id"]] = r
    for i, t in enumerate(targets):
        r = rows.get(t.camera_id)
        if r is None or r["channel"] is None:
            raise ApiError(404, "not_found", "המצלמה לא נמצאה.", details={"index": i})
    recorders = {rows[t.camera_id]["recorder_id"] for t in targets}
    if len(recorders) != 1:
        raise _invalid("כל המצלמות צריכות להיות באותו NVR.", field="targets")
    rid = recorders.pop()
    if recorder_id is not None and recorder_id != rid:
        raise _invalid("המצלמות אינן שייכות ל־NVR הזה.", field="recorder_id")
    return rid, rows


def _options_codec(target: dict[str, Any], current_codec: Any) -> str | None:
    want = target.get("codec")
    return want if isinstance(want, str) and want != current_codec else None


def plan_targets(conn: sqlite3.Connection, settings: Settings, rid: str, cams: dict[str, sqlite3.Row], targets: list[Target],
                 target: dict[str, Any]) -> list[dict[str, Any]]:
    """Read-only: ONE LIST read (and one channel list for online state) for the recorder, then per stream its capability
    discovery for the codec it will have (cached per process), then `plan_stream`. A LIST that cannot be read refuses
    the whole request (503); a stream whose options cannot be read is a skip with the reason. Never a write."""
    adapter = registry.adapter_for(conn, settings, rid)
    pending = {str(r["stream_ref"]) for r in conn.execute("SELECT stream_ref FROM nvr_changes WHERE recorder_id = ? AND status = 'pending' AND stream_ref IS NOT NULL",
                                                          (rid,)).fetchall()}
    found: dict[int, tuple[Any, StreamOptions | str | None]] = {}
    online: dict[str, bool | None] = {}
    with unlocked(conn), nvr.deadline(PREVIEW_DEADLINE_S):
        by_channel = adapter.read_stream_encodings()
        try:
            online = {c.source_ref: c.online for c in adapter.list_channels()}
        except ApiError:
            online = {}  # unknown online state is not "offline": the item's own write decides
        for i, t in enumerate(targets):
            stream = next((s for s in by_channel.get(str(cams[t.camera_id]["channel"]), []) if s.stream_ref == t.stream_ref), None)
            if stream is None or not stream.etag or online.get(str(cams[t.camera_id]["channel"])) is False or t.stream_ref in pending:
                found[i] = (stream, None)
                continue
            try:
                found[i] = (stream, adapter.stream_options(t.stream_ref, _options_codec(target, stream.encoding.get("codec"))))
            except ApiError as exc:
                found[i] = (stream, exc.code)
    out: list[dict[str, Any]] = []
    for i, t in enumerate(targets):
        stream, opts = found[i]
        base = {"index": i, "camera_id": t.camera_id, "stream_ref": t.stream_ref, "role": None, "if_match": None, "before": None}
        if stream is None:
            out.append({**base, **_skip("not_found").as_dict()})
            continue
        cur = nvr_settings._stream_dict(stream)
        base.update({"role": stream.role, "if_match": stream.etag, "before": {k: nvr_settings.field_value(cur, k) for k in PLAN_FIELDS}})
        if not stream.etag:
            plan = _skip("no_reading")
        elif online.get(str(cams[t.camera_id]["channel"])) is False:
            plan = _skip("offline")
        elif t.stream_ref in pending:
            plan = _skip("pending")
        elif isinstance(opts, str):
            plan = _skip(opts if opts in SKIP_HE else "source_unavailable")
        elif opts is None or not opts.writable or opts.options is None or opts.write_via is None:
            plan = _skip("capabilities_unreadable" if opts is None or opts.writable else (opts.reason if opts.reason in (*nvr_settings.NOT_SUPPORTED_REASONS, "capabilities_unreadable") else "not_writable"))
        else:
            plan = plan_stream(cur, opts.options, target)
        out.append({**base, **plan.as_dict()})
    return out


def _summary(items: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {"change": 0, "unchanged": 0, "skip": 0}
    for it in items:
        counts[it["status"]] += 1
    return {"counts": counts, "changes_total": sum(len(it["fields"]) for it in items if it["status"] == "change"),
            "adjusted": sum(1 for it in items if it["status"] == "change" and any(n["kind"] == "adjusted" for n in it["notes"]))}


def preview(conn: sqlite3.Connection, settings: Settings, principal: Any, target: dict[str, Any], targets: list[Target], recorder_id: str | None,
            *, request_id: str | None = None) -> dict[str, Any]:
    """`POST /nvr/encoding-batches/preview`: the plan, read-only (one audit row with counts only)."""
    try:
        rid, cams = _recorder_of(conn, targets, recorder_id)
    except ApiError as exc:
        raise nvr_batch.refuse(conn, principal, exc, request_id, kind="preview", targets=len(targets), mode=MODE) from None
    try:
        items = plan_targets(conn, settings, rid, cams, targets, target)
    except ApiError as exc:  # the recorder's LIST could not be read: nothing to plan from
        raise nvr_batch.refuse(conn, principal, exc, request_id, kind="preview", recorder_id=rid, targets=len(targets), mode=MODE) from None
    summary = _summary(items)
    nvr_batch._audit_batch(conn, principal, "preview", "allowed", rid, {"phase": "preview", "mode": MODE, "settings": target, "targets": len(targets), **summary},
                           request_id=request_id)
    running = conn.execute("SELECT 1 FROM settings WHERE key = ?", (nvr_batch.lock_key(conn, settings, rid),)).fetchone() is not None
    return {"recorder_id": rid, "settings": target, "items": items, **summary, "batch_in_progress": running}


def create_encoding_batch(conn: sqlite3.Connection, db: Any, settings: Settings, principal: Any, target: dict[str, Any], targets: list[Target],
                          recorder_id: str | None, *, request_id: str | None = None) -> dict[str, Any]:
    """`POST /nvr/encoding-batches`. The caller has checked `nvr.configure` at installation, parsed the body (confirm first)
    and authorized every target camera. Re-plans from a fresh read: every target must still be a planned change, with the
    etag and the exact change the person confirmed; then the phase C placeholders, ONE `nvr.stream.batch` attempt row
    (`mode: "encoding"`) and the runner. Refusals are audited and write nothing else."""
    try:
        rid, cams = _recorder_of(conn, targets, recorder_id)
    except ApiError as exc:
        raise nvr_batch.refuse(conn, principal, exc, request_id, targets=len(targets), mode=MODE) from None
    key = nvr_batch.lock_key(conn, settings, rid)
    try:
        nvr_batch.recover_dead(conn, settings, rid)
        nvr_settings.batch_guard(conn, key)  # cheap refusal before any device read
        plans = plan_targets(conn, settings, rid, cams, targets, target)
        for i, (t, p) in enumerate(zip(targets, plans)):
            if p["status"] == "skip" and p["reason"] in ("not_found",):
                raise ApiError(404, "not_found", "הזרם אינו שייך למצלמה הזו.", details={"index": i})
            if p["if_match"] is not None and p["if_match"] != t.if_match:
                raise ApiError(409, "stale", "ההגדרות השתנו ב־NVR. יש להציג שוב את התצוגה המקדימה.", details={"index": i})
            if p["status"] != "change":
                raise ApiError(422, "batch_target_not_allowed", "הזרם הזה אינו מתאים לשינוי.", details={"index": i, "reason": p["reason"] or p["status"]})
            if not _same_changes(p["changes"], t.changes or {}):
                raise ApiError(409, "plan_changed", "התוכנית השתנתה. יש להציג שוב את התצוגה המקדימה.", details={"index": i})
        nvr_batch._locked_checks(conn, settings, rid, [t.stream_ref for t in targets])
    except ApiError as exc:
        raise nvr_batch.refuse(conn, principal, exc, request_id, recorder_id=rid, targets=len(targets), mode=MODE) from None
    items = [{"camera_id": t.camera_id, "stream_ref": t.stream_ref, "etag": t.if_match, "fields": p["fields"]} for t, p in zip(targets, plans)]
    bid = nvr_batch._new_batch(conn, principal, kind="write", rid=rid, key=key, items=items, request_id=request_id, extra_meta={"mode": MODE, "settings": target})
    nvr_batch._audit_batch(conn, principal, "write", "allowed", rid, {
        "phase": "attempt", "mode": MODE, "batch_id": bid, "total": len(items), "settings": target,
        "fields": sorted({k for p in plans for k in p["fields"]}), "targets": [{"camera_id": t.camera_id, "stream_ref": t.stream_ref} for t in targets],
    }, request_id=request_id)
    commit_now(conn)  # the rows exist before the runner looks for them
    nvr_batch.start_runner(db, settings, principal, bid)
    return nvr_batch.batch_status(conn, principal, bid)


def _same_changes(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return set(a) == set(b) and all(nvr_settings._same(a[k], b[k]) for k in a)
