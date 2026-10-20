"""CR-039 4.4 / DOORWIN-295: the relock watchdog of door windows.

It READS the engine's status and, when a relock cannot be confirmed, raises the alarm and retries the CLOSE direction - nothing else.
SR-1 (pinned by tests/test_fake_doorwin_closed_rule_sr1.py: this module is timer-shaped): no open, no hold, no pulse, no program save
here. The only engine write is `pause` (the close direction), bounded and backed off, with the revision re-read first (W0 finding 2).

State machine of one occurrence (tier "program"; CR-039 6):
    planned -(start, never armed)-> not_started            (safe: the program was never written; alert)
    armed -(start)-> starting -(engine opening/held)-> active
                    starting -(start + 60 s, no ack)-> not_started   (safe direction; alert, no retry, no open)
    active | starting | not_started -(end)-> ending
    ending -(engine idle)-> closed_confirmed
    ending -(end + grace, no idle)-> relock_unconfirmed      (critical notification; close retries at +30 / +60 / +120 s)
    relock_unconfirmed -(engine idle | a person checked)-> closed_confirmed   (re-raised every `reraise_min` until then)
A `prepared` occurrence (tier D: nothing written) only moves to `elapsed` at its end.

Feed loss (CR-039 4.4 step 5): a status that cannot be read is NEVER a confirmation; an ending occurrence becomes relock_unconfirmed at
end + grace regardless, with the reason `feed_unavailable`. Arx restart (T2): the state is in the database; the first pass after a start
judges every ending occurrence at once."""
from __future__ import annotations

import datetime as dt
import logging
import sqlite3
from dataclasses import dataclass, field
from typing import Any

from ..audit import audit
from ..db import Database
from . import door_windows as dw
from . import door_windows_engine as dwe

log = logging.getLogger("smplwise.doors")

START_ACK_S = 60
BACKOFF_S = (30, 60, 120)  # CR-039 4.4 step 3; coarser than WisKey's own 15-s close retry so the two never form a storm
JUDGED = ("planned", "armed", "starting", "active", "not_started", "ending", "relock_unconfirmed")


@dataclass(frozen=True)
class Config:
    grace_s: int = 120
    retries: int = 3
    reraise_s: int = 900


@dataclass
class Verdict:
    state: str
    fields: dict[str, Any] = field(default_factory=dict)
    notify: list[str] = field(default_factory=list)        # 'unconfirmed' | 'reraise' | 'resolved' | 'not_started'
    retry: bool = False                                     # make one close-direction attempt now
    transitions: list[str] = field(default_factory=list)


def _at(value: str | None) -> dt.datetime | None:
    return dw.parse_iso(value) if value else None


def judge(occ: dict[str, Any], status: dwe.ProgramState | None, now: dt.datetime, cfg: Config) -> Verdict:
    """The next state of one occurrence from the engine's status (None = could not be read). Pure: no I/O."""
    s = occ["state"]
    start, end = dw.parse_iso(occ["start_at"]), dw.parse_iso(occ["end_at"])
    v = Verdict(s)

    def move(to: str, **fields: Any) -> None:
        v.state = to
        v.fields.update(fields)
        v.transitions.append(to)

    held = status is not None and status.exists and (status.status in ("opening", "held_acknowledged") or status.owned)
    idle = status is not None and status.idle
    if s == "planned" and now >= start:
        move("not_started", last_reason="engine_not_written")
        v.notify.append("not_started")
    elif s == "armed" and now >= start:
        move("starting")
    if v.state == "starting":
        if held:
            move("active", started_confirmed_at=dw.iso(now))
        elif now >= start + dt.timedelta(seconds=START_ACK_S) and now < end:
            move("not_started", last_reason="no_start_ack" if status is not None else "feed_unavailable")
            v.notify.append("not_started")
    if v.state in ("active", "starting", "not_started") and now >= end:
        move("ending")
    if v.state == "ending":
        if idle:
            move("closed_confirmed", ended_confirmed_at=dw.iso(now), resolved_at=dw.iso(now),
                 resolution="override" if occ.get("last_reason") == "override" else "engine_idle")
        elif now >= end + dt.timedelta(seconds=cfg.grace_s):
            move("relock_unconfirmed", unconfirmed_at=dw.iso(now), last_raised_at=dw.iso(now),
                 last_reason="engine_status" if status is not None else "feed_unavailable",
                 next_retry_at=dw.iso(now + dt.timedelta(seconds=BACKOFF_S[0])) if cfg.retries > 0 else None)
            v.notify.append("unconfirmed")
        return v
    if v.state == "relock_unconfirmed":
        if idle:
            move("closed_confirmed", ended_confirmed_at=dw.iso(now), resolved_at=dw.iso(now), resolution="engine_idle", next_retry_at=None)
            v.notify.append("resolved")
            return v
        retries = int(occ.get("retries") or 0)
        nxt = _at(occ.get("next_retry_at"))
        # a retry needs the program's current revision (from this pass's read) - with the feed down it waits, it is not spent
        if nxt is not None and now >= nxt and retries < cfg.retries and status is not None and status.exists and status.arx:
            v.retry = True
            done = retries + 1
            v.fields.update(retries=done, next_retry_at=dw.iso(now + dt.timedelta(seconds=BACKOFF_S[min(done, len(BACKOFF_S) - 1)])) if done < cfg.retries else None)
        last = _at(occ.get("last_raised_at"))
        if last is None or now >= last + dt.timedelta(seconds=cfg.reraise_s):
            v.fields["last_raised_at"] = dw.iso(now)
            v.notify.append("reraise")
        if status is None:
            v.fields["last_reason"] = "feed_unavailable"
    return v


def config(conn: sqlite3.Connection) -> Config:
    return Config(dw.int_setting(conn, "doors.windows.relock_grace_s"), dw.int_setting(conn, "doors.windows.relock_retries"),
                  dw.int_setting(conn, "doors.windows.reraise_min") * 60)


def _signal(conn: sqlite3.Connection, kind: str, occ: dict[str, Any], label: str) -> None:
    from . import notify

    key = f"door.relock_unconfirmed:{occ['id']}"
    params = {"name": label}
    origin = {"door": dw.door_key(occ["station_id"], occ["relay"]), "occurrence_id": occ["id"]}
    subject = dw.door_key(occ["station_id"], occ["relay"])
    if kind in ("unconfirmed", "reraise"):
        notify.emit(conn, notify.Signal("door.relock_unconfirmed", "door", subject, dedupe_key=key, params=params, origin=origin))
    elif kind == "resolved":
        notify.emit(conn, notify.Signal("door.relock_unconfirmed", "door", subject, dedupe_key=key, params=params, origin=origin, resolve=True))
    elif kind == "not_started":
        notify.emit(conn, notify.Signal("door.window_not_started", "door", subject, dedupe_key=f"door.window_not_started:{occ['id']}", params=params, origin=origin))


def watch(db: Database, settings: Any, now: dt.datetime) -> dict[str, Any]:
    """One watchdog pass. Engine reads (one per door) and close retries happen outside the write lock; the transitions, notifications and
    audit rows are written in one short transaction. Runs whatever `doors.windows.enabled` says (T22): an alarm is never cleared by a
    switch."""
    with db.connection(mode="read") as conn:
        cfg = config(conn)
        rows = [dict(r) for r in conn.execute(
            f"SELECT * FROM door_window_occurrences WHERE state IN ({','.join('?' * len(JUDGED))}) OR (state = 'prepared' AND end_at <= ?) ORDER BY start_at",
            (*JUDGED, dw.iso(now))).fetchall()]
        labels = {d.key: d.label for d in dw.doors(conn)}
    due = [r for r in rows if r["state"] == "prepared" or r["state"] in ("starting", "active", "ending", "relock_unconfirmed")
           or dw.parse_iso(r["start_at"]) <= now]
    if not due:
        return {"judged": 0}
    engine = dwe.window_engine(settings)
    statuses: dict[str, dwe.ProgramState | None] = {}
    for r in due:
        key = dw.door_key(r["station_id"], r["relay"])
        if r["tier"] != "program" or key in statuses:
            continue
        try:
            statuses[key] = engine.read(r["station_id"], r["relay"]) if engine.tier == "program" else None
        except dwe.EngineError as exc:
            log.info("door windows: status of %s unreadable (%s)", key, exc.kind)
            statuses[key] = None
    verdicts: list[tuple[dict[str, Any], Verdict, str | None]] = []
    for r in due:
        key = dw.door_key(r["station_id"], r["relay"])
        if r["state"] == "prepared":
            verdicts.append((r, Verdict("elapsed", transitions=["elapsed"]), None))
            continue
        v = judge(r, statuses.get(key), now, cfg)
        attempt = None
        if v.retry:
            st = statuses.get(key)
            try:
                after = engine.pause(r["station_id"], r["relay"], st.revision)  # the close direction only (SR-3)
                attempt = "sent"
                statuses[key] = after
            except dwe.EngineError as exc:
                attempt = f"{exc.kind}:{exc.code}"  # revision_conflict / refused = nothing happened; unknown = re-read next pass
        verdicts.append((r, v, attempt))
    at = dw.iso(now)
    with db.connection() as conn:
        for r, v, attempt in verdicts:
            if not v.transitions and not v.fields and not v.notify and attempt is None:
                continue
            fields = dict(v.fields, state=v.state, updated_at=at)
            conn.execute(f"UPDATE door_window_occurrences SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ? AND state = ?",
                         (*fields.values(), r["id"], r["state"]))
            key = dw.door_key(r["station_id"], r["relay"])
            label = labels.get(key) or key
            for t in v.transitions:
                audit(conn, actor=None, action="door.window.occurrence", decision="allowed", resource_type="door", resource_id=key, reason=t,
                      details={"occurrence_id": r["id"], "from": r["state"], "to": t, "tier": r["tier"], "token": r["token"],
                               "engine_status": (statuses.get(key).status if statuses.get(key) else None) if r["tier"] == "program" else None})
            if attempt is not None:
                audit(conn, actor=None, action="door.window.relock_retry", decision="allowed" if attempt == "sent" else "failed", resource_type="door",
                      resource_id=key, reason=attempt, details={"occurrence_id": r["id"], "attempt": v.fields.get("retries")})
            for kind in v.notify:
                _signal(conn, kind, r, label)
    return {"judged": len(verdicts)}


# ---------------------------------------------------------------- the people's actions on an occurrence (routers/door_windows.py)

def confirm_closed(conn: sqlite3.Connection, occ: sqlite3.Row, user_id: str, checked: str, now: dt.datetime) -> None:
    """A person looked (at the door or its camera) and confirms the relock (CR-039 4.4 step 4). Audited by the route with the person."""
    from . import notify

    conn.execute("""UPDATE door_window_occurrences SET state = 'closed_confirmed', resolved_by = ?, resolved_at = ?, resolution = 'manual_checked',
                    checked = ?, next_retry_at = NULL, updated_at = ? WHERE id = ?""", (user_id, dw.iso(now), checked, dw.iso(now), occ["id"]))
    notify.emit(conn, notify.Signal("door.relock_unconfirmed", "door", dw.door_key(occ["station_id"], occ["relay"]),
                                    dedupe_key=f"door.relock_unconfirmed:{occ['id']}", resolve=True))
