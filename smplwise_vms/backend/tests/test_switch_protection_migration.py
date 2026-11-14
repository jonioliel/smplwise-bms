"""CR-019 sections 6.2 / 6.4 / 6.5: migration 0049 on a 0.1.150-shaped database (the CR-007 opt-in marks carried over as
`was_safe`, `device_bulk_safe` frozen) and the reconcile pass (start-up and registry refresh): classify new switches once,
the fail-safe before the first pass, idempotence, `admin_cleared` never re-protected, a classifier version bump re-judging
`allowed` only, the rename follow by registry id, gone / returned / 90-day purge, the empty mirror and the audit rows."""
from __future__ import annotations

import datetime as dt
import json
import shutil

import pytest
from fastapi.testclient import TestClient

from smplwise import db as dbmod
from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.services import device_bulk
from smplwise.services import switch_protection as sp

T0 = "2026-09-30T10:00:00Z"
ADMIN = Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev")


def _ent(conn, eid: str, name: str, *, reg: str | None = "auto", platform: str | None = "shelly", device: str | None = None, area: str | None = None,
         removed: str | None = None, disabled: int = 0, device_class: str | None = None, icon: str | None = None) -> None:
    conn.execute(
        "INSERT INTO ha_entities(entity_id, registry_id, platform, device_id, area_name, name, domain, device_class, icon, disabled, removed_at, first_seen_at, updated_at, state, available) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)",
        (eid, (f"reg-{eid}" if reg == "auto" else reg), platform, device, area, name, eid.split(".", 1)[0], device_class, icon, disabled, removed, T0, T0, "on"),
    )


def _audit(conn, prefix: str = "devices.") -> list[tuple[str, str | None, str | None, dict]]:
    return [(r["action"], r["resource_id"], r["reason"], json.loads(r["details_json"] or "{}"))
            for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE ? ORDER BY id", (prefix + "%",)).fetchall()]


def _verdicts(conn) -> dict[str, str]:
    return {r[0]: r[1] for r in conn.execute("SELECT entity_id, verdict FROM device_switch_classified").fetchall()}


def _protected(conn) -> dict[str, dict]:
    return {r["entity_id"]: dict(r) for r in conn.execute("SELECT * FROM device_bulk_protected").fetchall()}


@pytest.fixture()
def db_0150(settings, tmp_path, monkeypatch):
    """A database at the 0.1.150 schema (migrations below 0049) holding switches, devices and the old opt-in marks."""
    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) < 49:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    database.migrate()
    with database.connection() as conn:
        _ent(conn, "switch.hall_lights", "Hall lights")
        _ent(conn, "switch.gate", "Gate")  # the classifier would protect it - but an administrator had marked it safe
        _ent(conn, "switch.pool_pump", "Pool pump")
        _ent(conn, "switch.relay_2", "Relay 2")
        _ent(conn, "switch.relay_9", "Relay 9", device="dev-heater")
        _ent(conn, "switch.relay_10", "Relay 10", device="dev-lock")
        _ent(conn, "lock.front", "Front lock", device="dev-lock")
        _ent(conn, "switch.schedule_morning", "Morning", platform="scheduler")  # a Scheduler component switch: never judged
        _ent(conn, "switch.disabled_pump", "Spare pump", disabled=1)  # not in the catalogue: judged when it is enabled
        _ent(conn, "switch.yaml_boiler", "Boiler", reg=None, platform=None)  # HA never registered it: present while it reports
        conn.execute("INSERT INTO ha_devices(device_id, name, manufacturer, model, updated_at) VALUES ('dev-heater', 'Water heater controller', 'Acme', 'X1', ?)", (T0,))
        for eid in ("switch.hall_lights", "switch.gate", "switch.gone_before"):
            conn.execute("INSERT INTO device_bulk_safe(entity_id, marked_by, marked_by_username, marked_at) VALUES (?, 'u1', 'admin', ?)", (eid, T0))
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    return database


def test_upgrade_carries_the_safe_marks_over_and_the_first_pass_classifies_the_rest(db_0150, settings):
    assert 49 in db_0150.migrate()
    with db_0150.connection() as conn:
        assert _verdicts(conn) == {"switch.hall_lights": "was_safe", "switch.gate": "was_safe", "switch.gone_before": "was_safe"}
        assert conn.execute("SELECT registry_id FROM device_switch_classified WHERE entity_id = 'switch.gate'").fetchone()[0] == "reg-switch.gate"
        assert not _protected(conn)
        assert {r[0] for r in conn.execute("SELECT entity_id FROM device_bulk_safe")} == {"switch.hall_lights", "switch.gate", "switch.gone_before"}, "kept, frozen"
        assert dbmod.get_setting(conn, sp.MIGRATION_KEY)
        # before the first pass: a switch nobody has judged is INCLUDED (owner decision 2026-10-02: the default is included)
        pol = device_bulk.SwitchPolicy(conn)
        assert pol.switch_reason("switch.relay_2") == (True, "allowed")
        assert pol.switch_reason("switch.pool_pump") == (True, "allowed")
        assert pol.switch_reason("switch.gate") == (True, "allowed"), "decision 2a: marked safe stays unprotected"
    # start-up runs the first pass on the mirror the previous process left
    TestClient(create_app(settings))
    with db_0150.connection() as conn:
        v = _verdicts(conn)
        p = _protected(conn)
        assert v["switch.pool_pump"] == "protected" and p["switch.pool_pump"]["source"] == "auto" and p["switch.pool_pump"]["reviewed"] == 0
        assert (p["switch.pool_pump"]["category"], p["switch.pool_pump"]["rule"]) == ("water_heating", "name:pump")
        assert (p["switch.relay_9"]["category"], p["switch.relay_9"]["rule"]) == ("water_heating", "device:water heater")
        assert (p["switch.relay_10"]["category"], p["switch.relay_10"]["rule"]) == ("access", "sibling:lock")
        assert p["switch.yaml_boiler"]["rule"] == "name:boiler", "an unregistered switch is judged too"
        assert v["switch.relay_2"] == "allowed" and v["switch.hall_lights"] == "was_safe" and v["switch.gate"] == "was_safe"
        assert "switch.gate" not in p, "never auto-protected over the administrator's old mark"
        assert "switch.schedule_morning" not in v and "switch.disabled_pump" not in v
        pol = device_bulk.SwitchPolicy(conn)
        assert pol.switch_reason("switch.relay_2") == (True, "allowed")
        # the classifier only SUGGESTS: a suggestion is included and is not protected until an administrator approves it
        for eid in ("switch.pool_pump", "switch.relay_9", "switch.relay_10", "switch.yaml_boiler"):
            assert pol.switch_reason(eid) == (True, "allowed") and pol.switch_row(eid) == (False, "allowed"), eid
        assert pol.switch_row("switch.relay_2") == (False, "allowed")
        rows = _audit(conn)
        auto = sorted(r[1] for r in rows if r[0] == "devices.bulk_protected.auto")
        assert auto == ["switch.pool_pump", "switch.relay_10", "switch.relay_9", "switch.yaml_boiler"]
        assert all(r[2] and r[3]["classifier_version"] == sp.CLASSIFIER_VERSION and r[3]["rule"] for r in rows if r[0] == "devices.bulk_protected.auto")
        summary = [r for r in rows if r[0] == "devices.bulk_protected.reconcile"]
        assert len(summary) == 1 and summary[0][3]["auto_protected"] == 4 and summary[0][3]["allowed"] == 1
        migrated = [r for r in rows if r[0] == "devices.switch_model.migrated"]
        assert len(migrated) == 1 and migrated[0][3]["was_safe"] == 3 and migrated[0][3]["auto_protected"] == 4 and migrated[0][3]["allowed"] == 1
        assert dbmod.get_setting(conn, sp.MIGRATION_KEY) is None
        # the frozen table is never written by the new code
        assert {r[0] for r in conn.execute("SELECT entity_id FROM device_bulk_safe")} == {"switch.hall_lights", "switch.gate", "switch.gone_before"}
        n = len(_audit(conn))
        # idempotent: a second pass changes nothing and writes nothing
        counts = sp.reconcile(conn, sp.present_from_mirror(conn))
        assert not any(counts.values()) and len(_audit(conn)) == n and _protected(conn) == p


def test_a_suggestion_is_enforced_only_after_the_administrator_approves_it_and_dismissing_it_is_permanent(db_0150):
    db_0150.migrate()
    with db_0150.connection() as conn:
        sp.reconcile(conn, sp.present_from_mirror(conn))
        assert device_bulk.SwitchPolicy(conn).switch_reason("switch.pool_pump") == (True, "allowed")
        assert sp.approve(conn, ADMIN, "switch.pool_pump") is True and sp.approve(conn, ADMIN, "switch.pool_pump") is False
        pol = device_bulk.SwitchPolicy(conn)
        assert pol.switch_reason("switch.pool_pump") == (False, "switch_protected") and pol.switch_row("switch.pool_pump") == (True, "protected")
        # protecting a suggestion is the same as approving it
        assert sp.set_protected(conn, ADMIN, "switch.relay_9", True) is True
        assert device_bulk.SwitchPolicy(conn).switch_reason("switch.relay_9") == (False, "switch_protected") and _protected(conn)["switch.relay_9"]["reviewed"] == 1
        # dismissing a suggestion: it stays included and the classifier never suggests it again
        assert sp.set_protected(conn, ADMIN, "switch.relay_10", False) is True
        assert "switch.relay_10" not in _protected(conn) and _verdicts(conn)["switch.relay_10"] == "admin_cleared"
        assert device_bulk.SwitchPolicy(conn).switch_reason("switch.relay_10") == (True, "allowed")
        sp.reconcile(conn, sp.present_from_mirror(conn))
        assert "switch.relay_10" not in _protected(conn)


def test_a_fresh_installation_has_no_migration_record(settings):
    database = dbmod.Database(settings.db_path)
    database.migrate()
    with database.connection() as conn:
        assert dbmod.get_setting(conn, sp.MIGRATION_KEY) is None
        assert sp.reconcile(conn, set()) == {k: 0 for k in ("auto_protected", "allowed", "moved", "gone", "returned", "purged", "rejudged")}, "empty mirror: no-op"
        _ent(conn, "switch.pump", "Pump")
        sp.reconcile(conn, {"switch.pump"})
        assert not [r for r in _audit(conn) if r[0] == "devices.switch_model.migrated"]


def test_admin_cleared_is_permanent_and_a_version_bump_rejudges_allowed_only(db_0150, monkeypatch):
    db_0150.migrate()
    with db_0150.connection() as conn:
        sp.reconcile(conn, sp.present_from_mirror(conn))
        assert sp.set_protected(conn, ADMIN, "switch.pool_pump", False) is True
        assert _verdicts(conn)["switch.pool_pump"] == "admin_cleared" and "switch.pool_pump" not in _protected(conn)
        assert device_bulk.SwitchPolicy(conn).switch_reason("switch.pool_pump") == (True, "allowed")
        # the HA name of the plain relay changes to something the classifier recognises; the rules are bumped
        conn.execute("UPDATE ha_entities SET name = 'Boiler relay' WHERE entity_id = 'switch.relay_2'")
        sp.reconcile(conn, sp.present_from_mirror(conn))
        assert "switch.relay_2" not in _protected(conn), "same version: a judged switch is not judged again"
        monkeypatch.setattr(sp, "CLASSIFIER_VERSION", 2)
        counts = sp.reconcile(conn, sp.present_from_mirror(conn))
        p = _protected(conn)
        assert counts["rejudged"] == 1 and p["switch.relay_2"]["source"] == "auto" and p["switch.relay_2"]["rule"] == "name:boiler"
        assert "switch.pool_pump" not in p and "switch.gate" not in p, "admin_cleared and was_safe are never re-judged"
        v = {r[0]: (r[1], r[2]) for r in conn.execute("SELECT entity_id, verdict, classifier_version FROM device_switch_classified")}
        assert v["switch.relay_2"] == ("protected", 2) and v["switch.pool_pump"][0] == "admin_cleared" and v["switch.gate"] == ("was_safe", 0)
        assert sp.reconcile(conn, sp.present_from_mirror(conn))["rejudged"] == 0


def test_a_renamed_entity_id_keeps_its_protection_by_registry_id(db_0150):
    db_0150.migrate()
    with db_0150.connection() as conn:
        sp.reconcile(conn, sp.present_from_mirror(conn))
        assert sp.set_protected(conn, ADMIN, "switch.relay_2", True)
        # HA renames the entity id: the registry entry (same id) now names switch.lobby_relay; the old row is tombstoned
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE entity_id = 'switch.relay_2'", (T0,))
        _ent(conn, "switch.lobby_relay", "Relay 2", reg="reg-switch.relay_2")
        counts = sp.reconcile(conn, sp.present_from_mirror(conn))
        assert counts["moved"] == 1 and counts["allowed"] == 0 and counts["auto_protected"] == 0
        p = _protected(conn)
        assert "switch.relay_2" not in p and p["switch.lobby_relay"]["source"] == "manual" and p["switch.lobby_relay"]["gone_at"] is None
        assert "switch.lobby_relay" in _verdicts(conn) and "switch.relay_2" not in _verdicts(conn), "the verdict moved too: not judged again"
        assert device_bulk.SwitchPolicy(conn).switch_reason("switch.lobby_relay") == (False, "switch_protected")
        assert [r[3] for r in _audit(conn) if r[0] == "devices.bulk_protected.moved"] == [{"from": "switch.relay_2", "to": "switch.lobby_relay"}]
        # a renamed admin_cleared switch stays cleared
        assert sp.set_protected(conn, ADMIN, "switch.pool_pump", False)
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE entity_id = 'switch.pool_pump'", (T0,))
        _ent(conn, "switch.pool_pump_main", "Pool pump", reg="reg-switch.pool_pump")
        sp.reconcile(conn, sp.present_from_mirror(conn))
        assert _verdicts(conn)["switch.pool_pump_main"] == "admin_cleared" and "switch.pool_pump_main" not in _protected(conn)


def test_a_gone_entity_keeps_its_protection_returns_and_is_purged_after_90_days(db_0150):
    db_0150.migrate()
    now = dt.datetime(2026, 10, 1, 12, 0, tzinfo=dt.timezone.utc)
    with db_0150.connection() as conn:
        sp.reconcile(conn, sp.present_from_mirror(conn), now=now)
        assert sp.approve(conn, ADMIN, "switch.pool_pump")  # the suggestion becomes an enforced protection
        present = sp.present_from_mirror(conn)
        # the pump leaves HA's registry (integration removed): protection kept, marked gone, still applies
        counts = sp.reconcile(conn, present - {"switch.pool_pump"}, now=now)
        p = _protected(conn)
        assert counts["gone"] == 1 and p["switch.pool_pump"]["gone_at"] and device_bulk.SwitchPolicy(conn).switch_reason("switch.pool_pump") == (False, "switch_protected")
        # it comes back within 90 days: present again, nothing re-judged
        counts = sp.reconcile(conn, present, now=now + dt.timedelta(days=30))
        assert counts["returned"] == 1 and _protected(conn)["switch.pool_pump"]["gone_at"] is None and not counts["auto_protected"]
        # gone for good (the sync tombstones what left the registry): kept for 90 days, then purged with its verdict (an id
        # reused much later is judged anew)
        conn.execute("UPDATE ha_entities SET removed_at = ? WHERE entity_id IN ('switch.pool_pump', 'switch.relay_2')", (T0,))
        sp.reconcile(conn, present - {"switch.pool_pump", "switch.relay_2"}, now=now + dt.timedelta(days=31))
        sp.reconcile(conn, present - {"switch.pool_pump", "switch.relay_2"}, now=now + dt.timedelta(days=120))
        assert "switch.pool_pump" in _protected(conn) and "switch.relay_2" in _verdicts(conn), "89 days gone: kept"
        counts = sp.reconcile(conn, present - {"switch.pool_pump", "switch.relay_2"}, now=now + dt.timedelta(days=122))
        assert counts["purged"] == 2
        assert "switch.pool_pump" not in _protected(conn) and "switch.pool_pump" not in _verdicts(conn) and "switch.relay_2" not in _verdicts(conn)
        purged = {r[1]: r[3] for r in _audit(conn) if r[0] == "devices.bulk_protected.purged"}
        assert purged["switch.pool_pump"]["protected"] is True and purged["switch.relay_2"] == {"gone_at": purged["switch.relay_2"]["gone_at"], "protected": False, "verdict": "allowed"}
        # the id returns (another device, maybe): judged again like a new switch
        conn.execute("UPDATE ha_entities SET name = 'Garage door', removed_at = NULL WHERE entity_id = 'switch.relay_2'")
        sp.reconcile(conn, present, now=now + dt.timedelta(days=123))
        assert _protected(conn)["switch.relay_2"]["category"] == "access"
        # the old opt-in mark of an entity long gone (switch.gone_before) is just a verdict row: purged once it has been gone 90 days
        assert "switch.gone_before" not in _verdicts(conn)


def test_a_switch_seen_for_the_first_time_is_included_judged_once_and_at_most_suggested(db_0150):
    db_0150.migrate()
    with db_0150.connection() as conn:
        sp.reconcile(conn, sp.present_from_mirror(conn))
        _ent(conn, "switch.new_fridge", "Fridge")
        _ent(conn, "switch.new_lamp", "Desk lamp")
        pol = device_bulk.SwitchPolicy(conn)
        assert pol.switch_reason("switch.new_fridge") == (True, "allowed") and pol.switch_reason("switch.new_lamp") == (True, "allowed")
        counts = sp.reconcile(conn, sp.present_from_mirror(conn))
        assert (counts["auto_protected"], counts["allowed"]) == (1, 1)
        pol = device_bulk.SwitchPolicy(conn)
        assert pol.switch_reason("switch.new_fridge") == (True, "allowed") and pol.switch_reason("switch.new_lamp") == (True, "allowed"), "a suggestion is not enforced"
        assert _protected(conn)["switch.new_fridge"]["source"] == "auto" and "switch.new_lamp" not in _protected(conn)
        # an administrator dismisses the suggestion: never re-applied by later passes, also after the HA name changes
        sp.set_protected(conn, ADMIN, "switch.new_fridge", False)
        conn.execute("UPDATE ha_entities SET name = 'Freezer' WHERE entity_id = 'switch.new_fridge'")
        sp.reconcile(conn, sp.present_from_mirror(conn))
        assert "switch.new_fridge" not in _protected(conn)


def test_the_manual_choices_protect_unprotect_approve(db_0150):
    db_0150.migrate()
    with db_0150.connection() as conn:
        sp.reconcile(conn, sp.present_from_mirror(conn))
        assert sp.approve(conn, ADMIN, "switch.pool_pump") is True
        row = _protected(conn)["switch.pool_pump"]
        assert row["reviewed"] == 1 and row["reviewed_by"] == "joni" and row["reviewed_at"]
        assert sp.approve(conn, ADMIN, "switch.pool_pump") is False, "approved already"
        assert sp.approve(conn, ADMIN, "switch.relay_2") is False, "not protected: nothing to approve"
        assert sp.set_protected(conn, ADMIN, "switch.relay_2", True) is True
        row = _protected(conn)["switch.relay_2"]
        assert (row["source"], row["reviewed"], row["marked_by"], row["marked_by_username"], row["category"]) == ("manual", 1, "dev-joni", "joni", None)
        assert sp.set_protected(conn, ADMIN, "switch.relay_2", True) is False
        assert sp.set_protected(conn, ADMIN, "switch.hall_lights", False) is False, "was_safe and unprotected: nothing changes"
        # protecting an unreviewed auto row confirms it
        assert not _protected(conn)["switch.relay_9"]["reviewed"]
        assert sp.set_protected(conn, ADMIN, "switch.relay_9", True) is True and _protected(conn)["switch.relay_9"]["reviewed"] == 1
        # unprotecting a switch not judged yet makes it included at once (and never auto-protected later)
        _ent(conn, "switch.new_pump", "Pump 3")
        assert sp.set_protected(conn, ADMIN, "switch.new_pump", False) is True
        assert device_bulk.SwitchPolicy(conn).switch_reason("switch.new_pump") == (True, "allowed")
        sp.reconcile(conn, sp.present_from_mirror(conn))
        assert "switch.new_pump" not in _protected(conn)
        acts = [r[0] for r in _audit(conn, "devices.bulk_protected") if r[0] in ("devices.bulk_protected", "devices.bulk_protected.reviewed")]
        assert acts == ["devices.bulk_protected.reviewed", "devices.bulk_protected", "devices.bulk_protected.reviewed", "devices.bulk_protected"]
