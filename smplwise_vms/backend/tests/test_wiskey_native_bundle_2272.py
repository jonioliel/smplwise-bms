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
MANAGED = INTEG / "hikvision_intercom.managed_manifest.json"  # WISKEY-MANAGED-INSTALL-2382: WisKey's MANAGED_MANIFEST.json

pytestmark = pytest.mark.skipif(not PIN.is_file(), reason="repository layout not available")


def _pin() -> dict:
    return json.loads(PIN.read_text(encoding="utf-8"))


def test_pin_names_the_delivered_product_and_archive():
    # WISKEY-MANAGED-INSTALL-2382: the WisKey rc.10 MANAGED bundle (M12-07, branch origin/codex/wiskey-mac-m12-policy-b-2026-11-02 @
    # 2834aa5e8, WISKEY_ARX_MANAGED_2.0.1-rc.10.zip sha256 3365c2b4...) replaces rc.39+arx-align; the pin is WisKey's own, byte-exact
    pin = _pin()
    assert hashlib.sha256(PIN.read_bytes()).hexdigest() == "0063c70f2fb14f663e544bd235b84bf475b0b493189c34e907d482a65a136b8a"
    assert pin["component"] == "hikvision_intercom" and pin["profile"] == "managed_original_authority_flow"
    assert pin["product_CODE"] == "6049821dd39235b7d50ea2a43621e440caa51fb2" and pin["component_version"] == "2.0.1-rc.10"
    assert pin["file_count"] == 389 == len(pin["files"])
    assert pin["tree_sha256"] == "660cea99d315a3d9cc37e62d5823c1a88c23868f35a1ae9e608d281d97f515d4"
    assert pin["component_digest_algorithm"] == "wiskey-posix-tree-sha256.v1"
    assert pin["component_digest_recomputed"] == "5a3d3cedaab4f1ae8d3708b49e571496cae83c6a7eabc38437e2932305852e2d"
    managed = json.loads(MANAGED.read_text(encoding="utf-8"))
    assert hashlib.sha256(MANAGED.read_bytes()).hexdigest() == "4b2acc0a091d2091f52411dfda0725f5bff4a0835eca14dff0583f140502ed54"
    assert managed["ZIP_sha256"] == "3365c2b4bb452651a9ff6590b3a9a1b36578e7629c746e64073730617222c294" and managed["ZIP_bytes"] == 1760464
    assert (managed["product_CODE"], managed["version"], managed["profile"]) == (pin["product_CODE"], pin["component_version"], pin["profile"])
    assert managed["component_digest"] == pin["component_digest_recomputed"] and managed["pin_tree_sha256"] == pin["tree_sha256"]
    on_disk = {p.relative_to(NATIVE).as_posix(): {"bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
               for p in NATIVE.rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc"}
    assert on_disk == managed["files"], "the shipped tree differs from WisKey's MANAGED_MANIFEST.json"
    assert "_manual_upgrade_profile.json" not in on_disk, "a managed bundle never carries the manual marker"


def test_label_to_content_mapping_never_reuses_a_label_for_other_content():
    # the historical rc.38 ambiguity (two different trees under one label) must not recur: every known tree under the current label is
    # the current product (its manual and managed profiles), and the two old rc.38 products stay apart by product CODE
    from smplwise.services import wiskey_versions as wv

    pin = _pin()
    trees = wv.known_trees()
    current = [t for t in trees if t["label"] == pin["component_version"]]
    assert {t["product_CODE"] for t in current} == {pin["product_CODE"]}
    assert {t["profile"] for t in current} == {"managed_original_authority_flow", "owner_manual_existing"}
    assert [t["component_digest"] for t in current if t["profile"] == pin["profile"]] == [pin["component_digest_recomputed"]]
    rc38 = [t for t in trees if t["label"] == "2.0.0-rc.38"]
    assert {t["product_CODE"] for t in rc38} == {"0a099c53d359a1bffdf9e63f31d2433f1c9445a4", "cc50b3b15460944c5c55450f47a2b23d77b6e686"}
    digests = [t["component_digest"] for t in trees if t["component_digest"]]
    assert len(digests) == len(set(digests))


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
    from smplwise.services.wiskey_distribution_digest import digest

    assert digest(NATIVE) == pin["component_digest_recomputed"]


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
