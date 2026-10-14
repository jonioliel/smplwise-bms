"""CR-038 slice 6b (D24): the table's saved filters / layouts (`ticket_saved_views`, migration 0079) - private to their owner, at most
MAX_PER_USER each. A view is a name and a document validated against the SAME whitelists as the list API (services/tickets/table.py):

    {"view": "cards" | "table" | "kanban", "filters": {...}, "sort": "key:dir[,key:dir]", "columns": [...], "density": "comfortable" | "compact"}

A view stores what the table shows, never a permission: applying it to a list still runs every row through access.visible(). Which
view is the user's default lives in the per-user preference `tickets.board` (`default_view`, services/tickets/table_prefs.py)."""
from __future__ import annotations

import json
from typing import Any

from . import model, table

MAX_PER_USER = 20
NAME_MAX = 60
VIEW_KEYS = ("view", "filters", "sort", "columns", "density")


def clean_name(raw: Any) -> str:
    """1-60 characters after the text hygiene of section 16 (Cc / Cf stripped, whitespace folded)."""
    return model.text_field(raw, "name", required=True, max_len=NAME_MAX)


def normalize(raw: Any) -> dict[str, Any]:
    """The canonical view document; raises table.TableError naming the field (`view.<key>`)."""
    if not isinstance(raw, dict):
        raise table.TableError("view")
    unknown = [k for k in raw if k not in VIEW_KEYS]
    if unknown:
        raise table.TableError(f"view.{unknown[0]}", "unknown")
    out: dict[str, Any] = {}
    view = raw.get("view") or "table"
    if view not in table.VIEWS:
        raise table.TableError("view.view")
    out["view"] = view
    try:
        out["filters"] = table.parse_filters(raw.get("filters") or {}).as_dict()
    except table.TableError as exc:
        raise table.TableError(f"view.filters.{exc.field}", exc.code) from None
    try:
        out["sort"] = table.sort_text(table.parse_sort(raw.get("sort")))
    except table.TableError:
        raise table.TableError("view.sort") from None
    try:
        out["columns"] = list(table.parse_columns(raw.get("columns"), name="view.columns"))
    except table.TableError:
        raise table.TableError("view.columns") from None
    density = raw.get("density") or "comfortable"
    if density not in table.DENSITIES:
        raise table.TableError("view.density")
    out["density"] = density
    return out


def dump(view: dict[str, Any]) -> str:
    return json.dumps(view, ensure_ascii=False, separators=(",", ":"))


def present(row: dict[str, Any]) -> dict[str, Any]:
    """A stored row as the API answers it; a stored document that no longer validates (a column removed by a later version) is read
    back with its broken parts reset, never an error."""
    try:
        doc = json.loads(row.get("view_json") or "{}")
    except ValueError:
        doc = {}
    try:
        view = normalize(doc)
    except table.TableError:
        view = normalize({k: v for k, v in (doc if isinstance(doc, dict) else {}).items() if k in ("view", "density") and _safe(k, v)})
    return {"id": row["id"], "name": row["name"], "view": view, "created_at": row["created_at"], "updated_at": row["updated_at"]}


def _safe(key: str, value: Any) -> bool:
    try:
        normalize({key: value})
        return True
    except table.TableError:
        return False
