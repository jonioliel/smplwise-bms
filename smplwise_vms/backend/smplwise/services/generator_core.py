"""CR-031 GEN1: generator detection, the sensor-role mapping and the live values.

Everything here reads the mirror the existing infrastructure session keeps current (`ha_devices`, `ha_entities`, filled by
services/ha_sync.py and services/media_store.py): no second connection, no service call, nothing written to the infrastructure.
A generator is one registry DEVICE with its entities beneath it (owner decision 2026-10-05); detection is capability-driven: it finds
which of the catalogue's roles the device exposes, and only engine state plus one generator voltage are core.

Detection order (CR-031 section 5): (1) the integration domains listed in `generator.integration_domains` (a device with an entity of
such a platform), (2) the generic fallback (an engine-state entity and either a generator-like device name or three more roles),
(3) a manual pick. The mapping is corrected per installation through `generator.role_overrides`
(`{device_id: {role: entity_id | null}}`; null = "this role is not available")."""
from __future__ import annotations

import json
import logging
import re
import sqlite3
from typing import Any

from ..db import get_setting, new_id, now_iso, set_setting
from . import generator_catalog as cat

log = logging.getLogger("smplwise.generator")

DOMAINS = ("sensor", "binary_sensor", "select")
_CLEAN = re.compile(r"[_.]+")


# ---------------------------------------------------------------- settings

def jget(conn: sqlite3.Connection, key: str, default: Any) -> Any:
    raw = get_setting(conn, key)
    if raw is None:
        return default
    try:
        return json.loads(raw)
    except ValueError:
        return default


def jset(conn: sqlite3.Connection, key: str, value: Any) -> None:
    set_setting(conn, key, json.dumps(value, ensure_ascii=False))


def int_setting(conn: sqlite3.Connection, name: str) -> int:
    lo, hi, default = cat.RETENTION_LIMITS[name]
    try:
        v = int(jget(conn, f"generator.{name}", default))
    except (TypeError, ValueError):
        return default
    return min(max(v, lo), hi)


def integration_domains(conn: sqlite3.Connection) -> list[str]:
    v = jget(conn, "generator.integration_domains", [])
    mine = [str(x).strip().lower() for x in v if str(x).strip()] if isinstance(v, list) else []
    return list(dict.fromkeys([*cat.KNOWN_DOMAINS, *mine]))  # the known profiles always apply


def thresholds(conn: sqlite3.Connection, device_id: str | None = None) -> dict[str, float]:
    return thresholds_from(jget(conn, "generator.thresholds", {}), device_id)


def thresholds_from(stored: Any, device_id: str | None = None) -> dict[str, float]:
    out = dict(cat.DEFAULT_THRESHOLDS)
    if isinstance(stored, dict):
        for scope in ("default", device_id):
            part = stored.get(scope) if scope else None
            if isinstance(part, dict):
                for k, v in part.items():
                    if k in out and isinstance(v, (int, float)) and not isinstance(v, bool):
                        out[k] = float(v)
    return out


def overrides(conn: sqlite3.Connection, device_id: str) -> dict[str, str | None]:
    stored = jget(conn, "generator.role_overrides", {})
    part = stored.get(device_id) if isinstance(stored, dict) else None
    return {k: v for k, v in part.items() if k in cat.ROLES and (v is None or isinstance(v, str))} if isinstance(part, dict) else {}


# ---------------------------------------------------------------- classification

def _text(e: sqlite3.Row | dict[str, Any]) -> str:
    object_id = str(e["entity_id"]).split(".", 1)[-1]
    return _CLEAN.sub(" ", f"{e['name'] or ''} {e['original_name'] or ''} {object_id}").strip()


def classify(e: sqlite3.Row | dict[str, Any]) -> tuple[str, float, bool] | None:
    """(role, score, invert) of one entity, or None. Pure: name, device class and unit only."""
    domain = e["domain"]
    if domain not in DOMAINS:
        return None
    text = _text(e)
    dclass = (e["device_class"] or "").lower()
    unit = (e["unit"] or "").strip().lower()
    for rule in cat.RULES:
        if domain not in rule.domains:
            continue
        if rule.rx is not None and not rule.rx.search(text):
            continue
        if rule.deny is not None and rule.deny.search(text):
            continue
        if rule.classes and dclass not in rule.classes:
            continue
        if rule.units and unit not in rule.units:
            continue
        return rule.role, rule.score, bool((rule.invert and rule.invert.search(text)) or (rule.role == "mains_available" and dclass == "problem"))
    if domain != "sensor" or cat.LINE_TO_LINE.search(text):
        return None
    mains = bool(cat.MAINS_RX.search(text))
    ph = cat.phase_of(text)
    if unit == "v" or dclass == "voltage":
        return (f"{'mains' if mains else 'gen'}_v_l{ph or 1}", 1.0 if ph else 0.6, False)
    if (unit == "a" or dclass == "current") and not mains:
        return (f"gen_a_l{ph or 1}", 1.0 if ph else 0.6, False)
    if unit == "hz" or dclass == "frequency":
        return ("mains_hz" if mains else "gen_hz", 1.0, False)
    if unit in ("kva", "va") or dclass == "apparent_power":
        return ("gen_kva", 1.0, False) if not mains and ph is None else None
    if dclass == "power_factor" or re.search(r"power factor|\bpf\b|cos|מקדם הספק", text, re.I):
        return ("pf", 1.0, False)
    if unit == "%" and re.search(r"load|עומס", text, re.I):
        return ("load_pct", 1.0, False)
    if (unit in ("kw", "w", "mw") or dclass == "power") and not mains and ph is None:
        return ("gen_kw", 1.0, False)
    return None


def map_roles(entities: list[sqlite3.Row | dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """role -> {entity_id, unit, invert, confidence}: the best entity per role; unphased voltages / currents fill the free phases in order."""
    best: dict[str, tuple[float, str, Any, bool]] = {}
    unphased: dict[str, list[tuple[str, Any]]] = {}
    for e in sorted(entities, key=lambda x: x["entity_id"]):
        got = classify(e)
        if got is None:
            continue
        role, score, inv = got
        if score < 1.0 and re.fullmatch(r"(gen|mains)_[va]_l1", role):
            unphased.setdefault(role.rsplit("_", 1)[0], []).append((e["entity_id"], e))
            continue
        if role not in best or score > best[role][0]:
            best[role] = (score, e["entity_id"], e, inv)
    for family, items in unphased.items():  # e.g. gen_v: [e1, e2, e3] with no phase word -> L1, L2, L3 (those not already taken)
        free = [n for n in (1, 2, 3) if f"{family}_l{n}" not in best]
        for (eid, e), n in zip(items, free):
            best[f"{family}_l{n}"] = (0.6, eid, e, False)
    return {r: {"entity_id": eid, "unit": e["unit"], "invert": inv, "confidence": round(min(score / 3, 1.0), 2)} for r, (score, eid, e, inv) in best.items()}


# ---------------------------------------------------------------- detection

_ENTITY_COLS = "entity_id, name, original_name, platform, domain, device_class, unit, device_id, area_id, state, available"


def _device_entities(conn: sqlite3.Connection, *, disabled: bool = False) -> dict[str, list[sqlite3.Row]]:
    """The device's entities that EXIST for Arx: enabled, and - when the device answers at all - currently available. A disabled entity
    or one that reports unavailable while its siblings answer is "sensor absent" (that capability is off). `disabled=True` returns the
    disabled ones instead (the "exists but is disabled" hint of the mapping screen)."""
    out: dict[str, list[sqlite3.Row]] = {}
    rows = conn.execute(f"SELECT {_ENTITY_COLS} FROM ha_entities WHERE removed_at IS NULL AND disabled = ? AND device_id IS NOT NULL", (1 if disabled else 0,)).fetchall()
    for r in rows:
        out.setdefault(r["device_id"], []).append(r)
    if not disabled:
        for dev, ents in out.items():
            alive = [e for e in ents if str(e["state"]).strip().lower() not in cat.DEAD]
            if alive:
                out[dev] = alive
    return out


def _device_name(d: sqlite3.Row) -> str:
    return (d["name_by_user"] or d["name"] or "").strip()


def _apply_overrides(conn: sqlite3.Connection, device_id: str, auto: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out = {r: {**v, "mapped_by": "auto"} for r, v in auto.items()}
    for role, eid in overrides(conn, device_id).items():
        if eid is None:
            out.pop(role, None)
            continue
        ent = conn.execute("SELECT entity_id, unit FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (eid,)).fetchone()
        if ent is not None:
            keep_invert = bool(out.get(role, {}).get("invert"))
            out[role] = {"entity_id": eid, "unit": ent["unit"], "invert": keep_invert, "confidence": 1.0, "mapped_by": "manual"}
    return out


def _write_roles(conn: sqlite3.Connection, device_id: str, roles: dict[str, dict[str, Any]]) -> None:
    conn.execute("DELETE FROM generator_roles WHERE device_id = ?", (device_id,))
    for role, m in roles.items():
        conn.execute("INSERT INTO generator_roles(device_id, role, entity_ref, unit, invert, mapped_by, confidence, core) VALUES (?,?,?,?,?,?,?,?)",
                     (device_id, role, m["entity_id"], m.get("unit"), int(bool(m.get("invert"))), m.get("mapped_by", "auto"), m.get("confidence", 1.0), int(cat.is_core(role))))
    for t in cat.ALERT_TYPES:
        alarm = next((roles[r]["entity_id"] for r in t.needs if r.startswith("alarm_") and r in roles), None)
        conn.execute(
            """INSERT INTO generator_alert_types(device_id, key, grp, title_he, title_en, entity_ref, builtin, needs_json) VALUES (?,?,?,?,?,?,1,?)
               ON CONFLICT(device_id, key) DO UPDATE SET grp = excluded.grp, title_he = excluded.title_he, title_en = excluded.title_en, entity_ref = excluded.entity_ref, needs_json = excluded.needs_json""",
            (device_id, t.key, t.group, t.title_he, t.title_en, alarm, json.dumps(list(t.needs))),
        )


def remap(conn: sqlite3.Connection, device_id: str) -> dict[str, dict[str, Any]]:
    """Re-run the role mapping of ONE known device (after a mapping correction) and store it."""
    dev = conn.execute("SELECT source_device_ref FROM generator_devices WHERE id = ?", (device_id,)).fetchone()
    if dev is None:
        return {}
    ents = _device_entities(conn).get(dev["source_device_ref"], [])
    roles = _apply_overrides(conn, device_id, map_roles(ents))
    _write_roles(conn, device_id, roles)
    status = "detected" if cat.is_core_met(set(roles)) else "partial"
    conn.execute("UPDATE generator_devices SET status = ?, revision = revision + 1 WHERE id = ? AND status <> 'removed'", (status, device_id))
    return roles


def detect(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Run the three-step detection over the registry mirror and store the result. Returns one summary row per generator."""
    now = now_iso()
    domains = set(integration_domains(conn))
    by_device = _device_entities(conn)
    devices = {d["device_id"]: d for d in conn.execute("SELECT * FROM ha_devices WHERE removed_at IS NULL").fetchall()}
    known = {r["source_device_ref"]: r for r in conn.execute("SELECT * FROM generator_devices WHERE status <> 'removed'").fetchall()}
    found: dict[str, tuple[str, str | None, dict[str, dict[str, Any]]]] = {}
    for dev_id, dev in devices.items():
        ents = by_device.get(dev_id, [])
        if not ents:
            continue
        old = known.get(dev_id)
        hint = bool(cat.GENERATOR_HINT.search(f"{_device_name(dev)} {dev['manufacturer'] or ''} {dev['model'] or ''}"))
        platform = next((e["platform"] for e in ents if (e["platform"] or "").lower() in domains), None)
        if old is None and not hint and not platform and len(ents) < 4:
            continue  # too small to be a controller: not even classified (a registry with thousands of devices stays one cheap pass)
        auto = map_roles(ents)
        if platform:
            kind, domain = "integration", platform
        elif "engine_state" in auto and (hint or len(auto) >= 4):
            kind, domain = "generic", None
        elif old is not None and old["source_kind"] == "manual":
            kind, domain = "manual", None
        else:
            continue
        if old is not None and old["source_kind"] == "manual":
            kind = "manual"
        found[dev_id] = (kind, domain, auto)
    out: list[dict[str, Any]] = []
    for dev_id, (kind, domain, auto) in found.items():
        old = known.get(dev_id)
        gid = old["id"] if old is not None else new_id()
        roles = _apply_overrides(conn, gid, auto)
        status = "detected" if cat.is_core_met(set(roles)) else "partial"
        if old is None:
            area = next((e["area_id"] for e in by_device[dev_id] if e["area_id"]), None) or devices[dev_id]["area_id"]
            conn.execute(
                "INSERT INTO generator_devices(id, name, area_id, source_kind, source_domain, source_device_ref, status, detected_at, last_seen_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (gid, _device_name(devices[dev_id]) or "גנרטור", area, kind, domain, dev_id, status, now, now))
        else:
            conn.execute("UPDATE generator_devices SET source_kind = ?, source_domain = ?, status = ?, last_seen_at = ?, revision = revision + (status <> ?) WHERE id = ?",
                         (kind, domain, status, now, status, gid))
        _write_roles(conn, gid, roles)
        out.append({"id": gid, "kind": kind, "status": status, "roles": len(roles)})
    for dev_id, old in known.items():  # a generator whose device vanished or no longer matches
        if dev_id not in found:
            conn.execute("UPDATE generator_devices SET status = 'removed', revision = revision + 1 WHERE id = ?", (old["id"],))
    conn.execute("INSERT INTO settings(key, value) VALUES('generator.last_detect_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (now,))
    return out


def add_manual(conn: sqlite3.Connection, ha_device_id: str, name: str | None) -> str | None:
    """The manual pick: register any registry device as a generator. Returns the generator id (an existing one when already registered)."""
    dev = conn.execute("SELECT * FROM ha_devices WHERE device_id = ? AND removed_at IS NULL", (ha_device_id,)).fetchone()
    if dev is None:
        return None
    old = conn.execute("SELECT id FROM generator_devices WHERE source_device_ref = ? AND status <> 'removed'", (ha_device_id,)).fetchone()
    if old is not None:
        return old["id"]
    gid = new_id()
    now = now_iso()
    area = next((e["area_id"] for e in _device_entities(conn).get(ha_device_id, []) if e["area_id"]), None) or dev["area_id"]
    conn.execute("INSERT INTO generator_devices(id, name, area_id, source_kind, source_device_ref, status, detected_at, last_seen_at) VALUES (?,?,?,?,?,'partial',?,?)",
                 (gid, (name or _device_name(dev) or "גנרטור")[:80], area, "manual", ha_device_id, now, now))
    remap(conn, gid)
    return gid


# ---------------------------------------------------------------- live values

def read_values_bulk(conn: sqlite3.Connection, device_ids: list[str] | None = None) -> dict[str, dict[str, dict[str, Any]]]:
    """device id -> role -> {value, unit, available, updated_at}: ONE joined query for all generators (or the given ones), normalised to the
    role's canonical unit."""
    out: dict[str, dict[str, dict[str, Any]]] = {}
    sql = """SELECT g.device_id, g.role, g.invert, e.state, e.unit AS e_unit, e.available, e.removed_at, e.last_updated, e.state_seen_at
             FROM generator_roles g LEFT JOIN ha_entities e ON e.entity_id = g.entity_ref"""
    if device_ids is not None:
        if not device_ids:
            return out
        sql += f" WHERE g.device_id IN ({','.join('?' * len(device_ids))})"
    else:
        sql += " WHERE g.device_id IN (SELECT id FROM generator_devices WHERE status <> 'removed')"
    for r in conn.execute(sql, device_ids or ()).fetchall():
        role = r["role"]
        kind, unit, _label = cat.ROLES[role]
        raw = r["state"] if r["removed_at"] is None else None
        alive = r["e_unit"] is not None or raw is not None
        value: Any = None
        if raw is not None and str(raw).strip().lower() not in cat.DEAD:
            if kind == "num":
                try:
                    value = round(cat.to_canonical(role, float(raw), r["e_unit"]), 3)
                except ValueError:
                    value = None
            elif kind == "enum":
                value = cat.norm_enum(role, raw)
            elif kind == "bool":
                value = cat.norm_bool(raw, bool(r["invert"]))
            else:
                value = str(raw)[:80]
        item: dict[str, Any] = {"value": value, "unit": unit, "available": value is not None and bool(alive), "updated_at": r["last_updated"] or r["state_seen_at"]}
        if kind == "enum":
            item["raw"] = str(raw)[:60] if raw is not None and str(raw).strip().lower() not in cat.DEAD else None
        out.setdefault(r["device_id"], {})[role] = item
    return out


def read_values(conn: sqlite3.Connection, device_id: str) -> dict[str, dict[str, Any]]:
    """role -> {value, unit, available, updated_at} of ONE generator (see read_values_bulk)."""
    return read_values_bulk(conn, [device_id]).get(device_id, {})


def availability(values: dict[str, dict[str, Any]], mirror_connected: bool) -> str:
    """online | offline | stale. offline: every core role is unavailable; stale: the mirror itself is not connected (the values are old)."""
    core = [v for k, v in values.items() if cat.is_core(k)]
    if not core or not any(v["available"] for v in core):
        return "offline"
    return "online" if mirror_connected else "stale"


def roles_of(conn: sqlite3.Connection, device_id: str) -> set[str]:
    return {r[0] for r in conn.execute("SELECT role FROM generator_roles WHERE device_id = ?", (device_id,)).fetchall()}


def disabled_roles(conn: sqlite3.Connection, device_id: str) -> list[str]:
    """Roles that are NOT mapped but whose entity exists disabled in the registry (hint: "this sensor exists but is disabled")."""
    dev = conn.execute("SELECT source_device_ref FROM generator_devices WHERE id = ?", (device_id,)).fetchone()
    if dev is None:
        return []
    have = roles_of(conn, device_id)
    got = {c[0] for e in _device_entities(conn, disabled=True).get(dev["source_device_ref"], []) if (c := classify(e))}
    return sorted(r for r in got if r not in have and not r.startswith("alarm_"))


def candidates(conn: sqlite3.Connection, device_id: str) -> dict[str, list[dict[str, Any]]]:
    """For the mapping screen: per role the entities of the generator's device that could serve it (best guess first)."""
    dev = conn.execute("SELECT source_device_ref FROM generator_devices WHERE id = ?", (device_id,)).fetchone()
    if dev is None:
        return {}
    ents = _device_entities(conn).get(dev["source_device_ref"], [])
    out: dict[str, list[dict[str, Any]]] = {}
    for e in ents:
        got = classify(e)
        if got:
            out.setdefault(got[0], []).append({"entity_id": e["entity_id"], "name": (e["name"] or e["original_name"] or e["entity_id"]), "unit": e["unit"], "score": got[1]})
    for lst in out.values():
        lst.sort(key=lambda x: (-x["score"], x["entity_id"]))
    return out
