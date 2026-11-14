"""CR-017 S1: the seam between the routes and the block model (S2's `automation_model`).

The model is pure; this module is what the SERVICE does around it, per request and per caller:

- `read`: a stored config (the cached, masked one, or the fresh real one) as the item the rest of the service works with: its draft, sentence, whether it
  holds secrets, whether the model cannot round-trip it (`unsupported`: a scene the writer would not reproduce byte for byte).
- `sanitise`: a draft that came from a CLIENT is never trusted. A locked block gets its `raw` from the stored item by fingerprint (the client's raw is only
  used to compute that fingerprint and is dropped); a typed block keeps only a `raw` that is one of the stored item's, else it is rebuilt - or, when the
  caller was shown no raws (no code view), its stored raw is found again by the typed fields. What is left of locked blocks that are NOT the stored ones is
  returned as `changed` (the locked-block rule of AUTOMATIONS_API.md section 3.2: 403 `locked_block_changed`, or a `code` profile save in route 9).
- `present`: a draft as one caller may see it: secrets masked, raw content and template text only for the code view, and trigger / condition blocks that watch
  an entity outside the caller's reach as locked views (shown by their sentence, never editable, written back untouched).

Nothing here talks to Home Assistant or the database."""
from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Callable

from . import automation_model as model
from . import automation_policy as pol
from . import automation_text as text

Block = dict[str, Any]


# ================================================================ read

def read(kind: str, config: Any, mctx: model.ModelContext) -> dict[str, Any]:
    """A stored config as the service's read item: `draft`, `sentence`, `extras` (top-level keys the draft does not model), `legacy`, `masked`, `locked_count`,
    `unsupported`, `config`."""
    cfg = config if isinstance(config, dict) else {}
    res = model.config_to_draft(kind, cfg, mctx)
    d = res.draft
    return {"kind": kind, "draft": d, "extras": res.extras, "legacy": res.legacy, "sentence": text.draft_sentence(kind, d, mctx), "config": cfg,
            "masked": pol.secret_kind(cfg) is not None or pol.has_mask(cfg), "locked_count": model.locked_count(d), "unsupported": kind == "scene" and not _scene_roundtrips(d, cfg, mctx)}


def _scene_roundtrips(draft: dict[str, Any], cfg: dict[str, Any], mctx: model.ModelContext) -> bool:
    """A scene the writer would not reproduce (a member in a shape the draft cannot hold) is shown, never edited here."""
    try:
        return model.canonical_json(model.draft_to_config("scene", draft, cfg, mctx, item_id=cfg.get("id"))) == model.canonical_json(cfg)
    except (model.ModelError, KeyError, TypeError, ValueError):
        return False


def path_sentences(draft: dict[str, Any]) -> dict[str, str]:
    """`dotted path -> sentence` of every block (what a run's trace lists by path)."""
    return {w.path: w.block.get("sentence") or "" for w in model.walk_draft(draft)}


# ================================================================ sanitise (a draft from a client)

@dataclass
class Sanitised:
    draft: dict[str, Any]
    changed: list[tuple[str, Block]] = field(default_factory=list)  # (path, locked block) that is not one of the stored item's
    problems: list[dict[str, str]] = field(default_factory=list)


def _strip(b: Block) -> Block:
    """A deep copy whose typed blocks (children too) carry no `raw`: what `emit_block` rebuilds from the typed fields alone. Locked blocks keep their raw."""
    c = copy.deepcopy(b)

    def go(x: Block) -> None:
        if x.get("kind") == "typed":
            x["raw"] = None
            for _name, kids, _sec in model.child_lists(x):
                for k in kids:
                    go(k)
            if x.get("type") == "condition" and isinstance(x.get("condition"), dict):
                go(x["condition"])

    go(c)
    return c


def _key(b: Block, section: str, mctx: model.ModelContext) -> str | None:
    try:
        return model.canonical_json(model.emit_block(_strip(b), section, mctx))
    except (model.ModelError, KeyError, TypeError, ValueError):
        return None


class _Stored:
    """What the stored item holds, indexed for the three lookups of `sanitise`."""

    def __init__(self, draft: dict[str, Any] | None, mctx: model.ModelContext) -> None:
        self.all_raw: dict[str, Any] = {}  # fingerprint of a block's raw -> the raw (typed and locked blocks both)
        self.typed_raw: set[str] = set()  # canonical raws of the typed blocks
        self.by_key: dict[tuple[str, str], Any] = {}  # (section, rebuilt form) -> raw of a typed block
        self.fields: dict[str, Any] = {}  # script field key -> stored selector raw
        if draft is None:
            return
        for w in model.walk_draft(draft):
            b = w.block
            raw = b.get("raw")
            if raw is None:
                continue
            self.all_raw.setdefault(model.fingerprint_of(raw), raw)
            if b.get("kind") == "typed":
                self.typed_raw.add(model.canonical_json(raw))
                k = _key(b, w.section, mctx)
                if k is not None:
                    self.by_key.setdefault((w.section, k), raw)
        for f in draft.get("fields") or []:
            if f["selector"].get("kind") == "locked":
                self.fields[f["key"]] = f["selector"].get("raw")


def sanitise(kind: str, draft: dict[str, Any], stored_draft: dict[str, Any] | None, mctx: model.ModelContext) -> Sanitised:
    """See the module docstring. `stored_draft` = the draft of the REAL stored item (None for a create)."""
    d = model.unmask_draft(draft, stored_draft)
    idx = _Stored(stored_draft, mctx)
    out = Sanitised(d)
    walked = model.walk_draft(d)
    for w in walked:  # locked blocks first: typed containers are rebuilt from them
        b = w.block
        if b.get("kind") != "locked":
            continue
        raw, claimed = b.get("raw"), b.get("fingerprint")
        cands: list[str] = []
        if raw is not None and not pol.has_mask(raw):
            cands.append(model.fingerprint_of(raw))
        elif isinstance(claimed, str):
            cands.append(claimed)
        hit = next((idx.all_raw[c] for c in cands if c in idx.all_raw), None)
        if hit is not None:
            b["raw"], b["fingerprint"] = copy.deepcopy(hit), model.fingerprint_of(hit)
        else:
            out.changed.append((w.path, b))
            if raw is None or pol.has_mask(raw):
                out.problems.append({"path": w.path, "code": "locked_block_changed", "message": "חלק נעול שונה. אפשר לשנות אותו רק בתצוגת הקוד."})
    for w in walked:
        b = w.block
        if b.get("kind") != "typed":
            continue
        raw = b.get("raw")
        if raw is not None and not pol.has_mask(raw) and model.canonical_json(raw) not in idx.typed_raw:
            raw = b["raw"] = None  # a client's own raw is never written: the block is rebuilt from its fields
        if raw is None:
            k = _key(b, w.section, mctx)
            hit = idx.by_key.get((w.section, k)) if k is not None else None
            if hit is not None:
                b["raw"] = copy.deepcopy(hit)
    for i, f in enumerate(d.get("fields") or []):
        sel = f["selector"]
        if sel.get("kind") != "locked":
            continue
        raw, stored_raw = sel.get("raw"), idx.fields.get(f["key"])
        if stored_raw is not None and (raw is None or pol.has_mask(raw) or model.canonical_json(raw) == model.canonical_json(stored_raw)):
            sel["raw"] = copy.deepcopy(stored_raw)
        else:
            out.changed.append((f"fields.{i}", {"kind": "locked", "raw": raw}))
    return out


# ================================================================ present (a draft for one caller)

def _lock_view(b: Block, section: str, mctx: model.ModelContext) -> None:
    """A typed trigger / condition the caller may not watch, as a locked block: shown by its sentence, written back untouched (CR section 7)."""
    try:
        raw = model.emit_block(b, section, mctx)
    except model.ModelError:
        return
    uid, sentence = b.get("uid"), b.get("sentence") or ""
    b.clear()
    b.update({"uid": uid, "kind": "locked", "raw": raw, "sentence": sentence, "fingerprint": model.fingerprint_of(raw), "reason": "unknown", "label": sentence or "מחוץ להרשאה",
              "sensitive": False, "effects": "none", "template_text": None, "masked": False})


def present(draft: dict[str, Any], *, code_view: bool, mctx: model.ModelContext, can_watch: Callable[[str], bool] | None = None) -> dict[str, Any]:
    """The draft one caller may see (a deep copy)."""
    d = copy.deepcopy(draft)
    if can_watch is not None:
        for w in model.walk_draft(d):
            b = w.block
            if w.section in ("trigger", "condition") and b.get("kind") == "typed" and b.get("entity_ids") and not all(can_watch(e) for e in b["entity_ids"]):
                _lock_view(b, w.section, mctx)
    d = model.mask_draft(d)
    if not code_view:
        for w in model.walk_draft(d):
            w.block["raw"] = None
            if w.block.get("kind") == "locked":
                w.block["template_text"] = None
        for f in d.get("fields") or []:
            if f["selector"].get("kind") == "locked":
                f["selector"]["raw"] = None
    return d


# ================================================================ code view: content that is expressible by the builder

def strip_defaults(cfg: dict[str, Any]) -> dict[str, Any]:
    """The config without the optional keys that carry their default (an empty description, no conditions, mode single): whether they were stored is the
    stored item's business, not a difference of content."""
    out = dict(cfg)
    for k, empty in (("description", ""), ("conditions", []), ("mode", "single")):
        if out.get(k) == empty:
            out.pop(k)
    return out


def builder_expressible(kind: str, config_in: dict[str, Any], stored: dict[str, Any] | None, mctx: model.ModelContext, item_id: str | None) -> tuple[bool, dict[str, Any]]:
    """Whether a config typed in the code view is what the BUILDER would have written for the same draft (CR section 4.5: the write profile follows the content).
    True when every locked block is one of the stored item's and writing the parsed draft back reproduces the incoming config exactly (an extra key
    that changed, a typed block spelled differently, a field the draft cannot hold: no). Returns (builder?, the draft parsed from the config)."""
    res = model.config_to_draft(kind, config_in, mctx)
    stored_draft = model.config_to_draft(kind, stored, mctx).draft if stored is not None else None
    if model.changed_locked_blocks(res.draft, stored_draft):
        return False, res.draft
    if any(f["selector"].get("kind") == "locked" and f["selector"].get("raw") != (next((s["selector"].get("raw") for s in (stored_draft or {}).get("fields", []) if s["key"] == f["key"]), None))
           for f in res.draft.get("fields") or []):
        return False, res.draft
    try:
        back = model.draft_to_config(kind, res.draft, stored, mctx, item_id=item_id)
    except (model.ModelError, KeyError, TypeError, ValueError):
        return False, res.draft
    return model.canonical_json(strip_defaults(back)) == model.canonical_json(strip_defaults(config_in)), res.draft
