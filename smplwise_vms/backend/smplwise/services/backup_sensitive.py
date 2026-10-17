"""The encrypted sensitive section of a project backup (BACKUP-HASH-ENC, owner decision 2026-10-17).

What it holds - the rows of an archive that would let a reader attack an account or forge a signed reference:
- `auth_local_credentials.password_hash` (the Arx-only identities' scrypt / argon2id PHC strings, USR2 owner answer Q8);
- the settings rows in SENSITIVE_SETTINGS (`multimedia.item_secret`: the HMAC key of the media item refs the administrator's
  curation names; `multimedia.cast.secret`: the HMAC key of the cast tokens).

Rules:
- The section travels ONLY encrypted: AES-256-GCM (the pinned `cryptography`) under a key derived with scrypt (N=2^17, r=8,
  p=1, a fresh 16-byte salt, both in the header) from a backup password the administrator types at export time. The header
  lives in the manifest (`sensitive`) and is authenticated as the AEAD's associated data together with the archive's
  `created_at` / `schema_version` / `format`: a changed header, a section moved from another archive, a truncated or edited
  ciphertext all fail the tag. The tag check is the only password check (constant time inside the AEAD; no verifier is stored).
- An export without a password OMITS the section (never plaintext); the manifest says `state: omitted` with the counts.
- An archive with a `sensitive` header never contributes a plaintext hash or sensitive setting from its data files
  (`strip_plaintext`, the downgrade guard). An archive WITHOUT the header (written before this rule) still imports its plaintext
  hashes; the restore answer flags it (`legacy_plaintext`).
- Bounded work: the header is validated before any key derivation (scrypt cost capped at what this build writes), the
  ciphertext member is size-capped before it is read, and one derivation runs at a time.
- The password and the derived key are never logged, audited, stored or returned; they live in local variables only."""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import os
import threading
import unicodedata
from dataclasses import dataclass
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VERSION = 1
MEMBER = "secure/sensitive.bin"
AEAD_NAME = "AES-256-GCM"
CONTEXT = b"smplwise-arx-backup-sensitive/v1\x00"
HASH_TABLE, HASH_COLUMN = "auth_local_credentials", "password_hash"
# the columns that describe the hash; a row restored without its hash takes them from the same source as the hash
HASH_COMPANIONS = ("params_version", "set_at", "set_by", "must_change")
SENSITIVE_SETTINGS = frozenset({"multimedia.item_secret", "multimedia.cast.secret"})
PASSWORD_MIN_CHARS = 12
PASSWORD_MAX_BYTES = 1024
MAX_BLOB = 8 * 1024 * 1024  # the ciphertext member: a few thousand PHC strings are a few hundred KiB
MAX_PHC = 512
SALT_BYTES, NONCE_BYTES, KEY_BYTES = 16, 12, 32


@dataclass(frozen=True)
class Kdf:
    log_n: int = 17
    r: int = 8
    p: int = 1

    @property
    def maxmem(self) -> int:
        return 128 * self.r * (1 << self.log_n) + 16 * 1024 * 1024


KDF = Kdf()
KDF_LOG_N_RANGE = (10, 17)  # import refuses anything costlier than this build writes (bounded memory: 128 MiB + slack)
_kdf_override: Kdf | None = None  # tests only: cheap derivation
_DERIVE = threading.BoundedSemaphore(1)  # one 128 MiB derivation at a time


class SensitiveError(Exception):
    """A refusal about the sensitive section. `code` is the API code; the message never carries the password."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _b64e(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _b64d(s: Any, n: int) -> bytes:
    if not isinstance(s, str) or len(s) > 64:
        raise SensitiveError("backup_sensitive_invalid", "the archive's sensitive section header is malformed")
    try:
        raw = base64.b64decode(s, validate=True)
    except (binascii.Error, ValueError):
        raise SensitiveError("backup_sensitive_invalid", "the archive's sensitive section header is malformed") from None
    if len(raw) != n:
        raise SensitiveError("backup_sensitive_invalid", "the archive's sensitive section header is malformed")
    return raw


def password_bytes(password: str | None) -> bytes:
    """The backup password as key-derivation input: NFKC like the account passwords, NOT stripped (every typed character
    counts). Raises `backup_password_weak` / `backup_password_too_long`."""
    if not isinstance(password, str):
        raise SensitiveError("backup_password_required", "a backup password is required")
    norm = unicodedata.normalize("NFKC", password)
    raw = norm.encode("utf-8")
    if len(raw) > PASSWORD_MAX_BYTES:
        raise SensitiveError("backup_password_too_long", "the backup password is too long")
    if len(norm) < PASSWORD_MIN_CHARS or not norm.strip():
        raise SensitiveError("backup_password_weak", f"the backup password needs at least {PASSWORD_MIN_CHARS} characters")
    return raw


def _derive(pw: bytes, salt: bytes, kdf: Kdf) -> bytes:
    with _DERIVE:
        return hashlib.scrypt(pw, salt=salt, n=1 << kdf.log_n, r=kdf.r, p=kdf.p, dklen=KEY_BYTES, maxmem=kdf.maxmem)


def _aad(header: dict[str, Any], binding: dict[str, Any]) -> bytes:
    body = {"header": header, "archive": binding}
    return CONTEXT + json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")


def binding_of(manifest: dict[str, Any]) -> dict[str, Any]:
    """The archive fields the section is bound to (part of the associated data)."""
    return {"format": manifest.get("format"), "created_at": manifest.get("created_at"), "schema_version": manifest.get("schema_version")}


# ---------------------------------------------------------------- export side


def split(data: dict[str, list[dict[str, Any]]]) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """A copy of `data` without the sensitive values, and the payload holding them ({password_hashes: {user_id: phc},
    settings: {key: value}}). `data` itself is not changed."""
    out = dict(data)
    hashes: dict[str, str] = {}
    if HASH_TABLE in data:
        rows = []
        for r in data[HASH_TABLE]:
            r = dict(r)
            h = r.pop(HASH_COLUMN, None)
            if isinstance(h, str) and h and isinstance(r.get("user_id"), str):
                hashes[r["user_id"]] = h
            rows.append(r)
        out[HASH_TABLE] = rows
    secrets_: dict[str, str] = {}
    if "settings" in data:
        keep = []
        for r in data["settings"]:
            if r.get("key") in SENSITIVE_SETTINGS:
                if isinstance(r.get("value"), str):
                    secrets_[r["key"]] = r["value"]
            else:
                keep.append(r)
        out["settings"] = keep
    return out, {"password_hashes": hashes, "settings": secrets_}


def counts(payload: dict[str, Any]) -> dict[str, int]:
    return {"password_hashes": len(payload.get("password_hashes") or {}), "settings": len(payload.get("settings") or {})}


def omitted_header(payload: dict[str, Any]) -> dict[str, Any]:
    return {"v": VERSION, "state": "omitted", "counts": counts(payload)}


def seal(payload: dict[str, Any], password: str, binding: dict[str, Any]) -> tuple[dict[str, Any], bytes]:
    """Encrypt the payload. Returns (manifest header, ciphertext member bytes)."""
    pw = password_bytes(password)
    kdf = _kdf_override or KDF
    salt, nonce = os.urandom(SALT_BYTES), os.urandom(NONCE_BYTES)
    header = {"v": VERSION, "state": "encrypted", "id": os.urandom(16).hex(), "aead": AEAD_NAME,
              "kdf": {"name": "scrypt", "ln": kdf.log_n, "r": kdf.r, "p": kdf.p, "salt": _b64e(salt)},
              "nonce": _b64e(nonce), "member": MEMBER, "counts": counts(payload)}
    plain = json.dumps({"v": VERSION, **payload}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    key = _derive(pw, salt, kdf)
    try:
        blob = AESGCM(key).encrypt(nonce, plain, _aad(header, binding))
    finally:
        del key
    return header, blob


# ---------------------------------------------------------------- import side


def state_of(manifest: dict[str, Any], names: set[str]) -> str:
    """`encrypted` | `omitted` | `legacy` (no header: an archive written before this rule). Raises on an inconsistent archive:
    a malformed header, or a ciphertext member that its header does not announce (a section whose header was removed is a
    downgrade attempt, never a legacy archive)."""
    if "sensitive" not in manifest:
        if MEMBER in names:
            raise SensitiveError("backup_sensitive_invalid", "the archive holds an encrypted section without its header")
        return "legacy"
    h = manifest["sensitive"]
    if not isinstance(h, dict) or h.get("v") != VERSION or h.get("state") not in ("encrypted", "omitted"):
        raise SensitiveError("backup_sensitive_invalid", "the archive's sensitive section header is malformed")
    if h["state"] == "omitted" and MEMBER in names:
        raise SensitiveError("backup_sensitive_invalid", "the archive holds an encrypted section its header says was omitted")
    return h["state"]


def check_header(h: dict[str, Any]) -> tuple[Kdf, bytes, bytes]:
    kdf = h.get("kdf")
    if (h.get("aead") != AEAD_NAME or h.get("member") != MEMBER or not isinstance(kdf, dict) or kdf.get("name") != "scrypt"
            or not all(isinstance(kdf.get(k), int) and not isinstance(kdf.get(k), bool) for k in ("ln", "r", "p"))):
        raise SensitiveError("backup_sensitive_invalid", "the archive's sensitive section header is malformed")
    lo, hi = KDF_LOG_N_RANGE
    if not (lo <= kdf["ln"] <= hi) or kdf["r"] != 8 or kdf["p"] not in (1, 2):
        raise SensitiveError("backup_sensitive_invalid", "the archive's key-derivation settings are outside the accepted range")
    return Kdf(kdf["ln"], kdf["r"], kdf["p"]), _b64d(kdf.get("salt"), SALT_BYTES), _b64d(h.get("nonce"), NONCE_BYTES)


def read_member(z: Any) -> bytes:
    """The ciphertext member, size-capped before it is read (a declared size is a hard bound for zipfile)."""
    try:
        info = z.getinfo(MEMBER)
    except KeyError:
        raise SensitiveError("backup_sensitive_damaged", "the archive's encrypted section is missing (truncated archive)") from None
    if info.file_size > MAX_BLOB or info.file_size < 16:
        raise SensitiveError("backup_sensitive_damaged", "the archive's encrypted section has an impossible size")
    with z.open(info) as f:
        blob = f.read(MAX_BLOB + 1)
    if len(blob) != info.file_size:
        raise SensitiveError("backup_sensitive_damaged", "the archive's encrypted section is truncated")
    return blob


def unseal(header: dict[str, Any], blob: bytes, password: str | None, binding: dict[str, Any]) -> dict[str, Any]:
    """Decrypt and validate the payload. A wrong password and a changed archive are the same refusal (the tag cannot tell
    them apart): `backup_password_wrong`."""
    kdf, salt, nonce = check_header(header)
    if password is None or password == "":
        raise SensitiveError("backup_password_required", "this archive's local account passwords are encrypted; type the backup password")
    try:
        pw = password_bytes(password)
    except SensitiveError as exc:
        if exc.code == "backup_password_too_long":
            raise
        pw = unicodedata.normalize("NFKC", password).encode("utf-8")  # a short guess simply fails the tag like any wrong one
    key = _derive(pw, salt, kdf)
    try:
        plain = AESGCM(key).decrypt(nonce, blob, _aad(header, binding))
    except InvalidTag:
        raise SensitiveError("backup_password_wrong", "wrong backup password, or the archive was changed") from None
    finally:
        del key
    try:
        doc = json.loads(plain.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise SensitiveError("backup_sensitive_damaged", "the archive's encrypted section is malformed") from None
    return _validate_payload(doc)


def _validate_payload(doc: Any) -> dict[str, Any]:
    bad = SensitiveError("backup_sensitive_damaged", "the archive's encrypted section is malformed")
    if not isinstance(doc, dict) or doc.get("v") != VERSION:
        raise bad
    hashes, sett = doc.get("password_hashes"), doc.get("settings")
    if not isinstance(hashes, dict) or not isinstance(sett, dict):
        raise bad
    out_h: dict[str, str] = {}
    for uid, phc in hashes.items():
        if not (isinstance(uid, str) and 0 < len(uid) <= 128 and isinstance(phc, str) and 0 < len(phc) <= MAX_PHC
                and (phc.startswith("$scrypt$") or phc.startswith("$argon2id$"))):
            raise bad
        out_h[uid] = phc
    out_s: dict[str, str] = {}
    for k, v in sett.items():
        if k not in SENSITIVE_SETTINGS or not isinstance(v, str) or len(v) > 256:
            raise bad
        out_s[k] = v
    return {"password_hashes": out_h, "settings": out_s}


def strip_plaintext(data: dict[str, list[dict[str, Any]]]) -> int:
    """In place: drop every plaintext hash and sensitive setting from an archive that has a `sensitive` header (they can only be
    there if someone edited it - a downgrade attempt). Returns how many values were dropped."""
    n = 0
    for r in data.get(HASH_TABLE) or []:
        if isinstance(r, dict) and HASH_COLUMN in r:
            if r.pop(HASH_COLUMN) is not None:
                n += 1
            for c in HASH_COMPANIONS:
                r.pop(c, None)
    if "settings" in data:
        before = len(data["settings"])
        data["settings"] = [r for r in data["settings"] if not (isinstance(r, dict) and r.get("key") in SENSITIVE_SETTINGS)]
        n += before - len(data["settings"])
    return n


def merge_into(data: dict[str, list[dict[str, Any]]], payload: dict[str, Any]) -> int:
    """In place: put the decrypted hashes back on the archive's own credential rows (a hash for a user the archive has no row
    for is dropped) and the sensitive settings back into its settings rows. Returns the number of hashes placed."""
    hashes = payload.get("password_hashes") or {}
    n = 0
    for r in data.get(HASH_TABLE) or []:
        if isinstance(r, dict) and r.get("user_id") in hashes:
            r[HASH_COLUMN] = hashes[r["user_id"]]
            n += 1
    sett = payload.get("settings") or {}
    if sett and "settings" in data:
        data["settings"] = [r for r in data["settings"] if not (isinstance(r, dict) and r.get("key") in SENSITIVE_SETTINGS)]
        data["settings"].extend({"key": k, "value": v} for k, v in sett.items())
    return n
