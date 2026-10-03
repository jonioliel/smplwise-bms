"""CR-020 S2 phase A - the security review fixes (2026-10-03), each pinned by a test written before the fix:

M1  the change log: a `stream_encoding` row (its documents carry the stream's transport section) is visible only to holders
    of `nvr.configure` at installation AND on the change's camera; the list is filtered by that scope, the detail refuses 403.
M2  an unknown device outcome is settled no sooner than 45 s after the change was recorded (a second write meanwhile gets 409
    `write_in_progress`), the stream PUT waits 25 s for the answer, and every unknown outcome is `retryable: false`.
L1  capability discovery: a negative result is kept 60 s, a positive one is re-read after its TTL, an applied change drops
    the stream's entry, and a cache hit makes no device call at all (no deviceInfo GET).
L2  the permission checks run before the body is parsed: an unauthorised caller with a malformed body (or a bad stream id)
    gets 403 and the device sees nothing.
L4  a `diverged` change can be undone while the stream still shows exactly what it left (same guards).
L5  when the janitor settled the row while the request was still running, the request writes no second outcome audit row.
L6  restoring an older backup drops permissions this version does not know (nvr.config.stream) from custom roles.
L3  migration 0050 leaves an audit row per custom role it stripped (see test_migrations).
API the frozen response shapes for the UI: `fields` is an object, `writable` is null in lists.
Plus the reviewer's missing tests: undo checks the permission BEFORE `confirm` with zero device calls."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind
from test_nvr_stream_write import audits, fake, put, rows, stream, streaming_hits, w, with_nvr  # noqa: F401 - fixtures

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.services import nvr_settings
from smplwise.services.recorders import hikvision
from smplwise.services.recorders.hikvision import HikvisionAdapter


def rollback(c, change_id: str, body: object = None, headers: dict | None = None):
    kwargs: dict = {"headers": headers or {}}
    if body is not None:
        kwargs["json"] = body
    return c.post(f"/api/v1/nvr/changes/{change_id}/rollback", **kwargs)


def applied(c, cid: str, ref: str = "101") -> dict:
    r = put(c, cid, ref, {"svc": False})
    assert r.status_code == 200, r.text
    return r.json()["change"]


def deny_camera(app, c, user: str, role: str, camera_id: str) -> None:
    """`user` holds `role` at installation scope with an explicit deny on one camera."""
    c.get("/api/v1/me", headers=as_user(user))
    with app.state.db.connection() as conn:
        for scope_type, scope_id, effect in (("installation", "*", "allow"), ("camera", camera_id, "deny")):
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                         "VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)", (new_id(), f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))


def recorder_role(c) -> str:
    """A custom role holding only the sensitive `nvr.record.manual` (one of the NVR permissions the change log accepts)."""
    r = c.post("/api/v1/access/roles", json={"name": "הקלטה ידנית", "description": "", "permissions": ["map.read", "video.live"], "sensitive": ["nvr.record.manual"]})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def other_change(app) -> str:
    rid = new_id()
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO nvr_changes(id, kind, permission, target, path, before_xml, after_xml, status, note, created_at) "
                     "VALUES (?, 'osd', 'nvr.config.osd', 'osd-1', '/ISAPI/x', '<a/>', '<b/>', 'applied', '', ?)", (rid, now_iso()))
    return rid


# ------------------------------------------------------------------------------------------------ M1: the change log

def test_m1_an_nvr_holder_without_nvr_configure_sees_no_stream_change(w, settings):
    app, c, fake, ids = w
    ch = applied(c, ids[1])
    osd = other_change(app)
    bind(c, with_nvr(settings), "rita", recorder_role(c), "installation", "*")
    listed = c.get("/api/v1/nvr/changes", headers=as_user("rita"))
    assert listed.status_code == 200, listed.text
    assert [x["id"] for x in listed.json()["changes"]] == [osd], "the stream change is not listed for her"
    assert c.get(f"/api/v1/nvr/changes?camera_id={ids[1]}", headers=as_user("rita")).json()["changes"] == []
    r = c.get(f"/api/v1/nvr/changes/{ch['id']}", headers=as_user("rita"))
    assert r.status_code == 403 and "before_xml" not in r.text and "StreamingChannel" not in r.text
    assert c.get(f"/api/v1/nvr/changes/{osd}", headers=as_user("rita")).status_code == 200, "other kinds keep their read path"
    denied = [a for a in audits(app, "nvr.configure") if a["decision"] == "denied" and a["actor_username"] == "rita"]
    assert denied, "the refused detail read is audited"


def test_m1_the_custom_role_with_a_camera_deny_too(w):
    app, c, fake, ids = w
    ch1 = applied(c, ids[1])
    ch3 = applied(c, ids[3], "301")
    osd = other_change(app)
    deny_camera(app, c, "rita", recorder_role(c), ids[3])
    listed = c.get("/api/v1/nvr/changes", headers=as_user("rita"))
    assert listed.status_code == 200 and [x["id"] for x in listed.json()["changes"]] == [osd]
    for ch in (ch1, ch3):
        r = c.get(f"/api/v1/nvr/changes/{ch['id']}", headers=as_user("rita"))
        assert r.status_code == 403 and "before_xml" not in r.text


def test_m1_a_system_admin_with_a_camera_deny_sees_only_the_other_cameras(w):
    app, c, fake, ids = w
    ch1 = applied(c, ids[1])
    ch2 = applied(c, ids[2], "201")
    deny_camera(app, c, "ron", "system_admin", ids[1])
    listed = [x["id"] for x in c.get("/api/v1/nvr/changes", headers=as_user("ron")).json()["changes"]]
    assert listed == [ch2["id"]]
    assert c.get(f"/api/v1/nvr/changes?camera_id={ids[1]}", headers=as_user("ron")).json()["changes"] == []
    assert c.get(f"/api/v1/nvr/changes/{ch1['id']}", headers=as_user("ron")).status_code == 403
    mine = c.get(f"/api/v1/nvr/changes/{ch2['id']}", headers=as_user("ron"))
    assert mine.status_code == 200 and "<SVC>" in mine.json()["before_xml"], "the installer still sees both documents"


# ------------------------------------------------------------------------------------------------ API shape

def test_api_fields_is_an_object_and_writable_is_null_in_lists(w):
    app, c, fake, ids = w
    detail = stream(c, ids[1], "101")
    assert detail["writable"] is True, "the detail view discovers capabilities: a boolean"
    listing = c.get("/api/v1/nvr/cameras").json()
    assert {s["writable"] for cam in listing["cameras"] for s in cam["streams"]} == {None}, "lists never carry a discovered value"
    ch = applied(c, ids[1])
    assert ch["fields"] == {"svc": [True, False]} and "fields_json" not in ch
    assert c.get("/api/v1/nvr/changes").json()["changes"][0]["fields"] == {"svc": [True, False]}
    full = c.get(f"/api/v1/nvr/changes/{ch['id']}").json()
    assert full["fields"] == {"svc": [True, False]} and "fields_json" not in full
    opts = c.get(f"/api/v1/nvr/cameras/{ids[1]}/streams/101/options").json()
    assert opts["writable"] is True


# ------------------------------------------------------------------------------------------------ M2: unknown outcomes

def shift_clock(monkeypatch, seconds: float) -> None:
    real = dt.datetime.now(dt.timezone.utc)
    monkeypatch.setattr(nvr_settings, "_utcnow", lambda: real + dt.timedelta(seconds=seconds))


def test_m2_unknown_outcome_waits_45_seconds_and_is_never_retryable(w, settings, monkeypatch):
    app, c, fake, ids = w
    fake.nvr["put"] = {"status": "timeout"}
    fake.nvr["timeout_applies"] = True
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == 503 and r.json()["code"] == "source_unavailable" and r.json()["retryable"] is False, r.text
    assert r.json()["details"]["outcome"] == "unknown"
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    fake.nvr["put"] = {"status": "ok"}
    shift_clock(monkeypatch, 44)
    again = put(c, ids[1], "101", {"svc": True})
    assert again.status_code == 409 and again.json()["code"] == "write_in_progress", "the device may still be applying the first PUT"
    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings)) == 0, "the janitor waits as well"
    assert rows(app, "SELECT status FROM nvr_changes WHERE id = ?", ch["id"])[0]["status"] == "pending"
    assert len(fake.writes) == 1
    shift_clock(monkeypatch, 46)
    r = put(c, ids[1], "101", {"svc": True})
    assert r.status_code == 200, r.text
    assert rows(app, "SELECT status FROM nvr_changes WHERE id = ?", ch["id"])[0]["status"] == "applied"
    assert len(fake.writes) == 2


def test_m2_janitor_settles_an_unknown_outcome_after_45_seconds(w, settings, monkeypatch):
    app, c, fake, ids = w
    fake.nvr["put"] = {"status": "server_error"}
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == 503 and r.json()["retryable"] is False
    shift_clock(monkeypatch, 30)
    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings)) == 0
    shift_clock(monkeypatch, 45.5)
    assert nvr_settings.settle_pending(app.state.db, with_nvr(settings)) == 1


def test_m2_the_stream_put_waits_25_seconds_for_the_answer(w):
    app, c, fake, ids = w
    seen: dict = {}
    fake.nvr["on_put"] = lambda request: seen.setdefault("timeout", request.extensions.get("timeout"))
    assert put(c, ids[1], "101", {"svc": False}).status_code == 200
    assert seen["timeout"]["read"] == 25


def test_m2_adapter_every_unknown_outcome_is_not_retryable(settings, fake):
    ad = HikvisionAdapter("nvr-1", with_nvr(settings))
    from smplwise.services import nvr

    for mode in ("timeout", "server_error"):
        fake.nvr["put"] = {"status": mode}
        snap = ad.read_stream("101")
        with pytest.raises(Exception) as e:
            ad.write_stream_encoding("101", snap.etag, nvr.stream_document(snap.element, {"svc": not snap.parsed["svc"]}), "direct")
        assert (e.value.code, e.value.details["outcome"], e.value.retryable) == ("source_unavailable", "unknown", False), mode
    # the verify read fails after an accepted PUT: unknown as well, never retryable, never a 404
    fake.nvr["put"] = {"status": "ok"}
    snap = ad.read_stream("101")
    start = fake.nvr["list_reads"]

    def break_verify(f, n):
        if n == start + 2:  # the adapter's pre-PUT read is start+1, the verify read start+2
            f.nvr["streaming_xml"] = "<StreamingChannelList/>"

    fake.nvr["on_list_read"] = break_verify
    with pytest.raises(Exception) as e:
        ad.write_stream_encoding("101", snap.etag, nvr.stream_document(snap.element, {"svc": not snap.parsed["svc"]}), "direct")
    assert (e.value.status, e.value.code, e.value.details["outcome"], e.value.retryable) == (503, "source_unavailable", "unknown", False)


# ------------------------------------------------------------------------------------------------ L1: capability cache

def caps_hits(fake) -> int:
    return len([h for h in fake.hits if h.endswith("/capabilities")])


def info_hits(fake) -> int:
    return len([h for h in fake.hits if h.endswith("/ISAPI/System/deviceInfo")])


def test_l1_negative_results_expire_after_60_seconds_and_hits_make_no_device_call(settings, fake, monkeypatch):
    ad = HikvisionAdapter("nvr-1", with_nvr(settings))
    clock = {"t": 1000.0}
    monkeypatch.setattr(hikvision, "_monotonic", lambda: clock["t"])
    fake.nvr["caps_status"] = {"direct": 404, "proxy": 403}
    assert ad.stream_options("101").writable is False
    fake.nvr["caps_status"] = {"direct": 200, "proxy": 404}
    hits, infos = len(fake.hits), info_hits(fake)
    clock["t"] += 59
    assert ad.stream_options("101").writable is False, "still the cached negative answer"
    assert len(fake.hits) == hits and info_hits(fake) == infos, "a cache hit makes no device call, not even deviceInfo"
    clock["t"] += 2
    assert ad.stream_options("101").writable is True, "after 60 s the device is asked again"


def test_l1_positive_results_refresh_after_their_ttl(settings, fake, monkeypatch):
    ad = HikvisionAdapter("nvr-1", with_nvr(settings))
    clock = {"t": 1000.0}
    monkeypatch.setattr(hikvision, "_monotonic", lambda: clock["t"])
    assert ad.stream_options("101").writable is True
    n = caps_hits(fake)
    clock["t"] += hikvision.OPTIONS_TTL_S - 1
    ad.stream_options("101")
    assert caps_hits(fake) == n
    fake.nvr["caps_status"] = {"direct": 404, "proxy": 404}
    clock["t"] += 2
    assert ad.stream_options("101").writable is False and caps_hits(fake) > n, "a positive entry is not kept forever"


def test_l1_an_applied_change_drops_the_streams_entry(w, settings):
    app, c, fake, ids = w
    ad = HikvisionAdapter("nvr-1", with_nvr(settings))
    stream(c, ids[1], "101")
    assert ad.cached_options("101") is not None
    applied(c, ids[1])
    assert ad.cached_options("101") is None, "the next detail view discovers the stream again"
    assert ad.cached_options("102") is not None, "other streams keep theirs"


# ------------------------------------------------------------------------------------------------ L2: auth before the body

@pytest.mark.parametrize("user", ["vera", "nobody"])
def test_l2_an_unauthorised_caller_with_a_malformed_body_gets_403_and_no_device_call(w, settings, user):
    app, c, fake, ids = w
    bind(c, with_nvr(settings), "vera", "viewer", "installation", "*")
    ch = applied(c, ids[1])
    hits = len(streaming_hits(fake))
    hdr = {**as_user(user), "Content-Type": "application/json"}
    for url in (f"/api/v1/nvr/cameras/{ids[1]}/streams/101", f"/api/v1/nvr/cameras/{ids[1]}/streams/abc"):
        r = c.put(url, content=b"{not json", headers=hdr)
        assert r.status_code == 403, (url, r.status_code, r.text)
    r = c.post(f"/api/v1/nvr/changes/{ch['id']}/rollback", content=b"[[[", headers=hdr)
    assert r.status_code == 403, r.text
    assert len(streaming_hits(fake)) == hits and len(fake.writes) == 1


def test_l2_an_authorised_caller_with_a_malformed_body_gets_an_audited_422(w):
    app, c, fake, ids = w
    hits = len(streaming_hits(fake))
    r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/101", content=b"{not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and r.json()["code"] == "confirm_required", r.text
    r = c.put(f"/api/v1/nvr/cameras/{ids[1]}/streams/abc", json={"confirm": True})
    assert r.status_code == 422 and r.json()["code"] == "validation"
    assert len(streaming_hits(fake)) == hits and fake.writes == []


# ------------------------------------------------------------------------------------------------ undo: permission before confirm

@pytest.mark.parametrize("body", [None, {}, {"confirm": False}, {"confirm": True}])
def test_undo_checks_the_permission_before_confirm_with_zero_device_calls(w, settings, body):
    app, c, fake, ids = w
    bind(c, with_nvr(settings), "sam", "site_admin", "installation", "*")
    ch = applied(c, ids[1])
    hits = len(streaming_hits(fake))
    r = rollback(c, ch["id"], body, as_user("sam"))
    assert r.status_code == 403, r.text
    assert len(streaming_hits(fake)) == hits and len(fake.writes) == 1
    assert not [a for a in audits(app, "nvr.rollback") if a["actor_username"] == "sam"], "no confirm_required row: the permission refused first"


# ------------------------------------------------------------------------------------------------ L4: undo of a diverged change

def diverged(c, fake, cid: str) -> dict:
    """A two-field change the device takes only half of: the verify read shows the old GOP again."""
    etag = stream(c, cid, "101")["etag"]
    start = fake.nvr["list_reads"]

    def revert_gop(f, n):
        if n == start + 3:  # the service's read, the adapter's pre-PUT read, then the verify read
            f.nvr["encodings_by_channel"][1]["main"]["gop"] = 50

    fake.nvr["on_list_read"] = revert_gop
    r = put(c, cid, "101", {"svc": False, "gop": 25}, etag)
    fake.nvr["on_list_read"] = None
    assert r.status_code == 409 and r.json()["code"] == "nvr_diverged", r.text
    return r.json()["details"]


def test_l4_a_diverged_change_can_be_undone_while_the_stream_is_as_it_left_it(w):
    app, c, fake, ids = w
    before = stream(c, ids[1], "101")
    det = diverged(c, fake, ids[1])
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    assert ch["status"] == "diverged" and det["change_id"] == ch["id"]
    r = rollback(c, ch["id"], {"confirm": True})
    assert r.status_code == 201, r.text
    assert r.json()["stream"]["etag"] == before["etag"] and r.json()["stream"]["svc"] is True and r.json()["stream"]["gop"] == 50
    assert rows(app, "SELECT status FROM nvr_changes WHERE id = ?", ch["id"])[0]["status"] == "rolled_back"
    undo = rows(app, "SELECT * FROM nvr_changes WHERE rollback_of = ?", ch["id"])[0]
    assert json.loads(undo["fields_json"]) == {"svc": [False, True]}, "only what the device really changed is reverted"
    assert len(fake.writes) == 2


def test_l4_a_diverged_change_is_not_undone_once_the_stream_moved_or_without_the_guards(w, settings):
    app, c, fake, ids = w
    diverged(c, fake, ids[1])
    [ch] = rows(app, "SELECT * FROM nvr_changes")
    bind(c, with_nvr(settings), "sam", "site_admin", "installation", "*")
    assert rollback(c, ch["id"], {"confirm": True}, as_user("sam")).status_code == 403
    assert rollback(c, ch["id"], {}).json()["code"] == "confirm_required"
    fake.nvr["encodings_by_channel"][1]["main"]["gop"] = 77
    r = rollback(c, ch["id"], {"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "stale"
    assert len(fake.writes) == 1


# ------------------------------------------------------------------------------------------------ L5: janitor vs a long request

def test_l5_a_row_the_janitor_settled_meanwhile_gets_no_second_outcome_audit(w, settings, monkeypatch):
    app, c, fake, ids = w
    real = HikvisionAdapter.write_stream_encoding
    s = with_nvr(settings)

    def write_then_janitor(self, *a, **kw):
        out = real(self, *a, **kw)
        # the janitor's pass lands after the device answered and before the request records the outcome
        assert nvr_settings.settle_pending(app.state.db, s, older_than_s=0) == 1
        return out

    monkeypatch.setattr(HikvisionAdapter, "write_stream_encoding", write_then_janitor)
    r = put(c, ids[1], "101", {"svc": False})
    assert r.status_code == 200, r.text
    assert r.json()["change"]["status"] == "applied"
    phases = [json.loads(a["details_json"])["phase"] for a in audits(app, "nvr.stream.write")]
    assert phases == ["attempt", "settle"], phases


# ------------------------------------------------------------------------------------------------ L6: restore of an older backup

def test_l6_restoring_an_old_backup_drops_unknown_permissions_from_custom_roles(w):
    app, c, fake, ids = w
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, description, permissions_json, sensitive_json, delegable, revision, created_at, updated_at) "
                     "VALUES ('r-old', 'ישן', '', ?, ?, 0, 1, 't', 't')", (json.dumps(["map.read", "nvr.config.stream"]), json.dumps(["nvr.config.osd", "nvr.config.stream"])))
    b = c.post("/api/v1/backups", json={"note": "old"})
    assert b.status_code == 201, b.text
    res = c.post(f"/api/v1/backups/{b.json()['name']}/restore", json={"mode": "replace", "scope": "project+access", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    assert res.json()["roles_pruned"] == [{"role_id": "r-old", "removed": ["nvr.config.stream"]}]
    role = next(r for r in c.get("/api/v1/access/roles").json()["roles"] if r["id"] == "r-old")
    assert "nvr.config.stream" not in role["permissions"] and set(role["permissions"]) == {"map.read", "nvr.config.osd"}
    edit = c.patch("/api/v1/access/roles/r-old", json={"name": "ישן", "description": "", "permissions": ["map.read"], "sensitive": ["nvr.config.osd"],
                                                       "delegable": False, "revision": role["revision"]})
    assert edit.status_code == 200, edit.text
    last = audits(app, "backup.restore")[-1]
    assert json.loads(last["details_json"])["roles_pruned"] == [{"role_id": "r-old", "removed": ["nvr.config.stream"]}]

