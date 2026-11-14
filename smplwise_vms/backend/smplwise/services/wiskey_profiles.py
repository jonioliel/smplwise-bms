"""WISKEY-PROFILES-EDIT-2390 (WisKey full integration plan of 2026-11-03, task T8; capability matrix rows 26, 27 and 31; owner decision
of 03.11, Q4 "a": full editing in Arx): the person groups and the profile fields - view, edit a draft, WisKey's own impact preview,
apply after a confirmation that shows that impact, the versions list, the compare of two versions, a rollback draft built from a
version, and the group suggestions for one person.

The WisKey commands (rc.10 `websocket.py` COMMANDS / handlers, `access/policy_operations.py`, `access/policy_versions.py`,
`access/group_suggestions.py`, `profile_settings.py`, `profile_conditions.py`; the static rc.10 extract and the pinned catalog
rc37-contract.4 agree on every key below):

| command                      | frame keys (besides id / type)        | catalog class  | channel here | what it does in WisKey                          |
|------------------------------|---------------------------------------|----------------|--------------|-------------------------------------------------|
| `profiles/settings_get`      | -                                     | READ           | `read`       | the policy (revision, fields, groups, photo)    |
| `profiles/versions`          | `offset`, `limit` (1..50)             | READ, admin    | `read`       | the retained history (metadata, no values)      |
| `profiles/versions_compare`  | `before_revision`, `after_revision`   | READ, admin    | `profiles`   | per field / group: before and after per property|
| `profiles/settings_preview`  | `revision`, `values`, `api_contract`  | management:manage | `profiles` | the impact review: people and stations affected, field diagnostics, an `operation_id` valid 300 s; NO storage or device write |
| `profiles/settings_apply`    | `operation_id`, `api_contract`        | management:manage | `profiles` | saves the reviewed policy atomically with a receipt (idempotent per operation id); WisKey then QUEUES a sync of the affected stations |
| `users/group_suggestions`    | `user_id`, `field_ids` (0..3)         | READ (users:view) | `profiles` | read-only suggestions from people sharing the selected field values |

Not sent, deliberately: `profiles/settings_update` - WisKey's direct save. It stores a new policy WITHOUT the impact review (it refuses
only `profile_review_required` when a definition with people changes) and records the change as a plain update; the reviewed
`settings_preview` -> `settings_apply` pair does everything it does (same normalisation, same revision check, same "definitions are
archived, never removed" rule) and records `bulk/group_policy` with a durable receipt. So every Arx write of the policy is a reviewed
one, and `settings_update` is on no channel.

What WisKey does not offer, so Arx does not invent it (gaps, docs/changes/WISKEY-PROFILES-EDIT-2390.md):
- no "restore version N" command and no read of an old version's VALUES (`profiles/versions` is metadata only). A rollback here is a
  DRAFT that Arx rebuilds from `versions_compare(N, current)` and that then goes through the same preview -> confirm -> apply. It is exact
  for every field / group property WisKey versions (label, enabled, type, required, unique, options, depends_on; label, enabled,
  station_ids); a definition added after N cannot be removed (WisKey archives definitions) and is DISABLED instead; `photo_enabled`
  and the templates are not in WisKey's version diff and stay as they are now. The draft says each of these.
- the photo crop (`local_photo_crop`) is client-side in WisKey's own panel (no command); the person editor's photo is T9's.
- conditional fields (`conditional_profile_fields`) ARE exposed: a field's `depends_on = {field_id, value}`; the editor here sets it
  (the definition). Evaluating it while editing a PERSON (hiding a field whose parent does not match) is the person editor's (T9).

The preview's `operation_id` never reaches the browser: Arx keeps it in a short-lived REVIEW of its own (this module), bound to the Arx
user who asked for it - all Arx users share one WisKey identity, so WisKey's own "same actor" rule cannot tell them apart; this does.
A review is applied at most once; an apply whose answer is unclear marks the review `unknown`, and it can only be resolved by a readback
(`check`) - never by sending again blindly.

Pure: projections, the draft validation (WisKey's own limits, so a bad draft is refused before anything is sent), the diff, the rollback
reconstruction and the review store. The HTTP side is routers/access_control_profiles.py; tests: tests/test_wiskey_profiles.py with a
stateful fake WisKey. Nothing here contacts a device."""
from __future__ import annotations

import copy
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from . import intercom_adapter as ad
from . import intercom_client
from .intercom_client import IntercomError, UnclearAnswer

CHANNEL = "profiles"  # services/wiskey_channels.py PROFILES
LANE = "config"  # intercom_sync's people-write lane (one slot of its own, CONFIG_TIMEOUT_S): the apply is a configuration write
COMMANDS = frozenset({"profiles/settings_preview", "profiles/settings_apply", "profiles/versions_compare", "users/group_suggestions"})
READ_COMMANDS = ("profiles/settings_get", "profiles/versions")  # the adapter's READ channel (already there)
NOT_SENT = frozenset({"profiles/settings_update"})

# what each part of the screen needs WisKey to list (overview.api.commands); a part whose command is not listed is `unsupported`
FEATURES: dict[str, tuple[str, ...]] = {
    "view": ("profiles/settings_get",),
    "edit": ("profiles/settings_get", "profiles/settings_preview", "profiles/settings_apply"),
    "versions": ("profiles/versions",),
    "compare": ("profiles/settings_get", "profiles/versions_compare"),
    "suggestions": ("users/group_suggestions",),
}

# WisKey's own limits (profile_settings.normalize / profile_conditions.validate_conditions)
FIELDS_MAX = 12
GROUPS_MAX = 64
LABEL_MAX = 64
OPTIONS_MAX = 100
OPTION_MAX = 100
GROUP_STATIONS_MAX = 100
STATION_ID_MAX = 64
VALUE_MAX = 100
SUGGEST_FIELDS_MAX = 3
ID = re.compile(r"[a-z][a-z0-9_]{0,47}")
FIELD_TYPES = ("text", "select", "number", "date")
FIELD_PROPS = ("label", "enabled", "type", "required", "unique", "options", "depends_on")
GROUP_PROPS = ("label", "enabled", "station_ids")
ISSUES = frozenset({"profile_required", "profile_value_invalid"})

# an apply's failure codes that WisKey raises BEFORE it saves anything (policy_operations.apply / repository.async_profile_settings):
# a definite "not saved". Anything else (a storage error, an unclear frame) may come after the save - `unknown`.
APPLY_REFUSALS = frozenset({
    "bulk_review_expired", "bulk_review_stale", "profile_value_not_unique", "revision_conflict", "operation_not_found", "manager_closed",
    "unauthorized", "access_denied", "invalid_fields", "invalid_format", "api_incompatible", "rate_limited", "reauth_required",
    "security_locked", "session_locked", "request_too_large", "station_not_found", "unmanaged_lock", "profile_definition_in_use",
    "profile_settings_unavailable", "field_access_denied",
})
UNCLEAR_CODES = frozenset({"", "action_failed", "storage_or_internal_error", "storage_write_failed", "invalid_response", "timeout", "unknown_error"})

REVIEW_TTL_MARGIN_S = 10.0  # Arx lets a review go this long BEFORE WisKey's own 300 s (the confirm screen never offers a dead review)
REVIEWS_PER_USER = 4
REVIEWS_MAX = 100
EXAMPLES_MAX = 20
ROWS_MAX = 200


# ---------------------------------------------------------------- small closed readers

def _bool(v: Any) -> bool:
    return v is True


def _label(v: Any, limit: int = LABEL_MAX) -> str | None:
    return ad._text(v, limit)


def _sid(v: Any) -> str | None:
    return v if isinstance(v, str) and 0 < len(v) <= STATION_ID_MAX and ad.CODE.fullmatch(v) is not None else None


def _sids(v: Any, limit: int = GROUP_STATIONS_MAX) -> list[str]:
    return [s for s in (v if isinstance(v, list) else [])[:limit] if _sid(s)]


def _pid(v: Any) -> str | None:
    """A WisKey policy id (field / group): WisKey's own pattern."""
    return v if isinstance(v, str) and ID.fullmatch(v) else None


# ---------------------------------------------------------------- the policy (profiles/settings_get)

def project_field(f: dict[str, Any]) -> dict[str, Any]:
    dep = f.get("depends_on") if isinstance(f.get("depends_on"), dict) else None
    kind = f.get("type") if f.get("type") in FIELD_TYPES else "text"
    return {
        "id": f["id"],
        "label": _label(f.get("label")) or f["id"],
        "enabled": _bool(f.get("enabled")),
        "type": kind,
        "required": _bool(f.get("required")),
        "unique": _bool(f.get("unique")),
        "options": [o for o in (f.get("options") if isinstance(f.get("options"), list) else [])[:OPTIONS_MAX] if isinstance(o, str) and len(o) <= OPTION_MAX],
        "depends_on": {"field_id": dep["field_id"], "value": dep.get("value") if isinstance(dep.get("value"), str) and len(dep["value"]) <= VALUE_MAX else ""}
        if dep and _pid(dep.get("field_id")) else None,
    }


def project_group(g: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": g["id"],
        "label": _label(g.get("label")) or g["id"],
        "enabled": _bool(g.get("enabled")),
        # absent in WisKey = the group grants no station (WisKey keeps an older group without the key); null here says "absent"
        "station_ids": _sids(g["station_ids"]) if isinstance(g.get("station_ids"), list) else None,
    }


def project_policy(raw: Any) -> dict[str, Any]:
    """`profiles/settings_get`: the whole policy as the editor needs it. Templates are COUNTED only (they carry default profile values,
    which this screen never shows nor sends - WisKey keeps them as they are when a write leaves them out)."""
    if not isinstance(raw, dict) or ad._int(raw.get("revision")) is None:
        raise ValueError("unexpected profiles/settings_get answer")
    fields = [project_field(f) for f in (raw.get("fields") if isinstance(raw.get("fields"), list) else [])[:FIELDS_MAX] if isinstance(f, dict) and _pid(f.get("id"))]
    groups = [project_group(g) for g in (raw.get("groups") if isinstance(raw.get("groups"), list) else [])[:GROUPS_MAX] if isinstance(g, dict) and _pid(g.get("id"))]
    templates = raw.get("templates") if isinstance(raw.get("templates"), list) else []
    return {
        "revision": ad._int(raw.get("revision")),
        "photo_enabled": _bool(raw.get("photo_enabled")),
        "fields": fields,
        "groups": groups,
        "templates": len(templates),
    }


def values_of(policy: dict[str, Any]) -> dict[str, Any]:
    """The `values` of a policy as WisKey's writes take them (no revision, no template count)."""
    return {"photo_enabled": bool(policy.get("photo_enabled")), "fields": copy.deepcopy(policy.get("fields") or []), "groups": copy.deepcopy(policy.get("groups") or [])}


# ---------------------------------------------------------------- the draft (validated with WisKey's own rules before anything is sent)

class DraftError(ValueError):
    def __init__(self, problems: list[dict[str, str]]):
        super().__init__("invalid draft")
        self.problems = problems


def normalize_draft(values: Any, known_stations: set[str] | None = None) -> dict[str, Any]:
    """The draft as it will be sent: `{photo_enabled, fields, groups}` with every item in WisKey's exact key set. Raises DraftError
    with every problem found (`{path, code}`), so the editor can mark them all at once. `known_stations`: the stations Arx knows (a
    group may keep a station id Arx does not know - it is kept, never dropped - but a NEW one must be known)."""
    problems: list[dict[str, str]] = []

    def bad(path: str, code: str) -> None:
        if len(problems) < 50:
            problems.append({"path": path, "code": code})

    if not isinstance(values, dict) or set(values) - {"photo_enabled", "fields", "groups"} or not {"photo_enabled", "fields", "groups"} <= set(values):
        raise DraftError([{"path": "values", "code": "shape"}])
    if type(values["photo_enabled"]) is not bool:
        bad("photo_enabled", "type")
    fields_in = values["fields"] if isinstance(values["fields"], list) else None
    groups_in = values["groups"] if isinstance(values["groups"], list) else None
    if fields_in is None or len(fields_in) > FIELDS_MAX:
        raise DraftError([{"path": "fields", "code": "too_many" if fields_in is not None else "shape"}])
    if groups_in is None or len(groups_in) > GROUPS_MAX:
        raise DraftError([{"path": "groups", "code": "too_many" if groups_in is not None else "shape"}])
    fields: list[dict[str, Any]] = []
    for i, f in enumerate(fields_in):
        p = f"fields.{i}"
        if not isinstance(f, dict) or set(f) - set(("id",) + FIELD_PROPS):
            bad(p, "shape")
            continue
        fid = _pid(f.get("id"))
        if fid is None:
            bad(f"{p}.id", "id")
        label = f.get("label")
        if not isinstance(label, str) or not label.strip() or len(label) > LABEL_MAX or any(ord(c) < 32 for c in label):
            bad(f"{p}.label", "label")
        for key in ("enabled", "required", "unique"):
            if type(f.get(key, False)) is not bool:
                bad(f"{p}.{key}", "type")
        kind = f.get("type", "text")
        if kind not in FIELD_TYPES:
            bad(f"{p}.type", "type")
        options = f.get("options", [])
        if not isinstance(options, list) or len(options) > OPTIONS_MAX:
            bad(f"{p}.options", "too_many")
            options = []
        else:
            for j, o in enumerate(options):
                if not isinstance(o, str) or not o.strip() or len(o) > OPTION_MAX or any(ord(c) < 32 for c in o):
                    bad(f"{p}.options.{j}", "option")
            if len(set(o for o in options if isinstance(o, str))) != len(options):
                bad(f"{p}.options", "duplicate")
        if kind == "select" and not options:
            bad(f"{p}.options", "empty")
        dep = f.get("depends_on")
        if dep is not None:
            if not isinstance(dep, dict) or set(dep) != {"field_id", "value"} or _pid(dep.get("field_id")) is None or not isinstance(dep.get("value"), str) \
                    or len(dep["value"]) > VALUE_MAX:
                bad(f"{p}.depends_on", "shape")
                dep = None
        fields.append({
            "id": fid or "", "label": label if isinstance(label, str) else "", "enabled": f.get("enabled") is True, "options": [o for o in options if isinstance(o, str)],
            "type": kind if kind in FIELD_TYPES else "text", "required": f.get("required") is True, "unique": f.get("unique") is True,
            "depends_on": {"field_id": dep["field_id"], "value": dep["value"]} if dep else None,
        })
    ids = [f["id"] for f in fields]
    for i, fid in enumerate(ids):
        if fid and ids.count(fid) > 1:
            bad(f"fields.{i}.id", "duplicate")
    # conditions: the parent exists, is not the field itself, no cycle (WisKey's validate_conditions)
    by_id = {f["id"]: f for f in fields if f["id"]}
    for i, f in enumerate(fields):
        dep = f["depends_on"]
        if not dep:
            continue
        parent = by_id.get(dep["field_id"])
        if parent is None or dep["field_id"] == f["id"]:
            bad(f"fields.{i}.depends_on", "parent")
            continue
        if parent["type"] == "select" and dep["value"] and dep["value"] not in parent["options"]:
            bad(f"fields.{i}.depends_on", "value")
        seen, at = {f["id"]}, dep["field_id"]
        while at:
            if at in seen:
                bad(f"fields.{i}.depends_on", "cycle")
                break
            seen.add(at)
            nxt = (by_id.get(at) or {}).get("depends_on")
            at = nxt["field_id"] if nxt else ""
    groups: list[dict[str, Any]] = []
    for i, g in enumerate(groups_in):
        p = f"groups.{i}"
        if not isinstance(g, dict) or set(g) - {"id", "label", "enabled", "station_ids"}:
            bad(p, "shape")
            continue
        gid = _pid(g.get("id"))
        if gid is None:
            bad(f"{p}.id", "id")
        label = g.get("label")
        if not isinstance(label, str) or not label.strip() or len(label) > LABEL_MAX or any(ord(c) < 32 for c in label):
            bad(f"{p}.label", "label")
        if type(g.get("enabled", False)) is not bool:
            bad(f"{p}.enabled", "type")
        item: dict[str, Any] = {"id": gid or "", "label": label if isinstance(label, str) else "", "enabled": g.get("enabled") is True}
        if g.get("station_ids") is not None:
            st = g["station_ids"]
            if not isinstance(st, list) or len(st) > GROUP_STATIONS_MAX:
                bad(f"{p}.station_ids", "too_many")
                st = []
            clean = [s for s in st if _sid(s)]
            if len(clean) != len(st):
                bad(f"{p}.station_ids", "station")
            if len(set(clean)) != len(clean):
                bad(f"{p}.station_ids", "duplicate")
            if known_stations is not None:
                for s in clean:
                    if s not in known_stations:
                        bad(f"{p}.station_ids", "unknown_station")
                        break
            item["station_ids"] = sorted(set(clean))
        groups.append(item)
    gids = [g["id"] for g in groups]
    for i, gid in enumerate(gids):
        if gid and gids.count(gid) > 1:
            bad(f"groups.{i}.id", "duplicate")
    if problems:
        raise DraftError(problems)
    return {"photo_enabled": values["photo_enabled"], "fields": fields, "groups": groups}


def removed_definitions(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    """Ids the draft leaves out (WisKey refuses `profile_definition_in_use`: definitions are archived - disabled - never removed)."""
    out = []
    for kind in ("fields", "groups"):
        now = {x["id"] for x in after.get(kind) or []}
        out += [f"{kind}.{x['id']}" for x in before.get(kind) or [] if x["id"] not in now]
    return out


def stations_added(before: dict[str, Any], after: dict[str, Any]) -> set[str]:
    old = {g["id"]: set(g.get("station_ids") or []) for g in before.get("groups") or []}
    out: set[str] = set()
    for g in after.get("groups") or []:
        out |= set(g.get("station_ids") or []) - old.get(g["id"], set())
    return out


# ---------------------------------------------------------------- the diff (WisKey's policy_versions.rows, plus the photo switch)

def diff_rows(before: dict[str, Any], after: dict[str, Any]) -> list[dict[str, Any]]:
    """Per field / group that differs: `{kind, id, label, state: added|removed|changed, changes: [{property, before, after}]}`, the same
    rows WisKey's own compare builds; the photo switch as a `settings` row. Used for the confirmation and the audit (definitions only:
    no person, no value of a person)."""
    out: list[dict[str, Any]] = []
    if bool(before.get("photo_enabled")) != bool(after.get("photo_enabled")):
        out.append({"kind": "settings", "id": "photo_enabled", "label": "photo_enabled", "state": "changed",
                    "changes": [{"property": "photo_enabled", "before": bool(before.get("photo_enabled")), "after": bool(after.get("photo_enabled"))}]})
    for kind, props in (("fields", FIELD_PROPS), ("groups", GROUP_PROPS)):
        old = {v["id"]: v for v in before.get(kind) or []}
        new = {v["id"]: v for v in after.get(kind) or []}
        for key in sorted(old.keys() | new.keys()):
            a, b = old.get(key), new.get(key)
            changes = []
            for prop in props:
                left, right = (a or {}).get(prop) if a else None, (b or {}).get(prop) if b else None
                if prop == "station_ids":
                    left = sorted(left) if isinstance(left, list) else left
                    right = sorted(right) if isinstance(right, list) else right
                if left != right:
                    changes.append({"property": prop, "before": copy.deepcopy(left), "after": copy.deepcopy(right)})
            if a is None or b is None or changes:
                out.append({"kind": kind, "id": key, "label": (b or a or {}).get("label", key), "state": "added" if a is None else "removed" if b is None else "changed",
                            "changes": changes})
    return out


def audit_diff(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The diff as an audit row keeps it: bounded (64 rows, 100 stations / options per side), definitions only."""
    def cut(v: Any) -> Any:
        return v[:100] if isinstance(v, list) else v

    return [{**r, "changes": [{**c, "before": cut(c["before"]), "after": cut(c["after"])} for c in r["changes"]]} for r in rows[:64]]


# ---------------------------------------------------------------- versions and compare

def project_compare(raw: Any) -> dict[str, Any]:
    """`profiles/versions_compare`: the rows WisKey built (the parent's label it adds to `depends_on` dropped - the label is in the row)."""
    if not isinstance(raw, dict) or not isinstance(raw.get("rows"), list):
        raise ValueError("unexpected profiles/versions_compare answer")
    rows = []
    for r in raw["rows"][:200]:
        if not isinstance(r, dict) or r.get("kind") not in ("fields", "groups") or not _pid(r.get("id")):
            continue
        props = FIELD_PROPS if r["kind"] == "fields" else GROUP_PROPS
        changes = []
        for c in (r.get("changes") if isinstance(r.get("changes"), list) else [])[:16]:
            if not isinstance(c, dict) or c.get("property") not in props:
                continue
            changes.append({"property": c["property"], "before": _prop(c["property"], c.get("before")), "after": _prop(c["property"], c.get("after"))})
        rows.append({"kind": r["kind"], "id": r["id"], "label": _label(r.get("label")) or r["id"],
                     "state": r.get("state") if r.get("state") in ("added", "removed", "changed") else "changed", "changes": changes})
    return {
        "before_revision": ad._int(raw.get("before_revision")),
        "after_revision": ad._int(raw.get("after_revision")),
        "rows": rows,
        "summary": {"fields": sum(r["kind"] == "fields" for r in rows), "groups": sum(r["kind"] == "groups" for r in rows)},
    }


def _prop(prop: str, v: Any) -> Any:
    """One property value of a compare row, closed per property."""
    if v is None:
        return None
    if prop in ("enabled", "required", "unique"):
        return v is True
    if prop == "label":
        return _label(v)
    if prop == "type":
        return v if v in FIELD_TYPES else "text"
    if prop == "options":
        return [o for o in (v if isinstance(v, list) else [])[:OPTIONS_MAX] if isinstance(o, str) and len(o) <= OPTION_MAX]
    if prop == "station_ids":
        return _sids(v)
    if prop == "depends_on":
        if isinstance(v, dict) and _pid(v.get("field_id")):
            return {"field_id": v["field_id"], "value": v.get("value") if isinstance(v.get("value"), str) and len(v["value"]) <= VALUE_MAX else ""}
        return None
    return None


def rollback_draft(current: dict[str, Any], compare: dict[str, Any]) -> dict[str, Any]:
    """A draft that takes the CURRENT policy back to version `compare.before_revision` (compare = versions_compare(N, current)):
    `{values, notes}`. Every versioned property is restored exactly; a definition added after N is disabled (WisKey never removes
    one), one removed since is put back; the photo switch and the templates are not versioned and stay as they are. Never sent by
    itself: the editor loads it, and it goes through preview -> confirm -> apply like any draft."""
    values = values_of(current)
    notes: list[dict[str, str]] = [{"code": "photo_not_versioned", "id": "photo_enabled"}]
    if current.get("templates"):
        notes.append({"code": "templates_not_versioned", "id": "templates"})
    for row in compare.get("rows") or []:
        items = values[row["kind"]]
        item = next((x for x in items if x["id"] == row["id"]), None)
        if row["state"] == "added":  # exists now, not in N
            if item is not None and item.get("enabled"):
                item["enabled"] = False
                notes.append({"code": "disabled_not_removed", "id": f"{row['kind']}.{row['id']}"})
            continue
        if row["state"] == "removed":  # in N, not now: rebuild it from N's side of the row
            built: dict[str, Any] = {"id": row["id"]}
            for c in row["changes"]:
                built[c["property"]] = copy.deepcopy(c["before"])
            if row["kind"] == "fields":
                built = {"id": row["id"], "label": built.get("label") or row["label"], "enabled": bool(built.get("enabled")), "type": built.get("type") or "text",
                         "required": bool(built.get("required")), "unique": bool(built.get("unique")), "options": built.get("options") or [], "depends_on": built.get("depends_on")}
            else:
                built = {"id": row["id"], "label": built.get("label") or row["label"], "enabled": bool(built.get("enabled")), "station_ids": built.get("station_ids") or []}
            items.append(built)
            notes.append({"code": "restored", "id": f"{row['kind']}.{row['id']}"})
            continue
        if item is None:
            notes.append({"code": "missing_now", "id": f"{row['kind']}.{row['id']}"})
            continue
        for c in row["changes"]:
            value = copy.deepcopy(c["before"])
            if c["property"] == "station_ids" and value is None:
                value = []  # N had no station list (no station granted): restore "none", not "keep the current ones"
            if c["property"] == "options" and value is None:
                value = []
            item[c["property"]] = value
    return {"values": values, "notes": notes}


# ---------------------------------------------------------------- the preview (profiles/settings_preview)

def project_preview(raw: Any) -> dict[str, Any]:
    """WisKey's impact review, closed. The `operation_id` is kept apart (`_operation_id`, never served); people rows keep the name,
    the employee number (the router drops it for a caller without the sensitive level) and the stations before / after - never the
    overrides' content (only how many), never a profile value."""
    if not isinstance(raw, dict) or not isinstance(raw.get("operation_id"), str) or not 1 <= len(raw["operation_id"]) <= 128:
        raise ValueError("unexpected profiles/settings_preview answer")
    people = []
    for r in (raw.get("rows") if isinstance(raw.get("rows"), list) else [])[:ROWS_MAX]:
        if not isinstance(r, dict) or not ad._id(r.get("user_id")):
            continue
        overrides = r.get("overrides") if isinstance(r.get("overrides"), dict) else {}
        people.append({
            "user_id": r["user_id"], "display_name": ad._text(r.get("display_name"), 128) or "", "employee_no": ad._text(r.get("employee_no"), 64),
            "before": _sids(r.get("before"), 200), "after": _sids(r.get("after"), 200), "changed": r.get("changed") is True,
            "overrides": len(overrides),
        })
    fields = []
    for f in (raw.get("field_changes") if isinstance(raw.get("field_changes"), list) else [])[:FIELDS_MAX]:
        if not isinstance(f, dict) or not _pid(f.get("field_id")):
            continue
        after = f.get("after") if isinstance(f.get("after"), dict) else {}
        fields.append({
            "field_id": f["field_id"], "label": _label(f.get("label")) or f["field_id"],
            "new": not isinstance(f.get("before"), dict),
            **{k: ad._int(f.get(k)) or 0 for k in ("checked", "applicable", "inactive", "newly_applicable", "missing", "invalid", "previous_issues", "duplicates",
                                                 "template_issues")},
            "required": after.get("required") is True, "unique": after.get("unique") is True,
            "examples": [
                {"display_name": ad._text(e.get("display_name"), 128) or "", "employee_no": ad._text(e.get("employee_no"), 64),
                 "reason": e.get("reason") if e.get("reason") in ISSUES else "other", "archived": e.get("archived") is True}
                for e in (f.get("examples") if isinstance(f.get("examples"), list) else [])[:EXAMPLES_MAX] if isinstance(e, dict)
            ],
            "duplicate_examples": [
                {"display_name": ad._text(e.get("display_name"), 128) or "", "employee_no": ad._text(e.get("employee_no"), 64), "archived": e.get("archived") is True}
                for e in (f.get("duplicate_examples") if isinstance(f.get("duplicate_examples"), list) else [])[:EXAMPLES_MAX] if isinstance(e, dict)
            ],
            "examples_truncated": f.get("examples_truncated") is True or f.get("duplicate_examples_truncated") is True,
        })
    expires = ad._int(raw.get("expires_in"))
    return {
        "_operation_id": raw["operation_id"],
        "people": people,
        "people_truncated": isinstance(raw.get("rows"), list) and len(raw["rows"]) > ROWS_MAX,
        "changed": ad._int(raw.get("changed")) or 0,
        "stations": _sids(raw.get("stations"), 500),
        "offline": _sids(raw.get("offline"), 500),
        "field_changes": fields,
        "can_apply": raw.get("can_apply") is True,
        "requires_confirmation": raw.get("requires_confirmation") is not False,  # unknown -> confirm anyway
        "expires_in": expires if expires is not None and 0 < expires <= 3600 else 300,
        "device_writes": ad._int(raw.get("device_writes")) or 0,
    }


# ---------------------------------------------------------------- the apply receipt (profiles/settings_apply)

def project_receipt(raw: Any) -> dict[str, Any]:
    """WisKey's durable receipt (`operation_receipts`): when, which stations WisKey queued a sync for, how many people changed. Never
    the actor (an HA user id) nor the person ids (only their count)."""
    if not isinstance(raw, dict) or raw.get("action") not in (None, "bulk/group_policy"):
        raise ValueError("unexpected profiles/settings_apply answer")
    if not isinstance(raw.get("operation_id"), str):
        raise ValueError("unexpected profiles/settings_apply answer")
    users = raw.get("user_ids") if isinstance(raw.get("user_ids"), list) else []
    changed = ad._int(raw.get("changed"))
    return {"saved_at": ad._iso(raw.get("saved_at")), "stations": _sids(raw.get("stations"), 500), "changed": changed if changed is not None else len(users)}


# ---------------------------------------------------------------- group suggestions (users/group_suggestions)

def project_suggestions(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("suggestions"), list):
        raise ValueError("unexpected users/group_suggestions answer")
    suggestions = []
    for s in raw["suggestions"][:GROUPS_MAX]:
        if not isinstance(s, dict) or not _pid(s.get("group_id")):
            continue
        doors = []
        for d in (s.get("doors") if isinstance(s.get("doors"), list) else [])[:GROUP_STATIONS_MAX]:
            if isinstance(d, dict) and _sid(d.get("station_id")):
                doors.append({"station_id": d["station_id"], "station_name": ad._text(d.get("station_name"), 128) or d["station_id"], "blocked": d.get("blocked") is True,
                              "before": [n for n in (d.get("before") if isinstance(d.get("before"), list) else [])[:8] if isinstance(n, int) and not isinstance(n, bool)],
                              "after": [n for n in (d.get("after") if isinstance(d.get("after"), list) else [])[:8] if isinstance(n, int) and not isinstance(n, bool)]})
        suggestions.append({"group_id": s["group_id"], "label": _label(s.get("label")) or s["group_id"], "matching_members": ad._int(s.get("matching_members")) or 0,
                            "matching_people": ad._int(s.get("matching_people")) or 0, "doors": doors})
    return {
        "user_id": ad._id(raw.get("user_id")),
        "person_revision": ad._int(raw.get("person_revision")),
        "policy_revision": ad._int(raw.get("policy_revision")),
        "fields": [{"id": f["id"], "label": _label(f.get("label")) or f["id"], "value": ad._text(f.get("value"), VALUE_MAX)}
                   for f in (raw.get("fields") if isinstance(raw.get("fields"), list) else [])[:FIELDS_MAX] if isinstance(f, dict) and _pid(f.get("id"))],
        "selected_fields": [f for f in (raw.get("selected_fields") if isinstance(raw.get("selected_fields"), list) else [])[:SUGGEST_FIELDS_MAX] if _pid(f)],
        "suggestions": suggestions,
        "can_apply_to_draft": raw.get("can_apply_to_draft") is True,
    }


# ---------------------------------------------------------------- the frames

def result_of(frame: Any, command: str, *, write: bool) -> Any:
    """`success: true` -> the result. `success: false`: for a read or the preview (nothing is stored) every code is a definite
    failure; for the apply only the codes WisKey raises BEFORE it saves (APPLY_REFUSALS) are, anything else is UnclearAnswer."""
    if isinstance(frame, dict) and frame.get("success") is True:
        return frame.get("result")
    if isinstance(frame, dict) and frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if not write and code and ad.CODE.fullmatch(code):
            raise IntercomError(code, command)
        if write and code in APPLY_REFUSALS:
            raise IntercomError(code, command)
        raise UnclearAnswer(command, code or "action_failed")
    raise UnclearAnswer(command, "invalid_response") if write else IntercomError("invalid_response", command)


async def preview(call: intercom_client.Call, revision: int, values: dict[str, Any]) -> Any:
    frame = await call(intercom_client.command_type("profiles/settings_preview"), revision=revision, values=values, api_contract=intercom_client.API_CONTRACT)
    return result_of(frame, "profiles/settings_preview", write=False)


async def apply(call: intercom_client.Call, operation_id: str) -> Any:
    frame = await call(intercom_client.command_type("profiles/settings_apply"), operation_id=operation_id, api_contract=intercom_client.API_CONTRACT)
    return result_of(frame, "profiles/settings_apply", write=True)


async def compare(call: intercom_client.Call, before_revision: int, after_revision: int) -> Any:
    frame = await call(intercom_client.command_type("profiles/versions_compare"), before_revision=before_revision, after_revision=after_revision)
    return result_of(frame, "profiles/versions_compare", write=False)


async def suggestions(call: intercom_client.Call, user_id: str, field_ids: list[str]) -> Any:
    frame = await call(intercom_client.command_type("users/group_suggestions"), user_id=user_id, field_ids=list(field_ids))
    return result_of(frame, "users/group_suggestions", write=False)


def feature_state(api: dict[str, Any] | None, part: str) -> tuple[bool | None, str | None]:
    """(available, reason) of one part of the screen from WisKey's discovery - the adapter's rule (`intercom_adapter.feature_state`)."""
    if api is None:
        return None, None
    min_client = api.get("min_client")
    if isinstance(min_client, int) and min_client > intercom_client.API_CONTRACT:
        return False, "api_incompatible"
    commands = api.get("commands")
    if commands is None:
        return False, "commands_unknown"
    if not all(c in commands for c in FEATURES[part]):
        return False, "not_listed"
    return True, None


# ---------------------------------------------------------------- Arx's reviews (the preview's operation id never leaves the server)

@dataclass
class Review:
    id: str
    user: str
    operation_id: str
    base_revision: int
    values: dict[str, Any]
    before: dict[str, Any]
    diff: list[dict[str, Any]]
    impact: dict[str, Any]
    deadline: float
    state: str = "open"  # open | applying | applied | unknown | refused | dead
    result: dict[str, Any] | None = None
    created: float = field(default_factory=time.monotonic)


class Reviews:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._by: dict[str, Review] = {}

    def add(self, user: str, operation_id: str, base_revision: int, values: dict[str, Any], before: dict[str, Any], diff: list[dict[str, Any]],
            impact: dict[str, Any], expires_in: int) -> Review:
        now = time.monotonic()
        review = Review(uuid.uuid4().hex, user, operation_id, base_revision, values, before, diff, impact, now + max(1.0, expires_in - REVIEW_TTL_MARGIN_S))
        with self._lock:
            for key in [k for k, r in self._by.items() if r.deadline <= now and r.state in ("open", "refused", "dead")]:
                del self._by[key]
            mine = sorted((r for r in self._by.values() if r.user == user and r.state in ("open", "refused", "dead")), key=lambda r: r.created)
            for old in mine[: max(0, len(mine) - (REVIEWS_PER_USER - 1))]:
                self._by.pop(old.id, None)
            while len(self._by) >= REVIEWS_MAX:
                oldest = min(self._by.values(), key=lambda r: r.created)
                self._by.pop(oldest.id, None)
            self._by[review.id] = review
        return review

    def get(self, review_id: str, user: str) -> Review | None:
        with self._lock:
            r = self._by.get(review_id)
            return r if r is not None and r.user == user else None

    def claim(self, review: Review) -> str | None:
        """Mark the review `applying` if it may be sent now; else why not (`expired`, `applying`, `applied`, `unknown`, `dead`)."""
        with self._lock:
            if review.state == "applied":
                return "applied"
            if review.state in ("applying", "unknown", "dead"):
                return review.state
            if review.deadline <= time.monotonic():
                return "expired"
            review.state = "applying"
            return None

    def settle(self, review: Review, state: str, result: dict[str, Any] | None = None) -> None:
        with self._lock:
            review.state = state
            if result is not None:
                review.result = result

    def reset(self) -> None:
        with self._lock:
            self._by.clear()


REVIEWS = Reviews()


def reset() -> None:
    REVIEWS.reset()
