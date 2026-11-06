#!/usr/bin/env python3
"""Legacy parity check: the "Hikvision NVR Panel" add-on 1.5.27 against SmplWise Arx (T070, docs/changes/T070-T006-2406.md).

Static and offline: no network, no device, no Home Assistant, no import of the legacy code. Two commands:

  extract  --main app/main.py --config config.yaml [--frontend app/static/index.html] --out SURFACE.json
           Reads the legacy source as TEXT (Python AST of main.py, line parsing of config.yaml, a literal scan of index.html)
           and writes its exposure: every HTTP / WebSocket route (method + path + line), the add-on option KEYS (never their
           default values - the shipped defaults include a PIN), what it exposes to Home Assistant (entities / services /
           Supervisor or Core API use: none in 1.5.27), the go2rtc stream-name prefixes it creates and the files it persists.
           The legacy source lives on the local branch `legacy/import` (owner decision 2026-09-14: not in the public repository);
           the committed result is docs/legacy/legacy_surface_v1.5.27.json.

  check    [--surface docs/legacy/legacy_surface_v1.5.27.json] [--map docs/legacy/PARITY_MAP.json] [--json OUT] [--md OUT]
           Compares that surface with the Arx repository as it stands:
             C1 coverage      every legacy route is claimed by exactly one capability of the map (no silent gap)
             C2 arx routes    every Arx route the map names exists in contracts/API_INVENTORY.md (generated from the app)
             C3 evidence      every evidence path exists; the capability's `evidence_grep` appears in one of them
             C4 decisions     status is known; `missing` / `dropped` carry a recorded decision; `same` / `better` / `partial` /
                              `replaced` name an Arx route or an Arx surface
             C5 options       every legacy option has a row in scripts/migrate_legacy.py OPTION_MAP, and each target that is an
                              Arx add-on option exists in smplwise_vms/config.yaml and is not a DEPRECATED transitional option
             C6 HA exposure   legacy entities / services (none) vs the bridge's services (services.yaml) and entity platforms
                              (none); the two never share a domain / slug
             C7 go2rtc names  the legacy stream names (hik_ch<N>[_<mode>], pb_<track>_<ms>, pb_<s>) and Arx's names
                              (smplwise_*) are disjoint both ways, so neither side's cleanup can touch the other's streams
             C8 side by side  different add-on slugs (both can be installed at once); Arx source never references the legacy
                              /config files (the migration reads copies; Arx never edits or deletes them)
           Exit 0 = every check passed (gaps may exist - they are listed, each with its decision); 1 = a check failed;
           2 = input error. C7 imports the Arx backend (stdlib + its requirements); without it C7 is SKIPPED, never PASS.
"""
from __future__ import annotations

import argparse
import ast
import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SURFACE = ROOT / "docs" / "legacy" / "legacy_surface_v1.5.27.json"
DEFAULT_MAP = ROOT / "docs" / "legacy" / "PARITY_MAP.json"
INVENTORY = ROOT / "contracts" / "API_INVENTORY.md"
ARX_CONFIG = ROOT / "smplwise_vms" / "config.yaml"
BRIDGE = ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"
BACKEND = ROOT / "smplwise_vms" / "backend"
MIGRATE = ROOT / "scripts" / "migrate_legacy.py"

STATUSES = {
    "same": "Arx does what the legacy did",
    "better": "Arx does it and more (or safer)",
    "partial": "Arx covers part of it; the rest is named in `notes`",
    "replaced": "a different mechanism replaces it on purpose (named in `notes`)",
    "missing": "Arx has no counterpart; `decision` records the owner's call or the open question",
    "dropped": "deliberately not carried over (security or obsolete); `decision` records why",
}
NEEDS_DECISION = {"missing", "dropped"}
NEEDS_ARX = {"same", "better", "partial", "replaced"}
HTTP_METHODS = {"get", "post", "put", "delete", "patch", "options", "head"}
HA_API_PATTERNS = {
    "supervisor_api": r"http://supervisor/",
    "supervisor_token": r"SUPERVISOR_TOKEN",
    "core_states": r"/api/states",
    "core_services": r"/api/services",
    "core_websocket": r"/api/websocket",
    "mqtt_discovery": r"homeassistant/[a-z_]+/.+/config",
}
# legacy go2rtc names (KNOWN_QUIRKS S12): grid hik_ch<N>, single view hik_ch<N>_<main|sub>, playback pb_<track|rec>_<ms>, pb_<s>
LEGACY_STREAM_RE = re.compile(r"^(hik_ch\d+(_[a-z]+)?|pb_(\d+|rec)_\d+|pb_\d+)$")
LEGACY_STREAM_SAMPLES = ["hik_ch1", "hik_ch10", "hik_ch4_main", "hik_ch4_sub", "pb_401_1757835120000", "pb_rec_1757835120000", "pb_1757835120"]


# ------------------------------------------------------------------ extract
def _route_of(dec: ast.expr) -> list[tuple[str, str]]:
    if not (isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and isinstance(dec.func.value, ast.Name) and dec.func.value.id == "app"):
        return []
    attr = dec.func.attr
    if not dec.args or not isinstance(dec.args[0], ast.Constant) or not isinstance(dec.args[0].value, str):
        return []
    path = dec.args[0].value
    if attr in HTTP_METHODS:
        return [(attr.upper(), path)]
    if attr == "websocket":
        return [("WS", path)]
    if attr == "api_route":
        for kw in dec.keywords:
            if kw.arg == "methods" and isinstance(kw.value, (ast.List, ast.Tuple)):
                return [(str(e.value).upper(), path) for e in kw.value.elts if isinstance(e, ast.Constant)]
        return [("GET", path)]
    return []


def extract_routes(main_src: str) -> list[dict[str, Any]]:
    tree = ast.parse(main_src)
    out: list[dict[str, Any]] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                for method, path in _route_of(dec):
                    out.append({"method": method, "path": path, "line": dec.lineno, "handler": node.name})
    out.sort(key=lambda r: (r["line"], r["method"]))
    return out


def extract_options(config_src: str) -> dict[str, Any]:
    """Top-level fields and the option KEYS of an add-on config.yaml (values never kept)."""
    keys: list[str] = []
    meta: dict[str, Any] = {}
    section = None
    for raw in config_src.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if not raw.startswith(" "):
            m = re.match(r"^([A-Za-z_]+):\s*(.*)$", raw)
            if not m:
                continue
            section = m.group(1)
            if section in ("name", "version", "slug", "ingress_port", "panel_title", "startup", "init", "ingress"):
                meta[section] = m.group(2).strip().strip('"')
            continue
        if section == "options":
            m = re.match(r"^  ([A-Za-z_][A-Za-z0-9_]*):", raw)
            if m:
                keys.append(m.group(1))
        if section == "map":
            meta.setdefault("map", []).append(raw.strip().lstrip("- ").strip())
    return {"meta": meta, "options": keys}


def extract_surface(main_src: str, config_src: str, frontend_src: str = "") -> dict[str, Any]:
    routes = extract_routes(main_src)
    cfg = extract_options(config_src)
    both = main_src + "\n" + frontend_src
    ha_hits = {k: len(re.findall(p, both)) for k, p in HA_API_PATTERNS.items()}
    prefixes = sorted({m.group(1) for m in re.finditer(r"""['"](hik_ch|pb_)""", both)})
    persisted = sorted(set(re.findall(r"""Path\(\s*['"](/(?:config|data|tmp)/[^'"]+)['"]""", main_src)))
    return {
        "schema": "smplwise-legacy-surface/1",
        "legacy": {"name": cfg["meta"].get("name"), "version": cfg["meta"].get("version"), "slug": cfg["meta"].get("slug"),
                   "ingress_port": cfg["meta"].get("ingress_port"), "map": cfg["meta"].get("map", [])},
        "routes": routes,
        "options": cfg["options"],
        "home_assistant": {"entities": [], "services": [], "api_use": ha_hits,
                           "note": "an Ingress add-on only: no integration, no entity, no service; api_use counts Supervisor / Core API patterns in the source"},
        "go2rtc_stream_prefixes": prefixes,
        "persisted_files": persisted,
        "privacy": "route paths, option keys and file paths only - no option default, credential, host or PIN",
    }


# ------------------------------------------------------------------ Arx side
def arx_inventory(path: Path = INVENTORY) -> set[str]:
    rows: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^\| [^|]+ \| ([A-Z]+) \| `([^`]+)` \|", line)
        if m:
            rows.add(f"{m.group(1)} {m.group(2)}")
    return rows


def arx_options(path: Path = ARX_CONFIG) -> tuple[set[str], set[str]]:
    """(all option keys, the DEPRECATED transitional ones): a key run that directly follows a comment block mentioning
    DEPRECATED is deprecated (smplwise_vms/config.yaml TKSECRETS2 block)."""
    keys: set[str] = set()
    deprecated: set[str] = set()
    in_options = False
    comment_block: list[str] = []
    in_deprecated_run = False
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw.startswith(" ") and raw.strip():
            in_options = raw.startswith("options:")
            continue
        if not in_options:
            continue
        s = raw.strip()
        if s.startswith("#"):
            if not comment_block:
                in_deprecated_run = False
            comment_block.append(s)
            continue
        m = re.match(r"^  ([A-Za-z_][A-Za-z0-9_]*):", raw)
        if not m:
            continue
        if comment_block:
            in_deprecated_run = any("DEPRECATED" in c for c in comment_block)
            comment_block = []
        keys.add(m.group(1))
        if in_deprecated_run:
            deprecated.add(m.group(1))
    return keys, deprecated


def arx_slug(path: Path = ARX_CONFIG) -> str | None:
    m = re.search(r'^slug:\s*"?([A-Za-z0-9_]+)"?', path.read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else None


def bridge_exposure(bridge: Path = BRIDGE) -> dict[str, Any]:
    services = sorted(re.findall(r"^([a-z_]+):", (bridge / "services.yaml").read_text(encoding="utf-8"), re.M))
    init = (bridge / "__init__.py").read_text(encoding="utf-8")
    platforms = bool(re.search(r"async_forward_entry_setups?\(", init))
    domain = json.loads((bridge / "manifest.json").read_text(encoding="utf-8")).get("domain")
    return {"domain": domain, "services": services, "entity_platforms": platforms}


def load_migrate_option_map(path: Path = MIGRATE) -> list[tuple[str, ...]]:
    import importlib.util

    spec = importlib.util.spec_from_file_location("migrate_legacy_for_parity", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return list(mod.OPTION_MAP)


def arx_stream_names() -> tuple[str, list[str]] | None:
    """Arx's namespace prefix and sample names from its own name builders; None when the backend cannot be imported."""
    sys.path.insert(0, str(BACKEND))
    try:
        from smplwise.services import go2rtc as g2  # type: ignore
        from smplwise.services import playback as pb  # type: ignore
    except Exception:  # noqa: BLE001 - any import failure makes C7 SKIPPED (never a pass)
        return None
    finally:
        try:
            sys.path.remove(str(BACKEND))
        except ValueError:
            pass
    names = [g2.stream_name("nvr-1", 1, "main"), g2.stream_name("nvr-1", 10, "sub"), pb.stream_name("abcdef0123", 0), pb.stream_name("abcdef0123", 7)]
    for fn, arg in (("ha_stream_name", "camera.front_door"), ("wiskey_stream_name", "st1")):
        f = getattr(g2, fn, None)
        if callable(f):
            try:
                names.append(f(arg))
            except Exception:  # noqa: BLE001 - a builder with another signature is simply not sampled
                pass
    return g2.STREAM_PREFIX, names


# ------------------------------------------------------------------ check
def _check(cid: str, title: str, problems: list[str], details: Any = None, skipped: str | None = None) -> dict[str, Any]:
    state = "SKIPPED" if skipped else ("FAIL" if problems else "PASS")
    return {"id": cid, "title": title, "state": state, "problems": problems, "details": details, **({"skipped": skipped} if skipped else {})}


def run_checks(surface: dict[str, Any], pmap: dict[str, Any], *, root: Path = ROOT, inventory: set[str] | None = None,
               options: tuple[set[str], set[str]] | None = None, option_map: list[tuple[str, ...]] | None = None,
               bridge: dict[str, Any] | None = None, streams: Any = "auto", slug: str | None = "auto",
               arx_sources: list[Path] | None = None) -> dict[str, Any]:
    caps = pmap.get("capabilities", [])
    checks: list[dict[str, Any]] = []

    # C1 coverage
    legacy_routes = [f"{r['method']} {r['path']}" for r in surface.get("routes", [])]
    claimed: dict[str, list[str]] = {}
    for c in caps:
        for r in c.get("legacy_routes", []):
            claimed.setdefault(r, []).append(c["id"])
    problems = [f"legacy route not claimed by any capability: {r}" for r in legacy_routes if r not in claimed]
    problems += [f"legacy route claimed twice ({', '.join(ids)}): {r}" for r, ids in claimed.items() if len(ids) > 1]
    problems += [f"map names a route the legacy does not have: {r} ({', '.join(ids)})" for r, ids in claimed.items() if r not in legacy_routes]
    checks.append(_check("C1", "every legacy route claimed exactly once", problems, {"legacy_routes": len(legacy_routes), "capabilities": len(caps)}))

    # C2 Arx routes exist
    inv = inventory if inventory is not None else arx_inventory()
    problems = [f"{c['id']}: Arx route not in contracts/API_INVENTORY.md: {r}" for c in caps for r in c.get("arx_routes", []) if r not in inv]
    checks.append(_check("C2", "every named Arx route exists (API inventory)", problems, {"arx_routes_named": sum(len(c.get("arx_routes", [])) for c in caps), "inventory_routes": len(inv)}))

    # C3 evidence
    problems = []
    for c in caps:
        texts = []
        for p in c.get("evidence", []):
            f = root / p
            if not f.exists():
                problems.append(f"{c['id']}: evidence path missing: {p}")
            else:
                texts.append(f.read_text(encoding="utf-8", errors="replace"))
        g = c.get("evidence_grep")
        if g and texts and not any(g in t for t in texts):
            problems.append(f"{c['id']}: none of its evidence files mentions {g!r}")
        if c.get("status") in NEEDS_ARX and not c.get("evidence"):
            problems.append(f"{c['id']}: status {c.get('status')} without evidence")
    checks.append(_check("C3", "evidence paths exist and mention the capability", problems))

    # C4 status / decisions
    problems = []
    for c in caps:
        st = c.get("status")
        if st not in STATUSES:
            problems.append(f"{c['id']}: unknown status {st!r}")
        if st in NEEDS_DECISION and not str(c.get("decision") or "").strip():
            problems.append(f"{c['id']}: status {st} without a recorded decision")
        if st in NEEDS_ARX and not (c.get("arx_routes") or c.get("arx_surface")):
            problems.append(f"{c['id']}: status {st} names neither an Arx route nor an Arx surface")
    ids = [c.get("id") for c in caps]
    problems += [f"duplicate capability id {i}" for i in sorted({i for i in ids if ids.count(i) > 1})]
    checks.append(_check("C4", "statuses known; gaps carry a decision", problems))

    # C5 options
    keys, deprecated = options if options is not None else arx_options()
    omap = option_map if option_map is not None else load_migrate_option_map()
    mapped = {row[0]: row for row in omap}
    problems = [f"legacy option without an OPTION_MAP row in scripts/migrate_legacy.py: {k}" for k in surface.get("options", []) if k not in mapped]
    for legacy_key, target, *_rest in omap:
        if target.startswith("option:"):
            opt = target.split(":", 1)[1]
            if opt not in keys:
                problems.append(f"OPTION_MAP {legacy_key} -> {target}: no such Arx add-on option")
            elif opt in deprecated:
                problems.append(f"OPTION_MAP {legacy_key} -> {target}: a DEPRECATED transitional Arx option (use its replacement)")
    checks.append(_check("C5", "legacy options mapped; Arx option targets exist and are current", problems,
                         {"legacy_options": len(surface.get("options", [])), "arx_options": len(keys), "arx_deprecated": sorted(deprecated)}))

    # C6 HA exposure
    br = bridge if bridge is not None else bridge_exposure()
    ha = surface.get("home_assistant", {})
    problems = []
    if any(ha.get("api_use", {}).values()):
        problems.append(f"the legacy source uses a Home Assistant API: {ha.get('api_use')} - entity / service parity must be reviewed by hand")
    if surface.get("legacy", {}).get("slug") == br.get("domain"):
        problems.append("legacy slug equals the bridge domain")
    checks.append(_check("C6", "Home Assistant exposure (entities / services)", problems, {
        "legacy": {"entities": len(ha.get("entities", [])), "services": len(ha.get("services", []))},
        "arx_bridge": {"domain": br.get("domain"), "services": br.get("services"), "entity_platforms": br.get("entity_platforms")}}))

    # C7 go2rtc namespace
    sn = arx_stream_names() if streams == "auto" else streams
    if sn is None:
        checks.append(_check("C7", "go2rtc stream names disjoint", [], skipped="the Arx backend could not be imported here"))
    else:
        prefix, arx_names = sn
        problems = [f"legacy stream name inside the Arx namespace: {n}" for n in LEGACY_STREAM_SAMPLES if n.startswith(prefix)]
        problems += [f"Arx stream name matches a legacy pattern: {n}" for n in arx_names if LEGACY_STREAM_RE.match(n)]
        problems += [f"Arx stream name outside its own namespace: {n}" for n in arx_names if not n.startswith(prefix)]
        unknown = [p for p in surface.get("go2rtc_stream_prefixes", []) if p not in ("hik_ch", "pb_")]
        problems += [f"legacy stream prefix not covered by the patterns: {p}" for p in unknown]
        checks.append(_check("C7", "go2rtc stream names disjoint", problems, {"arx_prefix": prefix, "arx_samples": len(arx_names), "legacy_samples": len(LEGACY_STREAM_SAMPLES)}))

    # C8 side by side
    s = arx_slug() if slug == "auto" else slug
    problems = []
    if not s:
        problems.append("Arx slug not found in smplwise_vms/config.yaml")
    elif s == surface.get("legacy", {}).get("slug"):
        problems.append(f"Arx and the legacy share the add-on slug {s!r}: they cannot be installed side by side")
    files = [Path(p).name for p in surface.get("persisted_files", []) if p.startswith("/config/")]
    srcs = arx_sources if arx_sources is not None else sorted((BACKEND / "smplwise").rglob("*.py"))
    for f in srcs:
        text = f.read_text(encoding="utf-8", errors="replace")
        for name in files:
            if name in text:
                problems.append(f"Arx source references the legacy file {name}: {f.relative_to(root) if f.is_relative_to(root) else f}")
    checks.append(_check("C8", "side by side: distinct slugs; Arx never touches the legacy /config files", problems,
                         {"arx_slug": s, "legacy_slug": surface.get("legacy", {}).get("slug"), "legacy_files": files, "arx_files_scanned": len(srcs)}))

    counts: dict[str, int] = {}
    for c in caps:
        counts[c.get("status", "?")] = counts.get(c.get("status", "?"), 0) + 1
    verdict = "FAIL" if any(c["state"] == "FAIL" for c in checks) else "PASS"
    return {
        "schema": "smplwise-legacy-parity-report/1",
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "legacy": surface.get("legacy", {}),
        "verdict": verdict,
        "checks": checks,
        "status_counts": dict(sorted(counts.items())),
        "gaps": [{"id": c["id"], "capability": c["capability"], "status": c["status"], "decision": c.get("decision", "")} for c in caps if c.get("status") in NEEDS_DECISION | {"partial"}],
        "lab": sorted({lab for c in caps for lab in c.get("lab", [])}),
        "capabilities": caps,
        "note": "static comparison of source and generated contracts; it proves the mapping is complete and consistent, not that a "
                "feature behaves the same on the owner's installation (that is the LAB section of the migration plan)",
    }


def to_markdown(rep: dict[str, Any]) -> str:
    L = [f"# Legacy parity report - {rep['legacy'].get('name')} {rep['legacy'].get('version')} -> SmplWise Arx", "",
         "Generated by `scripts/legacy_parity.py check` (static: source, generated API inventory, add-on config; no device). "
         f"Verdict **{rep['verdict']}**.", "", "| check | state | detail |", "|---|---|---|"]
    for c in rep["checks"]:
        detail = "; ".join(c["problems"]) if c["problems"] else (c.get("skipped") or json.dumps(c.get("details"), ensure_ascii=False))
        L.append(f"| {c['id']} {c['title']} | {c['state']} | {detail.replace('|', '/')} |")
    L += ["", "Status counts: " + ", ".join(f"{k} {v}" for k, v in rep["status_counts"].items()), "",
          "## Parity table", "", "| id | legacy capability | legacy routes | Arx | status | evidence | lab |", "|---|---|---|---|---|---|---|"]
    for c in rep["capabilities"]:
        arx = "<br>".join(f"`{r}`" for r in c.get("arx_routes", [])) or "-"
        if c.get("arx_surface"):
            arx = f"{c['arx_surface']}<br>{arx}" if arx != "-" else c["arx_surface"]
        legacy = "<br>".join(f"`{r}`" for r in c.get("legacy_routes", [])) or (c.get("legacy_ui") or "-")
        ev = "<br>".join(f"`{Path(p).name}`" for p in c.get("evidence", [])) or "-"
        status = c["status"] + (f" - {c['decision']}" if c.get("decision") else "") + (f" ({c['notes']})" if c.get("notes") else "")
        L.append(f"| {c['id']} | {c['capability']} | {legacy} | {arx} | {status} | {ev} | {', '.join(c.get('lab', [])) or '-'} |")
    L += ["", "## Gaps and partial items", ""]
    L += [f"- {g['id']} {g['capability']}: **{g['status']}** - {g['decision'] or 'see notes'}" for g in rep["gaps"]] or ["- none"]
    L += ["", f"LAB items referenced: {', '.join(rep['lab']) or 'none'} (docs/changes/T070-T006-2406.md, LAB section).", "", rep["note"], ""]
    return "\n".join(L)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    ex = sub.add_parser("extract")
    ex.add_argument("--main", required=True)
    ex.add_argument("--config", required=True)
    ex.add_argument("--frontend")
    ex.add_argument("--out", required=True)
    ck = sub.add_parser("check")
    ck.add_argument("--surface", default=str(DEFAULT_SURFACE))
    ck.add_argument("--map", default=str(DEFAULT_MAP))
    ck.add_argument("--json")
    ck.add_argument("--md")
    ns = ap.parse_args(argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except AttributeError:
        pass
    if ns.cmd == "extract":
        try:
            main_src = Path(ns.main).read_text(encoding="utf-8")
            cfg_src = Path(ns.config).read_text(encoding="utf-8")
            fe_src = Path(ns.frontend).read_text(encoding="utf-8", errors="replace") if ns.frontend else ""
        except OSError as exc:
            print(f"input error: {exc}", file=sys.stderr)
            return 2
        surface = extract_surface(main_src, cfg_src, fe_src)
        Path(ns.out).write_text(json.dumps(surface, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
        print(f"{len(surface['routes'])} routes, {len(surface['options'])} option keys -> {ns.out}")
        return 0
    try:
        surface = json.loads(Path(ns.surface).read_text(encoding="utf-8"))
        pmap = json.loads(Path(ns.map).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"input error: {exc}", file=sys.stderr)
        return 2
    rep = run_checks(surface, pmap)
    if ns.json:
        Path(ns.json).write_text(json.dumps(rep, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    md = to_markdown(rep)
    if ns.md:
        Path(ns.md).write_text(md, encoding="utf-8", newline="\n")
    for c in rep["checks"]:
        print(f"{c['id']} {c['state']:7} {c['title']}" + ("".join(f"\n    - {p}" for p in c["problems"])))
    print(f"verdict {rep['verdict']} · statuses {rep['status_counts']}")
    return 0 if rep["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
