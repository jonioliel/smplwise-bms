"""PLNS (owner decision D1, 2026-10-08): the anchor references inside a structure document follow the reader's camera
scope - the known open item of 2.3.1 (docs/changes/ST5-PLAN-PACKAGE-DXF.md, PLN2 "Observed, not changed").

A furniture / structure item bound to an anchor stores `anchor_ref = {resource_type, resource_id}`: objects and
openings on the item itself, a glass wall on each operable panel (`walls[].glazing.operable[].anchor_ref`). The
security review 2.2.0 M2 filter already kept hidden cameras out of the anchors list, the floor bundle, the package's
anchors.json / report and the DXF devices, but the stored document still named them. Now:

- **Read / export** (`redact`): a reference the reader may not see becomes `null`; the item itself stays, with its own
  position (the structure is the floor's, only the link to the camera is withheld). The rule is the floor bundle's
  (routers/anchors.py, T055): a camera follows the reader's camera scope for map.read, an entity is withheld from a
  reader who reaches the floor only through camera bindings. Unlike the anchors list, a camera of a removed recorder is
  NOT withheld from a reader who may see it (its id is no secret to them; history documents name it).
- **Write** (`carry_hidden`): the stored document is never changed by someone who could not see what they would
  change. A reference the writer was not shown comes back from the stored document for the same item (same id; for a
  glass panel the same wall id and panel number) when the writer sends `null` for it. A NEW reference to an anchor the
  writer may not see, that exists here, is refused (the editor routes: 422 `anchor_hidden`) or dropped (the package
  import: warning `anchor_hidden`) - binding a body to a hidden camera would move the body onto the camera's position.
- Stored documents and their hashes are unchanged; there is no migration. `geometry.doc_hash` and `result_hash` stay the
  identity of the STORED row (the map bundle, the publish timeline and the editor's "pending publish" compare them).
  What is served and redacted carries its own hash: the published read's ETag is computed over the served body, and the
  package's plan.json, manifest `doc_hash` / `geometry_hash` and the DXF `SW_DOC_HASH` are computed over the redacted
  document that is actually in the package.
"""
from __future__ import annotations

import copy
import sqlite3
from typing import Any, Callable, Iterator

Visible = Callable[[str, Any], bool]
REF_COLLECTIONS = ("openings", "objects")


class HiddenAnchor(Exception):
    """A new reference to an anchor the writer may not see (the editor routes answer 422 `anchor_hidden`)."""

    def __init__(self, items: list[str]) -> None:
        super().__init__("anchor_hidden")
        self.items = items


def visibility(conn: sqlite3.Connection, principal: Any, floor_id: str) -> Visible | None:
    """Which anchor references this reader of `floor_id` may see; None = every one (nothing to redact). A camera: the
    reader's camera scope for map.read (an explicit deny wins); an entity: not for a camera-only reader."""
    from .access import camera_scope, floor_reach

    if principal is None:
        return None
    scope = camera_scope(conn, principal, "map.read")
    camera_only = floor_reach(conn, principal, floor_id) != "floor"
    if scope.everything and not camera_only:
        return None

    def visible(resource_type: str, resource_id: Any) -> bool:
        if resource_type == "camera":
            return scope.allows(resource_id if isinstance(resource_id, str) else None)
        return not camera_only

    return visible


def _hidden(ref: Any, visible: Visible) -> bool:
    return isinstance(ref, dict) and not visible(str(ref.get("resource_type")), ref.get("resource_id"))


def _holders(item: dict[str, Any], coll: str) -> Iterator[tuple[Any, dict[str, Any]]]:
    """The places an item keeps an anchor reference: (key within the item, the dict holding `anchor_ref`)."""
    if coll in REF_COLLECTIONS:
        yield (), item
    elif coll == "walls":
        g = item.get("glazing")
        ops = g.get("operable") if isinstance(g, dict) else None
        if isinstance(ops, list):
            for o in ops:
                if isinstance(o, dict):
                    yield ("panel", o.get("panel") if isinstance(o.get("panel"), int) else None), o


def _slots(doc: dict[str, Any]) -> Iterator[tuple[str, dict[str, Any], Any, dict[str, Any]]]:
    for coll in (*REF_COLLECTIONS, "walls"):
        items = doc.get(coll)
        if not isinstance(items, list):
            continue
        for it in items:
            if isinstance(it, dict):
                for key, holder in _holders(it, coll):
                    yield coll, it, key, holder


def has_hidden(doc: dict[str, Any], visible: Visible | None) -> bool:
    return visible is not None and any(_hidden(h.get("anchor_ref"), visible) for _c, _i, _k, h in _slots(doc))


def redact(doc: dict[str, Any], visible: Visible | None) -> tuple[dict[str, Any], bool]:
    """The document as this reader gets it: every reference they may not see set to null, everything else as stored.
    Returns (document, whether anything was withheld); the document is a copy only when something was."""
    if not has_hidden(doc, visible):
        return doc, False
    out = copy.deepcopy(doc)
    for _coll, _it, _key, holder in _slots(out):
        if _hidden(holder.get("anchor_ref"), visible):  # type: ignore[arg-type]
            holder["anchor_ref"] = None
    return out, True


def _same(a: Any, b: Any) -> bool:
    return isinstance(a, dict) and isinstance(b, dict) and (a.get("resource_type"), a.get("resource_id")) == (b.get("resource_type"), b.get("resource_id"))


def exists_here(conn: sqlite3.Connection, floor_id: str) -> Callable[[dict[str, Any]], bool]:
    """Whether a reference names something of this installation: an anchor on the floor, a registered camera or a known
    entity. A reference to nothing known binds nothing and is left as it is (the anchor_missing warning names it)."""
    from . import geometry_store as store

    placed = set(store.anchor_positions(conn, floor_id))

    def exists(ref: dict[str, Any]) -> bool:
        t, rid = ref.get("resource_type"), ref.get("resource_id")
        if not isinstance(rid, str):
            return False
        if f"{t}:{rid}" in placed:
            return True
        if t == "camera":
            return conn.execute("SELECT 1 FROM cameras WHERE id = ?", (rid,)).fetchone() is not None
        return conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ?", (rid,)).fetchone() is not None

    return exists


def fix_item(old: dict[str, Any] | None, new: dict[str, Any], coll: str, visible: Visible, exists: Callable[[dict[str, Any]], bool],
             dropped: list[str]) -> dict[str, Any]:
    """One item a writer sent, against the stored copy of the same item (`old`, None for a new item): a hidden
    reference left null comes back from `old`; a new hidden reference is dropped and its item id put in `dropped`."""
    stored = {k: h.get("anchor_ref") for k, h in _holders(old, coll)} if isinstance(old, dict) else {}
    if not any(_hidden(r, visible) for r in stored.values()) and not any(_hidden(h.get("anchor_ref"), visible) for _k, h in _holders(new, coll)):
        return new
    out = copy.deepcopy(new)
    for key, holder in _holders(out, coll):
        ref, before = holder.get("anchor_ref"), stored.get(key)
        if ref is None:
            if _hidden(before, visible):
                holder["anchor_ref"] = copy.deepcopy(before)
        elif _hidden(ref, visible) and not _same(ref, before) and exists(ref):
            holder["anchor_ref"] = None
            dropped.append(str(out.get("id")))
    return out


def carry_hidden(incoming: dict[str, Any], stored: dict[str, Any] | None, visible: Visible | None, exists: Callable[[dict[str, Any]], bool],
                 *, strict: bool) -> tuple[dict[str, Any], list[str]]:
    """A document a writer sent (`incoming`), against the stored one it replaces (`stored`): every reference the writer
    was not shown is carried over from `stored` (fix_item). A new reference to a hidden anchor raises HiddenAnchor when
    `strict`, else it is dropped; returns (document, the ids of the items whose reference was dropped)."""
    if visible is None:
        return incoming, []
    dropped: list[str] = []
    out = dict(incoming)
    for coll in (*REF_COLLECTIONS, "walls"):
        items = incoming.get(coll)
        if not isinstance(items, list):
            continue
        before = {i.get("id"): i for i in (stored or {}).get(coll) or [] if isinstance(i, dict) and isinstance(i.get("id"), str)}
        out[coll] = [fix_item(before.get(i.get("id")), i, coll, visible, exists, dropped) if isinstance(i, dict) else i for i in items]
    if dropped and strict:
        raise HiddenAnchor(sorted(set(dropped)))
    return out, sorted(set(dropped))
