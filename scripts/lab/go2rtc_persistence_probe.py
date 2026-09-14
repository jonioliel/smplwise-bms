#!/usr/bin/env python3
"""go2rtc API persistence check (T006 / R012), approved by the owner on 2026-09-14.

Creates ONE stream in the product namespace with a dummy source that is never connected
(no consumer is opened), inspects /api/streams and /api/config, deletes the stream again and
re-inspects. It never touches streams outside the ``smplwise_`` namespace.
Raw (credential-redacted) captures go to private-evidence/go2rtc-probes/<timestamp>/.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "lab"))
from nvr_probe import ENV_PATH, load_env, make_redactor  # noqa: E402

NAME = "smplwise_probe_test"
DUMMY_SRC = "rtsp://127.0.0.1:1/smplwise_probe_test"  # loopback, closed port: never reaches any camera


def redact_yaml(text: str, red) -> str:
    text = red(text)
    return re.sub(r"(password|token|api_key|secret)(\s*:\s*)\S+", r"\1\2***", text, flags=re.I)


def main() -> int:
    env = load_env(ENV_PATH)
    red = make_redactor(env)
    base = env["GO2RTC_URL"].rstrip("/")
    auth = (env.get("GO2RTC_API_USER"), env.get("GO2RTC_API_PASSWORD"))
    client = httpx.Client(base_url=base, timeout=10, auth=auth if all(auth) else None)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = ROOT / "private-evidence" / "go2rtc-probes" / stamp
    out.mkdir(parents=True, exist_ok=True)
    log: list[dict] = []

    def snapshot(tag: str) -> tuple[bool, bool, int, int]:
        streams = client.get("/api/streams").json()
        cfg = client.get("/api/config").text
        (out / f"{tag}_streams.json").write_text(json.dumps({red(k): "..." for k in streams}, indent=1), encoding="utf-8")
        (out / f"{tag}_config.yaml").write_text(redact_yaml(cfg, red), encoding="utf-8")
        in_streams = NAME in streams
        in_cfg = NAME in cfg
        cfg_stream_names = re.findall(r"^\s{2}([A-Za-z0-9_./:@-]+):", cfg, flags=re.M)
        return in_streams, in_cfg, len(streams), len(cfg_stream_names)

    ver = client.get("/api").json()
    print("go2rtc", ver.get("version"), "config_path:", ver.get("config_path"))
    before = snapshot("1_before")
    print(f"before : in_streams={before[0]} in_config={before[1]} streams={before[2]} config_keys~={before[3]}")

    r = client.put("/api/streams", params={"name": NAME, "src": DUMMY_SRC})
    print(f"PUT /api/streams name={NAME} -> HTTP {r.status_code} {r.text[:120]!r}")
    log.append({"step": "put", "status": r.status_code})
    after_put = snapshot("2_after_put")
    print(f"after PUT: in_streams={after_put[0]} in_config={after_put[1]} streams={after_put[2]} config_keys~={after_put[3]}")

    r = client.delete("/api/streams", params={"src": NAME})
    print(f"DELETE /api/streams src={NAME} -> HTTP {r.status_code} {r.text[:120]!r}")
    log.append({"step": "delete", "status": r.status_code})
    after_del = snapshot("3_after_delete")
    print(f"after DEL: in_streams={after_del[0]} in_config={after_del[1]} streams={after_del[2]} config_keys~={after_del[3]}")

    verdict = {
        "put_persists_to_config_file": after_put[1],
        "delete_removes_from_config_file": after_put[1] and not after_del[1],
        "delete_removes_from_memory": after_put[0] and not after_del[0],
        "stream_count_unchanged": before[2] == after_del[2],
    }
    (out / "verdict.json").write_text(json.dumps({"go2rtc_version": ver.get("version"), "steps": log, **verdict}, indent=2), encoding="utf-8")
    print("verdict:", json.dumps(verdict))
    if after_del[0] or after_del[1]:
        print("WARNING: probe stream still present after delete — manual cleanup needed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
