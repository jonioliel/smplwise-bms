"""The inputs of the Web Push v2 golden file (frontend/tests/fixtures/push-v2.json) and the way to regenerate it.

`payload_v2` (smplwise/services/notify_channels.py) is the wire the service worker's parser (frontend/src/pwa/push-v2.ts) reads. The golden JSON is what it
produces today for three cases (ack + snooze, a doorbell with open_door, a resolved notice) with a frozen clock; tests/test_notify_payload_golden.py fails when the
backend drifts from it, and frontend/tests/unit-notify-center.spec.ts parses the same file through the worker's pure function. After an INTENDED change of the
payload run, from smplwise_vms/backend:   python tests/make_push_v2_golden.py    and commit the new JSON together with the parser change.
"""
from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

NOW = dt.datetime(2026, 10, 1, 11, 2, 0, tzinfo=dt.timezone.utc)
TZ = "Asia/Jerusalem"
GOLDEN = Path(__file__).resolve().parents[3] / "frontend" / "tests" / "fixtures" / "push-v2.json"

LEAK = {"id": "ntf-golden-leak", "title": "דליפת מים", "body": "חיישן ההצפה מתחת לכיור דיווח על מים.", "place": "מטבח", "category": "safety", "severity": "critical"}
RING = {"id": "ntf-golden-ring", "title": "צלצול בדלת", "body": "מישהו מצלצל בעמדת הכניסה הראשית.", "place": "כניסה ראשית", "category": "doors", "severity": "alert"}


def build() -> dict:
    from smplwise.services.notify_channels import payload_v2

    return {
        "ack_snooze": payload_v2(LEAK, "type_place", tokens={"ack": "AAAAAAAAAAAAAAAAAAAAAA", "snooze": "BBBBBBBBBBBBBBBBBBBBBB"}, door=None, tz_name=TZ, mode="new", now=NOW),
        "doorbell_open_door": payload_v2(RING, "full", tokens={"ack": "CCCCCCCCCCCCCCCCCCCCCC", "snooze": "DDDDDDDDDDDDDDDDDDDDDD"},
                                         door={"id": "st-main", "name": "דלת הכניסה", "can_open": True}, tz_name=TZ, mode="new", now=NOW),
        "resolved": payload_v2(LEAK, "type_place", tokens=None, door=None, tz_name=TZ, mode="resolved", now=NOW),
    }


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    GOLDEN.parent.mkdir(parents=True, exist_ok=True)
    GOLDEN.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {GOLDEN}")
