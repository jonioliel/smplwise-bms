"""WisKey M12 policy B, slice S4 (pilot/WISKEY-S4-OBSERVER, bridge 0.10.2): the bootstrap Core runtime observer in Arx's own bridge
(`custom_components/smplwise_bridge/core_runtime_observation.py`, WisKey contribution M12-POLICY-B.20261102.01, adopted byte-identical with its
MIT notice) and Arx's reader of it (`wiskey_core_runtime_gate`, slice S2).

1. Identity: the observer and its licence are the contribution's exact bytes, in both copies (source + add-on mirror).
2. No grant: the module imports nothing of the bridge (no key set, signature, service or lease), opens files read-only and writes nothing;
   the bridge registers it first in `async_setup_entry`, and a registration failure never stops the bridge.
3. Shape: loaded code (hash of the loaded function objects), metadata (versions), disk (file hash, name only) and the mapped native image
   (always `unavailable`) are four separate things; editing the disk file never changes the loaded-code hash and vice versa.
4. Challenge / authorization: the WS command answers an ACTIVE HA ADMINISTRATOR only, echoes the challenge, re-checks the user after the
   executor (revocation during I/O refuses); registered once per Home Assistant instance, under exactly the name the gate reads first.
5. The reader: the observer's real output passes the gate's closed shape and is bound to the challenge, but it is NEVER `supported` -
   `unverified` (no image verifier) or `unavailable` (no process birth). End to end through `read_core`, the owner's ON with a managed pin
   is still `blocked` and the native writer is never called: the owner's ON never replaces provenance.

Fake Home Assistant WebSocket harness (no Home Assistant, psutil, aiohttp or orjson on the workstation); fake modules stand in for the Core
process's. No HA, no device, no install, no restart."""
from __future__ import annotations

import ast
import asyncio
import hashlib
import json
import marshal
import sys
import types
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from bridge_loader import MIRROR, SRC, load
from test_wiskey_m12_policy_b_native_gate import calls, database, managed, owned_older_tree, set_switch, settings_rows  # noqa: F401
from test_wiskey_rc7_adopt_2331 import refusals, tree_digest

from smplwise.services import ha_client
from smplwise.services import wiskey_auto_install as install
from smplwise.services import wiskey_core_runtime_gate as gate

obs = load("core_runtime_observation")

# WisKey `51a058e7`, docs/owner-development-2026-11-02/mac-policy-policy-b-completion/M12-01/Arx-source-patch/BEFORE_AFTER.json (after)
OBSERVER_SHA256 = "f2000c74b5c5e2c542e37b8ad0effeb91c5812114db3eca2af5822a20c630972"
LICENCE_SHA256 = "84dd9f1b887230cec87efb15b654a01aff6ef959445b2cb94db71a68c0593336"
COMMAND = "smplwise_bridge/core_runtime_v1"
MODULES = ("orjson", "orjson.orjson", "aiohttp", "aiohttp.web_ws")


# ---------------------------------------------------------------- fakes


class FakeHass:
    """Weak-referenceable stand-in: the executor and the registered WS handlers."""

    def __init__(self) -> None:
        self.handlers: dict[str, Any] = {}

    async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
        return await asyncio.get_running_loop().run_in_executor(None, func, *args)


class Connection:
    def __init__(self, user: Any) -> None:
        self.user = user
        self.frames: list[dict[str, Any]] = []

    def send_result(self, mid: int, result: Any) -> None:
        self.frames.append(json.loads(json.dumps({"id": mid, "type": "result", "success": True, "result": result})))

    def send_error(self, mid: int, code: str, message: str) -> None:
        self.frames.append({"id": mid, "type": "result", "success": False, "error": {"code": code, "message": message}})


def user(*, admin: bool = True, active: bool = True) -> Any:
    return SimpleNamespace(is_admin=admin, is_active=active)


@pytest.fixture
def fake_ha(monkeypatch: pytest.MonkeyPatch) -> types.ModuleType:
    """Minimal `voluptuous` + `homeassistant.components.websocket_api` with HA's decorator contract."""
    vol = types.ModuleType("voluptuous")
    vol.Required = lambda key: key  # type: ignore[attr-defined]
    vol.All = lambda *rules: ("all", rules)  # type: ignore[attr-defined]
    vol.Length = lambda min=None, max=None: ("length", min, max)  # type: ignore[attr-defined]  # noqa: A002
    ws = types.ModuleType("homeassistant.components.websocket_api")

    def websocket_command(schema: dict[str, Any]) -> Any:
        def mark(func: Any) -> Any:
            func._ws_schema = schema
            func._ws_command = schema["type"]
            return func
        return mark

    def async_response(func: Any) -> Any:
        return func

    def async_register_command(hass: FakeHass, handler: Any) -> None:
        assert handler._ws_command not in hass.handlers, "registered twice"
        hass.handlers[handler._ws_command] = handler

    ws.websocket_command, ws.async_response, ws.async_register_command = websocket_command, async_response, async_register_command  # type: ignore[attr-defined]
    ha = types.ModuleType("homeassistant")
    components = types.ModuleType("homeassistant.components")
    components.websocket_api = ws  # type: ignore[attr-defined]
    ha.components = components  # type: ignore[attr-defined]
    for name, module in (("voluptuous", vol), ("homeassistant", ha), ("homeassistant.components", components),
                         ("homeassistant.components.websocket_api", ws)):
        monkeypatch.setitem(sys.modules, name, module)
    return ws


def valid(handler: Any, message: dict[str, Any]) -> bool:
    """HA validates the schema before the handler runs; the fake applies the declared rules."""
    rules = handler._ws_schema
    if set(message) - {"id"} != set(rules) or message["type"] != rules["type"]:
        return False
    kind, (typ, (_, lo, hi)) = rules["challenge"]
    return kind == "all" and type(message["challenge"]) is typ and lo <= len(message["challenge"]) <= hi


async def ws_call(hass: FakeHass, conn: Connection, mid: int, command: str, **payload: Any) -> dict[str, Any]:
    handler = hass.handlers.get(command)
    message = {"id": mid, "type": command, **payload}
    if handler is None:
        return {"id": mid, "type": "result", "success": False, "error": {"code": "unknown_command", "message": "Unknown command."}}
    if not valid(handler, message):
        return {"id": mid, "type": "result", "success": False, "error": {"code": "invalid_format", "message": "invalid"}}
    await handler(hass, conn, message)
    (frame,) = [f for f in conn.frames if f["id"] == mid]
    return frame


@pytest.fixture
def process_birth(monkeypatch: pytest.MonkeyPatch) -> None:
    """A psutil like the Core image's: the process's real start time is readable."""
    psutil = types.ModuleType("psutil")

    class Error(Exception):
        pass

    class Process:
        def __init__(self, pid: int) -> None:
            self.pid = pid

        def create_time(self) -> float:
            return 1_700_000_000.25

    psutil.Error, psutil.Process = Error, Process  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "psutil", psutil)


@pytest.fixture
def no_process_birth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(sys.modules, "psutil", None)  # `import psutil` raises ImportError


@pytest.fixture
def core_modules(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """Fake loaded Core modules with files on disk: pure Python `aiohttp.web_ws` and a native `orjson.orjson`."""
    files = {}
    for name, body in (("web_ws.py", b"# synthetic aiohttp web_ws source\n"), ("__init__.py", b"# synthetic aiohttp\n"),
                       ("orjson.cpython-313-x86_64-linux-gnu.so", b"\x7fELF synthetic native image\n")):
        p = tmp_path / "site" / name
        p.parent.mkdir(exist_ok=True)
        p.write_bytes(body)
        files[name] = p

    class WebSocketResponse:
        def _on_data_received(self) -> int:
            return 1

        def _reset_heartbeat(self) -> int:
            return 2

        def _send_heartbeat(self) -> int:
            return 3

    web_ws = types.ModuleType("aiohttp.web_ws")
    web_ws.__file__ = str(files["web_ws.py"])
    web_ws.WebSocketResponse = WebSocketResponse  # type: ignore[attr-defined]
    aiohttp = types.ModuleType("aiohttp")
    aiohttp.__file__ = str(files["__init__.py"])
    aiohttp.__version__ = "3.99.0-synthetic"  # type: ignore[attr-defined]
    native = types.ModuleType("orjson.orjson")
    native.__file__ = str(files["orjson.cpython-313-x86_64-linux-gnu.so"])
    native.__version__ = "3.99.1-synthetic"  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "aiohttp", aiohttp)
    monkeypatch.setitem(sys.modules, "aiohttp.web_ws", web_ws)
    monkeypatch.setitem(sys.modules, "orjson.orjson", native)
    monkeypatch.delitem(sys.modules, "orjson", raising=False)
    return {"files": files, "WebSocketResponse": WebSocketResponse, "root": tmp_path}


CHALLENGE = "c" * 48


# ---------------------------------------------------------------- 1. identity + licence


def test_the_observer_and_its_licence_are_the_contributions_exact_bytes_in_both_copies():
    for root in (SRC, MIRROR):
        assert hashlib.sha256((root / "core_runtime_observation.py").read_bytes()).hexdigest() == OBSERVER_SHA256, root
        licence = (root / "LICENSE-WISKEY-core-runtime-observation.txt").read_bytes()
        assert hashlib.sha256(licence).hexdigest() == LICENCE_SHA256, root
        assert licence.startswith(b"MIT License\n\nCopyright (c) 2026 Hikvision Intercom Manager contributors\n")
    notices = (SRC.parents[1] / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
    assert "LICENSE-WISKEY-core-runtime-observation.txt" in notices and "M12-POLICY-B.20261102.01" in notices


def test_bridge_version_is_0102_everywhere_and_both_copies_are_identical():
    const = (SRC / "const.py").read_text(encoding="utf-8")
    assert json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.10.7" and 'VERSION = "0.10.7"' in const
    assert "const VERSION = '0.10.7';" in (SRC / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    assert "Needs one Home Assistant restart (by the owner)" in const.split('VERSION = "0.10.7"', 1)[1].split("# 0.10.1", 1)[0]
    names = sorted(p.relative_to(SRC).as_posix() for p in SRC.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    assert {"core_runtime_observation.py", "LICENSE-WISKEY-core-runtime-observation.txt"} <= set(names)
    assert names == sorted(p.relative_to(MIRROR).as_posix() for p in MIRROR.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
    for name in names:
        assert (SRC / name).read_bytes() == (MIRROR / name).read_bytes(), name


# ---------------------------------------------------------------- 2. no grant, no writer


def test_the_observer_has_no_grant_no_bridge_import_and_opens_files_read_only():
    tree = ast.parse((SRC / "core_runtime_observation.py").read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            assert node.level == 0, "no import of the bridge package (key set, signature, services, leases)"
            imported.add(node.module or "")
        elif isinstance(node, ast.Import):
            imported.update(a.name for a in node.names)
    assert imported <= {"hashlib", "importlib.metadata", "marshal", "os", "platform", "stat", "sys", "sysconfig", "time", "uuid",
                        "weakref", "pathlib", "psutil", "voluptuous", "homeassistant.components"}, imported
    bare = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
    attrs = {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
    assert "open" not in bare, "no builtin open(): only the read-only os.open below"
    for forbidden in ("grant", "keyset", "KeySet", "verify", "sign", "subprocess", "shutil", "write", "write_text", "write_bytes",
                      "unlink", "remove", "rename", "replace", "mkdir", "rmdir", "services", "async_call", "Store", "system", "popen"):
        assert forbidden not in bare | attrs, forbidden
    os_calls = {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name) and n.value.id == "os"}
    assert os_calls <= {"open", "O_RDONLY", "fstat", "fdopen", "dup", "close", "getpid"}, os_calls
    (os_open,) = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "open"]
    flags = ast.unparse(os_open.args[1])
    assert "O_RDONLY" in flags and "O_NOFOLLOW" in flags and "O_WRONLY" not in flags and "O_RDWR" not in flags and "O_CREAT" not in flags
    (fdopen,) = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "fdopen"]
    assert ast.literal_eval(fdopen.args[1]) == "rb"


def test_the_bridge_registers_the_observer_first_and_a_failure_never_stops_the_bridge():
    for root in (SRC, MIRROR):
        tree = ast.parse((root / "__init__.py").read_text(encoding="utf-8"))
        (setup,) = [n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == "async_setup_entry"]
        first = setup.body[0]
        assert isinstance(first, ast.Try), "the observer is registered before anything else of the entry"
        (handler,) = first.handlers
        assert isinstance(handler.type, ast.Name) and handler.type.id == "Exception" and not any(isinstance(n, ast.Raise) for n in ast.walk(handler))
        (call,) = [n for n in ast.walk(first) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "register_core_observation"]
        assert [(k.arg, ast.unparse(k.value)) for k in call.keywords] == [("namespace", "DOMAIN")]
        (imp,) = [n for n in ast.walk(first) if isinstance(n, ast.ImportFrom)]
        assert imp.level == 1 and imp.module == "core_runtime_observation"
        # registered nowhere else; the observer is not a service
        assert ast.unparse(tree).count("register_core_observation(") == 1


def test_a_registration_failure_leaves_the_gate_on_the_safe_side():
    # no observer registered (old bridge, or the registration failed): unknown_command on both names -> bootstrap unavailable, refused
    replies = iter([{"success": False, "error": {"code": "unknown_command"}}] * 2)
    assert gate.observe(lambda command, payload: next(replies)) == {"state": "unavailable", "code": "core_runtime_bootstrap_unavailable"}


# ---------------------------------------------------------------- 3. shape: loaded code / metadata / disk / mapped image


def test_inspect_keeps_loaded_code_metadata_disk_and_the_mapped_image_apart(core_modules, process_birth):
    out = obs.inspect(CHALLENGE)
    assert out["contract"] == "wiskey-core-runtime-observation.v1" and out["schema_version"] == 1 and out["challenge"] == CHALLENGE
    assert out["image_identity"] is None and out["image_provenance"] == "unavailable"
    assert out["scope"] == "loaded process observation; disk hashes are not native image attestation"
    assert set(out["modules"]) == set(MODULES)
    for name, row in out["modules"].items():
        assert row["native_image_attestation"] == "unavailable", name  # never attested, whatever the disk says

    ws_row = out["modules"]["aiohttp.web_ws"]
    resp = core_modules["WebSocketResponse"]
    expected = hashlib.sha256(b"".join(marshal.dumps(getattr(resp, k).__code__)
                                       for k in ("_on_data_received", "_reset_heartbeat", "_send_heartbeat"))).hexdigest()
    assert ws_row["loaded"] is True and ws_row["loaded_code_sha256"] == expected  # loaded code: the function objects
    disk_file = core_modules["files"]["web_ws.py"]
    assert ws_row["disk"] == {"name": "web_ws.py", "sha256": hashlib.sha256(disk_file.read_bytes()).hexdigest(), "bytes": disk_file.stat().st_size}

    native = out["modules"]["orjson.orjson"]  # native extension: metadata + disk evidence, no loaded-code hash, image unattested
    assert native["version"] == "3.99.1-synthetic" and native["disk"]["name"].endswith(".so") and native["loaded_code_sha256"] is None
    assert out["modules"]["aiohttp"]["version"] == "3.99.0-synthetic" and out["modules"]["aiohttp"]["loaded_code_sha256"] is None
    assert out["modules"]["orjson"] == {"loaded": False, "version": None, "disk": None, "loaded_code_sha256": None,
                                        "native_image_attestation": "unavailable"}
    assert str(core_modules["root"]) not in json.dumps(out) and "site" not in json.dumps(out["modules"]), "file names only, never paths"
    assert out["boot_scope"] == "core_process_birth" and out["process_started_at"] == 1_700_000_000.25 and len(out["boot_id"]) == 64


def test_editing_the_disk_never_changes_the_loaded_code_hash_and_vice_versa(core_modules, process_birth):
    first = obs.inspect(CHALLENGE)["modules"]["aiohttp.web_ws"]
    core_modules["files"]["web_ws.py"].write_bytes(b"# the file on disk was replaced after the process loaded it\n")
    second = obs.inspect(CHALLENGE)["modules"]["aiohttp.web_ws"]
    assert second["loaded_code_sha256"] == first["loaded_code_sha256"] and second["disk"]["sha256"] != first["disk"]["sha256"]

    def patched(self: Any) -> int:
        return 99

    core_modules["WebSocketResponse"]._send_heartbeat = patched  # the loaded code changed, the disk did not
    third = obs.inspect(CHALLENGE)["modules"]["aiohttp.web_ws"]
    assert third["disk"] == second["disk"] and third["loaded_code_sha256"] != second["loaded_code_sha256"]


def test_a_class_without_the_three_functions_has_no_loaded_code_hash(core_modules, process_birth):
    del core_modules["WebSocketResponse"]._reset_heartbeat
    assert obs.inspect(CHALLENGE)["modules"]["aiohttp.web_ws"]["loaded_code_sha256"] is None


def test_disk_evidence_is_dropped_for_a_missing_file_a_directory_or_an_oversize_file(tmp_path):
    assert obs._disk(None) is None
    big = tmp_path / "big.so"
    with big.open("wb") as f:
        f.truncate(32 * 1024 * 1024 + 1)
    assert obs._disk(big) is None
    small = tmp_path / "small.so"
    small.write_bytes(b"x")
    assert obs._disk(small) == {"name": "small.so", "sha256": hashlib.sha256(b"x").hexdigest(), "bytes": 1}
    with pytest.raises(OSError):
        obs._disk(tmp_path / "missing.so")  # the caller (inspect) turns this into disk: null
    try:
        assert obs._disk(tmp_path) is None  # POSIX: not a regular file
    except OSError:
        pass  # Windows: a directory cannot be opened; inspect records disk: null as well


def test_inspect_turns_an_unreadable_file_into_no_disk_evidence(core_modules, process_birth, tmp_path):
    sys.modules["aiohttp.web_ws"].__file__ = str(tmp_path / "gone.py")
    sys.modules["orjson.orjson"].__file__ = str(tmp_path)
    out = obs.inspect(CHALLENGE)
    assert out["modules"]["aiohttp.web_ws"]["disk"] is None and out["modules"]["orjson.orjson"]["disk"] is None
    assert out["modules"]["aiohttp.web_ws"]["loaded_code_sha256"] is not None


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX symlink; runner")
def test_a_symlinked_module_file_is_never_followed(tmp_path):
    target = tmp_path / "real.so"
    target.write_bytes(b"real")
    link = tmp_path / "link.so"
    link.symlink_to(target)
    with pytest.raises(OSError):
        obs._disk(link)  # O_NOFOLLOW


# ---------------------------------------------------------------- 4. challenge + authorization (WS command)


def test_registered_once_per_instance_under_the_name_the_gate_reads_first(fake_ha):
    hass = FakeHass()
    obs.register(hass, namespace="smplwise_bridge")
    obs.register(hass, namespace="smplwise_bridge")  # an entry reload: no second registration
    assert list(hass.handlers) == [COMMAND] == [gate.COMMANDS[0]]
    other = FakeHass()
    obs.register(other, namespace="smplwise_bridge")
    assert list(other.handlers) == [COMMAND]


@pytest.mark.parametrize("challenge", ["", "x" * 15, "x" * 129, 12345678901234567, None])
def test_a_challenge_outside_the_schema_never_reaches_the_observer(fake_ha, monkeypatch, challenge):
    hass = FakeHass()
    obs.register(hass, namespace="smplwise_bridge")
    monkeypatch.setattr(obs, "inspect", lambda c: pytest.fail("inspect ran"))
    frame = asyncio.run(ws_call(hass, Connection(user()), 1, COMMAND, challenge=challenge))
    assert frame["success"] is False and frame["error"]["code"] == "invalid_format"


def test_an_active_administrator_gets_the_observation_bound_to_the_challenge(fake_ha, core_modules, process_birth):
    hass = FakeHass()
    obs.register(hass, namespace="smplwise_bridge")
    frame = asyncio.run(ws_call(hass, Connection(user()), 7, COMMAND, challenge=CHALLENGE))
    assert frame["success"] is True and frame["result"]["challenge"] == CHALLENGE
    assert gate.evaluate(frame["result"], CHALLENGE) == {"state": "unverified", "code": "core_runtime_provenance_unavailable"}
    assert gate.evaluate(frame["result"], "d" * 48)["code"] == "core_runtime_observation_invalid"  # a replayed answer


@pytest.mark.parametrize("who", ["none", "non_admin", "inactive_admin"])
def test_anyone_but_an_active_administrator_is_refused_before_any_observation(fake_ha, monkeypatch, who):
    hass = FakeHass()
    obs.register(hass, namespace="smplwise_bridge")
    monkeypatch.setattr(obs, "inspect", lambda c: pytest.fail("inspect ran"))
    person = {"none": None, "non_admin": user(admin=False), "inactive_admin": user(active=False)}[who]
    frame = asyncio.run(ws_call(hass, Connection(person), 3, COMMAND, challenge=CHALLENGE))
    assert frame["success"] is False and frame["error"]["code"] == "unauthorized" and "result" not in frame


@pytest.mark.parametrize("change", ["demoted", "deactivated", "user_replaced"])
def test_a_revocation_during_the_executor_read_refuses_the_answer(fake_ha, monkeypatch, change):
    hass = FakeHass()
    obs.register(hass, namespace="smplwise_bridge")
    person = user()
    conn = Connection(person)
    real = obs.inspect

    def during(challenge: str) -> Any:
        if change == "demoted":
            person.is_admin = False
        elif change == "deactivated":
            person.is_active = False
        else:
            conn.user = user()
        return real(challenge)

    monkeypatch.setattr(obs, "inspect", during)
    frame = asyncio.run(ws_call(hass, conn, 4, COMMAND, challenge=CHALLENGE))
    assert frame["success"] is False and frame["error"]["code"] == "unauthorized" and "result" not in frame


# ---------------------------------------------------------------- 5. the reader: never supported, the owner's ON never replaces provenance


def test_the_real_observation_passes_the_closed_shape_and_is_never_supported(core_modules, process_birth):
    out = json.loads(json.dumps(obs.inspect(CHALLENGE)))  # as it crosses the wire
    assert gate._shape(out) is True
    assert gate.evaluate(out, CHALLENGE) == {"state": "unverified", "code": "core_runtime_provenance_unavailable"}
    # nothing in the observation can upgrade it: claimed attestation / provenance / identity or any extra key is refused
    for name in MODULES:
        forged = json.loads(json.dumps(out))
        forged["modules"][name]["native_image_attestation"] = "attested"
        assert gate.evaluate(forged, CHALLENGE)["code"] == "core_runtime_observation_invalid", name
    for key, value in (("image_provenance", "verified"), ("image_identity", "sha256:" + "a" * 64), ("supported", True)):
        assert gate.evaluate({**out, key: value}, CHALLENGE)["code"] == "core_runtime_observation_invalid", key
    # only the ORIGINAL trusted verifier could decide; Arx passes none
    assert gate.evaluate(out, CHALLENGE, image_verifier=lambda _: None)["state"] == "unverified"
    assert gate.evaluate(out, CHALLENGE, image_verifier=lambda _: False)["state"] == "unsupported"


def test_without_the_core_process_birth_the_observation_is_unavailable(core_modules, no_process_birth):
    out = obs.inspect(CHALLENGE)
    assert out["boot_scope"] == "unavailable" and out["boot_id"] is None and out["process_started_at"] is None
    assert gate._shape(out) is True
    assert gate.evaluate(out, CHALLENGE) == {"state": "unavailable", "code": "core_runtime_process_unavailable"}


def _route_ws_to(monkeypatch: pytest.MonkeyPatch, hass: FakeHass, person: Any) -> list[str]:
    """`ha_client.ws_session` replaced by the fake HA: `read_core` runs unchanged against the registered handlers."""
    seen: list[str] = []

    async def ws_session(settings: Any, on_ready: Any, on_event: Any, stop: asyncio.Event, **_: Any) -> None:
        conn = Connection(person)
        counter = {"id": 0}

        async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
            counter["id"] += 1
            seen.append(msg_type)
            return await ws_call(hass, conn, counter["id"], msg_type, **kw)

        await on_ready(call)

    monkeypatch.setattr(ha_client, "ws_session", ws_session)
    return seen


def test_read_core_through_the_registered_observer_is_unverified(fake_ha, core_modules, process_birth, monkeypatch):
    hass = FakeHass()
    obs.register(hass, namespace="smplwise_bridge")
    seen = _route_ws_to(monkeypatch, hass, user())
    assert gate.read_core(SimpleNamespace(), timeout_s=5.0) == {"state": "unverified", "code": "core_runtime_provenance_unavailable"}
    assert seen == [COMMAND], "the bootstrap bridge name answers first; the native name is never needed"


def test_read_core_without_the_observer_loaded_is_bootstrap_unavailable(fake_ha, monkeypatch):
    seen = _route_ws_to(monkeypatch, FakeHass(), user())  # bridge 0.10.1 still loaded (no HA restart yet)
    assert gate.read_core(SimpleNamespace(), timeout_s=5.0) == {"state": "unavailable", "code": "core_runtime_bootstrap_unavailable"}
    assert seen == list(gate.COMMANDS)


def test_read_core_as_a_non_administrator_is_unavailable(fake_ha, monkeypatch):
    hass = FakeHass()
    obs.register(hass, namespace="smplwise_bridge")
    _route_ws_to(monkeypatch, hass, user(admin=False))
    assert gate.read_core(SimpleNamespace(), timeout_s=5.0) == {"state": "unavailable", "code": "core_runtime_unavailable"}


def test_the_owners_on_with_a_managed_pin_stays_blocked_with_the_real_observer(tmp_path, managed, database, calls, fake_ha, core_modules,
                                                                               process_birth, monkeypatch):
    hass = FakeHass()
    obs.register(hass, namespace="smplwise_bridge")
    seen = _route_ws_to(monkeypatch, hass, user())
    cfg = tmp_path / "ha"
    cfg.mkdir()
    target = owned_older_tree(tmp_path, cfg, database)
    set_switch(database, "on")  # the owner's ON (stored directly: D1=b refuses ON on the route in this build)
    before, rows_before = tree_digest(cfg / "custom_components"), settings_rows(database)

    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)

    assert answer == {"state": "blocked", "code": "core_runtime_provenance_unavailable", "version": None, "restart": None}, answer
    assert seen == [COMMAND] and calls == [], "one Core read through the bridge observer, zero native writer calls"
    assert tree_digest(cfg / "custom_components") == before and target.is_dir() and settings_rows(database) == rows_before
    (row,) = refusals(database)
    assert row["reason"] == "core_runtime_provenance_unavailable" and json.loads(row["details_json"])["component_written"] is False


def test_with_the_switch_off_the_observer_is_never_read(tmp_path, managed, database, calls, fake_ha, monkeypatch):
    hass = FakeHass()
    obs.register(hass, namespace="smplwise_bridge")
    seen = _route_ws_to(monkeypatch, hass, user())
    cfg = tmp_path / "ha"
    cfg.mkdir()
    answer = install.installer_step(database, SimpleNamespace(), cfg, None, restart=True)
    assert answer["state"] == "off" and seen == [] and calls == []
