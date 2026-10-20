#!/usr/bin/env python3
"""Diff-based test selection for the release gate (GATESPEED-293 phase 2). Opt-in: release_gate.py --select-base <ref>.

Maps the files changed between <base> and HEAD to the backend test files and Playwright spec files that can see them, and falls
back to the FULL tier of a side (backend / frontend) whenever a change can reach everything. Never selects less than:
  * every test file added or modified in the diff (backend tests/test_*.py, frontend tests/*.spec.ts);
  * the fixed SMOKE set (critical suites, below);
  * every security / permission suite (SECURITY_RE on the file name), in full.
The safety net is the full nightly run on main (nightly_tests.sh, no selection) and `audit`, which lists every nightly red that
a selection run would have skipped (scripts/gate/select_tests.py audit ...).

Backend mapping (smplwise_vms/backend):
  * a changed module -> the modules that import it, transitively, NOT through the hubs (main.py, package __init__ files): the
    app factory imports every router, so "imports main" would mean "everything";
  * a test file is selected when it imports a module of that closure, or its name contains the stem of a changed module (or the
    package name of a module under services/<pkg>/), or it calls an API path segment that a changed router serves;
  * a changed test helper (tests/*.py that is not test_*) selects the test files that import it; conftest.py and the db
    template are full-tier triggers.
Frontend mapping (frontend/):
  * a changed src file -> the src files that import it, transitively, not through the hubs (main.ts, router.ts, shell/); the
    custom elements those files define (@customElement / customElements.define) -> every spec that mentions one of the tags;
  * a spec that imports the changed file (spec -> tests helpers -> /src/...) is selected; a spec whose name contains the stem
    of a changed file or its feature directory is selected;
  * a changed spec helper (tests/*.ts that is not a spec) selects the specs that import it.
Full-tier triggers: FULL_BOTH / FULL_BACKEND / FULL_FRONTEND below (migrations, shared fixtures, build config, app core, nav,
i18n core, styles core, the gate itself), and more than MAX_FILES changed files.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
from pathlib import Path

BE = "smplwise_vms/backend"
FE = "frontend"
MAX_FILES = 400

VERSION_LINE = re.compile(r"version|VERSION", re.I)
FULL_BOTH = [
    r"^smplwise_vms/backend/smplwise/roles\.json$",               # the permission catalogue: every screen and API check
    r"^smplwise_vms/backend/smplwise/(rbac|auth|capabilities|mode)\.py$",
]
FULL_BACKEND = [
    r"^smplwise_vms/backend/smplwise/migrations(_energy)?/",       # schema: every test database
    r"^smplwise_vms/backend/smplwise/(main|db|config|errors|audit|body_limit|__init__|__main__)\.py$",
    r"^smplwise_vms/backend/smplwise/(routers|services)/__init__\.py$",
    r"^smplwise_vms/backend/tests/(conftest|db_template|hygiene)\.py$",
    r"^smplwise_vms/backend/(requirements[^/]*\.txt|pyproject\.toml|setup\.cfg|pytest\.ini)$",
    r"^smplwise_vms/Dockerfile$",
]
FULL_FRONTEND = [
    r"^frontend/(package(-lock)?\.json|vite\.config\.[a-z]+|tsconfig[^/]*\.json|playwright\.config\.[a-z]+|index\.html)$",
    r"^frontend/src/(main|router|vite-env\.d)\.ts$",
    r"^frontend/src/shell/",                                       # app shell and nav
    r"^frontend/src/i18n/(index|core|i18n|locale|strings|he|en)[^/]*\.ts$",   # the i18n core (feature string files are mapped)
    r"^frontend/src/styles/(tokens|base|global|theme|index|reset)[^/]*\.ts$",
    r"^frontend/src/design/",                                      # design tokens / theme layer
    r"^frontend/src/fixtures/",
    r"^frontend/tests/fixtures/",                                  # shared fixture backends
    r"^frontend/tests/gate_tablet_allowlist\.json$",
]
# critical suites that always run (cheap, wide): start-up, migrations, health, hygiene, backup, release checks
SMOKE_BACKEND = ["test_migrations.py", "test_smoke_after_upgrade.py", "test_gate_hygiene.py", "test_health_summary.py",
                 "test_health_report.py", "test_backup.py", "test_release_check.py", "test_db_gate.py", "test_db_template.py",
                 "test_gate_speed.py", "test_select_tests.py"]
SMOKE_FRONTEND_GLOBS = ["unit-*.spec.ts", "evidence-nav*.spec.ts", "layout-shell*.spec.ts"]
SECURITY_RE = re.compile(r"security|rbac|perm|auth|secret|csrf|privacy|scope|role|passkey|webauthn|login|session|ingress|grant|harden|poc", re.I)
TAG_RE = re.compile(r"""(?:@customElement\(\s*|customElements\.define\(\s*)['"]([a-z][a-z0-9]*-[a-z0-9-]+)['"]""")
TS_IMPORT_RE = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([./][^'"]+)['"]""")
ROUTE_RE = re.compile(r"""@router\.(?:get|post|put|patch|delete|websocket)\(\s*['"]/([a-z0-9_-]+)""")
HUB_TS = re.compile(r"^frontend/src/(main\.ts|router\.ts|shell/)")
# the closure does not walk up THROUGH these: main imports every router, and the core modules import services lazily inside
# functions (db -> services -> ...), so "imports db" would select almost every test. Each of them is a full-tier trigger itself.
HUB_PY = {"smplwise", "smplwise.main", "smplwise.routers", "smplwise.services", "smplwise.__main__", "smplwise.db", "smplwise.rbac",
          "smplwise.auth", "smplwise.config", "smplwise.errors", "smplwise.audit", "smplwise.capabilities", "smplwise.mode"}


def git(root: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, encoding="utf-8", errors="replace", check=True).stdout


def changed_files(root: Path, base: str, head: str = "HEAD") -> list[tuple[str, str]]:
    """[(status, path)] of base...head (merge base), renames as delete + add."""
    out = []
    for line in git(root, "diff", "--name-status", "--no-renames", f"{base}...{head}").splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            out.append((parts[0][0], parts[-1].replace("\\", "/")))
    return out


def _read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _stem_tokens(path: str) -> set[str]:
    stem = Path(path).name.split(".")[0]
    toks = {stem.lower()}
    parent = Path(path).parent.name.lower()
    if parent and parent not in ("src", "tests", "smplwise", "services", "routers", "screens", "components", "api", "frontend"):
        toks.add(parent)
    return {t for t in toks if len(t) >= 4}


# ---------------------------------------------------------------- python import graph
def py_modules(be: Path) -> dict[str, Path]:
    mods = {}
    for p in (be / "smplwise").rglob("*.py"):
        rel = p.relative_to(be).with_suffix("")
        parts = list(rel.parts)
        if parts[-1] == "__init__":
            parts = parts[:-1]
        mods[".".join(parts)] = p
    return mods


PY_FROM = re.compile(r"^\s*from\s+([.\w]+)\s+import\s+(\([^)]*\)|[^\n#]+)", re.M | re.S)
PY_IMPORT = re.compile(r"^\s*import\s+([\w., ]+)", re.M)


def py_imports(text: str, pkg: str, mods: dict) -> set[str]:
    """smplwise modules a file imports. pkg = the importing module's package ('' for tests)."""
    out = set()
    for m in PY_FROM.finditer(text):
        src, names = m.group(1), m.group(2)
        if src.startswith("."):
            lvl = len(src) - len(src.lstrip("."))
            base = pkg.split(".") if pkg else []
            base = base[: len(base) - (lvl - 1)] if lvl > 1 else base
            src = ".".join(base + ([src.lstrip(".")] if src.lstrip(".") else []))
        if not src.startswith("smplwise"):
            continue
        if src in mods:
            out.add(src)
        for n in re.findall(r"\w+", names.replace("as ", " ")):
            if f"{src}.{n}" in mods:
                out.add(f"{src}.{n}")
    for m in PY_IMPORT.finditer(text):
        for n in m.group(1).split(","):
            n = n.strip().split(" ")[0]
            if n in mods:
                out.add(n)
    return out


def py_reverse_closure(be: Path, changed: set[str], mods: dict) -> set[str]:
    rev: dict[str, set[str]] = {}
    for name, p in mods.items():
        pkg = name if p.name == "__init__.py" else name.rsplit(".", 1)[0]
        for dep in py_imports(_read(p), pkg, mods):
            rev.setdefault(dep, set()).add(name)
    seen, todo = set(changed), list(changed)
    while todo:
        m = todo.pop()
        for up in rev.get(m, ()):
            if up not in seen and up not in HUB_PY:
                seen.add(up)
                todo.append(up)
    return seen


# ---------------------------------------------------------------- typescript import graph
def ts_resolve(frm: Path, spec: str, fe: Path) -> Path | None:
    base = (fe / spec.lstrip("/")) if spec.startswith("/") else (frm.parent / spec)
    cands = [base, base.with_suffix(".ts"), Path(str(base) + ".ts"), base / "index.ts"]
    if str(base).endswith(".js"):
        cands.insert(0, Path(str(base)[:-3] + ".ts"))
    for c in cands:
        if c.is_file():
            return c.resolve()
    return None


def ts_graph(fe: Path) -> dict[Path, set[Path]]:
    """file -> files it imports (src and tests, relative and '/src/...' imports)."""
    g = {}
    for p in list((fe / "src").rglob("*.ts")) + list((fe / "tests").glob("*.ts")) + list((fe / "tests").glob("*/**/*.ts")):
        deps = set()
        for s in TS_IMPORT_RE.findall(_read(p)):
            r = ts_resolve(p, s, fe)
            if r:
                deps.add(r)
        g[p.resolve()] = deps
    return g


def ts_reverse_closure(g: dict, changed: set[Path], root: Path) -> set[Path]:
    rev: dict[Path, set[Path]] = {}
    for f, deps in g.items():
        for d in deps:
            rev.setdefault(d, set()).add(f)
    seen, todo = set(changed), list(changed)
    while todo:
        f = todo.pop()
        for up in rev.get(f, ()):
            rel = up.relative_to(root).as_posix() if up.is_relative_to(root) else ""
            if up not in seen and not HUB_TS.match(rel):
                seen.add(up)
                todo.append(up)
    return seen


# ---------------------------------------------------------------- selection
def _full(path: str, pats: list[str]) -> bool:
    return any(re.search(p, path) for p in pats)


def version_only(root: Path, base: str, head: str, path: str) -> bool:
    """True when every changed line of `path` mentions a version (the release bump of __init__.py / Dockerfile / config.yaml)."""
    try:
        diff = git(root, "diff", "-U0", f"{base}...{head}", "--", path)
    except subprocess.CalledProcessError:
        return False
    lines = [l for l in diff.splitlines() if l[:1] in "+-" and not l.startswith(("+++", "---"))]
    return bool(lines) and all(VERSION_LINE.search(l) for l in lines)


def select(root: Path, changes: list[tuple[str, str]], version_only_paths: set[str] = frozenset()) -> dict:
    root = root.resolve()
    be, fe = root / BE, root / FE
    all_tests = sorted(p.name for p in (be / "tests").glob("test_*.py"))
    all_specs = sorted(p.name for p in (fe / "tests").glob("*.spec.ts"))
    changes = [(s, p) for s, p in changes if p not in version_only_paths]   # a version bump reaches no test
    paths = [p for _, p in changes]
    reasons = {"backend": [], "frontend": []}
    if len(paths) > MAX_FILES:
        reasons["backend"].append(f"{len(paths)} changed files (> {MAX_FILES})")
        reasons["frontend"].append(f"{len(paths)} changed files (> {MAX_FILES})")
    for p in paths:
        if _full(p, FULL_BOTH):
            reasons["backend"].append(p); reasons["frontend"].append(p)
        if _full(p, FULL_BACKEND):
            reasons["backend"].append(p)
        if _full(p, FULL_FRONTEND):
            reasons["frontend"].append(p)
    existing = [(s, p) for s, p in changes if s != "D" and (root / p).exists()]

    # ---- backend
    bsel, bwhy = set(), {}

    def badd(name, why):
        if name in all_tests and name not in bsel:
            bsel.add(name); bwhy[name] = why

    for s, p in existing:
        if re.match(rf"^{BE}/tests/test_[^/]+\.py$", p):
            badd(Path(p).name, "changed in the diff")
    for n in SMOKE_BACKEND:
        badd(n, "smoke")
    for n in all_tests:
        if SECURITY_RE.search(n):
            badd(n, "security/permission suite")
    if not reasons["backend"]:
        mods = py_modules(be)
        changed_mods, helpers, routes, stems = set(), set(), set(), set()
        for s, p in changes:
            if not p.startswith(BE + "/") or not p.endswith(".py"):
                continue
            rel = p[len(BE) + 1:]
            if rel.startswith("smplwise/"):
                name = rel[:-3].replace("/", ".")
                name = name[: -len(".__init__")] if name.endswith(".__init__") else name
                changed_mods.add(name)
                stems |= _stem_tokens(rel)
                if rel.startswith("smplwise/routers/") and (root / p).exists():
                    routes |= set(ROUTE_RE.findall(_read(root / p)))
            elif rel.startswith("tests/") and not Path(rel).name.startswith("test_"):
                helpers.add(Path(rel).stem)
        scripts = {Path(p).stem for p in paths if p.startswith("scripts/") and p.endswith((".py", ".sh", ".mjs", ".json"))}
        closure = py_reverse_closure(be, {m for m in changed_mods if m in mods} | {m for m in changed_mods if m not in mods}, mods)
        # an API test reaches a changed service through the routers that import it: their path segments count too
        for m in closure:
            if m.startswith("smplwise.routers.") and m in mods:
                routes |= set(ROUTE_RE.findall(_read(mods[m])))
        for n in all_tests:
            text = _read(be / "tests" / n)
            imps = py_imports(text, "", mods)
            if imps & closure:
                badd(n, "imports " + sorted(imps & closure)[0])
                continue
            low = n.lower()
            hit = next((t for t in stems if t in low), None)
            if hit:
                badd(n, f"name matches '{hit}'")
                continue
            if helpers and re.search(r"^\s*(from|import)\s+(%s)\b" % "|".join(map(re.escape, helpers)), text, re.M):
                badd(n, "imports a changed test helper")
                continue
            if routes and re.search(r"/api/v1/(%s)\b" % "|".join(map(re.escape, routes)), text):
                badd(n, "calls a changed router's API path")
                continue
            if scripts and re.search(r"\b(%s)\b" % "|".join(map(re.escape, scripts)), text):
                badd(n, "names a changed script")
        # a helper imported by another helper: one more level through the helpers (cheap, conservative)
    if reasons["backend"]:
        bsel, bwhy = set(all_tests), {n: "full tier" for n in all_tests}

    # ---- frontend
    fsel, fwhy = set(), {}

    def fadd(name, why):
        if name in all_specs and name not in fsel:
            fsel.add(name); fwhy[name] = why

    for s, p in existing:
        if re.match(rf"^{FE}/tests/[^/]+\.spec\.ts$", p):
            fadd(Path(p).name, "changed in the diff")
    for n in all_specs:
        if any(fnmatch.fnmatch(n, g) for g in SMOKE_FRONTEND_GLOBS):
            fadd(n, "smoke")
        if SECURITY_RE.search(n):
            fadd(n, "security/permission suite")
    fe_changes = [p for p in paths if p.startswith(FE + "/") and not re.match(rf"^{FE}/tests/[^/]+\.spec\.ts$", p)]
    if not reasons["frontend"] and fe_changes:
        g = ts_graph(fe)
        changed = {(root / p).resolve() for p in fe_changes if (root / p).suffix == ".ts" and (root / p).exists()}
        # a deleted / non-TS asset (css, json, png) under src: map by name only
        stems = set()
        for p in fe_changes:
            stems |= _stem_tokens(p)
        clo = ts_reverse_closure(g, changed, root)
        tags = set()
        for f in clo:
            if f.is_relative_to(fe / "src"):
                tags |= set(TAG_RE.findall(_read(f)))
        tag_re = re.compile(r"(?<![\w-])(%s)(?![\w-])" % "|".join(map(re.escape, sorted(tags)))) if tags else None
        for n in all_specs:
            sp = (fe / "tests" / n).resolve()
            if sp in clo:
                fadd(n, "imports a changed file")
                continue
            low = n.lower()
            hit = next((t for t in stems if t in low), None)
            if hit:
                fadd(n, f"name matches '{hit}'")
                continue
            if tag_re:
                m = tag_re.search(_read(sp))
                if m:
                    fadd(n, f"uses <{m.group(1)}>")
    if reasons["frontend"]:
        fsel, fwhy = set(all_specs), {n: "full tier" for n in all_specs}
    # a frontend-only diff (no backend file) still runs the backend smoke + security sets, and the reverse
    return {
        "changed_files": len(paths),
        "full": {k: sorted(set(v)) for k, v in reasons.items()},
        "backend": {"selected": sorted(bsel), "dropped": sorted(set(all_tests) - bsel), "why": bwhy, "total": len(all_tests)},
        "frontend": {"selected": sorted(fsel), "dropped": sorted(set(all_specs) - fsel), "why": fwhy, "total": len(all_specs)},
    }


def select_diff(root: Path, base: str, head: str = "HEAD") -> dict:
    """select() for base...head; a full-tier trigger file whose diff only bumps a version string does not trigger."""
    changes = changed_files(root, base, head)
    vo = {p for s, p in changes if s == "M" and _full(p, FULL_BOTH + FULL_BACKEND + FULL_FRONTEND + [r"(^|/)config\.yaml$"])
          and version_only(root, base, head, p)}
    res = select(root, changes, vo)
    res["version_only_ignored"] = sorted(vo)
    res["base"], res["head"] = base, head
    return res


# ---------------------------------------------------------------- estimates (from gate_durations.json)
def estimate(root: Path, sel: dict, here: Path | None = None) -> dict:
    """Worker-minutes of the selected vs all tests: Playwright from the seed's per-spec seconds, backend from file sizes scaled to
    the seed's backend_shard_seconds_total (or backend_seconds when present)."""
    here = here or Path(__file__).resolve().parent
    seed = json.loads((here / "gate_durations.json").read_text(encoding="utf-8"))
    sec = seed.get("seconds", {})
    known = sorted(sec.values())
    med = known[len(known) // 2] if known else 60.0
    fe_all = sum(sec.get(n, med) for n in sel["frontend"]["selected"] + sel["frontend"]["dropped"])
    fe_sel = sum(sec.get(n, med) for n in sel["frontend"]["selected"])
    be = root / BE / "tests"
    bsec = seed.get("backend_seconds") or {}
    sizes = {n: (be / n).stat().st_size for n in sel["backend"]["selected"] + sel["backend"]["dropped"] if (be / n).exists()}
    tot = float(seed.get("backend_shard_seconds_total") or 0.0)
    scale = tot / (sum(sizes.values()) or 1)
    cost = {n: bsec.get(n, sizes[n] * scale) for n in sizes}
    be_all = sum(cost.values())
    be_sel = sum(cost[n] for n in sel["backend"]["selected"] if n in cost)
    return {"frontend_worker_min": (round(fe_sel / 60), round(fe_all / 60)), "backend_shard_min": (round(be_sel / 60), round(be_all / 60))}


# ---------------------------------------------------------------- audit (the nightly safety net)
def audit(nightly_json: Path, selections: list[Path]) -> str:
    """Every FAIL / FLAKY of a full nightly run that a recent selection run dropped (its file was not selected)."""
    d = json.loads(nightly_json.read_text(encoding="utf-8"))
    reds = [i for i in d.get("items", []) if i.get("status") in ("FAIL", "FLAKY")]

    def file_of(i):
        ident = i.get("id", "")
        if i.get("category") == "backend":
            m = re.match(r"tests/(test_[^:]+\.py)", ident)
            return ("backend", m.group(1)) if m else None
        m = re.match(r"([\w.-]+\.spec\.ts)", ident)
        return ("frontend", m.group(1)) if m else None

    lines = [f"# Selection audit: nightly {d.get('branch')} @ {d.get('sha')} ({d.get('finished', '')})", "",
             f"- nightly reds (FAIL + FLAKY): {len(reds)}; selection runs compared: {len(selections)}", ""]
    missed = 0
    for sp in selections:
        try:
            s = json.loads(sp.read_text(encoding="utf-8"))
        except Exception:
            continue
        drop = {"backend": set(s.get("backend", {}).get("dropped", [])), "frontend": set(s.get("frontend", {}).get("dropped", []))}
        hits = []
        for i in reds:
            f = file_of(i)
            if f and f[1] in drop[f[0]]:
                hits.append((i, f))
        missed += len(hits)
        lines.append(f"## {sp.name}: {len(hits)} nightly red(s) in files this selection dropped")
        lines += [f"- [{i['status']}] [{i['category']}] {i['id'][:160]}" for i, _ in hits] or ["- none"]
        lines.append("")
    lines.insert(3, f"- **would have been missed by a selection run: {missed}**")
    return "\n".join(lines) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("select", help="print the selection JSON for base...head")
    s.add_argument("--root", default=".")
    s.add_argument("--base", required=True)
    s.add_argument("--head", default="HEAD")
    s.add_argument("--out")
    r = sub.add_parser("report", help="selection summary with time estimates for one or more base..head pairs")
    r.add_argument("--root", default=".")
    r.add_argument("pairs", nargs="+", help="base..head")
    a = sub.add_parser("audit", help="nightly reds that selection runs dropped")
    a.add_argument("--nightly", required=True)
    a.add_argument("--selections", nargs="*", default=[])
    a.add_argument("--selections-dir")
    a.add_argument("--out")
    ns = ap.parse_args(argv)
    if ns.cmd == "select":
        res = select_diff(Path(ns.root), ns.base, ns.head)
        res["estimate"] = estimate(Path(ns.root), res)
        txt = json.dumps(res, indent=1, ensure_ascii=False)
        if ns.out:
            Path(ns.out).write_text(txt, encoding="utf-8")
        else:
            print(txt)
        return 0
    if ns.cmd == "report":
        root = Path(ns.root)
        pairs = []
        for pair in ns.pairs:
            if pair.startswith("merges:"):   # merges:<base>..<head>: every merge commit's own branch (second parent vs first)
                base, head = pair[len("merges:"):].split("..", 1)
                for line in git(root, "log", "--merges", "--first-parent", "--format=%H %p %s", f"{base}..{head}").splitlines():
                    sha, p1, p2, *subj = line.split(" ")
                    pairs.append((f"{p1[:9]}..{p2[:9]} ({' '.join(subj)[:60]})", p1, p2))
            else:
                base, head = pair.split("..", 1)
                pairs.append((pair, base, head))
        for label, base, head in pairs:
            res = select_diff(root, base, head)
            est = estimate(root, res)
            b, f = res["backend"], res["frontend"]
            print(f"{label}: {res['changed_files']} files; full backend: {'YES ' + ', '.join(res['full']['backend'][:2]) if res['full']['backend'] else 'no'}; "
                  f"full frontend: {'YES ' + ', '.join(res['full']['frontend'][:2]) if res['full']['frontend'] else 'no'}")
            print(f"  backend {len(b['selected'])}/{b['total']} files, ~{est['backend_shard_min'][0]} of {est['backend_shard_min'][1]} shard-min; "
                  f"frontend {len(f['selected'])}/{f['total']} specs, ~{est['frontend_worker_min'][0]} of {est['frontend_worker_min'][1]} worker-min")
        return 0
    sels = [Path(x) for x in ns.selections]
    if ns.selections_dir:
        sels += sorted(Path(ns.selections_dir).glob("gate_*.selection.json"), key=lambda p: p.stat().st_mtime)[-10:]
    txt = audit(Path(ns.nightly), sels)
    if ns.out:
        Path(ns.out).write_text(txt, encoding="utf-8")
    else:
        print(txt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
