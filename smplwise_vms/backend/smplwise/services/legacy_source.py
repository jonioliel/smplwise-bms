"""LEGACY-MIGRATION-2550 (T070): the reader of what the legacy "Hikvision NVR Panel" add-on (v1.5.27) kept, from COPIES that an
administrator hands over. Standard library only: scripts/migrate_legacy.py loads this file on a workstation too.

What the legacy add-on persists (legacy source, app/main.py and the Dockerfile's run.sh; docs/legacy/LEGACY_AUDIT.md):

- its add-on options (the Supervisor's `/data/options.json`): NVR host / ports / user / password, the shared PIN and the technician
  PIN, PIN length, session minutes, snapshot interval, go2rtc URL and Ingress path, log level, event-search debug;
- its override document in the Home Assistant configuration folder: NVR connection overrides (they win over the options), the
  camera display names `camera_names` (channel -> name), the recording display offset (`recording_display_offset_mode` /
  `_direction` / `_minutes`) and the running manual recordings (`manual_recording` rows with an auto-stop instant);
- its local event store (JSON lines with `storedAt`, at most 4,000 rows; the events screen was switched off in production);
- nothing else: the live grid's screen count and camera choice live in page memory only, the theme in the browser's storage.

Accepted inputs (one upload or one file; nothing is extracted to disk, every member is read with a size cap):

- a JSON document: the options, the override, a combined `{"options": ..., "override": ...}` object, the add-on's `addon.json`, or
  this module's own export (`smplwise-legacy-export/1`, written by `scripts/migrate_legacy.py --export`, secret-free);
- a JSON-lines event store;
- a ZIP or a TAR (plain or gzip) holding any of those files under any name - each JSON member is recognised by its CONTENT
  (the keys it holds), never by its file name, so a renamed copy is read the same way;
- an UNPROTECTED Home Assistant backup (an outer TAR with `backup.json`, the legacy add-on's inner archive and the configuration
  folder's inner archive). A protected (encrypted) backup is refused with its own reason: hand over the loose files instead.

What the reader keeps (`LegacySource`) is secret-free by construction: every password / PIN / token value is reduced to
set / empty while it is read, and the NVR host and the go2rtc URL are reduced to a salted digest (compared with Arx's own, never
shown). Nothing in here writes, and nothing reaches the network."""
from __future__ import annotations

import datetime as dt
import gzip
import hashlib
import io
import json
import tarfile
import zipfile
import zlib
from dataclasses import asdict, dataclass, field
from typing import Any

EXPORT_FORMAT = "smplwise-legacy-export/1"
LEGACY_VERSION_KNOWN = "1.5.27"

MAX_INPUT_BYTES = 20 * 1024 * 1024  # one upload (the API); the workstation script passes its own, larger limit for a full backup
MAX_MEMBER_BYTES = 8 * 1024 * 1024  # one JSON / JSON-lines member, decompressed
MAX_TOTAL_READ = 64 * 1024 * 1024  # every candidate member together, decompressed
MAX_MEMBERS = 50_000  # members looked at in one archive (a configuration folder can hold thousands)
MAX_EVENT_ROWS = 20_000  # the legacy keeps 4,000; more is not this add-on's store

# the legacy add-on's option keys (config.yaml schema of 1.5.27)
OPTION_KEYS = ("nvr_ip", "nvr_port", "nvr_rtsp_port", "nvr_user", "nvr_password", "app_pin", "technician_pin", "pin_length",
               "session_minutes", "snapshot_seconds", "go2rtc_url", "go2rtc_ingress_path", "log_level", "event_search_debug")
# options only the add-on options carry (an override never does): they tell an options document from an override
OPTIONS_ONLY_KEYS = frozenset({"app_pin", "technician_pin", "pin_length", "session_minutes", "snapshot_seconds", "go2rtc_url",
                               "go2rtc_ingress_path", "log_level", "event_search_debug"})
NVR_KEYS = frozenset({"nvr_ip", "nvr_port", "nvr_rtsp_port", "nvr_user", "nvr_password"})
OVERRIDE_KEYS = frozenset({"camera_names", "manual_recording", "recording_display_offset_mode", "recording_display_offset_direction",
                           "recording_display_offset_minutes"})
SECRET_KEYS = frozenset({"nvr_password", "app_pin", "technician_pin", "go2rtc_ingress_path"})  # the Ingress path carries a session token
SECRET_WORDS = ("password", "passwd", "pin", "token", "secret", "apikey", "api_key")
HOST_KEYS = frozenset({"nvr_ip", "go2rtc_url"})
_HOST_SALT = "smplwise-legacy-host/1:"


class SourceError(ValueError):
    """The input is not something this reader takes. `code` is stable (the API answers it in `details.reason`)."""

    def __init__(self, code: str, detail: str = ""):
        super().__init__(code if not detail else f"{code}: {detail}")
        self.code = code
        self.detail = detail


@dataclass
class LegacySource:
    container: str  # json | jsonl | zip | tar | ha_backup | export
    sha256: str
    size: int
    legacy_version: str | None = None
    found: list[str] = field(default_factory=list)  # options | override | events | addon_meta
    options: dict[str, Any] = field(default_factory=dict)  # option values without secrets and without hosts
    option_keys: list[str] = field(default_factory=list)  # every key the options held (secret ones included, names only)
    override: dict[str, Any] = field(default_factory=dict)  # override values without secrets and without the host
    override_keys: list[str] = field(default_factory=list)
    secrets_present: dict[str, bool] = field(default_factory=dict)  # "options.nvr_password": True ...
    nvr_host_digest: str | None = None  # the EFFECTIVE legacy NVR host (an override host wins, like the legacy did)
    go2rtc_url_digest: str | None = None
    events: dict[str, Any] = field(default_factory=lambda: {"present": False, "rows": 0, "first": None, "last": None})
    warnings: list[str] = field(default_factory=list)  # codes
    ignored: int = 0  # members that were read and are not the legacy add-on's

    def to_export(self) -> dict[str, Any]:
        """The secret-free export document (`scripts/migrate_legacy.py --export`); this reader accepts it back."""
        d = asdict(self)
        d.pop("ignored", None)
        return {"format": EXPORT_FORMAT, **d}


# ---------------------------------------------------------------- small helpers

def host_digest(value: Any) -> str | None:
    """A salted digest of a host / URL, compared with Arx's own value and never shown. None for an empty value."""
    text = str(value or "").strip().lower().rstrip("/")
    if not text:
        return None
    return hashlib.sha256((_HOST_SALT + text).encode("utf-8")).hexdigest()


def _secret_key(key: str) -> bool:
    """A known secret, or an unknown key whose name says it is one (`pin_length` and the other known options are not)."""
    k = key.lower()
    if k in SECRET_KEYS:
        return True
    if k in OPTION_KEYS or k in OVERRIDE_KEYS:
        return False
    return any(w in k for w in SECRET_WORDS)


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _json(raw: bytes) -> Any:
    text = raw.decode("utf-8-sig")
    return json.loads(text)


def _is_gzip(raw: bytes) -> bool:
    return raw[:2] == b"\x1f\x8b"


class _Budget:
    """The decompressed bytes and members read so far (caps across nested archives)."""

    def __init__(self) -> None:
        self.read = 0
        self.members = 0

    def member(self) -> None:
        self.members += 1
        if self.members > MAX_MEMBERS:
            raise SourceError("too_many_members", str(MAX_MEMBERS))

    def take(self, n: int) -> None:
        self.read += n
        if self.read > MAX_TOTAL_READ:
            raise SourceError("too_large_unpacked", str(MAX_TOTAL_READ))


def _read_capped(fh: Any, cap: int, budget: _Budget) -> bytes | None:
    """At most `cap` bytes of a member; None (skipped, with a warning by the caller) when it is larger."""
    data = fh.read(cap + 1)
    if len(data) > cap:
        return None
    budget.take(len(data))
    return data


# ---------------------------------------------------------------- the collector of recognised parts

class _Parts:
    def __init__(self) -> None:
        self.options: list[tuple[int, dict[str, Any]]] = []  # (priority, doc): data/options.json 0, addon.json user.options 1, loose 2
        self.override: list[dict[str, Any]] = []
        self.events: list[list[dict[str, Any]]] = []
        self.exports: list[dict[str, Any]] = []
        self.version: str | None = None
        self.ignored = 0
        self.warnings: list[str] = []

    def classify_json(self, doc: Any, *, priority: int = 2) -> bool:
        if not isinstance(doc, dict):
            return False
        if doc.get("format") == EXPORT_FORMAT:
            self.exports.append(doc)
            return True
        user = doc.get("user")
        if isinstance(user, dict) and isinstance(user.get("options"), dict) and "version" in doc:  # the Supervisor's addon.json
            if isinstance(doc.get("version"), str):
                self.version = self.version or doc["version"]
            if _looks_like_options(user["options"]):
                self.options.append((1, user["options"]))
            return True
        if isinstance(doc.get("options"), dict) or isinstance(doc.get("override"), dict):  # a combined hand-made document
            hit = False
            if isinstance(doc.get("options"), dict):
                self.options.append((priority, doc["options"]))
                hit = True
            if isinstance(doc.get("override"), dict):
                self.override.append(doc["override"])
                hit = True
            return hit
        if _looks_like_options(doc):
            self.options.append((priority, doc))
            return True
        if _looks_like_override(doc):
            self.override.append(doc)
            return True
        return False

    def classify_jsonl(self, raw: bytes) -> bool:
        rows: list[dict[str, Any]] = []
        stamped = 0
        for line in raw.decode("utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except ValueError:
                continue  # the legacy store is JSON rows only; anything else is noise
            if isinstance(row, dict):
                rows.append(row)
                stamped += 1 if row.get("storedAt") else 0
                if len(rows) > MAX_EVENT_ROWS:
                    raise SourceError("events_too_many", str(MAX_EVENT_ROWS))
        if not rows or stamped == 0:
            return False
        self.events.append(rows)
        return True

    def feed(self, name: str, raw: bytes, *, priority: int = 2) -> None:
        """One member's bytes: a JSON document or a JSON-lines store, recognised by its content."""
        stripped = raw.lstrip()
        if not stripped:
            return
        try:
            doc = _json(raw)
        except (ValueError, UnicodeDecodeError):
            doc = None
        if doc is not None:
            if self.classify_json(doc, priority=priority):
                return
            if isinstance(doc, dict) and doc.get("storedAt") and self.classify_jsonl(raw):  # a one-row event store
                return
            self.ignored += 1
            return
        if stripped[:1] == b"{" and self.classify_jsonl(raw):
            return
        self.ignored += 1


def _looks_like_options(doc: dict[str, Any]) -> bool:
    keys = set(doc)
    return len(keys & set(OPTION_KEYS)) >= 3 and bool(keys & OPTIONS_ONLY_KEYS) and "camera_names" not in keys


def _looks_like_override(doc: dict[str, Any]) -> bool:
    keys = set(doc)
    if keys & OVERRIDE_KEYS:
        return True
    return bool(keys) and keys <= NVR_KEYS


# ---------------------------------------------------------------- containers

def _candidate(name: str) -> bool:
    low = name.replace("\\", "/").lower()
    if "__macosx/" in low or low.rsplit("/", 1)[-1].startswith("._"):
        return False
    return low.endswith((".json", ".jsonl"))


def _read_zip(raw: bytes, parts: _Parts, budget: _Budget) -> None:
    try:
        z = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile as exc:
        raise SourceError("unreadable_zip", type(exc).__name__) from None
    with z:
        for info in z.infolist():
            budget.member()
            if info.is_dir() or not _candidate(info.filename):
                continue
            if info.file_size > MAX_MEMBER_BYTES:
                parts.warnings.append("member_too_large")
                continue
            with z.open(info) as fh:
                data = _read_capped(fh, MAX_MEMBER_BYTES, budget)
            if data is None:
                parts.warnings.append("member_too_large")
                continue
            parts.feed(info.filename, data)


def _addon_archive(name: str, slugs: list[str]) -> bool:
    base = name.replace("\\", "/").rsplit("/", 1)[-1].lower()
    for ext in (".tar.gz", ".tgz", ".tar"):
        if base.endswith(ext):
            stem = base[: -len(ext)]
            return stem in slugs or stem.endswith("hikvision_nvr")
    return False


def _config_archive(name: str) -> bool:
    base = name.replace("\\", "/").rsplit("/", 1)[-1].lower()
    return base in ("homeassistant.tar.gz", "homeassistant.tar")


def _read_inner_tar(fh: Any, parts: _Parts, budget: _Budget, *, role: str) -> None:
    """A Home Assistant backup's inner archive, read as a stream (`r|*`): the add-on's (`addon.json`, `data/options.json`) or the
    configuration folder's (only the files at the top of the folder: the legacy wrote there, never into a sub-folder)."""
    try:
        inner = tarfile.open(fileobj=fh, mode="r|*")
    except (tarfile.TarError, OSError, EOFError) as exc:
        raise SourceError("unreadable_inner_archive", f"{role}: {type(exc).__name__}") from None
    try:
        for m in inner:
            budget.member()
            if not m.isfile():
                continue
            path = m.name.replace("\\", "/").lstrip("./")
            segs = [s for s in path.split("/") if s and s != "."]
            if role == "addon":
                wanted = segs in (["addon.json"], ["data", "options.json"])
                priority = 0 if segs == ["data", "options.json"] else 1
            else:  # the configuration folder: data/<file> (or <file>) at the top only
                wanted = (len(segs) == 2 and segs[0] == "data" or len(segs) == 1) and _candidate(segs[-1]) and segs[-1] != "homeassistant.json"
                priority = 2
            if not wanted:
                continue
            if m.size > MAX_MEMBER_BYTES:
                parts.warnings.append("member_too_large")
                continue
            src = inner.extractfile(m)
            if src is None:
                continue
            data = _read_capped(src, MAX_MEMBER_BYTES, budget)
            if data is None:
                parts.warnings.append("member_too_large")
                continue
            parts.feed(m.name, data, priority=priority)
    except (tarfile.TarError, OSError, EOFError, zlib.error) as exc:
        raise SourceError("unreadable_inner_archive", f"{role}: {type(exc).__name__}") from None
    finally:
        inner.close()


def _read_tar(fileobj: Any, parts: _Parts, budget: _Budget) -> str:
    """A plain / gzip TAR: loose files, or an unprotected Home Assistant backup. Returns the container name."""
    try:
        t = tarfile.open(fileobj=fileobj, mode="r:*")
    except (tarfile.TarError, OSError, EOFError) as exc:
        raise SourceError("unreadable_tar", type(exc).__name__) from None
    with t:
        members = []
        for m in t:  # random access: the backup's index may come after the inner archives
            budget.member()
            members.append(m)
        meta = next((m for m in members if m.isfile() and m.name.replace("\\", "/").lstrip("./") == "backup.json"), None)
        if meta is not None:
            doc = _json(_read_capped(t.extractfile(meta), MAX_MEMBER_BYTES, budget) or b"{}")
            if not isinstance(doc, dict):
                raise SourceError("not_a_backup")
            if doc.get("protected"):
                raise SourceError("protected_backup")
            slugs = [str(a.get("slug") or "").lower() for a in (doc.get("addons") or []) if isinstance(a, dict)]
            legacy = [s for s in slugs if s.endswith("hikvision_nvr")]
            for a in doc.get("addons") or []:
                if isinstance(a, dict) and str(a.get("slug") or "").lower() in legacy and isinstance(a.get("version"), str):
                    parts.version = parts.version or a["version"]
            if not legacy:
                parts.warnings.append("backup_without_legacy_addon")
            for m in members:
                if not m.isfile():
                    continue
                role = "addon" if _addon_archive(m.name, legacy) else "config" if _config_archive(m.name) else None
                if role is None:
                    continue
                src = t.extractfile(m)
                if src is not None:
                    _read_inner_tar(src, parts, budget, role=role)
            return "ha_backup"
        for m in members:
            if not m.isfile() or not _candidate(m.name):
                continue
            if m.size > MAX_MEMBER_BYTES:
                parts.warnings.append("member_too_large")
                continue
            src = t.extractfile(m)
            if src is None:
                continue
            data = _read_capped(src, MAX_MEMBER_BYTES, budget)
            if data is None:
                parts.warnings.append("member_too_large")
                continue
            parts.feed(m.name, data)
        return "tar"


# ---------------------------------------------------------------- reduce to the secret-free source

def _reduce(container: str, digest: str, size: int, parts: _Parts) -> LegacySource:
    src = LegacySource(container=container, sha256=digest, size=size, ignored=parts.ignored)
    warnings = list(dict.fromkeys(parts.warnings))
    if parts.exports:
        if len(parts.exports) > 1:
            warnings.append("several_exports")
        _from_export(src, parts.exports[0])
        src.container = "export" if container == "json" else container
        src.warnings = list(dict.fromkeys(src.warnings + warnings))
        return src
    options: dict[str, Any] = {}
    if parts.options:
        ranked = sorted(parts.options, key=lambda p: p[0])
        options = ranked[0][1]
        if len({json.dumps(p[1], sort_keys=True, default=str) for p in ranked}) > 1:
            warnings.append("several_options")
        src.found.append("options")
    override: dict[str, Any] = {}
    if parts.override:
        override = parts.override[0]
        if len(parts.override) > 1:
            warnings.append("several_overrides")
        src.found.append("override")
    if parts.events:
        rows = max(parts.events, key=len)
        if len(parts.events) > 1:
            warnings.append("several_event_stores")
        src.events = _event_summary(rows)
        src.found.append("events")
    if parts.version:
        src.found.append("addon_meta")
    src.legacy_version = parts.version
    _take_options(src, options)
    _take_override(src, override)
    eff_host = override.get("nvr_ip") if str(override.get("nvr_ip") or "").strip() else options.get("nvr_ip")
    src.nvr_host_digest = host_digest(eff_host)
    src.go2rtc_url_digest = host_digest(options.get("go2rtc_url"))
    if not src.found:
        raise SourceError("not_legacy", "no legacy options, override or event store was recognised")
    if src.legacy_version and src.legacy_version != LEGACY_VERSION_KNOWN:
        warnings.append("legacy_version_other")
    if not src.legacy_version:
        warnings.append("legacy_version_unknown")
    src.warnings = list(dict.fromkeys(warnings))
    return src


def _take_options(src: LegacySource, options: dict[str, Any]) -> None:
    src.option_keys = sorted(str(k) for k in options)
    for k, v in options.items():
        key = str(k)
        if _secret_key(key):
            src.secrets_present[f"options.{key}"] = bool(str(v if v is not None else "").strip())
        elif key in HOST_KEYS:
            continue
        else:
            src.options[key] = v if isinstance(v, (str, int, float, bool)) or v is None else str(v)


def _take_override(src: LegacySource, override: dict[str, Any]) -> None:
    src.override_keys = sorted(str(k) for k in override)
    for k, v in override.items():
        key = str(k)
        if _secret_key(key):
            src.secrets_present[f"override.{key}"] = bool(str(v if v is not None else "").strip())
        elif key in HOST_KEYS:
            continue
        elif key == "camera_names":
            src.override[key] = {str(ch): str(name).strip() for ch, name in v.items() if str(name).strip()} if isinstance(v, dict) else v
        elif key == "manual_recording":
            src.override[key] = [_manual_row(r) for r in v if isinstance(r, dict)] if isinstance(v, list) else []
        else:
            src.override[key] = v if isinstance(v, (str, int, float, bool)) or v is None else str(v)


def _manual_row(r: dict[str, Any]) -> dict[str, Any]:
    keep = ("trackID", "channelID", "startedAtIso", "durationSeconds", "untilIso")
    return {k: r[k] for k in keep if k in r and (r[k] is None or isinstance(r[k], (str, int, float)))}


def _event_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    stamps = sorted(str(r["storedAt"]) for r in rows if r.get("storedAt"))
    return {"present": True, "rows": len(rows), "first": stamps[0] if stamps else None, "last": stamps[-1] if stamps else None}


def _from_export(src: LegacySource, doc: dict[str, Any]) -> None:
    """Our own export, taken field by field with types checked; a secret-looking value that slipped in is reduced again."""
    def _s(v: Any) -> str | None:
        return v if isinstance(v, str) and v else None

    src.legacy_version = _s(doc.get("legacy_version"))
    src.found = [f for f in (doc.get("found") or []) if f in ("options", "override", "events", "addon_meta")]
    opts = doc.get("options") if isinstance(doc.get("options"), dict) else {}
    ov = doc.get("override") if isinstance(doc.get("override"), dict) else {}
    _take_options(src, opts)
    _take_override(src, ov)
    src.option_keys = sorted({*src.option_keys, *(str(k) for k in (doc.get("option_keys") or []) if isinstance(k, str))})
    src.override_keys = sorted({*src.override_keys, *(str(k) for k in (doc.get("override_keys") or []) if isinstance(k, str))})
    sp = doc.get("secrets_present") if isinstance(doc.get("secrets_present"), dict) else {}
    for k, v in sp.items():
        if isinstance(k, str) and isinstance(v, bool):
            src.secrets_present.setdefault(k, v)
    for key in ("nvr_host_digest", "go2rtc_url_digest"):
        v = doc.get(key)
        setattr(src, key, v if isinstance(v, str) and len(v) == 64 and all(c in "0123456789abcdef" for c in v) else None)
    ev = doc.get("events") if isinstance(doc.get("events"), dict) else {}
    src.events = {"present": bool(ev.get("present")), "rows": int(ev.get("rows") or 0) if isinstance(ev.get("rows"), int) else 0,
                  "first": _s(ev.get("first")), "last": _s(ev.get("last"))}
    src.warnings = [w for w in (doc.get("warnings") or []) if isinstance(w, str)][:50]
    if not src.found:
        raise SourceError("not_legacy", "the export holds nothing")


# ---------------------------------------------------------------- entry points

def read_bytes(raw: bytes, *, max_bytes: int = MAX_INPUT_BYTES) -> LegacySource:
    """Read one upload / one file. Raises SourceError with a stable code."""
    if not isinstance(raw, (bytes, bytearray)) or not raw:
        raise SourceError("empty")
    if len(raw) > max_bytes:
        raise SourceError("too_large", str(max_bytes))
    raw = bytes(raw)
    digest = hashlib.sha256(raw).hexdigest()
    parts = _Parts()
    budget = _Budget()
    head = raw.lstrip()[:1]
    if raw[:4] == b"PK\x03\x04":
        _read_zip(raw, parts, budget)
        return _reduce("zip", digest, len(raw), parts)
    if _is_gzip(raw) or (len(raw) > 262 and raw[257:262] == b"ustar"):
        if _is_gzip(raw):  # a gzip that is not a TAR (a single gzipped JSON) is read as that file
            try:
                with gzip.open(io.BytesIO(raw)) as g:
                    probe = g.read(512)
            except (OSError, EOFError) as exc:
                raise SourceError("unreadable_gzip", type(exc).__name__) from None
            if not (len(probe) > 262 and probe[257:262] == b"ustar"):
                with gzip.open(io.BytesIO(raw)) as g:
                    data = _read_capped(g, MAX_MEMBER_BYTES, budget)
                if data is None:
                    raise SourceError("too_large_unpacked", str(MAX_MEMBER_BYTES))
                parts.feed("gzip", data)
                return _reduce("json", digest, len(raw), parts)
        container = _read_tar(io.BytesIO(raw), parts, budget)
        return _reduce(container, digest, len(raw), parts)
    if head == b"{" or raw[:3] == b"\xef\xbb\xbf":
        if len(raw) > MAX_MEMBER_BYTES:
            raise SourceError("too_large", str(MAX_MEMBER_BYTES))
        parts.feed("upload", raw)
        container = "jsonl" if parts.events and not (parts.options or parts.override or parts.exports) else "json"
        return _reduce(container, digest, len(raw), parts)
    raise SourceError("unsupported_format")


def read_parts(*, options: bytes | None = None, override: bytes | None = None, events: bytes | None = None) -> LegacySource:
    """The loose files of a workstation run (scripts/migrate_legacy.py --options / --override / --events), each read like a member."""
    parts = _Parts()
    budget = _Budget()
    h = hashlib.sha256()
    size = 0
    for label, raw in (("options", options), ("override", override), ("events", events)):
        if raw is None:
            continue
        if len(raw) > MAX_MEMBER_BYTES * (4 if label == "events" else 1):
            raise SourceError("too_large", label)
        h.update(label.encode() + b"\0" + raw + b"\0")
        size += len(raw)
        budget.take(len(raw))
        before = (len(parts.options), len(parts.override), len(parts.events))
        if label == "events":
            parts.classify_jsonl(raw)
        else:
            try:
                doc = _json(raw)
            except (ValueError, UnicodeDecodeError):
                raise SourceError("unreadable_json", label) from None
            if label == "options" and isinstance(doc, dict) and not _looks_like_override(doc):
                parts.options.append((0, doc))  # named by the caller: taken as the options even with few keys
            else:
                parts.classify_json(doc)
        if (len(parts.options), len(parts.override), len(parts.events)) == before:
            parts.warnings.append(f"{label}_not_recognised")
    return _reduce("files", h.hexdigest(), size, parts)


def read_path(path: Any, *, max_bytes: int = 4 * 1024 * 1024 * 1024) -> LegacySource:
    """A file on a workstation (a full Home Assistant backup may be large: its TAR is read from the file, never loaded whole)."""
    from pathlib import Path

    p = Path(path)
    size = p.stat().st_size
    if size > max_bytes:
        raise SourceError("too_large", str(max_bytes))
    with p.open("rb") as fh:
        head = fh.read(512)
        if not (len(head) > 262 and head[257:262] == b"ustar"):
            fh.seek(0)
            return read_bytes(fh.read(), max_bytes=max(max_bytes, MAX_INPUT_BYTES))
        h = hashlib.sha256()
        fh.seek(0)
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
        fh.seek(0)
        parts = _Parts()
        container = _read_tar(fh, parts, _Budget())
        return _reduce(container, h.hexdigest(), size, parts)


def describe(src: LegacySource) -> dict[str, Any]:
    """The `source` block of a report: what was read, never a value."""
    return {"container": src.container, "sha256": src.sha256, "bytes": src.size, "legacy_version": src.legacy_version,
            "found": list(src.found), "ignored_members": src.ignored, "read_at": _now_iso()}
