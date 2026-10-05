"""Security review finding 5 (2026-10-04): the push path token comes from its own random per-installation secret plus a
recorder generation; removing a recorder retires its token, so a reused recorder id never accepts the old device's path."""
from __future__ import annotations

import hashlib
import hmac

from smplwise.services import connection_store as cs
from smplwise.services.recorders import provision_events as pe


def test_token_uses_its_own_secret_not_the_connection_key(settings):
    tok = pe.push_token(settings, "nvr-2")
    secret = (cs.key_path(settings).parent / pe.PUSH_KEY_NAME).read_bytes()
    conn_key = cs._load_or_create_key(settings, create=True)
    assert len(secret) == 32 and secret != conn_key
    assert tok == hmac.new(secret, b"provision-push|nvr-2|0", hashlib.sha256).hexdigest()[:32]
    assert tok != hmac.new(conn_key, b"provision-push|nvr-2", hashlib.sha256).hexdigest()[:32], "not the old derivation"
    assert pe.push_token(settings, "nvr-2") == tok, "stable while nothing changes"


def test_generation_bump_retires_only_that_recorder(settings):
    a, b = pe.push_token(settings, "nvr-2"), pe.push_token(settings, "nvr-3")
    assert pe.bump_push_generation(settings, "nvr-2") == 1
    assert pe.push_token(settings, "nvr-2") != a and pe.push_token(settings, "nvr-3") == b
    assert pe.bump_push_generation(settings, "nvr-2") == 2 and pe.push_generation(settings, "nvr-2") == 2


def test_remove_recorder_bumps_the_generation(settings):
    from smplwise.main import create_app

    app = create_app(settings)  # migrated schema
    with app.state.db.connection() as conn:
        cs.write_row(conn, settings, vendor="provision_isr", host="provision-nvr.test", http_port=80, rtsp_port=554, username="u",
                     password="p", extra={}, source="ui", actor_id=None, recorder_id="nvr-2")
        before = pe.push_token(settings, "nvr-2")
        cs.remove(conn, settings, None, recorder_id="nvr-2")
    assert pe.push_generation(settings, "nvr-2") == 1 and pe.push_token(settings, "nvr-2") != before
