#!/usr/bin/env python3
"""Who holds the machine (GATE-FAST-2291, item 8). A small file ~/.smplwise-machine-holder.json says who runs what on the test machine
since when; while a RELEASE GATE holds it, agent test runs are refused with a Hebrew message. Agents that bypass the wrapper are not
stopped (nothing can stop a raw command): the written rule for agents stays, this is the polite, automatic part.

  gate_holder.py claim --kind gate|agent --who "<name>" --what "<what runs>" [--pid N]   write the file (the gate wrappers do this)
  gate_holder.py release [--pid N]                                                         remove it (only if it is ours when --pid given)
  gate_holder.py guard [--who "<name>"]    exit 0 = free (or only agents), exit 75 = a gate holds the machine (Hebrew message on stdout)
  gate_holder.py show                      print the holder, if any

Agent wrapper:  gate_holder.py guard --who "<agent>" && <the test command>     (see run_guarded.sh)
The gate lock itself (~/.smplwise-gate.lock, flock) is also checked when the holder file is missing or stale (POSIX only).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

HOLDER = Path(os.environ.get("GATE_HOLDER_FILE") or Path.home() / ".smplwise-machine-holder.json")
GATE_LOCK = Path(os.environ.get("GATE_LOCK_FILE") or Path.home() / ".smplwise-gate.lock")
BUSY = 75


def pid_alive(pid: int) -> bool:
    if not pid or pid <= 0:
        return False
    if os.name == "nt":      # os.kill(pid, 0) would TERMINATE a process on Windows: ask the OS instead
        import ctypes
        h = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if h:
            ctypes.windll.kernel32.CloseHandle(h)
        return bool(h)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def gate_lock_held(path: Path = GATE_LOCK) -> bool:
    try:
        import fcntl
    except ImportError:
        return False
    try:
        with open(path, "a+") as f:
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                return True
            fcntl.flock(f, fcntl.LOCK_UN)
    except OSError:
        return False
    return False


def read_holder(path: Path = HOLDER) -> dict | None:
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return d if isinstance(d, dict) else None


def claim(kind: str, who: str, what: str, pid: int, path: Path = HOLDER) -> dict:
    d = {"kind": kind, "who": who, "what": what, "pid": pid, "since": dt.datetime.now().astimezone().isoformat(timespec="seconds")}
    tmp = Path(f"{path}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)
    return d


def release(pid: int | None = None, path: Path = HOLDER) -> bool:
    h = read_holder(path)
    if h is None or (pid is not None and h.get("pid") != pid):
        return False
    try:
        path.unlink()
    except OSError:
        return False
    return True


def minutes_since(iso: str) -> int | None:
    try:
        return int((dt.datetime.now().astimezone() - dt.datetime.fromisoformat(iso)).total_seconds() // 60)
    except (ValueError, TypeError):
        return None


def guard(who: str = "", path: Path = HOLDER, alive=pid_alive, lock_held=gate_lock_held) -> tuple[int, str]:
    """(0, '') when the machine is free for an agent test run, else (75, Hebrew message)."""
    h = read_holder(path)
    if h and h.get("kind") == "gate" and alive(int(h.get("pid") or 0)):
        m = minutes_since(h.get("since", ""))
        return BUSY, (f"השער רץ, מי מחזיק את המכונה: {h.get('who', '?')} ({h.get('what', '')}), מאז {h.get('since', '?')}"
                      + (f" (לפני {m} דקות)" if m is not None else "") + ". ריצת בדיקות של סוכן נחסמה כדי לא לעכב את השער. לנסות שוב אחרי שהשער מסתיים.")
    if lock_held():
        return BUSY, "השער רץ (הנעילה ~/.smplwise-gate.lock תפוסה), מי מחזיק את המכונה: לא ידוע (אין קובץ מחזיק). ריצת בדיקות של סוכן נחסמה."
    return 0, ""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["claim", "release", "guard", "show"])
    ap.add_argument("--kind", default="agent", choices=["gate", "agent"])
    ap.add_argument("--who", default="")
    ap.add_argument("--what", default="")
    ap.add_argument("--pid", type=int)
    ns = ap.parse_args(argv)
    if ns.cmd == "claim":
        print(json.dumps(claim(ns.kind, ns.who, ns.what, ns.pid or os.getppid()), ensure_ascii=False))
        return 0
    if ns.cmd == "release":
        release(ns.pid)
        return 0
    if ns.cmd == "show":
        print(json.dumps(read_holder(), ensure_ascii=False, indent=1))
        return 0
    rc, msg = guard(ns.who)
    if msg:
        print(msg)
    return rc


if __name__ == "__main__":
    sys.exit(main())
