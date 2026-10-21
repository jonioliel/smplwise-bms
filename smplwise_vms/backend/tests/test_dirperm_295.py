"""DIRPERM-295 (owner approval 2026-10-21, target 2.10.1): SMALL-294 split the directory out of `tickets.configure` into `tickets.directory`.
The external-access identity card, the external-access CSV and the link / unlink actions still asked for `tickets.configure` alone; they now
accept `tickets.directory` too. `tickets.configure` keeps every right it had; no new permission names; deleting a WisKey person stays
with the grant permission + people.manage (it never depended on the directory). FAKES ONLY (test_access_grants.Env)."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from test_access_grants import Env
from tickets_world import API

from smplwise.services import access_external as ax
from smplwise.services import access_grants as ag


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    ax.reset_export_rate()
    yield e
    ag.reset_for_tests()
    ax.reset_export_rate()


def _identity(env: Env, user: str | None = None):
    return env.c.get(f"{API}/access-grants/contacts/{env.tech}/identity", headers=as_user(user) if user else None)


def _csv(env: Env, user: str):
    ax.reset_export_rate()
    return env.c.get(f"{API}/access-grants/export.csv", headers=as_user(user))


def _people_manage(env: Env, user: str) -> None:
    rid = env.role("ניהול אנשים DIRPERM", ["access.people.manage"])
    bind(env.c, env.settings, user, rid, "installation", "*")


@pytest.mark.parametrize("role", ["tickets_directory", "tickets_configure"])
def test_the_card_and_the_csv_open_for_either_directory_permission(env, role):
    env.active_grant()
    bind(env.c, env.settings, "dirx", role, "installation", "*")
    assert _identity(env, "dirx").status_code == 200
    assert _csv(env, "dirx").status_code == 200


def test_the_directory_permission_alone_unlocks_the_card_actions_flag(env):
    bind(env.c, env.settings, "dirx", "tickets_directory", "installation", "*")
    ident = _identity(env, "dirx").json()["identity"]
    assert ident["link"] is None and ident["can"]["link"] is True


def test_a_holder_of_neither_is_refused_everywhere(env):
    env.active_grant()
    bind(env.c, env.settings, "none1", "viewer", "installation", "*")
    bind(env.c, env.settings, "hand1", "tickets_view", "installation", "*")  # an unrelated tickets permission opens nothing here
    for user in ("none1", "hand1"):
        assert _identity(env, user).status_code == 404, user
        assert _csv(env, user).status_code == 403, user
    env.engine.add_person("wk-d1", stations=["st-a"])
    r = env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-d1"}, user="none1")
    assert r.status_code == 403 and r.json()["details"]["permission"] == "tickets.configure"


def test_link_and_unlink_accept_the_directory_permission_and_keep_the_station_rule(env):
    env.engine.add_person("wk-d2", stations=["st-a"])
    bind(env.c, env.settings, "dirx", "tickets_directory", "installation", "*")
    # the directory permission is half of the rule: people.manage on the person's stations is still required
    assert env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-d2"}, user="dirx").status_code == 403
    _people_manage(env, "dirx")
    r = env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-d2"}, user="dirx")
    assert r.status_code == 200, r.text
    link_id = r.json()["link"]["id"]
    assert env.c.delete(f"{API}/access-grants/links/{link_id}", headers=as_user("dirx")).status_code == 200


def test_unlink_is_refused_without_the_directory_right(env):
    gid = env.active_grant()
    link_id = env.grant(gid)["link_id"]
    bind(env.c, env.settings, "none1", "viewer", "installation", "*")
    r = env.c.delete(f"{API}/access-grants/links/{link_id}", headers=as_user("none1"))
    assert r.status_code == 403, r.text


def test_deleting_a_wiskey_person_still_needs_the_grant_permission_not_the_directory(env):
    gid = env.active_grant()
    link_id = env.grant(gid)["link_id"]
    bind(env.c, env.settings, "dirx", "tickets_directory", "installation", "*")
    _people_manage(env, "dirx")
    r = env.post(f"/access-grants/links/{link_id}/delete-person", {"confirm": ag.DELETE_WORD}, user="dirx")
    assert r.status_code == 403 and r.json()["details"]["permission"] == ag.PERMISSION, r.text


def test_configure_unchanged_link_with_station_manage(env):
    env.engine.add_person("wk-d3", stations=["st-a"])
    bind(env.c, env.settings, "cfg", "tickets_configure", "installation", "*")
    _people_manage(env, "cfg")
    assert env.post("/access-grants/links", {"contact_id": env.tech, "wiskey_person_id": "wk-d3"}, user="cfg").status_code == 200
