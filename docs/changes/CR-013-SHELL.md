# CR-013 — The app shell: the user as the navigation's last item, no phone top bar, a per-user tab order

**Numbering:** CR-013 as assigned by the coordinator on 2026-09-29 (a CR-011 about a second sign-in factor is written
on another branch; renumbered at merge if needed). Task card T094 (the next free id on this branch), requirements
R190-R191, acceptance tests AT190-AT191.

**Status:** requested by the owner on 2026-09-29 from his phone, with a clarification on 2026-09-30 (every navigation
change applies to the desktop too). Built on branch `pilot/CR011-shell` on top of CR-010's security area; build
status in §7.

## 1. The request (owner, translated)

1. On the phone the white top bar (avatar, sign-out icon, bell) wastes space: remove it on phone widths. The user
   (avatar) moves into the bottom bar as its last item and opens the user menu (a bottom sheet on the phone).
2. Settings ("מערכת") is no longer a tab: it becomes an item of the user menu, shown only to users who hold any
   settings permission. Sign-out lives in the user menu too.
3. The bell is removed. Open alerts put a red dot on the avatar (the count in its accessible name); the user menu's
   first item is "התראות" with the count, opening the alerts inbox. Critical alert banners and toasts stay.
4. Bar order and names: "ראשי" first - today's "חשמל" tab (the device overview), only renamed with a home icon (the
   screen itself is unchanged and will be redesigned later) - then "אבטחה", "מפה", "WisKey", then the avatar. The
   bare address lands on "ראשי"; deep links keep working; tabs the user may not see stay hidden.
5. A per-user tab order: "סדר הלשוניות" in the user menu opens a small dialog - the user's visible tabs as a vertical
   list with drag handles and up/down buttons (touch and keyboard), "שמור" and "אפס לברירת המחדל" - stored per user
   on the server so it follows the user to every device, cached locally for an instant first paint (the server wins).
   The avatar is always last and not movable.
6. Clarification 2026-09-30: all of this applies on the desktop too. The side rail shows the same tabs in the user's
   order with the avatar at its foot, opening the same menu as a popover beside the rail; "מערכת" and the bell leave
   the rail and the top bar; the rail's old bottom items stay only if they are real destinations (moved into the
   menu). The desktop top bar keeps only what is not navigation or identity: the search (Ctrl+K), the breadcrumbs,
   the security section control and the health pill. Below 768 px the phone layout applies.
7. Without a top bar on the phone, the security sections (לייב | חקירה | אזעקה) become a slim sticky row at the top of
   the content, respecting the status-bar inset, and each screen's own tab row is the second row and scrolls sideways
   without clipping a label (scroll-snap, hidden scrollbar, a fade at the clipped edge, the active tab scrolled into
   view). The "נתוני הדגמה" pill, the setup-progress link and the health pill move into the user menu's header.
8. The Android app (its own WebView) and the installed web app: the content must not slide under the status bar once
   the top bar is gone; "החלף שרת" (only inside the Android app) is an item of the user menu.

## 2. What was built

### 2.1 Navigation (design SW A)

- `frontend/src/shell/nav.ts`: `NAV_A` is now `devices` (ראשי, home icon, `#/devices/building`) · `security` · `explore`
  (מפה) · `wiskey`. `system` left the list and is `SYSTEM_AREA`, still a route area (crumbs, tabs) but reached from the
  menu. `visibleAreas(api, can, order)` sorts by the user's order; `settingsEntry()` returns the "מערכת" item only when
  a settings tab other than the personal notification preferences (`PERSONAL_SYSTEM_HREFS`) is visible to the user;
  `landingTarget()` picks the start screen, or the user's first visible tab when they cannot see it.
- The rail: the brand tile (decoration, no link), the tabs, and the avatar at the foot (`[data-profile-menu]`).
  "מקומי ומאובטח" (a label, not a destination) was dropped; "מסכים" (the screen catalogue) became a tab of the settings
  area, "כל המסכים", for `system.configure` holders (and in the demo).
- The phone bottom bar: the tabs, each a 58 px tall target with an icon pill that fills with the accent on the active
  tab, and the avatar as the last slot (`[data-nav-me]`, the user's first name under it).
- The avatar is a neutral grey circle; it turns blue only while the menu is open or on the settings (`#/system/...`),
  where it is the active navigation item (`aria-current="page"`). A red dot (9 px on the phone) marks open alerts.
- The desktop top bar: crumbs, section control, search, the health pill (or "נתוני הדגמה" in the demo). No avatar,
  role line, bell, sign-out icon or wordmark.
- Design B (the older boards, the static demo's default) keeps its own navigation unchanged.

### 2.2 The user menu (`frontend/src/shell/sw-user-menu.ts`)

One panel for every width, opened from the avatar: a popover beside the rail's foot on a wide screen, a bottom sheet
with a scrim and a grab handle on the phone. No explanatory text: one line per item.

- Header: avatar, name, role; on the phone a pills row (the health pill as `[data-menu-sys-pill]`, "נתוני הדגמה",
  "השלם את ההתקנה · n/m" linking to the wizard), rendered only while the sheet is open, so `[data-sys-pill]` stays
  unique on the page.
- First level: התראות (a red count chip only when there are open alerts; the item only for users who may read
  alerts) · מערכת (only with a settings permission; opens the first settings tab the user sees) · החשבון שלי ·
  יציאה at the foot, destructive-styled (the remote channel only: under the local entry the platform owns the
  sign-in).
- החשבון שלי (a second level in the same panel, with a back control): סדר הלשוניות · הגדרות התראות (the user's own push
  preferences, `#/system/notifications`, a bell-with-gear icon) · הכניסות שלי (the user's own remote sign-ins, loaded
  only when the section is opened) · החלף שרת (only inside the Android app). A user who sees no tab (no role yet) gets
  neither סדר הלשוניות nor הגדרות התראות.

Escape steps back from the second level, then closes; the scrim and ✕ close; focus returns to the avatar; Tab stays
inside. A menu item closes the panel and removes its history entry before it navigates (§2.5). Motion uses the token
durations, which drop to 0 ms under `prefers-reduced-motion`.

### 2.3 Alerts

The bell (a button without an action) is gone. The shell asks `GET rules/alerts?unacked=true` on load, every minute
and when the menu opens, for users holding `events.read` (never inside the kiosk or the Lovelace card view), and shows
the server's `unacked`. That count and the list are now filtered by the caller's camera scope in the query itself
(camera ids through `json_each`, camera-less alerts only with the installation-wide grant), so a scoped user's count is
their own and their older alerts are found behind newer ones of other cameras; the route runs on the read-only
connection. The avatar's accessible name says "התראה פתוחה אחת" / "N התראות פתוחות". "התראות" opens
`#/investigate/rules?tab=alerts`, which opens on the alerts tab; a user without `rules.manage` gets the alerts alone,
decided before the first paint (no rules request, no rules tab, no "חוק חדש"), and the acknowledge button needs
`events.ack`. The critical system banner and the permission toast are unchanged.

### 2.4 Per-user tab order

- Server: migration **0037** `user_prefs (user_id, key, value_json, updated_at)` - a closed list of keys, today only
  `nav.order`. `GET /api/v1/me/prefs` returns the caller's own preferences (every known key, the default when unset,
  `stored` naming the keys the user set); `PUT /api/v1/me/prefs` is a partial update, `null` resets a key, an unknown
  key is a 422 (never free-form storage). `nav.order` keeps the known ids (`devices`, `security`, `explore`, `wiskey`)
  in the given order, drops unknown ids and duplicates, and appends missing tabs in the default order; a row that no
  longer parses reads as the default. No existing per-user store fitted: `push_prefs` has fixed columns for
  notification categories, saved views and device layouts are shared objects, and the product settings are
  installation-wide and readable by every user. Preferences are not in the project backup (like `push_prefs`).
- Client (`frontend/src/shell/nav-order.ts`): the order is the default until the user is known; a copy in
  `localStorage` (`sw.nav.order`, keyed by the user id, inside try/catch) then paints at once and the server's answer
  replaces it. Save is optimistic and reverts when the server refuses; an answer that arrives after another user
  signed in is ignored. The static demo keeps the order in the browser.
- Dialog (`frontend/src/shell/sw-nav-order.ts`): each row is a drag handle, the tab's name and ▲/▼ (44 px), evenly
  spaced; dragging uses pointer events (touch and mouse alike; `touch-action: none` on the handle); Arrow/Home/End keys
  on the handle; a polite live region announces each move; a fixed "המשתמש" row with a lock closes the list. The
  footer is "אפס לברירת המחדל" (a text action) and "שמור"; ✕ cancels. Tabs the user does not see keep their place in
  the stored order.

### 2.5 The phone content head, and Back

- The shell pads its own top by `--sw-safe-top` (`env(safe-area-inset-top)`), so nothing slides under the status bar in
  a standalone web app with a notch; not in the kiosk or the card view. The degraded-system banner sits at that edge.
- In the security area only the section selector (לייב | חקירה | אזעקה) is sticky: a slim row (a 34 px track, 44 px
  targets). The screen's own tab row is the second level - the underline variant, 44 px targets - and scrolls away
  with the content. `sw-tabs` scrolls sideways with `scroll-snap`, hides its scrollbar, fades the edge that hides more
  tabs (computed from the tabs' boxes, so right-to-left needs no special case) and keeps the active tab fully in view.
  The owner's screenshot - "בריאות" cut at the edge - now reads as a fading row.
- The setup-progress banner is hidden on the phone; its link is a pill in the menu's header.
- Back: while the phone sheet or the tab-order dialog is open, one history entry (same address) stands for it, so
  Back closes the overlay instead of leaving the screen. Closing it by ✕, Esc or save removes the entry; a menu item
  removes it first and then navigates; any navigation closes both.

### 2.6 Landing

`ui.start_route` defaults to `devices` ("ראשי"; the settings screen lists it first). The bare address (`''`, `#`,
`#/`) lands there - or, when the user cannot see it, on their first visible tab in their own order; the static demo
lands on "ראשי" too. An explicit `#/explore/floors/f0` is now a deep link like any other (it used to count as "no
route" while the map was the default). `#/security` still reopens the last used section. An administrator's saved
start screen still wins.

### 2.7 The Android app and the installed web app

- The Android app's own WebView (`mobile/android-shell`, `WebActivity.setupInsets`) always gives the WebView a top
  margin of the status-bar height; from WebView 140 it also passes the insets through, so the page could report a top
  inset as well and pad twice. Inside that app (`inAndroidShell()`) the shell sets `--sw-safe-top: 0px`. Bottom and
  side insets are unchanged (the bottom bar and the menu sheet pad with `env(safe-area-inset-bottom)`).
- The Trusted Web Activity and the installed web app (`display: standalone`, iOS status bar `default`) do not draw
  under the status bar; the inset is 0 there and the padding costs nothing. A notch in landscape keeps its side
  insets on the bottom bar and the sheet.
- "החלף שרת" is an item of "החשבון שלי" inside either Android app. Not verified on a device in this change (see §7).
- While WisKey is expanded ("הגדל"), the user menu and the tab-order dialog are inert with the rest of the shell.

## 3. Permissions and security

Presentation only: the tabs, the "מערכת" item and the alert count follow the permissions the server reports, and every
screen still checks its own permission. `/me/prefs` acts on the caller only - there is no way to read or write another
user's preferences - and the order it stores cannot show a tab the user is not allowed to see. `GET rules/alerts` now
answers a scoped `unacked` (it used to count every open alert of the installation for any caller).

## 4. Files

- Backend: `migrations/0037_user_prefs.sql`, `services/user_prefs.py`, `routers/me.py` (GET/PUT `/me/prefs`),
  `routers/settings.py` (`ui.start_route` default), `routers/rules.py` (scoped alerts, read-only connection); tests
  `tests/test_user_prefs.py`, `tests/test_ui_settings.py`, `tests/test_rules.py`.
- Frontend: `shell/nav.ts`, `shell/nav-order.ts`, `shell/sw-user-menu.ts`, `shell/sw-nav-order.ts`, `shell/sw-app.ts`,
  `api/me-prefs.ts`, `components/sw-tabs.ts`, `components/sw-icon.ts` (grip, arrowUp, arrowDown, bellSettings),
  `screens/investigate-rules.ts` (`?tab=alerts`, alerts without `rules.manage`, acknowledge with `events.ack`),
  `screens/system-diagnostics.ts` (start screen list), `screens/wiskey-embed.ts` (inert overlays).
- Specs: `tests/evidence-shell.spec.ts` (new); updated `evidence-alarm`, `evidence-nvr-less`, `evidence-devices`,
  `evidence-arx-remote`, `evidence-arx-sessions`, `evidence-pwa-push`, `evidence-status-pill`, `evidence-wiskey-embed`,
  `screens.spec`.
- Evidence: `docs/evidence/CR013/shell-*.png`. `contracts/API_INVENTORY.md` regenerated.

## 5. Rollback

Revert the branch's commits. Migration 0037 only adds a table; an older build ignores it (no down migration needed).
Without the new frontend, the stored orders are simply unused.

## 6. Known limits

- The alert count polls once a minute; there is no push of new alerts into the shell.
- The dialog reorders by the handle and the buttons; there is no long-press-to-drag on a whole row.
- A menu item that navigates leaves no extra history entry; a navigation that does not start from the menu while the
  sheet is open (a link on the screen behind it cannot be reached; a programmatic one could) leaves the sheet's entry
  behind the new one - Back then shows the same screen once more.
- The shell has no dark scheme (the device screens have their own); the new parts use the tokens only, so a shell
  dark theme would cover them.
- Design B is unchanged (its top bar, bell and "עוד" menu remain).

## 7. Build status

Built and tested on the branch after one review round (commit hashes in the closing report). Backend tests, the
Playwright specs against the static preview (demo data and a mocked backend), and the fixture-backend specs
(`evidence-nvr-less`, `evidence-status-pill`, the shell-related tests of `evidence-devices`, `evidence-arx-remote`,
`evidence-arx-sessions`, `evidence-wiskey-embed`, `evidence-wiskey`, `evidence-wiskey-people`) were run on private
ports. Not verified on a real phone, in the Android app or in an installed web app.
