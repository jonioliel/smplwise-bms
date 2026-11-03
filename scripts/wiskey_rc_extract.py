"""Static contract extraction from a WisKey (`hikvision_intercom`) source tree - no import, no device, no Home Assistant.

WISKEY-RC10-PIN-2382. Arx pins WisKey's command contract in `docs/integrations/wiskey/catalog/<pin>/`. Earlier pins were
delivered by WisKey (`rc37-contract.4`); from rc.10 on Arx extracts the same facts itself, from WisKey's source, so that the
next WisKey rc is diffed in one run:

    py -3.12 scripts/wiskey_rc_extract.py --git "C:/hik intercom" --ref origin/<branch> --out DIR
    py -3.12 scripts/wiskey_rc_extract.py --source <checkout or component dir> --out DIR
    py -3.12 scripts/wiskey_contract_diff.py --candidate DIR [--json]           # the D-005 diff against the repository pin

The source is PARSED with `ast` and never imported or executed: module-level constants are evaluated by a small closed
evaluator (literals, names, `+ - |`, comprehensions over literals, `sorted/frozenset/tuple/set`, f-strings over constants).
`--git` reads the tree with `git archive` into a temporary folder; nothing in the WisKey repository is written.

Output (the folder is created; existing files of the same name are replaced):
- `commands.static.json` - WisKey's PUBLIC WebSocket table (`websocket.COMMANDS`): the top-level request schema of each
  command (as built by `websocket._command_handler`), the base permission classifier (`panel_permissions`), the READ
  classification (`api_contract.READ_COMMANDS`) and the request byte limit. Same format as the WisKey-delivered rc.37 file,
  so `wiskey_contract_diff.py` diffs the two directly.
- `errors.static.json`   - every `AccessError` / `AudioError` / `IntercomTtsError` `("<literal>")` in the component, with its source locations.
- `surface.static.json`  - what the rc.37 catalog never held: manifest version, `overview.api` version / min_client /
  capabilities (static, candidate, conditional), the separate WebSocket registries (W10 media, features, peer, templates,
  installation, relay map, capture, name references, tts, audio, subscribe, core runtime, service-write status), the
  direct-only reads, the `overview.api.commands` projection for an administrator and for the paired bridge identity,
  HA services, entity platforms / keys / states and event types, HA bus events.
- `PIN.json`             - SHA-256 and counts of the three files, the runtime version and the source ref/commit.

Limits (same as WisKey's own rc.37 caveats): top-level keys only, no nested schemas, no response shapes, not an
authorization oracle, not an approval to write. A registry module this script does not know (a new
`websocket_api.async_register_command` caller) FAILS the extraction (exit 3) instead of being silently skipped.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import io
import json
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
from typing import Any

COMPONENT = "custom_components/hikvision_intercom"
EXTRACTOR_VERSION = 1
SCHEMA_URL = "https://json-schema.org/draft/2020-12/schema"
REQUEST_NOTE = "top-level Voluptuous registration only; nested fields and semantic validators not represented"
RESPONSE_NOTE = "not statically generated; do not use as a validator"
ERROR_UI = "show safe localized error and refetch authoritative state; do not auto-retry mutation"
WARNING = ("Static source extraction by Arx (scripts/wiskey_rc_extract.py), not full nested request/response schemas. "
           "Runtime checks and downstream errors require separate documentation and tests.")
JSON_TYPE = {"str": "string", "int": "integer", "bool": "boolean", "dict": "object", "list": "array", "float": "number"}

# Every module that registers a WebSocket command, with the expression (over its own module constants) that names the
# commands it registers. A module that registers commands and is missing here fails the extraction.
# `verify` = string constants that must appear in the module, for registrations made in a loop over a local literal.
REGISTRIES: dict[str, dict[str, Any]] = {
    "websocket.py": {"names": "tuple(COMMANDS) + ('subscribe',)", "group": "public_and_subscribe"},
    "whatsapp_template_api_v1.py": {"names": "(COMMAND,)", "from": "whatsapp_template_runtime_v1.py", "group": "template_v1"},
    "whatsapp_template_api_v2.py": {"names": "(COMMAND,)", "group": "template_v2"},
    "arx_feature_api.py": {"names": "COMMANDS", "group": "features"},
    "audio_tts.py": {"names": "('tts/engines', 'tts/start')", "verify": ("/tts/engines", "/tts/start"), "group": "tts"},
    "audio_api.py": {"names": "('audio/start', 'audio/send', 'audio/receive', 'audio/mute', 'audio/diagnostics')",
                     "verify": ("/audio/start", "send", "receive", "mute", "diagnostics"), "group": "audio"},
    "capture_native_api.py": {"names": "COMMANDS", "group": "capture"},
    "core_runtime_observation.py": {"names": "('installation/core_runtime_v1',)",
                                    "verify": ("hikvision_intercom/installation", "/core_runtime_v1"), "group": "core_runtime"},
    "event_resume.py": {"names": "(COMMAND,)", "group": "event_resume"},
    "name_reference_api.py": {"names": "COMMANDS", "group": "name_references"},
    "native_installation_api.py": {"names": "COMMANDS", "group": "installation"},
    "native_peer_write_api.py": {"names": "(COMMAND,)", "group": "peer_writes"},
    "native_service_write_api.py": {"names": "(STATUS,)", "group": "service_write_status"},
    "peer_bridge_api.py": {"names": "(LOOKUP, HISTORY, RESOLVE, PROTOCOL)", "group": "peer"},
    "relay_export_api.py": {"names": "COMMANDS", "group": "relay_map"},
    "station_media_api.py": {"names": "COMMANDS", "group": "station_media_w10"},
}
# The error classes whose first literal argument is a public error code (the rc.37 delivery used the same three).
ERROR_CLASSES = frozenset({"AccessError", "AudioError", "IntercomTtsError"})
DIRECT_ONLY = ("trusted_actions/direct_bridge_origin.py", "DIRECT_READ_COMMANDS")


class ExtractError(Exception):
    """The source does not have the shape this extractor understands - review the extractor before trusting a catalog."""


# ---------------------------------------------------------------- the closed constant evaluator

class TypeToken:
    def __init__(self, name: str) -> None:
        self.name = name

    def __repr__(self) -> str:
        return f"<type {self.name}>"


class _Unknown(Exception):
    pass


BUILTIN_TYPES = {name: TypeToken(name) for name in JSON_TYPE}
SAFE_CALLS = {"frozenset": frozenset, "set": set, "tuple": tuple, "list": list, "sorted": sorted, "dict": dict}


def evaluate(node: ast.AST, scope: dict[str, Any]) -> Any:
    """The value of a constant expression, or `_Unknown` - never executes source code."""
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        if node.id in scope:
            return scope[node.id]
        if node.id in BUILTIN_TYPES:
            return BUILTIN_TYPES[node.id]
        raise _Unknown(node.id)
    if isinstance(node, (ast.Tuple, ast.List, ast.Set)):
        items: list[Any] = []
        for elt in node.elts:
            if isinstance(elt, ast.Starred):
                items.extend(evaluate(elt.value, scope))
            else:
                items.append(evaluate(elt, scope))
        return tuple(items) if isinstance(node, ast.Tuple) else (items if isinstance(node, ast.List) else frozenset(items))
    if isinstance(node, ast.Dict):
        out: dict[Any, Any] = {}
        for key, value in zip(node.keys, node.values):
            if key is None:
                out.update(evaluate(value, scope))
            else:
                out[evaluate(key, scope)] = evaluate(value, scope)
        return out
    if isinstance(node, ast.BinOp):
        left, right = evaluate(node.left, scope), evaluate(node.right, scope)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return frozenset(left) - frozenset(right)
        if isinstance(node.op, ast.BitOr):
            return frozenset(left) | frozenset(right)
        if isinstance(node.op, ast.Mult) and isinstance(left, int) and isinstance(right, int):
            return left * right
        if isinstance(node.op, ast.Pow) and isinstance(left, int) and isinstance(right, int):
            return left ** right
        raise _Unknown("binop")
    if isinstance(node, ast.JoinedStr):
        parts = []
        for value in node.values:
            parts.append(str(evaluate(value.value if isinstance(value, ast.FormattedValue) else value, scope)))
        return "".join(parts)
    if isinstance(node, (ast.GeneratorExp, ast.ListComp, ast.SetComp)):
        if len(node.generators) != 1 or node.generators[0].ifs or not isinstance(node.generators[0].target, (ast.Name, ast.Tuple)):
            raise _Unknown("comprehension")
        gen = node.generators[0]
        results = []
        for item in evaluate(gen.iter, scope):
            local = dict(scope)
            if isinstance(gen.target, ast.Name):
                local[gen.target.id] = item
            else:
                for target, value in zip(gen.target.elts, item):
                    if not isinstance(target, ast.Name):
                        raise _Unknown("target")
                    local[target.id] = value
            results.append(evaluate(node.elt, local))
        return frozenset(results) if isinstance(node, ast.SetComp) else tuple(results)
    if isinstance(node, ast.Subscript):
        return evaluate(node.value, scope)[evaluate(node.slice, scope)]
    if isinstance(node, ast.IfExp):
        return evaluate(node.body if evaluate(node.test, scope) else node.orelse, scope)
    if isinstance(node, ast.Compare) and len(node.ops) == 1:
        left, right = evaluate(node.left, scope), evaluate(node.comparators[0], scope)
        op = node.ops[0]
        if isinstance(op, ast.Is):
            return left is right
        if isinstance(op, ast.Eq):
            return left == right
        if isinstance(op, ast.In):
            return left in right
        if isinstance(op, ast.NotIn):
            return left not in right
        raise _Unknown("compare")
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id in SAFE_CALLS and not node.keywords:
            return SAFE_CALLS[node.func.id](*(evaluate(a, scope) for a in node.args))
        if isinstance(node.func, ast.Attribute) and node.func.attr in ("values", "keys", "items") and not node.args:
            base = evaluate(node.func.value, scope)
            if isinstance(base, dict):
                return tuple(getattr(base, node.func.attr)())
        raise _Unknown("call")
    raise _Unknown(type(node).__name__)


class Module:
    """One parsed source file: its AST and the module-level constants the evaluator could resolve."""

    def __init__(self, root: Path, rel: str, modules: "Tree") -> None:
        self.rel = rel
        self.path = root / rel
        self.text = self.path.read_text(encoding="utf-8")
        self.tree = ast.parse(self.text, filename=rel)
        self.scope: dict[str, Any] = {}
        for stmt in self.tree.body:  # `from .const import DOMAIN` style imports of constants resolve through the tree
            if isinstance(stmt, ast.ImportFrom) and stmt.level >= 1 and stmt.module:
                target = _relative(rel, stmt.module, stmt.level)
                if target and target != rel and modules.exists(target):
                    other = modules.get(target)
                    for alias in stmt.names:
                        if alias.name in other.scope:
                            self.scope[alias.asname or alias.name] = other.scope[alias.name]
            elif isinstance(stmt, (ast.Assign, ast.AnnAssign)):
                targets = stmt.targets if isinstance(stmt, ast.Assign) else [stmt.target]
                if stmt.value is None:
                    continue
                for target in targets:
                    if isinstance(target, ast.Name):
                        try:
                            self.scope[target.id] = evaluate(stmt.value, self.scope)
                        except (_Unknown, TypeError, KeyError, IndexError, ValueError):
                            pass

    def const(self, name: str) -> Any:
        if name not in self.scope:
            raise ExtractError(f"{self.rel}: constant {name} not found or not statically evaluable")
        return self.scope[name]

    def expr(self, source: str) -> Any:
        try:
            return evaluate(ast.parse(source, mode="eval").body, self.scope)
        except _Unknown as exc:
            raise ExtractError(f"{self.rel}: cannot evaluate {source!r} ({exc})") from None

    def function(self, name: str) -> ast.FunctionDef:
        for stmt in ast.walk(self.tree):
            if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef)) and stmt.name == name:
                return stmt  # type: ignore[return-value]
        raise ExtractError(f"{self.rel}: function {name} not found")


def _relative(rel: str, module: str, level: int) -> str | None:
    parts = rel.split("/")[:-1]
    if level > 1:
        parts = parts[: len(parts) - (level - 1)]
    return "/".join([*parts, *module.split(".")]) + ".py"


class Tree:
    def __init__(self, component: Path) -> None:
        self.root = component
        self._cache: dict[str, Module] = {}
        self._loading: set[str] = set()

    def exists(self, rel: str) -> bool:
        return (self.root / rel).is_file()

    def get(self, rel: str) -> Module:
        if rel not in self._cache:
            if rel in self._loading:  # an import cycle: the second module sees no constants from the first
                raise ExtractError(f"import cycle at {rel}")
            self._loading.add(rel)
            try:
                self._cache[rel] = Module(self.root, rel, self)
            finally:
                self._loading.discard(rel)
        return self._cache[rel]

    def python_files(self) -> list[str]:
        return sorted(p.relative_to(self.root).as_posix() for p in self.root.rglob("*.py"))


# ---------------------------------------------------------------- commands.static.json

def _handler_extras(ws: Module) -> tuple[dict[str, set[str]], list[tuple[Any, dict[str, Any]]]]:
    """From `_command_handler`: the per-command optional keys and the conditional extra keys (`**({...} if command ...)`)."""
    fn = ws.function("_command_handler")
    optional: dict[str, set[str]] = {}
    extras: list[tuple[Any, dict[str, Any]]] = []
    for node in ast.walk(fn):
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "optional" for t in node.targets):
            call = node.value
            if not (isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute) and call.func.attr == "get"):
                raise ExtractError("websocket.py: _command_handler optional map changed shape")
            optional = {k: set(v) for k, v in evaluate(call.func.value, ws.scope).items()}
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "Schema":
            arg = node.args[0] if node.args else None
            if not isinstance(arg, ast.Dict) or not any(isinstance(k, ast.Call) and getattr(k.func, "attr", "") == "Required"
                                                         and isinstance(k.args[0], ast.Constant) and k.args[0].value == "id"
                                                         for k in arg.keys if k is not None):
                continue
            for key, value in zip(arg.keys, arg.values):
                if key is not None:
                    continue
                if isinstance(value, ast.DictComp):
                    continue  # the per-field comprehension over COMMANDS[command]
                if not isinstance(value, ast.IfExp) or not isinstance(value.test, ast.Compare):
                    raise ExtractError("websocket.py: _command_handler extra key changed shape")
                test = value.test
                if not (isinstance(test.left, ast.Name) and test.left.id == "command" and len(test.ops) == 1):
                    raise ExtractError("websocket.py: _command_handler extra key test changed shape")
                target = evaluate(test.comparators[0], ws.scope)
                names = {target} if isinstance(test.ops[0], ast.Eq) else set(target)
                body: dict[str, Any] = {}
                if not isinstance(value.body, ast.Dict):
                    raise ExtractError("websocket.py: _command_handler extra body changed shape")
                for k, v in zip(value.body.keys, value.body.values):
                    if not (isinstance(k, ast.Call) and isinstance(k.func, ast.Attribute) and k.func.attr == "Optional"):
                        raise ExtractError("websocket.py: a conditional extra key is not vol.Optional")
                    default = next((evaluate(kw.value, ws.scope) for kw in k.keywords if kw.arg == "default"), None)
                    body[evaluate(k.args[0], ws.scope)] = (evaluate(v, ws.scope), default, any(kw.arg == "default" for kw in k.keywords))
                extras.append((names, body))
    return optional, extras


def _prop(kind: Any) -> dict[str, Any]:
    if not isinstance(kind, TypeToken):
        raise ExtractError(f"unsupported field type {kind!r}")
    return {"type": JSON_TYPE[kind.name]}


def _requirements(perm: Module) -> Any:
    """`panel_permissions.requirements(command)` as a pure lookup: the function is a chain of `if command <test>: return X`
    followed by `return None`; any other statement means the extractor must be reviewed."""
    fn = perm.function("requirements")
    rules: list[tuple[str, Any, Any]] = []
    body = [s for s in fn.body if not (isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant))]
    for stmt in body[:-1]:
        if not (isinstance(stmt, ast.If) and not stmt.orelse and len(stmt.body) == 1 and isinstance(stmt.body[0], ast.Return)
                and isinstance(stmt.test, ast.Compare) and isinstance(stmt.test.left, ast.Name) and stmt.test.left.id == "command"
                and len(stmt.test.ops) == 1 and isinstance(stmt.test.ops[0], (ast.In, ast.Eq))):
            raise ExtractError("panel_permissions.requirements changed shape")
        value = stmt.body[0].value
        result = None if value is None else evaluate(value, perm.scope)
        rules.append(("in" if isinstance(stmt.test.ops[0], ast.In) else "eq", evaluate(stmt.test.comparators[0], perm.scope), result))
    last = body[-1]
    if not (isinstance(last, ast.Return) and (last.value is None or (isinstance(last.value, ast.Constant) and last.value.value is None))):
        raise ExtractError("panel_permissions.requirements no longer ends with `return None`")

    def lookup(command: str) -> Any:
        for op, target, result in rules:
            if (op == "eq" and command == target) or (op == "in" and command in target):
                return result
        return None

    return lookup


def build_commands(tree: Tree) -> tuple[dict[str, Any], dict[str, Any]]:
    ws, perm, contract = tree.get("websocket.py"), tree.get("panel_permissions.py"), tree.get("api_contract.py")
    commands: dict[str, dict[str, Any]] = ws.const("COMMANDS")
    read = frozenset(contract.const("READ_COMMANDS"))
    min_client, api_version = contract.const("MIN_CLIENT"), contract.const("API_VERSION")
    optional, extras = _handler_extras(ws)
    requirements = _requirements(perm)
    scoped_station = frozenset(perm.const("SCOPED_STATION_COMMANDS"))
    scoped_common = frozenset(perm.const("SCOPED_COMMON_COMMANDS"))
    field_scoped = frozenset(perm.const("FIELD_SCOPED_STATION_COMMANDS"))
    field_commands = perm.const("FIELD_COMMANDS")
    renewal = tree.get("renewal_portal_api.py")
    personal = frozenset(renewal.const("SELF_COMMANDS"))
    maximum = _size_limits(ws)
    out: dict[str, Any] = {}
    for name in sorted(commands):
        fields = commands[name]
        props: dict[str, Any] = {"id": {"type": "integer"}, "type": {"const": f"hikvision_intercom/{name}"},
                                 "api_contract": {"type": "integer", "minimum": min_client, "maximum": api_version}}
        required = ["id", "type"]
        for key, kind in fields.items():
            props[key] = _prop(kind)
            if key not in optional.get(name, set()):
                required.append(key)
        for names, body in extras:
            if name in names:
                for key, (kind, default, has_default) in body.items():
                    props[key] = {**_prop(kind), **({"default": default} if has_default else {})}
        grants = requirements(name)
        special = None
        if name == "authorization/session":
            special = "active-user session endpoint"
        elif name.startswith("renewal/") or name in personal:
            special = "personal renewal grant may bypass area policy"
        out[name] = {
            "request": {"$schema": SCHEMA_URL, "type": "object", "properties": props, "required": required,
                        "additionalProperties": False, "x-completeness": REQUEST_NOTE},
            "response": {"x-completeness": RESPONSE_NOTE},
            "permission": {
                "alternative_area_grants": None if grants is None else [list(g) for g in grants],
                "administrator_only_by_base_mapping": grants is None and special is None,
                "special_access": special,
                "station_restricted_surface": name in (scoped_common | scoped_station),
                "field_restricted_surface": name in (scoped_common | field_scoped),
                "field_requirement": list(field_commands[name]) if name in field_commands else None,
                "read_command_for_security_guard_and_api_contract": name in read,
            },
            "max_request_bytes": maximum(name),
        }
    errors = build_errors(tree)
    return out, errors


def _size_limits(ws: Module) -> Any:
    """The `maximum = (A if command == X else B if command in {...} else C)` request byte limit in the public handler."""
    for node in ast.walk(ws.tree):
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "maximum" for t in node.targets):
            expr = node.value

            def limit(command: str, expr: ast.AST = expr) -> int:
                return evaluate(expr, {**ws.scope, "command": command})

            limit("overview")
            return limit
    raise ExtractError("websocket.py: request byte limit not found")


def build_errors(tree: Tree) -> dict[str, Any]:
    found: dict[str, list[str]] = {}
    for rel in tree.python_files():
        module = ast.parse((tree.root / rel).read_text(encoding="utf-8"), filename=rel)
        for node in ast.walk(module):
            if not isinstance(node, ast.Call) or not node.args:
                continue
            func = node.func
            name = func.id if isinstance(func, ast.Name) else (func.attr if isinstance(func, ast.Attribute) else "")
            if name in ERROR_CLASSES and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                found.setdefault(node.args[0].value, []).append(f"{COMPONENT}/{rel}:{node.lineno}")
    return {code: {"source_locations": sorted(locs), "retry": "unclassified", "ui": ERROR_UI}
            for code, locs in sorted(found.items())}


# ---------------------------------------------------------------- surface.static.json

def _registered_modules(tree: Tree) -> set[str]:
    out = set()
    for rel in tree.python_files():
        if "async_register_command" in (tree.root / rel).read_text(encoding="utf-8"):
            module = tree.get(rel)
            if any(isinstance(n, ast.Call) and getattr(n.func, "attr", "") == "async_register_command" for n in ast.walk(module.tree)):
                out.add(rel)
    return out


def _appended_capabilities(ws: Module) -> list[str]:
    """`data["api"]["capabilities"].append("<name>")` in the overview: capabilities published only when a registry is live."""
    out = []
    for node in ast.walk(ws.tree):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "append" and node.args
                and isinstance(node.args[0], ast.Constant) and isinstance(node.func.value, ast.Subscript)
                and isinstance(node.func.value.slice, ast.Constant) and node.func.value.slice.value == "capabilities"):
            out.append(node.args[0].value)
    return sorted(set(out))


def _candidate_capabilities(tree: Tree) -> tuple[list[str], list[str]]:
    preview = tree.get("arx_preview_features.py")
    fn = preview.function("capabilities")
    ret = fn.body[-1]
    if not isinstance(ret, ast.Return) or ret.value is None:
        raise ExtractError("arx_preview_features.capabilities changed shape")
    caps = list(evaluate(ret.value, preview.scope))
    published = preview.function("published")
    del published  # its rule (CANDIDATE_READS filtered by enabled()) is applied below
    disabled = sorted(c for c in preview.const("CANDIDATE_READS") if not _candidate_enabled(preview, c))
    return caps, disabled


def _candidate_enabled(preview: Module, command: str) -> bool:
    if command in {preview.const("PERSON_READBACK"), preview.const("PERSON_READBACK_V2")}:
        return preview.const("ARX_PERSON_READBACK_V1") is True
    if command == preview.const("SCHEDULE_NORMALIZE"):
        return preview.const("ARX_SCHEDULE_NORMALIZE_V1") is True
    return False


def build_surface(tree: Tree, commands: dict[str, Any]) -> dict[str, Any]:
    manifest = json.loads((tree.root / "manifest.json").read_text(encoding="utf-8"))
    const = tree.get("const.py")
    contract = tree.get("api_contract.py")
    ws = tree.get("websocket.py")
    live = _registered_modules(tree)
    unknown = sorted(live - set(REGISTRIES))
    if unknown:
        raise ExtractError(f"registry modules this extractor does not know: {unknown} (extend REGISTRIES and review)")
    missing = sorted(set(REGISTRIES) - live)
    registries: dict[str, Any] = {}
    for rel, spec in sorted(REGISTRIES.items()):
        if rel in missing:
            registries[spec["group"]] = {"module": rel, "commands": [], "note": "module no longer registers commands"}
            continue
        module = tree.get(spec.get("from", rel))
        names = module.expr(spec["names"])
        names = list(names.keys()) if isinstance(names, dict) else list(names)
        text = tree.get(rel).text
        for needle in spec.get("verify", ()):
            if needle not in text:
                raise ExtractError(f"{rel}: expected literal {needle!r} not found - the loop registration changed")
        registries[spec["group"]] = {"module": f"{COMPONENT}/{rel}", "commands": sorted(names)}
    direct = tree.get(DIRECT_ONLY[0])
    direct_only = sorted(direct.const(DIRECT_ONLY[1]))
    static_caps = list(contract.const("CAPABILITIES"))
    candidate_caps, disabled_candidates = _candidate_capabilities(tree)
    conditional = _appended_capabilities(ws)
    public = sorted(c for c in commands if c not in disabled_candidates)
    reg = {k: v["commands"] for k, v in registries.items()}
    # `websocket.overview` (rc.10): admin -> public + template v1 (whatsapp/send allowed) + features + peer;
    # paired bridge (`bridge_full_scope`) adds template v2, resume, installation, W10 media, name refs, tts, subscribe, capture,
    # peer writes. The direct transport lists its own registered handlers plus the direct-only reads.
    admin = sorted(set(public) | set(reg["template_v1"]) | set(reg["features"]) | set(reg["peer"]))
    bridge = sorted(set(admin) | set(reg["template_v2"]) | set(reg["event_resume"]) | set(reg["installation"])
                    | set(reg["station_media_w10"]) | set(reg["name_references"]) | set(reg["tts"]) | {"subscribe"}
                    | set(reg["capture"]) | set(reg["peer_writes"]))
    direct_names = sorted(set(commands) | set(reg["template_v1"]) | set(reg["event_resume"]) | set(reg["installation"])
                          | set(reg["relay_map"]) | set(reg["features"]) | set(reg["tts"]) | {"subscribe"}
                          | set(reg["name_references"]) | set(reg["peer"]) | set(reg["station_media_w10"])
                          | set(reg["template_v2"]) | set(reg["capture"]) | set(reg["peer_writes"])
                          | set(reg["service_write_status"]) | set(direct_only))
    caps_admin = sorted(set(static_caps) | set(candidate_caps) | set(conditional))
    services = _services(tree)
    entities = _entities(tree)
    return {
        "domain": manifest.get("domain"),
        "manifest_version": manifest.get("version"),
        "const_version": const.scope.get("VERSION"),
        "api": {
            "version": contract.const("API_VERSION"),
            "min_client": contract.const("MIN_CLIENT"),
            "capabilities_static": sorted(static_caps),
            "capabilities_candidate": sorted(candidate_caps),
            "capabilities_conditional": conditional,
            "candidate_reads_disabled": disabled_candidates,
            "read_commands": sorted(contract.const("READ_COMMANDS")),
        },
        "registries": registries,
        "direct_only_reads": direct_only,
        "overview_api_projection": {
            "note": ("static model of websocket.overview: every registry registered, every permission granted; the live "
                     "count also depends on which registrations succeeded and on whatsapp/send permission"),
            "administrator": {"commands": admin, "count": len(admin), "capabilities_count": len(caps_admin)},
            "paired_bridge_full_scope": {"commands": bridge, "count": len(bridge)},
            "direct_socket": {"commands": direct_names, "count": len(direct_names),
                              "note": "direct/capabilities: registered handlers + direct-only reads (direct_bridge_api._registered_handlers)"},
        },
        "ha_services": services,
        "entities": entities,
        "bus_events": _bus_events(tree),
        "shapes": _shapes(tree),
    }


# ---------------------------------------------------------------- response / parameter shapes Arx reads closed

def _function_scope(tree: Tree, module: Module, fn: ast.AST, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    """The module scope plus the constants of the function's own `from .x import A` statements (lazy imports)."""
    scope = dict(module.scope)
    for node in ast.walk(fn):
        if isinstance(node, ast.ImportFrom) and node.level >= 1 and node.module:
            target = _relative(module.rel, node.module, node.level)
            if target and tree.exists(target):
                other = tree.get(target)
                for alias in node.names:
                    if alias.name in other.scope:
                        scope[alias.asname or alias.name] = other.scope[alias.name]
    scope.update(extra or {})
    return scope


def _dict_shape(node: ast.Dict, scope: dict[str, Any]) -> dict[str, Any]:
    """Keys of a dict literal; a value that evaluates to a constant is kept, a nested dict literal recurses, else None."""
    out: dict[str, Any] = {}
    for key, value in zip(node.keys, node.values):
        if key is None:
            continue
        name = evaluate(key, scope)
        if isinstance(value, ast.Dict):
            out[name] = _dict_shape(value, scope)
            continue
        try:
            got = evaluate(value, scope)
        except (_Unknown, TypeError, KeyError, IndexError, ValueError):
            got = None
        out[name] = sorted(got) if isinstance(got, frozenset) else (list(got) if isinstance(got, tuple) else got)
    return out


def _returned_dict(fn: ast.AST, name: str | None = None) -> ast.Dict:
    for node in ast.walk(fn):
        if (name and isinstance(node, ast.Assign) and isinstance(node.value, ast.Dict)
                and any(isinstance(t, ast.Name) and t.id == name for t in node.targets)):
            return node.value
        if not name and isinstance(node, ast.Return) and isinstance(node.value, ast.Dict):
            return node.value
    raise ExtractError(f"no returned dict ({name or 'return'}) in {getattr(fn, 'name', '?')}")


def _param_sets(fn: ast.AST, scope: dict[str, Any]) -> list[dict[str, Any]]:
    """`set(parameters) != {...}` and `set(parameters) - {...} != {...}` checks inside one function."""
    found = []
    for node in ast.walk(fn):
        if not (isinstance(node, ast.Compare) and len(node.ops) == 1 and isinstance(node.ops[0], ast.NotEq)):
            continue
        left, right = node.left, node.comparators[0]
        optional: Any = frozenset()
        if isinstance(left, ast.BinOp) and isinstance(left.op, ast.Sub):
            optional = evaluate(left.right, scope)
            left = left.left
        if (isinstance(left, ast.Call) and isinstance(left.func, ast.Name) and left.func.id == "set" and left.args
                and isinstance(left.args[0], ast.Name) and left.args[0].id == "parameters" and isinstance(right, ast.Set)):
            found.append({"required": sorted(evaluate(right, scope)), "optional": sorted(optional)})
    return found


def _shapes(tree: Tree) -> dict[str, Any]:
    out: dict[str, Any] = {}
    # direct discovery (direct/capabilities v1 and direct/time)
    disc = tree.get("direct_bridge_discovery.py")
    cap_fn = disc.function("capabilities")
    scope = _function_scope(tree, disc, cap_fn, {"version": 1})
    shape = _dict_shape(_returned_dict(cap_fn, "result"), scope)
    for block in ("limits", "resources", "business_contracts"):
        if isinstance(shape.get(block), dict):
            shape[block] = sorted(shape[block])
    v2_keys = sorted({t.slice.value for t in ast.walk(cap_fn) if isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name)
                      and t.value.id == "result" and isinstance(t.slice, ast.Constant) and isinstance(t.ctx, ast.Store)})
    command_entry = station_entry = None
    for node in ast.walk(cap_fn):
        if isinstance(node, ast.Call) and getattr(node.func, "attr", "") == "append" and node.args and isinstance(node.args[0], ast.Dict):
            keys = sorted(evaluate(k, scope) for k in node.args[0].keys if k is not None)
            if "envelope" in keys:
                command_entry = keys
            elif "station_id" in keys:
                station_entry = keys
    time_fn = disc.function("server_time")
    time_keys = sorted(_dict_shape(_returned_dict(time_fn), _function_scope(tree, disc, time_fn)))
    out["direct_capabilities_v1"] = {"document": shape, "top_level_keys": sorted(shape), "v2_only_keys": v2_keys,
                                     "command_entry_keys": command_entry, "station_entry_keys": station_entry}
    if command_entry is None or station_entry is None:
        raise ExtractError("direct_bridge_discovery.capabilities: command / station entry not found")
    out["direct_time"] = {"keys": time_keys}
    # W10 station media (signed bridge parameters, descriptor, events)
    runtime = tree.get("station_media_runtime.py")
    api = tree.get("station_media_api.py")
    params: dict[str, Any] = {}
    for fn_name, command in (("descriptor", "media/station_descriptor"), ("stream", "media/stream_lease"), ("open", "media/talk_open")):
        sets = _param_sets(runtime.function(fn_name), runtime.scope)
        if len(sets) != 1:
            raise ExtractError(f"station_media_runtime.{fn_name}: expected one parameter key check, found {len(sets)}")
        params[command] = sets[0]
    for node in ast.walk(api.tree):
        if isinstance(node, ast.Dict) and node.keys and all(isinstance(k, ast.Constant) and str(k.value).startswith("media/") for k in node.keys):
            for key, value in zip(node.keys, node.values):
                params[key.value] = {"required": sorted(evaluate(value, api.scope)), "optional": []}
    if set(params) != {"media/station_descriptor", "media/stream_lease", "media/talk_open", "media/talk_frame", "media/talk_floor", "media/talk_close"}:
        raise ExtractError(f"W10 parameter checks changed: {sorted(params)}")
    actor = None
    for node in ast.walk(runtime.function("_actor")):
        if isinstance(node, ast.Compare) and isinstance(node.comparators[0], ast.Set):
            actor = sorted(evaluate(node.comparators[0], runtime.scope))
    desc_fn = runtime.function("descriptor")
    descriptor = _dict_shape(_returned_dict(desc_fn), _function_scope(tree, runtime, desc_fn))
    out["station_media_w10"] = {
        "schema": runtime.const("SCHEMA"),
        "listen_schema": runtime.const("LISTEN_SCHEMA"),
        "listen_transport": runtime.const("LISTEN_TRANSPORT"),
        "talk_close_reasons": sorted(runtime.const("CALLER_REASONS")),
        "idle_seconds": runtime.const("IDLE_SECONDS"),
        "parameters": dict(sorted(params.items())),
        "actor_keys": actor,
        "descriptor_keys": {"top": sorted(descriptor), "audio": sorted(descriptor.get("audio") or {}),
                            "limits": sorted(descriptor.get("limits") or {})},
        "events": _w10_events(runtime),
    }
    # the HA-authenticated Core runtime observation (installation/core_runtime_v1)
    core = tree.get("core_runtime_observation.py")
    inspect_fn = core.function("inspect")
    module_keys = None
    for node in ast.walk(inspect_fn):
        if isinstance(node, ast.Dict) and any(isinstance(k, ast.Constant) and k.value == "native_image_attestation" for k in node.keys):
            module_keys = sorted(k.value for k in node.keys if isinstance(k, ast.Constant))
    # the signed media-ingress body on the direct media HTTP path (features/media_ingress_v1; not a WebSocket command)
    ingress = tree.get("arx_media_ingress.py")
    ingress_keys = None
    for node in ast.walk(ingress.tree):
        if (isinstance(node, ast.Compare) and len(node.ops) == 1 and isinstance(node.ops[0], ast.NotEq)
                and isinstance(node.left, ast.Attribute) and node.left.attr == "parameters" and isinstance(node.comparators[0], ast.Dict)):
            ingress_keys = sorted(k.value for k in node.comparators[0].keys if isinstance(k, ast.Constant))
    if ingress_keys is None or "features/media_ingress_v1" not in ingress.text:
        raise ExtractError("arx_media_ingress.py: the signed ingress parameter check changed")
    out["media_ingress_v1"] = {"command": "features/media_ingress_v1", "parameters": ingress_keys}
    out["core_runtime_v1"] = {"contract": core.scope.get("CONTRACT"),
                              "observation_keys": sorted(_dict_shape(_returned_dict(inspect_fn), core.scope)),
                              "module_keys": module_keys}
    return out


def _w10_events(runtime: Module) -> dict[str, Any]:
    """The `media/*` event dicts the talk publishes and every literal reason a talk can close with."""
    events: dict[str, Any] = {}
    reasons: set[str] = set()
    for node in ast.walk(runtime.tree):
        if isinstance(node, ast.Dict):
            keys = [k.value for k in node.keys if isinstance(k, ast.Constant)]
            if "type" in keys:
                kind = node.values[keys.index("type")]
                if isinstance(kind, ast.Constant) and str(kind.value).startswith("media/"):
                    events[kind.value] = sorted(keys)
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "reason" for t in node.targets):
            reasons |= _reason_values(node.value)
    return {"keys": dict(sorted(events.items())), "talk_closed_reasons": sorted(reasons)}


def _reason_values(node: ast.AST) -> set[str]:
    """The string results of `reason = <const>` / `<a if test else b>` (the operands of a test are not results)."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return {node.value}
    if isinstance(node, ast.IfExp):
        return _reason_values(node.body) | _reason_values(node.orelse)
    return set()


def _services(tree: Tree) -> list[str]:
    path = tree.root / "services.yaml"
    if not path.is_file():
        return []
    return sorted(line.split(":", 1)[0] for line in path.read_text(encoding="utf-8").splitlines()
                  if line and not line[0].isspace() and not line.startswith("#") and line.rstrip().endswith(":"))


def _entities(tree: Tree) -> dict[str, Any]:
    strings = json.loads((tree.root / "strings.json").read_text(encoding="utf-8"))
    out: dict[str, Any] = {"platforms": list(tree.get("const.py").const("PLATFORMS")), "keys": {}}
    for platform, keys in sorted((strings.get("entity") or {}).items()):
        out["keys"][platform] = {key: sorted((spec.get("state") or {}).keys()) for key, spec in sorted(keys.items())}
    events = tree.get("events.py")
    out["access_event_types"] = sorted(events.const("EVENT_TYPES"))
    out["doorbell_event_types"] = ["ring"]
    out["unique_id"] = "<config entry unique_id>_<key>"
    return out


def _bus_events(tree: Tree) -> list[str]:
    out = set()
    for rel in tree.python_files():
        module = tree.get(rel) if "async_fire" in (tree.root / rel).read_text(encoding="utf-8") else None
        if module is None:
            continue
        for node in ast.walk(module.tree):
            if isinstance(node, ast.Call) and getattr(node.func, "attr", "") == "async_fire" and node.args:
                try:
                    out.add(str(evaluate(node.args[0], module.scope)))
                except _Unknown:
                    out.add(f"<dynamic in {rel}>")
    return sorted(out)


# ---------------------------------------------------------------- output

def _dump(path: Path, doc: Any) -> str:
    data = (json.dumps(doc, indent=2, ensure_ascii=False, sort_keys=False) + "\n").encode("utf-8")
    path.write_bytes(data)
    return hashlib.sha256(data).hexdigest()


def extract(component: Path, out: Path, *, ref: str | None, commit: str | None, catalogs_only: bool = False) -> dict[str, Any]:
    """Write the catalogs (and, unless `catalogs_only`, the surface) of one component tree. `catalogs_only` serves trees older than
    the surface this extractor knows (rc.37 has no direct transport): only the two rc.37-format catalogs are written."""
    tree = Tree(component)
    commands, errors = build_commands(tree)
    version = json.loads((component / "manifest.json").read_text(encoding="utf-8")).get("version")
    surface = None if catalogs_only else build_surface(tree, commands)
    if surface is not None and surface["const_version"] != version:
        raise ExtractError(f"manifest version {version} differs from const.VERSION {surface['const_version']}")
    out.mkdir(parents=True, exist_ok=True)
    sha = {
        "commands.static.json": _dump(out / "commands.static.json", {"version": version, "count": len(commands), "warning": WARNING, "commands": commands}),
        "errors.static.json": _dump(out / "errors.static.json", {"version": version, "count": len(errors), "warning": WARNING, "errors": errors}),
    }
    if surface is not None:
        sha["surface.static.json"] = _dump(out / "surface.static.json", {"version": version, "warning": WARNING, **surface})
    licence = component / "LICENSE"  # WisKey's own licence file (MIT), copied byte for byte next to the facts derived from its source
    if licence.is_file():
        (out / "LICENSE").write_bytes(licence.read_bytes())
        sha["LICENSE"] = hashlib.sha256(licence.read_bytes()).hexdigest()
    pin = {
        "pin": f"rc-extract-{version}",
        "provider": "WisKey (hikvision_intercom)",
        "runtime_version": version,
        "source_ref": ref,
        "source_commit": commit,
        "extracted_by": f"scripts/wiskey_rc_extract.py v{EXTRACTOR_VERSION} (static ast parse, no import, no device)",
        "files": {
            "commands.static.json": {"sha256": sha["commands.static.json"], "count": len(commands)},
            "errors.static.json": {"sha256": sha["errors.static.json"], "count": len(errors)},
            **({"surface.static.json": {"sha256": sha["surface.static.json"]}} if surface is not None else {}),
            **({"LICENSE": {"sha256": sha["LICENSE"]}} if "LICENSE" in sha else {}),
        },
    }
    _dump(out / "PIN.json", pin)
    return pin


def _component(path: Path) -> Path:
    for candidate in (path, path / COMPONENT):
        if (candidate / "manifest.json").is_file() and (candidate / "websocket.py").is_file():
            return candidate
    raise ExtractError(f"{path}: not a hikvision_intercom component or checkout")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--source", type=Path, help="a WisKey checkout or the component folder")
    source.add_argument("--git", type=Path, help="a WisKey git repository (read with git archive, never written)")
    parser.add_argument("--ref", help="with --git: the ref to read (branch, tag or commit)")
    parser.add_argument("--out", type=Path, required=True, help="the catalog folder to write")
    parser.add_argument("--catalogs-only", action="store_true", help="write only the two rc.37-format catalogs (for trees older than rc.4)")
    args = parser.parse_args(argv)
    try:
        if args.git is not None:
            if not args.ref:
                parser.error("--git needs --ref")
            commit = subprocess.run(["git", "-C", str(args.git), "rev-parse", f"{args.ref}^{{commit}}"], check=True,
                                    capture_output=True, text=True).stdout.strip()
            blob = subprocess.run(["git", "-C", str(args.git), "archive", "--format=tar", commit, COMPONENT], check=True,
                                  capture_output=True).stdout
            with tempfile.TemporaryDirectory() as tmp:
                with tarfile.open(fileobj=io.BytesIO(blob)) as tar:
                    members = [m for m in tar.getmembers() if m.isfile() and m.name.startswith(COMPONENT + "/") and ".." not in m.name]
                    tar.extractall(tmp, members=members, filter="data")  # members filtered: regular files under the component only
                pin = extract(_component(Path(tmp)), args.out, ref=args.ref, commit=commit, catalogs_only=args.catalogs_only)
        else:
            pin = extract(_component(args.source), args.out, ref=None, commit=None, catalogs_only=args.catalogs_only)
    except (ExtractError, subprocess.CalledProcessError, OSError, SyntaxError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3
    print(json.dumps(pin, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
