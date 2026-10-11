"""Offline verification of one delivered WisKey package and the Arx import manifest (CR-035 sections 3 and 4).

`run_intake(package_dir, package_name, profile, work_root)` checks, in this order, and records PASS / FAIL / NOT_RUN /
NOT_APPLICABLE per check (a check after a failed gate is NOT_RUN, never PASS):

  P01 package_name      ASCII name, the folder carries it, a real directory (not a link)
  P02 layout            exactly bundle/<package>.bundle, support/, metadata/, PACKAGE_MANIFEST.json, SHA256SUMS
  P03 path_hygiene      no symlink, special file, hard link or executable bit; relative NFC paths, no '..', '\\', ':', '.git',
                        reserved names; no case-insensitive collision
  P04 size_caps         bundle, per file, total, file count, metadata (profile limits, never above the built-in ceiling)
  -- gate: a failure above stops everything below (nothing is hashed, git never starts)
  P05 sha256sums        LF, UTF-8 without BOM, every file but SHA256SUMS listed once, every hash equal
  P06 package_manifest  strict JSON; package, refs, source commit, versions and the profile's `manifest_expect` equal
  P07 metadata_files    exactly the profile's metadata files; size, SHA-256 and git blob id equal (M1)
  P08 input_spec        the input spec (pinned by P07) parses, is consistent, and its counts equal the profile's
  -- gate
  B01 bundle_header     parsed by Arx without git: v2, no prerequisite, exactly the profile's refs, then a pack (T2)
  B02 git               the git CLI and an isolated throwaway bare repository (gitbox.py)
  B03 bundle_verify     `git bundle verify` succeeds and reports a complete history
  B04 list_heads        `git bundle list-heads` = exactly the profile's refs
  B05 unbundle          objects written by `bundle unbundle`, refs set by `update-ref`; no remote, alternates or promisor
  B06 fsck              `git fsck --full --strict` clean
  B07 refs_ancestry     every ref is a commit; the profile's ancestry chain holds
  -- gate
  T00 tree_modes        no profile-forbidden mode (symlink, gitlink) anywhere in the source tree
  T01 support           support/ = the spec's support set; bytes = spec (SHA-256, size, blob id) = the tree (mode 100644, blob)
  T02 history           every history record: mode + blob in its ref's tree and the SHA-256 of the blob; group manifests
  T03 source_tests      every source test file: mode + blob in the source tree and the SHA-256 of the blob
  T04 test_links        every test link resolves (support / source / registered -> metadata, M2) and its SHA-256 equals the bytes
  T05 registered        the profile's registered values (baseline, requirements, socket, tests manifest) on the real bytes
  I01 installable_tree  custom_components/<domain>/ for every profile domain: present, regular 100644 blobs only, clean paths
  I02 installable_size  file count, per file and total caps
  I03 installable_manifest  manifest.json strict JSON, domain = folder, version = the profile's source version
  I04 forbidden_content forbidden names and the value-free text scan (scan.py)

Nothing is executed, imported or checked out from the package. The report never contains a matched value, a secret or an
absolute path; it names checks, counts, relative paths and short blob prefixes only.
"""
from __future__ import annotations

import os
import platform
import re
import stat
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .common import (
    PACKAGE_NAME, SHA1_HEX, SHA256_HEX, StrictJsonError, canonical_json, casefold_collisions, file_digests, git_blob_id,
    load_json_strict, parse_semver, path_issue, sha256_bytes, tree_sha256,
)
from .gitbox import GitBox, GitBoxError, TreeEntry
from .profile import INPUT_SPEC_SCHEMA, Profile
from .scan import name_issue, scan_files

REPORT_SCHEMA = "arx-wiskey/intake-report/0"
MANIFEST_SCHEMA = "arx-wiskey/import-manifest/0"
TOP_LEVEL = {"bundle": "dir", "support": "dir", "metadata": "dir", "PACKAGE_MANIFEST.json": "file", "SHA256SUMS": "file"}
SUMS_LINE = re.compile(r"^([0-9a-f]{64})  (\S(?:.*\S)?)$")
SAMPLES = 10

CHECKS: tuple[tuple[str, str], ...] = (
    ("P01", "package_name"), ("P02", "layout"), ("P03", "path_hygiene"), ("P04", "size_caps"),
    ("P05", "sha256sums"), ("P06", "package_manifest"), ("P07", "metadata_files"), ("P08", "input_spec"),
    ("B01", "bundle_header"), ("B02", "git"), ("B03", "bundle_verify"), ("B04", "list_heads"), ("B05", "unbundle"),
    ("B06", "fsck"), ("B07", "refs_ancestry"),
    ("T00", "tree_modes"), ("T01", "support"), ("T02", "history"), ("T03", "source_tests"), ("T04", "test_links"), ("T05", "registered"),
    ("I01", "installable_tree"), ("I02", "installable_size"), ("I03", "installable_manifest"), ("I04", "forbidden_content"),
)
PASS, FAIL, NOT_RUN, NOT_APPLICABLE = "PASS", "FAIL", "NOT_RUN", "NOT_APPLICABLE"


@dataclass
class FileInfo:
    rel: str
    path: Path
    size: int
    sha256: str = ""
    blob: str = ""


@dataclass
class IntakeResult:
    report: dict[str, Any]
    manifest: dict[str, Any] | None
    # domain -> [(path inside the domain folder, mode, bytes)]; filled only when the intake passed
    installable: dict[str, list[tuple[str, str, bytes]]] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return self.report["result"] == PASS


class _Checks:
    def __init__(self) -> None:
        self.items: dict[str, dict[str, Any]] = {cid: {"id": cid, "name": name, "status": NOT_RUN} for cid, name in CHECKS}

    def set(self, cid: str, status: str, detail: str = "", **data: Any) -> bool:
        item = self.items[cid]
        item["status"] = status
        if detail:
            item["detail"] = detail
        if data:
            item["data"] = data
        return status in (PASS, NOT_APPLICABLE)

    def ok(self, *cids: str) -> bool:
        return all(self.items[c]["status"] in (PASS, NOT_APPLICABLE) for c in cids)

    def as_list(self) -> list[dict[str, Any]]:
        return [self.items[cid] for cid, _ in CHECKS]


def _samples(paths: list[str]) -> list[str]:
    return sorted(paths)[:SAMPLES]


def _dotted(obj: Any, key: str) -> tuple[bool, Any]:
    cur = obj
    for part in key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return False, None
        cur = cur[part]
    return True, cur


def _same(a: Any, b: Any) -> bool:
    """Equality that does not let True == 1 or 1 == 1.0 pass."""
    return type(a) is type(b) and a == b


# ---------------------------------------------------------------------- package folder

def _inventory(root: Path, max_files: int) -> tuple[list[FileInfo], dict[str, list[str]], bool]:
    """Every regular file under root (relative POSIX path, lstat size) and hygiene issues by code. Never follows a link."""
    files: list[FileInfo] = []
    issues: dict[str, list[str]] = {}
    too_many = False

    def issue(code: str, rel: str) -> None:
        issues.setdefault(code, []).append(rel)

    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        here = Path(dirpath)
        for d in list(dirnames):
            p = here / d
            rel = p.relative_to(root).as_posix()
            st = os.lstat(p)
            if stat.S_ISLNK(st.st_mode) or (hasattr(st, "st_reparse_tag") and getattr(st, "st_reparse_tag", 0)):
                issue("symlink", rel)
                dirnames.remove(d)
                continue
            why = path_issue(rel)
            if why:
                issue(why, rel)
        for f in filenames:
            p = here / f
            rel = p.relative_to(root).as_posix()
            st = os.lstat(p)
            if stat.S_ISLNK(st.st_mode) or getattr(st, "st_reparse_tag", 0):
                issue("symlink", rel)
                continue
            if not stat.S_ISREG(st.st_mode):
                issue("special_file", rel)
                continue
            if st.st_nlink > 1:
                issue("hard_link", rel)
            if os.name == "posix" and st.st_mode & 0o111:
                issue("executable_bit", rel)
            why = path_issue(rel)
            if why:
                issue(why, rel)
            files.append(FileInfo(rel, p, st.st_size))
            if len(files) > max_files:
                too_many = True
                return files, issues, too_many
    if casefold_collisions(fi.rel for fi in files):
        issues.setdefault("case_collision", [])
    return files, issues, too_many


def _parse_sums(data: bytes) -> tuple[dict[str, str] | None, str]:
    if data.startswith(b"\xef\xbb\xbf"):
        return None, "bom"
    if b"\r" in data:
        return None, "crlf"
    if not data.endswith(b"\n"):
        return None, "no_final_newline"
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return None, "not_utf8"
    out: dict[str, str] = {}
    for ln in text[:-1].split("\n"):
        m = SUMS_LINE.match(ln)
        if not m:
            return None, "bad_line"
        h, p = m.groups()
        if path_issue(p) or p in out:
            return None, "bad_or_duplicate_path"
        out[p] = h
    return out, ""


def _parse_bundle_header(path: Path, cap: int) -> tuple[dict[str, str] | None, str, int]:
    """(refs, problem, header length). Pure Python: git is not involved yet."""
    with open(path, "rb") as fh:
        head = fh.read(cap + 4)
    end = head.find(b"\n\n")
    if end < 0 or end > cap:
        return None, "header_unterminated", 0
    lines = head[:end].split(b"\n")
    if lines[0] != b"# v2 git bundle":
        return None, "not_v2", 0
    refs: dict[str, str] = {}
    for raw in lines[1:]:
        if raw.startswith(b"-"):
            return None, "prerequisites_present", 0
        if raw.startswith(b"@"):
            return None, "capabilities_present", 0
        try:
            ln = raw.decode("utf-8")
        except UnicodeDecodeError:
            return None, "header_not_utf8", 0
        sha, _, ref = ln.partition(" ")
        if not SHA1_HEX.match(sha) or not ref or ref in refs:
            return None, "bad_ref_line", 0
        refs[ref] = sha
    if head[end + 2:end + 6] != b"PACK":
        return None, "no_pack_after_header", 0
    return refs, "", end + 2


# ---------------------------------------------------------------------- input spec

def _check_spec(spec: Any, profile: Profile) -> tuple[list[str], dict[str, int]]:
    """Structural problems (fixed codes) and the computed counts."""
    problems: list[str] = []
    counts: dict[str, int] = {}
    if not isinstance(spec, dict) or spec.get("schema") != INPUT_SPEC_SCHEMA:
        return ["schema"], counts
    commits = set(profile.refs.values())
    source_commit = profile.refs[profile.source_ref]
    if not isinstance(spec.get("refs"), list) or set(spec["refs"]) != commits or len(spec["refs"]) != len(commits):
        problems.append("refs")
    if spec.get("source_commit") != source_commit:
        problems.append("source_commit")

    def entries(key: str, fields: set[str]) -> list[dict[str, Any]]:
        v = spec.get(key)
        if not isinstance(v, list) or not all(isinstance(e, dict) and fields <= set(e) for e in v):
            problems.append(f"{key}_shape")
            return []
        return v

    support = entries("support", {"path", "mode", "sha256", "size", "git_blob", "binding_ref"})
    history = entries("history", {"group", "ref", "path", "sha256", "mode", "git_blob"})
    groups = entries("history_groups", {"id", "ref", "manifest", "record_count"})
    src_tests = entries("source_test_files", {"path", "sha256", "mode", "git_blob"})
    tests = entries("tests", {"path", "binding_path", "sha256", "binding"})
    registered = entries("registered_files", {"path", "sha256", "mode"})

    def well_formed(e: dict[str, Any], keys: tuple[str, ...]) -> bool:
        ok = True
        if "path" in keys:
            ok &= isinstance(e["path"], str) and path_issue(e["path"]) is None
        if "sha256" in keys:
            ok &= isinstance(e["sha256"], str) and bool(SHA256_HEX.match(e["sha256"]))
        if "git_blob" in keys:
            ok &= isinstance(e["git_blob"], str) and bool(SHA1_HEX.match(e["git_blob"]))
        if "mode" in keys:
            ok &= e["mode"] in ("100644", "100755")
        return bool(ok)

    if not all(well_formed(e, ("path", "sha256", "git_blob")) and e["mode"] == "100644" and isinstance(e["size"], int)
               and e["binding_ref"] in commits for e in support):
        problems.append("support_entry")
    if len({e["path"] for e in support}) != len(support) or casefold_collisions(e["path"] for e in support if isinstance(e.get("path"), str)):
        problems.append("support_duplicate")
    if not all(well_formed(e, ("path", "sha256", "git_blob", "mode")) and e["ref"] in commits for e in history):
        problems.append("history_entry")
    if len({(e["group"], e["ref"], e["path"]) for e in history}) != len(history):
        problems.append("history_duplicate")
    group_ids = [g["id"] for g in groups]
    if len(set(group_ids)) != len(group_ids):
        problems.append("group_duplicate")
    for g in groups:
        m = g["manifest"]
        if (g["ref"] not in commits or not isinstance(m, dict) or not isinstance(m.get("path"), str) or path_issue(m["path"])
                or not isinstance(m.get("sha256"), str) or not SHA256_HEX.match(m["sha256"]) or not isinstance(m.get("size"), int)):
            problems.append("group_entry")
            break
        if g["record_count"] != sum(1 for e in history if e["group"] == g["id"] and e["ref"] == g["ref"]):
            problems.append("group_record_count")
            break
    if any(e["group"] not in group_ids for e in history):
        problems.append("history_unknown_group")
    if not all(well_formed(e, ("path", "sha256", "git_blob", "mode")) for e in src_tests) or len({e["path"] for e in src_tests}) != len(src_tests):
        problems.append("source_test_entry")
    if not all(well_formed(e, ("path", "sha256")) and isinstance(e["binding_path"], str) and path_issue(e["binding_path"]) is None
               and e["binding"] in ("support", "source", "registered") for e in tests):
        problems.append("test_entry")
    if len({e["path"] for e in tests}) != len(tests):
        problems.append("test_duplicate")
    if not all(well_formed(e, ("path", "sha256")) for e in registered):
        problems.append("registered_entry")
    if problems:
        return problems, counts
    counts = {
        "support": len(support), "history_records": len(history), "history_groups": len(groups), "tests": len(tests),
        "source_tests": sum(1 for t in tests if t["binding"] == "source"),
        "support_tests": sum(1 for t in tests if t["binding"] == "support"),
        "registered_alias_tests": sum(1 for t in tests if t["binding"] == "registered"),
    }
    if len(src_tests) != counts["source_tests"]:
        problems.append("source_test_files_vs_links")
    expected = spec.get("expected_counts")
    if isinstance(expected, dict):
        for k, v in expected.items():
            if k in counts and counts[k] != v:
                problems.append(f"expected_counts_{k}")
    for k, v in profile.counts.items():
        if counts.get(k) != v:
            problems.append(f"count_{k}")
    return problems, counts


# ---------------------------------------------------------------------- main

def run_intake(package_dir: Path, package_name: str, profile: Profile, work_root: Path, *,
               now: Callable[[], str], git: str | None = None, intake_id: str | None = None) -> IntakeResult:
    checks = _Checks()
    iid = intake_id or uuid.uuid4().hex
    started = now()
    env: dict[str, Any] = {"python": sys.version.split()[0], "platform": platform.system().lower(), "git": None}
    state: dict[str, Any] = {}
    box: GitBox | None = None
    installable: dict[str, list[tuple[str, str, bytes]]] = {}
    try:
        _run(package_dir, package_name, profile, work_root, checks, state, env, git, installable)
    except GitBoxError as exc:  # an unexpected git failure is a FAIL of the running check, never a pass
        running = next((c for c in checks.as_list() if c["status"] == NOT_RUN), None)
        if running:
            checks.set(running["id"], FAIL, f"git:{exc.code}")
    finally:
        box = state.get("box")
        if box is not None:
            box.cleanup()
    failed = [c for c in checks.as_list() if c["status"] == FAIL]
    not_run = [c for c in checks.as_list() if c["status"] == NOT_RUN]
    result = PASS if not failed and not not_run else FAIL
    manifest = _manifest(package_name, profile, state) if result == PASS else None
    report = {
        "schema": REPORT_SCHEMA, "intake_id": iid, "package": package_name if PACKAGE_NAME.match(package_name or "") else None,
        "profile": {"id": profile.id, "sha256": profile.sha256, "kind": profile.kind},
        "started_at": started, "finished_at": now(), "result": result,
        "first_failure": failed[0]["id"] if failed else (not_run[0]["id"] if not_run else None),
        "checks": checks.as_list(),
        "manifest_sha256": sha256_bytes(canonical_json(manifest)) if manifest else None,
        "environment": env,
        "executed_imported_code": False, "network_used": False, "checkout_performed": False,
    }
    return IntakeResult(report, manifest, installable if result == PASS else {})


def _run(package_dir: Path, name: str, profile: Profile, work_root: Path, checks: _Checks, state: dict[str, Any],
         env: dict[str, Any], git: str | None, installable: dict[str, list[tuple[str, str, bytes]]]) -> None:
    lim = profile.limits
    # P01 ------------------------------------------------------------------
    try:
        real_dir = os.path.isdir(package_dir) and not os.path.islink(package_dir)
    except OSError:
        real_dir = False
    if not (isinstance(name, str) and PACKAGE_NAME.match(name) and package_dir.name == name and real_dir):
        checks.set("P01", FAIL, "name_or_folder")
        return
    checks.set("P01", PASS)
    # P03 / P04 inventory ---------------------------------------------------
    files, issues, too_many = _inventory(package_dir, lim["max_files"])
    by_rel = {f.rel: f for f in files}
    # P02 layout
    top: dict[str, str] = {}
    for entry in os.scandir(package_dir):
        top[entry.name] = "dir" if entry.is_dir(follow_symlinks=False) else ("file" if entry.is_file(follow_symlinks=False) else "other")
    bundle_rel = f"bundle/{name}.bundle"
    bundle_files = [f for f in files if f.rel.startswith("bundle/")]
    layout_ok = top == TOP_LEVEL and [f.rel for f in bundle_files] == [bundle_rel]
    checks.set("P02", PASS if layout_ok else FAIL, "" if layout_ok else "unexpected_layout",
               **({} if layout_ok else {"unexpected": sorted(set(top) ^ set(TOP_LEVEL)), "bundle_files": len(bundle_files)}))
    if issues:
        checks.set("P03", FAIL, "hygiene", issues={k: len(v) for k, v in issues.items()}, samples={k: _samples(v) for k, v in issues.items()})
    else:
        checks.set("P03", PASS, files=len(files))
    total = sum(f.size for f in files)
    over = [f.rel for f in files if f.size > lim["max_file_bytes"]]
    meta_over = [f.rel for f in files if f.rel.startswith("metadata/") and f.size > lim["max_metadata_bytes"]]
    bundle_size = by_rel[bundle_rel].size if bundle_rel in by_rel else 0
    size_ok = not too_many and not over and not meta_over and total <= lim["max_total_bytes"] and bundle_size <= lim["max_bundle_bytes"]
    checks.set("P04", PASS if size_ok else FAIL, "" if size_ok else "over_cap", files=len(files), total_bytes=total, bundle_bytes=bundle_size,
               too_many_files=too_many, files_over_cap=_samples(over + meta_over))
    if not checks.ok("P02", "P03", "P04"):
        return
    # P05 SHA256SUMS ----------------------------------------------------------
    for f in files:
        f.sha256, f.blob = file_digests(f.path, f.size)
    sums, why = _parse_sums(by_rel["SHA256SUMS"].path.read_bytes())
    if sums is None:
        checks.set("P05", FAIL, why)
    else:
        listed = set(sums)
        present = set(by_rel) - {"SHA256SUMS"}
        bad = [p for p in listed & present if sums[p] != by_rel[p].sha256]
        ok = listed == present and not bad
        checks.set("P05", PASS if ok else FAIL, "" if ok else "mismatch", listed=len(listed), missing_from_sums=_samples(list(present - listed)),
                   listed_not_present=_samples(list(listed - present)), hash_mismatch=_samples(bad))
    # P06 PACKAGE_MANIFEST.json -------------------------------------------------
    try:
        pm = load_json_strict(by_rel["PACKAGE_MANIFEST.json"].path.read_bytes())
    except StrictJsonError as exc:
        checks.set("P06", FAIL, f"json:{exc}")
        pm = None
    if pm is not None:
        wrong: list[str] = []
        if not isinstance(pm, dict):
            wrong.append("<root>")
        else:
            builtin = {"package": name, "refs": profile.refs, "source_commit": profile.refs[profile.source_ref]}
            if profile.source_version is not None:
                builtin["source_version"] = profile.source_version
            if profile.tests_manifest_version is not None:
                builtin["tests_manifest_version"] = profile.tests_manifest_version
            for k, v in {**builtin, **profile.manifest_expect}.items():
                found, got = _dotted(pm, k)
                if not found or not _same(got, v):
                    wrong.append(k)
        checks.set("P06", FAIL if wrong else PASS, "fields_differ" if wrong else "", fields=sorted(wrong))
        state["package_manifest_sha256"] = by_rel["PACKAGE_MANIFEST.json"].sha256
    state["sha256sums_sha256"] = by_rel["SHA256SUMS"].sha256
    # P07 metadata ------------------------------------------------------------
    expected_meta = {"metadata/" + m["source_path"]: m for m in profile.metadata}
    present_meta = {f.rel for f in files if f.rel.startswith("metadata/")}
    meta_bad = [rel for rel, m in expected_meta.items() if rel in by_rel and not (
        by_rel[rel].size == m["size"] and by_rel[rel].sha256 == m["sha256"] and by_rel[rel].blob == m["git_blob"])]
    meta_ok = present_meta == set(expected_meta) and not meta_bad
    checks.set("P07", PASS if meta_ok else FAIL, "" if meta_ok else "metadata_differs", missing=_samples(list(set(expected_meta) - present_meta)),
               unexpected=_samples(list(present_meta - set(expected_meta))), mismatch=_samples(meta_bad), files=len(present_meta))
    # P08 input spec ----------------------------------------------------------
    spec: Any = None
    spec_meta = profile.metadata_by_role(profile.input_spec_role)
    if meta_ok and spec_meta is not None:
        try:
            spec = load_json_strict(by_rel["metadata/" + spec_meta["source_path"]].path.read_bytes())
        except StrictJsonError as exc:
            checks.set("P08", FAIL, f"json:{exc}")
        if spec is not None:
            problems, counts = _check_spec(spec, profile)
            checks.set("P08", FAIL if problems else PASS, "inconsistent" if problems else "", problems=problems, counts=counts)
    if not checks.ok("P05", "P06", "P07", "P08"):
        return
    state["spec"] = spec
    state["files"] = by_rel
    # B01 bundle header (pure Python) -----------------------------------------
    bundle = by_rel[bundle_rel]
    refs, why, _hlen = _parse_bundle_header(bundle.path, lim["max_bundle_header_bytes"])
    if refs is None:
        checks.set("B01", FAIL, why)
        return
    if refs != profile.refs:
        checks.set("B01", FAIL, "refs_differ", extra=sorted(set(refs) - set(profile.refs)), missing=sorted(set(profile.refs) - set(refs)),
                   changed=sorted(r for r in set(refs) & set(profile.refs) if refs[r] != profile.refs[r]))
        return
    checks.set("B01", PASS, version=2, prerequisites=0, refs=len(refs))
    state["bundle"] = {"path": bundle_rel, "size": bundle.size, "sha256": bundle.sha256}
    # B02 git sandbox ---------------------------------------------------------
    try:
        box = GitBox(work_root, git=git)
    except GitBoxError as exc:
        checks.set("B02", FAIL, exc.code)
        return
    state["box"] = box
    box.hide_path(package_dir, f"<exchange>/{name}")
    env["git"] = box.version()
    box.init()
    checks.set("B02", PASS, git=env["git"])
    # B03 verify --------------------------------------------------------------
    ok, text = box.bundle_verify(bundle.path)
    complete = "complete history" in text.lower()
    if not (ok and complete):
        checks.set("B03", FAIL, "verify_failed" if not ok else "history_not_complete", output=text)
        return
    checks.set("B03", PASS, output=text)
    # B04 list-heads ----------------------------------------------------------
    heads = box.bundle_list_heads(bundle.path)
    heads_ok = len(heads) == len(profile.refs) and dict((r, s) for s, r in heads) == profile.refs
    checks.set("B04", PASS if heads_ok else FAIL, "" if heads_ok else "heads_differ", heads=[f"{s} {r}" for s, r in heads])
    if not heads_ok:
        return
    # B05 unbundle into the isolated repository --------------------------------
    got = box.unbundle(bundle.path)
    if dict((r, s) for s, r in got) != profile.refs:
        checks.set("B05", FAIL, "unbundle_refs_differ")
        return
    for ref, sha in sorted(profile.refs.items()):
        box.update_ref(ref, sha)
    cfg = box.local_config().lower()
    alternates = (box.repo / "objects" / "info" / "alternates").exists()
    promisor = any(p.suffix == ".promisor" for p in (box.repo / "objects" / "pack").glob("*"))
    isolated = "remote." not in cfg and "partialclone" not in cfg and "promisor" not in cfg and not alternates and not promisor
    checks.set("B05", PASS if isolated else FAIL, "" if isolated else "not_isolated", remote=False if isolated else None)
    if not isolated:
        return
    # B06 fsck ----------------------------------------------------------------
    ok, text = box.fsck()
    checks.set("B06", PASS if ok else FAIL, "" if ok else "fsck_failed", output=text)
    if not ok:
        return
    # B07 refs are commits, ancestry ---------------------------------------------
    not_commit = [r for r, s in profile.refs.items() if box.object_type(s) != "commit"]
    chain = [profile.refs[r] for r in profile.ancestry]
    broken = [f"{profile.ancestry[i]}->{profile.ancestry[i + 1]}" for i in range(len(chain) - 1) if not box.is_ancestor(chain[i], chain[i + 1])]
    ok = not not_commit and not broken
    checks.set("B07", PASS if ok else FAIL, "" if ok else "refs_or_ancestry", not_commit=not_commit, broken=broken)
    if not ok:
        return
    _content(box, profile, checks, state, installable)


def _content(box: GitBox, profile: Profile, checks: _Checks, state: dict[str, Any], installable: dict[str, list[tuple[str, str, bytes]]]) -> None:
    lim = profile.limits
    spec = state["spec"]
    by_rel: dict[str, FileInfo] = state["files"]
    source_commit = profile.refs[profile.source_ref]
    trees: dict[str, dict[str, TreeEntry]] = {}

    def tree(commit: str) -> dict[str, TreeEntry]:
        if commit not in trees:
            trees[commit] = box.ls_tree(commit, lim["max_tree_entries"])
        return trees[commit]

    src = tree(source_commit)
    # T00 ----------------------------------------------------------------------
    bad_modes = sorted(p for p, e in src.items() if e.mode in profile.forbid_tree_modes)
    path_bad = sorted(p for p in src if path_issue(p))
    checks.set("T00", FAIL if bad_modes else PASS, "forbidden_mode" if bad_modes else "", entries=len(src), forbidden=_samples(bad_modes),
               path_notes=len(path_bad))
    # T01 support ----------------------------------------------------------------
    sup_spec = {e["path"]: e for e in spec["support"]}
    on_disk = {f.rel[len("support/"):]: f for f in by_rel.values() if f.rel.startswith("support/")}
    bytes_bad, tree_bad = [], []
    for p, e in sup_spec.items():
        f = on_disk.get(p)
        if f is not None and not (f.sha256 == e["sha256"] and f.size == e["size"] and f.blob == e["git_blob"]):
            bytes_bad.append(p)
        te = tree(e["binding_ref"]).get(p)
        if te is None or te.mode != "100644" or te.type != "blob" or te.oid != e["git_blob"]:
            tree_bad.append(p)
    ok = set(on_disk) == set(sup_spec) and not bytes_bad and not tree_bad
    checks.set("T01", PASS if ok else FAIL, "" if ok else "support_differs", files=len(on_disk), missing=_samples(list(set(sup_spec) - set(on_disk))),
               unexpected=_samples(list(set(on_disk) - set(sup_spec))), bytes_differ=_samples(bytes_bad), tree_differs=_samples(tree_bad))
    state["support_tree_sha256"] = tree_sha256((p, f.sha256) for p, f in on_disk.items())
    state["support_count"] = len(on_disk)
    # T02 history ----------------------------------------------------------------
    rec_bad: list[str] = []
    want: list[str] = []
    for e in spec["history"]:
        te = tree(e["ref"]).get(e["path"])
        if te is None or te.mode != e["mode"] or te.type != "blob" or te.oid != e["git_blob"]:
            rec_bad.append(f"{e['group']}:{e['path']}")
        else:
            want.append(te.oid)
    group_bad: list[str] = []
    group_oids: dict[str, str] = {}
    for g in spec["history_groups"]:
        te = tree(g["ref"]).get(g["manifest"]["path"])
        if te is None or te.type != "blob":
            group_bad.append(g["id"])
        else:
            group_oids[g["id"]] = te.oid
    blobs = box.read_blobs(want + list(group_oids.values()), lim["max_total_bytes"])
    sha_bad = [f"{e['group']}:{e['path']}" for e in spec["history"]
               if e["git_blob"] in blobs and sha256_bytes(blobs[e["git_blob"]]) != e["sha256"]]
    for g in spec["history_groups"]:
        oid = group_oids.get(g["id"])
        if oid is not None and (sha256_bytes(blobs[oid]) != g["manifest"]["sha256"] or len(blobs[oid]) != g["manifest"]["size"]):
            group_bad.append(g["id"])
    ok = not rec_bad and not sha_bad and not group_bad
    checks.set("T02", PASS if ok else FAIL, "" if ok else "history_differs", records=len(spec["history"]), groups=len(spec["history_groups"]),
               tree_differs=_samples(rec_bad), sha256_differs=_samples(sha_bad), groups_differ=sorted(set(group_bad)))
    del blobs
    # T03 source test files --------------------------------------------------------
    st_bad = []
    st_oids = {}
    for e in spec["source_test_files"]:
        te = src.get(e["path"])
        if te is None or te.mode != e["mode"] or te.type != "blob" or te.oid != e["git_blob"]:
            st_bad.append(e["path"])
        else:
            st_oids[e["path"]] = te.oid
    st_blobs = box.read_blobs(list(st_oids.values()), lim["max_total_bytes"])
    st_sha = {p: sha256_bytes(st_blobs[o]) for p, o in st_oids.items()}
    st_bad += [e["path"] for e in spec["source_test_files"] if e["path"] in st_sha and st_sha[e["path"]] != e["sha256"]]
    checks.set("T03", PASS if not st_bad else FAIL, "" if not st_bad else "source_tests_differ", files=len(spec["source_test_files"]), differ=_samples(st_bad))
    # T04 test links ---------------------------------------------------------------
    reg_paths = {r["path"] for r in spec["registered_files"]}
    meta_by_source = {m["source_path"]: by_rel["metadata/" + m["source_path"]] for m in profile.metadata}
    link_bad = []
    extra_src = {}
    for t in spec["tests"]:
        bp = t["binding_path"]
        actual = None
        if t["binding"] == "support":
            f = on_disk.get(bp)
            actual = f.sha256 if f is not None and bp in sup_spec else None
        elif t["binding"] == "source":
            if bp in st_sha:
                actual = st_sha[bp]
            else:
                te = src.get(bp)
                if te is not None and te.type == "blob":
                    extra_src[bp] = te.oid
                    continue
        else:  # registered: the logical alias resolves to the metadata file with the same source path (M2, NO_ZIP)
            f = meta_by_source.get(bp)
            actual = f.sha256 if f is not None and bp in reg_paths else None
        if actual != t["sha256"]:
            link_bad.append(t["path"])
    if extra_src:
        eb = box.read_blobs(list(extra_src.values()), lim["max_total_bytes"])
        for t in spec["tests"]:
            if t["binding"] == "source" and t["binding_path"] in extra_src and sha256_bytes(eb[extra_src[t["binding_path"]]]) != t["sha256"]:
                link_bad.append(t["path"])
    reg_bad = [r["path"] for r in spec["registered_files"] if r["path"] not in meta_by_source or meta_by_source[r["path"]].sha256 != r["sha256"]]
    ok = not link_bad and not reg_bad
    checks.set("T04", PASS if ok else FAIL, "" if ok else "links_differ", links=len(spec["tests"]), differ=_samples(link_bad), registered_differ=_samples(reg_bad))
    # T05 registered values -----------------------------------------------------------
    r_bad = []
    for r in profile.registered:
        actual = None
        if r["location"] == "support":
            f = on_disk.get(r["path"])
            actual = f.sha256 if f else None
        elif r["location"] == "metadata":
            f = meta_by_source.get(r["path"])
            actual = f.sha256 if f else None
        else:
            te = src.get(r["path"])
            if te is not None and te.type == "blob":
                actual = sha256_bytes(box.read_blobs([te.oid], lim["max_total_bytes"])[te.oid])
        if actual != r["sha256"]:
            r_bad.append(r["name"])
    checks.set("T05", PASS if not r_bad else FAIL, "" if not r_bad else "registered_differs", values=len(profile.registered), differ=sorted(r_bad))
    state["registered"] = [dict(r) for r in profile.registered]
    state["counts"] = {"history_records": len(spec["history"]), "history_groups": len(spec["history_groups"]), "tests": len(spec["tests"]),
                       "source_tests": len(spec["source_test_files"])}
    # I01..I04 installable part ---------------------------------------------------------
    _installable(box, profile, checks, state, src, installable)


def _installable(box: GitBox, profile: Profile, checks: _Checks, state: dict[str, Any], src: dict[str, TreeEntry],
                 installable: dict[str, list[tuple[str, str, bytes]]]) -> None:
    lim = profile.limits
    if not profile.installable_domains:
        for cid in ("I01", "I02", "I03", "I04"):
            checks.set(cid, NOT_APPLICABLE, "no_installable_domain_in_profile")
        state["installable"] = []
        return
    tree_bad: dict[str, list[str]] = {}
    per_domain: dict[str, dict[str, TreeEntry]] = {}
    for d in profile.installable_domains:
        prefix = f"custom_components/{d}/"
        entries = {p[len(prefix):]: e for p, e in src.items() if p.startswith(prefix)}
        per_domain[d] = entries
        if not entries:
            tree_bad.setdefault("domain_missing", []).append(d)
            continue
        for rel, e in entries.items():
            if e.type != "blob" or e.mode != "100644":
                tree_bad.setdefault("mode_not_100644", []).append(f"{d}/{rel}")
            elif path_issue(rel):
                tree_bad.setdefault("path", []).append(f"{d}/{rel}")
        if casefold_collisions(entries):
            tree_bad.setdefault("case_collision", []).append(d)
        if "manifest.json" not in entries:
            tree_bad.setdefault("manifest_missing", []).append(d)
    checks.set("I01", FAIL if tree_bad else PASS, "installable_tree" if tree_bad else "", domains=list(profile.installable_domains),
               issues={k: _samples(v) for k, v in tree_bad.items()})
    if tree_bad:
        return
    count = sum(len(e) for e in per_domain.values())
    if count > lim["max_installable_files"]:
        checks.set("I02", FAIL, "too_many_files", files=count)
        return
    try:
        blobs = box.read_blobs([e.oid for es in per_domain.values() for e in es.values()], lim["max_installable_bytes"])
    except GitBoxError as exc:
        checks.set("I02", FAIL, exc.code, files=count)
        return
    big = [f"{d}/{rel}" for d, es in per_domain.items() for rel, e in es.items() if len(blobs[e.oid]) > lim["max_installable_file_bytes"]]
    total = sum(len(blobs[e.oid]) for es in per_domain.values() for e in es.values())
    checks.set("I02", FAIL if big else PASS, "file_over_cap" if big else "", files=count, total_bytes=total, over=_samples(big))
    if big:
        return
    m_bad: dict[str, str] = {}
    versions: dict[str, str] = {}
    for d, es in per_domain.items():
        try:
            mf = load_json_strict(blobs[es["manifest.json"].oid])
        except StrictJsonError as exc:
            m_bad[d] = f"json:{exc}"
            continue
        if not isinstance(mf, dict) or mf.get("domain") != d:
            m_bad[d] = "domain_mismatch"
        elif parse_semver(mf.get("version")) is None:
            m_bad[d] = "version_format"
        elif profile.source_version is not None and mf.get("version") != profile.source_version:
            m_bad[d] = "version_differs_from_profile"
        else:
            versions[d] = mf["version"]
    checks.set("I03", FAIL if m_bad else PASS, "manifest" if m_bad else "", problems=m_bad, versions=versions)
    names = [f"{d}/{rel}:{why}" for d, es in per_domain.items() for rel in es for why in [name_issue(rel)] if why]
    hits = scan_files((f"custom_components/{d}/{rel}", e.oid, blobs[e.oid]) for d, es in per_domain.items() for rel, e in es.items())
    clean = not names and not hits
    checks.set("I04", PASS if clean else FAIL, "" if clean else "forbidden_content", forbidden_names=_samples(names), findings=hits[:200],
               findings_total=len(hits))
    if not checks.ok("I03", "I04"):
        return
    out = []
    for d, es in per_domain.items():
        files = sorted((rel, e.mode, blobs[e.oid], e.oid) for rel, e in es.items())
        installable[d] = [(rel, mode, data) for rel, mode, data, _ in files]
        out.append({
            "domain": d, "version": versions[d], "file_count": len(files), "total_bytes": sum(len(x[2]) for x in files),
            "tree_sha256": tree_sha256((rel, sha256_bytes(data)) for rel, _m, data, _o in files),
            "files": [{"path": rel, "mode": mode, "size": len(data), "sha256": sha256_bytes(data), "git_blob": oid} for rel, mode, data, oid in files],
        })
        if any(git_blob_id(data) != oid for _r, _m, data, oid in files):  # cat-file returned other bytes than the id names: never install
            checks.set("I02", FAIL, "blob_id_mismatch")
            installable.clear()
            return
    state["installable"] = out


def _manifest(name: str, profile: Profile, state: dict[str, Any]) -> dict[str, Any]:
    """Arx's own import manifest: deterministic (no timestamps, no machine data), built only after every check passed."""
    files: dict[str, FileInfo] = state["files"]
    return {
        "schema": MANIFEST_SCHEMA,
        "package": name,
        "profile": {"id": profile.id, "sha256": profile.sha256, "kind": profile.kind},
        "source": {"ref": profile.source_ref, "commit": profile.refs[profile.source_ref], "version": profile.source_version,
                   "tests_manifest_version": profile.tests_manifest_version},
        "refs": dict(sorted(profile.refs.items())),
        "bundle": {**state["bundle"], "format": 2, "object_format": "sha1", "prerequisites": []},
        "transport": {"package_manifest_sha256": state.get("package_manifest_sha256"), "sha256sums_sha256": state.get("sha256sums_sha256"),
                      "note": "WisKey transport files prove completeness only; every decision used the profile"},
        "metadata": [{"role": m["role"], "delivery_path": "metadata/" + m["source_path"], "source_path": m["source_path"],
                      "size": files["metadata/" + m["source_path"]].size, "sha256": files["metadata/" + m["source_path"]].sha256,
                      "git_blob": files["metadata/" + m["source_path"]].blob, "source_commit": m["source_commit"]} for m in profile.metadata],
        "support": {"count": state["support_count"], "tree_sha256": state["support_tree_sha256"]},
        "counts": state["counts"],
        "registered": state["registered"],
        "installable": state.get("installable", []),
        "install_ready": profile.installable,
        "status": {"profile": "unsigned_for_test", "signature": None, "release": False, "ready": False, "receipt": False},
        "executed_imported_code": False,
    }
