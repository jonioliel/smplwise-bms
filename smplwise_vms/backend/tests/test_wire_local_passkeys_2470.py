"""CR-RESPONSE-MODELS-D-2470: the public passkey routes answer their own JSONResponse (cookies, rate limits), so FastAPI never validates
them against their models (smplwise/wire/local_passkeys.py, wire/local_identity.LocalSignInSession) and the wire oracle cannot see them:
their real bodies are fitted strictly here - the second sign-in step (options + assertion, with and without user verification) and the
passwordless sign-in (options + assertion). The rename route (`PATCH /auth/passkeys/{id}`) and the administrator's list have no other
answer path through the oracle in the passkey suites: they run here."""
from __future__ import annotations

import json
from typing import Any

from pydantic import TypeAdapter

from support import wire_oracle
from test_local_passkeys import PL, PL_OPTS, SF, SF_OPTS, _with_passkey, px  # noqa: F401 - `px` is the passkey app fixture
from smplwise.wire import local_identity as LI
from smplwise.wire import local_passkeys as W


def strict_fit(model: Any, body: Any) -> None:
    ta = TypeAdapter(model)
    again = json.loads(ta.dump_json(ta.validate_python(body), by_alias=True, exclude_unset=True))
    assert wire_oracle.same(again, body) is None, wire_oracle.same(again, body)
    assert list(again) == list(body), "key order"


def test_the_second_step_answers_fit_their_models(px):  # noqa: F811 - the imported fixture
    px.configure()
    _uid, _c, auth = _with_passkey(px, uv=False)
    c2, _ = px.pending("maria")
    r = c2.post(SF_OPTS)
    assert r.status_code == 200, r.text
    opts = r.json()
    strict_fit(W.AssertionOptions, opts)
    assert opts["publicKey"]["userVerification"] == "preferred" and opts["publicKey"]["allowCredentials"]
    r = c2.post(SF, json={"credential": auth.get(opts)})
    assert r.status_code == 200, r.text
    strict_fit(LI.LocalSignInSession, r.json())


def test_the_passwordless_answers_fit_their_models(px):  # noqa: F811
    px.configure(first=True)
    _uid, c, auth = _with_passkey(px)
    assert c.put("/arx/api/v1/auth/passkeys/first", json={"on": True}).status_code == 200
    c2 = px.remote()
    r = c2.post(PL_OPTS)
    assert r.status_code == 200, r.text
    opts = r.json()
    strict_fit(W.AssertionOptions, opts)
    assert opts["publicKey"]["allowCredentials"] == [] and opts["publicKey"]["userVerification"] == "required"
    r = c2.post(PL, json={"credential": auth.get(opts)})
    assert r.status_code == 200, r.text
    strict_fit(LI.LocalSignInSession, r.json())


def test_rename_and_the_administrators_list_answer_as_before(px):  # noqa: F811
    px.configure()
    uid, c, _auth = _with_passkey(px)
    pk = c.get("/arx/api/v1/auth/passkeys").json()["credentials"][0]["id"]
    r = c.patch(f"/arx/api/v1/auth/passkeys/{pk}", json={"label": "laptop"})
    assert r.status_code == 200 and r.json()["credentials"][0]["label"] == "laptop", r.text
    r = px.admin.get(f"/api/v1/identity/local-users/{uid}/passkeys")
    assert r.status_code == 200 and r.json()["user_id"] == uid, r.text
    for key in ("PATCH /arx/api/v1/auth/passkeys/{pk_id}", "GET /api/v1/identity/local-users/{user_id}/passkeys"):
        assert wire_oracle.CHECKED.get(key), f"never compared by the oracle: {key}"
