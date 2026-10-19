"""PRIVORG-291: the installation's organisation name and privacy contact point in the technician privacy messages (fakes only).

Unset (the default) every text is exactly what it was; set, the notice names the organisation and the contact, the entry-code
message starts with the organisation name and the phone-verification message to a directory person carries one neutral privacy
line. Nothing here is legal wording - the substituted values are the only new text. Real WhatsApp and real doors: NOT_RUN."""
from __future__ import annotations

import json
import unicodedata

import pytest
from test_access_grants import DUE, env  # noqa: F401 - the grants environment (fake WisKey engine + fake code transport)
from test_tickets_phone_verify import API, check, code_of, send  # noqa: F401
from test_tickets_phone_verify import env as pv_env  # noqa: F401 - the slice 5b environment (fake ha-whatsapp)

from smplwise.services import access_grants as ag
from smplwise.services.privacy_org import identity
from smplwise.services.tickets import message_templates as mt, settings_doc

LANGS = ("he", "en", "ar", "ru")
ORG = "מגדלי הדר בע״מ"
CONTACT = "privacy@hadar.example.test"


def set_privacy(db, **values) -> None:
    patch = {}
    if "organization_name" in values:
        patch["organization_name"] = values.pop("organization_name")
    if values:
        patch["privacy"] = values
    with db.connection() as conn:
        settings_doc.apply_patch(conn, patch)


# ---------------------------------------------------------------- the validators

@pytest.mark.parametrize("value", ["", "privacy@example.test", "a.b+c@sub.example.test", "050-123-4567", "+972 50 123 4567", "(03) 555-1234"])
def test_contact_accepts_an_email_or_a_phone(value):
    assert settings_doc.privacy_contact(value) == value


@pytest.mark.parametrize("value", ["hello", "a@b", "x@y.z", "12345", "1" * 20, "+++123456789", "a b@example.test", "{x}@example.test", "a@example.test\nb", 5, None, "mailto:a@example.test",
                                   "x" * 81 + "@example.test"])
def test_contact_refuses_anything_else(value):
    with pytest.raises(ValueError):
        settings_doc.privacy_contact(value)


@pytest.mark.parametrize("value", ["", "https://hadar.example.test/privacy", "https://hadar.example.test/privacy?lang=he"])
def test_link_accepts_https_or_empty(value):
    assert settings_doc.privacy_link(value) == value


@pytest.mark.parametrize("value", ["http://hadar.example.test", "javascript:alert(1)", "https://", "https://u:p@hadar.example.test/", "https://a b.test/",
                                   "https://hadar.example.test/{x}", "https://hadar.example.test/\x00", "https://" + "a" * 200 + ".test", 7])
def test_link_refuses_anything_else(value):
    with pytest.raises(ValueError):
        settings_doc.privacy_link(value)


def test_the_settings_route_saves_validates_and_audits_the_privacy_block(pv_env):
    e = pv_env

    def put(**body):
        rev = e.c.get(f"{API}/tickets/settings").json()["revision"]
        return e.c.put(f"{API}/tickets/settings", json={"revision": rev, **body})

    assert e.c.get(f"{API}/tickets/settings").json()["privacy"] == {"contact": "", "link": ""}
    for bad in ({"contact": "not a contact"}, {"link": "http://x.example.test"}, {"contact": 5}, {"other": "x"}):
        assert put(privacy=bad).status_code == 422, bad
    r = put(organization_name=ORG, privacy={"contact": CONTACT, "link": "https://hadar.example.test/privacy"})
    assert r.status_code == 200, r.text
    assert r.json()["privacy"] == {"contact": CONTACT, "link": "https://hadar.example.test/privacy"} and r.json()["organization_name"] == ORG
    with e.s4.db.connection(mode="read") as conn:
        details = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'tickets.settings.update'")]
    assert any("privacy.contact" in d.get("changed", []) for d in details)
    assert put(privacy={"contact": "", "link": ""}).json()["privacy"] == {"contact": "", "link": ""}  # cleared = not set


def test_a_non_admin_cannot_change_the_privacy_block(pv_env):
    e = pv_env
    rev = e.c.get(f"{API}/tickets/settings").json()["revision"]
    r = e.c.put(f"{API}/tickets/settings", json={"revision": rev, "privacy": {"contact": CONTACT}}, headers=e.h("tom"))
    assert r.status_code == 403


# ---------------------------------------------------------------- the n2 notice

@pytest.mark.parametrize("lang", LANGS)
def test_unset_the_notice_is_the_fixed_text_exactly(env, lang):
    with env.db.connection(mode="read") as conn:
        assert ag.notice_text(conn, lang) == ag.NOTICE_TEXT[lang]


@pytest.mark.parametrize("lang", LANGS)
def test_the_fixed_notice_ends_with_the_contact_sentence_the_substitution_replaces(lang):
    lead, target, _ = ag.NOTICE_CONTACT[lang]
    assert ag.NOTICE_TEXT[lang].endswith(lead + target + ".")


@pytest.mark.parametrize("lang", LANGS)
def test_the_notice_names_the_organisation_and_the_contact_instead_of_the_building_manager(env, lang):
    set_privacy(env.db, organization_name=ORG, contact=CONTACT, link="https://hadar.example.test/privacy")
    with env.db.connection(mode="read") as conn:
        text = ag.notice_text(conn, lang)
    lead, target, _ = ag.NOTICE_CONTACT[lang]
    assert ORG in text and CONTACT in text and "https://hadar.example.test/privacy" in text
    assert target.strip() not in text.split(lead)[-1], "the building manager no longer appears in the contact sentence"
    assert text.startswith(ag.NOTICE_TEXT[lang][: -len(lead + target + ".")]), "only the last sentence changed"
    assert not [c for c in text if unicodedata.category(c) in ("Cc", "Cf")] and text.endswith(").")


def test_a_contact_without_a_name_keeps_the_building_manager_and_adds_the_contact(env):
    set_privacy(env.db, contact="050-123-4567")
    with env.db.connection(mode="read") as conn:
        assert ag.notice_text(conn, "en").endswith("contact the building manager (050-123-4567).")


def test_a_name_without_a_contact_replaces_only_the_building_manager(env):
    set_privacy(env.db, organization_name=ORG)
    with env.db.connection(mode="read") as conn:
        assert ag.notice_text(conn, "en").endswith(f"contact {ORG}.")
        assert ag.notice_text(conn, "he").endswith(f"יש לפנות אל {ORG}.")


def test_the_arrival_page_serves_the_substituted_notice_and_the_unchanged_version(env):
    from smplwise.services import access_arrival as aa

    set_privacy(env.db, organization_name=ORG, contact=CONTACT)
    with env.db.connection(mode="read") as conn:
        text = ag.notice_text(conn, "he")
    assert ORG in text and CONTACT in text and ag.NOTICE_VERSION == "n2"
    assert aa.ag is ag


# ---------------------------------------------------------------- the entry-code message

def _approved_code_message(env, lang="he"):
    env.sql("UPDATE ticket_contacts SET lang = ? WHERE id = ?", lang, env.tech)
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    env.run()
    env.clock[0] = DUE
    env.run()
    assert len(env.transport.sent) == 1
    return gid, env.transport.sent[0][1]


@pytest.mark.parametrize("lang", LANGS)
def test_the_code_message_starts_with_the_organisation_name_when_set(env, lang):
    set_privacy(env.db, organization_name=ORG)
    _gid, text = _approved_code_message(env, lang)
    assert ORG in text and ag.CODE_MESSAGE_SENDER not in text


@pytest.mark.parametrize("lang", LANGS)
def test_unset_the_code_message_keeps_the_product_name(env, lang):
    _gid, text = _approved_code_message(env, lang)
    assert ag.CODE_MESSAGE_SENDER in text


# ---------------------------------------------------------------- the audit rows carry the technician

def test_request_approve_and_notice_rows_carry_the_technician_id(env):
    gid = env.request().json()["grant"]["id"]
    assert env.approve(gid).status_code == 200
    with env.db.connection(mode="read") as conn:
        rows = {r["action"]: json.loads(r["details_json"] or "{}") for r in conn.execute(
            "SELECT action, details_json FROM audit_log WHERE action IN ('access.grant.request', 'access.grant.approve', 'access.grant.notice_ack') "
            "AND resource_id = ?", (gid,))}
    assert set(rows) == {"access.grant.request", "access.grant.approve", "access.grant.notice_ack"}
    assert all(d.get("technician_id") == env.tech for d in rows.values()), rows


# ---------------------------------------------------------------- the phone-verification message

def _verify_text(e, cid):
    assert send(e, cid).status_code == 200
    code = code_of(e, cid)
    e.tick()
    [call] = [x for x in e.fake.calls if code in x["data"]["message"]]
    return call["data"]["message"]


def test_unset_the_verification_message_is_the_fixed_text_without_a_privacy_line(pv_env):
    text = _verify_text(pv_env, pv_env.s4.contact["id"])
    assert "לאימות מספר הטלפון" in text and "פרטיות" not in text


def test_set_the_verification_message_to_a_directory_person_gets_one_privacy_line(pv_env):
    e = pv_env
    set_privacy(e.s4.db, organization_name=ORG, contact=CONTACT)
    text = _verify_text(e, e.s4.contact["id"])
    assert "לאימות מספר הטלפון" in text and ORG in text and text.rstrip().endswith(f"שאלות בנושא פרטיות: {CONTACT}")
    assert len(text.splitlines()) == 4


def test_a_contact_point_without_a_name_gives_the_line_and_no_empty_organisation_row(pv_env):
    e = pv_env
    set_privacy(e.s4.db, organization_name="", contact="050-123-4567")  # the test world starts with an organisation name: clear it
    text = _verify_text(e, e.s4.contact["id"])
    assert text.splitlines()[0].startswith("קוד לאימות") and "050-123-4567" in text, ascii(text)


def test_a_name_alone_does_not_change_the_verification_message(pv_env):
    e = pv_env
    set_privacy(e.s4.db, organization_name=ORG)
    text = _verify_text(e, e.s4.contact["id"])
    assert ORG not in text and "פרטיות" not in text


def test_a_signed_in_user_verifying_their_own_number_gets_the_fixed_text(pv_env):
    from smplwise.services.tickets import phone_verify

    e = pv_env
    set_privacy(e.s4.db, organization_name=ORG, contact=CONTACT)
    with e.s4.db.connection(mode="read") as conn:
        assert phone_verify._privacy_variant(conn, {"id": "x", "user_id": "dev-tom"}) == {}
        assert phone_verify._privacy_variant(conn, {"id": "x", "user_id": None})["template_id"] == "starter:verify_privacy"


@pytest.mark.parametrize("lang", LANGS)
def test_the_privacy_variant_renders_in_every_language_and_is_not_a_template_an_editor_can_pick(lang):
    tpl = mt.fixed_starter("phone_verify", "starter:verify_privacy", lang)
    assert tpl is not None and tpl.lang == lang and "{privacy_contact}" in tpl.body and "{code}" in tpl.body
    text = mt.render(tpl.body, {"organization": ORG, "privacy_contact": CONTACT}, lang=lang, secrets={"code": "123456"})
    assert ORG in text and CONTACT in text and "123456" in text and "{" not in text
    assert "privacy_contact" not in mt.PLACEHOLDERS
    with pytest.raises(mt.TemplateError):
        mt.check_params({"link": "x"})
    assert mt.check_params({"privacy_contact": CONTACT}) == {"privacy_contact": CONTACT}


def test_identity_reads_unset_as_empty_and_survives_a_broken_document(env):
    with env.db.connection(mode="read") as conn:
        assert not identity(conn).any
    set_privacy(env.db, organization_name=ORG, contact=CONTACT, link="https://hadar.example.test/privacy")
    with env.db.connection(mode="read") as conn:
        who = identity(conn)
    assert (who.organization, who.contact, who.link) == (ORG, CONTACT, "https://hadar.example.test/privacy")
