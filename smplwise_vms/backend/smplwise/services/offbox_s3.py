"""DATASTORE-295 phase 2: the S3-compatible transport of the off-box copies (services/backup_offbox.S3Destination).

A small AWS Signature Version 4 client over httpx - no SDK in the image. It speaks the four calls the adapter needs (PutObject,
GetObject, ListObjectsV2, DeleteObject) to any S3-compatible service: Cloudflare R2 (region `auto`, path-style), AWS S3, Backblaze B2,
Wasabi, MinIO. https only; TLS is verified (httpx default). Every payload is signed with its real SHA-256 (no UNSIGNED-PAYLOAD); an
upload streams the file with an explicit Content-Length.

Never logged or returned: the keys, the Authorization header, a response body. An error becomes an OffboxError with a fixed code
(`auth_failed`, `bucket_missing`, `object_missing`, `destination_unavailable`, `remote_error`) and at most the service's short error
code (`AccessDenied`, ...). Tests: tests/test_offbox_s3.py (the published AWS SigV4 example, and a fake S3 service on an
httpx.MockTransport that re-computes every signature)."""
from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import re
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any, BinaryIO, Callable

import httpx

from .backup_offbox import CHUNK, OffboxError

EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()
MAX_LIST_BYTES = 16 * 1024 * 1024
ALGORITHM = "AWS4-HMAC-SHA256"


def _q(s: str, safe: str = "") -> str:
    return urllib.parse.quote(s, safe=safe)  # letters, digits and `_.-~` are never encoded


def _hmac(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def signing_key(secret_key: str, date: str, region: str, service: str = "s3") -> bytes:
    k = _hmac(("AWS4" + secret_key).encode("utf-8"), date)
    k = _hmac(k, region)
    k = _hmac(k, service)
    return _hmac(k, "aws4_request")


def sign(method: str, host: str, path: str, query: dict[str, str], headers: dict[str, str], payload_hash: str, *, access_key: str,
         secret_key: str, region: str, amz_date: str, service: str = "s3") -> dict[str, str]:
    """The headers to send (the given ones + host, x-amz-date, x-amz-content-sha256, Authorization). Pure: no clock, no I/O."""
    h = {k.lower(): " ".join(str(v).strip().split()) for k, v in headers.items()}
    h["host"] = host
    h["x-amz-content-sha256"] = payload_hash
    h["x-amz-date"] = amz_date
    names = sorted(h)
    canonical = "\n".join([
        method.upper(),
        _q(path, safe="/") or "/",
        "&".join(f"{_q(k)}={_q(v)}" for k, v in sorted(query.items())),
        "".join(f"{k}:{h[k]}\n" for k in names),
        ";".join(names),
        payload_hash,
    ])
    date = amz_date[:8]
    scope = f"{date}/{region}/{service}/aws4_request"
    to_sign = "\n".join([ALGORITHM, amz_date, scope, hashlib.sha256(canonical.encode("utf-8")).hexdigest()])
    signature = hmac.new(signing_key(secret_key, date, region, service), to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    out = {k: v for k, v in headers.items()}
    out.update({"x-amz-date": amz_date, "x-amz-content-sha256": payload_hash,
                "Authorization": f"{ALGORITHM} Credential={access_key}/{scope}, SignedHeaders={';'.join(names)}, Signature={signature}"})
    return out


def _amz_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _code_of(body: bytes) -> str:
    m = re.search(rb"<Code>([A-Za-z]{1,40})</Code>", body[:4096])
    return m.group(1).decode() if m else ""


class SigV4Client:
    """The four S3 calls, boto3-shaped (keyword arguments, `Contents` / `IsTruncated` / `NextContinuationToken`)."""

    def __init__(self, endpoint: str, region: str, access_key: str, secret_key: str, *, path_style: bool = True,
                 transport: httpx.BaseTransport | None = None, timeout_s: float = 60.0, clock: Callable[[], str] = _amz_now):
        u = urllib.parse.urlsplit(endpoint)
        if u.scheme != "https" or not u.netloc:
            raise OffboxError("destination_invalid", "endpoint must be an https:// host")
        self._netloc = u.netloc
        self._region = region
        self._ak, self._sk = access_key, secret_key
        self._path_style = path_style
        self._clock = clock
        self._http = httpx.Client(transport=transport, timeout=httpx.Timeout(timeout_s, connect=20.0), follow_redirects=False)

    def __repr__(self) -> str:
        return f"SigV4Client(host={self._netloc!r}, region={self._region!r}, path_style={self._path_style})"

    def close(self) -> None:
        self._http.close()

    def _where(self, bucket: str, key: str = "") -> tuple[str, str]:
        if self._path_style:
            return self._netloc, f"/{bucket}/{key}" if key else f"/{bucket}"
        return f"{bucket}.{self._netloc}", f"/{key}"

    def _send(self, method: str, bucket: str, key: str = "", *, query: dict[str, str] | None = None, body: Any = None,
              payload_hash: str = EMPTY_SHA256, headers: dict[str, str] | None = None, stream: bool = False) -> httpx.Response:
        host, path = self._where(bucket, key)
        query = query or {}
        signed = sign(method, host, path, query, headers or {}, payload_hash, access_key=self._ak, secret_key=self._sk,
                      region=self._region, amz_date=self._clock())
        url = f"https://{host}{_q(path, safe='/')}" + (("?" + "&".join(f"{_q(k)}={_q(v)}" for k, v in sorted(query.items()))) if query else "")
        try:
            req = self._http.build_request(method, url, headers=signed, content=body)
            resp = self._http.send(req, stream=stream)
        except httpx.HTTPError as exc:
            raise OffboxError("destination_unavailable", f"the storage service did not answer ({type(exc).__name__})") from None
        if resp.status_code >= 300:
            raw = resp.read()[:4096] if stream else resp.content[:4096]
            resp.close()
            code = _code_of(raw)
            if resp.status_code in (401, 403) or code in ("AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch", "Unauthorized"):
                raise OffboxError("auth_failed", f"the storage service refused the credentials ({code or resp.status_code})")
            if code == "NoSuchBucket":
                raise OffboxError("bucket_missing", "the bucket does not exist")
            if code == "NoSuchKey" or resp.status_code == 404:
                raise OffboxError("object_missing", "the object is not at the destination")
            raise OffboxError("remote_error", f"the storage service answered HTTP {resp.status_code} {code}".strip())
        return resp

    def put_object(self, *, Bucket: str, Key: str, Body: bytes | BinaryIO) -> dict[str, Any]:
        if isinstance(Body, (bytes, bytearray)):
            data = bytes(Body)
            resp = self._send("PUT", Bucket, Key, body=data, payload_hash=hashlib.sha256(data).hexdigest(),
                              headers={"Content-Length": str(len(data)), "Content-Type": "application/octet-stream"})
        else:
            h, size = hashlib.sha256(), 0
            start = Body.tell()
            for chunk in iter(lambda: Body.read(CHUNK), b""):
                h.update(chunk)
                size += len(chunk)
            Body.seek(start)

            def gen() -> Any:
                for chunk in iter(lambda: Body.read(CHUNK), b""):
                    yield chunk

            resp = self._send("PUT", Bucket, Key, body=gen(), payload_hash=h.hexdigest(),
                              headers={"Content-Length": str(size), "Content-Type": "application/octet-stream"})
        resp.close()
        return {"ETag": resp.headers.get("etag")}

    def get_object(self, *, Bucket: str, Key: str) -> dict[str, Any]:
        resp = self._send("GET", Bucket, Key, stream=True)
        spool = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024)
        try:
            for chunk in resp.iter_bytes(CHUNK):
                spool.write(chunk)
        except httpx.HTTPError:
            spool.close()
            raise OffboxError("destination_unavailable", "the download was interrupted") from None
        finally:
            resp.close()
        spool.seek(0)
        return {"Body": spool}

    def list_objects_v2(self, *, Bucket: str, Prefix: str, ContinuationToken: str | None = None, **_: Any) -> dict[str, Any]:
        q = {"list-type": "2", "prefix": Prefix}
        if ContinuationToken:
            q["continuation-token"] = ContinuationToken
        resp = self._send("GET", Bucket, query=q)
        if len(resp.content) > MAX_LIST_BYTES:
            raise OffboxError("remote_error", "the listing is too large")
        try:
            root = ET.fromstring(resp.content)
        except ET.ParseError:
            raise OffboxError("remote_error", "the listing is not readable") from None

        def local(tag: str) -> str:
            return tag.rsplit("}", 1)[-1]

        contents: list[dict[str, Any]] = []
        truncated, token = False, None
        for el in root:
            name = local(el.tag)
            if name == "Contents":
                item = {local(c.tag): (c.text or "") for c in el}
                try:
                    size = int(item.get("Size") or 0)
                except ValueError:
                    size = 0
                contents.append({"Key": item.get("Key", ""), "Size": size})
            elif name == "IsTruncated":
                truncated = (el.text or "").strip().lower() == "true"
            elif name == "NextContinuationToken":
                token = (el.text or "").strip() or None
        return {"Contents": contents, "IsTruncated": truncated, **({"NextContinuationToken": token} if token else {})}

    def delete_object(self, *, Bucket: str, Key: str) -> dict[str, Any]:
        self._send("DELETE", Bucket, Key).close()
        return {}


def client_for(dest: Any, *, transport: httpx.BaseTransport | None = None) -> SigV4Client:
    """The real client of an S3Destination: its keys resolved now (store / env / file reference), held only in this object."""
    access_key, secret_key = dest.credentials()
    return SigV4Client(dest.endpoint, dest.region, access_key, secret_key, path_style=dest.path_style, transport=transport)
