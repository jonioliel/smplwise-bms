# CR-016 — Multimedia phase 2: players, speakers, groups ("מולטימדיה · נגנים ורמקולים · קבוצות")

**Status:** PROPOSED (architecture, 2026-10-01). Not approved; nothing implemented. The owner's answers to
`docs/design/mockups/media/players-decisions-HE.md` (8 questions) and a short mockup round decide the open points;
every "(recommended)" below is the default if the owner adopts the recommendations as he did for CR-015.
**Release:** 0.1.150 (task T099). **Contract and work plan:** `docs/architecture/MEDIA_PLAYERS_API.md`.
**Builds on:** CR-015 (`docs/changes/CR-015-MEDIA-SCREENS.md`, `docs/architecture/MEDIA_API.md`, shipped in the
integration branch `integ/0.1.149`; "CR-015 §n" below). **Research:** `docs/research/MUSIC_ASSISTANT_API_NOTES.md`
("MA notes"; section 8 is new for this CR). No device, HA, MA or lab system was contacted for this document.

## 1. Goal and the one-line answer

The owner wants phase 2 to cost about what the TV phase cost. It can, **if** 0.1.150 reuses the CR-015 model and
command path unchanged and talks to Music Assistant (MA) **through Home Assistant only** (§4). Everything a speaker card
needs (now playing with artwork, transport, volume, grouping, favourites, stations, "up next") is reachable through the
MA-created HA entities and the MA integration's actions. A direct MA connection (full queue list and queue editing,
MA group volume) is deliberately left for a later slice.

## 2. Scope

| In 0.1.150 (recommended) | Later (0.1.151+, separate decision) |
|---|---|
| Kinds `speaker`, `player`, `receiver`, `group` rendered as first-class cards; tabs "נגנים ורמקולים" and "קבוצות" become real | Direct MA client: full queue list, move/delete/clear, MA `group_volume`, `can_group_with`, sleep timer |
| Now playing with artwork (title, artist, album, progress), transport incl. seek, shuffle, repeat | Library browse and search (`media.browse`) |
| Volume per player; **group volume** as a per-member fan-out with a per-room outcome | MA group player creation (sync/universal groups are created in MA itself) |
| "Up next": current + next item and the queue length (HA `get_queue`) | Time-window ("night") volume ceilings |
| Start a **favourite**, a **station** or a **playlist** (HA `get_library` + `play_media`); "move the music here" (`transfer_queue`) | Free-text announcements, microphone announcements |
| Live groups (join / leave) and **saved group presets** ("סלון + מטבח"); static MA groups as group cards | Per-person favourites (MA 2.11 per-user favourites) |
| Receiver cards (power, volume, source, sound mode) - the receiver that CR-015 links to a screen also lives here | Schedules/alarms of music (CR-014 has its own path) |
| Floor "עצור מוזיקה" (pause every playing player of a floor, confirmed) | |
| Announcements from **administrator presets only**, if the owner approves question 6 (off by default) | |

Explicitly out: MA configuration of any kind (`config/*`, providers, users, tokens), DSP, library writes, the browser
"this device" player (Sendspin), lyrics, AI radio, artwork-driven lights, anything named Home Assistant on operator
screens (owner rule: "תשתית המערכת").

## 3. What reuses CR-015 unchanged, and what is new

| Area | Reused as is | New in CR-016 |
|---|---|---|
| Model | `media_devices`, `media_device_endpoints`, `media_link_rules`, the dedupe ladder rungs 1-6 incl. the MA loop (rung 2), MAC/identifier rungs, the two-same-platform guard, tombstones, approval, `kind_source` manual override, `volume_max` | kind detection for audio (§5.1), primaries for audio kinds (§5.2), group resolution (§5.3), `caps`/`live` audio fields |
| Dedupe of MA / Cast / DLNA / AirPlay duplicates | rung 2 (MA export/import exact), rung 1 (same HA device), rungs 3-4 (MAC, identifiers), hidden duplicate roles | the MA endpoint of a **speaker** is kept as the `music` primary even though it stays hidden in lists (§5.2) |
| Commands | `POST /multimedia/devices/{key}/commands`, `client_request_id` + `expires_at`, idempotency, `ha_bridge.validate_action`, signed bridge with the caller's HA context, `ha_actions` confirmation poll, audit rows, `accepted`/`sent`/`refused`, "not confirmed" after 8 s, rate limits | commands `seek`, `shuffle`, `repeat`, `play_item`, `transfer`, `announce` (§6.1); group routes (§6.2); bridge 0.5.0 allow-list + `media_policy` additions; one bridge **read** service `media_query` (§4.3) |
| Permissions | `media.read`, `media.control`, `media.power`, `media.bulk` (sensitive), `media.layout`, floor scope by anchor placement | `media.group`; `media.announce` (sensitive) only if announcements are approved (§8) |
| Page, editor | the "מולטימדיה" rail entry, glass style, floor grouping, room chips, search/state filter, `registerScreenEdit` edit mode, `media_layouts` + personal override | the tab row becomes visible (three tabs); layout gains a `tab` dimension (§7.1) |
| Drawer | `sw-drawer modal` side panel / phone bottom sheet, states (loading, unavailable, off, view-only, pending, not confirmed, rate-limited) | `<media-player-panel>` content: now playing, transport, volume (+ members pop-out), "up next", favourites/stations/playlists, group section (§7.2) |
| Area card, home widget | library `media` type, one card per device, "שלט" opens the drawer; home widget `media` | non-screen devices render as `<media-player-card>` in the same area card; the widget counts "מנגנים עכשיו" too |
| Bulk | `services/device_bulk.py`, preview + confirmed run, per-device outcome | kind `players_pause` (floor/area); group volume fan-out reuses the same per-device records |
| Artwork | `GET /multimedia/devices/{key}/artwork` (entity_picture proxy, content art only, ≤ 512 KB) | none - music art is already `media_content_type: music` |
| Settings | "הגדרות › מולטימדיה": approval, kinds, links, profiles, `volume_max` | an "נגנים" list (approve all detected speakers in one action), presets for announcements (if approved), favourites curation |

## 4. Connection model: through Home Assistant (recommended) vs direct MA

### 4.1 The two options

| | A. HA only (recommended for 0.1.150) | B. Direct MA WebSocket from the add-on |
|---|---|---|
| Authority | one: the signed bridge with the caller's HA context, as for screens | two: HA for screens/vendor players, MA for music; our RBAC is the only gate for MA |
| Secrets | none new | an MA long-lived token (1 year, no renewal) in our secrets store; an MA `user` account with a `player_filter` created by the owner |
| Network | add-on → HA only (as today) | add-on → HA host port 8095 (MA add-on is on the host network; reachability from our container UNVERIFIED) |
| Queue | now + up next + length (`get_queue`) | full list, move/delete/clear, locked buffered rows |
| Group volume | per-member fan-out, balance computed by us, per-room outcome | MA `group_volume` (balance kept by MA) + per-member |
| Group candidates | offered by rule (§5.3), outcome read back | `can_group_with` exact |
| Events | HA state events (already consumed) | MA events (new client, reconnect, resync) |
| MA absent | same code; players from vendor integrations only | must also implement option A as the fallback |
| Effort | small: §3 reuse | + a client service, secrets, reconnect, a fake MA server for tests, a second command path and its review |

### 4.2 Recommendation and reasons

**Option A for 0.1.150.** (1) The CR-015 command path, its bridge policy, audit and HA-user context stay the single
authority - no second security review. (2) No new secret, no MA account, no network question, no token renewal.
(3) The owner's system already runs the MA integration with `get_queue`, `get_library`, `play_media`, `search`,
`transfer_queue`, `play_announcement` and grouping on its players (inventory 2026-09-30). (4) The fallback "no MA" is the
same code path. (5) It removes the biggest schedule risk. The honest cost is the queue depth and the group-volume
fidelity (§4.1); both are recoverable later by adding option B **next to** A (endpoints `ma:<player_id>` are already
reserved; rung 2 joins them exactly), not by rewriting A.

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

## 5. Model additions (pure, `services/media_model.py`)

### 5.1 Kinds

Manual kind still wins. Order: screen rules of CR-015 §3.4 first; then MA entity attribute `mass_player_type == group`
or HA `group` platform → `group`; `device_class receiver` or a receiver platform (`onkyo`, `denonavr`, `yamaha`,
`yamaha_musiccast` with receiver class) → `receiver`; `device_class speaker` or a speaker platform (`sonos`,
`linkplay`, `wiim`, `bluesound`, `heos`, `squeezebox`, `snapcast`, `cast` without a TV sibling, `music_assistant`) →
`speaker`; else `player`. New devices stay **unapproved** until an administrator approves them (CR-015 decision 1b);
settings get "אשר את כל הנגנים שזוהו".

### 5.2 Roles and primaries for audio kinds

New role `music` = the device's MA-created entity (today `ma_native`/`ma_export`); it stays hidden in listings but is
eligible as a primary. Defaults (administrator override in `primary_json`, as in CR-015):

| Control | Primary (first that supports it) | Never |
|---|---|---|
| power | vendor (`TURN_ON/OFF`), else `music` | Cast (launches an app) |
| volume, mute | vendor with `VOLUME_SET`, else `music`, else Cast | — |
| source, sound mode | vendor (receivers: Onkyo/Denon inputs) | `music` (MA shows only "External") |
| transport, now playing | `music` when its state is playing/paused and `active_queue` is set (MA owns the playback), else vendor, else Cast | — |
| queue, favourites, stations, playlists, transfer, announce | `music` only | vendor, Cast |
| grouping | `music` when the device has one (MA groups across protocols); else vendor with `GROUPING` | Cast (no join); mixing authorities (§5.3) |

### 5.3 Groups

- **Static group** = a device of kind `group` (MA group player or HA `group` entity); members = its `group_members`
  mapped entity → device key (unknown members listed as "לא מוגדר").
- **Live group** = a leader whose `group_members` names other devices. `live.group` on every member:
  `{role: leader|member|none, leader_key, member_keys, name}`; a member card shows "מנגן עם סלון" and its transport
  acts on the leader (the server resolves, like MA does).
- **Grouping authority per join**: all devices through their `music` endpoint, or all through the same vendor platform
  with `GROUPING`; never a mix, never Cast. Candidates offered = approved devices of the same authority, available,
  not a member of another live group, within the caller's `media.group` scope.
- **Outcome**: `join`/`unjoin` are accepted by HA, then the leader's `group_members` is read back for 8 s; each member
  gets `joined` / `not_joined` / `unknown` - the honest-outcome pattern of the bulk engine.
- **Presets** (`media_group_presets`, §9): name, leader, members, optional per-member volume; "הפעל" = join as a diff
  (unjoin the extras, join the missing), then the volumes (clamped); the result per member as above.

### 5.4 Live and caps additions (contract §2)

`live.now` gains `artist`, `album`, `kind: "music"|"station"`; `live` gains `shuffle`, `repeat`, `group`, and
`queue: {count, index} | null`. `caps` gains `shuffle`, `repeat`, `seek` (exists), `group`, `favourites`, `stations`,
`playlists`, `transfer`, `announce`, `up_next`, and `volume_group` (true on leaders and static groups).

## 6. Commands

### 6.1 Per device (the CR-015 route, new command names)

| `command` | Fields | Permission | HA call (primary) |
|---|---|---|---|
| `seek` | `position_s` ≥ 0 ≤ duration | control | `media_player.media_seek` |
| `shuffle` | `on` bool | control | `media_player.shuffle_set` |
| `repeat` | `mode` off/one/all | control | `media_player.repeat_set` |
| `play_item` | `item_ref` (from the server's lists), `enqueue` play/next/add (default play) | control | `music_assistant.play_media` (`media_id` = the stored uri, `media_type`) |
| `transfer` | `from_key` (a device playing now) | control at both anchors | `music_assistant.transfer_queue` (`source_player`, `auto_play: true`) |
| `announce` | `preset_id` | `media.announce` | `music_assistant.play_announcement` (`message` + `tts_entity_id` from the preset, `announce_volume` ≤ min(preset, device ceiling, 60)) |
| existing `power_*`, `volume_*`, `mute`, `source`, `sound_output`, `transport` | unchanged | unchanged | unchanged (receivers use them as screens do) |

A command sent to a **live-group member** for transport/queue is executed on the leader (resolved server-side, audited
with both keys). `play_item` never changes volume.

### 6.2 Groups (new routes, contract §3)

`POST /multimedia/groups/join {leader_key, member_keys[]}`, `POST /multimedia/groups/leave {device_keys[]}`,
`POST /multimedia/groups/{leader_key}/volume {level, mode: relative|absolute}`, presets CRUD and
`POST /multimedia/groups/presets/{id}/apply`. All carry `client_request_id` + `expires_at` and return a `bulk_id`
polled on the existing `GET /devices/actions/{bulk_id}` with per-member outcomes.

- **Group volume**: `relative` (default) scales every member by the same factor from the current levels (balance kept,
  like MA `group_volume`); `absolute` sets one level on all. Each member is clamped to its `volume_max`; a member that
  is muted, unavailable or off is skipped with a reason. Rate 2/s per group (client debounce, last value wins).
- **Party confirmation**: a join that results in ≥ 4 devices, or spans more than one floor, needs `confirmed: true`
  after a preview (question + count, like CR-015 bulk). A group spanning the whole building additionally needs
  `media.bulk`.

### 6.3 Allow-list and bridge 0.5.0

`ha_bridge.ACTIONS` (route `media`) += `media_player.media_seek`, `shuffle_set`, `repeat_set`, `join`, `unjoin`,
`music_assistant.play_media`, `music_assistant.transfer_queue`, `music_assistant.play_announcement` (only if approved)
and the read service `smplwise_bridge.media_query`. The bridge's `media_policy.py` re-checks independently:
`play_media` only with `media_type` in the five allowed types and a `media_id` that is an MA library/provider URI
(no `http(s)://`, no `file`, no local path); `join.group_members` only `media_player` entities; `play_announcement` only
`message` ≤ 200 chars + an existing `tts.*` entity, never `url`/`pre_announce_url`, `announce_volume` ≤ 60;
`transfer_queue` only between `music_assistant` entities. The add-on refuses the new commands (503 `bridge_outdated`)
while the paired bridge is older than 0.5.0; screen commands keep working with 0.4.0.

### 6.4 Rate limits (additions to CR-015 §5.3)

`seek` 2/s per device; `shuffle`/`repeat` 2/s; `play_item` 1/s per device, 6/min per user; `transfer` 1 per 5 s per
device; `join`/`leave`/preset apply one in flight per leader (409 `group_pending`, 8 s); group volume 2/s per group;
`announce` 1/min per device, 3/min per user, 20/day per installation; `media_query queue` served from the 2 s cache.

## 7. UI

### 7.1 Page and tabs

The tab row appears: "מסכים" · "נגנים ורמקולים" · "קבוצות" (`#/multimedia/players`, `#/multimedia/groups`). The
players tab lists speakers, players and receivers grouped by floor with room chips, search and a state filter
("מנגנים", "כבויים", "לא זמינים"); the groups tab shows live groups (leader card with member chips), static groups and
saved presets ("הפעל"). Edit mode is the CR-015 editor; `MediaLayout` gains per-tab `order`/`pinned` (one layout
document, `tabs: {screens, players, groups}`), personal overrides the same way.

### 7.2 The player panel (the drawer pattern of the remote)

Header: name, room, power (when the device has one), "שלט" becomes "נגן". Body: artwork (proxied) with title, artist,
album and a progress bar (client interpolation); transport (previous, play/pause, next), seek by dragging the bar,
shuffle and repeat; volume slider + mute; for a leader or a static group, one group slider plus "לפי חדר" (members
pop-out, one slider each, per-room outcome); "הבא בתור" (current + next + "עוד N"); tabs "מועדפים" · "תחנות" ·
"פלייליסטים" (one tap = `play_item`, long press = "נגן אחרי הנוכחי"); section "קבוצה" (join/leave with checkboxes,
batched 500 ms into one join diff; "העבר את המוזיקה לכאן"). Receivers: power, volume, sources and sound mode (the
CR-015 surface without keys). Operator screens stay clean: no hints, no HA names, short confirmations.

### 7.3 Cards

`<media-player-card>` (shares tokens and sizes with `<media-screen-card>`): small artwork, name/room, state line
("מנגן · שם השיר", "מושהה", "כבוי", "מנגן עם סלון"), play/pause, volume. Area card and home widget reuse it.

## 8. Permissions

| Permission | Hebrew label | Allows | Default roles | Sensitive |
|---|---|---|---|---|
| `media.read` (exists) | צפייה במסכים ובמולטימדיה | also players, groups, up next, favourites lists | as CR-015 | no |
| `media.control` (exists) | … עוצמה, מקשים וניגון | also seek, shuffle, repeat, start favourites/stations/playlists, transfer | as CR-015 | no |
| `media.power` (exists) | הדלקה וכיבוי והחלפת מקור | also receiver/speaker power and receiver inputs | as CR-015 | no |
| `media.group` (new) | קיבוץ רמקולים וקבוצות שמורות | join/leave, group volume, apply presets (needs `media.control` at **every** member's anchor too); preset CRUD needs `media.layout` | operator, site_admin, system_admin | no (the party rule adds confirmation and `media.bulk` for building-wide) |
| `media.announce` (new, only if approved) | הכרזות ברמקולים | send an administrator preset to devices in scope | site_admin, system_admin | **yes** |
| `media.bulk` (exists) | … | also floor "עצור מוזיקה" and building-wide groups | as CR-015 | yes |

`media.browse` (library and search) is **not** introduced in 0.1.150: favourites/stations/playlists are installation
lists, and history ("recently played") is not shown (privacy, MA notes §5.3). Custom roles: no data migration is
needed - no one loses a capability; `media.group` is granted only by built-in roles and explicit custom-role edits.

## 9. Storage (migration `0044_media_players.sql`)

Next free number: 0043 is `camera_wall_hidden` (integ/0.1.149); no branch uses 0044+ (checked with `git ls-tree` on
every local branch, 2026-10-01). Renumber at merge if another branch claims it first.

- `media_group_presets`: `preset_id` (hex32) PK, `name` (≤ 40), `leader_key`, `members_json` (device keys, ≤ 16),
  `volumes_json` (key → 0-100, optional), `revision`, `created_by`, `updated_by`, `updated_at`. Audited
  `media.group.preset`.
- `media_devices` += `announce_ok` (0/1, default 0: a device receives announcements only when an administrator allowed
  it) and `favourites_json` (per-device curation of the favourites row: order/hide, NULL = the installation list).
- `media_group_runs`: none - group operations reuse `device_bulk_actions` (migration 0026) with `kind` `group_join`,
  `group_leave`, `group_volume`, `players_pause`.
- Settings keys: `multimedia.favourites` (installation curation: which favourites/stations/playlists appear and in
  which order), `multimedia.announce_presets` (≤ 10 `{id, label, message, tts_entity_id, volume}`; only if approved).

## 10. Safety

1. **No volume jump**: every volume write is clamped to the device's `volume_max`; new speakers and groups are
   created with `volume_max = 80` (an administrator may change it; screens keep NULL); group volume never raises a
   member above its ceiling; there is no "max" button; `play_item`, presets without volumes, transfer and join never
   change a volume. MA's own `max_volume` scaling (if the installer set one) applies on top.
2. **Announcements** (only if approved): administrator presets only, no free text, no URLs; a device must be
   `announce_ok`; volume ≤ min(preset, ceiling, 60) and MA clamps again (`announce_volume_max`, default 75);
   confirmation with the count of rooms; rate limits §6.4; audited with the preset id (never the rendered text).
3. **Party**: ≥ 4 devices or more than one floor → confirmation; building-wide → `media.bulk`.
4. **Only server-listed items** are playable (`item_ref`), never a URL typed or pasted by a client.
5. **No MA token exists in 0.1.150**; if option B comes later the token lives in the secrets store, is never logged,
   never sent to a browser, and is rotated before its 1-year expiry.
6. **One authority per device**: approved speakers' entities are refused on the generic action path
   (`use_media_screen`, CR-015 §5.2 - the code already covers any approved kind); grouping never mixes MA and vendor.
7. **Honest outcomes**: join, group volume, presets and floor pause report per device (`joined`, `not_joined`,
   `skipped: muted|off|unavailable|ceiling`), never an optimistic "done".
8. **No retries or queued commands after a reconnect** (AGENTS.md); commands to an unavailable device are refused.

## 11. Events

`media_state` (CR-015 §11) now covers every approved kind; when a leader's `group_members` changes, the server also
recomputes and publishes each old and new member (the reverse index is rebuilt with `media_state`). No queue push
exists through HA: the panel refetches "up next" when `live.now.title` changes and every 30 s while open. New frame
`media_groups_changed` (no ids) after a preset change. `ATTR_ALLOW` += `media_artist`, `media_album_name`, `shuffle`,
`repeat` (`group_members`, `mass_player_type`, `active_queue` were added in 0.1.149).

## 12. API contract delta (summary; full types in MEDIA_PLAYERS_API.md)

| Method | Path | Auth |
|---|---|---|
| GET | `/multimedia/devices?kind=speaker,player,receiver,group` | `media.read` (existing route, new kinds) |
| POST | `/multimedia/devices/{key}/commands` (new commands §6.1) | as §6.1 |
| GET | `/multimedia/devices/{key}/up-next` | `media.read` + `caps.up_next` |
| GET | `/multimedia/devices/{key}/library?type=favourites|stations|playlists` | `media.read` + the cap |
| GET | `/multimedia/groups` | `media.read` |
| POST | `/multimedia/groups/join` · `/multimedia/groups/leave` | `media.group` + `media.control` per member |
| POST | `/multimedia/groups/{leader_key}/volume` | `media.group` |
| GET / POST / PUT / DELETE | `/multimedia/groups/presets[/{id}]` | read `media.read`; write `media.layout` |
| POST | `/multimedia/groups/presets/{id}/apply` | `media.group` |
| GET / POST | `/multimedia/actions/preview` · `/multimedia/actions` kind `players_pause` | `media.bulk` |
| GET / PUT | `/multimedia/favourites` (installation curation) | read `media.read`; write `media.layout` |
| GET / PUT | `/multimedia/admin/announce-presets` (only if approved) | `system.configure` |

## 13. Tests

- **Backend** (S1): `test_media_model.py` += audio kinds, `music` role, primaries per control, live/static group
  resolution, member → leader redirection; `test_media_players_commands.py` (every new command → exact service call;
  refusals: caps, unknown `item_ref`, off/unavailable, bridge < 0.5.0, rate limits, clamp to `volume_max`, `play_item`
  never touching volume); `test_media_groups.py` (authority rule, no mixing, party confirmation, building-wide needs
  `media.bulk`, per-member permission, join read-back outcomes, relative/absolute group volume math with ceilings and
  skips, presets revision 409 and diff apply); `test_media_query.py` (bridge read shapes trimmed, cache, item_ref HMAC,
  no URL leaves); `test_bridge_media_policy.py` += new services (URL media ids refused, `url` announcements refused,
  volume cap); `test_migrations.py`, `test_access.py` (new permissions), `test_media_api.py` (new routes × permission ×
  scope).
- **Frontend** (S2/S3): unit specs for group-volume ratio math, up-next states, join diff batching, player state text;
  evidence specs in demo mode at 1440/820/390 (loading, empty, error, ready, view-only, playing, grouped, member,
  static group, receiver, unavailable, not confirmed, partial group outcome), RTL.
- **Live** (S4): `media_fake_ha.py` += MA entities (speakers, a static MA group, a leader with members), WiiM through
  `linkplay` + its Cast + MA duplicates, an Onkyo receiver + Cast, fake `get_queue`/`get_library` responses, `join`
  that one device refuses; `evidence-media-players-live.spec.ts` (SW_LIVE=1): one card per speaker, now playing,
  transport confirms, group join with a `not_joined` member, group volume clamps, preset apply, floor pause skips.

## 14. Open risks

1. **Grouping semantics per integration** (WiiM via LinkPlay vs via MA, Cast without join, MA sync vs universal
   groups) are UNVERIFIED on the owner's hardware; mitigated by the one-authority rule, read-back outcomes and the
   manual `primary_json` override. First live round may need a fix pass.
2. **HA `volume_set` on an MA leader/group entity** may set member or group volume (UNVERIFIED); the fan-out avoids
   depending on it.
3. **`get_library` size and favourites semantics** (library flag in 2.10.4, per-user in 2.11): the owner may expect
   "his" favourites; the installation curation list mitigates.
4. **Stale MA entities** (many were `unavailable` in the inventory): unapproved by default; approval UI filters them.
5. **Bridge 0.5.0** must be installed before the new commands work; screens keep working meanwhile.
6. **Design**: the owner rejected a first baseline before (UniFi mandate); a quick players/groups mockup should be
   approved before S2/S3 start, or the calendar moves by a review round.
7. **Scope creep** toward option B (full queue, library search): kept as a separate decision so 0.1.150 stays short.
