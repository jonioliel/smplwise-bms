#!/usr/bin/env python3
"""Self-test of engine_sync.py (GATE-HARDEN-2520, TR-02) in a throw-away git repo and a fake runner home. Touches nothing real.
  python3 scripts/gate/selftest_engine_sync.py      -> last line "SELFTEST PASSED", exit 0
"""
import atexit
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import engine_sync as es  # noqa: E402

TMP = Path(tempfile.mkdtemp(prefix="engine_sync_selftest_"))
atexit.register(shutil.rmtree, TMP, True)
FAILS = []


def check(name, cond, detail=""):
    print(("OK      " if cond else "BROKEN  ") + name + ("" if cond else f"   <- {detail}"))
    if not cond:
        FAILS.append(name)


def git(*a):
    return subprocess.run(["git", "-C", str(REPO), *a], capture_output=True, text=True, check=True).stdout.strip()


# a repo with the engine group and the gate-2 files the check compares
REPO = TMP / "repo"
gd = REPO / "scripts" / "gate"
(gd / "gate2").mkdir(parents=True)
files = {f: f"# {f} v1\n" for f in ["release_gate.py", "release_gate2.sh", "engine_sync.py", "selftest_gate.py", "gate_release.sh", "gate2_select.py",
                                     "gate2_verdict.py", "gate_entry.py", "gate_quarantine.py", "gate_summary.py", "gate_budget.py", "lint_backend.py",
                                     "select_tests.py", "gate2/select_tests.py"]}
for f, body in files.items():
    (gd / f).write_bytes((body).encode("utf-8"))
subprocess.run(["git", "init", "-q", str(REPO)], check=True)
git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A")
git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "v1")

HOME = TMP / "home"
for d in ("gate2", "nightly-gate", "smplwise-results/nightly"):
    (HOME / d).mkdir(parents=True)


def run(*argv):
    return es.main(list(argv))


# install (dry run, then apply) the default engine group from the repo checkout
rc = run("install", "--src", str(REPO), "--home", str(HOME))
check("install: dry run copies nothing", rc == 0 and not (HOME / "release_gate.py").exists(), rc)
rc = run("install", "--src", str(REPO), "--home", str(HOME), "--apply", "--suffix", ".bak_t")
check("install --apply: the engine lands in ~, ~/gate2 and ~/nightly-gate",
      rc == 0 and all((HOME / p).read_text() == files["release_gate.py"] for p in ("release_gate.py", "gate2/release_gate.py", "nightly-gate/release_gate.py")), rc)
man = json.loads((HOME / "gate_install_manifest.json").read_text())
check("install --apply: the manifest names the commit and every file's sha256",
      man["source_commit"] == git("rev-parse", "HEAD") and any(Path(f["target"]).as_posix().endswith("gate2/release_gate.py") and f["sha256"] == es.sha256_bytes(files["release_gate.py"].encode()) for f in man["files"]), man)

# the gate-2 files the check compares but the default group does not install: put the repo's copies in place by hand
for rel, inst, _ in es.CHECK_RELEASE:
    if not (HOME / inst).exists():
        shutil.copy2(gd / rel, HOME / inst)
rc = run("check", "--repo", str(REPO), "--ref", "HEAD", "--home", str(HOME), "--json", str(TMP / "c1.json"))
check("check: everything in sync -> 0", rc == 0 and json.loads((TMP / "c1.json").read_text())["strict_drift"] == 0, rc)

# the tree moves on (the GATE-ONEPROJECT-2480 case): the runner keeps the old engine
(gd / "release_gate.py").write_bytes(b"# release_gate.py v2 (one project fix)\n")
git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "v2")
rc = run("check", "--repo", str(REPO), "--ref", "HEAD", "--home", str(HOME), "--json", str(TMP / "c2.json"))
rec = json.loads((TMP / "c2.json").read_text())
check("check: an old installed engine REFUSES (rc 4) and says so in the record", rc == 4 and rec["refused"] and rec["strict_drift"] == 2, (rc, rec))
rc = run("check", "--repo", str(REPO), "--ref", "HEAD", "--home", str(HOME), "--allow-drift", "pinned for a test", "--json", str(TMP / "c3.json"))
check("check: --allow-drift runs and records the reason", rc == 0 and json.loads((TMP / "c3.json").read_text())["allowed"] == "pinned for a test", rc)
rc = run("check", "--set", "nightly", "--warn-only", "--repo", str(REPO), "--ref", "HEAD", "--home", str(HOME))
check("check: the nightly set is warn-only (rc 0 although the engine differs)", rc == 0, rc)
(HOME / "gate2" / "gate2_verdict.py").write_bytes(b"# hand edit\n")
(gd / "release_gate.py").write_bytes(files["release_gate.py"].encode("utf-8"))   # engine back in sync, a non-engine file drifts
git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "v3")
rc = run("check", "--repo", str(REPO), "--ref", "HEAD", "--home", str(HOME), "--json", str(TMP / "c4.json"))
rec = json.loads((TMP / "c4.json").read_text())
check("check: drift of a non-engine file warns (rc 0) and is listed", rc == 0 and rec["other_drift"] == 1 and rec["strict_drift"] == 0, rec)
rc = run("check", "--repo", str(REPO), "--ref", "no-such-ref", "--home", str(HOME))
check("check: an unknown ref is a usage error (rc 2)", rc == 2, rc)

# install refuses while a gate runs; backups are made once and never overwritten
(gd / "release_gate.py").write_bytes(b"# release_gate.py v4\n")
git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qam", "v4")
st = HOME / "smplwise-results" / "gate_status.json"
st.write_text(json.dumps({"state": "running"}))
rc = run("install", "--src", str(REPO), "--home", str(HOME), "--files", "release_gate.py", "--apply", "--suffix", ".bak_t")
check("install: refused while gate_status.json says running (rc 3), nothing copied",
      rc == 3 and (HOME / "release_gate.py").read_text() == files["release_gate.py"], rc)
st.write_text(json.dumps({"state": "pass"}))
rc = run("install", "--src", str(REPO), "--home", str(HOME), "--files", "release_gate.py", "--apply", "--suffix", ".bak_t")
check("install: after the gate, the new engine is installed", rc == 0 and (HOME / "release_gate.py").read_text() == "# release_gate.py v4\n", rc)
check("install: the backup of the replaced engine is kept", (HOME / "release_gate.py.bak_t").read_text() == files["release_gate.py"])
rc = run("install", "--src", str(REPO), "--home", str(HOME), "--files", "nope.py")
check("install: a file outside the install map is a usage error", rc == 2, rc)

print()
print("SELFTEST " + ("PASSED" if not FAILS else f"FAILED: {len(FAILS)} case(s): " + "; ".join(FAILS)))
sys.exit(0 if not FAILS else 1)
