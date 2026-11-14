"""XSCENARIO109-295 (docs/changes/CR-SCENARIO109.md sections 3, 4 and 17): the ONE condition model of cross-module scenarios.

Pure code: no database, no clock of its own (the caller passes `now`), no device. It owns
  * the closed definition format (`validate`): a boolean tree of leaves over typed signals, 1-3 actions from a closed set, options;
  * three-valued (Kleene) evaluation: every leaf is TRUE, FALSE or UNKNOWN, and UNKNOWN is never FALSE;
  * per-leaf hysteresis (numbers), debounce (booleans) and hold ("true continuously for N seconds"), with explicit state objects so the
    engine can persist them and a restart neither flaps nor re-fires.
The signal catalogue (ids, kinds, units, caps) lives in services/scenario_signals.py; this module receives it as `catalogue`.

The action set is closed: notify, create_service_request, set_flag. There is NO door, lock, alarm, siren, cover, gate, scene, script or
service-call action, and the validator refuses any other `type` (`scenario_forbidden_action`) - the first of the layers of section 6.1."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping, Protocol

TRUE, FALSE, UNKNOWN = "TRUE", "FALSE", "UNKNOWN"
SCHEMA_VERSION = 1

MAX_DEPTH = 4
MAX_LEAVES = 12
MAX_ACTIONS = 3
MAX_HOLD_S = 24 * 3600
MAX_DEBOUNCE_S = 3600
MAX_AGE_CAP_S = 24 * 3600

ACTIONS = ("notify", "create_service_request", "set_flag")  # closed: any other `type` is `scenario_forbidden_action`

COMPARISONS = {
    "bool": ("is_true", "is_false"),
    "number": ("gt", "ge", "lt", "le", "between", "outside", "eq", "ne"),
    "count": ("gt", "ge", "lt", "le", "eq", "ne"),
    "enum": ("eq", "ne", "in_set"),
}
ON_UNKNOWN = ("hold", "treat_as_false")
SEVERITIES = ("info", "alert", "critical")
FLAG_RE = re.compile(r"^[a-z][a-z0-9_]{1,39}$")
ID_RE = re.compile(r"^[A-Za-z0-9_.:\-]{1,120}$")
HHMM_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

OPTION_DEFAULTS: dict[str, Any] = {"cooldown_s": 900, "clear_after_s": 60, "for_s": 0, "on_unknown": "hold", "unknown_grace_s": 600}
OPTION_RANGES: dict[str, tuple[int, int]] = {"cooldown_s": (60, 7 * 86400), "clear_after_s": (0, 86400), "for_s": (0, MAX_HOLD_S),
                                             "unknown_grace_s": (0, 86400), "max_fires_per_day": (1, 1000), "max_tickets_per_day": (0, 200)}

MSG = {
    "unknown_key": "שדה לא מוכר.",
    "required": "שדה חובה.",
    "bad_type": "סוג הערך אינו תקין.",
    "bad_op": "פעולה לוגית לא מוכרת (וגם / או / לא).",
    "too_deep": f"עומק התנאים גדול מ-{MAX_DEPTH}.",
    "too_many_leaves": f"יותר מ-{MAX_LEAVES} תנאים בתרחיש אחד.",
    "empty_group": "קבוצת תנאים ריקה.",
    "unknown_signal": "האות אינו מוכר.",
    "bad_cmp": "ההשוואה אינה מתאימה לסוג האות.",
    "bad_value": "הערך אינו תקין לאות הזה.",
    "out_of_range": "הערך מחוץ לטווח המותר.",
    "bad_window": "חלון הזמן אינו תקין (ימים 0-6, שעה HH:MM).",
    "no_actions": "לתרחיש חייבת להיות לפחות פעולה אחת.",
    "too_many_actions": f"עד {MAX_ACTIONS} פעולות בתרחיש.",
    "scenario_forbidden_action": "תרחיש אינו יכול להפעיל דלת, מנעול, אזעקה, סצנה או התקן. הפעולות המותרות: הודעה, בקשת שירות וסימון.",
    "bad_flag": "שם סימון: אותיות לטיניות קטנות, ספרות וקו תחתון (2-40).",
    "bad_option": "אפשרות לא תקינה.",
    "bad_recipients": "נמענים לא תקינים.",
}


class Clock(Protocol):
    def now(self) -> dt.datetime: ...


class SystemClock:
    def now(self) -> dt.datetime:
        return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


@dataclass(frozen=True)
class SignalSpec:
    id: str
    module: str
    kind: str                       # bool | number | count | enum
    label: str                      # Hebrew
    unit: str = ""
    max_age_s: int = 900            # a reading older than this is UNKNOWN; a leaf may tighten it, never loosen it
    subject: str = "none"           # none | temperature_unit | door_sensor | area | flag | window
    enum_values: tuple[str, ...] = ()
    value_range: tuple[float, float] | None = None
    default_margin: float = 0.0     # hysteresis margin of numeric leaves (temperature 0.5 C)
    default_debounce_s: int = 0     # boolean leaves (door sensors 10 s)
    label_en: str = ""


@dataclass
class Reading:
    value: Any = None
    state: str = "unknown"          # ok | unknown | stale | unavailable
    as_of: str | None = None
    reason: str | None = None       # module_off | no_value | stale | not_permitted | provider_error | ...


@dataclass
class LeafState:
    raw: str = UNKNOWN
    since: str | None = None        # when `raw` last changed
    debounced: str = UNKNOWN
    held_since: str | None = None
    hyst: str | None = None         # "on" while a numeric threshold is armed

    def to_json(self) -> dict[str, Any]:
        return {"raw": self.raw, "since": self.since, "debounced": self.debounced, "held_since": self.held_since, "hyst": self.hyst}

    @classmethod
    def of(cls, d: Mapping[str, Any] | None) -> "LeafState":
        d = d or {}
        def tv(x: Any) -> str:
            return x if x in (TRUE, FALSE, UNKNOWN) else UNKNOWN
        return cls(raw=tv(d.get("raw")), since=d.get("since"), debounced=tv(d.get("debounced")), held_since=d.get("held_since"),
                   hyst=d.get("hyst") if d.get("hyst") in ("on", "off") else None)


@dataclass
class Problem:
    path: str
    code: str

    def as_dict(self) -> dict[str, str]:
        return {"path": self.path, "code": self.code, "message": MSG.get(self.code, self.code)}


@dataclass
class Validated:
    definition: dict[str, Any]
    leaves: list[tuple[str, dict[str, Any]]] = field(default_factory=list)
    flags_read: set[str] = field(default_factory=set)
    flags_written: set[str] = field(default_factory=set)


# ---------------------------------------------------------------- time helpers

def iso(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse(text: str | None) -> dt.datetime | None:
    if not text:
        return None
    try:
        v = dt.datetime.fromisoformat(str(text).replace("Z", "+00:00"))
    except ValueError:
        return None
    return v if v.tzinfo else v.replace(tzinfo=dt.timezone.utc)


def _secs(a: str | None, now: dt.datetime) -> float | None:
    t = parse(a)
    return None if t is None else (now - t).total_seconds()


def hhmm(v: str) -> int:
    h, m = v.split(":")
    return int(h) * 60 + int(m)


def in_window(local: dt.datetime, days: Iterable[int], start: str, end: str) -> bool:
    """Site-local window; `end` <= `start` wraps past midnight (the part after midnight belongs to the day the window started)."""
    dset = set(days)
    s, e, m = hhmm(start), hhmm(end), local.hour * 60 + local.minute
    wd = local.weekday()  # Monday 0 .. Sunday 6
    if s < e:
        return wd in dset and s <= m < e
    if s == e:  # a whole day
        return wd in dset
    return (wd in dset and m >= s) or (((wd - 1) % 7) in dset and m < e)


# ---------------------------------------------------------------- Kleene logic

def k_and(values: Iterable[str]) -> str:
    vs = list(values)
    if FALSE in vs:
        return FALSE
    if UNKNOWN in vs:
        return UNKNOWN
    return TRUE


def k_or(values: Iterable[str]) -> str:
    vs = list(values)
    if TRUE in vs:
        return TRUE
    if UNKNOWN in vs:
        return UNKNOWN
    return FALSE


def k_not(v: str) -> str:
    return {TRUE: FALSE, FALSE: TRUE}.get(v, UNKNOWN)


# ---------------------------------------------------------------- validation

def _num(v: Any) -> float | None:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    f = float(v)
    return f if f == f and abs(f) != float("inf") else None


def _int_in(v: Any, lo: int, hi: int) -> bool:
    return isinstance(v, int) and not isinstance(v, bool) and lo <= v <= hi


def _keys(d: Mapping[str, Any], allowed: set[str], path: str, out: list[Problem]) -> None:
    for k in d:
        if k not in allowed:
            out.append(Problem(f"{path}.{k}", "unknown_key"))


LEAF_KEYS = {"signal", "subject", "cmp", "value", "max_age_s", "hold_s", "hysteresis", "debounce_s", "window"}


def _check_leaf(leaf: dict[str, Any], path: str, cat: Mapping[str, SignalSpec], out: list[Problem]) -> None:
    _keys(leaf, LEAF_KEYS, path, out)
    spec = cat.get(leaf.get("signal")) if isinstance(leaf.get("signal"), str) else None
    if spec is None:
        out.append(Problem(f"{path}.signal", "unknown_signal"))
        return
    if spec.subject not in ("none", "window"):
        if not isinstance(leaf.get("subject"), str) or not ID_RE.match(leaf["subject"]):
            out.append(Problem(f"{path}.subject", "required"))
    elif "subject" in leaf and leaf["subject"] not in (None, ""):
        out.append(Problem(f"{path}.subject", "bad_value"))
    if spec.subject == "window":
        w = leaf.get("window")
        ok = isinstance(w, dict) and set(w) <= {"days", "from", "to"} and isinstance(w.get("days"), list) and 0 < len(w["days"]) <= 7 \
            and all(_int_in(d, 0, 6) for d in w["days"]) and len(set(w["days"])) == len(w["days"]) \
            and isinstance(w.get("from"), str) and HHMM_RE.match(w["from"]) and isinstance(w.get("to"), str) and HHMM_RE.match(w["to"])
        if not ok:
            out.append(Problem(f"{path}.window", "bad_window"))
    elif "window" in leaf:
        out.append(Problem(f"{path}.window", "unknown_key"))
    cmp_ = leaf.get("cmp")
    if cmp_ not in COMPARISONS[spec.kind]:
        out.append(Problem(f"{path}.cmp", "bad_cmp"))
        return
    v = leaf.get("value")
    lo, hi = spec.value_range or (-1e9, 1e9)
    if cmp_ in ("is_true", "is_false"):
        if "value" in leaf and v is not None:
            out.append(Problem(f"{path}.value", "bad_value"))
    elif cmp_ in ("between", "outside"):
        if not (isinstance(v, list) and len(v) == 2 and all(_num(x) is not None for x in v) and float(v[0]) < float(v[1])):
            out.append(Problem(f"{path}.value", "bad_value"))
        elif not all(lo <= float(x) <= hi for x in v):
            out.append(Problem(f"{path}.value", "out_of_range"))
    elif cmp_ == "in_set":
        if not (isinstance(v, list) and 0 < len(v) <= len(spec.enum_values) and all(x in spec.enum_values for x in v)):
            out.append(Problem(f"{path}.value", "bad_value"))
    elif spec.kind == "enum":
        if v not in spec.enum_values:
            out.append(Problem(f"{path}.value", "bad_value"))
    else:
        f = _num(v)
        if f is None or (spec.kind == "count" and (not isinstance(v, int) or v < 0)):
            out.append(Problem(f"{path}.value", "bad_value"))
        elif not lo <= f <= hi:
            out.append(Problem(f"{path}.value", "out_of_range"))
    if "max_age_s" in leaf and not _int_in(leaf["max_age_s"], 10, spec.max_age_s):
        out.append(Problem(f"{path}.max_age_s", "out_of_range"))
    if "hold_s" in leaf and not _int_in(leaf["hold_s"], 0, MAX_HOLD_S):
        out.append(Problem(f"{path}.hold_s", "out_of_range"))
    if "debounce_s" in leaf:
        if spec.kind != "bool" or not _int_in(leaf["debounce_s"], 0, MAX_DEBOUNCE_S):
            out.append(Problem(f"{path}.debounce_s", "out_of_range"))
    if "hysteresis" in leaf:
        h = leaf["hysteresis"]
        ok = spec.kind in ("number", "count") and cmp_ in ("gt", "ge", "lt", "le") and isinstance(h, dict) and set(h) == {"clear_margin"} \
            and _num(h["clear_margin"]) is not None and 0 <= float(h["clear_margin"]) <= max(1.0, (hi - lo) / 2)
        if not ok:
            out.append(Problem(f"{path}.hysteresis", "bad_value"))


def _walk(node: Any, path: str, depth: int, cat: Mapping[str, SignalSpec], out: list[Problem], leaves: list[tuple[str, dict[str, Any]]]) -> None:
    if not isinstance(node, dict):
        out.append(Problem(path, "bad_type"))
        return
    if "op" in node:
        if depth >= MAX_DEPTH:
            out.append(Problem(path, "too_deep"))
            return
        op = node["op"]
        if op in ("and", "or"):
            _keys(node, {"op", "items"}, path, out)
            items = node.get("items")
            if not isinstance(items, list) or not items:
                out.append(Problem(f"{path}.items", "empty_group"))
                return
            for i, it in enumerate(items):
                _walk(it, f"{path}.items[{i}]", depth + 1, cat, out, leaves)
        elif op == "not":
            _keys(node, {"op", "item"}, path, out)
            _walk(node.get("item"), f"{path}.item", depth + 1, cat, out, leaves)
        else:
            out.append(Problem(f"{path}.op", "bad_op"))
        return
    leaves.append((path, node))
    _check_leaf(node, path, cat, out)


def _check_action(a: Any, path: str, out: list[Problem], v: Validated) -> None:
    if not isinstance(a, dict) or not isinstance(a.get("type"), str):
        out.append(Problem(path, "bad_type"))
        return
    t = a["type"]
    if t not in ACTIONS:
        out.append(Problem(f"{path}.type", "scenario_forbidden_action"))
        return
    if t == "notify":
        _keys(a, {"type", "to", "severity"}, path, out)
        to = a.get("to", {})
        ok = isinstance(to, dict) and set(to) <= {"users", "roles"} and all(
            isinstance(to.get(k, []), list) and len(to.get(k, [])) <= 50 and all(isinstance(x, str) and ID_RE.match(x) for x in to.get(k, []))
            for k in ("users", "roles"))
        if not ok:
            out.append(Problem(f"{path}.to", "bad_recipients"))
        if "severity" in a and a["severity"] not in SEVERITIES:
            out.append(Problem(f"{path}.severity", "bad_value"))
    elif t == "create_service_request":
        _keys(a, {"type", "department_id", "priority_key", "title"}, path, out)
        if not isinstance(a.get("department_id"), str) or not ID_RE.match(a["department_id"]):
            out.append(Problem(f"{path}.department_id", "required"))
        if "priority_key" in a and a["priority_key"] is not None and (not isinstance(a["priority_key"], str) or not ID_RE.match(a["priority_key"])):
            out.append(Problem(f"{path}.priority_key", "bad_value"))
        if "title" in a and (not isinstance(a["title"], str) or not 0 < len(a["title"].strip()) <= 200):
            out.append(Problem(f"{path}.title", "bad_value"))
    else:  # set_flag
        _keys(a, {"type", "flag", "value"}, path, out)
        if not isinstance(a.get("flag"), str) or not FLAG_RE.match(a["flag"]):
            out.append(Problem(f"{path}.flag", "bad_flag"))
        else:
            v.flags_written.add(a["flag"])
        if not isinstance(a.get("value"), bool):
            out.append(Problem(f"{path}.value", "bad_value"))


def validate(definition: Any, catalogue: Mapping[str, SignalSpec]) -> tuple[Validated | None, list[dict[str, str]]]:
    """The closed format, server side. (Validated, []) or (None, [{path, code, message}]) with Hebrew messages."""
    out: list[Problem] = []
    if not isinstance(definition, dict):
        return None, [Problem("", "bad_type").as_dict()]
    _keys(definition, {"when", "actions", "options"}, "", out)
    v = Validated(definition=definition)
    if "when" not in definition:
        out.append(Problem("when", "required"))
    else:
        _walk(definition["when"], "when", 0, catalogue, out, v.leaves)
        if len(v.leaves) > MAX_LEAVES:
            out.append(Problem("when", "too_many_leaves"))
    acts = definition.get("actions")
    if not isinstance(acts, list) or not acts:
        out.append(Problem("actions", "no_actions"))
    elif len(acts) > MAX_ACTIONS:
        out.append(Problem("actions", "too_many_actions"))
    else:
        for i, a in enumerate(acts):
            _check_action(a, f"actions[{i}]", out, v)
    opts = definition.get("options", {})
    if not isinstance(opts, dict):
        out.append(Problem("options", "bad_type"))
    else:
        for k, val in opts.items():
            if k == "on_unknown":
                if val not in ON_UNKNOWN:
                    out.append(Problem(f"options.{k}", "bad_option"))
            elif k in OPTION_RANGES:
                lo, hi = OPTION_RANGES[k]
                if not _int_in(val, lo, hi):
                    out.append(Problem(f"options.{k}", "out_of_range"))
            else:
                out.append(Problem(f"options.{k}", "unknown_key"))
    for path, leaf in v.leaves:
        if leaf.get("signal") == "flag.value" and isinstance(leaf.get("subject"), str):
            v.flags_read.add(leaf["subject"])
    if out:
        return None, [p.as_dict() for p in out]
    return v, []


def options_of(definition: Mapping[str, Any]) -> dict[str, Any]:
    return {**OPTION_DEFAULTS, **(definition.get("options") or {})}


def canonical(definition: Any) -> str:
    return json.dumps(definition, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def definition_hash(definition: Any) -> str:
    return hashlib.sha256(canonical(definition).encode("utf-8")).hexdigest()[:32]


def flag_cycle(graph: Mapping[str, tuple[set[str], set[str]]], max_depth: int = 3) -> tuple[str | None, int]:
    """graph: rule id -> (flags read, flags written). Returns (a rule on a cycle or None, the longest chain length in rules).
    A rule B depends on rule A when B reads a flag A writes."""
    writers: dict[str, set[str]] = {}
    for rid, (_, written) in graph.items():
        for f in written:
            writers.setdefault(f, set()).add(rid)
    deps = {rid: {w for f in read for w in writers.get(f, set())} for rid, (read, _) in graph.items()}
    memo: dict[str, int] = {}
    visiting: set[str] = set()
    cyc: list[str] = []

    def depth(r: str) -> int:
        if r in memo:
            return memo[r]
        if r in visiting:
            cyc.append(r)
            return 10 ** 6
        visiting.add(r)
        d = 1 + max((depth(x) for x in deps.get(r, ())), default=0)
        visiting.discard(r)
        memo[r] = d
        return d

    longest = max((depth(r) for r in graph), default=0)
    return (cyc[0] if cyc else None), longest


# ---------------------------------------------------------------- evaluation

def compare(spec: SignalSpec, leaf: Mapping[str, Any], value: Any, hyst: str | None) -> tuple[str, str | None]:
    """(TRUE/FALSE, the new hysteresis state). The caller has already turned a missing / stale reading into UNKNOWN."""
    c = leaf["cmp"]
    if spec.kind == "bool" or c in ("is_true", "is_false"):
        if not isinstance(value, bool):
            return UNKNOWN, hyst
        return (TRUE if value == (c == "is_true") else FALSE), None
    if spec.kind == "enum":
        if c == "eq":
            return (TRUE if value == leaf["value"] else FALSE), None
        if c == "ne":
            return (TRUE if value != leaf["value"] else FALSE), None
        return (TRUE if value in leaf["value"] else FALSE), None
    x = _num(value)
    if x is None:
        return UNKNOWN, hyst
    t = leaf.get("value")
    if c == "between":
        return (TRUE if float(t[0]) <= x <= float(t[1]) else FALSE), None
    if c == "outside":
        return (TRUE if x < float(t[0]) or x > float(t[1]) else FALSE), None
    if c == "eq":
        return (TRUE if x == float(t) else FALSE), None
    if c == "ne":
        return (TRUE if x != float(t) else FALSE), None
    margin = float((leaf.get("hysteresis") or {}).get("clear_margin", spec.default_margin))
    armed = hyst == "on"
    t = float(t)
    if c in ("gt", "ge"):
        on = (x > t if c == "gt" else x >= t) or (armed and x > t - margin)
    else:
        on = (x < t if c == "lt" else x <= t) or (armed and x < t + margin)
    return (TRUE if on else FALSE), ("on" if on else "off")


@dataclass
class LeafResult:
    path: str
    signal: str
    subject: str | None
    value: Any
    unit: str
    reading_state: str
    reason: str | None
    as_of: str | None
    cmp: str
    target: Any
    raw: str
    result: str
    hold_s: int
    hold_progress_s: int | None

    def as_dict(self) -> dict[str, Any]:
        return dict(self.__dict__)


def step_leaf(spec: SignalSpec, leaf: Mapping[str, Any], reading: Reading, st: LeafState, now: dt.datetime, *, stateless: bool = False) -> tuple[str, LeafState, LeafResult]:
    """One leaf at `now`: freshness -> comparison (hysteresis) -> debounce -> hold. Returns (result, new state, snapshot row).
    `stateless` (a dry run of an unsaved definition): debounce and hold are reported, not waited for."""
    max_age = min(int(leaf.get("max_age_s", spec.max_age_s)), spec.max_age_s)
    age = _secs(reading.as_of, now) if reading.as_of else None
    reason = reading.reason
    if reading.state != "ok" or reading.value is None:
        raw, hyst = UNKNOWN, st.hyst
        reason = reason or "no_value"
    elif age is not None and age > max_age:
        raw, hyst = UNKNOWN, st.hyst
        reason = "stale"
    else:
        raw, hyst = compare(spec, leaf, reading.value, st.hyst)
    new = LeafState(raw=st.raw, since=st.since, debounced=st.debounced, held_since=st.held_since, hyst=hyst)
    nowi = iso(now)
    if raw != new.raw or new.since is None:
        new.raw, new.since = raw, nowi
    deb_s = int(leaf.get("debounce_s", spec.default_debounce_s)) if spec.kind == "bool" else 0
    if stateless or deb_s == 0 or raw == UNKNOWN or (_secs(new.since, now) or 0) >= deb_s:
        new.debounced = raw
    hold_s = int(leaf.get("hold_s", 0))
    progress: int | None = None
    if new.debounced == TRUE:
        if new.held_since is None:
            new.held_since = nowi
        progress = int(_secs(new.held_since, now) or 0)
        out = TRUE if (stateless or progress >= hold_s) else FALSE
    else:
        new.held_since = None  # FALSE or UNKNOWN restarts the hold
        out = new.debounced
    snap = LeafResult(path="", signal=spec.id, subject=leaf.get("subject"), value=reading.value, unit=spec.unit,
                      reading_state="stale" if reason == "stale" else reading.state, reason=reason if raw == UNKNOWN else None, as_of=reading.as_of, cmp=leaf["cmp"], target=leaf.get("value") if spec.subject != "window" else leaf.get("window"),
                      raw=raw, result=out, hold_s=hold_s, hold_progress_s=progress)
    return out, new, snap


def evaluate(node: Mapping[str, Any], catalogue: Mapping[str, SignalSpec], readings: Mapping[str, Reading], states: Mapping[str, LeafState],
             now: dt.datetime, path: str = "when", *, stateless: bool = False) -> tuple[str, dict[str, LeafState], list[dict[str, Any]]]:
    """The tree at `now`. readings / states are keyed by leaf path. Returns (TRUE/FALSE/UNKNOWN, new states, snapshot rows)."""
    new_states: dict[str, LeafState] = {}
    snaps: list[dict[str, Any]] = []

    def rec(n: Mapping[str, Any], p: str) -> str:
        op = n.get("op")
        if op in ("and", "or"):
            vals = [rec(it, f"{p}.items[{i}]") for i, it in enumerate(n["items"])]  # every leaf is evaluated: holds keep advancing
            return k_and(vals) if op == "and" else k_or(vals)
        if op == "not":
            return k_not(rec(n["item"], f"{p}.item"))
        spec = catalogue[n["signal"]]
        r, st, snap = step_leaf(spec, n, readings.get(p, Reading()), states.get(p, LeafState()), now, stateless=stateless)
        snap.path = p
        new_states[p] = st
        snaps.append(snap.as_dict())
        return r

    return rec(node, path), new_states, snaps


def leaves_of(node: Mapping[str, Any], path: str = "when") -> list[tuple[str, Mapping[str, Any]]]:
    out: list[tuple[str, Mapping[str, Any]]] = []
    op = node.get("op")
    if op in ("and", "or"):
        for i, it in enumerate(node["items"]):
            out.extend(leaves_of(it, f"{path}.items[{i}]"))
    elif op == "not":
        out.extend(leaves_of(node["item"], f"{path}.item"))
    else:
        out.append((path, node))
    return out
