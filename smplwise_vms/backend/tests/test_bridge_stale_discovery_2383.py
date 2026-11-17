"""BRIDGE-STALE-DISCOVERY-2383: a Supervisor discovery message the add-on posted once stays in the Supervisor and Home Assistant replays it at
every start; an OLD pairing code then came back into the existing bridge entry after a re-pair (bridge K-02 threw the working key set away,
every signed push got 401 and WisKey refused Arx).

Both sides are exercised with fakes only (no Supervisor, Home Assistant, WisKey or device is contacted):
- the bridge's REAL config flow (custom_components/smplwise_bridge/config_flow.py) under the smallest Home Assistant stub a config flow needs,
  its signed ping answered either by Arx's own verifier or by the real Arx app (TestClient);
- a fake Supervisor discovery store with the real rules (supervisor/discovery: one message per add-on + service, a re-post updates it in place
  and keeps the uuid, an identical re-post pushes nothing; DELETE only for the add-on's own message, 404 for an unknown uuid; Home Assistant
  replays every message at start);
- Arx's bridge_discovery / bridge_install / pairing routes against that store. Synthetic codes only."""
from __future__ import annotations

import asyncio
import dataclasses
import importlib
import json
import logging
import secrets
import sys
import types
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from keyrot_harness import _vol_module

from smplwise.db import Database, get_setting, now_iso, set_setting
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import bridge_discovery as bd
from smplwise.services import bridge_install, bridge_keys as bk, bridge_rotation, ha_bridge, ha_client, self_update
from smplwise.services import wiskey_pairing as wp

ROOT = Path(__file__).resolve().parents[3]
BRIDGE_DIR = ROOT / "custom_components" / "smplwise_bridge"
PKG = "_stale2383_bridge"
ARX = "arx_addon"
OTHER = "intercom_addon"


# ====================================================================== the bridge's config flow under a minimal Home Assistant stub

class AbortFlow(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclasses.dataclass
class HassioServiceInfo:
    config: dict[str, Any]
    name: str
    slug: str
    uuid: str


class FakeEntry:
    def __init__(self, data: dict[str, Any], source: str = "hassio") -> None:
        self.data = dict(data)
        self.source = source
        self.entry_id = "entry-" + secrets.token_hex(4)
        self.update_listeners: list[Any] = []  # a LOADED bridge entry has one (BRIDGE-UPDATE-LISTENER-2401); an unloaded one has none


class FakeConfigFlow:
    """What the bridge's flow uses of homeassistant.config_entries.ConfigFlow, with the core's semantics: `async_set_unique_id` answers the
    existing entry of that unique id; `_abort_if_unique_id_configured(updates)` writes changed data into it, runs its update listeners,
    schedules its reload (unless `reload_on_update=False`) and aborts. BRIDGE-UPDATE-LISTENER-2401: a flow reload of an entry that HAS an
    update listener is refused as Home Assistant 2026.12 does (an error; 2026.6 - 2026.11 log the deprecation warning seen in the lab)."""

    def __init_subclass__(cls, domain: str | None = None, **kw: Any) -> None:
        super().__init_subclass__(**kw)
        cls.handler = domain

    def __init__(self) -> None:
        self.context: dict[str, Any] = {}
        self.hass: Any = None
        self.unique_id: str | None = None

    async def async_set_unique_id(self, unique_id: str, *, raise_on_progress: bool = True) -> FakeEntry | None:
        self.unique_id = unique_id
        return self.hass.entries.get(unique_id)

    def _abort_if_unique_id_configured(self, updates: dict[str, Any] | None = None, reload_on_update: bool = True) -> None:
        entry = self.hass.entries.get(self.unique_id)
        if entry is None:
            return
        if updates and any(entry.data.get(k) != v for k, v in updates.items()):
            entry.data = {**entry.data, **updates}
            for listener in list(entry.update_listeners):  # Home Assistant runs each as a task: a coroutine is kept for the test to run
                out = listener(self.hass, entry)
                if out is not None:
                    self.hass.pending.append(out)
            if reload_on_update:
                if entry.update_listeners:
                    raise RuntimeError("has an update listener and should use it for scheduling a reload")
                self.hass.reloads.append(dict(entry.data))
        raise AbortFlow("already_configured")

    def async_abort(self, *, reason: str) -> dict[str, Any]:
        return {"type": "abort", "reason": reason}

    def async_create_entry(self, *, title: str, data: dict[str, Any]) -> dict[str, Any]:
        self.hass.entries[self.unique_id] = FakeEntry(data)
        return {"type": "create_entry", "data": dict(data)}

    def async_show_form(self, **kw: Any) -> dict[str, Any]:
        return {"type": "form", **kw}


def _load(name: str) -> types.ModuleType:
    full = f"{PKG}.{name}"
    if full in sys.modules:
        return sys.modules[full]
    mods: dict[str, types.ModuleType] = {}

    def mod(n: str, **attrs: Any) -> types.ModuleType:
        m = types.ModuleType(n)
        m.__dict__.update(attrs)
        mods[n] = m
        return m

    ha = mod("homeassistant")
    ha.core = mod("homeassistant.core", callback=lambda f: f)
    ha.config_entries = mod("homeassistant.config_entries", ConfigFlow=FakeConfigFlow, OptionsFlow=object, ConfigEntry=FakeEntry, SOURCE_IGNORE="ignore")
    helpers = ha.helpers = mod("homeassistant.helpers")
    helpers.selector = mod("homeassistant.helpers.selector", EntitySelector=lambda c: c, EntitySelectorConfig=lambda **k: k)
    helpers.aiohttp_client = mod("homeassistant.helpers.aiohttp_client", async_get_clientsession=lambda hass: hass.session)
    helpers.service_info = mod("homeassistant.helpers.service_info")
    helpers.service_info.hassio = mod("homeassistant.helpers.service_info.hassio", HassioServiceInfo=HassioServiceInfo)
    mods["voluptuous"] = _vol_module()
    try:
        import aiohttp  # noqa: F401  # a real aiohttp wins if it is installed
    except ImportError:
        mods["aiohttp"] = mod("aiohttp", ClientTimeout=lambda total=None, **kw: types.SimpleNamespace(total=total))  # CR-BRIDGE-GAPS-2436
    if PKG not in sys.modules:
        pkg = types.ModuleType(PKG)
        pkg.__path__ = [str(BRIDGE_DIR)]  # type: ignore[attr-defined]
        sys.modules[PKG] = pkg
    saved = {n: sys.modules.get(n) for n in mods}
    sys.modules.update(mods)
    try:
        return importlib.import_module(full)
    finally:
        for n, m in saved.items():
            if m is None:
                sys.modules.pop(n, None)
            else:
                sys.modules[n] = m


class _Resp:
    def __init__(self, status: int) -> None:
        self.status = status

    async def __aenter__(self) -> "_Resp":
        return self

    async def __aexit__(self, *a: Any) -> None:
        return None


class FakeSession:
    """The bridge's aiohttp session: `post(url, json=...)` answered by `arx(path, body) -> status`, or unreachable."""

    def __init__(self, arx: Any) -> None:
        self.arx = arx
        self.calls: list[str] = []
        self.unreachable = False

    def post(self, url: str, json: Any = None, timeout: Any = None) -> _Resp:  # noqa: A002 - aiohttp's own name
        self.calls.append(url)
        if self.unreachable:
            raise OSError("unreachable")
        return _Resp(self.arx("/" + url.split("://", 1)[1].split("/", 1)[1], json))


class FakeHass:
    def __init__(self, arx: Any) -> None:
        self.entries: dict[str, FakeEntry] = {}
        self.session = FakeSession(arx)
        self.reloads: list[dict[str, Any]] = []
        self.pending: list[Any] = []  # update-listener coroutines (BRIDGE-UPDATE-LISTENER-2401)


def arx_verifier(current: dict[str, str | None]) -> Any:
    """Arx's own verification of the bridge ping (ha_bridge.verify) against the code Arx holds now."""
    def answer(path: str, body: Any) -> int:
        assert path == "/api/v1/ha/bridge/ping"
        try:
            ha_bridge.verify(current["code"], dict(body))
        except ApiError:
            return 401
        return 200
    return answer


async def _flow_run(hass: FakeHass, info: HassioServiceInfo) -> dict[str, Any]:
    flow_mod = _load("config_flow")
    flow = flow_mod.SmplwiseBridgeConfigFlow()
    flow.hass, flow.context, flow.unique_id = hass, {"source": "hassio"}, None  # set by Home Assistant's flow manager, as here
    try:
        return await flow.async_step_hassio(info)
    except AbortFlow as exc:
        return {"type": "abort", "reason": exc.reason}


def discover(hass: FakeHass, config: dict[str, Any], uuid: str | None = None) -> dict[str, Any]:
    info = HassioServiceInfo(config=dict(config), name="SmplWise Arx", slug=ARX, uuid=uuid or secrets.token_hex(16))
    return asyncio.run(_flow_run(hass, info))


URL = bridge_install.addon_url()  # what Arx announces (the container hostname); the fake session ignores the host


def _code() -> str:
    return secrets.token_urlsafe(24)


# ---------------------------------------------------------------- the bridge (0.10.3 behaviour, version 0.10.7 - CR-BRIDGE-RUNTIME-2436)

def test_bridge_version_is_0_10_3_in_both_copies():
    const = _load("const")
    assert const.VERSION == "0.10.7"
    for root in (BRIDGE_DIR, ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"):
        assert json.loads((root / "manifest.json").read_text(encoding="utf-8"))["version"] == "0.10.7"
        assert "const VERSION = '0.10.7';" in (root / "www" / "smplwise-card.js").read_text(encoding="utf-8")
        assert "_discovered_for_existing" in (root / "config_flow.py").read_text(encoding="utf-8")


def test_first_install_is_unchanged():
    arx = {"code": _code()}
    hass = FakeHass(arx_verifier(arx))
    out = discover(hass, {"addon_url": URL, "pairing_code": arx["code"]})
    assert out["type"] == "form" and out["step_id"] == "hassio_confirm" and hass.session.calls == [], "manual confirmation, no ping before it"
    auto = FakeHass(arx_verifier(arx))
    out = discover(auto, {"addon_url": URL, "pairing_code": arx["code"], "wiskey_auto_install": True})
    assert out["type"] == "create_entry" and out["data"]["wiskey_auto_install"] is True and len(auto.session.calls) == 1
    refused = FakeHass(arx_verifier({"code": _code()}))
    out = discover(refused, {"addon_url": URL, "pairing_code": arx["code"], "wiskey_auto_install": True})
    assert out == {"type": "abort", "reason": "invalid_auth"} and not refused.entries
    assert discover(FakeHass(arx_verifier(arx)), {"addon_url": URL}) == {"type": "abort", "reason": "invalid_discovery"}


def test_a_stale_code_is_never_written_into_a_working_entry(caplog):
    old, new = _code(), _code()
    arx = {"code": new}
    hass = FakeHass(arx_verifier(arx))
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": new})
    with caplog.at_level(logging.INFO):
        out = discover(hass, {"addon_url": URL, "pairing_code": old})
    assert out == {"type": "abort", "reason": "already_configured"}
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == new and hass.reloads == [], "no update, no reload"
    assert len(hass.session.calls) == 1, "one signed ping with the discovered code"
    text = caplog.text
    assert "did not accept" in text and old not in text and new not in text, "logged at info level without any code"


def test_the_current_code_is_applied_through_the_k02_path():
    old, new = _code(), _code()
    hass = FakeHass(arx_verifier({"code": new}))
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": old})
    assert discover(hass, {"addon_url": URL, "pairing_code": new}) == {"type": "abort", "reason": "already_configured"}
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == new and hass.reloads == [{"addon_url": URL, "pairing_code": new}]


def test_nothing_to_change_means_no_ping_and_no_reload():
    code = _code()
    hass = FakeHass(arx_verifier({"code": code}))
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": code})
    assert discover(hass, {"addon_url": URL, "pairing_code": code}) == {"type": "abort", "reason": "already_configured"}
    assert hass.session.calls == [] and hass.reloads == []


def test_unreachable_addon_or_ignored_entry_changes_nothing():
    old, new = _code(), _code()
    hass = FakeHass(arx_verifier({"code": old}))
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": new})
    hass.session.unreachable = True
    assert discover(hass, {"addon_url": URL, "pairing_code": old}) == {"type": "abort", "reason": "already_configured"}
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == new and hass.reloads == []
    ignored = FakeHass(arx_verifier({"code": old}))
    ignored.entries["smplwise_bridge"] = FakeEntry({}, source="ignore")
    assert discover(ignored, {"addon_url": URL, "pairing_code": old}) == {"type": "abort", "reason": "already_configured"}
    assert ignored.session.calls == [] and ignored.entries["smplwise_bridge"].data == {}


@pytest.mark.parametrize("order", ["stale_first", "new_first"])
def test_replay_at_ha_start_with_stale_and_new_messages_in_either_order(order):
    old, new = _code(), _code()
    hass = FakeHass(arx_verifier({"code": new}))
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": old})  # a bridge still on the old code
    messages = [{"addon_url": URL, "pairing_code": old}, {"addon_url": URL, "pairing_code": new}]
    for cfg in messages if order == "stale_first" else list(reversed(messages)):
        discover(hass, cfg)
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == new
    # and a second start replays both again: nothing moves
    before = len(hass.reloads)
    for cfg in messages:
        discover(hass, cfg)
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == new and len(hass.reloads) == before


def test_the_k02_mechanism_of_the_lab_failure_and_why_the_fix_holds():
    """The bridge's key set after a completed rotation keeps a one-way tag of the retired code. An entry code that is neither that code nor a
    key is taken as a NEW pairing (K-02) and the working set is discarded - exactly what the stale replay used to cause."""
    keyset = _load("keyset")
    retired, stale = _code(), _code()
    state = {"v": keyset.STATE_VERSION, "signing": "g1-aaaaaaaa", "keys": {"g1-aaaaaaaa": secrets.token_urlsafe(32)}, "old": None, "next": None,
             "legacy_retired": True, "legacy_fp": keyset.legacy_fingerprint(retired), "rotation": None, "hw": {}}
    assert keyset.KeySet(stale, state).repaired is True, "the old behaviour: a stale code in the entry throws the key set away"
    assert keyset.KeySet(retired, state).repaired is False and keyset.KeySet(None, state).repaired is False
    hass = FakeHass(arx_verifier({"code": None}))  # Arx after the rotation: no plain code verifies a kid-less ping
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": ""})  # blanked by the bridge's own rotation (HA-06)
    discover(hass, {"addon_url": URL, "pairing_code": stale})
    assert keyset.KeySet(hass.entries["smplwise_bridge"].data["pairing_code"] or None, state).repaired is False


# ====================================================================== Arx: the fake Supervisor discovery store

class FakeSupervisor:
    """supervisor/discovery semantics: (add-on, service) identifies a message; a changed re-post updates it in place (same uuid) and is pushed
    to Home Assistant, an identical one is a duplicate (same uuid, nothing pushed). `dedupe=False` models a store that keeps every post."""

    def __init__(self, dedupe: bool = True) -> None:
        self.dedupe = dedupe
        self.messages: dict[str, dict[str, Any]] = {}
        self.pushes: list[str] = []
        self.deletes: list[str] = []
        self.fail_delete = False

    def put(self, addon: str, service: str, config: dict[str, Any]) -> str:
        if self.dedupe:
            for u, m in self.messages.items():
                if m["addon"] == addon and m["service"] == service:
                    if m["config"] != config:
                        m["config"] = dict(config)
                        self.pushes.append(u)
                    return u
        u = secrets.token_hex(16)
        self.messages[u] = {"addon": addon, "service": service, "config": dict(config)}
        self.pushes.append(u)
        return u

    def post(self, _settings: Any, service: str, config: dict[str, Any]) -> dict[str, Any]:
        return {"uuid": self.put(ARX, service, config)}

    def delete(self, _settings: Any, uuid: str) -> str:
        self.deletes.append(uuid)
        if self.fail_delete:
            return "failed"
        m = self.messages.get(uuid)
        if m is None:
            return "gone"
        if m["addon"] != ARX:
            return "forbidden"
        del self.messages[uuid]
        return "deleted"

    def bridge_codes(self) -> list[str | None]:
        return [m["config"].get("pairing_code") for m in self.messages.values() if m["service"] == "smplwise_bridge"]

    def ha_start(self, hass: FakeHass) -> list[dict[str, Any]]:
        """Home Assistant's start handler: one flow per stored message, in store order."""
        return [discover(hass, m["config"], u) for u, m in list(self.messages.items()) if m["service"] == "smplwise_bridge"]

    def deliver(self, hass: FakeHass) -> list[dict[str, Any]]:
        """The pushes of a running Home Assistant (a deleted message is no longer readable: HA skips it)."""
        out = [discover(hass, self.messages[u]["config"], u) for u in self.pushes if u in self.messages and self.messages[u]["service"] == "smplwise_bridge"]
        self.pushes.clear()
        return out


@pytest.fixture()
def ha_cfg(tmp_path, monkeypatch):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    (cfg / "configuration.yaml").write_text("", encoding="utf-8")
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(cfg))
    return cfg


@pytest.fixture()
def world(settings, ha_cfg, monkeypatch):
    sup = FakeSupervisor()
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: "supervisor-token")
    monkeypatch.setattr(ha_client, "post_discovery", sup.post)
    monkeypatch.setattr(ha_client, "delete_discovery", sup.delete)
    bk.reset_for_tests()
    bd.reset_for_tests()
    wp.reset_for_tests()
    saved = dict(bridge_install.STATE)
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/me")
    db = Database(settings.db_path)

    def arx_http(path: str, body: Any) -> int:
        return c.post(path, json=body).status_code

    yield {"sup": sup, "app": app, "c": c, "db": db, "settings": settings, "cfg": ha_cfg, "hass": FakeHass(arx_http)}
    bridge_install.STATE.clear()
    bridge_install.STATE.update(saved)
    bd.reset_for_tests()
    wp.reset_for_tests()
    bk.reset_for_tests()


def _manual(w) -> None:
    (w["cfg"] / "hikvision_intercom_manual_upgrade.json").write_text("{}", encoding="utf-8")


def _setting(w, key: str) -> str | None:
    with w["db"].connection(mode="read") as conn:
        return get_setting(conn, key)


def _records(w) -> dict[str, Any]:
    with w["db"].connection(mode="read") as conn:
        return bd.records(conn)


def _arx_code(w) -> str | None:
    with w["db"].connection(mode="read") as conn:
        return bd.current_code(conn)


def _set(w, **values: str) -> None:
    with w["db"].connection() as conn:
        for k, v in values.items():
            set_setting(conn, k.replace("__", "."), v)


# ---------------------------------------------------------------- the single door

def test_delete_is_allow_listed_for_one_well_formed_uuid_only():
    u = "0123456789abcdef" * 2
    assert ("DELETE", "/discovery/{uuid}") in self_update.ALLOWED
    assert self_update.check_allowed("DELETE", "/discovery/{uuid}", uuid=u) == f"/discovery/{u}"
    for bad in (None, "", "../x", u.upper(), u[:-1], u + "0", "01234567-89ab-cdef-0123-456789abcdef", "a/b"):
        with pytest.raises(self_update.ProbeRefused):
            self_update.check_allowed("DELETE", "/discovery/{uuid}", uuid=bad)
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("DELETE", "/discovery/{uuid}", uuid=u, slug="arx")
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("GET", "/discovery/{uuid}", uuid=u)  # an add-on cannot read messages (Home Assistant only)
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("GET", "/addons/self/info", uuid=u)
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("GET", "/discovery")


@pytest.mark.parametrize("reply,expected", [(("ok", 200), "deleted"), (("error", 404), "gone"), (("forbidden", 403), "forbidden"),
                                            (("forbidden", 401), "failed"), (("dropped", 0), "failed"), (("error", 500), "failed")])
def test_delete_discovery_maps_the_supervisor_answer(settings, monkeypatch, reply, expected):
    seen: list[tuple[str, str, str | None]] = []

    def send(method, path, **kw):
        seen.append((method, path, kw.get("uuid")))
        return self_update.Reply(reply[0], reply[1], {})

    monkeypatch.setattr(ha_client, "supervisor_token", lambda: "supervisor-token")
    monkeypatch.setattr(self_update, "send", send)
    assert ha_client.delete_discovery(settings, "ab" * 16) == expected
    assert seen == [("DELETE", "/discovery/{uuid}", "ab" * 16)]
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: None)
    assert ha_client.delete_discovery(settings, "ab" * 16) == "failed"


# ---------------------------------------------------------------- the lifecycle

def test_install_records_the_uuid_and_a_repair_updates_the_same_message(world):
    sup, hass = world["sup"], world["hass"]
    bridge_install.install(world["db"], world["settings"])
    first = _arx_code(world)
    assert sup.bridge_codes() == [first] and list(_records(world)) == list(sup.messages) and _setting(world, bd.K_SWEPT)
    rec = next(iter(_records(world).values()))
    assert rec["fp"] == bd.code_fp(first) and first not in json.dumps(_records(world)), "a one-way tag, never the code"
    assert sup.deliver(hass)[0]["type"] == "form"  # first install: Home Assistant offers the bridge
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": first})
    _set(world, bridge__integration_version="0.10.5")
    r = world["c"].get("/api/v1/ha/bridge/pairing?regenerate=true")
    assert r.status_code == 200 and r.json()["announced"] is True and r.json()["announce_path"] is True
    second = r.json()["pairing_code"]
    assert second != first and sup.bridge_codes() == [second] and len(sup.messages) == 1, "updated in place, no second message"
    assert sup.deletes == [], "the old uuid IS the new one: nothing to delete"
    assert sup.deliver(hass) == [{"type": "abort", "reason": "already_configured"}]
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == second, "the existing entry took the new code (K-02 re-pair path)"
    # Home Assistant restarts: the replay carries the current code only - nothing moves
    sup.ha_start(hass)
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == second


def test_adoption_k01_deletes_the_message_in_the_next_worker_round(world, monkeypatch):
    sup = world["sup"]
    bridge_install.install(world["db"], world["settings"])
    assert len(sup.messages) == 1
    with world["db"].connection() as conn:
        bk.adopt_legacy(conn, world["settings"].data_dir)
    calls: list[bool] = []
    real = bd.retire
    monkeypatch.setattr(bd, "retire", lambda db, settings, conn=None, *, sweep=True: calls.append(sweep) or real(db, settings, conn, sweep=sweep))
    bridge_rotation.worker_pass(world["db"], world["settings"])
    assert calls == [False], "the worker round runs the housekeeping without the one-time sweep"
    assert sup.messages == {} and _records(world) == {}
    # a later start announces nothing and posts nothing (no sweep: the uuid was known)
    pushes = len(sup.pushes)
    bridge_install.install(world["db"], world["settings"])
    assert sup.messages == {} and len(sup.pushes) == pushes


def test_a_message_of_an_older_arx_is_recovered_once_and_deleted(world):
    """The lab: an older Arx posted a code and kept no uuid. The add-on cannot list messages - one harmless post answers the uuid."""
    sup, hass = world["sup"], world["hass"]
    old = _code()
    legacy = sup.put(ARX, "smplwise_bridge", {"addon_url": URL, "pairing_code": old})
    foreign = sup.put(OTHER, "door_station", {"host": "x"})
    sup.pushes.clear()
    with world["db"].connection() as conn:
        set_setting(conn, "bridge.secret", _code())
        bk.adopt_legacy(conn, world["settings"].data_dir)  # nothing current to announce (K-01)
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": "working"})
    bridge_install.run_startup(world["db"], world["settings"])
    assert legacy not in sup.messages and foreign in sup.messages and sup.deletes == [legacy], "only Arx's own message, by its recovered uuid"
    assert _setting(world, bd.K_SWEPT) and _records(world) == {}
    # the harmless post reached a running Home Assistant first: the bridge aborts without touching its entry
    assert sup.deliver(hass) == []  # already deleted: Home Assistant can no longer read it
    assert discover(hass, {"addon_url": URL}) == {"type": "abort", "reason": "invalid_discovery"}
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == "working"
    # the sweep runs once per installation
    sup.put(ARX, "smplwise_bridge", {"addon_url": URL, "pairing_code": old})
    n = len(sup.deletes)
    bridge_install.run_startup(world["db"], world["settings"])
    assert len(sup.deletes) == n


def test_lab_state_on_a_manual_profile_heals_and_stays_healed(world):
    """Manual WisKey owner profile, a known bridge, Arx on code B, the Supervisor still holding the old message with code A, and a Home
    Assistant start in between (the order of events seen in the lab)."""
    _manual(world)
    sup, hass = world["sup"], world["hass"]
    a, b = _code(), _code()
    sup.put(ARX, "smplwise_bridge", {"addon_url": URL, "pairing_code": a})
    sup.pushes.clear()
    _set(world, bridge__secret=b, bridge__integration_version="0.10.2", bridge__paired_at=now_iso())
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": b})
    # Home Assistant starts before Arx is updated: the 0.10.3 bridge refuses the replayed old code
    sup.ha_start(hass)
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == b and hass.reloads == []
    # Arx 2.39.1 starts on the manual profile with the automatic-install switch ON: nothing is copied, the message now carries B, no flag
    _set(world, wiskey__auto_install="on")
    target = world["cfg"] / "custom_components" / "smplwise_bridge"
    bridge_install.run_startup(world["db"], world["settings"])
    assert not target.exists(), "manual profile: Arx installs nothing"
    assert sup.bridge_codes() == [b] and len(sup.messages) == 1
    assert all("wiskey_auto_install" not in m["config"] for m in sup.messages.values())
    assert list(_records(world)) == list(sup.messages)
    sup.deliver(hass)
    sup.ha_start(hass)
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == b and hass.reloads == []
    # the owner re-pairs ("צימוד מחדש" path): the new code reaches the existing entry and its signed pushes verify
    r = world["c"].get("/api/v1/ha/bridge/pairing?regenerate=true")
    assert r.json()["announced"] is True
    c_code = r.json()["pairing_code"]
    sup.deliver(hass)
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == c_code
    sup.ha_start(hass)
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == c_code
    push = ha_bridge.sign(c_code, {"users": [], "version": "0.10.5"})
    assert world["c"].post("/api/v1/ha/bridge/directory", json=push).status_code == 200


def test_manual_profile_without_a_known_bridge_announces_nothing_and_deletes_the_stale_message(world):
    _manual(world)
    sup = world["sup"]
    stale_code = _code()
    _set(world, bridge__secret=stale_code)
    uuid = sup.put(ARX, "smplwise_bridge", {"addon_url": URL, "pairing_code": stale_code})
    with world["db"].connection() as conn:
        bd._store(conn, {uuid: {"fp": bd.code_fp(stale_code), "at": now_iso()}})
        set_setting(conn, bd.K_SWEPT, now_iso())
    with world["db"].connection() as conn:
        bk.adopt_legacy(conn, world["settings"].data_dir)
        bk.set_state(conn, bk.LEGACY_KID, "retired")
        bk.insert(conn, world["settings"].data_dir, kid="g1-bbbbbbbb", generation=1, state="current", material=bk.new_material(), rotation_id=None)
    r = world["c"].post("/api/v1/system/wiskey-pairing/repair", json={"confirm": True})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["announced"] is False and isinstance(out["pairing_code"], str), "the owner types the code"
    assert out["status"]["repair"]["announce"] is False
    assert sup.messages == {} and sup.deletes == [uuid] and _records(world) == {}, "the old message cannot come back at a restart"


def test_repair_on_a_manual_profile_with_a_known_bridge_is_announced(world):
    _manual(world)
    sup, hass = world["sup"], world["hass"]
    with world["db"].connection() as conn:
        set_setting(conn, "bridge.secret", _code())
        set_setting(conn, "bridge.integration_version", "0.10.5")
        bk.adopt_legacy(conn, world["settings"].data_dir)
        bk.set_state(conn, bk.LEGACY_KID, "retired")
        bk.insert(conn, world["settings"].data_dir, kid="g1-cccccccc", generation=1, state="current", material=bk.new_material(), rotation_id=None)
    hass.entries["smplwise_bridge"] = FakeEntry({"addon_url": URL, "pairing_code": ""})
    st = world["c"].get("/api/v1/system/wiskey-pairing").json()
    assert st["repair"]["available"] is True and st["repair"]["announce"] is True
    out = world["c"].post("/api/v1/system/wiskey-pairing/repair", json={"confirm": True}).json()
    assert out["announced"] is True and out["pairing_code"] is None and "בלי אישור" in out["steps"][0]
    sup.deliver(hass)
    assert hass.entries["smplwise_bridge"].data["pairing_code"] == _arx_code(world)


def test_a_failed_delete_is_kept_and_retried(world):
    sup = world["sup"]
    bridge_install.install(world["db"], world["settings"])
    (uuid,) = list(sup.messages)
    with world["db"].connection() as conn:
        bk.adopt_legacy(conn, world["settings"].data_dir)
    sup.fail_delete = True
    bd.retire(world["db"], world["settings"])
    assert list(_records(world)) == [uuid] and uuid in sup.messages
    sup.fail_delete = False
    bd.retire(world["db"], world["settings"])
    assert _records(world) == {} and sup.messages == {}
    # a record whose message is already gone (404) or is not Arx's (403) is dropped, never retried for ever
    gone, foreign = "1" * 32, sup.put(OTHER, "smplwise_bridge", {"addon_url": URL})
    with world["db"].connection() as conn:
        bd._store(conn, {gone: {"fp": None, "at": now_iso()}, foreign: {"fp": None, "at": now_iso()}})
    assert bd.retire(world["db"], world["settings"]) == {gone: "gone", foreign: "forbidden"}
    assert _records(world) == {} and foreign in sup.messages


def test_a_store_that_keeps_every_post_still_ends_with_the_current_message_only(world):
    sup = world["sup"]
    sup.dedupe = False
    bridge_install.install(world["db"], world["settings"])
    _set(world, bridge__integration_version="0.10.5")
    world["c"].get("/api/v1/ha/bridge/pairing?regenerate=true")
    assert sup.bridge_codes() == [_arx_code(world)] and len(sup.deletes) == 1, "post the new one, then delete the old"
    assert list(_records(world)) == list(sup.messages)


def test_no_supervisor_token_means_no_call_at_all(world, monkeypatch):
    monkeypatch.setattr(ha_client, "supervisor_token", lambda: None)
    sup = world["sup"]
    bridge_install.run_startup(world["db"], world["settings"])
    assert bd.retire(world["db"], world["settings"]) == {} and sup.messages == {} and sup.pushes == [] and sup.deletes == []


def test_the_discovery_rows_never_travel_in_a_backup():
    from smplwise.services import backup

    assert {bd.K_MESSAGES, bd.K_SWEPT} <= backup.SETTINGS_KEEP


def test_automatic_install_flag_refused_by_the_door_fails_cleanly(world, monkeypatch):
    """Finding (reported, not changed here): the single door does not admit the automatic-install flag in a discovery body."""
    with pytest.raises(self_update.ProbeRefused):
        self_update.check_allowed("POST", "/discovery", {"service": "smplwise_bridge", "config": {"addon_url": URL, "pairing_code": "c", "wiskey_auto_install": True}})

    def refuse(_s, _service, _config):
        raise self_update.ProbeRefused("POST /discovery: body")

    monkeypatch.setattr(ha_client, "post_discovery", refuse)
    _set(world, wiskey__auto_install="on")
    assert bridge_install.announce_discovery(world["db"], world["settings"]) is False
    assert bridge_install.STATE["last_error"] == "discovery:call_refused"


# ---------------------------------------------------------------- the diagnostics row

def test_refused_directory_pushes_show_up_in_the_pairing_block(world):
    c = world["c"]
    good = _code()
    _set(world, bridge__secret=good, bridge__paired_at="2026-11-03T08:00:00+00:00", bridge__integration_version="0.10.5",
         bridge__directory_at=now_iso())
    stale = ha_bridge.sign(_code(), {"users": [], "version": "0.10.5"})
    assert c.post("/api/v1/ha/bridge/directory", json=stale).status_code == 401
    assert c.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(_code(), {"users": [], "version": "0.10.5"})).status_code == 401
    body = c.get("/api/v1/system/wiskey-pairing").json()
    line = {ln["key"]: ln for ln in body["lines"]}["bridge"]
    assert line["state"] == "blocked" and line["reason"] == "bridge_rejected" and line["facts"]["refused_count"] == 2 and line["fix"]
    assert body["repair"] == {**body["repair"], "available": True, "reason": "bridge_rejected"}
    assert good not in json.dumps(body)
    # an accepted push clears it
    assert c.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(good, {"users": [], "version": "0.10.5"})).status_code == 200
    line = {ln["key"]: ln for ln in c.get("/api/v1/system/wiskey-pairing").json()["lines"]}["bridge"]
    assert line["reason"] == "bridge_ok"
    # after a re-pair the bridge still signs with the old code: the row says the new code did not arrive
    c.get("/api/v1/ha/bridge/pairing?regenerate=true")
    assert c.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(good, {"users": [], "version": "0.10.5"})).status_code == 401
    line = {ln["key"]: ln for ln in c.get("/api/v1/system/wiskey-pairing").json()["lines"]}["bridge"]
    assert line["reason"] == "bridge_rejected_after_repair" and line["state"] == "blocked"
    # a clock / replay refusal is not "another code"
    bd.reset_for_tests()
    bd.note_directory_refused("bridge_stale")
    assert bd.directory_refusals() is None


# ====================================================================== bridge 0.10.3: its own refused pushes are seen

class _Log:
    def __init__(self) -> None:
        self.lines: list[tuple[str, str]] = []

    def _add(self, level: str, msg: str, *args: Any) -> None:
        self.lines.append((level, msg % args if args else msg))

    def warning(self, msg: str, *args: Any) -> None:
        self._add("warning", msg, *args)

    def info(self, msg: str, *args: Any) -> None:
        self._add("info", msg, *args)

    def debug(self, msg: str, *args: Any) -> None:
        self._add("debug", msg, *args)


def test_bridge_push_health_warns_once_with_the_fix_and_reports_recovery():
    ph_mod = _load("push_health")
    clock = {"t": 1_000_000.0}
    log = _Log()
    ph = ph_mod.PushHealth(log, now=lambda: clock["t"])
    assert ph.state()["reason"] == "unknown"
    ph.note(200)
    assert ph.state()["reason"] == "ok" and log.lines == []
    for _ in range(5):
        clock["t"] += 60
        ph.note(401)
    warnings = [m for lvl, m in log.lines if lvl == "warning"]
    assert len(warnings) == 1 and "re-pair" in warnings[0] and "401" in warnings[0], "one warning, with the fix"
    st = ph.state()
    assert st["reason"] == "addon_refused_signature" and st["count"] == 5 and st["status"] == 401 and st["since"]
    clock["t"] += ph_mod.REMIND_S
    ph.note(401)
    assert len([1 for lvl, _ in log.lines if lvl == "warning"]) == 2, "a reminder at most once an hour"
    clock["t"] += 60
    ph.note(200)
    assert log.lines[-1][0] == "info" and "again" in log.lines[-1][1] and ph.state()["reason"] == "ok" and ph.state()["count"] == 0
    ph.note(None, "ClientConnectorError")
    ph.note(500)
    assert ph.state()["reason"] == "addon_error" and [lvl for lvl, _ in log.lines[-2:]] == ["debug", "debug"]


def test_bridge_diagnostics_and_wiring_carry_no_secret():
    diag = _load("diagnostics")
    ph = _load("push_health").PushHealth(_Log())
    ph.note(401)
    code = _code()
    entry = types.SimpleNamespace(entry_id="e1", data={"pairing_code": code, "addon_url": URL})
    hass = types.SimpleNamespace(data={"smplwise_bridge_push_health": {"e1": ph}})
    out = asyncio.run(diag.async_get_config_entry_diagnostics(hass, entry))
    assert out["directory_push"]["reason"] == "addon_refused_signature" and out["pairing_code_in_entry"] is True and out["version"] == "0.10.7"
    assert code not in json.dumps(out) and URL not in json.dumps(out)
    assert asyncio.run(diag.async_get_config_entry_diagnostics(types.SimpleNamespace(data={}), entry))["directory_push"] == {"reason": "not_loaded"}
    src = (BRIDGE_DIR / "__init__.py").read_text(encoding="utf-8")
    push = src.split("async def push_directory", 1)[1].split("async def sync_directory", 1)[0]
    assert "push_health.note(resp.status)" in push and "push_health.note(None, type(exc).__name__)" in push



def test_a_bridge_without_a_signing_key_says_so_instead_of_add_on_unreachable():
    """CR-BRIDGE-GAPS-2436 (review 05 P2-21): `KeySet.sign` with no key raises `NoSigningKey` (still a ValueError); the directory push
    notes it as `no_signing_key` - one warning with the fix, repeated at most once an hour - and a real transport failure stays
    `addon_unreachable`."""
    ph_mod = _load("push_health")
    ks_mod = _load("keyset")
    with pytest.raises(ks_mod.NoSigningKey):
        ks_mod.KeySet("", None).sign({"users": []})
    assert issubclass(ks_mod.NoSigningKey, ValueError)
    clock = {"t": 1_000_000.0}
    log = _Log()
    ph = ph_mod.PushHealth(log, now=lambda: clock["t"])
    for _ in range(3):
        clock["t"] += 60
        ph.note(None, ph_mod.NO_SIGNING_KEY)
    warnings = [m for lvl, m in log.lines if lvl == "warning"]
    assert ph.state()["reason"] == "no_signing_key" and ph.state()["count"] == 3 and len(warnings) == 1 and "Reconfigure" in warnings[0]
    clock["t"] += ph_mod.REMIND_S
    ph.note(None, ph_mod.NO_SIGNING_KEY)
    assert len([1 for lvl, _ in log.lines if lvl == "warning"]) == 2
    ph.note(None, "ClientConnectorError")
    assert ph.state()["reason"] == "addon_unreachable"
    src = (BRIDGE_DIR / "__init__.py").read_text(encoding="utf-8")
    push = src.split("async def push_directory", 1)[1].split("async def sync_directory", 1)[0]
    assert "except NoSigningKey:" in push and "push_health.note(None, NO_SIGNING_KEY)" in push
    assert push.index("except NoSigningKey:") < push.index("session.post(")

# ====================================================================== rotation vs WisKey: the safe default

def test_no_rotation_starts_while_wiskey_is_present(world, monkeypatch):
    from smplwise.services import intercom_sync

    with world["db"].connection() as conn:
        set_setting(conn, "bridge.secret", _code())
        set_setting(conn, "bridge.paired_at", now_iso())
    monkeypatch.setattr(bridge_rotation, "peer_available", lambda peer=None: True)
    assert bridge_rotation.wiskey_present() is False
    with world["db"].connection(mode="read") as conn:
        assert bridge_rotation.view(conn, world["settings"].data_dir)["blocked_by"] is None
    # the component in Home Assistant's config directory
    (world["cfg"] / "custom_components" / "hikvision_intercom").mkdir(parents=True)
    assert bridge_rotation.wiskey_present() is True
    with world["db"].connection(mode="read") as conn:
        v = bridge_rotation.view(conn, world["settings"].data_dir)
        assert v["blocked_by"] == "wiskey_present" and v["can_start"] is False and v["automatic"] == "off"
        assert bridge_rotation.auto_due(conn, None, 10**10) is False  # type: ignore[arg-type]
    with pytest.raises(bridge_rotation.RotationRefused) as exc:
        bridge_rotation.Engine(world["db"], world["settings"].data_dir, settings=world["settings"]).start(None, "routine")
    assert exc.value.code == "wiskey_present"
    with world["db"].connection(mode="read") as conn:
        assert not bk.adopted(conn), "nothing was adopted or rotated"
    r = world["c"].post("/api/v1/system/bridge-key/rotations", json={"mode": "routine", "confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_present" and "WisKey" in r.json()["user_message"]
    line = {ln["key"]: ln for ln in world["c"].get("/api/v1/system/wiskey-pairing").json()["lines"]}["rotation"]
    assert line["reason"] == "rotation_blocked_wiskey" and line["state"] == "ok" and line["facts"]["blocked_by_wiskey"] is True
    # the service feed alone is enough too
    import shutil

    shutil.rmtree(world["cfg"] / "custom_components" / "hikvision_intercom")
    monkeypatch.setattr(intercom_sync.STATE, "wiskey_version", "2.0.1")
    assert bridge_rotation.wiskey_present() is True
