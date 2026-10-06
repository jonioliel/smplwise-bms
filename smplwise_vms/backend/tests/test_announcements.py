"""MU2 voice announcements: the setup, the targets (only allowed speakers; a room = its allowed speakers), the text rules, the rate limit, the
permissions, the audit rows, the rule action and the roles. EVERY speak call goes to a fake (`announcements.SPEAK` is replaced): no real device,
engine or Home Assistant is contacted; every name and id comes from the synthetic audio house of media_seed_audio."""
from __future__ import annotations

import json

import media_seed_audio as aseed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.errors import ApiError
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
from smplwise.services import announcements as ann
from smplwise.services import rules as rules_svc

API = "/api/v1/announcements"


class Speaker:
    def __init__(self) -> None:
        self.calls: list[tuple[str, list[str], str, str]] = []
        self.error: Exception | None = None

    def __call__(self, _settings, engine, entity_ids, message, language) -> None:
        self.calls.append((engine, list(entity_ids), message, language))
        if self.error:
            raise self.error


@pytest.fixture()
def world(settings, monkeypatch):
    fake = Speaker()
    monkeypatch.setattr(ann, "SPEAK", fake)
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b", "denon": "media_player.denon_main", "garden": "media_player.cast_garden"}.items()}
    return app, c, fake, keys, settings


def enable(c, keys, devices=("a", "b"), **extra):
    r = c.put(f"{API}/config", json={"enabled": True, "engine": "tts.fake_engine", "devices": sorted(keys[d] for d in devices), **extra})
    assert r.status_code == 200, r.text
    return r.json()


def audit_rows(app, action="media.announce"):
    with app.state.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def test_off_by_default_and_nothing_spoken(world):
    app, c, fake, keys, _s = world
    assert c.get(f"{API}/config").json()["config"] == {"enabled": False, "engine": "", "language": "he", "devices": [], "max_per_minute": 6, "max_text": 200, "cooldown_s": 5,
        "volume": None, "pause_music": False, "quiet": {"enabled": False, "from": "22:00", "to": "07:00", "days": ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], "mode": "suppress", "night_volume": None},
        "notify": {"enabled": False, "scope": "area", "ref": "", "categories": [], "min_severity": "alert"}}
    r = c.post(API, json={"scope": "area", "ref": "living", "text": "שלום"})
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"
    assert fake.calls == []
    row = audit_rows(app)[-1]
    assert row["decision"] == "denied" and row["reason"] == "feature_disabled"


def test_setup_lists_speakers_and_validates(world):
    _app, c, _fake, keys, _s = world
    body = c.get(f"{API}/config").json()
    names = {s["key"]: s for s in body["speakers"]}
    assert keys["a"] in names and keys["denon"] in names and not any(s["allowed"] for s in names.values())
    assert names[keys["a"]]["area_id"] == "living"
    assert c.put(f"{API}/config", json={"engine": "media_player.x"}).status_code == 422, "an engine is a tts entity"
    assert c.put(f"{API}/config", json={"devices": ["nope"]}).status_code == 422, "an unknown device"
    assert c.put(f"{API}/config", json={"max_per_minute": 0}).status_code == 422
    assert c.put(f"{API}/config", json={"language": "he; drop"}).status_code == 422
    assert c.put(f"{API}/config", json={"surprise": 1}).status_code == 422
    out = enable(c, keys, language="he-IL", max_per_minute=3)
    assert out["changed"] == sorted(["enabled", "engine", "devices", "language", "max_per_minute"])
    assert out["config"]["devices"] == sorted([keys["a"], keys["b"]])


def test_area_announcement_reaches_only_allowed_speakers(world):
    app, c, fake, keys, _s = world
    enable(c, keys, devices=("a",))  # the receiver sits in the same area but is not allowed
    areas = c.get(f"{API}/areas").json()
    assert areas["enabled"] is True and [a["area_id"] for a in areas["areas"]] == ["living"] and [d["key"] for d in areas["areas"][0]["devices"]] == [keys["a"]]
    r = c.post(API, json={"scope": "area", "ref": "living", "text": "  ארוחת   ערב  מוכנה \n"})
    assert r.status_code == 200 and r.json()["status"] == "sent" and r.json()["targets"] == 1
    assert len(fake.calls) == 1
    engine, entities, message, language = fake.calls[0]
    assert engine == "tts.fake_engine" and language == "he" and message == "ארוחת ערב מוכנה" and len(entities) == 1 and entities[0].startswith("media_player.")
    assert "media_player.denon_main" not in entities
    row = audit_rows(app)[-1]
    assert row["decision"] == "allowed" and json.loads(row["details_json"])["status"] == "sent"
    hist = c.get(f"{API}/history").json()["history"]
    assert hist[0]["status"] == "sent" and hist[0]["source"] == "manual" and hist[0]["scope"] == "area" and hist[0]["targets"] == 1


def test_device_announcement_and_not_allowed_target(world):
    _app, c, fake, keys, _s = world
    enable(c, keys, devices=("a", "b"))
    assert c.post(API, json={"scope": "device", "ref": keys["b"], "text": "מטבח"}).status_code == 200
    assert fake.calls[-1][1] and len(fake.calls) == 1
    for ref in (keys["garden"], keys["denon"], "no-such-key"):
        r = c.post(API, json={"scope": "device", "ref": ref, "text": "x"})
        assert r.status_code == 404 and r.json()["code"] == "no_targets", ref
    assert c.post(API, json={"scope": "area", "ref": "terrace", "text": "x"}).json()["code"] == "no_targets"
    assert len(fake.calls) == 1, "nothing was spoken for a speaker that is not allowed"


def test_not_configured_when_no_engine(world):
    _app, c, fake, keys, _s = world
    c.put(f"{API}/config", json={"enabled": True, "devices": [keys["a"]]})
    r = c.post(API, json={"scope": "area", "ref": "living", "text": "x"})
    assert r.status_code == 409 and r.json()["code"] == "not_configured" and fake.calls == []


@pytest.mark.parametrize("text", ["", "   ", "x" * 201, "a\x07b", "a b"])
def test_text_rules(world, text):
    _app, c, fake, keys, _s = world
    enable(c, keys)
    r = c.post(API, json={"scope": "area", "ref": "living", "text": text})
    assert r.status_code == 422 and fake.calls == []
    if text:
        assert r.json()["code"] == "text_invalid" and r.json()["details"]["message_en"]


def test_rate_limits(world):
    app, c, fake, keys, _s = world
    enable(c, keys, max_per_minute=2)
    assert c.post(API, json={"scope": "area", "ref": "living", "text": "1"}).status_code == 200
    again = c.post(API, json={"scope": "area", "ref": "living", "text": "1b"})
    assert again.status_code == 429 and again.json()["details"]["limit"] == "cooldown", "the same room twice within seconds"
    assert c.post(API, json={"scope": "area", "ref": "kitchen", "text": "2"}).status_code == 200
    third = c.post(API, json={"scope": "device", "ref": keys["a"], "text": "3"})
    assert third.status_code == 429 and third.json()["details"]["limit"] == "per_minute"
    assert len(fake.calls) == 2
    statuses = [h["status"] for h in c.get(f"{API}/history").json()["history"]]
    assert statuses.count("limited") == 2 and statuses.count("sent") == 2
    assert [r["decision"] for r in audit_rows(app)].count("denied") == 2


def test_speak_failure_is_reported_and_logged(world):
    app, c, fake, keys, _s = world
    enable(c, keys)
    fake.error = ApiError(503, "ha_unavailable", "x")
    r = c.post(API, json={"scope": "area", "ref": "living", "text": "x"})
    assert r.status_code == 502 and r.json()["code"] == "speak_failed" and r.json()["retryable"] is True
    h = c.get(f"{API}/history").json()["history"][0]
    assert h["status"] == "failed" and h["error"] == "ha_unavailable"


def test_test_button_uses_the_fixed_sentence(world):
    _app, c, fake, keys, _s = world
    enable(c, keys)
    r = c.post(f"{API}/test", json={"scope": "device", "ref": keys["a"], "language": "en"})
    assert r.status_code == 200
    assert fake.calls[0][2] == ann.TEST_TEXT["en"]
    assert c.get(f"{API}/history").json()["history"][0]["source"] == "test"
    assert c.post(f"{API}/test", json={"scope": "device", "ref": keys["a"], "text": "custom"}).status_code == 422, "no free text on the test route"


def test_permissions(world):
    app, c, fake, keys, settings = world
    enable(c, keys)
    for user, role in (("vera", "viewer"), ("olga", "operator"), ("ed", "editor"), ("sam", "site_admin")):
        bind(c, settings, user, role, "installation", "*")
    for user in ("vera", "olga", "ed"):
        assert c.post(API, json={"scope": "area", "ref": "living", "text": "x"}, headers=as_user(user)).status_code == 403, user
        assert c.get(f"{API}/areas", headers=as_user(user)).status_code == 403
    for user in ("vera", "olga", "ed", "sam"):  # setup, test and history are system.configure
        assert c.get(f"{API}/config", headers=as_user(user)).status_code == 403, user
        assert c.put(f"{API}/config", json={"enabled": False}, headers=as_user(user)).status_code == 403
        assert c.post(f"{API}/test", json={"scope": "area", "ref": "living"}, headers=as_user(user)).status_code == 403
        assert c.get(f"{API}/history", headers=as_user(user)).status_code == 403
    assert fake.calls == []
    r = c.post(API, json={"scope": "area", "ref": "living", "text": "מנהל אתר"}, headers=as_user("sam"))
    assert r.status_code == 200 and len(fake.calls) == 1
    assert audit_rows(app)[-1]["decision"] == "allowed"


def test_roles_and_labels():
    assert "media.announce" in ROLES["site_admin"] and "media.announce" in ROLES["system_admin"]
    for role in ("viewer", "kiosk", "operator", "editor"):
        assert "media.announce" not in ROLES[role]
    assert "media.announce" in SENSITIVE and PERMISSION_LABELS["media.announce"]


def _rule(c, **over):
    body = {"name": "דלת פתוחה", "trigger": {"types": ["door"], "sources": ["system"]}, "scope": {}, "cooldown_s": 0,
            "actions": [{"kind": "announce", "scope": "area", "ref": "living", "message": "הדלת פתוחה"}], **over}
    return c.post("/api/v1/rules", json=body)


def test_rule_announce_action(world):
    app, c, fake, keys, _settings = world
    enable(c, keys)
    assert _rule(c, actions=[{"kind": "announce", "scope": "area", "ref": "", "message": "x"}]).status_code == 422
    assert _rule(c, actions=[{"kind": "announce", "scope": "area", "ref": "living", "message": " "}]).status_code == 422
    assert _rule(c, actions=[{"kind": "announce", "scope": "room", "ref": "living", "message": "x"}]).status_code == 422
    assert _rule(c).status_code == 201
    ev = {"id": "e1", "type": "door", "source": "system", "severity": "alert", "camera_id": None, "occurred_at": "2026-10-05T09:00:00Z", "details": {}}
    with app.state.db.connection() as conn:
        fired = rules_svc.evaluate_event(conn, ev, "Asia/Jerusalem", deliver=False)
    assert len(fired) == 1 and fake.calls == [], "nothing is spoken under the ingest transaction"
    rules_svc.deliver_pending(fired)
    assert len(fake.calls) == 1 and fake.calls[0][2] == "הדלת פתוחה"
    assert fired[0]["announce"] == [{"scope": "area", "ref": "living", "status": "sent"}]
    hist = c.get(f"{API}/history").json()["history"][0]
    assert hist["source"] == "rule" and hist["rule_id"]
    # the installation's limits still apply to a rule: the same room again within the cooldown is limited, never spoken
    with app.state.db.connection() as conn:
        fired = rules_svc.evaluate_event(conn, {**ev, "id": "e2"}, "Asia/Jerusalem", deliver=False)
    rules_svc.deliver_pending(fired)
    assert fired[0]["announce"][0]["status"] == "rate_limited" and len(fake.calls) == 1


def test_rule_needs_media_announce_to_carry_the_action(world):
    _app, c, _fake, keys, settings = world
    enable(c, keys)
    bind(c, settings, "oren", "operator", "installation", "*")  # operator: no rules.manage either; the point is the 403, not a 201
    r = c.post("/api/v1/rules", json={"name": "x", "actions": [{"kind": "announce", "scope": "area", "ref": "living", "message": "x"}]}, headers=as_user("oren"))
    assert r.status_code == 403


def test_announcements_off_means_a_rule_speaks_nothing(world):
    app, c, fake, keys, _s = world
    assert _rule(c).status_code == 201
    ev = {"id": "e9", "type": "door", "source": "system", "severity": "alert", "camera_id": None, "occurred_at": "2026-10-05T09:00:00Z", "details": {}}
    with app.state.db.connection() as conn:
        fired = rules_svc.evaluate_event(conn, ev, "Asia/Jerusalem", deliver=False)
    rules_svc.deliver_pending(fired)
    assert fired[0]["announce"][0]["status"] == "feature_disabled" and fake.calls == []


def test_rule_manager_without_media_announce_is_refused_for_an_announce_action(world):
    """Gap from 2.2.0: the user HOLDS rules.manage (site administrator) but media.announce is denied to them -> 403 on create and on update."""
    app, c, fake, keys, settings = world
    enable(c, keys)
    # rules.manage is a built-in (system) permission, so a custom role cannot hold it alone: the realistic way to hold it WITHOUT
    # media.announce is a site administrator whom an administrator denied the (sensitive) announce permission by a deny binding.
    role = c.post("/api/v1/access/roles", json={"name": "הכרזות בלבד", "permissions": [], "sensitive": ["media.announce"]})
    assert role.status_code == 201, role.text
    bind(c, settings, "rita", "site_admin", "installation", "*")
    r = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-rita", "role_id": role.json()["id"], "scope_type": "installation", "scope_id": "*", "effect": "deny"})
    assert r.status_code == 201, r.text
    H = as_user("rita")
    plain = {"name": "חוק רגיל", "trigger": {"types": ["door"], "sources": ["system"]}, "scope": {}, "cooldown_s": 0, "actions": [{"kind": "notify"}]}
    ok = c.post("/api/v1/rules", json=plain, headers=H)
    assert ok.status_code == 201, "precondition: the user really holds rules.manage: " + ok.text
    speaking = {**plain, "name": "חוק מכריז", "actions": [{"kind": "announce", "scope": "area", "ref": "living", "message": "הדלת פתוחה"}]}
    r = c.post("/api/v1/rules", json=speaking, headers=H)
    assert r.status_code == 403, r.text
    # update path: turning an existing plain rule into a speaking one is refused too, and the stored rule is unchanged
    rule = ok.json()
    r = c.patch(f"/api/v1/rules/{rule['id']}", json={**speaking, "revision": rule["revision"]}, headers=H)
    assert r.status_code == 403, r.text
    assert c.get(f"/api/v1/rules/{rule['id']}", headers=H).json()["actions"] == rule["actions"]
    assert [x for x in c.get("/api/v1/rules", headers=H).json().get("rules", []) if x["name"] == "חוק מכריז"] == []
    assert fake.calls == []
    # the administrator (who holds media.announce) can save the same body
    assert c.post("/api/v1/rules", json=speaking).status_code == 201
