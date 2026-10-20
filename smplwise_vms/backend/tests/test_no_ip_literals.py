"""Lint: no specific private IPv4 literals in tracked files (owner rule 2026-10-20).

Fixed addresses must be a setting or a neutral placeholder, never hardcoded.
Always allowed: loopback (127/8), 0.0.0.0, RFC 5737 documentation ranges,
the Home Assistant add-on network 172.30.0.0/16, public addresses, and
network definitions written with a prefix length (for example a CIDR block list).
Flagged: RFC 1918, link-local, and carrier-grade NAT (100.64/10) addresses.

Files that legitimately need such values (for example SSRF-guard tests that
must feed private addresses to a validator) are listed in
ip_literal_allowlist.txt: one `glob  # reason` per line, never an address.
"""
from __future__ import annotations

import fnmatch
import ipaddress
import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ALLOWLIST = Path(__file__).with_name("ip_literal_allowlist.txt")
IPV4 = re.compile(r"(?<![0-9A-Za-z.])((?:[0-9]{1,3}\.){3}[0-9]{1,3})(?![0-9A-Za-z]|\.[0-9])(?!/[0-9])")
FLAGGED = [ipaddress.ip_network(n) for n in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "100.64.0.0/10")]
ADDON_NET = ipaddress.ip_network("172.30.0.0/16")
SKIP_SUFFIX = (".lock", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".zip",
               ".woff", ".woff2", ".ttf", ".pdf", ".mp4", ".glb", ".min.js", ".map")
SKIP_PREFIX = ("legacy/", "smplwise_vms/www/", "package-lock.json")
SELF = {"smplwise_vms/backend/tests/test_no_ip_literals.py",
        "smplwise_vms/backend/tests/ip_literal_allowlist.txt"}


def _tracked() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=REPO, capture_output=True, check=True).stdout
    return [p for p in out.decode("utf-8", "replace").split("\0") if p]


def _allow_globs() -> list[str]:
    globs = []
    for line in ALLOWLIST.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            globs.append(line)
    return globs


def find_flagged(text: str) -> list[int]:
    hits = []
    for i, line in enumerate(text.splitlines(), 1):
        for m in IPV4.finditer(line):
            try:
                a = ipaddress.IPv4Address(m.group(1))
            except ValueError:
                continue
            if a in ADDON_NET:
                continue
            if any(a in n for n in FLAGGED):
                hits.append(i)
                break
    return hits


def test_detector_flags_and_allows():
    assert find_flagged("host = '10.1.2.3'") == [1]
    assert find_flagged("x 192.168.0.9 y") == [1]
    assert find_flagged("a\nb 169.254.1.1") == [2]
    assert find_flagged("ip_network('10.0.0.0/8')") == []
    assert find_flagged("127.0.0.1 0.0.0.0 192.0.2.7 198.51.100.1 203.0.113.9") == []
    assert find_flagged("172.30.32.1 8.8.8.8 version 1.2.3.4") == []
    assert find_flagged("v10.1.2.3.4") == []


def test_no_unlisted_private_ip_literals():
    globs = _allow_globs()
    bad = []
    for path in _tracked():
        if path in SELF or path.endswith(SKIP_SUFFIX) or path.startswith(SKIP_PREFIX):
            continue
        if any(fnmatch.fnmatch(path, g) for g in globs):
            continue
        f = REPO / path
        if not f.is_file():
            continue
        try:
            text = f.read_bytes().decode("utf-8")
        except UnicodeDecodeError:
            continue
        lines = find_flagged(text)
        if lines:
            bad.append(f"{path}:{lines[0]} ({len(lines)} line(s))")
    assert not bad, (
        "Specific private IPv4 literals found; use a setting or a placeholder "
        "(RFC 5737 192.0.2.x if an address shape is required), or add the file "
        "with a reason to ip_literal_allowlist.txt:\n  " + "\n  ".join(bad))
