"""WISKEY-INSTALLER-NATIVE-2400 (WisKey full integration plan of 2026-11-03, rows 47, 50, 51, 82; owner decision 03.11, Q7 "ג"):
the core of WisKey's installer tools in Arx - "התקנה ותחזוקת מערכת האינטרקום" under Settings. The tools themselves are in
`wiskey_installer_<phase>.py`; the HTTP side is routers/wiskey_installer*.py. This module holds what every tool shares:

- the operation table entry (`Op`): the WisKey command, read or write, how dangerous it is (`confirm` or `typed`), its timeout, its
  cool-down, the audit action, how its answer is projected (closed construction: only known keys, codes kept as codes, never free
  text from a device) and what the audit row records (`summary`: never a credential, a host or a person);
- the frame (`send`): `hikvision_intercom/<command>` with exactly the keys of WisKey's registration (rc.10 `websocket.py`
  COMMANDS, the pinned extract `docs/integrations/wiskey/catalog/rc10-extract/`) plus `api_contract` on every non-READ command
  (rc.10 `api_contract.validate_client`; only the `platform/*` reads WisKey lists in READ_COMMANDS go without it);
- the answer (`result_of`): `success: true` -> the result; `success: false` -> WisKey's code, which for a READ or for a write WisKey
  refuses before touching anything is a definite failure, while the codes that can come AFTER a store or a device was written
  (`UNCLEAR_WRITE_CODES`: a readback mismatch, an ambiguous device answer, a timeout ...) leave the outcome unknown;
- the run (`run_read` / `run_write`): over the add-on's own live WisKey session (intercom_sync), on the closed `installer` channel
  (services/wiskey_channels.py), sent ONCE, never queued, never retried; a write in its own lane name (`installer`: intercom_sync
  gives it a read slot and the read buckets - no edit of the shared feed module) with this module's own limits on top (`Limits`):
  one write at a time installation-wide, a per-operator window, a cool-down per operation and target, counted only after a send;
- the typed confirmation (`typed_phrase` / `typed_ok`): the dangerous writes (removing a station, a clock or network change on a
  station or the host, applying a fleet change, deleting, importing, revealing a key) are refused unless the caller typed the exact
  phrase the server named (a station's name, or the operation's own Hebrew word).

Nothing here is automatic: no write is ever sent without a request that carries `confirmed: true` (and the typed phrase where it is
required); no write is repeated. Tests drive it with tests/fake_wiskey.py; nothing contacts a device."""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable

from ..config import Settings
from ..errors import ApiError
from . import intercom_adapter as ad
from . import intercom_client, intercom_sync
from . import wiskey_write_limits as wl
from .intercom_client import IntercomError, UnclearAnswer

CHANNEL = "installer"  # services/wiskey_channels.py INSTALLER
LANE = "installer"  # intercom_sync: no lane of its own -> a read slot and the read buckets (module note)
READ_TIMEOUT_S = 25.0
WRITE_TIMEOUT_S = 58.0  # under ha_client's own 60 s call limit: WisKey's longest installer handler (clock/station_sync) caps itself at 50 s
DEVICE_TIMEOUT_S = 45.0  # a write that waits for one device (technical_update caps itself at 40 s)

# a `success: false` answer to a WRITE that says nothing certain about what happened: these can come after WisKey wrote its store or
# the device (client/ntp.py `readback_mismatch` / `ambiguous_write`, technical.py's readback, the HA call timing out ...)
UNCLEAR_WRITE_CODES = frozenset({
    "", "action_failed", "storage_or_internal_error", "invalid_response", "timeout", "unknown_error", "readback_mismatch", "ambiguous_write",
    "device_unavailable", "program_saved_draft_cleanup_unknown", "lifecycle_remove_failed", "storage_write_failed", "home_assistant_error",
})


@dataclass(frozen=True)
class Op:
    """One installer operation. `danger`: `none` (a read), `confirm` (a write: `confirmed: true` from the confirmation step) or `typed`
    (a dangerous write: `confirmed: true` AND the typed phrase). `fields`: the request keys besides `id` / `type` / `api_contract`, in
    WisKey's registration (the frame is built from exactly these). `read_command`: WisKey lists it in READ_COMMANDS (no `api_contract`)."""

    name: str
    command: str
    kind: str  # "read" | "write"
    audit: str
    fields: tuple[str, ...] = ()
    danger: str = "none"
    scope: str = "installation"  # "installation" | "station"
    timeout_s: float = READ_TIMEOUT_S
    cooldown_s: float = 0.0
    read_command: bool = False
    typed_word: str = ""  # the phrase of an installation-wide typed write (a station-scoped one types the station's name)
    project: Callable[[Any], Any] = field(default=lambda raw: raw)
    summary: Callable[[Any], dict[str, Any]] = field(default=lambda data: {})


# ---------------------------------------------------------------- the frame and its answer

def frame_fields(op: Op, values: dict[str, Any]) -> dict[str, Any]:
    """The frame's keys: exactly `op.fields` from `values` (a missing one is a programming error), plus `api_contract` unless WisKey
    lists the command as a READ."""
    missing = [k for k in op.fields if k not in values]
    if missing:
        raise ValueError(f"{op.command}: missing {missing}")
    body = {k: values[k] for k in op.fields}
    if not op.read_command:
        body["api_contract"] = intercom_client.API_CONTRACT
    return body


def result_of(frame: Any, op: Op) -> Any:
    if not isinstance(frame, dict):
        raise UnclearAnswer(op.command, "invalid_response")
    if frame.get("success") is True:
        return frame.get("result")
    if frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if op.kind == "read":
            raise IntercomError(code if ad.CODE.fullmatch(code or "-") else "other", op.command)
        if code not in UNCLEAR_WRITE_CODES and ad.CODE.fullmatch(code):
            raise IntercomError(code, op.command)
        raise UnclearAnswer(op.command, code or "action_failed")
    if op.kind == "read":
        raise IntercomError("invalid_response", op.command)
    raise UnclearAnswer(op.command, "invalid_response")


async def send(call: intercom_client.Call, op: Op, values: dict[str, Any]) -> Any:
    frame = await call(intercom_client.command_type(op.command), **frame_fields(op, values))
    return result_of(frame, op)


# ---------------------------------------------------------------- the runs

NOT_READY_STATES = frozenset({"ha_not_configured", "connecting", "ha_unavailable", "not_installed", "idle", "error"})


def run_read(settings: Settings, op: Op, values: dict[str, Any], who: str) -> dict[str, Any]:
    """One READ over the installer channel: `{data, fetched_at}`; anything else is an ApiError whose details carry the feed's `state`
    and WisKey's code (`wiskey_code`) - the screen says why, never shows stale or invented data."""
    reply = intercom_sync.SYNC.command(settings, "installer", lambda call: send(call, op, values), op.project, who=who, timeout=op.timeout_s, channel=CHANNEL)
    data = reply.get("installer")
    if reply.get("state") == "ready" and data is not None:
        return {"data": data, "fetched_at": reply.get("fetched_at")}
    state, code = str(reply.get("state") or "error"), str(reply.get("last_error") or "")
    details = {"state": state, "wiskey_code": code or None, "operation": op.name}
    if state in ("rate_limited",) or code in ("rate_limited", "busy"):
        raise ApiError(429, "installer_busy", "WisKey עסוק או שנשלחו יותר מדי בקשות. נסו שוב בעוד כמה שניות.", retryable=True, details=details)
    if state == "forbidden" or code == "unauthorized":
        raise ApiError(502, "installer_wiskey_forbidden", "WisKey דחה את הבקשה של Arx (אין הרשאה בצד של WisKey).", details=details)
    if state == "unsupported" or code in ("unknown_command", "not_listed"):
        raise ApiError(501, "installer_unsupported", "גרסת WisKey המותקנת אינה תומכת בכלי הזה.", details=details)
    if state in NOT_READY_STATES and state != "error":
        raise ApiError(503, "installer_unavailable", "החיבור ל־WisKey אינו זמין כרגע.", retryable=True, details=details)
    raise ApiError(502, "installer_read_failed", f"WisKey לא החזיר את הנתונים ({code or state}).", details=details)


def run_write(settings: Settings, op: Op, values: dict[str, Any], who: str, not_after: datetime) -> dict[str, Any]:
    """One WRITE: sent once in the installer lane, waiting up to the op's timeout. Anything short of success raises
    intercom_sync.action_error's ApiError (details: `outcome` not_sent / refused / unknown, `state`, `wiskey_code`)."""
    reply, outcome = intercom_sync.SYNC._execute(settings, "installer", lambda call: send(call, op, values), op.project, who, op.timeout_s, lane=LANE,
                                                 not_after=not_after, channel=CHANNEL)
    if outcome != "ok":
        raise intercom_sync.action_error(reply, outcome, LANE)
    return reply


# ---------------------------------------------------------------- the typed confirmation

def normalized(text: Any) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split()) if isinstance(text, str) else ""


def typed_ok(expected: str, typed: Any) -> bool:
    return bool(expected) and normalized(typed) == normalized(expected)


# ---------------------------------------------------------------- Arx's own limits

COOLDOWN_SCALE = 1.0  # tests shrink it
USER_WINDOW_S = 60.0
USER_MAX = 12  # installer writes per operator per window
MAX_INFLIGHT = 1  # installer writes at once, installation-wide (each one may hold a device for up to a minute)


class Limits(wl.WriteLimits):
    """In-process limits for the installer writes (services/wiskey_write_limits.py with this module's constants). A refusal is
    `(code, retry_after_s)`; an admitted write holds the in-flight slot until `done`. The cool-down of `(op, target)` starts only when
    the write was handed to WisKey (`sent`)."""

    def __init__(self) -> None:
        super().__init__("installer", busy_retry_s=3.0)

    def cooldown_left(self, op: Op, target: str, now: float | None = None) -> float:
        return self.key_cooldown_left((op.name, target), op.cooldown_s * COOLDOWN_SCALE, now)

    def admit(self, user: str, op: Op, target: str) -> tuple[str, float] | None:
        return self.admit_key(user, (op.name, target), cooldown_s=op.cooldown_s * COOLDOWN_SCALE, window_s=USER_WINDOW_S, user_max=USER_MAX,
                              max_inflight=MAX_INFLIGHT)

    def sent(self, op: Op, target: str) -> None:
        self.mark_sent((op.name, target))


LIMITS = Limits()

LIMIT_MESSAGES = {
    "installer_cooldown": "הפעולה הזו נשלחה לפני רגע. אפשר לשלוח אותה שוב בעוד {s} שניות.",
    "installer_rate_limited": "נשלחו יותר מדי פעולות התקנה בזמן קצר. הפעולה לא נשלחה - נסו שוב בעוד דקה.",
    "installer_busy": "פעולת התקנה אחרת עדיין רצה. הפעולה לא נשלחה - נסו שוב כשהיא תסתיים.",
}


# ---------------------------------------------------------------- shared projections

def listed(settings: Settings, commands: frozenset[str] | set[str]) -> dict[str, bool | None]:
    """Which of `commands` WisKey lists in `overview.api.commands` for the add-on's user (capability discovery): True / False, or None
    for every command while there is no served copy (unknown, never "missing")."""
    facts = intercom_sync.SYNC.api_facts(settings)
    names = (facts or {}).get("commands")
    if not isinstance(names, (list, set, frozenset)):
        return {c: None for c in sorted(commands)}
    have = {n for n in names if isinstance(n, str)}
    return {c: c in have for c in sorted(commands)}


def stations(settings: Settings) -> list[dict[str, Any]] | None:
    """The served copy's stations (id, name, online, the closed technical part) or None when there is no copy."""
    sup = intercom_sync.SYNC.stations_superset(settings)
    return sup["stations"]


def station_name(settings: Settings, station_id: str) -> str | None:
    found = next((s for s in stations(settings) or [] if s.get("id") == station_id), None)
    return None if found is None else str(found.get("name") or station_id)


def reset() -> None:
    LIMITS.reset()
