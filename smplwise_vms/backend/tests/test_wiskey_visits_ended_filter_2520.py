"""WISKEY-VISITS-ENDED-FILTER-2520, FAKES ONLY: the visit list's `status=ended` filter (an Arx record that ended), offered only when the
connected WisKey offers it. WisKey added `filters.status=ended` to `visits/list` in the same change as `visits/record_external_v1`
(its access/visit_requests.py at rc.19 / rc.20; rc.10 refuses `ended` with `invalid_fields`), so the signal is the record command in
WisKey's discovery list (`overview.api.commands`) - never a version label. The fake (tests/fake_wiskey_visits.py) answers like rc.10
while the command is not offered and like rc.19 while it is. Nothing contacts a device, Home Assistant or WisKey.

What is proven:
- `list_statuses`: the six rc.10 values without a copy, with unknown commands, with rc.10's command set or an incompatible contract;
  `ended` appended only with the record command;
- rc.10 (the lab): `capabilities.visits.statuses` has no `ended`; `status=ended` is refused in Arx (409 `wiskey_visits_unsupported`,
  feature `ended_filter`, Hebrew text + English for an English reader) and no frame is sent; the other statuses are sent as before;
- rc.19+: `statuses` lists `ended`; `status=ended` sends `filters.status = "ended"` and answers only the ended rows;
- the guard is what keeps rc.10 safe: without it the fake (like rc.10) refuses the value;
- the router's `status` stays a closed list (an unknown value is 422)."""
from __future__ import annotations

from fake_wiskey_visits import RECORD, wiskey_visit
from test_wiskey_visits_2407 import W, offered, sent, vx  # noqa: F401 - vx is the shared fixture

from smplwise import error_text
from smplwise.services import wiskey_visits as wv
from tickets_world import API

SIX = ["all", "pending", "approved", "rejected", "cancelled", "superseded"]
RC10 = ["visits/list", "guest_templates/get"]


# ---------------------------------------------------------------- the decision (pure)

def test_list_statuses_add_ended_only_with_the_record_command():
    assert wv.list_statuses(None) == SIX
    assert wv.list_statuses({"commands": None}) == SIX
    assert wv.list_statuses({"commands": RC10}) == SIX
    assert wv.list_statuses({"version": "2.0.1-rc.20", "commands": RC10}) == SIX, "a version label alone is never the signal"
    assert wv.list_statuses({"min_client": 99, "commands": [*RC10, RECORD]}) == SIX
    assert wv.list_statuses({"commands": [*RC10, RECORD]}) == [*SIX, "ended"]
    assert wv.reason_text("ended_filter_not_offered") == wv.REASON_HE["ended_filter_not_offered"]
    assert error_text.english(wv.REASON_HE["ended_filter_not_offered"]), "the refusal has its English"


# ---------------------------------------------------------------- rc.10: hidden, refused in Arx, nothing sent

def test_rc10_lists_no_ended_and_refuses_it_before_any_frame(vx):  # noqa: F811
    fake, env, _s = vx
    caps = env.c.get(W).json()["capabilities"]
    assert caps["visits"]["available"] is True and caps["visits"]["statuses"] == SIX
    before = len(sent(fake, "visits/list"))
    r = env.c.get(f"{W}/visits", params={"status": "ended"})
    assert r.status_code == 409, r.text
    body = r.json()
    assert body["code"] == "wiskey_visits_unsupported"
    assert body["details"] == {"feature": "ended_filter", "reason": "ended_filter_not_offered"}
    assert body["user_message"] == wv.REASON_HE["ended_filter_not_offered"]
    assert len(sent(fake, "visits/list")) == before, "nothing is sent for a filter the system does not offer"


def test_rc10_the_other_statuses_are_sent_as_before(vx):  # noqa: F811
    fake, env, _s = vx
    for status in SIX:
        r = env.c.get(f"{W}/visits", params={"status": status})
        assert r.status_code == 200 and r.json()["state"] == "ready", (status, r.text)
        assert sent(fake, "visits/list")[-1]["filters"]["status"] == status
    pending = env.c.get(f"{W}/visits", params={"status": "pending"}).json()["visits"]["items"]
    assert [i["id"] for i in pending] == ["v-wk-1"]


def test_an_english_reader_gets_the_refusal_in_english(vx):  # noqa: F811
    _fake, env, _s = vx
    assert env.c.put(f"{API}/me/prefs", json={"ui.lang": "en"}).status_code == 200
    r = env.c.get(f"{W}/visits", params={"status": "ended"})
    assert r.status_code == 409 and r.json()["user_message"] == error_text.english(wv.REASON_HE["ended_filter_not_offered"]), r.text


def test_without_the_guard_rc10_would_refuse_the_value(vx, monkeypatch):  # noqa: F811
    fake, env, _s = vx
    monkeypatch.setattr(wv, "list_statuses", lambda api: [*SIX, "ended"])
    r = env.c.get(f"{W}/visits", params={"status": "ended"})
    assert sent(fake, "visits/list")[-1]["filters"]["status"] == "ended"
    assert r.status_code != 200 or r.json()["visits"] is None, r.text  # the fake answers rc.10's `invalid_fields`: no list


# ---------------------------------------------------------------- rc.19+: offered

def test_with_the_record_command_ended_is_offered_and_filters_the_list(vx):  # noqa: F811
    fake, env, _s = offered(vx)
    fake.visits.append(wiskey_visit("v-arx-1", "00000000-0000-4000-8000-000000000099", status="ended", source="arx", external_ref="inv-1",
                                    sequence=3))
    caps = env.c.get(W).json()["capabilities"]
    assert caps["visits"]["statuses"] == [*SIX, "ended"]
    r = env.c.get(f"{W}/visits", params={"status": "ended"})
    assert r.status_code == 200, r.text
    items = r.json()["visits"]["items"]
    assert [(i["id"], i["status"]) for i in items] == [("v-arx-1", "ended")]
    assert sent(fake, "visits/list")[-1]["filters"] == {"status": "ended", "scope": "all"}
    everything = env.c.get(f"{W}/visits").json()["visits"]["items"]
    assert {i["id"] for i in everything} == {"v-wk-1", "v-wk-2", "v-arx-1"}


def test_the_status_parameter_stays_a_closed_list(vx):  # noqa: F811
    fake, env, _s = vx
    before = len(sent(fake, "visits/list"))
    assert env.c.get(f"{W}/visits", params={"status": "expired"}).status_code == 422
    assert len(sent(fake, "visits/list")) == before
