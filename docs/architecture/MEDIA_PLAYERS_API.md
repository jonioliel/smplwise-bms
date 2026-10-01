# CR-016 Multimedia phase 2 ("נגנים ורמקולים · קבוצות") — API contract delta and work plan

Status: **ADOPTED CONTRACT for 0.1.150** (the owner's answers of 2026-10-01, CR §0; binding for S0-S4 once the mockup is
approved). Design: `docs/changes/CR-016-MEDIA-PLAYERS.md` ("the CR", § refs marked CR §n). Base contract:
`docs/architecture/MEDIA_API.md` (CR-015, "base §n") - everything there stays valid; this document only **adds**.
Connection model: Home Assistant only (CR §4, decision 1ג); the music layer is a capability of the best available entity
(MA, Sonos, HEOS - CR §5.2), so an installation **without** MA is served by the same routes; the direct Music Assistant
(MA) connection is **phase 2b** (§6). Live facts: the three probes of 2026-10-01 (CR §15). Precedence: this delta > the
CR > the mockup (`docs/design/mockups/media/players-index.html`).

## 1. Conventions (unchanged from base §1)

Router `routers/multimedia.py`, prefix `/api/v1`; `ApiError` with Hebrew messages; writes carry `client_request_id` and
`expires_at` (≤ 60 s); volume 0-100 on the wire; no entity id of a hidden endpoint, no MAC, no identifier, no IP, no HA
or MA URL, no MA uri, no MA config entry id in any response (library items travel as opaque `item_ref`).

## 2. Types (TypeScript mirror; the S0 client `frontend/src/api/media-players.ts` will be authoritative)

```ts
// base MediaKind already contains screen | speaker | player | receiver | group; 0.1.150 renders all of them (decision 2א,
// after approval) and adds three NON-PHYSICAL kinds that are hidden by default and never suggested for a merge (CR §5.1)
type MediaKind = 'screen' | 'speaker' | 'player' | 'receiver' | 'group' | 'session' | 'virtual_group' | 'service';
type MusicProvider = 'ma' | 'sonos' | 'heos' | 'vendor' | 'none';     // which layer answers the music controls (CR §5.2)
type EndpointRole = /* base */ 'vendor' | 'ma_native' | 'ma_export' | 'ma_import' | 'cast' | 'remote' | 'mirror'; // mirror: a poorer cloud twin, never primary
type RepeatMode = 'off' | 'one' | 'all';
type GroupRole = 'leader' | 'member' | 'none';

interface NowShowing /* base, extended */ {
  kind: 'app'|'source'|'channel'|'art'|'home'|'saver'|'none'|'music'|'station';
  artist: string | null; album: string | null;          // new; null for screens
  // title, position_s, duration_s, position_at, artwork, glyph, hue: unchanged; stations have duration_s null
}
interface LiveGroup { role: GroupRole; leader_key: string | null; member_keys: string[]; name: string | null;
  static: boolean /* true for a device of kind 'group' */;
  layer: 'ma' | 'vendor' | null;               // the one layer that answers grouping for this device (CR §5.3)
  conflict: boolean }                          // grouped in one layer and not the other -> "קיבוץ לא תואם", join disabled
interface MediaLive /* base, extended */ {
  shuffle: boolean | null; repeat: RepeatMode | null;
  group: LiveGroup;
  queue: { count: number; index: number | null } | null;   // from the last up-next read; null without caps.up_next
  caps_known: boolean;                          // false when no endpoint is available (CR §5.4): controls greyed, "לא זמין"
}
interface MediaCaps /* base, extended */ {
  shuffle: boolean; repeat: boolean; group: boolean; volume_group: boolean;
  up_next: boolean; favourites: boolean; stations: boolean; playlists: boolean; transfer: boolean;
}
interface MediaCan /* base, extended */ { group: boolean }
interface MediaDevice /* base, extended */ { floor_id: string | null; area_id: string | null;   // null = "לא משויכים" (CR §7.1)
  volume_max: number | null; volume_night: { from: string; to: string; max: number } | null;    // ceilings only when set (7ב)
  music_provider: MusicProvider;
  zones: { id: string; name: string; power: 'on'|'off'|'unknown'; volume: number | null; source_id: string | null; sound_mode: string | null }[] | null; // receivers with Main / Zone2 (CR §5.2)
  virtual_members: string[] | null }           // kind 'virtual_group' only: the helper's member keys (a shortcut, never joinable)
// commands on a multi-zone receiver carry `zone?: string` (default: the first zone); Zone2 accepts power / volume / mute / source / sound_output only

interface UpNext {                       // GET /multimedia/devices/{key}/up-next
  confirmed: boolean;                    // false: the read failed or is older than 10 s -> UI shows "לא זמין", never "empty"
  count: number | null; index: number | null; shuffle: boolean | null; repeat: RepeatMode | null;
  current: QueueEntry | null; next: QueueEntry | null; read_at: string | null;
}
interface QueueEntry { name: string; artist: string | null; album: string | null; duration_s: number | null }

type LibraryKind = 'favourites' | 'stations' | 'playlists';
interface LibraryItem { item_ref: string /* ^[a-f0-9]{24}$, server-issued, 30 min */; kind: 'track'|'album'|'artist'|'playlist'|'radio';
  name: string; artist: string | null; glyph: Glyph; hue: number | null }
interface LibraryPage { kind: LibraryKind; items: LibraryItem[]; curated: boolean; read_at: string; provider: MusicProvider }
// provider 'ma': MA get_library; 'sonos': the entity's favourites (source_list; playlists kind absent); 'none' -> 503 'no_library':
// the panel shows no library tabs, up-next "לא זמין" (CR §4.3). Without MA `UpNext.next` is null and only count / index are set.

interface MergeSuggestion {              // GET /multimedia/admin/suggestions (the merge wizard, CR §7.4)
  id: string; endpoint_id: string; device_key: string; rule: '3b' | '5b' | '5';
  reason: 'same_model' | 'same_name_area_one_side' | 'same_name_area'; endpoint_label: string; device_name: string }

interface MediaGroup {                    // GET /multimedia/groups
  leader_key: string; name: string; static: boolean; floor_ids: string[];
  members: { key: string; name: string; area_name: string | null; volume: number | null; muted: boolean | null; available: boolean }[];
  volume: number | null /* max of powered members, like MA */; can: { group: boolean; volume: boolean };
}
interface GroupPreset { id: string /* hex32 */; name: string; leader_key: string; member_keys: string[];
  volumes: Record<string, number> | null; revision: number; missing: string[] /* keys no longer approved */;
  running: { bulk_id: string; started_at: string } | null /* an apply in flight or finished < 30 s ago */ }

type MediaCommand /* base union, extended */ =
  | { command: 'seek'; position_s: number }
  | { command: 'shuffle'; on: boolean }
  | { command: 'repeat'; mode: RepeatMode }
  | { command: 'play_item'; item_ref: string; enqueue?: 'play' | 'next' | 'add' }
  | { command: 'transfer'; from_key: string };
  // no 'announce' (decision 6א)

interface GroupJoinBody { leader_key: string; member_keys: string[]; confirmed?: boolean; client_request_id: string; expires_at: string }
interface GroupLeaveBody { device_keys: string[]; client_request_id: string; expires_at: string }
interface GroupVolumeBody { level: number; mode: 'relative' | 'absolute'; client_request_id: string; expires_at: string }
type MemberOutcome = 'joined' | 'not_joined' | 'left' | 'set' | 'unknown'
  | 'skipped_muted' | 'skipped_off' | 'skipped_unavailable' | 'clamped' | 'not_allowed';
interface GroupRunResult { bulk_id: string; status: 'accepted' | 'refused'; preview?: GroupPreview }
interface GroupPreview { devices: number; floors: number; needs_confirmation: boolean; needs_bulk: boolean;
  members: { key: string; name: string; area_name: string | null; will: 'join' | 'leave' | 'stay' | 'skip'; reason: string | null }[] }

interface FavouritesCuration {            // GET / PUT /multimedia/favourites (one list for everyone, decision 5א)
  kinds_on: LibraryKind[]; items: { item_ref: string; hidden: boolean; order: number }[]; revision: number }
```

`GET /devices/actions/{bulk_id}` (existing) returns per-member records; for group kinds each record carries
`{ device_key, area_name, outcome: MemberOutcome, level?: number }` instead of an entity id - the UI names the room.

## 3. Routes (additions)

| # | Method | Path | Auth |
|---|---|---|---|
| 3.2' | GET | `/multimedia/devices?kind=speaker,player,receiver,group&floor=&area=&q=&state=` (`area=none` = unplaced) | `media.read` (kind list; default stays `screen`) |
| 3.4' | POST | `/multimedia/devices/{key}/commands` with the new commands | `media.control` (seek, shuffle, repeat, play_item, transfer at **both** anchors) |
| 3.16 | GET | `/multimedia/devices/{key}/up-next` | `media.read` + `caps.up_next` |
| 3.17 | GET | `/multimedia/devices/{key}/library?kind=favourites\|stations\|playlists&offset=` | `media.read` + the cap |
| 3.18 | GET | `/multimedia/groups` | `media.read` (groups with at least one visible member) |
| 3.19 | POST | `/multimedia/groups/join` (without `confirmed` and when a confirmation is needed: 409 `confirm_required` + `preview`) | `media.group` + `media.control` at every member's anchor |
| 3.20 | POST | `/multimedia/groups/leave` | `media.group` + `media.control` per device |
| 3.21 | POST | `/multimedia/groups/{leader_key}/volume` | `media.group` + `media.control` per member (members out of scope are `not_allowed`, not an error) |
| 3.22 | GET / POST | `/multimedia/groups/presets` | GET `media.read`; POST `media.layout` |
| 3.23 | PUT / DELETE | `/multimedia/groups/presets/{id}` (`base_revision`, 409 `revision_conflict`) | `media.layout` |
| 3.24 | POST | `/multimedia/groups/presets/{id}/apply` | as 3.19 |
| 3.25 | GET / PUT | `/multimedia/favourites` (`FavouritesCuration`, `base_revision`) | GET `media.read`; PUT `media.layout` |
| 3.9' | GET / POST | `/multimedia/actions/preview` · `/multimedia/actions` with `kind: "players_pause"` | `media.bulk` at the floor/area |
| 3.14' | PUT | `/multimedia/admin/devices/{key}` += `volume_max` (any kind), `volume_night`, `area_id` | `system.configure` (existing route) |
| 3.27 | GET | `/multimedia/admin/suggestions` (`MergeSuggestion[]`, the wizard's list; the existing `link` op with `op: link \| ignore` answers each row) | `system.configure` |
| 3.28 | GET | `/multimedia/admin/devices?kind=session,virtual_group,service` ("רכיבים לא פיזיים", hidden by default) | `system.configure` |

Removed from the proposal: `/multimedia/admin/announce-presets` (6א). `GET /multimedia/status` gains `can.group`,
`counts.players`, `counts.playing`, `counts.groups`, `counts.unplaced`, `counts.suggestions`, `floors: boolean` (false =
group by area), `bridge.players_ready` (paired bridge ≥ 0.5.0) and `library: { provider: MusicProvider; state: 'ready' |
'none' | 'unavailable' }` (MA config entry loaded / absent / not loaded; `sonos` when Sonos answers without MA).

### 3.x Errors (additions to base §3.4)

| HTTP | code | When |
|---|---|---|
| 409 | `confirm_required` | a join/preset reaching ≥ 4 devices or more than one floor without `confirmed: true` (body has `preview`) |
| 403 | `bulk_required` | a group spanning the whole building without `media.bulk` |
| 409 | `group_pending` | a join/leave/preset of this leader is in flight (≤ 8 s) |
| 422 | `not_groupable` | a member without the leader's grouping layer (MA vs vendor), without live `GROUPING`, Cast, already in another live group, or in a `conflict` state |
| 422 | `unknown_item` | `item_ref` unknown or expired (refetch the list) |
| 409 | `not_playing` | `transfer` from a device that is not playing |
| 503 | `no_library` | up-next / library / play_item / transfer while no MA config entry is loaded |
| 503 | `caps_unknown` | a command to a device whose endpoints are all unavailable (never guessed from a degraded mask) |
| 503 | `bridge_outdated` | new commands/reads with a bridge older than 0.5.0 (`required: "0.5.0"`) |
| 429 | `rate_limited` | CR §6.4 |

### 3.y HA calls behind the routes (all through the signed bridge, caller's HA context)

| Route / command | Call | Bridge policy (0.5.0) |
|---|---|---|
| seek / shuffle / repeat | `media_player.media_seek` / `shuffle_set` / `repeat_set` | numeric/enum only; target has the live flag |
| play_item | `music_assistant.play_media {media_id: <stored uri>, media_type, enqueue}` | type ∈ 5; id not `http(s)`/`file`/path |
| transfer | `music_assistant.transfer_queue {entity_id: target, source_player, auto_play: true}` | both `music_assistant` entities |
| join / leave | `media_player.join {group_members}` on the leader / `media_player.unjoin` per device (the music layer: MA, Sonos or HEOS entity; never a helper, a mirror or Cast) | members are `media_player` entities of the leader's layer; leader has `GROUPING` |
| play_item without MA | `media_player.select_source {source}` on the Sonos entity (its favourites list) | source must be in the entity's `source_list` |
| zone commands | the zone's own `denonavr` entity (`turn_on/off`, `volume_set`, `select_source`, `select_sound_mode`) | entity belongs to the device's `zones` |
| group volume, preset volumes | `media_player.volume_set` per member (clamped only where a ceiling is set) | unchanged |
| up-next / library | `smplwise_bridge.media_query {query: queue\|library, ...}` → `get_queue` / `get_library` (`return_response`; `config_entry_id` resolved **inside the bridge**, never a parameter) | read-only, fixed arguments, trimmed response |
| place a device | the existing `smplwise_bridge.set_entity_area {entity_id, area_id}` (CR-007; no separate `entity_area` service exists) | admin-only route (`PUT admin/devices/{key}` `area_id`); the area must exist; two-phase audit `media.place` |

`music_assistant.play_announcement` is not allow-listed and `media_player.play_media` with `announce` is refused (6א).
Never allow-listed: `heos.sign_in` / `sign_out`, `sonos.update_alarm`, `group.set` / `remove` / `reload`,
`denonavr.get_command` / `set_dynamic_eq` / `update_audyssey`, `jellyfin.*`, `cast.show_lovelace_view`.

### 3.z Reconciliation of the contract with the implementation (integration 0.1.150)

Where S1 built something the first text of this document did not say (the S0 client and its mock follow the server, not the other way round):

| Subject | As built |
|---|---|
| `live.group.member_keys` | the group's OTHER devices: the leader is `leader_key` and is never listed; the same list on every device of the group, filtered by the caller's scope; a static group (kind `group`) lists its children. A client may still read a list that holds the leader (`liveGroupKeys` handles both). `MediaGroup.members` (the groups list) DOES include the leader. |
| List envelopes | `{devices}`, `{groups}`, `{presets}`, `{suggestions}` (a bare array is never sent) |
| Saved groups | `member_keys` are the OTHER rooms (at most 15; the leader in the list is 422 `validation`); `volumes` may name the leader and the members |
| Merge wizard | `GET admin/suggestions` -> `{suggestions}`. "אחד" is `POST admin/links {op: "link", endpoint_id, device_key}` (the endpoint moves WITH its cluster); "התעלם" is `{op: "ignore", endpoint_id, device_key}` (the row's device: dismisses that suggestion only). A plain `ignore` without `device_key` keeps its CR-015 meaning (the endpoint leaves every device). The answer is `{devices}` (the admin list) |
| Approval | `POST admin/approve {device_keys?, approved?, kinds?}`: `kinds` (speaker, player, receiver, group) without `device_keys` approves every detected device of those kinds ("אשר את כל הנגנים שזוהו"); the answer adds `approved_players` / `pending_players` |
| Placing a device | `PUT admin/devices/{key} {area_id}` goes through the existing `smplwise_bridge.set_entity_area` (no separate service) |
| Endpoint rungs in the admin list | `device` (same HA device), `ma`, `2b`, `2c`, `3b`, `identifier`, `mac`, `manual`; the music-layer twin of a speaker has role `music` and is hidden; a cloud twin has role `mirror` and is hidden |
| `GroupPreview` | `{devices: <count>, floors: <count>, needs_confirmation, needs_bulk, members: [{key, name, will, reason}]}` (409 `confirm_required` carries it at the top level of the body and in `details.preview`) |
| Floor "עצור מוזיקה" | `GET actions/preview?kind=players_pause&scope&id` -> `{scope, id, label, counts: {send, not_playing, unavailable, not_allowed}, devices: [{key, name, will: pause\|skip, reason}]}`; the run is `POST actions {kind: "players_pause", confirmed: true, ...}` |
| A group record | `GET devices/actions/{bulk_id}` -> `{id, status: queued\|waiting\|done, done, items: [{device_key, name, area_name, will, outcome, level?, volume_outcome?}]}`. It is final only when `done` is true. A `will: skip` row (a room that was not playing, was muted, off or unavailable) is not a failure of a pause |
| `play_item` | `enqueue` is passed through (`play` \| `next` \| `add`) with Music Assistant; a Sonos favourite is started with `select_source` only (`next` / `add` are 422 `not_supported`) |
| Library | `GET devices/{key}/library?kind=&offset=&all=1`: `all=1` (a holder of media.layout) adds the hidden items with `hidden: true`. The status `library.state` becomes `unavailable` after the bridge answered `no_library` for a Music Assistant player (the library read itself may still be served from its 5-minute cache) |
| Curation names | `GET favourites` carries `name`, `artist` and `kind` of every curated item (hidden ones too) to a holder of media.layout, where the server knows them |
| Layout `tabs` | `tabs.players` / `tabs.groups`: `{group_by, floor_order, pinned, order, cards: {key: {on, size, phone_on, phone_size}}}` - the server fills `floor_order` and each card's size / phone fields on write; the client sends and reads what it needs (`on`) |
| Zone commands | gated by THAT zone's power (`Main` on does not make `Zone2` "already on") |
| Power | a Cast entity is never a power control: a Cast-only speaker is `on` while it is reachable and `off` (asleep) when it is not, with neither `caps.power_on` nor `caps.power_off` (`power_on` -> 422 `already_on` / `not_supported`); the UI draws no power button for such a device |
| Up next of a member | resolves to its leader on the server; a client may pass either key |
| `media_state` frames | carry the extended player shape (`PlayerLive`) for every non-screen kind; the members of a group are republished when its leader's membership changes |
| Helper groups (`virtual_group`) | have no device card and no command route (404); the groups tab lists them as shortcuts, and their play / pause is a fan-out of ordinary transport commands to the leaders of their rooms; their volume is `POST groups/{key}/volume` |

## 4. Events

`/ha/ws`: `media_state` for every approved kind (payload unchanged, `live` extended); member devices republished when a
leader's membership changes; `media_devices_changed` reasons += `groups`, `placed`; new `media_groups_changed` (no ids)
after a saved-group or curation change. No queue event exists through HA (CR §11).

## 5. Parallel work plan

Same rules as base §5: agents branch from the architect branch (or `g0/intake` after 0.1.149 and this CR merge);
Python `C:\cloude\smplwisebms\.venv\Scripts\python.exe`, pytest workers=1, targeted files only; Node per CLAUDE.md with
a `node_modules` junction; nobody bumps versions or edits CHANGELOG, `management/*`, `contracts/API_INVENTORY.md`,
this document or the S0 client; `bash C:/cloude/smplwisebms/secrets/scan_staged.sh` before each commit; never read
`secrets/` or `private-evidence/`; no device, HA, MA or lab contact. Models: Sonnet for S1-S4 (the owner's rule:
Sonnet where enough), Opus for the review of the command/bridge path. **Prerequisite:** 0.1.149 (CR-015) merged into
`g0/intake`, because every stream edits its files.

### P0 — mockup (done) and S0 client (coordinator; before S1-S4)

```
Mockup: docs/design/mockups/media/players-index.html (this commit) - players tab, groups tab, player panel with per-room
  volume, saved groups, states (nothing playing, no library, unavailable, unplaced, view-only, rate-limited, join failed,
  group conflict), area section with speakers next to TVs, the settings sections; 1440 / 390, light / dark; evidence in
  docs/evidence/media-players-mockup/. Awaiting the owner's review.
S0: frontend/src/api/media-players.ts (types §2, adapter, pure helpers: groupVolumePlan(relative/absolute, ceilings only
  where set, night window), joinDiff, upNextText, playerStateText, unplacedBucket) + media-players-mock.ts (the fixture
  set of S4 in miniature: the probe's platform mix) + unit-media-players.spec.ts.
Estimate: S0 3-4 h (mockup spent: ~4 h).
```

### S1 — backend: model, commands, groups, bridge 0.5.0, migration (`pilot/CR016-s1-backend`)

```
Goal: CR §4.3, §5, §6, §8-§11 and this contract §2-§4 on the server.
Owns: services/media_model.py (audio kinds + session / virtual_group / service, the `music` layer by flags with
  music_provider, `mirror` role, receiver zones, primaries per control, live group resolution = union of group_members +
  active_queue with one layer per device + conflict, caps from an available endpoint + last good mask, rungs 2b / 2c /
  3b / 5b, unplaced bucket, floors-less grouping),
  services/media_groups.py (new: layer rule, candidates, join diff, read-back outcomes, group volume plan with optional
  ceilings and skips, presets), services/media_query.py (new: bridge read, caches, item_ref HMAC, no_library, the Sonos
  favourites provider without MA), routers/multimedia.py admin suggestions (3.27) and non-physical list (3.28),
  media_commands.py (seek, shuffle, repeat, play_item, transfer; member -> leader redirection; night-window clamp;
  limits), media_store.py (kind filters generalised from 'screen' to the rendered kinds, reverse member index, status
  counts, last_features_json), routers/multimedia.py (routes 3.16-3.25, 3.2', 3.4', 3.9', 3.14'), migration
  0044_media_players.sql, custom_components/smplwise_bridge/media_policy.py + media_query + entity_area services and the
  config-entry discovery (0.5.0) then scripts/sync_integration.py; tests/test_media_players_commands.py,
  test_media_groups.py, test_media_query.py, and additions to test_media_model.py, test_media_api.py,
  test_bridge_media_policy.py.
Touches (sole editor): roles.json, routers/access.py, role-catalog.design.json (media.group), services/ha_bridge.py
  (ACTIONS), ha_sync.py (ATTR_ALLOW += media_artist, media_album_name, shuffle, repeat; member republish; hidden_by
  honoured, config-entry-disabled skipped), device_bulk.py (kinds players_pause, group_join, group_leave, group_volume
  through the media resolver), routers/settings.py (multimedia.favourites).
Done: every route, command and error code tested; no URL media id reachable; no volume above a ceiling that is set, no
  clamp where none is set; join outcomes honest; screens' behaviour unchanged (CR-015 tests green); migration up on a
  0.1.149 DB copy.
Estimate: 26-32 agent-hours (was 20-26: + rungs 2b/2c/3b/5b, the music layer by flags with the Sonos provider, zones,
  non-physical kinds, union grouping, caps fallback, night window, entity_area, suggestions route; - announcements).
```

### S2 — frontend: tabs, players and groups pages, cards, settings (`pilot/CR016-s2-pages`)

```
Goal: CR §7.1, §7.3, §7.4.
Owns: screens/multimedia-players.ts (floor sections + "לא משויכים"), screens/multimedia-groups.ts (live groups, static
  groups, saved groups with "הפעל" and the running / per-room outcome state, editor for media.layout holders),
  components/media-player-card.ts (<media-player-card .device .size .compact @open-player>), the group confirmation
  dialog (reuse media-bulk-dialog.ts patterns), screens/system-multimedia.ts sections (players & speakers with kind /
  approval / room / linked amplifier / ceiling / night window, the merge wizard fed by 3.27, the folded non-physical
  list, saved groups CRUD, favourites curation, connection status with / without MA, permissions line); floors-less
  grouping by area; specs unit-media-players-layout.spec.ts, evidence-media-players.spec.ts (demo; 1440/820/390; every
  state; both fixture houses; RTL), evidence-system-multimedia.spec.ts additions.
Touches (sole editor): screens/multimedia-screens.ts (tab row only), multimedia-layout.ts + multimedia-edit-panel.ts
  (per-tab order/pinned), shell/nav.ts + sw-app.ts (routes #/multimedia/players, #/multimedia/groups), api/ha.ts
  (media_groups_changed), api/media-admin.ts (volume_night, area_id, presets, curation).
Done: no brand/HA names or hints on operator screens (settings keep technical names); tsc clean; specs run and reported.
Estimate: 20-24 agent-hours (was 16-20: + the settings sections the owner asked for, the merge wizard, floors-less).
```

### S3 — frontend: the player panel, area card, home widget (`pilot/CR016-s3-panel`)

```
Goal: CR §7.2, §7.3 (area card, widget).
Owns: components/media-player-panel.ts (in the existing drawer: artwork + now playing + progress interpolation,
  seek, transport, shuffle/repeat, volume + "לפי חדר" pop-out with per-room outcome, up next with "לא זמין" state,
  favourites/stations/playlists tabs (absent without a library; playlists absent with the Sonos provider), group section
  with 500 ms batched join diff and the confirmation, conflict state, transfer (MA only); receiver variant without keys
  and with a zone switch; off / unavailable / view-only),
  media-player-volume.ts (group slider relative/absolute, clamp display only where a ceiling is set);
  screens/devices-media-card.ts (non-screen devices via <media-player-card>, speakers next to TVs), home widget 'media'
  counts; specs unit-media-player-panel.spec.ts, evidence-media-player-panel.spec.ts (demo; 1440/820/390; playing,
  station, member, leader, static group, receiver, off, unavailable, not confirmed, partial group outcome, no library,
  view-only).
Touches: components/media-remote.ts (open the player panel for non-screen kinds: one routing line), home-widgets.ts.
Done: nothing rendered that caps do not allow; controls greyed with caps_known false; tsc clean; specs run and reported.
Estimate: 18-24 agent-hours.
```

### S4 — live fixture, evidence, user guide (`pilot/CR016-s4-evidence`)

```
Goal: CR §13 live part and the guide.
Owns: frontend/tests/fixtures/media_fake_ha.py with TWO fixture houses mirroring the probes (CR §13): the MA house (MA
  speakers incl. unavailable `restored` ones with a degraded mask, unplaced ones, a WiiM pair grouped in both layers, a
  Cast + MA pair, a Denon receiver Main / Zone2 + HEOS + MA, a cross-brand MA sync group with inconsistent
  group_members, model-number names, hidden cast entities) and the no-MA house (six Sonos with SmartThings mirrors,
  Jellyfin sessions sharing a name, two `group` helpers, a Spotify source, no floors); get_queue / get_library fake
  responses served by the fake bridge's media_query, a join one device refuses, volume effects;
  evidence-media-players-live.spec.ts (SW_LIVE=1), docs/user-guide/he/42-multimedia_HE.md players/groups sections,
  screens.json.
Done: live spec green on a throwaway backend (never the lab); screenshots to docs/design/evidence/CR-016/; guide says
  "תשתית המערכת", never HA/MA names on operator text.
Estimate: 12-16 agent-hours (was 10-14: the second fixture house).
```

### 5.1 Merge order and review

S1 → S2 → S3 → S4, then an **Opus review** of the command path (media_commands additions, media_groups.py,
media_query.py, ha_bridge ACTIONS, the bridge's media_policy, media_query, entity_area and config-entry discovery,
device_bulk group kinds) with fixes by S1 (4-6 h), integration and the full suite in the release round (2-3 h). S2/S3 work
on the mock and are harmless before S1 (the tabs are gated on data the server does not return yet).

### 5.2 Totals, calendar and what could make it long

| Item | Agent-hours (same unit as base §5.2) |
|---|---|
| P0 mockup (spent) + S0 client | 5 + 3-4 |
| S1 backend + bridge | 26-32 |
| S2 pages + settings | 20-24 |
| S3 panel + area card + widget | 18-24 |
| S4 two fixture houses + evidence + guide | 12-16 |
| Opus review + fixes, integration | 6-9 |
| **Total 0.1.150 (HA only, adopted; three probed houses served)** | **90-114** (CR-015 was estimated at 92-116; the first estimate of this CR was 76-101 before the probes) |
| Phase 2b later (direct MA client + full queue with drag/delete + library browse/search + fake MA server + second review) | +28-38 (was +24-34: + the full library the owner chose in 4ג) |

**Calibration, honestly.** The agent-hour figures are nominal effort, not wall-clock. For CR-015 the git timestamps show
the contract commit at 22:30, all four stream branches committed by 23:47, the integration branch at 00:06 and the
review fixes at 00:46 - about **2.5 hours of wall-clock** for a 92-116 agent-hour estimate with four parallel agents.
The wall-clock of 0.1.150 is therefore dominated by the owner's mockup review, the release round (one or two a day, on
his word) and the first live round, not by coding. Migration number: **0044** (0043 is `camera_wall_hidden`).

| Case | Calendar (4 parallel Sonnet agents + integration + Opus review) | What it assumes |
|---|---|---|
| **Best** | **same day as the mockup approval** (≈ 6-7 h wall: S0 1 h, S1-S4 ≈ 2.5-3 h, review + fixes ≈ 1 h), shipped in that evening's release round | the owner approves the mockup as is; the fake houses match the real integrations; the remaining manual links are made by the owner in the wizard |
| **Likely** | **2 days** | one mockup revision, then one live round on **two** of the owner's systems (an MA house and the Sonos house) surfaces 2-4 differences (join on the MA layer, cross-brand membership, Sonos favourites shape, Denon zones) fixed in the next release round |
| **Worst** | **4 days** | grouping semantics differ per layer and need a second live round, the model rung mis-merges on real model strings, or the owner pulls phase 2b forward (then +28-38 agent-hours and the MA account / token / port questions) |

What keeps it short: the model, the dedupe ladder, the command path, the bridge policy style, permissions, drawer,
layout editor, area card, home widget, bulk engine and artwork proxy are reused (CR §3); HA already exposes the MA
features we need; no new secret; the three probes replaced guesswork about the owner's inventories. What could make it
long: grouping behaviour that only a service call reveals, real-name / real-model dedupe, and any move of phase 2b into
0.1.150. What the probes added to the bill (+9-13 agent-hours): the Sonos provider, zones, non-physical kinds, the
merge wizard and a second fixture house - the price of serving a house without MA from day one.

### 5.3 Definition of done (every agent)

As base §5.3: targeted tests actually run and reported (NOT_RUN is not PASS); screenshots at 1440/820/390 with
loading/empty/error/ready; no brand or HA/MA names on operator screens; no secrets, lab data or real identifiers in
fixtures; commit on the agent's own branch with the CLAUDE.md trailer; a closing report per AGENTS.md.

## 6. Phase 2b (direct MA connection) - reserved, not in 0.1.150

Shaped now so it drops in later (CR §4.4):

| Reserved | Shape |
|---|---|
| `GET /multimedia/devices/{key}/queue?offset=&limit=` | `{ confirmed, count, index, locked_to: number, items: (QueueEntry & { item: string /* opaque */; locked: boolean })[] }` |
| commands `queue_move {item, to}`, `queue_delete {item}`, `queue_clear` | `media.control`; refused on `locked` rows |
| `GET /multimedia/devices/{key}/library?kind=browse&path=` and `?kind=search&q=` | `LibraryPage` with `folders: {path, name}[]`; permission `media.browse` (created then) |
| `POST /multimedia/groups/{leader_key}/volume` mode `ma` | MA `group_volume`, balance kept by MA |
| `MediaCaps.can_group_with: string[]` | from MA `can_group_with` |
| service `services/ma_client.py` | one backend WebSocket, `user` account with `player_filter`, token in the secrets store, reconnect 1 s × 1.5 capped at 30 s, schema gate ≥ 65, fake MA server for tests |

Prerequisites from the owner: the MA account and token, port 8095 reachability from the add-on container, and his word
that the step starts.
