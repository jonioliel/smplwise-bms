"""DATASTORE-295 (data-store hardening, part 2): off-box copies of the project backups.

Design: docs/architecture/DATA_STORE_HARDENING.md. A copy that lives on the same disk as the database dies with that disk; this
module puts an ENCRYPTED copy of an archive on another machine and proves it can be read back.

- `Destination`: the pluggable interface (put / get / list / delete / describe / close). `LocalPathDestination` (a mounted share
  or USB disk - never a folder inside the data directory), `FakeDestination` (in memory, with failure knobs, for tests),
  `S3Destination` (any S3-compatible service; the transport is services/offbox_s3.py: SigV4 over httpx, path-style or virtual-host)
  and `SftpDestination` (services/offbox_sftp.py: paramiko, key authentication, the server's host key PINNED - never trust on first
  use). Both adapters also take an injected client (the tests' fakes). GDRIVEBK-2310: `gdrive` - Google Drive through
  services/offbox_gdrive.py (`drive.file` scope, one folder, resumable chunked uploads, the refresh token and client secret
  sealed like the other credentials; an injected httpx client factory for the tests' fake Drive).
- Encryption at rest (`seal_file` / `open_file`): AES-256-GCM in 1 MiB chunks (format SWXB v1, below), under a 32-byte key that
  is held OUTSIDE the database - the keyring `<data>/keys/offbox_keyring.json` (services/offbox_keys.py, mode 0600; the keys folder
  never enters an archive). Rotation adds a key and keeps the old ones, so every older copy stays readable; `open_file` picks the
  key by the id in the file's header. Losing the keyring loses every off-box copy: the administrator exports each key once.
- Marker objects (`arx-test-<hex>.txt`): the connection test writes one, reads it back and deletes it; never listed, never pruned.
- `RetentionPolicy` (default: newest 3, 14 daily, 4 weekly, 6 monthly; configurable): keep the newest N plus one per day / ISO week / month for D / W / M periods; objects whose names this
  module did not write are never deleted.
- `push()`: dry-run (lists the destination, plans the upload and the pruning, writes nothing), upload, verify-after-upload
  (`hash`: the downloaded ciphertext's SHA-256 equals the local one; `deep`: also decrypts it and compares the archive's SHA-256)
  and only then prunes - a copy that did not verify never causes an older good copy to be deleted.
- Credentials are never stored in the repository, a log line or a result: a destination's configuration holds a REFERENCE -
  `store:<name>` (sealed in the database with the installation key, services/offbox_store.py), `env:NAME` or `file:/path` -
  resolved only when the transport connects; `describe()` / `repr()` name the reference only.

SWXB v1 layout: b"SWXB" 0x01 | u32 header length | header JSON (alg, key_id, chunk, nonce_prefix, created_at) |
records: u32 ciphertext length | ciphertext. Nonce = 7-byte random prefix | 1-byte final flag | u32 counter; AAD = SHA-256 of the
header bytes. The last record carries the final flag, so truncation, reordering, a record appended after the end and a header
edit all fail authentication."""
from __future__ import annotations

import base64
import dataclasses
import datetime as dt
import hashlib
import json
import logging
import os
import re
import secrets
import shutil
import struct
import tempfile
import time
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Protocol

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

log = logging.getLogger("smplwise.backup.offbox")

MAGIC = b"SWXB\x01"
ALG = "AES-256-GCM"
KEY_BYTES = 32
CHUNK = 1024 * 1024
MAX_HEADER = 4096
SUFFIX = ".swxb"
KEY_FILE = "offbox_backup.key"  # phase 1's single key file; services/offbox_keys.py imports it into the keyring
# what this module writes: <archive stem>.zip.swxb, the archive stem carrying the time stamp (manual-20261020-120000[-2])
OBJECT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.zip\.swxb$")
MARKER_RE = re.compile(r"^arx-test-[0-9a-f]{16}\.txt$")
STAMP_RE = re.compile(r"(\d{8})-(\d{6})")

SecretLookup = Callable[[str], "str | None"]


class OffboxError(Exception):
    """`code` is a fixed identifier the API and the UI translate; the message is fixed text - never a credential or a body."""

    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code


# ---------------------------------------------------------------- credentials (references only)


@dataclasses.dataclass(frozen=True)
class CredentialRef:
    """`store:<name>`, `env:NAME` or `file:/absolute/path`. The value is read only by `resolve()`, at connect time, and never kept
    or printed. `store:` values come from the lookup the caller passes (services/offbox_store.py: sealed with the installation key)."""

    ref: str

    def __post_init__(self) -> None:
        kind, _, rest = self.ref.partition(":")
        if kind == "store" and re.fullmatch(r"[a-z0-9][a-z0-9_.|-]{0,120}", rest):
            return
        if kind == "env" and re.fullmatch(r"[A-Z_][A-Z0-9_]{0,63}", rest):
            return
        if kind == "file" and rest and (rest.startswith("/") or Path(rest).is_absolute()) and "\x00" not in rest:
            return
        # never echo the rejected text: it may be the secret itself, pasted where a reference belongs
        raise OffboxError("credential_ref_invalid", "a credential must be a reference: store:NAME, env:NAME or file:/absolute/path")

    def resolve(self, store: SecretLookup | None = None) -> str:
        kind, _, rest = self.ref.partition(":")
        value: str | None
        if kind == "store":
            value = store(rest) if store is not None else None
        elif kind == "env":
            value = os.environ.get(rest)
        else:
            try:
                value = Path(rest).read_text(encoding="utf-8").strip()
            except OSError:
                value = None
        if not value:
            raise OffboxError("credential_missing", f"the credential {self.ref} is not set")
        return value

    def __repr__(self) -> str:
        return f"CredentialRef({self.ref!r})"


# ---------------------------------------------------------------- the destination interface


@dataclasses.dataclass(frozen=True)
class RemoteObject:
    name: str
    size: int


class Destination(Protocol):
    kind: str

    def describe(self) -> dict[str, Any]: ...  # safe to show and log: never a credential value
    def put(self, src: Path, name: str) -> RemoteObject: ...
    def get(self, name: str, dest: Path) -> None: ...
    def list(self) -> list[RemoteObject]: ...
    def delete(self, name: str) -> None: ...
    def close(self) -> None: ...


def check_name(name: str, *, marker_ok: bool = False) -> str:
    if isinstance(name, str) and (OBJECT_RE.fullmatch(name) or (marker_ok and MARKER_RE.fullmatch(name))):
        return name
    raise OffboxError("object_name_invalid", "not an off-box backup object name")


def new_marker_name() -> str:
    return f"arx-test-{secrets.token_hex(8)}.txt"


class LocalPathDestination:
    """A folder on ANOTHER disk (a mounted network share, a USB disk). Writes are atomic (temporary name, fsync, rename)."""

    kind = "local"

    def __init__(self, root: Path, *, data_dir: Path | None = None):
        root = Path(root)
        if not (root.is_absolute() or str(root).startswith("/")):
            raise OffboxError("destination_invalid", "the destination path must be absolute")
        if data_dir is not None:
            r, d = root.resolve(), Path(data_dir).resolve()
            if r == d or d in r.parents:
                raise OffboxError("destination_not_offbox", "a folder inside the data directory is not an off-box copy")
        self.root = root

    def describe(self) -> dict[str, Any]:
        return {"kind": self.kind, "path": str(self.root)}

    def close(self) -> None:
        return None

    def _ensure(self) -> None:
        if not self.root.is_dir():
            raise OffboxError("destination_unavailable", "the destination folder is not mounted / does not exist")

    def put(self, src: Path, name: str) -> RemoteObject:
        self._ensure()
        dest = self.root / check_name(name, marker_ok=True)
        tmp = self.root / f".{name}.partial"
        with open(src, "rb") as fin, open(tmp, "wb") as fout:
            shutil.copyfileobj(fin, fout, CHUNK)
            fout.flush()
            os.fsync(fout.fileno())
        os.replace(tmp, dest)
        return RemoteObject(name, dest.stat().st_size)

    def get(self, name: str, dest: Path) -> None:
        self._ensure()
        src = self.root / check_name(name, marker_ok=True)
        if not src.is_file():
            raise OffboxError("object_missing", "the object is not at the destination")
        shutil.copyfile(src, dest)

    def list(self) -> list[RemoteObject]:
        self._ensure()
        return sorted((RemoteObject(p.name, p.stat().st_size) for p in self.root.iterdir() if p.is_file() and OBJECT_RE.fullmatch(p.name)),
                      key=lambda o: o.name)

    def delete(self, name: str) -> None:
        self._ensure()
        (self.root / check_name(name, marker_ok=True)).unlink(missing_ok=True)


class FakeDestination:
    """In memory. Knobs: `fail_put` / `fail_get` / `fail_list` (raise), `corrupt_put` (store the upload with one byte flipped),
    `truncate_put` (store it cut short). `calls` records every operation (name only)."""

    kind = "fake"

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.fail_put = self.fail_get = self.fail_list = False
        self.corrupt_put = self.truncate_put = False
        self.calls: list[tuple[str, str]] = []
        self.closed = 0

    def describe(self) -> dict[str, Any]:
        return {"kind": self.kind, "objects": len(self.objects)}

    def close(self) -> None:
        self.closed += 1

    def put(self, src: Path, name: str) -> RemoteObject:
        self.calls.append(("put", name))
        if self.fail_put:
            raise OffboxError("destination_unavailable", "fake: put refused")
        data = bytearray(Path(src).read_bytes())
        if self.corrupt_put and data:
            data[len(data) // 2] ^= 0x01
        if self.truncate_put:
            data = data[: max(0, len(data) - 7)]
        self.objects[check_name(name, marker_ok=True)] = bytes(data)
        return RemoteObject(name, len(data))

    def get(self, name: str, dest: Path) -> None:
        self.calls.append(("get", name))
        if self.fail_get:
            raise OffboxError("destination_unavailable", "fake: get refused")
        if name not in self.objects:
            raise OffboxError("object_missing", "the object is not at the destination")
        Path(dest).write_bytes(self.objects[name])

    def list(self) -> list[RemoteObject]:
        self.calls.append(("list", ""))
        if self.fail_list:
            raise OffboxError("destination_unavailable", "fake: list refused")
        return sorted((RemoteObject(n, len(b)) for n, b in self.objects.items() if OBJECT_RE.fullmatch(n)), key=lambda o: o.name)

    def delete(self, name: str) -> None:
        self.calls.append(("delete", name))
        self.objects.pop(check_name(name, marker_ok=True), None)


# ---- SFTP


class SftpClient(Protocol):
    """The subset of an SFTP client the adapter needs (paramiko.SFTPClient has these names)."""

    def put(self, localpath: str, remotepath: str) -> Any: ...
    def get(self, remotepath: str, localpath: str) -> Any: ...
    def listdir_attr(self, path: str) -> list[Any]: ...  # items with .filename and .st_size
    def remove(self, path: str) -> Any: ...
    def posix_rename(self, oldpath: str, newpath: str) -> Any: ...
    def close(self) -> Any: ...


HOST_KEY_RE = re.compile(r"^(SHA256:[A-Za-z0-9+/]{43}=?|(ssh-ed25519|ecdsa-sha2-nistp(256|384|521)|ssh-rsa) [A-Za-z0-9+/]+={0,3})$")


class SftpDestination:
    """SFTP to `host:port` as `username` with a private key (`key` reference) and the server's host key PINNED (`host_key`: the
    public key line `ssh-ed25519 AAAA...` or its `SHA256:...` fingerprint - public, not a secret). Never a password, never trust on
    first use: a server presenting another key is refused before authentication. Uploads go to `.name.partial` and are renamed."""

    kind = "sftp"

    def __init__(self, host: str, username: str, key: CredentialRef, host_key: str, remote_dir: str, port: int = 22,
                 client_factory: Callable[["SftpDestination"], SftpClient] | None = None, secret_store: SecretLookup | None = None,
                 timeout_s: float = 20.0):
        if not re.fullmatch(r"[A-Za-z0-9.-]{1,253}", host or "") or not (0 < int(port) < 65536):
            raise OffboxError("destination_invalid", "host / port not valid")
        if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", username or ""):
            raise OffboxError("destination_invalid", "user name not valid")
        if not remote_dir.startswith("/") or ".." in remote_dir.split("/") or len(remote_dir) > 400:
            raise OffboxError("destination_invalid", "remote_dir must be an absolute path without '..'")
        if not isinstance(key, CredentialRef):
            raise OffboxError("credential_ref_invalid", "key must be a credential reference")
        host_key = (host_key or "").strip()
        if not HOST_KEY_RE.fullmatch(host_key):
            raise OffboxError("host_key_required", "the server's host key (or its SHA256 fingerprint) must be pinned")
        self.host, self.port, self.username, self.key, self.host_key = host, int(port), username, key, host_key
        self.remote_dir = remote_dir.rstrip("/") or "/"
        self.timeout_s = timeout_s
        self._factory = client_factory
        self._store = secret_store
        self._client: SftpClient | None = None

    def describe(self) -> dict[str, Any]:
        return {"kind": self.kind, "host": self.host, "port": self.port, "username": self.username, "remote_dir": self.remote_dir,
                "key": self.key.ref, "host_key": self.host_key[:80]}

    def __repr__(self) -> str:
        return f"SftpDestination({self.describe()!r})"

    def private_key_text(self) -> str:
        return self.key.resolve(self._store)

    def connect(self) -> SftpClient:
        if self._client is None:
            if self._factory is not None:
                self._client = self._factory(self)
            else:
                from . import offbox_sftp

                self._client = offbox_sftp.connect(self)
        return self._client

    def close(self) -> None:
        c, self._client = self._client, None
        if c is not None:
            try:
                c.close()
            except Exception:  # noqa: BLE001 - closing never fails a run
                pass

    def _path(self, name: str) -> str:
        return f"{self.remote_dir}/{check_name(name, marker_ok=True)}"

    def put(self, src: Path, name: str) -> RemoteObject:
        c = self.connect()
        tmp = f"{self.remote_dir}/.{check_name(name, marker_ok=True)}.partial"
        c.put(str(src), tmp)
        c.posix_rename(tmp, self._path(name))
        return RemoteObject(name, Path(src).stat().st_size)

    def get(self, name: str, dest: Path) -> None:
        self.connect().get(self._path(name), str(dest))

    def list(self) -> list[RemoteObject]:
        items = self.connect().listdir_attr(self.remote_dir)
        return sorted((RemoteObject(i.filename, int(i.st_size)) for i in items if OBJECT_RE.fullmatch(getattr(i, "filename", ""))),
                      key=lambda o: o.name)

    def delete(self, name: str) -> None:
        self.connect().remove(self._path(name))


# ---- S3-compatible


class S3Client(Protocol):
    """The subset of an S3 client the adapter needs (boto3's names and keyword arguments; services/offbox_s3.SigV4Client)."""

    def put_object(self, *, Bucket: str, Key: str, Body: Any) -> Any: ...
    def get_object(self, *, Bucket: str, Key: str) -> dict[str, Any]: ...  # {"Body": <readable>}
    def list_objects_v2(self, *, Bucket: str, Prefix: str, **kw: Any) -> dict[str, Any]: ...
    def delete_object(self, *, Bucket: str, Key: str) -> Any: ...


class S3Destination:
    """An S3-compatible bucket (Cloudflare R2, AWS, Backblaze B2, Wasabi, MinIO) at `endpoint` (https only), objects under
    `prefix/`. `path_style`: https://endpoint/bucket/key (R2 and MinIO need it) instead of https://bucket.endpoint/key. Keys by
    reference only. The archive is already encrypted (SWXB) before it leaves; server-side encryption is extra."""

    kind = "s3"

    def __init__(self, endpoint: str, bucket: str, access_key: CredentialRef, secret_key: CredentialRef, prefix: str = "arx-backups",
                 region: str = "auto", client_factory: Callable[["S3Destination"], S3Client] | None = None, path_style: bool = True,
                 secret_store: SecretLookup | None = None):
        if not re.fullmatch(r"https://[A-Za-z0-9.-]{1,253}(:\d{1,5})?/?", endpoint or ""):
            raise OffboxError("destination_invalid", "endpoint must be an https:// host")
        if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", bucket or ""):
            raise OffboxError("destination_invalid", "bucket name not valid")
        if not re.fullmatch(r"[A-Za-z0-9._/-]{0,200}", prefix or "") or ".." in prefix.split("/"):
            raise OffboxError("destination_invalid", "prefix not valid")
        if not re.fullmatch(r"[a-z0-9-]{1,32}", region or ""):
            raise OffboxError("destination_invalid", "region not valid")
        if not isinstance(access_key, CredentialRef) or not isinstance(secret_key, CredentialRef):
            raise OffboxError("credential_ref_invalid", "access_key and secret_key must be credential references")
        self.endpoint, self.bucket, self.region, self.path_style = endpoint.rstrip("/"), bucket, region, bool(path_style)
        self.prefix = prefix.strip("/")
        self.access_key, self.secret_key = access_key, secret_key
        self._factory = client_factory
        self._store = secret_store
        self._client: S3Client | None = None

    def describe(self) -> dict[str, Any]:
        return {"kind": self.kind, "endpoint": self.endpoint, "bucket": self.bucket, "prefix": self.prefix, "region": self.region,
                "path_style": self.path_style, "access_key": self.access_key.ref, "secret_key": self.secret_key.ref}

    def __repr__(self) -> str:
        return f"S3Destination({self.describe()!r})"

    def credentials(self) -> tuple[str, str]:
        return self.access_key.resolve(self._store), self.secret_key.resolve(self._store)

    def connect(self) -> S3Client:
        if self._client is None:
            if self._factory is not None:
                self._client = self._factory(self)
            else:
                from . import offbox_s3

                self._client = offbox_s3.client_for(self)
        return self._client

    def close(self) -> None:
        c, self._client = self._client, None
        close = getattr(c, "close", None)
        if callable(close):
            try:
                close()
            except Exception:  # noqa: BLE001
                pass

    def _key(self, name: str) -> str:
        n = check_name(name, marker_ok=True)
        return f"{self.prefix}/{n}" if self.prefix else n

    def put(self, src: Path, name: str) -> RemoteObject:
        size = Path(src).stat().st_size
        with open(src, "rb") as f:  # streamed by the SigV4 client; a fake may read it whole
            self.connect().put_object(Bucket=self.bucket, Key=self._key(name), Body=f)
        return RemoteObject(name, size)

    def get(self, name: str, dest: Path) -> None:
        body = self.connect().get_object(Bucket=self.bucket, Key=self._key(name))["Body"]
        with open(dest, "wb") as f:
            shutil.copyfileobj(body, f, CHUNK)

    def list(self) -> list[RemoteObject]:
        c = self.connect()
        out: list[RemoteObject] = []
        kw: dict[str, Any] = {}
        pre = f"{self.prefix}/" if self.prefix else ""
        for _ in range(10000):  # a misbehaving server can never loop us forever
            page = c.list_objects_v2(Bucket=self.bucket, Prefix=pre, **kw)
            for o in page.get("Contents") or []:
                name = str(o.get("Key", ""))[len(pre):]
                if OBJECT_RE.fullmatch(name):
                    out.append(RemoteObject(name, int(o.get("Size") or 0)))
            if not page.get("IsTruncated") or not page.get("NextContinuationToken"):
                break
            kw = {"ContinuationToken": page.get("NextContinuationToken")}
        return sorted(out, key=lambda o: o.name)

    def delete(self, name: str) -> None:
        self.connect().delete_object(Bucket=self.bucket, Key=self._key(name))


CREDENTIAL_FIELDS = {"sftp": ("key",), "s3": ("access_key", "secret_key"), "gdrive": ("client_secret", "refresh_token")}
# credentials an administrator never types: they arrive only from a consent flow (the Google refresh token)
CONSENT_ONLY_FIELDS = {"gdrive": ("refresh_token",)}
ALLOWED_FIELDS = {"local": {"kind", "path"}, "sftp": {"kind", "host", "port", "username", "key", "host_key", "remote_dir"},
                  "s3": {"kind", "endpoint", "bucket", "prefix", "region", "path_style", "access_key", "secret_key"},
                  "gdrive": {"kind", "client_id", "folder_name", "chunk_mib", "prune_mode", "quota_margin_pct", "min_free_mib", "client_secret",
                             "refresh_token"}}


def build_destination(cfg: dict[str, Any], *, data_dir: Path | None = None, sftp_client: Callable | None = None,
                      s3_client: Callable | None = None, secret_store: SecretLookup | None = None,
                      gdrive_http: Callable | None = None) -> Destination:
    """A destination from its (non-secret) configuration. Unknown fields are refused - nobody adds a `password` field that
    would end up stored - and every credential field must be a reference."""
    kind = cfg.get("kind") if isinstance(cfg, dict) else None
    if kind not in ALLOWED_FIELDS:
        raise OffboxError("destination_invalid", "kind must be local | sftp | s3 | gdrive")
    extra = sorted(set(cfg) - ALLOWED_FIELDS[kind])
    if extra:
        raise OffboxError("destination_invalid", f"unknown field(s): {', '.join(extra)[:120]}")
    refs = {f: CredentialRef(str(cfg.get(f) or "")) for f in CREDENTIAL_FIELDS.get(kind, ())}
    if kind == "gdrive":
        from . import offbox_gdrive

        return offbox_gdrive.build(cfg, refs["client_secret"], refs["refresh_token"], secret_store=secret_store, http_factory=gdrive_http)
    if kind == "local":
        return LocalPathDestination(Path(str(cfg.get("path") or "")), data_dir=data_dir)
    if kind == "sftp":
        try:
            port = int(cfg.get("port") or 22)
        except (TypeError, ValueError):
            raise OffboxError("destination_invalid", "host / port not valid") from None
        return SftpDestination(str(cfg.get("host") or ""), str(cfg.get("username") or ""), refs["key"], str(cfg.get("host_key") or ""),
                               str(cfg.get("remote_dir") or ""), port, client_factory=sftp_client, secret_store=secret_store)
    return S3Destination(str(cfg.get("endpoint") or ""), str(cfg.get("bucket") or ""), refs["access_key"], refs["secret_key"],
                         str(cfg.get("prefix") if cfg.get("prefix") is not None else "arx-backups"), str(cfg.get("region") or "auto"),
                         client_factory=s3_client, path_style=bool(cfg.get("path_style", True)), secret_store=secret_store)


# ---------------------------------------------------------------- the key and the SWXB format


def key_id(key: bytes) -> str:
    return hashlib.sha256(b"swxb-key-id\x00" + key).hexdigest()[:16]


def load_or_create_key(path: Path, *, create: bool = True) -> bytes:
    """A single key file (phase 1 format: base64 of 32 bytes, mode 0600). The installation uses the keyring
    (services/offbox_keys.py), which imports such a file once."""
    path = Path(path)
    if path.exists():
        try:
            key = base64.b64decode(path.read_text(encoding="ascii").strip(), validate=True)
        except (ValueError, UnicodeDecodeError) as exc:
            raise OffboxError("key_invalid", "the off-box key file is not valid") from exc
        if len(key) != KEY_BYTES:
            raise OffboxError("key_invalid", "the off-box key file is not valid")
        return key
    if not create:
        raise OffboxError("key_missing", "no off-box key")
    path.parent.mkdir(parents=True, exist_ok=True)
    key = secrets.token_bytes(KEY_BYTES)
    fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="ascii") as f:
        f.write(base64.b64encode(key).decode("ascii") + "\n")
    log.info("off-box backup key created (id %s); keep a copy of it outside this machine", key_id(key))
    return key


def default_key_path(data_dir: Path) -> Path:
    return Path(data_dir) / "keys" / KEY_FILE


def _nonce(prefix: bytes, counter: int, final: bool) -> bytes:
    return prefix + (b"\x01" if final else b"\x00") + struct.pack(">I", counter)


def seal_file(src: Path, dst: Path, key: bytes, *, chunk: int = CHUNK) -> dict[str, Any]:
    """Encrypt `src` into `dst` (SWXB v1). Returns {key_id, plain_sha256, plain_bytes, sealed_sha256, sealed_bytes}."""
    if len(key) != KEY_BYTES:
        raise OffboxError("key_invalid", "the key must be 32 bytes")
    if not (1024 <= chunk <= CHUNK):
        raise OffboxError("chunk_invalid", "chunk size out of range")
    prefix = secrets.token_bytes(7)
    header = json.dumps({"alg": ALG, "key_id": key_id(key), "chunk": chunk, "nonce_prefix": base64.b64encode(prefix).decode(),
                         "created_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()}, sort_keys=True).encode()
    aad = hashlib.sha256(header).digest()
    aead = AESGCM(key)
    plain_h, sealed_h = hashlib.sha256(), hashlib.sha256()
    plain_n = 0
    with open(src, "rb") as fin, open(dst, "wb") as fout:
        def w(b: bytes) -> None:
            fout.write(b)
            sealed_h.update(b)

        w(MAGIC + struct.pack(">I", len(header)) + header)
        counter = 0
        cur = fin.read(chunk)
        while True:
            nxt = fin.read(chunk) if len(cur) == chunk else b""
            final = not nxt
            plain_h.update(cur)
            plain_n += len(cur)
            ct = aead.encrypt(_nonce(prefix, counter, final), cur, aad)
            w(struct.pack(">I", len(ct)) + ct)
            if final:
                break
            counter += 1
            cur = nxt
        fout.flush()
        os.fsync(fout.fileno())
    return {"key_id": key_id(key), "plain_sha256": plain_h.hexdigest(), "plain_bytes": plain_n, "sealed_sha256": sealed_h.hexdigest(),
            "sealed_bytes": Path(dst).stat().st_size}


def read_header(f: Any) -> tuple[dict[str, Any], bytes]:
    if f.read(len(MAGIC)) != MAGIC:
        raise OffboxError("sealed_invalid", "not an SWXB v1 file")
    raw_len = f.read(4)
    if len(raw_len) != 4:
        raise OffboxError("sealed_invalid", "truncated header")
    n = struct.unpack(">I", raw_len)[0]
    if not (0 < n <= MAX_HEADER):
        raise OffboxError("sealed_invalid", "header size out of range")
    raw = f.read(n)
    try:
        header = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise OffboxError("sealed_invalid", "header unreadable") from exc
    if not isinstance(header, dict) or header.get("alg") != ALG or not isinstance(header.get("chunk"), int) or not (1024 <= header["chunk"] <= CHUNK):
        raise OffboxError("sealed_invalid", "unsupported header")
    return header, raw


def header_key_id(src: Path) -> str | None:
    with open(src, "rb") as f:
        header, _ = read_header(f)
    kid = header.get("key_id")
    return kid if isinstance(kid, str) else None


def open_file(src: Path, dst: Path, key: bytes | Mapping[str, bytes]) -> dict[str, Any]:
    """Decrypt an SWXB file into `dst` with `key`, or with the key of a keyring ({key id: key}) the header names. Raises
    OffboxError (key_mismatch / sealed_invalid / sealed_damaged) on any problem and removes the partial output. Returns
    {plain_sha256, plain_bytes, key_id}."""
    h = hashlib.sha256()
    n = 0
    try:
        with open(src, "rb") as fin, open(dst, "wb") as fout:
            header, raw = read_header(fin)
            kid = header.get("key_id")
            k = key.get(kid) if isinstance(key, Mapping) else (key if kid == key_id(key) else None)
            if k is None:
                raise OffboxError("key_mismatch", "the file was sealed with a key this installation does not hold")
            try:
                prefix = base64.b64decode(header.get("nonce_prefix") or "", validate=True)
            except ValueError as exc:
                raise OffboxError("sealed_invalid", "nonce prefix unreadable") from exc
            if len(prefix) != 7:
                raise OffboxError("sealed_invalid", "nonce prefix unreadable")
            aad = hashlib.sha256(raw).digest()
            aead = AESGCM(k)
            counter = 0
            while True:
                rl = fin.read(4)
                if len(rl) != 4:
                    raise OffboxError("sealed_damaged", "the file ends before its last record (truncated)")
                ln = struct.unpack(">I", rl)[0]
                if not (16 <= ln <= header["chunk"] + 16):
                    raise OffboxError("sealed_damaged", "record size out of range")
                ct = fin.read(ln)
                if len(ct) != ln:
                    raise OffboxError("sealed_damaged", "the file ends inside a record (truncated)")
                plain = None
                final = False
                for final in (False, True):
                    try:
                        plain = aead.decrypt(_nonce(prefix, counter, final), ct, aad)
                        break
                    except InvalidTag:
                        continue
                if plain is None:
                    raise OffboxError("sealed_damaged", "a record failed authentication (changed, reordered or wrong key)")
                fout.write(plain)
                h.update(plain)
                n += len(plain)
                if final:
                    if fin.read(1):
                        raise OffboxError("sealed_damaged", "data after the last record")
                    break
                counter += 1
    except BaseException:
        Path(dst).unlink(missing_ok=True)
        raise
    return {"plain_sha256": h.hexdigest(), "plain_bytes": n, "key_id": kid}


# ---------------------------------------------------------------- retention


@dataclasses.dataclass(frozen=True)
class RetentionPolicy:
    keep_last: int = 3
    keep_daily: int = 14
    keep_weekly: int = 4
    keep_monthly: int = 6

    def __post_init__(self) -> None:
        vals = (self.keep_last, self.keep_daily, self.keep_weekly, self.keep_monthly)
        if not all(isinstance(v, int) for v in vals) or self.keep_last < 1 or min(vals[1:]) < 0 or max(vals) > 1000:
            raise OffboxError("retention_invalid", "keep_last 1-1000, the others 0-1000")

    def as_dict(self) -> dict[str, int]:
        return dataclasses.asdict(self)

    def plan(self, names: Iterable[str]) -> dict[str, list[str]]:
        """{keep, delete, unmanaged}: unmanaged = names without a time stamp this module can read (never deleted)."""
        stamped: list[tuple[dt.datetime, str]] = []
        unmanaged: list[str] = []
        for n in set(names):
            m = STAMP_RE.search(n)
            t = None
            if m and OBJECT_RE.fullmatch(n):
                try:
                    t = dt.datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
                except ValueError:
                    t = None
            if t is None:
                unmanaged.append(n)
            else:
                stamped.append((t, n))
        stamped.sort(reverse=True)
        keep = {n for _, n in stamped[: self.keep_last]}
        for count, bucket in ((self.keep_daily, lambda t: t.date()), (self.keep_weekly, lambda t: t.isocalendar()[:2]),
                              (self.keep_monthly, lambda t: (t.year, t.month))):
            seen: list[Any] = []
            for t, n in stamped:  # newest first: the newest object of each period stands for it
                b = bucket(t)
                if b in seen:
                    continue
                if len(seen) >= count:
                    break
                seen.append(b)
                keep.add(n)
        return {"keep": sorted(keep), "delete": sorted(n for _, n in stamped if n not in keep), "unmanaged": sorted(unmanaged)}


# ---------------------------------------------------------------- the push


def object_name(archive: Path) -> str:
    return check_name(f"{Path(archive).stem}.zip{SUFFIX}")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(CHUNK), b""):
            h.update(b)
    return h.hexdigest()


_sha256 = sha256_file


def push(archive: Path, dest: Destination, key: bytes, *, policy: RetentionPolicy | None = None, dry_run: bool = False,
         verify: str = "deep", workdir: Path | None = None) -> dict[str, Any]:
    """Seal `archive`, upload it, verify the uploaded copy, then prune per `policy`. `dry_run`: list + plan only, nothing written
    anywhere. `verify`: deep | hash (`none` is refused - an unverified copy is not a backup). Never raises for a destination or
    verification problem: the answer says `ok: false` with the `error` code; nothing is pruned unless the new copy verified."""
    if verify not in ("deep", "hash"):
        raise OffboxError("verify_invalid", "verify must be deep | hash")
    policy = policy or RetentionPolicy()
    archive = Path(archive)
    name = object_name(archive)
    t0 = time.monotonic()
    timings: dict[str, int] = {}

    def lap(phase: str, since: float) -> None:
        timings[phase] = int(round((time.monotonic() - since) * 1000))

    out: dict[str, Any] = {"ok": False, "dry_run": dry_run, "object": name, "destination": dest.describe(), "verify": verify,
                           "uploaded": False, "verified": False, "deleted": [], "error": None, "timings_ms": timings}

    def fail(code: str, message: str) -> dict[str, Any]:
        out["error"] = code
        out["message"] = message[:200]
        if out["uploaded"] and not out["verified"]:  # a copy that does not read back is removed, never left to look like a backup
            try:
                dest.delete(name)
                out["bad_copy_removed"] = True
            except Exception:  # noqa: BLE001
                out["bad_copy_removed"] = False
        log.warning("off-box backup %s: %s", name, code)
        return out

    try:
        if not archive.is_file():
            raise OffboxError("archive_missing", "the archive does not exist")
        t = time.monotonic()
        existing = [o.name for o in dest.list()]
        lap("list", t)
        plan = policy.plan([*existing, name])
        out["plan"] = {"upload": {"name": name, "plain_bytes": archive.stat().st_size, "replaces_existing": name in existing}, **plan}
        if dry_run:
            out["ok"] = True
            return out
        with tempfile.TemporaryDirectory(dir=str(workdir) if workdir else None) as tmp:
            sealed = Path(tmp) / name
            t = time.monotonic()
            info = seal_file(archive, sealed, key)
            lap("seal", t)
            out["sealed"] = {k: info[k] for k in ("key_id", "plain_bytes", "sealed_bytes", "sealed_sha256", "plain_sha256")}
            t = time.monotonic()
            dest.put(sealed, name)
            lap("upload", t)
            out["uploaded"] = True
            t = time.monotonic()
            back = Path(tmp) / "verify.swxb"
            dest.get(name, back)
            if sha256_file(back) != info["sealed_sha256"]:
                raise OffboxError("verify_hash_mismatch", "the uploaded copy differs from what was sent")
            if verify == "deep":
                opened = open_file(back, Path(tmp) / "verify.zip", key)
                if opened["plain_sha256"] != info["plain_sha256"]:
                    raise OffboxError("verify_plain_mismatch", "the decrypted copy differs from the archive")
            lap("verify", t)
            out["verified"] = True
        t = time.monotonic()
        for victim in plan["delete"]:
            if victim == name:
                continue
            dest.delete(victim)
            out["deleted"].append(victim)
        lap("prune", t)
        out["ok"] = True
        return out
    except OffboxError as exc:
        return fail(exc.code, str(exc))
    except OSError as exc:
        return fail("io_error", type(exc).__name__)
    except Exception as exc:  # noqa: BLE001 - a transport library's own error: named by type only (never its text: it may echo a URL)
        return fail("transport_error", type(exc).__name__)
    finally:
        timings["total"] = int(round((time.monotonic() - t0) * 1000))


def check_connection(dest: Destination, *, workdir: Path | None = None) -> dict[str, Any]:
    """Write a tiny marker object, read it back, compare, delete it, then list. Returns {ok, steps, error, timings_ms}; never raises."""
    t0 = time.monotonic()
    name = new_marker_name()
    payload = f"arx off-box connection test {name}\n".encode()
    steps: list[str] = []
    out: dict[str, Any] = {"ok": False, "steps": steps, "error": None, "destination": dest.describe()}
    written = False
    try:
        with tempfile.TemporaryDirectory(dir=str(workdir) if workdir else None) as tmp:
            src = Path(tmp) / "marker.txt"
            src.write_bytes(payload)
            dest.put(src, name)
            written = True
            steps.append("write")
            back = Path(tmp) / "back.txt"
            dest.get(name, back)
            if back.read_bytes() != payload:
                raise OffboxError("verify_hash_mismatch", "the marker read back differs")
            steps.append("read")
            dest.delete(name)
            written = False
            steps.append("delete")
            out["objects"] = len(dest.list())
            steps.append("list")
        out["ok"] = True
    except OffboxError as exc:
        out["error"] = exc.code
    except OSError as exc:
        out["error"] = "io_error"
        out["detail"] = type(exc).__name__
    except Exception as exc:  # noqa: BLE001
        out["error"] = "transport_error"
        out["detail"] = type(exc).__name__
    finally:
        if written:
            try:
                dest.delete(name)
            except Exception:  # noqa: BLE001
                pass
        out["timings_ms"] = {"total": int(round((time.monotonic() - t0) * 1000))}
    return out
