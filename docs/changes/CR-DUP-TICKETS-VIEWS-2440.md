# CR-DUP-TICKETS-VIEWS-2440 - one base for the requests list page and the manager board

Branch `pilot/CR-DUP-TICKETS-VIEWS-2440`, based on `origin/release/2437-train` (`32c4a2275`). Plan row
`pilot/CR-DUP-TICKETS-VIEWS-2436` of the code review of 2026-11-13 (finding 06:DUP-4). Pure refactor: no behaviour change, no pixel
change, no new text.

## What

`screens/tickets-list.ts` and `screens/tickets-board.ts` carried the same plumbing twice (181 identical lines in the review's count).
It now lives once in the new `tickets/list-view-base.ts`, next to `tickets/list-toolbar.ts`:

* `TicketsViewBase` (abstract, extends `LitElement`), which both screens extend. It holds
  * the shared states: `route`, `module`, `meta`, `screen`, `failed`, `phone`, `drawerUsed`, `toast`, `now`, `q`, `filterOpen`,
    `filters`, `paged`, `cardPage`, and the `bubbleSkin` and `panelCtl` controllers (created in the same order as before);
  * connect / disconnect: the glass theme, the phone and paged media queries, the names subscription, the live poller's start and
    stop, the search and toast timers, the pages observer;
  * `updated()` (header bar measure + the pages observer), `boot()` (module, names, "off", then the screen's `loadMeta()` and first
    load), `fail()`, `say()`, the debounced `onSearch()`, `detailMode()`, `hrefOf()`, `onCardAction`, `closeDrawer`;
  * small helpers the two screens repeated inline: `syncSearch()`, `firstPageOn()`, `pageAt()`, `noteCardHeights()`, `stateBox()`,
    `toastView()`.
* `writeHref()` - the same function was declared in both files.
* `ticketViewStyles` - the CSS rules both screens declared word for word: `.cgrid`, `.flt` (and its phone offset), `.scr`, `.pact`,
  `.dh`, and the tablet-up frame (`:host`, `.page`, `.scr`, the 768-1023 `.scr` margins).

Each screen keeps what is its own: its route (`r`), its data and load, its `live` callback, its filters and chips, its `fit` shape and
`measureFit()`, and its whole render. Where the two differ the base asks through abstract members: `live`, `loadMeta()`,
`reloadIfNeeded()`, `openHref()`, `plainHref()`, `searchTo()`, `fitTarget()`, `measureFit()`, `resetFit()`.

## Why it is safe

* Markup: untouched, except that the toast and the state box are produced by the base's `toastView()` / `stateBox()` - the same
  templates, moved.
* CSS cascade: `ticketViewStyles` sits directly before each screen's own `css` block, so every moved rule still comes after the shared
  sheets and before `ticketChipSelected`. Inside each screen a moved rule now precedes that screen's remaining own rules; checked rule
  by rule that no remaining rule of equal specificity sets the same property on the same element (`.scr.fill`, `.scr.paged` are more
  specific than `.scr`; the list's phone `.pact` rule stays in the list's block, after the base `.pact`, as before; `.dh:empty` stays in
  the board's block, after `.dh`). The split media blocks keep their conditions.
* Differences between the two copies, kept as they were (not unified):
  * the list ticks `now` on its own 60 s interval, the board inside its live callback - each kept;
  * the list reads the cards / table preference before the module (`boot()` override), and reads the meta alone; the board reads the
    meta together with the tree-hidden preference (`loadMeta()`);
  * the reload key field has a different name and content in each (`listKey` / `key`) and the list clears it on its own - left in the
    screens;
  * `measureFit()` measures different things (one row height vs. headers, handler lines, closed rows) - left in the screens; only the
    per-card height loop is shared;
  * the "off" and "forbidden" boxes use different texts and the list adds a settings link - left in the screens.
* One ordering detail: the list's 60 s clock interval is now created right after the base's `connectedCallback()` (it was between the
  names subscription and the poller's start). Nothing observes that order.

## Files

* new `frontend/src/tickets/list-view-base.ts` (325 lines)
* `frontend/src/screens/tickets-board.ts` (939 -> 727 lines)
* `frontend/src/screens/tickets-list.ts` (736 -> 531 lines)
* `docs/changes/CR-DUP-TICKETS-VIEWS-2440.md`

## Tests

TESTS_PLACEHOLDER

## Outside my rows

Nothing.
