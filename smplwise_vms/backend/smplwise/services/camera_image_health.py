"""Camera image health (board r091, CAMHEALTH091-295, docs/changes/CR-CAMHEALTH091.md): is the PICTURE of a connected camera
usable - not too dark, not blurred, not frozen, not shifted away from its reference view.

THE LOAD RULE (owner: no extra load on the NVR, device access read-only)
- A sample is ONE JPEG, taken at a low rate (default every 15 minutes per camera, at most `per_pass_max` cameras per pass with
  a pause between grabs). It comes from, in this order:
  1. the add-on's own snapshot cache (`<data>/snapshots/<camera>.jpg`, written when someone looked at the camera) when it is
     newer than the last sample - no device I/O at all;
  2. the camera's EXISTING sub stream in go2rtc (`smplwise_<recorder>_ch<n>_sub`, created by the stream sync), asked for by
     NAME ONLY (`/api/frame.jpeg?src=<name>`): no source URL is ever sent, nothing is created, re-pointed or deleted in go2rtc,
     and a stream outside the `smplwise_` namespace is never named. With `passive_only` a stream is used only while it is
     already playing (go2rtc already holds the sub stream open - zero new sessions toward the recorder).
  The recorder's own picture endpoint (ISAPI `.../picture`, a MAIN-stream decode on the device) is NEVER called here.
- Nothing runs while the switch is off (the default): no thread work, no grabs, and every open notification resolves.

THE CHECKS (pure functions on a grayscale numpy array; Pillow decodes the JPEG with its DCT draft mode - cheap)
- dark:    mean brightness (0-255) below `dark_level`.
- blurred: variance of the 4-neighbour Laplacian below `blur_min` (not judged on a dark picture - a dark picture has no edges).
- frozen:  mean absolute difference to the previous sample below `freeze_diff`, for `freeze_samples` samples in a row (not judged
           on a dark or blurred picture - too little detail to prove a freeze).
- shifted: the best translation of the current thumbnail against the stored reference thumbnail (normalised cross-correlation,
           brute force over +-25 % of the frame) moved more than `shift_pct` % of the frame, or even the best match correlates
           below `shift_corr_min` (the view changed). Not judged on a dark or blurred picture.
  dark / blurred / shifted must hold for `confirm_samples` samples in a row before they count; a notification resolves only after
  the condition stayed clear for `recover_s`.

STATE
- The reference thumbnails (64 x 48 grayscale, 3 KB) are kept in `camera_image_refs` (migration, PROVISIONAL number) so a restart
  keeps them; the first usable sample of a camera becomes its reference automatically, and an administrator may set it again or
  clear it. Everything else (metrics, streaks, the previous frame) is in memory: a restart starts empty, which is safe because the
  open notification rows are the durable state, and stale results are not judged.
- Never stored or served: an image, an address, a credential, a stream source. Results carry names, numbers and states only."""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import re
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from ..config import Settings
from ..db import Database, get_setting, now_iso, set_setting
from ..errors import ApiError

log = logging.getLogger("smplwise.camera_image_health")

SOURCE = "camera.image"
SETTING_KEY = "camera_image_health.settings"
KINDS = ("dark", "blurred", "frozen", "shifted")
KIND_TEXT = {"dark": "התמונה חשוכה", "blurred": "התמונה מטושטשת", "frozen": "התמונה קפואה", "shifted": "זווית המצלמה השתנתה"}
ERROR_TEXT = {"no_source": "אין זרם משנה פעיל", "media_unavailable": "שירות הווידאו לא זמין", "media_not_configured": "שירות הווידאו לא הוגדר",
              "snapshot_unavailable": "לא התקבלה תמונה", "media_error": "שירות הווידאו החזיר שגיאה", "decode_failed": "התמונה לא נקראה"}

# key -> (default, minimum, maximum). Integers unless the default is a float. Every value is editable in Settings.
NUMBERS: dict[str, tuple[float, float, float]] = {
    "interval_s": (900, 300, 86400),        # how often each camera is sampled
    "per_pass_max": (6, 1, 50),             # at most this many cameras per pass (a pass every 30 s) - spreads the grabs
    "dark_level": (20, 0, 128),             # mean brightness 0-255 below this = dark
    "blur_min": (25.0, 0.5, 5000.0),        # Laplacian variance below this = blurred
    "freeze_diff": (0.4, 0.0, 20.0),        # mean absolute difference 0-255 below this = the same picture
    "freeze_samples": (3, 2, 20),           # this many identical samples in a row = frozen
    "shift_pct": (8, 1, 25),                # the view moved more than this % of the frame = shifted
    "shift_corr_min": (0.45, 0.05, 0.95),   # even the best match correlates below this = the view changed
    "confirm_samples": (2, 1, 10),          # dark / blurred / shifted must hold this many samples in a row
    "recover_s": (1800, 0, 86400),          # a condition must stay clear this long before its notification is resolved
}
BOOLS: dict[str, bool] = {
    "enabled": False,                       # owner rule: shipped OFF
    "passive_only": False,                  # only streams go2rtc is already playing (no new session toward the recorder)
    "check_dark": True, "check_blur": True, "check_freeze": True, "check_shift": True,
}
EXCLUDED_KEY = "excluded"                   # camera ids never sampled (a PTZ camera that moves on purpose, say)
EXCLUDED_MAX = 2000
_CAMERA_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

TICK_S = 30.0                               # the poller wakes this often and samples the cameras that are due
GRAB_GAP_S = 1.0                            # pause between two grabs of one pass
STALE_INTERVALS = 3                         # a result older than this many intervals is not judged
CHECK_NOW_MIN_S = 30
ANALYSIS_SIZE = (320, 240)                  # brightness and blur
FREEZE_SIZE = (128, 96)                     # the previous frame kept for the freeze check
THUMB_SIZE = (64, 48)                       # the reference thumbnail (shift)
SHIFT_SEARCH = 0.25                         # the shift search covers +-25 % of the frame
SNAPSHOT_MAX = 4 * 1024 * 1024


def _now_ts() -> float:
    """The notification core's clock (tests move it)."""
    from . import notify

    return notify.now_utc().timestamp()


# ---------------------------------------------------------------- settings

def _is_float(key: str) -> bool:
    return isinstance(NUMBERS[key][0], float)


def defaults() -> dict[str, Any]:
    out: dict[str, Any] = {k: (float(v[0]) if _is_float(k) else int(v[0])) for k, v in NUMBERS.items()}
    out.update(BOOLS)
    out[EXCLUDED_KEY] = []
    return out


def _num_ok(key: str, v: Any) -> bool:
    lo, hi = NUMBERS[key][1], NUMBERS[key][2]
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return False
    if not _is_float(key) and not (isinstance(v, int) or float(v).is_integer()):
        return False
    return lo <= v <= hi


def _ids_ok(v: Any) -> bool:
    return isinstance(v, list) and len(v) <= EXCLUDED_MAX and all(isinstance(x, str) and _CAMERA_ID.fullmatch(x) for x in v)


def load(conn: sqlite3.Connection) -> dict[str, Any]:
    """The effective settings: the stored values over the defaults (a corrupt or out-of-range value reads as its default)."""
    out = defaults()
    try:
        stored = json.loads(get_setting(conn, SETTING_KEY) or "{}")
    except (ValueError, sqlite3.Error):
        stored = {}
    if not isinstance(stored, dict):
        return out
    for k in NUMBERS:
        v = stored.get(k)
        if _num_ok(k, v):
            out[k] = float(v) if _is_float(k) else int(v)
    for k in BOOLS:
        if isinstance(stored.get(k), bool):
            out[k] = stored[k]
    if _ids_ok(stored.get(EXCLUDED_KEY)):
        out[EXCLUDED_KEY] = sorted(set(stored[EXCLUDED_KEY]))
    return out


def validate(body: Any) -> dict[str, Any]:
    """A PUT body -> the values to store (unknown keys refused). ApiError 422 `validation` with the field."""
    if not isinstance(body, dict):
        raise ApiError(422, "validation", "ערכים לא תקינים.")
    out: dict[str, Any] = {}
    for k, v in body.items():
        if k in BOOLS:
            if not isinstance(v, bool):
                raise ApiError(422, "validation", "ערך לא תקין.", details={"field": k})
            out[k] = v
        elif k in NUMBERS:
            if not _num_ok(k, v):
                lo, hi = NUMBERS[k][1], NUMBERS[k][2]
                raise ApiError(422, "validation", f"הערך מחוץ לטווח ({lo:g} עד {hi:g}).", details={"field": k, "min": lo, "max": hi})
            out[k] = float(v) if _is_float(k) else int(v)
        elif k == EXCLUDED_KEY:
            if not _ids_ok(v):
                raise ApiError(422, "validation", "רשימת מצלמות לא תקינה.", details={"field": k})
            out[k] = sorted(set(v))
        else:
            raise ApiError(422, "validation", "שדה לא מוכר.", details={"field": k})
    return out


def save(conn: sqlite3.Connection, changes: dict[str, Any]) -> dict[str, Any]:
    current = load(conn)
    current.update(changes)
    set_setting(conn, SETTING_KEY, json.dumps(current, sort_keys=True))
    if changes.get("enabled") is False:
        reset_results()  # switched off: nothing is shown as current, and the next notification pass resolves every open row
    return current


def ranges() -> dict[str, dict[str, float]]:
    return {k: {"default": d, "min": lo, "max": hi} for k, (d, lo, hi) in NUMBERS.items()}


# ---------------------------------------------------------------- the checks (pure)

def decode(jpeg: bytes, size: tuple[int, int] = ANALYSIS_SIZE) -> np.ndarray:
    """JPEG bytes -> a grayscale uint8 array no larger than `size` (Pillow's draft mode decodes at 1/2, 1/4 or 1/8 scale)."""
    from . import image_guard

    try:
        im = image_guard.open_untrusted(jpeg, ["JPEG"])  # a camera / NVR frame: JPEG only
        im.draft("L", size)
        im = im.convert("L")
        im.thumbnail(size)
        return np.asarray(im, dtype=np.uint8)
    except Exception as exc:  # noqa: BLE001 - any undecodable body is one failed sample
        raise ApiError(503, "decode_failed", "התמונה לא נקראה.") from exc


def resize(gray: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    from PIL import Image

    return np.asarray(Image.fromarray(gray).resize(size, Image.BILINEAR), dtype=np.uint8)


def brightness(gray: np.ndarray) -> float:
    return float(gray.mean()) if gray.size else 0.0


def sharpness(gray: np.ndarray) -> float:
    """Variance of the 4-neighbour Laplacian (higher = sharper)."""
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    g = gray.astype(np.float32)
    lap = g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:] - 4.0 * g[1:-1, 1:-1]
    return float(lap.var())


def frame_diff(a: np.ndarray, b: np.ndarray) -> float | None:
    """Mean absolute difference of two same-size frames (None when the sizes differ - a resolution change is not a freeze)."""
    if a.shape != b.shape:
        return None
    return float(np.abs(a.astype(np.int16) - b.astype(np.int16)).mean())


def _norm(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float32)
    x = x - x.mean()
    s = float(x.std())
    return x / s if s > 1e-6 else x


def best_shift(ref: np.ndarray, cur: np.ndarray, search: float = SHIFT_SEARCH) -> tuple[int, int, float]:
    """(dx, dy, correlation) of the translation that best maps `ref` onto `cur` (normalised cross-correlation over the overlap,
    brute force within +-`search` of the frame). `cur` is resized to `ref`'s shape first."""
    if cur.shape != ref.shape:
        cur = resize(cur, (ref.shape[1], ref.shape[0]))
    a, b = _norm(ref), _norm(cur)
    h, w = a.shape
    my, mx = max(1, int(h * search)), max(1, int(w * search))
    best = (0, 0, -2.0)
    for dy in range(-my, my + 1):
        for dx in range(-mx, mx + 1):
            ra = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
            rb = b[max(0, dy):h - max(0, -dy), max(0, dx):w - max(0, -dx)]
            if ra.size == 0:
                continue
            # re-normalise on the overlap so a partial window is not penalised for its own mean / contrast
            c = float((_norm(ra) * _norm(rb)).mean())
            # prefer the smaller move on a tie (a flat or periodic picture)
            if c > best[2] + 1e-6 or (abs(c - best[2]) <= 1e-6 and abs(dx) + abs(dy) < abs(best[0]) + abs(best[1])):
                best = (dx, dy, c)
    return best


@dataclass
class Analysis:
    brightness: float
    sharpness: float
    diff: float | None
    shift_pct: float | None
    corr: float | None
    bad: dict[str, bool]          # per kind: this sample alone looks bad (frozen = identical to the previous sample)


def analyse(gray: np.ndarray, prev: np.ndarray | None, ref: np.ndarray | None, th: dict[str, Any]) -> Analysis:
    """One decoded sample against the previous sample and the reference -> metrics and the per-sample verdicts."""
    b = brightness(gray)
    s = sharpness(gray)
    dark = b < th["dark_level"]
    blurred = not dark and s < th["blur_min"]
    small = resize(gray, FREEZE_SIZE)
    diff = frame_diff(small, prev) if prev is not None else None
    # a dark or blurred picture carries too little detail to prove a freeze (a static night scene, a fogged lens): not judged
    same = diff is not None and diff < th["freeze_diff"] and not dark and not blurred
    shift_pct = corr = None
    shifted = False
    if ref is not None and not dark and not blurred:
        dx, dy, corr = best_shift(ref, resize(gray, (ref.shape[1], ref.shape[0])))
        shift_pct = round(100.0 * max(abs(dx) / ref.shape[1], abs(dy) / ref.shape[0]), 1)
        shifted = corr < th["shift_corr_min"] or shift_pct > th["shift_pct"]
        corr = round(corr, 3)
    return Analysis(round(b, 1), round(s, 1), None if diff is None else round(diff, 2), shift_pct, corr,
                    {"dark": dark, "blurred": blurred, "frozen": same, "shifted": shifted})


# ---------------------------------------------------------------- in-memory state per camera

@dataclass
class CamState:
    camera_id: str
    name: str = ""
    sampled_at: float | None = None     # last attempt
    ok_at: float | None = None          # last sample that was analysed
    source: str | None = None           # cache | stream
    error: str | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    prev: np.ndarray | None = None
    cache_mtime: float | None = None    # the snapshot cache file already used (never analysed twice: that would look frozen)
    streak: dict[str, int] = field(default_factory=dict)   # kind -> bad samples in a row
    active: set[str] = field(default_factory=set)           # kinds that hold now
    thumb: np.ndarray | None = None     # the latest thumbnail (an administrator may make it the reference)


STORE: dict[str, CamState] = {}
REFS: dict[str, np.ndarray] = {}        # camera id -> reference thumbnail (mirror of camera_image_refs)
_REFS_LOADED = {"done": False}
_LOCK = threading.Lock()
_LAST_ACTIVE: dict[str, float] = {}
_PASS = {"at": None, "checked": 0.0}


def reset() -> None:
    """Tests: forget every result, reference mirror and hold."""
    with _LOCK:
        STORE.clear()
        REFS.clear()
        _LAST_ACTIVE.clear()
        _REFS_LOADED["done"] = False
    _PASS["at"], _PASS["checked"] = None, 0.0


def reset_results() -> None:
    with _LOCK:
        STORE.clear()
    _PASS["at"] = None


def state_of(camera_id: str) -> CamState:
    with _LOCK:
        st = STORE.get(camera_id)
        if st is None:
            st = STORE[camera_id] = CamState(camera_id)
        return st


def record(st: CamState, gray: np.ndarray, th: dict[str, Any], now_ts: float, source: str) -> Analysis:
    """One decoded sample -> the camera's state (streaks, active kinds, metrics). Tests call it directly."""
    ref = REFS.get(st.camera_id)
    a = analyse(gray, st.prev, ref, th)
    checks = {"dark": th["check_dark"], "blurred": th["check_blur"], "frozen": th["check_freeze"], "shifted": th["check_shift"]}
    with _LOCK:
        for k in KINDS:
            st.streak[k] = st.streak.get(k, 0) + 1 if (a.bad[k] and checks[k]) else 0
        need = {"dark": th["confirm_samples"], "blurred": th["confirm_samples"], "shifted": th["confirm_samples"], "frozen": th["freeze_samples"] - 1}
        st.active = {k for k in KINDS if checks[k] and st.streak[k] >= need[k]}
        st.prev = resize(gray, FREEZE_SIZE)
        st.thumb = resize(gray, THUMB_SIZE)
        st.sampled_at = st.ok_at = now_ts
        st.source, st.error = source, None
        st.metrics = {"brightness": a.brightness, "sharpness": a.sharpness, "diff": a.diff, "shift_pct": a.shift_pct, "corr": a.corr}
    return a


def record_error(st: CamState, code: str, now_ts: float) -> None:
    """A sample that could not be taken: the camera is not judged (its streaks and active kinds stay as they were)."""
    with _LOCK:
        st.sampled_at, st.error = now_ts, code


def fresh(st: CamState, interval_s: int, now_ts: float) -> bool:
    return st.ok_at is not None and now_ts - st.ok_at <= STALE_INTERVALS * interval_s + TICK_S


# ---------------------------------------------------------------- references (camera_image_refs)

def _blob(thumb: np.ndarray) -> bytes:
    return np.ascontiguousarray(thumb, dtype=np.uint8).tobytes()


def load_refs(conn: sqlite3.Connection) -> None:
    rows = conn.execute("SELECT camera_id, width, height, thumb FROM camera_image_refs").fetchall()
    with _LOCK:
        REFS.clear()
        for r in rows:
            w, h, data = int(r["width"]), int(r["height"]), bytes(r["thumb"])
            if len(data) == w * h:
                REFS[str(r["camera_id"])] = np.frombuffer(data, dtype=np.uint8).reshape(h, w).copy()
        _REFS_LOADED["done"] = True


def _ensure_refs(conn: sqlite3.Connection) -> None:
    if not _REFS_LOADED["done"]:
        load_refs(conn)


def set_reference(conn: sqlite3.Connection, camera_id: str, thumb: np.ndarray, by: str | None, auto: bool) -> None:
    h, w = thumb.shape
    conn.execute("INSERT INTO camera_image_refs(camera_id, width, height, thumb, set_at, set_by, auto) VALUES (?,?,?,?,?,?,?) "
                 "ON CONFLICT(camera_id) DO UPDATE SET width = excluded.width, height = excluded.height, thumb = excluded.thumb, set_at = excluded.set_at, "
                 "set_by = excluded.set_by, auto = excluded.auto", (camera_id, w, h, _blob(thumb), now_iso(), by, int(auto)))
    with _LOCK:
        REFS[camera_id] = thumb.copy()
        st = STORE.get(camera_id)
        if st is not None:
            st.streak["shifted"] = 0
            st.active.discard("shifted")


def clear_reference(conn: sqlite3.Connection, camera_id: str) -> None:
    conn.execute("DELETE FROM camera_image_refs WHERE camera_id = ?", (camera_id,))
    with _LOCK:
        REFS.pop(camera_id, None)
        st = STORE.get(camera_id)
        if st is not None:
            st.streak["shifted"] = 0
            st.active.discard("shifted")


def references(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    return {str(r["camera_id"]): {"set_at": r["set_at"], "auto": bool(r["auto"])}
            for r in conn.execute("SELECT camera_id, set_at, auto FROM camera_image_refs").fetchall()}


# ---------------------------------------------------------------- sampling (device I/O: none toward the recorder)

def _cameras(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    from ..recorder_scope import is_disabled

    try:
        gone = {r[0] for r in conn.execute("SELECT id FROM recorders WHERE removed_at IS NOT NULL").fetchall()}
    except sqlite3.OperationalError:
        gone = set()
    rows = conn.execute("SELECT id, recorder_id, channel, alias, name_source, enabled FROM cameras WHERE enabled = 1 ORDER BY recorder_id, channel LIMIT ?",
                        (EXCLUDED_MAX,)).fetchall()
    return [r for r in rows if r["recorder_id"] not in gone and not is_disabled(r["recorder_id"])]


def _name(row: Any) -> str:
    return str(row["alias"] or row["name_source"] or f"ערוץ {row['channel']}")


def due(rows: list[Any], th: dict[str, Any], now_ts: float) -> list[Any]:
    """The cameras to sample this pass: not excluded, last attempt older than the interval, oldest first, at most per_pass_max."""
    excluded = set(th[EXCLUDED_KEY])
    with _LOCK:
        last = {k: v.sampled_at for k, v in STORE.items()}
    out = [r for r in rows if str(r["id"]) not in excluded and (last.get(str(r["id"])) is None or now_ts - (last[str(r["id"])] or 0) >= th["interval_s"])]
    out.sort(key=lambda r: last.get(str(r["id"])) or 0.0)
    return out[: th["per_pass_max"]]


def _from_cache(settings: Settings, st: CamState) -> tuple[bytes, float] | None:
    path = settings.data_dir / "snapshots" / f"{st.camera_id}.jpg"
    try:
        stat = path.stat()
    except OSError:
        return None
    if st.cache_mtime is not None and stat.st_mtime <= st.cache_mtime:
        return None  # already analysed: the same file again would look like a frozen picture
    if st.ok_at is not None and stat.st_mtime <= st.ok_at:
        return None  # older than our own last sample
    if stat.st_size <= 0 or stat.st_size > SNAPSHOT_MAX:
        return None
    try:
        data = path.read_bytes()
    except OSError:
        return None
    return (data, stat.st_mtime) if data.startswith(b"\xff\xd8\xff") else None


def sample(settings: Settings, row: Any, th: dict[str, Any], client: Any, listing: dict[str, Any] | None, now_ts: float | None = None) -> CamState:
    """One camera: the cache, else its existing sub stream by name. `client` is a go2rtc.Go2rtc (or None when go2rtc is not
    configured), `listing` its stream listing of this pass (None when it could not be read)."""
    from . import go2rtc as g2

    now_ts = now_ts or _now_ts()
    st = state_of(str(row["id"]))
    st.name = _name(row)
    cached = _from_cache(settings, st)
    data, source = None, None
    if cached is not None:
        data, source = cached[0], "cache"
    else:
        try:
            name = g2.stream_name(str(row["recorder_id"]), int(row["channel"]), "sub")
        except ValueError:
            name = None
        info = (listing or {}).get(name) if name else None
        if client is None or info is None or (th["passive_only"] and not getattr(info, "online", False)):
            record_error(st, "no_source", now_ts)
            return st
        try:
            data, source = client.frame_existing(name), "stream"
        except ApiError as exc:
            record_error(st, exc.code, now_ts)
            return st
    try:
        gray = decode(data)
    except ApiError as exc:
        record_error(st, exc.code, now_ts)
        return st
    if source == "cache":
        st.cache_mtime = cached[1]  # type: ignore[index]
    record(st, gray, th, now_ts, source)
    return st


def _client(settings: Settings) -> Any:
    from . import go2rtc as g2

    try:
        return g2.Go2rtc(settings)
    except ApiError:
        return None


def poll_once(db: Database, settings: Settings, force: bool = False) -> int:
    """One pass: settings and the due cameras under a short read connection, then the grabs with NO database connection held,
    then the new automatic references under a short write connection. Returns how many cameras were attempted."""
    with db.connection(mode="read", label="camera_image_health.targets") as conn:
        th = load(conn)
        if not th["enabled"]:
            return 0
        _ensure_refs(conn)
        rows = _cameras(conn)
    now_ts = _now_ts()
    with _LOCK:
        for cid in [c for c in STORE if c not in {str(r["id"]) for r in rows} or c in set(th[EXCLUDED_KEY])]:
            STORE.pop(cid, None)  # removed / disabled / excluded: its rows resolve at the next notification pass
    targets = due(rows, th, now_ts if not force else now_ts + th["interval_s"])
    if not targets:
        return 0
    client = _client(settings)
    listing = None
    if client is not None:
        try:
            listing = client.list_streams()
        except ApiError:
            listing = None
    new_refs: list[tuple[str, np.ndarray]] = []
    for i, row in enumerate(targets):
        if i and not force and POLLER.stop_evt.wait(GRAB_GAP_S):
            break
        try:
            st = sample(settings, row, th, client, listing)
        except Exception:  # noqa: BLE001 - one camera never stops the others
            log.exception("camera image sample %s failed", row["id"])
            continue
        if st.error is None and st.thumb is not None and st.camera_id not in REFS and not ({"dark", "blurred"} & _bad_now(st)):
            new_refs.append((st.camera_id, st.thumb))
    if new_refs:
        with db.connection(label="camera_image_health.refs") as conn:
            for cid, thumb in new_refs:
                set_reference(conn, cid, thumb, None, auto=True)
    _PASS["at"] = _now_ts()
    return len(targets)


def _bad_now(st: CamState) -> set[str]:
    return {k for k, n in st.streak.items() if n > 0}


def check_now(db: Database, settings: Settings) -> bool:
    """The screen's "check now": one pass over the oldest `per_pass_max` cameras, at most every CHECK_NOW_MIN_S. False when skipped."""
    if _PASS["checked"] and time.monotonic() - _PASS["checked"] < CHECK_NOW_MIN_S:
        return False
    _PASS["checked"] = time.monotonic()
    poll_once(db, settings, force=True)
    return True


class Poller:
    def __init__(self) -> None:
        self.thread: threading.Thread | None = None
        self.stop_evt = threading.Event()

    def start(self, db: Database, settings: Settings) -> None:
        if os.environ.get("SW_CAMERA_IMAGE_HEALTH", "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._loop, args=(db, settings), name="camera-image-health", daemon=True)
        self.thread.start()

    def shutdown(self, timeout: float = 3.0) -> None:
        self.stop_evt.set()
        t = self.thread
        if t is not None and t is not threading.current_thread():
            t.join(timeout=timeout)

    def _loop(self, db: Database, settings: Settings) -> None:
        if self.stop_evt.wait(20.0):
            return
        while not self.stop_evt.is_set():
            try:
                poll_once(db, settings)  # returns at once while the switch is off
            except Exception:  # noqa: BLE001 - the poller never dies on one bad pass
                log.exception("camera image health pass failed")
            self.stop_evt.wait(TICK_S)


POLLER = Poller()


# ---------------------------------------------------------------- the notification pass (inside notify_sources.tick)

def tick(conn: sqlite3.Connection, now: dt.datetime) -> dict[str, int]:
    """Every camera's active kinds -> `reconcile` of `camera.image`. Off: nothing is due or active, so every open row resolves.
    A camera without a fresh result is not judged (its open rows stay open)."""
    from . import notify
    from .notify_policy import get_policy
    from .notify_sources import held, reconcile

    ts = now.timestamp()
    th = load(conn)
    due_: dict[str, notify.Signal] = {}
    active: set[str] = set()
    if th["enabled"]:
        hold = int((get_policy(conn, SOURCE) or {}).get("after_s") or 0)
        names = {str(r["id"]): _name(r) for r in _cameras(conn)}
        with _LOCK:
            states = [(k, v.ok_at, set(v.active), v) for k, v in STORE.items() if k in names]
        keep: list[str] = []
        for cid, _ok, kinds, st in states:
            if not fresh(st, th["interval_s"], ts):
                keep.append(f"{SOURCE}:{cid}:")
                continue
            for kind in KINDS:
                key = f"{SOURCE}:{cid}:{kind}"
                on = kind in kinds
                if on:
                    _LAST_ACTIVE[key] = ts
                    active.add(key)
                elif ts - _LAST_ACTIVE.get(key, -1e12) < th["recover_s"]:
                    active.add(key)
                sig = notify.Signal(SOURCE, "camera", cid, dedupe_key=key, params={"name": names[cid], "detail": KIND_TEXT[kind]},
                                    origin={"camera_id": cid, "kind": kind}, link="#/investigate/health")
                if held(key, on, hold, ts):
                    due_[key] = sig
        if keep:
            for (k,) in conn.execute("SELECT dedupe_key FROM notifications WHERE source = ? AND state != 'resolved'", (SOURCE,)).fetchall():
                if any(k.startswith(p) for p in keep):
                    active.add(k)
    else:
        _LAST_ACTIVE.clear()
    return reconcile(conn, SOURCE, due_, active, now)


# ---------------------------------------------------------------- the screen

def _iso(ts: float | None) -> str | None:
    return None if ts is None else dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def view(conn: sqlite3.Connection, visible: set[str] | None, now_ts: float | None = None) -> dict[str, Any]:
    """GET /camera-image-health: per camera the state (ok | warn | unknown | excluded | off) with the problem kinds and numbers.
    `visible` = the camera ids the caller may see (None = all). Names, states and numbers only."""
    now_ts = now_ts or _now_ts()
    th = load(conn)
    refs = references(conn)
    excluded = set(th[EXCLUDED_KEY])
    with _LOCK:
        states = dict(STORE)
    cams = []
    counts = {"ok": 0, "warn": 0, "unknown": 0, "excluded": 0, "off": 0, **{k: 0 for k in KINDS}}
    for r in _cameras(conn):
        cid = str(r["id"])
        if visible is not None and cid not in visible:
            continue
        st = states.get(cid)
        issues: list[str] = []
        if not th["enabled"]:
            state = "off"
        elif cid in excluded:
            state = "excluded"
        elif st is None or not fresh(st, th["interval_s"], now_ts):
            state = "unknown"
        else:
            issues = [k for k in KINDS if k in st.active]
            state = "warn" if issues else "ok"
        counts[state] += 1
        for k in issues:
            counts[k] += 1
        cams.append({"id": cid, "name": _name(r), "state": state, "issues": issues, "texts": [KIND_TEXT[k] for k in issues],
                     "sampled_at": _iso(st.ok_at) if st else None, "attempted_at": _iso(st.sampled_at) if st else None,
                     "source": st.source if st else None, "error": st.error if st else None,
                     "error_text": ERROR_TEXT.get(st.error or "", "לא נבדק") if st and st.error else None,
                     "metrics": dict(st.metrics) if st and th["enabled"] else {},
                     "reference": refs.get(cid)})
    return {"enabled": th["enabled"], "interval_s": th["interval_s"], "checked_at": _iso(_PASS["at"]), "counts": counts, "cameras": cams}


def camera_choices(conn: sqlite3.Connection) -> list[dict[str, str]]:
    return [{"id": str(r["id"]), "name": _name(r), "recorder_id": str(r["recorder_id"])} for r in _cameras(conn)]
