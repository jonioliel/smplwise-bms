"""BACKEND-SAFETY-2435 (code review 2026-11-13): five P1 backend safety and stability fixes, each with its regression test.

1. restore path steering (05 P1-06): a crafted archive cannot steer case_items.file_path or a site / building image_path
   outside its root, and the serve / delete routes refuse a bad stored path;
2. the housekeeping pass (04 F01): one failing early step no longer skips the later ones;
3. shutdown (05 P1-08): the notification monitor thread ends at once instead of waiting out its queue timeout;
4. NVR write with a failed read-back (03 F01): the accepted write is recorded and can be undone;
5. vendor event listeners (03 F02): a failed coverage-gap write never ends the Provision-ISR or Frigate loop.

Fakes only: no device, no network.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
import zipfile

import httpx
from conftest import seed_tree
from fastapi.testclient import TestClient

from smplwise.db import now_iso
from smplwise.main import create_app, janitor_tick
from smplwise.services import events_ingest, notify_sources, nvr_write, safe_paths

# the Frigate loop harness (fixtures `world` / `fake`, the fake WebSocket and the loop runner) is shared with its own suite
from test_frigate_events import FakeWs, fake, rows, run, world  # noqa: F401 - fixtures are used by name
from test_nvr_write import FakeNvr


# ---------------------------------------------------------------------------------------------- 1. restore path steering

def _canary(settings):
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    outside = settings.data_dir.parent / "outside-canary.txt"
    outside.write_text("keep me", encoding="utf-8")
    return outside


def _case_with_items(c, app, settings):
    """A case with one stored snapshot at the path the product writes (added as a note, then made a snapshot)."""
    case = c.post("/api/v1/cases", json={"title": "תיק בדיקה"}).json()
    iid = _note(c, case["id"])
    rel = f"cases/{case['id']}/{iid}.jpg"
    (settings.data_dir / rel).parent.mkdir(parents=True, exist_ok=True)
    (settings.data_dir / rel).write_bytes(b"\xff\xd8\xff\xe0good")
    with app.state.db.connection() as conn:
        conn.execute("UPDATE case_items SET kind = 'snapshot', from_at = ?, to_at = ?, file_path = ?, file_sha256 = ? WHERE id = ?", (now_iso(), now_iso(), rel, "0" * 64, iid))
    return case["id"], iid, rel


def _note(c, case_id):
    r = c.post(f"/api/v1/cases/{case_id}/items", json={"kind": "note", "note": "x"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_safe_paths_shapes_and_containment(tmp_path):
    root = tmp_path / "data"
    root.mkdir()
    assert safe_paths.case_file(root, "cases/abc123/def456.jpg") == (root / "cases/abc123/def456.jpg").resolve()
    assert safe_paths.case_file(root, "imported/" + "a" * 64 + "/clips/x.mp4") is not None
    for bad in ("../x", "cases/../../x", "/etc/passwd", str(tmp_path / "x"), "C:/x", "cases\\..\\x", "smplwise.db", "", None, 5, "cases/./a.jpg"):
        assert safe_paths.case_file(root, bad) is None, bad
    assert safe_paths.restore_path_ok(root, "sites", "image_path", "site-abc123.jpg")
    assert safe_paths.restore_path_ok(root, "buildings", "image_path", None)
    assert not safe_paths.restore_path_ok(root, "buildings", "image_path", "../../outside.txt")
    assert not safe_paths.restore_path_ok(root, "case_items", "file_path", "cases/a/../../b.jpg")
    assert not safe_paths.restore_path_ok(root, "case_items", "file_path", "cases/a/b.png"), "a shape the product never writes"


def test_a_crafted_archive_cannot_steer_case_or_picture_paths(settings, caplog):
    from smplwise.services import backup as backup_svc

    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        cid, good_iid, good_rel = _case_with_items(c, app, settings)
        with app.state.db.connection() as conn:
            conn.execute("UPDATE sites SET image_path = ? WHERE id = ?", (f"site-{ids['site']}.jpg", ids["site"]))
            good = backup_svc.create(settings, conn)
        src = backup_svc.backups_dir(settings) / good["name"]
        crafted = backup_svc.backups_dir(settings) / "crafted-paths.zip"
        outside = _canary(settings)
        evil_items = [("e1", "../outside-canary.txt"), ("e2", str(outside)), ("e3", "cases/../../outside-canary.txt"), ("e4", settings.db_path.name)]
        with zipfile.ZipFile(src) as zin, zipfile.ZipFile(crafted, "w") as zout:
            for item in zin.infolist():
                body = zin.read(item.filename)
                if item.filename == "data/case_items.json":
                    items = json.loads(body)
                    template = next(i for i in items if i["id"] == good_iid)
                    items += [dict(template, id=i, file_path=p) for i, p in evil_items]
                    body = json.dumps(items).encode("utf-8")
                if item.filename == "data/buildings.json":
                    body = json.dumps([dict(b, image_path="../../outside-canary.txt") for b in json.loads(body)]).encode("utf-8")
                zout.writestr(item, body)
        with caplog.at_level(logging.WARNING), app.state.db.connection() as conn:
            res = backup_svc.restore(settings, conn, crafted, mode="replace")
            assert res["skipped_unsafe"] == {"case_items.file_path": 4, "buildings.image_path": 1}, res["skipped_unsafe"]
            paths = {r["id"]: r["file_path"] for r in conn.execute("SELECT id, file_path FROM case_items").fetchall()}
            assert paths == {good_iid: good_rel, "e1": None, "e2": None, "e3": None, "e4": None}, "the rows are kept, only the bad references dropped"
            assert conn.execute("SELECT image_path FROM sites WHERE id = ?", (ids["site"],)).fetchone()[0] == f"site-{ids['site']}.jpg", "a good path is kept"
            assert conn.execute("SELECT image_path FROM buildings WHERE id = ?", (ids["building"],)).fetchone()[0] is None
        assert c.get(f"/api/v1/cases/{cid}/items/{good_iid}/file").status_code == 200, "the product's own path still serves"
        assert c.get(f"/api/v1/cases/{cid}/items/e1/file").status_code == 404
        assert outside.read_text(encoding="utf-8") == "keep me"


def test_serve_and_delete_routes_refuse_a_stored_path_outside_the_root(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        cid, iid, _rel = _case_with_items(c, app, settings)
        outside = _canary(settings)
        bad_iid = _note(c, cid)
        with app.state.db.connection() as conn:
            conn.execute("UPDATE case_items SET kind = 'snapshot', file_path = ? WHERE id = ?", ("../outside-canary.txt", bad_iid))
            conn.execute("UPDATE buildings SET image_path = ? WHERE id = ?", ("../../outside-canary.txt", ids["building"]))
            conn.execute("UPDATE sites SET image_path = ? WHERE id = ?", (str(outside), ids["site"]))
        assert c.get(f"/api/v1/cases/{cid}/items/{bad_iid}/file").status_code == 404
        assert c.get(f"/api/v1/catalog/images/building/{ids['building']}").status_code == 404
        assert c.get(f"/api/v1/catalog/images/site/{ids['site']}").status_code == 404
        with app.state.db.connection() as conn:  # a path inside the data dir but outside cases/ (the database itself) is refused too
            conn.execute("UPDATE case_items SET file_path = ? WHERE id = ?", (settings.db_path.name, iid))
        assert c.get(f"/api/v1/cases/{cid}/items/{iid}/file").status_code == 404
        assert c.delete(f"/api/v1/cases/{cid}/items/{bad_iid}").status_code == 204
        assert c.delete(f"/api/v1/cases/{cid}/items/{iid}").status_code == 204
        assert c.delete(f"/api/v1/buildings/{ids['building']}/image").status_code == 200
        assert c.delete(f"/api/v1/sites/{ids['site']}/image").status_code == 200
        assert outside.read_text(encoding="utf-8") == "keep me" and settings.db_path.exists()
        assert c.get("/api/v1/me").status_code == 200


# ---------------------------------------------------------------------------------------------- 2. housekeeping pass

def test_one_failing_early_janitor_step_never_skips_the_later_ones(settings, monkeypatch, caplog):
    from smplwise.services import energy_billing, push, thumbnails

    app = create_app(settings)
    with TestClient(app):
        pass
    ran: list[str] = []

    def boom(*a, **k):
        raise RuntimeError("thumbnail prune failed")

    monkeypatch.setattr(thumbnails, "prune", boom)
    monkeypatch.setattr(push, "prune", lambda db: ran.append("push"))
    monkeypatch.setattr(energy_billing, "janitor", lambda db, settings=None: ran.append("energy_billing"))
    with caplog.at_level(logging.WARNING, logger="smplwise"):
        janitor_tick(app.state.db, settings)
    assert ran == ["push", "energy_billing"], "the steps after the failing one still ran"
    assert "thumbnails prune janitor failed" in caplog.text


# ---------------------------------------------------------------------------------------------- 3. shutdown

def test_the_notification_monitor_shuts_down_at_once(settings):
    app = create_app(settings)
    with TestClient(app):
        pass
    m = notify_sources.Monitor()
    m.start(app.state.db, settings)
    time.sleep(0.15)  # the thread is now blocked in its queue wait
    t0 = time.monotonic()
    m.shutdown()
    took = time.monotonic() - t0
    assert took < 0.2, f"shutdown took {took:.2f} s"
    assert m.thread is not None and not m.thread.is_alive()
    assert notify_sources._SIGNALS.qsize() == 0, "the wake-up item is never left behind"


def test_a_wake_up_item_is_never_written(settings):
    app = create_app(settings)
    with TestClient(app):
        pass
    notify_sources._SIGNALS.put_nowait(notify_sources._WAKE)
    assert notify_sources.flush_signals(app.state.db) == 0
    assert notify_sources._SIGNALS.qsize() == 0


# ---------------------------------------------------------------------------------------------- 4. NVR write with a failed read-back

class ReadBackFails(FakeNvr):
    """The device accepts every PUT; the GET right after a PUT of the same path answers 500 (once per PUT)."""

    def __init__(self):
        super().__init__()
        self.fail_next: set[str] = set()

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if request.method == "GET" and path in self.fail_next:
            self.fail_next.discard(path)
            return httpx.Response(500, text="busy")
        r = super().handler(request)
        if request.method == "PUT" and r.status_code == 200:
            self.fail_next.add(path)
        return r


def _audit(app, action):
    with app.state.db.connection(mode="read") as conn:
        return [json.loads(r["details_json"] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def test_an_accepted_nvr_write_whose_read_back_fails_is_recorded_and_can_be_undone(settings, monkeypatch):
    fake = ReadBackFails()
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    path = "/ISAPI/Event/triggers/VMD-1"
    before_doc = fake.docs[path]
    app = create_app(settings)
    with TestClient(app) as c:
        c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"})
        r = c.put("/api/v1/nvr/notify", json={"channels": [1], "smart": False}, headers={})
        assert r.status_code == 200, r.text
        res = next(x for x in r.json()["results"] if x["type"] == "VMD")
        assert res["status"] == "failed" and res["reason"] == "source_error", "the caller still sees the read-back error"
        assert nvr_write.has_center(fake.docs[path]), "the device did change"
        changes = [x for x in c.get("/api/v1/nvr/changes").json()["changes"] if x["target"] == "VMD-1"]
        assert len(changes) == 1
        ch = changes[0]
        assert ch["status"] == "applied" and ch["error"] == "verify_failed" and ch["has_before"] and ch["has_after"]
        detail = c.get(f"/api/v1/nvr/changes/{ch['id']}").json()
        assert detail["before_xml"] == before_doc and nvr_write.has_center(detail["after_xml"])
        audits = _audit(app, "nvr.write")
        assert audits[-1]["change_id"] == ch["id"] and audits[-1]["verified"] is False
        # the undo: the device accepts the old document, its read-back fails too - still recorded as an unverified undo
        rb = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback")
        assert rb.status_code == 503, rb.text
        assert fake.docs[path] == before_doc, "the previous document went back to the device"
        assert c.get(f"/api/v1/nvr/changes/{ch['id']}").json()["status"] == "rolled_back"
        undo = [x for x in c.get("/api/v1/nvr/changes").json()["changes"] if x.get("rollback_of") == ch["id"]]
        assert len(undo) == 1 and undo[0]["status"] == "applied" and undo[0]["error"] == "verify_failed"
        rb_audit = _audit(app, "nvr.rollback")
        assert rb_audit[-1]["rollback_of"] == ch["id"] and rb_audit[-1]["verified"] is False


def test_a_verified_nvr_write_is_recorded_exactly_as_before(settings, monkeypatch):
    fake = FakeNvr()
    monkeypatch.setattr(nvr_write, "_client", fake.client)
    app = create_app(settings)
    with TestClient(app) as c:
        c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"})
        assert c.put("/api/v1/nvr/notify", json={"channels": [1], "smart": False}).status_code == 200
        ch = next(x for x in c.get("/api/v1/nvr/changes").json()["changes"] if x["target"] == "VMD-1")
        assert ch["status"] == "applied" and ch["error"] is None
        assert "verified" not in _audit(app, "nvr.write")[-1]


# ---------------------------------------------------------------------------------------------- 5. vendor event listeners

class _Listener:
    def __init__(self, db, rounds: int) -> None:
        self.settings = None
        self.recorder_id = "nvr-2"
        self.state = events_ingest.IngestState()
        self.stop = threading.Event()
        self.db = db
        self.rounds = rounds

    def submit(self, alert):
        return "queued"

    def sleep(self, s):
        self.rounds -= 1
        if self.rounds <= 0:
            self.stop.set()
        return self.stop.is_set()


class _QuietProvision:
    def event_mode(self):
        return "poll"

    def poll_events(self, tracker):
        return []


def _failing_gap(calls):
    def fail(*a, **k):
        calls.append(1)
        raise sqlite3.OperationalError("disk I/O error")
    return fail


def test_a_failing_gap_write_never_ends_the_provision_listener(settings, monkeypatch):
    from smplwise.services.recorders import provision_events

    app = create_app(settings)
    with TestClient(app):
        pass
    monkeypatch.setattr(provision_events, "_poll_interval", lambda v: 0.0)
    lst = _Listener(app.state.db, rounds=3)
    lst.settings = settings
    lst.state.disconnected_since = time.time() - 200
    lst.state.last_error = "source_unavailable"
    calls: list[int] = []
    real = events_ingest.record_gap
    monkeypatch.setattr(events_ingest, "record_gap", _failing_gap(calls))
    provision_events.run_loop(lst, adapter=_QuietProvision(), sleep=lst.sleep)  # returns normally: the thread did not die
    assert len(calls) == 3, "every round retried the gap"
    assert lst.rounds == 0 and lst.state.disconnected_since is not None
    gaps = "SELECT * FROM events WHERE type = 'coverage_gap'"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute(gaps).fetchall() == []
    monkeypatch.setattr(events_ingest, "record_gap", real)
    lst.stop.clear()
    lst.rounds = 2
    provision_events.run_loop(lst, adapter=_QuietProvision(), sleep=lst.sleep)
    with app.state.db.connection(mode="read") as conn:
        assert len(conn.execute(gaps).fetchall()) == 1, "the gap is recorded once the database answers"
    assert lst.state.disconnected_since is None and lst.state.connected is False  # the loop ended normally (stop)


def test_a_failing_gap_write_never_ends_the_frigate_listener(world, fake, monkeypatch):  # noqa: F811 - pytest fixtures
    from smplwise.services.recorders import frigate_events as fe

    lst = world["lst"]
    lst.state.disconnected_since = time.time() - 200
    lst.state.last_error = "source_unavailable"
    monkeypatch.setattr(fe, "WS_DOWN_POLL_S_DEFAULT", 0.0)
    calls: list[int] = []
    real = events_ingest.record_gap
    monkeypatch.setattr(events_ingest, "record_gap", _failing_gap(calls))
    run(world, monkeypatch, FakeWs([]), rounds=3)  # returns normally: the thread did not die
    assert calls, "the gap write was attempted"
    assert lst.state.disconnected_since is not None and rows(world["db"], "SELECT * FROM events WHERE type = 'coverage_gap'") == []
    assert len(rows(world["db"], "SELECT * FROM frigate_reviews")) == 3, "the poll itself went on"
    monkeypatch.setattr(events_ingest, "record_gap", real)
    run(world, monkeypatch, FakeWs([]), rounds=3)
    assert len(rows(world["db"], "SELECT * FROM events WHERE type = 'coverage_gap'")) == 1
    assert lst.state.disconnected_since is None and lst.state.last_error is None
