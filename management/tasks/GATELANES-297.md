# GATELANES-297 — Gate lanes: pixel baselines for classic + domus only (tesla / crystal get a structural smoke), archive the September owner-round live specs, a non-blocking timing lane for the wall-clock tests

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** engineering | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "deep",
  "effort": "high",
  "escalation": "Moving any safety / permission / security assertion out of the blocking gate goes to the owner instead."
}
```

## Acceptance
- **R-GATEAUDIT-1 / AT-GATELANES-1:** Branched from pilot/GATEAUDIT-297 (merge together). Owner approval 2026-10-27 of GATE_AUDIT P1-P3: the pixel skins are one line (frontend/tests/helpers/pixel-skins.ts PIXEL_SKIN_IDS = classic, domus); every other skin under test keeps the same per-skin case as a structural smoke (drawn skin, visible screen with a real size, no sideways overflow, no page error); the tesla / crystal linux baselines are deleted; the 12 owner-round live specs are git-moved to frontend/tests/archive/owner-rounds-2026-09/ with a README and are ignored by Playwright, tsc, the gate and the selection; the '@timing-lane' / timing_lane tests leave every gate run and run only in scripts/gate/timing_lane.sh (non-blocking, started by release_gate.sh after the verdict, waits for a quiet runner); no physical-command safety, permission or security assertion leaves the blocking gate (the door in-flight cap refusal stays blocking, clock-free); docs/testing/GATE_LANES.md documents the lanes

## Deliverables
- docs/testing/GATE_LANES.md
- frontend/tests/helpers/pixel-skins.ts + the 12 per-skin pixel specs; 69 tesla / crystal linux baselines deleted
- frontend/tests/archive/ (README + owner-rounds-2026-09/, 12 specs moved); playwright.config.ts, playwright.unit.config.ts, tsconfig.json, gate_tablet_allowlist.json
- scripts/gate/timing_lane.sh, scripts/gate/release_gate.sh, scripts/gate/release_gate.py (lane filters), scripts/gate/selftest_gate.py, scripts/gate/INSTALL_ON_RUNNER.md, scripts/gate/gate_baselines.json
- timing-lane tags / marks: test_f3a_doorwin_dw03_295.py (split), test_lat1_toggle_latency.py (split), evidence-nvr-cameras-batch, unit-plan-3d-realistic, unit-plan-3d-view, evidence-uxfix-rtl; pyproject.toml marker

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
