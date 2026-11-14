"""CALCONNECT-2330 (contract 12.1 phase 5): the Google Calendar adapter (Calendar API v3) on the provider-neutral interface.

* list_calendars: `calendarList` (reader or better); can_write = writer / owner.
* pull: `events.list` with `singleEvents=true` (recurrences arrive expanded, contract 12.4 note) and `showDeleted=true`; the first listing
  starts 30 days back (`timeMin`), later ones use the stored `nextSyncToken`; HTTP 410 = the token is gone -> full_resync_required.
* push: insert / update with our marker `extendedProperties.private.arx_id`; an Arx series goes out as RRULE + EXDATE; an update of an
  event deleted at Google (404 / 410) inserts it again.
* delete: 404 / 410 count as done. revoke: Google's revoke endpoint with the refresh token (best effort).
Credentials come from credentials.RUNTIME; every call runs through rest.call (token refresh, error mapping). No call is made while a
database transaction of the engine is open (engine.run_connection)."""
from __future__ import annotations

import datetime as dt
from typing import Any, Callable
from urllib.parse import quote
from zoneinfo import ZoneInfo

from . import credentials, oauth, rest
from .adapter import Binding, ConnectionInfo, ExtCalendar, ExtDeletion, ExtEvent, Health, NeedsReauth, OutEvent, PullResult, PushResult, SyncError

API = "https://www.googleapis.com/calendar/v3"
UTC = dt.timezone.utc
PAST_DAYS = 30
MAX_PAGES = 40
CLOCK: Callable[[], dt.datetime] = lambda: dt.datetime.now(UTC)  # noqa: E731 - test seam


def _cal(ref: str) -> str:
    return f"{API}/calendars/{quote(ref, safe='')}"


from ..timeutil import iso_utc
_iso = iso_utc  # CR-TIMEUTIL-2436 (04:F14): the shared helper under this module's name, same text


def _parse_when(w: Any, tz: str) -> tuple[dt.datetime, bool] | None:
    if not isinstance(w, dict):
        return None
    try:
        if isinstance(w.get("dateTime"), str):
            t = dt.datetime.fromisoformat(w["dateTime"].replace("Z", "+00:00"))
            if t.tzinfo is None:
                t = t.replace(tzinfo=ZoneInfo(w.get("timeZone") or tz))
            return t.astimezone(UTC), False
        if isinstance(w.get("date"), str):
            d = dt.date.fromisoformat(w["date"])
            return dt.datetime.combine(d, dt.time(0, 0), ZoneInfo(w.get("timeZone") or tz)).astimezone(UTC), True
    except (ValueError, KeyError):
        return None
    return None


def to_ext(item: dict[str, Any], tz: str) -> ExtEvent | ExtDeletion | None:
    uid = item.get("id")
    if not isinstance(uid, str) or not uid:
        return None
    if item.get("status") == "cancelled":
        return ExtDeletion(uid)
    s, e = _parse_when(item.get("start"), tz), _parse_when(item.get("end"), tz)
    if s is None or e is None:
        return None
    priv = ((item.get("extendedProperties") or {}).get("private") or {}) if isinstance(item.get("extendedProperties"), dict) else {}
    upd = None
    if isinstance(item.get("updated"), str):
        try:
            upd = dt.datetime.fromisoformat(item["updated"].replace("Z", "+00:00"))
        except ValueError:
            upd = None
    return ExtEvent(uid, str(item.get("etag") or ""), str(item.get("summary") or ""), s[0], e[0], str(item.get("description") or ""), s[1],
                    (item.get("start") or {}).get("timeZone") or None, priv.get("arx_id") if isinstance(priv.get("arx_id"), str) else None, upd)


def to_body(ev: OutEvent) -> dict[str, Any]:
    zone = ZoneInfo(ev.tz)
    if ev.all_day:
        start = {"date": ev.start.astimezone(zone).date().isoformat()}
        end = {"date": ev.end.astimezone(zone).date().isoformat()}
        if end["date"] <= start["date"]:
            end = {"date": (ev.start.astimezone(zone).date() + dt.timedelta(days=1)).isoformat()}
    else:
        start = {"dateTime": ev.start.astimezone(zone).isoformat(), "timeZone": ev.tz}
        end = {"dateTime": ev.end.astimezone(zone).isoformat(), "timeZone": ev.tz}
    body: dict[str, Any] = {"summary": ev.title, "description": ev.notes, "location": ev.location, "start": start, "end": end,
                            "extendedProperties": {"private": {"arx_id": ev.arx_id}}}
    if ev.rrule:
        rec = [f"RRULE:{ev.rrule.removeprefix('RRULE:')}"]
        for x in ev.exdates:
            try:
                local = dt.datetime.strptime(x, "%Y-%m-%dT%H:%M")
            except ValueError:
                continue
            rec.append(f"EXDATE;TZID={ev.tz}:{local.strftime('%Y%m%dT%H%M%S')}")
        body["recurrence"] = rec
    return body


class GoogleAdapter:
    provider = "google"

    def health(self, connection: ConnectionInfo) -> Health:
        try:
            oauth.access_token("google", connection.id)
        except NeedsReauth as exc:
            return Health("needs_reauth", exc.code)
        return Health("ok")

    def list_calendars(self, connection: ConnectionInfo) -> list[ExtCalendar]:
        out: list[ExtCalendar] = []
        params: dict[str, str] = {"minAccessRole": "reader", "maxResults": "250"}
        for _ in range(MAX_PAGES):
            b = rest.body_of(rest.call("google", connection.id, "GET", f"{API}/users/me/calendarList", params=params))
            for c in b.get("items") or []:
                if isinstance(c, dict) and isinstance(c.get("id"), str):
                    out.append(ExtCalendar(c["id"], str(c.get("summaryOverride") or c.get("summary") or c["id"])[:120], c.get("accessRole") in ("writer", "owner"),
                                           bool(c.get("primary"))))
            if not isinstance(b.get("nextPageToken"), str):
                break
            params = {**params, "pageToken": b["nextPageToken"]}
        return out

    def pull(self, connection: ConnectionInfo, binding: Binding, since_token: str | None) -> PullResult:
        base: dict[str, str] = {"singleEvents": "true", "showDeleted": "true", "maxResults": "250"}
        if since_token:
            base["syncToken"] = since_token
        else:
            base["timeMin"] = _iso(CLOCK() - dt.timedelta(days=PAST_DAYS))
        params = dict(base)
        changes: list[ExtEvent | ExtDeletion] = []
        for _ in range(MAX_PAGES):
            resp = rest.call("google", connection.id, "GET", f"{_cal(binding.external_ref)}/events", params=params, passthrough=(410,))
            if resp.status_code == 410:
                return PullResult(full_resync_required=True)
            b = rest.body_of(resp)
            tz = str(b.get("timeZone") or "UTC")
            for item in b.get("items") or []:
                if isinstance(item, dict):
                    ch = to_ext(item, tz)
                    if ch is not None:
                        changes.append(ch)
            if isinstance(b.get("nextPageToken"), str):
                params = {**base, "pageToken": b["nextPageToken"]}
                continue
            return PullResult(changes, b.get("nextSyncToken") if isinstance(b.get("nextSyncToken"), str) else None)
        raise SyncError(code="too_many_pages")

    def push(self, connection: ConnectionInfo, binding: Binding, event: OutEvent, ext_uid: str | None, etag: str | None) -> PushResult:
        body = to_body(event)
        if ext_uid:
            resp = rest.call("google", connection.id, "PUT", f"{_cal(binding.external_ref)}/events/{quote(ext_uid, safe='')}", json=body, passthrough=(404, 410))
            if resp.status_code not in (404, 410):
                b = rest.body_of(resp)
                return PushResult(str(b.get("id") or ext_uid), str(b.get("etag") or ""))
        b = rest.body_of(rest.call("google", connection.id, "POST", f"{_cal(binding.external_ref)}/events", json=body))
        if not isinstance(b.get("id"), str):
            raise SyncError(code="provider_error")
        return PushResult(b["id"], str(b.get("etag") or ""))

    def delete(self, connection: ConnectionInfo, binding: Binding, ext_uid: str, etag: str | None) -> None:
        rest.call("google", connection.id, "DELETE", f"{_cal(binding.external_ref)}/events/{quote(ext_uid, safe='')}", passthrough=(404, 410))

    def revoke(self, connection: ConnectionInfo) -> None:
        token = credentials.RUNTIME.read(connection.id).get("refresh_token")
        if token:
            oauth.google_revoke(token)


__all__ = ["GoogleAdapter", "to_ext", "to_body"]
