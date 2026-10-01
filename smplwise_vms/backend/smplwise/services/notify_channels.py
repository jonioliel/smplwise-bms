"""Channel delivery for notifications (CR-018): the outbox consumer that runs on the notifier thread (services/push.PushNotifier), and
the `Channel` interface every delivery channel plugs into.

THE CHANNEL INTERFACE (stable; the e-mail channel of S4 and the later Companion / WhatsApp channels implement it)
------------------------------------------------------------------------------------------------------------------
    class MyChannel(Channel):
        name = "email"                                   # the key of the source policy's `channels` and of the pass-through matrix
        def plan(self, d: Dispatch, conn) -> list[Target]: ...      # READ phase, no I/O: who / what this channel reaches; a target that
                                                                    # must not be sent carries status "skipped" and a reason
        def prepare(self, d, targets, conn) -> None: ...            # optional, inside the short WRITE transaction that also writes the
                                                                    # delivery-log rows (e.g. mint a one-time token)
        def send(self, notifier, d, targets) -> None: ...           # outside EVERY lock: send the queued targets, record each outcome with
                                                                    # record_outcome(); a retry is notifier.schedule(delay, job) where the
                                                                    # job has recheck(db) -> bool and run_retry(notifier)
    register(MyChannel())                                # once, at import / start-up

`Dispatch` carries everything a channel needs to decide: the notification (`d.n`), the mode (`new | renotify | escalate | resolved`), the
administrator's policy and settings, the installation zone, whether quiet hours are active (`d.held(channel)` applies the pass-through matrix
and the escalation bypass), the recipients (`d.users`) and a lazy per-user visibility check (`d.reach(user_id)`). A channel NEVER decides
who may see a notification (visibility is services/notify_visibility, checked here and again before every retry) and NEVER sends under the
SQLite write lock. A policy channel with no registered implementation (e-mail until S4 lands) gets one `skipped / channel_unavailable` row.

WHAT THIS MODULE DOES for every `dispatch` row of the outbox - a new notification, a severity rise, an escalation step, a resolve notice:
plans the targets of each channel the SOURCE POLICY (the administrator's; there are no per-user choices) switched on, writes the delivery log,
and lets each channel send. The inbox is always on and is not a channel here. The delivery log (`notification_deliveries`) gets a row per target:
queued, then sent / retry / failed / gone, or skipped with a reason (quiet_hours, snoozed, rate_limited, no_reach, no_key, channel_unavailable).

Web push is the built-in channel (services/push.py holds the protocol): payload v2 at the administrator's lock-screen level, the single-use
ack / snooze action tokens, and the doorbell's "open door" as a plain deep link - never a token, never a call.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import threading
from dataclasses import dataclass, field
from typing import Any

from ..db import new_id, now_iso
from . import notify
from . import notify_settings as nsettings
from . import push, user_events
from .notify_policy import SEVERITY_LABEL_HE, get_policy
from .notify_visibility import Reach, principal_of
from .timeutil import iso_utc, parse_utc, zone

log = logging.getLogger("smplwise.notify")

SENT_STALE_S = notify.SENT_STALE_S


# ---------------------------------------------------------------- the channel interface

@dataclass
class Target:
    """One delivery target of one notification on one channel; becomes one row of the delivery log."""

    channel: str
    user_id: str | None                 # None = not a user (an installation-level address)
    target_ref: str                     # what the log shows: a push host or a MASKED address - never an endpoint or an address
    status: str = "queued"              # queued | skipped
    reason: str | None = None           # why it was skipped
    data: Any = None                    # channel-private (a subscription row, an address)
    delivery_id: str = ""               # filled in when the delivery-log row is written


@dataclass
class Dispatch:
    """What a channel needs to plan and send one dispatch (valid to read from anywhere; `reach` needs the planning connection)."""

    nid: str
    mode: str                           # new | renotify | escalate | resolved
    n: dict[str, Any]                   # the notification row (decoded: origin, params)
    policy: dict[str, Any]
    settings: dict[str, Any]            # NotifySettings (no secrets)
    tz: str
    now: dt.datetime
    quiet: bool                         # installation quiet hours are active right now
    users: list[str]                    # the recipients (or the escalation's targets), already de-duplicated
    item: dict[str, Any] = field(default_factory=dict)
    scratch: dict[str, Any] = field(default_factory=dict)  # per-channel state shared between plan / prepare / send
    _conn: Any = None
    _reach: dict[str, Reach] = field(default_factory=dict)

    @property
    def severity(self) -> str:
        return self.n["severity"]

    def held(self, channel: str) -> bool:
        """Quiet hours hold this channel back for this severity (the pass-through matrix); an escalation always passes."""
        if self.mode == "escalate" or not self.quiet:
            return False
        return not bool(self.settings["pass_through"][self.severity].get(channel))

    def reach(self, user_id: str) -> Reach | None:
        """The user's visibility, evaluated NOW on the planning connection; None for an inactive or unknown user."""
        if user_id not in self._reach:
            p = principal_of(self._conn, user_id)
            if p is None:
                return None
            self._reach[user_id] = Reach(self._conn, p)
        return self._reach[user_id]


class Channel:
    """A delivery channel. Subclass, set `name`, implement `plan` and `send`, `register()` once."""

    name = ""

    def plan(self, d: Dispatch, conn: Any) -> list[Target]:
        raise NotImplementedError

    def prepare(self, d: Dispatch, targets: list[Target], conn: Any) -> None:
        """Inside the write transaction that writes the delivery rows (optional)."""

    def send(self, notifier: "push.PushNotifier", d: Dispatch, targets: list[Target]) -> None:
        raise NotImplementedError


CHANNELS: dict[str, Channel] = {}


def register(channel: Channel) -> None:
    CHANNELS[channel.name] = channel


def record_outcome(db: Any, delivery_ids: list[str], status: str, reason: str | None, attempt: int, *, notification_id: str | None = None, channel: str | None = None) -> None:
    """Update delivery-log rows after an attempt (a channel calls this; the push path does it inside services/push.record). A final
    failure (`failed`, `gone`) also puts a `delivery_failed` entry on the notification's timeline."""
    with db.connection(label="notify.delivery.log") as conn:
        set_delivery(conn, delivery_ids, status, reason, attempt)
        if status in ("failed", "gone") and notification_id:
            conn.execute("INSERT INTO notification_events(notification_id, at, kind, channel) VALUES (?,?,?,?)", (notification_id, now_iso(), "delivery_failed", channel))


def set_delivery(conn: Any, ids: list[str], status: str, reason: str | None, attempt: int) -> None:
    for did in ids:
        conn.execute("UPDATE notification_deliveries SET status = ?, reason = ?, attempt = ?, sent_at = CASE WHEN ? = 'sent' THEN ? ELSE sent_at END WHERE id = ?", (status, reason, attempt, status, now_iso(), did))


# ---------------------------------------------------------------- the outbox

_OUTBOX_LOCK = threading.RLock()


def process_outbox(notifier: "push.PushNotifier", limit: int = 100) -> int:
    """Act on the committed outbox rows in order: UI frames to the users' sockets, dispatches to the channels. A row is deleted only AFTER it was
    handled, so a crash (or a kill) in the middle leaves it for the next pass - at-least-once; the one-hour staleness rule keeps a late replay from
    waking a phone for nothing. A row that RAISES is logged and dropped (never retried forever). One pass at a time per process."""
    db = notifier.db
    assert db is not None
    with _OUTBOX_LOCK:
        with db.connection(mode="read", label="notify.outbox.read") as conn:
            rows = conn.execute("SELECT * FROM notify_outbox ORDER BY id LIMIT ?", (limit,)).fetchall()
        for r in rows:
            try:
                item = json.loads(r["payload_json"] or "{}")
                if r["kind"] == "ui":
                    publish_ui(db, r["notification_id"], item)
                elif r["kind"] == "dispatch":
                    item["queued_at"] = r["created_at"]
                    dispatch(notifier, r["notification_id"], item)
            except Exception:  # noqa: BLE001 - one bad row never stops the others
                log.exception("notification outbox row %s (%s) failed", r["id"], r["kind"])
            with db.connection(label="notify.outbox.done") as conn:  # BaseException (a kill) skips this: the row stays
                conn.execute("DELETE FROM notify_outbox WHERE id = ?", (r["id"],))
    if len(rows) >= limit:
        notifier.dirty = True
    return len(rows)


def process_outbox_now(db: Any) -> int:
    """Run the outbox on the calling thread (tests, and a caller that wants its deliveries synchronously). Uses a throw-away
    notifier, so its retries are NOT scheduled; use the real notifier's heap when retries matter."""
    n = push.PushNotifier()
    n.db = db
    return process_outbox(n)


# ---------------------------------------------------------------- frames for /me/ws

def publish_ui(db: Any, nid: str | None, item: dict[str, Any]) -> None:
    """Deliver the frames of one outbox row to each listed user's open sockets - only to users who may still see the row - and
    then a fresh `notify_summary` (unread, open_critical) for each of them (it also covers a read made on another device)."""
    users = [u for u in item.get("users") or [] if user_events.listeners(u)]
    if not users:
        return
    with db.connection(mode="read", label="notify.ui") as conn:
        for uid in users:
            p = principal_of(conn, uid)
            if p is None:
                continue
            visible = notify.get_row(conn, p, nid) is not None if nid else False
            if visible:
                for f in item.get("frames") or []:
                    user_events.publish(uid, f["type"], f["payload"])
            s = notify.summary(conn, p)
            user_events.publish(uid, "notify_summary", {"unread": s["unread"], "open_critical": s["open_critical"]})


# ---------------------------------------------------------------- payload v2

def local_hhmm(at: dt.datetime, tz_name: str) -> str:
    return at.astimezone(zone(tz_name)).strftime("%H:%M")


def payload_v2(n: dict[str, Any], level: str, *, tokens: dict[str, str] | None, door: dict[str, Any] | None, tz_name: str, mode: str, now: dt.datetime) -> dict[str, Any]:
    """The whole message a push service carries (encrypted): `{v:2, id, title, body, url, category, severity, tag, ts, actions?}`.

    The lock-screen level is the administrator's: `generic` shows only "Arx / התראה חדשה"; `type_place` (default) the type and place
    with the severity and the time; `full` the server template's body. No level ever carries a person's name, a visitor, an image,
    an event or camera id, or any token but the single-use ack / snooze action tokens. The url opens the notification inside Arx
    (the sign-in comes first); a doorbell's "פתח דלת" is a plain deep link to the in-app confirmation - it carries NO token and the
    service worker never calls an unlock route for it (CR section 9)."""
    place = n.get("place")
    typed = f"{n['title']} · {place}" if place else n["title"]
    if level == "generic":
        title, body = "Arx", "התראה חדשה"
    elif level == "full":
        title = typed
        body = n.get("body") or SEVERITY_LABEL_HE.get(n["severity"], "")
        if place and place not in body:
            body = f"{body} · {place}"
    else:
        title = typed
        body = f"{SEVERITY_LABEL_HE.get(n['severity'], '')} · {local_hhmm(now, tz_name)}"
    if mode == "resolved":
        body = "הסתיים" if level == "generic" else f"{body} · הסתיים"
    out: dict[str, Any] = {
        "v": 2, "id": n["id"], "title": push._clip(title, 80), "body": push._clip(body, 180), "url": f"#/notifications/{n['id']}", "category": n["category"],
        "severity": n["severity"], "tag": f"arx-n-{n['id']}", "ts": iso_utc(now),
    }
    if mode in ("renotify", "escalate"):
        out["renotify"] = True
    if mode == "resolved":
        out["resolved"] = True
    actions: list[dict[str, Any]] = []
    if level == "generic":
        tokens, door = None, None  # the most private level carries NO action at all - not the buttons, not the doorbell link
    if tokens:
        if "ack" in tokens:
            actions.append({"a": "ack", "title": "אישור", "t": tokens["ack"]})
        if "snooze" in tokens:
            actions.append({"a": "snooze", "title": "השתק לשעה", "t": tokens["snooze"]})
    if door and door.get("can_open") and mode != "resolved":
        actions.append({"a": "open_door", "title": "פתח דלת", "url": f"#/doors/{door['id']}?confirm={n['id']}"})  # a deep link: no token, no call
    if actions:
        out["actions"] = actions
    return out


# ---------------------------------------------------------------- the built-in Web Push channel

class WebPushChannel(Channel):
    name = "webpush"

    def plan(self, d: Dispatch, conn: Any) -> list[Target]:
        out: list[Target] = []
        key = push.signing_key(conn)
        d.scratch["webpush_key"] = key
        for uid in d.users:
            subs = conn.execute("SELECT * FROM push_subscriptions WHERE user_id = ? AND kind = 'webpush' ORDER BY created_at", (uid,)).fetchall()
            reach = d.reach(uid)
            if reach is None or not subs:
                continue
            host = push.endpoint_host(subs[0]["endpoint"])
            if not reach.can_see(d.n):
                push.STATS["refused"] += 1
                out.append(Target(self.name, uid, host, "skipped", "no_reach"))
                continue
            rec = conn.execute("SELECT snoozed_until FROM notification_recipients WHERE notification_id = ? AND user_id = ?", (d.nid, uid)).fetchone()
            if d.mode != "escalate" and rec is not None and rec["snoozed_until"] and rec["snoozed_until"] > iso_utc(d.now):
                out.append(Target(self.name, uid, host, "skipped", "snoozed"))
                continue
            if d.held(self.name):
                out.append(Target(self.name, uid, host, "skipped", "quiet_hours"))
                continue
            if key is None:
                out.append(Target(self.name, uid, host, "skipped", "no_key"))
                continue
            if d.severity != "critical" and d.mode != "escalate" and not push.take_token(uid):
                push.STATS["rate_limited"] += 1
                out.append(Target(self.name, uid, host, "skipped", "rate_limited"))
                continue
            generic = d.settings["lockscreen"] == "generic"  # nothing to tap on a generic push: no tokens are minted either
            actions = [] if (d.mode == "resolved" or generic) else (["ack", "snooze"] if reach.can_ack(d.n) else ["snooze"])
            door = reach.door(d.n) if (d.mode != "resolved" and not generic) else None
            for s in subs:
                out.append(Target(self.name, uid, push.endpoint_host(s["endpoint"]), "queued", None, {"sub": s, "actions": actions, "door": door}))
        return out

    def prepare(self, d: Dispatch, targets: list[Target], conn: Any) -> None:
        for t in targets:
            if t.status == "queued" and t.data["actions"]:
                t.data["tokens"] = notify.mint_tokens(conn, d.nid, t.user_id, t.data["actions"])  # type: ignore[arg-type]

    def send(self, notifier: "push.PushNotifier", d: Dispatch, targets: list[Target]) -> None:
        key = d.scratch.get("webpush_key")
        for t in targets:
            if t.status != "queued" or key is None:
                continue
            s = t.data["sub"]
            payload = payload_v2(d.n, d.settings["lockscreen"], tokens=t.data.get("tokens"), door=t.data["door"], tz_name=d.tz, mode=d.mode, now=d.now)
            job = push.Job(s["id"], t.user_id, s["endpoint"], s["p256dh"], s["auth"], push.encode_payload(payload), "high" if (d.severity == "critical" or d.mode == "escalate") else "normal",
                           notification_id=d.nid, delivery_id=t.delivery_id, mode=d.mode)  # type: ignore[arg-type]
            notifier.attempt(job, key)


register(WebPushChannel())


# ---------------------------------------------------------------- the dispatch

def dispatch(notifier: "push.PushNotifier", nid: str | None, item: dict[str, Any]) -> None:
    db = notifier.db
    assert db is not None and nid
    mode = item.get("mode") or "new"
    now = notify.now_utc()
    targets: list[Target] = []
    by_channel: list[tuple[Channel, Dispatch, list[Target]]] = []
    with db.connection(mode="read", label="notify.plan") as conn:
        row = conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone()
        if row is None:
            return
        n = notify._row_note(row)
        if mode in ("new", "renotify", "escalate") and n["state"] == "resolved":
            return  # the condition already ended: the inbox row says so
        if mode == "escalate" and n["state"] != "open":
            return  # acknowledged: escalation stops at once
        try:
            if (now - parse_utc(item.get("queued_at") or iso_utc(now))).total_seconds() > SENT_STALE_S:
                return  # an alert older than an hour is not worth waking a phone for (TTL semantics); the inbox has it
        except ValueError:
            pass
        policy = get_policy(conn, n["source"])
        if policy is None or not policy["enabled"]:
            return
        from ..routers.settings import read_settings

        st = nsettings.load(conn)
        tz = read_settings(conn)["time.zone"]
        if mode == "escalate":
            users = list(item.get("users") or [])
        elif mode == "resolved":
            users = [r[0] for r in conn.execute("SELECT DISTINCT user_id FROM notification_deliveries WHERE notification_id = ? AND status = 'sent' AND user_id IS NOT NULL", (nid,)).fetchall()]
        else:
            users = [r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ? ORDER BY added_at, user_id", (nid,)).fetchall()]
        d = Dispatch(nid, mode, n, policy, st, tz, now, nsettings.in_quiet_hours(st["quiet"], now, tz), list(dict.fromkeys(users)), item)
        d._conn = conn
        for name in ("webpush", "email"):  # the v1 channels, in the order they are shown; the reserved ones (ha_mobile, whatsapp, app) are never planned
            if not policy["channels"].get(name):
                continue
            ch = CHANNELS.get(name)
            if ch is None:
                if mode != "resolved":
                    targets.append(Target(name, None, "", "skipped", "channel_unavailable"))
                continue
            planned = ch.plan(d, conn)
            by_channel.append((ch, d, planned))
            targets.extend(planned)
    if not targets:
        return
    # phase B: the channels' tokens and the delivery-log rows, one short write transaction
    with db.connection(label="notify.deliveries") as conn:
        for ch, dd, planned in by_channel:
            ch.prepare(dd, planned, conn)
        stamp = now_iso()
        for t in targets:
            t.delivery_id = new_id()
            conn.execute(
                "INSERT INTO notification_deliveries(id, notification_id, user_id, channel, target_ref, status, reason, attempt, mode, created_at) VALUES (?,?,?,?,?,?,?,0,?,?)",
                (t.delivery_id, nid, t.user_id, t.channel, t.target_ref, t.status, t.reason, mode, stamp),
            )
    # phase C: send, outside every lock
    for ch, dd, planned in by_channel:
        queued = [t for t in planned if t.status == "queued"]
        if queued:
            try:
                ch.send(notifier, dd, queued)
            except Exception:  # noqa: BLE001 - one channel failing never stops the others
                log.exception("channel %s failed for notification %s", ch.name, nid)
                record_outcome(db, [t.delivery_id for t in queued], "failed", "channel_error", 1, notification_id=nid, channel=ch.name)


# ---------------------------------------------------------------- the user's own test notification

def send_test(db: Any, user_id: str) -> list[dict[str, Any]]:
    """`POST /notifications/test`: a v2 test push to the caller's own devices, once, now (the route rate-limits it). Not a
    notification row: it has no inbox entry, no action tokens and no delivery-log row."""
    with db.connection(mode="read", label="notify.test") as conn:
        key = push.signing_key(conn)
        subs = conn.execute("SELECT * FROM push_subscriptions WHERE user_id = ? AND kind = 'webpush' ORDER BY created_at", (user_id,)).fetchall()
    if key is None:
        return []
    payload = push.encode_payload({"v": 2, "id": "test", "title": "Arx · התראת בדיקה", "body": "ההתראות פועלות במכשיר הזה.", "url": "#/system/notifications", "category": "test",
                                   "severity": "info", "tag": "arx-test", "ts": now_iso()})
    out = []
    for s in subs:
        job = push.Job(s["id"], user_id, s["endpoint"], s["p256dh"], s["auth"], payload)
        o = push.send(job, key)
        out.append({"id": s["id"], "endpoint_host": push.endpoint_host(s["endpoint"]), "status": o.status, "outcome": push.record(db, job, o, final=True)})
    return out


# ---------------------------------------------------------------- housekeeping

def escalate(db: Any) -> int:
    with db.connection(label="notify.escalate") as conn:
        return notify.escalation_tick(conn)


def housekeeping(db: Any) -> None:
    """Retention: notifications for the configured days, deliveries for 14, spent action tokens, stale outbox rows."""
    with db.connection(label="notify.retention") as conn:
        notify.retention_sweep(conn)
