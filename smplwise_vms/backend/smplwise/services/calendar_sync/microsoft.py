"""CALCONNECT-2330 (contract 12.1 phase 6): the Microsoft 365 / Outlook adapter (Microsoft Graph v1.0) on the provider-neutral interface.

* list_calendars: `/me/calendars` (canEdit, isDefaultCalendar).
* pull: `calendarView/delta` over a window (30 days back, 400 ahead; recurrences arrive as instances), times asked in UTC
  (`Prefer: outlook.timezone="UTC"`); the final `@odata.deltaLink` is the sync token; a removed item is a deletion; 410 / a sync state
  Graph no longer knows -> full_resync_required. Links of an answer are followed only on graph.microsoft.com.
* push: create / update with our marker as a single-value extended property (`arx_id`); an Arx series goes out with a Graph recurrence
  when its rule maps (daily / weekly / monthly by day / yearly with interval, count or until), else as its first instance.
* delete: 404 counts as done. revoke: Graph has no per-token revoke - the local delete is the disconnect, and the owner removes the
  app's consent at myapps.microsoft.com / account.live.com (the setup guide says so)."""
from __future__ import annotations

import datetime as dt
from typing import Any, Callable
from urllib.parse import quote
from zoneinfo import ZoneInfo

from . import oauth, rest
from .adapter import Binding, ConnectionInfo, ExtCalendar, ExtDeletion, ExtEvent, Health, NeedsReauth, OutEvent, PullResult, PushResult, SyncError

API = "https://graph.microsoft.com/v1.0"
UTC = dt.timezone.utc
PAST_DAYS, AHEAD_DAYS = 30, 400
MAX_PAGES = 60
ARX_PROP = "String {6d3a3f1e-3a5b-4c7e-9a8e-2f6b1c0d9e41} Name arx_id"
PREFER = {"Prefer": 'outlook.timezone="UTC", odata.maxpagesize=200'}
CLOCK: Callable[[], dt.datetime] = lambda: dt.datetime.now(UTC)  # noqa: E731 - test seam
_DAYS = {"MO": "monday", "TU": "tuesday", "WE": "wednesday", "TH": "thursday", "FR": "friday", "SA": "saturday", "SU": "sunday"}


def _when(w: Any) -> dt.datetime | None:
    if not isinstance(w, dict) or not isinstance(w.get("dateTime"), str):
        return None
    try:
        t = dt.datetime.fromisoformat(w["dateTime"][:26].rstrip("Z"))
    except ValueError:
        return None
    zone = w.get("timeZone") or "UTC"
    try:
        tz = UTC if zone == "UTC" else ZoneInfo(zone)
    except (KeyError, ValueError):
        tz = UTC
    return t.replace(tzinfo=tz).astimezone(UTC)


def to_ext(item: dict[str, Any]) -> ExtEvent | ExtDeletion | None:
    uid = item.get("id")
    if not isinstance(uid, str) or not uid:
        return None
    if "@removed" in item or item.get("isCancelled"):
        return ExtDeletion(uid)
    s, e = _when(item.get("start")), _when(item.get("end"))
    if s is None or e is None:
        return None
    notes = ""
    body = item.get("body")
    if isinstance(body, dict) and body.get("contentType") == "text" and isinstance(body.get("content"), str):
        notes = body["content"]
    elif isinstance(item.get("bodyPreview"), str):
        notes = item["bodyPreview"]
    arx = None
    for p in item.get("singleValueExtendedProperties") or []:
        if isinstance(p, dict) and str(p.get("id", "")).lower() == ARX_PROP.lower() and isinstance(p.get("value"), str):
            arx = p["value"]
    return ExtEvent(uid, str(item.get("@odata.etag") or item.get("changeKey") or ""), str(item.get("subject") or ""), s, e, notes, bool(item.get("isAllDay")),
                    None, arx)


def recurrence(ev: OutEvent) -> dict[str, Any] | None:
    """A Graph patternedRecurrence for the rules Graph can say; None = send the first instance only."""
    if not ev.rrule:
        return None
    parts = dict(p.split("=", 1) for p in ev.rrule.removeprefix("RRULE:").split(";") if "=" in p)
    freq, interval = parts.get("FREQ"), int(parts.get("INTERVAL", "1") or 1)
    zone = ZoneInfo(ev.tz)
    local = ev.start.astimezone(zone)
    pattern: dict[str, Any] = {"interval": interval}
    days = [d[-2:] for d in parts.get("BYDAY", "").split(",") if d]
    if freq == "DAILY":
        pattern["type"] = "daily"
    elif freq == "WEEKLY":
        pattern.update(type="weekly", daysOfWeek=[_DAYS[d] for d in days if d in _DAYS] or [local.strftime("%A").lower()], firstDayOfWeek="sunday")
    elif freq == "MONTHLY" and not days:
        pattern.update(type="absoluteMonthly", dayOfMonth=int(parts.get("BYMONTHDAY", local.day)))
    elif freq == "YEARLY" and not days:
        pattern.update(type="absoluteYearly", dayOfMonth=local.day, month=local.month)
    else:
        return None
    rng: dict[str, Any] = {"startDate": local.date().isoformat(), "recurrenceTimeZone": ev.tz}
    if parts.get("COUNT"):
        rng.update(type="numbered", numberOfOccurrences=int(parts["COUNT"]))
    elif parts.get("UNTIL"):
        u = parts["UNTIL"][:8]
        rng.update(type="endDate", endDate=f"{u[:4]}-{u[4:6]}-{u[6:8]}")
    else:
        rng["type"] = "noEnd"
    return {"pattern": pattern, "range": rng}


def to_body(ev: OutEvent) -> dict[str, Any]:
    zone = ZoneInfo(ev.tz)
    fmt = "%Y-%m-%dT%H:%M:%S"
    if ev.all_day:
        sd = ev.start.astimezone(zone).date()
        ed = max(ev.end.astimezone(zone).date(), sd + dt.timedelta(days=1))
        start, end = {"dateTime": f"{sd.isoformat()}T00:00:00", "timeZone": ev.tz}, {"dateTime": f"{ed.isoformat()}T00:00:00", "timeZone": ev.tz}
    else:
        start = {"dateTime": ev.start.astimezone(zone).strftime(fmt), "timeZone": ev.tz}
        end = {"dateTime": ev.end.astimezone(zone).strftime(fmt), "timeZone": ev.tz}
    body: dict[str, Any] = {"subject": ev.title, "body": {"contentType": "text", "content": ev.notes}, "start": start, "end": end, "isAllDay": ev.all_day,
                            "location": {"displayName": ev.location}, "singleValueExtendedProperties": [{"id": ARX_PROP, "value": ev.arx_id}]}
    rec = recurrence(ev)
    if rec is not None:
        body["recurrence"] = rec
    return body


class MicrosoftAdapter:
    provider = "microsoft"

    def health(self, connection: ConnectionInfo) -> Health:
        try:
            oauth.access_token("microsoft", connection.id)
        except NeedsReauth as exc:
            return Health("needs_reauth", exc.code)
        return Health("ok")

    def _pages(self, cid: str, url: str, params: dict[str, str] | None = None) -> tuple[list[dict[str, Any]], str | None, bool]:
        items: list[dict[str, Any]] = []
        for _ in range(MAX_PAGES):
            resp = rest.call("microsoft", cid, "GET", url, params=params, headers=PREFER, passthrough=(410,))
            if resp.status_code == 410:
                return [], None, True
            b = rest.body_of(resp)
            items += [i for i in b.get("value") or [] if isinstance(i, dict)]
            nxt, delta = b.get("@odata.nextLink"), b.get("@odata.deltaLink")
            if isinstance(nxt, str):
                if not rest.same_host(nxt, API):
                    raise SyncError(code="provider_error")
                url, params = nxt, None
                continue
            if isinstance(delta, str) and not rest.same_host(delta, API):
                raise SyncError(code="provider_error")
            return items, delta if isinstance(delta, str) else None, False
        raise SyncError(code="too_many_pages")

    def list_calendars(self, connection: ConnectionInfo) -> list[ExtCalendar]:
        items, _d, _g = self._pages(connection.id, f"{API}/me/calendars", {"$select": "id,name,canEdit,isDefaultCalendar"})
        return [ExtCalendar(c["id"], str(c.get("name") or c["id"])[:120], bool(c.get("canEdit")), bool(c.get("isDefaultCalendar")))
                for c in items if isinstance(c.get("id"), str)]

    def pull(self, connection: ConnectionInfo, binding: Binding, since_token: str | None) -> PullResult:
        if since_token:
            if not rest.same_host(since_token, API):
                return PullResult(full_resync_required=True)
            items, delta, gone = self._pages(connection.id, since_token)
        else:
            now = CLOCK()
            url = f"{API}/me/calendars/{quote(binding.external_ref, safe='')}/calendarView/delta"
            items, delta, gone = self._pages(connection.id, url, {"startDateTime": (now - dt.timedelta(days=PAST_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                                                                   "endDateTime": (now + dt.timedelta(days=AHEAD_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")})
        if gone:
            return PullResult(full_resync_required=True)
        changes = [c for c in (to_ext(i) for i in items) if c is not None]
        return PullResult(changes, delta)

    def push(self, connection: ConnectionInfo, binding: Binding, event: OutEvent, ext_uid: str | None, etag: str | None) -> PushResult:
        body = to_body(event)
        if ext_uid:
            resp = rest.call("microsoft", connection.id, "PATCH", f"{API}/me/events/{quote(ext_uid, safe='')}", json=body, passthrough=(404,))
            if resp.status_code != 404:
                b = rest.body_of(resp)
                return PushResult(str(b.get("id") or ext_uid), str(b.get("@odata.etag") or b.get("changeKey") or ""))
        b = rest.body_of(rest.call("microsoft", connection.id, "POST", f"{API}/me/calendars/{quote(binding.external_ref, safe='')}/events", json=body))
        if not isinstance(b.get("id"), str):
            raise SyncError(code="provider_error")
        return PushResult(b["id"], str(b.get("@odata.etag") or b.get("changeKey") or ""))

    def delete(self, connection: ConnectionInfo, binding: Binding, ext_uid: str, etag: str | None) -> None:
        rest.call("microsoft", connection.id, "DELETE", f"{API}/me/events/{quote(ext_uid, safe='')}", passthrough=(404,))

    def revoke(self, connection: ConnectionInfo) -> None:
        return None  # Graph has no per-token revoke; the caller deletes the sealed tokens


__all__ = ["MicrosoftAdapter", "to_ext", "to_body", "recurrence"]
