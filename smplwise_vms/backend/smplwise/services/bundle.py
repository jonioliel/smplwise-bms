"""Evidence bundle of a case (T050): one ZIP with the preserved clips (copies of finished export outputs and
their export manifests), the snapshots, the notes, a manifest with a SHA-256 per file and the source / time
details of every item, and a readable Hebrew report. `verify()` recomputes the hashes of a bundle and reports
each file. The hash proves the file did not change since the bundle was made — not that the picture is
authentic against the camera; signing and key management are a separate, later capability (T067)."""
from __future__ import annotations

import datetime as dt
import hashlib
import html
import io
import json
import re
import sqlite3
import zipfile
from pathlib import Path
from typing import Any

from .. import __version__
from ..config import Settings
from . import exports as ex

SCHEMA = "smplwise-evidence-bundle/1"
INTEGRITY_NOTE = "SHA-256 מוכיח שהקובץ לא השתנה מאז יצירת החבילה; הוא אינו מוכיח את אמיתות הצילום מול המצלמה. חתימה ואימות מקור הם יכולות נפרדות."
KIND_HE = {"event": "אירוע", "clip": "קטע הקלטה", "note": "הערה", "snapshot": "תמונה"}
PRES_HE = {"preserved": "עותק שמור", "preserving": "בהעתקה", "nvr_only": "סימנייה ל־NVR בלבד (לא נכלל)", "missing": "חסר: ה־NVR כבר לא מחזיק (לא נכלל)", "unknown": "לא נבדק (לא נכלל)", "none": ""}


def bundles_dir(settings: Settings, case_id: str) -> Path:
    return settings.data_dir / "cases" / case_id / "bundles"


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_") or "file"


def build(settings: Settings, conn: sqlite3.Connection, case: dict[str, Any], items: list[dict[str, Any]], actor: Any, tz_name: str) -> dict[str, Any]:
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
            entry: dict[str, Any] = {
                "item_id": it["id"], "kind": it["kind"], "camera_id": it["camera_id"], "camera_name": it["camera_name"], "event_id": it["event_id"], "event": it["event"],
                "from_at": it["from_at"], "to_at": it["to_at"], "note": it["note"], "added_by": it["added_by_username"], "created_at": it["created_at"],
                "preservation": it["preservation"], "file": None, "source": None,
            }
            if it["kind"] in ("event", "clip"):
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
            manifest_items.append(entry)
        notes_md = "# הערות\n\n" + "".join(f"- {it['added_by_username']} · {it['created_at']}: {it['note']}\n" for it in items if it["kind"] == "note")
        add("notes.md", notes_md.encode("utf-8"))
        report = _report_html(case, manifest_items, skipped, now, tz_name, actor)
        add("report.html", report.encode("utf-8"))
        manifest = {
            "schema": SCHEMA, "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "generated_by": getattr(actor, "username", None), "app_version": __version__, "timezone": tz_name,
            "case": {k: case[k] for k in ("id", "title", "description", "status", "tags", "owner_username", "created_at", "updated_at")},
            "items": manifest_items, "skipped": skipped, "files": files, "integrity": INTEGRITY_NOTE, "signature": None,
        }
        mbytes = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
        z.writestr("manifest.json", mbytes)
        z.writestr("MANIFEST.sha256", _sha256_bytes(mbytes) + "  manifest.json\n")
    data = buf.getvalue()
    path.write_bytes(data)
    return {"name": name, "bytes": len(data), "sha256": _sha256_bytes(data), "files": len(files), "skipped": skipped, "created_at": manifest["generated_at"], "download_url": f"api/v1/cases/{case['id']}/bundles/{name}"}


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


def verify(zip_bytes: bytes) -> dict[str, Any]:
    """Recompute every hash listed in the bundle's manifest. Never raises for a bad bundle: it reports."""
    out: dict[str, Any] = {"ok": False, "schema": None, "files": [], "extra": [], "manifest_ok": None, "errors": []}
    try:
        z = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        out["errors"].append("not a zip file")
        return out
    with z:
        names = set(z.namelist())
        if "manifest.json" not in names:
            out["errors"].append("manifest.json missing")
            return out
        try:
            mbytes = z.read("manifest.json")
            manifest = json.loads(mbytes.decode("utf-8"))
        except Exception:  # noqa: BLE001 - corrupt or not JSON: report, never raise
            out["errors"].append("manifest.json unreadable")
            return out
        out["schema"] = manifest.get("schema")
        out["case"] = manifest.get("case", {}).get("title")
        out["generated_at"] = manifest.get("generated_at")
        if "MANIFEST.sha256" in names:
            try:
                recorded = z.read("MANIFEST.sha256").decode("utf-8", "replace").split()[0]
                out["manifest_ok"] = recorded == _sha256_bytes(mbytes)
            except Exception:  # noqa: BLE001
                out["manifest_ok"] = False
        listed = {f["path"] for f in manifest.get("files", [])}
        for f in manifest.get("files", []):
            if f["path"] not in names:
                out["files"].append({"path": f["path"], "status": "missing", "expected": f["sha256"], "actual": None})
                continue
            try:
                data = z.read(f["path"])
            except Exception:  # noqa: BLE001 - a CRC or decompression failure means the archive changed after it was made
                out["files"].append({"path": f["path"], "status": "corrupt", "expected": f["sha256"], "actual": None})
                continue
            actual = _sha256_bytes(data)
            out["files"].append({"path": f["path"], "status": "ok" if actual == f["sha256"] else "mismatch", "expected": f["sha256"], "actual": actual})
        out["extra"] = sorted(n for n in names if n not in listed and n not in ("manifest.json", "MANIFEST.sha256") and not n.endswith("/"))
    out["ok"] = out["schema"] == SCHEMA and out["manifest_ok"] is not False and all(f["status"] == "ok" for f in out["files"]) and not out["extra"]
    return out
