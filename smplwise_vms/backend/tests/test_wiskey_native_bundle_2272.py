"""WISKEY-ADOPT-2272 step 1: the WisKey native integration (`hikvision_intercom`) ships in the add-on build context byte-exact
to the delivered, source-pinned archive, next to the SMPLWISE Bridge mirror, and the image copies both."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
INTEG = REPO / "smplwise_vms" / "integration"
NATIVE = INTEG / "hikvision_intercom"
PIN = INTEG / "hikvision_intercom.pin.json"

pytestmark = pytest.mark.skipif(not PIN.is_file(), reason="repository layout not available")


def _pin() -> dict:
    return json.loads(PIN.read_text(encoding="utf-8"))


def test_pin_names_the_delivered_product_and_archive():
    pin = _pin()
    assert pin["format"] == "smplwise-native-bundle-pin.v1" and pin["component"] == "hikvision_intercom"
    assert pin["product_code"] == "0a099c53d359a1bffdf9e63f31d2433f1c9445a4"
    assert pin["archive_sha256"] == "cc78ca07912b8f6914440ef69913105a5fc2ee92bd05de7f76ecb0f0003569a9"
    assert pin["archive_bytes"] == 1700169 and pin["file_count"] == 370 == len(pin["files"])


def test_staged_tree_is_byte_exact_to_the_pin():
    pin = _pin()
    on_disk = {
        "hikvision_intercom/" + p.relative_to(NATIVE).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in NATIVE.rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc"
    }
    assert on_disk == pin["files"], "the staged native bundle differs from the delivered archive"
    tree = hashlib.sha256()
    for name in sorted(on_disk):
        tree.update(name.encode() + b"\0" + on_disk[name].encode() + b"\n")
    assert tree.hexdigest() == pin["tree_sha256"]
    manifest = json.loads((NATIVE / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["domain"] == "hikvision_intercom" and manifest["version"] == pin["component_version"]


def test_bridge_mirror_is_untouched_by_the_native_bundle():
    # the Bridge mirror stays a generated copy of custom_components/smplwise_bridge (scripts/sync_integration.py only owns that folder)
    assert (INTEG / "smplwise_bridge" / "manifest.json").is_file()
    assert not (REPO / "custom_components" / "hikvision_intercom").exists(), "the native bundle lives only in the add-on build context"


def test_image_copies_both_integrations():
    docker = (REPO / "smplwise_vms" / "Dockerfile").read_text(encoding="utf-8")
    assert "COPY integration /app/integration" in docker


def test_native_bundle_is_not_line_ending_normalised():
    attrs = (REPO / ".gitattributes").read_text(encoding="utf-8")
    assert "smplwise_vms/integration/hikvision_intercom/** -text" in attrs
