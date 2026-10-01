# Media probe of the second owner system (multimedia phase 2) - 2026-10-01

Read-only inspection of one owner-operated Home Assistant system (labelled "system-H" here) for the speakers / players /
groups / Music Assistant part of CR-015 / CR-016. Everything below is anonymised: counts, flag shapes and cluster shapes
only. No names, entity ids, device ids, MACs, addresses, account names, library content or area names appear here.
Raw dumps stay in the git-ignored `private-evidence/hoffnung-media/`.

## Method and limits

- WebSocket reads only, from an allow-list: `auth`, `get_config`, `get_states`, `config/entity_registry/list`,
  `config/device_registry/list`, `config/area_registry/list`, `config/floor_registry/list`, `get_services`, and one
  Supervisor GET (`/addons`, the add-on list, through the existing `supervisor/api` proxy pattern). No service was called,
  nothing was played, joined, changed or restarted.
- The dedupe ladder was run with the real `services/media_model.py::build` of branch `integ/0.1.149` (read-only import) over the
  live registry, plus a looser name comparison to estimate what the ladder cannot see.
- Not readable with the allowed reads: the config-entry list (so the MA config-entry state is inferred from entity states,
  not read), the MA server's own player list, and the integration versions other than the add-on.
- Snapshot of one moment: 36 registered `media_player` entities, 33 enabled, 3 `remote`, 1479 states, 618 devices,
  20 areas on 3 floors. HA core 2026.9.4.

## (1) Music Assistant

- Installed as the **add-on** (started, 2.10.4, equal to the latest available version). It is the only media add-on;
  the add-on list has 17 entries (12 started, 4 stopped, 1 in error state - not the MA one).
- The HA `music_assistant` integration is **loaded** (component present; one config entry; 11 `media_player` + 11 `button`
  entities, no other domains). State inferred: the entry is loaded (7 of its 11 players are live `idle`). The other 4
  players are `unavailable`, 3 of them with `restored: true` (registry-only, not provided this session) and 1 genuinely
  unavailable. The `restored` ones keep a degraded feature mask (see section 2).

## (2) media_player inventory (36 registered, 33 enabled)

By platform (registered): music_assistant 11, cast 9, onkyo 4, samsungtv_smart 2, smartthings 2, wiim 2, dlna_dmr 2,
linkplay 2 (disabled), spotify 1 (disabled), androidtv_remote 1. Not present: sonos, airplay, heos, denonavr, musiccast.

Excluded from the 33: 3 disabled by the config entry (2 linkplay, 1 spotify - no state at all), 0 disabled by the user.
3 cast entities are **hidden by the user** but still enabled and live (state `off`).

Kinds (by `device_class` / platform): screens 5 by device class `tv` (2 samsungtv_smart, 2 smartthings, 1 androidtv_remote)
plus 2 dlna_dmr TV renderers and 5 cast entities that belong to TVs (cast model names); receivers 4 (onkyo; no device class);
speakers 17 by device class `speaker` (11 MA, 4 cast, 2 wiim). Device class is **absent** on 11 enabled players (5 cast, 4
onkyo, 2 dlna_dmr), so the kind needs the platform / model heuristic.

State distribution (33 with state): `off` 10, `idle` 9, `unavailable` 9, `on` 5, `playing` 0, `paused` 0, `standby` 0.
Nothing was playing at the snapshot. Cast speakers sit at `off` (not `idle`) when no app runs; MA and wiim report `idle`; the
TVs report `off` / `on`; onkyo receivers `on`.

Feature flags seen (count of the 33 players): PLAY_MEDIA 29, PAUSE/STOP/PLAY/VOLUME_MUTE 25, VOLUME_SET 24, BROWSE_MEDIA 23,
TURN_ON/TURN_OFF/PREV/NEXT 18, VOLUME_STEP 16, SEEK 13, SELECT_SOURCE 12, CLEAR_PLAYLIST / SHUFFLE_SET / REPEAT_SET /
MEDIA_ANNOUNCE / MEDIA_ENQUEUE / SEARCH_MEDIA 11 (all exactly the MA entities), **GROUPING 9** (7 MA + 2 wiim),
SELECT_SOUND_MODE 2 (onkyo). Shapes per platform:

| platform | masks (distinct) | notable |
|---|---|---|
| music_assistant, live full player | 2 (8320575, 8322623) | volume, mute, grouping, announce, enqueue, search, browse, shuffle, repeat; the second adds SELECT_SOURCE (line-in style source list of 5) |
| music_assistant, unavailable | 1 (7795251) | no VOLUME_SET, no GROUPING: a degraded mask - **capabilities must not be read from an unavailable player** |
| cast | 2 | volume, mute, pause/play/stop, turn on/off, play_media, browse; **no GROUPING**, no shuffle/repeat, no source list; attributes are minimal |
| wiim | 1 | volume, mute, transport, SELECT_SOURCE, BROWSE_MEDIA, GROUPING; **no PLAY_MEDIA announce/enqueue** |
| onkyo | 2 | volume set/step/mute, on/off, PLAY_MEDIA, SELECT_SOURCE; one of the two variants adds SELECT_SOUND_MODE; state `on` with no transport flags |
| samsungtv_smart / smartthings / androidtv_remote | 1 each | TV shape: turn on/off, volume, SELECT_SOURCE on the first two; the Android TV has no source list and no VOLUME_SET |
| dlna_dmr | 1 (mask 0) | unavailable, empty feature set |
| linkplay / spotify | - | disabled, no state |

Not used by any player here: SELECT_SOUND_MODE outside onkyo, group-type `mass_player_type` (all 7 live MA players are
`player`; no `group` / `stereo_pair` / `protocol` types seen).

`group_members` is exposed by 9 players: 7 MA (2 with more than one member) and 2 wiim (both with 2 members). The MA
attribute is an empty list when ungrouped; wiim always lists itself. Cast exposes none. Attribute key set of a live MA
player: `active_queue`, `app_id`, `mass_player_type`, `group_members`, `source_list`, `media_*`, `volume_level`,
`is_volume_muted`, `shuffle`, `repeat`, `entity_picture(_local)`.

## (3) Duplication and the dedupe ladder

Ladder result (`build` skips disabled entities): **36 enabled endpoints (33 players + 3 remotes) -> 31 device clusters** (cluster
sizes: 28 x1, 1 x2, 2 x3). Endpoints merged per rung: rung 1 (same HA device) 6, rung 3 (shared MAC) 2, rung 2 (MA loop) **0**,
rung 4 (shared identifier) **0**; rung 5 suggestions **0**. All 3 multi-endpoint clusters are
the Samsung-family TVs and the Android TV: samsungtv_smart + dlna_dmr (joined by a shared MAC, guard not triggered) + its `remote`
(same device); androidtv_remote + its `remote`. Cluster kinds: 5 screens, 17 speakers, 9 players.

What the ladder does **not** merge (the duplication pattern of this system):

- **MA-created entities are never merged with the vendor entity.** All 11 MA players have a 14-character MA id (9) or a
  prefixed token (2); none equals a cast UUID, none is an HA entity id. Rung 2 therefore never fires, and rung 4 skips
  `music_assistant` identifiers by design.
- Two MA players (prefixed-token ids) **embed** the wiim / linkplay identifier as a substring. A "substring after stripping the MA
  prefix" match would merge those 2 wiim+MA pairs; the current rules cannot.
- A looser comparison (normalised device name, ignoring brand words) groups the 31 clusters into **7 multi-cluster groups
  covering 19 clusters, plus 12 singletons, i.e. about 19 physical devices, not 31**:
  - TV-A: samsung vendor cluster (3 endpoints) + cast + smartthings + MA player (4 clusters; 6 endpoints).
  - Android TV: vendor cluster (2 endpoints) + cast + MA player (3 clusters).
  - 3 x cast + MA pair, and 1 x cast + smartthings pair.
  - 2 x WiiM speakers: wiim + cast + MA (3 clusters each).
  - Singletons: 5 MA-only, 4 onkyo (no duplicate), 2 cast-only, 1 TV vendor cluster without a twin.
- Name equality is not confirmed by an area: only 12 of the 31 clusters carry an area, and in every name-equal group at most one
  member has one (the vendor / cast device). So rung 5 (same area + same normalised name) suggests **nothing** here; it
  fails on the missing area of the MA and cast devices, not on the names.
- Typical duplication per physical thing: a TV appears up to 4 times (vendor, cast, smartthings, MA); a WiiM speaker 3 times
  (wiim, cast, MA); a cast speaker 2 times (cast, MA). MA exposes **all** of them, so it is the superset inventory.
- The same physical pair of WiiM speakers is a group twice: a wiim group (both members) and an MA group (both members).
- The 2 disabled linkplay entities are the older entities of the same 2 WiiM speakers: name-equal, and each shares an identifier
  substring with its wiim device, but not an exact identifier, so no rung would merge them (they are disabled, so they never enter).
- Devices: 29 devices carry media entities; 5 have a MAC connection (6 MAC connections, 2 `upnp` connections); 0 are attached to
  more than one config entry; all 29 have a manufacturer. Identifier domains: music_assistant 11, cast 9, wiim 2,
  samsungtv_smart 2, smartthings 2, androidtv_remote 1, samsungtv 1. There is no shared device between MA and any vendor.

## (4) Services (names and fields)

`media_player` (HA core): `join` (field `group_members`, entity list; target needs feature GROUPING), `unjoin` (no fields;
GROUPING), `play_media` (fields `media` (selector), `enqueue` (filter: MEDIA_ENQUEUE), `announce` (filter: MEDIA_ANNOUNCE);
target needs PLAY_MEDIA), `browse_media` (`media_content_type`, `media_content_id`; target needs BROWSE_MEDIA; **returns a
response**), `search_media` (`search_query`, optional type / id / filter classes; target needs SEARCH_MEDIA; **returns a
response**), `volume_set`, `select_source`, `select_sound_mode`, `shuffle_set`, `repeat_set`, `clear_playlist`,
`volume_up/down/mute`, `media_*`, `turn_on/off`, `toggle`; plus one onkyo-specific service (HDMI output).

`music_assistant`: `play_media` (fields `media_id` object, `media_type`, `artist`, `album`, `enqueue`, `radio_mode`,
`username`; target: MA player with PLAY_MEDIA), `play_announcement` (`url`, `use_pre_announce`, `pre_announce_url`,
`announce_volume`; target needs PLAY_MEDIA + MEDIA_ANNOUNCE), `transfer_queue` (`source_player` entity, `auto_play`; target any
MA player), `get_queue` (no fields, **response**), `get_library` (required `config_entry_id` and `media_type`, optional
`favorite`, `search`, `pagination`, `order_by`, `album_type`, `album_artists_only`, `username`; **response**), `search`
(required `config_entry_id`, `name`; optional `media_type`, `artist`, `album`, `search_options`, `username`; **response**).
No `media_browse` / `unjoin`-variant in the MA domain: browse goes through `media_player.browse_media`.

Other media domains: `remote` (`send_command`, `learn_command`, `delete_command`, `turn_on/off`, `toggle`), `samsungtv_smart`
(`select_picture_mode`, `set_art_mode`), `cast` (`show_lovelace_view` only), `tts`. The response-returning services
(`browse_media`, `search_media`, MA `get_library` / `search` / `get_queue`) need HA's `return_response` call flavour, and the MA
library calls need the **config entry id** of the MA integration (one config entry here).

## (5) Area / floor placement

Of the 33 enabled players, **12 have an area** (entity or device level; 0 at entity level for all but 2 onkyo, which carry no
device). They sit in 8 of the 20 areas; 11 of the 12 are in an area that belongs to a floor (19 of 20 areas have a floor). By
platform: MA 2 of 11, cast 3 of 9 (exactly the 3 user-hidden ones), wiim 0 of 2, onkyo 2 of 4, the 5 device-class TVs all placed, the
2 dlna_dmr renderers not. MA and
wiim speakers are mostly **unplaced**.

## (6) Things that affect the plan

1. Nine of 33 enabled players are `unavailable` (4 MA, 3 cast, 2 dlna_dmr; 5 of them `restored`). An unavailable MA player
   reports a degraded feature mask, so capabilities must come from the live state of an available endpoint and fall back to the
   last good mask.
2. **Cast and wiim entities are dumb for music**: no shuffle/repeat/enqueue/announce/search. All rich playback is MA-only. The
   MA entity is the control endpoint for music on the same physical speaker; the vendor/cast entity stays useful for power
   and for TVs.
3. A grouped pair exists in two layers (wiim group and MA group). Grouping through `media_player.join` on the wrong layer
   gives a different result; the UI must pick one layer per device (MA when the device has an MA endpoint).
4. The 4 onkyo receivers are single-endpoint, no MA twin, no transport flags, `on` state: they are "receiver" devices, not players.
5. User-hidden cast entities (3) are still live: the model must honour `hidden_by` (probably hidden as duplicates of an MA or
   vendor entity, i.e. the owner's own manual dedupe; the reason is not recorded).
6. `linkplay` (disabled) and `wiim` coexist for the same speakers; the disabled ones must stay out of the model.
7. There are no sonos / airplay / heos entities; the WiiM speakers are the native grouping example; all MA groups are
   simple 2-member player groups (no `group` player type seen).

## Implications for CR-016

- The ladder needs an MA-aware rung: (a) MA id that embeds / prefixes a vendor identifier (strip the MA prefix, compare),
  (b) for the rest, a **name + kind** suggestion that does not require the area on both sides (a weak rung with name equality
  and an area on at least one side, never auto-merged), and (c) the admin `link` rung (rung 6) as the fallback. Expect roughly
  19 physical devices from 31 clusters; expect the manual link to be used for the 3 x cast+MA pairs and the TV.
- Model MA as the **music layer** of a device (endpoint role `ma_*`), not as a separate device: one card per physical thing,
  music controls (queue, shuffle, repeat, announce, browse, search, transfer) routed to the MA endpoint, power / source /
  keys to the vendor endpoint, volume to whichever the profile says.
- Group the speakers by MA `group_members` (and the wiim one as an alias of the same pair); `join` / `unjoin` need GROUPING,
  present on 7 MA + 2 wiim here, never on cast. Hide `join` when the device lacks it.
- Gate every control on the **live** `supported_features` of the available primary, and treat `unavailable` / `restored` as
  "capabilities unknown", never as "no capabilities".
- Library / search calls need the MA config entry id and `return_response`; the backend must discover the entry id (HA
  config-entry list, admin read) and cache it.
- Floor / area coverage of the speakers is low (12 of 33): the Areas UI needs an "unplaced" bucket and a way to place a
  speaker from the media settings.
