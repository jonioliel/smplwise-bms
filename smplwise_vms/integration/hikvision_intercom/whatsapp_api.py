"""Explicit administrator-only WhatsApp actions through the installed integration."""

from __future__ import annotations

import asyncio
import base64
import secrets
from datetime import UTC, datetime
from importlib import import_module

from .access.models import AccessError
from .const import DOMAIN
from .operations_center import message_warnings
from .phone import whatsapp_number
from .whatsapp_messages import project_messages
from .whatsapp_templates import DEFAULTS, render_template


def _display_date(value: str, he: bool) -> str:
    date = str(value).split("T", 1)[0]
    if he and len(date) == 10 and date[4] == "-" and date[7] == "-":
        return f"{date[8:10]}.{date[5:7]}.{date[:4]}"
    return date


def access_message(user, stations, language: str, settings=None, variant=None) -> str:
    he = language.startswith("he")
    values = settings or DEFAULTS
    door_lines: list[str] = []
    pending: list[str] = []
    for station_id, assignment in user.assignments.items():
        if not assignment.enabled:
            continue
        station = stations.get(station_id)
        name = station.name if station else ("תחנה לא זמינה" if he else "Unavailable station")
        locks = sorted(assignment.allowed_locks)
        suffix = ""
        if len(locks) > 1:
            suffix = f" ({'דלתות' if he else 'Doors'} {', '.join(str(lock) for lock in locks)})"
        door_lines.append(f"{len(door_lines) + 1}. {name}{suffix}")
        if assignment.sync_state != "synced":
            pending.append(name)

    policy = user.access_timing_policy
    schedule = policy.get("schedule", {}) if policy else {}
    day_names = {
        "monday": "שני",
        "tuesday": "שלישי",
        "wednesday": "רביעי",
        "thursday": "חמישי",
        "friday": "שישי",
        "saturday": "שבת",
        "sunday": "ראשון",
    }
    raw_days = schedule.get("days", []) if schedule.get("mode") == "weekly" else []
    days = [day_names.get(str(day).lower(), str(day)) if he else str(day) for day in raw_days]
    dates = [_display_date(value, he) for value in schedule.get("dates", [])]
    hours = ", ".join(
        f"{period['start']}–{period['end']}" for period in schedule.get("periods", [])
    )
    validity_parts: list[str] = []
    if user.valid_from:
        validity_parts.append(("מ־" if he else "From ") + _display_date(user.valid_from, he))
    if user.valid_until:
        validity_parts.append(("עד " if he else "Until ") + _display_date(user.valid_until, he))
    validity = " ".join(validity_parts)

    window: list[str] = []
    if validity:
        window.append(("📆 תוקף ההרשאה:" if he else "📆 Access validity:") + f"\n{validity}")
    if days:
        window.append(("📆 ימי הכניסה:" if he else "📆 Access days:") + f"\n{', '.join(days)}")
    elif dates:
        window.append(("📆 תאריכי הכניסה:" if he else "📆 Access dates:") + f"\n{', '.join(dates)}")
    if hours:
        window.append(("⌚ שעות הכניסה:" if he else "⌚ Access hours:") + f"\n{hours}")

    doors = "\n".join(door_lines)
    doors_section = (
        (("דלתות מורשות:" if he else "Authorized doors:") + f"\n\n{doors}\n\n")
        if doors
        else (("לא הוגדרו דלתות מורשות." if he else "No authorized doors are configured.") + "\n\n")
    )
    access_window_section = "\n\n".join(window) + ("\n\n" if window else "")
    has_card = any(card.enabled for card in getattr(user, "cards", []))
    if user.pin:
        pin_text = user.pin.value
        credential_section = (
            f"קוד הגישה האישי שלך:\n📟 {pin_text} 📟"
            if he
            else f"Your personal access code:\n📟 {pin_text} 📟"
        )
        security_notice = (
            "🚫 ⚠️ ידוע לך כי חל איסור מוחלט למסור את הקוד לאחרים. ⚠️ 🚫"
            if he
            else "🚫 ⚠️ Never share this code with anyone. ⚠️ 🚫"
        )
    elif has_card:
        pin_text = (
            "אין קוד אישי — הכניסה מתבצעת באמצעות הכרטיס האישי שלך"
            if he
            else "No personal PIN — use your personal access card"
        )
        credential_section = (
            "אמצעי הכניסה שלך:\n💳 הכניסה מתבצעת באמצעות הכרטיס האישי שלך."
            if he
            else "Your access credential:\n💳 Use your personal access card."
        )
        security_notice = (
            "🚫 ⚠️ הכרטיס אישי. חל איסור מוחלט למסור אותו לאחרים. ⚠️ 🚫"
            if he
            else "🚫 ⚠️ The access card is personal. Never give it to anyone else. ⚠️ 🚫"
        )
    else:
        pin_text = "לא הוגדר קוד אישי" if he else "No personal PIN is configured"
        credential_section = (
            "⚠️ לא הוגדר עבורך קוד אישי או כרטיס פעיל."
            if he
            else "⚠️ No personal PIN or active access card is configured."
        )
        security_notice = ""
    template_key = ("he_" if he else "en_") + (
        "scheduled" if policy or user.valid_from or user.valid_until else "unrestricted"
    )
    variables = {
        "name": user.display_name,
        "organization": values["organization"],
        "pin": pin_text,
        "credential_section": credential_section,
        "security_notice": security_notice,
        "status": ("פעיל" if he else "Active")
        if user.active
        else ("לא פעיל" if he else "Inactive"),
        "doors": doors,
        "doors_section": doors_section,
        "days": ", ".join(days),
        "dates": ", ".join(dates),
        "hours": hours,
        "validity": validity,
        "timezone": str(schedule.get("timezone", "")),
        "access_window_section": access_window_section,
    }
    message = render_template(variant["body"] if variant else values[template_key], variables)
    if not user.pin:
        message = message.replace(
            f"קוד הגישה האישי שלך:\n📟 {pin_text} 📟", credential_section
        ).replace(f"Your personal access code:\n📟 {pin_text} 📟", credential_section)
        message = message.replace(
            "🚫 ⚠️ ידוע לך כי חל איסור מוחלט למסור את הקוד לאחרים. ⚠️ 🚫",
            security_notice,
        ).replace("🚫 ⚠️ Never share this code with anyone. ⚠️ 🚫", security_notice)
        message = "\n\n".join(part for part in message.split("\n\n") if part.strip())
    notices: list[str] = []
    if not user.active:
        notices.append("⚠️ ההרשאה אינה פעילה." if he else "⚠️ Access is inactive.")
    if user.access_timing_draft and not policy:
        notices.append(
            "⚠️ טיוטת הזמנים אינה נאכפת ואינה מגבילה כניסה."
            if he
            else "⚠️ The draft schedule is not enforced and does not restrict access."
        )
    if pending:
        notices.append(
            (
                "⚠️ ההרשאה ממתינה להשלמת סנכרון בתחנות: "
                if he
                else "⚠️ Access is awaiting synchronization at: "
            )
            + ", ".join(pending)
        )
    return "\n\n".join([*notices, message])


def _accounts(hass):
    return [
        {"id": entry.entry_id, "name": entry.title}
        for entry in hass.config_entries.async_entries("whatsapp")
        if getattr(entry.state, "value", entry.state) == "loaded"
    ]


def _provider_binding(hass, account):
    """Pin existing loaded account and public HA service registration privately."""
    entries = [
        entry
        for entry in hass.config_entries.async_entries("whatsapp")
        if entry.entry_id == account and getattr(entry.state, "value", entry.state) == "loaded"
    ]
    registry = hass.services
    service = registry.async_services().get("whatsapp", {}).get("send_message")
    if len(entries) != 1 or service is None:
        raise AccessError("whatsapp_unavailable")
    entry = entries[0]
    return (
        hass.config_entries,
        entry,
        entry.data,
        entry.options,
        registry,
        service,
        service.job,
        service.job.target,
        service.schema,
        service.supports_response,
    )


def _same_provider(left, right):
    return (
        type(left) is tuple
        and len(left) == len(right)
        and all(a is b for a, b in zip(left, right, strict=True))
    )


def _send_outcome(*, accepted=False, error=None):
    return {
        "schema_version": "whatsapp_send_outcome_v1",
        "accepted": accepted,
        "error": error,
    }


def _pacing_error(code, *, state="not_sent", cause, retry_after_s=None):
    return {
        "code": code,
        "send_state": state,
        "throttle_scope": "account" if code == "rate_limited" else None,
        "retry_after_s": retry_after_s,
        "retry_after_source": "wiskey_local_ledger" if retry_after_s is not None else None,
        "cause": cause,
    }


async def _pacing_status(hass, accounts, available, history):
    # Original installed Cloud accounts join the same truthful status projection.
    # This does not assert a verified common physical sender/budget.
    from .native_template_installation import KEY as INSTALLATION_KEY
    from .whatsapp_pacing_runtime import pacing_snapshot
    installation = hass.data[DOMAIN].get(INSTALLATION_KEY)
    if installation is not None and installation.resources is not None:
        installation.current()
        accounts = list(accounts)
        known = {account["id"] for account in accounts}
        for provider in installation.resources.providers:
            if provider.account.account not in known:
                accounts.append({"id": provider.account.account, "name": provider.account.account})
                known.add(provider.account.account)
        available = True
    if len(accounts) > 128:
        raise AccessError("request_too_large")
    try:
        snapshot = await pacing_snapshot(hass)
    except Exception:
        snapshot = {
            "sender_ref": None,
            "sender_match_verified": False,
            "provider_kind": "ha_service",
            "provider_backend": "unknown",
            "sent_1m": None,
            "sent_1h": None,
            "sent_24h": None,
            "counter_basis": "provider_accepted",
            "counters_complete": False,
            "observed_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "coverage_started_at": None,
            "wiskey_own": {
                key: None
                for key in (
                    "sent_1m",
                    "sent_1h",
                    "sent_24h",
                    "charged_1m",
                    "charged_1h",
                    "charged_24h",
                )
            },
            "throttled_until": None,
            "throttle_scope": None,
            "retry_after_s": None,
        }
    # Every currently unverified HA alias shares one private conservative bucket;
    # its public sender_ref stays null. Never invent an account/physical mapping.
    return {
        "available": available and bool(accounts),
        "history": history,
        "accounts": [{**account, **snapshot} for account in accounts],
        "pacing_schema_version": 1,
        "shared_budget_guaranteed": False,
    }


async def dispatch_whatsapp(hass, command: str, msg: dict, actor: str, *, guard=None):
    if command in {"whatsapp/send", "whatsapp/send_pacing_v1"}:
        from .whatsapp_pacing_runtime import local_send_scope

        if guard is not None:
            guard()
        try:
            async with local_send_scope(hass):
                return await _dispatch_whatsapp(hass, command, msg, actor, guard=guard)
        except AccessError as error:
            if command == "whatsapp/send_pacing_v1":
                causes = {
                    "whatsapp_pacing_unavailable": "local_admission_unavailable",
                    "whatsapp_preview_expired": "current_source_changed",
                    "invalid_fields": "invalid_request",
                    "whatsapp_unavailable": "service_unavailable",
                }
                if error.code in causes:
                    return _send_outcome(error=_pacing_error(error.code, cause=causes[error.code]))
            raise
    return await _dispatch_whatsapp(hass, command, msg, actor, guard=guard)


async def _dispatch_whatsapp(hass, command: str, msg: dict, actor: str, *, guard=None):
    def current():
        if guard is not None:
            guard()

    current()
    templates = hass.data[DOMAIN].get("whatsapp_templates")
    if command in {"whatsapp/templates_get", "whatsapp/templates_update"}:
        if templates is None:
            raise AccessError("whatsapp_templates_unavailable")
        if command == "whatsapp/templates_get":
            return templates.public(defaults=True)
        return await templates.update(msg["revision"], msg["values"])

    accounts = _accounts(hass)
    available = hass.services.has_service("whatsapp", "send_message")
    history = hass.services.has_service("whatsapp", "get_chat_messages")
    if command == "whatsapp/status":
        return {"available": available and bool(accounts), "history": history, "accounts": accounts}
    if command == "whatsapp/pacing_status_v1":
        result = await _pacing_status(hass, accounts, available, history)
        current()
        return result
    if not available or msg["account"] not in {a["id"] for a in accounts}:
        raise AccessError("whatsapp_unavailable")
    provider_binding = _provider_binding(hass, msg["account"])
    from .access_runtime import get_manager

    manager = get_manager(hass)
    user = manager.repository.get(msg["user_id"])
    number = whatsapp_number(user.phone)
    now = hass.loop.time()
    cache = hass.data[DOMAIN].setdefault("whatsapp_previews", {})
    for token in list(cache):
        if cache[token]["expires"] < now:
            del cache[token]
    bound = {
        "actor": actor,
        "user": user.id,
        "revision": user.revision,
        "phone": number,
        "account": msg["account"],
        "template_revision": templates.public()["revision"] if templates else 0,
        "variant_revision": hass.data[DOMAIN]["operations_center"].data["revision"]
        if hass.data[DOMAIN].get("operations_center")
        else 0,
    }

    original_repository = manager.repository
    original_templates = templates
    original_operations = hass.data[DOMAIN].get("operations_center")
    send_fields = ("user_id", "account", "token", "message", "confirmed")
    original_send_fields = tuple(msg.get(key) for key in send_fields)

    def current_send():
        current()
        try:
            provider_current = _provider_binding(hass, bound["account"])
        except Exception:
            raise AccessError("whatsapp_preview_expired") from None
        if (
            get_manager(hass) is not manager
            or tuple(msg.get(key) for key in send_fields) != original_send_fields
            or manager.repository is not original_repository
            or hass.data[DOMAIN].get("whatsapp_templates") is not original_templates
            or hass.data[DOMAIN].get("operations_center") is not original_operations
            or manager.repository.get(user.id).revision != bound["revision"]
            or whatsapp_number(manager.repository.get(user.id).phone) != bound["phone"]
            or (templates.public()["revision"] if templates else 0) != bound["template_revision"]
            or (original_operations.data["revision"] if original_operations else 0)
            != bound["variant_revision"]
            or msg["account"] not in {account["id"] for account in _accounts(hass)}
            or not hass.services.has_service("whatsapp", "send_message")
            or not _same_provider(item.get("provider_binding"), provider_current)
            or hass.loop.time() >= item["expires"]
        ):
            raise AccessError("whatsapp_preview_expired")

    def issue(kind, **extra):
        if len(cache) >= 400:
            raise AccessError("rate_limited")
        token = secrets.token_urlsafe(32)
        cache[token] = {
            **bound,
            "kind": kind,
            "expires": now + 600,
            "request_id": secrets.token_hex(32),
            "action_identity": secrets.token_hex(32),
            "provider_binding": provider_binding,
            **extra,
        }
        return token

    def consume(token, kind):
        item = cache.pop(token, None)
        if (
            not item
            or item["kind"] != kind
            or any(item[k] != v for k, v in bound.items())
            or not _same_provider(item.get("provider_binding"), provider_binding)
        ):
            raise AccessError("whatsapp_preview_expired")
        return item

    if command == "whatsapp/preview":
        return {
            "token": issue("send"),
            "recipient": number,
            "message": access_message(
                user,
                manager.stations,
                msg["language"],
                templates.public() if templates else DEFAULTS,
                hass.data[DOMAIN]["operations_center"].variant(user, msg["language"])
                if hass.data[DOMAIN].get("operations_center")
                else None,
            ),
            "warnings": message_warnings(user),
        }
    if command in {"whatsapp/send", "whatsapp/send_pacing_v1"}:
        from .trusted_actions.validation import Refusal
        from .whatsapp_pacing_ledger import AttemptOutcome, PacingBackoff, PacingLimited
        from .whatsapp_pacing_runtime import (
            finish_local_send,
            mark_local_dispatch,
            reserve_local_send,
        )

        versioned = command == "whatsapp/send_pacing_v1"
        if (
            msg["confirmed"] is not True
            or not msg["message"].strip()
            or len(msg["message"]) > 12000
        ):
            raise AccessError("invalid_fields")
        item = consume(msg["token"], "send")
        service_data = {
            "account": bound["account"],
            "target": number.lstrip("+"),
            "message": msg["message"],
        }
        try:
            current_send()
            attempt, fresh = await reserve_local_send(
                hass, item["request_id"], item["action_identity"]
            )
        except PacingLimited as error:
            if versioned:
                retry = error.retry_after_s
                if retry is not None and (type(retry) is not int or not 0 <= retry <= 86400):
                    retry = None
                return _send_outcome(
                    error=_pacing_error(
                        "rate_limited", cause="wiskey_own_pacing", retry_after_s=retry
                    )
                )
            raise AccessError("rate_limited") from None
        except Exception:
            if versioned:
                return _send_outcome(
                    error=_pacing_error(
                        "whatsapp_pacing_unavailable", cause="local_admission_unavailable"
                    )
                )
            raise AccessError("whatsapp_pacing_unavailable") from None
        if not fresh:
            raise AccessError("whatsapp_send_uncertain")
        possible_send = False
        try:
            current_send()
            await mark_local_dispatch(hass, attempt)
            current_send()
            async with asyncio.timeout(45):
                possible_send = True
                await hass.services.async_call(
                    "whatsapp",
                    "send_message",
                    service_data,
                    blocking=True,
                )
        except BaseException as error:
            outcome = (
                AttemptOutcome.UNKNOWN if possible_send else AttemptOutcome.DEFINITIVELY_NOT_SENT
            )
            try:
                await finish_local_send(hass, attempt, outcome)
            except (Exception, asyncio.CancelledError):
                pass  # The durable reserved/dispatched row remains charged.
            if isinstance(error, asyncio.CancelledError):
                raise
            admission_refused = not possible_send and (
                isinstance(error, (PacingLimited, PacingBackoff))
                or isinstance(error, Refusal)
                and error.code == "pacing_sender_reconciliation_required"
                or isinstance(error, AccessError)
                and error.code == "whatsapp_pacing_unavailable"
            )
            if versioned:
                return _send_outcome(
                    error=_pacing_error(
                        "whatsapp_send_uncertain"
                        if possible_send
                        else "whatsapp_pacing_unavailable"
                        if admission_refused
                        else "whatsapp_preview_expired",
                        state="unknown" if possible_send else "not_sent",
                        cause="ha_service_outcome_unknown"
                        if possible_send
                        else "local_admission_unavailable"
                        if admission_refused
                        else "current_source_changed",
                    )
                )
            raise AccessError(
                "whatsapp_send_uncertain"
                if possible_send
                else "whatsapp_pacing_unavailable"
                if admission_refused
                else "whatsapp_preview_expired"
            ) from None
        # The installed service's completion is not provider acceptance. Keep
        # the attempt charged/UNKNOWN until original provider evidence resolves it.
        try:
            await finish_local_send(hass, attempt, AttemptOutcome.UNKNOWN)
        except Exception:
            # No second send: the original dispatched durable row remains
            # conservative even when outcome persistence needs recovery.
            if not versioned:
                raise AccessError("whatsapp_send_uncertain") from None
        if versioned:
            return _send_outcome(
                error=_pacing_error(
                    "whatsapp_send_uncertain", state="unknown", cause="ha_service_outcome_unknown"
                )
            )
        return {"accepted": True}
    if command == "whatsapp/history":
        if not history:
            raise AccessError("whatsapp_history_unavailable")
        try:
            async with asyncio.timeout(25):
                payload = await hass.services.async_call(
                    "whatsapp",
                    "get_chat_messages",
                    {"account": msg["account"], "target": number.lstrip("+"), "limit": 200},
                    blocking=True,
                    return_response=True,
                )
            messages = project_messages(payload, number)
        except Exception:
            raise AccessError("whatsapp_history_unavailable") from None
        # Replace previous media grants for this viewer instead of accumulating them.
        for token in list(cache):
            if cache[token]["kind"] == "media" and all(
                cache[token][k] == v for k, v in bound.items()
            ):
                del cache[token]
        for message in messages:
            path = message.pop("media_path")
            message["media_token"] = issue("media", path=path) if path else None
        return {"recipient": number, "messages": messages}
    if command == "whatsapp/media":
        import aiohttp

        item = consume(msg["token"], "media")
        try:
            provider = import_module("custom_components.whatsapp")
            client = provider.get_client_for_account(hass, msg["account"])
            headers = {"X-Auth-Token": client.api_key} if client.api_key else {}
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
                async with session.get(
                    client.host.rstrip("/") + item["path"], headers=headers, allow_redirects=False
                ) as response:
                    if response.status != 200:
                        raise ValueError
                    mime = response.headers.get("Content-Type", "").split(";")[0]
                    if mime not in {
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                        "image/gif",
                        "video/mp4",
                        "video/webm",
                        "audio/ogg",
                        "audio/mpeg",
                        "audio/mp4",
                        "application/pdf",
                    }:
                        raise ValueError
                    data = bytearray()
                    async for chunk in response.content.iter_chunked(65536):
                        data.extend(chunk)
                        if len(data) > 8 * 1024 * 1024:
                            raise ValueError
            return {"mime": mime, "data": base64.b64encode(data).decode("ascii")}
        except Exception:
            raise AccessError("whatsapp_media_unavailable") from None
    raise AccessError("unknown_command")
