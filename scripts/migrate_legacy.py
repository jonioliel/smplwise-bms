#!/usr/bin/env python3
"""Migration dry run from the legacy "Hikvision NVR Panel" add-on (v1.5.27) to SMPLWISE VMS (T070).

Reads what the legacy add-on kept — its add-on options, its override file (`/config/hikvision_nvr_override.json`:
NVR overrides, camera aliases, the recording-display offset, manual-recording rows) and its local event store
(`/config/hikvision_nvr_event_store.jsonl`) — and produces a mapping report: which option lands where in the VMS,
which legacy camera alias maps to which VMS camera (by channel), what the time offset means for the VMS, what the
shared PINs become (Home Assistant users + VMS roles), which features have a counterpart and which do not, and the
staged rollout with a real rollback. It never touches the NVR. The only write it can do — with `--apply-aliases`
and `--vms-url` — is setting empty VMS camera aliases from the legacy names (VMS-local, audited by the API).

Secrets (passwords, PINs) are never printed: the report says whether they are set. Hosts are masked to the last
octet so the report can be shared.

Usage:
  python scripts/migrate_legacy.py --options options.json [--override hikvision_nvr_override.json]
      [--events hikvision_nvr_event_store.jsonl] [--vms-cameras cameras.json | --vms-url http://127.0.0.1:8099]
      [--vms-options vms_options.json] [--nvr-utc-offset-minutes 120] [--apply-aliases] [--keep DIR]
      [--json out.json] [--markdown out.md]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import sys
import urllib.request
from pathlib import Path
from typing import Any

SECRET_KEYS = {"nvr_password", "app_pin", "technician_pin", "go2rtc_api_password"}
IP_RE = re.compile(r"^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$")

# legacy option -> where it goes in the VMS
OPTION_MAP: list[tuple[str, str, str]] = [
    ("nvr_ip", "nvr_host", "Add-on option — same NVR host"),
    ("nvr_port", "nvr_http_port", "Add-on option — ISAPI HTTP port"),
    ("nvr_rtsp_port", "nvr_rtsp_port", "Add-on option — RTSP port"),
    ("nvr_user", "nvr_username", "Add-on option — a read-only NVR user is enough (the VMS never writes to the NVR)"),
    ("nvr_password", "nvr_password", "Add-on option (never printed)"),
    ("go2rtc_url", "go2rtc_url", "Add-on option — the same go2rtc add-on; the VMS uses only the smplwise_ stream namespace"),
    ("go2rtc_ingress_path", "—", "Not needed: the VMS relays media through its own WebSocket, the browser never talks to go2rtc"),
    ("app_pin", "—", "Replaced by Home Assistant identity: every person signs in to HA; the VMS grants roles per user"),
    ("technician_pin", "—", "Replaced by roles: system_admin (or a custom role) instead of a technician PIN"),
    ("pin_length", "—", "Not applicable (no PINs)"),
    ("session_minutes", "—", "Not applicable: sessions are Home Assistant's"),
    ("snapshot_seconds", "snapshots.max_age_s", "Different meaning: the VMS caches a snapshot up to N s (settings › media), the legacy refreshed every N s"),
    ("log_level", "log_level", "Add-on option"),
    ("event_search_debug", "—", "Not needed: the VMS keeps its own events with ingest diagnostics (הגדרות › חיבורים)"),
]

FEATURES: list[tuple[str, str, str]] = [
    ("Live grid (screens, picker, HD/SD)", "לייב › כל המצלמות + תצוגות שמורות; מצלמה בודדת ראשי/משני", "same"),
    ("Recordings search, timeline, playback", "חקירה › הקלטות (timeline, seek, compare up to 4, slow motion, frame step)", "same"),
    ("Download / export MP4", "חקירה › ייצוא (jobs, retention, hash) + evidence bundles", "same"),
    ("Snapshots", "Camera snapshots with cache (settings › media)", "same"),
    ("Events (disabled in the legacy)", "חקירה › מרכז אירועים: NVR alert stream + recording-derived + HA sensors; requires Notify Surveillance Center on the NVR for live alerts", "better"),
    ("Camera aliases", "Aliases on cameras (this tool can copy them)", "same"),
    ("Manual recording start/stop", "Not in the VMS pilot (a write to the NVR; needs the owner's write approval, T075/T045 track)", "missing"),
    ("Camera / NVR reboot", "Not in the VMS pilot (physical action; write approval pending)", "missing"),
    ("Storage: HDD list, SMART / bad-sector tests", "הגדרות › אחסון shows disks and retention read-only; tests need write approval", "partial"),
    ("PIN gate + technician gate", "Home Assistant identity + VMS roles, custom roles with sensitive grants", "replaced"),
    ("Themes (dark / graphite / light)", "Two designs (SW A / SW B) per user, light first", "replaced"),
    ("Floor maps, zones, spatial search, cases, rules, kiosk, Lovelace card", "New in the VMS", "new"),
]


def mask_host(value: str | None) -> str:
    if not value:
        return "—"
    m = IP_RE.match(str(value).strip())
    if m:
        return f"[…].{m.group(4)}"
    return "[host]"


def load_json(path: Path | None) -> dict[str, Any]:
    if not path:
        return {}
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError) as exc:
        raise SystemExit(f"cannot read {path}: {exc}")


def count_jsonl(path: Path | None) -> dict[str, Any]:
    if not path or not Path(path).exists():
        return {"present": False, "rows": 0, "first": None, "last": None}
    rows = 0
    first = last = None
    for line in Path(path).read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except ValueError:
            continue  # the legacy store is JSON rows only; anything else is noise
        if not isinstance(row, dict):
            continue
        rows += 1
        stamp = row.get("storedAt")
        if stamp:
            first = first or stamp
            last = stamp
    return {"present": True, "rows": rows, "first": first, "last": last}


def effective_offset(override: dict[str, Any], nvr_utc_offset_minutes: int) -> dict[str, Any]:
    mode = str(override.get("recording_display_offset_mode", "auto_plus_manual") or "auto_plus_manual")
    if mode not in ("auto", "manual", "auto_plus_manual"):
        mode = "auto_plus_manual"
    direction = str(override.get("recording_display_offset_direction", "add") or "add")
    try:
        minutes = abs(int(override.get("recording_display_offset_minutes", 0) or 0))
    except (TypeError, ValueError):
        minutes = 0
    manual = minutes if direction == "add" else -minutes
    auto = nvr_utc_offset_minutes if mode in ("auto", "auto_plus_manual") else 0
    manual_part = manual if mode in ("manual", "auto_plus_manual") else 0
    eff = auto + manual_part
    return {"mode": mode, "direction": direction, "minutes": minutes, "auto_minutes": auto, "manual_minutes": manual_part, "effective_minutes": eff}


def fetch_vms(vms_url: str, dev_user: str | None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    def get(path: str) -> Any:
        req = urllib.request.Request(vms_url.rstrip("/") + path, headers={"X-SW-Dev-User": dev_user} if dev_user else {})
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 - local VMS
            return json.loads(r.read().decode("utf-8"))

    cams = get("/api/v1/cameras")
    settings = get("/api/v1/settings").get("settings", {})
    return cams.get("cameras", []), settings


def plan_cameras(override: dict[str, Any], vms_cameras: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    names = override.get("camera_names") or {}
    if not isinstance(names, dict):
        names = {}
    by_channel: dict[int, dict[str, Any]] = {}
    for c in vms_cameras:
        try:
            by_channel[int(c.get("channel"))] = c
        except (TypeError, ValueError):
            continue
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    for key, name in sorted(names.items(), key=lambda kv: (0, int(str(kv[0]).strip())) if str(kv[0]).strip().isdigit() else (1, 0)):
        try:
            ch = int(str(key).strip())
        except ValueError:
            warnings.append(f"legacy camera alias with a non-numeric channel key: {key!r}")
            continue
        cam = by_channel.get(ch)
        if cam is None:
            rows.append({"channel": ch, "legacy_alias": str(name), "vms_camera_id": None, "vms_name": None, "vms_alias": None, "action": "no_vms_camera", "note": "no VMS camera on this channel yet — run 'סנכרון מה־NVR' first"})
            continue
        vms_alias = cam.get("alias") or None
        if vms_alias and vms_alias != str(name):
            action, note = "keep_vms_alias", f"the VMS already has a different alias ({vms_alias}); kept — use --force-aliases to overwrite"
        elif vms_alias == str(name):
            action, note = "same", "already identical"
        else:
            action, note = "set_alias", "the legacy alias would be copied to the VMS camera"
        rows.append({"channel": ch, "legacy_alias": str(name), "vms_camera_id": cam.get("id"), "vms_name": cam.get("name_source") or cam.get("name"), "vms_alias": vms_alias, "action": action, "note": note})
    known = {r["channel"] for r in rows}
    for ch, cam in sorted(by_channel.items()):
        if ch not in known:
            rows.append({"channel": ch, "legacy_alias": None, "vms_camera_id": cam.get("id"), "vms_name": cam.get("name_source") or cam.get("name"), "vms_alias": cam.get("alias") or None, "action": "vms_only", "note": "discovered by the VMS, no legacy alias"})
    return rows, warnings


def apply_aliases(rows: list[dict[str, Any]], vms_url: str, dev_user: str | None, force: bool = False) -> list[dict[str, Any]]:
    """VMS-local writes only: PATCH /api/v1/cameras/{id} with the legacy alias (never the NVR)."""
    done: list[dict[str, Any]] = []
    for r in rows:
        if r["action"] == "set_alias" or (force and r["action"] == "keep_vms_alias"):
            body = json.dumps({"alias": r["legacy_alias"]}).encode("utf-8")
            req = urllib.request.Request(vms_url.rstrip("/") + f"/api/v1/cameras/{r['vms_camera_id']}", data=body, method="PATCH", headers={"Content-Type": "application/json", **({"X-SW-Dev-User": dev_user} if dev_user else {})})
            with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310 - local VMS
                done.append({"channel": r["channel"], "camera_id": r["vms_camera_id"], "alias": r["legacy_alias"], "status": resp.status})
    return done


def build_report(options: dict[str, Any], override: dict[str, Any], events: dict[str, Any], vms_cameras: list[dict[str, Any]] | None, vms_settings: dict[str, Any] | None, vms_options: dict[str, Any] | None, nvr_utc_offset_minutes: int) -> dict[str, Any]:
    warnings: list[str] = []
    # effective legacy connection = options + override (the override wins, like the legacy did)
    eff = dict(options)
    for k in ("nvr_ip", "nvr_port", "nvr_rtsp_port", "nvr_user", "nvr_password"):
        if k in override and str(override.get(k) or "").strip():
            eff[k] = override[k]
    opt_rows = []
    for legacy_key, vms_key, note in OPTION_MAP:
        present = legacy_key in eff
        value: Any
        if legacy_key in SECRET_KEYS:
            value = "set" if str(eff.get(legacy_key) or "").strip() else "empty"
        elif legacy_key == "nvr_ip":
            value = mask_host(eff.get(legacy_key))
        elif legacy_key == "go2rtc_url":
            value = "set" if eff.get(legacy_key) else "empty"
        else:
            value = eff.get(legacy_key)
        opt_rows.append({"legacy": legacy_key, "present": present, "value": value, "vms": vms_key, "note": note})
    nvr = {"host": mask_host(eff.get("nvr_ip")), "http_port": eff.get("nvr_port"), "rtsp_port": eff.get("nvr_rtsp_port"), "user": eff.get("nvr_user"), "password": "set" if str(eff.get("nvr_password") or "").strip() else "empty"}
    if vms_options:
        same_host = str(vms_options.get("nvr_host", "")).strip() == str(eff.get("nvr_ip", "")).strip()
        same_ports = int(vms_options.get("nvr_http_port", 0) or 0) == int(eff.get("nvr_port", 0) or 0) and int(vms_options.get("nvr_rtsp_port", 0) or 0) == int(eff.get("nvr_rtsp_port", 0) or 0)
        nvr["vms_same_host"] = same_host
        nvr["vms_same_ports"] = same_ports
        if not same_host:
            warnings.append("the VMS points at a different NVR host than the legacy add-on")
        if not same_ports:
            warnings.append("the VMS uses different NVR ports than the legacy add-on")
    time_info = effective_offset(override, nvr_utc_offset_minutes)
    time_info["vms"] = "the VMS shows the NVR's wall-clock times as they are, in settings › time.zone" + (f" ({vms_settings.get('time.zone')})" if vms_settings else "") + " — no display offset (T014)"
    if time_info["effective_minutes"] != 0:
        warnings.append(f"the legacy displayed recordings shifted by {time_info['effective_minutes']:+d} minutes; the VMS does not shift — confirm one known event's time on both before the switch")
    cameras, cam_warnings = plan_cameras(override, vms_cameras or [])
    warnings.extend(cam_warnings)
    pins = {
        "app_pin": "set" if str(options.get("app_pin") or "").strip() else "empty",
        "technician_pin": "set" if str(options.get("technician_pin") or "").strip() else "empty",
        "vms": "one Home Assistant user per person (HA › Settings › People); the first VMS admin is the add-on option bootstrap_admin_username; then הגדרות › משתמשים והרשאות: viewer / operator per floor or installation, site_admin for delegation, custom roles for door.unlock / alarm.disarm / video.export",
        "recommended": ["viewer at the installation for everyone who only watched with the shared PIN", "operator where people acknowledged events or exported video", "system_admin for the technician PIN holder"],
    }
    manual = override.get("manual_recording") or []
    manual_info = {"rows": len(manual) if isinstance(manual, list) else 0, "vms": "not migrated — manual recording is a write to the NVR and is not in the pilot (needs the owner's write approval)"}
    if manual_info["rows"]:
        warnings.append(f"{manual_info['rows']} manual-recording rows in the legacy override are not migrated (NVR write)")
    events_info = {**events, "vms": "not imported — the VMS derives motion events from recordings and stores NVR alerts itself; the legacy JSONL stays in /config as an archive"}
    rollout = [
        "1. Keep the legacy add-on installed and running; install SMPLWISE VMS next to it (different slug, different Ingress panel).",
        "2. Point the VMS at the same NVR with a read-only NVR user (options), the same go2rtc; restart the add-on once for the bridge.",
        "3. Run this dry run; fix what it flags (missing cameras → סנכרון מה־NVR; aliases → --apply-aliases; time → confirm one known event).",
        "4. Shadow period: both add-ons run; compare a day of recordings, a known event time and the live wall in both; nothing on the NVR changes.",
        "5. Give people HA users and VMS roles; stop the legacy add-on (do not uninstall) once parity is confirmed by the owner.",
        "6. Decommission only on written approval, after a project backup (הגדרות › גיבוי) — keep /config/hikvision_nvr_override.json and the event store as archive.",
    ]
    rollback = [
        "Start the legacy add-on again (its options and /config files are untouched by the migration) — the NVR was never written to.",
        "The VMS can stay installed and stopped; a pre-upgrade backup of the VMS project exists in /data/backups for every version step.",
    ]
    return {
        "schema": "smplwise-migration-dry-run/1",
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": {"options_keys": sorted(options.keys()), "override_keys": sorted(k for k in override.keys()), "legacy_version": "1.5.27"},
        "nvr": nvr,
        "options": opt_rows,
        "cameras": cameras,
        "time": time_info,
        "users": pins,
        "manual_recording": manual_info,
        "events": events_info,
        "features": [{"legacy": a, "vms": b, "status": c} for a, b, c in FEATURES],
        "rollout": rollout,
        "rollback": rollback,
        "writes": {"nvr": "none", "vms": "only camera aliases, and only with --apply-aliases"},
        "warnings": warnings,
    }


def to_markdown(rep: dict[str, Any]) -> str:
    L: list[str] = []
    L.append(f"# Migration dry run — legacy Hikvision NVR Panel {rep['source']['legacy_version']} → SMPLWISE VMS")
    L.append(f"Generated {rep['generated_at']} · schema {rep['schema']} · NVR writes: {rep['writes']['nvr']} · VMS writes: {rep['writes']['vms']}")
    L.append("")
    if rep["warnings"]:
        L.append("## Warnings")
        L.extend(f"- {w}" for w in rep["warnings"])
        L.append("")
    n = rep["nvr"]
    L.append("## NVR connection")
    L.append(f"- host {n['host']} · HTTP {n['http_port']} · RTSP {n['rtsp_port']} · user `{n['user']}` · password {n['password']}")
    if "vms_same_host" in n:
        L.append(f"- VMS points at the same host: {'yes' if n['vms_same_host'] else 'NO'} · same ports: {'yes' if n['vms_same_ports'] else 'NO'}")
    L.append("")
    L.append("## Options → VMS")
    L.append("| legacy option | present | value | VMS | note |")
    L.append("|---|---|---|---|---|")
    for o in rep["options"]:
        L.append(f"| {o['legacy']} | {'yes' if o['present'] else 'no'} | {o['value'] if o['value'] is not None else '—'} | {o['vms']} | {o['note']} |")
    L.append("")
    L.append("## Cameras (by channel)")
    L.append("| channel | legacy alias | VMS camera | VMS alias | action | note |")
    L.append("|---|---|---|---|---|---|")
    for c in rep["cameras"]:
        L.append(f"| {c['channel']} | {c['legacy_alias'] or '—'} | {c['vms_name'] or '—'} | {c['vms_alias'] or '—'} | {c['action']} | {c['note']} |")
    L.append("")
    t = rep["time"]
    L.append("## Time")
    L.append(f"- legacy display offset: mode `{t['mode']}`, direction `{t['direction']}`, {t['minutes']} min → auto {t['auto_minutes']:+d} + manual {t['manual_minutes']:+d} = **{t['effective_minutes']:+d} min**")
    L.append(f"- {t['vms']}")
    L.append("")
    u = rep["users"]
    L.append("## People and roles")
    L.append(f"- legacy: shared app PIN {u['app_pin']}, technician PIN {u['technician_pin']}")
    L.append(f"- VMS: {u['vms']}")
    L.extend(f"  - {r}" for r in u["recommended"])
    L.append("")
    L.append("## Not migrated")
    L.append(f"- manual recording rows: {rep['manual_recording']['rows']} — {rep['manual_recording']['vms']}")
    e = rep["events"]
    L.append(f"- legacy event store: {'present' if e['present'] else 'absent'}, {e['rows']} rows{f' ({e['first']} … {e['last']})' if e.get('first') else ''} — {e['vms']}")
    L.append("")
    L.append("## Feature parity")
    L.append("| legacy | VMS | status |")
    L.append("|---|---|---|")
    for f in rep["features"]:
        L.append(f"| {f['legacy']} | {f['vms']} | {f['status']} |")
    L.append("")
    L.append("## Rollout")
    L.extend(f"- {s}" for s in rep["rollout"])
    L.append("")
    L.append("## Rollback")
    L.extend(f"- {s}" for s in rep["rollback"])
    L.append("")
    return "\n".join(L)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--options", required=True, help="legacy add-on options.json")
    ap.add_argument("--override", help="legacy /config/hikvision_nvr_override.json")
    ap.add_argument("--events", help="legacy /config/hikvision_nvr_event_store.jsonl")
    ap.add_argument("--vms-cameras", help="a saved GET /api/v1/cameras response (offline comparison)")
    ap.add_argument("--vms-url", help="a running VMS to compare with (and to write aliases to with --apply-aliases)")
    ap.add_argument("--vms-dev-user", help="X-SW-Dev-User for a developer backend")
    ap.add_argument("--vms-options", help="the VMS add-on options.json (host / port comparison; never printed)")
    ap.add_argument("--nvr-utc-offset-minutes", type=int, default=120, help="what the legacy 'auto' offset resolved to (Israel standard time: 120)")
    ap.add_argument("--apply-aliases", action="store_true", help="write empty VMS camera aliases from the legacy names (VMS-local)")
    ap.add_argument("--force-aliases", action="store_true", help="with --apply-aliases: overwrite differing VMS aliases too")
    ap.add_argument("--keep", help="copy the legacy files into this directory as an archive before anything else")
    ap.add_argument("--json", help="write the report as JSON here")
    ap.add_argument("--markdown", help="write the report as Markdown here (default: print)")
    args = ap.parse_args(argv)

    options = load_json(Path(args.options))
    override = load_json(Path(args.override)) if args.override else {}
    events = count_jsonl(Path(args.events)) if args.events else {"present": False, "rows": 0, "first": None, "last": None}
    if args.keep:
        keep = Path(args.keep) / f"legacy-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}"
        keep.mkdir(parents=True, exist_ok=True)
        for src in (args.options, args.override, args.events):
            if src and Path(src).exists():
                shutil.copy2(src, keep / Path(src).name)
    vms_cameras: list[dict[str, Any]] | None = None
    vms_settings: dict[str, Any] | None = None
    if args.vms_cameras:
        data = load_json(Path(args.vms_cameras))
        vms_cameras = data.get("cameras", []) if isinstance(data, dict) else []
    elif args.vms_url:
        vms_cameras, vms_settings = fetch_vms(args.vms_url, args.vms_dev_user)
    vms_options = load_json(Path(args.vms_options)) if args.vms_options else None
    rep = build_report(options, override, events, vms_cameras, vms_settings, vms_options, args.nvr_utc_offset_minutes)
    if args.apply_aliases:
        if not args.vms_url:
            raise SystemExit("--apply-aliases needs --vms-url")
        rep["applied_aliases"] = apply_aliases(rep["cameras"], args.vms_url, args.vms_dev_user, force=args.force_aliases)
        rep["writes"]["vms"] = f"{len(rep['applied_aliases'])} camera aliases written"
    md = to_markdown(rep)
    if args.json:
        Path(args.json).write_text(json.dumps(rep, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.markdown:
        Path(args.markdown).write_text(md, encoding="utf-8")
    else:
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except AttributeError:
            pass
        print(md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
