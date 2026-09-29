# DomusUI: source extraction for the SmplWise Arx "Electricity / device control" tab

**Scope.** This is a factual extraction of how the open-source DomusUI Home Assistant dashboard is built. It was taken from its source code to inform the design and change request for a new SMPLWISE tab, "חשמל / שליטה על התקנים". That tab would have:
- a tree of floors and areas;
- a room screen with a card per domain;
- a whole-building view.

This document gives facts with file:line references and makes no design recommendations. The only evaluative part is §9, a factual portability list. Anything not confirmed from source is marked **UNVERIFIED**.

- **Repository:** https://github.com/Mattia2399/DomusUI, cloned read-only on 2026-09-28 into the session scratchpad (`.../scratchpad/domusui-ref/repo`).
  - HEAD: `a6eabdabdefdeb9b0b820861127735935f811d12` (2026-09-28 08:54 +0200, "feat: enable GitHub Sponsors").
  - 58 commits; the first is `4ab42c6` (2026-05-12).
- **Product name.** The product is "Domus UI" and the repository is "DomusUI". Internally it is `domusos`: the npm package `domusos` 1.2.1 (`package.json:2-4`) and the HA integration domain `domusos` (`custom_components/domusos/const.py:5-6`).
- **Size.** About 150k lines in 706 files. The two giant files are `src/components/dashboard/MainBoard.tsx` (12,235 lines) and `src/pages/RoomsDashboard.tsx` (7,731 lines).
- **Paths.** All paths below are relative to the repo root. "MB" means `src/components/dashboard/MainBoard.tsx` and "RD" means `src/pages/RoomsDashboard.tsx`.

## 0. License and what reuse it permits

- `LICENSE` is the verbatim **GNU General Public License v3.0** (675 lines). `README.md:12` and `README.md:144` say "Domus UI is released under the GNU GPL-3.0 … You may use, study, modify, and redistribute it under the terms of that license."
- `README.md:144` also says an official app, hosted services and commercial support "may be offered separately in the future". No dual license or separate license text is present in the repo.
- What GPL-3.0 means for SMPLWISE, as a factual reading of the license terms rather than legal advice:
  - **Copying or adapting code**, including translating the TSX into Lit/TS, creates a derivative work. The combined work would then have to be distributed under GPL-3.0 with its source.
  - **Ideas are not covered by copyright**, and GPL does not restrict them. That includes the information architecture, the layout principles, the domain-to-section rules, and the interaction patterns (hold-to-confirm, slide threshold, optimistic TTLs).
  - **Expressive assets are covered.** This includes CSS, SVG, the exact copy strings and images.
  - Reimplementing the behaviour from this written description is the non-copying path. The owner or counsel must decide whether any literal reuse is acceptable (see Q1).
- The repo has `brand/` icons and a `site/` marketing page. Nothing in the repo grants any trademark permission for "Domus UI".

## 1. What DomusUI is (architecture)

- **It is not a Lovelace strategy and not a set of custom cards.** It is a standalone **React 19 + Tailwind 4 + Vite single-page app**, served inside HA as a **custom panel**. Key dependencies (`package.json:31-58`):
  - `react ^19.2.7`, `react-router ^8.3`, `framer-motion ^12.38`, `lucide-react`, `react-grid-layout`, `recharts`, `maplibre-gl`, `home-assistant-js-websocket ^9.6`.
- **Delivery.** It is delivered as a HACS **integration** (`hacs.json`; `custom_components/domusos/manifest.json`: `config_flow: true`, `single_config_entry: true`, `iot_class: local_push`, dependencies `calendar, frontend, http, panel_custom`).
  - The config flow has no fields (`config_flow.py:14-27`).
- **Panel registration** (`custom_components/domusos/__init__.py:53-126`):
  - Static path `/domusos_static` points to the built `frontend/` with `cache_headers=False` (:67-77).
  - It calls `panel_custom.async_register_panel` (:108) with:
    - `webcomponent_name="ha-dashboard-builder-panel"`
    - `require_admin=False`
    - `config={app_url:"/domusos_static/index.html?v=<VERSION>", …}` (:85-97)
    - `handle_safe_area=True` when HA supports it (:98-101)
- **The host web component wraps a same-origin iframe.** Its source is a ```js block inside `docs/home-assistant-panel-bridge.md:12-487`, which a Vite plugin extracts at build time (`vite.config.ts:9-30, 41`).
  - The element receives HA's `hass` object. It builds `<iframe src=app_url>` and refuses a cross-origin URL (doc:255-269).
  - It talks to the SPA with `postMessage`. The iframe never receives a token or the `hass` object (doc:3, 521).
  - Parent to iframe (doc:491-498):
    - `ha-panel-context` carries `hassUrl`, `locale`, protocol version 4 and capabilities.
    - `ha-panel-snapshot` carries the full `hass.states` plus the area list.
    - `ha-panel-state-changed` carries one entity.
  - Iframe to parent (doc:499-506): `ha-panel-call-service`, `ha-panel-call-api`, `ha-panel-subscribe-api`, and a few others.
  - The parent enforces an allowlist of WS types (`HA_PANEL_ALLOWED_API_TYPES`, mirrored in `src/hooks/useHaPanelBridgeConnection.ts:127-172`). Area, floor, device and entity registry writes are on it.
- **Second transport (standalone/dev).** `src/hooks/useHaLiveConnection.ts` uses home-assistant-js-websocket directly (`createConnection`, `subscribeEntities`), with long-lived-token or OAuth auth (:316-325).
  - MB picks the active transport at runtime: `activeHaConnection = isManagedByParent ? panelHaBridgeConnection : webSocketHaConnection` (MB:1644-1651).
- **Routes** (`src/navigation/applicationRoutes.ts:17-52`): `/appgallery`, `/home`, `/rooms` ("Stanze"), `/automations`, `/security`, `/consumi`. The sidebar also has Settings and Profile.
  - Feature status (`docs/feature-status.md:9-19`): Home, Rooms, Security, Consumption, Profile, Settings and Calendar are "Operational"; App Gallery is "Partial"; Automations is "Coming later".
- **Home (`/home`) is not automatic.** It is a user-built drag-and-drop grid, with separate xs…2xl layouts, undo/redo, and a shared layout document.
  - It starts from a **starter template** (`src/templates/starterDashboardTemplate.ts`) with two sections, greeting+weather (:155-170) and scenes `['music','going-out','night','movie']` (:171-181), plus seven widgets: climate, camera, sensor, lock, alarm, media, cover (:31-39).
  - In real mode a starter widget is bound to an entity only when exactly one available entity exists in that domain (`uniqueEntityForDomain`, :189-196). Otherwise the widget is unbound.
- **Rooms (`/rooms`) is the automatic part**, and it is what the owner's screenshots show. The rest of this document concentrates on it.

## 2. What is automatic: discovery and bucketing (Rooms)

### 2.1 Sources and loading
- **Areas.** Areas come from `config/area_registry/list`:
  - The bridge parent loads them once and caches them (doc:287-304).
  - The standalone transport loads them in `useHaLiveConnection.ts:383`.
  - They reach RD as the `haAreas` prop (MB:11362-11376).
- **Floors.** RD calls `config/floor_registry/list` itself on connect (RD:2300-2329) and parses `floor_id, name, aliases, level, icon` (RD:1640-1667).
  - This runs once per connection and is not polled.
- **Entity-to-area map.** `fetchRegistrySnapshot` (RD:1691-1705) calls `config/entity_registry/list` and `config/device_registry/list`, falling back to the `*_list_for_display` variants for each.
  - It **re-polls every 30 s** while connected (RD:2256-2298, `setInterval(…, 30000)` at :2289).
  - The UI shows "Registry updated HH:MM" / "Registry waiting" (RD:3113-3116).
- **Area resolution rule** (`buildEntityAreaMap`, RD:1575-1594):
  - Use the entity's own `area_id` if set.
  - Otherwise use its device's `area_id`.
  - Otherwise the entity has **no area**.
  - SMPLWISE uses the same precedence in `ha_client.registry_maps` (see §9).
- **Room list.** `haRoomTabs` is one tab per HA area (RD:2048-2056). It is merged with **local "custom rooms"** held in localStorage (RD:2058-2073).
  - A custom room has **no entities**; `activeBuckets` is empty for non-HA rooms (RD:2817-2822).
- **Floor filter** (RD:2074-2085):
  - `selectedFloorId === 'all'` shows every room.
  - Otherwise only HA areas whose `floor_id` matches are shown. Custom rooms are hidden once a floor is chosen.
  - Areas with no floor appear only under "All floors".
- **Room order.** Room tabs follow the area-registry order, not sorted. Floors follow the floor-registry order, which can be changed with `config/floor_registry/reorder` (RD:2740).

### 2.2 Entity-to-section rules (the "automatic structure")

Bucketing is by **entity-id domain only** (`bucketEntityId`, RD:1325-1364). Device class plays no part in which section an entity lands in.

| Bucket (RD:164-175) | Domains |
|---|---|
| `lights` | `light` |
| `climates` | `climate`, `humidifier` |
| `locks` | `lock` |
| `medias` | `media_player` |
| `switches` | `switch`, `input_boolean`, `fan` |
| `sensors` | `sensor`, `binary_sensor` |
| `covers` | `cover` |
| `cameras` | `camera` |
| `weathers` | `weather` |
| `others` | everything else: `scene`, `script`, `automation`, `alarm_control_panel`, `button`, `number`, `select`, `siren`, `vacuum`, `valve`, `update`, … |

Sections on the room screen and their sources (`getRoomSectionEntityIds`, RD:1384-1414; `doesEntityMatchRoomSection`, RD:948-982):

| Section id | Title (en) | Entities | Card used |
|---|---|---|---|
| `clima` | Climate | `climates` filtered to `climate.*` only. **`humidifier.*` is bucketed here but not rendered in the climate panel** (RD:2859-2865). | `RoomClimateCard`, a circular temperature dial (`ClimateControls.tsx:1204+`, `CircularTemperatureSlider.tsx`) |
| `sensors` | Sensors | `sensor.*` and `binary_sensor.*` | `SensorCard` via `WidgetCardRenderer` |
| `security` (grid area `security_cams`) | Security | `lock.*` then `camera.*` | `LockCard`, `CameraCard` |
| `lights` | Lights | `light.*` | `LightCard` |
| `switches` | Switches | `switch.*`, `input_boolean.*` → `SwitchCard`; `fan.*` → `FanCard` (RD:3708-3718) | as listed |
| `media` | Media | `media_player.*`, **sorted playing-first** (RD:3017-3030) | media card or swiper; on phones a bottom bar |
| `accessories` | Accessories | `cover.*`, `weather.*`, and `others` minus `automation.*`/`script.*` | small tiles (RD:4760-4791) |

- **Filtering facts:**
  - Room bucketing does **not** consult the registry's `hidden_by`, `disabled_by` or `entity_category`. `bucketsByAreaId` iterates `Object.keys(haStates)` and keeps any entity that has an area (RD:2803-2815).
    - `hiddenBy`/`disabledBy` are parsed (RD:1516-1526) but unused in Rooms.
    - Disabled entities have no state object, so they drop out implicitly.
    - Hidden and diagnostic/config entities (e.g. `sensor.*_rssi`, `update.*`) therefore reach the Sensors and Accessories sections.
  - The Home Attention engine is different: it **does** skip `hidden_by`/`disabled_by` (`homeAttentionEngine.ts:302-305`).
- **Entities without an area** are **never shown in Rooms** (RD:2806-2809, `if (!areaId) return;`). They are only reachable as "add" candidates in the section editor, where they are labelled "no room" (RD:3968-4010, `unassignedRoom`).
- **Per-room hide list.** A per-room hide list lives in localStorage `ha.dashboard.rooms.hiddenEntitiesByRoom.v1` (RD:78, 1276-1308, 2217-2225). It is applied as `visibleActiveBuckets` (RD:2823-2830).
  - The hide list is per browser, not shared.
- **Room header ambient line.** It uses the HA area's own `temperature_entity_id`/`humidity_entity_id` (RD:3118-3136).
  - Copy: "{t} room temperature with {h} humidity" or "No sensors".
- **Room header chips** (RD:3558-3592) show three chips only:
  - Climate, when the climate entity is on, showing current temperature.
  - Media "In riproduzione", when any player is playing.
  - Lights "N accese", counting `light.*` entities that are on.
  - The chip labels are hard-coded Italian ("Clima", "Luci", "In riproduzione").
- **Security alert reorder.** `isSecurityAlert` (RD:3376-3382) is true when:
  - any lock in the room is not locked, or
  - any cover is open, or
  - any sensor matches `isSecurityAlertEntity` (RD:711-725): `alarm_control_panel`, or device_class in {motion, occupancy, presence, problem, safety, tamper}, or a name containing Italian/English keywords, in an active state.
  - On phones this moves the Security section to the top (RD:686-690). The same mechanism moves Media to the top while something is playing.

### 2.3 Rendering facts discovered in HEAD
Several computed room features are **never rendered** in the current source:
- **Accessories area:** `renderAccessoriesArea` is defined (RD:4793-4831) but is not called anywhere (grep shows only the definition). On desktop the grid template has no `accessories` area (RD:674-679).
  - **Covers/shutters, scenes, weather and `alarm_control_panel` entities in a room therefore have no card in the room screen.**
  - One oddity: on phones, when a room has *no* accessories, the empty placeholder "No accessories configured for this room" *is* rendered (RD:5256-5270).
- **Values computed but not referenced after RD:3400** (grep): the scene chooser (`sceneOptions`, RD:3248-3275), door tiles (`doorTiles`, used only for `isSecurityAlert`), the energy mini-chart (`buildEnergyBars`, RD:1465-1472, built from **synthetic** week deltas), `ambientSummaryParts` and `roomHasCards`.
- The only covers controls in Rooms are the accessory tap `cover.open_cover|close_cover` (RD:4768) and quick-card entries in the section editor (RD:5573).
  - The full `CoverCard` exists for Home widgets (`src/components/widgets/CoverCard.tsx`).

### 2.4 What the user must configure by hand
- **In HA:** areas, floors, and the area assignment of devices/entities.
  - DomusUI can also write these itself (§3.6, §3.7) if the user is Owner/Admin (`manage_rooms`, §6.1).
- **Optional per area:** icon, picture, aliases, temperature entity, humidity entity. These are written to the HA area registry (RD:2346-2360, 2465-2475).
  - The area `icon` is stored as text (placeholder `mdi:sofa`), but no renderer for it was found (UNVERIFIED).
  - The area `picture` is used by the onboarding and management lists (UNVERIFIED where else).
- **Per room, per browser:** hide or show individual entities (localStorage).
- **Nothing else.** Section membership has no YAML/JSON override; it is fixed by domain.

## 3. Screens

### 3.1 Rooms page shell and header (RD:6839-6990)
- **States:**
  - **Loading:** a `GlassLoader` with "Loading rooms" / "Syncing areas and devices" (RD:6820-6832).
  - **No rooms** (RD:6834-6856): a house icon with the title "No rooms configured". The description reads "Domus UI will only display areas that are actually available in your Home Assistant home." A hard-coded Italian footnote follows: "Crea o assegna le aree da Home Assistant…".
- **Header** (`rooms-page-header`, grid area `header`):
  - A large animated room title (framer-motion blur/slide; reduced-motion falls back to opacity; RD:6866-6883).
  - To its right, a **horizontally scrolling row of the other rooms' names** (drag-scrollable, edge-masked; RD:6884-6917). Tapping a name switches room.
  - A **floor button** (floor icon + current floor name + chevron) that opens the floor layer (RD:6918-6932).
  - The header **compacts on scroll**: it compacts at scrollTop ≥ 48 px and expands again below 32 px (RD:85-86, 2169-2174).
  - A details row holds the ambient subtitle and chips (RD:6934-6958).
- **The active room persists** in localStorage `ha.dashboard.rooms.activeRoomId.v1` (RD:77, 2226-2235).

### 3.2 Floor layer: the floor selector and whole-building entry (RD:7202-7400)
- A full-screen blurred overlay titled "Floors / Choose a level", with a "Fine" (Done) button (hard-coded Italian).
- A horizontally scrolling carousel of floor cards (snap, drag threshold 6 px, RD:103):
  1. **"All floors" card:** "Show all rooms, regardless of their assigned floor", with a large count of all rooms.
  2. **One card per HA floor.** Each shows a floor icon, "FLOOR", the name, and a room count (`roomCountByFloorId`, RD:2039-2046).
     - Icon heuristic (RD:727-784): `level<0` Warehouse, `0` House, `1` Rows2, `2` Rows3, `≥3` Building2. There are Italian keyword overrides (garage → Car, cantina → Warehouse, giardino/terrazzo → MapPinHouse, mansarda → HousePlus).
     - Short tab label (RD:626-641): level 0 → "PT", negative → "S1", positive → "P1", …
  3. **Admin only:** an "Add a floor" card with name / voice aliases / level fields, which calls `config/floor_registry/create` (RD:2623).
     - Floor cards have edit (`floor_registry/update`), delete (`floor_registry/delete`, confirmed in a GlassModal: "The floor will be removed from Home Assistant. Its rooms will not be deleted.") and move left/right (`floor_registry/reorder`) (RD:2684, 2740, 2772, 6728-6810, 7361-7399).
- **"Manage or add a room"** (admin) opens the room-management sheet (§3.6).
- **There is no whole-building dashboard.** "All floors" only widens the room-tab list. There is **no house-wide "what is on" summary and no "turn everything off" action** anywhere in the app. A repo-wide grep for all_off / allOff / turn off all / spegni tutto finds nothing, and no service call uses `target: {area_id}`. The closest house-wide views are:
  - the **Home Attention Center** (§3.8), which lists problems but not "on" devices;
  - the **Security page** (§3.9).

### 3.3 Room screen layout (the screen in the owner's screenshots)
- **Desktop** (breakpoint ≥ lg, i.e. ≥1024 px; RD:665-681) is a CSS grid with 4 columns (`minmax(16rem,1.2fr) 1fr 1fr minmax(16rem,1.2fr)`) and a 24 px gap:
  ```
  "header header          header          header"
  "clima  sensors         sensors         security_cams"
  "clima  lights_switches lights_switches security_cams"
  "clima  lights_switches lights_switches media"
  ```
  - Climate is a tall left column, about 540-600 px (RD:6964-6968).
  - Sensors are at top centre; lights and switches are stacked below them; Security is at the right with Media below it.
- **Phone / tablet** (xs/sm/md, <1024 px): a single column in the order header, clima, lights_switches, sensors, media, security_cams (RD:683-704).
  - The order changes when there is a security alert (security first) or active media (media first).
  - Sections with no devices are **removed from the grid**. Their empty-state cards are rendered **after** the grid in a separate block (`renderMobileBottomEmptySections`, RD:5160-5278).
- **Breakpoint source.** The breakpoint comes from `window.innerWidth` (RD:539-566), using `GRID_ENGINE_BREAKPOINTS` 2xl 1536 / xl 1280 / lg 1024 / md 768 / sm 640 / xs 0 (`DashboardGrid.tsx:36-43`).
- **Inner widget grids** use a 48 px row unit and a 16 px gap (`DashboardGrid.tsx:34-35`). Columns per section (RD:1049-1075):

  | Section | xs/sm | md/lg | xl/2xl |
  |---|---|---|---|
  | sensors | 2 | 4 | 6 |
  | lights / switches | 2 | 4 | 6 |
  | security | 2 | 2 | 4 |

- **Preview limits.** Each section shows at most **4** widgets (`ROOM_SECTION_PREVIEW_LIMIT`, RD:112). Sensors show 6/6/4/4/4/3 by breakpoint (RD:113-120). Accessories would show 8 (RD:121).
- **Multiple climate entities.** On phones they are a swipe carousel with dots (flick velocity 0.42 px/ms, min/max swipe 44/96 px, 280 ms animation; RD:105-109, 7090-7123). On desktop a segmented control selects among them (RD:4585-4615).

### 3.4 Section header, the `>` chevron and empty sections
- **Header** (`renderRoomSectionHeader`, RD:4619-4663):
  - The title with a **`>` chevron**, and below it "N device(s)".
  - The count is of *devices*: entities grouped by `device_id` (RD:3855-3938).
- **The chevron is a management entry, not a read-only detail page.** It is a button only when `canOpenActiveHaRoomSection`, i.e. `canManageRooms` (Owner/Admin) on an HA room while connected (RD:2843-2846, 4629-4642). For other users the title is plain text.
  - Clicking it opens the **section editor overlay** (§3.5).
- **Empty section** (`renderEmptyRoomArea`, RD:4696-4757): a card with the section title (or "Not configured") over a faint skeleton illustration, a title, a description, and (admin) an **"Add devices"** button. Copy, from `src/i18n/roomsTranslations.ts:184` (en):
  - Climate: "No climate device configured for this room" / "Assign a thermostat, heater, or air conditioner to control it here."
  - Sensors: "No sensors configured for this room" / "Temperature, humidity, and other environmental sensors will appear here."
  - Security: "No security devices configured for this room" / "Locks, cameras, and security devices assigned to the room will appear here."
  - Lights and switches: "No lights or switches configured for this room" / "Assign lights, switches, or fans to the area to control them here."
  - Media: "No media configured for this room" / "TVs, speakers, and media players assigned to this room will appear here."
  - Accessories: "No accessories configured for this room" / "Covers, scenes, weather, and secondary accessories not included in the main sections will appear here."
  - Generic: "No devices configured in {section}" / "Add entities to this room in Home Assistant to populate this section automatically."
  - When every device in a section is hidden: "1 hidden device" / "{count} hidden devices" (RD:4898-4916).
- **Languages.** They are it, en and fr only (`src/i18n/I18nProvider.tsx:12`). Many room strings remain hard-coded Italian, e.g. "Clima", "Luci", "Interruttori", "Sensori" and "Fine" (RD:3564-3590, 5175-5265, 7210).

### 3.5 Section editor overlay (reached from the chevron; admin only)
- **Built by** `renderSectionEditOverlay` (RD:5968-6300+). It shows every device of that section in the room, including hidden ones.
  - Multi-entity devices are shown as group cards with "visible/total" counts; single entities are shown as quick cards.
- **Quick cards are live controls** (RD:5512-5580):
  - `light.turn_on|turn_off`; `switch`, `input_boolean` and `fan` `turn_on|turn_off`; `media_player.media_play_pause`; `cover.open_cover|close_cover`; `scene.turn_on`.
  - Inline sliders: brightness, volume, "Posizione" (cover position) (RD:5405-5470).
  - A visibility toggle per entity edits the per-room hide list.
- **Selection model:**
  - **Long-press 460 ms** (cancelled by moving more than 10 px) or right-click enters selection mode. Taps then add targets (RD:124-125, 4191-4330).
  - A dismissible guide explains it: "Press and hold to organize…" (`RoomSectionInteractionGuide.tsx`).
- **Actions:**
  - **Add device** opens a bottom sheet with search, listing entities of matching domains that are in *other* rooms or in no room (RD:3968-4010, 5736-5960).
  - **Move** to another room, or **Remove from room**. Both call **HA registry writes** (`assignSectionTargetsToArea`, RD:4073-4167):
    - `config/device_registry/update {device_id, area_id}` for device targets, plus `config/entity_registry/update {entity_id, area_id}` for any entity with its own area override;
    - `entity_registry/update` for device-less entities;
    - `area_id: null` for remove.
  - After the write, the registry is optimistically patched and re-fetched (RD:4031-4071, 4161).
  - Failure copy: "Could not update devices in Home Assistant."

### 3.6 Room management sheet (admin)
- A full-screen sheet on phones; a `max-w-3xl` glass panel on desktop (RD:7401-7700).
- **Create room:**
  - When connected it calls `config/area_registry/create` with name plus optional `floor_id`, `icon`, `aliases`, `picture`, `temperature_entity_id` and `humidity_entity_id` (RD:2331-2420). Temperature/humidity candidates are chosen by device_class or unit (RD:799-811).
  - Offline, it saves a **browser-only custom room**: "Offline: this room will only be saved in this browser."
- **Edit area:** `config/area_registry/update` (RD:2466).
- **Delete area:** `window.confirm` (native dialog), then `config/area_registry/delete` (RD:2536-2551). Deleting a local room also uses `window.confirm` (RD:2516).

### 3.7 Onboarding organizer (first-run, admin)
- `src/components/onboarding/OnboardingOrganizer.tsx` is a 4-step wizard: floors → rooms → entities → review (:48-50).
- **Loading:** it loads the floor, area, entity and device registries with an 8 s timeout (:70, 235-248).
- **Entity list:** paged 40 at a time (:71), with rename and room assignment per entity.
- **Saving:** a sequential batch of `floor_registry/create|update`, `area_registry/create|update` and `entity_registry/update {name, area_id}`, each with a 12 s timeout and a progress bar (:350-420). On failure it reloads and shows an error.
- **Non-admin users** see a permissions notice (:425-430).

### 3.8 Home Attention Center (the closest to a house-wide status view)
- **Engine:** `src/components/homeAttention/homeAttentionEngine.ts`. It is rendered on Home (MB:11474).
- **What it emits:**
  - **critical, safety:** binary_sensor with device_class smoke, gas, CO, moisture or safety in an active state (:54-62, 325-344).
  - **warning, security:** problem or tamper (:346-354).
  - **warning, opening:** door, window, garage_door or opening **open for at least N minutes** (default 10; :359-372).
  - **warning, availability:** connectivity off (:374-387).
  - **warning, security:** lock unlocked or open (:389-397).
  - **critical, security:** lock jammed (:399-407).
  - **critical, security:** alarm triggered (:409-417).
  - **battery ≤ threshold:** default 20 %, and ≤10 % becomes a warning (:419-436).
  - **unavailable:** only for entities used on the Home layout (:438-446).
  - **configuration:** a Home widget whose entity is missing (:449-466).
- **Context and order:** each item carries device, area and duration. Items are sorted by severity, then category, then age (:468-474).
- **It lists problems, not "devices that are on", and it has no bulk action.**

### 3.9 Security page (`src/pages/SecurityDashboard.jsx`, 1,965 lines)
- **Routes:** `/security`, `/security/cameras`, `/security/sensors` (:76-78).
- **House-wide and automatic:**
  - Alarm: all `alarm_control_panel.*`, with the chosen one stored in localStorage (:971-973).
  - Sensors: binary_sensors with a security device_class {door, window, opening, motion, presence, occupancy, vibration, tamper, smoke, gas, co, co2, heat, moisture, safety, problem, lock, garage_door}, or with keyword matches. If none match, **all** binary sensors are shown (:84-126, 984-996).
  - Cameras: all `camera.*`, at most 4 on the overview (:79, 998-1004).
- **Layout:** a "Hub Sicurezza" shield (304 px ring) with a segmented arm-mode control; a camera section; a sensor list; a session-only "Log Sicurezza" (max 10 entries); an SOS button behind a danger modal (:480-583, 1688-1863, 1934-1960).
- **Empty states** (Italian only): "Nessuna telecamera `camera.*` trovata.", "Nessun sensore disponibile.", "Nessuna entità alarm_control_panel trovata" (:684, 899, 1769).

## 4. Controls, services and per-card behaviour in Rooms

Every Rooms control calls `onCallService(domain, service, data)` directly, for **one entity at a time**. Rooms does not go through MB's command coordinator.

| Control | Service call | Where |
|---|---|---|
| Light card tap | `light.turn_on` / `turn_off` | RD:4339-4385 |
| Light brightness | `light.turn_on {brightness_pct 1-100}` | RD:4393-4398 |
| Switch / input_boolean tap | `<domain>.turn_on/turn_off` | RD:4348-4385 |
| Fan toggle / speed | `fan.turn_on/turn_off`, `fan.set_percentage` (optimistic 9 s) | RD:4399-4428 |
| Humidifier | `humidifier.turn_on/off`, `set_humidity` | RD:4429-4439 |
| Climate dial | `climate.set_temperature {temperature}` or `{target_temp_low, target_temp_high}`, ± by `target_temp_step` (default 0.5), clamped to min/max | RD:7042-7078 |
| Climate power | `climate.set_hvac_mode` (`off`, or the first non-off mode) | RD:7032-7040 |
| Climate mode / fan | `climate.set_hvac_mode`, `climate.set_fan_mode` | RD:4446-4462 |
| Climate from generic widget | `set_temperature` with **`Math.round(value)`** (integer) | RD:4445-4450 |
| Media | `media_play_pause`, `media_previous_track`, `media_next_track`, `media_seek`, `shuffle_set`, `repeat_set` (off→all→one), `select_source` | RD:4463-4511 |
| Camera tap | opens `CameraViewer` (no service) | RD:4340-4343, 4837-4855 |
| Lock | `lock.lock` / `lock.unlock` (no `code`) | RD:4514-4516 |
| Lock latch | `lock.open` (no `code`) | RD:4517-4519 |
| Cover (accessory / quick card) | `cover.open_cover` / `close_cover` | RD:4768, 5573 |
| Scene | `scene.turn_on` | RD:3338, 4764, 5577 |

- **Optimistic UI in Rooms.** A local override map sets `isOn`/brightness immediately with a **5 s TTL** (`ROOM_LIGHT_OPTIMISTIC_TTL_MS`, RD:122).
  - The override is dropped when HA confirms, when it expires, or when the service call returns `false` (RD:1905-1934, 4364-4385).
  - Slider drafts have a 2.5 s TTL (RD:123).
- **The Home page is different:** it uses `useDeviceCommandCoordinator` with an explicit confirmation or rollback lifecycle (§7).

## 5. Design system (facts)

### 5.1 Tokens
- **Theme classes:** tokens are CSS custom properties on `.dashboard-theme-dark` (`src/assets/index.css:1243-1297`) and `.dashboard-theme-light` (:1299-1353). The contract is in `docs/theme-system.md:19-27`.

| Token | Dark | Light |
|---|---|---|
| `--ui-bg-canvas` | #000000 | #f2f2f7 |
| `--ui-bg-elevated` | #1c1c1e | #ffffff |
| `--ui-surface-primary/secondary/tertiary` | rgb(44 44 46/.88) / rgb(58 58 60/.62) / rgb(72 72 74/.48) | white .94 / .76 / .58 |
| `--ui-surface-glass` | rgb(28 28 30/.72) | white .72 |
| `--ui-text-primary` | #f5f5f7 | #1c1c1e |
| `--ui-text-secondary/tertiary` | rgb(235 235 245) .72 / .56 | #4c4c50 / #6e6e73 |
| `--ui-border` | white .13 | rgb(60 60 67/.18) |
| `--ui-accent` | #0a84ff | #007aff |
| `--ui-success` / `warning` / `danger` / `info` | #30d158 / #ff9f0a / #ff453a / #64d2ff | #248a3d / #c93400 / #d70015 / #0071a4 |
| `--ui-focus-ring` | rgb(100 210 255/.62) | rgb(0 122 255/.5) |

- **Palette origin:** the palette is Apple system colours (iOS dark/light).
- **Per-card accents** are hard-coded RGB, not tokens:
  - light `61 90 254` (`LightCard.css:3`)
  - switch `52 199 89` (`SwitchCard.css:2`)
  - lock tones: secure `158 230 197`, open `239 186 121`, warning `244 113 143`, transition `147 211 244`, offline `164 174 190` (`LockCard.css:2-68`)
  - alarm tones are Tailwind families: rose, emerald, blue, indigo, amber, cyan (`AlarmCardView.tsx:68-101`)
- **Room section chips:**
  - The icon colours are Apple system colours: orange `#FF9F0A` (Climate), blue `#0A84FF` (Media), yellow `#FFD60A` (Lights) (RD:3565-3589).
  - In the section editor, an "on" light is shown on an amber/brown fill and an "on" switch on emerald (RD:5690-5720).
- **Typography:**
  - The HA panel uses **only the system font stack** (`-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto…`, `index.css:8-11`). The Geist fonts are only for the marketing site (`src/components/site/fonts.ts`).
  - A type scale `--ui-fs-2xs…3xl` exists: 11/12/13/15/17/21/28/36 px (`index.css:1219-1234`). It has **zero consumers**; .tsx files use arbitrary sizes such as `text-[11px]` (210×) and `text-[10px]` (201×).
  - The page title is 2rem/700, then 2.65rem (≥640), then 3rem (≥1024) (`index.css:632-652`).
  - Room section titles are `text-sm font-semibold`, with the count at `0.72rem` (RD:4637-4641).
- **Radii:** they are not tokenised; `rounded-full` appears 688 times.
  - Room surfaces use `rooms-surface`, which is UNVERIFIED in detail.
  - Other radii: empty-state inner panel `1.25rem` (RD:4730), section-editor cards `1.35-1.5rem`, sheets/panels `2rem`, light card `1rem` (`LightCard.css:33`).
- **Glass:** the "liquid glass" material is a gradient over `rgb(base/opacity)` with `backdrop-filter: blur(28px) saturate(1.72)` and a `0 22px 60px` shadow (`index.css:92-151`).
  - Variants: panel blur 34 px `rounded-[2rem]`, navigation 26 px, control 18 px pill, sheet 36 px (:155-345).
  - Nested glass disables blur (:384-389).
  - `prefers-reduced-transparency`, or no `backdrop-filter` support, switches to opaque surfaces (:1395-1425).
  - `prefers-contrast: more` raises opacities (:1361-1393).
- **Spacing:** Tailwind defaults. Grid row 48 px, gap 16 px. Page padding 1rem → 1.5rem (≥640) → 2.5rem (≥1024), with bottom padding `safe-area + 6.25rem` for the phone bottom bar (`index.css:597-617`).

### 5.2 Light/dark
- **Theme settings:** `appearanceMode` is auto, light or dark. It is independent of `background`: neutral, home-hub, ocean-mist, sunset-amber or forest-glass wallpapers (`src/theme/dashboardTheme.ts:1-10`).
  - Both are stored per device in localStorage `ha.dashboard.theme` and `ha.dashboard.background` (`useProfileSettings.ts:50-74, 187-224`).
- **`auto`** follows `prefers-color-scheme`. **It does not follow the HA theme:** the bridge never sends `hass.themes` (bridge doc:260-318).
- **Boot colours** are set before JS runs (`index.css:1203, 1236-1240`).

### 5.3 RTL
- **RTL is absent.**
  - There is no `dir`, `rtl`, Hebrew or Arabic anywhere in `src`. Locales are `['it','en','fr']` (`I18nProvider.tsx:12`), and `index.html:2` hard-codes `<html lang="it">`.
- **Physical-direction utilities are hard-coded.** Physical-direction Tailwind classes (`ml-/mr-/pl-/pr-/left-/right-`) appear 237 times; logical ones appear 4 times. Examples:
  - The mobile drawer is fixed on the left (`MobileSidebarDrawer.tsx:207-208`).
  - Switch thumbs move with `translate-x` (`index.css:454`).
  - The lock slider measures `clientX` left to right (`LockCardView.tsx:73-109`).
  - Room swipers compute `scrollLeft` (RD:441-512).
  - Masks use `linear-gradient(90deg…)` (RD:2153-2167).

### 5.4 Responsiveness and phone layout
- **Shell:**
  - The left sidebar shows only at ≥768 px (MB:11267).
  - Below 768 px there is a top bar plus a slide-in drawer (`MobileSidebarDrawer`, width `min(84vw,21rem)`).
  - Below 640 px a **bottom tab bar** appears with Home, Rooms, Security, Consumption and Settings (`BottomBarNav.tsx:44-113`, `dashboardNavigation.ts:28`). It uses a glass pill with `min-h-11` (44 px) targets and 9.5 px labels.
- **Rooms on phones:**
  - one column;
  - swipe carousels for multiple climates and players;
  - a **floating media mini-player** above the bottom bar when something is playing (RD:5280-5370, `bottom: safe-area + 4.9rem`);
  - compact climate controls (RD:3384-3387).
- **Sheets and modals:** `GlassBottomSheet` is a bottom sheet on phones and a centred `max-w-md` dialog from `sm` up (`GlassBottomSheet.tsx:37-70`). `GlassModal` goes full screen below `md`.
- **Cards** adapt through CSS container queries (`container-type: size`). 14 card CSS files use them, for example the light card thresholds 132×44 / 170×104 / 320×104 (`LightCard.css:310-674`).
  - Four overlapping size vocabularies exist: `CardDensity`, `CardVariant`, `WidgetDisplayVariant` and `CardLayoutVariant` (`useCardSize.ts:8`, `cardVariant.ts:5-25`, `widgetDisplayVariant.ts:17`, `cardCapabilityRegistry.ts:6`).

### 5.5 Iconography and card anatomy
- **Icons:** `lucide-react` is used in 119 files. `@mdi/js` is used for exactly one icon (`ScenesCard.tsx:2`).
  - **HA `icon` attributes (`mdi:*`) are never rendered.**
  - Domain icons are hard-coded lucide maps (`SettingsEntitiesList.tsx:46-66`). In Rooms: light Lightbulb, switch Tv, media Speaker, cover ChevronRight, weather Leaf, fallback Layers (RD:2940-2948, 3296-3309).
- **Card header** (`DeviceControlCardHeader.tsx:20-63`) is a 3-column grid:
  1. an icon toggle button (`aria-pressed`, 2.15 rem ≈ 34 px);
  2. a title/status button that opens details (title `clamp(.76rem,5cqi,.92rem)`);
  3. an optional secondary button.

### 5.6 Camera still in a room card
- **Still URL** (`cameraCardModel.ts:111-116`): the first match of the live `imageUrl` (from `entity_picture`, resolved and origin-allowlisted in `haLive.ts:400-411`), then `entity_picture`, then `camera_url`, then `/api/camera_proxy/<entity_id>`.
  - DomusUI appends no token itself. It relies on the tokenised `entity_picture` that HA puts in the state, and on the same-origin session.
  - The fallback's behaviour without a token is UNVERIFIED.
- **"Live" is MJPEG** (`/api/camera_proxy_stream/<entity_id>` in an `<img>`, `cameraCardModel.ts:117`, `CameraCardView.tsx:41-116`). It falls back to the still image, then to an "image unavailable" placeholder.
  - **There is no HLS, WebRTC, go2rtc or `camera/stream` usage** anywhere in `src`.
- **Refresh:** automatic snapshot refresh is off by default (`snapshotRefreshIntervalMs` 0). The Security page uses 10 s (`SecurityDashboard.jsx:80, 891`). Refreshes are skipped while the tab is hidden (`CameraCardView.tsx:64-87`).
- **Tap** opens `CameraViewer`, a full-screen modal with:
  - prev/next, pause, refresh, snapshot download, native fullscreen;
  - a PTZ joystick when supported (`CameraViewer.tsx:103-268`).
- **PTZ support** is detected via `onvif.ptz` / `camera.onvif_ptz` / `camera.ptz` services or via sibling `button.*` entities named left/right/up/down (`mainBoardCameraModel.ts:32-295`).

### 5.7 Lock "slide to open"
- **Model** (`lockCardModel.ts:5-14`): states are locked, unlocked, locking, unlocking, opening, open, jammed, unavailable and unknown.
  - The primary action is `unlock` when locked; `lock` otherwise; `none` when transitioning, jammed or unavailable (:157-162).
- **Slider** (`LockCardView.tsx:94-198, 305-350`):
  - Pointer capture; the thumb is dragged with `translate3d`.
  - The commit threshold is **progress ≥ 0.74**, checked only on pointer-up (cancel never commits).
  - On commit the thumb snaps to the end and the action fires after **110 ms**.
  - Thumb transition `320ms cubic-bezier(0.22,1,0.36,1)` (`LockCard.css:332`); `touch-action: none` (:202).
  - The label is hard-coded Italian: "Scorri per aprire" / "Blocca".
  - **Keyboard alternative:** ArrowRight, End, Enter or Space runs the action at once, with no hold.
- **Mini toggle:** a **1000 ms press-and-hold** with a conic progress ring (`useHoldToConfirm`, `LockCard.tsx:64-75`; `useHoldToConfirm.ts:49-119`, with a 340 ms success pulse).
- **Lock direction** (to `lock`) is a plain one-tap button.
- **Open latch** is a separate one-tap button, shown only when `supported_features & 1` (`lockCardModel.ts:43, 149`; `LockCardView.tsx:365-381`).
- **Reduced motion** removes the animations (`LockCard.css:899-912`).

## 6. Actions and safety

### 6.1 Roles
- **Capabilities** (`src/security/dashboardAccess.tsx:8-16`): `edit_dashboard`, `manage_rooms`, `manage_security_config`, backup/restore/reset, developer mode, and `restart_home_assistant`.
- In real mode, **every capability requires HA `is_owner` or `is_admin`** (:94-115). The flags come from `auth/current_user`, which is re-validated every 15 s (`useHaIdentityRevalidation.ts:58`; roadmap line 157).
  - There is only an admin/non-admin split; there are no finer roles.
- **Registry writes** (`config/area|floor|device|entity_registry/*`, `frontend/set_system_data`) are blocked client-side without `manage_rooms` (:56-71; MB:1762-1767).
- **Device control is not capability-gated** in DomusUI, including locks and the alarm. Final authority is HA's own per-user service authorization (`docs/security-and-privacy.md`).

### 6.2 One-tap vs guarded

| Action | In Rooms | On Home / Security |
|---|---|---|
| Light, switch, fan, humidifier, media, climate, scene, cover open/close | one tap | one tap (via command coordinator) |
| Lock (to locked) | one tap | one tap |
| Unlock | card requires **hold 1 s** (mini toggle) or **slide ≥74 %** (slider). Keyboard is one keypress. **Rooms then calls `lock.unlock` directly with no code or WebAuthn gate** (RD:4514-4516) | same card gesture, then MB `toggleLockDoor` → if `lockRequireAuthToUnlock` or a stored code: WebAuthn (local presence, no server verification) then a PIN pad checked **in the browser** against the stored code (MB:8253-8353, 8694-8729) |
| Open latch | one tap, `lock.open`, no gate (RD:4517-4519) | same gate as unlock when configured (MB:8365-8374) |
| Alarm arm | not in Rooms (not rendered) | one tap unless `code_arm_required` (PIN) (`alarmSecurityPolicy.ts:64-108`) |
| Alarm disarm / trigger | not in Rooms | PIN when the entity uses a code or a local extra PIN is set; optional WebAuthn (`alarmRequireAuthToDisarm`) |
| SOS | — | danger modal "Attivare SOS emergenza?" (`SecurityDashboard.jsx:1934-1960`) |
| Area/floor delete | native `window.confirm` / GlassModal | — |
| "Everything off" | **does not exist** | **does not exist** |

- **Browser-side safeguards:**
  - Rate limit: 3 failures → 30 s lockout; 5 failures → 5 min lockout (window 10 min).
  - Audit log in localStorage (`securityAuth.ts:23-165`).
  - WebAuthn returns `Boolean(credential)` without verifying any assertion signature (`useDeviceAuth.ts:230`).
  - The docs list these as known client-side limitations (`docs/security-and-privacy.md`).
- **Lock `code_format` is not read** in the lock path. Numeric mode is inferred from the stored code (MB:8279).

## 7. Data flow and performance

- **State delivery, bridge (production).**
  - On every `hass` set, the parent diffs `hass.states` by object reference.
  - If more than 120 entities changed, it posts a full snapshot; otherwise it posts one message per entity (bridge doc:329-362).
  - The SPA merges each message into React state with no throttle (`useHaPanelBridgeConnection.ts:449-506`).
  - A cap of 20,000 entities applies (:94).
  - Heartbeat: a sync request every 10 s; the connection is "reconnecting" after 20 s of silence and "offline" after 40 s. Commands are blocked unless connected (:88-90, 415, 670-688).
- **State delivery, standalone.** `subscribeEntities` with 250 ms coalescing, publishing only changed entities (`useHaLiveConnection.ts:46-48, 151-213`).
  - A watchdog ping (8 s timeout, 15 s interval) runs; reconnecting becomes offline after 12 s (`haConnectionState.ts:17-19`).
- **Mapping.** `mapHassEntitiesToMock` converts each HA state into a UI model (`MockEntityState`, `src/services/haLive.ts:636-884`; `src/types/ha.ts:166-264`).
- **Registries** are pulled, not subscribed:
  - No `*_registry_updated` event subscription exists.
  - Rooms polls entity+device registries every 30 s; floors load once.
  - The Attention engine and MB load the registries separately (MB:5254-5294). Label registry is `config/label_registry/list` (MB:5287); **labels are not used in Rooms**.
- **Scale:**
  - **No list virtualization** in the app (no react-window, virtuoso, etc.).
  - `React.memo` in 3 files.
  - All room computations are `useMemo`s over the whole `haStates` map. For example, `bucketsByAreaId` re-runs on any state change (RD:2803-2815).
  - Section previews cap rendering at 4-6 cards; the onboarding entity list pages 40 at a time.
  - Behaviour with thousands of entities is UNVERIFIED (no benchmark in repo).
- **Command lifecycle (Home, not Rooms).** `useDeviceCommandCoordinator`:
  - Phases: sending → awaiting_confirmation → confirmed, or rollback. Rollback reasons: rejected, error, confirmation timeout, connection lost, superseded, cancelled.
  - Default confirmation timeout 8 s. A new command supersedes the previous one with the same key. All commands are cancelled on connection loss (`useDeviceCommandCoordinator.ts:4-258`).
  - Per-domain timeouts:

    | Command | Timeout |
    |---|---|
    | Light toggle | 5 s |
    | Brightness | 6 s |
    | Climate | 15 s |
    | Cover | 7 s |
    | Lock | 7 s |
    | Alarm | 10 s |
    | Media | 8 s |
    | Vacuum | 12 s |

  - Brightness debounce 120 ms; climate send delay 320 ms with patch-merging (`mainboard/*` files; MB:534-535).

## 8. Configuration format and storage

- **No YAML.** Configuration lives in three places:
  1. **The HA registries**, which hold areas, floors, entity/device area assignment, area icon/picture/aliases, and temperature/humidity entities.
  2. **HA `frontend/set_system_data`** holds a shared, revisioned "house" document (`premium-home.shared-house.v1`, `dashboardConfigurationRepository.ts:25-72`):
     - The save uses optimistic concurrency: the revision must be expected+1, with preflight conflict detection and verify-reads at 0/150/400/900 ms (`haDashboardConfigurationRepository.ts:500-625`).
     - Only Owner/Admin can save.
     - Shape (abridged):
       ```jsonc
       { "schema":"premium-home-house-configuration","version":1,"revision":7,
         "updatedByUserId":"<ha user>",
         "dashboard":{"sections":[…],"widgets":[{"kind":"light","entityId":"light.x","layout":{…}}],
                      "widgetTypeLayoutOverrides":{…},"responsiveLayouts":{"root":{"xl":[…]}}},
         "security":{"alarmEntityId":null,"visibleSensorEntityIds":null,"visibleCameraEntityIds":null},
         "rooms":{"customRooms":[…],"hiddenEntitiesByRoom":{"<area_id>":["light.x"]}} }
       ```
     - The `rooms` block exists in the schema, but RD reads and writes localStorage instead. No writer of `rooms` in the shared document was found (UNVERIFIED, `useHaDashboardLayoutPersistence.ts:604-605, 729-732`).
  3. **Browser localStorage** holds:
     - rooms: custom rooms, active room, hidden entities (RD:76-78);
     - theme and background;
     - security selections;
     - a layout cache;
     - lock/alarm codes, only when the user chose "remember" (`widgetSecrets.ts:5`);
     - the WebAuthn credential id.
- **The only per-area override** in Rooms is the hidden-entity list. There is no per-area ordering, renaming, section reassignment or card-type override. Renaming and moving are done in the HA registry.
- **The `domusos` integration itself** registers WS commands and services only for irrigation (`irrigation/api.py:209-279`) and a calendar entity (`calendar.py:38-47`). Dashboard configuration goes through core `frontend/*_system_data`.

## 9. Mapping to SmplWise Arx (portability facts)

### 9.1 Existing SMPLWISE pieces this touches (from the SMPLWISE repo)
- **HA sync.** `smplwise_vms/backend/smplwise/services/ha_sync.py` already:
  - subscribes to `state_changed`;
  - refreshes the entity, device, area and floor registries every 600 s (`REGISTRY_REFRESH_S`, :25, :331-354);
  - stores per entity `area_id`, `area_name`, `ha_floor_id`, `ha_floor_name`, `entity_category`, `disabled` and `hidden` (`apply_registry`, :132-152).
- **Area resolution.** `ha_client.registry_maps` (`ha_client.py:153-179`) uses the same entity-area → device-area precedence as DomusUI RD:1575-1594.
- **HA writes.** Writes go through the signed bridge with an allow-listed `ACTIONS` table and risk classes `routine` / `attention` (confirmation) / `sensitive` (separate grant + confirmation), in `services/ha_bridge.py:76-133`:
  - `lock.unlock` requires grant `door.unlock`.
  - `alarm_disarm` requires `alarm.disarm`.
  - `cover.*`, `scene.turn_on`, `script.turn_on`, `button.press`, `siren.turn_on` and alarm arming are `attention`.
  - Lights, switches, fans, input_boolean, climate, media play/pause/stop/volume and `lock.lock` are `routine`.
  - HA re-issues each call with the acting user's `Context`.
- **Actions DomusUI Rooms uses that are not in the SMPLWISE allowlist today:** `climate.set_fan_mode`, target-range `set_temperature`, `media_play_pause`, `media_next_track`/`previous_track`/`seek`, `shuffle_set`/`repeat_set`/`select_source`, `fan.set_percentage` (SMPLWISE has `fan.turn_on{percentage}`), `humidifier.*`, `cover.set_cover_position` and `lock.open`.
- **RBAC** is VMS-local, scoped installation ⊇ site ⊇ building ⊇ floor, with custom roles (`rbac.py:1-52`). DomusUI has only HA owner/admin vs everyone else.
- **Frontend:**
  - The frontend is Lit/TS with `<html lang="he" dir="rtl">` (`frontend/index.html:2`).
  - Design tokens v3 are in `frontend/src/styles/tokens.css`: a light-only `color-scheme`, `--sw-*` tokens, accent `#2f6bff`, compact 12 px UI.
  - Plan Studio floors and rooms/zones are polygons, with entities anchored on the plan (T025) and a HA entity catalogue import (T023). These are per the task brief; their file-level details are not re-extracted here.

### 9.2 Ideas that port to our own Lit components (no Lovelace or HA-frontend internals needed)

| DomusUI idea | Depends only on | Note |
|---|---|---|
| Domain → section bucketing table (§2.2) | entity_id domain | SMPLWISE already has domain, area and floor per entity in `ha_entities` |
| Entity → device → area precedence | registries | already implemented in `registry_maps` |
| "No area → not shown" rule | registries | a policy choice (Q4) |
| Group entities by `device_id` for counts and "device" cards | device registry | `device_id` already stored |
| Floor carousel with "All floors" card and room counts | floor + area registry (or Plan Studio floors) | the level→icon heuristic is Italian-keyword based |
| Room header: area temperature/humidity entities, status chips | area registry fields `temperature_entity_id` / `humidity_entity_id` | SMPLWISE does not store these two area fields today (UNVERIFIED; `registry_maps` does not copy them) |
| Security-alert reorder (open lock, open cover, motion) | states + device_class | |
| Empty-section cards with an "add devices" affordance | UI only | copy is in §3.4 |
| Optimistic toggle with 5 s TTL + rollback on failure | UI + service result | SMPLWISE bridge already returns `expect` states |
| Hold-to-confirm 1 s; slide threshold 0.74 with pointer capture; 110 ms commit delay | Pointer Events | must be mirrored for RTL (drag right-to-left) |
| Camera still from tokenised `entity_picture`, MJPEG `camera_proxy_stream` | HA HTTP camera proxy | SMPLWISE already has go2rtc/MSE/WebRTC and NVR snapshots, a richer path than DomusUI's |
| Home Attention rules (smoke/CO/moisture critical; opening >10 min; lock unlocked/jammed; battery ≤20 %) | states + device_class + registry hidden/disabled | |
| Section editor: move device between rooms via `device_registry/update` | HA registry **writes** | a HA configuration write; under SMPLWISE rules this needs owner approval and a bridge action (Q7) |

### 9.3 Parts that depend on HA-frontend internals or on DomusUI's own host (not reusable as-is)
- **The panel host.** The `ha-dashboard-builder-panel` web component receives HA's `hass` object as a custom panel (bridge doc). SMPLWISE is an add-on served through Ingress, with its own backend WS, and does not receive `hass`. State must come from SMPLWISE's own `ha_sync`, and commands from the signed bridge.
- **Direct `callService` / `callWS` from the browser as the logged-in HA user.** DomusUI relies on HA authorizing each call as that user. SMPLWISE achieves the same via the bridge's `Context(user_id)`.
- **HA-user-scoped storage.** `frontend/set_system_data` and `frontend/set_user_data` are HA frontend storage keys; SMPLWISE has its own SQLite.
- **HA's `is_owner`/`is_admin` as the only role source.** This differs from SMPLWISE RBAC.
- **React/Tailwind implementation:** the TSX, CSS classes and framer-motion. Only the behaviour is portable, and the code is GPL (§0).
- **None of the Rooms features use Lovelace or HA's own card elements.** No `hui-*` or `ha-*` element and no `ha-icon` is used anywhere, so there is no Lovelace dependency to replace.

## 10. Capability table

| Section | HA domains / device classes | Actions (service) | Guarded in DomusUI? | SMPLWISE bridge risk today |
|---|---|---|---|---|
| Climate | `climate.*` (`humidifier.*` bucketed but not shown) | `set_temperature` (single or low/high), `set_hvac_mode` (incl. off), `set_fan_mode` | no | set_temperature / set_hvac_mode routine; fan_mode and range absent |
| Sensors | `sensor.*`, `binary_sensor.*` (any device_class, incl. diagnostics) | none (display) | — | — |
| Lights | `light.*` | `turn_on`/`turn_off`, `turn_on{brightness_pct}` | no (one tap) | routine |
| Switches | `switch.*`, `input_boolean.*`, `fan.*` | `turn_on`/`turn_off`, `fan.set_percentage` | no | routine (fan.set_percentage absent) |
| Security (locks) | `lock.*` | `lock`, `unlock`, `open` | unlock: 1 s hold or 74 % slide gesture only (no code in Rooms); open: none | lock routine; unlock sensitive + `door.unlock`; open absent |
| Security (cameras) | `camera.*` | none (still + MJPEG viewer, PTZ via onvif/button) | — | camera via SMPLWISE video path |
| Media | `media_player.*` | `media_play_pause`, next/prev, seek, shuffle, repeat, source | no | only play/pause/stop/volume_set as separate actions |
| Accessories (not rendered in HEAD) | `cover.*`, `scene.*`, `weather.*`, `alarm_control_panel.*`, other domains | `cover.open/close_cover`, `scene.turn_on` | no | cover and scene: attention (confirm) |
| Alarm (Security page / Home only) | `alarm_control_panel.*` | arm_home/away/night/vacation/custom_bypass, disarm, trigger | PIN per `code_arm_required` / code; optional WebAuthn | arm attention; disarm sensitive + `alarm.disarm` |
| House-wide "everything off" | — | **not implemented** | — | no bulk action exists |
| Attention (Home) | binary_sensor smoke/gas/CO/moisture/safety/problem/tamper/door/window/connectivity; lock; alarm; battery sensors | none (list) | — | — |

## 11. Open questions for the owner

1. **License (GPL-3.0).** How may DomusUI be used?
   - (a) ideas and behaviour only, written fresh in Lit;
   - (b) allow copying specific small assets or copy strings, accepting the GPL consequences;
   - (c) ask counsel first.
2. **Source of the floor/area tree.** Where should floors and areas come from?
   - (a) HA's floor and area registry, as DomusUI does;
   - (b) Plan Studio floors and rooms/zones only;
   - (c) both, with Plan Studio as primary and HA areas mapped onto Plan Studio rooms.
3. **Entity membership in a room.** How should an entity be assigned to a room?
   - (a) by HA area only (entity area, else device area);
   - (b) by the entity's anchor position inside a Plan Studio room polygon (T025);
   - (c) HA area first, with the Plan Studio anchor overriding when they disagree.
4. **Entities without an area.** DomusUI hides them from Rooms. What should we do?
   - (a) hide them, as DomusUI does;
   - (b) show them in an "Unassigned" pseudo-room on the building view;
   - (c) show them in an "Unassigned" list inside each floor.
5. **Hidden, diagnostic and config entities.** DomusUI shows them in Sensors. What should we do?
   - (a) exclude `hidden`, `entity_category` diagnostic/config and `disabled` entities;
   - (b) exclude only disabled and hidden;
   - (c) show everything, with a per-room hide list like DomusUI's.
6. **Where a per-room hide list lives, if we keep one.**
   - (a) per browser (DomusUI);
   - (b) per user on the server;
   - (c) shared for the whole installation (admin sets it).
7. **Moving devices between rooms from our UI.** DomusUI writes the HA registry. Should we?
   - (a) never; the tab is read-only for structure;
   - (b) yes, via a new owner-approved bridge action, admin only;
   - (c) only in SMPLWISE's own room model (Plan Studio), never in HA.
8. **"Turn everything off" (building, floor or room).** How guarded should it be?
   - (a) one tap;
   - (b) one tap and then a confirmation sheet listing what will turn off;
   - (c) hold-to-confirm, plus a confirmation listing the devices.
9. **Which domains count as "everything" for all-off?**
   - (a) lights only;
   - (b) lights, switches and fans;
   - (c) lights, switches, fans, media and climate (set to off), with locks, covers and alarm never included.
10. **Unlock UX inside a room.** DomusUI Rooms relies on the gesture alone.
    - (a) slide-to-open gesture plus the existing `door.unlock` grant;
    - (b) gesture, then a confirmation dialog;
    - (c) gesture plus a re-authentication step.
11. **Covers/shutters.** They are bucketed but not rendered in DomusUI HEAD. How should we show them?
    - (a) as their own "Covers / תריסים" section with open/stop/close and position;
    - (b) inside "Switches";
    - (c) only in the device-detail sheet.
12. **Alarm in the room screen.** DomusUI shows the alarm only on Security and Home.
    - (a) leave it out of rooms;
    - (b) show it in the room of its HA area;
    - (c) show it only on the building view.
13. **Climate actions beyond the current allowlist.** Target range, fan mode and humidifier are outside it.
    - (a) add them as `routine` actions;
    - (b) add them as `attention`;
    - (c) postpone them.
14. **Camera tile in the Security card.**
    - (a) a still refreshed every N seconds from the SMPLWISE snapshot path;
    - (b) HA `entity_picture` like DomusUI;
    - (c) live sub-stream via go2rtc when the card is visible.
15. **Theme.** DomusUI is dark-first glass, while SMPLWISE is light/blue UniFi-style.
    - (a) keep SMPLWISE tokens and take only the layout;
    - (b) add a dark variant for this tab;
    - (c) add a separate "glass" theme.
16. **Section chevron `>`.** In DomusUI it opens an admin editor.
    - (a) the same for us (admin editor);
    - (b) a read-only "all devices in this section" page for everyone, with editing for admins;
    - (c) no chevron.
