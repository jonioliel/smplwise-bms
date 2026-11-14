"""CR-021 S4 security hardening: the downgrade guard. The store's version counts as an update only when it is a strictly higher
release than the installed one, whatever the infrastructure's own `update_available` flag says. Fake Supervisor only."""
from __future__ import annotations

import pytest
from test_self_update import NEWER, sup, world  # noqa: F401 - fixtures
from test_self_update_s3 import apply_body, audit_rows, j, rig  # noqa: F401 - fixtures / helpers

from smplwise import __version__
from smplwise.services import self_update


@pytest.mark.parametrize(("latest", "installed", "newer"), [
    ("2.4.3", "2.4.2", True),
    ("2.10.0", "2.9.9", True),     # numbers, not text
    ("3", "2.99.99", True),
    ("2.4.2.1", "2.4.2", True),
    ("2.4.2", "2.4.2", False),
    ("2.4.1", "2.4.2", False),
    ("0.1.999", "2.4.2", False),   # an old line offered by a rolled-back or tampered store
    ("2.4.2-1", "2.4.2", False),   # equal release with a suffix: fail closed
    ("v2.5.0", "2.4.2", False),    # no leading number: fail closed
    ("", "2.4.2", False),
    ("2.5.0", "", False),
])
def test_is_newer(latest, installed, newer):
    assert self_update.is_newer(latest, installed) is newer


def test_parse_info_ignores_the_infrastructure_flag_for_an_older_version():
    info = self_update.parse_info({"version": "2.4.2", "version_latest": "2.4.1", "update_available": True})
    assert info is not None and info.update_available is False
    info = self_update.parse_info({"version": "2.4.2", "version_latest": "2.4.3", "update_available": True})
    assert info is not None and info.update_available is True
    info = self_update.parse_info({"version": "2.4.2", "version_latest": "2.4.3", "update_available": False})
    assert info is not None and info.update_available is False, "the infrastructure's 'no' still wins"


def test_check_does_not_offer_an_older_store_version(world, sup):  # noqa: F811
    _, c = world
    sup.latest = "0.0.1"  # the fake infrastructure answers update_available: true (latest != installed)
    r = j(c, "post", "/check")
    assert r.status_code == 200
    body = j(c, "get", "/state").json()
    assert body["update_available"] is False


def test_apply_refuses_a_downgrade_and_writes_no_run(rig, sup):  # noqa: F811
    app, c, *_ = rig
    sup.latest = "0.0.1"
    r = j(c, "post", "/apply", json=apply_body(target="0.0.1"))
    assert r.status_code == 409 and r.json()["code"] == "update_not_available"
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM update_runs").fetchone()[0] == 0
    assert not [a for a in audit_rows(app) if a["decision"] == "allowed" and a["action"] == "system.update.apply"]
    assert not [p for m, p in sup.log if m == "POST" and p.endswith("/update")], "nothing was sent to the infrastructure"


def test_the_test_suite_newer_version_is_really_newer():
    assert self_update.is_newer(NEWER, __version__), "tests/test_self_update.py NEWER must stay above the running version"
