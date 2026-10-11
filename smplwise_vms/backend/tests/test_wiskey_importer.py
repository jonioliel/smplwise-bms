"""CR-035 WisKey importer stage 1: offline package verification, the Arx import manifest, the staged / journalled install against a
fake platform folder, and the administration API. Every fixture is synthetic and built here (a tiny git repository and its bundle);
no real WisKey content, no network, no live system. Address- and secret-shaped test values are assembled at run time so this file
itself carries none."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import now_iso
from smplwise.main import create_app
from smplwise.services.wiskey_import import common, gitbox, install, intake, profile, scan, store

PKG = "wiskey-fake-pkg-1"
SRC_REF = "refs/heads/wiskey/source-fake"
HIST_REF = "refs/heads/wiskey/history-fake"
DOMAIN = "fake_intercom"
GIT = shutil.which("git")
pytestmark = pytest.mark.skipif(GIT is None, reason="git CLI not available")

SOCKET_PATH = "handoff/exchange/socket/registered/socket-exceptions.json"
TESTS_MANIFEST_PATH = "handoff/exchange/staging/tests-manifest.draft.json"
SPEC_PATH = "docs/reports/fake/PKG02_INPUT_SPEC.json"


def _git(cwd: Path, *args: str, check: bool = True) -> str:
    cfg = cwd.parent / "test-empty.gitconfig"
    if not cfg.exists():
        cfg.write_bytes(b"")
    env = {**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": str(cfg), "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid",
           "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.invalid", "GIT_AUTHOR_DATE": "2026-01-01T00:00:00Z",
           "GIT_COMMITTER_DATE": "2026-01-01T00:00:00Z"}
    p = subprocess.run([GIT, *args], cwd=str(cwd), env=env, capture_output=True, check=False)
    if check and p.returncode != 0:
        raise AssertionError(p.stderr.decode("utf-8", "replace"))
    return p.stdout.decode("utf-8", "replace").strip()


def _w(root: Path, rel: str, text: str) -> None:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(text.encode("utf-8"))


def _manifest_json(version: str) -> str:
    return json.dumps({"domain": DOMAIN, "name": "Fake intercom", "version": version}) + "\n"


@dataclass
class Fixture:
    root: Path
    repo: Path
    exchange: Path
    pkg: Path
    c1: str
    c2: str
    profile_raw: dict
    work: Path

    def profile(self) -> profile.Profile:
        return profile.parse_profile(json.dumps(self.profile_raw).encode())

    def resum(self) -> None:
        """Rewrite SHA256SUMS after a deliberate change (so the change is caught by a later check, not by P05)."""
        lines = []
        for p in sorted(self.pkg.rglob("*")):
            rel = p.relative_to(self.pkg).as_posix()
            if p.is_file() and rel != "SHA256SUMS":
                lines.append(f"{common.sha256_bytes(p.read_bytes())}  {rel}\n")
        (self.pkg / "SHA256SUMS").write_bytes("".join(lines).encode())

    def run(self, prof: profile.Profile | None = None) -> intake.IntakeResult:
        return intake.run_intake(self.pkg, PKG, prof or self.profile(), self.work, now=now_iso)


def build(tmp: Path, *, kind: str = "reference_only", source_version: str = "1.1.0", extra_installable: dict[str, str] | None = None,
          exec_file: str | None = None) -> Fixture:
    repo = tmp / "src"
    repo.mkdir(parents=True)
    _git(repo, "init", "--quiet", "--object-format=sha1", ".")
    _w(repo, "README.md", "synthetic source\n")
    _w(repo, f"custom_components/{DOMAIN}/manifest.json", _manifest_json("1.0.0"))
    _w(repo, f"custom_components/{DOMAIN}/__init__.py", "DOMAIN = 'fake_intercom'\n")
    _w(repo, "tests/test_basic.py", "def test_ok():\n    assert True\n")
    _w(repo, "handoff/g1/HANDOFF_MANIFEST.json", '{"group": "G1"}\n')
    _w(repo, "docs/old.md", "old note\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "--quiet", "-m", "c1")
    c1 = _git(repo, "rev-parse", "HEAD")
    _w(repo, f"custom_components/{DOMAIN}/manifest.json", _manifest_json(source_version))
    _w(repo, f"custom_components/{DOMAIN}/lock.py", "def unlock():\n    return 'sent'\n")
    for rel, text in (extra_installable or {}).items():
        _w(repo, f"custom_components/{DOMAIN}/{rel}", text)
    _w(repo, "docs/support_a.md", "support a\n")
    _w(repo, "docs/support_b.md", "support b\n")
    _w(repo, "handoff/baseline/baseline-exclusions.json", '{"exclusions": []}\n')
    _w(repo, "requirements-gate.txt", "pytest==8.0.0\n")
    _w(repo, "pyproject.toml", "[tool.pytest.ini_options]\n")
    _git(repo, "add", "-A")
    if exec_file:
        _git(repo, "update-index", "--chmod=+x", f"custom_components/{DOMAIN}/{exec_file}")
    _git(repo, "commit", "--quiet", "-m", "c2")
    c2 = _git(repo, "rev-parse", "HEAD")
    _git(repo, "update-ref", SRC_REF, c2)
    _git(repo, "update-ref", HIST_REF, c1)

    exchange = tmp / "exchange"
    pkg = exchange / PKG
    (pkg / "bundle").mkdir(parents=True)
    _git(repo, "bundle", "create", str(pkg / "bundle" / f"{PKG}.bundle"), SRC_REF, HIST_REF)

    def blob(commit: str, path: str) -> str:
        return _git(repo, "rev-parse", f"{commit}:{path}")

    def show(commit: str, path: str) -> bytes:
        return subprocess.run([GIT, "-C", str(repo), "cat-file", "blob", blob(commit, path)], capture_output=True, check=True).stdout

    support_paths = ["docs/support_a.md", "docs/support_b.md", "handoff/baseline/baseline-exclusions.json"]
    support = []
    for sp in support_paths:
        data = show(c2, sp)
        _w(pkg / "support", sp, data.decode())
        support.append({"path": sp, "mode": "100644", "sha256": common.sha256_bytes(data), "size": len(data), "git_blob": blob(c2, sp),
                        "binding_ref": c2, "hash_evidence": "synthetic"})
    socket_bytes = b'{"schema": "synthetic-socket-exceptions", "sites": []}\n'
    tm_bytes = b'{"schema": "synthetic-tests-manifest", "version": "1.1.0-rc.2"}\n'
    hist = []
    for hp in ("docs/old.md", "README.md"):
        data = show(c1, hp)
        hist.append({"group": "G1", "ref": c1, "path": hp, "sha256": common.sha256_bytes(data), "mode": "100644", "git_blob": blob(c1, hp)})
    gm = show(c1, "handoff/g1/HANDOFF_MANIFEST.json")
    src_tests = []
    for tp in ("tests/test_basic.py", "pyproject.toml"):
        data = show(c2, tp)
        src_tests.append({"path": tp, "sha256": common.sha256_bytes(data), "mode": "100644", "git_blob": blob(c2, tp)})
    tests = [
        {"path": "tests/test_basic.py", "binding_path": "tests/test_basic.py", "sha256": src_tests[0]["sha256"], "role": "test", "binding": "source"},
        {"path": "pyproject.toml", "binding_path": "pyproject.toml", "sha256": src_tests[1]["sha256"], "role": "doc_input", "binding": "source"},
        {"path": "docs/support_a.md", "binding_path": "docs/support_a.md", "sha256": support[0]["sha256"], "role": "doc_input", "binding": "support"},
        {"path": "gate/socket-exceptions.json", "binding_path": SOCKET_PATH, "sha256": common.sha256_bytes(socket_bytes), "role": "metadata", "binding": "registered"},
    ]
    spec = {
        "schema": profile.INPUT_SPEC_SCHEMA, "source_commit": c2, "refs": sorted([c1, c2]),
        "history_groups": [{"id": "G1", "ref": c1, "record_count": 2,
                            "manifest": {"path": "handoff/g1/HANDOFF_MANIFEST.json", "sha256": common.sha256_bytes(gm), "size": len(gm), "line": None}}],
        "support": support, "history": hist, "tests": tests, "source_test_files": src_tests,
        "registered_files": [{"path": SOCKET_PATH, "sha256": common.sha256_bytes(socket_bytes), "mode": "100644", "provenance": "synthetic"}],
        "expected_counts": {"support": 3, "history_records": 2, "tests": 4},
    }
    spec_bytes = (json.dumps(spec, indent=1) + "\n").encode()
    metas = []
    for role, path, data in (("tests_manifest", TESTS_MANIFEST_PATH, tm_bytes), ("socket", SOCKET_PATH, socket_bytes), ("input_spec", SPEC_PATH, spec_bytes)):
        p = pkg / "metadata" / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        metas.append({"role": role, "source_path": path, "sha256": common.sha256_bytes(data), "size": len(data), "git_blob": common.git_blob_id(data),
                      "source_commit": c1})
    refs = {SRC_REF: c2, HIST_REF: c1}
    pm = {"package": PKG, "source_commit": c2, "source_version": source_version, "tests_manifest_version": "1.1.0-rc.2", "expected_collected": None,
          "refs": refs, "bundle_format": 2, "git_object_format": "sha1", "prerequisites": [], "install_ready": kind == "install_candidate",
          "unsigned_for_test": True, "release": False, "zip": False, "no_import_manifest_by_WisKey": True,
          "counts": {"refs": 2, "support": 3, "history_records": 2, "tests": 4}}
    (pkg / "PACKAGE_MANIFEST.json").write_bytes((json.dumps(pm, indent=1) + "\n").encode())
    raw = {
        "schema": profile.SCHEMA, "id": "fake-profile-1", "kind": kind, "refs": refs, "source_ref": SRC_REF, "ancestry": [HIST_REF, SRC_REF],
        "source_version": source_version, "tests_manifest_version": "1.1.0-rc.2",
        "manifest_expect": {"unsigned_for_test": True, "release": False, "zip": False, "install_ready": kind == "install_candidate",
                            "prerequisites": [], "counts.support": 3},
        "metadata": metas, "input_spec_role": "input_spec",
        "counts": {"support": 3, "history_records": 2, "history_groups": 1, "tests": 4, "source_tests": 2, "support_tests": 1, "registered_alias_tests": 1},
        "registered": [
            {"name": "baseline", "location": "support", "path": "handoff/baseline/baseline-exclusions.json", "sha256": support[2]["sha256"]},
            {"name": "requirements", "location": "source", "path": "requirements-gate.txt", "sha256": common.sha256_bytes(show(c2, "requirements-gate.txt"))},
            {"name": "socket", "location": "metadata", "path": SOCKET_PATH, "sha256": common.sha256_bytes(socket_bytes)},
            {"name": "tests_manifest", "location": "metadata", "path": TESTS_MANIFEST_PATH, "sha256": common.sha256_bytes(tm_bytes)},
        ],
        "installable_domains": [DOMAIN],
    }
    fx = Fixture(tmp, repo, exchange, pkg, c1, c2, raw, tmp / "work")
    fx.resum()
    return fx


def statuses(res: intake.IntakeResult) -> dict[str, str]:
    return {c["id"]: c["status"] for c in res.report["checks"]}


# ---------------------------------------------------------------------- verification

def test_clean_reference_package_passes_and_the_manifest_is_arx_built_and_deterministic(tmp_path):
    fx = build(tmp_path)
    res = fx.run()
    st = statuses(res)
    assert res.passed, res.report["checks"]
    assert all(v == "PASS" for v in st.values()), st
    m = res.manifest
    assert m["schema"] == intake.MANIFEST_SCHEMA and m["install_ready"] is False and m["executed_imported_code"] is False
    assert m["source"]["commit"] == fx.c2 and m["refs"] == {SRC_REF: fx.c2, HIST_REF: fx.c1}
    assert [x["role"] for x in m["metadata"]] == ["tests_manifest", "socket", "input_spec"]
    assert all(set(x) >= {"sha256", "size", "git_blob", "source_commit"} for x in m["metadata"])  # M1
    dom = m["installable"][0]
    assert dom["domain"] == DOMAIN and dom["version"] == "1.1.0" and {f["path"] for f in dom["files"]} == {"manifest.json", "__init__.py", "lock.py"}
    assert m["status"] == {"profile": "unsigned_for_test", "signature": None, "release": False, "ready": False, "receipt": False}
    again = fx.run()
    assert common.canonical_json(again.manifest) == common.canonical_json(m) and again.report["manifest_sha256"] == res.report["manifest_sha256"]
    assert res.installable == {DOMAIN: res.installable[DOMAIN]} and res.installable[DOMAIN]
    text = json.dumps(res.report)
    assert str(tmp_path) not in text and str(tmp_path).replace("\\", "/") not in text, "no absolute path in the report (M4)"
    assert res.report["executed_imported_code"] is False and res.report["network_used"] is False and res.report["checkout_performed"] is False
    assert "complete history" in json.dumps(res.report["checks"][10]).lower()
    assert list(fx.work.iterdir()) == [], "the throwaway git sandbox is removed"


def test_wiskey_transport_files_are_not_trusted_for_decisions(tmp_path):
    fx = build(tmp_path)
    pm = json.loads((fx.pkg / "PACKAGE_MANIFEST.json").read_bytes())
    pm["release"] = True
    pm["refs"][SRC_REF] = fx.c1
    (fx.pkg / "PACKAGE_MANIFEST.json").write_bytes(json.dumps(pm).encode())
    fx.resum()
    res = fx.run()
    st = statuses(res)
    assert st["P06"] == "FAIL" and set(res.report["checks"][5]["data"]["fields"]) == {"refs", "release"}
    assert st["B01"] == "NOT_RUN" and not res.passed and res.manifest is None


def test_sums_layout_hygiene_and_caps_stop_before_git(tmp_path):
    fx = build(tmp_path)
    (fx.pkg / "support" / "docs" / "support_a.md").write_bytes(b"changed\n")
    res = fx.run()
    assert statuses(res)["P05"] == "FAIL" and statuses(res)["B02"] == "NOT_RUN"
    fx.resum()
    assert statuses(fx.run())["T01"] == "FAIL", "support bytes no longer equal the spec / the tree"

    fx2 = build(tmp_path / "b")
    (fx2.pkg / "EXTRA.txt").write_bytes(b"x")
    fx2.resum()
    st = statuses(fx2.run())
    assert st["P02"] == "FAIL" and st["P05"] == "NOT_RUN" and st["B02"] == "NOT_RUN"
    assert not fx2.work.exists() or list(fx2.work.iterdir()) == []

    fx3 = build(tmp_path / "c")
    raw = dict(fx3.profile_raw, limits={"max_bundle_bytes": 10})
    st = statuses(fx3.run(profile.parse_profile(json.dumps(raw).encode())))
    assert st["P04"] == "FAIL" and st["P05"] == "NOT_RUN"

    fx4 = build(tmp_path / "d")
    (fx4.pkg / "SHA256SUMS").write_bytes((fx4.pkg / "SHA256SUMS").read_bytes().replace(b"\n", b"\r\n"))
    assert statuses(fx4.run())["P05"] == "FAIL"


def test_a_link_in_the_package_is_refused(tmp_path):
    fx = build(tmp_path)
    try:
        os.symlink(fx.pkg / "support" / "docs" / "support_a.md", fx.pkg / "support" / "docs" / "link.md")
    except (OSError, NotImplementedError):
        pytest.skip("symlinks not permitted on this machine")
    res = fx.run()
    assert statuses(res)["P03"] == "FAIL" and "symlink" in res.report["checks"][2]["data"]["issues"]


def test_metadata_must_match_the_profile_records(tmp_path):
    fx = build(tmp_path)
    raw = json.loads(json.dumps(fx.profile_raw))
    raw["metadata"][1]["sha256"] = "0" * 64
    res = fx.run(profile.parse_profile(json.dumps(raw).encode()))
    assert statuses(res)["P07"] == "FAIL" and statuses(res)["P08"] == "NOT_RUN"
    fx2 = build(tmp_path / "b")
    (fx2.pkg / "metadata" / "extra.json").write_bytes(b"{}")
    fx2.resum()
    assert statuses(fx2.run())["P07"] == "FAIL"


def test_input_spec_counts_must_equal_the_profile(tmp_path):
    fx = build(tmp_path)
    raw = json.loads(json.dumps(fx.profile_raw))
    raw["counts"]["support"] = 4
    res = fx.run(profile.parse_profile(json.dumps(raw).encode()))
    assert statuses(res)["P08"] == "FAIL" and "count_support" in res.report["checks"][7]["data"]["problems"]


def test_bundle_with_an_extra_ref_or_prerequisites_is_refused(tmp_path):
    fx = build(tmp_path)
    _git(fx.repo, "update-ref", "refs/heads/wiskey/extra", fx.c1)
    b = fx.pkg / "bundle" / f"{PKG}.bundle"
    b.unlink()
    _git(fx.repo, "bundle", "create", str(b), SRC_REF, HIST_REF, "refs/heads/wiskey/extra")
    fx.resum()
    res = fx.run()
    assert statuses(res)["B01"] == "FAIL" and res.report["checks"][8]["detail"] == "refs_differ" and statuses(res)["B02"] == "NOT_RUN"

    b.unlink()
    _git(fx.repo, "bundle", "create", str(b), f"{HIST_REF}..{SRC_REF}")  # a thin bundle: it needs c1 as a prerequisite
    fx.resum()
    res = fx.run()
    assert statuses(res)["B01"] == "FAIL" and res.report["checks"][8]["detail"] == "prerequisites_present"


def test_corrupt_pack_fails_verify_or_fsck(tmp_path):
    fx = build(tmp_path)
    b = fx.pkg / "bundle" / f"{PKG}.bundle"
    data = bytearray(b.read_bytes())
    data[-30] ^= 0xFF
    b.write_bytes(bytes(data))
    fx.resum()
    res = fx.run()
    st = statuses(res)
    assert not res.passed and "FAIL" in (st["B03"], st["B05"], st["B06"]) and res.manifest is None


def test_ancestry_is_checked(tmp_path):
    fx = build(tmp_path)
    raw = dict(fx.profile_raw, ancestry=[SRC_REF, HIST_REF])
    res = fx.run(profile.parse_profile(json.dumps(raw).encode()))
    assert statuses(res)["B07"] == "FAIL"


def test_installable_part_forbidden_content_is_reported_without_values(tmp_path):
    ip = ".".join(["10", "20", "30", "40"])
    mac = ":".join(["02", "1a", "2b", "3c", "4d", "5e"])
    secret_value = "Qw" + "9zLk" + "Vb7r"
    fx = build(tmp_path, extra_installable={"const.py": f"HOST = '{ip}'\nMACADDR = '{mac}'\napi_key = '{secret_value}'\n",
                                            "tests/test_inside.py": "def test_x():\n    pass\n"})
    res = fx.run()
    st = statuses(res)
    assert st["I04"] == "FAIL" and not res.passed and res.manifest is None
    data = res.report["checks"][-1]["data"]
    assert {f["code"] for f in data["findings"]} == {"leak_ipv4", "leak_mac", "leak_secret"}
    assert any("tests/test_inside.py" in n for n in data["forbidden_names"])
    text = json.dumps(res.report)
    assert ip not in text and mac not in text and secret_value not in text, "findings never carry the matched value"


def test_installable_modes_and_manifest_version(tmp_path):
    fx = build(tmp_path, exec_file="lock.py")
    assert statuses(fx.run())["I01"] == "FAIL"
    fx2 = build(tmp_path / "b")
    raw = dict(fx2.profile_raw, source_version="9.9.9")
    st = statuses(fx2.run(profile.parse_profile(json.dumps(raw).encode())))
    assert st["P06"] == "FAIL", "the package manifest carries 1.1.0 while the profile registered 9.9.9"


def test_profile_rules():
    good = {"schema": profile.SCHEMA, "id": "p", "kind": "reference_only", "refs": {SRC_REF: "a" * 40}, "source_ref": SRC_REF,
            "metadata": [{"role": "input_spec", "source_path": "x.json", "sha256": "b" * 64, "size": 1, "git_blob": "c" * 40, "source_commit": "d" * 40}],
            "input_spec_role": "input_spec", "counts": {k: 0 for k in profile.COUNT_KEYS}}
    assert profile.parse_profile(json.dumps(good).encode()).limits == profile.DEFAULT_LIMITS
    for change, code in (({"limits": {"max_bundle_bytes": profile.DEFAULT_LIMITS["max_bundle_bytes"] + 1}}, "limits"),
                         ({"refs": {"refs/tags/v1": "a" * 40}}, "refs"), ({"kind": "install_candidate"}, "install_candidate_without_domains"),
                         ({"refs": {SRC_REF: "a" * 40, "refs/heads/x/../y": "a" * 40}}, "refs")):
        with pytest.raises(profile.ProfileError) as e:
            profile.parse_profile(json.dumps({**good, **change}).encode())
        assert e.value.code == code
    with pytest.raises(profile.ProfileError):
        profile.parse_profile(b'{"schema": "a", "schema": "b"}')


def test_path_rules_and_strict_json():
    for bad in ("/abs", "a\\b", "a/../b", "a/.git/x", "c:x", "a/CON.txt", "a/b ", "a\x01b", ""):
        assert common.path_issue(bad), bad
    assert common.path_issue("docs/תיעוד.md") is None and common.path_issue("custom_components/x/manifest.json") is None
    with pytest.raises(common.StrictJsonError):
        common.load_json_strict(b'\xef\xbb\xbf{}')
    with pytest.raises(common.StrictJsonError):
        common.load_json_strict(b'{"a": NaN}')
    assert common.git_blob_id(b"") == "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"
    assert scan.name_issue("translations/he.json") is None and scan.name_issue("x/secrets.yaml") == "forbidden_name"


def test_git_runs_isolated_and_without_secrets(tmp_path, monkeypatch):
    monkeypatch.setenv("SUPERVISOR_TOKEN", "never-pass-this-token")
    seen = []
    real = subprocess.run

    def spy(cmd, *a, **kw):
        seen.append((cmd, kw))
        return real(cmd, *a, **kw)

    fx = build(tmp_path)
    monkeypatch.setattr(gitbox.subprocess, "run", spy)
    assert fx.run().passed
    assert seen
    for cmd, kw in seen:
        env = kw["env"]
        assert "never-pass-this-token" not in json.dumps(env) and "SUPERVISOR_TOKEN" not in env
        assert env["GIT_CONFIG_NOSYSTEM"] == "1" and env["GIT_ALLOW_PROTOCOL"] == "" and env["GIT_TERMINAL_PROMPT"] == "0"
        assert "protocol.allow=never" in cmd and any(c.startswith("core.hooksPath=") for c in cmd)
        assert not {"clone", "fetch", "pull", "push", "checkout", "remote", "submodule"} & set(cmd)
    assert any("unbundle" in cmd for cmd, _ in seen) and any("fsck" in cmd for cmd, _ in seen)


# ---------------------------------------------------------------------- install (fakes: a temporary platform folder)

_CANDIDATES: dict[str, tuple[Fixture, intake.IntakeResult]] = {}


@pytest.fixture(scope="module")
def candidate_root(tmp_path_factory):
    return tmp_path_factory.mktemp("candidates")


def _install_ready(tmp: Path, version: str = "1.1.0", root: Path | None = None):
    """An install-candidate intake (built once per version and module: git process start-up is slow on Windows), staged under tmp."""
    if version not in _CANDIDATES:
        fx = build((root or tmp) / f"cand-{version}", kind="install_candidate", source_version=version)
        res = fx.run()
        assert res.passed, res.report["checks"]
        _CANDIDATES[version] = (fx, res)
    fx, res = _CANDIDATES[version]
    staging = install.stage(res.manifest, res.installable, tmp / f"staging-{version}")
    return fx, res, staging


def test_install_plan_stage_apply_marker_and_no_downgrade(tmp_path, candidate_root):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    _fx, res, staging = _install_ready(tmp_path, root=candidate_root)
    assert install.plan_install(res.manifest, cfg, switch_on=False)["refused"]["code"] == "import_disabled"
    plan = install.plan_install(res.manifest, cfg, switch_on=True)
    assert plan["refused"] is None and plan["domains"][0]["action"] == "install"
    with pytest.raises(install.InstallRefused):
        install.apply_install(res.manifest, plan, staging, cfg, tmp_path / "journal", switch_on=False, intake_id="i", now=now_iso)
    j = install.apply_install(res.manifest, plan, staging, cfg, tmp_path / "journal", switch_on=True, intake_id=res.report["intake_id"], now=now_iso)
    target = cfg / "custom_components" / DOMAIN
    assert j["state"] == "committed" and install.read_marker(target)["version"] == "1.1.0"
    assert (target / "lock.py").read_bytes() == b"def unlock():\n    return 'sent'\n"
    assert install.folder_tree(target) == (res.manifest["installable"][0]["tree_sha256"], 3)
    assert sorted(p.name for p in (cfg / "custom_components").iterdir()) == [DOMAIN], "no .arx-new / .arx-old left"
    assert install.plan_install(res.manifest, cfg, switch_on=True)["domains"][0]["action"] == "noop"
    # an older version is never installed over a newer one
    _fx0, res0, _s0 = _install_ready(tmp_path, version="1.0.1", root=candidate_root)
    assert install.plan_install(res0.manifest, cfg, switch_on=True)["refused"]["code"] == "downgrade_refused"
    # a reference-only manifest is never installable
    ref = build(tmp_path / "ref").run()
    assert install.plan_install(ref.manifest, cfg, switch_on=True)["refused"]["code"] == "not_install_candidate"


def test_install_never_replaces_a_folder_it_does_not_manage(tmp_path, candidate_root):
    cfg = tmp_path / "ha"
    foreign = cfg / "custom_components" / DOMAIN
    foreign.mkdir(parents=True)
    (foreign / "manifest.json").write_text("{}", encoding="utf-8")
    _fx, res, _staging = _install_ready(tmp_path, root=candidate_root)
    assert install.plan_install(res.manifest, cfg, switch_on=True)["refused"] == {"code": "target_not_managed", "domain": DOMAIN}


def test_same_version_with_other_bytes_is_refused(tmp_path, candidate_root):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    _fx, res, staging = _install_ready(tmp_path, root=candidate_root)
    plan = install.plan_install(res.manifest, cfg, switch_on=True)
    install.apply_install(res.manifest, plan, staging, cfg, tmp_path / "journal", switch_on=True, intake_id="i", now=now_iso)
    other = json.loads(json.dumps(res.manifest))
    other["installable"][0]["tree_sha256"] = "f" * 64
    assert install.plan_install(other, cfg, switch_on=True)["refused"]["code"] == "same_version_other_content"


@pytest.mark.parametrize("crash_at", ["copying", "copied", "old_moved", "swapped", "marked"])
def test_crash_at_every_step_recovers_to_old_or_new_never_half(tmp_path, crash_at, candidate_root):
    cfg = tmp_path / "ha"
    cfg.mkdir()
    journal = tmp_path / "journal"
    _f1, r1, s1 = _install_ready(tmp_path, version="1.1.0", root=candidate_root)
    install.apply_install(r1.manifest, install.plan_install(r1.manifest, cfg, switch_on=True), s1, cfg, journal, switch_on=True, intake_id="a", now=now_iso)
    old_tree = install.folder_tree(cfg / "custom_components" / DOMAIN)
    _f2, r2, s2 = _install_ready(tmp_path, version="1.2.0", root=candidate_root)
    plan = install.plan_install(r2.manifest, cfg, switch_on=True)
    assert plan["domains"][0]["action"] == "update"

    class Crash(Exception):
        pass

    def fault(_dom, step):
        if step == crash_at:
            raise Crash(step)

    with pytest.raises(Crash):
        install.apply_install(r2.manifest, plan, s2, cfg, journal, switch_on=True, intake_id="b", now=now_iso, fault=fault)
    assert install.plan_install(r2.manifest, cfg, switch_on=True)["refused"] is not None or crash_at in ("copying", "marked")
    with pytest.raises(install.InstallRefused):
        install.apply_install(r2.manifest, plan, s2, cfg, journal, switch_on=True, intake_id="c", now=now_iso)  # unfinished journal first
    manifests = {common.sha256_bytes(common.canonical_json(r2.manifest)): r2.manifest}
    out = install.recover(journal, cfg, manifests.get, now_iso)
    assert len(out) == 1 and install.unfinished(journal) == []
    target = cfg / "custom_components" / DOMAIN
    marker = install.read_marker(target)
    assert marker is not None, "the installed folder always carries a marker after recovery"
    if crash_at in ("copying", "copied", "old_moved"):
        assert out[0]["outcome"] == "rolled_back" and install.folder_tree(target) == old_tree and marker["version"] == "1.1.0"
    else:
        assert out[0]["outcome"] == "committed" and marker["version"] == "1.2.0"
        assert install.folder_tree(target)[0] == r2.manifest["installable"][0]["tree_sha256"]
    assert sorted(p.name for p in (cfg / "custom_components").iterdir()) == [DOMAIN]


# ---------------------------------------------------------------------- API

@pytest.fixture()
def api(settings, tmp_path, monkeypatch):
    fx = build(tmp_path / "pkg")
    profiles = tmp_path / "profiles"
    profiles.mkdir()
    (profiles / "fake.json").write_text(json.dumps(fx.profile_raw), encoding="utf-8")
    (profiles / "broken.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr(profile, "PROFILES_DIR", profiles)
    monkeypatch.setenv("SW_WISKEY_EXCHANGE_DIR", str(fx.exchange))
    app = create_app(settings)
    return app, TestClient(app), fx


def _audit(app, action):
    with app.state.db.connection() as conn:
        return [dict(r) for r in conn.execute("SELECT action, decision, reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def test_api_is_for_system_administrators_and_the_switch_is_off_by_default(api, settings):
    app, c, _fx = api
    st = c.get("/api/v1/wiskey/import/status")
    assert st.status_code == 200
    body = st.json()
    assert body["enabled"] is False and body["exchange"]["packages"] == [PKG] and [p["id"] for p in body["profiles"]] == ["fake-profile-1"]
    assert body["invalid_profiles"] == [{"file": "broken.json", "code": "schema"}] and body["install"]["apply_available"] is False
    bind(c, settings, "ron", "site_admin", "installation", "*")
    for method, path, js in (("get", "/api/v1/wiskey/import/status", None), ("put", "/api/v1/wiskey/import/switch", {"enabled": True, "confirm": True}),
                             ("post", "/api/v1/wiskey/import/intakes", {"package": PKG, "profile": "fake-profile-1"})):
        r = getattr(c, method)(path, json=js, headers=as_user("ron")) if js else getattr(c, method)(path, headers=as_user("ron"))
        assert r.status_code == 403, (path, r.status_code)
    assert {r["decision"] for r in _audit(app, "wiskey.import.switch")} == {"denied"}
    r = c.post("/api/v1/wiskey/import/intakes", json={"package": PKG, "profile": "fake-profile-1"})
    assert r.status_code == 409 and r.json()["code"] == "wiskey_import_disabled"
    assert c.put("/api/v1/wiskey/import/switch", json={"enabled": True, "confirm": False}).status_code == 422


def test_api_intake_runs_offline_records_audit_and_stores_the_report(api, settings):
    app, c, _fx = api
    assert c.put("/api/v1/wiskey/import/switch", json={"enabled": True, "confirm": True}).json() == {"enabled": True}
    assert c.post("/api/v1/wiskey/import/intakes", json={"package": "missing-pkg", "profile": "fake-profile-1"}).status_code == 404
    assert c.post("/api/v1/wiskey/import/intakes", json={"package": PKG, "profile": "nope"}).status_code == 409
    assert c.post("/api/v1/wiskey/import/intakes", json={"package": "../x", "profile": "fake-profile-1"}).status_code == 422
    r = c.post("/api/v1/wiskey/import/intakes", json={"package": PKG, "profile": "fake-profile-1"})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["intake"]["result"] == "PASS" and out["plan"] is None, "a reference-only package gets no install plan"
    iid = out["intake"]["intake_id"]
    got = c.get(f"/api/v1/wiskey/import/intakes/{iid}").json()
    assert got["report"]["result"] == "PASS" and got["manifest"]["schema"] == intake.MANIFEST_SCHEMA
    assert c.get("/api/v1/wiskey/import/intakes/" + "0" * 32).status_code == 404
    phases = [json.loads(r["details_json"])["phase"] for r in _audit(app, "wiskey.import.intake") + _audit(app, "wiskey.import.intake.result")]
    assert phases == ["attempt", "outcome"]
    assert [r["decision"] for r in _audit(app, "wiskey.import.switch")] == ["allowed"]
    assert c.get("/api/v1/wiskey/import/status").json()["intakes"][0]["intake_id"] == iid
    with pytest.raises(FileExistsError):
        store.save_intake(settings, got["report"], None)  # an intake report is written once
