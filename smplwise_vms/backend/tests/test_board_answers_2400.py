"""BOARD-ANSWERS-2400 (owner answers 04.11, round 18):

* Q13 = B - a board saved before NOTICEPERM-295 holds only the hash of its link token. When its TV next reads the feed with a token that
  verifies against that hash, the server keeps the sealed copy of THAT token (the NOTICEPERM-295 sealing), so "העתק קישור" works
  afterwards without replacing the link or disconnecting the TV. Security points, one test each: only a verified token is stored; an
  existing copy is never replaced; a token rotated away in between is not stored; one write and one audit row
  (`notices.board.link_captured`, no value); no token in logs or audit; shape / size / retry limits; disabled board / module off /
  deleted board store nothing; the LAN listener is wired the same way.
* Q16 = A - the parking / gym rules stay, plus "הפוך" per picked on / off entity (stored next to the sources, admin only, audited).
Fakes only: no lab, no network; mirror rows go straight into `ha_entities`.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from conftest import as_user, bind
from smplwise.db import Database, set_setting
from smplwise.services import connection_store as cstore
from smplwise.services.notices import display as disp
from smplwise.services.notices import info, model, store

API = "/api/v1"
ROOT = Path(__file__).resolve().parents[3]
T = "2026-11-04T00:00:00Z"


def _on(client) -> None:
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _legacy_board(client, settings, slug: str = "lobby") -> tuple[str, str]:
    """A board as it looks when saved before migration 0173: the hash of its token only."""
    made = client.post(f"{API}/notices/boards", json={"name": "לובי", "slug": slug}).json()
    with Database(settings.db_path).connection() as c:
        c.execute("UPDATE notice_boards SET token_sealed = NULL WHERE id = ?", (made["board"]["id"],))
    return made["board"]["id"], made["token"]


def _row(settings, bid: str) -> dict:
    with Database(settings.db_path).connection() as c:
        return dict(c.execute("SELECT token_hash, token_generation, token_rotated_at, token_sealed, updated_at FROM notice_boards WHERE id = ?", (bid,)).fetchone())


def _audit(settings, action: str) -> list[dict]:
    with Database(settings.db_path).connection() as c:
        return [dict(r) for r in c.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def _tv(client, slug: str, token: str):
    return client.get(f"{API}/notices/display/{slug}", headers={"X-Board-Token": token})


# ---------------------------------------------------------------- Q13: the copy is kept when the TV connects


def test_the_tv_connecting_keeps_the_copy_and_copy_then_works_without_replacing(client, settings):
    _on(client)
    bid, token = _legacy_board(client, settings)
    before = _row(settings, bid)
    assert client.get(f"{API}/notices/boards/{bid}").json()["board"]["has_stored_link"] is False
    miss = client.get(f"{API}/notices/boards/{bid}/link")
    assert miss.status_code == 409 and miss.json()["code"] == "no_stored_link"
    assert "בפעם הבאה שהטלוויזיה מתחברת" in miss.json()["user_message"]

    assert _tv(client, "lobby", token).status_code == 200  # the TV reads its feed
    after = _row(settings, bid)
    assert after["token_sealed"] and after["token_sealed"].startswith("v1:") and token not in after["token_sealed"]
    assert {k: after[k] for k in ("token_hash", "token_generation", "token_rotated_at")} == {k: before[k] for k in ("token_hash", "token_generation", "token_rotated_at")}, \
        "the link itself is untouched: no rotation, the TV stays connected"
    assert cstore.open_notice_board_token(settings.data_dir, bid, after["token_sealed"]) == token
    assert client.get(f"{API}/notices/boards/{bid}").json()["board"]["has_stored_link"] is True
    r = client.get(f"{API}/notices/boards/{bid}/link")
    assert r.status_code == 200 and r.json()["token"] == token, "the SAME link is copied"
    assert _tv(client, "lobby", token).status_code == 200, "the TV keeps working after the copy"
    assert _audit(settings, "notices.board.rotate") == [] and _audit(settings, "notices.board.issue_link") == []


def test_one_capture_one_audit_row_without_the_value(client, settings):
    _on(client)
    bid, token = _legacy_board(client, settings)
    for _ in range(4):
        assert _tv(client, "lobby", token).status_code == 200
    rows = _audit(settings, "notices.board.link_captured")
    assert len(rows) == 1, "the copy is written once; later reads find it and write nothing"
    row = rows[0]
    assert row["resource_type"] == "notice_board" and row["resource_id"] == bid and row["decision"] == "allowed"
    assert row["actor_user_id"] is None, "a TV is not a user: the row is the system's"
    blob = json.dumps(row, ensure_ascii=False)
    assert token not in blob and token[:12] not in blob and _row(settings, bid)["token_sealed"] not in blob
    assert json.loads(row["details_json"]) == {"source": "tv_feed"}


def test_a_wrong_token_stores_nothing(client, settings):
    _on(client)
    bid, token = _legacy_board(client, settings)
    other = store.new_token()
    assert _tv(client, "lobby", other).status_code == 404
    assert _tv(client, "lobby", token[:-1] + ("A" if token[-1] != "A" else "B")).status_code == 404
    assert _row(settings, bid)["token_sealed"] is None and _audit(settings, "notices.board.link_captured") == []


def test_a_token_of_another_board_stores_nothing(client, settings):
    _on(client)
    a, _ = _legacy_board(client, settings, "a-board")
    _, tok_b = _legacy_board(client, settings, "b-board")
    assert _tv(client, "a-board", tok_b).status_code == 404
    assert _row(settings, a)["token_sealed"] is None


def test_an_existing_copy_is_never_replaced(client, settings):
    _on(client)
    made = client.post(f"{API}/notices/boards", json={"name": "לובי", "slug": "lobby"}).json()
    bid, token = made["board"]["id"], made["token"]
    sealed = _row(settings, bid)["token_sealed"]
    assert _tv(client, "lobby", token).status_code == 200
    assert _row(settings, bid)["token_sealed"] == sealed and _audit(settings, "notices.board.link_captured") == []
    # a copy that does not open (moved from another board) is not "repaired" by a TV either: the administrator replaces the link
    other = client.post(f"{API}/notices/boards", json={"name": "חניון", "slug": "parking"}).json()
    with Database(settings.db_path).connection() as c:
        c.execute("UPDATE notice_boards SET token_sealed = ? WHERE id = ?", (sealed, other["board"]["id"]))
    assert _tv(client, "parking", other["token"]).status_code == 200
    assert _row(settings, other["board"]["id"])["token_sealed"] == sealed


def test_a_token_rotated_away_in_between_is_not_stored(client, settings):
    _on(client)
    bid, old = _legacy_board(client, settings)
    db = Database(settings.db_path)
    with db.connection() as c:  # the administrator replaces the link after the TV's read, before the capture write
        store.rotate_token(c, bid, "admin")
    disp.capture_link(db, settings.data_dir)(bid, old)
    assert _row(settings, bid)["token_sealed"] is None and _audit(settings, "notices.board.link_captured") == []


def test_a_disabled_board_or_the_module_off_stores_nothing(client, settings):
    _on(client)
    bid, token = _legacy_board(client, settings)
    assert client.patch(f"{API}/notices/boards/{bid}", json={"enabled": False}).status_code == 200
    assert _tv(client, "lobby", token).status_code == 404
    assert _row(settings, bid)["token_sealed"] is None
    assert client.patch(f"{API}/notices/boards/{bid}", json={"enabled": True}).status_code == 200
    assert client.patch(f"{API}/notices/settings", json={"enabled": False}).status_code == 200
    assert _tv(client, "lobby", token).status_code == 404
    assert _row(settings, bid)["token_sealed"] is None and _audit(settings, "notices.board.link_captured") == []


def test_a_deleted_board_stores_nothing(client, settings):
    _on(client)
    bid, token = _legacy_board(client, settings)
    db = Database(settings.db_path)
    with db.connection() as c:
        c.execute("UPDATE notice_boards SET deleted_at = ? WHERE id = ?", (T, bid))  # deleted, hash kept on purpose: the guard is the row's state
    disp.capture_link(db, settings.data_dir)(bid, token)
    assert _row(settings, bid)["token_sealed"] is None


def test_shape_size_and_retry_limits(client, settings, monkeypatch):
    _on(client)
    bid, token = _legacy_board(client, settings)
    db = Database(settings.db_path)
    calls: list[str] = []
    real = cstore.seal_notice_board_token
    monkeypatch.setattr(cstore, "seal_notice_board_token", lambda d, b, t: (calls.append(b), real(d, b, t))[1])
    clock = [1000.0]
    run = disp.capture_link(db, settings.data_dir, clock=lambda: clock[0])
    for bad in ("", "short", "x" * 129, "bad token with spaces", token + "/"):
        run(bid, bad)
    assert calls == [], "a token outside the feed's shape (20..128 URL-safe characters) is never even sealed"
    with db.connection() as c:  # make the write fail its guard (another token is in force), then retry
        c.execute("UPDATE notice_boards SET token_hash = ? WHERE id = ?", (store.token_hash("y" * 43), bid))
    run(bid, token)
    run(bid, token)
    assert calls == [bid], "at most one attempt per board a minute"
    clock[0] += disp.CAPTURE_RETRY_S + 1
    with db.connection() as c:
        c.execute("UPDATE notice_boards SET token_hash = ? WHERE id = ?", (store.token_hash(token), bid))
    run(bid, token)
    assert calls == [bid, bid] and _row(settings, bid)["token_sealed"]
    assert len(_row(settings, bid)["token_sealed"]) < 300, "one bounded sealed value per board, nothing that grows"


def test_a_failing_capture_never_breaks_the_feed_and_never_logs_the_token(client, settings, monkeypatch, caplog):
    _on(client)
    bid, token = _legacy_board(client, settings)

    def boom(d, b, t):
        raise cstore.SecretError(f"key unreadable for {t}")  # even an exception that carried it never reaches a log

    monkeypatch.setattr(cstore, "seal_notice_board_token", boom)
    with caplog.at_level(logging.DEBUG):
        r = _tv(client, "lobby", token)
    assert r.status_code == 200 and token not in r.text
    assert token not in caplog.text
    assert _row(settings, bid)["token_sealed"] is None and _audit(settings, "notices.board.link_captured") == []


def test_a_successful_capture_logs_nothing_with_the_token(client, settings, caplog):
    _on(client)
    _, token = _legacy_board(client, settings)
    with caplog.at_level(logging.DEBUG):
        assert _tv(client, "lobby", token).status_code == 200
    assert token not in caplog.text


def test_the_lan_listener_and_the_app_route_both_capture():
    main = (ROOT / "smplwise_vms/backend/smplwise/main.py").read_text(encoding="utf-8")
    router = (ROOT / "smplwise_vms/backend/smplwise/routers/notices.py").read_text(encoding="utf-8")
    assert "capture=notice_display.capture_link(app.state.db, settings.data_dir)" in main
    assert "capture=disp.capture_link(db, settings_of(request).data_dir)" in router


def test_the_capture_runs_only_after_the_token_check():
    src = (ROOT / "smplwise_vms/backend/smplwise/services/notices/display.py").read_text(encoding="utf-8")
    feed = src[src.index("    def feed(self, req: Request) -> Reply:"):src.index("    def image(self")]
    assert feed.index("self.resolve(conn, req)") < feed.index("if refusal is not None:\n                return refusal") < feed.index("self.capture(")
    body = src[src.index("def capture_link"):src.index("def preview_feed")]
    assert not any(w in body for w in ("logger", "logging", "_log.", "LOG.", "print(", "warn(")), "the capture never logs"


# ---------------------------------------------------------------- Q16: "הפוך" per picked on / off entity


def _entity(conn, entity_id, state, *, device_class=None):
    conn.execute("""INSERT INTO ha_entities(entity_id, domain, name, device_class, state, attributes_json, available, disabled, removed_at, first_seen_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, '{}', 1, 0, NULL, ?, ?)""", (entity_id, entity_id.split(".")[0], entity_id, device_class, state, T, T))


@pytest.fixture()
def conn(client, settings):
    with Database(settings.db_path).connection() as c:
        yield c


def _pick(conn, kind, ids, inverted=()):
    set_setting(conn, f"notices.info.{kind}_entities", json.dumps(ids))
    set_setting(conn, f"notices.info.{kind}_inverted", json.dumps(list(inverted)))


@pytest.mark.parametrize("ents,inverted,state,text", [
    # on = taken by default; inverted: on = free
    ([("binary_sensor.spot_1", "on", "occupancy")], ["binary_sensor.spot_1"], "ok", "מקום אחד פנוי"),
    ([("binary_sensor.spot_1", "off", "occupancy")], ["binary_sensor.spot_1"], "warn", "מלאה"),
    ([("binary_sensor.spot_1", "on", "occupancy"), ("binary_sensor.spot_2", "on", None)], ["binary_sensor.spot_2"], "ok", "מקום אחד פנוי"),
    ([("switch.spot_3", "on", None), ("sensor.lot", "4", None)], ["switch.spot_3"], "ok", "5 פנויות"),  # a number is never inverted
    ([("input_boolean.spot_4", "unknown", None)], ["input_boolean.spot_4"], "off", "לא זמין"),  # unknown stays unknown
])
def test_parking_invert(conn, ents, inverted, state, text):
    for eid, st, dc in ents:
        _entity(conn, eid, st, device_class=dc)
    _pick(conn, "parking", [e[0] for e in ents], inverted)
    assert info.build(conn, ["parking"], "he", connected=True) == [{"kind": "parking", "label": "חניה", "state": state, "text": text}]


@pytest.mark.parametrize("ents,inverted,state,text", [
    ([("input_boolean.gym_closed", "on", None)], ["input_boolean.gym_closed"], "off", "סגור"),
    ([("input_boolean.gym_closed", "off", None)], ["input_boolean.gym_closed"], "ok", "פתוח"),
    ([("binary_sensor.gym_vacant", "on", "occupancy")], ["binary_sensor.gym_vacant"], "ok", "פנוי"),
    ([("binary_sensor.gym_vacant", "off", "occupancy")], ["binary_sensor.gym_vacant"], "ok", "בשימוש"),
    ([("schedule.gym_hours", "on", None)], [], "ok", "פתוח"),  # not inverted: the approved rule as before
])
def test_gym_invert(conn, ents, inverted, state, text):
    for eid, st, dc in ents:
        _entity(conn, eid, st, device_class=dc)
    _pick(conn, "gym", [e[0] for e in ents], inverted)
    assert info.build(conn, ["gym"], "he", connected=True) == [{"kind": "gym", "label": "חדר כושר", "state": state, "text": text}]


def test_an_inverted_flag_of_a_source_no_longer_picked_is_ignored(conn):
    _entity(conn, "binary_sensor.spot_1", "on", device_class="occupancy")
    _pick(conn, "parking", ["binary_sensor.spot_1"], ["binary_sensor.spot_9", "sensor.lot", "nonsense"])
    assert info.build(conn, ["parking"], "he", connected=True)[0]["text"] == "מלאה"
    assert model.info_inverted_of("parking", "not json", ["binary_sensor.spot_1"]) == []
    assert model.info_inverted_of("parking", '{"a": 1}', ["binary_sensor.spot_1"]) == []


def test_invert_is_saved_with_the_source_and_audited(client, settings):
    r = client.patch(f"{API}/notices/settings", json={"parking_entities": ["binary_sensor.spot_1", "sensor.lot"], "parking_inverted": ["binary_sensor.spot_1"]})
    assert r.status_code == 200, r.text
    s = r.json()["settings"]
    assert s["parking_entities"] == ["binary_sensor.spot_1", "sensor.lot"] and s["parking_inverted"] == ["binary_sensor.spot_1"] and s["gym_inverted"] == []
    rows = _audit(settings, "notices.settings.update")
    assert json.loads(rows[-1]["details_json"])["keys"] == ["notices.info.parking_entities", "notices.info.parking_inverted"]
    assert client.get(f"{API}/notices/settings").json()["settings"]["parking_inverted"] == ["binary_sensor.spot_1"]
    # the flag alone
    r = client.patch(f"{API}/notices/settings", json={"parking_inverted": []})
    assert r.status_code == 200 and r.json()["settings"]["parking_inverted"] == []
    assert json.loads(_audit(settings, "notices.settings.update")[-1]["details_json"])["keys"] == ["notices.info.parking_inverted"]


def test_removing_a_source_drops_its_invert_flag(client, settings):
    assert client.patch(f"{API}/notices/settings", json={"gym_entities": ["input_boolean.gym_a", "switch.gym_b"],
                                                          "gym_inverted": ["input_boolean.gym_a", "switch.gym_b"]}).status_code == 200
    s = client.patch(f"{API}/notices/settings", json={"gym_entities": ["switch.gym_b"]}).json()["settings"]
    assert s["gym_entities"] == ["switch.gym_b"] and s["gym_inverted"] == ["switch.gym_b"]
    with Database(settings.db_path).connection() as c:
        assert json.loads(c.execute("SELECT value FROM settings WHERE key = 'notices.info.gym_inverted'").fetchone()[0]) == ["switch.gym_b"]
    # adding a source back does not bring an old flag back
    s = client.patch(f"{API}/notices/settings", json={"gym_entities": ["switch.gym_b", "input_boolean.gym_a"]}).json()["settings"]
    assert s["gym_inverted"] == ["switch.gym_b"]


@pytest.mark.parametrize("bad", [
    {"parking_entities": ["sensor.lot"], "parking_inverted": ["sensor.lot"]},  # a number cannot be inverted
    {"parking_entities": ["input_select.lot"], "parking_inverted": ["input_select.lot"]},  # nor a list
    {"parking_inverted": ["binary_sensor.not_picked"]},  # only a picked source
    {"parking_entities": ["binary_sensor.a"], "parking_inverted": ["binary_sensor.b"]},
    {"gym_inverted": "switch.gym"},
    {"gym_entities": ["switch.g0"], "gym_inverted": [f"switch.g{i}" for i in range(9)]},
    {"parking_entities": ["light.lot"], "parking_inverted": ["light.lot"]},
])
def test_bad_invert_is_refused(client, bad):
    r = client.patch(f"{API}/notices/settings", json=bad)
    assert r.status_code == 422, r.text
    s = client.get(f"{API}/notices/settings").json()["settings"]
    assert s["parking_inverted"] == [] and s["gym_inverted"] == [] and s["parking_entities"] == [] and s["gym_entities"] == []


def test_invert_needs_a_system_administrator(client, settings):
    assert client.patch(f"{API}/notices/settings", json={"parking_entities": ["binary_sensor.spot_1"]}).status_code == 200
    for role in ("notices_boards", "notices_manage", "editor", "site_admin"):
        user = f"u-{role}"
        bind(client, settings, user, role, "installation", "*")
        r = client.patch(f"{API}/notices/settings", json={"parking_inverted": ["binary_sensor.spot_1"]}, headers=as_user(user))
        assert r.status_code == 403, (role, r.status_code)
    assert client.get(f"{API}/notices/settings").json()["settings"]["parking_inverted"] == []


def test_invert_reads_only_and_never_writes_the_mirror(conn):
    _entity(conn, "binary_sensor.spot_1", "on", device_class="occupancy")
    _pick(conn, "parking", ["binary_sensor.spot_1"], ["binary_sensor.spot_1"])
    before = [tuple(r) for r in conn.execute("SELECT * FROM ha_entities ORDER BY entity_id").fetchall()]
    info.build(conn, ["parking"], "he", connected=True)
    assert [tuple(r) for r in conn.execute("SELECT * FROM ha_entities ORDER BY entity_id").fetchall()] == before
