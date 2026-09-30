# Music Assistant (MA) - API, data model and integration notes for the SmplWise media-device UI

Research for release 0.1.149 (TVs and media). Public web only; no device, Home Assistant or lab system was
contacted, and `secrets/` / `private-evidence/` were not read. Fetched 2026-09-30.

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
| Bind | Default 8095. On HA OS the add-on also serves Ingress on 8094 (HA docker network only, trusts HA user headers) [S8] - whether 8095 is reachable from our add-on in the lab is UNVERIFIED |

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
  Long-lived lifetime is documented as 10 years in the dev README but the 2.10.4 docstring says 1 year and "no
  auto-renew" - treat as **1 year** and plan renewal. They cannot be created for guest accounts. Created with
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
  in `auth/user/create` and `auth/user/update` (dev; availability in release UNVERIFIED) [S30][S32].
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
| `volume_level` (0-100), `volume_muted`, `group_volume`, `group_volume_muted` | group values are averages; `group_volume` is serialised as 0 when null (compat) |
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
9. **Volume semantics**: group vs member volume; MA group volume is an average; announcement volume has its
   own strategy; a volume command on a muted player may be locked at 0.
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
- Whether `player_filter` can be set through the API on release 2.10.4, and long-lived token lifetime (1 vs 10 years).
- Whether MA re-exposes HA-imported players back to HA by default, and whether 8095 is reachable from our add-on in a HAOS setup.
- That the HA `cast`/`samsungtv`/`webostv` integrations register MAC `connections` or a Cast-UUID unique id usable for joins; must be checked on real registry data (redacted).
- How specific TV integrations (Samsung, LG, Android TV, Sony) behave when their AirPlay/Cast/DLNA endpoints are also seen by MA in this lab.
- The `music-assistant-client` Python library internals (only its pinned version in the HA manifest was read).
- `players/cmd/*` behaviour when a player is on a native source/external input (only documented in source comments).
