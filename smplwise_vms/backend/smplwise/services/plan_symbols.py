"""The 24 object symbols of the Plan Studio exports (T085): inner SVG markup in a 24 x 24 box, stroke based, keyed by
the catalog's icon id. frontend/src/map/plan-symbols.ts draws the same ids on the map; the primitives carry the id and
the placement, so the two drawings may differ in detail but never in where they sit."""
from __future__ import annotations

SYMBOLS: dict[str, str] = {
    "box": '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
    "cylinder": '<circle cx="12" cy="12" r="7"/>',
    "chair": '<rect x="7" y="10" width="10" height="7" rx="1.5"/><path d="M7 10V6h10v4M8 17v3M16 17v3"/>',
    "table": '<rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M6 16v3M18 16v3"/>',
    "sofa": '<path d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6H4z"/><path d="M4 14h16M7 9V7h10v2"/>',
    "bed": '<rect x="4" y="9" width="16" height="9" rx="1.5"/><path d="M4 13h16M6 9V6h5v3M6 18v2M18 18v2"/>',
    "cabinet": '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M12 4v16M9 11h1M14 11h1"/>',
    "lamp": '<circle cx="12" cy="11" r="5"/><path d="M12 16v3M9 20h6M8 5l1 1M16 5l-1 1"/>',
    "panel": '<rect x="6" y="4" width="12" height="16" rx="1"/><path d="M9 8h6M9 11h6M9 14h3"/>',
    "socket": '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M10 10v4M14 10v4"/>',
    "extinguisher": '<rect x="9" y="8" width="6" height="12" rx="3"/><path d="M12 8V5M9 5h6M15 9l3-2"/>',
    "smoke": '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 5v2M12 17v2"/>',
    "exit": '<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M9 12h7M13 9l3 3-3 3"/>',
    "aed": '<path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.5 12 20 12 20z"/><path d="M12 9l-1.5 3h3L12 15"/>',
    "medical": '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M12 9v6M9 12h6"/>',
    "goal": '<rect x="4" y="6" width="16" height="10"/><path d="M4 16v3M20 16v3M8 6v10M12 6v10M16 6v10"/>',
    "mat": '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v8M12 8v8M17 8v8"/>',
    "stairs": '<path d="M4 20h4v-4h4v-4h4V8h4"/>',
    "elevator": '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M8 10l1.5-2 1.5 2M14.5 14l1.5 2 1.5-2"/>',
    "doorstation": '<rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="8" r="2"/><path d="M9 13h6M9 16h6"/>',
    "tree": '<circle cx="12" cy="10" r="6"/><path d="M12 16v5M9 21h6"/>',
    "sanitary": '<path d="M6 10h12v3a6 6 0 0 1-12 0z"/><path d="M12 10V5M9 5h6"/>',
    "office": '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
    "parking": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
}


def symbol_markup(icon: str) -> str:
    """The markup of a symbol id; an unknown id draws the plain box (the same fallback the map uses)."""
    return SYMBOLS.get(icon, SYMBOLS["box"])
