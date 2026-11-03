"""Selected conflict rows without broad repository serializers or error text.

Explicit Arx row/field views select one bound station. This candidate remains
explicit: raw classic last_error is not a safe error envelope. Only known
public literals can pass; unknown text becomes null. No body is copied/logged.
"""
from dataclasses import dataclass

from .adapters import EngineContext, closed
from .envelope import freeze, thaw
from .jobs import same_parameters
from .producer import PUBLIC_ERRORS
from .validation import Refusal, Schema, reference, public_diagnostic_schema

STATES = ['synced', 'pending', 'syncing', 'offline', 'conflict', 'error', 'delete_pending']
PERSON = closed({'id': {'type': 'string', 'format': 'uuid'},
    'display_name': {'type': ['string', 'null'], 'minLength': 1, 'maxLength': 32},
    'employee_no': {'type': ['string', 'null'], 'minLength': 1, 'maxLength': 32}})
ROW = closed({'kind': {'enum': ['user', 'tombstone', 'revocation']},
    'station_id': {'type': 'string', 'minLength': 1, 'maxLength': 128},
    'sync_state': {'enum': STATES}, 'last_error': public_diagnostic_schema(), 'person': PERSON})
RESULT = closed({'rows': {'type': 'array', 'items': ROW, 'maxItems': 5000}})


@dataclass(frozen=True, repr=False)
class ConflictView:
    reference: str
    permission_revision: int
    selection_revision: str
    station_id: str
    rows: tuple
    fields: frozenset


class SelectedConflicts:
    def __init__(self, *, current_state, fresh_view, current_mapping):
        if not all(callable(value) for value in (current_state, fresh_view, current_mapping)):
            raise ValueError('explicit repository metadata and Arx view required')
        self.state, self.view, self.mapping = current_state, fresh_view, current_mapping

    def project(self, state, view):
        if type(state) is not dict: raise Refusal('binding_denied')
        users, tombs, bindings = (state[name] for name in ('users', 'tombstones', 'bindings'))
        if any(type(value) is not dict for value in (users, tombs, bindings)): raise Refusal('binding_denied')
        rows = []; owners = []
        uuid = Schema({'type': 'string', 'format': 'uuid'})
        for kind, uid in view.rows:
            uuid(uid)
            if kind == 'user':
                raw = users.get(uid)
                if type(raw) is not dict or raw['id'] != uid or type(raw['assignments']) is not dict: raise Refusal('binding_denied')
                assignment = raw['assignments'].get(view.station_id)
                if assignment is None: continue
                if type(assignment) is not dict: raise Refusal('binding_denied')
                if assignment['sync_state'] not in {'conflict', 'error'}: continue
                person = raw; node = assignment; revision = raw['revision']
            elif kind == 'tombstone':
                raw = tombs.get(uid)
                if type(raw) is not dict or raw['user_id'] != uid or type(raw['stations']) is not dict: raise Refusal('binding_denied')
                node = raw['stations'].get(view.station_id)
                if node is None: continue
                if type(node) is not dict: raise Refusal('binding_denied')
                # Classic public tombstones expressly exclude the record. Do
                # not reopen that private record to invent a deleted name.
                person = {'id': uid, 'display_name': None, 'employee_no': raw['employee_no'] if 'employee_no' in view.fields else None}
                revision = None
            elif kind == 'revocation':
                raw = users.get(uid)
                if type(raw) is not dict or raw['id'] != uid or type(raw['assignments']) is not dict: raise Refusal('binding_denied')
                station_bindings = bindings.get(view.station_id, {})
                if type(station_bindings) is not dict: raise Refusal('binding_denied')
                node = station_bindings.get(uid)
                if node is None or view.station_id in raw['assignments']: continue
                if type(node) is not dict: raise Refusal('binding_denied')
                person = raw; revision = raw['revision']
            else: raise Refusal('binding_denied')
            if revision is not None and (type(revision) is not int or revision < 1): raise Refusal('binding_denied')
            value = {'id': uid}
            for field in ('display_name', 'employee_no'):
                value[field] = person[field] if field in view.fields else None
            code = None
            if 'errors' in view.fields:
                candidate = node.get('last_error')
                # Compare only with public literal codes; do not format, size,
                # persist, hash or otherwise interpret unknown source text.
                if type(candidate) is str:
                    code = next((known for known in PUBLIC_ERRORS if candidate == known), None)
            row = {'kind': kind, 'station_id': view.station_id, 'sync_state': node.get('sync_state', 'pending'),
                   'last_error': code, 'person': value}
            Schema(ROW)(row); rows.append(row); owners.append((raw, node, revision))
        return {'rows': rows}, owners, (users, tombs, bindings)

    async def read(self, params, context):
        if type(context) is not EngineContext or context.request.get('action') != 'conflicts/list' or not same_parameters(params, {}) or not same_parameters(params, context.parameters): raise Refusal('binding_denied')
        owners = (self.state, self.view, self.mapping); state_for, view_for, mapping = owners
        context.check(); resolved = mapping(context.request); context.check()
        if type(resolved) is not dict or any(type(resolved.get(k)) is not type(v) or resolved.get(k) != v for k, v in thaw(context.request.get('target')).items()): raise Refusal('binding_denied')
        station = reference(resolved.get('config_entry_id')); mapped = freeze(resolved)
        def current():
            context.check()
            if any(a is not b for a, b in zip(owners, (self.state, self.view, self.mapping))) or not same_parameters(mapping(context.request), mapped): raise Refusal('binding_denied')
            context.check()
        async def view():
            current(); value = await context.wait(lambda: view_for(context.request)); current()
            if type(value) is not ConflictView or type(value.permission_revision) is not int or value.permission_revision != context.request.get('operation')['permission_revision'] or value.selection_revision != context.request.get('selection_revision') or value.station_id != station or type(value.rows) is not tuple or len(value.rows) > 5000 or type(value.fields) is not frozenset or not value.fields <= {'display_name', 'employee_no', 'errors'}: raise Refusal('permissions_changed')
            reference(value.reference)
            for item in value.rows:
                if type(item) is not tuple or len(item) != 2 or item[0] not in {'user', 'tombstone', 'revocation'} or type(item[1]) is not str: raise Refusal('binding_denied')
            if len(set(value.rows)) != len(value.rows): raise Refusal('binding_denied')
            return value
        initial = await view(); current(); state = state_for(context.request); current()
        result, bindings, containers = self.project(state, initial); snapshot = freeze(result)
        if await view() != initial: raise Refusal('permissions_changed')
        current()
        if state_for(context.request) is not state: raise Refusal('binding_denied')
        fresh, final_bindings, final_containers = self.project(state, initial)
        if freeze(fresh) != snapshot or len(bindings) != len(final_bindings) or any(a is not b for a, b in zip(containers, final_containers)): raise Refusal('binding_denied')
        if any(a[0] is not b[0] or a[1] is not b[1] or a[2] != b[2] for a, b in zip(bindings, final_bindings)): raise Refusal('binding_denied')
        current(); Schema(RESULT)(fresh); return fresh
