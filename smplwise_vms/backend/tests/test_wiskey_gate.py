"""WX3: the local gate tool for the intercom integration source folder (scripts/wiskey_gate.py).
Small synthetic fixtures only: no real station, address, key or network."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("wiskey_gate", ROOT / "scripts" / "wiskey_gate.py")
wg = importlib.util.module_from_spec(spec)
assert spec.loader
sys.modules["wiskey_gate"] = wg
spec.loader.exec_module(wg)

NOTES = """# Release notes 2.0.1 / הערות שחרור
## Added / נוספו
- A thing. דבר חדש.
## Fixed / תוקנו
- none
## How to enable / איך מפעילים
- nothing
## Risk to doors / סיכון לדלתות
- none
## Rollback / חזרה
- reinstall previous
"""
IMPACT = "# Arx impact\nWS commands: none\nPermissions: none\nEntities: none\nStorage schema: none\nSettings: none\nRestart: no\nMigration: none\n"


def w(p: Path, text: str) -> Path:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8", newline="\n")
    return p


def make_tree(root: Path, version: str = "2.0.1", domain: str = "demo_intercom") -> Path:
    w(root / "custom_components" / domain / "manifest.json", json.dumps({"domain": domain, "name": "Demo", "version": version}))
    w(root / "custom_components" / domain / "__init__.py", "VALUE = 1\n")
    w(root / "tests" / "test_basic.py", "def test_a():\n    assert True\n\n\ndef test_b():\n    assert True\n")
    w(root / "requirements-ha-test.txt", "pytest==8.3.2\n")
    w(root / "RELEASE_NOTES.md", NOTES)
    w(root / "ARX_IMPACT.md", IMPACT)
    w(root / "contract" / "ws-commands.json", json.dumps({"contract_version": "1.0.0", "commands": []}))
    w(root / "contract" / "errors.json", json.dumps({"errors": []}))
    w(root / "docs" / "AUTONOMOUS_TIMERS.md", "# Timers\nnone\n")
    w(root / "docs" / "PROVIDER_INTERFACE.md", "# Providers\n")
    return root


def codes(rep: dict) -> set[str]:
    return {f["code"] for f in rep["findings"] if f["severity"] == "error"}


def test_clean_tree_passes_and_is_deterministic(tmp_path):
    src = make_tree(tmp_path / "s")
    rep = wg.run_check(src)
    assert rep["exit_code"] == 0, rep["findings"]
    assert rep["result"] == "pass" and rep["version"] == "2.0.1" and rep["domain"] == "demo_intercom"
    again = wg.run_check(src)
    assert rep["manifest"] == again["manifest"]
    assert rep["manifest"]["profile"] == "unsigned_for_test" and rep["manifest"]["signature"] is None
    assert rep["manifest"]["package"]["file_count"] == 2
    assert "baseline not supplied: exclusion and mandatory-test checks NOT_RUN" in rep["not_run"]


def test_manifest_tree_hash_changes_with_bytes_and_ignores_pycache(tmp_path):
    src = make_tree(tmp_path / "s")
    h1 = wg.run_check(src)["manifest"]["package"]["tree_sha256"]
    w(src / "custom_components" / "demo_intercom" / "__pycache__" / "x.pyc", "junk")
    assert wg.run_check(src)["manifest"]["package"]["tree_sha256"] == h1
    w(src / "custom_components" / "demo_intercom" / "__init__.py", "VALUE = 2\n")
    assert wg.run_check(src)["manifest"]["package"]["tree_sha256"] != h1
    expected = wg.sha256_bytes("".join(f"{r['sha256']}  {r['path']}\n" for r in wg.run_check(src)["manifest"]["package"]["files"]).encode())
    assert expected == wg.run_check(src)["manifest"]["package"]["tree_sha256"]


def test_structure_failures_exit_2(tmp_path):
    src = make_tree(tmp_path / "s")
    (src / "RELEASE_NOTES.md").write_text("# Notes only English\n## Added\n", encoding="utf-8")
    (src / "ARX_IMPACT.md").unlink()
    (src / "contract" / "errors.json").write_text('{"a": 1, "a": 2}', encoding="utf-8")
    rep = wg.run_check(src)
    assert rep["exit_code"] == 2 and rep["result"] == "input_invalid"
    assert {"S_NOTES_HEADING", "S_NOTES_NOT_BILINGUAL", "S_IMPACT_MISSING", "S_CONTRACT_JSON"} <= codes(rep)


def test_semver_and_not_greater_than_installed(tmp_path):
    bad = make_tree(tmp_path / "a", version="2.0")
    assert "S_VERSION_FORMAT" in codes(wg.run_check(bad))
    ok = make_tree(tmp_path / "b", version="2.0.1-rc.2")
    notes = (ok / "RELEASE_NOTES.md").read_text(encoding="utf-8").replace("2.0.1", "2.0.1-rc.2")
    (ok / "RELEASE_NOTES.md").write_text(notes, encoding="utf-8")
    assert wg.run_check(ok, installed_version="2.0.1-rc.1")["exit_code"] == 0
    assert "S_VERSION_NOT_GREATER" in codes(wg.run_check(ok, installed_version="2.0.1"))  # rc is below its release
    assert "S_VERSION_NOT_GREATER" in codes(wg.run_check(ok, installed_version="2.0.1-rc.2"))


def test_two_domains_or_domain_mismatch(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "custom_components" / "other" / "manifest.json", "{}")
    assert "S_DOMAIN_COUNT" in codes(wg.run_check(src))
    src2 = make_tree(tmp_path / "t")
    w(src2 / "custom_components" / "demo_intercom" / "manifest.json", json.dumps({"domain": "x", "name": "n", "version": "1.0.0"}))
    assert "S_DOMAIN_MISMATCH" in codes(wg.run_check(src2))


def test_forbidden_content_inside_the_package_exit_5(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "custom_components" / "demo_intercom" / "tests" / "test_x.py", "def test_x(): pass\n")
    w(src / "custom_components" / "demo_intercom" / "debug.log", "x")
    rep = wg.run_check(src)
    assert rep["exit_code"] == 5 and codes(rep) == {"R_FORBIDDEN_IN_PACKAGE"}
    assert len([f for f in rep["findings"] if f["code"] == "R_FORBIDDEN_IN_PACKAGE"]) == 2


def test_private_and_probe_dirs_outside_the_import_set_are_not_scanned_but_listed(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "private" / "lab.txt", "host 10.9.8.7\n")
    rep = wg.run_check(src)
    assert rep["exit_code"] == 0
    assert "private" in rep["manifest"]["not_imported_dirs"]


def test_leak_scan_flags_without_echoing_values(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "custom_components" / "demo_intercom" / "cfg.py",
      'HOST = "10.20.30.40"\nMAC = "AA:BB:CC:11:22:33"\npassword = "hunter2hunter2"\nserial_number = "ZX9988776655"\n'
      'ok1 = "192.0.2.10"\nok2 = "127.0.0.1"\nok3 = "00:00:5E:00:53:01"\ntoken = "test-token-value"\nver = "2026.9.1"\n')
    rep = wg.run_check(src)
    assert rep["exit_code"] == 5
    assert codes(rep) == {"R_LEAK_IP", "R_LEAK_MAC", "R_LEAK_SECRET", "R_LEAK_SERIAL"}
    blob = json.dumps(rep["findings"])
    for secret in ("10.20.30.40", "AA:BB:CC", "hunter2", "ZX9988776655"):
        assert secret not in blob
    lines = {f["code"]: f["line"] for f in rep["findings"]}
    assert lines == {"R_LEAK_IP": 1, "R_LEAK_MAC": 2, "R_LEAK_SECRET": 3, "R_LEAK_SERIAL": 4}


def test_leak_allow_marker_needs_matching_code_and_reason(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "custom_components" / "demo_intercom" / "cfg.py",
      'A = "10.20.30.40"  # gate:allow(R_LEAK_IP): vendor documentation example range\n'
      'B = "10.20.30.41"  # gate:allow(R_LEAK_MAC): wrong code here\n'
      'C = "10.20.30.42"  # gate:allow(R_LEAK_IP): short\n')
    rep = wg.run_check(src)
    assert [f["line"] for f in rep["findings"] if f["code"] == "R_LEAK_IP"] == [2, 3]
    assert [f["line"] for f in rep["allowed"]] == [1]


def test_private_key_and_jwt_flagged(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "docs" / "note.md", "-----BEGIN PRIVATE KEY-----\n")
    w(src / "docs" / "n2.md", "t = eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij\n")
    assert {"R_LEAK_PRIVATE_KEY", "R_LEAK_TOKEN"} <= codes(wg.run_check(src))


def test_autonomous_timers_must_be_documented(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "custom_components" / "demo_intercom" / "ticker.py",
      "from homeassistant.helpers.event import async_track_time_interval\n\ndef setup(hass, cb, dt):\n    async_track_time_interval(hass, cb, dt)\n")
    rep = wg.run_check(src)
    assert rep["exit_code"] == 5 and codes(rep) == {"R_TIMER_UNDOCUMENTED"}
    w(src / "docs" / "AUTONOMOUS_TIMERS.md", "# Timers\n| ticker | hold-open tick | restart: re-armed from storage |\n")
    assert wg.run_check(src)["exit_code"] == 0


# ---------------------------------------------------------------- socket scan

def sock_sites(src: Path) -> list[tuple[str, str | None]]:
    rep = wg.run_check(src)
    return [(s["mechanism"], s.get("function")) for s in rep["socket_sites"]]


def test_socket_mechanisms_detected_by_ast(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "tests" / "test_net.py",
      "import pytest\nfrom pytest_socket import enable_socket as es\nm = pytest.mark\n\n"
      "async def fx(hass, socket_enabled):\n    pass\n\n"
      "@pytest.mark.enable_socket\ndef test_a():\n    pass\n\n"
      "@m.allow_hosts(['x'])\ndef test_b():\n    es()\n\n"
      "def test_c(request):\n    request.getfixturevalue(argname='socket_enabled')\n\n"
      'ADDOPTS: list = ["-p", "no:socket", "--allow-hosts=a"]\n'
      "addopts = ['-pno:pytest_socket']\n")
    mech = {m for m, _ in sock_sites(src)}
    assert mech == {"fixture_socket_enabled", "import_pytest_socket", "marker_enable_socket", "marker_allow_hosts",
                    "call_enable_socket", "string_lookup", "cli_or_ini_option", "plugin_disabled"}


def test_socket_passive_strings_and_unrelated_names_are_not_use(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "tests" / "test_scanner_like.py",
      "def test_write(tmp_path):\n    (tmp_path / 'f.py').write_text('def t(socket_enabled): pass  # --allow-hosts')\n\n"
      "def test_other(request):\n    request.getfixturevalue('hass')\n    x = {'k': 'socket_enabled'}\n")
    rep = wg.run_check(src)
    assert rep["socket_sites"] == [] and rep["exit_code"] == 0


def test_socket_ini_option_detected_and_new_use_is_exit_5(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "pytest.ini", "[pytest]\n# --allow-hosts in a comment is ignored\naddopts = -p no:socket\n")
    rep = wg.run_check(src)
    assert rep["exit_code"] == 5 and codes(rep) == {"R_SOCKET_NEW_USE"}
    assert [s["mechanism"] for s in rep["socket_sites"]] == ["plugin_disabled"]


def _registered(src: Path, tmp: Path) -> tuple[Path, str]:
    f = src / "tests" / "test_srv.py"
    w(f, "async def srv(hass, socket_enabled):\n    pass\n")
    digest = wg.sha256_file(f)
    doc = {"schema": "arx-exchange/socket-exceptions/1", "package": "demo", "version": "2.0.1", "source_commit": "0" * 40,
           "pytest_socket_version": "0.8.0",
           "gate_flags": {"disable_socket": True, "allow_unix_socket": False, "allow_hosts": [], "force_enable_socket": False},
           "exceptions": [{"path": "tests/test_srv.py", "file_sha256": digest, "mechanism": "fixture_socket_enabled",
                           "sites": [{"line": 1, "function": "srv"}], "network_scope": "loopback_only", "purpose": "fixture server on loopback"}],
           "approvals": [{"party": "arx", "date": "2026-10-05"}]}
    p = tmp / "socket-exceptions.json"
    p.write_text(json.dumps(doc), encoding="utf-8")
    return p, wg.sha256_file(p)


def test_registered_socket_exception_passes_only_with_the_registered_hash(tmp_path):
    src = make_tree(tmp_path / "s")
    p, sha = _registered(src, tmp_path)
    assert wg.run_check(src, socket_exceptions=p, socket_sha=sha)["exit_code"] == 0
    rep = wg.run_check(src, socket_exceptions=p, socket_sha="0" * 64)
    assert rep["exit_code"] == 5 and "R_SOCKET_EXCEPTIONS_UNREGISTERED" in codes(rep)
    assert wg.run_check(src, socket_exceptions=p)["exit_code"] == 5
    # the covered file changes by a byte: the exception no longer applies
    w(src / "tests" / "test_srv.py", "async def srv(hass, socket_enabled):\n    pass\n# x\n")
    assert "R_SOCKET_NEW_USE" in codes(wg.run_check(src, socket_exceptions=p, socket_sha=sha))


def test_invalid_socket_exceptions_file_is_structural(tmp_path):
    src = make_tree(tmp_path / "s")
    bad = tmp_path / "e.json"
    bad.write_text('{"schema": "x"}', encoding="utf-8")
    rep = wg.run_check(src, socket_exceptions=bad, socket_sha="0" * 64)
    assert rep["exit_code"] == 2 and "S_SOCKET_EXCEPTIONS_INVALID" in codes(rep)


# ---------------------------------------------------------------- baseline

def baseline(tmp: Path, exclusions: list[dict], mandatory: list[dict]) -> tuple[Path, str]:
    doc = {"schema": "arx-exchange/baseline-exclusions/1", "package": "demo", "baseline_version": 1, "mandatory": mandatory, "exclusions": exclusions}
    p = tmp / "baseline.json"
    p.write_text(json.dumps(doc), encoding="utf-8")
    return p, wg.sha256_file(p)


def test_baseline_unknown_hash_exit_5(tmp_path):
    src = make_tree(tmp_path / "s")
    p, sha = baseline(tmp_path, [], [])
    assert wg.run_check(src, baseline=p, baseline_sha=sha)["exit_code"] == 0
    rep = wg.run_check(src, baseline=p, baseline_sha="f" * 64)
    assert rep["exit_code"] == 5 and "R_BASELINE_UNKNOWN" in codes(rep)


def test_new_exclusion_and_mandatory_exclusion_exit_5(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "tests" / "test_hw.py", "import pytest\n\n@pytest.mark.hardware\ndef test_needs_station():\n    pass\n")
    p, sha = baseline(tmp_path, [], [])
    rep = wg.run_check(src, baseline=p, baseline_sha=sha)
    assert rep["exit_code"] == 5 and codes(rep) == {"R_EXCLUSION_NOT_IN_BASELINE"}
    p2, sha2 = baseline(tmp_path, [{"node_id": "tests/test_hw.py::test_needs_station"}],
                        [{"category": "door_safety", "match": "file", "value": "tests/test_hw.py", "min_count": 1}])
    assert "R_MANDATORY_TEST_EXCLUDED" in codes(wg.run_check(src, baseline=p2, baseline_sha=sha2))
    p3, sha3 = baseline(tmp_path, [{"node_id": "tests/test_hw.py::test_needs_station"}], [])
    assert wg.run_check(src, baseline=p3, baseline_sha=sha3)["exit_code"] == 0


def test_mandatory_file_with_too_few_tests_is_missing_tests_exit_4(tmp_path):
    src = make_tree(tmp_path / "s")
    p, sha = baseline(tmp_path, [], [{"category": "trusted_caller", "match": "file", "value": "tests/test_basic.py", "min_count": 5}])
    rep = wg.run_check(src, baseline=p, baseline_sha=sha)
    assert rep["exit_code"] == 4 and rep["result"] == "missing_tests"
    p2, sha2 = baseline(tmp_path, [], [{"category": "trusted_caller", "match": "file", "value": "tests/test_gone.py", "min_count": 1}])
    assert wg.run_check(src, baseline=p2, baseline_sha=sha2)["exit_code"] == 4
    p3, sha3 = baseline(tmp_path, [], [{"category": "trusted_caller", "match": "file", "value": "tests/test_basic.py", "min_count": 2}])
    assert wg.run_check(src, baseline=p3, baseline_sha=sha3)["exit_code"] == 0


def test_parametrized_file_below_static_count_is_only_a_warning(tmp_path):
    src = make_tree(tmp_path / "s")
    w(src / "tests" / "test_p.py", "import pytest\n\n@pytest.mark.parametrize('x', [1, 2, 3])\ndef test_p(x):\n    pass\n")
    p, sha = baseline(tmp_path, [], [{"category": "contract", "match": "file", "value": "tests/test_p.py", "min_count": 3}])
    rep = wg.run_check(src, baseline=p, baseline_sha=sha)
    assert rep["exit_code"] == 0
    assert any(f["code"] == "M_MANDATORY_MISSING" and f["severity"] == "warning" for f in rep["findings"])


# ---------------------------------------------------------------- exit code priority and the offline runner

def test_exit_code_priority_matches_gate_md():
    assert wg.pick_exit([1, 4, 3, 7, 5, 2, 6]) == 6
    assert wg.pick_exit([1, 4, 3, 7, 5, 2]) == 2
    assert wg.pick_exit([1, 4, 3, 7, 5]) == 5
    assert wg.pick_exit([1, 4, 3, 7]) == 7
    assert wg.pick_exit([1, 4, 3]) == 3
    assert wg.pick_exit([1, 4]) == 4
    assert wg.pick_exit([1]) == 1
    assert wg.pick_exit([]) == 0


def test_mixed_failures_report_the_first_by_priority(tmp_path):
    src = make_tree(tmp_path / "s")
    (src / "ARX_IMPACT.md").unlink()  # structural
    w(src / "custom_components" / "demo_intercom" / "cfg.py", 'H = "10.1.2.3"\n')  # policy
    assert wg.run_check(src)["exit_code"] == 2


def test_run_tests_passes_clean_command(tmp_path):
    src = make_tree(tmp_path / "s")
    res = wg.run_tests(src, [sys.executable, "-c", "print('1 passed')"], 30, None, None)
    assert res["exit_code"] == 0 and res["network_attempts"] == 0 and res["collected_estimate"] == 1


def test_run_tests_blocks_and_reports_network_attempt(tmp_path):
    src = make_tree(tmp_path / "s")
    code = ("import socket\ns = socket.socket()\ntry:\n    s.connect(('192.0.2.1', 9))\nexcept OSError as e:\n    print('blocked', e)\n"
            "try:\n    socket.getaddrinfo('example.invalid', 80)\nexcept OSError as e:\n    print('dns blocked')\n")
    res = wg.run_tests(src, [sys.executable, "-c", code], 30, None, None)
    assert res["exit_code"] == 7 and res["result"] == "network_attempt" and res["network_attempts"] == 2
    assert "blocked" in res["stdout_tail"]


def test_run_tests_loopback_is_allowed_and_failure_maps_to_1(tmp_path):
    src = make_tree(tmp_path / "s")
    code = ("import socket\nl = socket.socket()\nl.bind(('127.0.0.1', 0))\nl.listen(1)\nc = socket.socket()\nc.connect(l.getsockname())\nprint('1 passed')\n")
    assert wg.run_tests(src, [sys.executable, "-c", code], 30, None, None)["exit_code"] == 0
    assert wg.run_tests(src, [sys.executable, "-c", "import sys; sys.exit(1)"], 30, None, None)["exit_code"] == 1
    assert wg.run_tests(src, [sys.executable, "-c", "import sys; sys.exit(5)"], 30, None, None)["exit_code"] == 4
    assert wg.run_tests(src, [sys.executable, "-c", "print('3 passed')"], 30, 5, None)["exit_code"] == 4
    assert wg.run_tests(src, ["definitely-not-a-command-xyz"], 30, None, None)["exit_code"] == 6


def test_cli_check_manifest_and_json(tmp_path, capsys):
    src = make_tree(tmp_path / "s")
    out = tmp_path / "r.json"
    assert wg.main(["check", "--source", str(src), "--json", str(out)]) == 0
    rep = json.loads(out.read_text(encoding="utf-8"))
    assert rep["schema"] == wg.REPORT_SCHEMA and rep["exit_code"] == 0
    mf = tmp_path / "m.json"
    assert wg.main(["manifest", "--source", str(src), "--out", str(mf)]) == 0
    assert json.loads(mf.read_text(encoding="utf-8"))["package"]["tree_sha256"] == rep["manifest"]["package"]["tree_sha256"]
    assert wg.main(["check", "--source", str(tmp_path / "missing")]) == 2
    empty = tmp_path / "empty"
    empty.mkdir()
    assert wg.main(["check", "--source", str(empty)]) == 2
    assert wg.main(["manifest", "--source", str(empty)]) == 2
