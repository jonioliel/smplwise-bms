# Local gate tool for the intercom integration source (WX3)

Status: spec plus first working version, 2026-10-05, Arx. Tool: `scripts/wiskey_gate.py` (Python 3.12, standard library only).
Tests: `smplwise_vms/backend/tests/test_wiskey_gate.py` (26 cases, small synthetic fixtures, models and fakes only).
Nothing here touches hardware, Home Assistant, the network or a secret, and nothing here installs or releases anything.

## 1. Purpose and what changed

The gate validates a **source folder** of the intercom integration, plus its tests and notes, offline. Owner decision of this
round: **WisKey packages nothing**. The Arx importer takes the source and builds its own hashes and manifest. So there is no
WisKey-authored `release-manifest.json`, no zip and no `ready/<version>/` folder in this flow. The earlier schemas
(`docs/wiskey-exchange/schemas/1/`, GATE.md, CRITERIA.md, BASELINE_EXCLUSIONS.md) remain the reference for exit codes, the
baseline format and the criteria wording; where they speak of a delivered package, this document replaces that part.
Fields the manifest used to carry (`breaking`, `risk_to_doors`, `migrations`, rollback) now have to come from `ARX_IMPACT.md`
and `RELEASE_NOTES.md`: see open question 4.

The gate is the first stage ("stage 0") of the Arx import. A red gate stops the Arx release. A green gate is not an installation
approval and not an approval for any live run.

## 2. Source layout the importer takes (and the gate checks)

```
<source>/
  custom_components/<domain>/       exactly one domain; manifest.json (domain = dir name, version = semver)
  tests/                            test_*.py (and fakes)
  requirements-ha-test.txt          every line pinned with ==
  pytest.ini | setup.cfg | tox.ini | pyproject.toml | conftest.py     scanned for socket options
  RELEASE_NOTES.md                  bilingual, fixed headings (3.2)
  ARX_IMPACT.md                     every topic answered, "none" allowed (3.2)
  contract/ws-commands.json, errors.json, contract version (CONTRACT_VERSION file or `contract_version` key)
  docs/AUTONOMOUS_TIMERS.md         required
  docs/PROVIDER_INTERFACE.md        recommended (warning if missing)
```

Everything else in the tree (for example `private/`, `probe-output/`, `handoff/`, `logs/`, `tools/`, `frontend/` source) is
**not imported**. It is neither scanned nor hashed; the manifest lists which such directories exist (`not_imported_dirs`) so a
reviewer sees them. `.git`, `node_modules`, `.venv` and caches are skipped entirely.

## 3. Commands

```
python scripts/wiskey_gate.py check     --source DIR [--installed-version V] [--baseline F --baseline-sha256 H]
                                        [--socket-exceptions F --socket-exceptions-sha256 H] [--source-commit SHA] [--json OUT]
python scripts/wiskey_gate.py manifest  --source DIR [--source-commit SHA] [--out F]
python scripts/wiskey_gate.py run-tests --source DIR [--budget-seconds N] [--expected-collected N] [--json OUT] [-- <test command>]
```

`check` never executes any code from the source. `run-tests` executes the source's own test command and is the only command
that does; it is the stage run in the sealed gate environment (offline guard of section 6; the OS-level network block of
GATE.md section 3 still applies on the real gate machine and is not replaced by the guard). **`run-tests` was exercised in
this task only against trivial `python -c` commands in the unit tests, never against the WisKey suite.**

### 3.1 Exit codes

Those of GATE.md: 0 pass, 1 fail, 2 input_invalid, 3 timeout, 4 missing_tests, 5 exclusions_violation, 6 environment_error,
7 network_attempt, 70 internal_error. With several failures the first of 6, 2, 5, 7, 3, 4, 1 wins. Only 0 is success. An
exception inside the tool is 70, never a pass. The mapping of finding classes: `S_*` (structure) is 2, `R_*` (policy) is 5, `M_*`
(missing tests) is 4. Extending 5 from "exclusions" to "policy violations" is a proposal (open question 2); a finding's `code`
is always specific.

### 3.2 Notes

`RELEASE_NOTES.md` has headings containing, in any order, `Added`, `Fixed`, `How to enable`, `Risk to doors`, `Rollback`
(case-insensitive, Hebrew may follow in the same heading), contains Hebrew and English text, and mentions the manifest version.
`ARX_IMPACT.md` addresses every topic: `WS commands`, `permissions`, `entities`, `storage schema`, `settings`, `restart`,
`migration` (write "none" when nothing changed).

## 4. Checks (finding codes)

| Code | Exit | What |
|---|---|---|
| `S_NO_CUSTOM_COMPONENTS`, `S_DOMAIN_COUNT`, `S_DOMAIN_NAME`, `S_MANIFEST_MISSING/JSON/FIELD`, `S_DOMAIN_MISMATCH` | 2 | exactly one domain, strict JSON (duplicate keys refused at any depth), `domain`, `name`, `version` present, name equals directory |
| `S_VERSION_FORMAT`, `S_VERSION_NOT_GREATER`, `S_INSTALLED_VERSION_FORMAT` | 2 | semver `X.Y.Z` or `X.Y.Z-rc.N`; with `--installed-version` the new version must be greater (an rc is below its release); Arx never downgrades |
| `S_NO_TESTS`, `S_REQUIREMENTS_MISSING`, `S_REQUIREMENT_NOT_PINNED` | 2 | tests exist; `requirements-ha-test.txt` pinned |
| `S_NOTES_*`, `S_IMPACT_*` | 2 | section 3.2 |
| `S_CONTRACT_MISSING/FILE/JSON/VERSION` | 2 | `contract/` present, both JSON files strict, a contract version present |
| `S_TIMERS_DOC_MISSING` | 2 | `docs/AUTONOMOUS_TIMERS.md` present. `S_PROVIDER_DOC_MISSING`, `S_CRLF` are warnings |
| `S_PY_SYNTAX` | 2 | a Python file under the package or tests does not parse |
| `R_FORBIDDEN_IN_PACKAGE` | 5 | inside `custom_components/<domain>/`: `tests/`, `private/`, probes, logs, `.git`, `node_modules`, `secrets*`, `.env`, `*.log`, `*.pem`, `*.key`, `*.pyc`, archives, databases, captures |
| `R_LEAK_IP` | 5 | an IPv4 address that is not loopback, unspecified, mask-like or in an RFC 5737 documentation range |
| `R_LEAK_MAC`, `R_LEAK_SERIAL`, `R_LEAK_SECRET`, `R_LEAK_TOKEN`, `R_LEAK_PRIVATE_KEY` | 5 | MAC (except all-zero, all-ff and the RFC 7042 documentation prefix); `serial`/`password`/`secret`/`token`/`api_key`/`hmac`/`pairing`/`signing_key`/`pin_code`-named variable assigned a literal that carries no placeholder word; JWT-shaped token; PEM private-key header |
| `R_TIMER_UNDOCUMENTED` | 5 | a module of the package that arms an autonomous timer (`async_track_time_interval`, `async_call_later`, `async_track_point_in_time`, `async_track_time_change`, ...) is not named in `docs/AUTONOMOUS_TIMERS.md` |
| `R_SOCKET_NEW_USE`, `R_SOCKET_EXCEPTIONS_UNREGISTERED`, `S_SOCKET_EXCEPTIONS_INVALID` | 5 / 5 / 2 | section 5 |
| `R_BASELINE_UNKNOWN`, `R_EXCLUSION_NOT_IN_BASELINE`, `R_MANDATORY_TEST_EXCLUDED` | 5 | section 5.2 |
| `M_MANDATORY_MISSING` | 4 | a mandatory selector has fewer static tests than `min_count` (warning only when the file is parametrized: the static count is a lower bound) |

**Findings never contain the matched value.** A finding has `code`, `severity`, `message`, `path`, `line` (and a node id), so a
report can be shared without becoming a leak itself. The scan is heuristic by design (it flags candidates for a human). A
justified synthetic value is allowed with an inline marker on the same line:
`# gate:allow(R_LEAK_IP): <reason of at least 10 characters>`. The code must match, the reason is mandatory, and allowed hits
are listed under `allowed` in the report so the reviewer sees them. The scan covers the import set only (section 2).

## 5. Registered inputs: socket exceptions and the baseline

### 5.1 Socket scan (mirrors `gate-env/3`, `socket-review/1`)

An AST scan of `tests/**/*.py` and `conftest.py`, plus a line scan of `pyproject.toml`, `setup.cfg`, `pytest.ini`, `tox.ini` (comment
lines ignored). Mechanisms, the nine of the registered file: `fixture_socket_enabled` (a parameter named `socket_enabled`),
`marker_enable_socket`, `marker_allow_hosts` (also through an alias of `pytest.mark`), `call_socket_allow_hosts`,
`call_enable_socket` (also `from pytest_socket import enable_socket as x`), `string_lookup` (`getfixturevalue`, `usefixtures`,
`addinivalue_line` with those names), `import_pytest_socket`, `cli_or_ini_option` (`--allow-hosts`, `--force-enable-socket`,
`--allow-unix-socket` in addopts-like variables, `main`/`addoption`/`parse_args` arguments, or an ini file), `plugin_disabled`
(`-p no:socket`, `-pno:pytest_socket`). A string written as passive input (for example source text written to a temporary file by a
test of a scanner) is not a use. Keyword arguments and annotated assignments are followed.

Every site must be covered by the **registered** exceptions file: same `path`, same `file_sha256` of the file as it is, same
`mechanism`, a site with the same `line` and `function`, `network_scope: loopback_only`. The file itself must be a valid
`arx-exchange/socket-exceptions/1` document with `allow_unix_socket` and `force_enable_socket` false, and its SHA-256 must equal
the value passed in `--socket-exceptions-sha256` (Arx supplies the registered hash through its own channel). A valid file with another
hash is `R_SOCKET_EXCEPTIONS_UNREGISTERED` (5). A one-byte change in a covered test file voids the exception (new use, 5).
Without a file every use is new.

Smoke check against the real WisKey tree (read-only, `check` only, nothing written there): the scan reports exactly two sites,
`tests/ha/test_media_settings.py:46` and `tests/ha/test_profiles_rtc.py:20`, the two in the registered file.

### 5.2 Baseline

With `--baseline` and `--baseline-sha256` (the registered baseline, schema `arx-exchange/baseline-exclusions/1`): a test excluded
by a `hardware`, `repo_only` or `skip` marker that is not in `exclusions` is `R_EXCLUSION_NOT_IN_BASELINE`; an excluded test that
matches a `mandatory` selector (`file` or `node_id`) is `R_MANDATORY_TEST_EXCLUDED`; a mandatory `file`, `node_id` or `marker`
selector whose static count is below `min_count` is `M_MANDATORY_MISSING`. Without a baseline these checks are reported as
`NOT_RUN` in the report, not as a pass. The static count does not replace the real collection count (`expected_collected`) that
`run-tests` compares.

## 6. Manifest computed by Arx (what "builds its own hashes" means)

`manifest` (and the `manifest` field of every `check` report) is deterministic: no timestamp, sorted paths, no machine data.

```
schema: arx-exchange/import-manifest/0   (draft, local to this tool)
profile: unsigned_for_test               signature: null     (appendix B of HMAC_ROTATION_PROCEDURE.md)
domain, version (from manifest.json), source_commit (optional, from --source-commit)
package.files[{path,size,sha256}], package.file_count, package.tree_sha256     custom_components/<domain>/ without pycache
tests.* , contract.*                                                           same shape
notes_sha256{RELEASE_NOTES.md, ARX_IMPACT.md, requirements-ha-test.txt, docs/AUTONOMOUS_TIMERS.md, docs/PROVIDER_INTERFACE.md}
registered_inputs{baseline_sha256, socket_exceptions_sha256}                   as passed in
not_imported_dirs[]
```

`tree_sha256 = SHA-256 over the UTF-8 lines "<file sha256>  <posix path>\n" sorted by the path bytes`. Files are hashed as stored
(LF is enforced by `.gitattributes`; CRLF in the package is a warning). The importer's deterministic archive (if Arx builds one)
and the installed marker are Arx's business and are not defined here.

## 7. `run-tests` and the offline guard

`run-tests` runs the given command (default `python -m pytest -q -o addopts= -p no:cacheprovider`) from the source folder with
`PYTHONDONTWRITEBYTECODE=1`, proxy variables removed, and a temporary `sitecustomize.py` first on `PYTHONPATH`. The guard installs an
audit hook that refuses, with `OSError`, any `socket.connect`, `sendto`, `bind` to a non-loopback address and any DNS lookup of a
non-loopback name (`localhost`, loopback addresses and Unix-domain paths pass; the registered loopback fixtures need them). Every
refused attempt is counted in a temporary log (event name only, no address). Result mapping: any attempt gives 7; the hard limit
`budget + 60 s` gives 3; pytest exit 5, or fewer collected tests than `--expected-collected`, gives 4; any other non-zero pytest
exit gives 1; a command that cannot start gives 6.

Limits, stated plainly: an audit hook is a **detector and a guard in the Python process**, not a sandbox. Native code and
subprocesses that do not inherit the guard could bypass it, so the real gate machine still blocks the network at OS level
(GATE.md: container with no network). The guard is why a test that tries the network fails loudly even on a developer laptop.
Environment preparation (offline wheelhouse, `pip check`, the 13-component import, `TurboJPEG()`) is the gate-environment recipe of
`gate-env/3` and is not done by this tool: NOT_RUN.

## 8. Fake-station test harness: design (not built)

The suite must prove door safety without a station. The harness design WisKey and Arx agree on, to be built in the integration's
`tests/fakes/` and run by `run-tests`:

1. **`FakeStation`** implements the provider interface (`docs/PROVIDER_INTERFACE.md`) with an in-memory transport: no socket, no
   HTTP. It reports capability flags, holds a configurable relay map (`physical_index` to api id; `{2}` alone must refuse relay 1),
   and records every command (relay, time on a virtual clock) in an ordered log the tests assert on.
2. **Scripted behaviour** per scenario: success, delay, timeout after a possible send, rejection, malformed answer, connection drop
   mid-command, restart between persist and send.
3. **Virtual clock and storage fakes**: injectable UTC and monotonic clocks (clock health, anchor, high-water cases), a storage
   fake with fault injection (pending-record write failure gives `state/storage_unavailable` before any send; outcome-write
   failure after a send gives `unknown/outcome_persistence_failed`).
4. **Matrix**: every scenario runs against every fake provider (Hikvision-shaped, Akuvox-shaped) filtered by capability flags, so
   adding a vendor adds a row, not a test file.
5. **Required scenario set** (names are the mandatory-test categories of the baseline): `trusted_caller` (signature, replay,
   expiry, size, capability revoked, duplicate request id, status of an unknown id), `door_safety` (no second open, no open on
   uncertain state, hold-open tick after restart), `storage_migration` (dry-run, backup, counts), `install_safety`.
6. **Markers**: anything that needs hardware is `hardware` and is excluded only through the registered baseline; the gate refuses
   a growing exclusion list.
7. **Determinism**: no sleeps (virtual clock), fixed seeds, no wall-clock reads outside the injected clock, no network, runtime
   budget recorded.

The harness is a contract for WisKey's tests; Arx only checks, through the baseline and the guard, that it is used and that nothing
escapes it.

## 9. Report

`--json` writes `arx-exchange/local-gate-report/0` (draft): `exit_code`, `result`, `domain`, `version`, `findings[]`, `allowed[]`,
`socket_sites[]` (without hashes), `manifest`, `not_run[]`, `summary_en`. A Hebrew one-line summary for the owner is produced by the
Arx screen that shows the report, not by the tool.

## 10. Calibration on the real tree (read-only, counts only)

`check` against `C:\hik intercom` found, as expected for a tree that predates this layout: the notes, impact, contract and timers
documents missing (structure, exit 2); the two registered socket sites reported as new use because no exceptions file was supplied
in the smoke run; 15 leak candidates (4 IPv4, 2 MAC, 6 secret-named and 3 serial-named literals, in tests, documents and an XML fixture) after the
placeholder list was tuned on this very tree (about 25 before the tuning, mostly obviously synthetic test passwords). None of these were
inspected for their values, and none is claimed to be a real leak: they are what WisKey must review, redact, or mark with
`gate:allow`. No file in the WisKey repository was modified.

## 11. Not done and not claimed

NOT_RUN: the WisKey test suite, `pip check`, the Home Assistant import, collection counts, hardware, anything live.
Not implemented: signature verification (appendix B), contract diff (`scripts/wiskey_contract_diff.py` is a separate piece),
the structured impact block (open question 4), pinning of the gate-environment digest, wheelhouse hashing, an OS-level network
sandbox, the Hebrew rendering of the report.

## 12. Unit tests (what they prove)

Clean tree passes and the manifest is byte-stable; the tree hash changes with a byte and ignores bytecode; structure failures give 2;
semver and the not-greater rule; forbidden content in the package gives 5; `private/` is neither scanned nor imported; leaks are
found without echoing the value (the test asserts the values are absent from the report); `gate:allow` needs the right code and a
reason; private-key and token shapes; undocumented timers; the nine socket mechanisms by AST; passive strings are not use; ini
options; registered exceptions pass only with the registered hash and fail when the file changes by a byte; invalid exceptions file;
baseline hash, new exclusions, mandatory exclusion, missing tests (4), parametrized lower bound; exit-code priority; the offline guard
passes a clean command, blocks and counts a connect and a DNS lookup, allows loopback, and maps pytest 1 and 5, a short collection
count and an unstartable command; the command line.
