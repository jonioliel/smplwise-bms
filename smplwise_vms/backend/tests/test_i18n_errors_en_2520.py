"""I18N-REST-2520: the server's constant refusal texts reach an English user in English (smplwise/error_text.py, a table keyed by the
Hebrew text), the notification centre shows a notification's title and body in the reader's language (services/notify_policy_en.py),
and the calendar refusals are Hebrew again (they had been cp1255 mojibake since CAL-GRID-EDIT-2343). A Hebrew reader gets the same
bytes as before every time."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

from fastapi.testclient import TestClient

from smplwise import error_text
from smplwise.errors import ApiError, conflict, not_found
from smplwise.i18n import Msg, t
from smplwise.services import notify, notify_policy
from smplwise.services.notify_policy_en import TEMPLATES_EN

REPO = Path(__file__).resolve().parents[3]
PKG = REPO / "smplwise_vms" / "backend" / "smplwise"
API = "/api/v1"
HEB = re.compile("[֐-׿]")
SLOT = re.compile(r"\{(\w*)\}")
MOJIBAKE = re.compile("׳[\u0080-ÿ‐-›€™]׳[\u0080-ÿ‐-›€™]")


def _inventory_module():
    spec = importlib.util.spec_from_file_location("i18n_backend_errors", REPO / "scripts" / "i18n_backend_errors.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_the_table_is_english_and_keeps_the_placeholders():
    table = error_text.table()
    assert len(table) > 2000
    for he, en in table.items():
        assert HEB.search(he), he
        assert en.strip() and not HEB.search(en), (he, en)
        assert sorted(SLOT.findall(he)) == sorted(SLOT.findall(en)), (he, en)


def test_every_constant_refusal_has_its_english_and_run_time_texts_only_go_down():
    inv_mod = _inventory_module()
    inv = inv_mod.inventory()
    now = inv_mod.ratchet_of(inv)
    ratchet = json.loads((REPO / "docs" / "i18n" / "BE_ERRORS_EN_RATCHET.json").read_text(encoding="utf-8"))
    over = {m: n for m, n in now["missing"].items() if n > ratchet["missing"].get(m, 0)}
    assert not over, f"Hebrew refusal texts without English (add them to smplwise/error_text_en.json): {inv['missing']}"
    grown = {m: (ratchet["runtime"].get(m, 0), n) for m, n in now["runtime"].items() if n > ratchet["runtime"].get(m, 0)}
    assert not grown, f"new run-time (f-string) Hebrew refusal texts: make them a Msg of a catalogue (smplwise/i18n.py): {grown}"
    assert now["missingTotal"] <= ratchet["missingTotal"] and now["runtimeTotal"] <= ratchet["runtimeTotal"]


def test_the_inventory_finds_constants_helpers_and_f_strings(tmp_path: Path):
    inv_mod = _inventory_module()
    (tmp_path / "m.py").write_text(
        "from .errors import ApiError, conflict\n"
        "def a(x):\n"
        "    raise ApiError(409, 'c', 'הודעה ידועה')\n"
        "def b(x):\n"
        "    raise conflict('c', 'הודעה חדשה')\n"
        "def c(x):\n"
        "    raise _refuse(f'שם {x} תפוס')\n"
        "def d(x):\n"
        "    print('לא שגיאה')\n",
        encoding="utf-8",
    )
    inv = inv_mod.inventory(tmp_path, {"הודעה ידועה": "A known message"})
    assert set(inv["constants"]) == {"הודעה ידועה", "הודעה חדשה"}
    assert inv["missing"] == {"m.py": [("m.py:5", "הודעה חדשה")]}
    assert inv["runtime"] == {"m.py": 1}


def test_the_envelope_reads_the_table_in_english_only():
    he = "ההתראה לא נמצאה."
    assert error_text.english(he)
    e = ApiError(404, "notification_not_found", he)
    assert e.translatable()
    assert e.payload("c")["user_message"] == he and type(e.payload("c")["user_message"]) is str
    assert e.payload("c", lang="en")["user_message"] == error_text.english(he)
    # the order: a Msg first, then details.message_en, then the table, then the Hebrew as raised
    assert not_found().payload("c", lang="en")["user_message"] == "The resource was not found."
    own = conflict("x", he, message_en="Own words.")
    assert own.payload("c", lang="en")["user_message"] == "Own words."
    unknown = ApiError(409, "x", "טקסט שאינו בטבלה 2520")
    assert not unknown.translatable() and unknown.payload("c", lang="en")["user_message"] == "טקסט שאינו בטבלה 2520"
    assert error_text.english(t("error.forbidden")) is None  # a Msg renders itself
    assert error_text.english(Msg("error.not_found")) is None and error_text.english(None) is None


def test_an_english_user_gets_a_route_refusal_in_english(client: TestClient):
    c = TestClient(client.app, raise_server_exceptions=False)
    r = c.get(f"{API}/notifications/nope-2520")
    assert r.status_code == 404 and r.json()["user_message"] == "ההתראה לא נמצאה."
    assert c.put(f"{API}/me/prefs", json={"ui.lang": "en"}).status_code == 200
    r = c.get(f"{API}/notifications/nope-2520")
    assert r.status_code == 404 and r.json()["code"] == "notification_not_found"
    assert r.json()["user_message"] == error_text.english("ההתראה לא נמצאה.") and not HEB.search(r.json()["user_message"])


def test_no_mojibake_hebrew_in_the_server_sources():
    bad = [f"{p.relative_to(PKG).as_posix()}:{i}" for p in sorted(PKG.rglob("*.py"))
           for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1) if MOJIBAKE.search(line)]
    assert bad == []
    events = (PKG / "services" / "calendar" / "events.py").read_text(encoding="utf-8")
    assert '"האירוע לא נמצא."' in events and '"הזמן תפוס."' in events


# ---------------------------------------------------------------- notifications

def test_every_english_template_belongs_to_a_source_and_keeps_its_placeholders():
    for key, (title, body, resolve) in TEMPLATES_EN.items():
        s = notify_policy.BY_KEY[key]
        for he, en in ((s.title, title), (s.body, body), (s.resolve_text, resolve)):
            assert not HEB.search(en), (key, en)
            assert sorted(set(SLOT.findall(he))) == sorted(set(SLOT.findall(en))), (key, he, en)
    translatable = [s.key for s in notify_policy.SOURCES if s.title != "{title}"]
    assert sorted(translatable) == sorted(TEMPLATES_EN)


def test_render_in_english_and_hebrew_unchanged():
    params = {"name": "חיישן מטבח", "place": "קומה 1"}
    assert notify_policy.render("sensor.leak", params) == ("דליפת מים", "חיישן מטבח דיווח על מים.")
    assert notify_policy.render("sensor.leak", params, "he") == ("דליפת מים", "חיישן מטבח דיווח על מים.")
    title, body = notify_policy.render("sensor.leak", params, "en")
    assert title == TEMPLATES_EN["sensor.leak"][0] and "חיישן מטבח" in body and not HEB.search(body.replace("חיישן מטבח", ""))
    # a body built from the signal's own template stays as written
    own = {"name": "x", "_template": "טקסט משלו {name}"}
    assert notify_policy.render("sensor.leak", own, "en")[1] == "טקסט משלו x"


class _Conn:
    """The reader's language for _in_reader_language (default_names.lang_of reads user_prefs)."""

    def __init__(self, lang: str | None):
        self.lang = lang

    def execute(self, sql: str, args=()):
        lang = self.lang

        class _R:
            def fetchone(self_inner):
                return None if lang is None else (json.dumps(lang),)

        return _R()


class _P:
    user_id = "u-2520"


def _row(title: str, body: str, params: dict) -> dict:
    return {"id": "n1", "source": "sensor.leak", "title": title, "body": body, "params": params}


def test_the_notification_centre_shows_the_reader_language():
    params = {"name": "חיישן מטבח"}
    he_title, he_body = notify_policy.render("sensor.leak", params)
    out = {"title": he_title, "body": he_body}
    notify._in_reader_language(_Conn("en"), _P(), _row(he_title, he_body, params), out)
    assert out == dict(zip(("title", "body"), notify_policy.render("sensor.leak", params, "en")))
    # Hebrew reader / no preference: untouched
    for lang in ("he", None):
        out = {"title": he_title, "body": he_body}
        notify._in_reader_language(_Conn(lang), _P(), _row(he_title, he_body, params), out)
        assert out == {"title": he_title, "body": he_body}
    # a row worded otherwise than the source's templates give (an older version) is shown as stored
    out = {"title": he_title, "body": "נוסח ישן"}
    notify._in_reader_language(_Conn("en"), _P(), _row(he_title, "נוסח ישן", params), out)
    assert out == {"title": he_title, "body": "נוסח ישן"}
