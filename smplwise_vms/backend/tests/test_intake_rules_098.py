"""CR-INTAKE99 slice 1 (TENANTINTAKE098-295): the pure rule-based extractor - normalisation, whole-token matching with proclitic
alternatives, longest-match, place rules, safety / negation / urgency, abstain over guess, the corpus gate. No database, no network,
no model. The corpus is SYNTHETIC (tests/intake_corpus_098.py) and smaller than the record's 300-message target: the gate numbers
below are the record's, applied to what exists."""
from __future__ import annotations

import pytest
from intake_corpus_098 import CORPUS, is_safety

from smplwise.services.tickets import intake_rules as rules


@pytest.fixture(scope="module")
def lex():
    return rules.seed_lexicon(domain_category={d: d for d in rules.seed_domains()})


def one(lex, text):
    return rules.suggest(text, lex)


# ---------------------------------------------------------------- normalisation

def test_niqqud_final_letters_quotes_and_digits_are_folded_and_offsets_stay_original():
    text = "מַעֲלִית ב-קומה ٣ צ׳יפ"
    norm, idx = rules.normalise(text)
    assert "מעלית" in norm and "3" in norm and "'" in norm
    assert len(norm) == len(idx) and all(0 <= i < len(text) for i in idx)
    assert rules.key_of("דחוווווף") == "דחוף" and rules.key_of("10") == "10", "runs collapse in words, never in numbers"


def test_time_date_price_and_phone_numbers_are_masked():
    norm, _ = rules.normalise("ב-10:30 ב-3/11 ב-50 ש\"ח 0501234567")
    assert "10" not in norm.replace("§", "") and "3/11" not in norm and "050" not in norm


def test_proclitics_are_alternatives_only_when_the_stem_is_a_lexicon_word(lex):
    toks, _ = rules.tokenise("ובמעלית בשרוך", lex)
    assert "מעלית" in toks[0].alts and toks[1].alts == (toks[1].key,)


def test_stop_words_are_never_stripped_or_matched(lex):
    assert one(lex, "הפח מלא")["category"]["value"] == "cleaning"
    assert one(lex, "אשפה")["urgency"]["value"] == "normal", "אשפה is not אש"
    assert one(lex, "ברזל חלוד")["category"]["value"] is None, "ברזל is not ברז"


# ---------------------------------------------------------------- category: longest match, abstain, flags

def test_the_longest_phrase_wins_across_domains(lex):
    assert one(lex, "דלת המעלית נתקעה")["category"]["value"] == "elevator"
    assert one(lex, "טפטוף מהמזגן")["category"]["value"] == "hvac"
    assert one(lex, "שער החניון")["category"]["value"] == "parking"


def test_a_tie_abstains_and_a_clear_winner_answers(lex):
    tie = one(lex, "המזגן מטפטף מהתקרה והכיור סתום")
    assert tie["category"]["value"] is None and tie["category"]["confidence"] == "low"
    assert tie["category"]["candidates"], "the handler sees the candidates"
    assert one(lex, "המעלית תקועה")["category"]["confidence"] in ("medium", "high")


def test_two_real_issues_are_flagged(lex):
    assert "possible_multi_issue" in one(lex, "המזגן לא מקרר ואין חשמל במשרד")["flags"]


def test_generic_words_decide_nothing(lex):
    r = one(lex, "יש תקלה ובעיה")
    assert r["category"]["value"] is None and r["category"]["confidence"] == "none"


def test_an_unmapped_seed_domain_is_reported_and_suggests_nothing():
    bare = rules.seed_lexicon()
    r = rules.suggest("הליפט תקוע", bare)
    assert r["category"]["value"] is None and "elevator" in r["unmapped_domains"]


def test_the_installations_own_names_outweigh_the_seed():
    cat = rules.Entry(rules.phrase_tokens("מכונות קפה"), "cat", "cat:coffee", rules.NAME_WEIGHT, "N-cat")
    loc = rules.Entry(rules.phrase_tokens("מרכז לוגיסטי צפון"), "loc", "loc:L1", rules.NAME_WEIGHT, "N-loc")
    lx = rules.seed_lexicon([cat, loc])
    r = rules.suggest("מכונת הקפה במרכז לוגיסטי צפון לא עובדת, מכונות קפה", lx)
    assert r["category"]["value"] == "coffee" and r["location"]["value"] == "L1" and r["location"]["confidence"] == "high"


# ---------------------------------------------------------------- place rules

@pytest.mark.parametrize("text,place", [
    ("בקומה 3", "קומה 3"), ("ק' 4", "קומה 4"), ("בקומה השלישית", "קומה 3"), ("קומה שתיים", "קומה 2"), ("בלובי", "בלובי"),
    ("בקומת קרקע", "קומת קרקע"), ("בחניון -1", "קומה -1"), ("מינוס 2", "קומה -2"), ("במרתף", "מרתף"), ("על הגג", "גג"),
    ("בבניין B", "בבניין B"), ("באגף צפוני", "באגף צפוני"), ("בחדר 204", "בחדר 204"), ("במשרד 12", "במשרד 12"),
    ("בחדר מדרגות", "חדר מדרגות"), ("קומה 3 חדר 3", "קומה 3, חדר 3"),
])
def test_place_patterns(lex, text, place):
    assert one(lex, "המזגן " + text)["place"]["text"] == place


@pytest.mark.parametrize("text", ["התקשרתי ב-10:30", "ב-3/11 קרה", "שילמתי 150 ש\"ח", "טלפון 0501234567", "בית כנסת", "בניין לא נעול"])
def test_numbers_that_are_not_places_and_words_that_only_look_like_places(lex, text):
    assert one(lex, text)["place"]["text"] == ""


def test_the_evidence_offsets_point_into_the_original_text(lex):
    text = "המעלית תקועה בקומה 3"
    r = one(lex, text)
    s, e, _rule = r["place"]["evidence"][0]
    assert text[s:e] == "בקומה 3"
    s, e, _rule = r["category"]["evidence"][0]
    assert text[s:e].startswith("המעלית")


# ---------------------------------------------------------------- urgency

@pytest.mark.parametrize("text", ["יש ריח גז", "שריפה", "יש עשן במטבח", "תקוע במעלית", "פיצוץ צינור", "התחשמל", "אמבולנס בבקשה", "פריצה לחדר"])
def test_every_safety_trigger_is_urgent(lex, text):
    r = one(lex, text)
    assert r["urgency"]["value"] == "urgent" and "safety" in r["flags"] and r["urgency"]["evidence"]


def test_emergency_services_are_pointed_at_for_medical_and_security(lex):
    assert "emergency_services" in one(lex, "יש פצוע בלובי")["flags"]
    assert "emergency_services" not in one(lex, "יש עשן בלובי")["flags"]


@pytest.mark.parametrize("text", ["אין ריח גז יותר", "כבר לא מריח גז", "הפסיק העשן", "בלי עשן"])
def test_a_negated_trigger_does_not_raise_urgency(lex, text):
    r = one(lex, text)
    assert r["urgency"]["value"] != "urgent" and "safety_negated" in r["flags"]


def test_not_urgent_wins_over_the_fire_word_and_the_one_step_rule(lex):
    assert one(lex, "לא בוער")["urgency"]["value"] == "low"
    assert one(lex, "דחוף המזגן")["urgency"]["value"] == "high"
    assert one(lex, "המזגן!!!")["urgency"]["value"] == "high"
    assert one(lex, "גז במטבח")["urgency"]["value"] == "high", "the bare word גז is only high"
    assert one(lex, "דחוף ואין חשמל")["urgency"]["value"] == "high", "words alone never reach urgent"


def test_courtesy_and_questions_are_flagged_not_escalated(lex):
    thanks = one(lex, "תודה רבה!!!")
    assert thanks["urgency"]["value"] == "normal" and "possible_not_a_request" in thanks["flags"]
    assert "possible_question" in one(lex, "מתי מגיע הטכנאי?")["flags"]
    assert "too_short" in one(lex, "שלום")["flags"]


def test_title_is_the_first_sentence_cut_at_a_word(lex):
    long = ("מילה " * 60).strip()
    t = one(lex, long + ". עוד משפט")["title"]
    assert len(t) <= rules.TITLE_MAX and t.endswith("מילה")
    assert one(lex, "המזגן לא מקרר. בחדר 204")["title"] == "המזגן לא מקרר"
    assert one(lex, "אב")["title_short"] is True


def test_classification_is_deterministic_and_pure(lex):
    a = one(lex, "המעלית תקועה בקומה 3, דחוף")
    assert a == one(lex, "המעלית תקועה בקומה 3, דחוף")
    import json
    json.dumps(a, ensure_ascii=False)  # serialisable: it is stored as the draft's suggestion


# ---------------------------------------------------------------- the corpus gate (record 13.2, applied to the synthetic corpus)

def test_the_corpus_gate(lex):
    answered = correct = 0
    expected_answers = 0
    safety = [r for r in CORPUS if is_safety(r)]
    urgent_hits = sum(1 for r in safety if one(lex, r[0])["urgency"]["value"] == "urgent")
    urgent_pred = [r for r in CORPUS if one(lex, r[0])["urgency"]["value"] == "urgent"]
    urgent_precision = sum(1 for r in urgent_pred if is_safety(r)) / max(1, len(urgent_pred))
    place_given = place_ok = 0
    for text, domain, urgency, place in CORPUS:
        got = one(lex, text)
        value = got["category"]["value"]
        if domain is not None:
            expected_answers += 1
        if value is not None:
            answered += 1
            correct += int(value == domain)
        assert got["urgency"]["value"] == urgency, text
        if got["place"]["text"]:
            place_given += 1
            place_ok += int(got["place"]["text"] == place)
        assert (got["place"]["text"] or None) == place, text
    assert len(CORPUS) >= 60 and len(safety) >= 12
    assert urgent_hits / len(safety) >= 0.97, "urgent recall"
    assert urgent_precision >= 0.6, "urgent precision"
    assert correct / max(1, answered) >= 0.85, "category precision on answered cases"
    assert answered / max(1, expected_answers) >= 0.6, "category coverage"
    assert place_ok / max(1, place_given) >= 0.9, "place precision"
