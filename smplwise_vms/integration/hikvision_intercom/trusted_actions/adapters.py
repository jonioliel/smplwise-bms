"""Typed source-bound adapter construction, with no classic proxy or HA import.

Specs are internal development profiles, not amendments to the sealed schemas.
Only explicitly reviewed closed profiles can be composed. A generic engine port
is injected; this module never locates a manager, driver, device or provider.
"""
from __future__ import annotations

from dataclasses import dataclass
import re
import json
from typing import Callable
from collections.abc import Mapping
from types import MappingProxyType

from .envelope import freeze, thaw, freeze_parameters
from .lifetime import shielded_commit,raise_if_cancelling
from .producer import Adapter, _ExecutionGuard
from .validation import Refusal, Schema, reference

_CATALOG_ISSUER = object()
_DEFINITION_ENCODER = json.JSONEncoder(sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False,check_circular=False)


def _definition_text(value):
    # Pure schema-definition binding, not a hash/cache of any runtime value.
    # JSON scalar types remain distinct (True must never equal integer 1).
    # The encoder holds configuration only. encode() allocates fresh local
    # traversal state and reads the current caller-owned tree on every call.
    # Definition cycles still hit the encoder's recursion guard and are
    # normalized to the same refusal below; no object/result memo is needed.
    try:return _DEFINITION_ENCODER.encode(value)
    except (TypeError,ValueError,RecursionError):raise ValueError('schema definition must be JSON') from None


@dataclass(frozen=True, repr=False)
class _CatalogSeal:
    issuer: object
    spec: object
    owners: tuple
    parameters: object
    projection: object


def require_catalog_adapter(action, adapter):
    """Composition checks the reviewed catalog, not a caller's status string.

    This is an internal construction invariant, never signature verification or
    a permission decision. Explicit fake dependencies remain mandatory.
    """
    from .profiles import _catalogue_construction_binding
    seal = adapter.catalog_seal
    construction = _catalogue_construction_binding(action)
    expected = None if construction is None else construction[0]
    if type(seal) is not _CatalogSeal or seal.issuer is not _CATALOG_ISSUER or expected is None or expected.profile_status != 'CLOSED_LOCAL_FAKE':
        raise ValueError('adapter is not a closed catalog construction')
    _,expected_parameters,expected_projection,expected_fields=construction
    spec = seal.spec
    for name in ('action','schema_id','schema_revision','sources','profile_status','selection_revisions'):
        if getattr(spec,name) != getattr(expected,name):raise ValueError('catalog binding differs')
    if spec.output_check is not expected.output_check:raise ValueError('catalog semantic checker differs')
    if _definition_text(spec.parameters) != expected_parameters or _definition_text(spec.projection) != expected_projection:
        raise ValueError('catalog schema differs')
    from .source_bindings import same_identities
    if not same_identities(seal.owners,(adapter.parameters,adapter.output,adapter.delegate,adapter.projector)):
        raise ValueError('catalog receiver replaced')
    if (adapter.request_schema_id != expected.schema_id or adapter.request_schema_revision != expected.schema_revision or
        adapter.profile_status != expected.profile_status or not adapter.with_request or not adapter.with_guard or
        tuple(adapter.selected_fields) != expected_fields or
        _definition_text(adapter.parameters.definition) != seal.parameters or _definition_text(adapter.output.definition) != seal.projection):
        raise ValueError('catalog adapter changed')


def closed(properties, required=None):
    return {"type": "object", "properties": properties,
            "required": list(properties) if required is None else required, "additionalProperties": False}


def project_selected(value, schema, *, _validate_scalars=True):
    """Read only declared paths before serialization; reject unknown branches."""
    if schema is False or type(schema) is not dict:
        raise Refusal("binding_denied")
    kind = schema.get("type")
    if type(kind) is list:
        if value is None and "null" in kind:
            return None
        kinds = [k for k in kind if k != "null"]
        if len(kinds) != 1:
            raise Refusal("binding_denied")
        kind = kinds[0]
    if kind == "object":
        if type(value) is not dict:
            raise Refusal("invalid_fields")
        return {k: project_selected(value[k], child,_validate_scalars=_validate_scalars) for k, child in schema.get("properties", {}).items() if k in value}
    if kind == "array":
        if type(value) is not list or len(value) > schema.get("maxItems", 100000):
            raise Refusal("invalid_fields")
        prefix = schema.get('prefixItems', ())
        return [project_selected(v, prefix[i] if i < len(prefix) else schema.get('items', False),_validate_scalars=_validate_scalars)
                for i, v in enumerate(value)]
    # Standalone selection validates scalars immediately. The internal adapter
    # path validates its detached tree before callbacks or serialization.
    # This subtree is already owned by the adapter/receiver's copied schema.
    # Validate every scalar against its current definition without making a
    # second defensive copy per cell. The validator is new and uncached; its
    # resources match the former Schema(schema) call exactly.
    if _validate_scalars:
        scalar=object.__new__(Schema);scalar.definition=schema;scalar.resources={}
        scalar(value)
    return value


@dataclass(frozen=True)
class SourceRef:
    commit: str
    path: str
    start: int
    end: int
    sha256: str

    def __deepcopy__(self,memo):
        # Frozen public commit/path/range/blob metadata contains no instance
        # state. Schema dictionaries and all runtime objects still get copies.
        return self

    def check(self):
        if re.fullmatch("[a-f0-9]{40}", self.commit) is None or re.fullmatch("[a-f0-9]{64}", self.sha256) is None:
            raise ValueError("full source binding required")
        if not self.path.startswith("custom_components/hikvision_intercom/") or ".." in self.path.split("/"):
            raise ValueError("source path refused")
        if type(self.start) is not int or type(self.end) is not int or not 1 <= self.start <= self.end:
            raise ValueError("source range refused")


@dataclass(frozen=True, repr=False)
class AdapterSpec:
    action: str
    schema_id: str
    schema_revision: str
    parameters: dict
    projection: dict
    sources: tuple[SourceRef, ...]
    output_check: Callable | None = None
    profile_status: str = 'PARTIAL_OFF'
    selection_revisions: frozenset[str] = frozenset({'rev1'})


class EffectTrace:
    """Reached candidate save stages only; not hardware, fsync or no-effect proof."""
    def __init__(self, request):
        self.request_id = request.get("request_id")
        self.operation_id = request.get("operation_id")
        self.stages = []

    def reached(self, stage):
        if stage not in {"save_submitted", "save_completed", "published", "cancelled", "delegate_possible", "delegate_returned"}:
            raise ValueError("unknown effect stage")
        self.stages.append(stage)

    def metadata(self):
        return freeze({"request_id": self.request_id, "operation_id": self.operation_id,
                       "stages": list(self.stages), "effect": "UNKNOWN_EFFECT"})


def _immutable_parameters(value):
    return freeze_parameters(value)


class EngineContext:
    def __init__(self, request, guard, *, parameters=None, epoch=None):
        self._request = request
        self._guard = guard
        self._parameters = None if parameters is None else _immutable_parameters(parameters)
        self._epoch=None if epoch is None else reference(epoch)
        self._identity=(request,guard,self._parameters,self._epoch)
        self._owned_identity=self._identity
        self._creation_identity=self._identity
        self.trace = EffectTrace(request)

    def _check_identity(self):
        expected=getattr(self,'_creation_identity',None)
        if (type(expected) is not tuple or len(expected)!=4 or self._owned_identity is not expected
            or self._identity is not expected or self._request is not expected[0]
            or self._guard is not expected[1] or self._parameters is not expected[2]
            or self._epoch is not expected[3]):raise Refusal('binding_denied')
        return expected

    @classmethod
    def scoped(cls,parent,guard):
        """Fresh guard/trace sharing only an admitted immutable public tree.

        This is scoped ownership within one bound context, not a parameter,
        authority, source instance or result cache. Arbitrary caller mappings
        still pass through the ordinary defensive constructor.
        """
        if cls is not EngineContext or type(parent) is not EngineContext or not callable(guard):raise Refusal('binding_denied')
        expected=EngineContext._check_identity(parent)
        result=object.__new__(cls)
        result._request,result._guard,result._parameters,result._epoch=expected[0],guard,expected[2],expected[3]
        result._identity=(result._request,guard,result._parameters,result._epoch)
        result._owned_identity=result._identity
        result._creation_identity=result._identity
        result.trace=EffectTrace(result._request)
        return result

    @property
    def request(self):return self._request

    @property
    def parameters(self):return self._parameters

    @property
    def epoch(self):return self._epoch

    def check(self):
        expected=EngineContext._check_identity(self)
        allowed=expected[1](expected[0])
        if EngineContext._check_identity(self) is not expected:raise Refusal('binding_denied')
        if allowed is not True:raise Refusal("permission_revision_changed")

    async def wait(self, factory):
        """Factory postpones creating/submitting work until the admission check."""
        self.check();raise_if_cancelling()
        self.trace.reached("delegate_possible")
        result = await factory()
        self.check();raise_if_cancelling()
        self.trace.reached("delegate_returned")
        return result

    async def save(self, save, publish):
        self.check();raise_if_cancelling()
        self.trace.reached("save_submitted")
        async def saving():
            result = await save()
            self.trace.reached("save_completed")
            return result
        def publishing():
            publish()
            self.trace.reached("published")
        result=await shielded_commit(saving,publishing)
        raise_if_cancelling();return result


def build_adapter(spec: AdapterSpec, backend, guard, *, mapping=None, trace_sink=None, require_station_mapping=False):
    """backend.execute(action, immutable_parameters, EngineContext) is explicit.

    The backend must use context.wait at each new asynchronous effect boundary;
    a classic shared worker does not acquire this operation's provenance.
    """
    if type(require_station_mapping) is not bool:raise ValueError('explicit station mapping mode required')
    if type(spec) is not AdapterSpec or not spec.sources:
        raise ValueError("reviewed source bindings required")
    if type(spec.selection_revisions)is not frozenset or not spec.selection_revisions or not spec.selection_revisions<=frozenset({'rev1','rev2'}):raise ValueError('explicit supported selections required')
    supported=spec.selection_revisions
    for source in spec.sources:
        source.check()
    reference(spec.schema_id)
    reference(spec.schema_revision)
    # A current caller-owned tree is serialized before construction, never a
    # request or a previous validation result. For an exact public catalogue
    # definition, decode that literal into a fresh validator tree instead of
    # recursively copying thousands of immutable definition leaves. Modified
    # or non-catalogue definitions retain ordinary defensive copy semantics.
    from .profiles import _catalogue_construction_binding
    construction = _catalogue_construction_binding(spec.action)
    def owned_schema(definition, known, role):
        if known is not None:
            try: current = _definition_text(definition)
            except ValueError: pass
            else:
                if current == known and (role != 2 or tuple(definition.get('properties', {})) == construction[3]):
                    # Canonical comparison sorts keys, but field order also
                    # binds selected_fields. Preserve the current tree's order
                    # in its independent decoded copy.
                    from .profiles import _catalogue_definition_copy
                    owned = object.__new__(Schema)
                    owned.definition = _catalogue_definition_copy(spec.action, role)
                    owned.resources = {}
                    return owned
        return Schema(definition)
    parameters = owned_schema(spec.parameters, None if construction is None else construction[1], 1)
    output = owned_schema(spec.projection, None if construction is None else construction[2], 2)
    parameters.require_closed()
    output.require_closed(projection=True,query_marker=spec.action=='users/query',diagnostic=spec.action in {'overview','conflicts/list'})
    # Freeze definitions by copying; subsequent mutation cannot change admission.
    projection = output.definition
    def project(raw):
        # Select exact paths/types with no callbacks, then validate the whole
        # detached tree before semantic checks. Standalone selectors retain
        # their immediate scalar validation; no rule or final check is skipped.
        value = project_selected(raw, projection,_validate_scalars=False)
        output(value)
        if spec.output_check is not None:spec.output_check(value)
        return value
    async def delegate(params, request, execution_check=None):
        if type(execution_check)is not _ExecutionGuard or execution_check.request is not request or execution_check.bound.parameters is not params or execution_check.bound.epoch!=execution_check.epoch:raise Refusal('binding_denied')
        expected = None
        def current(candidate):
            if candidate is not request or execution_check is None:
                raise Refusal('binding_denied')
            if request.get('selection_revision') not in supported:raise Refusal('binding_denied')
            execution_check()
            allowed=guard(request)
            if allowed is not True:return allowed
            if expected is not None:
                from .jobs import same_parameters
                fresh=mapping(request.get('target')['logical_target_id'])
                if type(fresh) is not dict or not same_parameters(fresh,expected):raise Refusal('binding_denied')
            return True
        context = EngineContext(request, current, parameters=params, epoch=execution_check.epoch)
        # Strict source composition supplies this mapping to every adapter.
        # Legacy explicit component seams without a mapping remain bounded;
        # they cannot supply proof of a station-bound source composition.
        if spec.action in {"stations/test_unlock", "fleet/alerts", "health/get"} or ((require_station_mapping or spec.action=='tts/start') and 'station_id' in parameters.definition.get('properties',{})):
            context.check()
            if mapping is None:
                raise Refusal("binding_denied")
            expected = mapping(request.get("target")["logical_target_id"])
            target=thaw(request.get('target'))
            if type(expected) is not dict or any(type(expected.get(k))is not type(v) or expected.get(k)!=v for k,v in target.items()):
                raise Refusal("binding_denied")
            if type(expected.get('config_entry_id'))is not str or not expected['config_entry_id'] or params.get("station_id") != expected['config_entry_id']:
                raise Refusal("binding_denied")
            if spec.action=='stations/test_unlock' and (expected!=target or params.get('lock')!=expected.get('physical_index')):raise Refusal('binding_denied')
            expected = freeze(expected)
            context.check()
        try:
            result = await context.wait(lambda: backend.execute(spec.action, params, context))
            if spec.action=='fleet/alerts':
                # A narrow target must never consume a fleet-wide report. The
                # injected producer must obtain only this station's source.
                if type(result)is not dict or type(result.get('items'))is not list or any(type(row)is not dict or row.get('station_id')!=params['station_id'] for row in result['items']):raise Refusal('binding_denied')
            return result
        finally:
            if trace_sink is not None:
                try:trace_sink(context.trace.metadata())
                except Exception:pass
    seal = _CatalogSeal(_CATALOG_ISSUER,spec,(parameters,output,delegate,project),_definition_text(parameters.definition),_definition_text(output.definition))
    return Adapter(spec.schema_id, spec.schema_revision, parameters, output, delegate,
                   tuple(projection.get("properties", {})), with_request=True,
                   projector=project,with_guard=True,profile_status=spec.profile_status,catalog_seal=seal)
