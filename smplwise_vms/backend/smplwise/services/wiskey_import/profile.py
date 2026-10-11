"""The import profile: what Arx itself has registered about one WisKey package (`arx-wiskey/import-profile/0`).

The profile is Arx's own record (A1 of the continuous handoff: "compare against the values in Arx's own records"). WisKey's
PACKAGE_MANIFEST.json and SHA256SUMS only prove that the transfer is complete; every value that decides PASS / FAIL comes from the
profile, or from a file whose bytes the profile pins by SHA-256 (the input spec). A profile is code-reviewed and lives in
`profiles/` next to this module (registered by a commit to Arx, never uploaded through the API).

Fields:
  schema, id
  kind                     "reference_only" (never installable) | "install_candidate"
  refs                     {full ref name: commit sha} - exactly the refs the bundle must carry
  source_ref               the ref whose tree is the source (support, source tests, installable part)
  ancestry                 [ref names] oldest first; each must be an ancestor of the next (optional)
  source_version, tests_manifest_version
  manifest_expect          {dotted key: value} that WisKey's PACKAGE_MANIFEST.json must carry exactly
  metadata                 [{role, source_path, sha256, size, git_blob, source_commit}] - the separate metadata files
  input_spec_role          the metadata role that holds the input spec (`wiskey/local-delivery-input-spec/1`)
  counts                   {support, history_records, history_groups, tests, source_tests, support_tests, registered_alias_tests}
  registered               [{name, location: support|source|metadata, path, sha256}] - registered values checked on real bytes
  installable_domains      [domain] - the custom_components/<domain>/ folders that form the installable part
  forbid_tree_modes        git modes refused anywhere in the source tree (default 120000 symlink, 160000 gitlink)
  limits                   size caps (bytes / counts), see DEFAULT_LIMITS
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .common import DOMAIN_RE, SHA1_HEX, SHA256_HEX, StrictJsonError, canonical_json, load_json_strict, parse_semver, path_issue, ref_name_ok, sha256_bytes

SCHEMA = "arx-wiskey/import-profile/0"
INPUT_SPEC_SCHEMA = "wiskey/local-delivery-input-spec/1"
KINDS = ("reference_only", "install_candidate")
COUNT_KEYS = ("support", "history_records", "history_groups", "tests", "source_tests", "support_tests", "registered_alias_tests")
LOCATIONS = ("support", "source", "metadata")
DEFAULT_LIMITS: dict[str, int] = {
    "max_bundle_bytes": 512 * 1024 * 1024,
    "max_total_bytes": 1024 * 1024 * 1024,
    "max_file_bytes": 64 * 1024 * 1024,
    "max_files": 5000,
    "max_metadata_bytes": 16 * 1024 * 1024,
    "max_installable_bytes": 32 * 1024 * 1024,
    "max_installable_files": 2000,
    "max_installable_file_bytes": 8 * 1024 * 1024,
    "max_tree_entries": 200000,
    "max_bundle_header_bytes": 64 * 1024,
}
PROFILES_DIR = Path(__file__).resolve().parent / "profiles"


class ProfileError(ValueError):
    """A profile that is not valid; `code` is a fixed word, never a value from the file."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Profile:
    id: str
    kind: str
    refs: dict[str, str]
    source_ref: str
    ancestry: tuple[str, ...]
    source_version: str | None
    tests_manifest_version: str | None
    manifest_expect: dict[str, Any]
    metadata: tuple[dict[str, Any], ...]
    input_spec_role: str
    counts: dict[str, int]
    registered: tuple[dict[str, Any], ...]
    installable_domains: tuple[str, ...]
    forbid_tree_modes: tuple[str, ...]
    limits: dict[str, int]
    sha256: str = ""
    raw: dict[str, Any] = field(default_factory=dict, compare=False, repr=False)

    @property
    def installable(self) -> bool:
        return self.kind == "install_candidate"

    def metadata_by_role(self, role: str) -> dict[str, Any] | None:
        return next((m for m in self.metadata if m["role"] == role), None)


def _req(cond: bool, code: str) -> None:
    if not cond:
        raise ProfileError(code)


def parse_profile(data: bytes) -> Profile:
    try:
        raw = load_json_strict(data)
    except StrictJsonError as exc:
        raise ProfileError(f"json:{exc}") from exc
    _req(isinstance(raw, dict) and raw.get("schema") == SCHEMA, "schema")
    pid = raw.get("id")
    _req(isinstance(pid, str) and 1 <= len(pid) <= 100 and pid.isascii() and pid.replace("-", "").replace(".", "").replace("_", "").isalnum(), "id")
    _req(raw.get("kind") in KINDS, "kind")
    refs = raw.get("refs")
    _req(isinstance(refs, dict) and 1 <= len(refs) <= 8, "refs")
    for name, sha in refs.items():
        _req(ref_name_ok(name) and isinstance(sha, str) and bool(SHA1_HEX.match(sha)), "refs")
    _req(raw.get("source_ref") in refs, "source_ref")
    ancestry = raw.get("ancestry", [])
    _req(isinstance(ancestry, list) and all(a in refs for a in ancestry) and len(set(ancestry)) == len(ancestry), "ancestry")
    for key in ("source_version", "tests_manifest_version"):
        v = raw.get(key)
        _req(v is None or parse_semver(v) is not None, key)
    expect = raw.get("manifest_expect", {})
    _req(isinstance(expect, dict) and all(isinstance(k, str) and k for k in expect), "manifest_expect")
    metadata = raw.get("metadata")
    _req(isinstance(metadata, list) and len(metadata) <= 16, "metadata")
    roles: set[str] = set()
    for m in metadata:
        _req(isinstance(m, dict) and set(m) == {"role", "source_path", "sha256", "size", "git_blob", "source_commit"}, "metadata_fields")
        _req(isinstance(m["role"], str) and m["role"] and m["role"] not in roles, "metadata_role")
        roles.add(m["role"])
        _req(isinstance(m["source_path"], str) and path_issue(m["source_path"]) is None, "metadata_path")
        _req(isinstance(m["sha256"], str) and bool(SHA256_HEX.match(m["sha256"])), "metadata_sha256")
        _req(isinstance(m["size"], int) and not isinstance(m["size"], bool) and m["size"] >= 0, "metadata_size")
        _req(isinstance(m["git_blob"], str) and bool(SHA1_HEX.match(m["git_blob"])), "metadata_git_blob")
        _req(isinstance(m["source_commit"], str) and bool(SHA1_HEX.match(m["source_commit"])), "metadata_source_commit")
    _req(raw.get("input_spec_role") in roles, "input_spec_role")
    counts = raw.get("counts")
    _req(isinstance(counts, dict) and set(counts) == set(COUNT_KEYS) and all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in counts.values()), "counts")
    registered = raw.get("registered", [])
    _req(isinstance(registered, list), "registered")
    for r in registered:
        _req(isinstance(r, dict) and set(r) == {"name", "location", "path", "sha256"} and r["location"] in LOCATIONS, "registered_fields")
        _req(isinstance(r["path"], str) and path_issue(r["path"]) is None and isinstance(r["sha256"], str) and bool(SHA256_HEX.match(r["sha256"])), "registered_values")
        _req(isinstance(r["name"], str) and bool(r["name"]), "registered_name")
    domains = raw.get("installable_domains", [])
    _req(isinstance(domains, list) and all(isinstance(d, str) and DOMAIN_RE.match(d) for d in domains) and len(set(domains)) == len(domains), "installable_domains")
    _req(raw["kind"] != "install_candidate" or bool(domains), "install_candidate_without_domains")
    _req(raw["kind"] != "install_candidate" or raw.get("source_version") is not None, "install_candidate_without_version")
    modes = raw.get("forbid_tree_modes", ["120000", "160000"])
    _req(isinstance(modes, list) and all(m in ("100755", "120000", "160000") for m in modes), "forbid_tree_modes")
    limits = dict(DEFAULT_LIMITS)
    over = raw.get("limits", {})
    _req(isinstance(over, dict) and set(over) <= set(DEFAULT_LIMITS), "limits")
    for k, v in over.items():
        # a profile may only tighten a cap, never raise it above the built-in ceiling
        _req(isinstance(v, int) and not isinstance(v, bool) and 0 < v <= DEFAULT_LIMITS[k], "limits")
        limits[k] = v
    return Profile(
        id=pid, kind=raw["kind"], refs=dict(refs), source_ref=raw["source_ref"], ancestry=tuple(ancestry),
        source_version=raw.get("source_version"), tests_manifest_version=raw.get("tests_manifest_version"),
        manifest_expect=dict(expect), metadata=tuple(dict(m) for m in metadata), input_spec_role=raw["input_spec_role"],
        counts=dict(counts), registered=tuple(dict(r) for r in registered), installable_domains=tuple(domains),
        forbid_tree_modes=tuple(modes), limits=limits, sha256=sha256_bytes(canonical_json(raw)), raw=raw,
    )


def registered_profiles(directory: Path | None = None) -> dict[str, Profile]:
    """Every valid profile in the registered directory, by id. An invalid file is skipped (the status endpoint lists it as invalid)."""
    out: dict[str, Profile] = {}
    d = directory or PROFILES_DIR
    if not d.is_dir():
        return out
    for f in sorted(d.glob("*.json")):
        try:
            p = parse_profile(f.read_bytes())
        except (ProfileError, OSError):
            continue
        if p.id not in out:
            out[p.id] = p
    return out


def invalid_profiles(directory: Path | None = None) -> list[dict[str, str]]:
    out = []
    d = directory or PROFILES_DIR
    if not d.is_dir():
        return out
    for f in sorted(d.glob("*.json")):
        try:
            parse_profile(f.read_bytes())
        except ProfileError as exc:
            out.append({"file": f.name, "code": exc.code})
        except OSError:
            out.append({"file": f.name, "code": "unreadable"})
    return out
