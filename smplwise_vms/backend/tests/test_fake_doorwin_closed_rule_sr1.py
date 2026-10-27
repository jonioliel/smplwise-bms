"""CR-039 W0: the closed-rule static test for SR-1 (spec 4.1, 16: "a static test greps the services for `release_door` /
`alwaysOpen` callers and pins the allowed set").

SR-1: no Arx code path sends `alwaysOpen`, `open`, a hold or a pulse from a timer or a scheduler; the only Arx-started opening
is `routers/access_control.open_door` (a person's confirmed click, or a converted item's run under CR-033 R-17).

How: every module under `smplwise/` is parsed (AST, not text: comments and docstrings do not count) for
- string constants that name a door-OPENING command toward WisKey / the bridge / a station (`OPEN_PRIMITIVES`), and
- calls of the functions that send one (`OPEN_CALLS`).
The set of (module, primitive) pairs is PINNED. A new pair fails this test on purpose: the slice that adds it (W3 the
engine adapters, W4 the triggers, W5 the emergency core) must extend `PINNED` in the same commit and say in the commit
message why the new site is not a timer-driven open. On top of the pin, the timer-shaped modules this CR plans
(`door_windows_watch.py`, and any module whose name says watch / scheduler / tick / jobs) may never hold an open primitive -
that rule needs no update when they land.

The program commands (`technical_program_save` / `_action`) are schedule writes, not opens; they are pinned separately
(`ENGINE_WRITES`) so the engine adapter that W3 adds is reviewed the same way, and the watchdog may only pause (4.4).
"""
from __future__ import annotations

import ast
import functools
import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
PACKAGE = BACKEND / "smplwise"

OPEN_PRIMITIVES = frozenset({
    "alwaysOpen",  # ISAPI RemoteControl hold-open
    "stations/test_unlock",  # WisKey's momentary release (the interim door transport)
    "door_open",  # the trusted bridge's signed door service
    "doors/hold_until",  # W13-b (U3)
    "doors/emergency_open",  # W13-e
})
# Home Assistant's lock services: Arx never calls them on a WisKey lock (CR-033); today they appear in the editors' guards,
# policies and the bridge's allow-lists. Pinned separately so a new site is reviewed the same way.
HA_LOCK_SERVICES = frozenset({"lock.unlock", "lock.open"})
OPEN_CALLS = frozenset({"release_door", "hold_command", "open_door"})  # open_door: the one Arx-started opening (SR-1)
ENGINE_WRITE_PRIMITIVES = frozenset({"stations/technical_program_save", "stations/technical_program_action"})

# today's sites (origin/main 19dbbbcc, release 2.4.10) - extend deliberately, see the module docstring
PINNED = frozenset({
    ("smplwise/routers/access_control.py", "call:release_door"),  # open_door: a person's confirmed click (SR-1's one allowed path)
    ("smplwise/routers/access_control.py", "call:open_door"),  # the release route and the devices tile, both a person's click
    ("smplwise/routers/access_control.py", "door_open"),
    ("smplwise/services/door_run_guard.py", "call:open_door"),  # a converted item's run (CR-033 R-17), refused today (2.4.9 decision 5)
    ("smplwise/services/intercom_client.py", "stations/test_unlock"),  # the release_door wrapper itself
    ("smplwise/services/trusted_door.py", "door_open"),  # the signed transport behind open_door
    ("smplwise/services/wiskey_channels.py", "stations/test_unlock"),  # the channel allowlist (a list of names, not a send)
    # DOORWIN-295 re-pin on integ/293 (sites added after 2.4.10, reviewed - neither sends anything):
    ("smplwise/services/elevators.py", "door_open"),  # CR-INFRA-ELEVATORS: an elevator's binary-sensor ROLE name (read only)
    ("smplwise/services/intercom_authority.py", "door_open"),  # the command -> scope classification table (a lookup, not a send)
    ("smplwise/services/intercom_authority.py", "stations/test_unlock"),  # same table
    # 2.16.0 integration re-pin (reviewed - neither sends anything):
    ("smplwise/services/emergency/model.py", "door_open"),  # an elevator's derived-state label (door ajar -> amber), read only
    ("smplwise/services/incidents.py", "door_open"),  # the incident timeline step KIND for an audit row of a person's confirmed release (read only)
})
PINNED_HA_LOCK = frozenset({
    ("smplwise/routers/automations.py", "lock.unlock"),
    ("smplwise/routers/ha.py", "lock.unlock"),
    ("smplwise/services/automation_policy.py", "lock.open"),
    ("smplwise/services/automation_policy.py", "lock.unlock"),
    ("smplwise/services/automation_scope.py", "lock.unlock"),
    ("smplwise/services/automation_text.py", "lock.unlock"),
    ("smplwise/services/door_path.py", "lock.open"),  # OPEN_SERVICES: the refusal list of the door path
    ("smplwise/services/door_path.py", "lock.unlock"),
    ("smplwise/services/door_path_guard.py", "lock.open"),  # the editor block
    ("smplwise/services/door_path_guard.py", "lock.unlock"),
    ("smplwise/services/ha_bridge.py", "lock.unlock"),
    ("smplwise/services/schedule_policy.py", "lock.unlock"),
    ("smplwise/services/schedule_view.py", "lock.open"),
    ("smplwise/services/schedule_view.py", "lock.unlock"),
})
# WISKEY-OWNER26-297 added the Native program transport (pinned here by DOORWRITE-297, which found the pin missing): the ONE module that
# names the save / action commands. Every caller reaches it through door_windows_engine.WiskeyProgramEngine (save / pause) only.
ENGINE_WRITES: frozenset[tuple[str, str]] = frozenset({
    ("smplwise/services/wiskey_program_direct.py", "stations/technical_program_save"),
    ("smplwise/services/wiskey_program_direct.py", "stations/technical_program_action"),
})
TIMER_SHAPED = re.compile(r"(^door_windows_watch|_watch$|watchdog|scheduler|_tick$|_ticker$|_jobs?$|^notify_sources$)")


def _constant_hits(value: str, names: frozenset[str]) -> set[str]:
    hits = set()
    for name in names:
        if value == name or (("/" in name or "." in name) and value.endswith(name) and len(value) <= len(name) + 40):
            hits.add(name)
    return hits


NEEDLES = tuple(OPEN_PRIMITIVES | HA_LOCK_SERVICES | ENGINE_WRITE_PRIMITIVES | OPEN_CALLS)


@functools.lru_cache(maxsize=4)
def scan(package: Path = PACKAGE) -> tuple[frozenset, frozenset, frozenset]:
    """(open sites, HA lock-service sites, program-write sites) as (module, primitive) pairs."""
    opens: set[tuple[str, str]] = set()
    locks: set[tuple[str, str]] = set()
    writes: set[tuple[str, str]] = set()
    for path in sorted(package.rglob("*.py")):
        rel = path.relative_to(package.parent).as_posix()
        text = path.read_text(encoding="utf-8")
        if not any(n in text for n in NEEDLES):
            continue  # a cheap text filter first; the AST decides
        tree = ast.parse(text, filename=rel)
        docstrings = {id(n.body[0].value) for n in ast.walk(tree)
                      if isinstance(n, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and n.body
                      and isinstance(n.body[0], ast.Expr) and isinstance(n.body[0].value, ast.Constant)}
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docstrings:
                opens |= {(rel, h) for h in _constant_hits(node.value, OPEN_PRIMITIVES)}
                locks |= {(rel, h) for h in _constant_hits(node.value, HA_LOCK_SERVICES)}
                writes |= {(rel, h) for h in _constant_hits(node.value, ENGINE_WRITE_PRIMITIVES)}
            elif isinstance(node, ast.Call):
                func = node.func
                name = func.attr if isinstance(func, ast.Attribute) else func.id if isinstance(func, ast.Name) else None
                if name in OPEN_CALLS:
                    opens.add((rel, f"call:{name}"))
    return frozenset(opens), frozenset(locks), frozenset(writes)


def test_open_primitives_are_pinned():
    opens, _, _ = scan()
    added, gone = opens - PINNED, PINNED - opens
    assert not added, f"new door-opening sites (review against SR-1, then pin them): {sorted(added)}"
    assert not gone, f"pinned sites disappeared (unpin them): {sorted(gone)}"


def test_ha_lock_service_sites_are_pinned():
    _, locks, _ = scan()
    assert locks == PINNED_HA_LOCK, f"lock.unlock / lock.open sites changed (review against CR-033 / SR-1): {sorted(locks ^ PINNED_HA_LOCK)}"


def test_program_writes_are_pinned():
    _, _, writes = scan()
    assert writes == ENGINE_WRITES, f"program write sites changed: {sorted(writes ^ ENGINE_WRITES)}"


def test_timer_shaped_modules_never_open():
    opens, locks, writes = scan()
    bad = sorted((m, p) for m, p in opens | locks if TIMER_SHAPED.search(Path(m).stem))
    assert not bad, f"a timer-shaped module names a door-opening primitive (SR-1): {bad}"
    saves = sorted((m, p) for m, p in writes if TIMER_SHAPED.search(Path(m).stem) and p.endswith("_save"))
    assert not saves, f"a timer-shaped module saves a program (the watchdog may only pause, 4.4): {saves}"


def test_the_scanner_finds_what_it_must(tmp_path):
    pkg = tmp_path / "smplwise"
    (pkg / "services").mkdir(parents=True)
    (pkg / "services" / "door_windows_watch.py").write_text(
        '"""alwaysOpen in a docstring does not count."""\n'
        "def tick(call):\n"
        "    # alwaysOpen in a comment does not count\n"
        "    call('hikvision_intercom/doors/hold_until')\n"
        "    release_door(call, 's', 1)\n"
        "    call('hikvision_intercom/stations/technical_program_save')\n", encoding="utf-8")
    opens, _, writes = scan(pkg)
    assert opens == {("smplwise/services/door_windows_watch.py", "doors/hold_until"), ("smplwise/services/door_windows_watch.py", "call:release_door")}
    assert writes == {("smplwise/services/door_windows_watch.py", "stations/technical_program_save")}
    assert TIMER_SHAPED.search("door_windows_watch") and TIMER_SHAPED.search("door_windows_scheduler")
    assert not TIMER_SHAPED.search("tickets") and not TIMER_SHAPED.search("schedule_view")  # no false positives on today's names
    bad = sorted((m, p) for m, p in opens if TIMER_SHAPED.search(Path(m).stem))
    assert len(bad) == 2  # what test_timer_shaped_modules_never_open would report for such a module
