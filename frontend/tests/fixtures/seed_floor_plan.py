"""Seed for the `devices_floor` fixture group (scripts/fixture_job.py): a site / building / floor with a published plan and
two camera channels, through the backend's own routes, so specs written against the developer backend (evidence-custom-roles)
find a floor with a plan and a camera. Stdlib only. Usage: seed_floor_plan.py <api_port> [control_port]."""
from __future__ import annotations

import json
import sys
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PLAN = ROOT / "smplwise_vms" / "backend" / "tests" / "fixtures" / "plan_detect" / "apartment.png"


def call(url: str, data: dict | None = None, raw: tuple[bytes, str] | None = None) -> dict:
    headers = {}
    body = None
    if raw is not None:
        body, headers["Content-Type"] = raw
    elif data is not None:
        body, headers["Content-Type"] = json.dumps(data).encode(), "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST" if (body is not None or data is not None) else "GET")
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode() or "{}"
        return json.loads(text)


def multipart(name: str, content: bytes) -> tuple[bytes, str]:
    b = "----seed" + uuid.uuid4().hex
    head = f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'.encode()
    return head + content + f"\r\n--{b}--\r\n".encode(), f"multipart/form-data; boundary={b}"


def main(argv: list[str]) -> int:
    api = int(argv[1])
    control = int(argv[2]) if len(argv) > 2 else api + 1
    base = f"http://127.0.0.1:{api}/api/v1"
    site = call(f"{base}/sites", {"name": "אתר בדיקה", "address": ""})["id"]
    building = call(f"{base}/sites/{site}/buildings", {"name": "מבנה בדיקה"})["id"]
    floor = call(f"{base}/buildings/{building}/floors", {"name": "קומת בדיקה", "level": 0})["id"]
    asset = call(f"{base}/floors/{floor}/plan-assets", raw=multipart("apartment.png", PLAN.read_bytes()))["id"]
    version = call(f"{base}/floors/{floor}/plan-versions", {"asset_id": asset})["id"]
    call(f"{base}/plan-versions/{version}/publish", {})
    cams = call(f"http://127.0.0.1:{control}/seed-cameras", {"model": "DS-7616NXI-K2/D", "cameras": [
        {"channel": 1, "alias": "מצלמה 1", "status": "online"}, {"channel": 2, "alias": "מצלמה 2", "status": "online"}]})
    print(f"seed_floor_plan: floor {floor} with a published plan, cameras {sorted(cams.get('cameras', {}))}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
