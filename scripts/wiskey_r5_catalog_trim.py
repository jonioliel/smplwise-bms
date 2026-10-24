"""WKR5-295: derive Arx's runtime copy of WisKey's round-5 command catalog (COMMAND_CATALOG.jsonl, Mac R5 hand-off, CODE fa05c60b).

The original file is WisKey's; Arx keeps only the routing facts its direct client needs, in the ORIGINAL row kinds
(CATALOG_PROVENANCE / COMMAND / DIRECT_ONLY_COMMAND - read by smplwise/services/wiskey_direct_catalog.py, which handles each kind
explicitly). No parameter schema, validator, error text or fixture value is copied. The provenance row gains `trimmed_from_sha256`
(the SHA-256 of the original bytes) so the copy can be checked against the hand-off.

    python -I scripts/wiskey_r5_catalog_trim.py <original COMMAND_CATALOG.jsonl> smplwise_vms/backend/smplwise/services/wiskey_r5_catalog.jsonl
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

COMMAND_FIELDS = ("kind", "command", "wire_schema", "transport_mode", "discovered_for_native_owner", "direct_dispatch_available")
DIRECT_FIELDS = ("kind", "command", "registered_in_HA_WebSocket_table", "transport", "signed_command_const")
PROVENANCE_FIELDS = ("kind", "implementation_input_CODE", "generator_CODE", "registered_count", "discovered_count", "native_TTL_seconds",
                     "registration_is_not_business_or_installation_acceptance", "original_Arx", "installed_target", "live")


def main(src: str, dst: str) -> int:
    raw = Path(src).read_bytes()
    out = []
    for line in raw.decode("utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        kind = row.get("kind")
        if kind == "CATALOG_PROVENANCE":
            keep = {k: row[k] for k in PROVENANCE_FIELDS}
            keep["trimmed_from_sha256"] = hashlib.sha256(raw).hexdigest()
        elif kind == "COMMAND":
            keep = {k: row[k] for k in COMMAND_FIELDS}
        elif kind == "DIRECT_ONLY_COMMAND":
            keep = {k: row[k] for k in DIRECT_FIELDS}
        else:
            raise SystemExit(f"unexpected row kind {kind!r}")
        out.append(json.dumps(keep, sort_keys=True, separators=(",", ":"), ensure_ascii=False))
    Path(dst).write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(out)} rows written; source sha256 {hashlib.sha256(raw).hexdigest()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1], sys.argv[2]))
