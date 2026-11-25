"""ADR019-FAMILY3-2510: ADR-019 (one field-error envelope, L2) Step 1 for family 3 - NVR, recorders, connection, camera, device
layouts and wall.

* every refusal of the family that named a field in `details.field` (NVR connection, stream settings and batches, recorders,
  Provision / Hikvision adapters, recorder and camera-image health settings, the connection probe) or in `details.key` (Frigate
  configuration) now raises `errors.field_error()`: `details.fields` next to the legacy key and the endpoint's own keys (`reason`,
  `allowed`, `codec`, `by`, `min`, `max`); statuses, envelope codes and user messages are unchanged. The 409 `recorder_duplicate`
  (it names `host`) carries the same keys (D1: "the few 400 / 409 refusals that name a field").
* the two `errors` issue lists: the wall configuration (`[{loc, msg}]`) also answers `fields` / `problems` under the body's `config`;
  the device layouts' semantic lines (strings) also answer the `fields` each line names.
The API tests of the family routes assert `details.fields` in their own files (NVR connection, CR-022 security review, multi-NVR,
stream write, Provision encoding write, Frigate configuration, device layouts); the NVR characterisation corpus records the
additive key. No app is started here: the helpers the routes raise are exercised directly."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from pydantic import ValidationError

from smplwise.errors import ApiError
from smplwise.routers import device_layouts
from smplwise.routers import wall as wall_router
from smplwise.services import camera_image_health, nvr_batch, nvr_encoding_batch, nvr_settings, recorder_health, wall
from smplwise.services.recorders import frigate_config

REPO = Path(__file__).resolve().parents[3]
FAMILY = {"nvr", "recorders", "recorder", "connection", "camera", "device", "wall"}


def _inventory():
    spec = importlib.util.spec_from_file_location("error_contract_inventory", REPO / "scripts" / "error_contract_inventory.py")
    m = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(m)
    return m


def _raises(fn, *args, **kwargs) -> ApiError:
    with pytest.raises(ApiError) as ex:
        fn(*args, **kwargs)
    return ex.value


# ---------------------------------------------------------------- the inventory


def test_family_three_has_no_legacy_422_left():
    """Every 422 of family 3 the scan reads carries the canonical `fields` (a legacy key may ride along)."""
    inv = _inventory()
    err = inv.scan_errors(REPO / "smplwise_vms" / "backend" / "smplwise")
    legacy = [f'{s["module"]}:{s["line"]}' for s in err["sites"]
              if inv.family_of(s["module"]) in FAMILY and s["status"] and 422 in s["status"] and inv.is_legacy(s)]
    assert legacy == []
    named = [f'{s["module"]}:{s["line"]}' for s in err["sites"]
             if inv.family_of(s["module"]) in FAMILY and isinstance(s["details"], list) and {"field", "key"} & set(s["details"])
             and "fields" not in s["details"]]
    assert named == [], "a refusal that names a field also sends `fields` (409 recorder_duplicate included)"


def test_the_inventory_counts_a_legacy_errors_list_beside_field_error_as_canonical():
    import ast

    inv = _inventory()
    site = inv._error_site(ast.parse('field_error("m", ["a"], legacy={"errors": ["a: x"]})').body[0].value)
    assert site["canonical"] is True and site["details"] == ["fields", "errors"]
    assert inv.site_shape(site) == "fields" and not inv.is_legacy(site)
    assert inv.shape_of(site["details"]) == "errors", "the key order of a hand-built details dict is unchanged"
    raw = inv._error_site(ast.parse('ApiError(422, "validation", "m", details={"errors": [], "fields": []})').body[0].value)
    assert inv.site_shape(raw) == "errors" and inv.is_legacy(raw)


# ---------------------------------------------------------------- NVR stream settings and batches


def test_stream_write_body_and_value_refusals_keep_field_and_add_fields():
    e = _raises(nvr_settings.parse_write_body, {"confirm": True, "if_match": "0" * 16, "changes": {"fps": "fast"}})
    assert (e.status, e.code, e.details) == (422, "validation", {"field": "fps", "fields": ["fps"]})
    e = nvr_settings._not_allowed("gop", [25, 50])
    assert (e.code, e.details) == ("value_not_allowed", {"field": "gop", "allowed": [25, 50], "fields": ["gop"]})
    assert nvr_settings._not_allowed("gop").details == {"field": "gop", "fields": ["gop"]}, "no `allowed` when none is known"
    e = nvr_settings._kept_not_allowed("profile", "H.265", ["Main"])
    assert e.details == {"field": "profile", "codec": "H.265", "allowed": ["Main"], "fields": ["profile"]}
    assert nvr_settings._not_supported("svc").details == {"field": "svc", "fields": ["svc"]}


@pytest.mark.parametrize("mod", [nvr_batch, nvr_encoding_batch])
def test_batch_refusals_name_their_field_canonically(mod):
    e = mod._invalid("x", field="targets", min=2, max=64)
    assert (e.status, e.code, e.details) == (422, "validation", {"field": "targets", "min": 2, "max": 64, "fields": ["targets"]})
    assert mod._invalid("x", index=3).details == {"index": 3}, "a refusal that names no field is unchanged"
    assert mod._invalid("x").details == {}


# ---------------------------------------------------------------- health settings, Frigate configuration


def test_camera_image_health_settings_refusals():
    num = next(iter(camera_image_health.NUMBERS))
    lo, hi = camera_image_health.NUMBERS[num][1], camera_image_health.NUMBERS[num][2]
    e = _raises(camera_image_health.validate, {num: hi * 10 + 1})
    assert e.details == {"field": num, "min": lo, "max": hi, "fields": [num]}
    flag = next(iter(camera_image_health.BOOLS))
    assert _raises(camera_image_health.validate, {flag: "yes"}).details == {"field": flag, "fields": [flag]}
    assert _raises(camera_image_health.validate, {"zz": 1}).details == {"field": "zz", "fields": ["zz"]}


def test_recorder_health_settings_refusals():
    e = _raises(recorder_health.validate, {"interval_s": 5})
    assert e.details == {"field": "interval_s", "min": 30, "max": 900, "fields": ["interval_s"]}
    assert _raises(recorder_health.validate, {recorder_health.CONTINUOUS_KEY: "x"}).details["fields"] == [recorder_health.CONTINUOUS_KEY]
    assert _raises(recorder_health.validate, {"zz": 1}).details == {"field": "zz", "fields": ["zz"]}


def test_frigate_configuration_refusals_keep_key_and_add_fields():
    e = _raises(frigate_config.setting_value, "motion.threshold", 0)
    assert (e.code, e.details) == ("frigate_config_value_invalid", {"key": "motion.threshold", "min": 1, "max": 255, "fields": ["motion.threshold"]})
    e = _raises(frigate_config.setting_value, "nope.key", 1)
    assert (e.code, e.details) == ("frigate_config_key_unknown", {"key": "nope.key", "fields": ["nope.key"]})
    assert _raises(frigate_config.labels, ["Bad!"], field="objects").details == {"key": "objects", "fields": ["objects"]}


# ---------------------------------------------------------------- the two `errors` issue lists


def test_wall_configuration_refusal_names_fields_under_config():
    with pytest.raises(ValidationError) as ex:
        wall.WallConfig.model_validate({"rotate_s": 7, "zz": 1})
    e = wall_router._config_error(ex.value)
    d = e.details
    assert (e.status, e.code) == (422, "validation")
    assert d["fields"] == ["config.rotate_s", "config.zz"]
    assert [(p["field"], p["code"]) for p in d["problems"]] == [("config.rotate_s", "literal_error"), ("config.zz", "extra_forbidden")]
    assert all(p["message"] for p in d["problems"]), "the Hebrew constraint text of the global handler"
    assert [x["loc"] for x in d["errors"]] == [["rotate_s"], ["zz"]] and all(x["msg"] for x in d["errors"]), "the legacy list stays"


@pytest.mark.parametrize(("issue", "field"), [
    ("layout.cols must be 12 for the desktop layout", "layout.cols"),
    ("layout.items: at most 6 camera cards per area", "layout.items"),
    ("layout.items.floor:ground: the area screen lays out its cards (card:<id>) and camera cards (camera:<id>) only", "layout.items.floor:ground"),
    ("layout.items.card:lighting.tiles.light.lobby: span 3 exceeds the card's 2 tile columns", "layout.items.card:lighting.tiles.light.lobby"),
    ("", "layout"),
])
def test_device_layout_issue_lines_name_their_field(issue, field):
    assert device_layouts._issue_field(issue) == field
