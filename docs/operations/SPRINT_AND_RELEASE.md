# Conditional seven-day pilot

The sprint starts only after local execution access, actual legacy code, a safe lab and named approvals exist. Day numbers are ordering targets, not contractual durations. Budget in prior discussion was an illustrative ceiling, not spending permission.

| Day | Gate / evidence |
|---|---|
| 1 | Legacy audit, design baseline, bounded traces and API decisions |
| 2 | Playback time proof, authenticated Live, floor model and upload |
| 3 | Camera pin → true Live → recording search and single-camera seek |
| 4 | Authorized HA catalogue/state → map → one approved low-risk action |
| 5 | Basic events, reconnection, restore and end-to-end flow |
| 6 | Fix failures; mobile/RTL/design review. Freeze new features |
| 7 | Acceptance evidence and human Go/No-Go for one reference deployment |

Security boundaries are P0 even in the pilot. Advanced multicamera sync, AI, full Cases and enterprise scope do not displace basic map usability or correct recording time. If T006 fails, preserve the legacy playback path or delay the playback release; do not mask wrong footage with a UI timestamp.

Release report: tag/commit, environment matrix, scope, tests with evidence, permitted physical actions, resource measurements, known limits, backups/restore, rollback, approver/date. No passing mock test proves real-device compatibility. P0/P1 failures in released critical paths block release.

## v1.1 release gate amendment
PILOT includes HA identity sync, built-in scoped groups/roles and the non-admin workflow. T076–T081/T083 must satisfy acceptance before T035/T036. V1 additionally requires T082 delegated administration. Keep original security/time/playback/rollback gates. Do not defer all user management to full-RBAC T055.
