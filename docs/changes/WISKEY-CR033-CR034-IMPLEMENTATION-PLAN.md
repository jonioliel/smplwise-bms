# WisKey door path and key rotation: combined implementation plan (CR-033 + CR-034)

Status: PROPOSED (2026-10-10). Planning document only. Each slice runs only after the owner approves the change requests
(entry conditions A7 and A8 of the 2026-10-10 continuous handoff) and, where marked, after a separate owner approval or a WisKey
answer. Nothing here authorises a live run, a door test, a key action or a release.

Details live in `CR-033-WISKEY-DOOR-PATH.md` (slices D*) and `CR-034-WISKEY-HMAC-ROTATION.md` (slices H*, G*).
**W?** = depends on WisKey behaviour that Arx has not verified.

## 1. Slices in dependency order

| Wave | Slice | Depends on | External gate | Hours | Model |
|---|---|---|---|---|---|
| 1 | D0 trusted-bridge fakes, fake overview, vector oracle | - | - | 3 | Opus |
| 1 | H0 rotation fakes (two-process model, monotonic clocks, crash points) | - | - | 4 | Opus |
| 1 | G0 merge the WX3 gate tool and its tests to main | - | - | 1 | Sonnet |
| 2 | D1 door map (migration 0078) | D0 | **W?** explicit relay field (manual fallback exists) | 4 | Opus |
| 2 | D2 station scope (migration 0077) | - | - | 6 | Opus |
| 2 | G1 impact block, exit 5, `gate:allow` | G0 | **W?** WisKey authors the block for installation candidates | 4 | Sonnet |
| 2 | H2 Arx key set, rotation state machine (migration 0079) | H0 | - | 10 | Opus |
| 3 | D3 one authority rule, `door_opener` role, grant card | D1, D2 | - | 6 | Opus (+ Sonnet UI) |
| 3 | D6 WisKey locks without `lock.lock` / lock-all | D1 | - | 2 | Sonnet |
| 3 | H1 bridge multi-key verifier, `rotate`, 180 s cap | H0 | **W?** answers to question 31 (capability survives key change; no key-bearing logs) before merge | 10 | Opus |
| 3 | H3 `bridge.key.rotate`, owner contacts, emergency notice | H2 | - | 3 | Opus |
| 4 | D4 `trusted_door` (interim transport with the flag off), audit fields, "sent" | D0, D3 | - | 8 | Opus |
| 4 | H4 fresh-key re-pair with verification, reveal, emergency revocation | H2, H3 | - | 6 | Opus |
| 4 | H5 maintenance screen, watchdog | H2, H4 | - | 4 | Sonnet |
| 5 | **Add-on release** carrying D1..D4, D6 (flag off) | wave 4 | owner release rule | - | - |
| 5 | D5a bridge 0.8.1: `execute` blocked for WisKey doors, signed policy, Arx setting | D4 released | - | 4 | Opus |
| 5 | D7 read-only inventory and report | D1 | - | 6 | Opus |
| 6 | **Owner-approved read** of the inventory on the installation (Arx database only) | D7 | owner approval | - | - |
| 6 | D8 editor block setting (default blocked) | D7 | - | 3 | Sonnet |
| 6 | D9 run guard for Arx-started runs (R-17) | D4, D7 | - | 6 | Opus |
| 7 | D10a Arx event door jobs (M1), disable-and-list | D9, inventory result | only if the inventory finds event-driven items | 10 | Opus |
| 7 | D10b hold-open program hand-over (M3) | D9, inventory result | **W?** WisKey offers program creation for an Arx operator | 4 | Opus |
| 7 | H6 anchor eligibility record, capability status hand-over | H1, H4 | **W?** WisKey mechanism for the high-water decrease | 3 | Opus |
| 8 | Bridge 0.9.0 = H1 (rotation) | H1, H7 | owner release approval | - | - |
| 8 | D5b bridge `door_open` / `door_open_status` (built on the multi-key verifier, bridge 0.9.x) | H1, D4 | **W?** WisKey consumer side confirmed | 8 | Opus |
| 9 | H7 rotation gate on fakes, second review | H1..H6 | - | 2 | Sonnet + Opus |
| 9 | D11 door-path gate T1..T26 on fakes (DR-8), conversion list to the owner | all D | - | 3 | Sonnet + Opus |
| 10 | Owner-approved steps, each on its own: flag `doors.trusted_path` on; one-door acceptance test; lab rotation on a copy, then a live rotation; WisKey lock-breaking release | D11, H7 | owner, WisKey | - | - |

Totals: CR-033 73 h (59 h if the inventory finds no autonomous items, i.e. without D10a and D10b); CR-034 47 h; together
**120 h** (106 h without D10). Opus about 99 h of the 120 h (plus the review halves of D11 and H7). Two agents in parallel along the waves give roughly 9 to 11 working days of
wall time; the external gates (W?) and owner approvals are not included and cannot be estimated.

Critical path (Arx only, flag still off): D0 -> D1 -> D3 -> D4 -> add-on release -> D5a = 25 h. Rotation path: H0 -> H2 -> H3 -> H4 ->
H5 = 27 h, with H1 in parallel (blocked at merge on the WisKey answers).

Why H1 before D5b: `door_open` is then born on the multi-key verifier and never needs a second verifier change; it also lets bridge
0.9.0 ship rotation without waiting for WisKey's consumer.

## 2. Mapping of OWNER01 items 13..30 to slices

| Item | Decision | Slices | Notes |
|---|---|---|---|
| 13 | ג: either permission, easy grant | D3 (rule, role, card), D4 (both routes call it) | deny wins across both |
| 14 | א: station scope before the lock release | D2 | before step 10 |
| 15 | א: read-only inventory | D7, owner-approved read (wave 6) | |
| 16 | א: block new WisKey door steps, admin setting, default blocked | D8 ("allowed" selectable after D10a) | contradiction CR-033 13.3 |
| 17 | closed rule R-17 | D9, D4 | |
| 18 | א: `config_entry_id` + `physical_index`, explicit | D1 | **W?** explicit field |
| 19 | א: wait for the query; hold-open programs for fixed schedules, Arx event automations for events | D10b (M3), D10a (M1) | conditional on the inventory |
| 20 | א: block `execute` in bridge 0.8.1, admin setting, default blocked | D5a (+ interim transport in D4) | contradiction CR-033 13.2 |
| 21 | א: request id + body hash in audit, signed format unchanged | D4 | |
| 22 | א: "sent", not "opened" | D4 | |
| 23 | א: two-key overlap up to 3 minutes; hard cut for emergency and re-anchor | H1, H2, H4 | 180 s cap on the bridge |
| 24 | ג: events only | H2, H5 (no timer, no overdue) | |
| 25 | closed rule R-25 | H6 | decrease unavailable without V1c |
| 26 | א: JSON block in `ARX_IMPACT.md` | G1 | **W?** WisKey authors it |
| 27 | א: exit 5 also for policy violations | G1 | |
| 28 | ב: owner or system administrator starts routine rotation | H3 | |
| 29 | א: emergency revoke by an administrator with immediate notice | H3, H4 | |
| 30 | א: `gate:allow(code): reason` | G1 | |

## 3. Points where WisKey's behaviour is unverified (W?)

1. The consumer of the bridge-verified DTO (capability, stages, codes, `door_open_status`): blocks D5b and the flag.
2. The explicit entity -> `physical_index` field promised in the item-18 answer: D1 falls back to single-relay and manual mapping.
3. Hold-open program creation on behalf of an Arx operator, with WisKey's audit: blocks D10b; schedules are disabled and listed until then.
4. Capability lifetime across a bridge key change without an entry reload; no key-bearing logs (question 31): blocks H1 merge.
5. How WisKey learns that a generation change completed with V1c before decreasing its high-water: blocks any decrease (safe default).
6. WisKey records the same `request_id`; whether it can correlate `body_sha256`: not required by Arx.
7. WisKey authors the `arx-impact/1` block for installation candidates.
8. The WisKey lock entity's user check (DR-7) and the lock-breaking release: WisKey's work, separate approval.
9. Behaviour of the renamed domain `smplwise_intercom` (registry platform name, config entry id stability).

## 4. Rows to add to `management/tasks.json` (not edited by this task)

Suggested ids and fields; dependencies as in section 1. All start as `PROPOSED` until the owner approves CR-033 / CR-034.

| id | title | cr | depends_on | estimate_h | model | gate |
|---|---|---|---|---|---|---|
| WXD0 | Trusted-bridge fakes and vector oracle | CR-033 | - | 3 | opus | - |
| WXD1 | WisKey door map (explicit, single relay, manual) | CR-033 | WXD0 | 4 | opus | - |
| WXD2 | Access control station scope and placement | CR-033 | - | 6 | opus | - |
| WXD3 | One door authority rule, door opener role, grant card | CR-033 | WXD1, WXD2 | 6 | opus+sonnet | - |
| WXD4 | trusted_door transport (interim + signed), audit fields, "sent" | CR-033 | WXD0, WXD3 | 8 | opus | - |
| WXD5A | Bridge 0.8.1 execute block for WisKey doors (admin setting) | CR-033 | WXD4 released | 4 | opus | release order |
| WXD5B | Bridge door_open / door_open_status | CR-033 | WXH1, WXD4 | 8 | opus | WisKey consumer |
| WXD6 | WisKey locks without lock.lock / lock-all | CR-033 | WXD1 | 2 | sonnet | - |
| WXD7 | Read-only door-path inventory and report | CR-033 | WXD1 | 6 | opus | - |
| WXD7R | Owner-approved inventory read on the installation | CR-033 | WXD7 | 0.5 | sonnet | owner approval |
| WXD8 | Editor block setting (default blocked) | CR-033 | WXD7 | 3 | sonnet | - |
| WXD9 | Run guard for Arx-started runs (R-17) | CR-033 | WXD4, WXD7 | 6 | opus | - |
| WXD10A | Arx event door jobs (M1), disable-and-list | CR-033 | WXD9, WXD7R | 10 | opus | inventory result |
| WXD10B | Hold-open program hand-over (M3) | CR-033 | WXD9, WXD7R | 4 | opus | WisKey capability |
| WXD11 | Door-path gate T1..T26 on fakes | CR-033 | all WXD | 3 | sonnet+opus | - |
| WXG0 | Merge WX3 gate tool to main | CR-034 | - | 1 | sonnet | - |
| WXG1 | Gate: impact block, exit 5, gate:allow | CR-034 | WXG0 | 4 | sonnet | - |
| WXH0 | Rotation fakes | CR-034 | - | 4 | opus | - |
| WXH1 | Bridge multi-key verifier and rotate service | CR-034 | WXH0 | 10 | opus | WisKey answers (q31) |
| WXH2 | Arx key set and rotation state machine | CR-034 | WXH0 | 10 | opus | - |
| WXH3 | bridge.key.rotate, owner contacts, emergency notice | CR-034 | WXH2 | 3 | opus | - |
| WXH4 | Fresh-key re-pair with verification, emergency revocation | CR-034 | WXH2, WXH3 | 6 | opus | - |
| WXH5 | Maintenance screen and watchdog | CR-034 | WXH2, WXH4 | 4 | sonnet | - |
| WXH6 | Anchor eligibility and capability status hand-over | CR-034 | WXH1, WXH4 | 3 | opus | WisKey high-water mechanism |
| WXH7 | Rotation gate on fakes | CR-034 | WXH1..WXH6 | 2 | sonnet+opus | - |

After adding them: `python scripts/project_status.py --write` and commit the regenerated views (CLAUDE.md).

## 5. What is not planned here

The domain rename release, call / TTS on the trusted channel, the package signer (deferred by the owner), any physical door test,
lab or live rotation, and the WisKey-side work itself. Each needs its own change request or approval.
