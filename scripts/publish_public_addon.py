"""Build the PUBLIC add-on repository tree from a release tag of the private development repository.

The public repository holds only what Home Assistant users need to add the store and install SmplWise Arx:
`repository.yaml`, the add-on folder `smplwise_vms/` (only the files its Dockerfile copies, plus the add-on's own
README / DOCS / CHANGELOG / LICENSE), the bridge integration for the manual HACS path (`custom_components/smplwise_bridge`
+ `hacs.json`), and the root `LICENSE`, `THIRD_PARTY_NOTICES.md`, `.gitattributes` and a short generated `README.md`.
Plan: docs/operations/PRIVATE_REPO_PLAN.md.

The tree is read from git objects of the ref (never from the working tree), so uncommitted or ignored files can never
leak. Selection is an ALLOW-list; on top of it a DENY-list refuses the run outright (exit 3) if a selected path is under
private/, secrets/, private-evidence/, legacy/, any tests/ or fixtures/ folder, or looks like a key / env file, and a
content scan refuses PEM private keys and (with --forbid-env) any value of a local env file. Private-range IPv4 literals
are reported as warnings (errors with --strict) - the backend has legitimate SSRF-guard ranges, so a human reviews them.

Usage:
  python scripts/publish_public_addon.py --ref v2.40.6 --dry-run            # list the files, scan, write nothing
  python scripts/publish_public_addon.py --ref v2.40.6 --out ../smplwise-public
  python scripts/publish_public_addon.py --ref origin/main --allow-untagged --dry-run   # a check of a non-release ref

--out may be an empty folder or an existing clone of the public repository: everything except `.git/` is replaced, so the
lead reviews `git status` / `git diff --stat` there, commits "release: X.Y.Z" and pushes. Nothing here runs git push.
Exit codes: 0 ok, 2 usage / ref / version problem, 3 refused (private path or secret content).
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
ADDON = "smplwise_vms"
DEFAULT_PUBLIC_URL = "https://github.com/jonioliel/smplwise-bms"

# --- allow-list (paths relative to the repository root, POSIX) ---------------------------------------------------------
# Single files copied verbatim when present at the ref.
ALLOW_FILES = [
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    ".gitattributes",
    "hacs.json",
    f"{ADDON}/config.yaml",
    f"{ADDON}/build.yaml",
    f"{ADDON}/Dockerfile",
    f"{ADDON}/run.sh",
    f"{ADDON}/CHANGELOG.md",
    f"{ADDON}/DOCS.md",
    f"{ADDON}/DOCS_HE.md",
    f"{ADDON}/README.md",
    f"{ADDON}/README_HE.md",
    f"{ADDON}/LICENSE",
    f"{ADDON}/icon.png",
    f"{ADDON}/logo.png",
    f"{ADDON}/backend/requirements.txt",
    f"{ADDON}/downloads/README.txt",
]
# Folders copied recursively (what the Dockerfile COPYs, and the HACS integration).
ALLOW_DIRS = [
    f"{ADDON}/backend/smplwise",
    f"{ADDON}/www",
    f"{ADDON}/www-public",
    f"{ADDON}/integration",
    f"{ADDON}/translations",
    "custom_components/smplwise_bridge",
]
# Files rewritten or generated for the public tree.
GENERATED = ["repository.yaml", "README.md"]
# Never published even inside an allowed folder.
SKIP_GLOBS = ["*/__pycache__/*", "*.pyc", "*.pyo", ".DS_Store", "*/.DS_Store", "*.orig", "*.rej", "*.bak", "*.bak-*"]
SOURCE_MAP_GLOB = "*.map"

# --- deny-list: a selected path matching any of these refuses the whole run -----------------------------------------
DENY_PREFIXES = ("private/", "secrets/", "private-evidence/", "legacy/", "management/", "prompts/", "docs/", "scripts/",
                 "frontend/", "mobile/", "services/", "contracts/", "templates/", ".claude/", ".github/")
DENY_SEGMENTS = {"tests", "test", "fixtures", "private", "secrets", "private-evidence", ".venv", "node_modules", "data"}
DENY_NAME_GLOBS = [".env", ".env.*", "*.env", "lab.env", "*.pem", "*.key", "*.p12", "*.pfx", "*.jks", "*.keystore",
                   "id_rsa*", "id_ed25519*", "*.apk", "*.sqlite", "*.sqlite3", "*.db", "MODEL_POLICY.json"]

PEM_PRIVATE = re.compile(rb"-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{40,}")
IPV4 = re.compile(rb"(?<![0-9.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![0-9.])")
# Known-benign private-range literals: the Supervisor's internal network (172.30.32.0/23, its gateway .1, the Supervisor .2,
# the add-on network 172.30.33.0), Tailscale's MagicDNS 100.100.100.100 and the cloud metadata address 100.100.100.200. Network addresses (last octet 0) are range
# constants of the SSRF guards and are never reported.
BENIGN_IPV4 = {"172.30.32.1", "172.30.32.2", "100.100.100.100", "100.100.100.200"}

PUBLIC_README = """# SmplWise Arx - Home Assistant add-on repository

This repository is the installation source of the **SmplWise Arx** add-on for Home Assistant. It contains only the
installable add-on; development happens elsewhere.

## Install

1. In Home Assistant: Settings -> Add-ons (Apps) -> Add-on store -> menu (three dots) -> **Repositories**.
2. Paste `{url}` and press **Add**.
3. Install **SmplWise Arx**. The Supervisor builds the image locally (a few minutes on the first install).

Documentation: [`smplwise_vms/DOCS.md`](smplwise_vms/DOCS.md) (Hebrew: [`smplwise_vms/DOCS_HE.md`](smplwise_vms/DOCS_HE.md)).
Release notes: [`smplwise_vms/CHANGELOG.md`](smplwise_vms/CHANGELOG.md).

Version {version}. All rights reserved - see [`LICENSE`](LICENSE); third-party components: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
"""


@dataclass
class Entry:
    path: str
    mode: str
    sha: str
    size: int


def git(*args: str, data: bytes | None = None) -> bytes:
    r = subprocess.run(["git", "-C", str(ROOT), *args], input=data, capture_output=True)
    if r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed: {r.stderr.decode(errors='replace').strip()}")
    return r.stdout


def list_tree(ref: str) -> dict[str, Entry]:
    out = git("ls-tree", "-r", "-l", "-z", ref)
    entries: dict[str, Entry] = {}
    for rec in out.split(b"\0"):
        if not rec:
            continue
        meta, path = rec.split(b"\t", 1)
        mode, _typ, sha, size = meta.split()
        p = path.decode("utf-8")
        entries[p] = Entry(p, mode.decode(), sha.decode(), int(size) if size != b"-" else 0)
    return entries


def read_blobs(shas: list[str]) -> dict[str, bytes]:
    """All blob contents in one `git cat-file --batch` call."""
    if not shas:
        return {}
    out = git("cat-file", "--batch", data=("\n".join(shas) + "\n").encode())
    blobs: dict[str, bytes] = {}
    i = 0
    for sha in shas:
        nl = out.index(b"\n", i)
        header = out[i:nl].split()
        size = int(header[2])
        blobs[sha] = out[nl + 1: nl + 1 + size]
        i = nl + 1 + size + 1
    return blobs


def skipped(path: str, keep_maps: bool) -> bool:
    if any(fnmatch.fnmatch(path, g) for g in SKIP_GLOBS):
        return True
    return not keep_maps and fnmatch.fnmatch(path, SOURCE_MAP_GLOB)


def select(entries: dict[str, Entry], keep_maps: bool) -> tuple[list[Entry], int]:
    chosen: list[Entry] = []
    n_skipped = 0
    for p, e in sorted(entries.items()):
        allowed = p in ALLOW_FILES or any(p.startswith(d + "/") for d in ALLOW_DIRS)
        if not allowed:
            continue
        if skipped(p, keep_maps):
            n_skipped += 1
            continue
        chosen.append(e)
    return chosen, n_skipped


def deny_reasons(e: Entry) -> list[str]:
    p = e.path
    why = []
    if p.startswith(DENY_PREFIXES):
        why.append("denied top-level folder")
    segs = PurePosixPath(p).parts[:-1]
    bad = DENY_SEGMENTS.intersection(segs)
    # `custom_components/smplwise_bridge/www` etc. are fine; only the listed folder names are refused
    if bad:
        why.append(f"denied folder name {sorted(bad)}")
    name = PurePosixPath(p).name
    if any(fnmatch.fnmatch(name, g) for g in DENY_NAME_GLOBS):
        why.append("denied file name (key / env / database / APK)")
    if e.mode == "120000":
        why.append("symbolic link")
    if e.mode == "160000":
        why.append("submodule")
    return why


def private_ipv4(blob: bytes) -> set[str]:
    hits = set()
    for m in IPV4.finditer(blob):
        a, b, c, d = (int(x) for x in m.groups())
        if max(a, b, c, d) > 255:
            continue
        if d == 0 or f"{a}.{b}.{c}.{d}" in BENIGN_IPV4:
            continue
        if a == 10 or (a == 172 and 16 <= b <= 31) or (a == 192 and b == 168) or (a == 100 and 64 <= b <= 127):
            hits.add(f"{a}.{b}.{c}.{d}")
    return hits


def load_forbidden(env_file: Path) -> dict[str, bytes]:
    """KEY=VALUE pairs of a local env file; only values of 6+ characters are compared. Values are never printed."""
    vals: dict[str, bytes] = {}
    for line in env_file.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        if len(v) >= 6:
            vals[k.strip()] = v.encode()
    return vals


def addon_version(blob: bytes) -> str | None:
    m = re.search(rb'(?m)^version:\s*"?([0-9][0-9A-Za-z.\-+]*)"?\s*$', blob)
    return m.group(1).decode() if m else None


def dockerfile_version(blob: bytes) -> str | None:
    m = re.search(rb'io\.hass\.version="([^"]+)"', blob)
    return m.group(1).decode() if m else None


def rewrite_repository_yaml(blob: bytes, url: str) -> bytes:
    text = blob.decode("utf-8")
    if re.search(r"(?m)^url:", text):
        text = re.sub(r"(?m)^url:.*$", f"url: {url}", text)
    else:
        text = text.rstrip("\n") + f"\nurl: {url}\n"
    return text.encode("utf-8")


def resolve_tag(ref: str) -> str | None:
    r = subprocess.run(["git", "-C", str(ROOT), "describe", "--tags", "--exact-match", "--match", "v[0-9]*", ref],
                       capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def write_tree(out: Path, files: dict[str, bytes], modes: dict[str, str]) -> None:
    out.mkdir(parents=True, exist_ok=True)
    for child in out.iterdir():  # keep .git of an existing public clone, replace everything else
        if child.name == ".git":
            continue
        shutil.rmtree(child) if child.is_dir() and not child.is_symlink() else child.unlink()
    for rel, data in files.items():
        dst = out / Path(*PurePosixPath(rel).parts)
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(data)
        if modes.get(rel) == "100755":
            dst.chmod(0o755)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ref", required=True, help="release tag (vX.Y.Z) or, with --allow-untagged, any commit-ish")
    ap.add_argument("--out", help="output folder (empty, or an existing clone of the public repository)")
    ap.add_argument("--dry-run", action="store_true", help="list the files and run the checks; write nothing")
    ap.add_argument("--public-url", default=DEFAULT_PUBLIC_URL, help=f"URL written into repository.yaml (default {DEFAULT_PUBLIC_URL})")
    ap.add_argument("--allow-untagged", action="store_true", help="accept a ref that is not exactly a v* tag (checks only)")
    ap.add_argument("--keep-source-maps", action="store_true", help="publish the UI *.map files (they embed the frontend source)")
    ap.add_argument("--no-hacs", action="store_true", help="leave out custom_components/ and hacs.json")
    ap.add_argument("--forbid-env", type=Path, help="local KEY=VALUE file; any value found in a published file refuses the run "
                                                     "(key names only are reported), e.g. secrets/lab.env")
    ap.add_argument("--strict", action="store_true", help="private-range IPv4 literals refuse the run instead of warning")
    ap.add_argument("--list", action="store_true", help="with --dry-run: print every published path")
    ap.add_argument("--json", type=Path, help="write the file list + checks as JSON to this path")
    a = ap.parse_args(argv)

    if not a.dry_run and not a.out:
        ap.error("--out is required unless --dry-run")
    if a.out:
        out = Path(a.out).resolve()
        if out == ROOT or ROOT in out.parents:
            ap.error("--out must be outside the development repository")

    commit = git("rev-parse", "--verify", f"{a.ref}^{{commit}}").decode().strip()
    tag = resolve_tag(a.ref)
    if not tag and not a.allow_untagged:
        print(f"refused: {a.ref} is not a release tag (v*); pass a tag, or --allow-untagged for a check run", file=sys.stderr)
        return 2

    entries = list_tree(commit)
    chosen, n_skip = select(entries, a.keep_source_maps)
    if a.no_hacs:
        chosen = [e for e in chosen if not (e.path.startswith("custom_components/") or e.path == "hacs.json")]

    errors: list[str] = []
    warnings: list[str] = []
    for e in chosen:
        for why in deny_reasons(e):
            errors.append(f"DENY {e.path}: {why}")

    blobs = read_blobs([e.sha for e in chosen] + ([entries["repository.yaml"].sha] if "repository.yaml" in entries else []))
    files: dict[str, bytes] = {e.path: blobs[e.sha] for e in chosen}
    modes = {e.path: e.mode for e in chosen}

    # version consistency: tag == config.yaml == Dockerfile label
    cfg = files.get(f"{ADDON}/config.yaml")
    dfile = files.get(f"{ADDON}/Dockerfile")
    if cfg is None or dfile is None:
        errors.append(f"MISSING {ADDON}/config.yaml or {ADDON}/Dockerfile at {a.ref}")
        version = "?"
    else:
        version = addon_version(cfg) or "?"
        dver = dockerfile_version(dfile)
        if dver != version:
            errors.append(f"VERSION config.yaml {version} != Dockerfile label {dver}")
        if tag and tag != f"v{version}":
            errors.append(f"VERSION tag {tag} != config.yaml {version}")
        if not tag:
            warnings.append(f"ref {a.ref} is not a release tag (check run only; publish from the v{version} tag)")

    if "repository.yaml" not in entries:
        errors.append("MISSING repository.yaml at the ref")
    else:
        files["repository.yaml"] = rewrite_repository_yaml(blobs[entries["repository.yaml"].sha], a.public_url)
    files["README.md"] = PUBLIC_README.format(url=a.public_url, version=version).encode("utf-8")

    # content checks
    forbidden = load_forbidden(a.forbid_env) if a.forbid_env else {}
    ip_hits: dict[str, set[str]] = {}
    for rel, data in files.items():
        if PEM_PRIVATE.search(data):
            errors.append(f"SECRET {rel}: PEM private key")
        for key, val in forbidden.items():
            if val in data:
                errors.append(f"SECRET {rel}: contains the value of {key}")
        hits = private_ipv4(data)
        if hits:
            ip_hits[rel] = hits
    for rel, hits in sorted(ip_hits.items()):
        msg = f"IPV4 {rel}: {len(hits)} private-range literal(s) - review"
        (errors if a.strict else warnings).append(msg)

    total = sum(len(d) for d in files.values())
    by_top: dict[str, int] = {}
    for rel in files:
        parts = PurePosixPath(rel).parts
        key = "/".join(parts[:2]) if len(parts) > 2 else rel
        by_top[key] = by_top.get(key, 0) + 1

    print(f"publish_public_addon: ref {a.ref} = {commit[:12]}{' (tag ' + tag + ')' if tag else ' (untagged)'}; add-on {version}")
    print(f"files: {len(files)} ({total / 1048576:.1f} MiB); skipped inside allowed folders: {n_skip}"
          f"{' (incl. source maps)' if not a.keep_source_maps else ''}; tracked at the ref: {len(entries)}")
    for k in sorted(by_top):
        print(f"  {by_top[k]:6d}  {k}")
    if a.list:
        for rel in sorted(files):
            print(f"    {rel}")
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    if forbidden:
        print(f"forbidden-value scan: {len(forbidden)} value(s) from {a.forbid_env.name} compared (values never printed)")

    if a.json:
        a.json.write_text(json.dumps({"ref": a.ref, "commit": commit, "tag": tag, "version": version, "count": len(files),
                                      "bytes": total, "files": sorted(files), "warnings": warnings, "errors": errors},
                                     indent=1), encoding="utf-8")

    if errors:
        print("RESULT: REFUSED - nothing written", file=sys.stderr)
        return 3
    if a.dry_run:
        print("RESULT: DRY-RUN OK - nothing written")
        return 0
    write_tree(out, files, modes)
    print(f"RESULT: written to {out}. Review there (git status / git diff --stat), commit 'release: {version}', tag v{version}, push.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
