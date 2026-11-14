"""V1-REMAINING-2406 / WISKEY-ACTIVATION-RUNBOOK-0411: the activation ladder in docs/operations/WISKEY_ACTIVATION_RUNBOOK.md cannot
drift from the build. Its machine-readable block names every setting key, "מצב WisKey" row, reason code, pairing line, acceptance
check, route and Hebrew label a step relies on; each one is checked against the code here. The doc is also scanned for lab material
(addresses, MACs, long hex strings, private paths) because it is a repository file.

Pure file and module reads: no app, no database, no network."""
from __future__ import annotations

import ipaddress
import json
import re
from functools import lru_cache
from pathlib import Path

import pytest

from smplwise.services import wiskey_feature_status as wfs
from smplwise.services import wiskey_live_validation as lv
from smplwise.services import wiskey_pairing as wp

REPO = Path(__file__).resolve().parents[3]
DOC = REPO / "docs" / "operations" / "WISKEY_ACTIVATION_RUNBOOK.md"
BACKEND_SRC = REPO / "smplwise_vms" / "backend" / "smplwise"
FRONTEND_SRC = REPO / "frontend" / "src"
# the ladder of the card's acceptance: door map, provider, pairing check, video_talk, listen, live validation, door windows / emergency
LADDER = ["door_map", "provider", "pairing_check", "video_talk", "listen", "live_validation", "door_windows_emergency"]
BLOCK = re.compile(r"^```json activation-ladder\n(.*?)^```", re.MULTILINE | re.DOTALL)
APPROVAL = re.compile(r"^מאשר: \S")


@lru_cache(maxsize=1)
def doc_text() -> str:
    return DOC.read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def ladder() -> dict:
    blocks = BLOCK.findall(doc_text())
    assert len(blocks) == 1, f"exactly one ```json activation-ladder block expected, found {len(blocks)}"
    return json.loads(blocks[0])


@lru_cache(maxsize=1)
def prose() -> str:
    """The doc without its machine-readable block, whitespace collapsed (a quoted label may wrap): what a person reads."""
    return " ".join(BLOCK.sub("", doc_text()).split())


@lru_cache(maxsize=1)
def backend_text() -> str:
    return "\n".join(p.read_text(encoding="utf-8") for p in sorted(BACKEND_SRC.rglob("*.py")))


@lru_cache(maxsize=1)
def frontend_text() -> str:
    return "\n".join(p.read_text(encoding="utf-8") for p in sorted(FRONTEND_SRC.rglob("*.ts")))


def sections() -> list[dict]:
    """The preflight object and every step: the parts that carry keys to check."""
    data = ladder()
    return [{"id": "preflight", **data["preflight"]}] + data["steps"]


def test_block_shape_and_order():
    data = ladder()
    assert data["schema"] == "arx-activation-ladder/1"
    assert data["card"] == "WISKEY-ACTIVATION-RUNBOOK-0411"
    assert [s["id"] for s in data["steps"]] == LADDER
    for step in data["steps"]:
        for key in ("route", "writes", "rollback"):
            assert isinstance(step[key], str) and step[key].strip(), (step["id"], key)
        assert step["approval"], step["id"]
        assert step["physical"] is False, f"{step['id']}: a physical action is never a ladder step; it needs its own approval"


def test_every_step_has_a_prose_section_in_ladder_order():
    positions = [prose().find(f"(`{sid}`)") for sid in LADDER]
    assert all(p >= 0 for p in positions), dict(zip(LADDER, positions))
    assert positions == sorted(positions)


def test_approvals_are_exact_unique_and_written_in_the_prose():
    seen: list[str] = []
    for part in sections():
        for wording in part["approval"]:
            assert APPROVAL.match(wording), (part["id"], wording)
            assert f"`{wording}`" in prose(), f"{part['id']}: approval {wording!r} is not written in the steps"
            seen.append(wording)
    assert len(seen) == len(set(seen)), "an approval wording is used by two steps"


def test_routes_exist_in_the_frontend():
    for step in ladder()["steps"]:
        base = step["route"].split("?", 1)[0]
        assert base.startswith("#/"), step["route"]
        assert base in frontend_text(), f"{step['id']}: route {base} is not in frontend/src"
        assert step["route"] in prose(), f"{step['id']}: route {step['route']} is not named in the steps"


def test_setting_keys_exist_in_the_backend():
    for part in sections():
        for key in part.get("settings", []):
            assert f'"{key}"' in backend_text(), f"{part['id']}: setting {key} is not a literal in the backend"
            assert f"`{key}`" in prose(), f"{part['id']}: setting {key} is not named in the steps"


def test_status_rows_exist_and_their_labels_are_quoted():
    rows = {key: label for _num, key, _group, label, _check, _link in wfs.ROWS}
    for part in sections():
        for key in part.get("feature_rows", []):
            assert key in rows, f"{part['id']}: status row {key} is not in wiskey_feature_status.ROWS"
            assert f'"{rows[key]}"' in prose(), f"{part['id']}: the label of row {key} ({rows[key]}) is not quoted in the steps"


def test_reason_codes_exist_and_are_named():
    for part in sections():
        for code in part.get("reason_codes", []):
            assert code in wfs.R, f"{part['id']}: reason {code} is not in wiskey_feature_status.R"
            assert f"`{code}`" in prose(), f"{part['id']}: reason {code} is not named in the steps"


def test_pairing_lines_exist_and_their_labels_are_quoted():
    for part in sections():
        for key in part.get("pairing_lines", []):
            assert key in wp.LABEL, f"{part['id']}: pairing line {key} is not in wiskey_pairing.LABEL"
            assert f'"{wp.LABEL[key]}"' in prose(), f"{part['id']}: the label of pairing line {key} is not quoted in the steps"


def test_acceptance_checks_match_the_tool():
    by_id = {s["id"]: s for s in ladder()["steps"]}
    assert by_id["live_validation"]["checks"] == list(lv.CHECKS)
    for check in lv.CHECKS:
        assert f"`{check}`" in prose(), check
    for text in lv.STATUS_TEXT.values():
        if text not in ("ממתין", "בבדיקה"):  # the two in-flight states are not results
            assert text in prose(), text
    assert all(not s["checks"] for s in ladder()["steps"] if s["id"] != "live_validation")


def test_ui_labels_exist_in_the_frontend_and_in_the_steps():
    for part in sections():
        for label in part.get("ui_labels", []):
            assert label in frontend_text(), f"{part['id']}: label {label!r} is not in frontend/src"
            assert label in prose(), f"{part['id']}: label {label!r} is not in the steps"


def test_the_join_log_line_quoted_is_the_one_the_backend_writes():
    quoted = "wiskey direct join installed (access.station_media_provider = auto, key signs); the direct path is used while its socket"
    assert quoted in prose()
    assert "wiskey direct join installed (%s = auto, key signs); the direct path is used while its socket authenticates" in backend_text()


DOC_RANGES = [ipaddress.ip_network(n) for n in ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24")]
IPV4 = re.compile(r"(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?![\d.])")
MAC = re.compile(r"(?i)(?<![0-9a-f:])(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}(?![0-9a-f:])")
LONG_HEX = re.compile(r"(?i)(?<![0-9a-z])[0-9a-f]{32,}(?![0-9a-z])")
PRIVATE = re.compile(r"/share/|private-evidence|secrets/lab|/tmp/|\bBearer\s+\S{8,}|eyJ[A-Za-z0-9_-]{10,}")


def test_no_lab_material_in_the_repository_copy():
    text = doc_text()
    for raw in IPV4.findall(text):
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError:
            continue
        assert ip.is_loopback or ip.is_unspecified or any(ip in n for n in DOC_RANGES), "an IPv4 address in the runbook"
    assert not MAC.search(text), "a MAC address in the runbook"
    assert not LONG_HEX.search(text), "a long hex string (key, token or hash) in the runbook"
    assert not PRIVATE.search(text), "a private path or a token shape in the runbook"
    assert "NOT_RUN" in text


@pytest.mark.parametrize("bad", ["10.1.2.3", "aa:bb:cc:dd:ee:01", "0123456789abcdef0123456789abcdef", "/share/backup"])
def test_the_leak_scan_catches_its_own_samples(bad):
    hit = bool(MAC.search(bad) or LONG_HEX.search(bad) or PRIVATE.search(bad))
    if IPV4.search(bad):
        ip = ipaddress.ip_address(IPV4.search(bad).group(1))
        hit = hit or not (ip.is_loopback or any(ip in n for n in DOC_RANGES))
    assert hit, bad
