"""0.9.1 (CR-040): the Home Assistant glue of the trust services - the logic is trust.py (pure, unit-tested without Home Assistant).

- The trust state lives in a PRIVATE store written atomically and at once (`Store(..., private=True, atomic_writes=True)`,
  `async_save`): a rotation is answered only after the new key is on disk, so a crash can never leave the bridge on a key the add-on
  was not told about without a record of it. The config entry mirrors the key and the epoch (best effort: Home Assistant writes the
  config entries file with a delay; the store is the record and wins at the next start).
- The services take exactly `{signed_message_json}`; no voluptuous schema of their own, so Home Assistant adds no default and the
  closed refusal of trust.process (stage `transport`) answers any other shape.
- A store that cannot be read is never overwritten (the ledger is never pruned): the rest of the bridge keeps working on the config
  entry's key and every trust operation is refused `state/storage_unavailable` until it is repaired.
- Logs carry the service, result, stage / code, request ids and epochs only (trust.log_fields) - never a key, salt, proof, nonce or
  signature."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.helpers.storage import Store

from . import trust
from .const import CONF_PAIRING_CODE, CONF_PAIRING_ID, CONF_TRUST_EPOCH, DOMAIN, SERVICE_TRUST_ROTATE, SERVICE_TRUST_STATUS
from .signing import Verifier

_LOGGER = logging.getLogger(__name__)
STORE_KEY = f"{DOMAIN}.trust"
TRUST_SCHEMA = vol.Schema({}, extra=vol.ALLOW_EXTRA)


async def async_setup_trust(hass: HomeAssistant, entry: ConfigEntry, verifier: Verifier) -> trust.TrustRuntime:
    """Load (or start) this entry's trust state, put its ONE current key into the shared verifier and register the two services."""
    store: Store = Store(hass, trust.STORE_VERSION, STORE_KEY, private=True, atomic_writes=True)
    pairing_id = str(entry.data.get(CONF_PAIRING_ID) or "legacy")
    usable = True
    try:
        stored: Any = await store.async_load()
    except Exception as exc:  # noqa: BLE001 - an unreadable store is never overwritten
        _LOGGER.warning("smplwise_bridge trust store unreadable (%s): trust operations are refused until it is repaired", type(exc).__name__)
        stored, usable = None, False
    state = trust.reconcile(stored, entry.entry_id, pairing_id, entry.data.get(CONF_TRUST_EPOCH))
    if usable and state != stored:
        try:
            await store.async_save(state)
        except Exception as exc:  # noqa: BLE001
            _LOGGER.warning("smplwise_bridge trust store not written (%s): trust operations are refused", type(exc).__name__)
            usable = False
    verifier.secret = trust.current_key(state, entry.data[CONF_PAIRING_CODE])

    def mirror(key: str, epoch: int) -> None:
        if entry.data.get(CONF_PAIRING_CODE) == key and entry.data.get(CONF_TRUST_EPOCH) == epoch:
            return
        hass.config_entries.async_update_entry(entry, data={**entry.data, CONF_PAIRING_CODE: key, CONF_TRUST_EPOCH: epoch})

    if usable:
        mirror(verifier.secret, int(state["epoch"]))

    async def save(new_state: dict[str, Any]) -> None:
        await store.async_save(new_state)

    runtime = trust.TrustRuntime(verifier, state, save, usable=usable, on_switch=mirror)

    async def handle(call: ServiceCall) -> ServiceResponse:
        answer = await runtime.handle(call.service, dict(call.data))
        fields = trust.log_fields(call.service, answer)
        if answer.get("result") == "rejected":
            _LOGGER.warning("smplwise_bridge.%s refused: %s/%s", call.service, fields.get("stage"), fields.get("code"))
        else:
            _LOGGER.info("smplwise_bridge.%s: %s", call.service, fields)
        return answer

    hass.services.async_register(DOMAIN, SERVICE_TRUST_ROTATE, handle, schema=TRUST_SCHEMA, supports_response=SupportsResponse.ONLY)
    hass.services.async_register(DOMAIN, SERVICE_TRUST_STATUS, handle, schema=TRUST_SCHEMA, supports_response=SupportsResponse.ONLY)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = runtime
    return runtime


def async_unload_trust(hass: HomeAssistant, entry: ConfigEntry) -> None:
    hass.services.async_remove(DOMAIN, SERVICE_TRUST_ROTATE)
    hass.services.async_remove(DOMAIN, SERVICE_TRUST_STATUS)
    hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)


def current_key_of(hass: HomeAssistant) -> str | None:
    """The running bridge's one key (for the config flow's "same pairing?" test), None when no entry runs."""
    for runtime in (hass.data.get(DOMAIN) or {}).values():
        if isinstance(runtime, trust.TrustRuntime):
            return runtime.verifier.secret
    return None
