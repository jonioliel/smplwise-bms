"""WISKEY-R2-ALIGN-2272: the R2 contracts adopted semantically - readiness_v1 reader, event retention reader, the compact code table, the
shipped schemas, and the station thumbnail route (native still only with `wiskey.auto_install`). Synthetic data and fakes only."""
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_intercom import camera_feed, fake_go2rtc, feed  # noqa: F401 - fixtures
from test_intercom_media import fake_provider  # noqa: F401 - fixture
from test_wiskey_adopt_2272_contrib import synthetic_manifest

from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from smplwise.services import go2rtc
from smplwise.services import wiskey_auto_install as wai
from smplwise.services import wiskey_r2_contracts as r2

REPO = Path(__file__).resolve().parents[3]
SCHEMAS = REPO / "contracts" / "wiskey" / "r2" / "schemas"
D = {"smplwise_bridge": "a" * 64, "hikvision_intercom": "b" * 64}


def ready_reply(manifest: dict[str, Any] | None = None) -> dict[str, Any]:
    m = manifest or synthetic_manifest()
    row = m["entries"][0]
    return {"contract": "wiskey-installation-readiness.v1", "schema_version": 1, "state": "ready", "reason": None, "generation_id": "g1",
            "boot_id": "boot-1", "process_id": 7, "expected": dict(D), "staged": dict(D), "installed": dict(D), "loaded": dict(D),
            "bridge_boot_id": "bb-1", "restart": {"state": "completed", "boot_id": "boot-1"}, "connection_ref": "conn-1",
            "bridge_entry_id": row["entry_id"], "installation_id": m["installation_id"], "grant_ref": copy.deepcopy(row["grant_ref"]),
            "cloud_resources_state": "blocked_missing_external_resources"}


def test_readiness_ready_requires_four_equal_digest_sets_and_the_manifest_identity() -> None:
    m = synthetic_manifest()
    assert r2.read_readiness(ready_reply(m), m)["state"] == "ready"
    for mutate in (lambda r: r["loaded"].pop("smplwise_bridge"), lambda r: r["loaded"].update(hikvision_intercom="c" * 64),
                   lambda r: r.update(reason="restart_pending"), lambda r: r.update(bridge_boot_id=None), lambda r: r.update(extra=1),
                   lambda r: r.update(process_id=0), lambda r: r.update(contract="x"), lambda r: r["installed"].update(smplwise_bridge=None)):
        bad = ready_reply(m)
        mutate(bad)
        with pytest.raises(wai.InstallationError):
            r2.read_readiness(bad, m)


def test_readiness_of_another_installation_or_grant_is_refused_for_reconnect() -> None:
    m = synthetic_manifest()
    for key, val in (("installation_id", "other"), ("bridge_entry_id", "other")):
        bad = ready_reply(m)
        bad[key] = val
        with pytest.raises(wai.InstallationError) as e:
            r2.read_readiness(bad, m)
        assert e.value.code == "installation_changed_reconnect_required"
    bad = ready_reply(m)
    bad["grant_ref"]["grant_revision"] += 1
    with pytest.raises(wai.InstallationError):
        r2.read_readiness(bad, m)


def test_not_ready_needs_a_closed_reason_and_never_claims_loaded() -> None:
    r = ready_reply()
    r.update(state="not_ready", reason="restart_pending", loaded={"hikvision_intercom": "b" * 64}, restart={"state": "requested", "boot_id": None})
    assert r2.read_readiness(r)["reason"] == "restart_pending"
    r["reason"] = None
    with pytest.raises(wai.InstallationError):
        r2.read_readiness(r)
    r["reason"] = "made_up"
    with pytest.raises(wai.InstallationError):
        r2.read_readiness(r)


def retention(**eff: Any) -> dict[str, Any]:
    return {"contract": "wiskey-event-retention.v1", "schema_version": 1, "effective": {"days": 30, "count": 5000, "bytes": None} | eff,
            "order": "local_acceptance_sequence", "delivery": "at_least_once", "age_basis": "received_at", "minimum_days_guaranteed": False}


def test_event_retention_is_what_the_install_reports_and_never_a_guarantee() -> None:
    assert r2.read_event_retention(retention())["effective"]["count"] == 5000
    for bad in (retention(days=0), retention(count=20001), retention(bytes=10), retention(days=True)):
        with pytest.raises(wai.InstallationError):
            r2.read_event_retention(bad)
    g = retention()
    g["minimum_days_guaranteed"] = True
    with pytest.raises(wai.InstallationError):
        r2.read_event_retention(g)


def test_code_table_is_compact_complete_and_unknown_codes_stay_unknown() -> None:
    t = r2.public_outcomes()
    assert len(t["CODES"]) == 926 and len(t["OUTCOME_CONTRACT_ROWS"]) == 54 and t["UNRECOGNIZED_VALUE"]["wire_code_must_not_be_rewritten"] is True
    assert r2.outcome_known("Unauthorized") and not r2.outcome_known("invented_code") and not r2.outcome_known(None)
    assert "sources" not in json.dumps(t)[:200] and (REPO / "contracts/wiskey/alignment-v1/public_outcomes.v2.compact.json").stat().st_size < 200_000


def test_shipped_schemas_are_valid_json_schemas_and_refs_resolve() -> None:
    names = sorted(p.name for p in SCHEMAS.glob("*.schema.json"))
    assert len(names) >= 16
    defs = json.loads((SCHEMAS / "definitions.json").read_text(encoding="utf-8"))
    for n in names:
        doc = json.loads((SCHEMAS / n).read_text(encoding="utf-8"))
        assert doc["$schema"].startswith("https://json-schema.org/") and doc["$id"].endswith(n)
        for ref in _refs(doc):
            if ref.startswith("definitions.json#/$defs/"):
                assert ref.rsplit("/", 1)[1] in defs["$defs"], (n, ref)


def _refs(node: Any) -> list[str]:
    if isinstance(node, dict):
        own = [node["$ref"]] if isinstance(node.get("$ref"), str) else []
        return own + [r for v in node.values() for r in _refs(v)]
    if isinstance(node, list):
        return [r for v in node for r in _refs(v)]
    return []


def test_valid_readiness_matches_the_shipped_schema_when_jsonschema_is_present() -> None:
    jsonschema = pytest.importorskip("jsonschema")
    from referencing import Registry, Resource

    defs = json.loads((SCHEMAS / "definitions.json").read_text(encoding="utf-8"))
    reg = Registry().with_resource("definitions.json", Resource.from_contents(defs))
    sch = json.loads((SCHEMAS / "installation-readiness.v1.schema.json").read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator(sch, registry=reg).validate(ready_reply())


# ---------------------------------------------------------------- the station thumbnail route
THUMB = "/api/v1/access-control/stations/{}/thumbnail.jpg"


@pytest.fixture()
def still(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    seen: dict[str, Any] = {"native": 0, "frames": 0}

    def native(_s: Any, station_id: str, *_a: Any) -> tuple[bytes, str]:
        seen["native"] += 1
        return b"\xff\xd8native", "image/jpeg"

    def frame(_self: Any, name: str) -> bytes:
        seen["frames"] += 1
        seen["name"] = name
        return b"\xff\xd8lease"

    monkeypatch.setattr(wai, "installed_snapshot", native)
    monkeypatch.setattr(go2rtc.Go2rtc, "frame_existing", frame)
    return seen


def test_thumbnail_switch_off_uses_only_arx_own_lease_path(feed, fake_go2rtc, fake_provider, still) -> None:  # noqa: F811
    c, _s = camera_feed(feed)
    r = c.get(THUMB.format("entry-a"))
    assert r.status_code == 200 and r.content == b"\xff\xd8lease" and still["native"] == 0
    assert r.headers["cache-control"] == "private, no-store" and r.headers["x-snapshot-stale"] == "false"
    assert r.headers["content-type"].startswith("image/jpeg")
    assert not any(x in json.dumps(dict(r.headers)) for x in ("rtsp", "192.0.2", "p@ss"))


def test_thumbnail_switch_on_prefers_the_installed_still(feed, fake_go2rtc, fake_provider, still) -> None:  # noqa: F811
    c, _s = camera_feed(feed)
    from smplwise.db import set_setting

    with c.app.state.db.write_aside() as conn:
        set_setting(conn, wai.SWITCH_KEY, "on")
    r = c.get(THUMB.format("entry-a"))
    assert r.status_code == 200 and r.content == b"\xff\xd8native" and still["native"] == 1 and still["frames"] == 0


def test_thumbnail_needs_station_access(feed, fake_go2rtc, fake_provider, still, station_scope) -> None:  # noqa: F811
    c, s = camera_feed(feed)
    assert c.get(THUMB.format("nope")).status_code == 404
    assert c.get(THUMB.format("entry-a"), headers=as_user("nobody")).status_code == 403
    station_scope.bind("dev-sam", "viewer", "entry-b")
    assert c.get(THUMB.format("entry-a"), headers=as_user("sam")).status_code == 404
    bind(c, s, "vera", "viewer", "installation", "*")
    assert c.get(THUMB.format("entry-a"), headers=as_user("vera")).status_code == 200
    assert still["native"] == 0
