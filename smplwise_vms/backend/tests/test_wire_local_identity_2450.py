"""CR-RESPONSE-MODELS-B-2450: the Arx identity routes the wire oracle cannot see or no other test reaches.

The two sign-in routes answer with their own JSONResponse (cookies), so FastAPI never validates them against their model: their real
bodies are fitted strictly here. `GET /identity/local-users/{id}` and the home-system link (PUT / DELETE `ha-link`) have no other test:
they run here through the oracle (tests/support/wire_oracle.py)."""
from __future__ import annotations

import json
from typing import Any

from pydantic import TypeAdapter

from support import wire_oracle
from test_local_identity import GOOD, _code, lx  # noqa: F401 - `lx` is the remote-enabled app fixture
from smplwise.db import now_iso
from smplwise.wire import local_identity as W


def strict_fit(model: Any, body: Any) -> None:
    ta = TypeAdapter(model)
    again = json.loads(ta.dump_json(ta.validate_python(body), by_alias=True, exclude_unset=True))
    assert wire_oracle.same(again, body) is None, wire_oracle.same(again, body)


def test_sign_in_answers_fit_their_models(lx):  # noqa: F811 - the imported fixture
    lx.enable()
    created = lx.create("sitey", "site_admin")
    assert lx.set_password(lx.link_token(created)).status_code == 200
    c = lx.remote()
    r = lx.sign_in(c, "sitey")
    assert r.status_code == 200, r.text
    strict_fit(W.LocalSignInSession, r.json())
    secret = c.post("/arx/api/v1/auth/second-factor/enroll").json()["secret"]
    assert c.post("/arx/api/v1/auth/second-factor/confirm", json={"code": _code(secret)}).status_code == 200
    c2 = lx.remote()
    r = lx.sign_in(c2, "sitey")
    assert r.status_code == 202, r.text
    strict_fit(W.LocalSignInPending, r.json())
    strict_fit(W.LocalSignInSession | W.LocalSignInPending, r.json())
    with lx.db.connection() as conn:
        conn.execute("UPDATE auth_totp SET last_step = 0")
    r = c2.post("/arx/api/v1/auth/local/sign-in/second-factor", json={"code": _code(secret)})
    assert r.status_code == 200, r.text
    strict_fit(W.LocalSignInSession, r.json())


def test_one_user_and_the_home_system_link_answer_as_before(lx):  # noqa: F811
    lx.enable()
    uid = lx.create("maria")["user"]["id"]
    with lx.db.connection() as conn:
        conn.execute("INSERT INTO ha_users(id, name, username, is_active, is_admin, group_ids_json, synced_at) VALUES ('ha-maria', 'Maria', 'maria.h', 1, 0, '[]', ?)",
                     (now_iso(),))
    api = "/api/v1/identity/local-users"
    r = lx.admin.get(f"{api}/{uid}")
    assert r.status_code == 200 and r.json()["ha_user_id"] is None
    r = lx.admin.put(f"{api}/{uid}/ha-link", json={"ha_user_id": "ha-maria"})
    assert r.status_code == 200 and r.json()["ha_user_id"] == "ha-maria", r.text
    r = lx.admin.patch(f"{api}/{uid}", json={"active": False})  # a linked user: the other identity is suggested (as the router answers it)
    assert r.status_code == 200 and r.json()["suggest_also"]["ha_user_id"] == "ha-maria", r.text
    r = lx.admin.delete(f"{api}/{uid}/ha-link")
    assert r.status_code == 200 and r.json()["ha_user_id"] is None
    for key in (f"GET {api}/{{user_id}}", f"PUT {api}/{{user_id}}/ha-link", f"DELETE {api}/{{user_id}}/ha-link", f"PATCH {api}/{{user_id}}"):
        assert wire_oracle.CHECKED.get(key), f"never compared by the oracle: {key}"
