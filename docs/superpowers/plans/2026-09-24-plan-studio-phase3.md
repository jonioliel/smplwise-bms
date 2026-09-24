# Plan Studio — Phase 3 (T086) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The plan editor gains a "זיהוי" (detect) tool: a local, numpy-only detector proposes walls, doors, windows and passages from the plan picture as candidates with a confidence score, a DXF drawing maps its layers and blocks to the same candidates without a rasterisation round trip, and an accept / reject / edit screen merges what a person keeps into the structure draft. Nothing is published by the detector. A committed synthetic test set with ground truth pins the baseline (walls ≥ 90 %, doors ≥ 80 %, windows ≥ 60 %, ≤ 15 s per plan), and an uncalibrated plan receives a calibration hint from its door widths, marked estimated.

**Architecture:** `services/plan_detect.py` is a pure function over a PNG: Otsu → morphology (the wall mask `plan_stylize` already uses) → Zhang–Suen thinning → skeleton tracing → Douglas–Peucker (`plan_zones.rdp`) → axis snapping at ≤ 4° → collinear merging → thickness from a two-pass chamfer distance transform → gaps between collinear pieces classified by sampling the thin-ink mask (door arc, mirrored arcs, window lines) → windows from the ink-thickness profile along each wall. Every step is numpy; there is no OpenCV, no scipy, no database access and no state. The router runs it in a worker thread with a 60 s guard and returns document-v2 items (`source: "auto"`, `confidence`, ids `auto-…`) that are **not stored**: the client sends the ones it accepted back to `POST …/detect/accept`, which validates, applies edits, remaps ids, merges into the draft under the same revision rules as `PUT …/geometry` and records `meta.last_detection`. `services/plan_dxf_map.py` reads the DXF through the existing ezdxf adapter (`plan_dxf._segments`), maps layer names and INSERT blocks by rules, pairs double lines into walls with a thickness and returns candidates in the same shape (`source: "imported"`, metres measured from the drawing units). The frontend draws candidates as a separate dashed blue layer in `sw-plan-canvas`, on every map surface that already has the structure layer, and the editor's new tool holds the accept / reject / edit state until "אשר".

**Tech Stack:** FastAPI + SQLite on Python 3.12 (Pillow / numpy / ezdxf already present), Lit 3 + TypeScript 5.9 (strict, `noUnusedLocals`), Playwright 1.63. **No new runtime dependency** in this phase.

**Spec:** `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (sections 2, 2a, 4.2, 5 with the 2026-09-24 amendment, 6.3, 7, 9.1–9.6, 13, 14 phase 3, 15, 16 decision 6). Task card: `management/tasks/T086.md` (R171, R172; AT171, AT172). Phase 1 (`docs/superpowers/plans/2026-09-23-plan-studio-phase1.md`, shipped as 0.1.82) and phase 2 (T085, shipped as 0.1.84 before this plan runs) are the foundation.

**Prototype evidence (2026-09-24, this workstation, Python 3.12, numpy 2):** the pipeline written below was run against the six synthetic plans of Task 1 before this document was written: walls recall 0.974–0.999 with precision 0.969–1.000, doors 23 / 23 found and classified as doors (double door included), windows 15 / 15, calibration hints within 2 % of the true scale, 2.1–4.9 s per 1600 px plan (thinning is 55–70 % of it). The thresholds in the Global Constraints are set below those numbers with margin, not at them.

## Rulings

Binding decisions from the controller for this phase (recorded here; where a ruling narrows or extends the design document the difference is noted under "Interpretations" and nothing is silently resolved):

1. **Test-plan set.** Six synthetic plans are generated deterministically by a committed script into committed 1600 px PNGs, each with a ground-truth JSON (walls as segments with thickness, doors with hinge and swing, windows): a rectangular apartment, an L-shaped floor with a corridor, a hall with a double door and a row of windows, a plan with diagonal walls, a noisy scan simulation (speckle, grey noise, a slight rotation) and one at a different wall thickness. The metrics harness computes wall recall by length within a tolerance band, door and window recall by centre distance, and precision; the baseline test asserts walls ≥ 90 %, doors ≥ 80 %, windows ≥ 60 % on the synthetic set and the runtime (≤ 15 s per plan is the asserted budget; the measured local target is ≤ 8 s). Real scans are private (`private-evidence/`, never committed): a local-only script runs the same metrics against a private folder when it exists and skips otherwise; the release evidence quotes numbers, never files.
2. **Detection is a pure function.** `plan_detect.detect(png_bytes | ndarray, *, targets, strength, scale_m_per_px | None, level_id) -> Candidates` has no database access. The router wraps it: `POST /plan-versions/{id}/detect {targets: [walls, openings], strength: 0.3–1.0, level_id}` runs it in a worker thread and waits up to 60 s (timeout → 504 `detect_timeout`; the thread's result is discarded); permission `map.edit`; audit `geometry.detect` with counts and the elapsed time. Candidates are **not stored** server-side: they come back as document-v2 items (walls, openings) with `source: "auto"`, `confidence` 0–1, ids prefixed `auto-`, plus `detector: {name: "plan_detect", version, params}` and `calibration_hint` at the top level.
3. **Accept.** `POST /plan-versions/{id}/detect/accept {accepted: [ids], edits: {id: {…partial item…}}, replace_auto, candidates: {walls, openings}, base_revision}`: the client sends the candidate items it accepted back (the server remembers nothing), the server validates them structurally, applies the edits, removes the existing `source: auto` items first when `replace_auto`, remaps opening `wall_id`s to the accepted walls, merges into the draft with the same revision rules as PUT (409 `stale_revision`), records `meta.last_detection` and audits `geometry.detect.accept` with counts. Nothing is published.
4. **Algorithms follow design section 9.** Walls: wall mask → Zhang–Suen thinning → skeleton tracing into branches → Douglas–Peucker → orthogonalize when ≤ 4° → merge collinear → drop < 0.25 m (or 0.5 % of the width uncalibrated) → thickness = median of 2 × the chamfer distance along the branch → kind by thickness and frame contact → confidence from length, straightness and thickness consistency. Doors: gaps between collinear segments of 0.6–1.5 m calibrated (or 1.5–4 × the thickness) → a quarter-circle sampled in the thin-ink mask (≥ 60 % ink) → door with hinge and swing, else passage; double doors 1.5–2.4 m with mirrored arcs. Windows: thickness profile along walls in 5 cm steps, < 50 % of the wall's median over 0.5–3 m with 2–3 parallel thin lines. Work at 1600 px max side; positions come back in 0–1 of the version's crop. The full numpy code is in Tasks 2–5.
5. **Calibration hint.** When the version is uncalibrated and doors were found, the median door gap is taken as 0.9 m → `calibration_hint: {scale_m_per_px, status: "estimated", method: "door_width", reason: "לפי רוחב דלת אופייני"}`; the client offers "השתמש בהערכה", which PATCHes the calibration with status estimated (the route and the record accept an estimate: method `door_width`, status `estimated`); metres then show with "≈" as in phase 1.
6. **DXF.** `services/plan_dxf_map.py` maps layers by name (WALL, A-WALL, MUR, קיר → walls; DOOR, A-DOOR, דלת → openings; WIND, GLAZ, חלון → windows; FURN, EQPM, ריהוט → objects; ROOM, AREA, חדר → rooms) and blocks by name and bounding box to catalog items (door → דלת, chair → כיסא, bed → מיטה; default "עצם כללי"); two parallel lines 10–40 cm apart become one wall with that thickness; results are in real metres (`measured`). `GET /plan-assets/{id}/dxf/entities` returns per layer the entity count, a sample and the suggested target; `POST /plan-versions/{id}/import-dxf-geometry {layer_map, block_map, level_id}` returns candidates in the detect format (permission `map.import`). The existing ezdxf reader is reused; ezdxf is already a declared dependency (`requirements.txt`), so nothing is added.
7. **Frontend.** A "זיהוי" tool in the editor rail (sparkle icon added to `sw-icon`); its panel has target checkboxes (קירות, פתחים), a strength slider, "זהה אוטומטית" with a progress indicator (synchronous request; the button disables; an elapsed counter), candidates drawn in a separate dashed blue layer with the score on hover / click, "קבל הכול", "קבל מעל 0.8", "קבל לפי סוג", click to toggle accept / reject, endpoint drag of a candidate wall before accepting, a "החלף אוטומטיים קודמים" checkbox, and "אשר", which sends `detect/accept` and reloads the draft through the controller's `load()`; accepted items appear as normal structure with an "auto" badge in the structure panel. The DXF mapping screen lives in the import flow (`explore-plan-import.ts`) for DXF assets: a table of layers with counts, sample and a target select, a block table, and "ייבא כמועמדים", which opens the same candidates layer in the editor. Phone: detection is available, editing candidates is desktop-only (a message says so).
8. **Release.** 0.1.85 (phase 2 ships as 0.1.84 first), CHANGELOG, records (T086 receives the evidence line "on commit <sha>"; AT171 / AT172 PASS only for what the tests exercised, with the real-scan numbers in the evidence text), the owner checklist `docs/operations/PLAN_STUDIO_PHASE3_CHECKLIST_HE.md`, the design document's implementation line; the release task **stops after the release commit** (no merge, push or store reload — the controller does those). Every commit step runs `bash /c/cloude/smplwisebms/secrets/scan_staged.sh` and requires the printed `0`; message in a UTF-8 file without BOM, `git commit -F`, English, no apostrophes, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
9. **Copy and tooling.** Hebrew product strings, English code and documents; strict TypeScript; no new runtime dependencies; pytest never with `-q`; Playwright live specs with `--workers=1` in real Chrome (`SW_LIVE=1 SW_CHROME=1`), never `toBeVisible()` on horizontal SVG lines; each live test creates and cleans up its own site / building / floor and uploads one of the synthetic fixture PNGs as its plan.

**Interpretations and recorded differences** (each is applied consistently through the plan):

- *Where "tests/" lives.* Ruling 1 names `tests/fixtures/plan_detect/gen_synthetic.py` and `tests/plan_detect_metrics.py`; the repository's pytest tree is `smplwise_vms/backend/tests/` (the root `tests/` folder holds evidence only). The fixtures and the harness go under the backend test tree, where the baseline test imports them; the live spec reads the PNGs from there by a relative path.
- *The uncalibrated scale.* Design 6.3 says an uncalibrated plan draws walls at 0.6 % of the width "only to draw". The detector needs metres for its size windows (door 0.6–1.5 m, window 0.5–3 m) before any calibration exists, so it takes the median wall it measured as 0.2 m (the same assumption phase 1 makes, measured on this drawing instead of assumed from the width) and reports `scale.status: "estimated_walls"`. The candidates' metres are computed with that scale (or the calibration when there is one); the response also carries `pixels` (thickness and width in version pixels per item) so the client recomputes metres with the document's effective scale before accepting, and the door-width hint of ruling 5 stays a separate, explicit calibration.
- *Window profile.* Design 9.3 measures the thickness profile "from the distance transform". The morphological closing that builds the wall mask merges a window's two or three parallel lines into a band as thick as the wall, so a profile on the wall mask never drops; the profile is therefore taken on the distance transform of the raw ink (the same statistic, before the closing), where a window is two or three thin lines and the profile drops well under half the wall's thickness.
- *Tilt straightening.* Not in the design; added because ruling 1's noisy plan is rotated. A cheap 800 px pass measures the scan's tilt from the unsnapped segment directions; when it is ≥ 0.15°, the picture is straightened by that angle before the real pass, so snapping and collinear merging see axis-parallel walls, and every result is rotated back onto the scan. A straight scan takes the 800 px pass only (it costs about a tenth of the main pass).
- *`GET /plan-assets/{id}/dxf/entities` permission.* The design table (section 5) says `map.read`; every existing plan-asset route (`/dxf`, uploads, previews) requires `map.import`, and viewers have no path to an asset id. The route follows the existing asset routes (`map.import`); the table row is recorded as a contradiction in Task 12's design-document line, not silently changed.
- *Confidence.* Ruling 4 lists length, straightness and thickness consistency; design 9.1 step 5 also mentions "fit into a detected room polygon". The ruling's three factors are implemented; the room factor is left out and noted.
- *DXF objects and rooms.* Blocks map to `objects` candidates shaped after design 4.2 (`catalog_id`, `name`, `pose`, `size`, `source: "imported"`); Task 7 lists the fields, and its consistency row requires reconciling them with phase 2's object rules in `plan_geometry._check_fields` once that code is on the branch. Closed polylines on a rooms layer come back as `rooms` polygons for the existing zones accept (`POST /floors/{id}/zones/accept`), because rooms live in `spatial_zones`, not in the geometry document (design decision 1).
- *Candidate ids.* `auto-<run>-w001` / `auto-<run>-o001` (detection) and `imp-<run>-w001` (DXF), where `<run>` is a 6-hex run id the router draws; an accepted id that already exists in the draft is re-issued by the server (and its openings remapped) instead of refused, so accepting the same run twice without `replace_auto` cannot corrupt the draft.

## Global Constraints

- Geometry contract: coordinates normalized 0..1 to the plan **version image**, origin top-left, points stored as `[x, y]` arrays (like v1 and `coverage_polygon`); angles 0° = up, clockwise; sizes in metres.
- Metres only from calibration. Uncalibrated drawing uses the estimated scale `0.2 m / (0.006 × width_px)` and every metre value shown is prefixed `≈`.
- Nothing automatic is published: publish is the only way viewers see a change. Drafts are editor-only.
- Permissions (VMS, floor scope `("floor", floor_id)`): `map.read` = published document, timeline, exports of the published document; `map.edit` = draft read/write, calibration, copy, draft exports, diff, versions; `map.publish` = publish, rollback.
- Determinism: canonical JSON = `plan_schema.canonical_json` (sorted keys, floats rounded to 6 digits); `doc_hash` = SHA-256 of it; primitives rounded **half-up** to 0.01 px with `floor(v * 100 + 0.5) / 100` in both languages.
- Migrations are additive only. Backups include every new table.
- UI copy in Hebrew; code, comments and commit messages in English.
- Commits: message in a temp file (UTF-8, no BOM), `git commit -F`; trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (CLAUDE.md); before every commit `bash /c/cloude/smplwisebms/secrets/scan_staged.sh` must print `0` - the script lives in the gitignored `secrets/` folder because its pattern names private identifiers; never copy the pattern into a tracked file. Keep commit messages free of apostrophes (the shell harness chokes on unbalanced quotes in heredocs).
- Branch: `git checkout -b pilot/T086-plan-studio-3 g0/intake` before Task 1 (after phase 2's merge is on `g0/intake`). The release task ends at the release commit; the controller merges and pushes.
- Commands (Git Bash on Windows):
  - `SP=C:/Users/jon/AppData/Local/Temp/claude/C--cloude-smplwisebms/bd61f90d-850a-444f-9da9-92c50c272bc2/scratchpad` - the session scratchpad; it already holds `fixture_chain.sh`, `restart_backend.ps1` (starts the developer backend hidden) and `restart_dev.sh` (created by the phase-1 plan; recreate it from the block below when missing).
  - "Restart the developer backend" means `bash "$SP/restart_dev.sh"`.
  - `PY=C:/cloude/smplwisebms/.venv/Scripts/python.exe`
  - Backend tests: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest <files> -p no:cacheprovider` — do **not** add `-q` (pyproject already sets it; `-qq` hides the summary line).
  - Node: `export PATH="$APPDATA/fnm/node-versions/v24.21.0/installation:$PATH"`; in `frontend/`: `npx tsc --noEmit -p tsconfig.json`, `npm run build`, `npx playwright test <spec> --project=desktop --workers=1 --reporter=line`.
  - Live specs (`SW_LIVE=1 SW_CHROME=1`) need the developer backend on 8099 (restart it after any backend change) and a fresh `npm run build` (the preview on 4173 serves `frontend/dist` and proxies `/api` to 8099).
  - Demo fixture chain (only when a demo-visible component changed): `bash "$SP/fixture_chain.sh"` - it stops the backend, runs `tests/screenshots.spec.ts tests/screens.spec.ts` in demo mode (expect `fixtures exit: 0` and the same count as the phase-2 baseline), restores `docs/evidence/T007` and restarts the backend.
  - Never edit version files while a background pytest run is in progress. Run `scripts/dev_cleanup.ps1 -StopBackend` when a batch of live specs is done.
- Detection budget: the baseline test asserts ≤ 15 s per synthetic plan; the local target is ≤ 8 s (Task 11 measures and records the numbers). The router's guard is `Settings.detect_timeout_s` = 60.
- Private material: real scans stay in `private-evidence/plan_detect/` (gitignored); the plan never names a lab host, address, serial or token, and the evidence lines quote metrics only.


**Developer backend restart helper** (recreate it only if `$SP/restart_dev.sh` is missing; it kills the running wrapper, starts a new one, shows that it answers and which process listens):

```bash
cat > "$SP/restart_dev.sh" <<'EOF'
#!/bin/bash
SP="$(cd "$(dirname "$0")" && pwd)"
WPID=$(powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*run_backend.ps1*' } | Select-Object -First 1).ProcessId")
[ -n "$WPID" ] && taskkill //PID "$WPID" //T //F > /dev/null 2>&1
sleep 3
powershell -NoProfile -ExecutionPolicy Bypass -File "$SP/restart_backend.ps1"
sleep 25
curl -s -o /dev/null -w "me: %{http_code}\n" http://127.0.0.1:8099/api/v1/me
powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 8099 -State Listen | Select-Object -First 1).OwningProcess"
EOF
```

Expect `me: 200` and a listener pid different from the previous run; an old process can survive on the port - stop it with `powershell -NoProfile -Command "Stop-Process -Id <that pid>"` and run the helper again.

---

## File Structure

**Backend — create**
- `smplwise_vms/backend/tests/fixtures/plan_detect/gen_synthetic.py` — the deterministic generator of the six synthetic plans and their ground truth.
- `smplwise_vms/backend/tests/fixtures/plan_detect/{apartment,lshape,hall,diagonal,noisy,thick}.png` and `.json` — the committed test-plan set (1600 × 1200 px) with ground truth.
- `smplwise_vms/backend/tests/plan_detect_metrics.py` — the metrics harness (wall recall by length, opening recall by centre distance, precision, the set runner).
- `smplwise_vms/backend/smplwise/services/plan_detect.py` — the detector: raster primitives (chamfer distance transform, Zhang–Suen thinning, skeleton tracing), segments, walls, doors, windows, confidence, the calibration hint.
- `smplwise_vms/backend/smplwise/services/plan_dxf_map.py` — DXF layer / block mapping to candidates.
- `scripts/plan_detect_private.py` — the local-only run of the metrics against `private-evidence/plan_detect/` (skips when absent; prints numbers only).
- Tests: `smplwise_vms/backend/tests/test_plan_detect_fixtures.py`, `test_plan_detect_raster.py`, `test_plan_detect_walls.py`, `test_plan_detect_openings.py`, `test_plan_detect_baseline.py`, `test_plan_detect_api.py`, `test_plan_dxf_map.py`.

**Backend — modify**
- `smplwise_vms/backend/smplwise/config.py` — `Settings.detect_timeout_s`.
- `smplwise_vms/backend/smplwise/services/plan_geometry.py` — `merge_candidates`, `CandidateError`, `calibration_of` passes the record's reason through.
- `smplwise_vms/backend/smplwise/routers/plan_geometry.py` — `POST …/detect`, `POST …/detect/accept`, the calibration route accepts an estimate.
- `smplwise_vms/backend/smplwise/routers/plans.py` — `GET /plan-assets/{id}/dxf/entities`, `POST /plan-versions/{id}/import-dxf-geometry`.

**Frontend — create**
- `frontend/src/map/candidates.ts` — pure candidate-set operations (rescale, parents, selection rules, vertex move, the DXF hand-off through sessionStorage).
- Tests: `frontend/tests/unit-plan-detect.spec.ts` (node, no page), `frontend/tests/evidence-plan-studio-3.spec.ts` (live).

**Frontend — modify**
- `frontend/src/api/geometry.ts` — detect / accept / estimate calibration / DXF entities / DXF import clients and types.
- `frontend/src/api/types.ts` — `PlanVersion.calibration.status`.
- `frontend/src/map/sw-plan-canvas.ts` — the candidates layer, hit testing, endpoint drag, score pill.
- `frontend/src/components/sw-icon.ts` — `sparkle`.
- `frontend/src/styles/tokens.css` — `--sw-map-candidate`.
- `frontend/src/screens/plan-studio-panel.ts` — `renderDetectPanel`, the auto badge on selected items.
- `frontend/src/screens/explore-plan-editor.ts` — the detect tool, its state and actions, the accept flow, the DXF hand-off.
- `frontend/src/screens/explore-plan-import.ts` — the DXF mapping card.
- `frontend/src/shell/sw-app.ts` — passes `?candidates=` to the editor.

**Release**
- `smplwise_vms/config.yaml`, `smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` (0.1.85), `smplwise_vms/CHANGELOG.md`, `contracts/API_INVENTORY.md` (generated), `smplwise_vms/www/` (generated), `management/tasks.json`, `management/test_catalog.json` and the generated views, `docs/operations/PLAN_STUDIO_PHASE3_CHECKLIST_HE.md`, `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (implementation line).

---

### Task 1: The synthetic test-plan set, its ground truth and the metrics harness

**Files:**
- Create: `smplwise_vms/backend/tests/fixtures/plan_detect/gen_synthetic.py`
- Create (generated by it, committed): `smplwise_vms/backend/tests/fixtures/plan_detect/{apartment,lshape,hall,diagonal,noisy,thick}.png` + `.json`
- Create: `smplwise_vms/backend/tests/plan_detect_metrics.py`
- Test: `smplwise_vms/backend/tests/test_plan_detect_fixtures.py`

**Interfaces:**
- Consumes: Pillow, numpy.
- Produces:
  - `gen_synthetic.PLANS: dict[str, Callable[[], Plan]]` (six names in the order apartment, lshape, hall, diagonal, noisy, thick), `gen_synthetic.build(name) -> Plan` (`Plan.im: PIL.Image` "L", `Plan.gt: dict`), `gen_synthetic.generate(out_dir: Path) -> list[str]`.
  - Ground truth JSON: `{"name", "width", "height", "scale_m_per_px", "walls": [{"a": [x, y], "b": [x, y], "thickness_px", "kind"}], "doors": [{"centre": [x, y], "width_px", "wall", "hinge", "swing", "double"}], "windows": [{"centre", "width_px", "wall"}], "rotation_deg"?}` in the PNG's pixels.
  - `plan_detect_metrics.FIXTURES: Path`, `load_set(folder=FIXTURES) -> list[tuple[str, dict, bytes]]`, `wall_scores(gt, walls, tol_px) -> {"recall", "precision", "gt_length_px", "detected_length_px"}` (recall by length excludes the spans of the ground-truth openings: no wall exists there), `opening_scores(gt, walls, openings, kinds, gt_key, tol_px) -> {"recall", "kind_recall", "found", "total", "false"}`, `evaluate(gt, result, tol_px=10.0) -> {"walls", "doors", "windows"}`, `TOLERANCE_PX: dict[str, float]` (12 for `noisy`, 10 otherwise), `run_set(detect_fn, folder=FIXTURES, calibrated=True) -> list[dict]` (per plan: `name`, `ms`, the three score blocks, `hint`).

- [ ] **Step 1: Write the failing test**

```python
"""Plan Studio detection fixtures (T086): the committed synthetic plans are exactly what the generator draws (pixel for
pixel, and the same ground truth), each ground truth is consistent (openings sit on their wall, every wall has a
thickness), and the metrics harness scores a perfect answer as 1.0 and a wrong one as 0."""
from __future__ import annotations

import io
import json
import pathlib
import sys

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "fixtures" / "plan_detect"))
import gen_synthetic as gen  # noqa: E402
import plan_detect_metrics as pm  # noqa: E402

NAMES = ["apartment", "lshape", "hall", "diagonal", "noisy", "thick"]


def test_committed_fixtures_match_the_generator(tmp_path):
    assert list(gen.PLANS) == NAMES
    assert gen.generate(tmp_path) == NAMES
    for name in NAMES:
        fresh = np.asarray(Image.open(tmp_path / f"{name}.png").convert("L"))
        kept = np.asarray(Image.open(pm.FIXTURES / f"{name}.png").convert("L"))
        assert kept.shape == (1200, 1600) and np.array_equal(fresh, kept), f"{name}.png differs from the generator: rerun gen_synthetic.py"
        assert json.loads((tmp_path / f"{name}.json").read_text(encoding="utf-8")) == json.loads((pm.FIXTURES / f"{name}.json").read_text(encoding="utf-8")), name


def test_ground_truth_is_consistent():
    for name, gt, png in pm.load_set():
        assert gt["name"] == name and gt["width"] == 1600 and gt["height"] == 1200 and 0.005 <= gt["scale_m_per_px"] <= 0.02
        assert len(gt["walls"]) >= 5 and all(w["thickness_px"] >= 8 for w in gt["walls"])
        for o in gt["doors"] + gt["windows"]:
            wall = gt["walls"][o["wall"]]
            a, b = np.array(wall["a"], float), np.array(wall["b"], float)
            d = (b - a) / np.linalg.norm(b - a)
            v = np.array(o["centre"], float) - a
            lateral = abs(d[0] * v[1] - d[1] * v[0])
            along = float(np.dot(v, d))
            assert lateral < 1.5 and 0 < along < np.linalg.norm(b - a), (name, o)
            # a real door: 0.8-1.0 m single, 1.6-2.0 m double; a window 1.0-1.5 m
            metres = o["width_px"] * gt["scale_m_per_px"]
            assert (1.5 <= metres <= 2.0) if o.get("double") else (0.7 <= metres <= 1.5), (name, o, metres)
        assert Image.open(io.BytesIO(png)).size == (1600, 1200)
    assert sum(len(gt["doors"]) for _, gt, _ in pm.load_set()) >= 20 and sum(len(gt["windows"]) for _, gt, _ in pm.load_set()) >= 12


def _perfect(gt: dict) -> dict:
    """A detector answer built from the ground truth itself, in the response shape of plan_detect.detect."""
    w, h = gt["width"], gt["height"]
    walls = [{"id": f"auto-t-w{i:03d}", "polyline": [[a[0] / w, a[1] / h], [b[0] / w, b[1] / h]]} for i, (a, b) in enumerate((x["a"], x["b"]) for x in gt["walls"])]
    openings = []
    for k, key in (("door", "doors"), ("window", "windows")):
        for j, o in enumerate(gt[key]):
            wall = gt["walls"][o["wall"]]
            a, b = np.array(wall["a"], float), np.array(wall["b"], float)
            t = float(np.dot(np.array(o["centre"], float) - a, (b - a) / np.linalg.norm(b - a))) / float(np.linalg.norm(b - a))
            openings.append({"id": f"auto-t-{k}{j}", "wall_id": walls[o["wall"]]["id"], "t": t, "kind": k})
    return {"walls": walls, "openings": openings}


def test_metrics_score_a_perfect_and_an_empty_answer():
    name, gt, _ = pm.load_set()[0]
    good = pm.evaluate(gt, _perfect(gt), pm.TOLERANCE_PX.get(name, 10.0))
    assert good["walls"]["recall"] > 0.999 and good["walls"]["precision"] > 0.999
    assert good["doors"]["recall"] == 1.0 and good["doors"]["kind_recall"] == 1.0 and good["doors"]["false"] == 0
    assert good["windows"]["recall"] == 1.0 and good["windows"]["false"] == 0
    empty = pm.evaluate(gt, {"walls": [], "openings": []})
    assert empty["walls"]["recall"] == 0.0 and empty["doors"]["recall"] == 0.0 and empty["windows"]["recall"] == 0.0
    # a wall far from every ground-truth wall counts against precision, and a door on it counts as false
    off = {"walls": [{"id": "x", "polyline": [[0.5, 0.5], [0.6, 0.5]]}], "openings": [{"id": "o", "wall_id": "x", "t": 0.5, "kind": "door"}]}
    bad = pm.evaluate(gt, off)
    assert bad["walls"]["precision"] == 0.0 and bad["doors"]["false"] == 1
```

- [ ] **Step 2: Run to see it fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_fixtures.py -p no:cacheprovider`
Expected: FAIL — `ModuleNotFoundError: No module named 'gen_synthetic'`.

- [ ] **Step 3: Write the generator**

`smplwise_vms/backend/tests/fixtures/plan_detect/gen_synthetic.py`:

```python
"""The synthetic test-plan set of the Plan Studio detector (T086, design section 13): six deterministic plans at
1600 x 1200 px drawn with Pillow, each with its ground truth (walls as segments with a thickness, doors with hinge and
swing, windows) in pixel coordinates. `python gen_synthetic.py` rewrites the PNG and JSON files next to it; the test
test_plan_detect_fixtures.py refuses a committed picture that differs from what this script draws. Real scans never
join this folder: they stay in private-evidence/ (scripts/plan_detect_private.py runs the same metrics on them)."""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any, Callable

import numpy as np
from PIL import Image, ImageDraw

W, H = 1600, 1200
INK = 0


class Plan:
    def __init__(self, name: str, scale_m_per_px: float, width: int = W, height: int = H) -> None:
        self.name = name
        self.im = Image.new("L", (width, height), 255)
        self.d = ImageDraw.Draw(self.im)
        self.gt: dict[str, Any] = {"name": name, "width": width, "height": height, "scale_m_per_px": scale_m_per_px, "walls": [], "doors": [], "windows": []}

    def wall(self, a, b, t: int, kind: str = "interior") -> int:
        self.d.line([tuple(a), tuple(b)], fill=INK, width=t)
        for p in (a, b):  # square caps: a Pillow line leaves half caps open at its ends; corners must be solid
            self.d.rectangle([p[0] - t // 2, p[1] - t // 2, p[0] + t // 2, p[1] + t // 2], fill=INK)
        self.gt["walls"].append({"a": list(a), "b": list(b), "thickness_px": t, "kind": kind})
        return len(self.gt["walls"]) - 1

    def _gap(self, wall_i: int, centre, width: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        w = self.gt["walls"][wall_i]
        a, b = np.array(w["a"], float), np.array(w["b"], float)
        d = (b - a) / np.linalg.norm(b - a)
        n = np.array([d[1], -d[0]])
        t = w["thickness_px"]
        c = np.array(centre, float)
        g0, g1 = c - d * width / 2, c + d * width / 2
        poly = [tuple(g0 + n * (t / 2 + 1)), tuple(g1 + n * (t / 2 + 1)), tuple(g1 - n * (t / 2 + 1)), tuple(g0 - n * (t / 2 + 1))]
        self.d.polygon(poly, fill=255)  # the wall is erased inside the gap
        return g0, g1, d

    def door(self, wall_i: int, centre, width: int, hinge: str = "start", swing: str = "left", double: bool = False) -> None:
        """A door symbol as architects draw it: the leaf from the hinge and the quarter arc it sweeps. hinge / swing are
        relative to the wall's direction a -> b: nl = (d.y, -d.x) is "left", nr = (-d.y, d.x) is "right" (the same
        convention as geometry.ts door())."""
        g0, g1, d = self._gap(wall_i, centre, width)
        nl, nr = np.array([d[1], -d[0]]), np.array([-d[1], d[0]])
        n = nl if swing == "left" else nr
        if double:
            leaves = [(g0, g0 + d * width / 2, width / 2), (g1, g1 - d * width / 2, width / 2)]
        else:
            leaves = [(g0, g1, width)] if hinge == "start" else [(g1, g0, width)]
        for h, other, r in leaves:
            tip = h + n * r
            self.d.line([tuple(h), tuple(tip)], fill=INK, width=2)
            a0 = math.atan2(tip[1] - h[1], tip[0] - h[0])
            a1 = math.atan2(other[1] - h[1], other[0] - h[0])
            da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
            pts = [(h[0] + r * math.cos(a0 + da * k / 30), h[1] + r * math.sin(a0 + da * k / 30)) for k in range(31)]
            self.d.line(pts, fill=INK, width=2)
        self.gt["doors"].append({"centre": list(centre), "width_px": width, "wall": wall_i, "hinge": hinge, "swing": "double" if double else swing, "double": double})

    def window(self, wall_i: int, centre, width: int, lines: int = 3) -> None:
        """Two or three thin lines along the wall inside the opening (both faces and the glass line)."""
        g0, g1, d = self._gap(wall_i, centre, width)
        t = self.gt["walls"][wall_i]["thickness_px"]
        n = np.array([d[1], -d[0]])
        for o in ([-t / 2, 0, t / 2] if lines == 3 else [-t / 2, t / 2]):
            self.d.line([tuple(g0 + n * o), tuple(g1 + n * o)], fill=INK, width=2)
        self.gt["windows"].append({"centre": list(centre), "width_px": width, "wall": wall_i})

    def text_specks(self, x0: int, y0: int, n: int = 24) -> None:
        for i in range(n):
            x = x0 + i * 22
            self.d.rectangle([x, y0, x + 7, y0 + 12], outline=INK, width=1)

    def dimension_line(self, a, b) -> None:
        self.d.line([tuple(a), tuple(b)], fill=INK, width=1)
        for p in (a, b):
            self.d.line([(p[0], p[1] - 8), (p[0], p[1] + 8)], fill=INK, width=1)

    def furniture(self, box) -> None:
        self.d.rectangle(list(box), outline=INK, width=2)


def apartment(name: str = "apartment", outer: int = 16, inner: int = 10, door_w: int = 90, win_w: int = 120, scale: float = 0.01) -> Plan:
    """16 x 12 m at 0.01 m / px: outer walls 0.16 m, partitions 0.10 m, doors 0.9 m, windows 1.2 m."""
    p = Plan(name, scale)
    w0 = p.wall((120, 120), (1480, 120), outer, "exterior")
    w1 = p.wall((1480, 120), (1480, 1080), outer, "exterior")
    w2 = p.wall((1480, 1080), (120, 1080), outer, "exterior")
    p.wall((120, 1080), (120, 120), outer, "exterior")
    w4 = p.wall((800, 120), (800, 1080), inner)
    w5 = p.wall((120, 600), (800, 600), inner)
    w6 = p.wall((800, 700), (1480, 700), inner)
    p.door(w4, (800, 400), door_w, "start", "left")
    p.door(w5, (460, 600), door_w, "end", "right")
    p.door(w6, (1140, 700), door_w, "start", "right")
    p.door(w2, (400, 1080), door_w, "start", "left")
    p.window(w0, (460, 120), win_w)
    p.window(w0, (1140, 120), win_w)
    p.window(w1, (1480, 900), win_w, lines=2)
    p.text_specks(200, 160)
    p.dimension_line((120, 1140), (1480, 1140))
    p.furniture((900, 800, 1100, 950))
    return p


def lshape() -> Plan:
    p = Plan("lshape", 0.01)
    pts = [(120, 120), (1000, 120), (1000, 640), (1480, 640), (1480, 1080), (120, 1080)]
    ids = [p.wall(a, b, 16, "exterior") for a, b in zip(pts, pts[1:] + pts[:1])]
    c1 = p.wall((560, 120), (560, 1080), 10)
    c2 = p.wall((120, 500), (560, 500), 10)
    c3 = p.wall((560, 860), (1480, 860), 10)  # the corridor wall
    p.wall((1000, 640), (1000, 860), 10)
    p.door(c1, (560, 320), 90, "start", "right")
    p.door(c2, (340, 500), 90, "end", "left")
    p.door(c3, (780, 860), 90, "start", "left")
    p.door(c3, (1240, 860), 90, "end", "right")
    p.window(ids[0], (340, 120), 120)
    p.window(ids[3], (1480, 860), 120)
    p.text_specks(640, 180, 12)
    return p


def hall() -> Plan:
    """A hall at 0.012 m / px: a 1.9 m double door in the inner wall, 0.96 m doors, five 1.2 m windows in a row."""
    p = Plan("hall", 0.012)
    w0 = p.wall((100, 100), (1500, 100), 20, "exterior")
    p.wall((1500, 100), (1500, 1100), 20, "exterior")
    w2 = p.wall((1500, 1100), (100, 1100), 20, "exterior")
    p.wall((100, 1100), (100, 100), 20, "exterior")
    w4 = p.wall((100, 900), (1500, 900), 12)
    p.door(w4, (800, 900), 160, double=True)
    p.door(w2, (300, 1100), 80, "start", "right")
    p.door(w2, (1300, 1100), 80, "end", "left")
    for x in (300, 550, 800, 1050, 1300):
        p.window(w0, (x, 100), 100)
    p.furniture((400, 300, 500, 360))
    p.furniture((700, 300, 800, 360))
    return p


def diagonal() -> Plan:
    """A 45 degree wall with a door, a wall at about 20 degrees, a steep outer edge."""
    p = Plan("diagonal", 0.01)
    pts = [(200, 120), (1480, 120), (1480, 1080), (120, 1080), (120, 500)]
    ids = [p.wall(a, b, 16, "exterior") for a, b in zip(pts, pts[1:] + pts[:1])]
    d1 = p.wall((700, 120), (1200, 620), 10)
    d2 = p.wall((1200, 620), (1480, 620), 10)
    p.wall((120, 800), (900, 1080), 10)
    p.door(d1, (950, 370), 90, "start", "left")
    p.door(d2, (1340, 620), 90, "end", "right")
    p.window(ids[0], (450, 120), 120)
    return p


def noisy(seed: int = 7, angle: float = 0.8) -> Plan:
    """The apartment as a poor scan: speckle (0.4 % of the pixels), grey noise and a 0.8 degree rotation. The ground
    truth is rotated with the picture (Pillow rotates counter-clockwise on screen about the centre)."""
    p = apartment("noisy", scale=0.0105)
    rng = np.random.RandomState(seed)
    arr = np.asarray(p.im, dtype=np.uint8).copy()
    arr[rng.rand(*arr.shape) < 0.004] = 60
    arr = np.clip(arr.astype(np.float64) + rng.normal(0, 6, arr.shape), 0, 255).astype(np.uint8)
    p.im = Image.fromarray(arr, "L").rotate(angle, resample=Image.BILINEAR, fillcolor=255)
    cx, cy, th = W / 2, H / 2, math.radians(angle)

    def rot(q):
        x, y = q[0] - cx, q[1] - cy
        return [round(cx + x * math.cos(th) + y * math.sin(th), 1), round(cy - x * math.sin(th) + y * math.cos(th), 1)]

    for w in p.gt["walls"]:
        w["a"], w["b"] = rot(w["a"]), rot(w["b"])
    for o in p.gt["doors"] + p.gt["windows"]:
        o["centre"] = rot(o["centre"])
    p.gt["rotation_deg"] = angle
    return p


def thick() -> Plan:
    """Heavier walls at 0.009 m / px: 0.25 m outer, 0.16 m inner, 0.9 m doors, 1.17 m windows."""
    return apartment("thick", outer=28, inner=18, door_w=100, win_w=130, scale=0.009)


PLANS: dict[str, Callable[[], Plan]] = {"apartment": apartment, "lshape": lshape, "hall": hall, "diagonal": diagonal, "noisy": noisy, "thick": thick}


def build(name: str) -> Plan:
    return PLANS[name]()


def generate(out_dir: Path) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, make in PLANS.items():
        p = make()
        p.im.save(out_dir / f"{name}.png", format="PNG", optimize=True)
        (out_dir / f"{name}.json").write_text(json.dumps(p.gt, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    return list(PLANS)


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
    print("generated", generate(target))
```

Generate the committed set: `cd smplwise_vms/backend/tests/fixtures/plan_detect && MSYS_NO_PATHCONV=1 $PY gen_synthetic.py` → `generated ['apartment', 'lshape', 'hall', 'diagonal', 'noisy', 'thick']` and twelve files (each PNG 15–60 KB).

- [ ] **Step 4: Write the metrics harness**

`smplwise_vms/backend/tests/plan_detect_metrics.py`:

```python
"""Metrics of the Plan Studio detector (T086, R172) against a ground truth in the plan's pixel space: wall recall by
length (a detected segment covers the part of a ground-truth wall it runs along within an angle and a lateral
tolerance), wall precision by length, door and window recall by centre distance. Shared by the baseline test on the
committed synthetic set and by scripts/plan_detect_private.py on private scans (never committed)."""
from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Any, Callable

import numpy as np

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "plan_detect"
ANGLE_TOL_DEG = 6.0
TOLERANCE_PX: dict[str, float] = {"noisy": 12.0}


def load_set(folder: Path = FIXTURES) -> list[tuple[str, dict[str, Any], bytes]]:
    out = []
    for png in sorted(folder.glob("*.png")):
        gt_path = png.with_suffix(".json")
        if gt_path.exists():
            out.append((png.stem, json.loads(gt_path.read_text(encoding="utf-8")), png.read_bytes()))
    return out


def _seg_px(wall: dict[str, Any], w: int, h: int) -> tuple[np.ndarray, np.ndarray]:
    pl = wall["polyline"]
    return np.array([pl[0][0] * w, pl[0][1] * h]), np.array([pl[-1][0] * w, pl[-1][1] * h])


def _overlap_on(gt_a: np.ndarray, gt_b: np.ndarray, a: np.ndarray, b: np.ndarray, tol_px: float) -> float:
    """Length of the detected segment a-b lying along the ground-truth segment: both ends within tol_px of its line,
    directions within ANGLE_TOL_DEG, measured as the overlap of the projections."""
    g = gt_b - gt_a
    gl = float(np.hypot(*g))
    v = b - a
    vl = float(np.hypot(*v))
    if gl < 1e-9 or vl < 1e-9:
        return 0.0
    d = g / gl
    cos = abs(float(np.dot(v / vl, d)))
    if math.degrees(math.acos(max(-1.0, min(1.0, cos)))) > ANGLE_TOL_DEG:
        return 0.0
    for p in (a, b):
        if abs(float(d[0] * (p - gt_a)[1] - d[1] * (p - gt_a)[0])) > tol_px:
            return 0.0
    a0, a1 = float(np.dot(a - gt_a, d)), float(np.dot(b - gt_a, d))
    return max(0.0, min(gl, max(a0, a1)) - max(0.0, min(a0, a1)))


def _subtract(intervals: list[tuple[float, float]], holes: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out = intervals
    for h0, h1 in holes:
        nxt = []
        for lo, hi in out:
            if hi <= h0 or lo >= h1:
                nxt.append((lo, hi))
            else:
                if lo < h0:
                    nxt.append((lo, h0))
                if hi > h1:
                    nxt.append((h1, hi))
        out = nxt
    return out


def _holes(gt: dict[str, Any]) -> dict[int, list[tuple[float, float]]]:
    """The spans of the openings along each ground-truth wall: no wall exists there, so they count neither as length to
    cover nor as covered (a walls-only pass leaves a door gap open; a full pass spans it with the opening)."""
    holes: dict[int, list[tuple[float, float]]] = {}
    for o in gt["doors"] + gt["windows"]:
        gw = gt["walls"][o["wall"]]
        ga, gb = np.array(gw["a"], float), np.array(gw["b"], float)
        d = (gb - ga) / float(np.hypot(*(gb - ga)))
        c = float(np.dot(np.array(o["centre"], float) - ga, d))
        holes.setdefault(o["wall"], []).append((c - o["width_px"] / 2, c + o["width_px"] / 2))
    return holes


def wall_scores(gt: dict[str, Any], walls: list[dict[str, Any]], tol_px: float) -> dict[str, float]:
    w, h = gt["width"], gt["height"]
    holes = _holes(gt)
    total_gt = covered = 0.0
    for wi, gw in enumerate(gt["walls"]):
        ga, gb = np.array(gw["a"], float), np.array(gw["b"], float)
        gl = float(np.hypot(*(gb - ga)))
        total_gt += sum(hi - lo for lo, hi in _subtract([(0.0, gl)], holes.get(wi, [])))
        d = (gb - ga) / gl
        intervals = []
        for dw in walls:
            a, b = _seg_px(dw, w, h)
            if _overlap_on(ga, gb, a, b, tol_px) > 0:
                a0, a1 = float(np.dot(a - ga, d)), float(np.dot(b - ga, d))
                intervals.append((max(0.0, min(a0, a1)), min(gl, max(a0, a1))))
        intervals.sort()
        merged: list[tuple[float, float]] = []
        for lo, hi in intervals:  # the union of the covered intervals, so two overlapping pieces do not count twice
            if merged and lo <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], hi))
            else:
                merged.append((lo, hi))
        covered += sum(hi - lo for lo, hi in _subtract(merged, holes.get(wi, [])))
    total_det = matched = 0.0
    for dw in walls:
        a, b = _seg_px(dw, w, h)
        dl = float(np.hypot(*(b - a)))
        total_det += dl
        best = max((_overlap_on(np.array(gw["a"], float), np.array(gw["b"], float), a, b, tol_px) for gw in gt["walls"]), default=0.0)
        matched += min(dl, best)
    return {"recall": covered / total_gt if total_gt else 1.0, "precision": matched / total_det if total_det else 1.0, "gt_length_px": total_gt, "detected_length_px": total_det}


def _centre(o: dict[str, Any], walls_by_id: dict[str, dict[str, Any]], w: int, h: int) -> np.ndarray | None:
    wall = walls_by_id.get(o["wall_id"])
    if wall is None:
        return None
    a, b = _seg_px(wall, w, h)
    return a + (b - a) * o["t"]


def opening_scores(gt: dict[str, Any], walls: list[dict[str, Any]], openings: list[dict[str, Any]], kinds: tuple[str, ...], gt_key: str, tol_px: float) -> dict[str, Any]:
    """A ground-truth opening is found when a detected opening of one of `kinds` has its centre within tol_px plus half
    the opening's width; kind_recall counts those found as kinds[0] (a door found as a passage is found, not exact)."""
    w, h = gt["width"], gt["height"]
    by_id = {x["id"]: x for x in walls}
    det = [(o, c) for o, c in ((o, _centre(o, by_id, w, h)) for o in openings if o["kind"] in kinds) if c is not None]
    found = exact = 0
    used: set[int] = set()
    for g in gt[gt_key]:
        c = np.array(g["centre"], float)
        best = None
        for k, (_o, dc) in enumerate(det):
            if k in used:
                continue
            dist = float(np.hypot(*(dc - c)))
            if dist <= tol_px + g["width_px"] / 2 and (best is None or dist < best[0]):
                best = (dist, k)
        if best is not None:
            used.add(best[1])
            found += 1
            exact += det[best[1]][0]["kind"] == kinds[0]
    n = len(gt[gt_key])
    return {"recall": found / n if n else 1.0, "kind_recall": exact / n if n else 1.0, "found": found, "total": n, "false": len(det) - len(used)}


def evaluate(gt: dict[str, Any], result: dict[str, Any], tol_px: float = 10.0) -> dict[str, Any]:
    walls = result["walls"]
    return {
        "walls": wall_scores(gt, walls, tol_px),
        "doors": opening_scores(gt, walls, result["openings"], ("door", "passage"), "doors", tol_px),
        "windows": opening_scores(gt, walls, result["openings"], ("window",), "windows", tol_px),
    }


def run_set(detect_fn: Callable[..., dict[str, Any]], folder: Path = FIXTURES, calibrated: bool = True) -> list[dict[str, Any]]:
    """Every plan of a folder through `detect_fn(png_bytes, scale_m_per_px=...)`, scored; the scale is the ground
    truth's when calibrated, else None (the detector then estimates it and offers a door-width hint)."""
    rows = []
    for name, gt, png in load_set(folder):
        t0 = time.perf_counter()
        result = detect_fn(png, scale_m_per_px=gt["scale_m_per_px"] if calibrated else None)
        ms = int((time.perf_counter() - t0) * 1000)
        rows.append({"name": name, "ms": ms, **evaluate(gt, result, TOLERANCE_PX.get(name, 10.0)), "hint": result.get("calibration_hint"), "counts": {"walls": len(result["walls"]), "openings": len(result["openings"])}})
    return rows


def summary_line(rows: list[dict[str, Any]]) -> str:
    """One evidence line: min wall recall / precision, door and window recall over the set, the slowest plan."""
    if not rows:
        return "no plans"
    doors = sum(r["doors"]["found"] for r in rows), sum(r["doors"]["total"] for r in rows)
    wins = sum(r["windows"]["found"] for r in rows), sum(r["windows"]["total"] for r in rows)
    return (f"{len(rows)} plans: walls recall >= {min(r['walls']['recall'] for r in rows):.3f}, precision >= {min(r['walls']['precision'] for r in rows):.3f}; "
            f"doors {doors[0]}/{doors[1]}; windows {wins[0]}/{wins[1]}; slowest {max(r['ms'] for r in rows)} ms")
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_fixtures.py -p no:cacheprovider`
Expected: `3 passed`.

- [ ] **Step 6: Commit**

```bash
git add smplwise_vms/backend/tests/fixtures/plan_detect smplwise_vms/backend/tests/plan_detect_metrics.py smplwise_vms/backend/tests/test_plan_detect_fixtures.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
test(plan-studio): synthetic test-plan set with ground truth and the detection metrics harness (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 2: Raster primitives in numpy — chamfer distance transform, Zhang–Suen thinning, skeleton tracing

**Files:**
- Create: `smplwise_vms/backend/smplwise/services/plan_detect.py` (the module header and the primitives; Tasks 3–5 append)
- Test: `smplwise_vms/backend/tests/test_plan_detect_raster.py`

**Interfaces:**
- Consumes: numpy only.
- Produces (module `plan_detect`):
  - `chamfer_dt(mask: ndarray[bool]) -> ndarray[float32]` — the 3-4 chamfer distance (in pixels, divided by 3) from every set pixel to the nearest unset pixel, the picture border counting as background; 0 on unset pixels.
  - `thin(mask: ndarray[bool], max_iter=200) -> ndarray[bool]` — the Zhang–Suen skeleton (one pixel wide, 8-connected, same topology).
  - `neighbour_count(skel) -> ndarray[int16]` — 8-neighbour count on skeleton pixels (0 elsewhere).
  - `trace_branches(skel) -> list[list[tuple[int, int]]]` — every branch between nodes (end points, junctions) as `(x, y)` pixel chains; an isolated loop comes back closed (its first pixel repeated at the end).

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio detection primitives (T086, design 9.1): the chamfer distance transform equals a brute-force relaxation,
thinning turns a thick bar into one connected pixel-wide line and keeps a ring closed, and tracing splits a skeleton
at its junctions into branches with the right end points."""
from __future__ import annotations

import numpy as np

from smplwise.services import plan_detect as pd


def _brute_chamfer(mask: np.ndarray) -> np.ndarray:
    pad = np.pad(mask, 1)
    h, w = pad.shape
    ref = np.where(pad, 10**8, 0)
    changed = True
    while changed:
        changed = False
        for y in range(h):
            for x in range(w):
                if not pad[y, x]:
                    continue
                best = ref[y, x]
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if (dy or dx) and 0 <= y + dy < h and 0 <= x + dx < w:
                            best = min(best, ref[y + dy, x + dx] + (4 if dy and dx else 3))
                if best < ref[y, x]:
                    ref[y, x] = best
                    changed = True
    return ref[1:-1, 1:-1] / 3.0


def test_chamfer_matches_brute_force_and_treats_the_border_as_background():
    rng = np.random.RandomState(3)
    mask = rng.rand(24, 31) < 0.7
    d = pd.chamfer_dt(mask)
    assert d.dtype == np.float32 and d.shape == mask.shape
    assert np.allclose(d, _brute_chamfer(mask)) and float(d[~mask].max()) == 0.0
    bar = np.zeros((9, 40), dtype=bool)
    bar[:, 5:35] = True  # touches the top and bottom edges: the centre row is 5 rows from the nearest border
    assert float(pd.chamfer_dt(bar)[4, 20]) == 5.0 and float(pd.chamfer_dt(bar)[0, 20]) == 1.0


def test_thinning_gives_a_one_pixel_connected_skeleton():
    bar = np.zeros((40, 120), dtype=bool)
    bar[14:27, 10:110] = True
    sk = pd.thin(bar)
    nb = pd.neighbour_count(sk)
    assert int(sk.sum()) >= 85 and int(nb.max()) == 2 and len(set(np.nonzero(sk)[0].tolist())) == 1, "a horizontal bar thins to one row"
    assert int(nb[sk].min()) == 1 and int((nb == 1).sum()) == 2, "exactly two end points"
    ring = np.zeros((60, 60), dtype=bool)
    ring[10:50, 10:50] = True
    ring[18:42, 18:42] = False
    sk = pd.thin(ring)
    assert int(sk.sum()) > 100 and int(pd.neighbour_count(sk)[sk].min()) >= 2, "a ring stays closed (no end points)"
    assert not pd.thin(np.zeros((5, 5), dtype=bool)).any()


def test_tracing_splits_at_junctions_and_keeps_loops():
    t = np.zeros((60, 60), dtype=bool)
    t[10:50, 28:32] = True
    t[28:32, 10:50] = True
    branches = pd.trace_branches(pd.thin(t))
    long = [b for b in branches if len(b) >= 10]
    assert len(long) == 4, "a plus sign has four arms (the two-pixel stubs are the junction cluster)"
    ends = {b[-1] for b in long} | {b[0] for b in long}
    assert any(abs(x - 29) <= 2 and y <= 12 for x, y in ends) and any(abs(y - 29) <= 2 and x >= 47 for x, y in ends)
    # a thinned ring has junction pixels at its corners: its branches together still cover the whole skeleton
    ring = np.zeros((40, 40), dtype=bool)
    ring[5:35, 5:35] = True
    ring[12:28, 12:28] = False
    sk = pd.thin(ring)
    pixels = {p for b in pd.trace_branches(sk) for p in b}
    assert len(pixels) >= 0.9 * int(sk.sum())
    # a loop without any node (a diamond: every pixel has exactly two 8-neighbours) is one closed branch
    dia = np.zeros((16, 16), dtype=bool)
    for k in range(6):
        for x, y in ((7 + k, 2 + k), (7 - k, 2 + k), (7 + k, 12 - k), (7 - k, 12 - k)):
            dia[y, x] = True
    loops = pd.trace_branches(dia)
    assert len(loops) == 1 and loops[0][0] == loops[0][-1] and len(loops[0]) == int(dia.sum()) + 1
    assert pd.trace_branches(np.zeros((8, 8), dtype=bool)) == []
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_raster.py -p no:cacheprovider`
Expected: FAIL — `ImportError: cannot import name 'plan_detect'`.

- [ ] **Step 3: Write the module header and the primitives**

`smplwise_vms/backend/smplwise/services/plan_detect.py`:

```python
"""Local detection of walls, doors and windows from a plan picture (Plan Studio phase 3, T086, design section 9).

A pure function over a PNG, numpy and Pillow only (no OpenCV, no scipy, no model, no database): Otsu -> the same
morphology plan_stylize uses for its wall mask -> Zhang-Suen thinning -> skeleton tracing -> Douglas-Peucker ->
axis snapping at <= 4 degrees -> collinear merging -> thickness from a chamfer distance transform -> gaps between
collinear pieces classified by sampling the thin-ink mask (a door arc, mirrored arcs, window lines) -> windows from
the ink-thickness profile along each wall. The result is a set of document-v2 candidates (source "auto", a confidence
per item, ids "auto-<run>-w001" / "auto-<run>-o001") in the 0..1 space of the picture, with a calibration hint from
the door widths when the plan is not calibrated. Nothing here is stored or published: the router returns the
candidates and a person accepts them (routers/plan_geometry.py)."""
from __future__ import annotations

import io
import math
import time
from typing import Any

import numpy as np
from PIL import Image

from . import plan_stylize as ps
from .plan_zones import rdp

VERSION = "1.0"
ANALYSIS_PX = 1600  # the working resolution (design 9.1 / 9.6)
TILT_PX = 800  # the cheap first pass that measures the tilt of a scan
TILT_MIN_DEG = 0.15
DEFAULT_WALL_M = 0.2  # an uncalibrated plan: the median wall is taken as 0.2 m (phase 1's assumption, measured here)
DOOR_TYPICAL_M = 0.9  # the calibration hint (design 6.3)
AXIS_TOL_DEG = 4.0
ARC_INK_RATIO = 0.6
WINDOW_LINE_RATIO = 0.6
DOOR_RANGE_M = (0.6, 1.5)
DOUBLE_RANGE_M = (1.5, 2.4)
DOOR_RANGE_T = (1.5, 4.0)  # uncalibrated: a gap of 1.5 to 4 wall thicknesses may be a door too
WINDOW_RANGE_M = (0.5, 3.0)
MIN_WALL_M = 0.25
MIN_WALL_FRACTION = 0.005
PROFILE_STEP_M = 0.05
TARGETS = ("walls", "openings")


# ---------------------------------------------------------------- raster primitives (numpy only)

def chamfer_dt(mask: np.ndarray) -> np.ndarray:
    """Two-pass 3-4 chamfer distance transform (pixels) from every set pixel to the nearest unset pixel; the picture
    border counts as background. Each pass is one loop over rows: the in-row dependency (min over k <= x of
    d[k] + 3(x - k)) is a running minimum of d[k] - 3k plus 3x, so a row costs a few vectorised numpy calls."""
    m = np.pad(np.asarray(mask, dtype=bool), 1)
    h, w = m.shape
    d = np.where(m, 10**8, 0).astype(np.int64)
    x3 = 3 * np.arange(w, dtype=np.int64)

    def diag(c: np.ndarray, other: np.ndarray) -> np.ndarray:
        c = np.minimum(c, other + 3)
        c[1:] = np.minimum(c[1:], other[:-1] + 4)
        c[:-1] = np.minimum(c[:-1], other[1:] + 4)
        return c

    d[0] = np.minimum.accumulate(d[0] - x3) + x3
    for y in range(1, h):
        d[y] = np.minimum.accumulate(diag(d[y], d[y - 1]) - x3) + x3
    d[h - 1] = (np.minimum.accumulate(d[h - 1][::-1] - x3) + x3)[::-1]
    for y in range(h - 2, -1, -1):
        d[y] = (np.minimum.accumulate(diag(d[y], d[y + 1])[::-1] - x3) + x3)[::-1]
    return (d[1:-1, 1:-1] / 3.0).astype(np.float32)


def thin(mask: np.ndarray, max_iter: int = 200) -> np.ndarray:
    """Zhang-Suen thinning, both sub-iterations vectorised over the whole picture; stops when nothing changes. Works
    on the bounding box of the mask in 0/1 bytes: the neighbour count is a byte sum, a 0 -> 1 transition is `u < v`."""
    ys, xs = np.nonzero(mask)
    if not ys.size:
        return np.zeros(mask.shape, dtype=bool)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
    img = np.pad(np.asarray(mask[y0:y1, x0:x1], dtype=np.uint8), 1)
    for _ in range(max_iter):
        changed = False
        for step in (0, 1):
            p2, p3, p4, p5 = img[:-2, 1:-1], img[:-2, 2:], img[1:-1, 2:], img[2:, 2:]
            p6, p7, p8, p9 = img[2:, 1:-1], img[2:, :-2], img[1:-1, :-2], img[:-2, :-2]
            c = img[1:-1, 1:-1]
            nb = (p2, p3, p4, p5, p6, p7, p8, p9)
            b = p2 + p3
            for n in nb[2:]:
                b = b + n
            a = (p2 < p3).astype(np.uint8)
            for u, v in zip(nb[1:], nb[2:] + nb[:1]):
                a += u < v
            m = ((p2 & p4 & p6) == 0) & ((p4 & p6 & p8) == 0) if step == 0 else ((p2 & p4 & p8) == 0) & ((p2 & p6 & p8) == 0)
            kill = (c == 1) & (b >= 2) & (b <= 6) & (a == 1) & m
            if kill.any():
                changed = True
                c[kill] = 0
        if not changed:
            break
    out = np.zeros(mask.shape, dtype=bool)
    out[y0:y1, x0:x1] = img[1:-1, 1:-1].astype(bool)
    return out


_N8 = ((-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1))


def neighbour_count(skel: np.ndarray) -> np.ndarray:
    p = np.pad(skel.astype(np.int16), 1)
    n = np.zeros(skel.shape, dtype=np.int16)
    for dy, dx in _N8:
        n += p[1 + dy : 1 + dy + skel.shape[0], 1 + dx : 1 + dx + skel.shape[1]]
    return n * skel


def trace_branches(skel: np.ndarray) -> list[list[tuple[int, int]]]:
    """Every branch of the skeleton between nodes (end points and junctions) as a list of (x, y) pixels; a closed loop
    without a node comes back as one branch that starts and ends at its topmost-leftmost pixel."""
    h, w = skel.shape
    nb = neighbour_count(skel)
    node = skel & ((nb == 1) | (nb >= 3))
    visited = np.zeros_like(skel, dtype=bool)
    branches: list[list[tuple[int, int]]] = []

    def neighbours(y: int, x: int) -> list[tuple[int, int]]:
        out = []
        for dy, dx in _N8:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and skel[yy, xx]:
                out.append((yy, xx))
        return out

    def walk(y0: int, x0: int, y1: int, x1: int) -> list[tuple[int, int]]:
        path = [(x0, y0), (x1, y1)]
        visited[y1, x1] = True
        py, px, cy, cx = y0, x0, y1, x1
        while not node[cy, cx]:
            nxt = [(yy, xx) for yy, xx in neighbours(cy, cx) if (yy, xx) != (py, px) and (node[yy, xx] or not visited[yy, xx])]
            if not nxt:
                break
            nxt.sort(key=lambda q: abs(q[0] - cy) + abs(q[1] - cx))  # a 4-neighbour before a diagonal
            py, px, (cy, cx) = cy, cx, nxt[0]
            visited[cy, cx] = True
            path.append((cx, cy))
        return path

    ys, xs = np.nonzero(node)
    for y, x in zip(ys.tolist(), xs.tolist()):
        visited[y, x] = True
        for yy, xx in neighbours(y, x):
            if node[yy, xx]:
                if (yy, xx) > (y, x):
                    branches.append([(x, y), (xx, yy)])
                continue
            if not visited[yy, xx]:
                branches.append(walk(y, x, yy, xx))
    ys, xs = np.nonzero(skel & ~visited)
    for y, x in zip(ys.tolist(), xs.tolist()):
        if visited[y, x]:
            continue
        visited[y, x] = True
        nx = neighbours(y, x)
        if nx:
            path = walk(y, x, nx[0][0], nx[0][1])
            path.append((x, y))
            branches.append(path)
    return branches
```

(`io`, `time`, `Image`, `ps`, `rdp` and the constants are used from Task 3 on; leave them in place — `ruff` is not part of the test run, and Task 3 lands in the same branch.)

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_raster.py -p no:cacheprovider`
Expected: `3 passed`. (The brute-force chamfer on 24 × 31 takes under a second.)

- [ ] **Step 5: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/plan_detect.py smplwise_vms/backend/tests/test_plan_detect_raster.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): numpy raster primitives for detection - chamfer distance transform, Zhang-Suen thinning, skeleton tracing (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 3: Walls end to end — segments, snapping, merging, thickness, kind, the walls baseline

**Files:**
- Modify: `smplwise_vms/backend/smplwise/services/plan_detect.py` (append the segment layer, the analysis, the two-stage `detect`; `classify_gap` and `windows_by_profile` are stubs until Tasks 4–5)
- Test: `smplwise_vms/backend/tests/test_plan_detect_walls.py`

**Interfaces:**
- Consumes: `plan_stylize.otsu_threshold / opening / closing / dilate`, `plan_zones.rdp`, the primitives of Task 2, `plan_detect_metrics.run_set`.
- Produces (module `plan_detect`):
  - `Seg` (`a`, `b`: ndarray pixels; `samples`: thickness samples; `axis`: snapped; `raw`: direction before snapping; properties `thick`, `length`, `dir`; `project(p) -> (along, lateral)`).
  - `snap_axis(a, b, tol_deg=4.0) -> (a, b, snapped)`, `merge_collinear(segs, join_px) -> list[Seg]`, `line_groups(segs) -> list[list[int]]`, `estimate_tilt(segs, t_med) -> degrees`.
  - `classify_gap(...) -> dict | None` (stub: None), `walls_from_gaps(segs, s, calibrated, thin_mask, ink, want_openings) -> (walls, openings)`, `windows_by_profile(...) -> []` (stub).
  - `detect(png: bytes | ndarray, *, targets=("walls", "openings"), strength=0.6, scale_m_per_px=None, level_id="L0", run_id="0") -> dict` with keys `walls`, `openings`, `detector {name, version, params {strength, targets, analysis_px, threshold, tilt_deg}}`, `calibration_hint`, `pixels {id: {thickness_px | width_px}}` (version pixels), `scale {m_per_px, status: "measured" | "estimated_walls"}`, `stats {probe_segments, segments, ms}`.
  - Wall item: `{id: "auto-<run>-w001", level_id, polyline: [[x, y], [x, y]], thickness_m, height_m: None, base_z_m: 0, kind, confidence, source: "auto", locked: False, external_ids: {}}`.

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio wall detection (T086, design 9.1): snapping and merging of segments, the tilt estimate, and walls found
on the synthetic set with the baseline recall and precision - calibrated, and uncalibrated with the estimated scale."""
from __future__ import annotations

import io
import json

import numpy as np
from PIL import Image

import plan_detect_metrics as pm
from smplwise.services import plan_detect as pd


def _seg(a, b, thick=10.0):
    s = pd.Seg(np.array(a, float), np.array(b, float), [thick] * 5)
    return s


def test_snap_axis_within_four_degrees_only():
    a, b, snapped = pd.snap_axis(np.array([0.0, 0.0]), np.array([100.0, 3.0]))
    assert snapped and b[1] == a[1] and abs(np.hypot(*(b - a)) - np.hypot(100, 3)) < 1e-9, "rotated about the midpoint, length kept"
    a, b, snapped = pd.snap_axis(np.array([0.0, 0.0]), np.array([100.0, 12.0]))
    assert not snapped and b[1] == 12.0
    a, b, snapped = pd.snap_axis(np.array([5.0, 0.0]), np.array([4.0, 50.0]))
    assert snapped and a[0] == b[0]


def test_merge_collinear_joins_touching_pieces_and_keeps_gaps():
    segs = [_seg((0, 0), (100, 0)), _seg((104, 1), (200, 0)), _seg((260, 0), (300, 0)), _seg((0, 40), (100, 40))]
    out = pd.merge_collinear(segs, join_px=8)
    assert len(out) == 3
    longest = max(out, key=lambda s: s.length)
    assert longest.length == 200 and longest.a[0] == 0 and longest.b[0] == 200
    groups = pd.line_groups(out)
    assert sorted(len(g) for g in groups) == [1, 2], "the 60 px gap keeps two segments on one line, the other wall is its own line"


def test_tilt_from_unsnapped_directions():
    s1 = _seg((0, 0), (400, 0))
    s1.raw = pd._unit(np.array([0.0, 0.0]), np.array([400.0, -5.6]))  # about -0.8 degrees
    s2 = _seg((0, 0), (0, 300))
    s2.raw = pd._unit(np.array([0.0, 0.0]), np.array([4.2, 300.0]))  # the same tilt, seen on a vertical
    assert abs(pd.estimate_tilt([s1, s2], 10.0) + 0.8) < 0.05
    assert pd.estimate_tilt([], 10.0) == 0.0


def _first_result(name: str, calibrated: bool):
    for n, gt, png in pm.load_set():
        if n == name:
            return gt, pd.detect(png, targets=("walls",), scale_m_per_px=gt["scale_m_per_px"] if calibrated else None, run_id="t1")
    raise AssertionError(name)


def test_walls_on_the_apartment_have_the_document_shape_and_kinds():
    gt, r = _first_result("apartment", True)
    assert r["openings"] == [] and r["detector"]["name"] == "plan_detect" and r["detector"]["params"]["targets"] == ["walls"]
    assert 10 <= len(r["walls"]) <= 16, "walls only: the seven walls stay split at their seven openings"
    for w in r["walls"]:
        assert w["id"].startswith("auto-t1-w") and w["source"] == "auto" and w["level_id"] == "L0" and 0 < w["confidence"] <= 0.99
        assert len(w["polyline"]) == 2 and all(0 <= c <= 1 for p in w["polyline"] for c in p)
        assert w["kind"] in ("exterior", "interior", "partition") and 0.05 <= w["thickness_m"] <= 0.4
        assert r["pixels"][w["id"]]["thickness_px"] > 5
    kinds = {w["kind"] for w in r["walls"]}
    assert "exterior" in kinds and "interior" in kinds
    outer = [w for w in r["walls"] if w["kind"] == "exterior"]
    assert all(abs(w["thickness_m"] - 0.16) < 0.04 for w in outer), [w["thickness_m"] for w in outer]
    assert r["scale"] == {"m_per_px": 0.01, "status": "measured"} and r["calibration_hint"] is None
    assert pm.wall_scores(gt, r["walls"], 10.0)["recall"] >= 0.95


def test_walls_baseline_calibrated_and_uncalibrated():
    rows = pm.run_set(lambda png, **kw: pd.detect(png, targets=("walls",), **kw))
    for row in rows:
        assert row["walls"]["recall"] >= 0.90, (row["name"], row["walls"])
        assert row["walls"]["precision"] >= 0.80, (row["name"], row["walls"])
    rows = pm.run_set(lambda png, **kw: pd.detect(png, targets=("walls",), **kw), calibrated=False)
    for row in rows:
        assert row["walls"]["recall"] >= 0.90 and row["walls"]["precision"] >= 0.80, (row["name"], row["walls"])


def test_tilted_scan_comes_back_on_the_scan_and_a_blank_picture_gives_nothing():
    gt, r = _first_result("noisy", True)
    assert abs(r["detector"]["params"]["tilt_deg"] + 0.8) < 0.3, r["detector"]["params"]
    assert pm.wall_scores(gt, r["walls"], 12.0)["recall"] >= 0.95
    buf = io.BytesIO()
    Image.new("L", (400, 300), 255).save(buf, "PNG")
    empty = pd.detect(buf.getvalue())
    assert empty["walls"] == [] and empty["openings"] == [] and empty["calibration_hint"] is None
    arr = np.asarray(Image.open(io.BytesIO(pm.load_set()[0][2])).convert("L"))
    assert len(pd.detect(arr, targets=("walls",), scale_m_per_px=0.01)["walls"]) == len(_first_result("apartment", True)[1]["walls"]), "an ndarray input is the same as the PNG"
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_walls.py -p no:cacheprovider`
Expected: FAIL — `module 'smplwise.services.plan_detect' has no attribute 'Seg'`.

- [ ] **Step 3: Append the segment layer and the detector**

Append to `services/plan_detect.py`:

```python
# ---------------------------------------------------------------- segments (analysis pixel space)

def _unit(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    v = b - a
    n = float(np.hypot(v[0], v[1]))
    return v / n if n > 1e-9 else np.array([1.0, 0.0])


def snap_axis(a: np.ndarray, b: np.ndarray, tol_deg: float = AXIS_TOL_DEG) -> tuple[np.ndarray, np.ndarray, bool]:
    """Rotate a segment about its midpoint onto the nearest axis when it is within tol_deg of one (length kept)."""
    v = b - a
    length = float(np.hypot(v[0], v[1]))
    if length < 1e-9:
        return a, b, False
    ang = math.degrees(math.atan2(v[1], v[0]))
    mid = (a + b) / 2
    for axis, d in ((0.0, (1.0, 0.0)), (180.0, (-1.0, 0.0)), (-180.0, (-1.0, 0.0)), (90.0, (0.0, 1.0)), (-90.0, (0.0, -1.0))):
        if abs(ang - axis) <= tol_deg:
            dv = np.array(d)
            return mid - dv * length / 2, mid + dv * length / 2, True
    return a, b, False


class Seg:
    __slots__ = ("a", "b", "samples", "axis", "raw")

    def __init__(self, a: np.ndarray, b: np.ndarray, samples: list[float], axis: bool = False, raw: np.ndarray | None = None) -> None:
        self.a, self.b, self.samples, self.axis = a, b, samples, axis
        self.raw = raw if raw is not None else _unit(a, b)  # the direction before any axis snapping (tilt estimate)

    @property
    def thick(self) -> float:
        return float(np.median(self.samples)) if self.samples else 2.0

    @property
    def length(self) -> float:
        return float(np.hypot(*(self.b - self.a)))

    @property
    def dir(self) -> np.ndarray:
        return _unit(self.a, self.b)

    def project(self, p: np.ndarray) -> tuple[float, float]:
        """(along, lateral): along from a in pixels, lateral signed distance from the line."""
        d = self.dir
        v = p - self.a
        return float(np.dot(v, d)), float(d[0] * v[1] - d[1] * v[0])


def _angle_between(u: np.ndarray, v: np.ndarray) -> float:
    return math.degrees(math.acos(max(-1.0, min(1.0, abs(float(np.dot(u, v)))))))


def _collinear(s: Seg, t: Seg, angle_tol: float = AXIS_TOL_DEG) -> tuple[float, float] | None:
    """The interval (lo, hi) of t along s's line when t lies on it (angle and lateral offset within tolerance)."""
    if _angle_between(s.dir, t.dir) > angle_tol:
        return None
    # the lateral tolerance grows with the distance along the line: two pieces of one slightly rotated wall (a scan
    # off by up to the axis tolerance) sit on lines that diverge by tan(4 deg) per pixel of separation
    base_tol = 0.75 * max(s.thick, t.thick, 2.0)
    slope = math.tan(math.radians(angle_tol))
    a0, la = s.project(t.a)
    a1, lb = s.project(t.b)
    if abs(la) > base_tol + slope * abs(a0) or abs(lb) > base_tol + slope * abs(a1):
        return None
    return min(a0, a1), max(a0, a1)


def merge_collinear(segs: list[Seg], join_px: float) -> list[Seg]:
    """Join segments on one line whose intervals touch or overlap (gap <= join_px) into one segment."""
    segs = [s for s in segs if s.length > 0]
    changed = True
    while changed:
        changed = False
        out: list[Seg] = []
        used = [False] * len(segs)
        for i, s in enumerate(segs):
            if used[i]:
                continue
            cur = s
            for j in range(i + 1, len(segs)):
                if used[j]:
                    continue
                iv = _collinear(cur, segs[j])
                if iv is None or iv[0] > cur.length + join_px or iv[1] < -join_px:
                    continue
                d = cur.dir
                cur = Seg(cur.a + d * min(0.0, iv[0]), cur.a + d * max(cur.length, iv[1]), cur.samples + segs[j].samples, cur.axis and segs[j].axis, cur.raw)
                used[j] = True
                changed = True
            out.append(cur)
            used[i] = True
        segs = out
    return segs


def line_groups(segs: list[Seg]) -> list[list[int]]:
    """Indices of the segments that share a line (union-find over the pairwise collinear relation)."""
    parent = list(range(len(segs)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            if _collinear(segs[i], segs[j]) is not None:
                parent[find(i)] = find(j)
    groups: dict[int, list[int]] = {}
    for i in range(len(segs)):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values())


def estimate_tilt(segs: list[Seg], t_med: float) -> float:
    """The scan's tilt in degrees (y-down atan2 convention): the length-weighted mean of every long segment's angle to
    its nearest axis, over the segments within the axis tolerance. 0 when nothing is long enough."""
    num = den = 0.0
    for g in segs:
        if g.length < 4 * t_med:
            continue
        d = g.raw
        r = ((math.degrees(math.atan2(d[1], d[0])) + 45.0) % 90.0) - 45.0
        if abs(r) <= AXIS_TOL_DEG:
            num += r * g.length
            den += g.length
    return num / den if den else 0.0


# ---------------------------------------------------------------- the picture -> masks

def _analysis(gray: Image.Image, strength: float, analysis_px: int = ANALYSIS_PX) -> dict[str, Any]:
    """The masks at the working resolution: `walls` (the closed / opened ink, as plan_stylize builds it), `ink` (a
    softer threshold that keeps the light thin lines a scan gives door arcs and window glass), `ink_d` (ink dilated by
    one pixel, for line sampling), `thin` (ink away from the walls, dilated by two, for the arc test)."""
    width, height = gray.size
    scale = min(1.0, analysis_px / max(width, height))
    aw, ah = max(8, int(round(width * scale))), max(8, int(round(height * scale)))
    g = np.asarray(gray.resize((aw, ah), Image.LANCZOS), dtype=np.uint8)
    if g.mean() < 100:
        g = 255 - g
    thr = int(min(200, max(90, ps.otsu_threshold(g))))
    ink = g < thr
    soft = g < min(235, thr + 50)
    unit = max(1, int(round(aw / 800)))
    close_r = (1 + int(3 * strength + 0.5)) * unit  # 0.3 -> 2, 0.6 -> 3, 1.0 -> 4 units, like plan_stylize's light / medium / strong
    open_r = (1 if strength < 0.8 else 2) * unit
    # a one-pixel opening first: isolated scan speckles must not be closed into blobs (the raw ink keeps every line)
    walls = ps.opening(ps.closing(ps.opening(ink, 1), close_r), open_r)
    thin_ink = soft & ~ps.dilate(walls, 1)
    return {"aw": aw, "ah": ah, "factor": aw / width, "ink": soft, "ink_d": ps.dilate(soft, 1), "walls": walls, "thin": ps.dilate(thin_ink, 2), "threshold": thr}


def _segments(dt: np.ndarray, skel: np.ndarray, t_med: float, min_len: float) -> list[Seg]:
    """Skeleton branches -> straight segments: spurs shorter than 1.5 thicknesses go, Douglas-Peucker splits each branch
    at its corners, near-axis segments snap to the axis, collinear pieces join, short leftovers go."""
    spur = max(1.5 * t_med, 6.0)
    segs: list[Seg] = []
    for br in trace_branches(skel):
        pts = np.array(br, dtype=np.float64)
        if len(br) < 2 or float(np.sum(np.hypot(np.diff(pts[:, 0]), np.diff(pts[:, 1])))) < spur:
            continue
        samples = (2.0 * dt[pts[:, 1].astype(int), pts[:, 0].astype(int)]).tolist()
        poly = rdp([(float(x), float(y)) for x, y in br], max(1.5, 0.35 * t_med))
        for p, q in zip(poly, poly[1:]):
            a, b, on_axis = snap_axis(np.array(p), np.array(q))
            segs.append(Seg(a, b, samples, on_axis, _unit(np.array(p), np.array(q))))
    segs = merge_collinear(segs, join_px=max(1.5 * t_med, 6.0))
    return [g for g in segs if g.length >= min_len]


def _stage(gray: Image.Image, strength: float, analysis_px: int, scale_m_per_px: float | None) -> dict[str, Any]:
    an = _analysis(gray, strength, analysis_px)
    aw, ah, f = an["aw"], an["ah"], an["factor"]
    mask = an["walls"]
    dt = chamfer_dt(mask)
    skel = thin(mask)
    t_med = float(np.median(2.0 * dt[skel])) if skel.any() else 4.0
    calibrated = scale_m_per_px is not None and scale_m_per_px > 0
    # metres per analysis pixel: the calibration, else the walls themselves - the median wall is taken as 0.2 m (the
    # same assumption as phase 1's estimate, measured on this drawing instead of assumed from the width)
    s = (scale_m_per_px / f) if calibrated else DEFAULT_WALL_M / t_med
    min_len = MIN_WALL_M / s if calibrated else max(MIN_WALL_FRACTION * aw, MIN_WALL_M / s)
    segs = _segments(dt, skel, t_med, min_len)
    return {"an": an, "dt": dt, "skel": skel, "t_med": t_med, "s": s, "calibrated": calibrated, "segs": segs, "aw": aw, "ah": ah, "f": f}


# ---------------------------------------------------------------- openings (Tasks 4 and 5 replace the two stubs)

def classify_gap(g0: np.ndarray, g1: np.ndarray, d: np.ndarray, t_ref: float, s: float, calibrated: bool, thin_mask: np.ndarray, ink: np.ndarray) -> dict[str, Any] | None:
    """Task 4: what the gap between two collinear wall segments is. Until then: nothing."""
    return None


def walls_from_gaps(segs: list[Seg], s: float, calibrated: bool, thin_mask: np.ndarray, ink: np.ndarray, want_openings: bool) -> tuple[list[Seg], list[dict[str, Any]]]:
    """Walk every line of collinear segments in order; a recognised gap joins its two neighbours into one wall with the
    opening at the gap, an unrecognised gap keeps them apart. The skeleton stops half a thickness short of a wall end
    (thinning retracts the ends), so a gap is measured between the ends grown by t / 2 - the same growth the
    primitives apply when they draw a free wall end."""
    walls: list[Seg] = []
    openings: list[dict[str, Any]] = []
    for group in line_groups(segs):
        ref = max(group, key=lambda i: segs[i].length)
        base = segs[ref]
        items = []
        for i in group:
            a0, _ = base.project(segs[i].a)
            a1, _ = base.project(segs[i].b)
            items.append((min(a0, a1), max(a0, a1), i))
        items.sort()
        d = base.dir
        cur_lo, cur_hi, cur_samples, cur_axis = items[0][0], items[0][1], list(segs[items[0][2]].samples), segs[items[0][2]].axis
        pending: list[dict[str, Any]] = []
        for lo, hi, i in items[1:]:
            t_cur = max(float(np.median(cur_samples)), 2.0)
            t_ref = max(t_cur, segs[i].thick, 2.0)
            g0 = base.a + d * (cur_hi + t_cur / 2)
            g1 = base.a + d * (lo - segs[i].thick / 2)
            found = classify_gap(g0, g1, d, t_ref, s, calibrated, thin_mask, ink) if (want_openings and lo - segs[i].thick / 2 > cur_hi + t_cur / 2) else None
            if found is None:
                walls.append(Seg(base.a + d * cur_lo, base.a + d * cur_hi, cur_samples, cur_axis))
                for o in pending:
                    openings.append(dict(o, wall_seg=len(walls) - 1, t=(o["along"] - cur_lo) / max(cur_hi - cur_lo, 1e-9)))
                pending = []
                cur_lo, cur_hi, cur_samples, cur_axis = lo, hi, list(segs[i].samples), segs[i].axis
                continue
            pending.append(dict(found, along=(cur_hi + lo) / 2))
            cur_hi = max(cur_hi, hi)
            cur_samples += segs[i].samples
            cur_axis = cur_axis and segs[i].axis
        walls.append(Seg(base.a + d * cur_lo, base.a + d * cur_hi, cur_samples, cur_axis))
        for o in pending:
            openings.append(dict(o, wall_seg=len(walls) - 1, t=(o["along"] - cur_lo) / max(cur_hi - cur_lo, 1e-9)))
    return walls, openings


def windows_by_profile(walls: list[Seg], openings: list[dict[str, Any]], dt: np.ndarray, ink: np.ndarray, s: float) -> list[dict[str, Any]]:
    """Task 5: windows the closing hid inside a wall band. Until then: none."""
    return []


# ---------------------------------------------------------------- the detector

def detect(png: bytes | np.ndarray, *, targets: tuple[str, ...] | list[str] = TARGETS, strength: float = 0.6, scale_m_per_px: float | None = None, level_id: str = "L0", run_id: str = "0") -> dict[str, Any]:
    """Candidates (document-v2 walls and openings, source "auto") for a plan picture. `scale_m_per_px` is the version's
    calibration (None when there is none); `targets` always includes "walls" ("openings" needs them)."""
    t0 = time.perf_counter()
    if isinstance(png, (bytes, bytearray)):
        with Image.open(io.BytesIO(png)) as im:
            im.load()
            gray = im.convert("L")
    else:
        gray = Image.fromarray(np.asarray(png)).convert("L")
    # stage 1 (800 px): the scan's tilt; a tilted scan is straightened before the real pass, so snapping and merging see
    # axis-parallel walls, and every result is turned back onto the scan at the end
    probe = _stage(gray, strength, TILT_PX, scale_m_per_px)
    tilt = estimate_tilt(probe["segs"], probe["t_med"])
    if abs(tilt) < TILT_MIN_DEG:
        tilt = 0.0
    src = gray.rotate(tilt, resample=Image.BICUBIC, fillcolor=255) if tilt else gray
    st = _stage(src, strength, ANALYSIS_PX, scale_m_per_px)
    an, dt, s, calibrated, segs, aw, ah, f = st["an"], st["dt"], st["s"], st["calibrated"], st["segs"], st["aw"], st["ah"], st["f"]
    want_openings = "openings" in targets
    walls, openings = walls_from_gaps(segs, s, calibrated, an["thin"], an["ink_d"], want_openings)
    if want_openings:
        openings += windows_by_profile(walls, openings, chamfer_dt(an["ink"]), an["ink_d"], s)
    mask = an["walls"]
    ys, xs = np.nonzero(mask)
    frame = (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())) if xs.size else (0.0, 0.0, float(aw), float(ah))
    t_wall_med = float(np.median([g.thick for g in walls])) if walls else st["t_med"]

    def on_frame(g: Seg) -> bool:
        """Both ends within 1.5 thicknesses of the same edge of the wall mask's bounding box: the wall runs along the
        plan's frame (a partition that spans the plan touches two different edges and is not exterior)."""
        tol = 1.5 * g.thick
        for axis, edge in ((0, frame[0]), (0, frame[2]), (1, frame[1]), (1, frame[3])):
            if abs(g.a[axis] - edge) <= tol and abs(g.b[axis] - edge) <= tol:
                return True
        return False

    def kind_of(g: Seg) -> str:
        """Design 9.1 step 4: exterior when at least 1.6 x the median thickness or lying on the plan's frame; partition
        under 0.6 x; else interior. Known limit: the inner corner of an L-shaped outline is not on the frame and reads
        interior unless it is thicker than the rest - the kind is a suggestion the editor changes in the panel."""
        if g.thick >= 1.6 * t_wall_med or on_frame(g):
            return "exterior"
        return "partition" if g.thick < 0.6 * t_wall_med else "interior"

    def confidence(g: Seg) -> float:
        """Design 9.1 step 5 (ruling 4): length (2 m and longer score full), thickness consistency (the interquartile
        spread of the samples over the median) and straightness (on an axis, or not)."""
        arr = np.array(g.samples) if g.samples else np.array([g.thick])
        q1, q3 = np.percentile(arr, 25), np.percentile(arr, 75)
        consistency = 1.0 - min(1.0, (q3 - q1) / max(g.thick, 1e-6))
        return round(min(0.99, max(0.05, 0.4 * min(1.0, g.length * s / 2.0) + 0.35 * consistency + 0.25 * (1.0 if g.axis else 0.85))), 3)

    cx, cy = aw / 2.0, ah / 2.0
    cos_t, sin_t = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))

    def back(p: np.ndarray) -> list[float]:
        """A straightened-frame point back onto the scan (the inverse of the rotation above), normalised 0..1."""
        x, y = p[0] - cx, p[1] - cy
        xo, yo = cx + x * cos_t - y * sin_t, cy + x * sin_t + y * cos_t
        return [round(min(1.0, max(0.0, xo / aw)), 5), round(min(1.0, max(0.0, yo / ah)), 5)]

    out_walls = [{
        "id": f"auto-{run_id}-w{i + 1:03d}", "level_id": level_id, "polyline": [back(g.a), back(g.b)],
        "thickness_m": round(max(0.02, g.thick * s), 3), "height_m": None, "base_z_m": 0, "kind": kind_of(g), "confidence": confidence(g),
        "source": "auto", "locked": False, "external_ids": {},
    } for i, g in enumerate(walls)]
    pixels = {w["id"]: {"thickness_px": round(walls[i].thick / f, 2)} for i, w in enumerate(out_walls)}
    out_openings = []
    door_gaps: list[float] = []
    for k, o in enumerate(openings):
        oid = f"auto-{run_id}-o{k + 1:03d}"
        out_openings.append({
            "id": oid, "wall_id": out_walls[o["wall_seg"]]["id"], "t": round(min(1.0, max(0.0, o["t"])), 5), "kind": o["kind"], "width_m": round(o["width_px"] * s, 3),
            "height_m": 1.2 if o["kind"] == "window" else 2.1, "sill_m": 0.9 if o["kind"] == "window" else 0, "swing": o["swing"], "hinge": o["hinge"],
            "anchor_ref": None, "confidence": o["confidence"], "source": "auto", "external_ids": {},
        })
        pixels[oid] = {"width_px": round(o["width_px"] / f, 2)}
        if o["kind"] == "door" and o["swing"] != "double":
            door_gaps.append(o["width_px"] / f)
    hint = None
    if not calibrated and door_gaps:  # design 6.3: the median single door is DOOR_TYPICAL_M
        hint = {"scale_m_per_px": round(DOOR_TYPICAL_M / float(np.median(door_gaps)), 6), "status": "estimated", "method": "door_width", "reason": "לפי רוחב דלת אופייני", "doors": len(door_gaps)}
    return {
        "walls": out_walls if "walls" in targets else [],
        "openings": out_openings if want_openings else [],
        "detector": {"name": "plan_detect", "version": VERSION, "params": {"strength": strength, "targets": list(targets), "analysis_px": [aw, ah], "threshold": an["threshold"], "tilt_deg": round(tilt, 2)}},
        "calibration_hint": hint,
        "pixels": pixels,
        "scale": {"m_per_px": round(s * f, 6), "status": "measured" if calibrated else "estimated_walls"},
        "stats": {"probe_segments": len(probe["segs"]), "segments": len(segs), "ms": int((time.perf_counter() - t0) * 1000)},
    }
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_walls.py tests/test_plan_detect_raster.py -p no:cacheprovider`
Expected: `9 passed` (the two baseline loops run the six plans twice; about a minute).

- [ ] **Step 5: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/plan_detect.py smplwise_vms/backend/tests/test_plan_detect_walls.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): wall detection - skeleton segments, axis snapping, collinear merging, thickness and kind, tilt straightening (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 4: Doors — gaps between collinear walls, the arc test, hinge and swing, passages, the calibration hint

**Files:**
- Modify: `smplwise_vms/backend/smplwise/services/plan_detect.py` (replace the `classify_gap` stub; add `_ratio`, `_arc`, `_arc_ratio`, `_lines_along`)
- Test: `smplwise_vms/backend/tests/test_plan_detect_openings.py`

**Interfaces:**
- Consumes: `walls_from_gaps` (Task 3) calls `classify_gap(g0, g1, d, t_ref, s, calibrated, thin_mask, ink)`.
- Produces: `classify_gap -> {"kind": "door" | "window" | "passage", "swing", "hinge", "confidence", "width_px"} | None`; opening items in `detect()` as `{id: "auto-<run>-o001", wall_id, t, kind, width_m, height_m (2.1 door / passage, 1.2 window), sill_m (0 / 0.9), swing, hinge, anchor_ref: None, confidence, source: "auto", external_ids: {}}`; `calibration_hint` when uncalibrated and single doors were found.
- Conventions (the same as `frontend/src/map/geometry.ts door()` and the backend renderer): for a wall running a → b with unit direction d, `nl = (d.y, -d.x)` is swing `left`, `nr = (-d.y, d.x)` is swing `right`; hinge `start` is the gap end nearer a; the leaf tip is `hinge + n × width`.

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio opening detection (T086, design 9.2 / 9.3 / 6.3): a drawn door arc gives a door whose hinge and swing
reproduce the drawing (the leaf tip lands on ink whichever way the wall was traced), a plain gap is a passage, the
double door of the hall is found as one opening, doors reach the baseline on the synthetic set, and an uncalibrated
plan gets a door-width calibration hint marked estimated."""
from __future__ import annotations

import io
import pathlib
import sys

import numpy as np
from PIL import Image

import plan_detect_metrics as pm
from smplwise.services import plan_detect as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "fixtures" / "plan_detect"))
import gen_synthetic as gen  # noqa: E402


def _room(outer: int = 14, inner: int = 10) -> tuple[gen.Plan, int]:
    p = gen.Plan("t", 0.01, 800, 500)
    for a, b in (((60, 60), (740, 60)), ((740, 60), (740, 440)), ((740, 440), (60, 440)), ((60, 440), (60, 60))):
        p.wall(a, b, outer, "exterior")
    return p, p.wall((400, 60), (400, 440), inner)


def _png(p: gen.Plan) -> bytes:
    buf = io.BytesIO()
    p.im.save(buf, "PNG")
    return buf.getvalue()


def _tips_on_ink(im: Image.Image, r: dict) -> list[bool]:
    """For every single door: the leaf tip computed from the candidate (hinge end + normal x width, the door() rule of
    geometry.ts) lies on drawn ink within 3 px."""
    arr = np.asarray(im.convert("L")) < 128
    w_px, h_px = im.size
    by = {w["id"]: w for w in r["walls"]}
    out = []
    for o in r["openings"]:
        if o["kind"] != "door" or o["swing"] == "double":
            continue
        wall = by[o["wall_id"]]
        a = np.array(wall["polyline"][0]) * [w_px, h_px]
        b = np.array(wall["polyline"][1]) * [w_px, h_px]
        d = (b - a) / np.linalg.norm(b - a)
        c = a + (b - a) * o["t"]
        width = r["pixels"][o["id"]]["width_px"]
        hinge = c - d * width / 2 if o["hinge"] == "start" else c + d * width / 2
        n = np.array([d[1], -d[0]]) if o["swing"] == "left" else np.array([-d[1], d[0]])
        tip = hinge + n * width
        x, y = int(round(tip[0])), int(round(tip[1]))
        out.append(bool(arr[max(0, y - 3):y + 4, max(0, x - 3):x + 4].any()))
    return out


def test_a_drawn_door_is_a_door_with_the_drawings_hinge_and_swing():
    for hinge in ("start", "end"):
        for swing in ("left", "right"):
            p, wall = _room()
            p.door(wall, (400, 250), 90, hinge, swing)
            r = pd.detect(_png(p), scale_m_per_px=0.01, run_id="x")
            doors = [o for o in r["openings"] if o["kind"] == "door"]
            assert len(doors) == 1 and not [o for o in r["openings"] if o["kind"] == "passage"], (hinge, swing, r["openings"])
            o = doors[0]
            assert abs(o["width_m"] - 0.9) < 0.08 and o["confidence"] >= 0.55 and o["height_m"] == 2.1 and o["sill_m"] == 0
            assert o["id"].startswith("auto-x-o") and o["source"] == "auto" and o["wall_id"] in {w["id"] for w in r["walls"]}
            assert _tips_on_ink(p.im, r) == [True], (hinge, swing)
            assert 4 <= len(r["walls"]) <= 6, "the partition is one wall spanning its door"


def test_a_plain_gap_is_a_passage_and_the_hint_needs_a_door():
    p, wall = _room()
    p._gap(wall, (400, 250), 100)
    r = pd.detect(_png(p), scale_m_per_px=0.01, run_id="x")
    assert [(o["kind"], o["confidence"]) for o in r["openings"]] == [("passage", 0.45)] and abs(r["openings"][0]["width_m"] - 1.0) < 0.08
    r0 = pd.detect(_png(p), run_id="x")
    assert r0["calibration_hint"] is None and r0["scale"]["status"] == "estimated_walls" and 0.008 <= r0["scale"]["m_per_px"] <= 0.02
    assert [o["kind"] for o in r0["openings"]] == ["passage"]


def test_doors_baseline_and_the_double_door():
    rows = pm.run_set(pd.detect)
    for row in rows:
        assert row["doors"]["recall"] >= 0.80 and row["doors"]["kind_recall"] >= 0.80, (row["name"], row["doors"])
        assert row["doors"]["false"] <= 1, (row["name"], row["doors"])
    hall = next(r for n, gt, png in pm.load_set() if n == "hall" for r in [pd.detect(png, scale_m_per_px=gt["scale_m_per_px"])])
    doubles = [o for o in hall["openings"] if o["swing"] == "double"]
    assert len(doubles) == 1 and abs(doubles[0]["width_m"] - 1.92) < 0.12 and doubles[0]["kind"] == "door"
    singles = [o for o in hall["openings"] if o["kind"] == "door" and o["swing"] != "double"]
    assert len(singles) == 2 and all(abs(o["width_m"] - 0.96) < 0.1 for o in singles)


def test_calibration_hint_from_the_door_widths():
    for name, gt, png in pm.load_set():
        r = pd.detect(png, run_id="h")
        hint = r["calibration_hint"]
        assert hint is not None and hint["status"] == "estimated" and hint["method"] == "door_width" and hint["reason"] == "לפי רוחב דלת אופייני", name
        # the hint takes the median single door as 0.9 m: compare with the scale that makes the drawn doors 0.9 m
        drawn = float(np.median([d["width_px"] for d in gt["doors"] if not d["double"]]))
        assert abs(hint["scale_m_per_px"] / (pd.DOOR_TYPICAL_M / drawn) - 1) <= 0.05, (name, hint, drawn)
        assert hint["doors"] >= 2 and r["scale"]["status"] == "estimated_walls"
        for o in r["openings"]:
            if o["kind"] == "door" and o["swing"] != "double":
                assert abs(r["pixels"][o["id"]]["width_px"] * gt["scale_m_per_px"] - 0.9) < 0.12, (name, o)
    calibrated = pd.detect(pm.load_set()[0][2], scale_m_per_px=0.01)
    assert calibrated["calibration_hint"] is None and calibrated["scale"]["status"] == "measured"
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_openings.py -p no:cacheprovider`
Expected: FAIL — the first test finds `doors == []` (the stub returns None for every gap).

- [ ] **Step 3: Replace the `classify_gap` stub**

In `services/plan_detect.py`, replace the stub `classify_gap` (Task 3) with the sampling helpers and the classifier. `_lines_along` and the window branch are written here once, so Task 5 only adds the profile method:

```python
def _ratio(mask: np.ndarray, pts: np.ndarray) -> float:
    """The fraction of the sample points (x, y) that fall on set pixels of the mask."""
    h, w = mask.shape
    xs = np.clip(np.round(pts[:, 0]).astype(int), 0, w - 1)
    ys = np.clip(np.round(pts[:, 1]).astype(int), 0, h - 1)
    return float(mask[ys, xs].mean())


def _arc(centre: np.ndarray, radius: float, u: np.ndarray, n: np.ndarray, count: int = 24) -> np.ndarray:
    """24 points on the quarter circle about `centre` from direction u (the other gap end) to direction n (the leaf)."""
    th = np.linspace(0.08, math.pi / 2 - 0.08, count)
    return centre + np.outer(np.cos(th), u) * radius + np.outer(np.sin(th), n) * radius


def _arc_ratio(mask: np.ndarray, centre: np.ndarray, radius: float, u: np.ndarray, n: np.ndarray) -> float:
    """Ink along the quarter circle from u to n about centre, the best of five radii within 6 %: the gap ends are known
    to a few pixels, a drawn arc is two or three pixels wide."""
    return max(_ratio(mask, _arc(centre, radius * k, u, n)) for k in (0.94, 0.97, 1.0, 1.03, 1.06))


def _lines_along(g0: np.ndarray, d: np.ndarray, length: float, nl: np.ndarray, t_ref: float, ink: np.ndarray) -> int:
    """How many of the three lines a window symbol may show (both wall faces and the glass line between them) are
    drawn along the run g0 -> g0 + d * length: ink on at least 60 % of 16 samples per line."""
    hits = 0
    along = np.linspace(0.1, 0.9, 16)
    for off in (-t_ref / 2, 0.0, t_ref / 2):
        if _ratio(ink, g0 + np.outer(along, d) * length + nl * off) >= WINDOW_LINE_RATIO:
            hits += 1
    return hits


def classify_gap(g0: np.ndarray, g1: np.ndarray, d: np.ndarray, t_ref: float, s: float, calibrated: bool, thin_mask: np.ndarray, ink: np.ndarray) -> dict[str, Any] | None:
    """What the gap g0 -> g1 (along d) between two collinear wall segments is (design 9.2 / 9.3): a door (a quarter
    circle of ink of the gap's radius about one gap end, >= 60 % ink, the best of hinge x swing), a double door (a gap
    of 1.5-2.4 m with mirrored half arcs), a window (2-3 thin lines along the gap), a passage (a door-sized gap without
    an arc), or nothing (None). `s` is metres per pixel; when uncalibrated a gap of 1.5-4 thicknesses counts as door
    sized too."""
    gap = float(np.hypot(*(g1 - g0)))
    door = DOOR_RANGE_M[0] / s <= gap <= DOOR_RANGE_M[1] / s or (not calibrated and DOOR_RANGE_T[0] * t_ref <= gap <= DOOR_RANGE_T[1] * t_ref)
    double = DOUBLE_RANGE_M[0] / s <= gap <= DOUBLE_RANGE_M[1] / s
    window = WINDOW_RANGE_M[0] / s <= gap <= WINDOW_RANGE_M[1] / s
    if not (door or double or window):
        return None
    nl, nr = np.array([d[1], -d[0]]), np.array([-d[1], d[0]])
    best = (0.0, "start", "left")
    if door or double:
        for hinge, centre, other in (("start", g0, g1), ("end", g1, g0)):
            u = _unit(centre, other)
            for swing, n in (("left", nl), ("right", nr)):
                r = _arc_ratio(thin_mask, centre, gap, u, n)
                if r > best[0]:
                    best = (r, hinge, swing)
    double_ratio = 0.0
    if double:
        for n in (nl, nr):
            double_ratio = max(double_ratio, min(_arc_ratio(thin_mask, g0, gap / 2, d, n), _arc_ratio(thin_mask, g1, gap / 2, -d, n)))
    hits = _lines_along(g0, d, gap, nl, t_ref, ink) if window else 0

    def conf_arc(r: float) -> float:
        return round(0.55 + 0.45 * (r - ARC_INK_RATIO) / (1 - ARC_INK_RATIO), 3)

    if double and double_ratio >= ARC_INK_RATIO:
        return {"kind": "door", "swing": "double", "hinge": "start", "confidence": conf_arc(double_ratio), "width_px": gap}
    if (door or double) and best[0] >= ARC_INK_RATIO:
        return {"kind": "door", "swing": best[2], "hinge": best[1], "confidence": conf_arc(best[0]), "width_px": gap}
    if window and hits >= 2:
        return {"kind": "window", "swing": "none", "hinge": "start", "confidence": round(0.45 + 0.15 * hits, 3), "width_px": gap}
    if door:
        return {"kind": "passage", "swing": "none", "hinge": "start", "confidence": 0.45, "width_px": gap}
    return None
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_openings.py -p no:cacheprovider`
Expected: `4 passed` (about a minute: the baseline loop runs the six plans, the hint test runs them again uncalibrated).

- [ ] **Step 5: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/plan_detect.py smplwise_vms/backend/tests/test_plan_detect_openings.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): door detection - gap classification by the drawn arc, hinge and swing, double doors, passages, the door-width calibration hint (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 5: Windows by the ink-thickness profile, kinds and confidence, the full baseline, the private-scan script

**Files:**
- Modify: `smplwise_vms/backend/smplwise/services/plan_detect.py` (replace the `windows_by_profile` stub)
- Create: `scripts/plan_detect_private.py`
- Test: `smplwise_vms/backend/tests/test_plan_detect_baseline.py`

**Interfaces:**
- Consumes: `detect` (Tasks 3–4), `plan_detect_metrics.run_set / summary_line`.
- Produces: `windows_by_profile(walls, openings, dt_ink, ink, s) -> list[opening dict with wall_seg, t]`; the complete `detect`; `scripts/plan_detect_private.py` (`python scripts/plan_detect_private.py [folder]`, default `private-evidence/plan_detect/`; exit 0 with `skipped: no private plans` when the folder is absent; prints one line per plan and the summary, never a path or a picture).

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio detection baseline (T086, R172 / AT172): on the committed synthetic set every plan reaches walls >= 90 %
(precision >= 80 %), doors >= 80 %, windows >= 60 % and finishes within the 15 s budget; the uncalibrated run offers a
door-width hint within 5 % of the truth; kinds and confidence follow design 9.1; the private-scan script skips
cleanly when there are no private plans."""
from __future__ import annotations

import io
import pathlib
import subprocess
import sys

import plan_detect_metrics as pm
from smplwise.services import plan_detect as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "fixtures" / "plan_detect"))
import gen_synthetic as gen  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[3]
BUDGET_MS = 15000


def test_baseline_on_the_synthetic_set():
    rows = pm.run_set(pd.detect)
    print(pm.summary_line(rows))
    for row in rows:
        assert row["walls"]["recall"] >= 0.90 and row["walls"]["precision"] >= 0.80, (row["name"], row["walls"])
        assert row["doors"]["recall"] >= 0.80, (row["name"], row["doors"])
        assert row["windows"]["recall"] >= 0.60, (row["name"], row["windows"])
        assert row["ms"] <= BUDGET_MS, (row["name"], row["ms"])
    assert sum(r["windows"]["found"] for r in rows) >= 12 and sum(r["doors"]["found"] for r in rows) >= 20


def test_windows_in_the_hall_and_the_apartment():
    for name, want in (("hall", 5), ("apartment", 3)):
        gt, png = next((g, p) for n, g, p in pm.load_set() if n == name)
        r = pd.detect(png, scale_m_per_px=gt["scale_m_per_px"])
        windows = [o for o in r["openings"] if o["kind"] == "window"]
        assert len(windows) == want, (name, [(o["kind"], o["width_m"]) for o in r["openings"]])
        for o in windows:
            assert o["height_m"] == 1.2 and o["sill_m"] == 0.9 and o["swing"] == "none" and 0.55 <= o["confidence"] <= 0.9
            assert 0.4 <= o["width_m"] <= 1.6, o
        assert pm.opening_scores(gt, r["walls"], r["openings"], ("window",), "windows", 10.0)["recall"] == 1.0


def test_kinds_and_confidence_follow_the_rules():
    p = gen.Plan("t", 0.01, 800, 500)
    for a, b in (((60, 60), (740, 60)), ((740, 60), (740, 440)), ((740, 440), (60, 440)), ((60, 440), (60, 60))):
        p.wall(a, b, 16, "exterior")
    p.wall((400, 60), (400, 440), 12)  # spans the plan: touches two frame edges, still interior
    p.wall((60, 250), (400, 250), 6)  # a thin partition
    p.wall((560, 250), (610, 250), 12)  # a short stub: low length score
    buf = io.BytesIO()
    p.im.save(buf, "PNG")
    r = pd.detect(buf.getvalue(), scale_m_per_px=0.01)
    by_kind: dict[str, list[dict]] = {}
    for w in r["walls"]:
        by_kind.setdefault(w["kind"], []).append(w)
    assert len(by_kind["exterior"]) == 4 and all(abs(w["thickness_m"] - 0.16) < 0.04 for w in by_kind["exterior"])
    assert any(abs(w["thickness_m"] - 0.06) < 0.03 for w in by_kind.get("partition", [])), by_kind
    assert len([w for w in by_kind.get("interior", []) if abs(w["thickness_m"] - 0.12) < 0.03]) == 2, by_kind
    stub = min(r["walls"], key=lambda w: abs(w["polyline"][0][0] - w["polyline"][1][0]) * 800 + abs(w["polyline"][0][1] - w["polyline"][1][1]) * 500)
    longest = max(by_kind["exterior"], key=lambda w: abs(w["polyline"][0][0] - w["polyline"][1][0]))
    assert stub["confidence"] < longest["confidence"] and longest["confidence"] >= 0.9 and all(0.05 <= w["confidence"] <= 0.99 for w in r["walls"])
    assert r["detector"] == {"name": "plan_detect", "version": pd.VERSION, "params": {"strength": 0.6, "targets": ["walls", "openings"], "analysis_px": [800, 500], "threshold": r["detector"]["params"]["threshold"], "tilt_deg": 0.0}}


def test_private_script_skips_without_private_plans(tmp_path):
    out = subprocess.run([sys.executable, str(ROOT / "scripts" / "plan_detect_private.py"), str(tmp_path / "none")], capture_output=True, text=True, cwd=str(ROOT))
    assert out.returncode == 0 and "skipped: no private plans" in out.stdout
    gen.generate(tmp_path / "set")
    out = subprocess.run([sys.executable, str(ROOT / "scripts" / "plan_detect_private.py"), str(tmp_path / "set")], capture_output=True, text=True, cwd=str(ROOT))
    assert out.returncode == 0 and "6 plans:" in out.stdout and "apartment" in out.stdout and str(tmp_path) not in out.stdout, out.stdout
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_baseline.py -p no:cacheprovider`
Expected: FAIL — `test_windows_in_the_hall_and_the_apartment` finds 0 windows in the hall (its windows are merged into the wall band; only a two-line window that stays a gap is found by Task 4), and the script is missing.

- [ ] **Step 3: Replace the `windows_by_profile` stub**

In `services/plan_detect.py`:

```python
def windows_by_profile(walls: list[Seg], openings: list[dict[str, Any]], dt: np.ndarray, ink: np.ndarray, s: float) -> list[dict[str, Any]]:
    """Design 9.3: along every wall, in 5 cm steps, the ink thickness on the wall's centre line (the best of three
    perpendicular offsets, so a wall a few pixels off its detected line still reads solid); a run of 0.5-3 m under
    half the wall's median thickness, with two or three lines drawn along it, is a window. `dt` is the distance
    transform of the raw ink: the closing merges a window's parallel lines into a band as thick as the wall, so the
    wall mask cannot tell, but the raw ink there is a few thin lines (or nothing on the centre line) and the profile
    drops. A run already covered by an opening from the gap pass is left alone."""
    ah, aw = dt.shape
    found: list[dict[str, Any]] = []
    step = max(2.0, PROFILE_STEP_M / s)
    for wi, g in enumerate(walls):
        n_steps = int(g.length / step)
        if n_steps < 6:
            continue
        d = g.dir
        nl = np.array([d[1], -d[0]])
        along = np.arange(n_steps) * step + step / 2
        prof = np.zeros(n_steps)
        for off in (-g.thick / 3, 0.0, g.thick / 3):
            pts = g.a + np.outer(along, d) + nl * off
            prof = np.maximum(prof, 2.0 * dt[np.clip(np.round(pts[:, 1]).astype(int), 0, ah - 1), np.clip(np.round(pts[:, 0]).astype(int), 0, aw - 1)])
        low = prof < 0.5 * g.thick
        k = 0
        while k < n_steps:
            if not low[k]:
                k += 1
                continue
            k2 = k
            while k2 < n_steps and low[k2]:
                k2 += 1
            run = (k2 - k) * step
            if WINDOW_RANGE_M[0] / s <= run <= WINDOW_RANGE_M[1] / s:
                c_along = (along[k] + along[k2 - 1]) / 2
                t = c_along / g.length
                taken = any(o["wall_seg"] == wi and abs(o["t"] - t) * g.length < run for o in openings + found)
                if not taken:
                    g0 = g.a + d * (c_along - run / 2)
                    hits = _lines_along(g0, d, run, nl, g.thick, ink)
                    if hits >= 2:
                        found.append({"kind": "window", "swing": "none", "hinge": "start", "confidence": round(0.4 + 0.15 * hits, 3), "width_px": run, "wall_seg": wi, "t": t})
            k = k2
    return found
```

- [ ] **Step 4: Write the private-scan script**

`scripts/plan_detect_private.py`:

```python
"""Run the Plan Studio detection metrics on private scans (T086, ruling 1): real plans stay in private-evidence/ and
never enter the repository; this script scores them with the same harness as the committed synthetic set and prints
numbers only (names of the plan files, no paths, no pictures), for the release evidence.

    python scripts/plan_detect_private.py                      # private-evidence/plan_detect/
    python scripts/plan_detect_private.py <folder>             # any folder of <name>.png + <name>.json ground truth

A folder without plans (or absent) prints "skipped: no private plans" and exits 0, so the release checklist can run it
on any workstation."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests"))


def main(argv: list[str]) -> int:
    import plan_detect_metrics as pm  # noqa: E402 - after the path setup
    from smplwise.services import plan_detect as pd  # noqa: E402

    folder = Path(argv[1]) if len(argv) > 1 else ROOT / "private-evidence" / "plan_detect"
    if not folder.is_dir() or not pm.load_set(folder):
        print("skipped: no private plans")
        return 0
    rows = pm.run_set(pd.detect, folder)
    for r in rows:
        print(f"{r['name']}: walls recall {r['walls']['recall']:.3f} precision {r['walls']['precision']:.3f}; doors {r['doors']['found']}/{r['doors']['total']} "
              f"(as doors {r['doors']['kind_recall']:.2f}, false {r['doors']['false']}); windows {r['windows']['found']}/{r['windows']['total']} (false {r['windows']['false']}); {r['ms']} ms")
    print(pm.summary_line(rows))
    uncal = pm.run_set(pd.detect, folder, calibrated=False)
    hints = [r for r in uncal if r["hint"]]
    print(f"uncalibrated: {len(hints)}/{len(uncal)} plans offered a door-width hint")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_baseline.py tests/test_plan_detect_openings.py tests/test_plan_detect_walls.py -p no:cacheprovider -s 2>&1 | tail -n 15`
Expected: `16 passed`; the `-s` output shows the summary line, for example `6 plans: walls recall >= 0.974, precision >= 0.969; doors 23/23; windows 15/15; slowest 4900 ms` (the numbers of the prototype run; yours may differ by a few thousandths and the slowest plan depends on the machine — every number must clear the thresholds of the test).

- [ ] **Step 6: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/plan_detect.py scripts/plan_detect_private.py smplwise_vms/backend/tests/test_plan_detect_baseline.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): window detection by the ink-thickness profile, wall kinds and confidence, the synthetic baseline test and the private-scan metrics script (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 6: The API — detect in a worker thread with a timeout, accept into the draft, the calibration estimate

**Files:**
- Modify: `smplwise_vms/backend/smplwise/config.py` (`detect_timeout_s`)
- Modify: `smplwise_vms/backend/smplwise/services/plan_geometry.py` (`merge_candidates`, `CandidateError`, `calibration_of` reason)
- Modify: `smplwise_vms/backend/smplwise/routers/plan_geometry.py` (two routes, the calibration route)
- Test: `smplwise_vms/backend/tests/test_plan_detect_api.py`

**Interfaces:**
- Consumes: `plan_detect.detect` (Tasks 3–5), `geometry_store.working_doc / save_draft`, `pg.validate`, `pg.calibration_of`, `db.unlocked`, `db.new_id`, `audit`.
- Produces:
  - `Settings.detect_timeout_s: int = 60`.
  - `pg.CANDIDATE_PREFIXES = ("auto-", "imp-")`, `pg.CANDIDATE_SOURCES = ("auto", "imported")`, `pg.EDITABLE_FIELDS`, `pg.CandidateError(code, user_message, ids)`, `pg.merge_candidates(doc, candidates, accepted, edits, replace_auto, new_id_fn=new_id) -> (doc, {"accepted": {"walls", "openings", "objects"}, "removed_auto", "reided"})`.
  - `POST /plan-versions/{id}/detect` body `{targets: ["walls", "openings"], strength: 0.3–1.0 (default 0.6), level_id?}` → `{...detect result, version_id, level_id, existing_auto: {walls, openings}, elapsed_ms}`; 422 `validation` (targets without walls), 422 `unknown_level`, 404 (picture missing), 504 `detect_timeout` (retryable), 500 `detect_failed`; permission `map.edit`; audit `geometry.detect`.
  - `POST /plan-versions/{id}/detect/accept` body `{accepted: [ids], edits: {id: {…}}, replace_auto: false, candidates: {walls, openings, objects?}, base_revision, detector?}` → the same payload as `PUT …/geometry`; 409 `stale_revision`, 422 `unknown_candidate` / `orphan_opening` / `candidate_source` / `duplicate_candidate` / `candidate_shape` (with `details.ids`), 422 `geometry_structure`; audit `geometry.detect.accept`; the draft's `meta.last_detection = {at, by, detector, accepted, replace_auto}` and `meta.detector_version`.
  - `PATCH /plan-versions/{id}/calibration` accepts either `{pairs: [...]}` (as before) or `{estimate: {scale_m_per_px, method: "door_width", reason?}}`; the response gains `status: "measured" | "estimated"` (`residual_pct` is `null` for an estimate); the stored record carries `status`, `method` and `reason`, and `calibration_of` passes the reason through.

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_api.py -p no:cacheprovider`
Expected: FAIL — the detect route answers 404 (`Not Found`), the estimate body is refused with 422 (`pairs` required).

- [ ] **Step 3: The setting**

In `config.py`, after `render_timeout_s: int = 30` add:

```python
    detect_timeout_s: int = 60  # the guard on a synchronous structure detection (design 9.6 / decision 6)
```

- [ ] **Step 4: `merge_candidates` and the reason in `plan_geometry.py`**

Change `calibration_of` so a stored record keeps its reason (an estimate says why it is one):

```python
        return {"status": status, "method": rec.get("method", "two_point"), "pairs": rec.get("pairs", []), "residual_pct": rec.get("residual_pct"), "reason": rec.get("reason")}
```

Append to `services/plan_geometry.py` (after `prune_unfit`), with `from .plan_schema import canonical_json as canonical_json` joined by `from ..db import new_id` in the imports:

```python
# ---------------------------------------------------------------- candidates (phase 3, T086)

CANDIDATE_PREFIXES = ("auto-", "imp-")
CANDIDATE_SOURCES = ("auto", "imported")
EDITABLE_FIELDS = {
    "walls": ("polyline", "thickness_m", "kind", "height_m", "base_z_m", "level_id", "locked"),
    "openings": ("t", "kind", "width_m", "height_m", "sill_m", "swing", "hinge", "wall_id", "anchor_ref"),
    "objects": ("pose", "size", "name", "catalog_id", "custom_item_id", "level_id", "params", "flip", "locked"),
}
CANDIDATE_COLLECTIONS = ("walls", "openings", "objects")


class CandidateError(ValueError):
    """An accept the merge cannot do: the route answers 422 with the code and the ids."""

    def __init__(self, code: str, user_message: str, ids: list[str] | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.user_message = user_message
        self.ids = ids or []


def merge_candidates(doc: Mapping[str, Any], candidates: Mapping[str, Any], accepted: list[str], edits: Mapping[str, Any] | None, replace_auto: bool,
                     new_id_fn: Any = new_id) -> tuple[dict[str, Any], dict[str, Any]]:
    """The accepted candidates merged into a copy of the draft (design 9.5): every candidate must carry a candidate id
    ("auto-" / "imp-") and source; edits touch the editable fields only (never id, source or confidence); with
    replace_auto the draft's items of the candidates' sources go first (a wall takes its openings with it); an accepted
    opening needs its wall accepted or already in the draft; an accepted id that already exists in the draft is
    re-issued and the openings pointing to it follow. Returns the merged document and the counts."""
    pool: dict[str, tuple[str, dict[str, Any]]] = {}
    for coll in CANDIDATE_COLLECTIONS:
        for item in candidates.get(coll) or []:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
                raise CandidateError("candidate_shape", "מועמד ללא מזהה.")
            if not item["id"].startswith(CANDIDATE_PREFIXES) or item.get("source") not in CANDIDATE_SOURCES:
                raise CandidateError("candidate_source", "מועמד חייב להיות אוטומטי או מיובא, עם מזהה מועמד.", [item["id"]])
            if item["id"] in pool:
                raise CandidateError("duplicate_candidate", "אותו מועמד נשלח פעמיים.", [item["id"]])
            pool[item["id"]] = (coll, copy.deepcopy(item))
    unknown = [i for i in accepted if i not in pool]
    if unknown:
        raise CandidateError("unknown_candidate", "מועמד שאושר לא נמצא בין המועמדים שנשלחו.", unknown)
    chosen = {i: pool[i] for i in dict.fromkeys(accepted)}
    for cid, patch in (edits or {}).items():
        if cid in chosen and isinstance(patch, dict):
            coll, item = chosen[cid]
            for key in EDITABLE_FIELDS[coll]:
                if key in patch:
                    item[key] = patch[key]
    out = copy.deepcopy(dict(doc))
    for coll in CANDIDATE_COLLECTIONS:
        if not isinstance(out.get(coll), list):
            out[coll] = []
    removed = 0
    if replace_auto:
        sources = {item.get("source") for _c, item in chosen.values()} or set(CANDIDATE_SOURCES)
        gone: set[str] = set()
        for coll in CANDIDATE_COLLECTIONS:
            kept = []
            for item in out[coll]:
                if isinstance(item, dict) and item.get("source") in sources:
                    removed += 1
                    if coll == "walls":
                        gone.add(item.get("id"))
                else:
                    kept.append(item)
            out[coll] = kept
        if gone:  # the openings of a removed wall go with it, as the editor's remove does
            before = len(out["openings"])
            out["openings"] = [o for o in out["openings"] if not (isinstance(o, dict) and o.get("wall_id") in gone)]
            removed += before - len(out["openings"])
    existing = {item["id"] for coll in COLLECTIONS for item in out.get(coll) or [] if isinstance(item, dict) and isinstance(item.get("id"), str)}
    accepted_walls = {i for i, (coll, _item) in chosen.items() if coll == "walls"}
    orphans = [i for i, (coll, item) in chosen.items() if coll == "openings" and item.get("wall_id") not in accepted_walls and item.get("wall_id") not in existing]
    if orphans:
        raise CandidateError("orphan_opening", "פתח שאושר בלי הקיר שלו.", orphans)
    remap = {cid: new_id_fn() for cid in chosen if cid in existing}
    counts = {"walls": 0, "openings": 0, "objects": 0}
    for cid, (coll, item) in chosen.items():
        item["id"] = remap.get(cid, cid)
        if coll == "openings" and item.get("wall_id") in remap:
            item["wall_id"] = remap[item["wall_id"]]
        out[coll].append(item)
        counts[coll] += 1
    return out, {"accepted": counts, "removed_auto": removed, "reided": len(remap)}
```

- [ ] **Step 5: The routes**

In `routers/plan_geometry.py` add to the imports: `import concurrent.futures`, `import time`, `from ..db import new_id, now_iso, unlocked` (replacing the `now_iso` import), `from ..services import plan_detect`; after `NO_CACHE` add:

```python
DETECT_POOL = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="plan-detect")
```

Replace the calibration models and route:

```python
class CalPair(BaseModel):
    a: list[float] = Field(min_length=2, max_length=2)
    b: list[float] = Field(min_length=2, max_length=2)
    metres: float = Field(gt=0, le=1000)


class EstimateIn(BaseModel):
    scale_m_per_px: float = Field(gt=0, le=10)
    method: str = Field(default="door_width", pattern="^(door_width)$")
    reason: str = Field(default="לפי רוחב דלת אופייני", max_length=200)


class CalibrationIn(BaseModel):
    pairs: list[CalPair] | None = Field(default=None, min_length=1, max_length=4)
    estimate: EstimateIn | None = None


@router.patch("/plan-versions/{version_id}/calibration")
def calibrate(version_id: str, body: CalibrationIn, request: Request, principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Two points and a known distance (more pairs average and expose a distorted scan), or - phase 3 - the estimate the
    detector offers from the door widths, recorded as an estimated calibration (design 6.3: metres then show as
    approximate). Nothing moves on the map: positions are 0..1; only the metres change. Viewers see it after the
    structure is published."""
    v = _editable(conn, principal, version_id)
    if (body.pairs is None) == (body.estimate is None):
        raise ApiError(422, "validation", "שלח pairs (כיול בשתי נקודות) או estimate (הערכה), לא שניהם.")
    now = now_iso()
    residual: float | None
    if body.estimate is not None:
        scale, residual, status = body.estimate.scale_m_per_px, None, "estimated"
        record: dict[str, Any] = {"method": body.estimate.method, "status": status, "pairs": [], "residual_pct": None, "reason": body.estimate.reason, "at": now, "by": principal.user_id}
        details: dict[str, Any] = {"version_id": v["id"], "method": body.estimate.method, "status": status, "scale_m_per_px": scale}
    else:
        pairs = body.pairs or []
        if any(not 0 <= c <= 1 for p in pairs for c in (*p.a, *p.b)):
            raise ApiError(422, "validation", "נקודות הכיול חייבות להיות בתוך התוכנית.")
        try:
            scale, residual = pg.two_point_scale([(p.a, p.b, p.metres) for p in pairs], v["width_px"], v["height_px"])
        except ValueError:
            raise ApiError(422, "validation", "שתי הנקודות קרובות מדי זו לזו; בחר נקודות רחוקות יותר.")
        status = "measured"
        record = {"method": "two_point", "status": status, "pairs": [{"a": [round(p.a[0], 6), round(p.a[1], 6)], "b": [round(p.b[0], 6), round(p.b[1], 6)], "metres": p.metres} for p in pairs],
                  "residual_pct": residual, "reason": None, "at": now, "by": principal.user_id}
        details = {"version_id": v["id"], "method": "two_point", "status": status, "scale_m_per_px": scale, "residual_pct": residual, "pairs": len(pairs)}
    conn.execute("UPDATE plan_versions SET scale_m_per_px = ?, calibration_json = ?, revision = revision + 1 WHERE id = ?",
                 (scale, json.dumps(record, ensure_ascii=False), v["id"]))
    v2 = get_version(conn, v["id"])
    doc, row = store.working_doc(conn, v2)
    store.save_draft(conn, v2, doc, row["revision"] if row is not None else 0, principal.user_id, now)
    audit(conn, actor=principal, action="plan.calibrate", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request), details=details)
    warning = "הזוגות לא מסכימים ביניהם ביותר מ־3%: ייתכן שהסריקה מעוותת. כייל שוב או הוסף זוג." if residual is not None and residual > 3 else None
    return {"version": version_row(v2), "scale_m_per_px": scale, "residual_pct": residual, "warning": warning, "status": status}
```

Append the detection routes (before `_export_doc`):

```python
# ---------------------------------------------------------------- detection (phase 3, T086)

class DetectIn(BaseModel):
    targets: list[str] = Field(default=["walls", "openings"], min_length=1, max_length=4)
    strength: float = Field(default=0.6, ge=0.3, le=1.0)
    level_id: str | None = Field(default=None, max_length=64)


class CandidateSet(BaseModel):
    walls: list[dict[str, Any]] = Field(default=[], max_length=2000)
    openings: list[dict[str, Any]] = Field(default=[], max_length=4000)
    objects: list[dict[str, Any]] = Field(default=[], max_length=5000)


class AcceptIn(BaseModel):
    accepted: list[str] = Field(min_length=1, max_length=11000)
    edits: dict[str, dict[str, Any]] = Field(default={})
    replace_auto: bool = False
    candidates: CandidateSet
    base_revision: int = Field(ge=0)
    detector: dict[str, Any] | None = None


def _auto_counts(doc: dict[str, Any]) -> dict[str, int]:
    return {c: sum(1 for i in doc.get(c) or [] if isinstance(i, dict) and i.get("source") == "auto") for c in ("walls", "openings")}


@router.post("/plan-versions/{version_id}/detect")
def detect_structure(version_id: str, body: DetectIn, request: Request, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Candidates (walls, openings) from the version's picture by the local detector (design section 9): synchronous,
    in a worker thread, at most detect_timeout_s (decision 6); nothing is stored - the client sends back what it
    accepts to /detect/accept. The calibration, when there is one, sets the metres; otherwise the answer carries a
    door-width hint."""
    settings = settings_of(request)
    v = _editable(conn, principal, version_id)
    targets = list(dict.fromkeys(body.targets))
    if "walls" not in targets or any(t not in plan_detect.TARGETS for t in targets):
        raise ApiError(422, "validation", "targets: walls חובה, openings אופציונלי.")
    doc, _row = store.working_doc(conn, v)
    level_ids = {lv["id"] for lv in doc["levels"]}
    level_id = body.level_id or next((lv["id"] for lv in doc["levels"] if lv.get("is_default")), pg.DEFAULT_LEVEL_ID)
    if level_id not in level_ids:
        raise ApiError(422, "unknown_level", "המפלס לא קיים בטיוטת המבנה.")
    src = settings.data_dir / v["image_path"]
    if not src.exists():
        raise not_found("תמונת התוכנית חסרה בדיסק.")
    cal = pg.calibration_of(v, None)
    scale = float(v["scale_m_per_px"]) if v["scale_m_per_px"] and cal["status"] in ("measured", "estimated") else None
    png = src.read_bytes()
    t0 = time.perf_counter()
    future = DETECT_POOL.submit(plan_detect.detect, png, targets=targets, strength=body.strength, scale_m_per_px=scale, level_id=level_id, run_id=new_id()[:6])
    try:
        with unlocked(conn):  # the write lock is not held while the worker runs
            result = future.result(timeout=settings.detect_timeout_s)
    except concurrent.futures.TimeoutError:
        future.cancel()  # a worker already running finishes on its own; its result is never read
        audit(conn, actor=principal, action="geometry.detect", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={"version_id": v["id"], "targets": targets, "strength": body.strength, "timeout_s": settings.detect_timeout_s, "timed_out": True})
        raise ApiError(504, "detect_timeout", "הזיהוי לא הסתיים בזמן; נסה עוצמה נמוכה יותר או תוכנית קטנה יותר.", retryable=True, details={"timeout_s": settings.detect_timeout_s})
    except (OSError, ValueError, MemoryError) as exc:
        raise ApiError(500, "detect_failed", "זיהוי המבנה נכשל.", details={"error": type(exc).__name__})
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    audit(conn, actor=principal, action="geometry.detect", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "targets": targets, "strength": body.strength, "walls": len(result["walls"]), "openings": len(result["openings"]), "ms": elapsed_ms,
                   "calibrated": scale is not None, "tilt_deg": result["detector"]["params"].get("tilt_deg") if isinstance(result.get("detector"), dict) else None})
    return {**result, "version_id": v["id"], "level_id": level_id, "existing_auto": _auto_counts(doc), "elapsed_ms": elapsed_ms}


@router.post("/plan-versions/{version_id}/detect/accept")
def accept_detection(version_id: str, body: AcceptIn, request: Request, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The candidates a person kept, merged into the draft under the draft's revision rules (design 9.5). The server
    remembers no candidates: the client sends them back. Nothing is published."""
    v = _editable(conn, principal, version_id)
    doc, row = store.working_doc(conn, v)
    current = row["revision"] if row is not None else 0
    if body.base_revision != current:
        raise conflict("stale_revision", "טיוטת המבנה השתנתה בינתיים; טען מחדש את העורך.", current_revision=current, sent_revision=body.base_revision)
    try:
        merged, counts = pg.merge_candidates(doc, body.candidates.model_dump(), body.accepted, body.edits, body.replace_auto)
    except pg.CandidateError as exc:
        raise ApiError(422, exc.code, exc.user_message, details={"ids": exc.ids})
    structural = [i for i in pg.validate(merged) if i["structural"]]
    if structural:
        raise ApiError(422, "geometry_structure", "מבנה המועמדים אינו תקין; דבר לא נשמר.", details={"issues": structural[:50]})
    meta = dict(merged.get("meta") or {})
    meta["last_detection"] = {"at": now_iso(), "by": principal.user_id, "detector": body.detector, "accepted": counts["accepted"], "replace_auto": body.replace_auto}
    if isinstance(body.detector, dict) and body.detector.get("name"):
        meta["detector_version"] = f"{body.detector['name']} {body.detector.get('version', '')}".strip()
    merged["meta"] = meta
    saved = store.save_draft(conn, v, merged, body.base_revision, principal.user_id)
    audit(conn, actor=principal, action="geometry.detect.accept", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], **counts, "edits": len(body.edits), "replace_auto": body.replace_auto, "detector": (body.detector or {}).get("name")})
    return _payload(conn, v, saved, store.load_doc(saved))
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_detect_api.py tests/test_plan_geometry_api.py tests/test_plan_geometry_model.py -p no:cacheprovider`
Expected: `6 passed` in the new file and the phase-1 API / model tests still green (`test_calibration_sets_the_scale_and_updates_the_draft` keeps passing: the pairs path is unchanged apart from the added `status`).

- [ ] **Step 7: Commit**

```bash
git add smplwise_vms/backend/smplwise/config.py smplwise_vms/backend/smplwise/services/plan_geometry.py smplwise_vms/backend/smplwise/routers/plan_geometry.py smplwise_vms/backend/tests/test_plan_detect_api.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): detect and accept API - worker thread with a timeout, candidates merged into the draft, the door-width calibration estimate (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 7: DXF — layer and block mapping to candidates, the entities summary route, the import route

**Files:**
- Create: `smplwise_vms/backend/smplwise/services/plan_dxf_map.py`
- Modify: `smplwise_vms/backend/smplwise/routers/plans.py` (two routes after the DXF options routes)
- Test: `smplwise_vms/backend/tests/test_plan_dxf_map.py`

**Interfaces:**
- Consumes: `plan_dxf._load`, `plan_dxf._segments`, `plan_dxf.DRAWABLE`, `plan_dxf.METERS`, `plan_dxf.load_options`, `plan_dxf.DxfError`; `geometry_store.working_doc`; the catalog file `smplwise/catalog/objects.json` (phase 2) and the `catalog_items` table (phase 2) when they exist.
- Produces (module `plan_dxf_map`):
  - `TARGETS = ("walls", "openings", "windows", "objects", "rooms", "ignore")`, `TARGET_LABELS`, `LAYER_RULES`, `BLOCK_WORDS`, `GENERIC_NAME = "עצם כללי"`, `WALL_PAIR_M = (0.10, 0.40)`, `NEAR_WALL_M = 0.35`.
  - `suggest_layer(name) -> target`, `suggest_block(name, size_m, catalog) -> {"catalog_id", "name"}`, `load_catalog(conn | None) -> list[{"id", "name_he", "name_en", "tags", "size"}]`, `catalog_choices(catalog) -> [{"id", "name"}]` (the generic first).
  - `read_entities(path, layers=None) -> list[Entity]` (`{"layer", "kind", "handle", "segments", "closed", "insert", "arc"}` in drawing units), `extent_for(path, layers) -> {"minx", "miny", "maxx", "maxy", "w", "h"}` (the padded extent `plan_dxf.render` uses for those layers), `to_version(x, y, extent, rotation, crop) -> [nx, ny]`, `entities_summary(path, layers, units, catalog) -> {"units", "metres_per_unit", "layers": [{"name", "count", "kinds", "sample", "suggested", "in_render"}], "blocks": [{"name", "count", "size_m", "suggested"}]}`, `map_geometry(path, *, layer_map, block_map, units, extent, rotation, crop, level_id, run_id, catalog, scale_m_per_px) -> candidates` (`walls`, `openings`, `objects`, `rooms`, `detector {name: "plan_dxf_map", version, params}`, `calibration_hint: None`, `pixels: {}`, `scale {m_per_px, status: "measured"}`, `stats`).
  - Routes: `GET /plan-assets/{id}/dxf/entities` (`map.import`; 409 `not_dxf`) → the summary plus `targets: [{id, label}]` and `catalog_choices`; `POST /plan-versions/{id}/import-dxf-geometry` body `{layer_map: {layer: target}, block_map: {block: catalog_id | null}, level_id?}` (`map.import`; 409 `not_dxf`, 422 `validation` for an unknown target, 422 `dxf_unitless` when the drawing has no units, 422 `unknown_level`) → `{...candidates, version_id, level_id, existing_auto}`; audit `geometry.import`.
  - Object candidate (design 4.2): `{id: "imp-<run>-x001", level_id, catalog_id, custom_item_id: None, name, pose: {x, y, rotation_deg, z_m: 0}, size: {w_m, d_m, h_m}, params: {}, anchor_ref: None, circuit_id: None, group_id: None, flip: False, locked: False, source: "imported", confidence, external_ids: {dxf_handle, dxf_block}}`. **Reconcile with phase 2** (consistency row C7): once T085's `plan_geometry._check_fields("objects")` is on the branch, the accept of imported objects must pass it; adjust the field set here, never the validator.

- [ ] **Step 1: Write the failing tests**

```python
"""DXF geometry mapping (T086, design 9.4): layer names suggest targets, block names and sizes suggest catalog items,
double lines become one wall with a thickness, an arc becomes a door on its wall with the swing of the drawing, window
lines become a window, blocks become objects, closed polylines become room polygons, everything in the version's 0..1
space through the render extent, the rotation and the crop; the two routes serve the import screen and refuse a
non-DXF asset, a viewer and a drawing without units."""
from __future__ import annotations

import io
import json
import math

import ezdxf
import numpy as np
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import plan_dxf, plan_dxf_map

CATALOG = [
    {"id": "chair-1", "name_he": "כיסא", "name_en": "Chair", "tags": ["seat"], "size": (0.45, 0.45, 0.9)},
    {"id": "bed-1", "name_he": "מיטה", "name_en": "Single bed", "tags": ["bed"], "size": (2.0, 0.9, 0.5)},
    {"id": "door-1", "name_he": "דלת", "name_en": "Door", "tags": [], "size": (0.9, 0.1, 2.1)},
]


def _drawing(path, units_code: int = 6) -> None:
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = units_code
    for name in ("A-WALL", "A-DOOR", "A-GLAZ", "A-FURN", "A-AREA", "TEXT"):
        doc.layers.add(name)
    msp = doc.modelspace()
    # the outer walls as double lines 0.2 m apart (outer face on the 12 x 8 rectangle), a single-line partition at x = 6
    for a, b in (((0, 0), (12, 0)), ((12, 0), (12, 8)), ((12, 8), (0, 8)), ((0, 8), (0, 0))):
        msp.add_line(a, b, dxfattribs={"layer": "A-WALL"})
    for a, b in (((0.2, 0.2), (11.8, 0.2)), ((11.8, 0.2), (11.8, 7.8)), ((11.8, 7.8), (0.2, 7.8)), ((0.2, 7.8), (0.2, 0.2))):
        msp.add_line(a, b, dxfattribs={"layer": "A-WALL"})
    msp.add_line((6, 0.2), (6, 7.8), dxfattribs={"layer": "A-WALL"})
    # a door: hinge at (6, 4) on the partition, the arc sweeps from (6.9, 4) [the tip, +x side] to (6, 4.9) [on the wall]
    msp.add_arc((6, 4), 0.9, 0, 90, dxfattribs={"layer": "A-DOOR"})
    # a window in the top wall: three lines from x = 2 to 3.2
    for y in (7.8, 7.9, 8.0):
        msp.add_line((2, y), (3.2, y), dxfattribs={"layer": "A-GLAZ"})
    for name, w, d in (("CHAIR", 0.45, 0.45), ("BED", 2.0, 1.6), ("WIDGET", 0.5, 0.5)):
        blk = doc.blocks.new(name=name)
        blk.add_lwpolyline([(0, 0), (w, 0), (w, d), (0, d)], close=True)
    msp.add_blockref("CHAIR", (3, 2), dxfattribs={"layer": "A-FURN"})
    msp.add_blockref("BED", (9, 2), dxfattribs={"layer": "A-FURN", "rotation": 90})
    msp.add_blockref("WIDGET", (4, 6), dxfattribs={"layer": "A-FURN"})
    msp.add_lwpolyline([(0.2, 0.2), (5.8, 0.2), (5.8, 7.8), (0.2, 7.8)], close=True, dxfattribs={"layer": "A-AREA"})
    msp.add_text("Lobby", dxfattribs={"layer": "TEXT", "height": 0.25}).set_placement((1, 1))
    doc.saveas(str(path))


def test_layer_and_block_suggestions():
    for name, want in (("A-WALL", "walls"), ("WALLS", "walls"), ("M_MUR_EXT", "walls"), ("קירות", "walls"), ("A-DOOR", "openings"), ("דלתות", "openings"),
                       ("A-GLAZ", "windows"), ("WIND", "windows"), ("A-FURN", "objects"), ("EQPM", "objects"), ("ריהוט", "objects"), ("A-AREA", "rooms"), ("ROOM", "rooms"),
                       ("TEXT", "ignore"), ("0", "ignore"), ("DEFPOINTS", "ignore")):
        assert plan_dxf_map.suggest_layer(name) == want, name
    assert plan_dxf_map.suggest_block("CHAIR_01", (0.45, 0.45), CATALOG) == {"catalog_id": "chair-1", "name": "כיסא"}
    assert plan_dxf_map.suggest_block("BED-DOUBLE", (2.0, 1.6), CATALOG) == {"catalog_id": "bed-1", "name": "מיטה"}
    assert plan_dxf_map.suggest_block("SEAT", (0.5, 0.5), CATALOG) == {"catalog_id": "chair-1", "name": "כיסא"}, "a tag matches too"
    assert plan_dxf_map.suggest_block("WIDGET", (0.5, 0.5), CATALOG) == {"catalog_id": None, "name": "עצם כללי"}
    assert plan_dxf_map.suggest_block("CHAIR", (0.5, 0.5), []) == {"catalog_id": None, "name": "כיסא"}, "the word list names it even without a catalog"
    assert [c["id"] for c in plan_dxf_map.catalog_choices(CATALOG)][:2] == [None, "chair-1"] and plan_dxf_map.catalog_choices(CATALOG)[0]["name"] == "עצם כללי"
    assert isinstance(plan_dxf_map.load_catalog(None), list), "no catalog file, no table: an empty list, not a crash"


def test_summary_extent_and_transform(tmp_path):
    src = tmp_path / "plan.dxf"
    _drawing(src)
    s = plan_dxf_map.entities_summary(src, None, "m", CATALOG)
    by = {l["name"]: l for l in s["layers"]}
    assert s["units"] == "m" and s["metres_per_unit"] == 1.0
    assert by["A-WALL"]["count"] == 9 and by["A-WALL"]["suggested"] == "walls" and by["A-WALL"]["kinds"] == {"LINE": 9} and "m" in by["A-WALL"]["sample"]
    assert by["A-DOOR"]["count"] == 1 and by["A-DOOR"]["suggested"] == "openings" and by["A-DOOR"]["sample"].startswith("ARC")
    assert by["A-GLAZ"]["suggested"] == "windows" and by["A-FURN"]["count"] == 3 and by["A-AREA"]["suggested"] == "rooms" and by["TEXT"]["count"] == 0 and by["TEXT"]["suggested"] == "ignore"
    blocks = {b["name"]: b for b in s["blocks"]}
    assert blocks["CHAIR"]["count"] == 1 and [round(x, 2) for x in blocks["CHAIR"]["size_m"]] == [0.45, 0.45] and blocks["CHAIR"]["suggested"]["catalog_id"] == "chair-1"
    assert [round(x, 2) for x in blocks["BED"]["size_m"]] == [2.0, 1.6] and blocks["WIDGET"]["suggested"] == {"catalog_id": None, "name": "עצם כללי"}
    ext = plan_dxf_map.extent_for(src, None)
    rendered = plan_dxf.render(src, tmp_path / "x.png", 400).extent
    for k in ("minx", "miny", "maxx", "maxy"):
        assert math.isclose(ext[k], rendered[k], abs_tol=1e-9), k
    assert math.isclose(ext["w"], 12.48) and math.isclose(ext["h"], 8.48)
    p = plan_dxf_map.to_version(3, 2, ext, 0, None)
    assert abs(p[0] - 3.24 / 12.48) < 1e-6 and abs(p[1] - 6.24 / 8.48) < 1e-6, "y up in the drawing, y down in the picture"
    q = plan_dxf_map.to_version(3, 2, ext, 90, {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8})
    assert abs(q[0] - (1 - 6.24 / 8.48 - 0.1) / 0.8) < 1e-6 and abs(q[1] - (3.24 / 12.48 - 0.1) / 0.8) < 1e-6, "a 90 degree turn then the crop"


def test_map_geometry_walls_door_window_objects_rooms(tmp_path):
    src = tmp_path / "plan.dxf"
    _drawing(src)
    ext = plan_dxf_map.extent_for(src, None)
    layer_map = {"A-WALL": "walls", "A-DOOR": "openings", "A-GLAZ": "windows", "A-FURN": "objects", "A-AREA": "rooms", "TEXT": "ignore"}
    r = plan_dxf_map.map_geometry(src, layer_map=layer_map, block_map={}, units="m", extent=ext, rotation=0, crop=None, level_id="L0", run_id="d1", catalog=CATALOG, scale_m_per_px=0.03)
    assert r["detector"]["name"] == "plan_dxf_map" and r["scale"] == {"m_per_px": 0.03, "status": "measured"} and r["calibration_hint"] is None
    walls = r["walls"]
    assert len(walls) == 5 and all(w["id"].startswith("imp-d1-w") and w["source"] == "imported" and w["level_id"] == "L0" for w in walls)
    paired = [w for w in walls if abs(w["thickness_m"] - 0.2) < 0.011 and w["confidence"] >= 0.9]
    assert len(paired) == 4, [(w["thickness_m"], w["confidence"]) for w in walls]
    single = [w for w in walls if w["confidence"] < 0.9]
    assert len(single) == 1 and single[0]["thickness_m"] == 0.2, "an unpaired line takes the default thickness"
    # the paired top wall runs along y = 7.9 (0.1 m inside the outer face), the full 12 m
    W, H = 12.48, 8.48
    top = max(walls, key=lambda w: -(w["polyline"][0][1] + w["polyline"][1][1]))
    ys = [(8.24 - p[1] * H) for p in top["polyline"]]
    xs = sorted((p[0] * W - 0.24) for p in top["polyline"])
    assert all(abs(y - 7.9) < 0.02 for y in ys) and abs(xs[0] - 0) < 0.05 and abs(xs[1] - 12) < 0.05, (xs, ys)
    door = [o for o in r["openings"] if o["kind"] == "door"]
    assert len(door) == 1 and abs(door[0]["width_m"] - 0.9) < 0.02 and door[0]["source"] == "imported" and door[0]["height_m"] == 2.1
    partition = single[0]
    assert door[0]["wall_id"] == partition["id"]
    # the swing follows the drawing: the leaf tip (hinge + normal x width, geometry.ts convention) lands at (6.9, 4)
    a = np.array(partition["polyline"][0]) * [W, H]
    b = np.array(partition["polyline"][1]) * [W, H]
    d = (b - a) / np.linalg.norm(b - a)
    c = a + (b - a) * door[0]["t"]
    px_per_m = W / 12.48
    hinge = c - d * 0.9 * px_per_m / 2 if door[0]["hinge"] == "start" else c + d * 0.9 * px_per_m / 2
    n = np.array([d[1], -d[0]]) if door[0]["swing"] == "left" else np.array([-d[1], d[0]])
    tip = hinge + n * 0.9 * px_per_m
    assert abs((tip[0] - 0.24) - 6.9) < 0.05 and abs((8.24 - tip[1]) - 4.0) < 0.05, (door[0]["hinge"], door[0]["swing"], tip)
    win = [o for o in r["openings"] if o["kind"] == "window"]
    assert len(win) == 1 and abs(win[0]["width_m"] - 1.2) < 0.05 and win[0]["wall_id"] == top["id"] and win[0]["sill_m"] == 0.9
    assert min(abs(win[0]["t"] - 2.6 / 12), abs(win[0]["t"] - (1 - 2.6 / 12))) < 0.01
    objs = {o["name"]: o for o in r["objects"]}
    assert set(objs) == {"כיסא", "מיטה", "עצם כללי"} and all(o["source"] == "imported" and o["id"].startswith("imp-d1-x") for o in r["objects"])
    assert objs["כיסא"]["catalog_id"] == "chair-1" and abs(objs["כיסא"]["pose"]["x"] - 3.24 / 12.48) < 1e-4 and abs(objs["כיסא"]["pose"]["y"] - 6.24 / 8.48) < 1e-4
    assert objs["כיסא"]["size"] == {"w_m": 0.45, "d_m": 0.45, "h_m": 0.9} and objs["כיסא"]["pose"]["rotation_deg"] == 90 and objs["כיסא"]["external_ids"]["dxf_block"] == "CHAIR"
    assert objs["מיטה"]["pose"]["rotation_deg"] == 0 and objs["מיטה"]["size"]["w_m"] == 2.0 and objs["מיטה"]["size"]["h_m"] == 0.5, "a block turned 90 degrees CCW points up"
    assert objs["עצם כללי"]["catalog_id"] is None and objs["עצם כללי"]["size"] == {"w_m": 0.5, "d_m": 0.5, "h_m": 0.8}
    assert len(r["rooms"]) == 1 and len(r["rooms"][0]["polygon"]) == 4 and all(0 <= p["x"] <= 1 and 0 <= p["y"] <= 1 for p in r["rooms"][0]["polygon"])
    override = plan_dxf_map.map_geometry(src, layer_map=layer_map, block_map={"WIDGET": "bed-1"}, units="m", extent=ext, rotation=0, crop=None, level_id="L0", run_id="d2", catalog=CATALOG, scale_m_per_px=0.03)
    assert [o["catalog_id"] for o in override["objects"] if o["external_ids"]["dxf_block"] == "WIDGET"] == ["bed-1"]
    ignored = plan_dxf_map.map_geometry(src, layer_map={"A-WALL": "walls"}, block_map={}, units="m", extent=ext, rotation=0, crop=None, level_id="L0", run_id="d3", catalog=[], scale_m_per_px=0.03)
    assert len(ignored["walls"]) == 5 and ignored["openings"] == [] and ignored["objects"] == [] and ignored["rooms"] == []


def test_routes_serve_the_summary_and_import_candidates(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    src = tmp_path / "plan.dxf"
    _drawing(src, units_code=0)  # unitless first: the drawing must be given units before geometry can be measured
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.dxf", src.read_bytes(), "application/octet-stream")}).json()
    s = c.get(f"/api/v1/plan-assets/{asset['id']}/dxf/entities")
    assert s.status_code == 200, s.text
    body = s.json()
    assert body["asset_id"] == asset["id"] and body["units"] == "unitless" and body["metres_per_unit"] is None
    assert {l["name"]: l["suggested"] for l in body["layers"]}["A-WALL"] == "walls" and body["targets"][0] == {"id": "walls", "label": "קירות"} and body["catalog_choices"][0]["id"] is None
    assert [b["name"] for b in body["blocks"]] == ["BED", "CHAIR", "WIDGET"]
    png_asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    assert c.get(f"/api/v1/plan-assets/{png_asset['id']}/dxf/entities").status_code == 409
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    layer_map = {l["name"]: l["suggested"] for l in body["layers"]}
    unitless = c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": layer_map, "block_map": {}})
    assert unitless.status_code == 422 and unitless.json()["code"] == "dxf_unitless"
    assert c.put(f"/api/v1/plan-assets/{asset['id']}/dxf", json={"units": "m"}).status_code == 200
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert v["scale_m_per_px"], "with units the version carries the DXF scale"
    assert c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": {"A-WALL": "nonsense"}}).status_code == 422
    assert c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": layer_map, "level_id": "L9"}).json()["code"] == "unknown_level"
    r = c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": layer_map, "block_map": {}})
    assert r.status_code == 200, r.text
    cands = r.json()
    assert len(cands["walls"]) == 5 and len(cands["openings"]) == 2 and len(cands["objects"]) == 3 and len(cands["rooms"]) == 1
    assert cands["version_id"] == v["id"] and cands["level_id"] == "L0" and cands["existing_auto"] == {"walls": 0, "openings": 0} and cands["scale"]["status"] == "measured"
    assert all(w["source"] == "imported" for w in cands["walls"])
    # the imported walls and openings go through the same accept as detected ones
    acc = c.post(f"/api/v1/plan-versions/{v['id']}/detect/accept", json={"accepted": [w["id"] for w in cands["walls"]] + [o["id"] for o in cands["openings"]], "edits": {}, "replace_auto": False,
                                                                        "candidates": {"walls": cands["walls"], "openings": cands["openings"]}, "base_revision": 0, "detector": cands["detector"]})
    assert acc.status_code == 200, acc.text
    assert len(acc.json()["doc"]["walls"]) == 5 and all(w["source"] == "imported" for w in acc.json()["doc"]["walls"]) and acc.json()["doc"]["meta"]["detector_version"].startswith("plan_dxf_map")
    assert not any(i["severity"] == "error" for i in acc.json()["issues"]), acc.json()["issues"]
    version_png = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": png_asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{version_png['id']}/import-dxf-geometry", json={"layer_map": {}}).status_code == 409
    bind(c, settings, "dana", "viewer", "floor", f2)
    assert c.get(f"/api/v1/plan-assets/{asset['id']}/dxf/entities", headers=as_user("dana")).status_code == 403
    assert c.post(f"/api/v1/plan-versions/{v['id']}/import-dxf-geometry", json={"layer_map": layer_map}, headers=as_user("dana")).status_code == 403
    with app.state.db.connection() as conn:
        rows = [json.loads(x[0]) for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.import'").fetchall()]
    assert len(rows) == 1 and rows[0] == {"version_id": v["id"], "asset_id": asset["id"], "walls": 5, "openings": 2, "objects": 3, "rooms": 1, "layers": len(layer_map), "blocks": 0}
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_dxf_map.py -p no:cacheprovider`
Expected: FAIL — `ImportError: cannot import name 'plan_dxf_map'`.

- [ ] **Step 3: Write `services/plan_dxf_map.py`**

```python
"""DXF layers and blocks mapped to Plan Studio candidates (phase 3, T086, design 9.4), on the existing ezdxf adapter
(plan_dxf): layer names suggest a target by common naming (WALL / A-WALL / MUR / קיר -> walls, DOOR -> openings,
WIND / GLAZ -> windows, FURN / EQPM -> objects, ROOM / AREA -> rooms), INSERT blocks suggest a catalog item by their
name and bounding box, two parallel lines 10-40 cm apart become one wall with that thickness, an arc becomes a door
with the swing of the drawing, lines on a window layer become a window on their wall, closed polylines on a room
layer become room polygons for the zones accept. Everything is measured in the drawing's units, so the metres are
real (`measured`); positions go through the render extent, the version's rotation and its crop into the version's
0..1 space. The result has the shape of plan_detect.detect (source "imported", ids "imp-<run>-...")."""
from __future__ import annotations

import json
import math
import re
import sqlite3
from pathlib import Path
from typing import Any

from . import plan_dxf

VERSION = "1.0"
TARGETS = ("walls", "openings", "windows", "objects", "rooms", "ignore")
TARGET_LABELS = {"walls": "קירות", "openings": "דלתות", "windows": "חלונות", "objects": "עצמים", "rooms": "חדרים", "ignore": "התעלם"}
LAYER_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("walls", ("wall", "walls", "mur", "murs", "קיר", "קירות")),
    ("openings", ("door", "doors", "porte", "portes", "דלת", "דלתות")),
    ("windows", ("wind", "window", "windows", "glaz", "glazing", "fenetre", "חלון", "חלונות")),
    ("rooms", ("room", "rooms", "area", "areas", "space", "spaces", "zone", "zones", "חדר", "חדרים", "אזור", "אזורים")),
    ("objects", ("furn", "furniture", "eqpm", "equip", "equipment", "fixt", "fixture", "fixtures", "ריהוט", "ציוד")),
)
BLOCK_WORDS = {"door": "דלת", "chair": "כיסא", "seat": "כיסא", "bed": "מיטה", "table": "שולחן", "desk": "שולחן", "sofa": "ספה", "couch": "ספה", "toilet": "אסלה",
               "wc": "אסלה", "sink": "כיור", "basin": "כיור", "window": "חלון", "lamp": "מנורה", "light": "מנורה", "cabinet": "ארון", "closet": "ארון",
               "wardrobe": "ארון", "tree": "עץ", "shower": "מקלחת", "bath": "אמבטיה"}
GENERIC_NAME = "עצם כללי"
GENERIC_HEIGHT_M = 0.8
WALL_PAIR_M = (0.10, 0.40)  # two parallel lines this far apart are one wall
PAIR_ANGLE_DEG = 2.0
NEAR_WALL_M = 0.35  # an arc or a window line belongs to the wall within this distance
DEFAULT_THICKNESS_M = 0.2
DOOR_WIDTH_M = (0.5, 2.5)
WINDOW_WIDTH_M = (0.3, 4.0)
MIN_SEGMENT_M = 0.05
_TOKEN = re.compile(r"[^0-9a-z֐-׿]+")


def _tokens(name: str) -> list[str]:
    return [t for t in _TOKEN.split(str(name).lower()) if t]


def suggest_layer(name: str) -> str:
    tokens = set(_tokens(name))
    for target, words in LAYER_RULES:
        if tokens & set(words):
            return target
    return "ignore"


def suggest_block(name: str, size_m: tuple[float, float] | list[float], catalog: list[dict[str, Any]]) -> dict[str, Any]:
    """The catalog item a block name points at: a token of the name equal to a word of an item's English name (3), a
    tag (2), or contained in the name (1); ties go to the closest footprint. Without a match the word list gives a
    Hebrew name (a plain box of the block's size); without that, the generic object."""
    tokens = _tokens(name)
    best: tuple[int, float, dict[str, Any]] | None = None
    for item in catalog:
        en_words = set(_tokens(item.get("name_en") or ""))
        tags = {t.lower() for t in item.get("tags") or []}
        score = 0
        for t in tokens:
            if t in en_words:
                score = max(score, 3)
            elif t in tags:
                score = max(score, 2)
            elif len(t) >= 3 and any(t in w for w in en_words):
                score = max(score, 1)
        if score:
            sz = item.get("size") or (0, 0, 0)
            fit = abs(float(sz[0]) - float(size_m[0])) + abs(float(sz[1]) - float(size_m[1]))
            if best is None or (score, -fit) > (best[0], -best[1]):
                best = (score, fit, item)
    if best is not None:
        return {"catalog_id": best[2]["id"], "name": best[2].get("name_he") or best[2].get("name_en") or best[2]["id"]}
    for t in tokens:
        if t in BLOCK_WORDS:
            return {"catalog_id": None, "name": BLOCK_WORDS[t]}
    return {"catalog_id": None, "name": GENERIC_NAME}


def _norm_item(raw: dict[str, Any]) -> dict[str, Any] | None:
    """One catalog record in the shape this module uses, from the built-in file ({id, names: {he, en}, tags, size: {w_m,
    d_m, h_m}}) or from a catalog_items row ({id, name_he, name_en, tags_json, size_w_m, ...})."""
    if not isinstance(raw, dict) or not raw.get("id"):
        return None
    names = raw.get("names") if isinstance(raw.get("names"), dict) else {}
    size = raw.get("size") if isinstance(raw.get("size"), dict) else {}
    tags = raw.get("tags")
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except ValueError:
            tags = []
    return {"id": str(raw["id"]), "name_he": raw.get("name_he") or names.get("he") or "", "name_en": raw.get("name_en") or names.get("en") or "",
            "tags": [str(t) for t in (tags or []) if isinstance(t, (str, int))],
            "size": (float(raw.get("size_w_m") or size.get("w_m") or 0), float(raw.get("size_d_m") or size.get("d_m") or 0), float(raw.get("size_h_m") or size.get("h_m") or 0))}


def load_catalog(conn: sqlite3.Connection | None) -> list[dict[str, Any]]:
    """The built-in library (smplwise/catalog/objects.json, phase 2) plus the installation's custom items (the
    catalog_items table, phase 2); an absent file or table is an empty list."""
    out: list[dict[str, Any]] = []
    path = Path(__file__).resolve().parents[1] / "catalog" / "objects.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    except (OSError, ValueError):
        data = []
    for raw in data.get("items", []) if isinstance(data, dict) else data:
        item = _norm_item(raw)
        if item:
            out.append(item)
    if conn is not None:
        try:
            rows = conn.execute("SELECT id, name_he, name_en, tags_json AS tags, size_w_m, size_d_m, size_h_m FROM catalog_items WHERE deleted_at IS NULL").fetchall()
        except sqlite3.OperationalError:
            rows = []
        for r in rows:
            item = _norm_item({k: r[k] for k in r.keys()})
            if item:
                out.append(item)
    return out


def catalog_choices(catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"id": None, "name": GENERIC_NAME}] + [{"id": c["id"], "name": c["name_he"] or c["name_en"] or c["id"]} for c in catalog[:400]]


# ---------------------------------------------------------------- reading the drawing

def _bbox(points: list[tuple[float, float]]) -> tuple[float, float, float, float] | None:
    if not points:
        return None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def read_entities(path: Path, layers: list[str] | None = None) -> list[dict[str, Any]]:
    """Every drawable entity of the model space (optionally on the given layers) with its polylines in drawing units,
    plus what an INSERT and an ARC add: the block name, insertion point, rotation, scales and bounding box; the arc's
    centre, radius and end points."""
    doc, _warnings = plan_dxf._load(path)
    msp = doc.modelspace()
    chosen = set(layers) if layers else None
    out: list[dict[str, Any]] = []
    for e in msp:
        kind = e.dxftype()
        if kind not in plan_dxf.DRAWABLE:
            continue
        layer = str(e.dxf.layer) if e.dxf.hasattr("layer") else "0"
        if chosen is not None and layer not in chosen:
            continue
        segments = list(plan_dxf._segments(e))
        if not segments:
            continue
        item: dict[str, Any] = {"layer": layer, "kind": kind, "handle": str(e.dxf.handle) if e.dxf.hasattr("handle") else "", "segments": segments,
                                "closed": bool(getattr(e, "closed", False) or getattr(e, "is_closed", False)), "insert": None, "arc": None}
        if kind == "INSERT":
            pts = [p for seg in segments for p in seg]
            item["insert"] = {"name": str(e.dxf.name), "x": float(e.dxf.insert.x), "y": float(e.dxf.insert.y), "rotation": float(e.dxf.rotation),
                              "xscale": float(e.dxf.xscale), "yscale": float(e.dxf.yscale), "bbox": _bbox(pts)}
        elif kind == "ARC":
            item["arc"] = {"cx": float(e.dxf.center.x), "cy": float(e.dxf.center.y), "r": float(e.dxf.radius),
                           "p0": (float(e.start_point.x), float(e.start_point.y)), "p1": (float(e.end_point.x), float(e.end_point.y))}
        out.append(item)
    return out


def _block_sizes(path: Path) -> dict[str, tuple[float, float]]:
    """The untransformed footprint (width along x, depth along y, drawing units) of every block definition."""
    doc, _warnings = plan_dxf._load(path)
    sizes: dict[str, tuple[float, float]] = {}
    for block in doc.blocks:
        name = str(block.name)
        if name.startswith("*"):
            continue
        pts = [p for e in block if e.dxftype() in plan_dxf.DRAWABLE for seg in plan_dxf._segments(e) for p in seg]
        bb = _bbox(pts)
        if bb:
            sizes[name] = (bb[2] - bb[0], bb[3] - bb[1])
    return sizes


def extent_for(path: Path, layers: list[str] | None) -> dict[str, float]:
    """The padded extent plan_dxf.render draws the chosen layers with (2 % of the longer side on each edge): the same
    numbers, so a point maps onto the version picture exactly."""
    minx = miny = math.inf
    maxx = maxy = -math.inf
    for ent in read_entities(path, layers):
        for seg in ent["segments"]:
            for x, y in seg:
                minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)
    if not math.isfinite(minx):
        raise plan_dxf.DxfError("dxf_empty", "nothing drawable on the chosen layers")
    w_units = max(maxx - minx, 1e-9)
    h_units = max(maxy - miny, 1e-9)
    pad = 0.02 * max(w_units, h_units)
    minx, miny, maxx, maxy = minx - pad, miny - pad, maxx + pad, maxy + pad
    return {"minx": minx, "miny": miny, "maxx": maxx, "maxy": maxy, "w": maxx - minx, "h": maxy - miny}


def to_version(x: float, y: float, extent: dict[str, float], rotation: int, crop: dict[str, float] | None) -> list[float]:
    """A drawing point -> the version's 0..1 space: the rendered page (y up in the drawing, down in the picture), then
    the version's clockwise rotation, then its crop (plan_render.derive_version_image, in normalised terms)."""
    u = (x - extent["minx"]) / extent["w"]
    v = (extent["maxy"] - y) / extent["h"]
    if rotation == 90:
        u, v = 1 - v, u
    elif rotation == 180:
        u, v = 1 - u, 1 - v
    elif rotation == 270:
        u, v = v, 1 - u
    if crop:
        u, v = (u - crop["x"]) / crop["w"], (v - crop["y"]) / crop["h"]
    return [u, v]


def _sample(ent: dict[str, Any], mpu: float | None) -> str:
    length = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for seg in ent["segments"] for a, b in zip(seg, seg[1:]))
    if ent["kind"] == "INSERT" and ent["insert"]:
        return f"INSERT {ent['insert']['name']}"
    size = f"{length * mpu:.1f} m" if mpu else f"{length:.1f} units"
    return f"{ent['kind']} {size}"


def entities_summary(path: Path, layers: list[str] | None, units: str | None, catalog: list[dict[str, Any]]) -> dict[str, Any]:
    """What the mapping screen shows: per layer the drawable count, the entity kinds, a sample and the suggested target
    (with whether the layer is part of the rendered picture); per block name the count, footprint in metres (when the
    units are known) and the suggested catalog item."""
    mpu = plan_dxf.METERS.get(units or "")
    doc, _warnings = plan_dxf._load(path)
    names = [str(layer.dxf.name) for layer in doc.layers]
    ents = read_entities(path, None)
    per: dict[str, dict[str, Any]] = {n: {"name": n, "count": 0, "kinds": {}, "sample": "", "suggested": suggest_layer(n), "in_render": layers is None or n in layers} for n in names}
    blocks: dict[str, int] = {}
    for ent in ents:
        row = per.setdefault(ent["layer"], {"name": ent["layer"], "count": 0, "kinds": {}, "sample": "", "suggested": suggest_layer(ent["layer"]), "in_render": layers is None or ent["layer"] in layers})
        row["count"] += 1
        row["kinds"][ent["kind"]] = row["kinds"].get(ent["kind"], 0) + 1
        if not row["sample"]:
            row["sample"] = _sample(ent, mpu)
        if ent["insert"]:
            blocks[ent["insert"]["name"]] = blocks.get(ent["insert"]["name"], 0) + 1
    sizes = _block_sizes(path)
    block_rows = []
    for name in sorted(blocks):
        w, d = sizes.get(name, (0.0, 0.0))
        size_m = [w * mpu, d * mpu] if mpu else [w, d]
        block_rows.append({"name": name, "count": blocks[name], "size_m": size_m, "suggested": suggest_block(name, (size_m[0], size_m[1]), catalog)})
    rows = sorted(per.values(), key=lambda r: (-r["count"], r["name"]))
    return {"units": units or "unitless", "metres_per_unit": mpu, "layers": rows, "blocks": block_rows}


# ---------------------------------------------------------------- mapping

def _unit(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float]:
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    return (dx / n, dy / n) if n > 1e-12 else (1.0, 0.0)


def _pair_walls(segments: list[tuple[tuple[float, float], tuple[float, float]]]) -> list[dict[str, Any]]:
    """Double lines 10-40 cm apart (parallel within 2 degrees, projections overlapping by half the shorter one) become one
    wall on the mid line with that thickness; the rest are single-line walls at the default thickness."""
    used = [False] * len(segments)
    walls: list[dict[str, Any]] = []
    order = sorted(range(len(segments)), key=lambda i: -math.hypot(segments[i][1][0] - segments[i][0][0], segments[i][1][1] - segments[i][0][1]))
    for i in order:
        if used[i]:
            continue
        a, b = segments[i]
        d = _unit(a, b)
        li = math.hypot(b[0] - a[0], b[1] - a[1])
        best = None
        for j in order:
            if j == i or used[j]:
                continue
            c, e = segments[j]
            dj = _unit(c, e)
            cos = abs(d[0] * dj[0] + d[1] * dj[1])
            if math.degrees(math.acos(max(-1.0, min(1.0, cos)))) > PAIR_ANGLE_DEG:
                continue
            lat_c = d[0] * (c[1] - a[1]) - d[1] * (c[0] - a[0])
            lat_e = d[0] * (e[1] - a[1]) - d[1] * (e[0] - a[0])
            gap = (abs(lat_c) + abs(lat_e)) / 2
            if not WALL_PAIR_M[0] <= gap <= WALL_PAIR_M[1] or abs(lat_c - lat_e) > 0.02:
                continue
            p0 = d[0] * (c[0] - a[0]) + d[1] * (c[1] - a[1])
            p1 = d[0] * (e[0] - a[0]) + d[1] * (e[1] - a[1])
            lo, hi = min(p0, p1), max(p0, p1)
            overlap = min(li, hi) - max(0.0, lo)
            lj = math.hypot(e[0] - c[0], e[1] - c[1])
            if overlap < 0.5 * min(li, lj):
                continue
            if best is None or gap < best[0]:
                best = (gap, j, lo, hi, (lat_c + lat_e) / 2)
        if best is None:
            walls.append({"a": a, "b": b, "thickness": DEFAULT_THICKNESS_M, "confidence": 0.6, "paired": False})
            continue
        gap, j, lo, hi, lat = best
        used[i] = used[j] = True
        n = (-d[1], d[0])  # lateral > 0 is on this side
        start, end = min(0.0, lo), max(li, hi)
        mid = (a[0] + n[0] * lat / 2, a[1] + n[1] * lat / 2)
        walls.append({"a": (mid[0] + d[0] * start, mid[1] + d[1] * start), "b": (mid[0] + d[0] * end, mid[1] + d[1] * end), "thickness": round(gap, 3), "confidence": 0.9, "paired": True})
    return walls


def _nearest_wall(p: tuple[float, float], walls: list[dict[str, Any]], max_m: float) -> tuple[int, float, float] | None:
    """(index, along 0..1, lateral) of the wall whose line is nearest to p within max_m and whose span contains the
    projection (with a margin of max_m)."""
    best = None
    for i, w in enumerate(walls):
        a, b = w["a"], w["b"]
        d = _unit(a, b)
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        along = d[0] * (p[0] - a[0]) + d[1] * (p[1] - a[1])
        lateral = d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0])
        if abs(lateral) <= max_m and -max_m <= along <= length + max_m and (best is None or abs(lateral) < abs(best[2])):
            best = (i, max(0.0, min(1.0, along / length)), lateral)
    return best


def _clamped(p: list[float]) -> list[float] | None:
    if not (-0.02 <= p[0] <= 1.02 and -0.02 <= p[1] <= 1.02):
        return None
    return [round(min(1.0, max(0.0, p[0])), 5), round(min(1.0, max(0.0, p[1])), 5)]


def map_geometry(path: Path, *, layer_map: dict[str, str], block_map: dict[str, str | None], units: str, extent: dict[str, float], rotation: int,
                 crop: dict[str, float] | None, level_id: str, run_id: str, catalog: list[dict[str, Any]], scale_m_per_px: float | None) -> dict[str, Any]:
    mpu = plan_dxf.METERS.get(units)
    if not mpu:
        raise plan_dxf.DxfError("dxf_unitless", "the drawing has no units")
    targets = {layer: t for layer, t in layer_map.items() if t in TARGETS and t != "ignore"}
    ents = [e for e in read_entities(path, None) if e["layer"] in targets]
    # metres for the geometry; the transform to the picture is done per point at the end
    m = lambda p: (p[0] * mpu, p[1] * mpu)  # noqa: E731

    def tv(p_m: tuple[float, float]) -> list[float]:
        return to_version(p_m[0] / mpu, p_m[1] / mpu, extent, rotation, crop)

    wall_segments = []
    for e in ents:
        if targets[e["layer"]] == "walls":
            for seg in e["segments"]:
                for a, b in zip(seg, seg[1:]):
                    a_m, b_m = m(a), m(b)
                    if math.hypot(b_m[0] - a_m[0], b_m[1] - a_m[1]) >= MIN_SEGMENT_M:
                        wall_segments.append((a_m, b_m))
    walls = _pair_walls(wall_segments)
    out_walls: list[dict[str, Any]] = []
    wall_index: dict[int, int] = {}
    for i, w in enumerate(walls):
        pa, pb = _clamped(tv(w["a"])), _clamped(tv(w["b"]))
        if pa is None and pb is None:
            continue
        pa = pa or [round(min(1.0, max(0.0, tv(w["a"])[0])), 5), round(min(1.0, max(0.0, tv(w["a"])[1])), 5)]
        pb = pb or [round(min(1.0, max(0.0, tv(w["b"])[0])), 5), round(min(1.0, max(0.0, tv(w["b"])[1])), 5)]
        wall_index[i] = len(out_walls)
        out_walls.append({"id": f"imp-{run_id}-w{len(out_walls) + 1:03d}", "level_id": level_id, "polyline": [pa, pb], "thickness_m": w["thickness"], "height_m": None, "base_z_m": 0,
                          "kind": "exterior" if w["paired"] and w["thickness"] >= 0.25 else "interior", "confidence": w["confidence"], "source": "imported", "locked": False, "external_ids": {}})

    def opening(kind: str, wi: int, t: float, width: float, swing: str, hinge: str, confidence: float, handle: str) -> dict[str, Any]:
        return {"id": f"imp-{run_id}-o{len(out_openings) + 1:03d}", "wall_id": out_walls[wall_index[wi]]["id"], "t": round(t, 5), "kind": kind, "width_m": round(width, 3),
                "height_m": 1.2 if kind == "window" else 2.1, "sill_m": 0.9 if kind == "window" else 0, "swing": swing, "hinge": hinge, "anchor_ref": None,
                "confidence": confidence, "source": "imported", "external_ids": {"dxf_handle": handle}}

    out_openings: list[dict[str, Any]] = []
    for e in ents:
        if targets[e["layer"]] != "openings":
            continue
        if e["arc"]:
            arc = e["arc"]
            hinge_m = m((arc["cx"], arc["cy"]))
            width = arc["r"] * mpu
            if not DOOR_WIDTH_M[0] <= width <= DOOR_WIDTH_M[1]:
                continue
            hit = _nearest_wall(hinge_m, walls, NEAR_WALL_M)
            if hit is None or hit[0] not in wall_index:
                continue
            wi, _t_h, _lat = hit
            w = walls[wi]
            d = _unit(w["a"], w["b"])
            length = math.hypot(w["b"][0] - w["a"][0], w["b"][1] - w["a"][1])
            ends = [m(arc["p0"]), m(arc["p1"])]
            # the arc end on the wall line is the other gap end; the other one is the leaf tip
            on_wall = min(ends, key=lambda p: abs(d[0] * (p[1] - w["a"][1]) - d[1] * (p[0] - w["a"][0])))
            tip = ends[1] if on_wall is ends[0] else ends[0]
            centre = ((hinge_m[0] + on_wall[0]) / 2, (hinge_m[1] + on_wall[1]) / 2)
            t = (d[0] * (centre[0] - w["a"][0]) + d[1] * (centre[1] - w["a"][1])) / length
            hinge_along = d[0] * (hinge_m[0] - w["a"][0]) + d[1] * (hinge_m[1] - w["a"][1])
            other_along = d[0] * (on_wall[0] - w["a"][0]) + d[1] * (on_wall[1] - w["a"][1])
            hinge = "start" if hinge_along < other_along else "end"
            # the swing is decided in the picture's space (y down), with the convention of geometry.ts: nl = (d.y, -d.x)
            va, vb, vt = tv(w["a"]), tv(w["b"]), tv(tip)
            dv = (vb[0] - va[0], vb[1] - va[1])
            lateral = dv[0] * (vt[1] - va[1]) - dv[1] * (vt[0] - va[0])
            swing = "left" if lateral < 0 else "right"
            out_openings.append(opening("door", wi, t, width, swing, hinge, 0.85, e["handle"]))
        elif e["insert"] and e["insert"]["bbox"]:
            bb = e["insert"]["bbox"]
            width = max(bb[2] - bb[0], bb[3] - bb[1]) * mpu
            if not DOOR_WIDTH_M[0] <= width <= DOOR_WIDTH_M[1]:
                continue
            centre = m(((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2))
            hit = _nearest_wall(centre, walls, NEAR_WALL_M)
            if hit is None or hit[0] not in wall_index:
                continue
            out_openings.append(opening("door", hit[0], hit[1], width, "right", "start", 0.6, e["handle"]))
    # windows: the lines of a window layer grouped by their wall, overlapping runs merged
    runs: dict[int, list[tuple[float, float, str]]] = {}
    for e in ents:
        if targets[e["layer"]] != "windows":
            continue
        for seg in e["segments"]:
            for a, b in zip(seg, seg[1:]):
                a_m, b_m = m(a), m(b)
                mid = ((a_m[0] + b_m[0]) / 2, (a_m[1] + b_m[1]) / 2)
                hit = _nearest_wall(mid, walls, NEAR_WALL_M)
                if hit is None or hit[0] not in wall_index:
                    continue
                w = walls[hit[0]]
                d = _unit(w["a"], w["b"])
                p0 = d[0] * (a_m[0] - w["a"][0]) + d[1] * (a_m[1] - w["a"][1])
                p1 = d[0] * (b_m[0] - w["a"][0]) + d[1] * (b_m[1] - w["a"][1])
                runs.setdefault(hit[0], []).append((min(p0, p1), max(p0, p1), e["handle"]))
    for wi, items in runs.items():
        items.sort()
        merged: list[list[Any]] = []
        for lo, hi, handle in items:
            if merged and lo <= merged[-1][1] + 0.05:
                merged[-1][1] = max(merged[-1][1], hi)
            else:
                merged.append([lo, hi, handle])
        w = walls[wi]
        length = math.hypot(w["b"][0] - w["a"][0], w["b"][1] - w["a"][1])
        for lo, hi, handle in merged:
            width = hi - lo
            if WINDOW_WIDTH_M[0] <= width <= WINDOW_WIDTH_M[1]:
                out_openings.append(opening("window", wi, (lo + hi) / 2 / length, width, "none", "start", 0.7, handle))
    # objects: INSERT blocks on object layers
    out_objects: list[dict[str, Any]] = []
    sizes = _block_sizes(path)
    for e in ents:
        if targets[e["layer"]] != "objects" or not e["insert"]:
            continue
        ins = e["insert"]
        name = ins["name"]
        w_u, d_u = sizes.get(name, (0.0, 0.0))
        size_m = (abs(w_u * ins["xscale"]) * mpu, abs(d_u * ins["yscale"]) * mpu)
        if name in block_map:
            chosen = next((c for c in catalog if c["id"] == block_map[name]), None) if block_map[name] else None
            pick = {"catalog_id": chosen["id"], "name": chosen["name_he"] or chosen["name_en"] or chosen["id"]} if chosen else {"catalog_id": None, "name": suggest_block(name, size_m, [])["name"]}
        else:
            pick = suggest_block(name, size_m, catalog)
        cat = next((c for c in catalog if c["id"] == pick["catalog_id"]), None)
        pos = _clamped(tv(m((ins["x"], ins["y"]))))
        if pos is None:
            continue
        h_m = cat["size"][2] if cat and cat["size"][2] else GENERIC_HEIGHT_M
        out_objects.append({
            "id": f"imp-{run_id}-x{len(out_objects) + 1:03d}", "level_id": level_id, "catalog_id": pick["catalog_id"], "custom_item_id": None, "name": pick["name"],
            "pose": {"x": pos[0], "y": pos[1], "rotation_deg": int(round((90 - ins["rotation"] + rotation) % 360)), "z_m": 0},
            "size": {"w_m": round(size_m[0] or (cat["size"][0] if cat else 0.5), 3), "d_m": round(size_m[1] or (cat["size"][1] if cat else 0.5), 3), "h_m": round(h_m, 3)},
            "params": {}, "anchor_ref": None, "circuit_id": None, "group_id": None, "flip": False, "locked": False, "source": "imported",
            "confidence": 0.7 if pick["catalog_id"] else 0.5, "external_ids": {"dxf_handle": e["handle"], "dxf_block": name},
        })
    # rooms: closed polylines on a room layer, for the zones accept (rooms live in spatial_zones, design decision 1)
    out_rooms: list[dict[str, Any]] = []
    for e in ents:
        if targets[e["layer"]] != "rooms":
            continue
        for seg in e["segments"]:
            pts = seg[:-1] if len(seg) > 3 and seg[0] == seg[-1] else seg
            if len(pts) < 3 or not (e["closed"] or seg[0] == seg[-1]):
                continue
            poly = [_clamped(tv(m(p))) for p in pts]
            if all(p is not None for p in poly):
                out_rooms.append({"polygon": [{"x": p[0], "y": p[1]} for p in poly if p is not None], "name": "", "external_ids": {"dxf_handle": e["handle"]}})
    return {
        "walls": out_walls, "openings": out_openings, "objects": out_objects, "rooms": out_rooms,
        "detector": {"name": "plan_dxf_map", "version": VERSION, "params": {"layer_map": dict(layer_map), "block_map": {k: v for k, v in block_map.items()}, "units": units, "rotation": rotation, "crop": crop}},
        "calibration_hint": None, "pixels": {},
        "scale": {"m_per_px": scale_m_per_px, "status": "measured"},
        "stats": {"entities": len(ents), "wall_segments": len(wall_segments), "paired": sum(1 for w in walls if w["paired"])},
    }
```

- [ ] **Step 4: The routes in `routers/plans.py`**

Add `plan_dxf_map` to the services import (`from ..services import plan_dxf, plan_dxf_map, plan_render, plan_stylize`) and append after `dxf_set_options`:

```python
# ---------------------------------------------------------------- DXF geometry mapping (phase 3, T086)

@router.get("/plan-assets/{asset_id}/dxf/entities")
def dxf_entities(asset_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The mapping screen's table: every layer with its drawable count, kinds, a sample and the suggested target, every
    block with its count, footprint and the suggested catalog item; the targets and the catalog choices to pick from."""
    settings = settings_of(request)
    asset = get_asset(conn, asset_id)
    require(conn, principal, "map.import", ("floor", asset["floor_id"]))
    if asset["mime"] != "image/vnd.dxf":
        raise ApiError(409, "not_dxf", "הקובץ אינו DXF.")
    opts = plan_dxf.load_options(_asset_dir(settings, asset_id))
    units = opts.get("units") or (opts.get("info") or {}).get("units")
    catalog = plan_dxf_map.load_catalog(conn)
    try:
        with unlocked(conn):
            summary = plan_dxf_map.entities_summary(settings.data_dir / asset["storage_path"], opts.get("layers"), units, catalog)
    except plan_dxf.DxfError as exc:
        raise ApiError(422, exc.code, "קובץ ה־DXF לא ניתן לקריאה.", details=exc.details)
    return {"asset_id": asset_id, **summary, "targets": [{"id": t, "label": plan_dxf_map.TARGET_LABELS[t]} for t in plan_dxf_map.TARGETS], "catalog_choices": plan_dxf_map.catalog_choices(catalog)}


class DxfImportIn(BaseModel):
    layer_map: dict[str, str] = Field(default={})
    block_map: dict[str, str | None] = Field(default={})
    level_id: str | None = Field(default=None, max_length=64)


@router.post("/plan-versions/{version_id}/import-dxf-geometry")
def import_dxf_geometry(version_id: str, body: DxfImportIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Candidates from the DXF the version was made from, by the chosen layer and block mapping (design 9.4), in the
    shape of /detect: nothing is stored; the editor accepts them through /detect/accept."""
    settings = settings_of(request)
    v = get_version(conn, version_id)
    require(conn, principal, "map.import", ("floor", v["floor_id"]))
    if v["status"] == "archived":
        raise conflict("archived_version", "גרסה מהארכיון אינה ניתנת לעריכה; שחזר אותה קודם.")
    asset = get_asset(conn, v["asset_id"])
    if asset["mime"] != "image/vnd.dxf":
        raise ApiError(409, "not_dxf", "גרסת התוכנית לא נוצרה מקובץ DXF.")
    bad = sorted({t for t in body.layer_map.values() if t not in plan_dxf_map.TARGETS})
    if bad:
        raise ApiError(422, "validation", "יעד מיפוי לא מוכר.", details={"targets": bad})
    opts = plan_dxf.load_options(_asset_dir(settings, asset["id"]))
    units = opts.get("units") or (opts.get("info") or {}).get("units")
    if not plan_dxf.METERS.get(units or ""):
        raise ApiError(422, "dxf_unitless", "בחר יחידות לקובץ ה־DXF (בשלב הייבוא) לפני ייבוא הגאומטריה.")
    doc, _row = geometry_store.working_doc(conn, v)
    level_id = body.level_id or next((lv["id"] for lv in doc["levels"] if lv.get("is_default")), "L0")
    if level_id not in {lv["id"] for lv in doc["levels"]}:
        raise ApiError(422, "unknown_level", "המפלס לא קיים בטיוטת המבנה.")
    src = settings.data_dir / asset["storage_path"]
    catalog = plan_dxf_map.load_catalog(conn)
    try:
        with unlocked(conn):
            extent = plan_dxf_map.extent_for(src, opts.get("layers"))
            result = plan_dxf_map.map_geometry(src, layer_map=body.layer_map, block_map=body.block_map, units=units, extent=extent, rotation=int(v["rotation"]),
                                               crop=json.loads(v["crop_json"]) if v["crop_json"] else None, level_id=level_id, run_id=new_id()[:6], catalog=catalog,
                                               scale_m_per_px=v["scale_m_per_px"])
    except plan_dxf.DxfError as exc:
        raise ApiError(422, exc.code, "קובץ ה־DXF לא ניתן לקריאה או ריק בשכבות שנבחרו.", details=exc.details)
    existing = {c: sum(1 for i in doc.get(c) or [] if isinstance(i, dict) and i.get("source") == "imported") for c in ("walls", "openings")}
    audit(conn, actor=principal, action="geometry.import", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "asset_id": asset["id"], "walls": len(result["walls"]), "openings": len(result["openings"]), "objects": len(result["objects"]),
                   "rooms": len(result["rooms"]), "layers": len(body.layer_map), "blocks": len(body.block_map)})
    return {**result, "version_id": v["id"], "level_id": level_id, "existing_auto": existing}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_dxf_map.py tests/test_dxf.py -p no:cacheprovider`
Expected: `7 passed` (4 new; the three phase-0 DXF tests unchanged). If `test_map_geometry…` fails on the swing or the rotation of the bed, the convention notes in the code are the place to look: the picture's y points down, the drawing's y points up.

- [ ] **Step 6: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/plan_dxf_map.py smplwise_vms/backend/smplwise/routers/plans.py smplwise_vms/backend/tests/test_plan_dxf_map.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): DXF layer and block mapping to candidates - double-line walls, arcs as doors, window lines, blocks as objects, room polygons; entities summary and import routes (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 8: Frontend foundation — API client, candidate operations, the candidates layer in `sw-plan-canvas`, icon, token, node spec

**Files:**
- Modify: `frontend/src/api/geometry.ts`, `frontend/src/api/types.ts`
- Create: `frontend/src/map/candidates.ts`
- Modify: `frontend/src/map/sw-plan-canvas.ts`, `frontend/src/components/sw-icon.ts`, `frontend/src/styles/tokens.css`
- Test: `frontend/tests/unit-plan-detect.spec.ts` (node, no page)

**Interfaces:**
- Consumes: `buildPrimitives`, `GeomWall`, `GeomOpening`, `GeometryDoc`, `Pt` (`map/geometry.ts`), the client helpers (`api/client.ts`).
- Produces:
  - `api/geometry.ts`: `DetectTarget`, `DetectRequest`, `CalibrationHint`, `CandidatePixels`, `DetectorInfo`, `DetectResult`, `AcceptRequest`, `detectStructure(versionId, body)`, `acceptDetection(versionId, body) -> GeometryResponse`, `calibrateEstimate(versionId, scaleMPerPx, reason)`, `DxfTarget`, `DxfEntityLayer`, `DxfBlock`, `DxfEntities`, `getDxfEntities(assetId)`, `importDxfGeometry(versionId, body) -> DetectResult`; `CalibrationResult.residual_pct: number | null`, `CalibrationResult.status`.
  - `api/types.ts`: `PlanVersion.calibration.status?`, `.reason?`.
  - `map/candidates.ts`: `CandState`, `CandidateSet`, `fromResult(r)`, `candidatesDoc(base, set)`, `rescale(set, scale)`, `allIds(set)`, `byConfidence(set, min)`, `byKind(set, kinds)`, `withParents(set, ids)`, `moveVertex(set, id, index, p)`, `defaultStates(set)`, `stashDxfCandidates(versionId, r)`, `takeDxfCandidates(versionId)`.
  - `sw-plan-canvas`: properties `candidates: CandidateSet | null`, `candidateStates: Record<string, CandState>`, `selectedCandidateId: string | null`, `candidateEditable: boolean`; events `candidate-select {id}` (a click on a candidate), `candidate-drag {id, index, x, y}` (an endpoint of the selected candidate wall released); DOM `[data-candidates] [data-candidate="<id>"][data-kind="wall|door|window|passage"][data-state="accepted|rejected"][data-score]`, `[data-cand-score]` (the pill of the hovered / selected candidate), `[data-cand-vertex]`.
  - `sw-icon`: `sparkle`. `tokens.css`: `--sw-map-candidate`.

- [ ] **Step 1: Write the failing node spec**

```ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DetectResult } from '../src/api/geometry';
import { buildPrimitives, type GeometryDoc } from '../src/map/geometry';
import { allIds, byConfidence, byKind, candidatesDoc, defaultStates, fromResult, moveVertex, rescale, withParents } from '../src/map/candidates';

// Plan Studio phase 3 (T086): the pure candidate-set operations the editor's detect tool runs on. Node only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = () => JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;

const wall = (id: string, polyline: [number, number][], confidence: number) => ({ id, level_id: 'L0', polyline, thickness_m: 0.16, height_m: null, base_z_m: 0, kind: 'interior' as const,
  confidence, source: 'auto' as const, locked: false, external_ids: {} });
const opening = (id: string, wall_id: string, kind: 'door' | 'window' | 'passage', confidence: number) => ({ id, wall_id, t: 0.5, kind, width_m: 0.9, height_m: 2.1, sill_m: 0,
  swing: kind === 'door' ? ('left' as const) : ('none' as const), hinge: 'start' as const, anchor_ref: null, confidence, source: 'auto' as const, external_ids: {} });

function result(): DetectResult {
  return {
    walls: [wall('auto-r-w001', [[0.1, 0.1], [0.9, 0.1]], 0.95), wall('auto-r-w002', [[0.1, 0.1], [0.1, 0.9]], 0.7), wall('auto-r-w003', [[0.5, 0.1], [0.5, 0.9]], 0.4)],
    openings: [opening('auto-r-o001', 'auto-r-w001', 'door', 0.9), opening('auto-r-o002', 'auto-r-w003', 'window', 0.6), opening('auto-r-o003', 'auto-r-w002', 'passage', 0.45)],
    detector: { name: 'plan_detect', version: '1.0', params: {} }, calibration_hint: null,
    pixels: { 'auto-r-w001': { thickness_px: 16 }, 'auto-r-w002': { thickness_px: 16 }, 'auto-r-w003': { thickness_px: 10 }, 'auto-r-o001': { width_px: 90 }, 'auto-r-o002': { width_px: 120 }, 'auto-r-o003': { width_px: 100 } },
    scale: { m_per_px: 0.01, status: 'measured' }, stats: {}, version_id: 'v1', level_id: 'L0', existing_auto: { walls: 0, openings: 0 },
  };
}

test('a candidate set draws through the same primitives as the structure', () => {
  const set = fromResult(result());
  expect(set.scaleMPerPx).toBe(0.01);
  const doc = candidatesDoc(sample(), set);
  expect(doc.labels).toEqual([]);
  const prims = buildPrimitives(doc, 1000, 800);
  expect(prims.filter((p) => p.kind === 'wall').length).toBe(6); // three walls, each cut once by its opening
  expect(prims.filter((p) => p.kind === 'door').length).toBe(1);
  expect(prims.filter((p) => p.kind === 'window').length).toBe(1);
  expect(prims.filter((p) => p.kind === 'passage').length).toBe(1);
  expect(defaultStates(set)).toEqual(Object.fromEntries(allIds(set).map((id) => [id, 'accepted'])));
});

test('rescale recomputes the metres from the pixels', () => {
  const set = fromResult(result());
  const two = rescale(set, 0.02);
  expect(two.walls[0].thickness_m).toBeCloseTo(0.32, 6);
  expect(two.openings[0].width_m).toBeCloseTo(1.8, 6);
  expect(two.scaleMPerPx).toBe(0.02);
  expect(set.walls[0].thickness_m).toBe(0.16); // the input is untouched
  const tiny = rescale(set, 0.0001);
  expect(tiny.walls[0].thickness_m).toBe(0.02); // never under the validator's floor
});

test('selection rules: everything, above a confidence, by kind, always with the parent wall', () => {
  const set = fromResult(result());
  expect(allIds(set)).toEqual(['auto-r-w001', 'auto-r-w002', 'auto-r-w003', 'auto-r-o001', 'auto-r-o002', 'auto-r-o003']);
  expect(byConfidence(set, 0.8)).toEqual(['auto-r-w001', 'auto-r-o001']);
  expect(byConfidence(set, 0.6)).toEqual(['auto-r-w001', 'auto-r-w002', 'auto-r-w003', 'auto-r-o001', 'auto-r-o002']); // the window (0.6) brings its 0.4 wall along
  expect(byKind(set, ['door'])).toEqual(['auto-r-w001', 'auto-r-o001']);
  expect(byKind(set, ['wall'])).toEqual(['auto-r-w001', 'auto-r-w002', 'auto-r-w003']);
  expect(withParents(set, ['auto-r-o003', 'auto-r-o003'])).toEqual(['auto-r-w002', 'auto-r-o003']);
});

test('moving a candidate wall end returns a new set and keeps the openings on the wall', () => {
  const set = fromResult(result());
  const moved = moveVertex(set, 'auto-r-w001', 1, [0.95, 0.12]);
  expect(moved.walls[0].polyline[1]).toEqual([0.95, 0.12]);
  expect(set.walls[0].polyline[1]).toEqual([0.9, 0.1]);
  expect(moved.openings[0].wall_id).toBe('auto-r-w001');
  expect(moveVertex(set, 'nope', 0, [0, 0])).toBe(set);
  expect(moveVertex(set, 'auto-r-w001', 1, [1.4, -0.2]).walls[0].polyline[1]).toEqual([1, 0]); // clamped to the plan
});
```

- [ ] **Step 2: Run to see it fail**

Run: in `frontend/`: `npx playwright test tests/unit-plan-detect.spec.ts --project=desktop --reporter=line`
Expected: FAIL — `Cannot find module '../src/map/candidates'`.

- [ ] **Step 3: The API client and types**

Append to `frontend/src/api/geometry.ts` (and add `GeomOpening`, `GeomWall` to the import from `../map/geometry`; change `CalibrationResult` to `residual_pct: number | null; status?: 'measured' | 'estimated';`):

```ts
// ---------------------------------------------------------------- detection (phase 3, T086)

export type DetectTarget = 'walls' | 'openings';
export interface DetectRequest {
  targets?: DetectTarget[];
  /** 0.3 (light morphology) to 1.0 (strong); the server's default is 0.6. */
  strength?: number;
  level_id?: string;
}
export interface CalibrationHint {
  scale_m_per_px: number;
  status: 'estimated';
  method: 'door_width';
  reason: string;
  doors: number;
}
/** Version pixels per candidate: the client recomputes the metres with the document's effective scale before accepting. */
export type CandidatePixels = Record<string, { thickness_px?: number; width_px?: number }>;
export interface DetectorInfo {
  name: string;
  version: string;
  params: Record<string, unknown>;
}
export interface DxfRoomCandidate {
  polygon: { x: number; y: number }[];
  name: string;
}
/** POST /plan-versions/{id}/detect and POST …/import-dxf-geometry: candidates in document-v2 shape, never stored. */
export interface DetectResult {
  walls: GeomWall[];
  openings: GeomOpening[];
  objects?: unknown[];
  rooms?: DxfRoomCandidate[];
  detector: DetectorInfo;
  calibration_hint: CalibrationHint | null;
  pixels: CandidatePixels;
  scale: { m_per_px: number | null; status: 'measured' | 'estimated_walls' };
  stats: Record<string, number>;
  version_id: string;
  level_id: string;
  existing_auto: { walls: number; openings: number };
  elapsed_ms?: number;
}
export interface AcceptRequest {
  accepted: string[];
  edits: Record<string, Partial<GeomWall> | Partial<GeomOpening>>;
  replace_auto: boolean;
  candidates: { walls: GeomWall[]; openings: GeomOpening[]; objects?: unknown[] };
  base_revision: number;
  detector: DetectorInfo | null;
}
export const detectStructure = (versionId: string, body: DetectRequest) => post<DetectResult>(`plan-versions/${versionId}/detect`, body);
export const acceptDetection = (versionId: string, body: AcceptRequest) => post<GeometryResponse>(`plan-versions/${versionId}/detect/accept`, body);
/** The door-width hint as an estimated calibration (design 6.3): metres then show with "≈". */
export const calibrateEstimate = (versionId: string, scaleMPerPx: number, reason: string) =>
  patch<CalibrationResult>(`plan-versions/${versionId}/calibration`, { estimate: { scale_m_per_px: scaleMPerPx, method: 'door_width', reason } });

export type DxfTarget = 'walls' | 'openings' | 'windows' | 'objects' | 'rooms' | 'ignore';
export interface DxfEntityLayer {
  name: string;
  count: number;
  kinds: Record<string, number>;
  sample: string;
  suggested: DxfTarget;
  in_render: boolean;
}
export interface DxfBlock {
  name: string;
  count: number;
  size_m: [number, number];
  suggested: { catalog_id: string | null; name: string };
}
export interface DxfEntities {
  asset_id: string;
  units: string;
  metres_per_unit: number | null;
  layers: DxfEntityLayer[];
  blocks: DxfBlock[];
  targets: { id: DxfTarget; label: string }[];
  catalog_choices: { id: string | null; name: string }[];
}
export const getDxfEntities = (assetId: string) => get<DxfEntities>(`plan-assets/${assetId}/dxf/entities`);
export const importDxfGeometry = (versionId: string, body: { layer_map: Record<string, DxfTarget>; block_map: Record<string, string | null>; level_id?: string }) =>
  post<DetectResult>(`plan-versions/${versionId}/import-dxf-geometry`, body);
```

In `frontend/src/api/types.ts` replace the `calibration?:` line of `PlanVersion` with:

```ts
  /** Calibration record (Plan Studio): two-point pairs, or a door-width estimate (status "estimated", phase 3). */
  calibration?: { method: string; status?: 'measured' | 'estimated'; pairs: { a: [number, number]; b: [number, number]; metres: number }[]; residual_pct: number | null; reason?: string | null } | null;
```

- [ ] **Step 4: `frontend/src/map/candidates.ts`**

```ts
/**
 * Plan Studio phase 3 (T086): the candidate set the detect tool holds until "אשר" - pure operations (every function
 * returns a new set), no DOM and no Lit, so it runs in node (tests/unit-plan-detect.spec.ts). Candidates are document-v2
 * walls and openings with source "auto" (detection) or "imported" (DXF); `pixels` keeps their version-pixel sizes so
 * the metres follow the document's effective scale, whatever the server assumed.
 */
import type { CandidatePixels, DetectResult } from '../api/geometry';
import type { GeometryDoc, GeomOpening, GeomWall, Pt } from './geometry';

export type CandState = 'accepted' | 'rejected';
export type CandKind = 'wall' | 'door' | 'window' | 'passage';
export interface CandidateSet {
  walls: GeomWall[];
  openings: GeomOpening[];
  objects: unknown[];
  pixels: CandidatePixels;
  /** Metres per version pixel the server used for the metres of this set (null when unknown). */
  scaleMPerPx: number | null;
}

const MIN_THICKNESS_M = 0.02;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const clampPt = (p: Pt): Pt => [round5(Math.min(1, Math.max(0, p[0]))), round5(Math.min(1, Math.max(0, p[1])))];

export function fromResult(r: DetectResult): CandidateSet {
  return { walls: r.walls, openings: r.openings, objects: r.objects ?? [], pixels: r.pixels ?? {}, scaleMPerPx: r.scale?.m_per_px ?? null };
}

/** The set as a document, so the canvas draws it through buildPrimitives exactly like the structure. */
export function candidatesDoc(base: GeometryDoc, set: CandidateSet): GeometryDoc {
  return { ...base, walls: set.walls, openings: set.openings, labels: [], objects: [] };
}

/** Metres from the version pixels at another scale (the document's effective scale, or the applied door-width hint). */
export function rescale(set: CandidateSet, scaleMPerPx: number): CandidateSet {
  const walls = set.walls.map((w) => {
    const px = set.pixels[w.id]?.thickness_px;
    return px === undefined ? w : { ...w, thickness_m: Math.max(MIN_THICKNESS_M, round3(px * scaleMPerPx)) };
  });
  const openings = set.openings.map((o) => {
    const px = set.pixels[o.id]?.width_px;
    return px === undefined ? o : { ...o, width_m: Math.max(0.05, round3(px * scaleMPerPx)) };
  });
  return { ...set, walls, openings, scaleMPerPx };
}

export function allIds(set: CandidateSet): string[] {
  return [...set.walls.map((w) => w.id), ...set.openings.map((o) => o.id)];
}

export function kindOf(set: CandidateSet, id: string): CandKind | null {
  if (set.walls.some((w) => w.id === id)) return 'wall';
  const o = set.openings.find((x) => x.id === id);
  return o ? o.kind : null;
}

/** Ids in the set's order (walls first) with the wall of every chosen opening added, duplicates dropped. */
export function withParents(set: CandidateSet, ids: Iterable<string>): string[] {
  const chosen = new Set(ids);
  for (const o of set.openings) if (chosen.has(o.id)) chosen.add(o.wall_id);
  return allIds(set).filter((id) => chosen.has(id));
}

export function byConfidence(set: CandidateSet, min: number): string[] {
  return withParents(set, [...set.walls.filter((w) => w.confidence >= min).map((w) => w.id), ...set.openings.filter((o) => o.confidence >= min).map((o) => o.id)]);
}

export function byKind(set: CandidateSet, kinds: CandKind[]): string[] {
  const k = new Set(kinds);
  return withParents(set, [...(k.has('wall') ? set.walls.map((w) => w.id) : []), ...set.openings.filter((o) => k.has(o.kind)).map((o) => o.id)]);
}

export function defaultStates(set: CandidateSet): Record<string, CandState> {
  return Object.fromEntries(allIds(set).map((id) => [id, 'accepted' as const]));
}

/** An endpoint of a candidate wall moved before accepting (desktop only); the same set when the wall is unknown. */
export function moveVertex(set: CandidateSet, id: string, index: number, p: Pt): CandidateSet {
  const i = set.walls.findIndex((w) => w.id === id);
  if (i < 0 || index < 0 || index >= set.walls[i].polyline.length) return set;
  const walls = set.walls.slice();
  walls[i] = { ...walls[i], polyline: walls[i].polyline.map((q, k) => (k === index ? clampPt(p) : q)) };
  return { ...set, walls };
}

// ---------------------------------------------------------------- the DXF hand-off (import screen -> editor)

const dxfKey = (versionId: string) => `sw.dxf-candidates.${versionId}`;

export function stashDxfCandidates(versionId: string, r: DetectResult): void {
  try {
    sessionStorage.setItem(dxfKey(versionId), JSON.stringify(r));
  } catch {
    /* no storage (node, a private window): the import screen keeps the result in memory instead */
  }
}

export function takeDxfCandidates(versionId: string): DetectResult | null {
  try {
    const raw = sessionStorage.getItem(dxfKey(versionId));
    if (!raw) return null;
    sessionStorage.removeItem(dxfKey(versionId));
    return JSON.parse(raw) as DetectResult;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: The candidates layer in `sw-plan-canvas.ts`**

The canvas keeps moving: the 0.1.83 hotfix (in the working tree while this plan was written) turned the structure drag into a `GeomDragMode` property with `GeomDragDetail.sx / sy`, added `cornerSnapPx` and `nearCorner`, and phase 2 adds the objects layer. Everything below is an **addition** with names of its own (`candidates`, `candidateStates`, `selectedCandidateId`, `candidateEditable`, `candHover`, `candDrag`, `candCache`, `renderCandidates`, `renderCandidateHits`, `pickCandidate`, `onCandDragStart`): apply it to the file as it is after phase 2, hooking into `render()` right after `${this.renderGeomHits()}`; never replace an existing member, and if a helper it relies on was renamed (`toPlan`, `viewport`, `dragMoved`, `ptsAttr`), use the current name.

Add to the imports: `import { candidatesDoc, type CandidateSet, type CandState } from './candidates';` (the file already imports `buildPrimitives`, `isClosedOutline`, `type GeometryDoc`, `type Primitive`, `type Pt` from `./geometry`).

After the `rulers` property add the properties and state:

```ts
  /** Plan Studio phase 3 (T086): detection candidates, drawn dashed in a layer of their own until accepted. */
  @property({ attribute: false }) candidates: CandidateSet | null = null;
  @property({ attribute: false }) candidateStates: Record<string, CandState> = {};
  @property() selectedCandidateId: string | null = null;
  /** Desktop: the end points of the selected candidate wall can be dragged before accepting. */
  @property({ type: Boolean }) candidateEditable = false;
  @state() private candHover: string | null = null;
  @state() private candDrag: { x: number; y: number } | null = null;
  private candCache: { set: CandidateSet; doc: GeometryDoc | null; w: number; h: number; prims: Primitive[] } | null = null;
```

Add the styles (inside `static styles = css\`…\``, after the `.geom-hits` rules):

```css
    .candidates {
      pointer-events: none;
    }
    .candidates .cwall {
      fill: none;
      stroke: var(--sw-map-candidate);
      stroke-linecap: butt;
      stroke-dasharray: 8 5;
      opacity: 0.85;
    }
    .candidates .cleaf,
    .candidates .carc,
    .candidates .cglass,
    .candidates .cgap {
      fill: none;
      stroke: var(--sw-map-candidate);
      stroke-dasharray: 5 4;
    }
    .candidates .cand.rejected {
      opacity: 0.28;
    }
    .candidates .cand.sel .cwall {
      opacity: 1;
      stroke-dasharray: none;
    }
    .candidates .cand.sel .cleaf,
    .candidates .cand.sel .carc,
    .candidates .cand.sel .cglass,
    .candidates .cand.sel .cgap {
      stroke-dasharray: none;
    }
    .cand-score rect {
      fill: var(--sw-surface);
      stroke: var(--sw-map-candidate);
    }
    .cand-score text {
      fill: var(--sw-text);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
    }
    .cand-hits .hit {
      fill: transparent;
      stroke: transparent;
      pointer-events: stroke;
      cursor: pointer;
    }
    .cand-hits .cvtx {
      fill: var(--sw-surface);
      stroke: var(--sw-map-candidate);
      pointer-events: all;
      cursor: grab;
    }
```

Add the render helpers (after `renderGeomHits`):

```ts
  /** Primitives of the candidate set on the shown document's dimensions; recomputed when the set, the document size or
   * the level changes (the level filter is not applied: candidates belong to the level the detect tool asked for). */
  private candidatePrims(set: CandidateSet): Primitive[] {
    const doc = this.geometry;
    if (!doc) return [];
    const c = this.candCache;
    if (c && c.set === set && c.doc === doc && c.w === this.planWidth && c.h === this.planHeight) return c.prims;
    const prims = buildPrimitives(candidatesDoc(doc, set), this.planWidth, this.planHeight);
    this.candCache = { set, doc, w: this.planWidth, h: this.planHeight, prims };
    return prims;
  }

  private candConfidence(set: CandidateSet, id: string): number {
    return set.walls.find((w) => w.id === id)?.confidence ?? set.openings.find((o) => o.id === id)?.confidence ?? 0;
  }

  /** Where the score pill sits: the middle of a wall's first part, the gap centre of an opening. */
  private candAnchor(prims: Primitive[], id: string): Pt | null {
    const p = prims.find((x) => x.id === id);
    if (!p) return null;
    if (p.kind === 'wall') {
      const a = p.points[0];
      const b = p.points[p.points.length - 1];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    if (p.kind === 'label') return [p.x, p.y];
    return [(p.gap[0][0] + p.gap[1][0]) / 2, (p.gap[0][1] + p.gap[1][1]) / 2];
  }

  private renderCandidates() {
    const set = this.candidates;
    if (!set) return nothing;
    const prims = this.candidatePrims(set);
    const inv = 1 / this.scale;
    const cls = (id: string) => `cand ${this.candidateStates[id] ?? 'accepted'} ${id === this.selectedCandidateId ? 'sel' : ''}`;
    const attrs = (id: string) => ({ state: this.candidateStates[id] ?? 'accepted', score: this.candConfidence(set, id).toFixed(2) });
    const shown = this.candHover ?? this.selectedCandidateId;
    const at = shown ? this.candAnchor(prims, shown) : null;
    const label = shown ? `ביטחון ${this.candConfidence(set, shown).toFixed(2)}` : '';
    const tw = (label.length * 7 + 16) * inv;
    return svg`<g class="candidates" data-candidates>
      ${prims.map((p) => {
        const a = attrs(p.id);
        switch (p.kind) {
          case 'wall':
            return svg`<g class=${cls(p.id)} data-candidate=${p.id} data-kind="wall" data-state=${a.state} data-score=${a.score}><polyline class="cwall" points=${ptsAttr(p.points)} stroke-width=${p.width} /></g>`;
          case 'door':
            return svg`<g class=${cls(p.id)} data-candidate=${p.id} data-kind="door" data-state=${a.state} data-score=${a.score}>
              ${p.leaves.map(([x, y]) => svg`<line class="cleaf" x1=${x[0]} y1=${x[1]} x2=${y[0]} y2=${y[1]} stroke-width=${1.6 * inv} />`)}
              ${p.arcs.map((arc) => svg`<path class="carc" d=${`M ${arc.from[0]} ${arc.from[1]} A ${arc.r} ${arc.r} 0 0 ${arc.sweep} ${arc.to[0]} ${arc.to[1]}`} stroke-width=${1.1 * inv} />`)}
            </g>`;
          case 'window':
            return svg`<g class=${cls(p.id)} data-candidate=${p.id} data-kind="window" data-state=${a.state} data-score=${a.score}>${p.lines.map(([x, y]) => svg`<line class="cglass" x1=${x[0]} y1=${x[1]} x2=${y[0]} y2=${y[1]} stroke-width=${1.6 * inv} />`)}</g>`;
          case 'passage':
            return svg`<g class=${cls(p.id)} data-candidate=${p.id} data-kind="passage" data-state=${a.state} data-score=${a.score}><line class="cgap" x1=${p.gap[0][0]} y1=${p.gap[0][1]} x2=${p.gap[1][0]} y2=${p.gap[1][1]} stroke-width=${inv} /></g>`;
          default:
            return nothing;
        }
      })}
      ${at ? svg`<g class="cand-score" data-cand-score data-cand-score-for=${shown ?? ''}><rect x=${at[0] - tw / 2} y=${at[1] - 22 * inv} width=${tw} height=${20 * inv} rx=${10 * inv} stroke-width=${inv} /><text x=${at[0]} y=${at[1] - 12 * inv} font-size=${12 * inv}>${label}</text></g>` : nothing}
    </g>`;
  }

  private pickCandidate(id: string, e: Event) {
    e.stopPropagation();
    if (this.dragMoved) return;
    this.dispatchEvent(new CustomEvent('candidate-select', { detail: { id }, bubbles: true, composed: true }));
  }

  private onCandDragStart(id: string, index: number, e: PointerEvent) {
    if (!this.candidateEditable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const rect0 = this.getBoundingClientRect();
    const start = this.toPlan(e.clientX - rect0.left, e.clientY - rect0.top);
    let moved = false;
    let last = start;
    this.viewport.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const p = this.toPlan(ev.clientX - rect0.left, ev.clientY - rect0.top);
      if (!moved && Math.hypot((p.x - start.x) * this.planWidth, (p.y - start.y) * this.planHeight) * this.scale < 3) return;
      moved = true;
      last = p;
      this.candDrag = { x: p.x, y: p.y };
    };
    const end = () => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', cancel);
      this.candDrag = null;
      this.dragMoved = true;
      setTimeout(() => (this.dragMoved = false), 0);
    };
    const up = () => {
      end();
      if (moved) this.dispatchEvent(new CustomEvent('candidate-drag', { detail: { id, index, x: +last.x.toFixed(5), y: +last.y.toFixed(5) }, bubbles: true, composed: true }));
    };
    const cancel = () => end();
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', cancel);
  }

  /** Wide invisible strokes over the candidates (a click toggles, hovering shows the score) and, on desktop, the end
   * handles of the selected candidate wall. Above the structure hits, below the markers. */
  private renderCandidateHits() {
    const set = this.candidates;
    if (!set) return nothing;
    const prims = this.candidatePrims(set);
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    const sel = set.walls.find((w) => w.id === this.selectedCandidateId);
    const drag = this.candDrag;
    return svg`<g class="cand-hits">
      ${prims.map((p) => {
        if (p.kind === 'label') return nothing;
        const over = () => (this.candHover = p.id);
        const out = () => (this.candHover = null);
        if (p.kind === 'wall') return svg`<polyline class="hit" data-cand-hit=${p.id} points=${ptsAttr(p.points)} stroke-width=${Math.max(p.width, 12 * inv)} @click=${(e: Event) => this.pickCandidate(p.id, e)} @pointerenter=${over} @pointerleave=${out} />`;
        return svg`<line class="hit" data-cand-hit=${p.id} x1=${p.gap[0][0]} y1=${p.gap[0][1]} x2=${p.gap[1][0]} y2=${p.gap[1][1]} stroke-width=${14 * inv} @click=${(e: Event) => this.pickCandidate(p.id, e)} @pointerenter=${over} @pointerleave=${out} />`;
      })}
      ${sel && this.candidateEditable ? sel.polyline.map((v, i) => svg`<circle class="cvtx" data-cand-vertex=${i} cx=${v[0] * W} cy=${v[1] * H} r=${6 * inv} stroke-width=${1.6 * inv} aria-label=${`קצה מועמד ${i + 1}`}
          @pointerdown=${(e: PointerEvent) => this.onCandDragStart(sel.id, i, e)} @click=${(e: Event) => e.stopPropagation()} />`) : nothing}
      ${drag ? svg`<circle class="gdrag" cx=${drag.x * W} cy=${drag.y * H} r=${5 * inv} stroke-width=${1.5 * inv} />` : nothing}
    </g>`;
  }
```

In `render()`, between `${this.renderGeomHits()}` and `${this.markers.map(...)}` insert:

```ts
            ${this.renderCandidates()}
            ${this.renderCandidateHits()}
```

- [ ] **Step 6: Icon and token**

In `sw-icon.ts` add to `PATHS` (after `logout`):

```ts
  sparkle: svg`<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>`,
```

In `tokens.css` add `--sw-map-candidate: #2f6bff;` right after the first `--sw-map-glass` line (design A) and `--sw-map-candidate: #2767ed;` after the second one (design B).

- [ ] **Step 7: Type check and run the node spec**

Run: in `frontend/`: `npx tsc --noEmit -p tsconfig.json` → exit 0; `npx playwright test tests/unit-plan-detect.spec.ts tests/unit-geometry.spec.ts tests/unit-studio-controller.spec.ts --project=desktop --reporter=line` → `13 passed` (4 new; the phase-1 node specs unchanged).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/api/geometry.ts frontend/src/api/types.ts frontend/src/map/candidates.ts frontend/src/map/sw-plan-canvas.ts frontend/src/components/sw-icon.ts frontend/src/styles/tokens.css frontend/tests/unit-plan-detect.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): candidate layer on the plan canvas, candidate-set operations, detect and DXF API clients (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 9: The editor's "זיהוי" tool — panel, run with progress, accept / reject / edit, confirm, the calibration hint, the auto badge

**Files:**
- Modify: `frontend/src/screens/plan-studio-panel.ts` (`renderDetectPanel`, the auto badge, styles)
- Modify: `frontend/src/screens/explore-plan-editor.ts` (the tool, its state and actions, canvas wiring)
- Modify: `frontend/src/shell/sw-app.ts` (`?candidates=` → `presetCandidates`)

**Interfaces:**
- Consumes: `detectStructure`, `acceptDetection`, `calibrateEstimate`, `DetectResult`, `DetectTarget`, `CalibrationHint` (`api/geometry.ts`); `fromResult`, `rescale`, `allIds`, `byConfidence`, `byKind`, `withParents`, `moveVertex`, `defaultStates`, `takeDxfCandidates`, `CandidateSet`, `CandState`, `CandKind` (`map/candidates.ts`); the canvas properties and events of Task 8; `StudioController.flush / load / revision`; `acceptZones` (`api/zones.ts`).
- Produces:
  - `plan-studio-panel.ts`: `DetectOpts`, `DetectRunState`, `DetectCandidatesView`, `DetectView`, `DetectActions`, `renderDetectPanel(v, a)`, `CAND_KIND_LABEL`; the selected wall / opening shows `[data-auto-badge]` when its source is not manual; the counts line shows `[data-studio-auto-count]`.
  - Editor: tool `detect` (`[data-tool="detect"]`, icon `sparkle`), panel `[data-detect-panel]` with `[data-detect-walls]`, `[data-detect-openings]`, `[data-detect-strength]`, `[data-detect-replace]`, `[data-detect-run]`, `[data-detect-elapsed]`, `[data-detect-error]`, `[data-detect-summary]`, `[data-calib-hint]`, `[data-calib-hint-apply]`, `[data-detect-accept-all]`, `[data-detect-accept-conf]`, `[data-detect-accept-kind="wall|door|window|passage"]`, `[data-detect-reject-all]`, `[data-cand-row="<id>"]`, `[data-detect-phone-note]`, `[data-detect-rooms]`, `[data-detect-confirm]`, `[data-detect-discard]`; `presetCandidates` property (`?candidates=dxf` opens the tool with the stashed DXF candidates).
  - Behaviour: candidates are drawn only while the detect tool is active; a click on a candidate toggles it (a rejected wall rejects its openings, an accepted opening accepts its wall); "אשר" flushes the draft, sends `detect/accept` with the accepted ids, the endpoint edits and `replace_auto`, then reloads the studio (`loadStudio(b, true)`); "השתמש בהערכה" PATCHes the estimate, reloads the studio and rescales the candidates to the new scale; on a phone (`max-width: 767px`) the endpoint drag is off and the panel says so.

- [ ] **Step 1: The panel — `plan-studio-panel.ts`**

Add to the imports: `import type { CalibrationHint } from '../api/geometry';` and `import type { CandidateSet, CandKind, CandState } from '../map/candidates';`. Append after `renderMeasurePanel`:

```ts
// ---------------------------------------------------------------- detection (phase 3, T086)

export interface DetectOpts {
  walls: boolean;
  openings: boolean;
  /** 0.3 (light) .. 1.0 (strong) morphology, the server's strength. */
  strength: number;
  replaceAuto: boolean;
}
export interface DetectRunState {
  busy: boolean;
  startedAt: number;
  /** Seconds since the request went out (the elapsed counter), or of the last run. */
  elapsed: number;
  error: string;
}
export interface DetectCandidatesView {
  source: 'detect' | 'dxf';
  set: CandidateSet;
  states: Record<string, CandState>;
  sel: string | null;
  hint: CalibrationHint | null;
  existingAuto: { walls: number; openings: number };
  elapsedMs: number | null;
  /** DXF only: room polygons offered to the zones layer. */
  rooms: number;
}
export interface DetectView {
  opts: DetectOpts;
  run: DetectRunState;
  cands: DetectCandidatesView | null;
  acceptedCount: number;
  hintApplied: boolean;
  busy: boolean;
  /** A phone: candidates can be accepted, not edited. */
  narrow: boolean;
  estimated: boolean;
  showEstimates: boolean;
  scale: number;
  /** Automatic / imported items already in the draft (the "replace" checkbox names the count). */
  autoInDraft: number;
}
export interface DetectActions {
  setOpts(o: DetectOpts): void;
  run(): void;
  acceptAll(): void;
  acceptAbove(min: number): void;
  acceptKinds(kinds: CandKind[]): void;
  rejectAll(): void;
  toggle(id: string): void;
  focus(id: string): void;
  confirm(): void;
  discard(): void;
  applyHint(): void;
  importRooms(): void;
}

export const CAND_KIND_LABEL: Record<CandKind, string> = { wall: 'קיר', door: 'דלת', window: 'חלון', passage: 'מעבר' };
const SOURCE_BADGE: Record<string, string> = { auto: 'זוהה אוטומטית', imported: 'יובא מ־DXF' };

/** The badge of a wall or opening that a detector produced (phase 3): source and confidence. */
export function renderSourceBadge(item: { source: string; confidence: number }): TemplateResult | typeof nothing {
  if (item.source === 'manual') return nothing;
  return html`<span class="badge" data-auto-badge=${item.source}>${SOURCE_BADGE[item.source] ?? item.source} · ביטחון ${item.confidence.toFixed(2)}</span>`;
}

function candKind(set: CandidateSet, id: string): CandKind {
  if (set.walls.some((w) => w.id === id)) return 'wall';
  return set.openings.find((o) => o.id === id)?.kind ?? 'wall';
}

function candScore(set: CandidateSet, id: string): number {
  return set.walls.find((w) => w.id === id)?.confidence ?? set.openings.find((o) => o.id === id)?.confidence ?? 0;
}

export function renderDetectPanel(v: DetectView, a: DetectActions): TemplateResult {
  const c = v.cands;
  const o = v.opts;
  return html`<sw-card heading="זיהוי אוטומטי" subheading="קירות, דלתות וחלונות מהתוכנית · עיבוד מקומי, ללא AI וללא שליחה החוצה" data-detect-panel>
    ${c
      ? renderCandidates(v, c, a)
      : html`<div class="note">הזיהוי מציע מועמדים בשכבה נפרדת (כחול מקווקו). דבר לא נשמר עד "אשר", ודבר לא מתפרסם בלי פרסום.</div>
          <div class="chks">
            <label class="chk"><input type="checkbox" data-detect-walls .checked=${o.walls} @change=${(e: Event) => { const on = (e.target as HTMLInputElement).checked; a.setOpts({ ...o, walls: on, openings: on && o.openings }); }} /> קירות</label>
            <label class="chk"><input type="checkbox" data-detect-openings .checked=${o.openings} ?disabled=${!o.walls} @change=${(e: Event) => a.setOpts({ ...o, openings: (e.target as HTMLInputElement).checked })} /> פתחים (דלתות, חלונות, מעברים)</label>
          </div>
          <sw-field label=${`עוצמת ניקוי: ${o.strength.toFixed(2)} (קל ← חזק)`}><input type="range" min="0.3" max="1" step="0.05" data-ltr data-detect-strength .value=${String(o.strength)}
            @input=${(e: Event) => a.setOpts({ ...o, strength: parseFloat((e.target as HTMLInputElement).value) })} /></sw-field>
          ${v.autoInDraft ? html`<label class="chk"><input type="checkbox" data-detect-replace .checked=${o.replaceAuto} @change=${(e: Event) => a.setOpts({ ...o, replaceAuto: (e.target as HTMLInputElement).checked })} /> החלף אוטומטיים קודמים (${v.autoInDraft} בטיוטה)</label>` : nothing}
          <div class="btns">
            <sw-button variant="primary" size="sm" icon="sparkle" data-detect-run ?disabled=${v.run.busy || !o.walls || v.busy} @click=${() => a.run()}>${v.run.busy ? html`מזהה… <span data-detect-elapsed>${v.run.elapsed}</span> שנ׳` : 'זהה אוטומטית'}</sw-button>
            ${v.run.busy ? html`<span class="note">הזיהוי רץ בשרת (עד 60 שניות); הכפתור ייפתח כשיסיים.</span>` : nothing}
          </div>
          ${v.run.error ? html`<div class="err" data-detect-error>${v.run.error}</div>` : nothing}`}
  </sw-card>`;
}

function renderCandidates(v: DetectView, c: DetectCandidatesView, a: DetectActions): TemplateResult {
  const set = c.set;
  const ids = [...set.walls.map((w) => w.id), ...set.openings.map((x) => x.id)];
  const kinds: CandKind[] = ['wall', 'door', 'window', 'passage'];
  const present = kinds.filter((k) => (k === 'wall' ? set.walls.length > 0 : set.openings.some((x) => x.kind === k)));
  const sel = c.sel ? { id: c.sel, kind: candKind(set, c.sel), score: candScore(set, c.sel) } : null;
  return html`<div class="note" data-detect-summary>${countLabel(set.walls.length, 'קיר אחד', 'קירות')} · ${countLabel(set.openings.length, 'פתח אחד', 'פתחים')}${set.objects.length ? ` · ${countLabel(set.objects.length, 'עצם אחד', 'עצמים')}` : ''} · ${v.acceptedCount} מסומנים לאישור${c.source === 'dxf' ? ' · מיובאים מ־DXF' : c.elapsedMs !== null ? ` · זוהו ב־${(c.elapsedMs / 1000).toFixed(1)} שנ׳` : ''}</div>
    ${c.hint && v.estimated && !v.hintApplied
      ? html`<div class="hint" data-calib-hint>
          <div>התוכנית לא מכוילת. לפי רוחב דלת אופייני (0.9 מ׳, ${countLabel(c.hint.doors, 'דלת אחת', 'דלתות')}): <strong>${fmtScale(c.hint.scale_m_per_px)}</strong> — משוער.</div>
          <div class="btns"><sw-button size="sm" icon="scale" data-calib-hint-apply ?disabled=${v.busy} @click=${() => a.applyHint()}>השתמש בהערכה</sw-button><span class="note">מומלץ לפני האישור: המידות במטרים של המועמדים יחושבו לפי ההערכה, ויוצגו עם ≈ עד כיול בשתי נקודות</span></div>
        </div>`
      : v.hintApplied
        ? html`<div class="note" data-calib-hint-applied>קנה מידה משוער נשמר (≈ ${fmtScale(v.scale)}); כיול בשתי נקודות יחליף אותו</div>`
        : nothing}
    <div class="modes" role="group" aria-label="קבלת מועמדים">
      <button data-detect-accept-all @click=${() => a.acceptAll()}>קבל הכול</button>
      <button data-detect-accept-conf @click=${() => a.acceptAbove(0.8)}>קבל מעל 0.8</button>
      ${present.map((k) => html`<button data-detect-accept-kind=${k} @click=${() => a.acceptKinds([k])}>${k === 'wall' ? 'רק קירות' : `רק ${CAND_KIND_LABEL[k]}ות`}</button>`)}
      <button data-detect-reject-all @click=${() => a.rejectAll()}>דחה הכול</button>
    </div>
    <div class="note">${v.narrow ? html`<span data-detect-phone-note>בטלפון אפשר לקבל או לדחות מועמדים; תיקון קצוות של קיר מועמד זמין במחשב בלבד.</span>` : 'לחיצה על מועמד במפה או ברשימה מקבלת / דוחה אותו; גרירת קצה של הקיר המסומן מתקנת אותו לפני האישור.'}</div>
    <div class="candlist" data-cand-list>
      ${ids.slice(0, 300).map((id) => {
        const k = candKind(set, id);
        const state = c.states[id] ?? 'accepted';
        return html`<div class="cand ${state} ${id === c.sel ? 'on' : ''}" data-cand-row=${id} data-cand-state=${state}>
          <input type="checkbox" aria-label="קבל" .checked=${state === 'accepted'} @change=${() => a.toggle(id)} />
          <button class="linkbtn" @click=${() => a.focus(id)}>${CAND_KIND_LABEL[k]}</button>
          <span class="muted ltr">${candScore(set, id).toFixed(2)}</span>
        </div>`;
      })}
      ${ids.length > 300 ? html`<div class="note">מוצגים 300 הראשונים ברשימה; במפה מוצגים כולם.</div>` : nothing}
    </div>
    ${sel ? html`<div class="note" data-cand-selected>${CAND_KIND_LABEL[sel.kind]} נבחר · ביטחון ${sel.score.toFixed(2)} · ${(c.states[sel.id] ?? 'accepted') === 'accepted' ? 'יאושר' : 'נדחה'}</div>` : nothing}
    ${c.existingAuto.walls + c.existingAuto.openings ? html`<label class="chk"><input type="checkbox" data-detect-replace .checked=${v.opts.replaceAuto} @change=${(e: Event) => a.setOpts({ ...v.opts, replaceAuto: (e.target as HTMLInputElement).checked })} /> החלף אוטומטיים קודמים (${c.existingAuto.walls + c.existingAuto.openings} בטיוטה)</label>` : nothing}
    ${c.rooms ? html`<div class="btns"><sw-button size="sm" icon="map" data-detect-rooms ?disabled=${v.busy} @click=${() => a.importRooms()}>ייבא ${countLabel(c.rooms, 'חדר אחד', 'חדרים')} כאזורים</sw-button></div>` : nothing}
    <div class="btns">
      <sw-button variant="primary" size="sm" icon="check" data-detect-confirm ?disabled=${v.busy || !v.acceptedCount} @click=${() => a.confirm()}>אשר ${v.acceptedCount}</sw-button>
      <sw-button variant="ghost" size="sm" data-detect-discard ?disabled=${v.busy} @click=${() => a.discard()}>בטל</sw-button>
    </div>
    <div class="note">האישור מוסיף לטיוטת המבנה בלבד; הצופים יראו את התוצאה אחרי פרסום.</div>`;
}
```

In `renderStudioPanel` change the counts line to name the automatic items:

```ts
    <div class="note" data-studio-counts>${countLabel(v.doc.walls.length, 'קיר אחד', 'קירות')} · ${countLabel(v.doc.openings.length, 'פתח אחד', 'פתחים')} · ${countLabel(v.doc.labels.length, 'תווית אחת', 'תוויות')}${autoCount(v.doc) ? html` · <span data-studio-auto-count>${autoCount(v.doc)} אוטומטיים / מיובאים</span>` : nothing}</div>
```

with, next to `countLabel`:

```ts
function autoCount(doc: GeometryDoc): number {
  return doc.walls.filter((w) => w.source !== 'manual').length + doc.openings.filter((o) => o.source !== 'manual').length;
}
```

In `renderWall` add `${renderSourceBadge(w)}` right after the `.selhead` div, and in `renderOpening` add `${renderSourceBadge(o)}` after its `.selhead` div. Append to `studioPanelStyles`:

```css
  .badge {
    display: inline-block;
    border: 1px solid var(--sw-map-candidate);
    color: var(--sw-accent-text);
    border-radius: var(--sw-r-pill);
    padding: 1px 8px;
    font-size: var(--sw-fs-sm);
    inline-size: fit-content;
  }
  .chks {
    display: grid;
    gap: 4px;
    margin-block-end: 6px;
  }
  .hint {
    border: 1px dashed var(--sw-map-candidate);
    border-radius: 8px;
    padding: 8px;
    margin-block: 8px;
    display: grid;
    gap: 6px;
    font-size: var(--sw-fs-sm);
  }
  .cand.rejected {
    opacity: 0.55;
  }
  .cand.on {
    outline: 2px solid var(--sw-map-candidate);
    outline-offset: 1px;
    border-radius: 6px;
  }
```

- [ ] **Step 2: The editor — `explore-plan-editor.ts`**

Imports: extend the `../api/geometry` import with `acceptDetection, calibrateEstimate, detectStructure, type DetectResult, type DetectTarget`; add `import { allIds, byConfidence, byKind, defaultStates, fromResult, moveVertex, rescale, takeDxfCandidates, withParents, type CandidateSet, type CandKind, type CandState } from '../map/candidates';`; extend the `./plan-studio-panel` import with `renderDetectPanel, type DetectOpts, type DetectRunState`; add `type GeomWall` to the `../map/geometry` import if not present.

The tool: `type Tool = 'select' | 'camera' | 'lights' | 'entity' | 'zones' | 'structure' | 'calibrate' | 'measure' | 'detect' | 'layers';`; in `TOOLS` insert before `layers`:

```ts
  { id: 'detect', icon: 'sparkle', label: 'זיהוי אוטומטי של קירות ופתחים', ready: true },
```

and `const STUDIO_TOOLS: Tool[] = ['structure', 'calibrate', 'measure', 'detect'];`.

Properties and state (after `presetEntity` and after `showEstimates`):

```ts
  /** `?candidates=dxf`: the import screen stashed DXF candidates for this version; the detect tool opens on them. */
  @property() presetCandidates = '';
```

```ts
  /** Plan Studio phase 3 (T086): the detect tool - options, the running request, the candidate set and its states. */
  @state() private detectOpts: DetectOpts = { walls: true, openings: true, strength: 0.6, replaceAuto: true };
  @state() private detectRun: DetectRunState = { busy: false, startedAt: 0, elapsed: 0, error: '' };
  @state() private cands: { set: CandidateSet; result: DetectResult; source: 'detect' | 'dxf' } | null = null;
  @state() private candStates: Record<string, CandState> = {};
  @state() private candSel: string | null = null;
  @state() private candEdits: Record<string, Partial<GeomWall>> = {};
  @state() private hintApplied = false;
  @state() private narrow = false;
  private mq = window.matchMedia('(max-width: 767px)');
  private onMq = () => (this.narrow = this.mq.matches);
  private elapsedTimer: ReturnType<typeof setInterval> | undefined;
```

`connectedCallback` gains `this.narrow = this.mq.matches; this.mq.addEventListener('change', this.onMq);` and `disconnectedCallback` gains `this.mq.removeEventListener('change', this.onMq); clearInterval(this.elapsedTimer);`.

In `loadStudio`, after `this.measurePts = [];` and before `return true;`:

```ts
      if (this.presetCandidates === 'dxf' && b.planVersionId) this.takeDxf(b.planVersionId);
```

`studioPlacing` excludes the detect tool (its clicks are candidate clicks, handled by the canvas hits):

```ts
  private get studioPlacing(): boolean {
    return this.studioOn && this.tool !== 'detect' && (this.tool !== 'structure' || this.studioMode !== 'select');
  }
```

`pickTool` gains, after `if (tool !== 'calibrate') …`: `if (tool !== 'detect') this.candSel = null;` (the candidate set survives a tool switch until confirmed or discarded).

Add the detection methods after `exportJson`:

```ts
  // ---- Plan Studio: detection (T086) ----

  private takeDxf(versionId: string) {
    const r = takeDxfCandidates(versionId);
    this.presetCandidates = '';
    if (!r) return;
    this.showCandidates(r, 'dxf');
    this.pickTool('detect');
  }

  /** A fresh candidate set: detected metres follow the document's effective scale (the server may have estimated one
   * from the walls); DXF metres are measured and stay. Everything starts accepted. */
  private showCandidates(r: DetectResult, source: 'detect' | 'dxf') {
    const doc = this.studio.doc;
    let set = fromResult(r);
    if (doc && source === 'detect') {
      const { scale } = effectiveScale(doc);
      if (set.scaleMPerPx === null || Math.abs(set.scaleMPerPx - scale) > scale * 1e-6) set = rescale(set, scale);
    }
    this.cands = { set, result: r, source };
    this.candStates = defaultStates(set);
    this.candSel = null;
    this.candEdits = {};
    this.hintApplied = false;
  }

  private async runDetect() {
    const b = this.bundle;
    if (!b?.planVersionId || this.detectRun.busy || !this.detectOpts.walls) return;
    if (!(await this.studio.flush())) {
      this.error = this.studio.error;
      return;
    }
    const targets: DetectTarget[] = this.detectOpts.openings ? ['walls', 'openings'] : ['walls'];
    const startedAt = Date.now();
    this.detectRun = { busy: true, startedAt, elapsed: 0, error: '' };
    clearInterval(this.elapsedTimer);
    this.elapsedTimer = setInterval(() => (this.detectRun = { ...this.detectRun, elapsed: Math.round((Date.now() - startedAt) / 1000) }), 500);
    try {
      const r = await detectStructure(b.planVersionId, { targets, strength: this.detectOpts.strength });
      this.showCandidates(r, 'detect');
      this.detectRun = { busy: false, startedAt: 0, elapsed: Math.round((Date.now() - startedAt) / 1000), error: '' };
    } catch (err) {
      this.detectRun = { busy: false, startedAt: 0, elapsed: 0, error: describeError(err) };
    } finally {
      clearInterval(this.elapsedTimer);
    }
  }

  /** A click toggles; a rejected wall takes its openings along, an accepted opening brings its wall back. */
  private toggleCandidate(id: string) {
    const set = this.cands?.set;
    if (!set) return;
    const next: CandState = (this.candStates[id] ?? 'accepted') === 'accepted' ? 'rejected' : 'accepted';
    const states = { ...this.candStates, [id]: next };
    if (next === 'rejected') for (const o of set.openings) if (o.wall_id === id) states[o.id] = 'rejected';
    else {
      const o = set.openings.find((x) => x.id === id);
      if (o) states[o.wall_id] = 'accepted';
    }
    this.candStates = states;
    this.candSel = id;
  }

  private acceptRule(ids: string[]) {
    const set = this.cands?.set;
    if (!set) return;
    const keep = new Set(withParents(set, ids));
    this.candStates = Object.fromEntries(allIds(set).map((id) => [id, keep.has(id) ? ('accepted' as const) : ('rejected' as const)]));
  }

  private get acceptedCandidateIds(): string[] {
    const set = this.cands?.set;
    if (!set) return [];
    return withParents(set, allIds(set).filter((id) => (this.candStates[id] ?? 'accepted') === 'accepted'));
  }

  private focusCandidate(id: string) {
    const b = this.bundle;
    const set = this.cands?.set;
    if (!b || !set) return;
    this.candSel = id;
    const w = set.walls.find((x) => x.id === id);
    const o = set.openings.find((x) => x.id === id);
    const host = o ? set.walls.find((x) => x.id === o.wall_id) : undefined;
    const at: Pt | null = w ? pointOnWall(w, 0.5, b.width, b.height) : host && o ? pointOnWall(host, o.t, b.width, b.height) : null;
    if (at) this.canvas?.centerOn(Math.min(1, Math.max(0, at[0])), Math.min(1, Math.max(0, at[1])));
  }

  private onCandidateDrag(d: { id: string; index: number; x: number; y: number }) {
    const c = this.cands;
    if (!c || this.narrow) return;
    const set = moveVertex(c.set, d.id, d.index, [d.x, d.y]);
    if (set === c.set) return;
    const w = set.walls.find((x) => x.id === d.id);
    if (!w) return;
    this.cands = { ...c, set };
    this.candEdits = { ...this.candEdits, [d.id]: { polyline: w.polyline } };
    this.candSel = d.id;
  }

  private discardCandidates() {
    this.cands = null;
    this.candStates = {};
    this.candSel = null;
    this.candEdits = {};
    this.hintApplied = false;
  }

  private async confirmCandidates() {
    const b = this.bundle;
    const c = this.cands;
    const ids = this.acceptedCandidateIds;
    if (!b?.planVersionId || !c || !ids.length || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      if (!(await this.studio.flush())) {
        this.error = this.studio.error;
        return;
      }
      await acceptDetection(b.planVersionId, { accepted: ids, edits: this.candEdits, replace_auto: this.detectOpts.replaceAuto,
        candidates: { walls: c.set.walls, openings: c.set.openings, objects: c.set.objects }, base_revision: this.studio.revision, detector: c.result.detector });
      this.discardCandidates();
      if (await this.loadStudio(b, true)) {
        this.info = `${ids.length} פריטים נוספו לטיוטת המבנה; בדוק ופרסם`;
        setTimeout(() => (this.info = ''), 4000);
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async applyCalibHint() {
    const b = this.bundle;
    const c = this.cands;
    const hint = c?.result.calibration_hint;
    if (!b?.planVersionId || !c || !hint || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      if (!(await this.studio.flush())) {
        this.error = this.studio.error;
        return;
      }
      const r = await calibrateEstimate(b.planVersionId, hint.scale_m_per_px, hint.reason);
      this.bundle = { ...b, scaleMPerPx: r.scale_m_per_px };
      await this.loadStudio(this.bundle, true);
      this.cands = { ...c, set: rescale(c.set, r.scale_m_per_px) };
      this.hintApplied = true;
      this.info = `קנה מידה משוער נשמר: ${fmtScale(r.scale_m_per_px)} (≈)`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async importDxfRooms() {
    const b = this.bundle;
    const rooms = this.cands?.result.rooms ?? [];
    if (!b || !rooms.length || this.busy) return;
    this.busy = true;
    try {
      const r = await acceptZones(b.floorId, rooms.map((x) => ({ polygon: x.polygon, name: x.name })), false);
      this.zones = r.zones;
      this.cands = this.cands ? { ...this.cands, result: { ...this.cands.result, rooms: [] } } : null;
      this.info = `${rooms.length} חדרים נוספו כאזורים; תן להם שמות בכלי "חדרים ואזורים"`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderDetectPanel(b: MapBundle) {
    const doc = this.studio.doc;
    if (!doc || !b.planVersionId) {
      return html`<sw-card heading="זיהוי אוטומטי" data-detect-panel><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: הזיהוי עובד מול השרת.' : this.error || 'טוען את טיוטת המבנה…'}</div></sw-card>`;
    }
    const { scale, estimated } = effectiveScale(doc);
    const c = this.cands;
    return renderDetectPanel(
      {
        opts: this.detectOpts, run: this.detectRun,
        cands: c ? { source: c.source, set: c.set, states: this.candStates, sel: this.candSel, hint: c.result.calibration_hint, existingAuto: c.result.existing_auto, elapsedMs: c.result.elapsed_ms ?? null, rooms: c.result.rooms?.length ?? 0 } : null,
        acceptedCount: this.acceptedCandidateIds.length, hintApplied: this.hintApplied, busy: this.busy, narrow: this.narrow, estimated, showEstimates: this.showEstimates, scale,
        autoInDraft: doc.walls.filter((w) => w.source !== 'manual').length + doc.openings.filter((o) => o.source !== 'manual').length,
      },
      {
        setOpts: (o) => (this.detectOpts = o),
        run: () => void this.runDetect(),
        acceptAll: () => { if (c) this.acceptRule(allIds(c.set)); },
        acceptAbove: (min) => { if (c) this.acceptRule(byConfidence(c.set, min)); },
        acceptKinds: (kinds: CandKind[]) => { if (c) this.acceptRule(byKind(c.set, kinds)); },
        rejectAll: () => this.acceptRule([]),
        toggle: (id) => this.toggleCandidate(id),
        focus: (id) => this.focusCandidate(id),
        confirm: () => void this.confirmCandidates(),
        discard: () => this.discardCandidates(),
        applyHint: () => void this.applyCalibHint(),
        importRooms: () => void this.importDxfRooms(),
      },
    );
  }
```

In `renderToolPanel` add, after the `measure` line: `if (this.tool === 'detect') return this.renderDetectPanel(b);`.

In `studioClick` add as the first statement after the guards: `if (this.tool === 'detect') return;` and in `onPlanHover` treat `detect` like a non-placing tool (the `studioPlacing` change above already makes `hover` null).

Canvas wiring: in `render()`, add to the `<sw-plan-canvas …>` element, after the `.rulers=${this.rulers}` line:

```ts
                  .candidates=${this.tool === 'detect' && this.cands ? this.cands.set : null} .candidateStates=${this.candStates} .selectedCandidateId=${this.candSel} .candidateEditable=${this.tool === 'detect' && !this.narrow}
                  @candidate-select=${(e: CustomEvent<{ id: string }>) => this.toggleCandidate(e.detail.id)}
                  @candidate-drag=${(e: CustomEvent<{ id: string; index: number; x: number; y: number }>) => this.onCandidateDrag(e.detail)}
```

Also the `Delete` key in `handleStudioKey`: before the `geomSel` branch add

```ts
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.tool === 'detect' && this.candSel) {
      e.preventDefault();
      if ((this.candStates[this.candSel] ?? 'accepted') === 'accepted') this.toggleCandidate(this.candSel);
      return true;
    }
```

- [ ] **Step 3: The route parameter — `sw-app.ts`**

Change the editor line to pass the parameter:

```ts
        if (s[1] === 'floors' && s[3] === 'edit') return html`<explore-plan-editor .floorId=${s[2]} .presetEntity=${r.params.get('entity') ?? ''} .presetCandidates=${r.params.get('candidates') ?? ''}></explore-plan-editor>`;
```

- [ ] **Step 4: Type check, build, look at it**

Run: in `frontend/`: `npx tsc --noEmit -p tsconfig.json` → exit 0 (fix every `noUnusedLocals` complaint by using or removing the symbol; do not silence with underscores); `npm run build` → exit 0. Then restart the developer backend (Task 6's routes must be running), open `http://127.0.0.1:4173/?design=a#/explore/floors/<a floor with a plan>/edit`, pick the sparkle tool, run a detection and check: the button disables with a counter, candidates appear dashed blue, hovering shows the score pill, a click toggles, "קבל מעל 0.8" dims the rest, "אשר" adds the items and the structure panel shows the badge on a selected wall. Not a test; the live spec of Task 11 is.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/plan-studio-panel.ts frontend/src/screens/explore-plan-editor.ts frontend/src/shell/sw-app.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): the detect tool in the plan editor - run with progress, candidate accept / reject / edit, confirm into the draft, the door-width calibration hint, source badges (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 10: The DXF mapping screen in the import flow

**Files:**
- Modify: `frontend/src/screens/explore-plan-import.ts`

**Interfaces:**
- Consumes: `getDxfEntities`, `importDxfGeometry`, `DxfEntities`, `DxfTarget`, `DetectResult` (`api/geometry.ts`); `stashDxfCandidates` (`map/candidates.ts`); `navigate(path, params)` (`router.ts`); the editor's `presetCandidates` (Task 9).
- Produces: a card `[data-dxf-map]` in step 4 ("שמירה ופרסום") of a DXF asset once its version is saved: the layer table (`[data-dxf-map-row="<layer>"]` with `[data-dxf-map-target]` selects, the suggested target preselected), the block table (`[data-dxf-block-row="<block>"]` with `[data-dxf-block-target]` selects of the catalog choices, the suggestion preselected), a units warning `[data-dxf-map-units]` when the drawing has no units, and `[data-dxf-import]` "ייבא כמועמדים", which stashes the candidates for the version and opens the editor with `?candidates=dxf`.

- [ ] **Step 1: State and loading**

Add to the imports of `explore-plan-import.ts`:

```ts
import { getDxfEntities, importDxfGeometry, type DetectResult, type DxfEntities, type DxfTarget } from '../api/geometry';
import { stashDxfCandidates } from '../map/candidates';
```

Add the state after `previewBust`:

```ts
  /** T086: the DXF entity summary of the saved version's asset, the mapping being edited and the import in flight. */
  @state() private dxfEnt: DxfEntities | null = null;
  @state() private layerMap: Record<string, DxfTarget> = {};
  @state() private blockMap: Record<string, string | null> = {};
  @state() private importing = false;
  @state() private imported: DetectResult | null = null;
```

In `updated(changed)` add, after the existing DXF branch:

```ts
    if ((changed.has('version') || changed.has('asset')) && isApi()) {
      const a = this.asset;
      if (this.version && a && a.kind === 'dxf' && this.version.asset_id === a.id && (!this.dxfEnt || this.dxfEnt.asset_id !== a.id)) void this.loadDxfEntities(a.id);
      else if (!this.version || !a || a.kind !== 'dxf') this.dxfEnt = null;
    }
```

Add the methods after `applyDxf`:

```ts
  private async loadDxfEntities(assetId: string) {
    try {
      const ent = await getDxfEntities(assetId);
      this.dxfEnt = ent;
      this.layerMap = Object.fromEntries(ent.layers.map((l) => [l.name, l.suggested]));
      this.blockMap = Object.fromEntries(ent.blocks.map((b) => [b.name, b.suggested.catalog_id]));
      this.imported = null;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async importDxf() {
    const v = this.version;
    const ent = this.dxfEnt;
    if (!v || !ent || this.importing) return;
    this.importing = true;
    this.error = '';
    try {
      const layer_map = Object.fromEntries(Object.entries(this.layerMap).filter(([, t]) => t !== 'ignore'));
      const r = await importDxfGeometry(v.id, { layer_map, block_map: this.blockMap });
      this.imported = r;
      stashDxfCandidates(v.id, r);
      navigate(`/explore/floors/${this.floorId}/edit`, { candidates: 'dxf' });
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.importing = false;
    }
  }
```

- [ ] **Step 2: The card**

Add the render function after `renderDxf`:

```ts
  /** T086: layers and blocks of the drawing mapped to structure candidates for the saved version (design 9.4). */
  private renderDxfMap() {
    const ent = this.dxfEnt;
    const v = this.version;
    if (!ent || !v) return nothing;
    const unitless = ent.metres_per_unit === null;
    const mapped = Object.values(this.layerMap).filter((t) => t !== 'ignore').length;
    return html`<sw-card heading="DXF · מיפוי שכבות ובלוקים למבנה" subheading="שכבות → קירות / דלתות / חלונות / עצמים / חדרים; בלוקים → פריטי ספרייה. התוצאה נכנסת לעורך כמועמדים, לא לטיוטה" data-dxf-map>
      ${unitless ? html`<div class="err" data-dxf-map-units>לקובץ אין יחידות: בחר יחידות בכרטיס "DXF · שכבות, יחידות וקנה מידה", לחץ "החל ורנדר מחדש" ושמור גרסה חדשה - רק אז המידות במטרים אמיתיות.</div>` : html`<div class="note">יחידות: ${ent.units} · המידות ייכנסו במטרים אמיתיים (measured)</div>`}
      <table class="map">
        <thead><tr><th>שכבה</th><th>ישויות</th><th>דוגמה</th><th>יעד</th></tr></thead>
        <tbody>
          ${ent.layers.map((l) => html`<tr data-dxf-map-row=${l.name} class=${l.count ? '' : 'muted'}>
            <td class="ltr">${l.name}${l.in_render ? '' : html` <span class="note">(לא מצוירת)</span>`}</td>
            <td class="ltr">${l.count}${l.count ? html` <span class="note">${Object.entries(l.kinds).map(([k, n]) => `${k} ${n}`).join(', ')}</span>` : ''}</td>
            <td class="ltr">${l.sample}</td>
            <td><select data-dxf-map-target aria-label=${`יעד לשכבה ${l.name}`} ?disabled=${!l.count} @change=${(e: Event) => (this.layerMap = { ...this.layerMap, [l.name]: (e.target as HTMLSelectElement).value as DxfTarget })}>
              ${ent.targets.map((t) => html`<option value=${t.id} ?selected=${(this.layerMap[l.name] ?? 'ignore') === t.id}>${t.label}</option>`)}
            </select></td>
          </tr>`)}
        </tbody>
      </table>
      ${ent.blocks.length
        ? html`<div class="note" style="margin-block-start:8px">בלוקים (${ent.blocks.length}) - לשכבות שמופו ל"עצמים":</div>
            <table class="map">
              <thead><tr><th>בלוק</th><th>מופעים</th><th>מידות (מ׳)</th><th>פריט</th></tr></thead>
              <tbody>
                ${ent.blocks.map((b) => html`<tr data-dxf-block-row=${b.name}>
                  <td class="ltr">${b.name}</td>
                  <td class="ltr">${b.count}</td>
                  <td class="ltr">${b.size_m[0].toFixed(2)} × ${b.size_m[1].toFixed(2)}</td>
                  <td><select data-dxf-block-target aria-label=${`פריט לבלוק ${b.name}`} @change=${(e: Event) => (this.blockMap = { ...this.blockMap, [b.name]: (e.target as HTMLSelectElement).value || null })}>
                    ${ent.catalog_choices.map((c) => html`<option value=${c.id ?? ''} ?selected=${(this.blockMap[b.name] ?? null) === c.id}>${c.name}</option>`)}
                  </select></td>
                </tr>`)}
              </tbody>
            </table>`
        : nothing}
      <div class="row" style="margin-block-start:8px">
        <sw-button variant="primary" size="sm" icon="sparkle" data-dxf-import ?disabled=${unitless || this.importing || !mapped} @click=${() => this.importDxf()}>${this.importing ? 'מייבא…' : 'ייבא כמועמדים'}</sw-button>
        <span class="note">${mapped} שכבות ממופות · העורך ייפתח עם המועמדים בשכבה מקווקווה; שם מאשרים או דוחים</span>
      </div>
      ${this.imported ? html`<div class="ok" data-dxf-imported>${this.imported.walls.length} קירות · ${this.imported.openings.length} פתחים · ${this.imported.objects?.length ?? 0} עצמים · ${this.imported.rooms?.length ?? 0} חדרים הועברו לעורך</div>` : nothing}
    </sw-card>`;
  }
```

Add to `static styles`:

```css
    table.map {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    table.map th,
    table.map td {
      text-align: start;
      padding: 4px 6px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    table.map tr.muted {
      color: var(--sw-text-2);
    }
    table.map select {
      font: inherit;
      max-inline-size: 140px;
    }
```

In `renderStep()`'s `default:` case, after the `.row` with the save / publish buttons, add `${this.asset?.kind === 'dxf' ? this.renderDxfMap() : nothing}`.

- [ ] **Step 3: Type check and build**

Run: in `frontend/`: `npx tsc --noEmit -p tsconfig.json` → exit 0; `npm run build` → exit 0. Then, with the developer backend running, import a DXF (the phase-0 `frontend/tests/evidence-dxf.spec.ts` shows the flow) and check the card appears after "שמור כטיוטה", the selects carry the suggestions, and "ייבא כמועמדים" lands in the editor with the detect tool open and the candidates drawn.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/screens/explore-plan-import.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): DXF mapping card in the import flow - layers and blocks to structure candidates, handed to the editor (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 11: Performance pass and the live evidence spec

**Files:**
- Create: `frontend/tests/evidence-plan-studio-3.spec.ts`
- Modify (only if the measurements require it): `smplwise_vms/backend/smplwise/services/plan_detect.py`

**Interfaces:**
- Consumes: the whole phase; the synthetic fixture `smplwise_vms/backend/tests/fixtures/plan_detect/apartment.png` as the live plan; the data attributes of Tasks 8–10.
- Produces: measured timings (the evidence line of Task 12), the live spec with four tests in real Chrome.

- [ ] **Step 1: Measure the detector on the synthetic set, calibrated and not**

```bash
cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY - <<'EOF' | tee "$SP/detect_timing.txt"
import sys, statistics
sys.path.insert(0, "tests")
import plan_detect_metrics as pm
from smplwise.services import plan_detect as pd
for cal in (True, False):
    rows = pm.run_set(pd.detect, calibrated=cal)
    print("calibrated" if cal else "uncalibrated", pm.summary_line(rows))
    for r in rows:
        print(f"  {r['name']:10s} {r['ms']:5d} ms  walls R={r['walls']['recall']:.3f} P={r['walls']['precision']:.3f}  doors {r['doors']['found']}/{r['doors']['total']}  windows {r['windows']['found']}/{r['windows']['total']}")
    print("  median ms", int(statistics.median(r["ms"] for r in rows)), "max ms", max(r["ms"] for r in rows))
EOF
```

Expected: every plan under 8000 ms on this workstation (the prototype measured 2100–4900 ms; thinning is the bulk). If a plan exceeds 8 s, profile it (`python -X importtime` is not the tool; use `cProfile` on `pd.detect` for that plan) and act only inside `plan_detect.py`: the two levers are `thin` (crop to the bounding box is already there; the next is to skip the second sub-iteration's neighbour recount when the first deleted nothing) and the probe pass (`TILT_PX` 800 → 640). Never raise the thresholds of the baseline test to make a slow plan pass; if the 15 s budget cannot be met, stop and report it.

- [ ] **Step 2: Check the guard end to end**

With the developer backend running, `curl -s -X POST -H "Content-Type: application/json" -d '{"strength":1.0}' http://127.0.0.1:8099/api/v1/plan-versions/<a version of a floor with the apartment fixture>/detect | python -c "import sys,json; d=json.load(sys.stdin); print(d['elapsed_ms'], len(d['walls']), len(d['openings']))"` → the elapsed time and the counts; a second call while the first runs answers on its own (the pool has two workers; a third waits for one). The 60 s guard is `Settings.detect_timeout_s` (the dataclass default; not an add-on option in this phase - recorded as a known limit in the checklist).

- [ ] **Step 3: Write the live spec**

`frontend/tests/evidence-plan-studio-3.spec.ts`:

```ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plan Studio phase 3 (T086) against the running developer backend: the detect tool on the synthetic apartment plan
// (the committed fixture of the baseline test), the door-width calibration hint, the DXF mapping screen. The spec
// builds its own site / building / floor and removes them at the end. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'tests', 'fixtures', 'plan_detect', 'apartment.png');
const ids = { site: '', building: '', floor: '', version: '', asset: '' };
let api: APIRequestContext;
let estimatesBefore: string | null = null;

/** A drawing in metres: the outer walls as double lines 0.2 m apart, a partition at x = 6 with a 0.9 m door arc. */
function dxfText(): string {
  const line = (layer: string, a: [number, number], b: [number, number]) => `0\nLINE\n8\n${layer}\n10\n${a[0]}\n20\n${a[1]}\n30\n0\n11\n${b[0]}\n21\n${b[1]}\n31\n0\n`;
  const walls: [[number, number], [number, number]][] = [[[0, 0], [12, 0]], [[12, 0], [12, 8]], [[12, 8], [0, 8]], [[0, 8], [0, 0]],
    [[0.2, 0.2], [11.8, 0.2]], [[11.8, 0.2], [11.8, 7.8]], [[11.8, 7.8], [0.2, 7.8]], [[0.2, 7.8], [0.2, 0.2]], [[6, 0.2], [6, 7.8]]];
  const arc = `0\nARC\n8\nA-DOOR\n10\n6\n20\n4\n30\n0\n40\n0.9\n50\n0\n51\n90\n`;
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${walls.map(([a, b]) => line('A-WALL', a, b)).join('')}${arc}0\nENDSEC\n0\nEOF\n`;
}

async function clickPlan(page: Page, screen: string, x: number, y: number) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}

test.describe.serial('plan studio phase 3 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173/' });
    estimatesBefore = (await (await api.get('api/v1/settings')).json()).settings['plan.estimates'];
    expect((await api.patch('api/v1/settings', { data: { 'plan.estimates': 'true' } })).status(), 'plan.estimates pinned').toBe(200);
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת זיהוי ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת בדיקה', level: 0 } })).json()).id;
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(FIXTURE) } } })).json();
    ids.asset = asset.id;
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      if (estimatesBefore) expect((await api.patch('api/v1/settings', { data: { 'plan.estimates': estimatesBefore } })).status(), 'plan.estimates restored').toBe(200);
      if (ids.floor) expect((await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status(), 'test building removed').toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status(), 'test site removed').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('detect candidates, accept by confidence, toggle, confirm: the draft gains automatic walls and viewers see nothing until a publish', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas`)).toBeAttached({ timeout: 20000 });
    await page.locator(`${ed} [data-tool="detect"]`).click();
    await expect(page.locator(`${ed} [data-detect-panel]`)).toBeAttached();
    const detected = page.waitForResponse((r) => r.url().endsWith('/detect') && r.request().method() === 'POST', { timeout: 65000 });
    await page.locator(`${ed} [data-detect-run]`).click();
    expect((await detected).status()).toBe(200);
    await expect(page.locator(`${ed} [data-detect-summary]`)).toContainText('קירות');
    const walls = page.locator(`${ed} sw-plan-canvas [data-candidates] [data-candidate][data-kind="wall"]`);
    await expect(walls).toHaveCount(7); // the apartment fixture: four outer walls and three partitions
    await expect(page.locator(`${ed} sw-plan-canvas [data-candidates] [data-candidate][data-kind="door"]`)).toHaveCount(4);
    await expect(page.locator(`${ed} sw-plan-canvas [data-candidates] [data-candidate][data-kind="window"]`)).toHaveCount(3);
    await page.locator(`${ed} sw-plan-canvas [data-cand-hit]`).first().hover();
    await expect(page.locator(`${ed} sw-plan-canvas [data-cand-score]`)).toBeAttached();
    await expect(page.locator(`${ed} sw-plan-canvas [data-cand-score] text`)).toContainText('ביטחון');
    await page.locator(`${ed} [data-detect-accept-conf]`).click();
    await expect(page.locator(`${ed} [data-cand-row][data-cand-state="rejected"]`).first()).toBeAttached(); // the two-line window scores 0.75
    await page.locator(`${ed} [data-detect-accept-all]`).click();
    await expect(page.locator(`${ed} [data-cand-row][data-cand-state="rejected"]`)).toHaveCount(0);
    const rows = page.locator(`${ed} [data-cand-row]`);
    const rejected = page.locator(`${ed} [data-cand-row][data-cand-state="rejected"]`);
    await rows.first().locator('input').click(); // the first row is a wall: its openings go with it
    await expect(rows.first()).toHaveAttribute('data-cand-state', 'rejected');
    const afterWall = await rejected.count();
    expect(afterWall).toBeGreaterThanOrEqual(1);
    await rows.first().locator('input').click(); // the wall comes back; its openings stay rejected until chosen
    await expect(rows.first()).toHaveAttribute('data-cand-state', 'accepted');
    await expect(rejected).toHaveCount(afterWall - 1);
    await page.locator(`${ed} [data-detect-accept-all]`).click();
    const accepted = page.waitForResponse((r) => r.url().endsWith('/detect/accept'));
    await page.locator(`${ed} [data-detect-confirm]`).click();
    expect((await accepted).status()).toBe(200);
    await expect(page.locator(`${ed} sw-plan-canvas [data-candidates]`)).toHaveCount(0);
    await expect(page.locator(`${ed} sw-plan-canvas [data-structure] [data-wall]`).first()).toBeAttached({ timeout: 10000 });
    expect(await page.locator(`${ed} sw-plan-canvas [data-structure] [data-wall]`).count()).toBeGreaterThanOrEqual(10); // seven walls cut by their openings
    const draft = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json();
    expect(draft.doc.walls.length).toBe(7);
    expect(draft.doc.walls.every((w: { source: string }) => w.source === 'auto')).toBe(true);
    expect(draft.doc.openings.length).toBe(7);
    expect(draft.doc.meta.last_detection.accepted).toEqual({ walls: 7, openings: 7, objects: 0 });
    expect((await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).status()).toBe(404); // nothing published
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await expect(page.locator(`${ed} [data-studio-auto-count]`)).toContainText('14');
    await page.locator(`${ed} [data-studio-mode="select"]`).click();
    await clickPlan(page, ed, 0.5, 0.1); // the top wall of the apartment (y = 120 / 1200)
    await expect(page.locator(`${ed} [data-selected-wall]`)).toBeAttached();
    await expect(page.locator(`${ed} [data-auto-badge="auto"]`)).toContainText('זוהה אוטומטית');
  });

  test('the door-width hint becomes an estimated calibration: metres show with the approximate sign', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas [data-structure] [data-wall]`).first()).toBeAttached({ timeout: 20000 });
    await page.locator(`${ed} [data-tool="detect"]`).click();
    const detected = page.waitForResponse((r) => r.url().endsWith('/detect') && r.request().method() === 'POST', { timeout: 65000 });
    await page.locator(`${ed} [data-detect-run]`).click();
    expect((await detected).status()).toBe(200);
    await expect(page.locator(`${ed} [data-calib-hint]`)).toContainText('משוער');
    const patched = page.waitForResponse((r) => r.url().includes('/calibration') && r.request().method() === 'PATCH');
    await page.locator(`${ed} [data-calib-hint-apply]`).click();
    expect((await patched).status()).toBe(200);
    await expect(page.locator(`${ed} [data-calib-hint-applied]`)).toContainText('≈');
    const v = await (await api.get(`api/v1/plan-versions/${ids.version}`)).json();
    expect(v.calibration.status).toBe('estimated');
    expect(v.calibration.method).toBe('door_width');
    expect(Math.abs(v.scale_m_per_px / 0.01 - 1)).toBeLessThan(0.06); // the fixture draws 90 px doors: 0.9 m / 90 px
    await page.locator(`${ed} [data-detect-discard]`).click();
    await expect(page.locator(`${ed} [data-detect-run]`)).toBeAttached();
    await page.locator(`${ed} [data-tool="measure"]`).click();
    await clickPlan(page, ed, 0.075, 0.1);
    await clickPlan(page, ed, 0.925, 0.1);
    await expect(page.locator(`${ed} [data-measure-distance]`)).toContainText('≈'); // estimated, not measured
    await expect(page.locator(`${ed} [data-measure-distance]`)).toContainText('13.'); // 0.85 x 1600 px x ~0.01 m/px
  });

  test('DXF: the import screen maps the layers and hands the candidates to the editor', async ({ page }) => {
    const im = 'explore-plan-import';
    const dxf = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'walls.dxf', mimeType: 'application/octet-stream', buffer: Buffer.from(dxfText()) } } })).json();
    expect(dxf.kind).toBe('dxf');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/import`);
    await page.locator(`${im} .assets button`, { hasText: 'walls.dxf' }).click();
    await expect(page.locator(`${im} [data-dxf]`)).toBeAttached({ timeout: 20000 });
    await page.locator(`${im} sw-button`, { hasText: 'הבא' }).click();
    await page.locator(`${im} sw-button`, { hasText: 'הבא' }).click();
    const saved = page.waitForResponse((r) => r.url().endsWith('/plan-versions') && r.request().method() === 'POST');
    await page.locator(`${im} sw-button`, { hasText: 'שמור כטיוטה' }).click();
    expect((await saved).status()).toBe(201);
    await expect(page.locator(`${im} [data-dxf-map]`)).toBeAttached({ timeout: 20000 });
    await expect(page.locator(`${im} [data-dxf-map-row="A-WALL"] select`)).toHaveValue('walls');
    await expect(page.locator(`${im} [data-dxf-map-row="A-DOOR"] select`)).toHaveValue('openings');
    const imported = page.waitForResponse((r) => r.url().endsWith('/import-dxf-geometry'));
    await page.locator(`${im} [data-dxf-import]`).click();
    expect((await imported).status()).toBe(200);
    await expect(page).toHaveURL(/candidates=dxf/);
    const ed = 'explore-plan-editor';
    await expect(page.locator(`${ed} [data-detect-summary]`)).toContainText('DXF', { timeout: 20000 });
    await expect(page.locator(`${ed} sw-plan-canvas [data-candidates] [data-candidate][data-kind="wall"]`)).toHaveCount(5); // four paired outer walls, one partition
    await expect(page.locator(`${ed} sw-plan-canvas [data-candidates] [data-candidate][data-kind="door"]`)).toHaveCount(1);
    const accepted = page.waitForResponse((r) => r.url().endsWith('/detect/accept'));
    await page.locator(`${ed} [data-detect-confirm]`).click();
    expect((await accepted).status()).toBe(200);
    const versions = (await (await api.get(`api/v1/floors/${ids.floor}/plan-versions`)).json()).versions as { id: string; status: string; asset_id: string }[];
    const draftVersion = versions.find((v) => v.status === 'draft' && v.asset_id === dxf.id)!;
    const g = await (await api.get(`api/v1/plan-versions/${draftVersion.id}/geometry?draft=true`)).json();
    expect(g.doc.walls.length).toBe(5);
    expect(g.doc.walls.every((w: { source: string }) => w.source === 'imported')).toBe(true);
    expect(g.doc.openings[0].kind).toBe('door');
    expect(Math.abs(g.doc.openings[0].width_m - 0.9)).toBeLessThan(0.02);
    expect(g.doc.dimensions.calibration.status).toBe('measured'); // the DXF units gave the version its scale
  });

  test('phone: detection is available, candidate editing is not', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas`)).toBeAttached({ timeout: 20000 });
    await page.locator(`${ed} [data-tool="detect"]`).click();
    const detected = page.waitForResponse((r) => r.url().endsWith('/detect') && r.request().method() === 'POST', { timeout: 65000 });
    await page.locator(`${ed} [data-detect-run]`).click();
    expect((await detected).status()).toBe(200);
    await expect(page.locator(`${ed} [data-detect-phone-note]`)).toContainText('במחשב בלבד');
    await page.locator(`${ed} [data-cand-row]`).first().locator('button').click(); // select the first candidate
    await expect(page.locator(`${ed} sw-plan-canvas [data-cand-vertex]`)).toHaveCount(0); // no end handles on a phone
    await page.locator(`${ed} [data-detect-discard]`).click();
  });
});
```

- [ ] **Step 4: Run it in real Chrome**

```bash
cd /c/cloude/smplwisebms/frontend && npm run build && bash "$SP/restart_dev.sh"
SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-3.spec.ts --project=desktop --workers=1 --reporter=line
```

Expected: `4 passed`. Notes for a failure: the first test's counts (7 / 4 / 3) are the apartment fixture's exact structure and the backend's `max_render_px` (3000 on the developer backend) keeps the fixture at 1600 px; if the developer backend runs with a smaller `max_render_px`, the counts can differ - restart it with the default. The DXF test depends on the import screen's "already uploaded" list and its step buttons (phase 0 / T065); if a selector changed there since, adapt the selector, not the flow. The phone test relies on the tools rail being reachable at 390 px: if the existing layout hides it, record the phone behaviour as NOT_RUN in Task 12 rather than restyling the editor in this phase.

Then the neighbours, for the baseline the release compares against:

```bash
SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts tests/evidence-editor.spec.ts tests/evidence-plan-versions.spec.ts tests/evidence-dxf.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/neighbours_0185_t11.txt" 2>&1; tail -n 5 "$SP/neighbours_0185_t11.txt"
```

Expected: the same results as before this branch (run the same command on `g0/intake` once if no baseline file exists in `$SP`; a failure naming the NVR / go2rtc / HA is BLOCKED, anything else is fixed before Task 12).

- [ ] **Step 5: Commit**

```bash
git add frontend/tests/evidence-plan-studio-3.spec.ts smplwise_vms/backend/smplwise/services/plan_detect.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
test(plan-studio): live evidence for detection, the calibration hint, the DXF mapping screen and the phone; timing pass (T086)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

(`git add` of an unchanged `plan_detect.py` is a no-op; keep it in the command for the case the timing pass touched it.)

---

### Task 12: Release 0.1.85 — full verification, version, records, owner checklist (stop after the release commit)

**Files:**
- Modify: `smplwise_vms/config.yaml`, `smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` (0.1.85)
- Modify: `smplwise_vms/CHANGELOG.md`, `contracts/API_INVENTORY.md` (generated), `smplwise_vms/www/` (generated by `build:addon`)
- Modify: `management/tasks.json`, `management/test_catalog.json` and the generated views (`scripts/project_status.py --write`)
- Create: `docs/operations/PLAN_STUDIO_PHASE3_CHECKLIST_HE.md`
- Modify: `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (implementation line)

**Interfaces:**
- Consumes: everything above; phase 2's release left the tree at 0.1.84.
- Produces: the release commit of 0.1.85 on `pilot/T086-plan-studio-3`; T086 evidenced; AT171 / AT172 recorded. **This task ends at the release commit: no merge, no push, no store reload - the controller does those.**

- [ ] **Step 1: Version bump and the generated API inventory**

```bash
cd /c/cloude/smplwisebms
sed -i 's/^version: "0.1.84"/version: "0.1.85"/' smplwise_vms/config.yaml
sed -i 's/io.hass.version="0.1.84"/io.hass.version="0.1.85"/' smplwise_vms/Dockerfile
sed -i 's/__version__ = "0.1.84"/__version__ = "0.1.85"/' smplwise_vms/backend/smplwise/__init__.py
grep -c '0\.1\.85' smplwise_vms/config.yaml smplwise_vms/Dockerfile smplwise_vms/backend/smplwise/__init__.py
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/api_inventory.py
grep -c "detect\|dxf/entities\|import-dxf-geometry" contracts/API_INVENTORY.md
```

Expected: each file reports `1`; the inventory is rewritten at 0.1.85 with the four new routes (`POST /plan-versions/{id}/detect`, `POST …/detect/accept`, `GET /plan-assets/{id}/dxf/entities`, `POST /plan-versions/{id}/import-dxf-geometry`); the grep prints at least `4`. (If the tree is not at 0.1.84 when this task starts - phase 2 shipped under another number - use that number in the three `sed` patterns; the target stays 0.1.85.)

- [ ] **Step 2: The whole backend suite, the golden file, the private scans**

```bash
cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest -p no:cacheprovider > "$SP/pytest_0185.txt" 2>&1; echo "exit $?"; tail -n 3 "$SP/pytest_0185.txt"
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/geometry_golden.py --check; echo "golden $?"
cd /c/cloude/smplwisebms && MSYS_NO_PATHCONV=1 $PY scripts/plan_detect_private.py | tee "$SP/private_0185.txt"
MSYS_NO_PATHCONV=1 $PY -m pytest smplwise_vms/backend/tests/test_plan_detect_baseline.py -p no:cacheprovider -s 2>&1 | grep "plans:" | tee "$SP/baseline_0185.txt"
```

Expected: `exit 0` and `N passed` (phase 2's count plus this plan's 27 new tests in seven files; if the number differs, count the new tests and explain the difference in the evidence line); `golden 0`; the private script prints either the per-plan lines and its summary (numbers only) or `skipped: no private plans`; the baseline line, for example `6 plans: walls recall >= 0.974, precision >= 0.969; doors 23/23; windows 15/15; slowest 4900 ms`.

- [ ] **Step 3: The whole frontend check**

In `frontend/`:
- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npx playwright test tests/unit-geometry.spec.ts tests/unit-studio-controller.spec.ts tests/unit-plan-detect.spec.ts --project=desktop --reporter=line` → `13 passed`
- `npm run build`, then `bash "$SP/restart_dev.sh"` (prints `me: 200` and the new listener pid)
- `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-3.spec.ts --project=desktop --workers=1 --reporter=line` → `4 passed`
- `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts tests/evidence-editor.spec.ts tests/evidence-plan-versions.spec.ts tests/evidence-dxf.spec.ts tests/evidence-zones.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/neighbours_0185.txt"` → the same results as the Task 11 baseline; a failure that also fails in the baseline and names the NVR / go2rtc / HA (ConnectTimeout, source_unavailable) is BLOCKED, anything else is fixed before continuing
- `bash "$SP/fixture_chain.sh"` → `fixtures exit: 0` and the same count as phase 2's baseline (the editor rail gained a tool, so the demo screenshots of the editor change on purpose)
- `npm run build:addon` → writes `smplwise_vms/www`

- [ ] **Step 4: CHANGELOG**

Insert at the top of `smplwise_vms/CHANGELOG.md`, right after the `# Changelog — SMPLWISE VMS add-on` line and its blank line:

```markdown
## 0.1.85 (pilot) — Plan Studio phase 3: automatic detection of walls, doors and windows; DXF layers and blocks as candidates
- The plan editor gains a "זיהוי" tool (T086, CR-003): a local detector - Otsu, morphology, Zhang–Suen thinning,
  skeleton tracing, Douglas–Peucker, axis snapping, a chamfer distance transform for the thickness, door arcs and
  window lines sampled in the thin ink - proposes walls, doors, windows and passages as candidates with a confidence
  score, drawn dashed in a layer of their own. Nothing leaves the add-on, no model is involved, no new dependency
  (numpy and Pillow only), and nothing is stored or published by the detector: "אשר" merges what a person kept into
  the structure draft ("קבל הכול", "קבל מעל 0.8", "קבל לפי סוג", a click toggles, an end of a candidate wall can be
  dragged first, "החלף אוטומטיים קודמים" replaces an earlier run); accepted items carry a source badge in the panel.
- A plan that was never calibrated receives a calibration hint from its door widths (the median single door taken as
  0.9 m); "השתמש בהערכה" records it as an estimated calibration, so every metre shows "≈" until a two-point
  calibration replaces it (design 6.3).
- DXF drawings skip the raster path: the import flow shows every layer with its entity count, a sample and a suggested
  target (walls / doors / windows / objects / rooms) and every block with a suggested library item; "ייבא כמועמדים"
  turns double lines into walls with their real thickness, arcs into doors with the drawing's swing, window lines
  into windows and blocks into objects, all in real metres, and opens them in the editor's candidates layer. Room
  outlines go to the rooms layer through the existing zones accept.
- A committed synthetic test-plan set (six 1600 px plans with ground truth, generated by a script) pins the
  baseline: walls >= 90 % of the length (precision >= 80 %), doors >= 80 %, windows >= 60 %, under 15 s per plan;
  the release measured [paste the baseline summary line of Step 2]. Real scans stay private; the same metrics run on
  them locally (scripts/plan_detect_private.py).
- API: `POST /plan-versions/{id}/detect` (synchronous, a worker thread with a 60 s guard, 504 `detect_timeout`),
  `POST …/detect/accept` (the draft's revision rules, 409 `stale_revision`), `GET /plan-assets/{id}/dxf/entities`,
  `POST /plan-versions/{id}/import-dxf-geometry`; `PATCH …/calibration` accepts an estimate; audit `geometry.detect`,
  `geometry.detect.accept`, `geometry.import`. No migration.
- Evidence: seven new backend test files (the fixtures, the primitives, walls, openings, the baseline, the API, the
  DXF mapping), one node unit spec, the live spec `evidence-plan-studio-3` (four tests in real Chrome: detection and
  accept, the calibration hint, the DXF mapping screen, the phone).

```

Replace `[paste the baseline summary line of Step 2]` with the line in `$SP/baseline_0185.txt` (numbers only).

- [ ] **Step 5: Records (only after Steps 1–3 are green)**

```bash
cd /c/cloude/smplwisebms && cat > "$SP/record_t086.py" <<'EOF'
"""Record the Plan Studio phase 3 evidence (T086 and its acceptance tests) at the tested commit. Numbers only: the
private-scan summary is quoted when the script produced one, never a file name."""
import datetime
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(r"C:\cloude\smplwisebms\management")
SP = pathlib.Path(sys.argv[1])
summary = re.search(r"(\d+) passed", (SP / "pytest_0185.txt").read_text(encoding="utf-8", errors="replace"))
if not summary:
    sys.exit("no pytest summary line")
N = summary.group(1)
baseline = (SP / "baseline_0185.txt").read_text(encoding="utf-8", errors="replace").strip().splitlines()[-1]
private_lines = [l.strip() for l in (SP / "private_0185.txt").read_text(encoding="utf-8", errors="replace").splitlines() if l.strip()]
private = "no private scans on this workstation (skipped)" if any("skipped" in l for l in private_lines) else "; ".join(l for l in private_lines if "plans:" in l or "uncalibrated" in l)
commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True, cwd=ROOT.parent).strip()
today = datetime.date.today().isoformat()
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
env = f"workstation: dev backend 0.1.85 (SQLite) on 8099 + vite preview 4173, Chrome through Playwright; pytest on Python 3.12 ({today})"
tasks = json.loads((ROOT / "tasks.json").read_text(encoding="utf-8"))
tests = json.loads((ROOT / "test_catalog.json").read_text(encoding="utf-8"))
by_task = {t["id"]: t for t in tasks}
by_test = {t["id"]: t for t in tests}
t086 = (f"{today} (0.1.85): Plan Studio phase 3 on commit {commit} - services/plan_detect.py (numpy only: Otsu, morphology, chamfer distance transform, "
        "Zhang-Suen thinning, skeleton tracing, Douglas-Peucker, axis snapping at 4 degrees, collinear merging, thickness and kind, door arcs, double doors, "
        "passages, windows by the ink-thickness profile, confidence, tilt straightening, the door-width calibration hint), services/plan_dxf_map.py "
        "(layers and blocks to candidates, double lines to walls, arcs to doors, window lines, blocks to objects, room polygons); API: POST detect "
        "(worker thread, 60 s guard, 504 detect_timeout, audit geometry.detect), POST detect/accept (edits, replace_auto, re-issued ids, 409 stale_revision, "
        "meta.last_detection, audit geometry.detect.accept), GET dxf/entities, POST import-dxf-geometry (audit geometry.import), PATCH calibration with an "
        "estimate (status estimated, method door_width); the editor's detect tool with the candidates layer, accept by confidence / kind, endpoint drag, "
        "confirm into the draft, source badges; the DXF mapping card in the import flow. Candidates are never stored and never published. "
        f"Synthetic baseline (committed set of six plans, ground truth): {baseline}. Private scans: {private}. Tests: {N} backend passed (7 new files), "
        "13 node unit tests, evidence-plan-studio-3 4/4 live in real Chrome, neighbour specs as their baselines, fixture chain green.")
t = by_task["T086"]
t["evidence"].append(t086)
# status stays BACKLOG: the registry (scripts/project_status.py, AGENTS.md rule) refuses DONE and IN_PROGRESS while a dependency (T084) is BACKLOG;
# implementation evidence is not acceptance (phase-1 ruling R-T15-2) - progress.py counts the "on commit" wording of the evidence line
t["blocker"] = None
t["commit"] = commit
t["owner"] = t["owner"] or "Claude Code (tech lead); approver: product owner"
EVIDENCE = {
    "AT171": ["smplwise_vms/backend/tests/test_plan_detect_walls.py, test_plan_detect_openings.py (local detection of walls, doors, windows, passages; no network, no model)",
              "smplwise_vms/backend/tests/test_plan_dxf_map.py (DXF layer and block mapping, routes)",
              "smplwise_vms/backend/tests/test_plan_detect_api.py (candidates returned, not stored; accept merges into the draft; nothing published; audit)",
              "frontend/tests/evidence-plan-studio-3.spec.ts (accept / reject / edit screen, confirm, viewers see nothing until publish, DXF import screen)"],
    "AT172": [f"smplwise_vms/backend/tests/test_plan_detect_baseline.py on the committed synthetic set: {baseline} (thresholds walls >= 0.90, doors >= 0.80, windows >= 0.60, <= 15 s)",
              f"scripts/plan_detect_private.py on private scans: {private}",
              "smplwise_vms/backend/tests/test_plan_detect_api.py::test_calibration_estimate_is_an_estimated_calibration and frontend/tests/evidence-plan-studio-3.spec.ts (the door-width hint is recorded as estimated and shown with the approximate sign)"],
}
for aid, ev in EVIDENCE.items():
    x = by_test[aid]
    x.update({"status": "PASS", "commit": commit, "environment": env, "evidence": ev, "executed_at": now})
(ROOT / "tasks.json").write_text(json.dumps(tasks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
(ROOT / "test_catalog.json").write_text(json.dumps(tests, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print("recorded at", commit)
EOF
MSYS_NO_PATHCONV=1 $PY "$SP/record_t086.py" "$SP" && MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/project_status.py --write
```

If any check in Steps 2–3 is not green, do not run the script: leave T086 BACKLOG, write the failing check into its `blocker` field and report it. If the phone test of the live spec was recorded NOT_RUN (Task 11), say so in the T086 evidence line before running the script (edit the `t086` string: replace `4/4` with `3/4 (phone NOT_RUN: the rail is not reachable at 390 px)`).

- [ ] **Step 6: Owner checklist and the design document line**

Create `docs/operations/PLAN_STUDIO_PHASE3_CHECKLIST_HE.md`:

```markdown
# סטודיו התוכנית — שלב 3: בדיקה אצל הבעלים (גרסה 0.1.85)

לכל סעיף: עבר / נכשל, והערה קצרה. אין צורך ב־NVR; מספיקה קומה עם תוכנית סרוקה (PDF או תמונה), ולסעיפים 10–12 קובץ DXF.

| # | מה עושים | מה אמור לקרות |
|---|---|---|
| 1 | "בדוק עדכון" בחנות התוספים ועדכון ל־0.1.85 | הגרסה מותקנת והמערכת עולה |
| 2 | קומה עם תוכנית ← עריכה ← הכלי החדש "זיהוי" (ניצוץ) בסרגל | פאנל "זיהוי אוטומטי" עם "קירות", "פתחים", מחוון עוצמה וכפתור "זהה אוטומטית" |
| 3 | "זהה אוטומטית" | הכפתור ננעל ומראה מונה שניות; תוך שניות (עד דקה) מופיעים מועמדים בכחול מקווקו על המפה, והפאנל מסכם "N קירות · M פתחים" |
| 4 | ריחוף ולחיצה על מועמד במפה | ריחוף מציג "ביטחון 0.xx"; לחיצה מסמנת/מבטלת (מועמד דחוי מתעמעם); דחיית קיר דוחה גם את הפתחים שלו |
| 5 | "קבל מעל 0.8", "רק קירות", "קבל הכול", "דחה הכול" | הרשימה והמפה מתעדכנות בהתאם; המונה ב"אשר N" משתנה |
| 6 | במחשב: בחירת קיר מועמד ברשימה וגרירת קצה שלו במפה | הקצה זז לפני האישור (בטלפון מופיעה הודעה שהעריכה במחשב בלבד) |
| 7 | "אשר" | המועמדים הופכים לקירות ופתחים רגילים בטיוטה; בפאנל "מבנה" הספירה מציינת "אוטומטיים / מיובאים"; קיר שנבחר מציג תג "זוהה אוטומטית · ביטחון" |
| 8 | צופה (בלי הרשאת עריכה) פותח את המפה לפני פרסום | לא רואה את הקירות שזוהו; אחרי "פרסום המבנה" — רואה |
| 9 | תוכנית שלא כוילה: אחרי זיהוי, בפאנל מופיע "לפי רוחב דלת אופייני… משוער" ← "השתמש בהערכה" | קנה מידה משוער נשמר; כלי המדידה מציג מטרים עם ≈; כיול בשתי נקודות מחליף אותו |
| 10 | זיהוי חוזר עם "החלף אוטומטיים קודמים" מסומן ← "אשר" | הקירות מהזיהוי הקודם מוחלפים; קירות שצוירו ידנית נשארים |
| 11 | ייבוא תוכנית ← קובץ DXF ← בחירת יחידות (אם הקובץ בלי) ← "שמור כטיוטה" | כרטיס "DXF · מיפוי שכבות ובלוקים": טבלת שכבות עם ספירה, דוגמה ויעד מוצע; טבלת בלוקים עם פריט מוצע |
| 12 | "ייבא כמועמדים" | העורך נפתח עם הכלי "זיהוי" והמועמדים מה־DXF (קירות בעובי אמיתי, דלתות עם כיוון פתיחה, חלונות, עצמים); "אשר" מכניס אותם לטיוטה; "ייבא חדרים כאזורים" מוסיף חדרים לכלי "חדרים ואזורים" |
| 13 | סריקה גרועה (רעש, סיבוב קל) | הזיהוי עדיין מציע קירות; מה שלא נכון נדחה בלחיצה; הזמן עד דקה, אחרת הודעת "הזיהוי לא הסתיים בזמן" |
| 14 | אופציונלי: הסריקה האמיתית שלך (לא נשמרת במאגר) — ספור כמה מהקירות והדלתות זוהו | יעד המפרט: לפחות 90% מהקירות ו־80% מהדלתות אחרי אישור בלחיצה אחת; רשום את המספרים בטופס, לא תמונות |

**חשוב לדעת:** הזיהוי מקומי לחלוטין (ללא AI וללא שליחה החוצה), לא שומר ולא מפרסם דבר: רק "אשר" מכניס לטיוטה, ורק
"פרסום המבנה" מראה לצופים. מגבלות ידועות: פתחים מעוגלים מזוהים כמלבן; קיר בפינה פנימית של מתאר בצורת L מסומן "פנימי"
ולא "חיצוני" (ניתן לשינוי בפאנל); זמן הגרד (60 שניות) אינו הגדרה בתוסף בגרסה זו.
```

In `docs/architecture/PLAN_STUDIO_DESIGN_HE.md`, extend the `**מימוש:**` line (it names phases 1 and 2 after phase 2's release) by appending, before its final period or as a new sentence:

```markdown
שלב 3 (T086) מומש בגרסה 0.1.85; רשימת הבדיקה לבעלים: `docs/operations/PLAN_STUDIO_PHASE3_CHECKLIST_HE.md`. הבדלים שנרשמו במימוש שלב 3: `GET /plan-assets/{id}/dxf/entities` דורש map.import כמו שאר נתיבי הקבצים (בטבלה בסעיף 5 כתוב map.read); פרופיל העובי לחלונות (9.3) נמדד על הדיו הגולמי ולא על מסכת הקירות; תוכנית לא מכוילת נאמדת לפי עובי הקיר החציוני (0.2 מ׳) לצורכי הזיהוי בלבד; יישור הטיה של סריקה (עד 4°) נוסף לפני ההצמדה לצירים; ציון הביטחון של קיר לא כולל את גורם החדר (9.1 שלב 5).
```

- [ ] **Step 7: The release commit — and stop**

```bash
cd /c/cloude/smplwisebms && git add -A
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 || echo "SECRET SCAN FAILED - do not commit"
git status --short | head -40
msg=$(mktemp) && cat > "$msg" <<'EOF'
release: 0.1.85 - Plan Studio phase 3 (T086, CR-003): local detection of walls, doors and windows, DXF mapping, accept screen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
git log --oneline -1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev_cleanup.ps1 -StopBackend
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/progress.py
```

Expected: `git status` shows only this plan's files (no `private-evidence/`, `secrets/` or `data/`; the fixture PNGs and JSON are meant to be there); the commit lands on `pilot/T086-plan-studio-3`; the progress table shows T086 done. **Do not merge, push or reload the store** - report the commit hash, the test counts, the baseline line and the private-scan summary (numbers only), and stop.

---

## Self-Review

**1. Spec coverage** (design `PLAN_STUDIO_DESIGN_HE.md`, phase 3 of section 14, and the rulings):

| Design section / ruling | Where |
|---|---|
| 2 principle 3: candidates with confidence and source `auto`; a person accepts; nothing automatic is published | Tasks 3–6 (`source: "auto"`, `confidence`), Task 6 (accept into the draft only), Task 11 (viewers get 404 after an accept) |
| 2a: the same map, the same editor, the same canvas | Task 8 (the layer lives in `sw-plan-canvas`), Task 9 (a tool in the existing rail) |
| 4.2: candidates are document-v2 items | Tasks 3–5 (walls, openings), Task 7 (objects after 4.2), Task 6 (structural validation before the merge) |
| 5: `POST …/detect`, `POST …/detect/accept`, `GET /plan-assets/{id}/dxf/entities`, `POST …/import-dxf-geometry`; the 2026-09-24 amendment | Tasks 6, 7 (the permission of the entities route recorded as a difference) |
| 6.3: the door-width hint, estimated, "≈" | Task 4 (the hint), Task 6 (the estimate calibration), Task 9 (apply), Task 11 (measure shows "≈") |
| 7: the "זיהוי" tool row and the constants (autosave, undo, publish with diff) | Task 9 (the tool; the draft's autosave and revision rules are reused through `flush()` / `load()`) |
| 9.1 walls | Tasks 2, 3 |
| 9.2 doors | Task 4 |
| 9.3 windows | Task 5 (profile on the raw ink, recorded) |
| 9.4 DXF | Task 7, Task 10 |
| 9.5 candidates, the accept screen, the AI hook (`detector: {name, version, params}`) | Task 6 (`detector` at the top level, stored as `meta.last_detection.detector`), Task 9 (the screen); an external analyser that returns the same shape enters the same screen |
| 9.6 performance: numpy only, 1600 px, ≤ 15 s, 60 s timeout, synchronous with a progress indicator | Tasks 3–5 (1600 px, numpy), Task 5 (the ≤ 15 s assertion), Task 6 (the guard), Task 9 (the counter), Task 11 (the measurement) |
| 13: synthetic plans generated in the test, ≥ 90 % walls / ≥ 80 % doors, no false positives on the frame; real plans as a private baseline | Task 1 (the committed set and harness), Task 5 (the assertions; precision ≥ 80 %), Task 5 / Task 12 (the private script and the numbers-only evidence) |
| 14 phase 3 deliverables: `plan_detect.py`, `plan_dxf_map.py`, the accept screen, the hint, the test set with a baseline | Tasks 1–12 |
| 15 risks: numpy only, scan quality | Task 3 (pre-opening against speckle, tilt straightening), Task 11 (timing) |
| 16 decision 6: synchronous with a timeout, no jobs | Task 6 |
| Ruling 1 (fixtures, metrics, thresholds, private script) | Tasks 1, 5 |
| Ruling 2 (pure function, worker thread, 504, audit, not stored, ids `auto-`, `detector`, `calibration_hint`) | Tasks 3, 6 |
| Ruling 3 (accept body and semantics) | Task 6 |
| Ruling 4 (the algorithms) | Tasks 2–5 |
| Ruling 5 (the hint and the estimate route) | Tasks 4, 6, 9 |
| Ruling 6 (DXF mapping, no ezdxf added) | Task 7 (`requirements.txt` already lists `ezdxf>=1.3,<2`) |
| Ruling 7 (the tool, its panel and actions, the DXF screen, phone) | Tasks 8, 9, 10, 11 |
| Ruling 8 (release, stop after the commit) | Task 12 |
| Ruling 9 (copy, tooling, live specs) | Global Constraints; Task 11 |

No phase-3 requirement is left without a task. The differences from the design document are listed under "Interpretations and recorded differences" and written into the design document's implementation line in Task 12.

**2. Placeholder scan:** every code step carries the full code and every command is exact. The run-time values are read from files by the release script: the backend test count (`pytest_0185.txt`), the baseline summary (`baseline_0185.txt`), the private-scan lines (`private_0185.txt`). The CHANGELOG's `[paste the baseline summary line of Step 2]` is the one deliberate blank, filled in Task 12 Step 4 from the same file.

**3. Type and name consistency:** checked across tasks in the table below.

## Appendix: Consistency table

One row per pair of tasks that share a file or an interface, then one row per task confirming its tests match its code.

| # | Tasks | Shared thing | Both sides |
|---|---|---|---|
| C1 | 1 ↔ 3, 4, 5 | The detect result shape the harness scores | `plan_detect_metrics.evaluate(gt, result)` reads `result["walls"][i]["polyline"]` / `["id"]` and `result["openings"][i]["wall_id"]` / `["t"]` / `["kind"]`; `detect()` emits exactly those keys (Task 3 walls, Tasks 4–5 openings); `run_set` calls `detect_fn(png, scale_m_per_px=…)` and `detect` takes `scale_m_per_px` as a keyword |
| C2 | 1 ↔ 11 | The fixture path | `smplwise_vms/backend/tests/fixtures/plan_detect/apartment.png` (Task 1) is what the live spec uploads (`FIXTURE` in Task 11) |
| C3 | 2 ↔ 3 | The primitives | Task 3's `_stage` calls `chamfer_dt(mask)`, `thin(mask)`; `_segments` calls `trace_branches(skel)`; all defined in Task 2 with those names and array conventions (`(x, y)` pixel tuples in branches, `skel` boolean) |
| C4 | 3 ↔ 4 | `classify_gap` | Task 3's `walls_from_gaps` calls `classify_gap(g0, g1, d, t_ref, s, calibrated, thin_mask, ink)` and reads `kind`, `swing`, `hinge`, `confidence`, `width_px` from the answer; Task 4's function has that signature and returns those keys (or None) |
| C5 | 3 ↔ 5 | `windows_by_profile` | Task 3's `detect` calls `windows_by_profile(walls, openings, chamfer_dt(an["ink"]), an["ink_d"], s)` and expects items with `wall_seg` and `t`; Task 5's function has that signature and adds both keys |
| C6 | 4 ↔ 5 | `_lines_along` | Written once in Task 4 (`(g0, d, length, nl, t_ref, ink) -> int`), used by Task 4's `classify_gap` and Task 5's `windows_by_profile` with the same argument order |
| C7 | 5 ↔ 12 | The baseline summary | `plan_detect_metrics.summary_line` (Task 1) is printed by `test_baseline_on_the_synthetic_set` (Task 5) and quoted by the release (Task 12 Step 2 / 5) |
| C8 | 3–5 ↔ 6 | `detect()` from the router | Task 6 calls `plan_detect.detect(png, targets=…, strength=…, scale_m_per_px=…, level_id=…, run_id=…)` and reads `result["walls"]`, `["openings"]`, `["detector"]["params"]["tilt_deg"]`; Task 3's signature and result keys match; `plan_detect.TARGETS` is the tuple the router validates against |
| C9 | 6 ↔ 7 | Accepting imported candidates | `merge_candidates` accepts ids with `CANDIDATE_PREFIXES = ("auto-", "imp-")` and `source in ("auto", "imported")`; Task 7's ids are `imp-<run>-w001 / o001 / x001` with `source: "imported"`; the route test of Task 7 accepts them through `/detect/accept` |
| C10 | 6 ↔ 8 | JSON ↔ TypeScript | `DetectResult` (Task 8) has `walls, openings, objects?, rooms?, detector, calibration_hint, pixels, scale, stats, version_id, level_id, existing_auto, elapsed_ms?` = the keys of Task 6's detect response (`{**result, version_id, level_id, existing_auto, elapsed_ms}`) and Task 7's import response; `AcceptRequest` = `AcceptIn` (`accepted, edits, replace_auto, candidates{walls, openings, objects?}, base_revision, detector`); `calibrateEstimate` sends `{estimate: {scale_m_per_px, method, reason}}` = `EstimateIn`; `CalibrationResult.status` = the route's `status` |
| C11 | 7 ↔ 8 | `DxfEntities` | Task 8's type (`asset_id, units, metres_per_unit, layers[{name, count, kinds, sample, suggested, in_render}], blocks[{name, count, size_m, suggested{catalog_id, name}}], targets[{id, label}], catalog_choices[{id, name}]`) = Task 7's entities route; `importDxfGeometry` body `{layer_map, block_map, level_id?}` = `DxfImportIn` |
| C12 | 8 ↔ 9 | Canvas ↔ editor | Properties `candidates`, `candidateStates`, `selectedCandidateId`, `candidateEditable` and events `candidate-select {id}`, `candidate-drag {id, index, x, y}` are set / listened to in Task 9's `render()` with those names; `candidates.ts` exports (`fromResult, rescale, allIds, byConfidence, byKind, withParents, moveVertex, defaultStates, takeDxfCandidates, stashDxfCandidates`) are the names Tasks 9 and 10 import |
| C13 | 9 ↔ 10 | The DXF hand-off | Task 10 calls `stashDxfCandidates(v.id, r)` then `navigate('/explore/floors/<id>/edit', { candidates: 'dxf' })`; `sw-app.ts` passes `?candidates=` as `presetCandidates` (Task 9); `loadStudio` calls `takeDxfCandidates(b.planVersionId)` for the same version id (the draft version the editor loads is the one the import screen saved) |
| C14 | 9 ↔ 11 | Selectors of the live spec | `[data-tool="detect"]`, `[data-detect-panel]`, `[data-detect-run]`, `[data-detect-summary]`, `[data-candidates] [data-candidate][data-kind]`, `[data-cand-hit]`, `[data-cand-score]`, `[data-detect-accept-conf]`, `[data-detect-accept-all]`, `[data-cand-row][data-cand-state]`, `[data-detect-confirm]`, `[data-detect-discard]`, `[data-calib-hint]`, `[data-calib-hint-apply]`, `[data-calib-hint-applied]`, `[data-detect-phone-note]`, `[data-cand-vertex]`, `[data-studio-auto-count]`, `[data-auto-badge]` all exist in Tasks 8–9's templates |
| C15 | 10 ↔ 11 | Selectors of the DXF test | `[data-dxf]` (phase 0), `[data-dxf-map]`, `[data-dxf-map-row="<layer>"] select`, `[data-dxf-import]` exist in Task 10; the step buttons "הבא" / "שמור כטיוטה" are the existing import screen's |
| C16 | 6, 7 ↔ 12 | The API inventory | Four new routes; Task 12 Step 1 greps for them after regenerating |
| C17 | 7 ↔ phase 2 | Object candidates | Task 7's object fields follow design 4.2; when T085's `_check_fields("objects")` is on the branch, run `test_plan_dxf_map.py` and, if the structural check refuses an imported object, add the missing fields in `map_geometry` (never relax the validator); the API test of Task 7 accepts walls and openings only, so it stays green either way |
| C18 | 6 ↔ phase 1 | The calibration route | The pairs path keeps its body and answers (`test_plan_geometry_api.py` unchanged); `calibration_of` gains the reason; `carry_calibration` (phase 1) already writes `status: "estimated"`, which the estimate path reuses |
| C19 | 3 ↔ 11 | Timing | `stats["ms"]` and the response's `elapsed_ms` (Task 6) are what Task 11 quotes; the ≤ 15 s assertion lives in Task 5 |
| T1 | 1 | Tests ↔ code | `test_plan_detect_fixtures.py` regenerates with `gen.generate(tmp)` and compares pixels and JSON against `pm.FIXTURES`; `_perfect` builds the response keys `evaluate` reads |
| T2 | 2 | Tests ↔ code | `test_plan_detect_raster.py` exercises `chamfer_dt`, `thin`, `neighbour_count`, `trace_branches` with the shapes and edge cases the code handles (empty mask, border, loops without nodes, junction clusters) |
| T3 | 3 | Tests ↔ code | `test_plan_detect_walls.py` uses `Seg(a, b, samples)` and sets `.raw`, calls `snap_axis`, `merge_collinear(segs, join_px)`, `line_groups`, `estimate_tilt(segs, t_med)`, `detect(png, targets=("walls",), …)` and reads `detector.params.tilt_deg`, `scale`, `pixels`, `calibration_hint` |
| T4 | 4 | Tests ↔ code | `test_plan_detect_openings.py` reads `kind`, `swing`, `hinge`, `width_m`, `confidence`, `pixels[id].width_px`, `calibration_hint{status, method, reason, scale_m_per_px, doors}`, `scale.status` |
| T5 | 5 | Tests ↔ code | `test_plan_detect_baseline.py` reads `run_set` rows (`walls.recall / precision`, `doors.recall`, `windows.recall / found`, `ms`) and runs `scripts/plan_detect_private.py` with `sys.executable` |
| T6 | 6 | Tests ↔ code | `test_plan_detect_api.py` posts the bodies of `DetectIn`, `AcceptIn`, `CalibrationIn` and reads the response keys and audit details named in the routes (`walls, openings, ms, targets, timed_out, timeout_s, accepted, reided, removed_auto, replace_auto, method, status`) |
| T7 | 7 | Tests ↔ code | `test_plan_dxf_map.py` calls `suggest_layer`, `suggest_block`, `catalog_choices`, `load_catalog`, `entities_summary`, `extent_for`, `to_version`, `map_geometry` with the signatures above and reads the item keys and the audit details of `geometry.import` |
| T8 | 8 | Tests ↔ code | `unit-plan-detect.spec.ts` imports `allIds, byConfidence, byKind, candidatesDoc, defaultStates, fromResult, moveVertex, rescale, withParents` from `candidates.ts` and builds a `DetectResult` with every required field |
| T9 | 9 | Panel ↔ editor | `renderDetectPanel(view, actions)` receives every `DetectView` field the editor builds and every `DetectActions` method the editor supplies (`setOpts, run, acceptAll, acceptAbove, acceptKinds, rejectAll, toggle, focus, confirm, discard, applyHint, importRooms`) |
| T10 | 10 | Screen ↔ API | `renderDxfMap` reads `DxfEntities` fields only; `importDxf` sends `layer_map` without the `ignore` rows and `block_map` as `Record<string, string | null>` |
| T11 | 11 | Spec ↔ backend | The counts asserted (7 walls, 4 doors, 3 windows on the apartment; 5 walls and 1 door from the DXF; ~0.01 m/px hint) are the prototype's numbers on the same fixture and the same drawing |
| T12 | 12 | Release ↔ files | `record_t086.py` reads `pytest_0185.txt`, `baseline_0185.txt`, `private_0185.txt` written in Step 2; the CHANGELOG blank is filled from the same baseline file |
