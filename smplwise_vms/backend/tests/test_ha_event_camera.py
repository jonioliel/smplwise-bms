"""0.1.74: events from the Home Assistant Hikvision integration belong to the camera on their channel."""
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import correlation


def test_nvr_entity_maps_to_camera_and_backfill(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        cam = c.post("/api/v1/cameras", json={"channel": 9, "alias": "רחבת כניסה"}).json()
        with app.state.db.connection() as conn:
            assert correlation.nvr_entity_camera(conn, "binary_sensor.ds_7616nxi_k2_d_abc_9_motiondetection") == (cam["id"], 9)
            assert correlation.nvr_entity_camera(conn, "binary_sensor.ds_7616_12_linedetection") == (None, None), "no camera on channel 12"
            assert correlation.nvr_entity_camera(conn, "binary_sensor.front_door") == (None, None)
            conn.execute("INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) "
                         "VALUES ('h1','ha','binary_sensor.motion','motion',NULL,NULL,'2026-09-18T06:00:00Z','2026-09-18T06:00:01Z','none',1,'info','measured',?, 'k1','2026-09-18T06:00:01Z')",
                         ('{"entity_id": "binary_sensor.ds_7616nxi_k2_d_abc_9_motiondetection"}',))
            assert correlation.backfill_ha_event_cameras(conn) == 1
            row = conn.execute("SELECT camera_id, channel FROM events WHERE id = 'h1'").fetchone()
            assert row["camera_id"] == cam["id"] and row["channel"] == 9
            assert correlation.backfill_ha_event_cameras(conn) == 0
