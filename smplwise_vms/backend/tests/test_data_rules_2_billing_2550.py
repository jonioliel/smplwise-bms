"""DATA-RULES-2-2550: the electricity billing rules left open by DATA-RULES-2540 (its questions 3 and 4, recommendation a). Water twins:
test_data_rules_2_water_2550.py.

- (2) the account status names the days between issued bills that no bill covers (`billing_gaps`, oldest first, `to` inclusive) - a
  warning on the account page, never inside a sealed bill. Before: nothing said so.
- (3) a draft a PERSON made on an automatic account settled the automatic pass's period as `skipped`; when the 30-day draft retention
  removes that draft, the period is reopened and the next pass makes the automatic draft. Before: the period stayed unbilled for good.
  A period an issued bill covers is skipped again - never a second bill.
Fakes only - the world of test_energy_billing_api."""
from __future__ import annotations

import datetime as dt
import json

from energy_billing_world import utc
from test_energy_billing_api import API, SEPT, W, _backdate, draft, golden_readings, issue, setup_billing, w  # noqa: F401 - `w` is the fixture

from smplwise.services import energy_billing as eb


def _status(w: W, aid: str) -> dict:
    r = w.c.get(f"{API}/accounts/{aid}/status")
    assert r.status_code == 200, r.text
    return r.json()


def _issue(w: W, aid: str, period: dict) -> dict:
    d = draft(w, aid, period)
    assert d.status_code == 201, d.text
    b = issue(w, d.json())
    assert b.status_code == 200, b.text
    return b.json()


def _later(w: W, aid: str, days: int = 31) -> dt.datetime:
    with w.db.connection(mode="read") as conn:
        written = max(r[0] for r in conn.execute("SELECT updated_at FROM energy_bills WHERE account_id = ?", (aid,)).fetchall())
    return dt.datetime.fromisoformat(written.replace("Z", "+00:00")) + dt.timedelta(days=days)


def _bills(w: W, aid: str) -> list[tuple[str, str, str]]:
    items = w.c.get(f"{API}/bills", params={"account_id": aid}).json()["items"]
    return sorted((b["period"]["from"], b["origin"], b["state"]) for b in items)


# ---------------------------------------------------------------- (2) the gap warning in the account status

def test_a_gap_between_issued_bills_is_named_in_the_account_status(w):
    golden_readings(w)
    s = setup_billing(w, auto_mode="off")
    aid = s["account"]["id"]
    _issue(w, aid, {"from": "2026-09-01", "to": "2026-09-10"})
    assert _status(w, aid)["billing_gaps"] == []  # one bill: nothing between bills
    _issue(w, aid, {"from": "2026-09-21", "to": "2026-09-30"})  # 11-20 September were never billed
    assert _status(w, aid)["billing_gaps"] == [{"from": "2026-09-11", "to": "2026-09-20"}]
    # a draft of the missing days covers them (the period is being billed): no warning
    d = draft(w, aid, {"from": "2026-09-11", "to": "2026-09-20"})
    assert d.status_code == 201, d.text
    assert _status(w, aid)["billing_gaps"] == []
    # the warning is read for the status only - nothing of it is written into a sealed bill
    with w.db.connection(mode="read") as conn:
        snaps = [r[0] for r in conn.execute("SELECT snapshot_json FROM energy_bills WHERE account_id = ? AND state != 'draft'", (aid,)).fetchall()]
    assert snaps and all("billing_gaps" not in json.loads(x) for x in snaps)


def test_a_void_bill_leaves_a_gap_and_a_partial_gap_names_its_exact_days(w):
    golden_readings(w)
    s = setup_billing(w, auto_mode="off")
    aid = s["account"]["id"]
    _issue(w, aid, {"from": "2026-09-01", "to": "2026-09-10"})
    mid = _issue(w, aid, {"from": "2026-09-11", "to": "2026-09-20"})
    _issue(w, aid, {"from": "2026-09-26", "to": "2026-09-30"})
    assert _status(w, aid)["billing_gaps"] == [{"from": "2026-09-21", "to": "2026-09-25"}]
    r = w.c.post(f"{API}/bills/{mid['id']}/void", json={"reason": "טעות"})
    assert r.status_code == 200, r.text
    assert _status(w, aid)["billing_gaps"] == [{"from": "2026-09-11", "to": "2026-09-25"}]


# ---------------------------------------------------------------- (3) a person's expired draft reopens the automatic period

def test_an_expired_human_draft_on_an_automatic_account_reopens_its_period(w):
    golden_readings(w)
    s = setup_billing(w)  # auto_mode "draft"
    aid = s["account"]["id"]
    _backdate(w, aid)
    manual = draft(w, aid, SEPT)  # a person drafts September before the automatic pass
    assert manual.status_code == 201, manual.text
    out = eb.auto_generate(w.db, now=utc(2026, 10, 2, 9))
    assert (out.created, out.skipped) == (0, 1)  # the pass found September taken
    later = _later(w, aid)
    assert eb.retention(w.db, w.settings.data_dir, now=later) == {"drafts": 1, "bills": 0}
    assert _bills(w, aid) == []
    out = eb.auto_generate(w.db, now=later)
    assert out.created >= 1  # before the fix: 0 - September stayed `skipped` and unbilled for good
    assert ("2026-09-01", "auto", "draft") in _bills(w, aid)
    with w.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'energy.bill.retention' ORDER BY id DESC LIMIT 1").fetchone()
    assert json.loads(row["details_json"])["reopened"] == 1


def test_a_reopened_period_an_issued_bill_covers_is_not_billed_twice(w):
    golden_readings(w)
    s = setup_billing(w)
    aid = s["account"]["id"]
    _backdate(w, aid)
    _issue(w, aid, {"from": "2026-09-16", "to": "2026-09-30"})  # the second half of September is issued
    manual = draft(w, aid, {"from": "2026-09-01", "to": "2026-09-15"})  # the first half is a person's draft
    assert manual.status_code == 201, manual.text
    assert eb.auto_generate(w.db, now=utc(2026, 10, 2, 9)).skipped == 1
    later = _later(w, aid)
    assert eb.retention(w.db, w.settings.data_dir, now=later)["drafts"] == 1
    out = eb.auto_generate(w.db, now=later)
    sept = [b for b in _bills(w, aid) if b[0].startswith("2026-09")]
    assert sept == [("2026-09-16", "manual", "issued")]  # no automatic September over the issued half
    assert out.skipped >= 1


def test_an_account_with_automatic_generation_off_is_not_reopened(w):
    golden_readings(w)
    s = setup_billing(w)
    aid = s["account"]["id"]
    _backdate(w, aid)
    assert draft(w, aid, SEPT).status_code == 201
    assert eb.auto_generate(w.db, now=utc(2026, 10, 2, 9)).skipped == 1
    with w.db.connection() as conn:
        conn.execute("UPDATE energy_accounts SET auto_mode = 'off' WHERE id = ?", (aid,))
    eb.retention(w.db, w.settings.data_dir, now=_later(w, aid))
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT status FROM energy_auto_runs WHERE account_id = ?", (aid,)).fetchone()["status"] == "skipped"
