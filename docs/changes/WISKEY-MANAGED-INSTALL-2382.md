# WISKEY-MANAGED-INSTALL-2382 — WisKey installs and upgrades through Arx

Branch `pilot/WISKEY-MANAGED-INSTALL-2382` from `origin/main` (`efc12d0e3`, v2.38.0). Not merged, not tagged, no version bump, no
migration. Nothing was run against the lab: no Home Assistant, Supervisor, WisKey, station or door contact. Every test uses a fake
Supervisor and a fake configuration tree.

## Owner decision

03.11 evening: "להבא נתקין דרכנו" — future WisKey installs and upgrades go through Arx, not by hand.

Today four separate things block that (WisKey M12 policy B, owner 02.11, adopted in 2.37.1):

| Blocker | Where | What it blocks |
|---|---|---|
| `wiskey.auto_install` OFF by default | `services/wiskey_auto_install.py` | the unattended installer (start-up staging, one restart per digest, discovery flag, activation defaults) |
| `OWNER_ON_PERMITTED = False` (build constant) | same | the owner's ON of that switch (409 `auto_install_not_permitted`) |
| Core provenance gate | `services/wiskey_core_runtime_gate.py` | a managed-profile bundle: Arx has no image verifier, so the gate never says `supported` |
| Manual markers | `custom_components/hikvision_intercom/_manual_upgrade_profile.json`, `<config>/hikvision_intercom_manual_upgrade.json` | every Arx writer (`bridge_install._manual_owner_profile`, `preflight_native`) |

The lab today: WisKey `2.0.1-rc.10`, installed on 03.11 by the owner-approved manual-existing upgrade (both markers present);
Arx 2.38.0 bundles `2.0.0-rc.39+arx-align.20261029.04`.

## Design in one paragraph

The unattended path stays exactly as policy B left it (switch OFF, build constant False, Core gate, markers): nothing installs by
itself at start-up. Next to it, a NEW owner-initiated path does the job the owner did by hand on 03.11, with the same checks, run by
Arx: an owner switch `wiskey.managed.enabled` (OFF by default, ON only with a typed confirmation), an explicit one-time adoption of the
manual install, and an upgrade orchestrator that checks a recent full platform backup, stops Core through the Supervisor, swaps the
component with verification, starts Core, compares the WisKey registry before and after, and rolls back automatically on failure.
The Core provenance gate keeps blocking unless it says `supported`, or the owner turns on a SEPARATE accepted-risk switch that only
covers the one verdict the gate can honestly produce today (`unverified`: the Core process was observed, only image provenance is
missing). Arx ships the WisKey rc.10 managed bundle instead of rc.39.

## 1. Adopting an existing manual install

A manual install is never overwritten silently. Adoption is a separate, explicit owner step:

1. Preconditions: the managed switch is ON; the caller is a system administrator with `system.configure`; the owner typed the adoption
   phrase (`מאשר העברה לניהול`).
2. Classification (read only, `wiskey_managed_install.classify`): the component directory is a real directory (no link anywhere — lstat
   scan), its portable digest (`wiskey-posix-tree-sha256.v1`) names a KNOWN tree in `services/wiskey_known_trees.json` (WisKey's
   `VERSION_PROFILE_MAP.json` + `LEGACY_FILES.json`, plus the Arx bundles), and each marker that exists is a regular file whose content is
   exactly WisKey's manual profile (`wiskey-manual-existing-upgrade.v1`, `automatic_authority: false`,
   `parallel_arx_installation: false`). An unknown tree, a link, or a marker with other content is refused (`installed_tree_not_recognized`,
   `manual_marker_invalid`): "preserve and review", as WisKey's tool does.
3. A private backup is taken to the add-on's own data directory (`/data/wiskey-managed/backups/<id>/`, outside the platform's config
   tree): the component, both markers, and `.storage/core.config_entries`, `core.device_registry`, `core.entity_registry` and every
   `.storage/hikvision_intercom.*` entry. The copy is verified file by file (inventory equal) before anything else happens.
4. The adoption record is written (`wiskey.managed.adoption`: digest, version, label, profile, backup id, time, actor) and one audit row
   `wiskey.managed.adopt` (allowed, digest/version/label only — never a path or a secret).
5. **Nothing in the config tree is changed by adoption.** The markers stay until the next managed swap, which runs with Core stopped:
   the component-level marker leaves with the previous tree, the config-level marker is moved (not deleted) into the job's stage
   directory and is in the backup. While the markers are present, the unattended writers stay blocked exactly as today.
6. Every later run re-checks that the installed digest still equals the adopted digest; a tree changed by hand after adoption is refused
   (`adopted_tree_changed`) and needs a new adoption.

Rationale for leaving the markers until the swap: WisKey's code may read them at runtime (the manual profile says "no automatic
authority, no parallel Arx installation"); changing them under a running Core has an unmeasured effect.

## 2. Version ordering

`services/wiskey_versions.py`:

- Semantic-version precedence (`2.0.0-rc.38 < 2.0.0-rc.39 < 2.0.0 < 2.0.1-rc.1 < 2.0.1-rc.10 < 2.0.1`), numeric pre-release identifiers
  compared as numbers (`rc.9 < rc.10`; a string compare would say the opposite). Build metadata (`+arx-align.20261029.04`) is ignored for
  precedence, as SemVer requires.
- A version label is NOT an identity: WisKey has shipped two different trees as `2.0.0-rc.38`. The plan therefore also compares the
  portable digest and the product CODE:

| Installed vs bundled | Plan |
|---|---|
| nothing installed | `install` |
| same digest | `up_to_date` |
| bundled newer | `upgrade` |
| same precedence, same product CODE, installed is the manual profile of it | `convert` (rc.10 manual → rc.10 managed differ by exactly one file, the marker) |
| same precedence, other content | refused `same_version_different_content` |
| bundled older | refused `downgrade_refused` |
| a version that does not parse | refused `version_unknown` |

The lab case: installed `2.0.1-rc.10` (manual) vs Arx 2.38.0's `2.0.0-rc.39+arx-align` → `downgrade_refused` (the old code already
refused it as `native_newer_installed`). With the rc.10 managed bundle shipped here → `convert`.

## 3. The upgrade run (orchestrator)

`services/wiskey_managed_install.py`, one job at a time (module lock + persisted job record `wiskey.managed.job`), run in a worker
thread; the screen polls `GET /wiskey/managed`. Every step is recorded (name, state, closed code, time). The Supervisor is reached only
through `self_update.send` (the one allow-list), which gains exactly three pairs: `GET /backups`, `POST /core/stop`, `POST /core/start`.

| # | Step | Pass condition | On failure |
|---|---|---|---|
| 1 | `preflight` | switch ON; bundle byte-exact to its pin (managed profile, product CODE, file count, recomputed digest); installed tree classified (missing / adopted / Arx-managed — never manual-not-adopted, unknown, link); plan is `install`/`upgrade`/`convert`; free space ≥ 3× bundle | abort, nothing touched |
| 2 | `core_gate` | `wiskey_core_runtime_gate.read_core` says `supported`, or says `unverified` (`core_runtime_provenance_unavailable`) AND the accepted-risk switch is ON | abort |
| 3 | `backup_check` | `GET /backups` lists a `full` backup that includes the platform, not older than 24 h | abort (`full_backup_missing` / `full_backup_stale` / `backups_unreadable`) |
| 4 | `snapshot_before` | the WisKey registry is read over the add-on's authenticated socket: entries (id, state), devices, entities (entity id, unique id, device) | abort |
| 5 | `stop_core` | `POST /core/stop` answers ok (or its outcome is unknown) AND the Core API stops answering within 90 s | abort; Core is NOT stopped → nothing else; if the API still answers → `core_did_not_stop` |
| 6 | `backup_local` | stopped-state private backup (component, markers, registry files, `hikvision_intercom.*`), verified | start Core, abort |
| 7 | `swap` | installed digest still the preflight one; candidate copied into `<config>/.smplwise-wiskey-managed/<id>/candidate` and verified against the pin; `rename` current → `previous`, candidate → target (same filesystem); target digest = pin digest; config-level marker moved into the stage | rename back, start Core, abort |
| 8 | `start_core` | `POST /core/start`, then the Core API answers within 10 min | rollback |
| 9 | `verify` | after entries settle (≤ 4 min): same entry ids, every entry loaded before is loaded after, same device ids, same (entity id, unique id, device) set | rollback |

Automatic rollback (from step 8 or 9): stop Core, put `previous` back and the failed candidate aside, move the config-level marker
back, and — only if the WisKey entries' schema (`version`, `minor_version`) changed — restore the registry files and
`hikvision_intercom.*` from the stopped-state backup; start Core; verify against the before snapshot. Outcome `rolled_back` or
`rollback_failed` (then the owner restores the full platform backup taken before the run; the screen says so).

The owner can also roll back a SUCCESSFUL run later (button, managed switch ON), while the previous tree is still in its stage directory
and the installed tree is still exactly what the run installed. It restores a tree that already ran on this box, so it skips the Core gate
and the full-backup check (it is the way back); it still takes the stopped-state private backup, stops / starts Core and compares the
registry, and undoes itself from that backup if the compare fails. It is a code-only restore (the markers come back with it).

Arx crash mid-run: at the next Arx start, `recover_interrupted` marks the job `interrupted`; if the target directory is missing it puts
`previous` back; if Core is not answering it starts Core. It never swaps forward. The screen shows the interrupted job and the
rollback button.

## 4. The owner switch

- `wiskey.managed.enabled` (`off | on`, missing / null / unreadable = off), written ONLY by `PUT /wiskey/managed/switch` (system
  administrator + `system.configure`, audited before/after). ON requires `confirm` equal to the phrase `מאשר ניהול התקנה`; anything
  else is 422 `confirmation_required`. OFF is always allowed and also turns the accepted-risk switch OFF.
- This replaces the build constant AS THE GATE OF ARX INSTALLS: the owner's typed approval opens the owner-initiated path; the
  build constant `OWNER_ON_PERMITTED` stays False and keeps closing only the UNATTENDED path (start-up staging/restart without a
  backup check, stop/start, comparison or rollback). Opening that one too is owner question Q1 (recommendation: keep it closed).
- Safeguards kept: no code path writes the switch except the owner's route (static test, same style as the policy-B one, which is
  kept unchanged); switching ON installs nothing by itself; every action is a separate audited request; the switch and every
  `wiskey.managed.*` key are kept out of Arx backups and never restored (`backup.SETTINGS_KEEP_PREFIXES`).

## 5. The Core provenance gate

What the gate needs from WisKey (requests W1–W3 below): an image verifier — a function owned by the runtime/image provider that, given the
challenge-bound observation (`wiskey-core-runtime-observation.v1`: Core version, Python, SOABI, architecture, loaded `orjson`/`aiohttp`
modules and their hashes), answers True only for a Core image it has attested. Until that exists, the gate's best honest answer is
`unverified`.

Owner-accepted-risk mode (implemented, separate switch `wiskey.managed.core_risk`, typed phrase `מאשר סיכון סביבה`): when ON, a
`unverified` / `core_runtime_provenance_unavailable` verdict is accepted for an owner-started run, and the job's audit row records
`core_gate: unverified, risk_accepted: true`. It does NOT cover `unsupported` (a verifier said no), `refused` (bad or unbound
observation), or `unavailable` (no observation at all — e.g. the bridge without its observer). It never applies to the unattended
path (`preflight_managed_runtime` is unchanged). Residual risk it accepts: the WisKey component's native wheels could be incompatible
with this Core image; the run's verify step and automatic rollback bound it, and the full platform backup is the last line.

## 6. Shipping the WisKey rc.10 managed bundle

`smplwise_vms/integration/hikvision_intercom/` is replaced by the content of `WISKEY_ARX_MANAGED_2.0.1-rc.10.zip` (WisKey branch
`origin/codex/wiskey-mac-m12-policy-b-2026-11-02` @ `2834aa5e8`, `docs/owner-development-2026-11-02/mac-policy-policy-b-completion/history/rc10/M12-07/package/`):

| Item | Value (re-measured at adoption) |
|---|---|
| ZIP sha256 | `3365c2b4bb452651a9ff6590b3a9a1b36578e7629c746e64073730617222c294` (= `SHA256SUMS.txt`, = `MANAGED_MANIFEST.json`) |
| product CODE | `6049821dd39235b7d50ea2a43621e440caa51fb2` |
| files | 389, each byte-exact to `MANAGED_MANIFEST.json` |
| component digest | `5a3d3cedaab4f1ae8d3708b49e571496cae83c6a7eabc38437e2932305852e2d` (recomputed with Arx's `wiskey_distribution_digest`) |
| pin | `hikvision_intercom.pin.json` taken byte-exact from the ZIP (sha256 `0063c70f…`), profile `managed_original_authority_flow` |
| manifest | `hikvision_intercom.managed_manifest.json` = `MANAGED_MANIFEST.json` byte-exact (sha256 `4b2acc0a…`) |

Measured: the managed tree equals WisKey's manual rc.10 tree minus `_manual_upgrade_profile.json` (no other file differs), so the lab's
conversion swaps one file out. Because the pin now carries the managed profile, the unattended path refuses it even more firmly (Core
gate) — the policy-B behaviour is unchanged.

## 7. Files

Backend: `services/wiskey_versions.py`, `services/wiskey_known_trees.json`, `services/wiskey_managed_install.py`,
`routers/wiskey_managed.py` (new); `services/self_update.py` (three allow-list pairs), `services/backup.py` (keep prefix), `main.py`
(router + start-up recovery). Bundle: `smplwise_vms/integration/hikvision_intercom*`. Frontend: `src/api/wiskey-managed.ts`,
`src/i18n/wiskey-managed.ts`, `src/screens/system-security-wiskey-managed.ts` (new), one line in `system-security-wiskey.ts`.
DOCS.md "What Arx may do on your system" gains the three calls.

Routes (system administrator + `system.configure`, every write audited): `GET /wiskey/managed`, `PUT /wiskey/managed/switch`,
`POST /wiskey/managed/check` (the dry-run checklist: plan, Core gate, backup), `POST /wiskey/managed/adopt`,
`POST /wiskey/managed/upgrade` (202), `POST /wiskey/managed/rollback` (202).

## 8. What stays blocked, and why

- The lab is untouched; the first real run is the joint session with the owner (full platform backup first).
- The Core gate still never says `supported`: no image verifier exists (WisKey W1). Runs need the accepted-risk switch until then.
- The unattended path (start-up staging) stays closed (`OWNER_ON_PERMITTED = False`, Q1).
- The `stop`/`start`/`backups` Supervisor calls are allowed for the `manager` role per the Supervisor's role table; not measured on the
  owner's box. `/core/stop` blocking until the container is down is the Supervisor's documented behaviour, also not measured here.
- Functional parity of rc.10 managed against everything rc.39+arx-align carried for Arx (readiness, restart v2, catalog) is WisKey's
  claim (M12-07 STATUS "connection: PARTIAL"); Arx's catalog file (`wiskey_r5_catalog.jsonl`) is unchanged by this branch.

## 9. Owner questions (Hebrew in the report)

- Q1: open the unattended path too (flip `OWNER_ON_PERMITTED`)? Recommendation: no — every install is owner-started.
- Q2: how old may the full backup be? Default 24 h.
- Q3: should Arx create the full platform backup itself (`POST /backups/new/full`, the `backup` role)? Recommendation: not now;
  the owner takes it, Arx checks it.
- Q4: accept the Core-image risk until WisKey ships a verifier (turn on the accepted-risk switch for the session)?
- Q5: the typed phrases (`מאשר ניהול התקנה`, `מאשר העברה לניהול`, `מאשר סיכון סביבה`) — keep or change.
- Q6: keep the previous tree and the private backup for the last 3 runs (about 5 MB each)? Default yes.

## 10. Requests to the WisKey team

- W1: the image verifier the Core gate names (or a decision that Arx's accepted-risk mode is the accepted path), with its contract.
- W2: a machine-readable known-trees list in every delivery (label, product CODE, profile, `wiskey-posix-tree-sha256.v1` digest) — the
  rc.38 label reuse showed that labels alone cannot order or identify trees.
- W3: confirm that rc.10 managed reads neither marker at runtime and that removing the config-level marker after a stopped-Core swap is
  safe; confirm entry schema stays 1.2 (no migration) for rc.10.
- W4: a statement of functional parity of rc.10 managed with rc.39+arx-align for the commands Arx uses (readiness_v1, request_restart_v2,
  capability_preflight_v1, the R5 catalog), or the list of differences.
- W5: future deliveries keep the managed ZIP layout (`integration/hikvision_intercom/` + pin) and a strictly increasing version label.

## 11. Tests and receipts

Backend: `tests/test_wiskey_managed_install_2382.py` (fake Supervisor + fake config tree: switch and phrase, the one writer, manual
markers, adoption, unknown tree, invalid marker, convert, failure -> automatic rollback, registry restore only on a schema change,
downgrade refused, Core not stopping / stop refused, missing / stale backup, Core gate x accepted risk, owner rollback, fresh install
with Core not coming back, one run at a time, dry-run check, start-up recovery, tampered bundle). Unit:
`frontend/tests/unit-wiskey-managed.spec.ts`. Browser: `frontend/tests/evidence-wiskey-managed-2382.spec.ts` (runner only).

| Run | Where | Commit | Outcome |
|---|---|---|---|
| `run_smart.py backend` - the new file + bundle, installer, R3, review, alignment, policy-B gate + switch, rc.7, Mac adopt | runner | `8319f3531` | 283 passed |
| `run_smart.py backend` - `test_self_update_s3.py`, `test_self_update.py` | runner | `8319f3531` | 66 passed |
| `run_smart.py spec` - evidence-wiskey-managed-2382, evidence-switchui-295, unit-wiskey-managed, unit-wiskey-switches, desktop + mobile | runner | `8319f3531` | 68 passed |
| `npx playwright test -c playwright.unit.config.ts` unit-wiskey-managed + unit-wiskey-switches | workstation (node only) | working tree | 16 passed |
| `npx tsc --noEmit` | workstation | working tree | exit 0 |

First runner run (`f0f23cc5b`): 12 failed - the unattended-installer tests that staged the shipped bundle (now managed-pinned, so
refused at the Core gate: fixed by staging a legacy-pinned copy), the R3 manual-install codes (now `native_foreign_installed`), and
four self-update tests that failed only in the same process after those failures (module state of the bridge status); alone they pass.
NOT_RUN: the full backend suite, the pixel suite, the UI build (`build:addon`), any lab or real-Supervisor run.

## Rollback of this branch

Revert the branch commits. No migration; the new settings keys are inert without the routes.
