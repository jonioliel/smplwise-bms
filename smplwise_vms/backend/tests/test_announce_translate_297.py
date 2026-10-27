"""ANNOUNCE-297 (voice announcements, stage C): automatic translation of a Hebrew announcement into Arabic, English and Russian, plus the screens'
dismiss rule and the machine-translation mark.

NOTHING leaves the test: every provider is a fake (`FakeTranslator` registered as a provider, or the cloud seam `CLOUD_CALL` replaced) and
`urllib.request.urlopen` is made to fail loudly in every test, so a stray real call would break the test instead of reaching a service."""
from __future__ import annotations

import datetime as dt
import json
import urllib.request

import media_seed_audio as aseed
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import announce_translate as tr
from smplwise.services import announcements as ann
from smplwise.services import notify

API = "/api/v1/announcements"
WALL = as_user("wall")
ADMIN = as_user("joni")
KEY = "tr-test-SECRET-0123456789"


class Speaker:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def __call__(self, _settings, engine, entity_ids, message, language) -> None:
        self.calls.append((engine, list(entity_ids), message, language))


def _no_network(*_a, **_k):
    raise AssertionError("a test reached urllib.request.urlopen: no external call is allowed")


@pytest.fixture()
def world(settings, monkeypatch):
    fake = Speaker()
    monkeypatch.setattr(ann, "SPEAK", fake)
    monkeypatch.setattr(ann, "PLAYER_STATE", lambda _s, _e: None)
    monkeypatch.setattr(ann, "PLAYER_CALL", lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("no player action is expected")))
    monkeypatch.setattr(ann, "SLEEP", lambda _s: None)
    monkeypatch.setattr(urllib.request, "urlopen", _no_network)
    clock = {"now": dt.datetime.now(dt.timezone.utc).replace(microsecond=0)}
    monkeypatch.setattr(notify, "now_utc", lambda: clock["now"])
    monkeypatch.delenv("SW_ANNOUNCE_TRANSLATE_KEY", raising=False)
    translator = tr.FakeTranslator()
    monkeypatch.setitem(tr.PROVIDERS, "fake", lambda _c, _s: translator)
    tr.reset()
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    c.post("/api/v1/multimedia/admin/approve", json={})
    c.get("/api/v1/me", headers=ADMIN)
    c.get("/api/v1/me", headers=WALL)

    class W:
        pass

    w = W()
    w.app, w.c, w.speaker, w.settings, w.clock, w.db, w.tr = app, c, fake, settings, clock, app.state.db, translator
    w.keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b"}.items()}
    yield w
    tr.reset()


def advance(w, seconds=10):
    w.clock["now"] += dt.timedelta(seconds=seconds)


def enable(w, **extra):
    r = w.c.put(f"{API}/config", json={"enabled": True, "engine": "tts.fake_engine", "devices": sorted(w.keys.values()), **extra})
    assert r.status_code == 200, r.text
    return r.json()


def turn_on(w, provider="fake"):
    r = w.c.put(f"{API}/config", json={"translate": {"enabled": True, "provider": provider, "approve": True}})
    assert r.status_code == 200, r.text
    return r.json()["config"]["translate"]


def audits(w, action):
    with w.db.connection(mode="read") as conn:
        return [{**dict(r), "details": json.loads(r["details_json"] or "{}")} for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def rows(w):
    with w.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM announcements ORDER BY rowid").fetchall()]


# ---------------------------------------------------------------------------------------------------- off by default, approval

def test_translation_is_off_by_default_and_refuses_before_any_provider_is_built(world, monkeypatch):
    w = world
    cfg = enable(w)["config"]["translate"]
    assert cfg == {"enabled": False, "provider": "off", "source": "he", "targets": ["ar", "en", "ru"], "approval": None, "key_set": False}
    built = []
    monkeypatch.setitem(tr.PROVIDERS, "fake", lambda _c, _s: built.append(1))
    r = w.c.post(f"{API}/translate", json={"text": "שלום לכולם"})
    assert r.status_code == 404 and r.json()["code"] == "translate_off"
    assert built == [] and w.tr.calls == []
    form = w.c.get(f"{API}/areas").json()
    assert form["translate_enabled"] is False and form["translate_targets"] == ["ar", "en", "ru"]
    (a,) = audits(w, "media.announce.translate")
    assert a["decision"] == "denied" and a["reason"] == "translate_off" and "שלום" not in a["details_json"]


def test_enabling_needs_a_recorded_approval_bound_to_the_provider(world):
    w = world
    enable(w)
    r = w.c.put(f"{API}/config", json={"translate": {"enabled": True, "provider": "fake"}})
    assert r.status_code == 422 and "translate.approval_required" in json.dumps(r.json())
    for bad in ({"enabled": "yes"}, {"provider": "deepl-direct"}, {"targets": ["he"]}, {"targets": []}, {"targets": ["ar", "ar"]}, {"approve": True}, {"nope": 1}, {}):
        assert w.c.put(f"{API}/config", json={"translate": bad}).status_code == 422, bad
    cfg = turn_on(w)
    assert cfg["enabled"] is True and cfg["provider"] == "fake" and cfg["approval"]["provider"] == "fake" and cfg["approval"]["by"] and cfg["approval"]["at"]
    a = audits(w, "media.announce.config")[-1]
    assert a["details"]["translate"] == {"enabled": True, "provider": "fake", "approve": True}
    # another provider is a new decision: the old approval does not carry over
    r = w.c.put(f"{API}/config", json={"translate": {"provider": "cloud"}})
    assert r.status_code == 422 and "translate.approval_required" in json.dumps(r.json())
    # switching off needs no approval; the approval of the provider stays recorded
    off = w.c.put(f"{API}/config", json={"translate": {"enabled": False}}).json()["config"]["translate"]
    assert off["enabled"] is False and off["approval"]["provider"] == "fake"
    # only system.configure may change it
    bind(w.c, w.settings, "anna", "announcer", "installation", "*")
    assert w.c.put(f"{API}/config", headers=as_user("anna"), json={"translate": {"enabled": True}}).status_code == 403


# ---------------------------------------------------------------------------------------------------- the draft

def test_translate_returns_reviewable_drafts_marked_machine_and_caches_them(world):
    w = world
    enable(w)
    turn_on(w)
    assert w.c.get(f"{API}/areas").json()["translate_enabled"] is True
    r = w.c.post(f"{API}/translate", json={"text": "  המעלית   בתחזוקה  "})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "he" and body["provider"] == "fake"
    assert [(i["language"], i["text"], i["machine"], i["cached"]) for i in body["items"]] == [
        ("ar", "[ar] המעלית בתחזוקה", True, False), ("en", "[en] המעלית בתחזוקה", True, False), ("ru", "[ru] המעלית בתחזוקה", True, False)]
    assert len(w.tr.calls) == 3
    # nothing was announced: no speaker, no row
    assert w.speaker.calls == [] and rows(w) == []
    # the same text again: from the cache, the provider is not asked
    again = w.c.post(f"{API}/translate", json={"text": "המעלית בתחזוקה", "targets": ["en"]}).json()
    assert again["items"] == [{"language": "en", "text": "[en] המעלית בתחזוקה", "machine": True, "cached": True}] and len(w.tr.calls) == 3
    a = audits(w, "media.announce.translate")
    assert [x["decision"] for x in a] == ["allowed", "allowed"] and a[1]["details"]["cached"] == 1
    assert all("המעלית" not in x["details_json"] for x in a), "the audit names the languages and the length, never the text"
    # a settings change empties the cache
    assert w.c.put(f"{API}/config", json={"translate": {"targets": ["ar", "ru"]}}).status_code == 200
    assert w.c.post(f"{API}/translate", json={"text": "המעלית בתחזוקה"}).json()["items"][0]["cached"] is False


def test_translate_needs_media_announce_and_a_clean_text(world):
    w = world
    enable(w)
    turn_on(w)
    assert w.c.post(f"{API}/translate", json={"text": "<speak>x</speak> "}).status_code == 422
    assert w.c.post(f"{API}/translate", json={"text": "שלום", "targets": ["he"]}).status_code == 422
    bind(w.c, w.settings, "rina", "viewer", "installation", "*")
    assert w.c.post(f"{API}/translate", headers=as_user("rina"), json={"text": "שלום"}).status_code == 403


def test_provider_failures_are_codes_and_a_too_long_answer_is_refused_not_cut(world, monkeypatch):
    w = world
    enable(w)
    turn_on(w)

    class Bad:
        name = "fake"

        def __init__(self, answer):
            self.answer = answer

        def translate(self, text, source, target):
            if isinstance(self.answer, Exception):
                raise self.answer
            return self.answer

    monkeypatch.setitem(tr.PROVIDERS, "fake", lambda _c, _s: Bad("x" * 500))
    r = w.c.post(f"{API}/translate", json={"text": "א"})
    assert r.status_code == 502 and r.json()["code"] == "translate_too_long"
    monkeypatch.setitem(tr.PROVIDERS, "fake", lambda _c, _s: Bad(tr.TranslateError("translate_unreachable")))
    r = w.c.post(f"{API}/translate", json={"text": "ב"})
    assert r.status_code == 502 and r.json()["code"] == "translate_unreachable"
    monkeypatch.setitem(tr.PROVIDERS, "fake", lambda _c, _s: Bad("   "))
    assert w.c.post(f"{API}/translate", json={"text": "ג"}).json()["code"] == "translate_failed"
    monkeypatch.setitem(tr.PROVIDERS, "fake", lambda _c, _s: None)
    r = w.c.post(f"{API}/translate", json={"text": "ד"})
    assert r.status_code == 409 and r.json()["code"] == "translate_not_configured"


def test_the_provider_call_cap_bounds_external_calls(world, monkeypatch):
    w = world
    enable(w)
    turn_on(w)
    monkeypatch.setattr(tr, "CALLS_PER_MINUTE", 4)
    assert w.c.post(f"{API}/translate", json={"text": "אחת"}).status_code == 200  # 3 calls
    r = w.c.post(f"{API}/translate", json={"text": "שתיים"})  # the 5th call is over the cap
    assert r.status_code == 429 and r.json()["code"] == "translate_rate_limited"


def test_the_cloud_provider_reads_its_key_from_the_secrets_store_and_goes_through_the_seam(world, monkeypatch):
    w = world
    enable(w)
    seen = []
    monkeypatch.setattr(tr, "CLOUD_CALL", lambda key, text, source, target: seen.append((key, text, source, target)) or f"{target}:{text}")
    assert w.c.put(f"{API}/config", json={"translate": {"enabled": True, "provider": "cloud", "approve": True}}).status_code == 200
    cfg = w.c.get(f"{API}/config").json()["config"]["translate"]
    assert cfg["key_set"] is False and KEY not in json.dumps(cfg)
    assert w.c.get(f"{API}/areas").json()["translate_enabled"] is False, "no key: the form does not offer it"
    r = w.c.post(f"{API}/translate", json={"text": "שלום"})
    assert r.status_code == 409 and r.json()["code"] == "translate_not_configured" and seen == []
    assert w.c.put("/api/v1/system/secrets/announce_translate_key", json={"value": KEY}).status_code == 200
    r = w.c.post(f"{API}/translate", json={"text": "שלום", "targets": ["ru"]})
    assert r.status_code == 200 and r.json()["items"][0]["text"] == "ru:שלום" and seen == [(KEY, "שלום", "he", "ru")]
    assert KEY not in r.text and KEY not in json.dumps(w.c.get(f"{API}/config").json())
    assert all(KEY not in a["details_json"] for a in audits(w, "media.announce.translate") + audits(w, "media.announce.config"))
    assert repr(tr.CloudTranslator(KEY)) == "CloudTranslator(key=***)"


def test_the_default_cloud_call_maps_failures_to_codes_without_leaking(monkeypatch):
    def boom(*_a, **_k):
        raise OSError(f"cannot reach {tr.CLOUD_URL} with {KEY}")

    monkeypatch.setattr(urllib.request, "urlopen", boom)
    with pytest.raises(tr.TranslateError) as exc:
        tr.default_cloud_call(KEY, "שלום", "he", "en")
    assert exc.value.code == "translate_unreachable" and KEY not in str(exc.value)


# ---------------------------------------------------------------------------------------------------- sending a reviewed translation

def test_a_reviewed_translation_is_sent_with_the_machine_mark_kept_everywhere(world):
    w = world
    enable(w)
    turn_on(w)
    advance(w)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "texts": [{"language": "he", "text": "המים יופסקו"}, {"language": "en", "text": "Water will be cut (edited)", "machine": True},
                                                                  {"language": "ar", "text": "سيتم قطع المياه", "machine": True}]})
    assert r.status_code == 200, r.text
    (row,) = rows(w)
    assert json.loads(row["texts_json"]) == [["he", "המים יופסקו"], ["en", "Water will be cut (edited)", "mt"], ["ar", "سيتم قطع المياه", "mt"]]
    assert [c[3] for c in w.speaker.calls] == ["he", "en", "ar"], "the speakers say every language as before"
    h = w.c.get(f"{API}/history").json()["history"][0]
    assert h["machine_translated"] == ["en", "ar"]
    a = audits(w, "media.announce")[-1]
    assert a["details"]["machine_translated"] == ["ar", "en"]
    # Hebrew is the source: it can never be marked; a mark on a language that is not sent is refused
    advance(w)
    assert w.c.post(API, json={"scope": "all", "ref": "*", "texts": [{"language": "he", "text": "x", "machine": True}]}).status_code == 422


def test_the_machine_mark_reaches_the_wall_and_the_close_rule_is_served(world):
    w = world
    enable(w, screens={"enabled": True})
    cams = [w.c.post("/api/v1/cameras", json={"channel": n, "alias": f"cam{n}"}).json()["id"] for n in (1, 2)]
    assert w.c.post("/api/v1/wall/profiles", json={"user_id": "dev-wall", "title": "קבלה", "cameras": cams}, headers=ADMIN).status_code == 201
    assert w.c.put(f"{API}/config", json={"screens": {"targets": [{"key": "wall:dev-wall", "area_id": "living"}], "critical_close_s": 30}}).status_code == 200
    for bad in (-1, 601, True, "5"):
        assert w.c.put(f"{API}/config", json={"screens": {"critical_close_s": bad}}).status_code == 422, bad
    advance(w)
    assert w.c.post(API, json={"scope": "area", "ref": "living", "speakers": False,
                               "texts": [{"language": "he", "text": "לקבלה"}, {"language": "ru", "text": "На ресепшн", "machine": True}]}).status_code == 200
    got = w.c.get("/api/v1/wall/announcement", headers=WALL).json()
    assert got["critical_close_s"] == 30
    assert got["announcement"]["texts"] == [{"language": "he", "text": "לקבלה"}, {"language": "ru", "text": "На ресепшн", "machine": True}]


def test_a_held_announcement_keeps_its_machine_mark_when_released(world):
    w = world
    enable(w, quiet={"enabled": True, "from": "00:00", "to": "23:59", "mode": "queue"})
    advance(w)
    r = w.c.post(API, json={"scope": "all", "ref": "*", "texts": [{"language": "he", "text": "לילה"}, {"language": "en", "text": "Night", "machine": True}]})
    assert r.status_code == 200 and r.json()["status"] == "queued"
    assert w.c.put(f"{API}/config", json={"quiet": {"enabled": False}}).status_code == 200
    w.clock["now"] += dt.timedelta(days=1)
    assert ann.release_queued(w.db, w.settings, w.clock["now"]) == 1
    (row,) = rows(w)
    assert row["status"] == "sent" and json.loads(row["texts_json"])[1] == ["en", "Night", "mt"]
