# DIALOG-TOPLAYER-2381 - sw-dialog in the browser top layer

Branch `pilot/DIALOG-TOPLAYER-2381`, from origin/main = v2.38.0 (efc12d0e3). Target 2.38.1. Owner approved the root fix on 03.11 (Q20 "א").

## Problem

In the glass skins (domus, crystal) every `sw-card` carries a `backdrop-filter`. A `position: fixed` element takes the nearest ancestor
with a transform, a filter or a backdrop-filter as its containing block, so `sw-dialog`'s fixed backdrop inside a card was laid out
against the CARD:

- the box was centred on the card, not on the screen (on a phone scrolled along a tall card it opened partly or wholly off screen - the
  NVR connection card's "save anyway" dialog, 2.38.0 gate);
- the dimming covered only the card, not the page.

2.38.0 shipped a stopgap, `keepBoxInView()` (GATE2380-B, 8c182a7be), which scrolled the box into view; it did not fix the dimming.

## Approach: a manual popover, not a modal `<dialog>`

`sw-dialog`'s `.backdrop` is now `popover="manual"` and is shown with `showPopover()` when the dialog opens. A top-layer element is laid
out against the viewport whatever its ancestors carry and paints above every z-index of the page.

Why the Popover API and not `<dialog>.showModal()`:

| | `popover="manual"` (chosen) | `showModal()` |
|---|---|---|
| Layer / containing block | top layer, viewport | top layer, viewport |
| Page behind | unchanged: not inert (sw-dialog's own focus trap, as before) | inert - the toasts (role=status, some with "בטל") outside the dialog would become inert |
| Escape | none of its own: sw-dialog's window listener and OPEN_STACK stay the only path | a native close request; Chrome's close watcher may skip a prevented `cancel` (a second Escape without activation closes the dialog natively, even a `locked` one) |
| Nesting | shown later = above (the OPEN_STACK order) | the same |
| Inside a modal sw-drawer | a flat-tree descendant of the drawer's `<dialog>`: not inert, above it | the same |
| Markup / skins | the same `.backdrop` / `.box` elements and class names | a new element; skin selectors would move |

So the change is layering only. What stays exactly as it was: the public API (`open`, `heading`, `subheading`, `locked`, `wide`, `xl`,
`fit`, the `close` event, the default and `footer` slots), OPEN_STACK and "Escape closes only the top dialog", the Tab / Shift+Tab trap,
focus into the box on open and back to the opener on close, the `@starting-style` open animation (scrim fade, box from
`scale(0.96) translateY(6px)`), `prefers-reduced-motion` (durations zeroed in css.ts), RTL (the popover inherits from its DOM parent),
each skin's light / dark tokens and its `:host(sw-dialog) .backdrop` / `.box` rules (glass sheen, solid surface - DIALOGSOLID-295 used
`--sw-surface-solid` on custom panes; sw-dialog's own box rules in domus / crystal / tesla / bubble / classic are untouched and still apply).
Without the Popover API (very old browsers) nothing is called and the backdrop stays a fixed element at `--sw-z-modal`, as before.

Details (frontend/src/components/sw-dialog.ts):
- The UA `[popover]` box (fit-content size, auto margin, a border, Canvas colours) is put back to a full-viewport layer on `.backdrop`
  (`inline-size/block-size: auto`, `max-*: none`, `margin: 0`, `border: 0`, `overflow: visible`, `color: inherit`).
- `updated()`: the opener is read BEFORE the backdrop is shown (showing a popover may move focus to an `[autofocus]` inside), then the
  backdrop is shown, then the existing rAF focus pick runs. Closing hides it. Re-attached while open (`connectedCallback`): shown again
  (the browser hides a popover that leaves the document).
- `keepBoxInView()` and its GATE2380-B comment are removed.

### Toasts stay above an open dialog

Today a page toast (`--sw-z-toast` 60) paints above an open dialog (`--sw-z-modal` 50). A top-layer dialog would cover every toast that is
not in the top layer, so `frontend/src/components/top-layer.ts` adds a small shared pattern:

- `liftRef()` (a Lit `ref` directive) / `liftToTopLayer(el)`: the toast becomes a manual popover marked `data-lifted` and is shown;
- `raiseLifted()`: sw-dialog calls it after it opens, so a toast that was already showing is shown again and paints above the new dialog;
- `liftedReset` / `liftedHostReset`: the UA `[popover]` style put back to a plain element's at ZERO specificity (`:where(...)`), so the
  toast's own insets, size, padding and colours win; lifting changes no toast's look.

Lifted (an Explore survey listed every fixed toast and whether it can be visible while an sw-dialog is open):

| Toast | Overlap with an open dialog |
|---|---|
| `screens/access-external.ts` `.toasts` | yes - dialog actions toast while the dialog stays open |
| `screens/door-windows.ts` `.toast` | yes - a failed action keeps its dialog open |
| `maintenance/tags-page.ts`, `maintenance/list-page.ts` (CSS `maintenance/styles.ts`) | yes - revoke error / the task sheet's dialog |
| `screens/tree-unassigned.ts` `looseNotice` (shown by devices-building) | yes - an 8 s undo bar, any dialog can open meanwhile |
| `screens/nvr-undo-toast.ts` (the host) | yes - a 10 s undo, the next confirmation opens over it |
| `pwa/arx-pwa-prompts.ts` (the host) | yes - the offline pill / update card stay up indefinitely |
| `screens/tickets-rfqs.ts` (CSS `styles/media-page.ts`) | yes - the RFQ board's dialog stays open (`keepOpen`) |
| `screens/multimedia-groups.ts`, `multimedia-players.ts`, `multimedia-screens.ts`, `system-notifications.ts`, `tickets-handlers.ts`, `maintenance/close-prompt.ts`, `security-alarm.ts`, `system-calendar-sync.ts`, `system-calendars.ts` | low - the toast follows a dialog's close and can overlap a dialog opened again at once; one line each, so lifted too |

Not lifted: `devices-automations.ts` / `devices-schedules.ts` notes (already top-layer popovers); `tickets-board` / `tickets-list` `.flt`
(z 40) and `sw-app` `.perm-toast` (z 30) were already below a dialog; toasts with no sw-dialog in their tree (`calendars/cal-page`,
`calendars/view-calendar`, `infra-temperature`, `investigate-incidents`, `system-cast`, `system-tickets`); absolute / inline notes.
**Notice-board files are left to the agents who own them:** `notices/styles.ts` `.toast` (z 50, used by `screens/system-notices.ts`, four
sw-dialogs) and `screens/devices-notices.ts` (CSS `devices-notices-css.ts`, one sw-dialog) - they would need the same two lines
(`${liftRef()}` on the toast, `liftedReset` in the styles).

Design check (emil-design-eng): the modal keeps a centred origin and its existing entrance (no scale(0), ease-out, < 300 ms, reduced
motion zeroed); the scrim now dims the whole screen ("dim to focus" - POLISH-CLASSIC-DOMUS-297's intent). Known limit: `raiseLifted()`
hides and re-shows a lifted toast in one task; a toast whose own CSS sets no `display` and has an `@starting-style` entrance
(door-windows) could replay its 8 px rise if the browser computes style between the two calls. Not seen in the runs below.

## Other overlays checked

| Overlay | Same containing-block problem? | Action |
|---|---|---|
| `sw-drawer` (modal) | no - already a `<dialog>.showModal()` in the top layer | none. Its comment about "no transform on the open panel" (a nested fixed dialog) no longer matters for sw-dialog; left as is |
| `sw-drawer` (docked, non-modal) | it is a side panel of the screen, not a viewport overlay | none |
| `sw-dropdown`, tickets overlay menus, devices-bulk panel | no - already `popover="manual"` | none |
| `sw-popover` (map card) | no - `position: absolute` in the map stage by design, anchored to a marker | none |
| `sw-sheet` (bottom / centre sheet) | **yes in principle**: two separate fixed elements (scrim z 50, sheet z 51) with a closing transition (opacity, then `visibility` after 220 ms). Placed inside a glass card it would be confined the same way. Users: device-activity, sw-cast-picker, devices-area, sw-app's area picker, electricity `elec-ui`, water pages, emergency | **listed, not changed**: not the same small pattern - it needs both layers in the top layer and an exit that waits for the transition (`overlay` + `transition-behavior: allow-discrete`, or hide on `transitionend`) |
| Hand-made fixed modals | yes in principle when mounted inside a glass card | listed, not changed: `schedule-create-dialog.ts`, `wiskey-person-editor.ts` pane, `devices-camera-card.ts` `.back`, `mapping-assistant.ts`, `calendars/event-drawer.ts`, `calendars/maint-drawer.ts`, `calendars/resident.ts` sheet, `calendars/view-approvals.ts` / `view-manage.ts` / `view-calendar.ts` overlays, `area-quick-sheet.ts`, `devices-area-nav.ts`, `kiosk-wall.ts`, `notify-center.ts`, `device-activity.ts` menu |

## Tests

New:
- `tests/unit-dialog-toplayer-2381.spec.ts` (node): the helpers against stand-in popover elements (show once, hide, no-op without the API /
  disconnected, lift = manual popover + `data-lifted`, raise re-shows only the showing ones in order and drops detached ones); the resets
  weigh zero; sw-dialog's source (popover on `.backdrop`, the reset props, opener before show, hide on close, re-show on reconnect, no
  `keepBoxInView` / `scrollIntoView`, OPEN_STACK / trap / Escape unchanged); the skins still target `.backdrop` / `.box`; every lifted toast
  uses the directive (never inside an attribute's quotes - the first run caught `role="status ${...}"` in five files) and has the reset.
- `tests/evidence-dialog-toplayer-2381.spec.ts` (runner): domus and crystal, light and dark, desktop / tablet / phone - a dialog opened from
  the middle of a 2400 px glass card (the card's top above the viewport, its centre far from the viewport's): the backdrop is the viewport
  and in the top layer, the box is inside the viewport and centred (±2 px), all four corners hit the backdrop, a dialog opened from it
  paints above it, Escape closes the top one then the first, focus returns to the opener, the closed dialog leaves the top layer; and the
  offline pill stays above an open dialog whether it appeared before or while it was open.
- `tests/pixel-dialog-toplayer-2381.spec.ts` (runner, "pixel-stable"): the picture of the fix - domus at 1440 and 390 (crystal = the
  structural smoke, helpers/pixel-skins.ts). Baselines `toplayer-domus-dialog-{1440-desktop,390-mobile}-linux.png`.

### Receipts

Before every runner job: `~/smplwise-results/gate_status.json` = `pass` (release/2380-train @ efc12d0e3, not running) and no
`release_gate.py` / `release_gate2.sh` process.

| Check | Where, commit | Result |
|---|---|---|
| `tsc --noEmit` (src + tests) | workstation, after the product change and again after the last spec edit | 0 errors |
| Unit (`-c playwright.unit.config.ts --workers=1`): `unit-dialog-toplayer-2381`, `unit-polish-classic-domus-297`, `unit-a11y-polished-lint`, `unit-token-lint`, `unit-dark-polish-beds` | workstation | first run 30 passed / **1 failed** - the new spec caught `role="status ${liftRef()}"` / `aria-live="polite ${...}"` (the directive inside the attribute's quotes) in five files; fixed before the first commit, the new spec then **6 / 6 passed** and gained a guard for it |
| preview: `evidence-dialog-toplayer-2381`, `a11y-dialog-focus-2310`, `evidence-nvr-connection` (the case that found it, incl. "skins x schemes" with the box-in-viewport assertion on the phone), `a11y-polished-2342` (stacked dialogs: Escape closes only the top one) | runner 8078a8c70, desktop + tablet + mobile | 96 passed, **15 failed - all the new evidence spec's own probes** (the card is clamped by the end of the scroller; the offline pill lets presses through; a slotted child of a dialog is its box): fixed in 681dabc07 / 62d8de434. Every product assertion (backdrop = viewport, top layer, box centred) held in that first run |
| preview: `evidence-dialog-toplayer-2381` | runner 62d8de434, 3 projects | **15 passed, 0 failed** |
| preview `-u`: the 15 `pixel-*` specs + `visual-matrix` | runner 62d8de434, desktop + tablet + mobile | **318 passed, 240 skipped (project / smoke skips), 0 failed; 0 baselines rewritten** (below) |
| preview `-u`: new `pixel-dialog-toplayer-2381` | runner ce02082bd | 4 passed, 2 skipped (tablet); 2 new baselines written, reviewed, committed (0cd3a1fc2) |
| preview: `pixel-dialog-toplayer-2381` (no `-u`), `evidence-dialog-toplayer-2381` + the toasts' and dialogs' screens: `evidence-access-polish-2331`, `evidence-accessreq-293`, `evidence-breakui-doorwin`, `evidence-calendars-connect-2330`, `evidence-calendars-settings-2310`, `evidence-doorwin-295`, `evidence-grants3-295`, `evidence-grantsmin-295`, `evidence-maintenance`, `evidence-notifications`, `evidence-nvr-cameras-batch`, `evidence-nvr-cameras-write`, `evidence-nvr-encoding-batch`, `evidence-nvr-h264-bulk`, `evidence-polish4-wp8`, `evidence-secfix2-295`, `evidence-sharedid-293`, `evidence-sharedui-295`, `evidence-temperature`, `evidence-tickets-needs-review`, `evidence-tickets-rfq2`, `evidence-tree-unassigned-2331`, `uxrest-focus`, `evidence-shell` | runner 0cd3a1fc2, 3 projects | 946 passed, 64 skipped, **4 failed - `evidence-grants3-295` vendor page ×4: harness**, it opens `/public-ticket.html`, which the main preview build does not contain (a dev-server spec, PRE-GATE-2350) |
| spec (vite dev): `evidence-grants3-295`, `evidence-grantsmin-295` | runner 0cd3a1fc2, 3 projects | **33 passed, 6 skipped, 0 failed** |

### Baseline review

No existing baseline moved past its threshold: the dialog baselines in the glass skins shoot the BOX only (`pixel-nvr-encoding-batch`
`enc-domus-*`, owner decision 403), `visual-matrix`'s dialog is mounted on `<body>` (never inside a card), `pixel-access-events` is classic,
and crystal carries no pixel baselines (GATELANES-297: smoke only). So the box itself (glass sheen, solid surface, radius, shadow, light /
dark, RTL header and footer) is pixel-identical after the move to the top layer - that is the receipt for "the skins' looks carry over".
Because none of them showed the fix, `pixel-dialog-toplayer-2381` was added. Its two baselines, reviewed: the dimming covers the rail
(desktop) / bottom bar (phone), the top bar, the whole card and the page around it; the box sits in the middle of the screen (desktop
499-941 x 369-531 of 1440 x 900; phone 15-375 of 390), RTL, domus' solid box, the footer with its two buttons.

## NOT_RUN / open

- A negative control (the new evidence spec against v2.38.0 without the fix) - NOT_RUN; the old geometry is the 2.38.0 gate's failure
  (`evidence-nvr-connection` mobile domus / crystal, box top -2.5 / -3.7 px) and `keepBoxInView`'s own comment.
- The runner entry check (`~/gate2/branch_check.sh`) and the full Playwright / backend tiers - NOT_RUN (the train gate). No backend change.
- Real devices (iOS Safari / the Android shell WebView) - NOT_RUN; the Popover API is in Safari 17+ and Chrome 114+; without it the
  dialog behaves as in 2.38.0 (and `keepBoxInView` is gone, so an old WebView in a glass skin gets the pre-2.38.0 placement).
- Notice-board toasts (`notices/styles.ts`, `devices-notices`) - not lifted, owned by another agent (above).
- `sw-sheet` and the hand-made fixed modals - listed above, not changed.

## Rollback

Revert the branch's commits; `keepBoxInView` comes back with the revert of 8078a8c70.
