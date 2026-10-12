"""CR-036 S7 (people completion): what the typed people reads (GET /api/v1/access-control/people*) gained for the native screen -
the credential kinds and `phone_set` at the sensitive level only, list rows without the fields that belong to one person's page,
the field filters (`credential`, `profile`) that only a holder of `access.people.sensitive` can use and that never separate
people by a value the caller cannot read, the group / state filters, and `employee_no_visible`. Over the same three-identity
harness as tests/test_intercom_adapter.py, against the fake WisKey (tests/fake_wiskey.py) - nothing here contacts a device, a
station, Home Assistant or WisKey."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from conftest import as_user, bind
from fake_wiskey import FakeWiskey
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_adapter import ac, audit_rows, body, get, sent, set_policy, wait_for  # noqa: F401 - `ac` is a fixture

from smplwise.services import intercom_adapter, intercom_authority as ia

PRIVATE = ("1234", "masked", "pin_configured", "card_count", "+972500000000", "Engineering", "123456789")


def person(fake: FakeWiskey, uid: str) -> dict[str, Any]:
    return next(p for p in fake.directory or [] if p["id"] == uid)


def ids(page: dict[str, Any]) -> list[str]:
    return [p["id"] for p in page["records"]]


# ---------------------------------------------------------------- credential kinds and the phone flag

def test_credential_kinds_and_phone_flag_are_sensitive_level_only(ac):
    fake, c, _s = ac
    root = body(c, "/people", "root")["people"]["records"][0]
    assert root["credentials"] == {"pin": True, "cards": 1} and root["phone_set"] is True
    otto = body(c, "/people", "otto")["people"]["records"][0]
    assert otto["credentials"] is None and otto["phone_set"] is None, "names level: neither the kinds nor whether there is a phone"
    sara = body(c, "/people", "sara")["people"]["records"][0]
    assert sara["credentials"] is None, "a scoped operator (names level) neither"
    one = body(c, "/people/u1", "root")["person"]
    assert one["credentials"] == {"pin": True, "cards": 1} and one["phone"] == "+972500000000" and one["phone_set"] is True
    assert body(c, "/people/u1", "otto")["person"]["credentials"] is None
    text = json.dumps([root, one, otto, sara], ensure_ascii=False)
    for marker in ("1234", "masked", "pin_configured", "card_count"):
        assert marker not in text, "kinds and counts only: never a card number, a mask or the PIN flag's own key"


def test_the_kinds_count_enabled_cards_only_and_a_missing_fact_is_unknown(ac):
    fake, c, _s = ac
    person(fake, "u2")["cards"][0]["enabled"] = False
    person(fake, "u3")["pin_configured"] = False
    del person(fake, "u4")["cards"]
    del person(fake, "u4")["pin_configured"]
    rows = {p["id"]: p for p in body(c, "/people", "root")["people"]["records"]}
    assert rows["u2"]["credentials"] == {"pin": True, "cards": 0}
    assert rows["u3"]["credentials"] == {"pin": False, "cards": 1}
    assert rows["u4"]["credentials"] is None, "neither fact sent: unknown, never 'has none'"


def test_a_redacted_credential_category_is_unknown_not_empty(ac):
    fake, c, _s = ac
    person(fake, "u1")["redacted_fields"] = ["credentials", "phone"]
    row = body(c, "/people", "root")["people"]["records"][0]
    assert row["credentials"] is None and row["phone_set"] is None
    assert body(c, "/people/u1", "root")["person"]["phone"] is None


def test_a_list_row_never_carries_what_belongs_to_one_persons_page(ac):
    _fake, c, _s = ac
    for user in ("root", "sam"):
        for row in body(c, "/people", user)["people"]["records"]:
            assert row["phone"] is None and row["profile"] is None and row["photo_configured"] is None
            assert row["responsible_person"] is None and row["access_purpose"] is None and row["timing"] is None
    one = body(c, "/people/u1", "root")["person"]
    assert one["phone"] and one["profile"] == {"department": "Engineering"} and one["photo_configured"] is True and one["timing"]["mode"] == "weekly"


def test_the_page_says_whether_the_caller_sees_every_employee_number(ac):
    _fake, c, s = ac
    assert body(c, "/people", "otto")["people"]["employee_no_visible"] is True
    assert body(c, "/people", "sara")["people"]["employee_no_visible"] is True
    set_policy(s, ia.EMPLOYEE_NO_SENSITIVE, "true")
    assert body(c, "/people", "otto")["people"]["employee_no_visible"] is False, "made sensitive again: the screen hides the number column"
    assert body(c, "/people", "root")["people"]["employee_no_visible"] is True


# ---------------------------------------------------------------- the credential filter

def test_the_credential_filter_is_answered_by_wiskey_for_a_caller_who_sees_every_credential(ac):
    fake, c, _s = ac
    person(fake, "u2")["pin_configured"] = False
    person(fake, "u3")["cards"][0]["enabled"] = False
    n = len(sent(fake, "users/query"))
    assert ids(body(c, "/people", "root", credential="no_pin")["people"]) == ["u2"]
    assert ids(body(c, "/people", "root", credential="no_card")["people"]) == ["u3"]
    assert ids(body(c, "/people", "root", credential="pin")["people"]) == ["u1", "u3", "u4", "u5"]
    assert ids(body(c, "/people", "root", credential="card")["people"]) == ["u1", "u2", "u4", "u5"]
    frames = sent(fake, "users/query")[n:]
    assert [f["filters"].get("credential") for f in frames] == ["no_pin", "no_card", "pin", "card"] and all(f["query"] == "" for f in frames)
    page = body(c, "/people", "root", credential="no_pin")["people"]
    assert page["total"] == 1 and page["total_all"] == 5


def test_the_credential_filter_needs_the_sensitive_permission_and_is_audited_when_refused(ac):
    fake, c, s = ac
    before = len(sent(fake, "users/query"))
    for user in ("otto", "sara", "vera"):
        r = get(c, "/people", user, credential="pin")
        assert r.status_code == 403 and r.json()["code"] == "forbidden", user
    assert len(sent(fake, "users/query")) == before, "a refused field filter never reaches WisKey"
    assert audit_rows(s, ia.PEOPLE_SENSITIVE)[-1]["decision"] == "denied"
    assert get(c, "/people", "otto").status_code == 200 and get(c, "/people", "otto", group="staff").status_code == 200, "the ordinary filters stay open to names level"
    r = get(c, "/people", "otto", **{"profile": "department=Engineering"})
    assert r.status_code == 403, "a profile value is as sensitive as a credential kind"


def test_a_field_filter_value_is_validated(ac):
    _fake, c, _s = ac
    assert get(c, "/people", "root", credential="everything").status_code == 422
    for bad in ("department", "=Engineering", "department=", "bad id=x", "department=" + "x" * 101):
        assert get(c, "/people", "root", profile=bad).status_code == 422, bad
    r = c.get("/api/v1/access-control/people?profile=a=1&profile=a=2", headers=as_user("root"))
    assert r.status_code == 422, "one value per field"
    many = "&".join(f"profile=f{i}=v" for i in range(9))
    assert c.get(f"/api/v1/access-control/people?{many}", headers=as_user("root")).status_code == 422


def partly_sensitive(ac, station_scope, fake, c, s):
    """mia: names level everywhere (operator, installation) and the sensitive level on entry-a only (site administrator bound to
    that one station) - the case where a field filter could become an oracle. u5 is moved onto entry-a alone, so for mia u5 is a
    sensitive-level person and u1 (entry-a + entry-b) is a names-level one."""
    c.get("/api/v1/me", headers=as_user("mia"))
    bind(c, s, "mia", "operator", "installation", "*")
    station_scope.bind("dev-mia", "site_admin", "entry-a")
    del person(fake, "u5")["assignments"]["entry-c"]


def test_a_names_level_person_never_matches_a_field_filter_for_a_partly_sensitive_caller(ac, station_scope):
    """The oracle: filtering by credential must not tell a caller anything about a person whose credentials they may not read."""
    fake, c, s = ac
    partly_sensitive(ac, station_scope, fake, c, s)
    person(fake, "u5")["pin_configured"] = False
    person(fake, "u1")["pin_configured"] = False
    page = body(c, "/people", "mia", credential="no_pin")["people"]
    assert ids(page) == ["u5"], "u1 also has no PIN, but mia cannot read u1's credentials: no match, no hint"
    assert page["total"] == 1
    wanted = body(c, "/people", "mia", credential="pin")["people"]
    assert "u1" not in ids(wanted) and "u5" not in ids(wanted)
    assert all(r["credentials"] is not None for r in page["records"]), "what is returned is at the level that shows it"
    rows = {r["id"]: r for r in body(c, "/people", "mia")["people"]["records"]}
    assert rows["u1"]["credentials"] is None and rows["u5"]["credentials"] == {"pin": False, "cards": 1}


# ---------------------------------------------------------------- the profile filter

def test_the_profile_filter_matches_exact_values_for_the_sensitive_level(ac):
    fake, c, _s = ac
    person(fake, "u2")["profile"] = {"department": "Security"}
    n = len(sent(fake, "users/query"))
    page = body(c, "/people", "root", profile="department=Security")["people"]
    assert ids(page) == ["u2"] and page["total"] == 1
    assert sent(fake, "users/query")[n]["filters"]["profile"] == {"department": "Security"}
    assert ids(body(c, "/people", "root", profile="department=Engineering")["people"]) == ["u1", "u3", "u4", "u5"]
    assert ids(body(c, "/people", "root", profile="department=Nobody")["people"]) == []
    both = body(c, "/people", "root", profile="department=Engineering", credential="pin")["people"]
    assert ids(both) == ["u1", "u3", "u4", "u5"]
    text = json.dumps(page)
    assert "Security" not in text, "the filter's value is not echoed in a row (profile values leave with one person's page)"


def test_a_profile_filter_never_separates_names_level_people(ac, station_scope):
    fake, c, s = ac
    partly_sensitive(ac, station_scope, fake, c, s)
    person(fake, "u1")["profile"] = {"department": "Security"}
    person(fake, "u5")["profile"] = {"department": "Security"}
    page = body(c, "/people", "mia", profile="department=Security")["people"]
    assert ids(page) == ["u5"], "u1 matches too, but its profile values are not mia's to read"


# ---------------------------------------------------------------- group and state filters

def test_group_and_state_filters(ac):
    fake, c, _s = ac
    assert ids(body(c, "/people", "otto", group="staff")["people"]) == ["u1", "u2", "u5"]
    assert ids(body(c, "/people", "otto", group="night")["people"]) == ["u4"]
    assert ids(body(c, "/people", "sara", group="staff")["people"]) == ["u1", "u5"], "a scoped caller: the group filter narrows what they see, never widens"
    assert get(c, "/people", "vera", group="staff").status_code == 403
    fake.now = datetime(2027, 2, 1, tzinfo=timezone.utc)
    assert ids(body(c, "/people", "otto", state="expired")["people"]) == ["u1", "u2", "u3", "u4", "u5"], "every window ended on 2027-01-01"
    fake.now = datetime(2026, 10, 12, tzinfo=timezone.utc)
    assert ids(body(c, "/people", "otto", state="expired")["people"]) == []
    person(fake, "u4")["valid_from"] = "2030-01-01T00:00:00+00:00"
    assert ids(body(c, "/people", "otto", state="upcoming")["people"]) == ["u4"]
    person(fake, "u3")["archived_at"] = "2026-09-01T00:00:00+00:00"
    assert "u3" not in ids(body(c, "/people", "otto")["people"]), "archived people are listed only on request"
    page = body(c, "/people", "otto", state="archived")["people"]
    assert ids(page) == ["u3"] and page["records"][0]["archived"] is True
    assert body(c, "/people", "otto", state="inactive")["people"]["records"] == []


def test_paging_carries_the_snapshot_and_reports_a_change(ac):
    fake, c, _s = ac
    first = body(c, "/people", "root", limit=2)["people"]
    assert ids(first) == ["u1", "u2"] and first["next_offset"] == 2 and first["stale"] is False and first["snapshot"]
    second = body(c, "/people", "root", limit=2, offset=2, snapshot=first["snapshot"])["people"]
    assert ids(second) == ["u3", "u4"] and second["stale"] is False
    person(fake, "u4")["revision"] = 99
    third = body(c, "/people", "root", limit=2, offset=4, snapshot=first["snapshot"])["people"]
    assert ids(third) == ["u5"] and third["stale"] is True and third["snapshot"] != first["snapshot"], "the directory changed under the paging: stale"
    restricted = body(c, "/people", "sara", limit=1)["people"]
    assert restricted["total"] == 2 and restricted["total_all"] is None and restricted["next_offset"] == 1
    more = body(c, "/people", "sara", limit=1, offset=1, snapshot=restricted["snapshot"])["people"]
    assert ids(more) == ["u5"] and more["stale"] is False


def test_the_legacy_people_read_never_offers_the_field_filters(ac):
    """GET /intercom/people (phase 1b) keeps its shape: no credential / profile filter, no new keys."""
    fake, c, _s = ac
    n = len(sent(fake, "users/query"))
    r = c.get("/api/v1/intercom/people", headers=as_user("root"))
    assert r.status_code == 200
    row = r.json()["people"]["records"][0]
    assert set(row) == {"id", "employee_no", "display_name", "active", "valid_from", "valid_until", "revision", "group_ids", "stations"}
    assert "credential" not in sent(fake, "users/query")[n]["filters"] and "profile" not in sent(fake, "users/query")[n]["filters"]


def test_nothing_private_reaches_a_people_answer(ac):
    """A list answer never holds a phone, a card digit, a profile value or the PIN flag's key - for anyone; one person's page
    holds them for the sensitive level only (root, sam are site administrators)."""
    _fake, c, _s = ac
    for user in ("root", "otto", "sara", "sam"):
        text = get(c, "/people", user).text
        for marker in PRIVATE:
            assert marker not in text, (user, "/people", marker)
    for user in ("otto", "sara"):
        for path in ("/people/u1", "/people/u5"):
            r = get(c, path, user)
            if r.status_code != 200:
                continue
            for marker in PRIVATE:
                assert marker not in r.text, (user, path, marker)
    sensitive = get(c, "/people/u1", "sam").text
    assert "+972500000000" in sensitive and "pin_configured" not in sensitive and "1234" not in sensitive, "kinds and counts, never the flag's key or a card digit"
