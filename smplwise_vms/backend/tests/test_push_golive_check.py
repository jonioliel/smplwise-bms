"""scripts/push_golive_check.py (PUSH-GOLIVE-KIT-2380): the rehearsal with fakes, the secret-file shape check and the health comparison.

No account, no network beyond 127.0.0.1, no real key: the "key files" below are placeholders with the right headers. The checks that
matter most: nothing secret-shaped is ever printed, the fake relay contract holds, and git ignores the places the owner puts files."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("push_golive_check", ROOT / "scripts" / "push_golive_check.py")
pgc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pgc)

PLACEHOLDER_PEM = "-----BEGIN PRIVATE KEY-----\nPLACEHOLDER-NOT-A-KEY\n-----END PRIVATE KEY-----\n"
SA_EMAIL = "relay@example-project.iam.gserviceaccount.com"
KEY_ID = "ABCDE12345"


def _write_secrets(d: Path, *, sa_type: str = "service_account", p8_name: str = f"AuthKey_{KEY_ID}.p8", keys: str | None = None) -> None:
    d.mkdir(exist_ok=True)
    (d / "firebase-relay-service-account.json").write_text(json.dumps({"type": sa_type, "project_id": "example-project", "client_email": SA_EMAIL, "private_key": PLACEHOLDER_PEM}), encoding="utf-8")
    (d / p8_name).write_text(PLACEHOLDER_PEM, encoding="utf-8")
    if keys is not None:
        (d / "push-relay-server-keys.txt").write_text(keys, encoding="utf-8")


def _run(argv: list[str], capsys) -> tuple[int, str]:
    code = pgc.main(argv)
    return code, capsys.readouterr().out


def test_dry_run_with_fakes_passes_and_prints_no_token(capsys):
    code, out = _run(["dry-run"], capsys)
    assert code == 0, out
    assert "FAIL" not in out and "16 passed" in out
    assert "rt_" not in out and "dryrun-" not in out  # neither a relay token nor the throwaway server key reaches the report
    assert "NOT_RUN  Worker typecheck" in out  # without --worker the Worker's own checks are listed as not run, never as passed


def test_preflight_accepts_well_formed_files_and_prints_no_value(tmp_path, capsys, monkeypatch):
    # the shapes only: where pytest's tmp_path lives decides the git-ignore check (a --basetemp inside a checkout is "git would add
    # this file", correctly), so that check is taken out here and covered by test_git_ignored_inside_outside_the_repository
    monkeypatch.setattr(pgc, "_git_ignored", lambda _p: None)
    _write_secrets(tmp_path / "s", keys="efrat:" + "ab" * 32 + ",office2:" + "cd" * 32)
    code, out = _run(["secrets-preflight", "--dir", str(tmp_path / "s"), "--apns-key-id", KEY_ID, "--apns-team-id", "TEAM123456"], capsys)
    assert code == 0, out
    assert "PLACEHOLDER" not in out and SA_EMAIL not in out and "example-project" not in out and "ab" * 32 not in out and KEY_ID not in out


def test_git_ignored_inside_outside_the_repository():
    # git check-ignore works on paths that do not exist yet: secrets/ is ignored, a file next to the code is not, outside = cannot be added
    assert pgc._git_ignored(ROOT / "secrets" / "firebase-relay-service-account.json") is True
    assert pgc._git_ignored(ROOT / "scripts" / "firebase-relay-service-account.json") is False
    outside = Path(ROOT.anchor) / "sw-not-a-checkout" / "push-relay-server-keys.txt"
    if ROOT.resolve() != Path(ROOT.anchor).resolve():
        assert pgc._git_ignored(outside) is None


@pytest.mark.parametrize("kwargs, expect", [
    ({"sa_type": "authorized_user"}, "type is service_account"),
    ({"p8_name": "key.p8"}, "APNs key file name is AuthKey_<Key ID>.p8"),
    ({"keys": "efrat: " + "ab" * 32}, "SERVER_KEYS value is <label>:<hex secret>"),
    ({"keys": "a:" + "ab" * 32 + ",b:" + "ab" * 32}, "every installation has its own label and its own secret"),
])
def test_preflight_rejects_a_wrong_shape(tmp_path, capsys, kwargs, expect):
    _write_secrets(tmp_path / "s", **kwargs)
    code, out = _run(["secrets-preflight", "--dir", str(tmp_path / "s")], capsys)
    assert code == 1
    assert f"FAIL  {expect}" in out


def test_preflight_key_id_mismatch_and_bad_ids(tmp_path, capsys):
    _write_secrets(tmp_path / "s")
    code, out = _run(["secrets-preflight", "--dir", str(tmp_path / "s"), "--apns-key-id", "ZZZZZ99999", "--apns-team-id", "short"], capsys)
    assert code == 1
    assert "FAIL  the Key ID typed in the session equals the file name's Key ID" in out
    assert "FAIL  --apns-team-id has the shape of an Apple Team ID" in out


def test_preflight_missing_files_are_not_run_not_failures_and_missing_dir_is_a_usage_error(tmp_path, capsys):
    (tmp_path / "empty").mkdir()
    code, out = _run(["secrets-preflight", "--dir", str(tmp_path / "empty")], capsys)
    assert code == 0 and out.count("NOT_RUN") == 2
    code, _ = _run(["secrets-preflight", "--dir", str(tmp_path / "nope")], capsys)
    assert code == 2


@pytest.fixture()
def fake_relay_url():
    fake = pgc._load_fake_relay()
    fake.print = lambda *a, **k: None
    srv = ThreadingHTTPServer(("127.0.0.1", 0), fake.Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()
    srv.server_close()


def test_health_compares_with_what_is_expected(fake_relay_url, capsys):
    code, out = _run(["health", "--url", fake_relay_url], capsys)
    assert code == 0 and "PASS  GET /v1/health answers {ok: true}" in out
    code, out = _run(["health", "--url", fake_relay_url, "--expect-fcm"], capsys)  # the fake has no FCM secret
    assert code == 1 and "FAIL  FCM secret present and readable" in out
    code, out = _run(["health", "--url", fake_relay_url, "--expect-stable", "--min-server-keys", "1"], capsys)
    assert code == 1 and "FAIL  RELAY_TOKEN_SECRET present" in out and "FAIL  at least 1 server key(s)" in out


@pytest.mark.parametrize("url", ["http://relay.example.com", "ftp://relay.example.com", "https://relay.example.com/v1", "https://relay.example.com/v1/"])
def test_health_refuses_a_bad_address_before_any_request(url, capsys):
    code, out = _run(["health", "--url", url], capsys)
    assert code == 2 and "FAIL" not in out


def test_secret_shaped_file_patterns_and_git_ignore():
    tracked_bad = ["secrets/x.p8", "a/b/AuthKey_ABCDE12345.p8", "firebase-relay-service-account.json", "mobile/android/app/google-services.json", "x/.dev.vars",
                   "ios/GoogleService-Info.plist", "keystore.properties", "upload.jks", "release.keystore", "profile.mobileprovision"]
    assert all(any(rx.search(p) for rx in pgc.FORBIDDEN_TRACKED) for p in tracked_bad)
    fine = ["services/push-relay/src/index.ts", "docs/operations/ARX_PUSH_RELAY_DEPLOY_HE.md", "scripts/push_golive_check.py", "services/push-relay/wrangler.toml"]
    assert not any(rx.search(p) for rx in pgc.FORBIDDEN_TRACKED for p in fine)
    # the folders the owner session writes into must be ignored by git (git check-ignore works on paths that do not exist yet)
    for p in ("secrets/firebase-relay-service-account.json", "secrets/AuthKey_ABCDE12345.p8", "secrets/push-relay-server-keys.txt", "services/push-relay/.dev.vars"):
        r = subprocess.run(["git", "-C", str(ROOT), "check-ignore", "-q", p], timeout=30)
        assert r.returncode == 0, f"{p} is not ignored by git"
