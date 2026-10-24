"""Permanent restream for the cameras Arx shows from Frigate (task FRIGPERM-295; owner answers 24.10: 421 all cameras, 422 restart "whenever
possible" = Arx never restarts Frigate, 423 no new Frigate account).

Today (TKFRIGLIVE, `frigate_restream.py`) Arx only READS Frigate's go2rtc stream list. On the owner's instance that list is empty, so live
video falls back to a still. A stream that lasts is a `go2rtc.streams.<camera>` entry in Frigate's own YAML (the runtime
`PUT /api/go2rtc/streams` does not survive a restart, FRIGLIVE2-295 section 8.2) and it applies only after a Frigate restart.

This module is the PLANNING half, pure and offline: from Frigate's effective `GET /api/config` it computes, per enabled camera, whether the
stream exists, must be added, conflicts with a different entry, or needs the owner. It prints a REDACTED report (hosts become labels,
queries and credentials never appear) and a digest of the plan. The only write helper, `apply_plan`, sends ONE `PUT /api/config/set`
(`requires_restart: 1`, so nothing changes in the running Frigate) and only for the exact plan whose digest the caller names plus an
explicit owner go. It never restarts Frigate, never creates a user, never touches a stream that exists, and never deletes anything.

Source of a stream: the camera's own first ffmpeg input as `/api/config` shows it. Frigate masks credentials there (`*:*@`), and Arx
does not read the raw YAML (frigate_config.py: "inputs with credentials ... never read"), so a camera whose input carries credentials is
reported `needs_owner/credentials` and the owner adds that single line himself; every other camera is planned. An input that points at
Frigate's own restream (loop) is refused.
"""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any
from urllib.parse import urlsplit

from ...errors import ApiError
from . import frigate_restream as frs
from .frigate import FrigateAdapter

SCHEMA = "arx-frigate-perm-restream/1"
SCHEMES = ("rtsp", "rtsps")
LOOPBACK = {"127.0.0.1", "localhost", "::1", "0.0.0.0"}
OWNER_GO = "OWNER-GO-FRIGATE-STREAMS"   # the phrase a caller must pass with the digest; the owner says it in chat at execution time
WRITE_PATH = "/api/config/set"

STATES = ("present", "add", "conflict", "needs_owner", "skipped")


def _dict(v: Any) -> dict[str, Any]:
    return v if isinstance(v, dict) else {}


def _as_list(v: Any) -> list[str]:
    if isinstance(v, str):
        return [v]
    return [x for x in v if isinstance(x, str)] if isinstance(v, list) else []


def _parts(url: str):
    try:
        return urlsplit(url.strip())
    except ValueError:
        return None


def _hostport(url: str) -> tuple[str, int | None]:
    p = _parts(url)
    if p is None:
        return "", None
    try:
        return (p.hostname or "").lower(), p.port
    except ValueError:
        return (p.hostname or "").lower(), None


def has_credentials(url: str) -> bool:
    p = _parts(url)
    return p is None or "@" in (p.netloc or "") or "{" in url or "}" in url


def normalize(url: str) -> str:
    """scheme://host:port/path with credentials and query removed: what two sources are compared by (never printed)."""
    p = _parts(url)
    if p is None:
        return ""
    host = (p.hostname or "").lower()
    try:
        port = p.port
    except ValueError:
        port = None
    return f"{p.scheme.lower()}://{host}{':' + str(port) if port else ''}{p.path}"


class Labels:
    """host -> stable label (`host-A`, `host-B`...) so a report shows which cameras share a host without printing an address."""

    def __init__(self) -> None:
        self._m: dict[str, str] = {}

    def __call__(self, host: str) -> str:
        if host not in self._m:
            n = len(self._m)
            self._m[host] = "host-" + (chr(65 + n) if n < 26 else str(n))
        return self._m[host]


def redact(url: str, labels: Labels) -> str:
    p = _parts(url)
    if p is None or not p.scheme:
        return "<unparsable>"
    host = (p.hostname or "").lower()
    try:
        port = p.port
    except ValueError:
        port = None
    path = re.sub(r"[^A-Za-z0-9_./-]", "?", p.path)[:80]
    return f"{p.scheme.lower()}://{labels(host)}{':' + str(port) if port else ''}{path}"


def _first_input(cam: dict[str, Any]) -> str | None:
    inputs = [i for i in _dict(cam.get("ffmpeg")).get("inputs") or [] if isinstance(i, dict) and isinstance(i.get("path"), str) and i["path"].strip()]
    pick = next((i for i in inputs if "detect" in (i.get("roles") or [])), inputs[0] if inputs else None)
    return pick["path"].strip() if pick else None


def source_state(key: str, path: str | None, frigate_host: str, restream_port: int) -> tuple[str, str]:
    """(state, reason) for the camera's input: `ok`, or `needs_owner` / `skipped` with a code. No I/O."""
    if not path:
        return "skipped", "no_input"
    p = _parts(path)
    if p is None or p.scheme.lower() not in SCHEMES or not (p.hostname or ""):
        return "needs_owner", "unsupported_source"
    if has_credentials(path):
        return "needs_owner", "credentials"
    host, port = _hostport(path)
    own = host in LOOPBACK or host == frigate_host.strip("[]").lower()
    if own and (port or 554) == restream_port:
        return "needs_owner", "self_reference"
    return "ok", ""


def build_plan(cfg: dict[str, Any], *, frigate_host: str, restream_port: int = frs.DEFAULT_PORT, only: list[str] | None = None,
               runtime_streams: list[str] | None = None) -> dict[str, Any]:
    """The plan for ONE Frigate instance from its effective config (pure). `only` limits it to the named camera keys (default: every
    enabled camera, which is what Arx imports). The result holds the sources in `_sources` (in memory, for `config_set_body`);
    `report()` is the printable, redacted view and `public()` the same without `_sources`."""
    cams = _dict(cfg.get("cameras"))
    existing = _dict(_dict(cfg.get("go2rtc")).get("streams"))
    runtime = set(runtime_streams or [])
    labels = Labels()
    rows: list[dict[str, Any]] = []
    sources: dict[str, str] = {}
    wanted = set(only) if only else None
    for key in sorted(cams):
        cam = _dict(cams[key])
        if not frs.STREAM_NAME.fullmatch(str(key)):
            continue
        if wanted is not None and key not in wanted:
            continue
        if not cam.get("enabled", True):
            rows.append({"camera": key, "stream": key, "state": "skipped", "reason": "camera_disabled", "source": None})
            continue
        path = _first_input(cam)
        st, why = source_state(key, path, frigate_host, restream_port)
        src_disp = redact(path, labels) if path and st != "skipped" and why != "credentials" else ("<credentials: not shown>" if why == "credentials" else None)
        if key in existing:
            have = _as_list(existing[key])
            if st == "ok" and normalize(path or "") not in {normalize(h) for h in have}:
                rows.append({"camera": key, "stream": key, "state": "conflict", "reason": "different_source", "source": src_disp})
            else:
                rows.append({"camera": key, "stream": key, "state": "present", "reason": "in_yaml", "source": src_disp})
            continue
        if key in runtime:
            # only a runtime stream (lost at the next restart): the permanent entry is still missing
            pass
        if st == "ok":
            rows.append({"camera": key, "stream": key, "state": "add", "reason": "runtime_only" if key in runtime else "missing", "source": src_disp})
            sources[key] = path  # type: ignore[assignment]
        else:
            rows.append({"camera": key, "stream": key, "state": st, "reason": why, "source": src_disp})
    foreign = sorted(n for n in existing if n not in cams)
    counts = {s: sum(1 for r in rows if r["state"] == s) for s in STATES}
    digest_in = json.dumps([[r["stream"], r["state"], normalize(sources.get(r["stream"], ""))] for r in rows], sort_keys=True)
    plan = {
        "schema": SCHEMA, "cameras": rows, "counts": counts, "foreign_streams_left_alone": len(foreign),
        "restart_required": counts["add"] > 0, "digest": hashlib.sha256(digest_in.encode()).hexdigest()[:16],
        "_sources": sources,
    }
    return plan


def public(plan: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in plan.items() if not k.startswith("_")}


def report(plan: dict[str, Any]) -> str:
    """Plain-text dry-run report. Contains stream names, states, redacted sources and the digest; no address, user or password."""
    c = plan["counts"]
    lines = [f"Frigate permanent restream - dry run ({plan['schema']})",
             f"cameras: {len(plan['cameras'])}  add: {c['add']}  present: {c['present']}  conflict: {c['conflict']}  needs_owner: {c['needs_owner']}  skipped: {c['skipped']}",
             f"foreign go2rtc streams left alone: {plan['foreign_streams_left_alone']}",
             f"restart of Frigate needed to apply: {'yes' if plan['restart_required'] else 'no'}",
             f"plan digest: {plan['digest']}", ""]
    for r in plan["cameras"]:
        lines.append(f"- {r['camera']}: {r['state']}" + (f" ({r['reason']})" if r["reason"] else "") + (f"  source {r['source']}" if r.get("source") else ""))
    return "\n".join(lines)


def config_set_body(plan: dict[str, Any]) -> dict[str, Any]:
    """The ONE write: new `go2rtc.streams` entries only (never an overwrite: conflicts and existing entries are not in it).
    `requires_restart: 1` - Frigate saves the YAML and applies it at its next restart. UNVERIFIED wire shape for the go2rtc section
    (the camera sections are verified live, FRIGLIVE-295); the dry run and the manual YAML snippet do not depend on it."""
    src = plan.get("_sources") or {}
    adds = {r["stream"]: [src[r["stream"]]] for r in plan["cameras"] if r["state"] == "add" and r["stream"] in src}
    if not adds:
        raise ApiError(409, "frigate_perm_nothing_to_add", "אין זרמים להוסיף.")
    return {"requires_restart": 1, "config_data": {"go2rtc": {"streams": adds}}}


def rollback_body(streams: list[str]) -> dict[str, Any]:
    """Removes exactly the named streams again (an empty string deletes a key, FRIGLIVE-295). Only for names this plan added."""
    if not streams or any(not frs.STREAM_NAME.fullmatch(s) for s in streams):
        raise ApiError(422, "frigate_perm_bad_rollback", "רשימת הזרמים לשחזור אינה תקינה.")
    return {"requires_restart": 1, "config_data": {"go2rtc": {"streams": {s: "" for s in streams}}}}


def yaml_snippet(plan: dict[str, Any], *, owner_lines: dict[str, str] | None = None) -> str:
    """The manual alternative: the `go2rtc:` block for Frigate's own config editor. Credential cameras get a placeholder the owner fills in."""
    src = plan.get("_sources") or {}
    out = ["go2rtc:", "  streams:"]
    for r in plan["cameras"]:
        if r["state"] == "add" and r["stream"] in src:
            out += [f"    {r['stream']}:", f"      - {src[r['stream']]}"]
        elif r["state"] == "needs_owner" and r["reason"] == "credentials":
            out += [f"    {r['stream']}:", "      - <same rtsp address as this camera's ffmpeg input, with its user and password>"]
    return "\n".join(out)


def load_plan(adapter: FrigateAdapter, *, only: list[str] | None = None) -> dict[str, Any]:
    """Two GET reads (`/api/config`, `/api/go2rtc/streams`) through the existing adapter; nothing is written."""
    cfg = adapter.http.get_json("/api/config")
    if not isinstance(cfg, dict):
        raise ApiError(503, "source_invalid", "תשובת Frigate אינה מסמך תקין.", details={"op": "config"})
    try:
        rt = adapter.http.get_json("/api/go2rtc/streams", optional=True)
    except ApiError as exc:
        if exc.code not in ("frigate_route_missing", "source_forbidden"):
            raise
        rt = None
    host = (adapter._settings.nvr_host or "").strip()
    return build_plan(cfg, frigate_host=host, restream_port=frs.port(adapter._settings), only=only,
                      runtime_streams=sorted(rt) if isinstance(rt, dict) else [])


def apply_plan(adapter: FrigateAdapter, plan: dict[str, Any], *, digest: str, owner_go: str) -> dict[str, Any]:
    """Send the single `config/set`. Refused unless the digest is the plan's own AND the owner phrase matches. No retry beyond the
    adapter's own re-login, no restart, no read-back claim: Frigate shows the entries in `/api/go2rtc/streams` only after its restart."""
    if owner_go != OWNER_GO:
        raise ApiError(409, "frigate_perm_no_owner_go", "נדרש אישור מפורש של הבעלים.")
    if digest != plan.get("digest"):
        raise ApiError(409, "frigate_perm_plan_changed", "התכנית השתנתה מאז הדוח; יש להריץ דוח חדש.")
    if plan["counts"]["conflict"]:
        raise ApiError(409, "frigate_perm_conflict", "יש זרם קיים עם מקור שונה; לא נכתב דבר.")
    body = config_set_body(plan)
    adapter.http.write("config", "PUT", WRITE_PATH, body)
    return {"written": sorted(body["config_data"]["go2rtc"]["streams"]), "restart_required": True, "applied_after_restart_only": True}


def verify_after_restart(adapter: FrigateAdapter, plan: dict[str, Any]) -> dict[str, Any]:
    """Read-only check for after the owner's restart: which planned streams Frigate's go2rtc now lists."""
    rt = adapter.http.get_json("/api/go2rtc/streams", optional=True)
    listed = set(rt) if isinstance(rt, dict) else set()
    want = [r["stream"] for r in plan["cameras"] if r["state"] in ("add", "present")]
    return {"listed": sorted(s for s in want if s in listed), "missing": sorted(s for s in want if s not in listed)}
