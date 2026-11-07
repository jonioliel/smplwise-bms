# PY-CONSTRAINTS-LOCK-2407 - full Python constraints lock for the add-on image

Branch `chore/PY-CONSTRAINTS-LOCK-2407` from `origin/main` @ `a4652fda5` (v2.40.5). Owner decision 07.11; follows finding N1 of
`docs/changes/T005-AUDIT-2406.md` (on `release/2406-train`, not yet on main). No runner, lab or device was used.

## 1. What changed

| File | Change |
|---|---|
| `smplwise_vms/backend/constraints.txt` (new, generated) | **49 packages pinned exactly** (`name==version`, no markers, extras or hashes): the complete resolved set of `requirements.txt` for CPython 3.12 on Alpine 3.22 / musl, resolved separately for amd64 (`x86_64-unknown-linux-musl`) and aarch64 (`aarch64-unknown-linux-musl`) with uv 0.13.7 on 2026-11-07. The two resolutions are identical. |
| `smplwise_vms/Dockerfile` | `COPY backend/constraints.txt /app/constraints.txt`; `RUN pip install --no-cache-dir -r /app/requirements.txt -c /app/constraints.txt` |
| `scripts/lock_python.py` (new) | `--write` regenerates the lock (uv; both arches; refuses to write when they differ), `--diff` compares a fresh resolution with the committed file, `--check` (offline) requirements vs constraints, `--verify-wheels` (PyPI JSON, read-only) a CPython 3.12 musllinux wheel per pin and arch, `--pip-resolve` pip's own dry-run resolution in a clean venv compared with the lock. Stdlib only (uses `packaging` when present). |
| `scripts/gate/addon_build_check.sh` | extended, not duplicated: steps `lock_static`, `lock_wheels`, `lock_pip` before the engine probe (they run without docker), step `constraints_match` inside the built image, `--lock-only`, `ADDON_BUILD_LOCK=all|static` |
| `scripts/addon_image/check_bill_pdf.sh` | the baseline build context gets `constraints.txt` (the Dockerfile now copies it); the aarch64 wheel download uses `-c /app/constraints.txt` |
| `scripts/gate/INSTALL_ON_RUNNER.md` | how the runner runs the lock part (below) |
| `smplwise_vms/backend/tests/test_python_constraints_2407.py` (new) | 34 tests: 33 passed, 1 skipped on main (section 6) |
| `smplwise_vms/backend/tests/test_gate_addon_build.py` | the fake-docker runs set `ADDON_BUILD_LOCK=static` (hermetic) and expect the new steps |

Why uv for the resolution: pip evaluates environment markers against the interpreter that runs it, so a pip-based lock made on
the Windows workstation drops `uvloop` (`sys_platform != "win32"`) and can add Windows-only packages; `uv pip compile
--python-platform` evaluates the markers for the target. uv is needed only to **regenerate** (`pip install uv`, or
`LOCK_PYTHON_UV=<path>`); every check runs without it.

Regenerate after any change to `requirements.txt` (or to move the lock forward):

```
python scripts/lock_python.py --write
python scripts/lock_python.py --check
python scripts/lock_python.py --verify-wheels
```

## 2. Per-arch notes

- amd64 and aarch64 resolve to **the same 49 versions**, so the file has no markers. If a future resolution differs per arch,
  `--write` stops with the difference instead of writing a file that is wrong for one arch.
- 32 pins are pure-Python wheels (`py3-none-any`), the same file on both arches.
- **17 pins install a binary musllinux wheel per arch** (different file, same version): bcrypt, brotli, cffi, cryptography,
  ezdxf, fonttools, httptools, numpy, pillow, pydantic-core, pynacl, pyyaml, uharfbuzz, uvloop, watchfiles, websockets, zopfli.
  Every one has a CPython 3.12 (or abi3) wheel for **both** `musllinux_*_x86_64` and `musllinux_*_aarch64` on PyPI; **no pin is
  sdist-only**, so the image build compiles nothing.
- pydantic-core 2.46.5 and watchfiles 1.3.0 ship only `musllinux_1_1` wheels (fine on Alpine 3.22's musl 1.2.x). pip does not
  expand a custom `--platform musllinux_1_2_*` to the older musllinux tags, so `--pip-resolve` passes all three (`1_2`, `1_1`,
  `1_0`); with only `1_2` pip reported a false conflict on pydantic-core.
- The HA python base image may configure an extra wheel index (not verified offline). The lock fixes the version either way; it
  does not fix which index serves the file (that would need hashes, section 3).

## 3. Why no hash pinning

Tested on the workstation (pip 25.0.1): as soon as one constraints line carries `--hash`, pip switches the **whole** install to
hash-checking mode, and that mode requires every requirement to be pinned with `==`:

```
ERROR: In --require-hashes mode, all requirements must have their versions pinned with ==. These do not:
    idna>=3 ...
```

`requirements.txt` keeps bounded ranges on purpose (tzdata, numpy, cryptography, ezdxf, uharfbuzz; the T005 pin policy), so
`pip install -r requirements.txt -c constraints.txt` cannot carry hashes. The hashes themselves would work for both arches (PyPI
lists a digest per file, so one line can list the amd64 and aarch64 wheels together); the blocker is pip's mode, not the arches.
A hashed install would mean installing `-r constraints.txt` (with hashes) instead of `requirements.txt`; that is a separate
decision (it also needs every build dependency hashed if a package ever falls back to an sdist).

## 4. Supervisor build check - how the runner runs it

The release gate already starts `scripts/gate/addon_build_check.sh` of the branch under test (stage `addon_build`,
`GATE_ADDON_BUILD=auto`). With this change the script, before probing for an engine, runs with the runner's `python3`
(Ubuntu 24.04: CPython 3.12 = the image's minor version):

| Step | What | Result rules |
|---|---|---|
| `lock_static` | `lock_python.py --check`: every direct requirement pinned in the lock at a satisfying version; only `name==version` lines | FAIL fails the stage |
| `lock_wheels` | `lock_python.py --verify-wheels`: a CPython 3.12 musllinux wheel for each pin on amd64 and aarch64 | FAIL fails; PyPI unreachable = NOT_RUN |
| `lock_pip` | `lock_python.py --pip-resolve --arch amd64`: a clean `python3 -m venv`, `pip install --dry-run --report -r requirements.txt -c constraints.txt --only-binary=:all: --platform musllinux_1_{2,1,0}_x86_64 --python-version 3.12`, the report compared with the lock (no missing, no extra, no other version) | FAIL fails; exact only on a Linux amd64 host, skipped (NOT_RUN) elsewhere; no `python3.12-venv` = NOT_RUN |
| `constraints_match` (docker only) | inside the built image: every pin installed at its exact version; distributions outside the lock are listed (the base image's own) | a version mismatch fails |

Without docker (the runner's state on 2026-11-01) the stage stays NOT_RUN for the image, but a wrong lock now fails it. By hand:
`bash scripts/gate/addon_build_check.sh --root <checkout> --lock-only` (no build, about a minute).

## 5. Tests and checks run (workstation, Windows, Python 3.12 venv)

| Run | Result |
|---|---|
| `pytest tests/test_python_constraints_2407.py tests/test_gate_addon_build.py tests/test_supervisor_build_check.py tests/test_playback_scrub_2341.py tests/test_upstream_watch.py` | **140 passed, 6 skipped** (5 POSIX-only gate tests that run on the runner; 1 notices test, below) |
| `lock_python.py --write` / `--diff` / `--check` | PASS: 49 pins, unchanged, agree |
| `lock_python.py --verify-wheels` | PASS: 49 pins with wheels for amd64 and aarch64, 17 per-arch binary, sdist-only none |
| `lock_python.py --pip-resolve --force` (Windows host: markers differ) | PASS mechanics: 48 packages per arch = the lock minus `uvloop` (its marker excludes win32) - the only, expected, difference |
| `addon_build_check.sh --lock-only` (Git Bash, `python3` shim to the venv) | NOT_RUN as designed on Windows: `lock_static` PASS, `lock_wheels` PASS, `lock_pip` NOT_RUN (not Linux) |
| `addon_build_check.sh` without docker, `ADDON_BUILD_LOCK=static` | NOT_RUN with the lock steps in the reason; `bash -n` syntax OK |

**NOT_RUN:** the real Supervisor build (no docker on the workstation; no runner run by instruction), `lock_pip` on Linux, the
POSIX gate tests (`test_gate_addon_build.py` fake-docker cases, 5), the full backend suite, the aarch64 image.

## 6. Merge note - THIRD_PARTY_NOTICES.md

No new package surfaced: the 49 locked packages are exactly the 49 of the T005 inventory (`release/2406-train`). On **main** the
notices file still predates that inventory, so `test_the_notices_name_every_locked_package_at_its_version` skips here. Checked
against the train's notices: every locked package is listed, one version differs - **click: notices 8.5.0, lock 8.5.1** (a patch
release since the T005 resolution). When this branch and T005 / the 2.40.6 train meet, change that row to 8.5.1 in
`THIRD_PARTY_NOTICES.md` and its byte copy `smplwise_vms/THIRD_PARTY_NOTICES.md`; the test then passes. Neither file is changed
here (main has no `smplwise_vms/THIRD_PARTY_NOTICES.md`, and the root file is rewritten by T005).

## 7. Rollback

`git revert` of the commit: the Dockerfile installs `-r requirements.txt` alone again; the gate script loses the lock steps.
