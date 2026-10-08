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
from typing import IO, Any, Callable

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
# Security review 2.2.0 M3: per-file bounds that match real documents (a plan at every pg.LIMITS bound is a few MB; the
# companions far less) and a shape bound checked on the raw bytes BEFORE json.loads - parsed JSON can be ~25x its size
# (`[{},{},...]`), and deep nesting raises RecursionError - so one package can never cost more than a few tens of MB.
JSON_LIMITS = {"plan.json": 8 * 1024 * 1024, "rooms.json": 2 * 1024 * 1024, "anchors.json": 2 * 1024 * 1024, "catalog.json": 1024 * 1024}
MAX_JSON_BYTES = max(JSON_LIMITS.values())
MAX_JSON_CONTAINERS = 400_000  # objects + arrays in one file (a full plan has ~150k)
MAX_JSON_VALUES = 2_000_000  # separators (`,` and `:`) in one file: bounds the scalars too
MAX_JSON_DEPTH = 64  # a plan nests about 6 deep
MAX_MANIFEST_BYTES = 256 * 1024  # a manifest lists at most 16 files
LIMITS = zipsafe.Limits(max_entries=16, max_uncompressed=128 * 1024 * 1024, max_manifest=MAX_MANIFEST_BYTES, max_ratio=200, ratio_floor=1024 * 1024)
CONTROL_NAMES = ("manifest.json", "MANIFEST.sha256", signing.SIG_NAME)
# PLN2: the optional DXF of the structure, beside the plan picture its IMAGE entity names (assets/background.*), so the
# unpacked assets/ folder opens in CAD with the picture underneath. Only when the exporter asks for it (an older
# importer refuses a file it does not know); on import it is hashed against the signed manifest like every file and
# never parsed. A DXF bigger than MAX_DXF_BYTES is left out (manifest: skipped too_large), and refused on import.
DXF_NAME = "assets/plan.dxf"
MAX_DXF_BYTES = 24 * 1024 * 1024
DATA_NAMES = ("plan.json", "rooms.json", "anchors.json", "catalog.json", "report.html", DXF_NAME)
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


def anchor_visibility(conn: sqlite3.Connection, principal: Any, floor_id: str) -> Callable[[str, str], bool]:
    """Security review 2.2.0 M2: which of the floor's live anchors this caller may see - the rules of the anchors list and
    the floor bundle (T055 / CR-024): a camera denied by the caller's camera scope (map.read) is not shown, the cameras of
    a removed recorder are not on the current map, and a camera-only reader (no binding on the floor) sees no entities."""
    from ..routers.anchors import removed_recorder_cameras
    from .access import camera_scope, floor_reach

    scope = camera_scope(conn, principal, "map.read")
    gone = removed_recorder_cameras(conn)
    camera_only = floor_reach(conn, principal, floor_id) != "floor"

    def visible(resource_type: str, resource_id: str) -> bool:
        if resource_type == "camera":
            return scope.allows(resource_id) and resource_id not in gone
        return not camera_only

    return visible


def anchor_records(conn: sqlite3.Connection, floor_id: str, principal: Any) -> list[dict[str, Any]]:
    """The floor's live anchors THIS CALLER may see (anchor_visibility) with a display name: the anchor's label, else the
    camera's alias / NVR name or the entity's name, else the resource id."""
    out: list[dict[str, Any]] = []
    visible = anchor_visibility(conn, principal, floor_id)
    rows = conn.execute("SELECT resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label FROM map_anchors "
                        "WHERE floor_id = ? AND effective_to IS NULL ORDER BY resource_type, resource_id", (floor_id,)).fetchall()
    for r in rows:
        if not visible(r["resource_type"], r["resource_id"]):
            continue
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


def visible_anchor_positions(conn: sqlite3.Connection, principal: Any, floor_id: str) -> dict[str, Any]:
    """The live anchor positions bound objects follow - only those of the anchors this caller may see (review M2)."""
    visible = anchor_visibility(conn, principal, floor_id)
    return {k: p for k, p in store.anchor_positions(conn, floor_id).items() if visible(*k.split(":", 1))}


def dxf_bytes(conn: sqlite3.Connection, version: sqlite3.Row, floor: sqlite3.Row | None, doc: dict[str, Any], stage: str, zones: list[dict[str, Any]],
              principal: Any, *, anchors: list[dict[str, Any]] | None = None, level: str | None = None, layers: Any = None,
              background: dict[str, Any] | None = None) -> bytes:
    """The DXF of `doc` as the export route and the package draw it: the caller's visible anchors only (review M2)."""
    from . import plan_dxf_export as dxf_export

    return dxf_export.render_dxf(doc, zones, version["width_px"], version["height_px"], level=level, layers=layers,
                                 anchors=anchor_records(conn, version["floor_id"], principal) if anchors is None else anchors,
                                 anchor_positions=visible_anchor_positions(conn, principal, version["floor_id"]), items=plan_catalog.item_index(conn),
                                 meta={"SW_PLAN_VERSION": version["id"], "SW_FLOOR": (floor["name"] if floor is not None else "") or "", "SW_STAGE": stage,
                                       "SW_DOC_HASH": store.doc_hash(doc)}, background=background)


def _picture_size(path: Path, fallback: tuple[int, int]) -> tuple[int, int]:
    """The plan picture's pixel size (read from its header only), else the version's size."""
    try:
        from PIL import Image

        with Image.open(path) as im:
            w, h = im.size
        return (int(w), int(h)) if w > 0 and h > 0 else fallback
    except Exception:  # noqa: BLE001 - a picture PIL cannot read still gets a frame of the plan's size
        return fallback


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
          actor: Any, installation: str | None, revision: int | None = None, *, include_dxf: bool = False) -> tuple[bytes, dict[str, Any]]:
    """The signed package of `doc` (the stored document of `version`, draft or published). Returns (zip bytes, manifest).
    `include_dxf` (PLN2): also assets/plan.dxf, whose IMAGE entity names the picture beside it (DXF_NAME)."""
    files: list[dict[str, Any]] = []
    buf = io.BytesIO()
    plan_bytes = pg.canonical_json(doc).encode("utf-8")
    rooms = [room_record(z) for z in sorted(zones, key=lambda z: str(z.get("id")))]
    anchors = anchor_records(conn, version["floor_id"], actor)  # review M2: only the anchors the exporting person may see
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
        background = None
        if picture is not None and picture.is_file():
            bname = f"background.{_ext(picture.name, 'png')}"
            add(f"assets/{bname}", picture.read_bytes(), "background")
            bw, bh = _picture_size(picture, (int(version["width_px"] or 0), int(version["height_px"] or 0)))
            background = {"file_name": bname, "width_px": bw, "height_px": bh}
        dxf_info = None
        if include_dxf:
            dxf_data = dxf_bytes(conn, version, floor, doc, stage, zones, actor, anchors=anchors, background=background)
            if len(dxf_data) <= MAX_DXF_BYTES:
                add(DXF_NAME, dxf_data, "dxf")
                dxf_info = {"path": DXF_NAME, "background": f"assets/{background['file_name']}" if background else None, "included": True, "skipped": None}
            else:
                dxf_info = {"path": None, "background": None, "included": False, "skipped": "too_large"}
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
        if dxf_info is not None:
            manifest["dxf"] = dxf_info
        add("report.html", _report(manifest, rooms, anchors, customs).encode("utf-8"), "report")
        manifest["files"] = files
        mbytes = json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8")
        z.writestr("manifest.json", mbytes)
        z.writestr("MANIFEST.sha256", _sha(mbytes) + "  manifest.json\n")
        sig = signing.sign_manifest(settings, mbytes)
        z.writestr(signing.SIG_NAME, json.dumps(sig, ensure_ascii=False, indent=2).encode("utf-8"))
    manifest["signature_info"] = {"alg": sig["alg"], "kid": sig["kid"]}
    return buf.getvalue(), manifest


def _dxf_note(info: dict[str, Any] | None) -> str:
    if not info:
        return ""
    if not info.get("included"):
        return "<h2>שרטוט DXF</h2><p>השרטוט גדול מדי ולא נכלל בחבילה.</p>"
    pic = f' עם תמונת התוכנית <span dir="ltr">{html.escape(info["background"])}</span> לצדו' if info.get("background") else ""
    return f'<h2>שרטוט DXF</h2><p><span dir="ltr">{html.escape(info["path"])}</span>{pic}.</p>'


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
{_dxf_note(manifest.get("dxf"))}
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


_JSON_STRING = re.compile(rb'"[^"\\]*(?:\\.[^"\\]*)*"', re.S)
_JSON_BRACKET = re.compile(rb"[\[\]{}]")


def json_shape_problem(raw: bytes, *, max_containers: int = MAX_JSON_CONTAINERS, max_values: int = MAX_JSON_VALUES,
                       max_depth: int = MAX_JSON_DEPTH) -> str | None:
    """Why this JSON text is too costly to parse, judged on the bytes (strings blanked first, so brackets and separators
    inside them do not count): too many objects / arrays, too many values, or nested too deep. None = fine."""
    bare = _JSON_STRING.sub(b'""', raw)
    if bare.count(b"{") + bare.count(b"[") > max_containers:
        return "too_many_containers"
    if bare.count(b",") + bare.count(b":") > max_values:
        return "too_many_values"
    depth = 0
    for m in _JSON_BRACKET.finditer(bare):
        if m.group() in (b"{", b"["):
            depth += 1
            if depth > max_depth:
                return "too_deep"
        else:
            depth -= 1
    return None


def _parse_json(raw: bytes, name: str) -> Any:
    problem = json_shape_problem(raw)
    if problem:
        raise PackageError(422, "package_too_complex", "קובץ בחבילה מורכב מדי לעיבוד.", {"path": name, "reason": problem})
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError, RecursionError, MemoryError) as exc:  # review M3: never a 500
        raise PackageError(422, "package_malformed", "קובץ בחבילה אינו JSON תקין.", {"path": name, "error": type(exc).__name__})


def _json(z: zipfile.ZipFile, name: str, limit: int) -> Any:
    info = z.getinfo(name)
    if info.file_size > limit:
        raise PackageError(422, "package_file_too_large", "קובץ בחבילה גדול מהמותר.", {"path": name, "max_bytes": limit})
    try:
        raw = z.read(name)
    except (zipfile.BadZipFile, EOFError, OSError, ValueError) as exc:
        raise PackageError(422, "package_malformed", "קובץ בחבילה אינו JSON תקין.", {"path": name, "error": type(exc).__name__})
    if len(raw) > limit:
        raise PackageError(422, "package_file_too_large", "קובץ בחבילה גדול מהמותר.", {"path": name, "max_bytes": limit})
    return _parse_json(raw, name)


def _member(raw: Any, key: str, name: str) -> Any:
    if not isinstance(raw, dict):
        raise PackageError(422, "package_malformed", "קובץ נלווה בחבילה פגום.", {"path": name})
    return raw.get(key, [])


def _version_tuple(v: Any) -> tuple[int, ...]:
    try:
        return tuple(int(x) for x in str(v).split(".")[:3])
    except ValueError:
        return ()


def needs_trust(sig: dict[str, Any]) -> str | None:
    """Security review 2.2.0 L7: why importing a package signed this way needs the person's explicit confirmation - a key
    that is not this installation's (`foreign_key`) or one of ours that was retired, e.g. after a suspected leak
    (`retired_key`). None = signed by a current key of this installation."""
    if sig.get("trust") != "installation":
        return "foreign_key"
    if sig.get("retired"):
        return "retired_key"
    return None


def read(fp: IO[bytes], keyring: dict[str, Any] | None, *, accept_foreign: bool | None = None, local_iid: str | None = None) -> Package:
    """Open, check and parse an uploaded package. Raises PackageError for anything refused. `accept_foreign=False`
    (review M3): a package that needs_trust() is refused (409 `package_foreign`, with the origin to show) right after its
    signature is checked - BEFORE its files are hashed and its JSON parsed; None = no trust gate here."""
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
        if DXF_NAME in names and z.getinfo(DXF_NAME).file_size > MAX_DXF_BYTES:  # PLN2: hashed only, never parsed - still bounded
            raise PackageError(422, "package_file_too_large", "קובץ בחבילה גדול מהמותר.", {"path": DXF_NAME, "max_bytes": MAX_DXF_BYTES})
        mbytes = z.read("manifest.json")
        manifest = _parse_json(mbytes, "manifest.json")
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
        why = needs_trust(sig)
        if why and accept_foreign is False:
            raise PackageError(409, "package_foreign", RETIRED_HE if why == "retired_key" else FOREIGN_HE,
                               {"reason": why, "kid": sig.get("kid"), "origin": origin_of(manifest, sig, package_sha, local_iid)})
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
        doc = _json(z, "plan.json", JSON_LIMITS["plan.json"])
        rooms = _member(_json(z, "rooms.json", JSON_LIMITS["rooms.json"]), "rooms", "rooms.json") if "rooms.json" in names else []
        anchors = _member(_json(z, "anchors.json", JSON_LIMITS["anchors.json"]), "anchors", "anchors.json") if "anchors.json" in names else []
        cat_raw = _json(z, "catalog.json", JSON_LIMITS["catalog.json"]) if "catalog.json" in names else {"format": CATALOG_FORMAT, "items": []}
    if not isinstance(doc, dict):
        raise PackageError(422, "package_malformed", "המבנה בחבילה פגום.", {"path": "plan.json"})
    if doc.get("schema_version") not in pg.SCHEMA_VERSIONS:  # 2.1 = window walls; a server older than 2.1 refuses it here
        raise PackageError(422, "package_doc_version", "גרסת המבנה בחבילה אינה נתמכת.", {"schema_version": zipsafe._s(doc.get("schema_version")), "supported": pg.SCHEMA_VERSIONS[-1]})
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


FOREIGN_HE = "החבילה חתומה במפתח של מערכת אחרת; אשר את המקור כדי לייבא."
RETIRED_HE = "החבילה חתומה במפתח של המערכת הזו שהוצא משימוש; אשר את המקור כדי לייבא."


def origin(pkg: Package, local_iid: str | None) -> dict[str, Any]:
    """What the import screen shows about where the package came from (text cleaned: it is shown and audited)."""
    return origin_of(pkg.manifest, pkg.signature, pkg.package_sha256, local_iid)


def origin_of(m: dict[str, Any], signature: dict[str, Any], package_sha256: str, local_iid: str | None) -> dict[str, Any]:
    plan = m.get("plan") if isinstance(m.get("plan"), dict) else {}
    inst = m.get("installation") if isinstance(m.get("installation"), dict) else {}
    iid = zipsafe._s(inst.get("id"), 64)
    doc = m.get("document") if isinstance(m.get("document"), dict) else {}
    return {"floor_name": zipsafe._s(plan.get("floor_name")), "plan_version_id": zipsafe._s(plan.get("plan_version_id"), 64), "stage": zipsafe._s(plan.get("stage"), 16),
            "generated_at": zipsafe._ts(m.get("generated_at")), "generated_by": zipsafe._s(m.get("generated_by"), 120), "app_version": zipsafe._s(m.get("app_version"), 40),
            "installation_id": iid, "same_installation": bool(iid and local_iid and iid == local_iid),
            "trust": signature["trust"], "kid": signature.get("kid"), "retired_key": signature.get("retired"),
            "doc_hash": zipsafe._s(doc.get("doc_hash"), 64), "geometry_hash": zipsafe._s(doc.get("geometry_hash"), 64), "package_sha256": package_sha256}


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
