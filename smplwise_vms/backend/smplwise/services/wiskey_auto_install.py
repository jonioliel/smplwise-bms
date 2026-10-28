"""WISKEY-ADOPT-2272: the Arx consumer of WisKey's automatic installation (WisKey owner28 delivery, product CODE 0a099c53, contribution
`services/wiskey_auto_install.py` against Arx 83a7c795, adopted semantically - docs/changes/WISKEY-ADOPT-2272.md).

WisKey alone creates the installation authority. Its native component writes a private manifest
(`<config>/.storage/hikvision_intercom.arx_installation/manifest.json`, format `wiskey-local-installation.v1`, file 0600 in a 0700
directory) with ONE GrantRef per paired bridge entry (`authority_mode = permanent_full_installation`, `expires_at = null`). Arx only
READS it: it never creates, renews or edits a grant, and nothing here asks the owner for a key, an id, a GrantRef or a template ref.
The config directory is the add-on's mapping (`bridge_install.ha_config_dir`: `/homeassistant`, legacy `/config`).

What the delivery does on its own and what Arx keeps behind ONE switch (`wiskey.auto_install`, default OFF, no screen):
- reading the manifest, validating it and reporting its state: always (read-only, no I/O towards WisKey);
- staging the pinned native bundle into the config directory, the bridge's automatic-install discovery flag, the one restart per
  source digest, flipping the station / listen / template switches and the template registry sync: ONLY with the switch on. Until the
  owner turns it on (joint session, owner28 OWNER-JOINT-LIVE), the installation stays exactly as it is - no WisKey release reaches the
  owner's system, no restart, no switch moves, nothing is sent.
Setup / restart / reconcile never open a door and never send a message by themselves (delivery `installer_effects`).
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import stat
import sys
from pathlib import Path
from typing import Any, Callable

log = logging.getLogger("smplwise.wiskey.install")

FORMAT = "wiskey-local-installation.v1"
RELATIVE_PATH = ".storage/hikvision_intercom.arx_installation/manifest.json"
GRANT_FIELDS = frozenset({"authority_ref", "authority_revision", "scope_ref", "grant_id", "grant_revision", "permission_revision"})
MANIFEST_FIELDS = frozenset({"format", "schema_version", "installation_id", "repository_id", "catalog_sha256", "commands", "entries",
                             "readiness", "template_registry_command", "event_cursor_command", "discovery_command"})
NATIVE_DOMAIN = "hikvision_intercom"
MANIFEST_MAX_BYTES = 1048576

SWITCH_KEY = "wiskey.auto_install"  # "on" enables every installation EFFECT below; anything else (default) is off
RESTART_DIGEST_KEY = "wiskey.installation.restart_digest"


class InstallationError(ValueError):
    """A closed reason (`code`) - never a path, a key or the manifest's content."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def switch_on(conn: Any) -> bool:
    from ..db import get_setting

    try:
        return (get_setting(conn, SWITCH_KEY) or "off") == "on"
    except Exception:  # noqa: BLE001 - an unreadable switch is off
        return False


def switch_on_db(db: Any) -> bool:
    try:
        with db.connection(mode="read", label="wiskey auto install switch") as conn:
            return switch_on(conn)
    except Exception:  # noqa: BLE001
        return False


# ---------------------------------------------------------------- the private manifest (read only)

def _private_ok(info: os.stat_result) -> bool:
    """0600-style privacy on POSIX (the add-on). Windows has no POSIX mode bits: only the developer workstation runs there."""
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
        return False
    return sys.platform.startswith("win") or not (info.st_mode & 0o077)


def read_private_json(path: Path, limit: int = MANIFEST_MAX_BYTES) -> Any:
    """One private regular file (no symlink, one link, no group/other bits), at most `limit` bytes, as strict JSON."""
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0)
    try:
        fd = os.open(str(path), flags)
    except FileNotFoundError:
        raise InstallationError("installation_missing") from None
    except OSError:
        raise InstallationError("installation_unreadable") from None
    try:
        if not _private_ok(os.fstat(fd)):
            raise InstallationError("private_installation_required")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            raw = stream.read(limit + 1)
    finally:
        os.close(fd)
    if len(raw) > limit:
        raise InstallationError("installation_too_large")
    try:
        return json.loads(raw.decode("utf-8"), parse_constant=_no_constant)
    except (UnicodeDecodeError, ValueError):
        raise InstallationError("installation_invalid") from None


def _no_constant(_name: str) -> Any:
    raise ValueError("non-finite number")


def manifest_path(config_root: Path | str | None = None) -> Path:
    from .bridge_install import ha_config_dir

    root = Path(config_root) if config_root is not None else ha_config_dir()
    if root is None:
        raise InstallationError("ha_config_not_mapped")
    return root / RELATIVE_PATH


def read_installation(config_root: Path | str | None = None) -> dict[str, Any]:
    """The delivered reader: a READY manifest with exactly one entry whose GrantRef is the permanent full installation one."""
    value = read_private_json(manifest_path(config_root))
    if (type(value) is not dict or set(value) != MANIFEST_FIELDS or value["format"] != FORMAT or value["schema_version"] != 1
            or value["readiness"] != "ready" or type(value["entries"]) is not list or len(value["entries"]) != 1):
        raise InstallationError("installation_not_ready")
    row = value["entries"][0]
    if (type(row) is not dict or type(row.get("grant_ref")) is not dict or set(row["grant_ref"]) != GRANT_FIELDS
            or row.get("expires_at", "missing") is not None or row.get("authority_mode") != "permanent_full_installation"
            or row.get("repository_id") != value["repository_id"]):
        raise InstallationError("installation_identity_invalid")
    return value


# ---------------------------------------------------------------- the installed client (signed direct transport)

class InstalledWiskeyClient:
    """No owner grant / key / ref entry: the manifest's entry over Arx's original signed direct transport (`DirectApiTransport` ->
    `DirectLink.call_command`). The manifest is re-read before every call; a changed entry refuses (`installation_changed_reconnect_required`)
    - the caller rediscovers, nothing of the old connection is replayed."""

    def __init__(self, settings: Any, config_root: Path | str | None = None, *, key_provider: Callable[[], Any] | None = None,
                 reader: Callable[[], dict[str, Any]] | None = None) -> None:
        self.settings, self.config_root = settings, config_root
        self._read = reader or (lambda: read_installation(self.config_root))
        self.manifest = self._read()
        self.row = self.manifest["entries"][0]
        # the delivery signs with the pairing material WisKey copied into the manifest (the bridge entry's own code); a caller may hand
        # Arx's own key reader instead - both are the same pairing secret
        self._key_provider = key_provider or (lambda: self.row["pairing_material"])
        self.link: Any = None

    def __repr__(self) -> str:  # never the pairing material or a GrantRef
        return "InstalledWiskeyClient()"

    async def connect(self, opener: Callable[[], Any] | None = None) -> "InstalledWiskeyClient":
        from . import wiskey_media_bridge as bridge

        transport = bridge.DirectApiTransport(opener or bridge.websocket_opener(self.settings), self._key_provider)
        self.link = await transport.connect(bridge.PURPOSE_TALK)
        identity = transport.last_identity or {}
        # the authenticated connect already names the service subject and the repository: both must be the manifest's
        if identity.get("query_owner_id") != self.row["query_owner_id"] or identity.get("repository_id") != self.manifest["repository_id"]:
            await self.close()
            raise InstallationError("installation_identity_changed")
        return self

    async def call(self, command: str, parameters: dict[str, Any], *, timeout: float = 20.0) -> dict[str, Any]:
        if self.link is None:
            raise InstallationError("installation_not_connected")
        current = await asyncio.to_thread(self._read)
        if current["entries"] != self.manifest["entries"] or current["repository_id"] != self.manifest["repository_id"]:
            raise InstallationError("installation_changed_reconnect_required")
        return await self.link.call_command(command, parameters, timeout=timeout)

    async def service_write(self, command: str, parameters: dict[str, Any], *, target_ref: str, target_revision: int | None,
                            request_id: str, operation_id: str) -> dict[str, Any]:
        """Kept for the delivery's call shape; Arx's writers go through `wiskey_service_write` (journal first, v2 metadata)."""
        metadata = {**self.row["grant_ref"], "contract": self.row["service_contract"], "role": "access_manager",
                    "actor_id": self.row["query_owner_id"], "target_ref": target_ref, "target_revision": target_revision,
                    "request_id": request_id, "operation_id": operation_id}
        return await self.call(command, {**parameters, "service_write": metadata})

    async def discover(self) -> dict[str, Any]:
        return await self.call(self.manifest["discovery_command"], {})

    async def templates(self) -> dict[str, Any]:
        return await self.call(self.manifest["template_registry_command"], {})

    async def enqueue(self, template: dict[str, Any], ttl_s: int = 300) -> dict[str, Any]:
        return await self.call("whatsapp/template_enqueue_v1", {"template": template, "ttl_s": ttl_s})

    async def events(self, cursor: str | None = None, limit: int = 100) -> dict[str, Any]:
        return await self.call(self.manifest["event_cursor_command"], {"cursor": cursor, "limit": limit})

    async def close(self) -> None:
        link, self.link = self.link, None
        if link is not None:
            await link.close()


# ---------------------------------------------------------------- installation effects (behind the switch)

def activate_software(db: Any) -> bool:
    """The delivery's `activate_software`: connect the station provider (`auto`), video + talk, listen, the template switch, pacing and
    messaging. Arx runs it only with the switch on AND a ready manifest, and it never overrides a value the owner already chose
    (only an unset setting is filled). It never enqueues a message or actuates anything. Returns True when it ran."""
    from ..db import get_setting, set_setting

    if not switch_on_db(db):
        return False
    try:
        read_installation()
    except InstallationError:
        return False
    from . import intercom_messaging, wa_pacing
    from . import wa_template_send as wts

    with db.write_aside(label="wiskey auto install activate") as conn:
        for key, value in (("access.station_media_provider", "auto"), ("access.station_media", "video_talk"), ("access.station_listen", "on")):
            if get_setting(conn, key) is None:
                set_setting(conn, key, value)
        if get_setting(conn, wts.SWITCH_KEY) is None:
            wts.store_switch(conn, True)
        if get_setting(conn, wa_pacing.SETTING_KEY) is None:
            wa_pacing.store_config(conn, wa_pacing.load_config(conn))  # the conservative default, written explicitly
        if get_setting(conn, intercom_messaging.SETTING_KEY) is None:
            messaging = intercom_messaging.read_settings(conn)
            messaging["enabled"] = True
            messaging["revision"] = int(messaging.get("revision") or 0) + 1
            set_setting(conn, intercom_messaging.SETTING_KEY, json.dumps(messaging))
    # the code-level template permit (`intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED`) is NOT flipped here: a real WhatsApp send
    # stays a joint owner session decision (owner28 OWNER-JOINT-LIVE); the delivery set it True at start-up
    return True


def source_digest(source: Path) -> str:
    """SHA-256 over the sorted (relative path, bytes) of every file of `source` (no __pycache__) - the delivery's restart digest."""
    digest = hashlib.sha256()
    for path in sorted(p for p in Path(source).rglob("*") if p.is_file() and "__pycache__" not in p.parts):
        digest.update(path.relative_to(source).as_posix().encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def sync_native_templates(db: Any, reply: Any) -> int:
    """Fill Arx's original registry from WisKey's signed `whatsapp/template_registry_v1` (no owner ids): one stable internal id per
    (account, template_ref); the same name/language on two accounts stays two templates. Any malformed row refuses the whole reply."""
    from . import wa_template_send as wts

    if (not isinstance(reply, dict) or set(reply) != {"schema_version", "state", "templates"} or reply["schema_version"] != 1
            or type(reply["schema_version"]) is not int or reply["state"] != "ready" or type(reply["templates"]) is not list):
        raise InstallationError("native_registry_invalid")
    rows = []
    for item in reply["templates"]:
        if type(item) is not dict or set(item) != {"account", "template_ref", "expected_template_revision", "template_name", "language"}:
            raise InstallationError("native_registry_invalid")
        if not (isinstance(item["account"], str) and isinstance(item["template_ref"], str)):
            raise InstallationError("native_registry_invalid")
        rid = "native_" + hashlib.sha256((item["account"] + "\0" + item["template_ref"]).encode("utf-8")).hexdigest()[:24]
        rows.append({"id": rid, "name": item["template_name"], "language": item["language"], "params": [], "purpose": "notice",
                     "template_ref": item["template_ref"], "template_revision": item["expected_template_revision"], "account": item["account"]})
    refs, problems = wts.validate_registry(rows)
    if problems:
        raise InstallationError("native_registry_invalid")
    with db.write_aside(label="wiskey native template registry") as conn:
        wts.store_registry(conn, refs)
    return len(refs)


# ---------------------------------------------------------------- template_send_v3 (closed companion reader)

V3_KEYS = frozenset({"contract", "schema_version", "template_result", "pacing_outcome", "replay_available"})
V3_PACING_KEYS = frozenset({"schema_version", "state", "code", "retry_after_s", "retry_after_source", "observed_at", "prior_unknown_retry"})


def read_template_outcome_v3(reply: Any) -> dict[str, Any]:
    """`wiskey-template-outcome.v3`: the ORIGINAL closed v2 result (read by `wa_template_send.read_answer(version=2)`) plus a closed
    local pacing companion. `rate_limited -> not_sent` only together with a not_sent v2 result; `retry_after_s` is relative to
    `observed_at` and is no promise; an UNKNOWN never becomes not_sent and nothing is retried automatically."""
    from datetime import datetime

    from .wa_template_send import read_answer

    if (type(reply) is not dict or set(reply) != V3_KEYS or reply["contract"] != "wiskey-template-outcome.v3"
            or type(reply["schema_version"]) is not int or reply["schema_version"] != 3 or reply["replay_available"] is not False):
        raise InstallationError("template_outcome_invalid")
    result = read_answer(reply["template_result"], version=2)
    pacing = reply["pacing_outcome"]
    if pacing is not None:
        if (type(pacing) is not dict or set(pacing) != V3_PACING_KEYS or type(pacing["schema_version"]) is not int
                or pacing["schema_version"] != 1 or pacing["state"] != "not_sent" or pacing["code"] != "rate_limited"
                or pacing["prior_unknown_retry"] is not False or pacing["retry_after_source"] != "original_local_ledger"
                or result.state != "not_sent"):
            raise InstallationError("template_outcome_invalid")
        delay = pacing["retry_after_s"]
        if delay is not None and (type(delay) is not int or not 0 <= delay <= 2 ** 53 - 1):
            raise InstallationError("template_outcome_invalid")
        try:
            observed = datetime.fromisoformat(pacing["observed_at"]) if isinstance(pacing["observed_at"], str) else None
        except ValueError:
            observed = None
        if observed is None or observed.utcoffset() is None:
            raise InstallationError("template_outcome_invalid")
    return {"result": result, "pacing_outcome": pacing, "automatic_retry": False}


async def send_installed_template_v3(client: InstalledWiskeyClient, template: dict[str, Any]) -> dict[str, Any]:
    reply = await client.call("whatsapp/template_send_v3", {"schema_version": 3, "template": template})
    return read_template_outcome_v3(reply)
