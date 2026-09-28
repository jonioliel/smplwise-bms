"""CR-006 phase 2, slice 2a (AI-rendered floor skins, the foundation): the skins.* settings, the privacy acknowledgement
and the key required before anything is sent, the budget arithmetic, the control-image upload (validation, permission,
keying by geometry, deletion with the floor), the provider interface with a fake provider and with OpenAI's request
shape on a mock transport, and the key never appearing in errors, audit rows or logs. No test touches the network."""
from __future__ import annotations

import base64
import dataclasses
import datetime as dt
import io
import json
import logging
import struct
import zlib

import httpx
import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app
from smplwise.services.skins import provider as prov
from smplwise.services.skins import store

FAKE_KEY = "sk-test-FAKEKEY0123456789abcdefXYZ"
WALL = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
        "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def control_png(w: int = 1536, h: int = 1024, color=(200, 210, 220)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="PNG")
    return buf.getvalue()


def with_chunk(png: bytes, ctype: bytes, body: bytes) -> bytes:
    """Insert an ancillary chunk right after IHDR (8 signature + 25 IHDR bytes)."""
    chunk = struct.pack(">I", len(body)) + ctype + body + struct.pack(">I", zlib.crc32(ctype + body) & 0xFFFFFFFF)
    return png[:33] + chunk + png[33:]


class FakeProvider:
    id = "fake"

    def __init__(self, model: str = "fake-model", image: bytes | None = b"\x89PNG-fake", error: prov.SkinProviderError | None = None):
        self.model = model
        self.calls: list[tuple[bytes, str, prov.RenderOptions]] = []
        self._image = image
        self._error = error

    def render(self, control_png: bytes, prompt: str, options: prov.RenderOptions) -> prov.RenderResult:
        self.calls.append((control_png, prompt, options))
        if self._error:
            raise self._error
        return prov.RenderResult(image=self._image, provider=self.id, model=self.model, cost_estimate_usd=0.02, http_status=200, usage={"total_tokens": 10})

    def estimate(self, options: prov.RenderOptions) -> dict:
        return {"cost_estimate_usd": 0.02}

    def capabilities(self) -> dict:
        return {"provider": self.id}


def _app(settings, key: str | None = FAKE_KEY, fake: FakeProvider | None = None):
    app = create_app(dataclasses.replace(settings, openai_api_key=key))
    if fake is not None:
        app.state.skin_provider_factory = lambda pid, k, model: fake
    return app, TestClient(app)


def _floor_with_structure(c: TestClient) -> tuple[dict, str]:
    ids = seed_tree(c)
    fid = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    g = c.get(f"/api/v1/plan-versions/{v['id']}/geometry?draft=true").json()
    assert c.put(f"/api/v1/plan-versions/{v['id']}/geometry", json={"doc": dict(g["doc"], walls=[WALL]), "base_revision": 0}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{v['id']}/geometry/publish").status_code == 200
    return ids, v["id"]


# ---------- settings ----------

def test_skins_settings_defaults_validation_and_permission(settings):
    app, c = _app(settings)
    s = c.get("/api/v1/settings").json()["settings"]
    assert (s["skins.provider"], s["skins.model"], s["skins.privacy_ack"], s["skins.budget_renders_per_floor"], s["skins.budget_monthly"]) == ("openai", "gpt-image-1.5", "false", 4, 20)
    for bad in ({"skins.privacy_ack": "yes"}, {"skins.provider": "claude"}, {"skins.budget_renders_per_floor": 7}, {"skins.budget_monthly": -1}, {"skins.model": "GPT image"}):
        assert c.patch("/api/v1/settings", json=bad).status_code == 422, bad
    r = c.patch("/api/v1/settings", json={"skins.privacy_ack": "true", "skins.budget_monthly": 5, "skins.budget_renders_per_floor": 2, "skins.model": "gpt-image-2"})
    assert r.status_code == 200 and r.json()["settings"]["skins.budget_monthly"] == 5 and r.json()["settings"]["skins.privacy_ack"] == "true"
    bind(c, settings, "dana", "editor", "installation", "*")
    assert c.patch("/api/v1/settings", json={"skins.privacy_ack": "false"}, headers=as_user("dana")).status_code == 403
    # no setting ever carries the key
    assert FAKE_KEY not in json.dumps(c.get("/api/v1/settings").json())


def test_status_says_whether_the_key_is_configured_never_the_key(settings):
    _, c = _app(settings)
    st = c.get("/api/v1/skins/status").json()
    assert st["key_configured"] is True and st["privacy_ack"] is False and st["provider"] == "openai"
    assert st["api"] == {"endpoint": "https://api.openai.com/v1/images/edits", "shape_verified": True, "prices_verified": False}
    assert st["budget"]["monthly_cap"] == 20 and st["budget"]["remaining_month"] == 20 and st["last_test"] is None
    assert any("תוויות" in x for x in st["never_leaves"]) and any("תמונות ממצלמות" in x for x in st["never_leaves"])
    assert FAKE_KEY not in json.dumps(st)
    _, c2 = _app(settings, key=None)
    assert c2.get("/api/v1/skins/status").json()["key_configured"] is False


def test_the_key_is_an_addon_option_with_an_env_fallback(tmp_path, monkeypatch):
    from smplwise.config import load_settings

    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"openai_api_key": "sk-from-options-1234567"}), encoding="utf-8")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env-7654321")
    assert load_settings(opts).openai_api_key == "sk-from-options-1234567"
    opts.write_text(json.dumps({"openai_api_key": ""}), encoding="utf-8")
    assert load_settings(opts).openai_api_key == "sk-from-env-7654321"
    import pathlib

    cfg = (pathlib.Path(__file__).resolve().parents[2] / "config.yaml").read_text(encoding="utf-8")
    assert 'openai_api_key: ""' in cfg and "openai_api_key: password?" in cfg


# ---------- the connection test ----------

def test_connection_test_refused_without_ack_or_key_and_nothing_is_sent(settings):
    fake = FakeProvider()
    app, c = _app(settings, fake=fake)
    r = c.post("/api/v1/skins/test")
    assert r.status_code == 409 and r.json()["code"] == "skins_privacy_ack_required"
    c.patch("/api/v1/settings", json={"skins.privacy_ack": "true"})
    app2, c2 = _app(settings, key=None, fake=fake)
    r = c2.post("/api/v1/skins/test")
    assert r.status_code == 409 and r.json()["code"] == "skins_key_missing" and "openai_api_key" in r.json()["user_message"]
    assert fake.calls == []
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM plan_skin_renders").fetchone()[0] == 0
        denied = conn.execute("SELECT reason FROM audit_log WHERE action = 'skins.test' AND decision = 'denied' ORDER BY rowid").fetchall()
        assert [d[0] for d in denied] == ["skins_privacy_ack_required", "skins_key_missing"]
    bind(c, settings, "dana", "editor", "installation", "*")
    assert c.post("/api/v1/skins/test", headers=as_user("dana")).status_code == 403


def test_connection_test_sends_one_fixed_pattern_records_a_test_row_and_audits(settings):
    fake = FakeProvider()
    app, c = _app(settings, fake=fake)
    c.patch("/api/v1/settings", json={"skins.privacy_ack": "true"})
    r = c.post("/api/v1/skins/test")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True and body["http_status"] == 200 and body["provider"] == "fake" and body["image"].startswith("data:image/png;base64,")
    assert len(fake.calls) == 1
    sent, prompt, options = fake.calls[0]
    assert sent == store.test_pattern_png() and Image.open(io.BytesIO(sent)).size == (64, 64)
    assert prompt == store.TEST_PROMPT and (options.size, options.quality) == ("1024x1024", "low")
    assert body["budget"]["used_month"] == 1 and body["budget"]["remaining_month"] == 19
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT * FROM plan_skin_renders").fetchone()
        assert (row["test"], row["floor_id"], row["state_key"], row["status"], row["prompt_version"], row["accepted"]) == (1, None, "test_pattern", "ok", "test-1", None)
        import hashlib

        assert row["control_hash"] == hashlib.sha256(sent).hexdigest()
        actions = [a[0] for a in conn.execute("SELECT action FROM audit_log WHERE action LIKE 'skins.test%' ORDER BY rowid").fetchall()]
        assert actions == ["skins.test.attempt", "skins.test"]
    assert c.get("/api/v1/skins/status").json()["last_test"]["status"] == "ok"


def test_test_pattern_is_deterministic_and_carries_no_text():
    a, b = store.test_pattern_png(), store.test_pattern_png()
    assert a == b and b"tEXt" not in a and b"iTXt" not in a


def test_connection_test_refused_when_the_monthly_budget_is_spent(settings):
    fake = FakeProvider()
    app, c = _app(settings, fake=fake)
    c.patch("/api/v1/settings", json={"skins.privacy_ack": "true", "skins.budget_monthly": 1})
    assert c.post("/api/v1/skins/test").status_code == 200
    r = c.post("/api/v1/skins/test")
    assert r.status_code == 409 and r.json()["code"] == "skins_budget_exhausted" and r.json()["details"]["used_month"] == 1
    assert len(fake.calls) == 1
    c.patch("/api/v1/settings", json={"skins.budget_monthly": 0})
    assert c.post("/api/v1/skins/test").json()["code"] == "skins_budget_exhausted"


def test_provider_error_is_reported_recorded_uncounted_and_redacted(settings, caplog):
    err = prov.SkinProviderError("provider_refused", f"Incorrect API key provided: {FAKE_KEY}", 401, "invalid_api_key")
    fake = FakeProvider(error=err)
    app, c = _app(settings, fake=fake)
    c.patch("/api/v1/settings", json={"skins.privacy_ack": "true"})
    with caplog.at_level(logging.DEBUG):
        r = c.post("/api/v1/skins/test")
    body = r.json()
    assert r.status_code == 200 and body["ok"] is False and body["http_status"] == 401 and body["provider_code"] == "invalid_api_key"
    assert FAKE_KEY not in r.text and "***" in body["message"]
    assert FAKE_KEY not in caplog.text
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT status, http_status, error_code FROM plan_skin_renders").fetchone()
        assert tuple(row) == ("error", 401, "invalid_api_key")
        audit_text = json.dumps([dict(x) for x in conn.execute("SELECT * FROM audit_log").fetchall()])
        assert FAKE_KEY not in audit_text
    assert c.get("/api/v1/skins/status").json()["budget"]["used_month"] == 0  # errors are not counted


# ---------- budget arithmetic ----------

def test_budget_arithmetic_and_month_boundary_in_the_site_zone():
    b = store.Budget(monthly_cap=20, used_month=18, per_floor_cap=4, used_floor=3)
    assert (b.remaining_month, b.remaining_floor) == (2, 1)
    assert b.allows(1) and b.allows(2) and not b.allows(3)
    assert b.allows(1, floor=True) and not b.allows(2, floor=True)
    over = store.Budget(monthly_cap=5, used_month=9, per_floor_cap=2, used_floor=5)
    assert (over.remaining_month, over.remaining_floor) == (0, 0) and not over.allows(1)
    assert not store.Budget(20, 0, 4, None).allows(1, floor=True)  # a floor request needs the floor's count
    # 1 Oct 00:30 in Jerusalem (UTC+3) is still 30 Sep in UTC: the month starts at 30 Sep 21:00Z
    now = dt.datetime(2026, 9, 30, 21, 30, tzinfo=dt.timezone.utc)
    assert store.month_start_utc(now, "Asia/Jerusalem") == "2026-09-30T21:00:00Z"
    assert store.month_start_utc(now, "UTC") == "2026-09-01T00:00:00Z"
    assert store.month_start_utc(now, "Not/AZone") == "2026-09-01T00:00:00Z"


def test_budget_counts_ok_rows_of_this_month_and_per_floor_and_key(settings):
    app, c = _app(settings)
    with app.state.db.connection() as conn:
        common = dict(level_id=None, provider="openai", model="m", prompt_version="p", control_hash="h", sent_plan_raster=False, cost_estimate_usd=0.1,
                      http_status=200, error_code=None, usage=None, image_path=None, actor_id=None)
        store.record_render(conn, floor_id="f1", state_key="all_off", geometry_key="k1", status="ok", test=False, **common)
        store.record_render(conn, floor_id="f1", state_key="all_on", geometry_key="k1", status="ok", test=False, **common)
        store.record_render(conn, floor_id="f1", state_key="all_on", geometry_key="k0", status="ok", test=False, **common)
        store.record_render(conn, floor_id="f1", state_key="all_on", geometry_key="k1", status="error", test=False, **common)
        store.record_render(conn, floor_id=None, state_key="test_pattern", geometry_key=None, status="ok", test=True, **common)
        conn.execute("UPDATE plan_skin_renders SET created_at = '2000-01-01T00:00:00Z' WHERE geometry_key = 'k0'")
        b = store.budget(conn, "f1", "k1")
        assert (b.used_month, b.used_floor, b.remaining_floor) == (3, 2, 2)
        assert store.budget(conn, "f1", "k0").used_floor == 1


# ---------- control images ----------

def test_control_image_upload_validation_permission_keying_and_deletion_with_the_floor(settings):
    app, c = _app(settings)
    ids, _ = _floor_with_structure(c)
    fid = ids["floor2"]
    info = c.get(f"/api/v1/floors/{fid}/skins").json()
    key = info["geometry_key"]
    assert len(key) == 64 and info["controls"] == [] and info["size"] == [1536, 1024] and info["states"] == ["all_off", "all_on"]

    def up(data: bytes, state: str = "all_off", k: str | None = None, headers=None):
        return c.post(f"/api/v1/floors/{fid}/skins/control-image", data={"state": state, "geometry_key": k or key}, files={"file": ("c.png", data, "image/png")}, headers=headers)

    png = control_png()
    r = up(png)
    assert r.status_code == 201, r.text
    row = r.json()
    assert row["state"] == "all_off" and row["geometry_key"] == key and row["width"] == 1536 and row["identical"] is False
    path = settings.data_dir / "skins" / fid / f"control-all_off-{key[:16]}.png"
    assert path.read_bytes() == png
    assert up(png).json()["identical"] is True  # the same bytes for the same key: the capture was deterministic
    assert up(control_png(color=(1, 2, 3))).json()["identical"] is False
    assert up(png, state="all_on").status_code == 201
    # validation
    assert up(b"GIF89a" + b"\0" * 100).json()["code"] == "unsupported_format"
    assert up(control_png(1024, 1024)).json()["code"] == "control_size"
    assert up(with_chunk(png, b"tEXt", b"Comment\0kitchen")).json()["code"] == "png_metadata"
    bad_crc = bytearray(png)
    bad_crc[40] ^= 0xFF
    assert up(bytes(bad_crc)).json()["code"] == "corrupt_png"
    assert up(png, state="night").json()["code"] == "bad_state"
    assert up(png, k="0" * 64).json()["code"] == "geometry_changed"
    assert up(png, k="xyz").status_code == 422
    big = png + b"\0" * (store.CONTROL_MAX_BYTES + 10)
    assert up(big).status_code in (413, 422)
    # the key follows the rooms: a new room changes it, the stored image is marked not current
    assert c.post(f"/api/v1/floors/{fid}/zones", json={"name": "חדר", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}]}).status_code == 201
    info2 = c.get(f"/api/v1/floors/{fid}/skins").json()
    assert info2["geometry_key"] != key and all(x["current"] is False for x in info2["controls"])
    assert up(png).json()["code"] == "geometry_changed"
    # permission: map.edit on the floor
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert up(png, k=info2["geometry_key"], headers=as_user("vera")).status_code == 403
    assert c.get(f"/api/v1/floors/{fid}/skins", headers=as_user("vera")).status_code == 403
    bind(c, settings, "eddie", "editor", "floor", fid)
    assert up(png, k=info2["geometry_key"], headers=as_user("eddie")).status_code == 201
    # never served: no route returns the image
    assert c.get(f"/api/v1/floors/{fid}/skins/control-image").status_code in (404, 405)
    # deleted with the floor
    assert c.delete(f"/api/v1/floors/{fid}?force=true").status_code == 204
    assert not (settings.data_dir / "skins" / fid).exists()
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM plan_skin_controls WHERE floor_id = ?", (fid,)).fetchone()[0] == 0
        d = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'floor.delete'").fetchone()[0])
        assert d["skin_controls_deleted"] == 2
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'skins.control.upload'").fetchone()[0] == 5


def test_control_image_needs_a_published_structure(settings):
    _, c = _app(settings)
    ids = seed_tree(c)
    fid = ids["floor3"]
    assert c.get(f"/api/v1/floors/{fid}/skins").json()["geometry_key"] is None
    r = c.post(f"/api/v1/floors/{fid}/skins/control-image", data={"state": "all_off", "geometry_key": "a" * 64}, files={"file": ("c.png", control_png(), "image/png")})
    assert r.status_code == 409 and r.json()["code"] == "no_geometry"


# ---------- the OpenAI provider on a mock transport ----------

def _openai(handler, key: str | None = FAKE_KEY) -> prov.OpenAIImageProvider:
    return prov.OpenAIImageProvider(key, "gpt-image-1.5", transport=httpx.MockTransport(handler))


def test_openai_request_shape_and_reply_parsing():
    seen: dict = {}
    reply_png = control_png(8, 8)

    def handler(req: httpx.Request) -> httpx.Response:
        seen["method"], seen["url"], seen["auth"] = req.method, str(req.url), req.headers.get("authorization")
        seen["ctype"] = req.headers.get("content-type", "")
        seen["body"] = req.read()
        return httpx.Response(200, json={"created": 1, "data": [{"b64_json": base64.b64encode(reply_png).decode()}], "usage": {"input_tokens": 5, "output_tokens": 7, "total_tokens": 12, "input_tokens_details": {"image_tokens": 4}}},
                              headers={"x-request-id": "req_1"})

    p = _openai(handler)
    r = p.render(b"\x89PNGcontrol", "make it photoreal", prov.RenderOptions(size="1536x1024", quality="medium"))
    assert seen["method"] == "POST" and seen["url"] == "https://api.openai.com/v1/images/edits" and seen["auth"] == f"Bearer {FAKE_KEY}"
    assert seen["ctype"].startswith("multipart/form-data")
    body = seen["body"]
    for field, value in (("model", b"gpt-image-1.5"), ("prompt", b"make it photoreal"), ("size", b"1536x1024"), ("quality", b"medium"), ("output_format", b"png"), ("n", b"1")):
        assert f'name="{field}"'.encode() in body and value in body, field
    assert b'name="image[]"; filename="control.png"' in body and b"\x89PNGcontrol" in body
    assert b"response_format" not in body  # not a GPT image model parameter
    assert r.image == reply_png and r.http_status == 200 and r.usage == {"input_tokens": 5, "output_tokens": 7, "total_tokens": 12} and r.request_id == "req_1"
    assert r.provider == "openai" and r.model == "gpt-image-1.5" and r.cost_estimate_usd > 0
    caps = p.capabilities()
    assert caps["endpoint"].endswith("/images/edits") and "1536x1024" in caps["sizes"] and FAKE_KEY not in json.dumps(caps)
    est = p.estimate(prov.RenderOptions(size="1536x1024", quality="medium"))
    assert est["basis"] == "estimate_unverified" and est["cost_estimate_usd"] == pytest.approx(0.105)


def test_openai_errors_are_redacted_and_typed():
    def refused(req):
        return httpx.Response(401, json={"error": {"message": f"Incorrect API key provided: {FAKE_KEY}. Authorization: Bearer {FAKE_KEY}", "type": "invalid_request_error", "code": "invalid_api_key"}})

    with pytest.raises(prov.SkinProviderError) as ei:
        _openai(refused).render(b"x", "p", prov.RenderOptions())
    e = ei.value
    assert e.http_status == 401 and e.provider_code == "invalid_api_key" and FAKE_KEY not in e.message and FAKE_KEY not in str(e)

    def down(req):
        raise httpx.ConnectError(f"cannot connect with {FAKE_KEY}")

    with pytest.raises(prov.SkinProviderError) as ei:
        _openai(down).render(b"x", "p", prov.RenderOptions())
    assert ei.value.code == "provider_unreachable" and ei.value.http_status == 0 and FAKE_KEY not in ei.value.message

    with pytest.raises(prov.SkinProviderError) as ei:
        _openai(lambda req: httpx.Response(200, text="not json")).render(b"x", "p", prov.RenderOptions())
    assert ei.value.code == "bad_reply"
    ok = _openai(lambda req: httpx.Response(200, json={"created": 1, "data": []})).render(b"x", "p", prov.RenderOptions())
    assert ok.image is None and ok.http_status == 200

    called = []
    with pytest.raises(prov.SkinProviderError) as ei:
        _openai(lambda req: called.append(1) or httpx.Response(200), key=None).render(b"x", "p", prov.RenderOptions())
    assert ei.value.code == "key_missing" and called == []
    with pytest.raises(prov.SkinProviderError):
        _openai(lambda req: httpx.Response(200)).render(b"x", "p", prov.RenderOptions(size="256x256"))


def test_redact_removes_the_key_bearer_tokens_and_key_shapes():
    text = f"key={FAKE_KEY} header Bearer abc.def-123 other sk-proj-AAAAAAAAAAAA"
    out = prov.redact(text, FAKE_KEY)
    assert FAKE_KEY not in out and "abc.def-123" not in out and "sk-proj-AAAAAAAAAAAA" not in out and "Bearer ***" in out


def test_the_fake_provider_satisfies_the_interface():
    f: prov.SkinProvider = FakeProvider()
    res = f.render(b"png", "prompt", prov.RenderOptions())
    assert isinstance(res, prov.RenderResult) and res.describe()["image_bytes"] == len(b"\x89PNG-fake")
    with pytest.raises(prov.SkinProviderError):
        prov.make_provider("claude", FAKE_KEY, None)
    assert isinstance(prov.make_provider("openai", FAKE_KEY, None), prov.OpenAIImageProvider)
