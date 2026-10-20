"""SHAREDID-293: the server side of the shared Arx + WisKey identity screen ("גישת חוץ" - external access).

Owner decisions of 2026-10-20 (private/planning/OWNER_DECISIONS_2026-10-20_NIGHT.md, "Shared Arx + WisKey identity UI"):
 1 the product is called "WisKey" in the UI (the screen's words; nothing here);
 2 "Active - verified" only when the server STORES read-back proof: `verify_pass` reads every active grant (at most once an hour) and
   stores the digest of the scope a complete fresh read proved (access_grants.proof_fields / scope_is_proven); the worker's own fresh
   reads (an unknown outcome settled, a narrowing proven) store it too. A scope change invalidates it (another digest);
 3 a manual "confirmed gone": ONE system administrator, an evidence reference, a typed word and three ticked checks; the grant leaves
   `revoking` as `ended` with a closure row (never `revoked` - Arx does not claim the access was removed), the hourly alerts stop and
   every manager is told (`access.grant_closed_manual`). `watch_gone` keeps looking for the person: found again -> the revocation is
   reopened at once and the managers alerted;
 4 the weekly digest: a content-free notice to the managers (in the app and on the phone, no names; WhatsApp optionally - the channel
   is a setting, stored as the digest source's notification policy) at a day and hour (default Sunday 08:00, the installation's
   zone); the details are served only by `GET /access-grants/digest`, filtered by what the caller may see;
 5 name drift against WisKey: a manual "push the name" (`push_name`) and an automatic push (`name_pass`, setting `name_sync` = auto);
   only to a person Arx created; the link keeps digests of the names, never a name;
 6 the screen's placement is a setting (`placement`: access control, service management or both), readable by every user through
   GET /settings (it shapes navigation only);
 7 attach a recovered person: a server route over the private helper `access_grants._attach_recovered_person`, system administrators
   only, every refusal audited (owner Q3 of 08:10: "only when a caller exists" - this is that caller).

Nothing here turns the feature on: every pass is a no-op while `access.external_grants` is off, and the live engine refuses every call
while the owner's go-live permit is not in the build. Extended service identity stays LOCKED (not touched here)."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import re
import sqlite3
import time
import unicodedata
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

from ..db import Database, get_setting, now_iso, set_setting
from ..errors import ApiError, forbidden
from ..rbac import INSTALLATION, STATION, Principal, authorize, is_system_admin, permissions_anywhere
from . import access_grants as ag
from . import intercom_authority as ia
from . import intercom_write_journal as wj
from .access_grant_engine import NAME_MAX, EngineError

log = logging.getLogger("smplwise.access_external")

# ---------------------------------------------------------------- settings (system administrator, through /access-grants/settings)

DIGEST_DAY_KEY = "access.external.digest_day"      # 0 = Sunday ... 6 = Saturday (the installation's zone)
DIGEST_HOUR_KEY = "access.external.digest_hour"    # 0..23
DIGEST_LAST_KEY = "access.external.digest_last"    # internal: the period end of the last digest sent (never shown)
NAME_SYNC_KEY = "access.external.name_sync"        # manual | auto (owner decision 5)
PLACEMENT_KEY = "access.external.placement"        # access | tickets | both (owner decision 6)
NAME_SYNC_MODES = ("manual", "auto")
PLACEMENTS = ("access", "tickets", "both")
DIGEST_CHANNELS = ("app", "app_whatsapp")
DEFAULTS = {DIGEST_DAY_KEY: "0", DIGEST_HOUR_KEY: "8", NAME_SYNC_KEY: "manual", PLACEMENT_KEY: "access"}
KEYS = (DIGEST_DAY_KEY, DIGEST_HOUR_KEY, NAME_SYNC_KEY, PLACEMENT_KEY)

DIGEST_SOURCE = "access.weekly_digest"
CLOSED_SOURCE = "access.grant_closed_manual"
ATTENTION_SOURCE = "access.grant_attention"

VERIFY_EVERY_S = 3600      # an active grant is read back at most once an hour (owner decision 2)
GONE_WATCH_S = 3600        # a person confirmed gone is looked for again once an hour (owner decision 3)
NAME_RETRY_S = 900         # an automatic name push that did not land is tried again after 15 minutes (owner decision 5)
DIGEST_LATE_S = 6 * 3600   # a digest whose time passed more than 6 hours ago (the system was off) is skipped, not sent late
SLOW_REVOKE_S = 120        # "revocations over 2 minutes" (the same 2 minutes after which the managers are alerted)
GONE_WORD = "נמחק"
GONE_CHECKS = 3
REFERENCE_MIN, REFERENCE_MAX = 8, 128
_PHONE_RUN = re.compile(r"\d[\d\s\-.]{6,}\d")  # seven or more digits in a row (spaces / dashes allowed): a phone number, refused


def _choice(conn: sqlite3.Connection, key: str, allowed: tuple[str, ...]) -> str:
    value = get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key]
    return value if value in allowed else DEFAULTS[key]


def _int(conn: sqlite3.Connection, key: str, lo: int, hi: int) -> int:
    try:
        v = int(get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key])
    except (TypeError, ValueError):
        v = int(DEFAULTS[key])
    return v if lo <= v <= hi else int(DEFAULTS[key])


def placement(conn: sqlite3.Connection) -> str:
    return _choice(conn, PLACEMENT_KEY, PLACEMENTS)


def name_sync(conn: sqlite3.Connection) -> str:
    return _choice(conn, NAME_SYNC_KEY, NAME_SYNC_MODES)


def digest_day(conn: sqlite3.Connection) -> int:
    return _int(conn, DIGEST_DAY_KEY, 0, 6)


def digest_hour(conn: sqlite3.Connection) -> int:
    return _int(conn, DIGEST_HOUR_KEY, 0, 23)


def digest_channel(conn: sqlite3.Connection) -> str:
    """Owner decision 4: the digest's channel IS the notification policy of its source (one truth, also editable in the notification
    settings): the app and the phone notice always, WhatsApp when the policy says so."""
    from . import notify_policy as np

    pol = np.get_policy(conn, DIGEST_SOURCE) or {}
    return "app_whatsapp" if (pol.get("channels") or {}).get("whatsapp") else "app"


def settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"digest_channel": digest_channel(conn), "digest_day": digest_day(conn), "digest_hour": digest_hour(conn), "name_sync": name_sync(conn),
            "placement": placement(conn)}


def apply_settings(conn: sqlite3.Connection, changes: dict[str, Any]) -> list[tuple[str, Any, Any]]:
    """Write the screen's settings (the caller - the settings route - has checked the system administrator). Returns (key, before,
    after) for the audit."""
    before = settings_view(conn)
    out: list[tuple[str, Any, Any]] = []
    keys = {"digest_day": DIGEST_DAY_KEY, "digest_hour": DIGEST_HOUR_KEY, "name_sync": NAME_SYNC_KEY, "placement": PLACEMENT_KEY}
    for name, value in changes.items():
        if name == "digest_channel":
            _set_digest_channel(conn, str(value))
            out.append(("notify.policy." + DIGEST_SOURCE + ".whatsapp", before["digest_channel"], value))
        elif name in keys:
            set_setting(conn, keys[name], str(value))
            out.append((keys[name], before[name], value))
    return out


def _set_digest_channel(conn: sqlite3.Connection, channel: str) -> None:
    from . import notify_policy as np

    if channel not in DIGEST_CHANNELS:
        raise ApiError(422, "validation", "ערוץ לא מוכר.", details={"field": "digest_channel"})
    np.get_policy(conn, DIGEST_SOURCE)  # creates the row from the catalogue the first time
    row = conn.execute("SELECT channels_json FROM notify_policies WHERE source = ?", (DIGEST_SOURCE,)).fetchone()
    try:
        channels = json.loads(row["channels_json"] or "{}") if row else {}
    except ValueError:
        channels = {}
    channels.update({"inbox": True, "webpush": True, "app": True, "whatsapp": channel == "app_whatsapp"})
    conn.execute("UPDATE notify_policies SET channels_json = ?, revision = revision + 1, updated_at = ? WHERE source = ?",
                 (json.dumps(channels), now_iso(), DIGEST_SOURCE))


def screen_href(conn: sqlite3.Connection, grant_id: str | None = None) -> str:
    """Where the screen lives for this installation (owner decision 6): the access-control area unless the owner placed it under
    service management only. A grant id opens its drawer."""
    try:
        base = "#/tickets/external" if placement(conn) == "tickets" else "#/wiskey/external"
    except sqlite3.Error:
        base = "#/wiskey/external"
    return f"{base}?grant={grant_id}" if grant_id else base


# ---------------------------------------------------------------- names (owner decision 5) - digests only

def _clean(name: Any) -> str:
    return " ".join(unicodedata.normalize("NFC", str(name or "")).split())


def arx_name(contact: dict[str, Any] | None) -> str:
    """The name Arx writes to WisKey for a contact: the directory name, WisKey's 32 code points, never a phone."""
    return _clean((contact or {}).get("display_name") or "אורח")[:NAME_MAX].strip() or "אורח"


def name_digest(name: Any) -> str:
    return hashlib.sha256(_clean(name)[:NAME_MAX].strip().encode("utf-8")).hexdigest()[:32]


def name_drift(conn: sqlite3.Connection, link: dict[str, Any]) -> bool:
    """True when WisKey's name at the last read differs from the name Arx would write now (WisKey edited it, or the directory name
    changed). A link never read since 0128 has no drift (unknown is not a gap)."""
    if link.get("origin") != "created_from_arx" or not link.get("name_seen") or link.get("subject_kind") != "contact":
        return False
    return link["name_seen"] != name_digest(arx_name(ag.contact_row(conn, link["subject_id"])))


def _observe_name(conn: sqlite3.Connection, link: dict[str, Any], person: Any) -> None:
    conn.execute("UPDATE access_person_links SET name_seen = ? WHERE id = ?", (name_digest(getattr(person, "display_name", "")), link["id"]))


def _stations_of_subject(conn: sqlite3.Connection, link: dict[str, Any]) -> list[str]:
    live = ag.live_grant_of(conn, link["subject_kind"], link["subject_id"])
    return ag.stations_of(json.loads(live["doors_json"] or "{}")) if live else []


def _push(db: Database, link: dict[str, Any], actor: Any, request_id: str | None = None) -> dict[str, Any]:
    """One rename of a person Arx created to the directory name (a fresh read, a revision-checked write, once more on a revision
    conflict). Raises EngineError; records the digests and an ids-only audit row on success."""
    engine = ag.engine_for(db)
    with db.connection(mode="read", label="access_external.name.read") as conn:
        name = arx_name(ag.contact_row(conn, link["subject_id"]))
    person = engine.get_person(link["wiskey_person_id"])
    try:
        person = engine.rename(person.id, person.revision, name)
    except EngineError as exc:
        if exc.kind != "revision_conflict":
            raise
        person = engine.get_person(link["wiskey_person_id"])
        person = engine.rename(person.id, person.revision, name)
    with db.connection(label="access_external.name.done") as conn:
        conn.execute("UPDATE access_person_links SET name_pushed = ?, name_seen = ?, name_checked_at = ? WHERE id = ?",
                     (name_digest(name), name_digest(person.display_name), ag.iso(ag.now()), link["id"]))
        ag._audit(conn, actor, "access.person_link.name_pushed", link["id"], resource_type="access_person_link", request_id=request_id,
                  wiskey_person_id=link["wiskey_person_id"], automatic=actor is None or None)
    return {"link_id": link["id"], "outcome": "pushed", "drift": name_digest(person.display_name) != name_digest(name)}


def push_name(db: Database, principal: Principal, link_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Owner decision 5, the manual button: write the Arx name to the WisKey person - only a person Arx created, by an interactive human
    who holds people.manage on every station of the person's live grant (installation-wide when there is none)."""
    from .intercom_writes import interactive

    with db.connection(label="access_external.push_name") as conn:
        link = ag.link_row(conn, link_id)
        if link is None:
            raise ApiError(404, "access_link_not_found", "הקישור לא נמצא.")
        stations = _stations_of_subject(conn, link)
        lacks = ag.missing_on(conn, principal, (ia.PEOPLE_MANAGE,), stations) if stations else ag._unrestricted_lacks(conn, principal, (ia.PEOPLE_MANAGE,))
        if lacks:
            ag._audit(conn, principal, "access.person_link.name_pushed", link_id, decision="denied", reason="no_binding", resource_type="access_person_link",
                      request_id=request_id)
            raise forbidden(permission=lacks[0][0], target_type=STATION, target_id=lacks[0][1], reason="no_binding")
        if not interactive(principal):
            raise ApiError(403, "access_grant_interactive_only", "פעולה זו אפשרית רק ממסך מחובר של אדם.")
        if link["origin"] != "created_from_arx":
            raise ag._person_not_ours()
        if link["state"] != "linked":
            raise ag._conflict("access_link_state", "הקישור אינו פעיל.", state=link["state"])
    try:
        return _push(db, link, principal, request_id)
    except EngineError as exc:
        if exc.kind == "not_found":
            raise ApiError(404, "access_person_not_found", "האדם לא נמצא במערכת הכניסה.") from None
        raise ApiError(503 if exc.kind in ("not_sent", "not_permitted") else 504, "access_name_push_failed",
                       "השם לא נשלח למערכת הכניסה. נסו שוב בעוד רגע.", details={"outcome": exc.kind}) from None


def name_pass(db: Database) -> int:
    """Owner decision 5, the automatic push (setting `name_sync` = auto): every person Arx created whose name in WisKey differs from the
    directory name gets the Arx name - at most every 15 minutes per person when a push did not land."""
    at = ag.now()
    with db.connection(mode="read", label="access_external.name.scan") as conn:
        if not ag.enabled(conn) or name_sync(conn) != "auto":
            return 0
        links = [dict(r) for r in conn.execute("SELECT * FROM access_person_links WHERE origin = 'created_from_arx' AND state = 'linked' AND name_seen IS NOT NULL")]
        due = [lk for lk in links if name_drift(conn, lk)]
    n = 0
    for link in due:
        # `name_checked_at` moves on every write attempt (the create, a push, a failed push), never on a read: a drift is pushed when the last
        # attempt is more than 15 minutes old - so a push that did not land is retried after 15 minutes, never on every pass
        last = ag.parse_iso(link.get("name_checked_at"))
        if last is not None and (at - last).total_seconds() < NAME_RETRY_S:
            continue
        try:
            _push(db, link, None)
            n += 1
        except EngineError:
            with db.connection(label="access_external.name.retry") as conn:
                conn.execute("UPDATE access_person_links SET name_checked_at = ? WHERE id = ?", (ag.iso(at), link["id"]))
    return n


# ---------------------------------------------------------------- read-back verification (owner decision 2)

def verify_pass(db: Database) -> int:
    """Read back every active grant whose last check is more than an hour old (newly active ones on the next pass) and store whether a
    COMPLETE fresh read proves its scope. A read only - never a write. A grant whose row moved while the read was out is decided again on
    the next pass (compare-and-set on the revision, which this pass does not bump). The person's name digest is observed on the way."""
    at = ag.now()
    with db.connection(mode="read", label="access_external.verify.scan") as conn:
        if not ag.enabled(conn):
            return 0
        rows = [dict(r) for r in conn.execute("SELECT * FROM access_grants WHERE state = 'active' AND needs_push = 0").fetchall()]
    n = 0
    for g in rows:
        last = ag.parse_iso(g.get("scope_checked_at"))
        if last is not None and (at - last).total_seconds() < VERIFY_EVERY_S:
            continue
        if g.get("code_state") in ("pending", "queued") and ag.parse_iso(g.get("code_due_at")) and ag.parse_iso(g["code_due_at"]) <= at:
            continue  # the code delivery reads (and proves) the scope itself on this pass
        n += _verify_one(db, g, at)
    return n


def _verify_one(db: Database, g: dict[str, Any], at: datetime) -> int:
    with db.connection(mode="read", label="access_external.verify.link") as conn:
        link = ag.link_of_grant(conn, g)
    if link is None or not ag.person_is_ours(link):
        return 0  # R4-05: the proof is about a person Arx created; a matched person is never verified (nor written)
    try:
        person = ag.engine_for(db).get_person(link["wiskey_person_id"])
    except EngineError as exc:
        if exc.kind == "not_found":  # WisKey round 3: not proof of absence - the authority is withdrawn and the revoke keeps reading
            with db.connection(label="access_external.verify.missing") as conn:
                cur = ag.grant_row(conn, g["id"])
                if cur is not None and cur["state"] == "active":
                    ag.mark_revoking(conn, cur, "wiskey_missing")
        return 0  # not reachable now: the next pass reads again
    scope = ag.Scope.of_row(g)
    proven = ag.scope_proven(person, scope)
    outcome = "proven" if proven else "unknown" if not person.doors_known else "mismatch"
    with db.connection(label="access_external.verify.store") as conn:
        _observe_name(conn, link, person)
        cur = ag.grant_row(conn, g["id"])
        if cur is None or cur["revision"] != g["revision"] or cur["state"] != "active" or cur["needs_push"]:
            return 0
        was = ag.scope_is_proven(cur)
        if proven:
            fields = ag.proof_fields(scope)
            conn.execute("UPDATE access_grants SET scope_proof = ?, scope_proof_at = ?, scope_checked_at = ? WHERE id = ? AND revision = ?",
                         (fields["scope_proof"], fields["scope_proof_at"], fields["scope_checked_at"], g["id"], g["revision"]))
        else:
            conn.execute("UPDATE access_grants SET scope_proof = NULL, scope_proof_at = NULL, scope_checked_at = ? WHERE id = ? AND revision = ?",
                         (ag.iso(at), g["id"], g["revision"]))
        if was != proven or outcome == "mismatch":
            ag._audit(conn, None, "access.grant.verify", g["id"], outcome=outcome, stations_synced=person.stations_synced, central_only=True)
    return 1


# ---------------------------------------------------------------- manual "confirmed gone" (owner decision 3)

def _reference_ok(text: Any) -> str | None:
    if not isinstance(text, str):
        return None
    ref = " ".join(text.split())
    if not REFERENCE_MIN <= len(ref) <= REFERENCE_MAX or _PHONE_RUN.search(ref) or any(unicodedata.category(c) in ("Cc", "Cf") for c in ref):
        return None
    return ref


def confirm_gone(db: Database, principal: Principal, grant_id: str, *, reference: Any, confirm: Any, checks: Any,
                 request_id: str | None = None) -> dict[str, Any]:
    """Close by hand a revocation whose WisKey person is not found any more. Only an interactive system administrator; only a grant in
    `revoking` whose link is marked missing; the three checks ticked, the typed word and an 8..128-character reference without a phone
    number. The grant ends as `ended` with a closure row (never `revoked`), the hourly alerts stop, every manager is told. The reference
    is kept in the closure row only (the audit carries ids: who, when, which grant)."""
    from .intercom_writes import interactive

    with db.connection(label="access_external.confirm_gone") as conn:
        def deny(reason: str, exc: ApiError) -> ApiError:
            ag._audit(conn, principal, "access.grant.confirm_gone", grant_id, decision="denied", reason=reason, request_id=request_id)
            return exc

        if not is_system_admin(conn, principal.user_id):
            raise deny("not_system_admin", ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לסגור ביטול באישור ידני."))
        if not interactive(principal):
            raise deny("not_interactive", ApiError(403, "access_grant_interactive_only", "אישור ידני אפשרי רק ממסך מחובר של אדם."))
        g = ag.grant_row(conn, grant_id)
        if g is None:
            raise ag._not_found()
        link = ag.link_of_grant(conn, g)
        if g["state"] != "revoking" or link is None or link["state"] != "wiskey_missing":
            raise deny("not_missing", ag._conflict("access_grant_not_missing", "אפשר לסגור באישור ידני רק ביטול שהאדם שלו לא נמצא במערכת הכניסה.",
                                                    state=g["state"]))
        if not isinstance(checks, list) or len(checks) != GONE_CHECKS or not all(c is True for c in checks):
            raise deny("checks", ApiError(422, "validation", "יש לסמן את שלוש הבדיקות.", details={"field": "checks"}))
        if (confirm or "").strip() != GONE_WORD:
            raise deny("confirm", ApiError(422, "confirm_required", f"כדי להמשיך יש להקליד \"{GONE_WORD}\".", details={"field": "confirm"}))
        ref = _reference_ok(reference)
        if ref is None:
            raise deny("reference", ApiError(422, "validation", "אסמכתא של 8 עד 128 תווים, בלי מספרי טלפון.", details={"field": "reference"}))
        at = ag.iso(ag.now())
        if not ag._touch(conn, grant_id, {"state": "ended", "ended_at": at, "needs_push": 0, "alerted_at": at}, expect_revision=g["revision"]):
            raise ag._conflict("stale_revision", "הגישה השתנתה. טענו מחדש.")
        conn.execute("""INSERT INTO access_grant_closures(grant_id, kind, link_id, wiskey_person_id, closed_by, closed_at, reference, watch_checked_at)
                        VALUES (?, 'confirmed_gone', ?, ?, ?, ?, ?, ?)""", (grant_id, link["id"], link["wiskey_person_id"], principal.user_id, at, ref, at))
        ag._audit(conn, principal, "access.grant.confirm_gone", grant_id, request_id=request_id, link_id=link["id"], wiskey_person_id=link["wiskey_person_id"],
                  checks=GONE_CHECKS, state="ended")
        _notify(conn, CLOSED_SOURCE, grant_id, "confirmed_gone")
        return ag.grant_row(conn, grant_id)


def closure_reference(conn: sqlite3.Connection, principal: Principal, grant_id: str) -> str | None:
    """The evidence reference is shown to a system administrator only (it is free text an administrator wrote)."""
    if not is_system_admin(conn, principal.user_id):
        return None
    r = conn.execute("SELECT reference FROM access_grant_closures WHERE grant_id = ?", (grant_id,)).fetchone()
    return r["reference"] if r else None


def watch_gone(db: Database) -> int:
    """Owner decision 3 (the mockup's promise): a person confirmed gone that WisKey answers for again is alerted at once and its
    revocation reopened - the grant goes back to `revoking` (when the subject has no other live grant and the link still exists), so the
    worker reads, strips and reads back as for any revocation. A read only; at most once an hour per closure."""
    at = ag.now()
    with db.connection(mode="read", label="access_external.gone.scan") as conn:
        if not ag.enabled(conn):
            return 0
        rows = [dict(r) for r in conn.execute("SELECT * FROM access_grant_closures WHERE reappeared_at IS NULL AND wiskey_person_id IS NOT NULL").fetchall()]
    n = 0
    for c in rows:
        last = ag.parse_iso(c.get("watch_checked_at"))
        if last is not None and (at - last).total_seconds() < GONE_WATCH_S:
            continue
        try:
            ag.engine_for(db).get_person(c["wiskey_person_id"])
        except EngineError as exc:
            if exc.kind == "not_found":
                with db.connection(label="access_external.gone.still") as conn:
                    conn.execute("UPDATE access_grant_closures SET watch_checked_at = ? WHERE grant_id = ?", (ag.iso(at), c["grant_id"]))
            continue
        with db.connection(label="access_external.gone.back") as conn:
            cur = conn.execute("SELECT reappeared_at FROM access_grant_closures WHERE grant_id = ?", (c["grant_id"],)).fetchone()
            if cur is None or cur["reappeared_at"]:
                continue
            conn.execute("UPDATE access_grant_closures SET reappeared_at = ?, watch_checked_at = ? WHERE grant_id = ?", (ag.iso(at), ag.iso(at), c["grant_id"]))
            g = ag.grant_row(conn, c["grant_id"])
            link = ag.link_row(conn, c.get("link_id"))
            reopened = False
            if g is not None and link is not None and ag.live_grant_of(conn, g["subject_kind"], g["subject_id"]) is None:
                conn.execute("UPDATE access_person_links SET state = 'linked', revision = revision + 1 WHERE id = ? AND state = 'wiskey_missing'", (link["id"],))
                ag._touch(conn, g["id"], {"state": "revoking", "end_reason": "wiskey_missing", "revoking_since": ag.iso(at), "ended_at": None,
                                          "revoke_attempts": 0, "alerted_at": None})
                reopened = True
            ag._audit(conn, None, "access.grant.reappeared", c["grant_id"], reopened=reopened, link_id=c.get("link_id"), wiskey_person_id=c["wiskey_person_id"])
            _notify(conn, ATTENTION_SOURCE, c["grant_id"], "reappeared")
        n += 1
        ag.WORKER.wake()
    return n


# ---------------------------------------------------------------- the weekly digest (owner decision 4)

def period_end(conn: sqlite3.Connection, at: datetime) -> datetime:
    """The most recent scheduled digest instant at or before `at`: the configured weekday and hour in the installation's IANA zone."""
    tz = ag.zone_of(conn)
    local = at.astimezone(tz)
    want = digest_day(conn)  # 0 = Sunday
    back = (local.isoweekday() % 7 - want) % 7  # isoweekday: Monday 1 .. Sunday 7 -> Sunday 0
    day = (local - timedelta(days=back)).date()
    end = datetime(day.year, day.month, day.day, digest_hour(conn), tzinfo=tz)
    if end > local:
        day = day - timedelta(days=7)
        end = datetime(day.year, day.month, day.day, digest_hour(conn), tzinfo=tz)
    return end.astimezone(timezone.utc)


def digest_due(db: Database) -> bool:
    """Send the weekly notice once per period, at (not before) its time; a period whose time passed more than 6 hours ago is marked and
    skipped (never a burst of late digests after downtime). The notice is content-free: the details are on the screen."""
    at = ag.now()
    with db.connection(label="access_external.digest.due") as conn:
        if not ag.enabled(conn):
            return False
        end = period_end(conn, at)
        key = ag.iso(end)
        if (get_setting(conn, DIGEST_LAST_KEY, "") or "") >= key:
            return False
        set_setting(conn, DIGEST_LAST_KEY, key)
        if (at - end).total_seconds() > DIGEST_LATE_S:
            ag._audit(conn, None, "access.digest.skipped", key, resource_type="installation", reason="late")
            return False
        _notify(conn, DIGEST_SOURCE, "digest", "weekly", dedupe=f"{DIGEST_SOURCE}:{key}", link=screen_href(conn) + "?digest=1")
        ag._audit(conn, None, "access.digest.sent", key, resource_type="installation")
        return True


def _in(value: Any, start: str, end: str) -> bool:
    return isinstance(value, str) and start <= value < end


def digest(conn: sqlite3.Connection, principal: Principal, at: datetime | None = None) -> dict[str, Any]:
    """The last full period (the 7 days up to the most recent scheduled instant), counted over the grants the caller may see. Names are
    the Arx directory's (the caller sees them on the screen anyway); WisKey's own name values are never stored, so a name gap says only
    that the names differ."""
    now = at or ag.now()
    end = period_end(conn, now)
    start = end - timedelta(days=7)
    s, e = ag.iso(start), ag.iso(end)
    marks = ",".join("?" * len(ag.LIVE))
    rows = [dict(r) for r in conn.execute(f"SELECT * FROM access_grants WHERE state IN ({marks}) OR created_at >= ? OR approved_at >= ? OR ended_at >= ?",
                                          (*ag.LIVE, s, s, s)).fetchall()]
    seen = [g for g in rows if ag.visible(conn, principal, g)]
    ids = {g["id"] for g in seen}
    closures = {r["grant_id"]: dict(r) for r in conn.execute("SELECT grant_id, closed_at FROM access_grant_closures").fetchall() if r["grant_id"] in ids}

    def audits(action: str) -> int:
        n = 0
        for r in conn.execute("SELECT resource_id, at FROM audit_log WHERE action = ? AND decision = 'allowed' AND at >= ? AND at < ?", (action, s, e)):
            n += r["resource_id"] in ids
        return n

    def name_of(g: dict[str, Any]) -> str | None:
        c = ag.contact_row(conn, g["subject_id"]) if g["subject_kind"] == "contact" else None
        return (c or {}).get("display_name")

    counts = {
        "requests": sum(_in(g["created_at"], s, e) for g in seen),
        "approved": sum(_in(g.get("approved_at"), s, e) for g in seen),
        "refused": sum(g["state"] == "refused" and _in(g.get("ended_at"), s, e) for g in seen),
        "ended_or_revoked": sum(g["state"] in ("ended", "revoked") and _in(g.get("ended_at"), s, e) and g["id"] not in closures for g in seen),
        "confirmed_gone": sum(_in(c["closed_at"], s, e) for c in closures.values()),
        "closed_no_person": audits("access.grant.closed"),
        "codes_sent": audits("access.grant.code_sent"),
        "codes_replaced": audits("access.grant.code_rotated"),
        "codes_not_delivered": audits("access.grant.code_not_delivered"),
    }
    slow = []
    for g in seen:
        since = ag.parse_iso(g.get("revoking_since"))
        if since is None:
            continue
        open_ = g["state"] == "revoking"
        if not open_ and not _in(g.get("ended_at"), s, e):
            continue
        stop = now if open_ else (ag.parse_iso(g.get("ended_at")) or now)
        secs = (stop - since).total_seconds()
        if secs > SLOW_REVOKE_S:
            slow.append({"grant_id": g["id"], "name": name_of(g), "open": open_, "minutes": int(secs // 60)})
    slow.sort(key=lambda x: (not x["open"], -x["minutes"]))
    approvers = Counter(g["approved_by"] for g in seen if g.get("approved_by") and _in(g.get("approved_at"), s, e))
    names = {u["id"]: u["display_name"] for u in conn.execute("SELECT id, display_name FROM users").fetchall()} if approvers else {}
    gaps: list[dict[str, Any]] = []
    subjects = {(g["subject_kind"], g["subject_id"]) for g in seen}
    for link in (dict(r) for r in conn.execute("SELECT * FROM access_person_links WHERE origin = 'created_from_arx' AND state = 'linked'").fetchall()):
        if (link["subject_kind"], link["subject_id"]) not in subjects:
            continue
        contact = ag.contact_row(conn, link["subject_id"])
        if name_drift(conn, link):
            gaps.append({"kind": "name", "link_id": link["id"], "contact_id": link["subject_id"], "name": (contact or {}).get("display_name")})
        if ag.live_grant_of(conn, link["subject_kind"], link["subject_id"]) is None:
            last = max((g.get("ended_at") or "" for g in seen if (g["subject_kind"], g["subject_id"]) == (link["subject_kind"], link["subject_id"])), default="")
            gaps.append({"kind": "idle_person", "link_id": link["id"], "contact_id": link["subject_id"], "name": (contact or {}).get("display_name"),
                         "since": last or None})
    for g in seen:
        if g["state"] == "active" and not g.get("needs_push") and g.get("scope_checked_at") and not ag.scope_is_proven(g):
            last = conn.execute("SELECT details_json FROM audit_log WHERE action = 'access.grant.verify' AND resource_id = ? ORDER BY rowid DESC LIMIT 1",
                                (g["id"],)).fetchone()
            try:
                outcome = json.loads(last["details_json"] or "{}").get("outcome") if last else None
            except ValueError:
                outcome = None
            if outcome == "mismatch":
                gaps.append({"kind": "scope", "grant_id": g["id"], "contact_id": g["subject_id"], "name": name_of(g)})
    return {
        "period": {"from": s, "until": e}, "schedule": {"day": digest_day(conn), "hour": digest_hour(conn), "channel": digest_channel(conn)},
        "counts": counts, "slow_revokes": slow,
        "approvers": [{"user_id": uid, "name": names.get(uid) or None, "count": n} for uid, n in approvers.most_common()],
        "gaps": gaps,
    }


# ---------------------------------------------------------------- identity of one contact (the contact card, mockup screen 3)

def identity_of(conn: sqlite3.Connection, principal: Principal, contact_id: str) -> dict[str, Any]:
    """The access-control identity of one directory person: the link (origin, state), the live grant, an unresolved lost create and what
    the caller may do. Visible to whoever may manage contacts (tickets.configure) or holds the grant permission somewhere; anyone else -
    and an unknown id - gets the same 404."""
    contact = ag.contact_row(conn, contact_id)
    anywhere = permissions_anywhere(conn, principal)
    configure = authorize(conn, principal, "tickets.configure", INSTALLATION).allowed
    if contact is None or contact.get("kind") != "person" or not (configure or ag.PERMISSION in anywhere):
        raise ApiError(404, "access_identity_not_found", "לא נמצא.")
    link = ag.link_of_subject(conn, "contact", contact_id)
    live = ag.live_grant_of(conn, "contact", contact_id)
    ops = wj.create_ops(conn, subject=("contact", contact_id))
    open_ops = [op for op in ops if op["state"] in ("dispatched", "unknown")]
    admin = is_system_admin(conn, principal.user_id)
    unresolved = None
    if link is None and open_ops:
        unresolved = {"count": len(open_ops), "grant_id": open_ops[0].get("grant_id"),
                      "started_at": datetime.fromtimestamp(float(open_ops[0]["started_ts"]), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                      "op_id": open_ops[0]["id"] if admin and len(open_ops) == 1 else None}
    manage_all = authorize(conn, principal, ia.PEOPLE_MANAGE, INSTALLATION).allowed
    history = []
    grant_ids = [r["id"] for r in conn.execute("SELECT id FROM access_grants WHERE subject_kind = 'contact' AND subject_id = ?", (contact_id,)).fetchall()]
    res = [x for x in ([link["id"]] if link else []) + grant_ids]
    if res:
        marks = ",".join("?" * len(res))
        for r in conn.execute(f"SELECT action, at FROM audit_log WHERE resource_id IN ({marks}) AND decision = 'allowed' AND action IN "
                              "('access.person_link.create', 'access.person_link.match', 'access.person_link.unlink', 'access.person_link.name_pushed', "
                              "'access.grant.request', 'access.grant.activate', 'access.grant.end', 'access.grant.revoked', 'access.grant.confirm_gone', "
                              "'access.grant.create_recovered') ORDER BY rowid DESC LIMIT 12", res):
            history.append({"action": r["action"], "at": r["at"]})
    return {
        "contact_id": contact_id,
        "link": {"id": link["id"], "origin": link["origin"], "state": link["state"], "linked_at": link["linked_at"], "name_drift": name_drift(conn, link)} if link else None,
        "live_grant": {"id": live["id"], "state": live["state"]} if live else None,
        "unresolved": unresolved,
        "name_sync": name_sync(conn),
        "can": {
            "link": link is None and unresolved is None and configure,
            "unlink": link is not None and link["state"] != "unlinking" and configure,
            "delete": link is not None and link["origin"] == "created_from_arx" and ag.PERMISSION in anywhere and manage_all,
            "attach": admin and unresolved is not None and unresolved["count"] == 1,
            "push_name": link is not None and link["origin"] == "created_from_arx" and link["state"] == "linked" and (manage_all or bool(live)),
        },
        "history": history,
    }


# ---------------------------------------------------------------- attach a recovered person (owner decision 7)

def attach_recovered(db: Database, principal: Principal, grant_id: str, *, op_id: Any, wiskey_person_id: Any, evidence_ref: Any,
                     request_id: str | None = None) -> dict[str, Any]:
    """The route over `access_grants._attach_recovered_person` (R5-A1 / R6-A5): a system administrator states, with a per-operation
    evidence reference, that this WisKey person is the one ONE lost users/create of this grant produced. Interactive humans only. The
    helper's own guards stand (system administrator, an unresolved create, exactly one open create, the op of this grant, the person not
    linked elsewhere); every refusal - the helper's included - is audited with its code (owner Q3, 08:10: now that a caller exists).
    Nothing is written to WisKey here: the worker's normal revoke (read, strip, readback) runs on the attached person."""
    from .intercom_writes import interactive

    def refused(code: str, exc: ApiError) -> ApiError:
        with db.connection(label="access_external.attach.denied") as conn:
            ag._audit(conn, principal, "access.grant.create_recovered", grant_id, decision="denied", reason=code, request_id=request_id)
        return exc

    with db.connection(mode="read", label="access_external.attach.check") as conn:
        admin = is_system_admin(conn, principal.user_id)
    if not admin:
        raise refused("not_system_admin", ApiError(403, "not_system_admin", "רק מנהל מערכת יכול לשייך אדם ששוחזר."))
    if not interactive(principal):
        raise refused("not_interactive", ApiError(403, "access_grant_interactive_only", "שיוך אפשרי רק ממסך מחובר של אדם."))
    try:
        link = ag._attach_recovered_person(db, grant_id, str(op_id or ""), str(wiskey_person_id or ""), actor=principal, evidence_ref=evidence_ref,
                                           request_id=request_id)
    except ApiError as exc:
        field = (exc.details or {}).get("field") if isinstance(exc.details, dict) else None
        raise refused(f"{exc.code}:{field}" if field else exc.code, exc) from None
    ag.WORKER.run_grant(db, grant_id)
    return {"link": {"id": link["id"], "origin": link["origin"], "state": link["state"]}}


# ---------------------------------------------------------------- read now (the drawer's "read back now")

def read_now(db: Database, principal: Principal, grant_id: str, request_id: str | None = None) -> dict[str, Any]:
    """Run the worker on one grant now: an unknown outcome or a pending revocation reads again (the worker keeps its own holds - a read
    while an earlier write may still land decides nothing), an active grant is read back for the proof. The same authority as a revoke
    (the grant permission or people.manage on one of its stations)."""
    with db.connection(label="access_external.read_now") as conn:
        g = ag._visible_or_404(conn, principal, grant_id, also=ia.PEOPLE_MANAGE)
        stations = ag.stations_of(json.loads(g["doors_json"] or "{}"))
        if not (ag.holds_somewhere(conn, principal, ag.PERMISSION, stations) or ag.holds_somewhere(conn, principal, ia.PEOPLE_MANAGE, stations)):
            raise forbidden(permission=ag.PERMISSION, target_type=STATION, target_id=(stations or ["*"])[0], reason="no_binding")
        if g["state"] not in ("unknown", "revoking", "active"):
            raise ag._conflict("access_grant_state", "אין מה לקרוא בגישה זו.", state=g["state"])
        if g["state"] == "active":  # the next pass reads it (the hourly throttle is reset for this grant)
            conn.execute("UPDATE access_grants SET scope_checked_at = NULL WHERE id = ?", (grant_id,))
        if g["state"] == "revoking":  # the backoff is waived once: the read happens on this request
            conn.execute("UPDATE access_grants SET updated_at = ? WHERE id = ?", ("1970-01-01T00:00:00Z", grant_id))
        ag._audit(conn, principal, "access.grant.read_now", grant_id, request_id=request_id)
    ag.WORKER.run_grant(db, grant_id)
    if g["state"] == "active":
        with db.connection(mode="read", label="access_external.read_now.row") as conn:
            row = ag.grant_row(conn, grant_id)
        if row is not None and row["state"] == "active" and not row["needs_push"]:
            _verify_one(db, row, ag.now())
    with db.connection(mode="read", label="access_external.read_now.read") as conn:
        return ag.grant_row(conn, grant_id) or g


# ---------------------------------------------------------------- notices (content-free, to the managers)

def _notify(conn: sqlite3.Connection, source: str, subject_id: str, kind: str, *, dedupe: str | None = None, link: str | None = None) -> None:
    try:
        from . import notify

        notify.emit(conn, notify.Signal(source=source, subject_kind="system", subject_id=subject_id[:32], dedupe_key=dedupe or f"{source}:{subject_id[:32]}",
                                        params={"kind": kind}, link=link or screen_href(conn, subject_id if len(subject_id) == 32 else None)))
    except Exception:  # noqa: BLE001 - a notice never fails the action
        log.warning("access external: a notification failed")


# ================================================================ GRANTSMIN-295: the Arx-only leftovers SHAREDID-293 did not cover
# (private/planning/BACKLOG_RECONCILED_2026-10-20.md, grants-minor-leftovers). The denied-attempt alert stays out: it needs WisKey W-c.

def _last_verify(conn: sqlite3.Connection, grant_id: str) -> str | None:
    """The outcome of the last read-back of a grant (`verify_pass`'s audit row): proven / mismatch / unknown, or None."""
    last = conn.execute("SELECT details_json FROM audit_log WHERE action = 'access.grant.verify' AND resource_id = ? ORDER BY rowid DESC LIMIT 1",
                        (grant_id,)).fetchone()
    try:
        return json.loads(last["details_json"] or "{}").get("outcome") if last else None
    except ValueError:
        return None


# ---------------------------------------------------------------- the drift view (CR 2.3 / T12; owner decision 5)

DRIFT_ORDER = ("missing", "scope", "unknown", "sync_pending", "name", "unverified", "idle_person")


def _may_push_name(conn: sqlite3.Connection, principal: Principal, link: dict[str, Any], stations: list[str]) -> bool:
    """The same authority `push_name` checks (the interactive-session rule is the server's, at the click)."""
    if link.get("origin") != "created_from_arx" or link.get("state") != "linked":
        return False
    lacks = ag.missing_on(conn, principal, (ia.PEOPLE_MANAGE,), stations) if stations else ag._unrestricted_lacks(conn, principal, (ia.PEOPLE_MANAGE,))
    return not lacks


def _may_read_now(conn: sqlite3.Connection, principal: Principal, g: dict[str, Any] | None) -> bool:
    """The same authority `read_now` checks."""
    if g is None or g["state"] not in ("unknown", "revoking", "active"):
        return False
    stations = ag.stations_of(json.loads(g["doors_json"] or "{}"))
    return ag.holds_somewhere(conn, principal, ag.PERMISSION, stations) or ag.holds_somewhere(conn, principal, ia.PEOPLE_MANAGE, stations)


def drift(conn: sqlite3.Connection, principal: Principal) -> dict[str, Any]:
    """Per person, where Arx and WisKey differ - served ONLY from what Arx already stored (the hourly read-back's proof and audit, the
    name digests, the link state): never a WisKey read, never a WisKey value (WisKey's name is kept as a digest, so a name difference
    says only that the names differ). A person is listed when the caller may see its current grant (or, with none, one of its grants;
    `access_grants.visible`); a link with no grant at all (a manual match) only to a caller with people.manage installation-wide.
    Kinds, most urgent first:
      missing      WisKey did not find the person (the link is `wiskey_missing`; the revocation waits - see "confirmed gone");
      scope        the last complete read-back found a door map / window that is not the grant's (a WisKey-side edit, T12);
      unknown      a write's outcome is unknown (the worker reads again; nothing is decided meanwhile);
      sync_pending Arx narrowed the grant and the narrowing is not yet written and proven;
      name         WisKey's name differs from the directory name Arx would write (a person Arx created; "push the name");
      unverified   active and accepted, but no stored read-back proof (not read yet, the map unreadable, or a matched person);
      idle_person  a person Arx created in WisKey holds no live grant."""
    out: dict[str, Any] = {"enabled": ag.enabled(conn), "name_sync": name_sync(conn), "rows": [], "in_sync": 0}
    if not out["enabled"]:
        return out
    manage_all = authorize(conn, principal, ia.PEOPLE_MANAGE, INSTALLATION).allowed
    links = [dict(r) for r in conn.execute("SELECT * FROM access_person_links WHERE state IN ('linked', 'wiskey_missing') ORDER BY linked_at").fetchall()]
    for link in links:
        grants = [dict(r) for r in conn.execute("SELECT * FROM access_grants WHERE subject_kind = ? AND subject_id = ? ORDER BY created_at DESC",
                                                (link["subject_kind"], link["subject_id"])).fetchall()]
        live = ag.live_grant_of(conn, link["subject_kind"], link["subject_id"])
        if live is not None:
            if not ag.visible(conn, principal, live):
                continue  # the person's current grant is outside the caller's stations: its differences are not the caller's
        elif grants:
            if not any(ag.visible(conn, principal, g) for g in grants):
                continue
        elif not manage_all:
            continue
        diffs: list[dict[str, Any]] = []
        if link["state"] == "wiskey_missing":
            diffs.append({"kind": "missing", "grant_id": live["id"] if live else None})
        if live is not None:
            if live["state"] == "unknown":
                diffs.append({"kind": "unknown", "grant_id": live["id"]})
            elif live["state"] == "active" and live.get("needs_push"):
                diffs.append({"kind": "sync_pending", "grant_id": live["id"]})
            elif live["state"] == "active" and not ag.scope_is_proven(live):
                mismatch = bool(live.get("scope_checked_at")) and _last_verify(conn, live["id"]) == "mismatch"
                diffs.append({"kind": "scope" if mismatch else "unverified", "grant_id": live["id"]})
        ours = link["origin"] == "created_from_arx" and link["state"] == "linked"
        if ours and link["subject_kind"] == "contact" and name_drift(conn, link):
            diffs.append({"kind": "name"})
        if ours and live is None:
            ended = max((g.get("ended_at") or "" for g in grants), default="")
            diffs.append({"kind": "idle_person", "since": ended or None})
        if not diffs:
            out["in_sync"] += 1
            continue
        diffs.sort(key=lambda x: DRIFT_ORDER.index(x["kind"]))
        contact = ag.contact_row(conn, link["subject_id"]) if link["subject_kind"] == "contact" else None
        vendor = ag.contact_row(conn, contact.get("vendor_id")) if contact and contact.get("vendor_id") else None
        stations = ag.stations_of(json.loads(live["doors_json"] or "{}")) if live else []
        out["rows"].append({
            "link_id": link["id"], "contact_id": link["subject_id"], "subject_kind": link["subject_kind"],
            "name": (contact or {}).get("display_name"), "company": (vendor or {}).get("display_name"),
            "origin": link["origin"], "link_state": link["state"],
            "grant": {"id": live["id"], "state": live["state"], "doors": [{"station_id": s, "name": ag._station_name(s)} for s in stations]} if live else None,
            "diffs": diffs,
            "name_checked_at": link.get("name_checked_at"), "scope_checked_at": (live or {}).get("scope_checked_at"),
            "can": {"push_name": any(d["kind"] == "name" for d in diffs) and _may_push_name(conn, principal, link, stations),
                    "read_now": _may_read_now(conn, principal, live)},
        })
    out["rows"].sort(key=lambda r: (DRIFT_ORDER.index(r["diffs"][0]["kind"]), r["name"] or ""))
    return out


# ---------------------------------------------------------------- the external-access CSV (the screen's export)

EXPORT_RATE_S = 60.0      # one export a minute per user (the tickets table's rule)
EXPORT_MAX_ROWS = 5000
_export_last: dict[str, float] = {}

EXPORT_COLUMNS = ("name", "company", "category", "state", "doors", "valid_from", "valid_until", "source", "source_ref", "approved_by", "approved_at",
                  "ended_at", "record", "phone", "code_state", "grant_id")
EXPORT_HEADERS: dict[str, dict[str, str]] = {
    "he": {"name": "שם", "company": "חברה", "category": "סוג", "state": "מצב", "doors": "דלתות", "valid_from": "מתאריך", "valid_until": "עד",
           "source": "מקור", "source_ref": "הפניה", "approved_by": "אושר על ידי", "approved_at": "אושר ב", "ended_at": "הסתיים ב",
           "record": "רשומת WisKey", "phone": "טלפון", "code_state": "מצב הקוד", "grant_id": "מזהה גישה"},
    "en": {"name": "Name", "company": "Company", "category": "Kind", "state": "State", "doors": "Doors", "valid_from": "From", "valid_until": "Until",
           "source": "Source", "source_ref": "Reference", "approved_by": "Approved by", "approved_at": "Approved at", "ended_at": "Ended at",
           "record": "WisKey record", "phone": "Phone", "code_state": "Code", "grant_id": "Grant id"},
}
# the screen's own state words (frontend/src/i18n/access-external.ts st_*), so the file reads like the list
STATE_TEXT: dict[str, dict[str, str]] = {
    "he": {"draft": "טיוטה", "pending": "ממתין לאישור", "pushing": "נשלח · ממתין לתשובה", "verified": "פעיל · אומת", "accepted": "פעיל · טרם אומת",
           "sync": "פעיל · שינוי ממתין", "unknown": "לא ידוע", "revoking": "בביטול · התראה כל שעה", "revoked": "בוטל", "ended": "הסתיים",
           "refused": "נדחה", "failed": "נכשל", "gone": "נסגר · אושר ידנית שאינו קיים"},
    "en": {"draft": "Draft", "pending": "Awaiting approval", "pushing": "Sent · awaiting answer", "verified": "Active · verified",
           "accepted": "Active · not yet verified", "sync": "Active · change pending", "unknown": "Unknown", "revoking": "Revoking · hourly alert",
           "revoked": "Revoked", "ended": "Ended", "refused": "Refused", "failed": "Failed", "gone": "Closed · confirmed gone"},
}
CATEGORY_TEXT = {"he": {"contractor": "קבלן", "visitor": "מבקר"}, "en": {"contractor": "Contractor", "visitor": "Visitor"}}
SOURCE_TEXT = {"he": {"manual": "ידני", "ticket": "קריאה", "rfq_order": "הזמנת עבודה"}, "en": {"manual": "Manual", "ticket": "Ticket", "rfq_order": "Work order"}}
RECORD_TEXT = {"he": {"created_from_arx": "נוצר מ-Arx", "matched": "קושר לאדם קיים", "": "אין"},
               "en": {"created_from_arx": "Created by Arx", "matched": "Matched to an existing person", "": "None"}}
CODE_TEXT = {"he": {"not_needed": "לא נדרש", "pending": "ממתין", "queued": "בתור", "sent": "נשלח", "not_delivered": "לא נמסר", "unknown": "לא ידוע"},
             "en": {"not_needed": "Not needed", "pending": "Pending", "queued": "Queued", "sent": "Sent", "not_delivered": "Not delivered", "unknown": "Unknown"}}


def reset_export_rate() -> None:
    """Tests only."""
    _export_last.clear()


def export_wait(user_id: str, now: float | None = None) -> float:
    """Seconds the user must still wait (0 = may export now). Only a successful export counts (`export_mark`)."""
    now = time.monotonic() if now is None else now
    last = _export_last.get(user_id)
    return 0.0 if last is None else max(0.0, EXPORT_RATE_S - (now - last))


def export_mark(user_id: str) -> None:
    _export_last[user_id] = time.monotonic()


def may_export(conn: sqlite3.Connection, principal: Principal) -> bool:
    """Who may take the file: a holder of the grant permission or of people.read somewhere (each row is still checked with `visible`),
    or a directory editor (tickets.configure)."""
    anywhere = permissions_anywhere(conn, principal)
    return ag.PERMISSION in anywhere or ia.PEOPLE_READ in anywhere or authorize(conn, principal, "tickets.configure", INSTALLATION).allowed


def ui_state(p: dict[str, Any]) -> str:
    """frontend/src/access-external/model.ts uiState(), on a `present()` dict."""
    closure = p.get("closure")
    if closure and not closure.get("reappeared_at") and p["state"] != "revoking":
        return "gone"
    s = p["state"]
    if s == "requested":
        return "draft" if p["person"].get("pending") else "pending"
    if s in ("approved", "provisioning"):
        return "pushing"
    if s == "active":
        return "sync" if p.get("needs_push") else "verified" if p.get("scope_verified") else "accepted"
    return s if s in ("unknown", "revoking", "ended", "revoked", "refused") else "failed"


def _phone_cell(conn: sqlite3.Connection, viewer: Any, g: dict[str, Any], sensitive: bool, cache: dict[str, Any]) -> str:
    """The number at the level the caller may see it, never more than BOTH rules allow: nothing below people.sensitive on every station
    of the grant (the screen's rule); the screen's mask (····NN) at that level; the full number only when the directory would also show
    it to this caller (tickets/contacts.full_phone_for: a directory editor, a manager with tickets.external over the contact's
    department, or the installation's "managers see full numbers" setting for the manager's own departments)."""
    from .tickets import contacts as tcontacts
    from .tickets import store_links

    if not sensitive or g["subject_kind"] != "contact":
        return ""
    contact = ag.contact_row(conn, g["subject_id"])
    if not contact or not contact.get("phone_e164"):
        return ""
    if "managed" not in cache:
        cache["configure"] = tcontacts.may_configure(viewer)
        cache["managed"] = tcontacts.managed_departments(viewer)
        cache["unmask"] = tcontacts.managers_unmask(conn)
    depts = store_links.contact_departments(conn, contact["id"])
    if tcontacts.full_phone_for(viewer, depts, cache["managed"], cache["configure"], cache["unmask"]):
        return tcontacts.display_phone(contact["phone_e164"]) or ""
    return ag.mask_number(contact) or ""


def _local(iso: str | None, tz: Any) -> str:
    at = ag.parse_iso(iso) if iso else None
    return at.astimezone(tz).strftime("%Y-%m-%d %H:%M") if at else ""


def export_rows(conn: sqlite3.Connection, principal: Principal, *, live_only: bool, lang: str) -> list[list[Any]]:
    """Header + one row per grant the caller may see (`visible`), newest first, at most EXPORT_MAX_ROWS (413 above). Every cell through
    the shared formula guard (tickets/text_hygiene.csv_cell); times in the installation's zone. Never a code (Arx holds none), never a
    WisKey id or value; the delivery state and the number only at the people-sensitive level (as on the screen)."""
    from .tickets.access import Viewer
    from .tickets.text_hygiene import csv_cell

    lang = lang if lang in EXPORT_HEADERS else "he"
    if live_only:
        marks = ",".join("?" * len(ag.LIVE))
        rows = conn.execute(f"SELECT * FROM access_grants WHERE state IN ({marks}) ORDER BY created_at DESC", ag.LIVE).fetchall()
    else:
        rows = conn.execute("SELECT * FROM access_grants ORDER BY created_at DESC").fetchall()
    seen = [dict(r) for r in rows if ag.visible(conn, principal, dict(r))]
    if len(seen) > EXPORT_MAX_ROWS:
        raise ApiError(413, "export_too_large", "יותר מדי שורות לייצוא.", details={"max_rows": EXPORT_MAX_ROWS})
    tz = ag.zone_of(conn)
    viewer = Viewer(conn, principal)
    cache: dict[str, Any] = {}
    out: list[list[Any]] = [[csv_cell(EXPORT_HEADERS[lang][c]) for c in EXPORT_COLUMNS]]
    for g in seen:
        p = ag.present(conn, principal, g)
        doors = json.loads(g["doors_json"] or "{}")
        stations = ag.stations_of(doors)
        sensitive = bool(stations) and all(authorize(conn, principal, ia.PEOPLE_SENSITIVE, (STATION, s)).allowed for s in stations)
        values = {
            "name": p["person"]["name"] or "", "company": p.get("company") or "", "category": CATEGORY_TEXT[lang].get(p.get("category") or "", ""),
            "state": STATE_TEXT[lang][ui_state(p)], "doors": ", ".join(dict.fromkeys(d["name"] for d in p["doors"])),
            "valid_from": _local(p["valid_from"], tz), "valid_until": _local(p["valid_until"], tz),
            "source": SOURCE_TEXT[lang].get(p["source"], p["source"]), "source_ref": p["source_ref"] or "",
            "approved_by": p.get("approved_by_name") or "", "approved_at": _local(p.get("approved_at"), tz), "ended_at": _local(p.get("ended_at"), tz),
            "record": RECORD_TEXT[lang][(p.get("link") or {}).get("origin") or ""],
            "phone": _phone_cell(conn, viewer, g, sensitive, cache),
            "code_state": CODE_TEXT[lang].get(p["code_state"] or "", "") if sensitive and p["code_state"] else "",
            "grant_id": p["id"],
        }
        out.append([csv_cell(values[c]) for c in EXPORT_COLUMNS])
    return out


def export_stream(cells: list[list[Any]]) -> Iterator[bytes]:
    """UTF-8 with a BOM, every cell quoted, CRLF (the tickets export's format)."""
    yield "﻿".encode("utf-8")
    for i in range(0, len(cells), 200):
        buf = io.StringIO(newline="")
        csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n").writerows(cells[i:i + 200])
        yield buf.getvalue().encode("utf-8")


def export_filename(conn: sqlite3.Connection) -> str:
    """An ASCII name (the display texts may be any script)."""
    return "external-access-" + datetime.now(ag.zone_of(conn)).strftime("%Y%m%d-%H%M") + ".csv"


# ---------------------------------------------------------------- the person's data export (tickets 15.2, CR 2.6 "Rights")

def rights_export(conn: sqlite3.Connection, contact_id: str) -> dict[str, Any]:
    """What `GET /tickets/contacts/{id}/export` adds for one person (the caller - tickets.configure - is checked there): the link's origin
    and state, and every grant still kept (window, doors by name, state, the notice acknowledgements). WisKey's ids, PINs (Arx holds
    none), the closure's free-text reference and the phone (already in the export's contact row) are not repeated here."""
    try:
        link = ag.link_of_subject(conn, "contact", contact_id)
        rows = [dict(r) for r in conn.execute("SELECT * FROM access_grants WHERE subject_kind = 'contact' AND subject_id = ? ORDER BY created_at",
                                              (contact_id,)).fetchall()]
    except sqlite3.OperationalError:  # a database before 0107
        return {"link": None, "grants": []}
    grants = []
    for g in rows:
        doors = json.loads(g["doors_json"] or "{}")
        notices = conn.execute("SELECT via, version, at FROM access_grant_notices WHERE grant_id = ? ORDER BY at", (g["id"],)).fetchall()
        grants.append({
            "id": g["id"], "state": g["state"], "end_reason": g["end_reason"], "source": g["source_kind"], "source_ref": g["source_ref"],
            "valid_from": g["valid_from"], "valid_until": g["valid_until"], "timing": json.loads(g["timing_json"]) if g["timing_json"] else None,
            "credential": g["credential"], "doors": [{"station_id": s, "name": ag._station_name(s), "relays": doors[s]} for s in ag.stations_of(doors)],
            "created_at": g["created_at"], "approved_at": g["approved_at"], "ended_at": g.get("ended_at"),
            "notices": [{"via": n["via"], "version": n["version"], "at": n["at"]} for n in notices],
        })
    return {"link": {"origin": link["origin"], "state": link["state"], "linked_at": link["linked_at"]} if link else None, "grants": grants}
