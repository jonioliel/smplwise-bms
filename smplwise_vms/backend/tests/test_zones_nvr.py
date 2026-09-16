"""T075 (read-only half): the NVR's own detection configuration — motion grid, privacy mask, intrusion regions,
line-crossing lines — parsed from ISAPI answers (samples from the lab NVR, no identifiers), exposed per camera
with the live-video permission, cached, unsupported sources reported with a reason, never written back."""
from __future__ import annotations

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers import cameras as cameras_router
from smplwise.services import nvr

MOTION = """<?xml version="1.0" encoding="UTF-8" ?>
<MotionDetection version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<enabled>true</enabled><enableHighlight>true</enableHighlight><samplingInterval>5</samplingInterval>
<regionType>grid</regionType>
<Grid><rowGranularity>18</rowGranularity><columnGranularity>22</columnGranularity></Grid>
<MotionDetectionLayout version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<sensitivityLevel>60</sensitivityLevel>
<layout><gridMap>fffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffcfffffc000000</gridMap></layout>
<targetType>human,vehicle</targetType>
</MotionDetectionLayout>
<maxMegaPixels>6</maxMegaPixels>
</MotionDetection>"""

PRIVACY = """<?xml version="1.0" encoding="UTF-8" ?>
<PrivacyMask version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<enabled>true</enabled>
<normalizedScreenSize><normalizedScreenWidth>704</normalizedScreenWidth><normalizedScreenHeight>576</normalizedScreenHeight></normalizedScreenSize>
<PrivacyMaskRegionList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<PrivacyMaskRegion><id>1</id><enabled>true</enabled>
<RegionCoordinatesList><RegionCoordinates><positionX>10</positionX><positionY>20</positionY></RegionCoordinates><RegionCoordinates><positionX>200</positionX><positionY>20</positionY></RegionCoordinates><RegionCoordinates><positionX>200</positionX><positionY>150</positionY></RegionCoordinates><RegionCoordinates><positionX>10</positionX><positionY>150</positionY></RegionCoordinates></RegionCoordinatesList>
</PrivacyMaskRegion>
</PrivacyMaskRegionList>
</PrivacyMask>"""

FIELD = """<?xml version="1.0" encoding="UTF-8" ?>
<FieldDetection version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<id>1</id><enabled>false</enabled>
<normalizedScreenSize><normalizedScreenWidth>1000</normalizedScreenWidth><normalizedScreenHeight>1000</normalizedScreenHeight></normalizedScreenSize>
<FieldDetectionRegionList>
<FieldDetectionRegion><id>1</id><sensitivityLevel>50</sensitivityLevel>
<RegionCoordinatesList><RegionCoordinates><positionX>100</positionX><positionY>100</positionY></RegionCoordinates><RegionCoordinates><positionX>900</positionX><positionY>100</positionY></RegionCoordinates><RegionCoordinates><positionX>500</positionX><positionY>800</positionY></RegionCoordinates></RegionCoordinatesList>
</FieldDetectionRegion>
<FieldDetectionRegion><id>2</id><sensitivityLevel>50</sensitivityLevel><RegionCoordinatesList></RegionCoordinatesList></FieldDetectionRegion>
</FieldDetectionRegionList>
</FieldDetection>"""

LINES = """<?xml version="1.0" encoding="UTF-8" ?>
<LineDetection version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<id>1</id><enabled>true</enabled>
<normalizedScreenSize><normalizedScreenWidth>1000</normalizedScreenWidth><normalizedScreenHeight>1000</normalizedScreenHeight></normalizedScreenSize>
<LineItemList>
<LineItem><id>1</id><enabled>true</enabled><sensitivityLevel>50</sensitivityLevel><directionSensitivity>left</directionSensitivity>
<CoordinatesList><Coordinates><positionX>0</positionX><positionY>500</positionY></Coordinates><Coordinates><positionX>1000</positionX><positionY>500</positionY></Coordinates></CoordinatesList></LineItem>
<LineItem><id>2</id><enabled>false</enabled><sensitivityLevel>50</sensitivityLevel><directionSensitivity>any</directionSensitivity><CoordinatesList></CoordinatesList></LineItem>
</LineItemList>
</LineDetection>"""


def test_parsers_from_lab_samples():
    m = nvr.parse_motion_grid(MOTION)
    assert m["enabled"] and m["rows"] == 18 and m["cols"] == 22 and m["sensitivity"] == 60 and m["target_types"] == ["human", "vehicle"]
    assert len(m["cells"]) == 18 and all(len(r) == 22 for r in m["cells"])
    assert all(m["cells"][0]) and not any(m["cells"][17]), "ffffc = 22 set bits (MSB first), 000000 = an empty row"
    assert m["coverage_pct"] == round(100 * 17 / 18, 1)
    p = nvr.parse_privacy_mask(PRIVACY)
    assert p["enabled"] and p["normalized"] == {"width": 704, "height": 576} and p["regions"][0]["points"] == [[10, 20], [200, 20], [200, 150], [10, 150]]
    f = nvr.parse_field_detection(FIELD)
    assert f["enabled"] is False and [r["id"] for r in f["regions"]] == ["1"] and f["regions"][0]["points"][2] == [500, 800], "an empty region list is not a region"
    ln = nvr.parse_line_detection(LINES)
    assert ln["enabled"] and len(ln["lines"]) == 1 and ln["lines"][0]["direction"] == "left" and ln["lines"][0]["points"] == [[0, 500], [1000, 500]]
    # the safe parser refuses entity tricks like everything else that reads device XML
    import pytest

    from smplwise.services.xmlsafe import UnsafeXml

    with pytest.raises(UnsafeXml):
        nvr.parse_motion_grid('<!DOCTYPE x [<!ENTITY e "x">]><MotionDetection><enabled>&e;</enabled></MotionDetection>')


def test_zones_endpoint_permission_cache_and_unsupported(settings, monkeypatch):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 3, "alias": "חניה"}).json()["id"]
    calls: list[int] = []

    def fake_zones(_settings, channel):
        calls.append(channel)
        return {"motion": nvr.parse_motion_grid(MOTION), "privacy_mask": nvr.parse_privacy_mask(PRIVACY), "intrusion": None, "line_crossing": nvr.parse_line_detection(LINES), "unsupported": {"intrusion": "forbidden"}}

    monkeypatch.setattr(cameras_router, "ZONES", fake_zones)
    cameras_router._ZONES_CACHE.clear()
    r = c.get(f"/api/v1/cameras/{cam}/zones")
    assert r.status_code == 200, r.text
    z = r.json()
    assert z["read_only"] is True and z["source"] == "nvr" and z["channel"] == 3 and z["motion"]["coverage_pct"] > 90 and z["unsupported"] == {"intrusion": "forbidden"} and z["intrusion"] is None
    assert z["line_crossing"]["lines"][0]["direction"] == "left" and z["cached"] is False and calls == [3]
    assert c.get(f"/api/v1/cameras/{cam}/zones").json()["cached"] is True and calls == [3], "served from the one-minute cache"
    assert c.get(f"/api/v1/cameras/{cam}/zones?refresh=true").json()["cached"] is False and calls == [3, 3]
    # same permission as live video: a viewer on another floor sees nothing, a viewer on the camera's floor does
    bind(c, settings, "ron", "viewer", "floor", ids["floor3"])
    assert c.get(f"/api/v1/cameras/{cam}/zones", headers=as_user("ron")).status_code == 403
    bind(c, settings, "ron", "viewer", "installation", "*")
    assert c.get(f"/api/v1/cameras/{cam}/zones", headers=as_user("ron")).status_code == 200
    assert c.get("/api/v1/cameras/nope/zones").status_code == 404
    # nothing here writes: the router has no PUT/POST for zones
    assert not [r for r in app.routes if getattr(r, "path", "").endswith("/zones") and set(getattr(r, "methods", set())) & {"PUT", "POST", "PATCH", "DELETE"}]
