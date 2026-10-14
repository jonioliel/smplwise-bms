"""CR-038 slice 5a: Settings › ערוץ ההודעות - the WhatsApp account routes wired to the real entity mirror (`ha_entities` rows written
here the way the registry refresh writes them; no Home Assistant, no WhatsApp, no phone: the on-demand label read is the fake's
`get_state`). Covers the read / edit gates of `messaging.accounts.manage` (sensitive) and `system.configure`, masking of manual
values, discovery and states from the mirror, the mapping document's PUT (revision, 422 problems, last4 kept by the server,
manual = discovered refused), the confirm before a move with queued messages (5b's counter hook), the refresh, the D33 labels, the
test send that stays OFF, the audit rows that never carry a number, and that the routes ignore the tickets module gate."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from fake_ha_whatsapp import FakeHaWhatsapp, PairedAccount
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso
from smplwise.main import create_app
from smplwise.services import ha_client
from smplwise.services import messaging_runtime as mr
from smplwise.services.tickets import naming
from smplwise.services.tickets.channel import AccountRef

API = "/api/v1"
URL = f"{API}/messaging/whatsapp"
ENTRY_A, ENTRY_B = "01JFAKEENTRYA", "01JFAKEENTRYB"
KEY_A, KEY_B = f"entry:{ENTRY_A}", f"entry:{ENTRY_B}"
PHONE_A, PHONE_B = "15555550191", "15555550192"  # fake numbers (the 555-01xx fiction range)


@pytest.fixture(autouse=True)
def _hooks(monkeypatch):
    monkeypatch.setattr(mr, "QUEUED_COUNTER", None)
    monkeypatch.setattr(mr, "TEST_SENDER", None)
    monkeypatch.delenv(mr.TEST_SEND_ENV, raising=False)
    monkeypatch.setattr(mr, "ws_connected", lambda: True)
    mr.TRACKER.refresh()
    yield
    mr.TRACKER.__init__()


def _mirror(settings, fake: FakeHaWhatsapp) -> None:
    db = Database(settings.db_path)
    now = now_iso()
    with db.connection() as conn:
        for r in fake.mirror_rows():
            conn.execute(
                "INSERT INTO ha_entities(entity_id, unique_id, platform, config_entry_id, domain, device_class, state, available, disabled, name, first_seen_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?) ON CONFLICT(entity_id) DO UPDATE SET state = excluded.state, available = excluded.available",
                (r.entity_id, r.unique_id, r.platform, r.config_entry_id, r.domain, r.device_class, r.state, int(r.available), int(r.disabled), now, now))


def _custom_role(settings, role_id: str, perms: list[str], sens: list[str]) -> None:
    db = Database(settings.db_path)
    now = now_iso()
    with db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, sensitive_json, created_at, updated_at) VALUES (?,?,?,?,?,?)",
                     (role_id, role_id, json.dumps(perms), json.dumps(sens), now, now))
        conn.execute("UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'permission_revision'")


@pytest.fixture()
def env(settings, monkeypatch):
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")  # joni bootstraps as system_admin (holds messaging.accounts.manage)
    fake = FakeHaWhatsapp([PairedAccount(ENTRY_A, PHONE_A), PairedAccount(ENTRY_B, PHONE_B, connected=False)])
    _mirror(settings, fake)
    monkeypatch.setattr(ha_client, "get_state", lambda _s, eid: fake.get_state(eid))
    assert c.patch(f"{API}/settings", json={"tickets.enabled": "true"}).status_code == 200
    _custom_role(settings, "r-msg", ["messaging.accounts.manage"], ["messaging.accounts.manage"])
    bind(c, settings, "mia", "r-msg", "installation", "*")
    bind(c, settings, "otto", "operator", "installation", "*")
    bind(c, settings, "sue", "site_admin", "installation", "*")
    return c, settings, fake


def _doc(c, user="joni"):
    r = c.get(URL, headers=as_user(user))
    assert r.status_code == 200, r.text
    return r.json()


def _put(c, body, user="joni"):
    return c.put(URL, json=body, headers=as_user(user))


def _audit(settings, action):
    db = Database(settings.db_path)
    with db.connection(mode="read") as conn:
        return [json.loads(r["details_json"] or "{}") for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,))]


# ---------------------------------------------------------------- read

def test_discovery_and_states_from_the_mirror(env):
    c, _, _ = env
    d = _doc(c)
    acc = {a["key"]: a for a in d["accounts"]}
    assert set(acc) == {KEY_A, KEY_B}
    assert acc[KEY_A]["state"] == "connected" and acc[KEY_A]["in_mirror"] and acc[KEY_A]["kind"] == "discovered" and not acc[KEY_A]["stored"]
    assert acc[KEY_B]["state"] == "disconnected"
    assert acc[KEY_A]["label"] == f"וואטסאפ {ENTRY_A[:6]}" and acc[KEY_A]["last4"] is None, "no number is known before the on-demand read"
    assert acc[KEY_A]["sends_24h"] == 0 and acc[KEY_A]["last_send_at"] is None
    assert d["can_manage"] is True and d["revision"] == 0 and d["test_send"] == {"enabled": mr.TEST_SENDER is not None}
    assert [ch["key"] for ch in d["channels"]] == ["whatsapp", "email", "inapp", "sms"]
    assert d["channels"][-1]["state"] == "soon" and d["channels"][0]["state"] == "not_configured"
    assert {"code": "required_unmapped", "use": "tickets.messages", "severity": "red"} in d["warnings"]


def test_uses_carry_the_configured_module_name_d33(env):
    c, _, _ = env
    d = _doc(c)
    uses = {u["key"]: u for u in d["uses"]}
    many = naming.DEFAULTS["he"]["many"]  # the default name (owner 14.10: "בקשות שירות"), never written here
    assert uses["tickets.messages"]["label"] == f"הודעות {many}" and uses["tickets.codes"]["label"] == f"קודי אימות ל{many}"
    assert uses["tickets.codes"]["inherits"] == "tickets.messages" and uses["tickets.codes"]["inherits_label"] == f"הודעות {many}"
    assert [x["name"] for x in uses["tickets.messages"]["departments"]] == ["אחזקה"]
    assert d["modules"] == {"tickets": naming.DEFAULTS["he"]["module"]}  # the module's own name ("ניהול השירות")
    r = c.get(f"{API}/tickets/module").json()
    names = r["name"]
    names["he"] = {"one": "פנייה", "many": "פניות", "gender": "f"}
    assert c.put(f"{API}/tickets/name", json={"revision": r["name_revision"], **names}).status_code == 200
    d = _doc(c)
    assert {u["key"]: u["label"] for u in d["uses"]} == {"tickets.messages": "הודעות פניות", "tickets.codes": "קודי אימות לפניות"}
    assert d["modules"]["tickets"] == "פניות"


def test_the_uses_follow_the_tickets_module_switch_but_the_routes_do_not(env):
    c, _, _ = env
    assert c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    d = _doc(c)
    assert d["uses"] == [] and d["warnings"] == [] and len(d["accounts"]) == 2, "installation-level: no tickets module gate"
    assert d["channels"][0]["state"] == "idle"


@pytest.mark.parametrize("user,status,manage", [("joni", 200, True), ("mia", 200, True), ("otto", 403, None), ("sue", 403, None), ("vic", 403, None)])
def test_read_gate(env, user, status, manage):
    c, _, _ = env
    r = c.get(URL, headers=as_user(user))
    assert r.status_code == status
    if status == 200:
        assert r.json()["can_manage"] is manage


def test_a_system_configure_holder_reads_masked_and_cannot_edit(env):
    c, settings, _ = env
    body = {"revision": 0, "accounts": [{"key": "manual:k3f9a", "kind": "manual", "label": "מספר ישן", "account": PHONE_B}], "uses": {}}
    assert _put(c, body).status_code == 200
    c.get(f"{API}/me", headers=as_user("rita"))
    bind(c, settings, "rita", "system_admin", "installation", "*")
    _custom_role(settings, "r-deny-msg", ["messaging.accounts.manage"], ["messaging.accounts.manage"])
    db = Database(settings.db_path)
    with db.connection() as conn:  # a deny of the sensitive right on top of system_admin: reads with system.configure only
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES ('b-deny-rita', 'user', 'dev-rita', 'r-deny-msg', 'installation', '*', 'deny', 1, 'test', ?)", (now_iso(),))
        conn.execute("UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'permission_revision'")
    d = _doc(c, "rita")
    assert d["can_manage"] is False
    manual = next(a for a in d["accounts"] if a["key"] == "manual:k3f9a")
    assert manual["account"] is None and manual["last4"] == PHONE_B[-4:], "the typed value (a number) is masked to its last four"
    assert PHONE_B not in json.dumps(d)
    assert _put(c, {"revision": d["revision"], "accounts": [], "uses": {}}, "rita").status_code == 403
    assert c.post(f"{URL}/refresh", headers=as_user("rita")).status_code == 403
    assert PHONE_B in json.dumps(_doc(c)), "the manager sees it"


# ---------------------------------------------------------------- write

def test_put_maps_uses_and_audits_keys_only(env):
    c, settings, _ = env
    d = _doc(c)
    body = {"revision": d["revision"], "accounts": [{"key": KEY_A, "kind": "discovered", "label": "משרד הניהול", "shared_outside": True}],
            "uses": {"tickets.messages": KEY_A, "tickets.codes": None, "tickets.messages@dept:dept-maintenance": KEY_B}}
    r = _put(c, body)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["revision"] == 1 and d["mapping"]["tickets.messages"] == KEY_A
    uses = {u["key"]: u for u in d["uses"]}
    assert uses["tickets.codes"]["resolved"] == KEY_A, "codes inherit the installation value"
    assert uses["tickets.messages"]["departments"][0] == {"id": "dept-maintenance", "name": "אחזקה", "value": KEY_B, "resolved": KEY_B}
    acc = {a["key"]: a for a in d["accounts"]}
    assert acc[KEY_A]["label"] == "משרד הניהול" and acc[KEY_A]["shared_outside"] and acc[KEY_A]["stored"]
    assert sorted(acc[KEY_A]["uses"]) == ["tickets.codes", "tickets.messages"] and acc[KEY_B]["uses"] == ["tickets.messages@dept:dept-maintenance"]
    codes = {w["code"] for w in d["warnings"]}
    assert "shared_outside" in codes and "account_down" in codes and "required_unmapped" not in codes
    assert d["channels"][0]["state"] == "active"
    rows = _audit(settings, "messaging.accounts.update")
    assert rows[-1]["accounts_added"] == [KEY_A] and {u["use"] for u in rows[-1]["uses"]} == {"tickets.messages", "tickets.messages@dept:dept-maintenance"}
    assert "משרד" not in json.dumps(rows), "audit carries keys, never labels"


def test_put_refusals(env):
    c, _, _ = env
    assert _put(c, {"revision": 7, "accounts": [], "uses": {}}).json()["code"] == "settings_stale"
    r = _put(c, {"revision": 0, "accounts": [], "uses": {"tickets.messages": "entry:NOPE"}})
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"code": "use_account_unknown", "field": "uses.tickets.messages"}]
    r = _put(c, {"revision": 0, "accounts": [], "uses": {"other.use": KEY_A}})
    assert r.json()["details"]["fields"][0]["code"] == "use_unknown"
    r = _put(c, {"revision": 0, "accounts": [{"key": "manual:abcd1", "kind": "manual", "account": ENTRY_A}], "uses": {}})
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["code"] == "manual_equals_discovered"
    r = _put(c, {"revision": 0, "accounts": [{"key": "manual:abcd1", "kind": "manual", "account": "bad value!"}], "uses": {}})
    assert r.json()["details"]["fields"][0]["code"] == "manual_value_invalid"
    r = _put(c, {"revision": 0, "accounts": [{"key": KEY_A, "kind": "discovered", "pacing": {"per_hour": 0}}], "uses": {}})
    assert r.json()["details"]["fields"][0]["code"] == "pacing_out_of_range"
    assert _put(c, {"revision": 0, "accounts": [], "uses": {}, "extra": 1}).status_code == 422
    assert _put(c, {"revision": 0, "accounts": [], "uses": {}}, "otto").status_code == 403
    assert _doc(c)["revision"] == 0, "nothing was stored"


def test_the_server_keeps_last4(env):
    c, _, _ = env
    r = c.post(f"{URL}/refresh")
    assert r.status_code == 200
    acc = {a["key"]: a for a in r.json()["accounts"]}
    assert acc[KEY_A]["last4"] == PHONE_A[-4:] and acc[KEY_A]["label"] == f"וואטסאפ ····{PHONE_A[-4:]}"
    body = {"revision": r.json()["revision"], "accounts": [{"key": KEY_A, "kind": "discovered", "label": "x", "last4": "0000"}], "uses": {}}
    assert _put(c, body).status_code == 422, "last4 is not a client field"
    body["accounts"][0].pop("last4")
    d = _put(c, body).json()
    assert {a["key"]: a for a in d["accounts"]}[KEY_A]["last4"] == PHONE_A[-4:]


def test_refresh_reads_last_four_only_and_never_stores_the_number(env, settings):
    c, _, _ = env
    d = c.post(f"{URL}/refresh").json()
    db = Database(settings.db_path)
    with db.connection(mode="read") as conn:
        stored = conn.execute("SELECT value FROM settings WHERE key = 'messaging.whatsapp'").fetchone()[0]
        audit_text = json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log")], default=str)
    assert PHONE_A not in stored and PHONE_B not in stored and PHONE_A[-4:] in stored
    assert PHONE_A not in audit_text and PHONE_A not in json.dumps(d)
    assert d["revision"] == 1 and len(d["accounts"]) == 2
    assert c.post(f"{URL}/refresh").json()["revision"] == 1, "nothing new: no revision bump"
    assert _audit(settings, "messaging.accounts.refresh")[-1] == {"discovered": 2, "labels_read": 2, "stored": False}


def test_refresh_survives_an_unreachable_home(env, monkeypatch):
    c, _, _ = env

    def boom(_s, _eid):
        raise RuntimeError("down")

    monkeypatch.setattr(ha_client, "get_state", boom)
    d = c.post(f"{URL}/refresh").json()
    assert all(a["last4"] is None for a in d["accounts"]) and all(a["stored"] for a in d["accounts"])


def test_a_missing_entry_keeps_its_mapping(env, settings):
    c, _, fake = env
    assert _put(c, {"revision": 0, "accounts": [], "uses": {"tickets.messages": KEY_A}}).status_code == 200
    db = Database(settings.db_path)
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE config_entry_id = ?", (now_iso(), ENTRY_A))
    d = _doc(c)
    acc = {a["key"]: a for a in d["accounts"]}
    assert KEY_A not in acc or acc[KEY_A]["state"] == "missing"
    assert d["mapping"]["tickets.messages"] == KEY_A, "never silently re-routed (9.9.4)"
    assert any(w["code"] == "account_down" and w["state"] == "missing" and w["severity"] == "red" for w in d["warnings"])
    assert fake.calls == []


def test_manual_account_and_same_number_warning(env):
    c, _, _ = env
    d = c.post(f"{URL}/refresh").json()
    accounts = [{"key": a["key"], "kind": "discovered", "label": a["label"]} for a in d["accounts"]]
    accounts.append({"key": "manual:k3f9a", "kind": "manual", "label": "מספר ישן", "account": "972" + PHONE_A[-9:], "status_entity_id": "binary_sensor.old_phone"})
    r = _put(c, {"revision": d["revision"], "accounts": accounts, "uses": {"tickets.codes": "manual:k3f9a", "tickets.messages": KEY_A}})
    assert r.status_code == 200, r.text
    d = r.json()
    manual = next(a for a in d["accounts"] if a["key"] == "manual:k3f9a")
    assert manual["kind"] == "manual" and manual["account"].endswith(PHONE_A[-4:]) and manual["state"] == "unknown"
    assert {"code": "maybe_same_number", "account_key": "manual:k3f9a", "severity": "amber"} in d["warnings"]


def test_a_move_with_queued_messages_needs_a_confirm(env, monkeypatch, settings):
    c, _, _ = env
    assert _put(c, {"revision": 0, "accounts": [], "uses": {"tickets.messages": KEY_A}}).status_code == 200
    counts = {("tickets.messages", None): 3, ("tickets.codes", None): 1, ("tickets.messages", "dept-maintenance"): 0}
    monkeypatch.setattr(mr, "QUEUED_COUNTER", lambda _c, use, dept: counts.get((use, dept), 0))
    assert {u["key"]: u["queued"] for u in _doc(c)["uses"]} == {"tickets.messages": 3, "tickets.codes": 1}
    body = {"revision": 1, "accounts": [], "uses": {"tickets.messages": KEY_B}}
    r = _put(c, body)
    assert r.status_code == 409 and r.json()["code"] == "queued_messages"
    assert r.json()["details"]["moves"] == [{"use": "tickets.messages", "department_id": None, "count": 3}, {"use": "tickets.codes", "department_id": None, "count": 1}]
    assert _doc(c)["revision"] == 1
    r = _put(c, {**body, "confirm_queued": True})
    assert r.status_code == 200 and r.json()["mapping"]["tickets.messages"] == KEY_B
    assert _audit(settings, "messaging.accounts.update")[-1]["queued_moved"] == 4
    # a department override that does not change the resolution moves nothing
    r = _put(c, {"revision": 2, "accounts": [], "uses": {"tickets.messages": KEY_B, "tickets.messages@dept:dept-maintenance": KEY_B}})
    assert r.status_code == 200


def test_test_send_is_off_only_until_the_outbox_is_registered(env, monkeypatch, settings):
    c, _, _ = env
    body = {"account_key": KEY_A, "target": "+1 555 555 0199"}
    monkeypatch.setattr(mr, "TEST_SENDER", None)
    r = c.post(f"{URL}/test", json=body)
    assert r.status_code == 409 and r.json()["code"] == "test_send_off"
    sent: list[tuple[AccountRef, str]] = []
    monkeypatch.setattr(mr, "TEST_SENDER", lambda _c, ref, digits, who: sent.append((ref, digits)) or {"id": "o1", "state": "queued"})
    # owner 2026-10-14: no environment switch any more - the registered outbox is enough
    assert _doc(c)["test_send"] == {"enabled": True}
    assert c.post(f"{URL}/test", json={**body, "account_key": "entry:NOPE"}).status_code == 404
    assert c.post(f"{URL}/test", json={**body, "target": "12"}).status_code == 422
    assert c.post(f"{URL}/test", json=body, headers=as_user("otto")).status_code == 403
    r = c.post(f"{URL}/test", json=body)
    assert r.status_code == 200 and r.json() == {"id": "o1", "state": "queued"}
    assert sent[0][0].key == KEY_A and sent[0][0].value == ENTRY_A and sent[0][1] == "15555550199"
    rows = _audit(settings, "messaging.accounts.test")
    assert rows == [{"account": KEY_A, "state": "queued"}] and "0199" not in json.dumps(rows)


def test_the_test_send_is_local_only():
    from smplwise import remote_channel

    assert "/api/v1/messaging/whatsapp/test" in remote_channel.BLOCKED_ON_REMOTE
    assert not any(b == "/api/v1/messaging/whatsapp" for b in remote_channel.BLOCKED_ON_REMOTE), "the settings screen works remotely"


def test_messaging_whatsapp_never_travels_in_settings_or_backups(env):
    c, _, _ = env
    assert _put(c, {"revision": 0, "accounts": [], "uses": {"tickets.messages": KEY_A}}).status_code == 200
    assert "messaging.whatsapp" not in json.dumps(c.get(f"{API}/settings").json())
    from smplwise.services import backup

    assert "messaging.whatsapp" in backup.SETTINGS_KEEP
    assert "messaging_send_ledger" not in backup.PROJECT_TABLES
