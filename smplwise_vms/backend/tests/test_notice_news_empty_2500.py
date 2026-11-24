"""NOTICE-NEWS-EMPTY-2500: a board with the news block on and no source chosen shows no news on the TV (display.build_feed builds no `news`
block). The situation is now visible and traceable: the board (detail, list, PATCH answer) and the Settings preview carry `news_unset`, and
every display save audits the news source counts before / after and the removed sources by id - never a URL."""
from __future__ import annotations

import json

from smplwise.services.notices import model

API = "/api/v1"
FEEDS = {f["id"]: {"id": f["id"], "name": f["name"], "url": f["url"]} for f in model.CURATED_NEWS}
CUSTOM_URL = "https://news.example.org/rss.xml"


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby") -> str:
    r = client.post(f"{API}/notices/boards", json={"name": "כניסה ראשית", "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()["board"]["id"]


def _save(client, bid, display):
    r = client.patch(f"{API}/notices/boards/{bid}", json={"display": display})
    assert r.status_code == 200, r.text
    return r.json()["board"]


def _audit_rows(client):
    with client.app.state.db.connection(mode="read") as conn:
        return [r["details_json"] or "{}" for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'notices.board.update' ORDER BY id").fetchall()]


def test_the_model_flag():
    d = model.default_display()
    assert d["blocks"]["news"] is False and model.news_unset(d) is False  # the factory board: news off
    on = {**d, "blocks": {**d["blocks"], "news": True}}
    assert model.news_unset(on) is True
    assert model.news_unset({**on, "news": {**on["news"], "feeds": [FEEDS["ynet"]]}}) is False
    assert model.news_unset({}) is False  # a broken document never claims it


def test_board_and_preview_carry_news_unset(client):
    _enable(client)
    bid = _board(client)
    assert client.get(f"{API}/notices/boards/{bid}").json()["board"]["news_unset"] is False
    assert client.get(f"{API}/notices/boards/{bid}/preview").json()["news_unset"] is False

    b = _save(client, bid, {"blocks": {"news": True}, "news": {"feeds": []}})  # the lab case: news on, the list emptied
    assert b["news_unset"] is True
    assert client.get(f"{API}/notices/boards/{bid}").json()["board"]["news_unset"] is True
    listed = client.get(f"{API}/notices/boards").json()["boards"]
    assert [x["news_unset"] for x in listed if x["id"] == bid] == [True]
    saved = client.get(f"{API}/notices/boards/{bid}/preview").json()
    assert saved["news_unset"] is True and "news" not in saved  # the TV gets no news block - exactly what the flag says
    # the POST preview follows the draft: a source in the draft clears it, the saved board is unchanged
    assert client.post(f"{API}/notices/boards/{bid}/preview", json={"display": {"news": {"feeds": [FEEDS["ynet"]]}}}).json()["news_unset"] is False
    assert client.post(f"{API}/notices/boards/{bid}/preview", json={}).json()["news_unset"] is True

    b = _save(client, bid, {"news": {"feeds": [FEEDS["ynet"]]}})
    assert b["news_unset"] is False
    b = _save(client, bid, {"blocks": {"news": False}, "news": {"feeds": []}})  # news off with no source is a choice, not a problem
    assert b["news_unset"] is False


def test_the_tv_feed_itself_never_carries_the_flag(client):
    _enable(client)
    r = client.post(f"{API}/notices/boards", json={"name": "לוח", "slug": "tv"})
    tok, bid = r.json()["token"], r.json()["board"]["id"]
    _save(client, bid, {"blocks": {"news": True}, "news": {"feeds": []}})
    feed = client.get(f"{API}/notices/display/tv", headers={"X-Board-Token": tok})
    assert feed.status_code == 200 and "news_unset" not in feed.json()


def test_display_saves_audit_counts_and_removed_ids_never_urls(client):
    _enable(client)
    bid = _board(client)
    _save(client, bid, {"blocks": {"news": True}, "news": {"feeds": [FEEDS["ynet"], FEEDS["globes"]]}})
    _save(client, bid, {"news": {"feeds": [FEEDS["globes"]]}})
    # a feed stored without an id (before the editable list) is named by the list's id for its URL
    no_id = {"name": "וואלה", "url": FEEDS["walla"]["url"]}
    _save(client, bid, {"news": {"feeds": [FEEDS["globes"], no_id]}})
    _save(client, bid, {"news": {"feeds": []}})  # the last sources removed: the board now shows no news
    _save(client, bid, {"place": "לובי"})  # an unrelated display save still records the counts

    rows = [json.loads(r) for r in _audit_rows(client)]
    got = [(r["news_feeds_before"], r["news_feeds_after"], r["news_feeds_removed"], r.get("news_unset", False)) for r in rows]
    assert got == [(0, 2, [], False), (2, 1, ["ynet"], False), (1, 2, [], False), (2, 0, ["globes", "walla"], True), (0, 0, [], True)]
    assert all(r["custom_feeds_added"] == 0 for r in rows)
    assert not any("https" in r or "://" in r for r in _audit_rows(client))  # never the URL in the audit (owner rule)


def test_a_custom_feed_is_recorded_as_custom(client):
    _enable(client)
    assert client.patch(f"{API}/notices/settings", json={"news_custom": True}).status_code == 200
    bid = _board(client)
    _save(client, bid, {"blocks": {"news": True}, "news": {"feeds": [{"name": "example", "url": CUSTOM_URL}, FEEDS["ynet"]]}})
    _save(client, bid, {"news": {"feeds": []}})
    rows = [json.loads(r) for r in _audit_rows(client)]
    assert rows[0]["custom_feeds_added"] == 1 and rows[0]["news_feeds_removed"] == []
    assert rows[1]["news_feeds_removed"] == ["custom", "ynet"] and rows[1]["news_unset"] is True
    assert not any(CUSTOM_URL in r or "example.org" in r for r in _audit_rows(client))


def test_a_name_only_patch_records_no_news_details(client):
    _enable(client)
    bid = _board(client)
    assert client.patch(f"{API}/notices/boards/{bid}", json={"name": "לוח חדש"}).status_code == 200
    rows = [json.loads(r) for r in _audit_rows(client)]
    assert len(rows) == 1 and rows[0]["keys"] == ["name"] and not any(k.startswith("news_") for k in rows[0])
