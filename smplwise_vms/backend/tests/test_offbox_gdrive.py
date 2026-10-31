"""GDRIVEBK-2310: the Google Drive transport against the fake Drive (tests/fake_gdrive.py, an httpx.MockTransport - no network):
folder find / create, multipart and resumable uploads (a failed chunk resumed, an expired session restarted), list with paging,
same-name replacement, the full off-box push with retention deletes (delete and trash) - the copy in Drive is ciphertext only -,
the quota pre-flight and Drive's own quota refusal, the token refresh (expired access token, revoked refresh token, wrong client,
no account connected), rate-limit backoff and `rate_limited` when it outlasts the retries, the device authorization grant
(start, pending, slow_down, denied, expired, connected; the scope is drive.file only), and the target configuration through the
shared `build_destination` registry."""
from __future__ import annotations

import os
import secrets
from pathlib import Path

import httpx
import pytest
from fake_gdrive import CLIENT_ID, CLIENT_SECRET, DEVICE_CODE, FOLDER_MIME, REFRESH_TOKEN, SCOPE, USER_CODE, FakeDrive

from smplwise.services import backup_offbox as ob
from smplwise.services import offbox_gdrive as og
from smplwise.services.offbox_gdrive import GRANULE, DeviceCodeFlow, GDriveDestination, RefreshTokenSource, RetryPolicy

KB = 1024


@pytest.fixture()
def drive():
    d = FakeDrive()
    yield d
    assert d.foreign == [], "a request left the fake Drive"


def _lookup(name: str) -> str | None:
    return {"gd.refresh_token": REFRESH_TOKEN, "gd.client_secret": CLIENT_SECRET}.get(name)


def _http(drive: FakeDrive) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(drive.handler))


def make(drive: FakeDrive, *, client_id: str = CLIENT_ID, lookup=_lookup, **kw) -> tuple[GDriveDestination, list[float]]:
    http = _http(drive)
    tokens = RefreshTokenSource(client_id, ob.CredentialRef("store:gd.refresh_token"), http, client_secret=ob.CredentialRef("store:gd.client_secret"),
                                secret_store=lookup)
    sleeps: list[float] = []
    opts = {"folder_name": "Arx test", "chunk_bytes": GRANULE, "simple_max_bytes": 64 * KB, "min_free_bytes": 0, "quota_margin_pct": 0,
            "retry": RetryPolicy(3, 10, 100), "sleep": sleeps.append}
    opts.update(kw)
    return GDriveDestination(tokens, http, **opts), sleeps


def blob(tmp_path: Path, name: str, size: int) -> Path:
    p = tmp_path / name
    p.write_bytes(os.urandom(size))
    return p


def test_folder_is_created_once_found_again_and_replaced_when_trashed(drive):
    d, _ = make(drive)
    fid = d.ensure_folder()
    assert d.ensure_folder() == fid
    folders = [f for f in drive.files.values() if f.mime == FOLDER_MIME]
    assert len(folders) == 1 and folders[0].name == "Arx test"
    d2, _ = make(drive)  # a new destination without the id: the app's folder of that name is found, not duplicated
    assert d2.ensure_folder() == fid
    drive.files[fid].trashed = True
    d3, _ = make(drive, folder_id=fid)
    assert d3.ensure_folder() != fid
    assert d3.describe() == {"kind": "gdrive", "folder_name": "Arx test", "folder_id": d3.folder_id, "prune_mode": "delete"}


def test_small_upload_get_list_and_markers(drive, tmp_path):
    d, _ = make(drive)
    marker = ob.new_marker_name()
    src = blob(tmp_path, "m.txt", 40)
    d.put(src, marker)
    back = tmp_path / "back"
    d.get(marker, back)
    assert back.read_bytes() == src.read_bytes()
    assert d.list() == []  # markers are never listed
    d.delete(marker)
    assert drive.by_name(marker) == []
    with pytest.raises(ob.OffboxError) as e:
        d.get(marker, back)
    assert e.value.code == "object_missing"
    assert ("POST", "/upload/drive/v3/files") in drive.calls and not drive.sessions


def test_resumable_upload_in_aligned_chunks(drive, tmp_path):
    d, _ = make(drive)
    src = blob(tmp_path, "manual-20261020-120000.zip", 3 * GRANULE + 1234)
    obj = d.put(src, "manual-20261020-120000.zip.swxb")
    assert obj.size == src.stat().st_size
    puts = [c for c in drive.calls if c == ("PUT", "/upload/drive/v3/files")]
    assert len(puts) == 4  # 3 full chunks + the tail
    back = tmp_path / "back"
    d.get(obj.name, back)
    assert back.read_bytes() == src.read_bytes()
    assert [o.name for o in d.list()] == [obj.name]


def test_a_failed_chunk_is_resumed_from_what_the_session_holds(drive, tmp_path):
    d, sleeps = make(drive, chunk_bytes=2 * GRANULE)
    drive.fail_chunk = {2}
    src = blob(tmp_path, "a.zip", 5 * GRANULE + 77)
    d.put(src, "manual-20261021-120000.zip.swxb")
    back = tmp_path / "back"
    d.get("manual-20261021-120000.zip.swxb", back)
    assert back.read_bytes() == src.read_bytes()
    assert d.resumed_chunks == 1 and sleeps  # backed off once, asked the session, went on from its offset


def test_an_expired_session_restarts_the_upload_once(drive, tmp_path):
    d, _ = make(drive)
    drive.expire_session_after_chunk = 2
    src = blob(tmp_path, "a.zip", 4 * GRANULE)
    d.put(src, "manual-20261022-120000.zip.swxb")
    back = tmp_path / "back"
    d.get("manual-20261022-120000.zip.swxb", back)
    assert back.read_bytes() == src.read_bytes()
    assert len([f for f in drive.files.values() if f.name.endswith(".swxb")]) == 1


def test_same_name_replaces_the_older_file_and_list_pages(drive, tmp_path):
    d, _ = make(drive)
    name = "manual-20261023-120000.zip.swxb"
    d.put(blob(tmp_path, "1", 100), name)
    second = blob(tmp_path, "2", 120)
    d.put(second, name)
    assert len(drive.by_name(name)) == 1
    back = tmp_path / "back"
    d.get(name, back)
    assert back.read_bytes() == second.read_bytes()
    for i in range(4):
        d.put(blob(tmp_path, f"x{i}", 10), f"daily-2026101{i}-030000.zip.swxb")
    drive.page_size = 2
    assert len(d.list()) == 5


@pytest.mark.parametrize("prune_mode", ["delete", "trash"])
def test_push_seals_uploads_verifies_and_applies_retention(drive, tmp_path, prune_mode):
    d, _ = make(drive, prune_mode=prune_mode)
    key = secrets.token_bytes(32)
    policy = ob.RetentionPolicy(keep_last=2, keep_daily=0, keep_weekly=0, keep_monthly=0)
    results = []
    for day in (20, 21, 22, 23):
        archive = blob(tmp_path, f"daily-202610{day}-030000.zip", GRANULE + 500)  # above simple_max: resumable
        results.append(ob.push(archive, d, key, policy=policy, workdir=tmp_path))
    assert all(r["ok"] and r["verified"] for r in results), results
    assert results[-1]["deleted"] == ["daily-20261021-030000.zip.swxb"]
    assert [o.name for o in d.list()] == ["daily-20261022-030000.zip.swxb", "daily-20261023-030000.zip.swxb"]
    trashed = [f.name for f in drive.files.values() if f.trashed]
    assert sorted(trashed) == (["daily-20261020-030000.zip.swxb", "daily-20261021-030000.zip.swxb"] if prune_mode == "trash" else [])
    # the copy in Drive is ciphertext, and it opens with the key into the original archive
    plain = (tmp_path / "daily-20261023-030000.zip").read_bytes()
    stored = drive.by_name("daily-20261023-030000.zip.swxb")[0].data
    assert stored.startswith(ob.MAGIC) and plain[:4096] not in stored
    sealed = tmp_path / "s.swxb"
    sealed.write_bytes(stored)
    ob.open_file(sealed, tmp_path / "plain.zip", key)
    assert (tmp_path / "plain.zip").read_bytes() == plain


def test_quota_preflight_refuses_before_any_upload_and_never_prunes(drive, tmp_path):
    d, _ = make(drive, min_free_bytes=10 * KB, quota_margin_pct=10)
    key = secrets.token_bytes(32)
    policy = ob.RetentionPolicy(keep_last=1, keep_daily=0, keep_weekly=0, keep_monthly=0)
    assert ob.push(blob(tmp_path, "daily-20261020-030000.zip", 2 * KB), d, key, policy=policy, workdir=tmp_path)["ok"]
    drive.quota_limit = drive.usage() + 12 * KB  # less than 10 KiB free after a ~3 KiB copy + 10 %
    before = dict(drive.files)
    r = ob.push(blob(tmp_path, "daily-20261021-030000.zip", 3 * KB), d, key, policy=policy, workdir=tmp_path)
    assert r["ok"] is False and r["error"] == "quota_exceeded" and r["deleted"] == [] and r["uploaded"] is False
    assert drive.files.keys() == before.keys()  # nothing uploaded, the older good copy kept


def test_drives_own_quota_refusal_maps_to_quota_exceeded(drive, tmp_path):
    d, sleeps = make(drive)
    drive.quota_limit, drive.report_limit = 10, False
    for size in (50, GRANULE + 10):  # multipart and resumable
        with pytest.raises(ob.OffboxError) as e:
            d.put(blob(tmp_path, f"b{size}", size), "daily-20261020-030000.zip.swxb")
        assert e.value.code == "quota_exceeded"
    assert sleeps == []  # a full Drive is not retried


def test_token_refresh_failures(drive, tmp_path):
    d, _ = make(drive)
    d.list()
    assert drive.refresh_calls == 1
    drive.expire_access_once = True  # a 401 refreshes once and goes on
    d.list()
    assert drive.refresh_calls == 2
    drive.revoked = True
    drive.expire_access_once = True
    with pytest.raises(ob.OffboxError) as e:
        d.list()
    assert e.value.code == "gdrive_reconnect_required" and REFRESH_TOKEN not in str(e.value)
    r = ob.check_connection(make(drive)[0], workdir=tmp_path)
    assert r["ok"] is False and r["error"] == "gdrive_reconnect_required"
    r = ob.push(blob(tmp_path, "daily-20261020-030000.zip", 100), make(drive)[0], secrets.token_bytes(32), workdir=tmp_path)
    assert r["ok"] is False and r["error"] == "gdrive_reconnect_required" and r["deleted"] == []
    drive.revoked = False
    with pytest.raises(ob.OffboxError) as e:
        make(drive, client_id="999-other.apps.googleusercontent.com")[0].list()
    assert e.value.code == "gdrive_client_invalid"
    with pytest.raises(ob.OffboxError) as e:
        make(drive, client_id="not-a-client")
    assert e.value.code == "gdrive_client_missing"
    with pytest.raises(ob.OffboxError) as e:  # no account connected yet: a clear status, not "credential missing"
        make(drive, lookup=lambda n: CLIENT_SECRET if n == "gd.client_secret" else None)[0].list()
    assert e.value.code == "gdrive_not_connected"


def test_rate_limit_backs_off_then_says_rate_limited_and_secrets_never_show(drive, tmp_path):
    d, sleeps = make(drive)
    drive.rate_limit_once = True
    assert d.list() == []
    assert len(sleeps) == 1
    drive.rate_limit_always = True
    with pytest.raises(ob.OffboxError) as e:
        d.list()
    assert e.value.code == "rate_limited" and len(sleeps) == 1 + 3  # the three retries of the policy, then the clear status
    r = ob.push(blob(tmp_path, "daily-20261020-030000.zip", 100), d, secrets.token_bytes(32), workdir=tmp_path)
    assert r["ok"] is False and r["error"] == "rate_limited" and r["deleted"] == []
    text = repr(d) + repr(d.tokens) + str(d.describe())
    assert REFRESH_TOKEN not in text and CLIENT_SECRET not in text and "ya29" not in text and "upload_id" not in text


def test_device_flow_start_and_poll_states(drive):
    flow = DeviceCodeFlow(_http(drive))
    auth = flow.start(CLIENT_ID, CLIENT_SECRET)
    assert drive.device_starts == [{"client_id": CLIENT_ID, "scope": SCOPE}]  # drive.file only, nothing broader
    assert auth.user_code == USER_CODE and auth.verification_url == "https://www.google.com/device" and auth.interval == 5
    assert DEVICE_CODE not in repr(auth)
    drive.device_script = ["pending", "slow_down", "deny"]
    assert [flow.poll(CLIENT_ID, CLIENT_SECRET, auth).state for _ in range(3)] == ["pending", "slow_down", "denied"]
    drive.device_script = ["expire"]
    assert flow.poll(CLIENT_ID, CLIENT_SECRET, auth).state == "expired"
    drive.device_script = ["approve"]
    res = flow.poll(CLIENT_ID, CLIENT_SECRET, auth)
    assert res.state == "connected" and res.refresh_token == REFRESH_TOKEN and REFRESH_TOKEN not in repr(res)
    # a grant without drive.file is refused; a wrong secret is the client's fault; a foreign client id cannot even start
    drive.device_script, drive.granted_scope = ["approve"], "openid"
    with pytest.raises(ob.OffboxError) as e:
        flow.poll(CLIENT_ID, CLIENT_SECRET, auth)
    assert e.value.code == "gdrive_scope_refused"
    with pytest.raises(ob.OffboxError) as e:
        flow.poll(CLIENT_ID, "wrong", auth)
    assert e.value.code == "gdrive_client_invalid"
    with pytest.raises(ob.OffboxError) as e:
        flow.start("999-other.apps.googleusercontent.com", CLIENT_SECRET)
    assert e.value.code == "gdrive_client_invalid"
    with pytest.raises(ob.OffboxError) as e:
        flow.start(CLIENT_ID, CLIENT_SECRET, scope="https://www.googleapis.com/auth/drive")
    assert e.value.code == "gdrive_scope_refused"


def test_device_flow_never_shows_a_foreign_link():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"device_code": "d", "user_code": "ABCD-EFGH", "verification_url": "https://evil.example/device",
                                         "expires_in": 600, "interval": 5})

    with pytest.raises(ob.OffboxError) as e:
        DeviceCodeFlow(httpx.Client(transport=httpx.MockTransport(handler))).start(CLIENT_ID, CLIENT_SECRET)
    assert e.value.code == "remote_error"


def test_the_target_kind_builds_through_the_shared_registry(drive, tmp_path):
    refs = {"client_secret": "store:offbox.t1.client_secret", "refresh_token": "store:offbox.t1.refresh_token"}
    lookup = {"offbox.t1.client_secret": CLIENT_SECRET, "offbox.t1.refresh_token": REFRESH_TOKEN}.get
    made: list[httpx.Client] = []

    def factory() -> httpx.Client:
        made.append(_http(drive))
        return made[-1]

    cfg = {"kind": "gdrive", "client_id": CLIENT_ID, "folder_name": "Arx – site A", "chunk_mib": 1, "prune_mode": "trash", **refs}
    dest = ob.build_destination(cfg, secret_store=lookup, gdrive_http=factory)
    assert isinstance(dest, GDriveDestination) and dest.chunk_bytes == 1024 * 1024 and dest.prune_mode == "trash"
    assert drive.calls == [], "building a destination sends nothing"
    r = ob.check_connection(dest, workdir=tmp_path)
    assert r["ok"] is True and r["steps"] == ["write", "read", "delete", "list"]
    dest.close()
    assert made and made[0].is_closed, "the destination closes the client it was built with"
    # the defaults, and every refusal (an unknown field never reaches the store; a credential is a reference only)
    assert og.config_values({"client_id": CLIENT_ID}) == {**og.CONFIG_DEFAULTS, "client_id": CLIENT_ID}
    for bad in ({"client_id": "abc"}, {"folder_name": "a'b"}, {"folder_name": ""}, {"chunk_mib": 0}, {"chunk_mib": 65}, {"chunk_mib": True},
                {"quota_margin_pct": 101}, {"min_free_mib": -1}, {"prune_mode": "purge"}):
        with pytest.raises(ob.OffboxError) as e:
            ob.build_destination({**cfg, **bad}, secret_store=lookup, gdrive_http=factory)
        assert e.value.code == "destination_invalid", bad
    with pytest.raises(ob.OffboxError) as e:
        ob.build_destination({**cfg, "password": "x"}, secret_store=lookup, gdrive_http=factory)
    assert e.value.code == "destination_invalid"
    with pytest.raises(ob.OffboxError) as e:
        ob.build_destination({**cfg, "refresh_token": REFRESH_TOKEN}, secret_store=lookup, gdrive_http=factory)
    assert e.value.code == "credential_ref_invalid" and REFRESH_TOKEN not in str(e.value)
    with pytest.raises(ob.OffboxError) as e:
        ob.build_destination({**cfg, "client_id": ""}, secret_store=lookup, gdrive_http=factory)
    assert e.value.code == "gdrive_client_missing"
