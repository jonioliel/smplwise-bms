"""NVR storage and recording plan (T051): ISAPI parsing on documents shaped like the lab captures, the report with
measured vs. estimated retention and their reasons, honest states without an NVR or when it is unreachable,
and the permission gate. No device is contacted."""
from __future__ import annotations

import datetime as dt
from dataclasses import replace

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import nvr, storage

STORAGE_XML = """<?xml version="1.0" encoding="UTF-8" ?>
<storage version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<hddList>
<hdd version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<id>2</id><hddName>hdd2</hddName><hddPath></hddPath><hddType>SATA</hddType><status>ok</status>
<capacity>1907729</capacity><freeSpace>224256</freeSpace><property>RW</property><manufacturer>unknow</manufacturer>
</hdd>
</hddList>
<nasList>
</nasList>
<workMode>quota</workMode>
</storage>"""


def _track(track_id: int, mode: str, days=("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"), bitrate=3072, pre=5, post=60) -> str:
    blocks = "".join(
        f"<ScheduleAction><id>{i + 1}</id><ScheduleActionStartTime><DayOfWeek>{d}</DayOfWeek><TimeOfDay>00:00:00</TimeOfDay></ScheduleActionStartTime>"
        f"<ScheduleActionEndTime><DayOfWeek>{d}</DayOfWeek><TimeOfDay>00:00:00</TimeOfDay></ScheduleActionEndTime><ScheduleDSTEnable>true</ScheduleDSTEnable>"
        f"<Description>nothing</Description><Actions><Record>true</Record><Log>false</Log><SaveImg>false</SaveImg><ActionRecordingMode>{mode}</ActionRecordingMode></Actions></ScheduleAction>"
        for i, d in enumerate(days)
    )
    return (
        f'<Track version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema"><id>{track_id}</id><Channel>{track_id}</Channel><Enable>false</Enable>'
        f"<Description>\ntrackType=standard,contentType=video,codecType=H.264-BP,resolution=2560x1440,framerate=25.0 fps,bitrate={bitrate} kbps</Description>"
        f'<SrcDescriptor><SrcGUID>x</SrcGUID><SrcChannel>{track_id // 100}</SrcChannel><SrcDriver>RTSP</SrcDriver><SrcType>video</SrcType><SrcUrl>rtsp://x</SrcUrl><SrcUrlMethods>DESCRIBE</SrcUrlMethods><SrcLogin>u</SrcLogin></SrcDescriptor>'
        f'<Size>1</Size><Duration min="0" max="750">P0DT0H</Duration><DefaultRecordingMode>CMR</DefaultRecordingMode><StreamHint></StreamHint>'
        f"<TrackSchedule><ScheduleBlockList><ScheduleBlock><ScheduleBlockGUID>{{1}}</ScheduleBlockGUID><ScheduleBlockType>www.hikvision.com/racm/schedule/ver10</ScheduleBlockType>{blocks}</ScheduleBlock></ScheduleBlockList></TrackSchedule>"
        f"<CustomExtensionList><CustomExtension><CustomExtensionName>www.hikvision.com/RaCM/trackExt/ver10</CustomExtensionName><enableSchedule>true</enableSchedule><SaveAudio>true</SaveAudio>"
        f'<PreRecordTimeSeconds>{pre}</PreRecordTimeSeconds><PostRecordTimeSeconds opt="30,60">{post}</PostRecordTimeSeconds><HolidaySchedule><Enable>false</Enable></HolidaySchedule></CustomExtension></CustomExtensionList></Track>'
    )


TRACKS_XML = '<?xml version="1.0" encoding="UTF-8" ?><TrackList version="1.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">' + _track(101, "MOTION") + _track(201, "CMR", days=("Monday", "Tuesday"), bitrate=2048, post=30) + "</TrackList>"


def test_parse_storage_and_tracks():
    st = nvr.parse_storage(STORAGE_XML)
    assert st["work_mode"] == "quota" and st["nas"] == [] and len(st["disks"]) == 1
    d = st["disks"][0]
    assert (d.id, d.name, d.kind, d.status, d.capacity_mb, d.free_mb, d.property) == ("2", "hdd2", "SATA", "ok", 1907729, 224256, "RW")

    tracks = nvr.parse_tracks_schedule(TRACKS_XML)
    assert [t.track_id for t in tracks] == [101, 201]
    t = tracks[0]
    assert t.channel == 101 and t.src_channel == 1 and t.enable_flag is False and t.default_mode == "CMR" and t.expiry == "P0DT0H"
    assert t.pre_s == 5 and t.post_s == 60 and t.save_audio is True and t.description["bitrate_kbps"] == 3072 and t.description["resolution"] == "2560x1440"
    assert len(t.blocks) == 7 and t.blocks[0] == {"day": "Monday", "start": "00:00:00", "end_day": "Monday", "end": "00:00:00", "record": True, "mode": "MOTION"} and t.modes == ["MOTION"]
    assert storage.schedule_summary(t) == "תנועה · כל השבוע, 24 שעות"
    assert storage.schedule_summary(tracks[1]) == "רציף · 2 ימים בשבוע" and tracks[1].post_s == 30
    assert storage.schedule_summary(None) == "אין track הקלטה ידוע"
    single = nvr.parse_tracks_schedule(_track(301, "CMR"))
    assert len(single) == 1 and single[0].track_id == 301


def test_report_measured_and_estimated_retention(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.example", nvr_user="u", nvr_password="p")
    app = create_app(s)
    c = TestClient(app)
    seed_tree(c)
    cam1 = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    cam2 = c.post("/api/v1/cameras", json={"channel": 2, "alias": "חניה"}).json()
    cam3 = c.post("/api/v1/cameras", json={"channel": 3, "alias": "ללא track"}).json()
    with app.state.db.connection() as conn:
        conn.execute("UPDATE cameras SET main_track = 101 WHERE id = ?", (cam1["id"],))
        conn.execute("UPDATE cameras SET main_track = 201 WHERE id = ?", (cam2["id"],))
    now = dt.datetime(2026, 9, 16, 12, 0, tzinfo=dt.timezone.utc)
    searched: list[tuple[int, str, str]] = []

    def fake_oldest(_settings, track_id, start_wall, end_wall):
        searched.append((track_id, start_wall, end_wall))
        return {101: "2026-09-04T12:00:00Z", 201: None}[track_id]  # local wall clock (Asia/Jerusalem = UTC+3 in September)

    monkeypatch.setattr(storage, "STORAGE", lambda _s: nvr.parse_storage(STORAGE_XML))
    monkeypatch.setattr(storage, "TRACKS", lambda _s: nvr.parse_tracks_schedule(TRACKS_XML))
    monkeypatch.setattr(storage, "OLDEST", fake_oldest)
    storage.invalidate()
    with app.state.db.connection() as conn:
        rep = storage.report(s, conn, fresh=True, now=now)
    assert rep["nvr"] == {"configured": True, "reachable": True, "error": None} and rep["work_mode"] == "quota" and rep["cached"] is False
    assert rep["totals"] == {"capacity_mb": 1907729, "free_mb": 224256, "used_mb": 1683473, "used_pct": 88.2, "disks": 1, "nas": 0, "disks_ok": 1}
    assert rep["disks"][0]["used_mb"] == 1683473 and rep["disks"][0]["status"] == "ok"
    by = {x["camera_id"]: x for x in rep["cameras"]}
    assert by[cam1["id"]]["summary"] == "תנועה · כל השבוע, 24 שעות" and by[cam1["id"]]["pre_s"] == 5 and by[cam1["id"]]["bitrate_kbps"] == 3072
    assert by[cam1["id"]]["oldest_recording_at"] == "2026-09-04T09:00:00Z" and by[cam1["id"]]["retention_days"] == 12.1 and "120" in by[cam1["id"]]["retention_reason"]
    assert by[cam2["id"]]["retention_days"] is None and "לא נמצאו" in by[cam2["id"]]["retention_reason"]
    assert by[cam3["id"]]["track_id"] is None and by[cam3["id"]]["has_schedule"] is False and "סנכרון" in by[cam3["id"]]["retention_reason"]
    assert searched == [(101, "2026-05-19T15:00:00Z", "2026-09-16T15:00:00Z"), (201, "2026-05-19T15:00:00Z", "2026-09-16T15:00:00Z")], "one bounded search per camera with a track, in the device's wall clock"
    r = rep["retention"]
    assert r["measured_days_min"] == 12.1 and r["measured_days_max"] == 12.1 and "1 מתוך 3" in r["measured_reason"]
    # capacity 1907729 MB over (3072 + 2048) kbps of continuous recording ≈ 36.2 days
    assert r["bitrate_total_kbps"] == 5120 and r["estimated_days"] == 36.2 and "2 מצלמות" in r["estimated_reason"]
    assert rep["limits"]["writes"] is False and len(rep["limits"]["notes"]) == 3

    # cached second read; fresh=true asks again
    with app.state.db.connection() as conn:
        assert storage.report(s, conn)["cached"] is True
        assert storage.report(s, conn, fresh=True)["cached"] is False

    # the API: admin reads, a viewer is refused
    assert c.get("/api/v1/storage").json()["totals"]["capacity_mb"] == 1907729
    assert c.get("/api/v1/storage", headers=as_user("nobody")).status_code == 403

    # an unreachable NVR is reported, not raised
    def boom(_s):
        raise RuntimeError("down")

    monkeypatch.setattr(storage, "STORAGE", boom)
    with app.state.db.connection() as conn:
        down = storage.report(s, conn, fresh=True, now=now)
    assert down["nvr"] == {"configured": True, "reachable": False, "error": "RuntimeError"} and down["disks"] == [] and down["totals"] is None
    assert "RuntimeError" in down["retention"]["measured_reason"]


def test_report_without_nvr(client, settings):
    ids = seed_tree(client)
    storage.invalidate()
    rep = client.get("/api/v1/storage").json()
    assert rep["nvr"]["configured"] is False and rep["disks"] == [] and rep["cameras"] == [] and rep["retention"]["measured_reason"] == "ה־NVR לא מוגדר"
    bind(client, settings, "ron", "viewer", "floor", ids["floor2"])
    assert client.get("/api/v1/storage", headers=as_user("ron")).status_code == 403
