"""CR-020 S2C security review (2026-10-04) fixes, test-first. Each test failed on 7068b093 and passes with the fix:
1. after an UNKNOWN outcome the read-only check never takes another administrator's change for ours, and an undo restores
   only the fields OUR change modified (computed from the current device reading, never the whole before document) - in
   the batch and in the single-camera path settled by the janitor;
2. a hard wall-clock deadline per item (a slow device), and a hung runner can be abandoned by stop / recovery;
3. status, list and stop answer on a READ connection and never recover (no device read from a GET);
4. a backup neither carries nor deletes the batch keys;
6. the batch lock is keyed by the device, not by the recorder row;
7. a deeply nested JSON body is a clean audited 4xx, not a bare 500;
8. the undo-all route validates the batch id before anything is audited;
9. the stream is cut out of the device answer by a real XML parse (a forged comment cannot mislead the check);
10. an item the NVR asked to reboot for says so;
11. a deny added while the item reads the device stops it before the claim.
Fakes only; nothing touches a real device."""
from __future__ import annotations

import datetime as dt
import io
import json
import sys
import time
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from nvr_batch_helpers import (audits, batch_rows, camera_ids, details, device_svc, fast_unknown, make_app, puts, ready, rows, setup_fake, start,  # noqa: F401
                               statuses, stream, targets, wait_done, wait_put, with_nvr)

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.services import backup as backup_svc
from smplwise.services import nvr, nvr_batch, nvr_settings

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_devices import FakeDevices  # noqa: E402


@pytest.fixture()
def fake(monkeypatch) -> FakeDevices:
    f = FakeDevices()
    f.install(monkeypatch)
    setup_fake(f)
    return f


@pytest.fixture()
def bw(settings, fake, fast_unknown):
    app = make_app(settings)
    with TestClient(app) as c:
        ready(app, 5)
        yield app, c, fake, camera_ids(app)
    assert nvr_batch.wait_idle(15)


def run(c, ids, chans=(1, 2, 3)) -> dict:
    r = start(c, targets(c, ids, chans))
    assert r.status_code == 202, r.text
    return wait_done(c, r.json()["batch_id"])


def single_put(c, cid: str, ref: str, changes: dict):
    return c.put(f"/api/v1/nvr/cameras/{cid}/streams/{ref}", json={"if_match": stream(c, cid, ref)["etag"], "confirm": True, "changes": changes})


def main_of(fake, ch: int) -> dict:
    return fake._encoding(ch, "main")


def admin_changes(fake, ch: int, **values) -> None:
    """Another administrator changes the camera on the NVR's own interface."""
    with fake.lock:
        by = fake.nvr["encodings_by_channel"]
        by.setdefault(ch, {}).setdefault("main", {}).update(values)


def _binding(app, user: str, scope_type: str, scope_id: str, effect: str, role: str = "system_admin") -> None:
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at)"
                     " VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)", (new_id(), f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))


# ------------------------------------------------------------------------------------------------ 1. foreign change after UNKNOWN

def test_unknown_check_does_not_take_a_foreign_change_for_ours_and_undo_keeps_it(bw, monkeypatch):
    """The reviewer's reproduction: item 2's PUT times out and is NOT applied; meanwhile another administrator turns SVC off
    on camera 2 AND changes its bitrate. The check must not call that 'applied' (the batch stops), and no undo may put the
    old bitrate back."""
    app, c, fake, ids = bw
    fake.nvr["put_unknown_at"] = 2
    fake.nvr["timeout_applies"] = False
    real_wait = nvr_batch._wait

    def wait_while_someone_else_edits(db, bid, seconds):
        admin_changes(fake, 2, svc=False, bitrate_kbps=2048)
        return real_wait(db, bid, 0)

    monkeypatch.setattr(nvr_batch, "_wait", wait_while_someone_else_edits)
    body = run(c, ids)
    assert (body["state"], body["stopped_reason"]) == ("interrupted", "unknown_diverged"), body
    assert statuses(body) == [("applied", None), ("diverged", None), ("not_attempted", "earlier_unknown")]
    assert puts(fake) == ["101", "201"], "camera 3 is never written after a doubtful item"
    check = [details(a) for a in audits(app, "nvr.stream.batch") if details(a)["phase"] == "check"]
    assert len(check) == 1 and check[0]["continue"] is False
    settle = [details(a) for a in audits(app, "nvr.stream.write") if details(a)["phase"] == "settle"]
    assert settle[-1]["status"] == "diverged" and settle[-1]["foreign_change"] is True
    # undo-all covers only the applied item; camera 2 keeps the other administrator's bitrate
    r = c.post(f"/api/v1/nvr/stream-batches/{body['batch_id']}/rollback", json={"confirm": True})
    assert r.status_code == 202, r.text
    rb = wait_done(c, r.json()["batch_id"])
    assert rb["counts"] == {"applied": 1} and puts(fake) == ["101", "201", "101"]
    assert main_of(fake, 2)["bitrate_kbps"] == 2048
    # a single undo of the diverged item restores ONLY our field (SVC), never the whole before document
    cid = body["items"][1]["change_id"]
    u = c.post(f"/api/v1/nvr/changes/{cid}/rollback", json={"confirm": True})
    assert u.status_code == 201, u.text
    assert (main_of(fake, 2)["svc"], main_of(fake, 2)["bitrate_kbps"]) == (True, 2048), "the other administrator's bitrate survives the undo"
    assert "<vbrUpperCap>2048</vbrUpperCap>" in fake.nvr["put_bodies"][-1] and "3072" not in fake.nvr["put_bodies"][-1]


def test_single_write_settled_by_the_janitor_keeps_a_foreign_change(bw, monkeypatch, settings):
    app, c, fake, ids = bw
    fake.nvr["put"] = {"status": "timeout"}
    fake.nvr["timeout_applies"] = False
    r = single_put(c, ids[3], "301", {"svc": False})
    assert r.status_code == 503 and r.json()["details"]["outcome"] == "unknown", r.text
    fake.nvr["put"] = {"status": "ok"}
    admin_changes(fake, 3, svc=False, bitrate_kbps=2048)
    later = nvr_settings._utcnow() + dt.timedelta(seconds=nvr_settings.UNKNOWN_SETTLE_MIN_S + 1)
    monkeypatch.setattr(nvr_settings, "_utcnow", lambda: later)
    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings)) == 1
    row = rows(app, "SELECT * FROM nvr_changes WHERE stream_ref = '301' AND batch_id IS NULL")[-1]
    assert (row["status"], row["error"]) == ("diverged", "diverged"), "SVC is off, but the bitrate moved too: not ours alone"
    u = c.post(f"/api/v1/nvr/changes/{row['id']}/rollback", json={"confirm": True})
    assert u.status_code == 201, u.text
    assert (main_of(fake, 3)["svc"], main_of(fake, 3)["bitrate_kbps"]) == (True, 2048)


def test_undo_of_an_applied_change_sends_only_our_field_on_the_current_document(bw):
    """Even for a normally applied change the undo document is built from the CURRENT reading with only our field put back."""
    app, c, fake, ids = bw
    r = single_put(c, ids[4], "401", {"svc": False})
    assert r.status_code == 200, r.text
    cid = r.json()["change"]["id"]
    u = c.post(f"/api/v1/nvr/changes/{cid}/rollback", json={"confirm": True})
    assert u.status_code == 201, u.text
    current_before_undo = fake.nvr["put_bodies"][-2]  # what our write left on the device (= its verified state here)
    assert fake.nvr["put_bodies"][-1] == current_before_undo.replace("<SVC><enabled>false</enabled>", "<SVC><enabled>true</enabled>")
    assert main_of(fake, 4)["svc"] is True


# ------------------------------------------------------------------------------------------------ 2. deadline and hung runners

def test_a_slow_device_cannot_hold_an_item_past_its_deadline(bw, monkeypatch):
    app, c, fake, ids = bw
    monkeypatch.setattr(nvr_batch, "ITEM_DEADLINE_S", 0.6, raising=False)
    tg = targets(c, ids, (1, 2, 3))
    fake.nvr["drip_from"] = fake.nvr["list_reads"] + 2  # the preflight reads normally; every later LIST arrives a byte trickle at a time
    fake.nvr["drip_s"] = 0.25
    t0 = time.monotonic()
    r = start(c, tg)
    assert r.status_code == 202, r.text
    body = wait_done(c, r.json()["batch_id"], timeout=20)
    took = time.monotonic() - t0
    fake.nvr["drip_from"] = None
    assert took < 8, f"the item took {took:.1f}s although its deadline is 0.6s"
    assert (body["state"], body["stopped_reason"]) == ("interrupted", "deadline"), body
    assert statuses(body)[0] == ("refused", "source_timeout") and puts(fake) == [], "nothing was sent"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM settings WHERE key LIKE 'nvr.batch.active.%'").fetchone()[0] == 0, "the NVR is free again"


def test_stop_abandons_a_hung_item_and_frees_the_recorder(bw, monkeypatch):
    app, c, fake, ids = bw
    monkeypatch.setattr(nvr_batch, "HUNG_AFTER_S", 0.3, raising=False)
    tg = targets(c, ids, (1, 2, 3))
    etag4 = stream(c, ids[4], "401")["etag"]
    fake.nvr["put_hold_s"] = 3.0  # the PUT hangs inside the transport, beyond any deadline check
    bid = start(c, tg).json()["batch_id"]
    wait_put(fake, 1)
    time.sleep(0.5)
    s = c.post(f"/api/v1/nvr/stream-batches/{bid}/stop")
    assert s.status_code == 200, s.text
    assert (s.json()["state"], s.json()["stopped_reason"]) == ("interrupted", "deadline"), s.json()
    assert [st for st, _ in statuses(s.json())][1:] == ["not_attempted", "not_attempted"]
    single = c.put(f"/api/v1/nvr/cameras/{ids[4]}/streams/401", json={"if_match": etag4, "confirm": True, "changes": {"svc": False}})
    assert single.status_code == 200, f"the recorder is free although the abandoned PUT is still held: {single.text}"
    fake.nvr["put_hold_s"] = 0.0
    assert nvr_batch.wait_idle(15)
    after = c.get(f"/api/v1/nvr/stream-batches/{bid}").json()
    assert (after["state"], after["stopped_reason"]) == ("interrupted", "deadline"), "the late runner never rewrites the end"
    assert sorted(puts(fake)) == ["101", "401"], "never another PUT of the abandoned batch"


def test_recovery_does_not_skip_a_hung_live_runner_forever(bw, monkeypatch, settings):
    app, c, fake, ids = bw
    monkeypatch.setattr(nvr_batch, "HUNG_AFTER_S", 0.3, raising=False)
    tg = targets(c, ids, (1, 2))
    fake.nvr["put_hold_s"] = 3.0
    bid = start(c, tg).json()["batch_id"]
    wait_put(fake, 1)
    time.sleep(0.5)
    assert nvr_batch.recover_batches(app.state.db, with_nvr(settings)) == 1
    body = c.get(f"/api/v1/nvr/stream-batches/{bid}").json()
    assert (body["state"], body["stopped_reason"]) == ("interrupted", "deadline")
    fake.nvr["put_hold_s"] = 0.0
    assert nvr_batch.wait_idle(15)
    assert puts(fake) == ["101"]


# ------------------------------------------------------------------------------------------------ 3. read connection, no recovery from a GET

def _dead_batch(app, settings, ids) -> str:
    bid = new_id()
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO nvr_changes(id, kind, permission, target, path, status, note, created_at, recorder_id, camera_id, stream_ref, fields_json, etag_before, batch_id, batch_index)"
                     " VALUES (?, 'stream_encoding', 'nvr.configure', 'stream-101', '', 'queued', '', ?, 'nvr-1', ?, '101', '{}', ?, ?, 0)", (new_id(), now_iso(), ids[1], "0" * 16, bid))
        lock_key = getattr(nvr_batch, "lock_key", None)  # (before the fix the lock was the recorder id's key)
        key = lock_key(conn, with_nvr(settings), "nvr-1") if lock_key else "nvr.batch.active.nvr-1"
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (f"nvr.batch.{bid}", json.dumps({"kind": "write", "recorder_id": "nvr-1", "lock_key": key, "total": 1,
                                                                                                  "state": "running", "created_at": now_iso()})))
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (key, bid))
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (f"nvr.batch.{bid}.beat", "2026-01-01T00:00:00Z"))
    return bid


def test_status_list_and_stop_use_a_read_connection_and_never_recover(bw, monkeypatch, settings):
    from smplwise.main import janitor_tick

    app, c, fake, ids = bw
    bid = _dead_batch(app, settings, ids)
    db = app.state.db
    real = db.connection
    seen: list[tuple[str, str | None]] = []

    def spy(mode: str = "write", label: str | None = None, durable: bool = True):
        seen.append((mode, label))
        return real(mode=mode, label=label, durable=durable)

    monkeypatch.setattr(db, "connection", spy)
    def stream_reads() -> int:  # (other background tasks of the app may read other device paths meanwhile)
        return len([h for h in fake.hits if "/ISAPI/Streaming" in h])

    hits = stream_reads()
    body = c.get(f"/api/v1/nvr/stream-batches/{bid}").json()
    assert body["state"] == "running", "a GET never interrupts (the periodic maintenance does)"
    assert c.get("/api/v1/nvr/stream-batches?active=1").json()["batches"][0]["batch_id"] == bid
    assert c.get("/api/v1/nvr/stream-batches").status_code == 200
    assert stream_reads() == hits, "no device read from a status or list request"
    routes = {lbl: mode for mode, lbl in seen if lbl and lbl.startswith(("GET /api/v1/nvr/stream-batches", "POST /api/v1/nvr/stream-batches"))}
    assert routes and set(routes.values()) == {"read"}, routes
    seen.clear()
    s = c.post(f"/api/v1/nvr/stream-batches/{bid}/stop")
    assert s.status_code == 200, s.text
    assert [m for m, lbl in seen if lbl == f"POST /api/v1/nvr/stream-batches/{bid}/stop"] == ["read"], seen
    assert s.json()["state"] == "interrupted", "a batch whose runner is gone is ended by the stop itself"
    monkeypatch.setattr(db, "connection", real)
    janitor_tick(db, with_nvr(settings))
    assert fake.writes == []


def test_the_janitor_interrupts_a_dead_batch_that_nobody_watches(bw, settings):
    from smplwise.main import janitor_tick

    app, c, fake, ids = bw
    bid = _dead_batch(app, settings, ids)
    janitor_tick(app.state.db, with_nvr(settings))
    body = c.get(f"/api/v1/nvr/stream-batches/{bid}").json()
    assert (body["state"], statuses(body)) == ("interrupted", [("not_attempted", "interrupted")])


# ------------------------------------------------------------------------------------------------ 4. backups

def test_a_backup_neither_carries_nor_deletes_the_batch_keys(bw, settings):
    app, c, fake, ids = bw
    bid = _dead_batch(app, settings, ids)
    with app.state.db.connection() as conn:
        e = backup_svc.create(settings, conn, "manual")
    path = backup_svc.backups_dir(settings) / e["name"]
    with zipfile.ZipFile(path) as z:
        keys = {r["key"] for r in json.loads(z.read("data/settings.json"))}
    assert not any(k.startswith("nvr.batch.") for k in keys), "no batch record, heartbeat or lock in an archive"
    # an archive written by an older version that DID carry batch keys restores none of them
    forged = io.BytesIO()
    with zipfile.ZipFile(path) as src, zipfile.ZipFile(forged, "w") as dst:
        for n in src.namelist():
            data = src.read(n)
            if n == "data/settings.json":
                data = json.dumps(json.loads(data) + [{"key": "nvr.batch.active.ghost", "value": "f" * 16}, {"key": "nvr.batch.ffffffffffffffff", "value": "{}"}]).encode()
            dst.writestr(n, data)
    old = backup_svc.backups_dir(settings) / "manual-forged.zip"
    old.write_bytes(forged.getvalue())
    with app.state.db.connection() as conn:
        before = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings WHERE key LIKE 'nvr.batch.%'").fetchall()}
        backup_svc.restore(settings, conn, old, "replace")
        after = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM settings WHERE key LIKE 'nvr.batch.%'").fetchall()}
    assert after == before and f"nvr.batch.{bid}" in after, "a replace restore keeps the running batch's keys and adds none"


# ------------------------------------------------------------------------------------------------ 6. lock by device

def test_a_batch_blocks_single_writes_on_another_recorder_row_of_the_same_device(bw):
    """Until recorder rows carry their own connection every row is the add-on's NVR: a second row (re-discovery) is the
    SAME device and the SAME streams, so a batch on one blocks a single write through the other."""
    app, c, fake, ids = bw
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES ('nvr-2', 'again', ?)", (now_iso(),))
        conn.execute("UPDATE cameras SET recorder_id = 'nvr-2' WHERE id = ?", (ids[4],))
    tg = targets(c, ids, (1, 2))
    etag4 = stream(c, ids[4], "401")["etag"]
    fake.nvr["put_hold_s"] = 1.0
    bid = start(c, tg).json()["batch_id"]
    wait_put(fake, 1)
    single = c.put(f"/api/v1/nvr/cameras/{ids[4]}/streams/401", json={"if_match": etag4, "confirm": True, "changes": {"svc": False}})
    assert single.status_code == 409 and single.json()["code"] == "batch_in_progress", single.text
    fake.nvr["put_hold_s"] = 0.0
    assert wait_done(c, bid)["state"] == "completed"
    assert "401" not in puts(fake)


# ------------------------------------------------------------------------------------------------ 7. deep JSON

@pytest.mark.parametrize("route", ["batch", "single"])
def test_a_deeply_nested_body_is_a_clean_audited_4xx(bw, route):
    app, c, fake, ids = bw
    deep = b"[" * 200_000 + b"]" * 200_000
    hdr = {"Content-Type": "application/json"}
    if route == "batch":
        r = c.post("/api/v1/nvr/stream-batches", content=deep, headers=hdr)
        action = "nvr.stream.batch"
    else:
        r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", content=deep, headers=hdr)
        action = "nvr.stream.write"
    assert 400 <= r.status_code < 500, r.status_code
    assert [a["decision"] for a in audits(app, action)] == ["denied"], "the refusal is audited"
    assert fake.writes == []


# ------------------------------------------------------------------------------------------------ 8. undo-all id

def test_undo_all_validates_the_batch_id_before_auditing_it(bw):
    app, c, fake, ids = bw
    r = c.post("/api/v1/nvr/stream-batches/%3Csvg%20onload%3Da()%3E/rollback", json={})
    assert r.status_code == 404, r.text
    blob = json.dumps([dict(a) for a in rows(app, "SELECT * FROM audit_log")])
    assert "svg" not in blob and "onload" not in blob, "an unvalidated id never reaches the audit log"


# ------------------------------------------------------------------------------------------------ 9. real XML parse

def _list(fake, inject: str = "") -> str:
    ns = 'xmlns="http://www.hikvision.com/ver20/XMLSchema"'
    return f'<StreamingChannelList version="1.0" {ns}>{inject}' + "".join(fake._streaming_channel(ch, k) for ch in (1, 2) for k in ("main", "sub")) + "</StreamingChannelList>"


def test_slice_ignores_a_forged_element_in_a_comment_or_cdata(fake):
    real = nvr.slice_stream_element(_list(fake), "201")
    assert real is not None and "<SVC><enabled>true</enabled>" in real
    forged = fake._streaming_channel(2, "main").replace("<SVC><enabled>true</enabled>", "<SVC><enabled>false</enabled>")
    for inject in (f"<!-- {forged} -->", f"<x><![CDATA[{forged}]]></x>"):
        got = nvr.slice_stream_element(_list(fake, inject), "201")
        assert got == real, inject[:12]


def test_a_forged_comment_cannot_make_the_unknown_check_say_applied(bw):
    app, c, fake, ids = bw
    fake.nvr["put_unknown_at"] = 2
    fake.nvr["timeout_applies"] = False
    forged = fake._streaming_channel(2, "main").replace("<SVC><enabled>true</enabled>", "<SVC><enabled>false</enabled>")
    counter = fake.nvr["on_put"]

    def on_put(request) -> None:
        counter(request)
        if fake.nvr["arrived"] == 2:  # from item 2's PUT on, the answer carries a forged comment before the real element
            fake.nvr["list_inject"] = f"<!-- {forged} -->"

    fake.nvr["on_put"] = on_put
    body = run(c, ids)
    assert (body["state"], body["stopped_reason"]) == ("interrupted", "unknown_not_applied"), body
    assert puts(fake) == ["101", "201"]


# ------------------------------------------------------------------------------------------------ 10. reboot required

def test_items_say_when_the_nvr_asked_for_a_reboot(bw):
    app, c, fake, ids = bw
    fake.nvr["put"] = {"status": "reboot"}
    body = run(c, ids, (1, 2))
    assert body["state"] == "completed"
    assert [i["reboot_required"] for i in body["items"]] == [True, True] and body["reboot_required"] == 2
    fake.nvr["put"] = {"status": "ok"}
    body2 = run(c, ids, (3, 4))
    assert [i["reboot_required"] for i in body2["items"]] == [False, False] and body2["reboot_required"] == 0


# ------------------------------------------------------------------------------------------------ 11. deny before the claim

def test_a_deny_added_while_the_item_reads_the_device_stops_it_before_the_put(bw):
    app, c, fake, ids = bw
    tg = targets(c, ids, (1, 2, 3))
    state = {"base": None}
    counter = fake.nvr["on_put"]

    def on_put(request) -> None:
        counter(request)
        if fake.nvr["arrived"] == 1:
            state["base"] = fake.nvr["list_reads"]

    def on_list_read(f, n) -> None:
        # item 1: verify read (base + 1); item 2: its fresh read (base + 2) - AFTER the per-item permission check
        if state["base"] is not None and n == state["base"] + 2:
            _binding(app, "joni", "camera", ids[2], "deny")

    fake.nvr["on_put"] = on_put
    fake.nvr["on_list_read"] = on_list_read
    bid = start(c, tg).json()["batch_id"]
    body = wait_done(c, bid)
    assert (body["state"], body["stopped_reason"]) == ("failed", "forbidden"), body
    assert puts(fake) == ["101"], "the denied camera is never written"
    st = rows(app, "SELECT status, error FROM nvr_changes WHERE batch_id = ? AND batch_index = 1", bid)[0]
    assert (st["status"], st["error"]) == ("refused", "forbidden")
