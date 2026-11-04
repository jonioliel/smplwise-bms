"""WISKEY-PROFILES-EDIT-2390 (plan 2026-11-03 T8): the groups and profile fields editor end to end over the add-on's live service
session against a STATEFUL fake WisKey (tests/fake_wiskey.py, extended here with rc.10's policy behaviour: `profiles/settings_get`,
`profiles/versions`, `profiles/versions_compare`, `profiles/settings_preview`, `profiles/settings_apply`, `users/group_suggestions`).
Nothing contacts a device, a station, Home Assistant or WisKey.

What is proven:
- the exact frames (the pinned catalog's key sets, `api_contract` on the two non-READ commands) on the closed `profiles` channel;
  `profiles/settings_update` is never sent and no channel lets it through;
- the gate: `access.people.manage` at installation scope - a station-scoped holder, a holder with a deny somewhere, an operator: audited
  403, nothing sent; `/profiles/access` answers without a 403;
- preview: WisKey's impact (people before / after, stations, offline, field diagnostics) through an Arx review; WisKey's operation id never
  reaches the browser; a bad draft (WisKey's limits, a removed definition, a condition cycle, an unmanaged lock) is refused before sending;
- apply: confirmation + envelope required; the reviewed policy is saved once; the audit rows hold the diff before -> after and no value;
  the readback says whether WisKey now serves the confirmed policy; a second confirmation answers the stored result without sending;
- refusal / conflict / stale: a stale base revision (Arx and WisKey), a review WisKey calls stale or expired, a unique-field duplicate,
  another user's review, an expired Arx review;
- unknown: an unclear apply answer blocks the review until a readback `check` says applied / not applied / changed elsewhere;
- versions, compare, the rollback draft (exact where WisKey versions it, notes where it cannot be) and the group suggestions (values
  only for the sensitive level)."""
from __future__ import annotations

import copy
import json
import time
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX, FakeWiskey, fail, ok
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.db import Database
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_sync, wiskey_channels
from smplwise.services import wiskey_profiles as wp

API = "/api/v1/access-control/profiles"

BASE_VALUES: dict[str, Any] = {
    "photo_enabled": True,
    "fields": [
        {"id": "department", "label": "מחלקה", "enabled": True, "type": "select", "required": False, "unique": False, "depends_on": None, "options": ["הנדסה", "ביטחון"]},
        {"id": "badge", "label": "מספר תג", "enabled": True, "type": "text", "required": False, "unique": False, "depends_on": None, "options": []},
    ],
    "groups": [
        {"id": "staff", "label": "צוות", "enabled": True, "station_ids": ["entry-a", "entry-b"]},
        {"id": "night", "label": "משמרת לילה", "enabled": True, "station_ids": ["entry-c"]},
        {"id": "visitors", "label": "מבקרים", "enabled": False},
    ],
    "templates": [{"id": "guest", "label": "Guest", "enabled": True, "profile": {"department": "SECRET-TEMPLATE-VALUE"}, "group_ids": ["visitors"]}],
}
PEOPLE = [
    {"id": "p-dana", "display_name": "דנה לוי", "employee_no": "E-100", "group_ids": ["staff"], "profile": {"department": "הנדסה", "badge": "B-7"}, "active": True, "revision": 3},
    {"id": "p-omer", "display_name": "עומר כהן", "employee_no": "E-101", "group_ids": ["night"], "profile": {"department": "ביטחון", "badge": "B-7"}, "active": True, "revision": 1},
    {"id": "p-yael", "display_name": "יעל בר", "employee_no": "E-102", "group_ids": ["staff", "night"], "profile": {"department": "הנדסה"}, "active": True, "revision": 2},
]


def _rows(before: dict[str, Any], after: dict[str, Any]) -> list[dict[str, Any]]:
    """rc.10 access/policy_versions.rows (ported for the fake; the parent's label decoration included, as WisKey sends it)."""
    out = []
    for kind, props in (("fields", ("label", "enabled", "type", "required", "unique", "options", "depends_on")), ("groups", ("label", "enabled", "station_ids"))):
        old, new = ({v["id"]: v for v in side[kind]} for side in (before, after))
        for key in sorted(old.keys() | new.keys()):
            a, b = old.get(key), new.get(key)
            changes = []
            for prop in props:
                left, right = a.get(prop) if a else None, b.get(prop) if b else None
                if left != right:
                    left, right = copy.deepcopy(left), copy.deepcopy(right)
                    if prop == "depends_on":
                        for value, defs in ((left, old), (right, new)):
                            if value:
                                value["field_label"] = defs.get(value["field_id"], {}).get("label", value["field_id"])
                    changes.append({"property": prop, "before": left, "after": right})
            if a is None or b is None or changes:
                out.append({"kind": kind, "id": key, "label": (b or a or {}).get("label", key), "state": "added" if a is None else "removed" if b is None else "changed",
                            "changes": changes})
    return out


class ProfilesFake(FakeWiskey):
    """The fake WisKey with rc.10's policy behaviour (stateful). Switches: `apply_unclear` (`save` | `nosave`: the apply answers an
    unclear code after / without saving), `stale_after_preview` (WisKey calls the next apply stale), `fail_with` per command."""

    def __init__(self, *a: Any, **kw: Any) -> None:
        super().__init__(*a, **kw)
        self.values = copy.deepcopy(BASE_VALUES)
        self.revision = 7
        self.versions = [{"revision": 5, "saved_at": "2026-10-30T08:00:00+00:00", "actor": "ha-user-secret-id", "action": "profiles/settings_update", "origin": "saved",
                          "values": self._older()},
                         {"revision": 7, "saved_at": "2026-11-01T08:00:00+00:00", "actor": "ha-user-secret-id", "action": "bulk/group_policy", "origin": "saved",
                          "values": copy.deepcopy(self.values)}]
        self.people = copy.deepcopy(PEOPLE)
        self.reviews: dict[str, dict[str, Any]] = {}
        self.receipts: dict[str, dict[str, Any]] = {}
        self.apply_unclear: str | None = None
        self.stale_after_preview = False
        self.fail_with: dict[str, str] = {}

    @staticmethod
    def _older() -> dict[str, Any]:
        v = copy.deepcopy(BASE_VALUES)
        v["fields"] = v["fields"][:1]  # `badge` was added after revision 5
        v["fields"][0]["label"] = "יחידה"
        v["groups"][0]["station_ids"] = ["entry-a"]
        return v

    def public(self) -> dict[str, Any]:
        return {"revision": self.revision, **copy.deepcopy(self.values)}

    def _save(self, values: dict[str, Any], action: str) -> None:
        self.revision += 1
        self.values = copy.deepcopy(values)
        self.versions.append({"revision": self.revision, "saved_at": "2026-11-03T10:00:00+00:00", "actor": "ha-user-secret-id", "action": action, "origin": "saved",
                              "values": copy.deepcopy(values)})

    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command in self.fail_with:
            return [fail(msg, self.fail_with[command])]
        if command == "profiles/settings_get":
            return [ok(msg, self.public())]
        if command == "profiles/versions":
            records = []
            for i, item in enumerate(self.versions):
                diff = _rows(self.versions[i - 1]["values"], item["values"]) if i else []
                records.append({**{k: item[k] for k in ("revision", "saved_at", "actor", "action", "origin")}, "field_changes": sum(r["kind"] == "fields" for r in diff),
                                "group_changes": sum(r["kind"] == "groups" for r in diff)})
            records.reverse()
            o, n = msg["offset"], msg["limit"]
            return [ok(msg, {"records": records[o:o + n], "total": len(records), "offset": o, "next_offset": o + n if o + n < len(records) else None,
                             "previous_offset": max(0, o - n) if o else None, "current_revision": self.revision, "retained_from_revision": self.versions[0]["revision"],
                             "read_only": True, "history_complete": False})]
        if command == "profiles/versions_compare":
            by = {v["revision"]: v for v in self.versions}
            if msg["before_revision"] not in by or msg["after_revision"] not in by:
                return [fail(msg, "policy_version_not_found")]
            rows = _rows(by[msg["before_revision"]]["values"], by[msg["after_revision"]]["values"])
            return [ok(msg, {"before_revision": msg["before_revision"], "after_revision": msg["after_revision"], "rows": rows,
                             "summary": {"fields": sum(r["kind"] == "fields" for r in rows), "groups": sum(r["kind"] == "groups" for r in rows)},
                             "read_only": True, "physical_result": "not_verified"})]
        if command == "profiles/settings_preview":
            if msg["revision"] != self.revision:
                return [fail(msg, "revision_conflict")]
            proposed = {**copy.deepcopy(msg["values"]), "templates": copy.deepcopy(self.values["templates"])}
            for kind in ("fields", "groups"):
                if {v["id"] for v in self.values[kind]} - {v["id"] for v in proposed[kind]}:
                    return [fail(msg, "profile_definition_in_use")]
            old = {g["id"]: g for g in self.values["groups"]}
            changed_groups = {g["id"] for g in proposed["groups"] if (g["enabled"], set(g.get("station_ids", []))) !=
                              (old.get(g["id"], {"enabled": True})["enabled"], set(old.get(g["id"], {}).get("station_ids", [])))}
            grants = {g["id"]: set(g.get("station_ids", [])) if g["enabled"] else set() for g in proposed["groups"]}
            was = {g["id"]: set(g.get("station_ids", [])) if g["enabled"] else set() for g in self.values["groups"]}
            rows, stations, changed = [], set(), 0
            for p in self.people:
                before = sorted(set().union(*(was.get(g, set()) for g in p["group_ids"])))
                after = sorted(set().union(*(grants.get(g, set()) for g in p["group_ids"])))
                if before != after:
                    changed += 1
                    stations |= set(before) | set(after)
                if changed_groups & set(p["group_ids"]):
                    rows.append({"user_id": p["id"], "display_name": p["display_name"], "employee_no": p["employee_no"], "before": before, "after": after,
                                 "overrides": {"entry-c": "deny"} if p["id"] == "p-yael" else {}, "changed": before != after})
            field_changes = []
            old_fields = {f["id"]: f for f in self.values["fields"]}
            for f in proposed["fields"]:
                if old_fields.get(f["id"]) == f:
                    continue
                values = [p["profile"].get(f["id"], "") for p in self.people]
                dup = [p for p in self.people if f.get("unique") and p["profile"].get(f["id"]) and values.count(p["profile"][f["id"]]) > 1]
                missing = sum(1 for v in values if f.get("required") and not v)
                field_changes.append({"field_id": f["id"], "label": f["label"], "before": old_fields.get(f["id"]), "after": f, "checked": len(self.people),
                                      "applicable": len(self.people), "inactive": 0, "newly_applicable": 0, "missing": missing, "invalid": 0, "previous_issues": 0,
                                      "examples": [{"user_id": p["id"], "display_name": p["display_name"], "employee_no": p["employee_no"], "reason": "profile_required",
                                                    "archived": False} for p in self.people if f.get("required") and not p["profile"].get(f["id"])][:20],
                                      "examples_truncated": False, "duplicates": len(dup),
                                      "duplicate_examples": [{"user_id": p["id"], "display_name": p["display_name"], "employee_no": p["employee_no"], "archived": False}
                                                             for p in dup], "duplicate_examples_truncated": False, "template_issues": 0})
            op = uuid.uuid4().hex
            blocked = any(fc["duplicates"] for fc in field_changes)
            self.reviews[op] = {"revision": self.revision, "values": proposed, "blocked": blocked, "stations": sorted(stations)}
            return [ok(msg, {"rows": rows, "changed": changed, "stations": sorted(stations), "field_changes": field_changes, "operation_id": op, "can_apply": not blocked,
                             "requires_confirmation": bool(changed_groups or field_changes), "expires_in": 300, "device_writes": 0,
                             "offline": sorted(s for s in stations if s in self.offline)})]
        if command == "profiles/settings_apply":
            op = msg["operation_id"]
            if op in self.receipts:
                return [ok(msg, copy.deepcopy(self.receipts[op]))]
            review = self.reviews.get(op)
            if review is None:
                return [fail(msg, "bulk_review_expired")]
            if self.stale_after_preview:
                return [fail(msg, "bulk_review_stale")]
            if review["blocked"]:
                return [fail(msg, "profile_value_not_unique")]
            if review["revision"] != self.revision:
                return [fail(msg, "revision_conflict")]
            if self.apply_unclear == "nosave":
                return [fail(msg, "storage_or_internal_error")]
            self._save(review["values"], "bulk/group_policy")
            receipt = {"operation_id": op, "actor": "ha-user-secret-id", "action": "bulk/group_policy", "saved_at": "2026-11-03T10:00:00+00:00",
                       "stations": review["stations"], "user_ids": ["p-dana", "p-yael"], "changed": 2}
            self.receipts[op] = receipt
            if self.apply_unclear == "save":
                return [fail(msg, "storage_or_internal_error")]
            return [ok(msg, copy.deepcopy(receipt))]
        if command == "users/group_suggestions":
            target = next((p for p in self.people if p["id"] == msg["user_id"]), None)
            if target is None:
                return [fail(msg, "comparison_not_found")]
            if any(f not in target["profile"] for f in msg["field_ids"]):
                return [fail(msg, "field_access_denied")]
            return [ok(msg, {"user_id": target["id"], "person_revision": target["revision"], "policy_revision": self.revision,
                             "fields": [{"id": k, "label": k, "value": v} for k, v in target["profile"].items()], "selected_fields": msg["field_ids"],
                             "suggestions": [{"group_id": "night", "label": "משמרת לילה", "matching_members": 1, "matching_people": 2,
                                              "doors": [{"station_id": "entry-c", "station_name": "Side door", "blocked": False, "before": [], "after": [1]}]}],
                             "read_only": True, "scope": "caller_projected", "can_apply_to_draft": True, "physical_result": "not_verified", "fingerprint": "f" * 64})]
        return super()._answer(command, msg, auth)


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


def wait_for(pred: Any, timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


@pytest.fixture()
def wx(settings, monkeypatch, station_scope):  # noqa: F811
    """root (system_admin, installation) and lead (site_admin, installation): people.manage unrestricted - mia (site_admin on entry-a only)
    - otto (operator) - tech (a custom role with people.manage at the installation, DENIED on entry-c) - pat (people.manage at the
    installation WITHOUT the sensitive level)."""
    import websockets

    fake = ProfilesFake("admin", token="t")
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("USER_BURST", "GLOBAL_BURST", "CONFIG_USER_BURST", "CONFIG_GLOBAL_BURST"):
        if hasattr(intercom_sync, name):
            monkeypatch.setattr(intercom_sync, name, 1000.0)
    wp.reset()
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "lead", "site_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    c.get("/api/v1/me", headers=as_user("mia"))
    station_scope.bind("dev-mia", "site_admin", "entry-a")
    role = c.post("/api/v1/access/roles", json={"name": "people admin", "description": "T8 test", "permissions": ["access.read", "access.people.read"],
                                                 "sensitive": [ia.PEOPLE_MANAGE]})
    assert role.status_code == 201, role.text
    bind(c, s, "tech", role.json()["id"], "installation", "*")
    bind(c, s, "pat", role.json()["id"], "installation", "*")
    deny = c.post("/api/v1/access/roles", json={"name": "no people admin", "description": "T8 test", "permissions": [], "sensitive": [ia.PEOPLE_MANAGE]})
    assert deny.status_code == 201, deny.text
    station_scope.bind("dev-tech", deny.json()["id"], "entry-c", effect="deny")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    wp.reset()


def sent(fake: FakeWiskey, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def audit_rows(settings: Any, action: str) -> list[dict[str, Any]]:
    with Database(settings.db_path).connection() as conn:
        out = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]
    for r in out:
        r["details"] = json.loads(r["details_json"]) if r["details_json"] else {}
    return out


def draft(c: TestClient, user: str = "root") -> dict[str, Any]:
    body = c.get(API, headers=as_user(user)).json()
    policy = body["policy"]
    return {"revision": policy["revision"], "values": {"photo_enabled": policy["photo_enabled"], "fields": policy["fields"], "groups": policy["groups"]}}


def preview(c: TestClient, d: dict[str, Any], user: str = "root") -> Any:
    return c.post(f"{API}/preview", json=d, headers=as_user(user))


def apply(c: TestClient, review_id: str, user: str = "root", **body: Any) -> Any:
    return c.post(f"{API}/apply", json=env(**{"review_id": review_id, "confirmed": True, **body}), headers=as_user(user))


def widen_staff(d: dict[str, Any]) -> dict[str, Any]:
    d = copy.deepcopy(d)
    d["values"]["groups"][0]["station_ids"] = ["entry-a", "entry-b", "entry-c"]
    return d


# ---------------------------------------------------------------- the channel

def test_the_profiles_channel_is_exactly_its_four_commands_and_settings_update_is_on_no_channel():
    assert wiskey_channels.PROFILES == wp.COMMANDS
    assert "profiles" in wiskey_channels.ADAPTER_CHANNELS and wiskey_channels.HA_FRAMES["profiles"] == frozenset()
    for channel in wiskey_channels.ALLOWLISTS:
        assert not wiskey_channels.allowed(channel, PREFIX + "profiles/settings_update"), channel
        for command in ("profiles/settings_preview", "profiles/settings_apply"):
            assert wiskey_channels.allowed(channel, PREFIX + command) == (channel == "profiles"), (channel, command)
    for other in ("users/update", "stations/test_unlock", "profiles/settings_update", "overview", "users/bulk_apply"):
        assert not wiskey_channels.allowed("profiles", PREFIX + other), other
    assert not (wiskey_channels.PROFILES & wiskey_channels.SERVICE_WRITES)


# ---------------------------------------------------------------- the gate

def test_access_answers_without_a_403(wx):
    _fake, c, _s = wx
    assert c.get(f"{API}/access", headers=as_user("root")).json() == {"can_edit": True, "sensitive": True}
    assert c.get(f"{API}/access", headers=as_user("lead")).json()["can_edit"] is True
    for user in ("mia", "otto", "tech"):
        assert c.get(f"{API}/access", headers=as_user(user)).json() == {"can_edit": False, "sensitive": False}, user
    assert c.get(f"{API}/access", headers=as_user("pat")).json() == {"can_edit": True, "sensitive": False}


@pytest.mark.parametrize("user", ["mia", "otto", "tech"])
def test_without_people_manage_at_installation_scope_everything_is_refused_and_audited(wx, user):
    fake, c, s = wx
    before = len(fake.received)
    assert c.get(API, headers=as_user(user)).status_code == 403
    r = c.post(f"{API}/preview", content=b"not json", headers={**as_user(user), "content-type": "text/plain"})
    assert r.status_code == 403, r.text
    assert c.post(f"{API}/apply", json=env(review_id="0" * 32, confirmed=True), headers=as_user(user)).status_code == 403
    assert c.get(f"{API}/versions", headers=as_user(user)).status_code == 403
    assert c.get(f"{API}/suggestions?user_id=p-dana", headers=as_user(user)).status_code == 403
    assert len(fake.received) == before
    with Database(s.db_path).connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'denied' AND actor_user_id = ?", (ia.PEOPLE_MANAGE, f"dev-{user}")).fetchone()[0]
    assert denied >= 5


# ---------------------------------------------------------------- view

def test_the_view_has_the_policy_the_stations_and_no_template_values(wx):
    _fake, c, _s = wx
    r = c.get(API, headers=as_user("root"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "ready" and body["policy"]["revision"] == 7 and body["policy"]["templates"] == 1
    assert [f["id"] for f in body["policy"]["fields"]] == ["department", "badge"]
    assert body["policy"]["groups"][2] == {"id": "visitors", "label": "מבקרים", "enabled": False, "station_ids": None}
    assert {s["id"] for s in body["stations"]} == {"entry-a", "entry-b", "entry-c"}
    assert all(body["features"][k]["available"] for k in wp.FEATURES)
    assert "SECRET-TEMPLATE-VALUE" not in r.text


def test_an_unlisted_command_makes_the_part_unsupported_and_nothing_is_sent(wx):
    fake, c, s = wx
    fake.unlist("profiles/settings_apply")
    fake.push("refresh")  # the discovery comes with the overview: WisKey's refresh makes the feed read it again
    wait_for(lambda: wp.feature_state(intercom_sync.SYNC.api_facts(s), "edit")[0] is False)
    body = c.get(API, headers=as_user("root")).json()
    assert body["features"]["edit"] == {"available": False, "reason": "not_listed"}
    r = preview(c, draft(c))
    assert r.status_code == 409 and r.json()["code"] == "profiles_unsupported"
    assert not sent(fake, "profiles/settings_preview")


# ---------------------------------------------------------------- preview

def test_preview_sends_the_catalog_frame_and_answers_the_impact_through_an_arx_review(wx):
    fake, c, s = wx
    r = preview(c, widen_staff(draft(c)))
    assert r.status_code == 200, r.text
    body = r.json()
    frames = sent(fake, "profiles/settings_preview")
    assert len(frames) == 1 and set(frames[0]) == {"id", "type", "revision", "values", "api_contract"} and frames[0]["api_contract"] == 1
    assert set(frames[0]["values"]) == {"photo_enabled", "fields", "groups"}, "templates are never sent (WisKey keeps them)"
    assert "SECRET-TEMPLATE-VALUE" not in json.dumps(frames[0])
    operation_id = next(iter(fake.reviews))
    assert operation_id not in r.text, "WisKey's operation id never reaches the browser"
    assert len(body["review_id"]) == 32 and body["base_revision"] == 7
    impact = body["impact"]
    assert impact["changed"] == 1 and impact["stations"] == ["entry-a", "entry-b", "entry-c"] and impact["can_apply"] is True and impact["device_writes"] == 0
    dana = next(p for p in impact["people"] if p["user_id"] == "p-dana")
    assert dana["before"] == ["entry-a", "entry-b"] and dana["after"] == ["entry-a", "entry-b", "entry-c"] and dana["employee_no"] == "E-100"
    assert next(p for p in impact["people"] if p["user_id"] == "p-yael")["overrides"] == 1, "only how many overrides, never their content"
    assert impact["station_names"]["entry-c"]
    assert body["diff"] == [{"kind": "groups", "id": "staff", "label": "צוות", "state": "changed",
                             "changes": [{"property": "station_ids", "before": ["entry-a", "entry-b"], "after": ["entry-a", "entry-b", "entry-c"]}]}]
    assert not sent(fake, "profiles/settings_apply") and not sent(fake, "profiles/settings_update")
    row = audit_rows(s, "intercom.profiles_preview")[-1]
    assert row["decision"] == "allowed" and row["details"]["changed"] == 1 and row["details"]["review_id"] == body["review_id"]
    assert operation_id not in json.dumps(row)


def test_the_employee_number_needs_the_sensitive_level(wx):
    _fake, c, _s = wx
    body = preview(c, widen_staff(draft(c, "pat")), "pat").json()
    assert all(p["employee_no"] is None for p in body["impact"]["people"])


@pytest.mark.parametrize("mutate,code", [
    (lambda v: v["fields"].append({"id": "Bad Id", "label": "x", "enabled": True, "type": "text", "required": False, "unique": False, "options": [], "depends_on": None}),
     "profiles_invalid_draft"),
    (lambda v: v["fields"].__setitem__(0, {**v["fields"][0], "type": "select", "options": []}), "profiles_invalid_draft"),
    (lambda v: v["fields"].__setitem__(0, {**v["fields"][0], "depends_on": {"field_id": "badge", "value": "x"}}) or
     v["fields"].__setitem__(1, {**v["fields"][1], "depends_on": {"field_id": "department", "value": "הנדסה"}}), "profiles_invalid_draft"),
    (lambda v: v["fields"].extend({"id": f"f{i}", "label": "x", "enabled": True, "type": "text", "required": False, "unique": False, "options": [], "depends_on": None}
                                  for i in range(11)), "profiles_invalid_draft"),
    (lambda v: v["groups"].pop(), "profiles_definition_removed"),
    (lambda v: v["groups"][0]["station_ids"].append("no-such-station"), "profiles_invalid_draft"),
])
def test_a_bad_draft_is_refused_before_anything_is_sent(wx, mutate, code):
    fake, c, s = wx
    d = draft(c)
    mutate(d["values"])
    r = preview(c, d)
    assert r.status_code == 422 and r.json()["code"] == code, r.text
    assert r.json()["details"]["outcome"] == "not_sent"
    assert not sent(fake, "profiles/settings_preview")
    assert audit_rows(s, "intercom.profiles_preview")[-1]["details"]["phase"] == "refused"


def test_an_unmanaged_lock_is_refused_before_sending(wx):
    fake, c, _s = wx
    fake.overview["stations"][2]["lock_enabled"] = False
    fake.push("refresh")
    wait_for(lambda: not (intercom_sync.SYNC.station("entry-c") or {}).get("lock_enabled", True))
    r = preview(c, widen_staff(draft(c)))
    assert r.status_code == 422 and r.json()["code"] == "profiles_unmanaged_lock" and r.json()["details"]["stations"] == ["entry-c"]
    assert not sent(fake, "profiles/settings_preview")


def test_a_condition_is_mirrored_and_sent_as_wiskey_defines_it(wx):
    fake, c, _s = wx
    d = draft(c)
    d["values"]["fields"][1]["depends_on"] = {"field_id": "department", "value": "ביטחון"}
    r = preview(c, d)
    assert r.status_code == 200, r.text
    assert sent(fake, "profiles/settings_preview")[-1]["values"]["fields"][1]["depends_on"] == {"field_id": "department", "value": "ביטחון"}
    assert r.json()["diff"][0]["changes"] == [{"property": "depends_on", "before": None, "after": {"field_id": "department", "value": "ביטחון"}}]


def test_a_stale_base_revision_is_a_conflict_before_sending_and_wiskey_s_own_conflict_too(wx):
    fake, c, _s = wx
    d = draft(c)
    d["revision"] = 6
    r = preview(c, d)
    assert r.status_code == 409 and r.json()["code"] == "profiles_revision_conflict" and r.json()["details"]["current_revision"] == 7
    assert not sent(fake, "profiles/settings_preview")
    fake.fail_with["profiles/settings_preview"] = "revision_conflict"  # WisKey moved between Arx's read and the preview
    r2 = preview(c, draft(c))
    assert r2.status_code == 409 and r2.json()["code"] == "profiles_revision_conflict" and r2.json()["details"]["outcome"] == "refused"


# ---------------------------------------------------------------- apply

def test_apply_saves_once_with_the_audit_before_after_and_an_honest_readback(wx):
    fake, c, s = wx
    review = preview(c, widen_staff(draft(c))).json()
    no = c.post(f"{API}/apply", json=env(review_id=review["review_id"]), headers=as_user("root"))
    assert no.status_code == 409 and no.json()["code"] == "confirmation_required"
    assert not sent(fake, "profiles/settings_apply")
    r = apply(c, review["review_id"])
    assert r.status_code == 200, r.text
    body = r.json()
    frames = sent(fake, "profiles/settings_apply")
    assert len(frames) == 1 and set(frames[0]) == {"id", "type", "operation_id", "api_contract"} and frames[0]["operation_id"] in fake.reviews
    assert body["status"] == "saved" and body["revision_before"] == 7 and body["physical_result"] == "not_verified" and body["sync"] == "requested"
    assert body["readback"] == {"state": "ready", "revision": 8, "matches": True, "unchanged": False, "last_error": None}
    assert body["receipt"]["changed"] == 2 and body["receipt"]["stations"] == ["entry-a", "entry-b", "entry-c"]
    assert "ha-user-secret-id" not in r.text and "p-dana" not in json.dumps(body["receipt"])
    assert fake.revision == 8 and fake.values["groups"][0]["station_ids"] == ["entry-a", "entry-b", "entry-c"]
    assert fake.values["templates"] == BASE_VALUES["templates"], "the templates were kept as they were"
    trail = audit_rows(s, "intercom.profiles_apply")
    assert [t["details"]["phase"] for t in trail] == ["refused", "attempt", "outcome"]
    attempt, outcome = trail[1], trail[2]
    assert attempt["actor_user_id"] == "dev-root" and attempt["details"]["base_revision"] == 7
    assert attempt["details"]["before_after"][0]["changes"][0] == {"property": "station_ids", "before": ["entry-a", "entry-b"], "after": ["entry-a", "entry-b", "entry-c"]}
    assert outcome["details"]["outcome"] == "ok" and outcome["details"]["readback"] == {"revision": 8, "matches": True}
    text = json.dumps(trail)
    assert "SECRET-TEMPLATE-VALUE" not in text and "ha-user-secret-id" not in text and frames[0]["operation_id"] not in text
    again = apply(c, review["review_id"])
    assert again.status_code == 200 and again.json()["repeated"] is True and len(sent(fake, "profiles/settings_apply")) == 1


def test_another_users_review_is_not_found_and_an_unknown_review_too(wx):
    fake, c, _s = wx
    review = preview(c, widen_staff(draft(c))).json()
    r = apply(c, review["review_id"], "lead")
    assert r.status_code == 404 and r.json()["code"] == "profiles_review_not_found" and r.json()["details"]["outcome"] == "not_sent"
    assert apply(c, "f" * 32).status_code == 404
    assert not sent(fake, "profiles/settings_apply")


def test_an_expired_arx_review_is_refused_before_sending(wx, monkeypatch):
    fake, c, _s = wx
    review = preview(c, widen_staff(draft(c))).json()
    wp.REVIEWS.get(review["review_id"], "dev-root").deadline = time.monotonic() - 1
    r = apply(c, review["review_id"])
    assert r.status_code == 409 and r.json()["code"] == "profiles_review_expired"
    assert not sent(fake, "profiles/settings_apply")


@pytest.mark.parametrize("setup,code,status", [
    (lambda f: setattr(f, "stale_after_preview", True), "profiles_review_stale", 409),
    (lambda f: f.reviews.clear(), "profiles_review_expired", 409),
    (lambda f: setattr(f, "revision", 9), "profiles_revision_conflict", 409),
])
def test_a_refusal_by_wiskey_is_refused_with_its_code_and_nothing_is_saved(wx, setup, code, status):
    fake, c, s = wx
    review = preview(c, widen_staff(draft(c))).json()
    setup(fake)
    values_before = copy.deepcopy(fake.values)
    r = apply(c, review["review_id"])
    assert r.status_code == status and r.json()["code"] == code, r.text
    assert r.json()["details"]["outcome"] == "refused"
    assert fake.values == values_before
    assert audit_rows(s, "intercom.profiles_apply")[-1]["details"]["outcome"] == "refused"
    again = apply(c, review["review_id"])
    assert again.status_code == 409 and again.json()["code"] == "profiles_review_expired", "a dead review is never sent again"
    assert len(sent(fake, "profiles/settings_apply")) == 1


def test_a_unique_field_with_duplicates_cannot_be_applied(wx):
    fake, c, _s = wx
    d = draft(c)
    d["values"]["fields"][1]["unique"] = True
    review = preview(c, d).json()
    impact = review["impact"]
    assert impact["can_apply"] is False
    badge = next(f for f in impact["field_changes"] if f["field_id"] == "badge")
    assert badge["duplicates"] == 2 and {e["display_name"] for e in badge["duplicate_examples"]} == {"דנה לוי", "עומר כהן"}
    assert "B-7" not in json.dumps(review), "never a person's value"
    r = apply(c, review["review_id"])
    assert r.status_code == 409 and r.json()["code"] == "profiles_not_unique"
    assert not sent(fake, "profiles/settings_apply")


def test_an_unclear_answer_is_unknown_and_only_a_readback_resolves_it(wx):
    fake, c, s = wx
    fake.apply_unclear = "save"
    review = preview(c, widen_staff(draft(c))).json()
    r = apply(c, review["review_id"])
    assert r.status_code == 504 and r.json()["code"] == "profiles_outcome_unknown" and r.json()["details"]["outcome"] == "unknown"
    blocked = apply(c, review["review_id"])
    assert blocked.status_code == 409 and blocked.json()["code"] == "profiles_outcome_pending"
    assert len(sent(fake, "profiles/settings_apply")) == 1, "never re-sent blindly"
    check = c.post(f"{API}/reviews/{review['review_id']}/check", headers=as_user("root"))
    assert check.status_code == 200 and check.json()["verdict"] == "applied" and check.json()["readback"]["revision"] == 8
    assert audit_rows(s, "intercom.profiles_check")[-1]["details"]["verdict"] == "applied"


def test_an_unclear_answer_without_a_save_reads_back_not_applied_and_may_then_be_sent_again(wx):
    fake, c, _s = wx
    fake.apply_unclear = "nosave"
    review = preview(c, widen_staff(draft(c))).json()
    assert apply(c, review["review_id"]).status_code == 504
    check = c.post(f"{API}/reviews/{review['review_id']}/check", headers=as_user("root")).json()
    assert check["verdict"] == "not_applied" and fake.revision == 7
    fake.apply_unclear = None
    r = apply(c, review["review_id"])
    assert r.status_code == 200 and r.json()["readback"]["matches"] is True
    frames = sent(fake, "profiles/settings_apply")
    assert len(frames) == 2 and frames[0]["operation_id"] == frames[1]["operation_id"], "the SAME operation id (WisKey's apply is idempotent)"


def test_a_change_elsewhere_after_an_unknown_kills_the_review(wx):
    fake, c, _s = wx
    fake.apply_unclear = "nosave"
    review = preview(c, widen_staff(draft(c))).json()
    assert apply(c, review["review_id"]).status_code == 504
    fake._save({**copy.deepcopy(fake.values), "photo_enabled": False}, "profiles/settings_update")  # someone else saved meanwhile
    check = c.post(f"{API}/reviews/{review['review_id']}/check", headers=as_user("root")).json()
    assert check["verdict"] == "changed_elsewhere"
    assert apply(c, review["review_id"]).json()["code"] == "profiles_review_expired"


# ---------------------------------------------------------------- versions, compare, rollback

def test_versions_never_name_who(wx):
    _fake, c, _s = wx
    r = c.get(f"{API}/versions", headers=as_user("root"))
    assert r.status_code == 200, r.text
    v = r.json()["versions"]
    assert [x["revision"] for x in v["records"]] == [7, 5] and v["current_revision"] == 7
    assert "ha-user-secret-id" not in r.text


def test_compare_answers_wiskey_s_rows_and_an_unknown_version_is_404(wx):
    fake, c, _s = wx
    r = c.get(f"{API}/compare?before=5&after=7", headers=as_user("root"))
    assert r.status_code == 200, r.text
    rows = r.json()["compare"]["rows"]
    assert {(x["kind"], x["id"], x["state"]) for x in rows} == {("fields", "badge", "added"), ("fields", "department", "changed"), ("groups", "staff", "changed")}
    frames = sent(fake, "profiles/versions_compare")
    assert set(frames[0]) == {"id", "type", "before_revision", "after_revision"}
    missing = c.get(f"{API}/compare?before=1&after=7", headers=as_user("root"))
    assert missing.status_code == 404 and missing.json()["code"] == "profiles_version_not_found"


def test_the_rollback_draft_restores_what_is_versioned_disables_what_was_added_and_sends_nothing(wx):
    fake, c, s = wx
    r = c.get(f"{API}/versions/5/draft", headers=as_user("root"))
    assert r.status_code == 200, r.text
    body = r.json()
    values = body["values"]
    assert body["base_revision"] == 7 and body["target_revision"] == 5
    assert values["fields"][0]["label"] == "יחידה"
    assert values["groups"][0]["station_ids"] == ["entry-a"]
    assert values["fields"][1]["id"] == "badge" and values["fields"][1]["enabled"] is False
    codes = {n["code"] for n in body["notes"]}
    assert {"disabled_not_removed", "photo_not_versioned", "templates_not_versioned"} <= codes
    assert not sent(fake, "profiles/settings_preview") and not sent(fake, "profiles/settings_apply")
    # the draft then goes the normal way: preview -> apply
    review = preview(c, {"revision": body["base_revision"], "values": values}).json()
    assert apply(c, review["review_id"]).status_code == 200
    assert fake.values["fields"][0]["label"] == "יחידה" and fake.values["groups"][0]["station_ids"] == ["entry-a"]


def test_rollback_to_the_current_version_is_refused(wx):
    _fake, c, _s = wx
    r = c.get(f"{API}/versions/7/draft", headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "profiles_already_current"


# ---------------------------------------------------------------- group suggestions

def test_group_suggestions_are_read_only_and_values_need_the_sensitive_level(wx):
    fake, c, _s = wx
    r = c.get(f"{API}/suggestions?user_id=p-dana&field=department", headers=as_user("root"))
    assert r.status_code == 200, r.text
    body = r.json()["suggestions"]
    assert body["suggestions"][0]["group_id"] == "night" and body["suggestions"][0]["doors"][0]["after"] == [1]
    assert next(f for f in body["fields"] if f["id"] == "department")["value"] == "הנדסה"
    assert "fingerprint" not in r.text
    frames = sent(fake, "users/group_suggestions")
    assert set(frames[0]) == {"id", "type", "user_id", "field_ids"} and frames[0]["field_ids"] == ["department"]
    plain = c.get(f"{API}/suggestions?user_id=p-dana&field=department", headers=as_user("pat")).json()["suggestions"]
    assert all(f["value"] is None for f in plain["fields"])
    assert c.get(f"{API}/suggestions?user_id=nobody", headers=as_user("root")).status_code == 404
    assert c.get(f"{API}/suggestions?user_id=p-yael&field=badge", headers=as_user("root")).status_code == 422
    too_many = c.get(f"{API}/suggestions?user_id=p-dana&field=a&field=b&field=c&field=d", headers=as_user("root"))
    assert too_many.status_code == 422
    assert not sent(fake, "profiles/settings_apply")


# ---------------------------------------------------------------- pure helpers

def test_normalize_draft_mirrors_wiskey_s_limits():
    good = copy.deepcopy({k: v for k, v in BASE_VALUES.items() if k != "templates"})
    out = wp.normalize_draft(good, {"entry-a", "entry-b", "entry-c"})
    assert out["groups"][2] == {"id": "visitors", "label": "מבקרים", "enabled": False}
    with pytest.raises(wp.DraftError) as e:
        wp.normalize_draft({**good, "groups": [{"id": "g", "label": "x" * 65, "enabled": True}]})
    assert e.value.problems == [{"path": "groups.0.label", "code": "label"}]
    with pytest.raises(wp.DraftError):
        wp.normalize_draft({**good, "templates": []})


def test_the_apply_reads_only_pre_save_codes_as_refusals():
    with pytest.raises(wp.IntercomError):
        wp.result_of({"success": False, "error": {"code": "bulk_review_stale"}}, "profiles/settings_apply", write=True)
    with pytest.raises(wp.UnclearAnswer):
        wp.result_of({"success": False, "error": {"code": "storage_or_internal_error"}}, "profiles/settings_apply", write=True)
    with pytest.raises(wp.UnclearAnswer):
        wp.result_of({"weird": 1}, "profiles/settings_apply", write=True)
    with pytest.raises(wp.IntercomError):
        wp.result_of({"success": False, "error": {"code": "storage_or_internal_error"}}, "profiles/settings_preview", write=False)
