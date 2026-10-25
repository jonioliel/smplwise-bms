"""NOTICERSS-295: the editable list of news (RSS) sources of the notice boards - the curated seed, validation, the logo pipeline, the
back-compat of boards that stored a raw URL, the feed fields (`source`, `logo`), the token route of the logos, the LAN listener and
the permission. Fakes only: no network."""
from __future__ import annotations

import datetime as dt
import io

import pytest
from PIL import Image

from conftest import as_user, bind
from smplwise.db import Database
from smplwise.services.notices import display as disp
from smplwise.services.notices import listener, model, news_sources, sources, store

API = "/api/v1"
RSS = b"<rss><channel><item><title>headline</title></item></channel></rss>"
YNET = "https://www.ynet.co.il/Integration/StoryRss2.xml"


def _on(client, **extra) -> None:
    assert client.patch(f"{API}/notices/settings", json={"enabled": True, **extra}).status_code == 200


def _png(w=600, h=300, color=(200, 60, 40), alpha=False) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA" if alpha else "RGB", (w, h), color + ((255,) if alpha else ())).save(buf, format="PNG")
    return buf.getvalue()


def _put(client, rows):
    return client.put(f"{API}/notices/news-sources", json={"sources": rows})


def _logo(client, sid, data, name="l.png", mime="image/png"):
    return client.put(f"{API}/notices/news-sources/{sid}/logo", files={"file": (name, data, mime)})


def _board(client, slug="lobby", feeds=(), **blocks):
    r = client.post(f"{API}/notices/boards", json={"name": "לוח " + slug, "slug": slug,
                                                   "display": {"blocks": {"news": True, **blocks}, "news": {"feeds": list(feeds)}}})
    assert r.status_code == 200, r.text
    return r.json()["board"]["id"], r.json()["token"]


def _cache():
    return sources.NewsCache(fetch=lambda url: RSS, background=False)


def _built(settings, slug="lobby", **kw):
    db = Database(settings.db_path)
    with db.connection() as conn:
        return disp.build_feed(conn, store.board_by_slug(conn, slug), dt.datetime.now(dt.timezone.utc), news=_cache(), **kw)


# ---------------------------------------------------------------- the seed and the back-compat

def test_the_curated_list_is_the_seed_until_the_first_save(client, settings):
    _on(client)
    got = client.get(f"{API}/notices/news-sources").json()
    assert [s["id"] for s in got["sources"]] == [f["id"] for f in model.CURATED_NEWS]
    assert all(s["enabled"] and not s["has_logo"] and not s["custom"] for s in got["sources"])
    assert got["max"] == 12 and got["name_max"] == 40
    assert client.get(f"{API}/notices/settings").json()["settings"]["news_sources"] == got["sources"]
    db = Database(settings.db_path)
    with db.connection() as conn:
        assert conn.execute("SELECT 1 FROM settings WHERE key = 'notices.news_sources'").fetchone() is None  # a read writes nothing


def test_a_saved_list_wins_even_when_empty_and_keeps_the_order(client):
    _on(client)
    rows = [{"id": "walla", "name": "וואלה", "url": "https://rss.walla.co.il/feed/1"}, {"name": "שלי", "url": "https://feeds.example.com/rss"}]
    got = _put(client, rows).json()["sources"]
    assert [s["name"] for s in got] == ["וואלה", "שלי"] and got[0]["id"] == "walla" and got[1]["id"].startswith("s")
    assert _put(client, []).json()["sources"] == []
    assert client.get(f"{API}/notices/news-sources").json()["sources"] == []


def test_a_board_raw_url_is_listed_as_custom_and_adopted_with_its_name_never_lost(client, settings):
    _on(client, news_custom=True)
    bid, _ = _board(client, feeds=[{"name": "www.ynet.co.il/Integration/Stor", "url": YNET}, {"name": "mine", "url": "https://feeds.example.com/rss"}])
    lst = client.get(f"{API}/notices/news-sources").json()["sources"]
    custom = [s for s in lst if s["custom"]]
    assert [s["url"] for s in custom] == ["https://feeds.example.com/rss"]  # the ynet URL is not a curated one? it IS (seeded) -> matched
    # ... and the curated ynet is matched by URL, so only the really unknown URL is a custom entry
    assert custom[0]["name"] == "mine" and custom[0]["id"] == news_sources.custom_id("https://feeds.example.com/rss")
    # the board still stores the URL, whatever the list does
    stored = client.get(f"{API}/notices/boards/{bid}").json()["board"]["display"]["news"]["feeds"]
    assert {f["url"] for f in stored} == {YNET, "https://feeds.example.com/rss"}
    # the manager renames it and saves the list: it is adopted
    rows = [{k: s[k] for k in ("id", "name", "url", "enabled")} for s in lst]
    rows[-1]["name"] = "המקור שלי"
    after = _put(client, rows).json()["sources"]
    assert not any(s["custom"] for s in after) and after[-1]["name"] == "המקור שלי"
    doc = _built(settings)
    assert {x["source"] for x in doc["news"]} == {"ynet", "המקור שלי"}  # the list's name wins over the board's stored one


def test_the_domain_name_of_a_hand_added_feed_is_replaced_by_the_list_name(client, settings):
    _on(client, news_custom=True)
    _board(client, feeds=[{"name": "www.ynet.co.il", "url": YNET}])
    assert {x["source"] for x in _built(settings)["news"]} == {"ynet"}  # matched by URL to the seeded entry
    _put(client, [{"id": "ynet", "name": "ynet חדשות", "url": YNET}])
    assert {x["source"] for x in _built(settings)["news"]} == {"ynet חדשות"}


# ---------------------------------------------------------------- validation

@pytest.mark.parametrize("row", [
    {"name": "x", "url": "http://feeds.example.com/rss"},          # not https
    {"name": "x", "url": "https://user:pw@feeds.example.com/rss"},  # credentials
    {"name": "x", "url": "https://feeds.example.com:8443/rss"},     # port
    {"name": "x", "url": "https://127.0.0.1/rss"},                  # loopback literal
    {"name": "x", "url": "https://10.0.0.5/rss"},                   # private literal
    {"name": "x", "url": "https://localhost/rss"},                  # local name
    {"name": "x", "url": "https://feeds.example.com/r ss"},         # whitespace
    {"name": "x", "url": "https://feeds.example.com/" + "a" * 400}, # too long
    {"name": "", "url": "https://feeds.example.com/rss"},           # a name is required
    {"name": "   ", "url": "https://feeds.example.com/rss"},
    {"name": "x" * 41, "url": "https://feeds.example.com/rss"},     # 40 at most
    {"name": "a\x07b", "url": "https://feeds.example.com/rss"},     # control character
    {"name": "x", "url": "https://feeds.example.com/rss", "id": "Bad Id"},
    {"name": "x", "url": "https://feeds.example.com/rss", "enabled": "yes"},
])
def test_a_bad_source_is_refused_and_nothing_is_stored(client, settings, row):
    _on(client)
    r = _put(client, [row])
    assert r.status_code == 422, r.text
    db = Database(settings.db_path)
    with db.connection() as conn:
        assert conn.execute("SELECT 1 FROM settings WHERE key = 'notices.news_sources'").fetchone() is None


def test_the_count_duplicates_and_the_name_limit(client):
    _on(client)
    ok = [{"name": f"n{i}", "url": f"https://feeds.example.com/{i}"} for i in range(12)]
    assert _put(client, ok).status_code == 200
    assert _put(client, ok + [{"name": "more", "url": "https://feeds.example.com/x"}]).status_code == 422
    assert _put(client, [ok[0], {**ok[1], "url": ok[0]["url"]}]).status_code == 422  # one URL twice
    assert _put(client, [{**ok[0], "id": "dup"}, {**ok[1], "id": "dup"}]).status_code == 422
    assert _put(client, [{"name": "x" * 40, "url": "https://feeds.example.com/ok"}]).status_code == 200


# ---------------------------------------------------------------- logos

def test_a_logo_is_sanitised_stored_and_removed_with_its_source(client, settings):
    _on(client)
    _put(client, [{"id": "mine", "name": "שלי", "url": "https://feeds.example.com/rss"}])
    r = _logo(client, "mine", _png(1200, 800, alpha=True))
    assert r.status_code == 200, r.text
    row = r.json()["sources"][0]
    assert row["has_logo"] and row["logo_url"].startswith("api/v1/notices/news-sources/mine/logo?v=")
    got = client.get("/" + row["logo_url"])
    assert got.status_code == 200 and got.headers["content-type"] == "image/png"
    im = Image.open(io.BytesIO(got.content))
    assert max(im.size) == news_sources.LOGO_SIDE  # scaled down
    # a rename keeps the logo; deleting the logo clears it
    assert _put(client, [{"id": "mine", "name": "אחר", "url": "https://feeds.example.com/rss"}]).json()["sources"][0]["has_logo"]
    assert not client.delete(f"{API}/notices/news-sources/mine/logo").json()["sources"][0]["has_logo"]
    assert client.get(f"{API}/notices/news-sources/mine/logo").status_code == 404
    # removing the source removes the bytes
    _logo(client, "mine", _png())
    _put(client, [])
    db = Database(settings.db_path)
    with db.connection() as conn:
        assert conn.execute("SELECT 1 FROM settings WHERE key LIKE 'notices.news_logo.%'").fetchone() is None


@pytest.mark.parametrize("name,data,mime", [
    ("l.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "image/svg+xml"),
    ("l.png", b"<html><script>alert(1)</script></html>", "image/png"),  # claims PNG, is not
    ("l.gif", b"GIF89a" + b"\x00" * 64, "image/gif"),
    ("l.png", b"", "image/png"),
    ("l.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 64, "image/png"),         # corrupt
])
def test_a_hostile_or_wrong_logo_is_refused(client, name, data, mime):
    _on(client)
    _put(client, [{"id": "mine", "name": "שלי", "url": "https://feeds.example.com/rss"}])
    r = _logo(client, "mine", data, name, mime)
    assert r.status_code == 422 and r.json()["code"] == "logo_refused", r.text


def test_a_big_logo_is_refused_and_an_unknown_source_is_404(client):
    _on(client)
    _put(client, [{"id": "mine", "name": "שלי", "url": "https://feeds.example.com/rss"}])
    assert _logo(client, "mine", b"\x89PNG\r\n\x1a\n" + b"0" * news_sources.LOGO_UPLOAD_BYTES).status_code == 422
    assert _logo(client, "nope", _png()).status_code == 404
    assert client.get(f"{API}/notices/news-sources/nope/logo").status_code == 404


def test_a_logo_can_be_set_on_the_seed_before_any_save(client):
    _on(client)
    assert _logo(client, "ynet", _png()).status_code == 200
    rows = client.get(f"{API}/notices/news-sources").json()["sources"]
    assert [s["id"] for s in rows] == [f["id"] for f in model.CURATED_NEWS] and rows[0]["has_logo"]


# ---------------------------------------------------------------- the feed

def test_the_feed_carries_name_and_logo_url_and_the_token_route_serves_the_logo(client, settings):
    _on(client)
    _put(client, [{"id": "mine", "name": "שלי", "url": "https://feeds.example.com/rss"},
                  {"id": "plain", "name": "בלי לוגו", "url": "https://feeds.example.com/two"}])
    _logo(client, "mine", _png())
    _, tok = _board(client, feeds=[{"id": "mine", "name": "x", "url": "https://feeds.example.com/rss"},
                                   {"id": "plain", "name": "y", "url": "https://feeds.example.com/two"}])
    doc = _built(settings, logo_base="")
    by = {x["source"]: x for x in doc["news"]}
    assert set(by) == {"שלי", "בלי לוגו"} and "logo" not in by["בלי לוגו"]
    url = by["שלי"]["logo"]
    assert url.startswith("api/v1/notices/display/lobby/news-logo/mine?v=")
    assert "http" not in url  # never an external address
    h = {"X-Board-Token": tok}
    assert client.get(f"{API}/{url.split('api/v1/', 1)[1]}", headers=h).status_code == 200
    assert client.get(f"{API}/notices/display/lobby/news-logo/mine").status_code == 404           # no token
    assert client.get(f"{API}/notices/display/lobby/news-logo/mine", headers={"X-Board-Token": "z" * 43}).status_code == 404
    assert client.get(f"{API}/notices/display/lobby/news-logo/plain", headers=h).status_code == 404  # a source without a logo
    assert client.get(f"{API}/notices/display/lobby/news-logo/..%2fx", headers=h).status_code == 404
    # the version moves when only the logo changes
    v1 = doc["board"]["version"]
    _logo(client, "mine", _png(color=(1, 2, 3)))
    assert _built(settings)["board"]["version"] != v1


def test_a_disabled_source_is_not_fetched_and_the_custom_gate_still_holds(client, settings):
    _on(client)
    _put(client, [{"id": "a", "name": "A", "url": "https://feeds.example.com/a"}, {"id": "b", "name": "B", "url": "https://feeds.example.com/b", "enabled": False}])
    _board(client, feeds=[{"id": "a", "name": "A", "url": "https://feeds.example.com/a"}, {"id": "b", "name": "B", "url": "https://feeds.example.com/b"},
                          {"name": "raw", "url": "https://feeds.example.com/raw"}])
    assert {x["source"] for x in _built(settings)["news"]} == {"A"}  # b disabled, raw not allowed while news_custom is off
    client.patch(f"{API}/notices/settings", json={"news_custom": True})
    assert {x["source"] for x in _built(settings)["news"]} == {"A", "raw"}


def test_a_board_may_pick_a_listed_source_with_custom_off_and_not_an_unlisted_one(client):
    _on(client)
    _put(client, [{"id": "a", "name": "A", "url": "https://feeds.example.com/a"}])
    bid, _ = _board(client)
    ok = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"news": {"feeds": [{"id": "a", "name": "A", "url": "https://feeds.example.com/a"}]}}})
    assert ok.status_code == 200 and ok.json()["board"]["display"]["news"]["feeds"][0]["id"] == "a"
    bad = client.patch(f"{API}/notices/boards/{bid}", json={"display": {"news": {"feeds": [{"name": "z", "url": "https://feeds.example.com/z"}]}}})
    assert bad.status_code == 422


def test_the_listener_routes_the_news_logo(client, settings):
    _on(client)
    _put(client, [{"id": "mine", "name": "שלי", "url": "https://feeds.example.com/rss"}])
    _logo(client, "mine", _png(alpha=True))
    _, tok = _board(client, "a")
    db = Database(settings.db_path)
    svc = disp.DisplayService(lambda: db.connection(mode="read"), settings.data_dir, limiter=disp.RateLimiter())
    h = {"x-board-token": tok}
    r = listener.route(svc, settings.www_dir, "GET", "/api/v1/notices/display/a/news-logo/mine?v=1", h, "1.1.1.1")
    assert r.status == 200 and r.content_type == "image/png"
    assert listener.route(svc, settings.www_dir, "GET", "/api/v1/notices/display/a/news-logo/mine", {}, "1.1.1.2").status == 404
    assert listener.route(svc, settings.www_dir, "GET", "/api/v1/notices/display/a/news-logo/mine/x", h, "1.1.1.1").status == 404


# ---------------------------------------------------------------- permission and audit

def test_the_routes_need_the_settings_permission_and_every_change_is_audited(client, settings):
    _on(client)
    bind(client, settings, "dana", "viewer", "installation", "*")
    h = as_user("dana")
    png = {"file": ("a.png", _png(), "image/png")}
    for method, path, kw in [
        ("get", "/notices/news-sources", {}), ("put", "/notices/news-sources", {"json": {"sources": []}}),
        ("put", "/notices/news-sources/ynet/logo", {"files": png}), ("delete", "/notices/news-sources/ynet/logo", {}),
    ]:
        assert getattr(client, method)(API + path, headers=h, **kw).status_code == 403, (method, path)
    _put(client, [{"id": "mine", "name": "שלי", "url": "https://feeds.example.com/rss"}])
    _logo(client, "mine", _png())
    client.delete(f"{API}/notices/news-sources/mine/logo")
    db = Database(settings.db_path)
    with db.connection() as c:
        acts = {r[0] for r in c.execute("SELECT action FROM audit_log WHERE action LIKE 'notices.news_%'").fetchall()}
    assert acts == {"notices.news_sources.update", "notices.news_logo.update", "notices.news_logo.delete"}
