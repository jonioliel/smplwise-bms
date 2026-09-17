"""Semantic search with a local baseline and an optional provider adapter (T063).

The baseline needs no model and no network: it turns a free-text question ("אדם בלובי אתמול בערב", "vehicle near the
gate this morning") into the structured filters the event centre already supports — object class (from the
device's own detection target), places (rooms / zones, floors, cameras matched by name), and a time window in
the site's zone — and reports every term it could not use and why. Results are metadata matches with an explicit
confidence; they are never evidence of a person's identity.

An external provider (embeddings / analysis) plugs in through `Provider`: it must declare its model version, a
privacy policy (what leaves the installation), a daily budget and it is opt-in. None is bundled; the interface
and the settings exist so a future provider cannot be switched on silently."""
from __future__ import annotations

import datetime as dt
import re
import sqlite3
from dataclasses import dataclass, field
from typing import Any
from zoneinfo import ZoneInfo

NOT_IDENTITY = "תוצאות החיפוש הן התאמות של metadata (סוג אירוע, מקום, זמן) ואינן ראיית זהות של אדם; גם ספק ניתוח חיצוני מחזיר הסתברות בלבד."

OBJECT_WORDS = {
    "person": ("אדם", "אנשים", "איש", "בנאדם", "הולך רגל", "person", "people", "human", "man", "woman", "pedestrian", "someone"),
    "vehicle": ("רכב", "רכבים", "מכונית", "משאית", "אופנוע", "אוטו", "vehicle", "car", "truck", "van", "motorcycle", "bike"),
    "motion": ("תנועה", "motion", "movement"),
    "door": ("דלת", "דלתות", "door", "gate", "שער"),
    "line": ("חציית קו", "חצייה", "line crossing", "crossing"),
    "field": ("חדירה", "פריצה", "intrusion", "trespass"),
}
COLOR_WORDS = ("אדום", "כחול", "ירוק", "צהוב", "לבן", "שחור", "אפור", "כתום", "red", "blue", "green", "yellow", "white", "black", "gray", "grey", "orange")
APPEARANCE_WORDS = ("תיק", "כובע", "מעיל", "חולצה", "backpack", "hat", "coat", "shirt", "jacket", "bag", "face", "פנים")
STOP = {"ב", "של", "עם", "את", "על", "the", "a", "an", "in", "at", "on", "near", "ליד", "in", "of", "and", "ו", "או", "or", "אצל", "מול", "לפני", "אחרי", "בין", "to", "from"}
TIME_WORDS = {
    "today": ("היום", "today"),
    "yesterday": ("אתמול", "yesterday"),
    "morning": ("בבוקר", "הבוקר", "בוקר", "morning"),
    "noon": ("בצהריים", "צהריים", "noon", "midday"),
    "afternoon": ("אחר הצהריים", "אחה\"צ", "afternoon"),
    "evening": ("בערב", "הערב", "ערב", "evening"),
    "night": ("בלילה", "הלילה", "לילה", "night", "tonight"),
    "week": ("השבוע", "בשבוע האחרון", "this week", "last week", "past week"),
    "hour": ("בשעה האחרונה", "לפני שעה", "last hour", "past hour"),
}
DAYPART = {"morning": (6, 12), "noon": (11, 14), "afternoon": (12, 18), "evening": (17, 23), "night": (22, 6)}


@dataclass
class Provider:
    id: str
    name: str
    model_version: str
    privacy: str
    network: bool
    budget_daily: int
    opt_in_required: bool
    capabilities: list[str]

    def describe(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "model_version": self.model_version, "privacy": self.privacy, "network": self.network, "budget_daily": self.budget_daily, "opt_in_required": self.opt_in_required, "capabilities": self.capabilities}


LOCAL = Provider(
    id="local",
    name="Baseline מקומי",
    model_version="baseline-1",
    privacy="שום נתון אינו עוזב את המתקן: פירוש לקסיקלי של השאילתה מול הקטלוג המקומי ו־metadata של האירועים בלבד.",
    network=False,
    budget_daily=0,
    opt_in_required=False,
    capabilities=["object_class", "place", "time_window", "free_text"],
)
EXTERNAL_TEMPLATE = Provider(
    id="external",
    name="ספק ניתוח / embeddings חיצוני (לא מצורף)",
    model_version="—",
    privacy="דורש מדיניות פרטיות מוצהרת: אילו פריימים/מטא־נתונים נשלחים, לאן, לכמה זמן נשמרים; הסכמה מפורשת (opt-in) ותקציב יומי.",
    network=True,
    budget_daily=0,
    opt_in_required=True,
    capabilities=["color", "appearance", "similar_image", "free_text_embeddings"],
)


def registry() -> list[dict[str, Any]]:
    return [LOCAL.describe(), {**EXTERNAL_TEMPLATE.describe(), "available": False, "reason": "לא מצורף ספק חיצוני; ממשק המתאם, ההסכמה המפורשת, הצהרת הפרטיות והתקציב קיימים כדי שלא ניתן יהיה להפעיל ספק בשקט"}]


@dataclass
class Parsed:
    objects: list[str] = field(default_factory=list)
    types: list[str] = field(default_factory=list)  # event types to query
    places: list[dict[str, Any]] = field(default_factory=list)
    window: dict[str, str] | None = None
    terms_used: list[str] = field(default_factory=list)
    unsupported: list[dict[str, str]] = field(default_factory=list)
    leftovers: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"objects": self.objects, "types": self.types, "places": self.places, "window": self.window, "terms_used": self.terms_used, "unsupported": self.unsupported, "leftovers": self.leftovers}


def _tokens(q: str) -> list[str]:
    return [t for t in re.split(r"[\s,;:!?.־\-]+", q.casefold()) if t]


def _strip_prefix(tok: str) -> str:
    """Hebrew prepositions glued to the word: ב/ל/מ/ה/ו + noun → noun (kept as a candidate, the original stays too)."""
    return tok[1:] if len(tok) > 3 and tok[0] in "בלמהוכש" else tok


def _match_phrases(text: str, phrases: tuple[str, ...]) -> str | None:
    for p in phrases:
        if p in text:
            return p
    return None


def _window(q: str, now: dt.datetime, tz: ZoneInfo) -> tuple[dict[str, str] | None, list[str]]:
    used: list[str] = []
    local_now = now.astimezone(tz)
    day = local_now.date()
    hit_day = None
    for key in ("today", "yesterday", "week", "hour"):
        p = _match_phrases(q, TIME_WORDS[key])
        if p:
            hit_day = key
            used.append(p)
            break
    part = None
    for key in ("morning", "noon", "afternoon", "evening", "night"):
        p = _match_phrases(q, TIME_WORDS[key])
        if p:
            part = key
            used.append(p)
            break
    m = re.search(r"(\d{1,2}):(\d{2})\s*(?:-|–|עד|to)\s*(\d{1,2}):(\d{2})", q)
    hours: tuple[int, int, int, int] | None = None
    if m:
        hours = (int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)))
        used.append(m.group(0))
    if hit_day is None and part is None and hours is None:
        return None, used
    if hit_day == "hour":
        start, end = now - dt.timedelta(hours=1), now
        return {"from": _iso(start), "to": _iso(end), "label": "השעה האחרונה"}, used
    if hit_day == "week":
        start = dt.datetime.combine(day - dt.timedelta(days=6), dt.time(0, 0), tz)
        return {"from": _iso(start), "to": _iso(now), "label": "7 הימים האחרונים"}, used
    base_day = day - dt.timedelta(days=1) if hit_day == "yesterday" else day
    if hours:
        start = dt.datetime.combine(base_day, dt.time(hours[0] % 24, hours[1] % 60), tz)
        end = dt.datetime.combine(base_day, dt.time(hours[2] % 24, hours[3] % 60), tz)
        if end <= start:
            end += dt.timedelta(days=1)
    elif part:
        h0, h1 = DAYPART[part]
        start = dt.datetime.combine(base_day, dt.time(h0, 0), tz)
        end = dt.datetime.combine(base_day + (dt.timedelta(days=1) if h1 <= h0 else dt.timedelta(0)), dt.time(h1 % 24, 0), tz)
    else:
        start = dt.datetime.combine(base_day, dt.time(0, 0), tz)
        end = start + dt.timedelta(days=1)
    end = min(end, now + dt.timedelta(minutes=1)) if hit_day != "yesterday" else end
    label = ("אתמול" if hit_day == "yesterday" else "היום") + (f" {start.strftime('%H:%M')}–{end.strftime('%H:%M')}" if (part or hours) else "")
    return {"from": _iso(start), "to": _iso(end), "label": label}, used


def _iso(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse(q: str, conn: sqlite3.Connection, tz_name: str, now: dt.datetime | None = None, floor_ok=None) -> Parsed:
    """Local baseline: lexicon for objects and time, catalogue lookup for places. `floor_ok(floor_id)` scopes places."""
    now = now or dt.datetime.now(dt.timezone.utc)
    tz = ZoneInfo(tz_name)
    text = q.casefold()
    out = Parsed()
    for obj, words in OBJECT_WORDS.items():
        p = _match_phrases(text, words)
        if p:
            out.objects.append(obj)
            out.terms_used.append(p)
    type_map = {"person": ["person"], "vehicle": ["vehicle"], "motion": ["motion"], "door": ["door"], "line": ["line"], "field": ["field"]}
    for obj in out.objects:
        out.types.extend(type_map.get(obj, []))
    for w in COLOR_WORDS:
        if re.search(rf"(^|\s|[בהול]){re.escape(w)}(\s|$)", text):
            out.unsupported.append({"term": w, "reason": "color: no source produced colour metadata; needs an opt-in analysis provider"})
            out.terms_used.append(w)
    for w in APPEARANCE_WORDS:
        if re.search(rf"(^|\s|[בהול]){re.escape(w)}(\s|$)", text):
            out.unsupported.append({"term": w, "reason": "appearance: no source produced appearance metadata; needs an opt-in analysis provider"})
            out.terms_used.append(w)
    out.window, used = _window(text, now, tz)
    out.terms_used.extend(used)
    # places: rooms / zones, floors, cameras — by name, scoped
    consumed = set(t for u in out.terms_used for t in _tokens(u))
    toks = [t for t in _tokens(text) if t not in STOP and t not in consumed and _strip_prefix(t) not in consumed]
    candidates = set(toks) | {_strip_prefix(t) for t in toks}
    zones = conn.execute("SELECT id, floor_id, name FROM spatial_zones WHERE deleted_at IS NULL AND searchable = 1").fetchall()
    floors = conn.execute("SELECT id, name FROM floors WHERE deleted_at IS NULL").fetchall()
    cams = conn.execute("SELECT id, alias, name_source FROM cameras WHERE enabled = 1").fetchall()
    matched_tokens: set[str] = set()

    def phrase(name: str | None) -> str | None:
        """The whole catalogue name inside the question (a Hebrew preposition may be glued to it) → exact."""
        if not name:
            return None
        n = name.casefold().strip()
        if len(n) >= 2 and re.search(r"(^|\s|[בהולמכש])" + re.escape(n) + r"(\s|$)", text):
            return "exact"
        return None

    def score(name: str | None, tok: str) -> str | None:
        if not name:
            return None
        n = name.casefold()
        if n == tok:
            return "exact"
        if len(tok) >= 3 and (tok in n or n in tok):
            return "partial"
        return None

    for z in zones:
        if floor_ok and not floor_ok(z["floor_id"]):
            continue
        ph = phrase(z["name"])
        if ph:
            out.places.append({"kind": "zone", "id": z["id"], "name": z["name"], "floor_id": z["floor_id"], "match": ph, "term": z["name"]})
            matched_tokens.update(_tokens(z["name"]))
            continue
        for tok in candidates:
            s = score(z["name"], tok)
            if s:
                out.places.append({"kind": "zone", "id": z["id"], "name": z["name"], "floor_id": z["floor_id"], "match": s, "term": tok})
                matched_tokens.add(tok)
                break
    for f in floors:
        if floor_ok and not floor_ok(f["id"]):
            continue
        ph = phrase(f["name"])
        if ph:
            out.places.append({"kind": "floor", "id": f["id"], "name": f["name"], "floor_id": f["id"], "match": ph, "term": f["name"]})
            matched_tokens.update(_tokens(f["name"]))
            continue
        for tok in candidates:
            s = score(f["name"], tok)
            if s:
                out.places.append({"kind": "floor", "id": f["id"], "name": f["name"], "floor_id": f["id"], "match": s, "term": tok})
                matched_tokens.add(tok)
                break
    for c in cams:
        ph = phrase(c["alias"]) or phrase(c["name_source"])
        if ph:
            out.places.append({"kind": "camera", "id": c["id"], "name": c["alias"] or c["name_source"], "match": ph, "term": c["alias"] or c["name_source"]})
            matched_tokens.update(_tokens(c["alias"] or c["name_source"] or ""))
            continue
        for tok in candidates:
            s = score(c["alias"], tok) or score(c["name_source"], tok)
            if s:
                out.places.append({"kind": "camera", "id": c["id"], "name": c["alias"] or c["name_source"], "match": s, "term": tok})
                matched_tokens.add(tok)
                break
    # a place name wins over a same-word object term ("Gate" the camera is not the door class "gate")
    place_text = " ".join(str(pl["name"]).casefold() for pl in out.places)
    if place_text and out.objects:
        keep: list[str] = []
        for obj in out.objects:
            term = _match_phrases(text, OBJECT_WORDS[obj]) or ""
            if term and term in place_text and not re.search(r"(^|\s|[בהולמכש])" + re.escape(term) + r"(\s|$)", re.sub(re.escape(place_text.split()[0]), " ", text) if place_text else text):
                continue
            keep.append(obj)
        if keep != out.objects:
            out.objects = keep
            out.types = [t for obj in keep for t in {"person": ["person"], "vehicle": ["vehicle"], "motion": ["motion"], "door": ["door"], "line": ["line"], "field": ["field"]}.get(obj, [])]
    out.leftovers = [t for t in toks if t not in matched_tokens and _strip_prefix(t) not in matched_tokens and not any(t == m or _strip_prefix(t) == m for m in matched_tokens)]
    return out


def confidence(ev: dict[str, Any], parsed: Parsed) -> tuple[str, list[str]]:
    """'exact' when every requested dimension matched by the device's own metadata, 'partial' otherwise, with the basis."""
    basis: list[str] = []
    exact = True
    if parsed.types:
        if ev.get("type") in parsed.types and ev.get("confidence") == "measured":
            basis.append(f"סוג אירוע מהמכשיר: {ev.get('type')}")
        elif ev.get("type") in parsed.types:
            basis.append(f"סוג אירוע משוער: {ev.get('type')}")
            exact = False
        else:
            exact = False
    if parsed.places:
        ms = [p["match"] for p in parsed.places]
        basis.append("מקום: " + ", ".join(f"{p['name']} ({'מדויק' if p['match'] == 'exact' else 'חלקי'})" for p in parsed.places))
        if "exact" not in ms:
            exact = False
    if parsed.window:
        basis.append(f"זמן: {parsed.window['label']}")
    return ("exact" if exact and (parsed.types or parsed.places) else "partial"), basis
