# WISKEY-RELAY-INV-2520 - `stations/relay_inventory_v1` as a read-only consumer (row R3 of WISKEY-RESYNC-2520)

Branch `pilot/WISKEY-R3-2520`, cut from `origin/pilot/WISKEY-RESYNC-2520` (`a7eb3159a`, slice R1). Target version: 2.52.
Spec: `docs/changes/WISKEY-RESYNC-2520.md` section 3 (row `stations/relay_inventory_v1`) and section 6 (row R3); WisKey master ids
R5, B4, F1. Nothing was installed, nothing touched the lab, no message went to WisKey, no relay was tested or actuated.

## 1. What and why

WisKey rc.19 answered our request for a "harmless relay test" (R5 / B4) with: there is none, and a `dry_run` flag does not make one;
the supported path is a READ, `stations/relay_inventory_v1`, that separates three things (F1): the remote-control API outputs the
station profile reported at load, WisKey's saved physical <-> API mapping, and the physical relays - whose count is `null` and whose
roles are `unknown` because nothing measured them. This row consumes exactly that READ, read-only, next to Arx's own relay map:

- Arx shows what WisKey knows, and shows unknown as unknown: "physical relay count: unknown", "relay role (door / gate): unknown",
  "relay test without actuation: not supported by WisKey", API outputs "not observed" when WisKey has no capability (never zero).
- Arx never infers `single_relay` from `api_outputs.count`, never turns WisKey's saved mapping into a measurement, and never changes
  its own relay map (WISKEY-RELAYMAP-2310: the 10 doors mapped on 11.11 stay an Arx approval, not a "confirmed" fact).
- No relay test, no pulse, no `dry_run`, no approval of any kind is invented; a physical check stays an owner approval per door and time.

Source of the contract (read only, WisKey repository not modified): WisKey PRODUCT `3e7bfc585d5a30bddd97ceeed1bb0d7032ee021d`
(2.0.1-rc.19) `docs/contracts/relay-inventory-v1/` (CONTRACT.txt, request / result / error schemas, SCHEMA_INDEX, EXAMPLE_INDEX),
`custom_components/hikvision_intercom/relay_inventory.py` (producer), `websocket.py` (`{"station_id": str}`), `api_contract.py`
(`READ_COMMANDS`, capability `station_relay_inventory_v1`), `panel_permissions.py` (`stations: view`); hand-off
`8c6b10208e3fc356581d73a49a062a7a62f726f9` `CONSUMER_ADOPTION_DELTA.json` (relay line) and `MASTER_TASKS_REVIEWED.json` (R5, B4, F1).

## 2. Behaviour

`GET /api/v1/wiskey/relay-map/inventory/{station_id}` -> `{station_id, state, reason, wiskey_code, fetched_at, data}`.

| step | rule |
|---|---|
| permission | the relay map card's own: `system.configure` or `access.admin.read` at the installation (audited 403), and the same permission on the station's chain (a deny on the station = audited 403). Checked before anything is sent. |
| station | only a station of the served WisKey copy is ever named to WisKey (else 404 `intercom_station_not_found`, nothing sent); control characters refused. |
| discovery | sent only when WisKey lists `stations/relay_inventory_v1` in `overview.api.commands`; not listed / unknown list / no copy / newer client needed -> `unsupported`, nothing sent. The lab's rc.10 does not list it: the tested path there is "nothing sent". |
| frame | ONE frame `{type: hikvision_intercom/stations/relay_inventory_v1, station_id}` on the `relay_inventory` channel (R1's registry), no `api_contract` (a WisKey READ), no other key; never queued, never retried. |
| projection | the result schema is closed and pins its constants, so the document is checked, not copied. Refused whole (`error` / `contract_mismatch`, no data shown): an undeclared key at any level, a wrong type (`"false"`, `true` as an id), `physical_relay_count` not null, `physical_verified` not false, a supported relay test or another reason, a role other than `unknown`, a confirmation other than `saved_configuration`, an id outside 1 / 2, duplicate ids, a count that disagrees with the ids, `not_observed` with ids or a count, `count: 0`, another station's id, `schema` not 1, lists longer than 2. |
| refusals | WisKey `unauthorized` -> `forbidden`; `station_unloaded` -> `unavailable` (reason `station_unloaded`); `unknown_command` -> `unsupported`; a request-level refusal (`station_not_found`) -> `unavailable`; rate / slots -> `busy`; no session -> `unavailable`. No fallback command, no retry. |
| writes | none: no Arx table is written (test proves the relay map tables are unchanged), no audit row on success (a read), audited 403s. |

UI (Settings › הגדרת מערכת › WisKey › "מיפוי ממסרים"): per station in the WisKey copy a small ghost button "מה WisKey יודע על
הממסרים" opens, on request only (no read on page load, so ten stations never fire ten reads), a compact list: API outputs the station
reported, mapping saved in WisKey ("saved setting, not a measurement"), physical relay count "לא ידוע", relay role "לא ידוע", relay
test without actuation "לא נתמכת ב-WisKey", and the note that API outputs are not physical relays and that the read does not change the
approved mapping. A non-ready read shows one honest sentence (not offered by this WisKey - nothing sent / refused / station not loaded /
not available / busy / answer does not match the contract / failed). Existing tokens and components only; Hebrew + English.

## 3. Files

| file | change |
|---|---|
| `smplwise_vms/backend/smplwise/services/wiskey_relay_inventory.py` | new: discovery, frame, closed projection, read |
| `smplwise_vms/backend/smplwise/routers/wiskey_relay_map.py` | +1 GET (`/wiskey/relay-map/inventory/{station_id}`), module note |
| `smplwise_vms/backend/smplwise/wire/wiskey_relay_map.py` | +6 response models (`WiskeyRelayMapRelayInventory*`) |
| `frontend/src/api/generated/wire-wiskey-relay-map.ts` | regenerated (`scripts/gen_wire_types.py`) |
| `frontend/src/api/wiskey-relay-map.ts` | `getRelayInventory`, `RelayInventory` |
| `frontend/src/screens/wiskey-relay-map-logic.ts` | `inventoryView`, `inventoryMessage` (pure) |
| `frontend/src/screens/wiskey-relay-map.ts` | the on-request inventory block per station |
| `frontend/src/i18n/lang/en/i18n/msg/wiskey.ts` | 23 English lines (relay-map section) |
| `smplwise_vms/backend/tests/test_wiskey_relay_inventory_2520.py` | new |
| `smplwise_vms/backend/tests/fixtures/wiskey_rc19/relay-inventory-v1/*` | WisKey's synthetic examples + result schema, unchanged bytes (sha256 = WisKey's EXAMPLE_INDEX / SCHEMA_INDEX, checked by a test) |
| `frontend/tests/unit-wiskey-relay-map.spec.ts` | +3 tests |
| `frontend/tests/evidence-wiskey-relay-inv-2520.spec.ts` | new: compare-page shots (mocked backend, invented names) |

Not touched (R1's shared registry, per the brief): `services/wiskey_channels.py`, `tests/test_wiskey_system_status_2520.py`,
`tests/test_pwclean_295.py`, `routers/__init__.py`, `scripts/gen_wire_types.py`. See section 5.

## 4. Tests (real results)

PC (one file at a time, repo venv, Python 3.12):

| command | exit | result |
|---|---|---|
| `python -m pytest tests/test_wiskey_relay_inventory_2520.py` | 0 | 65 passed |
| `python scripts/gen_wire_types.py --check` | 0 | generated files match |
| `python scripts/wire_ratchet.py` | 0 | 897 unmodelled = baseline 897 (the new route is modelled) |
| `py -3.12 -m ruff check` on the 4 changed / new Python files | 0 | all checks passed |
| `python -m pytest tests/test_wiskey_system_status_2520.py` (R1) **without** the registry follow-up | 1 | `test_the_reserved_channels_are_registered_but_nobody_sends_on_them` FAILS by design: it asserts that no module names the reserved `relay_inventory` channel "until its row lands" - this row is that module. See section 5. |
| same three R1 files **with** the registry follow-up applied (not committed) | 0 / 0 / 0 | `test_wiskey_system_status_2520.py` 40 passed; `test_wiskey_channels.py` 42 passed, 7 skipped; `test_pwclean_295.py` 15 passed |

### 4.1 Runner (slot B)

Runner, slot B (`~/work/slotb.sh`), worktree at `a004f803a` (this branch's implementation commit), `SW_WIRE_STRICT=1`; the job started
while the 2.51 train gate ran (slot B waited for memory, as designed). Log: `~/work/wkr3_job.log` on the runner.

| command | exit | result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` (frontend) | 0 | clean |
| `npm run typecheck` (tests + scripts tsconfigs) | 0 | clean |
| `npx eslint` on the 3 changed frontend source files | 0 | clean |
| `playwright test tests/unit-wiskey-relay-map.spec.ts tests/unit-i18n-en-ratchet-2490.spec.ts --project=desktop --workers=2` | 0 | 14 passed |
| `SW_SHOTS=1 SW_SHOT_PHASE=after playwright test tests/evidence-wiskey-relay-inv-2520.spec.ts` (vite dev, this branch) | 0 | 1 passed (8 shots; asserts count / role "לא ידוע", no sideways scroll at 1440 and 390) |
| same, `SW_SHOT_PHASE=before`, on a worktree of the base `a7eb3159a` | 0 | 1 passed (4 shots) |
| `pytest tests/test_wiskey_relay_inventory_2520.py` | 0 | passed (65 on the PC run) |
| `pytest tests/test_wiskey_relay_map_writer_2310.py`, `..._export_2320.py`, `..._native_mac.py` (existing relay map) | 0 / 0 / 0 | passed |
| `pytest tests/test_wire_routers_e_2480.py` (runs `gen_wire_types --check`) | 0 | passed |
| `pytest tests/test_wiskey_channels.py` | 0 | passed |
| `pytest tests/test_wiskey_system_status_2520.py` (R1) | 1 | 1 failed by design: `test_the_reserved_channels_are_registered_but_nobody_sends_on_them` (section 5); the rest passed |
| `scripts/gen_wire_types.py --check` | 0 | generated files match |
| `scripts/wire_ratchet.py` | 0 | 897 = baseline 897 |

Per-file pass counts of the runner pytest runs were not captured (the log kept the last 3 lines, which were warnings); exit codes are
the real result. Compare page (Hebrew, desktop 1440 + phone 390, light + dark, before / after; private, not in Git):
`private/planning/wiskey_relay_inv_compare_2026-11-25.html` with images in `private/planning/wiskey_relay_inv_2520/`. In the phone
shots the harness (one card on an empty page) clips the card's last line; in the real settings page the card scrolls with the page.

NOT_RUN: full backend suite and full Playwright suite (the train gate runs them); live WisKey / lab (no lab access by rule; the lab has
WisKey rc.10, which does not list the command - the read answers `unsupported` and sends nothing, which is the tested path).

## 5. Registry follow-up (needs the lead / R1 owner - NOT committed here)

R1 registered `relay_inventory` as RESERVED (`in_use: False`) and its test asserts that no module names it. Landing this row therefore
needs a three-file change in R1's files, which the brief reserves to R1 ("stop and report instead of editing"):

- `services/wiskey_channels.py`: `RESERVED_CHANNELS = frozenset({"station_sync_v1"})`; `describe()["relay_inventory"]["in_use"] = True`;
  the comment says "IN USE since WISKEY-RELAY-INV-2520".
- `tests/test_wiskey_system_status_2520.py`: `RESERVED_CHANNELS == {"station_sync_v1"}`, the "nobody names it" scan covers
  `station_sync_v1` only, plus `assert ch.describe()["relay_inventory"]["in_use"] is True`.
- `tests/test_pwclean_295.py`: comment only.

The exact patch (65 lines) was verified (section 4, last row) and handed to the lead with the report. No allow-list changes: the
channel's command set stays `{stations/relay_inventory_v1}`.

## 6. Rollback

Revert the commit(s): no migration, no setting, no stored data; the relay map is unchanged by construction.

## 7. Open questions

1. Registry follow-up (section 5): a) the lead applies the patch on R1's branch / at merge (recommended) b) this branch commits it
   (crosses the file split) c) R1 keeps `relay_inventory` reserved and this row waits.
2. When to read: a) on request per station (built; recommended - no burst of reads, no read for a station nobody looks at)
   b) automatically for every station when the card opens.
3. Arx's own mapping vs WisKey's saved mapping when they differ: a) show both side by side, never reconcile automatically, no warning
   colour (built; recommended - neither is a measurement) b) add a "differs" hint (a later row, text only).
