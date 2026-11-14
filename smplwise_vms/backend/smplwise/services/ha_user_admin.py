"""USR1 (docs/design/USR1_HA_USERS_FROM_ARX.md): create, deactivate / activate and delete home-system (Home Assistant) users
from Arx - the HA side only. The Arx side (permissions, the managed-users table, the role binding, audit) lives in
routers/ha_users.py.

- **Transport:** HA's WebSocket API (there is no REST user API), through `ha_client.ws_session`: the add-on's own token on
  the Supervisor proxy, or - when the owner stored the `ha_users_token` entry in the secrets store (Settings > Connections >
  Secrets; routers/ha_users.py passes it in from the store) - that administrator token on HA core directly
  (`ha_user_auth.core_ws_url`; a user token is never valid on the proxy). One short session per operation.
- **Commands:** `config/auth/list`, `config/auth/create` (always `group_ids: ["system-users"]`: never `system-admin`),
  `config/auth_provider/homeassistant/create`, `config/auth/update` (only `is_active`), `config/auth/delete`,
  `person/create`, `person/delete`. All admin-only in HA.
- **Secrets:** the password is passed once to HA and dropped. It is never logged, never part of an exception, an audit row
  or an answer; HA's own error text is reduced to its code before it leaves this module. Tokens are never logged.

NOT VERIFIED against a real Home Assistant: every behaviour here was tested against tests/fake_ha_users.py only (the design
document lists the owner's one-time live check)."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from ..config import Settings
from ..errors import ApiError

log = logging.getLogger("smplwise.ha_users")

USERS_GROUP = "system-users"
ADMIN_GROUP = "system-admin"

PASSWORD_MIN = 10
PASSWORD_MAX = 128
USERNAME_PATTERN = r"^[a-z0-9][a-z0-9._-]{2,31}$"

# a local denylist (no outbound breach lookup): the most common passwords and the obvious local ones, compared lower-case
COMMON_PASSWORDS = frozenset("""
123456 1234567 12345678 123456789 1234567890 12345678910 0123456789 9876543210 0987654321 1111111111 0000000000
password password1 password12 password123 password1234 passw0rd p@ssw0rd p@ssword passwords qwerty qwerty123 qwerty1234
qwertyuiop qwertyuiop1 asdfghjkl asdfghjkl1 zxcvbnm zxcvbnm123 1q2w3e4r5t 1q2w3e4r5t6y 1qaz2wsx 1qaz2wsx3edc qazwsxedc
iloveyou iloveyou1 iloveyou12 princess princess1 sunshine sunshine1 football football1 baseball baseball1 basketball
superman batman123 starwars welcome welcome1 welcome123 welcome1234 letmein letmein123 trustno1 dragon dragon123
monkey123 master123 shadow123 michael123 jennifer1 computer computer1 internet internet1 whatever1 freedom123
abc123456 abcd1234 abcdefghij abc1234567 aa123456 a1234567 a123456789 changeme changeme1 changeme123 default123
admin123 admin1234 administrator homeassistant homeassistant1 home123456 smarthome smarthome1 smplwise smplwise1
smplwise123 shalom123 shalom1234 israel123 israel1234 jerusalem telaviv123 hello12345 helloworld hello123456
""".split())

_RUNS = ("0123456789", "9876543210", "abcdefghijklmnopqrstuvwxyz", "zyxwvutsrqponmlkjihgfedcba", "qwertyuiopasdfghjklzxcvbnm",
         "1qaz2wsx3edc4rfv5tgb", "!@#$%^&*()")


def password_problem(password: str, username: str = "", display_name: str = "") -> str | None:
    """The first rule the password breaks (a code), or None. Never returns or logs the password itself."""
    if len(password) < PASSWORD_MIN:
        return "too_short"
    if len(password) > PASSWORD_MAX:
        return "too_long"
    low = password.lower()
    if len(set(low)) <= 2:
        return "repetitive"
    if low in COMMON_PASSWORDS or low.rstrip("!.?1") in COMMON_PASSWORDS:
        return "common"
    for run in _RUNS:
        if low in run or low in run * 2:
            return "sequence"
    if username and len(username) >= 3 and username.lower() in low:
        return "contains_username"
    for word in (display_name or "").lower().split():
        if len(word) >= 3 and word in low:
            return "contains_name"
    return None


# ---------------------------------------------------------------- errors


class HaUserError(Exception):
    """A refusal or failure of the HA side, reduced to a code (HA's text never travels). `ha_user_id` is set when a user
    created during the operation is still in HA (the compensation failed) - the caller marks its row `needs_repair`."""

    def __init__(self, kind: str, ha_code: str | None = None, *, ha_user_id: str | None = None):
        super().__init__(kind)
        self.kind = kind  # not_configured | not_authorised | unavailable | username_taken | not_found | refused | failed
        self.ha_code = ha_code
        self.ha_user_id = ha_user_id


_HE = {
    "not_configured": "החיבור למערכת הבית אינו מוגדר בהתקנה הזו.",
    "not_authorised": "למערכת אין הרשאת מנהל במערכת הבית לניהול משתמשים. יש לשמור אסימון מנהל בהגדרות › חיבורים › סודות (\"אסימון מנהל לניהול משתמשי מערכת הבית\") או לנהל משתמשים במסך של מערכת הבית.",
    "unavailable": "מערכת הבית אינה זמינה כרגע. נסו שוב בעוד רגע.",
    "username_taken": "שם המשתמש כבר קיים במערכת הבית.",
    "not_found": "המשתמש לא נמצא במערכת הבית.",
    "refused": "מערכת הבית סירבה לפעולה.",
    "failed": "הפעולה במערכת הבית נכשלה.",
}
_STATUS = {"not_configured": 409, "not_authorised": 409, "unavailable": 503, "username_taken": 409, "not_found": 404, "refused": 409, "failed": 502}
_CODE = {"not_configured": "ha_not_configured", "not_authorised": "ha_not_authorised", "unavailable": "ha_unavailable", "username_taken": "username_taken",
         "not_found": "ha_user_not_found", "refused": "ha_refused", "failed": "ha_failed"}


def api_error(exc: HaUserError) -> ApiError:
    """The uniform error envelope of an HA-side failure: a fixed Hebrew message and our code; HA's own code only in details."""
    details = {"ha_code": exc.ha_code} if exc.ha_code and exc.ha_code.replace("_", "").isalnum() and len(exc.ha_code) <= 40 else {}
    return ApiError(_STATUS[exc.kind], _CODE[exc.kind], _HE[exc.kind], retryable=exc.kind == "unavailable", details=details)


# ---------------------------------------------------------------- transport

Call = Callable[..., Awaitable[dict[str, Any]]]


def transport_kind(settings: Settings) -> str:
    """`token` (the owner's administrator token on HA core), `supervisor` (the add-on's own token) or `none`."""
    if getattr(settings, "ha_users_token", None):
        return "token"
    if settings.ha_url and settings.ha_token:
        return "supervisor"
    return "none"


def run(settings: Settings, fn: Callable[[Call], Awaitable[Any]]) -> Any:
    """Open one authenticated WebSocket session, run `fn(call)` and close it. Sync (a request handler runs in the threadpool,
    without a loop). Maps the connection-level failures to HaUserError; `fn`'s own HaUserError passes through."""
    from . import ha_client

    kind = transport_kind(settings)
    if kind == "none":
        raise HaUserError("not_configured")
    url = token = None
    internal_tls = False
    if kind == "token":
        from . import ha_user_auth

        try:
            url = ha_user_auth.core_ws_url(settings)
        except ha_user_auth.HaUnavailable:
            raise HaUserError("not_configured") from None
        token = settings.ha_users_token
        internal_tls = True
    box: dict[str, Any] = {}

    async def main() -> None:
        stop = asyncio.Event()

        async def on_ready(call: Call) -> None:
            try:
                box["value"] = await fn(call)
            finally:
                stop.set()

        await ha_client.ws_session(settings, on_ready, lambda _d: None, stop, url=url, token=token, internal_tls=internal_tls)

    try:
        asyncio.run(main())
    except HaUserError:
        raise
    except ApiError as exc:
        if exc.code == "ha_forbidden":  # the WebSocket auth step refused the token
            raise HaUserError("not_authorised", "auth_invalid") from None
        raise HaUserError("failed") from None
    except (OSError, asyncio.TimeoutError, ConnectionError) as exc:
        log.warning("home-system user management: connection failed (%s)", type(exc).__name__)
        raise HaUserError("unavailable") from None
    except Exception as exc:  # noqa: BLE001 - websockets' own errors (InvalidURI, InvalidStatus, ConnectionClosed ...)
        log.warning("home-system user management: session failed (%s)", type(exc).__name__)
        raise HaUserError("unavailable") from None
    return box.get("value")


def _result(msg: dict[str, Any], *, missing_ok: bool = False) -> Any:
    """A command's `result`, or HaUserError with HA's error code (never its message)."""
    if msg.get("success"):
        return msg.get("result")
    code = str(((msg.get("error") or {}).get("code")) or "unknown")
    if code == "unauthorized":
        raise HaUserError("not_authorised", code)
    if code in ("username_exists", "credentials_exist"):
        raise HaUserError("username_taken", code)
    if code == "not_found":
        if missing_ok:
            return None
        raise HaUserError("not_found", code)
    if code in ("no_delete_self", "system_generated", "cannot_modify_system_generated", "cannot_deactivate_owner", "cannot_remove_admin", "invalid_format", "home_assistant_error"):
        raise HaUserError("refused", code)
    raise HaUserError("failed", code)


@dataclass(frozen=True)
class HaUserInfo:
    id: str
    username: str | None
    name: str
    is_active: bool
    is_owner: bool
    system_generated: bool
    group_ids: tuple[str, ...]

    @property
    def is_admin(self) -> bool:
        return ADMIN_GROUP in self.group_ids

    @property
    def safe_target(self) -> bool:
        """May Arx deactivate / delete it at all (on top of being in ha_managed_users)."""
        return not (self.is_owner or self.is_admin or self.system_generated)


def _info(raw: dict[str, Any]) -> HaUserInfo:
    return HaUserInfo(
        id=str(raw.get("id") or ""),
        username=raw.get("username"),
        name=str(raw.get("name") or ""),
        is_active=bool(raw.get("is_active", True)),
        is_owner=bool(raw.get("is_owner")),
        system_generated=bool(raw.get("system_generated")),
        group_ids=tuple(str(g) for g in (raw.get("group_ids") or ())) + ((ADMIN_GROUP,) if raw.get("is_admin") and ADMIN_GROUP not in (raw.get("group_ids") or ()) else ()),
    )


async def _list(call: Call) -> list[HaUserInfo]:
    return [_info(u) for u in (_result(await call("config/auth/list")) or []) if isinstance(u, dict)]


async def _find(call: Call, ha_user_id: str) -> HaUserInfo | None:
    return next((u for u in await _list(call) if u.id == ha_user_id), None)


# ---------------------------------------------------------------- operations


def check_access(settings: Settings) -> str:
    """`ok` when the admin-only `config/auth/list` answers; else the HaUserError kind (not_authorised, unavailable, ...)."""
    try:
        run(settings, _list)
    except HaUserError as exc:
        return exc.kind if exc.kind in ("not_configured", "not_authorised", "unavailable") else "failed"
    return "ok"


def username_in_use(settings: Settings, username: str) -> bool:
    from ..auth import normalize_username  # HA 2026.10 trims and lower-cases usernames: compare the same way (strip + casefold)

    async def fn(call: Call) -> bool:
        want = normalize_username(username)
        return bool(want) and any(normalize_username(u.username) == want for u in await _list(call))

    return bool(run(settings, fn))


@dataclass
class Created:
    ha_user_id: str
    person_id: str | None
    person_failed: bool


def create_user(settings: Settings, *, name: str, username: str, password: str, local_only: bool, create_person: bool) -> Created:
    """`config/auth/create` (system-users only) → credentials → optional person. A failure after the user exists deletes it
    again (compensation); when that fails too, HaUserError carries `ha_user_id` (the caller marks the row needs_repair)."""

    async def fn(call: Call) -> Created:
        created = _result(await call("config/auth/create", name=name, group_ids=[USERS_GROUP], local_only=bool(local_only)))
        user = (created or {}).get("user") if isinstance(created, dict) else None
        uid = str((user or {}).get("id") or "")
        if not uid:
            raise HaUserError("failed", "no_user_id")
        if ADMIN_GROUP in ((user or {}).get("group_ids") or []) or (user or {}).get("is_owner"):
            # HA made it an administrator or the owner (an installation without an owner): never keep such a user
            await _compensate(call, uid, "admin_on_create")
        try:
            _result(await call("config/auth_provider/homeassistant/create", user_id=uid, username=username, password=password))
        except HaUserError as exc:
            await _compensate(call, uid, exc.ha_code or exc.kind, kind=exc.kind)
        person_id: str | None = None
        person_failed = False
        if create_person:
            try:
                person = _result(await call("person/create", name=name, user_id=uid))
                person_id = (str(person.get("id") or "") or None) if isinstance(person, dict) else None
                person_failed = person_id is None
            except HaUserError:
                person_failed = True
        return Created(uid, person_id, person_failed)

    return run(settings, fn)


async def _compensate(call: Call, uid: str, reason: str, kind: str = "failed") -> None:
    """Delete a user this operation created a moment ago, then raise the original failure; a failed delete raises with the
    id (needs_repair)."""
    try:
        _result(await call("config/auth/delete", user_id=uid), missing_ok=True)
    except HaUserError:
        raise HaUserError(kind, reason, ha_user_id=uid) from None
    raise HaUserError(kind, reason)


def compensating_delete(settings: Settings, ha_user_id: str, person_id: str | None) -> bool:
    """Delete a just-created user after the Arx side failed. True when the user is gone (or was never there)."""

    async def fn(call: Call) -> None:
        if person_id:
            try:
                _result(await call("person/delete", person_id=person_id), missing_ok=True)
            except HaUserError:
                pass
        _result(await call("config/auth/delete", user_id=ha_user_id), missing_ok=True)

    try:
        run(settings, fn)
    except HaUserError:
        return False
    return True


def set_active(settings: Settings, ha_user_id: str, active: bool) -> HaUserInfo:
    """Re-read the user (it must exist and be a safe target: not owner / admin / system-generated), then `config/auth/update`
    with `is_active` ONLY."""

    async def fn(call: Call) -> HaUserInfo:
        target = await _find(call, ha_user_id)
        if target is None:
            raise HaUserError("not_found", "not_found")
        if not target.safe_target:
            raise HaUserError("refused", "target_not_safe")
        _result(await call("config/auth/update", user_id=ha_user_id, is_active=bool(active)))
        return target

    return run(settings, fn)


def delete_user(settings: Settings, ha_user_id: str, person_id: str | None) -> bool:
    """Re-read the user, refuse an unsafe target, delete its person (if linked) and the user. False = it was already gone
    (idempotent: the caller finishes the Arx cleanup)."""

    async def fn(call: Call) -> bool:
        target = await _find(call, ha_user_id)
        if target is None:
            return False
        if not target.safe_target:
            raise HaUserError("refused", "target_not_safe")
        if person_id:
            try:
                _result(await call("person/delete", person_id=person_id), missing_ok=True)
            except HaUserError as exc:
                if exc.kind in ("not_authorised", "unavailable"):
                    raise
        _result(await call("config/auth/delete", user_id=ha_user_id), missing_ok=True)
        return True

    return bool(run(settings, fn))
