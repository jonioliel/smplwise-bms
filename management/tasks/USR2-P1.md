# USR2-P1 — USR2 phases P0+P1: Arx-only identities (CR-USR2) - identity store, passwords, sign-in, sessions, brute-force tiers, administration, sign-in page mode, settings tab; behind security.local_identity (off)

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. A fresh security review of the public surfaces (sign-in, set-password) before release. No live HA contact."
}
```

## Acceptance
- **R-USR2-1 / AT-USR2-1:** CR-USR2 records the approved contract amendment; with security.local_identity off every new route refuses and the HA-based remote sign-in is unchanged; with it on: one binding (never system_admin), uniform refusals with one hash per attempt, the three brute-force tiers, login CSRF, cookie flags, persistent sessions with rotation and revocation, administrative permissions only after the TOTP factor, administrative-target links on the local channel only, Ingress refusing local ids, the directory-sync exemption, no password / token / typed name in logs, audit or answers, hashes (only) in the project backup.
- **R-USR2-2 / AT-USR2-2:** On a real installation: sign-in through the real Cloudflare tunnel (CF-Connecting-IP, X-Forwarded-Proto), the cookie surviving 30 days of Android WebView / iOS shell restarts, the scrypt cost on the owner's host.

## Deliverables
- docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md (P0), migration 0096 (provisional 0097, renumbered at integ/264), services/local_passwords.py, services/local_identity.py, routers/local_identity.py, the cookie branch in services/ha_user_auth.py, frontend arx/local-auth.ts, arx/arx-welcome.ts, the sign-in page mode, screens/system-local-users.ts on pilot/USR2-P1
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
