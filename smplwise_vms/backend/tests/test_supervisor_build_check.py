"""SUPERVISOR-BUILD-GATE-2341: release_check.py's static Supervisor-build rules. 2.31.0 pinned BUILD_FROM / build.yaml to
name:tag@sha256:... and the Supervisor build ran on an image without Python ("pip install ... exit code 127"); each rule has a
fixture that breaks it, and the 2.31.0 inputs (as committed in 1ad867b93..fe36a8a30^) fail the gate."""
from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("release_check_sbuild", ROOT / "scripts" / "release_check.py")
rc = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(rc)

AMD = "ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22"
ARM = "ghcr.io/home-assistant/aarch64-base-python:3.12-alpine3.22"
GOOD_DF = f"""ARG BUILD_FROM={AMD}
FROM ${{BUILD_FROM}}
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
LABEL io.hass.version="2.40.0" io.hass.type="addon" io.hass.arch="amd64|aarch64"
CMD [ "/run.sh" ]
"""
GOOD_BY = f"build_from:\n  amd64: {AMD}\n  aarch64: {ARM}\n"
GOOD_CFG = 'name: x\nversion: "2.40.0"\nslug: x\narch:\n  - amd64\n  - aarch64\nstartup: application\n'

# the 2.31.0 release inputs (digest pin in the Dockerfile ARG and in build.yaml)
DF_2310 = """# Base pinned by digest (tag kept for readability).
ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22@sha256:3c68563fbe55fdda9d11d6358d030969fc52da9eb41977caa1ff2bf3713c6a00
FROM ${BUILD_FROM}
RUN apk add --no-cache poppler-utils jpeg zlib libpng ffmpeg pango
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
LABEL io.hass.version="2.31.0" io.hass.type="addon" io.hass.arch="amd64|aarch64"
CMD [ "/run.sh" ]
"""
BY_2310 = """# Kept for Supervisors older than 2026.04 (newer ones read the base image from the Dockerfile).
# Each base is pinned by digest (tag kept for readability); refresh as described at the top of the Dockerfile.
build_from:
  amd64: ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22@sha256:3c68563fbe55fdda9d11d6358d030969fc52da9eb41977caa1ff2bf3713c6a00
  aarch64: ghcr.io/home-assistant/aarch64-base-python:3.12-alpine3.22@sha256:3c4c840c9a9c8eb158facdcbfdd2d9556acc45722fddc078060a8cce1ece749f
"""
CFG_2310 = GOOD_CFG.replace("2.40.0", "2.31.0")

TAG = "add-on base image by tag (no @sha256 digest pin)"
BASE = "add-on base image is the HA python base for each arch"
PYST = "pip/python RUN steps run on a stage with Python"
ARCH = "config.yaml arch list = build.yaml build_from"
LABEL = "image LABEL version and arch = config.yaml"


def run(tmp_path: Path, df: str = GOOD_DF, by: str = GOOD_BY, cfg: str = GOOD_CFG) -> dict[str, tuple[bool, str]]:
    addon = tmp_path / "smplwise_vms"
    addon.mkdir(exist_ok=True)
    (addon / "Dockerfile").write_text(df, encoding="utf-8")
    (addon / "build.yaml").write_text(by, encoding="utf-8")
    (addon / "config.yaml").write_text(cfg, encoding="utf-8")
    return {n: (ok, d) for n, ok, d in rc.supervisor_build_checks(addon)}


def test_good_inputs_pass_every_rule(tmp_path):
    res = run(tmp_path)
    assert set(res) == {TAG, BASE, PYST, ARCH, LABEL}
    assert all(ok for ok, _ in res.values()), res


def test_the_repository_passes_every_rule():
    res = {n: (ok, d) for n, ok, d in rc.supervisor_build_checks(ROOT / "smplwise_vms")}
    assert all(ok for ok, _ in res.values()), res
    by = {c["name"]: c for c in rc.run_checks(ROOT)["checks"]}
    assert {TAG, BASE, PYST, ARCH, LABEL} <= set(by), "the rules are part of the release checklist"


def test_the_2310_digest_pin_fails_the_check(tmp_path):
    res = run(tmp_path, DF_2310, BY_2310, CFG_2310)
    assert not res[TAG][0] and "@sha256" in res[TAG][1] and "build.yaml amd64" in res[TAG][1] and "Dockerfile ARG BUILD_FROM" in res[TAG][1]
    assert not res[BASE][0], "a digest ref is not the tag-form HA python base"
    assert not res[PYST][0] and "pip install" in res[PYST][1], "the pip step is not proven to run on a python stage"
    assert res[ARCH][0] and res[LABEL][0]


def test_digest_pin_only_in_build_yaml_fails(tmp_path):
    by = GOOD_BY.replace(ARM, ARM + "@sha256:" + "a" * 64)
    res = run(tmp_path, by=by)
    assert not res[TAG][0] and "build.yaml aarch64" in res[TAG][1]
    assert not res[BASE][0]


def test_digest_on_a_literal_from_line_fails(tmp_path):
    df = GOOD_DF.replace("FROM ${BUILD_FROM}", f"FROM {AMD}@sha256:{'b' * 64}")
    assert not run(tmp_path, df=df)[TAG][0]


def test_wrong_base_image_or_arch_mismatch_fails(tmp_path):
    res = run(tmp_path, by=GOOD_BY.replace(ARM, "ghcr.io/home-assistant/aarch64-base:3.22"))
    assert not res[BASE][0] and "aarch64-base:3.22" in res[BASE][1]
    res = run(tmp_path, by=GOOD_BY.replace(ARM, AMD))   # aarch64 key -> amd64 image
    assert not res[BASE][0]
    res = run(tmp_path, by=GOOD_BY.replace(ARM, "ghcr.io/home-assistant/aarch64-base-python:3.13-alpine3.22"))
    assert not res[BASE][0] and "different python/alpine tags" in res[BASE][1]


def test_dockerfile_default_must_equal_build_yaml_amd64(tmp_path):
    df = GOOD_DF.replace(AMD, "ghcr.io/home-assistant/amd64-base-python:3.13-alpine3.22", 1)
    res = run(tmp_path, df=df)
    assert not res[BASE][0] and "!= build.yaml amd64" in res[BASE][1]


def test_pip_on_a_stage_without_python_fails(tmp_path):
    df = GOOD_DF.replace("FROM ${BUILD_FROM}", "FROM alpine:3.22")
    res = run(tmp_path, df=df)
    assert not res[PYST][0] and "pip install" in res[PYST][1]


def test_python_installed_in_the_stage_or_inherited_from_a_python_stage_passes(tmp_path):
    df = GOOD_DF.replace("FROM ${BUILD_FROM}", "FROM alpine:3.22\nRUN apk add --no-cache \\\n    python3 py3-pip")
    assert run(tmp_path, df=df)[PYST][0]
    multi = f"ARG BUILD_FROM={AMD}\nFROM ${{BUILD_FROM}} AS deps\nRUN pip wheel -r r.txt\nFROM deps\nRUN python3 -m compileall /app\n" \
            'LABEL io.hass.version="2.40.0" io.hass.arch="amd64|aarch64"\n'
    assert run(tmp_path, df=multi)[PYST][0]
    bad = multi.replace("FROM deps", "FROM scratch")
    res = run(tmp_path, df=bad)
    assert not res[PYST][0] and "compileall" in res[PYST][1]


def test_py3_pip_package_name_alone_is_not_a_pip_call(tmp_path):
    df = GOOD_DF.replace("FROM ${BUILD_FROM}", "FROM alpine:3.22").replace("RUN pip install --no-cache-dir -r /app/requirements.txt\n", "")
    df = df.replace("ffmpeg", "ffmpeg py3-pipx-docs")
    assert run(tmp_path, df=df)[PYST][0]


def test_arch_list_mismatch_fails(tmp_path):
    res = run(tmp_path, cfg=GOOD_CFG.replace("  - aarch64\n", "  - aarch64\n  - armv7\n"))
    assert not res[ARCH][0] and "armv7" in res[ARCH][1]
    assert not res[LABEL][0], "the io.hass.arch label no longer matches the config arch list"
    flow = GOOD_CFG.replace("arch:\n  - amd64\n  - aarch64\n", "arch: [amd64, aarch64]\n")
    assert run(tmp_path, cfg=flow)[ARCH][0]


def test_label_version_must_equal_config_version(tmp_path):
    res = run(tmp_path, df=GOOD_DF.replace('io.hass.version="2.40.0"', 'io.hass.version="2.39.9"'))
    assert not res[LABEL][0] and "2.39.9" in res[LABEL][1]
    res = run(tmp_path, df=GOOD_DF.replace(' io.hass.version="2.40.0"', ""))
    assert not res[LABEL][0]


def test_missing_files_fail_closed(tmp_path):
    addon = tmp_path / "empty"
    addon.mkdir()
    res = {n: ok for n, ok, _ in rc.supervisor_build_checks(addon)}
    assert not any(res.values()), res
