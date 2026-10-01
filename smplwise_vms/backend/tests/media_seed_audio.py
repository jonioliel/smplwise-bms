"""Synthetic audio installations for the CR-016 tests: the registries and states of two houses that mirror the shapes of the owner's probes (counts and flag
masks only - every name, id, MAC and uuid is invented).

"MA house" (probes H + V): WiiM speakers with a Cast and a Music Assistant copy, a Denon receiver (Main + Zone2 + HEOS + MA, the MA id EQUALS the HEOS
id), a Cast-only speaker, a Cast TV with an MA twin (the Cast model reads as a TV), a restored MA speaker with a degraded mask, an MA group player, floors.

  wiim_a    - "רמקול סלון" (living, ground): wiim + cast + MA  (rung 2c + 3b)         ma_a: playing, the queue owner
  wiim_b    - "רמקול מטבח" (kitchen, ground): wiim + MA        (rung 2c)               ma_b
  denon     - "מגבר קולנוע" (living, ground): denonavr Main + Zone2 + heos + MA (rung 1 + 3b + 2b)
  garden    - "רמקול גינה" (terrace, ground): a Cast speaker alone (no MA)
  console   - an MA speaker, restored (unavailable, degraded mask), no area
  tv        - a Cast TV (no device class, a TV model) + its MA twin (3b): a SCREEN
  stereo    - an MA group player (static group) of the two WiiMs

"Sonos house" (probe K): no Music Assistant, no floors: three Sonos speakers with SmartThings mirrors, a TV, two Jellyfin sessions with one shared name, a helper
group of the Sonos speakers and a Spotify source.

`install(client, house)` posts the registries and the states through the developer routes (`/ha/dev/registry`, `/ha/dev/states`)."""
from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

# MediaPlayerEntityFeature bits (HA core)
PAUSE, SEEK, VOLUME_SET, VOLUME_MUTE, PREVIOUS, NEXT = 1, 2, 4, 8, 16, 32
TURN_ON, TURN_OFF, PLAY_MEDIA, VOLUME_STEP, SELECT_SOURCE, STOP, PLAY = 128, 256, 512, 1024, 2048, 4096, 16384
SHUFFLE, SOUND_MODE, BROWSE, REPEAT, GROUPING, ANNOUNCE, ENQUEUE, SEARCH = 32768, 65536, 131072, 262144, 524288, 1048576, 2097152, 4194304
MA_FULL = 8322623
MA_DEGRADED = 7795251
SONOS = 8321599
HEOS = VOLUME_SET | VOLUME_MUTE | VOLUME_STEP | PAUSE | PLAY | STOP | NEXT | PREVIOUS | PLAY_MEDIA | SELECT_SOURCE | BROWSE | SHUFFLE | REPEAT | ENQUEUE | GROUPING
WIIM = VOLUME_SET | VOLUME_MUTE | PAUSE | PLAY | STOP | NEXT | PREVIOUS | SELECT_SOURCE | PLAY_MEDIA | BROWSE | GROUPING
CAST = VOLUME_SET | VOLUME_MUTE | PAUSE | PLAY | STOP | TURN_ON | TURN_OFF | PLAY_MEDIA | BROWSE
ST_SPEAKER = 21517
DENON_MAIN = VOLUME_SET | VOLUME_MUTE | VOLUME_STEP | TURN_ON | TURN_OFF | SELECT_SOURCE | SOUND_MODE | PLAY | PAUSE | STOP | PLAY_MEDIA
DENON_ZONE2 = VOLUME_SET | VOLUME_MUTE | VOLUME_STEP | TURN_ON | TURN_OFF | SELECT_SOURCE | SOUND_MODE
ST_TV = 23997
SSV = PAUSE | VOLUME_SET | VOLUME_MUTE | PREVIOUS | NEXT | TURN_ON | TURN_OFF | PLAY_MEDIA | VOLUME_STEP | SELECT_SOURCE | STOP | PLAY

UID_A = "wiim_aaaaaaaa111122223333000000000001"  # embeds the WiiM id of speaker A
UID_B = "wiim_bbbbbbbb111122223333000000000002"
WIIM_A_ID = "uuid:aaaaaaaa-1111-2222-3333-000000000001"
WIIM_B_ID = "uuid:bbbbbbbb-1111-2222-3333-000000000002"
HEOS_ID = "-1884291837"  # a HEOS player id; the MA player of the receiver has exactly this id
UID_DEN = HEOS_ID
UID_STEREO = "ma-group-stereo-0001"
UID_CONSOLE = "ma-console-0001"
UID_TV = "ma-tv-0001"

FLOORS = [{"floor_id": "ground", "name": "קומת קרקע", "level": 0}, {"floor_id": "upper", "name": "קומה 1", "level": 1}]
AREAS = [{"area_id": "living", "name": "סלון", "floor_id": "ground"}, {"area_id": "kitchen", "name": "מטבח", "floor_id": "ground"}, {"area_id": "terrace", "name": "פרגולה", "floor_id": "ground"},
         {"area_id": "office", "name": "משרד", "floor_id": "upper"}, {"area_id": "bedroom", "name": "חדר שינה", "floor_id": "upper"}]
AREAS_NO_FLOORS = [{"area_id": "living", "name": "סלון", "floor_id": None}, {"area_id": "kitchen", "name": "מטבח", "floor_id": None}, {"area_id": "bedroom", "name": "חדר שינה", "floor_id": None},
                   {"area_id": "study", "name": "משרד", "floor_id": None}]


def _dev(device_id: str, name: str, maker: str | None, model: str | None, area: str | None, idents: list[list[str]] | None = None, macs: list[str] | None = None, by_user: str | None = None) -> dict[str, Any]:
    return {"id": device_id, "name": name, "name_by_user": by_user, "manufacturer": maker, "model": model, "area_id": area, "connections": [["mac", m] for m in macs or []], "identifiers": idents or []}


class House:
    def __init__(self) -> None:
        self.devices: list[dict[str, Any]] = []
        self.entities: list[dict[str, Any]] = []
        self.states: list[dict[str, Any]] = []
        self.areas: list[dict[str, Any]] = []
        self.floors: list[dict[str, Any]] = []

    def device(self, *args: Any, **kw: Any) -> str:
        d = _dev(*args, **kw)
        self.devices.append(d)
        return d["id"]

    def entity(self, eid: str, platform: str, device: str | None, state: str, features: int = 0, unique_id: str | None = None, hidden: bool = False, disabled: bool = False,
               name: str | None = None, **attrs: Any) -> None:
        self.entities.append({"entity_id": eid, "id": f"reg-{eid}", "platform": platform, "device_id": device, "unique_id": unique_id or f"uid-{eid}", "area_id": None,
                              "disabled_by": "user" if disabled else None, "hidden_by": "user" if hidden else None, "original_name": name})
        if not disabled:
            self.states.append({"entity_id": eid, "state": state, "attributes": {"friendly_name": name or eid.split(".", 1)[1], "supported_features": features, **attrs}})


def ma_house() -> House:
    h = House()
    h.floors, h.areas = FLOORS, AREAS
    # speaker A: wiim + cast + MA (the MA id embeds the WiiM id; the Cast model is the same)
    dwa = h.device("d_wiim_a", "WiiM A", "Linkplay", "WiiM Mini", "living", [["wiim", WIIM_A_ID]], by_user="רמקול סלון")
    dca = h.device("d_cast_a", "Cast A", "Linkplay", "WiiM Mini", None, [["cast", "cast-a-0001"]])
    dma = h.device("d_ma_a", "MA A", "Linkplay", "WiiM Mini", None, [["music_assistant", UID_A]])
    h.entity("media_player.wiim_a", "wiim", dwa, "idle", WIIM, volume_level=0.4, is_volume_muted=False, source="WiFi", source_list=["WiFi", "Line-in"], group_members=["media_player.wiim_a"], name="WiiM A")
    h.entity("media_player.cast_a", "cast", dca, "off", CAST, name="Cast A", device_class="speaker")
    h.entity("media_player.ma_a", "music_assistant", dma, "playing", MA_FULL, unique_id=UID_A, volume_level=0.4, is_volume_muted=False, group_members=[], active_queue=UID_A, mass_player_type="player",
             media_title="שיר לדוגמה", media_artist="אמן לדוגמה", media_album_name="אלבום לדוגמה", media_duration=200, media_position=50, media_content_type="music",
             media_position_updated_at="2026-10-01T10:00:00+00:00", shuffle=False, repeat="off", name="MA A", device_class="speaker", source_list=["External"])
    # speaker B: wiim + MA
    dwb = h.device("d_wiim_b", "WiiM B", "Linkplay", "WiiM Amp", "kitchen", [["wiim", WIIM_B_ID]], by_user="רמקול מטבח")
    dmb = h.device("d_ma_b", "MA B", "Linkplay", "WiiM Amp", None, [["music_assistant", UID_B]])
    h.entity("media_player.wiim_b", "wiim", dwb, "idle", WIIM, volume_level=0.3, is_volume_muted=False, group_members=["media_player.wiim_b"], name="WiiM B")
    h.entity("media_player.ma_b", "music_assistant", dmb, "idle", MA_FULL, unique_id=UID_B, volume_level=0.3, is_volume_muted=False, group_members=[], active_queue=UID_B, mass_player_type="player",
             shuffle=False, repeat="off", name="MA B", device_class="speaker")
    # the receiver: denonavr Main + Zone2, heos, MA (the MA id equals the HEOS id)
    dd = h.device("d_denon", "Denon", "Denon", "AVR-X1700H", "living", [["denonavr", "denon-0001"]], by_user="מגבר קולנוע")
    dh = h.device("d_heos", "Denon HEOS", "Denon", "AVR-X1700H", None, [["heos", HEOS_ID]])
    dmd = h.device("d_ma_den", "MA Denon", "Denon", "AVR-X1700H", None, [["music_assistant", UID_DEN]])
    h.entity("media_player.denon_main", "denonavr", dd, "on", DENON_MAIN, volume_level=0.35, is_volume_muted=False, source="TV", source_list=["TV", "Radio", "Game"], sound_mode="Stereo",
             sound_mode_list=["Stereo", "Movie", "Music"], name="Denon Main", device_class="receiver")
    h.entity("media_player.denon_zone2", "denonavr", dd, "off", DENON_ZONE2, volume_level=0.2, is_volume_muted=False, source="Radio", source_list=["TV", "Radio"], name="Denon Zone2", device_class="receiver")
    h.entity("media_player.heos_den", "heos", dh, "idle", HEOS, volume_level=0.35, group_members=None, name="Denon HEOS")
    h.entity("media_player.ma_den", "music_assistant", dmd, "idle", MA_FULL, unique_id=UID_DEN, volume_level=0.35, is_volume_muted=False, group_members=[], active_queue=UID_DEN, mass_player_type="player",
             shuffle=False, repeat="off", name="MA Denon", device_class="speaker")
    # a Cast speaker alone
    dg = h.device("d_garden", "Garden", "Google", "Nest Mini", "terrace", [["cast", "cast-garden-0001"]], by_user="רמקול גינה")
    h.entity("media_player.cast_garden", "cast", dg, "off", CAST, name="Garden", device_class="speaker")
    # an MA speaker that is restored (registry only) with the degraded mask
    dc = h.device("d_console", "Console", None, None, None, [["music_assistant", UID_CONSOLE]], by_user="קונסולה")
    h.entity("media_player.ma_console", "music_assistant", dc, "unavailable", MA_DEGRADED, unique_id=UID_CONSOLE, restored=True, name="Console", device_class="speaker")
    # a TV known only as a Cast entity (no device class, a TV model) and its MA twin
    dt = h.device("d_cast_tv", "Cast TV", "LG Electronics", "OLED55C3", "bedroom", [["cast", "cast-tv-0001"]], by_user="טלוויזיה חדר שינה")
    dmt = h.device("d_ma_tv", "MA TV", "LG Electronics", "OLED55C3", None, [["music_assistant", UID_TV]])
    h.entity("media_player.cast_tv", "cast", dt, "off", CAST, name="Cast TV")
    h.entity("media_player.ma_tv", "music_assistant", dmt, "idle", MA_FULL, unique_id=UID_TV, group_members=[], active_queue=UID_TV, name="MA TV", device_class="speaker")
    # an MA group player: a static group of the two WiiMs
    dgp = h.device("d_stereo", "Stereo", None, None, None, [["music_assistant", UID_STEREO]], by_user="זוג סטריאו")
    h.entity("media_player.ma_stereo", "music_assistant", dgp, "idle", MA_FULL, unique_id=UID_STEREO, mass_player_type="group", group_members=["media_player.ma_a", "media_player.ma_b"], active_queue=UID_STEREO,
             name="Stereo", device_class="speaker")
    return h


def sonos_house() -> House:
    h = House()
    h.floors, h.areas = [], AREAS_NO_FLOORS
    for slug, area, name, idx in (("living", "living", "סלון", 1), ("kitchen", "kitchen", "מטבח", 2), ("bedroom", "bedroom", "חדר שינה", 3)):
        ds = h.device(f"d_sonos_{slug}", f"Sonos {slug}", "Sonos", "Play:1", area, [["sonos", f"RINCON_{idx:012d}"]], by_user=name)
        dt = h.device(f"d_st_{slug}", f"ST {slug}", None, None, area if slug != "bedroom" else None, [["smartthings", f"st-{idx:012d}-aaaa"]], by_user=name)
        h.entity(f"media_player.sonos_{slug}", "sonos", ds, "idle" if slug != "living" else "playing", SONOS, volume_level=0.3, is_volume_muted=False, group_members=[f"media_player.sonos_{slug}"],
                 source_list=["Radio A (תחנת רדיו)", "Evening playlist", "Line-in"], queue_size=12, queue_position=3, shuffle=False, repeat="off", media_title="שיר", media_artist="אמן",
                 media_duration=180, media_position=20, media_content_type="music", media_position_updated_at="2026-10-01T10:00:00+00:00", name=name, device_class="speaker")
        h.entity(f"media_player.st_{slug}", "smartthings", dt, "idle", ST_SPEAKER, volume_level=0.3, name=name, device_class="speaker")
    dtv = h.device("d_tv", "Samsung TV", "Samsung", "QE55", "living", [["samsungtv_smart", "ssv-0001"]], macs=["02:00:00:c0:15:01"], by_user="טלוויזיה סלון")
    h.entity("media_player.tv_living", "samsungtv_smart", dtv, "off", SSV, name="TV", device_class="tv", source_list=["TV", "HDMI1"])
    for i in (1, 2):
        dj = h.device(f"d_jf_{i}", "DLNA client", "Jellyfin", "Generic DLNA", None, [["jellyfin", f"jf-{i}-0001"]])
        h.entity(f"media_player.jf_{i}", "jellyfin", dj, "unavailable", PLAY | PAUSE | SEEK | VOLUME_SET, restored=True, name="Generic DLNA Client")
    dhp = h.device("d_helper", "Helper", None, None, None, [])
    h.entity("media_player.helper_sonos", "group", dhp, "playing", PLAY | PAUSE | VOLUME_SET | PLAY_MEDIA, name="כל הרמקולים",
             **{"entity_id": ["media_player.sonos_living", "media_player.sonos_kitchen", "media_player.sonos_bedroom"]})
    dsp = h.device("d_spotify", "Spotify", None, None, None, [["spotify", "spotify-0001"]])
    h.entity("media_player.spotify", "spotify", dsp, "unavailable", SELECT_SOURCE, restored=True, name="Spotify")
    return h


def install(client: TestClient, house: str = "ma") -> House:
    h = {"ma": ma_house, "sonos": sonos_house}[house]()
    for i in range(0, len(h.states), 40):
        r = client.post("/api/v1/ha/dev/states", json={"states": h.states[i:i + 40]})
        assert r.status_code == 200, r.text
    r = client.post("/api/v1/ha/dev/registry", json={"entities": h.entities, "devices": h.devices, "areas": h.areas, "floors": h.floors})
    assert r.status_code == 200, r.text
    return h


def set_state(client: TestClient, entity_id: str, state: str | None = None, **attrs: Any) -> None:
    """Change one entity the way a state push would: its current state and attributes are kept unless given."""
    cur = client.get(f"/api/v1/ha/entities/{entity_id}").json()
    merged = {**(cur.get("attributes") or {}), **attrs}
    if "supported_features" not in merged:
        merged["supported_features"] = cur.get("supported_features") or 0
    r = client.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": entity_id, "state": state if state is not None else cur["state"], "attributes": merged}]})
    assert r.status_code == 200, r.text


def key_of(client: TestClient, anchor: str) -> str:
    for d in client.get("/api/v1/multimedia/admin/devices").json()["devices"]:
        if d["anchor_entity_id"] == anchor:
            return d["key"]
    raise AssertionError(f"no device anchored on {anchor}")


def key_with(client: TestClient, entity_id: str, kinds: str | None = None) -> str:
    """The device that has `entity_id` among its endpoints (administrator's view; `kinds` also lists the non-physical ones)."""
    r = client.get("/api/v1/multimedia/admin/devices" + (f"?kind={kinds}" if kinds else ""))
    assert r.status_code == 200, r.text
    for d in r.json()["devices"]:
        if any(e["endpoint_id"] == f"ha:{entity_id}" for e in d["endpoints"]):
            return d["key"]
    raise AssertionError(f"no device has {entity_id}")


def approve_players(client: TestClient) -> dict[str, Any]:
    r = client.post("/api/v1/multimedia/admin/approve", json={"kinds": ["speaker", "player", "receiver", "group"]})
    assert r.status_code == 200, r.text
    return r.json()
