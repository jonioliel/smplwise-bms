"""MASKSOAK-295: supervised 24 h soak with ONE privacy mask on the lab NVR (channel 10), runner-side tool.

usage: mask_soak.py <cmd>      cmd = apply | sample | undo [reason] | guard | status
Layout (all under ~/masksoak): lab.env (NVR_* + GO2RTC_*), code/ (branch pilot/NVRMASK-295 backend), data/ (change-record DB),
out/run/ (evidence).  Credentials and the host come only from lab.env and are never printed or logged.

apply : read original (must equal the original recorded 2026-10-20), baseline health, snapshot, ONE write through
        nvr_privacy.write_camera (etag-checked PUT + verify), independent read, snapshot masked, write state + planned undo time.
sample: read-only, every SAMPLE_S s until DURATION_S after the write: mask document hash, picture, memory / uptime, HDD status,
        channel 10 proxy online, record track hashes, go2rtc smplwise_ stream producers.  Any confirmed drift => undo at once.
undo  : idempotent, flock-protected: restore_change (fallback: PUT original + DELETE added regions), then prove the document
        is byte-identical (sha256 of the raw response bytes) to the recorded original.
guard : cron entry point: undo when the hard deadline passed or the sampler heartbeat is stale; self-removes from cron when done.
"""
import csv
import datetime as dt
import fcntl
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HOME = Path(os.environ["HOME"]) / "masksoak"
RUN = HOME / "out" / "run"
CH = 10
SAMPLE_S = 300
DURATION_S = 24 * 3600
UNDO_AT_S = DURATION_S            # planned undo = write + 24 h
HARD_S = 25 * 3600                # the guard undoes at write + 25 h even if the sampler is dead (absolute ceiling 26 h)
HEARTBEAT_STALE_S = 20 * 60
SQUARE = [[0, 576], [70, 576], [70, 518], [0, 518]]  # the same corner block as 2026-10-20 / 2026-10-21
TL_MASKED_MAX = 45.0              # top-left 10 % mean: masked ~19, unmasked ~73-77
sys.path.insert(0, str(HOME / "code" / "smplwise_vms" / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parent))  # soak_guard_io.py lies next to this file
import soak_guard_io as gio  # noqa: E402

import httpx  # noqa: E402
from PIL import Image, ImageStat  # noqa: E402
from smplwise.config import Settings  # noqa: E402
from smplwise.db import Database  # noqa: E402
from smplwise.errors import ApiError  # noqa: E402
from smplwise.rbac import Principal  # noqa: E402
from smplwise.services import nvr, nvr_privacy  # noqa: E402

RUN.mkdir(parents=True, exist_ok=True)
(HOME / "data").mkdir(parents=True, exist_ok=True)
F_STATE, F_BASE, F_EVENTS, F_CSV = RUN / "state.json", RUN / "baseline.json", RUN / "events.jsonl", RUN / "samples.csv"
F_PLAN, F_DONE, F_DRIFT, F_BEAT, F_LOCK = RUN / "PLANNED_UNDO.txt", RUN / "UNDONE", RUN / "DRIFT", RUN / "heartbeat.txt", RUN / "undo.lock"

env = {}
for _l in (HOME / "lab.env").read_text(encoding="utf-8", errors="replace").splitlines():
    _m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", _l)
    if _m:
        env[_m.group(1)] = _m.group(2).strip().strip('"').strip("'")
S = Settings(data_dir=HOME / "data", www_dir=None, in_addon=False, trusted_proxies=(), dev_user=None, bootstrap_admin_username=None,
             nvr_host=env["NVR_HOST"], nvr_http_port=int(env.get("NVR_HTTP_PORT") or 80), nvr_user=env["NVR_USER"], nvr_password=env["NVR_PASSWORD"],
             go2rtc_url=None, log_level="warning", nvr_vendor="hikvision", nvr_extra={}, nvr_rtsp_port=int(env.get("NVR_RTSP_PORT") or 554))
FIXTURE_ORIGINAL = (HOME / "code" / "smplwise_vms" / "backend" / "tests" / "fixtures" / "nvr_privacy_mask" / "original_disabled.xml").read_text(encoding="utf-8")
WHO = Principal(user_id="masksoak", username="masksoak", display_name="MASKSOAK-295 supervised soak", source="dev")


def now():
    return dt.datetime.now(dt.timezone.utc)


def iso(t=None):
    return (t or now()).isoformat(timespec="seconds")


def event(kind, **kw):
    rec = {"at": iso(), "event": kind, **kw}
    try:
        with open(F_EVENTS, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=True) + "\n")
    except OSError as exc:  # a full disk must not kill the run: the line still goes to stdout
        print(f"events.jsonl not written: errno={getattr(exc, 'errno', None)}", file=sys.stderr, flush=True)
    print(json.dumps(rec, ensure_ascii=True)[:400], flush=True)


def jload(p, default=None):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return default


def jsave(p, obj):
    tmp = Path(str(p) + ".tmp")
    tmp.write_text(json.dumps(obj, indent=1, ensure_ascii=True), encoding="utf-8")
    tmp.replace(p)


def put_row(w, f, row):
    """One CSV sample row; a full disk is logged, the sampler goes on."""
    try:
        w.writerow([row.get(k, "") for k in HEAD]); f.flush()
    except OSError as exc:
        event("csv_write_failed", errno=getattr(exc, "errno", None))


def beat():
    """Heartbeat: atomic (temp file + rename) and tolerant of a full disk (logs and continues)."""
    return gio.write_heartbeat(F_BEAT, log=event)


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def norm(x: str) -> str:
    return re.sub(r"\s+", "", x)


def client():
    return nvr._client(S)


def get_doc(c):
    r = c.get(nvr_privacy.mask_path(CH))
    return r.status_code, r.content, r.text


def corners(jpg: bytes):
    im = Image.open(io.BytesIO(jpg)).convert("L")
    w, h = im.size
    bw, bh = w // 10, h // 10
    box = {"tl": (0, 0, bw, bh), "tr": (w - bw, 0, w, bh), "bl": (0, h - bh, bw, h), "br": (w - bw, h - bh, w, h)}
    out = {k: round(ImageStat.Stat(im.crop(v)).mean[0], 1) for k, v in box.items()}
    out["all"] = round(ImageStat.Stat(im).mean[0], 1)
    return out


def snap(c, name=None):
    r = c.get(f"/ISAPI/Streaming/channels/{CH}01/picture")
    if r.status_code != 200 or not r.content.startswith(b"\xff\xd8\xff"):
        raise RuntimeError(f"snapshot_http_{r.status_code}")
    if name:
        (RUN / f"{name}.jpg").write_bytes(r.content)
    return corners(r.content)


def grab(c, path, pattern, cast=str):
    r = c.get(path)
    if r.status_code != 200:
        return None, r
    m = re.search(pattern, r.text, re.S)
    return (cast(m.group(1)) if m else None), r


def health(c):
    """read-only NVR health: memory, uptime, hdd, proxy online, record tracks (hashes only)."""
    h = {}
    r = c.get("/ISAPI/System/status")
    if r.status_code == 200:
        m = re.search(r"<memoryUsage>\s*([\d.]+)", r.text)
        a = re.search(r"<memoryAvailable>\s*([\d.]+)", r.text)
        u = re.search(r"<deviceUpTime>\s*(\d+)", r.text)
        h["mem_used_mb"] = round(float(m.group(1)), 1) if m else None
        h["mem_avail_mb"] = round(float(a.group(1)), 1) if a else None
        h["uptime_s"] = int(u.group(1)) if u else None
    r = c.get("/ISAPI/ContentMgmt/Storage/hdd")
    h["hdd_status"] = (re.findall(r"<status>([^<]*)</status>", r.text) or [None])[0] if r.status_code == 200 else None
    r = c.get("/ISAPI/ContentMgmt/InputProxy/channels/status")
    h["proxy_online"] = None
    if r.status_code == 200:
        for blk in re.findall(r"<InputProxyChannelStatus .*?</InputProxyChannelStatus>", r.text, re.S):
            if re.search(rf"<id>{CH}</id>", blk):
                h["proxy_online"] = (re.findall(r"<online>([^<]*)</online>", blk) or [None])[0]
    for tid in (f"{CH}01", f"{CH}02"):
        r = c.get(f"/ISAPI/ContentMgmt/record/tracks/{tid}")
        h[f"track{tid}_sha"] = sha(r.content)[:12] if r.status_code == 200 else None
    return h


def streams():
    try:
        auth = (env["GO2RTC_API_USER"], env["GO2RTC_API_PASSWORD"]) if env.get("GO2RTC_API_USER") else None
        with httpx.Client(timeout=8) as g:
            d = g.get(env["GO2RTC_URL"].rstrip("/") + "/api/streams", auth=auth).json()
        return {k: len(d.get(f"smplwise_nvr-1_ch{CH}_{k}", {}).get("producers") or []) for k in ("main", "sub")}
    except Exception:  # noqa: BLE001
        return {"main": None, "sub": None}


# ------------------------------------------------------------------ apply
def cmd_apply():
    if F_STATE.exists():
        print("state.json exists - refusing to apply twice")
        sys.exit(4)
    t0 = now()
    with client() as c:
        st, raw, text = get_doc(c)
        if st != 200:
            event("apply_abort", why=f"read_http_{st}")
            sys.exit(2)
        (RUN / f"original_ch{CH}.xml").write_bytes(raw)
        if nvr_privacy.state(text) != nvr_privacy.state(FIXTURE_ORIGINAL) or norm(text) != norm(FIXTURE_ORIGINAL):
            event("precondition", ok=False, verdict="NOT_RUN", why="document differs from the original recorded 2026-10-20")
            sys.exit(3)
        info = nvr_privacy.read_mask(S, CH, client=c)
        h1 = health(c)
        time.sleep(3)
        h2 = health(c)
        tl0 = snap(c, "before_masksoak")
        base = {"recorded_at": iso(t0), "channel": CH, "original_sha256": sha(raw), "original_sha256_lf": sha(raw.replace(b"\r", b"")),
                "original_bytes": len(raw), "etag": info["etag"], "health": h1, "health_stable": {k: h1.get(k) == h2.get(k) for k in h1},
                "snapshot_before": tl0, "streams": streams()}
        jsave(F_BASE, base)
        event("baseline", original_sha12=base["original_sha256"][:12], etag=info["etag"], health=h1, stable_keys=[k for k, v in base["health_stable"].items() if v],
              snapshot_before=tl0, streams=base["streams"])
    db = Database(HOME / "data" / "lab.db")
    db.migrate()
    with db.connection(mode="write") as conn:
        t_w = time.monotonic()
        try:
            rec = nvr_privacy.write_camera(S, conn, WHO, camera_id="lab-channel", channel=CH, enabled=True, regions=[SQUARE], expected_etag=info["etag"])
        except ApiError as exc:
            event("write", ok=False, code=exc.code, details={k: v for k, v in exc.details.items() if k in ("change_id", "restored", "status", "code", "sub")})
            sys.exit(5)
    wrote_at = now()
    event("write", ok=True, change_id=rec["id"], status=rec["status"], fields=rec["fields"])
    with client() as c:  # independent read on a fresh client / Digest session
        st, raw2, text2 = get_doc(c)
        want = nvr_privacy.state(nvr_privacy.document(text, True, [SQUARE]))
        same = st == 200 and nvr_privacy.state(text2) == want
        parsed = nvr.parse_privacy_mask(text2) if st == 200 else {}
        active = parsed.get("active_regions")
        (RUN / f"masked_doc_ch{CH}.xml").write_bytes(raw2)
        event("verify_masked", http=st, matches_request=same, enabled=parsed.get("enabled"), active_regions=active, masked_sha12=sha(raw2)[:12])
        time.sleep(5)
        tlm = snap(c, "masked_first")
        event("snapshot_masked", **tlm)
    ok = same and active == 1 and tlm["tl"] < TL_MASKED_MAX and rec["status"] == "applied"
    state = {"change_id": rec["id"], "write_at": iso(wrote_at), "planned_undo_at": iso(wrote_at + dt.timedelta(seconds=UNDO_AT_S)),
             "guard_hard_undo_at": iso(wrote_at + dt.timedelta(seconds=HARD_S)), "absolute_ceiling_at": iso(wrote_at + dt.timedelta(hours=26)),
             "masked_sha256": sha(raw2), "verify_ok": ok, "status": "masked" if ok else "verify_failed"}
    jsave(F_STATE, state)
    F_PLAN.write_text(f"write_at={state['write_at']}\nplanned_undo_at={state['planned_undo_at']}\nguard_hard_undo_at={state['guard_hard_undo_at']}\n"
                      f"absolute_ceiling_at={state['absolute_ceiling_at']} (the mask is never left beyond 26 h)\n", encoding="utf-8")
    beat()
    event("applied", verify_ok=ok, planned_undo_at=state["planned_undo_at"])
    if not ok:
        event("apply_verify_failed_undoing")
        cmd_undo("apply_verify_failed")
        sys.exit(6)


# ------------------------------------------------------------------ undo
def read_exact():
    with client() as c:
        st, raw, text = get_doc(c)
    return st, raw, text


def cmd_undo(reason="manual"):
    base, state = jload(F_BASE), jload(F_STATE)
    if not base or not state:
        event("undo_abort", why="no baseline/state")
        sys.exit(7)
    lock = open(F_LOCK, "w")
    fcntl.flock(lock, fcntl.LOCK_EX)
    try:
        if F_DONE.exists():
            event("undo_skip", why="already undone")
            return
        original_raw = (RUN / f"original_ch{CH}.xml").read_bytes()
        original = original_raw.decode("utf-8")
        t_w = dt.datetime.fromisoformat(state["write_at"])
        event("undo_start", reason=reason, mask_on_seconds=int((now() - t_w).total_seconds()))
        done_how = None
        for attempt in (1, 2):  # one retry only (also covers a failed login)
            try:
                st, raw, text = read_exact()
                if st == 200 and raw == original_raw:
                    done_how = "already_original"
                    break
                try:
                    db = Database(HOME / "data" / "lab.db")
                    with db.connection(mode="write") as conn:
                        rb = nvr_privacy.restore_change(S, conn, WHO, state["change_id"])
                    done_how = f"restore_change:{rb['status']}"
                except ApiError as exc:
                    event("restore_change_failed", code=exc.code, attempt=attempt)
                    with client() as c:
                        nvr_privacy._put_state(c, CH, original, nvr_privacy.state(original))
                    done_how = "put_state_fallback"
                break
            except Exception as exc:  # noqa: BLE001
                event("undo_attempt_failed", attempt=attempt, error=type(exc).__name__, code=getattr(exc, "code", None))
                if attempt == 1:
                    time.sleep(60)
        st, raw, text = read_exact()
        exact = st == 200 and raw == original_raw
        semantic = st == 200 and nvr_privacy.state(text) == nvr_privacy.state(original)
        if not (exact and semantic):
            event("undo_verify_not_exact", http=st, semantic=semantic, exact=exact)
            try:
                with client() as c:
                    nvr_privacy._put_state(c, CH, original, nvr_privacy.state(original))
                done_how = (done_how or "") + "+safety_net"
            except Exception as exc:  # noqa: BLE001
                event("safety_net_failed", error=type(exc).__name__, code=getattr(exc, "code", None))
            st, raw, text = read_exact()
            exact = st == 200 and raw == original_raw
            semantic = st == 200 and nvr_privacy.state(text) == nvr_privacy.state(original)
        (RUN / f"after_undo_ch{CH}.xml").write_bytes(raw if st == 200 else b"")
        pic = {}
        try:
            time.sleep(15)
            with client() as c:
                pic = snap(c, "after_undo")
        except Exception as exc:  # noqa: BLE001
            pic = {"error": type(exc).__name__}
        res = {"at": iso(), "reason": reason, "how": done_how, "http": st, "document_byte_identical": exact, "semantic_equal": semantic,
               "original_sha256": sha(original_raw), "after_sha256": sha(raw) if st == 200 else None,
               "mask_on_seconds": int((now() - t_w).total_seconds()), "picture_after": pic, "picture_before_baseline": base.get("snapshot_before")}
        jsave(RUN / "undo_result.json", res)
        event("undo_result", **{k: v for k, v in res.items() if k != "at"})
        if semantic:
            state["status"] = "undone" if exact else "undone_semantic_only"
            jsave(F_STATE, state)
            F_DONE.write_text(json.dumps({"exact": exact, "at": iso()}), encoding="utf-8")
        else:
            state["status"] = "UNDO_FAILED"
            jsave(F_STATE, state)
            event("UNDO_FAILED_MANUAL_ATTENTION")
    finally:
        fcntl.flock(lock, fcntl.LOCK_UN)
        lock.close()


# ------------------------------------------------------------------ sample
HEAD = ["at", "n", "http_ms", "doc_ok", "doc_sha12", "master_on", "active_regions", "tl", "tr", "bl", "br", "all", "mem_used_mb", "mem_avail_mb", "uptime_s",
        "hdd_status", "proxy_online", "track1001_sha", "track1002_sha", "g2r_main", "g2r_sub", "flags", "err"]


def evaluate(row, base, state, hist):
    """returns (undo_reasons, alerts) for ONE sample"""
    undo, alerts = [], []
    if row.get("err"):
        return undo, [f"error:{row['err']}"]
    if sha_ne(row, state):
        undo.append("mask_document_changed")
    if row.get("tl") is not None and row["tl"] > TL_MASKED_MAX:
        undo.append("picture_not_masked")
    bh = base["health"]
    stable = base.get("health_stable", {})
    if row.get("hdd_status") is not None and row["hdd_status"] != bh.get("hdd_status"):
        undo.append("hdd_status_changed")
    if row.get("proxy_online") is not None and row["proxy_online"] != bh.get("proxy_online"):
        undo.append("camera_offline_or_changed")
    for k in ("track1001_sha", "track1002_sha"):
        if stable.get(k) and row.get(k) and row[k] != (bh.get(k) or "")[:12]:
            undo.append("recording_track_changed_" + k[:9])
    if row.get("mem_avail_mb") is not None and row["mem_avail_mb"] < 40:
        hist.setdefault("lowmem", 0)
        hist["lowmem"] += 1
        if hist["lowmem"] >= 2:
            undo.append("nvr_memory_low")
    else:
        hist["lowmem"] = 0
    if row.get("uptime_s") is not None and hist.get("last_uptime") is not None and row["uptime_s"] < hist["last_uptime"]:
        alerts.append("nvr_rebooted")
    if row.get("uptime_s") is not None:
        hist["last_uptime"] = row["uptime_s"]
    if row.get("g2r_main") == 0 and row.get("g2r_sub") == 0:
        hist["nostream"] = hist.get("nostream", 0) + 1
        alerts.append("go2rtc_ch10_no_producers")
        if hist["nostream"] >= 6:
            undo.append("streams_down_30min")
    else:
        hist["nostream"] = 0
    return undo, alerts


def sha_ne(row, state):
    return row.get("doc_sha12") is not None and row["doc_sha12"] != state["masked_sha256"][:12]


def one_sample(n):
    row = {"at": iso(), "n": n}
    t0 = time.time()
    try:
        with client() as c:
            st, raw, text = get_doc(c)
            row["doc_sha12"] = sha(raw)[:12] if st == 200 else None
            row["doc_ok"] = int(st == 200)
            if st == 200:
                p = nvr.parse_privacy_mask(text)
                row["master_on"], row["active_regions"] = int(bool(p["enabled"])), p["active_regions"]
            elif st == 401:
                row["err"] = "http_401"
                return row
            row.update(snap(c))
            row.update(health(c))
    except Exception as exc:  # noqa: BLE001
        row["err"] = type(exc).__name__ + (f"_{exc.code}" if getattr(exc, "code", None) else "")
    row["http_ms"] = int((time.time() - t0) * 1000)
    g = streams()
    row["g2r_main"], row["g2r_sub"] = g["main"], g["sub"]
    return row


def cmd_sample():
    ok, free = gio.check_free_space(RUN, gio.MIN_FREE_BYTES)
    if not ok:
        event("sampler_refused_start", why="low_disk", free_mb=(free // (1024 * 1024)) if free >= 0 else None,
              need_mb=gio.MIN_FREE_BYTES // (1024 * 1024))
        sys.exit(9)
    try:
        _sample_loop()
    except SystemExit:
        raise
    except BaseException as exc:  # noqa: BLE001 - say why the sampler died; the guard undoes the mask when the heartbeat goes stale
        event("sampler_crash", **gio.crash_reason(exc))
        raise


def _sample_loop():
    base, state = jload(F_BASE), jload(F_STATE)
    if not base or not state or state["status"] != "masked":
        print("not in masked state")
        sys.exit(8)
    t_w = dt.datetime.fromisoformat(state["write_at"])
    t_end = t_w + dt.timedelta(seconds=UNDO_AT_S)
    hist = {}
    fails = 0
    new = not F_CSV.exists()
    f = open(F_CSV, "a", newline="", encoding="utf-8")
    w = csv.writer(f)
    if new:
        w.writerow(HEAD)
    n = 0
    event("sampler_start", planned_undo_at=state["planned_undo_at"], interval_s=SAMPLE_S)
    while True:
        if F_DONE.exists():
            break
        tick = t_w + dt.timedelta(seconds=SAMPLE_S * n)
        if tick > t_end:
            break
        wait = (tick - now()).total_seconds()
        while wait > 0 and not F_DONE.exists():
            beat()
            time.sleep(min(wait, 60))
            wait = (tick - now()).total_seconds()
        beat()
        row = one_sample(n)
        undo, alerts = evaluate(row, base, state, hist)
        if undo:  # confirm once after 20 s, then act immediately
            event("drift_suspected", reasons=undo, row={k: v for k, v in row.items() if v is not None})
            time.sleep(20)
            row2 = one_sample(n)
            undo2, _ = evaluate(row2, base, state, dict(hist))
            confirmed = [r for r in undo if r in undo2] if not row2.get("err") else []
            if confirmed:
                row["flags"] = "DRIFT:" + ",".join(confirmed)
                put_row(w, f, row)
                F_DRIFT.write_text(json.dumps({"at": iso(), "reasons": confirmed}), encoding="utf-8")
                event("DRIFT_CONFIRMED", reasons=confirmed)
                cmd_undo("drift:" + ",".join(confirmed))
                break
            event("drift_not_confirmed", reasons=undo, second_read_err=row2.get("err"))
            alerts.append("unconfirmed:" + ",".join(undo))
        if alerts:
            row["flags"] = ";".join(alerts)
        put_row(w, f, row)
        fails = fails + 1 if row.get("err") else 0
        if fails == 2 and row.get("err") == "http_401":
            event("AUTH_GUARD", note="2 consecutive 401 - backing off 15 min, single attempts only")
            time.sleep(900)
        elif fails in (6, 24):
            event("NVR_UNREACHABLE_ALERT", consecutive=fails, last_err=row.get("err"))
        n += 1
    f.close()
    if not F_DONE.exists():
        cmd_undo("planned_end_24h")
    time.sleep(60)  # one read-only post-undo sample
    row = one_sample(n)
    row["flags"] = "post_undo"
    try:
        with open(F_CSV, "a", newline="", encoding="utf-8") as f2:
            csv.writer(f2).writerow([row.get(k, "") for k in HEAD])
    except OSError as exc:
        event("csv_write_failed", errno=getattr(exc, "errno", None))
    event("sampler_end", post_undo_doc_sha12=row.get("doc_sha12"), post_undo_tl=row.get("tl"), samples=n)


def cmd_guard():
    state = jload(F_STATE)
    if not state or F_DONE.exists():
        subprocess.run("crontab -l 2>/dev/null | grep -v MASKSOAK_GUARD | crontab -", shell=True)
        return
    t_w = dt.datetime.fromisoformat(state["write_at"])
    age = (now() - t_w).total_seconds()
    stale, basis, unreadable = gio.heartbeat_age(F_BEAT, t_w.timestamp())
    if unreadable:  # empty / missing / garbled file: not a 50-year-old heartbeat, so record why and use an honest age
        event("guard_heartbeat_unreadable", why=unreadable, age_basis=basis, age_s=int(stale))
    if age > HARD_S:
        event("guard_undo", why="hard_deadline", age_s=int(age))
        cmd_undo("guard_hard_deadline")
    elif stale > HEARTBEAT_STALE_S and age > 120:
        event("guard_undo", why="sampler_heartbeat_stale", stale_s=int(stale), basis=basis)
        cmd_undo("guard_sampler_dead")


def cmd_status():
    print(json.dumps({"state": jload(F_STATE), "done": F_DONE.exists(), "drift": F_DRIFT.exists()}, indent=1))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    {"apply": cmd_apply, "sample": cmd_sample, "undo": lambda: cmd_undo(sys.argv[2] if len(sys.argv) > 2 else "manual"), "guard": cmd_guard,
     "status": cmd_status}[cmd]()
