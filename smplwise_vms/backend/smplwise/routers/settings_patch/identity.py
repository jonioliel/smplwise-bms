"""`PATCH /settings`: the keys only a system administrator changes - alarm disarm in schedules, the Arx-only identity switch and
its extended mode, the public address of its links, its passkey settings and the irreversible purge. Each refusal and each actual
change writes its own audit row; a refusal fails the whole request (nothing is stored)."""
from __future__ import annotations

import sqlite3

from fastapi import Request

from ...audit import audit
from ...db import get_setting
from ...errors import ApiError
from ...rbac import Principal
from ...services import confirm_words
from ...services import settings_patch_identity_store as store
from ...services.settings_store import DEFAULTS
from .._common import rid as _rid
from . import Patch

# CR-I18N-CONFIRM-WORDS-2442: the words live in services/confirm_words.py (Hebrew, or the fixed English counterpart)
ALLOW_DISARM_WORD = confirm_words.he("schedules_allow_disarm")
LOCAL_PURGE_WORD = confirm_words.he("privacy_local_purge")  # REL2140 M-1: typed to switch the irreversible IDENT146 purge on

LOCAL_ONLY_IDENTITY_KEYS = ("security.local_public_url", "security.local_passkey_first", "security.local_passkey_android")
LOCAL_ONLY_HE = "שינוי ההגדרה הזו אפשרי רק בגישה מקומית: פתחו את המערכת מתוך Home Assistant או ברשת המקומית."


def _local_only_identity_key(conn: sqlite3.Connection, request: Request, principal: Principal, key: str) -> None:
    """USR2 review RELEASE_264 F4 (and the P2B/P3 review's F9): the settings that shape WHO can sign in to an Arx-only identity - the
    public address (= the passkey RP id and where reset links point), passwordless sign-in, the Android app allowed to use this
    site's passkeys - change only from the local channel (Ingress / the LAN), like the tickets public address (routers/tickets_admin).
    The path itself cannot sit in remote_channel.BLOCKED_ON_REMOTE (every other setting stays remote-editable), so the refusal is per
    key and only for an actual change: a remote PATCH that repeats the current value is untouched. Audited; the whole PATCH fails
    (no partial write)."""
    from ...remote_channel import is_remote

    if not is_remote(request):
        return
    audit(conn, actor=principal, action="identity.local.setting_local_only", decision="denied", resource_type="installation", resource_id="local_identity",
          reason="remote_channel", request_id=_rid(request), details={"key": key})
    raise ApiError(403, "local_only", LOCAL_ONLY_HE, details={"field": key})


def allow_disarm(patch: Patch) -> None:
    changes, conn, request, principal = patch.changes, patch.conn, patch.request, patch.principal
    disarm_confirm = changes.pop("schedules.allow_disarm_confirm", None)
    if "schedules.allow_disarm" in changes:
        current = get_setting(conn, "schedules.allow_disarm", DEFAULTS["schedules.allow_disarm"]) or DEFAULTS["schedules.allow_disarm"]
        if changes["schedules.allow_disarm"] == current:
            changes.pop("schedules.allow_disarm")
        else:
            from ...rbac import is_system_admin

            if not is_system_admin(conn, principal.user_id):
                audit(conn, actor=principal, action="schedules.allow_disarm", decision="denied", resource_type="installation", resource_id="*", reason="not_system_admin",
                      request_id=_rid(request), details={"to": changes["schedules.allow_disarm"]})
                raise ApiError(403, "forbidden", "רק מנהל מערכת יכול לשנות את נטרול האזעקה בתזמונים.")
            if changes["schedules.allow_disarm"] == "true":
                patch.disarm_word = confirm_words.typed_lang("schedules_allow_disarm", disarm_confirm)
            if changes["schedules.allow_disarm"] == "true" and patch.disarm_word is None:
                raise ApiError(422, "confirm_required", f"כדי לאפשר נטרול אזעקה בתזמונים יש להקליד \"{ALLOW_DISARM_WORD}\".", details={"field": "schedules.allow_disarm_confirm"})
            patch.disarm_change = changes["schedules.allow_disarm"]


def local_identity_switch(patch: Patch) -> None:
    """USR2: the Arx-only identity switch - a system administrator only, its own audit row, off ends every local session."""
    changes, conn, request, principal = patch.changes, patch.conn, patch.request, patch.principal
    if "security.local_identity" in changes:
        current_local = "on" if (get_setting(conn, "security.local_identity", "off") or "off") == "on" else "off"
        if changes["security.local_identity"] == current_local:
            changes.pop("security.local_identity")
        else:
            from ...rbac import is_system_admin

            if not is_system_admin(conn, principal.user_id):
                audit(conn, actor=principal, action="identity.local.feature", decision="denied", resource_type="installation", resource_id="local_identity",
                      reason="not_system_admin", request_id=_rid(request), details={"to": changes["security.local_identity"]})
                raise ApiError(403, "forbidden", "רק מנהל מערכת יכול להפעיל או לכבות את משתמשי Arx.")
            patch.local_switch = changes["security.local_identity"]


def extended_switch(patch: Patch) -> None:
    changes, conn, request, principal = patch.changes, patch.conn, patch.request, patch.principal
    if "security.local_identity_extended" in changes:
        # SVCIDENT2: the extended mode of the service identity widens what every Arx-only user may do in Home Assistant - like the switch
        # itself, a system administrator only; turning it ON, like the sign-in shaping keys, from the local channel only; audited
        # `identity.service_identity.*`. SVCIDENT-AMEND273 (owner decision 5, 2026-10-18; go-live pack R7): turning it OFF is a kill
        # switch and works from the remote channel too (a system administrator, no second factor by the same decision) - never ON.
        from ...remote_channel import is_remote
        from ...services import service_identity as service_identity_svc

        current_ext = "on" if (get_setting(conn, "security.local_identity_extended", "off") or "off") == "on" else "off"
        if changes["security.local_identity_extended"] == current_ext:
            changes.pop("security.local_identity_extended")
        else:
            from ...rbac import is_system_admin

            if changes["security.local_identity_extended"] == "on":  # the ON direction: local channel only (the OFF direction: any channel)
                _local_only_identity_key(conn, request, principal, "security.local_identity_extended")
            if not is_system_admin(conn, principal.user_id):
                audit(conn, actor=principal, action="identity.service_identity.extended_switch", decision="denied", resource_type="installation", resource_id="service_identity",
                      reason="not_system_admin", request_id=_rid(request), details={"to": changes["security.local_identity_extended"]})
                raise ApiError(403, "forbidden", "רק מנהל מערכת יכול להפעיל או לכבות את המצב המורחב של משתמשי Arx.")
            if changes["security.local_identity_extended"] == "on" and not service_identity_svc.extended_go_live_permitted():
                # integ/270 (2.7.0 security review S7): the go-live guard - after the authority checks, this build refuses to turn the
                # extended mode on (turning it off always works); the stored value stays as it is; one audit row
                audit(conn, actor=principal, action="identity.service_identity.extended_switch", decision="denied", resource_type="installation", resource_id="service_identity",
                      reason="extended_not_permitted", request_id=_rid(request), details={"to": "on"})
                raise ApiError(409, "extended_not_permitted", "המצב המורחב של משתמשי Arx אינו זמין בגרסה הזו: הוא יופעל רק אחרי השלמת תיקוני האבטחה הנדרשים.")
            audit(conn, actor=principal, action="identity.service_identity.extended_switch", decision="allowed", resource_type="installation", resource_id="service_identity",
                  request_id=_rid(request),
                  details={"from": current_ext, "to": changes["security.local_identity_extended"], "channel": "remote" if is_remote(request) else "local"})


def public_url(patch: Patch) -> None:
    changes, conn, request, principal = patch.changes, patch.conn, patch.request, patch.principal
    if "security.local_public_url" in changes:
        # USR2 phase 2: where a link sent by WhatsApp points. Whoever sets it decides where reset tokens go, so - like the switch - only a
        # system administrator changes it (system.configure alone could aim every reset link at a host of its choice); https + a DNS
        # name only, no path / query / IP literal; "" clears it.
        from ...rbac import is_system_admin
        from ...services import local_reset

        raw = changes["security.local_public_url"].strip()
        value = local_reset.normalize_public_url(raw) if raw else ""
        if value is None:
            raise ApiError(422, "validation", "כתובת הגישה מרחוק: https://שם-מארח בלבד (בלי נתיב, בלי כתובת IP).", details={"field": "security.local_public_url"})
        if value != (get_setting(conn, "security.local_public_url", "") or ""):
            _local_only_identity_key(conn, request, principal, "security.local_public_url")
            if not is_system_admin(conn, principal.user_id):
                audit(conn, actor=principal, action="identity.local.public_url", decision="denied", resource_type="installation", resource_id="local_identity",
                      reason="not_system_admin", request_id=_rid(request))
                raise ApiError(403, "forbidden", "רק מנהל מערכת משנה את כתובת הקישורים של משתמשי Arx.")
            audit(conn, actor=principal, action="identity.local.public_url", decision="allowed", resource_type="installation", resource_id="local_identity",
                  request_id=_rid(request), details={"to": value or None})
        changes["security.local_public_url"] = value


def passkey_settings(patch: Patch) -> None:
    changes, conn, request, principal = patch.changes, patch.conn, patch.request, patch.principal
    for key in ("security.local_passkey_first", "security.local_passkey_android"):
        # USR2 phase 4: passwordless sign-in, and which app may use this site's passkeys - each shapes who can sign in, so (like the switch)
        # only a system administrator changes them; audited; never restored from a backup (services/backup.SETTINGS_KEEP)
        if key not in changes:
            continue
        from ...rbac import is_system_admin
        from ...services import local_passkeys

        value = changes[key].strip() if isinstance(changes[key], str) else changes[key]
        if key == "security.local_passkey_android":
            targets = local_passkeys.android_targets(value)
            if targets is None:
                raise ApiError(422, "validation", "אפליקציית אנדרואיד: שורות בצורה package.name:AA:BB:...(טביעת SHA-256).", details={"field": key})
            value = "\n".join(f"{p}:{f}" for p, f in targets)
        if value == (get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key]):
            changes.pop(key)
            continue
        _local_only_identity_key(conn, request, principal, key)
        if not is_system_admin(conn, principal.user_id):
            audit(conn, actor=principal, action="identity.local.passkey_setting", decision="denied", resource_type="installation", resource_id="local_identity",
                  reason="not_system_admin", request_id=_rid(request), details={"key": key})
            raise ApiError(403, "forbidden", "רק מנהל מערכת משנה את הגדרות מפתחות הגישה של משתמשי Arx.")
        audit(conn, actor=principal, action="identity.local.passkey_setting", decision="allowed", resource_type="installation", resource_id="local_identity",
              request_id=_rid(request), details={"key": key, "to": value if key == "security.local_passkey_first" else ("set" if value else "cleared")})
        changes[key] = value


def passkeys_all_users(patch: Patch) -> None:
    """MFA-PASSKEYS-2490 (owner Q50): whether every user may add passkeys and have them count as a step-up method. It shapes how users
    prove who they are, so - like the Arx-only passkey settings - only a system administrator changes it; every attempt is audited.
    Not local-only: it never widens who can sign in (passwordless stays an Arx-only-identity feature), and switching it is a settings
    change, so the step-up gate already asks for a fresh proof."""
    changes, conn, request, principal = patch.changes, patch.conn, patch.request, patch.principal
    key = "security.passkeys_all_users"
    if key not in changes:
        return
    if changes[key] == (get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key]):
        changes.pop(key)
        return
    from ...rbac import is_system_admin

    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action="security.passkeys_all_users", decision="denied", resource_type="installation", resource_id="*",
              reason="not_system_admin", request_id=_rid(request), details={"to": changes[key]})
        raise ApiError(403, "forbidden", "רק מנהל מערכת משנה את ההגדרה של מפתחות גישה לכל המשתמשים.")
    audit(conn, actor=principal, action="security.passkeys_all_users", decision="allowed", resource_type="installation", resource_id="*",
          request_id=_rid(request), details={"to": changes[key]})


def factor_reset_channel(patch: Patch) -> None:
    """MFA-RESET-HARDENING-2510 (owner Q53): from which channel an administrator may reset another user's authentication methods -
    `any` (default) | `local`. It decides who can strip a factor, so only a system administrator changes it; and widening it back to
    `any` happens on the local channel only (a stolen remote administrator session must not undo the owner's `local` and then reset
    from outside). Narrowing it to `local` works from anywhere. Every attempt is audited; a refusal fails the whole request."""
    changes, conn, request, principal = patch.changes, patch.conn, patch.request, patch.principal
    key = "security.factor_reset_channel"
    if key not in changes:
        return
    if changes[key] == (get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key]):
        changes.pop(key)
        return
    from ...rbac import is_system_admin
    from ...remote_channel import is_remote

    if not is_system_admin(conn, principal.user_id):
        audit(conn, actor=principal, action="security.factor_reset_channel", decision="denied", resource_type="installation", resource_id="*",
              reason="not_system_admin", request_id=_rid(request), details={"to": changes[key]})
        raise ApiError(403, "forbidden", "רק מנהל מערכת משנה מאיפה מותר לאפס דרכי אימות של משתמשים.")
    if changes[key] == "any" and is_remote(request):
        audit(conn, actor=principal, action="security.factor_reset_channel", decision="denied", resource_type="installation", resource_id="*",
              reason="remote_channel", request_id=_rid(request), details={"to": changes[key]})
        raise ApiError(403, "local_only", LOCAL_ONLY_HE, details={"field": key})
    audit(conn, actor=principal, action="security.factor_reset_channel", decision="allowed", resource_type="installation", resource_id="*",
          request_id=_rid(request), details={"to": changes[key]})


def local_purge(patch: Patch) -> None:
    changes, conn, request, principal = patch.changes, patch.conn, patch.request, patch.principal
    purge_confirm = changes.pop("privacy.local_purge_confirm", None)
    for key in ("privacy.local_purge", "privacy.local_purge_days"):
        # REL2140 review M-1: the IDENT146 purge deletes personal rows for good. Like the Arx-only identity switch and the alarm-disarm
        # restriction, only a system administrator changes it (system.configure alone is not enough), and turning it ON or changing the
        # period only from the local channel, with the typed confirmation for ON; turning it OFF (the stop direction) works on any channel.
        # The whole PATCH fails on a refusal (no partial write); every actual change is audited on its own row.
        if key not in changes:
            continue
        from ...rbac import is_system_admin
        from ...remote_channel import is_remote
        from ...services import local_privacy

        new = str(changes[key])
        old = str(get_setting(conn, key, DEFAULTS[key]) or DEFAULTS[key])
        if key == "privacy.local_purge_days":
            old = str(local_privacy.purge_days(conn))
        if new == old:
            changes.pop(key)
            continue
        if not (key == "privacy.local_purge" and new == "off"):
            _local_only_identity_key(conn, request, principal, key)
        if not is_system_admin(conn, principal.user_id):
            audit(conn, actor=principal, action="privacy.local_purge.setting", decision="denied", resource_type="installation", resource_id="local_privacy",
                  reason="not_system_admin", request_id=_rid(request), details={"key": key, "to": new})
            raise ApiError(403, "forbidden", "רק מנהל מערכת משנה את המחיקה האוטומטית של משתמשי Arx.")
        purge_word = confirm_words.typed_lang("privacy_local_purge", purge_confirm) if key == "privacy.local_purge" and new == "on" else None
        if key == "privacy.local_purge" and new == "on" and purge_word is None:
            due = len(local_privacy.purge_due(conn))
            raise ApiError(422, "confirm_required", f"המחיקה אינה הפיכה. כדי להפעיל אותה יש להקליד \"{LOCAL_PURGE_WORD}\".",
                           details={"field": "privacy.local_purge_confirm", "due_now": due})
        audit(conn, actor=principal, action="privacy.local_purge.setting", decision="allowed", resource_type="installation", resource_id="local_privacy",
              request_id=_rid(request),
              details={"key": key, "from": old, "to": new, "channel": "remote" if is_remote(request) else "local", **({"confirm_word": purge_word} if purge_word else {})})


# ---------------------------------------------------------------- after the values are stored

def local_identity_changed(patch: Patch) -> None:
    if any(k.startswith("security.local_") for k in patch.changes):
        from ...services import local_identity

        local_identity.flag_changed()  # the hot path reads the switch again at once


def local_switch_applied(patch: Patch) -> None:
    conn, request, principal, local_switch = patch.conn, patch.request, patch.principal, patch.local_switch
    if local_switch is not None:
        from ...services import local_identity

        ended = local_identity.revoke_all(conn, "feature_off") if local_switch == "off" else 0
        if local_switch == "off":  # USR2-P2B: every live self-service reset code ends with the switch (migration 0097's trigger does it too)
            store.delete_local_reset_codes(conn)
        audit(conn, actor=principal, action="identity.local.feature_enabled" if local_switch == "on" else "identity.local.feature_disabled", decision="allowed",
              resource_type="installation", resource_id="local_identity", request_id=_rid(request),
              details={"sessions_ended": ended} if ended else None)
        if ended:
            local_identity.close_sockets_from_thread()


def disarm_changed(patch: Patch) -> None:
    if patch.disarm_change is not None:
        audit(patch.conn, actor=patch.principal, action="schedules.allow_disarm", decision="allowed", resource_type="installation", resource_id="*",
              request_id=_rid(patch.request), details={"to": patch.disarm_change, **({"confirm_word": patch.disarm_word} if patch.disarm_word else {})})
