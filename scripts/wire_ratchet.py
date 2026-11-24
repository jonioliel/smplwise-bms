#!/usr/bin/env python3
"""Response-model ratchet: every JSON route of the API has a wire model (RESPONSE-MODELS-E-2480, code review 07:F8 step 2).

A route "has a model" when it declares a `smplwise/wire` model with `**wire(Model)` (response model + `exclude_unset`), or documents
the JSONResponse it returns itself with `responses={...: {"model": Model}}` (scripts/gen_wire_types.py reads both). A route that sends
no JSON body (a picture, a file, a stream, a 204, an HTML page, a redirect) is listed in its wire module's `NO_JSON`
(`smplwise/wire/<router module>.py`, keys `"METHOD path"` as the router declares the path) and is not counted.

Every other route is UNMODELLED. The count per router module (the module that defines the route's handler) is compared with the
committed baseline (scripts/wire_ratchet_baseline.json):

* a count ABOVE its baseline fails (a new route without a model, a model removed, a router that is not in the baseline yet and has an
  unmodelled route) - model the route, or list it in NO_JSON when it answers no JSON;
* a count BELOW its baseline PASSES and prints a hint to lower the baseline (`--ratchet`), like scripts/design_ratchet.py: only an
  increase fails, so a row that models routes never has to touch the baseline file (no merge conflicts); whoever lowers it locks the
  progress in (a router that got its models then cannot take an unmodelled route again).

The route table is the application's own (`create_app`, the settings scripts/api_inventory.py uses), so routes mounted by a Step or by
main.py itself are counted too.

    python scripts/wire_ratchet.py               check (exit 0 = no count above its baseline, 1 = an increase)
    python scripts/wire_ratchet.py --list        the unmodelled routes, per router (largest first)
    python scripts/wire_ratchet.py --list NAME   the unmodelled routes of one router module
    python scripts/wire_ratchet.py --ratchet     lower the baseline to today's counts (never raises one; --update is the same)
    python scripts/wire_ratchet.py --ratchet --allow-raise  also raise (an exception the reviewer sees in the baseline diff)
    python scripts/wire_ratchet.py --json out.json           also write the result

tests/test_wire_ratchet_2480.py runs the check in the backend suite."""
from __future__ import annotations

import argparse
import importlib
import importlib.util
import json
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "smplwise_vms" / "backend"
BASELINE = ROOT / "scripts" / "wire_ratchet_baseline.json"
PREFIX = "/api/v1"


def _gen() -> Any:
    if "gen_wire_types" in sys.modules:
        return sys.modules["gen_wire_types"]
    spec = importlib.util.spec_from_file_location("gen_wire_types", ROOT / "scripts" / "gen_wire_types.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules["gen_wire_types"] = mod
    spec.loader.exec_module(mod)
    return mod


def _app() -> Any:
    """The application with the inventory's settings (scripts/api_inventory.py): developer identity on, so the dev-only routes count."""
    if str(BACKEND) not in sys.path:
        sys.path.insert(0, str(BACKEND))
    from smplwise.config import Settings
    from smplwise.main import create_app

    tmp = Path(tempfile.mkdtemp(prefix="wire-ratchet-"))
    settings = Settings(
        data_dir=tmp / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
        bootstrap_admin_username="joni", nvr_host=None, nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None,
        log_level="warning",
    )
    return create_app(settings)


def _walk(routes: list[Any], prefix: str = "") -> Any:
    """(full path, APIRoute) of every HTTP route, through FastAPI's lazily included routers."""
    from fastapi.routing import APIRoute

    for r in routes:
        original = getattr(r, "original_router", None)
        if original is not None:
            yield from _walk(original.routes, prefix + (getattr(getattr(r, "include_context", None), "prefix", "") or ""))
            continue
        if isinstance(r, APIRoute):
            yield prefix + r.path, r
            continue
        inner = getattr(r, "routes", None)
        if inner is not None and getattr(r, "endpoint", None) is None:
            yield from _walk(inner, prefix + (getattr(r, "prefix", "") or ""))


def _no_json(name: str) -> frozenset[str]:
    try:
        mod = importlib.import_module(f"smplwise.wire.{name}")
    except ModuleNotFoundError as exc:
        if exc.name != f"smplwise.wire.{name}":
            raise
        return frozenset()
    return frozenset(getattr(mod, "NO_JSON", frozenset()))


def routes(app: Any = None) -> list[dict[str, Any]]:
    """Every HTTP route once: router module, "METHOD path" (full and as the router declares it), modelled, listed as non-JSON."""
    gen = _gen()
    app = app if app is not None else _app()
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    no_json_cache: dict[str, frozenset[str]] = {}
    for full, r in _walk(app.routes):
        module = r.endpoint.__module__
        name = module.rsplit(".", 1)[-1] if module.startswith("smplwise.routers.") else module.replace("smplwise.", "")
        local = full[len(PREFIX):] if full.startswith(PREFIX + "/") else full
        modelled = bool(gen.wire_models(r.response_model)) and bool(r.response_model_exclude_unset)
        documented = any(gen.wire_models((x or {}).get("model")) for x in (r.responses or {}).values())
        if name not in no_json_cache:
            no_json_cache[name] = _no_json(name) if module.startswith("smplwise.routers.") else frozenset()
        for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
            if (m, full) in seen:
                continue
            seen.add((m, full))
            key = f"{m} {local}"
            out.append({"router": name, "key": key, "full": f"{m} {full}", "modelled": modelled or documented,
                        "no_json": key in no_json_cache[name] or f"{m} {full}" in no_json_cache[name]})
    return out


def counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    """Unmodelled JSON routes per router module (routers with none are left out)."""
    out: dict[str, int] = {}
    for r in rows:
        if not r["modelled"] and not r["no_json"]:
            out[r["router"]] = out.get(r["router"], 0) + 1
    return dict(sorted(out.items()))


def load_baseline() -> dict[str, int]:
    if not BASELINE.exists():
        return {}
    return dict(json.loads(BASELINE.read_text(encoding="utf-8")).get("routers", {}))


def check(rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    now = counts(rows if rows is not None else routes())
    base = load_baseline()
    up = {k: (base.get(k, 0), n) for k, n in now.items() if n > base.get(k, 0)}
    down = {k: (b, now.get(k, 0)) for k, b in base.items() if now.get(k, 0) < b}  # informational: never fails
    total_now, total_base = sum(now.values()), sum(base.values())
    if up:
        detail = "UP (model the route, or list it in its wire module's NO_JSON): " + ", ".join(f"{k} {b}->{n}" for k, (b, n) in up.items())
    elif down:
        detail = (f"ok, {total_base - total_now} routes modelled since the baseline - lock it in with `python scripts/wire_ratchet.py --ratchet`: "
                  + ", ".join(f"{k} {b}->{n}" for k, (b, n) in down.items()))
    else:
        detail = f"every count equals its baseline ({total_now} unmodelled JSON routes in {len(now)} router modules)"
    return {"ok": not up, "detail": detail, "up": up, "down": down, "total": total_now, "baseline_total": total_base,
            "counts": now}


def update(allow_raise: bool, rows: list[dict[str, Any]] | None = None) -> tuple[dict[str, int], list[str]]:
    now = counts(rows if rows is not None else routes())
    old = load_baseline()
    refused = [k for k, n in now.items() if n > old.get(k, 0) and not allow_raise and BASELINE.exists()]
    new = {k: (old.get(k, 0) if k in refused else n) for k, n in now.items()}
    new = {k: n for k, n in sorted(new.items()) if n}
    doc = {
        "about": "Response-model ratchet baseline (scripts/wire_ratchet.py, RESPONSE-MODELS-E-2480): unmodelled JSON routes per router "
                 "module. The check fails when a count differs from its number here: above = a route without a wire model; below = lower "
                 "the baseline with --update. Raising needs --allow-raise and a reason in the change note.",
        "total": sum(new.values()),
        "routers": new,
    }
    BASELINE.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return new, refused


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--list", nargs="?", const="", metavar="ROUTER", help="list the unmodelled routes (of one router module)")
    ap.add_argument("--ratchet", "--update", dest="update", action="store_true", help="lower the baseline to today's counts")
    ap.add_argument("--allow-raise", action="store_true", help="with --ratchet: also raise")
    ap.add_argument("--json", help="write the result as JSON here")
    a = ap.parse_args(argv)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except AttributeError:
        pass
    rows = routes()
    if a.list is not None:
        todo = [r for r in rows if not r["modelled"] and not r["no_json"] and (not a.list or r["router"] == a.list)]
        per: dict[str, list[str]] = {}
        for r in todo:
            per.setdefault(r["router"], []).append(r["full"])
        for name, keys in sorted(per.items(), key=lambda kv: (-len(kv[1]), kv[0])):
            print(f"{len(keys):4d}  {name}")
            for k in keys:
                print(f"        {k}")
        print(f"{len(todo)} unmodelled JSON routes in {len(per)} router modules ({sum(1 for r in rows if r['modelled'])} modelled, "
              f"{sum(1 for r in rows if r['no_json'])} without a JSON body, {len(rows)} routes)")
        return 0
    if a.update:
        new, refused = update(a.allow_raise, rows)
        print(f"baseline written: {sum(new.values())} unmodelled JSON routes in {len(new)} router modules")
        if refused:
            print("NOT raised (needs --allow-raise): " + ", ".join(refused))
            return 1
        return 0
    res = check(rows)
    if a.json:
        Path(a.json).write_text(json.dumps(res, indent=1), encoding="utf-8")
    print(f"Response-model ratchet: {res['total']} unmodelled JSON routes (baseline {res['baseline_total']})")
    print("RESULT:", res["detail"])
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
