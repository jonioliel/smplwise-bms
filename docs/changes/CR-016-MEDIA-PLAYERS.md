# CR-016 — Multimedia phase 2: players, speakers, groups ("מולטימדיה · נגנים ורמקולים · קבוצות")

**Status:** DECISIONS ADOPTED (owner answers 2026-10-01, §0); mockup delivered for review
(`docs/design/mockups/media/players-index.html`, evidence in `docs/evidence/media-players-mockup/`). Nothing implemented.
Implementation starts when the owner approves the mockup. **Release:** 0.1.150 (task T099). **Phase 2b** (the direct Music
Assistant connection: full queue and library search) is designed in §17 for 0.1.152.
**Contract and work plan:** `docs/architecture/MEDIA_PLAYERS_API.md`. **Builds on:** CR-015
(`docs/changes/CR-015-MEDIA-SCREENS.md`, `docs/architecture/MEDIA_API.md`, shipped in the integration branch `integ/0.1.149`;
"CR-015 §n" below). **Research:** `docs/research/MUSIC_ASSISTANT_API_NOTES.md` ("MA notes"; §8 is the players update).
No device was contacted for this document; the facts about the owner's systems come from three read-only probes of
2026-10-01 - `docs/research/HOFFNUNG_MEDIA_PROBE_2026-10-01.md` (system-H), `HAVLIN_MEDIA_PROBE_2026-10-01.md` (system-V)
and `KANTEROVITCH_MEDIA_PROBE_2026-10-01.md` (system-K, **no Music Assistant at all**) - reconciled in §15.

## 0. Owner decisions (2026-10-01) and what they change

Answers to `docs/design/mockups/media/players-decisions-HE.md`. Every recommendation of the proposal was adopted except 4 and 7.

| # | Question | Answer | Effect in this CR |
|---|---|---|---|
| 1 | Connection to Music Assistant | **ג** - through the system infrastructure (HA) only in 0.1.150; a direct MA connection as a **separate later step** | §4: option A now; option B is **phase 2b**, its own decision and release |
| 2 | Which kinds appear | **א** - speakers, players **and** receivers, each after administrator approval in settings | §5.1, §7.4: approval per device, "אשר את כל הנגנים שזוהו" |
| 3 | Grouping | **א** - live join / unjoin in the drawer (tick rooms) **and** saved groups in "קבוצות", started with one tap | §5.3, §6.2, §7.3 |
| 4 | Queue and library depth | **ג** - full queue with drag / delete + full library | **Inconsistent with 1ג**: 4ג needs the direct MA connection (1ב), which the owner deferred. Recorded, not resolved: 0.1.150 ships the HA-only depth (now + next + count, favourites / stations / playlists, no search); the UI and data model are built so the full queue and library **drop in at phase 2b** with the direct connection (§4.4). No new question is asked. |
| 5 | Favourites and radio | **א** - from MA; an administrator orders and hides them in settings; the same list for everyone | §7.4, §9 (`multimedia.favourites`); no per-device or per-person lists |
| 6 | Announcements | **א** - not in 0.1.150 | removed everywhere: no `announce` command, no `media.announce`, no presets, no `announce_ok`, no bridge service |
| 7 | Permissions and volume safety | **ב** - like א **without** the default ceiling: only what an administrator sets per speaker; keep `media.group`, the 4+ rooms / more than one floor confirmation and "whole building = administrator" | §8, §10.1: `volume_max` stays NULL unless set; the ceiling (and an optional night window) is set per speaker in settings |
| 7+ | "Wherever an option to set volume exists, all multimedia options need a dedicated tab in Settings" | settings tab "מולטימדיה" (shipped in 0.1.149 as הגדרות › מולטימדיה) gains sections: screens (existing), players & speakers, groups, favourites / radio, connection, permissions | §7.4 |
| 8 | What is installed | **read-only inspection allowed** - three systems probed the same day | §15: two systems run MA add-on 2.10.4 + the HA integration (11 / 13 players), one runs **no MA** (Sonos x6 + Jellyfin); the ladder needs id-, model- and name-rungs; the music layer is a **capability** (MA or Sonos or HEOS), not an MA role; HA-only is a first-class path |

## 1. Goal and the one-line answer

The owner wants phase 2 to cost about what the TV phase cost. It can, because 0.1.150 reuses the CR-015 model and command
path unchanged and talks to every music player **through Home Assistant only** (§4): the MA-created entities where Music
Assistant (MA) exists, the native rich entities (Sonos, HEOS) where it does not. Everything a speaker card needs (now
playing with artwork, transport, volume, grouping, favourites, stations, "up next") is reachable through those entities
and the MA integration's actions. One of the owner's three systems has **no MA** (§15), so the HA-only path is not a
fallback but the product. The direct MA connection (full queue list and editing, full library, MA group volume) is
**phase 2b**: a separate later step on the owner's word (decision 1ג), prepared for but not built here.

## 2. Scope

| In 0.1.150 (adopted) | Phase 2b (direct MA connection; separate decision and release) | Not planned |
|---|---|---|
| Kinds `speaker`, `player`, `receiver`, `group` rendered as first-class cards after approval (2א); tabs "נגנים ורמקולים" and "קבוצות" become real | Direct MA client from the add-on: **full queue** (list, drag to reorder, delete, clear), MA `group_volume`, `can_group_with`, sleep timer | MA configuration of any kind (`config/*`, providers, users, tokens), DSP, library writes |
| Now playing with artwork (title, artist, album, progress), transport incl. seek, shuffle, repeat | **Full library** browse and search (`media.browse`) - the owner's 4ג | The browser "this device" player (Sendspin), lyrics, AI radio, artwork-driven lights |
| Volume per player; **group volume** as a per-member fan-out with a per-room outcome | MA group player creation (sync / universal groups are created in MA itself) | Announcements of any kind (6א) |
| "Up next": current + next item and the queue length (HA `get_queue`) | Per-person favourites (MA 2.11) | Schedules / alarms of music (CR-014 has its own path) |
| Start a **favourite**, a **station** or a **playlist** (HA `get_library` + `play_media`); "העבר את המוזיקה לכאן" (`transfer_queue`) | | Anything named Home Assistant or Music Assistant on operator screens (owner rule: "תשתית המערכת"; the settings tab keeps exact technical names) |
| Live groups (join / leave by ticking rooms) and **saved groups** ("סלון + מטבח", one tap) (3א); static MA groups as group cards | | |
| Receiver cards (power, volume, source, sound mode) - the receiver CR-015 links to a screen also lives here | | |
| Floor "עצור מוזיקה" (pause every playing player of a floor, confirmed) | | |
| Favourites / stations / playlists curated by an administrator in settings, the same list for everyone (5א) | | |
| Per-speaker volume ceiling **without a default** and an optional night window, set in settings (7ב) | | |

## 3. What reuses CR-015 unchanged, and what is new

| Area | Reused as is | New in CR-016 |
|---|---|---|
| Model | `media_devices`, `media_device_endpoints`, `media_link_rules`, the dedupe ladder rungs 1-6 incl. the MA loop (rung 2), MAC/identifier rungs, the two-same-platform guard, tombstones, approval, `kind_source` manual override, `volume_max` | kind detection for audio (§5.1), primaries for audio kinds (§5.2), group resolution (§5.3), `caps`/`live` audio fields, `volume_night_json` (§9) |
| Dedupe of MA / Cast / DLNA / AirPlay duplicates | rung 2 (MA export/import exact), rung 1 (same HA device), rungs 3-4 (MAC, identifiers), hidden duplicate roles | the MA endpoint of a **speaker** is kept as the `music` primary even though it stays hidden in lists (§5.2) |
| Commands | `POST /multimedia/devices/{key}/commands`, `client_request_id` + `expires_at`, idempotency, `ha_bridge.validate_action`, signed bridge with the caller's HA context, `ha_actions` confirmation poll, audit rows, `accepted`/`sent`/`refused`, "not confirmed" after 8 s, rate limits | commands `seek`, `shuffle`, `repeat`, `play_item`, `transfer` (§6.1); group routes (§6.2); bridge 0.5.0 allow-list + `media_policy` additions; one bridge **read** service `media_query` (§4.3) |
| Permissions | `media.read`, `media.control`, `media.power`, `media.bulk` (sensitive), `media.layout`, floor scope by anchor placement | `media.group` (§8) |
| Page, editor | the "מולטימדיה" rail entry, glass style, floor grouping, room chips, search/state filter, `registerScreenEdit` edit mode, `media_layouts` + personal override | the tab row becomes visible (three tabs); layout gains a `tab` dimension (§7.1) |
| Drawer | `sw-drawer modal` side panel / phone bottom sheet, states (loading, unavailable, off, view-only, pending, not confirmed, rate-limited) | `<media-player-panel>` content: now playing, transport, seek, shuffle/repeat, volume (+ per-room pop-out), "הבא בתור", favourites/stations/playlists, group section, transfer (§7.2) |
| Area card, home widget | library `media` type, one card per device, "שלט" opens the drawer; home widget `media` | non-screen devices render as `<media-player-card>` in the same area card, speakers next to TVs; the widget counts "מנגנים עכשיו" too |
| Bulk | `services/device_bulk.py`, preview + confirmed run, per-device outcome | kind `players_pause` (floor/area); group volume fan-out reuses the same per-device records |
| Artwork | `GET /multimedia/devices/{key}/artwork` (entity_picture proxy, content art only, ≤ 512 KB) | none - music art is already `media_content_type: music` |
| Settings | "הגדרות › מולטימדיה": approval, kinds, links, profiles, `volume_max` | sections players & speakers, saved groups, favourites / radio curation, connection status, permissions hint (§7.4) |

## 4. Connection model: through Home Assistant now (1ג), direct MA as phase 2b

### 4.1 The two options

| | A. HA only (**0.1.150**) | B. Direct MA WebSocket from the add-on (**phase 2b**) |
|---|---|---|
| Authority | one: the signed bridge with the caller's HA context, as for screens | two: HA for screens/vendor players, MA for music; our RBAC is the only gate for MA |
| Secrets | none new | an MA long-lived token (1 year, no renewal) in our secrets store; an MA `user` account with a `player_filter` created by the owner |
| Network | add-on → HA only (as today) | add-on → HA host port 8095 (MA add-on is on the host network; reachability from our container UNVERIFIED) |
| Queue | now + up next + length (`get_queue`) | full list, move/delete/clear, locked buffered rows |
| Library | three curated lists (favourites, stations, playlists), no search | browse and search |
| Group volume | per-member fan-out, balance computed by us, per-room outcome | MA `group_volume` (balance kept by MA) + per-member |
| Group candidates | offered by rule (§5.3), outcome read back | `can_group_with` exact |
| Events | HA state events (already consumed) | MA events (new client, reconnect, resync) |
| MA absent (system-K: Sonos x6, Jellyfin, no MA) | **the same code**: the music layer is the Sonos entity; favourites / stations from the native favourites list; "up next" = position + count from the entity's `queue_position` / `queue_size` (no next item); grouping through `media_player.join` on Sonos; no `transfer` | must also implement option A; phase 2b adds nothing to a house without MA |
| Effort | small: §3 reuse | + a client service, secrets, reconnect, a fake MA server for tests, a second command path and its review |

### 4.2 Adopted: A for 0.1.150, B later

(1) The CR-015 command path, its bridge policy, audit and HA-user context stay the single authority - no second security
review. (2) No new secret, no MA account, no network question, no token renewal. (3) The owner's system already runs the MA
integration with `get_queue`, `get_library`, `play_media`, `search`, `transfer_queue` and grouping on its players (inventory
2026-09-30). (4) The fallback "no MA" is the same code path. (5) It removes the biggest schedule risk. The honest cost is the
queue depth and the group-volume fidelity (§4.1); both are recovered by adding option B **next to** A in phase 2b (endpoints
`ma:<player_id>` are already reserved; rung 2 joins them exactly), not by rewriting A.

### 4.3 Reads through the bridge (`smplwise_bridge.media_query`, bridge 0.5.0)

`get_queue` and `get_library` are HA service calls with a response. They go through one new bridge read service
(the `stream_source` precedent) with a fixed allow-list, never through a generic service call:

| `query` | Calls | Arguments allowed | Returned (trimmed by the bridge) |
|---|---|---|---|
| `queue` | `music_assistant.get_queue` | `entity_id` (a `music_assistant` media_player) | `items_count`, `current_index`, `shuffle`, `repeat`, `current` and `next`: `{name, artist, album, duration}` |
| `library` | `music_assistant.get_library` | `media_type` ∈ `radio`, `playlist`, `track`, `album`, `artist`; `favorite` bool; `limit` ≤ 100; `offset`; `order_by` ∈ `name`, `last_played`, `timestamp_added` | `[{uri, media_type, name, artist?}]` |

Never returned: `stream_details`, image URLs, provider mappings, `queue_item_id` internals. The add-on caches `queue`
2 s per device and `library` 5 min per (type, favourite); a `library` item gets an opaque `item_ref` (HMAC of the uri,
kept server-side) - the browser can only start items the server itself listed.

`get_library` (and phase 2b's `search`) require the MA integration's **`config_entry_id`** (probes §4) and HA's
`return_response` call flavour. The bridge discovers the entry id itself (it runs inside HA: `hass.config_entries` for
domain `music_assistant`, the loaded entry), caches it, and never accepts one from the add-on or a browser. **Without MA**
the same `library` query answers from the native provider: `favourites` = the Sonos entity's favourites (its
`source_list`, played with `media_player.select_source`), `stations` = the radio entries of that list, `playlists` =
none; `queue` = `{count: queue_size, index: queue_position}` from the entity attributes (no current / next names beyond
what `media_*` attributes give). With neither MA nor a native provider the read answers `no_library` and the panel
shows no library tabs (§7.2). `sonos.get_queue` (a response service) is a possible later enhancement, not 0.1.150.

### 4.4 Built for phase 2b (the 4ג inconsistency, recorded)

The owner chose the full queue and full library (4ג) **and** deferred the direct connection they require (1ג). 0.1.150
therefore ships the HA-only depth, and the following is shaped now so phase 2b is an addition, not a rewrite:

- **Data model**: `UpNext` is already a queue window (`count`, `index`, `current`, `next`); phase 2b adds
  `GET /multimedia/devices/{key}/queue?offset=&limit=` returning `QueueEntry[]` with `queue_item_id` (opaque) and `locked`
  (already buffered rows), and commands `queue_move {item, to}`, `queue_delete {item}`, `queue_clear`. `LibraryItem`
  (`item_ref`, `kind`, `name`, `artist`, `glyph`, `hue`) is the same shape phase 2b's browse and search return.
- **UI**: the "הבא בתור" block is a list component with three rows today; phase 2b makes it the full, reorderable list in
  the same place. The favourites / stations / playlists tabs gain a fourth tab "ספרייה" with search; nothing moves.
- **Permissions**: `media.browse` is reserved (not created) for phase 2b; queue editing sits under `media.control`.
- **Endpoints**: `ma:<player_id>` endpoints and rung 2 exist (CR-015); phase 2b fills their `live` from MA events.

Phase 2b needs from the owner: an MA `user` account with a `player_filter`, a long-lived token placed in the secrets store,
and confirmation that port 8095 is reachable from the add-on container. Estimate in MEDIA_PLAYERS_API.md §5.2.

## 5. Model additions (pure, `services/media_model.py`)

### 5.1 Kinds

Manual kind still wins. Order: screen rules of CR-015 §3.4 first (extended: a `cast` entity without a device class
whose manufacturer / model reads as a TV becomes `screen`, probe V §6.5); then the **non-physical kinds** (new): platform
`jellyfin` (client sessions) → `session`; HA `group` helper players → `virtual_group`; `spotify` (a Connect device list)
→ `service`; then MA entity attribute `mass_player_type == group` → `group`; `device_class receiver` or a receiver
platform (`onkyo`, `denonavr` incl. its zone entities, `yamaha`, `yamaha_musiccast` with receiver class; `heos` when the
device is also a `denonavr` device) → `receiver`; `device_class speaker` or a speaker platform (`sonos`, `linkplay`,
`wiim`, `bluesound`, `heos`, `squeezebox`, `snapcast`, `cast` without a TV sibling, `music_assistant`) → `speaker`; else
`player`. `device_class` is absent on a third of the players in every probed system (cast, onkyo, heos, dlna_dmr,
jellyfin, group), so the platform / model heuristic is the working rule, not the exception. `session`, `virtual_group`
and `service` are **never shown as devices by default**, never enter a merge suggestion, and are listed in settings
under "רכיבים לא פיזיים" (system-K has 9 identically named Jellyfin sessions, 2 helper groups and 1 Spotify source). New
devices of every kind stay **unapproved** until an administrator approves them (2א, CR-015 decision 1b); settings get
"אשר את כל הנגנים שזוהו" next to the existing "אשר את כל המסכים שזוהו". Entities `hidden_by` the user stay in the model as
hidden endpoints (the owner's own manual dedupe); entities disabled by their config entry never enter it.

**Dedupe additions (three probes, §15).** The shipped ladder leaves 31 / 31 / 29 clusters where about 19 / 15-18 / 8
physical devices exist: MA-created entities are never joined to the vendor or Cast entity, rung 5 rarely fires because
most players carry no area, and model-number names normalise to nothing. Rungs added (auto-merge only where marked):
- **Rung 2b (MA id equals a vendor id, auto-merge, strong)**: an MA `unique_id` exactly equal to another platform's
  identifier (HEOS on system-V) merges under the same-platform guard. Rung 4 skipped the `music_assistant` domain by
  design; 2b lifts that for exact equality only.
- **Rung 2c (MA id embeds a vendor id, auto-merge, strong)**: after stripping the MA provider prefix the id equals or
  embeds a vendor identifier (the WiiM / LinkPlay pairs on systems H and V).
- **Rung 3b (manufacturer + model, auto-merge when unique)**: equal manufacturer and equal normalised model (a shortened
  Cast model that is a prefix counts) across platforms merges **only when the pair is unique in the system**; the same
  model twice (system-V has two identical TVs) becomes a suggestion. This is the key that links Cast ↔ MA, HEOS ↔ MA and
  the SmartThings / DLNA / vendor stacks of a Samsung TV.
- **Rung 5b (name + kind, suggestion)**: equal normalised names and compatible kinds with an area on **at least one**
  side (not both). An **empty normalised name never matches** (10 clusters of system-V are model numbers). Recovers the
  Sonos ↔ SmartThings twin that has an area on one side only (system-K).
- **Mirror role**: a strictly poorer twin from a cloud integration (SmartThings speaker next to a Sonos, SmartThings TV
  next to the vendor entity) becomes role `mirror`: hidden, never a primary for any control.
Rung 6 (the administrator's link) stays the fallback. Settings gain a **merge wizard** (§7.4) that walks the
suggestions one by one ("אחד" / "התעלם"), because every probed system needs several manual links.

### 5.2 Roles and primaries for audio kinds

New role `music` = the device's **music layer**: the available endpoint with the richest music mask (`PLAY_MEDIA` +
`MEDIA_ENQUEUE` + `BROWSE_MEDIA` + `SHUFFLE_SET` / `REPEAT_SET` + `GROUPING`), whatever its platform. It is the MA-created
entity where MA exists (systems H and V: Cast and WiiM entities carry none of those flags), the **Sonos** entity on
system-K (the full mask natively, no MA), the **HEOS** entity for queue / group volume on a Denon receiver. The music
layer is a **capability, not an MA role**; `music_provider` records which one answers (`ma` | `sonos` | `heos` | `vendor`
| `none`). It stays hidden in listings but is eligible as a primary. **One device card, never a second one per layer.**
Defaults (administrator override in `primary_json`, as in CR-015):

| Control | Primary (first that supports it) | Never |
|---|---|---|
| power | vendor (`TURN_ON/OFF`), else `music` | Cast (launches an app); a `mirror` |
| volume, mute | vendor with `VOLUME_SET`, else `music`, else Cast | a `mirror` |
| source, sound mode | vendor (receivers: Onkyo / Denon inputs and sound modes, per zone) | `music` (MA shows only "External") |
| transport, now playing | `music` when its state is playing/paused and it owns the playback (`active_queue` set, or Sonos / HEOS with a queue), else vendor, else Cast | — |
| queue, favourites, stations, playlists, transfer | `music` only (`transfer` only when `music_provider == 'ma'`) | vendor, Cast, `mirror` |
| grouping | `music` when it has `GROUPING` (MA groups across brands; Sonos natively); else vendor with `GROUPING` | Cast (no join); `virtual_group` helpers; mixing layers (§5.3) |

**Receivers with zones (system-V).** A Denon / Marantz receiver is one HA device with a Main and a Zone2 entity, plus a
HEOS entity and an MA twin. The model keeps it as **one device with `zones`** (`[{id, name, power, volume, source,
sound_mode}]`, Main first; Zone2 has no transport); the panel shows a zone switch. Power / source / sound mode → the zone's
`denonavr` entity; queue and group volume → HEOS; rich music → MA. The Onkyo receivers of system-H are single-zone.
Receiver-specific services (`denonavr.get_command`, Audyssey, `heos.sign_in/sign_out`, `sonos.update_alarm`, `group.set`)
are never exposed.

### 5.3 Groups

- **Static group** = a device of kind `group` (MA group player or HA `group` entity); members = its `group_members`
  mapped entity → device key (unknown members listed as "לא מוגדר").
- **Live group** = the **union** of every player's `group_members` plus every MA player whose `active_queue` points at
  another player (on system-V's live 4-member cross-brand group only the leader and one member list the four; the other
  two list nothing). "Ungrouped" is any of the four encodings seen: `[]` (MA), `[self]` (WiiM, Sonos), `null` (HEOS),
  absent (Cast, Denon) - i.e. a member list of length ≤ 1. The leader is the queue owner. `live.group` on every member:
  `{role: leader|member|none, leader_key, member_keys, name}`; a member card shows "מנגן עם סלון" and its transport
  acts on the leader (the server resolves, like MA does). A `virtual_group` helper (system-K: a 5-Sonos fan-out with no
  `GROUPING`) is **not** a live group: it is listed in the groups tab as a shortcut ("קבוצה וירטואלית", play / pause /
  volume fan-out) and can never be joined or split.
- **Grouping layer per join**: all devices through their `music` layer when it has `GROUPING` (MA groups across brands
  - HEOS + WiiM members on system-V; Sonos natively on system-K), else all through the same vendor platform with
  `GROUPING`; never a mix, never Cast (no `GROUPING` on any Cast entity in any system), never a `mirror`, never a
  `virtual_group`. **One group layer per device**: when the device has an MA endpoint, its groups are read and written
  through MA only; a vendor group of the same members (the WiiM pair on system-H is grouped in both layers) is an alias
  and hidden. If the two layers disagree (grouped in one, not the other), the card shows "קיבוץ לא תואם" and join is
  disabled until an administrator ungroups one layer. Candidates offered = approved devices of the same layer,
  available, with live `GROUPING`, not a member of another live group, within the caller's `media.group` scope; devices
  without `GROUPING` show no group section at all.
- **Outcome**: `join`/`unjoin` are accepted by HA, then the leader's `group_members` is read back for 8 s; each member
  gets `joined` / `not_joined` / `unknown` - the honest-outcome pattern of the bulk engine; the UI names the room
  ("פרגולה לא הצטרף").
- **Saved groups** (`media_group_presets`, §9): name, leader, members, optional per-member volume; "הפעל" = join as a
  diff (unjoin the extras, join the missing), then the volumes (clamped to each member's ceiling); the result per member
  as above. Created and edited in settings (§7.4) and, for `media.layout` holders, from the "קבוצות" tab.

### 5.4 Live and caps additions (contract §2)

`live.now` gains `artist`, `album`, `kind: "music"|"station"`; `live` gains `shuffle`, `repeat`, `group`, and
`queue: {count, index} | null`. `caps` gains `shuffle`, `repeat`, `seek` (exists), `group`, `favourites`, `stations`,
`playlists`, `transfer`, `up_next`, and `volume_group` (true on leaders and static groups).

**Caps come from an available endpoint only.** An `unavailable` or `restored` entity reports a degraded feature mask (MA:
no `VOLUME_SET`, no `GROUPING`; Jellyfin sessions: restored masks only). The model therefore computes `caps` from the live
`supported_features` of the **available** primary for each control, falls back to the last good mask stored on the
endpoint, and marks the device `caps_known: false` when no endpoint is available: the card shows "לא זמין" and keeps its
last controls greyed, it never becomes a device "without capabilities". 9 / 16 / 13 of the players were unavailable in the
three snapshots. **Availability is per integration**: a Cast-only TV that is `unavailable` is asleep (system-V), a
Samsung TV reports `off` (systems H and K); the kind profile, not the entity state alone, decides between "כבוי" and
"לא זמין".

## 6. Commands

### 6.1 Per device (the CR-015 route, new command names)

| `command` | Fields | Permission | HA call (primary) |
|---|---|---|---|
| `seek` | `position_s` ≥ 0 ≤ duration | control | `media_player.media_seek` |
| `shuffle` | `on` bool | control | `media_player.shuffle_set` |
| `repeat` | `mode` off/one/all | control | `media_player.repeat_set` |
| `play_item` | `item_ref` (from the server's lists), `enqueue` play/next/add (default play) | control | `music_assistant.play_media` (`media_id` = the stored uri, `media_type`) |
| `transfer` | `from_key` (a device playing now) | control at both anchors | `music_assistant.transfer_queue` (`source_player`, `auto_play: true`) |
| existing `power_*`, `volume_*`, `mute`, `source`, `sound_output`, `transport` | unchanged | unchanged | unchanged (receivers use them as screens do) |

`announce` is **not** a command in 0.1.150 (6א); the name is not reserved. A command sent to a **live-group member**
for transport/queue is executed on the leader (resolved server-side, audited with both keys). `play_item` never changes
volume.

### 6.2 Groups (new routes, contract §3)

`POST /multimedia/groups/join {leader_key, member_keys[]}`, `POST /multimedia/groups/leave {device_keys[]}`,
`POST /multimedia/groups/{leader_key}/volume {level, mode: relative|absolute}`, presets CRUD and
`POST /multimedia/groups/presets/{id}/apply`. All carry `client_request_id` + `expires_at` and return a `bulk_id`
polled on the existing `GET /devices/actions/{bulk_id}` with per-member outcomes.

- **Group volume**: `relative` (default) scales every member by the same factor from the current levels (balance kept,
  like MA `group_volume`); `absolute` sets one level on all. Each member is clamped to its `volume_max` **when one is
  set**; a member that is muted, unavailable or off is skipped with a reason. Rate 2/s per group (client debounce, last
  value wins). The panel shows the group slider and "לפי חדר" (one slider per member, the outcome per room).
- **Party confirmation** (kept from 7א): a join that results in ≥ 4 devices, or spans more than one floor, needs
  `confirmed: true` after a preview (question + count, like CR-015 bulk). A group spanning the whole building
  additionally needs `media.bulk`.

### 6.3 Allow-list and bridge 0.5.0

`ha_bridge.ACTIONS` (route `media`) += `media_player.media_seek`, `shuffle_set`, `repeat_set`, `join`, `unjoin`,
`music_assistant.play_media`, `music_assistant.transfer_queue` and the read service `smplwise_bridge.media_query`.
`music_assistant.play_announcement` is **not** allow-listed. The bridge's `media_policy.py` re-checks independently:
`play_media` only with `media_type` in the five allowed types and a `media_id` that is an MA library/provider URI
(no `http(s)://`, no `file`, no local path); `join.group_members` only `media_player` entities; `transfer_queue` only
between `music_assistant` entities. The add-on refuses the new commands (503 `bridge_outdated`) while the paired bridge
is older than 0.5.0; screen commands keep working with 0.4.0.

### 6.4 Rate limits (additions to CR-015 §5.3)

`seek` 2/s per device; `shuffle`/`repeat` 2/s; `play_item` 1/s per device, 6/min per user; `transfer` 1 per 5 s per
device; `join`/`leave`/preset apply one in flight per leader (409 `group_pending`, 8 s); group volume 2/s per group;
`media_query queue` served from the 2 s cache. A press over a limit is dropped with the CR-015 shake, no text.

## 7. UI (mockup: `docs/design/mockups/media/players-index.html`)

### 7.1 Page and tabs

The tab row appears: "מסכים" · "נגנים ורמקולים" · "קבוצות" (`#/multimedia/players`, `#/multimedia/groups`). The
players tab lists speakers, players and receivers grouped by floor with room chips, search and a state filter
("מנגנים", "כבויים", "לא זמינים"); a floor header offers "עצור מוזיקה" when something plays on it (confirmed, per-room
outcome). The groups tab shows live groups (leader card with member rows and the group slider), static groups and saved
groups ("הפעל"). Edit mode is the CR-015 editor; `MediaLayout` gains per-tab `order`/`pinned` (one layout document,
`tabs: {screens, players, groups}`), personal overrides the same way.

**Unplaced bucket, floors optional.** Only 12 / 6 / 14 of 33 / 33 / 32 players carry an area in the three systems; MA,
WiiM and HEOS players mostly have none, and system-K has **no floors at all** (11 areas, empty floor registry). Devices
without an area are listed in a last section "לא משויכים" on the players tab, in the area filter as "ללא חדר", and in the
floor menu with their count; they are excluded from floor scope rules (only installation-wide permissions reach them)
and from floor "עצור מוזיקה". When the installation has no floors the players tab shows **one list** ("כל החדרים",
the room chips are the filter, the floor menu hidden; one section per area would hold a single card each) plus the
unplaced section, and floor-scoped rules degrade to area scope. Settings › נגנים ורמקולים offers "חדר" per
device (writes the entity area through the bridge, an administrator action, audited) so a speaker can be placed from the
product without opening the infrastructure.

### 7.2 The player panel (the drawer pattern of the remote)

Header: name, room · floor, close. Body: artwork (proxied, square) with title, artist, album, a seekable progress bar
(client interpolation; stations show "שידור חי" and no bar); transport (shuffle, previous, play/pause, next, repeat);
volume slider + mute; for a leader or a static group one group slider plus "לפי חדר" (one slider per member, the
outcome per room); "הבא בתור" (current + next + "עוד N", "לא זמין" when the read is unconfirmed - never "empty"); tabs
"מועדפים" · "תחנות" · "פלייליסטים" (one tap = `play_item`; "נגן אחרי הנוכחי" behind a long press); section "קבוצה"
(the rooms of the same grouping authority as checkboxes, batched 500 ms into one join diff; the 4+ rooms / multi-floor
confirmation before sending; the outcome per room by name); "העבר את המוזיקה לכאן" when another player is playing.
Receivers: power, volume, sources and sound mode (the CR-015 surface without keys). Off: the big power button over the
dimmed body; unavailable: the CR-015 line. Without a music library (MA absent or unavailable) the panel simply has no
library tabs and "הבא בתור" reads "לא זמין"; the cards work as before. Operator screens stay clean: no hints, no HA/MA
names, short confirmations.

### 7.3 Cards and the groups tab

`<media-player-card>` (shares tokens and sizes with `<media-screen-card>`): square artwork with the glow of the TV
cards, name, state line ("מנגן · שם השיר", "מושהה", "לא מנגן", "כבוי", "מנגן עם סלון"), a group chip on members and
leaders, play/pause, volume, mute, "נגן" (opens the panel). Area card and home widget reuse it; the area's media section
shows speakers next to TVs. The groups tab: a live-group card (now playing, group slider, per-room rows with outcome),
static groups, and saved-group cards (name, rooms, "הפעל"; running state with a spinner, then "פועל" or the rooms that
did not join by name; edit / new for `media.layout` holders).

### 7.4 Settings tab "מולטימדיה" (`#/system/multimedia`, `system.configure`)

Sections, in order: **כללי** (existing: feature switch, bridge version); **מסכים** (existing); **נגנים ורמקולים** - every
detected non-screen device with kind (רמקול / נגן / מגבר), confidence, location (editable "חדר" for unplaced devices),
approval, display name, linked amplifier, **volume ceiling** (empty = none, 7ב) and an optional **night window** (from,
to, ceiling); "אשר את כל הנגנים שזוהו"; the connections of each device as in CR-015 (which layer answers what: music
= MA / Sonos / HEOS, power / source = vendor, `mirror` hidden); **איחוד כפילויות** - a merge wizard fed by the
suggestion rungs (3b ambiguous, 5b): one row per pair with the reason ("דגם זהה", "שם זהה · חדר באחד הצדדים", "מזהה
זהה"), "אחד" / "התעלם" per row, a counter; **רכיבים לא פיזיים** - the `session` / `virtual_group` / `service` entries
folded away with a count and a toggle to list them;
**קבוצות שמורות** - list, new / edit (name, rooms, optional volumes), delete; **מועדפים ותחנות** - which lists appear
(favourites / stations / playlists) and, per item, order and hide (one list for everyone, 5א; without MA the lists come
from the native provider - Sonos favourites - and the playlists tab is absent); **חיבור** - "Music Assistant דרך Home
Assistant: מחובר · N נגנים · N לא זמינים" or "Music Assistant: לא מותקן · ספקי מוזיקה: Sonos" and "חיבור ישיר: שלב
מאוחר יותר" (phase 2b, not configurable here, absent without MA); **הרשאות** - one line naming the roles that hold
`media.group` and a link to the roles screen. A settings screen keeps the exact technical names
(docs/design/UI_COPY_RULES.md); every change is saved at once, audited.

## 8. Permissions

| Permission | Hebrew label | Allows | Default roles | Sensitive |
|---|---|---|---|---|
| `media.read` (exists) | צפייה במסכים ובמולטימדיה | also players, groups, up next, favourites lists | as CR-015 | no |
| `media.control` (exists) | … עוצמה, מקשים וניגון | also seek, shuffle, repeat, start favourites/stations/playlists, transfer | as CR-015 | no |
| `media.power` (exists) | הדלקה וכיבוי והחלפת מקור | also receiver/speaker power and receiver inputs | as CR-015 | no |
| `media.group` (new, 7ב) | קיבוץ רמקולים וקבוצות שמורות | join/leave, group volume, apply saved groups (needs `media.control` at **every** member's anchor too); saved-group CRUD needs `media.layout` | operator, site_admin, system_admin | no (the party rule adds confirmation and `media.bulk` for building-wide) |
| `media.bulk` (exists) | … | also floor "עצור מוזיקה" and building-wide groups | as CR-015 | yes |

Not introduced: `media.announce` (6א) and `media.browse` (reserved for phase 2b). Favourites/stations/playlists are
installation lists, and history ("recently played") is not shown (privacy, MA notes §5.3). Custom roles: no data
migration is needed - no one loses a capability; `media.group` is granted only by built-in roles and explicit
custom-role edits.

## 9. Storage (migration `0044_media_players.sql`)

Next free number: 0043 is `camera_wall_hidden` (integ/0.1.149); no branch uses 0044+ (checked with `git ls-tree` on
every local branch, 2026-10-01). Renumber at merge if another branch claims it first.

- `media_group_presets`: `preset_id` (hex32) PK, `name` (≤ 40), `leader_key`, `members_json` (device keys, ≤ 16),
  `volumes_json` (key → 0-100, optional), `revision`, `created_by`, `updated_by`, `updated_at`. Audited
  `media.group.preset`.
- `media_devices` += `volume_night_json` (NULL, or `{from: "HH:MM", to: "HH:MM", max: 0-100}`; a second ceiling that
  applies inside the window, clamped in the command path before sending - never a loop after the fact). `volume_max`
  keeps its NULL default for every kind (7ב: no default ceiling).
- `media_device_endpoints` += `last_features_json` (the last `supported_features` mask seen while the endpoint was
  available; the fallback of §5.4), `group_layer` (`ma` | `vendor` | NULL, the one layer that answers grouping) and the
  role value `mirror`.
- `media_devices` += `music_provider` (`ma` | `sonos` | `heos` | `vendor` | `none`, derived, cached) and `zones_json`
  (NULL, or `[{endpoint_id, name}]` for multi-zone receivers). `kind` gains the values `session`, `virtual_group`,
  `service` (hidden by default).
- `media_link_rules` gains the rule ids `2b` (MA id equals a vendor id), `2c` (MA id embeds a vendor id), `3b`
  (manufacturer + model, unique) and `5b` (name + kind suggestion); no schema change.
- Removed from the proposal: `announce_ok`, `favourites_json` per device (5א: one list), `multimedia.announce_presets`.
- `media_group_runs`: none - group operations reuse `device_bulk_actions` (migration 0026) with `kind` `group_join`,
  `group_leave`, `group_volume`, `players_pause`.
- Settings key: `multimedia.favourites` (installation curation: `kinds_on` and `[{item_ref, hidden, order}]`).

## 10. Safety

1. **No volume jump, no silent default**: every volume write is clamped to the device's `volume_max` and, inside the
   night window, to `volume_night.max` - **only when an administrator set them** (7ב); group volume never raises a
   member above its ceilings; there is no "max" button; `play_item`, saved groups without volumes, transfer and join
   never change a volume. MA's own `max_volume` scaling (if the installer set one) applies on top.
2. **No announcements** in 0.1.150 (6א): no command, no bridge service, no permission.
3. **Party**: ≥ 4 devices or more than one floor → confirmation; building-wide → `media.bulk`.
4. **Only server-listed items** are playable (`item_ref`), never a URL typed or pasted by a client.
5. **No MA token exists in 0.1.150**; in phase 2b the token lives in the secrets store, is never logged, never sent to a
   browser, and is rotated before its 1-year expiry.
6. **One authority per device**: approved speakers' entities are refused on the generic action path
   (`use_media_screen`, CR-015 §5.2 - the code already covers any approved kind); grouping never mixes MA and vendor.
7. **Honest outcomes**: join, group volume, saved groups and floor pause report per device (`joined`, `not_joined`,
   `skipped: muted|off|unavailable|ceiling`), never an optimistic "done"; the UI names the room.
8. **No retries or queued commands after a reconnect** (AGENTS.md); commands to an unavailable device are refused.

## 11. Events

`media_state` (CR-015 §11) now covers every approved kind; when a leader's `group_members` changes, the server also
recomputes and publishes each old and new member (the reverse index is rebuilt with `media_state`). No queue push
exists through HA: the panel refetches "up next" when `live.now.title` changes and every 30 s while open. New frame
`media_groups_changed` (no ids) after a saved-group change. `ATTR_ALLOW` += `media_artist`, `media_album_name`,
`shuffle`, `repeat` (`group_members`, `mass_player_type`, `active_queue` were added in 0.1.149).

## 12. API contract delta (summary; full types in MEDIA_PLAYERS_API.md)

| Method | Path | Auth |
|---|---|---|
| GET | `/multimedia/devices?kind=speaker,player,receiver,group` | `media.read` (existing route, new kinds) |
| POST | `/multimedia/devices/{key}/commands` (new commands §6.1) | as §6.1 |
| GET | `/multimedia/devices/{key}/up-next` | `media.read` + `caps.up_next` |
| GET | `/multimedia/devices/{key}/library?kind=favourites|stations|playlists` | `media.read` + the cap |
| GET | `/multimedia/groups` | `media.read` |
| POST | `/multimedia/groups/join` · `/multimedia/groups/leave` | `media.group` + `media.control` per member |
| POST | `/multimedia/groups/{leader_key}/volume` | `media.group` |
| GET / POST / PUT / DELETE | `/multimedia/groups/presets[/{id}]` | read `media.read`; write `media.layout` |
| POST | `/multimedia/groups/presets/{id}/apply` | `media.group` |
| GET / POST | `/multimedia/actions/preview` · `/multimedia/actions` kind `players_pause` | `media.bulk` |
| GET / PUT | `/multimedia/favourites` (installation curation) | read `media.read`; write `media.layout` |
| PUT | `/multimedia/admin/devices/{key}` += `volume_night`, `area_id` (places an unplaced device; the bridge writes the entity registry) | `system.configure` (existing route) |

Removed from the proposal: `/multimedia/admin/announce-presets`.

## 13. Tests

- **Backend** (S1): `test_media_model.py` += audio kinds incl. `session` / `virtual_group` / `service`, the `music` layer
  chosen by flags (MA, Sonos, HEOS fixtures), `mirror` role never primary, rungs 2b / 2c / 3b (unique vs ambiguous) / 5b
  (empty name never matches, area on one side), receiver zones, primaries per control, live group resolution as the
  union of `group_members` + `active_queue` with the four ungrouped encodings, member → leader redirection, `caps` from
  an available endpoint only, per-integration availability (Cast asleep vs Samsung off), floors-less installations; `test_media_players_commands.py` (every new command → exact service call;
  refusals: caps, unknown `item_ref`, off/unavailable, bridge < 0.5.0, rate limits, clamp to `volume_max` and to the
  night window only when set, no clamp when NULL, `play_item` never touching volume, `announce` unknown → 422);
  `test_media_groups.py` (authority rule, no mixing, party confirmation, building-wide needs `media.bulk`, per-member
  permission, join read-back outcomes, relative/absolute group volume math with ceilings and skips, presets revision 409
  and diff apply); `test_media_query.py` (bridge read shapes trimmed, cache, item_ref HMAC, no URL leaves);
  `test_bridge_media_policy.py` += new services (URL media ids refused, `play_announcement` refused, join members only
  media_player); `test_migrations.py`, `test_access.py` (`media.group`), `test_media_api.py` (new routes × permission ×
  scope).
- **Frontend** (S2/S3): unit specs for group-volume ratio math, up-next states, join diff batching, player state text,
  night-window clamp display; evidence specs in demo mode at 1440/820/390 (loading, empty, nothing playing, error,
  view-only, playing, station, grouped leader, member, static group, receiver, off, unavailable, not confirmed, partial
  group outcome, no library), RTL; settings sections.
- **Live** (S4): `media_fake_ha.py` gets **two fixture sets** - "MA house" (MA speakers incl. unavailable `restored`
  ones, a WiiM pair grouped in both layers, a Cast + MA pair, a Denon receiver with Main / Zone2 + HEOS + MA, a
  cross-brand MA sync group whose members disagree on `group_members`, hidden Cast entities, model-number names) and
  "no-MA house" (six Sonos with SmartThings mirrors, Jellyfin sessions with one shared name, two `group` helpers, a
  Spotify source, no floors) - plus fake `get_queue`/`get_library` responses and a `join` one device refuses;
  `evidence-media-players-live.spec.ts` (SW_LIVE=1) runs both sets: one card per physical device, now playing,
  transport confirms, group join with a `not_joined` member, group volume clamps only where a ceiling is set, saved
  group apply, floor pause skips, Sonos favourites without MA, sessions and helpers hidden.

## 14. Open risks

1. **Grouping semantics per integration**: the probes (§15) settled the inventory (WiiM groups in two layers, Cast never
   groups, MA groups cross brands and report membership inconsistently, Sonos groups natively), but the behaviour of
   `join` on each layer is still UNVERIFIED without a service call; mitigated by the one-layer rule, the union rule,
   read-back outcomes and the manual `primary_json` override. First live round may need a fix pass.
1b. **Three different houses.** The model now has to serve MA-with-WiiM, MA-with-Denon/HEOS and Sonos-without-MA from one
   code path; the two fixture sets (§13) are the guard. A fourth pattern (AirPlay, Bluesound, MusicCast, Alexa) was seen
   in none of them and is not designed for.
2. **HA `volume_set` on an MA leader/group entity** may set member or group volume (UNVERIFIED); the fan-out avoids
   depending on it.
3. **`get_library` size and favourites semantics** (library flag in 2.10.4, per-user in 2.11): the owner may expect
   "his" favourites; the installation curation list (5א) mitigates.
4. **Stale MA entities** (9 of 33 players unavailable, 5 `restored`, probe §6.1): unapproved by default; the approval UI
   filters them; caps never read from them (§5.4).
4b. **Dedupe gap** (31 / 31 / 29 clusters for ~19 / 15-18 / 8 devices): rungs 2b / 2c / 3b / 5b plus the merge wizard;
   the first live round will show how many links remain by hand (expected: the ambiguous same-model TV pair on system-V
   and the renamed Sonos ↔ SmartThings pair on system-K).
4c. **Unplaced speakers** (21 / 27 / 18 without an area): the "לא משויכים" bucket keeps them usable; floor-scoped roles
   will not see them until an administrator places them (§7.1); system-K has no floors at all.
5. **Bridge 0.5.0** must be installed before the new commands work; screens keep working meanwhile.
6. **Design**: the mockup is delivered (§7); the calendar assumes one review round. A second round moves it by a day.
7. **Expectation gap on the queue** (4ג vs 1ג): the owner chose the full queue and library but deferred the connection
   they need. 0.1.150 will show "הבא בתור" with three rows; the full list arrives with phase 2b. Recorded in §0 and §4.4
   so nobody is surprised at the review.
8. **Night window** is a small addition beyond the proposal (the owner's settings list); it is a clamp in the command
   path plus two settings fields, no scheduler.

## 15. Live findings reconciled (three read-only probes, 2026-10-01)

The owner allowed read-only inspections (8). Reports (anonymised: counts and shapes only):
`docs/research/HOFFNUNG_MEDIA_PROBE_2026-10-01.md` (system-H), `HAVLIN_MEDIA_PROBE_2026-10-01.md` (system-V),
`KANTEROVITCH_MEDIA_PROBE_2026-10-01.md` (system-K). The method was the same WebSocket read allow-list; no service was
called, so join behaviour, `get_library` shapes and MA `schema_version` stay UNVERIFIED for the first live round (S4).

### 15.1 The three systems

| | system-H | system-V | system-K |
|---|---|---|---|
| Music Assistant | add-on 2.10.4 + integration, 11 players (7 live) | add-on 2.10.4 + integration, 13 players (6 live), a **live cross-brand sync group of 4** | **none** (Jellyfin server instead) |
| Players (enabled) | 33: MA 11, cast 9, onkyo 4, samsungtv_smart 2, smartthings 2, wiim 2, dlna_dmr 2, androidtv_remote 1 | 33: MA 13, cast 10, denonavr 4 (2 receivers × Main / Zone2), wiim 3, heos 2, smartthings 1 | 32: jellyfin 10 (+13 disabled), smartthings 8, **sonos 6**, samsungtv_smart 2, dlna_dmr 2, `group` helpers 2, cast 1, spotify 1 |
| Rich music flags (enqueue, shuffle, repeat, search, announce) | MA only | MA (+ HEOS: enqueue, shuffle, repeat, grouping, no announce / search) | **Sonos natively** (full mask); SmartThings twins degraded |
| `GROUPING` | 7 MA + 2 wiim; never cast | 7 MA + 3 wiim + 2 heos; never cast | 6 sonos; never smartthings / helpers |
| "Ungrouped" encoding | MA `[]`, wiim `[self]`, cast absent | MA `[]`, wiim `[self]`, heos `null`, cast / denon absent | sonos `[self]` |
| Unavailable | 9 of 33 (5 `restored`) | 16 of 33 (cast TVs drop off when powered down) | 13 of 32 (all Jellyfin + dlna + spotify); Samsung TVs report `off` |
| Ladder result → physical estimate | 36 endpoints → 31 clusters → ~19 devices | 33 → 31 → ~15-18 | 45 → 29 → **8** physical + 12 non-physical |
| Why the ladder stops | MA ids match nothing; no area on MA / cast devices | MA id **equals** the HEOS id, **embeds** the WiiM id; 10 clusters named by model number; no MAC anywhere | Sonos ↔ SmartThings twins share only the name; TVs link only by manufacturer + model; 8 Jellyfin sessions share one generic name |
| Receivers | onkyo × 4, single endpoint, no transport | denonavr Main + Zone2 + heos + MA = one receiver, three HA devices | none |
| Area coverage | 12 of 33 (8 of 20 areas) | 6 of 33 (3 of 22 areas) | 14 of 32; **0 floors** |
| TV control | samsungtv_smart, androidtv_remote, smartthings | **none**: LG-class TVs reachable only through cast + MA | samsungtv_smart + smartthings + dlna + cast per TV |

### 15.2 Patterns and where they landed

| Pattern (seen in) | Where it landed |
|---|---|
| The music layer is MA on H and V, Sonos on K, HEOS for queue / group volume on V's receivers | §5.2 `music` = a capability chosen by flags, `music_provider`; HA-only path is the product (§1, §4.1) |
| MA id equals (heos, V) or embeds (wiim, H + V) the vendor id | §5.1 rungs 2b, 2c (auto-merge, strong) |
| Cast ↔ MA and the Samsung TV stacks link only by manufacturer + model (V, K); same model twice on V | §5.1 rung 3b (auto when unique, else a suggestion) |
| Sonos ↔ SmartThings twins: equal name, area on one side (K); model-number names normalise to nothing (V) | §5.1 rung 5b (area on at least one side; empty name never matches); `mirror` role |
| Jellyfin sessions, `group` helpers, Spotify source (K) | §5.1 kinds `session` / `virtual_group` / `service`, hidden, never suggested; §5.3 helpers are shortcuts, never joinable |
| Cross-brand MA sync group whose members disagree on `group_members` (V); four ungrouped encodings | §5.3 union + `active_queue`, "ungrouped" = list ≤ 1 / `[]` / `null` / absent |
| WiiM pair grouped in two layers (H) | §5.3 alias + "קיבוץ לא תואם" |
| Degraded masks on unavailable / restored entities (H, V, K) | §5.4 caps from an available endpoint only, last good mask |
| Cast-only TV is `unavailable` when off (V); Samsung TV is `off` (H, K) | §5.4 availability per integration; a `cast_only` screen profile for CR-015's remote (follow-up, not this CR) |
| Denon receiver = Main + Zone2 + HEOS + MA (V) | §5.2 one device with zones, a zone switch in the panel |
| 21 / 27 / 18 players unplaced; K has no floors | §7.1 "לא משויכים", floors-less grouping by area; §7.4 "חדר" per device |
| Every system needs several manual links | §7.4 merge wizard |
| Vendor account / alarm / helper services (`heos.sign_in`, `sonos.update_alarm`, `group.set`, Denon Audyssey) | §5.2 never exposed |
| `MEDIA_ANNOUNCE` exists on MA and Sonos | stays out of 0.1.150 (6א) |
| Nothing was playing on H at the snapshot; V had one group paused | mockup states "כלום לא מנגן", paused group |

The mockup carries a mock-bar switch "ספריית מוזיקה: Music Assistant / ללא (Sonos)" that swaps the seed between an MA
house (H + V patterns: WiiM, Cast, Denon zones, a two-layer group, unplaced and unavailable speakers) and a no-MA house
(K: six Sonos, no floors, SmartThings mirrors hidden), so the owner sees both on the same screens.

## 16. Integration 0.1.150: review and reconciliation

The Opus review of the command and bridge path (4 medium, 7 low findings) is fixed on `pilot/CR016-review-fixes` and merged. The consequences for the contract
are in `docs/architecture/MEDIA_PLAYERS_API.md` §3.z (reconciliation with what S1 built, and the review fixes with what the client does with each):
a static group's volume is the group-volume route's only; a command to a static group or a party needs the join's confirmation (and `media.bulk` for the whole
building); a live leader's transport needs control at the followers' anchors; an unmute never reveals a level above a ceiling set later; previews may carry one
aggregate row for rooms the caller may not read; reads are rate-limited per user; every endpoint of a media device and the sibling entities of an approved
speaker are refused on the generic action route. Decision notes: the party rule counts real floors (a house without floors only asks for four rooms or more),
and a helper group (`virtual_group`) is a shortcut in the groups tab only after an administrator switches it on in the settings.

## 17. Phase 2b: the direct Music Assistant connection (design addendum, 2026-10-02, release 0.1.152)

The owner approved building phase 2b (decision 1ב, deferred on 2026-10-01, now built) so that decision 4ג - the full queue with drag /
delete / play next and the full library with search - is delivered. This section is the binding design of phase 2b; it adds to §4 option B
and replaces the reserved shapes of MEDIA_PLAYERS_API.md §6 where they differ (§17.7). Branch `pilot/CR016-2b-music-assistant`.

### 17.1 Read-only probe of system-H (2026-10-02)

`scripts/ma_probe.py` (allow-list: HA WebSocket `auth`, `get_services`, `config/entity_registry/list`, `config_entries/get`, `call_service`
ONLY for the three Music Assistant response services that read - `get_library`, `get_queue`, `search` - and an unauthenticated `GET /info`
on port 8095 of the HA host). Structure only: key sets, types, counts, closed enumerations. Nothing was played, changed or written.

| Question | Finding |
|---|---|
| MA config entry | 1 entry, `loaded`; 11 enabled MA `media_player` entities; their `unique_id` (= the MA `player_id`) has two textual shapes (14 and 46 characters) |
| `get_library` fields | `album_artists_only`, `album_type`, `config_entry_id`, `favorite`, `media_type`, `order_by`, `pagination`, **`search`**, `username`; response not optional |
| `get_library` answer | `{items, limit, media_type, offset, order_by}`; an item is `{name, uri, media_type, version, favorite, explicit, image}` plus `artists[]` (track, album) and `album{}` (track); `image` is a URL string or null - never forwarded |
| Favourites | **0 favourites of every type** on system-H, while every type has library items: the "מועדפים" tab of 0.1.150 is empty there; the library tab of this phase is what fills the panel |
| `search` | answers `{artists, albums, tracks, playlists, radio, audiobooks, podcasts}` (lists) through HA as well |
| `get_queue` | `{queue_id, active, name, items (a COUNT), shuffle_enabled, repeat_mode, current_index, elapsed_time, current_item, next_item}`; an item `{queue_item_id, name, duration, media_item, stream_title}`. Confirms: Home Assistant offers **no queue list and no queue edit** |
| MA server (`GET /info`, `schema_version`) | **not reachable from the owner's workstation** (connect timeout on 8095): `schema_version` was NOT read. Reachability from the add-on container stays UNVERIFIED (the MA add-on runs on the host network; the add-on reaches the host through the Supervisor network) |

### 17.2 Connection method (adopted)

| Need | Path | Why |
|---|---|---|
| Full library, browse by type with paging (tracks, albums, artists, playlists, stations) | **Home Assistant** - the existing bridge read `media_query library` (bridge 0.5.0: `favorite: false`, `offset`, `limit` <= 100) | least privilege: no new secret, no second authority; works in every MA house today |
| Library **search** | **direct MA** `music/search` (`library_only: true`, one media type, limit 50) when the direct connection is ready; without it the library has no search box | the bridge's argument set is closed and has no `search`; a bridge 0.6.0 `search` argument would remove the token from this path (owner question Q3) |
| Full queue list; move, delete, play next, clear | **direct MA** `player_queues/*` | Home Assistant has no such service (17.1) - this is the only path that really provides queue manipulation |
| Transport, volume, power, play an item, transfer, groups | unchanged: Home Assistant through the signed bridge as the caller | one authority for everything audible; the direct connection never starts, stops or changes the volume of anything |

Transport: MA's **stateless JSON-RPC over HTTP** (`POST <url>/api`, header `Authorization: Bearer <token>`, body `{message_id, command,
args}`), one request per read or edit, timeout 8 s. No persistent WebSocket and no MA events: the panel refetches the queue list when it opens,
after each edit, when the now-playing title changes and every 30 s while open (the up-next cadence). Hence no reconnect loop: a failure opens a
30 s circuit (`unreachable`) during which nothing is sent; **a write is never retried**. A transport abstraction keeps a WebSocket client a
drop-in later. The client has a fixed command allow-list (anything else raises before a byte is sent): `players/all` (the connection test: a
count only), `player_queues/get_active_queue`, `player_queues/items`, `player_queues/move_item`, `player_queues/delete_item`,
`player_queues/clear`, `music/search`, plus `GET /info` (schema gate). Every player id sent is derived on the server from an **approved**
device's MA entity (`unique_id`); a client never names a player, a queue or a queue item. The JSON-RPC endpoint and the schema number of
release 2.10.4 are documented by MA but UNVERIFIED on the owner's server (17.1).

Rejected: MA's Ingress port 8094 (it trusts Home Assistant user headers - using it would be impersonation), the MA `service` role or an
admin token, username + password onboarding, a generic command passthrough, and an MA WebSocket with events (more moving parts than a
refetching panel needs; reserved).

### 17.3 Credentials (installer-only)

- The owner creates, in Music Assistant itself, a dedicated account of role `user` restricted by a `player_filter` to the players this
  product manages, and a long-lived token for it (MA tokens live one year without renewal). The installer pastes the server address and the
  token in הגדרות › מולטימדיה › חיבור (`system.configure`).
- The token is **write-only**: stored in `<data>/secrets/music_assistant_token` (mode 0600, the `notify_email` precedent), never returned
  (the API says `token_set` and `token_set_at`), never logged, never in an audit row (`token: "set" | "cleared"` only), never in a backup.
- The address lives in the setting `multimedia.ma_direct` (`{enabled, url, token_set_at, last_test}`), is returned only to
  `system.configure`, is never in an operator answer, a log line or an audit row (`url_changed: true` only), and is excluded from backups
  (`backup.SETTINGS_KEEP`). Validation: `http` / `https`, a host, an optional port; no user-info, path, query or fragment.
- Settings warn from day 330 after `token_set_at` ("יש לחדש את האסימון").

### 17.4 Permissions

| Permission | Label | Allows | Default roles | Sensitive |
|---|---|---|---|---|
| `media.browse` (new) | עיון וחיפוש בספריית המוזיקה | the library tab (browse + search) of a device, at its anchor; starting an item stays `media.control` (`play_item`) | operator, site_admin, system_admin (the `media.group` pattern) | no |
| `media.queue` (new) | עריכת תור הניגון | move, delete, play next, clear; needs `media.control` too; on a live leader with followers `media.queue` at every follower's anchor | **system_admin only** (default deny for every other built-in role; a custom role may add it) | no |

Reading the full queue list needs `media.read` (as up next). No migration: nobody loses a capability, no custom role changes. (Next free
migration number if one is ever needed: **0051** - 0045-0047 CR-018 on `g0/intake`, 0048 on unmerged CR-018 branches, 0049
`pilot/switch-model`, 0050 reserved for CR-020.)

### 17.5 Confirmation, limits, audit

- `clear` answers 409 `confirm_required` with `{count}` until it is resent with `confirmed: true`. `move`, `next` and `delete` act at once
  (operator screens stay clean: no dialog, the row moves or disappears).
- **Locked rows**: the current item and the rows MA already buffered (`index <= max(current_index, index_in_buffer)`) are never moved or
  deleted (409 `locked`) and nothing is moved into that zone. History rows before the current one are not listed.
- An edit names an opaque `item` (24 hex, an HMAC issued by the list read to THIS user for THIS device, 10 minutes); the server re-reads the
  queue before a move to find the row's current index (409 `queue_changed` when it is gone).
- Rate limits: edits 2/s per device and 30/min per user; queue list reads share the up-next budget per user; search 0.5/s (burst 4) per
  user. Over a limit: 429, dropped, never queued.
- Writes carry `client_request_id` + `expires_at` (<= 60 s); a repeated id answers the stored result (2 minutes, in memory).
- Audit: one `media.queue` row per edit attempt (`op`, outcome, MA error code number) - never an item name, uri or id; `media.ma_connection`
  for every settings change and connection test.

### 17.6 Failure and fallback

- Not configured, switched off, `unreachable`, `unauthorized` (401/403), `schema_too_old` (`schema_version` below `MIN_SCHEMA_VERSION` = 27,
  the lowest the documented commands need - UNVERIFIED, raised once the owner's number is known) or `error`: the device's caps `queue_list` and
  `search` are false and the panel shows exactly the HA depth (up next = current + next + count, the library without a search box). Nothing
  else changes; the HA path never depends on the direct connection.
- A failed queue read is `confirmed: false` ("לא זמין"), never an empty queue. A refused edit answers `status: "refused"` with the MA error
  code number only (no text: it may carry provider details).
- Settings show the state (`off`, `ready`, `unreachable`, `unauthorized`, `schema_too_old`, `error`), the server and schema versions and the
  number of players the account sees (more players than the product manages means the `player_filter` is missing - shown as a warning).

### 17.7 API (as built; MEDIA_PLAYERS_API.md §6 points here)

| Method | Path | Auth | Shape |
|---|---|---|---|
| GET | `/multimedia/devices/{key}/queue?offset=&limit=` | `media.read` + `caps.queue_list` | `{confirmed, count, index, locked_to, offset, items: [{item, index, name, artist, album, duration_s, locked}], read_at}` (a member answers with its leader's queue) |
| POST | `/multimedia/devices/{key}/queue` | `media.queue` + `media.control` | `{op: move\|next\|delete\|clear, item?, to?, confirmed?, client_request_id, expires_at}` -> 202 `{status: accepted\|refused, op, error?}`; 409 `confirm_required` / `locked` / `queue_changed`; 503 `ma_unavailable` |
| GET | `/multimedia/devices/{key}/browse?type=track\|album\|artist\|playlist\|radio&q=&offset=` | `media.browse` + `caps.browse` (`q` needs `caps.search`) | `{type, q, items: LibraryItem[], offset, more, read_at, provider}`; items are played with the existing `play_item` (`enqueue` play / next / add) |
| GET / PUT | `/multimedia/admin/ma-connection` | `system.configure` | `{enabled, url, token_set, token_set_at, token_expiring, state, last_test}`; PUT `{enabled?, url?, token?, clear_token?}` |
| POST | `/multimedia/admin/ma-connection/test` | `system.configure` | `{state, server_version, schema_version, players}` |

`MediaCaps` += `queue_list`, `browse`, `search`; `MediaCan` += `queue`, `browse`; `GET status` `library` += `direct: {state}` (state only;
the address never). Commands `queue_move` / `queue_delete` / `queue_clear` reserved in §4.4 became the `op`s of one queue route because
they have a different authority (the direct connection) and permission (`media.queue`) than the bridge commands.

### 17.8 UI

- Player panel, "הבא בתור": with `caps.queue_list` it becomes the full list (current row first, locked rows without handles); each row
  has a drag handle (pointer drag; keyboard: the row's "הזז למעלה / למטה" buttons), "נגן הבא" and delete; "נקה תור" asks once ("לנקות
  N שירים מהתור?"). Without `can.queue` the list is read-only. Without `caps.queue_list` the 0.1.150 block is unchanged.
- Library: a fourth tab "ספרייה" (with `caps.browse` and `can.browse`) with type chips "שירים · אלבומים · אמנים · פלייליסטים · תחנות",
  "עוד" paging and, with `caps.search`, a search field (400 ms debounce). A tap plays; the row offers "נגן הבא" and "הוסף לתור".
- Settings › מולטימדיה › חיבור: the HA line of 0.1.150, then "חיבור ישיר ל־Music Assistant": switch, address, token (write-only, "הוגדר
  ב־<date>" / "החלף" / "מחק"), "בדוק חיבור" with the state line. Technical names stay in settings only; operator screens show neither
  Home Assistant nor Music Assistant (no hints, no badges).

### 17.9 Open owner questions (safest default taken)

- Q1 (credentials model): a dedicated MA `user` account + `player_filter` + a token pasted by the installer (adopted) vs. reusing an
  existing MA account. Default: dedicated account; the settings warn when the account sees more players than the product manages.
- Q2 (`media.queue` default): system_admin only (adopted) vs. also operator / site_admin.
- Q3 (search without a token): add a `search` argument to the bridge's `media_query library` (bridge 0.6.0) so search works through Home
  Assistant without the direct connection - recommended for 0.1.153.
- Q4 (network): confirm the MA server port is reachable from the add-on container (the workstation could not reach it, 17.1).
