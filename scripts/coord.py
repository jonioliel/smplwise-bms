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

Commands: status, ping, claim-master, heartbeat, handoff, claim-task, finish-task.
Never write secrets, lab addresses or credentials into this branch.
"""
from __future__ import annotations

import argparse
import json
import os
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


def _default_remote(repo_root: Path) -> str:
    return _git(repo_root, "remote", "get-url", "origin").stdout.strip()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("command", choices=["status", "ping", "claim-master", "heartbeat",
                                       "handoff", "claim-task", "finish-task"])
    p.add_argument("--id", default=os.environ.get("COORD_SESSION"), help="session name, e.g. pc1-main")
    p.add_argument("--quota", type=int, help="remaining plan quota, percent 0-100")
    p.add_argument("--task", help="task id for claim-task / finish-task")
    p.add_argument("--file", type=Path, help="handoff markdown for the handoff command")
    p.add_argument("--cloud", action="store_true", help="this session has no access to the lab")
    p.add_argument("--force", action="store_true", help="claim-master even if a fresher candidate has more quota")
    args = p.parse_args(argv)

    repo_root = Path(__file__).resolve().parents[1]
    remote = os.environ.get("COORD_REMOTE") or _default_remote(repo_root)
    workdir = Path(os.environ.get("COORD_DIR") or
                   (repo_root / ".git" / "coord-state" if (repo_root / ".git").is_dir()
                    else Path.home() / ".smplwise-coord"))
    coord = Coord(remote, workdir)

    need_id = args.command != "status"
    if need_id and not args.id:
        p.error("--id (or COORD_SESSION) is required")
    if args.command in ("ping", "claim-master", "heartbeat") and args.quota is None:
        p.error("--quota is required")
    if args.command in ("claim-task", "finish-task") and not args.task:
        p.error("--task is required")
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
    except Refused as exc:
        print(f"REFUSED: {exc}", file=sys.stderr)
        return EXIT_REFUSED
    except LostRace as exc:
        print(f"LOST RACE: {exc}; re-run to re-evaluate", file=sys.stderr)
        return EXIT_LOST_RACE
    return 0


if __name__ == "__main__":
    sys.exit(main())
