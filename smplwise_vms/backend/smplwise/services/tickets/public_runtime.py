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
from . import links, settings_doc, store_links
from .codes import CodeEngine
from .image_intake import StorageMeter
from .keyring import KEYS
from .module_key import ModuleKeyError
from .public_app import PublicApp, PublicDeps, create_public_app
from .public_ports import CachedSwitch
from .public_server import SERVER
from .code_flow import SqlCodeEvents, SqlCodeSender
from .codes import CodePolicy
from .public_store import SqlCodeStore, SqlLinkStore, SqlPhotoSink, SqlRedeemStore, SqlRequestLog
from .ratelimit import CLIENT_IP_HEADERS, DEFAULT_TRUSTED_PROXY_CIDRS, new_public_limiter, parse_trusted_cidrs

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
        try:  # TK255 review F2: an installation already on /t keeps /t until its owner moves (once)
            with db.connection(label="tickets.path_prefix.pin") as conn:
                if settings_doc.pin_legacy_prefix(conn):
                    log.info("tickets public path prefix pinned to /t (existing address without a path)")
        except Exception:  # noqa: BLE001 - a database before the migrations: nothing to pin yet
            pass
        try:  # the module is already on (an installation from before slice 4, a restart): its key exists or is minted now (W12)
            if _module_on(db) and KEYS.ensure() is None:
                log.error("tickets module key is %s and rows depend on a key: restore secrets/ from the backup", KEYS.status().get("state"))
        except Exception:  # noqa: BLE001 - a database before the tickets migrations: nothing to key yet
            pass

    def attachments_root(self) -> Path:
        root = (self.data_dir or Path(".")) / "tickets"
        root.mkdir(parents=True, exist_ok=True)
        return root

    def build_app(self, db: Database, *, clock=None) -> PublicApp:
        """The public app over the real store (the public-core notes, wiring item 2)."""
        from . import public_claims, public_consent, public_documents, public_portal, public_quotes, public_rfq  # slice 9: claims (11A); TK257: quote; TKRFQVP: RFQ; VPORTAL; WA-CONSENT-LINK; CR-VENDORQ-294
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
        if limiter.scope != "tickets_link":  # W14: never the sign-in limiter or another module's scope
            raise RuntimeError("the public listener needs its own limiter scope")
        root = self.attachments_root()
        engine_kw: dict[str, Any] = {"limiter": limiter, "policy": code_policy_reader(db)}
        if clock is not None:
            engine_kw["clock"] = clock
        codes = CodeEngine(SqlCodeStore(db), KEYS, **engine_kw)
        shell = self.www_public if self.www_public and Path(self.www_public).is_dir() else None
        deps_kw: dict[str, Any] = {}
        if clock is not None:
            deps_kw["clock"] = clock
        deps = PublicDeps(
            links=SqlLinkStore(db), switch=switch, key=KEYS, trusted_proxies=trusted, requests=SqlRequestLog(db), redeems=SqlRedeemStore(db),
            codes=codes, code_sender=SqlCodeSender(db, KEYS, clock=clock),  # slice 7: D6 at send, the digits in memory only (W9)
            code_events=SqlCodeEvents(db, clock=clock),  # slice 7: access rows, timeline, sliding expiry, the lock -> the manager
            photos=SqlPhotoSink(db, root, clock=clock), attachments_root=root,
            storage=StorageMeter(root), shell_dir=Path(shell) if shell else None, limiter=limiter,
            extra_routers=(build_router(db, clock=clock), public_claims.build_router(db, clock=clock),
                           public_quotes.build_router(db, clock=clock),
                           public_rfq.build_router(db, clock=clock, limiter=limiter, policy=engine_kw["policy"]),
                           public_portal.build_router(db, clock=clock, data_dir=self.data_dir),  # VPORTAL: the vendor portal + the logo
                           public_consent.build_router(db, clock=clock),  # WA-CONSENT-LINK: the WhatsApp consent page
                           public_documents.build_router(db, clock=clock)),  # CR-VENDORQ-294: a document by a temporary link
            rfq_redeem=public_rfq.redeem_releaser(db),
            client_ip_header=doc["public"]["client_ip_header"],
            path_prefix=links.effective_prefix(doc["public"]["base_url"], doc["public"]["path_prefix"]),  # TK255
            legacy_t_paths=doc["public"]["legacy_t_paths"], claim_window=public_claims.claim_window(db),
            claim_files=public_claims.SqlClaimFileSink(db, clock=clock), **deps_kw,
        )
        app = create_public_app(deps)
        app.edge.set_portal(bool(doc.get("vendor_portal", {}).get("enabled")))  # VPORTAL: the bare / any-case root only while it is on
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
            try:  # VPORTAL: the portal switch follows the setting within one tick even without the settings route
                with db.connection(mode="read", label="tickets.portal.switch") as conn:
                    self.set_portal(settings_doc.read(conn))
            except Exception:  # noqa: BLE001
                pass
        now = time.monotonic()
        if force or now - self._retention_at >= RETENTION_EVERY_S:
            self._retention_at = now
            stamp = dt.datetime.now(dt.timezone.utc)
            with db.connection(label="tickets.links.retention") as conn:
                store_links.prune(conn, codes_before=_iso(stamp - dt.timedelta(days=CODES_KEEP_DAYS)),
                                  access_before=_iso(stamp - dt.timedelta(days=ACCESS_KEEP_DAYS)))
                try:  # TKRFQVP: the RFQ links' codes, sessions and wrong-code windows (0089), the same one-day rule
                    from . import store_rfq

                    store_rfq.prune_codes(conn, _iso(stamp - dt.timedelta(days=CODES_KEEP_DAYS)))
                except Exception:  # noqa: BLE001 - a database before 0089
                    pass
                from . import vendor_portal  # VPORTAL: portal code rows (2 days) and ended sessions

                vendor_portal.prune(conn, stamp)
                in_use = store_links.key_ids_in_use(conn)
            if KEYS.configured and KEYS.can_rotate():
                KEYS.retire_unused(in_use)  # a key file no live link and no phone key names any more (after a rotation)

    def module_switched(self, on: bool) -> None:
        """Right after `tickets.enabled` changed (the settings route): the listener's switch follows at once, and the first
        module key is minted when the module is turned on and nothing depends on a key yet (W12)."""
        if self.switch is not None:
            self.switch.set(on)
        if on and KEYS.configured and KEYS.ensure() is None:
            log.error("tickets module key is %s and rows depend on a key: restore secrets/ from the backup", KEYS.status().get("state"))

    def set_trusted(self, cidrs: list[str]) -> None:
        """W13: a changed `public.trusted_proxy_cidrs` reaches the running edge at once (no listener restart)."""
        app = self.app
        if app is None:
            return
        try:
            app.edge.trusted = tuple(parse_trusted_cidrs(cidrs))
        except ValueError:
            return

    def set_client_ip_header(self, header: str) -> None:
        """V3 / W13: where a trusted proxy puts the client address (`cf-connecting-ip` or `x-forwarded-for`, last hop)."""
        app = self.app
        if app is None or header not in CLIENT_IP_HEADERS:
            return
        app.edge.client_ip_header = header.encode("ascii")

    def set_prefix(self, doc: dict[str, Any]) -> None:
        """TK255: a changed `public.path_prefix` / `public.legacy_t_paths` / address path reaches the running edge at once. The
        stored values were validated on save; a value the edge still refuses leaves the edge as it was."""
        app = self.app
        if app is None:
            return
        pub = doc["public"]
        try:
            app.edge.set_prefix(links.effective_prefix(pub["base_url"], pub["path_prefix"]), bool(pub["legacy_t_paths"]))
        except ValueError:
            return

    def set_portal(self, doc: dict[str, Any]) -> None:
        """VPORTAL: a changed `vendor_portal.enabled` reaches the running edge (the bare / any-case page root)."""
        app = self.app
        if app is None:
            return
        app.edge.set_portal(bool((doc.get("vendor_portal") or {}).get("enabled")))

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


def code_policy_reader(db: Database, *, every_s: float = 30.0):
    """The code engine's policy from `tickets.settings.code` (ttl_min, max_attempts, lock_min; out-of-range values read as the
    defaults - codes.CodePolicy.from_settings), re-read at most every `every_s` seconds; a failing read keeps the last policy."""
    state: dict[str, Any] = {"at": -1e18, "policy": CodePolicy()}
    lock = threading.Lock()

    def read() -> CodePolicy:
        now = time.monotonic()
        with lock:
            if now - state["at"] < every_s:
                return state["policy"]
            state["at"] = now
        try:
            with db.connection(mode="read", label="tickets.public.code_policy") as conn:
                pol = CodePolicy.from_settings(settings_doc.read(conn).get("code"))
        except Exception:  # noqa: BLE001
            return state["policy"]
        with lock:
            state["policy"] = pol
        return pol

    return read


def _module_on(db: Database) -> bool:
    with db.connection(mode="read", label="tickets.public.switch") as conn:
        return (get_setting(conn, "tickets.enabled", "false") or "false") == "true"


RUNTIME = Runtime()
