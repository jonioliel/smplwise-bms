"""CR-017 block model: reads a stored automation / script / scene (as Home Assistant keeps it) into the draft of AUTOMATIONS_API.md section 2
(typed blocks and LOCKED blocks), and writes a draft back with the invariant of CR section 6.2:

    write(read(c)) == c        byte for byte, for every unedited item stored in the new schema

A typed block keeps its stored form in `raw`; the writer re-emits `raw` untouched while the typed fields still equal the ones parsed from it, and
rebuilds only a changed block (new schema, Home Assistant's key order). A locked block is its `raw`, always, and carries a fingerprint (sha256/16 of
the canonical JSON of `raw`) the save rules compare. Unknown top-level keys (`variables`, `trace`, `trigger_variables`, `initial_state`, `note`,
`use_blueprint` ...) are carried from the stored item unchanged. Legacy keys (`trigger`, `platform`, `service`) are read in memory and written in the
new schema only when the item is saved.

This module is the Python twin of the model in `frontend/src/api/automations.ts` ("the block model") and is meant to produce the SAME blocks,
sentences and round trips; where it differs on purpose, `docs/architecture/AUTOMATIONS_API.md` section 5 (S2) and the S2 report list it:

- a typed `service` block is typed only when its `data` fits the service's closed argument specs (`automation_policy.args_fit`); anything else
  (a colour, a nested `data`, an unknown argument) is a locked block, so a delegated user can keep it but never author it;
- the services of the builder are the bridge's ALLOWED_SERVICES (no `*.toggle`, no `timer.*`): those are locked `service_not_allowed`;
- `legacy` is decided structurally, not by searching the JSON text.

Blocks are plain dictionaries (the JSON of the contract). Pure functions: no I/O, no Home Assistant.
"""
from __future__ import annotations

import copy
import hashlib
import itertools
import json
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Mapping

from . import automation_policy as pol
from .automation_policy import MASK, has_mask, has_template, first_template, is_entity_id, is_number, mask_secrets, secret_kind
from .automation_text import (  # noqa: F401  (re-exported for the callers)
    ModelContext, action_sentence, automation_sentence, block_sentence, condition_sentence, draft_sentence, duration_text, join_names, locked_label,
    scene_sentence, script_sentence, trigger_sentence,
)

Raw = dict[str, Any]
Block = dict[str, Any]
_MISSING = object()

_uid_counter = itertools.count(1)


def new_uid() -> str:
    """A fresh block uid (`b1`, `b2` ...). Draft-local; never an identity on the server."""
    return f"b{next(_uid_counter)}"


def _uid(ctx: ModelContext) -> str:
    return ctx.uid() if ctx.uid else new_uid()


def _clone(v: Any) -> Any:
    return copy.deepcopy(v)


def _to_list(v: Any) -> list[Any]:
    return [] if v is None else v if isinstance(v, list) else [v]


class ModelError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code  # shabbat_sensor_missing | block_invalid


# ---------------------------------------------------------------- canonical JSON, fingerprints, revisions

def _norm_numbers(x: Any) -> Any:
    """JavaScript prints 1.0 as 1: integral floats become ints so the client and the server hash the same text."""
    if isinstance(x, float) and x.is_integer() and abs(x) < 1e21:
        return int(x)
    if isinstance(x, list):
        return [_norm_numbers(i) for i in x]
    if isinstance(x, dict):
        return {k: _norm_numbers(v) for k, v in x.items()}
    return x


def canonical_json(v: Any) -> str:
    """Keys sorted at every depth, compact, non-ASCII kept (`sort_keys, separators, ensure_ascii=False`; integral floats as ints)."""
    return json.dumps(_norm_numbers(v), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def fingerprint_of(raw: Any) -> str:
    """sha256/16 of the canonical raw: a locked block's identity (CR section 6.2)."""
    return hashlib.sha256(canonical_json(raw).encode("utf-8")).hexdigest()[:16]


def revision_of(config: Any) -> str:
    """First 16 hex of SHA-256 over the canonical JSON of a stored config (CR section 6.1): the item's revision."""
    return fingerprint_of(config)


def dumps_exact(v: Any) -> str:
    """The text of a config in key order and with non-ASCII kept: what the byte-for-byte invariant compares."""
    return json.dumps(v, ensure_ascii=False)


# ---------------------------------------------------------------- locked blocks

def _service_of(raw: Mapping[str, Any]) -> Any:
    a = raw.get("action")
    return a if a is not None else raw.get("service")


def _entity_list(v: Any) -> list[str] | None:
    arr = _to_list(v)
    return arr if all(is_entity_id(x) for x in arr) else None


def _static_effects(raw: Any, reason: str) -> Any:
    if reason in ("template", "device", "custom_service", "unknown"):
        return "unknown"
    if isinstance(raw, dict) and isinstance(_service_of(raw), str):
        tgt = raw["target"].get("entity_id") if isinstance(raw.get("target"), dict) else raw.get("entity_id")
        ids = _entity_list(tgt)
        if ids:
            return ids
    return "unknown"


def mk_locked(raw: Any, reason: str, section: str, ctx: ModelContext) -> Block:
    svc = _service_of(raw) if isinstance(raw, dict) else None
    sensitive = isinstance(svc, str) and bool(pol.SENSITIVE_ACTION_RE.match(svc))
    label = locked_label(raw, reason, section, ctx)
    return {
        "uid": _uid(ctx), "kind": "locked", "raw": raw, "sentence": label, "fingerprint": fingerprint_of(raw), "reason": reason, "label": label, "sensitive": sensitive,
        "effects": _static_effects(raw, reason) if section == "action" else "none",
        "template_text": first_template(raw) if reason == "template" and ctx.template_text and not has_mask(raw) else None,
        "masked": reason in ("secret", "code") or has_mask(raw),
    }


def _locked_for(raw: Any, section: str, ctx: ModelContext, hint: str = "unsupported_step") -> Block:
    """A locked block for a raw that cannot be typed: `template` when it holds one, else the hinted reason."""
    return mk_locked(raw, "template" if has_template(raw) else hint, section, ctx)


_CONTAINER_KEYS = {"conditions", "sequence", "then", "else", "default", "choose", "if", "repeat", "condition"}
_CARRY_KEYS = ("alias", "metadata", "enabled")


def _preflight(raw: Any, section: str, ctx: ModelContext, deep: bool) -> Block | None:
    """Shared by every block: secrets lock it, `enabled: false` / `continue_on_error` lock it as `disabled_step`. `deep` = a leaf (a container's
    children are checked on their own)."""
    if not isinstance(raw, dict):
        return mk_locked(raw, "template" if has_template(raw) else "unknown", section, ctx)
    own = raw if deep else {k: v for k, v in raw.items() if k not in _CONTAINER_KEYS}
    sk = secret_kind(own)
    if sk:
        return mk_locked(raw, sk, section, ctx)
    if raw.get("enabled") is False or "continue_on_error" in raw:
        return mk_locked(raw, "disabled_step", section, ctx)
    if "enabled" in raw and raw["enabled"] is not True:
        return mk_locked(raw, "unsupported_step", section, ctx)
    return None


def _only_keys(raw: Mapping[str, Any], allowed: Iterable[str]) -> bool:
    ok = set(allowed) | set(_CARRY_KEYS)
    return all(k in ok for k in raw)


# ---------------------------------------------------------------- small parsers

_DUR_STR_RE = re.compile(r"^(\d+):([0-5]?\d)(?::([0-5]?\d))?$")
_INVALID = object()


def _parse_duration(v: Any) -> Any:
    """A Duration dict, None (absent) or _INVALID."""
    if v is None:
        return None
    if isinstance(v, bool):
        return _INVALID
    if isinstance(v, (int, float)):
        if v != v or v in (float("inf"), float("-inf")) or v < 0:
            return _INVALID
        return {"hours": int(v // 3600), "minutes": int((v % 3600) // 60), "seconds": v % 60}
    if isinstance(v, str):
        m = _DUR_STR_RE.match(v)
        return {"hours": int(m.group(1)), "minutes": int(m.group(2)), "seconds": int(m.group(3)) if m.group(3) else 0} if m else _INVALID
    if isinstance(v, dict):
        if not v or any(k not in ("hours", "minutes", "seconds") or not is_number(x) or x < 0 for k, x in v.items()):
            return _INVALID
        return dict(v)
    return _INVALID


def _dur_out(d: Mapping[str, Any]) -> Raw:
    return {"hours": d.get("hours") or 0, "minutes": d.get("minutes") or 0, "seconds": d.get("seconds") or 0}


def _num(v: Any) -> Any:
    """None when absent / null, the number, or _INVALID."""
    if v is None:
        return None
    return v if is_number(v) else _INVALID


def _str_or_null(v: Any) -> Any:
    """_MISSING stays missing, None stays None, a template-free string, else _INVALID."""
    if v is _MISSING:
        return _MISSING
    if v is None:
        return None
    return v if isinstance(v, str) and not has_template(v) else _INVALID


_OFFSET_RE = re.compile(r"^([+-])?(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$")


def _offset_min(v: Any) -> Any:
    if v is None:
        return 0
    secs: float
    if isinstance(v, bool):
        return _INVALID
    if isinstance(v, (int, float)):
        secs = v
    elif isinstance(v, str):
        m = _OFFSET_RE.match(v)
        if not m:
            return _INVALID
        secs = (-1 if m.group(1) == "-" else 1) * (int(m.group(2)) * 3600 + int(m.group(3)) * 60 + int(m.group(4) or 0))
    else:
        return _INVALID
    if secs != secs or secs % 60 != 0:
        return _INVALID
    return int(secs // 60)


def _fmt_offset(minutes: int) -> str:
    return f"{'-' if minutes < 0 else ''}{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}:00"


def _hms(t: str) -> str:
    parts = t.split(":")
    return f"{parts[0].rjust(2, '0')}:{parts[1]}:{parts[2] if len(parts) > 2 else '00'}"


def _finish(b: Block, section: str, ctx: ModelContext) -> Block:
    b["sentence"] = block_sentence(b, section, ctx)
    return b


# ---------------------------------------------------------------- parse: triggers

def parse_trigger(raw: Any, ctx: ModelContext | None = None) -> Block:
    ctx = ctx or ModelContext()
    pre = _preflight(raw, "trigger", ctx, True)
    if pre:
        return pre
    r: Raw = raw
    typ = r.get("trigger") if r.get("trigger") is not None else r.get("platform")
    if not isinstance(typ, str):
        return _locked_for(raw, "trigger", ctx, "unknown")
    if typ == "device":
        return mk_locked(raw, "device", "trigger", ctx)
    if typ == "template":
        return mk_locked(raw, "template", "trigger", ctx)
    if "." in typ:
        return mk_locked(raw, "purpose_trigger", "trigger", ctx)
    if has_template(raw):
        return mk_locked(raw, "template", "trigger", ctx)
    if "id" in r and not isinstance(r["id"], str):
        return mk_locked(raw, "unsupported_step", "trigger", ctx)

    def bad(hint: str = "unsupported_step") -> Block:
        return mk_locked(raw, hint, "trigger", ctx)

    head = ["trigger", "platform", "id"]
    common: Block = {"uid": _uid(ctx), "kind": "typed", "raw": raw}
    if isinstance(r.get("id"), str):
        common["id"] = r["id"]
    if typ == "state":
        if not _only_keys(r, [*head, "entity_id", "from", "to", "for"]):
            return bad()
        ids, frm, to, f = _entity_list(r.get("entity_id")), _str_or_null(r.get("from", _MISSING)), _str_or_null(r.get("to", _MISSING)), _parse_duration(r.get("for"))
        if ids is None or frm is _INVALID or to is _INVALID or f is _INVALID:
            return bad()
        b = {**common, "type": "state", "entity_ids": ids}
        if frm is not _MISSING:
            b["from"] = frm
        if to is not _MISSING:
            b["to"] = to
        if f:
            b["for"] = f
        return _finish(b, "trigger", ctx)
    if typ == "numeric_state":
        if not _only_keys(r, [*head, "entity_id", "above", "below", "for"]):
            return bad()
        ids, above, below, f = _entity_list(r.get("entity_id")), _num(r.get("above")), _num(r.get("below")), _parse_duration(r.get("for"))
        if ids is None or above is _INVALID or below is _INVALID or f is _INVALID:
            return bad()
        b = {**common, "type": "numeric_state", "entity_ids": ids}
        if above is not None:
            b["above"] = above
        if below is not None:
            b["below"] = below
        if f:
            b["for"] = f
        return _finish(b, "trigger", ctx)
    if typ == "time":
        if not _only_keys(r, [*head, "at"]) or not isinstance(r.get("at"), str) or not pol.TIME_RE.match(r["at"]):
            return bad()
        return _finish({**common, "type": "time", "at": r["at"]}, "trigger", ctx)
    if typ == "time_pattern":
        if not _only_keys(r, [*head, "hours", "minutes", "seconds"]):
            return bad()

        def pat(v: Any) -> Any:
            if v is None:
                return None
            return (str(v) if not isinstance(v, float) or not v.is_integer() else str(int(v))) if isinstance(v, (str, int, float)) and not isinstance(v, bool) else _INVALID

        h, m, s = pat(r.get("hours")), pat(r.get("minutes")), pat(r.get("seconds"))
        if _INVALID in (h, m, s):
            return bad()
        return _finish({**common, "type": "time_pattern", "hours": h, "minutes": m, "seconds": s}, "trigger", ctx)
    if typ == "sun":
        if not _only_keys(r, [*head, "event", "offset"]) or r.get("event") not in ("sunrise", "sunset"):
            return bad()
        off = _offset_min(r.get("offset"))
        if off is _INVALID:
            return bad()
        return _finish({**common, "type": "sun", "event": r["event"], "offset_min": off}, "trigger", ctx)
    if typ == "homeassistant":
        if not _only_keys(r, [*head, "event"]) or r.get("event") != "start":
            return bad()
        return _finish({**common, "type": "homeassistant", "event": "start"}, "trigger", ctx)
    # event, zone, mqtt, webhook, calendar, tag ...: known to Home Assistant, not typed in v1
    return bad() if re.match(r"^[a-z_]+$", typ) else bad("unknown")


# ---------------------------------------------------------------- parse: conditions

def parse_condition(raw: Any, ctx: ModelContext | None = None, in_group: bool = False) -> Block:
    ctx = ctx or ModelContext()
    if isinstance(raw, str):
        return mk_locked(raw, "template" if has_template(raw) else "unknown", "condition", ctx)
    typ = raw.get("condition") if isinstance(raw, dict) else None
    container = typ in ("and", "or", "not")
    pre = _preflight(raw, "condition", ctx, not container)
    if pre:
        return pre
    r: Raw = raw
    if not isinstance(typ, str):
        return _locked_for(raw, "condition", ctx, "unknown")
    if typ == "device":
        return mk_locked(raw, "device", "condition", ctx)
    if typ == "template":
        return mk_locked(raw, "template", "condition", ctx)

    def bad(hint: str = "unsupported_step") -> Block:
        return _locked_for(raw, "condition", ctx, hint)

    if not container and has_template(raw):
        return mk_locked(raw, "template", "condition", ctx)
    common: Block = {"uid": _uid(ctx), "kind": "typed", "raw": raw}
    head = ["condition"]
    if typ == "state":
        if not _only_keys(r, [*head, "entity_id", "state", "for"]):
            return bad()
        ids, f = _entity_list(r.get("entity_id")), _parse_duration(r.get("for"))
        st = r["state"] if isinstance(r.get("state"), list) else [r.get("state")]
        if ids is None or f is _INVALID or not st or not all(isinstance(s, str) for s in st):
            return bad()
        state = list(r["state"]) if isinstance(r.get("state"), list) else r["state"]
        sensor = ctx.shabbat_sensor
        if sensor and len(ids) == 1 and ids[0] == sensor and not f and state in ("on", "off") and isinstance(state, str):
            return _finish({**common, "type": "shabbat", "mode": "only_holy_days" if state == "on" else "not_holy_days"}, "condition", ctx)
        b = {**common, "type": "state", "entity_ids": ids, "state": state}
        if f:
            b["for"] = f
        return _finish(b, "condition", ctx)
    if typ == "numeric_state":
        if not _only_keys(r, [*head, "entity_id", "above", "below"]):
            return bad()
        ids, above, below = _entity_list(r.get("entity_id")), _num(r.get("above")), _num(r.get("below"))
        if ids is None or above is _INVALID or below is _INVALID:
            return bad()
        b = {**common, "type": "numeric_state", "entity_ids": ids}
        if above is not None:
            b["above"] = above
        if below is not None:
            b["below"] = below
        return _finish(b, "condition", ctx)
    if typ == "time":
        if not _only_keys(r, [*head, "after", "before", "weekday"]):
            return bad()

        def ok_t(k: str) -> bool:
            return k not in r or (isinstance(r[k], str) and bool(pol.TIME_RE.match(r[k])))

        wd = _to_list(r["weekday"]) if "weekday" in r else None
        if not ok_t("after") or not ok_t("before") or (wd is not None and not all(isinstance(d, str) and d in pol.WEEKDAYS for d in wd)):
            return bad()
        b = {**common, "type": "time"}
        if "after" in r:
            b["after"] = r["after"]
        if "before" in r:
            b["before"] = r["before"]
        if wd is not None:
            b["weekday"] = wd
        return _finish(b, "condition", ctx)
    if typ == "sun":
        if not _only_keys(r, [*head, "after", "before"]):
            return bad()

        def ok_s(k: str) -> bool:
            return k not in r or r[k] in ("sunrise", "sunset")

        if not ok_s("after") or not ok_s("before"):
            return bad()
        b = {**common, "type": "sun"}
        if "after" in r:
            b["after"] = r["after"]
        if "before" in r:
            b["before"] = r["before"]
        return _finish(b, "condition", ctx)
    if typ == "trigger":
        ids = _to_list(r.get("id"))
        if not _only_keys(r, [*head, "id"]) or not ids or not all(isinstance(i, str) for i in ids):
            return bad()
        return _finish({**common, "type": "trigger", "ids": ids}, "condition", ctx)
    if typ in ("and", "or", "not"):
        if in_group or not _only_keys(r, [*head, "conditions"]) or not isinstance(r.get("conditions"), list):
            return bad()
        kids = [parse_condition(c, ctx, True) for c in r["conditions"]]
        return _finish({**common, "type": typ, "conditions": kids}, "condition", ctx)
    return bad("unknown")


def _parse_conditions(v: Any, ctx: ModelContext) -> list[Block]:
    return [parse_condition(c, ctx) for c in _to_list(v)]


# ---------------------------------------------------------------- parse: actions

def classify_action(action: str, ctx: ModelContext | None = None) -> pol.Classified:
    return pol.classify_action(action, (ctx.allowed_actions if ctx else None))


def parse_action(raw: Any, ctx: ModelContext | None = None) -> Block:
    ctx = ctx or ModelContext()
    if not isinstance(raw, dict):
        return _preflight(raw, "action", ctx, True)  # type: ignore[return-value]
    container = "choose" in raw or "if" in raw or "repeat" in raw
    pre = _preflight(raw, "action", ctx, not container)
    if pre:
        return pre
    r: Raw = raw

    def bad(hint: str = "unsupported_step") -> Block:
        return _locked_for(raw, "action", ctx, hint)

    def mk(b: Block) -> Block:
        b["uid"] = _uid(ctx)
        return _finish(b, "action", ctx)

    if "choose" in r:
        if not _only_keys(r, ["choose", "default"]) or not isinstance(r["choose"], list):
            return bad()
        opts = []
        for o in r["choose"]:
            if not isinstance(o, dict) or not all(k in ("conditions", "sequence") for k in o):
                return bad()
            opts.append({"conditions": _parse_conditions(o.get("conditions"), ctx), "sequence": parse_actions(o.get("sequence"), ctx)})
        return mk({"kind": "typed", "raw": raw, "type": "choose", "options": opts, "default": parse_actions(r["default"], ctx) if "default" in r else None})
    if "if" in r:
        if not _only_keys(r, ["if", "then", "else"]) or "then" not in r:
            return bad()
        return mk({"kind": "typed", "raw": raw, "type": "if", "conditions": _parse_conditions(r["if"], ctx), "then": parse_actions(r["then"], ctx),
                   "else": parse_actions(r["else"], ctx) if "else" in r else None})
    if "repeat" in r:
        rp = r["repeat"]
        if (not _only_keys(r, ["repeat"]) or not isinstance(rp, dict) or not all(k in ("count", "sequence") for k in rp) or not is_number(rp.get("count"))
                or float(rp["count"]) != int(rp["count"]) or rp["count"] < 1):
            return bad()
        return mk({"kind": "typed", "raw": raw, "type": "repeat_count", "count": int(rp["count"]), "sequence": parse_actions(rp.get("sequence"), ctx)})
    if "delay" in r:
        if not _only_keys(r, ["delay"]):
            return bad()
        d = _parse_duration(r["delay"])
        if d is None or d is _INVALID:
            return bad()
        return mk({"kind": "typed", "raw": raw, "type": "delay", "delay": d})
    if "stop" in r:
        if not _only_keys(r, ["stop"]) or not isinstance(r["stop"], str):
            return bad()
        return mk({"kind": "typed", "raw": raw, "type": "stop", "message": r["stop"]})
    if isinstance(r.get("condition"), str) and "action" not in r and "service" not in r:
        c = parse_condition(raw, ctx)
        if c["kind"] == "locked":
            return {**c, "effects": "none"}
        return mk({"kind": "typed", "raw": raw, "type": "condition", "condition": c})
    if "type" in r and "device_id" in r and "domain" in r:
        return mk_locked(raw, "device", "action", ctx)
    svc = _service_of(r)
    if svc is None:
        return bad()  # variables, wait_*, parallel, sequence, event, scene ... : known, not typed
    if not isinstance(svc, str):
        return _locked_for(raw, "action", ctx, "unknown")
    if has_template(raw):
        return mk_locked(raw, "template", "action", ctx)
    if not _only_keys(r, ["action", "service", "target", "data", "entity_id"]):
        return bad()
    cls = classify_action(svc, ctx)
    if not cls.ok:
        return mk_locked(raw, cls.reason or "unknown", "action", ctx)
    ids: list[str] | None = []
    if "target" in r:
        if not isinstance(r["target"], dict) or any(k != "entity_id" for k in r["target"]):
            return bad()
        ids = _entity_list(r["target"].get("entity_id"))
    elif "entity_id" in r:
        ids = _entity_list(r["entity_id"])
    if ids is None:
        return bad()
    if "data" in r and not isinstance(r["data"], dict):
        return bad()
    data = _clone(r["data"]) if isinstance(r.get("data"), dict) else {}
    if "entity_id" in data or not pol.args_fit(svc, cls.role, data):
        return bad()
    script_call = cls.role == "script" and svc.split(".")[1] not in ("turn_on", "turn_off")
    return mk({"kind": "typed", "raw": raw, "type": "service", "action": svc, "entity_ids": [svc] if script_call else ids, "data": data, "role": cls.role})


def parse_actions(v: Any, ctx: ModelContext | None = None) -> list[Block]:
    ctx = ctx or ModelContext()
    return [parse_action(a, ctx) for a in _to_list(v)]


# ---------------------------------------------------------------- parse: items

AUTOMATION_MANAGED = ("id", "alias", "description", "triggers", "trigger", "conditions", "condition", "actions", "action", "mode", "max")
SCRIPT_MANAGED = ("alias", "description", "icon", "mode", "max", "fields", "sequence")
SCENE_MANAGED = ("id", "name", "icon", "entities")
_MANAGED = {"automation": AUTOMATION_MANAGED, "script": SCRIPT_MANAGED, "scene": SCENE_MANAGED}


@dataclass
class ReadResult:
    draft: dict[str, Any]
    extras: list[str] = field(default_factory=list)  # top-level keys the draft does not model (carried unchanged by the writer)
    legacy: bool = False  # the item uses the pre-2024.10 keys (rewritten in the new schema only when someone saves it)


def _mode_of(v: Any) -> str:
    return v if isinstance(v, str) and v in pol.MODES else "single"


def _max_of(v: Any) -> Any:
    return v if is_number(v) else None


def extra_keys(kind: str, config: Any) -> list[str]:
    return [k for k in config if k not in _MANAGED[kind]] if isinstance(config, dict) else []


def has_legacy_keys(v: Any) -> bool:
    """The pre-2024.10 keys anywhere inside a raw (`platform` for `trigger`, `service` for `action`, `data_template`): such a raw is rewritten in the
    new schema when its item is saved."""
    if isinstance(v, list):
        return any(has_legacy_keys(x) for x in v)
    if not isinstance(v, dict):
        return False
    if ("platform" in v and "trigger" not in v) or ("service" in v and "action" not in v) or "data_template" in v:
        return True
    return any(has_legacy_keys(x) for x in v.values())


def parse_selector(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or len(raw) != 1:
        return {"kind": "locked", "raw": raw}
    kind, cfg_raw = next(iter(raw.items()))
    cfg = cfg_raw if isinstance(cfg_raw, dict) else {} if cfg_raw is None else None
    if cfg is None:
        return {"kind": "locked", "raw": raw}
    if kind == "number":
        if is_number(cfg.get("min")) and is_number(cfg.get("max")):
            out: dict[str, Any] = {"kind": "number", "min": cfg["min"], "max": cfg["max"]}
            if is_number(cfg.get("step")):
                out["step"] = cfg["step"]
            if isinstance(cfg.get("unit_of_measurement"), str):
                out["unit"] = cfg["unit_of_measurement"]
            return out
        return {"kind": "locked", "raw": raw}
    if kind == "boolean":
        return {"kind": "boolean"}
    if kind == "select":
        opts = cfg.get("options")
        return {"kind": "select", "options": list(opts)} if isinstance(opts, list) and all(isinstance(o, str) for o in opts) and not cfg.get("multiple") else {"kind": "locked", "raw": raw}
    if kind == "text":
        return {"kind": "text", **({"max": cfg["maxlength"]} if is_number(cfg.get("maxlength")) else {})}
    if kind == "entity":
        d = [] if "domain" not in cfg else _to_list(cfg["domain"])
        return {"kind": "entity", "domains": list(d)} if all(isinstance(x, str) for x in d) and not cfg.get("multiple") and not cfg.get("integration") else {"kind": "locked", "raw": raw}
    return {"kind": "locked", "raw": raw}


def selector_out(sel: Mapping[str, Any], base: Any = None) -> Any:
    """The Home Assistant selector for a typed one; `base` (the stored selector) keeps the keys the draft does not model (`mode`, `translation_key` ...)."""
    if sel["kind"] == "locked":
        return sel["raw"]
    inner: Raw = {}
    if isinstance(base, dict) and base and isinstance(next(iter(base.values())), dict) and next(iter(base)) == sel["kind"]:
        inner = dict(next(iter(base.values())))
    k = sel["kind"]
    if k == "number":
        out = {**inner, "min": sel["min"], "max": sel["max"]}
        if "step" in sel:
            out["step"] = sel["step"]
        if "unit" in sel:
            out["unit_of_measurement"] = sel["unit"]
        return {"number": out}
    if k == "boolean":
        return {"boolean": inner}
    if k == "select":
        return {"select": {**inner, "options": list(sel["options"])}}
    if k == "text":
        return {"text": {**inner, **({"maxlength": sel["max"]} if "max" in sel else {})}}
    d = sel.get("domains") or []
    return {"entity": {**inner, **({"domain": d[0] if len(d) == 1 else list(d)} if d else {})}}


def _parse_fields(v: Any) -> list[dict[str, Any]]:
    if not isinstance(v, dict):
        return []
    out = []
    for key, f in v.items():
        o = f if isinstance(f, dict) else {}
        item: dict[str, Any] = {"key": key, "name": o["name"] if isinstance(o.get("name"), str) else key, "required": o.get("required") is True}
        if "default" in o:
            item["default"] = o["default"]
        item["selector"] = parse_selector(o.get("selector"))
        out.append(item)
    return out


def _parse_members(v: Any) -> list[dict[str, Any]]:
    if not isinstance(v, dict):
        return []
    out = []
    for entity_id, val in v.items():
        if isinstance(val, dict):
            attrs = {k: x for k, x in val.items() if k != "state"}
            st = val.get("state")
            out.append({"entity_id": entity_id, "state": "" if st is None else _state_text(st), "attributes": attrs})
        else:
            out.append({"entity_id": entity_id, "state": "" if val is None else _state_text(val), "attributes": {}})
    return out


def _state_text(v: Any) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def config_to_draft(kind: str, config: Any, ctx: ModelContext | None = None) -> ReadResult:
    """Reads a stored item (JSON) into the draft model. Legacy keys (`trigger`, `platform`, `service`) are normalised in memory only."""
    ctx = ctx or ModelContext()
    c: Raw = _clone(config) if isinstance(config, dict) else {}  # the raws of the blocks never alias the caller's config
    if kind == "automation":
        legacy = any(k in c for k in ("trigger", "condition", "action")) or has_legacy_keys(c)
        trig = c.get("triggers") if c.get("triggers") is not None else c.get("trigger")
        cond = c.get("conditions") if c.get("conditions") is not None else c.get("condition")
        act = c.get("actions") if c.get("actions") is not None else c.get("action")
        draft = {"alias": c["alias"] if isinstance(c.get("alias"), str) else "", "description": c["description"] if isinstance(c.get("description"), str) else "",
                 "mode": _mode_of(c.get("mode")), "max": _max_of(c.get("max")), "triggers": [parse_trigger(t, ctx) for t in _to_list(trig)],
                 "conditions": _parse_conditions(cond, ctx), "actions": parse_actions(act, ctx)}
        return ReadResult(draft, extra_keys("automation", c), legacy)
    if kind == "script":
        draft = {"alias": c["alias"] if isinstance(c.get("alias"), str) else "", "description": c["description"] if isinstance(c.get("description"), str) else "",
                 "icon": c["icon"] if isinstance(c.get("icon"), str) else None, "mode": _mode_of(c.get("mode")), "max": _max_of(c.get("max")),
                 "fields": _parse_fields(c.get("fields")), "sequence": parse_actions(c.get("sequence"), ctx)}
        return ReadResult(draft, extra_keys("script", c), has_legacy_keys(c))
    draft = {"name": c["name"] if isinstance(c.get("name"), str) else "", "icon": c["icon"] if isinstance(c.get("icon"), str) else None, "members": _parse_members(c.get("entities"))}
    return ReadResult(draft, extra_keys("scene", c), False)


# ---------------------------------------------------------------- write

def _build_trigger(b: Block) -> Raw:
    out: Raw = {}
    t = b["type"]
    if t == "state":
        out["trigger"], out["entity_id"] = "state", list(b["entity_ids"])
        if "from" in b:
            out["from"] = b["from"]
        if "to" in b:
            out["to"] = b["to"]
        if b.get("for"):
            out["for"] = _dur_out(b["for"])
    elif t == "numeric_state":
        out["trigger"], out["entity_id"] = "numeric_state", list(b["entity_ids"])
        if b.get("above") is not None:
            out["above"] = b["above"]
        if b.get("below") is not None:
            out["below"] = b["below"]
        if b.get("for"):
            out["for"] = _dur_out(b["for"])
    elif t == "time":
        out["trigger"], out["at"] = "time", _hms(b["at"])
    elif t == "time_pattern":
        out["trigger"] = "time_pattern"
        for k in ("hours", "minutes", "seconds"):
            if b.get(k) is not None:
                out[k] = b[k]
    elif t == "sun":
        out["trigger"], out["event"] = "sun", b["event"]
        if b.get("offset_min"):
            out["offset"] = _fmt_offset(b["offset_min"])
    elif t == "homeassistant":
        out["trigger"], out["event"] = "homeassistant", "start"
    else:
        raise ModelError("block_invalid", f"unknown trigger type {t!r}")
    if b.get("id"):
        out["id"] = b["id"]
    return out


def state_for_conflict(b: Mapping[str, Any]) -> bool:
    """A typed state condition that sets `for` AND names several entities or a list of states (rejected by Home Assistant 2026.10).
    Attributes cannot occur: the model has no attribute field (a raw condition with one stays a locked block)."""
    if b.get("type") != "state" or not b.get("for"):
        return False
    return len(b.get("entity_ids") or []) != 1 or not isinstance(b.get("state"), str)


def _build_condition(b: Block, ctx: ModelContext) -> Raw:
    t = b["type"]
    if t == "state":
        out: Raw = {"condition": "state", "entity_id": list(b["entity_ids"]), "state": b["state"]}
        if b.get("for"):
            out["for"] = _dur_out(b["for"])
            # Home Assistant 2026.10 rejects `for` combined with a state list or several entities: never emit it for a new or changed
            # block (a stored step that already carries it is passed through exactly as it was)
            if state_for_conflict(b) and canonical_json(out) != canonical_json(b.get("raw")):
                raise ModelError("state_for_conflict", "a state condition with `for` takes exactly one entity and one state")
        return out
    if t == "numeric_state":
        out = {"condition": "numeric_state", "entity_id": list(b["entity_ids"])}
        if b.get("above") is not None:
            out["above"] = b["above"]
        if b.get("below") is not None:
            out["below"] = b["below"]
        return out
    if t == "time":
        out = {"condition": "time"}
        if b.get("after"):
            out["after"] = _hms(b["after"])
        if b.get("before"):
            out["before"] = _hms(b["before"])
        if b.get("weekday"):
            out["weekday"] = list(b["weekday"])
        return out
    if t == "sun":
        out = {"condition": "sun"}
        if b.get("after"):
            out["after"] = b["after"]
        if b.get("before"):
            out["before"] = b["before"]
        return out
    if t == "trigger":
        return {"condition": "trigger", "id": list(b["ids"])}
    if t in ("and", "or", "not"):
        return {"condition": t, "conditions": [emit_block(c, "condition", ctx) for c in b["conditions"]]}
    if t == "shabbat":
        if not ctx.shabbat_sensor:
            raise ModelError("shabbat_sensor_missing", "no Shabbat sensor is configured")
        return {"condition": "state", "entity_id": [ctx.shabbat_sensor], "state": "on" if b["mode"] == "only_holy_days" else "off"}
    raise ModelError("block_invalid", f"unknown condition type {t!r}")


def _build_action(b: Block, ctx: ModelContext) -> Raw:
    t = b["type"]

    def seq(lst: Iterable[Block]) -> list[Any]:
        return [emit_block(x, "action", ctx) for x in lst]

    if t == "service":
        out: Raw = {"action": b["action"]}
        script_call = b.get("role") == "script" and bool(b["entity_ids"]) and b["action"] == b["entity_ids"][0]
        if b["entity_ids"] and not script_call:
            out["target"] = {"entity_id": list(b["entity_ids"])}
        if b.get("data"):
            out["data"] = _clone(b["data"])
        return out
    if t == "delay":
        return {"delay": _dur_out(b["delay"])}
    if t == "choose":
        out = {"choose": [{"conditions": [emit_block(c, "condition", ctx) for c in o["conditions"]], "sequence": seq(o["sequence"])} for o in b["options"]]}
        if b.get("default"):
            out["default"] = seq(b["default"])
        return out
    if t == "if":
        out = {"if": [emit_block(c, "condition", ctx) for c in b["conditions"]], "then": seq(b["then"])}
        if b.get("else"):
            out["else"] = seq(b["else"])
        return out
    if t == "repeat_count":
        return {"repeat": {"count": b["count"], "sequence": seq(b["sequence"])}}
    if t == "condition":
        return emit_block(b["condition"], "condition", ctx)
    if t == "stop":
        return {"stop": b["message"]}
    raise ModelError("block_invalid", f"unknown action type {t!r}")


def _reparse(raw: Any, section: str, ctx: ModelContext) -> Block:
    return parse_trigger(raw, ctx) if section == "trigger" else parse_condition(raw, ctx) if section == "condition" else parse_action(raw, ctx)


def _plain_ctx(ctx: ModelContext) -> ModelContext:
    """The context for the internal comparison parses: no names, no uids that burn the counter, no template text."""
    return ModelContext(allowed_actions=ctx.allowed_actions, shabbat_sensor=ctx.shabbat_sensor, template_text=False, uid=lambda: "_")


def emit_block(block: Block, section: str, ctx: ModelContext | None = None) -> Any:
    """One block as the stored form (CR section 6.2): a locked block is its `raw` untouched; a typed block whose fields still equal the ones parsed from its
    `raw` is that `raw` untouched; a changed or new typed block is rebuilt in the new schema (the stored `alias` / `metadata` carried)."""
    ctx = ctx or ModelContext()
    if block.get("kind") == "locked":
        return block.get("raw")

    def build(b: Block) -> Raw:
        return _build_trigger(b) if section == "trigger" else _build_condition(b, ctx) if section == "condition" else _build_action(b, ctx)

    built = build(block)
    raw = block.get("raw")
    if raw is None:
        return built
    orig = _reparse(raw, section, _plain_ctx(ctx))
    if orig["kind"] == "typed" and not has_legacy_keys(raw) and canonical_json(build(orig)) == canonical_json(built):
        return raw
    out: Raw = {"alias": raw["alias"], **built} if isinstance(raw, dict) and raw.get("alias") is not None else built
    if isinstance(raw, dict) and "metadata" in raw and "metadata" not in out:
        out["metadata"] = raw["metadata"]
    return out


_NEW_KEY = {"trigger": "triggers", "condition": "conditions", "action": "actions"}


def _order_like(stored: Mapping[str, Any] | None, managed: list[tuple[str, Any]], has_key: Callable[[str], bool]) -> Raw:
    """Orders `managed` like the stored item when there is one (so an untouched item is byte-identical), else Home Assistant's order."""
    out: Raw = {}
    mmap = dict(managed)
    if stored:
        for k in stored:
            nk = _NEW_KEY.get(k, k)
            if nk in mmap and nk not in out:
                if has_key(nk):
                    out[nk] = mmap[nk]
                continue
            if nk not in mmap and k not in out:
                out[k] = _clone(stored[k])
    for k, v in managed:
        if k not in out and has_key(k):
            out[k] = v
    return out


def draft_to_config(kind: str, draft: Mapping[str, Any], stored: Any = None, ctx: ModelContext | None = None, item_id: str | None = None) -> Raw:
    """Writes a draft back as the stored item. `stored` (the item as it is stored, if any) supplies the key order, the unknown top-level keys
    (carried unchanged) and the fields the draft does not model. `item_id` = the config id of a new item (else the stored one)."""
    ctx = ctx or ModelContext()
    st: Mapping[str, Any] | None = stored if isinstance(stored, dict) else None

    def has(k: str) -> bool:
        return bool(st) and (k in st or (k == "triggers" and "trigger" in st) or (k == "conditions" and "condition" in st) or (k == "actions" and "action" in st))

    item_id = item_id if item_id is not None else (st["id"] if st and isinstance(st.get("id"), str) else None)
    if kind == "automation":
        d = draft
        managed = [("id", item_id), ("alias", d["alias"]), ("description", d["description"]), ("triggers", [emit_block(t, "trigger", ctx) for t in d["triggers"]]),
                   ("conditions", [emit_block(c, "condition", ctx) for c in d["conditions"]]), ("actions", [emit_block(a, "action", ctx) for a in d["actions"]]),
                   ("mode", d["mode"]), ("max", d.get("max"))]

        def keep_a(k: str) -> bool:
            if k == "id":
                return item_id is not None
            if k == "description":
                return d["description"] != "" or not st or has(k)
            if k == "conditions":
                return len(d["conditions"]) > 0 or not st or has(k)
            if k == "mode":
                return d["mode"] != "single" or not st or has(k)
            if k == "max":
                return d.get("max") is not None
            return True

        return _clone(_order_like(st, managed, keep_a))
    if kind == "script":
        d = draft
        stored_fields = st["fields"] if st and isinstance(st.get("fields"), dict) else {}
        fields: Raw = {}
        for f in d["fields"]:
            base = stored_fields.get(f["key"]) if isinstance(stored_fields.get(f["key"]), dict) else {}
            keep = base.get("selector") is not None and canonical_json(parse_selector(base["selector"])) == canonical_json(f["selector"])
            item = {**base, "name": f["name"]}
            if f.get("required") or "required" in base:
                item["required"] = bool(f.get("required"))
            if "default" in f:
                item["default"] = f["default"]
            item["selector"] = base["selector"] if keep else selector_out(f["selector"], base.get("selector"))
            fields[f["key"]] = item
        managed = [("alias", d["alias"]), ("description", d["description"]), ("icon", d.get("icon")), ("mode", d["mode"]), ("max", d.get("max")), ("fields", fields),
                   ("sequence", [emit_block(a, "action", ctx) for a in d["sequence"]])]

        def keep_s(k: str) -> bool:
            if k == "description":
                return d["description"] != "" or not st or has(k)
            if k == "icon":
                return d.get("icon") is not None
            if k == "mode":
                return d["mode"] != "single" or not st or has(k)
            if k == "max":
                return d.get("max") is not None
            if k == "fields":
                return len(d["fields"]) > 0 or has(k)
            return True

        return _clone(_order_like(st, managed, keep_s))
    d = draft
    stored_ent = st["entities"] if st and isinstance(st.get("entities"), dict) else {}
    entities: Raw = {}
    for m in d["members"]:
        prev = stored_ent.get(m["entity_id"])
        entities[m["entity_id"]] = prev if isinstance(prev, str) and not m["attributes"] and prev == m["state"] else {"state": m["state"], **_clone(m["attributes"])}
    managed = [("id", item_id), ("name", d["name"]), ("icon", d.get("icon")), ("entities", entities)]

    def keep_c(k: str) -> bool:
        if k == "id":
            return item_id is not None
        if k == "icon":
            return d.get("icon") is not None
        return True

    return _clone(_order_like(st, managed, keep_c))


def to_new_schema(kind: str, config: Mapping[str, Any], ctx: ModelContext | None = None) -> Raw:
    """A config (a legacy item, or content typed in the code view) in the new schema: typed blocks rebuilt, locked ones and unknown keys untouched."""
    return draft_to_config(kind, config_to_draft(kind, config, ctx).draft, config, ctx)


# ---------------------------------------------------------------- walking blocks

def child_lists(b: Block) -> list[tuple[str, list[Block], str]]:
    """(path segment, blocks, section) of the child lists of a block (`choose.0.conditions`, `then` ...)."""
    if b.get("kind") != "typed":
        return []
    t = b.get("type")
    if t in ("and", "or", "not") and "conditions" in b and "entity_ids" not in b:
        return [("conditions", b["conditions"], "condition")]
    if t == "choose":
        out: list[tuple[str, list[Block], str]] = []
        for i, o in enumerate(b["options"]):
            out.append((f"choose.{i}.conditions", o["conditions"], "condition"))
            out.append((f"choose.{i}.sequence", o["sequence"], "action"))
        if b.get("default") is not None:
            out.append(("default", b["default"], "action"))
        return out
    if t == "if":
        out = [("if", b["conditions"], "condition"), ("then", b["then"], "action")]
        if b.get("else") is not None:
            out.append(("else", b["else"], "action"))
        return out
    if t == "repeat_count":
        return [("repeat.sequence", b["sequence"], "action")]
    return []


@dataclass
class Walked:
    block: Block
    section: str
    path: str
    depth: int


def walk_draft(draft: Mapping[str, Any]) -> list[Walked]:
    """Every block of a draft (containers before their children) with its dotted path (`actions.1.choose.0.sequence.2`) and nesting depth."""
    out: list[Walked] = []

    def visit(blocks: list[Block], section: str, prefix: str, depth: int) -> None:
        for i, b in enumerate(blocks):
            path = f"{prefix}.{i}"
            out.append(Walked(b, section, path, depth))
            for name, kids, sec in child_lists(b):
                visit(kids, sec, f"{path}.{name}", depth + 1)
            if b.get("kind") == "typed" and b.get("type") == "condition":
                out.append(Walked(b["condition"], "condition", f"{path}.condition", depth + 1))

    if "triggers" in draft:
        visit(draft["triggers"], "trigger", "triggers", 0)
        visit(draft["conditions"], "condition", "conditions", 0)
        visit(draft["actions"], "action", "actions", 0)
    elif "sequence" in draft:
        visit(draft["sequence"], "action", "sequence", 0)
    return out


_SINGULAR = {"trigger": "triggers", "condition": "conditions", "action": "actions"}


def normalise_path(p: str) -> str:
    """A server issue path (`actions[1]`, `action/1/choose/0`, `actions.1`) in the dotted form of `walk_draft`."""
    t = [x for x in re.split(r"[./\[\]]+", p) if x]
    if t and t[0] in _SINGULAR:
        t[0] = _SINGULAR[t[0]]
    return ".".join(t)


def block_at_path(draft: Mapping[str, Any], path: str) -> Block | None:
    want = normalise_path(path)
    best: Walked | None = None
    for w in walk_draft(draft):
        if (want == w.path or want.startswith(f"{w.path}.")) and (best is None or len(w.path) > len(best.path)):
            best = w
    return best.block if best else None


def find_block(draft: Mapping[str, Any], uid: str) -> Block | None:
    return next((w.block for w in walk_draft(draft) if w.block.get("uid") == uid), None)


def locked_blocks(draft: Mapping[str, Any]) -> list[Block]:
    return [w.block for w in walk_draft(draft) if w.block.get("kind") == "locked"]


def true_fingerprint(b: Block) -> str:
    """The fingerprint of a locked block computed from its `raw` (never the claimed `fingerprint` of a draft that came from a client)."""
    return fingerprint_of(b.get("raw"))


def preserved_fingerprints(draft: Mapping[str, Any]) -> list[str]:
    """The fingerprints the bridge's `preserved` list carries (CR section 8.2): every locked block of the draft, computed from its raw."""
    return list(dict.fromkeys(true_fingerprint(b) for b in locked_blocks(draft)))


def changed_locked_blocks(draft: Mapping[str, Any], stored: Mapping[str, Any] | None) -> list[Block]:
    """Locked blocks of `draft` that are not (by fingerprint of their raw) a locked block of the stored item: 403 `locked_block_changed` unless the save is
    a code save."""
    known = {true_fingerprint(b) for b in locked_blocks(stored)} if stored else set()
    return [b for b in locked_blocks(draft) if true_fingerprint(b) not in known]


def save_profile(draft: Mapping[str, Any], stored: Mapping[str, Any] | None) -> str:
    """The write profile derived from the CONTENT (CR section 4.5): every locked block is one of the stored item's -> `builder` (delegation applies);
    else `code` (HA administrator)."""
    return "code" if changed_locked_blocks(draft, stored) else "builder"


# ---------------------------------------------------------------- sentences

def refresh_sentences(draft: dict[str, Any], ctx: ModelContext | None = None) -> dict[str, Any]:
    """Recomputes `sentence` on every block of a draft (after names are known or a block changed); mutates and returns it."""
    for w in walk_draft(draft):
        w.block["sentence"] = block_sentence(w.block, w.section, ctx)
    return draft


def block_sentences(draft: Mapping[str, Any], ctx: ModelContext | None = None) -> dict[str, str]:
    """`uid -> sentence` for a draft (the preview's `block_sentences`)."""
    return {w.block["uid"]: block_sentence(w.block, w.section, ctx) for w in walk_draft(draft)}


# ---------------------------------------------------------------- draft facts: targets, effects, sensitive steps

def draft_targets(draft: Mapping[str, Any]) -> list[str]:
    """Entity ids the typed action blocks drive (services, scenes, scripts), recursively; locked blocks contribute their statically known effects."""
    out: dict[str, None] = {}
    for w in walk_draft(draft):
        if w.section != "action":
            continue
        b = w.block
        if b.get("kind") == "typed" and b.get("type") == "service":
            for e in b["entity_ids"]:
                out[e] = None
        elif b.get("kind") == "locked" and isinstance(b.get("effects"), list):
            for e in b["effects"]:
                out[e] = None
    for m in draft.get("members") or []:
        out[m["entity_id"]] = None
    return list(out)


def trigger_entities(draft: Mapping[str, Any]) -> list[str]:
    """Entity ids the triggers watch (state / numeric_state)."""
    out: dict[str, None] = {}
    for t in draft.get("triggers") or []:
        if t.get("kind") == "typed" and "entity_ids" in t:
            for e in t["entity_ids"]:
                out[e] = None
    return list(out)


def condition_entities(draft: Mapping[str, Any]) -> list[str]:
    out: dict[str, None] = {}
    for w in walk_draft(draft):
        if w.section == "condition" and w.block.get("kind") == "typed" and "entity_ids" in w.block:
            for e in w.block["entity_ids"]:
                out[e] = None
    return list(out)


def has_unknown_effects(draft: Mapping[str, Any]) -> bool:
    """Any locked ACTION with unknown effects (CR section 9.6: needs `confirm: true`, and installation-wide manage to run)."""
    return any(w.section == "action" and w.block.get("kind") == "locked" and w.block.get("effects") == "unknown" for w in walk_draft(draft))


def locked_count(draft: Mapping[str, Any]) -> int:
    return len(locked_blocks(draft))


def steps_of_draft(draft: Mapping[str, Any]) -> int:
    """The number of action steps of a draft, nested ones included (the cap of section 2.2 is 60)."""
    return sum(1 for w in walk_draft(draft) if w.section == "action")


def sensitive_steps(draft: Mapping[str, Any], class_of: Callable[[str], str | None] | None = None, has_grant: Callable[[str], bool] | None = None) -> list[dict[str, Any]]:
    """The sensitive calls of a draft with the grant each needs (the preview's `sensitive_steps`). `class_of` = the catalogue's entity class."""
    out: list[dict[str, Any]] = []
    for w in walk_draft(draft):
        b = w.block
        if w.section != "action" or b.get("kind") != "typed" or b.get("type") != "service" or b.get("role") != "device":
            continue
        for eid in b["entity_ids"] or [""]:
            cls = pol.sensitive_class_of(b["action"], (class_of(eid) if class_of and eid else None))
            if cls:
                grant = pol.GRANT_OF_CLASS[cls]
                out.append({"path": w.path, "entity_id": eid, "action": b["action"], "grant": grant, "granted": has_grant(grant) if has_grant else True})
    return out


def sensitive_classes(draft: Mapping[str, Any], class_of: Callable[[str], str | None] | None = None) -> list[str]:
    """The sensitive classes touched (typed steps, and locked steps whose service is sensitive), in a stable order."""
    seen: dict[str, None] = {}
    for s in sensitive_steps(draft, class_of):
        cls = pol.sensitive_class_of(s["action"], class_of(s["entity_id"]) if class_of and s["entity_id"] else None)
        if cls:
            seen[cls] = None
    for b in locked_blocks(draft):
        svc = _service_of(b["raw"]) if isinstance(b.get("raw"), dict) else None
        if b.get("sensitive") and isinstance(svc, str):
            cls = pol.sensitive_class_of(svc)
            if cls:
                seen[cls] = None
    return [c for c in pol.SENSITIVE_CLASSES if c in seen]


def controls_schedules(b: Block) -> bool:
    """A locked block that controls schedules (`scheduler.*`): the builder shows the chip "שולט בתזמונים" (CR section 5)."""
    if b.get("kind") != "locked" or b.get("reason") != "custom_service" or not isinstance(b.get("raw"), dict):
        return False
    svc = _service_of(b["raw"])
    return isinstance(svc, str) and svc.startswith("scheduler.")


def block_is_sensitive(b: Block, class_of: Callable[[str], str | None] | None = None) -> bool:
    if b.get("kind") == "locked":
        return bool(b.get("sensitive"))
    if b.get("type") != "service" or b.get("role") != "device":
        return False
    return any(pol.sensitive_class_of(b["action"], class_of(e) if class_of and e else None) is not None for e in (b["entity_ids"] or [""]))


# ---------------------------------------------------------------- secrets in drafts (API answers carry masked raws; saves restore the stored ones)

def mask_draft(draft: Mapping[str, Any]) -> dict[str, Any]:
    """A deep copy that is safe to put in an API answer: the `raw` of every block (and of the locked selector of a script field) has every secret-like value
    replaced by the mask. Fingerprints stay the ones of the REAL raw; `masked` is set on a locked block that held one."""
    out = _clone(dict(draft))
    for w in walk_draft(out):
        b = w.block
        if b.get("raw") is not None and secret_kind(b["raw"]):
            b["raw"] = mask_secrets(b["raw"])
            if b.get("kind") == "locked":
                b["masked"] = True
                b["template_text"] = None
    for f in out.get("fields") or []:
        if f.get("selector", {}).get("kind") == "locked" and secret_kind(f["selector"].get("raw")):
            f["selector"]["raw"] = mask_secrets(f["selector"]["raw"])
    return out


def unmask_draft(draft: Mapping[str, Any], stored: Mapping[str, Any] | None) -> dict[str, Any]:
    """The inverse of `mask_draft` for a draft that came back from a client: a block whose raw holds the mask gets the stored raw it was masked from
    (a locked block: the stored locked block with the same fingerprint; a typed container: the stored block whose masked raw is equal). A block that
    cannot be matched keeps the mask - the caller treats a mask in a raw as `masked_values` (422) and never writes it."""
    out = _clone(dict(draft))
    if not stored:
        return out
    stored_blocks = [w.block for w in walk_draft(stored)]
    by_fp = {true_fingerprint(b): b["raw"] for b in stored_blocks if b.get("kind") == "locked"}
    by_masked = {canonical_json(mask_secrets(b["raw"])): b["raw"] for b in stored_blocks if b.get("kind") == "typed" and b.get("raw") is not None and secret_kind(b["raw"])}
    for w in walk_draft(out):
        b = w.block
        if b.get("raw") is None or not has_mask(b["raw"]):
            continue
        if b.get("kind") == "locked":
            real = by_fp.get(b.get("fingerprint", ""))
            if real is not None:
                b["raw"], b["masked"] = _clone(real), True
        else:
            real = by_masked.get(canonical_json(b["raw"]))
            if real is not None:
                b["raw"] = _clone(real)
    return out


def config_has_mask(config: Any) -> bool:
    """A mask inside a config that is about to be written (it was never unmasked): never written."""
    return has_mask(config)


# ---------------------------------------------------------------- validation (section 2.2 caps)

def _issue(path: str, code: str, message: str) -> dict[str, str]:
    return {"path": path, "code": code, "message": message}


CODE_NOT_ALLOWED_TEXT = "אסור לשמור קוד סודי בתוך אוטומציה, סצנה או סקריפט."
ACTION_NOT_ALLOWED_TEXT = "הפעולה אינה מותרת כאן."
SCENE_CAPTURE_DOMAINS = ("light", "switch", "fan", "cover", "climate", "media_player", "lock")


def block_changed(block: Block, section: str, ctx: ModelContext | None = None) -> bool:
    """Whether a typed block differs from the stored form it carries in `raw` (a new block has none): only a new or changed block is judged by the argument,
    required-value and notify rules, so an old step of a stored item stays saveable."""
    if block.get("kind") == "locked" or block.get("raw") is None:
        return block.get("kind") != "locked"
    try:
        return canonical_json(emit_block(block, section, ctx)) != canonical_json(block["raw"])
    except ModelError:
        return True


def validate_draft(kind: str, draft: Mapping[str, Any], *, notify_targets: Iterable[str] | None = None, shabbat_sensor: str | None = None,
                   allowed_actions: Iterable[str] | None = None) -> list[dict[str, str]]:
    """Validation of a draft with the caps of section 2.2 (the issues carry the dotted block path of `walk_draft`). A typed block that still equals its
    stored `raw` is not re-judged by the argument and notify rules (an old step stays saveable). Pure: permissions, scope and Home Assistant's own
    validation are the caller's."""
    out: list[dict[str, str]] = []
    allowed = list(allowed_actions) if allowed_actions is not None else None
    vctx = ModelContext(shabbat_sensor=shabbat_sensor, allowed_actions=allowed)
    notify = list(notify_targets) if notify_targets is not None else None
    if kind == "scene":
        d = draft
        if not d["name"].strip():
            out.append(_issue("name", "alias_required", "תנו שם"))
        elif len(d["name"]) > pol.CAPS["alias_max"]:
            out.append(_issue("name", "alias_too_long", f"שם ארוך מדי (עד {pol.CAPS['alias_max']} תווים)"))
        if not d["members"]:
            out.append(_issue("members", "members_required", "הוסיפו מכשיר"))
        if len(d["members"]) > pol.CAPS["members_max"]:
            out.append(_issue("members", "too_many_members", f"עד {pol.CAPS['members_max']} מכשירים בסצנה"))
        for i, m in enumerate(d["members"]):
            dom = m["entity_id"].split(".")[0]
            if dom == "alarm_control_panel" or dom not in SCENE_CAPTURE_DOMAINS:
                out.append(_issue(f"members.{i}", "domain_not_allowed", "סוג המכשיר אינו נתמך בסצנה"))
            if not m["state"]:
                out.append(_issue(f"members.{i}", "state_required", "בחרו מצב"))
            if secret_kind(m["attributes"]):
                out.append(_issue(f"members.{i}", "code_not_allowed", "אסור לשמור קוד סודי"))
        return out
    d = draft
    alias = d["alias"]
    if not alias.strip():
        out.append(_issue("alias", "alias_required", "תנו שם"))
    elif len(alias) > pol.CAPS["alias_max"]:
        out.append(_issue("alias", "alias_too_long", f"שם ארוך מדי (עד {pol.CAPS['alias_max']} תווים)"))
    if len(d["description"]) > pol.CAPS["description_max"]:
        out.append(_issue("description", "description_too_long", f"תיאור ארוך מדי (עד {pol.CAPS['description_max']} תווים)"))
    steps = d["actions"] if kind == "automation" else d["sequence"]
    walked = walk_draft(draft)
    step_path = "actions" if kind == "automation" else "sequence"
    if kind == "automation":
        if not d["triggers"]:
            out.append(_issue("triggers", "trigger_required", "הוסיפו לפחות טריגר אחד"))
        if len(d["triggers"]) > pol.CAPS["triggers_max"]:
            out.append(_issue("triggers", "too_many_triggers", f"עד {pol.CAPS['triggers_max']} טריגרים"))
        if len(d["conditions"]) > pol.CAPS["conditions_max"]:
            out.append(_issue("conditions", "too_many_conditions", f"עד {pol.CAPS['conditions_max']} תנאים"))
    elif len(d["fields"]) > pol.CAPS["fields_max"]:
        out.append(_issue("fields", "too_many_fields", f"עד {pol.CAPS['fields_max']} שדות"))
    if not steps:
        out.append(_issue(step_path, "action_required", "הוסיפו לפחות פעולה אחת"))
    if sum(1 for w in walked if w.section == "action") > pol.CAPS["steps_max"]:
        out.append(_issue(step_path, "too_many_steps", f"עד {pol.CAPS['steps_max']} צעדים בסך הכל"))
    deep = next((w for w in walked if w.section == "action" and w.depth > pol.CAPS["depth_max"]), None)
    if deep:
        out.append(_issue(deep.path, "too_deep", f"עד {pol.CAPS['depth_max']} רמות של שילוב"))
    if len(set(draft_targets(draft))) > pol.CAPS["targets_max"]:
        out.append(_issue(step_path, "too_many_targets", f"עד {pol.CAPS['targets_max']} מכשירים"))

    def trigger_id(t: Block) -> str | None:
        if t.get("kind") == "typed":
            return t.get("id")
        raw = t.get("raw")
        return raw["id"] if isinstance(raw, dict) and isinstance(raw.get("id"), str) else None

    trigger_ids: set[str] = set()
    if kind == "automation":
        seen: set[str] = set()
        for i, t in enumerate(d["triggers"]):
            tid = trigger_id(t)
            if tid:
                if tid in seen:
                    out.append(_issue(f"triggers.{i}", "duplicate_trigger_id", "מזהה הטריגר כבר בשימוש"))
                seen.add(tid)
        trigger_ids = seen
    for w in walked:
        b = w.block
        if b.get("kind") == "locked":
            continue
        fresh = block_changed(b, w.section, vctx)

        def need(cond: bool, code: str, msg: str, _p: str = w.path) -> None:
            if cond:
                out.append(_issue(_p, code, msg))

        if w.section == "trigger":
            need(b["type"] in ("state", "numeric_state") and not b["entity_ids"], "entity_required", "בחרו מכשיר")
            if b["type"] == "numeric_state":
                need(b.get("above") is None and b.get("below") is None, "value_required", "הגדירו ערך")
            if b["type"] == "time":
                need(not pol.TIME_RE.match(b["at"]), "time_required", "בחרו שעה")
            if b["type"] == "time_pattern":
                need(all(b.get(k) is None for k in ("hours", "minutes", "seconds")), "pattern_required", "הגדירו מחזור")
        elif w.section == "condition":
            t = b["type"]
            if t in ("state", "numeric_state"):
                need(not b["entity_ids"], "entity_required", "בחרו מכשיר")
            if t == "numeric_state":
                need(b.get("above") is None and b.get("below") is None, "value_required", "הגדירו ערך")
            if t == "state":
                need(fresh and state_for_conflict(b), "state_for_conflict", "תנאי עם \"במשך\" תומך במכשיר אחד ובמצב אחד בלבד")
            if t == "time":
                need((bool(b.get("after")) and not pol.TIME_RE.match(b["after"])) or (bool(b.get("before")) and not pol.TIME_RE.match(b["before"])), "time_invalid", "שעה לא תקינה")
            if t == "shabbat":
                need(not shabbat_sensor, "shabbat_sensor_missing", "לא הוגדר חיישן שבת")
            if t == "trigger":
                need(not b["ids"], "trigger_id_required", "בחרו טריגר")
                need(any(i not in trigger_ids for i in b["ids"]), "trigger_id_unknown", "הטריגר אינו קיים")
            if t in ("and", "or", "not"):
                need(not b["conditions"], "conditions_required", "הוסיפו תנאי")
        else:
            t = b["type"]
            if t == "service":
                if fresh:
                    for p in pol.check_arguments(b["action"], b.get("role"), b.get("data") or {}):
                        if p["code"] == "code_not_allowed":
                            need(True, "code_not_allowed", CODE_NOT_ALLOWED_TEXT)
                        elif p["code"] == "secret_not_allowed":
                            need(True, "secret_not_allowed", "אסור לשמור ערך חסוי")
                        elif p["code"] == "argument_not_allowed":
                            need(True, "argument_not_allowed", f"ארגומנט לא מאושר: {p['arg']}")
                        elif p["code"] == "required":
                            need(True, "argument_required", f"חסר ערך: {p['arg']}")
                        elif p["code"] == "argument_conflict":
                            need(True, "argument_conflict", f"אי אפשר לשלב את {p['arg']} עם ערך אחר")
                        else:
                            need(True, "argument_invalid", f"ערך לא תקין: {p['arg']}")
                need(b.get("role") == "device" and not b["entity_ids"], "entity_required", "בחרו מכשיר")
                need(b.get("role") in ("scene", "script", "automation") and len(b["entity_ids"]) != 1, "entity_required", "בחרו פריט")
                cls = pol.classify_action(b["action"], allowed)
                need(not cls.ok, "action_not_allowed", ACTION_NOT_ALLOWED_TEXT)
                if b.get("role") == "notify" and fresh:
                    msg = (b.get("data") or {}).get("message")
                    need(not isinstance(msg, str) or not msg.strip(), "message_required", "כתבו הודעה")
                    need(notify is not None and b["action"] not in notify, "notify_target_not_allowed", "יעד התראה לא מאושר")
            elif t == "delay":
                need(not any(b["delay"].get(k) for k in ("hours", "minutes", "seconds")), "duration_required", "הגדירו משך")
            elif t == "choose":
                need(not b["options"], "option_required", "הוסיפו ענף")
                need(len(b["options"]) > pol.CAPS["choose_options_max"], "too_many_options", f"עד {pol.CAPS['choose_options_max']} ענפים")
            elif t == "if":
                need(not b["conditions"], "conditions_required", "הוסיפו תנאי")
                need(not b["then"], "action_required", "הוסיפו לפחות פעולה אחת")
            elif t == "repeat_count":
                need(not isinstance(b["count"], int) or b["count"] < 1 or b["count"] > 1000, "count_invalid", "מספר חזרות לא תקין")
    if kind == "script":
        keys: set[str] = set()
        for i, f in enumerate(d["fields"]):
            p = f"fields.{i}"
            if not re.match(r"^[a-z_][a-z0-9_]*$", f["key"]):
                out.append(_issue(p, "field_key_invalid", "מפתח שדה: אותיות לטיניות קטנות, ספרות וקו תחתון"))
            if f["key"] in keys:
                out.append(_issue(p, "duplicate_field_key", "מפתח שדה כפול"))
            keys.add(f["key"])
            if not f["name"].strip():
                out.append(_issue(p, "alias_required", "תנו שם לשדה"))
            sel = f["selector"]
            if sel["kind"] == "number" and not sel["min"] < sel["max"]:
                out.append(_issue(p, "range_invalid", "הטווח לא תקין"))
            if sel["kind"] == "select" and not sel["options"]:
                out.append(_issue(p, "options_required", "הוסיפו אפשרויות"))
    return out


def issues_by_uid(draft: Mapping[str, Any], issues: Iterable[Mapping[str, str]]) -> dict[str, list[Mapping[str, str]]]:
    out: dict[str, list[Mapping[str, str]]] = {}
    for i in issues:
        b = block_at_path(draft, i["path"])
        out.setdefault(b["uid"] if b else "", []).append(i)
    return out


# ---------------------------------------------------------------- one call for the server: everything known about a stored config

def describe(kind: str, config: Any, ctx: ModelContext | None = None, class_of: Callable[[str], str | None] | None = None) -> dict[str, Any]:
    """A stored config as the server needs it for lists and details: the draft, its sentence, facts (targets, trigger entities, sensitive classes, locked
    count, unknown effects, secrets) and the revision. The draft is NOT masked (use `mask_draft` before it leaves the server)."""
    ctx = ctx or ModelContext()
    res = config_to_draft(kind, config, ctx)
    d = res.draft
    return {
        "draft": d, "extras": res.extras, "legacy": res.legacy, "sentence": draft_sentence(kind, d, ctx), "revision": revision_of(config),
        "targets": draft_targets(d), "trigger_entities": trigger_entities(d) if kind == "automation" else [], "condition_entities": condition_entities(d) if kind == "automation" else [],
        "locked_count": locked_count(d), "unknown_effects": has_unknown_effects(d) if kind != "scene" else False,
        "sensitive_classes": sensitive_classes(d, class_of) if kind != "scene" else [], "has_secrets": secret_kind(config) is not None,
        "schedule_controls": any(controls_schedules(b) for b in locked_blocks(d)) if kind != "scene" else False,
    }
