# Media probe of the third owner system (multimedia phase 2) - 2026-10-01

Read-only inspection of one more owner-operated Home Assistant system (labelled "system-V" here) for the speakers / players /
groups / Music Assistant part of CR-015 / CR-016, with the same method as `HOFFNUNG_MEDIA_PROBE_2026-10-01.md` ("system-H").
Everything below is anonymised: counts, flag shapes and cluster shapes only. No names, entity ids, device ids, model strings,
addresses, account names, library content or area names appear here. Raw dumps stay in the git-ignored
`private-evidence/havlin-media/`.

## Method and limits

- WebSocket reads only, from an allow-list: `auth`, `get_config`, `get_states`, `config/entity_registry/list`,
  `config/device_registry/list`, `config/area_registry/list`, `config/floor_registry/list`, `get_services`, and one
  Supervisor GET (`/addons`, the add-on list, through the existing `supervisor/api` proxy pattern). No service was called,
  nothing was played, joined, changed or restarted. The front door rejects the default Python User-Agent, so a browser-like
  `User-Agent` header is sent on the WebSocket handshake.
- The dedupe ladder was run with the real `services/media_model.py::build` of branch `integ/0.1.149` (read-only import) over the
  live registry, plus looser comparisons (id substring, normalised name, model) to estimate what the ladder cannot see.
- Not readable with the allowed reads: the config-entry list (MA config-entry state is inferred from entity states), the MA
  server's own player list, integration versions other than the add-on.
- Snapshot of one moment: 33 registered `media_player` entities (all 33 enabled, none hidden, none disabled), 0 `remote`, 850
  states, 365 devices, 22 areas on 5 floors, 287 loaded components. HA core 2026.9.4 (same as system-H).

## (1) Music Assistant

- Installed as the **add-on** (started, 2.10.4 = latest; same version as system-H). The add-on list has 11 entries (10 started,
  1 stopped, no updates pending); MA is the only media add-on.
- The HA `music_assistant` integration is **loaded** (one config entry; 13 `media_player` + 13 `button` entities, no other
  domains). Inferred state: loaded; 6 of its 13 players are live (3 `paused`, 3 `idle`), 7 are `unavailable` (5 of them
  `restored`, i.e. registry-only this session; 2 live-unavailable, which still keep a degraded mask).
- Last-changed dates of the players fall on the two days before the snapshot, i.e. the system is in active use.

## (2) media_player inventory (33 registered, 33 enabled)

By platform: music_assistant 13, cast 10, denonavr 4, wiim 3, heos 2, smartthings 1. **Not present** (component list):
sonos, airplay, musiccast, bluesound, roku, apple_tv, webostv, samsungtv(_smart), androidtv(_remote), dlna_dmr, onkyo, linkplay,
spotify, squeezebox, snapcast. Also loaded but without media players: `group`, `mqtt`.

Kinds: device class `speaker` on 20 (13 MA, 4 cast, 3 wiim), `receiver` on 4 (denonavr), `tv` on 1 (smartthings); **no device
class** on 8 (6 cast - the TV-like ones - and 2 heos). Physically: 3 WiiM-type speakers, 2 AV receivers, about 6 TVs / a console
seen only as cast and/or MA entities, 1 SmartThings TV.

State distribution: `unavailable` 16, `idle` 8, `off` 3, `paused` 3, `on` 2, `playing` 1, `standby` 0. Half of the inventory is
unavailable: 7 MA, 7 cast (TVs that drop off the network when powered down), 1 wiim, 1 smartthings.

Feature flags (count of the 33): PLAY_MEDIA 31, PAUSE/STOP/PLAY 30, BROWSE_MEDIA 28, VOLUME_SET/VOLUME_MUTE 25, PREV/NEXT 21, SEEK 16,
SELECT_SOURCE 15, CLEAR_PLAYLIST / SHUFFLE_SET / REPEAT_SET / MEDIA_ENQUEUE 15 (13 MA + the 2 heos), TURN_ON/TURN_OFF 15, VOLUME_STEP 14,
MEDIA_ANNOUNCE / SEARCH_MEDIA 13 (exactly the MA entities), **GROUPING 12** (7 MA incl. 1 restored, 3 wiim, 2 heos), SELECT_SOUND_MODE 4 (denonavr). Shapes per platform:

| platform | masks (distinct) | notable |
|---|---|---|
| music_assistant, live full player | 2 (8322623 with volume + grouping + source list, 8320575 without source list) | volume, mute, grouping, announce, enqueue, search, browse, shuffle, repeat |
| music_assistant, unavailable | 1 (7795251) on 6 (+ 1 restored one keeps the full 8322623) | degraded mask: no VOLUME_SET, no GROUPING - **capabilities must not be read from an unavailable player** (same as system-H) |
| cast | 2 | 8 entities: volume, mute, pause/play/stop, on/off (CEC-style), play_media, browse; 2 entities (unavailable) only on/off + play_media + browse; **no GROUPING**, no source list |
| denonavr (2 physical receivers, 2 entities each: Main + Zone2) | 2 | Main: volume/step/mute, on/off, source list (12-13), sound mode list (23), PLAY/PAUSE/STOP/PREV/NEXT, PLAY_MEDIA; Zone2: volume/step/mute, on/off, source, sound mode only (no transport) |
| heos (2, same receivers as the denonavr ones) | 1 | the richest vendor shape: volume, transport, PLAY_MEDIA, SELECT_SOURCE, BROWSE, SHUFFLE, REPEAT, CLEAR_PLAYLIST, **MEDIA_ENQUEUE, GROUPING**; no on/off, no announce, no search |
| wiim | 2 | volume, mute, transport, SELECT_SOURCE, BROWSE, GROUPING; no announce / enqueue (as system-H) |
| smartthings | 1 | unavailable TV-class entity with on/off, volume, source list, transport |

`group_members` shapes differ per platform: MA exposes a list (empty when ungrouped, full list on **some** members of a group,
see section 6), wiim exposes a list that holds only itself when ungrouped, heos exposes the key with a **null** value when
ungrouped, cast and denonavr do not expose it at all. The attribute key set of a live MA player is the same as in system-H
(`active_queue`, `mass_player_type` (all `player`), `group_members`, `source_list`, ...). The denonavr playing receiver reports
`media_content_type` of the channel kind (an input, not a music track).

## (3) Duplication and the dedupe ladder

Ladder result: **33 enabled endpoints -> 31 device clusters** (sizes: 29 x1, 2 x2). Merged per rung: rung 1 (same HA device) 4
endpoints, i.e. the two Main + Zone2 pairs of the receivers; rung 2 (MA loop) **0**; rung 3 (MAC) **0** (no device in the system
carries a MAC connection); rung 4 (shared identifier) **0**; rung 5 suggestions **1** (same area + same normalised name; a WiiM
speaker with its cast entity). Kinds: 20 speakers, 8 players, 2 receivers, 1 screen.

What the ladder does **not** merge:

- **MA and HEOS share an identical id.** For both HEOS receivers, the MA player id is *exactly* the HEOS player id (2 exact
  matches). Rung 4 cannot use it because it skips the `music_assistant` identifier domain by design, and rung 2 only looks for
  HA entity ids. This is the first system where a vendor id and an MA id match exactly.
- **MA ids embed the WiiM id** (3 of 3 WiiM speakers): an MA token with a prefix around the vendor id, same as system-H.
- **The denonavr and heos entities of one receiver are different HA devices** (different integrations, no shared identifier or
  connection) - one physical receiver = denonavr device (2 entities) + heos device + MA player (3 clusters, 4 endpoints).
- **Cast vs MA for the TVs and the WiiM speakers**: no shared id (cast ids are UUIDs, MA ids are something else).
- **The name rung is blind for 10 of the 31 clusters**: their device names are model numbers (the cast TVs and their MA twins), which
  `normalised_name` strips by design, so they normalise to the empty string. The owner renamed the others in his own language
  (16 of 31 clusters) and those match well; Latin names of the receivers (Denon) match between denonavr and heos.
- Looser comparisons (cumulative): device rung 31 clusters -> MA id exact / embedded match 26 -> equal normalised name 18 -> unique
  cast/MA **model** pair 15 (2 model groups are ambiguous: the same TV model twice). **So about 15 to 18 physical devices, not
  31.**
  - 2 x receiver: denonavr + heos + MA.
  - 3 x WiiM speaker: wiim + cast + MA (one speaker also has a second cast entity).
  - 4 x TV / player: cast + MA.
  - 1 x TV: smartthings + MA.
  - Singletons: 3 MA-only (incl. a game console and one TV), 2 cast-only.
- Area does not help: only **6 of 33** players carry an area, in **3 of 22** areas; the only same-area + same-name pair is WiiM + cast.
- Devices: all 31 media devices have a manufacturer, none has a MAC connection, none is attached to more than one config entry;
  identifier domains: music_assistant 13, cast 10, wiim 3, denonavr 2, heos 2, smartthings 1. Model strings are **the useful
  cross-integration key**: the same model string appears on the cast device and on its MA twin (and on heos and its MA twin).

## (4) Services (names and fields)

Identical to system-H: `media_player` core services (`join`, `unjoin` need GROUPING; `play_media` with `enqueue` / `announce`
filtered by MEDIA_ENQUEUE / MEDIA_ANNOUNCE; `browse_media` and `search_media` return a response; `volume_set`, `select_source`,
`select_sound_mode`, `shuffle_set`, `repeat_set`, `clear_playlist`, `volume_up/down/mute`, `media_*`, `turn_on/off`, `toggle`) and
`music_assistant` (`play_media`, `play_announcement`, `transfer_queue`, `get_queue`, `get_library`, `search`; library / search need
the config entry id). Differences against system-H are in the vendor domains:

- `heos`: `get_queue`, `group_volume_set`, `group_volume_up`, `group_volume_down`, `move_queue_item`, `remove_from_queue`,
  `sign_in`, `sign_out` (sign-in / out are account actions: never expose them).
- `denonavr`: `get_command`, `set_dynamic_eq`, `update_audyssey`.
- `cast`: `show_lovelace_view` only; `tts`: `speak`, `cloud_say`, `clear_cache`; `remote`: the six generic services exist but no
  `remote` entity does.

## (5) Area / floor placement

6 of 33 players have an area (2 denonavr, 2 wiim, 1 smartthings, 1 cast; 0 at entity level, all via the device), in 3 of 22 areas;
all 3 areas belong to a floor (21 of 22 areas have a floor). No MA or heos player has an area, so **27 of 33 are unplaced** - a lower
coverage than system-H (12 of 33).

## (6) Things that affect the plan

1. **A live cross-brand MA sync group.** Four MA players (2 backed by the HEOS receivers, 2 by the WiiM speakers) play as one
   group. Their `active_queue` all point to one leader; the leader and one member list all 4 in `group_members`, the other two
   members list **nothing**. A client that reads `group_members` per player sees two different answers. Group membership must be
   the union of the `group_members` lists plus "players whose `active_queue` is another MA player".
2. The native layers are unused for groups: the WiiM `group_members` only list themselves, the HEOS value is null, there is no `group`
   or `universal` media player. All grouping is MA's, across vendors, so join / unjoin on the vendor layer would be the wrong
   layer here.
3. One physical receiver is three integrations. The denonavr Main entity carries power, source, sound mode and some transport; the
   Zone2 entity is a second independent output (volume / power / source); heos carries queue, grouping and group volume; MA carries the
   rich music controls. The UI needs to show one receiver card with a zone switch, not 4 cards.
4. Half of the entities are unavailable. TVs reached only through cast drop to `unavailable` when switched off, so "unavailable"
   for a cast TV means "off / asleep", not "broken", and its MA twin is unavailable too. Restored / degraded masks must not be
   used (same lesson as system-H).
5. **There is no TV control integration here**: no webostv, no samsungtv, no androidtv, no remote entities. The LG-class TVs are
   reachable only through Google Cast (power by CEC, volume, mute, play / stop, play_media; no keys, no source list, no apps) and
   through MA. Their device class is empty, so the kind is `player`, not `screen`, without a model / manufacturer heuristic.
6. The name rung cannot see renamed-versus-model-number pairs (10 of 31 clusters): the same physical TV is called by its model in
   cast and MA, and by the owner in the Hebrew label elsewhere. Only the model string links them.
7. `group_members` is `[]` on MA, `[self]` on wiim, `null` on heos, absent on cast: four "ungrouped" encodings.
8. The one cast WiiM speaker with two cast entities (one `off`, one `unavailable` with the degraded mask) looks like a duplicate; it
   should land in the "suggest to hide" bucket, not a second card.

## (7) Comparison with system-H

| topic | system-H | system-V |
|---|---|---|
| HA / MA version | 2026.9.4 / add-on 2.10.4 | same / same |
| MA players | 11 (7 live, 4 unavailable) | 13 (6 live, 7 unavailable), one **active sync group of 4** |
| cast | 9 | 10 (TVs without any other control) |
| wiim | 2 (+2 disabled linkplay) | 3 (no linkplay) |
| TV integrations | samsungtv_smart 2, smartthings 2, androidtv_remote 1, dlna_dmr 2, 3 `remote` | smartthings 1 only, **0 remote** |
| receivers | onkyo 4 (single endpoint, no MA twin, no device class) | **denonavr 4 (2 devices x Main/Zone2) + heos 2 + MA 2**, device class `receiver` |
| new integration families | - | **heos** (native grouping + queue), **denonavr** (zones, sound modes) |
| speakers | WiiM + MA + cast | WiiM + MA + cast, plus HEOS receivers |
| MA id vs vendor id | embeds (wiim) | embeds (wiim) and **exact match (heos)** |
| name rung | area missing | area missing **and** model-number names (10 clusters) |
| rung-5 suggestions | 0 | 1 |
| area coverage of players | 12 of 33 | 6 of 33 |
| unavailable | 9 of 33 | 16 of 33 |
| ladder clusters -> physical estimate | 31 -> about 19 | 31 -> about 15-18 |

Still absent in both systems (so no evidence either way): Sonos, AirPlay, Yamaha MusicCast, Bluesound, Apple TV, LG webOS,
Roku, Spotify, Squeezebox, Snapcast. New against system-H: **HEOS** and **Denon AVR**; dropped: Onkyo, Samsung TV integrations,
Android TV, DLNA renderers.

## Implications for CR-016

- **Device model.** Add an "MA id exact equals vendor id" rung (HEOS here) next to the substring rung (WiiM here) and let both
  auto-merge with `strong` confidence under the same-platform guard. Add a **model-string rung** for cast <-> MA (and heos <-> MA): equal
  normalised model + equal manufacturer merges automatically only when the pair is unique within the system; ambiguous pairs
  (the same model twice) become `link` suggestions. The name rung must keep working on Hebrew names and must not treat an empty
  normalised name as "equal".
- **Multi-integration receiver.** A receiver is a cluster of denonavr (per zone) + heos + MA endpoints. Zone entities of one HA device
  already merge by rung 1; model them as **zones of one device** (Main, Zone2 each with power / volume / source), not as two players.
  Network music (queue, shuffle, announce, search, browse) goes to the MA endpoint, group volume and native HEOS grouping to the HEOS
  endpoint, power / sound mode / source to denonavr.
- **Brand profiles (TV remote).** Add a `cast_only` screen profile: power (CEC), volume, mute, play / pause / stop and "cast media"
  only - no d-pad, no source / app lists, no number pad; show a hint to set up the brand integration (webOS) for full control. The
  kind for a cast entity without a device class must come from manufacturer / model (TV brand or a TV-style model string), so these
  become `screen`, not `player`. A TV that is `unavailable` over cast should render as "asleep", not "broken".
- **Receiver profile.** A `receiver` profile with zone switch, source list, sound-mode list (23 entries here - needs a searchable or
  grouped list), no transport on Zone2, and the Denon-specific `get_command` / Audyssey services left out.
- **Groups.** Group membership = union of every player's `group_members` plus `active_queue` pointing at another MA player; the
  leader is the queue owner. Normalise the four "ungrouped" encodings (`[]`, `[self]`, `null`, absent). When the cluster has an MA
  endpoint, route `join` / `unjoin` to MA and never to heos / wiim; hide the native layer; allow a **cross-brand** group (HEOS +
  WiiM members) and show group volume through MA. Never expose the `heos.sign_in` / `sign_out` services.
- **Capabilities and availability.** Keep the rule from system-H (degraded masks on restored / unavailable MA players), and treat
  cast-TV `unavailable` as a power state.
- **Areas.** 27 of 33 players are unplaced: the media settings need the "unplaced" bucket and a one-tap place action, and the
  estimated physical device count (15-18 of 31 clusters) argues for a merge wizard that starts from the suggestions.
