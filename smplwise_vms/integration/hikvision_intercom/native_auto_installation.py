"""Owner-authorized local installation authority, generated only by WisKey.

Private manifest is a bootstrap file, not a public API. Arx reads it and uses
its original signed direct transport. No HA account or physical action is made.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
from pathlib import Path
from uuid import uuid4

from homeassistant.config_entries import SIGNAL_CONFIG_ENTRY_CHANGED, ConfigEntryState
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util.file import write_utf8_file_atomic

from .const import DOMAIN
from .storage import AccessStore
from .trusted_actions.validation import Refusal, reference

KEY = "native_auto_installation"
FORMAT = "wiskey-local-installation.v1"
SERVICE_CONTRACT = "wiskey-native-service-write.v2"
RELATIVE_PATH = f".storage/{DOMAIN}.arx_installation/manifest.json"
GRANT_KEYS = (
    "authority_ref",
    "authority_revision",
    "scope_ref",
    "grant_id",
    "grant_revision",
    "permission_revision",
)


async def prepare_storage(hass):
    """Quiescent startup migration through the existing ECC engine, before writers."""
    import os

    from .access.ecc_storage import open_ecc_storage
    from .access.repository import AccessRepository
    from .ecc_host_storage import close_selection, selection_directory

    directory = selection_directory(hass)
    if await hass.async_add_executor_job(os.path.lexists, directory):
        return
    original = AccessStore(hass)
    repository = AccessRepository(original.async_save)
    await repository.async_load(await original.async_load())
    snapshot = repository.snapshot()
    selection = await open_ecc_storage(
        directory,
        repository_id=str(uuid4()),
        legacy_image=snapshot,
        create=True,
        source_guard=lambda: repository.snapshot() == snapshot,
    )
    await close_selection(selection)


class NativeAutoInstallation:
    def __init__(self, hass, store, state):
        self.hass, self.store = hass, store
        self.state = state
        self.lock = asyncio.Lock()
        self.stopping = False
        self.tasks = set()
        self.remove = lambda: None
        hass.data[DOMAIN][KEY] = self

    def grant(self, entry):
        if self.stopping or self.hass.data[DOMAIN].get(KEY) is not self:
            raise Refusal("installation_unavailable")
        row = self.state["entries"].get(entry.entry_id)
        registry = self.hass.data[DOMAIN]["native_peer_registry"]
        if (
            row is None
            or row["repository_id"] != registry.repository_id
            or row["pairing_sha256"]
            != hashlib.sha256(entry.data.get("pairing_code", "").encode()).hexdigest()
            or entry.state is not ConfigEntryState.LOADED
        ):
            raise Refusal("installation_identity_changed")
        return dict(row["grant_ref"])

    async def reconcile(self):
        async with self.lock:
            if self.stopping or self.hass.is_stopping:
                return
            from .direct_bridge_api import _registered_handlers
            from .trusted_actions.direct_bridge_origin import DIRECT_READ_COMMANDS, PATH

            registry = self.hass.data[DOMAIN]["native_peer_registry"]
            registry._stable()
            commands = sorted(set(_registered_handlers(self.hass)) | set(DIRECT_READ_COMMANDS))
            catalog = hashlib.sha256(json.dumps(commands).encode()).hexdigest()
            current = json.loads(json.dumps(self.state))
            rows = []
            for entry in self.hass.config_entries.async_entries("smplwise_bridge"):
                material = entry.data.get("pairing_code")
                if entry.state is not ConfigEntryState.LOADED or not isinstance(material, str):
                    continue
                digest = hashlib.sha256(material.encode()).hexdigest()
                old = current["entries"].get(entry.entry_id)
                if old is None or (old["repository_id"], old["pairing_sha256"]) != (
                    registry.repository_id,
                    digest,
                ):
                    ref = "installation:" + uuid4().hex
                    old = {
                        "repository_id": registry.repository_id,
                        "pairing_sha256": digest,
                        "grant_ref": {
                            "authority_ref": ref,
                            "authority_revision": 1,
                            "scope_ref": ref + ":all",
                            "grant_id": ref + ":grant",
                            "grant_revision": 1,
                            "permission_revision": 1,
                        },
                    }
                    current["entries"][entry.entry_id] = old
                owner = "arx-service:" + entry.entry_id
                binding = f"bridge:{entry.entry_id}:{owner}"
                table = registry._stable()
                head = table["heads"].get(binding)
                if head is None:
                    await registry.provision(
                        binding,
                        expected_revision=0,
                        verified_peer_ref="smplwise_bridge:" + entry.entry_id,
                        query_owner_id=owner,
                        active=True,
                        historical_read=True,
                        transport_entry_id=entry.entry_id,
                    )
                    head = 1
                version = registry._stable()["versions"][binding][str(head)]
                if not version["active"] or version.get("transport_entry_id") != entry.entry_id:
                    raise Refusal("installation_peer_generation_changed")
                rows.append(
                    {
                        "entry_id": entry.entry_id,
                        "repository_id": registry.repository_id,
                        "query_owner_id": owner,
                        "grant_ref": old["grant_ref"],
                        "authority_mode": "permanent_full_installation",
                        "expires_at": None,
                        "coverage": "all_current_and_future_supported_capabilities_and_resources",
                        "service_contract": SERVICE_CONTRACT,
                        "peer_binding_ref": binding,
                        "peer_binding_revision": head,
                        "direct_path": PATH,
                        "pairing_material": material,
                    }
                )
            await self.store.async_save(current)
            self.state = current
            manifest = {
                "format": FORMAT,
                "schema_version": 1,
                "installation_id": current["installation_id"],
                "repository_id": registry.repository_id,
                "catalog_sha256": catalog,
                "commands": commands,
                "entries": rows,
                "readiness": "ready" if rows else "waiting_for_arx_bridge",
                "template_registry_command": "whatsapp/template_registry_v1",
                "event_cursor_command": "events/resume_v1",
                "discovery_command": "direct/capabilities_v2",
            }

            def publish():
                path = Path(self.hass.config.path(RELATIVE_PATH))
                from .access.native_sqlite_backup import private_directory

                private_directory(path.parent)
                write_utf8_file_atomic(
                    str(path), json.dumps(manifest, sort_keys=True), private=True
                )

            await self.hass.async_add_executor_job(publish)

    def schedule(self):
        if self.stopping:
            return
        task = self.hass.async_create_task(self.reconcile(), "WisKey automatic installation")
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def close(self):
        self.stopping = True
        self.remove()
        if self.tasks:
            await asyncio.gather(*tuple(self.tasks), return_exceptions=True)


async def setup_auto_installation(hass):
    store = AccessStore(hass, key=DOMAIN + ".automatic_installation")
    state = await store.async_load()
    if state is None:
        state = {
            "schema_version": 1,
            "installation_id": "installation:" + secrets.token_hex(16),
            "entries": {},
        }
    if (
        type(state) is not dict
        or set(state) != {"schema_version", "installation_id", "entries"}
        or state["schema_version"] != 1
        or not isinstance(state["entries"], dict)
    ):
        raise Refusal("installation_storage_invalid")
    reference(state["installation_id"])
    for entry_id, row in state["entries"].items():
        reference(entry_id)
        if (
            type(row) is not dict
            or set(row) != {"repository_id", "pairing_sha256", "grant_ref"}
            or type(row["pairing_sha256"]) is not str
            or len(row["pairing_sha256"]) != 64
            or any(char not in "0123456789abcdef" for char in row["pairing_sha256"])
            or type(row["grant_ref"]) is not dict
            or set(row["grant_ref"]) != set(GRANT_KEYS)
        ):
            raise Refusal("installation_storage_invalid")
        reference(row["repository_id"])
        for key, value in row["grant_ref"].items():
            if key.endswith("revision"):
                if type(value) is not int or not 1 <= value < 2**53:
                    raise Refusal("installation_storage_invalid")
            else:
                reference(value)
    installer = NativeAutoInstallation(hass, store, state)

    @callback
    def changed(_change, entry):
        if entry.domain in (DOMAIN, "smplwise_bridge"):
            installer.schedule()

    installer.remove = async_dispatcher_connect(hass, SIGNAL_CONFIG_ENTRY_CHANGED, changed)

    async def stop(_event):
        await installer.close()

    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, stop)
    await installer.reconcile()
    return installer
