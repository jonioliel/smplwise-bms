"""WISKEY-KNOWN-TREES-RC20-2530: Arx recognises the WisKey 2.0.1-rc.20 trees (and the published rc.19 / rc.17 ones) by their exact
portable digest (docs/changes/WISKEY-KNOWN-TREES-RC20-2530.md).

The fixture `fixtures/wiskey_trees/rc20_tree_rows.json` holds only the file ROWS (path, bytes, sha256) of WisKey's rc.20 managed tree,
copied from WisKey's 25.11 handoff MANAGED_MANIFEST.json; the manual tree is the same rows plus the manual marker row. No WisKey source
bytes, no device, no lab. The rule under test is the existing one: a label is never an identity, only the exact digest is; a tree that
differs in any byte, size, name or file count stays unknown."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import wiskey_managed_install as wmi
from smplwise.services import wiskey_versions as wv
from smplwise.services.wiskey_distribution_digest import digest_rows

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "wiskey_trees" / "rc20_tree_rows.json"
RC20 = "2.0.1-rc.20"
RC20_CODE = "dcebb9f34c8f95638e498115a2aeb5ce2711981e"
RC20_MANAGED = "c0824762807044d634cb5c64e44e60c30bfd84680f03424296b1bc2ae390430d"
RC20_MANUAL = "e025a6bce085d525461f7c52d79277d59b5d8252758d382f1d8a388cf2126ddf"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
HEX40 = re.compile(r"^[0-9a-f]{40}$")


def _fixture() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _managed_rows() -> list[dict[str, Any]]:
    return [dict(r) for r in _fixture()["managed_rows"]]


def _manual_rows() -> list[dict[str, Any]]:
    return [*_managed_rows(), dict(_fixture()["manual_marker_row"])]


# ================================================================ the rc.20 trees are recognised with the right label

@pytest.mark.parametrize("rows,profile,files", [
    (_managed_rows, wv.MANAGED_PROFILE, 407),
    (_manual_rows, wv.MANUAL_PROFILE, 408),
])
def test_rc20_tree_is_recognised_with_its_label_product_and_profile(rows, profile, files):
    tree = rows()
    assert len(tree) == files
    known = wv.identify(digest_rows(tree))
    assert known is not None, "the rc.20 tree WisKey delivered must not show as unknown"
    assert (known["label"], known["product_CODE"], known["profile"], known["files"]) == (RC20, RC20_CODE, profile, files)


def test_fixture_digests_match_wiskeys_published_values():
    fx = _fixture()
    assert fx["version"] == RC20 and fx["product_CODE"] == RC20_CODE
    assert digest_rows(_managed_rows()) == fx["managed_component_digest"] == RC20_MANAGED
    assert digest_rows(_manual_rows()) == fx["manual_component_digest"] == RC20_MANUAL


def _flip_hex(h: str) -> str:
    return ("0" if h[0] != "0" else "1") + h[1:]


def _tamper_sha(rows):
    rows[len(rows) // 2]["sha256"] = _flip_hex(rows[len(rows) // 2]["sha256"])
    return rows


def _tamper_size(rows):
    rows[0]["bytes"] += 1
    return rows


def _tamper_extra(rows):
    return [*rows, {"path": "extra_module.py", "bytes": 1, "sha256": "0" * 64}]


def _tamper_missing(rows):
    return [r for r in rows if r["path"] != "__init__.py"]


def _tamper_rename(rows):
    rows[0]["path"] = rows[0]["path"] + ".orig"
    return rows


def _tamper_marker(rows):
    # a manual tree with a different manual marker body
    for r in rows:
        if r["path"] == "_manual_upgrade_profile.json":
            r["sha256"] = _flip_hex(r["sha256"])
    return rows


@pytest.mark.parametrize("base", [_managed_rows, _manual_rows])
@pytest.mark.parametrize("tamper", [_tamper_sha, _tamper_size, _tamper_extra, _tamper_missing, _tamper_rename, _tamper_marker])
def test_a_tampered_rc20_tree_stays_unknown(base, tamper):
    rows = tamper(base())
    d = digest_rows(rows)
    if tamper is _tamper_marker and base is _managed_rows:
        assert d == RC20_MANAGED  # the managed tree has no marker: nothing was changed
        return
    assert d not in (RC20_MANAGED, RC20_MANUAL)
    assert wv.identify(d) is None, "a tree that differs in any byte, size, name or file count is never given a known label"


@pytest.mark.parametrize("probe", [
    RC20_MANAGED.upper(), RC20_MANAGED[:12], RC20_MANAGED + " ", " " + RC20_MANAGED, RC20_MANAGED[:-1] + "*", "*", "", "2.0.1-rc.20",
    None, 0, ["c0824762807044d634cb5c64e44e60c30bfd84680f03424296b1bc2ae390430d"],
])
def test_identify_matches_only_the_exact_digest(probe):
    assert wv.identify(probe) is None


# ================================================================ end to end through the read-only classifier

def _cfg_with_manifest(tmp_path: Path, version: str) -> Path:
    target = tmp_path / "custom_components" / wmi.DOMAIN
    target.mkdir(parents=True)
    (target / "manifest.json").write_text(json.dumps({"domain": wmi.DOMAIN, "version": version}), encoding="utf-8")
    return tmp_path


def test_classify_labels_an_installed_rc20_manual_tree(tmp_path, monkeypatch):
    cfg = _cfg_with_manifest(tmp_path, RC20)
    monkeypatch.setattr(wmi, "tree_files", lambda _root: _manual_rows())
    got = wmi.classify(cfg)
    assert got["state"] == "present" and got["known"] is True
    assert (got["label"], got["product_CODE"], got["profile"], got["digest"], got["files"]) == (
        RC20, RC20_CODE, wv.MANUAL_PROFILE, RC20_MANUAL, 408)


def test_classify_never_trusts_the_rc20_label_in_a_tampered_tree(tmp_path, monkeypatch):
    cfg = _cfg_with_manifest(tmp_path, RC20)
    monkeypatch.setattr(wmi, "tree_files", lambda _root: _tamper_sha(_manual_rows()))
    got = wmi.classify(cfg)
    assert got["state"] == "present" and got["version"] == RC20, "the manifest label is reported as read"
    assert got["known"] is False and got["label"] is None and got["product_CODE"] is None and got["profile"] is None


def test_recognising_rc20_never_makes_the_shipped_rc10_bundle_runnable_over_it():
    """Recognition is a label only: with rc.20 installed, the shipped rc.10 managed bundle is still a refused downgrade."""
    known = wv.identify(RC20_MANUAL)
    installed = {"version": RC20, "digest": RC20_MANUAL, "product_CODE": known["product_CODE"], "profile": known["profile"]}
    shipped = wmi.bundle_info()
    assert shipped["state"] == "ok" and wv.compare(shipped["version"], RC20) == -1
    assert wv.plan(installed, shipped) == "downgrade_refused"


# ================================================================ rc.19 / rc.17 and the table's own rules

@pytest.mark.parametrize("digest,label,code,profile,files", [
    ("c7a6c0c5a0a9ac3b321ea50b836ac384d680ec4cff0255c59df27f0e7658ff02", "2.0.1-rc.19", "3e7bfc585d5a30bddd97ceeed1bb0d7032ee021d",
     wv.MANAGED_PROFILE, 406),
    ("0df4b6961f39a5974f2ff9a6db1c5e9ffe6bcdeb24fc3e8a1409139201f5cdbe", "2.0.1-rc.19", "3e7bfc585d5a30bddd97ceeed1bb0d7032ee021d",
     wv.MANUAL_PROFILE, 407),
    ("43ea15f3296d13c4ce9bf8a6afc5964a880b2fbe9714aa8e1de743b563019f5f", "2.0.1-rc.17", "36c2dcc90412546afde96067089613d3448ef7f3",
     wv.MANUAL_PROFILE, 402),
])
def test_published_rc19_and_rc17_trees_are_recognised(digest, label, code, profile, files):
    known = wv.identify(digest)
    assert known is not None
    assert (known["label"], known["product_CODE"], known["profile"], known["files"]) == (label, code, profile, files)


def test_known_tree_table_keeps_its_rules():
    trees = wv.known_trees()
    digests = [t["component_digest"] for t in trees if t["component_digest"] is not None]
    assert len(digests) == len(set(digests)), "one digest, one identity"
    for t in trees:
        d = t["component_digest"]
        assert d is None or HEX64.fullmatch(d), f"exact lowercase sha256 only, no wildcard or prefix: {t['label']}"
        assert HEX40.fullmatch(t["product_CODE"])
        if d is None:
            assert t["profile"] == "history_only", "a row without a digest can never identify a tree"
        else:
            assert wv.key(t["label"]) is not None
    # every label that has both profiles is one product (a label is never shared by two products with digests)
    by_label: dict[str, set[str]] = {}
    for t in trees:
        if t["component_digest"]:
            by_label.setdefault(t["label"], set()).add(t["product_CODE"])
    assert all(len(codes) == 1 for codes in by_label.values())
    rc20 = [t for t in trees if t["label"] == RC20]
    assert {t["profile"] for t in rc20} == {wv.MANAGED_PROFILE, wv.MANUAL_PROFILE}
    assert {t["component_digest"] for t in rc20} == {RC20_MANAGED, RC20_MANUAL}
