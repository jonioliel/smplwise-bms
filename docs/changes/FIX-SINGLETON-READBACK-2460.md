# FIX-SINGLETON-READBACK-2460 - the WisKey readback's last negotiation is reset per test

Branch `pilot/FIX-SINGLETON-READBACK-2460`, cut from `origin/release/2450-train` (b643e8e7a, the 2.45.0 release candidate). Target 2.46.0.

The 2.45.0 targeted gate run (b643e8e7a) passed with one flaky backend test:
`test_singletons_registered::test_every_module_level_singleton_is_registered_or_recorded` failed in its shard and passed alone. The inventory
(CR-BE-COMPLEXITY-B-2450) counts a module-level mutable value; `smplwise.services.wiskey_readback._LAST` is `None` at import and a dict once a
test has negotiated, so it was seen only when an earlier test in the same process had set it. It now registers a reset with
`smplwise.test_reset` (back to `None`), like the other module states.

Left out of 2.45.0 on purpose: the release gate had already passed on b643e8e7a and this is a test-hygiene change.

Tests: `tests/test_singletons_registered.py` (PC, `.venv`): 4 passed; ruff on the file: clean. No product behaviour changes (the reset
runs only in the test fixture).
