"""USR2 section 6: passwords of Arx-only (local) identities - hashing, the policy and the local denylist.

Hashing
- The stored value is a PHC-style string whose prefix names the algorithm, so a later switch needs no migration:
  `$scrypt$ln=17,r=8,p=1$<salt b64>$<hash b64>` (hashlib, no new dependency) or `$argon2id$v=19$m=...` (argon2-cffi).
- The ACTIVE algorithm is scrypt. argon2id (the spec's first choice) is used only when the `argon2` module can be imported AND
  `PREFER_ARGON2` is on; that the argon2-cffi wheels exist for the add-on image (Alpine 3.22, musl, amd64 + aarch64) was NOT
  verified, so the dependency is not added and `PREFER_ARGON2` is off. A row hashed with argon2id still verifies when the
  library is present (and is refused - never a crash - when it is not).
- Profiles (params_version): 1 = scrypt N=2^17, r=8, p=1 (128 MiB, ~0.3-0.6 s on one core); 2 = the low-memory profile N=2^16
  (64 MiB), chosen automatically when the container's memory limit is below 1 GiB (/sys/fs/cgroup/memory.max). Hash and verify
  run behind a semaphore of 2, so an attacker can make the server hold at most two such computations at once; a third waits.
- `needs_rehash` is checked on every successful sign-in: an older profile is re-hashed with the current one.
- No pepper (USR2 6.1: a key file is excluded from backups, so a restore to a new host would lock every local user out).
- `verify_dummy` runs the current profile against a fixed hash so an unknown username costs the same time as a known one.

Policy (NIST SP 800-63B style, no composition rules)
- NFKC, leading / trailing whitespace stripped, length >= `security.local_password_min` (12; 10-64) and <= 128 characters, and at
  most 128 bytes in UTF-8 (the cap applies before hashing).
- Refused classes: `too_short`, `too_long`, `common` (the bundled denylist, assets/denylist/, plus <data>/denylist/*.txt),
  `contextual` (username, display-name words, smplwise / arx, site names, "password" / "סיסמה"), `repeated` (one or two
  distinct characters, or a keyboard / alphabet / digit run). A refusal names the class only; the password is never echoed,
  logged or audited.
"""
from __future__ import annotations

import asyncio
import base64
import contextvars
import functools
import hashlib
import hmac
import secrets
import threading
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, TypeVar

T = TypeVar("T")

MAX_CHARS = 128
MAX_BYTES = 128
MIN_DEFAULT = 12
MIN_ALLOWED = (10, 64)

PREFER_ARGON2 = False  # NOT_VERIFIED: argon2-cffi wheels for the add-on image (see the module docstring)


@dataclass(frozen=True)
class Profile:
    version: int
    log_n: int
    r: int
    p: int

    @property
    def maxmem(self) -> int:
        return 128 * (1 << self.log_n) * self.r * self.p + 16 * 1024 * 1024


PROFILES: dict[int, Profile] = {1: Profile(1, 17, 8, 1), 2: Profile(2, 16, 8, 1)}
_SEM = threading.BoundedSemaphore(2)
_profile_override: Profile | None = None  # tests only (a fast profile); never set by production code

# USR2-FIX F5: the most a stored PHC string may ask for. Anything above the shipped profiles (scrypt N=2^17, r=8, p=1 -> 128 MiB)
# is refused as a verification failure, never computed - a tampered database row or restored archive cannot make the add-on
# allocate gigabytes.
MAX_SCRYPT_LOG_N = 17
MAX_SCRYPT_R = 8
MAX_SCRYPT_P = 1
MAX_MAXMEM = 160 * 1024 * 1024
MAX_ARGON2_M_KIB = 128 * 1024
MAX_ARGON2_T = 10
MAX_ARGON2_P = 4


# ---------------------------------------------------------------- USR2-FIX F3: bounded admission + a dedicated hashing executor

HASH_THREADS = 2
MAX_WAITERS = 8


class Admission:
    """A bounded waiting room in front of the public hashing routes: at most `limit` requests are in flight (HASH_THREADS
    computing + MAX_WAITERS queued). Beyond it the route answers the uniform 429 `rate_limited` + Retry-After WITHOUT hashing and
    for every username alike, so a sign-in storm can never park the shared worker threads of the rest of the add-on."""

    def __init__(self, limit: int) -> None:
        self.limit = limit
        self._n = 0
        self._lock = threading.Lock()

    def try_enter(self) -> bool:
        with self._lock:
            if self._n >= self.limit:
                return False
            self._n += 1
            return True

    def leave(self) -> None:
        with self._lock:
            self._n = max(0, self._n - 1)

    @property
    def in_flight(self) -> int:
        with self._lock:
            return self._n


ADMISSION = Admission(HASH_THREADS + MAX_WAITERS)
_executor: "ThreadPoolExecutor | None" = None
_executor_lock = threading.Lock()


def executor() -> "ThreadPoolExecutor":
    """The dedicated pool (HASH_THREADS threads, named `arx-hash`) the public routes run their blocking work in - never the shared
    pool of the other routes."""
    global _executor
    with _executor_lock:
        if _executor is None:
            _executor = ThreadPoolExecutor(max_workers=HASH_THREADS, thread_name_prefix="arx-hash")
        return _executor


async def run_admitted(fn: Callable[..., T], *args: Any) -> tuple[bool, T | None]:
    """(False, None) when the waiting room is full (answer 429 at once); else (True, fn(*args)) computed in the dedicated pool and
    awaited on the event loop (the caller's context variables travel with it)."""
    if not ADMISSION.try_enter():
        return False, None
    try:
        ctx = contextvars.copy_context()
        loop = asyncio.get_running_loop()
        return True, await loop.run_in_executor(executor(), functools.partial(ctx.run, fn, *args))
    finally:
        ADMISSION.leave()


def _cgroup_memory_bytes() -> int | None:
    for path in ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"):
        try:
            raw = Path(path).read_text(encoding="ascii").strip()
        except OSError:
            continue
        if raw.isdigit():
            return int(raw)
    return None


def current_profile() -> Profile:
    if _profile_override is not None:
        return _profile_override
    limit = _cgroup_memory_bytes()
    return PROFILES[2] if limit is not None and limit < (1 << 30) else PROFILES[1]


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii").rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.b64decode(text + "=" * (-len(text) % 4))


def normalize(password: str) -> str:
    return unicodedata.normalize("NFKC", password or "").strip()


def _scrypt(secret: bytes, salt: bytes, prof: Profile) -> bytes:
    return hashlib.scrypt(secret, salt=salt, n=1 << prof.log_n, r=prof.r, p=prof.p, dklen=32, maxmem=prof.maxmem)


def hash_password(password: str) -> tuple[str, int]:
    """(PHC string, params_version) of a password that already passed the policy. Never logs anything."""
    prof = current_profile()
    secret = normalize(password).encode("utf-8")
    salt = secrets.token_bytes(16)
    with _SEM:
        digest = _scrypt(secret, salt, prof)
    return f"$scrypt$ln={prof.log_n},r={prof.r},p={prof.p}${_b64(salt)}${_b64(digest)}", prof.version


def _parse_scrypt(phc: str) -> tuple[Profile, bytes, bytes] | None:
    parts = phc.split("$")
    if len(parts) != 5 or parts[1] != "scrypt":
        return None
    try:
        kv = dict(item.split("=", 1) for item in parts[2].split(","))
        log_n, r, p = int(kv["ln"]), int(kv["r"]), int(kv["p"])
        if not (10 <= log_n <= MAX_SCRYPT_LOG_N and 1 <= r <= MAX_SCRYPT_R and 1 <= p <= MAX_SCRYPT_P):
            return None
        prof = Profile(0, log_n, r, p)
        if prof.maxmem > MAX_MAXMEM:
            return None
        salt, want = _unb64(parts[3]), _unb64(parts[4])
        if not (8 <= len(salt) <= 64 and len(want) == 32):
            return None
        return prof, salt, want
    except (KeyError, ValueError, TypeError):  # binascii.Error is a ValueError
        return None


def _argon2_params_ok(phc: str) -> bool:
    """`$argon2id$v=19$m=65536,t=3,p=4$...`: m (KiB), t and p within the maxima; anything unreadable is refused."""
    parts = phc.split("$")
    if len(parts) != 6 or parts[1] not in ("argon2id", "argon2i", "argon2d"):
        return False
    try:
        kv = dict(item.split("=", 1) for item in parts[3].split(","))
        m, t, p = int(kv["m"]), int(kv["t"]), int(kv["p"])
    except (KeyError, ValueError):
        return False
    return 8 <= m <= MAX_ARGON2_M_KIB and 1 <= t <= MAX_ARGON2_T and 1 <= p <= MAX_ARGON2_P


def verify(password: str, phc: str | None) -> bool:
    """Constant-time comparison of a candidate with a stored PHC string. False for anything unreadable or unknown; never raises."""
    if not phc or not isinstance(password, str):
        return False
    secret = normalize(password).encode("utf-8")
    if len(secret) > MAX_BYTES:
        return False
    if phc.startswith("$scrypt$"):
        parsed = _parse_scrypt(phc)
        if parsed is None:
            return False
        prof, salt, want = parsed
        try:
            with _SEM:
                got = _scrypt(secret, salt, prof)
        except (ValueError, MemoryError, OSError):  # USR2-FIX F5: an unusable stored row is a failed verification, never a crash
            return False
        return hmac.compare_digest(got, want)
    if phc.startswith("$argon2"):
        if not _argon2_params_ok(phc):
            return False
        try:
            from argon2 import PasswordHasher  # type: ignore[import-not-found]
            from argon2.exceptions import VerificationError, InvalidHashError  # type: ignore[import-not-found]
        except ImportError:
            return False
        try:
            with _SEM:
                return bool(PasswordHasher().verify(phc, secret))
        except (VerificationError, InvalidHashError, ValueError, MemoryError, OSError):
            return False
    return False


def needs_rehash(phc: str | None, params_version: int) -> bool:
    if not phc:
        return False
    return not phc.startswith("$scrypt$") or params_version != current_profile().version


_dummy: dict[int, str] = {}
_dummy_lock = threading.Lock()


def ensure_dummy() -> str:
    """The fixed dummy hash of the current profile, made once per process. Every sign-in calls this BEFORE it looks the name up, so
    the one-time cost of making it never tells a first unknown name from a first known one."""
    prof = current_profile()
    with _dummy_lock:
        phc = _dummy.get(prof.version)
        if phc is None:
            phc = _dummy[prof.version] = hash_password(secrets.token_urlsafe(24))[0]
    return phc


def verify_dummy(password: str) -> bool:
    """The timing twin of `verify` for an unknown / unusable account: the same profile, a fixed random hash. Always False."""
    verify(password if isinstance(password, str) else "", ensure_dummy())
    return False


# ---------------------------------------------------------------- policy

_SUBST = str.maketrans({"@": "a", "4": "a", "0": "o", "1": "l", "!": "i", "3": "e", "5": "s", "$": "s", "7": "t", "+": "t"})
_RUNS = ("0123456789" * 3, "abcdefghijklmnopqrstuvwxyz" * 2, "qwertyuiop" * 3, "asdfghjkl" * 3, "zxcvbnm" * 3,
         "qwertyuiopasdfghjklzxcvbnm", "1qaz2wsx3edc4rfv5tgb", "qazwsxedcrfvtgbyhnujmikolp", "azertyuiop" * 3, "qwertzuiop" * 3,
         "קראטוןםפשדגכעיחלךףזסבהנמצתץ" * 2)
_ASSET = Path(__file__).resolve().parents[1] / "assets" / "denylist" / "common_passwords.txt"
_lists: dict[str, frozenset[str]] = {}
_lists_lock = threading.Lock()


def _read_list(path: Path) -> set[str]:
    out: set[str] = set()
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            word = line.strip().casefold()
            if word and not word.startswith("#"):
                out.add(word)
    except OSError:
        pass
    return out


def common_words(data_dir: Path | None = None) -> frozenset[str]:
    key = str(data_dir or "")
    with _lists_lock:
        cached = _lists.get(key)
        if cached is not None:
            return cached
        words = _read_list(_ASSET)
        if data_dir is not None:
            extra = Path(data_dir) / "denylist"
            if extra.is_dir():
                for f in sorted(extra.glob("*.txt"))[:20]:
                    words |= _read_list(f)
        _lists[key] = frozenset(words)
        return _lists[key]


def _base(candidate: str) -> str:
    """lower-case, character substitutions, then trailing digits / punctuation / whitespace stripped (and leading ones)."""
    low = candidate.casefold()
    stripped = low.rstrip("0123456789!?.@#$%^&*_-+= ").lstrip("0123456789!?.@#$%^&*_-+= ")
    return stripped.translate(_SUBST)


def _is_run(text: str) -> bool:
    if len(text) < 4:
        return False
    for run in _RUNS:
        if text in run or text in run[::-1]:
            return True
    return False


def check_policy(password: str, *, min_length: int = MIN_DEFAULT, context: Iterable[str] = (), data_dir: Path | None = None) -> str | None:
    """None when the password may be set, else the refused class: too_short | too_long | common | contextual | repeated."""
    if not isinstance(password, str):
        return "too_short"
    pw = normalize(password)
    lo, hi = MIN_ALLOWED
    min_length = max(lo, min(hi, int(min_length or MIN_DEFAULT)))
    if len(pw) < min_length:
        return "too_short"
    if len(pw) > MAX_CHARS or len(pw.encode("utf-8")) > MAX_BYTES:
        return "too_long"
    low = pw.casefold()
    compact = "".join(ch for ch in low if not ch.isspace())
    if len(set(compact)) <= 2 or _is_run(compact) or _is_run(compact.translate(_SUBST)):
        return "repeated"
    words = common_words(data_dir)
    base = _base(compact)
    if base in words or compact in words or compact.translate(_SUBST) in words:
        return "common"
    # a password made of repeats of a common word ("passwordpassword")
    for w in words if base else ():
        if len(w) >= 4 and base.replace(w, "") == "":
            return "common"
    fixed = {"smplwise", "arx", "password", "סיסמה", "סיסמא", "homeassistant"}
    ctx = {c.casefold().strip() for c in context if c and len(c.strip()) >= 3} | fixed
    if base in ctx or compact in ctx:
        return "contextual"
    # a context word plus little else ("dana12345678", "Arx-2026-arx!"): what is left after removing every context word must
    # still carry some letters of its own
    rest = compact
    hit = False
    for word in sorted(ctx, key=len, reverse=True):
        if len(word) >= 3 and word in rest:
            rest = rest.replace(word, "")
            hit = True
        elif len(word) >= 3 and word.translate(_SUBST) in rest.translate(_SUBST):
            hit = True
            rest = rest.translate(_SUBST).replace(word.translate(_SUBST), "")
    if hit:
        leftover = "".join(ch for ch in rest if ch.isalpha())
        if len(leftover) < 4 or (len(leftover) < 6 and (len(set(leftover)) <= 2 or _is_run(leftover))):
            return "contextual"
    return None


def reset_for_tests() -> None:
    global _profile_override
    _profile_override = None
    with _dummy_lock:
        _dummy.clear()
    with _lists_lock:
        _lists.clear()
