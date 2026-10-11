# CR-035 - WisKey importer, stage 1 (offline intake, Arx import manifest, install plan)

Status: stage 1 built on `pilot/WISKEY-importer` (2026-10-11), backend only, tested on synthetic fixtures and fakes. Not released.
Nothing here has touched a delivered WisKey package, the exchange folder of a live system, the platform configuration, a door,
a key or a secret.

Sources: owner decisions 2026-10-04 and 2026-10-10 (WisKey packages nothing; Arx validates, builds its own hashes and manifest and
installs through its own mechanism); Arx replies of 2026-10-10 (final closure review: T1-T3, sections 2.2, 2.3, 2.6; intake
acknowledgement: M1-M7, C1-C4); the continuous handoff of 2026-10-10 (steps A1, A2, stop conditions 3.8); PKG02 input spec schema
`wiskey/local-delivery-input-spec/1`; `GATE_TOOL_SPEC.md` and `scripts/wiskey_gate.py` (WX3, not merged; the leak rules are ported,
the tool itself is not a dependency).

## 1. Scope

| In stage 1 | Not in stage 1 |
|---|---|
| Offline verification of one package folder `<exchange>/ready/<package>/` against an Arx-registered profile, PASS/FAIL per check | Running WisKey's tests or anything from the package (gate stage 1/2, Podman image) |
| Arx's own import manifest `arx-wiskey/import-manifest/0` (deterministic) | A real profile with the rc.37 values (open question 1) |
| Intake report `arx-wiskey/intake-report/0`, stored once per intake | Full-history leak scan (WisKey step P1 owns the verdicts) |
| Staging, journal, commit-then-marker install and crash recovery, against a temporary folder standing in for the platform configuration | Any install into a live platform; an HTTP route to `apply_install`; start-up recovery wiring |
| Kill switch `wiskey.import_enabled` (default off), system-administrator API, audit rows | A screen (the status endpoint is the only surface) |

No migration: reports are files under the data directory, the switch is one settings row, actions are audit rows. Migration
number 0079 was not used.

## 2. Code

`smplwise_vms/backend/smplwise/services/wiskey_import/`:

| Module | Role |
|---|---|
| `common.py` | strict JSON (no BOM, no duplicate keys, no NaN), SHA-256 and git blob ids, path rules, semver, canonical JSON, tree hash |
| `profile.py` | the profile schema `arx-wiskey/import-profile/0`, its parser, the registered-profiles directory `profiles/` |
| `gitbox.py` | the isolated git runner (section 4) |
| `scan.py` | forbidden names and the value-free text scan of the installable part |
| `intake.py` | `run_intake()`: checks P01-I04, the import manifest |
| `install.py` | `plan_install()`, `stage()`, `apply_install()`, `recover()`, the journal and the marker |
| `store.py` | data paths, exchange root, write-once intake storage, the kill switch |

`routers/wiskey_import.py`: `GET /api/v1/wiskey/import/status`, `PUT /api/v1/wiskey/import/switch`, `POST /api/v1/wiskey/import/intakes`,
`GET /api/v1/wiskey/import/intakes/{id}`. Tests: `smplwise_vms/backend/tests/test_wiskey_importer.py`.

## 3. Trust chain

1. The **profile** is Arx's own record of one package: refs (name to commit), source ref, ancestry, versions (`source_version`,
   `tests_manifest_version`, T3), the three metadata files with path, SHA-256, size, git blob id and source commit (T1, M1), the
   expected counts, the registered values (baseline, requirements, socket exceptions, tests manifest) and the installable domains.
   It is a JSON file in `services/wiskey_import/profiles/`, registered by a reviewed commit to Arx, never uploaded through the API.
   A profile may tighten the size caps, never raise them above the built-in ceiling.
2. The **input spec** (`PKG02_INPUT_SPEC.json`) is trusted only because its bytes match the profile (check P07). Its entries
   (support, history, source tests, test links, registered files) are then checked against the bytes in the package and the git
   objects of the bundle.
3. WisKey's **PACKAGE_MANIFEST.json and SHA256SUMS** prove completeness of the transfer only. Every decision uses the profile; a
   manifest field that disagrees with the profile is a failure (P06), never a correction.
4. The **import manifest** is computed by Arx from bytes it verified. It names the profile by id and SHA-256.

## 4. Isolation (never executing imported code)

- The bundle header is parsed in Python before git runs: v2, no prerequisite line, no capability line, exactly the profile's refs, a pack after the header (T2).
- Git runs in a fresh throwaway directory under `<data>/wiskey_import/work/`, outside the exchange folder and any checkout, and is
  removed afterwards. `git init --bare` with an empty template directory (no hooks), object format sha1.
- The bundle is never cloned or fetched: `git bundle unbundle` writes objects, `update-ref` sets the refs. No remote is ever configured; B05 checks that the
  repository has no remote, no alternates and no promisor/partial-clone setting (M5).
- Environment: `child_env.minimal_env` (no Supervisor token, guarded by the existing CI test) plus a sandbox HOME, an empty global config,
  `GIT_CONFIG_NOSYSTEM=1`, `GIT_ALLOW_PROTOCOL=` (all transports refused), no prompt, no replace objects, no lazy fetch.
  Command line: `protocol.allow=never`, `core.hooksPath` = an empty directory, fsmonitor off, gc and maintenance off, explicit `--git-dir`.
- No checkout: blobs are read as bytes through `cat-file --batch`, so no filter, smudge or attribute driver runs. Python files are neither imported nor parsed.
- `git fsck --full --strict` must be clean (B06).
- Reports carry check ids, counts, relative paths and 12-character blob prefixes. Absolute paths are replaced (`<sandbox>`, `<exchange>/<package>`) (M4).
  Leak findings never carry the matched value.

## 5. Checks (intake report)

A check after a failed gate is `NOT_RUN`. The result is PASS only when every check is PASS or NOT_APPLICABLE.

| Id | Name | Fails when |
|---|---|---|
| P01 | package_name | name not `^[a-z0-9][a-z0-9._-]{0,99}$`, folder name differs, folder is a link |
| P02 | layout | top level is not exactly `bundle/`, `support/`, `metadata/`, `PACKAGE_MANIFEST.json`, `SHA256SUMS`; `bundle/` is not exactly `<package>.bundle` |
| P03 | path_hygiene | symlink or junction, special file, hard link, executable bit (POSIX), absolute / `..` / `\` / `:` / `.git` / reserved / non-NFC / control-character path, case-insensitive collision |
| P04 | size_caps | bundle, per file, total, count or metadata cap exceeded (gate: nothing is hashed and git never starts after P01-P04 fail) |
| P05 | sha256sums | not LF / UTF-8 without BOM, a file missing or extra, a hash differs |
| P06 | package_manifest | not strict JSON; `package`, `refs`, `source_commit`, versions or any `manifest_expect` field differs from the profile (field names reported) |
| P07 | metadata_files | not exactly the profile's metadata files; size, SHA-256 or git blob id differs |
| P08 | input_spec | schema, refs, source commit, entry shapes, duplicates, group record counts, `expected_counts` or the profile's counts differ |
| B01 | bundle_header | not v2, prerequisites, capabilities, refs differ (extra / missing / changed) |
| B02 | git | git CLI missing or the sandbox cannot be created |
| B03 | bundle_verify | `git bundle verify` fails or does not report a complete history |
| B04 | list_heads | `git bundle list-heads` is not exactly the profile's refs |
| B05 | unbundle | refs differ after unbundle; a remote, alternates or promisor exists |
| B06 | fsck | `git fsck --full --strict` reports anything |
| B07 | refs_ancestry | a ref is not a commit; the ancestry chain is broken |
| T00 | tree_modes | a profile-forbidden mode (default symlink 120000, gitlink 160000) anywhere in the source tree |
| T01 | support | support folder is not the spec's set; bytes differ from the spec; the tree at the binding ref differs (mode 100644 + blob) |
| T02 | history | a record's mode / blob in its ref differs, its blob's SHA-256 differs, a group manifest differs |
| T03 | source_tests | a source test file's mode / blob / SHA-256 differs |
| T04 | test_links | a link does not resolve or its SHA-256 differs from the bytes (support, source blob, or the registered alias resolved to the metadata file, M2) |
| T05 | registered | a registered value (baseline, requirements, socket, tests manifest) differs on the real bytes |
| I01 | installable_tree | a profile domain is missing; a file is not a regular 100644 blob; bad path; collision; no `manifest.json` |
| I02 | installable_size | file count, per-file or total cap; a blob's bytes do not match its id |
| I03 | installable_manifest | `manifest.json` not strict JSON, domain differs from the folder, version not semver or not the profile's `source_version` |
| I04 | forbidden_content | forbidden names (tests, private, logs, keys, archives, databases, captures, byte code, env / secrets files, test modules) or a scan hit (IPv4 outside loopback / RFC 5737, MAC outside RFC 7042, JWT, PEM private key, secret- or serial-named literal) |

For a `reference_only` profile with no installable domain I01-I04 are NOT_APPLICABLE. Inline `gate:allow` markers are not honoured
(owner item 30 is open), so every scan hit fails.

## 6. Import manifest `arx-wiskey/import-manifest/0`

Deterministic (sorted keys, no timestamps, no machine data); its SHA-256 is recorded in the report and in the audit row.
Fields: `package`, `profile {id, sha256, kind}`, `source {ref, commit, version, tests_manifest_version}`, `refs`, `bundle {path, size,
sha256, format 2, object_format sha1, prerequisites []}`, `transport {package_manifest_sha256, sha256sums_sha256}`, `metadata[]` (role,
delivery and source path, size, SHA-256, git blob, source commit), `support {count, tree_sha256}`, `counts`, `registered[]`,
`installable[] {domain, version, file_count, total_bytes, tree_sha256, files[] {path, mode, size, sha256, git_blob}}`, `install_ready`
(true only for an install-candidate profile), `status {profile: unsigned_for_test, signature: null, release/ready/receipt: false}`,
`executed_imported_code: false`. `tree_sha256` follows `GATE_TOOL_SPEC.md` section 6.

## 7. Install design (built against fakes; not wired)

Extends the bridge mechanism of ADR-012 (`services/bridge_install.py`: copy next to the target, swap, marker; the owner restarts the
platform) with verification and a crash-safe journal. Only `<config>/custom_components/<domain>`, `<domain>.arx-new` and `<domain>.arx-old`
are touched, for the manifest's domains.

1. **Plan (dry run)** refuses with a fixed code: `import_disabled` (switch off), `not_install_candidate`, `nothing_installable`,
   `platform_config_not_mapped`, `custom_components_is_link`, `pending_recovery` (leftover `.arx-new` / `.arx-old`), `target_is_link`,
   `target_not_managed` (a folder without this importer's marker - hand-installed or foreign - is never replaced),
   `installed_version_unreadable`, `same_version_other_content`, `downgrade_refused`. Same version with the same tree is `noop`.
2. **Stage**: the installable bytes from the intake are written to `<data>/wiskey_import/staging/<intake id>/<domain>/` (a new folder, exclusive
   create per file) and re-hashed against the manifest.
3. **Apply** (library only): the journal `<data>/wiskey_import/journal/<install id>.json` is written with fsync + atomic rename before every step:
   `copying` -> copy to `<domain>.arx-new` and verify -> `copied` -> `<domain>` to `<domain>.arx-old` -> `<domain>.arx-new` to `<domain>` -> `swapped`
   -> marker `.smplwise_wiskey_import.json` written last (temp + rename) -> `marked` -> remove `.arx-old` -> `committed`.
   The switch is checked again, the plan must belong to the manifest (SHA-256), and an unfinished journal blocks a new apply.
4. **Recover**: before the swap the new copy is removed and the old folder put back; after the swap without a marker the installed tree is
   verified against the manifest - equal: marker written (roll forward), different: old folder restored (roll back); after the marker only
   `.arx-old` is removed. Tested by a crash injected at each of the five steps: the folder always ends with a marker and either the old or the
   new tree, never half. Recovery is per domain; a multi-domain install is not atomic across domains (profiles should list one domain per install).

## 8. API, RBAC, audit, kill switch

- Every route requires an active `system_admin` binding at the installation scope (`rbac.is_system_admin`), not a delegable permission.
  A refusal writes an audit row `decision=denied, reason=not_system_admin`.
- `wiskey.import_enabled` defaults to `"false"`. Off: `POST /intakes` is 409 `wiskey_import_disabled` (audited), no plan is produced, and
  `apply_install` refuses. `PUT /switch` needs `confirm: true` and writes `wiskey.import.switch` with `from` / `to`.
- `POST /intakes {package, profile}`: the package must be a valid name present in the exchange folder, the profile registered. One intake at
  a time per process (409 `intake_running`). Audit `wiskey.import.intake` (`phase: attempt`, profile id and hash) is committed before the run;
  the run holds no database lock (`unlocked`); `wiskey.import.intake.result` (`phase: outcome`, intake id, result, first failure, manifest hash) after.
  For a passing install candidate the answer carries the dry-run plan; nothing is installed.
- Exchange folder: `SW_WISKEY_EXCHANGE_DIR`, else `<platform config>/smplwise_exchange/ready` (PKG02). Read only.

## 9. Stop conditions (the importer refuses; nobody "fixes" a package)

Any check FAIL; any count, hash, mode, path, ref or prerequisite difference; `bundle verify` or `fsck` failing; a profile that is missing or
invalid; the switch off; a target folder the importer does not manage; a downgrade or same-version-other-bytes; an unfinished journal. A failed
intake is kept as evidence (write-once report) and a new delivery needs a new package name (TRANSFER01: no overwrite).

## 10. Tests (synthetic only)

`tests/test_wiskey_importer.py` builds a two-commit git repository, two named refs and a bundle at test time, a package folder with
support, three metadata files, an input spec, PACKAGE_MANIFEST.json and SHA256SUMS, and a matching profile. Covered: a clean pass and a
byte-stable manifest; no absolute path in the report; sandbox removed; transport files not trusted; SHA256SUMS, layout, caps, CRLF stop
before git; a link in the package (skipped where the OS refuses symlinks); metadata and count mismatches; an extra ref; a thin bundle with
prerequisites; a corrupted pack; broken ancestry; forbidden content found without echoing values (values assembled at run time); an
executable file in the integration; version mismatch; profile and path rules; git called only with the minimal environment and isolation
flags and never with clone/fetch/checkout/remote; install plan / stage / apply / marker / noop / downgrade / foreign folder / same version;
a crash at each install step followed by recovery; the API (403 and audit for a non-administrator, switch off by default, confirm,
404/409/422 inputs, attempt + outcome audit rows, write-once report).

## 11. What remains (each needs its own approval)

1. Register the real rc.37 profile (values from the continuous handoff sections 3.3-3.5; kind `reference_only`; open question 1).
2. Owner items 6 and 8 (transfer to the exchange folder, intake on the Arx server); then one intake run on the real package (A1a, host only).
3. In-container restore (A1b, K1) once the recipe and image exist.
4. An install candidate needs a new scope (source, registration, domain change, lock release) - PKG01 b / CR-033; then wiring of
   `apply_install` and `recover` (start-up hook) behind the switch, plus a screen.
5. Optional: honour `gate:allow` markers if owner item 30 = a; stream large blobs instead of reading them in one `cat-file` call.
6. API inventory regeneration at the next release (`scripts/api_inventory.py`).

## 12. Open questions

1. Where do the real profile values live: a profile file in this repository (hashes and commit ids only, no WisKey content) or a private
   registered file read from the data directory? Recommendation: the repository, so a change is a reviewed commit.
2. The source commit of rc.37 has one integration folder (`hikvision_intercom`); its history also had `smplwise_access_control`. The
   planned domain change (`smplwise_intercom`, WisKey decisions 2026-10-03) means a future install candidate names a different domain:
   should the importer then also refuse a candidate that still ships the old domain? Stage 1 takes the domains from the profile and installs nothing.
3. Should T00 refuse executables (100755) anywhere in the source tree, or only in the installable part (today: only there; symlinks and
   gitlinks are refused everywhere by default)?
