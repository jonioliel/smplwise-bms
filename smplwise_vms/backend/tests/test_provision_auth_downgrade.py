"""Security review finding 10 (2026-10-04): in auto mode a device that once challenged with Digest is never talked to with
Basic again (a stripped challenge is how a man in the middle harvests the password). The floor survives the cache and a
restart (kept under keys/); choosing Basic explicitly is the deliberate way down."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

from smplwise.errors import ApiError
from smplwise.services.recorders import provision_isr as pisr

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import FakeProvision, settings_for  # noqa: E402


def _adapter(s, fake):
    return pisr.ProvisionIsrAdapter("nvr-1", s, transport=fake.transport())


def test_digest_then_basic_is_refused_without_sending_credentials(settings):
    pisr.clear_auth_cache()
    fake = FakeProvision()
    fake.auth = "digest"
    s = settings_for(settings)  # auto mode
    assert _adapter(s, fake).device_info()["model"]
    assert pisr._auth_floor(s, _adapter(s, fake).device_key) == "digest"

    pisr.clear_auth_cache()  # a TTL expiry / restart: the scheme is probed again
    fake.auth = "basic"  # the challenge is now Basic (stripped)
    fake.hits.clear()
    with pytest.raises(ApiError) as e:
        _adapter(s, fake).device_info(refresh=True)
    assert e.value.code == "auth_downgrade_refused"
    assert fake.hits == ["POST /GetDeviceInfo"], "only the unauthenticated probe went out"


def test_explicit_basic_is_the_deliberate_way_down(settings):
    pisr.clear_auth_cache()
    fake = FakeProvision()
    fake.auth = "digest"
    assert _adapter(settings_for(settings), fake).device_info()["model"]
    pisr.clear_auth_cache()
    fake.auth = "basic"
    assert _adapter(settings_for(settings, auth="basic"), fake).device_info(refresh=True)["model"]


def test_basic_only_device_keeps_working_in_auto(settings):
    pisr.clear_auth_cache()
    fake = FakeProvision()
    s = settings_for(settings)
    assert _adapter(s, fake).device_info()["model"]
    pisr.clear_auth_cache()
    assert _adapter(s, fake).device_info(refresh=True)["model"]
    assert pisr._auth_floor(s, _adapter(s, fake).device_key) is None
