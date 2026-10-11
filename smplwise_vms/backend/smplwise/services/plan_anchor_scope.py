"""PLNS (owner decision D1, 2026-10-08): the anchor references inside a structure document follow the reader's camera
scope - the known open item of 2.3.1 (docs/changes/ST5-PLAN-PACKAGE-DXF.md, PLN2 "Observed, not changed").

A furniture / structure item bound to an anchor stores `anchor_ref = {resource_type, resource_id}`: objects and
openings on the item itself, a glass wall on each operable panel (`walls[].glazing.operable[].anchor_ref`). The
security review 2.2.0 M2 filter already kept hidden cameras out of the anchors list, the floor bundle, the package's
anchors.json / report and the DXF devices, but the stored document still named them. Now:

- **Read / export** (`redact`): a reference the reader may not see becomes `null`; the item itself stays (the structure
  is the floor's, only the link to the camera is withheld). An OBJECT bound to such an anchor is served at
  WITHHELD_POSITION with rotation 0, never at its stored pose, which the store copied from the anchor (security review
  2.4.2 M2, owner decision 2026-10-09: the camera's position and heading are not handed to a reader denied the camera). The rule is the floor bundle's
  (routers/anchors.py, T055): a camera follows the reader's camera scope for map.read, an entity is withheld from a
  reader who reaches the floor only through camera bindings. Unlike the anchors list, a camera of a removed recorder is
  NOT withheld from a reader who may see it (its id is no secret to them; history documents name it).
- **Write** (`carry_hidden`): the stored document is never changed by someone who could not see what they would
  change. A reference the writer was not shown comes back from the stored document for the same item (same id; for a
  glass panel the same wall id and panel number) when the writer sends `null` for it, and an object takes back its
  stored pose with it. A NEW reference to an anchor the writer may not see - or, for a scoped writer, a camera
  reference to nothing known here, so the answer never tells the two apart (security review 2.4.2 L2) - is refused
  (the editor routes: 422 `anchor_hidden`) or dropped (the package import: warning `anchor_hidden`) - binding a body to
  a hidden camera would move the body onto the camera's position.
- **Write, L3** (security review 2.4.2 L3): a reference the writer was not shown stays whatever they send for that place
  (null, a camera they see, anything) - only someone who may see it changes it. Removing an item (or a glass panel) that
  holds such a reference is allowed - the structure is the floor's - but the save answers a warning
  `anchor_hidden_removed` and is audited (`removed_hidden`). A package exported by a scoped person names what was
  withheld in its signed manifest (`document.redacted`, `document.withheld`); its import gives those references back
  from the current draft for the same items, whoever imports it (`restore_withheld`).
- Stored documents and their hashes are unchanged; there is no migration. The server's own compares (the store's
  "unchanged" checks, the skins geometry key, the shared-room cache keys) use the hash of the STORED row. What a reader
  is handed follows L1 (security review 2.4.2 L1): a reader for whom a reference of a stored document is withheld gets,
  in place of the stored `doc_hash` (geometry reads and their `published_hash`, the publish timeline, the versions
  list, publish / rollback answers, the floor bundle's geometry ref, the package preview / import hashes, the skins
  geometry key), the hash of the document as redacted for them (`served_hash`) - so a guessed camera id can never be
  confirmed offline against a stored hash. Every one of those places uses the same function, so the hashes a client
  compares (bundle ref vs geometry read, timeline vs `?at=` read, `doc_hash` vs `published_hash`, preview vs import)
  still agree. The published read's ETag is computed over the served body, and the package's plan.json, manifest
  `doc_hash` / `geometry_hash` and the DXF `SW_DOC_HASH` are computed over the redacted document in the package.
- Openings and glass panels: nothing is copied from an anchor onto them (they keep their own place on their wall), so a
  withheld reference there withholds only the reference; L1 covers the hash that used to confirm it.
"""
from __future__ import annotations

import copy
import json
import sqlite3
import threading
from collections import OrderedDict
from typing import Any, Callable, Iterator

Visible = Callable[[str, Any], bool]
REF_COLLECTIONS = ("openings", "objects")
# security review 2.4.2 M2: where a reader who may not see a body's anchor is shown that body (the plan's centre, the
# same for every body and every plan, so it tells nothing about the anchor)
WITHHELD_POSITION = (0.5, 0.5)
POSE_FIELDS = ("position", "rotation_deg")


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
    """The document as this reader gets it: every reference they may not see set to null, everything else as stored -
    except the pose of an OBJECT bound to such an anchor (security review 2.4.2 M2, owner decision 2026-10-09): the store
    copies the anchor's position and rotation onto the body (plan_geometry.apply_anchor_positions), so the stored pose IS
    the hidden camera's; this reader gets the body at WITHHELD_POSITION with rotation 0 instead. Openings and glass panels
    keep their own place on their wall (nothing is copied onto them). Returns (document, whether anything was withheld);
    the document is a copy only when something was."""
    if not has_hidden(doc, visible):
        return doc, False
    out = copy.deepcopy(doc)
    for coll, _it, _key, holder in _slots(out):
        if _hidden(holder.get("anchor_ref"), visible):  # type: ignore[arg-type]
            holder["anchor_ref"] = None
            if coll == "objects":
                holder["position"] = list(WITHHELD_POSITION)
                holder["rotation_deg"] = 0
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
    """One item a writer sent, against the stored copy of the same item (`old`, None for a new item): a hidden stored
    reference comes back from `old` whatever the writer sent for that place - null, a camera they see, anything
    (security review 2.4.2 L3) - for an object with its stored pose (the writer was shown the withheld one, see
    `redact`); a new reference the writer may not make (`_refused`) is not stored and its item id is put in `dropped`
    (also where a hidden one is kept, so the answer does not tell a bound item from an unbound one)."""
    stored = {k: h.get("anchor_ref") for k, h in _holders(old, coll)} if isinstance(old, dict) else {}
    refused = {k for k, h in _holders(new, coll) if _refused(h.get("anchor_ref"), stored.get(k), visible, exists)}
    if not refused and not any(_hidden(r, visible) for r in stored.values()):
        return new
    out = copy.deepcopy(new)
    for key, holder in _holders(out, coll):
        before = stored.get(key)
        if _hidden(before, visible):
            holder["anchor_ref"] = copy.deepcopy(before)
            if coll == "objects" and isinstance(old, dict):
                for f in POSE_FIELDS:
                    if f in old:
                        holder[f] = copy.deepcopy(old[f])
                    else:
                        holder.pop(f, None)
        elif key in refused:
            holder["anchor_ref"] = None
        if key in refused:
            dropped.append(str(out.get("id")))
    return out


def _hidden_places(doc: dict[str, Any] | None, visible: Visible) -> dict[tuple[str, Any, Any], Any]:
    """(collection, item id, place within the item) -> the reference, for every reference of `doc` hidden by `visible`."""
    out: dict[tuple[str, Any, Any], Any] = {}
    for coll, it, key, holder in _slots(doc or {}):
        ref = holder.get("anchor_ref")
        if _hidden(ref, visible) and isinstance(it.get("id"), str):
            out[(coll, it["id"], key)] = ref
    return out


def removed_hidden(written: dict[str, Any], stored: dict[str, Any] | None, visible: Visible | None) -> list[str]:
    """Security review 2.4.2 L3: the items (or the walls whose glass panel) of `stored` holding a reference the writer may
    not see that the written document no longer holds at the same place - the item, the wall or the panel was removed.
    The removal is the writer's right (the structure is the floor's); the caller warns and audits it."""
    if visible is None or not isinstance(stored, dict):
        return []
    before = _hidden_places(stored, visible)
    if not before:
        return []
    after = {(c, i.get("id"), k): h.get("anchor_ref") for c, i, k, h in _slots(written)}
    return sorted({f"{c}:{iid}" for (c, iid, k), ref in before.items() if not _same(after.get((c, iid, k)), ref)})


def withheld_places(stored: dict[str, Any], visible: Visible | None) -> list[dict[str, Any]]:
    """The places of `stored` whose reference `redact` withholds from this reader, for a package manifest (L3):
    [{collection, id, panel?}], sorted, at most 5000."""
    if visible is None:
        return []
    out = []
    for (coll, iid, key) in _hidden_places(stored, visible):
        e: dict[str, Any] = {"collection": coll, "id": iid}
        if key:
            e["panel"] = key[1]
        out.append(e)
    out.sort(key=lambda e: (e["collection"], e["id"], e.get("panel") if isinstance(e.get("panel"), int) else -1))
    return out[:5000]


def restore_withheld(incoming: dict[str, Any], current: dict[str, Any] | None, withheld: Any) -> tuple[dict[str, Any], int]:
    """A package whose exporter was not shown some references (the manifest's `document.withheld`, L3): each such place
    that is still null in the package takes the reference the current document holds for the same item (same id; for a
    glass panel the same wall id and panel number) - an object with its current pose, since the package has the
    withheld one. Whoever imports it; places the current document does not bind stay as the package has them.
    Returns (document, how many references came back)."""
    if not isinstance(withheld, list) or not withheld or not isinstance(current, dict):
        return incoming, 0
    want = set()
    for e in withheld[:5000]:
        if isinstance(e, dict) and e.get("collection") in (*REF_COLLECTIONS, "walls") and isinstance(e.get("id"), str):
            want.add((e["collection"], e["id"], ("panel", e["panel"]) if e["collection"] == "walls" and isinstance(e.get("panel"), int) else ()))
    if not want:
        return incoming, 0
    cur_items = {(c, i.get("id")): i for c, i, _k, _h in _slots(current)}
    cur_refs = {(c, i.get("id"), k): h.get("anchor_ref") for c, i, k, h in _slots(current)}
    out = copy.deepcopy(incoming)
    n = 0
    for coll, it, key, holder in _slots(out):
        place = (coll, it.get("id"), key)
        before = cur_refs.get(place)
        if place in want and holder.get("anchor_ref") is None and isinstance(before, dict):
            holder["anchor_ref"] = copy.deepcopy(before)
            n += 1
            old = cur_items.get((coll, it.get("id")))
            if coll == "objects" and isinstance(old, dict):
                for f in POSE_FIELDS:
                    if f in old:
                        holder[f] = copy.deepcopy(old[f])
                    else:
                        holder.pop(f, None)
    return out, n


# ---------------------------------------------------------------- L1: the hash a reader is handed

_CACHE_MAX = 512
_REFS: "OrderedDict[str, tuple[tuple[str, Any, str], ...]]" = OrderedDict()
_SERVED: "OrderedDict[tuple[str, frozenset[tuple[str, str]]], str]" = OrderedDict()
_CACHE_LOCK = threading.Lock()


def _cache_get(cache: OrderedDict, key: Any) -> Any:
    with _CACHE_LOCK:
        hit = cache.get(key)
        if hit is not None:
            cache.move_to_end(key)
        return hit


def _cache_put(cache: OrderedDict, key: Any, value: Any) -> None:
    with _CACHE_LOCK:
        cache[key] = value
        cache.move_to_end(key)
        while len(cache) > _CACHE_MAX:
            cache.popitem(last=False)


def _ref_id_key(rid: Any) -> str:
    try:
        return json.dumps(rid, sort_keys=True, default=str)
    except (TypeError, ValueError):
        return repr(rid)


def served_hash(stored_hash: Any, load: Callable[[], dict[str, Any]], visible: Visible | None) -> Any:
    """Security review 2.4.2 L1: the document hash this reader is handed for a stored row. The stored hash itself when
    nothing of the document is withheld from them (they could compute it from what they get), else the hash of the
    document as `redact` gives it to them - never the stored hash, which would confirm a guessed camera id offline.
    `load` gives the stored document (called only on a cache miss; documents are cached per stored hash by the
    references they hold, so a repeated read parses nothing)."""
    if visible is None or not isinstance(stored_hash, str) or not stored_hash:
        return stored_hash
    doc: dict[str, Any] | None = None
    refs = _cache_get(_REFS, stored_hash)
    if refs is None:
        doc = load()
        refs = tuple((str(h.get("anchor_ref", {}).get("resource_type")), h["anchor_ref"].get("resource_id"), _ref_id_key(h["anchor_ref"].get("resource_id")))
                     for _c, _i, _k, h in _slots(doc) if isinstance(h.get("anchor_ref"), dict))
        _cache_put(_REFS, stored_hash, refs)
    hidden = frozenset((t, k) for t, rid, k in refs if not visible(t, rid))
    if not hidden:
        return stored_hash
    hit = _cache_get(_SERVED, (stored_hash, hidden))
    if hit is not None:
        return hit
    from . import geometry_store as store

    served = store.doc_hash(redact(doc if doc is not None else load(), visible)[0])
    _cache_put(_SERVED, (stored_hash, hidden), served)
    return served


def _refused(ref: Any, before: Any, visible: Visible, exists: Callable[[dict[str, Any]], bool]) -> bool:
    """A NEW reference (not the one stored for that place) a scoped writer may not make: one to an anchor their scope
    hides, or a camera reference to nothing known here - so the answer is the same for a registered hidden camera and an
    unknown id and never confirms that a camera exists (security review 2.4.2 L2). A writer who sees every anchor
    (visibility None) never gets here."""
    if not isinstance(ref, dict) or _same(ref, before):
        return False
    if _hidden(ref, visible):
        return True
    return ref.get("resource_type") == "camera" and not exists(ref)


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
