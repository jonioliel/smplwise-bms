"""CR-038 slice 4: the wiring of the public listener (docs/changes/CR-038-PUBLIC-CORE-NOTES.md section 5) - one object per
process (`RUNTIME`), driven by main.py:

- `configure(settings, db)` at start-up: the add-on option `tickets_public`, the data directory, the module key (keyring.KEYS,
  with the store's "does any row depend on a key" check - W12);
- `start(db, settings)` from `_start_janitor` ONLY when the option is on, in a worker thread (`run_in_threadpool`: the listener's
  start waits up to 5 s - never on the main loop, W14); it builds the public app over the real store (public_store), restores the
  rate counters (both scopes, after the migrations - W15) and starts the listener on its own thread / loop / pool;
- `stop(db)` from `_stop_janitor`: the listener ends, the counters reach the database;
- `janitor(db)` from `janitor_tick` (a guarded step): the counters' flush, the module switch's refresh (W3) and the hourly
  retention of codes, sessions, redeem ids and access rows (spec 15.1);
- `module_switched(on)` right after `PUT /settings tickets.enabled` (W3), and the first module key when it is turned on (W12);
- `set_trusted(cidrs)` right after a change of `public.trusted_proxy_cidrs` - the edge follows without a restart (W13);
- `ready(conn)` - external assignment is possible: the option is on, the listener runs, a public address is configured;
- `health(conn)` - the spec 17 counters for Settings and the diagnostics screen.
The listener answers the uniform 404 to everything while the module is off (it starts on the add-on option alone - spec 6, C8)."""
from __future__ import annotations

import datetime as dt
import logging
import threading
import time
from pathlib import Path
from typing import Any

from ...db import Database, get_setting
from . import settings_doc, store_links
from .codes import CodeEngine
from .image_intake import StorageMeter
from .keyring import KEYS
from .module_key import ModuleKeyError
from .public_app import PublicApp, PublicDeps, create_public_app
from .public_ports import CachedSwitch
from .public_server import SERVER
from .public_store import NoCodeChannel, SqlCodeStore, SqlLinkStore, SqlPhotoSink, SqlRedeemStore, SqlRequestLog
from .ratelimit import DEFAULT_TRUSTED_PROXY_CIDRS, new_public_limiter, parse_trusted_cidrs

log = logging.getLogger("smplwise.tickets.public")
RETENTION_EVERY_S = 3600.0
ACCESS_KEEP_DAYS = 90
CODES_KEEP_DAYS = 1


class Runtime:
    def __init__(self) -> None:
        self.option_on = False
        self.data_dir: Path | None = None
        self.www_public: Path | None = None
        self.app: PublicApp | None = None
        self.switch: CachedSwitch | None = None
        self.error: str | None = None
        self.listening = False
        self._retention_at = 0.0
        self._lock = threading.Lock()

    # ---------------------------------------------------------------- start-up / shut-down

    def configure(self, settings: Any, db: Database) -> None:
        self.option_on = bool(getattr(settings, "tickets_public", False))
        self.data_dir = Path(settings.data_dir)
        self.www_public = getattr(settings, "www_public_dir", None)

        def has_keyed_rows() -> bool:
            with db.connection(mode="read", label="tickets.keyring") as conn:
                return store_links.any_keyed_row(conn)

        KEYS.configure(self.data_dir, has_keyed_rows)

    def attachments_root(self) -> Path:
        root = (self.data_dir or Path(".")) / "tickets"
        root.mkdir(parents=True, exist_ok=True)
        return root

    def build_app(self, db: Database, *, clock=None) -> PublicApp:
        """The public app over the real store (the public-core notes, wiring item 2)."""
        from .public_routes import build_router

        switch = CachedSwitch(lambda: _module_on(db))
        switch.refresh()
        with db.connection(mode="read", label="tickets.public.build") as conn:
            doc = settings_doc.read(conn)
        try:
            trusted = parse_trusted_cidrs(doc["public"]["trusted_proxy_cidrs"])
        except ValueError:
            trusted = parse_trusted_cidrs(DEFAULT_TRUSTED_PROXY_CIDRS)
        limiter = new_public_limiter(clock) if clock is not None else new_public_limiter()
        root = self.attachments_root()
        engine_kw: dict[str, Any] = {"limiter": limiter}
        if clock is not None:
            engine_kw["clock"] = clock
        codes = CodeEngine(SqlCodeStore(db), KEYS, **engine_kw)
        shell = self.www_public if self.www_public and Path(self.www_public).is_dir() else None
        deps_kw: dict[str, Any] = {}
        if clock is not None:
            deps_kw["clock"] = clock
        deps = PublicDeps(
            links=SqlLinkStore(db), switch=switch, key=KEYS, trusted_proxies=trusted, requests=SqlRequestLog(db), redeems=SqlRedeemStore(db),
            codes=codes, code_sender=NoCodeChannel(), photos=SqlPhotoSink(db, root, clock=clock), attachments_root=root,
            storage=StorageMeter(root), shell_dir=Path(shell) if shell else None, limiter=limiter,
            extra_routers=(build_router(db, clock=clock),), **deps_kw,
        )
        app = create_public_app(deps)
        try:
            app.gate.restore_from(db)  # both scopes: the windows and the known-good marks (wiring item 2; after migrate - W15)
        except Exception:  # noqa: BLE001 - empty counters are the old behaviour, never a reason not to start
            log.warning("tickets public counters were not restored", exc_info=True)
        self.switch = switch
        self.app = app
        return app

    def start(self, db: Database, settings: Any) -> bool:
        """Blocking (up to 5 s): call through run_in_threadpool from `_start_janitor` (W14)."""
        if not self.option_on:
            return False
        try:
            app = self.build_app(db)
        except Exception as exc:  # noqa: BLE001 - the main app keeps running; health shows the reason
            self.error = type(exc).__name__
            log.warning("tickets public app could not be built: %s", self.error)
            return False
        started = SERVER.start(app)
        self.listening = bool(started)
        self.error = None if started else (SERVER.error or "not_started")
        self._check_key()
        return started

    def stop(self, db: Database | None = None) -> None:
        SERVER.stop()
        self.listening = False
        app = self.app
        if app is not None and db is not None:
            try:
                app.gate.flush_to(db)
            except Exception:  # noqa: BLE001
                log.warning("tickets public counters were not flushed at stop", exc_info=True)

    def _check_key(self) -> None:
        """W12: links exist but the key is not usable (a /data restored without secrets/) - an ERROR line and a health flag."""
        st = KEYS.status()
        if st.get("state") not in ("ok", "absent"):
            log.error("tickets module key is %s: handler links cannot work - restore secrets/ from the backup", st.get("state"))

    # ---------------------------------------------------------------- the janitor and the settings routes

    def janitor(self, db: Database, *, force: bool = False) -> None:
        app, switch = self.app, self.switch
        if switch is not None:
            switch.refresh()  # W3: the module switch follows the setting within one tick even without the settings route
        if app is not None:
            app.gate.flush_to(db)  # its own scopes only; no write transaction when nothing changed
        now = time.monotonic()
        if force or now - self._retention_at >= RETENTION_EVERY_S:
            self._retention_at = now
            stamp = dt.datetime.now(dt.timezone.utc)
            with db.connection(label="tickets.links.retention") as conn:
                store_links.prune(conn, codes_before=_iso(stamp - dt.timedelta(days=CODES_KEEP_DAYS)),
                                  access_before=_iso(stamp - dt.timedelta(days=ACCESS_KEEP_DAYS)))
                in_use = store_links.key_ids_in_use(conn)
            if KEYS.configured and KEYS.can_rotate():
                KEYS.retire_unused(in_use)  # a key file no live link and no phone key names any more (after a rotation)

    def module_switched(self, on: bool) -> None:
        """Right after `tickets.enabled` changed (the settings route): the listener's switch follows at once, and the first
        module key is minted when the module is turned on and nothing depends on a key yet (W12)."""
        if self.switch is not None:
            self.switch.set(on)
        if on and KEYS.configured:
            try:
                KEYS.current(create=True)
            except ModuleKeyError as exc:
                log.error("tickets module key: %s", exc)

    def set_trusted(self, cidrs: list[str]) -> None:
        app = self.app
        if app is None:
            return
        try:
            app.edge.trusted = tuple(parse_trusted_cidrs(cidrs))
        except ValueError:
            return

    def ready(self, conn) -> bool:
        return self.option_on and self.listening and bool(settings_doc.read(conn)["public"]["base_url"])

    def missing(self, conn) -> list[str]:
        """What stops external assignment, for Settings and the assign dialog: option | listener | address | key."""
        out: list[str] = []
        if not self.option_on:
            out.append("option")
        elif not self.listening:
            out.append("listener")
        if not settings_doc.read(conn)["public"]["base_url"]:
            out.append("address")
        if KEYS.configured and KEYS.status().get("state") not in ("ok", "absent"):
            out.append("key")
        return out

    def health(self, conn) -> dict[str, Any]:
        app = self.app
        now = _iso(dt.datetime.now(dt.timezone.utc))
        return {
            "option": self.option_on,
            "listener": SERVER.snapshot(),
            "error": self.error,
            "rate_limit_trips": app.gate.trips() if app is not None else {},
            "module_key": KEYS.status() if KEYS.configured else {"state": "not_configured"},
            "links": store_links.link_state_counts(conn, now),
            "address_configured": bool(settings_doc.read(conn)["public"]["base_url"]),
            "missing": self.missing(conn),
        }


def _iso(at: dt.datetime) -> str:
    return at.astimezone(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _module_on(db: Database) -> bool:
    with db.connection(mode="read", label="tickets.public.switch") as conn:
        return (get_setting(conn, "tickets.enabled", "false") or "false") == "true"


RUNTIME = Runtime()
