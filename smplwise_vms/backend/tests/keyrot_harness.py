"""KEYROT-HARNESS-295: an in-process lab for the bridge key rotation - the Arx engine (services/bridge_rotation.py, bridge_keys.py,
bridge_rotation_peer.HaServicePeer, ha_client.call_service) against the REAL bridge integration (custom_components/smplwise_bridge:
`async_setup_entry`, the `rotate` service handler, `keyset.KeySet` and `keyset.Persister`), loaded unmodified from the repository.

Nothing here contacts a network, Home Assistant, a bridge, a door or a lab host:
- Home Assistant is replaced by the smallest stub the bridge's import and setup need (`homeassistant.*` modules, a functional mini
  `voluptuous` so ROTATE_SCHEMA is really applied, a fake `hass` with a service registry, config entries and a `.storage` dict that
  survives restarts). The stub modules are removed from `sys.modules` again right after the bridge is imported, so no other test sees them.
- The HA REST API is an `httpx.MockTransport` installed for `ha_client.call_service` (the production transport of HaServicePeer):
  `POST /api/services/smplwise_bridge/rotate?return_response` runs the bridge's real handler and answers HA's envelope
  `{"changed_states": [], "service_response": ...}`. Faults are injected HERE, on the wire or in the bridge's storage - never inside
  the code under test.
- The bridge's directory push (`aiohttp` session) is routed to the Arx TestClient, so the announcement and the overlap traffic are
  verified by the real `/ha/bridge/directory` route.
- One clock drives both sides: `time.time` is the real clock plus an offset the test advances (wall clock), the bridge's monotonic
  clock follows it (and can be "rebooted").

Keys and pairing codes are generated at test time (synthetic). The wire log keeps op names and ok / code only."""
from __future__ import annotations

import asyncio
import copy
import dataclasses
import importlib.abc
import importlib.machinery
import importlib.util
import json
import secrets
import socket
import sys
import time
import types
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable

import httpx

ROOT = Path(__file__).resolve().parents[3]
BRIDGE_DIR = ROOT / "custom_components" / "smplwise_bridge"
PKG = "_keyrot_real_bridge"
FAKE_HA_URL = "http://fake-ha.invalid"   # never resolved: ha_client's httpx client gets a MockTransport
ADDON_URL = "http://arx-addon.invalid:8099"
HA_TOKEN = "synthetic-harness-token"     # a placeholder, not a credential

_REAL_TIME = time.time
_REAL_MONO = time.monotonic


# ====================================================================== the clock

class Clock:
    """Wall clock = real time + offset (so every deadline in the code under test still moves); `mono()` is the bridge's monotonic clock."""

    def __init__(self) -> None:
        self.offset = 0.0
        self._mono_shift = 0.0

    def __call__(self) -> float:
        return _REAL_TIME() + self.offset

    def mono(self) -> float:
        return _REAL_MONO() + self.offset + self._mono_shift

    def advance(self, s: float) -> None:
        self.offset += s

    def reboot_host(self) -> None:
        """The Home Assistant host rebooted: its monotonic clock starts again near zero."""
        self._mono_shift -= self.mono() - 1.0


# ====================================================================== the Home Assistant stub (import time only)

class HomeAssistantError(Exception):
    pass


class ServiceValidationError(HomeAssistantError):
    pass


class Unauthorized(HomeAssistantError):
    pass


class _Anything:
    """A sink for Home Assistant names that the rotation paths never really use (registries, components)."""

    def __init__(self, name: str) -> None:
        self._name = name

    def __getattr__(self, item: str) -> "_Anything":
        if item.startswith("__"):
            raise AttributeError(item)
        return _Anything(f"{self._name}.{item}")

    def __call__(self, *a: Any, **k: Any) -> "_Anything":
        return _Anything(f"{self._name}()")


class _StubModule(types.ModuleType):
    def __getattr__(self, item: str) -> Any:
        if item.startswith("__"):
            raise AttributeError(item)
        value = _Anything(f"{self.__name__}.{item}")
        setattr(self, item, value)
        return value


def _vol_module() -> types.ModuleType:
    """A functional mini-voluptuous: Schema / Required / Optional / All / Any / Coerce / Length, enough to APPLY the bridge's schemas."""
    vol = _StubModule("voluptuous")
    PREVENT, ALLOW, REMOVE = 0, 1, 2
    UNDEFINED = object()

    class Invalid(Exception):
        pass

    class Marker:
        def __init__(self, schema: Any, msg: Any = None, default: Any = UNDEFINED, description: Any = None) -> None:
            self.schema, self.default = schema, default

        def __hash__(self) -> int:
            return hash(self.schema)

        def __eq__(self, other: Any) -> bool:
            return self.schema == (other.schema if isinstance(other, Marker) else other)

    class Required(Marker):
        pass

    class Optional(Marker):
        pass

    def validate(validator: Any, value: Any) -> Any:
        if validator is None:
            if value is None:
                return None
            raise Invalid("not None")
        if isinstance(validator, Schema):
            return validator(value)
        if isinstance(validator, dict):
            return Schema(validator)(value)
        if isinstance(validator, type):
            if isinstance(value, validator):
                return value
            raise Invalid(f"expected {validator.__name__}")
        if callable(validator):
            try:
                return validator(value)
            except Invalid:
                raise
            except (TypeError, ValueError) as exc:
                raise Invalid(type(exc).__name__) from None
        if validator == value:
            return value
        raise Invalid("not equal")

    class Schema:
        def __init__(self, schema: Any, required: bool = False, extra: int = PREVENT) -> None:
            self.schema, self.extra = schema, extra

        def __call__(self, data: Any) -> Any:
            if not isinstance(self.schema, dict):
                return validate(self.schema, data)
            if not isinstance(data, dict):
                raise Invalid("expected a dictionary")
            out: dict[str, Any] = {}
            known = set()
            for marker, validator in self.schema.items():
                key = marker.schema if isinstance(marker, Marker) else marker
                known.add(key)
                if key in data:
                    out[key] = validate(validator, data[key])
                elif isinstance(marker, Required):
                    raise Invalid(f"required key not provided @ data['{key}']")
                elif isinstance(marker, Optional) and marker.default is not UNDEFINED:
                    out[key] = marker.default() if callable(marker.default) else marker.default
            for key, value in data.items():
                if key not in known:
                    if self.extra == ALLOW:
                        out[key] = value
                    elif self.extra == PREVENT:
                        raise Invalid(f"extra keys not allowed @ data['{key}']")
            return out

    def Coerce(t: Any) -> Callable[[Any], Any]:
        def f(v: Any) -> Any:
            try:
                return t(v)
            except (TypeError, ValueError):
                raise Invalid("coerce") from None
        return f

    def All(*vs: Any) -> Callable[[Any], Any]:
        def f(v: Any) -> Any:
            for x in vs:
                v = validate(x, v)
            return v
        return f

    def Any_(*vs: Any) -> Callable[[Any], Any]:
        def f(v: Any) -> Any:
            for x in vs:
                try:
                    return validate(x, v)
                except Invalid:
                    continue
            raise Invalid("no alternative matched")
        return f

    def Length(min: int | None = None, max: int | None = None) -> Callable[[Any], Any]:  # noqa: A002 - voluptuous' own names
        def f(v: Any) -> Any:
            n = len(v)
            if (min is not None and n < min) or (max is not None and n > max):
                raise Invalid("length")
            return v
        return f

    def In(container: Any) -> Callable[[Any], Any]:
        def f(v: Any) -> Any:
            if v not in container:
                raise Invalid("not in")
            return v
        return f

    for name, value in {"PREVENT_EXTRA": PREVENT, "ALLOW_EXTRA": ALLOW, "REMOVE_EXTRA": REMOVE, "Invalid": Invalid, "MultipleInvalid": Invalid,
                        "Marker": Marker, "Required": Required, "Optional": Optional, "Schema": Schema, "Coerce": Coerce, "All": All,
                        "Any": Any_, "Length": Length, "In": In}.items():
        setattr(vol, name, value)
    return vol


def _ha_modules() -> dict[str, types.ModuleType]:
    mods: dict[str, types.ModuleType] = {}

    def mod(name: str, **attrs: Any) -> types.ModuleType:
        m = _StubModule(name)
        m.__path__ = []  # type: ignore[attr-defined]  # a package: submodules may be imported from it
        for k, v in attrs.items():
            setattr(m, k, v)
        mods[name] = m
        return m

    class SupportsResponse:
        NONE, OPTIONAL, ONLY = "none", "optional", "only"

    class Context:
        def __init__(self, user_id: str | None = None, parent_id: str | None = None, id: str | None = None) -> None:  # noqa: A002
            self.user_id, self.parent_id, self.id = user_id, parent_id, id or secrets.token_hex(13)

    def cv_string(value: Any) -> str:
        if value is None or isinstance(value, (list, dict)):
            raise ValueError("string value is None or a container")
        return str(value)

    mod("homeassistant")
    mod("homeassistant.core", Context=Context, HomeAssistant=object, ServiceCall=SimpleNamespace, ServiceResponse=dict,
        SupportsResponse=SupportsResponse, callback=lambda f: f)
    mod("homeassistant.exceptions", HomeAssistantError=HomeAssistantError, ServiceValidationError=ServiceValidationError, Unauthorized=Unauthorized)
    mod("homeassistant.config_entries", ConfigEntry=object)
    mod("homeassistant.helpers")
    mod("homeassistant.helpers.config_validation", string=cv_string)
    mod("homeassistant.helpers.storage", Store=FakeStore)
    mod("homeassistant.helpers.event", async_track_time_interval=_track_time_interval)
    mod("homeassistant.helpers.aiohttp_client", async_get_clientsession=lambda hass: hass.session)
    for name, m in mods.items():  # `from homeassistant.helpers import config_validation` reads the parent's attribute first
        if "." in name:
            parent, _, child = name.rpartition(".")
            setattr(mods[parent], child, m)
    return mods


class _StubFinder(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def __init__(self, mods: dict[str, types.ModuleType]) -> None:
        self.mods = mods

    def find_spec(self, name: str, path: Any, target: Any = None) -> Any:
        if name in self.mods or name == "homeassistant" or name.startswith("homeassistant."):
            return importlib.machinery.ModuleSpec(name, self, is_package=True)
        return None

    def create_module(self, spec: Any) -> types.ModuleType:
        if spec.name not in self.mods:
            m = _StubModule(spec.name)
            m.__path__ = []  # type: ignore[attr-defined]
            self.mods[spec.name] = m
        return self.mods[spec.name]

    def exec_module(self, module: types.ModuleType) -> None:
        return None


def load_bridge() -> types.ModuleType:
    """The real `smplwise_bridge` package, imported from the repository under a private name, with the stubs present only while it imports."""
    if PKG in sys.modules:
        return sys.modules[PKG]
    mods = _ha_modules()
    try:
        import voluptuous  # noqa: F401  # a real voluptuous wins if it is installed
    except ImportError:
        mods["voluptuous"] = _vol_module()
    finder = _StubFinder(mods)
    before = set(sys.modules)
    sys.meta_path.insert(0, finder)
    try:
        for name, m in mods.items():
            sys.modules.setdefault(name, m)
        spec = importlib.util.spec_from_file_location(PKG, BRIDGE_DIR / "__init__.py", submodule_search_locations=[str(BRIDGE_DIR)])
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        sys.modules[PKG] = module
        try:
            spec.loader.exec_module(module)
            importlib.import_module(f"{PKG}.signing")  # what the config flow signs the pairing ping with
        except BaseException:
            sys.modules.pop(PKG, None)
            raise
    finally:
        sys.meta_path.remove(finder)
        for name in set(sys.modules) - before:
            if name == "voluptuous" or name == "homeassistant" or name.startswith("homeassistant."):
                sys.modules.pop(name, None)
    return module


def bridge_submodule(name: str) -> types.ModuleType:
    load_bridge()
    return sys.modules[f"{PKG}.{name}"]


# ====================================================================== the fake Home Assistant runtime

class FakeStore:
    """homeassistant.helpers.storage.Store over the harness' `.storage` dict (JSON text, like the real files). Survives restarts."""

    def __init__(self, hass: "FakeHass", version: int, key: str, **_: Any) -> None:
        self.hass, self.key = hass, key

    async def async_load(self) -> Any:
        raw = self.hass.disk.get(self.key)
        return None if raw is None else json.loads(raw)

    async def async_save(self, data: Any) -> None:
        if self.hass.side.save_failures > 0:
            self.hass.side.save_failures -= 1
            raise OSError("synthetic: disk full")
        self.hass.disk[self.key] = json.dumps(data)

    async def async_remove(self) -> None:
        self.hass.disk.pop(self.key, None)


def _track_time_interval(hass: "FakeHass", action: Any, interval: Any) -> Callable[[], None]:
    hass.intervals.append((action, interval))
    return lambda: None


class FakeEntry:
    def __init__(self, entry_id: str, data: dict[str, Any], options: dict[str, Any] | None = None) -> None:
        self.entry_id, self.data, self.options = entry_id, dict(data), dict(options or {})
        self.unloads: list[Callable[[], Any]] = []
        self.listeners: list[Any] = []

    def async_on_unload(self, f: Callable[[], Any]) -> None:
        self.unloads.append(f)

    def add_update_listener(self, listener: Any) -> Callable[[], None]:
        self.listeners.append(listener)
        return lambda: None


class FakeServices:
    def __init__(self, hass: "FakeHass") -> None:
        self.hass = hass
        self.registry: dict[tuple[str, str], tuple[Any, Any]] = {}

    def async_register(self, domain: str, service: str, handler: Any, schema: Any = None, supports_response: Any = None) -> None:
        self.registry[(domain, service)] = (handler, schema)

    def async_remove(self, domain: str, service: str) -> None:
        self.registry.pop((domain, service), None)

    def has(self, domain: str, service: str) -> bool:
        return (domain, service) in self.registry


class FakeConfigEntries:
    def __init__(self, hass: "FakeHass") -> None:
        self.hass = hass

    def async_update_entry(self, entry: FakeEntry, data: dict[str, Any] | None = None, options: dict[str, Any] | None = None) -> bool:
        if data is not None:
            entry.data = dict(data)
        if options is not None:
            entry.options = dict(options)
        for listener in entry.listeners:
            self.hass.async_create_task(listener(self.hass, entry))
        return True


class _Resp:
    def __init__(self, status: int, body: Any) -> None:
        self.status, self._body = status, body

    async def json(self, content_type: Any = None) -> Any:
        return self._body

    async def __aenter__(self) -> "_Resp":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        return None


class FakeSession:
    """The bridge's aiohttp session: its POSTs to the add-on go to the Arx TestClient."""

    def __init__(self, side: "BridgeSide") -> None:
        self.side = side

    def post(self, url: str, json: Any = None, timeout: Any = None) -> _Resp:  # noqa: A002
        assert url.startswith(ADDON_URL), "the bridge only talks to the add-on"
        r = self.side.arx_client().post(url[len(ADDON_URL):], json=json)
        try:
            body = r.json()
        except ValueError:
            body = None
        self.side.pushes.append({"path": url[len(ADDON_URL):], "status": r.status_code, "kid": (json or {}).get("kid")})
        return _Resp(r.status_code, body)


class FakeAuth:
    async def async_get_users(self) -> list[Any]:
        return []

    async def async_get_user(self, user_id: str) -> Any:
        return None


class FakeHass:
    def __init__(self, side: "BridgeSide") -> None:
        self.side = side
        self.disk = side.disk
        self.data: dict[str, Any] = {}
        self.services = FakeServices(self)
        self.config_entries = FakeConfigEntries(self)
        self.auth = FakeAuth()
        self.http = SimpleNamespace(async_register_static_paths=self._static, register_static_path=lambda *a, **k: None)
        self.session = FakeSession(side)
        self.intervals: list[tuple[Any, Any]] = []
        self.tasks: list[Any] = []
        self.loop = asyncio.new_event_loop()

    async def _static(self, configs: Any) -> None:
        return None

    def async_create_task(self, coro: Any) -> Any:
        self.tasks.append(coro)
        return coro

    def run(self, coro: Any) -> Any:
        return self.loop.run_until_complete(coro)

    def drain(self) -> None:
        while self.tasks:
            self.run(self.tasks.pop(0))

    def close(self) -> None:
        for coro in self.tasks:
            coro.close()
        self.tasks.clear()
        self.loop.close()


class BridgeSide:
    """Home Assistant with the real bridge integration set up for one config entry; `.storage` and the entry survive `restart()`."""

    def __init__(self, arx_client: Callable[[], Any], pairing_code: str, clock: Clock, entry_id: str = "01KEYROTHARNESSENTRY0000A1") -> None:
        self.mod = load_bridge()
        self.keyset_mod = bridge_submodule("keyset")
        self.signing = bridge_submodule("signing")
        self.arx_client = arx_client
        self.clock = clock
        self.disk: dict[str, str] = {}
        self.entry = FakeEntry(entry_id, {self.mod.CONF_ADDON_URL: ADDON_URL, self.mod.CONF_PAIRING_CODE: pairing_code})
        self.keysets: list[Any] = []
        self.pushes: list[dict[str, Any]] = []
        self.save_failures = 0
        self.hass: FakeHass | None = None
        self.start()

    # ------------------------------------------------------------ lifecycle
    def _keyset_factory(self, legacy: Any, state: Any = None) -> Any:
        ks = self.keyset_mod.KeySet(legacy, state, now=self.clock, mono=self.clock.mono)
        self.keysets.append(ks)
        return ks

    def start(self) -> None:
        # the only seam: the bridge builds `KeySet(code, stored)` with the default clocks; the harness hands it the shared clock
        self.mod.KeySet = self._keyset_factory
        self.hass = FakeHass(self)
        assert self.hass.run(self.mod.async_setup_entry(self.hass, self.entry)) is True
        self.hass.drain()

    def stop(self) -> None:
        if self.hass is None:
            return
        self.hass.run(self.mod.async_unload_entry(self.hass, self.entry))
        for f in self.entry.unloads:
            f()
        self.entry.unloads.clear()
        self.entry.listeners.clear()
        self.hass.close()
        self.hass = None

    def restart(self) -> None:
        """Home Assistant restarts (or the config entry reloads): the key set comes back from `.storage` only."""
        self.stop()
        self.start()

    def replace_entry(self, entry_id: str, pairing_code: str) -> None:
        """The integration is deleted and added again (config flow `user` step): a NEW entry id, so a fresh key store. Home Assistant
        unloads the deleted entry, then calls the integration's `async_remove_entry` (K-06)."""
        self.stop()
        remove = getattr(self.mod, "async_remove_entry", None)
        if remove is not None:
            hass = FakeHass(self)
            try:
                hass.run(remove(hass, self.entry))
            finally:
                hass.close()
        self.entry = FakeEntry(entry_id, {self.mod.CONF_ADDON_URL: ADDON_URL, self.mod.CONF_PAIRING_CODE: pairing_code})
        self.start()

    def restore_storage(self, snapshot: dict[str, str]) -> None:
        """Home Assistant restored from a backup taken at `snapshot` (or the key save was lost), then restarted."""
        self.stop()
        self.disk.clear()
        self.disk.update(snapshot)
        self.start()

    def discovery_update(self, pairing_code: str) -> None:
        """What config_flow.async_step_hassio does for an ALREADY configured entry: the code is written into the same entry, which reloads."""
        self.entry.data = {**self.entry.data, self.mod.CONF_PAIRING_CODE: pairing_code}
        self.restart()

    # ------------------------------------------------------------ views
    @property
    def ks(self) -> Any:
        return self.keysets[-1]

    @property
    def entry_code(self) -> str:
        return self.entry.data.get(self.mod.CONF_PAIRING_CODE) or ""

    def stored_state(self) -> dict[str, Any] | None:
        raw = self.disk.get(f"smplwise_bridge_keys_{self.entry.entry_id}")
        return None if raw is None else json.loads(raw)

    # ------------------------------------------------------------ calls
    def call_service(self, domain: str, service: str, data: dict[str, Any]) -> Any:
        """Home Assistant's service call: schema first (vol.Invalid -> ServiceValidationError), then the handler."""
        assert self.hass is not None, "Home Assistant is down"
        entry = self.hass.services.registry.get((domain, service))
        if entry is None:
            raise LookupError("service not found")
        handler, schema = entry
        if schema is not None:
            try:
                data = schema(dict(data))
            except Exception as exc:  # noqa: BLE001 - the stub's (or the real) vol.Invalid
                raise ServiceValidationError(type(exc).__name__) from None
        return self.hass.run(handler(SimpleNamespace(data=data)))

    def sync(self) -> int:
        """The add-on's 'sync users' button: the bridge pushes its signed directory now (with the rotation announcement)."""
        return self.call_service(self.mod.DOMAIN, self.mod.SERVICE_SYNC, {})["users"]

    def housekeeping(self) -> None:
        """The bridge's 30 s housekeeping (cap + save), as Home Assistant's timer would run it."""
        assert self.hass is not None
        for action, interval in list(self.hass.intervals):
            if getattr(action, "__name__", "") == "housekeeping":
                self.hass.run(action())

    def settle(self) -> None:
        if self.hass is not None:
            self.hass.drain()

    def ping_message(self, code: str) -> dict[str, Any]:
        """config_flow._try_pair: the pairing ping, signed kid-less with the typed code."""
        return self.signing.sign(code, {"version": self.mod.VERSION})


# ====================================================================== the HA REST API (ha_client.call_service's transport)

class HaRest:
    """POST /api/services/<domain>/<service>?return_response on a fake Home Assistant Core. `faults[op]` is a list consumed per call:
    `unreachable` (connection error, nothing reaches the bridge), `lost_after` (the bridge applied and saved it, the answer is lost),
    `save_fails` (the bridge's Store write fails: the handler reverts and raises -> HTTP 500), `tamper` (one signed field of the answer
    is changed in transit), or a callable(op, data) run before delivery (a clock jump, a bridge restart ...)."""

    def __init__(self) -> None:
        self.side: BridgeSide | None = None
        self.faults: dict[str, list[Any]] = {}
        self.wire: list[dict[str, Any]] = []      # op, ok, code, http - never a key, salt, proof, nonce or signature
        self.raw: list[dict[str, Any]] = []       # full request / answer bodies, ONLY for the secret scan's list of forms
        self.before: list[Callable[[str, dict[str, Any]], None]] = []

    def fault(self, op: str, *kinds: Any) -> None:
        self.faults.setdefault(op, []).extend(kinds)

    def handler(self, request: httpx.Request) -> httpx.Response:
        assert request.url.host == "fake-ha.invalid", "only the fake Home Assistant is reachable"
        parts = request.url.path.split("/")
        if len(parts) != 5 or parts[1:3] != ["api", "services"]:
            return httpx.Response(404, json={"message": "not found"})
        domain, service = parts[3], parts[4]
        data = json.loads(request.content or b"{}")
        op = data.get("op") if isinstance(data, dict) else None
        for hook in list(self.before):
            hook(op, data)
        queue = self.faults.get(op or "", [])
        kind = queue.pop(0) if queue else None  # None in the queue = this call goes through untouched
        if callable(kind):
            kind = kind(op, data)  # a hook may return a fault kind for this same call
        rec: dict[str, Any] = {"service": service, "op": op, "fault": kind}
        self.wire.append(rec)
        if kind == "unreachable":
            rec["http"] = None
            raise httpx.ConnectError("synthetic: Home Assistant unreachable", request=request)
        assert self.side is not None
        if kind == "save_fails":
            self.side.save_failures += 1
        try:
            answer = self.side.call_service(domain, service, data)
        except (ServiceValidationError, LookupError):
            rec["http"] = 400
            return httpx.Response(400, json={"message": "invalid"})
        except Exception:  # noqa: BLE001 - HA answers 500 for a handler that raised
            rec["http"] = 500
            return httpx.Response(500, json={"message": "error"})
        finally:
            self.side.save_failures = 0
        self.raw.append({"request": copy.deepcopy(data), "answer": copy.deepcopy(answer)})
        rec.update(http=200, ok=answer.get("ok") if isinstance(answer, dict) else None, code=answer.get("code") if isinstance(answer, dict) else None,
                   signed=isinstance(answer, dict) and "sig" in answer)
        if kind == "lost_after":
            rec["http"] = None
            raise httpx.ReadTimeout("synthetic: the answer was lost", request=request)
        if kind == "tamper" and isinstance(answer, dict):
            answer = {**answer, "tampered": True}  # one extra field changes the signed body: the MAC no longer matches
        return httpx.Response(200, json={"changed_states": [], "service_response": answer})

    def ops(self) -> list[str]:
        return [r["op"] for r in self.wire if r["service"] == "rotate"]


def install_rest(monkeypatch: Any, rest: HaRest) -> None:
    """ha_client.call_service builds `httpx.Client(timeout=...)`; every client built during the test gets the MockTransport."""
    real = httpx.Client

    def client(*a: Any, **k: Any) -> httpx.Client:
        k["transport"] = httpx.MockTransport(rest.handler)
        return real(*a, **k)

    monkeypatch.setattr(httpx, "Client", client)


def ha_settings(settings: Any) -> Any:
    return dataclasses.replace(settings, ha_url=FAKE_HA_URL, ha_token=HA_TOKEN)


# ====================================================================== no network

def install_no_network(monkeypatch: Any) -> list[Any]:
    """Any socket connect to a non-loopback address, and any name lookup other than localhost, raises (and is recorded)."""
    attempts: list[Any] = []
    real_connect, real_connect_ex, real_gai = socket.socket.connect, socket.socket.connect_ex, socket.getaddrinfo

    def local(address: Any) -> bool:
        if not isinstance(address, tuple):
            return True  # AF_UNIX
        return str(address[0]) in ("127.0.0.1", "::1", "localhost")

    def connect(self: socket.socket, address: Any) -> Any:
        if not local(address):
            attempts.append(address)
            raise OSError("keyrot harness: network access refused")
        return real_connect(self, address)

    def connect_ex(self: socket.socket, address: Any) -> Any:
        if not local(address):
            attempts.append(address)
            raise OSError("keyrot harness: network access refused")
        return real_connect_ex(self, address)

    def gai(host: Any, *a: Any, **k: Any) -> Any:
        if host not in (None, "localhost", "127.0.0.1", "::1"):
            attempts.append(host)
            raise OSError("keyrot harness: name lookup refused")
        return real_gai(host, *a, **k)

    monkeypatch.setattr(socket.socket, "connect", connect)
    monkeypatch.setattr(socket.socket, "connect_ex", connect_ex)
    monkeypatch.setattr(socket, "getaddrinfo", gai)
    return attempts


def clocked_engine(br: Any, clock: Clock) -> type:
    """bridge_rotation.Engine with the harness clock as its default `now` (the routes and the worker build their own engines)."""

    class ClockedEngine(br.Engine):  # type: ignore[misc, valid-type]
        def __init__(self, db: Any, data_dir: Any, peer: Any = None, now: Any = None, settings: Any = None) -> None:
            super().__init__(db, data_dir, peer, now=now or clock, settings=settings)

    return ClockedEngine
