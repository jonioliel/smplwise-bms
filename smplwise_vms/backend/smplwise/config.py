"""Runtime settings.

Inside the add-on the Supervisor writes the user's options to /data/options.json and mounts /data as
persistent storage. On a developer workstation the same keys come from environment variables (the
NVR_* / GO2RTC_* names match secrets/lab.env so it can simply be sourced). Secrets are never logged.
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    www_dir: Path | None
    in_addon: bool
    trusted_proxies: tuple[str, ...]
    dev_user: str | None
    bootstrap_admin_username: str | None
    nvr_host: str | None
    nvr_http_port: int
    nvr_user: str | None
    nvr_password: str | None = field(repr=False)  # secrets never appear in a Settings repr (review 2a)
    go2rtc_url: str | None
    log_level: str
    nvr_rtsp_port: int = 554
    go2rtc_user: str | None = None
    go2rtc_password: str | None = field(default=None, repr=False)
    # WisKey door stations' own RTSP account, shared by every station (owner decision 2026-09-28); a station that needs
    # another one gets a per-station override (wiskey_station_credentials table). Server-side only, like nvr_password.
    wiskey_user: str | None = None
    wiskey_password: str | None = field(default=None, repr=False)
    # CR-006 phase 2 (AI-rendered floor skins): the OpenAI API key - an add-on option like the NVR password, server-side
    # only, never stored in the database, never in logs, audit rows or error payloads (services/skins/provider.redact).
    openai_api_key: str | None = field(default=None, repr=False)
    max_upload_bytes: int = 40 * 1024 * 1024
    max_pdf_pages: int = 20
    max_render_px: int = 3000
    preview_px: int = 1200
    render_timeout_s: int = 30
    detect_timeout_s: float = 60  # the guard on a synchronous structure detection (design 9.6 / decision 6)
    ha_url: str | None = None  # Core API base: http://supervisor/core inside the add-on
    ha_token: str | None = field(default=None, repr=False)  # SUPERVISOR_TOKEN inside the add-on; a developer token outside
    # CR-008 (SmplWise Arx remote access): add-on options. Off by default; when on, `<remote_path>/...` is served as the
    # remote channel (remote_channel.RemoteChannel) with its own HA-token login instead of Ingress identity headers.
    remote_access: bool = False
    remote_path: str = "/arx"
    # the FIFO write gate in front of SQLite's write lock (db.WriteGate); add-on option `db_write_gate`, default on.
    # SW_DB_WRITE_GATE=0 turns it off whatever the option says (an operational escape hatch)
    db_write_gate: bool = True
    # HA core itself (not the Supervisor proxy, which accepts only the add-on's SUPERVISOR_TOKEN): the remote channel's
    # user access tokens are validated here. None inside the add-on = discovered from the Supervisor's /core/info.
    ha_core_url: str | None = None
    extra: dict = field(default_factory=dict)
    # CR-022: the NVR connection the process runs with. `load_settings` fills the legacy add-on options / NVR_* values;
    # connection_store.load_effective() overlays the stored `recorder_connections` row once at start-up (the only place
    # that decides where the connection comes from) and records which row revision it loaded.
    nvr_vendor: str = "hikvision"
    nvr_extra: dict = field(default_factory=dict)
    nvr_from_options: bool = False  # the NVR host came from the add-on options file (the one-time import reads only this)
    # which NVR option keys the options file itself carried (not an NVR_* environment fallback): the import takes only these
    # (CR-022 security review F16)
    nvr_option_keys: frozenset = frozenset()
    nvr_connection_state: str | None = None  # None = legacy options / env; ok | incomplete | unreadable = the stored row
    nvr_connection_revision: int | None = None  # the row revision this process loaded (pending restart = it differs)
    # CR-024 (multi-NVR): which recorder the nvr_* fields above describe - `nvr-1` for the process-wide settings - and the
    # effective settings of every FURTHER recorder, overlaid once at start-up from its recorder_connections row
    # (connection_store.apply_at_startup). Read through recorder_scope.settings_for(settings, recorder_id) only. A child's own
    # `recorder_settings` is always empty. Never in a repr (the children carry passwords).
    nvr_recorder_id: str = "nvr-1"
    recorder_settings: dict = field(default_factory=dict, repr=False, compare=False)

    @property
    def plans_dir(self) -> Path:
        return self.data_dir / "plans"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "smplwise.db"


# CR-008: the remote channel's path prefix - one path segment, never a path the add-on or Home Assistant already uses at
# the root of the origin (the tunnel route sends only this prefix to the add-on; everything else stays HA's).
DEFAULT_REMOTE_PATH = "/arx"
_REMOTE_PATH_RE = re.compile(r"^/[a-z0-9][a-z0-9_-]{0,31}$")
_RESERVED_PATHS = {"/api", "/auth", "/healthz", "/local", "/static", "/frontend_latest", "/frontend_es5", "/hacsfiles",
                   "/hikvision-intercom", "/lovelace", "/config", "/profile", "/developer-tools", "/history", "/logbook",
                   "/map", "/energy", "/media-browser", "/todo", "/calendar", "/onboarding.html"}


def normalize_remote_path(raw: str | None) -> str:
    """`/arx` from `arx`, `/arx/` or `/ARX`; the default for anything that is not one safe path segment (logged)."""
    value = (raw or "").strip().lower()
    if not value:
        return DEFAULT_REMOTE_PATH
    value = "/" + value.strip("/")
    if not _REMOTE_PATH_RE.match(value) or value in _RESERVED_PATHS:
        logging.getLogger("smplwise").warning("remote_path %r is not a single safe path segment; using %s", raw, DEFAULT_REMOTE_PATH)
        return DEFAULT_REMOTE_PATH
    return value


def _truthy(value: object) -> bool:
    return value is True or str(value).strip().lower() in ("1", "true", "yes", "on")


# NVR-less mode (mode.py): outside the add-on (a developer backend, a throwaway test backend, a Playwright fixture) an
# installation without an NVR host would start in the `ha_only` mode and hide every camera screen. Those launches keep
# the full mode by default through this placeholder (a reserved `.test` name that never resolves; without an NVR user
# nothing ever connects to it). `SW_MODE=ha_only` asks for the NVR-less mode instead. Inside the add-on the options
# decide alone: no nvr_host is ha_only.
DEV_NVR_PLACEHOLDER = "nvr-placeholder.test"


def _opt(options: dict, key: str, env: str, default: str | None = None) -> str | None:
    value = options.get(key)
    if value in (None, ""):
        value = os.environ.get(env, default)
    return None if value in (None, "") else str(value)


def load_settings(options_file: str | os.PathLike | None = None) -> Settings:
    path = Path(options_file or os.environ.get("SW_OPTIONS_FILE", "/data/options.json"))
    options: dict = {}
    in_addon = False
    if path.exists():
        options = json.loads(path.read_text(encoding="utf-8"))
        in_addon = path == Path("/data/options.json")
    # CR-027: the SmplWise push relay (the phone app's notifications) - the add-on options reach the channel as runtime
    # environment only (services/mobile_push.py); the key is never stored in the database, a backup, a log or an error
    for key, env in (("push_relay_url", "SW_PUSH_RELAY_URL"), ("push_relay_key", "SW_PUSH_RELAY_KEY")):
        value = _opt(options, key, env)
        if value:
            os.environ[env] = value

    data_dir = Path(os.environ.get("SW_DATA_DIR") or ("/data" if in_addon else Path.cwd() / "data"))
    # CR-022: the workstation file <data>/nvr_connection.json of 0.1.71 is gone - the NVR connection is a database row
    # everywhere (services/connection_store.py; a leftover file is wiped and deleted at start-up, review F11); NVR_*
    # environment variables stay as the development and test fallback and are never imported (review F16).
    www_raw = os.environ.get("SW_WWW_DIR") or ("/app/www" if in_addon else None)
    www_dir = Path(www_raw) if www_raw else None

    # Supervisor Ingress proxies from a fixed address; anything else is refused unless dev mode is on.
    proxies = tuple(p.strip() for p in (os.environ.get("SW_TRUSTED_PROXIES") or "172.30.32.2").split(",") if p.strip())
    dev_user = None if in_addon else (os.environ.get("SW_DEV_USER") or None)

    return Settings(
        data_dir=data_dir,
        www_dir=www_dir,
        in_addon=in_addon,
        trusted_proxies=proxies,
        dev_user=dev_user,
        bootstrap_admin_username=_opt(options, "bootstrap_admin_username", "SW_BOOTSTRAP_ADMIN"),
        nvr_host=_opt(options, "nvr_host", "NVR_HOST") or (
            None if in_addon or os.environ.get("SUPERVISOR_TOKEN") or (os.environ.get("SW_MODE") or "").strip().lower() == "ha_only"
            else DEV_NVR_PLACEHOLDER),  # SUPERVISOR_TOKEN: inside the add-on, never a placeholder
        nvr_http_port=int(_opt(options, "nvr_http_port", "NVR_HTTP_PORT", "80") or 80),
        nvr_user=_opt(options, "nvr_username", "NVR_USER"),
        nvr_password=_opt(options, "nvr_password", "NVR_PASSWORD"),
        nvr_from_options=options.get("nvr_host") not in (None, ""),
        nvr_option_keys=frozenset(k for k in ("nvr_host", "nvr_http_port", "nvr_rtsp_port", "nvr_username", "nvr_password") if options.get(k) not in (None, "")),
        go2rtc_url=_opt(options, "go2rtc_url", "GO2RTC_URL"),
        log_level=(_opt(options, "log_level", "SW_LOG_LEVEL", "info") or "info").lower(),
        nvr_rtsp_port=int(_opt(options, "nvr_rtsp_port", "NVR_RTSP_PORT", "554") or 554),
        go2rtc_user=_opt(options, "go2rtc_api_username", "GO2RTC_API_USER"),
        go2rtc_password=_opt(options, "go2rtc_api_password", "GO2RTC_API_PASSWORD"),
        wiskey_user=_opt(options, "wiskey_username", "WISKEY_USER"),
        wiskey_password=_opt(options, "wiskey_password", "WISKEY_PASSWORD"),
        openai_api_key=_opt(options, "openai_api_key", "OPENAI_API_KEY"),
        # Home Assistant Core API: the Supervisor injects SUPERVISOR_TOKEN when config.yaml sets homeassistant_api;
        # never taken from the options file (no user token is stored in options).
        ha_url=("http://supervisor/core" if os.environ.get("SUPERVISOR_TOKEN") else (os.environ.get("HA_URL") or None)),
        ha_token=os.environ.get("SUPERVISOR_TOKEN") or os.environ.get("HA_TOKEN") or None,
        remote_access=_truthy(options["remote_access"]) if "remote_access" in options else _truthy(os.environ.get("SW_REMOTE_ACCESS", "")),
        db_write_gate=(_truthy(options["db_write_gate"]) if "db_write_gate" in options else True) and os.environ.get("SW_DB_WRITE_GATE", "1") != "0",
        remote_path=normalize_remote_path(_opt(options, "remote_path", "SW_REMOTE_PATH", DEFAULT_REMOTE_PATH)),
        # inside the add-on HA core is `homeassistant:<port>` on the Supervisor network (port / TLS from /core/info);
        # outside, the developer's HA (HA_CORE_URL, else HA_URL)
        ha_core_url=os.environ.get("HA_CORE_URL") or (None if os.environ.get("SUPERVISOR_TOKEN") else (os.environ.get("HA_URL") or None)),
    )
