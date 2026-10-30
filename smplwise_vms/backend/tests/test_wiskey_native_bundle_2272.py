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
    # WISKEY-R3-2272: rc.39 Native product (WisKey R3 delivery 11903a80, label 2.0.0-rc.39+arx-align.20261029.04)
    pin = _pin()
    assert pin["format"] == "smplwise-native-bundle-pin.v1" and pin["component"] == "hikvision_intercom"
    assert pin["product_code"] == "4407121a8ad9df2bbebc07161808bbbc2664b592"
    assert pin["component_version"] == "2.0.0-rc.39+arx-align.20261029.04"
    assert pin["archive_sha256"] == "32c54c65fc0c6ae9d1c99f733fe9fa8f6f0d5bbb47e01252356ee00e92b27eb0"
    assert pin["archive_bytes"] == 1729318 and pin["file_count"] == 377 == len(pin["files"])
    assert pin["manifest_sha256"] == "e94a58d2f228a6c1d245111ea367332b847581a357d25575f2e5dc06a6b3439f"
    assert pin["tree_sha256"] == "6e4c425b8417be3d9fc0e61b014a01007434e29a34a55cc1b28000302bed573f"  # = WisKey's STAGED_NATIVE_PIN


def test_label_to_content_mapping_never_reuses_a_label_for_other_content():
    # the historical rc.38 ambiguity (two different trees under one label) must not recur: the current label is new and unique, and the
    # recorded history keeps both old rc.38 products apart by product code
    pin = _pin()
    history = pin["label_history"]
    current = [h for h in history if h["label"] == pin["component_version"]]
    assert len(current) == 1 and current[0]["product_code"] == pin["product_code"] and current[0]["tree_sha256"] == pin["tree_sha256"]
    rc38 = [h for h in history if h["label"] == "2.0.0-rc.38"]
    assert {h["product_code"] for h in rc38} == {"0a099c53d359a1bffdf9e63f31d2433f1c9445a4", "cc50b3b15460944c5c55450f47a2b23d77b6e686"}
    assert {h["archive_sha256"] for h in history} == {h["archive_sha256"] for h in history} and len({h["archive_sha256"] for h in history}) == 3
    assert pin["component_version"] not in {h["label"] for h in history if h["product_code"] != pin["product_code"]}


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


def test_alignment_v1_contracts_are_shipped_as_parseable_json():
    # WISKEY-R3-2272: WisKey's 17 alignment schemas and 68 examples (R3 00_summary/contracts/alignment-v1), copied byte-exact; the
    # validator run itself needs `jsonschema` (not a dependency of the add-on) and is reported separately
    root = REPO / "contracts" / "wiskey" / "alignment-v1" / "schemas"
    schemas = sorted(root.glob("*.schema.json"))
    examples = sorted((root / "examples").glob("*.json"))
    assert len(schemas) == 17 and len(examples) == 68
    for p in [*schemas, *examples, root / "SCHEMA_INDEX.json", root / "EXAMPLE_INDEX.json"]:
        json.loads(p.read_text(encoding="utf-8"))
    for row in json.loads((root / "SCHEMA_INDEX.json").read_text(encoding="utf-8"))["schemas"]:
        assert hashlib.sha256((root / row["path"]).read_bytes()).hexdigest() == row["sha256"], row["path"]
