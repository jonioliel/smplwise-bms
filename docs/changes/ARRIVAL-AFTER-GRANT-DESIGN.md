# Design note: "entry required" marker after the grant (x-arrival-after-grant)

Status: DESIGN NOTE ONLY, 2026-10-21. Nothing is built. Origin: owner answer GRANTS3 Q3 = B ("allow marking 'site entry required' after
the grant too; not mandatory, may come later"). Queued as future, low priority. Fakes only; `GO_LIVE_PERMITTED` stays False.

## Why this was not implemented in SMALLFIX-295

The request said: implement only if small and safe, otherwise write a note and stop. It is not small:

1. **No edit path exists.** Today the marker ("access needed", table `access_arrival_flags`, one row per `ticket_assignments.id`) is written
   only inside `services/tickets/external.assign_contact` (parameter `access_needed`, route `POST /tickets/{id}/assign`), in the same
   transaction as the assignment. After the assignment there is no route that changes it. "After the grant" needs a new write route.
2. **New contract surface.** A new route (proposed `POST /tickets/{id}/assignments/{aid}/access-needed`, body `{ value: bool, revision }`)
   must carry: ticket visibility check, the manager role of `assign`, the `flag_available` gate (external-grants feature on, outside
   vendor/person, never staff / Arx user / erased contact), the ticket revision (optimistic lock) and an audit row (ids only, no values).
3. **New UI in a shared drawer.** The tick has to be shown on the ticket drawer's external-handler block, next to link state. That block is
   rendered for several link states (live, grace, expired, revoked, resent); the tick must be hidden or read-only for the dead ones.
   Strings in he/en/ar/ru, no hint paragraph.
4. **Interaction with already-issued grants.** If a vendor already used the arrival step, un-ticking must not delete or hide grants that
   exist; it can only stop offering a new request. Ticking after the link expired is meaningless. These rules need an owner-visible decision.
5. **Vendor page.** The public page learns `arrival: true` from `access_arrival.available` when the vendor opens it. A tick set after the
   vendor opened the page appears only on the next load; whether to notify the vendor (a message outside the send hours rules) is undecided.
   The public bundle is already at its cap (the lazy ar/ru split is on integ/2101), so no vendor-page code should change in this item.

## Proposed design (for a later task)

- Backend: `access_arrival.set_flag` already exists (INSERT OR REPLACE); add `clear_flag`. New route above, in `routers/tickets.py`, thin,
  delegating to a function in `services/tickets/external.py` that reuses `_access_needed_available`. 422 `not_allowed` for a staff or
  internal assignment (same code the assign route uses). No migration: `access_arrival_flags` already fits.
- Tickets module off: the whole tickets router already answers only `GET /tickets/module` while the module is off, so the new route is
  unreachable. The new drawer control must read the same module switch as the rest of the drawer (`me.modules.tickets`, `applyTicketsHidden`)
  and render nothing when it is off; no "open a service request" action anywhere (owner rule 2026-10-20). Add a test with the module off.
- Ticket detail `link` block gains `access_needed: { available, on }` (same shape idea as `location_nav`), so the drawer can render a
  single checkbox row (label only, no paragraph) for live links only.
- Tests (all fakes): route happy path, staff contact refused, feature off refused, stale revision 409, un-tick keeps issued grants, audit
  row has ids only, module off hides the control (frontend unit/evidence), four-language key parity.

## Open decisions for the owner

1. May the manager also **remove** the tick, or only add it? (Recommended: both, un-tick only stops new requests.)
2. Should the vendor get a message when the tick is added after he already has the link? (Recommended: no; his page offers the step on its
   next load.)

Estimated size when scheduled: S-M (one route, one drawer row, four-language strings, about 8 tests). Not a gate blocker.
