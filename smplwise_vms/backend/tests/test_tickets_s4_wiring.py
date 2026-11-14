"""CR-038 slice 4 - the wiring traps of the public-core code review (private/planning/TICKETS_PUBLIC_CORE_CODE_REVIEW_2026-10-13.md
section 3, W1-W22) as explicit tests over the REAL store and the real wiring. Each test names the trap it closes; W20 (the page
never renders a vendor's text as HTML / a link) is the frontend's unit test, W22 (the install guide) is slice 8's.

The ports are exercised directly (public_store.Sql*), the way the public app calls them, on a database with migrations 0079 +
0080 and a ticket sent to an outside contact (tests/tickets_s4_world.py)."""
from __future__ import annotations

import ast
import contextlib
import datetime as dt
import re
import threading
import time
from pathlib import Path

import pytest

from smplwise import db as dbmod
from smplwise.services import backup
from smplwise.services.tickets import (address_probe, codes, handler_actions, image_intake, links, public_store, store_links)
from smplwise.services.tickets.codes import CodeEngine, CodeRefused
from smplwise.services.tickets.keyring import KEYS
from smplwise.services.tickets.module_key import ModuleKeyError
from smplwise.services.tickets.public_ports import StoredImage
from smplwise.services.tickets.public_runtime import RUNTIME
from tickets_s4_world import API, Clock, build_s4, crid

SMPLWISE = Path(dbmod.__file__).resolve().parent
REPO = SMPLWISE.parents[2]


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def record_of(s4, ticket_id: str):
    row = s4.link_row(ticket_id)
    return public_store.SqlLinkStore(s4.db).lookup(row["token_hash"])


class TracingDb(dbmod.Database):
    """A Database whose connections record every statement and the mode they were opened in."""

    def __init__(self, path) -> None:
        super().__init__(path)
        self.statements: list[str] = []
        self.modes: list[str] = []

    @contextlib.contextmanager
    def connection(self, mode: str = "write", label: str | None = None, durable: bool = True):
        self.modes.append(mode)
        with super().connection(mode=mode, label=label, durable=durable) as conn:
            conn.set_trace_callback(self.statements.append)
            try:
                yield conn
            finally:
                conn.set_trace_callback(None)


# ---------------------------------------------------------------- W1 / W6: one indexed read, on a read connection


def test_w1_the_lookup_is_one_statement_on_the_token_hash_index_in_every_state(s4):
    t, _token = s4.sent()
    row = s4.link_row(t["id"])
    with s4.db.connection(mode="read") as conn:
        plan = [r[3] for r in conn.execute("EXPLAIN QUERY PLAN " + store_links.LOOKUP_SQL + "WHERE l.token_hash = ?", (row["token_hash"],))]
    assert plan[0].startswith("SEARCH l USING INDEX") and "token_hash" in plan[0], plan
    assert not any(p.startswith("SCAN") for p in plan), plan
    tracing = TracingDb(s4.w.settings.db_path)
    store = public_store.SqlLinkStore(tracing)
    for state in ("live", "revoked", "unknown"):
        if state == "revoked":
            assert s4.c.post(f"{API}/tickets/{t['id']}/link/revoke").status_code == 200
        tracing.statements.clear()
        rec = store.lookup(row["token_hash"] if state != "unknown" else "0" * 64)
        selects = [s for s in tracing.statements if s.lstrip().upper().startswith("SELECT")]
        assert len(selects) == 1, (state, tracing.statements)
        assert (rec is None) == (state == "unknown") and (state != "revoked" or rec.revoked)
    assert set(tracing.modes) == {"read"}, "W6: an anonymous lookup never takes the write gate"


# ---------------------------------------------------------------- W2: the fold of every state


def test_w2_revoked_when_the_assignment_ended_or_moved_on(s4):
    t, _token = s4.sent()
    tid = t["id"]
    assert record_of(s4, tid).available(time.time())
    with s4.db.connection() as conn:  # an assignment that ended without the link being revoked (a path that forgot the hook)
        conn.execute("UPDATE ticket_assignments SET ended_at = 'x', end_reason = 'reassigned' WHERE ticket_id = ?", (tid,))
    assert record_of(s4, tid).revoked
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_assignments SET ended_at = NULL, end_reason = NULL WHERE ticket_id = ?", (tid,))
        conn.execute("UPDATE tickets SET current_assignment_id = NULL WHERE id = ?", (tid,))
    assert record_of(s4, tid).revoked, "the ticket's current assignment is another one"


def test_w2_a_closed_ticket_without_a_recorded_grace_is_unavailable(s4):
    t, _token = s4.sent()
    with s4.db.connection() as conn:  # closed by a path that did not record the grace: fail closed
        conn.execute("UPDATE tickets SET status = 'closed', current_assignment_id = NULL WHERE id = ?", (t["id"],))
        conn.execute("UPDATE ticket_assignments SET ended_at = 'x', end_reason = 'closed' WHERE ticket_id = ?", (t["id"],))
    assert not record_of(s4, t["id"]).available(time.time())


def test_w2_grace_is_read_only_then_gone_and_never_revives_an_expired_link(s4):
    t, _token = s4.sent()
    assert s4.w.status("joni", t["id"], "closed", note="סגירה").status_code == 200
    rec = record_of(s4, t["id"])
    now = time.time()
    assert rec.available(now) and rec.read_only(now) and not rec.available(now + 25 * 3600)
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_links SET expires_at = '2000-01-01T00:00:00Z' WHERE ticket_id = ?", (t["id"],))
    assert not record_of(s4, t["id"]).available(now), "a grace never brings an expired link back"


def test_w2_a_purged_ticket_takes_its_link_with_it(s4):
    t, _token = s4.sent()
    h = s4.link_row(t["id"])["token_hash"]
    with s4.db.connection() as conn:
        conn.execute("DELETE FROM tickets WHERE id = ?", (t["id"],))
    assert public_store.SqlLinkStore(s4.db).lookup(h) is None


# ---------------------------------------------------------------- W3: the module switch


def test_w3_the_switch_follows_the_setting_at_once_and_in_the_janitor(s4, monkeypatch):
    _t, token = s4.sent()
    client, app = s4.public(Clock(time.time()))
    monkeypatch.setattr(RUNTIME, "switch", app.deps.switch)
    assert client.get("/t/api/ticket", headers={"x-ticket-token": token}).status_code == 200
    assert s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    assert client.get("/t/api/ticket", headers={"x-ticket-token": token}).status_code == 404, "the settings route (W3)"
    with s4.db.connection() as conn:  # changed behind the route's back: the janitor's refresh picks it up
        conn.execute("UPDATE settings SET value = 'true' WHERE key = 'tickets.enabled'")
    RUNTIME.janitor(s4.db)
    assert client.get("/t/api/ticket", headers={"x-ticket-token": token}).status_code == 200


def test_w3_the_switch_starts_closed_until_the_first_refresh():
    from smplwise.services.tickets.public_ports import CachedSwitch

    sw = CachedSwitch(lambda: True)
    assert sw.module_on() is False
    sw.refresh()
    assert sw.module_on() is True


# ---------------------------------------------------------------- W4: redeem ids


def test_w4_a_redeem_id_releases_at_most_three_times_under_concurrency(s4):
    t, _token = s4.sent()
    row = s4.link_row(t["id"])
    rid = links.new_redeem_id()
    now = time.time()
    with s4.db.connection() as conn:
        store_links.insert_redeem(conn, links.redeem_hash(rid), row["id"], row["generation"], public_store.iso(now), public_store.iso(now + 86400))
    store = public_store.SqlRedeemStore(s4.db)
    results: list = []
    barrier = threading.Barrier(8)

    def press() -> None:
        barrier.wait()
        results.append(store.release(links.redeem_hash(rid), now, 3))

    threads = [threading.Thread(target=press) for _ in range(8)]
    for th in threads:
        th.start()
    for th in threads:
        th.join(30)
    assert sum(1 for r in results if r) == 3 and all(r == (row["id"], row["generation"]) for r in results if r)
    assert store.release(links.redeem_hash(rid), now + 90000, 3) is None


# ---------------------------------------------------------------- W5: the effect and its request row in ONE transaction


def _image() -> StoredImage:
    return StoredImage(rel_path="x/0123456789abcdef.jpg", sha256="0" * 64, bytes=10, width=1, height=1)


def test_w5_a_crash_inside_the_photo_transaction_leaves_nothing(s4, monkeypatch):
    t, _token = s4.sent()
    rec = record_of(s4, t["id"])
    sink = public_store.SqlPhotoSink(s4.db, s4.w.settings.data_dir / "tickets")
    real = handler_actions._progress

    def crash(*a, **kw):
        real(*a, **kw)
        raise RuntimeError("power cut")

    monkeypatch.setattr(handler_actions, "_progress", crash)
    rid = crid()
    with pytest.raises(RuntimeError):
        sink.record(rec, _image(), rid)
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_attachments").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM ticket_requests WHERE client_request_id = ?", (rid,)).fetchone()[0] == 0
    monkeypatch.setattr(handler_actions, "_progress", real)
    answer = sink.record(rec, _image(), rid)
    log = public_store.SqlRequestLog(s4.db)
    assert log.get(f"link:{rec.link_id}:{rec.generation}", rid).body == answer, "the request row came with the effect"
    assert log.put(f"link:{rec.link_id}:{rec.generation}", rid, "/t/api/photo", 201, answer) is False, "the app's put is a no-op"


def test_w5_a_crash_inside_a_write_rolls_back_the_effect_and_the_claim(s4, monkeypatch):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    real = handler_actions.notify_bridge.ticket_status
    monkeypatch.setattr(handler_actions.notify_bridge, "ticket_status", lambda *a: (_ for _ in ()).throw(RuntimeError("boom")))
    rid = crid()
    r = client.post("/t/api/status", headers={"x-ticket-token": token}, json={"status": "acknowledged", "client_request_id": rid})
    assert r.status_code == 500
    assert s4.w.detail(t["id"])["status"] == "assigned"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_requests WHERE client_request_id = ?", (rid,)).fetchone()[0] == 0
    monkeypatch.setattr(handler_actions.notify_bridge, "ticket_status", real)
    r = client.post("/t/api/status", headers={"x-ticket-token": token}, json={"status": "acknowledged", "client_request_id": rid})
    assert r.status_code == 200, "the retry with the same id applies once"


# ---------------------------------------------------------------- W7 / W8 / W9: codes over the real store


def _engine(s4) -> CodeEngine:
    return CodeEngine(public_store.SqlCodeStore(s4.db), KEYS)


def test_w7_a_new_code_ends_the_older_one_and_consume_is_compare_and_set(s4):
    t, _token = s4.sent()
    rec = record_of(s4, t["id"])
    store = public_store.SqlCodeStore(s4.db)
    eng = _engine(s4)
    first = eng.issue(rec, "whatsapp")
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_link_codes SET created_at = '2000-01-01T00:00:00Z' WHERE id = ?", (first.code_id,))  # past the 60 s cap
    second = eng.issue(rec, "whatsapp")
    with s4.db.connection(mode="read") as conn:
        rows = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM ticket_link_codes")}
    assert rows[first.code_id]["expires_at"] <= public_store.iso(time.time() + 1), "W7: the older code stopped at once"
    assert store.consume(second.code_id, time.time()) is True and store.consume(second.code_id, time.time()) is False


def test_w8_a_code_of_the_old_generation_never_verifies_for_the_new_link(s4):
    t, _token = s4.sent()
    rec = record_of(s4, t["id"])
    eng = _engine(s4)
    issued = eng.issue(rec, "whatsapp")
    code = codes.derive_code(KEYS.get(rec.key_id), issued.code_id)
    assert s4.c.post(f"{API}/tickets/{t['id']}/link/new").status_code == 200
    rec2 = record_of(s4, t["id"])
    assert rec2.generation == 2
    with pytest.raises(CodeRefused):
        eng.verify(rec2, code)


def test_w9_the_six_digits_are_never_stored(s4):
    t, _token = s4.sent()
    rec = record_of(s4, t["id"])
    issued = _engine(s4).issue(rec, "whatsapp")
    code = codes.derive_code(KEYS.get(rec.key_id), issued.code_id)
    with s4.db.connection(mode="read") as conn:
        dump = " ".join(str(v) for r in conn.execute("SELECT * FROM ticket_link_codes") for v in tuple(r))
    assert code not in dump
    assert public_store.NoCodeChannel().channel_for(rec) is None and public_store.NoCodeChannel().send(rec, issued.code_id, "whatsapp") is False


# ---------------------------------------------------------------- W10 / W19: the photo port's reads


def test_w10_w19_open_only_this_tickets_photos_and_only_confined_paths(s4):
    t1, _ = s4.sent()
    t2, _ = s4.sent(title="נזילה")
    r1, r2 = record_of(s4, t1["id"]), record_of(s4, t2["id"])
    sink = public_store.SqlPhotoSink(s4.db, s4.w.settings.data_dir / "tickets")
    aid = sink.record(r2, _image(), crid())["id"]
    assert sink.open(r1, aid) is None, "another ticket's photo"
    assert sink.open(r2, aid) is not None
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_attachments SET path = '../../secrets/tickets_key.current' WHERE id = ?", (aid,))
    assert sink.open(r2, aid) is None, "W19: a stored path outside the folder"


# ---------------------------------------------------------------- W11: backup roots


def test_w11_backup_roots_are_disjoint_and_secrets_never_restore():
    roots = backup.RESTORABLE_ROOTS
    assert "tickets/" in roots and len(set(roots)) == len(roots)
    assert all(not a.startswith(b) for a in roots for b in roots if a != b), "disjoint roots"
    assert backup.restorable("tickets/t1/0123456789abcdef.jpg")
    for bad in ("secrets/tickets_key.current", "tickets/../secrets/tickets_key.abc", "plans/secrets/x.png", "tickets/secrets/x"):
        assert not backup.restorable(bad), bad
    assert "tickets.settings" in backup.SETTINGS_KEEP and "tickets.enabled" in backup.SETTINGS_KEEP


# ---------------------------------------------------------------- W12: the module key


def test_w12_a_lost_key_is_never_replaced_while_rows_depend_on_it(s4):
    _t, _token = s4.sent()
    secrets_dir = s4.w.settings.data_dir / "secrets"
    for f in secrets_dir.iterdir():
        f.unlink()
    KEYS.reload()
    assert KEYS.ensure() is None, "rows depend on a key: refuse, never mint"
    assert not list(secrets_dir.iterdir())
    t = s4.ticket()
    r = s4.assign_contact(t["id"])
    assert r.status_code == 409 and r.json()["code"] == "module_key_missing"
    assert KEYS.status()["state"] in ("absent", "orphaned")
    with pytest.raises(ModuleKeyError):
        KEYS.current(create=False)


def test_w12_only_the_module_on_paths_mint_the_key(s4):
    src = {p.name: p.read_text(encoding="utf-8") for p in (SMPLWISE / "services" / "tickets").glob("*.py") if p.name != "module_key.py"}
    callers = sorted(name for name, text in src.items() if re.search(r"current\(create=True\)|\.ensure\(\)", text))
    assert callers == ["keyring.py", "public_runtime.py"], callers  # the module key library itself documents the rule


# ---------------------------------------------------------------- W13: proxies and the probe


def test_w13_the_client_header_setting_is_validated_and_reaches_the_edge(s4, monkeypatch):
    _client, app = s4.public(Clock(time.time()))
    monkeypatch.setattr(RUNTIME, "app", app)
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"client_ip_header": "x-real-ip"}}).status_code == 422
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "public": {"client_ip_header": "x-forwarded-for"}})
    assert r.status_code == 200 and app.edge.client_ip_header == b"x-forwarded-for"


@pytest.mark.parametrize("addr", ["127.0.0.1", "10.1.2.3", "192.168.1.5", "172.30.32.4", "100.64.0.9", "169.254.1.1", "::1", "fd00::1",
                                  "::ffff:10.0.0.1", "0.0.0.0", "224.0.0.1"])
def test_w21_the_probe_refuses_private_targets_before_connecting(addr):
    called = []
    out = address_probe.probe("https://t-x.example.test", resolve=lambda h: [addr], fetch=lambda *a: called.append(a) or (200, b""))
    assert out == {"result": "blocked_address"} and not called


def test_w21_w13_the_probe_reports_the_listener_and_never_the_body():
    notes: dict = {}

    def fetch(addr, host, timeout, nonce, path="/t/healthz"):
        notes.update({"nonce": nonce, "source": "header", "peer": "172.30.33.7"})
        return 200, b'{"ok":true} SECRET BODY'

    out = address_probe.probe("https://t-x.example.test", resolve=lambda h: ["93.184.216.34"], fetch=fetch, last_probe=lambda: notes)
    assert out == {"result": "reachable", "listener": {"seen": True, "source": "header", "peer": "172.30.33.7", "header_ok": True}}
    assert "SECRET" not in str(out)
    other = address_probe.probe("https://t-x.example.test", resolve=lambda h: ["93.184.216.34"], fetch=lambda *a: (302, b""))
    assert other == {"result": "wrong_answer", "status_class": "3xx"}, "a redirect is never followed"
    seen_other = address_probe.probe("https://t-x.example.test", resolve=lambda h: ["93.184.216.34"], fetch=lambda *a: (200, b'{"ok":true}'),
                                     last_probe=lambda: {"nonce": "someone-else"})
    assert seen_other["listener"] == {"seen": False}


def test_254_the_probe_goes_to_the_prefixed_path_and_a_404_is_reported_as_not_routed():
    seen: list = []

    def fetch(addr, host, timeout, nonce, path="/t/healthz"):
        seen.append((host, path))
        return 200, b'{"ok":true}'

    resolve = lambda h: ["93.184.216.34"]  # noqa: E731
    assert address_probe.probe("https://ecc.example.test/support", resolve=resolve, fetch=fetch)["result"] == "reachable"
    assert address_probe.probe("https://ecc.example.test", resolve=resolve, fetch=fetch)["result"] == "reachable"
    assert seen == [("ecc.example.test", "/support/healthz"), ("ecc.example.test", "/t/healthz")]
    miss = address_probe.probe("https://ecc.example.test/support", resolve=resolve, fetch=lambda *a: (404, b"nope"))
    assert miss == {"result": "wrong_answer", "status_class": "4xx", "code": "not_routed"}
    assert address_probe.probe("https://ecc.example.test/a/b", resolve=resolve, fetch=fetch) == {"result": "invalid", "code": "path"}


def test_w21_the_probe_route_is_local_only_and_rate_limited(s4, monkeypatch):
    from smplwise import remote_channel

    assert "/api/v1/tickets/address/probe" in remote_channel.BLOCKED_ON_REMOTE
    monkeypatch.setattr(address_probe, "_calls", address_probe.collections.deque())
    monkeypatch.setattr(address_probe, "_resolve", lambda h: ["10.0.0.1"])
    codes_seen = [s4.c.post(f"{API}/tickets/address/probe", json={}).status_code for _ in range(7)]
    assert codes_seen[:6] == [200] * 6 and codes_seen[6] == 429
    assert s4.c.post(f"{API}/tickets/address/probe", json={}, headers=s4.h("mona")).status_code == 403


# ---------------------------------------------------------------- W14 / W15 / W16 / W17: the shared files


def test_w14_w15_main_starts_the_listener_in_a_worker_thread_and_guards_the_janitor():
    main = (SMPLWISE / "main.py").read_text(encoding="utf-8")
    assert "await run_in_threadpool(tickets_public.start, app.state.db, settings)" in main
    assert "if settings.tickets_public:" in main
    tree = ast.parse(main)
    tick = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "janitor_tick")
    guarded = [h for h in ast.walk(tick) if isinstance(h, ast.Try) and "tickets_public.janitor" in ast.unparse(h)]
    assert guarded, "the public janitor step is a guarded step (W15)"
    assert 'logging.getLogger("PIL").setLevel(logging.INFO)' in main, "wiring item 12"


def test_w14_the_public_limiter_has_its_own_scope(s4):
    _client, app = s4.public(Clock(time.time()))
    assert app.deps.limiter.scope == "tickets_link"


def test_w16_the_shell_comes_from_www_public_and_the_main_app_serves_no_public_route(s4, tmp_path, monkeypatch):
    shell = tmp_path / "www-public"
    (shell / "assets").mkdir(parents=True)
    (shell / "index.html").write_text("<!doctype html><title>t</title>", encoding="utf-8")
    monkeypatch.setattr(RUNTIME, "www_public", shell)
    client, app = s4.public(Clock(time.time()))
    assert app.deps.shell_dir == shell and client.get("/t/").text.startswith("<!doctype html><title>t</title>")
    for path in ("/t/", "/t/api/ticket", "/t/healthz", "/api/v1/public/x"):
        assert s4.c.get(path).status_code == 404, path
    assert not (REPO / "smplwise_vms" / "www" / "t").exists()


def test_w17_the_slice4_public_modules_read_bodies_with_the_strict_readers():
    for name in ("public_routes.py", "handler_actions.py", "public_store.py"):
        text = (SMPLWISE / "services" / "tickets" / name).read_text(encoding="utf-8")
        assert "await request.body()" not in text and "await request.json()" not in text, name
    routes = (SMPLWISE / "services" / "tickets" / "public_routes.py").read_text(encoding="utf-8")
    # integ/270: + WISKEYID POST /t/api/arrival (strict reader + client request id); CR-SVC215: + POST /t/api/arrived - six of each
    assert routes.count("await read_json(request,") == 6 and routes.count("parse_client_request_id(") == 6


# ---------------------------------------------------------------- the add-on option


def test_the_add_on_option_is_declared_off_and_unmapped():
    import yaml

    from smplwise.services import self_update

    cfg = yaml.safe_load((REPO / "smplwise_vms" / "config.yaml").read_text(encoding="utf-8"))
    assert cfg["options"]["tickets_public"] is False and cfg["schema"]["tickets_public"] == "bool?"
    assert cfg["ports"]["18093/tcp"] is None and "tickets" in cfg["ports_description"]["18093/tcp"]
    assert self_update.OPTION_TYPES["tickets_public"] == "bool?"


def test_the_listener_is_not_started_without_the_option(s4, monkeypatch):
    started = []
    monkeypatch.setattr(RUNTIME, "option_on", False)
    from smplwise.services.tickets import public_runtime

    monkeypatch.setattr(public_runtime.SERVER, "start", lambda app, **kw: started.append(app) or True)
    assert RUNTIME.start(s4.db, s4.w.settings) is False and started == []


def test_runtime_start_and_stop_on_a_real_socket(s4, monkeypatch):
    """One real-socket run of the wiring (127.0.0.1, an ephemeral port): start builds the app over the store and serves the
    uniform 404 and the health route; stop joins the thread."""
    import socket

    from smplwise.services.tickets import public_runtime

    real_start = public_runtime.SERVER.start
    monkeypatch.setattr(public_runtime.SERVER, "start", lambda app, **kw: real_start(app, host="127.0.0.1", port=0))
    try:
        assert RUNTIME.start(s4.db, s4.w.settings) is True and RUNTIME.listening
        port = public_runtime.SERVER.port
        with socket.create_connection(("127.0.0.1", port), timeout=5) as sk:
            sk.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n")
            data = b""
            while True:
                chunk = sk.recv(4096)
                if not chunk:
                    break
                data += chunk
        assert data.startswith(b"HTTP/1.1 200") and b'{"ok":true}' in data
        with s4.db.connection(mode="read") as conn:
            health = RUNTIME.health(conn)
        assert health["listener"]["running"] is True and health["option"] is True and health["module_key"]["state"] == "ok"
    finally:
        RUNTIME.stop(s4.db)
    assert not public_runtime.SERVER.running and not RUNTIME.listening
