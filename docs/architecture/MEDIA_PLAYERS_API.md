# CR-016 Multimedia phase 2 ("נגנים ורמקולים · קבוצות") — API contract delta and work plan

Status: **PROPOSED CONTRACT for 0.1.150** (becomes binding when the owner approves CR-016). Design:
`docs/changes/CR-016-MEDIA-PLAYERS.md` ("the CR", § refs marked CR §n). Base contract: `docs/architecture/MEDIA_API.md`
(CR-015, "base §n") - everything there stays valid; this document only **adds**. Connection model: Home Assistant only
(CR §4); no direct Music Assistant (MA) connection in 0.1.150. Precedence: this delta > the CR's proposals > the mockup.

## 1. Conventions (unchanged from base §1)

Router `routers/multimedia.py`, prefix `/api/v1`; `ApiError` with Hebrew messages; writes carry `client_request_id` and
`expires_at` (≤ 60 s); volume 0-100 on the wire; no entity id of a hidden endpoint, no MAC, no identifier, no IP, no HA
or MA URL, no MA uri in any response (library items travel as opaque `item_ref`).

## 2. Types (TypeScript mirror; the S0 client `frontend/src/api/media-players.ts` will be authoritative)

```ts
// base MediaKind already contains all five kinds; 0.1.150 renders all of them
type RepeatMode = 'off' | 'one' | 'all';
type GroupRole = 'leader' | 'member' | 'none';

interface NowShowing /* base, extended */ {
  kind: 'app'|'source'|'channel'|'art'|'home'|'saver'|'none'|'music'|'station';
  artist: string | null; album: string | null;          // new; null for screens
  // title, position_s, duration_s, position_at, artwork, glyph, hue: unchanged
}
interface LiveGroup { role: GroupRole; leader_key: string | null; member_keys: string[]; name: string | null;
  static: boolean /* true for a device of kind 'group' */ }
interface MediaLive /* base, extended */ {
  shuffle: boolean | null; repeat: RepeatMode | null;
  group: LiveGroup;
  queue: { count: number; index: number | null } | null;   // from the last up-next read; null without caps.up_next
}
interface MediaCaps /* base, extended */ {
  shuffle: boolean; repeat: boolean; group: boolean; volume_group: boolean;
  up_next: boolean; favourites: boolean; stations: boolean; playlists: boolean; transfer: boolean; announce: boolean;
}
interface MediaCan /* base, extended */ { group: boolean; announce: boolean }

interface UpNext {                       // GET /multimedia/devices/{key}/up-next
  confirmed: boolean;                    // false: the read failed or is older than 10 s -> UI shows "לא זמין", never "empty"
  count: number | null; index: number | null; shuffle: boolean | null; repeat: RepeatMode | null;
  current: QueueEntry | null; next: QueueEntry | null; read_at: string | null;
}
interface QueueEntry { name: string; artist: string | null; album: string | null; duration_s: number | null }

type LibraryKind = 'favourites' | 'stations' | 'playlists';
interface LibraryItem { item_ref: string /* ^[a-f0-9]{24}$, server-issued, 30 min */; kind: 'track'|'album'|'artist'|'playlist'|'radio';
  name: string; artist: string | null; glyph: Glyph; hue: number | null }
interface LibraryPage { kind: LibraryKind; items: LibraryItem[]; curated: boolean; read_at: string }

interface MediaGroup {                    // GET /multimedia/groups
  leader_key: string; name: string; static: boolean; floor_ids: string[];
  members: { key: string; name: string; volume: number | null; muted: boolean | null; available: boolean }[];
  volume: number | null /* max of powered members, like MA */; can: { group: boolean; volume: boolean };
}
interface GroupPreset { id: string /* hex32 */; name: string; leader_key: string; member_keys: string[];
  volumes: Record<string, number> | null; revision: number; missing: string[] /* keys no longer approved */ }

type MediaCommand /* base union, extended */ =
  | { command: 'seek'; position_s: number }
  | { command: 'shuffle'; on: boolean }
  | { command: 'repeat'; mode: RepeatMode }
  | { command: 'play_item'; item_ref: string; enqueue?: 'play' | 'next' | 'add' }
  | { command: 'transfer'; from_key: string }
  | { command: 'announce'; preset_id: string };        // only when announcements are approved

interface GroupJoinBody { leader_key: string; member_keys: string[]; confirmed?: boolean; client_request_id: string; expires_at: string }
interface GroupLeaveBody { device_keys: string[]; client_request_id: string; expires_at: string }
interface GroupVolumeBody { level: number; mode: 'relative' | 'absolute'; client_request_id: string; expires_at: string }
type MemberOutcome = 'joined' | 'not_joined' | 'left' | 'set' | 'unknown'
  | 'skipped_muted' | 'skipped_off' | 'skipped_unavailable' | 'clamped' | 'not_allowed';
interface GroupRunResult { bulk_id: string; status: 'accepted' | 'refused'; preview?: GroupPreview }
interface GroupPreview { devices: number; floors: number; needs_confirmation: boolean; needs_bulk: boolean;
  members: { key: string; name: string; will: 'join' | 'leave' | 'stay' | 'skip'; reason: string | null }[] }
```

`GET /devices/actions/{bulk_id}` (existing) returns per-member records; for group kinds each record carries
`{ device_key, outcome: MemberOutcome, level?: number }` instead of an entity id.

## 3. Routes (additions)

| # | Method | Path | Auth |
|---|---|---|---|
| 3.2' | GET | `/multimedia/devices?kind=speaker,player,receiver,group&floor=&area=&q=&state=` | `media.read` (kind list; default stays `screen`) |
| 3.4' | POST | `/multimedia/devices/{key}/commands` with the new commands | `media.control` (seek, shuffle, repeat, play_item, transfer at **both** anchors); `media.announce` (announce) |
| 3.16 | GET | `/multimedia/devices/{key}/up-next` | `media.read` + `caps.up_next` |
| 3.17 | GET | `/multimedia/devices/{key}/library?kind=favourites\|stations\|playlists&offset=` | `media.read` + the cap |
| 3.18 | GET | `/multimedia/groups` | `media.read` (groups with at least one visible member) |
| 3.19 | POST | `/multimedia/groups/join` (without `confirmed` and when a confirmation is needed: 409 `confirm_required` + `preview`) | `media.group` + `media.control` at every member's anchor |
| 3.20 | POST | `/multimedia/groups/leave` | `media.group` + `media.control` per device |
| 3.21 | POST | `/multimedia/groups/{leader_key}/volume` | `media.group` + `media.control` per member (members out of scope are `not_allowed`, not an error) |
| 3.22 | GET / POST | `/multimedia/groups/presets` | GET `media.read`; POST `media.layout` |
| 3.23 | PUT / DELETE | `/multimedia/groups/presets/{id}` (`base_revision`, 409 `revision_conflict`) | `media.layout` |
| 3.24 | POST | `/multimedia/groups/presets/{id}/apply` | as 3.19 |
| 3.25 | GET / PUT | `/multimedia/favourites` (installation curation `{ items: [{item_ref, hidden, order}] , kinds_on: LibraryKind[] }`) | GET `media.read`; PUT `media.layout` |
| 3.26 | GET / PUT | `/multimedia/admin/announce-presets` (≤ 10) | `system.configure` (only if announcements approved) |
| 3.9' | GET / POST | `/multimedia/actions/preview` · `/multimedia/actions` with `kind: "players_pause"` | `media.bulk` at the floor/area |

`GET /multimedia/status` gains `can.group`, `can.announce`, `counts.players`, `counts.playing`, `counts.groups`, and
`bridge.players_ready` (paired bridge ≥ 0.5.0). `PUT /multimedia/admin/devices/{key}` accepts `announce_ok` and
`favourites` (per-device curation).

### 3.x Errors (additions to base §3.4)

| HTTP | code | When |
|---|---|---|
| 409 | `confirm_required` | a join/preset reaching ≥ 4 devices or more than one floor without `confirmed: true` (body has `preview`) |
| 403 | `bulk_required` | a group spanning the whole building without `media.bulk` |
| 409 | `group_pending` | a join/leave/preset of this leader is in flight (≤ 8 s) |
| 422 | `not_groupable` | a member without the leader's grouping authority (MA vs vendor), Cast, or already in another live group |
| 422 | `unknown_item` | `item_ref` unknown or expired (refetch the list) |
| 409 | `not_playing` | `transfer` from a device that is not playing |
| 503 | `bridge_outdated` | new commands/reads with a bridge older than 0.5.0 (`required: "0.5.0"`) |
| 429 | `rate_limited` | CR §6.4 |

### 3.y HA calls behind the routes (all through the signed bridge, caller's HA context)

| Route / command | Call | Bridge policy (0.5.0) |
|---|---|---|
| seek / shuffle / repeat | `media_player.media_seek` / `shuffle_set` / `repeat_set` | numeric/enum only |
| play_item | `music_assistant.play_media {media_id: <stored uri>, media_type, enqueue}` | type ∈ 5; id not `http(s)`/`file`/path |
| transfer | `music_assistant.transfer_queue {entity_id: target, source_player, auto_play: true}` | both `music_assistant` entities |
| join / leave | `media_player.join {group_members}` on the leader / `media_player.unjoin` per device | members are `media_player` entities |
| group volume, preset volumes | `media_player.volume_set` per member (clamped) | unchanged |
| announce | `music_assistant.play_announcement {message, tts_entity_id, announce_volume}` | no `url`; message ≤ 200; volume ≤ 60 |
| up-next / library | `smplwise_bridge.media_query {query: queue|library, ...}` → `get_queue` / `get_library` | read-only, fixed arguments, trimmed response |

## 4. Events

`/ha/ws`: `media_state` for every approved kind (payload unchanged, `live` extended); member devices republished when a
leader's membership changes; `media_devices_changed` reasons += `groups`; new `media_groups_changed` (no ids) after a
preset change. No queue event exists through HA (CR §11).

## 5. Parallel work plan

Same rules as base §5: agents branch from the architect branch (or `g0/intake` after 0.1.149 and this CR merge);
Python `C:\cloude\smplwisebms\.venv\Scripts\python.exe`, pytest workers=1, targeted files only; Node per CLAUDE.md with
a `node_modules` junction; nobody bumps versions or edits CHANGELOG, `management/*`, `contracts/API_INVENTORY.md`,
this document or the S0 client; `bash C:/cloude/smplwisebms/secrets/scan_staged.sh` before each commit; never read
`secrets/` or `private-evidence/`; no device, HA, MA or lab contact. Models: Sonnet for S1-S4 (the owner's rule:
Sonnet where enough), Opus for the review of the command/bridge path. **Prerequisite:** 0.1.149 (CR-015) merged into
`g0/intake`, because every stream edits its files.

### P0 — mockup and S0 client (coordinator; before S1-S4)

```
Goal: a players/groups mockup in the approved glass language (players tab, groups tab, player panel with members
  pop-out, preset card, receiver panel; 1440/390) for the owner's review with players-decisions-HE.md; then the S0
  client frontend/src/api/media-players.ts (types §2, adapter, pure helpers: groupVolumePlan(relative/absolute,
  ceilings), joinDiff, upNextText, playerStateText) + media-players-mock.ts (the fixture set of S4 in miniature) +
  unit-media-players.spec.ts.
Estimate: mockup 3-4 h, S0 3-4 h.
```

### S1 — backend: model, commands, groups, bridge 0.5.0, migration (`pilot/CR016-s1-backend`)

```
Goal: CR §4.3, §5, §6, §8-§11 and this contract §2-§4 on the server.
Owns: services/media_model.py (audio kinds, `music` role, primaries per control, live group resolution, caps/live
  additions), services/media_groups.py (new: authority rule, candidates, join diff, read-back outcomes, group volume
  plan with ceilings and skips, presets), services/media_query.py (new: bridge read, caches, item_ref HMAC),
  media_commands.py (seek, shuffle, repeat, play_item, transfer, announce; member -> leader redirection; limits),
  media_store.py (kind filters generalised from 'screen' to the rendered kinds, reverse member index, status counts),
  routers/multimedia.py (routes 3.16-3.26, 3.2', 3.4', 3.9'), migration 0044_media_players.sql,
  custom_components/smplwise_bridge/media_policy.py + media_query service (0.5.0) then scripts/sync_integration.py;
  tests/test_media_players_commands.py, test_media_groups.py, test_media_query.py, and additions to test_media_model.py,
  test_media_api.py, test_bridge_media_policy.py.
Touches (sole editor): roles.json, routers/access.py, role-catalog.design.json (media.group, media.announce),
  services/ha_bridge.py (ACTIONS), ha_sync.py (ATTR_ALLOW += media_artist, media_album_name, shuffle, repeat;
  member republish), device_bulk.py (kinds players_pause, group_join, group_leave, group_volume through the media
  resolver), routers/settings.py (multimedia.favourites, multimedia.announce_presets).
Done: every route, command and error code tested; no URL media id reachable; volume never above a ceiling; join
  outcomes honest; screens' behaviour unchanged (CR-015 tests green); migration up on a 0.1.149 DB copy.
Estimate: 20-26 agent-hours.
```

### S2 — frontend: tabs, players and groups pages, cards, settings (`pilot/CR016-s2-pages`)

```
Goal: CR §7.1, §7.3, the settings additions (approve players, announce_ok, favourites curation, presets admin).
Owns: screens/multimedia-players.ts, screens/multimedia-groups.ts (live groups, static groups, presets with "הפעל",
  preset editor), components/media-player-card.ts (<media-player-card .device .size .compact @open-player>), the
  group confirmation dialog (reuse media-bulk-dialog.ts patterns), screens/system-multimedia.ts additions; specs
  unit-media-players-layout.spec.ts, evidence-media-players.spec.ts (demo; 1440/820/390; every state; RTL).
Touches (sole editor): screens/multimedia-screens.ts (tab row only), multimedia-layout.ts + multimedia-edit-panel.ts
  (per-tab order/pinned), shell/nav.ts + sw-app.ts (routes #/multimedia/players, #/multimedia/groups), api/ha.ts
  (media_groups_changed).
Done: no brand/HA names or hints on operator screens; tsc clean; specs run and reported.
Estimate: 16-20 agent-hours.
```

### S3 — frontend: the player panel, area card, home widget (`pilot/CR016-s3-panel`)

```
Goal: CR §7.2, §7.3 (area card, widget).
Owns: components/media-player-panel.ts (in the existing drawer: artwork + now playing + progress interpolation,
  transport, seek, shuffle/repeat, volume + members pop-out with per-room outcome, up next with "לא זמין" state,
  favourites/stations/playlists tabs, group section with 500 ms batched join diff, transfer; receiver variant without
  keys), media-player-volume.ts (group slider relative/absolute, clamp display); screens/devices-media-card.ts (non-
  screen devices via <media-player-card>), home widget 'media' counts; specs unit-media-player-panel.spec.ts,
  evidence-media-player-panel.spec.ts (demo; 1440/820/390; playing, member, leader, static group, receiver, off,
  unavailable, not confirmed, partial group outcome, view-only).
Touches: components/media-remote.ts (open the player panel for non-screen kinds: one routing line), home-widgets.ts.
Done: nothing rendered that caps do not allow; no volume control above the ceiling; tsc clean; specs run and reported.
Estimate: 18-24 agent-hours.
```

### S4 — live fixture, evidence, user guide (`pilot/CR016-s4-evidence`)

```
Goal: CR §13 live part and the guide.
Owns: frontend/tests/fixtures/media_fake_ha.py additions (MA speakers incl. unavailable stale ones, a static MA group,
  a leader with members, WiiM via linkplay + Cast + MA duplicates, Onkyo + Cast, get_queue/get_library fake responses
  served by the fake bridge's media_query, a join one device refuses, volume effects), evidence-media-players-live.spec.ts
  (SW_LIVE=1), docs/user-guide/he/42-multimedia_HE.md players/groups sections, screens.json.
Done: live spec green on a throwaway backend (never the lab); screenshots to docs/design/evidence/CR-016/; guide says
  "תשתית המערכת", never HA/MA names on operator text.
Estimate: 10-14 agent-hours.
```

### 5.1 Merge order and review

S1 → S2 → S3 → S4, then an **Opus review** of the command path (media_commands additions, media_groups.py,
media_query.py, ha_bridge ACTIONS, the bridge's media_policy and media_query, device_bulk group kinds) with fixes by S1
(4-6 h), integration and the full suite in the release round (2-3 h). S2/S3 work on the mock and are harmless before S1
(the tabs are gated on data the server does not return yet).

### 5.2 Totals, calendar and what could make it long

| Item | Agent-hours (same unit as base §5.2) |
|---|---|
| P0 mockup + S0 client | 6-8 |
| S1 backend + bridge | 20-26 |
| S2 pages + settings | 16-20 |
| S3 panel + area card + widget | 18-24 |
| S4 fixture + evidence + guide | 10-14 |
| Opus review + fixes, integration | 6-9 |
| **Total (option A, HA only)** | **76-101** (CR-015 was estimated at 92-116) |
| Option B added later (direct MA client + full queue UI + fake MA server + second review) | +24-34 |

**Calibration, honestly.** The agent-hour figures are nominal effort, not wall-clock. For CR-015 the git timestamps show
the contract commit at 22:30, all four stream branches committed by 23:47, the integration branch at 00:06 and the
review fixes at 00:46 - about **2.5 hours of wall-clock** for a 92-116 agent-hour estimate with four parallel agents.
The wall-clock of 0.1.150 is therefore dominated by the owner's decision and review cycles and the release round (the
owner's rule: one or two release rounds a day, on his word), not by coding.

| Case | Calendar (4 parallel Sonnet agents + integration + Opus review) | What it assumes |
|---|---|---|
| **Best** | **same day** (≈ 5-6 h wall: decisions + mockup 1-2 h, S0 1 h, S1-S4 ≈ 1.5-2 h, review + fixes ≈ 1 h), shipped in that evening's release round | the owner adopts the recommendations and the first mockup; the fake-HA behaviour matches the real integration |
| **Likely** | **1.5-2 days** | one mockup revision (the UniFi mandate), then one live round on the owner's system surfaces 1-3 grouping/state differences (WiiM vs MA join, leader volume, stale MA entities) fixed in the next release round |
| **Worst** | **4-5 days** | the owner chooses option B now (MA account + token created by him, port 8095 reachability, a new client with reconnect/resync, a second review), or queue/browse depth grows into library search, or grouping semantics differ per integration and need a second live round |

What keeps it short: the model, the dedupe ladder, the command path, the bridge policy style, permissions, drawer,
layout editor, area card, home widget, bulk engine and artwork proxy are reused (CR §3); HA already exposes the MA
features we need; no new secret. What could make it long: the MA client (option B), the queue/browse UI if the scope
grows past "up next" and three short lists, and grouping semantics that only live hardware reveals.

### 5.3 Definition of done (every agent)

As base §5.3: targeted tests actually run and reported (NOT_RUN is not PASS); screenshots at 1440/820/390 with
loading/empty/error/ready; no brand or HA/MA names on operator screens; no secrets, lab data or real identifiers in
fixtures; commit on the agent's own branch with the CLAUDE.md trailer; a closing report per AGENTS.md.
