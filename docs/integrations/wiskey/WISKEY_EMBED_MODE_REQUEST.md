# Request to the WisKey developers: an "embed mode" for SMPLWISE VMS

Requested by the product owner on 2026-09-28. Written by SMPLWISE so that, once WisKey implements it, SMPLWISE can
switch from its current DOM-based embedding to a stable contract in one small change.

## 1. Why

SMPLWISE VMS (a Home Assistant add-on, served through Supervisor Ingress on the same origin as Home Assistant) now
shows the WisKey panel inside its own "WisKey" area as an iframe of `/hikvision-intercom`. It works, but:

- The user sees **two menu rows**: SMPLWISE's WisKey tabs above the frame, and WisKey's own top toolbar (logo, its
  tab row, the Home Assistant menu button ☰, refresh) inside it.
- WisKey's panel **does not read its tab from the URL** (`_tab` is kept in memory only), so SMPLWISE deep-links a
  tab by reaching into the frame's DOM and calling the panel element's `navigate(tab)`. That is fragile: any
  refactor of `panel.ts` breaks it.
- Home Assistant's sidebar has to be hidden from outside the frame (SMPLWISE dispatches HA's `hass-kiosk-mode`
  event into the frame, with a CSS fallback). WisKey can do this itself, more reliably.

Nothing about WisKey's normal use should change: opened from the HA sidebar it keeps its toolbar, its menu button
and its behaviour exactly as today. Embed mode is opt-in through the URL only.

## 2. The contract (what SMPLWISE will rely on)

### 2.1 URL parameters (read on load and on every `location-changed` / `popstate`)

- `embed=1` — embed mode on. Nothing is persisted; reloading the same URL keeps the mode, opening
  `/hikvision-intercom` without it gives the normal panel.
- `tab=<id>` — the panel tab to show, using the panel's existing tab ids (the values `_tab` already takes today:
  overview, users, events, devices, sync, and the management hub, plus camera wall / media options if they are tabs).
- `tool=<id>` — inside the management hub, the tool to open (schedules, whatsapp, access control, identity
  lifecycle, health, audit, operations center, clock, appearance, HA-user permissions, TTS, ... — the ids the hub
  already uses internally). Optional; without it the hub shows its grid as today.
- Unknown ids fall back to the panel's current default with no error.
- The panel **writes its current `tab` (and `tool`) back to the URL** with `history.replaceState` whenever the user
  navigates inside it, so the browser's back/forward and SMPLWISE's bookmarks stay correct. This applies in
  normal mode too — it is harmless there and makes WisKey deep-linkable from anywhere (HA dashboards, notifications).

### 2.2 Presentation in embed mode

- Hide the panel's own **top toolbar entirely**: logo/title, the tab row, the HA menu button ☰, the refresh button
  (SMPLWISE provides refresh through its own tab re-open; if WisKey needs a refresh affordance inside the content,
  a small in-page control is fine).
- Keep **all in-page navigation that is content**: the management hub's grid of tools, back links from a tool to
  the hub, dialogs, the sub-navigation inside a tool. Only the top chrome goes.
- Hide Home Assistant's sidebar from inside: on entering embed mode dispatch HA's own kiosk event on `window`
  (`hass-kiosk-mode`, Home Assistant frontend 20260107.0 / HA 2026.1 and later, `src/state/sidebar-mixin.ts`;
  it is kept in memory only, so the user's other HA tabs are not affected). Do not use `hass-dock-sidebar` /
  `always_hidden` — those persist in localStorage and would hide the sidebar everywhere. On older HA where the event
  does not exist, do nothing (SMPLWISE keeps its CSS fallback for that case).
- Do not swallow `hass-toggle-menu` globally; simply do not render the ☰ button in embed mode.
- Layout: the panel fills its host with no outer margin/max-width that assumes HA's header height; RTL as today.

### 2.3 A small message channel (optional, but it is what makes the embedding stable)

Same-origin `postMessage` between the panel and `window.parent`, always checking `event.origin === location.origin`:

- Panel → parent, on load: `{ type: "wiskey:ready", version: 1, tabs: [{ id, label }], tools: [{ id, label }] }`.
- Panel → parent, on every navigation: `{ type: "wiskey:location", tab, tool }`.
- Panel → parent, on the document title/heading change: `{ type: "wiskey:title", text }`.
- Parent → panel: `{ type: "wiskey:navigate", tab, tool }` — same effect as the URL parameters.

With this, SMPLWISE stops touching the frame's DOM at all: it reads `wiskey:ready` for the tab list (so new WisKey
tabs appear in SMPLWISE automatically), mirrors `wiskey:location` into its own URL, and sends `wiskey:navigate`
when the user picks a SMPLWISE tab.

### 2.4 Capability signal

Expose the contract version so SMPLWISE can detect it and fall back gracefully on older WisKey builds:
`data-embed-api="1"` on the panel's root element, and `version: 1` in `wiskey:ready`. Bump the number only for
breaking changes.

### 2.5 Explicitly unchanged

- WisKey's own permissions, audit and confirmations apply exactly as today inside embed mode (SMPLWISE states this
  to its users). No new permission, no bypass.
- No storage writes for the mode; no change to the HA side (`panel_custom` registration stays as is:
  `frontend_url_path` `hikvision-intercom`, `require_admin` false, `embed_iframe` false).
- Normal opening from the HA sidebar: identical to today.

## 3. Suggested implementation notes (for the developer, not binding)

- Parse the parameters once in the panel's `connectedCallback`/first update and again on `location-changed` and
  `popstate` (HA fires `location-changed` on `window` for in-app navigation).
- `_tab`/tool setters become the single place that (a) updates state, (b) `history.replaceState`s the URL,
  (c) posts `wiskey:location`.
- Embed mode as one boolean on the panel (`embed`) that the toolbar template checks; a `data-embed` attribute on
  the root for styling.
- The kiosk event: `window.dispatchEvent(new CustomEvent("hass-kiosk-mode", { detail: { kioskMode: true } }))` —
  please confirm the exact `detail` shape against the HA frontend version you target (`sidebar-mixin.ts`).
- Message handler: ignore messages whose `event.origin` differs from `location.origin`; ignore unknown types.

## 4. Acceptance checklist

1. `/hikvision-intercom?embed=1&tab=users` opens the people tab with no WisKey toolbar and no ☰; HA's sidebar hidden
   (HA 2026.1+); `/hikvision-intercom` alone is unchanged.
2. Navigating inside the panel updates the URL (`tab`, `tool`) and posts `wiskey:location`; back/forward work.
3. `wiskey:navigate` from the parent switches tabs/tools; unknown ids are ignored safely.
4. The management hub, its tools and dialogs are fully usable without the top toolbar, on desktop and on a phone.
5. Nothing is written to localStorage for the mode; other HA tabs keep their sidebar.
6. `data-embed-api="1"` present; `wiskey:ready` sent once per load with the tab and tool lists.

## 5. What SMPLWISE will change once this ships

Replace its DOM deep-link (`navigate()` through the frame document) and its own kiosk dispatch with the URL
parameters and the message channel; build its WisKey tab row from `wiskey:ready`; keep the current mechanism only as
a fallback when `data-embed-api` is absent. Estimated: one short slice.
