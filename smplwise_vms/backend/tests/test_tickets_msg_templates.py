"""CR-038 9.1 / 9.7 / 14.3 / D26 / D33: the channel model and the message templates (no database, no network)."""
from __future__ import annotations

from smplwise.services.tickets import naming  # slice 5b: the module's default name is read, never written
import random

import pytest

from smplwise.services.tickets import channel, message_templates as tp
from smplwise.services.tickets.channel import (AccountRef, ChannelRegistry, OutboundMessage, Recipient, SendResult, phone_digits,
                                               strip_controls)

LINK = "https://t-demo.example.test/t/#AbCdEfGhIjKlMnOpQrStUvWxYz012345"
PARAMS = {"name": "דני", "number": "1042", "department": "אחזקה", "title": "מזגן לא מקרר", "place": "קומה 1 · חדר 102"}


# ---------------------------------------------------------------- model and hygiene

def test_outcomes_and_may_have_left():
    assert SendResult("sent").may_have_left and SendResult("unknown", "timeout").may_have_left
    assert not SendResult("not_sent", "ha_unavailable").may_have_left and not SendResult("refused").may_have_left
    with pytest.raises(ValueError):
        SendResult("delivered")


def test_priorities_follow_the_spec():
    assert channel.priority_of("code") == 0
    assert {channel.priority_of(p) for p in ("assign", "update", "reopened")} == {1}
    assert {channel.priority_of(p) for p in ("reminder", "closed", "reassigned")} == {2}


@pytest.mark.parametrize("raw,expected", [
    ("15555550101", "15555550101"), ("+1-555-555-0101", "15555550101"), ("15555550101@s.whatsapp.net", "15555550101"),
    ("15555550101:12@s.whatsapp.net", "15555550101"), ("123456789012345@lid", None), ("120363000000000000@g.us", None),
    ("1234567", None), ("1234567890123456", None), ("", None), (None, None), ("abc", None)])
def test_phone_digits(raw, expected):
    assert phone_digits(raw) == expected


def test_strip_controls_removes_cc_and_cf_keeps_newlines_when_asked():
    text = "בוצע‮ עבודה​\x07\tסוף\r\nשורה"
    assert strip_controls(text) == "בוצע עבודה סוף שורה"
    assert strip_controls(text, multiline=True) == "בוצע עבודה סוף\nשורה"


def test_reprs_never_show_numbers_texts_or_values():
    r = Recipient("c1", "דני", phone="15555550101", email="vendor@example.test")
    msg = OutboundMessage("ob1", "whatsapp", "assign", r, text=f"secret text {LINK}", account=AccountRef("manual:abcd", "15555550199", "x"))
    shown = repr(msg)
    for secret in ("15555550101", "vendor@example.test", "secret text", LINK, "15555550199"):
        assert secret not in shown


def test_registry_accepts_known_channels_only():
    class Fake:
        key = "sms"

        def status(self, account=None): ...
        def can_reach(self, recipient, account=None): ...
        def send(self, msg): ...
        def supports_buttons(self): return False
        def parse_inbound(self, event): return None

    reg = ChannelRegistry()
    with pytest.raises(ValueError):
        reg.register(Fake())
    Fake.key = "email"
    reg.register(Fake())
    assert reg.keys() == ("email",)


# ---------------------------------------------------------------- validation

def test_every_starter_is_valid_in_every_language():
    for purpose, texts in tp.STARTERS.items():
        assert set(texts) == set(channel.LANGS), purpose
        for lang, body in texts.items():
            assert tp.problems(purpose, body) == [], (purpose, lang)


def test_the_fixed_code_variants_are_pinned_valid_and_name_the_organisation():
    """VPORTAL review F2 (2.6.4): the portal sign-in code is a code-owned variant of the fixed `phone_verify` message, chosen by the
    outbox row's template id; it names the organisation and the purpose and says the code is never asked for."""
    assert set(tp.FIXED_STARTERS) == {"portal_code"}
    for name, texts in tp.FIXED_STARTERS.items():
        assert set(texts) == set(channel.LANGS), name
        for lang, body in texts.items():
            assert tp.problems("phone_verify", body) == [], (name, lang)
            assert "{code}" in body and "{organization}" in body and "10" in body, (name, lang)
    assert tp.fixed_starter("phone_verify", "starter:portal_code", "ar").body == tp.FIXED_STARTERS["portal_code"]["ar"]
    assert tp.fixed_starter("phone_verify", "starter:portal_code", "xx").lang == "he"
    assert tp.fixed_starter("phone_verify", None, "en").body == tp.STARTERS["phone_verify"]["en"]
    assert tp.fixed_starter("phone_verify", "starter:assign:he", "en").body == tp.STARTERS["phone_verify"]["en"], "no other text"
    he = tp.render(tp.FIXED_STARTERS["portal_code"]["he"], {"organization": ""}, lang="he", secrets={"code": "123456"})
    assert he.startswith("קוד הכניסה") and "\n\n" not in he, "without an organisation name the line is dropped"


def test_starters_never_hard_code_the_module_noun():
    """14.3 lint: the default nouns of the four languages appear nowhere in the starter texts (they use {module_name})."""
    for purpose, texts in [*tp.STARTERS.items(), *tp.FIXED_STARTERS.items()]:
        for lang, body in texts.items():
            for noun in tp.DEFAULT_NOUNS:
                assert noun not in body, (purpose, lang, noun)
    for lang, captions in tp.BUTTON_TEXT.items():
        for text in captions.values():
            assert not any(noun in text for noun in tp.DEFAULT_NOUNS)


@pytest.mark.parametrize("purpose,body,code", [
    ("assign", "שלום {name} {bogus} {link}", "placeholder_unknown"),
    ("assign", "שלום {name}", "link_required"),
    ("assign", "שלום {link} https://evil.example/x", "url_not_link"),
    ("assign", "שלום {link} www.evil.example", "url_not_link"),
    ("assign", "שלום‮ {link}", "control_chars"),
    ("assign", "שלום​ {link}", "control_chars"),
    ("assign", "שלום {link", "brace_unbalanced"),
    ("assign", "{link} {code}", "code_not_allowed"),
    ("code", "קוד", "code_required"),
    ("code", "{code} {link}", "code_discloses"),
    ("code", "{code} {title}", "code_discloses"),
    ("code", "{code} {place}", "code_discloses"),
    ("assign", "{link} {g:x=bad}", "gender_malformed"),
    ("assign", "{link} " + "{title} " * 9, "too_long"),
    ("nope", "{link}", "purpose_unknown"),
    ("assign", "   ", "empty"),
])
def test_template_problems(purpose, body, code):
    assert code in [p["code"] for p in tp.problems(purpose, body)]


def test_closed_and_reassigned_need_no_link():
    assert tp.problems("closed", "{module_name} {number} נסגרה") == []
    assert tp.problems("assign", "שלום {name}", for_contacts=False) == []


def test_params_never_carry_secrets():
    with pytest.raises(tp.TemplateError) as e:
        tp.check_params({"link": LINK})
    assert e.value.code == "param_not_allowed" and LINK not in str(e.value)
    for bad in ("code", "phone", "token", "module_name"):
        with pytest.raises(tp.TemplateError):
            tp.check_params({bad: "x"})
    assert tp.check_params({"title": "a‮b\nc" + "x" * 300})["title"] == "ab c" + "x" * 116


# ---------------------------------------------------------------- rendering

def test_default_assign_text_hebrew():
    text = tp.render(tp.STARTERS["assign"]["he"], PARAMS, lang="he", secrets={"link": LINK})
    assert text == ("שלום דני,\n" + naming.DEFAULTS["he"]["one"] + " 1042 (אחזקה): מזגן לא מקרר\nקומה 1 · חדר 102\nלעדכון הטיפול: " + LINK +
                    "\nחובה להיכנס לקישור כדי להמשיך בטיפול.")


def test_rendering_is_one_pass_and_values_are_one_line():
    params = dict(PARAMS, title="{link} {code}\nשורה‮", name="{name}")
    text = tp.render("{name}: {title} {link}", params, lang="he", secrets={"link": LINK})
    assert text == f"{{name}}: {{link}} {{code}} שורה {LINK}"


def test_an_empty_place_drops_its_line():
    text = tp.render(tp.STARTERS["assign"]["he"], dict(PARAMS, place=""), lang="he", secrets={"link": LINK})
    assert "\n\n" not in text and text.count("\n") == 3


def test_module_name_and_gender_follow_the_setting():
    renamed = {"he": {"one": "פנייה", "many": "פניות", "gender": "f"}}
    assert tp.render(tp.STARTERS["closed"]["he"], PARAMS, lang="he", display_name=renamed).startswith("פנייה 1042 (אחזקה) נסגרה")
    masculine = {"he": {"one": "אירוע", "many": "אירועים", "gender": "m"}}
    assert tp.render(tp.STARTERS["reopened"]["he"], PARAMS, lang="he", display_name=masculine, secrets={"link": LINK}).startswith(
        "אירוע 1042 (אחזקה) נפתח מחדש")
    ru = tp.render(tp.STARTERS["reopened"]["ru"], PARAMS, lang="ru", secrets={"link": LINK})
    assert ru.startswith(naming.DEFAULTS["ru"]["one"] + " № 1042 (אחזקה) открыта снова")
    ru_m = tp.render(tp.STARTERS["assign"]["ru"], PARAMS, lang="ru", display_name={"ru": {"one": "запрос", "gender": "m"}}, secrets={"link": LINK})
    assert "Новый запрос № 1042" in ru_m
    en = tp.render(tp.STARTERS["closed"]["en"], PARAMS, lang="en", display_name={"en": {"one": "work order"}})
    assert en.startswith("Work order #1042")


def test_display_name_values_are_sanitised():
    names = tp.names_for({"he": {"one": "{link}‮פנייה", "many": "", "gender": "x"}}, "he")
    assert names == {"one": "linkפנייה", "many": naming.DEFAULTS["he"]["many"], "gender": "f"}


def test_render_refuses_too_long():
    with pytest.raises(tp.TemplateError):
        tp.render("x" * 1001, {}, lang="he")


def test_choose_prefers_language_then_department():
    T = tp.TemplateText
    items = [T("i-he", "assign", "he", "{link}"), T("d-he", "assign", "he", "{link}", department_id="D1"),
             T("i-ru", "assign", "ru", "{link}"), T("d-ar", "assign", "ar", "{link}", department_id="D1"),
             T("off", "assign", "en", "{link}", department_id="D1", active=False)]
    assert tp.choose(items, purpose="assign", lang="he", department_id="D1").id == "d-he"
    assert tp.choose(items, purpose="assign", lang="ar", department_id="D1").id == "d-ar"
    assert tp.choose(items, purpose="assign", lang="ru", department_id="D1").id == "i-ru"
    # slice 5b reading (D26): the contact's language - its starter included - before any Hebrew text
    assert tp.choose(items, purpose="assign", lang="en", department_id="D1").id == "starter:assign:en"  # inactive en: the English starter
    assert tp.choose(items, purpose="assign", lang="ar", department_id="D2").id == "starter:assign:ar"
    hebrew_only = [T("c-he", "cost_approved", "he", "x")]
    assert tp.choose(hebrew_only, purpose="cost_approved", lang="xx", department_id=None).id == "c-he"  # an unknown language: the Hebrew text
    assert tp.choose([], purpose="assign", lang="ar", department_id=None).id == "starter:assign:ar"
    assert tp.choose([], purpose="assign", lang="xx", department_id=None).id == "starter:assign:he"
    assert tp.choose([], purpose="cost_approved", lang="he", department_id=None).id == "starter:cost_approved:he"  # slice 9 ships starters


def test_buttons_carry_the_nonce_and_the_contact_language():
    b = tp.buttons_for("0123456789abcdef", "ar")
    assert [x.id for x in b] == ["t:0123456789abcdef:ack", "t:0123456789abcdef:wip"] and b[0].text == "تم الاستلام"


def test_property_random_values_never_break_rendering():
    rng = random.Random(38)
    alphabet = "אבגabc{}|=\n‮​\x00#:/1 "
    for _ in range(300):
        params = {k: "".join(rng.choice(alphabet) for _ in range(rng.randint(0, 300))) for k in tp.PARAM_KEYS}
        for purpose in ("assign", "closed", "code"):
            for lang in channel.LANGS:
                text = tp.render(tp.STARTERS[purpose][lang], params, lang=lang, secrets={"link": LINK, "code": "123456"})
                assert len(text) <= tp.RENDERED_MAX
                assert "‮" not in text and "​" not in text and "\x00" not in text
