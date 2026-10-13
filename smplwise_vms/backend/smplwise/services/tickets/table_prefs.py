"""CR-038 slice 6b (D24, section 13.6): the per-user preference `tickets.board` (services/user_prefs.py, CR-013 mechanism) - the board's
view (cards / table / kanban), the table's columns and their order, the last sort, the density, the page size and the saved view the
user marked as default. Presentation only: no permission, no data. A partial object: a missing key follows the default; null (no
stored value) = all defaults. The values are validated by the same whitelists as the list API (services/tickets/table.py)."""
from __future__ import annotations

from typing import Any

from . import table

KEYS = ("view", "columns", "sort", "density", "limit", "default_view")


def normalize(value: Any) -> dict[str, Any]:
    """The user_prefs validator of `tickets.board` (ValueError on a bad value: routers/me.py answers 422)."""
    if not isinstance(value, dict) or len(value) > len(KEYS):
        raise ValueError("tickets.board must be an object")
    unknown = [k for k in value if k not in KEYS]
    if unknown:
        raise ValueError(f"tickets.board: unknown key {unknown[0]}")
    out: dict[str, Any] = {}
    try:
        if "view" in value and value["view"] is not None:
            if value["view"] not in table.VIEWS:
                raise ValueError("tickets.board.view")
            out["view"] = value["view"]
        if "columns" in value and value["columns"] is not None:
            if not isinstance(value["columns"], list):
                raise ValueError("tickets.board.columns")
            out["columns"] = list(table.parse_columns(value["columns"]))
        if "sort" in value and value["sort"] is not None:
            out["sort"] = table.sort_text(table.parse_sort(value["sort"]))
        if "density" in value and value["density"] is not None:
            if value["density"] not in table.DENSITIES:
                raise ValueError("tickets.board.density")
            out["density"] = value["density"]
        if "limit" in value and value["limit"] is not None:
            out["limit"] = table.parse_limit(value["limit"])
        if "default_view" in value and value["default_view"] is not None:
            dv = value["default_view"]
            if not isinstance(dv, str) or not table.ID_RE.match(dv):
                raise ValueError("tickets.board.default_view")
            out["default_view"] = dv
    except table.TableError as exc:
        raise ValueError(f"tickets.board.{exc.field}") from None
    return out
