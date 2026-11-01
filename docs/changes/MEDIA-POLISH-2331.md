# MEDIA-POLISH-2331: media and doors polish (wave 3)

Branch `pilot/MEDIA-POLISH-2331`, cut from `origin/main` @ `52a8d9129`. Scope (only these files were edited):
`frontend/src/screens/multimedia-players.ts`, `multimedia-players-layout.ts` (read, unchanged), `multimedia-remote-editor.ts`,
`system-multimedia-players.ts`, `system-cast.ts`, `system-doors.ts`. Shared tokens, components (`sw-*`, `media-*`), the shell and
`styles/media-page.ts` / `styles/media-glass.ts` were not touched; where a shared change is needed it is a proposal in section 5.

Design language: the R5-SYSTEM-297 settings screens, HOMEFABLE-297 and POLISH-CONTROL-297; tokens only (no px font sizes, no radius
literals, no hex). Skills applied: impeccable (polish), emil-design-eng.

## 1. Critique (before)

Captured at 1440x900, 1920x1080, 1180x820, 1024x768 and 390x844 against a `vite preview` build of the base commit on port 4205, demo
mode with the existing mock layers (`tests/media-players-harness.ts` for the players, `tests/cast-mocks.ts` for casting, a throwaway
door fixture for the door cards). Screenshots: `docs/evidence/MEDIA-POLISH-2331/before/`.

### Multimedia › players (`multimedia-players.ts`) - a control screen
- **P1, owner rule broken: the page scrolls on every desktop size.** 1,027 px at 1440x900, 451 at 1920x1080, 1,503 at 1180x820,
  1,555 at 1024x768; the editor 817-3,730 px. The header compacts while scrolling and then folds the state filter and the search away
  (opacity 0, the space kept), so in the middle of the list the filters are gone while still taking room.
- P2: the editor's settings pane is `position: sticky` under a header it guesses at (76 px), and the edit bar scrolls out of view with
  the page: "שמור" is off screen as soon as the list is scrolled.
- P2: edit chips (`.ecard`) sit on top of long card titles ("רמקול חדר אורחים" is half covered) - the chip row is absolutely placed
  by the shared card; see proposal 5.2.
- P3: the room chips have no keyboard focus ring; the loading skeleton and the confirm dialog are inline styles (px literals).
- Fine already: loading / empty / error / stale / forbidden / disabled states, address-driven filters, Back closes the panel.

### Settings › multimedia › players sections (`system-multimedia-players.ts`) - a settings document
- Long by nature (4,678-10,410 px: one row per device plus six sections). It is a settings document, not a control screen; the
  owner rule does not apply and nothing was paged (the device table is the shared `adminTable`, out of scope).
- P2: the save feedback ("נשמר", "הועתק", "אושרו N נגנים") is a line after the LAST card: a change in the first card reports
  thousands of pixels below, i.e. never seen. The error line sits above the first card and scrolls away the same way.
- P3: no focus ring on the native fields, the order buttons and the "תפקידים והרשאות" link; 36 px targets on touch; three inline styles.

### Settings › multimedia › casting (`system-cast.ts`)
- **P1, misleading table: the screens header does not line up with its columns.** Every row was its own grid with `auto`
  columns, so "מותר / שיטה / משך / קבוע / זרם ראשי" sat in a cluster at the end while the controls spread across the row.
- P2: the same out-of-sight "נשמר" (after the last screen row) and error (above the first card) as the players sections.
- P3: no focus ring on fields; 36 px touch targets; an empty list was a bare grey line; an inline grid-column style.

### Settings › doors cards (`system-doors.ts`: `sw-door-grants`, `sw-door-setup`, `sw-door-inventory`)
- P2: every switch row repeats the visible label "רשאי לפתוח דלתות" / "כולל פתיחת דלתות" (noise, and every switch had the SAME
  accessible name, so a screen reader could not tell whose switch it was).
- P3: cards spaced by inline `margin-block-start` styles; the search field and selects had no width rule (a long site name stretched
  the select across the row on a phone); 36 px touch targets.
- Fine already: loading / empty / error states, confirmation dialogs with their actions in the footer, read-only inventory.

### Remote editor (`multimedia-remote-editor.ts`, inside the remote drawer)
- **P1, the actions leave the screen:** "ביטול" / "שמירה" are in a bar at the top of a list that is 1,100-1,400 px long; scrolled to
  the apps, the save button was 1,081-1,393 px above the viewport at every size measured.
- P3: no focus ring on the order buttons, the switches and the fold boxes; 36 px targets on touch; a monospace font stack literal; on a
  phone a source row (grip, glyph, name, glyph menu, two arrows, switch) squeezes the name field to a few characters.

## 2. Changes

| Screen | Change |
|---|---|
| Players | From 1024 x 560 the page takes the screen's height (host `overflow: hidden`); a new cards region `.scr` (`data-mm-region`) holds the body and is the only thing that scrolls (thin scrollbar at the screen edge, `overscroll-behavior: contain`, a soft top fade once scrolled instead of a hard cut). The header is never compacted there (its filters stay usable); below 1024 px wide or 560 px high `.scr` is `display: contents` and the page scrolls exactly as before with the compacting header (the phone scroll spec's contract). Editor from 1100 px: the edit bar stays above, the settings pane and the cards are two panes that scroll on their own. Skeleton and dialog inline styles moved to classes on tokens; room chips get `:focus-visible`. |
| Players settings sections | `.err` is a sticky banner (danger tint, hairline, shadow token); the note is a floating pill at the bottom of the window (above the phone's bottom bar); focus rings on fields, icon buttons and the link; 44 px targets under `pointer: coarse`; inline styles replaced by classes (`.hd .grow`, `.dlg-acts`). |
| Casting settings | The screens table is one grid: `.sgrid` owns the seven columns and every row (header included) is a `subgrid` row, so labels and controls align; the phone keeps its two-column layout with per-field labels. Empty list -> `sw-state-panel`. Sticky error, floating "נשמר", focus rings, 44 px targets, the test button's inline style -> `.wide`. |
| Door cards | Switches: `labelHidden` with a per-row name ("רשאי לפתוח דלתות: <name>"); one muted column caption above each list. Cards stack in `.stack` with a gap; search field `flex: 0 1 280px`, selects capped at 320 px (full width on a phone); 44 px targets on touch. The inventory card keeps its own top margin (it is a separate element placed after the setup element by the page). |
| Remote editor | The bar is `position: sticky` at the top, on the opaque `--mr-surface-solid`, so cancel / save are always on screen; focus rings in `--mr-focus`; press feedback (scale 0.97, 120 ms ease-out, transform only); 44 px targets on touch; under 480 px a source / app row wraps its name field onto its own line; `--sw-font-mono` instead of the literal stack. |

No copy changed except: the casting empty state (same sentence, now a state panel) and the two column captions of the grant card
(the words of the old per-row label). No feature, setting or data was removed.

## 3. Measurements, before -> after

Vertical page overflow in px = max(scrollHeight - clientHeight) over the document, the shell's `main` and the screen element (the
NOSCROLL-295 probe; an element counts only while it can scroll). Default skin, light scheme, demo mode with the mock layers named in
section 1, `vite preview` of each build on port 4205 (workstation, Chromium). Raw lines: `docs/evidence/MEDIA-POLISH-2331/{before,after}/overflow.jsonl`.

| Screen | 1440x900 | 1920x1080 | 1180x820 | 1024x768 | 390x844 |
|---|---|---|---|---|---|
| Players | 1,027 -> **0** | 451 -> **0** | 1,503 -> **0** | 1,555 -> **0** | 2,630 -> 2,630 (phone: page scroll kept) |
| Players, editor | 1,393 -> **0** | 817 -> **0** | 2,859 -> **0** | 3,730 -> **0** | 5,333 -> 5,333 |
| Settings, multimedia (players sections) | 4,908 -> 4,908 | 4,678 -> 4,678 | 9,374 -> 9,374 | 9,410 -> 9,410 | 10,410 -> 10,410 |
| Settings, casting | 564 -> 571 | 384 -> 391 | 694 -> 701 | 802 -> 809 | 1,777 -> 1,784 |
| Remote editor, scrolled to the apps: top of "שמירה" | -1,261 (off screen) -> 100 | -1,081 -> 100 | -1,341 -> 100 | -1,393 -> 100 | -1,386 -> 218 |

The settings screens are documents (owner rule is for control screens) and keep their scroll; casting grows by 7 px (the table's
header row now sits in the grid with the rows). Inside the players page the cards region scrolls (as the NOSCROLL-297 lists do).

Screenshots: `docs/evidence/MEDIA-POLISH-2331/before/` and `after/`: `players`, `players-edit`, `cast-screens` (with the
test-cast panel open), `remote-editor-scrolled` and `doors` at 1440x900, 1024x768 and 390x844 (the other sizes were measured,
their shots pruned to keep the repository small).

## 4. Pixel baselines likely affected

No committed pixel baseline shows these screens (`visual-matrix` covers `multimedia-screens`, not players; there is none for the
multimedia settings, casting, the door cards or the remote editor). Expected unchanged: `visual-matrix` `multimedia-screens-ready-*`.
If a runner pass adds or re-takes baselines for `#/multimedia/players` at 1440 / 1024, they change (fitted page, region scroll).

## 5. Proposals for shared code (not done here)

1. **`styles/media-page.ts` (shared with the groups page):** the region model of section 2 could move into the shared page chrome so
   `multimedia-groups` (and `multimedia-screens`, which keeps its own copy) fit the screen the same way; today only the players page
   does. The compacting header is then needed only below 1024 px.
2. **`components/media-player-card.ts`:** in edit mode the edit chips (`slot="edit"`, absolutely placed at the top inline-end) cover
   long titles ("רמקול חדר אורחים", "רמקול פרגולה" at 1440). The card should reserve the chips' width in its title row while
   `editing` (or place the chips in the footer row).
3. **`components/media-remote.ts`:** the drawer's scroll box has top padding, so a row shows through for a few pixels above the
   sticky editor bar; a `scroll-padding` / zero top padding while editing would close it.
4. **`screens/media-admin-list.ts` (`adminTable`):** the device table is the reason the multimedia settings are 4,700-10,400 px long;
   a pager or a fitted list like NOSCROLL-295's would shorten it if the owner wants settings to fit too.

## 6. Tests

Run locally on the workstation (heavily loaded; the coordinator then stopped all local builds, previews and evidence runs):

| Check | Result |
|---|---|
| `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl`, `unit-door-settings`, `unit-media-players-layout` (desktop project) | 45 passed, 0 failed |
| Impeccable detector over the five changed screens | 0 findings |
| `npx tsc --noEmit` | see the agent report (run after the last edit) |
| Throwaway capture / overflow probe (not committed) against `vite preview` :4205 | before 30 + after 30 runs passed; numbers in section 3 |
| `evidence-media-players` (desktop / tablet / mobile), `evidence-mobile-scroll-players` (mobile), `evidence-cast-ui` | **NOT_RUN** (started, stopped by the coordinator for memory; for the runner gate) |
| `evidence-media-remote`, `evidence-tabs-pair-scroll`, `layout-bubble-screens`, `dropdown-styles-b` (need the Vite dev server: `/src/...` imports) | **NOT_RUN** (runner gate) |

Test touched: `layout-bubble-screens.spec.ts` `scrollMain()` also scrolls the players page's cards region (`[data-mm-region]`), so
the guard still reaches the bottom half of the list on a desktop where the page itself no longer scrolls.

Risk notes for the gate: `evidence-media-players` scrolls with `scrollIntoViewIfNeeded()` (works inside the region);
`evidence-mobile-scroll-players` and `evidence-tabs-pair-scroll` are phone-only and the phone layout is unchanged (`.scr` is
`display: contents` there).

## 7. Left

- Proposals 5.1-5.4 (shared files).
- The evidence specs listed as NOT_RUN, on the runner.
