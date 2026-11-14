"""NVRMASK-295: the privacy-mask parser regression and the guarded privacy-mask write.

Fixtures (tests/fixtures/nvr_privacy_mask/) are the lab NVR's own answers from the supervised test of 2026-10-20 (one camera,
written, read back, restored exactly); they carry no host, user, serial or MAC:
- original_disabled.xml: master off, empty region list;
- readback_active_region_flag_false.xml: read back while the mask WAS masking the picture - master true, region <enabled>false;
- after_put_empty_list_region_kept.xml: after PUT of the original the device kept region 1 (it merges; removal = DELETE);
- capabilities_not_supported.xml: the capability document answers 403 notSupport.
The fake NVR below reproduces those three quirks."""
from __future__ import annotations

import re
from pathlib import Path

import httpx
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import nvr, nvr_privacy

FIX = Path(__file__).resolve().parent / "fixtures" / "nvr_privacy_mask"
ORIGINAL = (FIX / "original_disabled.xml").read_text(encoding="utf-8")
READBACK_ACTIVE = (FIX / "readback_active_region_flag_false.xml").read_text(encoding="utf-8")
AFTER_MERGE = (FIX / "after_put_empty_list_region_kept.xml").read_text(encoding="utf-8")
CAPS_403 = (FIX / "capabilities_not_supported.xml").read_text(encoding="utf-8")
OK = '<?xml version="1.0" encoding="UTF-8" ?><ResponseStatus><requestURL>/x</requestURL><statusCode>1</statusCode><statusString>OK</statusString><subStatusCode>ok</subStatusCode></ResponseStatus>'
SQUARE = [[0, 576], [70, 576], [70, 518], [0, 518]]  # the block of the supervised test (top-left corner, normalized 704x576)
SQUARE2 = [[300, 300], [400, 300], [400, 200], [300, 200]]


# ---------------------------------------------------------------- 1. the parser regression

def test_active_region_is_reported_active_although_the_device_flag_reads_false():
    p = nvr.parse_privacy_mask(READBACK_ACTIVE)
    assert p["enabled"] is True and len(p["regions"]) == 1
    reg = p["regions"][0]
    assert reg["enabled"] is True, "the region masks the picture: only the master switch counts on this firmware"
    assert reg["device_enabled"] is False, "the device's own flag is kept as evidence"
    assert p["active_regions"] == 1 and reg["id"] == "1" and sorted(reg["points"]) == sorted(SQUARE)


def test_stored_region_under_master_off_is_inactive_and_empty_list_is_no_region():
    kept = nvr.parse_privacy_mask(AFTER_MERGE)
    assert kept["enabled"] is False and len(kept["regions"]) == 1 and kept["regions"][0]["enabled"] is False and kept["active_regions"] == 0
    orig = nvr.parse_privacy_mask(ORIGINAL)
    assert orig == {"enabled": False, "normalized": {"width": 704, "height": 576}, "regions": [], "active_regions": 0}


def test_master_switch_is_the_documents_own_child_not_the_first_region_flag():
    no_master = re.sub(r"<enabled>true</enabled>\s*<normalizedScreenSize>", "<normalizedScreenSize>", READBACK_ACTIVE, count=1)
    assert nvr.parse_privacy_mask(no_master)["enabled"] is False


# ---------------------------------------------------------------- 2. pure helpers

def test_state_ignores_point_order_and_region_flags():
    built = nvr_privacy.document(ORIGINAL, True, [SQUARE])
    assert nvr_privacy.state(built) == nvr_privacy.state(READBACK_ACTIVE)
    assert nvr_privacy.etag(built) == nvr_privacy.etag(READBACK_ACTIVE) != nvr_privacy.etag(ORIGINAL)
    assert nvr_privacy.state(AFTER_MERGE) != nvr_privacy.state(ORIGINAL), "a kept inactive region is NOT the original (the restore must delete it)"


def test_document_keeps_everything_else_and_replaces_list():
    doc = nvr_privacy.document(READBACK_ACTIVE, False, [])
    assert "<normalizedScreenWidth>704</normalizedScreenWidth>" in doc and "<PrivacyMaskRegion>" not in doc and "<PrivacyMaskRegion " not in doc
    assert nvr_privacy.state(doc) == {"enabled": False, "regions": {}}
    selfclosing = ORIGINAL.replace('<PrivacyMaskRegionList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">\n</PrivacyMaskRegionList>',
                                   '<PrivacyMaskRegionList version="2.0"/>')
    assert nvr_privacy.state(nvr_privacy.document(selfclosing, True, [SQUARE, SQUARE2]))["regions"].keys() == {"1", "2"}
    with pytest.raises(ApiError) as e:
        nvr_privacy.document("<PrivacyMask><enabled>false</enabled></PrivacyMask>", True, [SQUARE])
    assert e.value.code == "nvr_not_supported"


@pytest.mark.parametrize("enabled,regions,reason", [
    (True, [], "enabled_without_regions"),
    (True, [SQUARE[:3]], "points"),
    (True, [[[0, 0], [800, 0], [800, 50], [0, 50]]], "out_of_frame"),
    (True, [[[0, 0], [0, 0], [50, 50], [0, 50]]], "duplicate_points"),
    (True, [[[0, 0], [2, 0], [2, 50], [0, 50]]], "too_small"),
    (True, [[[0, 0], [50, 50], [50, 0], [0, 50]]], "not_convex"),
])
def test_validation_refuses(enabled, regions, reason):
    with pytest.raises(ApiError) as e:
        nvr_privacy.validate(enabled, regions, {"width": 704, "height": 576}, 4)
    assert e.value.code == "validation" and e.value.details.get("reason") == reason


def test_validation_limits_and_caps():
    with pytest.raises(ApiError) as e:
        nvr_privacy.validate(True, [SQUARE] * 5, {"width": 704, "height": 576}, 4)
    assert e.value.details["max_regions"] == 4
    assert nvr_privacy.validate(False, [], {"width": 704, "height": 576}, 4) == []
    assert nvr_privacy.max_regions_from_caps(403, CAPS_403) == 4
    assert nvr_privacy.max_regions_from_caps(200, '<PrivacyMaskCap><PrivacyMaskRegionList size="8"/></PrivacyMaskCap>') == 8


# ---------------------------------------------------------------- 3. the guarded write against a fake NVR with the lab quirks

class FakeMaskNvr:
    """privacyMask per channel with the V4.84 behaviour: PUT merges regions by id (never removes), every stored region reads
    <enabled>false</enabled>, DELETE .../regions/<id> removes one, the capability document answers 403 notSupport."""

    def __init__(self, channels=(1, 2)):
        self.master = {ch: False for ch in channels}
        self.regions: dict[int, dict[str, list[list[int]]]] = {ch: {} for ch in channels}
        self.calls: list[tuple[str, str]] = []
        self.refuse_put: set[int] = set()
        self.drop_points: set[int] = set()  # answers OK but stores nothing

    def render(self, ch: int) -> str:
        regs = "".join(f'<PrivacyMaskRegion version="2.0"><id>{rid}</id><enabled>false</enabled><RegionCoordinatesList>'
                       + "".join(f"<RegionCoordinates><positionX>{x}</positionX><positionY>{y}</positionY></RegionCoordinates>" for x, y in reversed(pts))
                       + "</RegionCoordinatesList></PrivacyMaskRegion>" for rid, pts in sorted(self.regions[ch].items()))
        return ORIGINAL.replace("<enabled>false</enabled>", f"<enabled>{'true' if self.master[ch] else 'false'}</enabled>", 1).replace(
            '<PrivacyMaskRegionList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">\n</PrivacyMaskRegionList>',
            f'<PrivacyMaskRegionList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">\n{regs}</PrivacyMaskRegionList>')

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        self.calls.append((request.method, path))
        m = re.match(r"^/ISAPI/System/Video/inputs/channels/(\d+)/privacyMask(/capabilities|/regions/(\w+))?$", path)
        if not m or int(m.group(1)) not in self.master:
            return httpx.Response(404)
        ch = int(m.group(1))
        if m.group(2) == "/capabilities":
            return httpx.Response(403, text=CAPS_403)
        if request.method == "GET" and not m.group(2):
            return httpx.Response(200, text=self.render(ch))
        if request.method == "PUT" and not m.group(2):
            if ch in self.refuse_put:
                return httpx.Response(200, text=OK.replace("<statusCode>1</statusCode>", "<statusCode>6</statusCode>").replace(">ok<", ">badXmlContent<"))
            st = nvr_privacy.state(request.content.decode("utf-8"))
            self.master[ch] = st["enabled"]
            if ch not in self.drop_points:
                self.regions[ch].update(st["regions"])  # MERGE, never remove
            return httpx.Response(200, text=OK)
        if request.method == "DELETE" and m.group(3):
            self.regions[ch].pop(m.group(3), None)
            return httpx.Response(200, text=OK)
        return httpx.Response(405)

    def client(self, _settings=None) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self.handler), base_url="http://nvr")

    def writes(self) -> list[tuple[str, str]]:
        return [c for c in self.calls if c[0] in ("PUT", "DELETE")]


@pytest.fixture()
def world(settings, monkeypatch):
    fake = FakeMaskNvr()
    monkeypatch.setattr(nvr_privacy, "_client", fake.client)
    from smplwise.services import nvr_write

    monkeypatch.setattr(nvr_write, "_client", fake.client)
    app = create_app(settings)
    with TestClient(app) as c:
        cam1 = c.post("/api/v1/cameras", json={"channel": 1, "alias": "אולם"}).json()
        cam2 = c.post("/api/v1/cameras", json={"channel": 2, "alias": "צפון"}).json()
        yield c, fake, cam1["id"], cam2["id"], app


def _on(c):
    r = c.patch("/api/v1/settings", json={"nvr.privacy_mask_write": "true"})
    assert r.status_code == 200, r.text


def _preview(c, items, headers=None):
    r = c.post("/api/v1/nvr/privacy-masks/preview", json={"items": items}, headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def test_switch_defaults_off_and_gates_preview_and_apply(world):
    c, fake, cam1, _cam2, _app = world
    assert c.get("/api/v1/settings").json()["settings"]["nvr.privacy_mask_write"] == "false"
    item = {"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}]}
    r = c.post("/api/v1/nvr/privacy-masks/preview", json={"items": [item]})
    assert r.status_code == 409 and r.json()["code"] == "feature_disabled"
    r = c.post("/api/v1/nvr/privacy-masks/apply", json={"items": [{**item, "etag": "x"}], "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "feature_disabled"
    assert fake.writes() == []
    got = c.get(f"/api/v1/cameras/{cam1}/privacy-mask").json()  # the read stays available
    assert got["write_enabled"] is False and got["enabled"] is False and got["max_regions"] == 4 and got["capabilities"] == "not_published"


def test_preview_apply_verify_and_one_step_exact_restore(world):
    c, fake, cam1, _cam2, app = world
    _on(c)
    pv = _preview(c, [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}]}])
    item = pv["items"][0]
    assert pv["ready"] == 1 and item["status"] == "ready" and item["before"]["enabled"] is False and item["after"]["regions"][0]["points"] == SQUARE
    assert fake.writes() == [], "a preview writes nothing"
    body = {"items": [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}], "etag": item["etag"]}]}
    assert c.post("/api/v1/nvr/privacy-masks/apply", json=body).json()["code"] == "confirm_required"
    no_etag = {"items": [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}]}], "confirm": True}
    assert c.post("/api/v1/nvr/privacy-masks/apply", json=no_etag).json()["code"] == "preview_required"
    r = c.post("/api/v1/nvr/privacy-masks/apply", json={**body, "confirm": True})
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["applied"] == 1 and res["results"][0]["status"] == "applied"
    assert fake.master[1] is True and fake.regions[1] == {"1": sorted(SQUARE)}
    # the read shows the mask ACTIVE although the device's region flag reads false (the regression, end to end)
    got = c.get(f"/api/v1/cameras/{cam1}/privacy-mask").json()
    assert got["enabled"] is True and got["active_regions"] == 1 and got["regions"][0]["active"] is True
    # the change log keeps the original; the generic undo restores it exactly (the added region is DELETED)
    change_id = res["results"][0]["change_id"]
    detail = c.get(f"/api/v1/nvr/changes/{change_id}").json()
    assert detail["kind"] == "privacy_mask" and detail["permission"] == "nvr.config.privacy" and detail["camera_id"] == cam1
    assert nvr_privacy.state(detail["before_xml"]) == nvr_privacy.state(ORIGINAL)
    fake.calls.clear()
    rb = c.post(f"/api/v1/nvr/changes/{change_id}/rollback")
    assert rb.status_code == 201, rb.text
    assert ("DELETE", "/ISAPI/System/Video/inputs/channels/1/privacyMask/regions/1") in fake.writes()
    assert fake.master[1] is False and fake.regions[1] == {}
    assert nvr_privacy.state(fake.render(1)) == nvr_privacy.state(ORIGINAL)
    assert c.get(f"/api/v1/nvr/changes/{change_id}").json()["status"] == "rolled_back"
    assert c.post(f"/api/v1/nvr/changes/{change_id}/rollback").status_code == 409, "an undone change is not undone twice"
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT action, decision, details_json FROM audit_log WHERE action IN ('nvr.write', 'nvr.rollback')").fetchall()
    assert [(r["action"], r["decision"]) for r in rows].count(("nvr.write", "allowed")) == 1 and ("nvr.rollback", "allowed") in [(r["action"], r["decision"]) for r in rows]


def test_fewer_regions_deletes_the_rest_and_unchanged_writes_nothing(world):
    c, fake, cam1, _cam2, _app = world
    _on(c)
    fake.master[1], fake.regions[1] = True, {"1": sorted(SQUARE), "2": sorted(SQUARE2)}
    pv = _preview(c, [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}]}])["items"][0]
    r = c.post("/api/v1/nvr/privacy-masks/apply", json={"confirm": True, "items": [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}], "etag": pv["etag"]}]}).json()
    assert r["applied"] == 1 and fake.regions[1] == {"1": sorted(SQUARE)}
    assert ("DELETE", "/ISAPI/System/Video/inputs/channels/1/privacyMask/regions/2") in fake.writes()
    fake.calls.clear()
    pv = _preview(c, [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}]}])["items"][0]
    assert pv["status"] == "unchanged"
    r = c.post("/api/v1/nvr/privacy-masks/apply", json={"confirm": True, "items": [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}], "etag": pv["etag"]}]}).json()
    assert r["unchanged"] == 1 and fake.writes() == []


def test_partial_apply_stale_is_skipped_and_first_failure_stops_and_restores(world, settings):
    c, fake, cam1, cam2, _app = world
    _on(c)
    cam3 = c.post("/api/v1/cameras", json={"channel": 3, "alias": "שלישית"}).json()["id"]
    fake.master[3], fake.regions[3] = False, {}
    items = [{"camera_id": cid, "enabled": True, "regions": [{"points": SQUARE}]} for cid in (cam1, cam2, cam3)]
    pv = _preview(c, items)["items"]
    fake.regions[1] = {"1": sorted(SQUARE2)}  # camera 1 changed after the preview: stale, skipped, not written
    fake.refuse_put.add(2)  # camera 2 refuses the document: failed, the rest not attempted
    fake.calls.clear()
    body = {"confirm": True, "items": [{**it, "etag": p["etag"]} for it, p in zip(items, pv)]}
    r = c.post("/api/v1/nvr/privacy-masks/apply", json=body).json()
    by = {x["camera_id"]: x for x in r["results"]}
    assert by[cam1]["status"] == "skipped" and by[cam1]["reason"] == "stale"
    assert by[cam2]["status"] == "failed" and by[cam2]["reason"] == "nvr_rejected" and by[cam2]["restored"] is True
    assert by[cam3]["status"] == "not_attempted" and (r["skipped"], r["failed"], r["not_attempted"]) == (1, 1, 1)
    assert not any(p.startswith("/ISAPI/System/Video/inputs/channels/1/") or p.startswith("/ISAPI/System/Video/inputs/channels/3/") for _m, p in fake.writes())
    assert fake.master[2] is False and fake.regions[2] == {}


def test_verify_mismatch_restores_the_original(world):
    c, fake, cam1, _cam2, _app = world
    _on(c)
    fake.drop_points.add(1)  # OK + the master switch, but no region stored
    pv = _preview(c, [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}]}])["items"][0]
    r = c.post("/api/v1/nvr/privacy-masks/apply", json={"confirm": True, "items": [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}], "etag": pv["etag"]}]}).json()
    res = r["results"][0]
    assert res["status"] == "failed" and res["reason"] == "nvr_verify_mismatch" and res["restored"] is True
    assert fake.master[1] is False and nvr_privacy.state(fake.render(1)) == nvr_privacy.state(ORIGINAL)
    assert c.get(f"/api/v1/nvr/changes/{res['change_id']}").json()["status"] == "diverged"


def test_undo_refused_when_the_mask_changed_since(world):
    c, fake, cam1, _cam2, _app = world
    _on(c)
    pv = _preview(c, [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}]}])["items"][0]
    r = c.post("/api/v1/nvr/privacy-masks/apply", json={"confirm": True, "items": [{"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}], "etag": pv["etag"]}]}).json()
    fake.regions[1]["2"] = sorted(SQUARE2)  # someone edited the mask on the NVR afterwards
    rb = c.post(f"/api/v1/nvr/changes/{r['results'][0]['change_id']}/rollback")
    assert rb.status_code == 409 and rb.json()["code"] == "changed_since"
    assert fake.regions[1].keys() == {"1", "2"}, "nothing written"


def test_rbac_sensitive_permission_and_camera_scope(world, settings):
    c, fake, cam1, cam2, _app = world
    _on(c)
    item = {"camera_id": cam1, "enabled": True, "regions": [{"points": SQUARE}]}
    bind(c, settings, "sam", "site_admin", "installation", "*")
    assert c.post("/api/v1/nvr/privacy-masks/preview", json={"items": [item]}, headers=as_user("sam")).status_code == 403, "never implied below the system administrator"
    role = c.post("/api/v1/access/roles", json={"name": "מסכות", "description": "", "permissions": ["map.read", "video.live"], "sensitive": ["nvr.config.privacy"]}).json()
    bind(c, settings, "dan", role["id"], "installation", "*")
    h = as_user("dan")
    pv = _preview(c, [item], headers=h)["items"][0]
    r = c.post("/api/v1/nvr/privacy-masks/apply", json={"confirm": True, "items": [{**item, "etag": pv["etag"]}]}, headers=h)
    assert r.status_code == 200 and r.json()["applied"] == 1
    other = c.post("/api/v1/access/roles", json={"name": "זיהוי", "description": "", "permissions": ["map.read", "video.live"], "sensitive": ["nvr.config.detection"]}).json()
    bind(c, settings, "eve", other["id"], "installation", "*")
    assert c.post(f"/api/v1/nvr/changes/{r.json()['results'][0]['change_id']}/rollback", headers=as_user("eve")).status_code == 403, "the undo needs nvr.config.privacy"
    assert c.post("/api/v1/nvr/privacy-masks/preview", json={"items": [item, item]}, headers=h).status_code == 422, "a camera twice"
    assert fake.master[2] is False and cam2


def test_preview_and_apply_are_local_only():
    from smplwise import remote_channel

    assert any(b == "/api/v1/nvr/privacy-masks" for b in remote_channel.BLOCKED_ON_REMOTE)
