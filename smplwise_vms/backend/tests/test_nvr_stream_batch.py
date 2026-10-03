"""CR-020 S2C (PLAN_C section 8, groups 1-5, 7, 9-12): the multi-camera SVC-off batch against the fake NVR - the happy path,
stop at the first failure (item k), stale between items, the unknown-outcome rule (continue only when a read PROVES the
change), the read-only preflight, stop, the recorder lock against single writes and a second batch, undo-all in reverse
order, the lock discipline, no leaks, and a large batch with paged progress. Fakes only; nothing touches a real device."""
from __future__ import annotations

import threading
import time

import pytest
from conftest import sw_time_factor
from fastapi.testclient import TestClient
from nvr_batch_helpers import (SECRETS, audits, batch_rows, camera_ids, details, device_svc, fast_unknown, make_app, puts, ready, rows, setup_fake,  # noqa: F401
                               start, statuses, stream, targets, tgt, wait_done, wait_put)

from smplwise.db import new_id, now_iso
from smplwise.services import nvr_batch, nvr_settings
from smplwise.services.recorders import hikvision

import sys
from pathlib import Path

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
    assert nvr_batch.wait_idle(10)


def run(c, ids, chans=(1, 2, 3)) -> dict:
    r = start(c, targets(c, ids, chans))
    assert r.status_code == 202, r.text
    return wait_done(c, r.json()["batch_id"])


# ------------------------------------------------------------------------------------------------ 1. happy path

def test_happy_path_three_cameras_one_at_a_time_with_audit(bw):
    app, c, fake, ids = bw
    tg = targets(c, ids, (1, 2, 3))
    r = start(c, tg)
    assert r.status_code == 202, r.text
    first = r.json()
    assert (first["kind"], first["total"], first["recorder_id"]) == ("write", 3, "nvr-1")
    assert first["state"] in ("running", "completed")
    body = wait_done(c, first["batch_id"])
    assert (body["state"], body["stopped_reason"], body["done"], body["counts"]) == ("completed", None, 3, {"applied": 3})
    assert [i["status"] for i in body["items"]] == ["applied"] * 3 and [i["index"] for i in body["items"]] == [0, 1, 2]
    assert puts(fake) == ["101", "201", "301"], "exactly three PUTs, in index order"
    assert [device_svc(fake, ch) for ch in (1, 2, 3, 4)] == [False, False, False, True]
    br = batch_rows(app, first["batch_id"])
    assert [(x["status"], x["batch_index"], x["camera_id"], x["stream_ref"], x["actor_username"]) for x in br] == \
        [("applied", i, ids[i + 1], f"{i + 1}01", "joni") for i in range(3)]
    assert all(x["etag_after"] and x["before_xml"] and x["after_xml"] for x in br)
    item_audits = [details(a) for a in audits(app, "nvr.stream.write")]
    assert [(d["phase"], d["batch_index"]) for d in item_audits] == [("attempt", 0), ("outcome", 0), ("attempt", 1), ("outcome", 1), ("attempt", 2), ("outcome", 2)]
    assert {d["batch_id"] for d in item_audits} == {first["batch_id"]}
    batch_audits = audits(app, "nvr.stream.batch")
    assert [(details(a)["phase"], a["decision"], a["actor_username"]) for a in batch_audits] == [("attempt", "allowed", "joni"), ("outcome", "allowed", "joni")], \
        "one audit row says WHO started the batch, one how it ended"
    att = details(batch_audits[0])
    assert att["targets"] == [{"camera_id": t["camera_id"], "stream_ref": t["stream_ref"]} for t in tg] and att["fields"] == ["svc"] and att["total"] == 3
    assert details(batch_audits[1])["counts"] == {"applied": 3}
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM settings WHERE key LIKE 'nvr.batch.active.%' OR key LIKE 'nvr.batch.%.beat'").fetchone()[0] == 0, "lock and heartbeat released"
    listed = c.get("/api/v1/nvr/stream-batches").json()["batches"]
    assert [b["batch_id"] for b in listed] == [first["batch_id"]] and listed[0]["started_by"] == "joni"
    assert c.get("/api/v1/nvr/stream-batches?active=1").json()["batches"] == []
    assert stream(c, ids[2], "201")["svc"] is False
    assert body["can_rollback"] is True
    assert c.get("/api/v1/nvr/cameras").json()["can_batch"] is True


# ------------------------------------------------------------------------------------------------ 2-4. stop at the first failure

@pytest.mark.parametrize("k", [0, 1, 2])
def test_failure_at_item_k_stops_the_batch(bw, k):
    app, c, fake, ids = bw
    fake.nvr["put_fail_at"] = k + 1  # the (k+1)th PUT answers busy
    body = run(c, ids)
    assert (body["state"], body["stopped_reason"]) == ("failed", "item_failed")
    expected = [("applied", None)] * k + [("refused", "nvr_busy")] + [("not_attempted", "earlier_failure")] * (2 - k)
    assert statuses(body) == expected
    assert len(puts(fake)) == k + 1, "no PUT after the failed item"
    assert [device_svc(fake, ch) for ch in (1, 2, 3)] == [False] * k + [True] * (3 - k)
    [out] = [details(a) for a in audits(app, "nvr.stream.batch") if details(a)["phase"] == "outcome"]
    assert out["state"] == "failed" and out["counts"].get("applied", 0) == k


def test_stale_between_items_stops_without_a_put(bw):
    app, c, fake, ids = bw
    tg = targets(c, ids, (1, 2, 3))

    def change_camera_2(request):
        if request.url.path.endswith("/101"):
            with fake.lock:
                fake.nvr["encodings_by_channel"].setdefault(2, {})["main"] = {"gop": 77}

    fake.nvr["on_put"] = change_camera_2
    r = start(c, tg)
    body = wait_done(c, r.json()["batch_id"])
    assert statuses(body) == [("applied", None), ("refused", "stale"), ("not_attempted", "earlier_failure")]
    assert (body["state"], body["stopped_reason"]) == ("failed", "item_refused")
    assert puts(fake) == ["101"]
    st = batch_rows(app, r.json()["batch_id"])[1]
    assert st["before_xml"] is None, "a refused item never became a change"


def test_unknown_outcome_then_a_read_proves_applied_continues(bw):
    app, c, fake, ids = bw
    fake.nvr["put_unknown_at"] = 2
    fake.nvr["timeout_applies"] = True
    body = run(c, ids)
    assert (body["state"], body["counts"]) == ("completed", {"applied": 3})
    assert puts(fake) == ["101", "201", "301"], "the unknown item is never re-sent"
    checks = [details(a) for a in audits(app, "nvr.stream.batch") if details(a)["phase"] == "check"]
    assert len(checks) == 1 and checks[0]["continue"] is True and checks[0]["status"] == "applied"
    settle = [details(a) for a in audits(app, "nvr.stream.write") if details(a)["phase"] == "settle"]
    assert len(settle) == 1, "one read-only settle of the unknown item"


def test_unknown_outcome_then_a_read_shows_not_applied_interrupts(bw):
    app, c, fake, ids = bw
    fake.nvr["put_unknown_at"] = 2
    fake.nvr["timeout_applies"] = False
    body = run(c, ids)
    assert (body["state"], body["stopped_reason"]) == ("interrupted", "unknown_not_applied")
    assert statuses(body) == [("applied", None), ("failed", "interrupted"), ("not_attempted", "earlier_unknown")]
    assert puts(fake) == ["101", "201"]
    assert body["can_rollback"] is True, "undo-all covers the applied first item"


def test_unknown_outcome_unverifiable_interrupts_and_blocks_undo_until_settled(bw, monkeypatch, settings):
    app, c, fake, ids = bw
    fake.nvr["put_unknown_at"] = 2
    fake.nvr["timeout_applies"] = True
    real_wait = nvr_batch._wait

    def wait_then_lose_the_device(db, bid, seconds):
        fake.nvr["up"] = False
        return real_wait(db, bid, 0)

    monkeypatch.setattr(nvr_batch, "_wait", wait_then_lose_the_device)
    body = run(c, ids)
    assert (body["state"], body["stopped_reason"]) == ("interrupted", "unknown_unverified")
    assert statuses(body) == [("applied", None), ("unknown", "outcome_unknown"), ("not_attempted", "earlier_unknown")]
    assert body["can_rollback"] is False
    r = c.post(f"/api/v1/nvr/stream-batches/{body['batch_id']}/rollback", json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "not_rollbackable", r.text
    assert puts(fake) == ["101", "201"]
    fake.nvr["up"] = True
    later = nvr_settings._utcnow() + __import__("datetime").timedelta(seconds=nvr_settings.UNKNOWN_SETTLE_MIN_S + 1)
    monkeypatch.setattr(nvr_settings, "_utcnow", lambda: later)
    from nvr_batch_helpers import with_nvr

    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings)) == 1, "the janitor settles it later, by a read"
    after = c.get(f"/api/v1/nvr/stream-batches/{body['batch_id']}").json()
    assert statuses(after)[1] == ("applied", None) and after["can_rollback"] is True
    assert puts(fake) == ["101", "201"], "settling never writes"


# ------------------------------------------------------------------------------------------------ 5. preflight refuses the whole request

def _no_batch_rows(app) -> bool:
    return rows(app, "SELECT id FROM nvr_changes WHERE batch_id IS NOT NULL") == []


@pytest.mark.parametrize("case,status,code", [
    ("h265", 422, "batch_target_not_allowed"), ("svc_off", 422, "batch_target_not_allowed"), ("sub", 422, "batch_target_not_allowed"),
    ("wrong_channel", 404, "not_found"), ("stale", 409, "stale"), ("unknown_camera", 404, "not_found"),
])
def test_preflight_refuses_everything_with_zero_writes(bw, case, status, code):
    app, c, fake, ids = bw
    tg = targets(c, ids, (1, 2))
    if case == "h265":
        tg.append(tgt(c, ids[5], "501"))
    elif case == "svc_off":
        fake.nvr["encodings_by_channel"][3] = {"main": {"svc": False}}
        tg.append(tgt(c, ids[3], "301"))
    elif case == "sub":
        tg.append(tgt(c, ids[3], "302"))
    elif case == "wrong_channel":
        tg.append({**tgt(c, ids[3], "301"), "camera_id": ids[4]})
    elif case == "stale":
        tg[1]["if_match"] = "0" * 16
    elif case == "unknown_camera":
        tg.append({"camera_id": "nosuchcamera", "stream_ref": "401", "if_match": "0" * 16})
    reads = fake.nvr["list_reads"]
    r = start(c, tg)
    assert r.status_code == status and r.json()["code"] == code, r.text
    if case == "stale":
        assert r.json()["details"]["index"] == 1 and r.json()["details"]["stream"]["stream_ref"] == "201"
    if case != "unknown_camera":
        assert fake.nvr["list_reads"] - reads <= 1, "ONE LIST read for the whole recorder"
    assert fake.writes == [] and _no_batch_rows(app)
    [a] = audits(app, "nvr.stream.batch")
    assert (a["decision"], a["reason"]) == ("denied", code)


@pytest.mark.parametrize("mutate,code", [
    (lambda b: b["targets"].pop(), "validation"),                                       # one target is the single route
    (lambda b: b["targets"].append(dict(b["targets"][0])), "validation"),               # duplicate
    (lambda b: b.update(changes={"svc": True}), "batch_field_not_allowed"),
    (lambda b: b.update(changes={"svc": False, "gop": 50}), "batch_field_not_allowed"),
    (lambda b: b.update(changes={"svc": "false"}), "batch_field_not_allowed"),
    (lambda b: b.update(extra=1), "validation"),
    (lambda b: b["targets"][0].update(stream_ref="1x1"), "validation"),
    (lambda b: b["targets"][0].update(if_match="ABC"), "validation"),
    (lambda b: b.update(targets="all"), "validation"),
    (lambda b: b.update(recorder_id="nvr-9"), "validation"),
])
def test_body_shape(bw, mutate, code):
    app, c, fake, ids = bw
    body = {"confirm": True, "changes": {"svc": False}, "targets": targets(c, ids, (1, 2))}
    mutate(body)
    reads = fake.nvr["list_reads"]
    r = c.post("/api/v1/nvr/stream-batches", json=body)
    assert r.status_code == 422 and r.json()["code"] == code, r.text
    assert fake.writes == [] and _no_batch_rows(app)
    if code != "validation" or "recorder_id" not in body:
        assert fake.nvr["list_reads"] == reads, "a malformed body never reaches the device"


def test_targets_on_two_recorders_are_refused(bw):
    app, c, fake, ids = bw
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO recorders(id, name, created_at) VALUES ('nvr-2', 'שני', ?)", (now_iso(),))
        cam2 = new_id()
        conn.execute("INSERT INTO cameras(id, recorder_id, channel, created_at, updated_at) VALUES (?, 'nvr-2', 1, ?, ?)", (cam2, now_iso(), now_iso()))
    tg = targets(c, ids, (1,)) + [{"camera_id": cam2, "stream_ref": "201", "if_match": "0" * 16}]
    r = start(c, tg)
    assert r.status_code == 422 and r.json()["code"] == "validation", r.text
    assert fake.writes == [] and _no_batch_rows(app)


# ------------------------------------------------------------------------------------------------ 7. stop

def test_stop_lets_the_current_camera_finish_and_skips_the_rest(bw):
    app, c, fake, ids = bw
    fake.nvr["put_hold_s"] = 1.0
    r = start(c, targets(c, ids, (1, 2, 3, 4)))
    bid = r.json()["batch_id"]
    wait_put(fake, 1)
    s1 = c.post(f"/api/v1/nvr/stream-batches/{bid}/stop")
    assert s1.status_code == 200, s1.text
    s2 = c.post(f"/api/v1/nvr/stream-batches/{bid}/stop")
    assert s2.status_code == 200, "stop is idempotent"
    body = wait_done(c, bid)
    assert (body["state"], body["stopped_reason"]) == ("stopped", "user_stop")
    assert statuses(body) == [("applied", None)] + [("not_attempted", "stopped")] * 3, "the item in flight is never interrupted"
    assert puts(fake) == ["101"]
    stops = [a for a in audits(app, "nvr.stream.batch") if details(a)["phase"] == "stop"]
    assert len(stops) == 1 and stops[0]["actor_username"] == "joni" and details(stops[0])["not_attempted"] == 3
    assert c.post(f"/api/v1/nvr/stream-batches/{bid}/stop").json()["state"] == "stopped"
    assert c.post("/api/v1/nvr/stream-batches/0123456789abcdef/stop").status_code == 404


def test_stop_racing_the_claim_never_sends_a_put(bw, monkeypatch):
    """A stop that lands after the runner picked the next item but before it claimed the placeholder: no PUT for it."""
    app, c, fake, ids = bw
    real_read = hikvision.HikvisionAdapter.read_stream
    state = {"bid": None, "done": False}

    def read_then_stop(self, ref):
        snap = real_read(self, ref)
        if ref == "201" and not state["done"]:
            state["done"] = True
            with app.state.db.connection() as conn:
                conn.execute("UPDATE nvr_changes SET status = 'not_attempted', error = 'stopped' WHERE batch_id = ? AND status = 'queued'", (state["bid"],))
        return snap

    monkeypatch.setattr(hikvision.HikvisionAdapter, "read_stream", read_then_stop)
    tg = targets(c, ids, (1, 2, 3))
    fake.nvr["put_hold_s"] = 0.3
    r = start(c, tg)
    state["bid"] = r.json()["batch_id"]
    body = wait_done(c, state["bid"])
    assert puts(fake) == ["101"], "the claim lost to the stop: camera 2 got no PUT"
    assert body["state"] == "stopped" and statuses(body)[1:] == [("not_attempted", "stopped")] * 2


# ------------------------------------------------------------------------------------------------ 9. one batch per recorder; single writes refused

def test_single_write_and_second_batch_are_refused_while_a_batch_runs(bw):
    app, c, fake, ids = bw
    etag4 = stream(c, ids[4], "401")["etag"]
    applied = c.put(f"/api/v1/nvr/cameras/{ids[4]}/streams/402", json={"if_match": stream(c, ids[4], "402")["etag"], "confirm": True, "changes": {"fps": 15}})
    assert applied.status_code == 200, applied.text
    single_id = applied.json()["change"]["id"]
    tg = targets(c, ids, (1, 2))
    fake.nvr["put_hold_s"] = 1.0
    r = start(c, tg)
    bid = r.json()["batch_id"]
    wait_put(fake, 2)  # the batch's first PUT (the single write above was PUT #1)
    single = c.put(f"/api/v1/nvr/cameras/{ids[4]}/streams/401", json={"if_match": etag4, "confirm": True, "changes": {"svc": False}})
    assert single.status_code == 409 and single.json()["code"] == "batch_in_progress" and single.json()["user_message"] == "מתבצע שינוי מרובה.", single.text
    undo = c.post(f"/api/v1/nvr/changes/{single_id}/rollback", json={"confirm": True})
    assert undo.status_code == 409 and undo.json()["code"] == "batch_in_progress", "a single undo of another change is refused too"
    second = start(c, targets(c, ids, (3, 4)))
    assert second.status_code == 409 and second.json()["code"] == "batch_in_progress", second.text
    active = c.get("/api/v1/nvr/stream-batches?active=1").json()["batches"]
    assert [b["batch_id"] for b in active] == [bid] and active[0]["state"] == "running"
    body = wait_done(c, bid)
    assert body["state"] == "completed"
    assert puts(fake) == ["402", "101", "201"], "nothing else reached the device"
    fake.nvr["put_hold_s"] = 0.0
    assert c.put(f"/api/v1/nvr/cameras/{ids[4]}/streams/401", json={"if_match": stream(c, ids[4], "401")["etag"], "confirm": True, "changes": {"svc": False}}).status_code == 200


def test_parallel_creates_one_wins(bw):
    app, c, fake, ids = bw
    a, b = targets(c, ids, (1, 2)), targets(c, ids, (3, 4))
    fake.nvr["put_hold_s"] = 0.5
    barrier = threading.Barrier(2)
    out: list = []

    def go(tg):
        barrier.wait()
        out.append(start(c, tg))

    ts = [threading.Thread(target=go, args=(t,)) for t in (a, b)]
    for t in ts:
        t.start()
    for t in ts:
        t.join(30)
    codes = sorted(r.status_code for r in out)
    assert codes == [202, 409], [r.text for r in out]
    lost = next(r for r in out if r.status_code == 409)
    assert lost.json()["code"] == "batch_in_progress"
    wait_done(c, next(r for r in out if r.status_code == 202).json()["batch_id"])
    assert len(puts(fake)) == 2


def test_a_batch_on_another_recorder_does_not_block_this_one(bw):
    app, c, fake, ids = bw
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('nvr.batch.active.nvr-2', ?)", (new_id(),))
        conn.execute("INSERT INTO settings(key, value) VALUES (?, ?)", (f"nvr.batch.{'f' * 16}.beat", now_iso()))
    body = run(c, ids, (1, 2))
    assert body["state"] == "completed"
    assert c.put(f"/api/v1/nvr/cameras/{ids[3]}/streams/301", json={"if_match": stream(c, ids[3], "301")["etag"], "confirm": True, "changes": {"svc": False}}).status_code == 200


# ------------------------------------------------------------------------------------------------ 10. lock discipline

def test_write_lock_is_free_while_a_batch_item_put_is_held(bw):
    app, c, fake, ids = bw
    fake.nvr["put_hold_s"] = 2.0
    r = start(c, targets(c, ids, (1, 2)))
    wait_put(fake, 1)
    time.sleep(0.1)
    t0 = time.monotonic()
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('test.parallel', '1') ON CONFLICT(key) DO UPDATE SET value = '2'")
    took = time.monotonic() - t0
    assert took < 1.0 * sw_time_factor(), f"a parallel write waited {took:.2f}s behind the batch"
    fake.nvr["put_hold_s"] = 0.0
    assert wait_done(c, r.json()["batch_id"])["state"] == "completed"


def test_no_sqlite_access_inside_the_unlocked_device_call(bw, monkeypatch):
    """Every `with unlocked(conn):` block of the batch path (preflight, item reads, the PUT, the unknown check) runs with an
    authorizer that denies ANY statement on that connection: the batch still completes, so none touches SQLite there."""
    import sqlite3
    from contextlib import contextmanager

    from smplwise import db as dbmod

    app, c, fake, ids = bw
    entered = {"n": 0}

    @contextmanager
    def guarded(conn):
        with dbmod.unlocked(conn):
            entered["n"] += 1
            conn.set_authorizer(lambda *a: sqlite3.SQLITE_DENY)
            try:
                yield
            finally:
                conn.set_authorizer(None)

    monkeypatch.setattr(nvr_settings, "unlocked", guarded)
    monkeypatch.setattr(nvr_batch, "unlocked", guarded)
    fake.nvr["put_unknown_at"] = 2
    fake.nvr["timeout_applies"] = True
    body = run(c, ids, (1, 2, 3))
    assert body["state"] == "completed", body
    assert entered["n"] >= 1 + 3 * 2, "preflight + per item (read, PUT) + the unknown check all went through the guard"


# ------------------------------------------------------------------------------------------------ 11. undo-all

def test_undo_all_reverse_order_one_confirm(bw):
    app, c, fake, ids = bw
    src = run(c, ids)
    r = c.post(f"/api/v1/nvr/stream-batches/{src['batch_id']}/rollback", json={"confirm": True})
    assert r.status_code == 202, r.text
    rb = wait_done(c, r.json()["batch_id"])
    assert (rb["kind"], rb["state"], rb["source_batch_id"], rb["counts"]) == ("rollback", "completed", src["batch_id"], {"applied": 3})
    assert [i["stream_ref"] for i in rb["items"]] == ["301", "201", "101"]
    assert puts(fake) == ["101", "201", "301", "301", "201", "101"], "reverse order"
    assert [device_svc(fake, ch) for ch in (1, 2, 3)] == [True, True, True]
    again = c.get(f"/api/v1/nvr/stream-batches/{src['batch_id']}").json()
    assert [i["status"] for i in again["items"]] == ["rolled_back"] * 3 and again["can_rollback"] is False
    rb_audits = audits(app, "nvr.stream.batch.rollback")
    assert [details(a)["phase"] for a in rb_audits] == ["attempt", "outcome"] and rb_audits[0]["actor_username"] == "joni"
    item = [details(a) for a in audits(app, "nvr.rollback")]
    assert len(item) == 6 and all(d["batch_id"] == r.json()["batch_id"] and d["rollback_of"] for d in item)
    twice = c.post(f"/api/v1/nvr/stream-batches/{src['batch_id']}/rollback", json={"confirm": True})
    assert twice.status_code == 409 and twice.json()["code"] == "not_rollbackable"


@pytest.mark.parametrize("confirm", [None, False, "true", 1])
def test_undo_all_needs_the_literal_confirm(bw, confirm):
    app, c, fake, ids = bw
    src = run(c, ids, (1, 2))
    body = {} if confirm is None else {"confirm": confirm}
    r = c.post(f"/api/v1/nvr/stream-batches/{src['batch_id']}/rollback", json=body)
    assert r.status_code == 422 and r.json()["code"] == "confirm_required"
    assert len(puts(fake)) == 2


def test_undo_all_failure_at_k_leaves_the_rest_applied_and_skips_not_applied(bw):
    app, c, fake, ids = bw
    fake.nvr["put_fail_at"] = 4  # the 4th PUT (camera 4) fails: cameras 1-3 applied
    src = run(c, ids, (1, 2, 3, 4))
    assert [i["status"] for i in src["items"]] == ["applied", "applied", "applied", "refused"]
    fake.nvr["put_fail_at"] = 6  # rollback PUTs: #5 = 301, #6 = 201 (busy)
    r = c.post(f"/api/v1/nvr/stream-batches/{src['batch_id']}/rollback", json={"confirm": True})
    rb = wait_done(c, r.json()["batch_id"])
    assert [i["stream_ref"] for i in rb["items"]] == ["301", "201", "101"], "only applied items, reverse order; camera 4 skipped"
    assert statuses(rb) == [("applied", None), ("refused", "nvr_busy"), ("not_attempted", "earlier_failure")]
    assert rb["state"] == "failed"
    assert [device_svc(fake, ch) for ch in (1, 2, 3)] == [False, False, True]
    src2 = c.get(f"/api/v1/nvr/stream-batches/{src['batch_id']}").json()
    assert [i["status"] for i in src2["items"]] == ["applied", "applied", "rolled_back", "refused"]
    assert src2["can_rollback"] is True, "a new undo request (new confirm) may try the rest"


def test_undo_all_stale_item_stops(bw):
    app, c, fake, ids = bw
    src = run(c, ids, (1, 2))
    fake.nvr["encodings_by_channel"].setdefault(2, {})["main"] = {**fake.nvr["encodings_by_channel"][2]["main"], "gop": 33}
    r = c.post(f"/api/v1/nvr/stream-batches/{src['batch_id']}/rollback", json={"confirm": True})
    rb = wait_done(c, r.json()["batch_id"])
    assert statuses(rb) == [("refused", "stale"), ("not_attempted", "earlier_failure")]
    assert puts(fake) == ["101", "201"]


def test_single_item_undo_of_a_batch_row_works_and_undo_all_skips_it(bw):
    app, c, fake, ids = bw
    src = run(c, ids, (1, 2))
    first = src["items"][0]["change_id"]
    u = c.post(f"/api/v1/nvr/changes/{first}/rollback", json={"confirm": True})
    assert u.status_code == 201, u.text
    r = c.post(f"/api/v1/nvr/stream-batches/{src['batch_id']}/rollback", json={"confirm": True})
    rb = wait_done(c, r.json()["batch_id"])
    assert [i["stream_ref"] for i in rb["items"]] == ["201"] and rb["state"] == "completed"
    placeholder = c.get(f"/api/v1/nvr/changes/{first}").json()
    assert placeholder["status"] == "rolled_back"


def test_queued_or_not_attempted_rows_cannot_be_undone_singly(bw):
    app, c, fake, ids = bw
    fake.nvr["put_fail_at"] = 1
    src = run(c, ids, (1, 2))
    na = src["items"][1]["change_id"]
    r = c.post(f"/api/v1/nvr/changes/{na}/rollback", json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "not_rollbackable"
    assert len(puts(fake)) == 1


# ------------------------------------------------------------------------------------------------ 12. leaks

def test_no_address_or_credential_anywhere_and_no_collateral(bw):
    app, c, fake, ids = bw
    r = start(c, targets(c, ids, (1, 2)))
    body = wait_done(c, r.json()["batch_id"])
    undo = c.post(f"/api/v1/nvr/stream-batches/{body['batch_id']}/rollback", json={"confirm": True})
    wait_done(c, undo.json()["batch_id"])
    texts = [r.text, c.get(f"/api/v1/nvr/stream-batches/{body['batch_id']}").text, c.get("/api/v1/nvr/stream-batches").text, undo.text]
    texts += [str(a) for a in rows(app, "SELECT * FROM audit_log WHERE action LIKE 'nvr.%'")]
    texts += [str(x.get("fields_json")) for x in rows(app, "SELECT fields_json FROM nvr_changes")]
    texts += [str(x) for x in rows(app, "SELECT key, value FROM settings WHERE key LIKE 'nvr.batch.%'")]
    for t in texts:
        for s in SECRETS:
            assert s not in t, s
    assert not [w for w in fake.writes if not w.startswith("nvr PUT /ISAPI/Streaming/channels/")], "only stream PUTs, no go2rtc, no reboot"
    assert not [h for h in fake.hits if "reboot" in h.lower()]


# ------------------------------------------------------------------------------------------------ large batch, bounded

def test_large_batch_runs_with_paged_progress(settings, monkeypatch, fast_unknown):
    f = FakeDevices()
    f.install(monkeypatch)
    # hundreds of cameras (owner: no cap); one item in memory at a time, progress paged. 128 channels = the S1 reader's own
    # ceiling (nvr.MAX_STREAMING_ELEMENTS = 256 stream elements per LIST document, main + sub per channel)
    n = 128
    setup_fake(f, channels=n)
    f.nvr["encodings_by_channel"] = {}
    app = make_app(settings)
    with TestClient(app) as c:
        ready(app, n)
        ids = camera_ids(app)
        detail = c.get("/api/v1/nvr/cameras").json()["cameras"]
        tg = [{"camera_id": cam["camera_id"], "stream_ref": s["stream_ref"], "if_match": s["etag"]} for cam in detail for s in cam["streams"] if s["role"] == "main"]
        assert len(tg) == n
        r = start(c, tg)
        assert r.status_code == 202, r.text
        assert len(r.json()["items"]) <= nvr_batch.PAGE_DEFAULT
        body = wait_done(c, r.json()["batch_id"], timeout=240)
        assert body["state"] == "completed" and body["counts"] == {"applied": n}
        page = c.get(f"/api/v1/nvr/stream-batches/{body['batch_id']}?offset=10&limit=20").json()
        assert [i["index"] for i in page["items"]] == list(range(10, 30)) and page["next_offset"] == 30 and page["total"] == n
        last = c.get(f"/api/v1/nvr/stream-batches/{body['batch_id']}?offset={n - 5}&limit=20").json()
        assert len(last["items"]) == 5 and last["next_offset"] is None
        assert c.get(f"/api/v1/nvr/stream-batches/{body['batch_id']}?limit=501").status_code == 422, "a page is bounded"
        assert len(puts(f)) == n and len(set(puts(f))) == n
        assert ids
    assert nvr_batch.wait_idle(10)
