"""CR-036 S4: the one read adapter (services/intercom_adapter.py) and its typed endpoints (routers/access_control_reads.py),
end to end over the add-on's live service session against the fake WisKey (tests/fake_wiskey.py) - nothing here contacts a
device, a station, Home Assistant or WisKey.

The three-identity matrix of CR-036 section 5 (system administrator, an operator scoped to one station, a viewer), plus an
operator at installation scope and a site administrator with a deny on one station: visible rows, totals, fields and
refusals for every stage-1 read; fail closed; count-leak guards; caching never across principals; unknown enums; feature
flags; no person data in logs or caches.

Station scope is CR-033's (tests/intercom_station_scope.py: real rows once merged, a labelled double before)."""
from __future__ import annotations

import json
import logging
import time
from dataclasses import replace
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX, FakeWiskey
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.db import Database
from smplwise.services import intercom_adapter, intercom_authority as ia, intercom_sync

API = "/api/v1/access-control"
NEVER = ("192.0.2.10", "last_access", "1234", "pin_configured", "card_count", "masked", "user_ref", "ha-user-0001", "Secret Department",
         "profile_facets", "go2rtc")  # host, last access, card digits, PIN flag, card counts, the joinable pseudonym, an actor's HA id, template values


@pytest.fixture()
def ac(settings, monkeypatch, station_scope):  # noqa: F811
    """The app with the fake as its WisKey (the identity-matrix directory) and five principals:
    root (system_admin, installation) - otto (operator, installation) - vera (viewer, installation) - sara (operator on
    entry-a only) - sam (site_admin, installation, DENIED on entry-b)."""
    import websockets

    fake = FakeWiskey("admin", token="t").use_directory()
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    app = create_app(s)
    c = TestClient(app)
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    c.get("/api/v1/me", headers=as_user("sara"))
    station_scope.bind("dev-sara", "operator", "entry-a")
    station_scope.bind("dev-sam", "site_admin", "entry-b", effect="deny")
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


def get(c: TestClient, path: str, user: str, **params: Any) -> Any:
    return c.get(API + path, headers=as_user(user), params=params)


def body(c: TestClient, path: str, user: str, **params: Any) -> dict[str, Any]:
    r = get(c, path, user, **params)
    assert r.status_code == 200, (path, user, r.status_code, r.text)
    return r.json()


def sent(fake: FakeWiskey, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def clean(text: str) -> None:
    for marker in NEVER:
        assert marker not in text, marker


def set_policy(settings: Any, key: str, value: str) -> None:
    db = Database(settings.db_path)
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, value))


def audit_rows(settings: Any, action: str) -> list[dict[str, Any]]:
    db = Database(settings.db_path)
    with db.connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


# ---------------------------------------------------------------- gates

def test_every_endpoint_gates_before_looking_at_parameters(ac):
    fake, c, _s = ac
    for path in ("/people", "/people/u1", "/events", "/events/ev-7", "/groups", "/status/sync", "/status/alerts", "/stations/entry-a/programs", "/events/export.csv"):
        r = get(c, path, "vera")
        assert r.status_code == 403 and r.json()["code"] == "forbidden", (path, r.status_code)
    assert get(c, "/events", "vera", limit=999, door=7).status_code == 403, "refused before the parameters are validated"
    assert get(c, "/events", "otto", limit=999).status_code == 422
    assert get(c, "/stations", "nobody").status_code == 403 and get(c, "/features", "nobody").status_code == 403
    assert get(c, "/stations", "vera").status_code == 200, "the viewer keeps the entry center's stations"
    before = len(fake.received)
    for path in ("/people", "/events", "/groups"):
        get(c, path, "vera")
    assert len(fake.received) == before, "a refused caller never reaches WisKey"


def test_a_refusal_is_audited(ac):
    _fake, c, s = ac
    get(c, "/people", "vera")
    rows = audit_rows(s, ia.PEOPLE_READ)
    assert rows and rows[-1]["decision"] == "denied" and rows[-1]["actor_user_id"] == "dev-vera"


# ---------------------------------------------------------------- stations

def test_stations_by_identity(ac):
    _fake, c, _s = ac
    root = body(c, "/stations", "root")
    assert [st["id"] for st in root["stations"]] == ["entry-a", "entry-b", "entry-c"] and root["fresh"] is True
    assert root["stations"][0]["technical"]["model"] == "DS-KV6113" and root["stations"][0]["errors"] is not None
    vera = body(c, "/stations", "vera")
    assert all(st["technical"] is None and st["errors"] is None for st in vera["stations"]), "a viewer: no technical details, no error texts"
    otto = body(c, "/stations", "otto")
    assert all(st["technical"] is not None and st["errors"] is None for st in otto["stations"]), "answer 5 of 2026-10-12: an operator sees no error text"
    sara = body(c, "/stations", "sara")
    assert [st["id"] for st in sara["stations"]] == ["entry-a"], "a station off the chain is omitted, not greyed"
    sam = body(c, "/stations", "sam")
    assert [st["id"] for st in sam["stations"]] == ["entry-a", "entry-c"], "a deny on the station's chain wins"
    for b in (root, vera, otto, sara, sam):
        clean(json.dumps(b, ensure_ascii=False))


def test_one_station_is_404_when_absent_or_off_the_chain(ac):
    _fake, c, _s = ac
    assert body(c, "/stations/entry-a", "sara")["station"]["id"] == "entry-a"
    for station in ("entry-b", "nowhere"):
        r = get(c, f"/stations/{station}", "sara")
        assert r.status_code == 404 and r.json()["code"] == "intercom_station_not_found", station
    assert get(c, "/stations/bad%0Aid", "root").status_code == 422


def test_unknown_enums_and_fields_from_wiskey_never_pass(ac):
    fake, c, _s = ac
    fake.drift = True
    fake.push("refresh")
    wait_for(lambda: all(st["call_state"] == "unknown" for st in body(c, "/stations", "root")["stations"]))
    text = json.dumps(body(c, "/stations", "root"), ensure_ascii=False)
    assert "teleporting" not in text and "quantum" not in text and "x_unknown" not in text and "Drift Person" not in text
    assert {st["sync_state"] for st in body(c, "/stations", "root")["stations"]} == {"unknown"}, "an unknown sync state is unknown too"


# ---------------------------------------------------------------- people

def test_people_by_identity(ac):
    fake, c, _s = ac
    root = body(c, "/people", "root")["people"]
    assert root["total"] == 5 and root["total_all"] == 5 and [p["id"] for p in root["records"]] == ["u1", "u2", "u3", "u4", "u5"]
    assert root["records"][0]["employee_no"] == "1001" and root["sort"] == "employee" and root["employee_no_visible"] is True
    # S7: a LIST row carries of the sensitive fields only the credential kinds and whether there is a phone - the phone, the photo flag,
    # the profile values and the timing leave with one person's page (GET /people/{id}), so 200 rows never hold 200 phone numbers
    assert root["records"][0]["phone"] is None and root["records"][0]["phone_set"] is True and root["records"][0]["credentials"] == {"pin": True, "cards": 1}
    assert root["records"][0]["profile"] is None and root["records"][0]["photo_configured"] is None and root["records"][0]["timing"] is None
    otto = body(c, "/people", "otto")["people"]
    assert otto["total"] == 5, "an installation operator sees everyone, unassigned people included"
    assert otto["records"][0]["employee_no"] == "1001" and otto["records"][0]["phone"] is None, "names level: employee number yes, phone no"
    sara = body(c, "/people", "sara")["people"]
    assert [p["id"] for p in sara["records"]] == ["u1", "u5"] and sara["total"] == 2 and sara["total_all"] is None, "count-leak guard"
    assert [a["station_id"] for a in sara["records"][0]["stations"]] == ["entry-a"], "the out-of-scope assignment is omitted"
    assert sara["snapshot"] and sara["snapshot"] != root["snapshot"], "a restricted caller's snapshot is a digest of what they see"
    sam = body(c, "/people", "sam")["people"]
    assert [p["id"] for p in sam["records"]] == ["u1", "u4", "u5"], "u2 is only on the denied station; u3 has no station (restricted: hidden)"
    for page in (root, otto, sara, sam):
        clean(json.dumps(page, ensure_ascii=False))
        assert "profile_facets" not in json.dumps(page)
    assert all(m.get("query") == "" for m in sent(fake, "users/query")), "the search text never reaches WisKey (D1)"


def test_people_search_matches_only_what_the_caller_sees(ac):
    _fake, c, s = ac
    assert [p["id"] for p in body(c, "/people", "root", query="1002")["people"]["records"]] == ["u2"]
    sara = body(c, "/people", "sara", query="1002")["people"]
    assert sara["records"] == [] and sara["total"] == 0, "Avi is not on sara's station: no match, no count"
    assert [p["id"] for p in body(c, "/people", "otto", query="1005")["people"]["records"]] == ["u5"], "answer 2: the employee number is searchable at names level"
    set_policy(s, ia.EMPLOYEE_NO_SENSITIVE, "true")
    assert body(c, "/people", "otto", query="1005")["people"]["records"] == [], "made sensitive again: no longer matched for an operator"
    assert [p["id"] for p in body(c, "/people", "otto", query="avraham")["people"]["records"]] == ["u5"]
    page = body(c, "/people", "otto", sort="employee")["people"]
    assert page["sort"] == "name" and all(p["employee_no"] is None for p in page["records"]), "no number order for a caller who cannot see the numbers"


def test_a_station_filter_off_the_chain_answers_empty_without_asking_wiskey(ac):
    fake, c, _s = ac
    before = len(sent(fake, "users/query"))
    page = body(c, "/people", "sara", station="entry-b")["people"]
    assert page["records"] == [] and page["total"] == 0 and len(sent(fake, "users/query")) == before
    assert body(c, "/people", "sara", station="nowhere")["people"]["total"] == 0, "the same answer for a station that does not exist"


def test_one_person_by_identity(ac):
    _fake, c, _s = ac
    root = body(c, "/people/u1", "root")["person"]
    assert root["level"] == "sensitive" and root["phone"] == "+972500000000" and root["profile"] == {"department": "Engineering"} and root["editable"] is True
    assert root["timing"]["mode"] == "weekly" and root["timing"]["enforcement"] == "ha"
    assert root["stations"][1]["last_error"] == "device_unavailable"
    otto = body(c, "/people/u1", "otto")["person"]
    assert otto["level"] == "names" and otto["phone"] is None and otto["profile"] is None and otto["editable"] is False and otto["stations"][1]["last_error"] is None
    for user, person in (("sara", "u2"), ("sara", "u404"), ("sara", "u3"), ("sam", "u2")):
        r = get(c, f"/people/{person}", user)
        assert r.status_code == 404 and r.json()["code"] == "intercom_person_not_found", (user, person)
    clean(json.dumps(root, ensure_ascii=False))


def test_photo_is_sensitive_audited_and_a_jpeg(ac):
    fake, c, s = ac
    r = get(c, "/people/u1/photo", "root")
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg" and r.content[:2] == b"\xff\xd8"
    assert r.headers["cache-control"] == "private, no-store" and r.headers["x-content-type-options"] == "nosniff"
    assert [row["resource_id"] for row in audit_rows(s, "intercom.person.photo_view")] == ["u1"]
    r = get(c, "/people/u1/photo", "otto")
    assert r.status_code == 403 and audit_rows(s, ia.PEOPLE_SENSITIVE)[-1]["decision"] == "denied", "the photo stays sensitive (answer 2)"
    assert get(c, "/people/u2/photo", "sara").status_code == 404
    r = get(c, "/people/u2/photo", "root")
    assert r.status_code == 404 and r.json()["code"] == "intercom_photo_not_found"
    assert len(audit_rows(s, "intercom.person.photo_view")) == 1, "only the photo actually served is logged as viewed"
    assert [m["user_id"] for m in sent(fake, "users/photo_get")] == ["u1", "u2"], "the refused and the invisible person's photo were never asked for"


# ---------------------------------------------------------------- events

def test_events_by_identity(ac):
    fake, c, _s = ac
    n = len(sent(fake, "events/list"))
    root = body(c, "/events", "root")["events"]
    assert [e["id"] for e in root["records"]] == ["ev-9", "ev-8", "ev-7", "ev-6", "ev-5", "ev-4", "ev-3"] and len(sent(fake, "events/list")) == n + 1
    assert root["records"][2]["employee_no"] == "1001" and root["records"][2]["portrait"] is True and root["records"][0]["portrait"] is False
    otto = body(c, "/events", "otto")["events"]
    assert otto["records"][2]["employee_no"] == "1001" and otto["records"][2]["portrait"] is True, "answers 2 and 4: the events view is enough"
    sara = body(c, "/events", "sara")["events"]
    assert [e["id"] for e in sara["records"]] == ["ev-7", "ev-4"] and sara["next"] is None and sara["complete"] is True
    assert set(sara["stations"]) == {"entry-a"}, "the per-station stream status of the caller's stations only"
    sam = body(c, "/events", "sam")["events"]
    assert "entry-b" not in {e["station_id"] for e in sam["records"]}
    for page in (root, otto, sara, sam):
        text = json.dumps(page, ensure_ascii=False)
        clean(text)
        assert "u1" not in text and "evidence" not in text and "telemetry" not in text


def test_restricted_paging_hands_out_opaque_cursors_only(ac):
    fake, c, _s = ac
    first = body(c, "/events", "sara", limit=1)["events"]
    assert [e["id"] for e in first["records"]] == ["ev-7"] and first["next"].startswith("c.")
    second = body(c, "/events", "sara", limit=1, before=first["next"])["events"]
    assert [e["id"] for e in second["records"]] == ["ev-4"]
    r = get(c, "/events", "otto", before=first["next"])
    assert r.status_code == 422 and r.json()["code"] == "intercom_cursor_expired", "a cursor belongs to the principal it was issued to"
    assert get(c, "/events", "sara", before="c.forged").status_code == 422
    unrestricted = body(c, "/events", "root", limit=2)["events"]
    assert unrestricted["next"] == "ev-8", "a caller who sees everything pages on WisKey's own cursor"


def test_the_person_filter_never_matches_numbers_the_caller_cannot_see(ac):
    fake, c, s = ac
    assert [e["id"] for e in body(c, "/events", "otto", person="1004")["events"]["records"]] == ["ev-9", "ev-3"]
    assert sent(fake, "events/list")[-1]["filters"].get("person") == "1004"
    set_policy(s, ia.EMPLOYEE_NO_SENSITIVE, "true")
    assert body(c, "/events", "otto", person="1004")["events"]["records"] == [], "made sensitive: matched on names only, by Arx"
    assert "person" not in sent(fake, "events/list")[-1]["filters"]
    assert [e["id"] for e in body(c, "/events", "otto", person="lior")["events"]["records"]] == ["ev-9", "ev-3"]


def test_group_filter_needs_people_read(ac):
    _fake, c, _s = ac
    station_scope_free = get(c, "/events", "sam", current_group="staff")
    assert station_scope_free.status_code == 200
    assert get(c, "/events/export.csv", "otto", current_group="staff").status_code == 403, "no export permission at all"


def test_event_detail_and_portrait(ac):
    fake, c, s = ac
    detail = body(c, "/events/ev-7", "root")["event"]
    assert detail["evidence"]["identity_state"] == "identified" and detail["source_identity"]["normalized"] is True and "portrait" not in detail
    assert get(c, "/events/ev-8", "sara").status_code == 404 and get(c, "/events/ev-404", "root").status_code == 404
    r = get(c, "/events/ev-7/portrait", "otto", station_id="entry-a", at="2026-09-27T08:40:00+00:00")
    assert r.status_code == 200 and r.content[:2] == b"\xff\xd8"
    rows = audit_rows(s, "intercom.event.portrait_view")
    assert len(rows) == 1 and json.loads(rows[0]["details_json"])["person_id"] == "u1"
    assert get(c, "/events/ev-7/portrait", "otto", station_id="entry-c", at="2026-09-27T08:40:00+00:00").status_code == 404, "WisKey's row decides the station"
    assert get(c, "/events/ev-8/portrait", "otto", station_id="entry-b", at="2026-09-27T08:50:00+00:00").json()["code"] == "intercom_photo_not_found"
    assert get(c, "/events/ev-7/portrait", "sara", station_id="entry-b", at="2026-09-27T08:40:00+00:00").status_code == 404
    set_policy(s, ia.PORTRAIT_AUDIT, "false")
    assert get(c, "/events/ev-7/portrait", "otto", station_id="entry-a", at="2026-09-27T08:40:00+00:00").status_code == 200
    assert len(audit_rows(s, "intercom.event.portrait_view")) == 1, "the administrator switched the view log off"
    set_policy(s, ia.PORTRAIT_SENSITIVE, "true")
    assert get(c, "/events/ev-7/portrait", "otto", station_id="entry-a", at="2026-09-27T08:40:00+00:00").status_code == 404
    assert body(c, "/events", "otto")["events"]["records"][2]["portrait"] is None
    assert get(c, "/events/ev-7/portrait", "root", station_id="entry-a", at="2026-09-27T08:40:00+00:00").status_code == 200


def test_export_is_filtered_audited_and_never_carries_the_card(ac):
    fake, c, s = ac
    r = get(c, "/events/export.csv", "root")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv") and r.headers["x-export-rows"] == "8"
    text = r.content.decode("utf-8")
    assert text.startswith("\ufeff") and "masked_card" not in text and "1234" not in text and "9999" not in text
    header = text.lstrip("\ufeff").split("\r\n", 1)[0]
    assert header == '"timestamp","station","employee_no","person_name","event_type","authentication","result","door","recovered","time_source","display_timestamp","display_timezone"'
    assert '"\'=HYPERLINK(1)"' in text, "a formula-looking cell stays guarded"
    row = audit_rows(s, "intercom.events.export")[-1]
    details = json.loads(row["details_json"])
    assert details["rows"] == 8 and "Dana" not in row["details_json"], "the audit row has counts and columns, never a row"
    r = get(c, "/events/export.csv", "sam")
    assert r.status_code == 422 and r.json()["code"] == "intercom_export_station_required", "a restricted caller exports one station"
    assert get(c, "/events/export.csv", "sam", station_id="entry-b").status_code == 404
    r = get(c, "/events/export.csv", "sam", station_id="entry-a")
    assert r.status_code == 200 and sent(fake, "events/export")[-1]["filters"] == {"station_id": "entry-a"}
    assert get(c, "/events/export.csv", "otto").status_code == 403, "an operator holds no export permission"


# ---------------------------------------------------------------- groups, versions, schedules

def test_groups_by_identity_and_never_a_template(ac):
    _fake, c, _s = ac
    root = body(c, "/groups", "root")["groups"]
    assert [g["id"] for g in root["groups"]] == ["staff", "night", "visitors"] and root["fields"][0]["id"] == "department"
    otto = body(c, "/groups", "otto")["groups"]
    assert len(otto["groups"]) == 3 and otto["fields"] is None, "field definitions only with the sensitive level or the status page"
    assert body(c, "/groups", "sara")["groups"]["groups"] == [], "a restricted caller sees groups whose every station they see - none here"
    for who in ("root", "otto", "sara"):
        assert "Secret Department" not in json.dumps(body(c, "/groups", who), ensure_ascii=False)


def test_versions_and_schedules_are_installation_wide(ac):
    _fake, c, s = ac
    versions = body(c, "/groups/versions", "root")["versions"]
    assert versions["records"][0]["revision"] == 7 and "ha-user-0001" not in json.dumps(versions)
    assert get(c, "/groups/versions", "otto").status_code == 403
    r = get(c, "/groups/versions", "sam")
    assert r.status_code == 403 and audit_rows(s, ia.ADMIN_READ)[-1]["reason"] == "station_scoped"
    library = body(c, "/schedules", "root")["schedules"]
    assert library[0]["weekly"]["Monday"] == [{"start": "07:00", "end": "19:00"}]
    plans = body(c, "/schedules/plans", "root")["schedules"]
    assert plans[0]["report"]["users"] == {"state": "complete", "error": None}, "the device-user counts of a plan report are not kept"
    assert body(c, "/schedules/operations", "otto")["schedules"]["jobs"][0]["status"] == "blocked"
    assert get(c, "/schedules", "sara").status_code == 403, "WisKey's schedule library is installation-wide"


# ---------------------------------------------------------------- one station's technical reads

def test_technical_reads_and_code_presence_only(ac):
    fake, c, _s = ac
    programs = body(c, "/stations/entry-a/programs", "otto")["programs"]
    assert programs["programs"][0]["door"] == 1 and "api_id" not in json.dumps(programs) and programs["programs"][0]["execution"]["status"] == "held_acknowledged"
    hold = body(c, "/stations/entry-a/doors/1/hold", "otto")["hold"]
    assert hold["blocker"] == "schedule_writes_unverified" and hold["draft"]["door"] == 1
    r = get(c, "/stations/entry-a/doors/2/hold", "otto")
    assert r.status_code == 404 and r.json()["code"] == "intercom_lock_unknown", "entry-a has relay 1 only"
    codes = body(c, "/stations/entry-a/codes", "otto")["codes"]
    assert codes["public_pin_state"] == "configured" and codes["slots"] == [{"slot": 1, "configured": True}, {"slot": 2, "configured": False}, {"slot": 3, "configured": None}]
    text = json.dumps(codes)
    for privileged in ("engineering", "Alarm", "householder", "Hijacking", "sendCard"):
        assert privileged not in text, privileged
    assert get(c, "/stations/entry-b/programs", "sara").status_code == 404 and get(c, "/stations/entry-a/programs", "vera").status_code == 403
    frames = sent(fake, "stations/technical_codes_get")
    assert frames and all(f.get("api_contract") == 1 for f in frames), "a technical read carries api_contract"


def test_cached_reads_are_shared_never_per_principal_views(ac):
    fake, c, _s = ac
    body(c, "/groups", "root")
    body(c, "/groups", "otto")
    sara = body(c, "/groups", "sara")["groups"]
    assert len(sent(fake, "profiles/settings_get")) == 1, "one WisKey read for three callers"
    assert sara["groups"] == [], "the cached copy is the closed projection; every caller gets their own view of it"
    assert all(key[0] != "groups" or len(key) == 1 for key in intercom_adapter.ADAPTER.cache.keys()), "no cache key carries a principal"
    fake.push("refresh")
    wait_for(lambda: intercom_adapter.ADAPTER.cache.peek(("groups",), 60.0)[1] is False)
    body(c, "/groups", "root")
    assert len(sent(fake, "profiles/settings_get")) == 2, "a refresh push makes the cached copy stale"


def test_no_person_data_is_ever_cached(ac):
    _fake, c, _s = ac
    for path in ("/people", "/people/u1", "/events", "/events/ev-7", "/status/conflicts", "/status/audit", "/groups", "/status/sync", "/status/alerts",
                 "/stations/entry-a/health", "/stations/entry-a/programs", "/stations/entry-a/codes"):
        body(c, path, "root")
    cached = json.dumps([intercom_adapter.ADAPTER.cache.peek(k, 1e9)[0].value for k in intercom_adapter.ADAPTER.cache.keys()], ensure_ascii=False)
    for marker in ("Dana", "Avi", "1001", "+9725", "u1", "Lior"):
        assert marker not in cached, marker
    kinds = {k[0] for k in intercom_adapter.ADAPTER.cache.keys()}
    assert kinds <= set(intercom_adapter.TTL) and not kinds & {"people", "person", "events", "event", "conflicts", "audit"}


# ---------------------------------------------------------------- the Settings status page

def test_status_page_reads(ac):
    _fake, c, _s = ac
    health = body(c, "/stations/entry-a/health", "root")["health"]
    assert health["access"]["assignment_states"] == {"synced": 40, "pending": 2} and health["events"]["stream"] == "connected"
    clean(json.dumps(health))
    assert "42" not in json.dumps(health["access"]), "people / card counts are not kept"
    history = body(c, "/stations/entry-a/health/history", "root")["history"]
    assert [r["sync"] for r in history["records"]] == ["synced", "unknown"], "an unknown enum value is unknown"
    assert get(c, "/stations/entry-b/health", "sam").status_code == 404 and get(c, "/stations/entry-a/health", "otto").status_code == 403
    status = body(c, "/status/sync", "root")["sync_status"]
    by = {r["station_id"]: r for r in status["stations"]}
    assert by["entry-c"]["deletions_pending"] == 1 and by["entry-c"]["card_removals_pending"] == 1 and by["entry-a"]["card_removals_pending"] == 0
    assert by["entry-a"]["operations"]["pending"] == 1 and status["totals"]["operations"]["failed"] == 1
    text = json.dumps(status, ensure_ascii=False)
    for marker in ("Dana", "u1", "1008", "u9"):
        assert marker not in text, marker
    sam = body(c, "/status/sync", "sam")["sync_status"]
    assert "entry-b" not in [r["station_id"] for r in sam["stations"]] and sam["totals"]["operations"]["failed"] == 0, "totals over the visible stations"


def test_conflicts_alerts_and_wiskey_audit(ac):
    _fake, c, s = ac
    conflicts = body(c, "/status/conflicts", "root")["conflicts"]
    kinds = {(r["kind"], r["station_id"]) for r in conflicts}
    assert kinds == {("person", "entry-b"), ("removal", "entry-c"), ("revocation", "entry-b")}
    person = next(r for r in conflicts if r["kind"] == "person")
    assert person["person"] == {"id": "u1", "display_name": "Dana", "employee_no": "1001"}
    assert get(c, "/status/conflicts", "sam").status_code == 403, "installation-wide in WisKey: unrestricted only"
    alerts = body(c, "/status/alerts", "root")["alerts"]
    assert alerts["total"] == 3 and alerts["active_count"] == 2 and alerts["suppressed_count"] == 1 and "ha-user-0001" not in json.dumps(alerts)
    sam_alerts = body(c, "/status/alerts", "sam")["alerts"]
    assert sam_alerts["total"] == 2 and "entry-b" not in json.dumps(sam_alerts), "counted over the visible stations"
    paged = body(c, "/status/alerts", "root", limit=1, offset=1)["alerts"]
    assert len(paged["items"]) == 1 and paged["next_offset"] == 2
    audit = body(c, "/status/audit", "root")["audit"]
    assert audit["records"][0]["actor_name"] == "Site Manager" and audit["records"][0]["person"]["display_name"] == "Dana"
    text = json.dumps(audit, ensure_ascii=False)
    assert "pin_configured" not in text and "card_count" not in text and "ha-user" not in text
    assert get(c, "/status/audit", "sam").status_code == 403


# ---------------------------------------------------------------- the S4 self-review's regressions

def _without_correlation(r: Any) -> dict[str, Any]:
    payload = r.json()
    payload.pop("correlation_id", None)
    return {"status": r.status_code, **payload}


def test_not_found_is_the_same_answer_whether_absent_or_off_the_callers_chain(ac):
    """Finding 1: WisKey's own not-found (the feed's error, with WisKey's code in `details`) and the filter's "not yours" were
    distinguishable by message and details - an existence oracle for ids the caller may not see. Now byte-identical."""
    _fake, c, _s = ac
    pairs = [
        (API + "/people/u2", API + "/people/u404"),  # u2 exists but only on entry-b
        (API + "/people/u2/photo", API + "/people/u404/photo"),
        (API + "/events/ev-8", API + "/events/ev-404"),  # ev-8 exists on entry-b
        ("/api/v1/intercom/people/u2", "/api/v1/intercom/people/u404"),
    ]
    for hidden, absent in pairs:
        a = _without_correlation(c.get(hidden, headers=as_user("sara")))
        b = _without_correlation(c.get(absent, headers=as_user("sara")))
        assert a == b and a["status"] == 404 and a["details"] == {}, (hidden, a, b)
        assert "WisKey" not in a["user_message"]


def test_a_row_dropped_on_the_unrestricted_path_is_never_counted(ac, monkeypatch):
    """Finding 2: on the pass-through path WisKey's totals and cursor were forwarded on the assumption that an unrestricted
    caller sees every row. When the filter drops one anyway (fail closed: here every decision about entry-c errs), the
    request is answered the counted way instead - no total counts the dropped row, no WisKey cursor can name it."""
    _fake, c, _s = ac
    from smplwise import rbac

    real = rbac.authorize

    def flaky(conn: Any, principal: Any, permission: str, target: tuple[str, str]) -> Any:
        if target == (ia.STATION_SCOPE, "entry-c"):
            raise RuntimeError("database is gone")
        return real(conn, principal, permission, target)

    monkeypatch.setattr(rbac, "authorize", flaky)
    people = body(c, "/people", "otto")["people"]
    assert [p["id"] for p in people["records"]] == ["u1", "u2", "u3", "u5"] and people["total"] == 4 and people["total_all"] is None, "u4 is on entry-c only"
    events = body(c, "/events", "otto", limit=2)["events"]
    assert [e["id"] for e in events["records"]] == ["ev-8", "ev-7"]
    assert events["next"] is None or events["next"].startswith("c."), "never WisKey's raw cursor on a filtered page"
    assert "entry-c" not in json.dumps(events)


def test_the_reads_never_hold_the_write_lock_while_wiskey_answers():
    """Finding 3: the phase-1b reads took the request's WRITE connection (BEGIN IMMEDIATE: SQLite's one write lock) and held it
    across the WisKey round trip (a people search scans up to ten pages). Every adapter-backed read - the typed endpoints and
    the three legacy ones - now resolves on the read connection only."""
    from fastapi.routing import APIRoute

    from smplwise.auth import get_conn, get_read_conn
    from smplwise.routers import access_control, access_control_reads

    def calls(dep: Any) -> list[Any]:
        out = []
        for sub in dep.dependencies:
            out.extend(calls(sub))
            out.append(sub.call)
        return out

    legacy = {("GET", "/intercom/events"), ("GET", "/intercom/people"), ("GET", "/intercom/people/{user_id}")}
    routes = [r for r in access_control_reads.router.routes if isinstance(r, APIRoute)]
    routes += [r for r in access_control.router.routes if isinstance(r, APIRoute) and any((m, r.path) in legacy for m in r.methods)]
    assert len(routes) == 25 + 1 + 3  # the 25 typed reads, the parity report (CR-036 S12), the three legacy reads
    for route in routes:
        deps = calls(route.dependant)
        assert get_read_conn in deps and get_conn not in deps, route.path


def test_a_failing_adapter_projection_never_takes_the_entry_center_down(ac, monkeypatch):
    """Finding 4: S4 hooked the adapter's projections into the feed's overview store; one raising there would end the feed's
    session. It is contained: the entry center keeps working, technical details and features are withheld (fail closed)."""
    fake, c, _s = ac

    def broken(_raw: Any) -> Any:
        raise TypeError("an answer nobody expected")

    monkeypatch.setattr(intercom_adapter, "project_station_technical", broken)
    fake.push("refresh")
    wait_for(lambda: body(c, "/stations", "root")["stations"][0]["technical"] is None)
    assert intercom_sync.STATE.state == "ready" and intercom_sync.STATE.reconnects == 0
    assert body(c, "/features", "root")["features"]["people"] == {"available": False, "reason": "commands_unknown"}
    assert c.get("/api/v1/intercom/overview", headers=as_user("root")).json()["state"] == "ready"


# ---------------------------------------------------------------- feature flags

def test_a_command_wiskey_does_not_list_hides_the_feature_without_a_call(ac):
    fake, c, _s = ac
    fake.unlist("users/photo_get", "fleet/alerts")
    fake.push("refresh")
    wait_for(lambda: body(c, "/features", "root")["features"]["alerts"]["available"] is False)
    features = body(c, "/features", "root")["features"]
    assert features["person_photo"] == {"available": False, "reason": "not_listed"} and features["people"]["available"] is True
    r = get(c, "/people/u1/photo", "root")
    assert r.status_code == 409 and r.json()["code"] == "intercom_unsupported"
    reply = body(c, "/status/alerts", "root")
    assert reply["state"] == "unsupported" and reply["last_error"] == "not_listed" and reply["alerts"] is None
    assert sent(fake, "users/photo_get") == [] and sent(fake, "fleet/alerts") == [] and sent(fake, "users/get") == [], "nothing was sent to WisKey"


def test_an_incompatible_wiskey_hides_every_feature(ac):
    fake, c, _s = ac
    fake.overview["api"]["min_client"] = 2
    fake.push("refresh")
    wait_for(lambda: body(c, "/features", "root")["features"]["people"]["reason"] == "api_incompatible")
    assert body(c, "/people", "root")["state"] == "unsupported"


# ---------------------------------------------------------------- privacy and degraded states

def test_no_person_data_in_the_logs(ac, caplog):
    _fake, c, _s = ac
    caplog.set_level(logging.DEBUG)
    for path in ("/people", "/people/u1", "/events", "/events/ev-7", "/status/conflicts", "/status/audit", "/status/sync"):
        body(c, path, "root")
    get(c, "/people/u1/photo", "root")
    text = caplog.text
    for marker in ("Dana", "Avi", "+97250", "1001", "data:image"):
        assert marker not in text, marker


def test_the_legacy_reads_follow_the_same_filter(ac):
    _fake, c, _s = ac
    for path in ("/api/v1/intercom/people", "/api/v1/intercom/events", "/api/v1/intercom/people/u1"):
        assert c.get(path, headers=as_user("vera")).status_code == 403, f"{path}: a viewer no longer reads people or events (owner answer 3)"
    legacy = c.get("/api/v1/intercom/people", headers=as_user("sara")).json()["people"]
    assert [p["id"] for p in legacy["records"]] == ["u1", "u5"] and legacy["total_all"] is None
    assert set(legacy["records"][0]) == {"id", "employee_no", "display_name", "active", "valid_from", "valid_until", "revision", "group_ids", "stations"}
    events = c.get("/api/v1/intercom/events", headers=as_user("sara")).json()["events"]
    assert [e["id"] for e in events["records"]] == ["ev-7", "ev-4"] and "portrait" not in events["records"][0]
    assert c.get("/api/v1/intercom/people/u2", headers=as_user("sara")).status_code == 404
    overview = c.get("/api/v1/intercom/overview", headers=as_user("sam")).json()["overview"]
    assert [st["id"] for st in overview["stations"]] == ["entry-a", "entry-c"], "the entry center omits a denied station"
    background = c.get("/api/v1/intercom/background", headers=as_user("sam")).json()["projection"]
    assert [st["id"] for st in background["stations"]] == ["entry-a", "entry-c"]


def test_stale_cached_copy_is_served_not_fresh_while_wiskey_cannot_answer(ac, monkeypatch):
    fake, c, _s = ac
    assert body(c, "/status/sync", "root")["fresh"] is True
    monkeypatch.setitem(intercom_adapter.TTL, "sync_status", 0.0)
    fake.errors_once["sync/status"] = "rate_limited"
    reply = body(c, "/status/sync", "root")
    assert reply["fresh"] is False and reply["sync_status"] is not None and reply["last_error"] == "rate_limited"


def test_feed_not_ready_answers_its_state_and_no_data(settings):
    intercom_sync.SYNC.reset()
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    for path in ("/people", "/events", "/groups", "/status/sync", "/stations"):
        reply = c.get(API + path).json()
        assert reply["state"] == "ha_not_configured", path
        assert all(reply.get(k) is None for k in ("people", "events", "groups", "sync_status", "stations")), path
    intercom_sync.SYNC.reset()
