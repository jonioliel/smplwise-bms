"""TV-CHIPS-2381 (owner answers 03.11):

* Q3 = B - the portrait footer hides chips by priority (`portrait_chips: drop`) by default; the setting still switches between the two
  modes, and only an UNSET value follows the new factory value: a stored installation default `rows` and a board's own `rows` stay. The
  priority order is the board's chip order (`display.blocks.info`), which is now kept as the administrator set it.
* Q4 = A - the parking and gym chips read entities the administrator picks in the notice-board settings (`parking_entities` /
  `gym_entities`); nothing picked = no chip; read-only (rows go straight into the mirror table, nothing is called).
"""
from __future__ import annotations

import json

import pytest

from conftest import as_user, bind
from smplwise.db import Database, get_setting, set_setting
from smplwise.services.notices import info, model, store

API = "/api/v1"
T = "2026-11-03T00:00:00Z"


def _entity(conn, entity_id, state, *, device_class=None, name=None, available=1, removed=False, disabled=0):
    domain = entity_id.split(".")[0]
    conn.execute("""INSERT INTO ha_entities(entity_id, domain, name, device_class, state, attributes_json, available, disabled, removed_at, first_seen_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?)""",
                 (entity_id, domain, name or entity_id, device_class, state, available, disabled, T if removed else None, T, T))


def _sources(conn, kind, ids):
    set_setting(conn, f"notices.info.{kind}_entities", json.dumps(ids))


@pytest.fixture()
def conn(client, settings):
    db = Database(settings.db_path)
    with db.connection() as c:
        yield c


def _enable(client):
    assert client.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200


def _board(client, slug="lobby"):
    r = client.post(f"{API}/notices/boards", json={"name": "לוח", "slug": slug})
    assert r.status_code == 200, r.text
    return r.json()


def _chips_mode(client, slug, token):
    return client.get(f"{API}/notices/display/{slug}", headers={"X-Board-Token": token}).json()["board"]["display"]["portrait_chips"]


# ---------------------------------------------------------------- Q3: drop by default, explicit rows kept

def test_the_factory_chips_mode_is_drop_and_rows_is_still_a_choice():
    assert model.TV2_FACTORY["portrait_chips"] == "drop"
    assert model.SETTINGS_DEFAULTS["notices.tv2.portrait_chips"] == "drop"
    assert model.PORTRAIT_CHIPS == ("rows", "drop")
    assert model.tv2_defaults_doc(lambda k, d: d)["portrait_chips"] == "drop"
    assert model.effective_display(model.normalize_display({}), {})["portrait_chips"] == "drop"


def test_an_unset_installation_follows_drop_and_a_stored_rows_stays_rows(client, settings):
    _enable(client)
    made = _board(client)
    tok = made["token"]
    assert _chips_mode(client, "lobby", tok) == "drop"  # nothing stored anywhere: the new default
    # an installation where an administrator had saved "two rows" (a stored row, as 2.38.0 wrote it after a change from drop)
    db = Database(settings.db_path)
    with db.connection() as c:
        set_setting(c, "notices.tv2.portrait_chips", "rows")
    assert _chips_mode(client, "lobby", tok) == "rows"
    assert client.get(f"{API}/notices/tv-defaults").json()["tv2_defaults"]["portrait_chips"] == "rows"


def test_a_board_that_chose_rows_keeps_rows_and_a_board_that_follows_gets_drop(client):
    _enable(client)
    a, b = _board(client, "lobby"), _board(client, "gym-hall")
    r = client.patch(f"{API}/notices/boards/{a['board']['id']}", json={"display": {"portrait_chips": "rows"}})
    assert r.status_code == 200 and r.json()["board"]["display"]["portrait_chips"] == "rows"
    assert "portrait_chips" not in client.get(f"{API}/notices/boards/{b['board']['id']}").json()["board"]["display"]
    assert _chips_mode(client, "lobby", a["token"]) == "rows"
    assert _chips_mode(client, "gym-hall", b["token"]) == "drop"


def test_a_tv_default_equal_to_the_factory_value_is_pinned_but_not_audited(client, settings):
    _enable(client)
    r = client.put(f"{API}/notices/tv-defaults", json={"portrait_chips": "drop"})
    assert r.status_code == 200 and r.json()["tv2_defaults"]["portrait_chips"] == "drop"
    db = Database(settings.db_path)
    with db.connection(mode="read") as c:
        assert get_setting(c, "notices.tv2.portrait_chips", None) == "drop"  # an explicit choice survives a later factory change
        assert c.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'notices.tv_defaults.update'").fetchone()[0] == 0


def test_write_settings_pins_only_when_asked(conn):
    assert store.write_settings(conn, {"notices.default_days": "7"}) == {}
    assert get_setting(conn, "notices.default_days", None) is None  # the general settings still store only a change
    assert store.write_settings(conn, {"notices.tv2.safe_margin": "0"}, pin=True) == {}
    assert get_setting(conn, "notices.tv2.safe_margin", None) == "0"


def test_the_chip_order_is_kept_as_the_administrator_set_it():
    assert model.default_display()["blocks"]["info"] == ["elevators", "generator", "parking", "gym"]  # the sensible default order
    d = model.normalize_display({"blocks": {"info": ["parking", "elevators", "parking", "gym"]}}, strict=True)
    assert d["blocks"]["info"] == ["parking", "elevators", "gym"]
    with pytest.raises(model.Invalid):
        model.normalize_display({"blocks": {"info": ["pool"]}}, strict=True)


def test_the_feed_follows_the_board_order(client, settings):
    _enable(client)
    made = _board(client)
    db = Database(settings.db_path)
    with db.connection() as c:
        _entity(c, "sensor.lot_free", "12")
        _entity(c, "input_boolean.gym_open", "on")
        _sources(c, "parking", ["sensor.lot_free"])
        _sources(c, "gym", ["input_boolean.gym_open"])
    r = client.patch(f"{API}/notices/boards/{made['board']['id']}", json={"display": {"blocks": {"info": ["gym", "parking"]}}})
    assert r.status_code == 200 and r.json()["board"]["display"]["blocks"]["info"] == ["gym", "parking"]
    feed = client.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": made["token"]}).json()
    # ha_sync is not connected in tests: the chips are the honest "unavailable", in the board's order
    assert [(c["kind"], c["state"]) for c in feed["info"]] == [("gym", "off"), ("parking", "off")]


# ---------------------------------------------------------------- Q4: entity-backed parking / gym chips

def test_nothing_picked_means_no_chip(conn):
    _entity(conn, "sensor.lot_free", "12")
    assert info.build(conn, ["parking", "gym"], "he", connected=True) == []


@pytest.mark.parametrize("ents,state,text", [
    ([("sensor.lot_a", "12", None)], "ok", "12 פנויות"),
    ([("sensor.lot_a", "3", None), ("input_number.lot_b", "4.0", None)], "ok", "7 פנויות"),
    ([("sensor.lot_a", "1", None)], "ok", "מקום אחד פנוי"),
    ([("sensor.lot_a", "0", None)], "warn", "מלאה"),
    ([("binary_sensor.spot_1", "on", "occupancy"), ("binary_sensor.spot_2", "off", "occupancy"), ("binary_sensor.spot_3", "off", "occupancy")], "ok", "2 פנויות"),
    ([("binary_sensor.spot_1", "on", "occupancy")], "warn", "מלאה"),
    ([("input_select.lot_status", "פתוחה לאורחים", None)], "ok", "פתוחה לאורחים"),
    ([("sensor.lot_a", "unavailable", None)], "off", "לא זמין"),
])
def test_parking_chip(conn, ents, state, text):
    for eid, st, dc in ents:
        _entity(conn, eid, st, device_class=dc)
    _sources(conn, "parking", [e[0] for e in ents])
    assert info.build(conn, ["parking"], "he", connected=True) == [{"kind": "parking", "label": "חניה", "state": state, "text": text}]


@pytest.mark.parametrize("ents,state,text", [
    ([("input_boolean.gym_open", "on", None)], "ok", "פתוח"),
    ([("schedule.gym_hours", "off", None)], "off", "סגור"),
    ([("binary_sensor.gym_door", "off", "door"), ("switch.gym_lights", "on", None)], "ok", "פתוח"),
    ([("binary_sensor.gym_occupancy", "on", "occupancy")], "ok", "בשימוש"),
    ([("binary_sensor.gym_occupancy", "off", "occupancy")], "ok", "פנוי"),
    ([("select.gym_mode", "סגור לשיפוץ עד יום חמישי הבא בערב", None)], "ok", "סגור לשיפוץ עד יום חמיש…"),  # 23 characters + an ellipsis
    ([("input_boolean.gym_open", "unknown", None)], "off", "לא זמין"),
])
def test_gym_chip(conn, ents, state, text):
    for eid, st, dc in ents:
        _entity(conn, eid, st, device_class=dc)
    _sources(conn, "gym", [e[0] for e in ents])
    assert info.build(conn, ["gym"], "he", connected=True) == [{"kind": "gym", "label": "חדר כושר", "state": state, "text": text}]


def test_english_words_and_a_stale_mirror(conn):
    _entity(conn, "sensor.lot_a", "5")
    _entity(conn, "input_boolean.gym_open", "off")
    _sources(conn, "parking", ["sensor.lot_a"])
    _sources(conn, "gym", ["input_boolean.gym_open"])
    assert info.build(conn, ["parking", "gym"], "en", connected=True) == [
        {"kind": "parking", "label": "Parking", "state": "ok", "text": "5 free"}, {"kind": "gym", "label": "Gym", "state": "off", "text": "Closed"}]
    assert [c["state"] for c in info.build(conn, ["parking", "gym"], "he", connected=False)] == ["off", "off"]  # never a stale "free"


def test_a_removed_or_missing_entity_is_unavailable_not_invented(conn):
    _entity(conn, "sensor.lot_a", "9", removed=True)
    _sources(conn, "parking", ["sensor.lot_a", "sensor.never_seen"])
    assert info.build(conn, ["parking"], "he", connected=True) == [{"kind": "parking", "label": "חניה", "state": "off", "text": "לא זמין"}]


def test_chips_never_carry_the_entity_or_its_name(conn):
    _entity(conn, "sensor.secret_lot", "4", name="Secret Lot Sensor")
    _entity(conn, "binary_sensor.secret_gym", "on", device_class="occupancy", name="Secret Gym")
    _sources(conn, "parking", ["sensor.secret_lot"])
    _sources(conn, "gym", ["binary_sensor.secret_gym"])
    blob = json.dumps(info.build(conn, ["parking", "gym"], "he", connected=True), ensure_ascii=False)
    assert "secret" not in blob.lower() and "sensor" not in blob


def test_a_stored_bad_source_list_reads_as_empty_or_filtered():
    assert model.info_sources_of("parking", "not json") == []
    assert model.info_sources_of("parking", '{"a": 1}') == []
    assert model.info_sources_of("gym", '["sensor.gym_count", "input_boolean.gym_open", "input_boolean.gym_open"]') == ["input_boolean.gym_open"]
    assert len(model.info_sources_of("parking", json.dumps([f"sensor.s{i}" for i in range(20)]))) == model.INFO_SOURCE_MAX


def test_the_settings_save_validate_and_audit_the_sources(client):
    r = client.patch(f"{API}/notices/settings", json={"parking_entities": ["sensor.lot_a", "binary_sensor.spot_1", "sensor.lot_a"], "gym_entities": ["schedule.gym_hours"]})
    assert r.status_code == 200, r.text
    s = r.json()["settings"]
    assert s["parking_entities"] == ["sensor.lot_a", "binary_sensor.spot_1"] and s["gym_entities"] == ["schedule.gym_hours"]
    with client.app.state.db.connection(mode="read") as c:
        rows = [json.loads(x[0] or "{}") for x in c.execute("SELECT details_json FROM audit_log WHERE action = 'notices.settings.update'").fetchall()]
    assert rows[-1]["keys"] == ["notices.info.gym_entities", "notices.info.parking_entities"]
    assert client.patch(f"{API}/notices/settings", json={"parking_entities": []}).json()["settings"]["parking_entities"] == []


@pytest.mark.parametrize("bad", [
    {"gym_entities": ["sensor.gym_people"]},  # a number for the gym: never a count of people
    {"parking_entities": ["light.lot"]},  # a domain the chip cannot read
    {"parking_entities": ["sensor.Lot A"]},
    {"parking_entities": "sensor.lot_a"},
    {"parking_entities": [f"sensor.s{i}" for i in range(9)]},
])
def test_bad_sources_are_refused(client, bad):
    r = client.patch(f"{API}/notices/settings", json=bad)
    assert r.status_code == 422
    s = client.get(f"{API}/notices/settings").json()["settings"]
    assert s["parking_entities"] == [] and s["gym_entities"] == []


def test_the_sources_need_system_configure(client, settings):
    bind(client, settings, "omer", "notices_boards", "installation", "*")
    assert client.patch(f"{API}/notices/settings", json={"parking_entities": ["sensor.lot_a"]}, headers=as_user("omer")).status_code == 403


def test_the_settings_offer_only_entities_the_chip_can_read(client, settings):
    db = Database(settings.db_path)
    with db.connection() as c:
        _entity(c, "sensor.lot_free", "12", name="חניון פנוי")
        _entity(c, "sensor.lobby_temp", "23.5", device_class="temperature")  # a measurement, not a count
        _entity(c, "sensor.lot_text", "abc")  # not a number
        _entity(c, "binary_sensor.spot_1", "off", device_class="occupancy")
        _entity(c, "binary_sensor.front_door", "off", device_class="door")
        _entity(c, "binary_sensor.smoke", "off", device_class="smoke")
        _entity(c, "input_boolean.gym_open", "on")
        _entity(c, "schedule.gym_hours", "off")
        _entity(c, "select.gym_mode", "פתוח")
        _entity(c, "light.gym", "on")
        _entity(c, "switch.gone", "on", removed=True)
        _entity(c, "switch.disabled_one", "on", disabled=1)
        _sources(c, "parking", ["sensor.lobby_temp"])  # already picked: still offered, so it can be seen and removed
    body = client.get(f"{API}/notices/settings").json()
    park = {e["entity_id"] for e in body["info_entities"]["parking"]}
    gym = {e["entity_id"] for e in body["info_entities"]["gym"]}
    assert park == {"sensor.lot_free", "sensor.lobby_temp", "binary_sensor.spot_1", "input_boolean.gym_open", "select.gym_mode"}
    assert gym == {"binary_sensor.spot_1", "binary_sensor.front_door", "input_boolean.gym_open", "schedule.gym_hours", "select.gym_mode"}
    assert next(e for e in body["info_entities"]["parking"] if e["entity_id"] == "sensor.lot_free") == {"entity_id": "sensor.lot_free", "name": "חניון פנוי", "domain": "sensor"}


def test_nothing_is_written_to_the_mirror(conn):
    _entity(conn, "input_boolean.gym_open", "on")
    _sources(conn, "gym", ["input_boolean.gym_open"])
    before = [tuple(r) for r in conn.execute("SELECT entity_id, state, updated_at FROM ha_entities ORDER BY entity_id").fetchall()]
    info.build(conn, ["gym", "parking"], "he", connected=True)
    info.candidates(conn, "gym")
    assert [tuple(r) for r in conn.execute("SELECT entity_id, state, updated_at FROM ha_entities ORDER BY entity_id").fetchall()] == before
