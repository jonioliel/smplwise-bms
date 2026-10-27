# GATEAUDIT-297 — Gate audit and cleanup: classify the repeatedly failing / flaky / obsolete tests of the last 35 gate and nightly runs, remove duplicates, fix the bubble-freeze leftovers, re-take stale visual baselines, refresh the gate baselines

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
  "escalation": "Any proposed removal of a security / RBAC / integrity / migration / contract / release_check test goes to the owner instead."
}
```

## Acceptance
- **R-GATEAUDIT-1 / AT-GATEAUDIT-1:** docs/testing/GATE_AUDIT_2026-10-27.md classifies every repeatedly red test (REMOVE / FIX / KEEP) with at least two data points and justifies every removal for the owner's review; no removal touches security, permissions / RBAC, data integrity, migrations, contracts / API inventory, release_check or a MASTER_SPEC requirement; the frozen bubble skin is excluded through tests/helpers/frozen-skins.ts only; the M074 visual step reports 0 differences on the branch; scripts/gate/gate_baselines.json matches the current full tier-L counts within a few percent; every changed spec, and the bubble-related specs the 2.23.2 gate did not run, pass on the test machine.

## Deliverables
- docs/testing/GATE_AUDIT_2026-10-27.md
- frontend/tests/evidence-design-foundation.spec.ts (four zero-pixel duplicates removed) and its deleted snapshot folder
- frontend/tests/visual-matrix.spec.ts-snapshots (38 Linux baselines re-taken)
- frontend/tests/helpers/frozen-skins.ts drawnSkin + 7 specs
- scripts/gate/gate_baselines.json, scripts/gate/release_gate.py (budget message)

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
