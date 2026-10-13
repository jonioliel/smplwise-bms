"""CR-038: the ticket model - statuses, the state machine of section 11.2 (who may make which move), the waiting flags, text
hygiene (review T9) and field limits. Pure functions, no SQL: unit-testable row by row."""
from __future__ import annotations

import datetime as dt
import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

STATUSES: tuple[str, ...] = ("new", "assigned", "acknowledged", "in_progress", "waiting_part", "done", "returned", "closed", "cancelled")
FINAL = frozenset({"closed", "cancelled"})
OPEN = frozenset(STATUSES) - FINAL
# an assignee holds the ticket in these (the "open assigned states")
HANDLING = frozenset({"assigned", "acknowledged", "in_progress", "waiting_part"})
# a manager may (re)assign from these; `closed` is a reopen with an assignment (within the department's reopen window)
ASSIGN_FROM = frozenset({"new", "returned", "done", "closed"}) | HANDLING
RETURN_FROM = HANDLING
RETURN_KINDS = ("cannot_handle", "not_mine")

Actor = Literal["manager", "assignee", "link", "inbound", "system"]
ACTORS: tuple[Actor, ...] = ("manager", "assignee", "link", "inbound", "system")

_ASSIGNEE_MOVES = frozenset({
    ("assigned", "acknowledged"),
    ("assigned", "in_progress"), ("acknowledged", "in_progress"), ("waiting_part", "in_progress"),
    ("acknowledged", "waiting_part"), ("in_progress", "waiting_part"),
    ("acknowledged", "done"), ("in_progress", "done"), ("waiting_part", "done"),
})

# POST /tickets/{id}/status: the (from, to) moves each actor may make (section 11.2). Assignment, return and the reopen with an
# assignment have routes of their own (ASSIGN_FROM, RETURN_FROM above); the table below is the status line itself.
STATUS_MOVES: dict[str, frozenset[tuple[str, str]]] = {
    "manager": _ASSIGNEE_MOVES  # a manager may act on behalf of the assignee (noted on the timeline)
    | frozenset({("done", "closed"), ("done", "in_progress")})
    | frozenset((s, "closed") for s in OPEN if s != "done")  # close without "done": a note is required
    | frozenset((s, "cancelled") for s in OPEN)  # cancel (duplicate or mistaken): a reason is required
    | frozenset({("closed", "new")}),  # reopen within the department's reopen window
    "assignee": _ASSIGNEE_MOVES,  # the current internal assignee
    "link": _ASSIGNEE_MOVES,  # the external assignee through a handler link (slice 4)
    "inbound": frozenset({("assigned", "acknowledged"), ("assigned", "in_progress"), ("acknowledged", "in_progress")}),  # advisory only
    "system": frozenset({("done", "closed")}),  # the department's automatic close after N days (slice 6)
}

NOTE_MAX = 2000
TITLE_MAX = 120
DESCRIPTION_MAX = 4000
REASON_MAX = 500
ETA_HORIZON_DAYS = 90
CLIENT_REQUEST_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$")


def may_move(actor: str, frm: str, to: str) -> bool:
    return (frm, to) in STATUS_MOVES.get(actor, frozenset())


def note_required(frm: str, to: str) -> bool:
    """A manager's move that needs a written reason: closing without "done", cancelling, sending "done" back to handling."""
    if to == "cancelled":
        return True
    if to == "closed" and frm != "done":
        return True
    return frm == "done" and to == "in_progress"


def waiting_for(status: str, return_kind: str | None = None) -> tuple[str, str | None]:
    """(waiting_on, waiting_reason) that follow from a status (section 3, "waiting for manager")."""
    if status == "new":
        return "manager", "unassigned"
    if status in HANDLING:
        return "assignee", None
    if status == "done":
        return "manager", "done"
    if status == "returned":
        return "manager", "not_mine" if return_kind == "not_mine" else "returned"
    return "none", None


# ---------------------------------------------------------------- text hygiene (review T9)

def clean_text(value: object, *, multiline: bool = False) -> str:
    """Strip every Unicode control (Cc) and format (Cf) character - bidi overrides, zero-width joiners, LRM / RLM - and lone
    surrogates. A multi-line field keeps its line feeds (CR / CRLF become LF; a tab becomes a space); a single-line field
    collapses all whitespace to single spaces. The text is rendered as text only (never HTML, never auto-linked)."""
    if value is None:
        return ""
    s = str(value)
    if multiline:
        s = s.replace("\r\n", "\n").replace("\r", "\n")
    out: list[str] = []
    for ch in s:
        if multiline and ch == "\n":
            out.append(ch)
            continue
        if ch == "\t":
            out.append(" ")
            continue
        if unicodedata.category(ch) in ("Cc", "Cf", "Cs"):
            continue
        out.append(ch)
    text = "".join(out)
    if multiline:
        lines = [ln.rstrip() for ln in text.split("\n")]
        text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines))
        return text.strip()
    return " ".join(text.split())


@dataclass(frozen=True)
class Problem:
    field: str
    code: str


class Invalid(Exception):
    """One or more field problems (the router answers 422 `validation` with `details.fields`)."""

    def __init__(self, problems: list[Problem]):
        super().__init__(", ".join(f"{p.field}:{p.code}" for p in problems))
        self.problems = problems


def text_field(value: object, field: str, *, required: bool, max_len: int, multiline: bool = False) -> str:
    text = clean_text(value, multiline=multiline)
    if required and not text:
        raise Invalid([Problem(field, "required")])
    if len(text) > max_len:
        raise Invalid([Problem(field, "too_long")])
    return text


def parse_eta(value: str | None, now: dt.datetime | None = None) -> str | None:
    """An ETA is a UTC instant (`...Z`), not in the past (5 minutes of clock skew allowed) and within 90 days."""
    if value is None or value == "":
        return None
    from ..timeutil import parse_utc

    try:
        at = parse_utc(value)
    except ValueError:
        raise Invalid([Problem("eta_at", "format")]) from None
    now = now or dt.datetime.now(dt.timezone.utc)
    if at < now - dt.timedelta(minutes=5):
        raise Invalid([Problem("eta_at", "past")])
    if at > now + dt.timedelta(days=ETA_HORIZON_DAYS):
        raise Invalid([Problem("eta_at", "too_far")])
    return at.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
