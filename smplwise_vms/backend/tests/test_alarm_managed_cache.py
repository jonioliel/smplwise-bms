"""Review L9: services/alarm.managed_controls (the set of entities only the alarm section may operate) costs a full
discovery; it is asked for by the entity screens, the map, the bulk routes and the shared-space checks, so it is kept per
database while the discovery inputs are unchanged, and recomputed the moment the mirror or the overrides change."""
from __future__ import annotations

from test_alarm import alarm_app, fake_alarm  # noqa: F401 - fixture

from smplwise.services import alarm as alarm_svc
from smplwise.services import ha_sync


def _count_discoveries(monkeypatch) -> dict:
    n = {"calls": 0}
    real = alarm_svc.discover

    def counted(*a, **kw):
        n["calls"] += 1
        return real(*a, **kw)

    monkeypatch.setattr(alarm_svc, "discover", counted)
    return n


def test_repeated_calls_do_not_recompute(alarm_app, monkeypatch):
    app, *_ = alarm_app
    n = _count_discoveries(monkeypatch)
    with app.state.db.connection(mode="read") as conn:
        first = alarm_svc.managed_controls(conn)
        assert first and "switch.back_door_bypassed" in first and n["calls"] == 1
        for _ in range(5):
            assert alarm_svc.managed_controls(conn) == first
    with app.state.db.connection(mode="read") as other:  # another request, another connection: still the same answer
        assert alarm_svc.managed_controls(other) == first
    assert n["calls"] == 1
    # a caller keeps or changes its copy freely: the cache is not poisoned
    with app.state.db.connection(mode="read") as conn:
        mine = alarm_svc.managed_controls(conn)
        mine.add("switch.poison")
        assert "switch.poison" not in alarm_svc.managed_controls(conn)
    # a supplied discovery is used as given and never cached
    with app.state.db.connection(mode="read") as conn:
        alarm_svc.managed_controls(conn, alarm_svc.discover(conn))
    assert n["calls"] == 2


def test_state_changes_keep_the_cache_but_the_mirror_and_overrides_invalidate_it(alarm_app, monkeypatch):
    app, *_ = alarm_app
    n = _count_discoveries(monkeypatch)
    db = app.state.db
    with db.connection() as conn:
        base = alarm_svc.managed_controls(conn)
    assert n["calls"] == 1
    # a pure state flip of a sensor and of the panel (state and seen columns only): discovery does not read them
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET state = 'on', state_seen_at = '2026-09-30T10:00:00Z', updated_at = '2026-09-30T10:00:00Z' "
                     "WHERE entity_id IN ('binary_sensor.back_door', 'alarm_control_panel.risco_house')")
    with db.connection() as conn:
        assert alarm_svc.managed_controls(conn) == base
    assert n["calls"] == 1, "a state change never recomputes"
    # a new bypass-like control of the panel's integration appears: recomputed, and it is owned (fail closed)
    with db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "switch.new_zone_bypass", "state": "off", "attributes": {"friendly_name": "Bypass new zone"}})
        panel = conn.execute("SELECT platform FROM ha_entities WHERE entity_id = 'alarm_control_panel.risco_house'").fetchone()[0]
        conn.execute("UPDATE ha_entities SET platform = ?, config_entry_id = NULL WHERE entity_id = 'switch.new_zone_bypass'", (panel,))
    n["calls"] = 0
    with db.connection() as conn:
        after = alarm_svc.managed_controls(conn)
    assert n["calls"] == 1 and "switch.new_zone_bypass" in after and "switch.new_zone_bypass" not in base
    # an administrator's "not an alarm control" mark (an override row) releases it: recomputed at once, even within the same second
    with db.connection() as conn:
        conn.execute("INSERT INTO alarm_zone_overrides(zone_entity_id, excluded, updated_at) VALUES ('switch.new_zone_bypass', 1, '2026-09-30T10:00:00Z')")
    n["calls"] = 0
    with db.connection() as conn:
        assert "switch.new_zone_bypass" not in alarm_svc.managed_controls(conn)
        conn.execute("UPDATE alarm_zone_overrides SET excluded = 0 WHERE zone_entity_id = 'switch.new_zone_bypass'")  # same updated_at
    with db.connection() as conn:
        assert "switch.new_zone_bypass" in alarm_svc.managed_controls(conn)
    assert n["calls"] == 2
    # a removed entity leaves the set
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = '2026-09-30T10:00:01Z' WHERE entity_id = 'switch.new_zone_bypass'")
    with db.connection() as conn:
        assert "switch.new_zone_bypass" not in alarm_svc.managed_controls(conn)
