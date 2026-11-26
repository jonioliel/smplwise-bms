"""I18N-RUNTIME-ERRORS-2520: the refusal texts built at run time (names and numbers inside the sentence) reach an English user in English.

Each former f-string is now `tpl(<Hebrew template>, **params)` (smplwise/error_text.py): its value is byte for byte the f-string it replaced,
its English template is in smplwise/error_text_tpl_en.json ("templates"), and a param that is a fixed word of the product (an operation's
name, a state, a weekday) is rendered through "words" (or the constant refusal table). A Hebrew reader gets the same bytes as before."""
from __future__ import annotations

import copy
import importlib.util
import json
import pickle
import re
from pathlib import Path

from fastapi.testclient import TestClient

from smplwise import error_text
from smplwise.error_text import Tpl, tpl
from smplwise.errors import ApiError, ServiceInvalid, field_error
from smplwise.i18n import localize, t

HEB = re.compile("[֐-׿]")
SLOT = re.compile(r"\{(\w*)\}")
API = "/api/v1"
REPO = Path(__file__).resolve().parents[3]


def _inventory():
    spec = importlib.util.spec_from_file_location("i18n_backend_errors", REPO / "scripts" / "i18n_backend_errors.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m.inventory()


def test_the_templates_and_words_are_english_and_keep_their_slots():
    tables = error_text.tpl_tables()
    assert len(tables["templates"]) >= 229
    for he, en in tables["templates"].items():
        assert en.strip() and not HEB.search(en), (he, en)
        assert sorted(set(SLOT.findall(he))) == sorted(set(SLOT.findall(en))), (he, en)
    for he, en in tables["words"].items():
        assert HEB.search(he) and en.strip() and not HEB.search(en), (he, en)
        assert not SLOT.search(he), he


def test_every_template_is_used_and_every_use_has_its_english():
    inv = _inventory()
    assert sorted(inv["templates"]) == sorted(error_text.tpl_tables()["templates"])  # no orphan English, no template without it
    assert inv["missing"] == {}
    # what is left as an f-string: the two files of the 2.52 WisKey rows only (their train converts them at merge)
    assert set(inv["runtime"]) <= {"routers/access_control_station_ops.py", "services/wiskey_visits.py"}


def test_the_hebrew_value_is_the_f_string_it_replaced():
    for limit in (8, 2.5, "שלושה", "{x}", None, True):
        assert tpl("עד {limit} תווים.", limit=limit) == f"עד {limit} תווים."
    lo, hi = 0.5, 12.0
    assert tpl("הערך מחוץ לטווח ({lo} עד {hi}).", lo=format(lo, "g"), hi=format(hi, "g")) == f"הערך מחוץ לטווח ({lo:g} עד {hi:g})."
    # a param that holds braces is never read as a slot
    assert tpl("{name}: סוג לא מוכר.", name="{name}") == "{name}: סוג לא מוכר."
    # the value is a str whose plain copy is the Hebrew
    m = tpl("עד {limit} תווים.", limit=40)
    assert isinstance(m, str) and type(str.__str__(m)) is str and json.dumps(m, ensure_ascii=False) == '"עד 40 תווים."'


def test_render_english_with_data_words_and_messages():
    assert tpl("עד {limit} תווים.", limit=40).render("en") == "Up to 40 characters."
    assert tpl("עד {limit} תווים.", limit=40).render("he") == "עד 40 תווים."
    # data (a station's name) is shown as it is
    assert tpl("לעמדה {name} אין מצלמה ב־WisKey.", name="לובי").render("en") == "Station לובי has no camera in WisKey."
    # a fixed word of the product is translated
    en = tpl("{what} לא נשלחה: {not_sent_own}.", what="עדכון הקוד הציבורי", not_sent_own="הדלת אינה מנוהלת ב־WisKey").render("en")
    assert en == "Updating the public code was not sent: the door is not managed in WisKey."
    # a constant refusal text passed on as a param (another error's user_message) uses the constant table
    inner = "ההתראה לא נמצאה."
    assert error_text.english(inner)
    assert tpl("ביטול המשימה לא נשלח: {user_message}", user_message=inner).render("en").endswith(error_text.english(inner))
    # a Msg / a Tpl param renders itself
    nested = tpl("סדר הלשוניות: {msg}", msg=tpl("עד {tabs_max_sections} מקטעים.", tabs_max_sections=30))
    assert nested == "סדר הלשוניות: עד 30 מקטעים." and nested.render("en") == "Tab order: Up to 30 sections."
    assert tpl("{what}: {message}", what="x", message=t("error.not_found")).render("en") == "x: The resource was not found."
    # a template the table lacks answers its Hebrew
    assert tpl("טקסט שאינו בטבלה {n}", n=1).render("en") == "טקסט שאינו בטבלה 1"


def test_copy_and_pickle_keep_the_template():
    m = tpl("עד {limit} תווים.", limit=40)
    for other in (copy.deepcopy(m), pickle.loads(pickle.dumps(m)), copy.copy(m)):
        assert isinstance(other, Tpl) and other == m and other.render("en") == "Up to 40 characters."


def test_the_envelope_answers_english_and_hebrew_unchanged():
    e = ApiError(422, "validation", tpl("עד {limit} תווים.", limit=40))
    assert e.translatable()
    assert e.payload("c")["user_message"] == "עד 40 תווים."
    assert e.payload("c", lang="en")["user_message"] == "Up to 40 characters."
    # a Msg inside details (problems[].message) follows the answer's language; Hebrew details are untouched
    f = field_error(tpl("עד {limit} תווים.", limit=40), ["name"], problems=[{"field": "name", "code": "too_long", "message": tpl("עד {limit} תווים.", limit=40)}])
    he = f.payload("c")
    assert he["details"]["problems"][0]["message"] == "עד 40 תווים." and he["details"] is f.details
    en = f.payload("c", lang="en")
    assert en["details"]["problems"][0]["message"] == "Up to 40 characters." and en["details"]["fields"] == ["name"]
    assert f.details["problems"][0]["message"] == "עד 40 תווים."  # never changed in place
    # a refusal without any Msg keeps today's details object
    plain = ApiError(409, "x", "טקסט", details={"a": [1]})
    assert not plain.translatable() and plain.payload("c", lang="en")["details"] is plain.details


def test_a_service_error_keeps_its_template_through_str():
    class _Invalid(ServiceInvalid):
        def __init__(self, field: str, message: str) -> None:
            ValueError.__init__(self, message)
            self.message, self.field = message, field

    exc = _Invalid("name", tpl("עד {limit} תווים.", limit=40))
    assert str(exc) == "עד 40 תווים." and isinstance(str(exc), Tpl)
    assert exc.to_api_error(str(exc)).payload("c", lang="en")["user_message"] == "Up to 40 characters."
    assert str(_Invalid("name", "טקסט רגיל")) == "טקסט רגיל" and type(str(_Invalid("name", "טקסט רגיל"))) is str
    assert localize({"m": exc.message}, "en") == {"m": "Up to 40 characters."}


def test_an_english_user_gets_a_run_time_refusal_in_english(client: TestClient):
    c = TestClient(client.app, raise_server_exceptions=False)
    body = {"ui.tabs": {f"s{i}": {} for i in range(100)}}
    r = c.patch(f"{API}/settings", json=body)
    assert r.status_code == 422, r.text
    he = r.json()["user_message"]
    assert he.startswith("סדר הלשוניות: עד ") and he.endswith(" מקטעים.")
    assert c.put(f"{API}/me/prefs", json={"ui.lang": "en"}).status_code == 200
    r = c.patch(f"{API}/settings", json=body)
    assert r.status_code == 422
    en = r.json()["user_message"]
    assert en.startswith("Tab order: Up to ") and en.endswith(" sections.") and not HEB.search(en), en
    assert not HEB.search(json.dumps(r.json()["details"], ensure_ascii=False)), r.json()["details"]
    # a constant inner text (from the constant table) inside the run-time sentence
    r = c.patch(f"{API}/settings", json={"ui.tabs": {"Bad Slug!": {}}})
    assert r.status_code == 422 and not HEB.search(r.json()["user_message"]), r.json()
