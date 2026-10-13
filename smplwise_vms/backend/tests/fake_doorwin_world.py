"""CR-039 slice W0: `DoorwinWorld` - every door-windows fake wired together on one clock, configured from the answers to
U1-U7 (spec 3.2). Product slices build a world, plug their service into it (a `now` callable, the engine adapters'
transports, the watchdog's `tick`), run the scenario with `advance(...)` and check the result with the helper assertions.

    world = DoorwinWorld(unknowns={"U2": True})            # everything else: the unanswered (worst-case) default
    world.programs.command("stations/technical_program_save", station_id=ENTRY, door=1, revision=0, policy=..., enabled=True)
    world.advance(15)                                       # one WisKey tick: alwaysOpen
    world.programs.ha_stop(); world.advance(3 * 3600)       # HA down at the window's end: the door stays held (R)

Unknown -> switch (the defaults are the answers Arx must assume until WisKey says otherwise):
| key | default | what it switches |
|---|---|---|
| U1 station-side schedules | False | `stations.available` (tier A exists); doors still need `stations.support(...)` |
| U2 generalized trusted writes | False | `programs.u2_trusted_writes` (request_id + actor accepted; else tier D) |
| U3 hold-until | False | `holds.supported`, `emergency.open_supported` (OPEN cannot be enabled without it) |
| U4 lockdown | False | `emergency.lockdown_supported` |
| U5 power / reboot behaviour | ("unknown", None) | every door's `power_behaviour` / `hold_survives_reboot` (worst case: open, survives) |
| U6 status push | False | `programs.push_on_status_change` |
| U7 pre-effect error codes | frozenset() | `pre_effect_codes`: only these codes may be shown as "refused"; everything else is unknown (`classify`) |
| W13-e emergency batch | False | `emergency.batch_command` (else the product loops per door) |

Doors: three synthetic stations shaped like opaque config entry ids - ENTRY (relay 1), SIDE (relay 1), DOCK (relays 1, 2) -
the same synthetic ids `test_wiskey_door_path.py` uses. Nothing here touches the product's database or app; a product test
seeds its own rows for these keys.
"""
from __future__ import annotations

from typing import Any

from fake_doorwin_clock import DEFAULT_START, DoorwinScheduler, FakeDoorwinClock
from fake_doorwin_door import DoorKey, FakeDoorBank
from fake_doorwin_emergency import FakeEmergencyEngine
from fake_doorwin_events import FakeHaEventSource
from fake_doorwin_program import FakeProgramEngine
from fake_doorwin_station import FakeHoldUntilEngine, FakeStationScheduleEngine

ENTRY = "01JTESTSTATIONENTRY000000A"
SIDE = "01JTESTSTATIONENTRY000000B"
DOCK = "01JTESTSTATIONENTRY000000C"
DEFAULT_STATIONS: dict[str, list[int]] = {ENTRY: [1], SIDE: [1], DOCK: [1, 2]}
UNKNOWN_DEFAULTS: dict[str, Any] = {"U1": False, "U2": False, "U3": False, "U4": False, "U5": ("unknown", None), "U6": False, "U7": frozenset(),
                                    "W13e": False}


def classify(code: str | None, pre_effect_codes: frozenset[str]) -> str:
    """CR-036 rule / U7: an answer is `refused` only when its code is a PROVEN before-effect code; any other failure (and
    a lost answer, code None) is `unknown`."""
    if code is not None and code in pre_effect_codes:
        return "refused"
    return "unknown"


class DoorwinWorld:
    def __init__(self, unknowns: dict[str, Any] | None = None, stations: dict[str, list[int]] | None = None, *, start: Any = DEFAULT_START,
                 zone: str = "Asia/Jerusalem", run_engines: bool = True) -> None:
        bad = set(unknowns or {}) - set(UNKNOWN_DEFAULTS)
        if bad:
            raise ValueError(f"unknown dependency keys: {sorted(bad)}")
        self.unknowns = {**UNKNOWN_DEFAULTS, **(unknowns or {})}
        self.stations = {k: list(v) for k, v in (stations or DEFAULT_STATIONS).items()}
        self.zone = zone
        self.clock = FakeDoorwinClock(start)
        self.scheduler = DoorwinScheduler(self.clock)
        self.bank = FakeDoorBank(self.clock, [(s, r) for s, relays in self.stations.items() for r in relays])
        self.programs = FakeProgramEngine(self.clock, self.scheduler, self.bank, self.stations, zone=zone)
        self.stations_engine = FakeStationScheduleEngine(self.clock, self.scheduler, self.bank)
        self.holds = FakeHoldUntilEngine(self.clock, self.scheduler, self.bank)
        self.emergency = FakeEmergencyEngine(self.clock, self.scheduler, self.doors(), bank=self.bank)
        self.events = FakeHaEventSource(self.clock, self.scheduler)
        self.pre_effect_codes: frozenset[str] = frozenset()
        self.arx_restarts = 0
        self.apply_unknowns()
        if run_engines:
            self.programs.start()
            self.stations_engine.start()

    def doors(self) -> list[DoorKey]:
        return [(s, r) for s, relays in self.stations.items() for r in relays]

    def apply_unknowns(self) -> None:
        u = self.unknowns
        self.stations_engine.available = bool(u["U1"])
        self.programs.u2_trusted_writes = bool(u["U2"])
        self.holds.supported = bool(u["U3"])
        self.emergency.open_supported = bool(u["U3"])
        self.emergency.lockdown_supported = bool(u["U4"])
        behaviour, survives = u["U5"]
        for door in self.bank.doors.values():
            door.power_behaviour, door.hold_survives_reboot = behaviour, survives
        self.programs.push_on_status_change = bool(u["U6"])
        self.pre_effect_codes = frozenset(u["U7"])
        self.emergency.batch_command = bool(u["W13e"])

    def classify(self, code: str | None) -> str:
        return classify(code, self.pre_effect_codes)

    # ------------------------------------------------------------ scenario controls
    def advance(self, seconds: float) -> int:
        return self.scheduler.advance(seconds)

    def run_until(self, instant: Any) -> int:
        return self.scheduler.run_until(instant)

    def ha_down(self) -> None:
        """Home Assistant stops: WisKey's tick, WisKey-side holds' relocks and every write through WisKey stop."""
        self.programs.ha_stop()
        self.holds.ha_stop()
        self.stations_engine.ha_running = False

    def ha_up(self) -> None:
        self.programs.ha_start()
        self.holds.ha_start()
        self.stations_engine.ha_running = True

    def network_loss(self, station: str, lost: bool = True) -> None:
        """HA <-> station network: WisKey's sends to that station fail (the station's own schedule is unaffected)."""
        self.programs.station_link_up[station] = not lost
        self.holds.station_link_up[station] = not lost

    def arx_link(self, up: bool) -> None:
        """Arx <-> HA: Arx can neither read nor write; WisKey and the station go on."""
        self.programs.arx_link_up = up
        self.holds.arx_link_up = up
        self.stations_engine.arx_link_up = up

    def arx_restart(self) -> int:
        """The add-on restarts: every job owned by "arx" is cancelled (the product re-registers its own on start). No engine
        job is touched - which is what SR-1 relies on. Returns how many Arx jobs were cancelled."""
        self.arx_restarts += 1
        return self.scheduler.cancel_owner("arx")
