"""Staging, journal and commit-then-marker install of an imported integration (CR-035 section 5) - stage 1: designed and tested
against fakes only. No route calls `apply_install`; nothing here is wired to a live platform, and nothing restarts anything.

The mechanism extends the one bridge_install.py already uses for the SMPLWISE Bridge (ADR-012: copy next to the target, swap,
marker; the owner restarts the platform, custom components load at start) with verification and a crash-safe journal:

  plan     refuses unless: the kill switch is on, the manifest is an install candidate (`install_ready`), every target folder is
           either absent or carries THIS importer's marker (a hand-installed or foreign folder is never replaced), the version is
           strictly newer (no downgrade, no same version with other bytes; the same version with the same tree is a no-op), no
           leftover `.arx-new` / `.arx-old` folder waits for recovery
  stage    the installable bytes (read from git objects by the intake, never checked out) are written under the importer's own
           staging folder and re-hashed against the manifest (file set, size, SHA-256, tree hash)
  apply    per domain, the journal is written (fsync + atomic rename) BEFORE every step:
             copied   staging -> custom_components/<domain>.arx-new, verified again in place
             swapped  <domain> -> <domain>.arx-old (when present), <domain>.arx-new -> <domain>
             marked   the marker `<domain>/.smplwise_wiskey_import.json` is written LAST (temp file + atomic rename):
                      a folder without the marker is never treated as installed
             committed  <domain>.arx-old removed
  recover  at start-up (not wired in stage 1) an unfinished journal is settled: before the swap the new copy is removed (the old
           folder was never touched); after the swap without a marker the installed tree is verified - equal: the marker is
           written (roll forward), different: the old folder is put back (roll back); after the marker only the old copy is removed

Only `<config>/custom_components/<domain>`, `<domain>.arx-new` and `<domain>.arx-old` are ever touched, for the manifest's domains.
"""
from __future__ import annotations

import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Any, Callable

from .common import canonical_json, file_digests, parse_semver, path_issue, sha256_bytes, tree_sha256

JOURNAL_SCHEMA = "arx-wiskey/install-journal/0"
MARKER_SCHEMA = "arx-wiskey/install-marker/0"
MARKER = ".smplwise_wiskey_import.json"
NEW, OLD = ".arx-new", ".arx-old"
FINAL = ("committed", "rolled_back")


class InstallRefused(Exception):
    def __init__(self, code: str, domain: str | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.domain = domain


# ---------------------------------------------------------------------- small file helpers

def _write_atomic(path: Path, data: bytes) -> None:
    tmp = path.with_name(path.name + ".tmp-" + uuid.uuid4().hex[:8])
    with open(tmp, "wb") as fh:
        fh.write(data)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def read_marker(folder: Path) -> dict[str, Any] | None:
    try:
        data = json.loads((folder / MARKER).read_bytes())
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) and data.get("schema") == MARKER_SCHEMA else None


def folder_tree(folder: Path) -> tuple[str, int] | None:
    """(tree sha256, file count) of a folder without the marker; None when it holds a link or a special file."""
    entries = []
    for dirpath, dirnames, filenames in os.walk(folder, followlinks=False):
        here = Path(dirpath)
        for d in dirnames:
            if (here / d).is_symlink():
                return None
        for f in filenames:
            p = here / f
            rel = p.relative_to(folder).as_posix()
            if rel == MARKER:
                continue
            st = os.lstat(p)
            if not os.path.isfile(p) or p.is_symlink():
                return None
            entries.append((rel, file_digests(p, st.st_size)[0]))
    return tree_sha256(entries), len(entries)


def _domain_entry(manifest: dict[str, Any], domain: str) -> dict[str, Any]:
    return next(d for d in manifest["installable"] if d["domain"] == domain)


# ---------------------------------------------------------------------- plan

def plan_install(manifest: dict[str, Any], config_dir: Path | None, *, switch_on: bool) -> dict[str, Any]:
    """A dry-run plan: what would happen, or why it is refused. Touches nothing."""
    plan: dict[str, Any] = {"manifest_sha256": sha256_bytes(canonical_json(manifest)), "package": manifest.get("package"), "domains": [], "refused": None}
    try:
        if not switch_on:
            raise InstallRefused("import_disabled")
        if not manifest.get("install_ready") or manifest.get("profile", {}).get("kind") != "install_candidate":
            raise InstallRefused("not_install_candidate")
        if not manifest.get("installable"):
            raise InstallRefused("nothing_installable")
        if config_dir is None or not config_dir.is_dir():
            raise InstallRefused("platform_config_not_mapped")
        base = config_dir / "custom_components"
        if base.is_symlink():
            raise InstallRefused("custom_components_is_link")
        for d in manifest["installable"]:
            dom = d["domain"]
            target = base / dom
            if (base / (dom + NEW)).exists() or (base / (dom + OLD)).exists():
                raise InstallRefused("pending_recovery", dom)
            if target.is_symlink():
                raise InstallRefused("target_is_link", dom)
            action = "install"
            previous = None
            if target.exists():
                marker = read_marker(target)
                if marker is None or marker.get("domain") != dom:
                    raise InstallRefused("target_not_managed", dom)
                previous = {"version": marker.get("version"), "tree_sha256": marker.get("tree_sha256")}
                new_v, old_v = parse_semver(d["version"]), parse_semver(marker.get("version"))
                if old_v is None:
                    raise InstallRefused("installed_version_unreadable", dom)
                if new_v == old_v:
                    if marker.get("tree_sha256") != d["tree_sha256"]:
                        raise InstallRefused("same_version_other_content", dom)
                    action = "noop"
                elif new_v is None or new_v < old_v:
                    raise InstallRefused("downgrade_refused", dom)
                else:
                    action = "update"
            plan["domains"].append({"domain": dom, "version": d["version"], "tree_sha256": d["tree_sha256"], "files": d["file_count"],
                                    "action": action, "previous": previous})
    except InstallRefused as exc:
        plan["refused"] = {"code": exc.code, "domain": exc.domain}
        plan["domains"] = []
    plan["steps"] = [] if plan["refused"] else ["stage+verify", "journal", "copy to <domain>.arx-new + verify", "swap", "marker (commit)",
                                                 "remove <domain>.arx-old", "owner restarts the platform"]
    return plan


# ---------------------------------------------------------------------- stage

def stage(manifest: dict[str, Any], installable: dict[str, list[tuple[str, str, bytes]]], staging_dir: Path) -> Path:
    """Write the installable bytes under staging_dir/<domain>/ (a new folder) and verify them against the manifest."""
    staging_dir.mkdir(parents=True, exist_ok=False)
    for d in manifest["installable"]:
        dom = d["domain"]
        root = staging_dir / dom
        root.mkdir()
        for rel, mode, data in installable[dom]:
            if path_issue(rel) or mode != "100644" or rel == MARKER:
                raise InstallRefused("staging_path_refused", dom)
            dest = root.joinpath(*rel.split("/"))
            if root.resolve() not in dest.resolve().parents:
                raise InstallRefused("staging_path_refused", dom)
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "xb") as fh:
                fh.write(data)
        verify_folder(root, d)
    return staging_dir


def verify_folder(folder: Path, entry: dict[str, Any]) -> None:
    """The folder holds exactly the manifest's files with the manifest's bytes (the marker aside)."""
    got = folder_tree(folder)
    if got is None:
        raise InstallRefused("verify_link_or_special", entry["domain"])
    tree, count = got
    if tree != entry["tree_sha256"] or count != entry["file_count"]:
        raise InstallRefused("verify_tree_differs", entry["domain"])


# ---------------------------------------------------------------------- journal

class Journal:
    def __init__(self, path: Path, data: dict[str, Any]) -> None:
        self.path = path
        self.data = data

    @classmethod
    def create(cls, journal_dir: Path, manifest: dict[str, Any], plan: dict[str, Any], intake_id: str, now: Callable[[], str]) -> "Journal":
        journal_dir.mkdir(parents=True, exist_ok=True)
        iid = uuid.uuid4().hex
        data = {"schema": JOURNAL_SCHEMA, "install_id": iid, "intake_id": intake_id, "manifest_sha256": plan["manifest_sha256"],
                "created_at": now(), "state": "planned",
                "domains": [{"domain": d["domain"], "version": d["version"], "tree_sha256": d["tree_sha256"], "file_count": d["files"],
                             "action": d["action"], "state": "planned"} for d in plan["domains"]],
                "history": [{"at": now(), "state": "planned"}]}
        j = cls(journal_dir / f"{iid}.json", data)
        j.save()
        return j

    @classmethod
    def load(cls, path: Path) -> "Journal":
        return cls(path, json.loads(path.read_bytes()))

    def save(self) -> None:
        _write_atomic(self.path, json.dumps(self.data, ensure_ascii=False, indent=1, sort_keys=True).encode("utf-8"))

    def step(self, domain: str | None, state: str, now: Callable[[], str]) -> None:
        if domain is None:
            self.data["state"] = state
        else:
            next(d for d in self.data["domains"] if d["domain"] == domain)["state"] = state
        self.data["history"].append({"at": now(), "state": state, **({"domain": domain} if domain else {})})
        self.save()


def unfinished(journal_dir: Path) -> list[Path]:
    if not journal_dir.is_dir():
        return []
    out = []
    for p in sorted(journal_dir.glob("*.json")):
        try:
            if json.loads(p.read_bytes()).get("state") not in FINAL:
                out.append(p)
        except (OSError, ValueError):
            out.append(p)
    return out


# ---------------------------------------------------------------------- apply / recover

def apply_install(manifest: dict[str, Any], plan: dict[str, Any], staging_dir: Path, config_dir: Path, journal_dir: Path, *,
                  switch_on: bool, intake_id: str, now: Callable[[], str], fault: Callable[[str, str], None] | None = None) -> dict[str, Any]:
    """Run a plan that was not refused. `fault(domain, step)` is the test seam that simulates a crash between two steps."""
    if not switch_on:
        raise InstallRefused("import_disabled")
    if plan.get("refused"):
        raise InstallRefused(plan["refused"]["code"], plan["refused"].get("domain"))
    if plan["manifest_sha256"] != sha256_bytes(canonical_json(manifest)):
        raise InstallRefused("plan_manifest_mismatch")
    if unfinished(journal_dir):
        raise InstallRefused("pending_recovery")
    fault = fault or (lambda _d, _s: None)
    journal = Journal.create(journal_dir, manifest, plan, intake_id, now)
    base = config_dir / "custom_components"
    base.mkdir(exist_ok=True)
    for d in plan["domains"]:
        dom = d["domain"]
        entry = _domain_entry(manifest, dom)
        if d["action"] == "noop":
            journal.step(dom, "committed", now)
            continue
        target, new, old = base / dom, base / (dom + NEW), base / (dom + OLD)
        verify_folder(staging_dir / dom, entry)  # staging is re-checked right before use
        journal.step(dom, "copying", now)
        fault(dom, "copying")
        shutil.copytree(staging_dir / dom, new, symlinks=False)
        verify_folder(new, entry)
        journal.step(dom, "copied", now)
        fault(dom, "copied")
        if target.exists():
            target.rename(old)
        fault(dom, "old_moved")
        new.rename(target)
        journal.step(dom, "swapped", now)
        fault(dom, "swapped")
        _write_marker(target, entry, manifest, journal.data["install_id"], intake_id, now)
        journal.step(dom, "marked", now)
        fault(dom, "marked")
        if old.exists():
            shutil.rmtree(old)
        journal.step(dom, "committed", now)
    journal.step(None, "committed", now)
    return journal.data


def _write_marker(target: Path, entry: dict[str, Any], manifest: dict[str, Any], install_id: str, intake_id: str, now: Callable[[], str]) -> None:
    marker = {"schema": MARKER_SCHEMA, "domain": entry["domain"], "version": entry["version"], "tree_sha256": entry["tree_sha256"],
              "file_count": entry["file_count"], "manifest_sha256": sha256_bytes(canonical_json(manifest)), "package": manifest.get("package"),
              "install_id": install_id, "intake_id": intake_id, "at": now()}
    _write_atomic(target / MARKER, json.dumps(marker, ensure_ascii=False, sort_keys=True).encode("utf-8"))


def recover(journal_dir: Path, config_dir: Path, manifests: Callable[[str], dict[str, Any] | None], now: Callable[[], str]) -> list[dict[str, Any]]:
    """Settle every unfinished journal. `manifests(manifest_sha256)` returns the stored manifest of that install (or None)."""
    out = []
    base = config_dir / "custom_components"
    for path in unfinished(journal_dir):
        try:
            journal = Journal.load(path)
        except (OSError, ValueError):
            out.append({"journal": path.name, "outcome": "unreadable_left_for_owner"})
            continue
        manifest = manifests(journal.data["manifest_sha256"])
        outcomes = []
        for d in journal.data["domains"]:
            dom = d["domain"]
            if d["state"] in FINAL:
                continue
            target, new, old = base / dom, base / (dom + NEW), base / (dom + OLD)
            state = d["state"]
            if state == "copied" and not new.exists() and target.exists():
                state = "swapped"  # the crash came after `<domain>.arx-new -> <domain>` and before the journal said so
            if state in ("planned", "copying", "copied"):
                # before the swap: the old folder may already be moved aside (a crash right after that rename)
                if new.exists():
                    shutil.rmtree(new)
                if old.exists() and not target.exists():
                    old.rename(target)
                journal.step(dom, "rolled_back", now)
                outcomes.append((dom, "rolled_back"))
            elif state == "swapped":
                entry = _domain_entry(manifest, dom) if manifest else None
                got = folder_tree(target) if target.exists() else None
                if entry is not None and got is not None and got == (entry["tree_sha256"], entry["file_count"]):
                    _write_marker(target, entry, manifest, journal.data["install_id"], journal.data["intake_id"], now)
                    if old.exists():
                        shutil.rmtree(old)
                    journal.step(dom, "committed", now)
                    outcomes.append((dom, "rolled_forward"))
                else:
                    if target.exists():
                        shutil.rmtree(target)
                    if old.exists():
                        old.rename(target)
                    journal.step(dom, "rolled_back", now)
                    outcomes.append((dom, "rolled_back"))
            elif d["state"] == "marked":
                if old.exists():
                    shutil.rmtree(old)
                journal.step(dom, "committed", now)
                outcomes.append((dom, "committed"))
        states = {d["state"] for d in journal.data["domains"]}
        journal.step(None, "committed" if states <= {"committed"} else "rolled_back", now)
        out.append({"journal": path.name, "install_id": journal.data["install_id"], "outcome": journal.data["state"], "domains": dict(outcomes)})
    return out
