"""CR-038 9.9 (D9, D27): WhatsApp accounts and uses - installation-level, outside the tickets package, so other modules can later
send through a chosen account with the same pacing. Tickets is the first client. Nothing here writes to `ha-whatsapp` or HA.

- **Accounts** (9.9.1): `discovered` (`entry:<config_entry_id>`, read from the existing entity mirror: `ha_entities` rows with
  `platform = 'whatsapp'` grouped by `config_entry_id` - no new HA call) or `manual` (`manual:<id>`, a typed `account` value for
  an `ha-whatsapp` version whose entities are missing). The mapping document `messaging.whatsapp` (a settings key, revision
  checked, in `backup.SETTINGS_KEEP`, never in `GET /settings`) holds labels, pacing and the use mapping.
- **Uses** (9.9.2) are declared in code (`UseSpec`); `resolve()` gives the account of a use, with the per-department override
  and the `tickets.codes` -> `tickets.messages` (installation value) inheritance.
- **State** per account: the connectivity binary sensor of the entry (`<entry_id>_connection`, `[WA-SRC]`, UNVERIFIED on the
  owner's installed version), else the manual status entity, else derived from sends (two consecutive "account / service / HA"
  not_sent -> disconnected, a sent -> connected).
- **Pacing** (9.2) is per ACCOUNT, counted in the shared send ledger (`messaging_send_ledger`, migration 0082 of slice 5a): rows
  `sent` and `unknown` count (an unknown may have left). Two uses (or two modules) on one number share one budget.

Numbers: the account label keeps only the last four digits; a manual value (which may be a number) is hidden from repr and is
never put into audit (audit carries account KEYS only) or logs.
"""
from __future__ import annotations

import datetime as dt
import json
import random
import re
import sqlite3
from dataclasses import dataclass, field, replace
from typing import Any, Callable, Iterable, Mapping, Protocol

from .tickets.channel import (CONNECTED, DISCONNECTED, MISSING, NOT_SENT, SENT, STATE_UNKNOWN, AccountRef, SendResult,
                              one_line, phone_digits)

UTC = dt.timezone.utc
PLATFORM = "whatsapp"  # [WA-SRC] integration domain = entity platform; UNVERIFIED on the installed version
SETTING_KEY = "messaging.whatsapp"
KEY_RE = re.compile(r"^(entry:[A-Za-z0-9_\-]{1,64}|manual:[a-z0-9]{4,16})$")
MANUAL_VALUE_RE = re.compile(r"^[A-Za-z0-9_\-.:@+]{1,64}$")
DEPT_SEP = "@dept:"
LABEL_MAX = 40

LEDGER_KINDS = ("message", "code", "test")
CODE_RECIPIENT_HOUR = 6  # 10.5: at most 6 codes per hour to one recipient across links (and accounts)
TEST_ACCOUNT_HOUR = 5  # 9.3: test sends per hour per account (owner 2026-10-14: 5)
LEDGER_KEEP = dt.timedelta(days=2)  # 15.1: the longest pacing window is one day

# disconnect detection for an account without a status entity: these not_sent codes mean "this account cannot send"
_DOWN_CODES = frozenset({"service_not_found", "account_not_found", "ha_unavailable", "ha_forbidden", "ha_not_configured"})


# ---------------------------------------------------------------- pacing and accounts

@dataclass(frozen=True)
class Pacing:
    """9.2 defaults for a personal-number Baileys session (`[WA-DOC]` gives no numbers)."""

    min_gap_s: int = 15
    jitter_s: int = 10
    per_hour: int = 30
    per_day: int = 150
    per_recipient_hour: int = 4  # codes excluded (review C9 / T5b)
    hold_when_down_min: int = 15


PACING_RANGES = {"min_gap_s": (5, 600), "jitter_s": (0, 300), "per_hour": (1, 200), "per_day": (1, 1000),
                 "per_recipient_hour": (1, 30), "hold_when_down_min": (1, 240)}


@dataclass(frozen=True)
class Account:
    key: str
    kind: str  # discovered | manual
    label: str = ""
    last4: str | None = None
    value: str | None = field(default=None, repr=False)  # manual only: the typed `account` value
    status_entity_id: str | None = None  # manual only
    connected_states: tuple[str, ...] = ("on", "connected", "online")
    shared_outside: bool = False
    pacing: Pacing = Pacing()
    removed: bool = False

    @property
    def account_value(self) -> str | None:
        """What goes into the service call's `account` field: the entry id (stable, never ambiguous) or the typed value."""
        if self.kind == "discovered":
            return self.key.split(":", 1)[1]
        return self.value


@dataclass(frozen=True)
class MappingDoc:
    revision: int = 0
    accounts: tuple[Account, ...] = ()
    uses: Mapping[str, str | None] = field(default_factory=dict)

    def account(self, key: str | None) -> Account | None:
        return next((a for a in self.accounts if a.key == key), None) if key else None


def _int_in(value: Any, lo: int, hi: int) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and lo <= value <= hi else None


def _pacing(raw: Any, problems: list[dict[str, str]] | None = None, path: str = "") -> Pacing:
    base = Pacing()
    if not isinstance(raw, Mapping):
        return base
    values = {}
    for name, (lo, hi) in PACING_RANGES.items():
        if name not in raw:
            continue
        v = _int_in(raw[name], lo, hi)
        if v is None:
            if problems is not None:
                problems.append({"code": "pacing_out_of_range", "field": f"{path}pacing.{name}"})
            continue
        values[name] = v
    pacing = replace(base, **values)
    if pacing.per_day < pacing.per_hour:
        if problems is not None:
            problems.append({"code": "pacing_day_below_hour", "field": f"{path}pacing.per_day"})
        pacing = replace(pacing, per_day=pacing.per_hour)
    return pacing


def _account(raw: Any, problems: list[dict[str, str]] | None = None, path: str = "") -> Account | None:
    def bad(code: str, fld: str) -> None:
        if problems is not None:
            problems.append({"code": code, "field": f"{path}{fld}"})

    if not isinstance(raw, Mapping):
        bad("account_invalid", "")
        return None
    key, kind = raw.get("key"), raw.get("kind")
    if not isinstance(key, str) or not KEY_RE.match(key):
        bad("account_key_invalid", "key")
        return None
    if kind not in ("discovered", "manual") or (kind == "discovered") != key.startswith("entry:"):
        bad("account_kind_invalid", "kind")
        return None
    label = one_line(raw.get("label"), LABEL_MAX)
    last4 = raw.get("last4") if isinstance(raw.get("last4"), str) and re.fullmatch(r"\d{4}", raw["last4"]) else None
    value = status_entity = None
    if kind == "manual":
        value = raw.get("account")
        if not isinstance(value, str) or not MANUAL_VALUE_RE.match(value):
            bad("manual_value_invalid", "account")
            return None
        se = raw.get("status_entity_id")
        status_entity = se if isinstance(se, str) and re.fullmatch(r"[a-z_]+\.[a-z0-9_]+", se) else None
    states = raw.get("connected_states")
    connected = tuple(s for s in states if isinstance(s, str))[:8] if isinstance(states, list) else Account.connected_states
    return Account(key=key, kind=kind, label=label, last4=last4, value=value, status_entity_id=status_entity,
                   connected_states=connected or Account.connected_states, shared_outside=raw.get("shared_outside") is True,
                   pacing=_pacing(raw.get("pacing"), problems, path), removed=raw.get("removed") is True)


def parse_doc(raw: Any) -> MappingDoc:
    """The stored document -> MappingDoc. A corrupt value reads as an EMPTY mapping (fail closed: nothing is sent on WhatsApp,
    rows are held `account_unmapped` and fall back) - the `access.messaging` precedent."""
    if isinstance(raw, (str, bytes)):
        try:
            raw = json.loads(raw)
        except ValueError:
            return MappingDoc()
    if not isinstance(raw, Mapping):
        return MappingDoc()
    accounts = []
    for item in raw.get("accounts") if isinstance(raw.get("accounts"), list) else []:
        acc = _account(item)
        if acc is not None and all(a.key != acc.key for a in accounts):
            accounts.append(acc)
    uses = {}
    for k, v in (raw.get("uses") if isinstance(raw.get("uses"), Mapping) else {}).items():
        if isinstance(k, str) and (v is None or (isinstance(v, str) and KEY_RE.match(v))):
            uses[k] = v
    revision = raw.get("revision") if isinstance(raw.get("revision"), int) else 0
    return MappingDoc(revision=revision, accounts=tuple(accounts), uses=uses)


def doc_to_json(doc: MappingDoc) -> dict[str, Any]:
    out = []
    for a in doc.accounts:
        item: dict[str, Any] = {"key": a.key, "kind": a.kind, "label": a.label, "last4": a.last4, "shared_outside": a.shared_outside,
                                "pacing": a.pacing.__dict__.copy(), "removed": a.removed}
        if a.kind == "manual":
            item.update({"account": a.value, "status_entity_id": a.status_entity_id, "connected_states": list(a.connected_states)})
        out.append(item)
    return {"revision": doc.revision, "accounts": out, "uses": dict(doc.uses)}


# ---------------------------------------------------------------- uses

@dataclass(frozen=True)
class UseSpec:
    key: str
    module: str
    label_he: str
    inherits: str | None = None  # null mapping = "same as" this use's INSTALLATION value
    per_department: bool = False
    required: bool = False
    active: Callable[[], bool] = lambda: True


def tickets_uses(module_on: Callable[[], bool]) -> tuple[UseSpec, ...]:
    """The two ticket uses (owner requirement 10). The labels are D33 templates (`{ticket}` / `{tickets}`, services/tickets/naming.py):
    the settings route renders them with the module's configured name - the default name is never written here."""
    return (
        UseSpec("tickets.messages", "tickets", "הודעות {tickets}", per_department=True, required=True, active=module_on),
        UseSpec("tickets.codes", "tickets", "קודי אימות ל{tickets}", inherits="tickets.messages", active=module_on),
    )


class UseRegistry:
    def __init__(self, specs: Iterable[UseSpec] = ()) -> None:
        self._specs: dict[str, UseSpec] = {}
        for s in specs:
            self.register(s)

    def register(self, spec: UseSpec) -> None:
        if spec.key in self._specs or DEPT_SEP in spec.key:
            raise ValueError("use key taken or malformed")
        if spec.inherits and spec.inherits not in self._specs:
            raise ValueError("a use inherits only from a use registered before it")
        self._specs[spec.key] = spec

    def get(self, key: str) -> UseSpec | None:
        return self._specs.get(key)

    def all(self) -> tuple[UseSpec, ...]:
        return tuple(self._specs.values())

    def mapping_key_ok(self, key: str) -> bool:
        base, sep, dept = key.partition(DEPT_SEP)
        spec = self._specs.get(base)
        if spec is None:
            return False
        return not sep or (spec.per_department and bool(re.fullmatch(r"[A-Za-z0-9_\-]{1,64}", dept)))


def resolve_key(doc: MappingDoc, registry: UseRegistry, use_key: str, *, department_id: str | None = None) -> str | None:
    """The account KEY of a use (9.9.2): per-department override (when the use allows it) -> the installation value -> for an
    inheriting use whose own value is null, the parent's INSTALLATION value (never its department override) -> None."""
    spec = registry.get(use_key)
    if spec is None:
        return None
    if spec.per_department and department_id:
        override = doc.uses.get(f"{use_key}{DEPT_SEP}{department_id}")
        if override:
            return override
    own = doc.uses.get(use_key)
    if own:
        return own
    if spec.inherits:
        return doc.uses.get(spec.inherits) or None
    return None


def keys_for_module(doc: MappingDoc, registry: UseRegistry, module: str) -> set[str]:
    out: set[str] = set()
    for spec in registry.all():
        if spec.module != module:
            continue
        key = resolve_key(doc, registry, spec.key)
        if key:
            out.add(key)
        if spec.per_department:
            prefix = f"{spec.key}{DEPT_SEP}"
            out.update(v for k, v in doc.uses.items() if k.startswith(prefix) and v)
    return out


# ---------------------------------------------------------------- the entity mirror (read-only)

@dataclass(frozen=True)
class MirrorRow:
    entity_id: str
    domain: str
    platform: str | None
    unique_id: str | None
    config_entry_id: str | None
    device_class: str | None = None
    state: str | None = None
    available: bool = True
    disabled: bool = False


class LinkedAccountsReader(Protocol):
    """What the account service reads from the entity mirror. The SQLite reader below is the real one; tests use a fake."""

    def whatsapp_rows(self) -> list[MirrorRow]: ...

    def entity_state(self, entity_id: str) -> str | None: ...

    def ws_connected(self) -> bool: ...


class SqliteMirrorReader:
    """Reads `ha_entities` (0004 + 0036 `config_entry_id`). UNVERIFIED on the owner's installation: that `ha-whatsapp` entities
    carry `platform = 'whatsapp'` and a `config_entry_id` (slice 5a's read-only live check)."""

    def __init__(self, conn: sqlite3.Connection, ws_connected: Callable[[], bool] = lambda: True) -> None:
        self._conn = conn
        self._ws = ws_connected

    def whatsapp_rows(self) -> list[MirrorRow]:
        rows = self._conn.execute(
            "SELECT entity_id, domain, platform, unique_id, config_entry_id, device_class, state, available, disabled"
            " FROM ha_entities WHERE platform = ? AND removed_at IS NULL", (PLATFORM,)).fetchall()
        return [MirrorRow(r[0], r[1], r[2], r[3], r[4], r[5], r[6], bool(r[7]), bool(r[8])) for r in rows]

    def entity_state(self, entity_id: str) -> str | None:
        row = self._conn.execute("SELECT state, available FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (entity_id,)).fetchone()
        if row is None:
            return None
        return row[0] if row[1] else "unavailable"

    def ws_connected(self) -> bool:
        return bool(self._ws())


@dataclass(frozen=True)
class Discovered:
    key: str
    entry_id: str
    connection_entity_id: str | None
    connection_state: str | None
    entity_ids: tuple[str, ...]


def discover(rows: Iterable[MirrorRow]) -> dict[str, Discovered]:
    """Group the mirror's `whatsapp` entities by config entry. The connection entity is the binary sensor whose unique_id ends in
    `_connection` ([WA-SRC]), else a connectivity binary sensor; a disabled entity is never used for the state."""
    groups: dict[str, list[MirrorRow]] = {}
    for r in rows:
        if r.platform == PLATFORM and r.config_entry_id and re.fullmatch(r"[A-Za-z0-9_\-]{1,64}", r.config_entry_id):
            groups.setdefault(r.config_entry_id, []).append(r)
    out = {}
    for entry_id, members in sorted(groups.items()):
        live = [m for m in members if m.domain == "binary_sensor" and not m.disabled]
        conn = next((m for m in live if (m.unique_id or "").endswith("_connection")), None) or \
            next((m for m in live if m.device_class == "connectivity"), None)
        state = None if conn is None else (conn.state if conn.available else "unavailable")
        out[f"entry:{entry_id}"] = Discovered(f"entry:{entry_id}", entry_id, conn.entity_id if conn else None, state,
                                              tuple(sorted(m.entity_id for m in members)))
    return out


def last4_of(raw_phone: Any) -> str | None:
    digits = phone_digits(raw_phone) if isinstance(raw_phone, str) else None
    return digits[-4:] if digits else None


def suggest_label(entry_id: str, phone_attr: Any) -> str:
    """9.9.1: "וואטסאפ ····<last 4>" from the connection entity's `phone_number` attribute (read on demand, never stored whole);
    "וואטסאפ <first 6 of the entry id>" when it is absent or masked."""
    last4 = last4_of(phone_attr)
    return f"וואטסאפ ····{last4}" if last4 else f"וואטסאפ {entry_id[:6]}"


def read_last4(get_state: Callable[[str], Mapping[str, Any] | None], entity_id: str) -> str | None:
    """On-demand label read (the account settings screen only): `get_state` is `ha_client.get_state` bound to settings. Only the
    last four digits leave this function; nothing is logged."""
    try:
        state = get_state(entity_id)
    except Exception:  # noqa: BLE001 - a label read never fails the screen
        return None
    attrs = state.get("attributes") if isinstance(state, Mapping) else None
    return last4_of(attrs.get("phone_number")) if isinstance(attrs, Mapping) else None


# ---------------------------------------------------------------- state

@dataclass(frozen=True)
class AccountStatus:
    state: str  # connected | disconnected | unknown | missing
    source: str  # entity | status_entity | sends | registry

    @property
    def sendable(self) -> bool:
        """The worker calls an account only when it is connected - or when its state can only be learnt from sends (no status
        entity) and it has not failed yet."""
        return self.state == CONNECTED or (self.state == STATE_UNKNOWN and self.source == "sends")


class SendStateTracker:
    """Per-account state learnt from sends (accounts without a status entity), plus the `missing` mark an `account_not_found`
    answer sets until the next mirror refresh (9.4). In memory: a restart starts from `unknown`."""

    def __init__(self) -> None:
        self._fails: dict[str, int] = {}
        self._state: dict[str, str] = {}
        self._missing: set[str] = set()

    def note(self, key: str, result: SendResult) -> None:
        if result.outcome == SENT:
            self._fails[key] = 0
            self._state[key] = CONNECTED
            self._missing.discard(key)
        elif result.outcome == NOT_SENT and result.outcome_code in _DOWN_CODES:
            self._fails[key] = self._fails.get(key, 0) + 1
            if self._fails[key] >= 2:
                self._state[key] = DISCONNECTED
            if result.outcome_code == "account_not_found":
                self._missing.add(key)

    def derived(self, key: str) -> str:
        return self._state.get(key, STATE_UNKNOWN)

    def is_marked_missing(self, key: str) -> bool:
        return key in self._missing

    def refresh(self) -> None:
        self._missing.clear()


def account_status(key: str, doc: MappingDoc, discovered: Mapping[str, Discovered], reader: LinkedAccountsReader,
                   tracker: SendStateTracker) -> AccountStatus:
    account = doc.account(key)
    if account is not None and account.removed:
        return AccountStatus(MISSING, "registry")
    if tracker.is_marked_missing(key):
        return AccountStatus(MISSING, "registry")
    if key.startswith("entry:"):
        found = discovered.get(key)
        if found is None:
            return AccountStatus(MISSING, "registry")
        if not reader.ws_connected():
            return AccountStatus(STATE_UNKNOWN, "entity")
        if found.connection_entity_id is None:
            return AccountStatus(tracker.derived(key), "sends")
        return AccountStatus({"on": CONNECTED, "off": DISCONNECTED}.get(found.connection_state or "", STATE_UNKNOWN), "entity")
    if account is None:
        return AccountStatus(MISSING, "registry")
    if account.status_entity_id:
        if not reader.ws_connected():
            return AccountStatus(STATE_UNKNOWN, "status_entity")
        state = reader.entity_state(account.status_entity_id)
        if state is None or state in ("unavailable", "unknown"):
            return AccountStatus(STATE_UNKNOWN, "status_entity")
        return AccountStatus(CONNECTED if state in account.connected_states else DISCONNECTED, "status_entity")
    return AccountStatus(tracker.derived(key), "sends")


DOWN_STATES = frozenset({DISCONNECTED, MISSING})


def state_transitions(before: Mapping[str, AccountStatus], after: Mapping[str, AccountStatus], mapped: Iterable[str]) -> dict[str, list[str]]:
    """For the CR-018 signal `ticket.channel_down` (dedupe `ticket-channel:<account_key>`, slice 6): mapped accounts that turned
    disconnected / missing since the last look (`down`), and those that came back connected (`up`, resolves the signal)."""
    keys = sorted(set(mapped))
    down = [k for k in keys if k in after and after[k].state in DOWN_STATES and (k not in before or before[k].state not in DOWN_STATES)]
    up = [k for k in keys if k in before and before[k].state in DOWN_STATES and k in after and after[k].state == CONNECTED]
    return {"down": down, "up": up}

# ---------------------------------------------------------------- validation of a PUT, warnings

def manual_value_problems(value: str, discovered: Mapping[str, Discovered], doc: MappingDoc) -> tuple[list[str], list[str]]:
    """(refusals, warnings) for a manual account value (9.9.2): equal to a discovered entry id -> refused; same last four digits
    as a discovered account's `last4` -> warning "ייתכן שזה אותו מספר" (a heuristic)."""
    refusals, warns = [], []
    if any(d.entry_id == value for d in discovered.values()):
        refusals.append("manual_equals_discovered")
    l4 = last4_of(value)
    if l4 and any(a.last4 == l4 for a in doc.accounts if a.kind == "discovered" and not a.removed):
        warns.append("maybe_same_number")
    return refusals, warns


def validate_doc(data: Any, *, current: MappingDoc, registry: UseRegistry, discovered: Mapping[str, Discovered]) -> tuple[MappingDoc, list[dict[str, str]]]:
    """A PUT of the mapping document -> (new doc with revision + 1, problems). Problems: settings_stale, account_*,
    manual_value_invalid, manual_equals_discovered, pacing_*, use_unknown, use_account_unknown, use_account_removed,
    account_in_use_removed."""
    problems: list[dict[str, str]] = []
    if not isinstance(data, Mapping):
        return current, [{"code": "document_invalid", "field": ""}]
    if data.get("revision") != current.revision:
        return current, [{"code": "settings_stale", "field": "revision"}]
    accounts: list[Account] = []
    for i, item in enumerate(data.get("accounts") if isinstance(data.get("accounts"), list) else []):
        acc = _account(item, problems, f"accounts[{i}].")
        if acc is None:
            continue
        if any(a.key == acc.key for a in accounts):
            problems.append({"code": "account_duplicate", "field": f"accounts[{i}].key"})
            continue
        if acc.kind == "manual":
            refusals, _ = manual_value_problems(acc.value or "", discovered, current)
            problems.extend({"code": r, "field": f"accounts[{i}].account"} for r in refusals)
        accounts.append(acc)
    by_key = {a.key: a for a in accounts}
    uses: dict[str, str | None] = {}
    for k, v in (data.get("uses") if isinstance(data.get("uses"), Mapping) else {}).items():
        if not isinstance(k, str) or not registry.mapping_key_ok(k):
            problems.append({"code": "use_unknown", "field": f"uses.{k}"})
            continue
        if v is None:
            uses[k] = None
            continue
        if not isinstance(v, str) or v not in by_key and v not in discovered:
            problems.append({"code": "use_account_unknown", "field": f"uses.{k}"})
            continue
        if v in by_key and by_key[v].removed:
            problems.append({"code": "use_account_removed", "field": f"uses.{k}"})
            continue
        uses[k] = v
    return MappingDoc(revision=current.revision + 1, accounts=tuple(accounts), uses=uses), problems


def changed_uses(before: MappingDoc, after: MappingDoc) -> list[dict[str, Any]]:
    """For the audit row `messaging.accounts.update`: use keys and account KEYS before / after - never numbers or labels."""
    keys = sorted(set(before.uses) | set(after.uses))
    return [{"use": k, "before": before.uses.get(k), "after": after.uses.get(k)} for k in keys if before.uses.get(k) != after.uses.get(k)]


def warnings(doc: MappingDoc, registry: UseRegistry, statuses: Mapping[str, AccountStatus],
             department_ids: Iterable[str] = ()) -> list[dict[str, Any]]:
    """9.9.3 warnings (settings screens only, never operator screens). Codes: shared_module (amber), shared_outside (amber),
    account_down (red: disconnected / missing; grey: unknown), required_unmapped (red)."""
    out: list[dict[str, Any]] = []
    depts = list(department_ids)
    mapped: dict[str, set[str]] = {}  # account key -> modules using it
    use_accounts: list[tuple[UseSpec, str | None, str | None]] = []
    for spec in registry.all():
        if not spec.active():
            continue
        key = resolve_key(doc, registry, spec.key)
        use_accounts.append((spec, None, key))
        if spec.per_department:
            for d in depts:
                dk = resolve_key(doc, registry, spec.key, department_id=d)
                if dk != key:
                    use_accounts.append((spec, d, dk))
    for spec, _, key in use_accounts:
        if key:
            mapped.setdefault(key, set()).add(spec.module)
    seen: set[tuple[str, ...]] = set()

    def add(item: dict[str, Any]) -> None:
        sig = tuple(str(item.get(k)) for k in ("code", "use", "department_id", "account_key", "module"))
        if sig not in seen:
            seen.add(sig)
            out.append(item)

    for spec, dept, key in use_accounts:
        if key is None:
            if spec.required and dept is None:
                add({"code": "required_unmapped", "use": spec.key, "severity": "red"})
            continue
        for module in sorted(mapped.get(key, set()) - {spec.module}):
            add({"code": "shared_module", "use": spec.key, "department_id": dept, "account_key": key, "module": module, "severity": "amber"})
        account = doc.account(key)
        if account is not None and account.shared_outside:
            add({"code": "shared_outside", "use": spec.key, "department_id": dept, "account_key": key, "severity": "amber"})
        status = statuses.get(key)
        if status is not None and status.state != CONNECTED:
            add({"code": "account_down", "use": spec.key, "department_id": dept, "account_key": key, "state": status.state,
                 "severity": "grey" if status.state == STATE_UNKNOWN else "red"})
    return out


# ---------------------------------------------------------------- the shared send ledger

class SendLedger(Protocol):
    def record(self, *, account_key: str, use_key: str, recipient_key: str, kind: str, at: dt.datetime) -> None: ...

    def times(self, *, since: dt.datetime, account_key: str | None = None, recipient_key: str | None = None,
              kinds: Iterable[str] | None = None) -> list[dt.datetime]: ...

    def last_at(self, account_key: str) -> dt.datetime | None: ...

    def prune(self, before: dt.datetime) -> int: ...


def _iso(moment: dt.datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _parse(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


class MemorySendLedger:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str, str, dt.datetime]] = []

    def record(self, *, account_key: str, use_key: str, recipient_key: str, kind: str, at: dt.datetime) -> None:
        if kind not in LEDGER_KINDS:
            raise ValueError("ledger kind")
        self.rows.append((account_key, use_key, recipient_key, kind, at.astimezone(UTC)))

    def times(self, *, since: dt.datetime, account_key: str | None = None, recipient_key: str | None = None,
              kinds: Iterable[str] | None = None) -> list[dt.datetime]:
        ks = set(kinds) if kinds is not None else None
        return sorted(at for a, _, r, k, at in self.rows if at > since and (account_key is None or a == account_key)
                      and (recipient_key is None or r == recipient_key) and (ks is None or k in ks))

    def last_at(self, account_key: str) -> dt.datetime | None:
        return max((at for a, *_, at in self.rows if a == account_key), default=None)

    def prune(self, before: dt.datetime) -> int:
        keep = [r for r in self.rows if r[4] >= before]
        n = len(self.rows) - len(keep)
        self.rows = keep
        return n


def _ledger_ddl() -> str:
    """The table of migration 0082 (`*_messaging_accounts.sql`, slice 5a), read from the migration file itself so the SQLite ledger
    is written and tested against exactly what the database gets (found by name: a renumbering at integration keeps it working)."""
    from pathlib import Path

    found = sorted((Path(__file__).resolve().parent.parent / "migrations").glob("*_messaging_accounts.sql"))
    return found[-1].read_text(encoding="utf-8") if found else ""


LEDGER_DDL = _ledger_ddl()


class SqliteSendLedger:
    """`messaging_send_ledger` on the caller's connection and transaction (no COMMIT here - db.py owns transactions)."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def record(self, *, account_key: str, use_key: str, recipient_key: str, kind: str, at: dt.datetime) -> None:
        if kind not in LEDGER_KINDS:
            raise ValueError("ledger kind")
        self._conn.execute("INSERT INTO messaging_send_ledger(account_key, use_key, recipient_key, kind, at) VALUES (?, ?, ?, ?, ?)",
                           (account_key, use_key, recipient_key, kind, _iso(at)))

    def times(self, *, since: dt.datetime, account_key: str | None = None, recipient_key: str | None = None,
              kinds: Iterable[str] | None = None) -> list[dt.datetime]:
        sql, args = "SELECT at FROM messaging_send_ledger WHERE at > ?", [_iso(since)]
        if account_key is not None:
            sql += " AND account_key = ?"
            args.append(account_key)
        if recipient_key is not None:
            sql += " AND recipient_key = ?"
            args.append(recipient_key)
        if kinds is not None:
            ks = list(kinds)
            sql += f" AND kind IN ({','.join('?' * len(ks))})"
            args.extend(ks)
        return [_parse(r[0]) for r in self._conn.execute(sql + " ORDER BY at", args)]

    def last_at(self, account_key: str) -> dt.datetime | None:
        row = self._conn.execute("SELECT MAX(at) FROM messaging_send_ledger WHERE account_key = ?", (account_key,)).fetchone()
        return _parse(row[0]) if row and row[0] else None

    def prune(self, before: dt.datetime) -> int:
        return self._conn.execute("DELETE FROM messaging_send_ledger WHERE at < ?", (_iso(before),)).rowcount


@dataclass(frozen=True)
class PacingDecision:
    allowed: bool
    not_before: dt.datetime
    reason: str | None = None  # gap | hour | day | recipient | code_recipient | test_hour


class PacingGate:
    """9.2 pacing per account over the shared ledger. `check` is pure (no write); `record` adds the ledger row of a send that may
    have left (sent / unknown) and draws the jitter of the NEXT gap. Rolling windows (the last hour / the last 24 h)."""

    def __init__(self, ledger: SendLedger, rng: random.Random | None = None) -> None:
        self.ledger = ledger
        self._rng = rng or random.SystemRandom()
        self._jitter: dict[str, float] = {}

    def _jitter_for(self, account_key: str, pacing: Pacing) -> float:
        if account_key not in self._jitter:
            self._jitter[account_key] = self._rng.uniform(0, pacing.jitter_s) if pacing.jitter_s else 0.0
        return min(self._jitter[account_key], float(pacing.jitter_s))

    def check(self, *, account_key: str, pacing: Pacing, recipient_key: str, kind: str, now: dt.datetime) -> PacingDecision:
        now = now.astimezone(UTC)
        waits: list[tuple[dt.datetime, str]] = []
        last = self.ledger.last_at(account_key)
        if last is not None:
            ready = last + dt.timedelta(seconds=pacing.min_gap_s + self._jitter_for(account_key, pacing))
            if ready > now:
                waits.append((ready, "gap"))

        def cap(times: list[dt.datetime], limit: int, span: dt.timedelta, reason: str) -> None:
            if len(times) >= limit:
                waits.append((times[len(times) - limit] + span, reason))

        hour, day = dt.timedelta(hours=1), dt.timedelta(days=1)
        cap(self.ledger.times(since=now - hour, account_key=account_key), pacing.per_hour, hour, "hour")
        cap(self.ledger.times(since=now - day, account_key=account_key), pacing.per_day, day, "day")
        if kind == "message":
            cap(self.ledger.times(since=now - hour, account_key=account_key, recipient_key=recipient_key, kinds=("message",)),
                pacing.per_recipient_hour, hour, "recipient")
        elif kind == "code":
            cap(self.ledger.times(since=now - hour, recipient_key=recipient_key, kinds=("code",)), CODE_RECIPIENT_HOUR, hour, "code_recipient")
        elif kind == "test":
            cap(self.ledger.times(since=now - hour, account_key=account_key, kinds=("test",)), TEST_ACCOUNT_HOUR, hour, "test_hour")
        if not waits:
            return PacingDecision(True, now)
        until, reason = max(waits)
        return PacingDecision(False, until, reason)

    def record(self, *, account_key: str, use_key: str, recipient_key: str, kind: str, now: dt.datetime) -> None:
        self.ledger.record(account_key=account_key, use_key=use_key, recipient_key=recipient_key, kind=kind, at=now)
        self._jitter.pop(account_key, None)  # the next gap draws a fresh jitter


# ---------------------------------------------------------------- the service the outbox uses

class AccountsService:
    """What the outbox needs: resolve a use to an account at claim time, the account's state, its pacing, and learning from sends.
    `load_doc` reads the `messaging.whatsapp` setting (fresh on every call: a moved use applies to the next claim, D27)."""

    def __init__(self, *, load_doc: Callable[[], MappingDoc], reader: LinkedAccountsReader, registry: UseRegistry,
                 tracker: SendStateTracker | None = None) -> None:
        self._load = load_doc
        self.reader = reader
        self.registry = registry
        self.tracker = tracker or SendStateTracker()

    def doc(self) -> MappingDoc:
        return self._load()

    def discovered(self) -> dict[str, Discovered]:
        return discover(self.reader.whatsapp_rows())

    def resolve(self, use_key: str, department_id: str | None = None) -> AccountRef | None:
        doc = self._load()
        key = resolve_key(doc, self.registry, use_key, department_id=department_id)
        if key is None:
            return None
        account = doc.account(key)
        label = account.label if account is not None else ""
        if key.startswith("entry:"):
            value = key.split(":", 1)[1]
            return AccountRef(key=key, value=value, label=label or suggest_label(value, None))
        # a manual value may be a phone number: it never becomes a label
        return AccountRef(key=key, value=(account.value or "") if account is not None else "", label=label or "וואטסאפ (ידני)")

    def ref(self, key: str) -> AccountRef | None:
        """One named account (the per-account test send). None when the key is neither in the document nor discovered."""
        doc = self._load()
        account = doc.account(key)
        if key.startswith("entry:") and (account is not None or key in self.discovered()):
            value = key.split(":", 1)[1]
            return AccountRef(key=key, value=value, label=(account.label if account else "") or suggest_label(value, None))
        if account is not None and account.kind == "manual":
            return AccountRef(key=key, value=account.value or "", label=account.label or "וואטסאפ (ידני)")
        return None

    def all_keys(self) -> set[str]:
        """Every WhatsApp account this add-on can see: configured, discovered in the mirror, or named by a use (the tickets
        inbound filter's "is there more than one account at all" - deep review B6)."""
        doc = self._load()
        return {a.key for a in doc.accounts} | set(self.discovered()) | {v for v in doc.uses.values() if v}

    def mapped_keys(self, module: str) -> set[str]:
        """Every account a use of `module` resolves to now (installation values, department overrides, inherited values) - the
        inbound account filter's "mapped to a ticket use now" (9.6)."""
        return keys_for_module(self._load(), self.registry, module)

    def status(self, key: str) -> AccountStatus:
        return account_status(key, self._load(), self.discovered(), self.reader, self.tracker)

    def statuses(self) -> dict[str, AccountStatus]:
        doc, found = self._load(), self.discovered()
        keys = {a.key for a in doc.accounts} | set(found) | {v for v in doc.uses.values() if v}
        return {k: account_status(k, doc, found, self.reader, self.tracker) for k in sorted(keys)}

    def pacing(self, key: str) -> Pacing:
        account = self._load().account(key)
        return account.pacing if account is not None else Pacing()

    def note_result(self, key: str, result: SendResult) -> None:
        self.tracker.note(key, result)

    def refresh(self) -> None:
        """After a mirror refresh (`POST /messaging/whatsapp/refresh`): forget the `missing` marks of unknown-account answers."""
        self.tracker.refresh()
