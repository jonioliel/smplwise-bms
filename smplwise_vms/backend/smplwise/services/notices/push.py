"""NOTICEPUSH-295 (CR-NOTICE106 section 7, slice 2): a published notice as a source in the notification pipeline (CR-018).

* ONE signal `notice.published` on publish (dedupe key `notice:<id>:<push_generation>`), inside the publish transaction; the notifier
  thread sends after the commit through each recipient's own channels (inbox always, web push, the phone app, WhatsApp when it is on).
* Recipients = the notice's audience (`audience.resolve_users`, the same function as the compose preview and the reading test). A TV-only
  notice (an empty audience) pushes nobody. The notification centre then intersects the list with visibility (`can_see`): the audience,
  or a holder of `notices.manage`.
* Resolved when the notice is archived, and by the janitor once it has ended (`resolve_ended`), so the inbox never keeps a dead notice.
* Editing a published notice never pushes again; there is no re-send in this slice.
* Whether a publish pushes: the author's explicit tick wins (`push` true / false). Without one, the setting `notices.push_default`:
  `always`, `never`, or `by_severity` (the default: only a critical notice). An explicit tick needs `notices.push`; the default is the
  administrator's policy and needs nothing from the author.
The payload carries the notice's title and its first 160 characters - never a person, never the audience."""
from __future__ import annotations

import logging
import sqlite3
from typing import Any

from ...db import now_iso
from . import audience as aud
from . import model, store

log = logging.getLogger(__name__)

SOURCE = "notice.published"
SUBJECT = "notice"
BODY_MAX = 160


def key_of(notice_id: str, generation: int) -> str:
    return f"notice:{notice_id}:{generation}"


def default_push(mode: str, severity: str) -> bool:
    """`notices.push_default` applied to one severity (CR section 3.3: only a critical notice by severity)."""
    if mode == "always":
        return True
    if mode == "never":
        return False
    return severity == "critical"


def effective(conn: sqlite3.Connection, severity: str, explicit: bool | None) -> bool:
    """The author's tick when there is one, the installation's default otherwise."""
    if explicit is not None:
        return bool(explicit)
    return default_push(store.settings(conn)["push_default"], severity)


def _clip(text: str, n: int) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


def send(conn: sqlite3.Connection, notice: dict[str, Any], actor_id: str | None, *, explicit: bool | None) -> dict[str, Any]:
    """Called once, right after a draft became published. Returns {requested, sent, recipients}; never raises into the publish."""
    want = effective(conn, notice["severity"], explicit)
    out: dict[str, Any] = {"requested": want, "sent": False, "recipients": 0}
    if not want:
        return out
    audience = aud.parse(notice["audience_json"])
    users = aud.resolve_users(conn, audience)
    out["recipients"] = len(users)
    conn.execute("UPDATE notices SET push_requested = 1 WHERE id = ?", (notice["id"],))
    if not users:  # a TV-only notice, or an audience nobody is in
        return out
    from .. import notify

    gen = int(notice.get("push_generation") or 0)
    try:
        res = notify.emit_full(conn, notify.Signal(
            source=SOURCE, subject_kind=SUBJECT, subject_id=notice["id"], severity=notice["severity"], dedupe_key=key_of(notice["id"], gen),
            link="#/devices/notices", initiator_user_id=actor_id,
            params={"name": _clip(notice["title"], 80), "body": _clip(notice["body"], BODY_MAX), "ends_at": notice.get("ends_at") or ""},
            origin={"notice_id": notice["id"], "user_id": actor_id}, category="building"))
    except Exception:  # noqa: BLE001 - a notification problem never blocks the publish
        log.warning("could not push a notice", exc_info=True)
        out["error"] = "emit_failed"
        return out
    out["sent"] = res.action in ("created", "folded", "renotified")
    if out["sent"]:
        conn.execute("UPDATE notices SET pushed_at = COALESCE(pushed_at, ?) WHERE id = ?", (now_iso(), notice["id"]))
    return out


def resolve(conn: sqlite3.Connection, notice_id: str, generation: int, reason: str) -> None:
    """Close the open notification of a notice (archived / ended). Never raises into a write."""
    from .. import notify

    try:
        notify.emit_full(conn, notify.Signal(source=SOURCE, subject_kind=SUBJECT, subject_id=notice_id, dedupe_key=key_of(notice_id, generation),
                                             resolve=True, params={"resolution": reason}))
    except Exception:  # noqa: BLE001
        log.warning("could not resolve a notice notification", exc_info=True)


def resolve_ended(conn: sqlite3.Connection, now: Any = None) -> int:
    """The janitor step: every open notice notification whose notice is archived, deleted or past its end gets resolved."""
    at = now or store.utcnow()
    n = 0
    for r in conn.execute("SELECT id, subject_id FROM notifications WHERE source = ? AND state != 'resolved'", (SOURCE,)).fetchall():
        notice = store.get_notice(conn, r["subject_id"] or "")
        reason = None
        if notice is None:
            reason = "deleted"
        elif notice["status"] == "archived":
            reason = "archived"
        elif model.effective_state(notice, at) == "expired":
            reason = "expired"
        if reason:
            resolve(conn, r["subject_id"], int(notice.get("push_generation") or 0) if notice else 0, reason)
            n += 1
    return n


def recipient_users(conn: sqlite3.Connection, n: dict[str, Any]) -> list[str]:
    """Recipient rule `notice`: the audience of the notification's notice."""
    notice = store.get_notice(conn, str(n.get("subject_id") or ""))
    if notice is None or notice["status"] == "draft":
        return []
    return aud.resolve_users(conn, aud.parse(notice["audience_json"]))


def can_see(conn: sqlite3.Connection, principal: Any, notice_id: Any) -> bool:
    """Visibility of a notice notification: the module is on and the user is in the audience or holds notices.manage."""
    if not store.module_on(conn) or not notice_id:
        return False
    notice = store.get_notice(conn, str(notice_id))
    if notice is None:
        return False
    from ...rbac import permissions_anywhere

    if model.PERM_MANAGE in permissions_anywhere(conn, principal):
        return True
    return aud.in_audience(conn, principal.user_id, aud.parse(notice["audience_json"]))
