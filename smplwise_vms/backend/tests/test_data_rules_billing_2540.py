"""DATA-RULES-2540: the electricity billing data rules of the 2.52 deep review (the water twins: test_data_rules_water_2540.py).

- D-01: a billing-cycle change after bills were issued starts the new cycle where the last issued bill ends (before: the periods were
  re-laid from the account's first start, the one overlapping the last bill was skipped for good and the days up to the next new boundary
  were in no bill, silently). An explicit other start is refused (`cycle_start_mismatch`), and so is a change while a draft is open
  (`cycle_change_open_draft`). An account without issued bills changes as before.
- D-05: an automatic draft nobody reviewed is no longer deleted by the 30-day draft retention (its run row settles the period, so the period
  was lost for good); only the retention years remove it. A draft a person made still goes after 30 days, as before.
Fakes only - the world of test_energy_billing_api."""
from __future__ import annotations

import datetime as dt

from energy_billing_world import utc
from test_energy_billing_api import API, SEPT, W, _backdate, draft, golden_readings, issue, setup_billing, w  # noqa: F401 - `w` is the fixture

from smplwise.services import bill_ledger as bl
from smplwise.services import energy_billing as eb


def _patch(w: W, aid: str, **fields):
    acc = w.c.get(f"{API}/accounts/{aid}").json()
    return w.c.patch(f"{API}/accounts/{aid}", json={"base_revision": acc["revision"], **fields})


def _due(w: W, aid: str, now: dt.datetime) -> list[tuple[str, str]]:
    with w.db.connection(mode="read") as conn:
        acc = conn.execute("SELECT * FROM energy_accounts WHERE id = ?", (aid,)).fetchone()
        return [(p.start.isoformat(), p.end.isoformat()) for p in bl.due_periods(eb.KIND, conn, acc, now, dt.timedelta(hours=6), 12)]


def _issued_sept(w: W) -> dict:
    golden_readings(w)
    s = setup_billing(w)
    _backdate(w, s["account"]["id"])
    b = issue(w, draft(w, s["account"]["id"], SEPT).json())
    assert b.status_code == 200, b.text
    return s


# ---------------------------------------------------------------- D-01

def test_a_cycle_change_after_an_issued_bill_starts_where_the_last_bill_ended(w):
    s = _issued_sept(w)
    aid = s["account"]["id"]
    r = _patch(w, aid, period_anchor_day=15, first_period_start="2026-09-01")  # the screen sends the whole form back: the start unchanged
    assert r.status_code == 200, r.text
    acc = r.json()
    assert acc["first_period_start"] == "2026-10-01" and acc["period_anchor_day"] == 15
    assert acc["next_period"] == {"from": "2026-10-01", "to": "2026-10-14"}  # a partial first period up to the new boundary
    # every day after the issued September is in exactly one future period: no gap, no overlap
    due = _due(w, aid, utc(2026, 12, 20, 9))
    assert due[0] == ("2026-10-01", "2026-10-15") and all(a[1] == b[0] for a, b in zip(due, due[1:]))
    with w.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'energy.account.update' ORDER BY id DESC LIMIT 1").fetchone()
    assert "first_period_start" in row["details_json"]


def test_an_explicit_other_start_and_an_open_draft_are_refused_with_a_clear_code(w):
    s = _issued_sept(w)
    aid = s["account"]["id"]
    r = _patch(w, aid, period_anchor_day=15, first_period_start="2026-10-05")
    assert r.status_code == 409 and r.json()["code"] == "cycle_start_mismatch"
    assert r.json()["details"]["last_billed_end"] == "2026-10-01"
    r = _patch(w, aid, first_period_start="2026-09-15")  # an earlier start would overlap the issued bill
    assert r.status_code == 409 and r.json()["code"] == "cycle_start_mismatch"
    assert _patch(w, aid, period_anchor_day=15, first_period_start="2026-10-01").status_code == 200  # the right start, named explicitly
    oct_draft = draft(w, aid, {"from": "2026-10-01", "to": "2026-10-14"})
    assert oct_draft.status_code == 201, oct_draft.text
    r = _patch(w, aid, period_anchor_day=1)
    assert r.status_code == 409 and r.json()["code"] == "cycle_change_open_draft" and r.json()["details"]["bill_id"] == oct_draft.json()["id"]
    assert w.c.get(f"{API}/accounts/{aid}").json()["period_anchor_day"] == 15  # nothing changed
    # other fields still change freely while the draft is open
    assert _patch(w, aid, name="שם חדש").status_code == 200


def test_an_account_without_issued_bills_changes_its_cycle_as_before(w):
    golden_readings(w)
    s = setup_billing(w)
    aid = s["account"]["id"]
    r = _patch(w, aid, period_anchor_day=15, first_period_start="2026-08-15")
    assert r.status_code == 200 and r.json()["first_period_start"] == "2026-08-15"


def test_the_anchor_month_of_a_monthly_cycle_is_not_a_change(w):
    s = _issued_sept(w)
    aid = s["account"]["id"]
    r = _patch(w, aid, period_anchor_month=5)
    assert r.status_code == 200 and r.json()["first_period_start"] == "2026-09-01"


# ---------------------------------------------------------------- D-05

def test_an_unreviewed_automatic_draft_survives_the_draft_retention(w):
    golden_readings(w)
    s = setup_billing(w)
    aid = s["account"]["id"]
    _backdate(w, aid)
    assert eb.auto_generate(w.db, now=utc(2026, 10, 2, 9)).created == 1
    manual = draft(w, aid, {"from": "2026-10-01", "to": "2026-10-31"}).json()  # a draft a person made: it still expires
    with w.db.connection(mode="read") as conn:
        written = max(r[0] for r in conn.execute("SELECT updated_at FROM energy_bills WHERE account_id = ?", (aid,)).fetchall())
    later = dt.datetime.fromisoformat(written.replace("Z", "+00:00")) + dt.timedelta(days=31)
    assert eb.retention(w.db, w.settings.data_dir, now=later) == {"drafts": 1, "bills": 0}
    left = w.c.get(f"{API}/bills", params={"account_id": aid}).json()["items"]
    assert [(b["origin"], b["state"], b["period"]["from"]) for b in left] == [("auto", "draft", "2026-09-01")]
    assert manual["id"] not in {b["id"] for b in left}
    # it can still be issued months later; the retention years remove an automatic draft like any document
    assert eb.retention(w.db, w.settings.data_dir, now=later + dt.timedelta(days=300))["drafts"] == 0
    assert eb.retention(w.db, w.settings.data_dir, now=utc(2034, 1, 1))["drafts"] == 1
