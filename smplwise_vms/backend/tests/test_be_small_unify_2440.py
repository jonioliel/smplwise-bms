"""CR-BE-SMALL-UNIFY-2440 (review 04:F16 / F24 / F25 / F27 adoption): the validation errors of these modules sit on the common base
with the shape they always had, the copied value helpers are the shared ones, and the probe's swallowed errors leave a trace that
carries no address."""
from __future__ import annotations

import logging
import sqlite3

import pytest

from smplwise.errors import ServiceInvalid
from smplwise.services import connection_probe, generator_log, insights_common, notify_policy, offline_field, quiet_windows, readiness, values
from smplwise.services.calendar import model as calendar_model
from smplwise.services.emergency import model as emergency_model
from smplwise.services.maintenance import model as maintenance_model
from smplwise.services.notices import model as notices_model
from smplwise.services.notices import push as notices_push
from smplwise.services.notices import slides as notices_slides
from smplwise.services.partner import reads as partner_reads
from smplwise.services.transit import model as transit_model


def _shape(e):
    return (isinstance(e, ServiceInvalid), isinstance(e, ValueError), str(e), e.args)


def test_calendar_invalid():
    e = calendar_model.Invalid("טקסט", "title", "too_long")
    assert _shape(e) == (True, True, "טקסט", ("טקסט",)) and (e.message, e.field, e.code, e.fields) == ("טקסט", "title", "too_long", ["title"])
    d = calendar_model.Invalid("m")
    assert (d.field, d.code, d.fields) == ("", "validation", [])


@pytest.mark.parametrize("model", [emergency_model, maintenance_model])
def test_field_code_invalid(model):
    e = model.Invalid("thresholds.x", "unknown")
    assert _shape(e) == (True, True, "thresholds.x: unknown", ("thresholds.x: unknown",))
    assert (e.field, e.code, e.fields) == ("thresholds.x", "unknown", ["thresholds.x"])


@pytest.mark.parametrize("model", [notices_model, transit_model])
def test_field_message_invalid(model):
    e = model.Invalid("title", "כותרת חסרה.")
    assert _shape(e) == (True, True, "כותרת חסרה.", ("כותרת חסרה.",)) and (e.field, e.message, e.fields, e.code) == ("title", "כותרת חסרה.", ["title"], "validation")


def test_the_two_field_message_classes_stay_separate():
    assert notices_model.Invalid is not transit_model.Invalid and not issubclass(notices_model.Invalid, transit_model.Invalid)


def test_insights_invalid():
    fields = ["a", "b"]
    e = insights_common.Invalid(fields)
    assert _shape(e) == (True, True, "a,b", ("a,b",)) and e.fields is fields


def test_generator_log_invalid():
    e = generator_log.Invalid("fuel_l")
    assert _shape(e) == (True, True, "fuel_l", ("fuel_l",)) and (e.key, e.fields) == ("fuel_l", ["fuel_l"])


def test_partner_invalid_is_left_alone():
    """It never was a ValueError; joining the base would make `except ValueError` blocks around the partner reads catch it."""
    e = partner_reads.Invalid("cursor", "invalid")
    assert not isinstance(e, ValueError) and (str(e), e.field, e.code) == ("cursor:invalid", "cursor", "invalid")


def test_to_api_error_works_for_each_adopter():
    for e in (calendar_model.Invalid("m", "f"), notices_model.Invalid("f", "m"), insights_common.Invalid(["f"]), generator_log.Invalid("f")):
        api = e.to_api_error()
        assert api.status == 422 and api.details == {"fields": ["f"]} and api.user_message
    # ADR019-STEP0-2500: the (field, code) classes carry a per-field reason -> details.problems (ADR-019 Step 0 item 2)
    for e in (emergency_model.Invalid("f", "c"), maintenance_model.Invalid("f", "c")):
        api = e.to_api_error()
        assert api.status == 422 and api.details == {"fields": ["f"], "problems": [{"field": "f", "code": "c"}]} and api.user_message


def test_clip_is_the_shared_one():
    assert notices_push._clip is values.clip and notify_policy._clip is values.clip
    assert notify_policy._clip("  a   b  ", 10) == "a b" and notify_policy._clip("abcdef", 4) == "abc…" and notify_policy._clip(None, 3) == ""


@pytest.mark.parametrize("module", [offline_field, quiet_windows, readiness])
def test_setting_reads_through_the_shared_reader(monkeypatch, module):
    key = next(iter(module.SETTINGS))
    default, valid = module.SETTINGS[key]
    stored: dict[str, object] = {}
    monkeypatch.setattr(values, "get_setting", lambda conn, k, d: stored.get(k, d))
    assert module.setting(None, key) == default                      # nothing stored
    stored[key] = 5
    assert module.setting(None, key) == default                      # not a string
    stored[key] = "\x00 not a value \x00"
    assert module.setting(None, key) == (stored[key] if valid(stored[key]) else default)
    with pytest.raises(KeyError):
        module.setting(None, "no.such.key")
    # the registry is read at call time (a test that swaps SETTINGS still works)
    monkeypatch.setattr(module, "SETTINGS", {"k": ("d", lambda v: v == "ok")})
    stored["k"] = "ok"
    assert module.setting(None, "k") == "ok"


def test_slide_update_statement_is_the_same_and_keys_are_checked():
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE notice_slides (id TEXT, title TEXT, updated_by TEXT)")
    conn.execute("INSERT INTO notice_slides VALUES ('s1', 'old', NULL), ('s2', 'other', NULL)")
    assert notices_slides.db_update(conn, "notice_slides", {"title": "new", "updated_by": "u"}, "id = ?", ("s1",)) == 1
    assert conn.execute("SELECT id, title, updated_by FROM notice_slides ORDER BY id").fetchall() == [("s1", "new", "u"), ("s2", "other", None)]
    with pytest.raises(ValueError):
        notices_slides.db_update(conn, "notice_slides", {"title = 'x' --": "v"}, "id = ?", ("s1",))


def test_probe_trace_names_the_type_only(caplog):
    with caplog.at_level(logging.DEBUG, logger="smplwise.connection_probe"):
        connection_probe._trace("the recorder probe failed", RuntimeError("rtsp://admin:s3cret@192.0.2.9/x refused"))
    text = caplog.text
    assert "the recorder probe failed (RuntimeError)" in text
    assert "s3cret" not in text and "192.0.2.9" not in text and "Traceback" not in text

