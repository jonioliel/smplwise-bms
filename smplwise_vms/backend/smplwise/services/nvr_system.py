"""Owner-approved NVR system writes (0.1.71): clock / NTP (D2), OSD and channel name (D1), alarm outputs (A3),
disk S.M.A.R.T. test (C3), reboot (D3) and the VMS-side connection edit (D4). Every device write goes through the
change log in `nvr_write` (GET → mutate → PUT → verify, audited); one-shot commands (pulse, test, reboot, clock)
are recorded without a "before" document, so they cannot be rolled back by mistake."""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import sqlite3
from dataclasses import replace
from pathlib import Path
from typing import Any

import httpx

from ..audit import audit
from ..config import Settings
from ..errors import ApiError
from .nvr import _client, _get
from .nvr_write import _put, _record, apply_change

TIME_PATH = "/ISAPI/System/time"
NTP_PATH = "/ISAPI/System/time/ntpServers/1"
IO_OUTPUTS = "/ISAPI/System/IO/outputs"
HDD_LIST = "/ISAPI/ContentMgmt/Storage/hdd"
REBOOT_PATH = "/ISAPI/System/reboot"
CONNECTION_FILE = "nvr_connection.json"
XMLNS = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'


# ---------------------------------------------------------------- XML helpers

def tag(xml: str, name: str) -> str | None:
    m = re.search(rf"<{name}(?:\s[^>]*)?>(.*?)</{name}>", xml, re.S)
    return m.group(1).strip() if m else None


def set_tag(xml: str, name: str, value: str) -> str:
    """Replace the first <name>…</name>; the document is returned unchanged when the tag is missing."""
    return re.sub(rf"(<{name}(?:\s[^>]*)?>)(.*?)(</{name}>)", lambda m: m.group(1) + html.escape(value, quote=False) + m.group(3), xml, count=1, flags=re.S)


def set_in_block(xml: str, block: str, name: str, value: str) -> str:
    """Replace <name> inside the first <block>…</block> only (OSD overlays keep several `enabled` tags)."""
    m = re.search(rf"<{block}(?:\s[^>]*)?>.*?</{block}>", xml, re.S)
    if not m:
        return xml
    return xml[: m.start()] + set_tag(m.group(0), name, value) + xml[m.end():]


def blocks(xml: str, name: str) -> list[str]:
    return re.findall(rf"<{name}(?:\s[^>]*)?>.*?</{name}>", xml, re.S)


# ---------------------------------------------------------------- D2: clock and NTP

def _parse_device_time(local: str | None) -> dt.datetime | None:
    if not local:
        return None
    try:
        d = dt.datetime.fromisoformat(local)
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)


def time_status(settings: Settings, *, client: httpx.Client | None = None, now: dt.datetime | None = None) -> dict[str, Any]:
    """The NVR clock as it reports it, its drift from this server's clock, and the first NTP server."""
    own = client is None
    c = client or _client(settings)
    try:
        t = _get(c, TIME_PATH)
        try:
            n = _get(c, NTP_PATH)
        except ApiError:
            n = ""
    finally:
        if own:
            c.close()
    local = tag(t, "localTime")
    device = _parse_device_time(local)
    ref = now or dt.datetime.now(dt.timezone.utc)
    drift = round((device - ref).total_seconds()) if device else None
    return {
        "mode": tag(t, "timeMode"), "local_time": local, "time_zone": tag(t, "timeZone"), "windows_zone": tag(t, "windowsZone"), "drift_s": drift,
        "ntp": {"host": tag(n, "hostName") or tag(n, "ipAddress"), "port": int(tag(n, "portNo") or 123), "interval_min": int(tag(n, "synchronizeInterval") or 0)} if n else None,
    }


def time_document(xml: str, *, mode: str | None, at: dt.datetime | None) -> str:
    """Set the mode and / or the clock; the clock is written in the device's own offset (taken from its localTime)."""
    out = xml
    if mode:
        out = set_tag(out, "timeMode", mode)
    if at:
        current = _parse_device_time(tag(xml, "localTime"))
        offset = current.utcoffset() if current else dt.timedelta(0)
        local = (at.astimezone(dt.timezone.utc) + (offset or dt.timedelta(0))).replace(tzinfo=dt.timezone(offset or dt.timedelta(0)))
        out = set_tag(out, "localTime", local.strftime("%Y-%m-%dT%H:%M:%S%z")[:-2] + ":" + local.strftime("%z")[-2:])
    return out


def sync_clock(settings: Settings, conn: sqlite3.Connection, principal: Any, *, mode: str | None = None, request_id: str | None = None,
               client: httpx.Client | None = None, now: dt.datetime | None = None) -> dict[str, Any]:
    """Write this server's time to the NVR (manual mode for the write), then put the mode back (NTP stays NTP)."""
    own = client is None
    c = client or _client(settings)
    try:
        before_mode = tag(_get(c, TIME_PATH), "timeMode") or "manual"
        at = now or dt.datetime.now(dt.timezone.utc)
        rec = apply_change(settings, conn, principal, kind="time", permission="nvr.config.time", target="clock", path=TIME_PATH,
                           mutate=lambda x: time_document(x, mode="manual", at=at), note="סנכרון השעון לשעון השרת", request_id=request_id, client=c, keep_before=False)
        final = mode or before_mode
        if final != "manual":
            apply_change(settings, conn, principal, kind="time", permission="nvr.config.time", target="time-mode", path=TIME_PATH,
                         mutate=lambda x: time_document(x, mode=final, at=None), note=f"מצב שעון: {final}", request_id=request_id, client=c, keep_before=False)
    finally:
        if own:
            c.close()
    return rec


def set_time_mode(settings: Settings, conn: sqlite3.Connection, principal: Any, *, mode: str, request_id: str | None = None, client: httpx.Client | None = None) -> dict[str, Any]:
    return apply_change(settings, conn, principal, kind="time", permission="nvr.config.time", target="time-mode", path=TIME_PATH,
                        mutate=lambda x: time_document(x, mode=mode, at=None), note=f"מצב שעון: {mode}", request_id=request_id, client=client, keep_before=False)


def ntp_document(xml: str, *, host: str, port: int, interval_min: int | None) -> str:
    is_ip = bool(re.fullmatch(r"(\d{1,3}\.){3}\d{1,3}", host))
    out = set_tag(xml, "addressingFormatType", "ipaddress" if is_ip else "hostname")
    out = set_tag(out, "ipAddress" if is_ip else "hostName", host)
    out = set_tag(out, "portNo", str(port))
    if interval_min:
        out = set_tag(out, "synchronizeInterval", str(interval_min))
    return out


def set_ntp(settings: Settings, conn: sqlite3.Connection, principal: Any, *, host: str, port: int = 123, interval_min: int | None = None,
            request_id: str | None = None, client: httpx.Client | None = None) -> dict[str, Any]:
    return apply_change(settings, conn, principal, kind="time", permission="nvr.config.time", target="ntp", path=NTP_PATH,
                        mutate=lambda x: ntp_document(x, host=host, port=port, interval_min=interval_min), note=f"שרת NTP: {host}", request_id=request_id, client=client)


# ---------------------------------------------------------------- D1: OSD and channel name

def overlays_path(channel: int) -> str:
    return f"/ISAPI/System/Video/inputs/channels/{channel}/overlays"


def proxy_channel_path(channel: int) -> str:
    return f"/ISAPI/ContentMgmt/InputProxy/channels/{channel}"


def osd_status(settings: Settings, channel: int, *, client: httpx.Client | None = None) -> dict[str, Any]:
    own = client is None
    c = client or _client(settings)
    try:
        o = _get(c, overlays_path(channel))
        try:
            p = _get(c, proxy_channel_path(channel))
        except ApiError:
            p = ""
    finally:
        if own:
            c.close()
    name_block = next(iter(blocks(o, "channelNameOverlay")), "")
    dt_block = next(iter(blocks(o, "DateTimeOverlay")), "")
    return {
        "nvr_name": html.unescape(tag(p, "name") or "") if p else None,
        "screen": {"width": int(tag(o, "normalizedScreenWidth") or 0), "height": int(tag(o, "normalizedScreenHeight") or 0)},
        "channel_name": {"enabled": tag(name_block, "enabled") == "true", "x": int(tag(name_block, "positionX") or 0), "y": int(tag(name_block, "positionY") or 0)} if name_block else None,
        "datetime": {"enabled": tag(dt_block, "enabled") == "true", "x": int(tag(dt_block, "positionX") or 0), "y": int(tag(dt_block, "positionY") or 0),
                     "date_style": tag(dt_block, "dateStyle"), "time_style": tag(dt_block, "timeStyle"), "display_week": tag(dt_block, "displayWeek") == "true"} if dt_block else None,
    }


DATE_STYLES = ("MM-DD-YYYY", "DD-MM-YYYY", "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY/MM/DD")


def osd_document(xml: str, *, name_enabled: bool | None, datetime_enabled: bool | None, date_style: str | None, time_style: str | None, display_week: bool | None) -> str:
    out = xml
    if name_enabled is not None:
        out = set_in_block(out, "channelNameOverlay", "enabled", "true" if name_enabled else "false")
    if datetime_enabled is not None:
        out = set_in_block(out, "DateTimeOverlay", "enabled", "true" if datetime_enabled else "false")
    if date_style:
        out = set_in_block(out, "DateTimeOverlay", "dateStyle", date_style)
    if time_style:
        out = set_in_block(out, "DateTimeOverlay", "timeStyle", time_style)
    if display_week is not None:
        out = set_in_block(out, "DateTimeOverlay", "displayWeek", "true" if display_week else "false")
    return out


def set_channel_name(settings: Settings, conn: sqlite3.Connection, principal: Any, channel: int, name: str, *, request_id: str | None = None,
                     client: httpx.Client | None = None) -> dict[str, Any]:
    """The camera's name on the NVR (and so on its OSD) becomes the VMS name; the InputProxy document is written back as read."""
    return apply_change(settings, conn, principal, kind="osd", permission="nvr.config.osd", target=f"name-{channel}", path=proxy_channel_path(channel),
                        mutate=lambda x: set_tag(x, "name", name), note=f"שם ערוץ {channel}: {name}", request_id=request_id, client=client)


# ---------------------------------------------------------------- A3: alarm outputs

def alarm_outputs(settings: Settings, *, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    own = client is None
    c = client or _client(settings)
    try:
        xml = _get(c, IO_OUTPUTS)
    finally:
        if own:
            c.close()
    out = []
    for b in blocks(xml, "IOOutputPort"):
        oid = tag(b, "id")
        if not oid:
            continue
        out.append({"id": int(oid), "name": html.unescape(tag(b, "name") or ""), "use_type": tag(b, "IOUseType") or "", "enabled": tag(b, "enabled") == "true",
                    "io_type": tag(b, "IOType") or "", "pulse_ms": int(tag(b, "pulseDuration") or 0) or None, "default_state": tag(b, "defaultState") or "",
                    # the lab NVR triggers its own relay; a camera's output (id 8xx, digitalChannel) answers invalidOperation through the NVR
                    "pulse_supported": (tag(b, "IOType") or "") == "local"})
    return out


PULSE_XML = f'<IOPortData version="2.0" {XMLNS}><outputState>high</outputState></IOPortData>'


def pulse_output(settings: Settings, conn: sqlite3.Connection, principal: Any, output_id: int, *, request_id: str | None = None, client: httpx.Client | None = None) -> dict[str, Any]:
    """Trigger the output once (the port's own pulse duration ends it); recorded, audited, not rollbackable."""
    path = f"{IO_OUTPUTS}/{output_id}/trigger"
    own = client is None
    c = client or _client(settings)
    try:
        try:
            _put(c, path, PULSE_XML)
        except ApiError as exc:
            _record(conn, principal, kind="alarm_output", permission="nvr.alarm_output", target=f"output-{output_id}", path=path, before=None, after=PULSE_XML, status="failed", error=exc.code, note="הפעלת יציאה")
            audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=f"output-{output_id}", reason=exc.code, request_id=request_id, details={"kind": "alarm_output", "path": path})
            raise
    finally:
        if own:
            c.close()
    rec = _record(conn, principal, kind="alarm_output", permission="nvr.alarm_output", target=f"output-{output_id}", path=path, before=None, after=PULSE_XML, status="applied", note="הפעלת יציאה (pulse)")
    audit(conn, actor=principal, action="nvr.write", decision="allowed", resource_type="nvr", resource_id=f"output-{output_id}", request_id=request_id, details={"kind": "alarm_output", "path": path, "change_id": rec["id"]})
    return rec


# ---------------------------------------------------------------- C3: disks and S.M.A.R.T.

def hdd_list(settings: Settings, *, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    own = client is None
    c = client or _client(settings)
    try:
        xml = _get(c, HDD_LIST)
        disks = []
        for b in blocks(xml, "hdd"):
            hid = tag(b, "id")
            if not hid:
                continue
            d = {"id": int(hid), "name": tag(b, "hddName") or f"hdd{hid}", "type": tag(b, "hddType") or "", "status": tag(b, "status") or "", "capacity_mb": int(tag(b, "capacity") or 0),
                 "free_mb": int(tag(b, "freeSpace") or 0), "property": tag(b, "property") or "", "smart": None}
            try:
                s = _get(c, f"{HDD_LIST}/{hid}/SMARTTest/status")
                d["smart"] = {"temperature_c": int(tag(s, "temprature") or tag(s, "temperature") or 0) or None, "power_on_days": int(tag(s, "powerOnDay") or 0) or None,
                              "self_eval": tag(s, "selfEvaluaingStatus"), "all_eval": tag(s, "allEvaluaingStatus"), "test_percent": int(tag(s, "selfTestPercent") or 0),
                              "test_status": tag(s, "selfTestStatus"), "test_type": tag(s, "selfTestType")}
            except ApiError:
                d["smart"] = None
            disks.append(d)
        return disks
    finally:
        if own:
            c.close()


def smart_test_xml(hdd_id: int, kind: str) -> str:
    return f'<SMARTTest version="2.0" {XMLNS}><hddID>{hdd_id}</hddID><selfTestType>{kind}</selfTestType></SMARTTest>'


def start_smart_test(settings: Settings, conn: sqlite3.Connection, principal: Any, hdd_id: int, kind: str = "short", *, request_id: str | None = None,
                     client: httpx.Client | None = None) -> dict[str, Any]:
    path = f"{HDD_LIST}/{hdd_id}/SMARTTest"
    xml = smart_test_xml(hdd_id, kind)
    own = client is None
    c = client or _client(settings)
    try:
        try:
            _put(c, path, xml)
        except ApiError as exc:
            _record(conn, principal, kind="storage_test", permission="nvr.storage.test", target=f"hdd-{hdd_id}", path=path, before=None, after=xml, status="failed", error=exc.code, note=f"בדיקת SMART {kind}")
            audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id=f"hdd-{hdd_id}", reason=exc.code, request_id=request_id, details={"kind": "storage_test", "path": path})
            raise
    finally:
        if own:
            c.close()
    rec = _record(conn, principal, kind="storage_test", permission="nvr.storage.test", target=f"hdd-{hdd_id}", path=path, before=None, after=xml, status="applied", note=f"בדיקת SMART {kind}")
    audit(conn, actor=principal, action="nvr.write", decision="allowed", resource_type="nvr", resource_id=f"hdd-{hdd_id}", request_id=request_id, details={"kind": "storage_test", "path": path, "change_id": rec["id"]})
    return rec


# ---------------------------------------------------------------- D3: reboot

def reboot(settings: Settings, conn: sqlite3.Connection, principal: Any, *, request_id: str | None = None, client: httpx.Client | None = None) -> dict[str, Any]:
    """PUT /ISAPI/System/reboot: no live video and no recording for a minute or two; recorded and audited first."""
    own = client is None
    c = client or _client(settings)
    try:
        try:
            _put(c, REBOOT_PATH, "")
        except ApiError as exc:
            _record(conn, principal, kind="reboot", permission="nvr.system.reboot", target="system", path=REBOOT_PATH, before=None, after=None, status="failed", error=exc.code, note="הפעלה מחדש")
            audit(conn, actor=principal, action="nvr.write", decision="denied", resource_type="nvr", resource_id="system", reason=exc.code, request_id=request_id, details={"kind": "reboot"})
            raise
    finally:
        if own:
            c.close()
    rec = _record(conn, principal, kind="reboot", permission="nvr.system.reboot", target="system", path=REBOOT_PATH, before=None, after=None, status="applied", note="הפעלה מחדש של ה־NVR")
    audit(conn, actor=principal, action="nvr.write", decision="allowed", resource_type="nvr", resource_id="system", request_id=request_id, details={"kind": "reboot", "change_id": rec["id"]})
    return rec


# ---------------------------------------------------------------- D4: connection (VMS side)

def connection_view(settings: Settings) -> dict[str, Any]:
    return {"host": settings.nvr_host, "http_port": settings.nvr_http_port, "rtsp_port": settings.nvr_rtsp_port, "user": settings.nvr_user,
            "has_password": bool(settings.nvr_password), "in_addon": bool(settings.ha_url and settings.ha_url.startswith("http://supervisor"))}


def with_connection(settings: Settings, *, host: str, http_port: int, rtsp_port: int, user: str, password: str | None) -> Settings:
    return replace(settings, nvr_host=host, nvr_http_port=http_port, nvr_rtsp_port=rtsp_port, nvr_user=user, nvr_password=password or settings.nvr_password)


def supervisor_post(settings: Settings, path: str, body: dict[str, Any] | None = None) -> None:
    """A Supervisor API call from inside the add-on (options / restart). Raises ApiError on refusal."""
    try:
        r = httpx.post(f"http://supervisor{path}", json=body, headers={"Authorization": f"Bearer {settings.ha_token}"}, timeout=15)
    except httpx.HTTPError as exc:
        raise ApiError(503, "supervisor_unavailable", "ה־Supervisor אינו זמין.", details={"path": path, "error": type(exc).__name__}) from exc
    if r.status_code >= 400:
        raise ApiError(502, "supervisor_refused", "ה־Supervisor דחה את הבקשה.", details={"path": path, "status": r.status_code})


def supervisor_options(settings: Settings) -> dict[str, Any]:
    try:
        r = httpx.get("http://supervisor/addons/self/info", headers={"Authorization": f"Bearer {settings.ha_token}"}, timeout=15)
        r.raise_for_status()
        return dict(r.json().get("data", {}).get("options") or {})
    except (httpx.HTTPError, ValueError) as exc:
        raise ApiError(503, "supervisor_unavailable", "ה־Supervisor אינו זמין.", details={"error": type(exc).__name__}) from exc


def save_connection(settings: Settings, new: Settings) -> str:
    """Persist the new NVR connection: through the Supervisor (add-on options + restart) inside Home Assistant, or
    into <data>/nvr_connection.json on a developer workstation (merged by load_settings). Returns where it went."""
    values = {"nvr_host": new.nvr_host, "nvr_http_port": new.nvr_http_port, "nvr_rtsp_port": new.nvr_rtsp_port, "nvr_username": new.nvr_user, "nvr_password": new.nvr_password}
    if connection_view(settings)["in_addon"]:
        options = supervisor_options(settings) | values
        supervisor_post(settings, "/addons/self/options", {"options": options})
        supervisor_post(settings, "/addons/self/restart")
        return "supervisor"
    path = Path(settings.data_dir) / CONNECTION_FILE
    path.write_text(json.dumps(values, ensure_ascii=False, indent=2), encoding="utf-8")
    return "file"
