"""MFA-SCREENS-2510 (slice 11 of the second-factor train): the one read route the screens needed - one user's second factors for the
user drawer (routers/user_factors.py, `GET /security/user-factors/{user_id}`).

Covered: the readers (rbac.assign or system.configure; a viewer is refused), an unknown user (404), a user with nothing, a user with the
authenticator code + the recovery batch it creates + a phone key (active and revoked) + a passkey row, the policy verdict (stored and an
override), Home Assistant MFA seen, and that the answer carries no secret, no credential id and no key. Fakes only."""
from __future__ import annotations

import json

from fastapi.testclient import TestClient

from smplwise.db import now_iso
from smplwise.services import factor_policy as fp
from test_second_factor import arx, enrol, fresh_login  # noqa: F401 - `arx` is the fixture

ROUTE = "/api/v1/security/user-factors/"


def _device_key(arx, user_id: str, key_id: str, fp_hex: str, revoked: bool = False) -> None:
    with arx.db.connection() as conn:
        conn.execute(
            "INSERT INTO auth_device_keys(id, user_id, label, spki, fp, auth_kind, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (key_id, user_id, "Pixel", b"\x30\x59", fp_hex, "biometric_or_screen_lock", now_iso(), now_iso() if revoked else None))


def test_readers_only_and_unknown_user(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert arx.client.get("/arx" + ROUTE + arx.viewer.id).status_code == 403
    local = TestClient(arx.app)
    assert local.get(ROUTE + "nobody").status_code == 404
    assert local.get(ROUTE + ("x" * 201)).status_code == 404
    assert fresh_login(arx, arx.owner).status_code == 200
    assert arx.client.get("/arx" + ROUTE + arx.viewer.id).status_code == 200


def test_a_user_with_nothing(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    body = TestClient(arx.app).get(ROUTE + arx.viewer.id).json()
    assert body["user_id"] == arx.viewer.id
    assert body["totp"] == {"enabled": False, "enabled_at": None, "last_used_at": None}
    assert body["passkeys"] == 0 and body["passkeys_usable"] == 0
    assert body["device_keys"] == 0 and body["device_keys_counting"] == 0
    assert body["recovery"] == {"remaining": 0, "total": 0, "low": False}
    assert body["ha_mfa_seen"] is False
    assert body["policy"] == {"sign_in": "optional", "source": "global", "enforced": False}


def test_factors_counted_and_no_secret_in_the_answer(arx):
    enrol(arx, arx.viewer)  # the authenticator code; its confirmation creates the first recovery batch
    _device_key(arx, arx.viewer.id, "dk_active000000000001", "a" * 64)
    _device_key(arx, arx.viewer.id, "dk_revoked00000000002", "b" * 64, revoked=True)
    with arx.db.connection() as conn:
        conn.execute("INSERT INTO auth_mfa_seen(user_id, first_seen_at) VALUES (?, ?)", (arx.viewer.id, now_iso()))
    r = TestClient(arx.app).get(ROUTE + arx.viewer.id)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["totp"]["enabled"] is True and body["totp"]["enabled_at"]
    assert body["device_keys"] == 1 and body["device_keys_counting"] == 1  # the revoked key is not counted
    assert body["recovery"]["total"] == 10 and body["recovery"]["remaining"] == 10 and body["recovery"]["low"] is False
    assert body["ha_mfa_seen"] is True
    text = json.dumps(body)
    for leak in ("dk_active", "dk_revoked", "secret", "spki", "aaaa", "code"):
        assert leak not in text


def test_the_policy_verdict_follows_the_settings_and_the_override(arx):
    assert fresh_login(arx, arx.viewer).status_code == 200
    arx.setting(fp.POLICY_KEY, "all")
    arx.setting(fp.MODE_KEY, "enforce")
    local = TestClient(arx.app)
    assert local.get(ROUTE + arx.viewer.id).json()["policy"] == {"sign_in": "required", "source": "global", "enforced": True}
    assert local.put("/api/v1/security/factor-policy/overrides/user/" + arx.viewer.id, json={"sign_in": "exempt"}).status_code == 200
    assert local.get(ROUTE + arx.viewer.id).json()["policy"] == {"sign_in": "exempt", "source": "user", "enforced": True}
