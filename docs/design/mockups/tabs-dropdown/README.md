# Tabs vs dropdowns on the phone (mockup)

Branch `pilot/tabs-dropdown-mockup`. Mockup only: no app code, no release. Open `index.html` in a browser
(hash params: `#screen=media|security|settings&w=390|820&theme=light|dark`). Self-contained, Hebrew RTL, fixtures
are invented (no camera footage, no private data; the owner's screenshots were not copied).

## What is shown

For both the multimedia screen and the security screen (and a Settings card), three variants side by side:

- **A, today.** `sw-tabs` variant `pill` (44 px row on a phone), `underline-compact` (32 px), the multimedia
  area chips + floor button + status segmented + search field, the security controls row (quality, cameras,
  columns, fullscreen).
- **B, the owner's proposal.** One 40 px row: two small dropdowns (primary section, then sub-view; on multimedia
  the second is the floor/area list, the same popover as the existing floor menu). The controls row is folded
  into one "tune" icon button (security: quality / cameras / columns; multimedia: status + search) plus the
  fullscreen button.
- **C, hybrid.** A segmented control when the list has 3 items or fewer (always visible, one tap); a dropdown
  for 4+ items or long lists (the `kindFor` rule in the file). Security Live: the 3 sections as a segmented row, then
  one row with the 3 views as a compact segmented control plus tune + fullscreen. Switch to "חקירה" (5 views) and
  that row becomes a dropdown by itself. Multimedia: segmented sections, then area dropdown + status dropdown + search.
- **Settings.** A new "תצוגת לשוניות" card with installation default, personal preference and a live preview.

The dropdown is a real control: a `button` with `aria-haspopup="listbox"`/`aria-expanded`/`aria-controls`, a popover
`role="listbox"` with `aria-activedescendant`, groups (floors) as `role="group"`, Arrow Up/Down, Home/End,
typeahead, Enter/Space select, Esc closes and returns focus to the chip, Tab closes, outside tap closes, the
selection re-renders and focus returns to the same chip. The chip is 32 px high with a 44 px hit area (an
`::after` that overlaps the row padding, the same trick as the shell's floating buttons); options are 44 px.
Motion uses the `--t-*` tokens, which are 0 ms under `prefers-reduced-motion`. The popover is the media area's
translucent sheet (`--mm-sheet-surface`, `blur(40px) saturate(1.8)`), kept inside the frame and RTL-anchored.
The tune panel is a non-modal `role="dialog"` with Esc and focus return. Verified in headless Chromium with
Playwright: no console errors or warnings; Enter picks and focus returns; Esc closes and focus returns.

Tokens are the real ones: SW A block of `frontend/src/styles/tokens.css` (security, settings) and the glass
light/dark values of `devices-themes.ts` + `media-glass.ts` (multimedia). **The product has no dark SW A
theme yet**, so the dark security/settings frames borrow the device dark palette (flagged here and in the file).

## Measured vertical space (390 px, light, live in the page; table at the bottom of `index.html`)

Pixels from the top of the screen (shell header row included) to the top of the first content item.
The 48 px header row is the same in all variants and holds the title and the floating search/status pill.

| Screen | Variant | Header | Control rows (sticky block) | To first item | Saved vs A |
|---|---|---|---|---|---|
| Multimedia | A | 48 | 174 | **232** | - |
| Multimedia | B | 48 | 40 | **98** | 134 px (58%) |
| Multimedia | C | 48 | 80 | **138** | 94 px (41%) |
| Security, Live | A | 48 | 120 | **178** | - |
| Security, Live | B | 48 | 40 | **98** | 80 px (45%) |
| Security, Live | C | 48 | 80 | **138** | 40 px (22%) |

At 820 px (side rail, no bottom bar, 56 px header): multimedia 242 / 108 / 148, security 188 / 108 / 148 (A / B / C).
Because the multimedia header block is sticky, B also shrinks what stays pinned while scrolling from 174 px to 40 px.
Caveat: the fixtures use a 3-chip area row and one-line labels; a real wrap (long Hebrew names, more areas) only makes A taller.

## Taps to reach a view (one tap = one press; the popover closes on pick)

| Action | A today | B dropdowns | C hybrid |
|---|---|---|---|
| Switch section (3) | 1 | 2 | 1 |
| View inside a section (3, Live) | 1 | 2 | 1 |
| View inside a section (5, Investigation) | 1, plus sideways scroll | 2 | 2 |
| Area filter | 1 if the chip is in view | 2 | 2 |
| Status filter (4) | 1 | 3 (open tune, pick; closing is optional) | 2 |
| Search | 1 (field already open) | 2 (open, type) | 2 |
| Quality / columns / cameras | 2 | 3 | 3 |

## Design opinion

- **Where the owner is right.** Two stacked tab rows plus chips plus a control row cost 120 to 174 px on a 780 px
  phone, 15 to 22 percent of the screen, and the multimedia block is pinned. One 40 px row gives the pixels back.
  The popover also scales to long lists (floors, 10 investigation tabs), which a scrolling row never did well.
- **The costs of B (dropdowns for everything).** (1) Discoverability: the other sections are hidden until the chip is
  opened; a user who never taps it never learns "קבוצות" exists. (2) The most-used switch (Live / Investigation /
  Alarm, players / screens) goes from 1 tap to 2. (3) State is visible only for the selected item; counts and
  alerts of the others, such as "אזעקה (6)", vanish. (4) Controls hidden behind a tune button cost a tap each time
  (quality, columns). (5) Two unlabeled chips side by side can read as two filters; the prefix icons help, captions would cost width.
- **Counts and alerts.** The mockup puts the selected item's count in the chip ("מסכים (5)"), and a dot on the chip
  when a *hidden* option has an alert (red for alarms, amber for "לא זמינים"); inside the list each option keeps its
  count. The dot on the tune button shows an active filter. The chip's `aria-label` repeats it ("יש התראות באפשרויות אחרות").
  This helps but is still weaker than a visible "(6)" on a tab; for alarms I would keep alarm a tab.
- **Recommendation: C, the hybrid, as the phone default; B as an opt-in.** The first level of three (the daily
  switch) stays a one-tap segmented control with visible counts, so nothing is hidden; the sub-level and the filters
  with 4+ items or long lists become compact dropdowns, and the controls fold into one row. It recovers 41 percent
  (multimedia) and 22 percent (security Live) of the pre-content space with no extra tap on the primary switch.
  B recovers more (58 and 45 percent) at the price of a tap and hidden state on every switch, which is why it should
  be a user choice rather than the default. Security Live gains less in C because its two rows are both
  3-item, so only the controls row is saved; further savings there need B or merging the two segmented rows into one dropdown.

## Plugging into `sw-tabs` and `ui.tabs` (not implemented)

Today `sw-tabs` (`frontend/src/components/sw-tabs.ts`) takes `items`, `active`, `variant: 'pill' | 'underline' |
'underline-compact'`, and fires `change`. `ui.tabs` (`api/media.ts` types, `shell/nav.ts` `tabStyleOf`) stores a
per-section order/hidden/`style` plus the reserved `styles` key `{ level1, level2 }`, edited in
הגדרות › כללי › לשוניות (`screens/system-tabs.ts`).

Proposal, additive only:

1. Add `'dropdown'` to `TabVariant` (and `TabStyle`, and `TAB_STYLE_VALUES`). `variant="dropdown"` renders the chip + listbox
   above with the same `items` (including `count`), `active` and `change` event, so callers do not change. Add an
   optional `alert?: boolean | 'warn'` to `TabItem` for the chip dot.
2. The hybrid is not a style but a rule, so keep it out of the variant list: a new attribute/prop `adaptive`
   (default false) that renders a segmented pill when `items.length <= 3` and the dropdown otherwise; the shell passes it
   when the effective mode is `hybrid`.
3. `tabStyleOf()` stays the one helper. A new `tabModeOf()` returns `tabs | hybrid | dropdown`; in `tabs` mode nothing changes.
4. Pairing two rows into the "two chips side by side" layout needs a small shell change (`sw-app` renders
   the area row and the section row separately today): a `tab-pair` container used only in `dropdown`/`hybrid` mode.
5. The folded controls row (tune button, security quality/cameras/columns, multimedia status/search) belongs to the
   screens, not to `sw-tabs`; it is a separate small component and a separate slice.
6. Specs: `grep -rl sw-tabs frontend/tests` finds **29 spec files** (evidence-*.spec.ts). The default stays
   `tabs`, the DOM of the `pill`/`underline*` variants is untouched, so these keep passing unchanged. New specs cover only
   the `dropdown` variant (keyboard, Esc/focus return, 44 px hit area, RTL, reduced motion) and each mode's DOM, run with
   the mode set explicitly. Specs that click a tab by role/name need the mode forced to `tabs`; on the phone they run under a coarse pointer already.

## Owner addition: the choice is a Settings preference (requirement)

Precedent, checked in the code: **"הגדרות › כללי › גודל הניווט"** (`screens/system-nav-size.ts`, `shell/nav-size.ts`).
`ui.nav_size` is an installation default in `/settings` that a system administrator edits, and the same key in the
per-user `/me/prefs` (closed key list in `routers/me.py`, `api/me-prefs.ts`) overrides it for that user ("ברירת מחדל של
המערכת" clears it); the user's value wins and follows them across devices. The existing `ui.tabs` style, by contrast,
is installation-wide only (the admin card "סגנון סרגל"; every user sees the same look). The dropdown/tabs choice is a
personal taste, so it should follow the `ui.nav_size` pattern, not the `ui.tabs.styles` one.

Requirement:

- Three values: `tabs` (today's look, the default), `hybrid`, `dropdown`.
- **Installation default:** new setting `ui.tabs_mode` (string, default `"tabs"`) in `routers/settings.py`; edited by a
  system administrator in a new card "תצוגת לשוניות" at the top of הגדרות › כללי › לשוניות. It does not touch the
  `ui.tabs` object (whose keys are section ids plus the reserved `styles`).
- **Personal preference:** new key `ui.tabs_mode` (string or null) in `/me/prefs` (add to the closed list, the
  `MyPrefs` type and `putMyPrefs`), edited by any signed-in user in the card "ההעדפה שלי" on the same screen, or in
  "החשבון שלי" next to the nav-size control. Null/"לפי ההתקנה" follows the installation. Effective mode = the user's value, else the installation's.
- **Scope:** applies on the phone (width up to 767 px) only by default, since the saving matters there; whether it should also apply to wider screens is an open question.
- **In `tabs` mode** the existing `ui.tabs` per-level and per-section `style` still decide pill / underline / compact. In `hybrid`
  and `dropdown` mode they only decide the fallback look of any bar the mode does not convert.
- **Cache and first paint:** the same pattern as `nav-order.ts` (a per-user localStorage copy for first paint, the server wins).
- **Mockup:** `index.html` > Settings shows the placement and Hebrew labels (two radio groups with descriptions: "כמוסות ופסים (כמו היום)",
  "משולב (מומלץ)", "תפריטים נפתחים", the personal group with a leading "לפי ההתקנה (כרגע: ...)" option) and a live preview that
  re-renders the multimedia screen as you change either group.

## Open owner questions

1. Default for new users and the installation: `tabs` (no change), or `hybrid`? (I recommend `tabs` until the owner has tried `hybrid`, then flip the default.)
2. Should the mode apply only on phones (<= 767 px), or also on the tablet/desktop widths?
3. Alarm: keep "אזעקה (6)" always visible even in `dropdown` mode (a pinned alert badge outside the dropdown)?
4. Multimedia search and status in B: behind the tune button as shown, or keep search always visible (costs about 38 px back)?
5. Security controls (quality, cameras, columns): fold into the tune panel (3 taps to change) or keep them as visible chips?
6. A dark SW A theme does not exist yet; accept the borrowed device dark palette for the dark security frames for now?
