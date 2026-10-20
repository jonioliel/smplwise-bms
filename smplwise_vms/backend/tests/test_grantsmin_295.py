"""GRANTSMIN-295: the Arx-only leftovers of the shared identity that SHAREDID-293 did not cover
(private/planning/BACKLOG_RECONCILED_2026-10-20.md, item grants-minor-leftovers; CR-ARX-WISKEY-SHARED-IDENTITY 2.3, 2.6, T12):

 a  the drift view: per person, where Arx and WisKey differ (name, scope, unread / unknown / missing record, a person Arx created that
    holds no live grant) - served from what Arx already stored, never a WisKey read; the "push the name" action is the existing route;
 b  the external-access CSV: the grants the caller may see, the phone only at the level the caller may see it (never more than the
    directory AND the people-sensitive rule both allow), formula-guarded, audited without names, one per minute;
 c  the person's data export (tickets 15.2 / CR 2.6 "Rights") gains the person's grants: window, doors by name, state, notices.

The denied-attempt alert stays out (needs WisKey W-c). FAKES ONLY (tests/fake_wiskey.FakeAccessEngine through test_access_grants.Env);
nothing reaches WisKey, a station, a door or WhatsApp. GO_LIVE_PERMITTED is switched on inside the Env only (monkeypatch)."""
from __future__ import annotations

import csv
import io
import json
from datetime import timedelta

import pytest
from conftest import as_user, bind
from test_access_grants import APPROVER, PHONE, T0, Env
from tickets_world import API

from smplwise.services import access_external as ax
from smplwise.services import access_grants as ag


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    ax.reset_export_rate()
    yield e
    ag.reset_for_tests()
    ax.reset_export_rate()


def _get(env: Env, path: str, user: str | None = None):
    return env.c.get(f"{API}{path}", headers=as_user(user) if user else None)


def _drift(env: Env, user: str | None = None) -> dict:
    r = _get(env, "/access-grants/drift", user)
    assert r.status_code == 200, r.text
    return r.json()["drift"]


def _row(d: dict, contact_id: str) -> dict | None:
    return next((x for x in d["rows"] if x["contact_id"] == contact_id), None)


def _kinds(d: dict, contact_id: str) -> list[str]:
    row = _row(d, contact_id)
    return [x["kind"] for x in row["diffs"]] if row else []


def _audits(env: Env, action: str) -> list[tuple]:
    with env.db.connection(mode="read") as conn:
        return [tuple(r) for r in conn.execute("SELECT decision, reason, resource_id, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,))]


def _csv(r) -> list[list[str]]:
    assert r.status_code == 200, r.text
    raw = r.content.decode("utf-8")
    assert raw.startswith("﻿"), "UTF-8 with a BOM (Excel and Hebrew)"
    return list(csv.reader(io.StringIO(raw[1:])))


# ================================================================ a  the drift view


def test_a_person_in_step_with_wiskey_has_no_difference(env):
    env.active_grant()
    d = _drift(env)
    assert d["rows"] == [] and d["in_sync"] == 1, d


def test_a_name_edited_in_wiskey_is_listed_and_the_push_clears_it(env):
    gid = env.active_grant()
    pid = env.person_of(gid)["id"]
    env.engine.people[pid]["display_name"] = "שם שנערך בווייזקי"
    env.clock[0] = T0 + timedelta(hours=1, minutes=1)
    env.run()
    d = _drift(env)
    row = _row(d, env.tech)
    assert row is not None and _kinds(d, env.tech) == ["name"], d
    assert row["name"] == "יוסי טכנאי" and row["origin"] == "created_from_arx" and row["can"]["push_name"] is True
    assert "שם שנערך" not in json.dumps(d, ensure_ascii=False), "WisKey's own name value is never stored nor served"
    r = env.post(f"/access-grants/links/{row['link_id']}/push-name")
    assert r.status_code == 200, r.text
    assert _drift(env)["rows"] == []


def test_the_drift_view_never_reads_wiskey(env):
    env.active_grant()
    before = list(env.engine.calls)
    _drift(env)
    _drift(env)
    assert env.engine.calls == before, "served from what Arx stored; the hourly pass does the reading"


def test_a_scope_changed_in_wiskey_is_a_scope_difference_with_a_read_now(env):
    gid = env.active_grant()
    pid = env.person_of(gid)["id"]
    env.engine.people[pid]["doors"]["st-a"] = [1, 2]
    env.clock[0] = T0 + timedelta(hours=1, minutes=1)
    env.run()
    d = _drift(env)
    row = _row(d, env.tech)
    assert _kinds(d, env.tech) == ["scope"] and row["grant"]["id"] == gid and row["can"]["read_now"] is True, d


def test_an_unread_scope_is_unverified_not_a_mismatch(env):
    gid = env.active_grant()
    env.sql("UPDATE access_grants SET scope_proof = NULL, scope_checked_at = NULL WHERE id = ?", gid)
    assert _kinds(_drift(env), env.tech) == ["unverified"]


def test_a_missing_wiskey_person_and_a_person_without_access_are_listed(env):
    gone = env.active_grant()
    del env.engine.people[env.person_of(gone)["id"]]
    assert env.post(f"/access-grants/{gone}/revoke").status_code == 200
    assert "missing" in _kinds(_drift(env), env.tech)
    idle = env.active_grant(contact_id=env.tech2)
    assert env.post(f"/access-grants/{idle}/revoke").status_code == 200
    env.run()
    assert env.grant(idle)["state"] == "revoked"
    d = _drift(env)
    assert _kinds(d, env.tech2) == ["idle_person"], d
    assert [r["contact_id"] for r in d["rows"]][0] == env.tech, "the most urgent difference first"


def test_the_drift_view_lists_only_people_the_caller_may_see(env):
    env.active_grant()
    env.active_grant(contact_id=env.tech2, doors={"st-b": [1]})
    for gid in (r["id"] for r in _get(env, "/access-grants").json()["grants"]):
        env.sql("UPDATE access_grants SET scope_proof = NULL, scope_checked_at = NULL WHERE id = ?", gid)
    bind(env.c, env.settings, "vw", "viewer", "installation", "*")
    blind = _drift(env, "vw")
    assert blind["rows"] == [] and blind["in_sync"] == 0, blind
    role = env.role("מאשר עמדה ב", APPROVER)
    bind(env.c, env.settings, "apb", role, "access_control_station", "st-b")
    d = _drift(env, "apb")
    assert [r["contact_id"] for r in d["rows"]] == [env.tech2], d
    assert d["rows"][0]["can"] == {"push_name": False, "read_now": True}, "push only for a name difference; read now on its own station"


def test_a_matched_person_is_never_a_name_difference(env):
    env.engine.add_person("wk-staff9", stations=["st-a"])
    env.engine.people["wk-staff9"]["display_name"] = "שם אחר לגמרי"
    r = env.post("/access-grants/links", {"contact_id": env.tech2, "wiskey_person_id": "wk-staff9"})
    assert r.status_code == 200, r.text
    d = _drift(env)
    assert _row(d, env.tech2) is None and d["in_sync"] == 1, "Arx never renames a matched person, so its name is no difference"


def test_the_drift_view_is_empty_while_the_feature_is_off(env):
    env.active_grant()
    env.sql("UPDATE settings SET value = 'off' WHERE key = ?", ag.FLAG_KEY)
    d = _drift(env)
    assert d["rows"] == [] and d["enabled"] is False


# ================================================================ b  the external-access CSV


def _export(env: Env, user: str | None = None, **params):
    q = "&".join(f"{k}={v}" for k, v in params.items())
    return _get(env, f"/access-grants/export.csv{'?' + q if q else ''}", user)


def test_the_csv_lists_the_grants_with_the_full_number_for_a_directory_editor(env):
    gid = env.active_grant()
    rows = _csv(_export(env))
    head, body = rows[0], rows[1:]
    assert head[0] == "שם" and len(body) == 1, rows
    cells = dict(zip(head, body[0]))
    assert cells["שם"] == "יוסי טכנאי" and cells["חברה"] == "קליימה-טק" and cells["מצב"] == "פעיל · אומת"
    assert cells["טלפון"].endswith(PHONE[-4:]) and len([c for c in cells["טלפון"] if c.isdigit()]) >= 9, "the directory editor sees the full number"
    assert cells["מזהה גישה"] == gid
    ax.reset_export_rate()
    en = _csv(_export(env, lang="en"))
    assert en[0][0] == "Name" and "Active · verified" in en[1]


def test_the_csv_masks_or_drops_the_number_by_what_the_caller_may_see(env):
    env.active_grant()
    role = env.role("מאשר", APPROVER)
    bind(env.c, env.settings, "ap1", role, "installation", "*")
    cells = dict(zip(*_csv(_export(env, "ap1"))[:2]))
    assert cells["טלפון"] == "····" + PHONE[-2:], "people-sensitive without the directory's full-number right: the screen's mask"
    ax.reset_export_rate()
    reader = env.c.post(f"{API}/access/roles", json={"name": "קורא", "description": "t", "permissions": ["access.people.read"], "sensitive": ["access.people.manage"]})
    assert reader.status_code == 201, reader.text
    bind(env.c, env.settings, "rd1", reader.json()["id"], "installation", "*")
    cells = dict(zip(*_csv(_export(env, "rd1"))[:2]))
    assert cells["טלפון"] == "" and cells["מצב הקוד"] == "", "no number and no delivery state below the sensitive level"
    assert PHONE not in _export(env).text


def test_the_csv_is_refused_to_a_caller_without_an_access_role_and_audited(env):
    env.active_grant()
    bind(env.c, env.settings, "vw5", "viewer", "installation", "*")
    r = _export(env, "vw5")
    assert r.status_code == 403
    assert _audits(env, "access.grant.export")[-1][:2] == ("denied", "no_binding")


def test_the_csv_guards_formulas_and_audits_ids_only(env):
    env.sql("UPDATE ticket_contacts SET display_name = ? WHERE id = ?", "=HYPERLINK(\"http://x\")", env.tech)
    env.active_grant()
    cells = dict(zip(*_csv(_export(env))[:2]))
    assert cells["שם"].startswith("'="), "a cell starting like a formula is prefixed"
    allowed = [a for a in _audits(env, "access.grant.export") if a[0] == "allowed"]
    assert allowed and json.loads(allowed[-1][3])["rows"] == 1
    assert "HYPERLINK" not in allowed[-1][3] and PHONE not in allowed[-1][3]


def test_the_csv_is_once_a_minute_per_user(env):
    env.active_grant()
    assert _export(env).status_code == 200
    r = _export(env)
    assert r.status_code == 429 and r.json()["code"] == "export_rate"


def test_the_csv_live_only_leaves_history_out(env):
    env.active_grant()
    done = env.active_grant(contact_id=env.tech2)
    assert env.post(f"/access-grants/{done}/revoke").status_code == 200
    env.run()
    assert len(_csv(_export(env))) == 3
    ax.reset_export_rate()
    assert len(_csv(_export(env, live="true"))) == 2


# ================================================================ c  the person's data export (CR 2.6 "Rights")


def test_the_contact_export_carries_the_persons_grants(env):
    gid = env.active_grant()
    r = _get(env, f"/tickets/contacts/{env.tech}/export")
    assert r.status_code == 200, r.text
    acc = r.json()["access"]
    assert acc["link"]["origin"] == "created_from_arx" and acc["link"]["state"] == "linked"
    g = acc["grants"][0]
    assert g["id"] == gid and g["state"] == "active" and g["valid_from"] and g["valid_until"]
    assert [d["name"] for d in g["doors"]] and all(set(d) == {"station_id", "name", "relays"} for d in g["doors"])
    assert g["notices"] and g["notices"][0]["via"] == "approver"
    text = json.dumps(acc, ensure_ascii=False)
    for secret in ("913377", "wiskey_person_id", "employee_no", PHONE):
        assert secret not in text, secret


def test_the_contact_export_of_a_person_without_access_says_so(env):
    r = _get(env, f"/tickets/contacts/{env.tech2}/export")
    assert r.status_code == 200 and r.json()["access"] == {"link": None, "grants": []}
