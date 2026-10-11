"""Shared helpers of the WisKey importer: strict JSON, hashes, path rules, semver and canonical JSON. Standard library only."""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Iterable

SHA1_HEX = re.compile(r"^[0-9a-f]{40}$")
SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")
PACKAGE_NAME = re.compile(r"^[a-z0-9][a-z0-9._-]{0,99}$")
REF_NAME = re.compile(r"^refs/heads/[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$")
DOMAIN_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.(0|[1-9]\d*))?$")
_WIN_RESERVED = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)), *(f"lpt{i}" for i in range(1, 10))}
MAX_PATH_BYTES = 1024
CHUNK = 1 << 20


class StrictJsonError(ValueError):
    pass


def load_json_strict(data: bytes) -> Any:
    """UTF-8 without BOM, duplicate keys refused at every depth, no NaN / Infinity."""
    if data.startswith(b"\xef\xbb\xbf"):
        raise StrictJsonError("bom")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise StrictJsonError("not_utf8") from exc

    def hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for k, v in pairs:
            if k in out:
                raise StrictJsonError("duplicate_key")
            out[k] = v
        return out

    def no_constant(_name: str) -> Any:
        raise StrictJsonError("non_finite_number")

    try:
        return json.loads(text, object_pairs_hook=hook, parse_constant=no_constant)
    except StrictJsonError:
        raise
    except ValueError as exc:
        raise StrictJsonError("invalid_json") from exc


def canonical_json(obj: Any) -> bytes:
    """Deterministic bytes: sorted keys, no whitespace, UTF-8, LF at the end."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8") + b"\n"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_id(data: bytes) -> str:
    """The SHA-1 object id git gives these bytes as a blob (object format sha1)."""
    h = hashlib.sha1(usedforsecurity=False)
    h.update(b"blob %d\0" % len(data))
    h.update(data)
    return h.hexdigest()


def file_digests(path: Path, size: int) -> tuple[str, str]:
    """(sha256, git blob id) of a file whose size the caller already took from lstat (streamed, never loaded whole)."""
    s256 = hashlib.sha256()
    s1 = hashlib.sha1(usedforsecurity=False)
    s1.update(b"blob %d\0" % size)
    seen = 0
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(CHUNK)
            if not chunk:
                break
            seen += len(chunk)
            s256.update(chunk)
            s1.update(chunk)
    if seen != size:
        raise OSError("file_changed_while_reading")
    return s256.hexdigest(), s1.hexdigest()


def tree_sha256(entries: Iterable[tuple[str, str]]) -> str:
    """SHA-256 over the UTF-8 lines "<sha256>  <posix path>\\n" sorted by the path bytes (GATE_TOOL_SPEC.md section 6)."""
    lines = sorted(((p.encode("utf-8"), h) for p, h in entries), key=lambda x: x[0])
    h = hashlib.sha256()
    for p, s in lines:
        h.update(s.encode("ascii") + b"  " + p + b"\n")
    return h.hexdigest()


def path_issue(rel: str) -> str | None:
    """Why a relative POSIX path is not acceptable inside a package or a tree, or None. The reason is a fixed code, never the path."""
    if not rel:
        return "empty"
    if rel.startswith("/") or "\\" in rel:
        return "absolute_or_backslash"
    if any(ord(c) < 32 or ord(c) == 127 for c in rel):
        return "control_character"
    if ":" in rel:
        return "colon"
    if unicodedata.normalize("NFC", rel) != rel:
        return "not_nfc"
    if len(rel.encode("utf-8")) > MAX_PATH_BYTES:
        return "too_long"
    for comp in rel.split("/"):
        if comp in ("", ".", ".."):
            return "dot_or_empty_component"
        if comp.lower() == ".git":
            return "git_dir"
        if comp.endswith((" ", ".")):
            return "trailing_dot_or_space"
        if comp.split(".")[0].lower() in _WIN_RESERVED:
            return "reserved_name"
        if len(comp.encode("utf-8")) > 255:
            return "component_too_long"
    return None


def casefold_collisions(paths: Iterable[str]) -> int:
    """How many paths collide with another one when case is ignored (a checkout on a case-insensitive disk would merge them)."""
    seen: dict[str, int] = {}
    for p in paths:
        k = p.casefold()
        seen[k] = seen.get(k, 0) + 1
    return sum(n - 1 for n in seen.values() if n > 1)


def parse_semver(v: Any) -> tuple[int, int, int, int, int] | None:
    if not isinstance(v, str):
        return None
    m = SEMVER.match(v)
    if not m:
        return None
    a, b, c, rc = m.groups()
    # a release sorts above its release candidates
    return (int(a), int(b), int(c), 0 if rc is not None else 1, int(rc) if rc is not None else 0)


def ref_name_ok(name: Any) -> bool:
    return isinstance(name, str) and bool(REF_NAME.match(name)) and ".." not in name and "//" not in name and not name.endswith(("/", ".lock", "."))
