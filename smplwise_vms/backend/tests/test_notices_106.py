"""CR-NOTICE106 (NOTICE106B-295): the notice board - module switch, notices, audiences, permissions, TV boards and the tokenised
display routes (feed, ETag / 304, uniform 404, rate limits, headers, no personal data), the LAN listener's routing, the display
settings' validation, the weather / news blocks and the retention sweep. Fakes only: no lab, no network."""
from __future__ import annotations

import datetime as dt
import json

import pytest

from conftest import as_user, bind
from smplwise.db import Database
from smplwise.services.notices import display as disp
from smplwise.services.notices import listener, model, page, sources, store

API = "/api/v1"


def _on(client) -> None:
    r = client.patch(f"{API}/notices/settings", json={"enabled": True})
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["enabled"] is True


def _iso(delta_h: float = 0.0) -> str:
    return model.iso(dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=delta_h))


def _notice(client, **kw) -> dict:
    body = {"title": "הפסקת מים מחר 10:00-12:00", "body": "עקב עבודות.\nמומלץ למלא מים.", "severity": "info", "publish": True, **kw}
    r = client.post(f"{API}/notices", json=body)
    assert r.status_code == 200, r.text
    return r.json()["notice"]


def _board(client, slug: str = "lobby", **display) -> tuple[dict, str]:
    r = client.post(f"{API}/notices/boards", json={"name": "לוח הלובי", "slug": slug, "display": display or None})
    assert r.status_code == 200, r.text
    return r.json()["board"], r.json()["token"]


def _feed(client, slug: str, token: str | None, **headers):
    h = {"X-Board-Token": token} if token else {}
    h.update(headers)
    return client.get(f"{API}/notices/display/{slug}", headers=h)


# ---------------------------------------------------------------- the module switch


def test_module_is_off_by_default_and_every_gated_route_is_404(client):
    assert client.get(f"{API}/notices/module").json()["enabled"] is False
    for path in ("/notices", "/notices/boards", "/notices/abc"):
        r = client.get(API + path)
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", path
    assert client.get(f"{API}/me").json()["modules"]["notices"] is False


def test_switching_on_is_audited_and_reaches_me(client, settings):
    _on(client)
    assert client.get(f"{API}/me").json()["modules"]["notices"] is True
    db = Database(settings.db_path)
    with db.connection() as conn:
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'notices.%'").fetchall()]
    assert "notices.module.enable" in actions


def test_settings_validation_and_permission(client, settings):
    assert client.patch(f"{API}/notices/settings", json={"default_days": 0}).status_code == 422
    assert client.patch(f"{API}/notices/settings", json={"weather_entity": "sensor.x"}).status_code == 422
    assert client.patch(f"{API}/notices/settings", json={"default_days": 14}).json()["settings"]["default_days"] == 14
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}, headers=as_user("dana")).status_code == 403


# ---------------------------------------------------------------- notices


def test_create_publish_and_the_derived_state(client):
    _on(client)
    n = _notice(client)
    assert n["state"] == "active" and n["pinned"] is False
    # the default window: notices.default_days (7)
    start, end = model.parse_iso(n["starts_at"]), model.parse_iso(n["ends_at"])
    assert abs((end - start).total_seconds() - 7 * 86400) < 5
    later = _notice(client, title="מתוזמנת", starts_at=_iso(5), ends_at=_iso(10))
    assert later["state"] == "scheduled"
    draft = client.post(f"{API}/notices", json={"title": "טיוטה"}).json()["notice"]
    assert draft["state"] == "draft"
    states = {x["title"]: x["state"] for x in client.get(f"{API}/notices?scope=all").json()["notices"]}
    assert states == {"הפסקת מים מחר 10:00-12:00": "active", "מתוזמנת": "scheduled", "טיוטה": "draft"}


def test_effective_state_boundaries():
    now = dt.datetime(2026, 10, 24, 9, 0, tzinfo=dt.timezone.utc)
    row = {"status": "published", "starts_at": "2026-10-24T09:00:00Z", "ends_at": "2026-10-24T10:00:00Z"}
    assert model.effective_state(row, now) == "active"
    assert model.effective_state(row, now - dt.timedelta(seconds=1)) == "scheduled"
    assert model.effective_state(row, now + dt.timedelta(hours=1)) == "expired"
    assert model.effective_state({**row, "ends_at": None}, now + dt.timedelta(days=900)) == "active"
    assert model.effective_state({**row, "status": "draft"}, now) == "draft"
    assert model.effective_state({**row, "status": "archived"}, now) == "archived"


def test_critical_needs_an_end_and_is_pinned_by_default(client):
    _on(client)
    r = client.post(f"{API}/notices", json={"title": "דחוף", "severity": "critical", "until_archived": True})
    assert r.status_code == 422 and r.json()["details"]["field"] == "ends_at"
    n = _notice(client, title="דחוף", severity="critical", ends_at=_iso(3))
    assert n["pinned"] is True


def test_plain_text_only_and_limits(client):
    _on(client)
    assert client.post(f"{API}/notices", json={"title": "x" * 121}).status_code == 422
    assert client.post(f"{API}/notices", json={"title": "a\x07b"}).status_code == 422
    assert client.post(f"{API}/notices", json={"title": "ok", "dwell_s": 1}).status_code == 422


def test_readers_see_active_notices_of_their_audience_only(client, settings):
    _on(client)
    tree = __import__("conftest").seed_tree(client)
    bind(client, settings, "dana", "viewer", "floor", tree["floor2"])
    bind(client, settings, "omer", "viewer", "floor", tree["floor3"])
    _notice(client, title="לכולם", audience={"everyone": True})
    _notice(client, title="קומה 2", audience={"floors": [tree["floor2"]]})
    client.post(f"{API}/notices", json={"title": "טיוטה"})
    _notice(client, title="לוחות בלבד", audience={})
    dana = [n["title"] for n in client.get(f"{API}/notices", headers=as_user("dana")).json()["notices"]]
    omer = [n["title"] for n in client.get(f"{API}/notices", headers=as_user("omer")).json()["notices"]]
    assert sorted(dana) == ["לכולם", "קומה 2"] and omer == ["לכולם"]
    assert "audience" not in client.get(f"{API}/notices", headers=as_user("dana")).json()["notices"][0]
    # a reader cannot list everything, write, or open a notice outside his audience (the same 404 as an unknown id)
    assert client.get(f"{API}/notices?scope=all", headers=as_user("dana")).status_code == 403
    assert client.post(f"{API}/notices", json={"title": "x"}, headers=as_user("dana")).status_code == 403
    floor2 = next(n for n in client.get(f"{API}/notices?scope=all").json()["notices"] if n["title"] == "קומה 2")
    assert client.get(f"{API}/notices/{floor2['id']}", headers=as_user("omer")).status_code == 404
    assert client.post(f"{API}/notices/{floor2['id']}/read", headers=as_user("dana")).status_code == 200
    mine = {n["title"]: n["read"] for n in client.get(f"{API}/notices", headers=as_user("dana")).json()["notices"]}
    assert mine["קומה 2"] is True and mine["לכולם"] is False


def test_a_floor_scoped_writer_stays_inside_his_scope(client, settings):
    _on(client)
    tree = __import__("conftest").seed_tree(client)
    bind(client, settings, "edna", "viewer", "floor", tree["floor2"])
    bind(client, settings, "edna", "notices_manage", "floor", tree["floor2"])  # the writer grant, scoped to one floor
    h = as_user("edna")
    ok = client.post(f"{API}/notices", json={"title": "קומה 2", "audience": {"floors": [tree["floor2"]]}}, headers=h)
    assert ok.status_code == 200, ok.text
    for aud_ in ({"everyone": True}, {"floors": [tree["floor3"]]}, {"roles": ["viewer"]}):
        r = client.post(f"{API}/notices", json={"title": "מחוץ", "audience": aud_}, headers=h)
        assert r.status_code == 403 and r.json()["code"] == "audience_out_of_scope", aud_


def test_archive_and_delete_rules(client):
    _on(client)
    n = _notice(client)
    assert client.delete(f"{API}/notices/{n['id']}").status_code == 409  # published: archived, never deleted
    assert client.post(f"{API}/notices/{n['id']}/archive").json()["notice"]["state"] == "archived"
    assert client.patch(f"{API}/notices/{n['id']}", json={"title": "x"}).status_code == 409
    d = client.post(f"{API}/notices", json={"title": "טיוטה"}).json()["notice"]
    assert client.delete(f"{API}/notices/{d['id']}").json() == {"deleted": True}
    assert client.get(f"{API}/notices/{d['id']}").status_code == 404


def test_audience_preview_counts(client, settings):
    _on(client)
    bind(client, settings, "dana", "viewer", "installation", "*")
    r = client.post(f"{API}/notices/audience/preview", json={"audience": {"everyone": True}}).json()
    assert r["users"] >= 2 and r["in_scope"] is True
    assert client.get(f"{API}/notices/audience/options").status_code == 200


# ---------------------------------------------------------------- boards


def test_board_create_shows_the_token_once_and_stores_only_its_hash(client, settings):
    _on(client)
    b, token = _board(client)
    assert len(token) >= 40 and b["has_token"] and "token" not in b
    with Database(settings.db_path).connection() as conn:
        row = conn.execute("SELECT token_hash FROM notice_boards WHERE id = ?", (b["id"],)).fetchone()
    assert row["token_hash"] == store.token_hash(token) and token not in json.dumps(client.get(f"{API}/notices/boards").json())
    assert client.post(f"{API}/notices/boards", json={"name": "שוב", "slug": "lobby"}).status_code == 422  # slug taken
    assert client.post(f"{API}/notices/boards", json={"name": "רע", "slug": "Lobby!"}).status_code == 422


def test_boards_need_notices_boards(client, settings):
    _on(client)
    bind(client, settings, "edna", "notices_manage", "installation", "*")
    h = as_user("edna")
    assert client.post(f"{API}/notices/boards", json={"name": "x", "slug": "x"}, headers=h).status_code == 403
    b, _ = _board(client)
    assert client.get(f"{API}/notices/boards", headers=h).json()["full"] is False  # names only, for the compose dialog
    assert client.patch(f"{API}/notices/boards/{b['id']}", json={"name": "y"}, headers=h).status_code == 403


def test_display_settings_are_validated(client):
    _on(client)
    b, _ = _board(client)
    for bad in ({"rotate_s": 5}, {"rotate_s": 61}, {"mode": "grid"}, {"template": 4}, {"urgent": "x"}, {"night": {"dim": 0.1}},
                {"news": {"feeds": [{"name": "x", "url": "http://insecure.example/rss"}]}}, {"hold": "not-on-board"}):
        r = client.patch(f"{API}/notices/boards/{b['id']}", json={"display": bad})
        assert r.status_code == 422, bad
    ok = client.patch(f"{API}/notices/boards/{b['id']}", json={"display": {"rotate_s": 20, "mode": "focus", "theme": "dark", "font_size": "m"}}).json()
    d = ok["board"]["display"]
    assert (d["rotate_s"], d["mode"], d["theme"], d["font_size"], d["template"]) == (20, "focus", "night", "m", 1)


def test_normalize_display_fills_every_key():
    d = model.normalize_display({"template": 3, "blocks": {"info": ["generator", "elevators"]}, "theme": "light"})
    assert d["template"] == 3 and d["theme"] == "day" and d["blocks"]["info"] == ["elevators", "generator"]
    assert set(d) == set(model.DISPLAY_DEFAULTS)
    assert model.normalize_display({"rotate_s": 99})["rotate_s"] == 12


# ---------------------------------------------------------------- the display feed


def test_feed_good_token_etag_and_304(client):
    _on(client)
    b, token = _board(client)
    n = _notice(client, boards=[b["id"]], dwell_s=24, when_text="יום שלישי 27.10")
    _notice(client, title="לא בלוח")
    r = _feed(client, "lobby", token)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert [x["id"] for x in doc["notices"]] == [n["id"]] and doc["notices"][0]["dwell_s"] == 24 and doc["notices"][0]["when"] == "יום שלישי 27.10"
    etag = r.headers["etag"]
    assert _feed(client, "lobby", token, **{"If-None-Match": etag}).status_code == 304
    client.patch(f"{API}/notices/{n['id']}", json={"title": "חדש"})
    r2 = _feed(client, "lobby", token, **{"If-None-Match": etag})
    assert r2.status_code == 200 and r2.json()["notices"][0]["title"] == "חדש"


def test_feed_headers_and_no_personal_data(client, settings):
    _on(client)
    b, token = _board(client)
    _notice(client, boards=[b["id"]], audience={"everyone": True})
    r = _feed(client, "lobby", token)
    assert r.headers["cache-control"] == "no-store" and r.headers["x-robots-tag"] == "noindex, nofollow"
    assert "default-src 'none'" in r.headers["content-security-policy"] and r.headers["referrer-policy"] == "no-referrer"
    doc = r.json()
    allowed_notice = {"id", "title", "body", "severity", "starts_at", "ends_at", "pinned", "published_at", "dwell_s", "when"}
    assert set(doc["notices"][0]) <= allowed_notice
    assert set(doc) <= {"board", "now", "notices", "weather", "news", "sun", "control", "info"}
    assert set(doc["board"]) == {"name", "slug", "display", "building", "tz", "logos", "version"}
    text = json.dumps(doc, ensure_ascii=False)
    for secret in ("joni", "dev-joni", "audience", "created_by", "token"):
        assert secret not in text, secret


def test_wrong_rotated_disabled_and_module_off_are_the_same_404(client):
    _on(client)
    b, token = _board(client)
    assert _feed(client, "lobby", None).status_code == 404
    assert _feed(client, "lobby", "x" * 43).status_code == 404
    assert _feed(client, "nope", token).status_code == 404
    new = client.post(f"{API}/notices/boards/{b['id']}/rotate-token").json()["token"]
    assert _feed(client, "lobby", token).status_code == 404 and _feed(client, "lobby", new).status_code == 200
    client.patch(f"{API}/notices/boards/{b['id']}", json={"enabled": False})
    assert _feed(client, "lobby", new).status_code == 404
    client.patch(f"{API}/notices/boards/{b['id']}", json={"enabled": True})
    client.patch(f"{API}/notices/settings", json={"enabled": False})
    r = _feed(client, "lobby", new)
    assert r.status_code == 404 and r.json()["code"] == "not_found"
    client.patch(f"{API}/notices/settings", json={"enabled": True})
    client.delete(f"{API}/notices/boards/{b['id']}")
    assert _feed(client, "lobby", new).status_code == 404


def test_twenty_misses_then_429(client):
    _on(client)
    _board(client)
    codes = [_feed(client, "lobby", "w" * 43).status_code for _ in range(21)]
    assert codes[:20] == [404] * 20 and codes[20] == 429


def test_remote_channel_is_refused_unless_allowed(client, settings):
    _on(client)
    b, token = _board(client)
    db = Database(settings.db_path)
    svc = disp.DisplayService(lambda: db.connection(mode="read"), settings.data_dir, limiter=disp.RateLimiter())
    assert svc.feed(disp.Request("lobby", token, remote=True)).status == 404
    client.patch(f"{API}/notices/settings", json={"boards_remote": True})
    assert svc.feed(disp.Request("lobby", token, remote=True)).status == 200


def test_hold_follows_the_notice(client):
    _on(client)
    b, token = _board(client)
    n = _notice(client, boards=[b["id"]])
    assert client.patch(f"{API}/notices/boards/{b['id']}", json={"display": {"hold": n["id"]}}).status_code == 200
    assert _feed(client, "lobby", token).json()["board"]["display"]["hold"] == n["id"]
    client.post(f"{API}/notices/{n['id']}/archive")
    assert _feed(client, "lobby", token).json()["board"]["display"]["hold"] == ""


def test_control_lease_reaches_the_feed(client):
    _on(client)
    b, token = _board(client)
    assert client.post(f"{API}/notices/boards/{b['id']}/control", json={"cmd": "next"}).json()["control"] == {"seq": 1, "cmd": "next"}
    assert _feed(client, "lobby", token).json()["control"] == {"seq": 1, "cmd": "next"}
    assert client.post(f"{API}/notices/boards/{b['id']}/control", json={"cmd": "jump"}).status_code == 422


def test_preview_through_the_session_with_draft_display(client):
    _on(client)
    b, _ = _board(client)
    r = client.post(f"{API}/notices/boards/{b['id']}/preview", json={"display": {"template": 2, "mode": "all"}})
    assert r.status_code == 200 and r.json()["board"]["display"]["template"] == 2 and r.json()["board"]["display"]["mode"] == "all"


def test_board_items_order(client):
    _on(client)
    b, token = _board(client)
    a = _notice(client, title="א")
    c = _notice(client, title="ב")
    assert client.put(f"{API}/notices/boards/{b['id']}/items", json={"notice_ids": [c["id"], a["id"]]}).status_code == 200
    detail = client.get(f"{API}/notices/boards/{b['id']}").json()
    assert [n["title"] for n in detail["notices"]] == ["ב", "א"] and detail["board"]["item_count"] == 2


# ---------------------------------------------------------------- the page and the LAN listener


def _www(tmp_path):
    www = tmp_path / "www"
    (www / "assets").mkdir(parents=True)
    (www / "notice-tv.html").write_text('<!doctype html><html><head><script type="module" src="./assets/notice-tv-1.js"></script>'
                                        '<link rel="stylesheet" href="./assets/notice-tv-1.css"></head><body></body></html>', encoding="utf-8")
    (www / "assets" / "notice-tv-1.js").write_text('import "./chunk-2.js";', encoding="utf-8")
    (www / "assets" / "chunk-2.js").write_text("export const x = 1;", encoding="utf-8")
    (www / "assets" / "notice-tv-1.css").write_text("body{}", encoding="utf-8")
    (www / "assets" / "index-9.js").write_text("app", encoding="utf-8")
    return www


def test_listener_serves_only_the_tv_page_its_assets_and_the_display_routes(client, settings, tmp_path):
    _on(client)
    _b, token = _board(client)
    www = _www(tmp_path)
    db = Database(settings.db_path)
    svc = disp.DisplayService(lambda: db.connection(mode="read"), settings.data_dir, limiter=disp.RateLimiter())
    r = listener.route(svc, www, "GET", "/b/lobby", {}, "192.0.2.5")
    assert r.status == 200 and b'<base href="../">' in r.body and r.content_type.startswith("text/html")
    assert dict(r.all_headers())["X-Robots-Tag"] == "noindex, nofollow"
    assert listener.route(svc, www, "GET", "/assets/notice-tv-1.js", {}, "c").status == 200
    assert listener.route(svc, www, "GET", "/assets/chunk-2.js", {}, "c").status == 200
    assert listener.route(svc, www, "GET", "/assets/index-9.js", {}, "c").status == 404  # the application's bundle is not served
    assert listener.route(svc, www, "GET", "/api/v1/notices", {}, "c").status == 404
    assert listener.route(svc, www, "GET", "/", {}, "c").status == 404
    assert listener.route(svc, www, "POST", "/api/v1/notices/display/lobby", {}, "c").status == 405
    ok = listener.route(svc, www, "GET", "/api/v1/notices/display/lobby", {"x-board-token": token}, "c")
    assert ok.status == 200 and json.loads(ok.body)["board"]["slug"] == "lobby"


def test_main_app_serves_the_tv_page_with_its_own_headers(settings, tmp_path):
    import dataclasses

    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    c = TestClient(create_app(dataclasses.replace(settings, www_dir=_www(tmp_path))))
    r = c.get("/b/lobby")
    assert r.status_code == 200 and '<base href="../">' in r.text
    assert r.headers["cache-control"] == "no-store" and "frame-ancestors 'self'" in r.headers["content-security-policy"]
    assert c.get("/b/Bad_Slug").status_code == 404


def test_page_helpers(tmp_path):
    www = _www(tmp_path)
    assert page.page_html(www).startswith(b"<!doctype html>")
    assert page.asset(www, "../secrets") is None and page.asset(www, "index-9.js") is None


def test_the_add_on_option_is_declared_off_and_unmapped():
    import pathlib

    import yaml

    from smplwise.services import self_update

    cfg = yaml.safe_load((pathlib.Path(__file__).resolve().parents[3] / "smplwise_vms" / "config.yaml").read_text(encoding="utf-8"))
    assert cfg["options"]["notice_boards"] is False and cfg["schema"]["notice_boards"] == "bool?"
    assert cfg["ports"]["18094/tcp"] is None
    assert self_update.OPTION_TYPES["notice_boards"] == "bool?"


# ---------------------------------------------------------------- weather, news, sun


def test_weather_block_from_the_weather_entity(client, settings):
    _on(client)
    db = Database(settings.db_path)
    future = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=2)).isoformat()
    with db.connection() as conn:
        conn.execute("""INSERT INTO ha_entities(entity_id, domain, name, state, attributes_json, available, first_seen_at, updated_at)
                        VALUES ('weather.home', 'weather', 'Home', 'sunny', ?, 1, '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')""",
                     (json.dumps({"temperature": 24.4, "forecast": [{"datetime": future, "temperature": 26, "condition": "partlycloudy"}]}),))
    client.patch(f"{API}/notices/settings", json={"weather_entity": "weather.home"})
    _b, token = _board(client)
    w = _feed(client, "lobby", token).json()["weather"]
    assert w["now"] == {"t": 24, "condition": "sun", "text": "בהיר"} and w["hours"][0]["t"] == 26 and w["hours"][0]["condition"] == "cloudsun"


def test_news_titles_only_markup_stripped():
    xml = b"""<?xml version="1.0"?><rss><channel><title>feed</title>
      <item><title><![CDATA[<b>\xd7\x9b\xd7\x95\xd7\xaa\xd7\xa8\xd7\xaa</b> &amp; more]]></title><link>https://x</link></item>
      <item><title>second</title></item></channel></rss>"""
    assert sources.parse_feed(xml) == ["כותרת & more", "second"]
    cache = sources.NewsCache(fetch=lambda url: xml, background=False)
    out = sources.news_block([{"name": "ynet", "url": "https://a"}, {"name": "גלובס", "url": "https://b"}], cache)
    assert out[:2] == [{"source": "ynet", "title": "כותרת & more"}, {"source": "גלובס", "title": "כותרת & more"}]


def test_news_failure_keeps_the_last_titles():
    calls = []

    def fetch(url):
        calls.append(url)
        if len(calls) > 1:
            raise OSError("down")
        return b"<rss><channel><item><title>a</title></item></channel></rss>"

    clock = [0.0]
    cache = sources.NewsCache(fetch=fetch, clock=lambda: clock[0], background=False)
    assert cache.titles("https://a") == ["a"]
    clock[0] = sources.NEWS_TTL_S + 1
    assert cache.titles("https://a") == ["a"] and len(calls) == 2


def test_sun_times_tel_aviv():
    rise, sset = sources.sun_times(dt.date(2026, 10, 23), 32.08, 34.78)
    il = dt.timezone(dt.timedelta(hours=3))
    assert 6 <= rise.astimezone(il).hour <= 7 and 17 <= sset.astimezone(il).hour <= 18


# ---------------------------------------------------------------- retention, permissions catalogue


def test_retention_sweep(client, settings):
    _on(client)
    n = _notice(client)
    client.post(f"{API}/notices/{n['id']}/archive")
    db = Database(settings.db_path)
    with db.connection() as conn:
        assert store.retention_sweep(conn, dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=366)) == 1
        assert store.retention_sweep(conn, dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=400)) == 0
        assert conn.execute("SELECT COUNT(*) FROM notices").fetchone()[0] == 0


def test_permissions_are_labelled_and_in_the_built_in_roles():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import DEFAULT_DELEGABLE, PERMISSION_LABELS

    for p in ("notices.view", "notices.manage", "notices.push", "notices.boards"):
        assert p in PERMISSION_LABELS
    # readers need no role permission (any live binding reads its audience); the base roles stay unchanged so delegation ceilings do not move
    for role in ("viewer", "kiosk", "operator", "editor"):
        assert not any(p.startswith("notices.") for p in ROLES[role]), role
    assert ROLES["notices_manage"] == ["notices.view", "notices.manage"] and "notices.manage" in ROLES["site_admin"]
    assert "notices.boards" in ROLES["system_admin"] and "notices.boards" not in ROLES["site_admin"]
    assert {"notices_manage", "notices_push", "notices_boards"} <= set(DEFAULT_DELEGABLE)


@pytest.mark.parametrize("slug", ["lobby", "a", "parking-2"])
def test_slug_shapes(slug):
    assert model.clean_slug(slug) == slug


# ---------------------------------------------------------------- NOTICESAVER-295: the screen saver and the logo layout

def test_saver_and_logo_layout_defaults_and_old_boards():
    d = model.normalize_display({})
    assert (d["saver"], d["logos"]) == ("wash", "a")
    old = model.load_display('{"template": 2, "burn_in": {"shift": false}}')  # a board stored before 2.17.1
    assert (old["saver"], old["logos"], old["template"], old["burn_in"]["shift"]) == ("wash", "a", 2, False)
    assert model.normalize_display({"saver": "disco", "logos": "z"})["saver"] == "wash"  # lenient on load: the default replaces the unknown value
    assert model.normalize_display({"saver": "disco", "logos": "z"})["logos"] == "a"


def test_saver_and_logo_layout_are_validated_and_stored(client):
    _on(client)
    b, token = _board(client)
    for bad in ({"saver": "disco"}, {"saver": 3}, {"logos": "d"}, {"logos": ["a"]}):
        assert client.patch(f"{API}/notices/boards/{b['id']}", json={"display": bad}).status_code == 422, bad
    for sv in model.SAVERS:
        r = client.patch(f"{API}/notices/boards/{b['id']}", json={"display": {"saver": sv, "logos": "c"}})
        assert r.status_code == 200
        assert (r.json()["board"]["display"]["saver"], r.json()["board"]["display"]["logos"]) == (sv, "c")
    feed = _feed(client, "lobby", token).json()["board"]["display"]
    assert (feed["saver"], feed["logos"]) == ("ambient", "c")  # the TV feed carries the stored choice (the last value of the loop)
    # the preview takes a draft without saving it
    r = client.post(f"{API}/notices/boards/{b['id']}/preview", json={"display": {"saver": "wash", "logos": "b"}})
    assert r.status_code == 200 and (r.json()["board"]["display"]["saver"], r.json()["board"]["display"]["logos"]) == ("wash", "b")
    assert client.get(f"{API}/notices/boards/{b['id']}").json()["board"]["display"]["saver"] == "ambient"


def test_saver_and_logo_layout_defaults_and_validation(client):
    """NOTICESAVER-295: `saver` and `logos` live in the display JSON; old boards read the defaults, bad values are refused."""
    assert model.DISPLAY_DEFAULTS["saver"] == "wash" and model.DISPLAY_DEFAULTS["logos"] == "a"
    old = model.normalize_display({"template": 2})
    assert (old["saver"], old["logos"]) == ("wash", "a")
    assert model.normalize_display({"saver": "bogus", "logos": "z"})["saver"] == "wash"
    for s in model.SAVERS:
        assert model.normalize_display({"saver": s})["saver"] == s
    _on(client)
    b, _ = _board(client)
    for bad in ({"saver": "disco"}, {"logos": "d"}, {"saver": 3}):
        assert client.patch(f"{API}/notices/boards/{b['id']}", json={"display": bad}).status_code == 422, bad
    d = client.patch(f"{API}/notices/boards/{b['id']}", json={"display": {"saver": "wash", "logos": "c"}}).json()["board"]["display"]
    assert (d["saver"], d["logos"]) == ("wash", "c")
