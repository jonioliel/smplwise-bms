"""Runtime settings.

Inside the add-on the Supervisor writes the user's options to /data/options.json and mounts /data as
persistent storage. On a developer workstation the same keys come from environment variables (the
NVR_* / GO2RTC_* names match secrets/lab.env so it can simply be sourced). Secrets are never logged.
"""
from __future__ import annotations

import json
import os
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
    nvr_password: str | None
    go2rtc_url: str | None
    log_level: str
    max_upload_bytes: int = 40 * 1024 * 1024
    max_pdf_pages: int = 20
    max_render_px: int = 3000
    preview_px: int = 1200
    render_timeout_s: int = 30
    extra: dict = field(default_factory=dict)

    @property
    def plans_dir(self) -> Path:
        return self.data_dir / "plans"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "smplwise.db"


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

    data_dir = Path(os.environ.get("SW_DATA_DIR") or ("/data" if in_addon else Path.cwd() / "data"))
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
        nvr_host=_opt(options, "nvr_host", "NVR_HOST"),
        nvr_http_port=int(_opt(options, "nvr_http_port", "NVR_HTTP_PORT", "80") or 80),
        nvr_user=_opt(options, "nvr_username", "NVR_USER"),
        nvr_password=_opt(options, "nvr_password", "NVR_PASSWORD"),
        go2rtc_url=_opt(options, "go2rtc_url", "GO2RTC_URL"),
        log_level=(_opt(options, "log_level", "SW_LOG_LEVEL", "info") or "info").lower(),
    )
