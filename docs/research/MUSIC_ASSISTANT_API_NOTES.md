# Music Assistant (MA) - API, data model and integration notes for the SmplWise media-device UI

Research for release 0.1.149 (TVs and media). Public web only; no device, Home Assistant or lab system was
contacted, and `secrets/` / `private-evidence/` were not read. Fetched 2026-09-30.

**Update 2026-10-01 (release 0.1.150, players / speakers / groups, CR-016):** section 8 adds the MA organisation's
other repositories (Python client, web frontend, add-on, docs), the Home Assistant path in detail (what the
`music_assistant` HA actions return), announcement and volume-limit semantics, and the two `r11a` (HOMEii) repositories
the owner pointed to. Corrections applied in place and marked "(corrected 2026-10-01)": `group_volume` is the
**maximum**, not the average (3.1, 4.4); long-lived tokens are **1 year** (2.3); `player_filter` **is** settable through
the API on release 2.10.4 (2.3); the MA add-on runs on the **host network** (2.1). Same rules: public sources only,
fetched 2026-10-01, ideas only (no code or CSS copied).

Conventions: `[Sn]` refers to the source list in section 7. **UNVERIFIED** marks anything not confirmed from a
primary source. "Release" means server tag 2.10.4 (published 2026-09-18, `API_SCHEMA_VERSION` 65,
`MIN_SCHEMA_VERSION` 28, pins `music-assistant-models==1.1.205`); "dev" means the `dev` branch at fetch time
(`API_SCHEMA_VERSION` 84, models 1.1.214) [S3][S4]. The version actually installed on the owner's systems is
UNVERIFIED (not contacted) - always read `schema_version` from the server-info message at runtime.

Summary of the most important findings:

1. One physical device can surface as up to five objects: the vendor's own HA `media_player`, one or more MA
   protocol players (Cast / AirPlay / DLNA, hidden), the MA "visible" player (native or Universal Player), the HA
   `media_player` that the MA integration creates for that MA player, and - if the HA Media Players provider is
   used - an MA player whose id is the HA entity id (a loop back into HA). MA itself has de-duplication rules
   for the MA-internal part only; nothing de-duplicates against the vendor HA entity. We must.
2. MA has a stable cross-protocol identifier model (`DeviceInfo.identifiers`: MAC, serial, UUID, Cast UUID,
   AirPlay id, IP) that we can reuse for the join, and the HA-side join key for HA-imported players is exact
   (`player_id == HA entity_id`).
3. TVs are a poor fit for MA: Cast "TV" devices are disabled by default by a name heuristic, protocol endpoints
   of TVs get wrapped into Universal Players, and the HA provider only imports entities that support
   `play_media`. For TVs the HA `media_player` (power, volume, source) stays primary; MA is at most an optional
   audio output.
4. MA auth is token based with scopes and a per-user `player_filter`; the HA integration uses a `service` role
   that can impersonate users. A multi-user installer product should use one dedicated low-privilege MA
   account from the backend only and enforce its own RBAC (section 5).

---

## 1. Architecture on one page

### 1.1 Components (server side)

MA is a Python server (repo `music-assistant/server`, Apache-2.0, Python 3.14+, ffmpeg 6.1+) [S2][S3]. It is
organised as:

- **Core controllers** (`music_assistant/controllers/`): `players`, `player_queues`, `music`, `config`,
  `metadata`, `streams`, `webserver`, `cache`, `discovery`, `tasks`, `dashboard`, `storage`, `diagnostics` [S3].
- **Providers** (`music_assistant/providers/`, about 130 directories in dev): typed `music`, `player`,
  `metadata`, `plugin`, `audio_analysis`, `core` [S3][S5]. Player providers named in the docs [S6]: AirPlay,
  Alexa, AmpliPi, Bluesound, Bose SoundTouch, DLNA, Fully Kiosk, Google Cast, HEOS, Home Assistant Media
  Players, MPD, MusicCast, Roku Media Assistant, Samsung WAM, Sendspin, Snapcast, Sonos (S2) and Sonos S1,
  Squeezelite, WiiM, Yandex Station (Local Audio Out is retired in 2.10) [S6][S7].
- **Webserver** on port 8095: WebSocket `/ws`, JSON-RPC over `POST /api`, API docs under `/api-docs`, frontend,
  auth routes, image proxy, optional WebRTC remote access [S8][S9].
- Audio is pulled, decoded and re-encoded by MA and streamed to the player over HTTP (FLAC by default, MP3
  optional); MA decides per player between native enqueue ("next track" handed to the device) and **flow
  mode** (server stitches tracks into one stream; needed for AirPlay, Snapcast and HA media players) [S10].

### 1.2 Players, queues, sources

- Each provider registers **Player** objects. The API exposes the final, user-customised state (internally
  `PlayerState`; over the wire the `Player` model, section 3) [S11].
- **One queue per player, and `queue_id == player_id`** (leaf player, group player or sync leader). A player's
  queue is its usual "active source", but a player can be on another (native/external) source, e.g. a TV
  input; `Player.active_source` is then a source id instead of a queue id [S12].
- Protocol players (`PlayerType.PROTOCOL`) have an inert queue and are hidden from the API by default
  (`players/all` has `return_protocol_players=False`) [S11][S13].

### 1.3 Protocol linking and Universal Player (2.10)

A physical device usually speaks several protocols. The player controller matches protocol players to the
same device by identifiers in this order: MAC, serial number, UUID, Cast UUID / AirPlay id, IP (last
resort, ARP-verified where possible), then `player_id` as a fallback key. Protocol players from the **same
provider domain are never merged** (several Snapcast or Sendspin clients on one host stay separate) [S11].

- A vendor-native player (Sonos, Bluesound, HEOS...) absorbs matching protocol players; they become hidden and
  the native player gains `output_protocols` (e.g. AirPlay on a Sonos).
- Devices without a native provider are wrapped in a **Universal Player** after a 15 s delay (45 s if a cached
  parent link exists); a later-arriving native player replaces (promotes over) the Universal Player. The player
  id of the visible player can therefore **change** over time [S11].
- Output selection on playback: active grouped protocol, then the user's preferred protocol, then native
  `PLAY_MEDIA`, then best by priority (AirPlay > Chromecast > DLNA) [S11].
- Cast: Google devices are `PLAYER`, non-Google Cast devices (TVs, soundbars) are `PROTOCOL`; devices whose
  friendly name contains "tv", "/12", "PUS" or "OLED" are **disabled by default** (user can enable) [S14].
  The docs say the same in prose [S15].

### 1.4 Groups and sync

Two kinds of MA-created groups [S16]: **Sync groups** (same platform, perfectly synchronised, e.g. Sonos+Sonos,
or AirPlay+AirPlay) and **Universal groups** (dissimilar devices, not in sync, one common output format;
cannot nest). Vendor groups (Sonos, Cast groups from Google Home) show up as group players. Dynamic group
membership is possible through `players/cmd/set_members`, `group`, `ungroup` (section 2.3).

### 1.5 The Home Assistant side: three independent pieces [S17]

| Piece | Lives in | What it does |
|-------|----------|--------------|
| **HA integration** `music_assistant` (core, `integration_type: service`, `iot_class: local_push`, zeroconf `_mass._tcp.local.`, requires PyPI `music-assistant-client`) [S18] | HA | Connects to the MA server over WebSocket; creates entities per MA player |
| **HA plugin** (provider `hass`, type `plugin`) [S19][S20] | MA | Connects MA to HA (Supervisor token on HAOS, URL + credentials otherwise). Lets an MA player use HA entities as **power / volume / mute controls** (switch, input_boolean, media_player for power and mute; number, input_number, media_player for volume). Explicitly *not* a way to power the player device itself |
| **HA Media Players provider** (`hass_players`, depends on the plugin) [S21][S22] | MA | Imports HA `media_player` entities as MA players |

**Entities the HA integration creates** (from `media_player.py`, `entity.py`, `button.py`, `number.py`,
`select.py`, `switch.py`, `text.py` in core dev) [S18]:

- `media_player` for **every MA player that is `expose_to_ha` and enabled** (including groups and players
  imported from HA), device class `speaker`, `_attr_name=None` so the entity takes the device name.
  Extra state attributes: `mass_player_type` and `active_queue`.
- A HA **device** per MA player with `identifiers={("music_assistant", player_id)}`, manufacturer/model from MA
  `device_info`, and a configuration URL into the MA UI. **No `connections` (MAC) are set**, so HA's own
  device registry cannot merge it with the vendor's HA device.
- `button` ("favorite now playing"), plus `number` / `select` / `switch` / `text` entities generated from MA
  `Player.options` (entity category `config`), depending on what the provider offers.
- Entity unique id = MA `player_id` (suffix `_<key>` for auxiliary entities).
- Feature flags: STOP, PREVIOUS/NEXT, SHUFFLE, REPEAT, PLAY, PLAY_MEDIA, CLEAR_PLAYLIST, BROWSE_MEDIA,
  SEARCH_MEDIA, MEDIA_ENQUEUE, MEDIA_ANNOUNCE, SEEK and PAUSE are **always on** (MA emulates pause with
  stop + resume position where the device lacks it). GROUPING only if `SET_MEMBERS`; VOLUME_SET/STEP only if
  `volume_control != none`; VOLUME_MUTE only if `mute_control != none`; TURN_ON/OFF only if
  `power_control != none`; SELECT_SOURCE / SELECT_SOUND_MODE from `PlayerFeature`.
- HA state: `off` when `powered` is false, otherwise `idle/paused/playing`; volume 0..1 (MA 0..100); HA
  `group_members` are translated to entity ids; HA source list drops MA's `passive` sources.
- Six integration actions: `music_assistant.search`, `get_library`, `play_media`, `play_announcement`,
  `get_queue`, `transfer_queue` [S17][S23].

### 1.6 The duplicate-entity problem

For a device such as a Sonos soundbar, Cast speaker or a TV that speaks AirPlay/Cast/DLNA, HA can end up with:

| # | Object | Owner | Identity available to us |
|---|--------|-------|--------------------------|
| A | `media_player.<vendor>` from the vendor's HA integration (`sonos`, `cast`, `samsungtv`, `webostv`, `dlna_dmr`, ...) | HA device with `connections` (often `mac`) and `identifiers` | HA device id, MAC (if the integration registers it), entity platform |
| B | MA protocol player(s) (hidden) | MA | `device_info.identifiers` (MAC, UUID, cast_uuid, airplay_id, IP) |
| C | MA visible player (native or Universal) | MA | same identifiers; `output_protocols[]` lists the linked protocols |
| D | `media_player.<name>` created by the MA integration for C | HA device `("music_assistant", player_id)` | MA `player_id` only |
| E | MA player imported from A via HA Media Players | MA | `player_id == entity_id of A` (exact) |

MA protects against **A vs E** partly: the HA provider blocks importing entities from integrations that
MA supports natively (`bluesound`, `cast`, `dlna_dmr`, `fully_kiosk`, `heos`, `linkplay`, `mpd`, `snapcast`,
`sonos`, `squeezebox`, `yamaha_musiccast`), refuses entities whose device MAC matches an existing native MA
player, and hard-blocklists `alexa_media` and `apple_tv` [S24]. It only offers entities that support
`play_media` [S25]. Docs call the native provider strongly preferable [S21][S22]. MA does **not** make A and D
one entity in HA: the docs list "HA players appear duplicated when added to MA" as a known limitation [S23].
The MA docs also warn that running the HA Sonos integration together with the MA Sonos S1 provider can cause
problems [S26]. Whether E is re-exposed to HA as a D entity by default is UNVERIFIED (the docs say imported
players are included among the exposed ones [S23]; the per-player `expose_to_ha` flag exists and can switch it
off, default true [S27]).

---

## 2. The API

### 2.1 Transport

| Item | Detail |
|------|--------|
| WebSocket | `ws(s)://<host>:8095/ws` [S8] |
| JSON-RPC (stateless) | `POST http://<host>:8095/api` with body `{"message_id": "...", "command": "players/all", "args": {...}}`; response body is the raw result JSON; `400` invalid command/args, `403` insufficient permission, `500` generic [S8][S28] |
| Docs generated by the server | `/api-docs` (intro), `/api-docs/commands`, `/api-docs/commands.json`, `/api-docs/schemas`, `/api-docs/schemas.json`, `/api-docs/openapi.json`, `/api-docs/swagger` [S8][S9]. The content of these generated documents was not fetched (they need a running server) - UNVERIFIED beyond the route names |
| Server info | `GET /info`; also sent unsolicited as the first WebSocket message |
| Remote | WebRTC gateway (signalling `wss://signaling.music-assistant.io/ws`, id `MA-XXXX-XXXX`); the API channel is bridged to `/ws`. Irrelevant for a LAN backend [S8] |
| Bind | Default 8095. On HA OS the add-on also serves Ingress on 8094 (HA docker network only, trusts HA user headers) [S8]. (corrected 2026-10-01) The add-on's `config.yaml` sets `host_network: true`, no `ports:` mapping, `ingress_port: 8094`, so 8095 is served on the HA host's own address [S47]; whether our add-on container can reach it in the owner's systems is still UNVERIFIED |

**Schema version.** The server sends `ServerInfoMessage` on connect: `server_id`, `server_version`,
`schema_version`, `min_supported_schema_version`, `base_url`/`internal_url`, `external_url`,
`homeassistant_addon`, `onboard_done`, `name`, `status` (core state), `has_remote_access` [S29]. The constant is
bumped whenever commands or models gain features; clients must feature-detect on it (MA's own docs do this
for WebRTC channels) [S8]. Policy recommendation: require `schema_version >= MIN_SCHEMA_VERSION` the client was
written for, never assume dev-only commands.

### 2.2 Message format [S29]

```
client -> server   {"message_id": "<any string>", "command": "players/cmd/volume_set", "args": {"player_id": "...", "volume_level": 30}}
server -> client   {"message_id": "<same>", "result": <value>}                       # success
                   {"message_id": "<same>", "result": [ ...500 items ], "partial": true}   # chunk of a large listing, more follow; last message has no partial flag
                   {"message_id": "<same>", "error_code": 22, "details": "..."}        # failure
server -> client   {"event": "player_updated", "object_id": "<player_id>", "data": { ...Player... }}
```

- The **first command on a connection must be `auth`** with `{"token": "<access token>"}` (older
  clients used `access_token`); the success result is `{"authenticated": true, "user": {...}}`. Until then the
  server answers with an error; if no user exists yet the server sends error code 503 "Setup required" and
  closes [S30].
- **Events are pushed automatically after a successful `auth`** - there is no subscribe command. Events for
  players/queues the user is not allowed to see (`player_filter`) are dropped server-side; `providers_updated`
  and `tasks_updated` are re-filtered per user; favorites events go only to their own user [S30].
- Initial state is obtained by calling `players/all`, `player_queues/all`, then applying events.
- Error codes (models `errors.py`): 1 ProviderUnavailable, 2 MediaNotFound, 3 InvalidData, 4 AlreadyRegistered,
  5 SetupFailed, 6 LoginFailed, 7 AudioError, 8 QueueEmpty, 9 UnsupportedFeature, 10 PlayerUnavailable,
  11 PlayerCommandFailed, 12 InvalidCommand, 13 UnplayableMedia, 14/15 InvalidProviderURI/ID, 16 RetriesExhausted,
  17 ResourceTemporarilyUnavailable, 18 ProviderPermissionDenied, 19 ActionUnavailable,
  20 AuthenticationRequired, 21 AuthenticationFailed, 22 InsufficientPermissions, 23 InvalidToken,
  24 ResourceBusy, 25 RateLimited, 26 UnsupportedSystem, 27 UserNotFound [S31].
- Responses are localised per connection locale (`translations/set_locale`); image URLs are proxied through the
  server (`metadata` image proxy) [S30].

### 2.3 Authentication and tokens [S8][S30][S32]

- **Built-in users** (bcrypt, progressive login rate limit) and an optional **Home Assistant OAuth** provider;
  on Ingress the HA user headers auto-create users.
- Token types: short-lived (auto-renew, 30-day sliding window) for sessions; **long-lived** for integrations.
  (corrected 2026-10-01) Long-lived lifetime is **1 year, no auto-renewal**: `TOKEN_LONG_LIVED_EXPIRATION = 365` in
  `controllers/webserver/auth.py` of both 2.10.4 and 2.11.0b3; the "10 years" in the README is stale [S47]. Plan renewal. They cannot be created for guest accounts. Created with
  `auth/token/create`, or in the UI under the user profile [S9][S30].
- HTTP: header `Authorization: Bearer <token>` [S9]. WebSocket: the `auth` command.
- Builtin roles (release): `admin` (scope `*`), `user`, `guest`, `service` (the role used by the HA
  integration: user scopes + `config.players.write` + `users.read` + `users.impersonate`). Dev adds admin-created
  **custom roles** (`auth/role/*`) and `config.providers.own`; these are not in release 2.10.4 [S30][S32].
- **Scopes:** `library.read|write|manage`, `players.read|control`, `queues.read|control`, `providers.read`,
  `config.players.read|write`, `config.providers.read|write`, `config.core.read|write`, `users.read|manage|
  impersonate|invite`, `system.read|manage`. Guest = `library.read`, `players.read/control`, `queues.read/
  control`, `providers.read`, `config.players.read`. User = guest + `library.write`, `config.providers.read`,
  `config.core.read`, `users.invite`, `system.read` [S32].
- **Per-user `player_filter`** (list of player/queue ids): an empty list means unrestricted; a non-empty list
  limits commands and events to those players (a user's own private client player is always allowed). Settable
  in `auth/user/create` and `auth/user/update` [S30][S32]. (corrected 2026-10-01) Release 2.10.4 accepts
  `player_filter` and `provider_filter` in both commands; setting them for another user needs `users.manage` (admins)
  [S47].
- **Impersonation:** commands marked `allow_impersonation` (for example `player_queues/play_media`) accept a
  `user` argument; needs `users.impersonate` (service role). Used by HA so "play" is attributed to a user [S30].

### 2.4 Command list (release 2.10.4 unless marked dev)

Parameters are taken from the function signatures of the decorated handlers [S11][S33][S34]. `*` = required
(no default). Scope in brackets.

**Server / providers / auth**

| Command | Parameters | Scope |
|---------|------------|-------|
| `info` | - | any |
| `time` | - | none (unauthenticated) |
| `providers` | `provider_type?` | providers.read |
| `providers/manifests`, `providers/manifests/get`, `providers/icon` | `instance_id_or_domain*`; `provider*`, `variant?` | providers.read |
| `auth/login` | `username`, `password`, `provider_id="builtin"`, `device_name` (unauthenticated) | - |
| `auth/me`, `auth/logout`, `auth/tokens`, `auth/token/create` (`name*`, `user_id?`), `auth/token/revoke` (`token_id*`) | | authenticated |
| `auth/users`, `auth/user`, `auth/user/create|update|delete|enable|disable`, `auth/scopes`, `auth/roles` | | users.* |
| `logging/get` | - | system.manage |

**Players** (`players/...`) [S11]

| Command | Parameters | Scope |
|---------|------------|-------|
| `players/all` | `return_unavailable=True`, `return_disabled=False`, `provider_filter?`, `return_protocol_players=False` | players.read |
| `players/get` | `player_id*`, `raise_unavailable=False` | players.read |
| `players/get_by_name` | `name*` | players.read |
| `players/player_controls`, `players/player_control` | `control_id*` | players.read |
| `players/sleep_timer/get` / `set` / `clear` | `player_id*` (`seconds*` for set) | read / control |
| `players/cmd/stop` `play` `pause` `play_pause` `next` `previous` | `player_id*` | players.control |
| `players/cmd/resume` | `player_id*`, `source?`, `media?` | control |
| `players/cmd/seek` | `player_id*`, `position*` (seconds) | control |
| `players/cmd/shuffle` / `repeat` | `player_id*`, `shuffle_enabled*` / `repeat_mode*` (`off\|one\|all`), `source_id?` | control |
| `players/cmd/power` | `player_id*`, `powered*` | control |
| `players/cmd/volume_set` | `player_id*`, `volume_level*` (0-100) | control |
| `players/cmd/volume_up` `volume_down` `volume_mute` | `player_id*` (`muted*` for mute) | control |
| `players/cmd/group_volume`, `group_volume_up`, `group_volume_down`, `group_volume_mute` | as above | control |
| `players/cmd/select_source` | `player_id*`, `source` (id or null) | control |
| `players/cmd/select_sound_mode` | `player_id*`, `sound_mode*` | control |
| `players/cmd/set_option` | `player_id*`, `option_key*`, `option_value*` | control |
| `players/cmd/set_members` | `target_player*`, `player_ids_to_add?`, `player_ids_to_remove?` | control |
| `players/cmd/group`, `group_many`, `ungroup`, `ungroup_many` | `player_id*`+`target_player*`; `target_player*`+`child_player_ids*`; `player_id*`; `player_ids*` | control |
| `players/cmd/play_announcement` | `player_id*`, `url?`, `pre_announce?`, `volume_level?`, `pre_announce_url?`, `message?`, `tts_engine?`, `language?` (url xor message) | control |
| `players/tts_engines` | - | control |
| `players/add_currently_playing_to_favorites` | `player_id*` | library.write |
| `players/create_group_player` | `provider*`, `name*`, `members*`, `dynamic=True` | config.players.write |
| `players/remove_group_player`, `players/remove` | `player_id*` | config.players.write |

**Queues** (`player_queues/...`) [S33]

| Command | Parameters | Scope |
|---------|------------|-------|
| `all`, `get` (`queue_id*`), `get_active_queue` (`player_id*`) | | queues.read |
| `items` | `queue_id*`, `limit=500`, `offset=0` | queues.read |
| `play_media` | `queue_id*`, `media*` (URI / item / list), `option?` (`play\|replace\|next\|replace_next\|add`), `radio_mode=False` (deprecated), `start_item?`, `sort_by?`, `start_from_beginning=False`, `shuffle?` (+ optional `user` for impersonation) | queues.control |
| `play`, `pause`, `play_pause`, `stop`, `next`, `previous` | `queue_id*` | queues.control |
| `resume` | `queue_id*`, `fade_in?` | control |
| `seek` | `queue_id*`, `position*`; `skip`: `seconds=10` | control |
| `play_index` | `queue_id*`, `index*`, `seek_position=0`, `fade_in=False` | control |
| `shuffle`, `repeat`, `crossfade`, `autoplay` (alias `dont_stop_the_music`) | `queue_id*` + flag/mode | control |
| `overlay`, `set_playback_speed` | `queue_id*`, ... | control |
| `move_item` (`queue_item_id*`, `pos_shift=1`), `move_item_end`, `delete_item` (`item_id_or_index*`), `clear` (`skip_stop=False`) | | control |
| `transfer` | `source_queue_id*`, `target_queue_id*`, `auto_play?` | control |
| `save_as_playlist` | `queue_id*`, `name*` | library.write |

**Music library** (`music/...`) [S34]

- Generic: `music/search` (`search_query*`, `media_types`, `limit=25`, `library_only`, `providers`), `music/browse`
  (`path?`, `player_id?`), `music/item_by_uri` (`uri*`), `music/item`, `music/get_library_item`,
  `music/recently_played_items`, `music/recently_added_tracks`, `music/in_progress_items`, `music/sound_effects`,
  `music/track_by_name`, `music/item_by_name` - all `library.read`.
- Per media type (`artists`, `albums`, `tracks`, `playlists`, `radios`, `audiobooks`, `podcasts`, `genres`):
  `music/<type>/count`, `library_items`, `get`, `get_by_external_id`, `get_collection`; type-specific
  `album_tracks`, `album_versions`, `artist_albums`, `artist_tracks`, `top_tracks`, `similar_artists`,
  `playlist_tracks`, `podcast_episodes`, `radio_tracks`, `track_versions`, `track_albums`, `preview`, ...
- Writes (`library.write`): `music/favorites/add_item|remove_item` (dev: `set_item`), `music/library/add_item|
  remove_item`, `music/mark_played|mark_unplayed`, `music/refresh_item`, `music/<type>/remove|update`,
  `music/playlists/create_playlist|add_playlist_tracks|remove_playlist_tracks`.
- `library.manage`: `music/sync`, provider mapping commands, genre admin commands.
- Metadata: `metadata/get_track_lyrics` (library.read), `metadata/update_metadata` (library.manage).

**Config** (`config/...`) - **administrative, never expose to our UI**

`config/players[/get|get_entries|get_value|save|remove|invoke_action|setup]`, `config/player_queues[...]`,
`config/players/dsp/*`, `config/dsp_presets/*`, `config/dsp_irs/*`, `config/providers[...|save|remove|reload|
setup|reconfigure|set_access]`, `config/core[...]`, `config/flows/*` (setup flows). Player config holds the
switches that matter to our join: enabled, `hide_in_ui`, `expose_to_ha`, `power_control` / `volume_control` /
`mute_control` (`none`, `native`, `fake`, or an HA-entity control id) [S11][S35].

**Tasks / system:** `tasks/list|get|log|run|retry|cancel|set_enabled|update_schedule|remove|clear_finished`,
`streams/info`, `audio_analysis/*`. Not needed.

### 2.5 Event stream [S36]

`MassEvent {event, object_id, data}`; `object_id` is a player id, queue id, URI or provider instance id.

| Event | `object_id` / `data` | Use for us |
|-------|----------------------|-----------|
| `player_added` / `player_updated` / `player_removed` | player id / `Player` | live state |
| `player_config_updated`, `player_options_updated`, `player_dsp_config_updated` | player id | capability changes (controls attached/removed) |
| `player_sleep_timer_updated` | player id | optional |
| `queue_added` / `queue_updated` | queue id / `PlayerQueue` | transport state, now playing |
| `queue_items_updated` | queue id | queue list changed |
| `queue_time_updated` | queue id / elapsed time | progress; chatty, use client-side interpolation |
| `media_item_played`, `media_item_added/updated/deleted`, `favorite_updated`, `playlog_updated` | item uri | library/history |
| `providers_updated`, `provider_event`, `setup_flow_updated`, `tasks_updated`, `sync_tasks_updated`, `music_sync_completed` | | admin |
| `core_state_updated` (`starting\|running\|stopping\|stopped`), `application_shutdown` (deprecated) | | connection handling |
| `auth_session`, `dashboard_*`, `dsp_*` | | ignore |

The HA integration itself only subscribes to `player_updated` (per player), `queue_updated`,
`player_config_updated` and `player_options_updated` [S18] - a sound minimum set.

---

## 3. Data model [S37] (models repo `music_assistant_models`, version pinned by release 1.1.205)

### 3.1 Player (wire shape)

| Field | Type / meaning |
|-------|----------------|
| `player_id`, `provider` (instance id), `name`, `type`, `available`, `enabled`, `hide_in_ui`, `private`, `expose_to_ha`, `icon` | `type` in `player`, `stereo_pair`, `group`, `protocol`, `display`, `visualizer`, `light`, `source`, `unknown` |
| `device_info` | `model`, `manufacturer`, `software_version`, `model_id`, `manufacturer_id`, `identifiers{}`; identifier keys `mac_address`, `serial_number`, `uuid`, `cast_uuid`, `airplay_id`, `ip_address`; MAC normalised `AA:BB:..` upper-case; legacy `mac_address`/`ip_address` aliases are also emitted |
| `supported_features` | set of `power`, `volume_set`, `volume_mute`, `pause`, `set_members`, `multi_device_dsp`, `seek`, `next_previous`, `play_announcement`, `enqueue`, `select_sound_mode`, `select_source`, `options`, `gapless_playback`, `gapless_different_samplerate`, `play_media` |
| `playback_state` (alias `state`) | `idle`, `paused`, `playing`, `unknown` |
| `elapsed_time`, `elapsed_time_last_updated` | seconds + UTC stamp; corrected time = elapsed + (now - stamp) only while playing |
| `powered` | bool or null. Serialised as `true` when null and `power_control == none` (legacy compat) - so "powered" is **not** evidence that the device is on |
| `volume_level` (0-100), `volume_muted`, `group_volume`, `group_volume_muted` | (corrected 2026-10-01) `group_volume` is the **maximum** of the powered children's volumes, not an average (2.10.4 `models/player.py`; the UI docs agree) [S45]; `group_volume` is serialised as 0 when null (compat). Setting it keeps the balance between children (the server scales from a cached snapshot) |
| `power_control`, `volume_control`, `mute_control` | `none`, `native`, `fake`, or id of a PlayerControl (e.g. an HA entity via the plugin). `fake` = MA keeps an optimistic virtual state, nothing reaches a device |
| `group_members`, `static_group_members`, `can_group_with`, `synced_to`, `active_group` | see 3.4 |
| `active_source`, `source_list[]` | source = `{id, name, passive, can_play_pause, can_seek, can_next_previous, can_shuffle, can_repeat, shuffle_enabled, repeat_mode, account_id}`; `active_source` is a queue id when MA is the source |
| `active_sound_mode`, `sound_mode_list[]`, `options[]` | sound modes `{id, name, passive, translation_key}`; options typed `boolean/integer/float/string` with min/max/step/`read_only` |
| `current_media` | `PlayerMedia {uri, media_type, title, artist, album, album_artist, image_url, duration, source_id, queue_item_id, elapsed_time, ...}` |
| `output_protocols[]`, `active_output_protocol` | `{output_protocol_id, name, protocol_domain, is_native, priority, available, derived_from}` - the list of protocols linked to this device |
| `needs_setup`, `setup_reason`, `has_setup_flow`, `sleep_timer_expires_at`, `active_source_audio`, `extra_attributes` | misc |

`PlayerFeature` semantics from the model docs: `power` means a native/dedicated power control; `play_media`
means the player handles play commands itself, otherwise playback is routed through a linked protocol player
[S37].

### 3.2 PlayerQueue

`queue_id`, `active`, `display_name`, `available`, `items` (count), `shuffle_enabled`, `repeat_mode`,
`crossfade_enabled`, `autoplay_enabled`, `overlay_*`, `current_index`, `index_in_buffer`, `ended`,
`elapsed_time`, `elapsed_time_last_updated`, `playback_speed`, `state`, `current_item`, `next_item`, `sources[]`
(parent items), `flow_mode`, `resume_pos`, `is_dynamic`, `extra_attributes`. Legacy keys
`dont_stop_the_music_enabled` / `radio_source` are mirrored. Corrected elapsed time uses
`playback_speed` while playing [S37].

### 3.3 QueueItem and media items

- `QueueItem`: `queue_id`, `queue_item_id`, `name`, `duration`, `sort_index`, `index`, `media_item`, `image`,
  `streamdetails` (server-side, not cached), `available`, `extra_attributes`; `uri` is the media item's URI.
- `MediaItem` base: `item_id`, `provider`, `name`, `version`, `sort_name`, `uri`, `media_type`, `is_playable`,
  `provider_mappings[]` (`item_id`, `provider_domain`, `provider_instance`, `available`, `in_library`,
  `audio_format`, ...), `metadata` (images, descriptions, genres, ...), `favorite`, `external_ids`
  (MusicBrainz ids, ISRC, ...).
- `MediaType`: `artist`, `album`, `track`, `playlist`, `radio`, `audiobook`, `podcast`, `podcast_episode`,
  `folder`, `collection`, `announcement`, `flow_stream`, `plugin_source`, `audio_source`, `sound_effect`,
  `genre`, `unknown`. Subclasses: `Artist`, `Album`, `Track`, `Playlist`, `Radio`, `Audiobook`, `Podcast`,
  `PodcastEpisode`, `Genre`, `AudioSource`, `SoundEffect`; `ItemMapping` (light reference), `BrowseFolder`
  (browse nodes, `path`, not playable), `RecommendationFolder`.
- `QueueOption` (`play`, `replace`, `next`, `replace_next`, `add`), `RepeatMode` (`off`, `one`, `all`).
- Users can "like" items; favorites are **per user** in dev (a favorites event goes only to its own user).

### 3.4 Group / sync semantics [S37][S11]

- `group_members`: for a dedicated group player, the child ids; for a same-platform sync group, the ids synced
  to the leader **including the leader's own id first**.
- `synced_to`: leader of the sync group this player currently follows. `active_group`: id of the group in
  which the player is currently active. `static_group_members`: members that cannot be removed.
- `can_group_with`: player ids (or whole provider instance ids) this player can group with.
- **Commands to a synced child are redirected to the owner of playback** (sync leader, or the group that
  captured the leader). Queue of a synced child is therefore not the queue that plays.
- Powering off a synced member detaches it from the group; a group will not power on if one child is synced to
  another group [S16].
- In the UI player list MA hides by default: unavailable players, synced members, and members of an active
  group (`hide_player_in_ui` options `when_unavailable`, `when_synced`, `when_group_active`; `always`).

### 3.5 Volume, mute, power, source

- Volume is an integer 0..100 in MA (HA floats 0..1). Mute is boolean. Group volume has separate commands.
- `power`, `volume` and `mute` each come from: the device natively (`native`), a fake MA-side state (`fake`),
  or an external control (HA entity through the plugin). Turn-on of a device whose control is an HA entity is
  therefore an HA service call issued *by MA* - an extra hop and a second authority.
- Source selection is `players/cmd/select_source` with a **source id** from `source_list` (not the display
  name); `passive` sources cannot be selected. HA-imported MA players only expose the synthetic "External"
  source, not the vendor's real input list [S25].

---

## 4. What a UI over HA `media_player` AND MA needs

### 4.1 Unified "media device" abstraction (proposal)

Key it by **physical device**, not by entity:

```
MediaDevice {
  device_key            // stable, our own UUID; survives entity churn
  display_name, area_id/floor_id (from HA registries), kind: tv | receiver | soundbar | speaker | group | other
  identity { mac?, serial?, cast_uuid?, airplay_id?, uuid?, ip? (hint only), ha_device_id? }
  endpoints[] {             // every underlying object, tagged
     source: 'ha' | 'ma',
     id, platform/provider_domain, role: 'vendor' | 'ma_native' | 'ma_universal' | 'ma_protocol' | 'ma_export' | 'ma_import',
     capabilities (normalised), last_state, available
  }
  primary { power, volume, mute, source, transport, browse, queue, group }   // which endpoint answers each control
  confidence: exact | strong | weak | manual
}
```

Only `MediaDevice` is rendered. Endpoints are implementation detail, visible in an installer/diagnostics view.

### 4.2 Mapping rules: is it the same device?

Evaluate in order; stop at the first positive rule; record the rule and confidence.

1. **Exact (MA import loop).** MA player with `provider == hass_players` (or any MA player whose `player_id`
   starts with `media_player.`): `player_id` **is** the HA entity id of endpoint A [S24]. Merge with A,
   confidence `exact`.
2. **Exact (MA export).** HA entity whose registry platform is `music_assistant`: its `unique_id` is the MA
   `player_id` (endpoint D belongs to C). Also exposed via the `mass_player_type` / `active_queue` attributes.
   Merge D into the MA player, confidence `exact`.
3. **Exact (same HA device).** Several HA entities with the same `device_id` are one device.
4. **Strong (MAC).** MA `device_info.identifiers.mac_address` equals a MAC in the HA device registry
   `connections` (`("mac", ...)`), compared normalised (lower-case, no separators). MA's own importer uses the
   same test to avoid duplicates [S24]. This is the main join between A and C.
5. **Strong (protocol ids).** `cast_uuid` or `airplay_id` or `uuid` equals the vendor integration's device
   identifier. The HA `cast` integration's unique id being the Cast UUID is UNVERIFIED; check against real HA
   registry data before relying on it. `serial_number` likewise.
6. **Weak (IP).** Same IP and plausible manufacturer/model. MA itself treats IP as last resort because of DHCP;
   use it only to *suggest* a merge to the installer, never to auto-merge.
7. **Name/area hint.** Normalised friendly name + same HA area. Suggest only.
8. **Manual override.** Installer can pin or split a merge; stored per installation and audited.

Additional rules:

- **Protocol players are not devices.** Ignore MA `type == protocol` (they are hidden by default; we ask
  `players/all` without `return_protocol_players`). Use the visible player's `output_protocols[]` only to show
  "also reachable via AirPlay/Cast/DLNA".
- Two visible players from the **same provider domain** with the same IP/MAC are **not** merged (MA's rule:
  multiple Snapcast/Sendspin clients per host).
- `type == group` / `stereo_pair` are **virtual devices**: show as a group of devices, not as a physical
  device; their `group_members` point to the member devices.
- Universal Player id may change after promotion (15 s / 45 s delays): never use the MA `player_id` as our
  `device_key`; store it as a mutable endpoint id.
- A native-supported vendor integration present in HA (list in 1.6, `NATIVE_SUPPORTED_HASS_INTEGRATIONS`) plus
  the same vendor in MA means **two full control paths**; choose one primary (see 4.3).

### 4.3 Who is primary per control (control matrix)

"Primary" is the recommended default; the installer can override per device. HA = vendor `media_player` (A);
MA = MA visible player (C) driven over our own MA connection (not through D).

| Control | TV (Samsung, LG, Android TV, ...) | AV receiver / soundbar | Speaker (Sonos, Cast, HEOS, ...) | Notes |
|---------|-----------------------------------|------------------------|----------------------------------|-------|
| Power on/off | HA (`turn_on/off`; TV integrations often need CEC/WoL) | HA, or MA if `power_control` is native/HA-entity | MA native if `POWER`, else HA | MA `powered` is meaningless when `power_control==none`; MA state `off` in D only derived from `powered` |
| Volume / mute | HA | HA, or MA with volume control bound to the same HA entity | MA (native, group volume aware) | MA 0-100 vs HA 0-1; group volume only in MA |
| Source / input | HA `select_source` (real input list) | HA `select_source` | MA `select_source` if `SELECT_SOURCE` | MA-imported HA players only show "External"; do not use as the source list |
| Transport (play/pause/stop/next/prev/seek) | HA if device reports `PLAY/PAUSE`; MA only for MA-initiated playback | HA/MA per `active_source` | MA (queue) when `active_source` is the MA queue, else HA | Decide by `Player.active_source`: if it equals the queue id, MA owns transport |
| Now playing (title, art, progress) | HA attributes | HA or MA | MA `current_media` / queue `current_item` (richer) | Interpolate progress client-side |
| Browse / search | HA `browse_media` (device apps) | HA | **MA** `music/search`, `music/browse`, library | Two separate catalogs; UI must label them |
| Queue view/edit | n/a | n/a | **MA only** (`player_queues/*`) | HA has no queue concept (MA docs: queue data partially limited for non-library items [S23]) |
| Play media / announce | HA `play_media` / `tts` | HA | MA `play_media`, `play_announcement` | Announcements speak in rooms: sensitive |
| Grouping | HA `join/unjoin` (only some integrations) | rare | MA `set_members` / groups (sync groups stay in sync; universal groups do not) | Do not mix HA and MA grouping for the same device |
| Sound mode | HA | HA | MA `select_sound_mode` | |
| Availability | HA entity `unavailable` | same | MA `available` | A device can be off-network and MA unavailable while HA shows `off` (TV standby) |

Practical default: **HA primary for TVs and receivers** (power, volume, source, basic transport), **MA primary
for speakers and any device whose activity is MA music** (transport, queue, browse, groups). When MA and HA
disagree on state (for example MA `idle` but the TV entity `playing` a Netflix app), the vendor HA state wins
for `on/off`, and MA wins only if `active_source` equals the MA queue id.

### 4.4 Pitfalls

1. **Five-fold duplication** (section 1.6) - also the triple loop A -> E -> D when the HA provider imports a
   device and the integration re-exposes it. Filter by `expose_to_ha` and by our merge.
2. **TVs are mostly not in MA at all**: Cast TVs are disabled by name heuristic, `apple_tv` and `alexa_media`
   are blocklisted for HA import, DLNA behaviour varies per maker ("some will work great, others not at all")
   [S14][S24][S38]. Do not assume a TV has an MA player; do not treat a missing MA player as an error.
3. **Protocol hiding and delays**: a new device may appear as a Universal Player only after 15-45 s; native
   promotion swaps ids.
4. **`powered` lies** when `power_control == none` (serialised true). Show power only if `POWER` is in
   `supported_features` or a control other than `none` is bound.
5. **HA entity `off` but MA player "available"** and vice versa; never derive power from one side only.
6. **Pause is emulated** in D (always advertised) - the underlying device may stop instead of pause.
7. **Synced children**: commands are redirected to the leader; the child's own queue is not the playing queue.
   Resolve the effective queue with `players/get` -> `active_source` / `synced_to` / `active_group`, or
   `player_queues/get_active_queue`.
8. **Fake controls** (`fake`) are optimistic MA-side values with no device effect - render as "virtual".
9. **Volume semantics**: group vs member volume; MA group volume is the maximum of the powered members
   (corrected 2026-10-01); announcement volume has its own strategy and clamps (8.4); a per-player `min_volume` /
   `max_volume` in MA rescales the logical 0-100 level (8.4); a volume command on a muted player may be locked at 0.
10. **Flow mode** (AirPlay, Snapcast, HA media players) loses per-track metadata on the device, so track
    skipping may behave differently from a native queue.
11. **Event volume**: `queue_time_updated` is frequent; throttle before pushing to browsers.
12. **Chunked results** (`partial: true`, 500 items) must be reassembled by `message_id`.
13. **Auth expiry**: long-lived token lifetime (1 year vs 10 years, see 2.3), revocation closes the socket;
    handle reconnect, re-`auth`, and full resync on `core_state_updated`.
14. **Schema drift**: dev (84) is far ahead of release (65); custom roles, `config.providers.own`, `favorites/
    set_item` are dev-only. Gate features on `schema_version`, not on server version strings.
15. **Language/locale**: names and errors are localised per connection; do not use localised strings as keys.
16. **Discovery and network**: MA needs mDNS on a flat network and random ports; VLAN/guest/AP isolation breaks
    discovery [S39]. Not our problem to fix, but a support-relevant diagnostic ("device visible in HA, absent in
    MA").
17. **Two authorities for the same hardware**: HA Sonos + MA Sonos S1 is a documented conflict [S26]; HA `cast`
    plus MA Cast is tolerated but both poll the device.

---

## 5. Permissions, RBAC and what must stay read-only

### 5.1 Connection model (recommended)

- **One backend-held MA connection**, like our single HA connection. Browsers never get an MA token or an MA
  URL. The MA token lives in the secrets store, is never logged, and is rotated before the 1-year expiry.
- Use a dedicated MA account (name like `smplwise_vms`), **not** the `service` role (it can impersonate users
  and write player config) and not `admin`. In release 2.10.4 the smallest builtin choice that can also hold a
  long-lived token is `user` (guests cannot have long-lived tokens); restrict its reach with a `player_filter`
  containing only the player ids we manage (filter applies to commands and events). Dev's custom roles would allow
  a guest-scope-only role, but are not in release. Whether `player_filter` can be set through the API on release
  is UNVERIFIED.
- Because the account's scopes are coarse (`players.control`, `queues.control`, `library.*`), **all fine-grained
  RBAC is ours**: map permission + scope (floor/area) to allowed MA commands in the backend, in the same style as
  `devices.read` / `devices.control` in CR-007 (HA user permission, product permission, scope, capability, risk
  policy; no unaudited admin-token use) [S40].
- Do not use MA `user` impersonation for our users (it needs `users.impersonate`). If per-person history or
  favourites ever matter, treat it as a separate decision.

### 5.2 Proposed permissions (names are suggestions, to be reconciled with CR-007)

| Permission | Allows | Default roles |
|------------|--------|---------------|
| `media.read` | list media devices, state, now playing, queue view, scoped by floor/area | viewer+ |
| `media.control` | transport, volume, mute, seek, shuffle/repeat on devices in scope | operator+ |
| `media.power` | power on/off, source/input/sound mode | operator+ (TV/AV); site_admin for building-wide |
| `media.play` | `play_media`, enqueue, browse/search, transfer queue | operator+ |
| `media.queue_edit` | delete/move/clear queue items | operator+ |
| `media.group` | create/modify sync/universal groups, set members | site_admin+ (affects other rooms) |
| `media.announce` | `play_announcement` / TTS | site_admin+ (sensitive: audible everywhere; needs confirmation, rate limit) |
| `media.bulk` | "all screens off", "pause everything" | site_admin+, server-confirmed, per-device results like CR-007 bulk |
| `media.map.edit` | merge / split overrides, hide devices | site_admin+ |
| `media.config` | anything under `config/*`, provider setup, player enable/expose, controls binding | **not exposed**; done by system_admin in MA's own UI |

Every action: HA user permission check where a HA entity is involved, product permission + scope, capability
check against the live endpoint, audit row with `actor_user_id`, endpoint used, result (accepted / not
confirmed / unknown), per the existing audit rules [S40].

### 5.3 Must stay read-only / out of scope for the product

- All `config/*`, `providers*` mutations, `players/remove`, `players/create_group_player` /
  `remove_group_player` (unless a later slice exposes group creation behind `media.group`), DSP, tasks, logs,
  users/tokens/roles (`auth/*`), `music/sync`, library mutation (`music/library/*`, `mark_*`, playlist edits),
  `add_currently_playing_to_favorites` (favorites are per MA user, which would be our service user).
- Setup flows (`config/*/setup`, `config/flows/*`) - they handle OAuth URLs and secrets.
- Direct use of the MA web UI through Ingress is the owner's/installer's path, not ours.
- Streaming account data: MA providers (Spotify, Tidal, ...) carry personal streaming credentials. Library and
  search results can expose a person's listening; restrict `music/*` and `recently_played` to permissioned
  users, and do not cache them beyond the session. `music/browse`, `search`, `recently_played_items` have no
  per-device scope; scope them at product level.
- TV control that can change security posture (for example unlocking a smart-home scene through a script
  entity) stays behind `ha.entity.control`, as CR-007 already rules; `media.power` covers only `media_player`.

---

## 6. Open questions for the product owner

1. **Scope for 0.1.149.** What must ship first?
   a) Read-only inventory plus de-duplicated "media devices" list (no control).
   b) Inventory plus TV/receiver control through HA only (power, volume, source); MA shown read-only.
   c) Full: HA control plus MA transport, queue, browse.
2. **Who is primary for speakers that exist in both HA and MA?**
   a) MA primary (queue, groups, richer metadata), HA as fallback.
   b) HA primary (one path, simpler), MA only for music features.
   c) Per device, installer chooses; default MA for Sonos/Cast/HEOS/AirPlay.
3. **TVs.** Should MA ever be used for a TV?
   a) No: TVs are HA-only; hide any MA endpoint of a TV.
   b) Only as a "play music on this screen" target (Cast/AirPlay), off by default.
   c) Follow MA defaults (Cast TVs disabled, others enabled).
4. **Connection method to MA.**
   a) Direct backend WebSocket to MA with our own token (recommended: real-time events, full model).
   b) Only via HA (MA integration entities and actions): simpler auth, loses queues/identifiers.
   c) Start with (b) for inventory, add (a) when queue control is needed.
5. **MA account strictness.**
   a) Dedicated `user` account with `player_filter` (release-compatible).
   b) Wait for custom roles (dev only) and use a guest-scope role.
   c) Reuse the existing HA-integration `service` token (faster, but can impersonate and edit player config; not recommended).
6. **Merge policy.**
   a) Auto-merge only on exact/strong matches; weak ones appear as installer suggestions.
   b) Also auto-merge by name + area.
   c) No auto-merge; installer maps everything manually.
7. **Announcements and group building.**
   a) Not in this release.
   b) Announce only, `site_admin`, with confirmation.
   c) Announce plus group create/edit (`media.group`).
8. **Library and listening data.**
   a) No library browsing/search at all in the operator UI.
   b) Search/browse allowed, no history or favourites.
   c) Full, including recently played (privacy review first).
9. **Bulk actions.** Include media in the building/floor "turn everything off"?
   a) Yes: screens and amps off only, server-confirmed.
   b) Yes: also pause/stop music.
   c) No: media stays out of bulk actions.
10. **Duplicate cleanup in the owner's HA.** The UI hides duplicates, but the entities still exist in HA.
    a) We only hide/merge in our UI and never touch HA or MA config.
    b) We additionally generate an installer report ("set `expose_to_ha` off for these MA players").
    c) We apply the change ourselves after explicit approval (writes to MA config - breaks the read-only rule).

---

## 7. Sources (all fetched 2026-09-30, public)

Page fetches summarised through the WebFetch tool unless noted; raw source files were downloaded from
`raw.githubusercontent.com` and read directly.

| ID | URL | Used for |
|----|-----|----------|
| S1 | https://www.music-assistant.io/ | overview, doc sections |
| S2 | https://github.com/music-assistant/server | repo structure, Python / ffmpeg requirements |
| S3 | https://api.github.com/repos/music-assistant/server/git/trees/dev?recursive=1 and `/trees/2.10.4?recursive=1` | controller and provider listing |
| S4 | https://raw.githubusercontent.com/music-assistant/server/{dev,2.10.4}/music_assistant/constants.py and `pyproject.toml`; https://api.github.com/repos/music-assistant/server/releases/latest and `/releases/tags/2.10.0` | schema versions, models pin, release date, 2.10 breaking change |
| S5 | https://github.com/music-assistant/models and its tree (https://api.github.com/repos/music-assistant/models/git/trees/main?recursive=1) | models package layout |
| S6 | https://www.music-assistant.io/player-support/ | list of player providers, native-first advice |
| S7 | https://www.music-assistant.io/blog/2026/08/26/music-assistant-2-10/ | 2.10 highlights (player bar, new providers) |
| S8 | https://raw.githubusercontent.com/music-assistant/server/dev/music_assistant/controllers/webserver/README.md and `controller.py` | endpoints, routes, roles, tokens, remote access, Ingress |
| S9 | https://www.music-assistant.io/api/ | base URL, bearer token, message fields, `/api-docs` |
| S10 | https://www.music-assistant.io/faq/tech-info/ | one queue per player, HTTP streaming, flow mode vs enqueue |
| S11 | https://raw.githubusercontent.com/music-assistant/server/dev/music_assistant/controllers/players/README.md, `controller.py`, `announcements.py`, `protocol_linking.py` | player architecture, protocol linking, commands |
| S12 | https://raw.githubusercontent.com/music-assistant/server/dev/music_assistant/controllers/player_queues/README.md | `queue_id == player_id`, active source |
| S13 | same as S11 (`players/all` parameters) | protocol players hidden |
| S14 | https://raw.githubusercontent.com/music-assistant/server/dev/music_assistant/providers/chromecast/player.py | Google vs protocol type, TV disable heuristic |
| S15 | https://www.music-assistant.io/player-support/google-cast/ | TV devices disabled by default, limitations |
| S16 | https://www.music-assistant.io/faq/groups/ | sync vs universal groups |
| S17 | https://www.music-assistant.io/integration/ | three pieces, integration overview |
| S18 | https://raw.githubusercontent.com/home-assistant/core/dev/homeassistant/components/music_assistant/ (`manifest.json`, `entity.py`, `media_player.py`, `button.py`, `number.py`, `select.py`, `switch.py`, `text.py`, `__init__.py`) | entities, device registry identifiers, subscriptions |
| S19 | https://www.music-assistant.io/ha-plugin/ | plugin purpose, controls |
| S20 | https://raw.githubusercontent.com/music-assistant/server/dev/music_assistant/providers/hass/ (`manifest.json`, `control_entities.py`) | control entity domains |
| S21 | https://www.music-assistant.io/player-support/ha/ and https://www.music-assistant.io/player-support/home-assistant/ | HA Media Players provider |
| S22 | https://raw.githubusercontent.com/music-assistant/server/dev/music_assistant/providers/hass_players/ (`manifest.json`) | provider metadata |
| S23 | https://www.home-assistant.io/integrations/music_assistant/ | entities, actions, known limitations (duplicates, queue data) |
| S24 | https://raw.githubusercontent.com/music-assistant/server/dev/music_assistant/providers/hass_players/constants.py and `provider.py` | blocklists, native duplicate logic, player_id = entity_id |
| S25 | https://raw.githubusercontent.com/music-assistant/server/dev/music_assistant/providers/hass_players/helpers.py and `player.py` | `play_media` filter, feature mapping, "External" source |
| S26 | https://www.music-assistant.io/player-support/sonos/ | Sonos generations; HA Sonos + MA S1 conflict |
| S27 | models `player.py` (S37) | `expose_to_ha`, `hide_in_ui` |
| S28 | `_handle_jsonrpc_api_command` in S8 `controller.py` | JSON-RPC behaviour |
| S29 | https://raw.githubusercontent.com/music-assistant/models/main/music_assistant_models/api.py | message models, server-info |
| S30 | https://raw.githubusercontent.com/music-assistant/server/dev/music_assistant/controllers/webserver/websocket_client.py and `auth.py` | auth flow, event filtering, impersonation, token docstring (also `2.10.4/.../auth.py`) |
| S31 | models `errors.py` (same repo) | error codes |
| S32 | models `auth.py`; server `controllers/webserver/helpers/auth_middleware.py` (dev and 2.10.4) | roles, scopes, player_filter |
| S33 | server `controllers/player_queues/controller.py` (dev and 2.10.4) | queue commands |
| S34 | server `controllers/music/controller.py`, `music/media/*.py`, `config/*.py`, `mass.py`, `tasks/controller.py` | music/config/system commands |
| S35 | server `controllers/config/players.py`, `controllers/players/controller.py` | power/volume/mute control options (`none`, `native`, `fake`) |
| S36 | models `enums.py` (`EventType`), `event.py` | events |
| S37 | models `player.py`, `player_queue.py`, `queue_item.py`, `media_items/media_item.py`, `media_items/provider_mapping.py`, `enums.py` (tag `1.1.205` and `main`) | data model |
| S38 | https://www.music-assistant.io/player-support/dlna/ and https://www.music-assistant.io/player-support/airplay/ | DLNA/AirPlay behaviour, silent-playback issue on some Samsung devices |
| S39 | https://www.music-assistant.io/faq/networking/ | mDNS, flat network, ports |
| S40 | repo documents `docs/changes/CR-007-DEVICE-CONTROL.md`, `docs/security/HA_IDENTITY_RBAC_HE.md` | existing permission model to align with |

### UNVERIFIED (consolidated)

- The MA and HA versions installed in the owner's lab or production systems (nothing was contacted).
- The content of `/api-docs/commands.json` and `/api-docs/openapi.json` from a live server (route names only); the command list above was reconstructed from the source of tag 2.10.4 and `dev`.
- Exact wire shape of most `result` values (they are the models in section 3 serialised by mashumaro/orjson; `auth` result shape was read from source).
- ~~Whether `player_filter` can be set through the API on release 2.10.4, and long-lived token lifetime (1 vs 10 years).~~
  Resolved 2026-10-01: yes, and 1 year (2.3, [S47]).
- Whether MA re-exposes HA-imported players back to HA by default, and whether 8095 is reachable from our add-on in a
  HAOS setup (the MA add-on is on the host network [S47]; our container's route to it is untested).
- That the HA `cast`/`samsungtv`/`webostv` integrations register MAC `connections` or a Cast-UUID unique id usable for joins; must be checked on real registry data (redacted).
- How specific TV integrations (Samsung, LG, Android TV, Sony) behave when their AirPlay/Cast/DLNA endpoints are also seen by MA in this lab.
- The `music-assistant-client` Python library internals (only its pinned version in the HA manifest was read).
- `players/cmd/*` behaviour when a player is on a native source/external input (only documented in source comments).

---

## 8. Update 2026-10-01: players, speakers and groups (release 0.1.150, CR-016)

All fetched 2026-10-01 from public sources (GitHub API, `raw.githubusercontent.com`, registries, docs pages). Sources
S41-S50 are listed in 8.7. Nothing of the owner's systems was contacted; the only facts about the owner's systems are
the counts from the read-only inventory of 2026-09-30 (one of the owner's systems runs the MA HA integration with 11
MA players next to Cast, Onkyo, WiiM/LinkPlay, DLNA, SmartThings and Samsung entities; which MA providers are set up
is unknown).

### 8.1 The Music Assistant organisation beyond the server [S43]

| Repo | Purpose | Language | Licence | Last push | Latest release |
|---|---|---|---|---|---|
| `server` | MA server | Python | Apache-2.0 | 2026-09-30 | stable **2.10.4** (2026-09-18, schema 65, models 1.1.205); beta **2.11.0b3** (2026-09-28, schema 80, models 1.1.213) |
| `models` | shared models | Python | Apache-2.0 | 2026-09-28 | 1.1.214 |
| `client` | PyPI `music-assistant-client` | Python | Apache-2.0 | 2026-09-30 | v1.6.0 (2026-09-30) |
| `frontend` | the Vue 3 / TypeScript web UI | TypeScript | Apache-2.0 | 2026-09-30 | 2.17.327 |
| `mobile-app`, `desktop-app` | official companion apps | Kotlin, Rust | Apache-2.0 | 2026-09 | android 0.13.0 / desktop 0.6.9 |
| `home-assistant-addon` | HA add-on (stable + beta) | Shell | none detected | 2026-09-30 | 2.10.4 (beta 2.11.0b3) |
| `music-assistant.io`, `developers.music-assistant.io` | user and developer docs | Astro, CSS | Apache-2.0 | 2026-09 / 2026-07 | - |
| `hass-music-assistant` | the old custom integration | Python | Apache-2.0 | 2025-01 | deprecated (the integration is in HA core) |
| `signaling-server`, `cast-receiver`, `voice-support`, `intents`, `shared-icons`, provider libraries (`aiosonos`, `aioslimproto`, ...) | infrastructure / providers | mixed | mostly Apache-2.0 (some MIT, one GPL-3.0: `airplay-cli`) | - | not needed by us |

- There is **no official JS/TS client** in the org. A community npm package `music-assistant-client` 0.1.0 (MIT,
  created 2026-09-26, five days old) claims typed models for all commands and auto-reconnect: unproven, reference
  only. Sendspin (the browser/"this device" streaming protocol) lives in its own organisation.
- 2.11 (beta) changes that touch us: favourites become **personal** (per MA user, with "dislike"); admin-created
  custom roles; announcement volume applied consistently on grouped speakers; announcements on out-of-sync groups
  fixed; many group-lifecycle fixes [S44]. Everything below is written against **2.10.4** and must feature-detect on
  `schema_version`.

**Python client (`music-assistant/client`, Apache-2.0) [S44].** Built against schema 46; refuses only a server whose
`min_supported_schema_version` is above 46; token mandatory from schema 28; per-command schema gates (`play_announcement`
with `message`/`tts_engine` ≥ 46, `transfer` ≥ 25, impersonation ≥ 35, `music/recommendations` ≥ 33). Lifecycle:
`ws_connect(heartbeat=55)`, first message ServerInfo, then an initial fetch of `providers`, `player_queues/all`,
`players/all`, then the read loop. **No built-in reconnect**: the caller (HA) reconnects and rebuilds state. Partial
results are buffered per `message_id` and merged. It caches players and queues (whole object replaced on
`player_updated` / `queue_updated`; `queue_time_updated` patches elapsed time) but **not queue items**. Helper names
match the commands in 2.4; `play_media(..., radio_mode=True)` is rewritten to a `radio_playlist://playlist/<seed uri>`
item from schema 34.

**Web frontend (`music-assistant/frontend`, Apache-2.0) - UX patterns (ideas, not code) [S45]:**

- *Player list*: hides players that are disabled, unavailable, `hide_in_ui`, **synced to another** (`synced_to`) or
  inside an **active group** (`active_group`), and players outside the user's `player_filter`; order = selected,
  then playing, then alphabetical; search above a threshold.
- *Volume*: a group or a sync leader with members shows **one group slider** (`group_volume`, balance kept by the
  server) plus a **pop-out with one slider per member**; single players use `volume_set`; slider disabled when
  unavailable, `powered == false` or no `VOLUME_SET`; live drag throttled to 100 ms (up to 500 ms for large groups).
- *Grouping*: a checkbox picker offered only with `SET_MEMBERS`, candidates from `can_group_with`, excluding
  unavailable players and players in another group; static members locked; edits debounced 500 ms into **one
  `set_members(target, add[], remove[])`**; on failure it re-reads the player. Removing the leader while playing asks
  "stop and ungroup?" first.
- *Queue*: virtualised list, pages of 50 via `player_queues/items(limit, offset)`, invalidated by
  `queue_items_updated`; rows at or before `index_in_buffer` are locked (already sent to the device); item menu = play
  now (`play_index`), play next, move to end, delete, "start radio from this".
- *Radio vs stations*: "radio" from a track/artist/album/playlist is a dynamic playlist
  (`radio_playlist://playlist/<seed>`); live radio **stations** are `radio` items played with `play_media` (replace).
- *Announcements*: a dialog with text, a pre-announce toggle, an optional volume override, and the TTS engine.
- *Party / guest layout*: a simplified surface with a reduced queue (`GuestLayout`, `party/*`).

### 8.2 What Home Assistant alone gives us (the MA integration's actions) [S46]

The HA `music_assistant` integration exposes, per the core `services.yaml` and `media_player.py` (dev branch):

| Action | Fields | Returns / effect | Useful for 0.1.150 |
|---|---|---|---|
| `music_assistant.play_media` | `media_id`* (URI, library id or name), `media_type` (artist, album, audiobook, folder, playlist, podcast, track, radio), `artist`, `album`, `enqueue` (play, replace, next, replace_next, add), `radio_mode`, `username` | plays on the active queue (or the player's own) | start a favourite / station / playlist |
| `music_assistant.get_queue` | entity | **response**: `queue_id`, `active`, `name`, `items` (a **count**), `shuffle_enabled`, `repeat_mode`, `current_index`, `elapsed_time`, `current_item`, `next_item` (each: `queue_item_id`, `name`, `duration`, `media_item`, `stream_title`, `stream_details`) | "now" and "up next" only - **not the whole list** |
| `music_assistant.get_library` | `config_entry_id`, `media_type`, `favorite`, `search`, `pagination{limit ≤ 500, offset}`, `order_by` (name, timestamp_added, last_played, play_count, ...), `album_type[]`, `album_artists_only`, `username` | **response**: library items | favourites, stations, playlists lists |
| `music_assistant.search` | `config_entry_id`, `name`, `media_type[]`, `artist`, `album`, `search_options{limit ≤ 100, library_only}` | **response** | search (later) |
| `music_assistant.transfer_queue` | entity (target), `source_player`, `auto_play` | moves the queue | "move the music to this room" |
| `music_assistant.play_announcement` | `message` + `tts_entity_id`, or `url`; `use_pre_announce`, `pre_announce_url`, `announce_volume` 1-100 | HA renders TTS to a URL, MA plays it (ducks, restores) | announcements (optional) |
| `media_player.join` / `unjoin` | `group_members` (entity ids) on a `GROUPING` target | MA maps join to `players/cmd/group_many(target, [ids])` (entity `unique_id` → MA player id) and unjoin to `players/cmd/ungroup` | dynamic sync groups |
| standard `media_player.*` | `media_play/pause/next/previous/seek`, `shuffle_set`, `repeat_set`, `volume_set`, `volume_mute`, `turn_on/off`, `select_source` | as usual | transport, volume |

- HA integrations that implement `async_join_players` in core (grep, not exhaustive): sonos, squeezebox, linkplay,
  music_assistant, bluesound, heos, snapcast, yamaha_musiccast, wiim, bang_olufsen, forked_daapd. **`cast` has no join.**
- What HA does **not** give: the full queue list and queue edits (move/delete/clear), `can_group_with` (which players
  may join which), MA `group_volume` (balance-keeping) as a separate control, `static_group_members`, events for queue
  items, and MA's `output_protocols`. These need a direct MA connection (5.1).
- The HA state of an MA entity carries `group_members`, `mass_player_type`, `active_queue`, `media_title`,
  `media_artist`, `media_album_name`, `media_duration/position`, `shuffle`, `repeat`, `entity_picture` - enough for
  now-playing, artwork (through our proxy), shuffle/repeat and live group membership.

### 8.3 The two r11a repositories (HOMEii) [S41][S42]

The owner pointed at two public repositories by the same author. They are **one product in two halves**, released as a
pair (card 6.0.2 needs engine 1.0.2): a Home Assistant custom integration that talks to MA, and a Lovelace card that talks
only to that integration.

| | `r11a/homeii-flow-engine` [S41] | `r11a/homeii-music-flow` [S42] |
|---|---|---|
| What | HA custom integration, domain `homeii_flow` (hub, `local_push`); "not an add-on or a Music Assistant server" | Lovelace custom card `custom:homeii-music-flow` (HACS "Dashboard"); since v6 works **only** with the engine |
| Language / size | Python (about 600 KB); `runtime.py` alone is about 6,300 lines | JavaScript, Vite build; `src/homeii-music-flow.js` about 19,000 lines plus `src/core/*` |
| License | **No LICENSE file** (GitHub `license: null`, raw `LICENSE` 404); only `pyproject.toml` says `license = { text = "MIT" }`. Treat as **all rights reserved: ideas only** | **MIT** (LICENSE file, no named holder). Bundles Lucide icons, the Heebo font (OFL), `sendspin-js` and embla-carousel, each with its own licence notice |
| Maturity | Created 2026-06-12, last push 2026-09-27, 10 commits, 4 stars, tags v1.0.0-beta.1 … v1.0.2, default branch `codex/v6-engine-candidate`, `hacs.json` (custom repo, HA ≥ 2025.1), 13 test files (not run: UNVERIFIED that they pass) | Created 2026-04-26, last push 2026-09-27, 155 commits, 164 stars, 17 forks, 6 open issues (one is a grouping bug in 6.0.0), many releases 5.7 … 6.0.2, Vitest tests (not run) |

**How the engine talks to MA and HA** (read from `runtime.py`, `ma_client.py`, `websocket_api.py`, `onboarding_auth.py`):

- Its **own persistent authenticated MA WebSocket** (`/ws`, then `auth` with a token); requires MA schema ≥ 63. The
  official `music_assistant` HA integration is a manifest dependency, used for `music_assistant.play_announcement`,
  `music_assistant.search` and for mapping MA players to HA entities - not for playback commands.
- MA commands used: `players/all`, `players/cmd/{play,pause,stop,next,previous,volume_set,volume_mute}`; grouping with
  **`players/cmd/set_members`** (`target_player`, `player_ids_to_add`, `player_ids_to_remove`: "apply group" as a diff),
  `group_many`, `ungroup` - never HA `media_player.join/unjoin`; queues `player_queues/{get_active_queue,get,items,all,
  play_media,transfer,seek,shuffle,repeat,move_item,delete_item,clear,autoplay,crossfade,set_playback_speed}` (paged
  reads; a partial snapshot is rejected, not shown as empty); library `music/{search,browse,recommendations,
  recently_played_items,in_progress_items,item_by_uri}`, `music/favorites/add_item|remove_item`; MA 2.11-beta
  `ai_radio/*` (UNVERIFIED in any release we target).
- Towards HA: a config flow ("automatic" = MA username + password, used once to mint a token; or "manual" = paste a
  token); the token lives in the HA config entry, never in card YAML; about 60 `homeii_flow/*` HA WebSocket commands
  (`players/get`, `player/command`, `group/apply`, `queue/get`, `queue/action`, `volume_rules/set`, `timers/set`,
  `schedules/set`, `announce`, ...), HA actions (`homeii_flow.player_command`, `announce`, `set_volume_rule`, ...),
  entities on six platforms (a calendar of schedules among them), artwork proxied through HA, and a generic
  `ma/command` passthrough filtered by prefix (`players/`, `player_queues/`, `music/`, `metadata/`, `audio_analysis/`)
  with create/update/delete/sync blocked. Admin-only writes check `connection.user.is_admin`.
- Announcements: a URL goes to `music_assistant.play_announcement` with `announce_volume`; text goes through
  `tts.speak` (legacy `tts.*_say` fallback).
- **Volume rules**: per player `max_volume` 0-100 with optional days and a time window (wrapping past midnight),
  enforced by a periodic loop (about every 10 s) that lowers a player **after** it exceeded the ceiling
  (`media_player.volume_set`). No confirmation dialogs were found for destructive actions.

**The card's UX** (README, `docs/features.md`, `docs/layouts.md`, `src/core/media/*.js`): main player (artwork, title,
artist, provider badge, progress, volume + mute, shuffle/repeat, transport, rotating quick-action "wheels"); a
Studio / Control Room multi-room surface for tablet and desktop; a Players screen; a queue screen (search, play now,
play next, add, remove, move, clear); a library (playlists, artists, albums, tracks, radio, liked), lyrics, history,
recommendations; a guided "FLOW" wizard (player → mood → playlist / artist / artist radio / library radio); typed TTS
with up to 3 preset messages and optional browser dictation; a screensaver and night mode; panel / section / masonry
layouts and phone modes; real Hebrew/RTL (`src/localization/he`, Heebo). **Group volume** is a per-member fan-out
(`_setGroupVolumeFor`: one level to every non-static member in parallel, `Promise.allSettled`, a toast naming the
rooms that failed) - not MA's `group_volume`. Group membership is derived client-side from entity attributes
(`speaker-groups.js`), excluding browser players and static members.

**What transfers to Arx (ideas only, re-implemented from the public MA/HA APIs):**

1. **One server-side MA/HA gateway, the browser never sees a token** - which is what CR-015 already does for HA.
2. **Group editing as a diff** (`set_members` add/remove lists, or HA `join`/`unjoin` computed from the desired set),
   followed by a read-back of the real membership rather than trusting the request.
3. **Honest snapshots**: a partial or stale queue is shown as "unavailable", never as empty (our `confirmed` flag).
4. **Group volume as a per-member fan-out with a per-room outcome** ("הסלון לא אישר") - the same honest-outcome pattern
   as our bulk engine; plus a real group slider only where MA offers `group_volume`.
5. **Volume ceilings per player with an optional night window** - but enforced **in the command path before
   sending** (clamp), not by a loop after the fact.
6. **Announcement presets** (a few fixed messages chosen by an administrator) rather than free text.
7. **A "start something" shortcut** per room: favourites and radio as one tap, before any library browsing.
8. **Room-first multi-room surface** (Control Room) - maps to our cards grouped by floor/room.

**What NOT to adopt:**

1. Any engine code (no license) and any card code or CSS (MIT, but our rule is ideas only; its 19,000-line single file
   and visual effects do not fit our glass/UniFi language).
2. A second integration inside HA as the gateway: Arx already has its add-on backend and the signed bridge; adding the
   engine would put a third authority (card → engine → MA) next to ours.
3. MA **username + password** onboarding: our rule is owner-created tokens only.
4. A generic command passthrough, even prefix-filtered: we expose typed commands only.
5. Reactive volume clamping (a speaker may blast for up to 10 s before the loop lowers it).
6. Browser speech dictation for announcements (the project's own open issue asks to move to HA Assist STT).
7. Schedules, timers, AI radio DJ, lyrics lookups, artwork-driven lights and the browser "this device" player
   (Sendspin): out of scope for 0.1.150; schedules already have their own product path (CR-014).
8. HA branding and entity ids in operator text (our rule: "תשתית המערכת").

### 8.4 Volume limits and announcements - what MA already enforces [S44][S48]

- **Per-player `min_volume` / `max_volume`** (0-100, default 0 and 100) in MA's player settings **rescale** the logical
  level: API level 0-100 maps onto min..max on the device (`controllers/players/controller.py`). A limit an installer
  sets in MA is therefore transparent to every client and cannot be bypassed by one. Our own `volume_max` ceiling
  (CR-015) is a second, product-level clamp on top.
- **Announcement volume**: `announce_volume_strategy` = `absolute | relative | percentual` (default) `| none`,
  `announce_volume` 85, `announce_volume_min` 15, `announce_volume_max` 75, `tts_pre_announce` true (2.10.4
  `constants.py`, `announcements.py`). Min and max clamp **every** result, including an explicit `volume_level` from
  the API (the docs page suggests "absolute bypasses min/max"; the code does not). MA pauses the music, powers the
  player on if needed, plays, restores and powers it off again; groups announce on every child (volume per child).
  ESPHome and some HA media players are unreliable targets [S48].
- **Favourites** in 2.10.4 are a library-level flag (`music/favorites/add_item` has no user argument); per-user
  favourites arrive with 2.11. Through HA, "favourites" are therefore the installation's MA favourites.
- **Autoplay / "don't stop the music"** is per queue (`player_queues/autoplay`); "Endless Mix" locks autoplay on.
- **Sleep timer**: `players/sleep_timer/get|set|clear` (MA only, not through HA).

### 8.5 Revised connection recommendation for 0.1.150

Section 5.1 recommended a backend-held direct MA connection as the end state; it still is for full queues. For the
first players release the evidence above changes the **order**:

1. **0.1.150: through Home Assistant only.** Every command goes to the MA-created HA `media_player` entities (and the
   vendor entities) through the existing signed bridge with the caller's HA context - the CR-015 command path,
   unchanged. MA data that HA returns (`get_queue`, `get_library`) is read through one allow-listed bridge read
   service. Gains: no MA account, no MA token, no second authority, no port-8095 reachability question, no 1-year
   token renewal, and the same code serves a system **without** MA (vendor players only). Cost: "now + up next"
   instead of the whole queue; no queue editing; group volume as a per-member fan-out instead of MA `group_volume`;
   no `can_group_with` (join outcome is read back instead); favourites are the installation's.
2. **Later (0.1.151+, only on the owner's word): a read-mostly direct MA client** from the add-on (dedicated `user`
   account with a `player_filter`, token in our secrets store, own reconnect loop with 1 s × 1.5 backoff capped at
   30 s - neither the Python client nor HA gives one for free, schema gate ≥ 65) for the full queue list, queue edits,
   `group_volume` and `can_group_with`. Endpoints `ma:<player_id>` are already reserved in the CR-015 model; rung 2
   (MA loop) joins them to the HA entities exactly.

### 8.6 New UNVERIFIED items (2026-10-01)

- How MA's HA entity maps `volume_set` on a **sync leader** or a **group player**: member volume or group volume.
- Whether `get_library` with `favorite: true` returns the favourites the owner expects (library flag in 2.10.4).
- Join behaviour across integrations on the owner's hardware (WiiM through `linkplay`/`wiim` vs through MA; Cast has
  no join); which MA providers (AirPlay, Cast, DLNA, LinkPlay, Snapcast) the owner's MA uses.
- Size and shape of `get_library` / `get_queue` responses on a real library (image URLs in `media_item.metadata`
  are provider or MA-proxy URLs: never forwarded to the browser).
- Whether the r11a tests pass (not run) and the r11a card's real group-volume behaviour on hardware.
- The owner's MA and HA versions (not contacted).

### 8.7 Sources for section 8 (all fetched 2026-10-01, public)

| ID | URL | Used for |
|----|-----|----------|
| S41 | https://github.com/r11a/homeii-flow-engine (API: repo, languages, tags, releases, commits, tree of `codex/v6-engine-candidate`); raw `README.md`, `hacs.json`, `pyproject.toml`, `LICENSE` (404), `custom_components/homeii_flow/{manifest.json,services.yaml,runtime.py,ma_client.py,websocket_api.py,config_flow.py,onboarding_auth.py,const.py,queue_controls.py,sendspin_bridge.py}` | engine architecture, MA commands, licence status, volume rules |
| S42 | https://github.com/r11a/homeii-music-flow (API: repo, issues, tree of `main`); raw `README.md`, `LICENSE`, `hacs.json`, `package.json`, `docs/features.md`, `docs/layouts.md`, `src/homeii-music-flow.js`, `src/core/engine-client.js`, `src/core/media/{speaker-groups,volume-rules,player-volume,ai-radio}.js`; https://api.github.com/users/r11a/repos | card UX, group volume fan-out, licence |
| S43 | https://api.github.com/orgs/music-assistant/repos?per_page=100; npm registry entries `music-assistant-client`, `@sendspin/sendspin-js`, `mass-queue-types` | repo table |
| S44 | https://github.com/music-assistant/client (`music_assistant_client/{client,connection,constants,players,player_queues,music,auth}.py`, `pyproject.toml`); https://api.github.com/repos/music-assistant/server/releases?per_page=5 and https://github.com/music-assistant/server/releases/tag/2.11.0b3 | client lifecycle, schema gates, 2.11 changes |
| S45 | https://github.com/music-assistant/frontend (`src/plugins/api/index.ts`, `remote/websocket-transport.ts`, `helpers/players.ts`, `useOrderedPlayers.ts`, `PlayerVolume.vue`, `PlayerGroupMembers.vue`, `useFullscreenQueue.ts`, `useQueueDragReorder.ts`, `queue_item_menu_items.ts`, `helpers/radio.ts`, `PlayAnnouncementDialog.vue`); server `2.10.4/music_assistant/models/player.py`; https://www.music-assistant.io/ui/ | UX patterns, `group_volume` = maximum |
| S46 | https://github.com/home-assistant/core/tree/dev/homeassistant/components/music_assistant (`services.yaml`, `media_player.py`); grep of `async_join_players` across `homeassistant/components/*/media_player.py` | HA actions and response shapes, join mapping |
| S47 | server `2.10.4` and `2.11.0b3` `music_assistant/controllers/webserver/auth.py`; https://github.com/music-assistant/home-assistant-addon (`music_assistant/config.yaml`, beta directory) | token lifetime, `player_filter` via API, host network |
| S48 | https://www.music-assistant.io/integration/announcements/, https://www.music-assistant.io/faq/groups/, https://www.music-assistant.io/settings/individual-player/, https://www.music-assistant.io/usage/; server 2.10.4 `constants.py`, `controllers/players/announcements.py`, `controllers/players/controller.py` | announcement volume, min/max volume scaling, groups, autoplay |
| S49 | repo documents `docs/changes/CR-015-MEDIA-SCREENS.md`, `docs/architecture/MEDIA_API.md` (branch `integ/0.1.149`) | what 0.1.150 reuses |
| S50 | the read-only media inventory of the owner's systems, 2026-09-30 (counts and platform names only; project memory) | which integrations exist |

Licences, in one line each: MA server/models/client/frontend **Apache-2.0** (reuse would require the notice; we take
ideas only); `homeii-music-flow` **MIT**; `homeii-flow-engine` **no licence file** (all rights reserved); community npm
`music-assistant-client` MIT (unproven).
