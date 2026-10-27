#!/usr/bin/env python3
"""ECCACT-295: print the WisKey permit state of THIS source tree as JSON (ids, booleans and codes only - no secret, host or station).

It reports what the CODE permits. It never reports an installation switch or a live result as true: those are runtime facts that this
script cannot see (`runtime` says so), and `activation_claimed` is always false here.

usage: python scripts/eccact_activation_status.py [--db PATH] [--readiness]
  (run with the backend venv; --db adds the installation's registry rows, read-only)
  --readiness (with --db): EXTERNALBUILD-297 X1 - the external access readiness check over that database, read-only. The lines that need the
  running server (the write path's channel state, the last WisKey negotiation, the WhatsApp account) are `unknown` here; the server's
  GET /access-grants/readiness shows them.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))

PERMITS = [
    ("access_grants", "smplwise.services.access_grants", "GO_LIVE_PERMITTED", "access.external_grants"),
    ("bulk_people", "smplwise.services.bulk_people", "GO_LIVE_PERMITTED", "access.bulk_people"),
    ("capture_lease", "smplwise.services.capture_lease", "GO_LIVE_PERMITTED", "access.capture_lease"),
    ("access_cards_capture", "smplwise.services.access_cards", "CAPTURE_PERMITTED", "access.capture_lease"),
    ("acr5_readback_consumer", "smplwise.services.wiskey_acr5", "GO_LIVE_PERMITTED", "wiskey.acr5_access_state / acr5_normalize_user / acr5_presence / acr5_feature_plans"),
    ("peer_seam", "smplwise.services.wiskey_peer", "GO_LIVE_PERMITTED", "wiskey.peer_receipt"),
    ("peer_registry", "smplwise.services.wiskey_peer_registry", "GO_LIVE_PERMITTED", "wiskey.peer_pin (owner)"),
    ("door_windows_engine", "smplwise.services.door_windows_engine", "GO_LIVE_PERMITTED", "door_windows.enabled"),
    # SPLITSWITCH-297: two independent engine flags (both off); LIVE_ENGINE_BUILT is the legacy combined flag (True = both on)
    ("door_windows_program_engine", "smplwise.services.door_windows_engine", "PROGRAM_ENGINE_BUILT", "doors.windows.enabled"),
    ("door_emergency_engine", "smplwise.services.door_windows_engine", "EMERGENCY_ENGINE_BUILT", "doors.emergency.enabled"),
    ("door_engine_legacy_combined", "smplwise.services.door_windows_engine", "LIVE_ENGINE_BUILT", None),
    ("door_automation","smplwise.services.door_automation", "GO_LIVE_PERMITTED", "doors.automation_open"),
    ("bridge_key_rotation", "smplwise.services.bridge_rotation", "GO_LIVE_PERMITTED", "bridge.key_rotation"),
    ("peer_signed_capture_covered", "smplwise.services.wiskey_peer", "SIGNED_CAPTURE_COVERED", None),
    ("peer_wiskey_half_reviewed", "smplwise.services.wiskey_peer", "WISKEY_HALF_REVIEWED", None),
    ("service_identity_extended", "smplwise.services.service_identity", "EXTENDED_GO_LIVE_PERMITTED", "security.local_identity_extended"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db")
    ap.add_argument("--readiness", action="store_true")
    args = ap.parse_args()
    import importlib

    if args.readiness:
        if not args.db:
            print(json.dumps({"error": "--readiness needs --db PATH"}))
            return 2
        try:
            sys.stdout.reconfigure(encoding="utf-8")  # the Hebrew texts on a Windows console
        except (AttributeError, ValueError):
            pass
        readiness = importlib.import_module("smplwise.services.access_readiness")
        conn = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        try:
            print(json.dumps(readiness.readiness(conn, None, runtime=False), indent=1, ensure_ascii=False, sort_keys=True))
        finally:
            conn.close()
        return 0

    permits = {}
    for key, module, const, switch in PERMITS:
        permits[key] = {"constant": f"{module.rsplit('.', 1)[-1]}.{const}", "value": getattr(importlib.import_module(module), const),
                        "installation_switch": switch, "switch_default": "off" if switch else None}
    out = {"permits": permits, "activation_claimed": False,
           "runtime": "not observed by this script: installation switches, host registration, transport and live results are runtime facts"}
    feat = importlib.import_module("smplwise.services.wiskey_feature_exec")
    out["feature_transport_built"] = False
    out["features"] = {}
    if args.db:
        conn = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
        out["features"] = feat.status(conn, transport_built=False)
    else:
        out["features"] = {f: {"blockers": [feat.TRANSPORT_BLOCK], "active": False} for f in feat.FEATURES}
    print(json.dumps(out, indent=1, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
