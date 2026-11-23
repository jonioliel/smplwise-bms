"""Helpers of the COMPLEXITY-3-2480 characterisation corpora (format and replay: support/char_corpus.py).

- `digest(value)`: a large answer is stored as the sha256 of its corpus encoding (key order included) next to a short readable summary,
  so a corpus stays small and the replay still compares the whole answer byte for byte.
- `model_ctx(name)`: the automation model's `ModelContext` variants the parse corpora replay under. Every variant has a deterministic
  uid source (`u1`, `u2` ... per call), so the answer of a call never depends on the calls before it."""
from __future__ import annotations

import hashlib
import itertools
import json
from typing import Any

from support import char_corpus as cc

from smplwise.services.automation_text import ModelContext

SHABBAT = "binary_sensor.shabbat_or_holiday"
PRESENCE = "binary_sensor.anyone_in_building"
SENSORS = ("binary_sensor.shelly_presence_lobby", "binary_sensor.shelly_motion_hall", "binary_sensor.shelly_presence_office")
ALLOWED = ("light.turn_on", "light.turn_off", "switch.turn_on", "switch.turn_off", "cover.open_cover", "scene.turn_on", "script.turn_on",
           "notify.mobile_app_dana", "climate.set_temperature", "media_player.volume_set")

CTX_NAMES = ("bare", "named", "kav", "strict")


def _names(entity_id: str) -> str:
    return f"שם {entity_id.split('.', 1)[-1]}"


def _notify_name(service: str) -> str | None:
    return "הטלפון של דנה" if service.startswith("notify.mobile_app_") else None


def _device_name(device_id: str) -> str | None:
    return None if device_id.endswith("0") else f"מכשיר {device_id[:6]}"


def model_ctx(name: str) -> ModelContext:
    """A fresh context of the named variant (a new uid counter each time)."""
    counter = itertools.count(1)

    def uid() -> str:
        return f"u{next(counter)}"

    if name == "bare":
        return ModelContext(uid=uid)
    if name == "named":
        return ModelContext(uid=uid, names=_names, notify_name=_notify_name, device_name=_device_name)
    if name == "kav":
        return ModelContext(uid=uid, names=_names, shabbat_sensor=SHABBAT, presence_entity=PRESENCE, wall_buttons=True, presence_sensors=SENSORS)
    if name == "strict":
        return ModelContext(uid=uid, names=_names, notify_name=_notify_name, shabbat_sensor=SHABBAT, allowed_actions=ALLOWED, template_text=False)
    raise KeyError(name)


def digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(cc.plain(value), ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()


def block_answer(func: Any, case: dict[str, Any]) -> dict[str, Any]:
    """A parse call of the automation model under the case's context: {"result": {"sha256", "summary"}} or {"raises": ...}."""
    args, kwargs = cc.decode(case["args"]), cc.decode(case["kwargs"])
    try:
        block = func(*args, ctx=model_ctx(case["ctx"]), **kwargs)
    except Exception as exc:  # noqa: BLE001 - the exception is the recorded outcome
        return {"raises": cc.plain(cc.raised(exc))}
    summary = {k: block.get(k) for k in ("kind", "type", "reason", "sentence", "effects") if isinstance(block, dict) and k in block}
    return {"result": {"sha256": digest(block), "summary": cc.plain(summary)}}
