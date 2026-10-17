"""CR-038 section 14.1: the `tickets.settings` document (JSON in the `settings` table, revision-checked, edited with
`system.configure`). NOT in routers/settings.DEFAULTS (so `GET /settings`, readable by every signed-in user, never carries it) and
kept out of project backups (backup.SETTINGS_KEEP).

Slice 1 owns the keys it uses - the display settings D18 (how a ticket opens) and D22 (how "new" opens). Each later slice adds its
own block to SCHEMA (links, send hours, code, whatsapp, costs, device_long_press, the D19-D21 display keys, retention) with its
validator; keys this version does not know are kept as stored (a newer document survives an older reader) but never served.
A corrupt or invalid value reads as the default (fail safe)."""
from __future__ import annotations

import copy
import json
import re
import sqlite3
from typing import Any, Callable

SETTING_KEY = "tickets.settings"

# key path -> (default, validator returning the clean value or raising ValueError)
def _choice(*allowed: str) -> Callable[[Any], str]:
    def check(v: Any) -> str:
        if v not in allowed:
            raise ValueError("choice")
        return v

    return check


def int_range(lo: int, hi: int) -> Callable[[Any], int]:
    def check(v: Any) -> int:
        if isinstance(v, bool) or not isinstance(v, int):
            raise ValueError("integer")
        if not lo <= v <= hi:
            raise ValueError("range")
        return v

    return check


def int_choice(*allowed: int) -> Callable[[Any], int]:
    def check(v: Any) -> int:
        if isinstance(v, bool) or not isinstance(v, int) or v not in allowed:
            raise ValueError("choice")
        return v

    return check


def boolean(v: Any) -> bool:
    if not isinstance(v, bool):
        raise ValueError("boolean")
    return v


_HHMM = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")


def send_hours(v: Any) -> dict[str, str]:
    """D4 / 14.1: a local-time window `{"from": "HH:MM", "to": "HH:MM"}`, every day, in the installation's time zone. `from` must be
    earlier than `to`: a window across midnight is refused in release 1, and `from == to` (an empty window) too."""
    if not isinstance(v, dict) or set(v) != {"from", "to"}:
        raise ValueError("shape")
    a, b = v["from"], v["to"]
    if not isinstance(a, str) or not isinstance(b, str) or not _HHMM.match(a) or not _HHMM.match(b):
        raise ValueError("time")
    if a >= b:
        raise ValueError("order")
    return {"from": a, "to": b}


def _org_name(v: Any) -> str:
    """Slice 4: the organisation name the handler page shows at the top - plain text, controls / bidi marks stripped."""
    from .text_hygiene import clean_text

    if not isinstance(v, str):
        raise ValueError("type")
    text = clean_text(v)
    if len(text) > 80 or "{" in text or "}" in text:
        raise ValueError("invalid")
    return text


def _logo_stamp(v: Any) -> str:
    """VPORTAL: the logo's stamp (16 lowercase hex characters of its SHA-256) or "" for none (services/tickets/brand.py)."""
    if v == "":
        return ""
    if not isinstance(v, str) or re.fullmatch(r"[0-9a-f]{16}", v) is None:
        raise ValueError("invalid")
    return v


def _base_url(v: Any) -> str:
    """Slice 4: the public address of the handler page (`https://<host>` with an optional single path prefix such as `/support`, spec 14.1); empty = not configured."""
    from .links import PublicUrlError, validate_public_base_url

    if v == "":
        return ""
    try:
        return validate_public_base_url(v)
    except PublicUrlError as exc:
        raise ValueError(exc.code) from None


def _path_prefix(v: Any) -> str:
    """TK255: the one path segment the public listener serves itself under (`support` -> `https://host/support/...`); `t` keeps the
    old `/t/...` form. Single segment, [a-z0-9_-], at most 32, no reserved word (public_prefix.validate_prefix)."""
    from .public_prefix import validate_prefix

    return validate_prefix(v)


def _cidrs(v: Any) -> list[str]:
    """Slice 4: the peers whose client-address header is believed (spec 10.2, review T1a); at most 8, none broader than /8."""
    from .ratelimit import parse_trusted_cidrs

    if not isinstance(v, list) or len(v) > 8 or not all(isinstance(x, str) and 0 < len(x) <= 64 for x in v):
        raise ValueError("invalid")
    nets = parse_trusted_cidrs(v)
    if len(nets) != len(v):
        raise ValueError("invalid")
    return [str(n) for n in nets]


def _currencies(v: Any) -> list[str]:
    """Slice 9 (11A.2 / 11A.14): the claim currencies, ISO 4217 codes from money.CURRENCIES (all with two minor digits); the
    first is the default, 1-5 codes, no repeat."""
    from .money import CURRENCIES

    if not isinstance(v, list) or not 1 <= len(v) <= 5 or not all(isinstance(x, str) and x in CURRENCIES for x in v) or len(set(v)) != len(v):
        raise ValueError("invalid")
    return list(v)


def line_kinds(v: Any) -> list[str]:
    """TKDETAILBE (owner 15.10): the cost line kinds a vendor may use - a subset of money.LINE_KINDS that always holds `labor`,
    no repeat, returned in the canonical order."""
    from .money import LINE_KINDS

    if not isinstance(v, list) or not v or not all(isinstance(x, str) and x in LINE_KINDS for x in v) or len(set(v)) != len(v):
        raise ValueError("invalid")
    if "labor" not in v:
        raise ValueError("labor_required")
    return [k for k in LINE_KINDS if k in v]

_DEPT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$")
BUSY_MAP_MAX = 200


def busy_map(v: Any) -> dict[str, int]:
    """MGRDASH: the per-department "busy" thresholds - {department id: 1..99}, at most BUSY_MAP_MAX entries, ids in the shape of the
    department ids (a key of a department that no longer exists is harmless: nobody reads it)."""
    if not isinstance(v, dict) or len(v) > BUSY_MAP_MAX:
        raise ValueError("invalid")
    out: dict[str, int] = {}
    check = int_range(1, 99)
    for k, n in v.items():
        if not isinstance(k, str) or not _DEPT_ID.match(k):
            raise ValueError("invalid")
        out[k] = check(n)
    return out


# section 14.1 / D5: link lifetime ranges (shared with the per-department overrides, services/tickets/policy.py)
SLIDING_DAYS = (1, 90)
CAP_DAYS = (7, 365)
GRACE_HOURS = (0, 168)

SCHEMA: dict[tuple[str, ...], tuple[Any, Callable[[Any], Any]]] = {
    ("ui", "detail"): ("drawer_fullscreen", _choice("drawer", "fullscreen", "drawer_fullscreen")),  # D18
    ("ui", "new_ticket"): ("sheet", _choice("sheet", "dialog")),  # D22
    ("ui", "board_floors"): ("tree", _choice("chips", "tree", "chips_tree")),  # D19 / D30 (slice 6)
    ("ui", "grouping"): ("no_status_filter", _choice("always", "no_status_filter", "never")),  # D20 (slice 6)
    ("ui", "closed_strip"): ("all", _choice("week", "all", "hidden")),  # D21 (slice 6)
    # TKUI1 (2.6.0, the v5 request drawer): the tab a request opens on (a deep link's ?tab= still wins), the desktop drawer size (each
    # viewer's own switch wins, kept in the browser) and how the phone sheet opens
    ("ui", "detail_tab"): ("overview", _choice("overview", "conv", "costs", "history")),
    ("ui", "drawer_size"): ("wide", _choice("drawer", "wide", "full")),
    ("ui", "phone_sheet"): ("full", _choice("full", "half")),
    # HANDLERLOAD (owner 2026-10-17): the period of the "handled" number on the handler cards, in days (1 = today, 7, 30); each viewer's
    # own choice (kept in the browser) wins over this installation default
    ("ui", "handled_days"): (7, int_choice(1, 7, 30)),
    # MGRDASH phase 1 (owner decisions 2026-10-17, docs/design/MANAGER_DASHBOARD_SPEC_HE.md): the manager overview's display choices.
    # In `ui` because the screens read them from GET /tickets/module and GET /tickets/board; none of them widens what anybody may see
    # (every number is still counted from the rows the server lets the viewer manage).
    #   dash_handler_numbers  who sees a handler's own numbers: managers only / each handler his own (default) / everyone
    #   dash_vendors          vendors in the load card: in the same list with a tag (default) / a separate list / hidden
    #   dash_busy             the "busy" threshold (open requests in hand) of every department without its own value (default 8)
    #   dash_busy_departments the per-department thresholds {department id: n}
    #   dash_compare          where the department comparison sits for the all-departments manager (default: under the numbers row)
    ("ui", "dash_handler_numbers"): ("own", _choice("managers", "own", "everyone")),
    ("ui", "dash_vendors"): ("tagged", _choice("tagged", "separate", "hidden")),
    ("ui", "dash_busy"): (8, int_range(1, 99)),
    ("ui", "dash_busy_departments"): ({}, busy_map),
    ("ui", "dash_compare"): ("below_numbers", _choice("top", "below_numbers", "bottom")),
    ("device_long_press",): ("sheet", _choice("sheet", "menu")),  # D17 (slice 3): the device window (default) | the short opaque menu
    # slice 2 (CR-038 section 14.1): the installation values the department overrides fall back to
    ("links", "sliding_days"): (14, int_range(*SLIDING_DAYS)),  # D5
    ("links", "cap_days"): (90, int_range(*CAP_DAYS)),  # D5, >= sliding_days (checked across keys below)
    ("links", "grace_hours"): (24, int_range(*GRACE_HOURS)),  # D5
    # TKSTAFF1 (security design R6 / R8, its `links.staff.*`): the no-login STAFF link of an internal employee - shorter than a
    # vendor's (a staff phone is the lost / forwarded case and the employee has the app for anything longer); installation-wide only
    # (no department override). A block of its own so the vendor `links` block keeps its shape for every reader.
    ("staff_links", "sliding_days"): (3, int_range(*SLIDING_DAYS)),
    ("staff_links", "cap_days"): (14, int_range(*CAP_DAYS)),
    ("staff_links", "grace_hours"): (1, int_range(*GRACE_HOURS)),
    ("staff_links", "require_code"): (True, boolean),  # R8: raise only - a staff member's row (require_code) still raises it when off
    ("send_hours",): ({"from": "07:00", "to": "21:00"}, send_hours),  # D4
    ("urgent_is_critical",): (True, boolean),  # D28
    # slice 4: the handler page (section 10 / 14.1)
    ("organization_name",): ("", _org_name),
    ("public", "base_url"): ("", _base_url),
    ("public", "path_prefix"): ("support", _path_prefix),  # TK255: used when the address itself carries no path
    ("public", "legacy_t_paths"): (True, boolean),  # TK255: links already sent as /t/... keep working (turn off once none is live)
    ("public", "trusted_proxy_cidrs"): (["172.30.32.0/23"], _cidrs),
    # slice 7: option B verification codes (section 10.5 / 14.1); the length is fixed at 6 (D2) and is NOT a setting
    ("code", "ttl_min"): (10, int_range(1, 30)),
    ("code", "max_attempts"): (5, int_range(3, 10)),
    ("code", "lock_min"): (30, int_range(5, 240)),
    # where a trusted proxy puts the client address (code review V3): cloudflared's header, or another proxy's X-Forwarded-For
    ("public", "client_ip_header"): ("cf-connecting-ip", _choice("cf-connecting-ip", "x-forwarded-for")),
    # TK259: the handler page's look - light (default), dark, or follow the device; the vendor may still flip it on his own phone
    ("public", "theme"): ("light", _choice("light", "dark", "auto")),
    # slice 5b: the ticket message channel (9.3 / 9.5 / 9.6); the accounts and their pacing live in `messaging.whatsapp` (9.9)
    ("whatsapp", "enabled"): (False, boolean),  # the master switch: OFF until an administrator turns it on
    ("whatsapp", "use_buttons"): (False, boolean),  # 9.3: buttons may show as text only on multi-device clients - numbered replies
    ("whatsapp", "reply_window_h"): (72, int_range(1, 336)),  # 9.6: replies are matched to messages sent within this window
    ("email_fallback",): (True, boolean),  # 9.5 / D13: a contact with an e-mail address gets the redeem link when WhatsApp fails
    # TKNOTIFOTP (owner 2026-10-16): verify every WhatsApp number with a one-time code before links / notifications go to it.
    # OPTIONAL, OFF by default; a contact's own `phone_verify` raises it for that row only (services/tickets/phone_verify.py)
    ("phone_verify", "required"): (False, boolean),
    # CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17): department managers see FULL numbers of the handlers / vendors of their own
    # departments on "מטפלים וספקים". OFF by default (masked: the last four digits); changed with system.configure (system_admin),
    # audited by the settings route. Rows of other departments and rows shared with every department stay masked.
    ("directory", "managers_full_phones"): (False, boolean),
    # VPORTAL (owner-approved 2026-10-16): the vendor portal on the public page (`/support` without a link): a vendor signs in with a
    # one-time WhatsApp code to the number on file and sees their requests read-only (services/tickets/vendor_portal.py). OFF by
    # default (nothing changes on upgrade); `closed_months`: how far back closed requests are listed (default 2)
    ("vendor_portal", "enabled"): (False, boolean),
    ("vendor_portal", "closed_months"): (2, int_range(1, 24)),
    # 2.6.4 review F1 (owner decision 2026-10-17): the portal serves only a number its owner PROVED (confirmed by code, or by the
    # signed-in person themself) - even while `phone_verify.required` is off. ON by default; only the owner (system.configure) may
    # switch it off; allowed from a remote session too (not a key of the public address)
    ("vendor_portal", "require_confirmed_number"): (True, boolean),
    # VPORTAL: the stamp of the organisation's logo on the public pages ("" = none) - written ONLY by the logo routes
    # (services/tickets/brand.py), never by PUT /tickets/settings
    ("brand", "logo"): ("", _logo_stamp),
    # slice 9: cost claims (11A.14, D31 / D32); department and vendor overrides live on their rows (11A.1)
    ("costs", "mode"): ("optional", _choice("required", "optional", "off")),
    ("costs", "currencies"): (["ILS"], _currencies),
    ("costs", "vat_rate_bp"): (1800, int_range(0, 5000)),
    ("costs", "claim_window_days"): (14, int_range(1, 90)),
    ("costs", "require_invoice"): (False, boolean),
    ("costs", "max_claim_total_minor"): (100_000_000, int_range(100, 99_999_999_999)),
    ("costs", "review_flag_above_minor"): (1_000_000, int_range(0, 99_999_999_999)),
    # owner 15.10 evening: an approval never sends a message - the 2.5.x key `costs.notify_vendor_approved` is removed (TKFIX260);
    # a stored value survives as an unknown key and is never served or read
    ("costs", "retention_days"): (2555, int_range(730, 3650)),
    ("costs", "allowed_line_kinds"): (["labor", "parts"], line_kinds),  # TKDETAILBE: request -> department -> this default
    # TKRFQ1 (docs/tickets/RFQ_BACKEND_CONTRACT.md section 13): requests for quotation
    ("rfq", "default_due_days"): (3, int_range(1, 60)),  # the deadline a new request proposes
    ("rfq", "grace_hours"): (24, int_range(0, 168)),  # a closed / cancelled request's vendor links stay read-only this long
    ("rfq", "link_keep_days"): (30, int_range(1, 365)),  # a link lives this long past the deadline; its row goes this long after closing
    ("rfq", "retention_months"): (24, int_range(6, 120)),  # spec 6: quotes that were not selected (and the request) are kept this long
    ("rfq", "reminder_hours"): (24, int_range(0, 168)),  # stage C2's automatic reminder before the deadline; 0 = off
    # CR-RFQ-PAYMENT-SCHEDULE (contract section 20): the vendor's payment schedule + his arrival confirmation. OFF by default, so an
    # upgrade changes nothing; `arrival_reminder_hours` = the reminder when he has not confirmed after being messaged (0 = no reminder)
    ("rfq", "schedule_arrival"): (False, boolean),
    ("rfq", "arrival_reminder_hours"): (24, int_range(0, 168)),
    # RFQPAY2 (owner decision 2026-10-17): hours between two reminders of the same award's overdue instalments while something is still
    # overdue (0 = notify once only; a NEW overdue instalment always notifies)
    ("rfq", "instalment_reminder_hours"): (24, int_range(0, 168)),
    ("rfq", "question_reminder_hours"): (24, int_range(0, 168)),  # RFQQUESTIONS: remind the RFQ managers of a vendor question still unanswered after N hours; 0 = off
    # RFQQSET: off by default - a viewer of all departments who is not a manager of the request also gets the pending-questions count in the navigation
    ("rfq", "question_badge_all_viewers"): (False, boolean),
    # RFQATT review 2.6.4 (owner question 1, decided by the lead 17.10): Word / Excel attachments on a request for quotation - OFF by
    # default until the hardened office checks are verified; PDF and pictures are always allowed (RFQ contract 19.2)
    ("rfq", "attachments", "allow_office"): (False, boolean),
}


def _cross_problem(doc: dict[str, Any]) -> str | None:
    """A rule over several keys: the link cap is never shorter than the sliding window (section 14.1)."""
    links = doc.get("links") or {}
    if links.get("cap_days", 0) < links.get("sliding_days", 0):
        return "links.cap_days:below_sliding"
    staff = doc.get("staff_links") if isinstance(doc.get("staff_links"), dict) else {}
    if staff.get("cap_days", 0) < staff.get("sliding_days", 0):
        return "staff_links.cap_days:below_sliding"
    return None


def _get(doc: dict[str, Any], path: tuple[str, ...]) -> Any:
    cur: Any = doc
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def _set(doc: dict[str, Any], path: tuple[str, ...], value: Any) -> None:
    cur = doc
    for p in path[:-1]:
        nxt = cur.get(p)
        if not isinstance(nxt, dict):
            nxt = {}
            cur[p] = nxt
        cur = nxt
    cur[path[-1]] = value


def _stored(conn: sqlite3.Connection) -> dict[str, Any]:
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (SETTING_KEY,)).fetchone()
    try:
        doc = json.loads(row[0]) if row else {}
    except (ValueError, TypeError):
        doc = {}
    return doc if isinstance(doc, dict) else {}


def read(conn: sqlite3.Connection) -> dict[str, Any]:
    """The known keys with their stored (valid) value or default, and the revision (0 = never saved)."""
    stored = _stored(conn)
    out: dict[str, Any] = {}
    rev = stored.get("revision")
    out["revision"] = rev if isinstance(rev, int) and not isinstance(rev, bool) and rev >= 0 else 0
    refused: str | None = None
    for path, (default, check) in SCHEMA.items():
        raw = _get(stored, path)
        try:
            value = check(raw) if raw is not None else copy.deepcopy(default)
        except ValueError as exc:
            value = copy.deepcopy(default)
            if path == ("public", "base_url"):
                refused = "reserved" if str(exc) == "path_reserved" else (str(exc) or "invalid")
        _set(out, path, value)
    if refused:
        # 2.5.8 review F7: a stored public address that a newer rule refuses (e.g. a path that became a reserved word) reads as "" -
        # fail closed: no link is derived from it - and the reason is served so Settings / readiness can say why the page is off
        out["public"]["base_url_refused"] = refused
    for prefix in (("links",), ("staff_links",)):  # a stored pair that breaks the cross-key rule reads as the default pair (fail safe)
        if _get(out, prefix + ("cap_days",)) < _get(out, prefix + ("sliding_days",)):
            for path in (prefix + ("sliding_days",), prefix + ("cap_days",)):
                _set(out, path, SCHEMA[path][0])
    return out


PIN_MARKER = "tickets.path_prefix_pinned"


def pin_legacy_prefix(conn: sqlite3.Connection) -> bool:
    """TK255 review F2, ONCE per installation (the first start of a build that has this rule): an installation that already runs
    with a public address WITHOUT a path (links `<host>/t/...`) and never saved `public.path_prefix` keeps `t` - the new default
    `support` would silently re-point every new link at a Cloudflare route the owner has not added. The owner moves to `support`
    from the settings card. A fresh installation (no address at that first start) and an address that carries its own path are
    never pinned; the marker makes a later address entry follow the default. Returns whether `t` was pinned."""
    from ...db import get_setting, set_setting
    from .links import PublicUrlError, split_base, validate_public_base_url

    if get_setting(conn, PIN_MARKER):
        return False
    pinned = False
    stored = _stored(conn)
    base = _get(stored, ("public", "base_url"))
    if isinstance(base, str) and base and _get(stored, ("public", "path_prefix")) is None:
        try:
            has_path = bool(split_base(validate_public_base_url(base))[1])
        except PublicUrlError:
            has_path = True  # an address that no longer validates is not a running /t setup
        if not has_path:
            _set(stored, ("public", "path_prefix"), "t")
            set_setting(conn, SETTING_KEY, json.dumps(stored, ensure_ascii=False, separators=(",", ":")))  # no revision bump: not an edit
            pinned = True
    set_setting(conn, PIN_MARKER, "1")
    return pinned


def apply_patch(conn: sqlite3.Connection, patch: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Validate a partial update (nested dicts of known keys) and write it. Returns (the new document, the changed key paths).
    Raises ValueError("unknown:<path>") / ValueError("<path>:<code>")."""
    flat: dict[tuple[str, ...], Any] = {}

    def walk(prefix: tuple[str, ...], node: Any) -> None:
        if isinstance(node, dict) and prefix not in SCHEMA:
            for k, v in node.items():
                walk(prefix + (str(k),), v)
            return
        if prefix not in SCHEMA:
            raise ValueError(f"unknown:{'.'.join(prefix)}")
        flat[prefix] = node

    walk((), patch)
    stored = _stored(conn)
    current = read(conn)
    changed: list[str] = []
    for path, value in flat.items():
        try:
            clean = SCHEMA[path][1](value)
        except ValueError as exc:
            raise ValueError(f"{'.'.join(path)}:{exc}") from None
        if _get(current, path) != clean:
            changed.append(".".join(path))
        _set(stored, path, clean)
        _set(current, path, clean)
    problem = _cross_problem(current)
    if problem:
        raise ValueError(problem)
    stored["revision"] = current["revision"] + 1
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (SETTING_KEY, json.dumps(stored, ensure_ascii=False, separators=(",", ":"))))
    return read(conn), changed
