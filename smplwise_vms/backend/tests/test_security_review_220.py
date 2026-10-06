"""Regression tests for the security review of release 2.2.0 (2026-10-06, kept privately; none of
these paths was covered before). No device, host, Home Assistant or Frigate is contacted: the remote channel runs against
the in-process fake HA core (test_remote_access.Arx), announcements against a fake speaker, Frigate checks are pure.

- H1  the TOTP second factor and the `admins` policy on a NEW bearer sign-in (HTTP and WebSocket); continued sign-ins,
      users without a factor and the `security.second_factor_bearer = off` switch.
- M1  the administrator reset: never one's own factor; an enrolled administrator shows their own current code.
- M2  the DXF export and the plan package carry only the anchors the caller may see (camera scope).
- M3  plan package import: per-file limits, the JSON shape bound, RecursionError, one at a time, the rate, the trust gate
      on the preview before any parsing.
- M4  enabling or resetting the factor ends the user's other remote sign-ins.
- L1  an announce rule re-checks media.announce of its author when it runs; L2 no markup reaches the speech engine;
  L3 the announcement cooldown holds per speaker (L9 is in test_frigate_control);
  L5 the Frigate event id is checked before the LIKE lookup; L6 no dot segment passes the Frigate allow-list;
  L7 a retired signing key needs the trust confirmation; L8 the public app-download route is rate-limited.
"""
from __future__ import annotations

import dataclasses
import hashlib
import io
import json
import secrets
import zipfile

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from smplwise.db import now_iso
from smplwise.errors import ApiError
from smplwise.services import ha_user_auth as hua
from smplwise.services import plan_package as pp
from smplwise.services import second_factor as sf
from smplwise.services import signing
from test_remote_access import ORIGIN
from test_second_factor import HEADER, arx, bump_step, code_now, enrol  # noqa: F401 - `arx` is the fixture

ME = "/arx/api/v1/me"


def _bearer_client(arx, ip: str) -> TestClient:
    """A native client: no cookie, its own address (the per-address limit is not what these tests are about)."""
    return TestClient(arx.app, headers={"CF-Connecting-IP": ip})


def _auth(token: str, code: str | None = None) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", **({HEADER: code} if code else {})}


def _next_token(arx, first: dict) -> str:
    """The next access token of the same HA sign-in (what a refresh gives)."""
    return arx.core._access_for(arx.core._refresh[first["refresh_token"]])["access_token"]


def _bearer_sessions(user_id: str) -> list:
    return [s for s in hua.STORE.sessions_of(user_id=user_id) if s.via == "bearer"]


# ---------------------------------------------------------------- H1: the factor on the bearer path

def test_h1_a_new_bearer_sign_in_of_an_enrolled_user_needs_the_code(arx):
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    app = _bearer_client(arx, "198.51.100.10")
    first = arx.core.issue("u-viewer")
    token = first["access_token"]
    r = app.get(ME, headers=_auth(token))
    assert r.status_code == 401 and r.json()["code"] == "second_factor_required"
    assert _bearer_sessions("u-viewer") == []  # nothing was created
    r = app.get(ME, headers=_auth(token, "000000"))
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    assert arx.audit("auth.second_factor.failed")
    # the review's proof of concept: the bearer could remove the factor without any code - not any more
    r = app.delete("/arx/api/v1/auth/second-factor/users/u-viewer", headers=_auth(token))
    assert r.status_code == 401
    with arx.db.connection(mode="read") as conn:
        assert sf.is_enrolled(conn, "u-viewer")
    r = app.get(ME, headers=_auth(token, code_now(arx, "u-viewer")))
    assert r.status_code == 200 and r.json()["user"]["id"] == "u-viewer"
    created = json.loads(arx.audit("auth.remote_session.created")[-1]["details_json"])
    assert created["via"] == "bearer" and created["second_factor"] == "totp"
    # the same token, and the next access token of the same HA sign-in, continue without a code
    assert app.get(ME, headers=_auth(token)).status_code == 200
    assert app.get(ME, headers=_auth(_next_token(arx, first))).status_code == 200
    # ... also after the earlier bearer sessions ended with their tokens
    for s in _bearer_sessions("u-viewer"):
        hua.STORE.drop(s.sid)
    assert app.get(ME, headers=_auth(_next_token(arx, first))).status_code == 200
    # a NEW HA sign-in (another refresh token) asks again
    other = arx.core.issue("u-viewer")["access_token"]
    r = app.get(ME, headers=_auth(other))
    assert r.status_code == 401 and r.json()["code"] == "second_factor_required"


def test_h1_the_admins_policy_applies_to_the_bearer_path(arx):
    arx.setting("security.second_factor_policy", "admins")
    app = _bearer_client(arx, "198.51.100.11")
    r = app.get(ME, headers=_auth(arx.token(arx.owner)))
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required"
    assert _bearer_sessions("u-owner") == []
    # a viewer is outside the policy and has no factor: unchanged
    assert app.get(ME, headers=_auth(arx.token(arx.viewer))).status_code == 200


def test_h1_users_without_a_factor_are_unchanged_on_the_bearer_path(arx):
    app = _bearer_client(arx, "198.51.100.12")
    r = app.get(ME, headers=_auth(arx.token(arx.viewer)))
    assert r.status_code == 200 and r.json()["user"]["id"] == "u-viewer"
    created = json.loads(arx.audit("auth.remote_session.created")[-1]["details_json"])
    assert "second_factor" not in created and "second_factor_skipped" not in created


def test_h1_the_websocket_bearer_handshake_needs_the_code_too(arx):
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    app = _bearer_client(arx, "198.51.100.13")
    token = arx.token(arx.viewer)
    with pytest.raises(WebSocketDisconnect):
        with app.websocket_connect("/arx/api/v1/me/ws", headers=_auth(token)) as ws:
            ws.receive_text()
    assert _bearer_sessions("u-viewer") == []
    with app.websocket_connect("/arx/api/v1/me/ws", headers=_auth(token, code_now(arx, "u-viewer"))) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"


def test_h1_the_admins_policy_on_the_websocket_bearer_handshake(arx):
    arx.setting("security.second_factor_policy", "admins")
    app = _bearer_client(arx, "198.51.100.14")
    with pytest.raises(WebSocketDisconnect):
        with app.websocket_connect("/arx/api/v1/me/ws", headers=_auth(arx.token(arx.owner))) as ws:
            ws.receive_text()
    assert _bearer_sessions("u-owner") == []


def test_h1_the_compatibility_switch_restores_the_old_bearer_path_and_audits_it(arx):
    enrol(arx, arx.viewer)
    local = TestClient(arx.app)
    assert local.get("/api/v1/settings").json()["settings"]["security.second_factor_bearer"] == "enforce"
    assert local.patch("/api/v1/settings", json={"security.second_factor_bearer": "sometimes"}).status_code == 422
    assert local.patch("/api/v1/settings", json={"security.second_factor_bearer": "off"}).status_code == 200
    app = _bearer_client(arx, "198.51.100.15")
    first = arx.core.issue("u-viewer")
    assert app.get(ME, headers=_auth(first["access_token"])).status_code == 200
    created = json.loads(arx.audit("auth.remote_session.created")[-1]["details_json"])
    assert created["second_factor_skipped"] == "code"
    # back to enforce: a session that skipped the code never vouches for its sign-in's next token
    assert local.patch("/api/v1/settings", json={"security.second_factor_bearer": "enforce"}).status_code == 200
    r = app.get(ME, headers=_auth(_next_token(arx, first)))
    assert r.status_code == 401 and r.json()["code"] == "second_factor_required"


def test_h1_the_cookie_exchange_still_vouches_for_bearer_calls_of_the_same_sign_in(arx):
    """A browser that showed the code at the exchange may call with the bearer of the same HA sign-in."""
    enrol(arx, arx.viewer)
    bump_step(arx, "u-viewer")
    first = arx.core.issue("u-viewer")
    browser = TestClient(arx.app, headers={**ORIGIN, "CF-Connecting-IP": "198.51.100.16"})
    r = browser.post("/arx/api/v1/auth/session", headers=_auth(first["access_token"], code_now(arx, "u-viewer")))
    assert r.status_code == 200
    app = _bearer_client(arx, "198.51.100.16")
    assert app.get(ME, headers=_auth(_next_token(arx, first))).status_code == 200


# ---------------------------------------------------------------- M1: the administrator reset

def _enrol_directly(arx, user_id: str) -> None:
    with arx.db.connection() as conn:
        sf.begin_enrolment(conn, arx.settings, user_id, user_id)
    with arx.db.connection() as conn:
        sf.confirm(conn, arx.settings, user_id, code_now(arx, user_id))
    bump_step(arx, user_id)


def test_m1_an_administrator_cannot_reset_their_own_factor(arx):
    _enrol_directly(arx, "dev-joni")
    local = TestClient(arx.app)  # dev-joni, system_admin
    r = local.delete("/api/v1/auth/second-factor/users/dev-joni")
    assert r.status_code == 409 and r.json()["code"] == "second_factor_self_reset"
    with arx.db.connection(mode="read") as conn:
        assert sf.is_enrolled(conn, "dev-joni")


def test_m1_an_enrolled_administrator_shows_their_own_code(arx):
    enrol(arx, arx.viewer)
    _enrol_directly(arx, "dev-joni")
    local = TestClient(arx.app)
    r = local.delete("/api/v1/auth/second-factor/users/u-viewer")
    assert r.status_code == 403 and r.json()["code"] == "second_factor_step_up_required"
    r = local.delete("/api/v1/auth/second-factor/users/u-viewer", headers={HEADER: "000000"})
    assert r.status_code == 400 and r.json()["code"] == "second_factor_invalid"
    denied = [a for a in arx.audit("auth.second_factor.reset") if a["decision"] == "denied"]
    assert denied and denied[-1]["reason"] == "step_up_invalid"
    with arx.db.connection(mode="read") as conn:
        assert sf.is_enrolled(conn, "u-viewer")
    r = local.request("DELETE", "/api/v1/auth/second-factor/users/u-viewer", json={"code": code_now(arx, "dev-joni")})
    assert r.status_code == 200 and r.json() == {"user_id": "u-viewer", "removed": True}
    row = arx.audit("auth.second_factor.reset")[-1]
    assert row["decision"] == "allowed" and json.loads(row["details_json"])["step_up"] is True


def test_m1_an_administrator_without_a_factor_resets_as_before(arx):
    enrol(arx, arx.viewer)
    r = TestClient(arx.app).delete("/api/v1/auth/second-factor/users/u-viewer")
    assert r.status_code == 200 and r.json()["removed"] is True


# ---------------------------------------------------------------- M4: other sign-ins end

def _device(arx, user, ip: str) -> TestClient:
    c = TestClient(arx.app, headers={**ORIGIN, "CF-Connecting-IP": ip})
    assert c.post("/arx/api/v1/auth/session", headers=_auth(arx.token(user))).status_code == 200
    return c


def test_m4_turning_the_factor_on_ends_the_other_sign_ins(arx):
    other = _device(arx, arx.viewer, "198.51.100.20")
    first = arx.core.issue("u-viewer")
    bearer = _bearer_client(arx, "198.51.100.21")
    assert bearer.get(ME, headers=_auth(first["access_token"])).status_code == 200
    assert other.get(ME).status_code == 200
    enrol(arx, arx.viewer)  # on arx.client: its own session stays
    assert arx.client.get(ME).status_code == 200
    assert other.get(ME).status_code == 401
    # the bearer sign-in that began before the factor cannot roll on: refused for good
    r = bearer.get(ME, headers=_auth(_next_token(arx, first), code_now(arx, "u-viewer", +1)))
    assert r.status_code == 401 and r.json()["code"] == "remote_session_revoked"
    rows = [a for a in arx.audit("auth.remote_session.revoked") if a["reason"] == "second_factor_enrolled"]
    assert rows and json.loads(rows[-1]["details_json"])["sessions"] == 2
    assert json.loads(arx.audit("auth.second_factor.enrolled")[-1]["details_json"])["other_sign_ins_ended"] == 2


def test_m4_an_administrator_reset_ends_the_target_sign_ins(arx):
    enrol(arx, arx.viewer)
    viewer_client = arx.client
    assert viewer_client.get(ME).status_code == 200
    r = TestClient(arx.app).delete("/api/v1/auth/second-factor/users/u-viewer")
    assert r.status_code == 200
    assert viewer_client.get(ME).status_code == 401
    rows = [a for a in arx.audit("auth.remote_session.revoked") if a["reason"] == "second_factor_reset"]
    assert rows and rows[-1]["resource_id"] == "u-viewer" and rows[-1]["actor_user_id"] == "dev-joni"


# ---------------------------------------------------------------- M2: the exports respect the camera scope

def _plan_world(settings):
    from conftest import png_bytes, seed_tree

    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    assert c.post(f"/api/v1/plan-versions/{vid}/publish").status_code == 200
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    wall = {"id": "w1", "level_id": g["doc"]["levels"][0]["id"] if g["doc"].get("levels") else "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2,
            "height_m": None, "base_z_m": 0, "kind": "interior", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    doc = dict(g["doc"], walls=[wall])
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": 0})
    assert r.status_code == 200, r.text
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    return c, ids, vid


def _deny_camera(settings, username: str, camera_id: str) -> None:
    from smplwise.db import Database, new_id, permission_revision

    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', ?, 'viewer', 'camera', ?, 'deny', ?, 'test', ?)", (new_id(), f"dev-{username}", camera_id, permission_revision(conn), now_iso()))


def test_m2_dxf_and_package_exports_drop_the_cameras_the_caller_may_not_see(settings):
    c, ids, vid = _plan_world(settings)
    seen = c.post("/api/v1/cameras", json={"channel": 4, "alias": "לובי-גלוי"}).json()
    hidden = c.post("/api/v1/cameras", json={"channel": 5, "alias": "כספת-מוסתרת"}).json()
    for cam, x in ((seen, 0.3), (hidden, 0.6)):
        assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": x, "y": 0.4}).status_code == 201
    bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
    bind(c, settings, "edna", "editor", "floor", ids["floor2"])
    for user in ("ron", "edna"):
        _deny_camera(settings, user, hidden["id"])
    # the anchors list is the reference
    listed = {a["resource_id"] for a in c.get(f"/api/v1/floors/{ids['floor2']}/anchors", headers=as_user("ron")).json()["anchors"]}
    assert listed == {seen["id"]}
    # the DXF of the published structure (map.read)
    r = c.get(f"/api/v1/plan-versions/{vid}/export.dxf", headers=as_user("ron"))
    assert r.status_code == 200
    text = r.content.decode("utf-8")
    assert seen["id"] in text and hidden["id"] not in text and "כספת-מוסתרת" not in text
    # the administrator (no deny) still gets both
    full = c.get(f"/api/v1/plan-versions/{vid}/export.dxf").content.decode("utf-8")
    assert seen["id"] in full and hidden["id"] in full
    # the signed package (map.edit): anchors.json and the report
    r = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False}, headers=as_user("edna"))
    assert r.status_code == 200, r.text
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        anchors = json.loads(z.read("anchors.json"))["anchors"]
        report = z.read("report.html").decode("utf-8")
        manifest = json.loads(z.read("manifest.json"))
    assert [a["resource_id"] for a in anchors] == [seen["id"]]
    assert hidden["id"] not in report and "כספת-מוסתרת" not in report and manifest["entities"]["anchors"] == 1


def test_m2_a_camera_only_reader_gets_no_entities():
    """anchor_visibility: a reader who reaches the floor only through camera bindings sees cameras, never entities."""
    import sqlite3
    from unittest import mock

    with mock.patch("smplwise.services.access.camera_scope") as scope, mock.patch("smplwise.services.access.floor_reach", return_value="cameras"), \
            mock.patch("smplwise.routers.anchors.removed_recorder_cameras", return_value={"cam-gone"}):
        scope.return_value.allows = lambda cid: cid != "cam-denied"
        visible = pp.anchor_visibility(sqlite3.connect(":memory:"), object(), "f1")
    assert visible("camera", "cam-ok") and not visible("camera", "cam-denied") and not visible("camera", "cam-gone")
    assert not visible("ha_entity", "light.hall")


# ---------------------------------------------------------------- M3 / L7: plan package import hardening

def _repack_raw(data: bytes, sign_with, *, replace: dict[str, bytes]) -> bytes:
    """Replace files byte for byte and sign again as a valid package (the doc hash is left as it was: the checks under
    test run before it)."""
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        f = {n: z.read(n) for n in z.namelist()}
    f.update(replace)
    m = json.loads(f["manifest.json"])
    m["files"] = [{"path": n, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(), "role": "x"} for n, b in f.items() if n not in pp.CONTROL_NAMES]
    mb = json.dumps(m, ensure_ascii=False).encode("utf-8")
    f["manifest.json"] = mb
    f["MANIFEST.sha256"] = hashlib.sha256(mb).hexdigest().encode() + b"  manifest.json\n"
    f[signing.SIG_NAME] = json.dumps(signing.sign_manifest(sign_with, mb)).encode("utf-8")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for n, b in f.items():
            z.writestr(n, b)
    return buf.getvalue()


def _preview(c, vid, data, **q):
    qs = "&".join(f"{k}={v}" for k, v in {"mode": "replace", **q}.items())
    return c.post(f"/api/v1/plan-versions/{vid}/package/preview?{qs}", files={"file": ("p.swplan.zip", data, "application/zip")})


def _import(c, vid, data, **q):
    qs = "&".join(f"{k}={v}" for k, v in {"mode": "replace", "base_revision": 0, "expect_hash": "0" * 64, **q}.items())
    return c.post(f"/api/v1/plan-versions/{vid}/package/import?{qs}", files={"file": ("p.swplan.zip", data, "application/zip")})


def _denied(settings) -> list[dict]:
    import sqlite3

    con = sqlite3.connect(settings.db_path)
    con.row_factory = sqlite3.Row
    try:
        return [json.loads(r["details_json"]) for r in con.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.package.import' AND decision = 'denied' ORDER BY id")]
    finally:
        con.close()


def test_m3_json_shape_bound():
    assert pp.json_shape_problem(b"[" * 65 + b"]" * 65) == "too_deep"
    assert pp.json_shape_problem(b"[" * 64 + b"]" * 64) is None
    assert pp.json_shape_problem(b'{"a": "[[[[[[[[[[{{{{{{{{{{,,,,::::"}', max_depth=2, max_containers=1, max_values=1) is None  # strings do not count
    assert pp.json_shape_problem(b"[" + b"{}," * 10 + b"{}]", max_containers=5) == "too_many_containers"
    assert pp.json_shape_problem(b"[" + b"1," * 10 + b"1]", max_values=5) == "too_many_values"
    assert pp.json_shape_problem(b'"a \\" [ b"') is None  # an escaped quote does not end the string


def test_m3_deep_nesting_and_amplification_are_refused_and_audited(settings):
    c, _ids, vid = _plan_world(settings)
    good = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False}).content
    deep = _repack_raw(good, settings, replace={"plan.json": b"[" * 50_000 + b"]" * 50_000})
    for call in (lambda: _preview(c, vid, deep), lambda: _import(c, vid, deep)):
        r = call()
        assert r.status_code == 422 and r.json()["code"] == "package_too_complex" and r.json()["details"]["reason"] == "too_deep", r.text
    # ~25x amplification when parsed: 450k small objects (varied, so the archive's own ratio check does not catch it first)
    objs = b",".join(b'{"i":%d}' % secrets.randbelow(10**6) for _ in range(450_000))
    many = _repack_raw(good, settings, replace={"plan.json": b'{"objects": [' + objs + b"]}"})
    r = _preview(c, vid, many)
    assert r.status_code == 422 and r.json()["code"] == "package_too_complex" and r.json()["details"] == {"path": "plan.json", "reason": "too_many_containers"}, r.text
    codes = [d["code"] for d in _denied(settings)]
    assert codes == ["package_too_complex"] * 3


def test_m3_a_recursion_error_is_a_422_not_a_500(settings, monkeypatch):
    c, _ids, vid = _plan_world(settings)
    good = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False}).content
    monkeypatch.setattr(pp, "json_shape_problem", lambda raw, **_k: None)  # as if the bound let it through
    deep = _repack_raw(good, settings, replace={"plan.json": b"[" * 200_000 + b"]" * 200_000})
    r = _preview(c, vid, deep)
    assert r.status_code == 422 and r.json()["code"] == "package_malformed" and r.json()["details"]["error"] == "RecursionError"
    assert _denied(settings)[-1]["code"] == "package_malformed"


def test_m3_per_file_limits_and_companion_shape(settings):
    c, _ids, vid = _plan_world(settings)
    good = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False}).content
    big = b'{"rooms": [], "pad": "' + secrets.token_hex(pp.JSON_LIMITS["rooms.json"] // 2 + 16).encode() + b'"}'
    r = _preview(c, vid, _repack_raw(good, settings, replace={"rooms.json": big}))
    assert r.status_code == 422 and r.json()["code"] == "package_file_too_large" and r.json()["details"]["path"] == "rooms.json"
    assert pp.JSON_LIMITS["plan.json"] <= 8 * 1024 * 1024 and pp.LIMITS.max_manifest <= 256 * 1024
    r = _preview(c, vid, _repack_raw(good, settings, replace={"anchors.json": b"[]"}))  # a list where an object belongs: a 422, never a 500
    assert r.status_code == 422 and r.json()["code"] == "package_malformed"


def test_m3_one_preview_or_import_at_a_time_and_a_rate(settings):
    c, _ids, vid = _plan_world(settings)
    _preview(c, vid, b"not a zip")  # creates the gate
    gate = c.app.state.plan_package_gate
    gate.busy.add("dev-joni")
    r = _preview(c, vid, b"not a zip")
    assert r.status_code == 429 and r.json()["code"] == "package_busy"
    r = _import(c, vid, b"not a zip")
    assert r.status_code == 429 and r.json()["code"] == "package_busy"
    gate.busy.discard("dev-joni")
    assert [d["code"] for d in _denied(settings)][-2:] == ["package_busy", "package_busy"]
    codes = [_preview(c, vid, b"not a zip").status_code for _ in range(12)]
    assert 429 in codes and codes[0] == 422
    assert gate.busy == set()  # nothing left held


def test_m3_the_preview_of_a_foreign_package_waits_for_trust_before_parsing(settings, tmp_path):
    c, _ids, vid = _plan_world(settings)
    other = dataclasses.replace(settings, data_dir=tmp_path / "other")
    good = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False}).content
    hostile = _repack_raw(good, other, replace={"plan.json": b"[" * 50_000 + b"]" * 50_000})
    r = _preview(c, vid, hostile)
    assert r.status_code == 409 and r.json()["code"] == "package_foreign"  # the trust gate, before the file is even looked at
    assert r.json()["details"]["origin"]["trust"] == "embedded_key_only"
    r = _preview(c, vid, hostile, accept_foreign="true")
    assert r.status_code == 422 and r.json()["code"] == "package_too_complex"


def test_l7_a_retired_signing_key_needs_the_trust_confirmation(settings):
    c, _ids, vid = _plan_world(settings)
    old = c.post(f"/api/v1/plan-versions/{vid}/package", json={"draft": False}).content
    assert _preview(c, vid, old).status_code == 200  # a current key of this installation: no confirmation
    signing.rotate(settings)  # the key that signed `old` is retired now
    r = _preview(c, vid, old)
    assert r.status_code == 409 and r.json()["code"] == "package_foreign" and r.json()["details"]["reason"] == "retired_key"
    assert r.json()["details"]["origin"]["trust"] == "installation" and r.json()["details"]["origin"]["retired_key"] is True
    plan = _preview(c, vid, old, accept_foreign="true")
    assert plan.status_code == 200
    p = plan.json()
    r = _import(c, vid, old, base_revision=p["base_revision"], expect_hash=p["result_hash"])
    assert r.status_code == 409 and r.json()["code"] == "package_foreign"
    r = _import(c, vid, old, base_revision=p["base_revision"], expect_hash=p["result_hash"], accept_foreign="true")
    assert r.status_code == 200, r.text
    assert pp.needs_trust({"trust": "installation", "retired": False}) is None


# ---------------------------------------------------------------- L1 / L2: announcements

def test_l1_an_announce_rule_stays_silent_once_its_author_lost_media_announce(settings, monkeypatch):
    import media_seed_audio as aseed

    from smplwise.main import create_app
    from smplwise.services import announcements as ann
    from smplwise.services import rules as rules_svc
    from test_announcements import Speaker, enable

    fake = Speaker()
    monkeypatch.setattr(ann, "SPEAK", fake)
    app = create_app(settings)
    c = TestClient(app)
    aseed.install(c, "ma")
    aseed.approve_players(c)
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b"}.items()}
    enable(c, keys)
    bind(c, settings, "maya", "site_admin", "installation", "*")
    body = {"name": "דלת", "trigger": {"types": ["door"], "sources": ["system"]}, "scope": {}, "cooldown_s": 0,
            "actions": [{"kind": "announce", "scope": "area", "ref": "living", "message": "הדלת פתוחה"}]}
    r = c.post("/api/v1/rules", json=body, headers=as_user("maya"))
    assert r.status_code == 201, r.text
    ev = {"id": "e1", "type": "door", "source": "system", "severity": "alert", "camera_id": None, "occurred_at": "2026-10-05T09:00:00Z", "details": {}}
    with app.state.db.connection() as conn:
        fired = rules_svc.evaluate_event(conn, ev, "Asia/Jerusalem", deliver=False)
    rules_svc.deliver_pending(fired)
    assert fired[0]["announce"][0]["status"] == "sent" and len(fake.calls) == 1
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT actor_user_id FROM audit_log WHERE action = 'media.announce' ORDER BY rowid DESC LIMIT 1").fetchone()[0] == "dev-maya"
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_id = 'dev-maya'", (now_iso(),))  # maya is demoted
    with app.state.db.connection() as conn:
        fired = rules_svc.evaluate_event(conn, {**ev, "id": "e2"}, "Asia/Jerusalem", deliver=False)
    rules_svc.deliver_pending(fired)
    assert fired[0]["announce"][0]["status"] == "not_permitted" and len(fake.calls) == 1
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM audit_log WHERE action = 'media.announce' ORDER BY rowid DESC LIMIT 1").fetchone()
        hist = conn.execute("SELECT status, error FROM announcements ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row["decision"] == "denied" and row["reason"] == "not_permitted" and row["actor_user_id"] == "dev-maya"
    assert (hist["status"], hist["error"]) == ("refused", "not_permitted")


def test_l3_the_cooldown_holds_per_speaker_however_it_is_addressed(settings, monkeypatch):
    import media_seed_audio as aseed

    from smplwise.main import create_app
    from smplwise.services import announcements as ann
    from test_announcements import API, Speaker, enable

    fake = Speaker()
    monkeypatch.setattr(ann, "SPEAK", fake)
    c = TestClient(create_app(settings))
    aseed.install(c, "ma")
    aseed.approve_players(c)
    keys = {n: aseed.key_with(c, e) for n, e in {"a": "media_player.wiim_a", "b": "media_player.wiim_b"}.items()}
    enable(c, keys, devices=("a",))  # speaker a is the only allowed one in area "living"
    assert c.post(API, json={"scope": "area", "ref": "living", "text": "1"}).status_code == 200
    again = c.post(API, json={"scope": "device", "ref": keys["a"], "text": "2"})
    assert again.status_code == 429 and again.json()["details"]["limit"] == "cooldown", "the same speaker by another address"
    assert len(fake.calls) == 1


@pytest.mark.parametrize("raw,expected", [
    ('<speak>שלום<break time="10s"/><break time="10s"/></speak>', "שלום"),
    ('הודעה <audio src="https://example.invalid/x.mp3">קול</audio> סוף', "הודעה קול סוף"),
    ("3 > 2 and 1 < 2", "3 2 and 1 2"),
    ("a <b> c", "a c"),
    ("טקסט רגיל", "טקסט רגיל"),
])
def test_l2_no_markup_reaches_the_speech_engine(raw, expected):
    from smplwise.services import announcements as ann

    assert ann.clean_text(raw) == expected


def test_l2_markup_only_is_refused():
    from smplwise.services import announcements as ann

    with pytest.raises(ApiError) as e:
        ann.clean_text('<audio src="https://example.invalid/x.mp3"/>')
    assert e.value.code == "text_invalid"


# ---------------------------------------------------------------- L5 / L6: Frigate

@pytest.mark.parametrize("event_id", ["%", "_", "%-%", "1791227000.1-a%b_", "../x"])
def test_l5_the_event_id_is_checked_before_the_lookup(event_id):
    from smplwise.services import frigate_control_svc as svc

    with pytest.raises(ApiError) as e:
        svc._event_scope(None, None, "nvr-1", event_id)  # no connection: the check comes first
    assert e.value.status == 422 and e.value.code == "frigate_event_invalid"


def test_l6_no_dot_segment_passes_the_allow_list():
    from smplwise.services.recorders import frigate as fr
    from smplwise.services.recorders import frigate_http as fh

    assert fh.allowed("/api/cam_1/recordings")
    for path in ("/api/../recordings", "/api/./recordings", "/api/../api/version", "/api/../api/cam/recordings"):
        assert not fh.allowed(path), path
        assert not fh.control_read_allowed(path), path
    for klass, rules in fh.WRITE_ALLOWED.items():
        for method, _pattern in rules:
            assert not fh.write_allowed(klass, method, "/api/../api/config/set"), klass
            assert not fh.write_allowed(klass, method, "/api/cam/../set/detect"), klass
    assert not fr.CAMERA_KEY.fullmatch(".") and not fr.CAMERA_KEY.fullmatch("..")
    assert fr.CAMERA_KEY.fullmatch("front.door") and fr.CAMERA_KEY.fullmatch("cam_1")


# ---------------------------------------------------------------- L8: the public app-download route

def test_l8_the_app_download_route_is_rate_limited(arx):
    c = TestClient(arx.app, headers={**ORIGIN, "CF-Connecting-IP": "198.51.100.40"})
    codes = [c.get("/arx/api/v1/auth/app-download").status_code for _ in range(32)]
    assert codes[:30] == [200] * 30 and codes[30:] == [429, 429]
    other = TestClient(arx.app, headers={**ORIGIN, "CF-Connecting-IP": "198.51.100.41"})
    assert other.get("/arx/api/v1/auth/app-download").status_code == 200  # per address
