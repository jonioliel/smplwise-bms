"""TEMPREP-295: the temperature report dialog - the compliance (HACCP) report against the regular one (same data source, same range, honest
empty state, installation-zone day edges) and the new "every sample" option (off by default, both layouts, the size guard, the digest).
Fakes only: the report fixture's two units, a fake PDF renderer, no PDF engine, no network."""
from __future__ import annotations

import datetime as dt

import pytest
from test_infra_temperature_report import API, T0, UTC, app  # noqa: F401 - `app` is the fixture

from smplwise.services import temperature as t
from smplwise.services import temperature_pdf, temperature_report as rep

Q = f"range=custom&from={dt.datetime.fromtimestamp(T0 - 3600, UTC):%Y-%m-%dT%H:%M:%SZ}&to={dt.datetime.fromtimestamp(T0 + 3 * 3600, UTC):%Y-%m-%dT%H:%M:%SZ}"
SEPT = "range=custom&from=2026-09-01T00:00&to=2026-10-01T00:00"  # the previous month, written as the dialog's inputs hold it (no offset)


def prev(c, u, layout="standard", extra="", q=Q):
    r = c.get(f"{API}/report/preview?units={u}&{q}&layout={layout}{extra}")
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- regular and compliance: one data source, one range

def test_regular_and_compliance_read_the_same_samples(app):
    c, u1 = app["c"], app["u1"]
    std, hac = prev(c, u1), prev(c, u1, "haccp")
    assert std["layout"] == "standard" and hac["layout"] == "haccp"
    assert std["units"][0]["stats"] == hac["units"][0]["stats"] and std["from"] == hac["from"] and std["to"] == hac["to"]
    assert "daily" not in std["units"][0] and hac["units"][0]["daily"][0]["verdict"] == "exc"  # the 7.0 degree minutes: out of the 2-6 band
    assert std["units"][0]["has_data"] is True and hac["units"][0]["has_data"] is True
    page = rep.html_of(hac)
    assert "sha256" in page and "שם המנהל" in page and "חתימת מנהל" in page and "data-nodata" not in page


def test_switching_the_type_back_and_forth_is_a_pure_function_of_the_params(app):
    c, u1 = app["c"], app["u1"]
    a1, h1, a2, h2 = (prev(c, u1, lay) for lay in ("standard", "haccp", "standard", "haccp"))
    assert a1["digest"] == a2["digest"] and h1["digest"] == h2["digest"] and a1["digest"] != h1["digest"]
    assert [x["layout"] for x in (a1, h1, a2, h2)] == ["standard", "haccp", "standard", "haccp"]


def test_a_range_without_data_is_an_honest_empty_report(app):
    c, u1 = app["c"], app["u1"]
    for layout in ("standard", "haccp"):
        m = prev(c, u1, layout, q=SEPT)
        u = m["units"][0]
        assert u["has_data"] is False and u["stats"]["min"] is None and u["stats"]["avg"] is None
        page = rep.html_of(m)
        assert "data-nodata" in page and "אין נתונים בטווח הזה" in page and "sha256" in page and "חתימת מנהל" in page
    h = prev(c, u1, "haccp", q=SEPT)["units"][0]["daily"]
    assert len(h) == 30 and {d["verdict"] for d in h} == {"none"} and h[0]["day"] == "2026-09-01" and h[-1]["day"] == "2026-09-30"
    assert "אין נתונים" in rep.html_of(prev(c, u1, "haccp", q=SEPT))  # the daily table still says so day by day


def test_a_custom_range_without_an_offset_is_the_installation_zone(app):
    c, u1 = app["c"], app["u1"]
    m = prev(c, u1, "haccp", q="range=custom&from=2026-10-19T00:00&to=2026-10-21T00:00")
    assert m["from"] == int(dt.datetime(2026, 10, 18, 21, tzinfo=UTC).timestamp())  # Asia/Jerusalem is UTC+3 until 25.10.2026
    assert [d["day"] for d in m["units"][0]["daily"]] == ["2026-10-19", "2026-10-20"]
    z = prev(c, u1, q="range=custom&from=2026-10-19T00:00:00Z&to=2026-10-20T00:00:00Z")  # an explicit instant stays an instant
    assert z["from"] == int(dt.datetime(2026, 10, 19, tzinfo=UTC).timestamp())
    assert c.get(f"{API}/report/preview?units={u1}&range=custom&from=2026-10-20T00:00&to=2026-10-19T00:00").status_code == 422


# ---------------------------------------------------------------- every sample

def test_samples_off_by_default_and_on_for_both_layouts(app):
    c, u1 = app["c"], app["u1"]
    for layout in ("standard", "haccp"):
        off = prev(c, u1, layout)
        assert off["samples"] is False and "samples" not in off["units"][0] and "data-samples" not in rep.html_of(off)
        on = prev(c, u1, layout, "&samples=1")
        sm = on["units"][0]["samples"]
        assert on["samples"] is True and sm["total"] == 4 and sm["shown"] == 4 and sm["capped"] is False
        assert [r[1] for r in sm["rows"]] == [4.0, 7.0, 7.0, 5.0] and [r[0] for r in sm["rows"]] == sorted(r[0] for r in sm["rows"])
        assert [bool(r[2] & rep.SF_OUT) for r in sm["rows"]] == [False, True, True, False]
        assert on["digest"] != off["digest"]
        page = rep.html_of(on)
        assert "data-samples" in page and "פירוט כל הדגימות" in page and "מחוץ לטווח" in page and "sha256" in page and "חתימת מנהל" in page
        assert "19.10.2026 10:00" in page and "19.10.2026 07:00" not in page  # the installation's local time, not UTC
    en = rep.html_of(prev(c, u1, "standard", "&samples=1&lang=en"))
    assert "Every sample" in en and "Out of range" in en and "°C" in en


def test_samples_empty_range_and_the_other_unit(app):
    c, u1, u2 = app["c"], app["u1"], app["u2"]
    m = prev(c, f"{u1},{u2}", "standard", "&samples=1", q=SEPT)
    assert all(u["samples"] == {"rows": [], "total": 0, "shown": 0, "capped": False, "cap": rep.SAMPLES_MAX_ROWS // 2} for u in m["units"])
    assert "אין דגימות בטווח" in rep.html_of(m)
    assert prev(c, u2, "standard", "&samples=1")["units"][0]["samples"]["total"] == 4  # the evaluator samples every unit each minute


def test_samples_flags_defrost_off_door_and_alert(app):
    c, db, u1 = app["c"], app["db"], app["u1"]
    base = int(T0 + 3600)
    with db.connection() as conn:
        t.record_sample(conn, u1, base, 9.0, 1)        # defrost: out of the band but not counted out
        t.record_sample(conn, u1, base + 60, 9.0, 4)   # a climate unit switched off: never out of range
        t.record_sample(conn, u1, base + 120, 4.0, 2)  # the door flag
        u = conn.execute("SELECT * FROM infra_temp_units WHERE id = ?", (u1,)).fetchone()
        rules = t.effective(t.load_defaults(conn), t.overrides_of(u["rules_json"]))
        seen = rep.sample_rows(conn, u, rules, base - 1, base + 600, T0 + 7200, True, 100)["rows"]
        hidden = rep.sample_rows(conn, u, rules, base - 1, base + 600, T0 + 7200, False, 100)["rows"]
    assert [r[2] & (rep.SF_DEFROST | rep.SF_OFF | rep.SF_DOOR | rep.SF_OUT) for r in seen] == [rep.SF_DEFROST, rep.SF_OFF, rep.SF_DOOR]
    assert hidden[2][2] & rep.SF_DOOR == 0  # a viewer who does not see the door sensor never learns the door state
    alert = prev(c, u1, "standard", "&samples=1")["units"][0]["samples"]["rows"]
    assert alert[1][2] & rep.SF_ALERT and alert[2][2] & rep.SF_ALERT and not alert[0][2] & rep.SF_ALERT  # the high alert opened at the first 7.0


def test_samples_size_guard_caps_rows_counts_the_rest_and_keeps_one_digest(app):
    c, db, u1, u2 = app["c"], app["db"], app["u1"], app["u2"]
    start = int(dt.datetime(2026, 10, 10, tzinfo=UTC).timestamp())
    n = rep.SAMPLES_MAX_ROWS + 300
    with db.connection() as conn:
        for i in range(n):
            t.record_sample(conn, u1, start + i * 60, 4.0 + (i % 3) * 0.1, 0)
        for i in range(10):
            t.record_sample(conn, u2, start + i * 60, -18.0, 0)
    q = f"range=custom&from={dt.datetime.fromtimestamp(start - 60, UTC):%Y-%m-%dT%H:%M:%SZ}&to={dt.datetime.fromtimestamp(start + (n + 5) * 60, UTC):%Y-%m-%dT%H:%M:%SZ}"
    seen: dict = {}

    def fake(model):
        seen["m"] = model
        return b"%PDF-1.7 fake"

    temperature_pdf.set_renderer(fake)
    r = c.get(f"{API}/report.pdf?units={u1}&{q}&samples=1")
    assert r.status_code == 200
    full = seen["m"]["units"][0]["samples"]
    assert full["total"] == n and full["shown"] == rep.SAMPLES_MAX_ROWS and len(full["rows"]) == rep.SAMPLES_MAX_ROWS and full["capped"] is True
    page = rep.html_of(seen["m"])
    assert f"{rep.SAMPLES_MAX_ROWS} הדגימות הראשונות מתוך {n}" in page and "data-samples-cap" in page
    assert page.count("<tr") < rep.SAMPLES_MAX_ROWS + 400  # a row each, nothing duplicated
    pre = c.get(f"{API}/report/preview?units={u1}&{q}&samples=1").json()  # the dialog: a few rows, the true counts, the PDF's digest
    sm = pre["units"][0]["samples"]
    assert len(sm["rows"]) == rep.SAMPLES_PREVIEW_ROWS and sm["total"] == n and sm["capped"] is True
    assert pre["digest"] == r.headers["x-report-digest"] == seen["m"]["digest"]
    # several units share the cap evenly (never below the floor); a small unit is not capped
    two = c.get(f"{API}/report/preview?units={u1},{u2}&{q}&samples=1").json()["units"]
    assert two[0]["samples"]["cap"] == two[1]["samples"]["cap"] == rep.SAMPLES_MAX_ROWS // 2
    assert two[0]["samples"]["shown"] == rep.SAMPLES_MAX_ROWS // 2 and two[1]["samples"]["capped"] is False and two[1]["samples"]["total"] == 10


def test_samples_older_than_the_raw_history_are_five_minute_averages(app):
    c, u1, clock = app["c"], app["u1"], app["clock"]
    clock["ts"] = T0 + 40 * 86400
    sm = prev(c, u1, "standard", "&samples=1")["units"][0]["samples"]
    assert sm["total"] >= 1 and all(r[2] & rep.SF_AVG for r in sm["rows"])
    assert "5 דק׳" in rep.html_of(prev(c, u1, "standard", "&samples=1"))


def test_pdf_route_takes_the_samples_switch_for_the_compliance_type(app):
    c, u1 = app["c"], app["u1"]
    seen: dict = {}

    def fake(model):
        seen["m"] = model
        return b"%PDF-1.7 fake"

    temperature_pdf.set_renderer(fake)
    assert c.get(f"{API}/report.pdf?units={u1}&{Q}&layout=haccp&samples=1").status_code == 200
    m = seen["m"]
    assert m["layout"] == "haccp" and m["samples"] is True and m["signature"] == {"mode": "line"} and m["units"][0]["daily"] and m["units"][0]["samples"]["total"] == 4
    assert c.get(f"{API}/report.pdf?units={u1}&{Q}&samples=2").status_code == 422


def test_fallback_engine_lists_the_samples_and_the_empty_note(app):
    pytest.importorskip("fpdf")
    from smplwise.services import temperature_pdf_engine as eng

    c, u1 = app["c"], app["u1"]
    for q in (Q, SEPT):
        out = eng.render_fpdf2(prev(c, u1, "haccp", "&samples=1", q=q))
        assert out.startswith(b"%PDF-")
