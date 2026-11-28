"""FIX-SECURITY2-2570 - deep review 2.57 SA2-04: a refusal a handler raises by hand is audited like `rbac.require`'s.

`rbac.require` writes the `denied` audit row of every refusal; a handler that decides by itself (`authorize`, `permissions_anywhere`, an
ownership or a domain check) and raises its own 403 wrote nothing, so a person probing door automations, another user's playback group, a
lock's activity ... left no trace in the audit log. Such handlers now raise through `rbac.audited_refusal` (the same answer as before, plus
the row). Proven here:

- the helper writes the `denied` row and returns the error unchanged;
- a sample of the fixed routes (user without any binding): the answer is the 403 of before AND the audit log holds its `denied` row;
- a RATCHET over routers/: the hand-written 403s (`raise forbidden(` / `ApiError(403`) with no audit call in the six lines before them
  (an `audit...(` / `...refus...(` / `denied(` helper) may only become fewer, per file. The places still counted are not permission
  refusals (a wrong code, a step-up challenge, "only for Arx users", a transport / CSRF rule, a feature switch, a configuration state),
  are audited by an enclosing context (routers/automations.py scene capture: `with w.audited(...)`), or sit in files other 2.57 rows
  were changing at the time (listed in docs/changes/FIX-SECURITY2-2570.md). A new un-audited 403 fails this test: raise it through
  `rbac.audited_refusal` (or `rbac.require`), or - when it is not a permission refusal - raise the file's number here with a reason.
"""
from __future__ import annotations

import re
import types
from collections import Counter
from pathlib import Path

import pytest
from conftest import as_user

from smplwise.db import Database
from smplwise.errors import ApiError, forbidden
from smplwise.rbac import Principal
from smplwise.services import playback_groups as pg

API = "/api/v1"
ROUTERS = Path(__file__).resolve().parents[1] / "smplwise" / "routers"

# ---------------------------------------------------------------- the helper


def test_helper_audits_and_returns_the_same_error(settings, client):
    from smplwise.rbac import audited_refusal  # imported here: the route tests below also run against a tree without the helper

    client.get(f"{API}/me", headers=as_user("eve"))
    db = Database(settings.db_path)
    exc = forbidden("נבדק.", permission="x.y")
    who = Principal(user_id="dev-eve", username="eve", display_name="eve", source="ingress")
    with db.connection() as conn:
        out = audited_refusal(conn, who, exc, action="x.y", resource_type="thing", resource_id="t1", reason="not_owner", details={"k": 1})
    assert out is exc and out.status == 403 and out.code == "forbidden"
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT actor_username, action, decision, resource_type, resource_id, reason, details_json FROM audit_log WHERE action = 'x.y'").fetchone()
    assert tuple(row) == ("eve", "x.y", "denied", "thing", "t1", "not_owner", '{"k": 1}')


# ---------------------------------------------------------------- fixed routes: the 403 of before, now with its audit row


def _denied(settings, action: str) -> list[tuple]:
    with Database(settings.db_path).connection(mode="read") as conn:
        return [tuple(r) for r in conn.execute(
            "SELECT action, resource_type, resource_id, reason FROM audit_log WHERE decision = 'denied' AND actor_username = 'eve' AND action = ?", (action,))]


@pytest.mark.parametrize(("method", "path", "action"), [
    ("GET", "/door-automations", "access.doors.automate"),                                      # SA2-04 row 1 (the list)
    ("GET", "/door-automations/da_" + "0" * 32, "access.doors.automate"),                        # SA2-04 row 1 (one block)
    ("GET", "/wall/alerts", "wall.view"),                                                        # SA2-04 row 2
    ("GET", "/plan-view/prefs", "map.read"),                                                     # sweep
    ("GET", "/doors/emergency/state", "access.read"),                                            # sweep
    ("GET", "/doors/emergency/incidents/inc1", "access.emergency.lock"),                         # sweep
])
def test_fixed_route_refusal_is_audited(settings, client, method, path, action):
    client.get(f"{API}/me", headers=as_user("eve"))  # a known user without any binding
    before = len(_denied(settings, action))
    r = client.request(method, f"{API}{path}", headers=as_user("eve"))
    assert r.status_code == 403, r.text
    rows = _denied(settings, action)
    assert len(rows) == before + 1, rows  # exactly the one row of this refusal


def test_another_users_playback_group_is_an_audited_403(settings, client, monkeypatch):
    """SA2-04 (another user's playback: the group routes; the single-session route is in a file another row was changing)."""
    client.get(f"{API}/me", headers=as_user("eve"))
    monkeypatch.setitem(pg.GROUPS, "grp-other", types.SimpleNamespace(id="grp-other", user_id="dev-someone-else"))
    r = client.get(f"{API}/playback/groups/grp-other", headers=as_user("eve"))
    assert r.status_code == 403 and r.json()["code"] == "forbidden", r.text
    assert _denied(settings, "video.playback") == [("video.playback", "playback_group", "grp-other", "not_owner")]


# ---------------------------------------------------------------- the ratchet

_RAISE = re.compile(r"raise forbidden\(|ApiError\(\s*403\b")
_AUDITED = re.compile(r"audit\w*\(|refus\w*\(|\bdenied\(")

# Un-audited hand-written 403s per router file after FIX-SECURITY2-2570 (2.57; 56 before it). May only go DOWN.
BASELINE: dict[str, int] = {
    "access_control_profiles.py": 1,  # WisKey itself refused the read (a state of the remote system)
    "alarm.py": 1,  # a wrong code (its attempt is audited through `failed(...)` just above)
    "automations.py": 1,  # scene capture: audited by the enclosing `with w.audited("automation.capture", ...)`
    "bulk_people.py": 1,  # interactive (browser) sessions only - a channel rule
    "calendar_feeds.py": 1,  # a feed's remote switch from the remote channel - local only
    "devices.py": 1,  # identity_unmapped (no Home Assistant identity to act as)
    "ha.py": 2,  # identity_unmapped; another user's action poll - ha.py was another 2.57 row's file (listed in the change note)
    "home_wall_events.py": 3,  # wall-panel-only, the calendar module off for the panel, family calendars only - policy, not permission
    "local_identity.py": 4,  # the public sign-in guards (feature off, https, CSRF) and "own password only"
    "local_passkeys.py": 2,  # "Arx users only" (self-service)
    "local_privacy.py": 1,  # "Arx users only" (self-service)
    "multimedia.py": 1,  # identity_unmapped
    "playback.py": 1,  # another user's playback session - another 2.57 row's file (listed in the change note)
    "presence.py": 1,  # another 2.57 row's file (listed in the change note)
    "schedules.py": 1,  # a malformed alarm code = a wrong code
    "search.py": 1,  # the global search switched off / not for this role (a feature setting)
    "second_factor.py": 1,  # a step-up challenge (the proof is asked for, not refused)
    "service_identity.py": 2,  # defence in depth after an audited `require`: never for an Arx-only identity
    "system_update.py": 1,  # cross-site request (CSRF)
    "tickets_budgets.py": 1,  # tickets: another 2.57 row's area (listed in the change note)
    "tickets_contacts.py": 1,  # tickets: another 2.57 row's area (listed in the change note)
    "tickets_rfq.py": 1,  # tickets: another 2.57 row's area (listed in the change note)
    "views.py": 3,  # saved views - another 2.57 row's file (listed in the change note)
    "wall.py": 2,  # the profile does not allow acknowledging; a photo folder outside the system's - configuration / validation
}


def unaudited(root: Path = ROUTERS) -> Counter:
    out: Counter = Counter()
    for f in sorted(root.rglob("*.py")):
        lines = f.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            if _RAISE.search(line) and not _AUDITED.search("\n".join(lines[max(0, i - 6):i + 1])):
                out[f.relative_to(root).as_posix()] += 1
    return out


def test_ratchet_unaudited_hand_written_403s_only_go_down():
    now = unaudited()
    grown = {f: (n, BASELINE.get(f, 0)) for f, n in now.items() if n > BASELINE.get(f, 0)}
    assert not grown, (
        "a hand-written 403 without an audit row (file: (now, allowed)): " + repr(grown)
        + " - raise it through rbac.audited_refusal (or rbac.require); if it is not a permission refusal, raise the number in BASELINE with a reason"
    )
    assert sum(now.values()) <= sum(BASELINE.values())


def test_ratchet_counter_sees_a_new_unaudited_403(tmp_path):
    """The counter itself: an un-audited raise counts, one behind an audit call does not."""
    (tmp_path / "r.py").write_text(
        "def a(conn, p):\n    if not ok:\n        raise forbidden(permission='x')\n\n\n\n\n\n\n\n"
        "def b(conn, p):\n    if not ok:\n        raise audited_refusal(conn, p, ApiError(403, 'forbidden', 'x'), action='x')\n",
        encoding="utf-8")
    assert unaudited(tmp_path) == Counter({"r.py": 1})
    assert isinstance(ApiError(403, "forbidden", "x"), ApiError)
