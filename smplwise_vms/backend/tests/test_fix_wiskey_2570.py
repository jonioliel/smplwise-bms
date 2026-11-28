"""FIX-WISKEY-2570, FAKES ONLY: the two low findings of the 2.56 deep review of the WisKey area (docs/review/DEEP-REVIEW-2560-WISKEY-ACCESS.md).

- WA-02 (services/wiskey_schedule_execution.py `_check` / `_read_reviews`): a review read that fails after another one succeeded never
  leaves half the counts behind. The phase comes from the last COMPLETE review read of the job (zero when there was none), the job says
  `reviews_unread`, and the status read says `reviews_unread` too. Nothing but the three reads is ever sent.
- WA-03 (routers/access_wiskey_visits.py): a status WisKey's filter contract (`wiskey-visit-list-filters.v1`) leaves out is refused with
  its own reason `status_filter_not_offered` (Hebrew + English), never the ended filter's; nothing is sent.

Nothing here contacts WisKey, Home Assistant, a station or a network."""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from test_wiskey_schedule_execution_2530 import JOB, FakePort, job_doc
from test_wiskey_visits_2407 import W, sent, vx  # noqa: F401 - vx is the shared fixture

from smplwise import error_text
from smplwise.services import wiskey_schedule_execution as sx
from smplwise.services import wiskey_visits as wv
from smplwise.wire.access_control_schedule_execution import ScheduleExecutionJob

ZERO = {"pending": 0, "approved": 0, "rejected": 0}


@pytest.fixture(autouse=True)
def _clean_reads():
    sx.reset()
    yield
    sx.reset()


class ReviewFailPort(FakePort):
    """The fake port of the 2.53 tests, with the read of ONE review failing (`fail_review`: review id -> (code, outcome))."""

    def __init__(self) -> None:
        super().__init__()
        self.fail_review: dict[str, tuple[str, str]] = {}

    def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> Any:
        if command == sx.REVIEW and parameters.get("review_id") in self.fail_review:
            self.calls.append((command, dict(parameters), timeout))
            raise sx.PortFailure(*self.fail_review[parameters["review_id"]])
        return super().call(command, parameters, timeout=timeout)


# ================================================================ WA-02

def test_a_second_review_read_that_fails_never_leaves_the_first_count() -> None:
    """The review's probe: two reviews of one job, the first reads `rejected`, the second fails `unknown`. Before: phase `rejected`,
    reviews {rejected: 1}. Now: no complete read was ever made, so zero counts and `waiting_owner`, said to be unread."""
    port = ReviewFailPort()
    port.w.job = job_doc("ready")
    port.w.reviews["r1"] = {"job": JOB, "state": "rejected"}
    port.w.reviews["r2"] = {"job": JOB, "state": "pending"}
    port.fail_review = {"r2": ("bridge_outcome_unknown", "unknown")}
    r = sx.check(JOB, port=port)
    assert port.sent() == [sx.STATUS, sx.PENDING, sx.REVIEW, sx.REVIEW] and not set(port.sent()) & sx.NEVER
    assert r["job"]["reviews"] == ZERO, "half the reads never count"
    assert r["job"]["phase"] == "waiting_owner", "never `rejected` from half the reviews"
    assert r["job"]["reviews_read"] is False and r["job"]["reviews_unread"] is True
    assert r["status_read"] == {"outcome": "ok", "code": "reviews_unread"}
    ScheduleExecutionJob.model_validate(r["job"])  # the answer's model knows the new key


def test_a_failed_review_read_keeps_the_last_complete_reviews_until_a_complete_read() -> None:
    port = ReviewFailPort()
    port.w.job = job_doc("ready")
    port.w.reviews["r2"] = {"job": JOB, "state": "pending"}
    first = sx.check(JOB, port=port)["job"]
    assert first["phase"] == "review_pending" and first["reviews"] == {**ZERO, "pending": 1} and first["reviews_unread"] is False
    # WisKey now holds a rejected review first and the pending one second; the second read fails
    port.w.reviews = {"r1": {"job": JOB, "state": "rejected"}, "r2": {"job": JOB, "state": "pending"}}
    port.fail_review = {"r2": ("bridge_outcome_unknown", "unknown")}
    second = sx.check(JOB, port=port)
    assert second["job"]["phase"] == "review_pending", "the last complete view, not `rejected` from half of this check"
    assert second["job"]["reviews"] == {**ZERO, "pending": 1}
    assert second["job"]["reviews_read"] is False and second["job"]["reviews_unread"] is True
    assert second["status_read"] == {"outcome": "ok", "code": "reviews_unread"}
    # a second failure keeps the same complete view (also when the pending list itself cannot be read)
    port.fail = {sx.PENDING: ("bridge_outcome_unknown", "unknown")}
    third = sx.check(JOB, port=port)["job"]
    assert third["phase"] == "review_pending" and third["reviews"] == {**ZERO, "pending": 1} and third["reviews_unread"] is True
    # a complete read settles it
    port.fail, port.fail_review = {}, {}
    fourth = sx.check(JOB, port=port)
    assert fourth["job"]["reviews"] == {"pending": 1, "approved": 0, "rejected": 1} and fourth["job"]["phase"] == "review_pending"
    assert fourth["job"]["reviews_read"] is True and fourth["job"]["reviews_unread"] is False
    assert fourth["status_read"] == {"outcome": "ok", "code": None}
    assert sx.known(JOB) == fourth["job"]


def test_a_schema_failure_of_the_second_review_is_handled_the_same_way() -> None:
    port = ReviewFailPort()
    port.w.job = job_doc("ready")
    port.w.reviews["r1"] = {"job": JOB, "state": "approved"}
    port.w.reviews["r2"] = {"job": JOB, "state": "pending"}
    port.tamper = lambda c, d: dict(d, extra=1) if c == sx.REVIEW and d.get("review_id") == "r2" else d
    r = sx.check(JOB, port=port)["job"]
    assert r["reviews"] == ZERO and r["phase"] == "waiting_owner" and r["reviews_unread"] is True


def test_reads_without_review_reads_are_not_called_unread() -> None:
    port = FakePort(support=("supported", None, frozenset({sx.STATUS})))  # WisKey does not list the review reads
    r = sx.check(JOB, port=port)["job"]
    assert r["reviews_read"] is False and r["reviews_unread"] is False
    port = FakePort()
    port.w.missing = True
    sx.reset()
    assert sx.check(JOB, port=port)["job"]["reviews_unread"] is False  # not_found: no review read was tried


# ================================================================ WA-03

THREE = ["all", "pending", "approved"]
CONTRACT = {"contract": "wiskey-visit-list-filters.v1", "status_filters": THREE}


def caps(entry):
    return SimpleNamespace(lists=lambda c: c == "visits/list", business_contracts={"visits/list": entry})


def test_status_filter_reason_has_hebrew_and_english() -> None:
    he = wv.reason_text("status_filter_not_offered")
    assert he == wv.REASON_HE["status_filter_not_offered"] and any(0x0590 <= ord(ch) <= 0x05FF for ch in he)
    assert error_text.english(he), "the refusal has its English"
    assert he != wv.REASON_HE["ended_filter_not_offered"]


def test_a_status_the_contract_leaves_out_is_refused_with_its_own_reason(vx, monkeypatch):  # noqa: F811
    fake, env, _s = vx
    fake.filter_contract = True
    monkeypatch.setattr(wv, "direct_capabilities", lambda: caps(CONTRACT))
    assert env.c.get(W).json()["capabilities"]["visits"]["statuses"] == THREE
    before = len(sent(fake, "visits/list"))
    for status in ("superseded", "rejected", "cancelled"):
        r = env.c.get(f"{W}/visits", params={"status": status})
        assert r.status_code == 409, r.text
        body = r.json()
        assert body["code"] == "wiskey_visits_unsupported"
        assert body["details"] == {"feature": "status_filter", "reason": "status_filter_not_offered"}, status
        assert body["user_message"] == wv.REASON_HE["status_filter_not_offered"]
    # `ended` left out keeps the ended filter's own reason
    r = env.c.get(f"{W}/visits", params={"status": "ended"})
    assert r.status_code == 409 and r.json()["details"] == {"feature": "ended_filter", "reason": "ended_filter_not_offered"}
    assert len(sent(fake, "visits/list")) == before, "nothing is sent for a filter the system does not offer"
    # an offered status is sent as before
    r = env.c.get(f"{W}/visits", params={"status": "pending"})
    assert r.status_code == 200 and sent(fake, "visits/list")[-1]["filters"]["status"] == "pending"


def test_an_english_reader_gets_the_status_refusal_in_english(vx, monkeypatch):  # noqa: F811
    from tickets_world import API

    _fake, env, _s = vx
    monkeypatch.setattr(wv, "direct_capabilities", lambda: caps(CONTRACT))
    assert env.c.put(f"{API}/me/prefs", json={"ui.lang": "en"}).status_code == 200
    r = env.c.get(f"{W}/visits", params={"status": "superseded"})
    assert r.status_code == 409 and r.json()["user_message"] == error_text.english(wv.REASON_HE["status_filter_not_offered"]), r.text
