# REL2201-ASSEMBLY-295 - assembly of the 2.20.1 candidate

Branch `release/2201`, cut from `origin/release/2200` @ `a50059306acf65b0ad7fa26cce8e06fa36163f0f` (the 2.20.0 candidate; its gate
runs on that head, `release/2200` is not changed). Each head was verified with `git ls-remote` before merging. Merged with
`--no-ff`, one merge commit each, in this order:

| # | Branch | Tip (ls-remote) | Branch base | Result |
|---|--------|-----------------|-------------|--------|
| 1 | `pilot/FLAKES-295` | `bad8cfcaaa36c5a71b4ae9d475daf7198d61b36c` (2 commits) | `f1e6c889e` | clean |
| 2 | `pilot/PWCLEAN-295` | `8b7657e3aa15a9bfc61e9f8e809c04770ce0a518` | `47ca1a2c0` (older `release/2200`) | clean, plain merge |
| 3 | `pilot/SXFIX-295` | `4c36207ad19f9ffc45f48be6d1086931a33cfca9` (2 commits) | `e476e48ae` (`release/2190`) | clean; `main.py` and `body_limit.py` auto-merged |

Conflicts: none. The two auto-merged files were read after the merge: `main.py` keeps the 2.20.0 imports and only swaps the
correlation middleware to `correlation_id.resolve(...)` and drops the unused `uuid` import; `body_limit.py` routes `_correlation`
through `correlation_id.from_asgi_headers`.

PWCLEAN-295 removed symbols from `services/wiskey_peer.py` and `services/wiskey_intents.py`; a search of the merged tree finds no
remaining caller of `verify_receipt` (peer), `ReceiptExpectation`, `FenceContext`, `OneCommitLedger`, `verify_create_resolution`,
`settle_create`, `CreateExpectation`, `receipt_frame` or `receipt_result` (only the removal notes and the test that asserts the
names are gone).

Migrations: none of the three branches adds, edits or renames a file under `smplwise_vms/backend/smplwise/migrations/`
(`git diff --name-status a50059306 HEAD` on that path is empty). The chain still ends at `0177_announce_stage_a.sql`.

Release prep on top: version 2.20.1 (`smplwise_vms/Dockerfile`, `smplwise_vms/config.yaml`, `smplwise/__init__.py`), bilingual
`smplwise_vms/CHANGELOG.md` entry, `docs/release/2.20.1-RELEASE-NOTES.md`, `contracts/API_INVENTORY.md` regenerated (1570 routes;
only the version line changed).

Not merged (later versions): `pilot/PEERQUERY-295`, `pilot/CAPEMERGENCY-295`, `pilot/LEGALPACK-295`.

TODO for the lead (runner): `www` / `www-public` rebuild, the full gate, browser and pixel specs, tag.

## Addendum (release/2201b)

Base `release/2201` @ `8aa101a4d`, then `--no-ff`: `pilot/FIX2200-295` @ `8b35e887f` (first, owner order), `pilot/QUARANTINE-295` @ `d2b780b22`. Both merged without conflicts; no migration added. `pilot/LOGOFIX-295` was not on origin and is not included.
