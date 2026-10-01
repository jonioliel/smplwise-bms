#!/usr/bin/env python3
"""Multi-session coordination for several Claude Code sessions (stdlib only).

Shared state lives on the git branch ``coord/state`` of the project remote, so
sessions on different machines (and cloud sessions) see the same lease. The
lease is taken with a non-force ``git push``: if two sessions race, one push is
rejected and that session lost.

State files on the branch:
  lease.json   - current master, last heartbeat, reported quota, candidates
  claims.json  - task id -> session id (side tasks claimed by sub-developers)
  HANDOFF.md   - written by the master when it releases the lease
  assignments/ - one JSON per assignment (two-way inbox, any session -> any session)

Commands: status, ping, claim-master, heartbeat, handoff, claim-task, finish-task,
          assign, inbox, accept, done, report.
Never write secrets, lab addresses or credentials into this branch.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

BRANCH = "coord/state"
TTL_SECONDS = 30 * 60
LOW_QUOTA_PERCENT = 10
EXIT_LOST_RACE = 2
EXIT_LOW_QUOTA = 3
EXIT_REFUSED = 4

INITIAL_HANDOFF = "# Handoff\n\nNo handoff written yet.\n"

ASSIGN_DIR = "assignments"
MAX_TEXT = 20000
PRIORITIES = ("low", "normal", "high")
_SECRET_PATTERNS = [
    ("IPv4 address", re.compile(r"(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])")),
    ("MAC address", re.compile(r"\b[0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5}\b")),
    ("long token/hash", re.compile(r"\b[A-Za-z0-9+/_-]{32,}\b")),
    ("credential assignment", re.compile(r"(?i)\b(?:password|passwd|secret|token|api[_-]?key|bearer)\b\s*[:=]\s*\S+")),
    ("serial number", re.compile(r"(?i)\b(?:serial(?:\s*(?:no|number))?|s/n|sn)\b\s*[:=#]\s*\S+")),
    ("credentials in URL", re.compile(r"(?i)\b[a-z][a-z0-9+.-]*://[^\s/@]+:[^\s/@]+@")),
]


def validate_no_secrets(text: str, what: str = "text") -> None:
    """Refuse obvious secrets/lab identifiers: IPs, MACs, serials, tokens, credentials."""
    for label, pattern in _SECRET_PATTERNS:
        if pattern.search(text):
            raise Refused(f"{what} looks like it contains a {label}; redact it "
                          "(secrets, lab addresses, serials and MACs never go on the coord branch)")


class Refused(Exception):
    """The requested operation is not allowed in the current state."""


class LostRace(Exception):
    """The push was rejected because another session changed the state first."""


def _git(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args], cwd=cwd, check=check, capture_output=True, text=True,
        encoding="utf-8",
    )


class Coord:
    def __init__(self, remote: str, workdir: Path, now=time.time):
        self.remote = remote
        self.dir = workdir
        self.now = now

    # -- repository plumbing -------------------------------------------------
    def sync(self) -> None:
        if not (self.dir / ".git").exists():
            self.dir.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["git", "clone", "--quiet", "--no-checkout", self.remote, str(self.dir)],
                           check=True, capture_output=True, text=True)
        else:
            _git(self.dir, "fetch", "--quiet", "origin")
        # One call: switch to the remote state, or fail when the branch does not exist yet.
        reset = _git(self.dir, "checkout", "--quiet", "-f", "-B", BRANCH, f"origin/{BRANCH}", check=False)
        if reset.returncode != 0:
            _git(self.dir, "checkout", "--quiet", "--orphan", BRANCH)
            _git(self.dir, "rm", "-rf", "--quiet", "--cached", ".", check=False)
            self._write_json("lease.json", {"master": None, "heartbeat": 0, "quota": None,
                                            "released": True, "candidates": {}})
            self._write_json("claims.json", {})
            (self.dir / "HANDOFF.md").write_text(INITIAL_HANDOFF, encoding="utf-8")
            self._commit_push("coord: initialise state branch")

    def _commit_push(self, message: str) -> None:
        identity = ["-c", f"user.name={os.environ.get('COORD_GIT_NAME', 'coord')}",
                    "-c", f"user.email={os.environ.get('COORD_GIT_EMAIL', 'coord@localhost')}"]
        _git(self.dir, "add", "-A")
        committed = _git(self.dir, *identity, "commit", "--quiet", "-m", message, check=False)
        if committed.returncode != 0:
            return  # nothing to commit
        pushed = _git(self.dir, "push", "--quiet", "origin", BRANCH, check=False)
        if pushed.returncode != 0:
            raise LostRace(pushed.stderr.strip() or "push rejected")

    def _read_json(self, name: str) -> dict:
        return json.loads((self.dir / name).read_text(encoding="utf-8"))

    def _write_json(self, name: str, data: dict) -> None:
        (self.dir / name).write_text(json.dumps(data, indent=2, sort_keys=True) + "\n",
                                     encoding="utf-8")

    # -- lease helpers -------------------------------------------------------
    def _vacant(self, lease: dict) -> bool:
        if lease.get("master") is None or lease.get("released"):
            return True
        return self.now() - lease.get("heartbeat", 0) > TTL_SECONDS

    def _fresh_candidates(self, lease: dict, exclude: str) -> dict:
        return {sid: c for sid, c in lease.get("candidates", {}).items()
                if sid != exclude and self.now() - c["ts"] <= TTL_SECONDS}

    # -- commands ------------------------------------------------------------
    def status(self) -> dict:
        self.sync()
        lease = self._read_json("lease.json")
        age = int(self.now() - lease.get("heartbeat", 0)) if lease.get("heartbeat") else None
        return {"lease": lease, "claims": self._read_json("claims.json"),
                "vacant": self._vacant(lease), "heartbeat_age_seconds": age}

    def ping(self, sid: str, quota: int) -> None:
        """A non-master session announces it is alive and how much quota it has."""
        self.sync()
        lease = self._read_json("lease.json")
        lease.setdefault("candidates", {})[sid] = {"quota": quota, "ts": int(self.now())}
        self._write_json("lease.json", lease)
        self._commit_push(f"coord: ping {sid}")

    def claim_master(self, sid: str, quota: int, force: bool = False) -> None:
        self.sync()
        lease = self._read_json("lease.json")
        if lease.get("master") == sid:
            pass
        elif not self._vacant(lease):
            raise Refused(f"{lease['master']} is the live master")
        elif not force:
            better = {s: c for s, c in self._fresh_candidates(lease, sid).items()
                      if c["quota"] > quota}
            if better:
                best = max(better, key=lambda s: better[s]["quota"])
                raise Refused(f"{best} reports more quota ({better[best]['quota']}% > {quota}%) "
                              "and should take the lease; use --force to override")
        lease.update(master=sid, heartbeat=int(self.now()), quota=quota, released=False)
        lease.get("candidates", {}).pop(sid, None)
        self._write_json("lease.json", lease)
        self._commit_push(f"coord: {sid} claims master")

    def heartbeat(self, sid: str, quota: int) -> bool:
        """Returns True when the master must now write a handoff (quota is low)."""
        self.sync()
        lease = self._read_json("lease.json")
        if lease.get("master") != sid or lease.get("released"):
            raise Refused(f"{sid} is not the master")
        lease.update(heartbeat=int(self.now()), quota=quota)
        self._write_json("lease.json", lease)
        self._commit_push(f"coord: heartbeat {sid}")
        return quota < LOW_QUOTA_PERCENT

    def handoff(self, sid: str, handoff_file: Path) -> None:
        self.sync()
        lease = self._read_json("lease.json")
        if lease.get("master") != sid:
            raise Refused(f"{sid} is not the master")
        (self.dir / "HANDOFF.md").write_text(handoff_file.read_text(encoding="utf-8"),
                                             encoding="utf-8")
        lease.update(master=None, released=True, heartbeat=int(self.now()))
        self._write_json("lease.json", lease)
        self._commit_push(f"coord: {sid} releases master with handoff")

    def claim_task(self, sid: str, task: str, needs_lab: bool = False, cloud: bool = False) -> None:
        if needs_lab and cloud:
            raise Refused(f"{task} needs the lab; a cloud session cannot take it")
        self.sync()
        claims = self._read_json("claims.json")
        owner = claims.get(task)
        if owner and owner != sid:
            raise Refused(f"{task} is already claimed by {owner}")
        claims[task] = sid
        self._write_json("claims.json", claims)
        self._commit_push(f"coord: {sid} claims {task}")

    def finish_task(self, sid: str, task: str) -> None:
        self.sync()
        claims = self._read_json("claims.json")
        if claims.get(task) != sid:
            raise Refused(f"{task} is not claimed by {sid}")
        del claims[task]
        self._write_json("claims.json", claims)
        self._commit_push(f"coord: {sid} finishes {task}")

    # -- two-way task inbox --------------------------------------------------
    def _assignment_path(self, ref: str) -> Path:
        return self.dir / ASSIGN_DIR / f"{ref}.json"

    def _load_assignment(self, ref: str) -> dict:
        path = self._assignment_path(ref)
        if not re.fullmatch(r"A\d{4,}", ref) or not path.exists():
            raise Refused(f"no assignment {ref}")
        return json.loads(path.read_text(encoding="utf-8"))

    def _save_assignment(self, rec: dict) -> None:
        (self.dir / ASSIGN_DIR).mkdir(exist_ok=True)
        self._write_json(f"{ASSIGN_DIR}/{rec['id']}.json", rec)

    def _all_assignments(self) -> list[dict]:
        folder = self.dir / ASSIGN_DIR
        if not folder.is_dir():
            return []
        return sorted((json.loads(f.read_text(encoding="utf-8")) for f in folder.glob("*.json")),
                      key=lambda r: r["id"])

    def assign(self, sender: str, to: str, task: str | None = None, text: str = "",
               branch: str | None = None, priority: str = "normal") -> str:
        """Any session may hand work to any other session (the master or a sub-developer).

        ``to`` may be the literal ``master`` to address whoever holds the lease now."""
        if priority not in PRIORITIES:
            raise Refused(f"priority must be one of {PRIORITIES}")
        if not task and not text.strip():
            raise Refused("an assignment needs a task id and/or a task text")
        for what, value in (("task", task or ""), ("text", text), ("branch", branch or "")):
            if len(value) > MAX_TEXT:
                raise Refused(f"{what} is too long")
            validate_no_secrets(value, what)
        self.sync()
        if to == "master":
            lease = self._read_json("lease.json")
            if self._vacant(lease):
                raise Refused("there is no live master to address; use the master's session name")
            to = lease["master"]
        if to == sender:
            raise Refused("cannot assign to yourself")
        ids = [int(r["id"][1:]) for r in self._all_assignments()]
        ref = f"A{(max(ids) + 1) if ids else 1:04d}"
        self._save_assignment({"id": ref, "from": sender, "to": to, "task": task, "text": text,
                               "branch": branch, "priority": priority, "status": "pending",
                               "created": int(self.now()), "accepted": None, "done": None,
                               "report": None})
        self._commit_push(f"coord: {sender} assigns {ref} to {to}")
        return ref

    def inbox(self, sid: str) -> list[dict]:
        self.sync()
        order = {"high": 0, "normal": 1, "low": 2}
        mine = [r for r in self._all_assignments()
                if r["to"] == sid and r["status"] in ("pending", "accepted")]
        return sorted(mine, key=lambda r: (order[r["priority"]], r["id"]))

    def _resolve_ref(self, sid: str, ref: str | None, statuses: tuple[str, ...]) -> str:
        if ref:
            return ref
        open_ = [r["id"] for r in self._all_assignments()
                 if r["to"] == sid and r["status"] in statuses]
        if len(open_) != 1:
            raise Refused(f"--ref required ({len(open_)} candidate assignments: {open_})")
        return open_[0]

    def accept(self, sid: str, ref: str | None = None) -> dict:
        self.sync()
        rec = self._load_assignment(self._resolve_ref(sid, ref, ("pending",)))
        if rec["to"] != sid:
            raise Refused(f"{rec['id']} is addressed to {rec['to']}, not {sid}")
        if rec["status"] != "pending":
            raise Refused(f"{rec['id']} is already {rec['status']}")
        task = rec.get("task")
        if task and re.fullmatch(r"T\d+\w*", task):
            claims = self._read_json("claims.json")
            owner = claims.get(task)
            if owner and owner != sid:
                raise Refused(f"{task} is already claimed by {owner}")
            claims[task] = sid
            self._write_json("claims.json", claims)
        rec.update(status="accepted", accepted=int(self.now()))
        self._save_assignment(rec)
        self._commit_push(f"coord: {sid} accepts {rec['id']}")
        return rec

    def done(self, sid: str, report: str, ref: str | None = None) -> dict:
        validate_no_secrets(report, "report")
        if len(report) > MAX_TEXT:
            raise Refused("report is too long; keep it to the closing-report format")
        self.sync()
        rec = self._load_assignment(self._resolve_ref(sid, ref, ("accepted", "pending")))
        if rec["to"] != sid:
            raise Refused(f"{rec['id']} is addressed to {rec['to']}, not {sid}")
        if rec["status"] == "done":
            raise Refused(f"{rec['id']} is already done")
        claims = self._read_json("claims.json")
        if rec.get("task") and claims.get(rec["task"]) == sid:
            del claims[rec["task"]]
            self._write_json("claims.json", claims)
        rec.update(status="done", done=int(self.now()), report=report)
        self._save_assignment(rec)
        self._commit_push(f"coord: {sid} completes {rec['id']}")
        return rec

    def report(self) -> list[dict]:
        self.sync()
        return self._all_assignments()


def _task_needs_lab(repo_root: Path, task: str) -> bool:
    path = repo_root / "management" / "tasks.json"
    if not path.exists():
        return False
    data = json.loads(path.read_text(encoding="utf-8"))
    tasks = data["tasks"] if isinstance(data, dict) and "tasks" in data else data
    for item in tasks:
        if isinstance(item, dict) and item.get("id") == task:
            return bool(item.get("requires_hardware"))
    return False


def _format(r: dict) -> str:
    what = r.get("task") or (r.get("text") or "").strip().split("\n")[0][:60]
    branch = f" branch={r['branch']}" if r.get("branch") else ""
    return f"{r['id']} [{r['status']}] {r['from']} -> {r['to']} ({r['priority']}) {what}{branch}"


def _default_remote(repo_root: Path) -> str:
    return _git(repo_root, "remote", "get-url", "origin").stdout.strip()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("command", choices=["status", "ping", "claim-master", "heartbeat",
                                       "handoff", "claim-task", "finish-task",
                                       "assign", "inbox", "accept", "done", "report"])
    p.add_argument("--id", default=os.environ.get("COORD_SESSION"), help="session name, e.g. pc1-main")
    p.add_argument("--quota", type=int, help="remaining plan quota, percent 0-100")
    p.add_argument("--task", help="task id for claim-task / finish-task")
    p.add_argument("--file", type=Path, help="handoff markdown for the handoff command")
    p.add_argument("--to", help="assign: target session name, or 'master' for the current master")
    p.add_argument("--branch", help="assign: branch the assignee should work on / push")
    p.add_argument("--priority", default="normal", choices=PRIORITIES)
    p.add_argument("--ref", help="assignment id (A0001) for accept / done")
    p.add_argument("--report", type=Path, help="done: closing report markdown file")
    p.add_argument("--cloud", action="store_true", help="this session has no access to the lab")
    p.add_argument("--force", action="store_true", help="claim-master even if a fresher candidate has more quota")
    args = p.parse_args(argv)

    repo_root = Path(__file__).resolve().parents[1]
    remote = os.environ.get("COORD_REMOTE") or _default_remote(repo_root)
    workdir = Path(os.environ.get("COORD_DIR") or
                   (repo_root / ".git" / "coord-state" if (repo_root / ".git").is_dir()
                    else Path.home() / ".smplwise-coord"))
    coord = Coord(remote, workdir)

    need_id = args.command not in ("status", "report")
    if need_id and not args.id:
        p.error("--id (or COORD_SESSION) is required")
    if args.command in ("ping", "claim-master", "heartbeat") and args.quota is None:
        p.error("--quota is required")
    if args.command in ("claim-task", "finish-task") and not args.task:
        p.error("--task is required")
    if args.command == "assign" and (not args.to or not args.task):
        p.error("--to and --task are required")
    if args.command == "done" and not args.report:
        p.error("--report is required")
    if args.command == "handoff" and not args.file:
        p.error("--file is required")

    try:
        if args.command == "status":
            print(json.dumps(coord.status(), indent=2, sort_keys=True))
        elif args.command == "ping":
            coord.ping(args.id, args.quota)
        elif args.command == "claim-master":
            coord.claim_master(args.id, args.quota, args.force)
            print(f"{args.id} is now master. Read HANDOFF.md on the {BRANCH} branch "
                  f"({workdir / 'HANDOFF.md'}).")
        elif args.command == "heartbeat":
            if coord.heartbeat(args.id, args.quota):
                print(f"LOW QUOTA (<{LOW_QUOTA_PERCENT}%): write a handoff and run "
                      "'handoff' now.", file=sys.stderr)
                return EXIT_LOW_QUOTA
        elif args.command == "handoff":
            coord.handoff(args.id, args.file)
        elif args.command == "claim-task":
            coord.claim_task(args.id, args.task, _task_needs_lab(repo_root, args.task), args.cloud)
        elif args.command == "finish-task":
            coord.finish_task(args.id, args.task)
        elif args.command == "assign":
            task, text = args.task, ""
            if Path(args.task).is_file():  # free-text task card in a file
                task, text = None, Path(args.task).read_text(encoding="utf-8")
            ref = coord.assign(args.id, args.to, task, text, args.branch, args.priority)
            print(f"assigned {ref} to {args.to}")
        elif args.command == "inbox":
            records = coord.inbox(args.id)
            for r in records:
                print(_format(r))
                if r.get("text"):
                    print("    " + r["text"].strip().replace("\n", "\n    "))
            if not records:
                print("(inbox empty)")
        elif args.command == "accept":
            print(f"accepted {coord.accept(args.id, args.ref)['id']}")
        elif args.command == "done":
            rec = coord.done(args.id, args.report.read_text(encoding="utf-8"), args.ref)
            print(f"completed {rec['id']}")
        elif args.command == "report":
            print("\n".join(_format(r) for r in coord.report()) or "(no assignments)")
    except Refused as exc:
        print(f"REFUSED: {exc}", file=sys.stderr)
        return EXIT_REFUSED
    except LostRace as exc:
        print(f"LOST RACE: {exc}; re-run to re-evaluate", file=sys.stderr)
        return EXIT_LOST_RACE
    return 0


if __name__ == "__main__":
    sys.exit(main())
