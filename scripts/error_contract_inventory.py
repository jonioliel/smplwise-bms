#!/usr/bin/env python3
"""API-CONTRACT-ADR-2490: the inventory behind ADR-019 (one error envelope, L2, and `extra="forbid"` per client, L14).

    python scripts/error_contract_inventory.py                 # Markdown report on stdout
    python scripts/error_contract_inventory.py --json          # the same facts as JSON
    python scripts/error_contract_inventory.py --root <smplwise package> --frontend <frontend/src>

Static scan (ast for the backend, regular expressions for the frontend); nothing is imported, started or changed. It reports:

* every error-constructor call in the backend package - `ApiError(...)`, the `errors.py` helpers (`validation`, `conflict`,
  `forbidden`, `not_found`, `unauthenticated`), `ServiceInvalid.to_api_error()`, and any module-local wrapper called as
  `name(<4xx/5xx literal>, "<code>", ...)` (e.g. `svc.err(422, "validation", fields=[...])`, `PublicError(429, ...)`) - with
  its status, code and the keys it puts under `details`; the 422 sites are grouped into envelope SHAPES by those keys
  (`field`, `fields`, `key`, `errors`, other, none, dynamic) and the form of `fields` (list of names, list of objects, map);
* the routers' `except <...Invalid|...Error> as` translation sites;
* direct `JSONResponse(...)` answers in routers and services whose status is an error or not a literal (they bypass the
  ApiError handler, so they must be checked by hand);
* the request bodies of every route: the pydantic model named by a body parameter (or `X.model_validate(...)` in the
  handler), its effective `extra` setting (forbid / ignore / allow / default = ignore), the nested models it reaches, and the
  CLIENT that sends it, from the route path (HA bridge, phone app, web UI); bodies taken as a plain `dict` are listed apart;
* the frontend reads of error `details` keys (`details.field`, `details.fields`, `details.key`, `details.errors`, ...).

    python scripts/error_contract_inventory.py --check         # the ADR-019 ratchet: exit 1 when a family's legacy 422 count grew
    python scripts/error_contract_inventory.py --write-ratchet # lower the baseline after a family row (never raise it by hand)

The ratchet (ADR019-FAMILY678-2520, ADR-019 "Validation evidence") is `scripts/error_contract_ratchet.json`: the legacy 422 sites per
family (`legacy_422_by_family`); a family's count may only go down and a family that is not in the baseline may not appear.

The numbers are a static approximation: a status or `details` built at run time is reported as `dynamic`, a wrapper the
pattern does not recognise is missed. The ADR quotes the counts with that caveat; the tests pin the classifier on a small
tree and that the scan runs on the real code."""
from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "smplwise_vms" / "backend" / "smplwise"
FRONTEND = REPO / "frontend" / "src"
API_PREFIX = "/api/v1"

HELPERS = {"validation": (422, "validation"), "conflict": (409, None), "forbidden": (403, "forbidden"),
           "not_found": (404, "not_found"), "unauthenticated": (401, None)}
META_KWARGS = {"details", "retryable", "status", "message", "user_message", "headers", "exc_info"}
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}
BODY_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SHAPE_ORDER = ("errors", "fields", "field", "key")
FE_KEYS = ("field", "fields", "key", "errors", "problems", "issues")


def _rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


PUBLIC_APP = ("services/tickets/public_",)  # CR-038: the second, public FastAPI app with its own `{code, ...}` answers


def _layer(rel: str) -> str:
    if rel.startswith(PUBLIC_APP):
        return "public_app"
    if rel.startswith("routers/"):
        return "router"
    if rel.startswith("services/"):
        return "service"
    return "core"


def _str(node: ast.AST | None) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def _statuses(node: ast.AST | None) -> list[int] | None:
    """The literal statuses an expression can take (`422`, `409 if x else 422`); None when it is computed."""
    if isinstance(node, ast.Constant) and isinstance(node.value, int) and not isinstance(node.value, bool):
        return [node.value]
    if isinstance(node, ast.IfExp):
        a, b = _statuses(node.body), _statuses(node.orelse)
        return sorted(set(a + b)) if a is not None and b is not None else None
    return None


def _callee(func: ast.AST) -> str:
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return ""


def _dict_keys(node: ast.AST) -> list[str] | str:
    """The literal keys of a `details` dict; `"dynamic"` when it is not a literal; `**x` spreads are recorded as `**`."""
    if isinstance(node, ast.Dict):
        keys: list[str] = []
        for k in node.keys:
            if k is None:
                keys.append("**")
            elif isinstance(k, ast.Constant) and isinstance(k.value, str):
                keys.append(k.value)
            else:
                keys.append("?")
        return keys
    if isinstance(node, ast.Call) and _callee(node.func) == "dict" and not node.args:
        return [kw.arg or "**" for kw in node.keywords]
    if isinstance(node, ast.Constant) and node.value is None:
        return []
    return "dynamic"


def _fields_form(node: ast.AST | None) -> str | None:
    if node is None:
        return None
    if isinstance(node, (ast.List, ast.Tuple)):
        if not node.elts:
            return "list"
        if all(isinstance(e, ast.Constant) and isinstance(e.value, str) for e in node.elts):
            return "list[str]"
        if all(isinstance(e, ast.Dict) for e in node.elts):
            return "list[object]"
        return "list"
    if isinstance(node, ast.ListComp):
        return "list[object]" if isinstance(node.elt, ast.Dict) else "list"
    if isinstance(node, (ast.Dict, ast.DictComp)):
        return "map"
    return "expr"


LEGACY_SHAPES = ("field", "key", "errors")


def family_of(rel: str) -> str:
    """The router / service family of a module: `routers/access_control_door.py` -> `access`, `services/tickets/store.py` ->
    `tickets`, `routers/energy_billing.py` -> `energy`; the migration of ADR-019 goes family by family."""
    parts = rel.removesuffix(".py").split("/")
    if parts[0] in {"routers", "services"} and len(parts) > 1:
        return parts[1].lstrip("_").split("_")[0] or parts[1]
    return "core"


def is_legacy(site: dict[str, Any]) -> bool:
    """A 422 whose field names are not (only) in `details.fields` as a list of names: `details.field`, `details.key`, an `errors`
    issue list, or `fields` as objects / a map. These are what ADR-019 migrates; the ratchet counts them per family."""
    sh = site_shape(site)
    return sh in LEGACY_SHAPES or (sh == "fields" and site.get("fields_form") in {"list[object]", "map"})


def site_shape(site: dict[str, Any]) -> str:
    """The shape of one error site: `fields` for a site built by the canonical helpers (`field_error`, `to_api_error`) - they own
    `fields` / `problems`, so a legacy key passed beside them (`legacy={"errors": ...}`) rides along without making the site
    legacy (ADR019-FAMILY3-2510: a domain `errors` list sorts before `fields` in `shape_of`); `shape_of` of its keys otherwise."""
    return "fields" if site.get("canonical") else shape_of(site["details"])


def shape_of(keys: list[str] | str | None) -> str:
    """The envelope shape of a 422 by its `details` keys: the first of errors / fields / field / key it carries, `other` for
    other keys only, `none` without details, `dynamic` when the details are built at run time."""
    if keys == "dynamic":
        return "dynamic"
    if not keys:
        return "none"
    for k in SHAPE_ORDER:
        if k in keys:
            return k
    return "dynamic" if keys == ["**"] else "other"


def _error_site(node: ast.Call) -> dict[str, Any] | None:
    name = _callee(node.func)
    kwargs = {kw.arg: kw.value for kw in node.keywords if kw.arg}
    spread = any(kw.arg is None for kw in node.keywords)
    if isinstance(node.func, ast.Attribute) and name == "to_api_error":
        status = _statuses(kwargs.get("status")) or [422]
        return {"callee": "to_api_error", "status": status, "code": None, "details": ["fields"], "fields_form": "list[str]", "canonical": True}
    if name == "field_error" and isinstance(node.func, (ast.Name, ast.Attribute)):
        # ADR019-STEP0-2500: errors.field_error(message, fields, *, problems, code, status, legacy, extra) - the canonical
        # `fields` (names) always, `problems` when passed, then the keys of `legacy` / `extra` (a family's legacy key rides along).
        status = _statuses(kwargs.get("status")) or [422]
        code = _str(kwargs.get("code")) if "code" in kwargs else "validation"
        details = ["fields"] + (["problems"] if "problems" in kwargs else [])
        for kw in ("legacy", "extra"):
            if kw in kwargs:
                keys = _dict_keys(kwargs[kw])
                details += keys if isinstance(keys, list) else ["**"]
        return {"callee": "field_error", "status": status, "code": code, "details": details, "fields_form": "list[str]", "canonical": True}
    if name == "ApiError":
        status = _statuses(node.args[0]) if node.args else _statuses(kwargs.get("status"))
        code = _str(node.args[1]) if len(node.args) > 1 else _str(kwargs.get("code"))
        det_node = kwargs.get("details")
        details: list[str] | str = _dict_keys(det_node) if det_node is not None else []
        form = None
        if isinstance(det_node, ast.Dict):
            for k, v in zip(det_node.keys, det_node.values):
                if isinstance(k, ast.Constant) and k.value == "fields":
                    form = _fields_form(v)
        return {"callee": "ApiError", "status": status, "code": code, "details": details, "fields_form": form}
    if name in HELPERS and isinstance(node.func, (ast.Name, ast.Attribute)):
        status, code = HELPERS[name]
        if name == "conflict":
            code = _str(node.args[0]) if node.args else None
        if name == "unauthenticated":
            code = _str(node.args[0]) if node.args else None
        details = [k for k in kwargs if k not in META_KWARGS] + (["**"] if spread else [])
        return {"callee": name, "status": [status], "code": code, "details": details, "fields_form": _fields_form(kwargs.get("fields"))}
    # a module-local wrapper: name(<status literal>, "<code>", ...)
    if len(node.args) >= 2 and _statuses(node.args[0]) and all(400 <= s < 600 for s in _statuses(node.args[0]) or []) and _str(node.args[1]):
        if name in {"JSONResponse", "Response", "HTTPException", "StarletteHTTPException"}:
            return None
        det_node = kwargs.get("details")
        if det_node is not None:
            details = _dict_keys(det_node)
        else:
            details = [k for k in kwargs if k not in META_KWARGS] + (["**"] if spread else [])
        return {"callee": name, "status": _statuses(node.args[0]), "code": _str(node.args[1]), "details": details,
                "fields_form": _fields_form(kwargs.get("fields"))}
    return None


def _json_response_site(node: ast.Call) -> dict[str, Any] | None:
    if _callee(node.func) != "JSONResponse":
        return None
    kwargs = {kw.arg: kw.value for kw in node.keywords if kw.arg}
    st = kwargs.get("status_code")
    statuses = _statuses(st) if st is not None else [200]
    content = kwargs.get("content", node.args[0] if node.args else None)
    if statuses is not None and all(s < 400 for s in statuses):
        return None
    kind = "dynamic"
    if isinstance(content, ast.Call) and _callee(content.func) == "payload":
        kind = "ApiError.payload"
    elif isinstance(content, ast.Dict):
        keys = _dict_keys(content)
        kind = "envelope" if isinstance(keys, list) and {"code", "user_message"} <= set(keys) else "dict:" + ",".join(keys if isinstance(keys, list) else [])
    return {"status": statuses or "dynamic", "content": kind}


_PARSED: dict[Path, list[tuple[str, ast.Module]]] = {}


def parse_all(root: Path) -> list[tuple[str, ast.Module]]:
    """(relative path, tree) of every module under `root`, parsed once per run (the package has ~1100 files)."""
    key = root.resolve()
    if key not in _PARSED:
        _PARSED[key] = [(_rel(p, root), ast.parse(p.read_text(encoding="utf-8"), filename=str(p))) for p in sorted(root.rglob("*.py"))]
    return _PARSED[key]


def scan_errors(root: Path) -> dict[str, list[dict[str, Any]]]:
    sites: list[dict[str, Any]] = []
    translations: list[dict[str, Any]] = []
    direct: list[dict[str, Any]] = []
    http_exc: list[dict[str, Any]] = []
    for rel, tree in parse_all(root):
        if rel == "errors.py":
            continue  # the definitions themselves
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                s = _error_site(node)
                if s:
                    s.update(module=rel, line=node.lineno, layer=_layer(rel))
                    sites.append(s)
                j = _json_response_site(node)
                if j:
                    j.update(module=rel, line=node.lineno, layer=_layer(rel))
                    direct.append(j)
                if _callee(node.func) in {"HTTPException", "StarletteHTTPException"}:
                    http_exc.append({"module": rel, "line": node.lineno, "status": _statuses(node.args[0]) if node.args else None})
            if isinstance(node, ast.ExceptHandler) and node.name and rel.startswith("routers/") and node.type is not None:
                names = [_callee(t) for t in (node.type.elts if isinstance(node.type, ast.Tuple) else [node.type])]
                hit = [n for n in names if n.endswith("Invalid") or (n.endswith("Error") and n not in {"ApiError", "ValueError", "KeyError",
                       "TypeError", "OSError", "RuntimeError", "AttributeError", "IndexError", "LookupError", "ValidationError",
                       "JSONDecodeError", "UnicodeDecodeError", "TimeoutError", "ConnectionError", "OperationalError", "IntegrityError",
                       "DatabaseError", "PermissionError", "FileNotFoundError", "HTTPError", "ClientError"})]
                if hit:
                    translations.append({"module": rel, "line": node.lineno, "exception": "|".join(hit)})
    return {"sites": sites, "translations": translations, "direct_json": direct, "http_exceptions": http_exc}


# ---- request models -------------------------------------------------------------------------------------------------------

def _module_name(rel: str) -> str:
    return rel[:-3].replace("/", ".").removesuffix(".__init__")


def _resolve_from(mod: str, level: int, target: str | None, is_pkg: bool) -> str:
    if level == 0:
        return (target or "").removeprefix("smplwise.")
    parts = mod.split(".")
    base = parts if is_pkg else parts[:-1]
    base = base[: len(base) - (level - 1)] if level > 1 else base
    return ".".join([p for p in base if p] + ([target] if target else []))


def _extra_of(cls: ast.ClassDef) -> str | None:
    for st in cls.body:
        if isinstance(st, (ast.Assign, ast.AnnAssign)):
            targets = st.targets if isinstance(st, ast.Assign) else [st.target]
            if any(isinstance(t, ast.Name) and t.id == "model_config" for t in targets) and st.value is not None:
                v = st.value
                if isinstance(v, ast.Call):
                    for kw in v.keywords:
                        if kw.arg == "extra":
                            return _str(kw.value) or "dynamic"
                    return None
                if isinstance(v, ast.Dict):
                    for k, val in zip(v.keys, v.values):
                        if _str(k) == "extra":
                            return _str(val) or "dynamic"
                    return None
        if isinstance(st, ast.ClassDef) and st.name == "Config":
            for s in st.body:
                if isinstance(s, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "extra" for t in s.targets):
                    return _str(s.value) or "dynamic"
    return None


class ModelIndex:
    """Every class of the package with its bases, own `extra` setting and field annotations; resolves names per module."""

    def __init__(self, root: Path) -> None:
        self.classes: dict[tuple[str, str], dict[str, Any]] = {}
        self.imports: dict[str, dict[str, tuple[str, str | None]]] = {}  # module -> local name -> (module, name or None for a module)
        self.trees: dict[str, ast.Module] = {}
        for rel, tree in parse_all(root):
            mod = _module_name(rel)
            self.trees[mod] = tree
            imps: dict[str, tuple[str, str | None]] = {}
            for node in tree.body:
                if isinstance(node, ast.ImportFrom):
                    src = _resolve_from(mod, node.level, node.module, rel.endswith("__init__.py"))
                    for a in node.names:
                        imps[a.asname or a.name] = (src, a.name)
                elif isinstance(node, ast.Import):
                    for a in node.names:
                        imps[a.asname or a.name.split(".")[0]] = (a.name.removeprefix("smplwise."), None)
            self.imports[mod] = imps
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    fields = [(st.target.id, st.annotation) for st in node.body if isinstance(st, ast.AnnAssign) and isinstance(st.target, ast.Name)]
                    self.classes.setdefault((mod, node.name), {"bases": node.bases, "extra": _extra_of(node), "fields": fields,
                                                                "module": mod, "name": node.name, "line": node.lineno})

    def resolve(self, mod: str, node: ast.AST) -> tuple[str, str] | None:
        """(module, class) a Name / Attribute refers to in `mod`, following `from x import Name` and `import x as m` once more."""
        if isinstance(node, ast.Name):
            if (mod, node.id) in self.classes:
                return (mod, node.id)
            imp = self.imports.get(mod, {}).get(node.id)
            if imp and imp[1] and (imp[0], imp[1]) in self.classes:
                return (imp[0], imp[1])
            if imp and imp[1]:  # re-exported through a package __init__
                sub = self.imports.get(imp[0], {}).get(imp[1])
                if sub and sub[1] and (sub[0], sub[1]) in self.classes:
                    return (sub[0], sub[1])
                if (f"{imp[0]}.{imp[1]}", node.id) in self.classes:
                    return None
            return None
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            imp = self.imports.get(mod, {}).get(node.value.id)
            if imp:
                target = imp[0] if imp[1] is None else f"{imp[0]}.{imp[1]}"
                if (target, node.attr) in self.classes:
                    return (target, node.attr)
        return None

    def is_model(self, key: tuple[str, str], seen: frozenset = frozenset()) -> bool:
        if key in seen:
            return False
        for b in self.classes[key]["bases"]:
            n = _callee(b)
            if n in {"BaseModel", "RootModel"}:
                return True
            r = self.resolve(key[0], b)
            if r and self.is_model(r, seen | {key}):
                return True
        return False

    def extra(self, key: tuple[str, str], seen: frozenset = frozenset()) -> str:
        """The effective `extra`: the class's own, else the first base's that sets one, else pydantic's default `ignore`."""
        own = self.classes[key]["extra"]
        if own:
            return own
        for b in self.classes[key]["bases"]:
            r = self.resolve(key[0], b)
            if r and r not in seen:
                e = self.extra(r, seen | {key})
                if e != "default":
                    return e
        return "default"

    def nested(self, key: tuple[str, str]) -> list[tuple[str, str]]:
        out: list[tuple[str, str]] = []
        todo = [key]
        seen = {key}
        while todo:
            k = todo.pop()
            c = self.classes[k]
            chain = [k] + [r for b in c["bases"] if (r := self.resolve(k[0], b)) and r in self.classes]
            for kk in chain:
                for _, ann in self.classes[kk]["fields"]:
                    for n in ast.walk(ann):
                        if isinstance(n, (ast.Name, ast.Attribute)):
                            r = self.resolve(kk[0], n)
                            if r and r not in seen and self.is_model(r):
                                seen.add(r)
                                out.append(r)
                                todo.append(r)
        return out


def client_of(path: str) -> str:
    """Who sends a route's body, by its path: the HA bridge, the phone app (its contract, docs/api/mobile-presence-contract.md),
    or the web UI shipped in the same image (ADR-015: the only supported client of every other route)."""
    p = path.removeprefix(API_PREFIX)
    if p.startswith("/ha/bridge/"):
        return "ha_bridge"
    if p.startswith("/presence/devices") or p.startswith("/notifications/devices") or p.startswith("/notifications/app/"):
        return "phone_app"
    if p == "/push/subscriptions":
        return "browser_push"  # the browser's PushSubscription.toJSON(), not code the UI writes
    return "web_ui"


def _unwrap(ann: ast.AST) -> list[ast.AST]:
    """The class names inside an annotation (`X`, `X | None`, `Optional[X]`, `Annotated[X, Body()]`, `list[X]`)."""
    if isinstance(ann, ast.BinOp):
        return _unwrap(ann.left) + _unwrap(ann.right)
    if isinstance(ann, ast.Subscript):
        base = _callee(ann.value)
        sl = ann.slice
        if base == "Annotated":
            return _unwrap(sl.elts[0] if isinstance(sl, ast.Tuple) else sl)
        if base in {"Optional", "Union", "list", "List", "tuple", "Sequence"}:
            return [x for e in (sl.elts if isinstance(sl, ast.Tuple) else [sl]) for x in _unwrap(e)]
        return [ann]
    if isinstance(ann, (ast.Name, ast.Attribute)):
        return [ann]
    return []


def _is_dict_ann(ann: ast.AST | None) -> bool:
    if ann is None:
        return False
    if isinstance(ann, ast.Subscript):
        return _callee(ann.value) in {"dict", "Dict"}
    return _callee(ann) in {"dict", "Dict"}


def _router_prefix(tree: ast.Module) -> str:
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call) and _callee(node.value.func) == "APIRouter":
            for kw in node.value.keywords:
                if kw.arg == "prefix" and _str(kw.value):
                    return _str(kw.value) or ""
    return ""


def scan_request_models(root: Path, index: ModelIndex | None = None) -> dict[str, Any]:
    index = index or ModelIndex(root)
    bodies: list[dict[str, Any]] = []
    dict_bodies: list[dict[str, Any]] = []
    for mod, tree in index.trees.items():
        if not mod.startswith("routers"):
            continue
        prefix = _router_prefix(tree)
        for fn in ast.walk(tree):
            if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            routes = []
            for d in fn.decorator_list:
                if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr in HTTP_METHODS and d.args and _str(d.args[0]) is not None:
                    routes.append((d.func.attr.upper(), API_PREFIX + prefix + (_str(d.args[0]) or "")))
            if not routes:
                continue
            found: list[tuple[str, str]] = []
            args = fn.args.posonlyargs + fn.args.args + fn.args.kwonlyargs
            defaults = dict(zip([a.arg for a in (fn.args.posonlyargs + fn.args.args)][::-1], fn.args.defaults[::-1]))
            defaults.update({a.arg: d for a, d in zip(fn.args.kwonlyargs, fn.args.kw_defaults) if d is not None})
            for a in args:
                dflt = defaults.get(a.arg)
                if isinstance(dflt, ast.Call) and _callee(dflt.func) in {"Depends", "Query", "Path", "Header", "Cookie", "File", "Form", "Security"}:
                    continue
                for n in _unwrap(a.annotation) if a.annotation is not None else []:
                    r = index.resolve(mod, n)
                    if r and index.is_model(r) and r not in found:
                        found.append(r)
                if _is_dict_ann(a.annotation) and any(m in BODY_METHODS for m, _ in routes):
                    for m, p in routes:
                        dict_bodies.append({"module": mod, "function": fn.name, "method": m, "path": p, "client": client_of(p)})
            for n in ast.walk(fn):  # X.model_validate(...) / X.model_validate_json(...) inside the handler
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr in {"model_validate", "model_validate_json"}:
                    r = index.resolve(mod, n.func.value)
                    if r and index.is_model(r) and r not in found:
                        found.append(r)
            for r in found:
                for m, p in routes:
                    bodies.append({"model": f"{r[0]}.{r[1]}", "key": r, "method": m, "path": p, "client": client_of(p), "router": mod})
    models: dict[tuple[str, str], dict[str, Any]] = {}
    for b in bodies:
        m = models.setdefault(b["key"], {"model": b["model"], "extra": index.extra(b["key"]), "routes": [], "clients": set(), "nested": []})
        m["routes"].append(f'{b["method"]} {b["path"]}')
        m["clients"].add(b["client"])
    for key, m in models.items():
        m["nested"] = [{"model": f"{n[0]}.{n[1]}", "extra": index.extra(n)} for n in index.nested(key)]
        m["clients"] = sorted(m["clients"])
    nested_all: dict[str, str] = {}
    for m in models.values():
        for n in m["nested"]:
            if n["model"] not in {x["model"] for x in models.values()}:
                nested_all[n["model"]] = n["extra"]
    return {"models": sorted(models.values(), key=lambda m: m["model"]), "nested_only": nested_all, "dict_bodies": dict_bodies}


# ---- frontend ---------------------------------------------------------------------------------------------------------------

_FE_READ = re.compile(r"details(?:\?\.|\.|\s+as\s+\{[^}]*?\b)(" + "|".join(FE_KEYS) + r")\b")
_FE_CAST = re.compile(r"details[^;\n]{0,40}?as\s+\{([^}]*)\}")


def scan_frontend(fe_root: Path) -> dict[str, list[str]]:
    """file:line of every frontend read of an error-details key (skips the generated types and the tests)."""
    hits: dict[str, list[str]] = defaultdict(list)
    if not fe_root.is_dir():
        return {}
    for path in sorted(fe_root.rglob("*.ts")):
        rel = _rel(path, fe_root)
        if rel.startswith("api/generated/") or ".test." in rel or ".spec." in rel:
            continue
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "details" not in line or ("body" not in line and "err" not in line and "ApiError" not in line and "e." not in line):
                continue
            keys = set(_FE_READ.findall(line))
            for cast in _FE_CAST.findall(line):
                keys |= {k for k in FE_KEYS if re.search(rf"\b{k}\??\s*:", cast)}
            for k in sorted(keys):
                hits[k].append(f"{rel}:{i}")
    return dict(hits)


# ---- report -----------------------------------------------------------------------------------------------------------------

def build(root: Path = ROOT, fe_root: Path = FRONTEND) -> dict[str, Any]:
    err = scan_errors(root)
    req = scan_request_models(root)
    fe = scan_frontend(fe_root)
    s422 = [s for s in err["sites"] if s["status"] and 422 in s["status"] and s["layer"] != "public_app"]
    public_sites = [s for s in err["sites"] if s["layer"] == "public_app"]
    other_keys = Counter(k for s in s422 if site_shape(s) == "other" for k in s["details"])
    shapes = Counter(site_shape(s) for s in s422)
    by_shape_layer = Counter((site_shape(s), s["layer"]) for s in s422)
    forms = Counter(s["fields_form"] for s in s422 if site_shape(s) == "fields" and s["fields_form"])
    examples: dict[str, list[str]] = defaultdict(list)
    for s in s422:
        sh = site_shape(s)
        if len(examples[sh]) < 4:
            examples[sh].append(f'{s["module"]}:{s["line"]} {s["callee"]}({s["code"] or "?"}) details={s["details"]}')
    shape_modules: dict[str, set[str]] = defaultdict(set)
    for s in s422:
        shape_modules[site_shape(s)].add(s["module"])
    mixed = sorted(m for m in {s["module"] for s in s422}
                   if len({site_shape(x) for x in s422 if x["module"] == m} - {"none", "other", "dynamic"}) > 1)
    legacy = Counter(family_of(s["module"]) for s in s422 if is_legacy(s))
    canonical = Counter(family_of(s["module"]) for s in s422 if site_shape(s) == "fields" and not is_legacy(s))
    status_counts = Counter(str(st) for s in err["sites"] for st in (s["status"] or ["dynamic"]))
    callee_counts = Counter(s["callee"] for s in err["sites"])
    extra_counts = Counter(m["extra"] for m in req["models"])
    client_extra: dict[str, Counter] = defaultdict(Counter)
    for m in req["models"]:
        for c in m["clients"]:
            client_extra[c][m["extra"]] += 1
    nested_extra = Counter(req["nested_only"].values())
    return {
        "summary": {
            "error_sites": len(err["sites"]),
            "status_counts": dict(sorted(status_counts.items())),
            "callee_counts": dict(callee_counts.most_common()),
            "sites_422": len(s422),
            "shapes_422": dict(shapes.most_common()),
            "shapes_422_by_layer": {f"{a}/{b}": n for (a, b), n in sorted(by_shape_layer.items())},
            "fields_forms_422": dict(forms.most_common()),
            "other_keys_422": dict(other_keys.most_common(15)),
            "public_app_error_sites": len(public_sites),
            "modules_per_shape_422": {k: len(v) for k, v in sorted(shape_modules.items())},
            "modules_mixing_shapes_422": mixed,
            "legacy_422_by_family": dict(legacy.most_common()),
            "canonical_fields_422_by_family": dict(canonical.most_common()),
            "translation_sites": len(err["translations"]),
            "translation_sites_invalid": sum(1 for t in err["translations"] if "Invalid" in t["exception"]),
            "direct_json_error_answers": len(err["direct_json"]),
            "http_exception_raises": len(err["http_exceptions"]),
            "request_models": len(req["models"]),
            "request_models_by_extra": dict(extra_counts.most_common()),
            "request_models_by_client": {c: dict(v.most_common()) for c, v in sorted(client_extra.items())},
            "nested_only_models_by_extra": dict(nested_extra.most_common()),
            "dict_bodies": len(req["dict_bodies"]),
            "frontend_detail_reads": {k: len(v) for k, v in sorted(fe.items())},
        },
        "examples_422": dict(examples),
        "translations": err["translations"],
        "direct_json": err["direct_json"],
        "request_models": [{k: v for k, v in m.items() if k != "key"} for m in req["models"]],
        "dict_bodies": req["dict_bodies"],
        "frontend": fe,
    }


def markdown(rep: dict[str, Any]) -> str:
    s = rep["summary"]
    out = ["# Error envelope and request-model inventory (scripts/error_contract_inventory.py)", ""]
    out.append(f'Error-constructor sites: {s["error_sites"]} (422: {s["sites_422"]}); router `except ...Invalid/...Error` translations: '
               f'{s["translation_sites"]}; direct JSONResponse error answers: {s["direct_json_error_answers"]}; HTTPException raises: {s["http_exception_raises"]}.')
    out += ["", "## Statuses", "", "| status | sites |", "|---|---|"] + [f"| {k} | {v} |" for k, v in s["status_counts"].items()]
    out += ["", "## Constructors", "", "| callee | sites |", "|---|---|"] + [f"| `{k}` | {v} |" for k, v in s["callee_counts"].items()]
    out += ["", "## 422 shapes (by `details` keys)", "", "| shape | sites | modules | examples |", "|---|---|---|---|"]
    for k, v in s["shapes_422"].items():
        ex = "<br>".join(f"`{e}`" for e in rep["examples_422"].get(k, [])[:2])
        out.append(f'| {k} | {v} | {s["modules_per_shape_422"].get(k, 0)} | {ex} |')
    out += ["", f'`fields` forms: {s["fields_forms_422"]}', "", f'Most common keys of the `other` shape: {s["other_keys_422"]}', "",
            f'Public app (CR-038, its own `{{code, ...}}` answers, not counted above): {s["public_app_error_sites"]} sites', "", f'Modules mixing 422 shapes: {len(s["modules_mixing_shapes_422"])} - '
            + ", ".join(f"`{m}`" for m in s["modules_mixing_shapes_422"])]
    out += ["", "## Legacy 422 shapes by family (the ADR-019 ratchet)", "", "| family | legacy sites | canonical `fields` sites |", "|---|---|---|"]
    out += [f'| {f} | {n} | {s["canonical_fields_422_by_family"].get(f, 0)} |' for f, n in s["legacy_422_by_family"].items()]
    out += ["", "## Direct JSONResponse error answers", "", "| where | status | content |", "|---|---|---|"]
    out += [f'| `{d["module"]}:{d["line"]}` | {d["status"]} | {d["content"]} |' for d in rep["direct_json"]]
    out += ["", "## Request models", "", f'{s["request_models"]} body models; by `extra`: {s["request_models_by_extra"]}; '
            f'nested-only models by `extra`: {s["nested_only_models_by_extra"]}; plain `dict` bodies: {s["dict_bodies"]}.', "",
            "| client | by extra |", "|---|---|"] + [f"| {c} | {v} |" for c, v in s["request_models_by_client"].items()]
    out += ["", "Non-web-UI request models:", ""]
    for m in rep["request_models"]:
        if m["clients"] != ["web_ui"]:
            out.append(f'- `{m["model"]}` ({m["extra"]}) - {", ".join(m["clients"])}: {", ".join(m["routes"][:3])}')
    out += ["", "Plain dict bodies:", ""] + [f'- {d["method"]} {d["path"]} ({d["client"]}, `{d["module"]}.{d["function"]}`)' for d in rep["dict_bodies"]]
    out += ["", "## Frontend reads of error details", "", "| key | reads | where |", "|---|---|---|"]
    for k, v in sorted(rep["frontend"].items()):
        out.append(f'| `{k}` | {len(v)} | {", ".join(v[:6])}{" ..." if len(v) > 6 else ""} |')
    return "\n".join(out) + "\n"


RATCHET = REPO / "scripts" / "error_contract_ratchet.json"


def ratchet_problems(now: dict[str, int], base: dict[str, Any]) -> list[str]:
    """The families whose legacy 422 count is above the baseline (a new family counts from 0); [] when the ratchet holds."""
    allowed = base.get("legacy_422_by_family", {})
    return [f"{fam}: {n} legacy 422 sites (baseline {allowed.get(fam, 0)})" for fam, n in sorted(now.items()) if n > allowed.get(fam, 0)]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("--root", type=Path, default=ROOT)
    ap.add_argument("--frontend", type=Path, default=FRONTEND)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--check", action="store_true", help="the ADR-019 ratchet against scripts/error_contract_ratchet.json")
    ap.add_argument("--write-ratchet", action="store_true", help="write the current legacy counts as the new baseline")
    a = ap.parse_args(argv)
    rep = build(a.root, a.frontend)
    sys.stdout.reconfigure(encoding="utf-8")
    now = rep["summary"]["legacy_422_by_family"]
    if a.write_ratchet:
        doc = {"_note": "ADR-019 ratchet: legacy 422 sites per family (scripts/error_contract_inventory.py --check); counts may only go down.",
               "legacy_422_by_family": dict(sorted(now.items())), "total": sum(now.values())}
        RATCHET.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
        print(f"wrote {RATCHET.name}: {doc['total']} legacy 422 sites")
        return 0
    if a.check:
        bad = ratchet_problems(now, json.loads(RATCHET.read_text(encoding="utf-8")))
        print("\n".join(bad) if bad else f"error contract ratchet holds: {sum(now.values())} legacy 422 sites")
        return 1 if bad else 0
    print(json.dumps(rep, ensure_ascii=False, indent=1, default=str) if a.json else markdown(rep))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
