"""DATA-RULES-2-2550: the water twins of the billing rules left open by DATA-RULES-2540 (questions 3 and 4) - the world of
test_water_billing_s3. (2) the account status names the days between issued water bills that no bill covers (`billing_gaps`); (3) a
person's water draft on an automatic account that the 30-day retention removes reopens its period for the automatic pass.
Fake mirror states and store samples only; no infrastructure, no device."""
from __future__ import annotations

import datetime as dt

from test_water_billing_s3 import API, NOW, account, app, setup_billing  # noqa: F401 - `app` is the fixture

from smplwise.db import Database
from smplwise.services import water_billing as wb


def _rows(settings, sql: str, *a):
    with Database(settings.db_path).connection(mode="read") as conn:
        return conn.execute(sql, a).fetchall()


def _issue(c, aid: str, frm: str, to: str, n: int) -> dict:
    r = c.post(f"{API}/accounts/{aid}/bills", json={"period": {"from": frm, "to": to}, "client_request_id": f"req-gap-{n:04d}"})
    assert r.status_code == 201, r.text
    b = r.json()
    r = c.post(f"{API}/bills/{b['id']}/issue", json={"row_version": b["row_version"], "client_request_id": f"issue-gap-{n:04d}"})
    assert r.status_code == 200, r.text
    return r.json()


def test_a_gap_between_issued_water_bills_is_named_in_the_account_status(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]})
    _issue(c, acc["id"], "2026-09-01", "2026-09-10", 1)
    assert c.get(f"{API}/accounts/{acc['id']}/status").json()["billing_gaps"] == []
    _issue(c, acc["id"], "2026-09-21", "2026-09-30", 2)
    st = c.get(f"{API}/accounts/{acc['id']}/status")
    assert st.status_code == 200, st.text
    assert st.json()["billing_gaps"] == [{"from": "2026-09-11", "to": "2026-09-20"}]


def test_an_expired_human_water_draft_on_an_automatic_account_reopens_its_period(app):
    c, settings = app
    ids = setup_billing(c, settings)
    acc = account(c, ids, "דירה 12", {"m": ids["apt"]}, auto_mode="draft")
    with Database(settings.db_path).connection() as conn:
        conn.execute("UPDATE water_accounts SET created_at = '2026-08-20T00:00:00Z' WHERE id = ?", (acc["id"],))
    r = c.post(f"{API}/accounts/{acc['id']}/bills", json={"period": {"from": "2026-09-01", "to": "2026-09-30"}, "client_request_id": "req-person-01"})
    assert r.status_code == 201, r.text
    db = Database(settings.db_path)
    assert wb.auto_generate(db, settings, now=NOW).skipped == 1  # September is taken by the person's draft
    written = _rows(settings, "SELECT updated_at FROM water_bills")[0][0]
    later = dt.datetime.fromisoformat(written.replace("Z", "+00:00")) + dt.timedelta(days=31)
    assert wb.retention(db, now=later) == {"drafts": 1, "bills": 0}
    assert _rows(settings, "SELECT 1 FROM water_auto_runs WHERE account_id = ? AND period_start = '2026-09-01'", acc["id"]) == []
    assert wb.auto_generate(db, settings, now=NOW).created == 1  # before the fix: 0 - September stayed skipped for good
    [b] = c.get(f"{API}/bills").json()["items"]
    assert (b["origin"], b["state"], b["period"]["from"]) == ("auto", "draft", "2026-09-01")
