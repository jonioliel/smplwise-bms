"""The isolated git runner of the importer (M5 of Arx's intake reply: "restore from the bundle file only - no remote, no network,
no partial clone, alternates or promisor; then `git fsck --full`").

How the isolation is built (every command, no exception):
* a fresh throwaway directory under the importer's own work root (never inside the exchange folder, never a user checkout);
  `git init --bare` with an EMPTY template directory (no sample hooks), object format sha1;
* the bundle is never cloned or fetched: `git bundle unbundle` writes its objects into the empty repository and the refs are set
  with `update-ref`, so no remote is ever configured and no transport is ever used;
* environment: `child_env.minimal_env` (no Supervisor token, no secret) plus HOME inside the sandbox, an empty global config file,
  no system config, no terminal prompt, GIT_ALLOW_PROTOCOL empty (every transport refused), no replace objects, no lazy fetch;
* command line: `protocol.allow=never`, `core.hooksPath` pointing at an empty directory, fsmonitor off, automatic gc and maintenance
  off, and always an explicit `--git-dir` (no repository discovery from the working directory);
* nothing is checked out: blobs are read as bytes with `cat-file --batch`, so no filter, smudge or attribute driver ever runs.

Output that goes into a report passes through `sanitize()` so no absolute path (and no user name in it) leaves the sandbox (M4).
"""
from __future__ import annotations

import os
import shutil
import stat
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from .. import child_env
from .common import SHA1_HEX

DEFAULT_TIMEOUT_S = 600
MAX_TEXT_OUTPUT = 4 * 1024 * 1024


class GitBoxError(Exception):
    """`code` is a fixed word for the report; the message never carries command output."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class TreeEntry:
    mode: str
    type: str
    oid: str


def git_binary() -> str | None:
    return shutil.which("git", path=child_env.minimal_env().get("PATH"))


class GitBox:
    def __init__(self, work_root: Path, git: str | None = None, timeout_s: int = DEFAULT_TIMEOUT_S) -> None:
        self.git = git or git_binary()
        if not self.git:
            raise GitBoxError("git_missing")
        work_root.mkdir(parents=True, exist_ok=True)
        self.dir = Path(tempfile.mkdtemp(prefix="intake-", dir=str(work_root)))
        self.repo = self.dir / "repo.git"
        self.home = self.dir / "home"
        self.templates = self.dir / "no-templates"
        self.hooks = self.dir / "no-hooks"
        for d in (self.home, self.templates, self.hooks):
            d.mkdir()
        self.global_config = self.dir / "empty.gitconfig"
        self.global_config.write_bytes(b"")
        self.timeout_s = timeout_s
        self._replacements: list[tuple[str, str]] = [(str(self.dir), "<sandbox>")]

    # ------------------------------------------------------------------ plumbing

    def _git_env(self) -> dict[str, str]:
        return {
            "HOME": str(self.home),
            "XDG_CONFIG_HOME": str(self.home),
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": str(self.global_config),
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_ALLOW_PROTOCOL": "",
            "GIT_NO_REPLACE_OBJECTS": "1",
            "GIT_NO_LAZY_FETCH": "1",
            "GIT_OPTIONAL_LOCKS": "0",
            "GIT_ATTR_NOSYSTEM": "1",
            "GIT_CEILING_DIRECTORIES": str(self.dir.parent),
        }

    def _run(self, args: list[str], *, input_bytes: bytes | None = None, repo: bool = True) -> subprocess.CompletedProcess:
        cmd = [self.git, "-c", "protocol.allow=never", "-c", f"core.hooksPath={self.hooks}", "-c", "core.fsmonitor=false",
               "-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "core.quotePath=false"]
        if repo:
            cmd.append(f"--git-dir={self.repo}")
        cmd.extend(args)
        try:
            return subprocess.run(cmd, input=input_bytes, capture_output=True, cwd=str(self.dir), timeout=self.timeout_s,
                                  env=child_env.minimal_env(self._git_env()), check=False)
        except subprocess.TimeoutExpired as exc:
            raise GitBoxError("git_timeout") from exc
        except OSError as exc:
            raise GitBoxError("git_not_startable") from exc

    def sanitize(self, text: str) -> str:
        for real, shown in self._replacements:
            text = text.replace(real, shown).replace(real.replace("\\", "/"), shown)
        return text[:4000]

    def hide_path(self, real: Path, shown: str) -> None:
        self._replacements.insert(0, (str(real), shown))

    def cleanup(self) -> None:
        def make_writable(func, path, _exc):  # git writes pack files read-only; Windows refuses to delete those
            try:
                os.chmod(path, stat.S_IWRITE | stat.S_IREAD)
                func(path)
            except OSError:
                pass

        shutil.rmtree(self.dir, onexc=make_writable)

    # ------------------------------------------------------------------ commands

    def version(self) -> str:
        p = self._run(["--version"], repo=False)
        if p.returncode != 0:
            raise GitBoxError("git_version_failed")
        return p.stdout.decode("utf-8", "replace").strip()[:200]

    def init(self) -> None:
        p = self._run(["init", "--bare", "--quiet", f"--template={self.templates}", "--object-format=sha1", str(self.repo)], repo=False)
        if p.returncode != 0:
            raise GitBoxError("git_init_failed")

    def bundle_verify(self, bundle: Path) -> tuple[bool, str]:
        p = self._run(["bundle", "verify", str(bundle)])
        text = (p.stdout + p.stderr).decode("utf-8", "replace")
        return p.returncode == 0, self.sanitize(text)

    def bundle_list_heads(self, bundle: Path) -> list[tuple[str, str]]:
        p = self._run(["bundle", "list-heads", str(bundle)])
        if p.returncode != 0:
            raise GitBoxError("bundle_list_heads_failed")
        return _ref_lines(p.stdout)

    def unbundle(self, bundle: Path) -> list[tuple[str, str]]:
        p = self._run(["bundle", "unbundle", str(bundle)])
        if p.returncode != 0:
            raise GitBoxError("bundle_unbundle_failed")
        return _ref_lines(p.stdout)

    def update_ref(self, ref: str, sha: str) -> None:
        p = self._run(["update-ref", "--no-deref", ref, sha, "0" * 40])
        if p.returncode != 0:
            raise GitBoxError("update_ref_failed")

    def fsck(self) -> tuple[bool, str]:
        p = self._run(["fsck", "--full", "--strict", "--no-dangling", "--no-progress"])
        return p.returncode == 0, self.sanitize((p.stdout + p.stderr).decode("utf-8", "replace"))

    def local_config(self) -> str:
        p = self._run(["config", "--local", "--list"])
        return p.stdout.decode("utf-8", "replace") if p.returncode == 0 else ""

    def object_type(self, oid: str) -> str | None:
        p = self._run(["cat-file", "-t", oid])
        return p.stdout.decode("ascii", "replace").strip() if p.returncode == 0 else None

    def is_ancestor(self, older: str, newer: str) -> bool:
        p = self._run(["merge-base", "--is-ancestor", older, newer])
        if p.returncode not in (0, 1):
            raise GitBoxError("merge_base_failed")
        return p.returncode == 0

    def ls_tree(self, commit: str, max_entries: int) -> dict[str, TreeEntry]:
        """Every entry of the commit's tree (recursive, submodules shown as gitlinks). Paths must be UTF-8."""
        p = self._run(["ls-tree", "-r", "-z", "--full-tree", commit])
        if p.returncode != 0:
            raise GitBoxError("ls_tree_failed")
        out: dict[str, TreeEntry] = {}
        for rec in p.stdout.split(b"\0"):
            if not rec:
                continue
            meta, _, raw_path = rec.partition(b"\t")
            parts = meta.split(b" ")
            if len(parts) != 3:
                raise GitBoxError("ls_tree_parse")
            try:
                path = raw_path.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise GitBoxError("tree_path_not_utf8") from exc
            mode, typ, oid = (x.decode("ascii") for x in parts)
            if not SHA1_HEX.match(oid):
                raise GitBoxError("ls_tree_parse")
            out[path] = TreeEntry(mode, typ, oid)
            if len(out) > max_entries:
                raise GitBoxError("tree_too_large")
        return out

    def read_blobs(self, oids: list[str], max_total: int) -> dict[str, bytes]:
        """Blob bytes by id through `cat-file --batch` (no checkout, no filters). Missing or non-blob objects raise."""
        want = sorted(set(oids))
        if not want:
            return {}
        p = self._run(["cat-file", "--batch"], input_bytes=("\n".join(want) + "\n").encode("ascii"))
        if p.returncode != 0:
            raise GitBoxError("cat_file_failed")
        data = p.stdout
        out: dict[str, bytes] = {}
        pos = 0
        total = 0
        while pos < len(data):
            nl = data.index(b"\n", pos)
            header = data[pos:nl].decode("ascii", "replace").split(" ")
            pos = nl + 1
            if len(header) != 3 or header[1] != "blob":
                raise GitBoxError("cat_file_not_blob")
            size = int(header[2])
            total += size
            if total > max_total:
                raise GitBoxError("blobs_too_large")
            out[header[0]] = data[pos:pos + size]
            pos += size + 1
        if set(out) != set(want):
            raise GitBoxError("cat_file_missing")
        return out


def _ref_lines(raw: bytes) -> list[tuple[str, str]]:
    out = []
    for ln in raw.decode("utf-8", "replace").splitlines():
        if not ln.strip():
            continue
        sha, _, ref = ln.partition(" ")
        out.append((sha.strip(), ref.strip()))
    return out
