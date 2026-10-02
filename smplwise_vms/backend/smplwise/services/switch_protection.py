"""CR-019 switch protection (docs/changes/CR-019-SWITCH-PROTECTION.md): a switch takes part in GROUP actions ("turn
everything off", the floor / area / building switch actions of services/device_bulk.py) unless it is PROTECTED. Protection
means excluded from group actions only - individual control, schedules and automations never read it (decision 1a).

- `classify_switch` - the pure, conservative classifier (section 6.3, rules in switch_protection_rules.py): HA-side facts only
  (entity, its HA device, the other entities of that device, the HA area) - never the map, a circuit or anything an Arx map
  editor can change. A hit is a protection category and the signal that matched.
- `reconcile` - after every registry refresh, at start-up and after the dev seed (section 6.4): follow renamed entity ids,
  keep (never delete) the protection of an entity that left HA and purge it after 90 days, classify every switch seen for the
  first time (a hit is protected at once, `source='auto'`, unreviewed) and, after a classifier version bump, re-judge the
  switches the older rules allowed. A switch the classifier has not seen yet is excluded from group actions (fail-safe,
  device_bulk.SwitchPolicy), never included.
- `set_protected` / `approve` - the administrator's choices (system.configure, routers/devices.py). Removing protection writes
  the verdict `admin_cleared`: the classifier never protects that switch again.

`device_bulk_safe` (the CR-007 opt-in marks) is read once by migration 0049 (verdict `was_safe`) and never written again.
"""
from __future__ import annotations

import datetime as dt
import re
import unicodedata
from typing import Any, Iterable

from ..audit import audit
from ..db import get_setting, now_iso
from . import devices as dsvc
from . import switch_protection_rules as rules

CLASSIFIER_VERSION = 1
GONE_PURGE_DAYS = 90
MIGRATION_KEY = "switch_protection.migration_pending"  # set by migration 0049 when the upgrade had switches to judge
AUDIT_ACTION = "devices.bulk_protected"

# ---------------------------------------------------------------- matching

_QUOTES = str.maketrans({
    "׳": "'", "’": "'", "‘": "'", "`": "'", "´": "'", "ʼ": "'",  # geresh and its look-alikes
    "״": '"', "“": '"', "”": '"', "„": '"',  # gershayim and its look-alikes
    "־": "-", "‐": "-", "‑": "-", "–": "-", "—": "-",  # maqaf and dashes
})
_NIQQUD = re.compile("[֑-ֽֿ-ׇ]")
_TOKEN = re.compile(r"[a-z]+|[0-9]+")
_HE_WORD = re.compile("[א-ת]+")


def normalize(text: str | None) -> str:
    """NFKC, case-folded, quote / geresh / maqaf variants unified, Hebrew points dropped, white space collapsed."""
    if not text:
        return ""
    s = unicodedata.normalize("NFKC", str(text)).translate(_QUOTES).casefold()
    s = _NIQQUD.sub("", s)
    return " ".join(s.split())


def tokens(norm: str) -> list[str]:
    """English tokens: runs of letters, runs of digits (so `ups1` holds `ups`, `groups` never does)."""
    return _TOKEN.findall(norm)


def _has_phrase(toks: list[str], phrase: tuple[str, ...]) -> bool:
    n = len(phrase)
    return any(tuple(toks[i:i + n]) == phrase for i in range(len(toks) - n + 1))


_EN_TERMS = [(cat, [(t, tuple(tokens(normalize(t)))) for t in en], [normalize(h) for h in he]) for cat, en, he in rules.TERMS]
_LIGHT_EN = [tuple(tokens(w)) for w in rules.LIGHT_WORDS_EN]
_LIGHT_HE = [normalize(w) for w in rules.LIGHT_WORDS_HE]


def _starts_word(norm: str, term: str) -> bool:
    """A Hebrew word starts with `term`, optionally after prefix letters (ה ו ב ל מ ש כ)."""
    for word in _HE_WORD.findall(norm):
        i = word.find(term)
        while i != -1:
            if all(ch in rules.HEBREW_PREFIX_LETTERS for ch in word[:i]):
                return True
            i = word.find(term, i + 1)
    return False


def has_light_word(norm: str) -> bool:
    toks = tokens(norm)
    return any(_has_phrase(toks, w) for w in _LIGHT_EN) or any(_starts_word(norm, w) for w in _LIGHT_HE)


def match_text(text: str | None) -> tuple[str, str] | None:
    """(category, term) of the first category whose term the text holds - English whole tokens, Hebrew substrings - or None.
    A WEAK category's hit is skipped when the same text also names a light; a later (strong) category may still hit."""
    norm = normalize(text)
    if not norm:
        return None
    toks = tokens(norm)
    light: bool | None = None
    for cat, en, he in _EN_TERMS:
        hit = next((term for term, phrase in en if phrase and _has_phrase(toks, phrase)), None) or next((h for h in he if h and h in norm), None)
        if not hit:
            continue
        if cat in rules.WEAK_CATEGORIES:
            if light is None:
                light = has_light_word(norm)
            if light:
                continue
        return cat, hit
    return None


def match_icon(icon: str | None) -> str | None:
    if not icon:
        return None
    name = icon.strip().casefold()
    if not name.startswith("mdi:"):
        return None
    name = name[4:]
    if name in rules.ICON_EXACT:
        return rules.ICON_EXACT[name]
    for family, cat in rules.ICON_FAMILIES:
        if name == family or name.startswith(family + "-"):
            return cat
    return None


def match_area(area_name: str | None) -> tuple[str, str] | None:
    norm = normalize(area_name)
    if not norm:
        return None
    toks = tokens(norm)
    for he, en, cat in rules.AREAS:
        for h in he:
            if normalize(h) in norm:
                return cat, h
        for e in en:
            if _has_phrase(toks, tuple(tokens(e))):
                return cat, e
    return None


def classify_switch(entity: dict[str, Any], device: dict[str, Any] | None, siblings: Iterable[dict[str, Any]], area_name: str | None) -> tuple[str, str] | None:
    """(category, rule) when the switch looks sensitive, else None. Signals in order platform -> sibling entities -> icon ->
    entity text (name, original name, object id) -> device text (name, user name, manufacturer, model) -> area (technical
    rooms); the first hit is the rule, e.g. "platform:hassio", "sibling:lock", "icon:mdi:water-pump", "name:משאבה"."""
    platform = (entity.get("platform") or "").strip().casefold()
    if platform in rules.PLATFORMS:
        return rules.PLATFORMS[platform], f"platform:{platform}"
    for s in sorted(siblings or (), key=lambda x: (x.get("domain") or "", x.get("device_class") or "", x.get("entity_id") or "")):
        domain, dclass = s.get("domain") or "", (s.get("device_class") or "").casefold()
        if domain in rules.SIBLING_DOMAINS:
            return rules.SIBLING_DOMAINS[domain], f"sibling:{domain}"
        for sdomain, classes, cat in rules.SIBLING_CLASSES:
            if domain == sdomain and dclass in classes:
                return cat, f"sibling:{domain}/{dclass}"
    cat = match_icon(entity.get("icon"))
    if cat:
        return cat, f"icon:{entity['icon'].strip()}"
    eid = entity.get("entity_id") or ""
    for field, text in (("name", entity.get("name")), ("original_name", entity.get("original_name")), ("entity_id", eid.split(".", 1)[1] if "." in eid else eid)):
        hit = match_text(text)
        if hit:
            return hit[0], f"{field}:{hit[1]}"
    for text in ((device or {}).get(k) for k in ("name_by_user", "name", "manufacturer", "model")):
        hit = match_text(text)
        if hit:
            return hit[0], f"device:{hit[1]}"
    hit = match_area(area_name)
    if hit:
        return hit[0], f"area:{hit[1]}"
    return None


def category_label(category: str | None) -> str | None:
    return rules.CATEGORY_LABELS.get(category or "")


def categories() -> list[dict[str, str]]:
    return [{"id": k, "label": v} for k, v in rules.CATEGORY_LABELS.items()]


# ---------------------------------------------------------------- reconcile

_SWITCH_SQL = (
    "SELECT entity_id, registry_id, name, original_name, icon, platform, device_id, area_name FROM ha_entities WHERE domain = 'switch' AND removed_at IS NULL "
    "AND disabled = 0 AND hidden = 0 AND (entity_category IS NULL OR entity_category = '') AND " + dsvc.NOT_SCHEDULER_SQL
)


def _device_lookup(conn: Any, devices: Iterable[dict[str, Any]] | None) -> dict[str, dict[str, Any]]:
    """device id -> {name, name_by_user, manufacturer, model}: from the registry listing the refresh just read (the device
    mirror is written after the reconcile), else from the mirror."""
    if devices is not None:
        return {d["id"]: d for d in devices if isinstance(d, dict) and d.get("id")}
    return {r["device_id"]: dict(r) for r in conn.execute("SELECT device_id, name, name_by_user, manufacturer, model FROM ha_devices WHERE removed_at IS NULL").fetchall()}


def _siblings(conn: Any) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for r in conn.execute("SELECT entity_id, domain, device_class, device_id FROM ha_entities WHERE device_id IS NOT NULL AND device_id != '' AND removed_at IS NULL").fetchall():
        out.setdefault(r["device_id"], []).append({"entity_id": r["entity_id"], "domain": r["domain"], "device_class": r["device_class"]})
    return out


def _judge(row: Any, devs: dict[str, dict[str, Any]], sibs: dict[str, list[dict[str, Any]]]) -> tuple[str, str] | None:
    e = dict(row)
    did = e.get("device_id")
    siblings = [s for s in sibs.get(did or "", []) if s["entity_id"] != e["entity_id"]] if did else []
    return classify_switch(e, devs.get(did or "") if did else None, siblings, e.get("area_name"))


def _days_since(stamp: str | None, now: dt.datetime) -> float:
    if not stamp:
        return 0.0
    try:
        t = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    except ValueError:
        return 0.0
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return (now - t).total_seconds() / 86400.0


def _protect_auto(conn: Any, eid: str, registry_id: str | None, category: str, rule: str, stamp: str) -> bool:
    """A classifier hit: protected at once, unreviewed. An existing protection row (manual or auto) is left as it is."""
    cur = conn.execute(
        "INSERT OR IGNORE INTO device_bulk_protected(entity_id, registry_id, source, category, rule, marked_at, reviewed) VALUES (?,?,?,?,?,?,0)",
        (eid, registry_id, "auto", category, rule, stamp),
    )
    if cur.rowcount != 1:
        return False
    audit(conn, actor=None, action=AUDIT_ACTION + ".auto", decision="allowed", resource_type="ha_entity", resource_id=eid, reason=category,
          details={"rule": rule, "classifier_version": CLASSIFIER_VERSION})
    return True


def present_from_mirror(conn: Any) -> set[str]:
    """Start-up: the registry entities the mirror holds now (the listing the last refresh wrote)."""
    return {r[0] for r in conn.execute("SELECT entity_id FROM ha_entities WHERE registry_id IS NOT NULL AND removed_at IS NULL").fetchall()}


def reconcile(conn: Any, present_registry: set[str], devices: Iterable[dict[str, Any]] | None = None, now: dt.datetime | None = None) -> dict[str, int]:
    """Section 6.4, in the caller's transaction. `present_registry`: the entity ids of the registry listing just applied (the
    listing succeeded - a failed one never reaches here); an entity HA never registered is present while it is not tombstoned.
    `devices`: that refresh's device registry listing (else the device mirror). Returns the counts of what changed."""
    now = now or dt.datetime.now(dt.timezone.utc)
    stamp = now.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    counts = {"auto_protected": 0, "allowed": 0, "moved": 0, "gone": 0, "returned": 0, "purged": 0, "rejudged": 0}
    live = {r["entity_id"]: r["registry_id"] for r in conn.execute("SELECT entity_id, registry_id FROM ha_entities WHERE removed_at IS NULL").fetchall()}
    if not live:
        return counts  # an empty mirror: nothing to judge, nothing is gone (the guard of the failed listing, at start-up too)
    present = {eid for eid, reg in live.items() if eid in present_registry or not reg}
    by_registry: dict[str, str] = {}
    for eid in present:
        if live.get(eid):
            by_registry.setdefault(live[eid], eid)

    protected = {r["entity_id"]: dict(r) for r in conn.execute("SELECT * FROM device_bulk_protected").fetchall()}
    classified = {r["entity_id"]: dict(r) for r in conn.execute("SELECT * FROM device_switch_classified").fetchall()}

    # 1. rename follow: a row whose id is gone while its registry id now belongs to another present id moves there
    for old in sorted((set(protected) | set(classified)) - present):
        reg = (protected.get(old) or {}).get("registry_id") or (classified.get(old) or {}).get("registry_id")
        new = by_registry.get(reg or "")
        if not new or new == old:
            continue
        if old in protected:
            if new in protected:
                conn.execute("DELETE FROM device_bulk_protected WHERE entity_id = ?", (old,))  # the new id is protected already
            else:
                conn.execute("UPDATE device_bulk_protected SET entity_id = ?, gone_at = NULL WHERE entity_id = ?", (new, old))
                protected[new] = {**protected[old], "entity_id": new, "gone_at": None}
            del protected[old]
        if old in classified:
            if new in classified:
                conn.execute("DELETE FROM device_switch_classified WHERE entity_id = ?", (old,))
            else:
                conn.execute("UPDATE device_switch_classified SET entity_id = ?, gone_at = NULL WHERE entity_id = ?", (new, old))
                classified[new] = {**classified[old], "entity_id": new, "gone_at": None}
            del classified[old]
        counts["moved"] += 1
        audit(conn, actor=None, action=AUDIT_ACTION + ".moved", decision="allowed", resource_type="ha_entity", resource_id=new, details={"from": old, "to": new})

    # 2. gone / returned (never deleted while young), the registry id kept current, the 90-day purge
    for table, rows in (("device_bulk_protected", protected), ("device_switch_classified", classified)):
        for eid, row in list(rows.items()):
            if eid in present:
                if row.get("gone_at"):
                    conn.execute(f"UPDATE {table} SET gone_at = NULL WHERE entity_id = ?", (eid,))
                    row["gone_at"] = None
                    if table == "device_bulk_protected":
                        counts["returned"] += 1
                if live.get(eid) and row.get("registry_id") != live[eid]:
                    conn.execute(f"UPDATE {table} SET registry_id = ? WHERE entity_id = ?", (live[eid], eid))
                    row["registry_id"] = live[eid]
            elif not row.get("gone_at"):
                conn.execute(f"UPDATE {table} SET gone_at = ? WHERE entity_id = ?", (stamp, eid))
                row["gone_at"] = stamp
                if table == "device_bulk_protected":
                    counts["gone"] += 1
    for eid in sorted(set(protected) | set(classified)):
        p, c = protected.get(eid), classified.get(eid)
        gone_at = (p or c or {}).get("gone_at")
        if eid in present or not gone_at or _days_since(gone_at, now) <= GONE_PURGE_DAYS:
            continue
        conn.execute("DELETE FROM device_bulk_protected WHERE entity_id = ?", (eid,))
        conn.execute("DELETE FROM device_switch_classified WHERE entity_id = ?", (eid,))
        protected.pop(eid, None)
        classified.pop(eid, None)
        counts["purged"] += 1
        audit(conn, actor=None, action=AUDIT_ACTION + ".purged", decision="allowed", resource_type="ha_entity", resource_id=eid,
              details={"gone_at": gone_at, "protected": p is not None, "verdict": (c or {}).get("verdict")})

    # 3. classify every catalogue switch seen for the first time; 4. re-judge what an older classifier allowed
    switches = conn.execute(_SWITCH_SQL).fetchall()
    todo = [r for r in switches if r["entity_id"] not in classified or (classified[r["entity_id"]]["verdict"] == "allowed" and int(classified[r["entity_id"]]["classifier_version"]) < CLASSIFIER_VERSION)]
    if todo:
        devs = _device_lookup(conn, devices)
        sibs = _siblings(conn)
        for r in todo:
            eid = r["entity_id"]
            again = eid in classified
            if not again and eid in protected:
                # protected already (an administrator, or a row moved here): recorded as judged, the protection untouched
                p = protected[eid]
                conn.execute("INSERT OR IGNORE INTO device_switch_classified(entity_id, registry_id, verdict, category, rule, classifier_version, classified_at) VALUES (?,?,?,?,?,?,?)",
                             (eid, r["registry_id"], "protected", p.get("category"), p.get("rule") or "manual", CLASSIFIER_VERSION, stamp))
                classified[eid] = {"verdict": "protected", "classifier_version": CLASSIFIER_VERSION}
                continue
            hit = _judge(r, devs, sibs)
            if hit:
                if _protect_auto(conn, eid, r["registry_id"], hit[0], hit[1], stamp):
                    counts["auto_protected"] += 1
                    protected[eid] = {"entity_id": eid, "source": "auto"}
                verdict, category, rule = "protected", hit[0], hit[1]
            else:
                verdict, category, rule = "allowed", None, None
                if not again:
                    counts["allowed"] += 1
            if again:
                counts["rejudged"] += 1
                conn.execute("UPDATE device_switch_classified SET verdict = ?, category = ?, rule = ?, classifier_version = ?, classified_at = ? WHERE entity_id = ?",
                             (verdict, category, rule, CLASSIFIER_VERSION, stamp, eid))
            else:
                conn.execute("INSERT INTO device_switch_classified(entity_id, registry_id, verdict, category, rule, classifier_version, classified_at) VALUES (?,?,?,?,?,?,?)",
                             (eid, r["registry_id"], verdict, category, rule, CLASSIFIER_VERSION, stamp))
            classified[eid] = {"verdict": verdict, "classifier_version": CLASSIFIER_VERSION}

    # 5. the pass summary, and the owner-facing record of the upgrade (the first pass that had switches to judge)
    if any(counts[k] for k in ("auto_protected", "allowed", "moved", "gone", "purged", "rejudged")):
        audit(conn, actor=None, action=AUDIT_ACTION + ".reconcile", decision="allowed", resource_type="installation", resource_id="*",
              details={k: counts[k] for k in ("auto_protected", "allowed", "moved", "gone", "purged", "rejudged", "returned")})
    if switches and get_setting(conn, MIGRATION_KEY) is not None:
        was_safe = conn.execute("SELECT COUNT(*) FROM device_switch_classified WHERE verdict = 'was_safe'").fetchone()[0]
        audit(conn, actor=None, action="devices.switch_model.migrated", decision="allowed", resource_type="installation", resource_id="*",
              details={"was_safe": was_safe, "auto_protected": counts["auto_protected"], "allowed": counts["allowed"], "classifier_version": CLASSIFIER_VERSION})
        conn.execute("DELETE FROM settings WHERE key = ?", (MIGRATION_KEY,))
    return counts


# ---------------------------------------------------------------- the administrator's choices (system.configure)

def status(conn: Any, entity_id: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """(protection row, classified row) of one entity."""
    p = conn.execute("SELECT * FROM device_bulk_protected WHERE entity_id = ?", (entity_id,)).fetchone()
    c = conn.execute("SELECT * FROM device_switch_classified WHERE entity_id = ?", (entity_id,)).fetchone()
    return (dict(p) if p else None), (dict(c) if c else None)


def _registry_id(conn: Any, entity_id: str) -> str | None:
    r = conn.execute("SELECT registry_id FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    return r["registry_id"] if r else None


def set_protected(conn: Any, principal: Any, entity_id: str, protect: bool, *, batch: bool = False, request_id: str | None = None) -> bool:
    """Protect (`source='manual'`, reviewed) or remove protection (verdict `admin_cleared`: never protected again by the
    classifier). Protecting an unreviewed auto row confirms it. Returns whether anything changed; audits each change."""
    p, c = status(conn, entity_id)
    stamp = now_iso()
    if protect:
        if p is not None:
            if p["reviewed"]:
                return False
            _review(conn, principal, entity_id, p, stamp, request_id)
            return True
        conn.execute(
            "INSERT INTO device_bulk_protected(entity_id, registry_id, source, category, rule, marked_by, marked_by_username, marked_at, reviewed, reviewed_by, reviewed_at) "
            "VALUES (?,?,?,?,?,?,?,?,1,?,?)",
            (entity_id, _registry_id(conn, entity_id), "manual", None, None, principal.user_id, principal.username, stamp, _who(principal), stamp),
        )
        if c is None:
            conn.execute("INSERT INTO device_switch_classified(entity_id, registry_id, verdict, category, rule, classifier_version, classified_at) VALUES (?,?,?,?,?,?,?)",
                         (entity_id, _registry_id(conn, entity_id), "protected", None, "manual", CLASSIFIER_VERSION, stamp))
        audit(conn, actor=principal, action=AUDIT_ACTION, decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=request_id,
              details={"protected": True, "source": "manual", "batch": batch})
        return True
    if p is None and c is not None:
        return False  # judged and not protected: included already
    conn.execute("DELETE FROM device_bulk_protected WHERE entity_id = ?", (entity_id,))
    conn.execute(
        "INSERT INTO device_switch_classified(entity_id, registry_id, verdict, category, rule, classifier_version, classified_at) VALUES (?,?,?,?,?,?,?) "
        "ON CONFLICT(entity_id) DO UPDATE SET verdict = excluded.verdict, classified_at = excluded.classified_at, gone_at = NULL",
        (entity_id, _registry_id(conn, entity_id), "admin_cleared", (p or {}).get("category"), (p or {}).get("rule"), CLASSIFIER_VERSION, stamp),
    )
    audit(conn, actor=principal, action=AUDIT_ACTION, decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=request_id,
          details={"protected": False, "source": (p or {}).get("source"), "batch": batch})
    return True


def _who(principal: Any) -> str:
    """`reviewed_by`: the reviewer as the review list shows it (the user name; the id when there is none)."""
    return principal.username or principal.user_id


def _review(conn: Any, principal: Any, entity_id: str, p: dict[str, Any], stamp: str, request_id: str | None) -> None:
    conn.execute("UPDATE device_bulk_protected SET reviewed = 1, reviewed_by = ?, reviewed_at = ? WHERE entity_id = ?", (_who(principal), stamp, entity_id))
    audit(conn, actor=principal, action=AUDIT_ACTION + ".reviewed", decision="allowed", resource_type="ha_entity", resource_id=entity_id, request_id=request_id,
          details={"category": p.get("category"), "rule": p.get("rule")})


def approve(conn: Any, principal: Any, entity_id: str, *, request_id: str | None = None) -> bool:
    """Confirm an unreviewed auto protection. Anything else is left as it is (False)."""
    p, _c = status(conn, entity_id)
    if p is None or p["reviewed"]:
        return False
    _review(conn, principal, entity_id, p, now_iso(), request_id)
    return True
