"""MU2 voice announcements (הכרזות קוליות; services/announcements.py holds the rules). All under /api/v1/announcements.

Speaking (`media.announce`, sensitive, installation scope; the built-in `announcer` role holds only this):
  GET  areas            the rooms that have an allowed speaker, with their speakers, the templates and the languages (the announce form)
  POST /                `{scope: area | device | all, ref, text | texts[{language, text}], language?, template_id?}` speak now (200; `status: queued`
                        in quiet hours mode `queue`), 429 over the rate limit, 409 not configured / quiet hours, 404 off / no allowed speaker
  POST emergency        `{template_id}` the ONE-CLICK emergency announcement (a template of kind emergency, every allowed speaker, no confirmation,
                        no quiet hours, no rate limit); audited as `media.announce.emergency` (who, when, text, languages, targets - no audio)
Administration (`system.configure`):
  GET / PUT config      the switch, the speech engine, the language, the allowed speakers, the per-minute limit, the default volume,
                        pause-music, the quiet hours (suppress | lower) and the notification routing (ANN2)
  GET / PUT templates   the ready-made message templates (routine and emergency; he / en / ru): read by an announcer, edited by system.configure
  POST test             `{scope, ref, language}` the fixed test sentence (source `test`), same checks and same limits
  GET history           the last attempts (a person, a rule or a test; spoken, failed, limited or refused)
ANNOUNCE-297 (stage C, `media.announce`):
  POST translate        `{text, targets?}` DRAFT translations of a Hebrew text into ar / en / ru for the sender to review and edit; nothing is sent to
                        a speaker or a screen. OFF by default (404 translate_off); the provider sees the text, so it needs the approval recorded in
                        config `translate` and a key in the secrets store (409 translate_not_configured). A part sent with `machine: true` is
                        marked as machine-translated everywhere it is shown.
Every attempt is audited as `media.announce`; the setup as `media.announce.config`."""
from __future__ import annotations

import json
import re
import sqlite3
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import set_setting as put_setting
from ..db import unlocked
from ..rbac import INSTALLATION, Principal, require
from ..services import announce_screens as scr
from ..services import announce_templates as tpl
from ..services import announce_translate as tr
from ..services import announcements as svc

router = APIRouter()


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PartBody(_Body):
    language: Literal["he", "en", "ru", "ar"]
    text: str = Field(min_length=1, max_length=400)
    machine: bool = False  # ANNOUNCE-297: this text came from the automatic translation (a draft, never a gate on sending); never Hebrew


class TranslateBody(_Body):
    text: str = Field(min_length=1, max_length=400)  # Hebrew, cleaned like an announcement
    targets: list[Literal["ar", "en", "ru"]] | None = Field(default=None, min_length=1, max_length=3)  # default = the configured ones


def _machine(parts: list[PartBody] | None) -> list[str] | None:
    return [p.language for p in parts if p.machine] or None if parts else None


class SpeakBody(_Body):
    scope: Literal["area", "device", "all"]
    ref: str = Field(min_length=1, max_length=64)  # `*` for scope all
    text: str | None = Field(default=None, min_length=1, max_length=400)
    language: Literal["he", "en", "ru", "ar"] | None = None  # the language of `text`; default = the configured one
    texts: list[PartBody] | None = Field(default=None, min_length=1, max_length=4)  # several languages, spoken one after the other
    template_id: str | None = Field(default=None, max_length=32)  # the template it came from (a record only; the text is what is spoken)
    volume: int | float | None = None  # percent, clamped to 0-100 by the service; None = the configured default
    critical: bool = False  # exempt from the quiet hours (the same permission, installation scope)
    speakers: bool = True  # ANNOUNCEB-295: speak it on the allowed speakers (False = screens only)
    screens: bool | None = None  # ANNOUNCEB-295: also show the text on the allowed screens; None = the configured default (`announce.screens.default_on`)


class TestBody(_Body):
    scope: Literal["area", "device", "all"]
    ref: str = Field(min_length=1, max_length=64)
    language: Literal["he", "en", "ru", "ar"] = "he"


class EmergencyBody(_Body):
    template_id: str | None = Field(default=None, min_length=1, max_length=32)  # an emergency template, or free text (text / texts), exactly one
    text: str | None = Field(default=None, min_length=1, max_length=400)
    language: Literal["he", "en", "ru", "ar"] | None = None
    texts: list[PartBody] | None = Field(default=None, min_length=1, max_length=4)


class TemplatesBody(_Body):
    templates: list[dict[str, Any]] = Field(max_length=tpl.MAX_TEMPLATES)


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/announcements/areas")
def get_areas(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERM, INSTALLATION)
    cfg = svc.config(conn)
    return {"enabled": bool(cfg["enabled"] and svc.engine_ready(cfg)), "areas": svc.areas(conn) if cfg["enabled"] else [], "max_text": svc.MAX_TEXT,
            "templates": tpl.load(conn), "languages": list(svc.LANGUAGES), "default_language": cfg["language"] if cfg["language"] in svc.LANGUAGES else "he",
            "emergency_languages": cfg["emergency_languages"], "quiet_mode": cfg["quiet"]["mode"],
            "screens_enabled": bool(cfg["enabled"] and cfg["screens"]["enabled"]), "screens_default_on": cfg["screens"]["default_on"],
            "translate_enabled": bool(cfg["enabled"] and tr.ready(cfg["translate"])), "translate_targets": cfg["translate"]["targets"]}


@router.post("/announcements")
def speak(body: SpeakBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERM, INSTALLATION)
    if (body.text is None) == (body.texts is None):
        raise svc.err(422, "validation", fields=["text"])
    return svc.announce(conn, settings_of(request), principal, _rid(request), source="manual", scope=body.scope, ref=body.ref, text=body.text, language=body.language,
                        texts=[(p.language, p.text) for p in body.texts] if body.texts is not None else None, template_id=body.template_id,
                        volume=body.volume, critical=body.critical, audio=body.speakers, on_screens=body.screens, unlock=lambda: unlocked(conn),
                        machine=_machine(body.texts))


@router.post("/announcements/emergency")
def emergency(body: EmergencyBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERM, INSTALLATION)  # one click: no confirmation step, the permission is the whole gate
    if sum(x is not None for x in (body.template_id, body.text, body.texts)) != 1:
        raise svc.err(422, "validation", fields=["template_id"])
    return svc.emergency(conn, settings_of(request), principal, _rid(request), body.template_id, unlock=lambda: unlocked(conn), text=body.text, language=body.language,
                         texts=[(p.language, p.text) for p in body.texts] if body.texts is not None else None, machine=_machine(body.texts))


@router.get("/announcements/config")
def get_config(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    info = [{"entity_id": r[0], "name": r[1] or r[0], "platform": r[2] or "", "cloud": (r[2] or "") in svc.CLOUD_PLATFORMS}
            for r in conn.execute("SELECT entity_id, name, platform FROM ha_entities WHERE entity_id LIKE 'tts.%' AND disabled = 0 AND removed_at IS NULL ORDER BY entity_id LIMIT 50").fetchall()]
    engines = [i["entity_id"] for i in info]  # the speech engines the home system exposes (read from it, never typed)
    return {"config": svc.config(conn), "speakers": svc.admin_targets(conn), "engines": engines, "engine_info": info, "history": svc.history(conn, 10), "templates": tpl.load(conn),
            "screen_options": scr.admin_screens(conn)}


@router.put("/announcements/config")
def put_config(body: dict[str, Any], request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    changed = svc.update_config(conn, body, actor=principal.username or principal.user_id, settings=settings_of(request))
    if changed:
        audit(conn, actor=principal, action="media.announce.config", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"changed": changed, **{k: v for k, v in body.items() if k in changed and k in ("enabled", "language", "max_per_minute", "volume", "pause_music", "engine_kind", "cloud_enabled", "emergency_languages")}, **({"quiet": body["quiet"]} if "quiet" in changed else {}),
                 **({"screens": {k: v for k, v in body["screens"].items() if k != "targets"}, **({"screen_targets": [t.get("key") for t in body["screens"]["targets"]]} if "targets" in body["screens"] else {})} if "screens" in changed else {}), **({"notify": {k: v for k, v in body["notify"].items() if k != "ref"}} if "notify" in changed else {}), **({"translate": body["translate"]} if "translate" in changed else {}), **({"devices": len(body["devices"])} if "devices" in changed else {})})
    return {"changed": changed, **get_config(principal, conn)}


@router.post("/announcements/translate")
def translate(body: TranslateBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """ANNOUNCE-297: draft translations for review (nothing is announced). Audited as `media.announce.translate`: the provider, the languages, the length
    and how many came from the cache - never the text and never the key."""
    require(conn, principal, svc.PERM, INSTALLATION)
    cfg = svc.config(conn)
    targets = list(body.targets) if body.targets else cfg["translate"]["targets"]
    code: str | None = None
    out: dict[str, Any] = {}
    try:
        text = svc.clean_text(body.text)
    except Exception:  # noqa: BLE001 - text_invalid
        raise svc.err(422, "text_invalid") from None
    if not cfg["enabled"]:
        code = "translate_off"
    else:
        try:
            with unlocked(conn):  # the provider call is network-bound: the write lock is not held across it (reads only inside)
                out = tr.translate(conn, settings_of(request), text, targets)
        except tr.TranslateError as exc:
            code = exc.code if exc.code in svc.MESSAGES else "translate_failed"
    audit(conn, actor=principal, action="media.announce.translate", decision="denied" if code else "allowed", resource_type="installation", resource_id="*",
          request_id=_rid(request), reason=code, details={"provider": cfg["translate"]["provider"], "targets": targets, "length": len(text),
                                                         **({"cached": sum(1 for i in out["items"] if i["cached"])} if out else {})})
    if code is not None:
        if code == "translate_rate_limited":
            from ..errors import ApiError

            raise ApiError(429, code, svc.MESSAGES[code]["he"], retryable=True, details={"message_en": svc.MESSAGES[code]["en"]})
        raise svc.err({"translate_off": 404, "translate_not_configured": 409}.get(code, 502), code)
    return out


@router.get("/announcements/templates")
def get_templates(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.PERM, INSTALLATION)
    return {"templates": tpl.load(conn), "languages": list(tpl.LANGUAGES)}


@router.put("/announcements/templates")
def put_templates(body: TemplatesBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    try:
        clean = tpl.validate(body.templates)
    except tpl.TemplateInvalid as exc:
        raise svc.err(422, "validation", fields=[exc.field]) from None
    before = tpl.load(conn)
    put_setting(conn, tpl.K_TEMPLATES, json.dumps(clean, ensure_ascii=False))
    if clean != before:
        audit(conn, actor=principal, action="media.announce.config", decision="allowed", resource_type="installation", resource_id="*", request_id=_rid(request),
              details={"changed": ["templates"], "templates": [{"id": t["id"], "kind": t["kind"]} for t in clean],
                       "added": sorted({t["id"] for t in clean} - {t["id"] for t in before}), "removed": sorted({t["id"] for t in before} - {t["id"] for t in clean})})
    return {"templates": tpl.load(conn)}


@router.post("/announcements/test")
def test_announcement(body: TestBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    return svc.announce(conn, settings_of(request), principal, _rid(request), source="test", scope=body.scope, ref=body.ref, text=svc.TEST_TEXT[body.language], language=body.language,
                        on_screens=False, unlock=lambda: unlocked(conn))  # the test button tries the speaker, never a screen


@router.post("/announcements/{announcement_id}/screens/stop")
def stop_screens(announcement_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """ANNOUNCEB-295: take an announcement off the screens now (the speech is not touched). `media.announce`, installation scope; audited."""
    require(conn, principal, svc.PERM, INSTALLATION)
    if not re.match(r"^[0-9a-f]{16}$", announcement_id):
        raise svc.err(422, "validation", fields=["id"])
    stopped = scr.stop(conn, announcement_id, svc._now())
    audit(conn, actor=principal, action="media.announce.screens_stop", decision="allowed" if stopped else "denied", resource_type="announcement", resource_id=announcement_id,
          request_id=_rid(request), reason=None if stopped else "not_shown", details={})
    return {"stopped": stopped}


@router.get("/announcements/history")
def get_history(limit: int = Query(20, ge=1, le=100), principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, svc.CONFIGURE, INSTALLATION)
    return {"history": svc.history(conn, limit)}
