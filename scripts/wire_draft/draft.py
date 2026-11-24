"""Draft a wire module for a router from recorded shapes.

python draft.py <repo> <router module> <shapes dir> [...more dirs]
writes $WIRE_DRAFT_DIR/<router>.py (the wire module) and <router>.map.json ({function: model | "NO_JSON" | "SKIP:<why>"})."""
from __future__ import annotations

import importlib
import json
import keyword
import re
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

repo = Path(sys.argv[1])
name = sys.argv[2]
dirs = [Path(d) for d in sys.argv[3:]]
sys.path.insert(0, str(repo / "smplwise_vms" / "backend"))
OUT = Path(os.environ.get("WIRE_DRAFT_DIR") or (Path(tempfile.gettempdir()) / "wire_draft"))
OUT.mkdir(parents=True, exist_ok=True)

from fastapi.routing import APIRoute, APIRouter  # noqa: E402

shapes: dict[str, dict[str, Any]] = {}


def merge_shape(a: dict | None, b: dict | None) -> dict | None:
    if a is None:
        return b
    if b is None:
        return a
    out = {"n": a["n"] + b["n"], "kinds": dict(a["kinds"])}
    for k, v in b["kinds"].items():
        out["kinds"][k] = out["kinds"].get(k, 0) + v
    strs = list(a.get("strs", []))
    for s in b.get("strs", []):
        if s not in strs and len(strs) < 8:
            strs.append(s)
    if strs:
        out["strs"] = strs
    if "obj" in a or "obj" in b:
        oa, ob = a.get("obj", {"n": 0, "keys": {}}), b.get("obj", {"n": 0, "keys": {}})
        keys = dict(oa["keys"])
        for k, v in ob["keys"].items():
            keys[k] = merge_shape(keys.get(k), v)
        out["obj"] = {"n": oa["n"] + ob["n"], "keys": keys}
    for f in ("list_n", "list_nonempty"):
        if f in a or f in b:
            out[f] = a.get(f, 0) + b.get(f, 0)
    if "items" in a or "items" in b:
        out["items"] = merge_shape(a.get("items"), b.get("items"))
    return out


for d in dirs:
    for f in d.glob("shapes-*.json"):
        for k, v in json.loads(f.read_text(encoding="utf-8")).items():
            if k.startswith("__"):
                continue
            k = re.sub(r"^(\w+) /arx/", r"\1 /", k)
            cur = shapes.get(k)
            if cur is None:
                shapes[k] = v
            else:
                cur["shape"] = merge_shape(cur["shape"], v["shape"])
                cur["annotated"] = cur["annotated"] or v["annotated"]
                cur["ptypes"] = sorted(set(cur.get("ptypes", [])) | set(v.get("ptypes", [])))

mod = importlib.import_module(f"smplwise.routers.{name}")
routes: list[APIRoute] = []
for attr, obj in vars(mod).items():
    if isinstance(obj, APIRouter):
        for r in obj.routes:
            if isinstance(r, APIRoute) and r.endpoint.__module__ == mod.__name__ and r not in routes:
                routes.append(r)


def camel(s: str) -> str:
    return "".join(p[:1].upper() + p[1:] for p in re.split(r"[^A-Za-z0-9]+", s) if p)


def singular(s: str) -> str:
    if s.endswith("ies"):
        return s[:-3] + "y"
    if s.endswith("ses") or s.endswith("xes"):
        return s[:-2]
    if s.endswith("s") and not s.endswith("ss"):
        return s[:-1]
    return s + "Item"


FAMILY = camel(name)
BODIES: dict[str, str] = {}
classes: list[str] = []
class_names: set[str] = set()
ID_KEY = re.compile(r"^([0-9a-f]{8,}|\d+|.*[.:/@ ].*|[0-9a-f-]{36})$", re.I)
PY_IDENT = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")
SHADOW = {"json", "dict", "copy", "schema", "construct", "validate", "parse_obj", "parse_raw", "from_orm", "update_forward_refs",
          "schema_json", "parse_file", "model_config", "model_fields", "model_dump", "register"}


def dynamic(o: dict, hint_name: str = "") -> bool:
    keys = list(o["keys"])
    if not keys:
        return True
    idish = sum(1 for k in keys if ID_KEY.match(k) or not PY_IDENT.match(k))
    if idish * 2 > len(keys):
        return True
    if len(keys) > 60:
        return True
    if hint_name.split("|")[-1] in DYNAMIC_NAMES or hint_name.split("|")[-1].startswith(("by_", "per_")):
        return True
    if o["n"] >= 3 and len(keys) >= 3:
        always = sum(1 for v in o["keys"].values() if v["n"] == o["n"])
        kinds = {k for v in o["keys"].values() for k in v["kinds"]}
        if always * 2 < len(keys) and len(kinds - {"null"}) == 1 and not kinds & {"obj", "list"}:
            return True
    return False


DYNAMIC_NAMES = {"attributes", "domains", "counts", "totals", "states", "labels", "names", "flags", "values", "extra", "meta", "params",
                 "arguments", "settings", "options", "config", "headers", "stats", "map", "mapping"}


def unique(base: str) -> str:
    n, i = base, 2
    while n in class_names:
        n, i = f"{base}{i}", i + 1
    class_names.add(n)
    return n


MAX_DEPTH = 4  # objects nested deeper than this are passed through as stored (dict[str, Any])
OPAQUE = {"raw", "draft", "selector", "data", "target", "config", "trigger", "triggers", "condition", "conditions", "action", "actions",
          "sequence", "variables", "document", "doc", "payload", "definition", "snapshot", "fields", "body", "spec", "state_attributes",
          "details", "context", "result", "before", "after", "diff", "changes", "patch", "preview", "template", "blueprint", "input"}
HA_DOMAINS = {"light", "switch", "fan", "climate", "cover", "media_player", "select", "number", "automation", "notify", "scene", "script",
              "sensor", "binary_sensor", "lock", "alarm_control_panel", "camera", "button", "input_boolean", "vacuum", "water_heater"}


def render_type(s: dict | None, hint: str, doc: str | None = None, hint_name: str = "", depth: int = 0) -> str:
    if s is None:
        return "Any"
    kinds = {k for k in s["kinds"] if k != "null"}
    nullable = "null" in s["kinds"]
    if not kinds:
        return "Any"
    parts: list[str] = []
    if "obj" in kinds:
        o = s["obj"]
        if depth >= MAX_DEPTH or hint_name in OPAQUE or HA_DOMAINS.intersection(o["keys"]).__len__() >= 2 or dynamic(o, hint_name):
            vals = None
            for v in o["keys"].values():
                vals = merge_shape(vals, v)
            if (vals is not None and set(vals["kinds"]) - {"null"} and "obj" not in vals["kinds"] and "list" not in vals["kinds"]
                    and hint_name not in DYNAMIC_NAMES and len(set(vals["kinds"])) == 1):
                parts.append(f"dict[str, {render_type(vals, hint + 'Value')}]")
            else:
                parts.append("dict[str, Any]")
        else:
            parts.append(make_class(o, hint, doc, depth))
    if "list" in kinds:
        parts.append(f"list[{render_type(s.get('items'), singular(hint), hint_name=hint_name, depth=depth + 1)}]")
    if "str" in kinds:
        parts.append("str")
    if "int" in kinds and "float" in kinds:
        parts.append("Num")
    elif "float" in kinds:
        parts.append("Num")
    elif "int" in kinds:
        parts.append("Num")  # int vs float never drifts: both are a JSON number (TypeScript: number)
    if "bool" in kinds:
        parts.append("bool")
    if "other" in kinds:
        return "Any"
    if len(parts) > 2 or ("obj" in kinds and len(parts) > 1 and not parts[0].startswith("dict")):
        return "Any"
    t = " | ".join(parts)
    return t + " | None" if nullable else t


def make_class(o: dict, hint: str, doc: str | None = None, depth: int = 0) -> str:
    cname = unique(hint)
    lines = [f"class {cname}(ExactModel):"]
    if doc:
        lines.append(f'    """{doc}"""')
    body: list[str] = []
    for k, v in o["keys"].items():
        req = v["n"] == o["n"]
        t = render_type(v, cname + camel(k), hint_name=k, depth=depth + 1)
        field = k
        alias = None
        if not PY_IDENT.match(k) or keyword.iskeyword(k) or k in SHADOW:
            field = re.sub(r"\W", "_", k).strip("_") + "_"
            if field[0].isdigit():
                field = "f_" + field
            alias = k
        if alias:
            default = "" if req else "None, "
            body.append(f"    {field}: {t} = Field({default}alias={alias!r})" if not req else f"    {field}: {t} = Field(alias={alias!r})")
        else:
            body.append(f"    {field}: {t}" + ("" if req else " = None"))
    if not body:
        body = ["    pass"]
    sig = "\n".join(body)
    if sig in BODIES:
        class_names.discard(cname)
        return BODIES[sig]
    BODIES[sig] = cname
    lines += body
    classes.append("\n".join(lines))
    return cname


import inspect


def rec_missing(full: str, key: str) -> bool:
    return shapes.get(full) is None and shapes.get(key) is None


mapping: dict[str, str] = {}
skipped_keys: list[str] = []
no_json: list[str] = []
unannotated: list[str] = []
unreached: list[str] = []
for r in routes:
    for m in sorted(r.methods - {"HEAD", "OPTIONS"}):
        key = f"{m} {r.path}"
        full = f"{m} /api/v1{r.path}"
        rec = shapes.get(full) or shapes.get(key)
        fn = r.endpoint.__name__
        try:
            src = inspect.getsource(r.endpoint)
        except (OSError, TypeError):
            src = ""
        binary = re.search(r"return\s+(?:\w+\.)?(FileResponse|StreamingResponse|Response|HTMLResponse|RedirectResponse|PlainTextResponse)\(", src)
        rc = getattr(r.response_class, "__name__", "") if not type(r.response_class).__name__ == "DefaultPlaceholder" else ""
        if r.status_code == 204 or rc in ("FileResponse", "StreamingResponse", "HTMLResponse", "PlainTextResponse", "RedirectResponse", "Response") or (
                binary and rec_missing(full, key) and "return {" not in src):
            no_json.append(key)
            mapping[fn] = "NO_JSON"
            continue
        if rec is None:
            unreached.append(key)
            mapping.setdefault(fn, "SKIP:unreached")
            continue
        s = rec["shape"]
        if set(rec.get("ptypes") or ["dict"]) != {"dict"}:
            mapping[fn] = "SKIP:returns " + ",".join(rec.get("ptypes"))
            skipped_keys.append(key)
            continue
        if set(s["kinds"]) != {"obj"}:
            mapping[fn] = "SKIP:top-level " + ",".join(s["kinds"])
            skipped_keys.append(key)
            continue
        para = " ".join((r.endpoint.__doc__ or "").strip().split("\n\n")[0].split())
        m_ = re.match(r"(.{20,}?[.])(\s|$)", para)
        doc = (m_.group(1) if m_ and len(m_.group(1)) <= 240 else para[:240]).replace('"""', "'").replace("\\", "/") or None
        base = FAMILY + camel(re.sub(r"^(get|list|read|api|route|handle)_", "", fn))
        mapping[fn] = make_class(s["obj"], base, doc)
        if not rec["annotated"]:
            unannotated.append(full)

ALL = "\n".join(classes)
text = [
    f'"""Response models of routers/{name}.py (RESPONSE-MODELS-E-2480, code review 07:F8 step 2)."""',
    "from __future__ import annotations",
    "",
    *(["from typing import Any", ""] if re.search(r"\bAny\b", ALL) else []),
    *(["from pydantic import Field", ""] if "Field(" in ALL else []),
    "from . import ExactModel" + (", Num" if re.search(r"\bNum\b", ALL) else ""),
    "",
    "# routes without a JSON body",
    "NO_JSON: frozenset[str] = " + (("frozenset({" + ", ".join(repr(k) for k in sorted(no_json)) + "})") if no_json else "frozenset()"),
    "# JSON routes without a model yet: no test reaches a successful answer (or the answer is not one object); counted by the ratchet",
    "# (scripts/wire_ratchet.py) until they are modelled",
    "UNMODELLED: frozenset[str] = " + (("frozenset({" + ", ".join(repr(k) for k in sorted(unreached + skipped_keys)) + "})") if unreached + skipped_keys else "frozenset()"),
    "",
]
for c in classes:
    text += ["", c, ""]
(OUT / f"{name}.py").write_text("\n".join(text).rstrip() + "\n", encoding="utf-8")
(OUT / f"{name}.map.json").write_text(json.dumps({"map": mapping, "unannotated": unannotated, "unreached": unreached}, indent=1), encoding="utf-8")
print(f"{name}: {sum(1 for v in mapping.values() if not v.startswith(('SKIP', 'NO_JSON')))} modelled, no_json {len(no_json)}, "
      f"unreached {unreached}, skipped {[(k, v) for k, v in mapping.items() if v.startswith('SKIP') and v != 'SKIP:unreached']}, "
      f"unannotated {len(unannotated)}")
