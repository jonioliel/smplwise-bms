"""CR-038 owner decision D33 - the module's user-facing name is configurable (one singular / plural pair per language, plus the
grammatical gender) and every user-facing text goes through ONE helper (services/tickets/naming.py; the screens'
frontend/src/tickets/naming.ts). Proven here: the defaults, the token rendering (incl. gender agreement), validation (length, no markup,
no control characters), the revision-checked save behind tickets.configure with its audit row, the name reaching /me, /tickets/module,
the role names and the permission labels the screens show - and the lint: no tickets source hardcodes the default name."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.rbac import ROLE_NAMES_HE, ROLES
from smplwise.routers.access import PERMISSION_LABELS
from smplwise.services.tickets import naming

API = "/api/v1"
BACKEND = Path(__file__).resolve().parents[1] / "smplwise"
DEFAULT_WORDS = re.compile(r"קריא(ה|ות|ת|תך|ותיך|ות)|בקש(ת|ות) ה?שירות|ניהול השירות|\bTickets?\b")
TICKETS_SOURCES = sorted((BACKEND / "services" / "tickets").glob("*.py")) + [BACKEND / "routers" / "tickets.py", BACKEND / "routers" / "tickets_admin.py"]
NAME = {"one": "תקלה", "many": "תקלות", "gender": "f"}
NAME_STORED = {**NAME, "module": "תקלות"}  # no module sent: the module's name is the plural (owner rename 2026-10-14)
MASCULINE = {"one": "דיווח", "many": "דיווחים", "gender": "m"}
# Owner rename 2026-10-14: the module "ניהול השירות", the item "בקשת שירות" / "בקשות שירות". The old words must not come back in any
# user-visible text of the module (sources, labels, role names, the Hebrew guide chapter) - see test_the_old_name_is_gone_*.
OLD_WORDS = re.compile(r"קריא(ה|ות|ת)")
REPO = BACKEND.parents[2]


@pytest.fixture()
def c(settings):
    client = TestClient(create_app(settings))
    client.get(f"{API}/me")  # joni: the bootstrap system administrator
    assert client.patch(f"{API}/settings", json={"tickets.enabled": "true"}).status_code == 200
    return client


# ---------------------------------------------------------------- the helper

def test_defaults_per_language():
    assert naming.DEFAULTS["he"] == {"one": "בקשת שירות", "many": "בקשות שירות", "gender": "f", "module": "ניהול השירות"}
    assert naming.DEFAULTS["en"] == {"one": "Ticket", "many": "Tickets", "gender": "", "module": "Tickets"}
    assert set(naming.DEFAULTS) == set(naming.LANGS) == {"he", "en", "ar", "ru"}
    for lang, entry in naming.DEFAULTS.items():
        assert naming.clean_name(entry["one"], "x") == entry["one"] and naming.clean_name(entry["many"], "x") == entry["many"], lang
        assert entry["gender"] in naming.GENDERS[lang]


def test_render_tokens_and_gender_agreement():
    t = "{ticket} {f:חדשה|m:חדש} · כל {the_tickets} · {f:סגורה|m:סגור}"
    assert naming.render(t, naming.DEFAULTS["he"]) == "בקשת שירות חדשה · כל בקשות השירות · סגורה"
    assert naming.render("{module} · סגירת {the_ticket}", naming.DEFAULTS["he"]) == "ניהול השירות · סגירת בקשת השירות"
    assert naming.render("{the_ticket} {f:נפתחה|m:נפתח}", NAME) == "התקלה נפתחה"
    assert naming.render("{module}", NAME) == "תקלות", "no module name: the plural"
    assert [naming.definite(n) for n in ("בקשת שירות", "ניהול השירות", "הזמנה", "Work-order")] == ["בקשת השירות", "ניהול השירות", "ההזמנה", "Work-order"]
    assert naming.render(t, MASCULINE) == "דיווח חדש · כל הדיווחים · סגור"
    assert naming.render("{f:Новая|m:Новый|n:Новое} {ticket}", {"one": "Дело", "many": "Дела", "gender": "n"}) == "Новое Дело"
    assert naming.render("{f:Новая|m:Новый|n:Новое}", {"one": "a", "many": "b", "gender": "f"}) == "Новая"
    assert naming.render("no tokens {here}", NAME) == "no tokens {here}", "only the module's tokens are replaced"
    assert naming.has_tokens("פתיחת {ticket}") and not naming.has_tokens("פתיחה")


@pytest.mark.parametrize("value, code", [
    ("", "required"), ("   ", "required"), ("x" * 31, "too_long"), ("<b>בקשה</b>", "character"), ("{tickets}", "character"),
    ("קרי‮אה", "control_character"), ("שורה\nשנייה", "control_character"), ("12345", "no_letter"), ("a&b", "character"),
    ("בקשה/תקלה", "character"),
])
def test_name_validation(value, code):
    with pytest.raises(naming.NameInvalid) as e:
        naming.clean_name(value, "he.one")
    assert e.value.code == code, value


def test_name_cleaning_keeps_hebrew_typography():
    assert naming.clean_name("  בקשות   שירות ", "x") == "בקשות שירות"
    assert naming.clean_name("פנייה (מוקד)", "x") == "פנייה (מוקד)"
    assert naming.clean_name("תק״ש", "x") == "תק״ש"
    assert naming.clean_name("Work-order", "x") == "Work-order"


@pytest.mark.parametrize("raw, expected", [
    ("not json", naming.DEFAULTS["he"]),
    (json.dumps([1, 2]), naming.DEFAULTS["he"]),
    (json.dumps({"he": {"one": "<x>", "many": "y"}}), naming.DEFAULTS["he"]),
    (json.dumps({"he": {"one": "a", "many": "b", "gender": "q"}}), {"one": "a", "many": "b", "gender": "f", "module": "b"}),  # an unknown gender: the default
    (json.dumps({"he": {"one": "a", "many": "b", "gender": "f", "module": "<x>"}}), {"one": "a", "many": "b", "gender": "f", "module": "b"}),
])
def test_a_corrupt_or_invalid_stored_name_reads_as_the_default(c, raw, expected):
    db = c.app.state.db
    with db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES('tickets.name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (raw,))
    with db.connection(mode="read") as conn:
        doc = naming.read(conn)
    assert doc["he"] == expected and doc["en"] == naming.DEFAULTS["en"]


# ---------------------------------------------------------------- the API

def test_saving_the_name_needs_the_module_settings_permission_and_is_audited(c, settings):
    bind(c, settings, "otto", "operator", "installation", "*")
    r = c.put(f"{API}/tickets/name", json={"revision": 0, "he": NAME}, headers=as_user("otto"))
    assert r.status_code == 403
    r = c.put(f"{API}/tickets/name", json={"revision": 0, "he": NAME})
    assert r.status_code == 200, r.text
    assert r.json()["he"] == NAME_STORED and r.json()["revision"] == 1 and r.json()["en"] == naming.DEFAULTS["en"]
    assert c.put(f"{API}/tickets/name", json={"revision": 0, "he": MASCULINE}).json()["code"] == "settings_stale"
    bad = c.put(f"{API}/tickets/name", json={"revision": 1, "he": {"one": "<i>x</i>", "many": "y", "gender": "f"}})
    assert bad.status_code == 422 and bad.json()["details"]["fields"][0] == {"field": "he.one", "code": "character"}
    bad = c.put(f"{API}/tickets/name", json={"revision": 1, "he": {"one": "תקלה", "many": "תקלות", "gender": "x"}})
    assert bad.status_code == 422 and bad.json()["details"]["fields"][0]["field"] == "he.gender"
    # a holder of the single-permission grant role tickets_configure may rename (D25: grantable to one person)
    bind(c, settings, "cora", "tickets_configure", "installation", "*")
    assert c.put(f"{API}/tickets/name", json={"revision": 1, "he": MASCULINE}, headers=as_user("cora")).status_code == 200
    with c.app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT actor_username, decision, details_json FROM audit_log WHERE action = 'tickets.name.update' ORDER BY id").fetchall()
    assert [(r["actor_username"], r["decision"]) for r in rows] == [("joni", "allowed"), ("cora", "allowed")]
    assert json.loads(rows[0]["details_json"]) == {"revision": 1, "languages": ["he"]}


def test_the_name_reaches_me_the_module_state_role_names_and_permission_labels(c, settings):
    assert c.put(f"{API}/tickets/name", json={"revision": 0, "he": NAME}).status_code == 200
    me = c.get(f"{API}/me").json()
    assert me["modules"] == {"notices": False, "tickets": True, "tickets_name": {**{k: naming.DEFAULTS[k] for k in naming.LANGS}, "he": NAME_STORED}, "tickets_long_press": "sheet", "incidents": False, "announce": False}  # CR-LIVEEVENT100: the live event switch (OFF); FIX2200: the announcements switch (OFF)
    module = c.get(f"{API}/tickets/module").json()
    assert module["name"]["he"] == NAME_STORED and module["name_revision"] == 1, "the revision the settings editor sends back with a rename"
    roles = c.get(f"{API}/access/roles").json()
    by_id = {r["id"]: r["name"] for r in roles["roles"]}
    assert by_id["tickets_view"] == "צפייה בתקלות" and by_id["tickets_create"] == "פתיחת תקלות" and by_id["tickets_configure"] == "הגדרות תקלות"
    assert roles["labels"]["tickets.view"] == "תקלות: צפייה"
    assert not any("{" in v for v in roles["labels"].values()), "no token ever reaches a screen"
    bind(c, settings, "vera", "tickets_view", "installation", "*")
    assert c.get(f"{API}/me", headers=as_user("vera")).json()["bindings"][0]["role_name"] == "צפייה בתקלות"
    preview = c.post(f"{API}/access/preview", json={"user_id": "dev-vera"}).json()
    assert preview["labels"]["tickets.manage"].startswith("תקלות:")
    # a custom role may not take a built-in role's (rendered) name
    assert c.post(f"{API}/access/roles", json={"name": "צפייה בתקלות", "permissions": ["map.read"]}).json()["code"] == "role_name_taken"


def test_server_messages_use_the_configured_name(c):
    c.put(f"{API}/tickets/name", json={"revision": 0, "he": MASCULINE})
    r = c.get(f"{API}/tickets/aaaaaaaaaaaaaaaa")
    assert r.status_code == 404 and r.json()["code"] == "ticket_not_found" and r.json()["user_message"] == "הדיווח לא נמצא."
    c.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    assert c.get(f"{API}/tickets").json()["user_message"] == "מודול הדיווחים כבוי בהגדרות המערכת."


# ---------------------------------------------------------------- the lint (D33: nothing hardcodes the default name)

def _strip_comments_and_docstrings(src: str) -> str:
    src = re.sub(r'"""[\s\S]*?"""', '""', src)
    return "\n".join(line.split("#", 1)[0] if not line.lstrip().startswith(("'", '"')) else line for line in src.splitlines())


@pytest.mark.parametrize("path", TICKETS_SOURCES, ids=lambda p: p.name)
def test_no_tickets_source_hardcodes_the_default_name(path):
    if path.name == "naming.py":
        pytest.skip("the defaults live here")
    code = _strip_comments_and_docstrings(path.read_text(encoding="utf-8"))
    hits = [ln.strip()[:100] for ln in code.splitlines() if DEFAULT_WORDS.search(ln)]
    assert not hits, f"{path.name} writes the module's name instead of a {{ticket}} / {{tickets}} token: {hits}"


def test_ticket_permission_labels_and_role_names_carry_the_token():
    for p in ("tickets.view", "tickets.create", "tickets.manage", "tickets.external", "tickets.all_departments", "tickets.configure"):
        assert "{module}" in PERMISSION_LABELS[p] and not DEFAULT_WORDS.search(PERMISSION_LABELS[p]), p
    for rid in ROLES:
        if rid.startswith("tickets_"):
            assert naming.has_tokens(ROLE_NAMES_HE[rid]) and not DEFAULT_WORDS.search(ROLE_NAMES_HE[rid]), rid
    assert naming.render(PERMISSION_LABELS["tickets.view"], naming.DEFAULTS["he"]) == "ניהול השירות: צפייה"


def test_a_saved_module_name_is_kept_and_reaches_the_labels(c):
    r = c.put(f"{API}/tickets/name", json={"revision": 0, "he": {**NAME, "module": "מוקד אחזקה"}})
    assert r.status_code == 200 and r.json()["he"]["module"] == "מוקד אחזקה"
    assert c.get(f"{API}/access/roles").json()["labels"]["tickets.view"] == "מוקד אחזקה: צפייה"
    bad = c.put(f"{API}/tickets/name", json={"revision": 1, "he": {**NAME, "module": "<b>"}})
    assert bad.status_code == 422 and bad.json()["details"]["fields"][0]["field"] == "he.module"


# ---------------------------------------------------------------- the owner rename lint (2026-10-14): the old words are gone

def _module_sources() -> list[Path]:
    b = BACKEND
    out = sorted((b / "services" / "tickets").glob("*.py")) + sorted(b.glob("routers/tickets*.py"))
    out += [b / "routers" / "messaging_accounts.py", b / "services" / "messaging_accounts.py", b / "services" / "messaging_runtime.py"]
    return [p for p in out if p.exists()]


@pytest.mark.parametrize("path", _module_sources(), ids=lambda p: p.name)
def test_the_old_name_is_gone_from_every_module_source(path):
    """Every string of the module's server code (messages, templates, labels) - comments and docstrings included, except naming.py's
    own description of the rename."""
    src = path.read_text(encoding="utf-8")
    if path.name == "naming.py":
        src = _strip_comments_and_docstrings(src)
    hits = [f"{i}: {ln.strip()[:100]}" for i, ln in enumerate(src.splitlines(), 1) if OLD_WORDS.search(ln)]
    assert not hits, f"{path.name}: the owner renamed the item to 'בקשת שירות' / 'בקשות שירות' (module 'ניהול השירות'): {hits}"


def test_the_old_name_is_gone_from_labels_role_names_and_the_guide():
    assert not [k for k, v in PERMISSION_LABELS.items() if k.startswith("tickets.") and OLD_WORDS.search(v)]
    assert not [r for r in ROLES if r.startswith("tickets_") and OLD_WORDS.search(ROLE_NAMES_HE[r])]
    for lang in naming.LANGS:
        assert not any(OLD_WORDS.search(v) for v in naming.DEFAULTS[lang].values()), lang
    guide = REPO / "docs" / "user-guide" / "he"
    chapters = sorted(guide.glob("46-*_HE.md"))
    assert chapters, "the Hebrew guide chapter of the module"
    for ch in chapters:
        hits = [f"{i}: {ln.strip()[:80]}" for i, ln in enumerate(ch.read_text(encoding="utf-8").splitlines(), 1) if OLD_WORDS.search(ln)]
        assert not hits, f"{ch.name}: {hits}"


def test_the_rename_lint_catches_a_planted_line():
    for planted in ("ה{ticket} נפתחה - קריאה חדשה", "כל הקריאות", "קריאת שירות"):
        assert OLD_WORDS.search(planted), planted
    assert DEFAULT_WORDS.search("פתיחת בקשת שירות") and DEFAULT_WORDS.search("ניהול השירות")
    for ok in ("{the_ticket} {f:נפתחה|m:נפתח}", "סגירת {the_ticket}", "פתיחה"):
        assert not OLD_WORDS.search(ok) and not DEFAULT_WORDS.search(ok), ok


ARTICLE_BEFORE_TOKEN = re.compile(r"(?<![א-ת])ה\{tickets?\}")


@pytest.mark.parametrize("path", _module_sources() + [BACKEND / "routers" / "access.py", BACKEND / "roles.json"], ids=lambda p: p.name)
def test_no_text_puts_the_article_in_front_of_a_name_token(path):
    """'ה' + {ticket} renders 'הבקשת שירות' with a two-word name: the article tokens {the_ticket} / {the_tickets} are the only way."""
    hits = [f"{i}: {ln.strip()[:100]}" for i, ln in enumerate(path.read_text(encoding="utf-8").splitlines(), 1) if ARTICLE_BEFORE_TOKEN.search(ln)]
    assert not hits, f"{path.name}: write {{the_ticket}} / {{the_tickets}}: {hits}"
    assert ARTICLE_BEFORE_TOKEN.search('"ה{ticket} נפתחה"') and not ARTICLE_BEFORE_TOKEN.search('"{the_ticket}"')
