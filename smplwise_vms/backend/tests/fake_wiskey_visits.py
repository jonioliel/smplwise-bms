"""WISKEY-VISITS-2407: the fake WisKey's visit side (no device, no Home Assistant, no WisKey).

- `visits/list` and `guest_templates/get` answer with rc.10's shapes (access/visit_requests.py `public`, access/guest_templates.py `public`),
  synthetic values, with bait WisKey really sends and Arx must drop: HA user ids (`requested_by`, `approver_id`, `decided_by`, `updated_by`),
  the employee number, the responsible person, the purpose text and the credential flags;
- `visits/record_external_v1` is NOT in rc.10: it is answered only while `offer_record` is True (and then listed in `overview.api.commands`),
  with rc.19's semantics (WisKey docs/contracts/external-visits-v1/CONTRACT.txt, access/external_visits.py `record` / `upsert`, ported
  here independently of Arx's own check): the closed record validated (`invalid_fields` / `invalid_id` / `invalid_validity` /
  `invalid_text`), an upsert keyed by `external_ref` that keeps the visit id, a lower `arx_revision` refused `visit_record_stale`, an equal
  one with an equal normalized record answered with the prior result (nothing stored), an equal one with other metadata or another person
  refused `revision_conflict`; the result exactly `{visit_id (UUID), revision, arx_revision, status}`. Nothing about a person changes;
- `visits/list` (WISKEY-R6-2520): an Arx record is listed with rc.19's external row shape (`source: "arx"`, `external_ref`, `arx_revision`,
  status `approved` / `ended`); `filters.external_ref` is exact and case sensitive and excludes native rows - and refused `invalid_fields`
  while the record command is not offered (rc.10 knows no such filter);
- `filters.status` (WISKEY-VISITS-ENDED-FILTER-2520): rc.10's statuses or `all`; `ended` only while the record command is offered (rc.19
  added it with the command); any other value is refused `invalid_fields`;
- `record_answer`: `ok` | an error code (answered as a refusal) | `drop` (no answer: the caller's timeout makes it unknown) - and with
  `record_then_drop` the fake STORES the record before dropping the answer (the "written but not answered" case)."""
from __future__ import annotations

import copy
import re
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fake_wiskey import FakeWiskey, fail, ok

RECORD = "visits/record_external_v1"
HA_ID = "ha-user-0000000000000000000000000001"
LIST_STATUSES = {"all", "pending", "approved", "rejected", "cancelled", "superseded"}
RECORD_FIELDS = {"external_ref", "arx_revision", "user_id", "status", "valid_from", "valid_until", "doors", "approval", "end_reason"}
_INSTANT = r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?(?:Z|[+-][0-9]{2}:[0-9]{2})"


class Refused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _text(value: Any, maximum: int) -> str:  # models.text_field
    if not isinstance(value, str) or len(value) > maximum or not value.strip() or any(ord(c) < 32 for c in value):
        raise Refused("invalid_text")
    return value.strip()


def _reference(value: Any, maximum: int = 128) -> str:  # external_visits.reference
    normalized = _text(value, maximum)
    if normalized != value or "\x7f" in normalized:
        raise Refused("invalid_fields")
    return normalized


def _instant(value: Any) -> str:  # external_visits.instant
    try:
        value = _reference(value, 40)
        if not re.fullmatch(_INSTANT, value):
            raise ValueError
        when = datetime.fromisoformat(value)
        if when.tzinfo is None:
            raise ValueError
        return when.astimezone(UTC).isoformat(timespec="seconds")
    except (ValueError, OverflowError, TypeError, Refused):
        raise Refused("invalid_fields") from None


def _uuid(value: Any) -> str:  # models.uuid_text
    try:
        if not isinstance(value, str) or str(UUID(value)) != value:
            raise ValueError
    except (ValueError, AttributeError):
        raise Refused("invalid_id") from None
    return value


def normalized_record(value: Any) -> dict[str, Any]:
    """external_visits.record: the closed, normalized record, or Refused with the producer's code."""
    if type(value) is not dict or set(value) != RECORD_FIELDS:
        raise Refused("invalid_fields")
    revision = value["arx_revision"]
    if type(revision) is not int or not 1 <= revision <= 9_007_199_254_740_991:
        raise Refused("invalid_fields")
    if type(value["status"]) is not str or value["status"] not in {"approved", "ended"}:
        raise Refused("invalid_fields")
    start, end = _instant(value["valid_from"]), _instant(value["valid_until"])
    first, last = datetime.fromisoformat(start), datetime.fromisoformat(end)
    if not datetime(1970, 1, 1, tzinfo=UTC) <= first < last <= datetime(2037, 12, 31, 23, 59, 59, tzinfo=UTC):
        raise Refused("invalid_validity")
    doors = value["doors"]
    if type(doors) is not dict or not 1 <= len(doors) <= 100:
        raise Refused("invalid_fields")
    clean = {}
    for station, locks in doors.items():
        _reference(station, 64)
        if type(locks) is not list or not 1 <= len(locks) <= 2 or any(type(x) is not int or x not in {1, 2} for x in locks) or len(set(locks)) != len(locks):
            raise Refused("invalid_fields")
        clean[station] = sorted(locks)
    approval = value["approval"]
    if type(approval) is not dict or set(approval) != {"kind", "approved_at", "approver_ref"}:
        raise Refused("invalid_fields")
    reason = value["end_reason"]
    if value["status"] == "approved":
        if reason is not None:
            raise Refused("invalid_fields")
    else:
        reason = _reference(reason)
    return {"external_ref": _reference(value["external_ref"]), "arx_revision": revision, "user_id": _uuid(value["user_id"]), "status": value["status"],
            "valid_from": start, "valid_until": end, "doors": clean,
            "approval": {"kind": _reference(approval["kind"], 64), "approved_at": _instant(approval["approved_at"]),
                         "approver_ref": _reference(approval["approver_ref"])},
            "end_reason": reason}


def visit_uuid(n: int) -> str:
    return f"00000000-0000-4000-8000-{n:012d}"
BAIT = (HA_ID, "responsible-bait", "purpose-bait", "900000123")


def wiskey_visit(vid: str, user_id: str, *, status: str = "approved", name: str = "אורח וויסקי", source: str | None = None, external_ref: str | None = None,
                 sequence: int = 1) -> dict[str, Any]:
    row = {"id": vid, "user_id": user_id, "user_revision": 3, "approver_id": HA_ID, "requested_by": "ha-user-2", "requested_at": "2026-11-06T08:00:00+00:00",
           "sequence": sequence, "revision": 2 if status != "pending" else 1, "status": status, "decided_by": HA_ID if status != "pending" else "",
           "decided_at": "2026-11-06T08:05:00+00:00" if status != "pending" else None, "reason_code": "approved" if status == "approved" else "",
           "activated_revision": 4 if status == "approved" else None,
           "snapshot": {"display_name": name, "employee_no": "900000123", "access_category": "visitor", "responsible_person": "responsible-bait",
                        "access_purpose": "purpose-bait", "valid_from": "2026-11-06T08:00:00+00:00", "valid_until": "2026-11-06T18:00:00+00:00",
                        "pin_configured": True, "enabled_cards": 1, "doors": {"entry-a": [1]}, "timing_schedule": None},
           "stale": False, "user_deleted": False}
    if source:
        row["source"], row["external_ref"] = source, external_ref
    return row


class VisitsFake(FakeWiskey):
    def __init__(self, *a: Any, **kw: Any) -> None:
        super().__init__(*a, **kw)
        self.visits: list[dict[str, Any]] = [wiskey_visit("v-wk-1", "wk-person-9", status="pending", sequence=1),
                                             wiskey_visit("v-wk-2", "wk-person-8", sequence=2)]
        self.templates = {"revision": 3, "items": [
            {"id": "tpl-b", "label": "קבלן יומי", "access_category": "contractor", "responsible_person": "responsible-bait", "access_purpose": "purpose-bait",
             "duration_minutes": 600, "doors": {"entry-a": [1, 2]}, "weekly_timing": None, "updated_at": "2026-11-01T10:00:00+00:00", "updated_by": HA_ID},
            {"id": "tpl-a", "label": "אורח לשעתיים", "access_category": "visitor", "responsible_person": "responsible-bait", "access_purpose": "",
             "duration_minutes": 120, "doors": {"entry-a": [1]}, "weekly_timing": {"mode": "weekly"}, "updated_at": "2026-11-01T10:00:00+00:00", "updated_by": HA_ID},
        ]}
        self.offer_record = False
        self.record_answer = "ok"
        self.record_then_drop = False
        self.records: dict[str, dict[str, Any]] = {}
        self.record_frames = 0  # every record frame that reached the fake
        self.stored = 0  # every record frame that changed the store

    def _listed(self, auth: dict[str, Any], fixture_list: list[str]) -> list[str]:
        listed = super()._listed(auth, fixture_list)
        return sorted({*listed, RECORD}) if self.offer_record and RECORD not in self.unlisted else listed

    def _refusal(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> str | None:
        if command == RECORD:
            if not self.offer_record:
                return "unknown_command"
            if set(msg) != {"id", "type", "api_contract", "record"} or msg.get("api_contract") != 1:
                return "invalid_format"
            return "unauthorized" if self.forbidden is True or (isinstance(self.forbidden, set) and command in self.forbidden) else None
        return super()._refusal(command, msg, auth)

    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command == "visits/list":
            filters = msg.get("filters") or {}
            allowed = {"status", "scope", "query"} | ({"external_ref"} if self.offer_record else set())
            if set(filters) - allowed:
                return [fail(msg, "invalid_fields")]
            status = filters.get("status", "all")
            # rc.10 access/visit_requests.py: `STATUSES | {"all"}`; rc.19 adds `ended` with the record command (WISKEY-VISITS-ENDED-FILTER-2520)
            if status not in LIST_STATUSES | ({"ended"} if self.offer_record else set()):
                return [fail(msg, "invalid_fields")]
            rows = sorted(self.visits, key=lambda r: r["sequence"], reverse=True)
            rows = [r for r in rows if status == "all" or r["status"] == status]
            if "external_ref" in filters:  # exact, case sensitive; native rows (external_ref None) never match
                rows = [r for r in rows if r.get("source") == "arx" and r.get("external_ref") == filters["external_ref"]]
            page = rows[msg["offset"]: msg["offset"] + msg["limit"]]
            nxt = msg["offset"] + msg["limit"] if msg["offset"] + msg["limit"] < len(rows) else None
            return [ok(msg, {"revision": len(self.visits), "items": copy.deepcopy(page), "total": len(rows), "offset": msg["offset"], "next_offset": nxt,
                             "filters": {"status": status, "scope": "all", "query": "", **({"external_ref": filters["external_ref"]} if "external_ref" in filters else {})}})]
        if command == "guest_templates/get":
            return [ok(msg, copy.deepcopy(self.templates))]
        if command == RECORD:
            return self._record(msg)
        return super()._answer(command, msg, auth)

    def _record(self, msg: dict[str, Any]) -> list[Any]:
        rec = msg["record"]
        self.record_frames += 1
        if self.record_answer == "drop":
            return []  # nothing stored, no answer frame: the caller's wait runs out (outcome unknown)
        if self.record_answer not in ("ok", "drop_after_store"):
            return [fail(msg, self.record_answer)]
        try:
            incoming = normalized_record(rec)
        except Refused as exc:
            return [fail(msg, exc.code)]
        ref = incoming["external_ref"]
        held = self.records.get(ref)
        if held is not None:
            if incoming["arx_revision"] < held["arx_revision"]:
                return [fail(msg, "visit_record_stale")]
            if held.get("record") and incoming["user_id"] != held["record"]["user_id"]:
                return [fail(msg, "revision_conflict")]
            if incoming["arx_revision"] == held["arx_revision"]:
                if held.get("record") != incoming:
                    return [fail(msg, "revision_conflict")]
                return [ok(msg, {"visit_id": held["visit_id"], "revision": held["revision"], "arx_revision": held["arx_revision"], "status": held["status"]})]
        self.stored += 1
        vid = held["visit_id"] if held else visit_uuid(800 + len(self.records) + 1)
        revision = held["revision"] + 1 if held else 1
        self.records[ref] = {"visit_id": vid, "revision": revision, "arx_revision": incoming["arx_revision"], "status": incoming["status"],
                             "record": copy.deepcopy(incoming)}
        self.visits = [v for v in self.visits if v.get("external_ref") != ref]
        row = wiskey_visit(vid, incoming["user_id"], status=incoming["status"], source="arx", external_ref=ref,
                           sequence=max((v["sequence"] for v in self.visits), default=0) + 1)
        # rc.19 external_visits.project: the record's own fields + the list's common ones, no native approver
        row.update({k: copy.deepcopy(incoming[k]) for k in RECORD_FIELDS})
        row.update(revision=revision, approver_id="", decided_by="", reason_code="", decided_at=incoming["approval"]["approved_at"],
                   activated_revision=None, format="wiskey-external-visit.v1", recorded_by="arx-addon")
        self.visits.append(row)
        if self.record_then_drop or self.record_answer == "drop_after_store":
            return []  # stored, but no answer frame: the caller's wait runs out (outcome unknown)
        return [ok(msg, {"visit_id": vid, "revision": revision, "arx_revision": incoming["arx_revision"], "status": incoming["status"]})]
