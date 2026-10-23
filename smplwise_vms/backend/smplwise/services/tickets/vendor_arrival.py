"""VENDORARRIVAL126-295 (board r126 / r127): the outside handler's "I have arrived" signal and the missed-arrival alert.

Until now Arx had no arrival signal at all - only the SLA ladder (stuck.py), which reacts to silence. This module adds, behind a switch
that is OFF by default (`tickets.settings` -> `vendor_arrival.enabled`):

  1. THE SIGNAL  `POST /t/api/arrived` on the handler page (public_routes.py): one tap, the link's token, the `token_write` rate
     window of the public edge, a mandatory `client_request_id` replayed by the request row, strict JSON, the uniform 404 when the
     switch is off / the link is a staff link / the request is not open any more. It stores the time (store_arrival), writes a
     timeline row `vendor_arrived` (visible to the vendor himself), resolves a missed-arrival alert and counts as progress of the
     assignment (sliding link expiry, last activity). A repeat tap changes nothing and answers the first arrival time.
  2. THE WINDOW  the time the vendor is expected: the awarded work order's CURRENT planned arrival (a manager's reschedule and a
     confirmed proposal move it), else the start of the vendor's own door-access request ("who arrives, when"). A time without an end
     gets `default_window_min`; a plain date gets `day_from` - `day_to` of that day in the installation's zone.
  3. THE ALERT  `run()` is a guarded step of the SLA monitor tick (once a minute, module on): an assignment still `assigned` /
     `acknowledged` (a vendor who started the work is there) with no arrival `grace_min` after the window's end gets
     `ticket.vendor_missed` (the existing CR-018 pipeline: number and place only, quiet hours, channels, matrix) - then every
     `repeat_min`, at most `max_alerts` times. The audience is set in the settings (managers and/or named users). A moved window or an
     arrival resolves it; nothing here messages the vendor.
  4. THE DOOR  nothing here touches a door. After the tap the page may point to the EXISTING door-access request step
     (services/access_arrival.py: a `requested` grant that a human approves; the code goes only to the named person's verified
     number). `offer_access_request` only controls that pointer; `access.external_grants` still gates the step itself.

No SQL here (store_arrival.py / store.py). Nothing raises into the monitor."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any

from ...db import Database, get_setting
from . import handler_actions, model, notify_bridge, settings_doc, store, store_arrival, store_links, stuck
from .public_ports import LinkRecord

log = logging.getLogger("smplwise.tickets.vendor_arrival")
UTC = dt.timezone.utc
ROUTE = "/t/api/arrived"
BATCH = 200
STATS: dict[str, Any] = {"looked": 0, "alerts": 0, "errors": 0}


def config(conn) -> dict[str, Any]:
    return settings_doc.read(conn)["vendor_arrival"]


def enabled(conn) -> bool:
    try:
        return bool(config(conn)["enabled"])
    except Exception:  # noqa: BLE001 - an unreadable document is "off"
        return False


# ---------------------------------------------------------------- the expected window

def _tz(conn) -> dt.tzinfo:
    return stuck._zone(get_setting(conn, "time.zone", None))


def _day_bound(day: dt.date, hhmm: str, tz: dt.tzinfo) -> dt.datetime:
    h, m = int(hhmm[:2]), int(hhmm[3:])
    return dt.datetime(day.year, day.month, day.day, h, m, tzinfo=tz).astimezone(UTC)


def _parse(value: Any, tz: dt.tzinfo, *, end: bool, cfg: dict[str, Any]) -> tuple[dt.datetime | None, bool]:
    """(instant, was_a_plain_date). A plain date is the start (`day_from`) or the end (`day_to`) of that day in the zone."""
    if not value:
        return None, False
    text = str(value)
    if "T" not in text and len(text) <= 10:
        try:
            day = dt.date.fromisoformat(text)
        except ValueError:
            return None, False
        return _day_bound(day, cfg["day_to"] if end else cfg["day_from"], tz), True
    return stuck.parse(text), False


def expected_window(conn, asg: str | None, cfg: dict[str, Any] | None = None) -> tuple[dt.datetime, dt.datetime, str] | None:
    """(from, to, source) of the vendor's expected arrival, or None when nobody said when."""
    cfg = cfg or config(conn)
    if not asg:
        return None
    tz = _tz(conn)
    source = "order"
    planned = store_arrival.planned_window(conn, asg)
    if planned is None:
        start = store_arrival.request_start(conn, asg)
        if not start:
            return None
        planned, source = (start, None), "request"
    start, plain_start = _parse(planned[0], tz, end=False, cfg=cfg)
    if start is None:
        return None
    end, _plain_end = _parse(planned[1], tz, end=True, cfg=cfg)
    if end is None or end < start:
        end = _day_bound(start.astimezone(tz).date(), cfg["day_to"], tz) if plain_start else start + dt.timedelta(minutes=int(cfg["default_window_min"]))
        if end < start:
            end = start + dt.timedelta(minutes=int(cfg["default_window_min"]))
    return start, end, source


def state_of(conn, asg: str | None, arrival: dict[str, Any] | None, now: dt.datetime, cfg: dict[str, Any] | None = None) -> dict[str, Any]:
    """What the vendor's page shows: `arrived` | `late` (the window and its grace passed) | `expected` (a window) | `open` (no time given)."""
    cfg = cfg or config(conn)
    if arrival and arrival.get("arrived_at"):
        return {"state": "arrived", "arrived_at": arrival["arrived_at"]}
    win = expected_window(conn, asg, cfg)
    if win is None:
        return {"state": "open"}
    late = now >= win[1] + dt.timedelta(minutes=int(cfg["grace_min"]))
    return {"state": "late" if late else "expected", "window_from": stuck.iso(win[0]), "window_to": stuck.iso(win[1])}


# ---------------------------------------------------------------- the page

def available(conn, link: LinkRecord, ticket: dict[str, Any], assignment: dict[str, Any]) -> bool:
    return (enabled(conn) and not link.no_money and assignment.get("assignee_kind") == "contact" and not assignment.get("ended_at")
            and ticket.get("status") in model.HANDLING)


def page_block(conn, link: LinkRecord, now: dt.datetime) -> dict[str, Any] | None:
    """The `vendor_arrival` block of the ticket answer, or None (switch off, a staff link, the work is over)."""
    try:
        ticket = store_links.ticket_of_link(conn, link.link_id)
        assignment = store.assignment(conn, link.assignment_id)
        if ticket is None or assignment is None or not available(conn, link, ticket, assignment):
            return None
        cfg = config(conn)
        out = state_of(conn, assignment["id"], store_arrival.get(conn, assignment["id"]), now, cfg)
        out["offer_access"] = bool(cfg["offer_access_request"]) and _access_step_available(conn, link)
        return out
    except Exception:  # noqa: BLE001 - the ticket page never breaks because of this block
        log.warning("vendor arrival block failed", exc_info=True)
        return None


def _access_step_available(conn, link: LinkRecord) -> bool:
    try:
        from .. import access_arrival

        return bool(access_arrival.available(conn, link))
    except Exception:  # noqa: BLE001
        return False


def signal(conn, link: LinkRecord, *, crid: str, now: dt.datetime, client_key: str = "") -> tuple[int, dict[str, Any]]:
    """POST /t/api/arrived (inside the route's write transaction): the vendor says he is on site."""
    from .public_store import audit_link

    if not enabled(conn):
        raise handler_actions.LinkGone()
    f = handler_actions.fresh(conn, link, now)
    if not available(conn, f.link, f.ticket, f.assignment):
        if f.link.no_money or f.assignment.get("assignee_kind") != "contact" or f.assignment.get("ended_at"):
            raise handler_actions.LinkGone()
        replay = handler_actions.claim(conn, f.link, crid, ROUTE, now)
        if replay is not None:
            return replay
        raise handler_actions.ActionRefused(409, "invalid_state", current=f.ticket["status"])
    replay = handler_actions.claim(conn, f.link, crid, ROUTE, now)
    if replay is not None:
        return replay
    at = handler_actions.iso(now)
    first = store_arrival.record_arrival(conn, assignment_id=f.assignment["id"], ticket_id=f.ticket["id"], contact_id=f.link.contact_id, at=at)
    arrival = store_arrival.get(conn, f.assignment["id"]) or {}
    if first:
        store.update_ticket(conn, f.ticket["id"], {"last_activity_at": at, "last_external_activity_at": at})
        handler_actions._event(conn, f, "vendor_arrived", now, data={})
        handler_actions._progress(conn, f, now, client_key)
        notify_bridge.resolve_vendor_missed(conn, f.ticket["id"])
        audit_link(conn, f.link, "ticket.vendor_arrived")
    cfg = config(conn)
    answer = {"ok": True, "arrived_at": arrival.get("arrived_at") or at, "repeat": not first,
              "offer_access": bool(cfg["offer_access_request"]) and _access_step_available(conn, f.link)}
    return handler_actions._finish(conn, f.link, crid, 200, answer)


# ---------------------------------------------------------------- the missed-arrival alert (a step of the monitor tick)

def look(conn, ticket_id: str, now: dt.datetime, cfg: dict[str, Any]) -> str | None:
    """One look at one watched ticket (the caller's write transaction). Returns 'alert', 'reset' or None."""
    row = store.ticket_row_system(conn, ticket_id)
    if row is None or row["status"] not in store_arrival.WATCHED_STATUSES or row.get("asg_kind") != "contact" or row.get("asg_ended_at"):
        return None
    asg = row.get("current_assignment_id")
    mark = store_arrival.get(conn, asg) if asg else None
    if mark and mark.get("arrived_at"):
        return None
    win = expected_window(conn, asg, cfg)
    due = (win[1] + dt.timedelta(minutes=int(cfg["grace_min"]))) if win else None
    if due is None or now < due:
        if mark and mark.get("alerts_sent"):  # the window moved forward (or vanished): the ladder starts again
            store_arrival.clear_missed(conn, asg)
            notify_bridge.resolve_vendor_missed(conn, ticket_id)
            return "reset"
        return None
    sent = int((mark or {}).get("alerts_sent") or 0)
    if sent >= int(cfg["max_alerts"]):
        return None
    if sent:
        every = int(cfg["repeat_min"])
        last = stuck.parse((mark or {}).get("last_alert_at"))
        if every <= 0 or last is None or now < last + dt.timedelta(minutes=every):
            return None
    n = store_arrival.note_alert(conn, assignment_id=asg, ticket_id=ticket_id, contact_id=row.get("asg_contact_id"),
                                 at=stuck.iso(now) or "")
    notify_bridge.vendor_missed(conn, row, n)
    store.insert_event(conn, ticket_id, "vendor_missed", actor_kind="system", via="system", assignment_id=asg, at=stuck.iso(now),
                       data={"n": n, "window_to": stuck.iso(win[1]) if win else None})
    STATS["alerts"] += 1
    return "alert"


def run(db: Database, now: dt.datetime) -> int:
    """The monitor's step: look at every watched ticket (bounded). Never raises; a bad ticket never stops the others."""
    looked = 0
    try:
        with db.connection(mode="read", label="tickets.vendor_arrival") as conn:
            cfg = config(conn)
            if not cfg["enabled"]:
                return 0
            ids = store_arrival.watched_ticket_ids(conn, BATCH)
        for tid in ids:
            try:
                with db.connection(label="tickets.vendor_arrival") as conn:
                    look(conn, tid, now, cfg)
                looked += 1
            except Exception:  # noqa: BLE001
                STATS["errors"] += 1
                log.warning("vendor arrival look failed on %s", tid, exc_info=True)
    except Exception:  # noqa: BLE001 - a housekeeping step never fails the tick
        STATS["errors"] += 1
        log.warning("vendor arrival step failed", exc_info=True)
    STATS["looked"] = looked
    return looked
