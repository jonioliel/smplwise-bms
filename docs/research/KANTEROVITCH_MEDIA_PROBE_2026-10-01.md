# Media probe of the fourth owner system (multimedia phase 2) - 2026-10-01

Read-only inspection of one more owner-operated Home Assistant system (labelled "system-K" here) for the speakers / players /
groups / Music Assistant part of CR-015 / CR-016, with the same method as `HOFFNUNG_MEDIA_PROBE_2026-10-01.md` ("system-H") and
the concurrent Havlin probe ("system-V", branch `pilot/havlin-media-probe`). Everything below is anonymised: counts, flag
shapes and cluster shapes only. No names, entity ids, device ids, model strings, addresses, account names, library content or
area names appear here. Raw dumps stay in the git-ignored `private-evidence/kanterovitch-media/`.

## Method and limits

- WebSocket reads only, from an allow-list: `auth`, `get_config`, `get_states`, `config/entity_registry/list`,
  `config/device_registry/list`, `config/area_registry/list`, `config/floor_registry/list`, `get_services`, and one
  Supervisor GET (`/addons`, the add-on list, through the existing `supervisor/api` proxy pattern). No service was called,
  nothing was played, joined, changed or restarted. The front door rejects the default Python User-Agent, so a browser-like
  `User-Agent` header is sent on the WebSocket handshake.
- The dedupe ladder was run with the real `services/media_model.py::build` of branch `integ/0.1.149` (read-only import) over the
  live registry, plus looser comparisons (id substring, normalised name, manufacturer / model string) to estimate what the
  ladder cannot see.
- Not readable with the allowed reads: the config-entry list (integration state is inferred from components, entities and
  states), integration versions.
- Snapshot of one moment: 45 registered `media_player` entities (32 enabled with a state, 13 disabled, 0 hidden), 25 `remote`
  (13 enabled), 990 states, 369 devices, 11 areas and **0 floors**, 302 loaded components. HA core 2026.8.3 (system-H / system-V:
  2026.9.4).

## (1) Music Assistant

**Not present.** No `music_assistant` component, no `music_assistant` service domain, no MA entities, and the add-on list (16
entries: 14 started, 2 stopped) has no MA add-on. The only media-related add-on is a **Jellyfin server** (started). Media
sources loaded as components: `media_source`, `radio_browser`, `dlna_dms`, `tts`, `spotify`. So this is the first system where
the "music layer" is not Music Assistant at all.

## (2) media_player inventory (45 registered, 32 enabled)

By platform (registered): jellyfin 23 (10 enabled, 13 disabled), smartthings 8, sonos 6, samsungtv_smart 2, dlna_dmr 2,
group 2 (HA group helper), cast 1, spotify 1. **Not present:** music_assistant, wiim, linkplay, onkyo, heos, denonavr, airplay,
musiccast, bluesound, roku, apple_tv, webostv, androidtv, squeezebox, snapcast.

Disabled: 12 through the device and 1 by user, all Jellyfin (no state at all). Hidden: 0. The enabled Jellyfin entities (10) are all
`unavailable`; 9 of them are `restored` (registry-only).

Kinds (device class): `speaker` 12 (6 sonos, 6 smartthings), `tv` 4 (2 samsungtv_smart, 2 smartthings); **no device class** on
10 jellyfin, 2 dlna_dmr (TV renderers), 2 group, 1 cast (a TV built-in cast), 1 spotify.

State distribution (32): `unavailable` 13 (10 jellyfin, 2 dlna_dmr, 1 spotify), `idle` 10 (4 sonos, 6 smartthings speakers),
`off` 6 (2 samsungtv_smart, 2 smartthings TV, 1 cast, 1 group), `paused` 2 (sonos), `on` 1 (group), `playing` 0. The TVs report
`off`, not `unavailable`, here (unlike the cast-only TVs of system-V).

Feature flags, counted over the **19 live** (non-unavailable) players: PAUSE / STOP / PLAY / VOLUME_SET / VOLUME_MUTE 19,
PREV / NEXT / VOLUME_STEP 12, PLAY_MEDIA 11, SELECT_SOURCE 10, SEEK / CLEAR_PLAYLIST / SHUFFLE_SET / MEDIA_ANNOUNCE /
MEDIA_ENQUEUE / BROWSE_MEDIA 7, TURN_ON / TURN_OFF 6, REPEAT_SET 6, **GROUPING 6**, SEARCH_MEDIA 6. Shapes per platform:

| platform | masks | notable |
|---|---|---|
| sonos (6) | 1 (8321599, identical on all) | the full rich shape natively: volume, mute, transport, prev/next, seek, **play_media, announce, enqueue, search, browse, shuffle, repeat, clear playlist, GROUPING**, select source (list of 22-23 favourites / inputs); no on/off. Same flag set as a live MA player minus on/off, with `media_content_type`, `queue_position` / `queue_size`, `shuffle`, `repeat` attributes |
| smartthings speaker (6) | 1 (21517) | **degraded cloud shape**: volume set/step/mute, pause/play/stop only; no PLAY_MEDIA, no prev/next, no source list, no grouping, no announce/enqueue/browse |
| smartthings TV (2) | 1 (23997) | on/off, volume, prev/next, source list (2), transport; no PLAY_MEDIA |
| samsungtv_smart (2) | 1 (24509) | TV shape: on/off, volume, PLAY_MEDIA, source list (7), transport; attributes add `art_mode_status`; plus a `remote` entity each (`unknown` state) |
| dlna_dmr (2) | 1 (mask 0) | unavailable, empty feature set |
| cast (1) | 1 | on/off, volume, mute, PLAY_MEDIA, BROWSE; no source list, no grouping; state `off` |
| group helper (2) | 2 | **virtual**: a 5-member Sonos group (transport, volume, PLAY_MEDIA, announce, enqueue, shuffle, clear playlist; no GROUPING, no source, no on/off) and a 2-member Samsung TV group (on/off, volume, PLAY_MEDIA); the member list is in the `entity_id` attribute; no `group_members` |
| jellyfin (10 enabled) | 3 (restored) | client-session players: transport, seek, volume, PLAY_MEDIA, BROWSE_MEDIA, SEARCH_MEDIA, 2 with MEDIA_ENQUEUE; masks are restored, not live |
| spotify (1) | 1 (2048) | unavailable / restored, SELECT_SOURCE only (a Spotify Connect device list; not a device) |

`group_members`: exposed by the 6 Sonos only. All 6 list **only themselves** (the wiim shape of system-H), so nothing is grouped
natively right now; MA-style empty list, heos-style null and cast-style absence do not occur. Attribute key set of a live
Sonos player: `device_class`, `entity_picture`, `group_members`, `icon`, `is_volume_muted`, `media_channel`, `media_content_id`,
`media_content_type` (`music`), `media_title`, `queue_position`, `queue_size`, `repeat`, `shuffle`, `source_list`, `volume_level`.
The Sonos equaliser / night-mode / loudness style controls are **separate entities** (number 25, switch 38, select 1 across the
6 speakers), not media_player features.

## (3) Duplication and the dedupe ladder

Ladder result (`build` skips disabled entities): **45 enabled endpoints (32 players + 13 remotes) -> 29 device clusters**
(cluster sizes: 26 x1, 1 x2, 1 x3, 1 x5). Endpoints merged per rung: rung 1 (same HA device) 8, rung 3 (shared MAC) 2, rung 2
(MA loop) **0**, rung 4 (shared identifier) **0** as a named rung (one cluster still grew through an identifier overlap, see
below), rung 5 suggestions **4**. Cluster kinds: 12 speakers, 4 screens, 13 players.

What the ladder merges: the Samsung TVs only. TV-A (one of two TVs): samsungtv_smart + its `remote` + dlna_dmr (joined by a
shared MAC; the dlna entity is hidden by the model) + one Jellyfin DLNA session and its remote (the session carries the TV's UPnP
id) = 5 endpoints; TV-B: samsungtv_smart + remote + dlna_dmr = 3 endpoints.

What the ladder does **not** merge (the duplication pattern of this system):

- **Sonos vs SmartThings.** SmartThings exposes the Sonos speakers as a second, cloud-backed `speaker` entity with a degraded mask.
  5 of 6 Sonos speakers have a SmartThings speaker with the **exactly equal normalised name**; 4 of the 5 also share the area and
  are returned as rung-5 suggestions (never merged), the 5th has an area on the Sonos side only, so **no suggestion**. The 6th
  Sonos and the 6th SmartThings speaker carry different names (name similarity 0.6) and are probably the same physical unit.
  SmartThings speaker devices have **no manufacturer and no model** and only a `via_device` parent; no shared identifier or MAC
  with Sonos (the Sonos devices are UUID-keyed, the SmartThings ones cloud-keyed).
- **TV-A has 7 endpoints in 3 clusters** (5 above + a SmartThings TV + a cast entity) and **TV-B 2 clusters** (3 + a SmartThings
  TV). The SmartThings and cast entities share no id or MAC with the vendor cluster; the cross key is the **manufacturer + model
  string**: it is identical on the dlna, samsungtv_smart and SmartThings devices of a TV, and the cast device carries a shorter
  model that is a prefix of the full one. Each of the two TV models is unique in the system, so a model rung would merge all
  of them with no ambiguity (same conclusion as system-V).
- **Jellyfin DLNA sessions are not devices.** 23 Jellyfin entities come from 23 Jellyfin "devices" whose model is the generic
  DLNA client: 13 disabled (12 together with their device, 1 by the user), 10 enabled and `unavailable`. One enabled session is
  the TV-A cluster member above; the other 9 clusters include 8 with the **same normalised name** (a name-equal group of 8)
  and no area, so rung 5 correctly suggests nothing for them. Six of the disabled sessions carry an id that embeds a Sonos unit's id
  (Jellyfin had discovered the Sonos speakers as DLNA renderers); none is enabled.
- **Virtual players.** 2 `group`-helper players (members: 5 Sonos / 2 Samsung TVs) and 1 Spotify source player are clusters of
  their own with no physical counterpart.
- Devices: 22 devices carry media entities (10 with a MAC connection, 11 MAC and 9 `upnp` connections in total, 0 attached to more than one config
  entry); manufacturer present on 16 of 22 (the 6 missing are the SmartThings speaker children). Identifier domains:
  smartthings 8, sonos 6, samsungtv_smart 2, jellyfin 2, spotify 1, cast 1.
- Estimated physical devices: **8** (6 Sonos speakers, 2 TVs) out of 29 clusters. The other 12 post-dedupe entries are
  non-physical: 9 Jellyfin sessions, 2 group helpers, 1 Spotify. With a name+kind rung (Sonos <-> SmartThings) and a model rung
  (TVs), 29 clusters collapse to 20 entries: 8 physical + 12 virtual / session.

## (4) Services (names and fields)

`media_player` core services are identical to system-H and system-V (`join`: field `group_members`, target needs GROUPING;
`unjoin`; `play_media` with `enqueue` / `announce` filtered by MEDIA_ENQUEUE / MEDIA_ANNOUNCE; `browse_media` and
`search_media` return a response; `volume_set`, `select_source`, `select_sound_mode`, `shuffle_set`, `repeat_set`,
`clear_playlist`, `volume_up/down/mute`, `media_*`, `turn_on/off`, `toggle`). **There is no `music_assistant` service domain.**
Vendor domains:

- `sonos`: `snapshot`, `restore` (field `with_group`), `set_sleep_timer` (`sleep_time`), `clear_sleep_timer`, `update_alarm`
  (`alarm_id`*, `time`, `volume`, `enabled`, `include_linked_zones` - modifies the owner's household alarms, admin-only),
  `play_queue` (`queue_position`), `remove_from_queue` (`queue_position`), `get_queue` (no fields, **returns a response**).
- `jellyfin`: `play_media_shuffle` (`media`).
- `group`: `set`, `remove`, `reload` (creating / removing helper groups; out of scope for a player UI).
- `samsungtv_smart`: `select_picture_mode`, `set_art_mode`; `cast`: `show_lovelace_view`; `remote`: the six generic services;
  `tts` present.
- No `smartthings` media service.

Library browsing is via `media_player.browse_media` / `search_media` on a player with the flags; the Jellyfin library is the
browsable source behind the (restored) Jellyfin sessions, and `media_source` / `radio_browser` / `dlna_dms` add further browse roots.

## (5) Area / floor placement

**There are no floors**: the floor registry is empty and all 11 areas have no floor. 14 of the 32 enabled players have an
area (0 at entity level, all via the device), in 6 of the 11 areas (per area: 4, 3, 2, 2, 2, 1 players). By platform: sonos 5 of
6, smartthings 6 of 8 (the TVs and 4 of the speakers), samsungtv_smart 2 of 2, dlna_dmr 1 of 2, cast 0 of 1, jellyfin 0 of 10,
group 0 of 2, spotify 0. All 14 placed players are physical (Sonos, SmartThings, Samsung, one DLNA renderer); none of the virtual ones is placed.

## (6) Things that affect the plan

1. **No Music Assistant.** Sonos is a full native music player (announce, enqueue, search, browse, shuffle, repeat, grouping).
   A model that routes the music layer to an `ma_*` role only would leave this house with no rich player; the music role has to be
   assigned by **flags of the best available endpoint** whatever the platform.
2. **Cloud-mirror duplicates.** The SmartThings entity of a Sonos speaker is a strictly poorer copy (no PLAY_MEDIA, prev/next,
   source, grouping). It must become a secondary / hidden endpoint of the speaker, not a second card, and must never be chosen
   for play or group control.
3. **Jellyfin sessions and group helpers are noise.** 12 of the 20 post-dedupe entries are not physical things (9 sessions with
   identical generic names, 2 helper groups, 1 Spotify source). They need a kind (`session` / `virtual_group` / `service`) that
   keeps them out of the device list by default and out of the suggestion rungs.
4. **Two native grouping layers again**: the Sonos group is physical and synchronised; the helper group (5 Sonos) is a fan-out
   with no GROUPING flag and no `group_members`. The UI must use `media_player.join` on the Sonos layer and show a helper group as
   a virtual shortcut, not as a group that can be joined or split.
5. Sonos reports `group_members` with itself only when alone (wiim shape): "ungrouped" = a list of length <= 1, here too.
6. TVs are `off`, not `unavailable`, in this system; the `remote` entities are `unknown`. So the availability semantics differ
   by integration and must not be hard-coded per kind.
7. Sonos-related controls (bass / treble / night sound / loudness) are extra entities on the same HA device, reachable by the
   device id; they are not media_player features.
8. Floors can be empty. Placement by area alone must work.

## (7) What is new against system-H and system-V

| topic | system-H | system-V | system-K (this) |
|---|---|---|---|
| HA core | 2026.9.4 | 2026.9.4 | 2026.8.3 |
| Music Assistant | add-on 2.10.4, 11 players | add-on 2.10.4, 13 players, live cross-brand sync group | **none** |
| native rich players | none (all MA) | none (all MA; heos richer than cast) | **Sonos x6, all flags** |
| Sonos / HEOS / MusicCast / Bluesound / Apple TV / LG webOS / Roku / Squeezebox / Snapcast | none | heos 2 | **Sonos 6**; others none |
| Spotify | 1 disabled | none | 1 unavailable (source-only) |
| Jellyfin | none | none | **add-on + integration, 23 session players** |
| TV integrations | samsungtv_smart, smartthings, androidtv_remote, dlna_dmr | smartthings 1 | samsungtv_smart 2, smartthings 2, dlna_dmr 2, cast 1 (+2 `remote`) |
| cloud-mirror twins | smartthings TV twins | smartthings TV | **smartthings speaker twins of Sonos (6)** |
| receivers | onkyo 4 | denonavr 4 + heos 2 | none |
| HA `group` helper players | none | none | **2 (5 Sonos; 2 TVs)** |
| floors | 3 | 5 | **0** |
| physical devices (est.) / clusters | about 19 / 31 | about 15-18 / 31 | **8 / 29** (12 non-physical) |
| rung-5 suggestions | 0 | 1 | 4 (all Sonos <-> SmartThings) |

New integrations: **Sonos**, **Jellyfin**, **group helper players**, **SmartThings speakers as twins of another brand**.
Still absent across all three: airplay, musiccast, bluesound, roku, apple_tv, webostv, squeezebox, snapcast, Alexa.

## Implications for CR-016

- **Brand profiles**: add `sonos` (native music + grouping + queue + sleep timer; bass / treble entities on the same device),
  `jellyfin` (session / library-source, never a device card), `group_helper` (virtual), `spotify` (service source). SmartThings
  gets a "secondary mirror" role when a richer twin exists. The music layer is a **capability** (PLAY_MEDIA + ANNOUNCE + ENQUEUE +
  BROWSE + SHUFFLE/REPEAT + GROUPING on a live endpoint), of which MA and Sonos are two providers, not an MA-only role.
- **Ladder additions for this system**: (a) a **manufacturer + model** rung that is unique across platforms (merges both TV
  stacks fully, also across cast's shortened model) - also the key that system-V needed; (b) for speakers without a model
  (SmartThings children): **name + kind** suggestion with area on at least one side, which recovers the 5th Sonos pair; (c) treat
  Jellyfin DLNA sessions as `session` kind so their 8-way name equality never produces suggestions.
- **Grouping**: join / unjoin on the layer that has GROUPING and is a real player (Sonos here, MA elsewhere); ignore `group`
  helpers for grouping. "Ungrouped" = member list of length <= 1, empty, null or absent (four encodings across three systems).
- **Routing**: power / source / keys to the TV vendor endpoint (samsungtv_smart), music controls to the flag-richest endpoint,
  volume to the profile's choice; never to a SmartThings mirror when a richer twin exists.
- **Availability**: per-integration semantics (Samsung TVs are `off`; cast-only TVs in system-V are `unavailable`); masks of
  restored / unavailable entities (here all Jellyfin) are not capabilities.
- **Areas**: zero floors is possible; unplaced bucket plus placement from media settings as before.
- Admin-only or hidden: Sonos `update_alarm`, helper-group management, any account sign-in service.
