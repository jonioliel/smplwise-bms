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


# ---------------------------------------------------------------- step 3: the full closed manifest schema, its state, the GrantRef

ENTRY_FIELDS = frozenset({"entry_id", "repository_id", "query_owner_id", "grant_ref", "authority_mode", "expires_at", "coverage",
                          "service_contract", "peer_binding_ref", "peer_binding_revision", "direct_path", "pairing_material"})
SERVICE_CONTRACT_V2 = "wiskey-native-service-write.v2"
COVERAGE = "all_current_and_future_supported_capabilities_and_resources"
READINESS = ("ready", "waiting_for_arx_bridge")
_MAX_REF = 128
_MAX_REVISION = 2 ** 53 - 1


def _ref(value: Any, limit: int = _MAX_REF) -> bool:
    return (isinstance(value, str) and 1 <= len(value.encode("utf-8")) <= limit
            and not any(ord(c) < 32 or ord(c) == 127 for c in value))


def _rev(value: Any) -> bool:
    return type(value) is int and 1 <= value <= _MAX_REVISION


def check_manifest(value: Any) -> dict[str, Any]:
    """The closed `wiskey-local-installation.v1` document as WisKey's `native_auto_installation.reconcile` writes it: every top field, every
    entry field and every GrantRef field typed; `readiness` ready (exactly one entry: Arx is one bridge entry) or waiting_for_arx_bridge
    (no entry). Returns the document; anything else is InstallationError (closed code, never the content)."""
    if type(value) is not dict or set(value) != MANIFEST_FIELDS:
        raise InstallationError("installation_invalid")
    if value["format"] != FORMAT or type(value["schema_version"]) is not int or value["schema_version"] != 1:
        raise InstallationError("installation_unsupported")
    if not (_ref(value["installation_id"]) and _ref(value["repository_id"]) and isinstance(value["catalog_sha256"], str)
            and len(value["catalog_sha256"]) == 64 and all(c in "0123456789abcdef" for c in value["catalog_sha256"])):
        raise InstallationError("installation_invalid")
    commands = value["commands"]
    if type(commands) is not list or not all(_ref(c) for c in commands) or commands != sorted(set(commands)):
        raise InstallationError("installation_invalid")
    if not all(_ref(value[k]) for k in ("template_registry_command", "event_cursor_command", "discovery_command")):
        raise InstallationError("installation_invalid")
    if value["readiness"] not in READINESS or type(value["entries"]) is not list:
        raise InstallationError("installation_invalid")
    if (value["readiness"] == "ready") != (len(value["entries"]) >= 1):
        raise InstallationError("installation_invalid")
    for row in value["entries"]:
        if type(row) is not dict or set(row) != ENTRY_FIELDS:
            raise InstallationError("installation_identity_invalid")
        g = row["grant_ref"]
        if (type(g) is not dict or set(g) != GRANT_FIELDS or not all(_ref(g[k]) for k in ("authority_ref", "scope_ref", "grant_id"))
                or not all(_rev(g[k]) for k in ("authority_revision", "grant_revision", "permission_revision"))):
            raise InstallationError("installation_identity_invalid")
        if (row["authority_mode"] != "permanent_full_installation" or row["expires_at"] is not None or row["coverage"] != COVERAGE
                or row["service_contract"] != SERVICE_CONTRACT_V2 or row["repository_id"] != value["repository_id"]):
            raise InstallationError("installation_identity_invalid")
        if not (_ref(row["entry_id"]) and _ref(row["query_owner_id"]) and row["query_owner_id"] == "arx-service:" + row["entry_id"]
                and _ref(row["peer_binding_ref"], 512) and _rev(row["peer_binding_revision"]) and _ref(row["direct_path"], 512)
                and row["direct_path"].startswith("/") and _ref(row["pairing_material"], 512)):
            raise InstallationError("installation_identity_invalid")
    if len(value["entries"]) > 1:
        raise InstallationError("installation_entries_ambiguous")  # Arx is ONE bridge entry; two would need a choice Arx does not make
    return value


def read_checked_installation(config_root: Path | str | None = None) -> dict[str, Any]:
    """`check_manifest` over the private file (the strict reader the Arx consumers use)."""
    return check_manifest(read_private_json(manifest_path(config_root)))


def installation_state(config_root: Path | str | None = None) -> dict[str, Any]:
    """A closed, secret-free status of the installation for the add-on's own status view: state, counts, the commands Arx relies on. No
    path, no ref, no GrantRef, no pairing material. `ready` is local authority/transport readiness - not a cloud or hardware proof."""
    try:
        doc = read_checked_installation(config_root)
    except InstallationError as exc:
        state = {"installation_missing": "missing", "ha_config_not_mapped": "not_mapped"}.get(exc.code, "invalid")
        return {"state": state, "code": exc.code, "entries": 0, "commands": 0, "service_contract": None, "relies_on": {}}
    needed = (doc["discovery_command"], doc["event_cursor_command"], doc["template_registry_command"], "whatsapp/template_enqueue_v1")
    return {"state": "ready" if doc["readiness"] == "ready" else "waiting", "code": None, "entries": len(doc["entries"]),
            "commands": len(doc["commands"]), "service_contract": SERVICE_CONTRACT_V2 if doc["entries"] else None,
            "relies_on": {c: c in doc["commands"] for c in needed}}


class ManifestGrantSource:
    """The GrantRef of the service writer (contract v2), read from WisKey's manifest on every call - never cached, never written. None
    while the `wiskey.auto_install` switch is off (when a database is given), the manifest is missing / not ready / invalid."""

    def __init__(self, db: Any = None, config_root: Path | str | None = None, *, reader: Callable[[], Any] | None = None) -> None:
        self._db, self._read = db, reader or (lambda: read_checked_installation(config_root))

    def __repr__(self) -> str:
        return "ManifestGrantSource()"

    def _row(self) -> dict[str, Any] | None:
        if self._db is not None and not switch_on_db(self._db):
            return None
        try:
            doc = self._read()
        except InstallationError:
            return None
        return doc["entries"][0] if doc.get("readiness") == "ready" and doc.get("entries") else None

    def __call__(self) -> Any:
        from .wiskey_service_write import GrantRef

        row = self._row()
        if row is None:
            return None
        ref = GrantRef(**row["grant_ref"])
        return ref if ref.valid() else None

    def actor_id(self) -> str | None:
        row = self._row()
        return row["query_owner_id"] if row is not None else None


# ---------------------------------------------------------------- step 3: the template resource exchange (resources.json)

RESOURCES_RELATIVE_PATH = ".storage/hikvision_intercom.arx_installation/resources.json"
RESOURCES_FORMAT = "wiskey-local-template-resources.v1"
RESOURCE_TOP = frozenset({"format", "accounts", "templates"})
RESOURCE_ACCOUNT = frozenset({"account", "api_version", "business_id", "phone_number_id", "token"})
RESOURCE_TEMPLATE = frozenset({"reference", "revision", "account", "ui_language", "template_id", "name", "language", "body", "parameter_fields"})
RESOURCE_MAX = 128
NATIVE_PARAMETER_FIELDS = ("display_name", "employee_no", "pin", "valid_from", "valid_until")


def check_resources(value: Any) -> dict[str, Any]:
    """The closed `wiskey-local-template-resources.v1` shape (03_templates_queue/RESOURCE_EXPORT_CONTRACT.json): 1..128 accounts and
    templates, closed fields, unique account / reference, every template bound to a listed account. WisKey's own parser
    (`native_template_installation.configuration`) stays the authority on the values; this is Arx's pre-write check."""
    if type(value) is not dict or set(value) != RESOURCE_TOP or value["format"] != RESOURCES_FORMAT:
        raise InstallationError("resources_invalid")
    accounts, templates = value["accounts"], value["templates"]
    if type(accounts) is not list or type(templates) is not list or not 1 <= len(accounts) <= RESOURCE_MAX or not 1 <= len(templates) <= RESOURCE_MAX:
        raise InstallationError("resources_invalid")
    names: set[str] = set()
    for a in accounts:
        if type(a) is not dict or set(a) != RESOURCE_ACCOUNT or not all(_ref(a[k], 4096) for k in RESOURCE_ACCOUNT) or a["account"] in names:
            raise InstallationError("resources_invalid")
        names.add(a["account"])
    refs: set[str] = set()
    for t in templates:
        if (type(t) is not dict or set(t) != RESOURCE_TEMPLATE or not _ref(t["reference"]) or t["reference"] in refs or not _rev(t["revision"])
                or t["account"] not in names or not all(_ref(t[k]) for k in ("ui_language", "template_id", "name", "language"))
                or not isinstance(t["body"], str) or not t["body"] or len(t["body"]) > 1024 or type(t["parameter_fields"]) is not list
                or not all(p in NATIVE_PARAMETER_FIELDS for p in t["parameter_fields"])):
            raise InstallationError("resources_invalid")
        refs.add(t["reference"])
    return value


def write_resources(value: Any, config_root: Path | str | None = None) -> Path:
    """The PRODUCER side of the exchange (owner28 says the Arx installer writes it): checked, then atomically replaced on the same
    filesystem, directory 0700, file 0600. Arx has NO caller yet: the source of real Cloud accounts and approved templates is not in this
    repository (SOURCE-CLOUD-EXPORT, BLOCKED - docs/changes/WISKEY-ADOPT-2272.md). Never fed with owner-typed or invented values."""
    import secrets

    doc = check_resources(value)
    target = manifest_path(config_root).with_name("resources.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(target.parent, 0o700)
    except OSError:
        pass
    tmp = target.with_name(f".resources.{secrets.token_hex(6)}.tmp")
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
    try:
        os.write(fd, json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, target)
    return target


def read_resources(config_root: Path | str | None = None) -> dict[str, Any]:
    return check_resources(read_private_json(manifest_path(config_root).with_name("resources.json")))


# ---------------------------------------------------------------- the installed client (signed direct transport)

class InstalledWiskeyClient:
    """No owner grant / key / ref entry: the manifest's entry over Arx's original signed direct transport (`DirectApiTransport` ->
    `DirectLink.call_command`). The manifest is re-read before every call; a changed entry refuses (`installation_changed_reconnect_required`)
    - the caller rediscovers, nothing of the old connection is replayed."""

    def __init__(self, settings: Any, config_root: Path | str | None = None, *, key_provider: Callable[[], Any] | None = None,
                 reader: Callable[[], dict[str, Any]] | None = None) -> None:
        self.settings, self.config_root = settings, config_root
        self._read = reader or (lambda: read_checked_installation(self.config_root))  # step 3: the full closed schema
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
        if read_checked_installation()["readiness"] != "ready":
            return False
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


# ---------------------------------------------------------------- step 5: the installer (staging, restart by digest, reconcile)

PIN_NAME = NATIVE_DOMAIN + ".pin.json"
NATIVE: dict[str, Any] = {"state": "off", "code": None, "version": None, "restart": None}  # secret-free, no path


def native_source(bridge_source: Path | None) -> Path | None:
    """The pinned native bundle next to the bridge copy: the image's /app/integration/hikvision_intercom, SW_NATIVE_SRC (development),
    or the repository's smplwise_vms/integration/hikvision_intercom."""
    env = os.environ.get("SW_NATIVE_SRC")
    candidates = [Path(env)] if env else []
    if bridge_source is not None:
        candidates.append(Path(bridge_source).parent / NATIVE_DOMAIN)
    parents = Path(__file__).resolve().parents
    if len(parents) > 4:
        candidates.append(parents[3] / "integration" / NATIVE_DOMAIN)  # smplwise_vms/integration in a checkout
    for c in candidates:
        if (c / "manifest.json").is_file():
            return c
    return None


def _tree_files(root: Path) -> dict[str, str]:
    return {NATIVE_DOMAIN + "/" + p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob("*")) if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc"}


def verify_pin(source: Path) -> dict[str, Any]:
    """The bundle must be byte-exact to its pin file (`hikvision_intercom.pin.json` next to it, written when the delivery was staged):
    a changed or partial image copy is never installed. Returns the pin (product CODE, version)."""
    try:
        pin = json.loads((source.parent / PIN_NAME).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise InstallationError("native_pin_missing") from None
    files = _tree_files(source)
    tree = hashlib.sha256()
    for name in sorted(files):
        tree.update(name.encode("utf-8") + b"\0" + files[name].encode("ascii") + b"\n")
    if not isinstance(pin, dict) or pin.get("files") != files or pin.get("tree_sha256") != tree.hexdigest():
        raise InstallationError("native_pin_mismatch")
    return pin


def stage_native_bundle(config_root: Path, source: Path) -> str:
    """The delivery's `install_native_bundle`, by content: copy the pinned bundle into `<config>/custom_components/hikvision_intercom`
    when the installed tree differs from it (a stable version label never hides a new source). `up_to_date` | `staged`."""
    from .bridge_install import _copy_tree

    verify_pin(source)
    target = Path(config_root) / "custom_components" / NATIVE_DOMAIN
    if target.is_dir() and source_digest(target) == source_digest(source):
        return "up_to_date"
    (Path(config_root) / "custom_components").mkdir(exist_ok=True)
    _copy_tree(source, target)
    return "staged"


def request_component_restart(db: Any, settings: Any, source: Path, *, conn: Any = None) -> str:
    """ONE platform restart per staged source digest, durably claimed BEFORE the call: a lost or failed answer is never replayed
    (`restart_unknown`); the same digest again is `already_requested`. Only with the switch on (the caller checks)."""
    from ..db import get_setting, set_setting, unlocked
    from ..errors import ApiError
    from . import ha_client

    value = source_digest(source)

    def claim(c: Any) -> bool:
        if get_setting(c, RESTART_DIGEST_KEY) == value:
            return False
        set_setting(c, RESTART_DIGEST_KEY, value)
        return True

    if conn is None:
        with db.write_aside(label="wiskey restart claim") as c:
            claimed = claim(c)
    else:
        claimed = claim(conn)  # `unlocked(conn)` below commits it before the call leaves
    if not claimed:
        return "already_requested"
    try:
        if conn is None:
            ha_client.call_service(settings, "homeassistant", "restart", {})
        else:
            with unlocked(conn):
                ha_client.call_service(settings, "homeassistant", "restart", {})
    except ApiError:
        return "restart_unknown"  # the claimed digest forbids a blind replay
    return "requested"


def installer_step(db: Any, settings: Any, config_root: Path, bridge_source: Path | None, *, conn: Any = None, restart: bool) -> dict[str, Any]:
    """Called by `bridge_install.install` after the bridge copy. Switch off: nothing (state `off`). Switch on: verify the pin, stage
    the native bundle, and - when the copy changed something and `restart` is asked - one restart per digest. Never raises; never
    blocks the bridge's own install / discovery."""
    if (conn is not None and not switch_on(conn)) or (conn is None and not switch_on_db(db)):
        NATIVE.update(state="off", code=None, restart=None)
        return dict(NATIVE)
    source = native_source(bridge_source)
    if source is None:
        NATIVE.update(state="source_missing", code="native_bundle_missing", restart=None)
        return dict(NATIVE)
    try:
        NATIVE["version"] = json.loads((source / "manifest.json").read_text(encoding="utf-8")).get("version")
        staged = stage_native_bundle(config_root, source)
        NATIVE.update(state=staged, code=None)
        if restart and staged == "staged":
            NATIVE["restart"] = request_component_restart(db, settings, source, conn=conn)
    except InstallationError as exc:
        NATIVE.update(state="error", code=exc.code)
    except (OSError, ValueError) as exc:
        NATIVE.update(state="error", code=f"copy_failed:{type(exc).__name__}")
    return dict(NATIVE)


def reconcile_installation(db: Any, settings: Any) -> str:
    """The hourly janitor step (delivery `reconcile_installation`): with the switch on and a ready manifest, sync the template registry
    from WisKey's signed `whatsapp/template_registry_v1` when the direct join selects it; without a manifest, re-announce the bridge
    (the announcement itself only carries a code while one waits to be paired). Returns a closed outcome."""
    if not switch_on_db(db):
        return "off"
    try:
        read_checked_installation()
    except InstallationError:
        from .bridge_install import announce_discovery

        announce_discovery(db, settings)
        return "manifest_not_ready"
    from . import wiskey_direct_join

    join = wiskey_direct_join.JOIN
    if join is None or not join.selected("whatsapp/template_registry_v1"):
        return "registry_not_selected"
    reply = join.capture_port.call("whatsapp/template_registry_v1", {}, timeout_s=10)
    try:
        sync_native_templates(db, dict(reply))
    except InstallationError:
        return "registry_invalid"  # the stored registry stays as it was (never reset by a bad reply)
    return "registry_synced"


RECONCILE_EVERY_S = 3600.0
_last_reconcile: dict[str, float] = {"at": float("-inf")}


def reconcile_due(db: Any, settings: Any, *, now: float | None = None) -> str | None:
    """The janitor's entry: `reconcile_installation` at most once an hour (None when not due)."""
    import time

    t = time.monotonic() if now is None else now
    if t - _last_reconcile["at"] < RECONCILE_EVERY_S:
        return None
    _last_reconcile["at"] = t
    return reconcile_installation(db, settings)


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
