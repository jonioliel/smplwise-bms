#!/usr/bin/env python3
"""Self-check for arx-exchange schema set 1 (documentation aid, not the gate tool).

Checks, fully offline:
  1. every *.schema.json is a valid JSON Schema draft 2020-12 document;
  2. every file in examples/valid/ validates against its schema;
  3. every file in examples/invalid/ is rejected by its schema;
  4. examples/EXPECTED_INVALID.json lists exactly the invalid files;
  5. no JSON file in this folder contains duplicate keys at any depth.

The schema for an example is chosen by the file-name prefix before the first '.',
for example 'release-manifest.release.json' -> 'release-manifest.schema.json'.

Requires the 'jsonschema' package (>= 4.0). Exit code 0 = all checks passed, 1 = a check failed,
2 = jsonschema is not installed.
"""
from __future__ import annotations

import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent


class DuplicateKeyError(ValueError):
    pass


def _no_duplicates(pairs):
    seen = {}
    for key, value in pairs:
        if key in seen:
            raise DuplicateKeyError(f"duplicate key: {key!r}")
        seen[key] = value
    return seen


def load(path: pathlib.Path):
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_no_duplicates)


def main() -> int:
    try:
        import jsonschema
        from jsonschema import Draft202012Validator
    except ImportError:
        print("BLOCKED: the 'jsonschema' package is not installed")
        return 2

    failures: list[str] = []
    schemas = {}
    for path in sorted(HERE.glob("*.schema.json")):
        name = path.name[: -len(".schema.json")]
        try:
            schema = load(path)
            Draft202012Validator.check_schema(schema)
        except Exception as exc:  # noqa: BLE001 - report every failure
            failures.append(f"SCHEMA {path.name}: {exc}")
            continue
        schemas[name] = Draft202012Validator(schema)
        print(f"schema ok      {path.name}")

    def validator_for(path: pathlib.Path):
        prefix = path.name.split(".", 1)[0]
        return schemas.get(prefix)

    valid_dir = HERE / "examples" / "valid"
    invalid_dir = HERE / "examples" / "invalid"

    for path in sorted(valid_dir.glob("*.json")):
        validator = validator_for(path)
        if validator is None:
            failures.append(f"VALID {path.name}: no schema for prefix")
            continue
        try:
            errors = sorted(validator.iter_errors(load(path)), key=lambda e: list(e.path))
        except DuplicateKeyError as exc:
            failures.append(f"VALID {path.name}: {exc}")
            continue
        if errors:
            for err in errors:
                failures.append(f"VALID {path.name}: {'/'.join(map(str, err.path)) or '<root>'}: {err.message}")
        else:
            print(f"valid ok       {path.name}")

    expected = load(HERE / "examples" / "EXPECTED_INVALID.json")["cases"]
    seen = set()
    for path in sorted(invalid_dir.glob("*.json")):
        seen.add(path.name)
        validator = validator_for(path)
        if validator is None:
            failures.append(f"INVALID {path.name}: no schema for prefix")
            continue
        errors = list(validator.iter_errors(load(path)))
        if not errors:
            failures.append(f"INVALID {path.name}: accepted but must be rejected ({expected.get(path.name, '?')})")
        else:
            first = errors[0]
            where = "/".join(map(str, first.absolute_path)) or "<root>"
            msg = first.message if len(first.message) <= 90 else first.message[:87] + "..."
            print(f"rejected ok    {path.name}  [{expected.get(path.name, '?')}]  -> {where}: {msg}")

    missing = set(expected) - seen
    extra = seen - set(expected)
    for name in sorted(missing):
        failures.append(f"EXPECTED lists {name} but the file does not exist")
    for name in sorted(extra):
        failures.append(f"INVALID {name} is not listed in EXPECTED_INVALID.json")

    for path in sorted(HERE.rglob("*.json")):
        try:
            load(path)
        except DuplicateKeyError as exc:
            failures.append(f"DUPLICATE {path.relative_to(HERE)}: {exc}")

    print()
    from importlib.metadata import version as _v
    print(f"jsonschema {_v('jsonschema')}, python {sys.version.split()[0]}")
    print(f"schemas: {len(schemas)}, valid examples: {len(list(valid_dir.glob('*.json')))}, "
          f"invalid examples: {len(seen)}")
    if failures:
        print(f"FAILED: {len(failures)}")
        for line in failures:
            print("  " + line)
        return 1
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
