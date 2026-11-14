"""HA-2026-11-COMPAT-2404: Home Assistant's entity display-name rule, ported, so Arx shows the names Home Assistant shows -
before and after the 2026.11 entity-name migration (core entity registry storage 1.24, home-assistant/core#184340, frontend
home-assistant/frontend#54725). The exact sources and the rule table are in docs/changes/HA-2026-11-COMPAT-2404.md.

Three registry shapes reach `config/entity_registry/list`:

- ``v124`` (core 2026.11+): entries carry ``next_name_part`` and no longer ``has_entity_name``. A user-given ``name`` no
  longer carries the device-name prefix (the migration stripped it); the name HA shows is composed from the registries:
  ``[parent device] [device] [entity]`` where the device takes part only while the entity has no area of its own
  (``next_name_part == "device"``) or no name of its own, and the parent device only while the child device has no area of
  its own either (frontend ``computeEntityEntryNameParts`` / core ``async_get_full_entity_name``).
- ``v123`` (core 2026.9 / 2026.10): ``next_name_part`` and ``has_entity_name`` both present. HA shows the state's
  ``friendly_name``, which core builds as ``async_get_legacy_friendly_name``: a user-given name as it is, else
  ``[device] [entity]`` (the device always, whatever the area).
- ``old`` (no ``next_name_part`` key: an older core, or a hand-written fixture): Arx's earlier rule, unchanged - the user's
  name, else ``[device] [original]`` for an entity with ``has_entity_name``, else the original name, else the device name.

``original_name`` in the WebSocket listing is already the unprefixed original name (core ``as_partial_dict``) in v123 and v124.

The "main entity of the device" (frontend: "Main entity of the device ({device})") is not a flag of its own: it is an entity
with a device and no name of its own (``name == ""``, or no name and no original name). It goes by the device name.

A child device (``parent_device_id``, core 2026.9+, first integrations migrated in 2026.11) inherits its parent's area until it
has an area of its own (core ``dr.async_get_effective_area_id``) and has no manufacturer / model of its own.

Pure functions only: no database, no Home Assistant call."""
from __future__ import annotations

from typing import Any

V124 = "v124"
V123 = "v123"
OLD = "old"


def registry_shape(entities: list[dict[str, Any]]) -> str:
    """Which naming rule an entity registry listing follows (see the module docstring). Decided once per listing: one
    Home Assistant answers with one shape."""
    has_next = has_hen = False
    for e in entities:
        if not isinstance(e, dict):
            continue
        has_next = has_next or "next_name_part" in e
        has_hen = has_hen or "has_entity_name" in e
    if has_next and not has_hen:
        return V124
    if has_next:
        return V123
    return OLD


def strip_prefix(entity_name: str | None, prefix: str | None) -> str | None:
    """Core ``_async_strip_prefix_from_entity_name`` (2026.11.0): the entity name without a leading device name. ``None`` when
    the prefix does not meaningfully match (case-folded, at least one separator of `` -:`` after it); ``""`` when the name IS
    the device name. A lower-case first word is capitalised, a mixed-case one kept."""
    if not entity_name or not prefix:
        return None
    prefix_lower = prefix.casefold()
    prefix_len = len(prefix_lower)
    candidate = entity_name[:prefix_len]
    true_prefix_len = len(candidate)
    candidate = candidate.casefold()
    if not candidate.startswith(prefix_lower):
        return None
    prefix_diff = len(candidate) - prefix_len  # a case-folded string can differ in length
    while prefix_diff > 0:
        true_prefix_len -= 1
        prefix_diff -= len(entity_name[true_prefix_len].casefold())
    if prefix_diff < 0:  # matched in the middle of a character
        return None
    new_name = entity_name[true_prefix_len:].lstrip(" -:")
    if not new_name:
        return ""
    if len(new_name) == len(entity_name) - true_prefix_len:  # no separator after the prefix
        return None
    first_word = new_name.partition(" ")[0]
    if not first_word.islower():
        return new_name
    return new_name[0].upper() + new_name[1:]


def device_name(device: dict[str, Any] | None) -> str:
    """Frontend ``computeDeviceName``: the user's name of the device, else its name (trimmed)."""
    d = device or {}
    for k in ("name_by_user", "name"):
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def parent_of(device: dict[str, Any] | None, device_by_id: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    """The parent of a child device (one level: a parent is never itself a child - core resolves it with
    ``include_child_devices=False``), else None."""
    pid = (device or {}).get("parent_device_id")
    if not isinstance(pid, str) or not pid:
        return None
    parent = device_by_id.get(pid)
    if parent is None or parent.get("parent_device_id"):
        return None
    return parent


def device_next_name_part(device: dict[str, Any] | None) -> str | None:
    """A device's ``next_name_part`` as the listing says, else as core computes it for a child device (its own area, else
    its parent)."""
    d = device or {}
    v = d.get("next_name_part")
    if isinstance(v, str) and v:
        return v
    if d.get("parent_device_id"):
        return "area" if d.get("area_id") else "parent_device"
    return None


def effective_area_id(device: dict[str, Any] | None, device_by_id: dict[str, dict[str, Any]]) -> str | None:
    """Core ``dr.async_get_effective_area_id``: the device's own area, else - for a child device - its parent's."""
    if not device:
        return None
    if device.get("area_id"):
        return device["area_id"]
    parent = parent_of(device, device_by_id)
    return (parent or {}).get("area_id") or None


def device_label(device: dict[str, Any] | None, device_by_id: dict[str, dict[str, Any]]) -> str:
    """The name of a device with the context Home Assistant gives it: a child device without an area of its own is named
    after its parent first ("Power strip Socket 1"), as core composes an entity name with the parent-device part."""
    own = device_name(device)
    parent = parent_of(device, device_by_id)
    if parent is not None and device_next_name_part(device) == "parent_device":
        pname = device_name(parent)
        if pname and own and not own.casefold().startswith(pname.casefold()):
            return f"{pname} {own}"
        return own or pname
    return own


def mirror_row_label(r: Any) -> str:
    """`device_label` for a row of the `ha_devices` mirror joined with its parent row as `p_id` / `p_name` / `p_name_by_user`."""
    dev = {"id": r["device_id"], "name": r["name"], "name_by_user": r["name_by_user"], "parent_device_id": r["parent_device_id"],
           "next_name_part": r["next_name_part"] or ("parent_device" if r["parent_device_id"] else None)}
    by_id = {r["p_id"]: {"id": r["p_id"], "name": r["p_name"], "name_by_user": r["p_name_by_user"]}} if r["p_id"] else {}
    return device_label(dev, by_id)


def _text(v: Any) -> str | None:
    return v if isinstance(v, str) else None


def entity_names(e: dict[str, Any], device_by_id: dict[str, dict[str, Any]], shape: str) -> dict[str, Any]:
    """The names of one entity registry entry: ``display`` (what Home Assistant shows), ``short`` (the entity's own part, the
    device name for a main entity - for screens that show the device beside it) and ``main_entity``."""
    name = _text(e.get("name"))
    original = _text(e.get("original_name"))
    device = device_by_id.get(e.get("device_id") or "") if e.get("device_id") else None
    dev_name = device_name(device)
    next_part = e.get("next_name_part")
    if not isinstance(next_part, str):
        next_part = "area" if e.get("area_id") else ("device" if e.get("device_id") else None)

    if shape == V124:
        own = name if name is not None else original
        own = own.strip() if own else ""
        use_device = device is not None and (next_part == "device" or not own)
        parent = parent_of(device, device_by_id)
        use_parent = parent is not None and next_part == "device" and device_next_name_part(device) == "parent_device"
        parts = [device_name(parent) if use_parent else "", dev_name if use_device else "", own]
        display = " ".join(p for p in parts if p)
        main = device is not None and not own
        short = own or dev_name
        return {"display": display, "short": short, "main_entity": main}

    # v123 / old: a user-given name is shown as it is
    if shape == V123:
        if name:
            display = name
        else:
            part = "" if name == "" else (original or "")
            display = " ".join(p for p in (dev_name, part) if p)
    else:
        if name:
            display = name
        elif e.get("has_entity_name") and device is not None:
            display = " ".join(p for p in (dev_name, original or "") if p)
        else:
            display = original or dev_name
    own = name if name is not None else original
    own = own.strip() if own else ""
    if device is not None and own and next_part == "device":
        stripped = strip_prefix(own, dev_name)
        if stripped is not None:
            own = stripped
    main = device is not None and not own
    return {"display": display, "short": own or dev_name, "main_entity": main}
