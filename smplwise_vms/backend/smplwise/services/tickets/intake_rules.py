"""CR-INTAKE99 section 4 (slice 1): the rule-based extraction of a free-text request. A PURE module: no SQL, no I/O, no network, no
model - `suggest(text, lexicon)` turns a message into a SUGGESTION (department / category / place / urgency / title) with the phrase
that produced every field ("evidence", offsets into the original text), a confidence and flags. A human always decides; nothing here
creates, assigns or sends anything.

Design rules kept here (record 4.2 / 4.8):
- whole-token matching only, after normalisation applied to BOTH the text and every lexicon phrase (niqqud removed, final letters
  folded, quotes unified, digits folded to ASCII, runs of one letter collapsed, Latin lower-cased);
- Hebrew proclitics (ו ה ב ל מ ש כ) are tried as ALTERNATIVES and only when the stem is itself a lexicon word and not a stop-list word;
- the LONGEST phrase wins across all kinds ("דלת מעלית" is a lift, not a door; "לא בוער" is "not urgent", not a fire);
- a safety trigger preceded within two tokens by a negation does not raise urgency (flag `safety_negated`);
- numbers that are a time, a date, a price or a phone fragment are masked before any place rule runs;
- abstain over guess: a tie, or a score below 2, leaves the field empty with confidence `low`/`none`.
Offsets are into the ORIGINAL text; the stored text is never changed."""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

SEED_PATH = Path(__file__).with_name("intake_seed_he.json")
TITLE_MAX = 120
TITLE_MIN = 8
LAYER = {"cat": "cat", "loc": "loc", "safety": "urg", "high": "urg", "high_weak": "urg", "low": "urg", "grat": "misc", "follow": "misc"}
GAP_MAX = 1  # unrelated tokens allowed inside a multi-token phrase
NEG_WINDOW = 2
SEED_WEIGHT = 2.0
NAME_WEIGHT = 3.0
PREFIX_LETTERS = "והבלמשכ"
_FINALS = str.maketrans({"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"})
_QUOTE1 = {"׳": "'", "’": "'", "‘": "'", "`": "'", "´": "'", "ʼ": "'"}
_QUOTE2 = {"״": '"', "”": '"', "“": '"'}
_MASKS = (
    re.compile(r"\d{1,2}:\d{2}(?::\d{2})?"),                       # a time
    re.compile(r"\d{1,2}/\d{1,2}(?:/\d{2,4})?"),                   # a date
    re.compile(r"(?:₪\s?\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s?(?:₪|ש\"ח|שח|ש'ח))"),  # a price
    re.compile(r"\d{2,3}-\d{6,7}"),                                # a phone number with a dash
    re.compile(r"\d{6,}"),                                         # a long number (phone / id)
)
_TOKEN = re.compile(r"(?:(?<=\s)|^)-\d+|[\w'\"]+", re.UNICODE)
_NUM = re.compile(r"^-?\d{1,4}$")
_SENTENCE = re.compile(r"[.?!\n]")


@dataclass(frozen=True)
class Entry:
    """One lexicon phrase. kind: cat | loc | safety | high | high_weak | low | grat | follow. target: `domain:<name>` / `cat:<id>` /
    `loc:<id>` / a rule id. weight: per-token score (seed 2, the installation's own names 3, generic words 1)."""

    tokens: tuple[str, ...]
    kind: str
    target: str
    weight: float = SEED_WEIGHT
    rule: str = ""

    @property
    def score(self) -> float:
        return self.weight * len(self.tokens)


@dataclass
class Lexicon:
    entries: list[Entry] = field(default_factory=list)
    stop: frozenset[str] = frozenset()
    negation: frozenset[str] = frozenset()
    numbers: dict[str, int] = field(default_factory=dict)
    ordinals: dict[str, int] = field(default_factory=dict)
    floor_words: frozenset[str] = frozenset()
    ground_words: frozenset[str] = frozenset()
    building_words: frozenset[str] = frozenset()
    room_words: frozenset[str] = frozenset()
    emergency_rules: frozenset[str] = frozenset()
    domain_category: dict[str, str] = field(default_factory=dict)  # seed domain -> installation category id (configurer's mapping)
    category_names: dict[str, str] = field(default_factory=dict)   # category id -> name (for the title fallback; never matched)
    vocab: frozenset[str] = frozenset()
    place_words: frozenset[str] = frozenset()
    index: dict[str, list[Entry]] = field(default_factory=dict)

    def finish(self) -> "Lexicon":
        vocab: set[str] = set()
        index: dict[str, list[Entry]] = {}
        for e in self.entries:
            vocab.update(e.tokens)
            index.setdefault(e.tokens[0], []).append(e)
        self.place_words = (self.floor_words | self.ground_words | self.building_words | self.room_words
                            | frozenset({MINUS, BASEMENT, ROOF, STAIRS}))
        # a proclitic is stripped off a place word and off a number word too ("בקומה", "בחדר", "השלישית")
        self.vocab = frozenset(vocab) | self.place_words | frozenset(self.numbers) | frozenset(self.ordinals)
        self.index = index
        return self


# ---------------------------------------------------------------- normalisation

def _is_niqqud(ch: str) -> bool:
    cp = ord(ch)
    return 0x0591 <= cp <= 0x05C7 and cp != 0x05BE


def normalise(text: str) -> tuple[str, list[int]]:
    """(normalised text, index map). The normalised string has one character per kept original character, so `map[i]` is the
    original index of normalised character i. Removing niqqud shortens it; everything else is 1:1."""
    out: list[str] = []
    idx: list[int] = []
    for i, ch in enumerate(text):
        if _is_niqqud(ch):
            continue
        if ch == "־":  # maqaf -> space
            c = " "
        else:
            if ch.isdigit():
                d = unicodedata.digit(ch, None)
                if d is not None:
                    ch = str(d)
            c = _QUOTE1.get(ch) or _QUOTE2.get(ch) or ch
            c = c.lower().translate(_FINALS)
            if len(c) != 1:
                c = c[0]
        out.append(c)
        idx.append(i)
    s = "".join(out)
    for rx in _MASKS:
        s = rx.sub(lambda m: "§" * len(m.group(0)), s)
    return s, idx


def key_of(token: str) -> str:
    """The matching key of one token: quotes removed, runs of one letter collapsed (never inside a number)."""
    t = token.replace("'", "").replace('"', "")
    if any(c.isdigit() for c in t):
        return t
    return re.sub(r"(.)\1+", r"\1", t)


MINUS, BASEMENT, ROOF, STAIRS = (key_of(normalise(w)[0]) for w in ("מינוס", "מרתף", "גג", "מדרגות"))  # keys: finals folded, runs collapsed


def phrase_tokens(phrase: str) -> tuple[str, ...]:
    norm, _ = normalise(phrase)
    return tuple(key_of(m.group(0)) for m in _TOKEN.finditer(norm))


@dataclass(frozen=True)
class Tok:
    key: str
    start: int  # offsets into the ORIGINAL text
    end: int
    num: int | None
    alts: tuple[str, ...]


def _strip_options(key: str, lex: Lexicon) -> tuple[str, ...]:
    """Proclitic stripping as alternatives (record 4.2 step 8): the stem must be a lexicon word of at least 2 letters and the
    token must not be a stop-list word."""
    if key in lex.stop:
        return (key,)
    if len(key) == 2 and key[0] in PREFIX_LETTERS and key[1:] == ROOF[:1]:  # "הגג" collapses to "הג": the one 1-letter stem
        return (key, ROOF)
    if len(key) < 3:
        return (key,)
    alts = [key]
    for n in (1, 2, 3):
        if len(key) - n < 2:
            break
        pre, stem = key[:n], key[n:]
        if not all(c in PREFIX_LETTERS for c in pre):
            continue
        if n == 2 and not (pre[0] in "ושמבלכ" and (pre[1] in "בלמכה" or pre[0] == "ו")):
            continue
        if n == 3 and not (pre[0] == "ו" and pre[1] == "ש" and pre[2] in "בלמכה"):
            continue
        if stem in lex.vocab and stem not in lex.stop:
            alts.append(stem)
    return tuple(dict.fromkeys(alts))


def tokenise(text: str, lex: Lexicon) -> tuple[list[Tok], str]:
    norm, idx = normalise(text)
    toks: list[Tok] = []
    for m in _TOKEN.finditer(norm):
        raw = m.group(0)
        if "§" in raw:
            continue
        key = key_of(raw)
        num = int(key) if _NUM.match(key) else None
        s, e = idx[m.start()], idx[m.end() - 1] + 1
        toks.append(Tok(key, s, e, num, (key,) if num is not None else _strip_options(key, lex)))
    return toks, norm


# ---------------------------------------------------------------- phrase matching

@dataclass(frozen=True)
class Match:
    entry: Entry
    first: int
    last: int  # token positions, inclusive


def _find(entry: Entry, toks: list[Tok], first: int) -> int | None:
    """The last token position of `entry` starting at `first`, or None. One unrelated token may sit inside a multi-token phrase."""
    pos = first
    gaps = 0
    for t in entry.tokens[1:]:
        nxt = pos + 1
        if nxt < len(toks) and t in toks[nxt].alts:
            pos = nxt
        elif gaps < GAP_MAX and nxt + 1 < len(toks) and t in toks[nxt + 1].alts:
            gaps += 1
            pos = nxt + 1
        else:
            return None
    return pos


def find_matches(toks: list[Tok], lex: Lexicon) -> list[Match]:
    found: list[Match] = []
    for i, tk in enumerate(toks):
        for alt in tk.alts:
            for e in lex.index.get(alt, ()):
                end = i if len(e.tokens) == 1 else _find(e, toks, i)
                if end is not None:
                    found.append(Match(e, i, end))
    found.sort(key=lambda m: (-(m.last - m.first + 1), -m.entry.score, m.first, m.entry.target))
    # the longest phrase wins WITHIN a layer (category / location / urgency / courtesy); a word may serve two layers at once
    # ("ריח גז" is both a safety trigger and a safety-category word), but never two phrases of one layer
    claimed: dict[str, set[int]] = {}
    chosen: list[Match] = []
    for m in found:
        taken = claimed.setdefault(LAYER[m.entry.kind], set())
        span = range(m.first, m.last + 1)
        if any(p in taken for p in span):
            continue
        taken.update(span)
        chosen.append(m)
    chosen.sort(key=lambda m: m.first)
    return chosen


# ---------------------------------------------------------------- place rules

_FUNCTION = frozenset({"של", "ה", "זה", "הזה", "ליד", "עם", "לא", "יש", "אין"})
_BUILDING_WORDS = frozenset({"צפוני", "דרומי", "מערבי", "מזרחי", "ראשי", "חדש", "ישן", "מרכזי"})


def _num_at(toks: list[Tok], i: int, lex: Lexicon) -> int | None:
    if i >= len(toks):
        return None
    t = toks[i]
    if t.num is not None:
        return t.num
    for alt in t.alts:  # "השלישית" -> "שלישית"
        if alt in lex.numbers:
            return lex.numbers[alt]
        if alt in lex.ordinals:
            return lex.ordinals[alt]
    return None


def _part(text: str, toks: list[Tok], first: int, last: int) -> str:
    return " ".join(text[toks[first].start:toks[last].end].split())


def place_parts(text: str, toks: list[Tok], lex: Lexicon) -> list[dict[str, Any]]:
    """The place rules of record 4.5 as text parts: [{rule, text, start, end}] in reading order."""
    used: set[int] = set()
    parts: list[dict[str, Any]] = []

    def add(rule: str, label: str, first: int, last: int) -> None:
        used.update(range(first, last + 1))
        parts.append({"rule": rule, "text": label, "start": toks[first].start, "end": toks[last].end})

    for i, t in enumerate(toks):
        if i in used:
            continue
        k = next((a for a in t.alts if a in lex.place_words), t.key)  # "בקומה" -> "קומה"
        if k in lex.floor_words:
            n = _num_at(toks, i + 1, lex)
            if n is not None and -9 <= n <= 120 and (i + 1) not in used:
                add("P-floor-num", f"קומה {n}", i, i + 1)
                continue
            if i + 1 < len(toks) and toks[i + 1].key in lex.ground_words:
                add("P-floor-ground", "קומת קרקע", i, i + 1)
                continue
        if k == MINUS:
            n = _num_at(toks, i + 1, lex)
            if n is not None and 0 < n <= 9:
                add("P-floor-neg", f"קומה -{n}", i, i + 1)
                continue
        if t.num is not None and t.num < 0 and t.num >= -9:
            add("P-floor-neg", f"קומה {t.num}", i, i)
            continue
        if k in lex.ground_words:
            add("P-floor-ground", "קומת קרקע" if k == "קרקע" else _part(text, toks, i, i), i, i)
            continue
        if k == BASEMENT:
            add("P-floor-neg", "מרתף", i, i)
            continue
        if k == ROOF:
            add("P-roof", "גג", i, i)
            continue
        if k in lex.building_words and i + 1 < len(toks) and (i + 1) not in used:
            nxt = toks[i + 1]
            letter = len(nxt.key) == 1 and nxt.key.isalpha()
            if (nxt.num is not None and nxt.num > 0) or letter or (nxt.key in _BUILDING_WORDS and nxt.key not in _FUNCTION):
                add("P-building", _part(text, toks, i, i + 1), i, i + 1)
                continue
        if k in lex.room_words and i + 1 < len(toks) and (i + 1) not in used:
            nxt = toks[i + 1]
            if nxt.num is not None and nxt.num > 0:
                add("P-room", _part(text, toks, i, i + 1), i, i + 1)
                continue
        if k == STAIRS:
            first = i - 1 if i and toks[i - 1].key == "חדר" and (i - 1) not in used else i
            add("P-stairs", "חדר מדרגות", first, i)
            continue
    parts.sort(key=lambda p: p["start"])
    return parts


# ---------------------------------------------------------------- the suggestion

def _confidence(top: float, second: float) -> str:
    if top >= 3 and top >= 2 * second:
        return "high"
    if top >= 2 and top > second:
        return "medium"
    return "low"


def _ev(text: str, toks: list[Tok], m: Match) -> list[Any]:
    return [toks[m.first].start, toks[m.last].end, m.entry.rule or m.entry.target]


def _title(text: str) -> str:
    for chunk in _SENTENCE.split(text):
        chunk = " ".join(chunk.split())
        if chunk:
            if len(chunk) <= TITLE_MAX:
                return chunk
            cut = chunk[:TITLE_MAX]
            if " " in cut:
                cut = cut.rsplit(" ", 1)[0]
            return cut.rstrip(" ,;:-")
    return ""


def suggest(text: str, lex: Lexicon) -> dict[str, Any]:
    """The extraction (record 4.1). Returns a JSON-serialisable dict:
    {category: {value, confidence, evidence, candidates}, location: {value, ...}, place: {text, confidence, evidence, parts},
     urgency: {value, confidence, evidence}, title, title_short, flags, unmapped_domains}.
    `category.value` is an installation category id, or None; `location.value` an organisation location id, or None;
    `urgency.value` one of urgent | high | normal | low (a priority KEY of the department)."""
    toks, _norm = tokenise(text, lex)
    matches = find_matches(toks, lex)
    flags: list[str] = []

    # ---- category
    scores: dict[str, float] = {}
    evid: dict[str, list[Any]] = {}
    seen: set[tuple[str, tuple[str, ...]]] = set()
    unmapped: dict[str, float] = {}
    for m in matches:
        e = m.entry
        if e.kind != "cat":
            continue
        target = e.target
        if target.startswith("domain:"):
            cat = lex.domain_category.get(target[7:])
            if cat is None:
                unmapped[target[7:]] = unmapped.get(target[7:], 0.0) + e.score
                continue
            target = f"cat:{cat}"
        marker = (target, e.tokens)
        if marker in seen:
            continue
        seen.add(marker)
        scores[target] = scores.get(target, 0.0) + e.score
        evid.setdefault(target, []).append(_ev(text, toks, m))
    ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    cat_value: str | None = None
    cat_conf = "none"
    cat_evidence: list[Any] = []
    if ranked:
        top_t, top = ranked[0]
        second = ranked[1][1] if len(ranked) > 1 else 0.0
        cat_conf = _confidence(top, second)
        if cat_conf in ("high", "medium"):
            cat_value = top_t[4:]
            cat_evidence = evid[top_t]
        if len(ranked) > 1 and top >= 3 and second >= 3 and top < 2 * second:
            flags.append("possible_multi_issue")
    category = {"value": cat_value, "confidence": cat_conf, "evidence": cat_evidence,
                "candidates": [t[4:] for t, _ in ranked[:3]]}

    # ---- organisation location (the installation's own names)
    loc_scores: dict[str, tuple[float, list[Any]]] = {}
    for m in matches:
        if m.entry.kind == "loc":
            sc, ev = loc_scores.get(m.entry.target, (0.0, []))
            loc_scores[m.entry.target] = (sc + m.entry.score, ev + [_ev(text, toks, m)])
    loc_value = None
    loc_ev: list[Any] = []
    loc_conf = "none"
    if loc_scores:
        order = sorted(loc_scores.items(), key=lambda kv: (-kv[1][0], kv[0]))
        if len(order) == 1 or order[0][1][0] > order[1][1][0]:
            loc_value = order[0][0][4:]
            loc_ev = order[0][1][1]
            loc_conf = "high"
        else:
            loc_conf = "low"
    location = {"value": loc_value, "confidence": loc_conf, "evidence": loc_ev}

    # ---- place text (floor / building / room patterns)
    parts = place_parts(text, toks, lex)
    place = {
        "text": ", ".join(p["text"] for p in parts)[:200],
        "confidence": "medium" if parts else "none",
        "evidence": [[p["start"], p["end"], p["rule"]] for p in parts],
        "parts": parts,
    }

    # ---- urgency
    urgency = "normal"
    u_conf = "none"
    u_ev: list[Any] = []
    safety_hit = False
    for m in matches:
        e = m.entry
        if e.kind == "safety":
            before = toks[max(0, m.first - NEG_WINDOW):m.first]
            if any(set(t.alts) & lex.negation for t in before):
                if "safety_negated" not in flags:
                    flags.append("safety_negated")
                continue
            safety_hit = True
            u_ev.append(_ev(text, toks, m))
            if e.target in lex.emergency_rules and "emergency_services" not in flags:
                flags.append("emergency_services")
    if safety_hit:
        urgency, u_conf = "urgent", "high"
        flags.append("safety")
    else:
        highs = [m for m in matches if m.entry.kind in ("high", "high_weak")]
        lows = [m for m in matches if m.entry.kind == "low"]
        thanks = any(m.entry.kind == "grat" for m in matches)  # "תודה רבה!!!" is courtesy, not urgency
        bangs = re.search(r"!{3,}", text) is not None and not thanks
        if highs or bangs:
            urgency, u_conf = "high", "medium"
            u_ev = [_ev(text, toks, m) for m in highs]
        elif lows:
            urgency, u_conf = "low", "medium"
            u_ev = [_ev(text, toks, m) for m in lows]

    # ---- flags
    content = [t for t in toks if len(t.key) > 1 or t.num is not None]
    if len(content) < 2:
        flags.append("too_short")
    if cat_value is None and not safety_hit:
        if any(m.entry.kind == "grat" for m in matches):
            flags.append("possible_not_a_request")
        if any(m.entry.kind == "follow" for m in matches) or "?" in text:
            flags.append("possible_question")

    title = _title(text)
    return {
        "category": category, "location": location, "place": place,
        "urgency": {"value": urgency, "confidence": u_conf, "evidence": u_ev},
        "title": title, "title_short": len(title) < TITLE_MIN,
        "flags": list(dict.fromkeys(flags)),
        "unmapped_domains": sorted(unmapped),
    }


# ---------------------------------------------------------------- the shipped lexicon

def _entry(phrase: Any, kind: str, target: str, rule: str = "", *, weight: float | None = None) -> Entry | None:
    w = SEED_WEIGHT if weight is None else weight
    if isinstance(phrase, (list, tuple)):
        phrase, w = phrase[0], float(phrase[1])
    toks = phrase_tokens(str(phrase))
    return Entry(toks, kind, target, w, rule or target) if toks else None


@lru_cache(maxsize=1)
def _seed() -> dict[str, Any]:
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


def seed_domains() -> list[str]:
    return sorted(_seed()["domains"])


def seed_lexicon(extra: Iterable[Entry] = (), *, domain_category: dict[str, str] | None = None,
                 category_names: dict[str, str] | None = None, extra_stop: Iterable[str] = ()) -> Lexicon:
    """The shipped Hebrew lexicon plus the installation's own entries (intake_lexicon.build)."""
    seed = _seed()
    entries: list[Entry] = []

    def add(e: Entry | None) -> None:
        if e is not None:
            entries.append(e)

    for domain, phrases in seed["domains"].items():
        for p in phrases:
            add(_entry(p, "cat", f"domain:{domain}", f"D-{domain}"))
    for rule, phrases in seed["safety"].items():
        for p in phrases:
            add(_entry(p, "safety", rule, rule))
    for p in seed["high"]:
        add(_entry(p, "high", "U-high", "U-high"))
    for p in seed["high_weak"]:
        add(_entry(p, "high_weak", "U-gas-weak", "U-gas-weak"))
    for p in seed["low"]:
        add(_entry(p, "low", "U-low", "U-low"))
    for p in seed["gratitude"]:
        add(_entry(p, "grat", "gratitude", "gratitude"))
    for p in seed["followup"]:
        add(_entry(p, "follow", "followup", "followup"))
    entries.extend(extra)

    def keys(words: Iterable[str]) -> frozenset[str]:
        return frozenset(key_of(normalise(w)[0]) for w in words)

    lex = Lexicon(
        entries=entries,
        stop=keys([*seed["stop"], *extra_stop]),
        negation=keys(w for w in seed["negation"] if " " not in w),
        numbers={key_of(normalise(k)[0]): v for k, v in seed["numbers"].items()},
        ordinals={key_of(normalise(k)[0]): v for k, v in seed["ordinals"].items()},
        floor_words=keys(seed["floor_words"]), ground_words=keys(seed["ground_words"]),
        building_words=keys(seed["building_words"]), room_words=keys(seed["room_words"]),
        emergency_rules=frozenset(seed["emergency_rules"]),
        domain_category=dict(domain_category or {}), category_names=dict(category_names or {}),
    )
    return lex.finish()
