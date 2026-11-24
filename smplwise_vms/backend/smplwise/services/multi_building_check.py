"""MULTI-BUILDING-SAFETY-2500 (owner decision 22.11, Q63 = the recommendation): the check before the multi-building switch is turned on.

Turning the switch on makes the home mapping authority at once (round 14: a building binding also reaches the devices whose area the
mapping puts in its building, `security.building_reach` = map_and_mapping, the default), and rows prepared while the switch was off
were never guarded by the RemapGuard (BUILDING-SCOPE-CONTROL-2351, "Open for the owner (1)"). So the switch is turned on only after this
report was shown: `PUT /home/multi-building {enabled: true, check_digest}` re-computes it and refuses a missing digest (409
`check_required`), a different one (409 `check_stale`) and any blocking finding (409 `check_blocked`). The installation setting
`home.multi_building.review` = `required` (default) / `skip` lets an administrator of roles skip the check; a skipped check is still
computed and its counts are written to the audit row.

Findings (`severity`):
- blocking `entity_cross_building` - a device placed on the maps of one building whose area the mapping puts in ANOTHER building: with the
  mapping counting for reach, that other building's holders would control a device that physically sits elsewhere. Under "מיקום במפה"
  (`map`) the mapping grants nothing, so it is a warning there.
- warning `reach_gain` - per building: the devices its building / site holders gain through the mapping (not placed on its maps), the
  sensitive ones among them (locks, alarm panels, sirens, door / gate covers) and who holds a binding there. Info under `map`.
- warning `single_building` (fewer than two live buildings: the home screen does not change, but the mapping still becomes reach),
  `mapping_empty` (no area resolves to a building), `unmapped_areas` (areas with devices that resolve to no building).
- info `versions_since` (mapping versions applied since the switch was last turned on, with who and when), `stale_rows` (rows naming a
  deleted floor / building - they count for nothing).

Read-only: nothing here writes, and nothing reads or writes the home system.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

REVIEW_KEY = "home.multi_building.review"
REVIEW_CHOICES: tuple[str, ...] = ("required", "skip")
REVIEW_DEFAULT = "required"
LAST_ON_KEY = "home.multi_building.last_on"  # JSON {at, by, versions: {site id: the newest mapping version then}}
SENSITIVE_DOMAINS = frozenset({"lock", "alarm_control_panel", "siren"})
ITEMS_MAX = 20


def review_mode(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (REVIEW_KEY,)).fetchone()
    value = row[0] if row else None
    return value if value in REVIEW_CHOICES else REVIEW_DEFAULT


def _last_on(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (LAST_ON_KEY,)).fetchone()
    try:
        o = json.loads(row[0]) if row and row[0] else {}
    except ValueError:
        o = {}
    return o if isinstance(o, dict) else {}


def current_versions(conn: sqlite3.Connection) -> dict[str, int]:
    """site id -> its newest mapping version (0 = none yet), for every live site."""
    out: dict[str, int] = {}
    for (sid,) in conn.execute("SELECT id FROM sites WHERE deleted_at IS NULL ORDER BY id").fetchall():
        try:
            row = conn.execute("SELECT MAX(number) FROM home_mapping_versions WHERE site_id = ?", (sid,)).fetchone()
        except sqlite3.OperationalError:
            row = None
        out[sid] = int(row[0]) if row and row[0] is not None else 0
    return out


def remember_on(conn: sqlite3.Connection, at: str, by: str) -> None:
    """Called when the switch is turned on: the next check lists the versions applied after this moment."""
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (LAST_ON_KEY, json.dumps({"at": at, "by": by, "versions": current_versions(conn)}, separators=(",", ":"))))


def _finding(code: str, severity: str, count: int, items: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {"code": code, "severity": severity, "count": count, "items": (items or [])[:ITEMS_MAX]}


def _holders(conn: sqlite3.Connection, building_id: str, site_id: str) -> list[dict[str, str]]:
    """Who holds an allow binding on the building or its site (users, and groups as one entry each) - the people the mapping reach of
    round 14 widens. Installation-wide holders reach everything anyway and are not listed."""
    rows = conn.execute(
        """SELECT DISTINCT b.subject_kind, b.subject_id, COALESCE(NULLIF(u.display_name, ''), NULLIF(u.username, ''), g.name, b.subject_id) AS name
           FROM bindings b LEFT JOIN users u ON b.subject_kind = 'user' AND u.id = b.subject_id
           LEFT JOIN groups g ON b.subject_kind = 'group' AND g.id = b.subject_id
           WHERE b.revoked_at IS NULL AND b.effect = 'allow' AND ((b.scope_type = 'building' AND b.scope_id = ?) OR (b.scope_type = 'site' AND b.scope_id = ?))
           ORDER BY name""",
        (building_id, site_id),
    ).fetchall()
    return [{"kind": r[0], "id": r[1], "name": r[2]} for r in rows]


def report(conn: sqlite3.Connection) -> dict[str, Any]:
    """The check, worked out from the stored rows (the same resolution as the building cut and the round-14 reach)."""
    from . import building_scope, ha_scope
    from . import devices as dsvc

    reach = building_scope.reach_mode(conn)
    counts_for_reach = reach == "map_and_mapping"
    buildings = {r[0]: {"id": r[0], "name": r[1], "site_id": r[2]} for r in conn.execute(
        "SELECT b.id, b.name, b.site_id FROM buildings b JOIN sites s ON s.id = b.site_id WHERE b.deleted_at IS NULL AND s.deleted_at IS NULL "
        "ORDER BY b.sort_order, b.name").fetchall()}
    floor_building = {r[0]: r[1] for r in conn.execute(
        "SELECT f.id, f.building_id FROM floors f JOIN buildings b ON b.id = f.building_id WHERE f.deleted_at IS NULL AND b.deleted_at IS NULL").fetchall()}
    areas, ents = building_scope._light(conn)  # noqa: SLF001 - the same light rows the permission check resolves from
    by_area = building_scope.area_targets(conn, areas)
    area_names = {r[0]: r[1] for r in conn.execute("SELECT area_id, name FROM ha_areas").fetchall()}
    ent_rows = {r[0]: r for r in conn.execute("SELECT entity_id, name, domain, device_class FROM ha_entities").fetchall()}
    placed: dict[str, set[str]] = {}
    for eid, ps in ha_scope.own_placements(conn).items():
        bs = {floor_building[p["floor_id"]] for p in ps if p["floor_id"] in floor_building}
        if bs:
            placed[eid] = bs

    def ename(eid: str) -> str:
        r = ent_rows.get(eid)
        return (r["name"] if r and r["name"] else eid) if r else eid

    def sensitive(eid: str) -> bool:
        r = ent_rows.get(eid)
        domain = eid.split(".", 1)[0]
        return domain in SENSITIVE_DOMAINS or (domain == "cover" and bool(r) and (r["device_class"] or "") in dsvc.DOOR_COVER_CLASSES)

    findings: list[dict[str, Any]] = []
    cross: list[dict[str, Any]] = []
    gain: dict[str, list[str]] = {}
    with_devices: dict[str, int] = {}
    for r in ents:
        eid, aid = r[0], r[1]
        with_devices[aid] = with_devices.get(aid, 0) + 1
        t = by_area.get(aid)
        if t is None or t[0] not in buildings:
            continue
        b = t[0]
        where = placed.get(eid)
        if where and b not in where:
            others = sorted(buildings[x]["name"] for x in where if x in buildings)
            cross.append({"id": eid, "name": ename(eid), "building": buildings[b]["name"], "placed_in": ", ".join(others), "area": area_names.get(aid, aid)})
        if not where or b not in where:
            gain.setdefault(b, []).append(eid)
    if cross:
        findings.append(_finding("entity_cross_building", "blocking" if counts_for_reach else "warning", len(cross), cross))
    if gain:
        rows = []
        for bid in buildings:
            got = gain.get(bid)
            if not got:
                continue
            holders = _holders(conn, bid, buildings[bid]["site_id"])
            rows.append({"id": bid, "name": buildings[bid]["name"], "devices": len(got), "sensitive": sum(1 for e in got if sensitive(e)),
                         "holders": len(holders), "holder_names": [h["name"] for h in holders][:ITEMS_MAX],
                         "sensitive_names": sorted(ename(e) for e in got if sensitive(e))[:ITEMS_MAX]})
        findings.append(_finding("reach_gain", "warning" if counts_for_reach else "info", sum(r["devices"] for r in rows), rows))
    if len(buildings) < 2:
        findings.append(_finding("single_building", "warning", len(buildings), [{"id": b["id"], "name": b["name"]} for b in buildings.values()]))
    if not any(t[0] in buildings for t in by_area.values()):
        findings.append(_finding("mapping_empty", "warning", 0))
    unmapped = sorted((a for a in with_devices if a not in by_area), key=lambda a: area_names.get(a, a))
    if unmapped and by_area:
        findings.append(_finding("unmapped_areas", "warning", len(unmapped),
                                 [{"id": a, "name": area_names.get(a, a), "devices": with_devices[a]} for a in unmapped]))
    last = _last_on(conn)
    seen = last.get("versions") if isinstance(last.get("versions"), dict) else {}
    since: list[dict[str, Any]] = []
    try:
        vrows = conn.execute(
            "SELECT v.site_id, v.number, v.kind, v.created_at, COALESCE(NULLIF(u.display_name, ''), u.username, v.created_by, '') "
            "FROM home_mapping_versions v LEFT JOIN users u ON u.id = v.created_by ORDER BY v.created_at DESC, v.number DESC").fetchall()
    except sqlite3.OperationalError:
        vrows = []
    for r in vrows:
        if int(r[1]) > int(seen.get(r[0], 0) or 0):
            since.append({"site_id": r[0], "number": int(r[1]), "kind": r[2], "created_at": r[3], "by": r[4] or ""})
    if since:
        findings.append(_finding("versions_since", "info", len(since), since))
    stale = _stale_rows(conn, set(floor_building), set(buildings))
    if stale:
        findings.append(_finding("stale_rows", "info", stale))
    blocking = sum(1 for f in findings if f["severity"] == "blocking")
    warnings = sum(1 for f in findings if f["severity"] == "warning")
    core = {"reach": reach, "findings": [(f["code"], f["severity"], f["count"], json.dumps(f["items"], sort_keys=True, ensure_ascii=False)) for f in findings],
            "versions": current_versions(conn)}
    digest = hashlib.sha256(json.dumps(core, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:32]
    return {
        "digest": digest,
        "reach_mode": reach,
        "review_mode": review_mode(conn),
        "buildings": len(buildings),
        "blocking": blocking,
        "warnings": warnings,
        "last_on": last.get("at") if isinstance(last.get("at"), str) else None,
        "findings": findings,
    }


def _stale_rows(conn: sqlite3.Connection, floors: set[str], buildings: set[str]) -> int:
    n = 0
    for sql, live in (("SELECT floor_id FROM home_floor_links", floors), ("SELECT floor_id FROM home_area_links WHERE floor_id IS NOT NULL", floors),
                      ("SELECT building_id FROM home_area_buildings", buildings)):
        try:
            n += sum(1 for (x,) in conn.execute(sql).fetchall() if x not in live)
        except sqlite3.OperationalError:
            pass
    return n


def summary(rep: dict[str, Any]) -> dict[str, Any]:
    """The few numbers the audit row keeps."""
    by = {f["code"]: f["count"] for f in rep["findings"]}
    return {"digest": rep["digest"], "blocking": rep["blocking"], "warnings": rep["warnings"], "reach_mode": rep["reach_mode"],
            "reach_gain": by.get("reach_gain", 0), "cross_building": by.get("entity_cross_building", 0), "versions_since": by.get("versions_since", 0)}
