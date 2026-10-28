"""WKR5-295 (hand-off unit A; Windows review findings W5-API-01 and W5-CATALOG-01): WisKey's round-5 command catalog as Arx reads it.

Source: WisKey `docs/owner-development-2026-10-24/mac-round5-arx/command_catalog/COMMAND_CATALOG.jsonl` (implementation CODE
fa05c60b001ad1af092a9e43e8f9170388e708c3), trimmed to its routing facts by scripts/wiskey_r5_catalog_trim.py into
`wiskey_r5_catalog.jsonl` next to this module (the provenance row keeps the SHA-256 of the original bytes).

The file has THREE row kinds and this reader handles each one explicitly (W5-CATALOG-01):
- `CATALOG_PROVENANCE` - exactly one, first; metadata, never counted as a command;
- `COMMAND`            - a command registered in WisKey's Home Assistant WebSocket table (276 since WISKEY-MAC-ADOPT-298: the FINAL Mac
                          catalog of 27.10, source SHA-256 dd55f9df..., CODE d5a3ab86 - adds `users/service_write_status_v1` and
                          `features/people_csv_preview`; 282 since WISKEY-ADOPT-2272: the owner28 catalog CATALOG-FINAL-08, source
                          SHA-256 15ad9de7..., CODE 0a099c53 - adds `events/resume_v1`, `whatsapp/template_registry_v1` /
                          `_enqueue_v1` / `_job_v1` / `_cancel_v1` and `whatsapp/template_send_v3`);
- `DIRECT_ONLY_COMMAND` - a command only the direct socket serves (`peer_identity/get`, `direct/capabilities`, `direct/capabilities_v2`,
                          `direct/time`); it has
                          none of the HA registration fields and is not required to.
286 command names in 43 families. Anything else (an unknown row kind, a duplicate name, a count that does not match the provenance)
refuses the whole catalog.

The SIGNED ENVELOPE KIND of a command is decided here, per command, from the catalog row (W5-API-01) - never from
`direct/capabilities` `commands[].envelope`, which names the transport protocol (`wiskey-direct-ws.v1`), not a `bridge.kind`:
- `wiskey-peer-query.v1`      for the four peer reads (wire_schema "original wiskey-peer-query.v1 signed read envelope");
- `wiskey-bridge-command.v1`  for every NativeBridgeMessage command and for the three direct-only reads;
- None                        for the five commands whose wire is the original HA WebSocket body (audio session / panel audio entry):
                              they are never sent on the direct envelope.
`wiskey-direct-connect.v1` is the connect body only (wiskey_media_bridge.connect_body). No `api_contract` is added to a closed envelope.

OWNER_EXCLUDED_WRITES: was the job-approval WRITES (owner decision before 28.10). WISKEY-ADOPT-2272: the owner's 28.10 instruction (permanent full
installation, "no artificial allowlist of targets/fields/actions for the installed Arx") empties it; WisKey's own business approvals,
schema, CAS and authority checks stay authoritative. The contradiction with the earlier decision is recorded in
docs/changes/WISKEY-ADOPT-2272.md; Arx still has no caller of either write."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from . import wiskey_media_bridge as bridge

CATALOG_PATH = Path(__file__).with_name("wiskey_r5_catalog.jsonl")
NATIVE_WIRE = "CATALOG_DEFINITIONS.json#/$defs/NativeBridgeMessage"
PEER_QUERY_WIRE = "original wiskey-peer-query.v1 signed read envelope"
HA_BODY_WIRE = "original HA WebSocket body; no native envelope reinterpretation"
OWNER_EXCLUDED_WRITES: frozenset[str] = frozenset()  # WISKEY-ADOPT-2272 (owner28 permanent full installation)
ROW_KINDS = ("CATALOG_PROVENANCE", "COMMAND", "DIRECT_ONLY_COMMAND")


class CatalogError(Exception):
    pass


@dataclass(frozen=True)
class CatalogEntry:
    command: str
    row_kind: str  # COMMAND | DIRECT_ONLY_COMMAND
    family: str
    envelope: str | None  # the signed bridge.kind on the direct transport; None = never on the direct envelope
    discovered: bool  # WisKey's registration observation: discovered for the native service owner
    transport_mode: str


@dataclass(frozen=True)
class Catalog:
    code: str
    source_sha256: str
    registered_count: int
    discovered_count: int
    _entries: tuple[CatalogEntry, ...]

    def entries(self) -> tuple[CatalogEntry, ...]:
        return self._entries

    @property
    def command_count(self) -> int:
        return len(self._entries)

    @property
    def families(self) -> frozenset[str]:
        return frozenset(e.family for e in self._entries)

    def get(self, command: str) -> CatalogEntry | None:
        return self._index().get(command)

    def _index(self) -> dict[str, CatalogEntry]:
        return {e.command: e for e in self._entries}


def _entry(row: dict) -> CatalogEntry:
    command = row.get("command")
    if not isinstance(command, str) or not command or command.startswith(bridge.TYPE_PREFIX):  # `overview`, `subscribe` have no slash
        raise CatalogError("invalid_command_name")
    family = command.split("/", 1)[0]
    if row["kind"] == "DIRECT_ONLY_COMMAND":
        if (row.get("transport") != bridge.DIRECT_PROTOCOL or row.get("signed_command_const") != command
                or row.get("registered_in_HA_WebSocket_table") is not False):
            raise CatalogError("invalid_direct_only_row")
        return CatalogEntry(command, "DIRECT_ONLY_COMMAND", family, bridge.KIND, True, "direct_only")
    wire = row.get("wire_schema")
    if wire == NATIVE_WIRE:
        envelope: str | None = bridge.KIND
    elif wire == PEER_QUERY_WIRE:
        envelope = bridge.PEER_QUERY_KIND
    elif wire == HA_BODY_WIRE:
        envelope = None
    else:
        raise CatalogError("unknown_wire_schema")
    discovered = row.get("discovered_for_native_owner")
    if type(discovered) is not bool or type(row.get("direct_dispatch_available")) is not bool:
        raise CatalogError("invalid_command_row")
    return CatalogEntry(command, "COMMAND", family, envelope, discovered, str(row.get("transport_mode")))


def parse(text: str) -> Catalog:
    rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    if not rows or not isinstance(rows[0], dict) or rows[0].get("kind") != "CATALOG_PROVENANCE":
        raise CatalogError("provenance_missing")
    prov = rows[0]
    entries: list[CatalogEntry] = []
    seen: set[str] = set()
    for row in rows[1:]:
        kind = row.get("kind") if isinstance(row, dict) else None
        if kind == "CATALOG_PROVENANCE":
            raise CatalogError("duplicate_provenance")
        if kind not in ROW_KINDS:
            raise CatalogError("unknown_row_kind")
        e = _entry(row)
        if e.command in seen:
            raise CatalogError("duplicate_command")
        seen.add(e.command)
        entries.append(e)
    registered = sum(1 for e in entries if e.row_kind == "COMMAND")
    discovered = sum(1 for e in entries if e.discovered)
    if registered != prov.get("registered_count") or discovered != prov.get("discovered_count"):
        raise CatalogError("count_mismatch")
    return Catalog(str(prov.get("implementation_input_CODE")), str(prov.get("trimmed_from_sha256")), registered, discovered, tuple(entries))


@lru_cache(maxsize=1)
def load(path: str | None = None) -> Catalog:
    return parse(Path(path or CATALOG_PATH).read_text(encoding="utf-8"))


def file_sha256(path: str | None = None) -> str:
    return hashlib.sha256(Path(path or CATALOG_PATH).read_bytes()).hexdigest()


def envelope_for(command: str) -> str | None:
    """The signed `bridge.kind` for `command` on the direct transport, from the catalog row. A command the catalog does not know falls
    back to the WKINT rule (peer reads -> peer-query, else bridge-command); the session refuses the HA-body and owner-excluded ones."""
    entry = load().get(command)
    if entry is not None:
        return entry.envelope
    from .wiskey_command_port import PEER_QUERY_COMMANDS

    return bridge.PEER_QUERY_KIND if command in PEER_QUERY_COMMANDS else bridge.KIND


def direct_refusal(command: str) -> str | None:
    """Why `command` must never be written on the direct envelope (refused `not_sent` before any byte), else None."""
    if command in OWNER_EXCLUDED_WRITES:
        return "owner_excluded"
    entry = load().get(command)
    if entry is not None and entry.envelope is None:
        return "not_a_direct_command"
    return None
