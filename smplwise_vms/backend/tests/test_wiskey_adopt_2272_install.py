"""WISKEY-ADOPT-2272 step 3: WisKey's installation manifest (`wiskey-local-installation.v1`), the template resource exchange
(`wiskey-local-template-resources.v1`), the installed client and `wiskey-native-service-write.v2`. Arx NEVER creates a grant - it only reads
the one WisKey's installer published. Synthetic data only; the writer stays unavailable in production."""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from smplwise.db import set_setting
from smplwise.services import intercom_sync
from smplwise.services import wiskey_auto_install as wai
from smplwise.services import wiskey_service_write as sw
from test_wiskey_adopt_2272_contrib import ha_root, synthetic_manifest, write_manifest  # noqa: F401 - fixture reuse

SYNTH_RESOURCES = {
    "format": "wiskey-local-template-resources.v1",
    "accounts": [{"account": "synthetic-configured-account", "api_version": "v24.0", "business_id": "101", "phone_number_id": "102",
                  "token": "synthetic-installer-token"}],
    "templates": [{"reference": "synthetic-configured-template", "revision": 1, "account": "synthetic-configured-account", "ui_language": "en",
                   "template_id": "103", "name": "synthetic_native_access", "language": "en_US", "body": "Hello {{1}}",
                   "parameter_fields": ["display_name"]}],
}


# ================================================================ the closed manifest

def test_the_synthetic_manifest_passes_the_full_schema() -> None:
    assert wai.check_manifest(synthetic_manifest())["readiness"] == "ready"


def test_waiting_for_the_bridge_is_a_valid_state_without_entries() -> None:
    doc = wai.check_manifest(synthetic_manifest(readiness="waiting_for_arx_bridge", entries=[]))
    assert doc["entries"] == []


def _entry(**over: Any) -> dict[str, Any]:
    e = synthetic_manifest()["entries"][0]
    e.update(over)
    return e


@pytest.mark.parametrize("over,code", [
    ({"readiness": "ready", "entries": []}, "installation_invalid"),
    ({"readiness": "waiting_for_arx_bridge"}, "installation_invalid"),  # waiting with an entry
    ({"schema_version": 2}, "installation_unsupported"),
    ({"schema_version": True}, "installation_unsupported"),
    ({"catalog_sha256": "XYZ"}, "installation_invalid"),
    ({"commands": ["b", "a"]}, "installation_invalid"),
    ({"commands": ["a", "a"]}, "installation_invalid"),
    ({"entries": [_entry(service_contract="wiskey-native-service-write.v1")]}, "installation_identity_invalid"),
    ({"entries": [_entry(coverage="partial")]}, "installation_identity_invalid"),
    ({"entries": [_entry(query_owner_id="arx-service:other")]}, "installation_identity_invalid"),
    ({"entries": [_entry(peer_binding_revision=0)]}, "installation_identity_invalid"),
    ({"entries": [_entry(direct_path="relative/path")]}, "installation_identity_invalid"),
    ({"entries": [_entry(extra=1)]}, "installation_identity_invalid"),
    ({"entries": [_entry(grant_ref={**_entry()["grant_ref"], "grant_revision": 0})]}, "installation_identity_invalid"),
    ({"entries": [_entry(grant_ref={**_entry()["grant_ref"], "grant_id": "bad\nref"})]}, "installation_identity_invalid"),
    ({"entries": [_entry(), _entry(entry_id="second", query_owner_id="arx-service:second")]}, "installation_entries_ambiguous"),
])
def test_the_manifest_schema_is_closed(over: dict[str, Any], code: str) -> None:
    with pytest.raises(wai.InstallationError) as exc:
        wai.check_manifest(synthetic_manifest(**over))
    assert exc.value.code == code


def test_a_manifest_with_nan_or_too_large_is_refused(ha_root: Path) -> None:  # noqa: F811
    p = ha_root / wai.RELATIVE_PATH
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text('{"x": NaN}', encoding="utf-8")
    with pytest.raises(wai.InstallationError) as exc:
        wai.read_checked_installation()
    assert exc.value.code == "installation_invalid"
    p.write_bytes(b" " * (wai.MANIFEST_MAX_BYTES + 1))
    with pytest.raises(wai.InstallationError) as exc2:
        wai.read_checked_installation()
    assert exc2.value.code == "installation_too_large"


@pytest.mark.skipif(sys.platform.startswith("win"), reason="POSIX mode bits")
def test_a_group_readable_manifest_is_refused(ha_root: Path) -> None:  # noqa: F811
    p = write_manifest(ha_root, synthetic_manifest())
    p.chmod(0o640)
    with pytest.raises(wai.InstallationError) as exc:
        wai.read_checked_installation()
    assert exc.value.code == "private_installation_required"


@pytest.mark.skipif(not hasattr(os, "symlink") or sys.platform.startswith("win"), reason="symlinks")
def test_a_symlinked_manifest_is_refused(ha_root: Path, tmp_path: Path) -> None:  # noqa: F811
    real = tmp_path / "elsewhere.json"
    real.write_text(json.dumps(synthetic_manifest()), encoding="utf-8")
    real.chmod(0o600)
    link = ha_root / wai.RELATIVE_PATH
    link.parent.mkdir(parents=True, exist_ok=True)
    link.symlink_to(real)
    with pytest.raises(wai.InstallationError) as exc:
        wai.read_checked_installation()
    assert exc.value.code in ("installation_unreadable", "private_installation_required")


def test_installation_state_is_secret_free(ha_root: Path) -> None:  # noqa: F811
    assert wai.installation_state()["state"] == "missing"
    write_manifest(ha_root, synthetic_manifest())
    st = wai.installation_state()
    assert st["state"] == "ready" and st["entries"] == 1 and st["service_contract"] == "wiskey-native-service-write.v2"
    assert st["relies_on"]["events/resume_v1"] is True and st["relies_on"]["whatsapp/template_registry_v1"] is False
    text = json.dumps(st)
    for secret in ("SYNTHETIC_EXAMPLE_NEVER_PRODUCTION", "installation:synthetic-grant", "synthetic-entry", str(ha_root)):
        assert secret not in text
    write_manifest(ha_root, {"format": "x"})
    assert wai.installation_state()["state"] == "invalid"


# ================================================================ the GrantRef source: read, never created; behind the switch

def test_grant_source_reads_the_manifest_grant_only() -> None:
    src = wai.ManifestGrantSource(reader=lambda: synthetic_manifest())
    g = src()
    assert isinstance(g, sw.GrantRef) and g.valid() and g.grant_id == "installation:synthetic-grant"
    assert src.actor_id() == "arx-service:synthetic-entry" and repr(src) == "ManifestGrantSource()"
    assert wai.ManifestGrantSource(reader=lambda: synthetic_manifest(readiness="waiting_for_arx_bridge", entries=[]))() is None

    def broken() -> Any:
        raise wai.InstallationError("installation_missing")

    assert wai.ManifestGrantSource(reader=broken)() is None


def test_grant_source_is_off_while_the_switch_is_off(settings: Any, ha_root: Path) -> None:  # noqa: F811
    from smplwise.main import create_app

    write_manifest(ha_root, synthetic_manifest())
    app = create_app(settings)
    src = wai.ManifestGrantSource(app.state.db)
    assert src() is None and src.actor_id() is None
    with app.state.db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
    assert src() is not None


def test_arx_has_no_grant_writer() -> None:
    # Arx never creates, renews or edits a grant: no code path writes the manifest or names WisKey's grant store
    for mod in (wai, sw):
        src = Path(mod.__file__).read_text(encoding="utf-8")
        assert "native_service_grants_v1\"" not in src.replace("native_service_grants_v1`", "")
        assert "automatic_installation" not in src
    assert not hasattr(wai, "write_manifest") and not hasattr(wai, "write_installation")


# ================================================================ resources.json (the exchange; no producer source yet)

def test_resources_shape_is_closed() -> None:
    assert wai.check_resources(json.loads(json.dumps(SYNTH_RESOURCES)))["format"] == wai.RESOURCES_FORMAT


@pytest.mark.parametrize("mutate", [
    lambda d: d.update(extra=1),
    lambda d: d.update(accounts=[]),
    lambda d: d["accounts"].append(dict(d["accounts"][0])),  # duplicate account
    lambda d: d["templates"][0].update(account="unbound"),
    lambda d: d["templates"][0].update(revision=0),
    lambda d: d["templates"][0].update(parameter_fields=["phone"]),
    lambda d: d["templates"].append(dict(d["templates"][0])),  # duplicate reference
    lambda d: d.update(accounts=[{**d["accounts"][0], "account": f"a{i}"} for i in range(129)]),
])
def test_resources_refuse_anything_else(mutate: Any) -> None:
    doc = json.loads(json.dumps(SYNTH_RESOURCES))
    mutate(doc)
    with pytest.raises(wai.InstallationError):
        wai.check_resources(doc)


def test_resources_write_is_atomic_and_private(ha_root: Path) -> None:  # noqa: F811
    p = wai.write_resources(json.loads(json.dumps(SYNTH_RESOURCES)))
    assert p.name == "resources.json" and p.parent.name == "hikvision_intercom.arx_installation"
    assert [x.name for x in p.parent.iterdir()] == ["resources.json"]  # no temporary file left
    if not sys.platform.startswith("win"):
        assert (p.stat().st_mode & 0o777) == 0o600 and (p.parent.stat().st_mode & 0o777) == 0o700
    assert wai.read_resources() == SYNTH_RESOURCES
    with pytest.raises(wai.InstallationError):
        wai.write_resources({"format": wai.RESOURCES_FORMAT, "accounts": [], "templates": []})
    assert wai.read_resources() == SYNTH_RESOURCES  # a refused write leaves the old file


def test_no_production_caller_writes_resources() -> None:
    backend = Path(wai.__file__).resolve().parents[1]
    callers = [p for p in backend.rglob("*.py") if "write_resources(" in p.read_text(encoding="utf-8") and p.name != "wiskey_auto_install.py"]
    assert callers == []  # SOURCE-CLOUD-EXPORT is BLOCKED: no invented account, token or approved template


# ================================================================ service write v2

REPO = "00000000-0000-4000-8000-000000000028"
KEY = bytes(range(32))


class Wire:
    def __init__(self, *answers: Any) -> None:
        self.answers = list(answers)
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def __call__(self, command: str, params: dict[str, Any]) -> Any:
        self.calls.append((command, json.loads(json.dumps(params))))
        a = self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return a


def _done(op: str, contract: str) -> dict[str, Any]:
    return {"contract": contract, "schema_version": 1, "state": "completed", "code": "central_saved", "operation_id": op,
            "receipt": {"user_id": "p-1", "person_revision": 2, "central_state": "saved", "device_application": "not_proven"},
            "replay_available": False, "result": {"id": "p-1", "revision": 2}}


def _grant() -> sw.GrantRef:
    return wai.ManifestGrantSource(reader=lambda: synthetic_manifest())()


def test_v2_metadata_carries_the_manifest_grant_and_contract() -> None:
    meta = sw.Metadata("arx-service:synthetic-entry", _grant(), "p-1", 1, "req-1", "op-1", sw.CONTRACT_V2)
    wire = meta.wire()
    assert wire["contract"] == "wiskey-native-service-write.v2" and set(wire) == sw.META_KEYS and sw.check_metadata(wire)
    assert sw.check_metadata({**wire, "contract": "wiskey-native-service-write.v3"}) is False
    assert sw.Metadata("arx-service:x", _grant(), "p", 1, "r", "o").wire()["contract"] == sw.CONTRACT  # v1 unchanged


def test_v2_result_must_echo_the_request_contract() -> None:
    ok = sw.read_result(_done("op-1", sw.CONTRACT_V2), command="users/update", operation_id="op-1", target_ref="p-1", contract=sw.CONTRACT_V2)
    assert ok is not None and ok.state == "completed"
    assert sw.read_result(_done("op-1", sw.CONTRACT), command="users/update", operation_id="op-1", target_ref="p-1",
                          contract=sw.CONTRACT_V2) is None  # the other contract: malformed -> UNKNOWN
    assert sw.read_result(_done("op-1", sw.CONTRACT), command="users/update", operation_id="op-1", target_ref="p-1") is not None


def test_v2_write_is_journalled_first_and_never_replayed() -> None:
    conn = sqlite3.connect(":memory:")
    wire = Wire(_done("op-1", sw.CONTRACT_V2))
    client = sw.ServiceWriteClient(wire, sw.Journal(conn), repository_id=lambda: REPO, key=KEY, gate=intercom_sync.IntercomSync())
    meta = sw.Metadata("arx-service:synthetic-entry", _grant(), "p-1", 1, "req-1", "op-1", sw.CONTRACT_V2)
    out = client.write("users/update", {"user_id": "p-1", "revision": 1, "data": {"display_name": "Synthetic"}}, meta)
    assert out.state == "completed" and wire.calls[0][1]["service_write"]["contract"] == sw.CONTRACT_V2
    again = client.write("users/update", {"user_id": "p-1", "revision": 1, "data": {"display_name": "Synthetic"}}, meta)
    assert again.dispatched is False and len(wire.calls) == 1


def test_v2_writer_is_unavailable_without_a_client_or_grant() -> None:
    join = SimpleNamespace(selected=lambda _c=None: True)
    src = wai.ManifestGrantSource(reader=lambda: synthetic_manifest())
    w = sw.FinalServiceWriter.from_installation(join, grant=src, actor_id=src.actor_id() or "")
    assert w.contract == sw.CONTRACT_V2 and w.available() is False  # production passes no client
    from smplwise.services.access_grant_engine import EngineError

    with pytest.raises(EngineError) as exc:
        w.write(SimpleNamespace(action="users/update", person_id="p-1", revision=1, data={"display_name": "x"}))
    assert (exc.value.kind, exc.value.code) == ("not_sent", "service_grant_required")
    off = sw.FinalServiceWriter.from_installation(join, grant=lambda: None, actor_id="arx-service:synthetic-entry")
    assert off.available() is False


def test_v2_writer_with_a_client_sends_v2_metadata() -> None:
    conn = sqlite3.connect(":memory:")
    join = SimpleNamespace(selected=lambda _c=None: True)
    src = wai.ManifestGrantSource(reader=lambda: synthetic_manifest())

    class Op:
        action, person_id, revision, data = "users/update", "p-1", 1, {"display_name": "Synthetic"}

    wire = Wire()
    client = sw.ServiceWriteClient(wire, sw.Journal(conn), repository_id=lambda: REPO, key=KEY, gate=intercom_sync.IntercomSync())
    w = sw.FinalServiceWriter.from_installation(join, grant=src, actor_id="arx-service:synthetic-entry", client=client)
    w._new_id = lambda: "fixed"
    wire.answers.append(_done("op-fixed", sw.CONTRACT_V2))
    assert w.available() is True
    assert w.write(Op()) == {"id": "p-1", "revision": 2}
    meta = wire.calls[0][1]["service_write"]
    assert meta["contract"] == sw.CONTRACT_V2 and meta["grant_id"] == "installation:synthetic-grant" and meta["target_revision"] == 1
