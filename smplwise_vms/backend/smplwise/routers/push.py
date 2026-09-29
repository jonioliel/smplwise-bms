"""Web Push (CR-008 P3): the VAPID public key, the caller's own push subscriptions, notification preferences and a
test notification. Every route acts on the calling HA user only - there is no way to list, move or delete another
user's subscription, and the same user id is used whether the request came through Ingress or the remote channel."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import Database, database_of, unlocked
from ..errors import ApiError, not_found
from ..rbac import INSTALLATION, Principal, require
from ..services import push as svc

router = APIRouter()
HHMM = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class Keys(BaseModel):
    p256dh: str = Field(min_length=40, max_length=200)
    auth: str = Field(min_length=10, max_length=64)


class SubscriptionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")  # PushSubscription.toJSON() also carries expirationTime

    endpoint: str = Field(min_length=12, max_length=svc.MAX_ENDPOINT_LEN)
    keys: Keys
    user_agent: str | None = Field(default=None, max_length=400)
    old_endpoint: str | None = Field(default=None, max_length=svc.MAX_ENDPOINT_LEN)


class Categories(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alerts: bool = True
    doors: bool = True
    device_faults: bool = True
    system: bool = True


class Quiet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = False
    from_: str = Field(default="22:00", alias="from", pattern=HHMM)
    to: str = Field(default="07:00", pattern=HHMM)
    allow_critical: bool = True

    @model_validator(mode="after")
    def _not_empty(self) -> "Quiet":
        if self.from_ == self.to:
            raise ValueError("quiet hours need two different times (from == to is an empty window)")
        return self


class PrefsIn(BaseModel):
    categories: Categories = Field(default_factory=Categories)
    quiet: Quiet = Field(default_factory=Quiet)


@router.get("/push/vapid-key")
def vapid_key(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The installation's VAPID public key (applicationServerKey); the pair is created on the first call (a short side
    transaction; afterwards this is a read)."""
    key = svc.vapid_public_key(conn)
    if key is None:
        db = database_of(conn)
        assert db is not None
        with db.write_aside() as w:
            key = svc.ensure_vapid(w)
    return {"public_key": key}


@router.post("/push/rotate-key")
def rotate_key(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Replace the installation's VAPID key pair (system.configure): every subscription is removed; browsers that still
    allow notifications re-subscribe with the new key the next time Arx opens there."""
    require(conn, principal, "system.configure", INSTALLATION)
    key, removed = svc.rotate_key(conn)
    audit(conn, actor=principal, action="push.key.rotate", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
          details={"subscriptions_removed": removed})
    return {"public_key": key, "subscriptions_removed": removed}


@router.get("/push/subscriptions")
def list_subscriptions(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {"subscriptions": svc.list_own(conn, principal.user_id)}


@router.post("/push/subscriptions", status_code=201)
def subscribe(body: SubscriptionIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Register (or refresh) this browser's push subscription for the caller. Idempotent per endpoint: the app calls it
    on every start so `last_seen_at` stays fresh and a replaced subscription (pushsubscriptionchange) is picked up."""
    ua = body.user_agent or request.headers.get("user-agent")
    svc.ensure_vapid(conn)  # a subscription is only useful with the key pair it was made for
    try:
        row, previous, created = svc.upsert(conn, principal, body.endpoint, body.keys.p256dh, body.keys.auth, ua, body.old_endpoint)
    except svc.InvalidSubscription as exc:
        audit(conn, actor=principal, action="push.subscription.create", decision="denied", resource_type="push_subscription", reason=exc.code,
              request_id=_rid(request), details={"endpoint_host": svc.endpoint_host(body.endpoint)})
        raise ApiError(422, exc.code, exc.message) from None
    if previous or created:
        audit(conn, actor=principal, action="push.subscription.create", decision="allowed", resource_type="push_subscription", resource_id=row["id"],
              request_id=_rid(request), details={"endpoint_host": row["endpoint_host"], "channel": principal.source, **({"moved_from_user": previous} if previous else {})})
    return row


@router.delete("/push/subscriptions/{sub_id}", status_code=204)
def unsubscribe(sub_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    r = conn.execute("SELECT id, user_id, endpoint FROM push_subscriptions WHERE id = ?", (sub_id,)).fetchone()
    if r is None or r["user_id"] != principal.user_id:
        if r is not None:  # another user's subscription answers exactly like a missing one; the attempt is audited
            audit(conn, actor=principal, action="push.subscription.delete", decision="denied", resource_type="push_subscription", resource_id=sub_id,
                  reason="not_owner", request_id=_rid(request))
        raise not_found("ההרשמה להתראות לא נמצאה.")
    conn.execute("DELETE FROM push_subscriptions WHERE id = ?", (sub_id,))
    audit(conn, actor=principal, action="push.subscription.delete", decision="allowed", resource_type="push_subscription", resource_id=sub_id,
          request_id=_rid(request), details={"endpoint_host": svc.endpoint_host(r["endpoint"])})
    return Response(status_code=204)


@router.get("/push/prefs")
def get_prefs(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {**svc.get_prefs(conn, principal.user_id), "category_ids": list(svc.CATEGORIES)}


@router.put("/push/prefs")
def put_prefs(body: PrefsIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    prefs = svc.set_prefs(conn, principal.user_id, body.categories.model_dump(), body.quiet.model_dump(by_alias=True))
    audit(conn, actor=principal, action="push.prefs.update", decision="allowed", resource_type="user", resource_id=principal.user_id, request_id=_rid(request),
          details={"categories": prefs["categories"], "quiet": prefs["quiet"]})
    return {**prefs, "category_ids": list(svc.CATEGORIES)}


@router.post("/push/test")
def test_push(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Send a test notification to the caller's own devices now (3 per minute per user)."""
    if not svc.take_token(principal.user_id, "test"):
        raise ApiError(429, "rate_limited", "יותר מדי התראות בדיקה. נסו שוב בעוד דקה.", retryable=True)
    if not conn.execute("SELECT 1 FROM push_subscriptions WHERE user_id = ?", (principal.user_id,)).fetchone():
        raise ApiError(409, "push_not_subscribed", "המכשיר הזה (וכל מכשיר אחר שלך) עדיין לא נרשם להתראות.")
    audit(conn, actor=principal, action="push.test", decision="allowed", resource_type="user", resource_id=principal.user_id, request_id=_rid(request))
    db: Database = request.app.state.db
    with unlocked(conn):  # the push services are called without the request's write lock
        results = svc.send_test(db, principal.user_id)
    return {"results": results, "sent": sum(1 for r in results if r["outcome"] == "sent")}
