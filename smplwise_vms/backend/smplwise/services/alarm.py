"""The intrusion alarm (CR-010, אבטחה › אזעקה): panels, their zones and each zone's bypass control, discovered from the
synced entity mirror (services/ha_sync.py) - nothing about state is stored here; only the administrator's corrections to
the automatic pairing (`alarm_zone_overrides`, migration 0036).

- A PANEL is one `alarm_control_panel` entity: its state, the arm modes its `supported_features` offer, whether a code is
  needed (`code_format`, `code_arm_required`), who changed it last, and Alarmo's `open_sensors` / `bypassed_sensors`.
- Its ZONES are the `binary_sensor` entities of the same integration (`platform`) and the same config entry. Auxiliary
  sensors (`_alarmed`, `_armed`, `_tamper`, `_battery`, `_trouble`, device class tamper / battery) attach to the zone of
  their device or stem instead of becoming zones of their own. When one config entry holds several panels (partitions),
  the zones are listed on each of them, marked shared, until an administrator assigns a zone to one panel.
- A zone's BYPASS control is a `switch` (or a `select` with a bypass option - Visonic) of the same integration carrying a
  bypass marker, paired by these strategies in order: the administrator's override; the same device; the same stem
  (entity id, then unique id) once property markers are removed; the same name once the bypass words are removed; the
  zone number (`zone_id` / `zone` / `zone_number` attribute or the `zone_<n>` / `z<n>` in the id). A strategy pairs only
  when its match is unambiguous. A zone without a pair has no bypass; a control without a zone is "unpaired" - listed,
  never hidden.

The per-integration shapes are the INTEGRATIONS table below (docs/changes/CR-010-SECURITY-ALARM.md §2 records where each
was read). This module never calls Home Assistant and never sees a code."""
from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Iterable

# Home Assistant's AlarmControlPanelEntityFeature bits
ARM_HOME, ARM_AWAY, ARM_NIGHT, TRIGGER, ARM_CUSTOM_BYPASS, ARM_VACATION = 1, 2, 4, 8, 16, 32
# (action, feature bit, the state the panel reports once armed that way) - trigger is never offered
ARM_MODES: list[tuple[str, int, str]] = [
    ("arm_home", ARM_HOME, "armed_home"),
    ("arm_away", ARM_AWAY, "armed_away"),
    ("arm_night", ARM_NIGHT, "armed_night"),
    ("arm_vacation", ARM_VACATION, "armed_vacation"),
    ("arm_custom_bypass", ARM_CUSTOM_BYPASS, "armed_custom_bypass"),
]
ACTIONS: dict[str, str] = {m: f"alarm_control_panel.alarm_{m}" for m, _, _ in ARM_MODES} | {"disarm": "alarm_control_panel.alarm_disarm"}
ARMED_STATES = {s for _, _, s in ARM_MODES}
TARGET_STATE: dict[str, str] = {m: s for m, _, s in ARM_MODES} | {"disarm": "disarmed"}

# Opening-type device classes: "on" means open - what "ready to arm" lists. Motion "on" is movement now (an exit route),
# never a reason not to arm. Safety-type classes "on" mean a fault / alarm condition.
OPENING_CLASSES = {"door", "window", "opening", "garage_door", "lock"}
FAULT_CLASSES = {"problem", "tamper", "smoke", "gas", "moisture", "safety", "carbon_monoxide", "heat"}
MOTION_CLASSES = {"motion", "occupancy", "presence", "moving", "vibration", "sound"}

# markers at the end of an object id that name one property of a zone, longest first
AUX_MARKERS = ("low_battery", "battery_low", "tampered", "tamper", "battery", "trouble", "supervision", "alarmed", "armed")
BYPASS_MARKERS = ("bypassed", "bypass")
PROPERTY_MARKERS = ("arm_mode", "opened", "open", "zone", "state", "status") + AUX_MARKERS + BYPASS_MARKERS
AUX_DEVICE_CLASSES = {"tamper": "tamper", "battery": "battery"}
BYPASS_WORDS = ("bypassed", "bypass", "עקיפה", "עקיפת", "עקוף", "arm mode")
ZONE_NUMBER_ATTRS = ("zone_id", "zone", "zone_number")
_NUM_RE = re.compile(r"(?:^|_)(?:zone|z)_?0*(\d{1,4})(?:_|$)")


# Risco (Home Assistant core, homeassistant/components/risco/entity.py): every zone entity's unique id is
# "<site uuid>_zone_<n>" (cloud) or "<system id>_zone_<n>_local" (local), plus the entity's suffix - "" for the zone
# sensor, "_alarmed" / "_armed" for the local zone sensors, "_bypassed" for the bypass switch. The key is exact: the same
# system and the same zone number, never a name guess.
_RISCO_UID = re.compile(r"^(?P<sys>.+)_zone_(?P<n>\d+)(?P<local>_local)?(?:_(?:bypassed|alarmed|armed))?$")


def risco_zone_key(e: dict[str, Any]) -> tuple[str, int, bool] | None:
    m = _RISCO_UID.match(e.get("unique_id") or "")
    return (m.group("sys"), int(m.group("n")), bool(m.group("local"))) if m else None


@dataclass(frozen=True)
class Integration:
    """How one integration shapes its alarm entities. `select_on` / `select_off`: the options of a bypass select that mean
    bypassed / protected (None = any option naming a bypass, and the first other option). `note` is shown in Settings.
    `zone_key`: an exact per-integration key shared by a zone and its bypass control (Risco's zone unique id).
    `exact_only`: pair only by device and `zone_key` - never by stem, name or number (the owner's Risco)."""
    label: str
    select_on: str | None = None
    select_off: str | None = None
    note: str = ""
    verified: bool = False
    zone_key: Any = None
    exact_only: bool = False
    generic_zones: bool = False  # the device class says nothing (Risco reports "motion" for every zone): on = "open"


INTEGRATIONS: dict[str, Integration] = {
    "risco": Integration("Risco", note="one device per zone; switch <zone>_bypassed; unique id <system>_zone_<n>[_local][_bypassed]", verified=True, zone_key=risco_zone_key, exact_only=True, generic_zones=True),
    "visonic": Integration("Visonic PowerMax / PowerMaster", select_on="bypass", select_off="armed", note="select <zone>_arm_mode: bypass / armed", verified=True),
    "mqtt": Integration("MQTT (Paradox PAI and others)", note="switch <zone>_bypassed when PAI publishes 'bypassed'", verified=True),
    "aegis_ajax": Integration("Ajax (Aegis for Ajax)", note="switch <device>_bypass, on = deactivated", verified=True),
    "ajax": Integration("Ajax", note="switch <device>_bypass (shape of Aegis for Ajax)"),
    "pima_force": Integration("PIMA Force", note="switch zone_<n>_bypass (disabled by default)", verified=True),
    "pima": Integration("PIMA", note="switch zone_<n>_bypass (shape of PIMA Force)"),
    "envisalink": Integration("DSC / Honeywell (Envisalink)", note="no bypass control; zone number attribute", verified=True),
    "satel_integra": Integration("Satel Integra", note="no bypass control", verified=True),
    "alarmo": Integration("Alarmo", note="watches sensors of other integrations: assign them in Settings; no bypass control", verified=True),
    "manual": Integration("Manual alarm", note="no zones of its own"),
    "template": Integration("Template alarm", note="no zones of its own"),
}


def integration(platform: str | None) -> Integration:
    return INTEGRATIONS.get(platform or "", Integration(platform or "לא ידוע"))


# ---------------------------------------------------------------- naming helpers

def object_id(entity_id: str) -> str:
    return entity_id.split(".", 1)[1] if "." in entity_id else entity_id


def _ends_with(text: str, marker: str) -> bool:
    return text == marker or text.endswith("_" + marker)


def marker_of(entity_id: str, device_class: str | None = None) -> str | None:
    """The auxiliary property an entity names (tamper, battery, alarmed ...), None for a plain zone sensor."""
    oid = object_id(entity_id)
    for m in AUX_MARKERS:
        if _ends_with(oid, m):
            return {"low_battery": "battery", "battery_low": "battery", "tampered": "tamper"}.get(m, m)
    for m in BYPASS_MARKERS:
        if _ends_with(oid, m):
            return "bypassed"
    return AUX_DEVICE_CLASSES.get(device_class or "")


def stem(text: str | None) -> str:
    """An id with its property / bypass markers removed (`front_door_bypassed` -> `front_door`, `bypass_front_door` ->
    `front_door`, `visonic_z01_arm_mode` -> `visonic_z01`). Never strips to nothing."""
    s = (text or "").strip().lower()
    if not s:
        return ""
    s = re.sub(r"[^a-z0-9_]+", "_", s).strip("_")
    changed = True
    while changed:
        changed = False
        for p in ("bypass_", "bypassed_"):
            if s.startswith(p) and len(s) > len(p):
                s, changed = s[len(p):], True
        for m in PROPERTY_MARKERS:
            if s.endswith("_" + m) and len(s) > len(m) + 1:
                s, changed = s[: -(len(m) + 1)], True
    return s


def name_key(name: str | None) -> str:
    """A display name with the bypass words removed, case / punctuation folded - for strategy 4."""
    s = unicodedata.normalize("NFKC", name or "").casefold()
    for w in BYPASS_WORDS:
        s = s.replace(w, " ")
    s = re.sub(r"[\W_]+", " ", s)
    return " ".join(s.split())


def zone_number(e: dict[str, Any]) -> int | None:
    attrs = e.get("attributes") or {}
    for k in ZONE_NUMBER_ATTRS:
        v = attrs.get(k)
        if isinstance(v, bool):
            continue
        if isinstance(v, (int, float)) and float(v).is_integer():
            return int(v)
        if isinstance(v, str) and v.strip().isdigit():
            return int(v.strip())
    m = _NUM_RE.search(object_id(e["entity_id"]))
    return int(m.group(1)) if m else None


def _has_bypass_marker(e: dict[str, Any]) -> bool:
    oid = object_id(e["entity_id"])
    tokens = set(oid.split("_"))
    if tokens & {"bypass", "bypassed"}:
        return True
    uid = (e.get("unique_id") or "").lower()
    if "bypass" in uid:
        return True
    n = (e.get("name") or e.get("original_name") or "").casefold()
    return "bypass" in n or "עקיפ" in n or "עקוף" in n


def select_options(e: dict[str, Any]) -> tuple[str | None, str | None]:
    """(bypassed option, protected option) of a bypass select, or (None, None) when it names no bypass option."""
    opts = [o for o in ((e.get("attributes") or {}).get("options") or []) if isinstance(o, str)]
    prof = integration(e.get("platform"))
    on = prof.select_on if prof.select_on in opts else next((o for o in opts if "bypass" in o.casefold() and "un" not in o.casefold()[:2] or "עקיפ" in o or "עקוף" in o), None)
    if on is None:
        return None, None
    off = prof.select_off if prof.select_off in opts else next((o for o in opts if o != on and o.casefold() in ("armed", "active", "normal", "unbypass", "unbypassed", "off", "none", "restore")), None)
    if off is None:
        off = next((o for o in opts if o != on), None)
    return on, off


def is_bypass_control(e: dict[str, Any]) -> bool:
    if e["domain"] == "switch":
        return _has_bypass_marker(e)
    if e["domain"] == "select":
        return select_options(e)[0] is not None
    return False


def bypass_state(e: dict[str, Any]) -> bool | None:
    """Whether a bypass control says its zone is bypassed now (None: unknown / unavailable)."""
    st = e.get("state")
    if st in (None, "unknown", "unavailable"):
        return None
    if e["domain"] == "switch":
        return st == "on"
    on, _ = select_options(e)
    return st == on


# ---------------------------------------------------------------- loading

def load(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Every live, enabled entity the alarm could use (panels, binary sensors, switches, selects)."""
    from . import ha_sync

    rows = conn.execute(
        "SELECT * FROM ha_entities WHERE removed_at IS NULL AND disabled = 0 AND domain IN ('alarm_control_panel', 'binary_sensor', 'switch', 'select') ORDER BY entity_id"
    ).fetchall()
    return [ha_sync.entity_row(r) for r in rows]


def overrides(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    try:
        rows = conn.execute("SELECT * FROM alarm_zone_overrides").fetchall()
    except sqlite3.OperationalError:  # before migration 0036
        return {}
    return {r["zone_entity_id"]: dict(r) for r in rows}


# ---------------------------------------------------------------- discovery

@dataclass
class _Group:
    platform: str
    config_entry_id: str | None
    panels: list[dict[str, Any]] = field(default_factory=list)
    sensors: list[dict[str, Any]] = field(default_factory=list)
    controls: list[dict[str, Any]] = field(default_factory=list)


def _group_key(e: dict[str, Any]) -> tuple[str, str | None]:
    return (e.get("platform") or "", e.get("config_entry_id"))


def _belongs(e: dict[str, Any], g: _Group) -> bool:
    if (e.get("platform") or "") != g.platform or not g.platform:
        return False
    # security review L5: the same config entry, never a guess - an entity (or a panel) without one joins no group
    return g.config_entry_id is not None and e.get("config_entry_id") == g.config_entry_id


def _pair_unique(zones: list[dict[str, Any]], controls: list[dict[str, Any]], key, strategy: str, pairs: dict[str, tuple[dict[str, Any], str]]) -> None:
    """Pair every key held by exactly one unpaired zone and exactly one unpaired control."""
    by_zone: dict[Any, list[dict[str, Any]]] = {}
    by_ctl: dict[Any, list[dict[str, Any]]] = {}
    paired_ctl = {c["entity_id"] for c, _ in pairs.values()}
    for z in zones:
        if z["entity_id"] in pairs:
            continue
        k = key(z, False)
        if k not in (None, ""):
            by_zone.setdefault(k, []).append(z)
    for c in controls:
        if c["entity_id"] in paired_ctl:
            continue
        k = key(c, True)
        if k not in (None, ""):
            by_ctl.setdefault(k, []).append(c)
    for k, zs in by_zone.items():
        cs = by_ctl.get(k, [])
        if len(zs) == 1 and len(cs) == 1:
            pairs[zs[0]["entity_id"]] = (cs[0], strategy)


def _pair(zones: list[dict[str, Any]], controls: list[dict[str, Any]], platform: str = "") -> dict[str, tuple[dict[str, Any], str]]:
    pairs: dict[str, tuple[dict[str, Any], str]] = {}
    prof = integration(platform)
    # 2. the same device (a device with exactly one zone and one bypass control - Risco, Visonic, PAI per-zone devices)
    _pair_unique(zones, controls, lambda e, _c: e.get("device_id") or None, "device", pairs)
    if prof.zone_key is not None:
        # the integration's own exact key (Risco: the same system and zone number in the unique id)
        _pair_unique(zones, controls, lambda e, _c: prof.zone_key(e), "zone_id", pairs)
    if prof.exact_only:
        return pairs
    # 3. the same stem: entity id, then unique id
    _pair_unique(zones, controls, lambda e, _c: stem(object_id(e["entity_id"])), "entity_id", pairs)
    _pair_unique(zones, controls, lambda e, _c: stem(e.get("unique_id")), "unique_id", pairs)
    # 4. the same name without the bypass words
    _pair_unique(zones, controls, lambda e, _c: name_key(e.get("name") or e.get("original_name") or (e.get("attributes") or {}).get("friendly_name")), "name", pairs)
    # 5. the zone number
    _pair_unique(zones, controls, lambda e, _c: zone_number(e), "zone_number", pairs)
    return pairs


def _attach_aux(sensors: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    """Split binary sensors into zones and auxiliary sensors attached to a zone (by device, then stem)."""
    primary = [s for s in sensors if not marker_of(s["entity_id"], s.get("device_class"))]
    aux = [s for s in sensors if marker_of(s["entity_id"], s.get("device_class"))]
    by_device: dict[str, list[dict[str, Any]]] = {}
    by_stem: dict[str, list[dict[str, Any]]] = {}
    for z in primary:
        if z.get("device_id"):
            by_device.setdefault(z["device_id"], []).append(z)
        by_stem.setdefault(stem(object_id(z["entity_id"])), []).append(z)
    attached: dict[str, list[dict[str, Any]]] = {}
    zones = list(primary)
    for a in aux:
        target = None
        dev = by_device.get(a.get("device_id") or "", [])
        if len(dev) == 1:
            target = dev[0]
        else:
            same = by_stem.get(stem(object_id(a["entity_id"])), [])
            if len(same) == 1:
                target = same[0]
        if target is None:
            zones.append(a)  # nothing to attach to: a zone of its own (a panel-box tamper, a lone battery sensor)
        else:
            attached.setdefault(target["entity_id"], []).append(a)
    return zones, attached


def _truthy(v: Any) -> bool | None:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str) and v.strip().lower() in ("true", "on", "yes", "1"):
        return True
    if isinstance(v, str) and v.strip().lower() in ("false", "off", "no", "0"):
        return False
    return None


def _zone_view(z: dict[str, Any], aux: list[dict[str, Any]], control: tuple[dict[str, Any], str] | None, *, shared: bool, bypassed_by_panel: set[str], override: bool) -> dict[str, Any]:
    attrs = z.get("attributes") or {}
    dc = z.get("device_class") or attrs.get("device_class")
    state = z.get("state")
    available = bool(z.get("available")) and state not in ("unavailable", None)
    tamper = _truthy(attrs.get("tamper")) or _truthy(attrs.get("device_tamper")) or _truthy(attrs.get("zone_tamper"))
    trouble = _truthy(attrs.get("zone_trouble"))
    battery_low = _truthy(attrs.get("battery_low"))
    battery_level = attrs.get("battery_level") if isinstance(attrs.get("battery_level"), (int, float)) and not isinstance(attrs.get("battery_level"), bool) else None
    alarmed = None
    bypass_sensor = None
    for a in aux:
        kind = marker_of(a["entity_id"], a.get("device_class"))
        on = a.get("state") == "on"
        if kind == "tamper":
            tamper = bool(tamper) or on
        elif kind == "battery":
            battery_low = bool(battery_low) or on
        elif kind == "trouble":
            trouble = bool(trouble) or on
        elif kind == "alarmed":
            alarmed = on
        elif kind == "bypassed":
            bypass_sensor = on
    open_now = state == "on"
    kind = "opening" if dc in OPENING_CLASSES else "motion" if dc in MOTION_CLASSES else "fault" if dc in FAULT_CLASSES else "other"
    if integration(z.get("platform")).generic_zones and kind != "fault":
        kind = "zone"  # an alarm zone whose sensor type the integration does not report: "on" = violated / open
    ctl = None
    bypassed = None
    if control is not None:
        c, strategy = control
        on_opt, off_opt = select_options(c) if c["domain"] == "select" else (None, None)
        bypassed = bypass_state(c)
        ctl = {"entity_id": c["entity_id"], "domain": c["domain"], "name": c.get("name") or c.get("original_name") or (c.get("attributes") or {}).get("friendly_name") or c["entity_id"],
               "state": c.get("state"), "available": bool(c.get("available")) and c.get("state") not in ("unavailable", None), "bypassed": bypassed, "strategy": "override" if override else strategy,
               "on_option": on_opt, "off_option": off_opt}
    if bypassed is None and bypass_sensor is not None:
        bypassed = bypass_sensor
    if bypassed is None and _truthy(attrs.get("bypassed")) is not None:
        bypassed = _truthy(attrs.get("bypassed"))
    if z["entity_id"] in bypassed_by_panel:
        bypassed = True
    return {
        "entity_id": z["entity_id"],
        "name": z.get("name") or z.get("original_name") or attrs.get("friendly_name") or z["entity_id"],
        "platform": z.get("platform"),
        "device_class": dc,
        "kind": kind,
        "state": state,
        "available": available,
        "open": bool(open_now and available),
        "fault": (not available) or bool(trouble) or (kind == "fault" and open_now),
        "tamper": tamper,
        "battery_low": battery_low,
        "battery_level": battery_level,
        "alarmed": alarmed,
        "bypassed": bool(bypassed),
        "last_changed": z.get("last_changed"),
        "area_id": z.get("area_id"),
        "area_name": z.get("area_name"),
        "ha_floor_name": z.get("ha_floor_name"),
        "zone_number": zone_number(z),
        "aux": [a["entity_id"] for a in aux],
        "shared": shared,
        "bypass": ctl,
    }


def _panel_view(p: dict[str, Any]) -> dict[str, Any]:
    attrs = p.get("attributes") or {}
    feats = int(p.get("supported_features") or 0)
    modes = [m for m, bit, _ in ARM_MODES if feats & bit]
    reported = bool(feats & (ARM_HOME | ARM_AWAY | ARM_NIGHT | ARM_VACATION | ARM_CUSTOM_BYPASS))
    if not reported:
        modes = ["arm_home", "arm_away"]  # an integration that reports no features: the two every panel has
    code_format = attrs.get("code_format") if attrs.get("code_format") in ("number", "text") else None
    code_arm_required = attrs.get("code_arm_required")
    code_arm_required = True if code_arm_required is None else bool(code_arm_required)  # Home Assistant's default
    open_sensors = attrs.get("open_sensors") if isinstance(attrs.get("open_sensors"), dict) else {}
    bypassed_sensors = [s for s in (attrs.get("bypassed_sensors") or []) if isinstance(s, str)] if isinstance(attrs.get("bypassed_sensors"), list) else []
    prof = integration(p.get("platform"))
    return {
        "entity_id": p["entity_id"],
        "name": p.get("name") or p.get("original_name") or attrs.get("friendly_name") or p["entity_id"],
        "platform": p.get("platform"),
        "integration": prof.label,
        "integration_note": prof.note,
        "config_entry_id": p.get("config_entry_id"),
        "device_id": p.get("device_id"),
        "state": p.get("state"),
        "available": bool(p.get("available")) and p.get("state") not in ("unavailable", None),
        "fresh": bool(p.get("fresh")),
        "last_changed": p.get("last_changed"),
        "changed_by": attrs.get("changed_by") if isinstance(attrs.get("changed_by"), str) else None,
        "arm_modes": modes,
        "features_reported": reported,
        "code_format": code_format,
        "code_arm_required": code_arm_required,
        "needs_code_arm": code_format is not None and code_arm_required,
        "needs_code_disarm": code_format is not None,
        "area_name": p.get("area_name"),
        "open_sensors": sorted(k for k in open_sensors if isinstance(k, str)),
        "bypassed_sensors": bypassed_sensors,
    }


def discover(conn: sqlite3.Connection, entities: list[dict[str, Any]] | None = None, ovr: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    """{"panels": [panel view + zones + unpaired], "excluded": [...]} for every panel in the mirror. Callers narrow the
    panel list to the caller's scope (routers/alarm.py)."""
    ents = entities if entities is not None else load(conn)
    ovr = ovr if ovr is not None else overrides(conn)
    by_id = {e["entity_id"]: e for e in ents}
    panels = [e for e in ents if e["domain"] == "alarm_control_panel"]
    groups: dict[tuple[str, str | None], _Group] = {}
    for p in panels:
        k = _group_key(p)
        groups.setdefault(k, _Group(platform=k[0], config_entry_id=k[1])).panels.append(p)
    excluded = {z for z, o in ovr.items() if o.get("excluded")}
    manual_ctl = {z: o["bypass_entity_id"] for z, o in ovr.items() if o.get("bypass_entity_id") is not None}
    manual_panel = {z: o["panel_entity_id"] for z, o in ovr.items() if o.get("panel_entity_id")}
    manually_paired_ctl = {c for c in manual_ctl.values() if c}
    for g in groups.values():
        for e in ents:
            if e["domain"] == "alarm_control_panel" or not _belongs(e, g):
                continue
            if e["domain"] == "binary_sensor" and (e.get("entity_category") or "") not in ("diagnostic", "config"):
                g.sensors.append(e)
            elif e["domain"] in ("switch", "select") and is_bypass_control(e):
                g.controls.append(e)
    out: list[dict[str, Any]] = []
    for g in groups.values():
        sensors = [s for s in g.sensors if s["entity_id"] not in excluded]
        # sensors of any integration an administrator assigned to one of this group's panels (Alarmo, a mixed system)
        mine = {p["entity_id"] for p in g.panels}
        extra = [by_id[z] for z, pid in manual_panel.items() if pid in mine and z in by_id and z not in {s["entity_id"] for s in sensors} and z not in excluded]
        # Alarmo names the sensors it watches while they are open / bypassed: they are this panel's zones too
        for p in g.panels:
            a = p.get("attributes") or {}
            named = list((a.get("open_sensors") or {}).keys()) if isinstance(a.get("open_sensors"), dict) else []
            named += [s for s in (a.get("bypassed_sensors") or []) if isinstance(s, str)] if isinstance(a.get("bypassed_sensors"), list) else []
            for z in named:
                if z in by_id and by_id[z]["domain"] == "binary_sensor" and z not in excluded and z not in {s["entity_id"] for s in sensors + extra}:
                    extra.append(by_id[z])
                    manual_panel.setdefault(z, p["entity_id"])
        zones, attached = _attach_aux(sensors)
        zones += extra
        controls = [c for c in g.controls if c["entity_id"] not in manually_paired_ctl]
        auto_zones = [z for z in zones if z["entity_id"] not in manual_ctl]
        pairs = _pair(auto_zones, controls, g.platform)
        for z, cid in manual_ctl.items():
            if cid and cid in by_id:
                pairs[z] = (by_id[cid], "override")
        paired = {c["entity_id"] for c, _ in pairs.values()}
        unpaired = [c for c in controls if c["entity_id"] not in paired]
        for p in g.panels:
            pv = _panel_view(p)
            bypassed_by_panel = set(pv["bypassed_sensors"])
            zlist = []
            for z in zones:
                owner = manual_panel.get(z["entity_id"])
                if owner and owner != p["entity_id"]:
                    continue
                shared = len(g.panels) > 1 and not owner
                zv = _zone_view(z, attached.get(z["entity_id"], []), None if manual_ctl.get(z["entity_id"]) == "" else pairs.get(z["entity_id"]),
                                shared=shared, bypassed_by_panel=bypassed_by_panel, override=z["entity_id"] in manual_ctl)
                # security review M4: every panel that lists this zone (all partitions of the system while it is shared) -
                # viewing its state and bypassing it need the permission on each of them (routers/alarm.py)
                zv["panels"] = [x["entity_id"] for x in g.panels] if shared else [p["entity_id"]]
                zlist.append(zv)
            zlist.sort(key=lambda v: ((v["area_name"] or "￿"), v["zone_number"] if v["zone_number"] is not None else 1 << 30, v["name"]))
            pv["zones"] = zlist
            pv["unpaired_controls"] = [{"entity_id": c["entity_id"], "domain": c["domain"], "name": c.get("name") or c.get("original_name") or (c.get("attributes") or {}).get("friendly_name") or c["entity_id"],
                                        "state": c.get("state"), "bypassed": bypass_state(c)} for c in unpaired]
            pv["ready"] = readiness(zlist)
            out.append(pv)
    out.sort(key=lambda v: (v["name"] or "", v["entity_id"]))
    return {"panels": out, "excluded": sorted(excluded)}


# ---------------------------------------------------------------- controls the alarm owns (security review B1)

def managed_controls(conn: sqlite3.Connection, disc: dict[str, Any] | None = None) -> set[str]:
    """Every entity the alarm section owns and no other path may operate: each panel, each bypass control discover()
    pairs with a zone, each unpaired bypass-like control of a panel's integration, and each override target. The
    general entity route, the bulk actions and the bulk-safe mark refuse them (routers/ha.py, device_bulk.py): bypassing a
    zone or arming / disarming a panel goes through routers/alarm.py only - alarm.* permissions, the code policy, the
    lockout, the remote settings, the confirmation and the alarm.* audit rows."""
    ents = load(conn)
    d = disc if disc is not None else discover(conn, ents)
    out: set[str] = set()
    # re-review M-B, fail closed: every bypass-like switch / select of a panel's integration, whatever its config
    # entry - one without an entry (before the first registry refresh after the upgrade, a new entity, a failed registry
    # fetch) joins no group (L5) yet must never become operable from the other paths
    platforms = {e.get("platform") for e in ents if e["domain"] == "alarm_control_panel" and e.get("platform")}
    out.update(e["entity_id"] for e in ents if e["domain"] in ("switch", "select") and e.get("platform") in platforms and is_bypass_control(e))
    for p in d["panels"]:
        out.add(p["entity_id"])
        for z in p["zones"]:
            if z.get("bypass"):
                out.add(z["bypass"]["entity_id"])
        out.update(u["entity_id"] for u in p["unpaired_controls"])
    try:
        out.update(r[0] for r in conn.execute("SELECT bypass_entity_id FROM alarm_zone_overrides WHERE bypass_entity_id IS NOT NULL AND bypass_entity_id != ''").fetchall())
        out.update(r[0] for r in conn.execute("SELECT entity_id FROM ha_entities WHERE domain = 'alarm_control_panel'").fetchall())
    except sqlite3.OperationalError:
        pass
    return out


def is_managed_control(conn: sqlite3.Connection, entity_id: str) -> bool:
    if entity_id.split(".", 1)[0] not in ("switch", "select", "alarm_control_panel"):
        return False
    return entity_id in managed_controls(conn)


MANAGED_LABEL = "נשלט ממסך האזעקה"

def readiness(zones: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """What stands in the way of arming: open doors / windows and faulty zones that are not bypassed."""
    open_ = [z["entity_id"] for z in zones if z["open"] and z["kind"] in ("opening", "zone") and not z["bypassed"]]
    faults = [z["entity_id"] for z in zones if (z["fault"] or z.get("tamper")) and not z["bypassed"]]
    return {"ready": not open_ and not faults, "open": open_, "faults": faults}


def find_zone(disc: dict[str, Any], zone_entity_id: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """(panel view, zone view) of a zone - the first panel listing it (a shared zone has one control whichever panel)."""
    for p in disc["panels"]:
        for z in p["zones"]:
            if z["entity_id"] == zone_entity_id:
                return p, z
    return None


# ---------------------------------------------------------------- the code: never stored, never echoed

CODE_MAX = 32
_CODE_TEXT_RE = re.compile(r"^[^\x00-\x1f\x7f]{1,32}$")


def valid_code(code: Any, code_format: str | None) -> bool:
    if not isinstance(code, str):
        return False
    if code_format == "number":
        return code.isascii() and code.isdigit() and 1 <= len(code) <= CODE_MAX
    return bool(_CODE_TEXT_RE.match(code))


def scrub(text: Any, code: str | None) -> str:
    """`text` with every occurrence of the code replaced - for anything that might ever be shown or stored."""
    s = str(text or "")
    if code:
        s = s.replace(code, "•••")
    return s


def summary_counts(panels: list[dict[str, Any]]) -> dict[str, Any]:
    zones = [z for p in panels for z in p["zones"]]
    return {"panels": len(panels), "zones": len({z["entity_id"] for z in zones}), "open": len({z["entity_id"] for z in zones if z["open"]}),
            "bypassed": len({z["entity_id"] for z in zones if z["bypassed"]}), "faults": len({z["entity_id"] for z in zones if z["fault"]})}

