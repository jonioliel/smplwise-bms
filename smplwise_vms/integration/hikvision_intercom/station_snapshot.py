"""Read the existing station camera image under the installed native authority."""

import base64
from datetime import UTC, datetime

from homeassistant.components.camera import async_get_image
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .trusted_actions.validation import Refusal, reference


async def snapshot(hass, principal, params):
    if set(params) != {"station_id"}:
        raise Refusal("invalid_fields")
    station = reference(params["station_id"])
    entry = hass.config_entries.async_get_entry(station)
    runtime = getattr(entry, "runtime_data", None) if entry is not None else None
    if entry is None or entry.domain != DOMAIN or runtime is None or runtime.is_closed:
        raise Refusal("station_unavailable")
    if not runtime.coordinator.last_update_success:
        raise Refusal("station_offline")
    if not runtime.profile.snapshot:
        raise Refusal("snapshot_not_supported")
    data = entry.data
    registry = er.async_get(hass)

    def candidates():
        return sorted(
            row.entity_id
            for row in er.async_entries_for_config_entry(registry, station)
            if row.domain == "camera" and not row.disabled
        )

    selected = candidates()
    if not selected:
        raise Refusal("snapshot_entity_unavailable")
    if len(selected) != 1:
        raise Refusal("station_camera_ambiguous")
    entity = selected[0]
    row = registry.async_get(entity)
    binding = (row.entity_id, row.unique_id, row.config_entry_id, row.disabled_by)
    principal.check()
    try:
        image = await async_get_image(hass, entity, timeout=10, width=480, height=320)
    except Exception:
        raise Refusal("snapshot_unavailable") from None
    principal.check()
    if (
        hass.config_entries.async_get_entry(station) is not entry
        or entry.runtime_data is not runtime
        or entry.data is not data
        or runtime.is_closed
        or candidates() != [entity]
        or (
            lambda row: (
                row is None
                or (row.entity_id, row.unique_id, row.config_entry_id, row.disabled_by) != binding
            )
        )(registry.async_get(entity))
    ):
        raise Refusal("station_source_changed")
    if (
        image.content_type not in {"image/jpeg", "image/png"}
        or not 1 <= len(image.content) <= 600000
    ):
        raise Refusal("snapshot_unavailable")
    return {
        "contract": "wiskey-station-snapshot.v1",
        "schema_version": 1,
        "station_id": station,
        "entity_id": entity,
        "content_type": image.content_type,
        "encoding": "base64",
        "image": base64.b64encode(image.content).decode(),
        "observed_at": datetime.now(UTC).isoformat(),
    }
