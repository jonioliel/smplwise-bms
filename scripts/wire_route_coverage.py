#!/usr/bin/env python3
"""Which modelled API routes does no backend test send through the wire oracle? (CR-ROUTE-CHAR-2460)

A response model (`smplwise/wire`) is checked against the route's own JSON only when a test reaches the route and the route answers
through the model (tests/support/wire_oracle.py). A route no test reaches has a model written from the code alone. This script lists
those routes.

    # 1. run the backend tests with the oracle recording what it compared (one JSON file per test process)
    SW_WIRE_COVERAGE_DIR=/tmp/wirecov python -m pytest tests/ ...
    # 2. list the modelled routes no file names
    python scripts/wire_route_coverage.py /tmp/wirecov [--static] [--json out.json]

`--static` adds, per uncovered route, whether any test file even names its path (a string with the route's literal segments), which
separates "never called" from "called, but never with a successful answer". Routes that answer their own JSONResponse (`return
JSONResponse(...)`, the model declared for the contract or with `responses=`) never pass the oracle (FastAPI does not serialise
them); they are listed apart.
No application start, no database: the router modules are imported and their route tables read (scripts/gen_wire_types.py)."""
from __future__ import annotations

import argparse
import importlib
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "smplwise_vms" / "backend"
PREFIX = "/api/v1"


def _gen():
    spec = importlib.util.spec_from_file_location("gen_wire_types", ROOT / "scripts" / "gen_wire_types.py")
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules.setdefault("gen_wire_types", mod)
    spec.loader.exec_module(mod)
    return mod


def modelled_routes() -> list[dict]:
    """Every route of a generator family with a wire model: router, method, path, and whether FastAPI serialises it through the model
    (`response_model`) or the model only documents a JSONResponse the route returns itself (`responses=`, or `return JSONResponse(`)."""
    from fastapi.routing import APIRoute

    gen = _gen()
    out: list[dict] = []
    for _family, (_file, modules) in gen.FAMILIES.items():
        for name in modules:
            for r in importlib.import_module(f"smplwise.routers.{name}").router.routes:
                if not isinstance(r, APIRoute):
                    continue
                modelled = bool(gen.wire_models(r.response_model))
                documented = any(gen.wire_models((x or {}).get("model")) for x in (r.responses or {}).values())
                if not (modelled or documented):
                    continue
                own = (not modelled) or _own_json_response(r.endpoint)
                for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
                    out.append({"router": name, "key": f"{m} {PREFIX}{r.path}", "path": r.path, "oracle": modelled, "own_json": own})
    return out


def _own_json_response(endpoint) -> bool:
    """The route builds an answer as a `JSONResponse` itself on some path (FastAPI then skips the response model, so the oracle never
    sees that answer): `JSONResponse(` in its source. Its model is a contract its own test validates strictly."""
    import inspect

    try:
        src = inspect.getsource(endpoint)
    except (OSError, TypeError):
        return False
    return "JSONResponse(" in src


def covered(dirs: list[Path]) -> dict[str, int]:
    """The routes the runs compared, summed. The app mounts the API routers twice (`/api/v1` and the Arx app's `/arx/api/v1`); an
    answer under either prefix counts for the route."""
    seen: dict[str, int] = {}
    for d in dirs:
        for f in sorted(d.glob("oracle-*.json")):
            for k, n in json.loads(f.read_text(encoding="utf-8")).items():
                k = k.replace(" /arx/api/v1/", f" {PREFIX}/", 1)
                seen[k] = seen.get(k, 0) + int(n)
    return seen


def _path_regex(path: str) -> re.Pattern[str]:
    parts = re.split(r"(\{[^}]+\})", path)
    rx = "".join(r"(?:\{[^}]*\}|[^/\s\"'?{}]+)" if p.startswith("{") else re.escape(p) for p in parts)
    return re.compile(rx + r"(?=[\"'?])")


_CONST = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*f?[\"']((?:/|\{)[^\"']*)[\"']", re.M)


_IMPORT = re.compile(r"^from ([A-Za-z_][A-Za-z0-9_]*) import \(?([^)\n]*(?:\n[^)\n]*)*?)\)?$", re.M)


def _consts(texts: dict[str, str]) -> dict[str, dict[str, str]]:
    """Per test module, its module-level path constants plus the ones it imports from another test module
    (`from test_infra_temperature import API`)."""
    own = {name: dict(_CONST.findall(t)) for name, t in texts.items()}
    out: dict[str, dict[str, str]] = {}
    for name, t in texts.items():
        consts: dict[str, str] = {}
        for mod, names in _IMPORT.findall(t):
            src = own.get(mod + ".py", {})
            for n in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", names):
                if n in src:
                    consts[n] = src[n]
        consts.update(own[name])
        out[name] = consts
    return out


def _expanded(text: str, consts: dict[str, str]) -> str:
    """The file's text with its path constants (`API = "/api/v1/energy"`) written into the f-strings that use them
    (`f"{API}/tariffs"`), a few rounds for constants built from constants."""
    for _ in range(3):
        for name, value in list(consts.items()):
            text = text.replace("{" + name + "}", value)
            consts = {k: v.replace("{" + name + "}", value) for k, v in consts.items()}
    return text


def named_in_tests(routes: list[dict]) -> dict[str, list[str]]:
    raw = {p.name: p.read_text(encoding="utf-8", errors="replace") for p in (BACKEND / "tests").glob("*.py")}
    consts = _consts(raw)
    texts = {n: _expanded(t, consts[n]) for n, t in raw.items() if n.startswith("test_")}
    out: dict[str, list[str]] = {}
    for r in routes:
        rx = _path_regex(r["path"])
        out[r["key"]] = sorted(n for n, t in texts.items() if rx.search(t))
    return out


def _named(named: dict[str, list[str]], key: str) -> str:
    files = named.get(key) or []
    if not files:
        return "   named in no test file"
    return f"   named in {len(files)} test file(s): {', '.join(files[:3])}{' ...' if len(files) > 3 else ''}"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dirs", nargs="*", type=Path, help="SW_WIRE_COVERAGE_DIR folders of test runs (several runs add up)")
    ap.add_argument("--static", action="store_true", help="also report which test files name each uncovered route's path")
    ap.add_argument("--json", type=Path, help="write the full result as JSON")
    a = ap.parse_args(argv)
    sys.path.insert(0, str(BACKEND))
    routes = modelled_routes()
    seen = covered(a.dirs)
    missed = [r for r in routes if not seen.get(r["key"])]
    uncovered = [r for r in missed if not r["own_json"]]
    documented = [r for r in missed if r["own_json"]]  # the success answer may never reach the oracle
    named = named_in_tests(missed) if a.static else {}
    print(f"modelled routes: {len(routes)} ({sum(1 for r in routes if r['own_json'])} of them return their own JSONResponse on some path)")
    print(f"compared by the oracle in the given runs: {len(routes) - len(missed)} / {len(routes)}")
    print(f"\nnever compared ({len(uncovered)}):")
    for r in uncovered:
        extra = _named(named, r["key"]) if a.static else ""
        print(f"  [{r['router']}] {r['key']}{extra}")
    print(f"\nnever compared, and the route returns its own JSONResponse (the oracle cannot see that answer; its own test validates the model) ({len(documented)}):")
    for r in documented:
        extra = _named(named, r["key"]) if a.static else ""
        print(f"  [{r['router']}] {r['key']}{extra}")
    if a.json:
        a.json.write_text(json.dumps({"routes": routes, "seen": seen, "uncovered": [r["key"] for r in uncovered], "named": named},
                                     indent=1, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
