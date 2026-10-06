"""Signed plan package (T088, ST5): one ZIP with a plan version's structure document, its rooms, its anchors, the custom
library items its objects use, the plan picture (and the source file when it is small), a readable report and a manifest
with the SHA-256 of every file - signed with this installation's Ed25519 key (services/signing.py, the key T067 made for
evidence bundles; only the public half travels, the private half never leaves /data/keys).

Import treats the archive as hostile input, with the checks of the evidence-bundle import (services/bundle.py): the
central directory is bounded before zipfile indexes it, every entry name is checked (no `..`, absolute paths, drive
letters, backslashes, control characters, symlinks, encrypted entries, duplicates), the entry count, the declared total
and the compression ratio are bounded, only the known file names are accepted, every file is hashed as a stream against
the signed manifest and nothing is executed or rendered. Then the versions are checked (package schema, document schema),
the document is validated in full and the import is planned against the target version: replace (the package's
document becomes the draft) or merge (the package's items are added, an item with the same id takes the package's
copy, nothing is removed). The plan is a dry run until the person confirms; applying it writes only the target's draft
(never a published structure, never another floor, never the live rooms or anchors) and, when the person may manage the
library, the custom items the draft needs that this installation lacks.

What a signature proves is what it proves for a bundle: the files have not changed since a holder of the key exported
them. A package signed by another installation verifies (its embedded public key checks out) but is not known here: the
import says so and asks for an explicit confirmation."""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import html
import io
import json
import re
import sqlite3
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import IO, Any

from .. import __version__
from ..config import Settings
from . import bundle as zipsafe
from . import geometry_store as store
from . import plan_catalog
from . import plan_geometry as pg
from . import signing

SCHEMA = "smplwise-plan-package/1"
SUPPORTED_SCHEMAS = {SCHEMA}
CATALOG_FORMAT = "smplwise-catalog-1"
MAX_PACKAGE_BYTES = 48 * 1024 * 1024
MAX_SOURCE_BYTES = 16 * 1024 * 1024  # the original plan file travels only when it is at most this big
MAX_JSON_BYTES = 16 * 1024 * 1024
LIMITS = zipsafe.Limits(max_entries=16, max_uncompressed=128 * 1024 * 1024, max_manifest=4 * 1024 * 1024, max_ratio=200, ratio_floor=1024 * 1024)
CONTROL_NAMES = ("manifest.json", "MANIFEST.sha256", signing.SIG_NAME)
DATA_NAMES = ("plan.json", "rooms.json", "anchors.json", "catalog.json", "report.html")
ASSET_RE = re.compile(r"^assets/(background|source)\.[a-z0-9]{1,8}$")
GEOMETRY_KEYS = (*pg.COLLECTIONS, "floor_height_m")
MODES = ("replace", "merge")
SHA_RE = re.compile(r"^[0-9a-f]{64}$")


class PackageError(Exception):
    """A refused package or import: `status` is the HTTP status the API answers with."""

    def __init__(self, status: int, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def geometry_hash(doc: dict[str, Any]) -> str:
    """The hash of what was drawn - the collections and the floor height - without the version block (plan version id,
    source, size, calibration), so the same structure compares equal across versions and installations."""
    return _sha(pg.canonical_json({k: doc.get(k) for k in GEOMETRY_KEYS}).encode("utf-8"))


def _ext(name: str, fallback: str) -> str:
    m = re.search(r"\.([A-Za-z0-9]{1,8})$", name or "")
    return m.group(1).lower() if m else fallback


# ---------------------------------------------------------------- export

def room_record(z: dict[str, Any]) -> dict[str, Any]:
    return {k: z.get(k) for k in ("id", "name", "kind", "polygon", "color", "level_id", "ceiling_height_m", "tags", "label_pos", "searchable")}


def anchor_records(conn: sqlite3.Connection, floor_id: str) -> list[dict[str, Any]]:
    """The floor's live anchors with a display name: the anchor's label, else the camera's alias / NVR name or the
    entity's name, else the resource id."""
    out: list[dict[str, Any]] = []
    rows = conn.execute("SELECT resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label FROM map_anchors "
                        "WHERE floor_id = ? AND effective_to IS NULL ORDER BY resource_type, resource_id", (floor_id,)).fetchall()
    for r in rows:
        name = r["label"]
        if not name and r["resource_type"] == "camera":
            c = conn.execute("SELECT alias, name_source FROM cameras WHERE id = ?", (r["resource_id"],)).fetchone()
            name = (c["alias"] or c["name_source"]) if c is not None else None
        elif not name:
            e = conn.execute("SELECT name, original_name FROM ha_entities WHERE entity_id = ?", (r["resource_id"],)).fetchone()
            name = (e["name"] or e["original_name"]) if e is not None else None
        out.append({"resource_type": r["resource_type"], "resource_id": r["resource_id"], "name": name or r["resource_id"], "x": r["x"], "y": r["y"],
                    "rotation_degrees": r["rotation_degrees"] or 0, "field_of_view_degrees": r["field_of_view_degrees"], "layer_id": r["layer_id"], "label": r["label"]})
    return out


def _custom_record(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "based_on": r["based_on"], "names": json.loads(r["names_json"]), "category": r["category"], "tags": json.loads(r["tags_json"] or "[]"),
            "role": r["role"], "shape": r["shape"], "size": json.loads(r["size_json"]), "z_m": r["z_m"], "params": json.loads(r["params_json"] or "{}"),
            "icon": r["icon"], "color_token": r["color_token"], "created_at": r["created_at"], "updated_at": r["updated_at"]}


def used_custom_items(conn: sqlite3.Connection, doc: dict[str, Any]) -> list[dict[str, Any]]:
    used = sorted({str(o.get("item_id")) for o in doc.get("objects") or [] if isinstance(o, dict) and o.get("item_id")} - plan_catalog.builtin_ids())
    out = []
    for iid in used:
        r = conn.execute("SELECT * FROM catalog_items WHERE id = ?", (iid,)).fetchone()
        if r is not None:
            out.append(_custom_record(r))
    return out


def build(settings: Settings, conn: sqlite3.Connection, version: sqlite3.Row, floor: sqlite3.Row, doc: dict[str, Any], stage: str, zones: list[dict[str, Any]],
          actor: Any, installation: str | None, revision: int | None = None) -> tuple[bytes, dict[str, Any]]:
    """The signed package of `doc` (the stored document of `version`, draft or published). Returns (zip bytes, manifest)."""
    files: list[dict[str, Any]] = []
    buf = io.BytesIO()
    plan_bytes = pg.canonical_json(doc).encode("utf-8")
    rooms = [room_record(z) for z in sorted(zones, key=lambda z: str(z.get("id")))]
    anchors = anchor_records(conn, version["floor_id"])
    customs = used_custom_items(conn, doc)
    asset = conn.execute("SELECT * FROM plan_assets WHERE id = ?", (version["asset_id"],)).fetchone()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:

        def add(arcname: str, data: bytes, role: str) -> None:
            z.writestr(arcname, data)
            files.append({"path": arcname, "bytes": len(data), "sha256": _sha(data), "role": role})

        add("plan.json", plan_bytes, "structure")
        add("rooms.json", json.dumps({"rooms": rooms}, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8"), "rooms")
        add("anchors.json", json.dumps({"anchors": anchors}, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8"), "anchors")
        add("catalog.json", json.dumps({"format": CATALOG_FORMAT, "items": customs}, ensure_ascii=False, sort_keys=True, indent=1).encode("utf-8"), "custom_items")
        picture = settings.data_dir / version["image_path"] if version["image_path"] else None
        if picture is not None and picture.is_file():
            add(f"assets/background.{_ext(picture.name, 'png')}", picture.read_bytes(), "background")
        source_skipped = None
        if asset is not None:
            src = settings.data_dir / asset["storage_path"]
            if src.is_file() and src.stat().st_size <= MAX_SOURCE_BYTES:
                add(f"assets/source.{_ext(asset['original_name'], 'bin')}", src.read_bytes(), "source")
            elif src.is_file():
                source_skipped = "too_large"
            else:
                source_skipped = "missing"
        counts = pg.counts(doc)
        manifest = {
            "schema": SCHEMA, "generated_at": _now(), "generated_by": getattr(actor, "username", None), "app_version": __version__,
            "installation": {"id": installation, "app_version": __version__},
            "plan": {"plan_version_id": version["id"], "floor_id": version["floor_id"], "floor_name": floor["name"] if floor is not None else None,
                     "version_status": version["status"], "stage": stage, "geometry_revision": revision,
                     "source": {"file_name": asset["original_name"] if asset is not None else None, "sha256": asset["sha256"] if asset is not None else None,
                                "mime": asset["mime"] if asset is not None else None, "included": source_skipped is None and asset is not None, "skipped": source_skipped}},
            "document": {"schema_version": doc.get("schema_version"), "doc_hash": store.doc_hash(doc), "geometry_hash": geometry_hash(doc), "counts": counts},
            "entities": {"rooms": len(rooms), "anchors": len(anchors), "custom_items": [c["id"] for c in customs]},
            "files": files, "signature": signing.SIG_NAME,
        }
        add("report.html", _report(manifest, rooms, anchors, customs).encode("utf-8"), "report")
        manifest["files"] = files
        mbytes = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
        z.writestr("manifest.json", mbytes)
        z.writestr("MANIFEST.sha256", _sha(mbytes) + "  manifest.json\n")
        sig = signing.sign_manifest(settings, mbytes)
        z.writestr(signing.SIG_NAME, json.dumps(sig, ensure_ascii=False, indent=2).encode("utf-8"))
    manifest["signature_info"] = {"alg": sig["alg"], "kid": sig["kid"]}
    return buf.getvalue(), manifest


def _report(manifest: dict[str, Any], rooms: list[dict[str, Any]], anchors: list[dict[str, Any]], customs: list[dict[str, Any]]) -> str:
    e = html.escape
    p = manifest["plan"]
    d = manifest["document"]
    counts = "".join(f"<tr><td>{e(k)}</td><td>{v}</td></tr>" for k, v in d["counts"].items())
    room_rows = "".join(f"<li>{e(str(r.get('name') or ''))}</li>" for r in rooms)
    anchor_rows = "".join(f"<li>{e(str(a.get('name') or ''))} <span dir='ltr'>({e(a['resource_type'])}: {e(a['resource_id'])})</span></li>" for a in anchors)
    custom_rows = "".join(f"<li dir='ltr'>{e(c['id'])}</li>" for c in customs)
    return f"""<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>חבילת תוכנית · {e(str(p.get('floor_name') or ''))}</title>
<style>body{{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}}table{{border-collapse:collapse}}td{{border:1px solid #cbd5e1;padding:4px 8px}}.mono{{font-family:monospace;font-size:11px;word-break:break-all}}</style></head>
<body><h1>חבילת תוכנית: {e(str(p.get('floor_name') or ''))}</h1>
<p>גרסת תוכנית <span dir="ltr">{e(p['plan_version_id'])}</span> · {'טיוטה' if p['stage'] == 'draft' else 'מפורסם'} · נוצרה {e(manifest['generated_at'])} UTC · {e(str(manifest.get('generated_by') or ''))} · SmplWise Arx {e(manifest['app_version'])}</p>
<h2>מבנה</h2><table>{counts}</table>
<p class="mono">doc {e(d['doc_hash'])}<br>geometry {e(d['geometry_hash'])}</p>
<h2>חדרים ({len(rooms)})</h2><ul>{room_rows}</ul>
<h2>מצלמות וישויות ({len(anchors)})</h2><ul>{anchor_rows}</ul>
<h2>פריטים מותאמים ({len(customs)})</h2><ul>{custom_rows}</ul>
<h2>שלמות</h2><p>כל קובץ בחבילה מגובב ב־manifest.json, וה־manifest חתום (manifest.sig.json). החתימה מוכיחה שהחבילה לא שונתה מאז הייצוא.</p>
</body></html>"""


# ---------------------------------------------------------------- verification (hostile input)

@dataclass
class Package:
    manifest: dict[str, Any]
    signature: dict[str, Any]
    doc: dict[str, Any]
    rooms: list[dict[str, Any]]
    anchors: list[dict[str, Any]]
    custom_items: list[dict[str, Any]]
    package_sha256: str
    warnings: list[str] = field(default_factory=list)


def _json(z: zipfile.ZipFile, name: str, limit: int) -> Any:
    info = z.getinfo(name)
    if info.file_size > limit:
        raise PackageError(422, "package_file_too_large", "קובץ בחבילה גדול מהמותר.", {"path": name})
    try:
        return json.loads(z.read(name).decode("utf-8"))
    except (UnicodeDecodeError, ValueError, zipfile.BadZipFile, EOFError) as exc:
        raise PackageError(422, "package_malformed", "קובץ בחבילה אינו JSON תקין.", {"path": name, "error": type(exc).__name__})


def _version_tuple(v: Any) -> tuple[int, ...]:
    try:
        return tuple(int(x) for x in str(v).split(".")[:3])
    except ValueError:
        return ()


def read(fp: IO[bytes], keyring: dict[str, Any] | None) -> Package:
    """Open, check and parse an uploaded package. Raises PackageError for anything refused."""
    fp.seek(0, io.SEEK_END)
    size = fp.tell()
    if size > MAX_PACKAGE_BYTES:
        raise PackageError(413, "package_too_large", "החבילה גדולה מהמותר.", {"max_bytes": MAX_PACKAGE_BYTES})
    fp.seek(0)
    h = hashlib.sha256()
    while chunk := fp.read(1024 * 1024):
        h.update(chunk)
    package_sha = h.hexdigest()
    try:
        zipsafe.precheck(fp, LIMITS)
        fp.seek(0)
        z = zipfile.ZipFile(fp)
    except zipsafe.UnsafeBundle as exc:
        raise PackageError(422, "package_unsafe", "החבילה נדחתה: מבנה הקובץ אינו בטוח.", {"reason": exc.code, "entries": exc.entries})
    except (zipfile.BadZipFile, OSError, ValueError, EOFError):
        raise PackageError(422, "package_not_zip", "הקובץ אינו חבילת תוכנית.")
    with z:
        try:
            zipsafe.inspect(z, LIMITS)
        except zipsafe.UnsafeBundle as exc:
            raise PackageError(422, "package_unsafe", "החבילה נדחתה: מבנה הקובץ אינו בטוח.", {"reason": exc.code, "entries": exc.entries})
        names = [i.filename for i in z.infolist() if not i.is_dir()]
        unknown = [n for n in names if n not in CONTROL_NAMES and n not in DATA_NAMES and not ASSET_RE.match(n)]
        if unknown:
            raise PackageError(422, "package_unsafe", "החבילה נדחתה: יש בה קבצים לא צפויים.", {"reason": "unexpected_entries", "entries": [{"path": zipsafe.clean_text(n)[:200]} for n in unknown[:20]]})
        if "manifest.json" not in names or "plan.json" not in names:
            raise PackageError(422, "package_incomplete", "החבילה חסרה: אין בה manifest או מבנה.")
        if z.getinfo("manifest.json").file_size > LIMITS.max_manifest:
            raise PackageError(422, "package_file_too_large", "קובץ בחבילה גדול מהמותר.", {"path": "manifest.json"})
        mbytes = z.read("manifest.json")
        try:
            manifest = json.loads(mbytes.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise PackageError(422, "package_malformed", "קובץ בחבילה אינו JSON תקין.", {"path": "manifest.json"})
        if not isinstance(manifest, dict) or manifest.get("schema") not in SUPPORTED_SCHEMAS:
            raise PackageError(422, "package_unsupported", "גרסת החבילה אינה נתמכת.", {"schema": zipsafe._s(manifest.get("schema") if isinstance(manifest, dict) else None), "supported": sorted(SUPPORTED_SCHEMAS)})
        # the signature: required, valid over the manifest bytes
        if signing.SIG_NAME not in names:
            raise PackageError(422, "package_unsigned", "החבילה אינה חתומה.")
        sig_raw = _json(z, signing.SIG_NAME, 64 * 1024)
        if not isinstance(sig_raw, dict):
            raise PackageError(422, "package_signature_invalid", "החתימה על החבילה אינה תקפה.", {"reason": "malformed"})
        sig = signing.verify_signature(sig_raw, mbytes, keyring)
        if not sig["valid"]:
            raise PackageError(422, "package_signature_invalid", "החתימה על החבילה אינה תקפה.", {"reason": sig["reason"]})
        # every file: listed, present, same size and hash; nothing unlisted
        listed = manifest.get("files")
        if not isinstance(listed, list):
            raise PackageError(422, "package_malformed", "רשימת הקבצים בחבילה פגומה.", {"path": "manifest.json"})
        seen: set[str] = set()
        problems: list[dict[str, str]] = []
        for f in listed:
            path = f.get("path") if isinstance(f, dict) else None
            if not isinstance(path, str) or path in seen or not isinstance(f.get("sha256"), str) or not SHA_RE.match(f["sha256"]):
                problems.append({"path": zipsafe._s(path) or "?", "reason": "bad_entry"})
                continue
            seen.add(path)
            if path not in names:
                problems.append({"path": zipsafe._s(path) or "?", "reason": "missing"})
                continue
            try:
                digest, n = zipsafe.hash_member(z, path)
            except (zipfile.BadZipFile, OSError, EOFError, ValueError):
                problems.append({"path": path, "reason": "unreadable"})
                continue
            if digest != f["sha256"] or n != f.get("bytes"):
                problems.append({"path": path, "reason": "changed"})
        for n in names:
            if n not in CONTROL_NAMES and n not in seen:
                problems.append({"path": n, "reason": "unlisted"})
        if problems:
            raise PackageError(422, "package_tampered", "תוכן החבילה אינו תואם את הרשימה החתומה.", {"files": problems[:20]})
        doc = _json(z, "plan.json", MAX_JSON_BYTES)
        rooms = _json(z, "rooms.json", MAX_JSON_BYTES).get("rooms", []) if "rooms.json" in names else []
        anchors = _json(z, "anchors.json", MAX_JSON_BYTES).get("anchors", []) if "anchors.json" in names else []
        cat_raw = _json(z, "catalog.json", MAX_JSON_BYTES) if "catalog.json" in names else {"format": CATALOG_FORMAT, "items": []}
    if not isinstance(doc, dict):
        raise PackageError(422, "package_malformed", "המבנה בחבילה פגום.", {"path": "plan.json"})
    if doc.get("schema_version") != pg.SCHEMA_VERSION:
        raise PackageError(422, "package_doc_version", "גרסת המבנה בחבילה אינה נתמכת.", {"schema_version": zipsafe._s(doc.get("schema_version")), "supported": pg.SCHEMA_VERSION})
    mdoc = manifest.get("document") if isinstance(manifest.get("document"), dict) else {}
    if mdoc.get("doc_hash") != store.doc_hash(doc):
        raise PackageError(422, "package_tampered", "תוכן החבילה אינו תואם את הרשימה החתומה.", {"files": [{"path": "plan.json", "reason": "doc_hash"}]})
    if not isinstance(rooms, list) or not isinstance(anchors, list) or not isinstance(cat_raw, dict) or cat_raw.get("format") != CATALOG_FORMAT or not isinstance(cat_raw.get("items"), list):
        raise PackageError(422, "package_malformed", "קובץ נלווה בחבילה פגום.")
    rooms = [r for r in rooms if isinstance(r, dict)][: pg.LIMITS["rooms"] * 4]
    anchors = [a for a in anchors if isinstance(a, dict) and a.get("resource_type") in pg.ANCHOR_TYPES and isinstance(a.get("resource_id"), str)][:5000]
    items = [i for i in cat_raw["items"] if isinstance(i, dict) and isinstance(i.get("id"), str)][:500]
    warnings: list[str] = []
    if _version_tuple(manifest.get("app_version")) > _version_tuple(__version__):
        warnings.append("newer_app_version")
    return Package(manifest=manifest, signature=sig, doc=doc, rooms=rooms, anchors=anchors, custom_items=items, package_sha256=package_sha, warnings=warnings)


def origin(pkg: Package, local_iid: str | None) -> dict[str, Any]:
    """What the import screen shows about where the package came from (text cleaned: it is shown and audited)."""
    m = pkg.manifest
    plan = m.get("plan") if isinstance(m.get("plan"), dict) else {}
    inst = m.get("installation") if isinstance(m.get("installation"), dict) else {}
    iid = zipsafe._s(inst.get("id"), 64)
    doc = m.get("document") if isinstance(m.get("document"), dict) else {}
    return {"floor_name": zipsafe._s(plan.get("floor_name")), "plan_version_id": zipsafe._s(plan.get("plan_version_id"), 64), "stage": zipsafe._s(plan.get("stage"), 16),
            "generated_at": zipsafe._ts(m.get("generated_at")), "generated_by": zipsafe._s(m.get("generated_by"), 120), "app_version": zipsafe._s(m.get("app_version"), 40),
            "installation_id": iid, "same_installation": bool(iid and local_iid and iid == local_iid),
            "trust": pkg.signature["trust"], "kid": pkg.signature.get("kid"), "retired_key": pkg.signature.get("retired"),
            "doc_hash": zipsafe._s(doc.get("doc_hash"), 64), "geometry_hash": zipsafe._s(doc.get("geometry_hash"), 64), "package_sha256": pkg.package_sha256}


# ---------------------------------------------------------------- the import plan

def _merge(current: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """The current document plus the package's items: an id already present takes the package's copy, nothing is removed."""
    out = copy.deepcopy(current)
    for coll in pg.COLLECTIONS:
        mine = [i for i in out.get(coll) or [] if isinstance(i, dict)]
        index = {i.get("id"): n for n, i in enumerate(mine)}
        for item in incoming.get(coll) or []:
            if not isinstance(item, dict):
                continue
            n = index.get(item.get("id"))
            if n is None:
                index[item.get("id")] = len(mine)
                mine.append(copy.deepcopy(item))
            else:
                mine[n] = copy.deepcopy(item)
        out[coll] = mine
    if out.get("floor_height_m") is None and incoming.get("floor_height_m") is not None:
        out["floor_height_m"] = incoming["floor_height_m"]
    return out


def _same_drawing(doc: dict[str, Any], target: dict[str, Any]) -> bool:
    a, b = doc.get("source") or {}, target.get("source") or {}
    da, db = doc.get("dimensions") or {}, target.get("dimensions") or {}
    return (a.get("sha256") == b.get("sha256") and da.get("width_px") == db.get("width_px") and da.get("height_px") == db.get("height_px")
            and pg.canonical_json(doc.get("transform") or {}) == pg.canonical_json(target.get("transform") or {}))


def _local_item_values(r: sqlite3.Row) -> dict[str, Any]:
    return plan_catalog.custom_values(_custom_record(r))


def plan(conn: sqlite3.Connection, version: sqlite3.Row, pkg: Package, mode: str, *, can_manage_catalog: bool) -> dict[str, Any]:
    """The dry run: the document the import would store (prepared exactly as a save prepares it), the diff against the
    current draft, the issues, and the entities the package names that this installation or floor lacks."""
    if mode not in MODES:
        raise PackageError(422, "validation", "מצב ייבוא לא מוכר.", {"modes": list(MODES)})
    current, draft = store.working_doc(conn, version)
    incoming = pg.rebase(pkg.doc, version, store._asset(conn, version))
    drawing_ok = _same_drawing(pkg.doc, current)
    # custom items: what the document needs, what this installation has, what the package brings
    needed = sorted({str(o.get("item_id")) for o in pkg.doc.get("objects") or [] if isinstance(o, dict) and o.get("item_id")} - plan_catalog.builtin_ids())
    brought = {i["id"]: i for i in pkg.custom_items}
    to_add: list[dict[str, Any]] = []
    items_missing: list[str] = []
    items_differ: list[str] = []
    for iid in needed:
        local = conn.execute("SELECT * FROM catalog_items WHERE id = ?", (iid,)).fetchone()
        src = brought.get(iid)
        if local is not None:
            try:
                if src is not None and plan_catalog.custom_values(src) != _local_item_values(local):
                    items_differ.append(iid)
            except ValueError:
                items_differ.append(iid)
            continue
        if src is None or not plan_catalog.ID_RE.match(iid) or not can_manage_catalog:
            items_missing.append(iid)
            continue
        try:
            to_add.append({"id": iid, "values": plan_catalog.custom_values(src), "created_at": src.get("created_at") if isinstance(src.get("created_at"), str) else None})
        except ValueError:
            items_missing.append(iid)
    index = plan_catalog.item_index(conn)
    for a in to_add:  # the validator and the normaliser see the items the import will add
        index[a["id"]] = plan_catalog.row_item({"id": a["id"], **a["values"], "created_by": None, "created_at": None, "updated_at": None})
    merged = incoming if mode == "replace" else _merge(current, incoming)
    if not drawing_ok:
        unc = merged.get("uncertainty") if isinstance(merged.get("uncertainty"), dict) else {"overall": 0.5, "notes": []}
        note = "המבנה יובא מחבילה של שרטוט אחר, בלי יישור — בדוק מיקומים."
        merged = {**merged, "uncertainty": {**unc, "notes": [*[n for n in unc.get("notes", []) if n != note], note]}}
    structural = [i for i in pg.validate(merged, index) if i["structural"]]
    if structural:
        raise PackageError(422, "geometry_structure", "מבנה המסמך בחבילה אינו תקין; לא יובא דבר.", {"issues": structural[:50]})
    prepared = store._prepare(conn, version, merged, index)  # exactly what save_draft will store once the items are added
    issues = [i for i in pg.validate(prepared, index) if not i["structural"]] + store.anchor_issues(conn, version["floor_id"], prepared) + store.link_issues(conn, version["floor_id"], prepared)
    # the entities the package names: present on this installation? placed on this floor?
    placed = store.anchor_positions(conn, version["floor_id"])
    anchors_missing: list[dict[str, Any]] = []
    anchors_unplaced: list[dict[str, Any]] = []
    for a in pkg.anchors:
        rtype, rid = a["resource_type"], a["resource_id"]
        entry = {"resource_type": rtype, "resource_id": zipsafe._s(rid, 120), "name": zipsafe._s(a.get("name"), 120)}
        if rtype == "camera":
            exists = conn.execute("SELECT 1 FROM cameras WHERE id = ?", (rid,)).fetchone() is not None
        else:
            exists = conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (rid,)).fetchone() is not None
        if not exists:
            anchors_missing.append(entry)
        elif f"{rtype}:{rid}" not in placed:
            anchors_unplaced.append(entry)
    switches = sorted({str(k.get("switch_entity_id")) for k in prepared.get("circuits") or [] if isinstance(k, dict) and k.get("switch_entity_id")})
    switches_missing = [s for s in switches if conn.execute("SELECT 1 FROM ha_entities WHERE entity_id = ? AND removed_at IS NULL", (s,)).fetchone() is None]
    zones = conn.execute("SELECT id, name FROM spatial_zones WHERE floor_id = ? AND deleted_at IS NULL", (version["floor_id"],)).fetchall()
    zone_ids = {z["id"] for z in zones}
    zone_names = {(z["name"] or "").strip() for z in zones}
    rooms_missing = [zipsafe._s(r.get("name"), 120) or zipsafe._s(r.get("id"), 64) for r in pkg.rooms
                     if r.get("id") not in zone_ids and str(r.get("name") or "").strip() not in zone_names]
    result_hash = store.doc_hash(prepared)
    return {
        "mode": mode, "doc": prepared, "result_hash": result_hash, "result_geometry_hash": geometry_hash(prepared),
        "base_revision": draft["revision"] if draft is not None else 0, "current_hash": store.doc_hash(current),
        "diff": pg.diff(current, prepared), "counts": pg.counts(prepared), "current_counts": pg.counts(current),
        "same_drawing": drawing_ok, "same_version": (pkg.manifest.get("plan") or {}).get("plan_version_id") == version["id"],
        "issues": issues[:200], "issue_count": len(issues),
        "entities": {"anchors_missing": anchors_missing, "anchors_unplaced": anchors_unplaced, "switches_missing": switches_missing,
                     "items_missing": items_missing, "items_added": [a["id"] for a in to_add], "items_differ": items_differ, "rooms_missing": rooms_missing},
        "warnings": list(pkg.warnings) + ([] if drawing_ok else ["other_drawing"]),
        "_to_add": to_add,
    }


def public(plan_out: dict[str, Any]) -> dict[str, Any]:
    """The plan as the API answers it: without the stored document's body and the internal item rows."""
    return {k: v for k, v in plan_out.items() if k not in ("doc", "_to_add")}
