# SUPERVISOR-BUILD-GATE-2341: the release gate proves the add-on image builds the way the Supervisor builds it

Owner-approved 2026-11-01. Branch `chore/SUPERVISOR-BUILD-GATE-2341` from `origin/main` (2.33.1). Tooling and tests only; no product
code, no version bump.

## Root cause it closes

2.31.0 pinned `ARG BUILD_FROM` (Dockerfile) and `build.yaml` to `name:tag@sha256:<digest>`. The gate never builds the image, so it
stayed green; on the lab the Supervisor build failed with `pip install ... exit code: 127` (the build ran on an image without
Python). 2.31.1 restored the tag form by hand. Nothing stopped the same mistake from shipping again.

## What changed

1. `scripts/release_check.py` - five static rules (stdlib, milliseconds, every machine; they join the existing `release_check`
   category of the gate, so a failure is red today, with no runner change):
   - `add-on base image by tag (no @sha256 digest pin)` - Dockerfile ARG, build.yaml, literal `FROM` lines;
   - `add-on base image is the HA python base for each arch` - `ghcr.io/home-assistant/<arch>-base-python:<py>-alpine<ver>`, the
     arch in the name equals the key, one tag for all arches, and the Dockerfile default equals build.yaml amd64 (Supervisors from
     2026.04 read the Dockerfile, older ones build.yaml);
   - `pip/python RUN steps run on a stage with Python` - every `RUN` calling pip/python sits on a stage whose base is the tag-form HA
     python base, a stage built on one, or after an apk/apt python install in that stage;
   - `config.yaml arch list = build.yaml build_from`;
   - `image LABEL version and arch = config.yaml`.
   - `Dockerfile syntax (ENV/LABEL/ARG key=value, continuations)` (added after the 2.33.2 incident, below): a continuation
     backslash is the last character of its line (no trailing spaces, no lone backslash mid-line), ENV/LABEL/ARG carry no escape
     sequences (backslash-n, backslash-t) outside quotes, every ENV/LABEL word is key=value (legacy `ENV key value`: one key), every
     ARG word is NAME[=default], and the file does not end inside a continuation.
2. `scripts/gate/addon_build_check.sh` - the real build: `docker build` of `smplwise_vms/` with `BUILD_FROM` (build.yaml amd64),
   `BUILD_VERSION`, `BUILD_ARCH=amd64` and the layer cache (what the Supervisor runs for a local add-on), then inside the image with
   `--network none` and the s6 entrypoint bypassed: `import smplwise` (+ version = config.yaml), `create_app()`, `python3 -m smplwise`
   answering `/healthz` within 90 s, and `pdftoppm` / `pdfinfo` / `ffmpeg`. PASS (0) / FAIL (1, with the log tail) / NOT_RUN (3: no
   engine; it installs nothing and prints the owner's install steps). Budget `ADDON_BUILD_SECS` 600 s. The official HA builder image
   is opt-in (`ADDON_BUILD_BUILDER=ha`, only when already present locally): the Supervisor itself does not use it, and that path is
   NOT verified. Podman is opt-in (`ADDON_BUILD_ENGINE=podman`).
3. `scripts/gate/release_gate.py` - optional stage `addon_build`: started in the background right after `release_check` (from the
   branch under test), collected before `backend-wait`. `GATE_ADDON_BUILD=auto|require|off`, `GATE_ADDON_BUILD_SECS`. NOT_RUN is a
   `SKIPPED_NOT_RUN` item with its reason (never a pass); `require` makes it a failure. No count baseline for the category (no
   "no baseline entry" warning). Report section with the steps and, on failure, the log tail.
4. Docs: `scripts/gate/INSTALL_ON_RUNNER.md` (stage, docker state, owner install steps, re-install steps),
   `docs/release/GATE_SPEED.md` section 7 (timing).

## Second incident: 2.33.2 (literal backslash-n in the ENV block)

2.33.2 shipped `PYTHONUNBUFFERED=1 
    PYTHONFAULTHANDLER=1` on ONE physical line of the ENV block; the Supervisor's builder
stopped with `Syntax error - can't find = in "
". Must be of the form: name=value` (Dockerfile:32). The first five rules do not
look at instruction syntax, so the sixth rule above was added. Fixtures: the exact 2.33.2 block (fails), the 2.33.3 form with a
real continuation (passes), and the released `v2.33.2:smplwise_vms/Dockerfile` from git (fails, every problem on line 32).
Note: origin/main at 2.33.2 fails this rule until the 2.33.3 fix is merged; this branch (cut from 2.33.1) passes.

## Runner state (read-only probe 2026-11-01, through run_smart.py's ssh config)

- `docker`: not installed (`command not found`), no `/var/run/docker.sock`.
- `podman` 4.9.3 installed, `buildah` not; `podman version` did not answer within 60 s while the release/2332-train gate was running (load ~35
  on 16 cores). The probe's own processes were stopped afterwards; nothing else was touched.
- So the stage reports NOT_RUN on the runner until the owner installs docker (steps in INSTALL_ON_RUNNER.md).

## Tests

- `smplwise_vms/backend/tests/test_supervisor_build_check.py` - each rule with a breaking fixture, the exact 2.31.0 Dockerfile and
  build.yaml (fail on three rules), and the repository passing.
- `smplwise_vms/backend/tests/test_gate_addon_build.py` - settle rules, off / missing script / lane / require, no baseline warning,
  the report section, the wiring order in `main()`; POSIX only: the real script with a fake `docker` (build args, cached context,
  `--network none`, the five steps, the 127 failure, a failing `/healthz`, NOT_RUN, `--detect-only`, usage).
- `scripts/gate/selftest_gate.py` - addon-build cases with a fake `docker` (PASS, 127 FAIL, import FAIL, NOT_RUN, require, missing
  script, off, no baseline warning); they need `GATE_SELFTEST_REPO=<checkout>` when run from `~/`.

## Known limits

- The real build has not run anywhere yet (no docker on the runner, none allowed on the low-memory workstation).
- A plain `docker build` may accept a digest ref that the Supervisor mishandled; the static rule is what certainly stops the 2.31.0
  pattern, the build catches Dockerfile / requirements / import breakage.
- amd64 only (the runner's arch); aarch64 is covered by the static rules.

## Rollback

`GATE_ADDON_BUILD=off` in the gate environment, or restore the backed-up `~/release_gate.py`. The static rules go with a revert of
the release_check commit.
