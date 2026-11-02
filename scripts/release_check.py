#!/usr/bin/env python3
"""Release consistency check for the SMPLWISE VMS add-on (T072).

Verifies what a release must get right before the owner signs it: one version everywhere (config.yaml, Dockerfile
label, backend __version__, CHANGELOG head, API inventory), the bridge integration's two copies identical and
their version consistent (manifest + const), a contiguous migration sequence, the built UI present in the add-on,
the release package document and the known-limits sources present, the Supervisor build inputs (base image by tag,
the HA python base per arch, pip/python steps on a python stage, arch lists, image labels), and whether a git tag already exists for the
version. Prints a checklist; exits 1 when a check fails. With --tag it prints the tag commands to run after the
owner's approval (it never creates the tag itself).

Usage: python scripts/release_check.py [--root .] [--json out.json] [--tag]
"""
from __future__ import annotations

import argparse
import filecmp
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def find(pattern: str, text: str) -> str | None:
    m = re.search(pattern, text, re.M)
    return m.group(1) if m else None


def dir_identical(a: Path, b: Path) -> tuple[bool, list[str]]:
    diffs: list[str] = []

    def walk(x: Path, y: Path, rel: str) -> None:
        cmp = filecmp.dircmp(x, y, ignore=["__pycache__"])
        for name in cmp.left_only + cmp.right_only:
            diffs.append(f"{rel}{name} (only on one side)")
        for name in cmp.diff_files:
            diffs.append(f"{rel}{name} (differs)")
        for name, sub in cmp.subdirs.items():
            walk(Path(sub.left), Path(sub.right), f"{rel}{name}/")

    if not a.is_dir() or not b.is_dir():
        return False, ["missing copy"]
    walk(a, b, "")
    return not diffs, diffs


# SUPERVISOR-BUILD-GATE-2341: the add-on image must build the way the HA Supervisor builds it. 2.31.0 pinned BUILD_FROM /
# build.yaml to name:tag@sha256:... and the Supervisor build ran on an image without Python ("pip install ... exit code 127").
HA_PY_BASE = re.compile(r"^ghcr\.io/home-assistant/(?P<arch>[a-z0-9]+)-base-python:(?P<tag>\d+\.\d+-alpine\d+\.\d+)$")
PY_CMD = re.compile(r"(?<![\w./-])(pip3?|python3?(\.\d+)?)(?![\w-])")
PY_INSTALL = re.compile(r"\b(apk\s+add|apt-get\s+install)\b[^&;|]*\b(python3|py3-pip)\b")


def parse_build_from(text: str) -> dict[str, str]:
    """build.yaml `build_from:` mapping {arch: image} (stdlib only: the gate runs this without PyYAML)."""
    out: dict[str, str] = {}
    inside = False
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip() if not raw.lstrip().startswith("#") else ""
        if not line:
            continue
        if not line.startswith((" ", "\t")):
            inside = line.strip() == "build_from:"
            continue
        m = re.match(r"^\s+([A-Za-z0-9_]+):\s*['\"]?([^'\"\s]+)['\"]?\s*$", line) if inside else None
        if m:
            out[m.group(1)] = m.group(2)
    return out


def parse_arch_list(text: str) -> list[str]:
    """config.yaml `arch:` list (block form `- amd64` or flow form `[amd64, aarch64]`)."""
    lines = text.splitlines()
    for i, raw in enumerate(lines):
        m = re.match(r"^arch:\s*(.*)$", raw)
        if not m:
            continue
        rest = m.group(1).split("#", 1)[0].strip()
        if rest.startswith("["):
            return [a.strip().strip("'\"") for a in rest.strip("[]").split(",") if a.strip()]
        out = []
        for nxt in lines[i + 1:]:
            mm = re.match(r"^\s*-\s*['\"]?([A-Za-z0-9_]+)['\"]?\s*(#.*)?$", nxt)
            if mm:
                out.append(mm.group(1))
            elif nxt.strip() and not nxt.lstrip().startswith("#"):
                break
        return out
    return []


def dockerfile_instructions(text: str) -> list[tuple[str, str]]:
    """[(INSTRUCTION, arguments)] with comments dropped and backslash continuations joined."""
    out: list[tuple[str, str]] = []
    buf = ""
    for raw in text.splitlines():
        s = raw.strip()
        if not buf and (not s or s.startswith("#")):
            continue
        if buf and s.startswith("#"):
            continue
        if s.endswith("\\"):
            buf += s[:-1] + " "
            continue
        buf += s
        if buf.strip():
            parts = buf.strip().split(None, 1)
            out.append((parts[0].upper(), parts[1] if len(parts) > 1 else ""))
        buf = ""
    if buf.strip():
        parts = buf.strip().split(None, 1)
        out.append((parts[0].upper(), parts[1] if len(parts) > 1 else ""))
    return out


KV_KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_.\-]*$")
ARG_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _split_words(text: str) -> tuple[list[str], list[str]]:
    """Split an instruction's arguments on unquoted whitespace (quotes kept in the words). Returns (words, escapes): `escapes`
    lists every backslash escape found OUTSIDE quotes (e.g. a literal "\n" that the author meant as a newline)."""
    words: list[str] = []
    escapes: list[str] = []
    cur, quote, i = "", "", 0
    while i < len(text):
        c = text[i]
        if quote:
            cur += c
            if c == "\\" and quote == '"' and i + 1 < len(text):
                cur += text[i + 1]
                i += 1
            elif c == quote:
                quote = ""
        elif c in "\"'":
            quote = c
            cur += c
        elif c == "\\" and i + 1 < len(text):
            escapes.append("\\" + text[i + 1])
            cur += c + text[i + 1]
            i += 1
        elif c.isspace():
            if cur:
                words.append(cur)
            cur = ""
        else:
            cur += c
        i += 1
    if cur:
        words.append(cur)
    return words, escapes


def dockerfile_syntax_problems(text: str) -> list[str]:
    """Static Dockerfile syntax rules the Supervisor's builder enforces (SUPERVISOR-BUILD-GATE-2341, the 2.33.2 incident: an ENV
    block with a literal backslash-n, `Syntax error - can't find = in "\\n"`):
    - a continuation backslash is the last character of its line (no spaces or tabs after it), and a lone backslash in the
      middle of a line is not a continuation;
    - ENV / LABEL / ARG: no backslash escape sequences (backslash-n, backslash-t, ...) outside quotes;
    - ENV / LABEL: every word is key=value, except the legacy `ENV key value` form (first word without '=': exactly one key);
      ARG: every word is NAME or NAME=default."""
    probs: list[str] = []
    lines = text.splitlines()
    for n, raw in enumerate(lines, 1):
        if raw.lstrip().startswith("#"):
            continue
        if re.search(r"\\[ \t]+$", raw):
            probs.append(f"line {n}: spaces after the continuation backslash")
        if re.search(r"(?<=\s)\\(?=[ \t]+\S)", raw):
            probs.append(f"line {n}: a backslash in the middle of the line (a continuation must be the line's last character)")
    # instructions with their first line number; continuations joined (a trailing backslash with spaces still joins, as above)
    buf, start = "", 0
    instrs: list[tuple[int, str]] = []
    for n, raw in enumerate(lines, 1):
        st = raw.strip()
        if not buf and (not st or st.startswith("#")):
            continue
        if buf and st.startswith("#"):
            continue
        if not buf:
            start = n
        if re.search(r"\\[ \t]*$", raw):
            buf += re.sub(r"\\[ \t]*$", "", raw.rstrip()) + " "
            continue
        buf += raw
        instrs.append((start, buf.strip()))
        buf = ""
    if buf.strip():
        instrs.append((start, buf.strip()))
        probs.append(f"line {start}: the file ends inside a continuation")
    for n, ins in instrs:
        parts = ins.split(None, 1)
        kw, rest = parts[0].upper(), (parts[1] if len(parts) > 1 else "")
        if kw not in ("ENV", "LABEL", "ARG"):
            continue
        words, escapes = _split_words(rest)
        if escapes:
            probs.append(f"line {n}: {kw} has escape sequence(s) outside quotes: {' '.join(sorted(set(escapes)))}")
        if not words:
            probs.append(f"line {n}: {kw} without arguments")
            continue
        if kw == "ENV" and "=" not in words[0]:
            if not KV_KEY.match(words[0]) or len(words) < 2:
                probs.append(f"line {n}: legacy `ENV key value` needs one valid key and a value: {ins[:80]}")
            continue
        for w in words:
            if kw == "ARG":
                ok = ARG_NAME.match(w.split("=", 1)[0]) is not None
            else:
                key = w.split("=", 1)[0].strip("\"'")
                ok = "=" in w and KV_KEY.match(key) is not None
            if not ok:
                probs.append(f"line {n}: {kw} word {w!r} is not {'NAME[=default]' if kw == 'ARG' else 'key=value'}")
    return probs


def supervisor_build_checks(addon: Path) -> list[tuple[str, bool, str]]:
    """Static rules for the Supervisor build (fast, no Docker): the base image by tag, the HA python base per arch, the
    pip/python steps on a stage with Python, config.yaml arch = build.yaml, image labels = config.yaml."""
    res: list[tuple[str, bool, str]] = []
    df_text, by_text, cfg_text = read(addon / "Dockerfile"), read(addon / "build.yaml"), read(addon / "config.yaml")
    ins = dockerfile_instructions(df_text)
    build_from = parse_build_from(by_text)
    archs = parse_arch_list(cfg_text)
    cfg_v = find(r'^version:\s*"([^"]+)"', cfg_text)
    args: dict[str, str] = {}
    for k, a in ins:
        if k == "FROM":
            break
        if k == "ARG":
            m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(\S+)", a)
            if m:
                args[m.group(1)] = m.group(2).strip("'\"")
    df_default = args.get("BUILD_FROM")

    # 1. tag form everywhere: no @sha256 digest pin (the 2.31.0 failure)
    refs = ([("Dockerfile ARG BUILD_FROM", df_default)] if df_default else []) + [(f"build.yaml {k}", v) for k, v in build_from.items()]
    refs += [("Dockerfile FROM", a.split()[0]) for k, a in ins if k == "FROM" and "@" in a]
    pinned = [f"{n}={v}" for n, v in refs if v and "@" in v]
    res.append(("add-on base image by tag (no @sha256 digest pin)", bool(refs) and not pinned,
                "; ".join(pinned) + " - the Supervisor build broke on this in 2.31.0 (pip exit 127); use name:tag" if pinned
                else (", ".join(f"{n}={v}" for n, v in refs) if refs else "no BUILD_FROM in the Dockerfile and no build.yaml build_from")))

    # 2. the HA python base for each arch; the Dockerfile default is build.yaml's amd64 (newer Supervisors read the Dockerfile)
    bad = []
    for a, img in build_from.items():
        m = HA_PY_BASE.match(img)
        if not m or m.group("arch") != a:
            bad.append(f"{a}: {img} (expected ghcr.io/home-assistant/{a}-base-python:<py>-alpine<ver>)")
    tags = {HA_PY_BASE.match(i).group("tag") for i in build_from.values() if HA_PY_BASE.match(i)}
    if len(tags) > 1:
        bad.append(f"arches use different python/alpine tags: {sorted(tags)}")
    if df_default is None or df_default != build_from.get("amd64"):
        bad.append(f"Dockerfile ARG BUILD_FROM={df_default} != build.yaml amd64={build_from.get('amd64')}")
    res.append(("add-on base image is the HA python base for each arch", bool(build_from) and not bad,
                "; ".join(bad) if bad else ", ".join(f"{a}={i}" for a, i in build_from.items())))

    # 3. every RUN that calls pip/python runs on a stage that has Python (the HA python base, a stage built on one, or an install step)
    stages: dict[str, bool] = {}
    has_py = False
    cur: str | None = None
    offenders: list[str] = []
    nrun = 0
    for k, a in ins:
        if k == "FROM":
            words = a.split()
            img = words[0] if words else ""
            m = re.fullmatch(r"\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?", img)
            img = args.get(m.group(1), "") if m else img
            has_py = bool(HA_PY_BASE.match(img)) or stages.get(img.lower(), False)
            if len(words) >= 3 and words[1].upper() == "AS":
                stages[words[2].lower()] = has_py   # updated below as the stage installs python
                cur = words[2].lower()
            else:
                cur = None
            continue
        if k == "RUN":
            if PY_INSTALL.search(a):
                has_py = True
                if cur:
                    stages[cur] = True
            if PY_CMD.search(a):
                nrun += 1
                if not has_py:
                    offenders.append(a[:90])
    res.append(("pip/python RUN steps run on a stage with Python", not offenders and any(k == "FROM" for k, _ in ins),
                "; ".join(offenders) + " - the stage's base is not a tag-form HA python base" if offenders
                else f"{nrun} pip/python RUN step(s), each on a python stage"))

    # 4. config.yaml arch list = build.yaml build_from keys
    same = bool(archs) and sorted(archs) == sorted(build_from)
    res.append(("config.yaml arch list = build.yaml build_from", same, f"config.yaml={archs}, build.yaml={sorted(build_from)}"))

    # 6. Dockerfile syntax (the 2.33.2 incident: a literal \n in the ENV block)
    probs = dockerfile_syntax_problems(df_text) if df_text else ["no Dockerfile"]
    res.append(("Dockerfile syntax (ENV/LABEL/ARG key=value, continuations)", not probs,
                "; ".join(probs[:6]) + (f" (+{len(probs) - 6} more)" if len(probs) > 6 else "") if probs
                else f"{len(ins)} instructions; ENV/LABEL/ARG words are key=value, continuations end their lines"))

    # 5. the image labels: io.hass.version = config.yaml version, io.hass.arch = config.yaml arch list
    labels = " ".join(a for k, a in ins if k == "LABEL")
    lv = find(r'io\.hass\.version="([^"]+)"', labels)
    la = find(r'io\.hass\.arch="([^"]+)"', labels)
    larch = sorted(la.split("|")) if la else []
    ok = cfg_v is not None and lv == cfg_v and (la is None or larch == sorted(archs))
    res.append(("image LABEL version and arch = config.yaml", ok, f"LABEL io.hass.version={lv} io.hass.arch={la}; config.yaml version={cfg_v} arch={archs}"))
    return res


def git_tags(root: Path) -> list[str]:
    try:
        out = subprocess.run(["git", "tag", "--list"], cwd=root, capture_output=True, text=True, timeout=20)
        return [t.strip() for t in out.stdout.splitlines() if t.strip()]
    except (OSError, subprocess.SubprocessError):
        return []


def run_checks(root: Path) -> dict[str, Any]:
    addon = root / "smplwise_vms"
    checks: list[dict[str, Any]] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"name": name, "ok": bool(ok), "detail": detail})

    cfg_v = find(r'^version:\s*"([^"]+)"', read(addon / "config.yaml"))
    docker_v = find(r'io\.hass\.version="([^"]+)"', read(addon / "Dockerfile"))
    py_v = find(r'^__version__\s*=\s*"([^"]+)"', read(addon / "backend" / "smplwise" / "__init__.py"))
    ch_v = find(r"^## (\d+\.\d+\.\d+)", read(addon / "CHANGELOG.md"))
    inv_v = find(r"^Version (\d+\.\d+\.\d+)", read(root / "contracts" / "API_INVENTORY.md"))
    versions = {"config.yaml": cfg_v, "Dockerfile": docker_v, "__init__.py": py_v, "CHANGELOG head": ch_v, "API inventory": inv_v}
    same = cfg_v is not None and all(v == cfg_v for v in versions.values())
    check("one version everywhere", same, ", ".join(f"{k}={v}" for k, v in versions.items()))

    b1 = root / "custom_components" / "smplwise_bridge"
    b2 = addon / "integration" / "smplwise_bridge"
    ident, diffs = dir_identical(b1, b2)
    check("bridge integration copies identical", ident, "identical" if ident else "; ".join(diffs[:6]))
    man_v = None
    try:
        man_v = json.loads(read(b1 / "manifest.json")).get("version")
    except ValueError:
        pass
    const_v = find(r'^VERSION\s*=\s*"([^"]+)"', read(b1 / "const.py"))
    check("bridge version consistent (manifest = const)", bool(man_v) and man_v == const_v, f"manifest={man_v}, const={const_v}")

    # the bridge must be at least the version the add-on needs for its newest allow-listed services (ha_bridge.BRIDGE_EQUIPMENT_REQUIRED, bridge 0.8.0)
    req_v = find(r'^BRIDGE_EQUIPMENT_REQUIRED\s*=\s*"([^"]+)"', read(addon / "backend" / "smplwise" / "services" / "ha_bridge.py"))
    as_t = lambda v: tuple(int(x) for x in re.findall(r"\d+", v or ""))  # noqa: E731
    check("bridge version covers the equipment-card allow-list", bool(man_v and req_v) and as_t(man_v) >= as_t(req_v), f"bridge={man_v}, required by the add-on={req_v}")

    mig = sorted(p.name for p in (addon / "backend" / "smplwise" / "migrations").glob("*.sql"))
    nums = [int(n[:4]) for n in mig if n[:4].isdigit()]
    contiguous = nums == list(range(1, len(nums) + 1)) and bool(nums)
    check("migrations contiguous", contiguous, f"{len(mig)} files, last {mig[-1] if mig else '—'}")

    www = addon / "www"
    built = (www / "index.html").exists() and any((www / "assets").glob("index-*.js")) if (www / "assets").exists() else False
    check("built UI present in the add-on (www)", built, str(www))
    # CR-038 S4: the handler page's own bundle (the Dockerfile copies it; npm run build:addon builds it next to www)
    pub = addon / "www-public"
    pub_built = (pub / "index.html").exists() and any((pub / "assets").glob("public-ticket-*.js")) if (pub / "assets").exists() else False
    check("handler page bundle present in the add-on (www-public)", pub_built, str(pub))

    # the bundled release APK (owner decision 2026-10-06): optional; when staged it must be valid, and no APK or signing key may be tracked
    dl = addon / "downloads"
    apk, side = dl / "SmplWiseArx.apk", dl / "SmplWiseArx.apk.json"
    if apk.exists() or side.exists():
        ok, detail = False, "APK and sidecar must both exist and be readable (run scripts/stage_apk.py)"
        try:
            meta = json.loads(side.read_text(encoding="utf-8"))
            digest = hashlib.sha256(apk.read_bytes()).hexdigest()
            ok = (meta.get("applicationId") == "com.smplwise.arx.app" and bool(meta.get("version"))
                  and meta.get("sha256", digest) == digest and 0 < apk.stat().st_size <= 200 * 1024 * 1024)
            detail = f"version {meta.get('version')}, sha256 {digest[:12]}..., {apk.stat().st_size} bytes" if ok else "sidecar/file mismatch (run scripts/stage_apk.py)"
        except (OSError, ValueError, AttributeError):
            pass
        check("bundled APK staged and valid", ok, detail)
    else:
        check("bundled APK staged and valid", True, "none staged: the login offer stays off unless an administrator saves a download address")
    try:
        tracked = subprocess.run(["git", "-C", str(root), "ls-files", "*.apk", "*.aab", "*.jks", "*.keystore", "smplwise_vms/downloads"],
                                 capture_output=True, text=True, timeout=20).stdout.split()
    except (OSError, subprocess.SubprocessError):
        tracked = []
    bad = [t for t in tracked if not t.endswith("downloads/README.txt")]
    check("no APK or signing key tracked in git", not bad, ", ".join(bad) if bad else "none")

    for name, ok, detail in supervisor_build_checks(addon):   # SUPERVISOR-BUILD-GATE-2341 (the 2.31.0 digest pin)
        check(name, ok, detail)

    pkg = root / "docs" / "release" / "RELEASE_PACKAGE_V1.md"
    check("release package document present", pkg.exists(), str(pkg))
    limits = [root / "docs" / "operations" / "RESOURCE_BUDGET.md", root / "docs" / "operations" / "LIVE_REVIEW_2026-09-17_HE.md", addon / "DOCS.md"]
    check("known-limits sources present", all(p.exists() for p in limits), ", ".join(p.name for p in limits))

    tags = git_tags(root)
    tag = f"v{cfg_v}" if cfg_v else None
    check("git tag for this version", tag in tags if tag else False, f"{tag} {'exists' if tag in tags else 'not yet (created after the owner approves)'}")
    tests = root / "smplwise_vms" / "backend" / "tests"
    check("backend tests present", tests.is_dir() and len(list(tests.glob("test_*.py"))) > 30, f"{len(list(tests.glob('test_*.py')))} test files")

    required_ok = all(c["ok"] for c in checks if c["name"] != "git tag for this version")
    return {"version": cfg_v, "checks": checks, "ok": required_ok, "tag": tag, "tag_exists": tag in tags if tag else False}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument("--json", help="write the checklist as JSON here")
    ap.add_argument("--tag", action="store_true", help="print the tag commands to run after approval")
    args = ap.parse_args(argv)
    root = Path(args.root)
    res = run_checks(root)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except AttributeError:
        pass
    print(f"Release check — SmplWise Arx {res['version']}")
    for c in res["checks"]:
        print(f"  [{'ok' if c['ok'] else 'FAIL'}] {c['name']}: {c['detail']}")
    print("RESULT:", "ready for the owner's approval" if res["ok"] else "NOT ready")
    if args.tag and res["tag"]:
        print(f"\nAfter approval:\n  git tag -a {res['tag']} -m \"SmplWise Arx {res['version']} — approved release\"\n  git push origin {res['tag']}")
    if args.json:
        Path(args.json).write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
