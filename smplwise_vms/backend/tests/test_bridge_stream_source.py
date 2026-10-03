"""Bridge 0.3.1: the `smplwise_bridge.stream_source` service - a signed, READ-ONLY answer with the stream source of ONE camera
entity (docs/design/CAMERA_CARD_HA_SOURCE.md). Tested through integration/smplwise_bridge/stream_source_service.py against a
FAKE Home Assistant (users, states, and a fake camera API); registration, schema, unload, translations and the mirror are
checked structurally on the integration files. Synthetic data only: the URL and its credentials below are made up, and the
tests assert they never reach a log line or an error answer."""
from __future__ import annotations

import ast
import asyncio
import json
import logging
import sys
from types import SimpleNamespace

import pytest

from bridge_loader import MIRROR, REPO, SRC, init_tree, load

sys.path.insert(0, str(REPO / "scripts"))

svc = load("stream_source_service")
signing = load("signing")
const = load("const")

SECRET = "pairing-secret-for-tests"
URL = "rtsp://cam-user:cam-pass-9f3@192.0.2.50:554/live/ch1?token=abcdef123456"
PASSWORD, TOKEN = "cam-pass-9f3", "abcdef123456"


class FakeUser:
    def __init__(self, uid="u1", *, admin=True, active=True):
        self.id, self.is_admin, self.is_active = uid, admin, active


class FakeHass:
    def __init__(self, users=None, entities=("camera.garden",)):
        self.users = users if users is not None else {"u1": FakeUser()}
        self.states = SimpleNamespace(get=lambda eid: SimpleNamespace(state="idle", attributes={}) if eid in entities else None)
        self.auth = SimpleNamespace(async_get_user=self._get_user)

    async def _get_user(self, uid):
        return self.users.get(uid)


class FakeCamera:
    """The fake camera API behind `_ha()`: what Home Assistant reports for each entity, or an exception to raise."""

    def __init__(self, answers=None):
        self.answers = answers if answers is not None else {"camera.garden": URL}
        self.asked: list[str] = []

    async def get_stream_source(self, hass, entity_id):
        self.asked.append(entity_id)
        answer = self.answers.get(entity_id)
        if isinstance(answer, BaseException):
            raise answer
        if callable(answer):
            return await answer()
        return answer


_RESOLVES = {"127.0.0.1.nip.io": ["127.0.0.1"], "metadata.example": ["169.254.169.254"]}
_REAL_RESOLVE = svc._resolve


@pytest.fixture(autouse=True)
def _no_real_dns(monkeypatch):
    async def resolve(host):
        return list(_RESOLVES.get(host, []))

    monkeypatch.setattr(svc, "_resolve", resolve)


@pytest.fixture()
def cam(monkeypatch):
    fake = FakeCamera()
    monkeypatch.setattr(svc, "_ha", lambda: SimpleNamespace(get_stream_source=fake.get_stream_source))
    svc._calls.clear()
    svc._calls_by_entity.clear()
    yield fake
    svc._calls.clear()
    svc._calls_by_entity.clear()


def body(entity="camera.garden", user="u1", **extra):
    return {"user_id": user, "entity_id": entity, "request_id": "r1", **extra}


def ask(hass, msg=None, verifier=None, secret=SECRET):
    verifier = verifier or signing.Verifier(SECRET)
    return asyncio.run(svc.async_handle_stream_source(hass, verifier, signing.sign(secret, msg or body())))


def test_a_signed_request_for_a_camera_gets_its_stream_source(cam):
    out = ask(FakeHass())
    assert out == {"ok": True, "request_id": "r1", "stream_source": URL}
    assert cam.asked == ["camera.garden"]


@pytest.mark.parametrize("mode", ["bad_sig", "stale", "replay", "wrong_secret"])
def test_a_request_that_is_not_validly_signed_is_refused_before_anything_is_read(cam, mode):
    verifier = signing.Verifier(SECRET)
    msg = signing.sign(SECRET, body())
    if mode == "bad_sig":
        msg["entity_id"] = "camera.other"  # changed after signing
    if mode == "stale":
        msg = signing.sign(SECRET, body(), ts=1)
    if mode == "wrong_secret":
        msg = signing.sign("another-secret", body())
    if mode == "replay":
        assert asyncio.run(svc.async_handle_stream_source(FakeHass(), verifier, dict(msg)))["ok"] is True
        cam.asked.clear()
    out = asyncio.run(svc.async_handle_stream_source(FakeHass(), verifier, msg))
    assert out["ok"] is False and out["error"] in ("bad_signature", "stale", "replay") and "stream_source" not in out
    assert cam.asked == []


@pytest.mark.parametrize(
    "msg",
    [
        body(entity="light.garden"),
        body(entity="camera."),
        body(entity="camera.Garden"),  # entity ids are lower case
        body(entity="camera.a/../states"),
        body(entity="camera.garden,camera.other"),
        body(entity="camera." + "a" * 101),
        body(extra="x"),  # the request has exactly these keys
        {"user_id": "u1", "request_id": "r1"},
        {"user_id": 5, "entity_id": "camera.garden", "request_id": "r1"},
        {"user_id": "u1", "entity_id": ["camera.garden"], "request_id": "r1"},
    ],
)
def test_only_a_plain_camera_entity_id_is_accepted(cam, msg):
    out = ask(FakeHass(), msg)
    assert out["ok"] is False and out["error"] == "invalid_request"
    assert cam.asked == []


def test_only_an_active_home_assistant_administrator_may_ask(cam):
    hass = FakeHass({"u1": FakeUser(), "plain": FakeUser("plain", admin=False), "off": FakeUser("off", active=False)})
    assert ask(hass, body(user="plain"))["error"] == "admin_required"
    assert ask(hass, body(user="off"))["error"] == "unknown_user"
    assert ask(hass, body(user="nobody"))["error"] == "unknown_user"
    assert cam.asked == []
    assert ask(hass, body(user="u1"))["ok"] is True


def test_an_entity_that_does_not_exist_is_refused(cam):
    assert ask(FakeHass(entities=()))["error"] == "entity_not_found"
    assert cam.asked == []


def test_a_camera_without_a_stream_source_answers_no_stream_source(cam):
    for answer in (None, ""):
        cam.answers["camera.garden"] = answer
        out = ask(FakeHass())
        assert out["ok"] is False and out["error"] == "no_stream_source"


@pytest.mark.parametrize(
    "source",
    [
        "exec:ffmpeg -i x -f mpegts -",  # go2rtc would run this
        "ffmpeg:rtsp://cam-user:cam-pass-9f3@192.0.2.50/live#video=h264",
        "rtsp://cam-user:cam-pass-9f3@192.0.2.50/live #video=copy",
        "rtsp://cam-user:cam-pass-9f3@192.0.2.50/live#video=copy",
        "rtsp://cam-user:cam-pass-9f3@192.0.2.50/a\nb",
        "rtsp://cam-user:cam-pass-9f3@192.0.2.50/a\x00b",
        "file:///etc/passwd",
        "rtmp://cam-user:cam-pass-9f3@192.0.2.50/live",
        "rtsp://cam-user:cam-pass-9f3@192.0.2.50/" + "a" * svc.MAX_SOURCE_LEN,
        b"rtsp://x",
        {"url": URL},
    ],
)
def test_a_source_that_is_not_a_plain_streaming_url_is_refused_and_never_repeated(cam, caplog, source):
    cam.answers["camera.garden"] = source
    with caplog.at_level(logging.DEBUG):
        out = ask(FakeHass())
    assert out["ok"] is False and out["error"] in ("source_not_supported", "no_stream_source")
    assert PASSWORD not in json.dumps(out) and PASSWORD not in caplog.text and "192.0.2.50" not in caplog.text


@pytest.mark.parametrize("source", ["rtsp://u:p@192.0.2.50:554/s", "rtsps://u:p@192.0.2.50/s", "rtsp://cam.local/stream?x=1&y=2"])
def test_only_the_two_rtsp_schemes_pass(cam, source):
    cam.answers["camera.garden"] = source
    assert ask(FakeHass())["stream_source"] == source


@pytest.mark.parametrize("source", ["http://u:cam-pass-9f3@192.0.2.50:8080/video.mjpg", "https://cam.local/stream?x=1&y=2", "http://127.0.0.1:1984/api/streams"])
def test_an_http_source_is_refused_as_not_supported(cam, caplog, source):
    cam.answers["camera.garden"] = source
    with caplog.at_level(logging.DEBUG):
        out = ask(FakeHass())
    assert out == {"ok": False, "request_id": "r1", "error": "source_not_supported"}
    assert PASSWORD not in caplog.text and "192.0.2.50" not in caplog.text


@pytest.mark.parametrize("source", ["rtsp://cam-user:cam-pass-9f3@127.0.0.1.nip.io/live", "rtsps://metadata.example:322/x"])
def test_a_name_that_resolves_to_a_refused_address_is_refused_without_repeating_it(cam, caplog, source):
    cam.answers["camera.garden"] = source
    with caplog.at_level(logging.DEBUG):
        out = ask(FakeHass())
    assert out == {"ok": False, "request_id": "r1", "error": "source_not_allowed"}
    assert PASSWORD not in caplog.text and "nip.io" not in caplog.text and "metadata" not in caplog.text


def test_a_name_is_resolved_off_the_event_loop_with_a_timeout(cam, monkeypatch):
    seen = {}

    async def spy(self, host, *a, **k):
        seen["host"] = host
        return [(2, 1, 6, "", ("127.0.0.1", 0))]

    monkeypatch.setattr(svc, "_resolve", _REAL_RESOLVE)
    monkeypatch.setattr(asyncio.BaseEventLoop, "getaddrinfo", spy)
    cam.answers["camera.garden"] = "rtsp://rebind.example/x"
    assert ask(FakeHass())["error"] == "source_not_allowed" and seen["host"] == "rebind.example"
    assert svc.RESOLVE_TIMEOUT_S <= 5


def test_an_exception_answers_its_class_name_only_and_its_text_is_never_logged_or_returned(cam, caplog):
    class CameraBoom(Exception):
        pass

    cam.answers["camera.garden"] = CameraBoom(f"could not open {URL}")
    with caplog.at_level(logging.DEBUG):
        out = ask(FakeHass())
    assert out == {"ok": False, "request_id": "r1", "error": "CameraBoom"}
    assert PASSWORD not in caplog.text and TOKEN not in caplog.text and "192.0.2.50" not in caplog.text and "CameraBoom" in caplog.text


def test_a_read_that_hangs_is_cut_off(cam, monkeypatch):
    async def hang():
        await asyncio.sleep(30)

    cam.answers["camera.garden"] = hang
    monkeypatch.setattr(svc, "READ_TIMEOUT_S", 0.05)
    out = ask(FakeHass())
    assert out["ok"] is False and out["error"] in ("TimeoutError", "CancelledError")


def test_no_log_line_on_any_path_carries_the_url_or_its_parts(cam, caplog):
    hass = FakeHass({"u1": FakeUser(), "plain": FakeUser("plain", admin=False)})
    with caplog.at_level(logging.DEBUG):
        ask(hass)  # success
        ask(hass, body(user="plain"))
        ask(hass, body(entity="light.x"))
        ask(hass, secret="another-secret")
        cam.answers["camera.garden"] = "exec:" + URL
        ask(hass)
    for part in (URL, PASSWORD, TOKEN, "192.0.2.50", "cam-user", "rtsp://"):
        assert part not in caplog.text, part


def test_one_camera_has_its_own_small_budget(cam):
    hass = FakeHass()
    codes = [ask(hass).get("error") for _ in range(svc.RATE_MAX_PER_ENTITY + 3)]
    assert codes[: svc.RATE_MAX_PER_ENTITY] == [None] * svc.RATE_MAX_PER_ENTITY and codes[svc.RATE_MAX_PER_ENTITY :] == ["rate_limited"] * 3
    assert len(cam.asked) == svc.RATE_MAX_PER_ENTITY  # a refused call reads nothing


def test_a_failing_camera_cannot_use_up_the_budget_of_the_others(cam):
    """Opus review L2: viewers of one failing camera trigger re-reads; the other cameras (and the owner's enable) still get through."""
    entities = [f"camera.cam{i}" for i in range(svc.RATE_MAX // svc.RATE_MAX_PER_ENTITY)]
    hass = FakeHass(entities=("camera.garden", *entities))
    cam.answers.update({e: URL for e in entities})
    assert [ask(hass).get("error") for _ in range(svc.RATE_MAX_PER_ENTITY + 5)][-1] == "rate_limited"  # camera.garden is spent
    for e in entities:
        assert ask(hass, body(entity=e)).get("ok") is True, e
    later = [ask(hass, body(entity=entities[0])).get("error") for _ in range(svc.RATE_MAX_PER_ENTITY)]
    assert later[: svc.RATE_MAX_PER_ENTITY - 1] == [None] * (svc.RATE_MAX_PER_ENTITY - 1) and later[-1] == "rate_limited"  # each has its own budget
    assert ask(hass, body(entity="camera.garden")).get("error") == "rate_limited"


def test_all_cameras_together_have_a_larger_window(cam):
    entities = [f"camera.c{i}" for i in range(svc.RATE_MAX // svc.RATE_MAX_PER_ENTITY + 2)]
    hass = FakeHass(entities=tuple(entities))
    cam.answers.update({e: URL for e in entities})
    codes = [ask(hass, body(entity=e)).get("error") for e in entities for _ in range(svc.RATE_MAX_PER_ENTITY)]
    assert codes.count(None) == svc.RATE_MAX and codes.count("rate_limited") == len(codes) - svc.RATE_MAX


def test_a_source_that_points_back_at_go2rtc_or_the_host_is_refused_by_the_bridge(cam, caplog):
    for source in ("rtsp://127.0.0.1:8554/api/frame.jpeg?src=rtsp://evil&name=smplwise_x", "rtsp://127.0.0.1/x", "rtsp://cam-user:cam-pass-9f3@localhost/x", "rtsp://192.0.2.50/s?src=x"):
        svc._calls.clear()
        svc._calls_by_entity.clear()
        cam.answers["camera.garden"] = source
        with caplog.at_level(logging.DEBUG):
            out = ask(FakeHass())
        assert out == {"ok": False, "request_id": "r1", "error": "source_not_allowed"}, source
    assert PASSWORD not in caplog.text and "127.0.0.1" not in caplog.text
    cam.answers["camera.garden"] = "rtsp://user:pass@192.0.2.10:554/stream1"
    svc._calls.clear()
    svc._calls_by_entity.clear()
    assert ask(FakeHass())["ok"] is True


def test_the_service_reads_only_and_has_no_network_or_write_calls():
    """Structural: nothing in the module opens a connection, writes a registry or calls a service."""
    src = (SRC / "stream_source_service.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
    for forbidden in ("async_call", "async_update_entity", "async_get_clientsession", "aiohttp", "httpx", "requests", "subprocess", "open", "async_register"):
        assert forbidden not in names, forbidden
    assert "_LOGGER.debug" not in src and "print(" not in src
    for call in ast.walk(tree):
        if isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute) and call.func.attr in ("warning", "info", "error", "exception", "critical"):
            args = {n.id for a in call.args[1:] for n in ast.walk(a) if isinstance(n, ast.Name)}
            assert not args & {"source", "msg", "entity_id"}, ast.unparse(call)  # a log call never formats the source, the request or the entity


# ---------------------------------------------------------------- __init__.py, const, services.yaml, translations, mirror


def _init_assign(name: str) -> ast.Assign:
    for node in init_tree().body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets):
            return node
    raise AssertionError(name)


def test_the_service_is_registered_read_only_with_a_closed_schema_and_removed_on_unload():
    src = (SRC / "__init__.py").read_text(encoding="utf-8")
    assert "hass.services.async_register(DOMAIN, SERVICE_STREAM_SOURCE, stream_source, schema=STREAM_SOURCE_SCHEMA, supports_response=SupportsResponse.ONLY)" in src
    assert "hass.services.async_remove(DOMAIN, SERVICE_STREAM_SOURCE)" in src
    assert "from .stream_source_service import async_handle_stream_source" in src
    assert const.SERVICE_STREAM_SOURCE == "stream_source"
    schema = ast.unparse(_init_assign("STREAM_SOURCE_SCHEMA"))
    assert "default" not in schema and "vol.PREVENT_EXTRA" in schema
    for key in ("user_id", "entity_id", "request_id", "ts", "nonce", "sig"):
        assert f"'{key}'" in schema, key
    assert set(svc.REQUEST_KEYS) == {"user_id", "entity_id", "request_id", "ts", "nonce", "sig"}
    # the handler is the only thing the service does: it hands the call to the module and returns its answer as it is
    handler = next(n for n in ast.walk(init_tree()) if isinstance(n, ast.AsyncFunctionDef) and n.name == "stream_source")
    assert "async_handle_stream_source(hass, verifier, dict(call.data))" in ast.unparse(handler)
    assert "_LOGGER" not in ast.unparse(handler)


def test_execute_still_cannot_read_a_camera_source_and_the_allow_list_is_unchanged():
    from bridge_loader import init_allowed_services

    allowed = init_allowed_services()
    assert not any(d == "camera" for d, _ in allowed) and ("light", "turn_on") in allowed


def test_description_translations_version_and_mirror():
    yaml_text = "\n" + (SRC / "services.yaml").read_text(encoding="utf-8")
    assert "\nstream_source:\n" in yaml_text
    block = yaml_text.split("\nstream_source:\n", 1)[1].split("\nsync_directory:", 1)[0]
    for field in ("user_id", "entity_id", "request_id", "ts", "nonce", "sig"):
        assert f"\n    {field}:\n" in "\n" + block, field
    for rel in ("strings.json", "translations/en.json", "translations/he.json"):
        data = json.loads((SRC / rel).read_text(encoding="utf-8"))
        assert data["services"]["stream_source"]["name"] and data["services"]["stream_source"]["description"], rel
    assert const.VERSION == "0.7.0" and json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.7.0"
    import sync_integration

    assert sync_integration.differences() == [], "run python scripts/sync_integration.py"
    assert (SRC / "stream_source_service.py").read_bytes() == (MIRROR / "stream_source_service.py").read_bytes()
