"""Small, dependency-free file helpers of the supervised soak tools (mask_soak.py): an atomic heartbeat that survives a full
disk, a tolerant heartbeat reader, a free-space pre-check and a crash-reason formatter. Nothing here talks to a device.

Lesson of 2026-10-21: the runner disk filled, the sampler died in `heartbeat.write_text()` with ENOSPC, and the guard read the
heartbeat as 0 (an "age" of 1.79 billion seconds) before it undid the mask. These helpers fix the three links of that chain.
"""
from __future__ import annotations

import os
import re
import shutil
import time
from pathlib import Path
from typing import Callable

MIN_FREE_BYTES = 1024 ** 3  # the sampler refuses to start with less than 1 GiB free on its volume
MAX_FUTURE_S = 300  # a heartbeat further in the future than this is a clock fault, i.e. unreadable

Logger = Callable[..., None]  # logger(kind, **fields)


def write_heartbeat(path: Path, log: Logger | None = None, now: float | None = None) -> bool:
    """Write the heartbeat atomically: a temp file in the same directory, then os.replace. A full disk (or any OSError) is logged
    and tolerated: returns False and leaves the previous heartbeat file untouched, never raises."""
    path = Path(path)
    tmp = Path(str(path) + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(str(int(time.time() if now is None else now)))
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
        return True
    except OSError as exc:
        try:
            if log:
                log("heartbeat_write_failed", errno=getattr(exc, "errno", None), error=type(exc).__name__)
        except Exception:  # noqa: BLE001 - logging may fail on the same full disk
            pass
        try:
            tmp.unlink()
        except OSError:
            pass
        return False


def read_heartbeat(path: Path, now: float | None = None) -> tuple[int | None, str]:
    """(epoch seconds, "") when the heartbeat is a sane positive integer; (None, reason) when it is missing, empty, unreadable,
    not a number, not positive or in the future. Unreadable is NOT zero: callers must not turn it into an enormous age."""
    t = time.time() if now is None else now
    try:
        text = Path(path).read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return None, "missing"
    except (OSError, UnicodeError):
        return None, "unreadable"
    if not text:
        return None, "empty"
    try:
        value = int(text)
    except ValueError:
        return None, "not_a_number"
    if value <= 0:
        return None, "not_positive"
    if value > t + MAX_FUTURE_S:
        return None, "in_the_future"
    return value, ""


def heartbeat_age(path: Path, fallback_epoch: float, now: float | None = None) -> tuple[float, str, str]:
    """(age in seconds, basis, unreadable reason). A readable heartbeat gives its own age. An unreadable one falls back to the
    file's mtime when the file exists, else to `fallback_epoch` (the time of the mask write), so the guard still undoes when
    nothing proves the sampler is alive, but on an honest age and with the reason recorded."""
    t = time.time() if now is None else now
    beat, why = read_heartbeat(path, t)
    if beat is not None:
        return max(0.0, t - beat), "heartbeat", ""
    try:
        return max(0.0, t - Path(path).stat().st_mtime), "file_mtime", why
    except OSError:
        return max(0.0, t - fallback_epoch), "mask_write_time", why


def free_bytes(path: Path) -> int:
    """Free bytes on the volume that holds `path` (or its nearest existing parent)."""
    p = Path(path)
    while not p.exists() and p != p.parent:
        p = p.parent
    return shutil.disk_usage(p).free


def check_free_space(path: Path, minimum: int = MIN_FREE_BYTES) -> tuple[bool, int]:
    """(enough, free bytes). An unreadable volume counts as NOT enough (fail closed: do not start a 24 h run blind)."""
    try:
        free = free_bytes(path)
    except OSError:
        return False, -1
    return free >= minimum, free


_IPV4 = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")
_URL = re.compile(r"https?://\S+")


def crash_reason(exc: BaseException) -> dict:
    """A log-safe description of a crash: class, errno, and a short message with addresses and URLs removed."""
    msg = _URL.sub("<url>", _IPV4.sub("<ip>", str(exc)))[:160]
    out: dict = {"error": type(exc).__name__, "reason": msg}
    if isinstance(exc, OSError) and exc.errno is not None:
        out["errno"] = exc.errno
        out["no_space"] = exc.errno == 28
    tb = exc.__traceback__
    while tb is not None and tb.tb_next is not None:
        tb = tb.tb_next
    if tb is not None:
        out["where"] = f"{Path(tb.tb_frame.f_code.co_filename).name}:{tb.tb_lineno}"
    return out
