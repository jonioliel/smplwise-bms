"""WISKEY-VISITS-2407: the fake WisKey's visit side (no device, no Home Assistant, no WisKey).

- `visits/list` and `guest_templates/get` answer with rc.10's shapes (access/visit_requests.py `public`, access/guest_templates.py `public`),
  synthetic values, with bait WisKey really sends and Arx must drop: HA user ids (`requested_by`, `approver_id`, `decided_by`, `updated_by`),
  the employee number, the responsible person, the purpose text and the credential flags;
- `visits/record_external_v1` is NOT in rc.10: it is answered only while `offer_record` is True (and then listed in `overview.api.commands`),
  with the ask's semantics (docs/changes/WISKEY-VISITS-2407.md section 4): an upsert keyed by `external_ref`, the highest `arx_revision`
  kept, an older one refused `visit_record_stale` before anything is stored, the same one answered again (idempotent);
- `record_answer`: `ok` | an error code (answered as a refusal) | `drop` (no answer: the caller's timeout makes it unknown) - and with
  `record_then_drop` the fake STORES the record before dropping the answer (the "written but not answered" case)."""
from __future__ import annotations

import copy
from typing import Any

from fake_wiskey import FakeWiskey, fail, ok

RECORD = "visits/record_external_v1"
HA_ID = "ha-user-0000000000000000000000000001"
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
            rows = sorted(self.visits, key=lambda r: r["sequence"], reverse=True)
            status = (msg.get("filters") or {}).get("status", "all")
            rows = [r for r in rows if status == "all" or r["status"] == status]
            page = rows[msg["offset"]: msg["offset"] + msg["limit"]]
            nxt = msg["offset"] + msg["limit"] if msg["offset"] + msg["limit"] < len(rows) else None
            return [ok(msg, {"revision": len(self.visits), "items": copy.deepcopy(page), "total": len(rows), "offset": msg["offset"], "next_offset": nxt,
                             "filters": {"status": status, "scope": "all", "query": ""}})]
        if command == "guest_templates/get":
            return [ok(msg, copy.deepcopy(self.templates))]
        if command == RECORD:
            return self._record(msg)
        return super()._answer(command, msg, auth)

    def _record(self, msg: dict[str, Any]) -> list[Any]:
        rec = msg["record"]
        if self.record_answer == "drop":
            return []  # nothing stored, no answer frame: the caller's wait runs out (outcome unknown)
        if self.record_answer != "ok":
            return [fail(msg, self.record_answer)]
        ref = rec["external_ref"]
        held = self.records.get(ref)
        if held is not None and held["arx_revision"] > rec["arx_revision"]:
            return [fail(msg, "visit_record_stale")]
        vid = held["visit_id"] if held else f"v-arx-{len(self.records) + 1}"
        self.records[ref] = {"visit_id": vid, "arx_revision": rec["arx_revision"], "status": rec["status"], "record": copy.deepcopy(rec)}
        self.visits = [v for v in self.visits if v.get("external_ref") != ref]
        self.visits.append({**wiskey_visit(vid, rec["user_id"], status="approved" if rec["status"] == "approved" else "cancelled", source="arx", external_ref=ref,
                                           sequence=max((v["sequence"] for v in self.visits), default=0) + 1)})
        if self.record_then_drop:
            return []  # stored, but no answer frame: the caller's wait runs out (outcome unknown)
        return [ok(msg, {"visit_id": vid, "revision": 1, "arx_revision": rec["arx_revision"], "status": rec["status"]})]
