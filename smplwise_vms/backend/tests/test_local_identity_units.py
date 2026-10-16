"""USR2 phase 1, units without an app: the password hashing (PHC strings, scrypt profiles, the dummy hash), the password policy and
its local denylist, the per-account delay schedule, ids and the rbac second-factor gate for administrative permissions."""
from __future__ import annotations

import base64

import pytest

from smplwise import rbac
from smplwise.rbac import LOCAL_ADMIN_PERMISSIONS, Principal, local_factor_gate
from smplwise.services import local_identity as li
from smplwise.services import local_passwords as lp


@pytest.fixture(autouse=True)
def _fast_profile():
    lp.reset_for_tests()
    lp._profile_override = lp.Profile(7, 10, 8, 1)  # a cheap profile for the tests; production picks 1 or 2
    yield
    lp.reset_for_tests()


# ---------------------------------------------------------------- hashing

def test_hash_is_a_phc_string_and_verifies_only_the_right_password():
    phc, version = lp.hash_password("correct horse battery staple")
    assert phc.startswith("$scrypt$ln=10,r=8,p=1$") and version == 7
    assert "correct" not in phc
    assert lp.verify("correct horse battery staple", phc)
    assert not lp.verify("correct horse battery stapl", phc)
    assert not lp.verify("", phc)
    # NFKC + outer whitespace: the same password typed with a full-width digit / a trailing space verifies
    phc2, _ = lp.hash_password("tree-river-lamp-9")
    assert lp.verify("  tree-river-lamp-９ ", phc2)


def test_two_hashes_of_one_password_differ_salt():
    a, _ = lp.hash_password("tree-river-lamp-9")
    b, _ = lp.hash_password("tree-river-lamp-9")
    assert a != b


@pytest.mark.parametrize("bad", [None, "", "plain", "$scrypt$garbage", "$scrypt$ln=99,r=8,p=1$AAAA$BBBB", "$argon2id$v=19$m=65536,t=3,p=1$abc$def", "$bcrypt$x"])
def test_unreadable_or_unknown_hashes_never_verify_and_never_raise(bad):
    assert lp.verify("anything at all here", bad) is False


def test_over_128_bytes_never_verifies():
    long = "ש" * 70  # 140 bytes in UTF-8
    phc, _ = lp.hash_password("tree-river-lamp-9")
    assert lp.verify(long, phc) is False


def test_needs_rehash_on_an_older_profile_or_algorithm():
    phc, version = lp.hash_password("tree-river-lamp-9")
    assert not lp.needs_rehash(phc, version)
    assert lp.needs_rehash(phc, version - 1)
    assert lp.needs_rehash("$argon2id$v=19$m=65536,t=3,p=1$abc$def", version)
    assert not lp.needs_rehash(None, version)


def test_dummy_hash_runs_the_current_profile(monkeypatch):
    calls = []
    real = lp._scrypt

    def spy(secret, salt, prof):
        calls.append(prof.log_n)
        return real(secret, salt, prof)

    monkeypatch.setattr(lp, "_scrypt", spy)
    assert lp.verify_dummy("whatever") is False
    assert calls and calls[-1] == 10  # the same cost as a real verify


def test_low_memory_profile_below_one_gib(monkeypatch):
    lp._profile_override = None
    monkeypatch.setattr(lp, "_cgroup_memory_bytes", lambda: 512 * 1024 * 1024)
    assert lp.current_profile().version == 2 and lp.current_profile().log_n == 16
    monkeypatch.setattr(lp, "_cgroup_memory_bytes", lambda: None)
    assert lp.current_profile().version == 1 and lp.current_profile().log_n == 17


# ---------------------------------------------------------------- policy

@pytest.mark.parametrize("pw,reason", [
    ("short", "too_short"),
    ("elevenchars", "too_short"),
    ("x" * 129, "too_long"),
    ("aaaaaaaaaaaaaaa", "repeated"),
    ("abababababababab", "repeated"),
    ("123456789012", "repeated"),
    ("qwertyuiopasdf", "repeated"),
    ("Password2024!", "common"),
    ("p@ssw0rd123456", "common"),
    ("iloveyou12345", "common"),
    ("passwordpassword", "common"),
    ("dana12345678", "contextual"),
    ("SmplWise-2026!", "contextual"),
    ("ArxArx2026!!", "contextual"),
])
def test_policy_refuses_by_class(pw, reason):
    assert lp.check_policy(pw, context=["dana", "Dana Levi"]) == reason


@pytest.mark.parametrize("pw", ["correct horse battery staple", "Dana-likes-green-tea", "tree river lamp 47", "731948265019", "שמש-ירוקה-על-ההר"])
def test_policy_accepts_long_unusual_passwords(pw):
    assert lp.check_policy(pw, context=["dana", "Dana Levi"]) is None


def test_policy_min_length_setting_bounded():
    assert lp.check_policy("tree-river-l", min_length=12) is None
    assert lp.check_policy("tree-river-l", min_length=14) == "too_short"
    assert lp.check_policy("tree-river", min_length=3) is None  # the floor is 10, never lower
    assert lp.check_policy("tree-rive", min_length=3) == "too_short"


def test_admin_supplied_denylist_is_read(tmp_path):
    (tmp_path / "denylist").mkdir()
    (tmp_path / "denylist" / "extra.txt").write_text("# site words\nbluefalcon\n", encoding="utf-8")
    assert lp.check_policy("BlueFalcon2026", data_dir=tmp_path) == "common"
    lp.reset_for_tests()
    lp._profile_override = lp.Profile(7, 10, 8, 1)
    assert lp.check_policy("BlueFalcon2026") is None


# ---------------------------------------------------------------- tiers, ids, the gate

def test_account_delay_schedule_doubles_and_caps():
    assert [li.account_delay(n) for n in range(0, 5)] == [0.0] * 5
    assert li.account_delay(5) == 30.0 and li.account_delay(6) == 60.0 and li.account_delay(7) == 120.0
    assert li.account_delay(20) == 900.0


def test_local_ids_never_look_like_ha_ids():
    ids = {li.new_local_id() for _ in range(200)}
    assert len(ids) == 200
    for i in ids:
        assert i.startswith("l_") and len(i) == 28 and li.is_local_id(i)
    assert not li.is_local_id("0123456789abcdef0123456789abcdef")
    assert not li.is_local_id(None)


def test_public_id_namespaces_differ_from_ha():
    from smplwise.services import ha_user_auth as hua

    assert li.public_id("abc") != hua.public_id("abc")


def test_rbac_gate_withholds_admin_permissions_without_the_factor():
    p = Principal(user_id="l_X", username="x", display_name="x", source="local")
    assert all(local_factor_gate(p, perm) for perm in LOCAL_ADMIN_PERMISSIONS)
    assert not local_factor_gate(p, "video.live")
    ok = Principal(user_id="l_X", username="x", display_name="x", source="local", factor_ok=True)
    assert not any(local_factor_gate(ok, perm) for perm in LOCAL_ADMIN_PERMISSIONS)
    # never for any other source (HA identities are untouched by the rule)
    for source in ("ingress", "remote", "dev", "internal"):
        assert not local_factor_gate(Principal(user_id="u", username="u", display_name="u", source=source), "rbac.assign")
    assert {"rbac.assign", "identity.directory.read", "system.configure", "identity.local.manage"} <= LOCAL_ADMIN_PERMISSIONS


def test_identity_local_manage_is_system_admin_only_and_a_system_permission():
    from smplwise.routers.access import SYSTEM_PERMISSIONS

    holders = [r for r, perms in rbac.ROLES.items() if "identity.local.manage" in perms]
    assert holders == ["system_admin"]
    assert "identity.local.manage" in SYSTEM_PERMISSIONS  # never in a custom role, never delegable


def test_alarm_remote_rules_apply_to_local_identities():
    from smplwise.routers import alarm

    p = Principal(user_id="l_X", username="x", display_name="x", source="local")
    assert alarm._remote_block(p, {"remote_control": False, "remote_disarm": True}, "arm") == "remote_control_disabled"
    assert alarm._remote_block(p, {"remote_control": True, "remote_disarm": False}, "disarm") == "remote_disarm_disabled"


def test_cookie_header_attributes():
    h = li.cookie_header("__Secure-arx_session", "l.abc", "/arx/", secure=True, max_age=60)
    assert h.startswith("__Secure-arx_session=l.abc;") and "HttpOnly" in h and "Max-Age=60" in h and "Path=/arx/" in h and "SameSite=strict" in h and "Secure" in h
    h2 = li.cookie_header("arx_session", "l.abc", "/arx/", secure=False, max_age=None)
    assert "Max-Age" not in h2 and "Secure" not in h2


def test_b64_helpers_round_trip():
    raw = b"\x00\x01\xfe\xff" * 4
    assert lp._unb64(lp._b64(raw)) == raw
    assert "=" not in lp._b64(raw)
    _ = base64
