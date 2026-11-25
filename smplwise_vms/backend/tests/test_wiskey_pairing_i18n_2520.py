"""WISKEY-PAIRING-I18N-2520: the pairing lines of "חיבור Arx ל-WisKey" carry what a page in another language needs to say them from stable
codes - `fix_code` and `params` on every line (with `<name>_code` for a value that is itself a word), `owner_step_codes` next to
`owner_steps`, `step_codes` next to the repair's `steps` - all additive; the Hebrew is unchanged. The frontend catalogue
(frontend/src/i18n/wiskey-pairing-status.ts + its English pack) holds the same Hebrew and an English sentence for every code; this file
reads it as text and compares. Synthetic data; nothing contacts WisKey, Home Assistant or a station."""
from __future__ import annotations

import re
import string
from pathlib import Path

import pytest
from test_wiskey_pairing_2382 import API, _lines, _pair, _server, world  # noqa: F401 - the fixture is used by name

from smplwise.services import wiskey_pairing as wp

FRONTEND = Path(__file__).resolve().parents[3] / "frontend" / "src" / "i18n"
HEB = re.compile("[֐-׿]")
ENTRY = re.compile(r"^  (\w+): '((?:[^'\\]|\\.)*)',$", re.M)

# the Hebrew of the steps as the code wrote them before the codes (owner_steps in services/wiskey_pairing.py, steps in routers/wiskey_pairing.py)
OLD_STEPS = {
    "entry_single": "בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge - ודאו שיש רשומה אחת בלבד ושהיא טעונה.",
    "restart_infra": "הפעילו מחדש את תשתית המערכת (WisKey קורא את קוד הצימוד מהגשר כשהוא נטען).",
    "check_again": "חזרו לכאן ולחצו \"בדיקה מול WisKey\".",
    "update_wiskey": "עדכון WisKey הוא פעולה של בעל המערכת (התקנה ידנית, מדיניות B): התקינו את גרסת WisKey המאושרת (2.0.1 ומעלה) והפעילו מחדש את תשתית המערכת.",
    "provider_choose": "בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: \"WisKey (וידאו ודיבור)\".",
    "announced_sent": "הקוד החדש נשלח לגשר הקיים: הגשר בודק אותו מול Arx ומחליף אותו בעצמו, בלי אישור. אם הגשר עוד לא הוגדר - בתשתית המערכת תופיע בקשה להוסיף את SMPLWISE Bridge; אשרו אותה.",
    "announced_wait": "המתינו דקה עד שהגשר ישלח עדכון חתום (השורה \"גשר Arx\" תהפוך לתקינה).",
    "announced_check": "לחצו \"בדיקה מול WisKey\".",
    "manual_delete": "בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge › שלוש הנקודות › מחיקה. "
                     "לפני כן רשמו את האפשרויות שהוגדרו בה (משתמש שירות, האצלת שמירה, הרשאות להפעלה): הן נמחקות עם הרשומה.",
    "manual_add": "הוספת אינטגרציה › SMPLWISE Bridge.",
    "manual_url": "כתובת: {url} · קוד הצימוד: הקוד שמוצג כאן.",
}


def _table(path: Path, start: str) -> dict[str, str]:
    src = path.read_text(encoding="utf-8")
    i = src.index(start)
    block = src[i:src.index("\n};", i)]
    return {k: re.sub(r"\\(.)", r"\1", v) for k, v in ENTRY.findall(block)}


@pytest.fixture(scope="module")
def tables() -> tuple[dict[str, str], dict[str, str]]:
    he = _table(FRONTEND / "wiskey-pairing-status.ts", "const he = {")
    en = _table(FRONTEND / "lang" / "en" / "i18n" / "wiskey-pairing-status.ts", "export const en = {")
    return he, en


def _fields(s: str) -> set[str]:
    return {f for _, f, _, _ in string.Formatter().parse(s) if f}


def _expected() -> dict[str, str]:
    out = {f"lbl_{k}": v for k, v in wp.LABEL.items()}
    out |= {f"l_{k}": v for k, v in wp.TEXT.items()}
    out |= {f"x_{k}": v for k, v in wp.FIX.items()}
    out |= {f"s_{k}": v for k, v in wp.STEP.items()}
    out |= {f"v_why_{k}": v for k, v in wp.EVENT_GAP_WHY.items()}
    out |= {f"v_code_{k}": v for k, v in wp.ERROR_TEXT.items()}
    out["link_providerRow"] = wp.PROVIDER_ROW["label"]
    return out


def test_the_steps_keep_their_hebrew() -> None:
    assert wp.STEP == OLD_STEPS
    assert [wp.STEP[c] for c in wp.ANNOUNCED_STEPS][-1] == OLD_STEPS["announced_check"]
    assert wp.step_texts(wp.MANUAL_STEPS, url="http://arx-addon.test:8099")[2] == "כתובת: http://arx-addon.test:8099 · קוד הצימוד: הקוד שמוצג כאן."


def test_every_server_text_has_the_same_hebrew_and_an_english_sentence(tables) -> None:
    he, en = tables
    for key, text in _expected().items():
        assert he.get(key) == text, key
        assert en.get(key), f"{key}: no English"
        assert not HEB.search(en[key]), f"{key}: Hebrew in the English"
        assert _fields(en[key]) == _fields(text), f"{key}: other values"
    assert set(en) == set(he)


def test_every_word_value_has_its_words(tables) -> None:
    """A `codes=` value of `_line` is said through v_<name>_<code>: each has the Hebrew word the sentence was filled with, and its English."""
    he, en = tables
    words = {("since", "pairing"): "הצימוד", ("video", "yes"): "כן", ("video", "no"): "לא", ("talk", "yes"): "כן", ("talk", "no"): "לא",
             ("start", "unknown"): "לא ידוע", ("caught", "until"): "Arx מעודכן עד {caught_at}.", ("caught", "not_yet"): "עוד לא הגיע לסוף הרשימה של WisKey."}
    src = Path(wp.__file__).read_text(encoding="utf-8")
    for (name, code), word in words.items():
        assert f'"{code}"' in src and f"{name}" in src
        assert he[f"v_{name}_{code}"] == word and en[f"v_{name}_{code}"], (name, code)
        assert _fields(en[f"v_{name}_{code}"]) == _fields(word)


@pytest.mark.parametrize("reason", sorted(wp.TEXT))
def test_a_line_carries_its_params_and_fix_code(reason: str) -> None:
    fmt = {n: f"v_{n}" for n in _fields(wp.TEXT[reason])}
    for state in (wp.OK, wp.WARN):
        ln = wp._line("bridge", state, reason, **fmt)
        assert ln["text"] == (wp.TEXT[reason].format(**fmt) if fmt else wp.TEXT[reason])
        assert ln["params"] == fmt
        if state == wp.OK or reason not in wp.FIX:
            assert ln["fix"] is None and ln["fix_code"] is None
        else:
            assert ln["fix_code"] == reason and ln["fix"] == wp.FIX[reason]


def test_word_values_carry_their_code() -> None:
    ln = wp._line("discovery", wp.WARN, "discovery_feed", fix="discovery_talk_missing", codes={"video": "yes", "talk": "no"}, video="כן", talk="לא")
    assert ln["text"] == "לפי ערוץ השירות: וידאו כן, דיבור לא (לא נבדק בחיבור הישיר)."
    assert ln["params"] == {"video": "כן", "talk": "לא", "video_code": "yes", "talk_code": "no"}
    assert ln["fix_code"] == "discovery_talk_missing" and ln["fix"] == wp.FIX["discovery_talk_missing"]


def test_the_status_carries_the_codes_of_its_steps(world) -> None:  # noqa: F811
    _server(secret="a-different-synthetic-pairing-code-0001")  # WisKey holds another code: refused -> the three owner steps
    _pair(world)
    r = world["c"].post(f"{API}/probe")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["owner_step_codes"] == ["entry_single", "restart_infra", "check_again"]
    assert body["owner_steps"] == [OLD_STEPS[c] for c in body["owner_step_codes"]]
    for ln in body["lines"]:
        assert set(ln) >= {"fix_code", "params"}
        assert (ln["fix_code"] is None) == (ln["fix"] is None)
        if ln["fix_code"]:
            assert ln["fix"] == wp.FIX[ln["fix_code"]]
    assert _lines(body)["acceptance"]["params"] == {"code": "direct_connect_refused"}


def test_the_repair_carries_the_codes_of_its_steps(world) -> None:  # noqa: F811
    from smplwise.db import set_setting

    _pair(world)
    with world["db"].connection() as conn:
        set_setting(conn, "bridge.secret", "")  # no key: the repair is available
    r = world["c"].post(f"{API}/repair", json={"confirm": True, "pause_rotation": False})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["step_codes"] in (list(wp.ANNOUNCED_STEPS), list(wp.MANUAL_STEPS))
    assert out["steps"] == [OLD_STEPS[c].format(url=out["addon_url"]) for c in out["step_codes"]]
