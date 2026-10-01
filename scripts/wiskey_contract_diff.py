"""WisKey contract diff (decision D-005): compare a delivered pair of static catalogs against Arx's pinned copy.

The pinned copy lives in `docs/integrations/wiskey/catalog/<pin>/` (see its CONTRACT_DIFF.md for provenance and the
limits of these catalogs). WisKey's `commands.static.json` / `errors.static.json` are a static extraction: they are not
full nested schemas, not an authorization oracle and not an approval to write, so a clean diff proves nothing beyond
"the tracked top-level facts did not move". Nothing here talks to a device or to Home Assistant; it reads files only.

    python scripts/wiskey_contract_diff.py --verify                       # the pinned files still match PIN.json
    python scripts/wiskey_contract_diff.py --candidate DIR [--json]       # diff a new delivery against the pin
    python scripts/wiskey_contract_diff.py --candidate DIR --pinned DIR2  # against another baseline

`DIR` holds the two catalogs directly or in a `schemas/` sub-folder (a WisKey delivery root works as is).

Exit code: 0 identical, 1 additions or non-breaking changes only, 2 a removal or a change of a required key, a base
permission or the READ classification (an explicit migration review is needed before the delivery is accepted),
3 usage / integrity error.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PIN = ROOT / "docs" / "integrations" / "wiskey" / "catalog" / "rc37-contract.2"
COMMANDS_FILE = "commands.static.json"
ERRORS_FILE = "errors.static.json"
PERMISSION_KEYS = (
    "alternative_area_grants",
    "administrator_only_by_base_mapping",
    "special_access",
    "station_restricted_surface",
    "field_restricted_surface",
    "field_requirement",
)
READ_KEY = "read_command_for_security_guard_and_api_contract"


class CatalogError(Exception):
    """A catalog folder that cannot be used (missing file, bad JSON, wrong count, hash that differs from the pin)."""


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def locate(folder: Path) -> Path:
    """The folder that holds the two catalog files: `folder` itself or its `schemas/` child."""
    for candidate in (folder, folder / "schemas"):
        if (candidate / COMMANDS_FILE).is_file() and (candidate / ERRORS_FILE).is_file():
            return candidate
    raise CatalogError(f"{folder}: no {COMMANDS_FILE} / {ERRORS_FILE} here or in schemas/")


def load(folder: Path) -> dict[str, Any]:
    """`{version, commands, errors, sha256}` of a catalog folder. The declared `count` of each file must match its content."""
    where = locate(folder)
    out: dict[str, Any] = {"sha256": {}}
    for name, key in ((COMMANDS_FILE, "commands"), (ERRORS_FILE, "errors")):
        path = where / name
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise CatalogError(f"{path}: {type(exc).__name__}") from exc
        body = doc.get(key) if isinstance(doc, dict) else None
        if not isinstance(body, dict):
            raise CatalogError(f"{path}: no '{key}' object")
        if isinstance(doc.get("count"), int) and doc["count"] != len(body):
            raise CatalogError(f"{path}: declares {doc['count']} {key} but holds {len(body)}")
        out[key] = body
        out["sha256"][name] = sha256_of(path)
        out.setdefault("version", doc.get("version"))
    return out


def verify_pin(pin_dir: Path) -> list[str]:
    """Problems (empty = fine) between the pinned folder's files and its `PIN.json`."""
    problems: list[str] = []
    try:
        pin = json.loads((pin_dir / "PIN.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [f"PIN.json unreadable: {type(exc).__name__}"]
    for name, expected in (pin.get("files") or {}).items():
        path = pin_dir / name
        if not path.is_file():
            problems.append(f"{name}: missing")
            continue
        if sha256_of(path) != expected.get("sha256"):
            problems.append(f"{name}: SHA-256 differs from PIN.json")
    try:
        cat = load(pin_dir)
    except CatalogError as exc:
        problems.append(str(exc))
        return problems
    counts = {COMMANDS_FILE: len(cat["commands"]), ERRORS_FILE: len(cat["errors"])}
    for name, count in counts.items():
        want = ((pin.get("files") or {}).get(name) or {}).get("count")
        if want is not None and want != count:
            problems.append(f"{name}: {count} entries, PIN.json says {want}")
    if cat.get("version") != pin.get("runtime_version"):
        problems.append(f"catalog version {cat.get('version')!r} differs from PIN.json runtime_version {pin.get('runtime_version')!r}")
    return problems


def command_facts(entry: dict[str, Any]) -> dict[str, Any]:
    """The tracked facts of one catalog command: required keys, property names, base permission classification, READ
    classification and request byte limit (everything else in the entry is prose or completeness notes)."""
    request = entry.get("request") if isinstance(entry.get("request"), dict) else {}
    permission = entry.get("permission") if isinstance(entry.get("permission"), dict) else {}
    grants = permission.get("alternative_area_grants")
    return {
        "required": sorted(request.get("required") or []),
        "properties": sorted((request.get("properties") or {}).keys()),
        "additional_properties": request.get("additionalProperties"),
        "permission": {k: (sorted(map(list, grants)) if k == "alternative_area_grants" and isinstance(grants, list) else permission.get(k)) for k in PERMISSION_KEYS},
        "read": permission.get(READ_KEY),
        "max_request_bytes": entry.get("max_request_bytes"),
    }


def diff(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    """The D-005 report between two loaded catalogs. `breaking` lists what needs a migration review; `changes` the rest."""
    breaking: list[str] = []
    changes: list[str] = []
    old_c, new_c = old["commands"], new["commands"]
    added = sorted(set(new_c) - set(old_c))
    removed = sorted(set(old_c) - set(new_c))
    breaking += [f"command removed: {name}" for name in removed]
    changes += [f"command added: {name}" for name in added]
    for name in sorted(set(old_c) & set(new_c)):
        a, b = command_facts(old_c[name]), command_facts(new_c[name])
        if a["required"] != b["required"]:
            breaking.append(f"{name}: required keys {a['required']} -> {b['required']}")
        if a["permission"] != b["permission"]:
            breaking.append(f"{name}: base permission classification changed")
        if a["read"] != b["read"]:
            breaking.append(f"{name}: READ classification {a['read']} -> {b['read']}")
        if a["properties"] != b["properties"]:
            gone = sorted(set(a["properties"]) - set(b["properties"]))
            came = sorted(set(b["properties"]) - set(a["properties"]))
            (breaking if gone else changes).append(f"{name}: properties removed {gone} added {came}")
        if a["additional_properties"] != b["additional_properties"]:
            changes.append(f"{name}: additionalProperties {a['additional_properties']} -> {b['additional_properties']}")
        if a["max_request_bytes"] != b["max_request_bytes"]:
            changes.append(f"{name}: request byte limit {a['max_request_bytes']} -> {b['max_request_bytes']}")
    old_e, new_e = old["errors"], new["errors"]
    e_added = sorted(set(new_e) - set(old_e))
    e_removed = sorted(set(old_e) - set(new_e))
    breaking += [f"error code removed: {code}" for code in e_removed]
    changes += [f"error code added: {code}" for code in e_added]
    for code in sorted(set(old_e) & set(new_e)):
        if old_e[code].get("retry") != new_e[code].get("retry"):
            changes.append(f"error {code}: retry class {old_e[code].get('retry')} -> {new_e[code].get('retry')}")
    return {
        "old": {"version": old.get("version"), "commands": len(old_c), "errors": len(old_e), "sha256": old["sha256"]},
        "new": {"version": new.get("version"), "commands": len(new_c), "errors": len(new_e), "sha256": new["sha256"]},
        "commands_added": added,
        "commands_removed": removed,
        "errors_added": e_added,
        "errors_removed": e_removed,
        "breaking": breaking,
        "changes": changes,
        "identical_files": old["sha256"] == new["sha256"],
        "exit_code": 2 if breaking else (1 if changes else 0),
    }


def render(report: dict[str, Any]) -> str:
    lines = [
        f"pinned:    {report['old']['version']}  {report['old']['commands']} commands, {report['old']['errors']} errors",
        f"candidate: {report['new']['version']}  {report['new']['commands']} commands, {report['new']['errors']} errors",
        "files byte-identical" if report["identical_files"] else "files differ",
    ]
    for title, items in (("NEEDS MIGRATION REVIEW", report["breaking"]), ("changes", report["changes"])):
        if items:
            lines.append(f"{title} ({len(items)}):")
            lines += [f"  - {item}" for item in items]
    if not report["breaking"] and not report["changes"]:
        lines.append("no difference in the tracked facts (a clean diff is not an approval to write)")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--pinned", type=Path, default=DEFAULT_PIN, help="the pinned catalog folder (default: the repository pin)")
    parser.add_argument("--candidate", type=Path, help="a delivered catalog folder (or delivery root) to diff against the pin")
    parser.add_argument("--verify", action="store_true", help="check the pinned files against PIN.json (SHA-256, counts, version)")
    parser.add_argument("--json", action="store_true", help="print the report as JSON")
    args = parser.parse_args(argv)
    if not args.verify and args.candidate is None:
        parser.error("give --verify and/or --candidate DIR")
    try:
        if args.verify:
            problems = verify_pin(args.pinned)
            if problems:
                print("PIN CHECK FAILED:\n" + "\n".join(f"  - {p}" for p in problems), file=sys.stderr)
                return 3
            print(f"pin {args.pinned.name}: files match PIN.json")
            if args.candidate is None:
                return 0
        report = diff(load(args.pinned), load(args.candidate))
    except CatalogError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3
    print(json.dumps(report, indent=2, ensure_ascii=False) if args.json else render(report))
    return int(report["exit_code"])


if __name__ == "__main__":
    sys.exit(main())
