"""Plan Studio detection API (T086): POST detect returns candidates that are not stored (the draft is untouched, the
audit row carries the counts), refuses bad targets, an unknown level and a viewer, and answers 504 when the detector
outruns the guard; POST detect/accept merges the accepted candidates into the draft under the draft's revision rules,
applies edits, re-issues colliding ids, replaces earlier automatic items on request and never publishes; the
calibration route takes the door-width estimate as an estimated calibration."""
from __future__ import annotations

import dataclasses
import json
import time

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

import plan_detect_metrics as pm
from smplwise.main import create_app
from smplwise.services import plan_detect

APARTMENT = next(png for name, _gt, png in pm.load_set() if name == "apartment")


def _setup(settings, **overrides):
    settings = dataclasses.replace(settings, max_render_px=1600, **overrides)  # the fixture keeps its 1600 px in the version image
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("apartment.png", APARTMENT, "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return app, c, ids, v["id"]


def _draft(c, vid):
    return c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()


def _accept_body(r: dict, ids: list[str], base: int, **extra) -> dict:
    return {"accepted": ids, "edits": {}, "replace_auto": False, "candidates": {"walls": r["walls"], "openings": r["openings"]}, "base_revision": base, "detector": r["detector"], **extra}


def test_detect_returns_candidates_and_stores_nothing(settings):
    app, c, ids, vid = _setup(settings)
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["walls"]) >= 6 and len(body["openings"]) >= 6 and body["version_id"] == vid and body["level_id"] == "L0"
    assert all(w["id"].startswith("auto-") and w["source"] == "auto" and 0 < w["confidence"] <= 0.99 for w in body["walls"])
    assert all(o["wall_id"] in {w["id"] for w in body["walls"]} for o in body["openings"])
    assert body["detector"]["name"] == "plan_detect" and body["detector"]["params"]["strength"] == 0.6 and body["existing_auto"] == {"walls": 0, "openings": 0}
    assert body["calibration_hint"]["status"] == "estimated" and body["calibration_hint"]["method"] == "door_width" and body["scale"]["status"] == "estimated_walls"
    assert body["elapsed_ms"] > 0 and body["pixels"][body["walls"][0]["id"]]["thickness_px"] > 0
    g = _draft(c, vid)
    assert g["doc"]["walls"] == [] and g["geometry"]["status"] == "new", "candidates are never stored"
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry").status_code == 404
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.detect'").fetchall()
    assert len(rows) == 1
    d = json.loads(rows[0][0])
    assert d["walls"] == len(body["walls"]) and d["openings"] == len(body["openings"]) and d["ms"] >= 0 and d["targets"] == ["walls", "openings"]
    only = c.post(f"/api/v1/plan-versions/{vid}/detect", json={"targets": ["walls"], "strength": 0.4}).json()
    assert only["openings"] == [] and only["detector"]["params"]["strength"] == 0.4 and len(only["walls"]) >= 10


def test_detect_refuses_bad_input_and_viewers(settings):
    app, c, ids, vid = _setup(settings)
    assert c.post(f"/api/v1/plan-versions/{vid}/detect", json={"targets": ["openings"]}).status_code == 422
    assert c.post(f"/api/v1/plan-versions/{vid}/detect", json={"targets": ["walls", "rooms"]}).status_code == 422
    assert c.post(f"/api/v1/plan-versions/{vid}/detect", json={"strength": 0.1}).status_code == 422
    assert c.post(f"/api/v1/plan-versions/{vid}/detect", json={"strength": 1.5}).status_code == 422
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={"level_id": "L9"})
    assert r.status_code == 422 and r.json()["code"] == "unknown_level"
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.post(f"/api/v1/plan-versions/{vid}/detect", json={}, headers=as_user("dana")).status_code == 403
    assert c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body({"walls": [], "openings": [], "detector": None}, ["auto-x-w001"], 0), headers=as_user("dana")).status_code == 403


def test_detect_timeout_answers_504_and_discards_the_result(settings, monkeypatch):
    def slow(*args, **kwargs):
        time.sleep(0.8)
        return {"walls": [], "openings": [], "detector": {}, "calibration_hint": None, "pixels": {}, "scale": {}, "stats": {}}

    monkeypatch.setattr(plan_detect, "detect", slow)
    app, c, ids, vid = _setup(settings, detect_timeout_s=0.2)
    t0 = time.perf_counter()
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={})
    assert r.status_code == 504 and r.json()["code"] == "detect_timeout" and r.json()["retryable"] is True
    assert time.perf_counter() - t0 < 0.7, "the request does not wait for the worker"
    assert _draft(c, vid)["doc"]["walls"] == []
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.detect'").fetchall()]
    assert len(rows) == 1 and rows[0]["timed_out"] is True and rows[0]["timeout_s"] == 0.2, "an ApiError still commits its audit row"


def test_accept_merges_edits_reissues_ids_and_replaces_auto(settings):
    app, c, ids, vid = _setup(settings)
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={}).json()
    n_w, n_o = len(r["walls"]), len(r["openings"])
    first = r["walls"][0]["id"]
    body = _accept_body(r, [w["id"] for w in r["walls"]] + [o["id"] for o in r["openings"]], 0, edits={first: {"thickness_m": 0.3, "kind": "exterior", "id": "hacked", "source": "manual"}})
    a = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=body)
    assert a.status_code == 200, a.text
    doc = a.json()["doc"]
    assert a.json()["geometry"]["revision"] == 1 and len(doc["walls"]) == n_w and len(doc["openings"]) == n_o
    edited = next(w for w in doc["walls"] if w["id"] == first)
    assert edited["thickness_m"] == 0.3 and edited["kind"] == "exterior" and edited["source"] == "auto", "edits apply to the editable fields only"
    assert doc["meta"]["last_detection"]["accepted"] == {"walls": n_w, "openings": n_o, "objects": 0} and doc["meta"]["last_detection"]["by"] == "dev-joni"
    assert doc["meta"]["detector_version"] == "plan_detect 1.0"
    assert all(i["code"] != "unknown_wall" for i in a.json()["issues"])
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry").status_code == 404, "nothing is published by accepting"
    # the same run accepted again without replacing: every colliding id is re-issued and the openings follow their wall
    again = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(r, [w["id"] for w in r["walls"]] + [o["id"] for o in r["openings"]], 1))
    assert again.status_code == 200, again.text
    doc2 = again.json()["doc"]
    assert len(doc2["walls"]) == 2 * n_w and len(doc2["openings"]) == 2 * n_o and len({w["id"] for w in doc2["walls"]}) == 2 * n_w
    wall_ids = {w["id"] for w in doc2["walls"]}
    assert all(o["wall_id"] in wall_ids for o in doc2["openings"]) and not any(i["code"] == "unknown_wall" for i in again.json()["issues"])
    # replace_auto drops every automatic item first, and a manual wall survives
    manual = {"id": "m1", "level_id": "L0", "polyline": [[0.05, 0.05], [0.05, 0.5]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    doc2["walls"].append(manual)
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc2, "base_revision": 2}).status_code == 200
    r2 = c.post(f"/api/v1/plan-versions/{vid}/detect", json={}).json()
    assert r2["existing_auto"] == {"walls": 2 * n_w, "openings": 2 * n_o}
    rep = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(r2, [w["id"] for w in r2["walls"]], 3, replace_auto=True))
    assert rep.status_code == 200, rep.text
    doc3 = rep.json()["doc"]
    assert [w["id"] for w in doc3["walls"] if w["source"] == "manual"] == ["m1"] and len(doc3["walls"]) == len(r2["walls"]) + 1 and doc3["openings"] == []
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.detect.accept' ORDER BY rowid").fetchall()]
    assert [x["accepted"]["walls"] for x in rows] == [n_w, n_w, len(r2["walls"])] and rows[1]["reided"] == n_w + n_o and rows[2]["removed_auto"] == 2 * n_w + 2 * n_o and rows[2]["replace_auto"] is True


def test_accept_refuses_stale_unknown_orphan_and_bad_candidates(settings):
    app, c, ids, vid = _setup(settings)
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={}).json()
    wall_ids = [w["id"] for w in r["walls"]]
    stale = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(r, wall_ids, 5))
    assert stale.status_code == 409 and stale.json()["code"] == "stale_revision"
    unknown = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(r, wall_ids + ["auto-zz-w999"], 0))
    assert unknown.status_code == 422 and unknown.json()["code"] == "unknown_candidate" and unknown.json()["details"]["ids"] == ["auto-zz-w999"]
    orphan = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(r, [r["openings"][0]["id"]], 0))
    assert orphan.status_code == 422 and orphan.json()["code"] == "orphan_opening" and orphan.json()["details"]["ids"] == [r["openings"][0]["id"]]
    bad_source = dict(r, walls=[dict(r["walls"][0], source="manual")] + r["walls"][1:])
    assert c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(bad_source, [wall_ids[0]], 0)).json()["code"] == "candidate_source"
    bad_shape = dict(r, walls=[dict(r["walls"][0], polyline="x")] + r["walls"][1:])
    assert c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(bad_shape, [wall_ids[0]], 0)).json()["code"] == "geometry_structure"
    assert _draft(c, vid)["doc"]["walls"] == [] and _draft(c, vid)["geometry"]["revision"] == 0, "a refused accept changes nothing"


def test_calibration_estimate_is_an_estimated_calibration(settings):
    app, c, ids, vid = _setup(settings)
    hint = c.post(f"/api/v1/plan-versions/{vid}/detect", json={}).json()["calibration_hint"]
    r = c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"estimate": {"scale_m_per_px": hint["scale_m_per_px"], "method": "door_width", "reason": hint["reason"]}})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "estimated" and body["residual_pct"] is None and body["warning"] is None and body["scale_m_per_px"] == hint["scale_m_per_px"]
    assert body["version"]["calibration"] == {"method": "door_width", "status": "estimated", "pairs": [], "residual_pct": None, "reason": "לפי רוחב דלת אופייני", "at": body["version"]["calibration"]["at"], "by": "dev-joni"}
    g = _draft(c, vid)["doc"]["dimensions"]
    assert g["scale_m_per_px"] == hint["scale_m_per_px"] and g["calibration"]["status"] == "estimated" and g["calibration"]["method"] == "door_width" and g["calibration"]["reason"] == "לפי רוחב דלת אופייני"
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"estimate": {"scale_m_per_px": 0.01}, "pairs": [{"a": [0.1, 0.5], "b": [0.6, 0.5], "metres": 8}]}).status_code == 422
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={}).status_code == 422
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"estimate": {"scale_m_per_px": 0.01, "method": "guess"}}).status_code == 422
    measured = c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [0.075, 0.1], "b": [0.925, 0.1], "metres": 13.6}]}).json()
    assert measured["status"] == "measured" and measured["version"]["calibration"]["status"] == "measured" and abs(measured["scale_m_per_px"] - 0.01) < 1e-9
    assert _draft(c, vid)["doc"]["dimensions"]["calibration"]["status"] == "measured"
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'plan.calibrate' ORDER BY rowid").fetchall()]
    assert [x["method"] for x in rows] == ["door_width", "two_point"] and rows[0]["status"] == "estimated"


def test_detect_failure_answers_500_detect_failed(settings, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError("thin: not converged after 1 iterations")

    monkeypatch.setattr(plan_detect, "detect", broken)
    app, c, ids, vid = _setup(settings)
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={})
    assert r.status_code == 500 and r.json()["code"] == "detect_failed" and r.json()["details"] == {"error": "RuntimeError"}
    assert _draft(c, vid)["doc"]["walls"] == []
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.detect'").fetchall()]
    assert len(rows) == 1 and rows[0]["failed"] == "RuntimeError", "a failed run still leaves its audit row"


# ---------------------------------------------------------------- fix round 1 (review of ac60773)

def test_accept_refuses_a_non_string_wall_id_from_the_candidate_or_the_edit(settings):
    app, c, ids, vid = _setup(settings)
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={}).json()
    o = r["openings"][0]
    both = [o["wall_id"], o["id"]]
    listed = dict(r, openings=[dict(o, wall_id=[o["wall_id"]])] + r["openings"][1:])
    a = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(listed, both, 0))
    assert a.status_code == 422 and a.json()["code"] == "candidate_shape" and a.json()["details"]["ids"] == [o["id"]]
    e = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(r, both, 0, edits={o["id"]: {"wall_id": {"id": o["wall_id"]}}}))
    assert e.status_code == 422 and e.json()["code"] == "candidate_shape" and e.json()["details"]["ids"] == [o["id"]]
    assert _draft(c, vid)["geometry"]["revision"] == 0


def test_an_estimate_never_replaces_a_measured_calibration_silently(settings):
    app, c, ids, vid = _setup(settings)
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [0.075, 0.1], "b": [0.925, 0.1], "metres": 13.6}]}).status_code == 200
    r = c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"estimate": {"scale_m_per_px": 0.02}})
    assert r.status_code == 409 and r.json()["code"] == "calibration_measured"
    assert _draft(c, vid)["doc"]["dimensions"]["calibration"]["status"] == "measured"
    ok = c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"estimate": {"scale_m_per_px": 0.02}, "replace_measured": True})
    assert ok.status_code == 200 and ok.json()["status"] == "estimated" and ok.json()["scale_m_per_px"] == 0.02
    # an estimate over an estimate needs no confirmation; the detector then reports the estimated status, not measured
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"estimate": {"scale_m_per_px": 0.011}}).status_code == 200
    d = c.post(f"/api/v1/plan-versions/{vid}/detect", json={"targets": ["walls"]}).json()
    assert d["scale"]["status"] == "estimated" and d["scale"]["m_per_px"] > 0
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"estimate": {"scale_m_per_px": 0.01}}, headers=as_user("dana")).status_code == 403


def test_accept_detector_is_a_bounded_model(settings):
    app, c, ids, vid = _setup(settings)
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={}).json()
    wall_ids = [w["id"] for w in r["walls"]]
    assert c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(dict(r, detector={"name": "x" * 65}), wall_ids, 0)).status_code == 422
    assert c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(dict(r, detector={"name": "plan_detect", "version": "9" * 33}), wall_ids, 0)).status_code == 422
    many = {f"k{i}": i for i in range(65)}
    assert c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(dict(r, detector={"name": "plan_detect", "params": many}), wall_ids, 0)).status_code == 422
    a = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(dict(r, detector=dict(r["detector"], blob="x" * 5000)), wall_ids, 0))
    assert a.status_code == 200, a.text
    stored = a.json()["doc"]["meta"]["last_detection"]["detector"]
    assert set(stored) == {"name", "version", "params"} and stored["name"] == "plan_detect" and stored["params"] == r["detector"]["params"]


def test_replace_auto_keeps_locked_walls_counts_manual_openings_and_handles_imported(settings):
    app, c, ids, vid = _setup(settings)
    r = c.post(f"/api/v1/plan-versions/{vid}/detect", json={}).json()
    n_w = len(r["walls"])
    assert c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(r, [w["id"] for w in r["walls"]] + [o["id"] for o in r["openings"]], 0)).status_code == 200
    doc = _draft(c, vid)["doc"]
    host = r["openings"][0]["wall_id"]  # locked: it stays, with its openings
    other = next(w["id"] for w in doc["walls"] if w["id"] != host)
    for w in doc["walls"]:
        if w["id"] == host:
            w["locked"] = True
    doc["openings"].append(dict(r["openings"][0], id="m-o1", source="manual", wall_id=other, t=0.5, width_m=0.1))
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": 1}).status_code == 200
    on_host = [o["id"] for o in doc["openings"] if o["wall_id"] == host]
    removed_openings = sum(1 for o in doc["openings"] if o["source"] == "auto" and o["wall_id"] != host)
    # an accepted opening whose wall the replace just removed is an orphan
    orphan = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(r, [o["id"] for o in r["openings"] if o["wall_id"] != host][:1], 2, replace_auto=True))
    assert orphan.status_code == 422 and orphan.json()["code"] == "orphan_opening"
    r2 = c.post(f"/api/v1/plan-versions/{vid}/detect", json={"targets": ["walls"]}).json()
    rep = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body(r2, [w["id"] for w in r2["walls"]], 2, replace_auto=True))
    assert rep.status_code == 200, rep.text
    doc3 = rep.json()["doc"]
    assert host in {w["id"] for w in doc3["walls"]} and len(doc3["walls"]) == len(r2["walls"]) + 1
    assert sorted(o["id"] for o in doc3["openings"]) == sorted(on_host) and "m-o1" not in {o["id"] for o in doc3["openings"]}
    assert rep.json()["merge"] == {"accepted": {"walls": len(r2["walls"]), "openings": 0, "objects": 0}, "removed_auto": (n_w - 1) + removed_openings, "removed_manual_openings": 1, "reided": 0}
    with app.state.db.connection() as conn:
        last = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.detect.accept' ORDER BY rowid DESC LIMIT 1").fetchone()[0])
    assert last["removed_manual_openings"] == 1 and last["removed_auto"] == (n_w - 1) + removed_openings
    # imported candidates replace the earlier imported ones only; the automatic walls stay
    tpl = {k: v for k, v in r["walls"][0].items()}
    imp = [dict(tpl, id=f"imp-a-w{i}", source="imported") for i in (1, 2)]
    a1 = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body({"walls": imp, "openings": [], "detector": None}, [w["id"] for w in imp], 3))
    assert a1.status_code == 200, a1.text
    before = len(a1.json()["doc"]["walls"])
    imp_b = [dict(tpl, id="imp-b-w1", source="imported")]
    a2 = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json=_accept_body({"walls": imp_b, "openings": [], "detector": None}, ["imp-b-w1"], 4, replace_auto=True))
    assert a2.status_code == 200, a2.text
    walls = a2.json()["doc"]["walls"]
    assert len(walls) == before - 1 and "imp-b-w1" in {w["id"] for w in walls} and not {"imp-a-w1", "imp-a-w2"} & {w["id"] for w in walls}
    assert sum(1 for w in walls if w["source"] == "auto") == len(r2["walls"]) + 1 and a2.json()["merge"]["removed_auto"] == 2
