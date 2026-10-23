"""CAMHEALTH091 camera image health (board r091): the pure image checks on SYNTHETIC pictures generated here (no captured image is
used), the sampling path (snapshot cache, then the existing sub stream by name only - never a source, never a stream outside the
`smplwise_` namespace, never the recorder's picture endpoint), the OFF default, the settings API with every threshold, the reference
view, and the alert through the notification pipeline with editable recipients."""
from __future__ import annotations

import io
import os
from dataclasses import replace
from typing import Any

import httpx
import numpy as np
import pytest
from conftest import as_user
from notify_src_world import API, Clock, World, clock, fake_push, iso  # noqa: F401 - fixtures
from PIL import Image, ImageFilter

from smplwise.errors import ApiError
from smplwise.services import camera_image_health as cih
from smplwise.services import go2rtc as g2

TH = cih.defaults()


# ---------------------------------------------------------------- synthetic pictures

def canvas(seed: int = 7, w: int = 480, h: int = 320) -> np.ndarray:
    """A textured scene: a gradient, blocks of random grey and a few hard-edged shapes (deterministic)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w]
    img = 60 + 0.25 * xx + 0.15 * yy
    blocks = rng.integers(0, 120, size=(h // 16 + 1, w // 16 + 1)).repeat(16, 0).repeat(16, 1)[:h, :w]
    img = img + blocks
    for _ in range(12):
        x0, y0 = int(rng.integers(0, w - 60)), int(rng.integers(0, h - 40))
        img[y0:y0 + int(rng.integers(10, 40)), x0:x0 + int(rng.integers(10, 60))] = rng.integers(0, 255)
    return np.clip(img, 0, 255).astype(np.uint8)


def view(c: np.ndarray, x: int = 80, y: int = 40, w: int = 320, h: int = 240) -> np.ndarray:
    return c[y:y + h, x:x + w].copy()


def noisy(img: np.ndarray, seed: int, sigma: float = 4.0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.clip(img.astype(np.float32) + rng.normal(0, sigma, img.shape), 0, 255).astype(np.uint8)


def dark(img: np.ndarray) -> np.ndarray:
    return (img.astype(np.float32) * 0.04).astype(np.uint8)


def blurred(img: np.ndarray) -> np.ndarray:
    return np.asarray(Image.fromarray(img).filter(ImageFilter.GaussianBlur(8)), dtype=np.uint8)


def jpeg(img: np.ndarray, quality: int = 85) -> bytes:
    buf = io.BytesIO()
    Image.fromarray(img).save(buf, "JPEG", quality=quality)
    return buf.getvalue()


SCENE = canvas()
LIVE = [noisy(view(SCENE), s) for s in range(1, 8)]


@pytest.fixture(autouse=True)
def _clean():
    cih.reset()
    yield
    cih.reset()


# ---------------------------------------------------------------- pure checks

def test_brightness_and_sharpness_separate_good_dark_and_blurred_pictures():
    good, d, b = view(SCENE), dark(view(SCENE)), blurred(view(SCENE))
    assert cih.brightness(good) > 80 and cih.brightness(d) < TH["dark_level"]
    assert cih.sharpness(good) > 20 * TH["blur_min"], cih.sharpness(good)
    assert cih.sharpness(b) < TH["blur_min"], cih.sharpness(b)


def test_frame_difference_is_zero_for_the_same_picture_and_clear_for_a_live_one():
    a, b = cih.resize(LIVE[0], cih.FREEZE_SIZE), cih.resize(LIVE[1], cih.FREEZE_SIZE)
    assert cih.frame_diff(a, a) == 0.0
    assert cih.frame_diff(a, b) > 2 * TH["freeze_diff"]
    assert cih.frame_diff(a, cih.resize(LIVE[0], (64, 48))) is None, "a resolution change is not a freeze"


def test_best_shift_finds_the_move_and_ignores_a_lighting_change():
    ref = cih.resize(view(SCENE), cih.THUMB_SIZE)
    moved = cih.resize(view(SCENE, x=120), cih.THUMB_SIZE)  # 40 of 320 px = 12.5 %
    dx, dy, corr = cih.best_shift(ref, moved)
    assert (abs(dx), dy) == (8, 0) and corr > 0.9, (dx, dy, corr)
    night = np.clip(view(SCENE).astype(np.float32) * 0.5 + 40, 0, 255).astype(np.uint8)  # darker, flatter, same view
    dx, dy, corr = cih.best_shift(ref, cih.resize(night, cih.THUMB_SIZE))
    assert (dx, dy) == (0, 0) and corr > 0.95
    other = cih.resize(view(canvas(seed=99)), cih.THUMB_SIZE)
    assert cih.best_shift(ref, other)[2] < TH["shift_corr_min"], "a different view correlates poorly at any offset"


def test_decode_reads_a_jpeg_at_a_reduced_size_and_refuses_garbage():
    g = cih.decode(jpeg(canvas(w=1280, h=720)))
    assert g.dtype == np.uint8 and g.shape[1] <= 320 and g.shape[0] <= 240
    with pytest.raises(ApiError) as e:
        cih.decode(b"\xff\xd8\xffnot a picture")
    assert e.value.code == "decode_failed"


# ---------------------------------------------------------------- the state machine

def run(st: cih.CamState, frames: list[np.ndarray], th: dict[str, Any] | None = None, t0: float = 1000.0) -> list[set[str]]:
    out = []
    for i, f in enumerate(frames):
        cih.record(st, f, th or TH, t0 + i * 900, "stream")
        out.append(set(st.active))
    return out


def test_a_live_camera_stays_ok():
    st = cih.state_of("cam-1")
    cih.REFS["cam-1"] = cih.resize(LIVE[0], cih.THUMB_SIZE)
    assert run(st, LIVE) == [set()] * len(LIVE)
    assert st.metrics["shift_pct"] == 0.0 and st.metrics["corr"] > 0.9


def test_dark_and_blurred_need_confirm_samples_in_a_row_and_dark_is_not_also_blurred():
    st = cih.state_of("cam-1")
    assert run(st, [dark(LIVE[0]), noisy(dark(LIVE[0]), 9), LIVE[2]]) == [set(), {"dark"}, set()]
    st = cih.state_of("cam-2")
    assert run(st, [blurred(LIVE[0]), blurred(LIVE[1]), blurred(LIVE[2])]) == [set(), {"blurred"}, {"blurred"}]


def test_frozen_after_freeze_samples_identical_pictures():
    st = cih.state_of("cam-1")
    same = LIVE[0]
    assert run(st, [same, same, same, LIVE[1]]) == [set(), set(), {"frozen"}, set()]
    st = cih.state_of("cam-2")
    th = {**TH, "freeze_samples": 2}
    assert run(st, [same, same], th) == [set(), {"frozen"}]


def test_shifted_and_view_changed_against_the_reference():
    cih.REFS["cam-1"] = cih.resize(view(SCENE), cih.THUMB_SIZE)
    st = cih.state_of("cam-1")
    moved = [noisy(view(SCENE, x=120), s) for s in (11, 12)]
    assert run(st, moved) == [set(), {"shifted"}]
    assert st.metrics["shift_pct"] == 12.5
    cih.REFS["cam-2"] = cih.resize(view(SCENE), cih.THUMB_SIZE)
    st = cih.state_of("cam-2")
    other = [noisy(view(canvas(seed=99)), s) for s in (13, 14)]
    assert run(st, other) == [set(), {"shifted"}]
    cih.REFS["cam-3"] = cih.resize(view(SCENE), cih.THUMB_SIZE)
    st = cih.state_of("cam-3")
    small = [noisy(view(SCENE, x=90), s) for s in (15, 16)]  # 10 px = 3 % of the frame: within the default 8 %
    assert run(st, small) == [set(), set()]


def test_each_check_can_be_switched_off():
    th = {**TH, "check_dark": False, "check_freeze": False}
    st = cih.state_of("cam-1")
    assert run(st, [dark(LIVE[0])] * 4, th) == [set()] * 4


# ---------------------------------------------------------------- settings

def test_settings_defaults_are_off_and_every_threshold_is_validated():
    d = cih.defaults()
    assert d["enabled"] is False and d["interval_s"] == 900 and d["excluded"] == []
    assert set(cih.NUMBERS) | set(cih.BOOLS) | {"excluded"} == set(d)
    assert cih.validate({"blur_min": 12.5, "freeze_samples": 4, "enabled": True}) == {"blur_min": 12.5, "freeze_samples": 4, "enabled": True}
    for bad in ({"interval_s": 10}, {"freeze_samples": 2.5}, {"enabled": "yes"}, {"dark_level": True}, {"nope": 1}, {"excluded": ["../x"]}):
        with pytest.raises(ApiError) as e:
            cih.validate(bad)
        assert e.value.status == 422, bad


# ---------------------------------------------------------------- sampling: the load rule

class FakeG2:
    """A go2rtc client: records what was asked; `frame_existing` is the only grab the sampler may use."""

    def __init__(self, frames: dict[str, bytes], fail: str | None = None) -> None:
        self.frames, self.fail, self.calls = frames, fail, []

    def frame_existing(self, name: str) -> bytes:
        self.calls.append(("frame_existing", name))
        if self.fail:
            raise ApiError(503, self.fail, "x")
        return self.frames[name]

    def __getattr__(self, item: str):  # frame_jpeg / ensure_stream / delete_stream would be a violation
        raise AssertionError(f"the sampler must not call {item}")


ROW = {"id": "cam-1", "recorder_id": "nvr-1", "channel": 4, "alias": "לובי", "name_source": None}
SUB = "smplwise_nvr-1_ch4_sub"


def test_sample_uses_the_existing_sub_stream_by_name_only(settings):
    client = FakeG2({SUB: jpeg(LIVE[0])})
    st = cih.sample(settings, ROW, TH, client, {SUB: g2.StreamInfo(SUB, [], False)}, now_ts=1000.0)
    assert (st.error, st.source, client.calls) == (None, "stream", [("frame_existing", SUB)])
    assert st.metrics["brightness"] > 50


def test_no_stream_or_passive_only_on_an_idle_stream_means_no_sample(settings):
    client = FakeG2({SUB: jpeg(LIVE[0])})
    st = cih.sample(settings, ROW, TH, client, {}, now_ts=1000.0)
    assert st.error == "no_source" and client.calls == []
    st = cih.sample(settings, ROW, {**TH, "passive_only": True}, client, {SUB: g2.StreamInfo(SUB, [], False)}, now_ts=2000.0)
    assert st.error == "no_source" and client.calls == []
    st = cih.sample(settings, ROW, {**TH, "passive_only": True}, client, {SUB: g2.StreamInfo(SUB, [], True)}, now_ts=3000.0)
    assert st.error is None and client.calls == [("frame_existing", SUB)]


def test_a_fresh_cached_snapshot_is_used_once_and_never_twice(settings):
    folder = settings.data_dir / "snapshots"
    folder.mkdir(parents=True)
    path = folder / "cam-1.jpg"
    path.write_bytes(jpeg(LIVE[0]))
    os.utime(path, (5000.0, 5000.0))
    client = FakeG2({SUB: jpeg(LIVE[1])})
    listing = {SUB: g2.StreamInfo(SUB, [], False)}
    st = cih.sample(settings, ROW, TH, client, listing, now_ts=5100.0)
    assert (st.source, client.calls) == ("cache", [])
    st = cih.sample(settings, ROW, TH, client, listing, now_ts=6100.0)
    assert st.source == "stream", "the same cached file again would look like a frozen picture"


def test_a_failed_grab_is_not_judged(settings):
    st = cih.state_of("cam-1")
    run(st, [dark(LIVE[0]), dark(LIVE[1])])
    assert st.active == {"dark"}
    cih.sample(settings, ROW, TH, FakeG2({}, fail="media_unavailable"), {SUB: g2.StreamInfo(SUB, [], True)}, now_ts=9000.0)
    assert st.error == "media_unavailable" and st.active == {"dark"}


def test_frame_existing_sends_the_name_only_and_refuses_foreign_streams(settings, monkeypatch):
    seen: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        if req.url.params.get("src") == "smplwise_gone":
            return httpx.Response(404)
        return httpx.Response(200, content=jpeg(LIVE[0]))

    real = httpx.Client
    monkeypatch.setattr(g2.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    client = g2.Go2rtc(replace(settings, go2rtc_url="http://go2rtc.test:1984"))
    assert client.frame_existing(SUB).startswith(b"\xff\xd8\xff")
    assert [(r.method, r.url.path, dict(r.url.params)) for r in seen] == [("GET", "/api/frame.jpeg", {"src": SUB})]
    with pytest.raises(ApiError) as e:
        client.frame_existing("smplwise_gone")
    assert e.value.code == "snapshot_unavailable" and len(seen) == 2, "a 404 is never retried with a source"
    for foreign in ("intercom_door_1", "rtsp://user:pass@host/x"):
        with pytest.raises(ValueError):
            client.frame_existing(foreign)
    assert len(seen) == 2


# ---------------------------------------------------------------- the app: API, poller, notifications

@pytest.fixture()
def w(settings, clock) -> World:  # noqa: F811
    yield World(settings, clock)


def enable(w: World, **extra: Any) -> None:
    r = w.c.put(f"{API}/camera-image-health/settings", json={"enabled": True, **extra})
    assert r.status_code == 200, r.text


def feed(w: World, frames: list[np.ndarray], minutes: int = 15) -> None:
    """Samples of the world's camera through the real record() at the world's clock, each followed by the monitor pass."""
    st = cih.state_of(w.cam)
    for f in frames:
        w.clock.advance(minutes=minutes)
        cih.record(st, f, cih.defaults() | {"enabled": True}, w.clock.now.timestamp(), "stream")
        w.tick()


def test_off_by_default_nothing_is_sampled_and_check_is_refused(w, monkeypatch):
    called = []
    monkeypatch.setattr(cih, "_client", lambda settings: called.append(1) or FakeG2({}))
    assert cih.poll_once(w.db, w.settings) == 0 and called == []
    r = w.c.get(f"{API}/camera-image-health")
    assert r.status_code == 200 and r.json()["enabled"] is False
    assert {c["state"] for c in r.json()["cameras"]} == {"off"}
    assert w.c.post(f"{API}/camera-image-health/check").status_code == 409


def test_settings_api_ranges_audit_and_permissions(w):
    g = w.c.get(f"{API}/camera-image-health/settings")
    assert g.status_code == 200, g.text
    body = g.json()
    assert body["values"]["enabled"] is False and body["source"] == "camera.image"
    assert body["ranges"]["blur_min"] == {"default": 25.0, "min": 0.5, "max": 5000.0}
    assert {c["id"] for c in body["cameras"]} == {w.cam}
    p = w.c.put(f"{API}/camera-image-health/settings", json={"interval_s": 600, "shift_pct": 12, "excluded": [w.cam]})
    assert p.status_code == 200 and p.json()["values"]["shift_pct"] == 12 and p.json()["values"]["excluded"] == [w.cam]
    assert w.c.put(f"{API}/camera-image-health/settings", json={"interval_s": 5}).status_code == 422
    for path in ("settings",):
        assert w.c.get(f"{API}/camera-image-health/{path}", headers=as_user("ops2")).status_code == 403
    assert w.c.put(f"{API}/camera-image-health/settings", json={"enabled": True}, headers=as_user("ops2")).status_code == 403
    assert w.c.post(f"{API}/camera-image-health/{w.cam}/reference", json={"action": "clear"}, headers=as_user("ops2")).status_code == 403
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'camera_image_health.settings'").fetchone()[0] == 1


def test_check_now_samples_through_go2rtc_sets_the_reference_and_serves_numbers_only(w, monkeypatch):
    enable(w)
    rec = w.c.get(f"{API}/cameras").json()["cameras"][0]
    name = g2.stream_name(rec["recorder_id"], rec["channel"], "sub")

    class Client(FakeG2):
        def list_streams(self):
            self.calls.append(("list_streams",))
            return {name: g2.StreamInfo(name, ["rtsp://secret-user:secret-pass@nvr.lan/x"], True), "intercom_door": g2.StreamInfo("intercom_door", [], True)}

    client = Client({name: jpeg(LIVE[0])})
    monkeypatch.setattr(cih, "_client", lambda settings: client)
    r = w.c.post(f"{API}/camera-image-health/check")
    assert r.status_code == 200, r.text
    cam = next(c for c in r.json()["cameras"] if c["id"] == w.cam)
    assert cam["state"] == "ok" and cam["source"] == "stream" and cam["reference"]["auto"] is True
    assert client.calls == [("list_streams",), ("frame_existing", name)]
    assert "secret" not in r.text and "rtsp" not in r.text
    # an administrator re-sets the reference from the latest sample; ops2 (floor 2 operator) may read the results
    r = w.c.post(f"{API}/camera-image-health/{w.cam}/reference", json={"action": "set"})
    assert r.status_code == 200 and next(c for c in r.json()["cameras"] if c["id"] == w.cam)["reference"]["auto"] is False
    r = w.c.get(f"{API}/camera-image-health", headers=as_user("ops2"))
    assert r.status_code == 200 and r.json()["can_manage"] is False
    with w.db.connection(mode="read") as conn:
        row = conn.execute("SELECT width, height, length(thumb) FROM camera_image_refs WHERE camera_id = ?", (w.cam,)).fetchone()
        assert tuple(row) == (64, 48, 64 * 48)
    # the reference survives a restart (the mirror is reloaded from the table)
    cih.reset()
    with w.db.connection(mode="read") as conn:
        cih.load_refs(conn)
    assert cih.REFS[w.cam].shape == (48, 64)
    assert w.c.post(f"{API}/camera-image-health/{w.cam}/reference", json={"action": "clear"}).status_code == 200
    assert w.cam not in cih.REFS


def test_a_dark_camera_is_announced_to_the_policy_recipients_and_resolves_after_the_recover_hold(w):
    enable(w, recover_s=600)
    feed(w, [LIVE[0], dark(LIVE[1]), dark(LIVE[2])])
    n = w.one("camera.image", "open")
    assert (n["subject_kind"], n["subject_id"], n["severity"]) == ("camera", w.cam, "alert")
    assert "חשוכה" in n["body"] and n["dedupe_key"] == f"camera.image:{w.cam}:dark"
    assert "joni" in w.recipients(n["id"])
    feed(w, [LIVE[3]], minutes=5)
    assert w.one("camera.image")["state"] != "resolved", "clear, but not for the recover hold yet"
    feed(w, [LIVE[4]], minutes=11)
    assert w.one("camera.image")["state"] == "resolved"


def test_recipients_are_the_editable_notification_policy(w):
    r = w.c.get(f"{API}/notify/policies/camera.image")
    assert r.status_code == 200, r.text
    pol = r.json()
    assert pol["recipients"] == {"rule": "managers"} and pol["subject_kind"] == "camera"
    r = w.c.put(f"{API}/notify/policies/camera.image", json={"recipients": {"rule": "users", "user_ids": ["dev-ops2", "dev-ops3"]}, "base_revision": pol["revision"]})
    assert r.status_code == 200, r.text
    enable(w)
    feed(w, [LIVE[0], dark(LIVE[1]), dark(LIVE[2])])
    assert w.recipients(w.one("camera.image", "open")["id"]) == {"ops2"}, "the named users who can see the camera (ops3 is on floor 3)"


def test_switching_off_resolves_every_open_row(w):
    enable(w)
    feed(w, [LIVE[0], LIVE[0], LIVE[0]])
    assert w.one("camera.image", "open")["dedupe_key"].endswith(":frozen")
    assert w.c.put(f"{API}/camera-image-health/settings", json={"enabled": False}).status_code == 200
    w.tick()
    assert w.one("camera.image")["state"] == "resolved"
    assert cih.STORE == {}


def test_a_stale_result_is_not_judged(w):
    enable(w)
    feed(w, [LIVE[0], dark(LIVE[1]), dark(LIVE[2])])
    w.clock.advance(hours=3)  # no sample for longer than three intervals
    w.tick()
    assert w.one("camera.image")["state"] != "resolved"
    cams = w.c.get(f"{API}/camera-image-health").json()["cameras"]
    assert next(c for c in cams if c["id"] == w.cam)["state"] == "unknown"
