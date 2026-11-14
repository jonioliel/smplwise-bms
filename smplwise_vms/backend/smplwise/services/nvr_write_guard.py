"""CR-NVR-GUARD-2438 (review 03 F06, owner decision O2 = b, 14.11): one rule for what the per-recorder switch
"אפשר שינויי הגדרות ב־NVR" (services/nvr_write_switch.py) covers.

The switch covers EVERY settings change sent to a recorder - notifications, motion detection, clock and NTP, OSD, the arming and
recording schedules, smart rules, privacy masks, stream encoding, the undo of any of these - and the two reboots. It does NOT cover
operational actions that change no setting: a manual recording start / stop, an alarm-output pulse, a disk S.M.A.R.T. test.

`KINDS` is the single table (kind as recorded in `nvr_changes.kind` -> gate). Every settings writer calls `guard` before anything
is sent (`nvr_write.apply_change`, `nvr_write.rollback`, `nvr_privacy.write_camera` (its undo goes through `rollback`), and the routes up front so a
refused request makes no device read either). A kind missing from the table is treated as a settings change (fail closed).

Stream encoding and the two reboots keep the checks they already had (the adapters' `writes_enabled`, camera_reboot.prepare, the
`/nvr/reboot` route); they are listed here so the table states the whole policy.

The writes guarded here are Hikvision ISAPI documents, so the guard decides for a Hikvision recorder only. A recorder of another
vendor keeps the refusal it already had from its own layer, unchanged and first (Provision-ISR: 409 `vendor_unsupported` before an
ISAPI client is built, security review 2026-10-04; Frigate / no NVR: their own 409s); Provision-ISR stream encoding is gated by its
adapter's `writes_enabled`, which reads the same switch. Nothing here talks to a device.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from ..audit import audit
from ..config import Settings
from ..errors import ApiError
from . import nvr_write_switch

SETTINGS = "settings"  # the recorder's switch must be on
OPERATIONAL = "operational"  # permission + audit only, the switch is not consulted

KINDS: dict[str, str] = {
    "notify_center": SETTINGS,  # PUT /nvr/notify
    "detection": SETTINGS,  # PUT /cameras/{id}/motion
    "time": SETTINGS,  # PUT /nvr/time, PUT /nvr/ntp
    "osd": SETTINGS,  # PUT /cameras/{id}/osd, POST /cameras/{id}/osd/name
    "schedule": SETTINGS,  # PUT /cameras/{id}/schedules/{kind}
    "record_schedule": SETTINGS,  # PUT /cameras/{id}/record-schedule
    "smart": SETTINGS,  # PUT /cameras/{id}/smart
    "privacy_mask": SETTINGS,  # POST /nvr/privacy-masks/apply (+ its own feature switch)
    "stream_encoding": SETTINGS,  # enforced by the adapters (writes_enabled) since NVR-H264-BULK-2341
    "reboot": SETTINGS,  # POST /nvr/reboot (owner 07.11, 2A), enforced by the route
    "camera_reboot": SETTINGS,  # POST /cameras/{id}/reboot, enforced by camera_reboot.prepare
    "manual_record": OPERATIONAL,  # POST /cameras/{id}/record/start|stop
    "alarm_output": OPERATIONAL,  # POST /nvr/outputs/{id}/pulse
    "storage_test": OPERATIONAL,  # POST /nvr/storage/{id}/smart-test
}

CODE = "nvr_writes_off"
MESSAGE = "שינויי הגדרות ב־NVR כבויים עבור המקליט הזה. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR."


def covered(kind: str) -> bool:
    """Whether the switch gates this kind (an unknown kind is a settings change: fail closed)."""
    return KINDS.get(kind, SETTINGS) == SETTINGS


def _vendor(settings: Settings) -> str:
    return str(settings.nvr_vendor or "").strip().lower() or "hikvision"


def writes_on(settings: Settings) -> bool:
    """The switch of `settings`' recorder as its adapter sees it, for a Hikvision recorder. Any other vendor answers True: these
    ISAPI writes are refused for it by its own layer, and that refusal stays the one the caller sees."""
    vendor = _vendor(settings)
    if vendor != "hikvision":
        return True
    return nvr_write_switch.effective(settings.nvr_recorder_id, vendor, dict(settings.nvr_extra or {}))


def allowed(settings: Settings, kind: str) -> bool:
    return not covered(kind) or writes_on(settings)


def guard(settings: Settings, conn: sqlite3.Connection, principal: Any, kind: str, *, request_id: str | None = None,
          target: str | None = None) -> None:
    """Refuse a settings change while the recorder's switch is off: 409 `nvr_writes_off`, one audit row, nothing sent.
    `settings` is the TARGET recorder's settings (recorder_scope.camera_settings / settings_for)."""
    if allowed(settings, kind):
        return
    rec_id = settings.nvr_recorder_id
    audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=target or kind, reason=CODE, request_id=request_id,
          details={"kind": kind, "recorder_id": rec_id})
    raise ApiError(409, CODE, MESSAGE, details={"recorder_id": rec_id, "kind": kind})
