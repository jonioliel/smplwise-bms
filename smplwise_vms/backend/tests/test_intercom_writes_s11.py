"""CR-036 S11: the native WisKey WRITES for people and cards (owner decisions of 2026-10-12: every write in stage 1, DW / PG approved,
Arx RBAC the only authority, the engine stays WisKey) - end to end over the add-on's live service session against the STATEFUL fake
WisKey (tests/fake_wiskey.py `use_directory()`): nothing here contacts a device, a station, Home Assistant or WisKey.

What is proven:
- the gates: `access.people.manage` (+ `access.cards.capture` / `access.pin.generate`) anywhere before the body; then every station of
  the person before AND after the change - a person the caller cannot see answers exactly like one that does not exist, one shared
  with a station outside their chain is a 403; the sensitive fields need `access.people.sensitive` there; a restricted write carries
  the revision its own read returned; an unrestricted caller needs no read;
- the new writes (archive / restore, on / off, temporary cancel, a card by number in / out, the photo, the timing): WisKey's exact
  frames (the pinned catalog's keys), refusals vs unknown outcomes, the effect read back from the fake;
- the effect classes: delete and the capture commands are UNKNOWN_EFFECT (`pending: true`), the rest `sync`;
- the audit rows: initiator, request ids, logical target, outcome - never a value, a PIN, a card number, a photo, their hash or length;
- PIN generation: an interactive session only, its own permission, the value in the response once (`no-store`) and NOWHERE else - not
  the audit log, not a log line, not the database file (a SENTINEL value, never a real PIN);
- no automatic retry of a write, a duplicate command refused.

Station scope is CR-033's (tests/intercom_station_scope.py: real once merged, a labelled double before)."""
from __future__ import annotations

import json
import logging
import time
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX, FakeWiskey, fixture
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.rbac import ROLES, Principal
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_client, intercom_sync, wiskey_channels
from smplwise.services import intercom_writes as iw

ROOT = Path(__file__).resolve().parents[3]
API = "/api/v1/intercom"
SENTINEL_PIN = "918273645546372819"  # a fake sentinel - tests never generate or use a real PIN
CARD_NUMBER = "QX7731ZK"  # a typed card number: the command frame only, never a reply, a row or a log line
PHONE = "050-123-9876"
PHOTO = fixture("users_photo_get.json")["photo"]  # WisKey's own data-URL form of a generated 16x16 grey JPEG


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    """The command envelope a screen sends: a fresh id per deliberate action, an expiry on the server's clock."""
    import uuid
    from datetime import datetime, timedelta, timezone

    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


@pytest.fixture()
def wx(settings, monkeypatch, station_scope):  # noqa: F811
    """The app with the stateful fake as its WisKey and these principals:
    root (system_admin, installation) - otto (operator, installation: reads people, manages nobody) - vera (viewer) -
    mia (site_admin on entry-a only: manage + sensitive + capture + PIN there) - nina (a custom role on entry-a: people.read +
    people.manage + pin.generate, WITHOUT people.sensitive). The directory gains u6 (entry-a only) and u7 (a contractor on entry-a)."""
    import websockets

    fake = FakeWiskey("admin", token="t").use_directory()
    assert fake.directory is not None
    u6 = json.loads(json.dumps(next(p for p in fake.directory if p["id"] == "u2")))
    u6.update(id="u6", display_name="Gal", employee_no="1006", assignments={"entry-a": {**u6["assignments"]["entry-b"], "config_entry_id": "entry-a", "enabled": True}})
    u7 = json.loads(json.dumps(u6))
    u7.update(id="u7", display_name="Ido", employee_no="1007", access_category="contractor", responsible_person="Rina", valid_until="2027-01-01T00:00:00+00:00")
    fake.directory.extend([u6, u7])
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("CONFIG_USER_BURST", "CONFIG_GLOBAL_BURST", "USER_BURST", "GLOBAL_BURST", "CAPTURE_USER_BURST", "CAPTURE_GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    app = create_app(s)
    c = TestClient(app)
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    for user in ("mia", "nina"):
        c.get("/api/v1/me", headers=as_user(user))
    station_scope.bind("dev-mia", "site_admin", "entry-a")
    names_only = c.post("/api/v1/access/roles", json={"name": "people manager without sensitive", "description": "S11 field-level test",
                                                      "permissions": ["access.read", "access.people.read"], "sensitive": [ia.PEOPLE_MANAGE, ia.PIN_GENERATE]})
    assert names_only.status_code == 201, names_only.text
    station_scope.bind("dev-nina", names_only.json()["id"], "entry-a")
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()


def wait_for(pred: Any, timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


def sent(fake: FakeWiskey, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def person(fake: FakeWiskey, user_id: str) -> dict[str, Any] | None:
    assert fake.directory is not None
    return next((p for p in fake.directory if p["id"] == user_id), None)


def rev(fake: FakeWiskey, user_id: str) -> int:
    p = person(fake, user_id)
    assert p is not None
    return int(p["revision"])


def rows(settings: Any, action: str | None = None) -> list[dict[str, Any]]:
    db = Database(settings.db_path)
    with db.connection() as conn:
        sql = "SELECT * FROM audit_log" + (" WHERE action = ?" if action else "") + " ORDER BY id"
        out = [dict(r) for r in conn.execute(sql, (action,) if action else ()).fetchall()]
    for r in out:
        r["details"] = json.loads(r["details_json"]) if r["details_json"] else {}
    return out


def post(c: TestClient, path: str, user: str, **body: Any) -> Any:
    return c.post(API + path, json=env(**body), headers=as_user(user))


# ---------------------------------------------------------------- the catalogue

def test_the_pin_permission_is_its_own_sensitive_permission():
    assert {r for r, perms in ROLES.items() if ia.PIN_GENERATE in perms} == {"site_admin", "system_admin"}
    assert ia.PIN_GENERATE in SENSITIVE and ia.PIN_GENERATE in ia.SENSITIVE_PERMISSIONS
    assert PERMISSION_LABELS[ia.PIN_GENERATE].startswith("בקרת כניסה: ") and "WisKey" not in PERMISSION_LABELS[ia.PIN_GENERATE]
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"]: ia.PIN_GENERATE in r["permissions"] for r in contract["roles"]} == {r["id"]: ia.PIN_GENERATE in ROLES[r["id"]] for r in contract["roles"]}
    assert ia.PIN_GENERATE in contract["sensitive_permissions_not_implied"]


def test_every_person_write_command_has_an_effect_class_and_rides_the_service_channel():
    person_writes = {"users/create", "users/update", "users/delete", "users/archive", "users/unarchive", "users/set_active", "users/temporary_cancel",
                     "cards/add", "cards/remove", "cards/capture_start", "cards/capture_cancel", "cards/capture_confirm", "users/pin_generate"}
    assert set(iw.EFFECT_OF) == person_writes
    assert person_writes <= wiskey_channels.SERVICE_WRITES
    assert {c for c, e in iw.EFFECT_OF.items() if e == iw.UNKNOWN_EFFECT} == {"users/delete", "cards/capture_start", "cards/capture_cancel", "cards/capture_confirm"}
    for command in ("users/archive", "users/unarchive", "users/set_active", "users/temporary_cancel", "cards/add", "cards/remove"):
        assert command not in wiskey_channels.READ and command not in wiskey_channels.TECHNICAL, "no write on a read channel"
        assert intercom_client.PRE_STORAGE[command] >= {"user_not_found", "revision_conflict"}, command


def test_interactive_session_rule():
    def p(source: str, via: str = "") -> Principal:
        return Principal(user_id="x", username="x", display_name="x", source=source, via=via)

    assert iw.interactive(p("ingress")) and iw.interactive(p("dev")) and iw.interactive(p("remote", "cookie"))
    for refused in (p("remote", "bearer"), p("remote"), p("internal"), p("system"), p("push"), p("device")):
        assert not iw.interactive(refused), refused


# ---------------------------------------------------------------- the gates

NEW_PATHS = ("/people/u6/archive", "/people/u6/unarchive", "/people/u6/active", "/people/u6/temporary-cancel", "/people/u6/cards", "/people/u6/cards/card-u6/remove")


def test_every_write_is_refused_before_the_body_without_people_manage(wx):
    fake, c, s = wx
    before = len(fake.received)
    for user in ("otto", "vera", "nobody"):
        for path in NEW_PATHS:
            r = c.post(API + path, content=b"{not json", headers={**as_user(user), "Content-Type": "application/json"})
            assert r.status_code == 403 and r.json()["code"] == "forbidden", (user, path, r.text)
        r = c.put(API + "/people/u6/photo", content=b"{not json", headers={**as_user(user), "Content-Type": "application/json"})
        assert r.status_code == 403, user
        assert c.post(API + "/people/pin-generate", json={"user_id": ""}, headers=as_user(user)).status_code == 403
    assert len(fake.received) == before, "a refused caller never reaches WisKey"
    denied = [r for r in rows(s) if r["decision"] == "denied" and r["actor_username"] in ("otto", "vera", "nobody")]
    assert len(denied) >= 3 * (len(NEW_PATHS) + 2) and all(r["action"] == ia.PEOPLE_MANAGE for r in denied)
    assert not [r for r in rows(s) if r["action"].startswith("intercom.person.")], "no write row for a caller who may not write"


def test_a_station_scoped_manager_changes_only_people_wholly_on_their_stations(wx):
    fake, c, s = wx
    r = post(c, "/people/u6/active", "mia", active=False, revision=rev(fake, "u6"))
    assert r.status_code == 200, r.text
    assert r.json()["person"]["active"] is False and person(fake, "u6")["active"] is False
    [frame] = sent(fake, "users/set_active")
    assert frame == {"id": frame["id"], "type": PREFIX + "users/set_active", "user_id": "u6", "revision": 3, "active": False, "api_contract": 1}
    # u1 is on entry-a AND entry-b: seen (people.read on entry-a), not changeable - nothing sent
    r = post(c, "/people/u1/active", "mia", active=False, revision=rev(fake, "u1"))
    assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope" and r.json()["details"]["outcome"] == "not_sent", r.text
    # u2 (entry-b only) and u3 (no station) are not hers to see: exactly the answer for a person who does not exist
    answers = [post(c, f"/people/{uid}/active", "mia", active=False, revision=3) for uid in ("u2", "u3", "u-nobody")]
    assert {a.status_code for a in answers} == {404}
    assert len({json.dumps({k: v for k, v in a.json().items() if k != "correlation_id"}, sort_keys=True) for a in answers}) == 1, "no existence oracle"
    assert len(sent(fake, "users/set_active")) == 1, "only the allowed write was sent"
    refused = [r for r in rows(s, "intercom.person.set_active") if r["decision"] == "denied"]
    assert sorted(r["reason"] for r in refused) == ["intercom_person_not_found"] * 3 + ["intercom_person_scope"]


def test_an_unrestricted_manager_needs_no_read_and_a_restricted_one_reads_first(wx):
    fake, c, _s = wx
    reads = len(sent(fake, "users/get"))
    assert post(c, "/people/u4/active", "root", active=False, revision=rev(fake, "u4")).status_code == 200
    assert len(sent(fake, "users/get")) == reads, "root covers every station: the write's own revision check binds it"
    assert post(c, "/people/u6/active", "mia", active=False, revision=rev(fake, "u6")).status_code == 200
    assert len(sent(fake, "users/get")) == reads + 1, "mia is restricted: a fresh read decides"
    order = [m["type"] for m in fake.received[-2:]]
    assert order == [PREFIX + "users/get", PREFIX + "users/set_active"]


def test_a_restricted_write_must_carry_the_revision_its_read_returned(wx):
    fake, c, _s = wx
    r = post(c, "/people/u6/active", "mia", active=False, revision=rev(fake, "u6") - 1)
    assert r.status_code == 409 and r.json()["code"] == "intercom_revision_conflict" and r.json()["details"]["outcome"] == "not_sent"
    assert not sent(fake, "users/set_active")


def test_an_update_that_reaches_a_station_off_the_chain_is_refused(wx):
    fake, c, _s = wx
    for patch in ({"permission_overrides": {"entry-b": "allow"}, "door_permissions": {"entry-b": [1]}},
                  {"permission_overrides": {"entry-b": "deny"}, "door_permissions": {}}):
        r = c.put(API + "/people/u6", json=env(data=patch, revision=rev(fake, "u6")), headers=as_user("mia"))
        assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope", (patch, r.text)
    assert not sent(fake, "users/update")
    ok = c.put(API + "/people/u6", json=env(data={"permission_overrides": {"entry-a": "allow"}, "door_permissions": {"entry-a": [1]}}, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert ok.status_code == 200, ok.text


def test_create_needs_every_named_station(wx):
    fake, c, _s = wx
    draft = {"display_name": "Tal", "employee_no": "2001", "permission_overrides": {"entry-a": "allow"}, "door_permissions": {"entry-a": [1]}}
    r = c.post(API + "/people", json=env(data=draft), headers=as_user("mia"))
    assert r.status_code == 200 and r.json()["effect"] == "sync" and r.json()["pending"] is False, r.text
    for other in ({**draft, "employee_no": "2002", "permission_overrides": {"entry-b": "allow"}, "door_permissions": {"entry-b": [1]}},
                  {"display_name": "Nobody's", "employee_no": "2003"}):
        r = c.post(API + "/people", json=env(data=other), headers=as_user("mia"))
        assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope", r.text
    assert len(sent(fake, "users/create")) == 1
    assert c.post(API + "/people", json=env(data={"display_name": "Root's", "employee_no": "2004"}), headers=as_user("root")).status_code == 200, "a station-less person: unrestricted only"


def test_sensitive_fields_need_the_sensitive_level(wx):
    fake, c, _s = wx
    assert c.put(API + "/people/u6", json=env(data={"display_name": "Gal B"}, revision=rev(fake, "u6")), headers=as_user("nina")).status_code == 200
    for patch in ({"phone": PHONE}, {"pin": "1234"}, {"pin": None}, {"cards": []}, {"responsible_person": "x"}):
        r = c.put(API + "/people/u6", json=env(data=patch, revision=rev(fake, "u6")), headers=as_user("nina"))
        assert r.status_code == 403 and r.json()["code"] == "intercom_field_level", (patch, r.text)
    assert post(c, "/people/u6/cards", "nina", card_no=CARD_NUMBER, revision=rev(fake, "u6")).json()["code"] == "intercom_field_level"
    r = c.put(API + "/people/u6/photo", json=env(photo=PHOTO, revision=rev(fake, "u6")), headers=as_user("nina"))
    assert r.json()["code"] == "intercom_field_level"
    assert c.post(API + "/people/pin-generate", json={"user_id": "u6"}, headers=as_user("nina")).json()["code"] == "intercom_field_level"
    assert c.post(API + "/people/pin-generate", json={"user_id": ""}, headers=as_user("nina")).json()["code"] == "intercom_field_level"
    # the editor at nina's level: no phone, no cards, no PIN flag (null = not shown, never "none")
    p = c.get(API + "/people/u6/editor", headers=as_user("nina")).json()["person"]
    assert p["level"] == "names" and p["phone"] is None and p["cards"] is None and p["pin_configured"] is None and p["photo_configured"] is None
    p = c.get(API + "/people/u6/editor", headers=as_user("mia")).json()["person"]
    assert p["level"] == "sensitive" and p["cards"] and p["pin_configured"] is True
    assert c.get(API + "/people/u1/editor", headers=as_user("mia")).json()["code"] == "intercom_person_scope"
    assert c.get(API + "/people/u2/editor", headers=as_user("mia")).status_code == 404


def test_the_editor_context_lists_only_the_managed_stations(wx):
    _fake, c, _s = wx
    mia = c.get(API + "/people-editor/context", headers=as_user("mia")).json()["context"]
    assert [st["id"] for st in mia["stations"]] == ["entry-a"] and mia["capture_stations"] == ["entry-a"] and mia["pin_generate"] is True
    nina = c.get(API + "/people-editor/context", headers=as_user("nina")).json()["context"]
    assert nina["capture_stations"] == [] and nina["pin_generate"] is True
    root = c.get(API + "/people-editor/context", headers=as_user("root")).json()["context"]
    assert [st["id"] for st in root["stations"]] == ["entry-a", "entry-b", "entry-c"]


# ---------------------------------------------------------------- the new writes

def test_archive_restore_switch_and_temporary_cancel_round_trip(wx):
    fake, c, s = wx
    for path in ("/people/u4/archive", "/people/u4/unarchive", "/people/u7/temporary-cancel"):
        body = {"revision": 3, **({"reason_code": "visit_completed"} if "temporary" in path else {})}
        r = post(c, path, "root", **body)  # no confirmation
        assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and r.json()["details"]["outcome"] == "not_sent", path
    assert not sent(fake, "users/archive") and not sent(fake, "users/temporary_cancel")
    r = post(c, "/people/u4/archive", "root", revision=rev(fake, "u4"), confirmed=True)
    assert r.status_code == 200, r.text
    assert r.json()["person"]["archived"] is True and r.json()["person"]["active"] is False and r.json()["effect"] == "sync" and r.json()["pending"] is False
    [frame] = sent(fake, "users/archive")
    assert frame == {"id": frame["id"], "type": PREFIX + "users/archive", "user_id": "u4", "revision": 3, "confirmed": True, "api_contract": 1}
    r = post(c, "/people/u4/archive", "root", revision=rev(fake, "u4"), confirmed=True)
    assert r.status_code == 409 and r.json()["code"] == "intercom_archive_state_changed" and r.json()["details"]["outcome"] == "refused"
    r = post(c, "/people/u4/active", "root", active=True, revision=rev(fake, "u4"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_person_archived" and r.json()["details"]["outcome"] == "refused"
    r = post(c, "/people/u4/unarchive", "root", revision=rev(fake, "u4"), confirmed=True)
    assert r.status_code == 200 and r.json()["person"]["archived"] is False and r.json()["person"]["active"] is False, "restored switched off"
    assert post(c, "/people/u4/active", "root", active=True, revision=rev(fake, "u4")).json()["person"]["active"] is True
    # temporary cancel: staff is refused by WisKey, a contractor is switched off
    r = post(c, "/people/u4/temporary-cancel", "root", revision=rev(fake, "u4"), reason_code="access_no_longer_needed", confirmed=True)
    assert r.status_code == 409 and r.json()["code"] == "intercom_not_temporary"
    r = post(c, "/people/u7/temporary-cancel", "root", revision=rev(fake, "u7"), reason_code="visit_completed", confirmed=True)
    assert r.status_code == 200 and r.json()["person"]["active"] is False, r.text
    assert sent(fake, "users/temporary_cancel")[-1]["reason_code"] == "visit_completed"
    assert post(c, "/people/u7/temporary-cancel", "root", revision=rev(fake, "u7"), reason_code="because", confirmed=True).status_code == 422
    # the rows: the action, the target, the revision, the effect - nothing of the person
    attempts = [r for r in rows(s) if r["action"].startswith("intercom.person.") and r["details"].get("phase") == "attempt"]
    assert attempts and all(set(a["details"]) <= {"command", "phase", "client_request_id", "expires_at", "command_id", "revision", "effect", "pending", "active", "reason_code"}
                            for a in attempts), [a["details"] for a in attempts]


def test_a_card_by_number_in_and_out(wx, caplog):
    fake, c, s = wx
    caplog.set_level(logging.DEBUG)
    r = post(c, "/people/u6/cards", "mia", card_no=CARD_NUMBER, label="תג", revision=rev(fake, "u6"))
    assert r.status_code == 200, r.text
    [frame] = sent(fake, "cards/add")
    assert frame == {"id": frame["id"], "type": PREFIX + "cards/add", "user_id": "u6", "revision": 3,
                     "data": {"card_no": CARD_NUMBER, "label": "תג", "card_type": "normalCard", "enabled": True}, "api_contract": 1}
    cards = r.json()["person"]["cards"]
    added = next(card for card in cards if card["masked_number"] == "•••• " + CARD_NUMBER[-4:])
    assert CARD_NUMBER not in r.text, "the reply carries WisKey's mask only"
    # the same number on another person: WisKey's conflict, refused (nothing stored)
    r = post(c, "/people/u4/cards", "root", card_no=CARD_NUMBER, revision=rev(fake, "u4"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_card_conflict" and r.json()["details"]["outcome"] == "refused"
    # out again by id (confirmation first), then a second time: the card is gone
    assert post(c, f"/people/u6/cards/{added['id']}/remove", "mia", revision=rev(fake, "u6")).json()["code"] == "confirmation_required"
    r = post(c, f"/people/u6/cards/{added['id']}/remove", "mia", revision=rev(fake, "u6"), confirmed=True)
    assert r.status_code == 200 and all(card["id"] != added["id"] for card in r.json()["person"]["cards"])
    assert sent(fake, "cards/remove")[-1]["card_id"] == added["id"]
    r = post(c, f"/people/u6/cards/{added['id']}/remove", "mia", revision=rev(fake, "u6"), confirmed=True)
    assert r.status_code == 404 and r.json()["code"] == "intercom_card_not_found"
    assert post(c, "/people/u6/cards", "mia", card_no="bad number!", revision=rev(fake, "u6")).status_code == 422
    # never in a row (not the number, not its last digits as a mask), never in a log line
    text = json.dumps([r["details"] for r in rows(s)], ensure_ascii=False)
    assert CARD_NUMBER not in text and CARD_NUMBER[-4:] not in text
    assert CARD_NUMBER not in caplog.text


def test_the_photo_is_validated_like_wiskey_and_never_recorded(wx):
    fake, c, s = wx
    r = c.put(API + "/people/u6/photo", json=env(photo=PHOTO, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 200 and r.json()["person"]["photo_configured"] is True, r.text
    [frame] = sent(fake, "users/update")
    assert frame["data"] == {"photo": PHOTO} and frame["sync_now"] is True and frame["revision"] == 3
    shown = c.get("/api/v1/access-control/people/u6/photo", headers=as_user("mia"))
    assert shown.status_code == 200 and shown.content[:2] == b"\xff\xd8", "the read side serves the photo written"
    for bad in ("data:image/png;base64,iVBORw0KGgo=", "https://example.invalid/x.jpg", PHOTO[:-8], "data:image/jpeg;base64," + "A" * 60000):
        r = c.put(API + "/people/u6/photo", json=env(photo=bad, revision=rev(fake, "u6")), headers=as_user("mia"))
        assert r.status_code == 422 and r.json()["details"]["outcome"] == "not_sent", bad[:30]
    assert len(sent(fake, "users/update")) == 1
    r = c.put(API + "/people/u6/photo", json=env(photo=None, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 200 and r.json()["person"]["photo_configured"] is False
    fake.errors_once["users/update"] = "photo_disabled"  # the installation's photo switch was turned off meanwhile: refused, by name
    r = c.put(API + "/people/u6/photo", json=env(photo=PHOTO, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_photo_disabled" and r.json()["details"]["outcome"] == "refused", r.text
    text = json.dumps([r["details"] for r in rows(s)])
    assert PHOTO[30:60] not in text and "base64" not in text and "size" not in text


WEEKLY = {"mode": "weekly", "timezone": "Asia/Jerusalem", "days": ["Thursday", "Sunday"], "dates": [], "periods": [{"start": "13:00", "end": "17:00"}, {"start": "08:00", "end": "12:00"}]}


@pytest.mark.parametrize("bad", [
    {**WEEKLY, "mode": "hourly"},
    {**WEEKLY, "timezone": "Mars/Base"},
    {**WEEKLY, "days": ["Funday"]},
    {**WEEKLY, "days": []},
    {**WEEKLY, "dates": ["2026-12-01"]},
    {**WEEKLY, "periods": []},
    {**WEEKLY, "periods": [{"start": "09:00", "end": "08:00"}]},
    {**WEEKLY, "periods": [{"start": "08:00", "end": "12:00"}, {"start": "11:00", "end": "13:00"}]},
    {**WEEKLY, "periods": [{"start": "24:00", "end": "24:00"}]},
    {**WEEKLY, "extra": 1},
    {"mode": "dates", "timezone": "UTC", "days": [], "dates": ["2026-02-30"], "periods": [{"start": "08:00", "end": "09:00"}]},
    {"mode": "dates", "timezone": "UTC", "days": [], "dates": ["2099-01-01"], "periods": [{"start": "08:00", "end": "09:00"}]},
])
def test_a_malformed_timing_proposal_is_refused_locally(wx, bad):
    fake, c, _s = wx
    r = c.put(API + "/people/u6", json=env(data={"access_timing_draft": bad}, revision=rev(fake, "u6")), headers=as_user("root"))
    assert r.status_code == 422 and r.json()["details"]["outcome"] == "not_sent", (bad, r.text)
    assert not sent(fake, "users/update")


def test_timing_proposal_and_policy_round_trip(wx):
    fake, c, _s = wx
    r = c.put(API + "/people/u6", json=env(data={"access_timing_draft": WEEKLY}, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 200, r.text
    # WisKey's normal form: the days in week order (Monday first), the windows sorted
    assert sent(fake, "users/update")[-1]["data"]["access_timing_draft"] == {**WEEKLY, "days": ["Thursday", "Sunday"],
                                                                            "periods": [{"start": "08:00", "end": "12:00"}, {"start": "13:00", "end": "17:00"}]}
    assert r.json()["person"]["timing_draft"]["periods"][0] == {"start": "08:00", "end": "12:00"}
    # `ha` enforcement takes no device bindings; `native` binds each station to its slots (one holiday slot per run of dates)
    ha = {"mode": "ha", "schedule": WEEKLY, "bindings": {}}
    assert c.put(API + "/people/u6", json=env(data={"access_timing_policy": ha}, revision=rev(fake, "u6")), headers=as_user("mia")).status_code == 200
    assert c.put(API + "/people/u6", json=env(data={"access_timing_policy": {**ha, "bindings": {"entry-a": {}}}}, revision=rev(fake, "u6")), headers=as_user("mia")).status_code == 422
    dates = {"mode": "dates", "timezone": "Asia/Jerusalem", "days": [], "dates": ["2026-12-02", "2026-12-01", "2026-12-05"], "periods": [{"start": "08:00", "end": "24:00"}]}
    native = {"mode": "native", "schedule": dates, "bindings": {"entry-a": {"template": 5, "weekly": 6, "holiday_group": 7, "holidays": [8, 9]}}}
    r = c.put(API + "/people/u6", json=env(data={"access_timing_policy": native}, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 200, r.text
    wrong_count = {**native, "bindings": {"entry-a": {"template": 5, "weekly": 6, "holiday_group": 7, "holidays": [8]}}}
    assert c.put(API + "/people/u6", json=env(data={"access_timing_policy": wrong_count}, revision=rev(fake, "u6")), headers=as_user("mia")).status_code == 422
    # a device binding on a station outside the caller's chain is a change there too
    off = {**native, "bindings": {"entry-b": native["bindings"]["entry-a"]}}
    r = c.put(API + "/people/u6", json=env(data={"access_timing_policy": off}, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope"
    assert c.put(API + "/people/u6", json=env(data={"access_timing_draft": None, "access_timing_policy": None}, revision=rev(fake, "u6")), headers=as_user("mia")).status_code == 200


def test_category_responsible_and_purpose(wx):
    fake, c, _s = wx
    r = c.put(API + "/people/u6", json=env(data={"access_category": "visitor", "responsible_person": "Rina", "access_purpose": "סיור", "valid_from": "2026-10-01T00:00:00Z",
                                                  "valid_until": "2026-12-01T00:00:00Z"}, revision=rev(fake, "u6")), headers=as_user("mia"))
    assert r.status_code == 200, r.text
    p = r.json()["person"]
    assert (p["access_category"], p["responsible_person"], p["access_purpose"]) == ("visitor", "Rina", "סיור")
    assert c.put(API + "/people/u6", json=env(data={"access_category": None}, revision=rev(fake, "u6")), headers=as_user("mia")).status_code == 422
    assert c.put(API + "/people/u6", json=env(data={"access_category": "guest"}, revision=rev(fake, "u6")), headers=as_user("mia")).status_code == 422


# ---------------------------------------------------------------- effects, retries, the audit

def test_delete_is_unknown_effect_until_the_read_shows_it(wx):
    fake, c, s = wx
    r = post(c, "/people/u6/delete", "mia", revision=rev(fake, "u6"), confirmed=True)
    assert r.status_code == 200, r.text
    assert r.json()["effect"] == "unknown_effect" and r.json()["pending"] is True and r.json()["deleted"] == {"accepted": True}
    [outcome] = [row for row in rows(s, "intercom.person.delete") if row["details"].get("phase") == "outcome"]
    assert outcome["details"]["effect"] == "unknown_effect" and outcome["details"]["pending"] is True
    assert c.get("/api/v1/access-control/people/u6", headers=as_user("root")).status_code == 404, "the read model confirms it"


def test_an_unclear_answer_is_unknown_never_success_and_never_retried(wx):
    fake, c, s = wx
    fake.errors_once["users/archive"] = "storage_write_failed"
    body = env(revision=rev(fake, "u6"), confirmed=True)
    r = c.post(API + "/people/u6/archive", json=body, headers=as_user("mia"))
    assert r.status_code == 504 and r.json()["code"] == "intercom_outcome_unknown" and r.json()["details"]["outcome"] == "unknown", r.text
    assert len(sent(fake, "users/archive")) == 1, "sent once"
    r = c.post(API + "/people/u6/archive", json=body, headers=as_user("mia"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_duplicate_command", "the same command is never sent twice"
    assert len(sent(fake, "users/archive")) == 1
    outcome = [row for row in rows(s, "intercom.person.archive") if row["details"].get("phase") == "outcome"]
    assert [o["details"]["outcome"] for o in outcome] == ["unknown"]
    fake.errors_once["users/set_active"] = "approval_required"  # WisKey's own dual approval, switched on in WisKey: refused, never bypassed
    r = post(c, "/people/u6/active", "mia", active=False, revision=rev(fake, "u6"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_approval_required" and r.json()["details"]["outcome"] == "refused"


@pytest.mark.parametrize("command, path, body, refused, unknown", [
    ("users/archive", "/people/u6/archive", {"confirmed": True}, {"archive_state_changed": 409, "user_not_found": 404, "rate_limited": 429}, ["manager_closed", "action_failed"]),
    ("users/set_active", "/people/u6/active", {"active": False}, {"user_archived": 409, "invalid_fields": 422}, ["storage_write_failed", "manager_closed"]),
    ("users/temporary_cancel", "/people/u7/temporary-cancel", {"reason_code": "visit_cancelled", "confirmed": True}, {"temporary_already_inactive": 409}, ["device_unavailable"]),
    ("cards/add", "/people/u6/cards", {"card_no": "AB12"}, {"card_conflict": 409, "card_capacity": 422}, ["storage_write_failed"]),
])
def test_the_new_writes_are_refused_only_for_a_pre_storage_code(wx, command, path, body, refused, unknown):
    fake, c, _s = wx
    uid = path.split("/")[2]
    for code, status in refused.items():
        fake.errors_once[command] = code
        r = post(c, path, "root", revision=rev(fake, uid), **body)
        assert r.status_code == status and r.json()["details"]["outcome"] == "refused", (code, r.text)
        assert intercom_client.refusal_is_pre_device(command, code)
    for code in unknown:
        fake.errors_once[command] = code
        r = post(c, path, "root", revision=rev(fake, uid), **body)
        assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown", (code, r.text)
        assert not intercom_client.refusal_is_pre_device(command, code)


def test_audit_rows_never_hold_a_value(wx):
    fake, c, s = wx
    c.put(API + "/people/u6", json=env(data={"display_name": "Gal Secretname", "phone": PHONE, "pin": "4711", "cards": [{"card_no": CARD_NUMBER, "label": "L"}],
                                             "permission_overrides": {"entry-a": "allow"}, "door_permissions": {"entry-a": [1, 2]}}, revision=rev(fake, "u6")),
          headers=as_user("mia"))
    c.put(API + "/people/u6/photo", json=env(photo=PHOTO, revision=rev(fake, "u6")), headers=as_user("mia"))
    text = json.dumps([[r["details"], r["reason"], r["resource_id"]] for r in rows(s)], ensure_ascii=False)
    for value in ("Secretname", PHONE, "1239876", "4711", CARD_NUMBER, CARD_NUMBER[-4:], PHOTO[25:55], "allowed_locks", "[1, 2]"):
        assert value not in text, value
    [attempt] = [r for r in rows(s, "intercom.person.update") if r["details"].get("phase") == "attempt" and "phone" in r["details"].get("fields", [])]
    assert attempt["details"]["fields"] == ["cards", "display_name", "door_permissions", "permission_overrides", "phone", "pin"], "field NAMES only"
    [outcome] = [r for r in rows(s, "intercom.person.update") if r["details"].get("phase") == "outcome" and r["details"].get("command_id") == attempt["details"]["command_id"]]
    assert outcome["details"]["result"] == {"id": "u6", "revision": 4}


# ---------------------------------------------------------------- PIN generation (PG)

def test_pin_generation_is_shown_once_and_stored_nowhere(wx, caplog):
    fake, c, s = wx
    caplog.set_level(logging.DEBUG)
    fake.pin_value = SENTINEL_PIN
    r = c.post(API + "/people/pin-generate", json={"user_id": "u6"}, headers=as_user("mia"))
    assert r.status_code == 200 and r.json()["pin"] == {"pin": SENTINEL_PIN}, r.text
    assert r.headers["cache-control"] == "no-store"
    [frame] = sent(fake, "users/pin_generate")
    assert frame == {"id": frame["id"], "type": PREFIX + "users/pin_generate", "user_id": "u6", "api_contract": 1}
    r = c.post(API + "/people/pin-generate", json={"user_id": ""}, headers=as_user("root"))
    assert r.status_code == 200 and r.json()["pin"] == {"pin": SENTINEL_PIN}
    pin_rows = rows(s, "intercom.person.pin_generate")
    assert [(row["details"]["phase"], row["details"].get("outcome")) for row in pin_rows] == [("attempt", None), ("outcome", "ok")] * 2
    assert {row["resource_id"] for row in pin_rows} == {"u6", "new"} and all(row["details"]["effect"] == "personal_value" for row in pin_rows)
    for row in pin_rows:
        assert set(row["details"]) <= {"command", "phase", "outcome", "command_id", "effect", "pending"}, row["details"]
    # nowhere: the audit log, the log lines, the database file itself (WAL included)
    assert SENTINEL_PIN not in json.dumps(rows(s), ensure_ascii=False)
    assert SENTINEL_PIN not in caplog.text
    db = Path(s.db_path)
    for path in (db, db.with_name(db.name + "-wal")):
        if path.exists():
            assert SENTINEL_PIN.encode() not in path.read_bytes(), path.name
    # no other person's PIN through a person off the caller's chain; an unknown person is the uniform 404
    assert c.post(API + "/people/pin-generate", json={"user_id": "u1"}, headers=as_user("mia")).json()["code"] == "intercom_person_scope"
    assert c.post(API + "/people/pin-generate", json={"user_id": "u2"}, headers=as_user("mia")).status_code == 404
    assert c.post(API + "/people/pin-generate", json={"user_id": "u-none"}, headers=as_user("root")).status_code == 404
    assert len(sent(fake, "users/pin_generate")) == 3


def test_pin_generation_needs_an_interactive_session(wx, monkeypatch):
    fake, c, s = wx
    monkeypatch.setattr(iw, "interactive", lambda principal: False)  # a bearer-token client (the rule itself: test_interactive_session_rule)
    r = c.post(API + "/people/pin-generate", json={"user_id": "u6"}, headers=as_user("root"))
    assert r.status_code == 403 and r.json()["code"] == "intercom_pin_interactive_only" and r.json()["details"]["outcome"] == "not_sent"
    assert not sent(fake, "users/pin_generate")
    [row] = rows(s, "intercom.person.pin_generate")
    assert row["decision"] == "denied" and row["reason"] == "intercom_pin_interactive_only"
    assert c.get(API + "/people-editor/context", headers=as_user("root")).json()["context"]["pin_generate"] is False


def test_pin_generation_needs_its_own_permission(wx):
    _fake, c, s = wx
    # a custom role: people.manage and people.sensitive, NOT pin.generate
    role = c.post("/api/v1/access/roles", json={"name": "manager without PIN", "description": "S11", "permissions": ["access.read", "access.people.read"],
                                                "sensitive": [ia.PEOPLE_MANAGE, ia.PEOPLE_SENSITIVE]}).json()["id"]
    bind(c, s, "dora", role, "installation", "*")
    r = c.post(API + "/people/pin-generate", json={"user_id": "u6"}, headers=as_user("dora"))
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert [row["action"] for row in rows(s) if row["decision"] == "denied" and row["actor_username"] == "dora"] == [ia.PIN_GENERATE]


# ---------------------------------------------------------------- card capture on the station chain

def test_card_capture_follows_the_station_chain(wx):
    fake, c, _s = wx
    assert c.get(API + "/stations/entry-b/card-readers", headers=as_user("mia")).status_code == 404, "a station off her chain does not exist for her"
    assert not sent(fake, "cards/reader_capabilities")
    assert c.get(API + "/stations/entry-a/card-readers", headers=as_user("mia")).status_code == 200
    r = c.post(API + "/people/u6/card-capture", json=env(station_id="entry-b", reader_id=0, revision=rev(fake, "u6"), confirmed=True), headers=as_user("mia"))
    assert r.status_code == 403 and r.json()["code"] == "intercom_person_scope", "the reader's station must be hers too"
    r = c.post(API + "/people/u1/card-capture", json=env(station_id="entry-a", reader_id=0, revision=rev(fake, "u1"), confirmed=True), headers=as_user("mia"))
    assert r.status_code == 403, "u1 is shared with entry-b"
    assert not sent(fake, "cards/capture_start")
    r = c.post(API + "/people/u6/card-capture", json=env(station_id="entry-a", reader_id=0, revision=rev(fake, "u6"), confirmed=True), headers=as_user("nina"))
    assert r.status_code == 403 and r.json()["code"] == "forbidden", "nina holds no access.cards.capture"


def test_check_stations_rechecks_what_a_capture_start_decided(settings, station_scope):  # noqa: F811
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    bind(c, settings, "root", "system_admin", "installation", "*")
    c.get("/api/v1/me", headers=as_user("mia"))
    station_scope.bind("dev-mia", "site_admin", "entry-a")
    import sqlite3

    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    try:
        def auth(user: str) -> ia.Authority:
            return ia.Authority(conn, Principal(user_id=f"dev-{user}", username=user, display_name=user, source="dev"))

        perms = (ia.PEOPLE_MANAGE, iw.CAPTURE)
        iw.check_stations(auth("root"), None, permissions=perms, extra_stations=["entry-b"], sensitive=True)
        iw.check_stations(auth("mia"), ["entry-a"], permissions=perms, extra_stations=["entry-a"], sensitive=True)
        for stations, extra in ((None, ["entry-a"]), (["entry-a", "entry-b"], ["entry-a"]), (["entry-a"], ["entry-b"])):
            with pytest.raises(ApiError) as exc:
                iw.check_stations(auth("mia"), stations, permissions=perms, extra_stations=extra, sensitive=True)
            assert exc.value.code == "intercom_person_scope", (stations, extra)
    finally:
        conn.close()


def test_holiday_count_and_photo_rule_mirror_wiskey():
    assert iw.holiday_count({"mode": "dates", "dates": ["2026-12-01", "2026-12-02", "2026-12-04"]}) == 2
    assert iw.holiday_count({"mode": "weekly", "dates": []}) == 0
    assert iw.photo_value(PHOTO) == PHOTO and iw.photo_value(None) is None
    for bad in ("data:image/svg+xml;base64,PHN2Zz4=", PHOTO.replace("/9j/", "/8j/", 1), PHOTO + "A"):
        with pytest.raises(ValueError):
            iw.photo_value(bad)
