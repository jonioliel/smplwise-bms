"""CR-017 §4.2.6 (owner decision 9ג): "למה זה רץ?" - the full trace of a run as Home Assistant stores it (`trace/list`, `trace/get`), turned into the
contract's `RunSummary` / `RunTrace` (docs/architecture/AUTOMATIONS_API.md §2.4). Pure: names, sentences and the display name of a context user come in as
callables. Secret-like values are masked ("••••") wherever they are; user ids and context ids never leave (the context user is a DISPLAY NAME). The step
shape of `trace/get` on 2026.9 is U-7 (unverified): everything here is read defensively - a missing key is an empty value, never an error."""
from __future__ import annotations

import datetime as dt
from typing import Any, Callable

from . import automation_policy as pol
from .timeutil import parse_utc

_DROP_KEYS = frozenset({"user_id", "parent_id", "context_id", "context", "refresh_token_id"})
RESULTS = {"finished": "ok", "error": "error", "aborted": "stopped", "cancelled": "stopped", "failed_conditions": "not_triggered", "failed_single": "not_triggered",
           "failed_max_runs": "not_triggered", "failed_disabled": "not_triggered", "failed_unknown_reason": "error"}


def sanitize(value: Any, depth: int = 0) -> Any:
    """A copy without context / user ids and with secret-like values masked."""
    if depth > 12:
        return None
    if isinstance(value, dict):
        return {k: (pol.MASK if pol.is_secret_key(k) else sanitize(v, depth + 1)) for k, v in value.items() if k not in _DROP_KEYS}
    if isinstance(value, list):
        return [sanitize(v, depth + 1) for v in value[:200]]
    if isinstance(value, str):
        return value[:2000]
    return value


def _iso(value: Any) -> str | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return parse_utc(value).astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except ValueError:
        return None


def _ms(a: Any, b: Any) -> int | None:
    try:
        return max(0, int((parse_utc(b) - parse_utc(a)).total_seconds() * 1000))
    except (TypeError, ValueError):
        return None


def run_result(entry: dict[str, Any]) -> str:
    state = entry.get("state")
    exe = entry.get("script_execution")
    if state == "running" or (exe is None and not (entry.get("timestamp") or {}).get("finish")):
        return "running"
    return RESULTS.get(str(exe), "ok")


def describe_trigger(description: str | None, name_of: Callable[[str], str]) -> str:
    """HA's trigger description ("state of binary_sensor.x", "time", ...) in Hebrew."""
    d = (description or "").strip()
    if not d:
        return "הפעלה"
    for prefix, fmt in (("state of ", "שינוי ב־{}"), ("numeric state of ", "שינוי ערך ב־{}"), ("template", None)):
        if d.startswith(prefix):
            rest = d[len(prefix):].strip()
            return fmt.format(name_of(rest) if rest else "") if fmt else "תבנית"
    words = {"time": "שעה קבועה", "time pattern": "דפוס זמן", "sun": "שמש", "homeassistant": "הפעלת המערכת", "event": "אירוע", "webhook": "קריאה חיצונית", "zone": "אזור", "mqtt": "הודעה", "manual": "הרצה ידנית"}
    for k, v in words.items():
        if d == k or d.startswith(k + " "):
            return v
    return d[:60]


def local_time(stamp: str | None, tz: Any) -> str:
    if not stamp:
        return ""
    try:
        return parse_utc(stamp).astimezone(tz).strftime("%H:%M")
    except ValueError:
        return ""


def summary(entry: dict[str, Any], name_of: Callable[[str], str], tz: Any) -> dict[str, Any]:
    """One `RunSummary` out of a `trace/list` entry."""
    ts = entry.get("timestamp") if isinstance(entry.get("timestamp"), dict) else {}
    at = _iso(ts.get("start"))
    result = run_result(entry)
    desc = describe_trigger(entry.get("trigger") if isinstance(entry.get("trigger"), str) else None, name_of)
    when = local_time(at, tz)
    sentence = f"רצה ב־{when} · {desc}" if when else f"רצה · {desc}"
    if result == "error":
        sentence += " · נעצרה בשגיאה"
    elif result == "not_triggered":
        sentence += " · התנאים לא התקיימו"
    return {"run_id": str(entry.get("run_id") or ""), "at": at or "", "finished_at": _iso(ts.get("finish")), "result": result, "sentence": sentence}


def _depth(path: str) -> int:
    return max(0, (len(path.split("/")) - 2) // 2)


def detail(entry: dict[str, Any], *, step_paths: list[str], sentences: dict[str, str], name_of: Callable[[str], str], tz: Any, user_name: Callable[[str | None], str | None]) -> dict[str, Any]:
    """One `RunTrace` out of a `trace/get` answer. `step_paths` are the config's action steps in document order (every one of them is listed, `not_run` when
    the run never reached it); `sentences` maps a block path (HA trace path) to its Hebrew sentence."""
    ts = entry.get("timestamp") if isinstance(entry.get("timestamp"), dict) else {}
    trace = entry.get("trace") if isinstance(entry.get("trace"), dict) else {}
    at, finish = _iso(ts.get("start")), _iso(ts.get("finish"))
    result = run_result(entry)
    base = summary(entry, name_of, tz)
    elements: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for path, items in trace.items():
        if not isinstance(items, list) or not items:
            continue
        first = items[0] if isinstance(items[0], dict) else {}
        elements[str(path)] = {"first": first, "all": [i for i in items if isinstance(i, dict)]}
        order.append(str(path))
    # the trigger
    trig_path = next((p for p in order if p.startswith("trigger/")), "trigger/0")
    trig_el = elements.get(trig_path, {}).get("first", {})
    changed = trig_el.get("changed_variables") if isinstance(trig_el.get("changed_variables"), dict) else {}
    trig_var = changed.get("trigger") if isinstance(changed.get("trigger"), dict) else {}
    trigger_desc = trig_var.get("description") if isinstance(trig_var.get("description"), str) else (entry.get("trigger") if isinstance(entry.get("trigger"), str) else None)
    trig_sentence = sentences.get(trig_path) or describe_trigger(trigger_desc, name_of)
    # conditions: every element whose result is a condition verdict (top level, inside choose / if, or a condition step)
    conditions: list[dict[str, Any]] = []
    for p in order:
        first = elements[p]["first"]
        res = first.get("result")
        is_condition_path = p.startswith("condition/") or "/conditions/" in p or "/if/" in p
        if is_condition_path and isinstance(res, dict) and "result" in res:
            conditions.append({"path": p, "sentence": sentences.get(p) or "תנאי", "passed": bool(res["result"])})
    for p in order:  # a condition used as a step: its sentence comes from the block, its verdict from the result
        first = elements[p]["first"]
        res = first.get("result")
        if (p.startswith("action/") or p.startswith("sequence/")) and not ("/conditions/" in p or "/if/" in p) and isinstance(res, dict) and set(res) <= {"result", "entities"} and "result" in res:
            if not any(c["path"] == p for c in conditions):
                conditions.append({"path": p, "sentence": sentences.get(p) or "תנאי", "passed": bool(res["result"])})
    # steps: the config's own order, every step listed
    stamps = [(p, elements[p]["first"].get("timestamp")) for p in order]
    steps: list[dict[str, Any]] = []
    listed: set[str] = set()
    extra_paths = [p for p in order if (p.startswith("action/") or p.startswith("sequence/")) and p not in step_paths]
    for p in list(step_paths) + extra_paths:
        el = elements.get(p)
        if el is None:
            steps.append({"path": p, "depth": _depth(p), "sentence": sentences.get(p, ""), "result": "not_run", "started_at": None, "duration_ms": None, "error": None, "changed_variables": None})
            continue
        first = el["first"]
        started = _iso(first.get("timestamp"))
        nxt = next((s for q, s in stamps[[q for q, _ in stamps].index(p) + 1:] if s), None) if p in [q for q, _ in stamps] else None
        dur = _ms(first.get("timestamp"), nxt or ts.get("finish")) if started else None
        err = first.get("error") if isinstance(first.get("error"), str) else None
        res = "error" if err else ("running" if (result == "running" and p == entry.get("last_step")) else "done")
        cv = first.get("changed_variables")
        steps.append({"path": p, "depth": _depth(p), "sentence": sentences.get(p, ""), "result": res, "started_at": started, "duration_ms": dur,
                      "error": (err[:300] if err else None), "changed_variables": sanitize(cv) if isinstance(cv, dict) and cv else None})
        listed.add(p)
    variables = sanitize({k: v for k, v in changed.items()}) if changed else None
    ctx = entry.get("context") if isinstance(entry.get("context"), dict) else {}
    user_id = ctx.get("user_id") if isinstance(ctx.get("user_id"), str) else None
    parent = "user" if user_id else ("automation" if ctx.get("parent_id") else "system")
    when = local_time(at, tz)
    bits = [f"רצה ב־{when} כי {trig_sentence}" if when else f"רצה כי {trig_sentence}"]
    for c in conditions[:3]:
        bits.append(f"התנאי '{c['sentence']}' {'עבר' if c['passed'] else 'לא עבר'}")
    done = [s["sentence"] for s in steps if s["result"] == "done" and s["sentence"] and s["depth"] == 0][:2]
    if done:
        bits.append("ביצעה: " + ", ".join(done))
    if result == "error":
        bits.append("נעצרה בשגיאה")
    return {"run_id": base["run_id"], "at": at or "", "finished_at": finish, "duration_ms": _ms(ts.get("start"), ts.get("finish")) if finish else None, "result": result,
            "sentence": "; ".join(bits), "trigger": {"sentence": trig_sentence, "path": trig_path, "description": trigger_desc}, "conditions": conditions, "steps": steps,
            "variables": variables, "context": {"user": user_name(user_id), "parent": parent}}
