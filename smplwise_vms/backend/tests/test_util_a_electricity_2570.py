"""FIX-UTIL-A-2570 (review CU2-08): editing an electricity tariff. A rename alone dropped the name and added a version with the SAME price
dated today (every later bill period crossing today split with a "price change" note). The server now refuses a version identical to the
one in force (`nothing_changed`), and a rename travels in the version request - written in the same transaction, and never by a preview
or before a refusal. The client side (a rename alone is a rename) is frontend/tests/unit-tariff-edit-2570.spec.ts. Fails on v2.56.0."""
from __future__ import annotations

import test_energy_billing_api as _base
from test_energy_billing_api import API, _versions, setup_billing

w = _base.w  # the module's own fixture, under its name


def _name(w, tid: str) -> str:
    return next(x for x in w.c.get(f"{API}/tariffs").json()["items"] if x["id"] == tid)["name"]


def test_the_same_price_as_the_version_in_force_is_not_a_new_version(w):
    s = setup_billing(w)
    tid = s["tariff"]["id"]
    r = w.c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-10-02", "price": "0.543", "price_mode": "ex_vat"})
    assert r.status_code == 409 and r.json()["code"] == "nothing_changed", r.text
    assert len(_versions(w, tid)) == 1, "no version was added"
    # a real change on a new date is still a new version
    r = w.c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-10-02", "price": "0.5500", "price_mode": "ex_vat"})
    assert r.status_code == 201, r.text
    assert len(_versions(w, tid)) == 2
    # the same price in another mode is a change too
    r = w.c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-11-01", "price": "0.5500", "price_mode": "inc_vat"})
    assert r.status_code == 201, r.text


def test_a_rename_travels_with_the_version_and_only_when_it_is_written(w):
    s = setup_billing(w)
    tid = s["tariff"]["id"]
    refused = w.c.post(f"{API}/tariffs/{tid}/versions", json={"name": "תעריף א", "effective_from": "2026-10-02", "price": "0.5430", "price_mode": "ex_vat"})
    assert refused.status_code == 409 and _name(w, tid) == "תעריף כללי", "a refused request renames nothing"
    preview = w.c.post(f"{API}/tariffs/{tid}/versions", json={"name": "תעריף א", "effective_from": "2026-01-01", "price": "0.6000", "price_mode": "ex_vat"})
    assert preview.status_code == 200 and preview.json()["applied"] is False and _name(w, tid) == "תעריף כללי", "a preview renames nothing"
    done = w.c.post(f"{API}/tariffs/{tid}/versions", json={"name": "תעריף א", "effective_from": "2026-01-01", "price": "0.6000", "price_mode": "ex_vat", "confirm": True})
    assert done.status_code == 200 and done.json()["applied"] is True and done.json()["name"] == "תעריף א"
    added = w.c.post(f"{API}/tariffs/{tid}/versions", json={"name": "תעריף ב", "effective_from": "2026-12-01", "price": "0.7000", "price_mode": "ex_vat"})
    assert added.status_code == 201 and added.json()["name"] == "תעריף ב"
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'energy.tariff.update' AND resource_id = ?", (tid,)).fetchone()[0] == 2


def test_a_rename_alone_keeps_the_versions(w):
    s = setup_billing(w)
    tid = s["tariff"]["id"]
    r = w.c.patch(f"{API}/tariffs/{tid}", json={"name": "שם חדש"})
    assert r.status_code == 200 and r.json()["name"] == "שם חדש"
    assert [v["price"] for v in _versions(w, tid)] == ["0.5430"]
