# CR-021 self-update and platform restart - security notes

Scope: the in-app update of the Arx add-on and the platform-core restart (Settings > System > Updates, card "הפעלות מחדש").
Shipped since 0.1.159 (S1-S3); S4 additions on `pilot/CR021-s3-apply`: the downgrade guard and the `[platform-restart]` marker.
Design and decisions: `docs/changes/CR-021-SELF-UPDATE.md` (sections 3, 6, 12, 13). Code: `services/self_update.py` (the single
infrastructure door and its allow-list), `services/update_runs.py` (runs, lock, state machine, audit), `services/addon_restart.py`,
`services/platform_restart.py`, `services/release_notes.py`, `routers/system_update.py`.

## 1. The privilege change: `hassio_role: manager`

**This is the largest security change of the feature.** `smplwise_vms/config.yaml` requests the Supervisor role `manager`
(owner decision D1, re-confirmed 2026-10-04 after an independent review proposed a lower role). The add-on's own token
(`SUPERVISOR_TOKEN`) can then, in principle, manage other add-ons, the store and its repositories, backups, the core, the host
network and the Supervisor itself. Home Assistant shows a lower security rating for the add-on.

What limits it (in Arx, not in the platform):

- One egress door: `self_update.send` with an exact (method, path) allow-list, exact body keys, one templated path whose slug must
  equal the slug `GET /addons/self/info` reported for THIS add-on, no redirects (`follow_redirects=False`), no upstream text echoed or
  stored. A CI test fails when an infrastructure write path appears anywhere else in the code.
- Child processes run with `child_env.minimal_env()` (never `SUPERVISOR_TOKEN`); a guard test fails on a `subprocess` call without it.
- The role cannot be raised by Arx; the first release with the role was installed by hand (DOCS "One-time manual update").

Residual risk (accepted by D1): remote code execution inside the Arx process gives the attacker the `manager` role directly; the
allow-list does not help then. The add-on's own hardening (auth gate, remote channel, input validation) is therefore part of this
feature's security boundary.

## 2. Threat model

| Threat | Who / how | Control | Residual |
|---|---|---|---|
| Unauthorised trigger | any signed-in user, a delegated role, a forged request | permission `system.update` (system administrators only, never delegable, installation scope), checked on the read connection BEFORE the body is read; 403 + audit row; plain confirmation (`confirm: true` JSON literal); same-origin check (`Sec-Fetch-Site` / `Origin`, 403 `cross_site_refused`); 4 KB body cap; JSON only | a stolen administrator session can update and restart (D5: no second factor, by owner decision) |
| Remote trigger | the remote channel (CR-008) | allowed by D5 with the same permission; the remote cookie session passes `remote_channel.csrf_ok` first | as above, over the internet |
| Supply chain: malicious release | an attacker who controls the store repository (`jonioliel/smplwise-bms`) or the owner's GitHub account pushes a release; every installation that presses "עדכן" builds it | the update is never automatic (D7 not built); a human confirms each one; branch / tag protection and account 2FA (section 3); bilingual release notes reviewed before release | no signature or integrity check of the release (future item, needs a signing key) |
| Downgrade | a rolled-back or tampered store offers an OLDER version (old vulnerabilities, or migrations that cannot run backwards) | S4: `self_update.is_newer` - only a strictly higher release (numeric comparison of the leading dotted numbers, fail closed) counts as available or can be applied, whatever the infrastructure's `update_available` says; the target must equal the store's latest (`target_version_mismatch`) | an attacker who controls the repository can still publish a HIGHER version number with old code (supply-chain row) |
| Attacker-chosen version | the request body names a version | the target is only compared, never sent: the Supervisor installs the store's latest; mismatch -> 409 | none |
| SSRF / request forgery to the infrastructure | a crafted field reaching a URL or a path | no request field reaches a URL: fixed base (`http://supervisor`, or a test seam), fixed paths, slug pattern `[a-z0-9_]{1,64}` plus equality with this add-on's reported slug, no redirects; the release-notes marker is read from a local file only | none known |
| Leaking secrets | token, Supervisor URL, slug, backup name, upstream error text in audit, run rows, API answers or logs | fixed `step` / `error_code` vocabularies; tests assert the token, URL, slug, job id and upstream text never appear in `audit_log` or `update_runs` | - |
| Concurrency / double apply | two administrators, a double click, a retried request | `INSERT ... WHERE NOT EXISTS (unfinished run)` under the write lock, idempotency key, 1 update per 10 minutes inside the same WHERE | - |
| Broken system after update | failed build, crash loop, failed migration | optional backup (default on, D2; `backup_state` tells confirmed from requested), Supervisor keeps the old image on a failed build, health check with one retry, restart-loop detection (3 starts) counted before the migrations, 90-minute ceiling, rollback guidance (no restore button, owner answer 10) | rollback is manual |
| Platform restart abuse | repeated restarts as a denial of service | permission + confirmation only; NO rate limit (owner answer 8); configuration check first, no restart on an invalid configuration; audit row per restart | an administrator can restart the core repeatedly |
| Audit gaps | an action without a trace | rows `system.update.check`, `.settings`, `.apply`, `.restart_platform` (`attempt` committed before anything is sent) and `.result` (`outcome`, `reopened`) | - |

## 3. Branch protection requirement (owner item O9)

Owner answer 11 made protection of the store repository a release gate. The owner later reduced the requirement so that releases
are not slowed (`private/planning/BRANCH_PROTECTION_INSTRUCTIONS_HE.md`):

1. Two-factor authentication on the owner's GitHub account (the main protection).
2. A rule on `main` and on `v*` tags of `jonioliel/smplwise-bms`: block deletion and force-push. "Require a pull request" is NOT
   enabled.

Note the difference from CR-021 section 13.4, which still says "required review": the reduced rule is the binding one; record the
deviation in the security review. Agents never change repository settings; the owner confirms both items before the next release
that changes the update path. Later (not urgent): signed releases and an integrity check in the update.

## 4. What the security review must check

1. `self_update.ALLOWED` is unchanged or each added pair is justified; no other module sends to the infrastructure (the CI guard
   test still runs and passes).
2. The slug equality rule and `follow_redirects=False` in `self_update.send`; no request field can reach a URL or path.
3. `is_newer` (S4): refuses equal, older, suffixed-equal and non-numeric versions; `parse_info` and therefore both the check and
   `apply` use it; the test suites no longer exercise a downgrade (`NEWER = 99.0.0`).
4. Permission and audit happen before the body is read on `/apply` and `/restart-platform`; `system.update` is not delegable and
   not granted to any built-in role except system administrator.
5. Same-origin rule on both POST routes, including the remote channel's cookie sessions.
6. No secret, URL, slug, job id, backup name or upstream text in `audit_log`, `update_runs`, API answers or logs.
7. `release_notes.py` (S4) reads only the local `CHANGELOG.md`, size-capped, and adds a reason only (never triggers a restart).
8. `child_env.minimal_env()` on every child process.
9. The branch protection items of section 3 are confirmed by the owner.
10. The DOCS section "What Arx may do on your system" still matches the allow-list.

## 5. Not built (and why)

- Release-notes text of the NEWER version on the Updates page: only the infrastructure has it (`/addons/self/changelog` or the
  store), which conflicts with the rule "no upstream text echoed or stored" and is an unverified lab assumption. Needs an owner and
  security decision (option: render it as plain text, escaped, size-capped, never stored).
- An admin switch that turns the in-app update off: the feature ships on for `system.update` holders by owner decision; a switch is
  an open owner question (`docs/changes/CR021-S3-STATUS.md`).
- Release signing and an integrity check: needs a signing key decision.
- Notification to all administrators on each platform restart (review finding 4 suggestion, owner decision).
