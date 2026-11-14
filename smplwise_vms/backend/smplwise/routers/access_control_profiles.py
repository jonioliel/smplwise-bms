"""WISKEY-PROFILES-EDIT-2390 (plan 2026-11-03 T8; owner decision 03.11 Q4 "a"): the groups and profile fields editor of the access-control
area - view, draft, WisKey's impact preview, apply after a confirmation that shows that impact, the versions list, compare, a rollback
draft from a version, and the group suggestions for one person. The commands and their meaning: services/wiskey_profiles.py.

Permission (the owner's brief): `access.people.manage` at INSTALLATION scope - unrestricted (allowed at the installation and no deny of
it on any site, building or station: the policy is installation-wide in WisKey, a group can grant any station). Checked on every endpoint
before anything else; a refusal is audited (403). `GET /access-control/profiles/access` answers what the caller may do without a 403 (the
entry buttons of the people screen and the Settings view ask it and stay hidden otherwise).

Endpoints (the browser never names a WisKey command and never sees WisKey's operation id):
- `GET  /access-control/profiles` - the current policy (revision, photo switch, fields with their conditions, groups with their
  stations; templates counted only), the stations Arx knows (id, name, managed lock), and which parts this WisKey offers.
- `POST /access-control/profiles/preview` `{revision, values}` - the draft checked with WisKey's own limits (422 with every problem,
  nothing sent), then WisKey's `profiles/settings_preview`: the people whose stations change (before / after), the stations WisKey will
  sync, the offline ones, each changed field's diagnostics (missing / invalid values, duplicates for a unique field), whether it can be
  applied. Arx keeps WisKey's operation id in a review of this user (services/wiskey_profiles.Reviews) and answers its `review_id`, the
  diff (before / after per property) and the review's expiry. An audit row `intercom.profiles_preview` (counts only).
- `POST /access-control/profiles/apply` `{review_id, confirmed: true, client_request_id, expires_at}` - the command envelope of the
  writes. Refused and audited as `not_sent` before anything is sent: no confirmation, an expired / duplicate envelope, an unknown or
  expired review, a review of another user, a review already applied (the stored result is answered again, nothing is sent) or whose
  outcome is unknown (409: check first). Then the attempt row (actor, review, base revision, the diff before -> after, the impact
  counts), `profiles/settings_apply` sent ONCE on the `profiles` channel in the config lane, the outcome row, and a READBACK of the
  policy: the reply says `saved` with WisKey's receipt (when, how many people changed, the stations WisKey queued a sync for) and
  whether the policy WisKey serves now is the one that was confirmed (`readback.matches`); the stations themselves are NOT verified
  (`physical_result: not_verified`). A refusal by WisKey (expired, stale, conflict, a duplicate in a unique field) is an HTTP error with
  `details.outcome = refused` and WisKey's code; no clear answer is 504 `unknown` and the review stays blocked until `check`.
- `POST /access-control/profiles/reviews/{review_id}/check` - the readback after an unknown apply: `applied` (the policy is the confirmed
  one, one revision on), `not_applied` (unchanged - the review can be applied again while WisKey still holds it), `changed_elsewhere`.
- `GET  /access-control/profiles/versions` - WisKey's retained history (metadata; never who).
- `GET  /access-control/profiles/compare?before=&after=` - WisKey's compare of two retained versions.
- `GET  /access-control/profiles/versions/{revision}/draft` - a rollback DRAFT to that version (compare -> rebuilt values + notes of what
  cannot be exact); nothing is written - the editor loads it and the normal preview / confirm / apply follows.
- `GET  /access-control/profiles/suggestions?user_id=&field=` (0..3 fields) - WisKey's read-only group suggestions for one person. The
  person's own field values are shown only to a holder of `access.people.sensitive` at installation scope (null otherwise).

Audit rows never hold a person's value, a credential, a host or WisKey's operation id."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from ..audit import audit
from ..auth import current_principal_ro, get_conn, get_read_conn, read_gate, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_adapter as ad
from ..services import intercom_authority as ia
from ..services import intercom_sync
from ..services import wiskey_profiles as wp
from .access_control import CommandEnvelope, _Action, _envelope, _parse, _raw_body

router = APIRouter()
PERMISSION = ia.PEOPLE_MANAGE
AUDIT_PREVIEW = "intercom.profiles_preview"
AUDIT_APPLY = "intercom.profiles_apply"
AUDIT_CHECK = "intercom.profiles_check"
RESOURCE = "intercom_profiles"
REVIEW_PATTERN = r"^[0-9a-f]{32}$"
USER_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$"
FIELD_PATTERN = r"^[a-z][a-z0-9_]{0,47}$"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _require(conn: sqlite3.Connection, principal: Principal, request_id: str | None) -> ia.Authority:
    """`access.people.manage` somewhere (audited 403 otherwise), then unrestricted - installation scope, no deny (audited 403)."""
    auth = ia.require_anywhere(conn, principal, PERMISSION, request_id)
    ia.require_unrestricted(auth, PERMISSION, request_id)
    return auth


def _editor(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    return _require(conn, principal, _rid(request))


_editor_ro = read_gate(lambda conn, principal: _require(conn, principal, None))


def _feed(settings: Any) -> dict[str, Any]:
    return {"configured": bool(getattr(settings, "ha_url", None) and getattr(settings, "ha_token", None)), "sync": intercom_sync.STATE.as_dict()}


def _features(settings: Any) -> dict[str, Any]:
    api = intercom_sync.SYNC.api_facts(settings)
    out = {}
    for part in wp.FEATURES:
        available, reason = wp.feature_state(api, part)
        out[part] = {"available": available, "reason": reason}
    return out


def _unsupported(settings: Any, part: str) -> ApiError | None:
    available, reason = wp.feature_state(intercom_sync.SYNC.api_facts(settings), part)
    if available is False:
        return ApiError(409, "profiles_unsupported", "מערכת בקרת הכניסה אינה מציעה את הפעולה הזו בגרסה המותקנת. לא נשלח דבר.", details={"reason": reason, "part": part,
                                                                                                                                  "outcome": "not_sent"})
    return None


def _read_policy(request: Request, who: str) -> dict[str, Any]:
    """`profiles/settings_get` on the READ channel (never the adapter's cache: the editor must see the policy as it is now)."""
    return intercom_sync.SYNC.command(settings_of(request), "policy", ad.profiles_settings, wp.project_policy, who=who, channel="read")


def _stations(request: Request) -> list[dict[str, Any]]:
    sup = intercom_sync.SYNC.stations_superset(settings_of(request))
    return [{"id": s.get("id"), "name": s.get("name") or s.get("id"), "online": bool(s.get("online")), "lock_enabled": bool(s.get("lock_enabled"))}
            for s in sup.get("stations") or [] if isinstance(s.get("id"), str)]


def _read_error(reply: dict[str, Any], what: str) -> ApiError:
    state, code = reply.get("state"), reply.get("last_error")
    if state == "forbidden":
        return ApiError(403, "profiles_forbidden", f"מערכת בקרת הכניסה אינה מתירה לשירות לקרוא {what}.", details={"state": state, "wiskey_code": code})
    if state == "unsupported":
        return ApiError(409, "profiles_unsupported", "מערכת בקרת הכניסה אינה מציעה את הקריאה הזו.", details={"state": state, "wiskey_code": code})
    return ApiError(503, "profiles_unavailable", f"לא ניתן לקרוא כעת {what} ממערכת בקרת הכניסה ({code or state}).", retryable=True, details={"state": state, "wiskey_code": code})


# ---------------------------------------------------------------- access (no 403: the entry buttons ask it)

@router.get("/access-control/profiles/access")
def profiles_access(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    auth = ia.Authority(conn, principal)
    can = auth.unrestricted(PERMISSION)
    return {"can_edit": can, "sensitive": can and auth.unrestricted(ia.PEOPLE_SENSITIVE)}


# ---------------------------------------------------------------- the policy

@router.get("/access-control/profiles")
def profiles_view(request: Request, auth: ia.Authority = Depends(_editor)) -> dict[str, Any]:
    settings = settings_of(request)
    features = _features(settings)
    base = {**_feed(settings), "features": features, "stations": _stations(request), "policy": None, "fetched_at": None, "last_error": None}
    if features["view"]["available"] is False:
        return {**base, "state": "unsupported", "last_error": features["view"]["reason"]}
    reply = _read_policy(request, auth.principal.user_id)
    return {**base, "state": reply.get("state"), "last_error": reply.get("last_error"), "fetched_at": reply.get("fetched_at"), "policy": reply.get("policy")}


# ---------------------------------------------------------------- preview

class PreviewBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: StrictInt = Field(ge=0, le=10**9)
    values: dict[str, Any]


def _sensitive(auth: ia.Authority) -> bool:
    return auth.unrestricted(ia.PEOPLE_SENSITIVE)


def _impact_view(impact: dict[str, Any], sensitive: bool, names: dict[str, str]) -> dict[str, Any]:
    """The impact as this caller sees it: the employee number only with the sensitive level; station names from the served copy."""
    out = {k: v for k, v in impact.items() if not k.startswith("_")}
    if not sensitive:
        out["people"] = [{**p, "employee_no": None} for p in out["people"]]
        out["field_changes"] = [{**f, "examples": [{**e, "employee_no": None} for e in f["examples"]],
                                 "duplicate_examples": [{**e, "employee_no": None} for e in f["duplicate_examples"]]} for f in out["field_changes"]]
    out["station_names"] = {s: names.get(s, s) for s in set(out["stations"]) | set(out["offline"]) | {x for p in out["people"] for x in p["before"] + p["after"]}}
    return out


def _counts(impact: dict[str, Any]) -> dict[str, Any]:
    return {"people_listed": len(impact["people"]), "changed": impact["changed"], "stations": len(impact["stations"]), "offline": len(impact["offline"]),
            "fields_checked": len(impact["field_changes"]), "duplicates": sum(f["duplicates"] for f in impact["field_changes"]),
            "missing": sum(f["missing"] for f in impact["field_changes"]), "invalid": sum(f["invalid"] for f in impact["field_changes"]), "can_apply": impact["can_apply"]}


@router.post("/access-control/profiles/preview")
def profiles_preview(request: Request, principal: Principal = Depends(_editor_ro), raw: bytes = Depends(_raw_body),
                     conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """On the READ connection: nothing is stored by a preview, and no write lock is held while WisKey computes the impact (its audit
    rows go through the audit's own short write)."""
    act = _Action(request, conn, principal, AUDIT_PREVIEW, "policy", RESOURCE)
    body: PreviewBody = _parse(act, PreviewBody, raw)
    settings = settings_of(request)
    if (exc := _unsupported(settings, "edit")) is not None:
        raise act.refuse(exc)
    current_reply = _read_policy(request, principal.user_id)
    current = current_reply.get("policy")
    if current is None:
        raise act.refuse(_read_error(current_reply, "את ההגדרות הנוכחיות"))
    stations = _stations(request)
    known = {s["id"] for s in stations} | {sid for g in current["groups"] for sid in (g.get("station_ids") or [])}
    try:
        values = wp.normalize_draft(body.values, known)
    except wp.DraftError as exc:
        raise act.refuse(ApiError(422, "profiles_invalid_draft", "הטיוטה אינה תקינה. תקנו את השדות המסומנים - לא נשלח דבר.", details={"problems": exc.problems})) from None
    if body.revision != current["revision"]:
        act.details.update(base_revision=body.revision, current_revision=current["revision"])
        raise act.refuse(ApiError(409, "profiles_revision_conflict", "ההגדרות השתנו מאז שהטיוטה נפתחה. טענו מחדש את הגרסה הנוכחית - לא נשלח דבר.",
                                  details={"current_revision": current["revision"], "base_revision": body.revision}))
    before = wp.values_of(current)
    removed = wp.removed_definitions(before, values)
    if removed:
        raise act.refuse(ApiError(422, "profiles_definition_removed", "אי אפשר למחוק שדה או קבוצה קיימים - אפשר רק להשבית אותם.", details={"ids": removed[:20]}))
    added = wp.stations_added(before, values)
    by_id = {s["id"]: s for s in stations}
    unmanaged = sorted(s for s in added if s in by_id and not by_id[s]["lock_enabled"])
    if unmanaged:
        raise act.refuse(ApiError(422, "profiles_unmanaged_lock", "לחלק מהעמדות שנבחרו אין מנעול מנוהל, ולכן אי אפשר לשייך אותן לקבוצה.", details={"stations": unmanaged}))
    diff = wp.diff_rows(before, values)
    act.details.update(base_revision=body.revision, diff_rows=len(diff))
    try:
        reply = intercom_sync.SYNC.action(settings, "preview", lambda call: wp.preview(call, body.revision, values), wp.project_preview, who=principal.user_id,
                                          lane=wp.LANE, channel=wp.CHANNEL)
    except ApiError as exc:
        code = str(exc.details.get("wiskey_code") or exc.code)
        outcome = str(exc.details.get("outcome") or "unknown")
        audit(conn, actor=principal, action=AUDIT_PREVIEW, decision="denied", resource_type=RESOURCE, resource_id="policy", reason=code, request_id=act.rid,
              details={**act.details, "phase": "wiskey", "outcome": outcome, "wiskey_code": code})
        raise _wiskey_error(exc, "preview") from None
    impact = reply["preview"]
    review = wp.REVIEWS.add(principal.user_id, impact["_operation_id"], body.revision, values, before, diff, impact, impact["expires_in"])
    audit(conn, actor=principal, action=AUDIT_PREVIEW, decision="allowed", resource_type=RESOURCE, resource_id="policy", request_id=act.rid,
          details={"review_id": review.id, "base_revision": body.revision, "diff_rows": len(diff), **_counts(impact)})
    names = {s["id"]: s["name"] for s in stations}
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=max(1.0, impact["expires_in"] - wp.REVIEW_TTL_MARGIN_S))).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"review_id": review.id, "base_revision": body.revision, "expires_at": expires_at, "diff": diff, "impact": _impact_view(impact, _sensitive(ia.Authority(conn, principal)), names),
            "values": values}


def _wiskey_error(exc: ApiError, phase: str) -> ApiError:
    """The feed's error in this screen's words; `details` (`outcome`, `wiskey_code`, `state`) kept."""
    details = dict(exc.details or {})
    outcome = str(details.get("outcome") or "unknown")
    code = str(details.get("wiskey_code") or exc.code)
    if outcome == "not_sent":
        return ApiError(exc.status, exc.code, exc.user_message, retryable=exc.retryable, details=details)
    if outcome == "refused":
        known = {
            "revision_conflict": (409, "profiles_revision_conflict", "ההגדרות השתנו בינתיים במערכת בקרת הכניסה. טענו מחדש ובדקו את הטיוטה שוב. השינוי לא נשמר."),
            "bulk_review_stale": (409, "profiles_review_stale", "נתוני האנשים או ההגדרות השתנו מאז התצוגה המקדימה. הפיקו תצוגה מקדימה חדשה. השינוי לא נשמר."),
            "bulk_review_expired": (409, "profiles_review_expired", "התצוגה המקדימה פגה. הפיקו תצוגה מקדימה חדשה. השינוי לא נשמר."),
            "operation_not_found": (409, "profiles_review_expired", "התצוגה המקדימה אינה קיימת עוד. הפיקו תצוגה מקדימה חדשה. השינוי לא נשמר."),
            "profile_value_not_unique": (409, "profiles_not_unique", "יש ערכים כפולים בשדה שסומן כייחודי. תקנו אותם לפני השמירה. השינוי לא נשמר."),
            "profile_definition_in_use": (422, "profiles_definition_removed", "אי אפשר למחוק שדה או קבוצה קיימים - אפשר רק להשבית אותם."),
            "unmanaged_lock": (422, "profiles_unmanaged_lock", "לחלק מהעמדות שנבחרו אין מנעול מנוהל."),
            "station_not_found": (422, "profiles_station_not_found", "אחת העמדות שנבחרו אינה קיימת עוד."),
            "invalid_fields": (422, "profiles_invalid_draft", "מערכת בקרת הכניסה דחתה את הטיוטה כלא תקינה. לא נשמר דבר."),
            "unauthorized": (403, "profiles_forbidden", "מערכת בקרת הכניסה אינה מתירה לשירות לערוך את ההגדרות. לא נשמר דבר."),
            "access_denied": (403, "profiles_forbidden", "מערכת בקרת הכניסה אינה מתירה לשירות לערוך את ההגדרות. לא נשמר דבר."),
            "reauth_required": (403, "profiles_reauth_required", "מערכת בקרת הכניסה דורשת אימות מחדש לפעולות ניהול, ולכן הפעולה נדחתה. לא נשמר דבר."),
        }
        if code in known:
            status, own, message = known[code]
            return ApiError(status, own, message, details=details)
        what = "התצוגה המקדימה" if phase == "preview" else "השמירה"
        return ApiError(502, "profiles_refused", f"{what} נדחתה על ידי מערכת בקרת הכניסה ({code}). לא נשמר דבר.", details=details)
    if phase == "preview":
        return ApiError(504, "profiles_preview_unknown", "לא התקבלה תשובה ברורה לתצוגה המקדימה. לא נשמר דבר - נסו שוב.", retryable=True, details=details)
    return ApiError(504, "profiles_outcome_unknown", "השמירה נשלחה אך לא התקבלה תשובה ברורה. ייתכן שנשמרה וייתכן שלא - בדקו את המצב לפני כל ניסיון נוסף.",
                    details=details)


# ---------------------------------------------------------------- apply

class ApplyBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    review_id: str = Field(pattern=REVIEW_PATTERN)
    confirmed: Any = None


def _readback(request: Request, who: str, review: wp.Review) -> dict[str, Any]:
    """The policy as WisKey serves it now, against the confirmed one: `matches` = one revision on and exactly the confirmed values."""
    try:
        reply = _read_policy(request, who)
    except ApiError as exc:
        return {"state": "error", "revision": None, "matches": None, "last_error": str(exc.details.get("wiskey_code") or exc.code)}
    policy = reply.get("policy")
    if policy is None:
        return {"state": reply.get("state") or "error", "revision": None, "matches": None, "last_error": reply.get("last_error")}
    now = wp.values_of(policy)
    same = now == review.values or not wp.diff_rows(review.values, now)
    return {"state": "ready", "revision": policy["revision"], "matches": bool(policy["revision"] == review.base_revision + 1 and same),
            "unchanged": bool(policy["revision"] == review.base_revision), "last_error": None}


@router.post("/access-control/profiles/apply")
def profiles_apply(request: Request, principal: Principal = Depends(_editor_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    act = _Action(request, conn, principal, AUDIT_APPLY, "policy", RESOURCE)
    body: ApplyBody = _parse(act, ApplyBody, raw)
    not_after = _envelope(act, body)
    act.details["review_id"] = body.review_id
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "שמירת ההגדרות דורשת אישור מפורש אחרי התצוגה המקדימה.", details={}))
    review = wp.REVIEWS.get(body.review_id, principal.user_id)
    if review is None:
        raise act.refuse(ApiError(404, "profiles_review_not_found", "התצוגה המקדימה אינה קיימת עוד. הפיקו תצוגה מקדימה חדשה - לא נשלח דבר."))
    if review.state == "applied" and review.result is not None:
        return {**review.result, "repeated": True}  # the same confirmation again: the stored result, nothing is sent
    blocked = wp.REVIEWS.claim(review)
    if blocked == "expired":
        raise act.refuse(ApiError(409, "profiles_review_expired", "התצוגה המקדימה פגה. הפיקו תצוגה מקדימה חדשה - לא נשלח דבר."))
    if blocked in ("unknown", "applying"):
        raise act.refuse(ApiError(409, "profiles_outcome_pending", "לשמירה הקודמת של הטיוטה הזו אין עדיין תוצאה ברורה. בדקו את המצב לפני ניסיון נוסף - לא נשלח דבר.",
                                  details={"review_state": blocked}))
    if blocked == "dead":
        raise act.refuse(ApiError(409, "profiles_review_expired", "התצוגה המקדימה אינה תקפה עוד. הפיקו תצוגה מקדימה חדשה - לא נשלח דבר."))
    if not review.impact.get("can_apply"):
        wp.REVIEWS.settle(review, "open")
        raise act.refuse(ApiError(409, "profiles_not_unique", "התצוגה המקדימה מצאה ערכים כפולים בשדה ייחודי, ולכן אי אפשר לשמור. לא נשלח דבר."))
    act.details.update(base_revision=review.base_revision, before_after=wp.audit_diff(review.diff), impact=_counts(review.impact))
    try:
        act.attempt()  # committed before the command is sent: no record, no command (the write lock is handed on here)
    except BaseException:
        wp.REVIEWS.settle(review, "open")
        raise
    try:
        reply = intercom_sync.SYNC.action(settings_of(request), "receipt", lambda call: wp.apply(call, review.operation_id), wp.project_receipt, who=principal.user_id,
                                          not_after=not_after, lane=wp.LANE, channel=wp.CHANNEL)
    except ApiError as exc:
        outcome = str(exc.details.get("outcome") or "unknown")
        code = str(exc.details.get("wiskey_code") or exc.code)
        act.outcome(outcome, code, {"error": exc.code, "wiskey_code": code})
        if outcome == "unknown":
            wp.REVIEWS.settle(review, "unknown")
        elif outcome == "not_sent":
            wp.REVIEWS.settle(review, "open")
        else:
            wp.REVIEWS.settle(review, "dead" if code in ("bulk_review_expired", "bulk_review_stale", "operation_not_found", "revision_conflict") else "open")
        raise _wiskey_error(exc, "apply") from None
    except BaseException as exc:
        act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
        wp.REVIEWS.settle(review, "unknown")
        raise
    finally:
        act.conn.execute("BEGIN")  # deferred: takes no lock; nothing more is written on this connection
    receipt = reply["receipt"]
    ad.ADAPTER.cache.invalidate()  # the Settings view's cached groups / versions are stale now
    back = _readback(request, principal.user_id, review)
    act.outcome("ok", None, {"receipt": {"changed": receipt["changed"], "stations": len(receipt["stations"]), "saved_at": receipt["saved_at"]},
                             "readback": {"revision": back["revision"], "matches": back["matches"]}})
    names = {s["id"]: s["name"] for s in _stations(request)}
    result = {
        "status": "saved",
        "review_id": review.id,
        "command_id": act.details["command_id"],
        "revision_before": review.base_revision,
        "receipt": {**receipt, "station_names": {s: names.get(s, s) for s in receipt["stations"]}},
        "readback": back,
        "sync": "requested" if receipt["stations"] else "none",
        "physical_result": "not_verified",
    }
    wp.REVIEWS.settle(review, "applied", result)
    return result


@router.post("/access-control/profiles/reviews/{review_id}/check")
def profiles_check(request: Request, review_id: str = Path(pattern=REVIEW_PATTERN), auth: ia.Authority = Depends(_editor)) -> dict[str, Any]:
    review = wp.REVIEWS.get(review_id, auth.principal.user_id)
    if review is None:
        raise ApiError(404, "profiles_review_not_found", "התצוגה המקדימה אינה קיימת עוד.")
    back = _readback(request, auth.principal.user_id, review)
    if back["state"] != "ready":
        raise ApiError(503, "profiles_unavailable", "לא ניתן לבדוק כעת את המצב במערכת בקרת הכניסה. נסו שוב בעוד רגע.", retryable=True, details={"wiskey_code": back["last_error"]})
    if back["matches"]:
        verdict = "applied"
        if review.state != "applied":
            wp.REVIEWS.settle(review, "applied", {"status": "saved", "review_id": review.id, "revision_before": review.base_revision, "receipt": None, "readback": back,
                                                  "sync": "unknown", "physical_result": "not_verified", "confirmed_by": "readback"})
    elif back["unchanged"]:
        verdict = "not_applied"
        if review.state in ("unknown", "applying"):
            wp.REVIEWS.settle(review, "open")  # WisKey may still hold the review (its own 300 s); an apply sends the SAME operation id (idempotent)
    else:
        verdict = "changed_elsewhere"
        wp.REVIEWS.settle(review, "dead")
    audit(auth.conn, actor=auth.principal, action=AUDIT_CHECK, decision="allowed", resource_type=RESOURCE, resource_id="policy", request_id=_rid(request),
          details={"review_id": review.id, "verdict": verdict, "revision": back["revision"]})
    return {"review_id": review.id, "verdict": verdict, "readback": back, "result": review.result if verdict == "applied" else None}


# ---------------------------------------------------------------- versions, compare, rollback draft

@router.get("/access-control/profiles/versions")
def profiles_versions(request: Request, auth: ia.Authority = Depends(_editor), offset: int = Query(0, ge=0, le=10_000), limit: int = Query(20, ge=1, le=50)) -> dict[str, Any]:
    settings = settings_of(request)
    if (exc := _unsupported(settings, "versions")) is not None:
        raise exc
    reply = intercom_sync.SYNC.command(settings, "versions", lambda call: ad.profiles_versions(call, offset, limit), ad.project_versions, who=auth.principal.user_id, channel="read")
    if reply.get("versions") is None:
        raise _read_error(reply, "את היסטוריית הגרסאות")
    return {"fetched_at": reply.get("fetched_at"), "versions": reply["versions"]}


def _compare(request: Request, who: str, before: int, after: int) -> dict[str, Any]:
    try:
        reply = intercom_sync.SYNC.command(settings_of(request), "compare", lambda call: wp.compare(call, before, after), wp.project_compare, who=who, channel=wp.CHANNEL)
    except ApiError as exc:
        if str(exc.details.get("wiskey_code") or "") == "policy_version_not_found":
            raise ApiError(404, "profiles_version_not_found", "הגרסה אינה שמורה עוד במערכת בקרת הכניסה (נשמרות 50 הגרסאות האחרונות).") from None
        raise
    if reply.get("compare") is None:
        if reply.get("last_error") == "policy_version_not_found":
            raise ApiError(404, "profiles_version_not_found", "הגרסה אינה שמורה עוד במערכת בקרת הכניסה (נשמרות 50 הגרסאות האחרונות).")
        raise _read_error(reply, "את ההשוואה")
    return reply["compare"]


@router.get("/access-control/profiles/compare")
def profiles_compare(request: Request, auth: ia.Authority = Depends(_editor), before: int = Query(ge=0, le=10**9), after: int = Query(ge=0, le=10**9)) -> dict[str, Any]:
    if (exc := _unsupported(settings_of(request), "compare")) is not None:
        raise exc
    return {"compare": _compare(request, auth.principal.user_id, before, after)}


@router.get("/access-control/profiles/versions/{revision}/draft")
def profiles_rollback_draft(request: Request, revision: int = Path(ge=0, le=10**9), auth: ia.Authority = Depends(_editor)) -> dict[str, Any]:
    if (exc := _unsupported(settings_of(request), "compare")) is not None:
        raise exc
    current_reply = _read_policy(request, auth.principal.user_id)
    current = current_reply.get("policy")
    if current is None:
        raise _read_error(current_reply, "את ההגדרות הנוכחיות")
    if revision == current["revision"]:
        raise ApiError(409, "profiles_already_current", "זו כבר הגרסה הנוכחית.")
    diff = _compare(request, auth.principal.user_id, revision, current["revision"])
    draft = wp.rollback_draft(current, diff)
    return {"target_revision": revision, "base_revision": current["revision"], "values": draft["values"], "notes": draft["notes"], "rows": len(diff["rows"])}


# ---------------------------------------------------------------- group suggestions

@router.get("/access-control/profiles/suggestions")
def profiles_suggestions(request: Request, auth: ia.Authority = Depends(_editor), user_id: str = Query(min_length=1, max_length=128, pattern=USER_PATTERN),
                         field: list[str] | None = Query(None)) -> dict[str, Any]:
    fields = list(field or [])
    if len(fields) > wp.SUGGEST_FIELDS_MAX or len(set(fields)) != len(fields) or any(not isinstance(f, str) or not wp.ID.fullmatch(f) for f in fields):
        raise ApiError(422, "validation", f"אפשר לבחור עד {wp.SUGGEST_FIELDS_MAX} שדות שונים.", details={"fields": ["field"]})
    if (exc := _unsupported(settings_of(request), "suggestions")) is not None:
        raise exc
    try:
        reply = intercom_sync.SYNC.command(settings_of(request), "suggestions", lambda call: wp.suggestions(call, user_id, fields), wp.project_suggestions,
                                           who=auth.principal.user_id, channel=wp.CHANNEL)
    except ApiError as exc:
        code = str(exc.details.get("wiskey_code") or "")
        if code in ("comparison_not_found", "user_not_found"):
            raise ApiError(404, "profiles_person_not_found", "האדם לא נמצא.") from None
        if code == "field_access_denied":
            raise ApiError(422, "profiles_field_not_usable", "אי אפשר להציע לפי השדה הזה (אין לאדם ערך תקין בו, או שהוא שדה ייחודי).") from None
        raise
    data = reply.get("suggestions")
    if data is None:
        code = reply.get("last_error")
        if code in ("comparison_not_found", "user_not_found"):
            raise ApiError(404, "profiles_person_not_found", "האדם לא נמצא.")
        if code == "field_access_denied":
            raise ApiError(422, "profiles_field_not_usable", "אי אפשר להציע לפי השדה הזה (אין לאדם ערך תקין בו, או שהוא שדה ייחודי).")
        raise _read_error(reply, "את ההצעות")
    if not _sensitive(auth):
        data = {**data, "fields": [{**f, "value": None} for f in data["fields"]]}
    return {"fetched_at": reply.get("fetched_at"), "suggestions": data, "read_only": True, "physical_result": "not_verified"}
