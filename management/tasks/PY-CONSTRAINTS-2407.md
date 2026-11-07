# PY-CONSTRAINTS-2407 — Python constraints lock file for the add-on + Supervisor build check

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** release | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization."
}
```

## Acceptance
- **R-PY-CONSTRAINTS-2407-1 / AT-PY-CONSTRAINTS-2407-1:** The add-on installs its Python packages with a committed constraints lock file (pip -c) that pins every direct and transitive package, per supported architecture (musllinux wheels, with hashes), generated on the runner; the five range pins of requirements.txt (tzdata, numpy, cryptography, ezdxf, uharfbuzz) resolve to the locked versions, and a test fails when requirements.txt and the lock file disagree.
- **R-PY-CONSTRAINTS-2407-2 / AT-PY-CONSTRAINTS-2407-2:** A Supervisor-equivalent build check (the add-on Dockerfile built from the base image the Supervisor uses, on the runner) installs with the lock file and imports the backend, so a lock that breaks the Supervisor build (as the base-image digest pin did in v2.31.0) is caught before a release; the check is part of the release gate or the release checklist.

## Deliverables
- Constraints lock file(s), generator script and drift test on an isolated branch
- Supervisor build check on the runner and its place in the release gate / checklist
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
