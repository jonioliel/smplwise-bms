"""Strict validators. Errors contain public codes, never input values."""
from __future__ import annotations

import json
from copy import deepcopy
from types import MappingProxyType
import math
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID


_SCHEMA_KEYWORDS=frozenset({"$schema", "$id", "$ref", "type", "const", "enum", "properties", "required", "additionalProperties",
                   "items", "prefixItems", "uniqueItems", "minItems", "maxItems", "minLength", "maxLength", "pattern",
                   "format", "minimum", "maximum", "minProperties", "maxProperties", "propertyNames",
                   "allOf", "anyOf", "oneOf", "not", "if", "then", "else", "title", "description", "default"})

# Definition verification only: never instance data, permissions or results.
_CLOSED_DEFINITIONS={}
_DEFINITION_ENCODER=json.JSONEncoder(sort_keys=True,separators=(',',':'),allow_nan=False,check_circular=False)

_JSON_TYPES=MappingProxyType({"object":dict,"array":list,"string":str,"integer":int,"boolean":bool,"null":type(None)})
_CONTROL_CHARACTERS=re.compile('[\x00-\x1f]')
_PATTERN_DEFINITIONS={}


def _pattern_search(pattern,value):
    # Public schema regex definitions only, like re's own compilation cache.
    # Each instance is searched afresh; values/results/authority are not kept.
    if type(pattern) is not str:return re.search(pattern,value)
    compiled=_PATTERN_DEFINITIONS.get(pattern)
    if compiled is None:
        compiled=re.compile(pattern)
        if len(_PATTERN_DEFINITIONS)>=512:_PATTERN_DEFINITIONS.clear()
        _PATTERN_DEFINITIONS[pattern]=compiled
    return compiled.search(value)

class Refusal(Exception):
    def __init__(self, code: str = "invalid_fields", field: str | None = None):
        super().__init__(code)
        self.code = code
        self.field = field


def public_diagnostic_schema():
    """Exact existing public literals only, never a free-text diagnostic body.

    This is an internal projection constraint. It changes no envelope enum,
    authority rule or frozen DTO. Unknown source text becomes null upstream.
    """
    from .producer import PUBLIC_ERRORS
    return {'type':['string','null'],'enum':[None,*sorted(PUBLIC_ERRORS)]}


def aware(value: object) -> datetime:
    if type(value) is not str:
        raise Refusal()
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError
        return parsed.astimezone(UTC)
    except (ValueError, OverflowError):
        raise Refusal() from None


def reference(value: object) -> str:
    if type(value) is not str or not 1 <= len(value) <= 128 or _CONTROL_CHARACTERS.search(value) is not None:
        raise Refusal()
    try:value.encode('utf-8',errors='strict')
    except UnicodeError:raise Refusal() from None
    return value


def integer(value: object, minimum: int = 0, maximum: int | None = None) -> int:
    if type(value) is not int or value < minimum or maximum is not None and value > maximum:
        raise Refusal()
    return value


def strict_json(encoded: str | bytes, limit: int = 1048576) -> dict:
    try:
        if type(encoded) is bytes:
            if len(encoded) > limit:
                raise Refusal()
            encoded = encoded.decode("utf-8", errors="strict")
        if type(encoded) is not str or len(encoded.encode("utf-8")) > limit or encoded.startswith("\ufeff"):
            raise Refusal()
        def pairs(items):
            result = {}
            for key, value in items:
                if key in result:
                    raise Refusal()
                result[key] = value
            return result
        def nonfinite(_):
            raise Refusal()
        result = json.loads(encoded, object_pairs_hook=pairs, parse_constant=nonfinite)
        if type(result) is not dict:
            raise Refusal()
        return result
    except (UnicodeError, ValueError, TypeError, RecursionError):
        raise Refusal() from None


def _copy_schema(value):
    """Fresh definitions with ordinary deepcopy semantics and no state cache."""
    # Schema trees are predominantly exact JSON dict/list/scalar definitions.
    # Avoid deepcopy's dynamic reducer/dispatch machinery for those objects,
    # while preserving aliases/cycles through the same memo and delegating
    # every other Python object to ordinary deepcopy. Nothing is shared across
    # validators; runtime input, authority and action results are never cached.
    memo={}
    immutable=(str,int,float,bool,type(None),bytes)
    def clone(item):
        kind=type(item)
        if kind in immutable:return item
        key=id(item)
        if key in memo:return memo[key]
        if kind is dict:
            result={};memo[key]=result
            for name,child in item.items():result[name if type(name) is str else clone(name)]=clone(child)
            return result
        if kind is list:
            result=[];memo[key]=result;result.extend(clone(child) for child in item);return result
        return deepcopy(item,memo)
    return clone(value)


class Schema:
    """Executable strict subset used by the pinned schemas; not a general JSON Schema library."""

    def __init__(self, definition: dict | bool, resources: dict[str, dict | bool] | None = None):
        self.definition = _copy_schema(definition)
        self.resources = _copy_schema(resources) if resources else {}

    @classmethod
    def from_resource(cls,name):
        # resource() verifies current whole bytes and freshly decodes an owned
        # definition. No caller holds that fresh tree, so a second deepcopy is
        # unnecessary. Every validator still gets its own mutable definition.
        value=object.__new__(cls);value.definition=resource(name);value.resources={}
        return value

    @classmethod
    def from_json(cls,text,*,resources_text=None):
        """Own a freshly decoded public schema, with no second tree copy.

        This prepares definitions only. Every call decodes an independent
        tree; instance validation and definition closure checks are unchanged.
        """
        if type(text) is not str:raise TypeError('schema text required')
        if resources_text is not None and type(resources_text) is not str:raise TypeError('resource definition text required')
        value=object.__new__(cls);value.definition=json.loads(text);value.resources={} if resources_text is None else json.loads(resources_text)
        return value

    def __call__(self, instance: object) -> None:
        self._validate(self.definition, instance)

    def require_closed(self, *, projection=False, query_marker=False, diagnostic=False):
        forbidden = {"pin", "pin_configured", "created_at", "last_sync_at", "last_error", "stale", "card_no", "api_key"}
        if type(query_marker)is not bool or (query_marker and not projection):raise ValueError('invalid query marker policy')
        if type(diagnostic)is not bool or (diagnostic and not projection):raise ValueError('invalid diagnostic projection constraint')
        cache_key=None
        if type(projection)is bool:
            try:
                cache_key=(_DEFINITION_ENCODER.encode(self.definition),
                           _DEFINITION_ENCODER.encode(self.resources),
                           projection,query_marker,diagnostic,
                           json.dumps(public_diagnostic_schema(),sort_keys=True) if diagnostic else None)
            except (TypeError,ValueError,RecursionError):pass
        if cache_key is not None and cache_key in _CLOSED_DEFINITIONS:return
        visiting=set()
        def visit(s, inherited=None, root=True):
            if s is False:
                return
            if s is True or type(s) is not dict:
                raise ValueError("unclosed schema")
            effective=s.get('type', inherited)
            types = effective if type(effective) is list else [effective]
            if "object" in types:
                additional=s.get('additionalProperties',False if inherited=='object' else None)
                if additional is not False:
                    # A request map must name its key grammar, bound its key
                    # count, and close each value. This never relaxes projection
                    # privacy or permits arbitrary/boolean true schemas.
                    names=s.get('propertyNames')
                    if (projection or type(additional) is not dict or type(s.get('maxProperties')) is not int
                        or not 0<=s['maxProperties']<=100 or type(names) is not dict or names.get('type')!='string'
                        or type(names.get('maxLength')) is not int or not 1<=names['maxLength']<=128):
                        raise ValueError('unclosed object schema')
                    visit(names,root=False);visit(additional,root=False)
                props=s.get("properties", {})
                denied=set(props)&forbidden
                if query_marker and root and props.get('stale')=={'type':'boolean'}:denied.discard('stale')
                if diagnostic and props.get('last_error')==public_diagnostic_schema():denied.discard('last_error')
                if projection and denied:raise ValueError('forbidden projection field')
                for child in props.values():visit(child,root=False)
            if "array" in types:
                visit(s.get("items", True),root=False)
                for child in s.get('prefixItems', ()):visit(child,root=False)
            if not inherited and not any(k in s for k in ["type","const","enum","oneOf","anyOf","allOf","$ref"]):
                raise ValueError("untyped schema")
            for key in ["oneOf","anyOf","allOf"]:
                for child in s.get(key, ()):visit(child,effective,root=root)
            for key in ['if','then','else','not']:
                if key in s:visit(s[key],effective,root=root)
            if "$ref" in s:
                if s["$ref"] not in self.resources:raise ValueError("unresolved schema")
                if s['$ref'] in visiting:raise ValueError('recursive schema not supported')
                visiting.add(s['$ref'])
                visit(self.resources[s["$ref"]],root=root)
                visiting.remove(s['$ref'])
        visit(self.definition)
        if cache_key is not None:
            if len(_CLOSED_DEFINITIONS)>=512:_CLOSED_DEFINITIONS.clear()
            _CLOSED_DEFINITIONS[cache_key]=True

    def _matches(self, schema, instance) -> bool:
        try:
            self._validate(schema, instance)
            return True
        except Refusal:
            return False

    def _validate(self, schema, value):
        value_kind=type(value)
        if schema is False:
            raise Refusal()
        if schema is True:
            return
        if type(schema) is not dict:
            raise Refusal()
        if not _SCHEMA_KEYWORDS.issuperset(schema) and any(key not in _SCHEMA_KEYWORDS and not key.startswith("x-") for key in schema):
            raise Refusal()
        if "$ref" in schema:
            name = schema["$ref"]
            if name not in self.resources:
                raise Refusal()
            self._validate(self.resources[name], value)
        if "const" in schema and (value_kind is not type(schema["const"]) or value != schema["const"]):
            raise Refusal()
        if "enum" in schema:
            for option in schema['enum']:
                if value_kind is type(option) and value==option:break
            else:raise Refusal()
        declared = schema.get("type")
        if declared is not None:
            if type(declared) is str:
                if declared=='number':
                    if not (value_kind is int or value_kind is float and math.isfinite(value)):raise Refusal()
                elif value_kind is not _JSON_TYPES.get(declared):raise Refusal()
            else:
                names=declared if type(declared)is list else [declared]
                for name in names:
                    if (name=='number' and (value_kind is int or value_kind is float and math.isfinite(value))) or value_kind is _JSON_TYPES.get(name):break
                else:raise Refusal()
        if value_kind is float and (not math.isfinite(value) or value<schema.get('minimum',-math.inf) or value>schema.get('maximum',math.inf)):
            raise Refusal()
        elif value_kind is str:
            try:value.encode('utf-8',errors='strict')
            except UnicodeError:raise Refusal() from None
            if not schema.get("minLength", 0) <= len(value) <= schema.get("maxLength", math.inf):
                raise Refusal()
            if "pattern" in schema and _pattern_search(schema["pattern"], value) is None:
                raise Refusal()
            if schema.get("format") == "date-time":
                aware(value)
            if schema.get("format") == "uuid":
                try:
                    if str(UUID(value)) != value:
                        raise ValueError
                except ValueError:
                    raise Refusal() from None
        elif value_kind is int:
            integer(value, schema.get("minimum", -2**63), schema.get("maximum"))
        elif value_kind is list:
            if not schema.get("minItems", 0) <= len(value) <= schema.get("maxItems", math.inf):
                raise Refusal()
            if schema.get("uniqueItems") and any(value[i] == value[j] for i in range(len(value)) for j in range(i)):
                raise Refusal()
            for i, item in enumerate(value):
                prefix = schema.get("prefixItems", ())
                self._validate(prefix[i] if i < len(prefix) else schema.get("items", True), item)
        elif value_kind is dict:
            if not schema.get("minProperties", 0) <= len(value) <= schema.get("maxProperties", math.inf):
                raise Refusal()
            properties = schema.get("properties", {})
            if not set(schema.get("required", ())) <= value.keys():
                raise Refusal()
            for key, item in value.items():
                if 'propertyNames' in schema:self._validate(schema['propertyNames'], key)
                if key in properties:
                    self._validate(properties[key], item)
                else:
                    self._validate(schema.get("additionalProperties", True), item)
        for s in schema.get("allOf", ()):
            self._validate(s, value)
        if "oneOf" in schema and sum(self._matches(s, value) for s in schema["oneOf"]) != 1:
            raise Refusal()
        if "anyOf" in schema and not any(self._matches(s, value) for s in schema["anyOf"]):
            raise Refusal()
        if "not" in schema and self._matches(schema["not"], value):
            raise Refusal()
        if "if" in schema:
            branch = "then" if self._matches(schema["if"], value) else "else"
            self._validate(schema.get(branch, True), value)


_RESOURCE_DEFINITIONS={}

def _resource_decode(raw):
    """Verified current public bytes -> immutable literal code -> fresh tree.

    Only strict JSON definition literals are compiled; no calls/imports or
    runtime inputs are compiled. Each eval builds fresh dict/list containers.
    Immutable strings/numbers/code may be reused, never permissions/results.
    """
    code=_RESOURCE_DEFINITIONS.get(raw)
    if code is None:
        definition=strict_json(raw)
        code=compile(repr(definition),'<wiskey-public-resource-definition>','eval',dont_inherit=True)
        if len(_RESOURCE_DEFINITIONS)>=128:_RESOURCE_DEFINITIONS.clear()
        _RESOURCE_DEFINITIONS[raw]=code
    return eval(code,{'__builtins__':{}},{})


def resources() -> dict[str, dict]:
    directory = Path(__file__).with_name('resources')
    return {p.name:_resource_decode(p.read_bytes()) for p in directory.glob('*.json')}


def resource(name: str) -> dict:
    """Fresh schema from currently read whole bytes; internal literal names."""
    if type(name)is not str or not name.endswith('.json') or '/'in name or '\\'in name or name.startswith('.'):
        raise ValueError('internal resource filename required')
    return _resource_decode(Path(__file__).with_name('resources').joinpath(name).read_bytes())
