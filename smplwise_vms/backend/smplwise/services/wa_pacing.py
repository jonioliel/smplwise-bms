"""CR-WA-PACING-295: the shared WhatsApp send budget - one contract for every sender on a number (docs/changes/CR-WA-PACING-295.md).

`messaging_accounts.PacingGate` already paces one ACCOUNT (minimum gap, per hour, per day, per recipient) over the shared send ledger.
This module adds what that gate does not know, without touching it:

- a per-MINUTE cap and a short BURST cap (a rolling-window form of a token bucket: capacity = burst, refill = per_minute / 60);
- PRIORITY CLASSES that yield to each other on the same budget: a class may only start a send while the account's TOTAL use in the
  window is below its share of the cap, so operational alerts keep headroom that ticket reminders can never take;
- FOREIGN use: the sends WisKey made from the people screen (`intercom_messages`) count against the same budget when the administrator
  says WisKey sends from the same number (`wiskey_shared`, default on = the conservative reading);
- BACKOFF: a 429-type answer slows the whole account (60 s doubling to 30 min, reset by the next accepted send); a pair-rate answer
  (131056 type) slows only that sender/recipient pair (5 min doubling to 1 h);
- a QUEUE AGE LIMIT per class: a message that has waited on this budget longer than its limit ends visibly (`not_sent` /
  `pacing_expired`, with the module's normal fallback and manager notice) - it is never dropped silently;
- COUNTERS: per account and class, per hour, persisted (migration 0150, provisional).

The class of a message is a rule of code (`class_of`); the numbers come from a profile (`conservative` default, `standard`, `off`)
plus the account's own `Pacing` (per hour / per day), which stays the single place those two caps are set. `off` = the legacy gate
alone, byte for byte.

Pure over three small ports (ledger, foreign-use reader, store): no clock, no I/O of its own. No phone number is read or stored
anywhere here - recipients are the ledger's HMAC keys.
"""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from collections import defaultdict
from contextlib import AbstractContextManager
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Mapping, Protocol

UTC = dt.timezone.utc

SETTING_KEY = "messaging.pacing"

CLASS_ALERT, CLASS_CODE, CLASS_TICKET, CLASS_REMINDER = "alert", "code", "ticket", "reminder"
CLASSES = (CLASS_ALERT, CLASS_CODE, CLASS_TICKET, CLASS_REMINDER)
# A class may start a send only while the account's total use in the window is BELOW this share of the cap (at least one send).
SHARE_PCT: Mapping[str, int] = {CLASS_ALERT: 100, CLASS_CODE: 95, CLASS_TICKET: 80, CLASS_REMINDER: 60}

MODES = ("conservative", "standard", "off")
DEFAULT_MODE = "conservative"
# default longest wait on the budget before a message ends visibly (minutes); a code is useless after its 10 minutes
DEFAULT_MAX_WAIT_MIN: Mapping[str, int] = {CLASS_ALERT: 60, CLASS_CODE: 5, CLASS_TICKET: 360, CLASS_REMINDER: 720}
MAX_WAIT_RANGE = (1, 2880)

ACCOUNT_BACKOFF_S = (60, 1800)  # first step, ceiling (doubling)
PAIR_BACKOFF_S = (300, 3600)
SEVERE_LEVEL = 3  # at this many consecutive rate answers even alerts wait
COUNTER_KEEP = dt.timedelta(days=8)

# the outcome codes of channel_whatsapp.classify that mean "the platform asked us to slow down" (the message did NOT leave)
RATE_ACCOUNT, RATE_PAIR = "rate_limited", "pair_rate_limited"
RATE_CODES = (RATE_ACCOUNT, RATE_PAIR)

METRICS = ("sent", "deferred", "backoff", "pair_backoff", "expired")


@dataclass(frozen=True)
class Budget:
    per_minute: int
    burst: int
    burst_window_s: int = 10


PROFILES: Mapping[str, Budget] = {"conservative": Budget(per_minute=3, burst=2), "standard": Budget(per_minute=6, burst=3)}


@dataclass(frozen=True)
class PacerConfig:
    mode: str = DEFAULT_MODE
    wiskey_shared: bool = True
    max_wait_min: Mapping[str, int] = field(default_factory=lambda: dict(DEFAULT_MAX_WAIT_MIN))

    @property
    def enabled(self) -> bool:
        return self.mode != "off"

    def budget(self) -> Budget | None:
        return PROFILES.get(self.mode)

    def max_wait(self, klass: str) -> dt.timedelta:
        return dt.timedelta(minutes=int(self.max_wait_min.get(klass, DEFAULT_MAX_WAIT_MIN[klass])))


def parse_config(raw: Any) -> PacerConfig:
    """Total and forgiving: anything unusable falls back to the conservative default."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            raw = None
    if not isinstance(raw, Mapping):
        return PacerConfig()
    mode = raw.get("mode") if raw.get("mode") in MODES else DEFAULT_MODE
    shared = raw.get("wiskey_shared") if isinstance(raw.get("wiskey_shared"), bool) else True
    waits = dict(DEFAULT_MAX_WAIT_MIN)
    given = raw.get("max_wait_min")
    if isinstance(given, Mapping):
        for k in CLASSES:
            v = given.get(k)
            if isinstance(v, int) and not isinstance(v, bool) and MAX_WAIT_RANGE[0] <= v <= MAX_WAIT_RANGE[1]:
                waits[k] = v
    return PacerConfig(mode=mode, wiskey_shared=shared, max_wait_min=waits)


def validate_config(raw: Any) -> tuple[PacerConfig, list[dict[str, str]]]:
    """For the settings route: the strict form of `parse_config` (reports every bad field)."""
    problems: list[dict[str, str]] = []
    if not isinstance(raw, Mapping):
        return PacerConfig(), [{"code": "invalid", "field": "body"}]
    if "mode" in raw and raw["mode"] not in MODES:
        problems.append({"code": "mode_unknown", "field": "mode"})
    if "wiskey_shared" in raw and not isinstance(raw["wiskey_shared"], bool):
        problems.append({"code": "invalid", "field": "wiskey_shared"})
    given = raw.get("max_wait_min")
    if given is not None:
        if not isinstance(given, Mapping):
            problems.append({"code": "invalid", "field": "max_wait_min"})
        else:
            for k, v in given.items():
                if k not in CLASSES:
                    problems.append({"code": "class_unknown", "field": f"max_wait_min.{k}"})
                elif not (isinstance(v, int) and not isinstance(v, bool) and MAX_WAIT_RANGE[0] <= v <= MAX_WAIT_RANGE[1]):
                    problems.append({"code": "out_of_range", "field": f"max_wait_min.{k}"})
    return (parse_config(raw) if not problems else PacerConfig()), problems


def config_to_json(cfg: PacerConfig) -> dict[str, Any]:
    return {"mode": cfg.mode, "wiskey_shared": cfg.wiskey_shared, "max_wait_min": {k: int(cfg.max_wait_min.get(k, DEFAULT_MAX_WAIT_MIN[k])) for k in CLASSES}}


def load_config(conn: sqlite3.Connection) -> PacerConfig:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (SETTING_KEY,)).fetchone()
    return parse_config(row[0] if row else None)


def store_config(conn: sqlite3.Connection, cfg: PacerConfig) -> None:
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (SETTING_KEY, json.dumps(config_to_json(cfg), separators=(",", ":"))))


# ---------------------------------------------------------------- classes

# the ledger's use keys of senders other than the tickets module
USE_CLASS: Mapping[str, str] = {"notifications.whatsapp": CLASS_ALERT, "infra.temperature.reports": CLASS_REMINDER,
                                "tickets.codes": CLASS_CODE, "access.codes": CLASS_CODE, "identity.local": CLASS_CODE}
_TICKET_REMINDERS = frozenset({"reminder", "rfq_reminder", "report"})
_TICKET_CODES = frozenset({"code", "phone_verify", "test"})  # a test is an administrator waiting at a screen: it never queues behind reminders


def class_of(*, use_key: str | None = None, purpose: str | None = None, urgent: bool = False) -> str:
    """The priority class of one message. An operational alert (a notification; `urgent` is informational: both are alerts) outranks
    everything; a verification code or an administrator's test next; a ticket message next; reminders and reports last."""
    if purpose is not None:
        if purpose in _TICKET_CODES:
            return CLASS_CODE
        if purpose in _TICKET_REMINDERS:
            return CLASS_REMINDER
        return CLASS_TICKET
    return USE_CLASS.get(use_key or "", CLASS_TICKET)


# ---------------------------------------------------------------- ports

class Ledger(Protocol):
    def times(self, *, since: dt.datetime, account_key: str | None = None, recipient_key: str | None = None,
              kinds: Iterable[str] | None = None) -> list[dt.datetime]: ...


ForeignUse = Callable[[dt.datetime], list[dt.datetime]]  # WisKey sends (Arx's own record) after `since`


class PacerStore(Protocol):
    def get_state(self, scope: str) -> tuple[int, dt.datetime] | None: ...
    def set_state(self, scope: str, level: int, until: dt.datetime, now: dt.datetime) -> None: ...
    def clear_state(self, scope: str) -> None: ...
    def wait_since(self, ref: str) -> dt.datetime | None: ...
    def wait_start(self, ref: str, account_key: str, klass: str, now: dt.datetime) -> None: ...
    def wait_clear(self, ref: str) -> None: ...
    def bump(self, account_key: str, klass: str, metric: str, now: dt.datetime, n: int = 1) -> None: ...
    def prune(self, before: dt.datetime) -> int: ...


def _hour(moment: dt.datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H")


def _iso(moment: dt.datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _parse(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


class MemoryPacerStore:
    def __init__(self) -> None:
        self.state: dict[str, tuple[int, dt.datetime]] = {}
        self.waits: dict[str, tuple[str, str, dt.datetime]] = {}
        self.counts: dict[tuple[str, str, str, str], int] = defaultdict(int)  # (hour, account, class, metric)

    def get_state(self, scope: str) -> tuple[int, dt.datetime] | None:
        return self.state.get(scope)

    def set_state(self, scope: str, level: int, until: dt.datetime, now: dt.datetime) -> None:
        self.state[scope] = (level, until.astimezone(UTC))

    def clear_state(self, scope: str) -> None:
        self.state.pop(scope, None)

    def wait_since(self, ref: str) -> dt.datetime | None:
        w = self.waits.get(ref)
        return w[2] if w else None

    def wait_start(self, ref: str, account_key: str, klass: str, now: dt.datetime) -> None:
        self.waits.setdefault(ref, (account_key, klass, now.astimezone(UTC)))

    def wait_clear(self, ref: str) -> None:
        self.waits.pop(ref, None)

    def bump(self, account_key: str, klass: str, metric: str, now: dt.datetime, n: int = 1) -> None:
        self.counts[(_hour(now), account_key, klass, metric)] += n

    def prune(self, before: dt.datetime) -> int:
        old = [k for k in self.counts if k[0] < _hour(before)]
        for k in old:
            del self.counts[k]
        gone = [r for r, w in self.waits.items() if w[2] < before]
        for r in gone:
            del self.waits[r]
        return len(old) + len(gone)


class SqlitePacerStore:
    """Migration 0150 (provisional). `read()` yields a connection for reads; `write()` returns the caller's bound write connection
    (the same split `tickets.outbox_store.Access` makes for the send ledger: the worker writes inside its own transaction)."""

    def __init__(self, read: Callable[[], AbstractContextManager[sqlite3.Connection]], write: Callable[[], sqlite3.Connection] | None = None) -> None:
        self._read, self._write = read, write

    def _w(self) -> sqlite3.Connection:
        if self._write is None:
            raise RuntimeError("read-only pacer store")
        return self._write()

    def get_state(self, scope: str) -> tuple[int, dt.datetime] | None:
        with self._read() as conn:
            r = conn.execute("SELECT level, until FROM messaging_pacing_state WHERE scope = ?", (scope,)).fetchone()
        return (int(r[0]), _parse(r[1])) if r else None

    def set_state(self, scope: str, level: int, until: dt.datetime, now: dt.datetime) -> None:
        self._w().execute("INSERT INTO messaging_pacing_state(scope, level, until, updated_at) VALUES (?,?,?,?) "
                          "ON CONFLICT(scope) DO UPDATE SET level = excluded.level, until = excluded.until, updated_at = excluded.updated_at",
                          (scope, level, _iso(until), _iso(now)))

    def clear_state(self, scope: str) -> None:
        self._w().execute("DELETE FROM messaging_pacing_state WHERE scope = ?", (scope,))

    def wait_since(self, ref: str) -> dt.datetime | None:
        with self._read() as conn:
            r = conn.execute("SELECT since FROM messaging_pacing_wait WHERE ref = ?", (ref,)).fetchone()
        return _parse(r[0]) if r else None

    def wait_start(self, ref: str, account_key: str, klass: str, now: dt.datetime) -> None:
        self._w().execute("INSERT OR IGNORE INTO messaging_pacing_wait(ref, account_key, klass, since) VALUES (?,?,?,?)", (ref, account_key, klass, _iso(now)))

    def wait_clear(self, ref: str) -> None:
        self._w().execute("DELETE FROM messaging_pacing_wait WHERE ref = ?", (ref,))

    def bump(self, account_key: str, klass: str, metric: str, now: dt.datetime, n: int = 1) -> None:
        self._w().execute("INSERT INTO messaging_pacing_counter(hour, account_key, klass, metric, n) VALUES (?,?,?,?,?) "
                          "ON CONFLICT(hour, account_key, klass, metric) DO UPDATE SET n = n + excluded.n", (_hour(now), account_key, klass, metric, n))

    def prune(self, before: dt.datetime) -> int:
        c = self._w()
        a = c.execute("DELETE FROM messaging_pacing_counter WHERE hour < ?", (_hour(before),)).rowcount
        b = c.execute("DELETE FROM messaging_pacing_wait WHERE since < ?", (_iso(before),)).rowcount
        d = c.execute("DELETE FROM messaging_pacing_state WHERE until < ?", (_iso(before),)).rowcount
        return a + b + d


# ---------------------------------------------------------------- the pacer

@dataclass(frozen=True)
class Decision:
    allowed: bool
    not_before: dt.datetime
    reason: str | None = None  # backoff | pair_backoff | minute | burst | hour | day
    expired: bool = False  # the message has waited on this budget past its class limit: end it visibly


class WaPacer:
    def __init__(self, ledger: Ledger, store: PacerStore, *, config: Callable[[], PacerConfig] = PacerConfig,
                 foreign: ForeignUse | None = None) -> None:
        self.ledger, self.store, self._config, self._foreign = ledger, store, config, foreign

    def config(self) -> PacerConfig:
        return self._config()

    # ---- the decision
    def check(self, *, account_key: str, pacing: Any, recipient_key: str, klass: str, ref: str, now: dt.datetime) -> Decision:
        """May a message of `klass` start a send on this account now? Pure apart from the age clock of `ref` (the waiting message)."""
        cfg = self.config()
        now = now.astimezone(UTC)
        budget = cfg.budget()
        if budget is None:
            return Decision(True, now)
        waits: list[tuple[dt.datetime, str]] = []
        acct = self.store.get_state(f"account:{account_key}")
        if acct is not None and acct[1] > now and (klass != CLASS_ALERT or acct[0] >= SEVERE_LEVEL):
            waits.append((acct[1], "backoff"))
        pair = self.store.get_state(f"pair:{account_key}:{recipient_key}")
        if pair is not None and pair[1] > now:
            waits.append((pair[1], "pair_backoff"))
        day = dt.timedelta(days=1)
        times = self.ledger.times(since=now - day, account_key=account_key)
        if cfg.wiskey_shared and self._foreign is not None:
            times = sorted(times + [t for t in self._foreign(now - day) if t > now - day])
        share = SHARE_PCT.get(klass, SHARE_PCT[CLASS_TICKET])
        for span, cap, reason in ((dt.timedelta(seconds=budget.burst_window_s), budget.burst, "burst"),
                                  (dt.timedelta(minutes=1), budget.per_minute, "minute"),
                                  (dt.timedelta(hours=1), int(pacing.per_hour), "hour"),
                                  (day, int(pacing.per_day), "day")):
            limit = max(1, cap * share // 100)
            inside = [t for t in times if t > now - span]
            if len(inside) >= limit:
                waits.append((inside[len(inside) - limit] + span, reason))
        if not waits:
            self.store.wait_clear(ref)
            return Decision(True, now)
        until, reason = max(waits)
        started = self.store.wait_since(ref)
        if started is None:
            self.store.wait_start(ref, account_key, klass, now)
            self.store.bump(account_key, klass, "deferred", now)
        elif now - started >= cfg.max_wait(klass):
            self.store.bump(account_key, klass, "expired", now)
            self.store.wait_clear(ref)
            return Decision(False, until, reason, expired=True)
        return Decision(False, until, reason)

    # ---- what happened
    def note_deferred(self, *, account_key: str, klass: str, ref: str, now: dt.datetime) -> None:
        """A send the platform turned away (nothing left): the age clock of the message starts (or keeps running)."""
        if self.store.wait_since(ref) is None:
            self.store.wait_start(ref, account_key, klass, now)
            self.store.bump(account_key, klass, "deferred", now)

    def aged_out(self, *, ref: str, now: dt.datetime, klass: str) -> bool:
        started = self.store.wait_since(ref)
        return started is not None and now - started >= self.config().max_wait(klass)

    def release(self, ref: str) -> None:
        self.store.wait_clear(ref)

    def on_result(self, *, account_key: str, recipient_key: str, klass: str, outcome: str, outcome_code: str | None, now: dt.datetime) -> dt.datetime | None:
        """Learn from one provider answer. Returns the time before which a retry would be pointless (None = no new backoff)."""
        now = now.astimezone(UTC)
        if not self.config().enabled:
            return None
        if outcome == "not_sent" and outcome_code == RATE_ACCOUNT:
            return self._step(f"account:{account_key}", ACCOUNT_BACKOFF_S, now, account_key, klass, "backoff")
        if outcome == "not_sent" and outcome_code == RATE_PAIR:
            return self._step(f"pair:{account_key}:{recipient_key}", PAIR_BACKOFF_S, now, account_key, klass, "pair_backoff")
        if outcome in ("sent", "unknown"):
            if outcome == "sent":
                self.store.bump(account_key, klass, "sent", now)
                scope = f"account:{account_key}"
                state = self.store.get_state(scope)
                if state is not None and state[1] <= now:
                    self.store.clear_state(scope)  # the platform accepted a send after the wait: the ladder starts over
                self.store.clear_state(f"pair:{account_key}:{recipient_key}")
        return None

    def _step(self, scope: str, steps: tuple[int, int], now: dt.datetime, account_key: str, klass: str, metric: str) -> dt.datetime:
        old = self.store.get_state(scope)
        level = (old[0] + 1) if old is not None else 1
        delay = min(steps[0] * 2 ** (level - 1), steps[1])
        until = now + dt.timedelta(seconds=delay)
        self.store.set_state(scope, level, until, now)
        self.store.bump(account_key, klass, metric, now)
        return until

    def blocked_until(self, account_key: str, recipient_key: str, now: dt.datetime) -> dt.datetime:
        """The later of the account's and the pair's backoff end (or `now`)."""
        ends = [now]
        for scope in (f"account:{account_key}", f"pair:{account_key}:{recipient_key}"):
            s = self.store.get_state(scope)
            if s is not None and s[1] > now:
                ends.append(s[1])
        return max(ends)


# ---------------------------------------------------------------- foreign use: WisKey's own record

def wiskey_foreign_use(conn: sqlite3.Connection) -> ForeignUse:
    """The messages Arx handed to WisKey from the people screen (`intercom_messages`, written BEFORE the send): they spend the same
    number's budget when WisKey sends from it. 'pending' counts (it may be on its way); a message that provably never left is deleted
    by its own module."""
    def read(since: dt.datetime) -> list[dt.datetime]:
        rows = conn.execute("SELECT at FROM intercom_messages WHERE at > ? AND outcome IN ('pending', 'sent', 'unknown') ORDER BY at",
                            (since.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S") + "Z",)).fetchall()
        out = []
        for (at,) in rows:
            try:
                out.append(_parse(at) if "T" in at else dt.datetime.fromisoformat(at).replace(tzinfo=UTC))
            except ValueError:
                continue
        return out

    return read


# ---------------------------------------------------------------- the visible counters

def snapshot(conn: sqlite3.Connection, ledger: Ledger, cfg: PacerConfig, accounts: Iterable[str], now: dt.datetime) -> dict[str, Any]:
    """The administrator's view (`GET /messaging/whatsapp/pacing`): per account the sends of the last hour and day (Arx's own, and
    WisKey's when counted), the queue that waits on the budget (count, oldest age), the counters of the last 24 hours by metric, and
    the backoff in force. Never a number, a text or a recipient."""
    now = now.astimezone(UTC)
    since_h, since_d = now - dt.timedelta(hours=1), now - dt.timedelta(days=1)
    foreign = wiskey_foreign_use(conn) if cfg.wiskey_shared else (lambda _s: [])
    f_day = foreign(since_d)
    out: list[dict[str, Any]] = []
    for key in accounts:
        arx = ledger.times(since=since_d, account_key=key)
        waits = conn.execute(
            "SELECT w.klass, w.since FROM messaging_pacing_wait w JOIN ticket_outbox o ON o.id = w.ref "
            "WHERE w.account_key = ? AND o.state IN ('queued', 'held')", (key,)).fetchall()
        by_class: dict[str, int] = defaultdict(int)
        oldest = None
        for klass, since in waits:
            by_class[klass] += 1
            s = _parse(since)
            oldest = s if oldest is None or s < oldest else oldest
        metrics = {m: 0 for m in METRICS}
        for metric, n in conn.execute("SELECT metric, SUM(n) FROM messaging_pacing_counter WHERE account_key = ? AND hour >= ? GROUP BY metric",
                                      (key, _hour(since_d))).fetchall():
            if metric in metrics:
                metrics[metric] = int(n or 0)
        st = conn.execute("SELECT level, until FROM messaging_pacing_state WHERE scope = ?", (f"account:{key}",)).fetchone()
        backoff = {"level": int(st[0]), "until": _parse(st[1]).isoformat().replace("+00:00", "Z")} if st and _parse(st[1]) > now else None
        pairs = conn.execute("SELECT COUNT(*) FROM messaging_pacing_state WHERE scope LIKE ? AND until > ?", (f"pair:{key}:%", _iso(now))).fetchone()[0]
        out.append({"account_key": key, "sends_1h": sum(1 for t in arx if t > since_h), "sends_24h": len(arx),
                    "wiskey_1h": sum(1 for t in f_day if t > since_h), "wiskey_24h": len(f_day),
                    "waiting": sum(by_class.values()), "waiting_by_class": dict(by_class),
                    "oldest_wait_s": int((now - oldest).total_seconds()) if oldest else None,
                    "counters_24h": metrics, "backoff": backoff, "pairs_in_backoff": int(pairs)})
    budget = cfg.budget()
    return {"mode": cfg.mode, "wiskey_shared": cfg.wiskey_shared, "max_wait_min": {k: int(cfg.max_wait_min.get(k, DEFAULT_MAX_WAIT_MIN[k])) for k in CLASSES},
            "budget": {"per_minute": budget.per_minute, "burst": budget.burst, "burst_window_s": budget.burst_window_s} if budget else None,
            "share_pct": dict(SHARE_PCT), "accounts": out}
