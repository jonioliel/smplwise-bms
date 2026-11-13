# CR-TK-HISTORY-2436 - one security-domain list for device history (code review 01:F-04)

Branch `pilot/CR-TK-HISTORY-2436`, cut from `origin/main` at `665ec8f24` (v2.43.4). Master plan section 3.2, backend row
`pilot/CR-TK-HISTORY-2436`.

## Finding covered

**01:F-04** - the list "never share a device history with an outside handler" (D3 / D23: `lock`, `alarm_control_panel`, `cover`,
`camera`) was declared four times (`policy.NEVER_SHARED_DOMAINS`, `device_context.EXTERNAL_HISTORY_NEVER`,
`external.EXTERNAL_HISTORY_NEVER`, `handler_actions.EXTERNAL_HISTORY_NEVER`). A domain added in one copy and not the others would leak
history to a vendor link.

Now:

- `policy.NEVER_SHARED_DOMAINS` is the one list.
- New `device_context.history_domain_allowed(entity_id)` is the one domain test; it reads `policy.NEVER_SHARED_DOMAINS` at call time.
- `device_context.share_history_allowed`, `external.history_option` and `handler_actions._history` call it.
  `policy.may_share_history` reads the same constant directly.
- The copies in `external.py` and `handler_actions.py` are removed. `device_context.EXTERNAL_HISTORY_NEVER` stays as an alias of the
  policy constant, because older change notes name it. No code reads the alias.
- `policy.may_share_history` and `device_context.resolve_share_history` are referenced only by tests. Both are kept and marked in their
  docstrings, as the row asks, until the owner decides which layer is the contract.

Behaviour is identical. The four sets were equal, and each call does the same thing as the expression it replaces
(`entity_id.split(".", 1)[0] not in SET`). Query order is unchanged: `history_option` still checks the domain before it reads the
snapshot.

### Deviation from the row (recorded)

The row says `external.history_option` and `handler_actions` should call `device_context.share_history_allowed` "for the domain test".
That function also needs the snapshot (`withheld`, `source`), and both call sites read the snapshot only after the domain test. Calling
it there would change the order of the work: a snapshot query would run for every security-domain ticket. So both sites now call the
domain half, `history_domain_allowed`, and `share_history_allowed` calls the same helper. One list and one domain test, as the row
intends.

## Files

- `smplwise_vms/backend/smplwise/services/tickets/policy.py` (comment and docstring only; the constant is unchanged)
- `smplwise_vms/backend/smplwise/services/tickets/device_context.py`
- `smplwise_vms/backend/smplwise/services/tickets/external.py`
- `smplwise_vms/backend/smplwise/services/tickets/handler_actions.py`
- new `smplwise_vms/backend/tests/test_tickets_history_domains.py`
- this note

`T/store_rfq.py` is not touched. It belongs to F-05 only.

## Tests

The new test was written first and run against the unchanged code:

- `test_tickets_history_domains.py`: **12 passed, 1 failed**. The failure was `test_widening_the_single_list_reaches_every_call_site`,
  as expected: three call sites kept their own copy.

The new test covers 13 cases:

- the single list equals the documented four;
- 11 domains, parametrised (4 security, 7 others): all four call sites refuse exactly the security set;
- widening `policy.NEVER_SHARED_DOMAINS` (with `siren`) reaches all four call sites.

After the fix: see the results below.

Results after the fix. All runs were local, on Windows, with py 3.12 (`.venv`). The machine was heavily loaded by parallel agents, so
the times are long:

| Batch | Result |
|---|---|
| 1 | `test_tickets_history_domains.py` 13, `test_tickets_s2.py` 11, `test_tickets_device.py` 13: **37 passed** (14:45) |
| 2 | `test_tickets_s4_assign.py` 35, `test_tickets_s4_public.py` 27, `test_tickets_rfq.py` 43: **105 passed** (54:53) |
| 3 | `test_tickets_s4_wiring.py`, `test_tickets_s7_codes.py`, `test_tickets_staff_links.py`, `test_tickets_vendor_portal_more.py`, `test_tickets_s5b_channel.py`, `test_tickets_assignees.py`: **177 passed** (1:00:30) |

Batch 3 covers the files that exercise the assignment and handler-page paths. Total: **319 passed, 0 failed**.

**Full tickets suite NOT_RUN locally.** It has 99 `test_tickets_*` files. At the measured local rate, about 1 minute per test file
module, it would take many hours. The lead's combined wave-1 runner entry check runs the targeted gate (named tests plus the area
suite).

## Skipped / NOT_RUN

- **F-05 is skipped.** It is the single "active user" definition for the second approver of an award. It waits for owner decision O16,
  so `store_rfq.active_user_ids` is unchanged and there is no F-05 test.
- **Lint NOT_RUN.** Ruff and pyflakes are not installed in the local venv. `compileall` on `services/tickets` passed.
- **Runner NOT_RUN.** No entry check was queued, as instructed; the lead combines the wave-1 branches. No pixels are involved.
- No device or lab action.
