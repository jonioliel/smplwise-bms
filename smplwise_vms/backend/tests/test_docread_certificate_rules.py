"""SUPPLIERDOCS-297 (docs/changes/CR-SUPPLIERDOCS-297.md): the deterministic rule-based extractor for text-layer certificate PDFs.

Every document text here is SYNTHETIC (invented suppliers, numbers and dates; nothing copied from private-evidence). The text is
what a text layer yields (`pdftotext -layout`): Hebrew in logical order, RTL lines whose label may sit to the right of the value,
English certificates, and one Hebrew certificate stored in visual order. Negative first: nothing found is `none`, never a guess."""
from __future__ import annotations

import pytest

from smplwise.services.docread import certificate_rules as cr
from smplwise.services.docread import ports

FIELDS = ("supplier", "document_number", "issue_date", "expiry_date", "scope")

HE_INSURANCE = """
                         אישור עריכת ביטוח
שם המבוטח: מעליות הדוגמה בע"מ ח.פ. 512345678
מספר פוליסה: 7700-123456
תאריך הנפקה: 05/01/2026
בתוקף עד: 31/12/2026
היקף הכיסוי: ביטוח אחריות מקצועית לעבודות מעליות
"""

# pdftotext -layout puts a right-aligned Hebrew label AFTER the value on the physical line
HE_LICENSE_RTL_LAYOUT = """
                                                   רישיון חשמלאי
        חשמל לדוגמה בע"מ                          :שם בעל הרישיון
        EL-48213                                 :מספר רישיון
        15.03.2025                               :תאריך הוצאה
        14.03.2030                               :תוקף עד
        חשמלאי מוסמך, ת"י 61439                  :תחום
"""

EN_CERT = """
CERTIFICATE OF INSURANCE
Name of insured: Example Elevators Ltd.
Policy No.: POL-2026-0042
Date of issue: 1 February 2026
Valid until: January 31, 2027
Scope: Lift maintenance, standard EN 81-20
"""


def values(found: dict[str, ports.FieldSuggestion]) -> dict[str, str | None]:
    return {k: found[k].value for k in FIELDS}


# ================================================================ NEGATIVE first

def test_empty_or_unrelated_text_finds_nothing_and_never_guesses():
    for text in ("", "   \n\f", "רשימת קניות: חלב, לחם\nפגישה ב-14:00", "Lorem ipsum dolor sit amet 12345"):
        res = cr.extract(text)
        assert set(res.fields) == set(FIELDS)
        assert all(f.value is None and f.confidence == "none" for f in res.fields.values()), text
        assert res.summary == "none"


def test_a_date_without_a_label_is_not_an_expiry_date():
    res = cr.extract("אישור\n31/12/2026\nמסמך כללי")
    assert res.fields["expiry_date"].value is None and res.fields["issue_date"].value is None


def test_impossible_dates_are_refused():
    res = cr.extract("בתוקף עד: 31/02/2026\nתאריך הנפקה: 00/13/2025")
    assert res.fields["expiry_date"].value is None and res.fields["issue_date"].value is None


def test_a_document_number_needs_a_digit():
    assert cr.extract("מספר פוליסה: ראו מצורף").fields["document_number"].value is None


def test_snippets_are_short_and_never_carry_a_tax_or_id_number_or_a_bank_account():
    text = HE_INSURANCE + "\nחשבון בנק: IL62 0108 0000 0009 9999 999\nת.ז. 012345678\n" + "סה\"כ " * 80
    res = cr.extract(text)
    for f in res.fields.values():
        assert len(f.snippet) <= ports.SNIPPET_MAX
        assert "512345678" not in f.snippet and "012345678" not in f.snippet and "IL62" not in f.snippet
    assert "512345678" not in (res.fields["supplier"].value or ""), "the supplier's tax id is not part of the name"


def test_control_and_bidi_characters_are_stripped_from_values():
    res = cr.extract("שם המבוטח: ‫מעליות‏ הדוגמה\u0007 בע\"מ\nבתוקף עד: ‎31/12/2026")
    assert res.fields["supplier"].value == 'מעליות הדוגמה בע"מ'
    assert res.fields["expiry_date"].value == "2026-12-31"


# ================================================================ positive: the three synthetic layouts

def test_hebrew_insurance_certificate_logical_order():
    res = cr.extract(HE_INSURANCE)
    assert values(res.fields) == {"supplier": 'מעליות הדוגמה בע"מ', "document_number": "7700-123456", "issue_date": "2026-01-05",
                                  "expiry_date": "2026-12-31", "scope": "ביטוח אחריות מקצועית לעבודות מעליות"}
    assert res.fields["expiry_date"].confidence == "high" and res.fields["supplier"].confidence == "high"
    assert res.fields["expiry_date"].evidence == "בתוקף עד" and "31/12/2026" in res.fields["expiry_date"].snippet
    assert res.summary == "good"


def test_hebrew_licence_with_the_label_after_the_value_dotted_dates_and_a_standard():
    res = cr.extract(HE_LICENSE_RTL_LAYOUT)
    assert values(res.fields) == {"supplier": 'חשמל לדוגמה בע"מ', "document_number": "EL-48213", "issue_date": "2025-03-15",
                                  "expiry_date": "2030-03-14", "scope": 'חשמלאי מוסמך, ת"י 61439'}


def test_english_certificate_with_month_names():
    res = cr.extract(EN_CERT)
    assert values(res.fields) == {"supplier": "Example Elevators Ltd.", "document_number": "POL-2026-0042", "issue_date": "2026-02-01",
                                  "expiry_date": "2027-01-31", "scope": "Lift maintenance, standard EN 81-20"}


def test_hebrew_month_names_and_gershayim_variants():
    res = cr.extract("שם הספק: ספק בדיקה\nתאריך הנפקה: 3 במרץ 2026\nתוקף הפוליסה עד: 2 במרץ 2027\nמס׳ פוליסה: 99-1234")
    assert res.fields["issue_date"].value == "2026-03-03" and res.fields["expiry_date"].value == "2027-03-02"
    assert res.fields["document_number"].value == "99-1234"


def test_a_validity_range_gives_the_end_as_expiry_and_the_start_as_issue_with_medium_confidence():
    res = cr.extract("שם המבוטח: ספק טווח\nתקופת הביטוח: 01/04/2026 - 31/03/2027")
    assert res.fields["expiry_date"].value == "2027-03-31" and res.fields["expiry_date"].confidence == "medium"
    assert res.fields["issue_date"].value == "2026-04-01" and res.fields["issue_date"].confidence == "medium"


@pytest.mark.parametrize(("raw", "iso", "conf"), [
    ("31/12/2026", "2026-12-31", "high"),
    ("31.12.26", "2026-12-31", "medium"),     # a two-digit year
    ("2026-12-31", "2026-12-31", "high"),
    ("03/04/2026", "2026-04-03", "medium"),   # day and month both <= 12: read as dd/mm (Israel), flagged
    ("05/05/2026", "2026-05-05", "high"),     # the same either way
])
def test_date_formats_and_ambiguity(raw, iso, conf):
    f = cr.extract(f"בתוקף עד: {raw}").fields["expiry_date"]
    assert (f.value, f.confidence) == (iso, conf)


def test_expiry_before_issue_lowers_both_dates():
    res = cr.extract("תאריך הנפקה: 01/06/2026\nבתוקף עד: 01/01/2026")
    assert res.fields["issue_date"].confidence == "low" and res.fields["expiry_date"].confidence == "low"
    assert "date_order" in res.flags


def test_visual_order_hebrew_is_recovered_with_low_confidence():
    visual = cr.to_visual(HE_INSURANCE)
    assert "חוטיב" in visual and "7700-123456" in visual and "31/12/2026" in visual, "Hebrew runs reversed, digit runs kept"
    res = cr.extract(visual)
    assert res.fields["expiry_date"].value == "2026-12-31" and res.fields["document_number"].value == "7700-123456"
    assert res.fields["supplier"].value == 'מעליות הדוגמה בע"מ'
    assert all(f.confidence in ("low", "none") for f in res.fields.values()), "a reversed-order recovery is never more than low"
    assert "visual_order" in res.flags


def test_partial_summary_and_rules_version():
    res = cr.extract("בתוקף עד: 31/12/2026")
    assert res.summary == "partial" and cr.RULES_VERSION.startswith("cert-")


def test_the_result_is_deterministic():
    assert cr.extract(HE_INSURANCE).as_json() == cr.extract(HE_INSURANCE).as_json()


# ================================================================ the ports: null readers, no model

def test_the_null_readers_and_the_null_model_do_nothing():
    from pathlib import Path

    assert ports.NullTextReader().read(Path("x.pdf"), max_pages=10).status == "unavailable"
    assert ports.NullOcrReader().read(Path("x.jpg"), max_pages=4).status == "ocr_not_available"
    assert ports.NullModelExtractor().extract("any text", "certificate") == {}
    assert ports.NullModelExtractor.name == "none"
