"""TEMPVENDOR-295 (docs/changes/CR-VENDORQ2-295.md section 3, docs/changes/CR-VENDORQ-294-DESIGN.md sections 4 and 7): the temperature report
as a REPORT to an external contact (a vendor) on the tickets message queue (`contact_reports`, outbox purpose `report`).

This module is the PROVIDER the queue asks, registered once at import as `temperature`:
* `body(conn, row, lang)` - at SEND time (never at queue time) rebuild the text from the data. The units are exactly the ones the sender chose
  (`infra_temp_report_sends.request_json`), minus any the SENDER can no longer see himself (a report is never a way around the scope: the
  queue refused it at queue time, this is the second lock). Nothing is returned (-> `report_unavailable`, the message provably did not leave)
  when no unit is left. The text carries no "available in the system" note - a vendor has no access to the system; the temporary document
  link, when there is one, is added by the queue (`contact_reports.render`);
* `outcome(conn, row)` - mirrors the outbox's final state on `infra_temp_report_sends` (`sent`; `unknown` -> `failed` / `unknown_outcome`;
  `not_sent` / `refused` / `cancelled` / `superseded` -> `failed` with the outbox's outcome code as the reason);
* `still_relevant(conn, row)` - False when the send row or its schedule was deleted or switched off, so a message that waited for the send
  hours is not sent after the manager withdrew it.

Nothing here stores, logs or audits a number, an address, a text or a link."""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
from typing import Any

from .tickets import contact_reports as cr
from .timeutil import iso_utc

log = logging.getLogger("smplwise.temperature.vendor_reports")

MODULE = "temperature"
# outbox state -> (send row status, the reason when it is not the outbox's own code)
_FAILED_STATES = ("not_sent", "refused", "cancelled", "superseded")


def _send_row(conn: sqlite3.Connection, row: Any) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM infra_temp_report_sends WHERE id = ?", (row.source_id,)).fetchone()


def _now_ts() -> float:
    from .tickets import messaging

    return messaging.RUNTIME.clock().timestamp()


class Provider:
    def body(self, conn: sqlite3.Connection, row: Any, lang: str) -> cr.ReportBody | None:
        from . import temperature_report as rep
        from . import temperature_whatsapp as twa

        send = _send_row(conn, row)
        if send is None or send["recipient_kind"] != "vendor" or send["contact_id"] != row.contact_id:
            return None
        req = json.loads(send["request_json"])
        if not send["created_by"]:
            return None
        units, doors = twa._visible_units(conn, send["created_by"], req["units"])
        if not units:
            return None
        model = rep.build(conn, units, doors, int(req["from"]), int(req["to"]), req.get("lang") or "he", _now_ts(), chart=False, events=False, signature=False)
        return cr.ReportBody(rep.text_summary(model, external=True), None)

    def outcome(self, conn: sqlite3.Connection, row: Any) -> None:
        stamp = iso_utc(dt.datetime.now(dt.timezone.utc))
        if row.state == "sent":
            status, reason = "sent", None
        elif row.state == "unknown":
            status, reason = "failed", "unknown_outcome"  # it may have left: never retried
        elif row.state in _FAILED_STATES:
            status, reason = "failed", row.outcome_code or row.state
        else:
            return
        conn.execute("UPDATE infra_temp_report_sends SET status = ?, reason = ?, finished_at = ? WHERE id = ? AND status = 'handed'", (status, reason, stamp, row.source_id))

    def still_relevant(self, conn: sqlite3.Connection, row: Any) -> bool:
        send = _send_row(conn, row)
        if send is None:
            return False
        if send["schedule_id"]:
            sched = conn.execute("SELECT enabled FROM infra_temp_report_schedules WHERE id = ?", (send["schedule_id"],)).fetchone()
            if sched is None or not sched["enabled"]:
                return False
        return True


PROVIDER = Provider()
cr.register(MODULE, PROVIDER)

__all__ = ["PROVIDER", "Provider", "MODULE"]
