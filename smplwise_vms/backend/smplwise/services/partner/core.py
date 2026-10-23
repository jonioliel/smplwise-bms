"""PARTNERAPI113-295 core: settings, the closed scope list, partners (clients), tokens and the restriction rules.

Token (CR section 4): `arxp_` + 43 base64url characters (256 random bits). Only SHA-256(token) is stored; the plaintext is returned once,
by the creating (or rotating) call. A visible id `ptk_` + 16 hex names the token everywhere else. Expiry is mandatory (owner answer 169:
default 90 days, maximum 365, both editable in Settings). The token belongs to the installation (answer 170): it survives its creator, and
the managers are told when the creator is gone. Nothing here logs or audits a token, a hash or a secret."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import ipaddress
import json
import re
import secrets
import sqlite3
import threading
from dataclasses import dataclass, field
from typing import Any, Iterable

from ...audit import audit
from ...db import get_setting, set_setting
from ...rbac import INSTALLATION, Principal, authorize

# ---------------------------------------------------------------- go-live and switches

# Owner answer 171 (CR Q8): no partner switch may be turned ON in this build. Tests patch it; a release that permits activation changes
# this constant after the security review of the public surface and the owner's written approval of the first real destination.
GO_LIVE_PERMITTED = False

API_KEY = "partner.api"
WEBHOOKS_KEY = "partner.webhooks"
SWITCH_KEYS = (API_KEY, WEBHOOKS_KEY)

# every threshold is editable in Settings (standing rule of the owner's answers): key -> (default, low, high)
NUMERIC: dict[str, tuple[int, int, int]] = {
    "partner.token_default_days": (90, 1, 365),
    "partner.token_max_days": (365, 1, 365),
    "partner.max_endpoints": (10, 1, 10),
    "partner.rate_per_min": (60, 1, 600),
    "partner.rate_per_hour": (2000, 1, 20000),
    "partner.create_per_hour": (30, 1, 1000),
    "partner.create_per_day": (200, 1, 5000),
    "partner.expiry_notice_days": (14, 0, 60),
    "partner.rotation_overlap_hours": (24, 0, 168),
}

# ---------------------------------------------------------------- the closed lists

SCOPES: tuple[str, ...] = ("tickets.read", "tickets.create", "temperature.read", "elevators.read")
RESERVED_SCOPES: tuple[str, ...] = ("webhooks.self",)  # reserved by the record, not built in this slice: refused at creation
# never a scope (CR 4.2; the task: no door / device control in this slice) - listed so a test proves each one is refused
NEVER_SCOPES: tuple[str, ...] = (
    "doors.open", "doors.read", "access.read", "access.doors.open", "alarm.read", "alarm.disarm", "cameras.read", "video.live",
    "video.playback", "recordings.read", "events.read", "wiskey.read", "devices.control", "devices.read", "scenes.run", "scripts.run",
    "automations.run", "users.read", "roles.read", "audit.read", "settings.read", "settings.write", "backup.read", "energy.bills.read",
    "generator.control", "ha.call", "ha.entity.control", "tickets.manage", "tickets.write", "*", "admin",
)
# the permission of a person that a scope maps to (the creator must hold it on the whole restriction - CR 4.3)
SCOPE_PERMISSION: dict[str, str] = {
    "tickets.read": "tickets.view", "tickets.create": "tickets.create", "temperature.read": "devices.read", "elevators.read": "devices.read",
}
RESTRICTION_KINDS = ("installation", "site", "building", "floor")
RESTRICTION_MAX_IDS = 50
SOURCE_CIDRS_MAX = 10
LABEL_MAX = 80
# owner answer 167: title and description are sent by default; people's names are an option, default off
PERSONAL_DEFAULTS: dict[str, bool] = {"ticket_text": True, "ticket_people": False}

TOKEN_PREFIX = "arxp_"
TOKEN_RE = re.compile(r"arxp_[A-Za-z0-9_-]{43}")
ID_RE = {"pcl": re.compile(r"pcl_[0-9a-f]{16}"), "ptk": re.compile(r"ptk_[0-9a-f]{16}"), "pep": re.compile(r"pep_[0-9a-f]{16}"),
         "evt": re.compile(r"evt_[0-9a-f]{16}")}
PURGE_ENDED_DAYS = 90


class PartnerError(Exception):
    """A refusal of the management API: HTTP status, a code from a fixed vocabulary, optional field."""

    def __init__(self, status: int, code: str, field: str | None = None) -> None:
        super().__init__(code)
        self.status, self.code, self.field = status, code, field


# ---------------------------------------------------------------- small helpers

def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso(at: dt.datetime) -> str:
    return at.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    except ValueError:
        return None


def new_ident(kind: str) -> str:
    return f"{kind}_{secrets.token_hex(8)}"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def parse_token(value: str | None) -> str | None:
    """The token of an `Authorization: Bearer arxp_...` value, strictly shaped, or None."""
    if not isinstance(value, str):
        return None
    scheme, _, rest = value.strip().partition(" ")
    if scheme.lower() != "bearer":
        return None
    rest = rest.strip()
    return rest if TOKEN_RE.fullmatch(rest) else None


def clean_label(value: Any, field_name: str = "label", required: bool = True) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise PartnerError(422, "invalid", field_name)
    text = " ".join(value.split())
    if any(ord(c) < 32 or ord(c) == 127 for c in text) or len(text) > LABEL_MAX or (required and not text):
        raise PartnerError(422, "invalid", field_name)
    return text


# ---------------------------------------------------------------- settings

def switch_on(conn: sqlite3.Connection, key: str) -> bool:
    return (get_setting(conn, key, "off") or "off") == "on" and GO_LIVE_PERMITTED


def stored_switch(conn: sqlite3.Connection, key: str) -> str:
    return "on" if (get_setting(conn, key, "off") or "off") == "on" else "off"


def number(conn: sqlite3.Connection, key: str) -> int:
    default, lo, hi = NUMERIC[key]
    try:
        value = int(get_setting(conn, key, str(default)) or default)
    except (TypeError, ValueError):
        return default
    return value if lo <= value <= hi else default


def settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {
        "api": stored_switch(conn, API_KEY) == "on", "webhooks": stored_switch(conn, WEBHOOKS_KEY) == "on",
        "api_active": switch_on(conn, API_KEY), "webhooks_active": switch_on(conn, WEBHOOKS_KEY),
        "go_live_permitted": GO_LIVE_PERMITTED,
        "values": {k.split(".", 1)[1]: number(conn, k) for k in NUMERIC},
        "ranges": {k.split(".", 1)[1]: [lo, hi] for k, (_d, lo, hi) in NUMERIC.items()},
        "scopes": list(SCOPES), "restriction_kinds": list(RESTRICTION_KINDS),
    }


def set_number(conn: sqlite3.Connection, short: str, value: Any) -> tuple[int, int] | None:
    key = f"partner.{short}"
    if key not in NUMERIC or isinstance(value, bool) or not isinstance(value, int):
        raise PartnerError(422, "invalid", short)
    _d, lo, hi = NUMERIC[key]
    if not lo <= value <= hi:
        raise PartnerError(422, "out_of_range", short)
    before = number(conn, key)
    if key == "partner.token_default_days" and value > number(conn, "partner.token_max_days"):
        raise PartnerError(422, "out_of_range", short)
    if key == "partner.token_max_days" and value < number(conn, "partner.token_default_days"):
        raise PartnerError(422, "out_of_range", short)
    if before == value:
        return None
    set_setting(conn, key, str(value))
    return before, value


# ---------------------------------------------------------------- the installation binding

def installation_id(conn: sqlite3.Connection) -> str:
    from .. import bundle

    return bundle.installation_id(conn, create=True) or ""


# ---------------------------------------------------------------- restrictions

def _ids(value: Any, field_name: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > RESTRICTION_MAX_IDS or not all(isinstance(v, str) and 0 < len(v) <= 64 for v in value):
        raise PartnerError(422, "invalid", field_name)
    return list(dict.fromkeys(value))


def validate_restriction(conn: sqlite3.Connection, kind: Any, ids: Any) -> tuple[str, list[str]]:
    if kind not in RESTRICTION_KINDS:
        raise PartnerError(422, "invalid", "restriction_kind")
    clean = _ids(ids, "restriction_ids")
    if kind == "installation":
        if clean:
            raise PartnerError(422, "invalid", "restriction_ids")
        return kind, []
    if not clean:
        raise PartnerError(422, "invalid", "restriction_ids")
    table = {"site": "sites", "building": "buildings", "floor": "floors"}[kind]
    marks = ",".join("?" * len(clean))
    found = {r[0] for r in conn.execute(f"SELECT id FROM {table} WHERE deleted_at IS NULL AND id IN ({marks})", clean).fetchall()}
    if found != set(clean):
        raise PartnerError(422, "unknown", "restriction_ids")
    return kind, clean


@dataclass(frozen=True)
class Reach:
    """What a restriction covers: everything (`wide`), else the live floors / buildings / sites under it."""

    wide: bool
    floors: frozenset[str] = frozenset()
    buildings: frozenset[str] = frozenset()
    sites: frozenset[str] = frozenset()

    def covers_place(self, site_id: str | None, building_id: str | None, floor_id: str | None) -> bool:
        if self.wide:
            return True
        return bool((floor_id and floor_id in self.floors) or (building_id and building_id in self.buildings and not self.floors_only)
                    or (site_id and site_id in self.sites and not self.floors_only and not self.buildings_only))

    floors_only: bool = False
    buildings_only: bool = False


def reach_of(conn: sqlite3.Connection, kind: str, ids: Iterable[str]) -> Reach:
    ids = [i for i in ids if isinstance(i, str)]
    if kind == "installation":
        return Reach(True)
    if not ids:
        return Reach(False)
    marks = ",".join("?" * len(ids))
    if kind == "site":
        rows = conn.execute(f"""SELECT f.id AS fid, b.id AS bid, b.site_id AS sid FROM buildings b LEFT JOIN floors f ON f.building_id = b.id AND f.deleted_at IS NULL
                                WHERE b.deleted_at IS NULL AND b.site_id IN ({marks})""", ids).fetchall()
        live_sites = {r[0] for r in conn.execute(f"SELECT id FROM sites WHERE deleted_at IS NULL AND id IN ({marks})", ids).fetchall()}
        return Reach(False, frozenset(r["fid"] for r in rows if r["fid"] and r["sid"] in live_sites),
                     frozenset(r["bid"] for r in rows if r["sid"] in live_sites), frozenset(live_sites))
    if kind == "building":
        rows = conn.execute(f"""SELECT f.id AS fid, b.id AS bid FROM buildings b LEFT JOIN floors f ON f.building_id = b.id AND f.deleted_at IS NULL
                                WHERE b.deleted_at IS NULL AND b.id IN ({marks})""", ids).fetchall()
        return Reach(False, frozenset(r["fid"] for r in rows if r["fid"]), frozenset(r["bid"] for r in rows), buildings_only=True)
    rows = conn.execute(f"SELECT id FROM floors WHERE deleted_at IS NULL AND id IN ({marks})", ids).fetchall()
    return Reach(False, frozenset(r[0] for r in rows), floors_only=True)


def entity_covered(conn: sqlite3.Connection, reach: Reach, entity_id: str | None, placed: dict | None = None) -> bool:
    """The people's placement rule (services/ha_scope.entity_visible) applied to the restriction's floors."""
    if not entity_id:
        return False
    if reach.wide:
        return True
    from .. import ha_scope

    placed = placed if placed is not None else ha_scope.placements(conn)
    return ha_scope.entity_visible(False, set(reach.floors), placed, entity_id)


def creator_holds(conn: sqlite3.Connection, principal: Principal, permission: str, kind: str, ids: list[str]) -> bool:
    """The creator must hold the mapped permission on the WHOLE restriction (CR 4.3): a token is never wider than its creator."""
    if kind == "installation":
        return authorize(conn, principal, permission, INSTALLATION).allowed
    return all(authorize(conn, principal, permission, (kind, i)).allowed for i in ids)


# ---------------------------------------------------------------- clients

def client_row(conn: sqlite3.Connection, client_id: str) -> sqlite3.Row | None:
    if not isinstance(client_id, str) or not ID_RE["pcl"].fullmatch(client_id):
        return None
    return conn.execute("SELECT * FROM partner_clients WHERE id = ? AND deleted_at IS NULL", (client_id,)).fetchone()


def create_client(conn: sqlite3.Connection, principal: Principal, label: Any, rid: str | None = None) -> dict[str, Any]:
    text = clean_label(label)
    cid = new_ident("pcl")
    now = iso(utcnow())
    conn.execute("INSERT INTO partner_clients (id, label, opaque_installation_ref, state, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
                 (cid, text, secrets.token_hex(16), "active", principal.user_id, now, now))
    audit(conn, actor=principal, action="partner.client.created", decision="allowed", resource_type="partner_client", resource_id=cid, request_id=rid)
    return client_view(conn, conn.execute("SELECT * FROM partner_clients WHERE id = ?", (cid,)).fetchone())


def set_client_state(conn: sqlite3.Connection, principal: Principal, client_id: str, state: str, rid: str | None = None) -> dict[str, Any]:
    row = client_row(conn, client_id)
    if row is None:
        raise PartnerError(404, "not_found")
    if state not in ("active", "disabled"):
        raise PartnerError(422, "invalid", "state")
    if row["state"] != state:
        conn.execute("UPDATE partner_clients SET state = ?, updated_at = ? WHERE id = ?", (state, iso(utcnow()), client_id))
        audit(conn, actor=principal, action="partner.client.disabled" if state == "disabled" else "partner.client.enabled", decision="allowed",
              resource_type="partner_client", resource_id=client_id, request_id=rid)
    return client_view(conn, client_row(conn, client_id))


def delete_client(conn: sqlite3.Connection, principal: Principal, client_id: str, rid: str | None = None) -> None:
    row = client_row(conn, client_id)
    if row is None:
        raise PartnerError(404, "not_found")
    now = iso(utcnow())
    conn.execute("UPDATE partner_tokens SET revoked_at = ?, revoked_reason = 'partner_deleted' WHERE client_id = ? AND revoked_at IS NULL", (now, client_id))
    conn.execute("UPDATE partner_endpoints SET state = 'disabled', state_reason = 'partner_deleted', updated_at = ? WHERE client_id = ?", (now, client_id))
    conn.execute("UPDATE partner_outbox SET state = 'dead', dead_reason = 'disabled', ended_at = ? WHERE state IN ('queued', 'delivering') AND endpoint_id IN "
                 "(SELECT id FROM partner_endpoints WHERE client_id = ?)", (now, client_id))
    conn.execute("UPDATE partner_clients SET state = 'disabled', deleted_at = ?, updated_at = ? WHERE id = ?", (now, now, client_id))
    audit(conn, actor=principal, action="partner.client.deleted", decision="allowed", resource_type="partner_client", resource_id=client_id, request_id=rid)


def client_view(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    counts = conn.execute("""SELECT (SELECT COUNT(*) FROM partner_tokens WHERE client_id = ? AND revoked_at IS NULL AND expires_at > ?) AS tokens,
                                    (SELECT COUNT(*) FROM partner_endpoints WHERE client_id = ? AND state != 'disabled') AS endpoints""",
                          (row["id"], iso(utcnow()), row["id"])).fetchone()
    return {"id": row["id"], "label": row["label"], "state": row["state"], "created_at": row["created_at"],
            "tokens": counts["tokens"], "endpoints": counts["endpoints"]}


def list_clients(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [client_view(conn, r) for r in conn.execute("SELECT * FROM partner_clients WHERE deleted_at IS NULL ORDER BY created_at").fetchall()]


# ---------------------------------------------------------------- tokens

def validate_scopes(value: Any) -> list[str]:
    if not isinstance(value, list) or not value or len(value) > len(SCOPES) or not all(isinstance(s, str) for s in value):
        raise PartnerError(422, "invalid", "scopes")
    out = list(dict.fromkeys(value))
    if any(s not in SCOPES for s in out):
        raise PartnerError(422, "unknown_scope", "scopes")
    return out


def validate_cidrs(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > SOURCE_CIDRS_MAX:
        raise PartnerError(422, "invalid", "source_cidrs")
    out = []
    for v in value:
        try:
            out.append(str(ipaddress.ip_network(str(v).strip(), strict=False)))
        except ValueError:
            raise PartnerError(422, "invalid", "source_cidrs") from None
    return list(dict.fromkeys(out))


def validate_departments(conn: sqlite3.Connection, value: Any) -> list[str]:
    ids = _ids(value, "departments")
    if not ids:
        return []
    marks = ",".join("?" * len(ids))
    try:
        found = {r[0] for r in conn.execute(f"SELECT id FROM ticket_departments WHERE deleted_at IS NULL AND id IN ({marks})", ids).fetchall()}
    except sqlite3.OperationalError:
        found = set()
    if found != set(ids):
        raise PartnerError(422, "unknown", "departments")
    return ids


def validate_personal(value: Any) -> dict[str, bool]:
    out = dict(PERSONAL_DEFAULTS)
    if value is None:
        return out
    if not isinstance(value, dict) or any(k not in PERSONAL_DEFAULTS or not isinstance(v, bool) for k, v in value.items()):
        raise PartnerError(422, "invalid", "personal")
    out.update(value)
    return out


def _rate(conn: sqlite3.Connection, value: Any, key: str, field_name: str) -> int:
    if value is None:
        return number(conn, key)
    _d, lo, hi = NUMERIC[key]
    if isinstance(value, bool) or not isinstance(value, int) or not lo <= value <= hi:
        raise PartnerError(422, "out_of_range", field_name)
    return value


def _mint() -> tuple[str, str]:
    token = TOKEN_PREFIX + secrets.token_urlsafe(32)
    while not TOKEN_RE.fullmatch(token):  # pragma: no cover - token_urlsafe(32) is always 43 characters
        token = TOKEN_PREFIX + secrets.token_urlsafe(32)
    return token, token_hash(token)


def create_token(conn: sqlite3.Connection, principal: Principal, client_id: str, body: dict[str, Any], rid: str | None = None) -> dict[str, Any]:
    """Validate and store one token; the answer carries the plaintext ONCE (`token`)."""
    client = client_row(conn, client_id)
    if client is None:
        raise PartnerError(404, "not_found")
    if client["state"] != "active":
        raise PartnerError(409, "partner_disabled")
    label = clean_label(body.get("label"), required=False)
    scopes = validate_scopes(body.get("scopes"))
    kind, ids = validate_restriction(conn, body.get("restriction_kind", "installation"), body.get("restriction_ids"))
    departments = validate_departments(conn, body.get("departments")) if any(s.startswith("tickets.") for s in scopes) else []
    if "tickets.create" in scopes and not departments:
        raise PartnerError(422, "departments_required", "departments")
    cidrs = validate_cidrs(body.get("source_cidrs"))
    personal = validate_personal(body.get("personal"))
    max_days, default_days = number(conn, "partner.token_max_days"), number(conn, "partner.token_default_days")
    days = body.get("expires_days", default_days)
    if isinstance(days, bool) or not isinstance(days, int) or not 1 <= days <= max_days:
        raise PartnerError(422, "out_of_range", "expires_days")
    per_min = _rate(conn, body.get("rate_per_min"), "partner.rate_per_min", "rate_per_min")
    per_hour = _rate(conn, body.get("rate_per_hour"), "partner.rate_per_hour", "rate_per_hour")
    for scope in scopes:
        if not creator_holds(conn, principal, SCOPE_PERMISSION[scope], kind, ids):
            audit(conn, actor=principal, action="partner.token.created", decision="denied", resource_type="partner_client", resource_id=client_id,
                  reason="creator_lacks_permission", request_id=rid, details={"scope": scope, "restriction": kind})
            raise PartnerError(403, "creator_lacks_permission", "scopes")
    now = utcnow()
    token, digest = _mint()
    tid = new_ident("ptk")
    _insert_token(conn, tid, client_id, label, digest, token[-4:], scopes, kind, ids, departments, cidrs, personal, per_min, per_hour,
                  principal.user_id, now, now + dt.timedelta(days=days), None)
    audit(conn, actor=principal, action="partner.token.created", decision="allowed", resource_type="partner_token", resource_id=tid, request_id=rid,
          details={"client_id": client_id, "scopes": scopes, "restriction": kind, "restriction_count": len(ids), "expires_at": iso(now + dt.timedelta(days=days)),
                   "departments": len(departments), "source_cidrs": len(cidrs)})
    if personal != PERSONAL_DEFAULTS or personal.get("ticket_people"):
        audit(conn, actor=principal, action="partner.token.personal_data", decision="allowed", resource_type="partner_token", resource_id=tid,
              request_id=rid, details={k: v for k, v in personal.items()})
    return {**token_view(conn, token_row(conn, tid)), "token": token}


def _insert_token(conn: sqlite3.Connection, tid: str, client_id: str, label: str, digest: str, last4: str, scopes: list[str], kind: str, ids: list[str],
                  departments: list[str], cidrs: list[str], personal: dict[str, bool], per_min: int, per_hour: int, created_by: str,
                  created: dt.datetime, expires: dt.datetime, predecessor: str | None) -> None:
    conn.execute(
        """INSERT INTO partner_tokens (id, client_id, label, token_hash, last4, scopes_json, restriction_kind, restriction_ids_json, departments_json,
                                       source_cidrs_json, personal_json, rate_per_min, rate_per_hour, installation_id, created_by, created_at, expires_at,
                                       predecessor_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (tid, client_id, label, digest, last4, json.dumps(scopes), kind, json.dumps(ids), json.dumps(departments), json.dumps(cidrs),
         json.dumps(personal, sort_keys=True), per_min, per_hour, installation_id(conn), created_by, iso(created), iso(expires), predecessor))


def token_row(conn: sqlite3.Connection, token_id: str) -> sqlite3.Row | None:
    if not isinstance(token_id, str) or not ID_RE["ptk"].fullmatch(token_id):
        return None
    return conn.execute("SELECT * FROM partner_tokens WHERE id = ?", (token_id,)).fetchone()


def token_state(row: sqlite3.Row, now: dt.datetime | None = None) -> str:
    now = now or utcnow()
    if row["revoked_at"]:
        return "revoked"
    exp = parse_iso(row["expires_at"])
    return "expired" if exp is None or exp <= now else "active"


def token_view(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    """A token as lists show it: never the token, never its hash."""
    creator = conn.execute("SELECT active FROM users WHERE id = ?", (row["created_by"],)).fetchone()
    return {
        "id": row["id"], "client_id": row["client_id"], "label": row["label"], "last4": row["last4"], "scopes": json.loads(row["scopes_json"]),
        "restriction_kind": row["restriction_kind"], "restriction_ids": json.loads(row["restriction_ids_json"]),
        "departments": json.loads(row["departments_json"]), "source_cidrs": json.loads(row["source_cidrs_json"]),
        "personal": {**PERSONAL_DEFAULTS, **json.loads(row["personal_json"] or "{}")}, "rate_per_min": row["rate_per_min"], "rate_per_hour": row["rate_per_hour"],
        "created_at": row["created_at"], "expires_at": row["expires_at"], "last_used_at": row["last_used_at"], "last_used_addr": row["last_used_addr"],
        "request_count": row["request_count"], "revoked_at": row["revoked_at"], "revoked_reason": row["revoked_reason"], "state": token_state(row),
        "predecessor_id": row["predecessor_id"], "owner_gone": creator is None or not creator["active"],
    }


def list_tokens(conn: sqlite3.Connection, client_id: str | None = None) -> list[dict[str, Any]]:
    sql, args = "SELECT * FROM partner_tokens", []
    if client_id:
        sql, args = sql + " WHERE client_id = ?", [client_id]
    return [token_view(conn, r) for r in conn.execute(sql + " ORDER BY created_at DESC", args).fetchall()]


def revoke_token(conn: sqlite3.Connection, principal: Principal | None, token_id: str, reason: str = "revoked", rid: str | None = None) -> dict[str, Any]:
    row = token_row(conn, token_id)
    if row is None:
        raise PartnerError(404, "not_found")
    if not row["revoked_at"]:
        conn.execute("UPDATE partner_tokens SET revoked_at = ?, revoked_reason = ? WHERE id = ?", (iso(utcnow()), reason[:40], token_id))
        audit(conn, actor=principal, action="partner.token.revoked", decision="allowed", resource_type="partner_token", resource_id=token_id,
              request_id=rid, details={"reason": reason[:40]})
    return token_view(conn, token_row(conn, token_id))


def rotate_token(conn: sqlite3.Connection, principal: Principal, token_id: str, overlap_hours: Any = None, rid: str | None = None) -> dict[str, Any]:
    """A successor with the same scopes and restriction; the predecessor ends at min(expiry, now + overlap). The successor is shown once."""
    row = token_row(conn, token_id)
    if row is None:
        raise PartnerError(404, "not_found")
    if token_state(row) != "active":
        raise PartnerError(409, "token_not_active")
    client = client_row(conn, row["client_id"])
    if client is None or client["state"] != "active":
        raise PartnerError(409, "partner_disabled")
    if overlap_hours is None:
        overlap_hours = number(conn, "partner.rotation_overlap_hours")
    if isinstance(overlap_hours, bool) or not isinstance(overlap_hours, int) or not 0 <= overlap_hours <= 168:
        raise PartnerError(422, "out_of_range", "overlap_hours")
    scopes = json.loads(row["scopes_json"])
    ids = json.loads(row["restriction_ids_json"])
    for scope in scopes:
        if scope in SCOPE_PERMISSION and not creator_holds(conn, principal, SCOPE_PERMISSION[scope], row["restriction_kind"], ids):
            raise PartnerError(403, "creator_lacks_permission", "scopes")
    now = utcnow()
    created, expires = parse_iso(row["created_at"]) or now, parse_iso(row["expires_at"]) or now
    lifetime = max(dt.timedelta(days=1), min(expires - created, dt.timedelta(days=number(conn, "partner.token_max_days"))))
    token, digest = _mint()
    tid = new_ident("ptk")
    _insert_token(conn, tid, row["client_id"], row["label"], digest, token[-4:], scopes, row["restriction_kind"], ids, json.loads(row["departments_json"]),
                  json.loads(row["source_cidrs_json"]), {**PERSONAL_DEFAULTS, **json.loads(row["personal_json"] or "{}")}, row["rate_per_min"], row["rate_per_hour"],
                  principal.user_id, now, now + lifetime, row["id"])
    end = min(expires, now + dt.timedelta(hours=overlap_hours))
    if overlap_hours == 0:
        conn.execute("UPDATE partner_tokens SET revoked_at = ?, revoked_reason = 'rotated' WHERE id = ?", (iso(now), row["id"]))
    else:
        conn.execute("UPDATE partner_tokens SET expires_at = ? WHERE id = ?", (iso(end), row["id"]))
    audit(conn, actor=principal, action="partner.token.rotated", decision="allowed", resource_type="partner_token", resource_id=tid, request_id=rid,
          details={"predecessor_id": row["id"], "overlap_hours": overlap_hours})
    return {**token_view(conn, token_row(conn, tid)), "token": token}


# ---------------------------------------------------------------- authentication (the /p/v1 app)

@dataclass
class TokenCtx:
    id: str
    client_id: str
    client_label: str
    opaque_ref: str
    scopes: tuple[str, ...]
    kind: str
    ids: tuple[str, ...]
    departments: tuple[str, ...]
    personal: dict[str, bool]
    rate_per_min: int
    rate_per_hour: int
    expires_at: str
    extra: dict[str, Any] = field(default_factory=dict)


def _addr_in(addr: str | None, cidrs: list[str]) -> bool:
    if not cidrs:
        return True
    try:
        ip = ipaddress.ip_address((addr or "").strip())
    except ValueError:
        return False
    for c in cidrs:
        try:
            net = ipaddress.ip_network(c, strict=False)
        except ValueError:
            continue
        if ip.version == net.version and ip in net:
            return True
    return False


def authenticate(conn: sqlite3.Connection, token: str, addr: str | None, now: dt.datetime | None = None) -> tuple[TokenCtx | None, str]:
    """(context, "") for a usable token, else (None, reason). Every unusable token answers the same 401 bytes upstream; the reason is only
    for the audit (installation mismatch, source address) and the counters."""
    digest = token_hash(token)
    row = conn.execute("""SELECT t.*, c.label AS client_label, c.state AS client_state, c.deleted_at AS client_deleted, c.opaque_installation_ref
                          FROM partner_tokens t JOIN partner_clients c ON c.id = t.client_id WHERE t.token_hash = ?""", (digest,)).fetchone()
    if row is None or not hmac.compare_digest(row["token_hash"], digest):
        return None, "unknown"
    if row["revoked_at"]:
        return None, "revoked"
    exp = parse_iso(row["expires_at"])
    if exp is None or exp <= (now or utcnow()):
        return None, "expired"
    if row["client_state"] != "active" or row["client_deleted"]:
        return None, "partner_disabled"
    if not hmac.compare_digest(row["installation_id"] or "", installation_id_read(conn)):
        return None, "installation_mismatch"
    if not _addr_in(addr, json.loads(row["source_cidrs_json"] or "[]")):
        return None, "source_address"
    scopes = tuple(s for s in json.loads(row["scopes_json"] or "[]") if s in SCOPES)  # a stored unknown scope (a downgrade) is ignored
    return TokenCtx(row["id"], row["client_id"], row["client_label"], row["opaque_installation_ref"], scopes, row["restriction_kind"],
                    tuple(json.loads(row["restriction_ids_json"] or "[]")), tuple(json.loads(row["departments_json"] or "[]")),
                    {**PERSONAL_DEFAULTS, **json.loads(row["personal_json"] or "{}")}, int(row["rate_per_min"]), int(row["rate_per_hour"]),
                    row["expires_at"]), ""


def installation_id_read(conn: sqlite3.Connection) -> str:
    return get_setting(conn, "installation_id", "") or ""


class UsageMeter:
    """Per-token counters (requests, last used, last address) kept in memory and written at most every FLUSH_S per token - a read never
    takes the write lock on its own path."""

    FLUSH_S = 30.0

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pending: dict[str, list[Any]] = {}

    def note(self, token_id: str, addr: str | None, at: str, mono: float) -> bool:
        """Count one request; True when this token's counters are due to be written (first use, then at most every FLUSH_S)."""
        with self._lock:
            p = self._pending.setdefault(token_id, [0, None, None, float("-inf")])
            p[0] += 1
            p[1], p[2] = at, (addr or "")[:64]
            return mono - p[3] >= self.FLUSH_S

    def flush(self, conn: sqlite3.Connection, mono: float, *, force: bool = False) -> int:
        with self._lock:
            due = {k: list(v) for k, v in self._pending.items() if v[0] and (force or mono - v[3] >= self.FLUSH_S)}
            for k in due:
                self._pending[k] = [0, None, None, mono]
        for tid, (n, at, addr, _m) in due.items():
            if n:
                conn.execute("UPDATE partner_tokens SET request_count = request_count + ?, last_used_at = ?, last_used_addr = ? WHERE id = ?", (n, at, addr, tid))
        return len(due)


USAGE = UsageMeter()


# ---------------------------------------------------------------- the janitor: expiry notices, owner gone, purge

def janitor(conn: sqlite3.Connection, now: dt.datetime | None = None) -> dict[str, int]:
    from .. import notify

    now = now or utcnow()
    out = {"expiring": 0, "owner_gone": 0, "purged": 0}
    notice = number(conn, "partner.expiry_notice_days")
    if notice:
        horizon = iso(now + dt.timedelta(days=notice))
        for r in conn.execute("""SELECT t.id, t.expires_at, c.label FROM partner_tokens t JOIN partner_clients c ON c.id = t.client_id
                                 WHERE t.revoked_at IS NULL AND t.expiry_noticed_at IS NULL AND t.expires_at > ? AND t.expires_at <= ?""",
                              (iso(now), horizon)).fetchall():
            _emit(notify, conn, "partner.token_expiring", r["id"], {"name": r["label"], "detail": r["expires_at"][:10]})
            conn.execute("UPDATE partner_tokens SET expiry_noticed_at = ? WHERE id = ?", (iso(now), r["id"]))
            out["expiring"] += 1
    for r in conn.execute("""SELECT t.id, c.label FROM partner_tokens t JOIN partner_clients c ON c.id = t.client_id LEFT JOIN users u ON u.id = t.created_by
                             WHERE t.revoked_at IS NULL AND t.owner_gone_at IS NULL AND t.expires_at > ? AND (u.id IS NULL OR u.active = 0)""",
                          (iso(now),)).fetchall():
        _emit(notify, conn, "partner.owner_gone", r["id"], {"name": r["label"]})
        conn.execute("UPDATE partner_tokens SET owner_gone_at = ? WHERE id = ?", (iso(now), r["id"]))
        out["owner_gone"] += 1
    cutoff = iso(now - dt.timedelta(days=PURGE_ENDED_DAYS))
    out["purged"] += conn.execute("DELETE FROM partner_tokens WHERE (revoked_at IS NOT NULL AND revoked_at < ?) OR expires_at < ?", (cutoff, cutoff)).rowcount
    out["purged"] += conn.execute("DELETE FROM partner_idempotency WHERE created_at < ?", (iso(now - dt.timedelta(hours=24)),)).rowcount
    return out


def _emit(notify: Any, conn: sqlite3.Connection, source: str, subject_id: str, params: dict[str, Any]) -> None:
    try:
        notify.emit_full(conn, notify.Signal(source, "system", subject_id, params=params, link="#/system/connections"))
    except Exception:  # noqa: BLE001 - a notice never stops the janitor
        pass
