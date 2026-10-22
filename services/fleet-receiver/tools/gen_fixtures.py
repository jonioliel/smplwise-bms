"""CR-FLEET215: regenerate the receiver's shared schema and its interoperability fixture from the add-on's own code.

    <backend venv python> services/fleet-receiver/tools/gen_fixtures.py

- `src/schema.json`: services/fleet_report.schema_json() - the receiver validates reports with exactly this description;
- `test/fixtures/signed_report.json`: one report body signed by the add-on's signer with a THROWAWAY test key (seed bytes 0..31, published
  here on purpose - it is enrolled nowhere and only proves that the TypeScript verifier accepts what the Python signer produces).

The backend test tests/test_fleet_receiver_fixtures_215.py fails when either committed file drifts from the code."""
from __future__ import annotations

import base64
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))

from cryptography.hazmat.primitives import serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import ed25519  # noqa: E402

from smplwise.services import fleet_keys, fleet_report, signing  # noqa: E402

HERE = Path(__file__).resolve().parents[1]
TEST_SEED = bytes(range(32))
FIXTURE_ID = "0123456789abcdef0123456789abcdef"
FIXTURE_NOW = dt.datetime(2026, 10, 22, 3, 17, 42, tzinfo=dt.timezone.utc)


def fixture_body() -> dict:
    return {
        "schema": fleet_report.SCHEMA, "mode": "full", "demo_mode": False, "overall": "warn", "uptime_h": 412,
        "versions": {"addon": "2.12.1", "bridge": "0.9.7", "bridge_required": "0.9.0", "ha": "2026.10.2", "go2rtc": "1.9.9", "db_schema": 149},
        "components": {c: "ok" for c in fleet_report.COMPONENTS} | {"backups": "warn", "frigate": "absent"},
        "counts": {"cameras": 24, "recorders": 1, "recorders_by_vendor": {"hikvision": 1, "provision_isr": 0, "frigate": 0, "none": 0},
                   "ha_entities": 512, "floors_published": 3, "users_active": 7, "system_admins": 2},
        "alerts_open": {"info": 1, "alert": 2, "critical": 0},
        "disk": {"free_pct": 41, "free_gb": 38, "total_gb": 93},
        "backup": {"count": 6, "last_age_h": 50, "offbox_targets": 0},
        "update": {"check": "current", "available": False, "latest": "2.12.1"},
        "readiness": {"score": 86, "ready": False, "missing": ["backup_recent", "backup_offsite"]},
    }


def build() -> tuple[dict, dict]:
    payload = fleet_report.assemble(fixture_body(), installation_id=FIXTURE_ID, seq=7, now=FIXTURE_NOW)
    body = fleet_report.canonical(payload)
    key = ed25519.Ed25519PrivateKey.from_private_bytes(TEST_SEED)
    pub = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    fixture = {
        "note": "THROWAWAY test key (seed 0..31). Enrolled nowhere. Regenerate with tools/gen_fixtures.py.",
        "installation_id": FIXTURE_ID, "kid": signing.kid_of(pub), "public_key": base64.b64encode(pub).decode("ascii"),
        "body": body.decode("ascii"), "signature": base64.b64encode(key.sign(fleet_keys.CONTEXT + body)).decode("ascii"),
        "context": fleet_keys.CONTEXT.decode("ascii"),
    }
    fixture["enrollment_code"] = fleet_keys.enrollment_code({"installation_id": FIXTURE_ID, "kid": fixture["kid"], "public_key": fixture["public_key"]})
    return fleet_report.schema_json(), fixture


def main() -> None:
    schema, fixture = build()
    (HERE / "src" / "schema.json").write_text(json.dumps(schema, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    (HERE / "test" / "fixtures").mkdir(parents=True, exist_ok=True)
    (HERE / "test" / "fixtures" / "signed_report.json").write_text(json.dumps(fixture, indent=1, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print("wrote src/schema.json and test/fixtures/signed_report.json")


if __name__ == "__main__":
    main()
