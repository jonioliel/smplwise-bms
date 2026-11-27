"""DOCS-GUIDE-2550: every setting added in 2.53-2.55 is documented, with the default the code really has.

The settings-to-docs map for the add-on OPTIONS is test_docs_config_consistency.py (config.yaml <-> DOCS.md / DOCS_HE.md). This file
does the same for the installation settings, the per-user preference and the add-on option that 2.53-2.55 added: each key must be
named (as code, in backticks) in DOCS.md, DOCS_HE.md and the Hebrew settings chapter of the user guide, and its default must be the
one those documents state. A new setting of a later version is added to NEW_SETTINGS here together with its documentation.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from smplwise.services import settings_store, user_prefs, wiskey_schedule_execution

ADDON = Path(__file__).resolve().parents[2]
REPO = ADDON.parent
DOCS = {
    "DOCS.md": ADDON / "DOCS.md",
    "DOCS_HE.md": ADDON / "DOCS_HE.md",
    "80-settings_HE.md": REPO / "docs" / "user-guide" / "he" / "80-settings_HE.md",
}
GUIDE_PAGE = REPO / "docs" / "user-guide" / "he" / "19-whats-new-2530-2550_HE.md"

# key -> the default the documents state (installation settings in settings_store.DEFAULTS unless noted in the tests below)
NEW_SETTINGS = {
    "onboarding.enabled": "false",  # 2.53, DOCS-ONBOARDING-2530 (a fresh installation stores "true" once)
    "security.push_approval": "off",  # 2.53, MFA-T095-REST-2530
    "security.step_up_alarm_pin": "off",  # 2.53, MFA-T095-REST-2530
    "access.station_media_direct_v2": "off",  # 2.53, WISKEY-MEDIA-V2-2530 (no screen)
    "ha.state_reconcile_min": "10",  # 2.55, HA-STATE-RECONCILE-2550 (no screen; 0 = off)
}
NEW_KEYS = [*NEW_SETTINGS, "wiskey.schedule_execution_status", "onboarding.dismissed", "unifiedpush_servers"]


@pytest.mark.parametrize("key", sorted(NEW_SETTINGS))
def test_new_setting_default_is_the_documented_one(key):
    assert settings_store.DEFAULTS.get(key) == NEW_SETTINGS[key]


def test_schedule_execution_switch_key_and_default_off():
    # WISKEY-A2-EXEC-2530: the switch is read by its own module (not in DEFAULTS); anything but "on" is off
    assert wiskey_schedule_execution.SWITCH_KEY == "wiskey.schedule_execution_status"
    assert "wiskey.schedule_execution_status" not in settings_store.DEFAULTS or (
        settings_store.DEFAULTS["wiskey.schedule_execution_status"] != "on")


def test_onboarding_dismissed_is_a_user_preference():
    assert "onboarding.dismissed" in user_prefs.VALIDATORS


def test_unifiedpush_option_is_empty_by_default():
    text = (ADDON / "config.yaml").read_text(encoding="utf-8")
    assert re.search(r'^  unifiedpush_servers: ""$', text, re.M)


@pytest.mark.parametrize("name", sorted(DOCS))
def test_every_new_setting_is_documented(name):
    doc = DOCS[name].read_text(encoding="utf-8")
    missing = [k for k in NEW_KEYS if f"`{k}`" not in doc]
    assert not missing, f"{name} does not name the 2.53-2.55 settings: {missing}"


def test_whats_new_page_names_the_new_settings_and_owner_steps():
    page = GUIDE_PAGE.read_text(encoding="utf-8")
    for needle in ("`unifiedpush_servers`", "`access.station_media_direct_v2`", "רשימת תחילת העבודה", "אישור בטלפון",
                   "קוד האזעקה האישי כאישור", "הצגת מצב הביצוע מ־WisKey", "אחר כך"):
        assert needle in page, needle
    # the owner steps for Android push exist in both languages
    assert "מה הבעלים עושה" in page and "What the owner does" in page
