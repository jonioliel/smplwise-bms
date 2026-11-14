"""HA 2026.10 compatibility scan (docs/operations/HA_2026_10_COMPATIBILITY_HE.md, plan row 4): a READ-ONLY pass over the automations
and scripts the add-on already mirrors (`ha_config_items`, filled by the automations sync). Nothing here talks to Home Assistant and
nothing is written anywhere.

Two kinds of finding:
- `state_for_attribute` / `state_for_list` / `state_for_input_helper`: a state condition (anywhere: the conditions, a condition
  step, inside and / or / not, choose, if, repeat) that sets `for` together with an attribute, a list of states other than a
  one-item list, or a state that names an input helper. HA 2026.10 (core#174083) fails the item's configuration check, so the
  automation becomes unavailable after the upgrade. Several entities with `for` stay valid and are not reported.
- `admin_only_service`: a step that calls `mqtt.publish`, `mqtt.dump` (core#182045), `synology_dsm.reboot` or
  `synology_dsm.shutdown` (core#182050). A manual run by a user who is not an HA administrator (a dashboard button, "run now",
  a device action that starts a script) fails with Unauthorized; runs started by a trigger are not affected. A templated
  service name cannot be judged and is not reported.

The answer carries names, kinds and paths only, never a configuration value (the mirror may hold masked secrets)."""
from __future__ import annotations

import json
import re
import sqlite3
from collections.abc import Iterator
from typing import Any

# HA's own pattern for a state that names an input helper (homeassistant/helpers/config_validation.py, core#174083); the same as
# automation_model._INPUT_ENTITY_ID, kept here so the scan does not depend on the builder's internals
INPUT_HELPER_STATE = re.compile(r"^input_(?:select|text|number|boolean|datetime)\.(?!.+__)(?!_)[\da-z_]+(?<!_)$")
ADMIN_ONLY_SERVICES = frozenset({"mqtt.publish", "mqtt.dump", "synology_dsm.reboot", "synology_dsm.shutdown"})
STATE_FOR_CODES = ("state_for_attribute", "state_for_list", "state_for_input_helper")
CODES = (*STATE_FOR_CODES, "admin_only_service")
MAX_ITEMS = 500  # a bound on the answer; the counts are always complete
_MAX_DEPTH = 40


def state_for_issue(c: Any) -> str | None:
    """The 2026.10 refusal code of one raw condition dict, or None."""
    if not isinstance(c, dict) or c.get("condition") != "state" or c.get("for") in (None, "", {}):
        return None
    if "attribute" in c:
        return "state_for_attribute"
    state = c.get("state")
    if isinstance(state, list):
        if len(state) != 1:
            return "state_for_list"
        state = state[0]
    if isinstance(state, str) and INPUT_HELPER_STATE.match(state.strip()):
        return "state_for_input_helper"
    return None


def _walk(node: Any, path: str, depth: int = 0) -> Iterator[tuple[str, dict[str, Any]]]:
    """Every dict inside a configuration with its path (`actions[0].choose[1].conditions[0]`)."""
    if depth > _MAX_DEPTH:
        return
    if isinstance(node, dict):
        yield path, node
        for k, v in node.items():
            if isinstance(v, (dict, list)):
                yield from _walk(v, f"{path}.{k}" if path else str(k), depth + 1)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _walk(v, f"{path}[{i}]", depth + 1)


def _service_of(d: dict[str, Any]) -> str | None:
    for key in ("action", "service"):
        v = d.get(key)
        if isinstance(v, str) and "{" not in v:
            return v.strip().lower()
    return None


def scan_config(kind: str, cfg: dict[str, Any]) -> list[dict[str, Any]]:
    """The findings of one automation / script configuration: [{code, path, service?}], in document order. Triggers are not
    conditions: a dict with `trigger:` / `platform:` is never a state condition, so walking the whole item is safe."""
    out: list[dict[str, Any]] = []
    for path, d in _walk(cfg, ""):
        code = state_for_issue(d)
        if code:
            out.append({"code": code, "path": path})
        svc = _service_of(d)
        if svc in ADMIN_ONLY_SERVICES and "trigger" not in d and "platform" not in d:
            out.append({"code": "admin_only_service", "path": path, "service": svc})
    return out


def _name(cfg: dict[str, Any], row: sqlite3.Row) -> str:
    alias = cfg.get("alias")
    if isinstance(alias, str) and alias.strip():
        return alias.strip()[:120]
    return str(row["entity_id"] or row["item_id"])[:120]


def scan(conn: sqlite3.Connection) -> dict[str, Any]:
    """The whole mirror. `items` lists each automation / script with at least one finding (automations first, then scripts, by
    name); `counts` per code; `scanned` = how many items had a readable configuration; `mirror_seen_at` = the newest sync stamp."""
    counts = {code: 0 for code in CODES}
    items: list[dict[str, Any]] = []
    scanned = 0
    last_seen: str | None = None
    for row in conn.execute("SELECT kind, item_id, entity_id, source, config_json, seen_at FROM ha_config_items "
                            "WHERE kind IN ('automation', 'script') ORDER BY kind, item_id").fetchall():
        if row["seen_at"] and (last_seen is None or row["seen_at"] > last_seen):
            last_seen = row["seen_at"]
        try:
            cfg = json.loads(row["config_json"]) if row["config_json"] else None
        except ValueError:
            cfg = None
        if not isinstance(cfg, dict):
            continue
        scanned += 1
        issues = scan_config(row["kind"], cfg)
        if not issues:
            continue
        for i in issues:
            counts[i["code"]] += 1
        items.append({"kind": row["kind"], "id": row["item_id"], "entity_id": row["entity_id"], "name": _name(cfg, row),
                      "source": row["source"], "issues": issues[:20]})
    items.sort(key=lambda x: (x["kind"], x["name"]))
    return {"scanned": scanned, "mirror_seen_at": last_seen, "counts": counts, "items": items[:MAX_ITEMS],
            "truncated": len(items) > MAX_ITEMS}
