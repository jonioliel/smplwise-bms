"""CR-BE-SMALL-2440: English names of time-of-use tariff entries (seasons, day types, bands) and of the Israeli template.

- The template carries `name_en` for every entry, and its own `name_en` / `source_en`; the English words are the glossary's
  (docs/i18n/GLOSSARY_EN.md: "time of use, band, season", "Shabbat and holidays") and agree with the frontend i18n tables wherever a
  table already translates the same Hebrew word.
- A definition may carry an optional `name_en` per entry (Latin text, up to 40 characters). A definition without one normalises and
  hashes exactly as before (definition_sha256 is sealed into bill snapshots).
- `names_en` (tariff versions, the check endpoint, the bill snapshot) and the TOU bill lines give the English names; an unchanged template
  entry saved before English names existed gets the template's, a renamed one has none (the interface shows its Hebrew name)."""
from __future__ import annotations

import copy
import re
from pathlib import Path

import pytest

from smplwise.services import energy_tou as tou
from test_energy_billing_api import API, W, w  # noqa: F401 - `w` is the shared fixture
from test_energy_tou_billing import JULY, bill, hourly, loc, setup_tou

FRONTEND_MSG = Path(__file__).resolve().parents[3] / "frontend" / "src" / "i18n" / "msg"
# CR-I18N-LAZY-LANG-2443 moved the English tables of the msg modules into the English language pack (RELEASE-2440-TRAIN).
FRONTEND_MSG_EN = Path(__file__).resolve().parents[3] / "frontend" / "src" / "i18n" / "lang" / "en" / "i18n" / "msg"
HEBREW = re.compile(r"[֐-׿]")
EXPECTED_EN = {
    "seasons": {"summer": "Summer", "winter": "Winter", "transition": "Transition"},
    "day_types": {"weekday": "Weekdays", "friday": "Fridays and holiday eves", "saturday": "Shabbat and holidays"},
    "bands": {"offpeak": "Off-peak", "peak": "Peak"},
}
PRICES = {"summer": {"offpeak": "0.5", "peak": "1.6"}, "winter": {"offpeak": "0.4", "peak": "1.2"}, "transition": {"offpeak": "0.4", "peak": "0.9"}}


def _priced(d: dict) -> dict:
    d = copy.deepcopy(d)
    d["prices"] = copy.deepcopy(PRICES)
    return d


def _without_en(d: dict) -> dict:
    d = copy.deepcopy(d)
    for kind in ("seasons", "day_types", "bands"):
        for it in d[kind]:
            it.pop("name_en", None)
    return d


def test_the_template_has_english_names():
    t = tou.israel_template()
    assert {k: {it["id"]: it["name_en"] for it in t[k]} for k in EXPECTED_EN} == EXPECTED_EN
    meta = tou.TEMPLATES["israel_household"]
    assert meta["name_en"] == "Household time of use (Israel)"
    for text in (meta["name_en"], meta["source_en"], *[it["name_en"] for k in EXPECTED_EN for it in t[k]]):
        assert not HEBREW.search(text)
    assert tou.names_en(t) == EXPECTED_EN


def _frontend_pairs() -> dict[str, set[str]]:
    """Hebrew -> English of every frontend msg table (`'עברית': 'English',` lines): the inline tables and the English pack."""
    pairs: dict[str, set[str]] = {}
    line = re.compile(r"^\s*'((?:[^'\\]|\\.)+)'\s*:\s*'((?:[^'\\]|\\.)*)',?\s*$")
    for path in [*sorted(FRONTEND_MSG.glob("*.ts")), *sorted(FRONTEND_MSG_EN.glob("*.ts"))]:
        for ln in path.read_text(encoding="utf-8").splitlines():
            m = line.match(ln)
            if m:
                pairs.setdefault(m.group(1), set()).add(m.group(2))
    return pairs


@pytest.mark.skipif(not FRONTEND_MSG.is_dir(), reason="frontend tables not in this checkout")
def test_english_names_agree_with_the_frontend_tables():
    """Where a frontend table already translates the same Hebrew text (in the time-of-use sense), the server's English is that one."""
    pairs = _frontend_pairs()
    t = tou.israel_template()
    checked = 0
    for kind in EXPECTED_EN:
        for it in t[kind]:
            known = pairs.get(it["name_he"])
            if known and it["name_he"] not in ("מעבר",):  # 'מעבר' is "Navigate" / "Passage" in other screens - another sense
                assert it["name_en"] in known, (it["name_he"], it["name_en"], known)
                checked += 1
    assert checked >= 1  # 'שבת וחג' -> 'Shabbat and holidays' (msg/automation)


def test_a_definition_without_english_names_hashes_as_before():
    plain = _priced(_without_en(tou.israel_template()))
    d = tou.parse_definition(plain)
    assert all("name_en" not in it for k in EXPECTED_EN for it in d.raw[k])
    assert d.sha256() == tou.definition_sha256(d.raw) and tou.parse_definition(d.raw).raw == d.raw
    # unchanged template entries still have English names; a renamed one has none
    assert tou.names_en(d.raw) == EXPECTED_EN and d.season_name_en("summer") == "Summer" and d.band_name_en("peak") == "Peak"
    renamed = copy.deepcopy(plain)
    renamed["bands"][1]["name_he"] = "שיא"
    d2 = tou.parse_definition(renamed)
    assert d2.band_name_en("peak") == "" and "peak" not in tou.names_en(d2.raw)["bands"]


def test_saved_english_names_round_trip_and_are_checked():
    src = _priced(tou.israel_template())
    src["bands"][1]["name_en"] = "  Evening peak "
    d = tou.parse_definition(src)
    assert d.raw["bands"][1] == {"id": "peak", "name_he": "פסגה", "name_en": "Evening peak"} and d.band_name_en("peak") == "Evening peak"
    assert tou.parse_definition(d.raw).raw == d.raw
    for bad in ("פסגה", 5, "x" * 41):
        b = copy.deepcopy(src)
        b["seasons"][0]["name_en"] = bad
        with pytest.raises(tou.TouError) as e:
            tou.parse_definition(b)
        assert e.value.code == "name_en" and e.value.path == "seasons[0].name_en"
    empty = copy.deepcopy(src)
    empty["day_types"][0]["name_en"] = ""
    assert "name_en" not in tou.parse_definition(empty).raw["day_types"][0]


def test_api_templates_check_and_versions(w):
    c = w.c
    tpl = c.get(f"{API}/tou/templates").json()["items"][0]
    assert tpl["name_en"] == "Household time of use (Israel)" and "not verified" in tpl["source_en"] and "לא אומת" in tpl["source_he"]
    ok = c.post(f"{API}/tou/check", json={"definition": _priced(tou.israel_template())}).json()
    assert ok["ok"] is True and ok["names_en"] == EXPECTED_EN
    t = c.post(f"{API}/tariffs", json={"name": "ישן", "kind": "tou", "definition": _priced(_without_en(tou.israel_template())),
                                       "price_mode": "ex_vat", "effective_from": "2026-01-01"})
    assert t.status_code == 201, t.text
    v = t.json()["versions"][0]
    assert "name_en" not in v["definition"]["bands"][0] and v["names_en"] == EXPECTED_EN


def test_tou_bill_lines_and_snapshot_carry_english_names(w):
    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 8, 2))
    s = setup_tou(w)
    b = bill(w, s["account"]["id"], *JULY)
    snap = b["snapshot"]
    peak = snap["lines"][1]
    assert peak["band"] == {"id": "peak", "name_he": "פסגה", "name_en": "Peak"} and peak["season"]["name_en"] == "Summer"
    assert snap["tou"]["names"]["bands"] == {"offpeak": "שפל", "peak": "פסגה"}  # the Hebrew map as before
    assert snap["tou"]["names_en"]["bands"] == {"offpeak": "Off-peak", "peak": "Peak"}
