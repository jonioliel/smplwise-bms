# Service module (requests) - design sheet

TKUI7 (release 2.6.x). The reference for a designer or a skin author: which components the service module is made of, which tokens they
may read, and the rules the gate enforces. Source of the structure: `private/planning/SERVICE_MODULE_UX_IA_2026-10-16.md` (§3 vocabulary,
§4.1 drawer, §6 costs). The token catalogue itself is `frontend/src/design/tokens.ts`; the skin knobs are `docs/design/DEVICE_THEMES.md`.

## Rules (all enforced by `frontend/tests/unit-token-lint.spec.ts` unless noted)

1. Colours, radii and type sizes come from tokens: no hex on `color / background / border / outline / fill / stroke`, no `border-radius`
   of 4-24 px, no `font-size` of 9-27 px (pill = `999px` and structural 1-3 px radii stay).
2. No fallback for a declared token: `var(--sw-x, <anything>)` is a finding in `src/tickets/`, the tickets screens, `sw-view-switch` and
   the shell. The token sheet is always present; a fallback hides a wrong value (the old `--sw-touch-desktop, 32px` fallback never fired
   and was misleading: the declared value is 44 px, a skin lowers it to 32 px).
3. The `--dv-*` / `--mm-*` layer is the skin knob layer (devices-themes / bubble): reading it with a plain fallback is allowed.
4. The public handler page (`src/public-ticket/`) is a separate bundle with its own token sheet (`styles.css`, light / dark / auto by
   `data-theme`): every `--sw-*` it reads must be declared there, with no fallback (also in `claim/claim.css`).
5. ONE scroll per surface (gate: `layout-tickets-drawer`, `layout-tickets-conversation`, `layout-tickets-tabs`): in the request drawer
   (520 / 640 / full, and the phone sheet / half sheet) the only scroll container is the drawer body; tab content never gets its own
   `overflow: auto`. A picker list grows with its rows. Allowed exceptions: top-layer popovers (a menu may scroll when taller than the
   room), the receipt viewer's pan / zoom stage (a viewport, in a dialog), the searchable vendor / contact list (`.xpick`, capped 280 px
   under its search field), and the table view (below).
6. Spacing is not tokenised in the module yet: `padding / gap / margin` are literal px like the rest of the app (the spacing tokens
   `--sw-s-*` exist; moving to them is a separate, pixel-changing task and is not part of TKUI7).

## Components

| Component | File | Notes |
|---|---|---|
| Status sentence | `src/tickets/status-sentence.ts` (`sentenceFor`, `etaText`, `clip`, max 90 chars) | One vocabulary for drawer, list card, table, board group and push text; role-aware (manager / handler / approver / requester). Re-announced through ONE live region in the status block. |
| Status block | `src/tickets/status-block.ts` | Avatar, ONE chip, the sentence, SLA, warning line, the primary action. Fixed (outside the scroller) in drawer, sheet and page hero. |
| Elapsed clock | `<ticket-elapsed>` `src/tickets/elapsed-clock.ts`, `elapsed-model.ts` | One shared minute ticker for all clocks on screen; pauses while the tab is hidden. |
| View switch | `<sw-view-switch>` `src/components/sw-view-switch.ts`; modes registry `src/tickets/list-view-switch.ts` | Cards / table / manager board / weekly calendar. Hooks: `data-view-switch`, `data-view`. Targets follow `--sw-touch-desktop`. |
| Drawer tabs | `src/tickets/drawer-tabs.ts` | ARIA tab list (Overview, Conversation, Costs, History), roving tabindex, badge inside the accessible name. Tabs and status block never scroll; the drawer body does. |
| Costs tab | `<ticket-costs-tab>` `src/tickets/costs-tab.ts`, `costs-tab-styles.ts` | Stage chip + stepper (quote, work, demand, paid), quote card, payment demand card, send-to-vendor dialog. Staff see no money surface. |
| Weekly calendar | `<tickets-calendar>` `src/tickets/calendar-view.ts` | Sunday-first, seven columns; one day at a time below 768 px. Event hook `data-cal-event`. |
| Quote card (vendor page) | `src/public-ticket/claim/quote-card.ts`, `claim.css` | Permanent quote / payment-demand card of the public page; classes only (CSP `style-src 'self'`), tokens from the public sheet. |

## Gate coverage

| Screen | Evidence | Layout (5 skins x light / dark x widths 320-1440, `LAYOUT_QUICK=1` = 4 widths) | Pixel |
|---|---|---|---|
| List / cards, create, settings | `evidence-tickets*.spec.ts` | `layout-tickets.spec.ts` | none |
| Board | `evidence-tickets-board.spec.ts` | `layout-tickets-board.spec.ts` | none |
| Table | `evidence-tickets-table.spec.ts` | `layout-tickets-table.spec.ts` | none |
| Calendar | `evidence-tickets-calendar.spec.ts` | `layout-tickets-calendar.spec.ts` | none |
| Drawer (all tabs, one scroller) | `evidence-tickets-drawer.spec.ts` | `layout-tickets-drawer.spec.ts` | none |
| Conversation / History | `evidence-tickets-conversation.spec.ts` | `layout-tickets-conversation.spec.ts`, `layout-tickets-tabs.spec.ts` | none |
| Costs tab | `evidence-tickets-costs.spec.ts` | `layout-tickets-tabs.spec.ts` (quote, partial approval, demand, staff, empty) | none |
| Outside contacts, handlers, public settings | `evidence-tickets-s4.spec.ts` | `layout-tickets-s4.spec.ts` | none |
| Deletion | `evidence-tickets-delete.spec.ts` | `layout-tickets-delete.spec.ts` | none |
| Vendor page (public bundle) | `evidence-public-ticket.spec.ts`, `-ui5`, `-vendor-card` | none (390 / 1440 only, overflow asserted in evidence) | none |

## Known exceptions, kept on purpose

- The table view (`table-styles.ts`, `.tw`) is a bounded scroller (`max-block-size: max(420px, calc(100dvh - 300px))`): a wide table needs a
  horizontal scroller anyway, and the sticky header relies on it (owner decision 2.5.5). It is the one list view with a scroller of its own.
- The public sheet keeps a few off-scale literals (13 / 15 / 17 px text, 9 / 14 / 18 / 28 px radii) of the approved v5 vendor page.
