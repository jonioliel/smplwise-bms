#!/usr/bin/env python3
"""Local gate for the intercom (WisKey) integration source folder: no hardware, no network, no secrets.

Specification: docs/integrations/wiskey/GATE_TOOL_SPEC.md. Summary:

  check      static checks of a source folder (structure, notes, contract, policy, socket scan, baseline)
  manifest   Arx-side import manifest (tree hashes) computed from the SOURCE; WisKey packages nothing
  run-tests  runs the folder's own test command with an offline guard (no non-loopback sockets, no DNS)

Exit codes follow docs/wiskey-exchange/schemas/1/GATE.md (0 pass, 1 fail, 2 input_invalid, 3 timeout,
4 missing_tests, 5 exclusions/policy violation, 6 environment_error, 7 network_attempt, 70 internal_error).
When several apply the first of 6, 2, 5, 7, 3, 4, 1 wins. Only 0 is success.

The tool never prints a matched secret, address or serial: findings carry code, path, line and a short kind.
Python 3.12, standard library only. It writes nothing except the optional --json/--out files and, for
run-tests, a temporary guard directory it removes again.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Iterable

TOOL_VERSION = "0.1.0"
REPORT_SCHEMA = "arx-exchange/local-gate-report/0"  # draft, local to this tool (not one of schemas/1)
MANIFEST_SCHEMA = "arx-exchange/import-manifest/0"  # draft

EXIT_NAMES = {0: "pass", 1: "fail", 2: "input_invalid", 3: "timeout", 4: "missing_tests",
              5: "exclusions_violation", 6: "environment_error", 7: "network_attempt", 70: "internal_error"}
PRIORITY = (6, 2, 5, 7, 3, 4, 1)

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".idea", ".vscode"}
NOT_IMPORTED_DIRS = {"private", "probe-output", "probes", "handoff", "logs", "tools", "frontend", "home_assistant_hikvision_intercom.egg-info"}
TEXT_EXT = {".py", ".json", ".md", ".txt", ".yaml", ".yml", ".toml", ".cfg", ".ini", ".ts", ".js", ".html", ".css",
            ".csv", ".sh", ".xml", ".env", ".rst", ".sql"}
MAX_TEXT_BYTES = 2_000_000
FORBIDDEN_IN_PACKAGE_DIRS = {"tests", "test", "private", "probe-output", "probes", "logs", ".git", "node_modules", "__pycache__", "secrets"}
FORBIDDEN_IN_PACKAGE_SUFFIX = (".log", ".pem", ".key", ".p12", ".pfx", ".pyc", ".zip", ".sqlite", ".db", ".har", ".pcap")
FORBIDDEN_IN_PACKAGE_NAMES = {".env", "secrets.json", "secrets.yaml", "lab.env", ".DS_Store"}

SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.(0|[1-9]\d*))?$")
DOMAIN_RE = re.compile(r"^[a-z][a-z0-9_]*$")

# findings whose code starts with S_ are structural (exit 2), R_ are policy / exclusion (exit 5), M_ missing tests (4)


class Finding(dict):
    pass


def finding(code: str, severity: str, message: str, path: str | None = None, line: int | None = None, **extra: Any) -> Finding:
    f = Finding(code=code, severity=severity, message=message)
    if path is not None:
        f["path"] = path
    if line is not None:
        f["line"] = line
    f.update(extra)
    return f


# ---------------------------------------------------------------- helpers

def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def load_json_strict(p: Path) -> Any:
    """JSON with duplicate keys refused at every depth (GATE.md common rule)."""
    def hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        seen: dict[str, Any] = {}
        for k, v in pairs:
            if k in seen:
                raise ValueError(f"duplicate key {k!r}")
            seen[k] = v
        return seen
    return json.loads(p.read_text(encoding="utf-8"), object_pairs_hook=hook)


def walk_files(root: Path) -> Iterable[Path]:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for fn in sorted(filenames):
            yield Path(dirpath) / fn


def rel(p: Path, root: Path) -> str:
    return p.relative_to(root).as_posix()


def parse_semver(v: str) -> tuple[int, int, int, int, int] | None:
    m = SEMVER.match(v)
    if not m:
        return None
    a, b, c, rc = m.groups()
    # a release sorts above its release candidates: rc.N -> (0, N), release -> (1, 0)
    return (int(a), int(b), int(c), 0 if rc is not None else 1, int(rc) if rc is not None else 0)


def read_text(p: Path) -> str | None:
    try:
        if p.stat().st_size > MAX_TEXT_BYTES:
            return None
        return p.read_bytes().decode("utf-8", errors="replace")
    except OSError:
        return None


# ---------------------------------------------------------------- layout discovery

class Layout:
    def __init__(self, root: Path) -> None:
        self.root = root
        cc = root / "custom_components"
        self.domains = sorted(d.name for d in cc.iterdir() if d.is_dir() and d.name not in SKIP_DIRS) if cc.is_dir() else []
        self.domain = self.domains[0] if len(self.domains) == 1 else None
        self.package_dir = cc / self.domain if self.domain else None
        self.tests_dir = root / "tests"
        self.notes = root / "RELEASE_NOTES.md"
        self.impact = root / "ARX_IMPACT.md"
        self.contract_dir = root / "contract"
        self.timers_doc = root / "docs" / "AUTONOMOUS_TIMERS.md"
        self.provider_doc = root / "docs" / "PROVIDER_INTERFACE.md"
        self.requirements = root / "requirements-ha-test.txt"

    def scan_roots(self) -> list[Path]:
        """What the importer takes, hence what the gate scans: the package, tests, notes, contract, docs, requirements."""
        out: list[Path] = []
        for p in (self.package_dir, self.tests_dir, self.contract_dir, root_docs(self.root)):
            if p and p.is_dir():
                out.append(p)
        for p in (self.notes, self.impact, self.requirements, self.root / "pytest.ini", self.root / "setup.cfg",
                  self.root / "tox.ini", self.root / "pyproject.toml", self.root / "conftest.py"):
            if p.is_file():
                out.append(p)
        return out


def root_docs(root: Path) -> Path | None:
    d = root / "docs"
    return d if d.is_dir() else None


def iter_scan_files(layout: Layout) -> Iterable[Path]:
    seen: set[Path] = set()
    for r in layout.scan_roots():
        files = [r] if r.is_file() else list(walk_files(r))
        for f in files:
            if f not in seen:
                seen.add(f)
                yield f


# ---------------------------------------------------------------- structure checks

def check_structure(layout: Layout, installed_version: str | None) -> tuple[list[Finding], dict[str, Any]]:
    out: list[Finding] = []
    info: dict[str, Any] = {"domain": layout.domain, "version": None}
    root = layout.root
    if not (root / "custom_components").is_dir():
        out.append(finding("S_NO_CUSTOM_COMPONENTS", "error", "custom_components/ is missing"))
        return out, info
    if len(layout.domains) != 1:
        out.append(finding("S_DOMAIN_COUNT", "error", f"exactly one custom_components/<domain>/ is required, found {len(layout.domains)}"))
        return out, info
    if not DOMAIN_RE.match(layout.domain or ""):
        out.append(finding("S_DOMAIN_NAME", "error", "domain must be lower-case letters, digits and underscores", path=f"custom_components/{layout.domain}"))
    mf = layout.package_dir / "manifest.json"  # type: ignore[operator]
    version = None
    if not mf.is_file():
        out.append(finding("S_MANIFEST_MISSING", "error", "manifest.json is missing", path=rel(mf, root)))
    else:
        try:
            data = load_json_strict(mf)
        except (ValueError, OSError) as exc:
            out.append(finding("S_MANIFEST_JSON", "error", f"manifest.json is not strict JSON: {exc}", path=rel(mf, root)))
            data = None
        if isinstance(data, dict):
            for k in ("domain", "name", "version"):
                if k not in data:
                    out.append(finding("S_MANIFEST_FIELD", "error", f"manifest.json lacks {k!r}", path=rel(mf, root)))
            if data.get("domain") != layout.domain:
                out.append(finding("S_DOMAIN_MISMATCH", "error", "manifest domain differs from the directory name", path=rel(mf, root)))
            version = data.get("version")
            if not isinstance(version, str) or parse_semver(version) is None:
                out.append(finding("S_VERSION_FORMAT", "error", "version must be semver X.Y.Z or X.Y.Z-rc.N", path=rel(mf, root)))
                version = None
        elif data is not None:
            out.append(finding("S_MANIFEST_JSON", "error", "manifest.json is not an object", path=rel(mf, root)))
    info["version"] = version
    if version and installed_version:
        a, b = parse_semver(version), parse_semver(installed_version)
        if b is None:
            out.append(finding("S_INSTALLED_VERSION_FORMAT", "error", "--installed-version is not semver"))
        elif a is not None and a <= b:
            out.append(finding("S_VERSION_NOT_GREATER", "error", "version is not greater than the installed one (Arx never downgrades)"))

    if not layout.tests_dir.is_dir() or not any(layout.tests_dir.rglob("test_*.py")):
        out.append(finding("S_NO_TESTS", "error", "tests/ with at least one test_*.py is required", path="tests"))
    if not layout.requirements.is_file():
        out.append(finding("S_REQUIREMENTS_MISSING", "error", "requirements-ha-test.txt is missing", path="requirements-ha-test.txt"))
    else:
        loose = [i + 1 for i, ln in enumerate((read_text(layout.requirements) or "").splitlines())
                 if ln.strip() and not ln.lstrip().startswith(("#", "-")) and "==" not in ln]
        for ln in loose[:20]:
            out.append(finding("S_REQUIREMENT_NOT_PINNED", "error", "requirement is not pinned with ==", path="requirements-ha-test.txt", line=ln))

    out.extend(check_notes(layout, version))
    out.extend(check_contract(layout))
    for doc, code, sev in ((layout.timers_doc, "S_TIMERS_DOC_MISSING", "error"), (layout.provider_doc, "S_PROVIDER_DOC_MISSING", "warning")):
        if not doc.is_file():
            out.append(finding(code, sev, f"{rel(doc, root)} is missing", path=rel(doc, root)))
    if layout.package_dir:
        for f in layout.package_dir.rglob("*.py"):
            b = f.read_bytes()
            if b"\r\n" in b:
                out.append(finding("S_CRLF", "warning", "CRLF line endings (LF is enforced)", path=rel(f, root)))
                break
    return out, info


NOTES_HEADINGS = ("added", "fixed", "how to enable", "risk to doors", "rollback")
IMPACT_TOPICS = ("ws command", "permission", "entit", "storage", "setting", "restart", "migration")
HEBREW = re.compile(r"[֐-׿]")


def check_notes(layout: Layout, version: str | None) -> list[Finding]:
    out: list[Finding] = []
    root = layout.root
    if not layout.notes.is_file():
        out.append(finding("S_NOTES_MISSING", "error", "RELEASE_NOTES.md is missing", path="RELEASE_NOTES.md"))
    else:
        text = read_text(layout.notes) or ""
        low = text.lower()
        heads = [ln.lower() for ln in text.splitlines() if ln.lstrip().startswith("#")]
        for h in NOTES_HEADINGS:
            if not any(h in ln for ln in heads):
                out.append(finding("S_NOTES_HEADING", "error", f"RELEASE_NOTES.md lacks a heading containing {h!r}", path="RELEASE_NOTES.md"))
        if not HEBREW.search(text) or not re.search(r"[A-Za-z]{4}", text):
            out.append(finding("S_NOTES_NOT_BILINGUAL", "error", "RELEASE_NOTES.md must contain Hebrew and English", path="RELEASE_NOTES.md"))
        if version and version.lower() not in low:
            out.append(finding("S_NOTES_VERSION", "error", "RELEASE_NOTES.md does not mention the manifest version", path="RELEASE_NOTES.md"))
    if not layout.impact.is_file():
        out.append(finding("S_IMPACT_MISSING", "error", "ARX_IMPACT.md is missing", path="ARX_IMPACT.md"))
    else:
        low = (read_text(layout.impact) or "").lower()
        for t in IMPACT_TOPICS:
            if t not in low:
                out.append(finding("S_IMPACT_TOPIC", "error", f"ARX_IMPACT.md does not address {t!r} (write 'none' when nothing changed)", path="ARX_IMPACT.md"))
    return out


def check_contract(layout: Layout) -> list[Finding]:
    out: list[Finding] = []
    root = layout.root
    if not layout.contract_dir.is_dir():
        return [finding("S_CONTRACT_MISSING", "error", "contract/ is missing", path="contract")]
    version_found = (layout.contract_dir / "CONTRACT_VERSION").is_file()
    for name in ("ws-commands.json", "errors.json"):
        p = layout.contract_dir / name
        if not p.is_file():
            out.append(finding("S_CONTRACT_FILE", "error", f"contract/{name} is missing", path=f"contract/{name}"))
            continue
        try:
            data = load_json_strict(p)
        except (ValueError, OSError) as exc:
            out.append(finding("S_CONTRACT_JSON", "error", f"contract/{name} is not strict JSON: {exc}", path=rel(p, root)))
            continue
        if isinstance(data, dict) and isinstance(data.get("contract_version"), str):
            version_found = True
    if not version_found:
        out.append(finding("S_CONTRACT_VERSION", "error", "no contract_version (CONTRACT_VERSION file or key in the contract JSON)", path="contract"))
    return out


# ---------------------------------------------------------------- policy: forbidden files, secrets, timers

def check_package_contents(layout: Layout) -> list[Finding]:
    out: list[Finding] = []
    if not layout.package_dir or not layout.package_dir.is_dir():
        return out
    for f in walk_files(layout.package_dir):
        parts = f.relative_to(layout.package_dir).parts
        name = f.name
        bad = (set(parts[:-1]) & FORBIDDEN_IN_PACKAGE_DIRS) or name in FORBIDDEN_IN_PACKAGE_NAMES or name.endswith(FORBIDDEN_IN_PACKAGE_SUFFIX)
        if bad:
            out.append(finding("R_FORBIDDEN_IN_PACKAGE", "error", "file kind must never ship inside custom_components/<domain>/", path=rel(f, layout.root)))
    return out


_IPV4 = re.compile(r"(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.]*\d)")
_MAC = re.compile(r"(?<![0-9A-Fa-f:-])((?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})(?![0-9A-Fa-f:-])")
_JWT = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}")
_PEM = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")
_ASSIGN = re.compile(
    r"""(?ix)\b(?P<name>[a-z0-9_]*(?:password|passwd|secret|token|api_?key|hmac|pairing|signing_?key|serial(?:_?number)?|pin_?code))\b
        \s*[:=]\s*(?P<q>["'])(?P<val>[^"'\n]{6,})(?P=q)""")
_PLACEHOLDER = re.compile(r"(?i)(example|dummy|fake|test|placeholder|redacted|changeme|xxxx|\*\*\*|<.*>|\$\{|\{\{|synthetic|sample|not[-_ ]?real|0{6,}|1234|secret|private|password|passwd|admin|demo|probe|model|mock|stub)")
_ALLOW = re.compile(r"gate:allow\((?P<code>[A-Z_]+)\):\s*(?P<why>\S.{8,})")
_DOC_MAC_PREFIX = ("00:00:5e:00:53", "00-00-5e-00-53")


def _ipv4_issue(m: re.Match[str]) -> bool:
    o = [int(x) for x in m.groups()]
    if any(x > 255 for x in o):
        return False  # not an address (version strings and similar)
    a, b, c, _d = o
    if a == 127 or (a == 0) or (a == 255) or (a, b, c) in ((192, 0, 2), (198, 51, 100), (203, 0, 113)):
        return False  # loopback, unspecified, mask-like, RFC 5737 documentation ranges
    return True


def scan_text_for_leaks(layout: Layout) -> tuple[list[Finding], list[Finding]]:
    """Returns (findings, allowed). Never records the matched value."""
    out: list[Finding] = []
    allowed: list[Finding] = []
    for f in iter_scan_files(layout):
        if f.suffix.lower() not in TEXT_EXT and f.name not in FORBIDDEN_IN_PACKAGE_NAMES:
            continue
        text = read_text(f)
        if text is None:
            continue
        relp = rel(f, layout.root)
        for i, ln in enumerate(text.splitlines(), 1):
            hits: list[tuple[str, str]] = []
            if any(_ipv4_issue(m) for m in _IPV4.finditer(ln)):
                hits.append(("R_LEAK_IP", "IPv4 address outside loopback and documentation ranges"))
            for m in _MAC.finditer(ln):
                v = m.group(1).lower()
                if not (v.replace("-", ":") in ("00:00:00:00:00:00", "ff:ff:ff:ff:ff:ff") or v.startswith(_DOC_MAC_PREFIX)):
                    hits.append(("R_LEAK_MAC", "MAC address"))
                    break
            if _JWT.search(ln):
                hits.append(("R_LEAK_TOKEN", "JWT-shaped token"))
            if _PEM.search(ln):
                hits.append(("R_LEAK_PRIVATE_KEY", "PEM private key header"))
            for m in _ASSIGN.finditer(ln):
                if not _PLACEHOLDER.search(m.group("val")):
                    code = "R_LEAK_SERIAL" if "serial" in m.group("name").lower() else "R_LEAK_SECRET"
                    hits.append((code, f"literal value assigned to a {code[7:].lower()}-named variable"))
                    break
            if not hits:
                continue
            am = _ALLOW.search(ln)
            for code, msg in hits:
                fi = finding(code, "error", msg, path=relp, line=i)
                if am and am.group("code") == code:
                    fi["severity"] = "allowed"
                    fi["reason_len"] = len(am.group("why"))
                    allowed.append(fi)
                else:
                    out.append(fi)
    return out, allowed


_TIMER_CALLS = {"async_track_time_interval", "async_call_later", "async_track_point_in_time", "async_track_time_change",
                "async_track_utc_time_change", "call_later", "call_at"}


def check_timers(layout: Layout) -> list[Finding]:
    """Every module that arms an autonomous timer must be named in docs/AUTONOMOUS_TIMERS.md (brief 6.3)."""
    out: list[Finding] = []
    if not layout.package_dir or not layout.timers_doc.is_file():
        return out
    doc = (read_text(layout.timers_doc) or "").lower()
    for f in layout.package_dir.rglob("*.py"):
        text = read_text(f)
        if text is None:
            continue
        try:
            tree = ast.parse(text)
        except SyntaxError:
            out.append(finding("S_PY_SYNTAX", "error", "python file does not parse", path=rel(f, layout.root)))
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                fn = node.func
                name = fn.id if isinstance(fn, ast.Name) else fn.attr if isinstance(fn, ast.Attribute) else ""
                if name in _TIMER_CALLS and f.stem.lower() not in doc and f.name.lower() not in doc:
                    out.append(finding("R_TIMER_UNDOCUMENTED", "error", f"{name} used in a module not listed in docs/AUTONOMOUS_TIMERS.md",
                                       path=rel(f, layout.root), line=node.lineno))
                    break
    return out


# ---------------------------------------------------------------- socket scan (AST), mirrors gate-env/3

MECHANISMS = ("fixture_socket_enabled", "marker_enable_socket", "marker_allow_hosts", "call_socket_allow_hosts",
              "call_enable_socket", "string_lookup", "import_pytest_socket", "cli_or_ini_option", "plugin_disabled")
_OPT = re.compile(r"--(?:allow-hosts|force-enable-socket|allow-unix-socket)\b")
_PLUGOFF = re.compile(r"(?:^|\s|-p\s?)no:(?:pytest_)?socket\b")
_FIX_NAMES = {"socket_enabled", "enable_socket"}
_LOOKUP_FUNCS = {"getfixturevalue", "usefixtures", "addinivalue_line"}
_OPT_CALLS = {"main", "addinivalue_line", "addoption", "parse_args", "parse", "getoption"}
_OPT_VARS = re.compile(r"(?i)addopts|pytest_addopts|pytest_plugins|pytest_args|args")


def _strings(node: ast.AST) -> Iterable[str]:
    for n in ast.walk(node):
        if isinstance(n, ast.Constant) and isinstance(n.value, str):
            yield n.value


class _SocketVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.sites: list[dict[str, Any]] = []
        self.func_stack: list[str] = []
        self.mark_aliases: set[str] = set()
        self.socket_aliases: dict[str, str] = {}  # local name -> pytest_socket attr

    def add(self, mech: str, node: ast.AST) -> None:
        s: dict[str, Any] = {"mechanism": mech, "line": getattr(node, "lineno", 0)}
        if self.func_stack:
            s["function"] = self.func_stack[-1]
        self.sites.append(s)

    def visit_Import(self, node: ast.Import) -> None:
        for a in node.names:
            if a.name.split(".")[0] == "pytest_socket":
                self.add("import_pytest_socket", node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if (node.module or "").split(".")[0] == "pytest_socket":
            self.add("import_pytest_socket", node)
            for a in node.names:
                self.socket_aliases[a.asname or a.name] = a.name

    def _func(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        a = node.args
        names = [x.arg for x in (*a.posonlyargs, *a.args, *a.kwonlyargs)]
        self.func_stack.append(node.name)
        if "socket_enabled" in names:
            self.add("fixture_socket_enabled", node)
        self.generic_visit(node)
        self.func_stack.pop()

    visit_FunctionDef = _func
    visit_AsyncFunctionDef = _func

    def _assign_common(self, targets: list[ast.expr], value: ast.AST | None, node: ast.AST) -> None:
        if value is None:
            return
        if isinstance(value, ast.Attribute) and value.attr == "mark":
            for t in targets:
                if isinstance(t, ast.Name):
                    self.mark_aliases.add(t.id)
        names = [t.id for t in targets if isinstance(t, ast.Name)]
        if any(_OPT_VARS.search(n) for n in names):
            for s in _strings(value):
                self._option_string(s, node)
        if any("fixtures" in n.lower() for n in names):
            for s in _strings(value):
                if s in _FIX_NAMES:
                    self.add("string_lookup", node)

    def visit_Assign(self, node: ast.Assign) -> None:
        self._assign_common(node.targets, node.value, node)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        self._assign_common([node.target], node.value, node)
        self.generic_visit(node)

    def _option_string(self, s: str, node: ast.AST) -> None:
        if _OPT.search(s):
            self.add("cli_or_ini_option", node)
        if _PLUGOFF.search(s) or re.fullmatch(r"-?p?no:(?:pytest_)?socket", s.strip()):
            self.add("plugin_disabled", node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        base = node.value
        is_mark = (isinstance(base, ast.Attribute) and base.attr == "mark") or (isinstance(base, ast.Name) and (base.id == "mark" or base.id in self.mark_aliases))
        if is_mark and node.attr == "enable_socket":
            self.add("marker_enable_socket", node)
        elif is_mark and node.attr == "allow_hosts":
            self.add("marker_allow_hosts", node)
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        fn = node.func
        name = fn.id if isinstance(fn, ast.Name) else fn.attr if isinstance(fn, ast.Attribute) else ""
        real = self.socket_aliases.get(name, name) if isinstance(fn, ast.Name) else name
        if real == "enable_socket" and not (isinstance(fn, ast.Attribute) and _is_mark(fn.value, self.mark_aliases)):
            self.add("call_enable_socket", node)
        if real == "socket_allow_hosts":
            self.add("call_socket_allow_hosts", node)
        arg_nodes: list[ast.AST] = [*node.args, *(k.value for k in node.keywords)]
        if name in _LOOKUP_FUNCS:
            for a in arg_nodes:
                for s in _strings(a):
                    if s in _FIX_NAMES:
                        self.add("string_lookup", node)
        if name in _OPT_CALLS:
            for a in arg_nodes:
                for s in _strings(a):
                    self._option_string(s, node)
        self.generic_visit(node)


def _is_mark(base: ast.AST, aliases: set[str]) -> bool:
    return (isinstance(base, ast.Attribute) and base.attr == "mark") or (isinstance(base, ast.Name) and (base.id == "mark" or base.id in aliases))


def scan_sockets(layout: Layout) -> tuple[list[dict[str, Any]], list[Finding]]:
    """Static AST scan of tests/**/*.py, conftest.py and the pytest config files. Returns (sites, structural findings)."""
    sites: list[dict[str, Any]] = []
    errs: list[Finding] = []
    root = layout.root
    py_files = list(layout.tests_dir.rglob("*.py")) if layout.tests_dir.is_dir() else []
    if (root / "conftest.py").is_file():
        py_files.append(root / "conftest.py")
    for f in sorted(set(py_files)):
        if any(p in SKIP_DIRS for p in f.parts):
            continue
        text = read_text(f)
        if text is None:
            continue
        try:
            tree = ast.parse(text)
        except SyntaxError:
            errs.append(finding("S_PY_SYNTAX", "error", "python file does not parse", path=rel(f, root)))
            continue
        v = _SocketVisitor()
        v.visit(tree)
        digest = sha256_file(f)
        for s in v.sites:
            sites.append({"path": rel(f, root), "file_sha256": digest, **s})
    for name in ("pyproject.toml", "setup.cfg", "pytest.ini", "tox.ini"):
        f = root / name
        text = read_text(f) if f.is_file() else None
        if text is None:
            continue
        digest = sha256_file(f)
        for i, ln in enumerate(text.splitlines(), 1):
            if ln.lstrip().startswith("#"):
                continue
            if _OPT.search(ln):
                sites.append({"path": name, "file_sha256": digest, "mechanism": "cli_or_ini_option", "line": i})
            if _PLUGOFF.search(ln):
                sites.append({"path": name, "file_sha256": digest, "mechanism": "plugin_disabled", "line": i})
    return sites, errs


def check_sockets(sites: list[dict[str, Any]], exceptions_path: Path | None, pinned_sha: str | None) -> list[Finding]:
    out: list[Finding] = []
    registered: list[dict[str, Any]] = []
    if exceptions_path is not None:
        try:
            doc = load_json_strict(exceptions_path)
            assert isinstance(doc, dict) and doc.get("schema") == "arx-exchange/socket-exceptions/1"
            assert isinstance(doc.get("exceptions"), list)
            if doc.get("gate_flags", {}).get("allow_unix_socket") is not False or doc.get("gate_flags", {}).get("force_enable_socket") is not False:
                raise AssertionError("gate_flags")
        except (AssertionError, ValueError, OSError):
            return [finding("S_SOCKET_EXCEPTIONS_INVALID", "error", "socket exceptions file is not a valid arx-exchange/socket-exceptions/1 document")]
        actual = sha256_file(exceptions_path)
        if not pinned_sha or pinned_sha.lower() != actual:
            out.append(finding("R_SOCKET_EXCEPTIONS_UNREGISTERED", "error",
                               "socket exceptions file is valid but its sha256 is not the registered one (pass the registered hash via --socket-exceptions-sha256)"))
            return out + [finding("R_SOCKET_NEW_USE", "error", f"{s['mechanism']} not covered (exceptions unregistered)", path=s["path"], line=s["line"]) for s in sites]
        registered = [e for e in doc["exceptions"] if isinstance(e, dict)]
    for s in sites:
        ok = False
        for e in registered:
            if e.get("path") == s["path"] and e.get("file_sha256") == s["file_sha256"] and e.get("mechanism") == s["mechanism"] \
                    and e.get("network_scope") == "loopback_only":
                for site in e.get("sites", []):
                    if site.get("line") == s["line"] and site.get("function") == s.get("function"):
                        ok = True
        if not ok:
            out.append(finding("R_SOCKET_NEW_USE", "error", f"{s['mechanism']} is not a registered exception", path=s["path"], line=s["line"]))
    return out


# ---------------------------------------------------------------- baseline (static)

_EXCL_MARKS = {"hardware", "repo_only", "skip"}


def static_tests(layout: Layout) -> dict[str, dict[str, Any]]:
    """Per test file: static test-function count (a LOWER bound: parametrization is not expanded) and excluded node ids."""
    out: dict[str, dict[str, Any]] = {}
    if not layout.tests_dir.is_dir():
        return out
    for f in sorted(layout.tests_dir.rglob("test_*.py")):
        text = read_text(f)
        if text is None:
            continue
        try:
            tree = ast.parse(text)
        except SyntaxError:
            continue
        info: dict[str, Any] = {"count": 0, "excluded": [], "parametrized": "parametrize" in text, "markers": {}}
        relp = rel(f, layout.root)

        def visit(body: list[ast.stmt], prefix: str) -> None:
            for n in body:
                if isinstance(n, ast.ClassDef) and n.name.startswith("Test"):
                    visit(n.body, prefix + n.name + "::")
                elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name.startswith("test"):
                    info["count"] += 1
                    marks = set()
                    for d in n.decorator_list:
                        t = d.func if isinstance(d, ast.Call) else d
                        if isinstance(t, ast.Attribute):
                            marks.add(t.attr)
                    for m in marks:
                        info["markers"][m] = info["markers"].get(m, 0) + 1
                    if marks & _EXCL_MARKS:
                        info["excluded"].append(f"{relp}::{prefix}{n.name}")
        visit(tree.body, "")
        out[relp] = info
    return out


def check_baseline(layout: Layout, baseline_path: Path | None, pinned_sha: str | None) -> tuple[list[Finding], list[Finding]]:
    """Returns (policy findings -> 5, missing-test findings -> 4)."""
    if baseline_path is None:
        return [], []
    try:
        bl = load_json_strict(baseline_path)
        assert isinstance(bl, dict) and bl.get("schema") == "arx-exchange/baseline-exclusions/1"
    except (AssertionError, ValueError, OSError):
        return [finding("S_BASELINE_INVALID", "error", "baseline is not a valid arx-exchange/baseline-exclusions/1 document")], []
    pol: list[Finding] = []
    miss: list[Finding] = []
    if not pinned_sha or pinned_sha.lower() != sha256_file(baseline_path):
        pol.append(finding("R_BASELINE_UNKNOWN", "error", "baseline sha256 is not the registered one (pass it via --baseline-sha256)"))
        return pol, miss
    tests = static_tests(layout)
    allowed = {e.get("node_id") for e in bl.get("exclusions", []) if isinstance(e, dict)}
    mandatory = [m for m in bl.get("mandatory", []) if isinstance(m, dict)]
    for relp, info in tests.items():
        for node in info["excluded"]:
            if node not in allowed:
                pol.append(finding("R_EXCLUSION_NOT_IN_BASELINE", "error", "test is excluded by marker but not in the registered baseline", path=relp, node_id=node))
            for m in mandatory:
                if (m.get("match") == "node_id" and m.get("value") == node) or (m.get("match") == "file" and m.get("value") == relp):
                    pol.append(finding("R_MANDATORY_TEST_EXCLUDED", "error", "a mandatory test is excluded", path=relp, node_id=node))
    seen_missing: set[tuple[str, str]] = set()
    for m in mandatory:
        match, value, need = m.get("match"), str(m.get("value", "")), int(m.get("min_count", 1) or 1)
        have: int
        param = False
        if match == "file":
            info = tests.get(value)
            have = info["count"] if info else 0
            param = bool(info and info["parametrized"])
        elif match == "node_id":
            f = value.partition("::")[0]
            info = tests.get(f)
            have = 1 if info and info["count"] and value not in info["excluded"] else 0
            param = bool(info and info["parametrized"])
        elif match == "marker":
            have = sum(i["markers"].get(value, 0) for i in tests.values())
            param = any(i["parametrized"] for i in tests.values())
        else:
            continue
        if have < need and (match, value) not in seen_missing:
            seen_missing.add((match, value))
            sev = "warning" if param and have else "error"
            miss.append(finding("M_MANDATORY_MISSING", sev, f"mandatory selector has {have} static tests, needs {need}" + (" (parametrized, count is a lower bound)" if param else ""),
                                path=value if match == "file" else None, category=m.get("category")))
    return pol, [x for x in miss]


# ---------------------------------------------------------------- manifest

def tree_manifest(root: Path, files: list[Path]) -> dict[str, Any]:
    rows = [{"path": rel(f, root), "size": f.stat().st_size, "sha256": sha256_file(f)} for f in files]
    rows.sort(key=lambda r: r["path"].encode("utf-8"))
    tree = sha256_bytes("".join(f"{r['sha256']}  {r['path']}\n" for r in rows).encode("utf-8"))
    return {"file_count": len(rows), "tree_sha256": tree, "files": rows}


def build_manifest(layout: Layout, info: dict[str, Any], source_commit: str | None, extra_hashes: dict[str, str]) -> dict[str, Any]:
    root = layout.root
    pkg_files = [f for f in walk_files(layout.package_dir) if f.suffix != ".pyc" and f.name != ".DS_Store"] if layout.package_dir and layout.package_dir.is_dir() else []
    tests_files = [f for f in walk_files(layout.tests_dir) if f.suffix != ".pyc"] if layout.tests_dir.is_dir() else []
    notes: dict[str, str] = {}
    for p in (layout.notes, layout.impact, layout.requirements, layout.timers_doc, layout.provider_doc):
        if p.is_file():
            notes[rel(p, root)] = sha256_file(p)
    contract = tree_manifest(root, list(walk_files(layout.contract_dir))) if layout.contract_dir.is_dir() else None
    not_imported = sorted(d.name for d in root.iterdir() if d.is_dir() and d.name in NOT_IMPORTED_DIRS) if root.is_dir() else []
    return {
        "schema": MANIFEST_SCHEMA,
        "built_by": "arx_importer (computed from source; the integration team ships no manifest or archive)",
        "profile": "unsigned_for_test",
        "signature": None,
        "domain": info.get("domain"),
        "version": info.get("version"),
        "source_commit": source_commit,
        "tree_hash_rule": "sha256 over UTF-8 lines '<sha256>  <posix path>\\n' sorted by path bytes; file bytes hashed as stored (LF)",
        "package": tree_manifest(root, pkg_files),
        "tests": tree_manifest(root, tests_files),
        "contract": contract,
        "notes_sha256": notes,
        "registered_inputs": extra_hashes,
        "not_imported_dirs": not_imported,
    }


# ---------------------------------------------------------------- offline guard + run-tests

GUARD_SOURCE = '''\
"""sitecustomize injected by wiskey_gate run-tests: block every non-loopback socket operation and DNS lookup.
Attempts are appended to the file named by WISKEY_GATE_NET_LOG as one 'event' per line (no addresses are logged)."""
import ipaddress, os, sys
_LOG = os.environ.get("WISKEY_GATE_NET_LOG")
def _loopback(host):
    if isinstance(host, bytes):
        host = host.decode("ascii", "ignore")
    if host in ("localhost", "", None):
        return True
    try:
        return ipaddress.ip_address(host).is_loopback or host in ("0.0.0.0", "::")
    except ValueError:
        return False
def _hook(event, args):
    if event in ("socket.connect", "socket.sendto", "socket.bind"):
        addr = args[1]
        host = addr[0] if isinstance(addr, tuple) and addr else addr
        if isinstance(addr, (str, bytes)):  # AF_UNIX path
            return
        if _loopback(host):
            return
    elif event == "socket.getaddrinfo":
        if _loopback(args[0]):
            return
    elif event == "socket.gethostbyname":
        if _loopback(args[0]):
            return
    else:
        return
    if _LOG:
        with open(_LOG, "a", encoding="utf-8") as fh:
            fh.write(event + "\\n")
    raise OSError("network blocked by wiskey_gate offline guard")
sys.addaudithook(_hook)
'''


def run_tests(source: Path, command: list[str], budget_s: int, expected_collected: int | None, junit: Path | None) -> dict[str, Any]:
    t0 = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="wiskey_gate_") as td:
        guard = Path(td) / "guard"
        guard.mkdir()
        (guard / "sitecustomize.py").write_text(GUARD_SOURCE, encoding="utf-8")
        netlog = Path(td) / "net.log"
        env = {k: v for k, v in os.environ.items() if not k.upper().startswith(("PROXY", "HTTP_PROXY", "HTTPS_PROXY"))}
        env["PYTHONPATH"] = str(guard) + os.pathsep + env.get("PYTHONPATH", "")
        env["WISKEY_GATE_NET_LOG"] = str(netlog)
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        hard = budget_s + 60
        try:
            proc = subprocess.run(command, cwd=source, env=env, capture_output=True, text=True, timeout=hard, check=False)
            rc, out, err, timed_out = proc.returncode, proc.stdout, proc.stderr, False
        except subprocess.TimeoutExpired as exc:
            rc, out, err, timed_out = -1, (exc.stdout or "") if isinstance(exc.stdout, str) else "", "", True
        except (FileNotFoundError, PermissionError):
            return {"exit_code": 6, "result": EXIT_NAMES[6], "detail": "test command could not be started", "duration_s": round(time.monotonic() - t0, 2)}
        attempts = len(netlog.read_text(encoding="utf-8").splitlines()) if netlog.is_file() else 0
    collected = None
    m = re.search(r"(\d+) (?:passed|failed|error|skipped)", out)
    if m:
        collected = sum(int(x) for x in re.findall(r"(\d+) (?:passed|failed|errors?|skipped)", out))
    codes: list[int] = []
    if attempts:
        codes.append(7)
    if timed_out or (time.monotonic() - t0) > hard:
        codes.append(3)
    if not timed_out:
        if rc == 5 or (expected_collected is not None and collected is not None and collected < expected_collected):
            codes.append(4)
        elif rc not in (0, 5):
            codes.append(1)
    return {
        "exit_code": pick_exit(codes), "result": EXIT_NAMES[pick_exit(codes)], "pytest_returncode": rc, "collected_estimate": collected,
        "network_attempts": attempts, "timed_out": timed_out, "duration_s": round(time.monotonic() - t0, 2),
        "stdout_tail": out[-1500:], "stderr_tail": (err or "")[-800:],
    }


def pick_exit(codes: Iterable[int]) -> int:
    s = set(codes)
    for c in PRIORITY:
        if c in s:
            return c
    return 0 if not s else 70


# ---------------------------------------------------------------- orchestration

def classify(findings: list[Finding]) -> list[int]:
    codes: list[int] = []
    for f in findings:
        if f["severity"] != "error":
            continue
        c = f["code"]
        if c.startswith("S_"):
            codes.append(2)
        elif c.startswith("R_"):
            codes.append(5)
        elif c.startswith("M_"):
            codes.append(4)
    return codes


def run_check(source: Path, *, installed_version: str | None = None, baseline: Path | None = None, baseline_sha: str | None = None,
              socket_exceptions: Path | None = None, socket_sha: str | None = None, source_commit: str | None = None) -> dict[str, Any]:
    layout = Layout(source)
    findings: list[Finding] = []
    structure, info = check_structure(layout, installed_version)
    findings.extend(structure)
    notes_extra: list[str] = []
    allowed: list[Finding] = []
    sites: list[dict[str, Any]] = []
    if layout.domain:
        findings.extend(check_package_contents(layout))
        leaks, allowed = scan_text_for_leaks(layout)
        findings.extend(leaks)
        findings.extend(check_timers(layout))
        sites, serrs = scan_sockets(layout)
        findings.extend(serrs)
        findings.extend(check_sockets(sites, socket_exceptions, socket_sha))
        pol, miss = check_baseline(layout, baseline, baseline_sha)
        findings.extend(pol)
        findings.extend(miss)
        if baseline is None:
            notes_extra.append("baseline not supplied: exclusion and mandatory-test checks NOT_RUN")
    manifest = build_manifest(layout, info, source_commit, {k: v for k, v in (("baseline_sha256", baseline_sha), ("socket_exceptions_sha256", socket_sha)) if v}) if layout.domain else None
    code = pick_exit(classify(findings))
    return {
        "schema": REPORT_SCHEMA, "tool_version": TOOL_VERSION, "exit_code": code, "result": EXIT_NAMES[code],
        "domain": info.get("domain"), "version": info.get("version"),
        "findings": findings, "allowed": allowed, "socket_sites": [{k: v for k, v in s.items() if k != "file_sha256"} for s in sites],
        "manifest": manifest,
        "not_run": ["tests (use run-tests)", "hardware", "live Home Assistant", "network", *notes_extra],
        "summary_en": f"{EXIT_NAMES[code]}: {sum(1 for f in findings if f['severity'] == 'error')} errors, {sum(1 for f in findings if f['severity'] == 'warning')} warnings",
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("--source", required=True)
    c.add_argument("--installed-version")
    c.add_argument("--baseline")
    c.add_argument("--baseline-sha256")
    c.add_argument("--socket-exceptions")
    c.add_argument("--socket-exceptions-sha256")
    c.add_argument("--source-commit")
    c.add_argument("--json")
    m = sub.add_parser("manifest")
    m.add_argument("--source", required=True)
    m.add_argument("--source-commit")
    m.add_argument("--out")
    r = sub.add_parser("run-tests")
    r.add_argument("--source", required=True)
    r.add_argument("--budget-seconds", type=int, default=1800)
    r.add_argument("--expected-collected", type=int)
    r.add_argument("--json")
    r.add_argument("test_command", nargs=argparse.REMAINDER, help="after --: the exact command, default python -m pytest -q -o addopts= -p no:cacheprovider")
    a = ap.parse_args(argv)
    try:
        source = Path(a.source).resolve()
        if not source.is_dir():
            print("source is not a directory", file=sys.stderr)
            return 2
        if a.cmd == "check":
            rep = run_check(source, installed_version=a.installed_version, baseline=Path(a.baseline) if a.baseline else None, baseline_sha=a.baseline_sha256,
                            socket_exceptions=Path(a.socket_exceptions) if a.socket_exceptions else None, socket_sha=a.socket_exceptions_sha256, source_commit=a.source_commit)
            if a.json:
                Path(a.json).write_text(json.dumps(rep, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(rep["summary_en"])
            for f in rep["findings"]:
                print(f"  [{f['severity']}] {f['code']} {f.get('path', '')}{':' + str(f['line']) if 'line' in f else ''} {f['message']}")
            return int(rep["exit_code"])
        if a.cmd == "manifest":
            layout = Layout(source)
            structure, info = check_structure(layout, None)
            if any(f["severity"] == "error" and f["code"].startswith("S_") and f["code"] in ("S_NO_CUSTOM_COMPONENTS", "S_DOMAIN_COUNT", "S_MANIFEST_MISSING", "S_MANIFEST_JSON") for f in structure):
                print("source structure is invalid; run check", file=sys.stderr)
                return 2
            text = json.dumps(build_manifest(layout, info, a.source_commit, {}), indent=2, ensure_ascii=False) + "\n"
            if a.out:
                Path(a.out).write_text(text, encoding="utf-8")
            else:
                sys.stdout.write(text)
            return 0
        if a.cmd == "run-tests":
            cmd = [x for x in a.test_command if x != "--"] or [sys.executable, "-m", "pytest", "-q", "-o", "addopts=", "-p", "no:cacheprovider"]
            res = run_tests(source, cmd, a.budget_seconds, a.expected_collected, None)
            if a.json:
                Path(a.json).write_text(json.dumps(res, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"{res['result']} (exit {res['exit_code']})")
            return int(res["exit_code"])
    except Exception as exc:  # the tool itself failed: never a pass
        print(f"internal error: {type(exc).__name__}", file=sys.stderr)
        return 70
    return 70


if __name__ == "__main__":
    sys.exit(main())
