"""MAPPING-IMPROVE-2351: the server's copy of the mapping assistant's resolution, for the background auto-insert job only.

The assistant itself runs in the browser (frontend/src/api/mapping-engine.ts, MAPPING-ASSIST-2330). With the setting `auto_insert` on, new
home-system names used to go in only when a configurer opened the settings page; services/mapping_auto.py now places them on every structure
refresh and at startup, so the server needs the same answer the browser would give. This module is a line-for-line port of the parts that
decide WHERE a name goes - the tokenizer, the token table, the ordered rules, the manual decisions, the floor inheritance, the plan and the
level answers ("קומות ללא מפלס") - and nothing else (no detection statistics, no suggestions, no questions). Pure: no database, no I/O.

Kept in step with the TypeScript by tests/test_mapping_improve_2351.py (the same cases as the frontend unit spec). Area labels come from the
label mirror (HA-LABELS-SYNC-2351, read by services/mapping_auto through routers/home_mapping._labels), the same names the browser reads.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

Target = dict[str, Any]  # {"t": "b", "id"} | {"t": "new", "name"} | {"t": "none"}

TOKEN_MAX = 12
POSITIONS = ("start", "end", "label", "word")
TOKEN_KINDS = ("letter", "number", "word", "any")
RULE_KINDS = ("table", "starts", "ends", "contains", "label", "regex")
DEFAULT_SPEC = {"position": "start", "seps": ["·", "-", ":"], "kind": "any", "marker": "בניין"}
TABLE_RULE = {"id": "table", "kind": "table", "value": "", "to": None, "on": True}
SETTINGS_DEFAULT = {"floor_inherit": "on", "auto_insert": "off", "new_token": "new_first"}
LEVEL_MIN, LEVEL_MAX = -50, 300


@dataclass
class Item:
    id: str
    kind: str  # floor | area
    name: str
    level: int | None = None
    floor_id: str | None = None
    labels: list[str] = field(default_factory=list)

    @property
    def key(self) -> str:
        return f"{'f' if self.kind == 'floor' else 'a'}:{self.id}"


@dataclass
class Res:
    to: Target | None
    src: str  # manual | rule | floor | none
    open: bool
    token: str | None = None
    sep: str = ""
    conflict: str | None = None


def same_target(a: Target | None, b: Target | None) -> bool:
    if not a or not b or a.get("t") != b.get("t"):
        return False
    if a["t"] == "b":
        return a.get("id") == b.get("id")
    if a["t"] == "new":
        return a.get("name") == b.get("name")
    return True


# ------------------------------------------------------------------------------------------------------------------------------- tokenizer

def _is_l(c: str) -> bool:
    return unicodedata.category(c).startswith("L")


def _is_n(c: str) -> bool:
    return unicodedata.category(c).startswith("N")


def kind_ok(token: str, kind: str) -> bool:
    if not token or len(token) > TOKEN_MAX:
        return False
    if kind == "letter":
        return len(token) == 1 and _is_l(token)
    if kind == "number":
        return 1 <= len(token) <= 4 and all(unicodedata.category(c) == "Nd" for c in token)
    if kind == "word":
        return (_is_l(token[0]) or _is_n(token[0])) and all(_is_l(c) or _is_n(c) or c in "'\"׳״_." for c in token[1:])
    return len(re.findall(r"\s+", token)) <= 1


def _sep_matches(name: str, sep: str) -> list[tuple[int, int]]:
    pat = re.compile(r"\s+") if sep == " " else re.compile(r"\s*" + re.escape(sep.strip() or sep) + r"\s*")
    out = []
    for m in pat.finditer(name):
        i, j = m.start(), m.end()
        if i == j:
            continue
        g = m.group(0)
        # a "-" that is a minus sign ("חניון -1": a space before, a digit after) is not a separator
        if sep.strip() == "-" and g[:1].isspace() and not g[-1:].isspace() and j < len(name) and name[j] in "0123456789":
            continue
        out.append((i, j))
    return out


def tokenize(name: str, labels: list[str] | None, spec: dict[str, Any]) -> tuple[str, str, str] | None:
    """(token, sep, rest) or None - frontend tokenize()."""
    name = (name or "").strip()
    if spec["position"] == "label":
        for lab in labels or []:
            t = lab.strip()
            if kind_ok(t, "any" if spec["kind"] == "any" else spec["kind"]) or (spec["kind"] == "any" and t and len(t) <= 40):
                return t, "", name
        return None
    if not name:
        return None
    if spec["position"] == "word":
        marker = (spec.get("marker") or "").strip()
        if not marker:
            return None
        m = re.search(r"(?:^|\s)" + re.escape(marker) + r"\s+(\S+)", name)
        if not m:
            return None
        token = m.group(1)
        if not kind_ok(token, "word" if spec["kind"] == "any" else spec["kind"]):
            return None
        rest = re.sub(r"\s+", " ", name[: m.start()] + name[m.end():]).strip()
        return token, "", rest or name
    cands = [(sep, i, j) for sep in spec["seps"] for (i, j) in _sep_matches(name, sep)]
    if spec["position"] == "start":
        cands.sort(key=lambda c: (c[1], -c[2]))
    else:
        cands.sort(key=lambda c: (-c[2], c[1]))
    for sep, i, j in cands:
        token = (name[:i] if spec["position"] == "start" else name[j:]).strip()
        rest = (name[j:] if spec["position"] == "start" else name[:i]).strip()
        if not rest or not kind_ok(token, spec["kind"]):
            continue
        return token, sep, rest
    return None


# ------------------------------------------------------------------------------------------------------------------------------- the table

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip().lower()


def building_for_token(token: str, buildings: list[dict[str, Any]]) -> dict[str, Any] | None:
    t = norm(token)
    if not t:
        return None

    def strip(n: str) -> str:
        return re.sub(r"^(בניין|מבנה|מגדל|building|tower)\s+", "", norm(n))

    return next((b for b in buildings if norm(b["name"]) == t), None) or next((b for b in buildings if strip(b["name"]) == t), None)


def table_target(token: str, state: dict[str, Any], buildings: list[dict[str, Any]]) -> Target | None:
    own = state["tokens"].get(token)
    if own:
        return own
    b = building_for_token(token, buildings)
    return {"t": "b", "id": b["id"]} if b else None


# ------------------------------------------------------------------------------------------------------------------------------- rules

def _hits(it: Item, state: dict[str, Any], buildings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rules = state["rules"] if state["advanced"] else [TABLE_RULE]
    name = it.name.strip()
    hits: list[dict[str, Any]] = []
    for r in rules:
        if not r["on"]:
            continue
        v = (r.get("value") or "").strip()
        k = r["kind"]
        if k == "table":
            t = tokenize(it.name, it.labels, state["spec"])
            if t:
                hits.append({"rule": r, "to": table_target(t[0], state, buildings), "token": t[0], "sep": t[1]})
        elif k == "starts":
            if v and name.startswith(v):
                hits.append({"rule": r, "to": r.get("to"), "token": None, "sep": ""})
        elif k == "ends":
            if v and name.endswith(v):
                hits.append({"rule": r, "to": r.get("to"), "token": None, "sep": ""})
        elif k == "contains":
            if v and v in name:
                hits.append({"rule": r, "to": r.get("to"), "token": None, "sep": ""})
        elif k == "label":
            if v and any(lab.strip() == v for lab in it.labels):
                hits.append({"rule": r, "to": r.get("to"), "token": None, "sep": ""})
        elif k == "regex":
            try:
                m = re.search(r["value"], name) if r.get("value") else None
            except re.error:
                m = None
            if not m:
                continue
            if r.get("to"):
                hits.append({"rule": r, "to": r["to"], "token": None, "sep": ""})
            elif m.re.groups >= 1 and m.group(1):
                hits.append({"rule": r, "to": table_target(m.group(1), state, buildings), "token": m.group(1), "sep": ""})
    return hits


def _label_target(it: Item, state: dict[str, Any], buildings: list[dict[str, Any]]) -> Target | None:
    for lab in it.labels:
        t = state["tokens"].get(lab.strip())
        if not t:
            b = building_for_token(lab, buildings)
            t = {"t": "b", "id": b["id"]} if b else None
        if t and t["t"] != "none":
            return t
    return None


def _by_rules(it: Item, state: dict[str, Any], buildings: list[dict[str, Any]]) -> Res:
    hits = _hits(it, state, buildings)
    first = next((h for h in hits if h["to"]), None)
    if not first:
        unknown = next((h for h in hits if h["token"] and not h["to"]), None)
        if unknown:
            return Res(to=None, src="none", open=True, token=unknown["token"], sep=unknown["sep"], conflict="unknown_token")
        return Res(to=None, src="none", open=True, conflict="no_mark")
    res = Res(to=first["to"], src="rule", open=False, token=first["token"], sep=first["sep"])
    other = next((h for h in hits if h is not first and h["to"] and not same_target(h["to"], first["to"])), None)
    if other:
        res.open, res.conflict = True, "rules"
    elif first["rule"]["kind"] != "label":
        lt = _label_target(it, state, buildings)
        if lt and not same_target(lt, first["to"]):
            res.open, res.conflict = True, "label"
    return res


def resolve(items: list[Item], state: dict[str, Any], buildings: list[dict[str, Any]], settings: dict[str, str], force_open: frozenset[str] = frozenset()) -> dict[str, Res]:
    """frontend resolve(). `force_open`: floor keys treated as undecided (a floor still waiting for its level), so their areas do not
    inherit from them."""
    out: dict[str, Res] = {}
    decisions = state["decisions"]
    for it in items:
        if it.kind != "floor":
            continue
        d = decisions.get(it.key)
        r = Res(to=d, src="manual", open=False) if d else _by_rules(it, state, buildings)
        if it.key in force_open:
            r = Res(to=r.to, src=r.src, open=True, token=r.token, sep=r.sep, conflict="level")
        out[it.key] = r
    for it in items:
        if it.kind != "area":
            continue
        d = decisions.get(it.key)
        if d:
            out[it.key] = Res(to=d, src="manual", open=False)
            continue
        r = _by_rules(it, state, buildings)
        fr = out.get(f"f:{it.floor_id}") if it.floor_id else None
        floor_to = fr.to if fr and not fr.open and fr.to and fr.to["t"] != "none" else None
        if r.src == "rule" and floor_to and not same_target(r.to, floor_to) and not r.conflict:
            r.open, r.conflict = True, "floor"
        elif r.src == "none" and floor_to and settings.get("floor_inherit") == "on" and r.conflict == "no_mark":
            out[it.key] = Res(to=floor_to, src="floor", open=False)
            continue
        out[it.key] = r
    return out


# ------------------------------------------------------------------------------------------------------------------------------- the plan

def level_from_name(s: str) -> int | None:
    if re.search(r"קרקע|lobby|ground", s, re.IGNORECASE):
        return 0
    m = re.search(r"(-?[0-9]{1,3})", s.replace("‎", ""))
    return int(m.group(1)) if m else None


def _token_rest(name: str, r: Res | None) -> str:
    if r and r.token:
        seps = [r.sep] if r.sep else ["·", "-", ":"]
        for pos in ("start", "end"):
            t = tokenize(name, None, {"position": pos, "seps": seps, "kind": "any", "marker": ""})
            if t and t[0] == r.token:
                return t[2]
    return name.strip()


def level_answer(raw: Any) -> dict[str, Any] | None:
    """A stored "קומות ללא מפלס" answer: {"t": "level", "level": n} | {"t": "floor", "id"} | {"t": "skip"} (frontend levelAnswerOf)."""
    if not isinstance(raw, dict):
        return None
    t = raw.get("t")
    if t == "level" and isinstance(raw.get("level"), int) and not isinstance(raw.get("level"), bool) and LEVEL_MIN <= raw["level"] <= LEVEL_MAX:
        return {"t": "level", "level": raw["level"]}
    if t == "floor" and isinstance(raw.get("id"), str) and raw["id"]:
        return {"t": "floor", "id": raw["id"]}
    if t == "skip":
        return {"t": "skip"}
    return None


def build_plan(items: list[Item], res: dict[str, Res], buildings: list[dict[str, Any]], our_floors: list[dict[str, Any]], links: dict[str, list[dict[str, Any]]],
               levels: dict[str, dict[str, Any]] | None = None, asked: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """frontend buildPlan(). `levels`: the answers of "קומות ללא מפלס" (platform floor id -> answer). `asked`, when given, collects every
    platform floor that has no level of its own nor in its name and would otherwise land on a NEW floor of level 0."""
    levels = levels or {}
    plan: dict[str, Any] = {"new_buildings": [], "new_floors": [], "floors": [], "areas": [], "items": [it.key for it in items]}
    new_b: dict[str, str] = {}
    bids = {b["id"] for b in buildings}

    def ref(t: Target) -> str | None:
        if t["t"] == "b":
            return t["id"] if t["id"] in bids else None
        if t["t"] == "new":
            same = next((b for b in buildings if norm(b["name"]) == norm(t["name"])), None)
            if same:
                return same["id"]
            k = new_b.get(t["name"])
            if not k:
                k = f"b{len(new_b) + 1}"
                new_b[t["name"]] = k
                plan["new_buildings"].append({"key": k, "name": t["name"]})
            return f"new:{k}"
        return None

    def floors_of(b: str) -> list[dict[str, Any]]:
        return [f for f in our_floors if f["building_id"] == b]

    floor_building = {f["id"]: f["building_id"] for f in our_floors}
    row_of = {r["ha_floor_id"]: r["floor_id"] for r in links.get("floors", [])}
    area_row = {r["area_id"]: r["floor_id"] for r in links.get("areas", [])}
    area_b = {r["area_id"]: r["building_id"] for r in links.get("buildings", [])}

    def new_floor_for(b: str, name: str, level: int) -> str:
        f = next((x for x in plan["new_floors"] if x["building"] == b and norm(x["name"]) == norm(name) and x["level"] == level), None)
        if not f:
            f = {"key": f"f{len(plan['new_floors']) + 1}", "building": b, "name": name, "level": level}
            plan["new_floors"].append(f)
        return f"new:{f['key']}"

    def ref_building_of(fref: str) -> str | None:
        if fref.startswith("new:"):
            return next((f["building"] for f in plan["new_floors"] if f"new:{f['key']}" == fref), None)
        return floor_building.get(fref)

    floor_out: dict[str, tuple[str | None, str | None]] = {}

    def pick_floor(b: str, hid: str, name: str, level: int | None) -> str:
        cur = row_of.get(hid)
        if cur and floor_building.get(cur) == b:
            return cur
        mine = [] if b.startswith("new:") else floors_of(b)
        rest = _token_rest(name, res.get(f"f:{hid}"))
        lv = level if level is not None else level_from_name(rest)
        if lv is None:
            a = levels.get(hid)
            same_name = [f for f in mine if norm(f["name"]) == norm(rest)]
            if not a and len(same_name) == 1:
                return same_name[0]["id"]
            if asked is not None:
                asked.append({"id": hid, "building": b, "rest": rest or name, "answer": a})
            if a and a["t"] == "floor" and floor_building.get(a["id"]) == b:
                return a["id"]
            if a and a["t"] == "level":
                lv = a["level"]
        same_level = [] if lv is None else [f for f in mine if f["level"] == lv]
        if len(same_level) == 1:
            return same_level[0]["id"]
        same_name = [f for f in mine if norm(f["name"]) == norm(rest)]
        if len(same_name) == 1:
            return same_name[0]["id"]
        return new_floor_for(b, rest or name, 0 if lv is None else lv)

    for it in items:
        if it.kind != "floor":
            continue
        r = res.get(it.key)
        if not r or r.open or not r.to:
            continue
        if r.to["t"] == "none":
            if it.id in row_of:
                plan["floors"].append({"ha_floor_id": it.id, "floor": None})
            floor_out[it.id] = (None, None)
            continue
        b = ref(r.to)
        if not b:
            continue
        f = pick_floor(b, it.id, it.name, it.level)
        plan["floors"].append({"ha_floor_id": it.id, "floor": f})
        floor_out[it.id] = (f, b)
    level_of = {x.id: x.level for x in items if x.kind == "floor"}
    for it in items:
        if it.kind != "area":
            continue
        r = res.get(it.key)
        if not r or r.open or not r.to:
            continue
        via_plan = floor_out.get(it.floor_id) if it.floor_id else None
        cur_row = row_of.get(it.floor_id) if it.floor_id else None
        via_floor = via_plan[1] if via_plan else (floor_building.get(cur_row) if cur_row else None)
        had_row = it.id in area_row
        had_b = it.id in area_b
        if r.to["t"] == "none":
            if r.src in ("manual", "rule"):
                plan["areas"].append({"area_id": it.id, "floor": None, "building": None})
            continue
        b = ref(r.to)
        if not b:
            continue
        if via_floor == b:
            row_floor = area_row.get(it.id)
            row_in_b = ref_building_of(row_floor) == b if row_floor else False
            if (had_row and not row_in_b) or had_b:
                plan["areas"].append({"area_id": it.id, "floor": "auto" if had_row and not row_in_b else "keep", "building": None})
            continue
        lv = level_of.get(it.floor_id) if it.floor_id else None
        mine = ([{"id": f"new:{f['key']}", "level": f["level"]} for f in plan["new_floors"] if f["building"] == b] if b.startswith("new:") else floors_of(b))
        same = [] if lv is None else [f for f in mine if f["level"] == lv]
        if len(same) == 1:
            plan["areas"].append({"area_id": it.id, "floor": same[0]["id"], "building": None})
        else:
            plan["areas"].append({"area_id": it.id, "floor": None if (via_floor or had_row) else "keep", "building": b})
    return plan


def subset_plan(plan: dict[str, Any], keys: set[str]) -> dict[str, Any]:
    """Only the rows of the given items, and only the new buildings / floors those rows still name (frontend subsetPlan)."""
    floors = [f for f in plan["floors"] if f"f:{f['ha_floor_id']}" in keys]
    areas = [a for a in plan["areas"] if f"a:{a['area_id']}" in keys]
    used_f = {f["floor"] for f in floors if f["floor"]} | {a["floor"] for a in areas if isinstance(a["floor"], str)}
    new_floors = [f for f in plan["new_floors"] if f"new:{f['key']}" in used_f]
    used_b = {f["building"] for f in new_floors} | {a["building"] for a in areas if a["building"]}
    new_buildings = [b for b in plan["new_buildings"] if f"new:{b['key']}" in used_b]
    return {**plan, "floors": floors, "areas": areas, "new_floors": new_floors, "new_buildings": new_buildings}


# ------------------------------------------------------------------------------------------------------------------------------- normalize

def _target(x: Any) -> Target | None:
    if not isinstance(x, dict):
        return None
    t = x.get("t")
    if t == "b" and isinstance(x.get("id"), str):
        return {"t": "b", "id": x["id"]}
    if t == "new" and isinstance(x.get("name"), str) and x["name"].strip():
        return {"t": "new", "name": x["name"].strip()[:120]}
    if t == "none":
        return {"t": "none"}
    return None


def state_of(raw: Any) -> dict[str, Any]:
    """frontend stateOf(): a stored state read back, unknown / broken fields falling back to the defaults."""
    s: dict[str, Any] = {"v": 1, "spec": {**DEFAULT_SPEC, "seps": list(DEFAULT_SPEC["seps"])}, "tokens": {}, "manual_tokens": [], "advanced": False,
                         "rules": [dict(TABLE_RULE)], "decisions": {}, "levels": {}}
    if not isinstance(raw, dict):
        return s
    sp = raw.get("spec") if isinstance(raw.get("spec"), dict) else {}
    seps = sp.get("seps")
    s["spec"] = {
        "position": sp.get("position") if sp.get("position") in POSITIONS else DEFAULT_SPEC["position"],
        "seps": [x for x in seps if isinstance(x, str) and 0 < len(x) <= 4][:8] if isinstance(seps, list) else list(DEFAULT_SPEC["seps"]),
        "kind": sp.get("kind") if sp.get("kind") in TOKEN_KINDS else DEFAULT_SPEC["kind"],
        "marker": sp.get("marker")[:20] if isinstance(sp.get("marker"), str) else DEFAULT_SPEC["marker"],
    }
    for k, v in (raw.get("tokens") or {}).items() if isinstance(raw.get("tokens"), dict) else []:
        t = _target(v)
        if t:
            s["tokens"][k] = t
    for k, v in (raw.get("decisions") or {}).items() if isinstance(raw.get("decisions"), dict) else []:
        t = _target(v)
        if t and isinstance(k, str) and re.match(r"^[fa]:", k):
            s["decisions"][k] = t
    for k, v in (raw.get("levels") or {}).items() if isinstance(raw.get("levels"), dict) else []:
        a = level_answer(v)
        if a and isinstance(k, str):
            s["levels"][k] = a
    s["advanced"] = raw.get("advanced") is True
    if isinstance(raw.get("rules"), list):
        rules = []
        for r in raw["rules"]:
            if not isinstance(r, dict) or r.get("kind") not in RULE_KINDS or not isinstance(r.get("id"), str):
                continue
            rules.append({"id": r["id"], "kind": r["kind"], "value": r["value"] if isinstance(r.get("value"), str) else "", "to": _target(r.get("to")), "on": r.get("on") is not False})
        if not any(r["kind"] == "table" for r in rules):
            rules.insert(0, dict(TABLE_RULE))
        s["rules"] = rules
    return s
