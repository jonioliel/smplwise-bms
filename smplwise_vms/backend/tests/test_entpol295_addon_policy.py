"""ENTPOL-295 (Fable review 4, owner decision 3 of 2026-10-21): the automatic refusal while the service user is not restricted by an entity
policy - the add-on side, fail closed. Negative cases first.

EXTID-295 built the report (`bridge.service_policy_restricted`, from the directory push) and the refusal `service_identity_policy_default`.
ENTPOL-295 adds: a "restricted" report counts only while it is CURRENT (the last accepted push at most POLICY_REPORT_MAX_AGE_S old) - Home
Assistant unreachable / the bridge stopped pushing / an unreadable or future push time = `service_identity_policy_stale`, nothing sent.
The extended mode stays locked (EXTENDED_GO_LIVE_PERMITTED is False in this build). Fakes only: no Home Assistant, no device, no secrets."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from smplwise.db import now_iso, set_setting
from smplwise.errors import ApiError
from smplwise.services import service_identity as si
from test_service_identity import SID, _local, _seed, _subject, db  # noqa: F401 (fixtures)
from test_service_identity_extended import EXT_ITEMS, _audit, _ext, _xcode, _xsubject

NOW = datetime(2026, 10, 21, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _go_live_permit(request, monkeypatch):
    """As in test_service_identity_extended: the FUTURE enabled behaviour runs with the permit monkeypatched; tests named
    `..._without_the_go_live_permit` run with the value this build ships."""
    if "without_the_go_live_permit" not in request.node.name:
        monkeypatch.setattr(si, "EXTENDED_GO_LIVE_PERMITTED", True)


def _pushed(db, at: str | None) -> None:
    with db.connection() as conn:
        set_setting(conn, si.DIRECTORY_AT, at or "")


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- 0. the build stays locked

def test_the_mode_stays_locked_without_the_go_live_permit(db):
    assert si.EXTENDED_GO_LIVE_PERMITTED is False and si.extended_go_live_permitted() is False
    _seed(db)
    _ext(db)  # both switches stored on, a 0.9.6 bridge, a current "restricted" report: still nothing extended
    with db.connection(mode="read") as conn:
        assert si.extended_on(conn) is False
    assert _xcode(db, _local(), item=("lock", "unlock")) == "service_identity_refused"
    assert _audit(db, "identity.service_identity.extended") == []


# ---------------------------------------------------------------- 1. unreachable Home Assistant: a stale report is no report

@pytest.mark.parametrize("feature,service,item", EXT_ITEMS)
@pytest.mark.parametrize("at", [None, "2026-01-01T00:00:00Z", "not a time", "9999-01-01T00:00:00Z"],
                         ids=["never-pushed", "pushes-stopped", "unreadable", "future"])
def test_a_restricted_report_that_is_not_current_refuses_every_extended_item(db, feature, service, item, at):
    _seed(db)
    _ext(db, policy="true")
    _pushed(db, at)
    # the binding text's "cannot be determined" (HA_IDENTITY_RBAC_HE.md section 3-alef item vav): the same code, its own audit reason and message
    with pytest.raises(ApiError) as e:
        _xsubject(db, _local(), feature=feature, service=service, item=item)
    assert (e.value.status, e.value.code) == (503, "service_identity_policy_default") and e.value.user_message == si.STALE_MESSAGE
    assert _audit(db, "identity.service_identity.refused")[-1]["reason"] == "policy_stale"
    assert _audit(db, "identity.service_identity.extended") == []


def test_a_stale_report_does_not_touch_basic_items(db):
    _seed(db)
    _ext(db, policy="true")
    _pushed(db, "2026-01-01T00:00:00Z")
    assert _subject(db, _local())["user_id"] == SID  # light.turn_on: a 2.6.4 item, unaffected


def test_the_default_policy_is_named_before_staleness(db):
    _seed(db)
    for policy in ("false", ""):
        _ext(db, policy=policy)
        _pushed(db, "2026-01-01T00:00:00Z")
        assert _xcode(db, _local(), item=("lock", "unlock")) == "service_identity_policy_default"
        assert _audit(db, "identity.service_identity.refused")[-1]["reason"] == "policy_default"


@pytest.mark.parametrize("age_s,fresh", [(0, True), (59, True), (si.POLICY_REPORT_MAX_AGE_S, True), (si.POLICY_REPORT_MAX_AGE_S + 1, False),
                                         (3600, False), (-si.POLICY_REPORT_SKEW_S, True), (-si.POLICY_REPORT_SKEW_S - 1, False)])
def test_the_freshness_window(db, age_s, fresh):
    _pushed(db, _iso(NOW - timedelta(seconds=age_s)))
    with db.connection(mode="read") as conn:
        assert si.policy_report_fresh(conn, now=NOW) is fresh


def test_a_push_time_without_a_zone_is_read_as_utc_and_an_empty_one_is_stale(db):
    _pushed(db, (NOW - timedelta(seconds=30)).replace(tzinfo=None).isoformat())
    with db.connection(mode="read") as conn:
        assert si.policy_report_fresh(conn, now=NOW) is True
    _pushed(db, "")
    with db.connection(mode="read") as conn:
        assert si.policy_report_age_s(conn) is None and si.policy_report_fresh(conn) is False


def test_a_window_bounded_by_a_few_missed_pushes():
    # the bridge pushes every 60 s (const.DIRECTORY_INTERVAL_S); the window tolerates a few missed pushes, never hours
    assert 60 < si.POLICY_REPORT_MAX_AGE_S <= 600 and 0 <= si.POLICY_REPORT_SKEW_S <= 120


# ---------------------------------------------------------------- 2. positive: restricted AND current = admitted

@pytest.mark.parametrize("feature,service,item", EXT_ITEMS)
def test_a_current_restricted_report_admits_each_extended_item(db, feature, service, item):
    _seed(db)
    _ext(db, policy="true")
    _pushed(db, now_iso())
    assert _xsubject(db, _local(), feature=feature, service=service, item=item)["user_id"] == SID
    assert _audit(db, "identity.service_identity.extended")[-1]["decision"] == "allowed"


def test_the_refusal_recovers_once_the_bridge_pushes_again(db):
    _seed(db)
    _ext(db, policy="true")
    _pushed(db, "2026-01-01T00:00:00Z")
    assert _xcode(db, _local(), item=("lock", "unlock")) == "service_identity_policy_default"
    assert _audit(db, "identity.service_identity.refused")[-1]["reason"] == "policy_stale"
    _pushed(db, now_iso())
    assert _xsubject(db, _local(), item=("lock", "unlock"))["user_id"] == SID


# ---------------------------------------------------------------- 3. the card

def test_the_card_names_a_stale_report_and_the_message_names_no_infrastructure_product(db):
    _seed(db)
    _ext(db, policy="true")
    with db.connection() as conn:
        set_setting(conn, "bridge.paired_at", now_iso())
    _pushed(db, "2026-01-01T00:00:00Z")
    with db.connection(mode="read") as conn:
        st = si.status(conn)
    codes = {s["code"] for s in st["steps"]}
    assert st["extended"]["service_policy_restricted"] is True and st["extended"]["service_policy_fresh"] is False
    assert "service_policy_stale" in codes and "service_policy_default" not in codes
    _pushed(db, now_iso())
    with db.connection(mode="read") as conn:
        st = si.status(conn)
    assert st["extended"]["service_policy_fresh"] is True and "service_policy_stale" not in {s["code"] for s in st["steps"]}
    text = si.STALE_MESSAGE
    assert "Home Assistant" not in text and "תשתית המערכת" in text and text != si.MESSAGES["service_identity_policy_default"]
    for s in json.loads(json.dumps(st["steps"])):
        assert "Home Assistant" not in s.get("he", "")
