"""Security review 2.4.6 (docs/security/SECURITY_REVIEW_246_2026-10-11.md): regression tests of the fixed findings (task SEC246-fixes).

The file started as the review's proofs of concept, which asserted the UNFIXED behaviour; every finding they covered (L1, L2, L3, L4,
I1, I2) is fixed now, so each proof is inverted here into a test of the FIXED behaviour, next to the new tests of the limits (I3, I4,
I5 and the decode guard). Fakes and the in-process test client only; no device, no Home Assistant, no network."""
from __future__ import annotations

import io
import json
import os
import re
import sqlite3
import sys
import threading
import time
import uuid
import zipfile
from contextlib import contextmanager
from dataclasses import replace
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import as_user, bind, png_bytes, sw_time_factor  # noqa: E402
from test_devices import AREAS, ENTITY_REGISTRY, FLOORS, _body, _judge, _reg, bulk_app, dev_app  # noqa: E402,F401  (fixtures)
from test_self_update import NEWER, sup, world  # noqa: E402,F401  (fixtures)
from test_self_update_s3 import apply_body, audit_rows, j, rig  # noqa: E402,F401  (fixtures)

from smplwise.main import create_app  # noqa: E402

BG = "/api/v1/settings/background"


def _flat_png(w: int, h: int, mode: str = "1") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, (w, h), 0).save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _noise(w: int, h: int, fmt: str, **save) -> bytes:
    buf = io.BytesIO()
    Image.frombytes("RGB", (w, h), os.urandom(w * h * 3)).save(buf, format=fmt, **save)
    return buf.getvalue()


def _bg_dir(settings) -> Path:
    return Path(settings.data_dir) / "ui_backgrounds"


# ---------------------------------------------------------------------------------------------- L1: pixel budget before the decode

def test_l1_a_huge_dimension_png_of_a_few_kb_is_refused_before_any_decode(settings, monkeypatch):
    """Was: a 7000 x 7000 flat PNG reached the full decode (201). Now the header-declared size is judged first: 422 too_many_pixels,
    quickly, and no pixel is decoded (exif_transpose / convert never run)."""
    from PIL import ImageOps

    decoded: list = []
    monkeypatch.setattr(ImageOps, "exif_transpose", lambda im, *a, **k: decoded.append(im.size) or im)
    with TestClient(create_app(settings)) as c:
        for w, h in ((7000, 7000), (10900, 10900)):
            data = _flat_png(w, h)
            assert len(data) < 64 * 1024
            t0 = time.perf_counter()
            r = c.post(f"{BG}/day", files={"file": ("d.png", data, "image/png")})
            took = time.perf_counter() - t0
            assert r.status_code == 422, r.text
            assert r.json()["code"] == "too_many_pixels" and r.json()["details"]["width"] == w and r.json()["details"]["height"] == h
            assert took < 2.0 * sw_time_factor(), f"{w}x{h} took {took:.2f} s"
        assert decoded == [], "no pixel of a refused picture is decoded"
        assert c.get(f"{BG}/day").status_code == 404
    assert not list(_bg_dir(settings).glob("*.jpg"))


def test_l1_a_pixel_bomb_beyond_pillows_threshold_is_a_clean_4xx():
    """Above twice Pillow's threshold Image.open itself refuses (DecompressionBombError): still a clean 422, never a 500."""
    from smplwise.errors import ApiError
    from smplwise.routers import ui_background

    try:
        ui_background.reencode(_flat_png(12000, 12000))
        raise AssertionError("expected a refusal")
    except ApiError as exc:
        assert exc.status == 422 and exc.code == "too_many_pixels"


def test_l1_a_phone_photo_within_the_documented_size_is_accepted_and_re_encoded(settings):
    """A JPEG of a phone's size class (above the old 1 MiB body limit, below 12 MB) with EXIF: 201, stored as a fresh JPEG of at most
    2560 px, no EXIF, the orientation applied. The JPEG is decoded at a reduced scale (draft)."""
    from smplwise.routers import ui_background

    img = Image.frombytes("RGB", (3000, 2250), os.urandom(3000 * 2250 * 3))
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # Make
    exif[0x0112] = 6  # orientation: rotate 90
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80, exif=exif.tobytes())
    data = buf.getvalue()
    assert 1024 * 1024 < len(data) < ui_background.IMAGE_MAX_BYTES, len(data)
    with TestClient(create_app(settings)) as c:
        r = c.post(f"{BG}/night", files={"file": ("IMG_0001.jpg", data, "image/jpeg")})
        assert r.status_code == 201, r.text
        assert r.json()["images"]["night"]
        g = c.get(f"{BG}/night")
    assert g.status_code == 200 and g.content.startswith(b"\xff\xd8") and g.content != data
    with Image.open(io.BytesIO(g.content)) as out:
        assert out.format == "JPEG" and max(out.size) <= ui_background.IMAGE_MAX_PX
        assert out.size[1] > out.size[0], "the EXIF orientation was applied"
        assert not out.getexif(), "no EXIF in the stored picture"


def test_i1_a_background_over_one_mib_is_no_longer_refused_by_the_default_body_limit(settings):
    """Was: 413 at the request body stage with max_bytes 1 MiB. Now the route has its own body-limit row (12 MiB + framing)."""
    data = _noise(800, 700, "PNG")
    assert 1024 * 1024 < len(data) < 12 * 1024 * 1024
    with TestClient(create_app(settings)) as c:
        r = c.post(f"{BG}/day", files={"file": ("photo.png", data, "image/png")})
    assert r.status_code == 201, r.text


def test_i1_the_body_limit_row_matches_the_documented_cap(settings):
    from smplwise import body_limit
    from smplwise.routers import ui_background

    limit, rule = body_limit.route_limit("POST", "/api/v1/settings/background/day", settings)
    assert rule == "ui_background" and limit == ui_background.IMAGE_MAX_BYTES + body_limit.MULTIPART_SLACK
    assert body_limit.route_limit("DELETE", "/api/v1/settings/background/day", settings)[1] == "default"
    big = b"\xff\xd8" + b"\0" * (ui_background.IMAGE_MAX_BYTES + body_limit.MULTIPART_SLACK)
    with TestClient(create_app(settings)) as c:
        r = c.post(f"{BG}/day", files={"file": ("big.jpg", big, "image/jpeg")})
    assert r.status_code == 413, r.text
    assert r.json()["details"]["stage"] == "request_body" and r.json()["details"]["rule"] == "ui_background"


def test_l1_one_decode_at_a_time_a_waiting_upload_gets_429_after_the_wait(settings, monkeypatch):
    """The decode guard: while another decode holds the slot, an upload waits DECODE_WAIT_S, then 429 busy (retryable)."""
    from smplwise.routers import ui_background

    monkeypatch.setattr(ui_background, "DECODE_WAIT_S", 0.2)
    with TestClient(create_app(settings)) as c:
        assert ui_background._DECODE.acquire(timeout=1)
        try:
            r = c.post(f"{BG}/day", files={"file": ("d.png", png_bytes(), "image/png")})
        finally:
            ui_background._DECODE.release()
        assert r.status_code == 429 and r.json()["code"] == "busy" and r.json()["retryable"] is True, r.text
        assert c.post(f"{BG}/day", files={"file": ("d.png", png_bytes(), "image/png")}).status_code == 201


# ---------------------------------------------------------------------------------------------- I4: same-slot uploads

def test_i4_concurrent_uploads_of_one_slot_publish_one_whole_picture(settings):
    """Two uploads of the same slot at once: both answer 201 (the second waits for the decode slot), the stored file is one complete
    JPEG (one of the two), no temporary file is left behind."""
    pics = [_noise(1200, 900, "PNG"), _noise(900, 1200, "PNG")]
    answers: list = []
    with TestClient(create_app(settings)) as c:
        def up(data: bytes) -> None:
            answers.append(c.post(f"{BG}/day", files={"file": ("d.png", data, "image/png")}))

        ts = [threading.Thread(target=up, args=(p,)) for p in pics]
        for t in ts:
            t.start()
        for t in ts:
            t.join(timeout=60)
        assert [r.status_code for r in answers] == [201, 201], [r.text for r in answers]
        g = c.get(f"{BG}/day")
    with Image.open(io.BytesIO(g.content)) as out:
        out.load()
        assert out.format == "JPEG" and out.size in ((1200, 900), (900, 1200))
    assert not [p.name for p in _bg_dir(settings).iterdir() if p.name.endswith(".tmp")]


def test_i4_every_writer_gets_its_own_temporary_name(tmp_path, monkeypatch):
    import tempfile

    from smplwise.routers import ui_background

    names: list[str] = []
    real = tempfile.mkstemp

    def spy(*a, **k):
        fd, name = real(*a, **k)
        names.append(name)
        return fd, name

    monkeypatch.setattr(tempfile, "mkstemp", spy)
    target = tmp_path / "day.jpg"
    blobs = [bytes([i]) * 50_000 for i in range(8)]
    errors: list = []

    def write(b: bytes) -> None:
        for _ in range(20):  # Windows: a replace over a file another thread is replacing at that instant may be refused; retry
            try:
                ui_background.write_atomic(target, b)
                return
            except PermissionError as exc:
                errors.append(exc)
                time.sleep(0.01)

    ts = [threading.Thread(target=write, args=(b,)) for b in blobs]
    for t in ts:
        t.start()
    for t in ts:
        t.join(timeout=30)
    assert len(set(names)) == len(names) >= 8, "no two writers share a temporary name"
    assert target.read_bytes() in blobs, "the file is one writer's whole content"
    assert [p.name for p in tmp_path.iterdir()] == ["day.jpg"], "no temporary file is left"


# ---------------------------------------------------------------------------------------------- I2: restored picture bytes

def _restore_with(settings, tmp_path, member_bytes: bytes):
    with TestClient(create_app(settings)) as c:
        assert c.post(f"{BG}/night", files={"file": ("n.png", png_bytes(), "image/png")}).status_code == 201
        name = c.post("/api/v1/backups", json={"note": "i2"}).json()["name"]
        raw = c.get(f"/api/v1/backups/{name}/download").content
    src, out = zipfile.ZipFile(io.BytesIO(raw)), io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for info in src.infolist():
            z.writestr(info, member_bytes if info.filename == "files/ui_backgrounds/night.jpg" else src.read(info.filename))
    settings2 = replace(settings, data_dir=tmp_path / "data2")
    c2 = TestClient(create_app(settings2))
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", out.getvalue(), "application/zip")})
    assert up.status_code == 201, up.text
    res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert res.status_code == 200, res.text
    return c2, res.json(), settings2


def test_i2_a_restored_non_picture_is_not_written_and_never_served(settings, tmp_path):
    """Was: an SVG with a script in the archive was restored byte for byte and served as image/jpeg. Now a restored background gets
    the upload's content guarantee again; this one fails it, is not written, and the slot answers 404."""
    payload = b"<svg xmlns='http://www.w3.org/2000/svg'><script>parent.alert(1)</script></svg>"
    c2, result, s2 = _restore_with(settings, tmp_path, payload)
    assert result["backgrounds_rejected"] == [{"file": "ui_backgrounds/night.jpg", "code": "unsupported_format"}]
    assert c2.get(f"{BG}/night").status_code == 404
    assert not (_bg_dir(s2) / "night.jpg").exists()


def test_i2_a_restored_picture_is_re_encoded_and_served_with_nosniff(settings, tmp_path):
    """A real picture with bytes appended after it: restored as a fresh JPEG (the appended bytes gone), served image/jpeg + nosniff."""
    tail = b"<html><script>alert(1)</script></html>"
    c2, result, _s2 = _restore_with(settings, tmp_path, png_bytes() + tail)
    assert result["backgrounds_rejected"] == []
    g = c2.get(f"{BG}/night")
    assert g.status_code == 200 and g.content.startswith(b"\xff\xd8") and tail not in g.content
    assert g.headers["content-type"] == "image/jpeg" and g.headers["x-content-type-options"] == "nosniff"


# ---------------------------------------------------------------------------------------------- I3: one Pillow threshold

def test_i3_no_module_but_image_guard_writes_pillows_process_wide_threshold(settings):
    from PIL import Image as PILImage

    from smplwise.services import floor_images, image_guard, plan_render, wall_photos  # noqa: F401

    root = Path(image_guard.__file__).resolve().parents[1]
    writers = sorted(p.relative_to(root).as_posix() for p in root.rglob("*.py") if re.search(r"MAX_IMAGE_PIXELS\s*=(?!=)", p.read_text(encoding="utf-8")))
    assert writers == ["services/image_guard.py"], writers
    assert PILImage.MAX_IMAGE_PIXELS == image_guard.PILLOW_MAX_IMAGE_PIXELS
    buf = io.BytesIO()
    PILImage.new("RGB", (200, 200)).save(buf, format="PNG")
    floor_images.validate(buf.getvalue())
    sid = wall_photos.create_set(settings, "i3")["id"]
    wall_photos.add_photo(settings, sid, buf.getvalue())
    assert PILImage.MAX_IMAGE_PIXELS == image_guard.PILLOW_MAX_IMAGE_PIXELS, "a call no longer moves the shared value"
    # each module keeps its own ceiling as an explicit check
    big = io.BytesIO()
    PILImage.new("L", (6100, 6100)).save(big, format="PNG")
    try:
        floor_images.validate(big.getvalue())
        raise AssertionError("floor_images keeps its 36 MP ceiling")
    except floor_images.FloorImageError as exc:
        assert exc.code == "too_many_pixels"
    wall = io.BytesIO()
    PILImage.new("1", (6400, 6400)).save(wall, format="PNG")  # 41 MP > wall_photos' 40 MP
    try:
        wall_photos.add_photo(settings, sid, wall.getvalue())
        raise AssertionError("wall_photos keeps its 40 MP ceiling")
    except wall_photos.PhotoError as exc:
        assert exc.code == "too_many_pixels"


# ---------------------------------------------------------------------------------------------- I5: update page + refusal audit

def test_i5_the_page_offers_only_a_strictly_newer_version(rig):
    from smplwise.db import set_setting
    from smplwise.services import self_update

    app, c, *_ = rig
    with app.state.db.connection() as conn:
        set_setting(conn, self_update.K_LATEST, "0.0.1")
        set_setting(conn, self_update.K_AVAILABLE, "true")
    s = j(c, "get", "/state").json()
    assert s["latest"] == "0.0.1" and s["update_available"] is False, "an older 'latest' is never offered"
    with app.state.db.connection() as conn:
        set_setting(conn, self_update.K_LATEST, NEWER)
    assert j(c, "get", "/state").json()["update_available"] is True


def test_i5_the_switch_refusal_is_audited_once_as_denied(rig, sup):  # noqa: F811
    app, c, *_ = rig
    sup.latest = NEWER
    assert c.patch("/api/v1/settings", headers=as_user("joni"), json={"update.apply_enabled": "false"}).status_code == 200
    r = j(c, "post", "/apply", json=apply_body())
    assert r.status_code == 409 and r.json()["code"] == "self_update_disabled"
    denied = [x for x in audit_rows(app, "system.update.apply") if x["decision"] == "denied"]
    assert [x["reason"] for x in denied] == ["self_update_disabled"]


# ---------------------------------------------------------------------------------------------- L2: typed valve / water heater

def _typed_relays(app, c):
    extra = [{"entity_id": "switch.lobby_relay_3", "state": "off", "attributes": {"friendly_name": "Relay 3"}},
             {"entity_id": "switch.lobby_relay_4", "state": "off", "attributes": {"friendly_name": "Relay 4"}}]
    assert c.post("/api/v1/ha/dev/states", json={"states": extra}).status_code == 200
    reg = ENTITY_REGISTRY + [_reg(e["entity_id"], "lobby") for e in extra]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    _judge(app)
    assert c.put("/api/v1/devices/entities/switch.lobby_relay_3/device-type", json={"kind": "valve"}).status_code == 200
    assert c.put("/api/v1/devices/entities/switch.lobby_relay_4/device-type", json={"kind": "water_heater"}).status_code == 200


def _preview(c, kind="switches_on"):
    return c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": kind}).json()


def test_l2_turn_all_on_leaves_out_a_switch_the_administrator_typed_valve_or_water_heater(bulk_app):
    """Was: both typed relays were `switches_on` targets. Now they are excluded by default (reason sensitive_type, counted in
    skipped), the OFF kinds still reach them, and the single turn-on is unchanged (no confirmation, owner decision)."""
    app, s, c, fake = bulk_app
    _typed_relays(app, c)
    on = _preview(c)
    targets = {t["entity_id"] for t in on["targets"]}
    assert not targets & {"switch.lobby_relay_3", "switch.lobby_relay_4"}
    ex = {x["entity_id"]: x for x in on["excluded"]}
    assert ex["switch.lobby_relay_3"]["reason"] == ex["switch.lobby_relay_4"]["reason"] == "sensitive_type"
    assert "ברז או דוד מים" in ex["switch.lobby_relay_3"]["reason_label"]
    assert on["skipped"]["sensitive_type"] == 2
    off = _preview(c, "switches_off")
    assert not {x["entity_id"] for x in off["excluded"]} & {"switch.lobby_relay_3", "switch.lobby_relay_4"}
    r = c.post("/api/v1/ha/entities/switch.lobby_relay_3/actions", json=_body(client_request_id="l2-single"))
    assert r.status_code == 202, r.text
    assert [p["data"]["entity_id"] for p in fake.calls] == ["switch.lobby_relay_3"]


def test_l2_an_administrator_includes_one_device_audited_and_reset_by_a_type_change(bulk_app):
    app, s, c, fake = bulk_app
    _typed_relays(app, c)
    r = c.put("/api/v1/devices/entities/switch.lobby_relay_3/bulk-on", json={"allowed": True})
    assert r.status_code == 200 and r.json()["bulk_on_allowed"] is True and r.json()["changed"] is True, r.text
    row = next(x for x in c.get("/api/v1/devices/device-types").json()["devices"] if x["entity_id"] == "switch.lobby_relay_3")
    assert row["bulk_on_allowed"] is True
    on = _preview(c)
    assert "switch.lobby_relay_3" in {t["entity_id"] for t in on["targets"]}
    assert {x["entity_id"] for x in on["excluded"] if x["reason"] == "sensitive_type"} == {"switch.lobby_relay_4"}
    assert on["skipped"]["sensitive_type"] == 1
    # not a sensitive type -> refused and audited; an untyped switch cannot be "included"
    r = c.put("/api/v1/devices/entities/switch.lobby_sign/bulk-on", json={"allowed": True})
    assert r.status_code == 409 and r.json()["code"] == "not_sensitive_type"
    assert c.put("/api/v1/devices/entities/switch.lobby_relay_3/bulk-on", json={"allowed": "maybe"}).status_code == 422
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT decision, resource_id, details_json FROM audit_log WHERE action = 'devices.bulk_on_allowed' ORDER BY rowid").fetchall()
    assert [(x["decision"], x["resource_id"]) for x in rows] == [("allowed", "switch.lobby_relay_3"), ("denied", "switch.lobby_sign")]
    assert json.loads(rows[0]["details_json"])["allowed"] is True
    # a new type starts left out again: valve -> water heater drops the inclusion
    assert c.put("/api/v1/devices/entities/switch.lobby_relay_3/device-type", json={"kind": "water_heater"}).status_code == 200
    assert {x["entity_id"] for x in _preview(c)["excluded"] if x["reason"] == "sensitive_type"} == {"switch.lobby_relay_3", "switch.lobby_relay_4"}


def test_l2_the_inclusion_needs_system_configure(bulk_app):
    app, s, c, fake = bulk_app
    _typed_relays(app, c)
    bind(c, s, "omer", "operator", "installation", "*")
    r = c.put("/api/v1/devices/entities/switch.lobby_relay_3/bulk-on", headers=as_user("omer"), json={"allowed": True})
    assert r.status_code == 403
    assert "switch.lobby_relay_3" not in {t["entity_id"] for t in _preview(c)["targets"]}


def test_l2_backup_carries_the_inclusion_and_an_older_archive_leaves_every_typed_device_out(bulk_app):
    app, s, c, fake = bulk_app
    _typed_relays(app, c)
    old = c.post("/api/v1/backups", json={"note": "before the inclusion"}).json()["name"]
    assert c.put("/api/v1/devices/entities/switch.lobby_relay_3/bulk-on", json={"allowed": True}).status_code == 200
    new = c.post("/api/v1/backups", json={"note": "with the inclusion"}).json()["name"]
    body = {"mode": "replace", "scope": "project", "confirm": "RESTORE"}
    assert c.post(f"/api/v1/backups/{old}/restore", json=body).status_code == 200
    assert "switch.lobby_relay_3" not in {t["entity_id"] for t in _preview(c)["targets"]}, "the older archive: left out (safe side)"
    assert c.post(f"/api/v1/backups/{new}/restore", json=body).status_code == 200
    assert "switch.lobby_relay_3" in {t["entity_id"] for t in _preview(c)["targets"]}, "the archive's own inclusion comes back"


# ---------------------------------------------------------------------------------------------- L3: record, then send

def test_l3_a_device_command_is_not_sent_when_its_record_cannot_be_written(bulk_app, monkeypatch):
    """Was: with every `ha.action*` write failing, the command reached the bridge, the request answered 500 and nothing was
    recorded. Now nothing is sent: 503 busy (retryable), no ha_actions row, no `ha.action` row."""
    app, s, _c, fake = bulk_app
    db = app.state.db
    real = db.write_aside

    @contextmanager
    def busy(label=None, **kw):
        if label and label.startswith("ha.action"):
            raise sqlite3.OperationalError("database is locked")
        with real(label=label, **kw) as w:
            yield w

    monkeypatch.setattr(db, "write_aside", busy)
    crid = f"l3-{uuid.uuid4().hex[:8]}"
    c = TestClient(app, raise_server_exceptions=False)
    r = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=_body(allowed_action_id="switch.turn_off", client_request_id=crid))
    assert r.status_code == 503 and r.json()["code"] == "busy" and r.json()["retryable"] is True, r.text
    assert r.json()["details"]["sent"] is False
    assert fake.calls == [], "the command never left"
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE client_request_id = ?", (crid,)).fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.action'").fetchone()[0] == 0


def test_l3_the_pending_row_and_the_attempt_audit_row_are_durable_before_the_call(bulk_app):
    app, s, c, fake = bulk_app
    seen: dict = {}

    def at_call(payload):
        with app.state.db.connection(mode="read") as conn:
            seen["row"] = conn.execute("SELECT status FROM ha_actions WHERE id = ?", (payload["request_id"],)).fetchone()
            seen["audit"] = [json.loads(x[0] or "{}") for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'ha.action' AND reason = 'attempt'").fetchall()]

    fake.on_call = at_call
    r = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=_body(allowed_action_id="switch.turn_off", client_request_id="l3-order"))
    assert r.status_code == 202, r.text
    aid = r.json()["id"]
    assert seen["row"] is not None and seen["row"]["status"] == "pending"
    assert any(a.get("id") == aid and a.get("phase") == "attempt" for a in seen["audit"])
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT reason, details_json FROM audit_log WHERE action = 'ha.action' ORDER BY rowid").fetchall()
    mine = [x["reason"] for x in rows if json.loads(x["details_json"] or "{}").get("id") == aid]
    assert mine[0] == "attempt" and len(mine) == 2, "the attempt row, then the outcome row"


# ---------------------------------------------------------------------------------------------- L4: restore keeps the update switch

def test_l4_a_replace_restore_keeps_the_current_self_update_switch_and_audits_it(settings):
    """Was: restoring an archive written while the switch was on turned installing from Arx back on, with no own audit row. Now the
    current value is kept (never taken from the archive) and the restore writes a `system.update.apply_enabled` row saying so."""
    from smplwise.services import self_update as su

    app = create_app(settings)
    with TestClient(app) as c:
        name = c.post("/api/v1/backups", json={"note": "switch on"}).json()["name"]
        assert c.patch("/api/v1/settings", json={"update.apply_enabled": "false"}).status_code == 200
        res = c.post(f"/api/v1/backups/{name}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
        assert res.status_code == 200, res.text
        assert res.json()["update_apply_enabled"]["kept"] is False
        with app.state.db.connection(mode="read") as conn:
            assert su.apply_enabled(conn) is False
            rows = conn.execute("SELECT reason, details_json FROM audit_log WHERE action = 'system.update.apply_enabled' ORDER BY rowid").fetchall()
    assert len(rows) == 2 and rows[-1]["reason"] == "kept_on_restore"
    d = json.loads(rows[-1]["details_json"])
    assert d["via"] == "restore" and d["kept"] is False and d["archive"] is None, "an archive never carries the switch now"


def test_l4_an_older_archive_that_holds_the_switch_on_never_turns_it_on(settings):
    """An archive written before this fix carries `update.apply_enabled = true`: the restore keeps the current `false` and the audit
    row says the archive differed."""
    from smplwise.services import self_update as su

    app = create_app(settings)
    with TestClient(app) as c:
        name = c.post("/api/v1/backups", json={"note": "base"}).json()["name"]
        raw = c.get(f"/api/v1/backups/{name}/download").content
        src, out = zipfile.ZipFile(io.BytesIO(raw)), io.BytesIO()
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for info in src.infolist():
                data = src.read(info.filename)
                if info.filename == "data/settings.json":
                    rows = [r for r in json.loads(data) if r.get("key") != "update.apply_enabled"]
                    template = dict(rows[0]) if rows else {}
                    template.update({"key": "update.apply_enabled", "value": "true"})
                    rows.append(template)
                    data = json.dumps(rows).encode()
                z.writestr(info, data)
        up = c.post("/api/v1/backups/upload", files={"file": ("old.zip", out.getvalue(), "application/zip")})
        assert up.status_code == 201, up.text
        assert c.patch("/api/v1/settings", json={"update.apply_enabled": "false"}).status_code == 200
        res = c.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
        assert res.status_code == 200, res.text
        assert res.json()["update_apply_enabled"] == {"kept": False, "archive": True, "differed": True}
        with app.state.db.connection(mode="read") as conn:
            assert su.apply_enabled(conn) is False
            last = conn.execute("SELECT details_json FROM audit_log WHERE action = 'system.update.apply_enabled' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert json.loads(last[0])["archive_differed"] is True
