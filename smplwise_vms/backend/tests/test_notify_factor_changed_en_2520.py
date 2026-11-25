"""RELEASE-2520-TRAIN: the English of MFA-FACTOR-HARDEN-2520's notice `security.second_factor_changed` (N-6).

The notice's body is `{change}.` filled with a FIXED Hebrew phrase of notify_sources.FACTOR_CHANGES_HE. An English reader (the centre,
and per recipient push / e-mail / the app since NOTIFY-RECIPIENT-LANG-2520) must get the whole notice in English: the source's English
template (notify_policy_en.TEMPLATES_EN) and the phrase's English (notify_policy_en.PARAM_VALUES_EN). The Hebrew is unchanged byte for
byte, and a value the table does not know (a name, an older text) stays as written.
"""
from __future__ import annotations

import re

from smplwise.services import notify_policy, notify_sources
from smplwise.services.notify_policy_en import PARAM_VALUES_EN, TEMPLATES_EN

HEB = re.compile(r"[֐-׿]")
KEY = "security.second_factor_changed"


def test_the_notice_has_an_english_template():
    assert KEY in TEMPLATES_EN
    title, body, resolve = TEMPLATES_EN[KEY]
    assert not HEB.search(title + body + resolve)
    assert "{change}" in body


def test_every_change_phrase_has_its_english_and_nothing_else_is_listed():
    phrases = PARAM_VALUES_EN[KEY]["change"]
    assert set(phrases) == set(notify_sources.FACTOR_CHANGES_HE.values())
    assert all(en and not HEB.search(en) for en in phrases.values())


def test_english_rendering_has_no_hebrew_for_every_change():
    for code, he in notify_sources.FACTOR_CHANGES_HE.items():
        title, body = notify_policy.render(KEY, {"change": he}, "en")
        assert not HEB.search(title) and not HEB.search(body), (code, title, body)
        assert body.startswith(PARAM_VALUES_EN[KEY]["change"][he] + ".")


def test_hebrew_rendering_is_unchanged():
    he = notify_sources.FACTOR_CHANGES_HE["removed:passkey"]
    s = notify_policy.BY_KEY[KEY]
    title, body = notify_policy.render(KEY, {"change": he})
    assert title == s.title
    assert body == s.body.format(change=he)


def test_a_value_the_table_does_not_know_stays_as_written():
    _title, body = notify_policy.render(KEY, {"change": "משהו אחר"}, "en")
    assert body.startswith("משהו אחר.")


def test_other_sources_are_not_touched_by_the_value_table():
    params = {"name": "חיישן מטבח"}
    assert notify_policy.render("sensor.leak", params, "en")[1] == "חיישן מטבח reported water."
