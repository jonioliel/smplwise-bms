# CR-SECRET-FILES-2438 - one write sequence for every secret file

Code review 2026-11-13, finding **04:F09** (MASTER_PLAN entry `CR-SECRET-FILES-2436`, wave 2 backend).
Branch `pilot/CR-SECRET-FILES-2438`, based on `origin/main` (`0a8fb55e1`, 2.43.5): the plan row names no wave-1
dependency and none of its files is touched by `pilot/CR-WAVE1B-COMBINED-2436` or `pilot/BACKEND-SAFETY-2435`.

## What and why

Six writers of secret files each carried their own copy of the write sequence, and two were weaker than the rest:

| Writer | Before | After |
|---|---|---|
| `services/signing.py` keyring | `write_text` in place, no temporary file, no flush. A crash in the middle left a damaged keyring, which `load_keyring` answers with an empty ring, so the next export started a **new signing identity** | `secret_files.write_private` (temporary file, flushed, renamed into place); mode kept as `write_text` gave it (0666 less the umask - the keyring holds public halves only) |
| `services/signing.py` private key | `O_TRUNC` straight onto `<kid>.key`, no flush (an interruption left an empty key file) | `write_private`, mode 0600 |
| `services/fleet_keys.py` state | fixed `state.json.tmp` opened with `O_TRUNC` (left behind by a failed write, reused by the next, follows a planted link) | `write_private` (random temporary name, `O_EXCL`) |
| `services/alarm_codes.py` key, `services/messaging_runtime.py` key | strong copy (`O_EXCL`, fsync, replace) - but a failed write left the temporary file behind | `secret_files.load_or_create_key` |
| `services/notify_email.py` password | strong copy - same stray temporary file on failure | `write_private` |
| `services/connection_store.py` key | strongest copy (hard link: never overwrites a key another process created; loose mode tightened; directory flushed) - stray temporary file when the flush itself failed | `load_or_create_key` (this sequence became the shared one) |

New module `services/secret_files.py`: `private_dir`, `tighten`, `fsync_dir`, `write_private(path, data, *, mode=0o600)`,
`create_private(path, data)` and `load_or_create_key(path, lock, size, *, create, damaged)`.

Same paths, same modes, same contents, same error types and messages (each caller passes its own `damaged()` error:
`CodeError`, `RuntimeError`, `SecretError`). `connection_store._load_or_create_key(settings, create, path=None)` keeps its
signature (services/recorders/provision_events.py uses it for the push key).

Intentional, strictly stronger changes (all were already true for the connection key):
- a key created once is hard-linked into place, so two processes creating it at once both end up with the first one's key
  (alarm and messaging keys used `os.replace`, the second creator overwrote the first);
- a key file found with a looser mode is put back to 0600 on read (POSIX);
- the directory entry is flushed after a write (POSIX);
- no temporary file outlives a failed write.

## Tests

New `smplwise_vms/backend/tests/test_secret_files_2438.py` (16 tests). The interruption is a failing `fsync` of a regular file
(full disk / I/O error before the data is durable).

Reproduced before the fix (adopter files from `origin/main`, new module present): **7 failed, 8 passed, 1 skipped**:
`test_an_interrupted_keyring_write_keeps_the_signing_identity`, `test_an_interrupted_private_key_write_leaves_no_empty_key_file`,
`test_an_interrupted_fleet_state_write_leaves_the_old_state_and_no_fixed_tmp`, and the alarm-code, messaging, e-mail password and
connection-key "interrupted ... leaves nothing" tests (stray `.tmp` files). After the fix: **15 passed, 1 skipped**
(`test_a_planted_fleet_tmp_link_is_never_followed` needs POSIX symlinks; it runs on the runner).

`tests/test_cr022_security_review.py::test_f13_...` now patches `secret_files._POSIX` / `secret_files.fsync_dir` (the mode check
and the directory flush moved there); its assertions are unchanged.

Local focused run: see the last section.

## NOT_RUN

- Full backend suite and the POSIX-only symlink test: runner entry check.
- No UI change, no pixels.

## Local focused run (actually run)

`py -3.12 -m pytest -p no:xdist -o addopts="" -q` (workstation venv, CPU shared with other agents) over
`test_secret_files_2438.py test_signing.py test_alarm.py test_alarm_managed_cache.py test_cr022_security_review.py
test_cr022_security_rereview.py test_cr022_security_third_review.py test_fleet_receiver_fixtures_215.py test_fleet_report_215.py
test_messaging_accounts_runtime.py test_messaging_accounts.py test_notify_email.py test_nvr_connection.py test_secrets_store.py
test_security_review_220.py test_wiskey_station_encryption.py`: **386 passed, 1 skipped** (24 min 34 s).
