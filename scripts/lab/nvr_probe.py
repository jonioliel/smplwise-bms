#!/usr/bin/env python3
"""Read-only Hikvision ISAPI probe for G0 intake (T002/T003).

Reads credentials from secrets/lab.env, performs bounded GET requests (plus one optional
recording search POST), stores the raw responses under private-evidence/nvr-probes/<timestamp>/
(gitignored) and prints a redacted summary. Nothing here writes to the device.

Usage (from the repository root):
    .venv/Scripts/python.exe scripts/lab/nvr_probe.py            # capability/discovery probes
    .venv/Scripts/python.exe scripts/lab/nvr_probe.py --search 101 --hours 1
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / "secrets" / "lab.env"
EVIDENCE_DIR = ROOT / "private-evidence" / "nvr-probes"

# Candidate endpoints from the legacy add-on and docs/legacy/API_MAPPING_V2.md. All GET, all read-only.
GET_PROBES: list[tuple[str, str]] = [
    ("device_info", "/ISAPI/System/deviceInfo"),
    ("system_time", "/ISAPI/System/time"),
    ("system_capabilities", "/ISAPI/System/capabilities"),
    ("working_status", "/ISAPI/System/workingstatus?format=json"),
    ("inputproxy_channels", "/ISAPI/ContentMgmt/InputProxy/channels"),
    ("inputproxy_channels_status", "/ISAPI/ContentMgmt/InputProxy/channels/status"),
    ("streaming_channels", "/ISAPI/Streaming/channels"),
    ("record_tracks", "/ISAPI/ContentMgmt/record/tracks"),
    ("record_profile", "/ISAPI/ContentMgmt/record/profile"),
    ("search_profile", "/ISAPI/ContentMgmt/search/profile"),
    ("contentmgmt_capabilities", "/ISAPI/ContentMgmt/capabilities"),
    ("download_capabilities", "/ISAPI/ContentMgmt/download/capabilities"),
    ("logsearch_capabilities", "/ISAPI/ContentMgmt/logSearch/capabilities"),
    ("event_capabilities", "/ISAPI/Event/capabilities"),
    ("event_triggers_cap", "/ISAPI/Event/triggersCap"),
    ("storage_hdd", "/ISAPI/ContentMgmt/Storage/hdd"),
    ("storage_quota", "/ISAPI/ContentMgmt/Storage/quota"),
    ("security_user_permission", "/ISAPI/Security/UserPermission"),
]


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def make_redactor(env: dict[str, str]):
    secrets = [v for k, v in env.items() if v and ("PASSWORD" in k or "TOKEN" in k)]
    hosts = [v for k, v in env.items() if v and k.endswith("_HOST")]

    def redact(text: str) -> str:
        for s in secrets:
            text = text.replace(s, "***")
        for h in hosts:
            text = text.replace(h, "<nvr-host>")
        text = re.sub(r"<serialNumber>[^<]*</serialNumber>", "<serialNumber>[redacted]</serialNumber>", text)
        text = re.sub(r"<macAddress>[^<]*</macAddress>", "<macAddress>[redacted]</macAddress>", text)
        text = re.sub(r"://[^/@\s]+:[^/@\s]+@", "://***@", text)
        return text

    return redact


def tag_text(xml: str, tag: str) -> str:
    m = re.search(rf"<{tag}(?:\s[^>]*)?>([^<]*)</{tag}>", xml)
    return m.group(1).strip() if m else ""


def search_xml(track_id: str, start: str, end: str, max_results: int = 5) -> str:
    # Same shape the legacy add-on sends (main.py rec_search), bounded to a few results.
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<CMSearchDescription>\n"
        f"<searchID>G0-PROBE-{int(time.time())}</searchID>\n"
        f"<trackIDList><trackID>{track_id}</trackID></trackIDList>\n"
        f"<timeSpanList><timeSpan><startTime>{start}</startTime><endTime>{end}</endTime></timeSpan></timeSpanList>\n"
        f"<maxResults>{max_results}</maxResults>\n"
        "<searchResultPosition>0</searchResultPosition>\n"
        "<metadataList><metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor></metadataList>\n"
        "</CMSearchDescription>"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--search", metavar="TRACK_ID", help="also run one bounded recording search on this track")
    parser.add_argument("--hours", type=float, default=1.0, help="search window ending now (hours)")
    parser.add_argument("--port", type=int, help="override NVR_HTTP_PORT")
    args = parser.parse_args()

    if not ENV_PATH.exists():
        print(f"missing {ENV_PATH}", file=sys.stderr)
        return 2
    env = load_env(ENV_PATH)
    redact = make_redactor(env)
    host = env["NVR_HOST"]
    ports = [args.port] if args.port else [int(env.get("NVR_HTTP_PORT", "80")), 90, 8000]
    auth = httpx.DigestAuth(env["NVR_USER"], env["NVR_PASSWORD"])

    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = EVIDENCE_DIR / stamp
    out_dir.mkdir(parents=True, exist_ok=True)
    summary: dict[str, object] = {"captured_at_utc": stamp, "probes": {}}

    client = None
    for port in ports:
        candidate = httpx.Client(base_url=f"http://{host}:{port}", auth=auth, timeout=10.0)
        try:
            r = candidate.get("/ISAPI/System/deviceInfo")
        except httpx.HTTPError as exc:
            print(f"port {port}: {type(exc).__name__}")
            candidate.close()
            continue
        print(f"port {port}: HTTP {r.status_code}")
        if r.status_code in (200, 401, 403):
            client = candidate
            summary["http_port"] = port
            break
        candidate.close()
    if client is None:
        print("NVR HTTP port not found; nothing captured")
        return 1

    for name, path in GET_PROBES:
        t0 = time.perf_counter()
        try:
            r = client.get(path)
        except httpx.HTTPError as exc:
            summary["probes"][name] = {"path": path, "error": type(exc).__name__}
            print(f"{name:32} {path:50} ERROR {type(exc).__name__}")
            continue
        ms = int((time.perf_counter() - t0) * 1000)
        body = r.text
        (out_dir / f"{name}.{'json' if 'json' in r.headers.get('content-type', '') else 'xml'}").write_text(body, encoding="utf-8")
        summary["probes"][name] = {
            "path": path,
            "status": r.status_code,
            "ms": ms,
            "bytes": len(r.content),
            "content_type": r.headers.get("content-type", ""),
            "status_string": tag_text(body, "statusString") if r.status_code != 200 else "",
        }
        print(f"{name:32} {path:50} HTTP {r.status_code:3} {ms:5} ms {len(r.content):7} B")

    info = (out_dir / "device_info.xml").read_text(encoding="utf-8") if (out_dir / "device_info.xml").exists() else ""
    if info:
        print("device:", tag_text(info, "model"), "| firmware:", tag_text(info, "firmwareVersion"), tag_text(info, "firmwareReleasedDate"), "| deviceType:", tag_text(info, "deviceType"))
    tm = (out_dir / "system_time.xml").read_text(encoding="utf-8") if (out_dir / "system_time.xml").exists() else ""
    if tm:
        print("time:", "localTime=", tag_text(tm, "localTime"), "| timeZone=", tag_text(tm, "timeZone"), "| timeMode=", tag_text(tm, "timeMode"),
              "| probe UTC now=", dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"))
    tracks = (out_dir / "record_tracks.xml").read_text(encoding="utf-8") if (out_dir / "record_tracks.xml").exists() else ""
    if tracks:
        ids = re.findall(r"<Track>.*?<id>([^<]+)</id>.*?</Track>", tracks, flags=re.S)
        print("record tracks:", len(ids), "ids:", ids[:40])
    chans = (out_dir / "inputproxy_channels.xml").read_text(encoding="utf-8") if (out_dir / "inputproxy_channels.xml").exists() else ""
    if chans:
        names = re.findall(r"<InputProxyChannel>.*?<id>([^<]+)</id>.*?<name>([^<]*)</name>", chans, flags=re.S)
        print("input proxy channels:", len(names), [f"{i}:{redact(n)}" for i, n in names[:40]])

    if args.search:
        end = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
        start = end - dt.timedelta(hours=args.hours)
        body = search_xml(args.search, start.strftime("%Y-%m-%dT%H:%M:%SZ"), end.strftime("%Y-%m-%dT%H:%M:%SZ"))
        t0 = time.perf_counter()
        r = client.post("/ISAPI/ContentMgmt/search", content=body.encode("utf-8"), headers={"Content-Type": "application/xml"})
        ms = int((time.perf_counter() - t0) * 1000)
        (out_dir / f"search_track{args.search}_request.xml").write_text(body, encoding="utf-8")
        (out_dir / f"search_track{args.search}_response.xml").write_text(r.text, encoding="utf-8")
        matches = re.findall(r"<searchMatchItem>(.*?)</searchMatchItem>", r.text, flags=re.S)
        summary["probes"]["search"] = {"track": args.search, "status": r.status_code, "ms": ms, "matches": len(matches),
                                       "requested_utc": [start.isoformat(), end.isoformat()]}
        print(f"search track {args.search}: HTTP {r.status_code} {ms} ms matches={len(matches)}",
              "responseStatusStrg=", tag_text(r.text, "responseStatusStrg"), "numOfMatches=", tag_text(r.text, "numOfMatches"))
        for m in matches[:3]:
            print("  match:", "start=", tag_text(m, "startTime"), "end=", tag_text(m, "endTime"), "uri=", redact(tag_text(m, "playbackURI"))[:120])

    (out_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print("raw responses saved to", out_dir.relative_to(ROOT))
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
