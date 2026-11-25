# WISKEY-KNOWN-TREES-RC20-2530 - Arx recognises the WisKey rc.20 trees (target 2.53)

Base: `origin/release/2520-train` @ `c128c2f86`. Branch `pilot/WISKEY-KNOWN-TREES-RC20-2530`.

## What and why

Arx's known WisKey trees table (`smplwise_vms/backend/smplwise/services/wiskey_known_trees.json`, read by
`services/wiskey_versions.identify`, used by the read-only classifier `wiskey_managed_install.classify`) ended at `2.0.1-rc.10`.
After the planned rc.20 lab install (2.54, `docs/operations/WISKEY_RC20_LAB_INSTALL_RUNBOOK_HE.md` section 5 and question 1 on
`chore/LAB-2540-RUNBOOKS`) Arx would have shown the installed tree as "unknown". This row adds the published trees with their exact
`wiskey-posix-tree-sha256.v1` digests. No code change: the reader, the matching rule (exact digest equality, no wildcard, no prefix,
a label is never an identity) and unknown-stays-unknown are unchanged.

## Rows added

| label | profile | product CODE | component digest | files | source (WisKey read-only repo `C:\cloude\wiskey-review-ro` @ `57e4615e0b94`) |
|---|---|---|---|---|---|
| 2.0.1-rc.20 | managed_original_authority_flow | dcebb9f34c8f | c0824762...0430d | 407 | `owner-development-2026-11-25/mac-arx-adoption/packages/PACKAGE_VERIFICATION.json`, `PREPARATIONS_HE.txt`, `MANAGED_MANIFEST.json` |
| 2.0.1-rc.20 | owner_manual_existing | dcebb9f34c8f | e025a6bc...26ddf | 408 | same, `MANUAL_MANIFEST.json` |
| 2.0.1-rc.19 | managed_original_authority_flow | 3e7bfc585d5a | c7a6c0c5...8ff02 | 406 | `owner-development-2026-11-24/mac-arx-resync/packages/VERSION_PROFILE_MAP.json`, `MANAGED_MANIFEST.json` |
| 2.0.1-rc.19 | owner_manual_existing | 3e7bfc585d5a | 0df4b696...5cdbe | 407 | same, `MANIFEST.json` |
| 2.0.1-rc.17 | owner_manual_existing | 36c2dcc90412 | 43ea15f3...19f5f | 402 | same `VERSION_PROFILE_MAP.json` `legacy_preserved`, `packages/inputs/RC17_MANUAL_MANIFEST.json` |

Full values are in the JSON. rc.19 was added because WisKey published both of its trees (with ZIPs) in the 24.11 handoff; rc.17
because the same map lists its manual tree in `legacy_preserved` with a digest and the handoff carries its full manifest rows (no
rc.17 managed tree was published, so none is added). rc.11 to rc.16 and rc.18: no published tree digest found in the handoff - not added
(they stay unknown).

## How each digest was verified (not copied blindly)

- The four ZIPs were exported from the read-only repo with `git show <commit>:<path>` (the repo was never modified or checked out);
  their SHA-256 equal WisKey's `ZIP_sha256` (rc.20 manual `65519f13...`, rc.20 managed `bb9ceae5...`, rc.19 manual `4d855449...`,
  rc.19 managed `386f4e72...`).
- Each ZIP's `hikvision_intercom/` rows were hashed in memory (no extraction, nothing executed) and passed to Arx's own
  `wiskey_distribution_digest.digest_rows` with the same exclusions as `files()` (`__pycache__`, `.pyc`, `.DS_Store`,
  `.smplwise_installed.json`): all four digests equal WisKey's published values; file counts 408/407 (rc.20 manual/managed) and
  407/406 (rc.19). The managed ZIPs' `integration/hikvision_intercom.pin.json` names the same product CODE, version, profile and
  `component_digest_recomputed`. Each `manifest.json` says the expected version.
- rc.20 `MANUAL_MANIFEST.json` / `MANAGED_MANIFEST.json` and rc.17 `RC17_MANUAL_MANIFEST.json` rows recompute to their published digests.
- As with rc.10, the manual tree is exactly the managed tree plus `_manual_upgrade_profile.json` (rc.20: no other difference).

## Effect (and what does not change)

- The status line / classifier now labels an installed rc.20 / rc.19 / rc.17 tree (label, product CODE, profile) instead of "unknown".
- A tree that differs in any byte, size, name or file count still gets no label. The manifest's version text is still reported as
  read, never trusted as identity.
- Plans are unchanged: with rc.20 installed, the shipped rc.10 managed bundle is `downgrade_refused` (tested).
- Known trees are what the existing explicit adoption step accepts (`adopt`: managed switch ON - default OFF -, admin with
  `system.configure`, typed phrase). So an installed rc.20 tree becomes adoptable through that same owner step, as rc.10 is today;
  nothing runs by itself, and with the rc.10 bundle no run is possible over it anyway. See question 1.
- Not touched: the shipped bundle / pin (`smplwise_vms/integration/hikvision_intercom.pin.json`, still rc.10), the bridge, UI, API,
  any WisKey R1-R7 row file.

## Files

- `smplwise_vms/backend/smplwise/services/wiskey_known_trees.json` - five rows + note.
- `smplwise_vms/backend/tests/fixtures/wiskey_trees/rc20_tree_rows.json` - new fixture: the rc.20 managed tree's file rows
  (path, bytes, sha256) from WisKey's `MANAGED_MANIFEST.json` plus the manual marker row. Rows only, no WisKey source bytes, no IPs.
- `smplwise_vms/backend/tests/test_wiskey_known_trees_rc20_2530.py` - new tests.
- `docs/changes/WISKEY-KNOWN-TREES-RC20-2530.md` - this note.

## Tests

New file `tests/test_wiskey_known_trees_rc20_2530.py` (33 cases): rc.20 managed and manual fixture trees recognised with label,
product CODE, profile and file count; fixture digests equal WisKey's published values; 12 tampered variants (one sha byte, one size,
an extra file, a missing file, a renamed file, a changed manual marker) stay unknown; `identify` refuses uppercase, prefix, padded,
wildcard, label and non-string probes; `classify` end to end labels an rc.20 manual tree and gives a tampered tree with the rc.20
manifest label no identity; rc.20 installed vs the shipped rc.10 bundle = `downgrade_refused`; rc.19 / rc.17 rows recognised; table
rules (exact lowercase sha256 or null, null only for `history_only`, unique digests, one product per label, SemVer labels).
Before the change the same lookup of the rc.20 managed digest against the base table returned `None` (checked).

| command (PC, `smplwise_vms/backend`, main checkout venv, one file per process) | exit | result |
|---|---|---|
| `python -m pytest -q -p no:cacheprovider tests/test_wiskey_known_trees_rc20_2530.py` | 0 | 33 passed |
| `python -m pytest -q -p no:cacheprovider tests/test_wiskey_native_bundle_2272.py` | 0 | 7 passed |
| `python -m pytest -q -p no:cacheprovider tests/test_wiskey_managed_install_2382.py` | 0 | 73 collected, exit 0 (pass count line not captured) |
| `py -3.12 -m ruff check tests/test_wiskey_known_trees_rc20_2530.py` | 0 | all checks passed |

NOT_RUN: the full backend suite and the release gate (train gate covers them). No UI change, so no pixel baselines and no compare page.

## Open questions

1. An installed rc.20 tree is now adoptable through the existing owner step (switch ON + typed phrase), like rc.10.
   a. Keep it (recommended): adoption is explicit, off by default, and the rc.10 bundle cannot run over rc.20 (downgrade refused).
   b. Add a "recognise only" flag so rc.19/rc.20 are labelled but not adoptable until WisKey's acceptance conditions close.
2. rc.17 manual tree (published in `legacy_preserved`, never installed in the lab as far as Arx knows).
   a. Keep it (recommended): a label only, exact digest recomputed from WisKey's rows.
   b. Drop it and keep only rc.19 / rc.20.
