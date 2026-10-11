"""Forbidden content of the installable part (`custom_components/<domain>/` at the source commit).

Two kinds of finding, both value-free (code, path, line, blob prefix - never the matched text, so a report can be shared without
becoming a leak itself):
* names that must never ship inside an integration folder: tests, private material, logs, keys, archives, databases, captures,
  byte code, environment and secrets files;
* text hits, with the rules of the WX3 gate tool (`scripts/wiskey_gate.py`, `scan_text_for_leaks`, used for Arx's 2026-10-10 leak
  list): an IPv4 address outside loopback / unspecified / mask-like / RFC 5737; a MAC address outside all-zero / all-ff / RFC 7042;
  a JWT-shaped token; a PEM private-key header; a literal assigned to a password / secret / token / key / serial-named variable that
  carries no placeholder word.

The importer does NOT honour inline `gate:allow(...)` markers: whether such markers are accepted is open owner item 30. Every hit
fails the intake (fail closed); the scan is a heuristic that flags candidates for a human, not a verdict that a value is real.
The full-history scan of the bundle is WisKey's step P1 (LEAK_VERDICTS.json) and is not repeated here.
"""
from __future__ import annotations

import re
from typing import Iterable

FORBIDDEN_DIRS = {"tests", "test", "private", "probe-output", "probes", "logs", ".git", "node_modules", "__pycache__", "secrets",
                  ".pytest_cache", ".venv", "venv"}
FORBIDDEN_SUFFIX = (".log", ".pem", ".key", ".p12", ".pfx", ".pyc", ".pyo", ".zip", ".tar", ".gz", ".tgz", ".7z", ".rar", ".sqlite",
                    ".sqlite3", ".db", ".har", ".pcap", ".pcapng", ".so", ".dll", ".dylib", ".exe", ".whl", ".egg", ".bundle", ".crt", ".der")
FORBIDDEN_NAMES = {".env", "secrets.json", "secrets.yaml", "secrets.yml", "lab.env", ".DS_Store", "id_rsa", "id_ed25519", ".netrc", ".pypirc"}
FORBIDDEN_PREFIXES = ("test_", "conftest")
TEXT_EXT = {".py", ".json", ".md", ".txt", ".yaml", ".yml", ".toml", ".cfg", ".ini", ".ts", ".js", ".mjs", ".html", ".css", ".csv", ".sh",
            ".xml", ".env", ".rst", ".sql", ".svg", ".map"}
MAX_TEXT_BYTES = 2_000_000

_IPV4 = re.compile(r"(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.]*\d)")
_MAC = re.compile(r"(?<![0-9A-Fa-f:-])((?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})(?![0-9A-Fa-f:-])")
_JWT = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}")
_PEM = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")
_ASSIGN = re.compile(
    r"""(?ix)\b(?P<name>[a-z0-9_]*(?:password|passwd|secret|token|api_?key|hmac|pairing|signing_?key|serial(?:_?number)?|pin_?code))\b
        \s*[:=]\s*(?P<q>["'])(?P<val>[^"'\n]{6,})(?P=q)""")
_PLACEHOLDER = re.compile(r"(?i)(example|dummy|fake|test|placeholder|redacted|changeme|xxxx|\*\*\*|<.*>|\$\{|\{\{|synthetic|sample|not[-_ ]?real|"
                          r"0{6,}|1234|secret|private|password|passwd|admin|demo|probe|model|mock|stub)")
_DOC_MAC_PREFIX = ("00:00:5e:00:53", "00-00-5e-00-53")


def name_issue(rel_in_domain: str) -> str | None:
    """Why a path inside custom_components/<domain>/ must not ship, as a fixed code (or None)."""
    parts = rel_in_domain.split("/")
    name = parts[-1]
    low = name.lower()
    if {p.lower() for p in parts[:-1]} & FORBIDDEN_DIRS:
        return "forbidden_dir"
    if name in FORBIDDEN_NAMES or low in FORBIDDEN_NAMES:
        return "forbidden_name"
    if low.endswith(FORBIDDEN_SUFFIX):
        return "forbidden_suffix"
    if low.startswith(FORBIDDEN_PREFIXES) and low.endswith(".py"):
        return "test_module"
    return None


def _ipv4_issue(m: re.Match[str]) -> bool:
    o = [int(x) for x in m.groups()]
    if any(x > 255 for x in o):
        return False
    a, b, c, _d = o
    if a in (0, 127, 255) or (a, b, c) in ((192, 0, 2), (198, 51, 100), (203, 0, 113)):
        return False
    return True


def text_hits(text: str) -> Iterable[tuple[int, str]]:
    """(line, code) for every line with a hit; at most one hit per code and line."""
    for i, ln in enumerate(text.splitlines(), 1):
        codes: list[str] = []
        if any(_ipv4_issue(m) for m in _IPV4.finditer(ln)):
            codes.append("leak_ipv4")
        for m in _MAC.finditer(ln):
            v = m.group(1).lower()
            if not (v.replace("-", ":") in ("00:00:00:00:00:00", "ff:ff:ff:ff:ff:ff") or v.startswith(_DOC_MAC_PREFIX)):
                codes.append("leak_mac")
                break
        if _JWT.search(ln):
            codes.append("leak_token")
        if _PEM.search(ln):
            codes.append("leak_private_key")
        for m in _ASSIGN.finditer(ln):
            if not _PLACEHOLDER.search(m.group("val")):
                codes.append("leak_serial" if "serial" in m.group("name").lower() else "leak_secret")
                break
        for c in codes:
            yield i, c


def scan_files(files: Iterable[tuple[str, str, bytes]]) -> list[dict[str, object]]:
    """files: (path in the source tree, blob id, bytes). Returns value-free findings sorted by path and line."""
    out: list[dict[str, object]] = []
    for path, oid, data in files:
        dot = path.rfind(".")
        ext = path[dot:].lower() if dot > path.rfind("/") else ""
        if ext not in TEXT_EXT:
            if b"\0" in data[:8192]:
                continue  # a binary file is checked by name and size only
        if len(data) > MAX_TEXT_BYTES:
            out.append({"code": "text_too_large_to_scan", "path": path, "line": None, "blob": oid[:12]})
            continue
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            out.append({"code": "text_not_utf8", "path": path, "line": None, "blob": oid[:12]})
            continue
        for line, code in text_hits(text):
            out.append({"code": code, "path": path, "line": line, "blob": oid[:12]})
    out.sort(key=lambda f: (str(f["path"]), f["line"] or 0, str(f["code"])))
    return out
