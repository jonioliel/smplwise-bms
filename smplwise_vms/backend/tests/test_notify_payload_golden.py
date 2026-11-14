"""Drift guard: the Web Push v2 payload the backend builds must equal the golden file the frontend parser is tested against
(frontend/tests/fixtures/push-v2.json; regenerate with tests/make_push_v2_golden.py after an intended change)."""
from __future__ import annotations

import json

from make_push_v2_golden import GOLDEN, build


def test_payload_v2_equals_the_golden_file() -> None:
    assert json.loads(GOLDEN.read_text(encoding="utf-8")) == build()


def test_the_golden_keeps_the_safety_shape() -> None:
    g = json.loads(GOLDEN.read_text(encoding="utf-8"))
    ring = {a["a"]: a for a in g["doorbell_open_door"]["actions"]}
    assert "t" not in ring["open_door"] and ring["open_door"]["url"].startswith("#/doors/")  # a deep link, never a token
    assert all("t" in ring[k] for k in ("ack", "snooze"))
    assert "actions" not in g["resolved"] and g["resolved"]["resolved"] is True
    assert "unread" not in json.dumps(g)
