"""WISKEY-ADOPT-2272 step 2: the 15 files of the WisKey owner28 Arx contribution, adopted semantically. Synthetic data only: no
manifest of a real installation, no socket, no WhatsApp, no station. The installation EFFECTS stay behind `wiskey.auto_install` (off)."""
from __future__ import annotations

import ast
import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from smplwise.db import get_setting, set_setting
from smplwise.services import wa_template_send as wts
from smplwise.services import wiskey_auto_install as wai
from smplwise.services import wiskey_direct_catalog as wdc

REPO = Path(__file__).resolve().parents[3]
BRIDGE = REPO / "custom_components" / "smplwise_bridge"

SYNTHETIC_ROW = {
    "entry_id": "synthetic-entry", "repository_id": "00000000-0000-4000-8000-000000000028", "query_owner_id": "arx-service:synthetic-entry",
    "grant_ref": {"authority_ref": "installation:synthetic-authority", "authority_revision": 1, "scope_ref": "installation:synthetic-all",
                  "grant_id": "installation:synthetic-grant", "grant_revision": 1, "permission_revision": 1},
    "authority_mode": "permanent_full_installation", "expires_at": None,
    "coverage": "all_current_and_future_supported_capabilities_and_resources", "service_contract": "wiskey-native-service-write.v2",
    "peer_binding_ref": "bridge:synthetic-entry:arx-service:synthetic-entry", "peer_binding_revision": 1,
    "direct_path": "/api/hikvision_intercom/arx_bridge/v1/ws", "pairing_material": "SYNTHETIC_EXAMPLE_NEVER_PRODUCTION",
}


def synthetic_manifest(**over: Any) -> dict[str, Any]:
    doc = {"format": "wiskey-local-installation.v1", "schema_version": 1, "installation_id": "installation:synthetic",
           "repository_id": "00000000-0000-4000-8000-000000000028", "catalog_sha256": "a" * 64,
           "commands": ["direct/capabilities_v2", "events/resume_v1", "users/create", "whatsapp/template_enqueue_v1"],
           "entries": [json.loads(json.dumps(SYNTHETIC_ROW))], "readiness": "ready",
           "template_registry_command": "whatsapp/template_registry_v1", "event_cursor_command": "events/resume_v1",
           "discovery_command": "direct/capabilities_v2"}
    doc.update(over)
    return doc


def write_manifest(root: Path, doc: Any) -> Path:
    p = root / wai.RELATIVE_PATH
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(doc), encoding="utf-8")
    try:
        p.parent.chmod(0o700)
        p.chmod(0o600)
    except OSError:
        pass
    return p


@pytest.fixture()
def ha_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "ha"
    (root / ".storage").mkdir(parents=True)
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(root))
    return root


# ================================================================ wa_template_send: the native account and 128 references

def _ref(i: int, account: str | None = None, **over: Any) -> dict[str, Any]:
    d = {"id": f"t{i}", "name": "notice_tpl", "language": "he", "params": [], "purpose": "notice",
         "template_ref": f"ref-{i}", "template_revision": 1}
    if account is not None:
        d["account"] = account
        d["id"] = f"native_{i}"  # review M3: only a sync-owned row may name an account
    d.update(over)
    return d


def test_registry_keeps_the_native_account_and_allows_128() -> None:
    refs, problems = wts.validate_registry([_ref(i, f"acct-{i}") for i in range(128)])
    assert problems == [] and len(refs) == 128 and refs[5].account == "acct-5"
    assert wts.validate_registry([_ref(i, f"acct-{i}") for i in range(129)])[1][0]["code"] == "too_many"


def test_same_name_and_language_on_two_accounts_are_two_templates() -> None:
    refs, problems = wts.validate_registry([_ref(1, "a"), _ref(2, "b")])
    assert problems == [] and [r.account for r in refs] == ["a", "b"]
    assert wts.validate_registry([_ref(1, "a"), _ref(2, "a")])[1] == [{"path": "templates.1", "code": "duplicate"}]
    assert wts.validate_registry([_ref(1), _ref(2)])[1] == [{"path": "templates.1", "code": "duplicate"}]  # no account: as before


@pytest.mark.parametrize("bad", ["", "with space", 7, "x" * 129])
def test_a_malformed_account_drops_the_reference(bad: Any) -> None:
    assert wts.parse_ref(_ref(1, account=bad)) is None


def test_store_and_load_round_trip_the_account(settings: Any) -> None:
    from smplwise.main import create_app

    app = create_app(settings)
    with app.state.db.write_aside() as conn:
        wts.store_registry(conn, wts.validate_registry([_ref(1, "acct-1"), _ref(2)])[0])
    with app.state.db.connection() as conn:
        raw = json.loads(get_setting(conn, wts.REGISTRY_KEY))
        assert raw[0]["account"] == "acct-1" and "account" not in raw[1]
        assert [r.account for r in wts.load_registry(conn)] == ["acct-1", None]


def test_the_template_v2_route_takes_the_account_of_a_native_reference() -> None:
    src = (REPO / "smplwise_vms/backend/smplwise/routers/access_control_template_v2.py").read_text(encoding="utf-8")
    assert "if tpl is not None and tpl.account is not None:" in src and "account, problem = tpl.account, None" in src


# ================================================================ the catalog: owner28 (approval writes excluded unless the switch is on)

def test_owner28_catalog_adds_the_installation_commands() -> None:
    c = wdc.load()
    for name in ("events/resume_v1", "whatsapp/template_registry_v1", "whatsapp/template_enqueue_v1", "whatsapp/template_job_v1",
                 "whatsapp/template_cancel_v1", "whatsapp/template_send_v3", "direct/capabilities_v2"):
        assert c.get(name) is not None, name
    assert wdc.OWNER_EXCLUDED_WRITES == frozenset({"jobs/approval_decide", "jobs/approval_request"})  # review M2
    assert wdc.envelope_for("events/resume_v1") == wdc.bridge.KIND and wdc.direct_refusal("whatsapp/template_send_v3") is None
    for alias in ("audio/start", "audio/send", "audio/receive", "audio/mute", "audio/diagnostics"):  # HA-only aliases kept
        assert wdc.direct_refusal(alias) == "not_a_direct_command"


# ================================================================ media: the listen adapter's final fence

class _Talk:
    def __init__(self, current: bool, end: str | None = None) -> None:
        self._current, self.publication_end = current, end
        self.pump = SimpleNamespace(end_code=None)
        self.link = SimpleNamespace(closed=False)

    def publication_current(self) -> bool:
        return self._current


def test_listen_adapter_fences_on_the_talk_channels_own_terminal() -> None:
    from smplwise.services.wiskey_listen_adapter import WiskeyDownlinkChannel

    async def run() -> None:
        ch = WiskeyDownlinkChannel()
        ch._talk = _Talk(current=False, end="access_lost")
        assert ch.publication_current() is False and ch._downlink._fenced
        ch2 = WiskeyDownlinkChannel()
        ch2._talk = _Talk(current=True)
        assert ch2.publication_current() is True

    asyncio.run(run())


# ================================================================ wiskey_auto_install: the delivered reader and client

def test_read_installation_accepts_the_synthetic_manifest(ha_root: Path) -> None:
    write_manifest(ha_root, synthetic_manifest())
    doc = wai.read_installation()
    assert doc["entries"][0]["authority_mode"] == "permanent_full_installation" and doc["entries"][0]["expires_at"] is None


@pytest.mark.parametrize("change,code", [
    (lambda d: d.update(readiness="waiting_for_arx_bridge"), "installation_not_ready"),
    (lambda d: d.update(format="other"), "installation_not_ready"),
    (lambda d: d.update(extra=1), "installation_not_ready"),
    (lambda d: d["entries"].append(dict(d["entries"][0])), "installation_not_ready"),
    (lambda d: d["entries"][0].update(expires_at="2099-01-01T00:00:00Z"), "installation_identity_invalid"),
    (lambda d: d["entries"][0].update(authority_mode="manual"), "installation_identity_invalid"),
    (lambda d: d["entries"][0]["grant_ref"].pop("grant_id"), "installation_identity_invalid"),
    (lambda d: d["entries"][0].update(repository_id="other"), "installation_identity_invalid"),
])
def test_read_installation_refuses_anything_else(ha_root: Path, change: Any, code: str) -> None:
    doc = synthetic_manifest()
    change(doc)
    write_manifest(ha_root, doc)
    with pytest.raises(wai.InstallationError) as exc:
        wai.read_installation()
    assert exc.value.code == code


def test_a_missing_manifest_or_config_is_a_closed_code(ha_root: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    with pytest.raises(wai.InstallationError) as exc:
        wai.read_installation()
    assert exc.value.code == "installation_missing"
    monkeypatch.setenv("SW_HA_CONFIG_DIR", str(tmp_path / "nowhere"))
    with pytest.raises(wai.InstallationError) as exc2:
        wai.read_installation()
    assert exc2.value.code == "ha_config_not_mapped"


class FakeLink:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.closed = False

    async def call_command(self, command: str, parameters: dict[str, Any], *, timeout: float) -> dict[str, Any]:
        self.calls.append((command, parameters))
        return {"ok": True}

    async def close(self) -> None:
        self.closed = True


def test_installed_client_rereads_the_manifest_and_refuses_a_changed_entry() -> None:
    state = {"doc": synthetic_manifest()}
    client = wai.InstalledWiskeyClient(None, reader=lambda: json.loads(json.dumps(state["doc"])))
    assert repr(client) == "InstalledWiskeyClient()" and "SYNTHETIC" not in repr(client)
    client.link = FakeLink()
    asyncio.run(client.events(None, 10))
    assert client.link.calls == [("events/resume_v1", {"cursor": None, "limit": 10})]
    asyncio.run(client.service_write("users/update", {"user_id": "u1", "data": {"name": "x"}}, target_ref="u1", target_revision=3,
                                     request_id="r1", operation_id="o1"))
    meta = client.link.calls[-1][1]["service_write"]
    assert meta["contract"] == "wiskey-native-service-write.v2" and meta["actor_id"] == "arx-service:synthetic-entry"
    assert meta["grant_id"] == "installation:synthetic-grant"
    state["doc"]["entries"][0]["grant_ref"]["grant_revision"] = 2
    with pytest.raises(wai.InstallationError) as exc:
        asyncio.run(client.discover())
    assert exc.value.code == "installation_changed_reconnect_required"


# ================================================================ effects stay behind the switch

def test_activation_does_nothing_with_the_switch_off(settings: Any, ha_root: Path) -> None:
    from smplwise.main import create_app

    write_manifest(ha_root, synthetic_manifest())
    app = create_app(settings)
    assert wai.activate_software(app.state.db) is False
    with app.state.db.connection() as conn:
        assert get_setting(conn, "access.station_listen") is None and get_setting(conn, wts.SWITCH_KEY) is None


def test_activation_fills_only_unset_values_and_never_opens_the_send_permit(settings: Any, ha_root: Path) -> None:
    from smplwise.main import create_app
    from smplwise.services import intercom_messaging_adapter

    write_manifest(ha_root, synthetic_manifest())
    app = create_app(settings)
    with app.state.db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
        set_setting(conn, "access.station_listen", "off")  # the owner's own choice
    assert wai.activate_software(app.state.db) is True
    with app.state.db.connection() as conn:
        assert get_setting(conn, "access.station_listen") == "off"
        # review M1: only the provider the installation needs; the template switch stays an owner step
        assert get_setting(conn, "access.station_media_provider") == "auto" and wts.switch_on(conn) is False
    assert intercom_messaging_adapter.TEMPLATE_SEND_SUPPORTED is False and wts.permit() is False


def test_activation_needs_a_ready_manifest(settings: Any, ha_root: Path) -> None:
    from smplwise.main import create_app

    app = create_app(settings)
    with app.state.db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
    assert wai.activate_software(app.state.db) is False


# ================================================================ registry sync and the v3 companion

def _registry(*items: dict[str, Any]) -> dict[str, Any]:
    return {"schema_version": 1, "state": "ready", "templates": list(items)}


def _item(account: str, ref: str, name: str = "access_notice") -> dict[str, Any]:
    return {"account": account, "template_ref": ref, "expected_template_revision": 2, "template_name": name, "language": "he"}


def test_registry_sync_assigns_stable_ids_without_owner_input(settings: Any) -> None:
    from smplwise.main import create_app

    app = create_app(settings)
    assert wai.sync_native_templates(app.state.db, _registry(_item("acct-a", "r1"), _item("acct-b", "r1"))) == 2
    with app.state.db.connection() as conn:
        first = wts.load_registry(conn)
    wai.sync_native_templates(app.state.db, _registry(_item("acct-a", "r1"), _item("acct-b", "r1")))
    with app.state.db.connection() as conn:
        assert [r.id for r in wts.load_registry(conn)] == [r.id for r in first]
    assert {r.account for r in first} == {"acct-a", "acct-b"} and all(r.wiskey_revision == 2 for r in first)


@pytest.mark.parametrize("reply", [
    {"schema_version": 1, "state": "blocked", "templates": []},
    {"schema_version": 1, "state": "ready", "templates": [{"account": "a"}]},
    {"schema_version": 2, "state": "ready", "templates": []},
    _registry(_item("a", "r1"), _item("a", "r1")),
])
def test_a_malformed_registry_refuses_whole(settings: Any, reply: Any) -> None:
    from smplwise.main import create_app

    app = create_app(settings)
    with pytest.raises(wai.InstallationError):
        wai.sync_native_templates(app.state.db, reply)


def _v2(state: str, code: str, accepted: Any) -> dict[str, Any]:
    return {"schema_version": 2, "state": state, "code": code, "provider_accepted": accepted, "delivery": "unknown", "retry_permitted": False}


def _pacing(**over: Any) -> dict[str, Any]:
    d = {"schema_version": 1, "state": "not_sent", "code": "rate_limited", "retry_after_s": 20, "retry_after_source": "original_local_ledger",
         "observed_at": "2026-10-28T10:00:00+00:00", "prior_unknown_retry": False}
    d.update(over)
    return d


def _v3(result: Any, pacing: Any) -> dict[str, Any]:
    return {"contract": "wiskey-template-outcome.v3", "schema_version": 3, "template_result": result, "pacing_outcome": pacing,
            "replay_available": False}


def test_v3_reader_keeps_v2_closed_and_never_retries() -> None:
    out = wai.read_template_outcome_v3(_v3(_v2("accepted", "provider_accepted", True), None))
    assert out["result"].state == "accepted" and out["automatic_retry"] is False
    paced = wai.read_template_outcome_v3(_v3(_v2("not_sent", "source_or_admission_refused", False), _pacing()))
    assert paced["result"].state == "not_sent" and paced["pacing_outcome"]["retry_after_s"] == 20


@pytest.mark.parametrize("reply", [
    _v3(_v2("unknown", "provider_outcome_unknown", None), _pacing()),  # UNKNOWN never becomes not_sent
    _v3(_v2("not_sent", "source_or_admission_refused", False), _pacing(observed_at="2026-10-28T10:00:00")),
    _v3(_v2("not_sent", "source_or_admission_refused", False), _pacing(retry_after_s=-1)),
    _v3(_v2("not_sent", "source_or_admission_refused", False), _pacing(prior_unknown_retry=True)),
    {**_v3(_v2("accepted", "provider_accepted", True), None), "replay_available": True},
    {**_v3(_v2("accepted", "provider_accepted", True), None), "contract": "wiskey-template-outcome.v2"},
])
def test_v3_reader_refuses_everything_else(reply: Any) -> None:
    with pytest.raises(wai.InstallationError):
        wai.read_template_outcome_v3(reply)


# ================================================================ the bridge component (syntax-level; it cannot import without HA)

def test_bridge_sets_up_the_staged_native_component_without_failing_itself() -> None:
    tree = ast.parse((BRIDGE / "__init__.py").read_text(encoding="utf-8"))
    fn = next(n for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef) and n.name == "_async_setup_native")
    src = ast.unparse(fn)
    assert "async_setup_component(hass, NATIVE_DOMAIN, {})" in src and not any(isinstance(n, ast.Raise) for n in ast.walk(fn))
    setup = next(n for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef) and n.name == "async_setup_entry")
    # review H4: gated on the automatic-install entry flag and started as a task, never awaited by the entry setup
    assert "if native_setup_wanted(hass, entry):" in ast.unparse(setup)
    assert "hass.async_create_task(_async_setup_native(hass))" in ast.unparse(setup) and "await _async_setup_native" not in ast.unparse(setup)


def test_config_flow_auto_install_pairs_without_the_confirmation_form() -> None:
    src = (BRIDGE / "config_flow.py").read_text(encoding="utf-8")
    assert 'auto = cfg.get("wiskey_auto_install") is True' in src and "        if auto:\n" in src
    block = src.split("        if auto:\n", 1)[1].split("return await self.async_step_hassio_confirm()", 1)[0]
    assert "_try_pair(url, code)" in block and "async_create_entry" in block and "async_abort(reason=err)" in block
    for name in ("strings.json", "translations/en.json", "translations/he.json"):
        abort = json.loads((BRIDGE / name).read_text(encoding="utf-8"))["config"]["abort"]
        assert {"cannot_connect", "invalid_auth", "unknown"} <= set(abort), name


def test_frontend_harness_is_outside_the_build_and_the_main_suite() -> None:
    fe = REPO / "frontend"
    assert (fe / "tests/owner28/owner28-harness.html").is_file() and (fe / "tests/owner28/owner28-playback.owner28.ts").is_file()
    assert "owner28" not in (fe / "vite.config.ts").read_text(encoding="utf-8")
    cfg = (fe / "playwright.owner28.config.ts").read_text(encoding="utf-8")
    assert "testMatch: '*.owner28.ts'" in cfg and "--mute-audio" in cfg
