"""CR-019 section 6.3: the switch-protection classifier, pure (no database). The golden fixture holds every category by
entity text (Hebrew and English), every integration / sibling / icon / area signal kind, the lighting suppression of the weak
categories only, the English token boundaries ("groups" never "ups"), the deliberate non-signals and the documented accepted
false positives. Expectations in the fixture were written by hand (tests/fixtures/switch_protection/), not read back."""
from __future__ import annotations

import inspect
import json
from pathlib import Path

import pytest

from smplwise.services import switch_protection as sp
from smplwise.services import switch_protection_rules as rules

GOLDEN = json.loads((Path(__file__).parent / "fixtures" / "switch_protection" / "classifier_golden.json").read_text(encoding="utf-8"))
CASES = GOLDEN["cases"]


def test_the_golden_fixture_is_big_enough_and_matches_the_classifier_version():
    assert len(CASES) >= 120
    assert GOLDEN["classifier_version"] == sp.CLASSIFIER_VERSION
    cats = {c["expect"]["category"] for c in CASES if c["expect"]}
    assert cats == set(rules.CATEGORY_LABELS), "every category has at least one positive case"
    assert sum(1 for c in CASES if c["expect"] is None) >= 40, "and plenty of negatives"


@pytest.mark.parametrize("c", CASES, ids=[f"{i:03d}-{c['note']}" for i, c in enumerate(CASES)])
def test_golden(c):
    got = sp.classify_switch(c["entity"], c["device"], c["siblings"], c["area"])
    if c["expect"] is None:
        assert got is None, got
        return
    assert got is not None, "expected a protection hit"
    assert got[0] == c["expect"]["category"], got
    if "rule" in c["expect"]:
        assert got[1] == c["expect"]["rule"]


@pytest.mark.parametrize("name, expected", [
    ("groups", None), ("Groups room", None), ("UPS", "network"), ("navigate", None), ("Gate", "access"), ("dinas", None), ("NAS", "network"),
    ("תאורת חניה", None), ("Pool lights", None), ("משאבת בריכה", "water_heating"), ("Gate light", None), ("Garden pump light", "water_heating"),
])
def test_the_owner_examples(name, expected):
    """The cases the CR names: 'groups' never matches 'ups'; the parking light and the pool lights stay included; the pool pump is
    protected."""
    hit = sp.match_text(name)
    assert (hit[0] if hit else None) == expected


def test_lighting_suppression_applies_to_weak_categories_only():
    assert rules.WEAK_CATEGORIES == {"access", "security", "pool"}
    for weak in ("Gate light", "Camera light", "Pool light", "תאורת שער", "מנורת מצלמה", "תאורת ג'קוזי"):
        assert sp.match_text(weak) is None, weak
    for strong in ("Pump light", "Boiler lamp", "Fridge light", "UPS LED", "Irrigation lamp", "Aquarium light", "EV charger light", "Elevator light", "Heater lamp", "תאורת מעלית", "מנורת אקווריום"):
        assert sp.match_text(strong) is not None, strong


def test_a_weak_hit_does_not_hide_a_later_strong_one_in_the_same_text():
    assert sp.match_text("Gate light and fridge") == ("cold", "fridge"), "access (weak, suppressed) is tried before cold"


def test_hebrew_lighting_words_must_start_a_word():
    """A lighting word is the one place where a loose match REMOVES protection, so "לד" counts only at a word start (after
    prefix letters): "ילדים" (children) never cancels a camera's protection; "הלד" / "בלד" do count."""
    assert sp.has_light_word(sp.normalize("פס לד")) and sp.has_light_word(sp.normalize("שער הלד"))
    assert not sp.has_light_word(sp.normalize("חדר ילדים"))
    assert sp.match_text("מצלמה חדר ילדים") == ("security", "מצלמה")


def test_hebrew_protection_terms_match_as_substrings_with_prefixes():
    for text, cat in (("המשאבה", "water_heating"), ("לדוד", "water_heating"), ("ומקרר", "cold"), ("בשרתים", "network"), ("למעלית", "elevator")):
        assert sp.match_text(text)[0] == cat, text


def test_english_matches_whole_tokens_and_phrases():
    assert sp.tokens(sp.normalize("Z-Wave_stick 2")) == ["z", "wave", "stick", "2"]
    assert sp.match_text("z-wave") == ("network", "z wave")
    assert sp.match_text("hot-water tank") == ("water_heating", "hot water")
    assert sp.match_text("water hot") is None, "a phrase needs its words in order"
    assert sp.match_text("navigation gateway") == ("network", "gateway")


def test_no_signal_from_the_map_circuits_or_anything_an_arx_editor_can_change():
    """The classifier's inputs are HA-side facts only: its signature names the entity, its HA device, the device's other
    entities and the HA area - nothing about map anchors, layers, circuits or Plan Studio."""
    params = list(inspect.signature(sp.classify_switch).parameters)
    assert params == ["entity", "device", "siblings", "area_name"]
    src = inspect.getsource(sp.classify_switch) + inspect.getsource(rules)
    for word in ("circuit", "map_anchors", "geometry", "layer"):
        assert word not in src, word


def test_rules_are_well_formed():
    for cat, en, he in rules.TERMS:
        assert cat in rules.CATEGORY_LABELS and en is not None and he
        assert all(t == t.casefold() for t in en)
    assert set(rules.PLATFORMS.values()) <= set(rules.CATEGORY_LABELS)
    assert set(rules.ICON_EXACT.values()) <= set(rules.CATEGORY_LABELS)
    assert rules.PLATFORMS["hassio"] == "infrastructure"
    assert rules.CATEGORY_LABELS["infrastructure"] == "תשתית המערכת", "no platform branding in the labels"
    for generic in ("shelly", "tuya", "mqtt", "zha", "zwave_js", "esphome", "template", "sonoff"):
        assert generic not in rules.PLATFORMS
    assert [c["id"] for c in sp.categories()] == list(rules.CATEGORY_LABELS)
