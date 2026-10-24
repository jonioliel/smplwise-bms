"""The in-app secrets store (TKSECRETS2): the secrets that used to be add-on options of type `password` (Home Assistant flagged
them: "Insecure secrets detected in app configuration"), kept in the `app_secrets` table (migration 0093) and managed in
הגדרות › חיבורים › סודות by a system administrator (`system.configure`).

Secrets:
- each value is sealed with the per-install key of `recorder_connections` (services/connection_store: AES-256-GCM, a fresh nonce,
  associated data `"app_secret|<name>|value"`, `v1:` format); an unreadable blob (key file gone or changed) is the state
  `unreadable` and is treated as NOT configured (fail closed - never the stale add-on option);
- the plaintext exists only in the process settings / environment the consumers read, and inside one connection test. No function
  here logs, audits, raises or returns a value: status answers carry `configured`, the time, who and the source, nothing else;
  the audit rows and log lines name the secret, never its value.

Where a consumer's value comes from (the order the task fixed): a row in the store (set = that value, cleared = none), else -
no row at all - the legacy add-on option still present in /data/options.json, else the environment variable of a developer run.
`apply_at_startup` (main.py, after the migrations, before any background worker) does the ONE-TIME migration first: a legacy option
that still carries a value is copied into the store (encrypted) when the store has no row for that name, and only the NAME is
logged. A save in Settings reaches request handlers at once (`apply_live`); background workers that captured the start-up settings
(go2rtc stream sync, the WisKey feeds) pick it up at the next start - the answer says `restart_required`."""
from __future__ import annotations

import dataclasses
import logging
import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..config import Settings
from ..db import now_iso
from .connection_store import SecretError, open_app_secret, seal_app_secret

log = logging.getLogger("smplwise.secrets_store")

VALUE_MAX = 4096


@dataclass(frozen=True)
class SecretSpec:
    name: str              # the store key = the former add-on option key
    field: str | None      # the Settings field consumers read (None: the environment only)
    env: str               # the environment variable of a developer run (and the runtime channel of push_relay_key)
    label_he: str
    label_en: str
    restart_required: bool  # a background worker captured the start-up value
    test: str | None       # the probe that exists for it: go2rtc | wiskey | None


SPECS: tuple[SecretSpec, ...] = (
    SecretSpec("go2rtc_api_password", "go2rtc_password", "GO2RTC_API_PASSWORD", "סיסמת ה־API של go2rtc", "go2rtc API password", True, "go2rtc"),
    SecretSpec("wiskey_password", "wiskey_password", "WISKEY_PASSWORD", "סיסמת חשבון המצלמות של עמדות WisKey", "WisKey stations' camera password", True, "wiskey"),
    SecretSpec("wiskey_background_token", "wiskey_background_token", "WISKEY_BACKGROUND_TOKEN", "אסימון חשבון הרקע של WisKey", "WisKey background account token", True, None),
    SecretSpec("openai_api_key", "openai_api_key", "OPENAI_API_KEY", "מפתח ה־API של OpenAI (עורות קומה)", "OpenAI API key (floor skins)", False, None),
    SecretSpec("push_relay_key", None, "SW_PUSH_RELAY_KEY", "מפתח ממסר ה־Push (אפליקציית הנייד)", "Push relay key (phone app)", False, None),
    # ANNOUNCE-295: the optional CLOUD speech engine's API key (Settings > Multimedia > announcements > engine). Store-only: it never was an add-on
    # option. announce_engine reads it per announcement; the cloud engine is OFF by default and the key is never a plain setting.
    SecretSpec("announce_cloud_key", None, "SW_ANNOUNCE_CLOUD_KEY", "מפתח שירות הדיבור בענן (הכרזות קוליות)", "Cloud speech service key (voice announcements)", False, None),
    # USR1-263: the optional home-system ADMINISTRATOR token of הגדרות › משתמשים והרשאות › משתמשי מערכת הבית (routers/ha_users.py reads it
    # from the store per request). Store-only: it never was an add-on option, so it is not in config.LEGACY_SECRET_OPTIONS.
    SecretSpec("ha_users_token", "ha_users_token", "HA_USERS_TOKEN", "אסימון מנהל לניהול משתמשי מערכת הבית", "Home-system users administrator token", False, None),
)
BY_NAME: dict[str, SecretSpec] = {s.name: s for s in SPECS}
NAMES: tuple[str, ...] = tuple(BY_NAME)


# ---------------------------------------------------------------- rows

def _rows(conn: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    try:
        return {r["name"]: r for r in conn.execute("SELECT name, value_enc, source, updated_at, updated_by FROM app_secrets").fetchall()}
    except sqlite3.OperationalError:  # a database before the migration (an upgrade test): no store yet
        return {}


def get_row(conn: sqlite3.Connection, name: str) -> sqlite3.Row | None:
    return _rows(conn).get(name)


def _spec(name: str) -> SecretSpec:
    spec = BY_NAME.get(name)
    if spec is None:
        raise KeyError(name)
    return spec


def read_value(data_dir: Path, row: sqlite3.Row | None) -> str | None:
    """The stored value of `row` (None = no row or cleared). Raises SecretError when it cannot be decrypted."""
    if row is None or not row["value_enc"]:
        return None
    return open_app_secret(data_dir, row["name"], row["value_enc"])


def current_value(conn: sqlite3.Connection, settings: Settings, name: str) -> str | None:
    """The value a request handler uses for `name` now: a store row decides (set = that value; cleared or unreadable = None, fail
    closed - never a stale option); no row at all = the start-up value (legacy option / developer environment). Never logged."""
    spec = _spec(name)
    row = get_row(conn, name)
    if row is None:
        return legacy_value(settings, spec)
    try:
        return read_value(settings.data_dir, row)
    except SecretError:
        return None


def _readable(data_dir: Path, row: sqlite3.Row | None) -> bool:
    try:
        read_value(data_dir, row)
        return True
    except SecretError:
        return False


def _write(conn: sqlite3.Connection, name: str, value_enc: str | None, source: str, actor_id: str | None) -> None:
    conn.execute(
        """INSERT INTO app_secrets(name, value_enc, source, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(name) DO UPDATE SET value_enc = excluded.value_enc, source = excluded.source, updated_at = excluded.updated_at,
             updated_by = excluded.updated_by""",
        (name, value_enc, source, now_iso(), actor_id),
    )


def set_secret(conn: sqlite3.Connection, data_dir: Path, name: str, value: str, actor_id: str | None, source: str = "ui") -> None:
    """Store `value` for `name` in the caller's transaction. Encryption happens BEFORE anything is written (a key failure writes
    nothing and raises SecretError). Raises KeyError for an unknown name, ValueError for an empty / oversized value."""
    _spec(name)
    if not isinstance(value, str) or not value or len(value) > VALUE_MAX:
        raise ValueError("value")
    _write(conn, name, seal_app_secret(data_dir, name, value), source, actor_id)


def clear_secret(conn: sqlite3.Connection, name: str, actor_id: str | None) -> bool:
    """Clear `name` (the row stays with no value, so a stale add-on option is never read again). True when a value was there."""
    _spec(name)
    row = get_row(conn, name)
    had = bool(row is not None and row["value_enc"])
    _write(conn, name, None, "ui", actor_id)
    return had


# ---------------------------------------------------------------- what consumers get

def legacy_value(settings: Settings, spec: SecretSpec) -> str | None:
    """The value the process started with before the store: the add-on option or the developer environment (load_settings)."""
    if spec.field is not None:
        return getattr(settings, spec.field, None) or None
    legacy = (settings.legacy_secret_options or {}).get(spec.name)
    return legacy or (os.environ.get(spec.env) or "").strip() or None


def effective_values(conn: sqlite3.Connection, settings: Settings) -> dict[str, tuple[str | None, str]]:
    """name -> (value, state) with state `set` | `not_set` | `unreadable` (a store row decides) or `legacy` | `not_set` (no row)."""
    rows = _rows(conn)
    out: dict[str, tuple[str | None, str]] = {}
    for spec in SPECS:
        row = rows.get(spec.name)
        if row is None:
            value = legacy_value(settings, spec)
            out[spec.name] = (value, "legacy" if value else "not_set")
            continue
        try:
            value = read_value(settings.data_dir, row)
        except SecretError:
            out[spec.name] = (None, "unreadable")
            continue
        out[spec.name] = (value, "set" if value else "not_set")
    return out


def _with_values(settings: Settings, values: dict[str, str | None]) -> Settings:
    fields = {BY_NAME[n].field: v for n, v in values.items() if BY_NAME[n].field is not None}
    if not fields:
        return settings
    children = settings.recorder_settings if isinstance(settings.recorder_settings, dict) else {}
    out = dataclasses.replace(settings, **fields)
    if children:  # CR-024: the further recorders' settings are copies of the primary's (go2rtc, WisKey, OpenAI included)
        out = dataclasses.replace(out, recorder_settings={rid: dataclasses.replace(child, **fields) for rid, child in children.items()})
    return out


def _set_env(spec: SecretSpec, value: str | None, decided: bool) -> None:
    """push_relay_key reaches services/mobile_push through the environment. A store row decides (a cleared row removes it);
    without a row the start-up value of load_settings stays."""
    if spec.field is not None:
        return
    if value:
        os.environ[spec.env] = value
    elif decided:
        os.environ.pop(spec.env, None)


def overlay(conn: sqlite3.Connection, settings: Settings) -> Settings:
    """`settings` with every store row applied (and push_relay_key in the environment)."""
    rows = _rows(conn)
    effective = effective_values(conn, settings)
    decided = {n: effective[n][0] for n in rows if n in BY_NAME}  # unreadable = None: fail closed, never the stale option
    for spec in SPECS:
        _set_env(spec, effective[spec.name][0], spec.name in rows)
    return _with_values(settings, decided)


# ---------------------------------------------------------------- the one-time migration of the add-on options

def import_legacy(conn: sqlite3.Connection, settings: Settings) -> list[str]:
    """Copy every legacy add-on option that still carries a value into the store, once: only when the store has NO row for that
    name (a set or a cleared row is the administrator's decision and is never overwritten). Values come from the options file
    itself (`Settings.legacy_secret_options`), never from a developer environment variable. Idempotent; the caller's
    transaction. A key failure skips that name (the option keeps working) with one WARN line naming it. Returns the names."""
    legacy = settings.legacy_secret_options if isinstance(settings.legacy_secret_options, dict) else {}
    if not legacy:
        return []
    rows = _rows(conn)
    moved: list[str] = []
    for spec in SPECS:
        value = legacy.get(spec.name)
        if not value or spec.name in rows:
            continue
        try:
            set_secret(conn, settings.data_dir, spec.name, str(value)[:VALUE_MAX], None, source="addon_import")
        except SecretError:
            log.warning("the add-on option %s could not be moved into the secrets store (key not available); the option stays in use", spec.name)
            continue
        from ..audit import audit  # local import: audit -> db only

        audit(conn, actor=None, action="secret.import", decision="allowed", resource_type="secret", resource_id=spec.name, details={"name": spec.name})
        log.info("the add-on option %s was moved into the secrets store (הגדרות › חיבורים › סודות); remove it from the add-on configuration", spec.name)
        moved.append(spec.name)
    return moved


def apply_at_startup(db: Any, settings: Settings) -> Settings:
    """main.py: the one-time migration, then the overlay, in one transaction. Never blocks the start: on an unexpected error the
    legacy values the process loaded stay in use (one line, no values)."""
    try:
        with db.connection(label="secrets_store.startup") as conn:
            import_legacy(conn, settings)
            effective = effective_values(conn, settings)
            out = overlay(conn, settings)
    except Exception:  # noqa: BLE001 - never block the start
        log.exception("could not load the secrets store; the add-on options / environment stay in use until the next start")
        return settings
    for name, (_, state) in effective.items():
        if state == "unreadable":
            log.warning("the stored secret %s cannot be decrypted (key missing or changed); it is treated as not configured until it is entered again", name)
    return out


# ---------------------------------------------------------------- 2.6.3 transitional: empty the deprecated add-on options

# The deprecated option names still holding a value after the start-up step (the health report shows "old secret still in add-on
# options: remove it"). Names only, never a value.
LINGERING_OPTIONS: list[str] = []


def _options_path() -> Path:
    return Path(os.environ.get("SW_OPTIONS_FILE", "/data/options.json"))


def clear_lingering_options(db: Any, settings: Settings, *, options_path: Path | None = None) -> list[str]:
    """Delta review S-1 (2.6.3, lead decision): config.yaml re-declares the former secret options as DEPRECATED `password?` for this
    one version, so an upgraded install still has its old values at the first start and the one-time import (import_legacy) finds
    them. After that import, every deprecated option that still carries a value AND whose value is no longer needed - the store has a
    row for it (set or cleared: the store decides), or for `nvr_password` the stored NVR connection holds a password - is emptied
    through the ONE self-options writer (self_update.call, POST /addons/self/options; its allow-list accepts only an empty value for
    these keys). The whole options document is written back with only those keys emptied (the Supervisor replaces the options).
    While any value is still needed (its import failed) nothing is written. If the write is impossible or refused, nothing changes: one WARN line
    with the NAMES only, and the health report lists them. Runs after the database work (no connection is held during the call).
    Returns the names emptied."""
    from ..config import DEPRECATED_SECRET_OPTIONS
    from . import connection_store, self_update

    LINGERING_OPTIONS.clear()
    path = options_path or _options_path()
    if options_path is None and not settings.in_addon:
        return []
    try:
        import json

        options = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    except (OSError, ValueError):
        return []
    if not isinstance(options, dict):
        return []
    lingering = [k for k in DEPRECATED_SECRET_OPTIONS if options.get(k) not in (None, "")]
    if not lingering:
        return []
    try:
        with db.connection(mode="read", label="secrets_store.lingering") as conn:
            rows = _rows(conn)
            nvr = connection_store.get_row(conn)
            nvr_has_password = bool(nvr is not None and nvr["password_enc"])
    except Exception:  # noqa: BLE001 - never block the start
        LINGERING_OPTIONS.extend(lingering)
        log.warning("old secrets are still in the add-on options (%s): remove them in the add-on configuration", ", ".join(lingering))
        return []
    safe = [k for k in lingering if (k == "nvr_password" and nvr_has_password) or (k != "nvr_password" and k in rows)]
    keep = [k for k in lingering if k not in safe]
    if keep:  # a value still needed: nothing is written (the writer may only empty these keys), every lingering name is reported
        LINGERING_OPTIONS.extend(lingering)
        log.warning("old secrets are still in the add-on options and %s not moved yet (%s); enter them in Settings, then remove them "
                    "from the add-on configuration", "some were" if safe else "they were", ", ".join(lingering))
        return []
    body = {"options": {**options, **{k: "" for k in safe}}}
    try:
        reply = self_update.call(settings, "POST", self_update.P_OPTIONS, body=body, timeout=10.0)
        ok = reply.kind == "ok"
    except self_update.ProbeRefused:
        ok = False
    except Exception:  # noqa: BLE001 - never block the start
        ok = False
    if not ok:
        LINGERING_OPTIONS.extend(safe)
        log.warning("old secrets are still in the add-on options (%s): they are no longer used - remove them in the add-on configuration",
                    ", ".join(safe))
        return []
    log.info("the old secret options were emptied in the add-on configuration (%s); the secrets store decides", ", ".join(safe))
    return safe


def apply_live(app: Any, name: str, value: str | None) -> None:
    """After a save / clear: request handlers see the new value at once (app.state.settings is replaced); background workers keep
    their start-up copy until the next start (`restart_required`)."""
    spec = _spec(name)
    _set_env(spec, value, True)
    if spec.field is None:
        return
    app.state.settings = _with_values(app.state.settings, {name: value})


# ---------------------------------------------------------------- the status (never a value)

def _user_name(conn: sqlite3.Connection, user_id: str | None) -> str | None:
    if not user_id:
        return None
    try:
        row = conn.execute("SELECT display_name, username FROM users WHERE id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:
        return None
    return (row["display_name"] or row["username"] or None) if row else None


def status(conn: sqlite3.Connection, settings: Settings) -> list[dict[str, Any]]:
    rows = _rows(conn)
    out: list[dict[str, Any]] = []
    for spec in SPECS:
        row = rows.get(spec.name)
        if row is None:
            legacy = legacy_value(settings, spec)
            state = "legacy" if legacy else "not_set"
            item = {"configured": bool(legacy), "state": state, "source": ("addon_option" if (settings.legacy_secret_options or {}).get(spec.name) else "environment") if legacy else None,
                    "updated_at": None, "updated_by": None, "updated_by_name": None}
        else:
            readable = _readable(settings.data_dir, row)
            has = bool(row["value_enc"])
            state = "unreadable" if has and not readable else ("set" if has else "not_set")
            item = {"configured": state == "set", "state": state, "source": row["source"], "updated_at": row["updated_at"], "updated_by": row["updated_by"],
                    "updated_by_name": _user_name(conn, row["updated_by"])}
        out.append({"name": spec.name, "label_he": spec.label_he, "label_en": spec.label_en, "restart_required": spec.restart_required,
                    "testable": spec.test is not None, **item})
    return out
