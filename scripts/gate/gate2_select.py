#!/usr/bin/env python3
"""Gate v2 (GATE2-295): change-impact test selection for the release gate, with a hard-coded always-run core, narrowed hub
triggers, pixel specs only for UI changes, heavy sweeps deferred to the nightly, and a time estimate. docs/release/GATE_V2.md.

It sits ON TOP of select_tests.py (the GATESPEED-293 mapping: import closures, custom-element tags, API path segments, name
stems) and changes only the policy around it:
  * the always-run CORE (CORE_BACKEND / CORE_FRONTEND_GLOBS below, plus select_tests' smoke and security sets) runs every time;
  * a hub file no longer means "everything" when the change can be attributed (NARROWED below): main.py / body_limit.py lines map
    to the modules they name, an added migration maps to the tables it touches, roles.json to the permission ids it changes,
    the i18n string tables to the keys they change, shell/ and design/ to their own spec families;
  * hubs that cannot be attributed stay full-tier triggers (KEEP_FULL_* below: test infrastructure, the database core, the
    security core, the build configuration, shared fixtures);
  * pixel (toHaveScreenshot) specs run only when a frontend/src file changed and the spec is mapped to it (all of them when the
    design / styles layer changed);
  * a spec whose recorded cost is above GATE2_HEAVY_SECS (default 900 worker-seconds) is DEFERRED to the nightly full run unless
    the spec itself changed or a failed-test rerun names it;
  * --after <red gate report>: the failed tests' files of that report are added (the targeted re-run that replaces a full
    re-gate; base = the red gate's sha).

CLI (runs no test, starts no process, writes only --json):
  gate2_select.py plan   --root <checkout> --base <ref> [--head <ref>] [--after <gate.json>] [--costs <json>] [--json <out>]
  gate2_select.py select --root <checkout> --base <ref> [--head <ref>] [--after <gate.json>]   (selection JSON on stdout)
The engine reaches select_gate2() through the shim scripts/gate/gate2/select_tests.py (installed as ~/gate2/select_tests.py).
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
try:                                   # the runner's ~/gate2/ holds the v1 helper as select_tests_v1.py (the shim owns the name)
    import select_tests_v1 as st       # type: ignore
except ImportError:                    # repository / workstation: scripts/gate/select_tests.py
    import select_tests as st          # type: ignore

BE, FE = st.BE, st.FE
HEAVY_SECS = float(os.environ.get("GATE2_HEAVY_SECS", "900"))

# ---------------------------------------------------------------- the always-run core (hard-coded on purpose)
# Backend: start-up and upgrade, schema, backup, health, the release/doc checks, the route and permission sweeps, the gate
# tooling. Every security / permission suite comes on top (select_tests.SECURITY_RE), and select_tests.SMOKE_BACKEND.
CORE_BACKEND = [
    "test_migrations.py", "test_migrations_energy.py", "test_smoke_after_upgrade.py", "test_db_gate.py", "test_db_template.py",
    "test_backup.py", "test_health_summary.py", "test_health_report.py", "test_release_check.py", "test_version.py",
    "test_docs_config_consistency.py", "test_release_notes_marker.py", "test_gate_hygiene.py", "test_installation_capabilities.py",
    "test_api_inventory.py", "test_gate_speed.py", "test_select_tests.py", "test_gate2_select.py",
]
CORE_BACKEND_GLOBS = ["test_migration*.py", "test_*upgrade*.py", "test_roles*.py", "test_rbac*.py"]
# Frontend: every unit-* spec is NOT core in gate 2 (334 files, ~350 worker-min); the core is the shell, navigation, login and
# the cheap structural guards. Heavy files are still deferred unless they changed.
CORE_FRONTEND_GLOBS = ["evidence-nav*.spec.ts", "layout-shell*.spec.ts", "unit-nav*.spec.ts", "unit-shell*.spec.ts",
                       "unit-i18n*.spec.ts", "unit-router*.spec.ts", "unit-app*.spec.ts", "evidence-login*.spec.ts",
                       "unit-perm*.spec.ts", "unit-roles*.spec.ts", "unit-tabs-config.spec.ts"]

# ---------------------------------------------------------------- full-tier triggers that gate 2 KEEPS
KEEP_FULL_BACKEND = [
    r"^smplwise_vms/backend/smplwise/(db|config|errors|audit|__main__)\.py$",
    r"^smplwise_vms/backend/smplwise/(rbac|auth|capabilities|mode)\.py$",           # the security core: TEST_POLICY tier L
    r"^smplwise_vms/backend/smplwise/(routers|services)/__init__\.py$",
    r"^smplwise_vms/backend/tests/(conftest|db_template|hygiene)\.py$",
    r"^smplwise_vms/backend/(requirements[^/]*\.txt|pyproject\.toml|setup\.cfg|pytest\.ini)$",
]
KEEP_FULL_FRONTEND = [
    r"^frontend/(package(-lock)?\.json|vite\.config\.[a-z]+|tsconfig[^/]*\.json|playwright\.config\.[a-z]+|index\.html)$",
    r"^frontend/src/(main|router|vite-env\.d)\.ts$",
    r"^frontend/src/fixtures/",
    r"^frontend/tests/fixtures/",
    r"^frontend/tests/gate_tablet_allowlist\.json$",
]
# narrowed hubs (select_tests would run the whole side; gate 2 attributes the change)
NARROW_MAIN = re.compile(r"^smplwise_vms/backend/smplwise/(main|body_limit|__init__)\.py$")
NARROW_MIGRATION = re.compile(r"^smplwise_vms/backend/smplwise/migrations(_energy)?/[^/]+$")
NARROW_ROLES = re.compile(r"^smplwise_vms/backend/smplwise/roles\.json$")
NARROW_SHELL = re.compile(r"^frontend/src/shell/")
NARROW_DESIGN = re.compile(r"^frontend/src/(design/|styles/(tokens|base|global|theme|index|reset)[^/]*\.ts$)")
NARROW_I18N = re.compile(r"^frontend/src/i18n/(index|core|i18n|locale|strings|he|en)[^/]*\.ts$")
BUILD_ONLY = re.compile(r"^smplwise_vms/(Dockerfile|config\.yaml|build\.yaml|run\.sh)$")
SHELL_SPEC_RE = re.compile(r"nav|shell|menu|rail|header|topbar|tabs|home|breadcrumb|drawer|sidebar|mobile-bar|phone-bar", re.I)
DESIGN_SPEC_RE = re.compile(r"skin|theme|brand|palette|logo|design|look|glass|bubble|crystal|tesla|domus|classic|material|dark|visual", re.I)
PIXEL_EXTRA = {"visual-matrix.spec.ts"}


def git(root: Path, *args: str) -> str:
    return st.git(root, *args)


def _read(p: Path) -> str:
    return st._read(p)


def changed_hunks(root: Path, base: str, head: str, path: str) -> list[list[str]]:
    """The changed lines (added and removed texts) of one file in base...head, one list per diff hunk."""
    try:
        diff = git(root, "diff", "-U0", "--no-renames", f"{base}...{head}", "--", path)
    except subprocess.CalledProcessError:
        return []
    hunks: list[list[str]] = []
    for line in diff.splitlines():
        if line.startswith("@@"):
            hunks.append([])
        elif hunks and line[:1] in "+-" and not line.startswith(("+++", "---")):
            hunks[-1].append(line[1:])
    return [h for h in hunks if h]


def changed_line_text(root: Path, base: str, head: str, path: str) -> tuple[list[str], list[int]]:
    """(added+removed line texts, new-file line numbers of the added lines) of one file in base...head."""
    try:
        diff = git(root, "diff", "-U0", "--no-renames", f"{base}...{head}", "--", path)
    except subprocess.CalledProcessError:
        return [], []
    texts, nums, cur = [], [], 0
    for line in diff.splitlines():
        m = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", line)
        if m:
            cur = int(m.group(1))
            continue
        if line.startswith(("+++", "---")):
            continue
        if line.startswith("+"):
            texts.append(line[1:]); nums.append(cur); cur += 1
        elif line.startswith("-"):
            texts.append(line[1:])
    return texts, nums


def _code_lines(lines: list[str]) -> list[str]:
    return [l for l in lines if l.strip() and not l.strip().startswith("#")]


# ---------------------------------------------------------------- hub attribution
def py_aliases(text: str) -> dict[str, str]:
    """identifier -> smplwise module for `from .services import x as y`, `from .routers.z import router as zr`, `from . import m`."""
    out = {}
    for m in re.finditer(r"^\s*from\s+(\.[\w.]*)\s+import\s+(\([^)]*\)|[^\n#]+)", text, re.M | re.S):
        src = m.group(1)
        pkg = "smplwise" + ("" if src == "." else "." + src.lstrip("."))
        for part in m.group(2).strip("()").replace("\n", " ").split(","):
            part = part.strip()
            if not part:
                continue
            bits = part.split(" as ")
            name = bits[0].strip()
            alias = (bits[1] if len(bits) > 1 else bits[0]).strip()
            out[alias] = f"{pkg}.{name}"
            out.setdefault(name, f"{pkg}.{name}")
    return out


def _line_modules(l: str, aliases: dict, mods: dict) -> set[str]:
    hit = set()
    for ident in re.findall(r"[A-Za-z_]\w*", l):
        mod = aliases.get(ident)
        while mod and mod not in mods and "." in mod:
            mod = mod.rsplit(".", 1)[0]
        if mod and mod in mods and mod not in st.HUB_PY:
            hit.add(mod)
    for kind, dotted in re.findall(r"\b(services|routers)\.([\w.]+)", l):     # `from .services.notices import news_sources`
        cand = f"smplwise.{kind}.{dotted}"
        while cand and cand not in mods and "." in cand:
            cand = cand.rsplit(".", 1)[0]
        if cand in mods and cand not in st.HUB_PY:
            hit.add(cand)
    return hit


def attribute_py_hub(root: Path, base: str, head: str, path: str, mods: dict) -> tuple[set[str], list[str], set[str]]:
    """Modules named in the changed hunks of main.py / body_limit.py / __init__.py, the unattributed hunks (their first code
    line), the API path segments. A hunk counts as attributed when one of its lines names a module or an /api/v1/ path (a call
    spread over several lines is one hunk); a hunk of comments, blank lines or a version bump is ignored."""
    aliases = py_aliases(_read(root / path))
    found, orphans, segs = set(), [], set()
    for hunk in changed_hunks(root, base, head, path):
        code = [l for l in _code_lines(hunk) if not (st.VERSION_LINE.search(l) and re.search(r"__version__|version\s*=", l))]
        if not code:
            continue
        hit, hsegs = set(), set()
        for l in code:
            hit |= _line_modules(l, aliases, mods)
            hsegs |= set(re.findall(r"/api/v1/([a-z0-9_-]+)", l))
        if hit or hsegs:
            found |= hit
            segs |= hsegs
        else:
            orphans.append(code[0].strip()[:120])
    return found, orphans, segs


TABLE_RE = re.compile(r"\b(?:CREATE\s+(?:TABLE|INDEX|UNIQUE\s+INDEX|TRIGGER|VIEW)(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:\w+\s+ON\s+)?|"
                      r"ALTER\s+TABLE\s+|INSERT\s+(?:OR\s+\w+\s+)?INTO\s+|UPDATE\s+|DELETE\s+FROM\s+|DROP\s+(?:TABLE|INDEX)(?:\s+IF\s+EXISTS)?\s+)"
                      r"[\"`]?(\w+)", re.I)
INDEX_ON_RE = re.compile(r"\bON\s+[\"`]?(\w+)\s*\(", re.I)


def migration_tables(text: str) -> set[str]:
    names = set(TABLE_RE.findall(text)) | set(INDEX_ON_RE.findall(text))
    return {n for n in names if len(n) >= 4 and n.lower() not in ("table", "index", "exists", "into", "from", "temp")}


def _roles_doc(text: str) -> dict[str, set[str]]:
    try:
        d = json.loads(text)
    except ValueError:
        return {}
    return {r.get("id"): set(r.get("permissions") or []) for r in d.get("roles", []) if isinstance(r, dict) and r.get("id")}


def roles_delta(root: Path, base: str, path: str) -> dict:
    """Structural diff of roles.json: new / removed permission ids (in no role before / in no role now), new / removed / changed
    roles. A permission that only moved between roles changes no code path: it selects the role's tests, not the modules that
    check the permission. Returns {} when either side does not parse (the caller then runs the full tier)."""
    try:
        old = _roles_doc(git(root, "show", f"{base}:{path}"))
    except subprocess.CalledProcessError:
        old = {}
    new = _roles_doc(_read(root / path))
    if not new:
        return {}
    perms_old = set().union(*old.values()) if old else set()
    perms_new = set().union(*new.values())
    changed_roles = {r for r in set(old) | set(new) if old.get(r) != new.get(r)}
    return {"new_perms": perms_new - perms_old, "gone_perms": perms_old - perms_new, "roles": changed_roles}


def i18n_keys(root: Path, base: str, head: str, path: str) -> set[str]:
    """section.key of every changed leaf in he.ts / en.ts (the section = the nearest `  name: {` above the changed line)."""
    lines, nums = changed_line_text(root, base, head, path)
    new = _read(root / path).splitlines()
    keys = set()
    adds = {n for n in nums}
    for n in adds:
        if not (0 < n <= len(new)):
            continue
        m = re.match(r"^\s*'?([A-Za-z_][\w-]*)'?\s*:", new[n - 1])
        if not m:
            continue
        leaf = m.group(1)
        sec = None
        for k in range(n - 1, -1, -1):
            sm = re.match(r"^  '?([A-Za-z_][\w-]*)'?\s*:\s*\{", new[k])
            if sm:
                sec = sm.group(1)
                break
        keys.add(f"{sec}.{leaf}" if sec else leaf)
    for l in lines:          # removed lines: the leaf only (their section is not in the new file)
        m = re.match(r"^\s*'?([A-Za-z_][\w-]*)'?\s*:\s*['`\"]", l)
        if m:
            keys.add(m.group(1))
    return keys


def src_files_using(fe: Path, needles: set[str]) -> set[Path]:
    """frontend/src files (outside i18n/) whose text contains one of the needles as a quoted string or a `t('x.` prefix."""
    if not needles:
        return set()
    full = [n for n in needles if "." in n]
    pat = re.compile(r"""['"`](%s)['"`]""" % "|".join(map(re.escape, sorted(full)))) if full else None
    out = set()
    for p in (fe / "src").rglob("*.ts"):
        if "i18n" in p.parts:
            continue
        txt = _read(p)
        if pat and pat.search(txt):
            out.add(p.resolve())
    return out


# ---------------------------------------------------------------- selection
def _full(path: str, pats: list[str]) -> bool:
    return any(re.search(p, path) for p in pats)


def failed_files(report: Path) -> dict[str, set[str]]:
    """{'backend': {test_x.py}, 'frontend': {x.spec.ts}} of every FAIL item of a gate report (the --after re-run)."""
    d = json.loads(Path(report).read_text(encoding="utf-8"))
    out = {"backend": set(), "frontend": set()}
    for i in d.get("items", []):
        if i.get("status") != "FAIL":
            continue
        ident = i.get("id", "")
        m = re.match(r"tests/(test_[^:]+\.py)", ident)
        if i.get("category") == "backend" and m:
            out["backend"].add(m.group(1))
            continue
        m = re.match(r"([\w.-]+\.spec\.ts)", ident)
        if m:
            out["frontend"].add(m.group(1))
    out["sha"] = d.get("sha", "")
    return out


def rerun_only_selection(root: Path, after: dict) -> dict:
    """Only the failed files of a red gate (the automatic re-run of quarantined failures on the same sha): no core, no mapping."""
    root = Path(root).resolve()
    all_tests = sorted(p.name for p in (root / BE / "tests").glob("test_*.py"))
    all_specs = sorted(p.name for p in (root / FE / "tests").glob("*.spec.ts"))
    b = sorted(set(after.get("backend", ())) & set(all_tests))
    f = sorted(set(after.get("frontend", ())) & set(all_specs))
    why = "failed in the red gate (re-run only)"
    return {"policy": "gate2-rerun-only", "changed_files": 0, "version_only_ignored": [], "full": {"backend": [], "frontend": []},
            "notes": [], "pixel": "only failed pixel specs", "deferred_to_nightly": {}, "heavy_secs": HEAVY_SECS,
            "after": {"backend": b, "frontend": f},
            "backend": {"selected": b, "dropped": sorted(set(all_tests) - set(b)), "why": {n: why for n in b}, "total": len(all_tests)},
            "frontend": {"selected": f, "dropped": sorted(set(all_specs) - set(f)), "why": {n: why for n in f}, "total": len(all_specs)}}


CLOSURE_DEPTH = int(os.environ.get("GATE2_CLOSURE_DEPTH", "2"))


def _limited(fn_closure, depth: int):
    """A depth-limited replacement for select_tests' reverse closures: `depth` import levels above the changed file (1 = its
    direct importers). 0 or less = unlimited (the select_tests behaviour)."""
    if depth <= 0:
        return fn_closure

    def py(be, changed, mods):
        rev: dict[str, set[str]] = {}
        for name, p in mods.items():
            pkg = name if p.name == "__init__.py" else name.rsplit(".", 1)[0]
            for dep in st.py_imports(_read(p), pkg, mods):
                rev.setdefault(dep, set()).add(name)
        seen, frontier = set(changed), set(changed)
        for _ in range(depth):
            nxt = {up for m in frontier for up in rev.get(m, ()) if up not in seen and up not in st.HUB_PY}
            seen |= nxt
            frontier = nxt
        return seen

    def ts(g, changed, root):
        rev: dict = {}
        for f, deps in g.items():
            for d in deps:
                rev.setdefault(d, set()).add(f)
        seen, frontier = set(changed), set(changed)
        for _ in range(depth):
            nxt = set()
            for f in frontier:
                for up in rev.get(f, ()):
                    rel = up.relative_to(root).as_posix() if up.is_relative_to(root) else ""
                    if up not in seen and not st.HUB_TS.match(rel):
                        nxt.add(up)
            seen |= nxt
            frontier = nxt
        return seen

    return py if fn_closure is st.py_reverse_closure else ts


def select_gate2(root: Path, base: str, head: str = "HEAD", after: dict | None = None, costs: dict | None = None,
                 defer_heavy: bool | None = None, depth: int | None = None) -> dict:
    root = root.resolve()
    depth = CLOSURE_DEPTH if depth is None else depth
    be, fe = root / BE, root / FE
    defer_heavy = (os.environ.get("GATE2_DEFER_HEAVY", "1") != "0") if defer_heavy is None else defer_heavy
    raw = st.changed_files(root, base, head)
    vo = {p for s, p in raw if s == "M" and st._full(p, st.FULL_BOTH + st.FULL_BACKEND + st.FULL_FRONTEND + [r"(^|/)config\.yaml$"])
          and st.version_only(root, base, head, p)}
    changes = [(s, p) for s, p in raw if p not in vo]
    mods = st.py_modules(be)
    notes, full = [], {"backend": [], "frontend": []}
    derived: list[tuple[str, str]] = []     # synthetic changes handed to select_tests.select()
    extra_be: dict[str, str] = {}            # test file -> reason
    extra_fe: dict[str, str] = {}
    extra_src: set[Path] = set()            # frontend src files treated as changed (i18n keys)
    design_changed = False
    fe_src_changed = False
    passthrough = []
    for s, p in changes:
        if p.startswith(FE + "/src/"):
            fe_src_changed = True
        if _full(p, KEEP_FULL_BACKEND):
            full["backend"].append(p)
        if _full(p, KEEP_FULL_FRONTEND):
            full["frontend"].append(p)
        if BUILD_ONLY.match(p):
            notes.append(f"{p}: build/packaging file, no test mapping (release_check covers the version and the bundle)")
            continue
        if NARROW_MAIN.match(p):
            if s == "D":
                full["backend"].append(p); continue
            found, orphans, segs = attribute_py_hub(root, base, head, p, mods)
            if orphans:
                full["backend"].append(f"{p} (unattributed lines: {orphans[0]!r}{' +%d' % (len(orphans) - 1) if len(orphans) > 1 else ''})")
            notes.append(f"{p}: attributed to {', '.join(sorted(found)) or 'no module'}" + (f"; API segments {sorted(segs)}" if segs else ""))
            for m in sorted(found):
                derived.append(("M", f"{BE}/" + m.replace(".", "/") + (".py" if (be / (m.replace('.', '/') + '.py')).exists() else "/__init__.py")))
            for seg in segs:
                for n in sorted(x.name for x in (be / "tests").glob("test_*.py")):
                    if re.search(r"/api/v1/%s\b" % re.escape(seg), _read(be / "tests" / n)):
                        extra_be.setdefault(n, f"calls /api/v1/{seg} (changed in {Path(p).name})")
            continue
        if NARROW_MIGRATION.match(p):
            if s != "A":
                full["backend"].append(f"{p} (an existing migration was {'deleted' if s == 'D' else 'modified'})")
                continue
            tables = migration_tables(_read(root / p))
            notes.append(f"{p}: new migration, tables {sorted(tables) or '-'}")
            if tables:
                tre = re.compile(r"\b(%s)\b" % "|".join(map(re.escape, sorted(tables))))
                for name, mp in mods.items():
                    if name not in st.HUB_PY and tre.search(_read(mp)):
                        derived.append(("M", mp.relative_to(root).as_posix()))
                for n in sorted(x.name for x in (be / "tests").glob("test_*.py")):
                    if tre.search(_read(be / "tests" / n)):
                        extra_be.setdefault(n, f"names a table of {Path(p).name}")
            continue
        if NARROW_ROLES.match(p):
            delta = roles_delta(root, base, p)
            if not delta:
                full["backend"].append(f"{p} (does not parse)"); full["frontend"].append(f"{p} (does not parse)")
                continue
            code_ids = delta["new_perms"] | delta["gone_perms"]       # ids whose checks are new or orphaned
            role_ids = delta["roles"]
            notes.append(f"{p}: new/removed permissions {sorted(code_ids)}; roles changed {sorted(role_ids)}")
            ids = code_ids | role_ids
            if ids:
                ire = re.compile(r"""['"](%s)['"]""" % "|".join(map(re.escape, sorted(ids))))
                for n in sorted(x.name for x in (be / "tests").glob("test_*.py")):
                    if ire.search(_read(be / "tests" / n)):
                        extra_be.setdefault(n, "names a changed permission/role id")
                for n in sorted(x.name for x in (fe / "tests").glob("*.spec.ts")):
                    if ire.search(_read(fe / "tests" / n)):
                        extra_fe.setdefault(n, "names a changed permission/role id")
            if code_ids:
                cre = re.compile(r"""['"](%s)['"]""" % "|".join(map(re.escape, sorted(code_ids))))
                for name, mp in mods.items():
                    if name not in st.HUB_PY and cre.search(_read(mp)):
                        derived.append(("M", mp.relative_to(root).as_posix()))
                extra_src |= src_files_using(fe, code_ids)
            continue
        if NARROW_I18N.match(p):
            keys = i18n_keys(root, base, head, p)
            used = src_files_using(fe, keys)
            notes.append(f"{p}: {len(keys)} changed keys, used in {len(used)} src files")
            extra_src |= used
            continue
        if NARROW_SHELL.match(p) or NARROW_DESIGN.match(p):
            if NARROW_DESIGN.match(p):
                design_changed = True
            passthrough.append((s, p))            # mapped below without the hub stop (shell/ is a hub for select_tests)
            continue
        derived.append((s, p))
    # ---- the select_tests mapping on everything that is not a narrowed hub
    sub_root_changes = sorted(set(derived))
    saved = (st.FULL_BOTH, st.FULL_BACKEND, st.FULL_FRONTEND, st.MAX_FILES, st.py_reverse_closure, st.ts_reverse_closure)
    try:   # select_tests' own triggers are replaced by gate 2's (KEEP_FULL_*), evaluated above; the closures get a depth
        st.FULL_BOTH, st.FULL_BACKEND, st.FULL_FRONTEND, st.MAX_FILES = [], [], [], 10 ** 9
        st.py_reverse_closure = _limited(saved[4], depth)
        st.ts_reverse_closure = _limited(saved[5], depth)
        res = st.select(root, sub_root_changes)
        ts_closure = st.ts_reverse_closure
    finally:
        st.FULL_BOTH, st.FULL_BACKEND, st.FULL_FRONTEND, st.MAX_FILES, st.py_reverse_closure, st.ts_reverse_closure = saved
    all_tests = res["backend"]["selected"] + res["backend"]["dropped"]
    all_specs = res["frontend"]["selected"] + res["frontend"]["dropped"]
    bsel, bwhy = set(res["backend"]["selected"]), dict(res["backend"]["why"])
    fsel, fwhy = set(res["frontend"]["selected"]), dict(res["frontend"]["why"])

    def badd(n, why):
        if n in all_tests and n not in bsel:
            bsel.add(n); bwhy[n] = why

    def fadd(n, why):
        if n in all_specs and n not in fsel:
            fsel.add(n); fwhy[n] = why

    for n in CORE_BACKEND:
        badd(n, "gate2 core")
    for n in all_tests:
        if any(fnmatch.fnmatch(n, g) for g in CORE_BACKEND_GLOBS):
            badd(n, "gate2 core")
    for n, why in extra_be.items():
        badd(n, why)
    # select_tests' frontend smoke = every unit-* spec; gate 2 keeps only its own core plus the mapped ones
    for n in list(fsel):
        if fwhy.get(n) == "smoke" and not any(fnmatch.fnmatch(n, g) for g in CORE_FRONTEND_GLOBS):
            fsel.discard(n); fwhy.pop(n, None)
    for n in all_specs:
        if any(fnmatch.fnmatch(n, g) for g in CORE_FRONTEND_GLOBS):
            fadd(n, "gate2 core")
    for n, why in extra_fe.items():
        fadd(n, why)
    # ---- frontend: shell / design / i18n-derived src files, mapped through the closure without the hub stop
    hub_src = {(root / p).resolve() for s, p in passthrough if (root / p).suffix == ".ts" and (root / p).exists()}
    shell_src = {h for h in hub_src if "shell" in h.parts}
    if hub_src or extra_src:
        g = st.ts_graph(fe)
        rev: dict = {}
        for f, deps in g.items():
            for d in deps:
                rev.setdefault(d, set()).add(f)
        # (1) src files that use a changed i18n key or a new permission id: the usual closure (it stops at the hubs)
        clo = ts_closure(g, set(extra_src), root) if extra_src else set()
        # (2) a shell/design hub file: NOT its closure (every screen imports the tokens and the shell). Its own elements, the
        #     elements of the shell files' DIRECT importers, and the specs that import the hub file directly. A palette or
        #     token change is judged by the pixel specs and the visual matrix (below), an API change of a hub by tsc.
        near = set(hub_src)
        for h in shell_src:
            near |= {u for u in rev.get(h, ()) if u.is_relative_to(fe / "src")}
        tags = set()
        for f in clo | near:
            if f.is_relative_to(fe / "src"):
                tags |= set(st.TAG_RE.findall(_read(f)))
        tags -= {"sw-app"}                  # every spec waits for <sw-app>: naming it is not a dependency
        tag_re = re.compile(r"(?<![\w-])(%s)(?![\w-])" % "|".join(map(re.escape, sorted(tags)))) if tags else None
        for n in all_specs:
            sp = (fe / "tests" / n).resolve()
            if sp in clo:
                fadd(n, "imports a file that uses a changed i18n key / permission")
            elif g.get(sp, set()) & hub_src:
                fadd(n, "imports a changed shell/design file directly")
            elif tag_re:
                m = tag_re.search(_read(sp))
                if m:
                    fadd(n, f"uses <{m.group(1)}> (defined in or next to a changed shell/design/i18n file)")
    if any(NARROW_SHELL.match(p) for _, p in passthrough):
        for n in all_specs:
            if SHELL_SPEC_RE.search(n):
                fadd(n, "shell family (shell/ changed)")
    # ---- pixel specs: only for UI changes
    pixel_specs = {n for n in all_specs if "toHaveScreenshot(" in _read(fe / "tests" / n)} | (PIXEL_EXTRA & set(all_specs))
    pixel_note = ""
    if design_changed:
        for n in sorted(pixel_specs):
            fadd(n, "pixel: the design/styles layer changed")
        for n in all_specs:
            if DESIGN_SPEC_RE.search(n):
                fadd(n, "design family (design/ changed)")
        pixel_note = "all pixel specs (design/styles layer changed)"
    elif not fe_src_changed:
        dropped_px = sorted(n for n in pixel_specs & fsel if fwhy.get(n) != "changed in the diff")
        for n in dropped_px:
            fsel.discard(n); fwhy.pop(n, None)
        pixel_note = f"no frontend/src change: {len(dropped_px)} pixel specs not run"
    else:
        pixel_note = f"mapped pixel specs only: {len(pixel_specs & fsel)} of {len(pixel_specs)}"
    # ---- the --after re-run: the failed files of the red gate
    if after:
        for n in after.get("backend", ()):
            badd(n, "failed in the red gate (--after)")
        for n in after.get("frontend", ()):
            fadd(n, "failed in the red gate (--after)")
    # ---- full sides
    if full["backend"]:
        bsel, bwhy = set(all_tests), {n: "full tier" for n in all_tests}
    if full["frontend"]:
        fsel, fwhy = set(all_specs), {n: "full tier" for n in all_specs}
    # ---- heavy sweeps -> the nightly
    deferred = {}
    if defer_heavy and costs:
        sec = costs.get("seconds", {})
        changed_specs = {Path(p).name for s, p in changes if re.match(rf"^{FE}/tests/[^/]+\.spec\.ts$", p) and s != "D"}
        pinned = changed_specs | set((after or {}).get("frontend", ()))
        for n in sorted(fsel):
            if sec.get(n, 0) > HEAVY_SECS and n not in pinned:
                deferred[n] = round(sec[n] / 60, 1)
        for n in deferred:
            fsel.discard(n); fwhy.pop(n, None)
    return {
        "policy": "gate2",
        "closure_depth": depth,
        "changed_files": len(changes),
        "version_only_ignored": sorted(vo),
        "base": base, "head": head,
        "full": {k: sorted(set(v)) for k, v in full.items()},
        "notes": notes,
        "pixel": pixel_note,
        "deferred_to_nightly": deferred,
        "heavy_secs": HEAVY_SECS,
        "after": {k: sorted(v) for k, v in (after or {}).items() if k != "sha"} if after else None,
        "backend": {"selected": sorted(bsel), "dropped": sorted(set(all_tests) - bsel), "why": bwhy, "total": len(all_tests)},
        "frontend": {"selected": sorted(fsel), "dropped": sorted(set(all_specs) - fsel), "why": fwhy, "total": len(all_specs)},
    }


# ---------------------------------------------------------------- estimate (reuses the engine's own v2 job planner)
CALIB = {
    # 2.19.0 gate (release/2190 @ e476e48ae, v2, 12 slots, 6 shards): the measured pool phase and the planner's makespan for
    # the same classification and costs. Filled by `calibrate`; see GATE_V2.md section 2.
    "pool_actual_s": 8686, "settle_actual_s": 397, "setup_actual_s": 54,
}


def load_costs(path: Path | None) -> dict:
    p = Path(path) if path else HERE / "gate2_costs.json"
    try:
        return json.loads(p.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {}


def estimate(root: Path, sel: dict | None, costs: dict, slots: int = 12, shards: int | None = None) -> dict:
    """Wall-time estimate of a gate-2 run (sel) or of the full tier (sel=None) from the recorded costs, with the engine's own
    classify() / filter_classification() / v2_jobs() / simulate_pool(). Runs nothing."""
    import importlib
    os.environ.setdefault("GATE_SCHEDULE", "v2")
    rg = importlib.import_module("release_gate")
    rg.SCHEDULE = "v2"
    rg._COSTS = dict(costs.get("seconds", {}))          # the seed instead of the runner's gate logs
    fe = Path(root) / FE
    cls = rg.classify(fe, "L")
    if sel:
        rg.REDUCED_CATS.clear()
        cls = rg.filter_classification(cls, sel)
    pw = rg._COSTS
    jobs = rg.v2_jobs(cls, pw, "L", False)
    if sel is not None and not cls["pixel"]:
        jobs = [j for j in jobs if j["kind"] != "pixel"]
    work = sum(j["est"] * j["workers"] for j in jobs)
    longest = max((j["est"] for j in jobs), default=0.0)
    bsec = costs.get("backend_seconds", {})
    names = (sel["backend"]["selected"] if sel else None)
    be_dir = Path(root) / BE / "tests"
    allb = sorted(p.name for p in be_dir.glob("test_*.py"))
    pick = allb if names is None else [n for n in allb if n in set(names)]
    med = sorted(bsec.values())[len(bsec) // 2] if bsec else 30.0
    be_work = sum(bsec.get(n, med) for n in pick)

    def be_wall_of(n):
        split = rg.split_backend([(x, 1) for x in pick], n, {x: bsec.get(x, med) for x in pick}) if pick else []
        return max((w for _, w in split), default=0.0)

    if shards is None:
        # one CPU budget for both tracks, as measured in 2.19.0 (12 Playwright slots + 6 shards = 18 on 16 cores): try every
        # split of it between backend shards (GATE_BACKEND_SHARDS, 4..10) and Playwright slots (GATE_PW_SLOTS, at least 6)
        best = None
        for n in range(4, 11):
            s = max(6, UNITS - n)
            mk, _ = rg.simulate_pool(jobs, s)
            crit = max(mk, be_wall_of(n))
            if best is None or crit < best[0] - 1:
                best = (crit, n, s, mk)
        _, shards, slots, makespan = best
    else:
        makespan, _ = rg.simulate_pool(jobs, slots)
    be_wall = be_wall_of(shards)
    return {"jobs": len(jobs), "pw_worker_s": work, "pw_makespan_s": makespan, "pw_longest_job_s": longest, "pw_slots": slots,
            "backend_files": len(pick), "backend_work_s": be_work, "backend_shards": shards, "backend_wall_s": be_wall,
            "pixel_specs": len(cls["pixel"]), "rest": len(cls["rest"]), "dev": len(cls["dev"]), "fixture": len(cls["fixture"])}


UNITS = int(os.environ.get("GATE2_CPU_UNITS", "18"))


def wall_range(est: dict, full_est: dict | None) -> tuple[float, float]:
    """(low, high) minutes. Calibration: the 2.19.0 pool took CALIB pool_actual_s against the planner's makespan for the full
    tier (factor k >= 1: the per-test costs were recorded under that gate's load, and the backend shared the CPU). low = the
    planner's critical path; high = k x that. Both add the measured setup and settle (retry) phases."""
    k = 1.0
    if full_est and full_est["pw_makespan_s"]:
        k = max(1.0, CALIB["pool_actual_s"] / max(full_est["pw_makespan_s"], full_est["backend_wall_s"]))
    crit = max(est["pw_makespan_s"], est["backend_wall_s"])
    fixed = CALIB["setup_actual_s"] + CALIB["settle_actual_s"] + 120     # + fetch/worktree/server start
    lo = (crit * 0.85 + fixed) / 60
    hi = (crit * k + fixed) / 60
    return round(lo), round(hi)


# ---------------------------------------------------------------- nightly safety net
def nightly_health(results_dir: Path, max_age_h: float = 36.0) -> dict:
    """The newest full nightly on main (nightly_tests.sh writes ~/smplwise-results/nightly/gate_main_<sha>.json): finished and
    young enough. Selection is allowed only when it is (else the gate runs the full tier and says why)."""
    import time
    nd = Path(results_dir) / "nightly"
    cands = sorted(nd.glob("gate_main_*.json"), key=lambda p: p.stat().st_mtime, reverse=True) if nd.is_dir() else []
    if not cands:
        return {"ok": False, "why": f"no nightly report in {nd}"}
    p = cands[0]
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return {"ok": False, "why": f"{p.name}: unreadable ({e})"}
    age = (time.time() - p.stat().st_mtime) / 3600
    hard = [i for i in d.get("items", []) if i.get("category") == "gate" and i.get("status") == "FAIL"]
    c = d.get("counts", {})
    ran_be = (c.get("backend") or {}).get("pass", 0)
    ok = age <= max_age_h and not hard and ran_be > 0
    why = f"{p.name}: verdict {d.get('verdict')}, age {age:.0f} h, backend passed {ran_be}, engine hard failures {len(hard)}"
    return {"ok": ok, "why": why, "report": str(p), "sha": d.get("sha"), "verdict": d.get("verdict")}


# ---------------------------------------------------------------- CLI
def _print_plan(root: Path, base: str, head: str, sel: dict, est: dict, full_est: dict, costs: dict) -> None:
    lo, hi = wall_range(est, full_est)
    flo, fhi = wall_range(full_est, full_est)
    b, f = sel["backend"], sel["frontend"]
    print(f"GATE2 dry-run: {head} vs {base}  ({sel['changed_files']} changed files; version-only ignored: {len(sel['version_only_ignored'])})")
    print(f"  full backend : {'YES - ' + '; '.join(sel['full']['backend'][:3]) if sel['full']['backend'] else 'no'}")
    print(f"  full frontend: {'YES - ' + '; '.join(sel['full']['frontend'][:3]) if sel['full']['frontend'] else 'no'}")
    for n in sel["notes"][:20]:
        print(f"  hub: {n}")
    print(f"  pixel: {sel['pixel']}")
    print(f"  backend : {len(b['selected'])}/{b['total']} files, {est['backend_work_s'] / 60:.0f} of {full_est['backend_work_s'] / 60:.0f} shard-min, "
          f"{est['backend_shards']} shards, largest shard ~{est['backend_wall_s'] / 60:.0f} min")
    print(f"  frontend: {len(f['selected'])}/{f['total']} specs ({est['rest']} preview, {est['dev']} dev, {est['fixture']} fixture, {est['pixel_specs']} pixel), "
          f"{est['pw_worker_s'] / 60:.0f} of {full_est['pw_worker_s'] / 60:.0f} worker-min, {est['jobs']} pool jobs on {est['pw_slots']} slots, "
          f"longest job {est['pw_longest_job_s'] / 60:.0f} min, pool makespan ~{est['pw_makespan_s'] / 60:.0f} min")
    print(f"  knobs for this run: GATE_BACKEND_SHARDS={est['backend_shards']} GATE_PW_SLOTS={est['pw_slots']} (closure depth {sel.get('closure_depth')})")
    d = sel["deferred_to_nightly"]
    print(f"  deferred to the nightly (heavy, > {sel['heavy_secs'] / 60:.0f} worker-min, unchanged): {len(d)} specs, {sum(d.values()):.0f} worker-min"
          + (": " + ", ".join(f"{k} ({v})" for k, v in sorted(d.items(), key=lambda kv: -kv[1])[:8]) if d else ""))
    why = {}
    for side in ("backend", "frontend"):
        for n, w in sel[side]["why"].items():
            key = re.sub(r"'[^']*'|<[^>]*>|imports \S+|/api/v1/\S+", "*", w)
            why[(side, key)] = why.get((side, key), 0) + 1
    print("  why selected (count):")
    for (side, key), c in sorted(why.items(), key=lambda kv: -kv[1])[:14]:
        print(f"    {side:<8} {c:>4}  {key}")
    print(f"  ESTIMATE gate2: ~{lo}-{hi} min wall   (full tier on the same tree: ~{flo}-{fhi} min; 2.19.0 actual full v2 gate: 152 min)")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["plan", "select", "nightly"])
    ap.add_argument("--root", default=".")
    ap.add_argument("--base")
    ap.add_argument("--head", default="HEAD")
    ap.add_argument("--after", help="a red gate report (.json): add its failed tests' files")
    ap.add_argument("--costs", help="cost seed (default scripts/gate/gate2_costs.json)")
    ap.add_argument("--json", help="write the selection JSON here")
    ap.add_argument("--slots", type=int, default=int(os.environ.get("GATE_PW_SLOTS", "12")))
    ap.add_argument("--no-defer-heavy", action="store_true")
    ap.add_argument("--depth", type=int, default=None, help="import-closure depth (default GATE2_CLOSURE_DEPTH or 2; 0 = unlimited)")
    ap.add_argument("--results", default=os.environ.get("GATE_RESULTS_DIR") or str(Path.home() / "smplwise-results"))
    ns = ap.parse_args(argv)
    if ns.cmd == "nightly":
        print(json.dumps(nightly_health(Path(ns.results)), indent=1))
        return 0
    if not ns.base:
        ap.error("--base is required")
    root = Path(ns.root)
    costs = load_costs(Path(ns.costs) if ns.costs else None)
    after = failed_files(Path(ns.after)) if ns.after else None
    sel = select_gate2(root, ns.base, ns.head, after=after, costs=costs, defer_heavy=not ns.no_defer_heavy, depth=ns.depth)
    if ns.json:
        Path(ns.json).write_text(json.dumps(sel, indent=1, ensure_ascii=False), encoding="utf-8")
    if ns.cmd == "select":
        print(json.dumps(sel, indent=1, ensure_ascii=False))
        return 0
    head_root = root
    est = estimate(head_root, sel, costs)
    full_est = estimate(head_root, None, costs, ns.slots, shards=6)
    k = CALIB["pool_actual_s"] / max(full_est["pw_makespan_s"], full_est["backend_wall_s"], 1)
    print(f"calibration: full tier on this tree, 12 slots + 6 shards -> planner {max(full_est['pw_makespan_s'], full_est['backend_wall_s']) / 60:.0f} min "
          f"vs the 2.19.0 pool phase {CALIB['pool_actual_s'] / 60:.0f} min measured (k = {k:.2f})")
    _print_plan(root, ns.base, ns.head, sel, est, full_est, costs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
