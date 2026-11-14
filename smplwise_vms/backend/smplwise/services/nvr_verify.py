"""CAM-H264-VERIFY-2361: after a bulk ENCODING change (the H.264 preset and every encoding batch, and their undo), check per stream
what really happened - three layers, all read-only - and keep the result with the batch so it can be opened again.

Owner decision 2026-11-02 (round 14, option (a) of private/planning/CAMERA_DIRECT_ENCODING_PLAN_2026-11-02.md): the NVR stays the
only writer. Nothing here writes to a device, to go2rtc or to a recorder setting; nothing here turns a write switch on.

1. The NVR read-back - exists: every item of the batch is the S2A two-phase write, whose own verify read classifies it `applied` /
   `no_effect` / `diverged` (services/nvr_settings.py). A re-check (below) reads the recorder's stream list once more (one LIST).
2. The MEDIA layer - what the camera really sends: go2rtc's stream probe of our own stream of that channel and profile
   (`Go2rtc.probe_video_codec`, `GET /api/streams?src=<our name>&video=all`: a name only, never a source; the recorder's RTSP session is
   opened for about a second). The codec go2rtc reports is the one the NVR's RTSP server announces for the channel, i.e. the camera's
   own stream when the NVR re-streams it unchanged (it does not transcode; to be confirmed on the lab). Limits: ONE probe at a time in
   this process (`_PROBE_SLOTS`, shared by every pass), a pause between probes, and no probe while the installation's live sessions are
   at `media.max_live_sessions` (the probe would be one more RTSP session on the recorder) - such a stream is "not checked" (busy).
   A probe that cannot answer is never a confirmation: `not_checked` with the reason.
3. Restart / reconnect: the NVR's own "reboot required" answer to the PUT (Hikvision statusCode 7, `nvr_changes.reboot_required`), and a
   stream whose live session was already open before the change still reporting the old codec (`reconnect`: the session predates
   the change - go2rtc keeps the producer while somebody watches).

Per stream the outcome is one of: `confirmed` ("המצלמה אישרה (H.264)"), `nvr_accepted` ("המקליט קיבל": the NVR took it, the camera
was not checked), `still_old` ("עדיין H.265"), `restart_needed` ("צריך אתחול"), `failed` ("נכשל: <reason>", a skipped stream is one
of these too) and `unchanged` (it already had the values). The worklist ("מצלמות שלא השתנו") is still_old + restart_needed + failed; a
re-check (`POST /nvr/stream-batches/{id}/verify`, read-only, nvr.configure on every camera, at most every RECHECK_MIN_S) reads the NVR
list and probes the worklist and the unverified streams again.

Storage without a migration: the report is one more key of the batch in the `settings` table (`nvr.batch.<id>.verify`, beside the
batch record META_KEY; services/backup.py keeps every `nvr.batch.` key out of a restore). No address, device user, password, serial
or MAC is stored or answered - stream refs, codec names and reason codes only.
"""
from __future__ import annotations

import json
import logging
import re
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable

from ..audit import audit
from ..config import Settings
from ..db import get_setting, now_iso, set_setting
from ..errors import ApiError
from . import go2rtc as g2
from . import live_codec, nvr, nvr_batch
from .recorders import registry

log = logging.getLogger(__name__)

VERIFY_KEY = "nvr.batch.{}.verify"
MODE = "encoding"
SETTLE_S = 10.0  # after the last write, before the first probe: the camera restarts its encoder (tests set 0)
PROBE_GAP_S = 1.0  # between two probes: the recorder opens one RTSP session at a time for us (tests set 0)
PROBE_TIMEOUT_S = 12.0
SLOT_WAIT_S = 20.0  # waiting for the probe slot or for room under media.max_live_sessions; then `busy`
LIST_DEADLINE_S = 60.0  # the re-check's one NVR LIST read
RECHECK_MIN_S = 30.0  # one re-check of a batch at most this often
DEFAULT_MAX_LIVE = 16

OUTCOMES = ("confirmed", "nvr_accepted", "still_old", "restart_needed", "failed", "unchanged")
WORKLIST = frozenset({"still_old", "restart_needed", "failed"})
RECHECKABLE = WORKLIST | {"nvr_accepted"}
ACCEPTED = frozenset({"applied", "diverged"})  # the NVR took (all or part of) the change; a rollback item is `applied` too

_PROBE_SLOTS = threading.BoundedSemaphore(1)
_running: dict[str, threading.Thread] = {}
_running_lock = threading.Lock()

# the one line per media reason / restart reason (server-side Hebrew; the screen shows it as text)
MEDIA_HE = {
    "media_not_configured": "אין חיבור ל־go2rtc, ולכן לא נבדק מה המצלמה שולחת.",
    "stream_unknown": "הזרם של הערוץ הזה אינו מוגדר ב־go2rtc, ולכן לא נבדק.",
    "unavailable": "go2rtc לא ענה, ולכן לא נבדק מה המצלמה שולחת.",
    "no_codec": "go2rtc לא דיווח על הקידוד של הזרם, ולכן לא נבדק.",
    "busy": "מכסת הצפייה במקביל מלאה; לא נבדק כדי לא להעמיס על המקליט.",
    "role_unknown": "לא ידוע אם זה זרם ראשי או משני, ולכן לא נבדק.",
    "not_needed": "השינוי אינו משנה את הקידוד; אין מה לבדוק בזרם.",
    "interrupted": "הבדיקה נקטעה.",
}
RESTART_HE = {
    "reboot_required": "ה־NVR דיווח שהמצלמה צריכה אתחול כדי שהשינוי ייכנס לתוקף.",
    "reconnect": "החיבור לזרם נפתח לפני השינוי ועדיין פתוח (מישהו צופה). אפשר לבדוק שוב אחרי סגירת הצפייה, או לאתחל את המצלמה.",
}
STILL_OLD_HE = "ה־NVR קיבל את השינוי, אבל המצלמה עדיין שולחת {codec}. אפשר לשנות במצלמה עצמה או בממשק ה־NVR."
NVR_NOW_HE = "ה־NVR מציג עכשיו {codec}."
FAILED_HE = {
    "nvr_not_supported": "ה־NVR אינו מעביר את השינוי למצלמה הזו.",
    "nvr_rejected": "ה־NVR דחה את השינוי.",
    "nvr_no_effect": "ה־NVR לא שינה את ההגדרה.",
    "no_effect": "ה־NVR לא שינה את ההגדרה.",
    "diverged": "ה־NVR שינה רק חלק מההגדרה.",
    "nvr_busy": "ה־NVR עסוק.",
    "stale": "ההגדרות השתנו ב־NVR לפני השינוי.",
    "not_found": "הזרם לא נמצא ב־NVR.",
    "capabilities_unreadable": "ה־NVR אינו מפרסם את יכולות הזרם.",
    "writes_disabled": "שינויי הגדרות ב־NVR הזה כבויים.",
    "validation": "השינוי אינו תקין למצלמה הזו.",
    "forbidden": "אין הרשאה למצלמה הזו.",
    "outcome_unknown": "לא ברור אם בוצע.",
    "not_attempted": "לא בוצע.",
}
NVR_UNREADABLE_HE = "לא ניתן היה לקרוא את רשימת הזרמים מה־NVR."


def codec_label(family: str | None) -> str:
    return {"h264": "H.264", "h265": "H.265", "mjpeg": "MJPEG"}.get(family or "", (family or "").upper() or "?")


def family(value: Any) -> str | None:
    return live_codec.codec_family({"codec": value}) if value else None


_ROLE_RE = re.compile(r"^\d+0([12])$")


def role_of(stream_ref: str, roles: dict[str, Any] | None) -> str | None:
    """The stream's role: the one the plan recorded (`meta.roles`), else the recorders' stream id shape (`<channel>01` main, `<channel>02` sub)."""
    r = (roles or {}).get(stream_ref)
    if r in ("main", "sub"):
        return str(r)
    m = _ROLE_RE.fullmatch(stream_ref or "")
    return ("main" if m.group(1) == "1" else "sub") if m else None


@dataclass(frozen=True)
class Media:
    """One media reading: `codec` a family (`h264` / `h265` / ...) or None with `reason`; `preexisting`: go2rtc already had a live producer
    for the stream before the probe (its session may predate the change)."""

    codec: str | None
    reason: str | None = None
    preexisting: bool = False


def item_fields(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    try:
        f = json.loads(row["fields_json"] or "null")
    except (ValueError, TypeError):
        return {}
    return f if isinstance(f, dict) else {}


def expected_codecs(row: sqlite3.Row | dict[str, Any]) -> tuple[str | None, str | None]:
    """(the codec family the change asked for, the family it had before) - (None, None) when the change does not touch the codec."""
    c = item_fields(row).get("codec")
    if not isinstance(c, list) or len(c) != 2:
        return None, None
    return family(c[1]), family(c[0])


def failure_reason(row: sqlite3.Row | dict[str, Any]) -> str:
    status = str(row["status"])
    err = row["error"] or ""
    if status == "pending":
        return "outcome_unknown"
    if status == "not_attempted":
        return str(err or "not_attempted")
    return str(err or status)


def failure_line(code: str) -> str:
    return FAILED_HE.get(code) or nvr_batch.ERROR_MESSAGES.get(code) or "השינוי לא בוצע."


def assess(row: sqlite3.Row | dict[str, Any], *, skipped: bool, media: Media | None, nvr_now: str | None = None, nvr_read: bool = False,
           nvr_unreadable: bool = False) -> dict[str, Any]:
    """The outcome of ONE stream (pure). `media` None: not probed. `nvr_now`: the codec family the NVR shows now (a re-check's LIST);
    `nvr_read` True when that LIST was read (a stream it no longer lists is then not accepted any more)."""
    status = str(row["status"])
    expected, before = expected_codecs(row)
    reboot = bool(row["reboot_required"]) if "reboot_required" in row.keys() else False  # type: ignore[union-attr]
    accepted = status in ACCEPTED
    if nvr_read and expected is not None:
        accepted = nvr_now == expected  # what the NVR shows now decides (an item done outside this batch, or put back meanwhile)
    rec: dict[str, Any] = {
        "change_id": row["id"], "index": row["batch_index"], "camera_id": row["camera_id"], "stream_ref": row["stream_ref"],
        "expected": codec_label(expected) if expected else None, "before": codec_label(before) if before else None,
        "nvr": status, "nvr_now": codec_label(nvr_now) if nvr_now else None, "skipped": skipped, "reboot_required": reboot, "reconnect": False,
        "media": None, "media_codec": None, "media_reason": None, "outcome": "failed", "reason": None, "label": "", "detail": "",
        "checked_at": now_iso(),
    }
    if status == "unchanged" and not nvr_read:
        rec.update(outcome="unchanged", label="כבר מוגדר", detail="הזרם כבר היה מוגדר כך; לא נשלח שינוי.")
        return rec
    if not accepted:
        code = failure_reason(row) if status not in ACCEPTED else ("nvr_reverted" if nvr_read else status)
        line = failure_line(code) if code != "nvr_reverted" else "ה־NVR כבר לא מציג את השינוי."
        if nvr_unreadable:
            line = f"{line} {NVR_UNREADABLE_HE}"
        elif nvr_read and nvr_now:
            line = f"{line} {NVR_NOW_HE.format(codec=codec_label(nvr_now))}"
        rec.update(outcome="failed", reason=code, label=f"נכשל: {failure_line(code) if code != 'nvr_reverted' else 'ה־NVR כבר לא מציג את השינוי.'}",
                   detail=("דולג, וההמרה המשיכה לשאר המצלמות. " if skipped else "") + line)
        return rec
    if expected is None:  # the change did not touch the codec: the NVR read-back is the whole check
        rec["media"], rec["media_reason"] = "not_needed", "not_needed"
        if reboot:
            rec.update(outcome="restart_needed", reason="reboot_required", label="צריך אתחול", detail=RESTART_HE["reboot_required"])
        else:
            rec.update(outcome="nvr_accepted", label="המקליט קיבל", detail=MEDIA_HE["not_needed"])
        return rec
    if media is None or media.codec is None:
        reason = (media.reason if media is not None else None) or "no_codec"
        rec["media"], rec["media_reason"] = "not_checked", reason
        if reboot:
            rec.update(outcome="restart_needed", reason="reboot_required", label="צריך אתחול", detail=RESTART_HE["reboot_required"])
        else:
            rec.update(outcome="nvr_accepted", label="המקליט קיבל", detail=MEDIA_HE.get(reason, MEDIA_HE["no_codec"]))
        return rec
    rec["media_codec"] = codec_label(media.codec)
    if media.codec == expected:
        rec["media"] = "confirmed"
        rec.update(outcome="confirmed", label=f"המצלמה אישרה ({codec_label(expected)})",
                   detail="ה־NVR קיבל את השינוי והמצלמה שולחת עכשיו " + codec_label(expected) + "." + (" ה־NVR ביקש אתחול, אך הקידוד כבר השתנה." if reboot else ""))
        return rec
    rec["media"] = "old" if media.codec == before else "other"
    if reboot:
        rec.update(outcome="restart_needed", reason="reboot_required", label="צריך אתחול", detail=RESTART_HE["reboot_required"])
    elif media.preexisting:
        rec.update(outcome="restart_needed", reason="reconnect", reconnect=True, label="צריך אתחול", detail=RESTART_HE["reconnect"])
    else:
        rec.update(outcome="still_old", reason="media_" + rec["media"], label=f"עדיין {codec_label(media.codec)}", detail=STILL_OLD_HE.format(codec=codec_label(media.codec)))
    return rec


# ------------------------------------------------------------------------------------------------ the media probe

def _live_count() -> int:
    try:
        from ..routers.media import REGISTRY  # the live sessions of this process (late import: routers import services)

        return int(REGISTRY.count())
    except Exception:  # noqa: BLE001 - unknown load is not "full"
        return 0


LIVE_COUNT: Callable[[], int] = _live_count  # tests replace it


def _room_for_probe(max_live: int, stop: threading.Event) -> bool:
    """Wait (at most SLOT_WAIT_S) until the live sessions are below `media.max_live_sessions`."""
    deadline = time.monotonic() + SLOT_WAIT_S
    while LIVE_COUNT() >= max_live:
        if time.monotonic() >= deadline or stop.wait(min(1.0, max(0.0, deadline - time.monotonic()))):
            return False
    return True


def probe(client: Any, listing: dict[str, Any] | None, recorder_id: str, channel: Any, role: str | None, max_live: int,
          stop: threading.Event | None = None) -> Media:
    """One read-only media reading of our stream of (recorder, channel, role). Never raises."""
    stop = stop or threading.Event()
    if client is None:
        return Media(None, "media_not_configured")
    if role not in ("main", "sub") or channel is None:
        return Media(None, "role_unknown")
    try:
        name = g2.stream_name(str(recorder_id), int(channel), role)
    except (ValueError, TypeError):
        return Media(None, "stream_unknown")
    pre = listing.get(name) if listing is not None else None
    if listing is not None and pre is None:
        return Media(None, "stream_unknown")
    # a producer that already reports a codec is a live session somebody opened before the probe (go2rtc keeps it while it has consumers)
    preexisting = bool(pre is not None and getattr(pre, "video_codec", None))
    if not _PROBE_SLOTS.acquire(timeout=SLOT_WAIT_S):
        return Media(None, "busy", preexisting)
    try:
        if not _room_for_probe(max_live, stop):
            return Media(None, "busy", preexisting)
        known, codec = client.probe_video_codec(name, PROBE_TIMEOUT_S)
    except (ApiError, ValueError):
        return Media(None, "unavailable", preexisting)
    except Exception:  # noqa: BLE001 - a probe never breaks the report
        log.exception("media probe of %s failed", name)
        return Media(None, "unavailable", preexisting)
    finally:
        _PROBE_SLOTS.release()
    if not known:
        return Media(None, "stream_unknown", preexisting)
    if codec is None and pre is not None and getattr(pre, "video_codec", None):
        codec, preexisting = pre.video_codec, True
    return Media(family(codec) if codec else None, None if codec else "no_codec", preexisting)


# ------------------------------------------------------------------------------------------------ the stored report

def load(conn: sqlite3.Connection, batch_id: str) -> dict[str, Any] | None:
    raw = get_setting(conn, VERIFY_KEY.format(batch_id))
    if not raw:
        return None
    try:
        rec = json.loads(raw)
    except ValueError:
        return None
    return rec if isinstance(rec, dict) else None


def _save(conn: sqlite3.Connection, batch_id: str, rec: dict[str, Any]) -> None:
    set_setting(conn, VERIFY_KEY.format(batch_id), json.dumps(rec, ensure_ascii=False, separators=(",", ":")))


def is_running(batch_id: str) -> bool:
    with _running_lock:
        t = _running.get(batch_id)
    return (t is not None and t.is_alive()) or nvr_batch._is_live(batch_id)


def _counts(items: dict[str, Any]) -> dict[str, int]:
    out = dict.fromkeys(OUTCOMES, 0)
    for it in items.values():
        o = it.get("outcome")
        if o in out:
            out[o] += 1
    return out


def report(conn: sqlite3.Connection, batch_id: str, meta: dict[str, Any], allows: Callable[[str], bool]) -> dict[str, Any] | None:
    """The batch's verification summary for `batch_status` (read-only). Items of cameras outside the caller's scope are left out of the
    lists (counted in `hidden`). A pass whose thread is gone (a restart) reads `interrupted`."""
    if meta.get("mode") != MODE:
        return None
    rec = load(conn, batch_id)
    if rec is None:
        state = "pending" if meta.get("state") == "running" or is_running(batch_id) else "none"
        return {"state": state, "kind": None, "counts": dict.fromkeys(OUTCOMES, 0), "worklist": [], "skipped": [], "can_recheck": False, "hidden": 0,
                "checked_at": None, "started_at": None}
    items = rec.get("items") or {}
    state = str(rec.get("state") or "done")
    if state == "running" and not is_running(batch_id):
        state = "interrupted"
    visible = {k: v for k, v in items.items() if allows(str(v.get("camera_id") or ""))}
    order = sorted(visible.values(), key=lambda v: int(v.get("index") or 0))
    worklist = [{k: v.get(k) for k in ("index", "camera_id", "stream_ref", "outcome", "label", "skipped")} for v in order if v.get("outcome") in WORKLIST]
    skipped = [{k: v.get(k) for k in ("index", "camera_id", "stream_ref", "reason", "label")} for v in order if v.get("skipped")]
    can = (state not in ("running", "pending") and meta.get("state") != "running" and any(v.get("outcome") in RECHECKABLE for v in visible.values()))
    return {"state": state, "kind": rec.get("kind"), "started_at": rec.get("started_at"), "checked_at": rec.get("checked_at"),
            "counts": _counts(visible), "worklist": worklist, "skipped": skipped, "can_recheck": can, "hidden": len(items) - len(visible),
            "next_recheck_at": rec.get("next_recheck_at")}


def item_report(rec: dict[str, Any] | None, change_id: str) -> dict[str, Any] | None:
    if not rec:
        return None
    it = (rec.get("items") or {}).get(change_id)
    if not isinstance(it, dict):
        return None
    return {k: it.get(k) for k in ("outcome", "label", "detail", "reason", "expected", "before", "media", "media_codec", "media_reason", "nvr", "nvr_now",
                                   "reboot_required", "reconnect", "skipped", "checked_at")}


# ------------------------------------------------------------------------------------------------ a pass

def _max_live(conn: sqlite3.Connection) -> int:
    try:
        return max(1, int(get_setting(conn, "media.max_live_sessions") or DEFAULT_MAX_LIVE))
    except ValueError:
        return DEFAULT_MAX_LIVE


def _wait(seconds: float, stop: threading.Event) -> bool:
    return not stop.wait(max(0.0, seconds)) if seconds > 0 else not stop.is_set()


def run_pass(db: Any, settings: Settings, batch_id: str, *, kind: str = "after_apply", only: set[str] | None = None) -> None:
    """One verification pass over the batch's items (`only`: these change ids). Reads only: the NVR LIST once on a re-check, go2rtc's
    listing once and one probe per stream whose codec the change touched and the NVR accepted. The report is written item by item."""
    stop = nvr_batch._shutdown
    with db.connection(label="nvr_verify.load") as conn:
        meta = nvr_batch._meta(conn, batch_id)
        if meta is None or meta.get("mode") != MODE:
            return
        rows = conn.execute("SELECT * FROM nvr_changes WHERE batch_id = ? ORDER BY batch_index", (batch_id,)).fetchall()
        rows = [r for r in rows if only is None or str(r["id"]) in only]
        cam_ids = sorted({str(r["camera_id"]) for r in rows if r["camera_id"]})
        cams: dict[str, Any] = {}
        for start in range(0, len(cam_ids), 500):
            chunk = cam_ids[start:start + 500]
            for c in conn.execute(f"SELECT id, recorder_id, channel FROM cameras WHERE id IN ({','.join('?' * len(chunk))})", chunk).fetchall():
                cams[str(c["id"])] = c
        max_live = _max_live(conn)
        rec = load(conn, batch_id) or {"v": 1, "items": {}}
        rec.update({"state": "running", "kind": kind, "started_at": now_iso()})
        _save(conn, batch_id, rec)
    skipped_ids = set(meta.get("skipped") or [])
    roles = meta.get("roles") or {}
    rid = str(meta.get("recorder_id") or "")
    nvr_now: dict[str, tuple[str | None, str | None]] = {}
    nvr_read = nvr_unreadable = False
    if kind == "recheck":
        try:
            with db.connection(mode="read", label="nvr_verify.adapter") as conn:
                adapter = registry.adapter_for(conn, settings, rid)
            with nvr.deadline(LIST_DEADLINE_S):
                by_channel = adapter.read_stream_encodings()
            for streams in by_channel.values():
                for s in streams:
                    nvr_now[str(s.stream_ref)] = (s.role, family(s.encoding.get("codec")))
            nvr_read = True
        except ApiError:
            nvr_unreadable = True
    probing = []
    for r in rows:
        exp, _before = expected_codecs(r)
        acc = (nvr_now.get(str(r["stream_ref"]), (None, None))[1] == exp) if nvr_read and exp else str(r["status"]) in ACCEPTED
        probing.append(exp is not None and acc)
    client = listing = None
    if any(probing):
        try:
            client = g2.Go2rtc(settings)
        except ApiError:
            client = None
        if client is not None:
            if kind == "after_apply" and not _wait(SETTLE_S, stop):
                return _end(db, batch_id, "interrupted")
            try:
                listing = client.list_streams()
            except ApiError:
                client = None
    first = True
    for r, wants_probe in zip(rows, probing):
        if stop.is_set():
            return _end(db, batch_id, "interrupted")
        media: Media | None = None
        if wants_probe:
            if not first and not _wait(PROBE_GAP_S, stop):
                return _end(db, batch_id, "interrupted")
            first = False
            cam = cams.get(str(r["camera_id"]))
            ref = str(r["stream_ref"])
            role = (nvr_now.get(ref) or (None, None))[0] or role_of(ref, roles)
            if client is None:
                media = Media(None, "media_not_configured" if not settings.go2rtc_url else "unavailable")
            elif cam is None:
                media = Media(None, "stream_unknown")
            else:
                media = probe(client, listing, cam["recorder_id"], cam["channel"], role, max_live, stop)
        now = nvr_now.get(str(r["stream_ref"]))
        item = assess(r, skipped=str(r["id"]) in skipped_ids or int(r["batch_index"] or 0) in skipped_ids, media=media,
                      nvr_now=now[1] if now else None, nvr_read=nvr_read, nvr_unreadable=nvr_unreadable)
        with db.connection(label="nvr_verify.item") as conn:
            cur = load(conn, batch_id) or {"v": 1, "items": {}}
            cur.setdefault("items", {})[str(r["id"])] = item
            _save(conn, batch_id, cur)
    _end(db, batch_id, "done")


def _end(db: Any, batch_id: str, state: str) -> None:
    with db.connection(label="nvr_verify.end") as conn:
        rec = load(conn, batch_id) or {"v": 1, "items": {}}
        rec.update({"state": state, "checked_at": now_iso(), "next_recheck_at": time.time() + RECHECK_MIN_S})
        _save(conn, batch_id, rec)


def after_batch(db: Any, settings: Settings, batch_id: str) -> None:
    """Called by the batch runner (its own thread) once the batch has ended: the first pass. Never raises."""
    try:
        run_pass(db, settings, batch_id, kind="after_apply")
    except Exception:  # noqa: BLE001 - the batch result stands; the report says "interrupted"
        log.exception("nvr verify %s: the pass failed", batch_id)
        try:
            _end(db, batch_id, "interrupted")
        except Exception:  # noqa: BLE001
            log.exception("nvr verify %s: could not record the end", batch_id)


# ------------------------------------------------------------------------------------------------ the re-check route

def start_recheck(conn: sqlite3.Connection, db: Any, settings: Settings, principal: Any, batch_id: str, *, request_id: str | None = None) -> dict[str, Any]:
    """`POST /nvr/stream-batches/{id}/verify`: a read-only re-check of the worklist and the unverified streams, in the background. The
    caller has checked nvr.configure at installation; every camera re-checked needs it too (as the batch did). Refusals are audited."""
    meta = nvr_batch._meta(conn, batch_id)
    if meta is None:
        raise ApiError(404, "not_found", "השינוי המרובה לא נמצא.")
    rid = str(meta.get("recorder_id") or "*")

    def refuse(exc: ApiError) -> ApiError:
        audit(conn, actor=principal, action="nvr.stream.batch.verify", decision="denied", resource_type="recorder", resource_id=rid, reason=exc.code,
              request_id=request_id, details={"batch_id": batch_id})
        return exc

    if meta.get("mode") != MODE:
        raise refuse(ApiError(409, "verify_not_available", "בדיקה חוזרת קיימת רק לשינוי קידוד."))
    if meta.get("state") == "running" or is_running(batch_id):
        raise refuse(ApiError(409, "verify_in_progress", "הבדיקה עדיין מתבצעת.", retryable=True))
    rec = load(conn, batch_id) or {}
    nxt = rec.get("next_recheck_at")
    if isinstance(nxt, (int, float)) and time.time() < nxt:
        raise refuse(ApiError(429, "verify_too_soon", "בדיקה חוזרת אפשרית בעוד כמה שניות.", retryable=True, details={"retry_after_s": int(nxt - time.time()) + 1}))
    items = rec.get("items") or {}
    ids = {cid for cid, it in items.items() if isinstance(it, dict) and it.get("outcome") in RECHECKABLE}
    if not ids:
        raise refuse(ApiError(409, "nothing_to_verify", "אין מצלמות לבדיקה חוזרת."))
    cams = sorted({str(items[cid].get("camera_id")) for cid in ids if items[cid].get("camera_id")})
    nvr_batch.authorize_targets(conn, principal, cams)  # nvr.configure on every camera re-checked (a deny is a 403, audited by `require`)
    audit(conn, actor=principal, action="nvr.stream.batch.verify", decision="allowed", resource_type="recorder", resource_id=rid, request_id=request_id,
          details={"batch_id": batch_id, "items": len(ids)})
    rec["next_recheck_at"] = time.time() + RECHECK_MIN_S
    rec["state"] = "running"
    _save(conn, batch_id, rec)
    from ..db import commit_now

    commit_now(conn)
    t = threading.Thread(target=_recheck_thread, args=(db, settings, batch_id, ids), name=f"nvr-verify-{batch_id}", daemon=True)
    with _running_lock:
        _running[batch_id] = t
    t.start()
    return nvr_batch.batch_status(conn, principal, batch_id)


def _recheck_thread(db: Any, settings: Settings, batch_id: str, ids: set[str]) -> None:
    try:
        run_pass(db, settings, batch_id, kind="recheck", only=ids)
    except Exception:  # noqa: BLE001
        log.exception("nvr verify %s: the re-check failed", batch_id)
        try:
            _end(db, batch_id, "interrupted")
        except Exception:  # noqa: BLE001
            log.exception("nvr verify %s: could not record the end", batch_id)
    finally:
        with _running_lock:
            _running.pop(batch_id, None)


def wait_idle(timeout: float = 30.0) -> bool:
    """Tests: True once no re-check thread of this process is alive."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with _running_lock:
            alive = [t for t in _running.values() if t.is_alive()]
        if not alive:
            return True
        time.sleep(0.02)
    return False
