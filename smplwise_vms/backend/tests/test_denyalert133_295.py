"""DENYALERT133-295 (board item r133, docs/changes/CR-DENYALERT133.md): the denied-entry alert of the external access.

FAKES ONLY: the WisKey events come from a function installed in `access_denied.EVENT_SOURCE`; nothing reaches WisKey, a station or a door."""
from __future__ import annotations

import json
from datetime import timedelta

import pytest
from conftest import bind
from test_access_grants import APPROVER, T0, Env
from tickets_world import API

from smplwise.services import access_denied as ad
from smplwise.services import access_grants as ag
from smplwise.services import notify_policy

SECRET_PIN = "482913"
SECRET_CARD = "0012345678"


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    e.feed: list[dict] = []
    e.answer = [True]  # False = WisKey does not answer
    monkeypatch.setattr(ad, "EVENT_SOURCE", lambda db, since: list(e.feed) if e.answer[0] else None)
    yield e
    ag.reset_for_tests()


def _on(env: Env, value: str = "on") -> None:
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", ad.SWITCH_KEY, value)


def _ev(n: int, station: str = "st-a", employee_no: str | None = None, minutes: int = 1, **extra) -> dict:
    at = (T0 + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"id": f"ev-{n}", "station_id": station, "received_at": at, "timestamp": at, "result": "denied", "event_type": "access_denied",
            "authentication": "pin", "employee_no": employee_no, "person_name": "שם פרטי", "card_no": SECRET_CARD, "pin": SECRET_PIN, **extra}


def _rows(env: Env) -> list[dict]:
    with env.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY first_at", (ad.SOURCE,)).fetchall()]


def _who(env: Env, nid: str) -> set[str]:
    with env.db.connection(mode="read") as conn:
        return {r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchall()}


def _start(env: Env) -> str:
    """An active grant on st-a, the switch on, the cursor set (the first pass only starts the cursor)."""
    gid = env.active_grant()
    _on(env)
    assert ad.denied_pass(env.db) == 0
    return gid


def _emp(env: Env, gid: str) -> str:
    with env.db.connection(mode="read") as conn:
        return ag.link_row(conn, env.grant(gid)["link_id"])["employee_no"]


def test_off_by_default_nothing_is_read_or_emitted(env):
    env.active_grant()
    env.feed.append(_ev(1))
    assert ad.denied_pass(env.db) == 0 and _rows(env) == []
    assert env.sql_count(f"SELECT COUNT(*) FROM settings WHERE key = '{ad.CURSOR_KEY}'") == 0
    assert env.c.get(f"{API}/access-grants/settings").json()["denied_alert"] == "off"


def test_own_switch_on_but_the_feature_off_emits_nothing(env):
    env.active_grant()
    _on(env)
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES (?, 'off')", ag.FLAG_KEY)
    env.feed.append(_ev(1))
    assert ad.denied_pass(env.db) == 0 and _rows(env) == []


def test_feature_on_but_the_own_switch_off_emits_nothing(env):
    env.active_grant()
    env.feed.append(_ev(1))
    assert ad.denied_pass(env.db) == 0 and ad.denied_pass(env.db) == 0 and _rows(env) == []


def test_the_first_pass_never_alerts_history(env):
    env.active_grant()
    _on(env)
    env.feed.append(_ev(1, minutes=-30))
    assert ad.denied_pass(env.db) == 0 and _rows(env) == []
    assert ad.denied_pass(env.db) == 0, "the old event is before the cursor"
    assert _rows(env) == []


def test_a_refusal_at_a_door_of_a_live_grant_is_emitted_and_a_success_is_not(env):
    _start(env)
    env.feed.append(_ev(1))
    env.feed.append({**_ev(2), "result": "granted", "event_type": "access_granted"})
    assert ad.denied_pass(env.db) == 1
    rows = _rows(env)
    assert len(rows) == 1 and rows[0]["subject_kind"] == "access_denied" and rows[0]["subject_id"] == "st-a" and rows[0]["category"] == "security"
    assert rows[0]["severity"] == "info" and rows[0]["count"] == 1
    assert ad.denied_pass(env.db) == 0, "the same events are not read twice"
    assert _rows(env)[0]["count"] == 1


def test_a_refusal_of_a_known_person_names_the_grant_and_the_reason(env):
    gid = _start(env)
    emp = _emp(env, gid)
    inside = 47 * 60 + 60  # minutes after T0: one hour into the grant's window (Thu 08:00 local)
    env.feed.append(_ev(1, employee_no=emp, minutes=inside))
    assert ad.denied_pass(env.db) == 1
    n = _rows(env)[0]
    assert json.loads(n["params_json"])["ref"] == gid[:8] and json.loads(n["params_json"])["code"] == "credential_refused"
    assert n["dedupe_key"] == f"{ad.SOURCE}:st-a:{gid}"
    # an ended grant: the same person at the door is "the grant is not active"
    env.sql("UPDATE access_grants SET state = 'ended' WHERE id = ?", gid)
    env.feed.append(_ev(2, employee_no=emp, minutes=inside + 1))
    assert ad.denied_pass(env.db) == 1
    assert json.loads(_rows(env)[0]["params_json"])["code"] == "grant_not_active"
    # the device's own attempt-limit event
    env.sql("UPDATE access_grants SET state = 'active' WHERE id = ?", gid)
    env.feed.append(_ev(3, employee_no=emp, minutes=inside + 2, event_type="attempt_limit"))
    assert ad.denied_pass(env.db) == 1
    assert json.loads(_rows(env)[0]["params_json"])["code"] == "attempt_limit"


def test_a_refusal_before_the_window_starts_is_outside_window(env):
    gid = _start(env)
    env.feed.append(_ev(1, employee_no=_emp(env, gid), minutes=1))  # two days before the grant's window
    assert ad.denied_pass(env.db) == 1
    assert json.loads(_rows(env)[0]["params_json"])["code"] == "outside_window"


def test_a_refusal_at_an_unrelated_station_or_of_an_unknown_person_is_not_ours(env):
    _start(env)
    env.feed.append(_ev(1, station="st-z"))
    env.feed.append(_ev(2, station="st-z", employee_no="somebody-else"))
    assert ad.denied_pass(env.db) == 0 and _rows(env) == []


def test_repeated_refusals_fold_into_one_row_with_a_count_and_a_burst_raises_severity(env):
    _start(env)
    env.feed += [_ev(i) for i in range(1, 4)]
    assert ad.denied_pass(env.db) == 3
    rows = _rows(env)
    assert len(rows) == 1 and rows[0]["count"] == 3 and rows[0]["severity"] == "info"
    env.feed += [_ev(i, minutes=2) for i in range(4, 7)]  # 3 more -> 6 in the open row
    assert ad.denied_pass(env.db) == 3
    rows = _rows(env)
    assert len(rows) == 1 and rows[0]["count"] == 6 and rows[0]["severity"] == "alert", "a burst is ONE row that rose to alert, never critical"
    assert rows[0]["severity"] != "critical"


def test_a_burst_inside_one_pass_also_raises_severity(env):
    _start(env)
    env.feed += [_ev(i) for i in range(1, ad.BURST_N + 1)]
    ad.denied_pass(env.db)
    rows = _rows(env)
    assert len(rows) == 1 and rows[0]["count"] == ad.BURST_N and rows[0]["severity"] == "alert"


def test_two_stations_make_two_rows(env):
    env.active_grant(doors={"st-a": [1], "st-b": [1]})
    _on(env)
    ad.denied_pass(env.db)
    env.feed += [_ev(1, station="st-a"), _ev(2, station="st-b")]
    assert ad.denied_pass(env.db) == 2 and len(_rows(env)) == 2


def test_the_text_carries_no_secret(env):
    gid = _start(env)
    emp = _emp(env, gid)
    env.feed.append(_ev(1, employee_no=emp))
    ad.denied_pass(env.db)
    n = _rows(env)[0]
    blob = json.dumps(n, ensure_ascii=False)
    for secret in (SECRET_PIN, SECRET_CARD, emp, "שם פרטי", "יוסי", "972500"):
        assert secret not in blob, secret
    assert n["title"] == "ניסיון כניסה נדחה" and "גישה " + gid[:8] in n["body"]


def test_recipients_are_the_approvers_of_that_station_only(env):
    rid = env.role("מאשר עמדה א", APPROVER)
    bind(env.c, env.settings, "appr_a", rid, "access_control_station", "st-a")
    bind(env.c, env.settings, "appr_b", rid, "access_control_station", "st-b")
    bind(env.c, env.settings, "plain", "viewer", "installation", "*")
    _start(env)
    env.feed.append(_ev(1, station="st-a"))
    ad.denied_pass(env.db)
    nid = _rows(env)[0]["id"]
    who = _who(env, nid)
    assert "dev-appr_a" in who and "dev-appr_b" not in who and "dev-plain" not in who


def test_a_wiskey_that_does_not_answer_keeps_the_cursor_and_the_next_pass_reads_again(env):
    _start(env)
    env.feed.append(_ev(1))
    env.answer[0] = False
    assert ad.denied_pass(env.db) == 0 and _rows(env) == []
    env.answer[0] = True
    assert ad.denied_pass(env.db) == 1 and len(_rows(env)) == 1


def test_a_failing_event_source_never_breaks_the_worker_pass(env, monkeypatch):
    _start(env)
    monkeypatch.setattr(ad, "EVENT_SOURCE", lambda db, since: (_ for _ in ()).throw(RuntimeError("boom")))
    env.run()  # _screen_passes guards each step


def test_the_policy_row_is_listed_only_while_the_switch_and_the_feature_are_on(env):
    env.active_grant()

    def listed() -> bool:
        with env.db.connection() as conn:
            return any(p["source"] == ad.SOURCE for p in notify_policy.list_policies(conn))

    assert listed() is False
    _on(env)
    assert listed() is True
    env.sql("INSERT OR REPLACE INTO settings(key, value) VALUES (?, 'off')", ag.FLAG_KEY)
    assert listed() is False


def test_the_switch_is_set_through_the_settings_route(env):
    r = env.c.put(f"{API}/access-grants/settings", json={"denied_alert": "on"})
    assert r.status_code == 200 and r.json()["denied_alert"] == "on", r.text
    with env.db.connection(mode="read") as conn:
        assert ad.switch_on(conn) is True
