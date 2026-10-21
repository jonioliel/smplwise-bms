#!/usr/bin/env python3
"""GATEEFF2-295: changed path -> policy tier floor and test family (docs/release/GATE_TIERS_V2.md). Read-only: it reads git and
file NAMES, runs no test and starts no server.

It does NOT replace scripts/gate/select_tests.py. select_tests.py is the engine's mapper (import closure, API path, custom elements);
this script is the HUMAN view: which policy tier (S/M/L, docs/release/TEST_POLICY.md) a diff needs at least, which domain families the
diff touches, how many backend test files / Playwright specs carry that family's name, and which files it could not place.
Family membership is by FILE NAME (substring list below). A test whose name carries no family word is NOT in any family: it is listed
by `report --unmapped` and reached only through select_tests.py's import closure or the full tier. The tier floor reuses the
full-tier triggers of select_tests.py (one source of truth).

  python scripts/gate/tier_domain_map.py paths <file> [<file> ...]
  python scripts/gate/tier_domain_map.py diff --base <ref> [--head HEAD] [--root .]
  python scripts/gate/tier_domain_map.py report [--root .] [--unmapped]
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import select_tests as st  # noqa: E402  (the engine's own trigger lists)

BE = st.BE
FE = st.FE

# name -> (path regexes of the product code, backend-test name words, Playwright-spec name words); words are lower-case substrings
DOMAINS: dict[str, tuple[list[str], list[str], list[str]]] = {
    "tickets": ([r"routers/tickets", r"services/tickets", r"services/temperature_tickets", r"frontend/src/(tickets|public-ticket)/", r"frontend/src/screens/.*ticket"],
                ["ticket", "rfq", "cr038", "tk2", "vendor", "portal", "public_ui", "mgrdash", "qvalid"],
                ["ticket", "rfq", "vendor", "portal", "public-ui", "public-", "tk2"]),
    "access control / doors": ([r"routers/(access|doors?|bulk_people)", r"services/(access|door|bulk_people)", r"frontend/src/(access-control|access-external)/", r"frontend/src/screens/(access|door)"],
                               ["access", "door", "card", "grant", "arrival", "bulk", "station", "extid", "external"],
                               ["access", "door", "card", "grant", "arrival", "bulk", "station", "external", "people"]),
    "wiskey / intercom / service identity": ([r"services/(intercom|wiskey|service_identity)", r"routers/(intercom|service_identity)", r"frontend/src/wiskey/"],
                                             ["wiskey", "intercom", "svcident", "service_identity", "sharedid", "wkpeer", "acr"],
                                             ["wiskey", "intercom", "service-identity", "svcident", "sharedid"]),
    "temperature": ([r"services/temperature", r"routers/temperature", r"frontend/src/temperature/", r"screens/infra-temperature"],
                    ["temperature", "tempctl"], ["temperature", "tempctl", "temp-"]),
    "energy / electricity": ([r"services/(energy|bill_pdf)", r"routers/energy", r"frontend/src/electricity/", r"screens/infra-electricity"],
                             ["electric", "energy", "billing", "bill_pdf", "meter"], ["electric", "energy", "billing", "meter"]),
    "generator": ([r"services/generator", r"routers/generator", r"frontend/src/generator/", r"screens/infra-generator"],
                  ["generator", "genalert", "genwidget"], ["generator", "genalert", "genwidget"]),
    "elevators": ([r"services/elevator", r"routers/elevators", r"frontend/src/elevators/", r"screens/infra-elevators"],
                  ["elevator", "elevdoors"], ["elevator", "elevdoors"]),
    "recorders / playback / NVR": ([r"services/(nvr|recorder|playback|recordings|go2rtc|stream_codecs)", r"routers/(nvr|recorder|playback|recordings)"],
                                   ["nvr", "recorder", "playback", "recording", "go2rtc", "provision", "stream_codecs", "stillcam"],
                                   ["nvr", "recorder", "playback", "recording", "go2rtc", "provision", "video", "webrtc", "stream"]),
    "frigate": ([r"services/frigate", r"routers/frigate"], ["frigate", "friglive"], ["frigate", "friglive"]),
    "plans / maps / 3D": ([r"services/(plan_|geometry)", r"routers/(plan|floor_images)", r"frontend/src/map/", r"screens/explore-"],
                          ["plan", "map", "floor", "3d", "geometry", "ifc", "dxf", "zones", "wall_curve", "studio", "stylize", "anchor"],
                          ["plan", "map", "floor", "3d", "geometry", "ifc", "dxf", "zone", "studio", "walk", "marker", "editor", "curve", "crop", "multiselect", "stairs", "three"]),
    "media / cast": ([r"services/(media|ma_direct|cast)", r"routers/(media|multimedia|cast)", r"screens/media-"],
                     ["media", "multimedia", "cast", "music"], ["media", "multimedia", "cast", "music"]),
    "notifications / messaging / push": ([r"services/(notify|messaging|announce|mobile_|push|presence|relay)", r"routers/(notif|messaging|notify|announce|mobile_|presence|push)", r"frontend/src/(messaging|pwa)/", r"services/push-relay"],
                                         ["notif", "messag", "whatsapp", "outbox", "announce", "push", "mobile", "presence", "pwa"],
                                         ["notif", "messag", "whatsapp", "announce", "push", "mobile", "presence", "pwa", "android"]),
    "automations / schedules": ([r"services/(automation|schedule|switch_protection)", r"routers/(automations|schedules|rules)", r"screens/automation"],
                                ["automation", "schedule", "scene", "switch_protection"], ["automation", "schedule", "scene", "kavarnit"]),
    "alarm": ([r"services/alarm", r"routers/alarm"], ["alarm"], ["alarm"]),
    "devices / Home Assistant": ([r"services/(devices|device_|ha_|climate|home_)", r"routers/(devices|device_|ha|home)", r"screens/(devices-|home-)"],
                                 ["device", "ha_", "entity", "entid", "climate", "bv1", "home", "lovelace", "ha2610"],
                                 ["device", "ha-", "ha.", "entity", "bv1", "home", "lovelace", "hud", "tiles"]),
    "settings / navigation / tabs": ([r"frontend/src/shell/", r"frontend/src/screens/settings", r"services/(tabs_mode|user_prefs|nav_size|site_location)", r"routers/(settings|me|views)"],
                                     ["settings", "nav", "tabs", "user_prefs", "site_location", "read_mode", "saved_views"],
                                     ["settings", "nav", "tabs", "shell", "dropdown", "menu", "levels", "bookmarks"]),
    "identity / auth / secrets": ([r"services/(local_|webauthn|second_factor|trusted_caller|secrets_store|signing|revocation|privacy_org)", r"routers/(local_|second_factor|app_secrets|local_passkeys)"],
                                  ["auth", "passkey", "identity", "rbac", "perm", "login", "session", "second_factor", "secret", "signing", "custom_roles", "harden", "secfix", "privacy", "username"],
                                  ["auth", "passkey", "identity", "rbac", "perm", "login", "role", "secret", "signing", "second-factor", "secfix", "privacy", "arx"]),
    "backup / update / setup": ([r"services/(backup|energy_backup|self_update|update_runs|platform_restart|setup_wizard|release_notes|bundle)", r"routers/(backup|system_update|setup)"],
                                ["backup", "update", "restart", "setup", "migrat", "release", "upgrade", "version", "bundle"],
                                ["backup", "update", "setup", "bundle", "release"]),
    "wall / live": ([r"services/wall", r"routers/wall", r"screens/(live-|kiosk)"], ["wall", "live", "kiosk"], ["wall", "live", "kiosk"]),
    "investigate (events / cases / search)": ([r"services/(events|correlation|timeline|search|semantic|exports|source_policy|spotlights)", r"routers/(events|cases|exports|search|rules|recordings)", r"screens/investigate-"],
                                              ["event", "case", "export", "search", "semantic", "rule", "correlat", "timeline", "sync"],
                                              ["event", "case", "export", "search", "semantic", "rules", "correlation", "timeline", "investigate", "sync"]),
    "design / skins / accessibility": ([r"frontend/src/(design|styles|components)/"],
                                       ["skin", "palette", "dd_style", "brand", "look", "ui_background", "needs_review"],
                                       ["skin", "design", "a11y", "pixel", "visual", "contrast", "rtl", "uxfix", "uxrest", "bubble", "material", "glass", "palette", "token", "crystal", "hud", "layout-", "screens", "screenshots", "dd-", "pill", "menu", "background", "status-pill", "owner-round", "empty-state"]),
    "health / storage / database": ([r"services/(health_report|storage|thumbnails|process_stats|pending_retention|events_cache)", r"routers/(health|storage)"],
                                    ["health", "storage", "db_", "janitor", "soak", "thumbnail", "backpressure", "task_runner", "body_limit", "raw_body", "refusal", "sql_boundary", "no_ip"],
                                    ["health", "storage", "performance", "speeds"]),
    "bridge (custom_components)": ([r"^custom_components/"], ["bridge", "lovelace", "app_download"], ["bridge", "lovelace", "camera-card", "android"]),
    "gate tooling": ([r"^scripts/gate/"], ["gate", "hygiene", "select_tests", "targeted"], []),
}

SECURITY_STEM = re.compile(r"(backup|local_passkeys|local_identity|local_passwords|second_factor|webauthn|trusted_caller|secrets_store|signing|"
                           r"bridge_keys|bridge_rotation|revocation|service_identity|ha_user_auth|ha_user_admin|door_authority|door_execute|capture_lease)", re.I)
BRIDGE_ALLOW = re.compile(r"^custom_components/smplwise_bridge/(\w+_policy\.py|runnable\.py|services\.yaml|const\.py|config_flow\.py|service_identity\.py)$")
SHARED_UI = re.compile(r"^frontend/src/(components|styles)/")
M_BACKEND = re.compile(r"^smplwise_vms/backend/smplwise/(services/(user_prefs|settings\w*|tabs_mode)\.py|routers/(me|settings)\.py)$")
DOCS_ONLY = re.compile(r"^(docs/|management/|contracts/|README|CHANGELOG|MASTER_SPEC|PROJECT_BOARD|PACKAGE_MANIFEST|smplwise_vms/(DOCS|README|CHANGELOG)|.*\.md$)")
BUILD_ARTEFACT = re.compile(r"^smplwise_vms/(www|www-public)/")
RANK = {"-": 0, "S": 1, "M": 2, "L": 3}


def _norm(p: str) -> str:
    return p.replace("\\", "/").lstrip("./")


def _match_any(patterns, path) -> bool:
    return any(re.search(x, path) for x in patterns)


def tier_floor(path: str) -> tuple[str, str]:
    """(tier, reason) for ONE changed path: the lowest policy tier that file allows. A release takes the highest over its files."""
    p = _norm(path)
    if _match_any(st.FULL_BOTH + st.FULL_BACKEND + st.FULL_FRONTEND, p):
        return "L", "full-tier trigger of select_tests.py (migration, permissions, app core, shell/nav, design tokens, shared fixtures, build config)"
    if BRIDGE_ALLOW.match(p):
        return "L", "bridge allow-list / services / options flow (TEST_POLICY tier L: bridge allow-list)"
    if p.startswith(BE + "/smplwise/") and SECURITY_STEM.search(Path(p).stem):
        return "L", "authentication, backup/restore, secrets or door authority (TEST_POLICY tier L)"
    if p.startswith("custom_components/"):
        return "M", "bridge change (TEST_POLICY tier M)"
    if SHARED_UI.match(p):
        return "M", "shared component or style (TEST_POLICY tier M)"
    if M_BACKEND.match(p):
        return "M", "settings / /me/prefs path (TEST_POLICY tier M)"
    if p.startswith("scripts/gate/"):
        return "S", "gate tooling: the gate's own tests (test_gate_*, test_select_tests) plus selftest_gate.py on the runner"
    if BUILD_ARTEFACT.match(p):
        return "S", "built UI bundle: release_check.py (bundle is current) and the smoke set"
    if DOCS_ONLY.match(p) and "/tests/" not in p:
        return "-", "documentation / management data: release_check.py and the docs consistency tests only"
    if p.startswith(("smplwise_vms/backend/", "frontend/", "scripts/", "services/", "mobile/", "smplwise_vms/")):
        return "S", "ordinary code or test change"
    return "S", "unclassified path: treated as S, look at it"


def families_for_path(path: str) -> list[str]:
    p = _norm(path)
    return [name for name, (src, _b, _f) in DOMAINS.items() if _match_any(src, p)]


def inventory(root: Path):
    be = sorted(x.name for x in (root / BE / "tests").glob("test_*.py"))
    fe = sorted(x.name for x in (root / FE / "tests").glob("*.spec.ts"))
    return be, fe


def family_tests(name: str, be, fe):
    _s, bw, fw = DOMAINS[name]
    return [n for n in be if any(w in n.lower() for w in bw)], [n for n in fe if any(w in n.lower() for w in fw)]


def git_diff(root: Path, base: str, head: str) -> list[str]:
    out = subprocess.run(["git", "-C", str(root), "diff", "--name-only", "--no-renames", f"{base}...{head}"],
                         capture_output=True, text=True, encoding="utf-8", errors="replace", check=True).stdout
    return [_norm(x) for x in out.splitlines() if x.strip()]


def engine_command(tier: str) -> str:
    if tier == "-":
        return "no gate beyond scripts/release_check.py (and a docs consistency run); tier S if anything else is bundled"
    if tier == "S":
        return "~/release_gate.sh <branch> --tier L --select-base <previous release tag> --base <previous release tag>   (selection; falls back to the full tier by itself)"
    if tier == "M":
        return "~/release_gate.sh <branch> --tier L --select-base <previous release tag> --base <previous release tag>   (selection + the families below by hand, see GATE_TIERS_V2.md section 4)"
    return "~/release_gate.sh <branch> --tier L --full --schedule v2   (the full tier)"


def classify_paths(paths: list[str], root: Path):
    rows, top = [], "-"
    fams: dict[str, int] = {}
    unplaced = []
    for p in paths:
        t, why = tier_floor(p)
        f = families_for_path(p)
        for x in f:
            fams[x] = fams.get(x, 0) + 1
        if not f and not DOCS_ONLY.match(_norm(p)) and not BUILD_ARTEFACT.match(_norm(p)):
            unplaced.append(p)
        rows.append((p, t, why, f))
        if RANK[t] > RANK[top]:
            top = t
    if len(paths) > st.MAX_FILES:
        top = "L"
    return top, rows, fams, unplaced


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("paths"); a.add_argument("files", nargs="+"); a.add_argument("--root", default=".")
    d = sub.add_parser("diff"); d.add_argument("--base", required=True); d.add_argument("--head", default="HEAD"); d.add_argument("--root", default=".")
    r = sub.add_parser("report"); r.add_argument("--root", default="."); r.add_argument("--unmapped", action="store_true")
    ns = ap.parse_args(argv)
    root = Path(ns.root)
    be, fe = inventory(root)
    if ns.cmd == "report":
        used_b, used_f = set(), set()
        print(f"backend test files: {len(be)}; Playwright specs: {len(fe)}")
        print("| family | backend test files | Playwright specs |\n|---|---|---|")
        for name in DOMAINS:
            b, f = family_tests(name, be, fe)
            used_b |= set(b); used_f |= set(f)
            print(f"| {name} | {len(b)} | {len(f)} |")
        print(f"\nin at least one family: backend {len(used_b)} of {len(be)}, specs {len(used_f)} of {len(fe)}")
        if ns.unmapped:
            print("\nUNMAPPED backend test files (no family word in the name):")
            print("\n".join(f"  {n}" for n in be if n not in used_b))
            print("\nUNMAPPED Playwright specs (no family word in the name):")
            print("\n".join(f"  {n}" for n in fe if n not in used_f))
        return 0
    paths = [_norm(x) for x in ns.files] if ns.cmd == "paths" else git_diff(root, ns.base, ns.head)
    top, rows, fams, unplaced = classify_paths(paths, root)
    print(f"{len(paths)} changed path(s); policy tier floor: {top}")
    for p, t, why, f in rows[:60]:
        print(f"  [{t}] {p}  - {why}" + (f"  families: {', '.join(f)}" if f else ""))
    if len(rows) > 60:
        print(f"  ... {len(rows) - 60} more")
    if fams:
        print("\nfamilies touched (backend files / specs by name):")
        for name, n in sorted(fams.items(), key=lambda kv: -kv[1]):
            b, f = family_tests(name, be, fe)
            print(f"  {name}: {n} changed path(s); {len(b)} backend files, {len(f)} specs")
    if unplaced:
        print(f"\nno family for {len(unplaced)} path(s) (select_tests.py import closure decides; when in doubt go one tier up):")
        for p in unplaced[:30]:
            print(f"  {p}")
    print("\nengine command: " + engine_command(top))
    print("This is the FLOOR from file paths. TEST_POLICY: when in doubt go one tier up; an owner review flag or a new screen family makes it L.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
