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


# ---------------------------------------------------------------- PRIVTEXT-293: the technician-only verification message

def _make_technician(db, cid, *, accepted=True):
    with db.connection() as conn:
        conn.execute("INSERT INTO access_pending_contacts(contact_id, vendor_id, created_by, created_at, accepted_by, accepted_at) VALUES (?,?,?,?,?,?)",
                     (cid, "v1", "contact:x", "2026-10-01T08:00:00Z", "u1" if accepted else None, "2026-10-02T08:00:00Z" if accepted else None))


def _variant(db, cid, user_id=None):
    from smplwise.services.tickets import phone_verify

    with db.connection(mode="read") as conn:
        return phone_verify._privacy_variant(conn, {"id": cid, "user_id": user_id})


@pytest.mark.parametrize("contact", ["", CONTACT])
def test_a_vendor_contact_never_gets_entry_records(pv_env, contact):
    e = pv_env
    set_privacy(e.s4.db, organization_name=ORG, contact=contact)
    text = _verify_text(e, e.s4.contact["id"])
    assert "רישומי הכניסה" not in text and ag.NOTICE_SHORT["he"] not in text
    for lang in LANGS:  # whatever variant a non-technician gets, in any language, it never carries the technician notice
        for body in (mt.STARTERS["phone_verify"][lang], mt.FIXED_STARTERS["portal_code"][lang], mt.FIXED_STARTERS["verify_privacy"][lang]):
            assert ag.NOTICE_SHORT[lang] not in body
    assert "technician" not in _variant(e.s4.db, e.s4.contact["id"]).get("template_id", "")


def test_a_signed_in_user_never_gets_the_technician_variant(pv_env):
    e = pv_env
    _make_technician(e.s4.db, e.s4.contact["id"])
    assert _variant(e.s4.db, e.s4.contact["id"], user_id="dev-tom") == {}


def test_is_technician_follows_the_one_shared_definition(pv_env):
    import inspect

    from smplwise.services import needs_review

    cid = pv_env.s4.contact["id"]
    db = pv_env.s4.db
    with db.connection(mode="read") as conn:
        assert ag.is_technician(conn, cid) is False and ag.is_technician(conn, "missing") is False
    _make_technician(db, cid, accepted=False)  # waiting for a manager: not a technician yet
    with db.connection(mode="read") as conn:
        assert ag.is_technician(conn, cid) is False
    with db.connection() as conn:
        conn.execute("UPDATE access_pending_contacts SET accepted_by = 'u1', accepted_at = '2026-10-02T08:00:00Z' WHERE contact_id = ?", (cid,))
    with db.connection(mode="read") as conn:
        assert ag.is_technician(conn, cid) is True
    with db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET erased_at = '2026-10-03T08:00:00Z' WHERE id = ?", (cid,))
    with db.connection(mode="read") as conn:
        assert ag.is_technician(conn, cid) is False
    assert "ag.TECHNICIAN_SQL" in inspect.getsource(needs_review.idle_rows), "the report and the message share one definition"


def test_a_grant_row_makes_a_contact_a_technician(env):  # noqa: F811
    with env.db.connection(mode="read") as conn:  # a grant row makes a contact one
        assert ag.is_technician(conn, env.tech) is False
    assert env.request().status_code == 200
    with env.db.connection(mode="read") as conn:
        assert ag.is_technician(conn, env.tech) is True


@pytest.mark.parametrize("lang", LANGS)
def test_the_technician_variant_renders_in_every_language(lang):
    import re

    base = mt.fixed_starter("phone_verify", "starter:verify_technician", lang)
    tpl = mt.fixed_starter("phone_verify", "starter:verify_technician_contact", lang)
    assert tpl is not None and tpl.lang == lang and "{code}" in tpl.body and "{privacy_contact}" in tpl.body and "{privacy_contact}" not in base.body
    assert ag.NOTICE_SHORT[lang] in tpl.body and ag.NOTICE_SHORT[lang] in base.body, "the short notice, word for word"
    full = mt.render(tpl.body, {"organization": ORG, "privacy_contact": CONTACT}, lang=lang, secrets={"code": "123456"})
    bare = mt.render(base.body, {}, lang=lang, secrets={"code": "123456"})
    assert "123456" in full and "{" not in full and ORG in full and CONTACT in full
    assert ORG not in bare and "{" not in bare and len(bare.splitlines()) == len(full.splitlines()) - 2, "organisation and contact lines drop out"
    assert "http" not in full and "www" not in full and len(full) < mt.RENDERED_MAX
    assert not [c for c in full if unicodedata.category(c) in ("Cc", "Cf") and c != "\n"]
    own = {"he": "[\u0590-\u05FF]", "ar": "[\u0600-\u06FF]", "ru": "[\u0400-\u04FF]"}
    for other, pattern in own.items():
        assert bool(re.search(pattern, bare)) == (other == lang), (lang, other)


def test_the_technician_variant_is_code_owned():
    for name in ("verify_technician", "verify_technician_contact"):
        assert set(mt.FIXED_STARTERS[name]) == set(LANGS) and name in mt.FIXED_VARIANTS["phone_verify"] and name not in mt.FIXED_VARIANTS.get("assign", ())
        for lang, body in mt.FIXED_STARTERS[name].items():
            assert mt.problems("phone_verify", body.replace("{privacy_contact}", "x")) == [], (name, lang)
    # a stored/foreign template id never selects it for another purpose
    assert mt.fixed_starter("assign", "starter:verify_technician", "en").body != mt.FIXED_STARTERS["verify_technician"]["en"]


def test_a_name_alone_gives_a_technician_the_notice_without_a_privacy_line(pv_env):
    e = pv_env
    _make_technician(e.s4.db, e.s4.contact["id"])
    set_privacy(e.s4.db, organization_name=ORG, contact="")
    text = _verify_text(e, e.s4.contact["id"])
    assert ag.NOTICE_SHORT["he"] in text and ORG in text and "שאלות בנושא פרטיות" not in text and len(text.splitlines()) == 4


def test_a_technician_end_to_end_gets_the_notice_and_the_audit_row_has_no_text(pv_env):
    e = pv_env
    cid = e.s4.contact["id"]
    _make_technician(e.s4.db, cid)
    set_privacy(e.s4.db, organization_name=ORG, contact=CONTACT)
    text = _verify_text(e, cid)
    assert ag.NOTICE_SHORT["he"] in text and text.rstrip().endswith(f"שאלות בנושא פרטיות: {CONTACT}")
    with e.s4.db.connection(mode="read") as conn:
        rows = [json.loads(r["details_json"]) for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.contact.phone_verify_send' AND decision = 'allowed'")]
    assert rows and rows[-1].get("technician_notice") is True and all(ag.NOTICE_SHORT["he"] not in json.dumps(r, ensure_ascii=False) for r in rows)
