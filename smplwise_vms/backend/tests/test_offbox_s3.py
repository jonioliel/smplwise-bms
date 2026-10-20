"""DATASTORE-295 phase 2: the S3-compatible transport (services/offbox_s3.py). SigV4 against the example AWS publishes in its
Signature Version 4 documentation ("GET Object" with a Range header); then a fake S3 service on an httpx.MockTransport that
RE-COMPUTES every request's signature with the secret it knows and answers like S3 (ListObjectsV2 XML with continuation, NoSuchKey,
AccessDenied): a full push / verify / prune, path-style and virtual-host addressing, R2's region `auto`, errors mapped to fixed
codes, and no key, Authorization header or response body in a result or a log line."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import urllib.parse
from pathlib import Path

import httpx
import pytest

from smplwise.services import backup_offbox as ob
from smplwise.services import offbox_s3

AK, SK = "AKIDPLANTED0000TEST", "PLANTED/s3+secret/key0000000000000000000"


def test_sigv4_matches_the_published_aws_example():
    out = offbox_s3.sign("GET", "examplebucket.s3.amazonaws.com", "/test.txt", {}, {"Range": "bytes=0-9"}, offbox_s3.EMPTY_SHA256,
                         access_key="AKIAIOSFODNN7EXAMPLE", secret_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region="us-east-1",
                         amz_date="20130524T000000Z")
    assert out["Authorization"] == ("AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, "
                                    "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, "
                                    "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41")


class FakeS3Service:
    """An S3-compatible service: buckets in memory, every request's SigV4 signature recomputed and checked."""

    def __init__(self, *, path_style: bool, region: str = "auto", secret: str = SK, page: int = 2):
        self.path_style, self.region, self.secret, self.page = path_style, region, secret, page
        self.objects: dict[str, bytes] = {}
        self.requests: list[str] = []
        self.bucket = "arx-bk"

    def _verify(self, req: httpx.Request, body: bytes) -> bool:
        auth = req.headers.get("authorization", "")
        m = re.fullmatch(r"AWS4-HMAC-SHA256 Credential=([^/]+)/(\d{8})/([a-z0-9-]+)/s3/aws4_request, SignedHeaders=([a-z0-9;-]+), Signature=([0-9a-f]{64})", auth)
        if not m or m.group(1) != AK or m.group(3) != self.region:
            return False
        if req.headers["x-amz-content-sha256"] != hashlib.sha256(body).hexdigest():
            return False
        names = m.group(4).split(";")
        assert {"host", "x-amz-date", "x-amz-content-sha256"} <= set(names)
        query = dict(urllib.parse.parse_qsl(req.url.query.decode() if isinstance(req.url.query, bytes) else req.url.query, keep_blank_values=True))
        expect = offbox_s3.sign(req.method, req.url.netloc.decode() if isinstance(req.url.netloc, bytes) else req.url.netloc,
                                urllib.parse.unquote(req.url.path), query, {n: req.headers[n] for n in names if n not in ("host", "x-amz-date", "x-amz-content-sha256")},
                                req.headers["x-amz-content-sha256"], access_key=AK, secret_key=self.secret, region=self.region,
                                amz_date=req.headers["x-amz-date"])
        return expect["Authorization"] == auth

    def _key(self, req: httpx.Request) -> tuple[str, str]:
        host = req.url.host
        path = urllib.parse.unquote(req.url.path)
        if self.path_style:
            assert host == "s3.example.net", host
            _, bucket, *rest = path.split("/", 2)
            return bucket, rest[0] if rest else ""
        assert host == f"{self.bucket}.s3.example.net", host
        return self.bucket, path.lstrip("/")

    def handler(self, req: httpx.Request) -> httpx.Response:
        body = req.read()
        self.requests.append(f"{req.method} {req.url.path}")
        if not self._verify(req, body):
            return httpx.Response(403, content=b"<Error><Code>SignatureDoesNotMatch</Code><Message>no</Message></Error>")
        bucket, key = self._key(req)
        if bucket != self.bucket:
            return httpx.Response(404, content=b"<Error><Code>NoSuchBucket</Code></Error>")
        if req.method == "PUT":
            assert req.headers.get("content-length") == str(len(body)) and "transfer-encoding" not in req.headers
            self.objects[key] = body
            return httpx.Response(200, headers={"ETag": '"x"'})
        if req.method == "GET" and key:
            if key not in self.objects:
                return httpx.Response(404, content=b"<Error><Code>NoSuchKey</Code></Error>")
            return httpx.Response(200, content=self.objects[key])
        if req.method == "DELETE":
            self.objects.pop(key, None)
            return httpx.Response(204)
        if req.method == "GET":
            q = dict(urllib.parse.parse_qsl(req.url.query.decode()))
            assert q["list-type"] == "2"
            keys = sorted(k for k in self.objects if k.startswith(q.get("prefix", "")))
            start = int(q.get("continuation-token") or 0)
            page = keys[start:start + self.page]
            more = start + self.page < len(keys)
            xml = ['<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">',
                   f"<IsTruncated>{'true' if more else 'false'}</IsTruncated>"]
            xml += [f"<Contents><Key>{k}</Key><Size>{len(self.objects[k])}</Size></Contents>" for k in page]
            if more:
                xml.append(f"<NextContinuationToken>{start + self.page}</NextContinuationToken>")
            xml.append("</ListBucketResult>")
            return httpx.Response(200, content="".join(xml).encode())
        return httpx.Response(400)


def _dest(svc: FakeS3Service, monkeypatch, secret: str = SK) -> ob.S3Destination:
    monkeypatch.setenv("SW_T_S3_ID", AK)
    monkeypatch.setenv("SW_T_S3_SECRET", secret)
    transport = httpx.MockTransport(svc.handler)
    return ob.build_destination({"kind": "s3", "endpoint": "https://s3.example.net", "bucket": "arx-bk", "region": svc.region,
                                 "path_style": svc.path_style, "access_key": "env:SW_T_S3_ID", "secret_key": "env:SW_T_S3_SECRET"},
                                s3_client=lambda d: offbox_s3.client_for(d, transport=transport))


def _archive(tmp_path: Path, name: str, size: int = 2 * 1024 * 1024 + 5) -> Path:
    p = tmp_path / "src" / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(os.urandom(size))
    return p


@pytest.mark.parametrize("path_style", [True, False])
def test_push_verify_prune_against_the_fake_service(tmp_path, monkeypatch, caplog, path_style):
    svc = FakeS3Service(path_style=path_style)
    svc.objects["arx-backups/someone-else.bin"] = b"x"
    d = _dest(svc, monkeypatch)
    key = ob.load_or_create_key(tmp_path / "k.key")
    policy = ob.RetentionPolicy(keep_last=2, keep_daily=0, keep_weekly=0, keep_monthly=0)
    with caplog.at_level(logging.DEBUG):
        results = [ob.push(_archive(tmp_path, f"auto-daily-202610{d_:02d}-030000.zip"), d, key, policy=policy) for d_ in (17, 18, 19, 20)]
    d.close()
    assert all(r["ok"] and r["verified"] for r in results), results
    assert sorted(svc.objects) == ["arx-backups/auto-daily-20261019-030000.zip.swxb", "arx-backups/auto-daily-20261020-030000.zip.swxb",
                                   "arx-backups/someone-else.bin"]
    assert results[-1]["deleted"] == ["auto-daily-20261018-030000.zip.swxb"]
    for text in (caplog.text, json.dumps(results), repr(d)):
        assert SK not in text and "Signature=" not in text and "PLANTED" not in text


def test_connection_check_and_listing_pages(tmp_path, monkeypatch):
    svc = FakeS3Service(path_style=True, page=1)
    for i in range(5):
        svc.objects[f"arx-backups/manual-2026101{i}-120000.zip.swxb"] = b"y" * i
    d = _dest(svc, monkeypatch)
    assert len(d.list()) == 5, "one key per page: the client follows every continuation token"
    r = ob.check_connection(d)
    assert r["ok"] and len(svc.objects) == 5, "the marker is gone again"
    assert any(p.endswith(".txt") for p in [x.split(" ", 1)[1] for x in svc.requests if x.startswith("PUT")])


def test_errors_map_to_fixed_codes(tmp_path, monkeypatch):
    archive = _archive(tmp_path, "manual-20261020-120000.zip", size=100)
    key = ob.load_or_create_key(tmp_path / "k.key")
    wrong = _dest(FakeS3Service(path_style=True), monkeypatch, secret="not-the-secret")
    r = ob.push(archive, wrong, key)
    assert not r["ok"] and r["error"] == "auth_failed" and "not-the-secret" not in json.dumps(r)
    svc = FakeS3Service(path_style=True)
    svc.bucket = "other-bucket"
    assert ob.push(archive, _dest(svc, monkeypatch), key)["error"] == "bucket_missing"

    def boom(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=req)

    monkeypatch.setenv("SW_T_S3_ID", AK)
    monkeypatch.setenv("SW_T_S3_SECRET", SK)
    down = ob.build_destination({"kind": "s3", "endpoint": "https://s3.example.net", "bucket": "arx-bk", "access_key": "env:SW_T_S3_ID",
                                 "secret_key": "env:SW_T_S3_SECRET"}, s3_client=lambda d: offbox_s3.client_for(d, transport=httpx.MockTransport(boom)))
    assert ob.push(archive, down, key)["error"] == "destination_unavailable"
    with pytest.raises(ob.OffboxError):
        offbox_s3.SigV4Client("http://s3.example.net", "auto", AK, SK)  # never plain http
    assert SK not in repr(offbox_s3.SigV4Client("https://s3.example.net", "auto", AK, SK))


def test_missing_object_is_object_missing(tmp_path, monkeypatch):
    d = _dest(FakeS3Service(path_style=True), monkeypatch)
    with pytest.raises(ob.OffboxError) as e:
        d.get("manual-20261020-120000.zip.swxb", tmp_path / "x")
    assert e.value.code == "object_missing"
