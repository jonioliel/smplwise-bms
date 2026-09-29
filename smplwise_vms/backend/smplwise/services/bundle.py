"""Evidence bundle of a case (T050): one ZIP with the preserved clips (copies of finished export outputs and
their export manifests), the snapshots, the notes, a manifest with a SHA-256 per file and the source / time
details of every item, and a readable Hebrew report. `verify()` recomputes the hashes of a bundle and reports
each file. The hash proves the file did not change since the bundle was made — not that the picture is
authentic against the camera. Since 0.1.40 the manifest is signed (Ed25519, manifest.sig.json, T067): the
signature proves integrity since the export by a key of this installation — still not capture authenticity.

Verification treats the archive as hostile input (T050 import): entry names are checked before anything is read
(no `..`, absolute paths, drive letters, backslashes, control characters, symlinks, encrypted or exotic entries,
duplicates), the entry count and the declared uncompressed size are bounded (zipfile never inflates an entry past
its declared size, so the declared total is a hard bound), files are hashed as streams, and nothing from the
bundle is executed, rendered or parsed beyond manifest.json / the signature file."""
from __future__ import annotations

import datetime as dt
import hashlib
import html
import io
import json
import re
import sqlite3
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import IO, Any

from .. import __version__
from ..config import Settings
from . import exports as ex
from . import signing

SCHEMA = "smplwise-evidence-bundle/1"
SUPPORTED_SCHEMAS = {SCHEMA}
INTEGRITY_NOTE = "SHA-256 מוכיח שהקובץ לא השתנה מאז יצירת החבילה; הוא אינו מוכיח את אמיתות הצילום מול המצלמה. חתימה ואימות מקור הם יכולות נפרדות."
KIND_HE = {"event": "אירוע", "clip": "קטע הקלטה", "note": "הערה", "snapshot": "תמונה"}
PRES_HE = {"preserved": "עותק שמור", "preserving": "בהעתקה", "nvr_only": "סימנייה ל־NVR בלבד (לא נכלל)", "missing": "חסר: ה־NVR כבר לא מחזיק (לא נכלל)", "unknown": "לא נבדק (לא נכלל)", "not_in_bundle": "לא נכלל בחבילת המקור", "none": ""}
INSTALLATION_KEY = "installation_id"
CONTROL_NAMES = ("manifest.json", "MANIFEST.sha256", signing.SIG_NAME)
SHA_RE = re.compile(r"^[0-9a-f]{64}$")
CHUNK = 1024 * 1024


@dataclass(frozen=True)
class Limits:
    """Bounds on an uploaded archive: entries, the declared uncompressed total, one manifest, one entry's ratio."""
    max_entries: int = 5000
    max_uncompressed: int = 1024 * 1024 * 1024
    max_manifest: int = 16 * 1024 * 1024
    max_ratio: int = 200  # declared size / compressed size of one entry above ratio_floor bytes
    ratio_floor: int = 1024 * 1024


class UnsafeBundle(ValueError):
    """The archive is refused before anything in it is read (ZIP-slip names, bombs, symlinks, too many entries)."""

    def __init__(self, code: str, message: str, entries: list[dict[str, str]] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.entries = entries or []


def bundles_dir(settings: Settings, case_id: str) -> Path:
    return settings.data_dir / "cases" / case_id / "bundles"


def installation_id(conn: sqlite3.Connection, create: bool = False) -> str | None:
    """This installation's stable id (a random UUID, created with the first bundle, kept across backup restores).
    It names the producer in a bundle's manifest; it is a claim, not a proof - the signature is the proof."""
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (INSTALLATION_KEY,)).fetchone()
    if row and row[0]:
        return str(row[0])
    if not create:
        return None
    iid = uuid.uuid4().hex
    conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO NOTHING", (INSTALLATION_KEY, iid))
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (INSTALLATION_KEY,)).fetchone()
    return str(row[0])


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_") or "file"


def build(settings: Settings, conn: sqlite3.Connection, case: dict[str, Any], items: list[dict[str, Any]], actor: Any, tz_name: str,
          installation: str | None = None) -> dict[str, Any]:
    """Write the ZIP for `case` with the given (already scope-filtered) items. Returns the bundle descriptor."""
    now = dt.datetime.now(dt.timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    name = f"case-{case['id'][:8]}-{stamp}.zip"
    out_dir = bundles_dir(settings, case["id"])
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / name
    files: list[dict[str, Any]] = []
    manifest_items: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:

        def add(arcname: str, data: bytes) -> dict[str, Any]:
            z.writestr(arcname, data)
            entry = {"path": arcname, "bytes": len(data), "sha256": _sha256_bytes(data)}
            files.append(entry)
            return entry

        for it in items:
            origin = it.get("origin")
            entry: dict[str, Any] = {
                "item_id": it["id"], "kind": it["kind"], "camera_id": it["camera_id"], "camera_name": it["camera_name"], "event_id": it["event_id"], "event": it["event"],
                "from_at": it["from_at"], "to_at": it["to_at"], "note": it["note"], "added_by": it["added_by_username"], "created_at": it["created_at"],
                "preservation": it["preservation"], "file": None, "source": None,
            }
            imported_file = settings.data_dir / it["file_path"] if origin and it.get("file_path") else None
            if imported_file is not None:
                # an item imported from another bundle (T050 import): its stored copy travels on, marked as imported
                if imported_file.is_file():
                    data = imported_file.read_bytes()
                    folder = "snapshots" if it["kind"] == "snapshot" else "clips"
                    f = add(f"{folder}/{it['id']}_{_safe(imported_file.name)}", data)
                    entry["file"] = f
                    entry["source"] = {"kind": "imported", "bundle_sha256": origin.get("bundle_sha256"), "source_installation_id": origin.get("source_installation_id"),
                                       "sha256_at_import": it.get("file_sha256"), "original": origin.get("source")}
                    if it.get("file_sha256") and it["file_sha256"] != f["sha256"]:
                        entry["source"]["warning"] = "stored file hash differs from the hash recorded at import"
                else:
                    skipped.append({"item_id": it["id"], "reason": "imported file missing"})
            elif it["kind"] in ("event", "clip"):
                job = ex.get_job(conn, it["export_job_id"]) if it["export_job_id"] else None
                out = ex.output_path(settings, job) if job else None
                if job and out and job["download_ready"]:
                    data = out.read_bytes()
                    arc = f"clips/{it['id']}_{_safe(job.get('output_name') or out.name)}"
                    f = add(arc, data)
                    entry["file"] = f
                    entry["source"] = {"kind": "nvr-export-job", "job_id": job["id"], "requested_from": job["requested_from"], "requested_to": job["requested_to"], "actual_from": job.get("actual_from"), "actual_to": job.get("actual_to"), "sha256_at_export": job.get("sha256")}
                    mpath = ex.job_dir(settings, job["id"]) / (job.get("manifest") or "manifest.json")
                    if mpath.is_file():
                        entry["source"]["export_manifest"] = add(f"clips/{it['id']}.export-manifest.json", mpath.read_bytes())["path"]
                else:
                    skipped.append({"item_id": it["id"], "reason": it["preservation"]})
            elif it["kind"] == "snapshot":
                p = settings.data_dir / it["file_path"] if it.get("file_path") else None
                if p and p.is_file():
                    data = p.read_bytes()
                    f = add(f"snapshots/{it['id']}.jpg", data)
                    entry["file"] = f
                    entry["source"] = {"kind": "live-snapshot", "sha256_at_capture": it.get("file_sha256"), "taken_at": it["from_at"]}
                    if it.get("file_sha256") and it["file_sha256"] != f["sha256"]:
                        entry["source"]["warning"] = "stored file hash differs from the hash recorded at capture"
                else:
                    skipped.append({"item_id": it["id"], "reason": "snapshot file missing"})
            if origin:
                entry["imported"] = {"bundle_sha256": origin.get("bundle_sha256"), "source_installation_id": origin.get("source_installation_id"), "source_item_id": origin.get("source_item_id")}
            manifest_items.append(entry)
        notes_md = "# הערות\n\n" + "".join(f"- {it['added_by_username']} · {it['created_at']}: {it['note']}\n" for it in items if it["kind"] == "note")
        add("notes.md", notes_md.encode("utf-8"))
        report = _report_html(case, manifest_items, skipped, now, tz_name, actor)
        add("report.html", report.encode("utf-8"))
        manifest = {
            "schema": SCHEMA, "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "generated_by": getattr(actor, "username", None),
            "generated_by_display": getattr(actor, "display_name", None) or getattr(actor, "username", None), "app_version": __version__, "timezone": tz_name,
            "installation": {"id": installation, "app_version": __version__},
            "case": {k: case[k] for k in ("id", "title", "description", "status", "tags", "owner_username", "created_at", "updated_at")},
            "items": manifest_items, "skipped": skipped, "files": files, "integrity": INTEGRITY_NOTE, "signature": signing.SIG_NAME,
        }
        mbytes = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
        z.writestr("manifest.json", mbytes)
        z.writestr("MANIFEST.sha256", _sha256_bytes(mbytes) + "  manifest.json\n")
        sig = signing.sign_manifest(settings, mbytes)
        z.writestr(signing.SIG_NAME, json.dumps(sig, ensure_ascii=False, indent=2).encode("utf-8"))
    data = buf.getvalue()
    path.write_bytes(data)
    return {"name": name, "bytes": len(data), "sha256": _sha256_bytes(data), "files": len(files), "skipped": skipped, "created_at": manifest["generated_at"], "download_url": f"api/v1/cases/{case['id']}/bundles/{name}",
            "signature": {"alg": sig["alg"], "kid": sig["kid"]}}


def _report_html(case: dict[str, Any], items: list[dict[str, Any]], skipped: list[dict[str, Any]], now: dt.datetime, tz_name: str, actor: Any) -> str:
    e = html.escape
    rows = "".join(
        f"<tr><td>{e(KIND_HE.get(i['kind'], i['kind']))}</td><td>{e(i['camera_name'] or '')}</td><td dir='ltr'>{e(i['from_at'] or '')} → {e(i['to_at'] or '')}</td>"
        f"<td>{e((i['event'] or {}).get('type', '') if i['event'] else '')}</td><td>{e(PRES_HE.get(i['preservation'], i['preservation']))}</td>"
        f"<td dir='ltr'>{e(i['file']['path']) if i['file'] else '—'}</td><td dir='ltr' class='mono'>{e(i['file']['sha256']) if i['file'] else ''}</td><td>{e(i['note'] or '')}</td></tr>"
        for i in items
    )
    skip_rows = "".join(f"<li>{e(s['item_id'])}: {e(PRES_HE.get(s['reason'], s['reason']))}</li>" for s in skipped)
    return f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>חבילת ראיות · {e(case['title'])}</title>
<style>body{{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}}table{{border-collapse:collapse;width:100%;font-size:13px}}td,th{{border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top}}th{{background:#f1f5f9}}.mono{{font-family:monospace;font-size:11px;word-break:break-all}}.note{{color:#475569;font-size:13px}}</style></head>
<body><h1>חבילת ראיות: {e(case['title'])}</h1>
<p class="note">תיק {e(case['id'])} · סטטוס {e(case['status'])} · בעלים {e(case['owner_username'] or '')} · נוצר {now.strftime('%Y-%m-%d %H:%M:%S')} UTC · אזור זמן האתר {e(tz_name)} · הופק על ידי {e(getattr(actor, 'username', '') or '')} · SMPLWISE VMS {e(__version__)}</p>
{('<p>' + e(case['description']) + '</p>') if case.get('description') else ''}
<table><thead><tr><th>סוג</th><th>מצלמה</th><th>טווח (UTC)</th><th>אירוע</th><th>שימור</th><th>קובץ</th><th>SHA-256</th><th>הערה</th></tr></thead><tbody>{rows}</tbody></table>
{('<h2>פריטים שלא נכללו</h2><ul>' + skip_rows + '</ul>') if skipped else ''}
<h2>שלמות</h2><p class="note">{e(INTEGRITY_NOTE)} רשימת הקבצים והגיבובים נמצאת ב־manifest.json; MANIFEST.sha256 מגבב את ה־manifest עצמו.</p>
</body></html>"""


# ---------------------------------------------------------------- verification (hostile input)

_DRIVE_RE = re.compile(r"^[A-Za-z]:")


def _unsafe_reason(info: zipfile.ZipInfo) -> str | None:
    raw = info.orig_filename
    name = info.filename
    if "\x00" in raw or any(ord(ch) < 32 for ch in raw):
        return "control character in the name"
    if "\\" in raw:
        return "backslash in the name"
    if raw.startswith("/") or name.startswith("/"):
        return "absolute path"
    if _DRIVE_RE.match(raw) or _DRIVE_RE.match(name):
        return "drive letter"
    parts = name.rstrip("/").split("/")
    if any(p == ".." for p in parts):
        return "parent directory (..)"
    if any(p in ("", ".") for p in parts):
        return "empty or '.' path segment"
    mode = (info.external_attr >> 16) & 0o170000
    if mode == 0o120000:
        return "symbolic link"
    if info.create_system == 3 and mode and mode not in (0o100000, 0o040000):
        return "special file"
    if info.flag_bits & 0x1:
        return "encrypted entry"
    if info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
        return "unsupported compression"
    return None


def inspect(z: zipfile.ZipFile, limits: Limits) -> None:
    """Refuse the archive before reading any entry. Raises UnsafeBundle."""
    infos = z.infolist()
    if len(infos) > limits.max_entries:
        raise UnsafeBundle("too_many_entries", f"the archive has {len(infos)} entries (at most {limits.max_entries})")
    seen: set[str] = set()
    bad: list[dict[str, str]] = []
    total = 0
    for info in infos:
        reason = _unsafe_reason(info)
        if reason is None and info.filename in seen:
            reason = "duplicate entry name"
        if reason is None and info.file_size > limits.ratio_floor and info.file_size > limits.max_ratio * max(info.compress_size, 1):
            reason = "compression ratio (zip bomb)"
        seen.add(info.filename)
        if reason:
            bad.append({"path": info.orig_filename[:200].encode("unicode_escape").decode("ascii"), "reason": reason})
        total += max(info.file_size, 0)
    if bad:
        raise UnsafeBundle("unsafe_entries", "the archive has unsafe entries", bad[:20])
    if total > limits.max_uncompressed:
        raise UnsafeBundle("too_large_uncompressed", f"the archive expands to {total} bytes (at most {limits.max_uncompressed})")


def hash_member(z: zipfile.ZipFile, name: str, sink: IO[bytes] | None = None) -> tuple[str, int]:
    """SHA-256 and size of one entry, read as a stream (optionally copied to `sink`). Raises on CRC / inflate errors."""
    h = hashlib.sha256()
    n = 0
    with z.open(name) as src:
        while True:
            chunk = src.read(CHUNK)
            if not chunk:
                break
            h.update(chunk)
            n += len(chunk)
            if sink is not None:
                sink.write(chunk)
    return h.hexdigest(), n


def _s(value: Any, n: int = 200) -> str | None:
    return str(value)[:n] if isinstance(value, (str, int, float)) and not isinstance(value, bool) else None


def _empty_report() -> dict[str, Any]:
    return {
        "ok": False, "schema": None, "schema_version": None, "supported": False, "files": [], "extra": [], "manifest_ok": None, "errors": [],
        "signature": {"present": False, "valid": False, "kid": None, "known": False, "retired": None, "trust": "unsigned", "reason": "no signature (bundle made before 0.1.40, or the signature was removed)"},
        "authenticity": signing.TRUST_NOTE, "origin": None, "counts": {"ok": 0, "missing": 0, "mismatch": 0, "corrupt": 0, "extra": 0}, "summary": "",
    }


def _origin(manifest: dict[str, Any], sig: dict[str, Any], local_iid: str | None) -> dict[str, Any]:
    inst = manifest.get("installation") if isinstance(manifest.get("installation"), dict) else {}
    source_iid = _s(inst.get("id"), 64)
    signed_here = bool(sig.get("valid") and sig.get("trust") == "installation")
    if source_iid:
        this = bool(local_iid) and source_iid == local_iid
        basis = "installation_id"
    elif signed_here:
        this, basis = True, "signing_key"  # an older bundle without an installation id, signed by a key of this ring
    else:
        this, basis = None, "unknown"
    return {
        "installation_id": source_iid, "app_version": _s(inst.get("app_version") or manifest.get("app_version"), 40),
        "exported_at": _s(manifest.get("generated_at"), 40), "exported_by": _s(manifest.get("generated_by"), 120),
        "exported_by_display": _s(manifest.get("generated_by_display"), 120), "timezone": _s(manifest.get("timezone"), 64),
        "this_installation": this, "basis": basis,
        # the id in a manifest is only a claim; it is confirmed when the manifest is signed by a key of this installation
        "confirmed_by_signature": bool(this and signed_here),
    }


def _summary(out: dict[str, Any]) -> str:
    c = out["counts"]
    o = out.get("origin") or {}
    if out["errors"] and not out["files"]:
        head = "האימות נכשל: " + "; ".join(out["errors"]) + "."
    elif out["ok"]:
        head = (f"כל {c['ok']} הקבצים תואמים ל־manifest: החבילה לא השתנתה מאז הייצוא. "
                "התאמת hash מוכיחה רק שהקבצים לא שונו אחרי שהחבילה נוצרה — היא אינה מוכיחה שהצילום אמיתי או שהוא משקף את מה שקרה מול המצלמה.")
    else:
        parts = [f"{c['mismatch']} קבצים שונו" if c["mismatch"] else "", f"{c['missing']} חסרים" if c["missing"] else "", f"{c['corrupt']} פגומים" if c["corrupt"] else "",
                 f"{c['extra']} קבצים שאינם ב־manifest" if c["extra"] else "", "ה־manifest עצמו שונה" if out["manifest_ok"] is False else "",
                 "החתימה אינה תקינה" if out["signature"].get("present") and not out["signature"].get("valid") else "", "גרסת manifest לא נתמכת" if out["schema"] and not out["supported"] else ""]
        parts += out["errors"]
        head = "האימות נכשל: " + ", ".join(p for p in parts if p) + ". החבילה שונתה אחרי הייצוא או נפגמה, ואי אפשר לייבא אותה."
    if o.get("this_installation") is True:
        tail = " הופקה בהתקנה זו" + (" (מאושר בחתימה)." if o.get("confirmed_by_signature") else " לפי המזהה ב־manifest בלבד — החתימה אינה במפתח של התקנה זו, ולכן זו טענה ולא הוכחה.")
    elif o.get("this_installation") is False:
        tail = f" הופקה בהתקנה אחרת ({o.get('installation_id')})."
    elif o:
        tail = " ההתקנה שהפיקה את החבילה אינה ידועה (חבילה ישנה ללא מזהה התקנה)."
    else:
        tail = ""
    return head + tail


def _verify_open(z: zipfile.ZipFile, keyring: dict[str, Any] | None, local_iid: str | None, limits: Limits) -> tuple[dict[str, Any], dict[str, Any] | None]:
    out = _empty_report()
    inspect(z, limits)
    names = {n for n in z.namelist() if not n.endswith("/")}
    if "manifest.json" not in names:
        out["errors"].append("manifest.json missing")
        return out, None
    if z.getinfo("manifest.json").file_size > limits.max_manifest:
        out["errors"].append("manifest.json too large")
        return out, None
    try:
        mbytes = z.read("manifest.json")
        manifest = json.loads(mbytes.decode("utf-8"))
        if not isinstance(manifest, dict):
            raise ValueError("manifest is not an object")
    except Exception:  # noqa: BLE001 - corrupt or not JSON: report, never raise
        out["errors"].append("manifest.json unreadable")
        return out, None
    schema = manifest.get("schema")
    out["schema"] = _s(schema, 80)
    m = re.fullmatch(r"smplwise-evidence-bundle/(\d{1,4})", out["schema"] or "")
    out["schema_version"] = int(m.group(1)) if m else None
    out["supported"] = out["schema"] in SUPPORTED_SCHEMAS
    case = manifest.get("case") if isinstance(manifest.get("case"), dict) else {}
    out["case"] = _s(case.get("title"), 120)
    out["generated_at"] = _s(manifest.get("generated_at"), 40)
    if "MANIFEST.sha256" in names:
        try:
            recorded = z.read("MANIFEST.sha256")[:4096].decode("utf-8", "replace").split()[0]
            out["manifest_ok"] = recorded == _sha256_bytes(mbytes)
        except Exception:  # noqa: BLE001
            out["manifest_ok"] = False
    if signing.SIG_NAME in names:
        try:
            if z.getinfo(signing.SIG_NAME).file_size > 64 * 1024:
                raise ValueError("signature file too large")
            sig = json.loads(z.read(signing.SIG_NAME).decode("utf-8"))
            if not isinstance(sig, dict):
                raise ValueError("signature is not an object")
            out["signature"] = signing.verify_signature(sig, mbytes, keyring)
        except Exception:  # noqa: BLE001 - unreadable signature file: reported as invalid, never raised
            out["signature"] = {"present": True, "valid": False, "kid": None, "known": False, "retired": None, "trust": "unsigned", "reason": "signature file unreadable"}
    out["origin"] = _origin(manifest, out["signature"], local_iid)
    files = manifest.get("files")
    listed: dict[str, str] = {}
    if not isinstance(files, list):
        out["errors"].append("manifest has no file list")
        files = []
    for f in files:
        path = f.get("path") if isinstance(f, dict) else None
        sha = f.get("sha256") if isinstance(f, dict) else None
        if not isinstance(path, str) or not isinstance(sha, str) or not SHA_RE.match(sha) or len(path) > 512:
            out["errors"].append("manifest file entry malformed")
            break
        if path in listed:
            out["errors"].append("manifest lists a file twice")
            break
        listed[path] = sha
    # every item that names a file must name one of the listed files with the same hash
    for it in manifest.get("items") if isinstance(manifest.get("items"), list) else []:
        f = it.get("file") if isinstance(it, dict) else None
        if isinstance(f, dict) and listed.get(str(f.get("path"))) != f.get("sha256"):
            out["errors"].append("manifest items and file list disagree")
            break
    for path, sha in listed.items():
        if path not in names:
            out["files"].append({"path": path, "status": "missing", "expected": sha, "actual": None, "bytes": None})
            continue
        try:
            actual, n = hash_member(z, path)
        except Exception:  # noqa: BLE001 - a CRC or decompression failure means the archive changed after it was made
            out["files"].append({"path": path, "status": "corrupt", "expected": sha, "actual": None, "bytes": None})
            continue
        out["files"].append({"path": path, "status": "ok" if actual == sha else "mismatch", "expected": sha, "actual": actual, "bytes": n})
    out["extra"] = sorted(n for n in names if n not in listed and n not in CONTROL_NAMES)
    for f in out["files"]:
        out["counts"][f["status"]] += 1
    out["counts"]["extra"] = len(out["extra"])
    sig_ok = not out["signature"]["present"] or out["signature"]["valid"]
    out["ok"] = (out["supported"] and out["manifest_ok"] is not False and all(f["status"] == "ok" for f in out["files"]) and not out["extra"] and sig_ok
                 and not out["errors"])
    return out, manifest


def verify_source(source: bytes | str | Path | IO[bytes], keyring: dict[str, Any] | None = None, local_installation_id: str | None = None,
                  limits: Limits | None = None) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Verify a bundle from bytes, a path or a file object. Returns (report, manifest or None). A damaged or
    tampered bundle is reported, never raised; an unsafe archive (ZIP-slip names, bombs) raises UnsafeBundle."""
    limits = limits or Limits()
    src = io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else source
    try:
        z = zipfile.ZipFile(src)
    except Exception:  # noqa: BLE001 - BadZipFile, or a crafted directory that trips zipfile itself
        out = _empty_report()
        out["errors"].append("not a zip file")
        out["summary"] = _summary(out)
        return out, None
    with z:
        out, manifest = _verify_open(z, keyring, local_installation_id, limits)
    out["summary"] = _summary(out)
    return out, manifest


def verify(zip_bytes: bytes, keyring: dict[str, Any] | None = None, local_installation_id: str | None = None) -> dict[str, Any]:
    """Recompute every hash listed in the bundle's manifest and check the manifest signature against `keyring`
    (this installation's public keys). Never raises for a damaged bundle: it reports (UnsafeBundle for a hostile one)."""
    return verify_source(zip_bytes, keyring, local_installation_id)[0]
