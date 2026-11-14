"""CR-BRIDGE-GAPS-2438 (code review 2026-11-13, report 05 P2-21 and P3-07): the bridge gaps not covered by the per-service suites.

- `sync_directory` (the add-on's "sync users" button) is coalesced: one push per push_health.COALESCE_S.
- A rotation ANSWER handed back to the `rotate` service is refused before the MAC (both peers sign with the same key).
- The POST timeouts are a named `aiohttp.ClientTimeout`; the unused `const.SIGNATURE_WINDOW_S` is gone.
- `manifest.json` deliberately does NOT declare `single_config_entry` (see the test).
Synthetic values only; no Home Assistant, no add-on, no network.
"""
from __future__ import annotations

import asyncio
import importlib.util
import json
import sys
import time
from pathlib import Path

from smplwise.services import bridge_keys as bk

ROOT = Path(__file__).resolve().parents[3]
BRIDGE = ROOT / "custom_components" / "smplwise_bridge"
MIRROR = ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(f"_sw_bridge_gaps_{name}", BRIDGE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


push_health = _load("push_health")
keyset_mod = _load("keyset")


# ------------------------------------------------------------------------------------------- sync_directory coalescing (P2-21)


class Clock:
    def __init__(self) -> None:
        self.t = 100.0
        self.slept: list[float] = []

    def __call__(self) -> float:
        return self.t

    async def sleep(self, s: float) -> None:
        self.slept.append(s)
        self.t += s
        await asyncio.sleep(0)


def test_a_burst_of_presses_becomes_one_push_per_window_and_no_answer_is_older_than_its_press():
    clock = Clock()
    started: list[float] = []

    async def push():
        started.append(clock.t)
        await asyncio.sleep(0)
        clock.t += 0.1  # the push takes a moment
        return len(started)

    co = push_health.Coalescer(push, now=clock, sleep=clock.sleep)

    async def scenario():
        first = await co()  # nothing before: pushes at once
        burst = await asyncio.gather(*(co() for _ in range(5)))  # five presses right after: ONE later push, after the window
        clock.t += push_health.COALESCE_S + 1
        later = await co()  # a quiet press: pushes at once
        return first, burst, later

    first, burst, later = asyncio.run(scenario())
    assert first == 1 and burst == [2] * 5 and later == 3 and co.pushes == 3
    assert clock.slept == [push_health.COALESCE_S], "the burst waited out the window once"
    assert started[1] - started[0] >= push_health.COALESCE_S and started[2] > started[1]


def test_a_failed_push_is_not_shared_as_a_success():
    clock = Clock()
    calls = []

    async def push():
        calls.append(clock.t)
        if len(calls) == 1:
            raise RuntimeError("boom")
        return 3

    co = push_health.Coalescer(push, now=clock, sleep=clock.sleep)

    async def scenario():
        try:
            await co()
        except RuntimeError:
            pass
        return await co()

    assert asyncio.run(scenario()) == 3 and len(calls) == 2 and clock.slept == [push_health.COALESCE_S]


def test_sync_directory_goes_through_the_coalescer():
    src = (BRIDGE / "__init__.py").read_text(encoding="utf-8")
    body = src.split("async def sync_directory", 1)[1].split("hass.services.async_register", 1)[0]
    assert "await sync_push()" in body and "sync_push = Coalescer(push_directory)" in src
    assert push_health.COALESCE_S == 2.0


# ------------------------------------------------------------------------------------------- rotation answer reflection (P3-07, verify)


def test_a_rotation_answer_handed_back_is_refused_before_the_mac():
    clock = {"t": time.time()}
    now = lambda: clock["t"]  # noqa: E731
    ks = keyset_mod.KeySet("L", None, now=now, mono=now)
    ask = bk.sign_with("g0-legacy", "L", {"protocol": keyset_mod.PROTOCOL, "op": "status", "rotation_id": "r1"}, ts=int(clock["t"]))
    answer = ks.handle_control(json.loads(json.dumps(ask)))
    assert answer["ok"] is True and "reply_to" in answer and "sig" in answer
    clock["t"] += 1
    seen_before, hw_before = dict(ks._seen), dict(ks.hw)
    assert ks.handle_control(json.loads(json.dumps(answer))) == {"ok": False, "code": "bad_format"}, "unsigned, like any bad shape"
    assert ks._seen == seen_before and ks.hw == hw_before, "never reached the MAC, the replay cache or the high-water mark"
    # the gap it closes: the answer's signature itself verifies under the shared key
    assert ks.verify(json.loads(json.dumps(answer))) is None
    # a real control message (the add-on never sends `reply_to` / `ok`) still works
    ok = bk.sign_with("g0-legacy", "L", {"protocol": keyset_mod.PROTOCOL, "op": "status", "rotation_id": "r2"}, ts=int(clock["t"]))
    assert ks.handle_control(ok)["ok"] is True


def test_the_add_on_never_puts_an_answer_only_field_into_a_control_message():
    import re

    src = (ROOT / "smplwise_vms" / "backend" / "smplwise" / "services" / "bridge_rotation.py").read_text(encoding="utf-8")
    call = src.split("def _call(", 1)[1].split("answer = self.peer.call", 1)[0]
    assert 'body = {"protocol": PROTOCOL, "op": op, "rotation_id": rot["id"], **fields}' in call  # the only fields are the caller's
    assert keyset_mod.ANSWER_ONLY == ("reply_to", "ok")
    assert "reply_to=" not in src and not re.search(r"self\._call\([^)]*\bok=", src)


# ------------------------------------------------------------------------------------------- nits (P3-07)


def test_post_timeouts_are_a_named_client_timeout():
    for name in ("__init__.py", "config_flow.py"):
        text = (BRIDGE / name).read_text(encoding="utf-8")
        assert "timeout=10" not in text and "timeout=ClientTimeout(total=ADDON_POST_TIMEOUT_S)" in text and "from aiohttp import ClientTimeout" in text, name
    const = (BRIDGE / "const.py").read_text(encoding="utf-8")
    assert "ADDON_POST_TIMEOUT_S = 10" in const and "\nSIGNATURE_WINDOW_S" not in const
    assert "SIGNATURE_WINDOW_S = 60" in (BRIDGE / "signing.py").read_text(encoding="utf-8"), "the window signing.py uses stays"


def test_the_manifest_does_not_declare_single_config_entry():
    """Verified intent (review 05 P3-07 asked for `single_config_entry: true`): the bridge is already one entry (unique id = the domain), and
    Home Assistant aborts EVERY new flow of a single-config-entry integration that has an entry, except reauth / reconfigure / ignore -
    including the Supervisor's `hassio` discovery flow that delivers a re-paired code to the existing entry (BRIDGE-STALE-DISCOVERY-2383,
    config_flow.async_step_hassio). Declaring it would silently drop that update path, so it is left out on purpose."""
    manifest = json.loads((BRIDGE / "manifest.json").read_text(encoding="utf-8"))
    assert "single_config_entry" not in manifest and manifest["version"] == "0.10.7"
    flow = (BRIDGE / "config_flow.py").read_text(encoding="utf-8")
    assert "async def async_step_hassio" in flow and "await self.async_set_unique_id(DOMAIN)" in flow


def test_both_copies_of_the_touched_files_are_identical():
    for name in ("__init__.py", "cast_service.py", "config_flow.py", "config_service.py", "const.py", "keyset.py", "manifest.json", "push_health.py",
                 "runnable.py"):
        assert (BRIDGE / name).read_bytes() == (MIRROR / name).read_bytes(), name
