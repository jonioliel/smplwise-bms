# Tabs-as-a-dropdown: six closed-control styles (0.1.157 pre-work)

Static mockups for the owner to pick the look of the "tabs as a dropdown" control (`sw-dropdown`, used by `sw-tabs` in
dropdown mode). Today the mode is phone-only; 0.1.157 is meant to offer it on all widths, so every style is shown at
1440 / 820 / 390. Design only: no product code, no migrations, no device access. Branch `pilot/0157-dropdown-mockups`.

Open `index.html` directly (file://, no build, no network). Top bar: style, skin (classic / domus / tesla / bubble),
light / dark, the ten Bubble palettes, the radius dial (pill / soft / square, Bubble only as in the product), the touch dial
(44 / 32), the performance tier (lite = no backdrop-filter, sheet colour at the contrast-floor alpha), the phone popup dial
(bottom sheet / centred). The state is in the URL hash, so a link reproduces a view. Every control on the page is live:
click opens and closes, the search field filters, Esc / arrows work on an open popover.

Sections:

| Section | What it shows |
|---|---|
| A. Side by side | The six styles in one grid: closed with a count, closed with a hidden-alert dot, keyboard focus, the open list (3 items, or 13 items + search with the toggle), the two-chip pair row at 390 px with the alarm pin and the floating corner |
| B. In context | The selected style on a 1440 desktop (security > investigation > recordings with the 10-item list open; settings with the 13-item list open and a keyboard cursor), 820 tablet (tree in a drawer), 390 phone (pair row closed; the long list as a bottom sheet; settings with a typed search), plus the floor/area list grouped by floor (the tree in list form) |
| C. Skins | The selected style in all four skins, light and dark |
| D. Palettes | The selected style in the ten Bubble palettes, light and dark |

Hebrew labels are the real ones from `shell/nav.ts` (security sections and pages, settings tabs, settings > security sub-tabs,
multimedia counts). Tokens are copied from `frontend/src/design/tokens.ts` and the four skins as of 2026-10-03; the palette ->
token mapping approximates `design/palette.ts` (the mockup sets `--sw-surface-3` to the palette's `surface2`; the real layer is
richer). The dropdown reads tokens only, which is why section D needs no per-palette work.

## The six styles

| id | Hebrew | Closed control | Selected option in the list | Where it comes from |
|---|---|---|---|---|
| `pill` | כמוסה | Filled pill, no border (`--sw-surface-2` on Bubble, `--sw-surface-3` elsewhere), `--sw-r-pill` | Solid pill (`--sw-surface-solid`) | Bubble's resting look today (`skins/bubble.ts` rule 10) |
| `field` | שדה מעוגל | Bordered field (`--sw-border-strong`), `--sw-r-sm`, shadow-1; accent border when open | Accent text + check mark | Classic's resting look today (`sw-dropdown.ts` defaults) |
| `underline` | קו תחתון + חץ | Transparent, accent text, 2 px accent underline; accent-soft fill when open | 3 px accent bar on the inline-start edge + accent-soft fill | The `underline` tab bar of the settings pages |
| `text` | טקסט + חץ | Bare heading text (fs-xl, bold) with the chevron in a small round badge; the dot sits inline | Bold + small accent dot | "The page title is the menu" (iOS / Material navigation drop-downs) |
| `prefix` | קידומת קבוצה | Soft chip (`--sw-r-md`) with the group name in `--sw-text-3`, a hairline, then the value | Surface-3 fill; group headings get a hairline | Audit question B6.3 ("אבטחה: חקירה") |
| `tonal` | גוון הדגשה | Accent-soft fill, accent text, `--sw-r-md`; solid accent when open | Accent-soft fill | The selected segment of the pill tab bar, standing alone |

Every style shares the same anatomy and behaviour (the component stays one component): label, optional count "(n)", the
chevron that flips when open, the hidden-alert dot (red = alert, amber = attention) when another option carries an alert,
the list with per-item counts and dots, group headings, a search field once the list has 8 or more items, a 2 px focus ring
(`--sw-focus`, offset 2), a cursor row distinct from the selected row, the chip at `touch - 12 px` (44 -> 32, 32 -> 28) with
the hit area grown to the dial, options at the dial height (48 px in the phone sheet). The popover is a translucent sheet
only where the skin says so (`--sw-glass-blur-sheet`: Bubble and Domus); classic and Tesla get an opaque surface; the lite
tier and `prefers-reduced-transparency` remove the blur everywhere. Forced colours keep an outline on the selected option.

## Recommendation

Ship **`pill`** as the default and offer **`field`** and **`underline`** as the two alternatives in the style setting.
Do not build `text`, `prefix` and `tonal` as selectable styles (reasons below); keep the prefix idea as an option flag
("show the group name") if the owner wants it, not as a style.

Why these three: they are the only ones that (1) read as a control in all four skins without per-skin exceptions,
(2) survive the pair row at 390 px with ellipsised labels, (3) sit beside an `h1` on the desktop without competing with it,
and (4) are already two-thirds implemented (`pill` = Bubble today, `field` = classic today), so the setting is mostly a
matter of exposing a choice and adding `underline`.

Default for existing installations on upgrade: unchanged look (the skin's resting style: Bubble -> `pill`, the other skins
-> `field`) until someone picks a style. A new global style value `auto` = "the skin's resting style" keeps that honest.

## Honest pros and cons

**pill**
- Pro: the Bubble language; the segmented pill bar collapses into it naturally (same radius, same fill), so hybrid mode is
  visually continuous. Good at 32 px. Dark palettes read well.
- Con: on classic light the fill (`#eef2f8`) is quiet; it needs `surface-3`, not `surface-2`, or it vanishes into the page.
  On Tesla the pill is a 6 px rectangle, which is the skin's intent but looks like a button there (mockup adds a hairline).
  The chip alone does not say "there are other options" as loudly as `field`; the chevron carries that.

**field**
- Pro: unmistakably a selector; the strongest affordance of the six, and the one screen readers users expect. Works in
  every palette, including high-contrast, because it has a real border.
- Con: it is a form control; three of them in a page head (sections + pages + the alarm pin) start to look like a filter
  bar rather than navigation. On Bubble it fights the borderless language (the mockup rounds it to `--sw-r-md`, which
  helps but does not fully belong).

**underline**
- Pro: keeps the identity of a tab: operators who knew the underline bar see the same colour and line, just one tab with a
  chevron. The cheapest visual step from "tabs" to "dropdown", and the natural partner of hybrid mode on the settings pages.
- Con: weak on the phone pair row: two underlined words with chevrons next to an alarm pin look like links, and the hidden
  alert dot has no box corner to sit on. Needs an accent-soft open state or the active chip disappears on dark glass.
  Not a natural fit for Bubble (Bubble has no underlines anywhere).

**text**
- Pro: the most elegant on a desktop page head: one bold title with a small chevron badge; zero chrome.
- Con: I would not ship it. It replaces the `h1` semantically (the title becomes a button), two of them in the pair row look
  like two headings, the count and the alert dot have nowhere good to sit, long labels ("משתמשים והרשאות") at fs-xl break
  the 390 px pair immediately, and the clickable area is invisible until hovered. It also breaks the "clean operator
  screens" rule in the other direction: too little signal that it is a control.

**prefix**
- Pro: answers "where am I" in one chip ("אבטחה: חקירה"), useful when the dropdown stands alone on a wide screen with no
  breadcrumb above it.
- Con: it costs 40-70 px per chip; at 390 px the second chip's prefix has to be dropped (the mockup does exactly that), so
  the style is inconsistent between widths. In the pair row the prefix duplicates what the first chip already says, and on
  desktop the `h1` already names the group. Better as a flag on another style than as a style.

**tonal**
- Pro: visually strong and cheerful; in Bubble palettes it picks up the accent nicely; reads as "selected".
- Con: that is the problem: accent-soft + accent text is the product's *selected / pressed* state (pill bar segment, area row
  in the tree, badges). A permanently "selected"-looking chip beside unselected content suggests a toggle, not a menu; three
  of them in a row look like three active filters. In high-contrast the accent-soft fill is almost invisible. Not recommended.

## Answers proposed for the six audit questions (B6)

1. **Widths and places:** one mode setting for all widths; on wide screens the dropdown replaces the level-1 sections, the
   level-2 pages and the settings tabs only when `dropdown` is chosen; `hybrid` stays (bars up to 3 items, dropdown above).
   The area row (2 items) stays a bar in hybrid.
2. **Pair vs one chip:** keep the pair on every width (sections + pages in one row, alarm pin at the end). On the desktop the
   pair sits in the page head after the `h1` with a hairline separator; the floating search corner stays and the row keeps
   the 84 px end reserve only on the phone (desktop has the corner above the content, not over the row).
3. **Closed control:** active label + count; the hidden-alert dot on all styles; no icon by default (an optional `icon` prop
   exists already); group prefix as an optional flag, not a style.
4. **Open list:** popover on >= 768 px, bottom sheet or centred on the phone following the Bubble `popup` dial; grouped
   headings; counts and dots per item; search from 8 items; max height 360 px popover / 72 % sheet; flip above when short.
5. **Themes:** tokens only; glass only where `--sw-glass-blur-sheet` is not `none` (Bubble, Domus); lite tier,
   reduced-transparency and forced-colours handled in the component, not per skin; chip and options follow
   `--sw-touch-desktop`; radii follow `--sw-r-*` so the radius dial works for free.
6. **How it is chosen:** a separate `ui.dropdown_style` (installation default + "ההעדפה שלי"), values `auto | pill | field |
   underline`, default `auto` (the skin's resting look, i.e. today's rendering). Per group is not worth its UI. The always-bar
   `sw-tabs` outside the mode (settings sub-tabs 11, permissions 5) should join the mode in the same slice, otherwise the
   settings screen shows two tab languages at once; the floor/area breadcrumb menus adopt the list look (section B shows the
   area list grouped by floor) but keep their own trigger.

## Limits of this mockup

- Static HTML; the popover is positioned under its chip and does not flip or clamp to the viewport (the real component does).
- The phone frames are desktop renders at 390 px; no real device, no real fonts (the token stack falls back to Segoe UI /
  Arial where Heebo is not installed). The Bubble `--sw-look-scale` and density dials are not modelled.
- Palette colours are applied through an approximate token mapping (see above); the contrast table of `docs/design/palettes`
  remains the authority.
- Not run through Playwright or the product's rule budget; the Bubble skin has about 7 rule blocks left of 50, so the chosen
  styles should live inside `sw-dropdown` (a `style` property) rather than in `skins/bubble.ts`.
