"""DATASTORE-295 part 2: off-box backup copies - the SWXB encryption (round trip, wrong key, truncation, reordering, appended data,
header edits), the key held in a file outside the database, the destinations (local path, fake; SFTP and S3 adapters against fake
clients, their real transport absent), retention, dry run, verify-after-upload and the rule that credentials are references
that never reach a repr, a describe(), a result or a log line."""
from __future__ import annotations

import io
import json
import logging
import os
import struct
import types
from pathlib import Path

import pytest

from smplwise.services import backup_offbox as ob

SECRET = "PLANTED-S3-SECRET-4f1c"
HOST_KEY_LINE = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK0p8t6eH0vFakeHostKeyForTestsOnly0000000000"


def _archive(tmp_path: Path, name: str = "manual-20261020-120000.zip", size: int = 3 * 1024 * 1024 + 17) -> Path:
    p = tmp_path / "src" / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(os.urandom(size))
    return p


def _key(tmp_path: Path) -> bytes:
    return ob.load_or_create_key(tmp_path / "keys" / ob.KEY_FILE)


# ---------------------------------------------------------------- encryption


@pytest.mark.parametrize("size", [0, 1, 1024, ob.CHUNK, ob.CHUNK + 1, 2 * ob.CHUNK])
def test_seal_and_open_round_trip(tmp_path, size):
    src = _archive(tmp_path, size=size)
    key = _key(tmp_path)
    info = ob.seal_file(src, tmp_path / "x.swxb", key)
    assert info["plain_bytes"] == size and info["key_id"] == ob.key_id(key)
    raw = (tmp_path / "x.swxb").read_bytes()
    if size >= 64:
        assert src.read_bytes()[:64] not in raw, "the archive bytes never appear in the clear"
    out = ob.open_file(tmp_path / "x.swxb", tmp_path / "back.zip", key)
    assert (tmp_path / "back.zip").read_bytes() == src.read_bytes() and out["plain_sha256"] == info["plain_sha256"]


def _records(raw: bytes) -> tuple[bytes, list[bytes]]:
    n = struct.unpack(">I", raw[5:9])[0]
    head, rest, recs = raw[: 9 + n], raw[9 + n:], []
    while rest:
        ln = struct.unpack(">I", rest[:4])[0]
        recs.append(rest[: 4 + ln])
        rest = rest[4 + ln:]
    return head, recs


def test_every_tampering_is_refused_and_leaves_no_output(tmp_path):
    src = _archive(tmp_path, size=3 * 4096)
    key = _key(tmp_path)
    ob.seal_file(src, tmp_path / "x.swxb", key, chunk=4096)
    raw = (tmp_path / "x.swxb").read_bytes()
    head, recs = _records(raw)
    assert len(recs) == 3
    cases = {
        "truncated_at_record": head + recs[0] + recs[1],          # the final record is gone
        "truncated_inside": raw[:-5],
        "reordered": head + recs[1] + recs[0] + recs[2],
        "appended": raw + recs[2],
        "flipped": raw[:-20] + bytes([raw[-20] ^ 1]) + raw[-19:],
        "header_edit": raw.replace(b'"chunk": 4096', b'"chunk": 4097'),
    }
    for label, blob in cases.items():
        bad = tmp_path / f"{label}.swxb"
        bad.write_bytes(blob)
        with pytest.raises(ob.OffboxError) as e:
            ob.open_file(bad, tmp_path / f"{label}.out", key)
        assert e.value.code in ("sealed_damaged", "sealed_invalid"), label
        assert not (tmp_path / f"{label}.out").exists(), label
    other = ob.load_or_create_key(tmp_path / "other.key")
    with pytest.raises(ob.OffboxError) as e:
        ob.open_file(tmp_path / "x.swxb", tmp_path / "o.out", other)
    assert e.value.code == "key_mismatch"


def test_the_key_lives_in_a_file_of_its_own(tmp_path):
    p = ob.default_key_path(tmp_path / "data")
    assert p == tmp_path / "data" / "keys" / ob.KEY_FILE, "keys/ never enters a project archive (backup._rel)"
    k = ob.load_or_create_key(p)
    assert len(k) == 32 and ob.load_or_create_key(p) == k
    if os.name == "posix":
        assert (p.stat().st_mode & 0o777) == 0o600
    with pytest.raises(ob.OffboxError):
        ob.load_or_create_key(tmp_path / "none.key", create=False)
    (tmp_path / "bad.key").write_text("not base64 !!")
    with pytest.raises(ob.OffboxError) as e:
        ob.load_or_create_key(tmp_path / "bad.key")
    assert e.value.code == "key_invalid"


# ---------------------------------------------------------------- retention


def test_retention_keeps_last_daily_weekly_monthly_and_never_touches_foreign_names():
    names = [f"auto-daily-202610{d:02d}-030000.zip.swxb" for d in range(1, 21)]
    names += [f"auto-daily-2026{m:02d}15-030000.zip.swxb" for m in range(1, 10)]
    names += ["someone-elses-file.zip.swxb", "notes.txt"]
    plan = ob.RetentionPolicy(keep_last=2, keep_daily=5, keep_weekly=3, keep_monthly=4).plan(names)
    keep = set(plan["keep"])
    assert {"auto-daily-20261020-030000.zip.swxb", "auto-daily-20261019-030000.zip.swxb"} <= keep
    assert {f"auto-daily-202610{d:02d}-030000.zip.swxb" for d in range(16, 21)} <= keep  # 5 daily
    assert "auto-daily-20260915-030000.zip.swxb" in keep and "auto-daily-20260815-030000.zip.swxb" in keep  # monthly
    assert "auto-daily-20260115-030000.zip.swxb" in plan["delete"]
    assert plan["unmanaged"] == ["notes.txt", "someone-elses-file.zip.swxb"]
    assert set(plan["delete"]).isdisjoint(plan["unmanaged"]) and set(plan["delete"]).isdisjoint(keep)
    with pytest.raises(ob.OffboxError):
        ob.RetentionPolicy(keep_last=0)


# ---------------------------------------------------------------- push: dry run, verify, prune


def test_push_to_the_fake_destination_verifies_then_prunes(tmp_path):
    key = _key(tmp_path)
    dest = ob.FakeDestination()
    policy = ob.RetentionPolicy(keep_last=2, keep_daily=0, keep_weekly=0, keep_monthly=0)
    results = []
    for i, stamp in enumerate(("20261018-030000", "20261019-030000", "20261020-030000")):
        results.append(ob.push(_archive(tmp_path, f"auto-daily-{stamp}.zip", size=5000 + i), dest, key, policy=policy))
    assert all(r["ok"] and r["verified"] for r in results), results
    assert sorted(dest.objects) == ["auto-daily-20261019-030000.zip.swxb", "auto-daily-20261020-030000.zip.swxb"]
    assert results[-1]["deleted"] == ["auto-daily-20261018-030000.zip.swxb"]
    assert set(results[-1]["timings_ms"]) >= {"list", "seal", "upload", "verify", "prune", "total"}
    # what is stored decrypts to the archive
    blob = tmp_path / "blob.swxb"
    dest.get("auto-daily-20261020-030000.zip.swxb", blob)
    ob.open_file(blob, tmp_path / "back.zip", key)
    assert (tmp_path / "back.zip").read_bytes() == (tmp_path / "src" / "auto-daily-20261020-030000.zip").read_bytes()


def test_dry_run_writes_nothing(tmp_path):
    key = _key(tmp_path)
    dest = ob.FakeDestination()
    dest.objects["auto-daily-20250101-030000.zip.swxb"] = b"old"
    r = ob.push(_archive(tmp_path), dest, key, policy=ob.RetentionPolicy(keep_last=1, keep_daily=0, keep_weekly=0, keep_monthly=0), dry_run=True)
    assert r["ok"] and r["dry_run"] and not r["uploaded"]
    assert r["plan"]["upload"]["name"] == "manual-20261020-120000.zip.swxb" and r["plan"]["delete"] == ["auto-daily-20250101-030000.zip.swxb"]
    assert [c[0] for c in dest.calls] == ["list"] and list(dest.objects) == ["auto-daily-20250101-030000.zip.swxb"]


@pytest.mark.parametrize("knob,code", [("corrupt_put", "verify_hash_mismatch"), ("truncate_put", "verify_hash_mismatch"),
                                       ("fail_put", "destination_unavailable"), ("fail_get", "destination_unavailable"),
                                       ("fail_list", "destination_unavailable")])
def test_a_copy_that_does_not_verify_is_removed_and_nothing_old_is_pruned(tmp_path, knob, code):
    key = _key(tmp_path)
    dest = ob.FakeDestination()
    dest.objects["auto-daily-20250101-030000.zip.swxb"] = b"old good copy"
    setattr(dest, knob, True)
    r = ob.push(_archive(tmp_path), dest, key, policy=ob.RetentionPolicy(keep_last=1, keep_daily=0, keep_weekly=0, keep_monthly=0))
    assert not r["ok"] and r["error"] == code and not r["verified"] and r["deleted"] == []
    assert dest.objects.get("auto-daily-20250101-030000.zip.swxb") == b"old good copy"
    assert "manual-20261020-120000.zip.swxb" not in dest.objects


def test_deep_verify_catches_a_destination_that_returns_another_valid_file(tmp_path):
    """The hash check compares what came back with what was sent; the deep check also proves it decrypts to THIS archive."""
    key = _key(tmp_path)
    archive = _archive(tmp_path)

    class Swapping(ob.FakeDestination):
        def get(self, name, dest):  # answers with a correctly sealed copy of something else
            other = _archive(tmp_path / "o", "manual-20261020-120000.zip", size=99)
            info = ob.seal_file(other, Path(dest), key)
            self.sent_sha = info["sealed_sha256"]

    d = Swapping()
    r = ob.push(archive, d, key, verify="deep")
    assert not r["ok"] and r["error"] == "verify_hash_mismatch"
    with pytest.raises(ob.OffboxError):
        ob.push(archive, d, key, verify="none")


def test_local_path_destination(tmp_path):
    key = _key(tmp_path)
    share = tmp_path / "share"
    share.mkdir()
    d = ob.LocalPathDestination(share, data_dir=tmp_path / "data")
    r = ob.push(_archive(tmp_path), d, key)
    assert r["ok"], r
    assert [o.name for o in d.list()] == ["manual-20261020-120000.zip.swxb"]
    assert not list(share.glob(".*.partial")), "no temporary file is left"
    (share / "unrelated.txt").write_text("x")
    assert [o.name for o in d.list()] == ["manual-20261020-120000.zip.swxb"]
    with pytest.raises(ob.OffboxError) as e:
        ob.LocalPathDestination(tmp_path / "data" / "copies", data_dir=tmp_path / "data")
    assert e.value.code == "destination_not_offbox"
    gone = ob.LocalPathDestination(tmp_path / "unmounted")
    r2 = ob.push(_archive(tmp_path), gone, key)
    assert not r2["ok"] and r2["error"] == "destination_unavailable"
    with pytest.raises(ob.OffboxError):
        d.delete("../../etc/passwd")


# ---------------------------------------------------------------- SFTP / S3 adapters against fake clients


class FakeSftp:
    def __init__(self, root: Path):
        self.root = root
        self.ops: list[str] = []

    def _p(self, remote: str) -> Path:
        return self.root / remote.lstrip("/")

    def put(self, localpath, remotepath):
        self.ops.append(f"put {remotepath}")
        self._p(remotepath).parent.mkdir(parents=True, exist_ok=True)
        self._p(remotepath).write_bytes(Path(localpath).read_bytes())

    def get(self, remotepath, localpath):
        Path(localpath).write_bytes(self._p(remotepath).read_bytes())

    def listdir_attr(self, path):
        return [types.SimpleNamespace(filename=p.name, st_size=p.stat().st_size) for p in self._p(path).iterdir()]

    def remove(self, path):
        self.ops.append(f"remove {path}")
        self._p(path).unlink()

    def posix_rename(self, oldpath, newpath):
        self.ops.append(f"rename {oldpath} -> {newpath}")
        self._p(oldpath).replace(self._p(newpath))


class FakeS3:
    def __init__(self):
        self.store: dict[tuple[str, str], bytes] = {}

    def put_object(self, *, Bucket, Key, Body):
        self.store[(Bucket, Key)] = Body.read() if hasattr(Body, "read") else bytes(Body)

    def get_object(self, *, Bucket, Key):
        return {"Body": io.BytesIO(self.store[(Bucket, Key)])}

    def list_objects_v2(self, *, Bucket, Prefix, ContinuationToken=None, **kw):
        keys = sorted(k for b, k in self.store if b == Bucket and k.startswith(Prefix))
        start = int(ContinuationToken or 0)
        page = keys[start:start + 2]  # tiny pages: the adapter must follow the continuation
        more = start + 2 < len(keys)
        return {"Contents": [{"Key": k, "Size": len(self.store[(Bucket, k)])} for k in page], "IsTruncated": more,
                **({"NextContinuationToken": str(start + 2)} if more else {})}

    def delete_object(self, *, Bucket, Key):
        self.store.pop((Bucket, Key), None)


def test_sftp_adapter_against_a_fake_client(tmp_path):
    key = _key(tmp_path)
    fake = FakeSftp(tmp_path / "sftp")
    (tmp_path / "sftp" / "backups").mkdir(parents=True)
    d = ob.build_destination({"kind": "sftp", "host": "backup.example.net", "username": "arx", "key": "file:/run/secrets/id_ed25519",
                              "host_key": HOST_KEY_LINE, "remote_dir": "/backups"}, sftp_client=lambda dest: fake)
    policy = ob.RetentionPolicy(keep_last=1, keep_daily=0, keep_weekly=0, keep_monthly=0)
    assert ob.push(_archive(tmp_path, "auto-daily-20261019-030000.zip"), d, key, policy=policy)["ok"]
    r = ob.push(_archive(tmp_path, "auto-daily-20261020-030000.zip"), d, key, policy=policy)
    assert r["ok"] and r["deleted"] == ["auto-daily-20261019-030000.zip.swxb"]
    assert "rename /backups/.auto-daily-20261020-030000.zip.swxb.partial -> /backups/auto-daily-20261020-030000.zip.swxb" in fake.ops
    assert [o.name for o in d.list()] == ["auto-daily-20261020-030000.zip.swxb"]


def test_s3_adapter_against_a_fake_client_follows_pages(tmp_path):
    key = _key(tmp_path)
    fake = FakeS3()
    fake.store[("arx-bk", "arx-backups/foreign.bin")] = b"x"
    d = ob.build_destination({"kind": "s3", "endpoint": "https://s3.example.net", "bucket": "arx-bk", "access_key": "env:SW_TEST_S3_ID",
                              "secret_key": "env:SW_TEST_S3_SECRET"}, s3_client=lambda dest: fake)
    for day in range(15, 21):
        assert ob.push(_archive(tmp_path, f"auto-daily-202610{day}-030000.zip", size=300), d, key,
                       policy=ob.RetentionPolicy(keep_last=10, keep_daily=0, keep_weekly=0, keep_monthly=0))["ok"]
    assert len(d.list()) == 6, "six objects over three pages; the foreign key is not ours"
    assert ("arx-bk", "arx-backups/foreign.bin") in fake.store


def test_sftp_needs_a_pinned_host_key_and_s3_needs_its_credentials(tmp_path, monkeypatch):
    for pin in ("", "trust-on-first-use", "ssh-ed25519", "SHA256:short"):
        with pytest.raises(ob.OffboxError) as e:
            ob.SftpDestination("backup.example.net", "arx", ob.CredentialRef("file:/k"), pin, "/b")
        assert e.value.code == "host_key_required", pin
    ob.SftpDestination("backup.example.net", "arx", ob.CredentialRef("file:/k"), "SHA256:" + "A" * 43, "/b")
    monkeypatch.delenv("SW_TEST_NOPE_A", raising=False)
    s3 = ob.S3Destination("https://s3.example.net", "arx-bk", ob.CredentialRef("env:SW_TEST_NOPE_A"), ob.CredentialRef("env:SW_TEST_NOPE_B"))
    r = ob.push(_archive(tmp_path), s3, _key(tmp_path), dry_run=True)
    assert not r["ok"] and r["error"] == "credential_missing", "the real S3 client resolves its keys at connect time"
    store = ob.S3Destination("https://s3.example.net", "arx-bk", ob.CredentialRef("store:offbox.t1.access_key"),
                             ob.CredentialRef("store:offbox.t1.secret_key"), secret_store=lambda name: None)
    assert ob.push(_archive(tmp_path), store, _key(tmp_path), dry_run=True)["error"] == "credential_missing"


def test_marker_objects_are_written_read_and_removed_never_listed(tmp_path):
    dest = ob.FakeDestination()
    r = ob.check_connection(dest)
    assert r["ok"] and r["steps"] == ["write", "read", "delete", "list"] and dest.objects == {}
    puts = [n for op, n in dest.calls if op == "put"]
    assert len(puts) == 1 and ob.MARKER_RE.fullmatch(puts[0])
    with pytest.raises(ob.OffboxError):
        ob.check_name(puts[0])  # a marker is not a backup object (never listed, never pruned)
    dest.corrupt_put = True
    r2 = ob.check_connection(dest)
    assert not r2["ok"] and r2["error"] == "verify_hash_mismatch" and dest.objects == {}, "a failed test still removes its marker"
    bad = ob.FakeDestination()
    bad.fail_put = True
    assert ob.check_connection(bad)["error"] == "destination_unavailable"


# ---------------------------------------------------------------- credentials never leak


def test_credentials_are_references_and_never_reach_a_repr_a_result_or_a_log(tmp_path, monkeypatch, caplog):
    monkeypatch.setenv("SW_TEST_S3_SECRET", SECRET)
    monkeypatch.setenv("SW_TEST_S3_ID", "AKIDPLANTED")
    seen: dict = {}

    def factory(dest):
        seen["secret"] = dest.secret_key.resolve()  # resolved only by the transport, at connect time
        return FakeS3()

    cfg = {"kind": "s3", "endpoint": "https://s3.example.net", "bucket": "arx-bk", "access_key": "env:SW_TEST_S3_ID", "secret_key": "env:SW_TEST_S3_SECRET"}
    d = ob.build_destination(cfg, s3_client=factory)
    with caplog.at_level(logging.DEBUG):
        r = ob.push(_archive(tmp_path), d, _key(tmp_path))
        bad = ob.push(_archive(tmp_path), ob.LocalPathDestination(tmp_path / "nowhere"), _key(tmp_path))
    assert r["ok"] and seen["secret"] == SECRET and not bad["ok"]
    for text in (repr(d), json.dumps(d.describe()), json.dumps(r), json.dumps(bad), caplog.text, repr(d.secret_key)):
        assert SECRET not in text and "AKIDPLANTED" not in text
    # a literal secret where a reference belongs is refused, and the refusal does not echo it
    with pytest.raises(ob.OffboxError) as e:
        ob.build_destination({**cfg, "secret_key": SECRET})
    assert e.value.code == "credential_ref_invalid" and SECRET not in str(e.value)
    with pytest.raises(ob.OffboxError) as e:
        ob.build_destination({**cfg, "password": "x"})
    assert "password" in str(e.value) and e.value.code == "destination_invalid"
    monkeypatch.delenv("SW_TEST_S3_SECRET")
    with pytest.raises(ob.OffboxError) as e:
        ob.CredentialRef("env:SW_TEST_S3_SECRET").resolve()
    assert e.value.code == "credential_missing"


def test_object_names_are_confined():
    for bad in ("../x.zip.swxb", "a/b.zip.swxb", ".hidden.zip.swxb", "x.zip", "x.zip.swxb\x00"):
        with pytest.raises(ob.OffboxError):
            ob.check_name(bad)
    assert ob.object_name(Path("/data/backups/manual-20261020-120000-2.zip")) == "manual-20261020-120000-2.zip.swxb"
