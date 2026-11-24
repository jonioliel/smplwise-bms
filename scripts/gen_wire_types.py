#!/usr/bin/env python3
"""Write the TypeScript types of the modelled API answers (code review 07:F8 step 2, MASTER_PLAN 3.6).

    python scripts/gen_wire_types.py           # rewrite frontend/src/api/generated/*.ts
    python scripts/gen_wire_types.py --check   # exit 1 when a committed file is not what the backend models give

Every route of a FAMILY router that declares a response model (`smplwise/wire`, `@router.get(path, **wire(Model))`) contributes its
model; the JSON schema of the models (serialisation mode: a key with a default may be absent) is turned into `export interface`
declarations, plus one map `<Family>Routes` from `'METHOD /api/v1/path'` to the answer type. The frontend's API modules import these
types instead of writing the wire shapes by hand, so `tsc` fails when a response changes and the client was not adapted.

Step 1 of the finding (`frontend/scripts/api-client-check.mjs`) checks that every client PATH exists; this file checks the SHAPES.
The backend tests `tests/test_wire_consumption_2450.py`, `tests/test_wire_routers_b_2450.py` and `tests/test_wire_routers_c_2470.py` run `--check`, so a model change without the regenerated file fails the gate.
No application start, no database: the router modules are imported and their route tables read."""
from __future__ import annotations

import argparse
import importlib
import json
import re
import sys
import types
import typing
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "smplwise_vms" / "backend"
OUT_DIR = ROOT / "frontend" / "src" / "api" / "generated"
PREFIX = "/api/v1"

# family -> (output file, router modules). One file per family keeps a frontend module's import small and its diff readable.
FAMILIES: dict[str, tuple[str, tuple[str, ...]]] = {
    "Consumption": ("wire-consumption.ts", ("energy_meters", "energy_billing", "water", "water_billing")),
    # CR-RESPONSE-MODELS-B-2450: the routers whose SQL moved in CR-ROUTER-SQL-2450, one file per router
    "Events": ("wire-events.ts", ("events",)),
    "Catalog": ("wire-catalog.ts", ("catalog",)),
    "HomeMapping": ("wire-home-mapping.ts", ("home_mapping",)),
    "HaUsers": ("wire-ha-users.ts", ("ha_users",)),
    "Cases": ("wire-cases.ts", ("cases",)),
    "LocalIdentity": ("wire-local-identity.ts", ("local_identity",)),
    "Temperature": ("wire-temperature.ts", ("temperature",)),
    "CalendarSync": ("wire-calendar-sync.ts", ("calendar_sync",)),
    "Wall": ("wire-wall.ts", ("wall",)),
    "Plans": ("wire-plans.ts", ("plans",)),
    "Alarm": ("wire-alarm.ts", ("alarm",)),
    "Anchors": ("wire-anchors.ts", ("anchors",)),
    "AccessGroups": ("wire-access-groups.ts", ("access_groups",)),
    "Elevators": ("wire-elevators.ts", ("elevators",)),
    "Zones": ("wire-zones.ts", ("zones",)),
    "Cameras": ("wire-cameras.ts", ("cameras",)),
    # CR-RESPONSE-MODELS-C-2470: the routers whose SQL moved in CR-ROUTER-SQL-B-2450, one file per router
    "CalendarFeeds": ("wire-calendar-feeds.ts", ("calendar_feeds",)),
    "DoorWindows": ("wire-door-windows.ts", ("door_windows",)),
    "Frigate": ("wire-frigate.ts", ("frigate",)),
    "Devices": ("wire-devices.ts", ("devices",)),
    "Generator": ("wire-generator.ts", ("generator",)),
    "Doors": ("wire-doors.ts", ("doors",)),
    "Rules": ("wire-rules.ts", ("rules",)),
    "Notices": ("wire-notices.ts", ("notices",)),
    "TicketsCosts": ("wire-tickets-costs.ts", ("tickets_costs",)),
    "Views": ("wire-views.ts", ("views",)),
    "AccessCustomRoles": ("wire-access-custom-roles.ts", ("access_custom_roles",)),
    "Recorders": ("wire-recorders.ts", ("recorders",)),
    "Calendar": ("wire-calendar.ts", ("calendar",)),
    "Notifications": ("wire-notifications.ts", ("notifications",)),
}

IDENT = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")

# CR-RESPONSE-MODELS-D-2470: the small routers whose SQL moved in CR-ROUTER-SQL-C-2450, one file per router. Kept as its own block
# (merged into FAMILIES below) so the parallel batch-B row's block above merges without a conflict. A router listed here before its
# models exist writes no file (see main); tests/test_wire_routers_d_2470.py checks every listed router that has a wire module.
FAMILIES_D: dict[str, tuple[str, tuple[str, ...]]] = {
    "AccessAudit": ("wire-access-audit.ts", ("access_audit",)),
    "AccessBindings": ("wire-access-bindings.ts", ("access_bindings",)),
    "AccessControlCapture": ("wire-access-control-capture.ts", ("access_control_capture",)),
    "AccessControlDiag": ("wire-access-control-diag.ts", ("access_control_diag",)),
    "AccessControlDoor": ("wire-access-control-door.ts", ("access_control_door",)),
    "AccessControlDoorTech": ("wire-access-control-door-tech.ts", ("access_control_door_tech",)),
    "AccessControlOps": ("wire-access-control-ops.ts", ("access_control_ops",)),
    "AccessControlPeople": ("wire-access-control-people.ts", ("access_control_people",)),
    "AccessControlProfiles": ("wire-access-control-profiles.ts", ("access_control_profiles",)),
    "AccessControlStationOps": ("wire-access-control-station-ops.ts", ("access_control_station_ops",)),
    "AccessControlStationPeople": ("wire-access-control-station-people.ts", ("access_control_station_people",)),
    "AccessControlTriage": ("wire-access-control-triage.ts", ("access_control_triage",)),
    "AccessControlWaQueue": ("wire-access-control-wa-queue.ts", ("access_control_wa_queue",)),
    "AccessDirectory": ("wire-access-directory.ts", ("access_directory",)),
    "AccessGrants": ("wire-access-grants.ts", ("access_grants",)),
    "AccessRoles": ("wire-access-roles.ts", ("access_roles",)),
    "Announcements": ("wire-announcements.ts", ("announcements",)),
    "AppBrand": ("wire-app-brand.ts", ("app_brand",)),
    "AppRefresh": ("wire-app-refresh.ts", ("app_refresh",)),
    "AppSecrets": ("wire-app-secrets.ts", ("app_secrets",)),
    "AutomationBlueprints": ("wire-automation-blueprints.ts", ("automation_blueprints",)),
    "AutomationExt": ("wire-automation-ext.ts", ("automation_ext",)),
    "CalendarAttendees": ("wire-calendar-attendees.ts", ("calendar_attendees",)),
    "CameraImageHealth": ("wire-camera-image-health.ts", ("camera_image_health",)),
    "CameraSuggest": ("wire-camera-suggest.ts", ("camera_suggest",)),
    "DeviceLayouts": ("wire-device-layouts.ts", ("device_layouts",)),
    "DoorAutomations": ("wire-door-automations.ts", ("door_automations",)),
    "Exports": ("wire-exports.ts", ("exports",)),
    "Fleet": ("wire-fleet.ts", ("fleet",)),
    "FloorImages": ("wire-floor-images.ts", ("floor_images",)),
    "Frames": ("wire-frames.ts", ("frames",)),
    "FrigateControl": ("wire-frigate-control.ts", ("frigate_control",)),
    "Health": ("wire-health.ts", ("health",)),
    "HomeGaps": ("wire-home-gaps.ts", ("home_gaps",)),
    "HomeInterface": ("wire-home-interface.ts", ("home_interface",)),
    "HomeV3": ("wire-home-v3.ts", ("home_v3",)),
    "HomeWallEvents": ("wire-home-wall-events.ts", ("home_wall_events",)),
    "Incidents": ("wire-incidents.ts", ("incidents",)),
    "LocalPasskeys": ("wire-local-passkeys.ts", ("local_passkeys",)),
    "Me": ("wire-me.ts", ("me",)),
    "Media": ("wire-media.ts", ("media",)),
    "MessagingAccounts": ("wire-messaging-accounts.ts", ("messaging_accounts",)),
    "NvrPrivacy": ("wire-nvr-privacy.ts", ("nvr_privacy",)),
    "NvrWrite": ("wire-nvr-write.ts", ("nvr_write",)),
    "Occupancy": ("wire-occupancy.ts", ("occupancy",)),
    "OfflineField": ("wire-offline-field.ts", ("offline_field",)),
    "Partner": ("wire-partner.ts", ("partner",)),
    "PlanAreaLinks": ("wire-plan-area-links.ts", ("plan_area_links",)),
    "PlanCatalog": ("wire-plan-catalog.ts", ("plan_catalog",)),
    "PlanGeometry": ("wire-plan-geometry.ts", ("plan_geometry",)),
    "PlanPackage": ("wire-plan-package.ts", ("plan_package",)),
    "Playback": ("wire-playback.ts", ("playback",)),
    "PlaybackGroups": ("wire-playback-groups.ts", ("playback_groups",)),
    "PopupLayout": ("wire-popup-layout.ts", ("popup_layout",)),
    "Push": ("wire-push.ts", ("push",)),
    "Recordings": ("wire-recordings.ts", ("recordings",)),
    "SecondFactor": ("wire-second-factor.ts", ("second_factor",)),
    "FactorPolicy": ("wire-factor-policy.ts", ("factor_policy",)),  # MFA-POLICY-2490: the sign-in factor policy and its compliance view
    "Skins": ("wire-skins.ts", ("skins",)),
    "Storage": ("wire-storage.ts", ("storage",)),
    "TicketsAdminSettings": ("wire-tickets-admin-settings.ts", ("tickets_admin_settings",)),
    "Transit": ("wire-transit.ts", ("transit",)),
}
FAMILIES.update(FAMILIES_D)


def wire_models(response_model: Any) -> tuple[type, ...]:
    """The WireModel classes of a route's response model: the model, or the members of a union of models; () for anything else."""
    from smplwise.wire import WireModel

    union = isinstance(response_model, types.UnionType) or typing.get_origin(response_model) is typing.Union
    members = typing.get_args(response_model) if union else (response_model,)
    if members and all(isinstance(m, type) and issubclass(m, WireModel) for m in members):
        return tuple(members)
    return ()


# CR-RESPONSE-MODELS-C-2470: a router module's second APIRouter whose routes are part of the same family (routers/calendar.py answers its
# module state and settings on `open_router`, outside the module gate). Read after `router`, in this order.
EXTRA_ROUTERS = ("open_router",)


def module_routes(mod: Any) -> list[Any]:
    """The routes of a router module: `router`, then the extra routers it has (EXTRA_ROUTERS)."""
    out = list(mod.router.routes)
    for attr in EXTRA_ROUTERS:
        extra = getattr(mod, attr, None)
        if extra is not None:
            out += list(extra.routes)
    return out


def _routes(modules: tuple[str, ...]) -> list[tuple[str, str, tuple[type, ...]]]:
    from fastapi.routing import APIRoute

    out: list[tuple[str, str, tuple[type, ...]]] = []
    for name in modules:
        mod = importlib.import_module(f"smplwise.routers.{name}")
        for r in module_routes(mod):
            if not isinstance(r, APIRoute):
                continue
            models = wire_models(r.response_model)
            for extra in (r.responses or {}).values():  # other answers of the route (a JSONResponse it returns itself), documented with `responses=`
                models += tuple(m for m in wire_models((extra or {}).get("model")) if m not in models)
            if models:
                for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
                    out.append((m, PREFIX + r.path, models))
    return out


def _lit(v: Any) -> str:
    return json.dumps(v, ensure_ascii=False)


def _key(k: str) -> str:
    return k if IDENT.match(k) else _lit(k)


def _union(parts: list[str]) -> str:
    seen: list[str] = []
    for p in parts:
        if p not in seen:
            seen.append(p)
    if "unknown" in seen:
        return "unknown"
    return " | ".join(seen)


def _ts(s: dict[str, Any] | bool, indent: str) -> str:
    """A TypeScript type for one JSON schema node."""
    if s is True or s == {}:
        return "unknown"
    assert isinstance(s, dict)
    if "$ref" in s:
        return s["$ref"].rsplit("/", 1)[-1]
    if "const" in s:
        return _lit(s["const"])
    if "enum" in s:
        return _union([_lit(v) for v in s["enum"]])
    for key in ("anyOf", "oneOf"):
        if key in s:
            return _union([_ts(x, indent) for x in s[key]])
    if "allOf" in s and len(s["allOf"]) == 1:
        return _ts(s["allOf"][0], indent)
    t = s.get("type")
    if isinstance(t, list):
        return _union([_ts({**s, "type": x}, indent) for x in t])
    if t == "string":
        return "string"
    if t in ("integer", "number"):
        return "number"
    if t == "boolean":
        return "boolean"
    if t == "null":
        return "null"
    if t == "array":
        if "prefixItems" in s:
            return "[" + ", ".join(_ts(x, indent) for x in s["prefixItems"]) + "]"
        inner = _ts(s.get("items", {}), indent)
        return f"({inner})[]" if " | " in inner else f"{inner}[]"
    if t == "object":
        props = s.get("properties")
        extra = s.get("additionalProperties")
        if props:
            return _object(s, indent)
        if isinstance(extra, dict):
            return f"Record<string, {_ts(extra, indent)}>"
        return "Record<string, unknown>"
    return "unknown"


def _doc(text: str | None, indent: str) -> list[str]:
    if not text:
        return []
    lines = [ln.rstrip() for ln in text.strip().splitlines()]
    if len(lines) == 1:
        return [f"{indent}/** {lines[0]} */"]
    return [f"{indent}/**", *[f"{indent} * {ln}".rstrip() for ln in lines], f"{indent} */"]


def _fields(s: dict[str, Any], indent: str) -> list[str]:
    req = set(s.get("required", []))
    out: list[str] = []
    for k, v in s.get("properties", {}).items():
        out += _doc(v.get("description") if isinstance(v, dict) else None, indent)
        out.append(f"{indent}{_key(k)}{'' if k in req else '?'}: {_ts(v, indent)};")
    return out


def _object(s: dict[str, Any], indent: str) -> str:
    inner = indent + "  "
    return "{\n" + "\n".join(_fields(s, inner)) + f"\n{indent}}}"


def render(family: str, modules: tuple[str, ...]) -> str:
    from pydantic.json_schema import models_json_schema

    routes = _routes(modules)
    models: list[type] = []
    for _m, _p, members in routes:
        for model in members:
            if model not in models:
                models.append(model)
    _, top = models_json_schema([(m, "serialization") for m in models], ref_template="#/$defs/{model}")
    defs: dict[str, Any] = top.get("$defs", {})
    lines = [
        "// GENERATED by scripts/gen_wire_types.py from the backend response models (smplwise_vms/backend/smplwise/wire). Do not edit:",
        "// change the model, then run `python scripts/gen_wire_types.py` (the backend's environment). A key marked `?` may be absent from the answer (it is never",
        "// sent as null instead); `unknown` is a value the backend passes through as stored. Code review 07:F8 step 2.",
        "/* eslint-disable */",
        "",
    ]
    for name in sorted(defs):
        d = defs[name]
        lines += _doc(d.get("description"), "")
        if d.get("type") == "object" and "properties" in d:
            lines.append(f"export interface {name} {{")
            lines += _fields(d, "  ")
            lines.append("}")
        else:
            lines.append(f"export type {name} = {_ts(d, '')};")
        lines.append("")
    lines.append("/** The answer of every modelled route of this family: `'METHOD path'` -> type. */")
    lines.append(f"export interface {family}Routes {{")
    for method, path, members in routes:
        lines.append(f"  {_lit(f'{method} {path}')}: {' | '.join(m.__name__ for m in members)};")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="compare with the committed files; exit 1 on a difference")
    args = ap.parse_args(argv)
    sys.path.insert(0, str(BACKEND))
    stale: list[str] = []
    for family, (fname, modules) in FAMILIES.items():
        path = OUT_DIR / fname
        if not _routes(modules):  # a family without a modelled route has no file (yet)
            if path.exists():
                stale.append(str(path.relative_to(ROOT)) + " (no modelled route)")
            continue
        text = render(family, modules)
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if args.check:
            if current != text:
                stale.append(str(path.relative_to(ROOT)))
            continue
        if current != text:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8", newline="\n")
            print(f"wrote {path.relative_to(ROOT)}")
    if stale:
        print("stale generated types (run `python scripts/gen_wire_types.py` in the backend's environment): " + ", ".join(stale))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
