"""CR-039 slice W0: helper assertions every door-windows / emergency test can call (spec SR-3, SR-4, E-1, T13, 12).

- `assert_failed_close_reported(log, reports, within_s)`: "a failed close never leaves an open outcome unreported" - every
  close-direction command the caller did not see succeed must, unless a later close succeeded within `within_s`, be covered
  by a `relock_unconfirmed` state for that door - already standing when it failed, or reported within `within_s` after it
  (reports are state changes, so one standing alarm covers every later failed retry); and a `closed_confirmed` report is
  false when the last
  close before it failed and no close succeeded since (a manual check - `resolution: manual_checked` - is the one legitimate
  way to confirm without the engine, SR-4).
- `assert_no_silent_open(bank, states, expected_open)`: with the hidden truth - every door that is physically open and not
  legitimately open (an active occurrence, an incident) must currently be shown `relock_unconfirmed` (or another state the
  caller names as loud).
- `assert_unknown_open_not_retried(log)`: "an unknown outcome is never retried as open" - after an open-direction command
  with an unknown outcome, no further open-direction command for the same door in the same scope key (window token,
  occurrence, compiled program sha, incident). The single exception E-1: `emergency_open` inside an incident, at most 3
  attempts, at least 10 s apart (8.4).
- `assert_close_retries_bounded(instants, start, max_retries, backoff)`: the 4.4 close-direction retry schedule (30 / 60 /
  120 s, at most 3).
- `assert_no_secrets(*sources, secrets=...)`: "no key / token / phone in logs" - strings, log records (pytest `caplog`),
  dicts / lists (audit rows, notification bodies, API answers), `CommandRecord`s; flags the explicit secret values given
  (a rule token, the bridge test secret), JWT-shaped tokens, `Bearer ...`, private keys, phone numbers, and dict / JSON keys
  that carry a credential (`token`, `access_token`, `secret`, `password`, `pin`, `card_no`, `phone`, `signed_message_json`,
  ...) with a non-empty, non-masked value. The failure message names the kind and where - never the secret itself.

Inputs are plain: a log is any iterable of `CommandRecord` or dicts with `at`, `station`, `door`, `command`, `direction`,
`outcome`, `key` (the fakes' `device_log` / `requests` qualify); a report is a dict with `door` ((station, index) or
`station` + `physical_index`), `state`, `at` (ISO text or datetime) and optionally `resolution`.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import re
from typing import Any, Iterable, Mapping

from fake_doorwin_door import CONFIRMED_STATES, UNCONFIRMED_STATES, CommandRecord, DoorKey, FakeDoorBank, direction_of

EMERGENCY_RETRY_COMMANDS = frozenset({"emergency_open"})
E1_MAX_ATTEMPTS = 3
E1_MIN_SPACING_S = 10.0
SENSITIVE_KEYS = frozenset({"token", "access_token", "refresh_token", "secret", "client_secret", "password", "passphrase", "pin", "new_pin", "old_pin",
                            "card_no", "card_number", "phone", "phone_number", "signed_message_json", "api_key", "authorization", "pairing_secret"})
MASK = re.compile(r"^[\s*•x#-]*$|^•+")
PATTERNS = (
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")),
    ("bearer", re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{8,}", re.I)),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("phone", re.compile(r"(?<![\w.:-])(?:\+\d{1,3}[\s-]?)?0?5\d[\s-]?\d{3}[\s-]?\d{4}(?![\w:-])")),
    ("phone_e164", re.compile(r"(?<![\w.:-])\+\d{9,15}(?![\w:-])")),
)
_KEY_IN_TEXT = re.compile(r"[\"']?(" + "|".join(sorted(SENSITIVE_KEYS, key=len, reverse=True)) + r")[\"']?\s*[:=]\s*[\"']?([^\"',}\s]+)", re.I)


class DoorwinAssertionError(AssertionError):
    pass


# ---------------------------------------------------------------- normalising inputs
def _when(value: Any) -> dt.datetime:
    if isinstance(value, dt.datetime):
        return value
    return dt.datetime.fromisoformat(str(value))


def _rec(r: CommandRecord | Mapping[str, Any]) -> dict[str, Any]:
    d = r.as_dict() if isinstance(r, CommandRecord) else dict(r)
    d.setdefault("direction", direction_of(str(d.get("command") or "")))
    d["_at"] = _when(d["at"])
    d["_door"] = (d.get("station"), d.get("door"))
    return d


def _report(r: Mapping[str, Any]) -> dict[str, Any]:
    d = dict(r)
    door = d.get("door")
    if not isinstance(door, tuple):
        door = (d.get("station") or d.get("config_entry_id"), d.get("physical_index") if d.get("physical_index") is not None else door)
    d["_door"] = door
    d["_at"] = _when(d["at"])
    return d


# ---------------------------------------------------------------- SR-4: a failed close is never silent
def assert_failed_close_reported(log: Iterable[Any], reports: Iterable[Mapping[str, Any]], *, within_s: float,
                                 manual_resolutions: frozenset[str] = frozenset({"manual_checked"})) -> None:
    records = sorted((_rec(r) for r in log), key=lambda d: d["_at"])
    reps = sorted((_report(r) for r in reports), key=lambda d: d["_at"])
    closes = [r for r in records if r["direction"] == "close"]
    problems = []
    for f in (c for c in closes if c["outcome"] != "ok"):
        door, t = f["_door"], f["_at"]
        limit = t + dt.timedelta(seconds=within_s)
        recovered = next((c for c in closes if c["_door"] == door and c["_at"] > t and c["outcome"] == "ok"), None)
        if recovered is not None and recovered["_at"] <= limit:
            continue
        mine = [r for r in reps if r["_door"] == door]
        in_force = [r for r in mine if r["_at"] <= t]  # the state shown when the close failed (a standing alarm counts)
        loud = (in_force and in_force[-1]["state"] in UNCONFIRMED_STATES) or any(
            r["state"] in UNCONFIRMED_STATES and t < r["_at"] <= limit for r in mine)
        if not loud:
            problems.append(f"door {door}: close {f.get('command')} at {f['at']} was {f['outcome']} and no relock_unconfirmed report followed within {within_s:g} s")
    for r in (r for r in reps if r["state"] in CONFIRMED_STATES and r.get("resolution") not in manual_resolutions):
        before = [c for c in closes if c["_door"] == r["_door"] and c["_at"] <= r["_at"]]
        if before and before[-1]["outcome"] != "ok":
            problems.append(f"door {r['_door']}: closed_confirmed at {r['at']} although the last close ({before[-1]['at']}) was {before[-1]['outcome']}")
    if problems:
        raise DoorwinAssertionError("a failed close was left unreported:\n" + "\n".join(problems))


def assert_no_silent_open(bank: FakeDoorBank, states: Mapping[DoorKey, str], expected_open: Iterable[DoorKey] = (),
                          loud_states: frozenset[str] = UNCONFIRMED_STATES) -> None:
    allowed = set(expected_open)
    silent = [k for k in bank.truth_open_doors() if k not in allowed and states.get(k) not in loud_states]
    if silent:
        raise DoorwinAssertionError("doors physically open with nothing loud on screen: " + ", ".join(f"{k} ({states.get(k)!r})" for k in sorted(silent)))


# ---------------------------------------------------------------- SR-3 / E-1: an unknown open is never repeated
def assert_unknown_open_not_retried(log: Iterable[Any], *, e1_max_attempts: int = E1_MAX_ATTEMPTS, e1_min_spacing_s: float = E1_MIN_SPACING_S) -> None:
    records = sorted((_rec(r) for r in log), key=lambda d: d["_at"])
    groups: dict[tuple[Any, Any], list[dict[str, Any]]] = {}
    for r in records:
        if r["direction"] == "open":
            groups.setdefault((r["_door"], r.get("key")), []).append(r)
    problems = []
    for (door, key), opens in groups.items():
        emergency = all(o.get("command") in EMERGENCY_RETRY_COMMANDS for o in opens)
        if emergency:
            if len(opens) > e1_max_attempts:
                problems.append(f"door {door}: {len(opens)} emergency open attempts in {key!r} (E-1 allows {e1_max_attempts})")
            for a, b in zip(opens, opens[1:]):
                if a["outcome"] == "ok":
                    problems.append(f"door {door}: emergency open repeated after an acknowledged attempt in {key!r}")
                if (b["_at"] - a["_at"]).total_seconds() < e1_min_spacing_s:
                    problems.append(f"door {door}: emergency open attempts {a['at']} and {b['at']} closer than {e1_min_spacing_s:g} s")
            continue
        seen_unknown = None
        for o in opens:
            if seen_unknown is not None:
                problems.append(f"door {door}: open {o.get('command')} at {o['at']} repeats an open whose outcome was unknown at {seen_unknown} (scope {key!r})")
            if o["outcome"] == "unknown" and seen_unknown is None:
                seen_unknown = o["at"]
    if problems:
        raise DoorwinAssertionError("an unknown open outcome was retried:\n" + "\n".join(problems))


def assert_close_retries_bounded(instants: Iterable[Any], start: Any, *, max_retries: int = 3, backoff: tuple[float, ...] = (30.0, 60.0, 120.0)) -> None:
    """4.4 step 3: at most `max_retries` close-direction retries after `start` (the moment the occurrence became
    unconfirmed), the n-th no earlier than the (n-1)-th + `backoff[n-1]`."""
    times = sorted(_when(i) for i in instants)
    if len(times) > max_retries:
        raise DoorwinAssertionError(f"{len(times)} close retries, at most {max_retries} allowed")
    previous = _when(start)
    for n, t in enumerate(times):
        gap = backoff[min(n, len(backoff) - 1)]
        if (t - previous).total_seconds() < gap:
            raise DoorwinAssertionError(f"retry {n + 1} after {(t - previous).total_seconds():g} s, the backoff asks for {gap:g} s")
        previous = t


# ---------------------------------------------------------------- T13: no key / token / phone anywhere
def _texts(source: Any, where: str) -> list[tuple[str, str]]:
    if source is None:
        return []
    if isinstance(source, CommandRecord):
        return _texts(source.as_dict(), where)
    if isinstance(source, logging.LogRecord):
        return [(f"{where}:{source.name}", source.getMessage())]
    if isinstance(source, bytes):
        return [(where, source.decode("utf-8", "replace"))]
    if isinstance(source, str):
        return [(where, source)]
    if isinstance(source, (dict, list, tuple, set)):
        return [(where, json.dumps(source, default=str, ensure_ascii=False, sort_keys=True))]
    return [(where, str(source))]


def _walk(obj: Any, path: str, out: list[str]) -> None:
    if isinstance(obj, CommandRecord):
        obj = obj.as_dict()
    if isinstance(obj, Mapping):
        for k, v in obj.items():
            here = f"{path}.{k}"
            if str(k).lower() in SENSITIVE_KEYS and v not in (None, "", [], {}) and not (isinstance(v, str) and MASK.match(v)) and not isinstance(v, bool):
                out.append(f"credential-bearing key {here!r}")
            _walk(v, here, out)
    elif isinstance(obj, (list, tuple, set)):
        for i, v in enumerate(obj):
            _walk(v, f"{path}[{i}]", out)


def find_secrets(*sources: Any, secrets: Iterable[str] = ()) -> list[str]:
    """The findings `assert_no_secrets` would raise (empty list = clean). Never contains a secret value."""
    explicit = [s for s in secrets if isinstance(s, str) and len(s) >= 4]
    findings: list[str] = []
    for i, src in enumerate(sources):
        where = f"source[{i}]"
        items = list(src) if isinstance(src, (list, tuple)) and src and all(isinstance(x, logging.LogRecord) for x in src) else [src]
        for item in items:
            if isinstance(item, (Mapping, list, tuple, CommandRecord)):
                _walk(item, where, findings)
            for loc, text in _texts(item, where):
                for n, s in enumerate(explicit):
                    if s in text:
                        findings.append(f"{loc}: explicit secret #{n + 1} appears")
                for kind, pattern in PATTERNS:
                    if pattern.search(text):
                        findings.append(f"{loc}: {kind}-shaped value")
                if isinstance(item, (str, bytes, logging.LogRecord)):
                    for m in _KEY_IN_TEXT.finditer(text):
                        if not MASK.match(m.group(2)) and m.group(2).lower() not in ("none", "null", "true", "false"):
                            findings.append(f"{loc}: credential-bearing key {m.group(1)!r} in text")
    return sorted(set(findings))


def assert_no_secrets(*sources: Any, secrets: Iterable[str] = ()) -> None:
    findings = find_secrets(*sources, secrets=secrets)
    if findings:
        raise DoorwinAssertionError("sensitive data found:\n" + "\n".join(findings))
