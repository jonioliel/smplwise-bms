# MOBILE-APP-SERVER-295 — Phone-app server side: saved sign-in, device key, WebView session exchange, attestation, critical sound

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

**Owner role:** engineering | **Hardware:** False

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
- **R-MOBILE-APP-SERVER-295-1 / AT-MOBILE-APP-SERVER-295-1:** The server supports the phone apps: persistent sign-in with a device key (APPREFRESH), the one-time-code WebView session exchange (POST /auth/app/session and /redeem), device attestation, offline field work (server half) and critical-sound alerts - every one off by default.

## Deliverables
- docs/changes/CR-APPREFRESH295.md, APPREFRESH-*-SPEC.md, CR-ATTEST232.md, CRITSOUND-SPEC.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
