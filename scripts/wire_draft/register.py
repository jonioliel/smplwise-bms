"""Register applied routers: FAMILIES_E entries (unless in another family) + UNANNOTATED_E entries.

python register.py <repo> <router> [...]"""
from __future__ import annotations

import json
import re
import os
import sys
import tempfile
from pathlib import Path

repo = Path(sys.argv[1])
names = sys.argv[2:]
DRAFTS = Path(os.environ.get("WIRE_DRAFT_DIR") or (Path(tempfile.gettempdir()) / "wire_draft"))
gen = repo / "scripts" / "gen_wire_types.py"
orc = repo / "smplwise_vms" / "backend" / "tests" / "support" / "wire_oracle.py"
gt = gen.read_text(encoding="utf-8")
ot = orc.read_text(encoding="utf-8")


def camel(s: str) -> str:
    return "".join(p[:1].upper() + p[1:] for p in s.split("_") if p)


m = re.search(r"FAMILIES_E: dict\[str, tuple\[str, tuple\[str, \.\.\.\]\]\] = \{\n(.*?)\}\n", gt, re.S)
assert m
entries = [ln for ln in m.group(1).splitlines() if ln.strip()]
for n in names:
    if re.search(rf'\("{n}",\)', gt):
        continue
    entries.append(f'    "{camel(n)}": ("wire-{n.replace("_", "-")}.ts", ("{n}",)),')
entries = sorted(set(entries))
gt = gt[: m.start(1)] + "".join(e + "\n" for e in entries) + gt[m.end(1):]
gen.write_text(gt, encoding="utf-8", newline="\n")

m = re.search(r"UNANNOTATED_E: frozenset\[str\] = frozenset\(\{\n(.*?)\}\)\n", ot, re.S)
assert m
keys = {ln.strip().rstrip(",").strip('"') for ln in m.group(1).splitlines() if ln.strip()}
for n in names:
    keys |= set(json.loads((DRAFTS / f"{n}.map.json").read_text(encoding="utf-8"))["unannotated"])
ot = ot[: m.start(1)] + "".join(f'    "{k}",\n' for k in sorted(keys)) + ot[m.end(1):]
orc.write_text(ot, encoding="utf-8", newline="\n")
print("registered", names, "unannotated", len(keys))
