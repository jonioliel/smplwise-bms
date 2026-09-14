# CR-002 — Lab device accounts for the pilot
Requested by / date / reason: product owner, 2026-09-14 (answer 2ב to the G0 intake question), to avoid creating
a dedicated NVR user before the site's devices are finalised.
Affected requirements, screens, tasks and release: R004 (T002, AT004), SC26; PILOT.
Current behavior / requested behavior: R004 asks for dedicated least-privilege device accounts. For the pilot lab
the existing NVR administrator account is used **read-only by policy**; go2rtc API has no authentication; the
HA token belongs to the non-admin user `codex`. A dedicated non-admin NVR account (live view, playback, log
search, no system management) and go2rtc API authentication remain the target for the pilot release gate.
Effect on design, security, interfaces, migration and budget: no code impact. Every probe/tool logs its calls
under `private-evidence/` (action log) and performs no NVR writes; write tests on the NVR (manual recording,
reboot, disk tests) still need a separate, explicit approval. Risk: an accidental write would run with admin
rights — mitigated by read-only tooling and review of every device-writing change.
Alternatives / deferred work: create the dedicated NVR user later (owner action); enable go2rtc API basic auth.
Acceptance tests and compatibility update: AT003 verified by the read-only probes (2026-09-14); AT004 accepted
under this CR with the deviation recorded; re-verify at the pilot release gate (`templates/RELEASE_CHECKLIST.md`).
Approval / effective version: owner 2026-09-14 / 1.1.0-planning (G0).
No requirement is silently deleted to meet a deadline.
