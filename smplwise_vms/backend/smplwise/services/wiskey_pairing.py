"""WISKEY-PAIRING-2382: "is Arx paired with WisKey?" in one place - the status of the signed path, a read-only acceptance probe, and the
one pairing repair Arx itself can perform. See docs/changes/WISKEY-PAIRING-2382.md for the lifecycle on both sides.

What makes the pairing (read in both code bases, not assumed):
- Arx holds ONE pairing key: the plain pairing code (`settings.bridge.secret`) or, once adopted, the sealed key set (services/bridge_keys.py).
  `ha_bridge.signing_key` returns it; the W10 media / direct join signers (`wiskey_media_bridge.BridgeSigner`, `_key_text`) sign ONLY with the
  plain code or the adopted `g0-legacy` key - a rotated key (`g1-...`) is refused (`bridge_key_rotated`), because WisKey's v1 envelope has no kid.
- The `smplwise_bridge` integration keeps the same code in its config entry (`entry.data.pairing_code`), typed by the owner or delivered by the
  add-on's Supervisor discovery. WisKey (`hikvision_intercom`, trusted_actions/existing_bridge_auth.py + direct_bridge_origin.py) trusts a
  signature only when it matches the `pairing_code` of exactly one LOADED `smplwise_bridge` entry. There is no separate approval in WisKey's
  panel for the media / talk commands; the bridge's first completed key rotation BLANKS `pairing_code` in the entry (keyset.py, HA-06), after
  which WisKey can no longer verify anything Arx signs.

So "paired" here means: Arx has a key that can sign (present, readable, not rotated) AND WisKey answered a signed `direct/connect` for it.

Endpoints (routers/wiskey_pairing.py): GET the status (local facts + the last probe, nothing sent), POST probe (one signed read: connect +
`direct/capabilities` + `direct/time`; never a write, never retried), POST repair (system administrator, confirmed, audited: a new pairing code,
announced to the bridge through the Supervisor discovery when that path is open; optionally pauses the bridge-key rotation).

Never returns, logs or audits key material, a signature, a nonce, a host or a config-entry id. The fingerprint is a short HMAC of a fixed label
under the key - it identifies a key without revealing it."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import threading
import time
from collections.abc import Awaitable, Callable
from typing import Any

from ..db import get_setting, now_iso
from . import bridge_keys as bk
from . import wiskey_media_bridge as bridge
from . import wiskey_media_contract as w10
from .wiskey_direct_discovery import DirectDiscovery

log = logging.getLogger("smplwise.wiskey.pairing")

OK, WARN, BLOCKED, UNKNOWN = "ok", "warn", "blocked", "unknown"
BRIDGE_SILENT_S = 300  # the bridge pushes its signed directory every 60 s; 5 minutes without one means it is not verifying with Arx's key
PROBE_TIMEOUT_S = 20.0
READ_TIMEOUT_S = 6.0
MIN_PROBE_INTERVAL_S = 5.0
FINGERPRINT_LABEL = b"arx-wiskey-pairing-fingerprint.v1"
SERVICE_PREFIX = "arx-service:"
# a refusal that only WisKey's verdict on the key explains (it closes a refused connect without a word; a reply under another key fails the MAC)
REFUSED_CODES = frozenset({"direct_connect_refused", "reply_unauthenticated", "direct_identity_invalid"})
KEY_CODES = frozenset({"bridge_not_paired", "bridge_key_rotated"})
UNREACHABLE_CODES = frozenset({"direct_unreachable", "direct_hello_timeout", "direct_hello_invalid", "direct_connect_timeout", "direct_connect_failed"})

LABEL = {"bridge": "גשר Arx בתשתית המערכת", "component": "רכיב WisKey", "key": "מפתח הצימוד", "acceptance": "WisKey מקבל את המפתח",
         "discovery": "חוזה הגילוי (פקודות מדיה ודיבור)", "provider": "מקור הווידאו והדיבור", "rotation": "החלפת מפתח הגשר", "last_error": "שגיאה אחרונה"}

TEXT = {
    "bridge_ok": "הגשר מותקן ({version}) ומצומד; הוא שולח עדכון חתום כל דקה.",
    "bridge_not_paired": "הגשר עוד לא צומד ל־Arx.",
    "bridge_silent": "הגשר צומד, אבל לא שלח עדכון חתום מאז {since}. כנראה שהוא לא טעון או שהקוד שלו שונה מזה של Arx.",
    "bridge_update_pending": "גרסת הגשר שרצה ({active}) שונה מהגרסה שהותקנה ({installed}); נדרשת הפעלה מחדש של תשתית המערכת.",
    # BRIDGE-STALE-DISCOVERY-2383: the bridge keeps pushing, but with a code Arx does not hold (401 on every signed push)
    "bridge_rejected": "הגשר שולח עדכונים חתומים, אבל Arx דוחה אותם ({count} מאז {since}): הגשר חותם בקוד צימוד אחר מזה של Arx.",
    "bridge_rejected_after_repair": "אחרי הצימוד מחדש הגשר עדיין חותם בקוד הישן: Arx דוחה את העדכונים שלו ({count} מאז {since}). הקוד החדש לא הגיע לגשר.",
    "component_managed": "WisKey {version} · התקנה מנוהלת על ידי Arx.",
    "component_manual": "WisKey {version} · התקנה ידנית (בעל המערכת מעדכן את WisKey בעצמו).",
    "component_unknown": "גרסת WisKey לא ידועה כרגע: ערוץ השירות אל WisKey במצב \"{feed}\".",
    "key_ok": "יש מפתח צימוד והוא יכול לחתום. טביעה: {fingerprint}.",
    "key_missing": "אין מפתח צימוד: Arx לא יכול לחתום על שום פקודה אל WisKey.",
    "key_unreadable": "מפתח הגשר שמור, אבל לא ניתן לפענח אותו במכונה הזו (למשל אחרי שחזור גיבוי ממכונה אחרת).",
    "key_rotated": "מפתח הגשר הוחלף (החלפת מפתח). WisKey מקבל רק את קוד הצימוד המקורי, ולכן Arx לא חותם אליו יותר.",
    "accepted": "WisKey קיבל את החתימה של Arx וזיהה אותו כזהות שירות ({checked}).",
    "refused": "WisKey דחה את החתימה של Arx ({code}): הקוד שאצלו לא תואם את המפתח של Arx, או שהגשר לא טעון אצלו.",
    "probe_key": "לא נשלחה בדיקה: אין מפתח שיכול לחתום (ראו \"מפתח הצימוד\").",
    "unreachable": "לא ניתן היה להגיע לחיבור הישיר של WisKey ({code}). אולי גרסת WisKey לא כוללת אותו, או ש־WisKey לא טעון.",
    "probe_error": "הבדיקה לא הסתיימה ({code}); התוצאה לא ידועה.",
    "probe_not_run": "עוד לא נבדק מול WisKey.",
    "discovery_ok": "חוזה גילוי {protocol} גרסה {schema}: {listed} מתוך 6 פקודות המדיה והדיבור מפורסמות.",
    "discovery_talk_missing": "WisKey מפרסם וידאו אבל לא את ארבע פקודות הדיבור ({missing}).",
    "discovery_media_missing": "WisKey לא מפרסם את פקודות המדיה של העמדות ({missing}).",
    "discovery_feed": "לפי ערוץ השירות: וידאו {video}, דיבור {talk} (לא נבדק בחיבור הישיר).",
    "discovery_unknown": "חוזה הגילוי לא נקרא עדיין.",
    "discovery_clock": "השעונים של Arx ו־WisKey רחוקים מדי זה מזה ({why}); פקודות חתומות יידחו.",
    "provider_auto": "Arx בוחר לבד: החיבור הישיר של WisKey, ואם הוא לא זמין - הנתיב החתום דרך תשתית המערכת.",
    "provider_local": "מקור הווידאו והדיבור מוגדר \"Arx (וידאו בלבד)\": Arx לא מדבר עם העמדות דרך WisKey, גם כשהצימוד תקין.",
    "provider_feed_gate": "מקור הווידאו והדיבור מוגדר \"WisKey (וידאו ודיבור)\", אבל Arx בוחר ב־WisKey רק לפי רשימת הפקודות שבערוץ השירות, ושם פקודות המדיה לא מופיעות ({why}). "
                          "לכן וידאו ודיבור לא עוברים דרך WisKey, גם כשהצימוד והחיבור הישיר תקינים.",
    "provider_feed_no_talk": "ערוץ השירות מפרסם את פקודות הווידאו אבל לא את פקודות הדיבור, ולכן דיבור לא עובר דרך WisKey.",
    "rotation_off": "החלפת מפתח הגשר כבויה; קוד הצימוד המקורי נשאר בתוקף.",
    "rotation_risk": "החלפת מפתח הגשר מופעלת. החלפה תמחק את קוד הצימוד המקורי מהגשר, ו־WisKey יפסיק לקבל את Arx.",
    "rotation_blocked_wiskey": "החלפת מפתח הגשר חסומה כל עוד WisKey מותקן: WisKey מאמת את Arx רק מול קוד הצימוד המקורי, וההחלפה מוחקת אותו מהגשר.",
    "rotation_done": "מפתח הגשר כבר הוחלף; זה מה שמנתק את WisKey (ראו \"מפתח הצימוד\").",
    "no_error": "אין שגיאה.",
    "error": "{code}",
}

FIX = {
    "bridge_not_paired": "בהגדרות › תשתית המערכת: העתיקו את קוד הצימוד והוסיפו בתשתית המערכת את האינטגרציה SMPLWISE Bridge עם הקוד הזה.",
    "bridge_silent": "בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge - ודאו שהיא טעונה (בלי שגיאה) והפעילו מחדש את תשתית המערכת. אם זה לא עוזר - צימוד מחדש (למטה).",
    "bridge_update_pending": "הפעילו מחדש את תשתית המערכת כדי שהגרסה החדשה של הגשר תיטען.",
    "bridge_rejected": "לרוב זו הודעת גילוי ישנה שהחזירה לגשר קוד ישן אחרי הפעלה מחדש של תשתית המערכת. Arx מגרסה 2.39.1 מוחק אותה בעצמו. "
                       "לחצו \"צימוד מחדש\" למטה (מנהל מערכת). אם הקוד לא נשלח לגשר אוטומטית - הזינו אותו בגשר כפי שמוצג אחרי הצימוד.",
    "bridge_rejected_after_repair": "אם הקוד נשלח אוטומטית: המתינו דקה (הגשר בודק את הקוד מול Arx ומחליף אותו בעצמו); אם השורה נשארת אדומה - הפעילו מחדש "
                                    "את תשתית המערכת. אם הקוד לא נשלח: הגדרות › מכשירים ושירותים › SMPLWISE Bridge › מחיקה, ואז הוספת אינטגרציה › "
                                    "SMPLWISE Bridge עם הכתובת והקוד שמוצגים כאן.",
    "component_unknown": "בדקו ש־WisKey מותקן וטעון בתשתית המערכת. בהתקנה ידנית בעל המערכת מתקין ומעדכן אותו בעצמו.",
    "key_missing": "לחצו \"צימוד מחדש\" למטה (מנהל מערכת). Arx ייצור קוד צימוד חדש.",
    "key_unreadable": "לחצו \"צימוד מחדש\" למטה (מנהל מערכת). Arx ייצור קוד צימוד חדש במקום המפתח שאי אפשר לפענח.",
    "key_rotated": "לחצו \"צימוד מחדש\" למטה (מנהל מערכת) והשאירו את \"לכבות את החלפת מפתח הגשר\" מסומן. הקוד החדש יחזור לגשר, ו־WisKey יקבל אותו.",
    "refused": "אם הגשר שולח עדכונים (השורה הראשונה תקינה): הפעילו מחדש את תשתית המערכת וודאו שיש רק אינטגרציית SMPLWISE Bridge אחת. אם הגשר שקט - צימוד מחדש (למטה).",
    "probe_key": "תקנו קודם את \"מפתח הצימוד\".",
    "unreachable": "ודאו ש־WisKey טעון בתשתית המערכת ובגרסה 2.0.1 ומעלה. בהתקנה ידנית בעל המערכת מעדכן את WisKey. Arx ינסה בינתיים את הנתיב החתום דרך תשתית המערכת.",
    "probe_error": "לחצו שוב \"בדיקה מול WisKey\". אם זה חוזר - בדקו שתשתית המערכת זמינה.",
    "probe_not_run": "לחצו \"בדיקה מול WisKey\".",
    "discovery_talk_missing": "עדכנו את WisKey לגרסה שמפרסמת את פקודות הדיבור (בהתקנה ידנית - בעל המערכת).",
    "discovery_media_missing": "עדכנו את WisKey לגרסה שמפרסמת את פקודות המדיה של העמדות (בהתקנה ידנית - בעל המערכת).",
    "discovery_unknown": "לחצו \"בדיקה מול WisKey\".",
    "discovery_clock": "סנכרנו את השעון של שרת תשתית המערכת (NTP). Arx לא מזיז את השעון שלו.",
    "provider_local": "בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: בחרו \"WisKey (וידאו ודיבור)\".",
    "provider_feed_gate": "זה לא תלוי בצימוד: נדרש עדכון - או ש־WisKey יפרסם את פקודות המדיה גם ברשימת הפקודות של ערוץ השירות, או ש־Arx יבחר לפי הגילוי החתום. פריט פתוח בפיתוח, לא פעולה של בעל המערכת.",
    "provider_feed_no_talk": "כמו בשורה למעלה: נדרש עדכון של רשימת הפקודות בערוץ השירות או של בחירת Arx. פריט פתוח בפיתוח.",
    "rotation_risk": "אל תלחצו \"החלפת מפתח\" בכרטיס מפתח הגשר כל עוד WisKey בשימוש. אפשר לכבות את ההחלפה שם, או בצימוד מחדש למטה.",
    "rotation_done": "צימוד מחדש (למטה) מחזיר קוד צימוד מקורי.",
    "error": "ראו את השורה שמסומנת באדום למעלה.",
}

ERROR_TEXT = {
    "direct_connect_refused": "WisKey סגר את החיבור בלי תשובה - החתימה לא אומתה אצלו.",
    "reply_unauthenticated": "התשובה של WisKey לא חתומה במפתח של Arx.",
    "direct_identity_invalid": "WisKey החזיר זהות בפורמט לא מוכר.",
    "direct_unreachable": "החיבור הישיר של WisKey לא נפתח.",
    "direct_hello_timeout": "WisKey לא פתח את החיבור הישיר בזמן.",
    "direct_hello_invalid": "פתיחת החיבור הישיר של WisKey בפורמט לא מוכר.",
    "direct_connect_timeout": "WisKey לא ענה בזמן על בקשת החיבור.",
    "direct_connect_failed": "החיבור הישיר נכשל.",
    "bridge_not_paired": "אין מפתח צימוד.",
    "bridge_key_rotated": "המפתח הוחלף, ו־WisKey לא מקבל מפתח מוחלף.",
    "outcome_unknown": "לא התקבלה תשובה בזמן.",
    "connection_closed": "החיבור נסגר באמצע.",
    "probe_timeout": "הבדיקה לא הסתיימה בזמן.",
    "clock_skew": "השעונים רחוקים מדי.",
}

PROBE: dict[str, Any] = {"last": None, "mono": 0.0}  # process memory: the last probe's public facts (a restart forgets it)
_LOCK = threading.Lock()
_OPENER_FOR_TESTS: Callable[[], Awaitable[Any]] | None = None


def reset_for_tests() -> None:
    global _OPENER_FOR_TESTS
    PROBE.update(last=None, mono=0.0)
    _OPENER_FOR_TESTS = None


def set_opener_for_tests(opener: Callable[[], Awaitable[Any]] | None) -> None:
    global _OPENER_FOR_TESTS
    _OPENER_FOR_TESTS = opener


def _line(key: str, state: str, reason: str, fix: str | None = None, facts: dict[str, Any] | None = None, **fmt: Any) -> dict[str, Any]:
    text = TEXT[reason].format(**fmt) if fmt else TEXT[reason]
    return {"key": key, "label": LABEL[key], "state": state, "reason": reason, "text": text,
            "fix": (FIX.get(fix or reason) if state != OK else None), "facts": facts or {}}


def fingerprint(material: str) -> str:
    d = hmac.new(material.encode("utf-8"), FINGERPRINT_LABEL, hashlib.sha256).hexdigest()[:8]
    return f"{d[:4]}-{d[4:]}"


# ---------------------------------------------------------------- local facts

def key_facts(conn: Any, data_dir: Any) -> dict[str, Any]:
    """{state: ok | missing | unreadable | rotated, kid, adopted, fingerprint}. Never the material."""
    from . import ha_bridge

    adopted = bk.adopted(conn)
    cur = bk.status(conn, data_dir)["current"] if adopted and data_dir is not None else None
    if adopted and cur is not None and not cur["readable"]:
        return {"state": "unreadable", "kid": cur["kid"], "adopted": True, "fingerprint": None}
    key = ha_bridge.signing_key(conn)
    if not key:
        return {"state": "missing", "kid": None, "adopted": adopted, "fingerprint": None}
    kid = getattr(key, "kid", None)
    if kid is not None and kid != bk.LEGACY_KID:
        return {"state": "rotated", "kid": kid, "adopted": True, "fingerprint": None}
    return {"state": "ok", "kid": kid or "plain", "adopted": adopted, "fingerprint": fingerprint(str(key))}


def _bridge_line(conn: Any, now: float) -> dict[str, Any]:
    from . import bridge_install

    st = bridge_install.STATE
    active = get_setting(conn, "bridge.integration_version") or None
    installed = st.get("installed_version")
    paired_at = get_setting(conn, "bridge.paired_at") or None
    directory_at = get_setting(conn, "bridge.directory_at") or None
    from . import bridge_discovery as bd

    facts = {"installed_version": installed, "active_version": active, "source_version": st.get("source_version"), "paired_at": paired_at,
             "directory_at": directory_at, "paired": bool(paired_at), **bd.facts(conn)}
    last = bk.epoch_of(directory_at) if directory_at else None
    rej = bd.directory_refusals()
    if rej and now - float(rej["last_epoch"]) <= BRIDGE_SILENT_S and (last is None or float(rej["last_epoch"]) > last):
        # BRIDGE-STALE-DISCOVERY-2383: refused pushes newer than the last accepted one - the bridge holds another code (typically a stale discovery
        # replayed at a Home Assistant start). Shown before "not paired": right after a re-pair `paired_at` is blank and this is the real reason.
        facts.update(refused_count=rej["count"], refused_since=rej["first_at"], refused_code=rej["code"])
        reason = "bridge_rejected" if paired_at else "bridge_rejected_after_repair"
        return _line("bridge", BLOCKED, reason, facts=facts, count=rej["count"], since=rej["first_at"])
    if not paired_at:
        return _line("bridge", BLOCKED, "bridge_not_paired", facts=facts)
    if last is None or now - last > BRIDGE_SILENT_S:
        return _line("bridge", WARN, "bridge_silent", facts=facts, since=directory_at or "הצימוד")
    if installed and active and installed != active:
        return _line("bridge", WARN, "bridge_update_pending", facts=facts, active=active, installed=installed)
    return _line("bridge", OK, "bridge_ok", facts=facts, version=active or installed or "?")


def _component_line(conn: Any) -> dict[str, Any]:
    from . import intercom_sync
    from . import wiskey_auto_install as wai

    version = intercom_sync.STATE.wiskey_version
    feed = intercom_sync.STATE.state
    managed = bool(wai.switch_on(conn))
    facts = {"version": version, "mode": "managed" if managed else "manual", "feed_state": feed}
    if not version:
        return _line("component", UNKNOWN, "component_unknown", facts=facts, feed=feed)
    return _line("component", OK, "component_managed" if managed else "component_manual", facts=facts, version=version)


def _key_line(k: dict[str, Any]) -> dict[str, Any]:
    facts = {"present": k["state"] != "missing", "can_sign": k["state"] == "ok", "fingerprint": k["fingerprint"], "kid": k["kid"]}
    if k["state"] == "ok":
        return _line("key", OK, "key_ok", facts=facts, fingerprint=k["fingerprint"])
    return _line("key", BLOCKED, "key_" + k["state"], facts=facts)


def _acceptance_line(k: dict[str, Any], p: dict[str, Any] | None) -> dict[str, Any]:
    if p is None:
        return _line("acceptance", UNKNOWN, "probe_not_run")
    facts = {"checked_at": p["at"], "code": p.get("code"), "transport": "direct", "service_subject": bool(p.get("service_subject")),
             "repository": p.get("repository")}
    if p.get("accepted") is True:
        return _line("acceptance", OK, "accepted", facts=facts, checked=p["at"])
    code = p.get("code") or "unknown"
    if code in KEY_CODES:
        return _line("acceptance", BLOCKED, "probe_key", facts=facts)
    if code in REFUSED_CODES:
        return _line("acceptance", BLOCKED, "refused", facts=facts, code=code)
    if code in UNREACHABLE_CODES:
        return _line("acceptance", UNKNOWN, "unreachable", facts=facts, code=code)
    return _line("acceptance", UNKNOWN, "probe_error", facts=facts, code=code)


def feed_listing(settings: Any) -> tuple[bool, bool, str | None]:
    """`w10.listed` over the service feed's `overview.api` - the ONLY discovery Arx's media provider selection reads today
    (intercom_media.provider_for). (video, talk, reason: None | not_listed | api_incompatible | commands_unknown | discovery_unknown)."""
    from . import intercom_media

    try:
        return w10.listed(intercom_media._feed_discovery(settings))
    except Exception:  # noqa: BLE001 - an unreadable feed discovery is "unknown"
        return False, False, "discovery_unknown"


def _discovery_line(settings: Any, p: dict[str, Any] | None) -> dict[str, Any]:
    video, talk, why = feed_listing(settings)
    cap = (p or {}).get("capabilities")
    if not cap:
        facts = {"source": "feed", "feed_video": video, "feed_talk": talk, "feed_reason": why, "listed": {}}
        if video or talk:
            return _line("discovery", OK if talk else WARN, "discovery_feed", fix="discovery_talk_missing", facts=facts,
                         video="כן" if video else "לא", talk="כן" if talk else "לא")
        return _line("discovery", UNKNOWN, "discovery_unknown", facts=facts)
    listed = {c: c in cap["commands"] for c in w10.COMMANDS}
    facts = {"source": "direct", "schema_version": cap["schema_version"], "protocol": cap["protocol"], "commands": len(cap["commands"]),
             "listed": listed, "talk_audio": cap["talk_audio"], "feed_video": video, "feed_talk": talk, "feed_reason": why, "clock": cap.get("clock")}
    missing_video = [c for c in w10.VIDEO_COMMANDS if not listed[c]]
    missing_talk = [c for c in w10.TALK_COMMANDS if not listed[c]]
    if missing_video:
        return _line("discovery", BLOCKED, "discovery_media_missing", facts=facts, missing=", ".join(missing_video + missing_talk))
    if missing_talk:
        return _line("discovery", BLOCKED, "discovery_talk_missing", facts=facts, missing=", ".join(missing_talk))
    if cap.get("clock"):
        return _line("discovery", BLOCKED, "discovery_clock", facts=facts, why=cap["clock"])
    return _line("discovery", OK, "discovery_ok", facts=facts, protocol=cap["protocol"], schema=cap["schema_version"], listed=sum(listed.values()))


# WISKEY-TALK-DIAL-2382 owns the Settings row "מקור הווידאו והדיבור" (system-access-display.ts) and GET /access-control/station-media/readiness
# (intercom_media.readiness, READINESS_CODES). This block shows the value and links to that row; `readiness_codes` uses the SAME closed codes and
# rules so the two screens never disagree (it is computed here only because that branch is not on main yet).
READINESS_CODES = ("wiskey_unreachable", "api_incompatible", "video_not_listed", "talk_not_listed", "pairing_missing", "pairing_key_rotated")
PROVIDER_ROW = {"href": "#/system/diagnostics?tab=access-control", "label": "מקור הווידאו והדיבור"}


def readiness_codes(conn: Any, settings: Any) -> list[str]:
    from . import intercom_media, intercom_sync

    try:
        feed_state, _overview = intercom_sync.SYNC.served(settings)
    except Exception:  # noqa: BLE001 - an unreadable feed is "not reachable"
        feed_state = "error"
    try:
        api = intercom_media._feed_discovery(settings)
    except Exception:  # noqa: BLE001
        api = None
    video, talk, why = w10.listed(api)
    missing: list[str] = []
    if feed_state != "ready":
        missing.append("wiskey_unreachable")
    if why == "api_incompatible":
        missing.append("api_incompatible")
    elif api is not None:
        if not video:
            missing.append("video_not_listed")
        if not talk:
            missing.append("talk_not_listed")
    k = key_facts(conn, getattr(settings, "data_dir", None))["state"]
    if k == "rotated":
        missing.append("pairing_key_rotated")
    elif k != "ok":
        missing.append("pairing_missing")
    return missing


def _provider_line(conn: Any, settings: Any) -> dict[str, Any]:
    """`access.station_media_provider` AND the gate behind it: with `auto`, intercom_media.provider_for still keeps Arx's own source unless the
    service feed's `overview.api.commands` lists the W10 video commands (`w10.listed`); the signed `direct/capabilities` is not read there."""
    from . import intercom_media

    choice = intercom_media.provider_choice(conn)
    video, talk, why = feed_listing(settings)
    facts = {"choice": choice, "feed_video": video, "feed_talk": talk, "feed_reason": why, "readiness": readiness_codes(conn, settings),
             "row": PROVIDER_ROW}
    if choice != "auto":
        return _line("provider", BLOCKED, "provider_local", facts=facts)
    if not video:
        return _line("provider", BLOCKED, "provider_feed_gate", facts=facts, why=why or "not_listed")
    if not talk:
        return _line("provider", WARN, "provider_feed_no_talk", facts=facts)
    return _line("provider", OK, "provider_auto", facts=facts)


def _rotation_line(conn: Any, k: dict[str, Any]) -> dict[str, Any]:
    from . import bridge_rotation as br

    facts = {"enabled": br.mode(conn) == "on", "active": br.active_row(conn) is not None}
    if k["state"] == "rotated":
        return _line("rotation", WARN, "rotation_done", facts=facts)
    facts["blocked_by_wiskey"] = br.wiskey_present()
    if facts["enabled"] and br.go_live_permitted() and facts["blocked_by_wiskey"]:
        return _line("rotation", OK, "rotation_blocked_wiskey", facts=facts)  # BRIDGE-STALE-DISCOVERY-2383: the safe default
    if facts["enabled"] and br.go_live_permitted():
        return _line("rotation", WARN, "rotation_risk", facts=facts)
    return _line("rotation", OK, "rotation_off", facts=facts)


def _transport_error() -> str | None:
    """The last direct-API error the media provider saw (AutoTransport.last_direct_error), when the provider exists. Read only."""
    from . import intercom_media

    prov = getattr(intercom_media, "_bridge", None)
    media = getattr(prov, "media", None)
    code = getattr(media, "last_direct_error", None)
    return code if isinstance(code, str) and code else None


def _error_line(p: dict[str, Any] | None) -> dict[str, Any]:
    probe_code = (p or {}).get("code") if (p or {}).get("accepted") is not True else None
    disc = (p or {}).get("discovery_error")
    media = _transport_error()
    code = probe_code or disc or media
    facts = {"probe": probe_code, "discovery": disc, "media_transport": media}
    if not code:
        return _line("last_error", OK, "no_error", facts=facts)
    base = code.split(":")[-1]
    return _line("last_error", WARN, "error", facts={**facts, "code": code}, code=ERROR_TEXT.get(base, code))


def status(conn: Any, settings: Any, *, now: float | None = None) -> dict[str, Any]:
    """The whole block: lines in display order, the verdict, and what can be done next. Sends nothing."""
    from . import bridge_install

    now = time.time() if now is None else now
    data_dir = getattr(settings, "data_dir", None)
    k = key_facts(conn, data_dir)
    p = PROBE["last"]
    lines = [_bridge_line(conn, now), _component_line(conn), _key_line(k), _acceptance_line(k, p), _discovery_line(settings, p),
             _provider_line(conn, settings), _rotation_line(conn, k), _error_line(p)]
    by = {ln["key"]: ln for ln in lines}
    acc = by["acceptance"]
    if k["state"] != "ok" or acc["reason"] == "refused":
        paired: bool | None = False
    elif acc["state"] == OK:
        paired = True
    else:
        paired = None
    talk_ready = paired is True and by["discovery"]["state"] == OK and by["provider"]["state"] == OK
    repair_reason = ("key_" + k["state"]) if k["state"] != "ok" else ("refused" if acc["reason"] == "refused" else None)
    if repair_reason is None and by["bridge"]["reason"] == "bridge_rejected":
        repair_reason = "bridge_rejected"  # BRIDGE-STALE-DISCOVERY-2383: a new code is the fix when the bridge holds another one
    discovery_path = _discovery_path_open(conn)
    return {
        "generated_at": now_iso(),
        "verdict": "paired" if paired else "not_paired" if paired is False else "unknown",
        "paired": paired,
        "talk_ready": talk_ready,
        "lines": lines,
        "probe": p,
        "repair": {"available": repair_reason is not None, "reason": repair_reason, "announce": discovery_path,
                   "addon_url": bridge_install.addon_url()},
        "owner_steps": owner_steps(by, k),
        "features": _features(conn, settings),
    }


def _features(conn: Any, settings: Any) -> list[dict[str, Any]]:
    """T3 "מצב WisKey": every built-but-off WisKey feature with its reasons (services/wiskey_feature_status.py). Never raises."""
    from . import wiskey_feature_status

    try:
        return wiskey_feature_status.rows(conn, settings)
    except Exception as exc:  # noqa: BLE001 - the pairing block still answers
        log.warning("wiskey feature status failed (%s)", type(exc).__name__)
        return []


def _discovery_path_open(conn: Any) -> bool:
    """Whether a new pairing code can reach the bridge by itself (the add-on's Supervisor discovery): only inside the add-on, and on a manual
    WisKey owner profile only once a bridge entry is known (BRIDGE-STALE-DISCOVERY-2383: the code then goes to that entry, nothing is
    installed). Otherwise the owner types the code into the bridge. Read only."""
    from . import bridge_discovery

    return bridge_discovery.path_open(conn)


def owner_steps(by: dict[str, dict[str, Any]], k: dict[str, Any]) -> list[str]:
    """The exact steps outside Arx, in order, for the state shown. Empty when nothing waits on the owner."""
    steps: list[str] = []
    if by["acceptance"]["reason"] == "refused" and k["state"] == "ok" and by["bridge"]["state"] == OK:
        steps += ["בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge - ודאו שיש רשומה אחת בלבד ושהיא טעונה.",
                  "הפעילו מחדש את תשתית המערכת (WisKey קורא את קוד הצימוד מהגשר כשהוא נטען).",
                  "חזרו לכאן ולחצו \"בדיקה מול WisKey\"."]
    if by["acceptance"]["reason"] == "unreachable" or by["discovery"]["reason"] in ("discovery_media_missing", "discovery_talk_missing"):
        if by["component"]["facts"].get("mode") == "manual":
            steps += ["עדכון WisKey הוא פעולה של בעל המערכת (התקנה ידנית, מדיניות B): התקינו את גרסת WisKey המאושרת (2.0.1 ומעלה) והפעילו מחדש את תשתית המערכת.",
                      "חזרו לכאן ולחצו \"בדיקה מול WisKey\"."]
    if by["provider"]["reason"] == "provider_local":
        steps.append("בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: \"WisKey (וידאו ודיבור)\".")
    return steps


# ---------------------------------------------------------------- the probe (one signed read; nothing is written)

async def _probe_async(opener: Callable[[], Awaitable[Any]], key_provider: Callable[[], Any]) -> dict[str, Any]:
    out: dict[str, Any] = {"at": now_iso(), "accepted": None, "code": None, "outcome": None, "service_subject": None, "repository": None,
                           "capabilities": None, "discovery_error": None}
    transport = bridge.DirectApiTransport(opener, key_provider)
    try:
        link = await transport.connect(bridge.PURPOSE_COMMAND)
    except bridge.MediaBridgeError as exc:
        out.update(code=exc.code, outcome=exc.outcome, accepted=False if exc.code in REFUSED_CODES else None)
        return out
    try:
        out.update(accepted=True, service_subject=link.query_owner_id.startswith(SERVICE_PREFIX), repository=link.repository_id is not None)
        disc = DirectDiscovery(window_s=bridge.WINDOW_S)

        async def call(command: str, parameters: Any) -> Any:
            return await link.call_command(command, dict(parameters), timeout=READ_TIMEOUT_S)

        await disc.refresh(link.connection_ref, call)
        cap, t = disc.capabilities, disc.time
        if cap is not None:
            out["capabilities"] = {"schema_version": 1, "protocol": bridge.DIRECT_PROTOCOL, "commands": sorted(cap.commands),
                                   "families": list(cap.families), "talk_audio": cap.talk_audio, "stations": cap.stations,
                                   "clock": t.admits(bridge.WINDOW_S) if t is not None else None,
                                   "skew_s": round(t.skew_s, 2) if t is not None else None}
        out["discovery_error"] = disc.last_error
    finally:
        try:
            await link.close()
        except Exception:  # noqa: BLE001
            pass
    return out


def probe(db: Any, settings: Any, *, force: bool = False) -> tuple[dict[str, Any], bool]:
    """Run the probe (or return the last one when it is younger than MIN_PROBE_INTERVAL_S and not forced). Returns (probe, ran). Never raises."""
    from . import ha_bridge

    with _LOCK:
        last = PROBE["last"]
        if last is not None and not force and time.monotonic() - PROBE["mono"] < MIN_PROBE_INTERVAL_S:
            return last, False

        def key_provider() -> Any:
            with db.connection(mode="read", label="wiskey pairing probe key") as c:
                return ha_bridge.signing_key(c)

        opener = _OPENER_FOR_TESTS or bridge.websocket_opener(settings)
        try:
            result = asyncio.run(asyncio.wait_for(_probe_async(opener, key_provider), PROBE_TIMEOUT_S))
        except asyncio.TimeoutError:
            result = {"at": now_iso(), "accepted": None, "code": "probe_timeout", "outcome": "unknown", "service_subject": None,
                      "repository": None, "capabilities": None, "discovery_error": None}
        except Exception as exc:  # noqa: BLE001 - the probe never takes the request down; the type only
            log.info("wiskey pairing probe failed (%s)", type(exc).__name__)
            result = {"at": now_iso(), "accepted": None, "code": f"probe_error:{type(exc).__name__}"[:64], "outcome": "unknown",
                      "service_subject": None, "repository": None, "capabilities": None, "discovery_error": None}
        PROBE.update(last=result, mono=time.monotonic())
        return result, True


def forget_probe() -> None:
    PROBE.update(last=None, mono=0.0)
