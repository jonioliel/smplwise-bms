#!/usr/bin/env python3
"""Permanent Frigate restream (FRIGPERM-295): dry run by default, read only.

    python scripts/frigate_permanent_restream.py [--env-file secrets/frigate_oliel.env] [--only cam,cam] [--out report.txt] [--snippet]
    python scripts/frigate_permanent_restream.py --verify          # after the owner's restart: which planned streams Frigate lists
    python scripts/frigate_permanent_restream.py --apply --digest <from the dry run> --owner-go OWNER-GO-FRIGATE-STREAMS

The dry run makes two GET requests (`/api/config`, `/api/go2rtc/streams`) and prints a REDACTED report. `--apply` sends ONE
`PUT /api/config/set` (adds `go2rtc.streams` entries to Frigate's YAML, `requires_restart: 1`; the running Frigate does not change) and
refuses without the plan digest of the report just reviewed and the owner phrase. This script never restarts Frigate. The env file
(FRIGATE_URL, FRIGATE_USER, FRIGATE_PASS; optional FRIGATE_TLS_MODE, FRIGATE_TLS_PIN) is read in memory; no value is printed.
"""
from __future__ import annotations

import argparse
import dataclasses
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))


def read_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env-file", default=str(ROOT / "secrets" / "frigate_oliel.env"))
    ap.add_argument("--only", default="", help="comma separated camera keys (default: every enabled camera)")
    ap.add_argument("--out", help="write the redacted report to this file as well")
    ap.add_argument("--snippet", action="store_true", help="print the manual YAML block (placeholders for credential cameras)")
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--digest", default="")
    ap.add_argument("--owner-go", default="")
    a = ap.parse_args(argv)

    with tempfile.TemporaryDirectory() as tmp:
        os.environ["SW_DATA_DIR"] = tmp
        from smplwise.config import load_settings
        from smplwise.services.recorders import frigate as fr
        from smplwise.services.recorders import frigate_perm_restream as fp

        env = read_env(Path(a.env_file))
        u = urlsplit(env["FRIGATE_URL"])
        extra = {"scheme": u.scheme or "https"}
        if env.get("FRIGATE_TLS_MODE"):
            extra["tls_mode"] = env["FRIGATE_TLS_MODE"]
        if env.get("FRIGATE_TLS_PIN"):
            extra["tls_pin"] = env["FRIGATE_TLS_PIN"]
        s = dataclasses.replace(load_settings(), nvr_host=u.hostname, nvr_http_port=u.port or (80 if u.scheme == "http" else 8971),
                                nvr_user=env["FRIGATE_USER"], nvr_password=env["FRIGATE_PASS"], nvr_vendor="frigate", nvr_extra=extra)
        ad = fr.FrigateAdapter("nvr-1", s)
        only = [x.strip() for x in a.only.split(",") if x.strip()] or None
        plan = fp.load_plan(ad, only=only)
        if a.verify:
            print(fp.verify_after_restart(ad, plan))
            return 0
        text = fp.report(plan)
        print(text)
        if a.snippet:
            print("\n" + fp.yaml_snippet(plan))
        if a.out:
            Path(a.out).write_text(text + "\n", encoding="utf-8")
        if a.apply:
            print(fp.apply_plan(ad, plan, digest=a.digest, owner_go=a.owner_go))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
