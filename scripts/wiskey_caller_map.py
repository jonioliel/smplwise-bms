"""WKR5-295 (hand-off unit A / request 2): the caller / router map of WisKey's command catalog in Arx, per family.

For every command of the runtime catalog (smplwise/services/wiskey_r5_catalog.jsonl, read by wiskey_direct_catalog) this lists the
Arx backend modules that name the command as a string literal (`"family/name"`), and the envelope Arx would use on the direct
transport. It is a TEXT SCAN: a module naming a command is a caller candidate, not proof that it sends it, and naming says nothing
about business acceptance, installation or live use. Families with no Arx module are listed with an empty caller list.

    python -I scripts/wiskey_caller_map.py docs/integrations/wiskey/r5/CALLER_MAP.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "smplwise_vms" / "backend"
sys.path.insert(0, str(BACKEND))

from smplwise.services import wiskey_direct_catalog as cat  # noqa: E402


def main(dst: str) -> int:
    catalog = cat.load()
    sources = {p.relative_to(BACKEND).as_posix(): p.read_text(encoding="utf-8") for p in sorted((BACKEND / "smplwise").rglob("*.py"))}
    families: dict[str, dict] = {}
    for entry in catalog.entries():
        pattern = re.compile(r"[\"']" + re.escape(entry.command) + r"[\"']")
        callers = sorted(path for path, text in sources.items() if pattern.search(text) and not path.endswith("wiskey_direct_catalog.py"))
        fam = families.setdefault(entry.family, {"commands": {}})
        fam["commands"][entry.command] = {
            "row_kind": entry.row_kind, "direct_envelope": entry.envelope, "discovered_for_native_owner": entry.discovered,
            "owner_excluded_write": entry.command in cat.OWNER_EXCLUDED_WRITES, "arx_callers": callers}
    for fam in families.values():
        fam["arx_callers"] = sorted({c for v in fam["commands"].values() for c in v["arx_callers"]})
    out = {"schema": "wkr5-caller-map.v1", "catalog_source_sha256": catalog.source_sha256, "implementation_input_CODE": catalog.code,
           "method": "string-literal scan of smplwise_vms/backend/smplwise/**/*.py; a caller candidate is not a send, an acceptance or an installation",
           "family_count": len(families), "command_count": catalog.command_count,
           "families": dict(sorted(families.items()))}
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    Path(dst).write_text(json.dumps(out, indent=1, ensure_ascii=False, sort_keys=False) + "\n", encoding="utf-8", newline="\n")
    called = sum(1 for f in families.values() if f["arx_callers"])
    print(f"{len(families)} families, {catalog.command_count} commands; families with an Arx caller candidate: {called}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1]))
