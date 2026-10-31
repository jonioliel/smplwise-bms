"""CR-036 S11: the WRITE side of the access-control adapter - every person and card write Arx starts in WisKey.

The read side is services/intercom_adapter.py (the read / technical channels). Writes ride the SERVICE channel (the add-on's own
identity, services/wiskey_channels.py SERVICE_WRITES): browser -> a typed Arx endpoint (routers/access_control.py, the existing
person editor and card capture, and routers/access_control_writes.py, the writes added here) -> `intercom_sync.SYNC.action`
(the config / capture lanes, sent once, never queued, never retried) -> `hikvision_intercom/<command>`. The browser never names a
command. Owner decisions of 2026-10-12 (binding, private/wiskey-foldin/ARX_OWNER_DECISIONS_TO_WISKEY_2026-10-12_HE.md): stage 1
includes every write; DW and PG are approved; Arx RBAC is the ONLY authority for Arx-started actions (no WisKey re-auth, MFA or
dual approval is added by Arx - if WisKey's own dual approval is switched on in WisKey, its refusal is shown, never bypassed);
the engine stays WisKey.

What this module decides:

- **Who may write** (`gate_person_write`, `gate_create`): Arx RBAC over the access-control station chain (CR-033's scope through
  services/intercom_authority.py - this branch knows the installation alone until CR-033 D2 is merged; nothing changes then).
  A person write needs the permission(s) on EVERY station of the person, before AND after the change (CR-036 3.7: a person shared
  with a station outside the caller's chain is read-only for them - WisKey's own `person_scope_shared` rule); a person with no
  station needs the permission unrestricted. A field the read views call sensitive (phone, the PIN, cards, the photo, the
  responsible person and purpose, and the employee number when the administrator made it sensitive) needs
  `access.people.sensitive` on the same stations. A caller who cannot see the person at all gets the uniform "not found" (no
  existence oracle); one who sees them but may not change them a 403 `intercom_person_scope`. A caller unrestricted for every
  permission involved skips the person read (WisKey's own revision check still binds the write); everyone else is checked against
  a fresh `users/get` read, and the write must carry the revision that read returned (else 409, nothing sent) - so the stations
  that were checked are the stations the write applies to.
- **What happens** (`EFFECT_OF`): the owner's DW / PG classes of 2026-10-12. `sync` = WisKey answered the saved record (its
  store holds it; each station follows through WisKey's own sync - `sync_now` is sent explicitly on create / update, default
  true so the person reaches the stations). `unknown_effect` = `users/delete`, `cards/capture_start`, `cards/capture_cancel`,
  `cards/capture_confirm`: WisKey's acceptance is NOT a known effect (jobs are scheduled, a reader is driven) - the reply says
  `pending: true` and the screens show "sent, result pending" until a read confirms it. `personal_value` = `users/pin_generate`.
  UNKNOWN is never success; no write is retried automatically, by the server or by the screens.
- **What is recorded**: Arx's audit row per write - the initiator (the real Arx actor), the request id (the request's correlation
  id; the client's `client_request_id` and Arx's `command_id`), the logical target (person / station / session / card id) and the
  outcome; NEVER the body, a PIN, a card number, a code or a token, nor their hash or length (the D06 wording, 2026-10-12). Field
  NAMES of an update are kept (never a value). `effect_fields` adds the effect class to the row and the reply.
- **PIN generation** (`interactive`, PG): only an interactive human session - the Home Assistant frontend (Ingress) or an Arx
  sign-in session in a browser (cookie); a bearer-token client (a native app or a script holding a token) and every internal
  principal are refused. Its own permission, `access.pin.generate` (sensitive, site_admin and system_admin by default), on top of
  `access.people.manage`. The value is in the response to the requesting operator once (`Cache-Control: no-store`) and nowhere
  else: never stored, logged, cached, audited, put in an error or replayed; tests use a fake sentinel value.
- **The editor's view** (`view_editor_person`): the editor projection at the caller's field level - phone, the PIN flag, the
  masked cards, the photo flag, the responsible person and purpose only at the sensitive level (null = not shown, never "none").

Local validators mirror WisKey's own rules (rc.37 reference source, read only, never run): the timing draft and the enforced
timing policy (access/user_timing.py, access/timing_policy.py, access/schedules.py `periods`, access/schedule_compiler.py
`bindings_for`) and the photo (profile_settings.py `photo_value`), so a malformed write is an audited `not_sent` refusal, not a
round trip. Nothing here contacts anything but the feed's session; tests drive it with tests/fake_wiskey.py.
"""
from __future__ import annotations

import base64
import binascii
import re
from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..config import Settings
from ..errors import ApiError
from ..rbac import Principal
from . import intercom_adapter, intercom_client, intercom_sync
from . import intercom_authority as ia

MANAGE = ia.PEOPLE_MANAGE
CAPTURE = "access.cards.capture"
PIN_GENERATE = ia.PIN_GENERATE

# ---------------------------------------------------------------- effects (owner decision 2026-10-12, DW / PG)

SYNC = "sync"
UNKNOWN_EFFECT = "unknown_effect"
PERSONAL_VALUE = "personal_value"
EFFECT_OF: dict[str, str] = {
    "users/create": SYNC, "users/update": SYNC, "users/set_active": SYNC, "users/archive": SYNC, "users/unarchive": SYNC,
    "users/temporary_cancel": SYNC, "cards/add": SYNC, "cards/remove": SYNC,
    "users/delete": UNKNOWN_EFFECT, "cards/capture_start": UNKNOWN_EFFECT, "cards/capture_cancel": UNKNOWN_EFFECT,
    "cards/capture_confirm": UNKNOWN_EFFECT,
    "users/pin_generate": PERSONAL_VALUE,
}


def effect_fields(command: str) -> dict[str, Any]:
    """`{effect, pending}` for a reply and an audit row: `pending` is true exactly for the UNKNOWN_EFFECT commands."""
    effect = EFFECT_OF[command]
    return {"effect": effect, "pending": effect == UNKNOWN_EFFECT}


# ---------------------------------------------------------------- the interactive session (PG)

def interactive(principal: Principal) -> bool:
    """A human at an interactive session: the HA frontend through the Supervisor's Ingress (`ingress`), an Arx sign-in session in a
    browser (`remote` with `via == "cookie"`) or the developer identity (`dev`, never inside the add-on). A bearer-token client
    (`remote` + `bearer`: the native apps or a script holding a token), and every internal principal (`internal`, `system`,
    `push`, `device`), is not. Ingress cannot prove a person at the keyboard either; it is the HA frontend's own session."""
    if principal.source in ("ingress", "dev"):
        return True
    return principal.source in ("remote", "local") and principal.via == "cookie"  # USR2: a local identity signs in with a cookie only


# ---------------------------------------------------------------- the station-scope gate

# the fields a write may set that the read views put at the sensitive level (S3 / S7, owner answers of 2026-10-11 / 12)
SENSITIVE_FIELDS = frozenset({"phone", "pin", "cards", "photo", "responsible_person", "access_purpose"})
NOT_FOUND = intercom_adapter.PERSON_NOT_FOUND  # the read side's uniform answer (no existence oracle)


def uniform_not_found() -> ApiError:
    return ApiError(404, NOT_FOUND[0], NOT_FOUND[1])


def scope_refusal() -> ApiError:
    return ApiError(403, "intercom_person_scope", "האדם משויך גם לעמדה שאינה בניהולך, ולכן אי אפשר לשנות אותו מכאן.")


def sees_unknown_person(auth: ia.Authority) -> bool:
    """Whether the caller can see a person whose station set is UNKNOWN: only when unrestricted for reading or managing people - the
    read side's rule (intercom_authority.person_level_of: unknown assignments are visible to an unrestricted reader only; WisKey Q1)
    and this gate's own `knows` rule for a person with no station."""
    return auth.unrestricted(MANAGE) or auth.unrestricted(ia.PEOPLE_READ)


def unknown_station_refusal(auth: ia.Authority) -> ApiError:
    """The refusal of a writer who is not unrestricted, for a person whose station set is unknown. SECFIX2-295: with the owner switch
    `access.unknown_person_uniform_404` on, a caller who cannot see such a person gets the uniform 404 - the same bytes as an id
    WisKey does not know (no existence oracle; the default since FABLEFIX-295 D-13, owner 2026-10-21); off, and for a caller who sees the
    person: the 403."""
    if not sees_unknown_person(auth) and auth.policy(ia.UNKNOWN_PERSON_UNIFORM_404):
        return uniform_not_found()
    return scope_refusal()


def field_refusal() -> ApiError:
    return ApiError(403, "intercom_field_level", "שינוי פרטים רגישים (טלפון, תמונה, קוד או כרטיסים) דורש הרשאה לפרטים רגישים.")


def sensitive_write(auth: ia.Authority, fields: Iterable[str]) -> bool:
    """Whether a write that sets `fields` touches the sensitive level (the employee number too when the administrator made it
    sensitive, `access.employee_no_sensitive`)."""
    names = set(fields)
    return bool(names & SENSITIVE_FIELDS) or ("employee_no" in names and auth.policy(ia.EMPLOYEE_NO_SENSITIVE))


def write_level(auth: ia.Authority, station_ids: Iterable[str]) -> str:
    """The field level a writer has on a person assigned to `station_ids`: SENSITIVE when `access.people.sensitive` is held on
    every one (unrestricted for a person with none), else NAMES. Independent of `access.people.read`: a writer's level."""
    ids = [s for s in station_ids]
    if not ids:
        return ia.SENSITIVE if auth.unrestricted(ia.PEOPLE_SENSITIVE) else ia.NAMES
    return ia.SENSITIVE if all(auth.station(ia.PEOPLE_SENSITIVE, s) for s in ids) else ia.NAMES


def _holds_everywhere(auth: ia.Authority, permissions: Iterable[str], station_ids: list[str]) -> bool:
    perms = list(permissions)
    if not station_ids:
        return all(auth.unrestricted(p) for p in perms)
    return all(auth.station(p, s) for p in perms for s in station_ids)


@dataclass
class Target:
    """What the gate decided: the person as read (a closed superset; None when the unrestricted shortcut needed no read), their
    stations before the change (None when not read) and the caller's field level on them."""

    person: dict[str, Any] | None
    stations: list[str] | None
    level: str


def read_person(settings: Settings, auth: ia.Authority, user_id: str) -> dict[str, Any]:
    """One fresh `users/get` on the service channel (the editor's own read, SERVICE_READS) as a closed superset
    (intercom_adapter.project_person). Not found is the uniform answer; a feed that cannot answer refuses the write (nothing sent)."""
    try:
        reply = intercom_sync.SYNC.command(settings, "person", lambda call: intercom_client.users_get(call, user_id), intercom_adapter.project_one_person,
                                           who=auth.principal.user_id, target=intercom_sync.person_target(user_id))
    except ApiError as exc:
        if exc.code == "intercom_person_not_found":
            raise uniform_not_found() from None
        raise
    person = reply.get("person")
    if person is None:
        raise intercom_sync.action_error(reply, "not_sent", "config")
    return person


def gate_person_write(
    settings: Settings,
    auth: ia.Authority,
    user_id: str,
    *,
    permissions: Iterable[str] = (MANAGE,),
    after: Iterable[str] = (),
    extra_stations: Iterable[str] = (),
    sensitive: bool = False,
    revision: int | None = None,
    need_person: bool = False,
) -> Target:
    """The station-scope rule of a write to an existing person (see the module note). `after`: the stations the write names
    (a new or changed assignment, a timing binding); `extra_stations`: stations the action itself acts on (the reader of a card
    capture) - both must be covered like the person's own. `need_person`: read the person even when the shortcut would not.
    Raises the refusal (an ApiError the router audits as `not_sent`)."""
    perms = tuple(dict.fromkeys(permissions))
    if shortcut_applies(auth, perms, sensitive) and not need_person:
        return Target(None, None, ia.SENSITIVE if auth.unrestricted(ia.PEOPLE_SENSITIVE) else ia.NAMES)
    person = read_person(settings, auth, user_id)
    return check_person(auth, person, permissions=perms, after=after, extra_stations=extra_stations, sensitive=sensitive, revision=revision)


def shortcut_applies(auth: ia.Authority, permissions: Iterable[str], sensitive: bool) -> bool:
    """The caller holds every permission involved unrestricted (every station, present and future): no person read is needed
    to decide."""
    return all(auth.unrestricted(p) for p in permissions) and (not sensitive or auth.unrestricted(ia.PEOPLE_SENSITIVE))


def check_person(
    auth: ia.Authority,
    person: dict[str, Any],
    *,
    permissions: Iterable[str] = (MANAGE,),
    after: Iterable[str] = (),
    extra_stations: Iterable[str] = (),
    sensitive: bool = False,
    revision: int | None = None,
) -> Target:
    """The rule over a person as read (a closed superset, intercom_adapter.project_person): visible at all (else the uniform
    404), every permission on every station before and after - before = the assignments AND the stations of the person's own
    permission overrides (PERMOVR-293; unknown overrides: unrestricted only) - (else 403 `intercom_person_scope`), the sensitive level when asked
    (else 403 `intercom_field_level`), the revision the write carries equal to the one read (else 409)."""
    perms = tuple(dict.fromkeys(permissions))
    after_ids = [s for s in after if isinstance(s, str)]
    extra_ids = [s for s in extra_stations if isinstance(s, str)]
    before = ia.person_station_ids(person)
    if before is None:
        # WisKey withheld the person's assignments (a redacted `access` category) or the record is malformed / incomplete (ARX-N03):
        # nothing can be decided per station
        if not shortcut_applies(auth, perms, sensitive):
            raise unknown_station_refusal(auth)
        before = []
    knows = any(auth.station(MANAGE, s) or auth.station(ia.PEOPLE_READ, s) for s in before) if before else (auth.unrestricted(MANAGE) or auth.unrestricted(ia.PEOPLE_READ))
    if not knows:
        raise uniform_not_found()  # decided on the assignments alone, before the overrides: no existence oracle through them
    # PERMOVR-293 (WisKey Q2): the stations of the person's own permission overrides (allow and deny) are stations of the person -
    # each decided per station like an assignment (deny-overrides); unknown overrides refuse anyone not unrestricted (fail closed)
    gate = ia.person_gate_station_ids(person)
    if gate is None:
        if not shortcut_applies(auth, perms, sensitive):
            raise scope_refusal()
        gate = before
    before = list(dict.fromkeys([*before, *gate]))
    covered = list(dict.fromkeys([*before, *after_ids]))
    if not _holds_everywhere(auth, perms, covered) or any(not all(auth.station(p, s) for p in perms) for s in extra_ids) or person.get("operator_editable") is False:
        raise scope_refusal()
    level = write_level(auth, covered)
    if sensitive and level != ia.SENSITIVE:
        raise field_refusal()
    if revision is not None and person.get("revision") != revision:
        raise ApiError(409, "intercom_revision_conflict", "האדם השתנה מאז שנטען, ולכן השינוי לא נשלח. טענו מחדש את הרשומה ונסו שוב.")
    return Target(person, before, level)


def check_stations(auth: ia.Authority, stations: list[str] | None, *, permissions: Iterable[str], extra_stations: Iterable[str] = (), sensitive: bool = False) -> None:
    """The same rule over stations already decided once (a card capture's person, recorded when it started): `None` = the start
    took the unrestricted shortcut, so the caller must still be unrestricted. Raises the refusal."""
    perms = tuple(dict.fromkeys(permissions))
    if stations is None:
        if not shortcut_applies(auth, perms, sensitive):
            raise scope_refusal()
        return
    extra_ids = [s for s in extra_stations if isinstance(s, str)]
    if not _holds_everywhere(auth, perms, stations) or any(not all(auth.station(p, s) for p in perms) for s in extra_ids):
        raise scope_refusal()
    if sensitive and write_level(auth, stations) != ia.SENSITIVE:
        raise field_refusal()


def gate_create(auth: ia.Authority, after: Iterable[str], *, sensitive: bool) -> str:
    """A new person: `access.people.manage` on every station the draft names (unrestricted for a person with none), the sensitive
    level there for a sensitive field. Returns the caller's field level on the new person."""
    ids = list(dict.fromkeys(s for s in after if isinstance(s, str)))
    if not auth.person_editable(ids):
        raise scope_refusal()
    level = write_level(auth, ids)
    if sensitive and level != ia.SENSITIVE:
        raise field_refusal()
    return level


def draft_stations(data: dict[str, Any]) -> list[str]:
    """The stations a person write names: personal overrides (allow or deny - a deny is a change there too), the enabled stations'
    relays and the stations of an enforced timing policy's device bindings."""
    out: list[str] = []
    for key in ("permission_overrides", "door_permissions"):
        value = data.get(key)
        if isinstance(value, dict):
            out.extend(k for k in value if isinstance(k, str))
    policy = data.get("access_timing_policy")
    if isinstance(policy, dict) and isinstance(policy.get("bindings"), dict):
        out.extend(k for k in policy["bindings"] if isinstance(k, str))
    return list(dict.fromkeys(out))


# ---------------------------------------------------------------- the editor's view of a person

def _str(value: Any, limit: int) -> str | None:
    return value[:limit] if isinstance(value, str) else None


def project_editor_extras(raw: Any) -> dict[str, Any]:
    """What the editor needs beyond intercom_sync.project_person_editor: the archive state, the access category, the responsible
    person and purpose, whether there is a photo, and the timing proposal / enforced policy for editing (closed: every key built
    here; a native policy's device bindings by station, slot numbers only)."""
    raw = raw if isinstance(raw, dict) else {}
    draft = timing_view(raw.get("access_timing_draft"))
    policy = raw.get("access_timing_policy") if isinstance(raw.get("access_timing_policy"), dict) else None
    policy_view = None
    if policy is not None:
        bindings = policy.get("bindings") if isinstance(policy.get("bindings"), dict) else {}
        policy_view = {
            "mode": policy.get("mode") if policy.get("mode") in ("ha", "native") else "unknown",
            "schedule": timing_view(policy.get("schedule")),
            "bindings": {
                sid: {k: (v if isinstance(v, int) and not isinstance(v, bool) else None) for k, v in b.items() if k in ("template", "weekly", "holiday_group")}
                | {"holidays": [h for h in b.get("holidays") or [] if isinstance(h, int) and not isinstance(h, bool)][:64]}
                for sid, b in list(bindings.items())[:100] if ia.valid_id(sid) and isinstance(b, dict)
            },
        }
    category = raw.get("access_category")
    # WisKey round 3 (R3-03): a withheld `access` category arrives as access_category "staff" and "" responsible / purpose, a
    # withheld photo as false - WisKey's blanks, not the person's values: unknown here
    scope = intercom_sync.person_scope(raw)
    access = scope["access_readable"]
    photo_known = scope["redacted_fields"] is not None and "photo" not in scope["redacted_fields"]
    return {
        "archived": raw.get("archived_at") is not None,
        "access_category": category if access and category in ("staff", "visitor", "contractor") else "unknown",
        "responsible_person": _str(raw.get("responsible_person"), 64) if access else None,
        "access_purpose": _str(raw.get("access_purpose"), 128) if access else None,
        "photo_configured": raw.get("photo_configured") if photo_known and isinstance(raw.get("photo_configured"), bool) else None,
        "timing_draft": draft,
        "timing_policy": policy_view,
    }


def timing_view(value: Any) -> dict[str, Any] | None:
    """A timing schedule ({mode, timezone, days, dates, periods}) for the editor, field by field (a value of an unknown shape is
    dropped, never echoed)."""
    if not isinstance(value, dict):
        return None
    periods = [
        {"start": p["start"], "end": p["end"]}
        for p in (value.get("periods") if isinstance(value.get("periods"), list) else [])[:8]
        if isinstance(p, dict) and isinstance(p.get("start"), str) and isinstance(p.get("end"), str) and len(p["start"]) <= 5 and len(p["end"]) <= 5
    ]
    return {
        "mode": value.get("mode") if value.get("mode") in ("weekly", "dates") else "unknown",
        "timezone": _str(value.get("timezone"), 128),
        "days": [d for d in (value.get("days") if isinstance(value.get("days"), list) else [])[:7] if d in DAYS],
        "dates": [d for d in (value.get("dates") if isinstance(value.get("dates"), list) else [])[:64] if isinstance(d, str) and DATE.fullmatch(d)],
        "periods": periods,
    }


def project_editor(raw: Any) -> dict[str, Any]:
    """The editor projection: intercom_sync.project_person_editor (raises on a non-person answer: after a write that is "outcome
    unknown") plus `project_editor_extras`. Principal-independent; `view_editor_person` cuts it to the caller."""
    person = intercom_sync.project_person_editor(raw)
    return {**person, **project_editor_extras(raw)}


EDITOR_SENSITIVE_KEYS = ("phone", "pin_configured", "cards", "photo_configured", "responsible_person", "access_purpose")


def view_editor_person(auth: ia.Authority, person: dict[str, Any] | None, level: str | None = None) -> dict[str, Any] | None:
    """The editor projection at the caller's field level (`level`, else computed over the person's stations): the sensitive keys
    are null below the sensitive level (null = not shown, never "none"), the employee number follows the administrator's setting.
    `level` is added so the editor shapes itself."""
    if person is None:
        return None
    ids = [s.get("station_id") for s in person.get("stations") or [] if isinstance(s, dict) and isinstance(s.get("station_id"), str)]
    level = level or write_level(auth, ids)
    out = dict(person)
    if level != ia.SENSITIVE:
        for key in EDITOR_SENSITIVE_KEYS:
            out[key] = None
    if not auth.employee_no_for(level):
        out["employee_no"] = None
    out["level"] = level
    return out


# ---------------------------------------------------------------- local validators (WisKey's own rules, read in the rc.37 source)

DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
HHMM = re.compile(r"(?:[01][0-9]|2[0-3]):[0-5][0-9]")
DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
MAX_PERIODS = 8
MAX_DATES = 64
MAX_BINDINGS = 100


def _minute(value: Any, *, end: bool = False) -> int:
    if not isinstance(value, str) or not HHMM.fullmatch(value):
        if end and value == "24:00":
            return 1440
        raise ValueError("schedule_invalid_time")
    hour, minute = value.split(":")
    return int(hour) * 60 + int(minute)


def periods(value: Any) -> list[dict[str, str]]:
    """access/schedules.py `periods`: at most 8 `{start, end}` windows (HH:MM, an end may be 24:00), each start before its end,
    sorted, no overlap."""
    if not isinstance(value, list) or len(value) > MAX_PERIODS:
        raise ValueError("schedule_period_limit")
    out = []
    for item in value:
        if not isinstance(item, dict) or set(item) != {"start", "end"}:
            raise ValueError("schedule_invalid_time")
        if _minute(item["start"]) >= _minute(item["end"], end=True):
            raise ValueError("schedule_invalid_time")
        out.append({"start": item["start"], "end": item["end"]})
    out.sort(key=lambda p: p["start"])
    if any(_minute(a["end"], end=True) > _minute(b["start"]) for a, b in zip(out, out[1:])):
        raise ValueError("schedule_overlap")
    return out


def _calendar_date(value: Any) -> date:
    if not isinstance(value, str) or not DATE.fullmatch(value):
        raise ValueError("schedule_invalid_date")
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise ValueError("schedule_invalid_date") from None
    if not 2000 <= parsed.year <= 2037:
        raise ValueError("schedule_invalid_date")
    return parsed


def timing_draft(value: Any) -> dict[str, Any] | None:
    """access/user_timing.py `timing_draft`: exactly {mode, timezone, days, dates, periods}; an IANA zone; `weekly` = 1..7
    distinct days and no dates, `dates` = 1..64 distinct calendar dates (2000..2037) and no days; at least one window. None
    clears the proposal. Returns WisKey's normal form (days in week order, dates sorted)."""
    if value is None:
        return None
    if not isinstance(value, dict) or set(value) != {"mode", "timezone", "days", "dates", "periods"}:
        raise ValueError("invalid_user_timing")
    zone = value["timezone"]
    if not isinstance(zone, str) or not zone or len(zone) > 128:
        raise ValueError("invalid_user_timing")
    try:
        ZoneInfo(zone)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("invalid_user_timing") from None
    days, dates = value["days"], value["dates"]
    if not isinstance(days, list) or not isinstance(dates, list):
        raise ValueError("invalid_user_timing")
    if value["mode"] == "weekly":
        if dates or not 1 <= len(days) <= 7 or any(d not in DAYS for d in days) or len(set(days)) != len(days):
            raise ValueError("invalid_user_timing")
        days = [d for d in DAYS if d in days]
    elif value["mode"] == "dates":
        if days or not 1 <= len(dates) <= MAX_DATES:
            raise ValueError("invalid_user_timing")
        dates = sorted(_calendar_date(d).isoformat() for d in dates)
        if len(set(dates)) != len(dates):
            raise ValueError("invalid_user_timing")
    else:
        raise ValueError("invalid_user_timing")
    windows = periods(value["periods"])
    if not windows:
        raise ValueError("invalid_user_timing")
    return {"mode": value["mode"], "timezone": zone, "days": days, "dates": dates, "periods": windows}


def holiday_count(schedule: dict[str, Any]) -> int:
    """access/user_timing_plan.py `user_schedule`: a `dates` proposal becomes one holiday per run of adjacent dates; a weekly one
    has none. A native binding names exactly this many holiday slots."""
    if schedule["mode"] != "dates":
        return 0
    runs, previous = 0, None
    for text in schedule["dates"]:
        current = date.fromisoformat(text)
        if previous is None or (current - previous).days != 1:
            runs += 1
        previous = current
    return runs


def _binding(slots: Any, holidays: int) -> dict[str, Any]:
    """access/schedule_compiler.py `bindings_for` (+ the policy's 65532 cap): {template, weekly, holiday_group, holidays} device
    slot numbers 1..65535 (template and weekly at most 65532), one distinct holiday slot per holiday, a holiday group exactly
    when there are holidays."""
    if not isinstance(slots, dict) or set(slots) != {"template", "weekly", "holiday_group", "holidays"}:
        raise ValueError("schedule_binding_invalid")
    days = slots["holidays"]
    if not isinstance(days, list) or len(days) != holidays:
        raise ValueError("schedule_binding_invalid")
    ids = [slots["template"], slots["weekly"], *days]
    if holidays:
        ids.append(slots["holiday_group"])
    elif slots["holiday_group"] is not None:
        raise ValueError("schedule_binding_invalid")
    if any(type(i) is not int or not 1 <= i <= 65535 for i in ids) or len(set(days)) != len(days):
        raise ValueError("schedule_binding_invalid")
    if slots["template"] > 65532 or slots["weekly"] > 65532:
        raise ValueError("schedule_binding_invalid")
    return {"template": slots["template"], "weekly": slots["weekly"], "holiday_group": slots["holiday_group"], "holidays": list(days)}


def timing_policy(value: Any) -> dict[str, Any] | None:
    """access/timing_policy.py `policy`: exactly {mode, schedule, bindings}; `ha` (Arx's own enforcement through WisKey's rolling
    validity window) takes no bindings; `native` (the device's own schedule) binds each station to its device slots (at most
    100 stations). None clears the policy."""
    if value is None:
        return None
    if not isinstance(value, dict) or set(value) != {"mode", "schedule", "bindings"}:
        raise ValueError("invalid_timing_policy")
    if value["mode"] not in ("ha", "native"):
        raise ValueError("invalid_timing_policy")
    try:
        schedule = timing_draft(value["schedule"])
    except ValueError as exc:
        raise ValueError(str(exc)) from None
    bindings = value["bindings"]
    if schedule is None or not isinstance(bindings, dict):
        raise ValueError("invalid_timing_policy")
    if value["mode"] == "ha" and bindings:
        raise ValueError("invalid_timing_policy")
    if len(bindings) > MAX_BINDINGS:
        raise ValueError("invalid_timing_policy")
    holidays = holiday_count(schedule)
    out = {}
    for station, slots in bindings.items():
        if not isinstance(station, str) or not 1 <= len(station) <= 64 or any(ord(c) < 32 for c in station):
            raise ValueError("invalid_timing_policy")
        out[station] = _binding(slots, holidays)
    return {"mode": value["mode"], "schedule": schedule, "bindings": out}


PHOTO_PREFIX = intercom_adapter.PHOTO_PREFIX
PHOTO_MAX_CHARS = intercom_adapter.PHOTO_MAX_CHARS
PHOTO_MAX_BYTES = intercom_adapter.PHOTO_MAX_BYTES
PHOTO_MAX_SIDE = 512


def photo_value(value: Any) -> str | None:
    """profile_settings.py `photo_value`: a JPEG data URL of at most 44 000 characters / 32 768 bytes, a real JPEG (start and end
    markers, a well-formed segment walk) whose frame is 1..512 x 1..512 - never SVG, never a URL. None removes the photo."""
    if value is None:
        return None
    if not isinstance(value, str) or not value.startswith(PHOTO_PREFIX) or len(value) > PHOTO_MAX_CHARS:
        raise ValueError("invalid_photo")
    try:
        data = base64.b64decode(value[len(PHOTO_PREFIX):], validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("invalid_photo") from None
    if len(data) > PHOTO_MAX_BYTES or data[:2] != b"\xff\xd8" or data[-2:] != b"\xff\xd9":
        raise ValueError("invalid_photo")
    offset, dimensions = 2, False
    while offset + 4 <= len(data):
        if data[offset] != 0xFF:
            raise ValueError("invalid_photo")
        marker = data[offset + 1]
        if marker == 0xDA:  # start of scan: the headers are over
            break
        size = int.from_bytes(data[offset + 2:offset + 4], "big")
        if size < 2 or offset + size + 2 > len(data):
            raise ValueError("invalid_photo")
        if marker in (0xC0, 0xC2):
            height = int.from_bytes(data[offset + 5:offset + 7], "big")
            width = int.from_bytes(data[offset + 7:offset + 9], "big")
            if size < 8 or not 1 <= width <= PHOTO_MAX_SIDE or not 1 <= height <= PHOTO_MAX_SIDE:
                raise ValueError("invalid_photo")
            dimensions = True
        offset += size + 2
    if not dimensions:
        raise ValueError("invalid_photo")
    return value
