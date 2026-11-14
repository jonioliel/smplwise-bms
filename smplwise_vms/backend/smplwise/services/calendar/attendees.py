"""CAL-ATTENDEES-2343 (owner 2026-11-02, answers 6C + 7B; docs/changes/CAL-ATTENDEES-2343.md) - named attendees of a calendar entry.

Who can be invited (6C): an Arx USER (`users.id`), a RESIDENT (a person in the people directory the access module uses - `ticket_contacts`
kind `person`) and an external GUEST (name + phone or e-mail, no system access). Users and residents are references only: their contact
details stay in their own directory and are read at send time. A guest's name / phone / e-mail are sealed (connection_store `cal_att|...`)
and erased on the calendars' guest retention (`guest_retention_days` after the entry's end).

Who may change the list:
* the ORGANIZER (with at least the `book` role) and the calendar's editors / managers (`edit`+) add and remove anyone, change a role;
* anyone else who sees the entry ("a resident") may only add HIMSELF (the calendar's `self_join`) and, once he is an attendee, guests of
  his own (`guests_mode = anyone`); he may remove himself and the guests he added;
* guests at all need `guests_mode` organizer (the default: organizer and managers) or anyone; `off` refuses every guest.

Privacy: a viewer gets the COUNT only (nothing at the `busy` detail level); the list goes to the organizer and managers, plus the attendees
(`list_visibility = attendees`) or every viewer with titles (`viewers`). A guest's phone and e-mail go to the organizer and managers only,
never to a list for anyone else, a notification, an audit row or a log.

Every attendee lives on the ROOT entry: the series id for a recurring entry (an override row's attendees are its series')."""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from typing import Any

from ...db import get_setting
from ...errors import ApiError
from .. import connection_store as cs
from . import guests, model
from .access import Ctx, Denied, detail_level, get_visible, scope_of
from .calendars import new_id

KINDS = ("user", "resident", "guest")
ROLES = ("required", "optional")
STATUSES = ("invited", "accepted", "declined", "tentative")
RESPONSES = ("accepted", "declined", "tentative")
GUESTS_MODES = ("off", "organizer", "anyone")
LIST_VISIBILITY = ("organizer", "attendees", "viewers")
GUEST_CHANNELS = ("whatsapp", "sms", "email")  # the order is a setting; e-mail and SMS plug in through attendee_notices.register_channel
OPEN_STATES = ("pending", "confirmed")
MAX_PER_REQUEST = 50

SETTINGS_KEY = "calendar.attendees"
SETTINGS_DEFAULTS: dict[str, Any] = {
    "enabled": True,  # the attendee feature inside the calendars module (the module switch still decides first)
    "cancel_notice_delay_s": 6,  # owner 02.11: the cancel notice waits the undo window of a delete (~6 s), 0-120
    "guest_channel_order": ["whatsapp", "sms", "email"],  # 7B: the first channel that is configured AND has the guest's address
    "notify_users_inapp": True,  # 7B: users and residents with an Arx account get the in-app notification
    "notify_guests": True,  # 7B: guests get the configured messaging channel
}
POLICY_DEFAULTS: dict[str, Any] = {"guests_mode": "organizer", "self_join": False, "max_attendees": 50, "notify_on_change": True, "list_visibility": "organizer"}

_EMAIL = re.compile(r"^[^@\s<>\"',;]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?)+$")
_PHONE = re.compile(r"^\+[1-9]\d{7,14}$")


# ---------------------------------------------------------------- settings (installation) and policy (per calendar)

def settings_doc(doc: Any) -> dict[str, Any]:
    if not isinstance(doc, dict):
        raise model.Invalid("settings: object", "settings")
    unknown = set(doc) - set(SETTINGS_DEFAULTS)
    if unknown:
        raise model.Invalid(f"unknown settings: {', '.join(sorted(unknown))}", sorted(unknown)[0])
    s = {**json.loads(json.dumps(SETTINGS_DEFAULTS)), **doc}
    for f in ("enabled", "notify_users_inapp", "notify_guests"):
        if not isinstance(s[f], bool):
            raise model.Invalid(f"{f}: true or false", f)
    s["cancel_notice_delay_s"] = model._int(s["cancel_notice_delay_s"], "cancel_notice_delay_s", 0, 120)
    order = s["guest_channel_order"]
    if not isinstance(order, list) or not order or len(set(order)) != len(order) or any(c not in GUEST_CHANNELS for c in order):
        raise model.Invalid("guest_channel_order: distinct channels of " + ", ".join(GUEST_CHANNELS), "guest_channel_order")
    return s


def read_settings(conn: sqlite3.Connection) -> dict[str, Any]:
    """A missing or corrupt document reads as the defaults."""
    raw = get_setting(conn, SETTINGS_KEY)
    try:
        doc = json.loads(raw) if raw else {}
        return settings_doc({k: v for k, v in doc.items() if k in SETTINGS_DEFAULTS} if isinstance(doc, dict) else {})
    except (ValueError, model.Invalid):
        return json.loads(json.dumps(SETTINGS_DEFAULTS))


def write_settings(conn: sqlite3.Connection, doc: dict[str, Any]) -> None:
    from ...db import set_setting  # noqa: PLC0415

    set_setting(conn, SETTINGS_KEY, json.dumps(doc, ensure_ascii=False, sort_keys=True))


def policy_of(conn: sqlite3.Connection, calendar_id: str) -> dict[str, Any]:
    r = conn.execute("SELECT * FROM cal_attendee_policy WHERE calendar_id = ?", (calendar_id,)).fetchone()
    if r is None:
        return {**POLICY_DEFAULTS, "revision": 0}
    return {"guests_mode": r["guests_mode"], "self_join": bool(r["self_join"]), "max_attendees": r["max_attendees"], "notify_on_change": bool(r["notify_on_change"]),
            "list_visibility": r["list_visibility"], "revision": r["revision"]}


def policy_values(body: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    allowed = set(POLICY_DEFAULTS) | {"revision"}
    unknown = set(body) - allowed
    if unknown:
        raise model.Invalid(f"unknown fields: {', '.join(sorted(unknown))}", sorted(unknown)[0])
    out = {k: current[k] for k in POLICY_DEFAULTS}
    if "guests_mode" in body:
        out["guests_mode"] = model._choice(body["guests_mode"], "guests_mode", GUESTS_MODES)
    if "list_visibility" in body:
        out["list_visibility"] = model._choice(body["list_visibility"], "list_visibility", LIST_VISIBILITY)
    for f in ("self_join", "notify_on_change"):
        if f in body:
            if not isinstance(body[f], bool):
                raise model.Invalid(f"{f}: true or false", f)
            out[f] = body[f]
    if "max_attendees" in body:
        out["max_attendees"] = model._int(body["max_attendees"], "max_attendees", 1, 500)
    return out


def save_policy(conn: sqlite3.Connection, calendar_id: str, values: dict[str, Any], who: str, stamp: str) -> None:
    conn.execute(
        """INSERT INTO cal_attendee_policy(calendar_id, guests_mode, self_join, max_attendees, notify_on_change, list_visibility, updated_by, updated_at, revision)
           VALUES (?,?,?,?,?,?,?,?,1)
           ON CONFLICT(calendar_id) DO UPDATE SET guests_mode = excluded.guests_mode, self_join = excluded.self_join, max_attendees = excluded.max_attendees,
             notify_on_change = excluded.notify_on_change, list_visibility = excluded.list_visibility, updated_by = excluded.updated_by,
             updated_at = excluded.updated_at, revision = cal_attendee_policy.revision + 1""",
        (calendar_id, values["guests_mode"], int(values["self_join"]), values["max_attendees"], int(values["notify_on_change"]), values["list_visibility"], who, stamp))


# ---------------------------------------------------------------- who is who on one entry

class Seat:
    """The caller's standing on one entry (root row, home calendar, role)."""

    def __init__(self, ctx: Ctx, ev: sqlite3.Row, cal: sqlite3.Row, role: str | None) -> None:
        self.ctx, self.ev, self.cal, self.role = ctx, ev, cal, role
        self.root_id = ev["override_of"] or ev["id"]
        uid = ctx.principal.user_id
        self.organizer = ev["organizer_user_id"] == uid
        self.strong = bool(role and model.ROLE_RANK[role] >= model.ROLE_RANK["edit"])
        self.manages = self.strong or (self.organizer and bool(role) and model.ROLE_RANK[role or "view"] >= model.ROLE_RANK["book"])
        self.level = detail_level(role, cal, organizer=self.organizer)
        self.policy = policy_of(ctx.conn, cal["id"])
        self.my_rows = my_rows(ctx.conn, self.root_id, uid)

    @property
    def attendee(self) -> bool:
        return bool(self.my_rows)

    def list_visible(self) -> bool:
        if self.manages:
            return True
        vis = self.policy["list_visibility"]
        if vis == "attendees":
            return self.attendee
        return vis == "viewers" and self.level != "busy"

    def can_join(self) -> bool:
        return self.level != "busy" and self.policy["self_join"] and not self.attendee and self.ev["state"] in OPEN_STATES

    def can_add_guest(self) -> bool:
        mode = self.policy["guests_mode"]
        if mode == "off" or self.ev["state"] not in OPEN_STATES:
            return False
        return self.manages or (mode == "anyone" and self.attendee)


def seat(ctx: Ctx, eid: str) -> Seat:
    ev = ctx.conn.execute("SELECT * FROM cal_events WHERE id = ?", (eid,)).fetchone()
    if ev is None:
        raise ApiError(404, "not_found", "האירוע לא נמצא.")
    root = ev if not ev["override_of"] else (ctx.conn.execute("SELECT * FROM cal_events WHERE id = ?", (ev["override_of"],)).fetchone() or ev)
    cal = get_visible(ctx, root["calendar_id"])  # the uniform 404 when the entry's calendar is out of reach
    return Seat(ctx, root, cal, ctx.role_in(cal))


def _resident_ids_of_user(conn: sqlite3.Connection, user_id: str) -> list[str]:
    try:
        return [r[0] for r in conn.execute("SELECT id FROM ticket_contacts WHERE kind = 'person' AND user_id = ? AND erased_at IS NULL", (user_id,)).fetchall()]
    except sqlite3.Error:
        return []


def my_rows(conn: sqlite3.Connection, root_id: str, user_id: str) -> list[sqlite3.Row]:
    """The caller's own live attendee rows: as a user, or as a resident whose directory row is linked to his account."""
    res = _resident_ids_of_user(conn, user_id)
    marks = ",".join("?" * len(res))
    sql = "SELECT * FROM cal_attendees WHERE event_id = ? AND removed_at IS NULL AND ((kind = 'user' AND ref_id = ?)"
    sql += f" OR (kind = 'resident' AND ref_id IN ({marks}))" if res else ""
    return conn.execute(sql + ")", (root_id, user_id, *res)).fetchall()


def live(conn: sqlite3.Connection, root_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM cal_attendees WHERE event_id = ? AND removed_at IS NULL ORDER BY added_at, id", (root_id,)).fetchall()


def count(conn: sqlite3.Connection, root_id: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM cal_attendees WHERE event_id = ? AND removed_at IS NULL", (root_id,)).fetchone()[0]


# ---------------------------------------------------------------- validation of what is asked

def normalise_phone(raw: str) -> str:
    return guests.normalise_phone(raw)


def _user_row(conn: sqlite3.Connection, uid: Any) -> sqlite3.Row | None:
    if not isinstance(uid, str) or not 1 <= len(uid) <= 128:
        return None
    return conn.execute("SELECT id, username, display_name FROM users WHERE id = ? AND active = 1 AND deleted_at IS NULL", (uid,)).fetchone()


def _resident_row(conn: sqlite3.Connection, rid: Any) -> sqlite3.Row | None:
    if not isinstance(rid, str) or not 1 <= len(rid) <= 128:
        return None
    try:
        return conn.execute("SELECT * FROM ticket_contacts WHERE id = ? AND kind = 'person' AND active = 1 AND erased_at IS NULL", (rid,)).fetchone()
    except sqlite3.Error:
        return None


def validate_items(conn: sqlite3.Connection, items: Any) -> list[dict[str, Any]]:
    """Shape only (no permission): [{kind, ref_id | name + phone / email, role}] -> normalised dicts. 422 on anything else."""
    if not isinstance(items, list) or len(items) > MAX_PER_REQUEST:
        raise model.Invalid(f"attendees: a list of at most {MAX_PER_REQUEST}", "attendees")
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for i, it in enumerate(items):
        f = f"attendees[{i}]"
        if not isinstance(it, dict):
            raise model.Invalid(f"{f}: object", f)
        kind = model._choice(it.get("kind"), f"{f}.kind", KINDS)
        role = model._choice(it.get("role", "required"), f"{f}.role", ROLES)
        if kind == "guest":
            if set(it) - {"kind", "role", "name", "phone", "email"}:
                raise model.Invalid(f"{f}: kind, role, name, phone, email", f)
            name = model._text(it.get("name"), f"{f}.name", 1, 80)
            phone = normalise_phone(model._text(it.get("phone") or "", f"{f}.phone", 0, 30))
            email = model._text(it.get("email") or "", f"{f}.email", 0, 254).lower()
            if phone and not _PHONE.match(phone):
                raise model.Invalid("מספר הטלפון של האורח אינו תקין.", f"{f}.phone", "guest_phone")
            if email and not _EMAIL.match(email):
                raise model.Invalid("כתובת הדוא״ל של האורח אינה תקינה.", f"{f}.email", "guest_email")
            if not phone and not email:
                raise model.Invalid("לאורח צריך טלפון או דוא״ל.", f"{f}.phone", "guest_contact_required")
            out.append({"kind": "guest", "role": role, "name": name, "phone": phone, "email": email})
            continue
        if set(it) - {"kind", "role", "ref_id"}:
            raise model.Invalid(f"{f}: kind, role, ref_id", f)
        ref = it.get("ref_id")
        row = _user_row(conn, ref) if kind == "user" else _resident_row(conn, ref)
        if row is None:
            raise model.Invalid("המוזמן לא נמצא.", f"{f}.ref_id", "attendee_not_found")
        if (kind, ref) in seen:
            raise model.Invalid("המוזמן מופיע פעמיים.", f"{f}.ref_id", "attendee_duplicate")
        seen.add((kind, ref))
        out.append({"kind": kind, "role": role, "ref_id": ref})
    return out


def _is_self(item: dict[str, Any], st: Seat) -> bool:
    uid = st.ctx.principal.user_id
    if item["kind"] == "user":
        return item["ref_id"] == uid
    if item["kind"] == "resident":
        return item["ref_id"] in _resident_ids_of_user(st.ctx.conn, uid)
    return False


def check_create(conn: sqlite3.Connection, cal: sqlite3.Row, items: list[dict[str, Any]]) -> None:
    """Attendees sent with a NEW entry: the creator is its organizer (he holds `book`), so only the calendar's guest mode and limit apply."""
    pol = policy_of(conn, cal["id"])
    if any(i["kind"] == "guest" for i in items) and pol["guests_mode"] == "off":
        raise model.Invalid("היומן לא מאפשר להזמין אורחים.", "attendees", "guests_not_allowed")
    if len(items) > pol["max_attendees"]:
        raise model.Invalid(f"אפשר להזמין עד {pol['max_attendees']} משתתפים ביומן הזה.", "attendees", "too_many_attendees")


def check_add(st: Seat, items: list[dict[str, Any]], now: dt.datetime, *, existing: int | None = None) -> None:
    """Permission, state and the calendar's limits for adding `items` to an existing entry (raises Denied / Invalid / 409)."""
    if not items:
        return
    if st.ev["state"] not in OPEN_STATES:
        raise ApiError(409, "bad_state", "אי אפשר לשנות מוזמנים לאירוע במצב הזה.", details={"state": st.ev["state"]})
    if not st.ev["rrule"] and model.parse_utc(st.ev["ends_at"], "e") <= now:
        raise model.Invalid("האירוע כבר הסתיים.", "attendees", "past_immutable")
    mode = st.policy["guests_mode"]
    joins_now = any(_is_self(i, st) for i in items)
    for it in items:
        if it["kind"] == "guest":
            if mode == "off":
                raise model.Invalid("היומן לא מאפשר להזמין אורחים.", "attendees", "guests_not_allowed")
            if not (st.manages or (mode == "anyone" and (st.attendee or (joins_now and st.policy["self_join"])))):
                raise Denied("calendar.attendees", st.cal["id"], "guests")
            continue
        if st.manages:
            continue
        if not _is_self(it, st):
            raise Denied("calendar.attendees", st.cal["id"], "organizer")  # a resident adds only himself
        if not st.policy["self_join"] or st.level == "busy":
            raise Denied("calendar.attendees", st.cal["id"], "self_join")
    total = (count(st.ctx.conn, st.root_id) if existing is None else existing) + len(items)
    if total > st.policy["max_attendees"]:
        raise model.Invalid(f"אפשר להזמין עד {st.policy['max_attendees']} משתתפים ביומן הזה.", "attendees", "too_many_attendees")


def check_open(st: Seat) -> None:
    if st.ev["state"] not in OPEN_STATES:
        raise ApiError(409, "bad_state", "אי אפשר לשנות מוזמנים לאירוע במצב הזה.", details={"state": st.ev["state"]})


# ---------------------------------------------------------------- writes

def _erase_after(conn: sqlite3.Connection, root_id: str, now: dt.datetime) -> str:
    cal_settings = model.read_settings(conn)
    ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (root_id,)).fetchone()
    base = guests._base_end(ev, cal_settings, now) if ev is not None else now
    return guests.erase_after_for(cal_settings, base)


def insert(ctx: Ctx, root_id: str, items: list[dict[str, Any]], now: dt.datetime) -> list[str]:
    """Inserts the attendees that are not on the entry yet (an existing user / resident is skipped, never doubled). Returns the new ids."""
    conn, stamp = ctx.conn, model.iso(now)
    ids: list[str] = []
    for it in items:
        if it["kind"] != "guest" and conn.execute("SELECT 1 FROM cal_attendees WHERE event_id = ? AND kind = ? AND ref_id = ? AND removed_at IS NULL",
                                                  (root_id, it["kind"], it["ref_id"])).fetchone():
            continue
        aid = new_id("att")
        if it["kind"] == "guest":
            dd = ctx.data_dir
            conn.execute(
                """INSERT INTO cal_attendees(id, event_id, kind, ref_id, name_sealed, phone_sealed, email_sealed, has_phone, has_email, role, added_by, added_at, erase_after)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (aid, root_id, "guest", None, cs.seal_calendar_attendee(dd, aid, "name", it["name"]),
                 cs.seal_calendar_attendee(dd, aid, "phone", it["phone"]) if it["phone"] else None,
                 cs.seal_calendar_attendee(dd, aid, "email", it["email"]) if it["email"] else None,
                 int(bool(it["phone"])), int(bool(it["email"])), it["role"], ctx.principal.user_id, stamp, _erase_after(conn, root_id, now)))
        else:
            status = "accepted" if it["kind"] == "user" and it["ref_id"] == ctx.principal.user_id else "invited"  # joining yourself is a yes
            conn.execute("INSERT INTO cal_attendees(id, event_id, kind, ref_id, role, invite_status, added_by, added_at, responded_at) VALUES (?,?,?,?,?,?,?,?,?)",
                         (aid, root_id, it["kind"], it["ref_id"], it["role"], status, ctx.principal.user_id, stamp, stamp if status == "accepted" else None))
        ids.append(aid)
    return ids


def row(conn: sqlite3.Connection, root_id: str, aid: str) -> sqlite3.Row:
    r = conn.execute("SELECT * FROM cal_attendees WHERE id = ? AND event_id = ? AND removed_at IS NULL", (aid, root_id)).fetchone()
    if r is None:
        raise ApiError(404, "not_found", "המוזמן לא נמצא.")
    return r


def check_remove(st: Seat, r: sqlite3.Row) -> None:
    if st.manages:
        return
    own = any(m["id"] == r["id"] for m in st.my_rows)
    if own or (r["kind"] == "guest" and r["added_by"] == st.ctx.principal.user_id):
        return
    raise Denied("calendar.attendees", st.cal["id"], "organizer")


def remove(conn: sqlite3.Connection, r: sqlite3.Row, who: str, now: dt.datetime) -> None:
    conn.execute("UPDATE cal_attendees SET removed_at = ?, removed_by = ?, revision = revision + 1 WHERE id = ?", (model.iso(now), who, r["id"]))


def set_role(conn: sqlite3.Connection, r: sqlite3.Row, role: Any) -> str:
    role = model._choice(role, "role", ROLES)
    conn.execute("UPDATE cal_attendees SET role = ?, revision = revision + 1 WHERE id = ?", (role, r["id"]))
    return role


def respond(conn: sqlite3.Connection, rows: list[sqlite3.Row], status: Any, now: dt.datetime) -> str:
    status = model._choice(status, "status", RESPONSES)
    for r in rows:
        conn.execute("UPDATE cal_attendees SET invite_status = ?, responded_at = ?, revision = revision + 1 WHERE id = ?", (status, model.iso(now), r["id"]))
    return status


def desired_diff(conn: sqlite3.Connection, root_id: str, items: list[dict[str, Any]], keep_ids: set[str]) -> tuple[list[dict[str, Any]], list[sqlite3.Row], list[tuple[sqlite3.Row, str]]]:
    """A full desired list (the editable drawer's PATCH): (to add, to remove, role changes). Existing guests are named by `id` in `keep_ids`
    (a guest cannot be matched by contact - the drawer never holds it); users / residents match by reference."""
    cur = live(conn, root_id)
    by_ref = {(r["kind"], r["ref_id"]): r for r in cur if r["kind"] != "guest"}
    want_refs = {(i["kind"], i["ref_id"]): i for i in items if i["kind"] != "guest"}
    add = [i for k, i in want_refs.items() if k not in by_ref] + [i for i in items if i["kind"] == "guest"]
    drop = [r for r in cur if (r["kind"] == "guest" and r["id"] not in keep_ids) or (r["kind"] != "guest" and (r["kind"], r["ref_id"]) not in want_refs)]
    roles = [(by_ref[k], i["role"]) for k, i in want_refs.items() if k in by_ref and by_ref[k]["role"] != i["role"]]
    return add, drop, roles


# ---------------------------------------------------------------- reading (privacy)

def _name(conn: sqlite3.Connection, data_dir: Any, r: sqlite3.Row) -> str:
    if r["kind"] == "user":
        u = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (r["ref_id"],)).fetchone()
        return (u["display_name"] or u["username"]) if u else ""
    if r["kind"] == "resident":
        try:
            c = conn.execute("SELECT display_name FROM ticket_contacts WHERE id = ?", (r["ref_id"],)).fetchone()
        except sqlite3.Error:
            c = None
        return c["display_name"] if c else ""
    if r["erased_at"] or not r["name_sealed"]:
        return "אורח"
    try:
        return cs.open_calendar_attendee(data_dir, r["id"], "name", r["name_sealed"])
    except cs.SecretError:
        return "אורח"


def guest_contact(data_dir: Any, r: sqlite3.Row) -> dict[str, str]:
    """The guest's phone and e-mail - for the sender and for the organizer / managers ONLY."""
    out = {"phone": "", "email": ""}
    if r["kind"] != "guest" or r["erased_at"]:
        return out
    for f in ("phone", "email"):
        blob = r[f"{f}_sealed"]
        if blob:
            try:
                out[f] = cs.open_calendar_attendee(data_dir, r["id"], f, blob)
            except cs.SecretError:
                out[f] = ""
    return out


def item(conn: sqlite3.Connection, data_dir: Any, r: sqlite3.Row, *, contacts: bool, me: set[str], notices: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {"id": r["id"], "kind": r["kind"], "ref_id": r["ref_id"] if r["kind"] != "guest" else None, "name": _name(conn, data_dir, r), "role": r["role"],
                           "status": r["invite_status"], "notified": bool(r["notified_at"]), "you": r["id"] in me}
    if contacts:
        if r["kind"] == "guest":
            out["contact"] = guest_contact(data_dir, r)
        out["added_by_you"] = False
        if notices is not None:
            out["last_notice"] = notices.get(r["id"])  # {kind, state, channel, reason} - never an address
    return out


def view(ctx: Ctx, eid: str) -> dict[str, Any]:
    st = seat(ctx, eid)
    conn = ctx.conn
    if st.level == "busy" and not st.attendee:
        return {"event_id": st.root_id, "count": None, "list_visible": False, "attendees": [], "me": None, "can": _can(st), "policy": _public_policy(st)}
    rows = live(conn, st.root_id)
    me = {r["id"] for r in st.my_rows}
    visible = st.list_visible()
    notices = last_notices(conn, st.root_id) if st.manages else None
    shown = rows if visible else [r for r in rows if r["id"] in me]
    items = [item(conn, ctx.data_dir, r, contacts=st.manages, me=me, notices=notices) for r in shown]
    if st.manages:
        for it, r in zip(items, shown):
            it["added_by_you"] = r["added_by"] == ctx.principal.user_id
    elif st.policy["guests_mode"] == "anyone":  # a resident sees the guests he added (names only) so he can take them off again
        mine = [r for r in rows if r["kind"] == "guest" and r["added_by"] == ctx.principal.user_id and r["id"] not in {x["id"] for x in shown}]
        items += [item(conn, ctx.data_dir, r, contacts=False, me=me) | {"added_by_you": True} for r in mine]
    mine_row = st.my_rows[0] if st.my_rows else None
    return {"event_id": st.root_id, "count": len(rows), "list_visible": visible, "attendees": items,
            "me": {"id": mine_row["id"], "status": mine_row["invite_status"], "role": mine_row["role"]} if mine_row else None,
            "can": _can(st), "policy": _public_policy(st)}


def _can(st: Seat) -> dict[str, bool]:
    open_ = st.ev["state"] in OPEN_STATES
    return {"manage": st.manages and open_, "join": st.can_join(), "add_guest": st.can_add_guest(), "respond": st.attendee and open_, "leave": st.attendee and open_,
            "contacts": st.manages}


def _public_policy(st: Seat) -> dict[str, Any]:
    p = st.policy
    return {"guests_mode": p["guests_mode"], "self_join": p["self_join"], "max_attendees": p["max_attendees"]}


def last_notices(conn: sqlite3.Connection, root_id: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for r in conn.execute("SELECT attendee_id, kind, state, channel, reason FROM cal_attendee_notices WHERE event_id = ? ORDER BY created_at, rowid", (root_id,)).fetchall():
        out[r["attendee_id"]] = {"kind": r["kind"], "state": r["state"], "channel": r["channel"], "reason": r["reason"]}
    return out


# ---------------------------------------------------------------- the picker's directory

def directory(ctx: Ctx, q: str, *, residents: bool, limit: int = 20) -> list[dict[str, Any]]:
    """Users (and, for organizers who may see the people directory, residents) whose name matches `q`. Names only - never a phone or e-mail.
    A resident linked to an Arx account is listed once, as the user."""
    conn = ctx.conn
    q = (q or "").strip()
    if not q or len(q) > 60:
        return []
    like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    out: list[dict[str, Any]] = []
    for r in conn.execute("""SELECT id, display_name, username FROM users WHERE active = 1 AND deleted_at IS NULL AND id NOT LIKE 'system:%'
                             AND (display_name LIKE ? ESCAPE '\\' OR username LIKE ? ESCAPE '\\') ORDER BY display_name, username LIMIT ?""", (like, like, limit)).fetchall():
        out.append({"kind": "user", "ref_id": r["id"], "name": r["display_name"] or r["username"]})
    if residents and len(out) < limit:
        linked = {o["ref_id"] for o in out}
        try:
            rows = conn.execute("""SELECT id, display_name, user_id FROM ticket_contacts WHERE kind = 'person' AND active = 1 AND erased_at IS NULL
                                   AND display_name LIKE ? ESCAPE '\\' ORDER BY display_name LIMIT ?""", (like, limit)).fetchall()
        except sqlite3.Error:
            rows = []
        for r in rows:
            if r["user_id"]:  # linked to an Arx account: offered as that user (once), so the in-app channel and the RSVP follow the account
                if r["user_id"] not in linked and _user_row(conn, r["user_id"]) is not None:
                    linked.add(r["user_id"])
                    out.append({"kind": "user", "ref_id": r["user_id"], "name": r["display_name"]})
                continue
            out.append({"kind": "resident", "ref_id": r["id"], "name": r["display_name"]})
            if len(out) >= limit:
                break
    return out


def may_search_residents(ctx: Ctx) -> bool:
    from ...rbac import permissions_anywhere  # noqa: PLC0415

    held = set(permissions_anywhere(ctx.conn, ctx.principal))
    return ctx.admin or bool({model.PERM_BOOK_FOR_OTHERS, model.PERM_MANAGE} & held)


__all__ = ["Seat", "seat", "view", "validate_items", "check_create", "check_add", "check_open", "insert", "remove", "check_remove", "set_role", "respond", "desired_diff", "directory",
           "read_settings", "settings_doc", "write_settings", "policy_of", "policy_values", "save_policy", "scope_of"]
