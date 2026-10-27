"""T06-ADMIT-295 (FAKES ONLY): identity + role + scope -> admission, for EVERY signed WisKey command the 2.19.0 candidate (release/2190) can send.

What is proven, per command family (the table with the test ids is docs/changes/T06-ADMISSION-MAPPING-295.md):
- a caller without the permission is refused BEFORE anything is signed or sent (the recorder behind the gate is never touched);
- an operator holding the permission on the right station / scope is admitted (the recorder is touched once, for exactly that command);
- a caller holding the permission on ANOTHER station (or a station-scoped grant used where the installation is needed) is refused;
- a revoked grant, an expired grant and an explicit deny are refused;
- the identity is mapped: a non-interactive principal, a non-person source, an inactive user and a wall account never reach a signing seam; the
  local (Arx-only) identity is refused while the extended mode is locked (the in-candidate form of the local-identity exception; EMROLE itself,
  pilot/EMROLE-295, is NOT in this candidate - see the change note).

Nothing here contacts WisKey, Home Assistant, a station, a door or a network. The "wire" is a recorder (a stub direct join, FakeDirectPort, the
fake trusted bridge). The signer is never given a command by a refused caller.

Gaps found while mapping are pinned as strict xfails (a gap that closes turns the xfail into a failure, so the note and the code cannot drift):
see the FINDING-* tests at the end."""
from __future__ import annotations

import ast
import asyncio
import json
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
import test_wkcap_295 as wk
import wkcap_fakes as wf
from conftest import as_user
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_writes_s11 import API as S11_API  # noqa: F401
from test_intercom_writes_s11 import env as s11_env
from test_intercom_writes_s11 import person as s11_person
from test_intercom_writes_s11 import rev as s11_rev
from test_intercom_writes_s11 import sent as s11_sent
from test_intercom_writes_s11 import wx  # noqa: F401 - a fixture
from test_wiskey_door_path import DOCK, ENTRY, SIDE, API, _clean, bind_raw, env, map_all, world  # noqa: F401 - fixtures / helpers
from test_wiskey_door_path import signed  # noqa: F401 - a fixture
from wkcap_fakes import FakeDirectPort

from smplwise import rbac
from smplwise.db import Database, new_id, now_iso, permission_revision, set_setting
from smplwise.rbac import INSTALLATION, STATION, Principal
from smplwise.routers import access as access_router
from smplwise.services import capture_lease as cl
from smplwise.services import door_authority
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_media as im
from smplwise.services import intercom_sync, lease_events as le
from smplwise.services import service_identity as si
from smplwise.services import wiskey_capture_direct as cd
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_emergency_direct as ed
from smplwise.services import wiskey_feature_direct as fd
from smplwise.services import wiskey_feature_exec as fx
from smplwise.services import wiskey_media_contract as w10
from smplwise.services import wiskey_native_write as nw
from smplwise.services import wiskey_template_direct as td

BACKEND = Path(__file__).resolve().parents[1]
SERVICES = BACKEND / "smplwise" / "services"
ROUTERS = BACKEND / "smplwise" / "routers"
DOC = BACKEND.parents[1] / "docs" / "changes" / "T06-ADMISSION-MAPPING-295.md"

# ======================================================================================================================================
# The table. EVERY signed command of the candidate has exactly one row: (family, gate, Arx permission, scope check).
# `test_every_signed_command_in_the_code_has_a_row_and_a_documented_gate` derives the command set from the code and fails on a command
# without a row, so a new command cannot be added without a decision here.
# ======================================================================================================================================
PEOPLE = "people_write"
CAPTURE = "capture"
FEATURE = "feature"
MEDIA = "media"
DOOR = "door"
SYSTEM = "system"
TEMPLATE = "template"

TABLE: dict[str, tuple[str, str, str, str]] = {
    # people writes (native writer): route gate (iw.gate_*) + people_send -> arx_decision on every station + interactive human actor
    "users/create": (PEOPLE, "G-PEOPLE", "access.people.manage", "every station the draft names (installation when it names none)"),
    "users/update": (PEOPLE, "G-PEOPLE", "access.people.manage", "every station of the person before and after the patch"),
    "users/set_active": (PEOPLE, "G-PEOPLE", "access.people.manage", "every station of the person"),
    "users/archive": (PEOPLE, "G-PEOPLE", "access.people.manage", "every station of the person"),
    "users/unarchive": (PEOPLE, "G-PEOPLE", "access.people.manage", "every station of the person"),
    "users/temporary_cancel": (PEOPLE, "G-PEOPLE", "access.people.manage", "every station of the person"),
    "users/delete": (PEOPLE, "G-PEOPLE", "access.people.manage", "every station of the person"),
    "cards/add": (PEOPLE, "G-PEOPLE", "access.people.manage + access.people.sensitive", "every station of the person"),
    "cards/remove": (PEOPLE, "G-PEOPLE", "access.people.manage + access.people.sensitive", "every station of the person"),
    # commands of the same write that ride the writer's own lineage (no operator input of their own)
    "peer_writes/source_v1": (PEOPLE, "G-WRITER-INTERNAL", "(none of its own: sent only inside an admitted write)", "the write's own scope"),
    "peer_bindings/get": (PEOPLE, "G-WRITER-INTERNAL", "(none of its own: recovery read)", "the write's own scope"),
    "peer_receipts/resolve": (PEOPLE, "G-WRITER-INTERNAL", "(none of its own: read of ONE stored original)", "the stored original"),
    "users/name_ref_prepare_v1": (PEOPLE, "G-NONE-NO-CALLER", "NONE (NativePeopleWriter.rename takes no decision)", "none - no product caller"),
    "users/name_ref_apply_v1": (PEOPLE, "G-NONE-NO-CALLER", "NONE (NativePeopleWriter.rename takes no decision)", "none - no product caller"),
    "users/bulk_receipt": (PEOPLE, "G-NONE-NO-CALLER", "NONE (resolve_name_ref reads a stored operation)", "none - no product caller"),
    # capture lease (signed lease messages): unreachable in this build (GO_LIVE_PERMITTED False); the decision is taken again in _lease_redecide
    "capture/lease_request": (CAPTURE, "G-CAPTURE-LEASE", "access.cards.capture + access.people.manage", "the reader's station and every station of the person"),
    "capture/lease_event": (CAPTURE, "G-LEASE-SYSTEM", "(system: lease worker; permission revision / authority epochs revoke leases)", "the lease"),
    # the six WisKey feature adapters on the direct transport
    "features/status": (FEATURE, "G-FEATURE-READ", "(read of the host's capability list; no operator)", "none"),
    "features/start": (FEATURE, "G-FEATURE", "per feature: see ARX_PERMISSION_OF", "per feature: every station of the request (station features) / installation"),
    "features/prepare_media": (FEATURE, "G-FEATURE", "access.stations.read / access.call", "every station of the request"),
    "features/result": (FEATURE, "G-FEATURE-READ", "(completion read of an operation_ref Arx stored; no permission renewed)", "the stored operation"),
    "features/cancel": (FEATURE, "G-FEATURE-READ", "(cancel of an operation_ref Arx stored)", "the stored operation"),
    "features/media_ingress_v1": (FEATURE, "G-FEATURE", "(ticket of an admitted prepare_media)", "the prepared ticket"),
    # media bridge (video, talk): route gate before the provider is touched
    "media/station_descriptor": (MEDIA, "G-MEDIA-ROUTE", "access.read (+ video.live for the live socket)", "the station chain"),
    "media/stream_lease": (MEDIA, "G-MEDIA-ROUTE", "access.read + video.live", "the station chain"),
    "media/talk_open": (MEDIA, "G-MEDIA-ROUTE", "access.call", "the station chain"),
    "media/talk_frame": (MEDIA, "G-MEDIA-ROUTE", "access.call (re-checked by TalkLease)", "the station chain"),
    "media/talk_floor": (MEDIA, "G-MEDIA-ROUTE", "access.call (re-checked by TalkLease)", "the station chain"),
    "media/talk_close": (MEDIA, "G-MEDIA-ROUTE", "(closes the caller's own session)", "the session"),
    # door
    "door_open": (DOOR, "G-DOOR", "access.doors.open (legacy access.release) or door.unlock on the lock entity", "the station chain (+ the mapped lock entity)"),
    "door_open_status": (DOOR, "G-DOOR-STATUS", "(read of a request id Arx recorded)", "the recorded request"),
    # WhatsApp templates on the direct transport: no product caller
    "whatsapp/template_send_v1": (TEMPLATE, "G-NONE-NO-CALLER", "NONE (TemplateSender.send takes ids only)", "none - no route calls it"),
    "whatsapp/template_send_v2": (TEMPLATE, "G-NONE-NO-CALLER", "NONE (DirectTemplateTransport.send_v2)", "none - no route calls it"),
    # session
    "direct/connect": (SYSTEM, "G-SESSION", "(service identity: the pairing key signs; no operator)", "the pairing"),
    "overview": (SYSTEM, "G-NATIVE-METADATA", "paired system metadata; closed feed projection", "original authenticated HA user + pairing"),
    "subscribe": (SYSTEM, "G-NATIVE-METADATA", "paired data-free refresh subscription", "original authenticated HA connection"),
    "authorization/session": (SYSTEM, "G-NATIVE-METADATA", "own Native session metadata", "original authenticated HA user"),
    # REL2210 (2.21.0): WKR5ADOPT-295 W-006, the WisKey-verified people CSV (switch access.people_csv_preview, default off)
    "features/people_csv_preview": (FEATURE, "G-PEOPLE-CSV", "access.people.manage (preview, interactive); system administrator (confirm, interactive)",
                                    "the installation (people/write)"),
    # WISKEY-OWNER26-297 (W-023): the door-window program engine on the Native hold-open programs (door-windows routes admit the person first;
    # the factory hands the engine out only when live_ready(), LIVE_ENGINE_BUILT False in this build)
    "stations/technical_program_list": (DOOR, "G-DOOR-WINDOWS", "access.windows.manage (door-windows routes / watchdog of an admitted rule)", "the door's station chain"),
    "stations/technical_program_save": (DOOR, "G-DOOR-WINDOWS", "access.windows.manage (door-windows routes / watchdog of an admitted rule)", "the door's station chain"),
    "stations/technical_program_action": (DOOR, "G-DOOR-WINDOWS", "access.windows.manage (door-windows routes / watchdog of an admitted rule)", "the door's station chain"),
}

# the WisKey permission strings of the six features and the Arx permission(s) that grant each
FEATURE_PERMISSIONS = fx.ARX_PERMISSION_OF


def inventory() -> set[str]:
    """Every signed command name the code can put on the wire, derived from the code (not from this file)."""
    names: set[str] = set()
    names |= set(nw.ACTIONS)
    names |= {nw.SOURCE_COMMAND, nw.READ_BINDING_COMMAND, nw.RESOLVE_COMMAND, nw.NAME_REF_PREPARE, nw.NAME_REF_APPLY, nw.BULK_RECEIPT}
    names |= {cd.EVENT_COMMAND, cd.REQUEST_COMMAND}
    names |= set(fd.COMMANDS) | {join.MEDIA_INGRESS_COMMAND}
    names |= set(w10.COMMANDS)
    names |= {td.V1_COMMAND, td.V2_COMMAND}
    from smplwise.services.wiskey_native_feed import METADATA_READS
    names |= {"direct/connect"} | METADATA_READS
    from smplwise.services import wiskey_people_csv as pcsv
    from smplwise.services import wiskey_peer_query as pq
    from smplwise.services import wiskey_peer_registry as pr

    names |= {pcsv.COMMAND, pq.COMMAND, pr.LiveRegistryTransport.COMMAND}  # REL2210: W-006, PEERQUERY, WK4ADOPT W-010
    from smplwise.services import wiskey_program_direct as wpd

    names |= set(wpd.COMMANDS)  # WISKEY-OWNER26-297 W-023
    from smplwise.services import trusted_door

    names |= {"door_open", "door_open_status"}
    assert trusted_door.PROTOCOL  # the two door actions are the only ones the trusted-door signer admits
    return names


# ======================================================================================================================================
# helpers
# ======================================================================================================================================

def raw_grant(db: Database, user: str, role: str, scope_type: str, scope_id: str, *, effect: str = "allow", revoked: bool = False,
              expired: bool = False) -> None:
    """A binding written straight into the table (the API refuses some shapes the tests need): optionally revoked or already expired."""
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    with db.connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at, expires_at, revoked_at)"
            " VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?, ?, ?)",
            (new_id(), f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso(), past if expired else None, past if revoked else None))


def ensure_user(client: Any, name: str) -> None:
    client.get("/api/v1/me", headers=as_user(name))


# ======================================================================================================================================
# 0. the inventory is complete and documented
# ======================================================================================================================================

def test_every_signed_command_in_the_code_has_a_row_and_a_documented_gate():
    found = inventory()
    assert found - set(TABLE) == set(), f"a signed command without an admission row: {sorted(found - set(TABLE))}"
    assert set(TABLE) - found == set(), f"a row for a command the code no longer has: {sorted(set(TABLE) - found)}"
    # the feature layer's WisKey permission strings are covered by the policy-matrix test below
    assert set(FEATURE_PERMISSIONS) == {"door/pulse", "door/hold_open", "door/restore", "door/emergency_secure", "door/emergency_open", "door/emergency_release",
                                        "media/video_receive", "media/audio_receive", "media/microphone_send", "people/write", "validation/run",
                                        "validation/identity", "validation/door_capabilities", "validation/door_read", "validation/media"}


def test_the_change_note_lists_every_command_and_every_gate():
    text = DOC.read_text(encoding="utf-8")
    for command, (_family, gate, _perm, _scope) in TABLE.items():
        assert f"`{command}`" in text, f"{command} is missing from {DOC.name}"
        assert gate in text, gate
    for wiskey_permission in FEATURE_PERMISSIONS:
        assert f"`{wiskey_permission}`" in text, wiskey_permission


def test_the_only_modules_that_reach_a_signing_call_are_the_known_ones():
    """The transport signs whatever it is given (no allow-list, no identity): admission lives in the callers. So the set of modules that call the
    signing seam is pinned; a new caller is a new admission decision and must be added here (and to the table) on purpose."""
    pattern = re.compile(r"\.send_signed\(|\.call_command\(|\bport\.call\(|session\.call\(|\.command_proof\(|\.signed_body\(|\blink\.call\(")
    callers = {p.name for p in sorted(SERVICES.rglob("*.py")) + sorted(ROUTERS.rglob("*.py")) if pattern.search(p.read_text(encoding="utf-8"))}
    # REL2210 (2.21.0) additions, each an admission decision recorded in docs/changes/T06-ADMISSION-MAPPING-295.md ("REL2210 addendum"):
    # wiskey_peer.py (WK4ADOPT W-010 `peer_read`, behind wiskey.peer_receipt + owner pin), wiskey_peer_query.py (PEERQUERY, system.configure),
    # wiskey_people_csv.py (WKR5ADOPT W-006, G-PEOPLE-CSV); wiskey_capture_map.py only NAMES `port.call(` in its docstring (no call).
    assert callers == {"intercom_media.py", "wiskey_capture_direct.py", "wiskey_capture_port.py", "wiskey_direct_join.py", "wiskey_feature_direct.py",
                       "wiskey_media_bridge.py", "wiskey_native_write.py", "wiskey_talk_pump.py", "wiskey_template_direct.py",
                       "wiskey_capture_map.py", "wiskey_peer.py", "wiskey_peer_query.py", "wiskey_people_csv.py", "wiskey_native_feed.py",
                       "wiskey_program_direct.py"}, callers  # WISKEY-OWNER26-297: G-DOOR-WINDOWS (W-023)


def test_no_router_reaches_a_writer_or_an_adapter_except_through_the_join():
    """Routers (the HTTP admission layer) import the join's `people_send`, never the writer / feature / template / capture adapters directly."""
    forbidden = ("wiskey_native_write", "wiskey_feature_direct", "wiskey_feature_exec", "wiskey_template_direct", "wiskey_capture_direct", "wiskey_emergency_direct")
    for path in sorted(ROUTERS.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            names: list[str] = []
            if isinstance(node, ast.ImportFrom):
                names = [a.name for a in node.names] + [node.module or ""]
            elif isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            if (path.name == "wiskey_lineage.py" and isinstance(node, ast.ImportFrom) and (node.module or "").endswith("wiskey_native_write")
                    and [a.name for a in node.names] == ["NativeWriteError"]):
                continue  # REL2210: the lineage admin router (WKR5 unit C) imports the writer's ERROR class only; its I/O goes through the join
            for n in names:
                assert not any(f in n for f in forbidden), f"{path.name} imports {n}"


# ======================================================================================================================================
# 1. people writes: the service seam (people_send / arx_decision) - nine commands x the principal matrix
# ======================================================================================================================================

class StubJoin:
    """What `wiskey_direct_join.people_send` needs of an installed join; its native_write is the RECORDER behind the gate."""

    lineage = object()
    audit_for = None

    def __init__(self) -> None:
        self.calls: list[SimpleNamespace] = []

    def selected(self, command: str | None = None) -> bool:  # REL2210: the join selects per command (WKR5 unit A)
        return True

    async def native_write(self, command: str, business: Any, *, actor: Any, decision: Any, create_origin_ref: Any, audit_sink: Any = None) -> tuple[Any, Any]:
        self.calls.append(SimpleNamespace(command=command, business=dict(business), actor=actor, decision=decision, create_origin_ref=create_origin_ref))
        return SimpleNamespace(state="committed", code=None, user_id="u", person_revision=2), {"id": "u", "revision": 2}


@pytest.fixture()
def stub_join():
    saved = join.JOIN
    stub = StubJoin()
    join.JOIN = stub  # type: ignore[assignment]
    yield stub
    join.JOIN = saved


@pytest.fixture()
def svc(settings):
    """An app (migrations) + users: sysadm (system_admin, installation), mia (site_admin on st-a), otto (operator), vera (viewer),
    rita (site_admin on st-a, REVOKED), eli (site_admin on st-a, EXPIRED), dan (site_admin installation + explicit deny on st-a)."""
    e = wk.Env(settings)
    db = e.db
    for name in ("sysadm", "mia", "otto", "vera", "rita", "eli", "dan", "nobody"):
        ensure_user(e.c, name)
    raw_grant(db, "sysadm", "system_admin", "installation", "*")
    raw_grant(db, "mia", "site_admin", STATION, "st-a")
    raw_grant(db, "otto", "operator", "installation", "*")
    raw_grant(db, "vera", "viewer", "installation", "*")
    raw_grant(db, "rita", "site_admin", STATION, "st-a", revoked=True)
    raw_grant(db, "eli", "site_admin", STATION, "st-a", expired=True)
    raw_grant(db, "dan", "site_admin", "installation", "*")
    raw_grant(db, "dan", "site_admin", STATION, "st-a", effect="deny")
    e.settings = settings
    return e


def principal(name: str, source: str = "dev", via: str = "") -> Principal:
    return Principal(f"dev-{name}", name, name, source, via=via)


BUSINESS = {
    "users/create": {"data": {"display_name": "T06", "employee_no": "t06"}, "sync_now": True},
    "users/update": {"user_id": "u6", "revision": 3, "data": {"display_name": "T06"}, "sync_now": True},
    "users/set_active": {"user_id": "u6", "revision": 3, "active": False},
    "users/archive": {"user_id": "u6", "revision": 3, "confirmed": True},
    "users/unarchive": {"user_id": "u6", "revision": 3, "confirmed": True},
    "users/temporary_cancel": {"user_id": "u6", "revision": 3, "reason_code": "visit_completed"},
    "users/delete": {"user_id": "u6", "revision": 3},
    "cards/add": {"user_id": "u6", "revision": 3, "data": {"card_no": "T06CARD", "label": "", "card_type": "normalCard", "enabled": True}},
    "cards/remove": {"user_id": "u6", "revision": 3, "card_id": "card-x"},
}
assert set(BUSINESS) == set(nw.ACTIONS), "every native people-write command has a business body here"


def run_people_send(svc: Any, who: Principal, command: str, targets: list[tuple[str, str]]) -> tuple[bool, str | None]:
    """Returns (admitted, refusal code). The recorder is `stub_join.calls`."""
    with svc.db.connection() as conn:
        send = join.people_send(conn, who, command, BUSINESS[command], targets=targets, create_origin_ref="arx-create:t06" if command == "users/create" else None)
    assert send is not None
    try:
        asyncio.run(send(None))
    except intercom_sync.NotSent as exc:
        return False, str(exc)
    return True, None


@pytest.mark.parametrize("command", sorted(nw.ACTIONS))
def test_people_send_admits_a_manager_of_the_right_station_and_nobody_else(svc, stub_join, command):
    st_a = [(STATION, "st-a")]
    admitted = {
        "mia": run_people_send(svc, principal("mia"), command, st_a),  # right station
        "sysadm": run_people_send(svc, principal("sysadm"), command, [INSTALLATION]),  # installation (the unrestricted shortcut)
    }
    assert [v for v in admitted.values()] == [(True, None), (True, None)], admitted
    assert [c.command for c in stub_join.calls] == [command, command]
    decision = stub_join.calls[0].decision
    assert decision.grant_id and decision.permission_revision >= 0 and stub_join.calls[0].actor.user_id == "dev-mia" and stub_join.calls[0].actor.session_active is True
    stub_join.calls.clear()
    # refused: nothing reaches the writer, i.e. nothing is signed
    refused = {
        "no permission (operator)": run_people_send(svc, principal("otto"), command, st_a),
        "no permission (viewer)": run_people_send(svc, principal("vera"), command, st_a),
        "no binding at all": run_people_send(svc, principal("nobody"), command, st_a),
        "wrong station": run_people_send(svc, principal("mia"), command, [(STATION, "st-b")]),
        "one right + one wrong station": run_people_send(svc, principal("mia"), command, [(STATION, "st-a"), (STATION, "st-b")]),
        "station grant used at the installation": run_people_send(svc, principal("mia"), command, [INSTALLATION]),
        "revoked grant": run_people_send(svc, principal("rita"), command, st_a),
        "expired grant": run_people_send(svc, principal("eli"), command, st_a),
        "explicit deny wins over an installation allow": run_people_send(svc, principal("dan"), command, st_a),
    }
    for case, outcome in refused.items():
        assert outcome == (False, "rbac_denied"), (case, outcome)
    assert stub_join.calls == [], "a refused caller never reaches the writer"


@pytest.mark.parametrize("command", sorted(nw.ACTIONS))
def test_people_send_refuses_a_principal_that_is_not_an_interactive_human(svc, stub_join, command):
    """A bearer-token client / internal principal holds the grant but is not a person at a session: the writer's contract needs a human actor."""
    st_a = [(STATION, "st-a")]
    for who in (principal("mia", "remote", "bearer"), principal("mia", "internal"), principal("mia", "system"), principal("mia", "push"), principal("mia", "device")):
        assert run_people_send(svc, who, command, st_a) == (False, "actor_session_inactive"), who.source
    assert stub_join.calls == []
    assert run_people_send(svc, principal("mia", "remote", "cookie"), command, st_a) == (True, None), "an Arx sign-in session in a browser is a person"
    assert run_people_send(svc, principal("mia", "ingress"), command, st_a) == (True, None)


def test_an_inactive_user_holds_nothing(svc, stub_join):
    with svc.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-mia'")
    assert run_people_send(svc, principal("mia"), "users/update", [(STATION, "st-a")]) == (False, "rbac_denied")
    assert stub_join.calls == []


def test_the_native_decision_is_fresh_and_refuses_an_empty_target_list(svc):
    with svc.db.connection() as conn:
        with pytest.raises(nw.NativeWriteError, match="rbac_denied"):
            nw.arx_decision(conn, principal("sysadm"), "access.people.manage", [])
        d = nw.arx_decision(conn, principal("mia"), "access.people.manage", [(STATION, "st-a")])
        assert d.grant_id and d.decided_at.tzinfo is not None
    from smplwise.routers import access_control

    assert access_control.native_targets(None) == [INSTALLATION], "the unrestricted shortcut: the installation itself is the target"
    assert access_control.native_targets(["st-a", "st-a"]) == [(STATION, "st-a")]
    assert access_control.native_targets([]) == [INSTALLATION]


# ======================================================================================================================================
# 2. people writes: the HTTP routes end to end (the route gates choose the targets people_send judges)
# ======================================================================================================================================

def fire(c: Any, fake: Any, command: str, user: str, uid: str, n: int) -> Any:
    """One people-write request for `command` against person `uid` as `user` (create: `uid` selects the stations the draft names)."""
    h = as_user(user)
    if command == "users/create":
        stations = {"u6": ["entry-a"], "u2": ["entry-b"], "u1": ["entry-a", "entry-b"], "u4": []}[uid]
        data: dict[str, Any] = {"display_name": f"T06 {n}", "employee_no": f"t06{n:03d}"}
        if stations:
            data["permission_overrides"] = {s: "allow" for s in stations}
            data["door_permissions"] = {s: [1] for s in stations}
        return c.post(S11_API + "/people", json=s11_env(ttl=50.0, data=data), headers=h)
    rv = s11_rev(fake, uid)
    p = S11_API + f"/people/{uid}"
    if command == "users/update":
        return c.put(p, json=s11_env(ttl=50.0, data={"display_name": f"Renamed {n}"}, revision=rv), headers=h)
    if command == "users/set_active":
        return c.post(p + "/active", json=s11_env(ttl=50.0, active=False, revision=rv), headers=h)
    if command == "users/archive":
        return c.post(p + "/archive", json=s11_env(ttl=50.0, revision=rv, confirmed=True), headers=h)
    if command == "users/unarchive":
        return c.post(p + "/unarchive", json=s11_env(ttl=50.0, revision=rv, confirmed=True), headers=h)
    if command == "users/temporary_cancel":
        return c.post(p + "/temporary-cancel", json=s11_env(ttl=50.0, revision=rv, reason_code="visit_completed", confirmed=True), headers=h)
    if command == "users/delete":
        return c.post(p + "/delete", json=s11_env(ttl=50.0, revision=rv, confirmed=True), headers=h)
    if command == "cards/add":
        return c.post(p + "/cards", json=s11_env(ttl=50.0, card_no=f"T06CARD{n}", label="", revision=rv), headers=h)
    if command == "cards/remove":
        return c.post(p + "/cards/card-x/remove", json=s11_env(ttl=50.0, revision=rv, confirmed=True), headers=h)
    raise AssertionError(command)


@pytest.fixture()
def wx_stub(wx):
    fake, c, s = wx
    db = Database(s.db_path)
    for name in ("rita", "eli"):
        ensure_user(c, name)
    raw_grant(db, "rita", "site_admin", STATION, "entry-a", revoked=True)
    raw_grant(db, "eli", "site_admin", STATION, "entry-a", expired=True)
    stub = StubJoin()
    recorded: dict[str, Any] = {}

    async def native_write(command: str, business: Any, *, actor: Any, decision: Any, create_origin_ref: Any, audit_sink: Any = None) -> tuple[Any, Any]:
        stub.calls.append(SimpleNamespace(command=command, business=dict(business), actor=actor, decision=decision, create_origin_ref=create_origin_ref))
        who = business.get("user_id") or "u4"
        raw = json.loads(json.dumps(s11_person(fake, who)))
        return SimpleNamespace(state="committed", code=None, user_id=who, person_revision=raw["revision"]), raw

    stub.native_write = native_write  # type: ignore[method-assign]
    saved = join.JOIN
    join.JOIN = stub  # type: ignore[assignment]
    before = len(fake.received)
    yield fake, c, s, stub, before
    join.JOIN = saved
    del recorded


HTTP_COMMANDS = sorted(nw.ACTIONS)
WRITE_FRAMES = ("users/create", "users/update", "users/set_active", "users/archive", "users/unarchive", "users/temporary_cancel", "users/delete", "cards/add",
                "cards/remove", "cards/capture_start", "cards/capture_confirm", "cards/capture_cancel")


def write_frames(fake: Any) -> int:
    """How many WRITE commands the Home Assistant feed's fake WisKey has received (reads such as users/get are the gates' own and do not count)."""
    return sum(len(s11_sent(fake, name)) for name in WRITE_FRAMES)


@pytest.mark.parametrize("command", HTTP_COMMANDS)
def test_http_people_write_without_the_permission_is_refused_before_anything_is_signed(wx_stub, command):
    fake, c, _s, stub, _before = wx_stub
    for user in ("otto", "vera", "nobody", "rita", "eli"):  # operator, viewer, unbound, revoked grant, expired grant
        r = fire(c, fake, command, user, "u6", 1)
        assert r.status_code == 403, (user, command, r.status_code, r.text)
    assert stub.calls == [], "no native write was started"
    assert write_frames(fake) == 0, "and no write reached the Home Assistant feed either"


@pytest.mark.parametrize("command", HTTP_COMMANDS)
def test_http_people_write_scope_decides_which_persons_and_stations_are_admitted(wx_stub, command):
    fake, c, _s, stub, _before = wx_stub
    n = 10
    # mia (site_admin on entry-a only): u6 (entry-a only) is hers; u2 (entry-b only) does not exist for her; u1 (entry-a + entry-b) is seen, not changeable
    r = fire(c, fake, command, "mia", "u6", n)
    assert r.status_code == 200, (command, r.status_code, r.text)
    assert [call.command for call in stub.calls] == [command]
    assert stub.calls[0].actor.user_id == "dev-mia" and stub.calls[0].decision.grant_id
    stub.calls.clear()
    for uid in ("u2", "u1"):
        r = fire(c, fake, command, "mia", uid, n + 1)
        assert r.status_code in (403, 404), (command, uid, r.status_code, r.text)
    assert stub.calls == [], "a person off her chain, or shared with a station off it, is never written"
    # root (system_admin, installation) is unrestricted: a station-less person is admitted
    r = fire(c, fake, command, "root", "u4", n + 2)
    assert r.status_code == 200, (command, r.status_code, r.text)
    assert [call.command for call in stub.calls] == [command]
    assert write_frames(fake) == 0, "the direct path replaced the feed send: the fake WisKey saw no write frame"


# ======================================================================================================================================
# 3. door open (the signed `door_open`): one door authority, then the signer
# ======================================================================================================================================

def open_door(world: dict[str, Any], station: str, user: str, lock: int | None = None) -> Any:
    fields: dict[str, Any] = {"confirmed": True}
    if lock is not None:
        fields["lock"] = lock
    return world["c"].post(f"{API}/intercom/stations/{station}/release", json=env(**fields), headers=as_user(user))


def test_door_open_is_signed_only_for_a_holder_on_the_right_station(world, signed):
    c, db, bridge = world["c"], world["db"], signed
    for name in ("dora", "dorb", "oscar", "vic", "rev", "exp", "denny", "stranger"):
        ensure_user(c, name)
    raw_grant(db, "dora", "door_opener", STATION, ENTRY)
    raw_grant(db, "dorb", "door_opener", STATION, SIDE)
    raw_grant(db, "oscar", "operator", "installation", "*")
    raw_grant(db, "vic", "viewer", "installation", "*")
    raw_grant(db, "rev", "door_opener", STATION, ENTRY, revoked=True)
    raw_grant(db, "exp", "door_opener", STATION, ENTRY, expired=True)
    raw_grant(db, "denny", "door_opener", "installation", "*")
    raw_grant(db, "denny", "door_opener", STATION, ENTRY, effect="deny")
    sent_before = len(bridge.opens())
    refused = {
        "operator has no door permission": ("oscar", ENTRY),
        "viewer": ("vic", ENTRY),
        "unbound": ("stranger", ENTRY),
        "station grant used on another station": ("dora", SIDE),
        "the other station's holder": ("dorb", ENTRY),
        "revoked grant": ("rev", ENTRY),
        "expired grant": ("exp", ENTRY),
        "explicit deny on the station": ("denny", ENTRY),
    }
    for case, (user, station) in refused.items():
        r = open_door(world, station, user)
        assert r.status_code == 403, (case, r.status_code, r.text)
    assert len(bridge.opens()) == sent_before, "no signed door_open was built for a refused caller"
    assert not [x for x in world["executed"]], "and no `execute` either"
    # admitted: the right holder on the right station, one signed command each
    assert open_door(world, ENTRY, "dora").status_code == 200
    assert open_door(world, SIDE, "dorb").status_code == 200
    assert len(bridge.opens()) == sent_before + 2
    # the actor of each signed command is the requesting principal, not a service identity
    assert [o["message"]["actor"]["id"] for o in bridge.opens()] == ["dev-dora", "dev-dorb"]
    assert [o["message"]["station"] for o in bridge.opens()] == [ENTRY, SIDE]


def test_door_rule_maps_identity_before_permission(world, signed):
    """door_authority.check: no identified principal (`internal`/`system`/`push`/`device` sources, a developer outside developer mode), an inactive user and
    a wall account are refused whatever else they hold."""
    c, db = world["c"], world["db"]
    for name in ("walt", "ina", "sam"):
        ensure_user(c, name)
    raw_grant(db, "walt", "door_opener", "installation", "*")
    raw_grant(db, "ina", "door_opener", "installation", "*")
    raw_grant(db, "sam", "door_opener", "installation", "*")
    with db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-ina'")
        conn.execute("INSERT INTO wall_profiles(user_id, title, enabled, config_json, created_at, created_by, updated_at, updated_by) VALUES ('dev-walt', 'wall', 1, '{}', ?, 't', ?, 't')",
                     (now_iso(), now_iso()))
        results = {
            "ingress human": door_authority.check(conn, Principal("dev-sam", "sam", "sam", "ingress"), ENTRY, 1),
            "remote cookie human": door_authority.check(conn, Principal("dev-sam", "sam", "sam", "remote", via="cookie"), ENTRY, 1),
            "internal": door_authority.check(conn, Principal("dev-sam", "sam", "sam", "internal"), ENTRY, 1),
            "system": door_authority.check(conn, Principal("dev-sam", "sam", "sam", "system"), ENTRY, 1),
            "push": door_authority.check(conn, Principal("dev-sam", "sam", "sam", "push"), ENTRY, 1),
            "dev outside developer mode": door_authority.check(conn, Principal("dev-sam", "sam", "sam", "dev"), ENTRY, 1, dev_mode=False),
            "dev in developer mode": door_authority.check(conn, Principal("dev-sam", "sam", "sam", "dev"), ENTRY, 1, dev_mode=True),
            "inactive user": door_authority.check(conn, Principal("dev-ina", "ina", "ina", "ingress"), ENTRY, 1),
            "wall account": door_authority.check(conn, Principal("dev-walt", "walt", "walt", "ingress"), ENTRY, 1),
        }
    assert [results[k].allowed for k in ("ingress human", "remote cookie human", "dev in developer mode")] == [True, True, True]
    for key in ("internal", "system", "push", "dev outside developer mode"):
        assert (results[key].allowed, results[key].reason) == (False, "identity_unmapped"), key
    assert (results["inactive user"].allowed, results["inactive user"].reason) == (False, "user_inactive")
    assert (results["wall account"].allowed, results["wall account"].reason) == (False, "wall_account")


LOCAL_ID = "l_" + "0" * 26


def test_local_identity_exception_for_doors_is_locked_in_this_candidate_and_judged_normally_when_open(world, signed, monkeypatch):
    """The in-candidate form of the local-identity exception (SVCIDENT2): an Arx-only identity is refused at the door rule while the extended mode is locked
    (EXTENDED_GO_LIVE_PERMITTED False); with the permit AND both switches on the SAME rule decides (deny wins, scope, revoked/expired) - no extra approval step.
    EMROLE (a local identity holding emergency_open) is pilot/EMROLE-295 and is NOT in this candidate."""
    c, db = world["c"], world["db"]
    with db.connection() as conn:
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?,?,?,?,1,?,?)",
                     (LOCAL_ID, "loc", "loc", "local", now_iso(), now_iso()))
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at)"
                     " VALUES (?, 'user', ?, 'door_opener', ?, ?, 'allow', ?, 'test', ?)", (new_id(), LOCAL_ID, STATION, ENTRY, permission_revision(conn), now_iso()))
        who = Principal(LOCAL_ID, "loc", "loc", "local", via="cookie")
        locked = door_authority.check(conn, who, ENTRY, 1)
        assert (locked.allowed, locked.reason) == (False, "identity_unmapped"), "locked: even a holder of the grant is refused"
        set_setting(conn, "security.local_identity", "on")
        set_setting(conn, si.EXTENDED_SETTING, "on")
        still_locked = door_authority.check(conn, who, ENTRY, 1)
        assert (still_locked.allowed, still_locked.reason) == (False, "identity_unmapped"), "both switches on but no build permit: still refused"
        monkeypatch.setattr(si, "EXTENDED_GO_LIVE_PERMITTED", True)
        ok = door_authority.check(conn, who, ENTRY, 1)
        assert ok.allowed and ok.granted_by == "access.doors.open"
        assert not door_authority.check(conn, who, SIDE, 1).allowed, "scope is still the station chain"
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_id = ?", (now_iso(), LOCAL_ID))
        assert not door_authority.check(conn, who, ENTRY, 1).allowed, "a revoked grant"
        conn.execute("UPDATE users SET deleted_at = ? WHERE id = ?", (now_iso(), LOCAL_ID))
        assert not si.local_door_ok(conn, who), "a deleted local user"


# ======================================================================================================================================
# 4. the six feature adapters: resolve_policy / prepare are the admission seam
# ======================================================================================================================================

STATION_ROLE = {  # Arx permission -> a built-in role that carries it
    "access.doors.open": "door_opener",
    "access.windows.manage": "door_windows_manager",
    "access.emergency.lock": "emergency_lock",
    "access.emergency.open": "emergency_open",
    "access.stations.read": "door_windows_manager",
    "access.call": "operator",
    "access.people.manage": "site_admin",
    "access.stations.manage": "system_admin",
}


@pytest.fixture()
def fenv(settings):
    e = wk.Env(settings)
    admin = e.principal("joni")
    with e.db.connection() as conn:
        for sid in ("st-a", "st-b"):
            fx.set_relay_map(conn, station_id=sid, api_relay=1, physical_relay=2, confirmed_by=admin.user_id, expected_revision=0)
    e.admin = admin
    e.settings = settings
    return e


def make_user(e: Any, name: str, role: str | None, scope_type: str, scope_id: str, **kw: Any) -> Principal:
    p = e.principal(name)
    if role is not None:
        raw_grant(e.db, name, role, scope_type, scope_id, **kw)
    return p


def targets_for(feature: str) -> list[tuple[str, int]]:
    return [("st-a", 1)] if feature in fx.STATION_SCOPED else []


def policy(e: Any, principals: list[Principal], feature: str) -> fx.PolicyDocument:
    with e.db.connection(mode="read") as conn:
        return fx.resolve_policy(conn, principals, feature=feature, targets=targets_for(feature))


def test_the_feature_policy_offers_a_permission_only_to_a_holder_on_the_right_scope(fenv):
    """For every WisKey permission string and every Arx permission that grants it: the holder on st-a (station features) / at the installation (the
    others) gets it; a user with no grant, the holder on another station, the holder of a station-scoped grant where the installation is needed, a
    revoked grant, an expired grant and an explicit deny do not."""
    e = fenv
    pairs = [(wp, ap) for wp, arx in fx.ARX_PERMISSION_OF.items() for ap in arx]
    checked = 0
    for wiskey_permission, arx_permission in pairs:
        role = STATION_ROLE[arx_permission]
        features = [f for f, perms in fx.PERMISSIONS_OF_FEATURE.items() if wiskey_permission in perms]
        assert features, wiskey_permission
        for feature in features:
            station_scoped = feature in fx.STATION_SCOPED
            tag = f"{wiskey_permission}|{arx_permission}|{feature}".replace("/", "_").replace(".", "_")
            right_scope = (STATION, "st-a") if station_scoped else ("installation", "*")
            holder = make_user(e, f"h_{tag}", role, *right_scope)
            nobody = make_user(e, f"n_{tag}", None, "installation", "*")
            other = make_user(e, f"o_{tag}", role, STATION, "st-b")
            revoked = make_user(e, f"r_{tag}", role, *right_scope, revoked=True)
            expired = make_user(e, f"x_{tag}", role, *right_scope, expired=True)
            denied = make_user(e, f"d_{tag}", role, "installation", "*")
            raw_grant(e.db, f"d_{tag}", role, *right_scope, effect="deny")
            assert wiskey_permission in policy(e, [holder], feature).permissions, ("holder", tag)
            for case, who in (("no grant", nobody), ("other station", other), ("revoked", revoked), ("expired", expired), ("explicit deny", denied)):
                assert wiskey_permission not in policy(e, [who], feature).permissions, (case, tag)
            if not station_scoped:
                scoped = make_user(e, f"s_{tag}", role, STATION, "st-a")
                assert wiskey_permission not in policy(e, [scoped], feature).permissions, ("a station grant does not widen to the installation", tag)
            checked += 1
    assert checked >= 20


def test_a_feature_request_with_no_permission_is_refused_before_anything_is_stored_or_sent(fenv):
    e = fenv
    port = FakeDirectPort()
    nobody = make_user(e, "nobody_f", None, "installation", "*")
    wrong = make_user(e, "wrong_f", "door_windows_manager", STATION, "st-b")
    for feature in fx.FEATURES:
        for who in (nobody, wrong):
            actor = (fx.automation_actor(automation_id="a1", run_id="r1", trigger_id="t1", creator_user_id=who.user_id, approver_user_id=who.user_id, grant_revision=5)
                     if feature == "door_automations" else fx.human_actor(who.user_id))
            rows = (wk.ROW,) if feature == "people_csv" else ()
            with pytest.raises(fd.FeatureWireError) as exc:
                wk.prep(e, port, feature, actor=actor, principals=[who], rows=rows)
            assert exc.value.code == "policy_incomplete" and exc.value.outcome == "not_sent", (feature, who.username)
    assert port.calls == [], "no command left"
    with e.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM wiskey_feature_intents").fetchone()[0] == 0, "and no intent was stored"


def test_a_feature_request_with_the_permission_on_the_right_station_is_admitted(fenv):
    e = fenv
    port = FakeDirectPort()
    holder = make_user(e, "holder_f", "site_admin", STATION, "st-a")
    ad, body, snap = wk.prep(e, port, "door_windows", actor=fx.human_actor(holder.user_id), principals=[holder])
    assert "door/hold_open" in snap["permissions"] and snap["stations"][0]["station_id"] == "st-a"
    with e.db.connection() as conn:
        assert ad.start(conn, body, snap).state == "admitted"
    assert [c for c, _ in port.calls].count("features/start") == 1


def test_an_automation_needs_both_its_creator_and_its_approver(fenv):
    e = fenv
    port = FakeDirectPort()
    creator = make_user(e, "creator_f", "door_opener", STATION, "st-a")
    approver_ok = make_user(e, "approver_ok", "door_opener", STATION, "st-a")
    approver_no = make_user(e, "approver_no", None, "installation", "*")
    approver_wrong = make_user(e, "approver_wrong", "door_opener", STATION, "st-b")
    approver_revoked = make_user(e, "approver_rev", "door_opener", STATION, "st-a", revoked=True)

    def actor(approver: Principal) -> dict[str, Any]:
        return fx.automation_actor(automation_id="a1", run_id="r1", trigger_id="t1", creator_user_id=creator.user_id, approver_user_id=approver.user_id, grant_revision=5)

    ad, body, snap = wk.prep(e, port, "door_automations", actor=actor(approver_ok), principals=[creator, approver_ok])
    assert "door/pulse" in snap["permissions"]
    for bad in (approver_no, approver_wrong, approver_revoked):
        with pytest.raises(fd.FeatureWireError) as exc:
            wk.prep(e, port, "door_automations", actor=actor(bad), principals=[creator, bad])
        assert exc.value.code == "policy_incomplete", bad.username
    empty = policy(e, [], "door_automations")  # no principal at all: no policy
    assert empty.complete is False and empty.permissions == frozenset() and "no_principal" in empty.why_incomplete
    assert port.sent("features/start") == [], "nothing was started"


def test_a_human_actor_is_required_to_have_an_active_session(fenv):
    e = fenv
    holder = make_user(e, "holder_s", "site_admin", STATION, "st-a")
    doc = policy(e, [holder], "door_windows")
    body = fx.build_request(feature="door_windows", actor=fx.human_actor(holder.user_id), authority_ref="a", authority_revision=1, scope_ref="s", parameter_reference="p",
                            params={"station_id": "st-a", "relay": 1, "mapping_revision": 1, "start": wk.NOW.isoformat(), "end": wk.LATER.isoformat(), "timezone": "UTC"}, now=wk.NOW)
    with pytest.raises(fd.FeatureWireError) as exc:
        fd.build_policy_snapshot(identity=wf.IDENTITY, request=body, doc=doc, source_epoch="e1", now=wk.NOW, actor_session_active=False)
    assert exc.value.code == "policy_binding_denied" and exc.value.outcome == "not_sent"


# ---- emergency (feature emergency_buttons, command v2) -----------------------------------------------------------------------------------

def emergency_engine(e: Any, port: FakeDirectPort, who: Principal) -> Any:
    ctx = ed.EmergencyContext(fx.human_actor(who.user_id), (who,), "arx-permissions", 5, "manual", True)
    return wk.engine_for(e, port, lambda conn, rid: ctx)


def test_emergency_hold_needs_emergency_open_on_the_station(fenv):
    e = fenv
    port = FakeDirectPort()
    opener = make_user(e, "em_open", "emergency_open", STATION, "st-a")
    locker = make_user(e, "em_lock", "emergency_lock", STATION, "st-a")
    wrong = make_user(e, "em_wrong", "emergency_open", STATION, "st-b")
    revoked = make_user(e, "em_rev", "emergency_open", STATION, "st-a", revoked=True)
    expired = make_user(e, "em_exp", "emergency_open", STATION, "st-a", expired=True)
    nobody = make_user(e, "em_none", None, "installation", "*")
    for i, who in enumerate((locker, wrong, revoked, expired, nobody)):
        out = emergency_engine(e, port, who).apply("open", "st-a", 1, f"req-refused-{i}:st-a:1", "")
        assert out.state == "refused", (who.username, out)
    assert port.sent("features/start") == [], "a refused caller sends nothing"
    assert emergency_engine(e, port, opener).apply("open", "st-a", 1, "req-ok:st-a:1", "").state == "acknowledged"
    assert len(port.sent("features/start")) == 1


def test_emergency_release_needs_a_holder_of_lock_or_open_and_the_manual_context_is_arxs_own(fenv):
    e = fenv
    port = FakeDirectPort()
    opener = make_user(e, "er_open", "emergency_open", STATION, "st-a")
    locker = make_user(e, "er_lock", "emergency_lock", STATION, "st-a")
    nobody = make_user(e, "er_none", None, "installation", "*")
    assert emergency_engine(e, port, opener).apply("open", "st-a", 1, "req-r:st-a:1", "").state == "acknowledged"
    starts_before = len(port.sent("features/start"))
    out = emergency_engine(e, port, nobody).release("open", "st-a", 1, "req-r:st-a:1")
    assert out.state == "refused" and len(port.sent("features/start")) == starts_before
    assert emergency_engine(e, port, locker).release("open", "st-a", 1, "req-r:st-a:1").state == "acknowledged"
    # the manual context is read from Arx's own incident record, never from the wire: an unknown request id has no actor
    with e.db.connection(mode="read") as conn:
        with pytest.raises(fd.FeatureWireError) as exc:
            ed.incident_context(conn, "no-such-request")
    assert exc.value.code == "Unauthorized" and exc.value.outcome == "not_sent"


def test_emergency_fire_needs_the_automation_lineage_and_both_principals(fenv):
    e = fenv
    port = FakeDirectPort()
    creator = make_user(e, "fire_c", "emergency_open", STATION, "st-a")
    approver = make_user(e, "fire_a", None, "installation", "*")
    actor = fx.automation_actor(automation_id="a1", run_id="r1", trigger_id="t1", creator_user_id=creator.user_id, approver_user_id=approver.user_id, grant_revision=5)
    ctx = ed.EmergencyContext(actor, (creator, approver), "arx-permissions", 5, "fire", True)
    out = wk.engine_for(e, port, lambda conn, rid: ctx).apply("open", "st-a", 1, "req-fire:st-a:1", "")
    assert out.state == "refused" and port.sent("features/start") == [], "the approver holds nothing: nothing is started"
    with pytest.raises(fd.FeatureWireError):  # a fire trigger with a human actor
        ed.EmergencyContext(fx.human_actor(creator.user_id), (creator,), "arx-permissions", 5, "fire", True)


# ======================================================================================================================================
# 5. capture (cards/capture_*, and the signed lease the same start would use): the decision, taken again on the write connection
# ======================================================================================================================================

def redecide(svc: Any, who: Principal, station: str, stations: list[str] | None) -> bool:
    from smplwise.routers import access_control

    with svc.db.connection() as conn:
        try:
            access_control._lease_redecide(conn, who, station, SimpleNamespace(stations=stations))
        except Exception:  # noqa: BLE001 - the refusal is an ApiError
            return False
    return True


def test_capture_decision_needs_both_permissions_on_the_reader_station_and_every_person_station(svc):
    svc_users = {"capper": ("site_admin", STATION, "st-a"), "capper_rev": ("site_admin", STATION, "st-a", {"revoked": True}),
                 "capper_exp": ("site_admin", STATION, "st-a", {"expired": True})}
    for name, spec in svc_users.items():
        ensure_user(svc.c, name)
        raw_grant(svc.db, name, spec[0], spec[1], spec[2], **(spec[3] if len(spec) > 3 else {}))
    assert redecide(svc, principal("capper"), "st-a", ["st-a"])
    assert not redecide(svc, principal("capper"), "st-b", ["st-a"]), "the reader's station is not hers"
    assert not redecide(svc, principal("capper"), "st-a", ["st-a", "st-b"]), "a person shared with a station off her chain"
    assert not redecide(svc, principal("capper"), "st-a", None), "the unrestricted shortcut must still hold: she is restricted"
    assert redecide(svc, principal("sysadm"), "st-a", None), "an unrestricted holder"
    for name in ("capper_rev", "capper_exp", "otto", "vera", "nobody"):
        assert not redecide(svc, principal(name), "st-a", ["st-a"]), name
    assert not redecide(svc, principal("dan"), "st-a", ["st-a"]), "an explicit deny on the station wins"


def test_the_signed_capture_lease_is_unreachable_in_this_build(svc):
    """The lease route (signed capture_start/status/confirm/cancel + lease events) cannot be switched on at all: GO_LIVE_PERMITTED is a build constant."""
    assert cl.GO_LIVE_PERMITTED is False and cl.MIN_BRIDGE_FOR_CAPTURE_LEASE is None
    assert set(cl.LEASE_ACTIONS) == {"capture_start", "capture_status", "capture_confirm", "capture_cancel"}
    assert set(le.EVENT_ACTIONS) == {"lease_revoke", "lease_heartbeat", "lease_stream_reset"}


def test_http_card_capture_start_confirm_cancel_follow_permission_scope_and_ownership(wx_stub):
    fake, c, s, _stub, _before = wx_stub
    before = len(s11_sent(fake, "cards/capture_start"))
    body = lambda uid, station: s11_env(ttl=50.0, station_id=station, reader_id=0, revision=s11_rev(fake, uid), confirmed=True)  # noqa: E731
    for user in ("otto", "vera", "nobody", "rita", "eli", "nina"):  # nina: manages but holds no access.cards.capture
        r = c.post(S11_API + "/people/u6/card-capture", json=body("u6", "entry-a"), headers=as_user(user))
        assert r.status_code == 403, (user, r.status_code, r.text)
    r = c.post(S11_API + "/people/u6/card-capture", json=body("u6", "entry-b"), headers=as_user("mia"))
    assert r.status_code == 403, "the reader's station is not on her chain"
    r = c.post(S11_API + "/people/u1/card-capture", json=body("u1", "entry-a"), headers=as_user("mia"))
    assert r.status_code == 403, "the person is shared with a station off her chain"
    assert len(s11_sent(fake, "cards/capture_start")) == before, "no capture command was sent for any refused caller"
    # confirm / cancel of a session that is not the caller's own: the same answer as for one that does not exist, nothing sent
    for user in ("mia", "root", "otto"):
        r = c.post(S11_API + "/card-capture/does-not-exist/cancel", json={}, headers=as_user(user))
        assert r.status_code in (403, 404), (user, r.status_code)
        r = c.post(S11_API + "/card-capture/does-not-exist/confirm", json=s11_env(ttl=50.0, label="", confirmed=True), headers=as_user(user))
        assert r.status_code in (403, 404), (user, r.status_code)
    assert not s11_sent(fake, "cards/capture_cancel") and not s11_sent(fake, "cards/capture_confirm")
    r = c.post(S11_API + "/people/u6/card-capture", json=body("u6", "entry-a"), headers=as_user("mia"))
    assert r.status_code in (200, 504), r.text  # admitted: the start reached the feed (the plain fake gives no clear answer to a capture, which is a 504 unknown)
    assert len(s11_sent(fake, "cards/capture_start")) == before + 1


# ======================================================================================================================================
# 6. media (video / talk / listen): the route gate precedes the provider and every signed media command
# ======================================================================================================================================

def test_http_talk_and_listen_are_gated_on_access_call_on_the_station_before_any_provider(wx_stub, monkeypatch):
    fake, c, _s, _stub, _before = wx_stub
    touched: list[str] = []

    def provider_for(*_a: Any, **_k: Any) -> Any:
        touched.append("provider")
        raise AssertionError("the provider (and so the signed media commands) must not be reached by a refused caller")

    monkeypatch.setattr(im, "provider_for", provider_for)
    for kind in ("talk", "listen"):
        for user in ("vera", "nobody", "rita", "eli"):  # viewer (access.read only), unbound, revoked, expired
            r = c.post(f"/api/v1/access-control/stations/entry-a/{kind}", json={}, headers=as_user(user))
            assert r.status_code == 403, (kind, user, r.status_code, r.text)
        r = c.post(f"/api/v1/access-control/stations/entry-b/{kind}", json={}, headers=as_user("mia"))
        assert r.status_code == 404, (kind, "a station off her chain does not exist for her", r.status_code)
        # the permitted caller passes the gate; the administrator's setting (off by default) stops the session before the provider
        for user, station in (("mia", "entry-a"), ("otto", "entry-a")):
            r = c.post(f"/api/v1/access-control/stations/{station}/{kind}", json={}, headers=as_user(user))
            assert r.status_code == 409 and r.json()["code"] in ("intercom_talk_off", "intercom_listen_off"), (kind, user, r.status_code, r.text)
    assert touched == []


def test_http_media_descriptor_is_gated_on_access_read_on_the_station(wx_stub):
    fake, c, _s, _stub, _before = wx_stub
    for user in ("nobody", "rita", "eli"):
        assert c.get("/api/v1/access-control/stations/entry-a/media", headers=as_user(user)).status_code == 403, user
    assert c.get("/api/v1/access-control/stations/entry-b/media", headers=as_user("mia")).status_code == 404
    assert c.get("/api/v1/access-control/stations/entry-a/media", headers=as_user("mia")).status_code == 200


# ======================================================================================================================================
# 7. findings (strict xfail: the day the code closes the gap, the xfail fails and this note + the change document must be updated)
# ======================================================================================================================================

def test_finding_1_the_feature_actor_must_be_the_principal_whose_permissions_were_judged(fenv):
    e = fenv
    port = FakeDirectPort()
    holder = make_user(e, "f1_holder", "site_admin", STATION, "st-a")
    nobody = make_user(e, "f1_nobody", None, "installation", "*")
    with pytest.raises(fd.FeatureWireError):  # the actor is NOBODY, the judged principal is the holder: must be refused, is admitted today
        wk.prep(e, port, "door_windows", actor=fx.human_actor(nobody.user_id), principals=[holder])


def test_finding_2_rename_carries_an_rbac_decision():
    import inspect

    assert "decision" in inspect.signature(nw.NativePeopleWriter.rename).parameters


@pytest.mark.xfail(strict=True, reason="FINDING-3: the signing transport has no command allow-list: DirectCommandSession.call signs any command string it is handed")
def test_finding_3_the_transport_refuses_a_command_outside_the_known_catalog():
    async def go() -> None:
        sess = join.DirectCommandSession(SimpleNamespace(connect=None))  # type: ignore[arg-type]
        with pytest.raises(Exception, match="unknown_command|command_not_allowed"):
            await sess.call("door/pulse", {}, timeout=1.0)

    asyncio.run(go())


@pytest.mark.xfail(strict=True, reason="FINDING-4: ArxDecision does not name the permission, the actor or the targets it decided: the writer cannot check that a decision belongs to this write")
def test_finding_4_the_decision_is_bound_to_its_permission_and_targets():
    assert {"permission", "targets"} <= set(nw.ArxDecision.__dataclass_fields__)


@pytest.mark.xfail(strict=True, reason="FINDING-5: TemplateSender.send / DirectTemplateTransport carry no actor, permission or scope (no route calls them today)")
def test_finding_5_a_template_send_names_its_actor():
    import inspect

    from smplwise.services import wa_template_send as wts

    assert "actor" in inspect.signature(wts.TemplateSender.send).parameters
