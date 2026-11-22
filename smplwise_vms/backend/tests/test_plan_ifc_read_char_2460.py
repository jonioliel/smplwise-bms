"""CR-IFC-SPLIT-2460 - characterisation of `services.plan_ifc_read.read` (radon CC 265: the storey choice, the containment, the skip
bookkeeping, walls, openings, rooms, objects, the report of everything else, the alignment and the conversion into the plan's frame in
one body), recorded BEFORE its skip bookkeeping moved into an object and the function was split.

The corpus (tests/fixtures/plan_ifc_read_char_2460.json) holds:
- `files_xz`: the IFC files (lzma of a JSON map key -> the file's bytes as latin-1 text, base64);
- `catalogs`: the catalogs the cases pass (the built-in one as it was when recorded, an empty one, two small hand-made ones);
- `cases`: 549 calls - every call `tests/test_plan_ifc.py` makes (hostile files and patched limits included), exports of the
  plan_ifc.build corpus read back with varied frames / levels / storeys / catalogs, 240 seeded synthetic foreign files (every
  representation kind the reader knows or refuses, units, storeys, containment by relation or aggregation, material layers, property
  sets, fills, connectors, ignored classes, broken placements), seeded text mutations of exports and foreign files (an instance dropped
  or duplicated, numbers and references broken, classes swapped, property values changed), the report row cap / the per-collection
  limits / the chain depth patched, past and future deadlines. A case may carry text `edits` ([old, new], first occurrence) applied to
  its file and module constants to `patch`.
The answer is the sha256 of the whole result as JSON (key order included; the report's wall-clock `ms` set to 0), a hash per part,
and a readable summary, or the exception the unchanged code raised. Every statement of the unchanged `read` ran in the corpus."""
from __future__ import annotations

import base64
import hashlib
import json
import lzma
import time
from typing import Any

import pytest
from support import char_corpus as cc

from smplwise.services import plan_ifc_read

_CORPUS = cc.load("plan_ifc_read_char_2460.json")
_CASES: list[dict[str, Any]] = _CORPUS["cases"]
_CATALOGS: dict[str, Any] = _CORPUS["catalogs"]
_FILES: dict[str, str] = json.loads(lzma.decompress(base64.b64decode(_CORPUS["files_xz"])))
PARTS = ("walls", "openings", "objects", "rooms", "detector", "ifc")


def _data(case: dict[str, Any]) -> bytes:
    data = _FILES[case["file"]].encode("latin-1")
    if not case["edits"]:
        return data
    text = data.decode("utf-8")
    for old, new in case["edits"]:
        text = text.replace(old, new, 1)
    return text.encode("utf-8")


def _h(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False).encode("utf-8")).hexdigest()[:32]


def _answer(result: dict[str, Any]) -> dict[str, Any]:
    report = result.get("ifc") if isinstance(result, dict) else None
    if isinstance(report, dict) and "ms" in report:
        result = {**result, "ifc": {**report, "ms": 0}}
    plain = cc.plain(result)
    rep = plain["ifc"]
    return {"sha256": _h(plain), "parts": {k: _h(plain[k])[:16] for k in PARTS},
            "summary": {"counts": rep["counts"], "skipped_total": rep["skipped_total"], "skipped_rows": len(rep["skipped"]),
                        "skipped_by_reason": rep["skipped_by_reason"], "warnings": rep["warnings"], "storey": plain["detector"]["params"]["storey"]}}


def _replay(case: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    for name, value in case["patch"].items():
        monkeypatch.setattr(plan_ifc_read, name, value)
    kwargs = dict(case["kwargs"])
    kwargs["catalog"] = _CATALOGS[case["catalog"]]
    kwargs["deadline"] = None if case["deadline"] is None else time.monotonic() + (-1.0 if case["deadline"] == "past" else 600.0)
    try:
        return {"result": _answer(plan_ifc_read.read(_data(case), **kwargs))}
    except Exception as exc:  # noqa: BLE001 - the exception is the recorded outcome
        return {"raises": cc.plain(cc.raised(exc))}


def test_the_corpus_is_broad():
    assert len(_CASES) >= 540 and len(_FILES) >= 300
    done = [c["result"]["summary"] for c in _CASES if "result" in c]
    for coll in ("walls", "openings", "objects", "rooms"):
        assert sum(1 for s in done if s["counts"][coll]) >= 80, coll
    reasons = {r for s in done for r in s["skipped_by_reason"]}
    assert reasons >= {"bad_number", "bad_placement", "connector_not_imported", "curved_geometry", "host_not_wall", "host_wall_skipped", "limit",
                       "live_device", "no_geometry", "no_storey", "opening_off_wall", "other_storey", "outside_plan", "placement_cycle",
                       "tilted_geometry", "unsupported_class", "unsupported_filling", "unsupported_placement"}
    assert {w for s in done for w in s["warnings"]} >= {"no_length_unit", "no_storey_in_file", "schema_ifc2x3"}
    assert any(s["skipped_total"] > s["skipped_rows"] for s in done), "more skipped than the report lists"
    codes = {c["raises"]["attrs"].get("code") for c in _CASES if "raises" in c}
    assert codes >= {"ifc_storey", "ifc_not_step", "ifc_timeout", "ifc_too_complex", "ifc_schema", "ifc_compressed", "ifc_too_large"}
    assert len({c["result"]["sha256"] for c in _CASES if "result" in c}) >= 400, "distinct answers"


@pytest.mark.parametrize("index", range(len(_CASES)))
def test_read_replays_the_recorded_answer(index, monkeypatch):
    case = _CASES[index]
    assert _replay(case, monkeypatch) == cc.recorded(case)
