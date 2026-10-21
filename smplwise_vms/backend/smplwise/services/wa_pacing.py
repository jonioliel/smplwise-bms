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
- COUNTERS: per account and class, per hour, persisted (migration 0144, built as provisional 0150).

The class of a message is a rule of code (`class_of`); the numbers come from a profile (`conservative` default, `standard`, `off`)
plus the account's own `Pacing` (per hour / per day), which stays the single place those two caps are set. `off` = the legacy gate
alone, byte for byte.

Pure over three small ports (ledger, foreign-use reader, store): no clock, no I/O of its own. No phone number is read or stored
anywhere here - recipients are the ledger's HMAC keys.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import re
import sqlite3
from collections import defaultdict
from contextlib import AbstractContextManager
from dataclasses import dataclass, field, replace
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
COUNTER_KEEP = dt.timedelta(days=8)

# the outcome codes of channel_whatsapp.classify that mean "the platform asked us to slow down" (the message did NOT leave)
RATE_ACCOUNT, RATE_PAIR = "rate_limited", "pair_rate_limited"
RATE_CODES = (RATE_ACCOUNT, RATE_PAIR)

METRICS = ("sent", "deferred", "backoff", "pair_backoff", "expired", "lease_granted", "lease_denied")


@dataclass(frozen=True)
class Budget:
    per_minute: int
    burst: int
    burst_window_s: int = 10


# owner 2026-10-21: WhatsApp was tested at 10 messages a minute. Hour and day are the account's own `Pacing` (300 / 1500 by default).
PROFILES: Mapping[str, Budget] = {"conservative": Budget(per_minute=10, burst=5), "standard": Budget(per_minute=20, burst=8)}
RANGE_PER_MINUTE, RANGE_BURST, RANGE_LEASE_TTL = (1, 120), (1, 60), (10, 300)
DEFAULT_LEASE_TTL_S = 60
ACCOUNT_KEY_RE = re.compile(r"^(entry:[A-Za-z0-9_\-]{1,64}|manual:[a-z0-9]{4,16})$")
SENDER_REF_RE = re.compile(r"^[A-Za-z0-9_.:\-]{1,128}$")


@dataclass(frozen=True)
class PacerConfig:
    mode: str = DEFAULT_MODE
    wiskey_shared: bool = True
    max_wait_min: Mapping[str, int] = field(default_factory=lambda: dict(DEFAULT_MAX_WAIT_MIN))
    per_minute: int | None = None  # None = the profile's number
    burst: int | None = None
    lease_ttl_s: int = DEFAULT_LEASE_TTL_S
    # Arx account key -> WisKey's opaque `sender_ref` of the same number. The ONLY way an account is matched with WisKey's (never a name
    # or the last four digits); WisKey must also report `sender_match_verified` for it before its counters are used.
    senders: Mapping[str, str] = field(default_factory=dict)

    @property
    def enabled(self) -> bool:
        return self.mode != "off"

    def budget(self) -> Budget | None:
        base = PROFILES.get(self.mode)
        if base is None:
            return None
        return Budget(per_minute=self.per_minute or base.per_minute, burst=self.burst or base.burst, burst_window_s=base.burst_window_s)

    def max_wait(self, klass: str) -> dt.timedelta:
        return dt.timedelta(minutes=int(self.max_wait_min.get(klass, DEFAULT_MAX_WAIT_MIN[klass])))

    def wiskey_counts(self, account_key: str) -> bool:
        """Do WisKey's sends spend this account's budget? On by default; with a sender mapping, only for the mapped accounts."""
        return self.wiskey_shared and (not self.senders or account_key in self.senders)


def _int_in(v: Any, rng: tuple[int, int]) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) and rng[0] <= v <= rng[1] else None


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
    senders = {}
    if isinstance(raw.get("senders"), Mapping):
        senders = {k: v for k, v in raw["senders"].items() if isinstance(k, str) and isinstance(v, str) and ACCOUNT_KEY_RE.match(k) and SENDER_REF_RE.match(v)}
    return PacerConfig(mode=mode, wiskey_shared=shared, max_wait_min=waits, per_minute=_int_in(raw.get("per_minute"), RANGE_PER_MINUTE),
                       burst=_int_in(raw.get("burst"), RANGE_BURST), lease_ttl_s=_int_in(raw.get("lease_ttl_s"), RANGE_LEASE_TTL) or DEFAULT_LEASE_TTL_S, senders=senders)


def validate_config(raw: Any) -> tuple[PacerConfig, list[dict[str, str]]]:
    """For the settings route: the strict form of `parse_config` (reports every bad field)."""
    problems: list[dict[str, str]] = []
    if not isinstance(raw, Mapping):
        return PacerConfig(), [{"code": "invalid", "field": "body"}]
    if "mode" in raw and raw["mode"] not in MODES:
        problems.append({"code": "mode_unknown", "field": "mode"})
    if "wiskey_shared" in raw and not isinstance(raw["wiskey_shared"], bool):
        problems.append({"code": "invalid", "field": "wiskey_shared"})
    for name, rng in (("per_minute", RANGE_PER_MINUTE), ("burst", RANGE_BURST), ("lease_ttl_s", RANGE_LEASE_TTL)):
        if raw.get(name) is not None and _int_in(raw[name], rng) is None:
            problems.append({"code": "out_of_range", "field": name})
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
    if raw.get("senders") is not None:
        if not isinstance(raw["senders"], Mapping):
            problems.append({"code": "invalid", "field": "senders"})
        else:
            refs = list(raw["senders"].values())
            for k, v in raw["senders"].items():
                if not (isinstance(k, str) and ACCOUNT_KEY_RE.match(k)):
                    problems.append({"code": "account_key_invalid", "field": f"senders.{k}"})
                elif not (isinstance(v, str) and SENDER_REF_RE.match(v)):
                    problems.append({"code": "sender_ref_invalid", "field": f"senders.{k}"})
                elif refs.count(v) > 1:
                    problems.append({"code": "sender_ref_duplicate", "field": f"senders.{k}"})
    return (parse_config(raw) if not problems else PacerConfig()), problems


def config_to_json(cfg: PacerConfig) -> dict[str, Any]:
    return {"mode": cfg.mode, "wiskey_shared": cfg.wiskey_shared, "max_wait_min": {k: int(cfg.max_wait_min.get(k, DEFAULT_MAX_WAIT_MIN[k])) for k in CLASSES},
            "per_minute": cfg.per_minute, "burst": cfg.burst, "lease_ttl_s": cfg.lease_ttl_s, "senders": dict(cfg.senders)}


def load_config(conn: sqlite3.Connection) -> PacerConfig:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (SETTING_KEY,)).fetchone()
    return parse_config(row[0] if row else None)


def store_config(conn: sqlite3.Connection, cfg: PacerConfig) -> None:
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (SETTING_KEY, json.dumps(config_to_json(cfg), separators=(",", ":"))))


# ---------------------------------------------------------------- classes

# the ledger's use keys of senders other than the tickets module
USE_CLASS: Mapping[str, str] = {"notifications.whatsapp": CLASS_ALERT, "infra.temperature.reports": CLASS_REMINDER,
                                "tickets.codes": CLASS_CODE, "access.codes": CLASS_CODE, "identity.local": CLASS_CODE,
                                # CR-W11TPL-295: a template send is a normal people-screen message - no class of its own
                                "intercom.messages": CLASS_TICKET, "intercom.template": CLASS_TICKET}
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


@dataclass(frozen=True)
class Lease:
    """A reservation WisKey holds for one send of its own (the reservation port). It counts as a send from `granted_at` until it is
    released as `not_sent`; a lease that expires unreleased stays counted (the send may have left)."""

    request_id: str
    account_key: str
    klass: str
    sender_ref: str
    granted_at: dt.datetime
    expires_at: dt.datetime
    state: str = "granted"  # granted | released
    outcome: str | None = None
    counted: bool = True


class PacerStore(Protocol):
    def get_state(self, scope: str) -> tuple[int, dt.datetime] | None: ...
    def set_state(self, scope: str, level: int, until: dt.datetime, now: dt.datetime) -> None: ...
    def clear_state(self, scope: str) -> None: ...
    def wait_since(self, ref: str) -> dt.datetime | None: ...
    def wait_start(self, ref: str, account_key: str, klass: str, now: dt.datetime) -> None: ...
    def wait_clear(self, ref: str) -> None: ...
    def bump(self, account_key: str, klass: str, metric: str, now: dt.datetime, n: int = 1) -> None: ...
    def prune(self, before: dt.datetime) -> int: ...
    def lease_get(self, request_id: str) -> Lease | None: ...
    def lease_put(self, lease: Lease) -> None: ...
    def lease_times(self, account_key: str, since: dt.datetime) -> list[dt.datetime]: ...
    def lease_active(self, account_key: str, now: dt.datetime) -> int: ...


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
        self.leases: dict[str, Lease] = {}

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
        dead = [r for r, x in self.leases.items() if x.expires_at < before]
        for r in dead:
            del self.leases[r]
        return len(old) + len(gone) + len(dead)

    def lease_get(self, request_id: str) -> Lease | None:
        return self.leases.get(request_id)

    def lease_put(self, lease: Lease) -> None:
        self.leases[lease.request_id] = lease

    def lease_times(self, account_key: str, since: dt.datetime) -> list[dt.datetime]:
        return sorted(x.granted_at for x in self.leases.values() if x.account_key == account_key and x.counted and x.granted_at > since)

    def lease_active(self, account_key: str, now: dt.datetime) -> int:
        return sum(1 for x in self.leases.values() if x.account_key == account_key and x.state == "granted" and x.expires_at > now)


class SqlitePacerStore:
    """Migration 0144 (built as provisional 0150). `read()` yields a connection for reads; `write()` returns the caller's bound write connection
    (the same split `tickets.outbox_store.Access` makes for the send ledger: the worker writes inside its own transaction)."""

    def __init__(self, read: Callable[[], AbstractContextManager[sqlite3.Connection]], write: Callable[[], sqlite3.Connection] | None = None) -> None:
        self._read, self._write = read, write

    def _w(self) -> sqlite3.Connection:
        if self._write is None:
            raise RuntimeError("read-only pacer store")
        return self._write()

    def get_state(self, scope: str) -> tuple[int, dt.datetime] | None:
        with self._read() as conn:
            r = conn.execute("SELECT level, until FROM wa_pacing_state WHERE scope = ?", (scope,)).fetchone()
        return (int(r[0]), _parse(r[1])) if r else None

    def set_state(self, scope: str, level: int, until: dt.datetime, now: dt.datetime) -> None:
        self._w().execute("INSERT INTO wa_pacing_state(scope, level, until, updated_at) VALUES (?,?,?,?) "
                          "ON CONFLICT(scope) DO UPDATE SET level = excluded.level, until = excluded.until, updated_at = excluded.updated_at",
                          (scope, level, _iso(until), _iso(now)))

    def clear_state(self, scope: str) -> None:
        self._w().execute("DELETE FROM wa_pacing_state WHERE scope = ?", (scope,))

    def wait_since(self, ref: str) -> dt.datetime | None:
        with self._read() as conn:
            r = conn.execute("SELECT since FROM wa_pacing_wait WHERE ref = ?", (ref,)).fetchone()
        return _parse(r[0]) if r else None

    def wait_start(self, ref: str, account_key: str, klass: str, now: dt.datetime) -> None:
        self._w().execute("INSERT OR IGNORE INTO wa_pacing_wait(ref, account_key, klass, since) VALUES (?,?,?,?)", (ref, account_key, klass, _iso(now)))

    def wait_clear(self, ref: str) -> None:
        self._w().execute("DELETE FROM wa_pacing_wait WHERE ref = ?", (ref,))

    def bump(self, account_key: str, klass: str, metric: str, now: dt.datetime, n: int = 1) -> None:
        self._w().execute("INSERT INTO wa_pacing_counter(hour, account_key, klass, metric, n) VALUES (?,?,?,?,?) "
                          "ON CONFLICT(hour, account_key, klass, metric) DO UPDATE SET n = n + excluded.n", (_hour(now), account_key, klass, metric, n))

    def prune(self, before: dt.datetime) -> int:
        c = self._w()
        a = c.execute("DELETE FROM wa_pacing_counter WHERE hour < ?", (_hour(before),)).rowcount
        b = c.execute("DELETE FROM wa_pacing_wait WHERE since < ?", (_iso(before),)).rowcount
        d = c.execute("DELETE FROM wa_pacing_state WHERE until < ?", (_iso(before),)).rowcount
        e = c.execute("DELETE FROM wa_pacing_lease WHERE expires_at < ?", (_iso(before),)).rowcount
        return a + b + d + e

    def lease_get(self, request_id: str) -> Lease | None:
        with self._read() as conn:
            r = conn.execute("SELECT request_id, account_key, klass, sender_ref, granted_at, expires_at, state, outcome, counted FROM wa_pacing_lease WHERE request_id = ?",
                             (request_id,)).fetchone()
        return Lease(r[0], r[1], r[2], r[3], _parse(r[4]), _parse(r[5]), r[6], r[7], bool(r[8])) if r else None

    def lease_put(self, lease: Lease) -> None:
        self._w().execute("INSERT INTO wa_pacing_lease(request_id, account_key, klass, sender_ref, granted_at, expires_at, state, outcome, counted) VALUES (?,?,?,?,?,?,?,?,?) "
                          "ON CONFLICT(request_id) DO UPDATE SET state = excluded.state, outcome = excluded.outcome, counted = excluded.counted",
                          (lease.request_id, lease.account_key, lease.klass, lease.sender_ref, _iso(lease.granted_at), _iso(lease.expires_at), lease.state, lease.outcome, int(lease.counted)))

    def lease_times(self, account_key: str, since: dt.datetime) -> list[dt.datetime]:
        with self._read() as conn:
            rows = conn.execute("SELECT granted_at FROM wa_pacing_lease WHERE account_key = ? AND counted = 1 AND granted_at > ? ORDER BY granted_at", (account_key, _iso(since))).fetchall()
        return [_parse(r[0]) for r in rows]

    def lease_active(self, account_key: str, now: dt.datetime) -> int:
        with self._read() as conn:
            return int(conn.execute("SELECT COUNT(*) FROM wa_pacing_lease WHERE account_key = ? AND state = 'granted' AND expires_at > ?", (account_key, _iso(now))).fetchone()[0])


# ---------------------------------------------------------------- WisKey's side: `whatsapp_pacing_status_v1` (tolerant reader)

PACING_SCHEMA = "whatsapp_pacing_status_v1"
WINDOWS = ("1m", "1h", "24h")


@dataclass(frozen=True)
class WiskeyStatus:
    """One WisKey sender as `whatsapp/status` describes it (a specification of additions on WisKey's side, 2026-10-21, not implemented
    there yet). Only `wiskey_own.charged_*` is ever counted against the Arx budget - never `sent_*` (Arx already counts the messages it
    handed on) and never a counter that is null or whose `counters_complete` is not true: that is UNKNOWN, not zero."""

    sender_ref: str
    verified: bool  # sender_match_verified: WisKey itself vouches that sender_ref is the number Arx's account is
    complete: bool  # counters_complete
    charged: Mapping[str, int | None]  # "1m" | "1h" | "24h" -> accepted + reservations + in-flight + unknown, or None (unknown)
    throttled_until: dt.datetime | None = None
    throttle_scope: str | None = None
    retry_after_s: int | None = None
    # charged_unreserved_*: the same count WITHOUT the sends that carry an Arx lease (reconciled by request_id); null = unknown
    unreserved: Mapping[str, int | None] = field(default_factory=dict)


def _when(v: Any) -> dt.datetime | None:
    if not isinstance(v, str):
        return None
    try:
        d = dt.datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d.astimezone(UTC) if d.tzinfo else d.replace(tzinfo=UTC)


def _count(v: Any) -> int | None:
    return v if isinstance(v, int) and not isinstance(v, bool) and v >= 0 else None


def parse_wiskey_account(raw: Any) -> WiskeyStatus | None:
    """One `accounts[]` entry -> WiskeyStatus, or None when it carries no usable pacing contract (older WisKey, other schema, no
    sender_ref). Unknown keys are dropped; nothing here ever raises on a malformed answer."""
    if not isinstance(raw, Mapping):
        return None
    version = raw.get("pacing_schema_version")
    if version not in (1, "1", "v1", PACING_SCHEMA):
        return None
    ref = raw.get("sender_ref")
    if not (isinstance(ref, str) and SENDER_REF_RE.match(ref)):
        return None
    own = raw.get("wiskey_own") if isinstance(raw.get("wiskey_own"), Mapping) else {}
    scope = raw.get("throttle_scope")
    return WiskeyStatus(sender_ref=ref, verified=raw.get("sender_match_verified") is True, complete=raw.get("counters_complete") is True,
                        charged={w: _count(own.get(f"charged_{w}")) for w in WINDOWS}, unreserved={w: _count(own.get(f"charged_unreserved_{w}")) for w in WINDOWS},
                        throttled_until=_when(raw.get("throttled_until")),
                        throttle_scope=scope if isinstance(scope, str) and len(scope) <= 32 else None, retry_after_s=_count(raw.get("retry_after_s")))


def project_pacing_accounts(accounts: Any) -> list[dict[str, Any]]:
    """The keys of `whatsapp_pacing_status_v1` Arx reads, as plain JSON-safe dicts (everything else is dropped). Entries that do not speak
    the contract are dropped; `parse_wiskey_status` reads the result."""
    out: list[dict[str, Any]] = []
    for a in accounts if isinstance(accounts, list) else []:
        st = parse_wiskey_account(a)
        if st is None:
            continue
        out.append({"pacing_schema_version": 1, "sender_ref": st.sender_ref, "sender_match_verified": st.verified, "counters_complete": st.complete,
                    "wiskey_own": {**{f"charged_{w}": v for w, v in st.charged.items()}, **{f"charged_unreserved_{w}": v for w, v in st.unreserved.items()}},
                    "throttled_until": st.throttled_until.isoformat() if st.throttled_until else None, "throttle_scope": st.throttle_scope,
                    "retry_after_s": st.retry_after_s})
    return out[:10]


def parse_wiskey_status(accounts: Any) -> dict[str, WiskeyStatus]:
    """`accounts[]` of `whatsapp/status` -> {sender_ref: WiskeyStatus} for the entries that speak the contract."""
    out: dict[str, WiskeyStatus] = {}
    for a in accounts if isinstance(accounts, list) else []:
        st = parse_wiskey_account(a)
        if st is not None:
            out[st.sender_ref] = st
    return out


# ---------------------------------------------------------------- the pacer

@dataclass(frozen=True)
class Decision:
    allowed: bool
    not_before: dt.datetime
    reason: str | None = None  # backoff | pair_backoff | minute | burst | hour | day
    expired: bool = False  # the message has waited on this budget past its class limit: end it visibly


class WaPacer:
    def __init__(self, ledger: Ledger, store: PacerStore, *, config: Callable[[], PacerConfig] = PacerConfig,
                 foreign: ForeignUse | None = None, wiskey: Callable[[], Mapping[str, WiskeyStatus]] | None = None) -> None:
        self.ledger, self.store, self._config, self._foreign, self._wiskey = ledger, store, config, foreign, wiskey

    def config(self) -> PacerConfig:
        return self._config()

    # ---- what WisKey spends on this account
    def wiskey_view(self, account_key: str, now: dt.datetime, cfg: PacerConfig | None = None) -> dict[str, Any]:
        """The foreign load on one account: the timestamps Arx knows (its record of messages handed to WisKey, and granted leases) and
        WisKey's own charged counters when its status speaks the contract for a VERIFIED, mapped sender with complete counters.
        `unknown` = WisKey's counters are missing for a mapped sender: its own sends are not in the budget, and the snapshot says
        unknown - never zero."""
        cfg = cfg or self.config()
        day = dt.timedelta(days=1)
        out: dict[str, Any] = {"times": [], "charged": None, "unknown": False, "mapped": account_key in cfg.senders, "verified": False,
                               "throttled_until": None, "throttle_scope": None, "retry_after_s": None, "superseded_by_leases": False}
        if not cfg.wiskey_counts(account_key):
            return out
        times = [t for t in (self._foreign(now - day) if self._foreign is not None else []) if t > now - day]
        leases = self.store.lease_times(account_key, now - day)
        out["times"] = sorted(times + leases)
        out["superseded_by_leases"] = bool(leases)
        ref = cfg.senders.get(account_key)
        if ref is None:
            return out
        st = (self._wiskey() if self._wiskey is not None else {}).get(ref)
        if st is None or not st.verified:
            out["unknown"] = True
            return out
        out["verified"] = True
        if st.throttled_until is not None and st.throttled_until > now and st.throttle_scope in (None, "account", "sender"):
            out.update(throttled_until=st.throttled_until, throttle_scope=st.throttle_scope, retry_after_s=st.retry_after_s)
        if not st.complete or any(v is None for v in st.charged.values()):
            out["unknown"] = True
        elif not leases:
            out["charged"] = dict(st.charged)
        elif all(st.unreserved.get(w) is not None for w in WINDOWS):
            # WisKey reserves through the port: the leases ARE those sends, so only its UNRESERVED sends (a fail-open local send, a send
            # with no lease) are added on top - never `charged_*`, which includes the reserved ones and would count them twice
            out["charged"] = dict(st.unreserved)
        else:
            out["unknown"] = True  # leases exist but WisKey cannot say what it sent outside them: its unreserved sends are unknown, not zero
        return out

    # ---- the decision
    def _waits(self, *, account_key: str, pacing: Any, klass: str, now: dt.datetime, recipient_key: str | None, cfg: PacerConfig,
               budget: Budget) -> list[tuple[dt.datetime, str]]:
        waits: list[tuple[dt.datetime, str]] = []
        view = self.wiskey_view(account_key, now, cfg)
        if klass != CLASS_ALERT:  # owner 2026-10-21: operational alerts are counted but never delayed by a backoff or a throttle
            acct = self.store.get_state(f"account:{account_key}")
            if acct is not None and acct[1] > now:
                waits.append((acct[1], "backoff"))
            if recipient_key is not None:
                pair = self.store.get_state(f"pair:{account_key}:{recipient_key}")
                if pair is not None and pair[1] > now:
                    waits.append((pair[1], "pair_backoff"))
            if view["throttled_until"] is not None:
                waits.append((view["throttled_until"], "wiskey_throttle"))
        day = dt.timedelta(days=1)
        times = sorted(self.ledger.times(since=now - day, account_key=account_key) + view["times"])
        charged = view["charged"] or {}
        share = SHARE_PCT.get(klass, SHARE_PCT[CLASS_TICKET])
        for span, cap, reason, window in ((dt.timedelta(seconds=budget.burst_window_s), budget.burst, "burst", None),
                                          (dt.timedelta(minutes=1), budget.per_minute, "minute", "1m"),
                                          (dt.timedelta(hours=1), int(pacing.per_hour), "hour", "1h"),
                                          (day, int(pacing.per_day), "day", "24h")):
            limit = max(1, cap * share // 100)
            inside = [t for t in times if t > now - span]
            extra = int(charged.get(window) or 0) if window else 0
            if len(inside) + extra >= limit:
                if len(inside) >= limit:
                    waits.append((inside[len(inside) - limit] + span, reason))
                else:  # the excess is WisKey's own, known as a count only: spread it evenly over the window
                    waits.append((now + dt.timedelta(seconds=max(1.0, span.total_seconds() / max(1, len(inside) + extra))), reason))
        return waits

    def check(self, *, account_key: str, pacing: Any, recipient_key: str, klass: str, ref: str, now: dt.datetime,
              retrying: bool = False) -> Decision:
        """May a message of `klass` start a send on this account now? Pure apart from the age clock of `ref` (the waiting message).
        `retrying`: the message is back after a rate answer - its age clock keeps running through an allowed check."""
        cfg = self.config()
        now = now.astimezone(UTC)
        budget = cfg.budget()
        if budget is None:
            return Decision(True, now)
        waits = self._waits(account_key=account_key, pacing=pacing, klass=klass, now=now, recipient_key=recipient_key, cfg=cfg, budget=budget)
        if not waits:
            if not retrying:
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

    def admit(self, *, account_key: str, pacing: Any, klass: str, now: dt.datetime) -> Decision:
        """The same budget as `check`, for a sender that is not a queued message (a reservation): no age clock, no counter."""
        cfg = self.config()
        now = now.astimezone(UTC)
        budget = cfg.budget()
        if budget is None:
            return Decision(True, now)
        waits = self._waits(account_key=account_key, pacing=pacing, klass=klass, now=now, recipient_key=None, cfg=cfg, budget=budget)
        if not waits:
            return Decision(True, now)
        until, reason = max(waits)
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

    def note_slowdown(self, *, account_key: str, klass: str, scope: str, retry_after_s: int | None, now: dt.datetime) -> dt.datetime | None:
        """The provider slowed a sender down (reported by WisKey on a release). Account scope starts/extends the account backoff, using the
        provider's `retry_after_s` when given (capped at the ladder ceiling); pair scope is only counted (WisKey names no recipient Arx can key)."""
        now = now.astimezone(UTC)
        if scope == "pair":
            self.store.bump(account_key, klass, "pair_backoff", now)
            return None
        return self._step(f"account:{account_key}", ACCOUNT_BACKOFF_S, now, account_key, klass, "backoff", delay_s=retry_after_s)

    def _step(self, scope: str, steps: tuple[int, int], now: dt.datetime, account_key: str, klass: str, metric: str, delay_s: int | None = None) -> dt.datetime:
        old = self.store.get_state(scope)
        level = (old[0] + 1) if old is not None else 1
        delay = min(delay_s, steps[1]) if delay_s else min(steps[0] * 2 ** (level - 1), steps[1])
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


# ---------------------------------------------------------------- the reservation port (WisKey's own sends share the budget)

# accepted_by_provider: counted (sent). not_sent: WisKey PROVES nothing reached the provider - the slot is handed back. unknown: dispatched, not
# proven either way - counted, never credited. expired: the lease ran out BEFORE any dispatch - handed back like not_sent. A lease that simply
# expires with no release is never an automatic credit.
RELEASE_OUTCOMES = ("accepted_by_provider", "not_sent", "unknown", "expired")
CREDITED_OUTCOMES = ("not_sent", "expired")
SLOWDOWN_SCOPES = ("account", "pair")


class WaReservations:
    """`POST reserve` / `POST release` as a service: WisKey asks for one send of its own on a sender and Arx answers granted (with a
    short lease) or denied (with `retry_after_s`). Admission and the lease row happen in ONE call on the caller's write connection, so
    two senders cannot both take the last slot. Idempotent by `request_id`; a lease expires after `lease_ttl_s` (an unreleased lease
    stays counted - the send may have left); `release` with `not_sent` hands the slot back, a rate outcome also starts the account's
    backoff. FAIL-OPEN CHOICE (documented, WisKey's side): when Arx cannot be reached WisKey sends under its own conservative local cap
    and reports those sends through its counters; Arx never blocks a physical alert because the port is down."""

    def __init__(self, pacer: WaPacer, pacing_for: Callable[[str], Any]) -> None:
        self.pacer, self.store, self._pacing_for = pacer, pacer.store, pacing_for

    def reserve(self, *, sender_ref: str, klass: str, request_id: str, now: dt.datetime) -> dict[str, Any]:
        now = now.astimezone(UTC)
        cfg = self.pacer.config()
        if klass not in CLASSES:
            return {"granted": False, "reason": "class_unknown", "retry_after_s": None}
        account_key = next((k for k, v in cfg.senders.items() if v == sender_ref), None)
        if account_key is None:
            return {"granted": False, "reason": "sender_unknown", "retry_after_s": None}
        old = self.store.lease_get(request_id)
        if old is not None:
            if old.state == "granted" and old.expires_at > now:
                return self._granted(old, repeated=True)
            return {"granted": False, "reason": "already_released" if old.state == "released" else "lease_expired", "retry_after_s": None}
        d = self.pacer.admit(account_key=account_key, pacing=self._pacing_for(account_key), klass=klass, now=now)
        if not d.allowed:
            self.store.bump(account_key, klass, "lease_denied", now)
            return {"granted": False, "reason": d.reason, "retry_after_s": max(1, math.ceil((d.not_before - now).total_seconds()))}
        lease = Lease(request_id, account_key, klass, sender_ref, now, now + dt.timedelta(seconds=cfg.lease_ttl_s))
        self.store.lease_put(lease)
        self.store.bump(account_key, klass, "lease_granted", now)
        return self._granted(lease, repeated=False)

    @staticmethod
    def _granted(lease: Lease, *, repeated: bool) -> dict[str, Any]:
        return {"granted": True, "repeated": repeated, "lease": {"request_id": lease.request_id, "expires_at": _iso(lease.expires_at)}}

    def release(self, *, request_id: str, outcome: str, now: dt.datetime, slowdown: Mapping[str, Any] | None = None) -> dict[str, Any]:
        """Settle a lease. Idempotent by `request_id`: the first outcome stands (`conflict` says a later repeat named another one). A
        late release (after `expires_at`) settles the same way - proof is proof - and is flagged `late`. `slowdown` ({scope, retry_after_s})
        reports a provider slow-down that made the send fail; it never changes the outcome."""
        now = now.astimezone(UTC)
        if outcome not in RELEASE_OUTCOMES:
            return {"released": False, "reason": "outcome_unknown"}
        if slowdown is not None and slowdown.get("scope") not in SLOWDOWN_SCOPES:
            return {"released": False, "reason": "slowdown_invalid"}
        lease = self.store.lease_get(request_id)
        if lease is None:
            return {"released": False, "reason": "unknown_request"}
        if lease.state == "released":
            return {"released": True, "repeated": True, "outcome": lease.outcome, "conflict": lease.outcome != outcome}
        self.store.lease_put(replace(lease, state="released", outcome=outcome, counted=outcome not in CREDITED_OUTCOMES))
        if outcome == "accepted_by_provider":
            self.store.bump(lease.account_key, lease.klass, "sent", now)
        if slowdown is not None:
            retry = slowdown.get("retry_after_s")
            self.pacer.note_slowdown(account_key=lease.account_key, klass=lease.klass, scope=str(slowdown["scope"]),
                                     retry_after_s=retry if isinstance(retry, int) and not isinstance(retry, bool) and retry > 0 else None, now=now)
        return {"released": True, "repeated": False, "outcome": outcome, "late": lease.expires_at <= now, "conflict": False}

    def status(self, *, request_id: str, now: dt.datetime) -> dict[str, Any]:
        """Reconciliation by `request_id`: what Arx holds for one lease. `state`: granted (live) | expired (no release yet; still counted) |
        released. Unknown ids answer `found: false`."""
        now = now.astimezone(UTC)
        lease = self.store.lease_get(request_id)
        if lease is None:
            return {"found": False}
        state = lease.state if lease.state == "released" else ("expired" if lease.expires_at <= now else "granted")
        return {"found": True, "state": state, "outcome": lease.outcome, "counted": lease.counted, "class": lease.klass,
                "granted_at": _iso(lease.granted_at), "expires_at": _iso(lease.expires_at)}


# ---------------------------------------------------------------- the visible counters

def snapshot(conn: sqlite3.Connection, pacer: WaPacer, accounts: Iterable[str], now: dt.datetime) -> dict[str, Any]:
    """The administrator's view (`GET /messaging/whatsapp/pacing`): per account the sends of the last hour and day (Arx's own, and
    WisKey's as far as known), the queue that waits on the budget (count, oldest age), the counters of the last 24 hours by metric, and
    the backoff in force. WisKey's own counters that are missing are reported `unknown`, never as zero. Never a number, a text or a
    recipient. `shared_budget_guaranteed` stays false until WisKey reserves through the port for every shared sender."""
    now = now.astimezone(UTC)
    cfg = pacer.config()
    since_h, since_d = now - dt.timedelta(hours=1), now - dt.timedelta(days=1)
    out: list[dict[str, Any]] = []
    for key in accounts:
        arx = pacer.ledger.times(since=since_d, account_key=key)
        view = pacer.wiskey_view(key, now, cfg)
        known = view["times"]
        waits = conn.execute(
            "SELECT w.klass, w.since FROM wa_pacing_wait w JOIN ticket_outbox o ON o.id = w.ref "
            "WHERE w.account_key = ? AND o.state IN ('queued', 'held')", (key,)).fetchall()
        by_class: dict[str, int] = defaultdict(int)
        oldest = None
        for klass, since in waits:
            by_class[klass] += 1
            sd = _parse(since)
            oldest = sd if oldest is None or sd < oldest else oldest
        metrics = {m: 0 for m in METRICS}
        for metric, n in conn.execute("SELECT metric, SUM(n) FROM wa_pacing_counter WHERE account_key = ? AND hour >= ? GROUP BY metric",
                                      (key, _hour(since_d))).fetchall():
            if metric in metrics:
                metrics[metric] = int(n or 0)
        st = conn.execute("SELECT level, until FROM wa_pacing_state WHERE scope = ?", (f"account:{key}",)).fetchone()
        backoff = {"level": int(st[0]), "until": _parse(st[1]).isoformat().replace("+00:00", "Z")} if st and _parse(st[1]) > now else None
        pairs = conn.execute("SELECT COUNT(*) FROM wa_pacing_state WHERE scope LIKE ? AND until > ?", (f"pair:{key}:%", _iso(now))).fetchone()[0]
        charged = view["charged"]
        out.append({"account_key": key, "sends_1h": sum(1 for t in arx if t > since_h), "sends_24h": len(arx),
                    "wiskey_1h": sum(1 for t in known if t > since_h), "wiskey_24h": len(known),
                    "wiskey": {"mapped": view["mapped"], "verified": view["verified"], "unknown": view["unknown"],
                               "charged": charged, "superseded_by_leases": view["superseded_by_leases"],
                               "throttled_until": view["throttled_until"].isoformat().replace("+00:00", "Z") if view["throttled_until"] else None,
                               "leases_active": pacer.store.lease_active(key, now)},
                    "waiting": sum(by_class.values()), "waiting_by_class": dict(by_class),
                    "oldest_wait_s": int((now - oldest).total_seconds()) if oldest else None,
                    "counters_24h": metrics, "backoff": backoff, "pairs_in_backoff": int(pairs)})
    budget = cfg.budget()
    return {"mode": cfg.mode, "wiskey_shared": cfg.wiskey_shared, "max_wait_min": {k: int(cfg.max_wait_min.get(k, DEFAULT_MAX_WAIT_MIN[k])) for k in CLASSES},
            "budget": {"per_minute": budget.per_minute, "burst": budget.burst, "burst_window_s": budget.burst_window_s} if budget else None,
            "per_minute": cfg.per_minute, "burst": cfg.burst, "lease_ttl_s": cfg.lease_ttl_s, "senders": dict(cfg.senders),
            "share_pct": dict(SHARE_PCT), "shared_budget_guaranteed": False, "accounts": out}
