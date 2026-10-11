"""Security review 2.4.6 (docs/security/SECURITY_REVIEW_246_2026-10-11.md): proofs of concept.

Each test asserts the CURRENT (unfixed) behaviour of a finding, so it passes while the finding is open and fails on purpose
once a fix lands (invert it into a regression test then, or drop it). Fakes and the in-process test client only; no device,
no Home Assistant, no network."""
from __future__ import annotations

import io
import json
import sqlite3
import sys
import uuid
import zipfile
from contextlib import contextmanager
from dataclasses import replace
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import png_bytes  # noqa: E402
from test_devices import AREAS, ENTITY_REGISTRY, FLOORS, _body, _judge, _reg, bulk_app, dev_app  # noqa: E402,F401  (fixtures)

from smplwise.main import create_app  # noqa: E402


# ---------------------------------------------------------------------------------------------- L1: background picture decode

def _flat_png(w: int, h: int, mode: str = "1") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, (w, h), 0).save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def test_poc_l1_background_upload_decodes_a_49_megapixel_picture_with_no_pixel_ceiling(settings, monkeypatch):
    """routers/ui_background.py `_store`: no width x height check before `exif_transpose` / `convert("RGB")` decode the whole
    picture. A 7000 x 7000 flat PNG is a few KB on the wire (well under the 1 MiB body limit) and reaches the full decode; the
    only bound is Pillow's process-wide MAX_IMAGE_PIXELS (set to 60 M by plan_render at import, lowered to 40 M by wall_photos,
    raised by floor_images - and only a WARNING between 1x and 2x of it). The real decode is replaced here by a recorder so
    the test itself stays small."""
    from PIL import ImageOps

    seen: list[tuple[int, int]] = []

    def record(im, *a, **k):
        seen.append(im.size)
        return Image.new("RGB", (8, 8))

    monkeypatch.setattr(ImageOps, "exif_transpose", record)
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 60_000_000)  # the value plan_render.py sets at import
    data = _flat_png(7000, 7000)
    assert len(data) < 1024 * 1024
    with TestClient(create_app(settings)) as c:
        r = c.post("/api/v1/settings/background/day", files={"file": ("d.png", data, "image/png")})
    assert r.status_code == 201, r.text
    assert seen == [(7000, 7000)], "the whole 49 MP picture reached the decode step (floor_images refuses above 36 MP)"


# ---------------------------------------------------------------------------------------------- I1: the 1 MiB body limit

def test_poc_i1_a_background_over_one_mib_is_refused_by_the_default_body_limit_not_the_12_mb_rule(settings):
    """body_limit.LIMITS has no entry for POST /settings/background/{slot}: DEFAULT_MAX (1 MiB) applies, so the advertised
    12 MB (IMAGE_MAX_BYTES, the frontend's wording) is unreachable and an ordinary phone photo is refused."""
    import os

    buf = io.BytesIO()
    Image.frombytes("RGB", (800, 700), os.urandom(800 * 700 * 3)).save(buf, format="PNG")
    data = buf.getvalue()
    assert 1024 * 1024 < len(data) < 12 * 1024 * 1024
    with TestClient(create_app(settings)) as c:
        r = c.post("/api/v1/settings/background/day", files={"file": ("photo.png", data, "image/png")})
    assert r.status_code == 413, r.text
    body = r.json()
    assert body["details"].get("stage") == "request_body" and body["details"].get("max_bytes") == 1024 * 1024


# ---------------------------------------------------------------------------------------------- I2: restored picture bytes

def test_poc_i2_a_restored_background_is_served_as_archived_without_re_encoding_or_nosniff(settings, tmp_path):
    """services/backup.py restores `ui_backgrounds/<slot>.jpg` byte for byte (RESTORABLE_ROOTS); the upload's re-encoding is not
    applied, and the read route answers `image/jpeg` without `X-Content-Type-Options` outside the remote channel."""
    payload = b"<svg xmlns='http://www.w3.org/2000/svg'><script>parent.alert(1)</script></svg>"
    with TestClient(create_app(settings)) as c:
        assert c.post("/api/v1/settings/background/night", files={"file": ("n.png", png_bytes(), "image/png")}).status_code == 201
        name = c.post("/api/v1/backups", json={"note": "poc"}).json()["name"]
        raw = c.get(f"/api/v1/backups/{name}/download").content
    src, out = zipfile.ZipFile(io.BytesIO(raw)), io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for info in src.infolist():
            z.writestr(info, payload if info.filename == "files/ui_backgrounds/night.jpg" else src.read(info.filename))
    settings2 = replace(settings, data_dir=tmp_path / "data2")
    with TestClient(create_app(settings2)) as c2:
        up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", out.getvalue(), "application/zip")})
        assert up.status_code == 201, up.text
        res = c2.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
        assert res.status_code == 200, res.text
        g = c2.get("/api/v1/settings/background/night")
    assert g.status_code == 200 and g.content == payload
    assert g.headers["content-type"] == "image/jpeg" and "x-content-type-options" not in g.headers


# ---------------------------------------------------------------------------------------------- L2: ALLON + DEVTYPE valve

def test_poc_l2_a_switch_the_administrator_typed_valve_is_turned_on_by_turn_all_on(bulk_app):
    """DEVTYPE lets an administrator state that a switch IS a valve / water heater (device_type_override), but the bulk
    `switches_on` (ALLON "הדלק הכל" of the area's switches section) never reads it: only the CR-019 protection list excludes.
    The override is presentation only (services/device_types.py)."""
    app, s, c, fake = bulk_app
    extra = [{"entity_id": "switch.lobby_relay_3", "state": "off", "attributes": {"friendly_name": "Relay 3"}},
             {"entity_id": "switch.lobby_relay_4", "state": "off", "attributes": {"friendly_name": "Relay 4"}}]
    assert c.post("/api/v1/ha/dev/states", json={"states": extra}).status_code == 200
    reg = ENTITY_REGISTRY + [_reg(e["entity_id"], "lobby") for e in extra]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    _judge(app)
    assert c.put("/api/v1/devices/entities/switch.lobby_relay_3/device-type", json={"kind": "valve"}).status_code == 200
    assert c.put("/api/v1/devices/entities/switch.lobby_relay_4/device-type", json={"kind": "water_heater"}).status_code == 200
    on = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "switches_on"}).json()
    targets = {t["entity_id"] for t in on["targets"]}
    assert {"switch.lobby_relay_3", "switch.lobby_relay_4"} <= targets
    assert not {x["entity_id"] for x in on["excluded"]} & {"switch.lobby_relay_3", "switch.lobby_relay_4"}
    r = c.post("/api/v1/ha/entities/switch.lobby_relay_3/actions", json=_body(client_request_id="poc-valve"))
    assert r.status_code == 202, r.text  # single switch.turn_on of a typed valve: no confirmation grant asked
    assert [p["data"]["entity_id"] for p in fake.calls] == ["switch.lobby_relay_3"]


# ---------------------------------------------------------------------------------------------- L3: LAT1 fire-first

def test_poc_l3_a_device_command_leaves_even_when_nothing_can_be_recorded(bulk_app, monkeypatch):
    """routers/ha.py `_run_action` (LAT1): the signed call is submitted BEFORE the pending row is durable, and a pending-row
    failure is only logged. When the database stays busy, the command reaches Home Assistant and the request then fails with
    no ha_actions row and no `ha.action` audit row (before LAT1 the write gate was taken before the call: no record, no call)."""
    app, s, _c, fake = bulk_app
    db = app.state.db
    real = db.write_aside

    @contextmanager
    def busy(label=None):
        if label and label.startswith("ha.action"):
            raise sqlite3.OperationalError("database is locked")
        with real(label=label) as w:
            yield w

    monkeypatch.setattr(db, "write_aside", busy)
    crid = f"poc-{uuid.uuid4().hex[:8]}"
    c = TestClient(app, raise_server_exceptions=False)
    r = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=_body(allowed_action_id="switch.turn_off", client_request_id=crid))
    assert r.status_code == 500
    assert [p["service"] for p in fake.calls] == ["turn_off"], "the command left"
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE client_request_id = ?", (crid,)).fetchone()[0] == 0
        rows = [json.loads(x[0] or "{}") for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'ha.action'").fetchall()]
    assert not rows, "no audit row for a command that reached Home Assistant"
