"""ELECBILL77: the electricity bill draft notification, the live bills state (ETag / revision) and the rate limits of recalculation and PDF.
Fakes only (readings store, clock, PDF renderer) - the world of test_energy_billing_api."""
from __future__ import annotations

import json
import threading
import types

import pytest
from conftest import as_user, bind
from energy_billing_world import utc
from test_energy_billing_api import API, SEPT, W, _backdate, draft, golden_readings, issue, setup_billing, w  # noqa: F401 - `w` is the fixture

from smplwise.errors import ApiError
from smplwise.services import energy_billing as eb
from smplwise.services import energy_limits as limits
from smplwise.services import energy_notify, notify_policy
from smplwise.services.notify_visibility import Reach, principal_of

SOURCE = "energy.bill_draft"
AUTO_NOW = utc(2026, 10, 2, 9)  # September ended 2.10 03:00 local ago; the default delay is 6 hours


def _notes(w: W) -> list:
    with w.db.connection(mode="read") as conn:
        return conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY first_at", (SOURCE,)).fetchall()


def _recipients(w: W, nid: str) -> set[str]:
    with w.db.connection(mode="read") as conn:
        return {r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchall()}


def _auto_world(w: W, auto_mode: str = "draft") -> dict:
    golden_readings(w)
    s = setup_billing(w, auto_mode=auto_mode)
    _backdate(w, s["account"]["id"])
    return s


def _revision(w: W) -> str:
    return w.c.get(f"{API}/bills/state").json()["revision"]


# ---------------------------------------------------------------- the notification

def test_an_automatic_draft_notifies_the_bill_holders_once_per_draft(w):
    s = _auto_world(w)
    assert eb.auto_generate(w.db, now=AUTO_NOW).created == 1
    notes = _notes(w)
    assert len(notes) == 1
    n = notes[0]
    bill = w.c.get(f"{API}/bills", params={"account_id": s["account"]["id"]}).json()["items"][0]
    assert (n["subject_kind"], n["subject_id"], n["severity"], n["category"]) == ("energy_bills", bill["id"], "info", "system")
    assert n["dedupe_key"] == f"{SOURCE}:{bill['id']}" and n["link"] == f"#/infra/electricity/bills/{bill['id']}"
    assert _recipients(w, n["id"]) == {"dev-joni"}
    # a second pass, a restart and a later pass create no second row
    assert eb.auto_generate(w.db, now=AUTO_NOW).created == 0
    assert eb.auto_generate(w.db, now=utc(2026, 10, 2, 9, 5)).created == 0
    assert len(_notes(w)) == 1


def test_the_text_is_the_period_only_never_money_a_customer_or_an_account(w):
    s = _auto_world(w)
    eb.auto_generate(w.db, now=AUTO_NOW)
    n = _notes(w)[0]
    text = json.dumps([n["title"], n["body"], n["params_json"], n["place"]], ensure_ascii=False)
    assert "09/2026" in n["body"]
    bill = w.c.get(f"{API}/bills", params={"account_id": s["account"]["id"]}).json()["items"][0]
    full = w.c.get(f"{API}/bills/{bill['id']}").json()
    for secret in (full["total"], "497", "421", "776", s["customer"]["name"], s["account"]["name"], "test@example.invalid", "רחוב בדיקה"):
        assert secret not in text, secret


def test_several_accounts_make_one_row_each_and_none_mentions_the_others(w):
    s = _auto_world(w)
    from test_energy_billing_api import add_account

    second = add_account(w, s["customer"]["id"], s["tariff"]["id"])
    _backdate(w, second["id"])
    assert eb.auto_generate(w.db, now=AUTO_NOW).created == 2
    notes = _notes(w)
    assert len(notes) == 2 and len({n["subject_id"] for n in notes}) == 2
    assert all(n["body"] == notes[0]["body"] for n in notes)  # identical text: the period


def test_manual_recalculated_and_corrected_bills_notify_nobody(w):
    s = _auto_world(w)
    d = draft(w, s["account"]["id"], SEPT).json()  # a person made it: they know
    r = w.c.post(f"{API}/bills/{d['id']}/recalculate", json={"row_version": d["row_version"]})
    assert r.status_code == 200
    b = issue(w, r.json()).json()
    corr = w.c.post(f"{API}/bills/{b['id']}/correct", json={"client_request_id": "c" * 32})
    assert corr.status_code == 201
    assert _notes(w) == []


def test_an_auto_issued_bill_is_not_a_draft_waiting_for_review(w):
    _auto_world(w, auto_mode="issue")
    out = eb.auto_generate(w.db, now=AUTO_NOW)
    assert (out.created, out.issued) == (1, 1)
    assert _notes(w) == []


def test_an_edited_auto_draft_does_not_notify_again(w):
    s = _auto_world(w)
    eb.auto_generate(w.db, now=AUTO_NOW)
    bill = w.c.get(f"{API}/bills", params={"account_id": s["account"]["id"]}).json()["items"][0]
    row_version = bill["row_version"]
    for _ in range(2):
        r = w.c.post(f"{API}/bills/{bill['id']}/recalculate", json={"row_version": row_version})
        assert r.status_code == 200
        row_version = r.json()["row_version"]
    assert len(_notes(w)) == 1


def test_module_off_no_billing_account_no_notification_and_no_listed_source(w):
    with w.db.connection() as conn:
        assert energy_notify.listed(conn) is False
        assert SOURCE not in {p["source"] for p in notify_policy.list_policies(conn)}
        assert energy_notify.draft_ready(conn, "b" * 16, utc(2026, 9, 1).date(), utc(2026, 10, 1).date()) is None
    assert _notes(w) == []
    # with an account the source is listed, WhatsApp off and the phone app on by default
    setup_billing(w)
    with w.db.connection() as conn:
        pol = {p["source"]: p for p in notify_policy.list_policies(conn)}[SOURCE]
    assert pol["channels"]["whatsapp"] is False and pol["channels"]["app"] is True and pol["recipients"] == {"rule": "energy_bills"}


def test_bills_off_an_account_without_automatic_generation_notifies_nobody(w):
    _auto_world(w, auto_mode="off")
    assert eb.auto_generate(w.db, now=AUTO_NOW).created == 0
    assert _notes(w) == []


def test_the_policy_switch_off_stops_the_notice_but_not_the_draft(w):
    _auto_world(w)
    with w.db.connection() as conn:
        notify_policy.ensure_defaults(conn)
        conn.execute("UPDATE notify_policies SET enabled = 0 WHERE source = ?", (SOURCE,))
    assert eb.auto_generate(w.db, now=AUTO_NOW).created == 1
    assert _notes(w) == []


def test_only_holders_of_energy_bills_receive_it_and_can_see_it(w):
    _auto_world(w)
    bind(w.c, w.settings, "op", "operator", "installation", "*")  # energy.view, not energy.bills
    eb.auto_generate(w.db, now=AUTO_NOW)
    n = _notes(w)[0]
    assert _recipients(w, n["id"]) == {"dev-joni"}
    note = {"subject_kind": "energy_bills", "subject_id": n["subject_id"], "origin_json": "{}", "source": SOURCE}
    with w.db.connection(mode="read") as conn:
        assert Reach(conn, principal_of(conn, "dev-op")).can_see(note) is False
        assert Reach(conn, principal_of(conn, "dev-joni")).can_see(note) is True
    inbox = w.c.get(f"{API.replace('/energy', '')}/notifications", headers=as_user("op"))
    assert inbox.status_code == 200 and SOURCE not in json.dumps(inbox.json())


# ---------------------------------------------------------------- the live state

def test_state_has_an_etag_and_answers_304_to_a_matching_poll(w):
    s = _auto_world(w)
    first = w.c.get(f"{API}/bills/state")
    assert first.status_code == 200
    body = first.json()
    assert body["counts"] == {"draft": 0, "issued": 0, "sent": 0, "paid": 0, "void": 0}
    assert first.headers["etag"] == f'"{body["revision"]}"' and first.headers["cache-control"] == "private, no-cache"
    again = w.c.get(f"{API}/bills/state", headers={"If-None-Match": first.headers["etag"]})
    assert again.status_code == 304 and again.content == b"" and again.headers["etag"] == first.headers["etag"]
    assert w.c.get(f"{API}/bills/state", headers={"If-None-Match": "*"}).status_code == 304
    assert w.c.get(f"{API}/bills/state", headers={"If-None-Match": f'"x", W/{first.headers["etag"]}'}).status_code == 304
    assert w.c.get(f"{API}/bills/state", headers={"If-None-Match": '"stale"'}).status_code == 200
    assert s  # the account exists; nothing changed since


def test_the_revision_moves_with_every_kind_of_change_and_only_then(w):
    s = _auto_world(w)
    seen = [_revision(w)]
    assert _revision(w) == seen[0]  # reading changes nothing

    def moved(step: str) -> None:
        rev = _revision(w)
        assert rev != seen[-1], step
        seen.append(rev)

    out = eb.auto_generate(w.db, now=AUTO_NOW)
    assert out.created == 1
    moved("automatic draft")
    st = w.c.get(f"{API}/bills/state").json()
    assert st["counts"]["draft"] == 1 and st["auto"]["runs"]["created"] == 1 and st["auto"]["last_run_at"]
    bill = w.c.get(f"{API}/bills", params={"account_id": s["account"]["id"]}).json()["items"][0]
    r = w.c.post(f"{API}/bills/{bill['id']}/recalculate", json={"row_version": bill["row_version"]}).json()
    moved("recalculate")
    issued = issue(w, r).json()
    moved("issue")
    assert w.c.post(f"{API}/bills/{issued['id']}/sent", json={"how": "email", "note": "", "row_version": issued["row_version"]}).status_code == 200
    moved("sent")
    assert w.c.get(f"{API}/bills/{issued['id']}/pdf").status_code == 200
    moved("stored pdf")
    assert w.c.get(f"{API}/bills/state").json()["counts"] == {"draft": 0, "issued": 0, "sent": 1, "paid": 0, "void": 0}
    w.c.get(f"{API}/bills", params={"state": "sent"})
    assert _revision(w) == seen[-1]


def test_a_failed_automatic_run_is_visible_in_the_state(w):
    _auto_world(w)
    with w.db.connection() as conn:
        conn.execute("DELETE FROM energy_vat_rates")
    before = _revision(w)
    assert eb.auto_generate(w.db, now=AUTO_NOW).failed == 1
    st = w.c.get(f"{API}/bills/state").json()
    assert st["auto"]["runs"]["failed"] == 1 and st["auto"]["failed_waiting_retry"] == 1 and st["revision"] != before


def test_the_list_carries_the_same_revision_and_the_state_needs_energy_bills(w):
    _auto_world(w)
    assert w.c.get(f"{API}/bills").json()["revision"] == _revision(w)
    bind(w.c, w.settings, "op", "operator", "installation", "*")
    r = w.c.get(f"{API}/bills/state", headers=as_user("op"))
    assert r.status_code == 403 and r.headers.get("etag") is None
    blob = json.dumps(w.c.get(f"{API}/bills/state").json())
    assert "total" not in blob and "amount" not in blob  # counts and times only


# ---------------------------------------------------------------- rate limits

def _fresh_draft(w: W) -> dict:
    golden_readings(w)
    s = setup_billing(w)
    return draft(w, s["account"]["id"], SEPT).json()


def _recalc(w: W, bill: dict):
    return w.c.post(f"{API}/bills/{bill['id']}/recalculate", json={"row_version": bill["row_version"]})


def test_recalculate_is_limited_per_user_with_the_429_shape(w, monkeypatch):
    monkeypatch.setattr(limits, "RECOMPUTE_PER_USER", 2)
    bill = _fresh_draft(w)
    for _ in range(2):
        r = _recalc(w, bill)
        assert r.status_code == 200
        bill = r.json()
    r = _recalc(w, bill)
    assert r.status_code == 429
    body = r.json()
    assert set(body) == {"code", "user_message", "retryable", "correlation_id", "details"}
    assert body["code"] == "rate_limited" and body["retryable"] is True and body["details"]["scope"] == "user" and 1 <= body["details"]["retry_after_s"] <= 61
    # nothing was computed or stored for the refused call
    assert w.c.get(f"{API}/bills/{bill['id']}").json()["row_version"] == bill["row_version"]


def test_recalculate_is_limited_for_the_whole_installation(w, monkeypatch):
    monkeypatch.setattr(limits, "RECOMPUTE_TOTAL", 1)
    bill = _fresh_draft(w)
    assert _recalc(w, bill).status_code == 200
    r = _recalc(w, bill)
    assert r.status_code == 429 and r.json()["details"]["scope"] == "installation"


def test_a_refusal_for_a_non_draft_is_not_counted_against_the_budget(w, monkeypatch):
    monkeypatch.setattr(limits, "RECOMPUTE_PER_USER", 1)
    issued = issue(w, _fresh_draft(w)).json()
    for _ in range(3):  # decided before the limiter: never a 429
        r = _recalc(w, issued)
        assert r.status_code == 409 and r.json()["code"] == "bill_not_draft"


def test_a_repeated_click_while_the_first_recalculation_runs_is_refused(w, monkeypatch):
    bill = _fresh_draft(w)
    real = eb.compute
    inner: dict = {}

    def slow(*a, **k):
        if not inner:  # the first computation: click again from another thread while it is still running
            def again() -> None:
                inner["r"] = _recalc(w, bill)

            t = threading.Thread(target=again)
            t.start()
            t.join(timeout=20)
        return real(*a, **k)

    monkeypatch.setattr(eb, "compute", slow)
    first = _recalc(w, bill)
    assert first.status_code == 200
    second = inner["r"]
    assert second.status_code == 429 and second.json()["code"] == "recompute_in_progress"
    assert second.json()["retryable"] is True and second.json()["details"]["scope"] == "bill"
    # released afterwards: the next click works
    assert _recalc(w, first.json()).status_code == 200


def test_the_in_flight_guard_is_released_on_error_and_is_per_bill():
    app = types.SimpleNamespace(state=types.SimpleNamespace())
    with limits.recompute(app, "u", "bill-a"):
        with pytest.raises(ApiError) as e:
            with limits.recompute(app, "u", "bill-a"):
                pass
        assert e.value.status == 429 and e.value.code == "recompute_in_progress"
        with limits.recompute(app, "v", "bill-b"):  # another bill is independent
            pass
    with pytest.raises(RuntimeError):
        with limits.recompute(app, "u", "bill-a"):
            raise RuntimeError("boom")
    with limits.recompute(app, "u", "bill-a"):  # released by the error
        pass


def test_the_limiter_window_slides():
    lim = limits.ScopedLimiter(2, 5, 60.0)
    assert lim.take("a", now=0) == (0, None) and lim.take("a", now=1) == (0, None)
    wait, scope = lim.take("a", now=2)
    assert scope == "user" and 55 <= wait <= 60
    assert lim.take("a", now=61) == (0, None)  # the first one slid out


def test_pdf_renders_are_limited_but_a_stored_pdf_is_free(w, monkeypatch):
    monkeypatch.setattr(limits, "PDF_PER_USER", 2)
    bill = _fresh_draft(w)
    assert w.c.get(f"{API}/bills/{bill['id']}/pdf").status_code == 200
    assert w.c.get(f"{API}/bills/{bill['id']}/pdf").status_code == 200
    r = w.c.get(f"{API}/bills/{bill['id']}/pdf")
    assert r.status_code == 429
    body = r.json()
    assert body["code"] == "rate_limited" and body["retryable"] is True and body["details"]["scope"] == "user" and body["details"]["retry_after_s"] >= 1
    assert set(body) == {"code", "user_message", "retryable", "correlation_id", "details"}


def test_a_stored_issued_pdf_never_counts(w, monkeypatch):
    monkeypatch.setattr(limits, "PDF_PER_USER", 1)
    b = issue(w, _fresh_draft(w)).json()
    assert w.c.get(f"{API}/bills/{b['id']}/pdf").status_code == 200  # the one render, stored now
    for _ in range(4):
        assert w.c.get(f"{API}/bills/{b['id']}/pdf").status_code == 200  # served from the file


def test_pdf_is_limited_for_the_whole_installation(w, monkeypatch):
    monkeypatch.setattr(limits, "PDF_TOTAL", 1)
    bill = _fresh_draft(w)
    assert w.c.get(f"{API}/bills/{bill['id']}/pdf").status_code == 200
    r = w.c.get(f"{API}/bills/{bill['id']}/pdf")
    assert r.status_code == 429 and r.json()["details"]["scope"] == "installation"
