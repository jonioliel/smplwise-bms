"""Typed station/editor diagnostics, with no discovery or private feed.

The injected source is an explicit station metadata constructor, never the
classic overview/public serializer. Host, last_access, person counts, values
are not visited. Only known public error literals pass; unknown text becomes
null, which is not proof that no error exists. There is no hardware acceptance.
"""
from dataclasses import dataclass

from .adapters import EngineContext, closed, project_selected
from .envelope import freeze, thaw
from .jobs import same_parameters
from .producer import PUBLIC_ERRORS
from .validation import Refusal, Schema, reference, public_diagnostic_schema

TEXT = {'type': 'string', 'minLength': 1, 'maxLength': 128}
NULL_TEXT = {**TEXT, 'type': ['string', 'null']}
STAMP = {'type': ['string', 'null'], 'format': 'date-time'}
BOOL = {'type': 'boolean'}
COUNT = {'type': 'integer', 'minimum': 0, 'maximum': 1000000}
RULE = {'type': ['array', 'null'], 'minItems': 4, 'maxItems': 4, 'prefixItems': [
    {'type': 'integer', 'minimum': 1, 'maximum': 12}, {'type': 'integer', 'minimum': 1, 'maximum': 5},
    {'type': 'integer', 'minimum': 0, 'maximum': 6}, {'type': 'integer', 'minimum': 0, 'maximum': 86399}], 'items': False}
ZONE = closed({'kind': {'enum': ['iana', 'device']}, 'name': {'type': 'string', 'minLength': 1, 'maxLength': 256},
    'standard': {'type': 'integer', 'minimum': -50400, 'maximum': 50400},
    'delta': {'type': 'integer', 'minimum': 0, 'maximum': 10800}, 'start': RULE, 'end': RULE}, ['kind', 'name'])
ZONE['oneOf'] = [closed({'kind': {'const': 'iana'}, 'name': TEXT}), closed({
    'kind': {'const': 'device'}, 'name': ZONE['properties']['name'], **{k: ZONE['properties'][k] for k in ('standard', 'delta', 'start', 'end')}})]
CAPS = closed({**{k: COUNT for k in ('max_users', 'max_cards', 'cards_per_person', 'pin_min', 'pin_max', 'card_min', 'card_max', 'name_max')},
    'pin_mode': {'enum': ['local', 'platform', 'unknown']}, 'pin_writable': BOOL, 'schedules': {'const': False}})
CLOCK = closed({'source': {'enum': ['manual', 'device', 'fallback']}, 'status': {'enum': ['stale', 'unavailable', 'ready']},
    'zone': ZONE, 'device_zone': {**ZONE, 'type': ['object', 'null'], 'oneOf': [*ZONE['oneOf'], {'type': 'null'}]},
    'skew_seconds': {'type': ['number', 'null']}, 'time_mode': {**NULL_TEXT, 'maxLength': 64},
    'drift_state': {'enum': ['not_measured', 'ahead', 'behind', 'repeated_ahead', 'repeated_behind', 'within_tolerance', 'uncertain']},
    'checked_at': STAMP, 'error': {'enum': [None, 'clock_read_failed']}})
LOCK = closed({'physical_index': {'type': 'integer', 'enum': [1, 2]}, 'name': NULL_TEXT})
BASE = {'id': TEXT, 'name': TEXT, 'online': BOOL, 'last_seen': STAMP,
    'call_state': {'enum': ['idle', 'ringing', 'in_call', 'ending', 'unavailable', 'unknown']},
    'sync_state': {'enum': ['synced', 'pending', 'syncing', 'offline', 'conflict', 'error', 'delete_pending', 'unknown']},
    'lock_enabled': BOOL, 'locks': {'type': 'array', 'maxItems': 2, 'items': LOCK},
    'lock_count': {'type':'integer','minimum':0,'maximum':2},
    'camera_entity': {**NULL_TEXT,'pattern':'^camera\\.[a-z0-9_]+$(?![\\s\\S])'}, 'has_camera': BOOL, 'zone': {**ZONE, 'type': ['object', 'null'], 'oneOf': [*ZONE['oneOf'], {'type': 'null'}]}}
TECH = {'loaded': BOOL, 'model': NULL_TEXT, 'firmware': NULL_TEXT,
    'capabilities': {**CAPS, 'type': ['object', 'null']},
    'clock': {**CLOCK, 'type': ['object', 'null']},
    'event_status': {'type': ['object', 'null'], **{k: v for k, v in closed({
        'stream': TEXT, 'history': TEXT, 'reconnects': COUNT, 'last_frame_at': STAMP, 'recovered_until': STAMP}).items() if k != 'type'}},
    'scanned_at': STAMP, 'scanning': BOOL, 'reconciled_at': STAMP,
    'last_poll_ms': {'type': ['number', 'null'], 'minimum': 0, 'maximum': 120000}}
STATION = closed({**BASE, **TECH, 'last_error': public_diagnostic_schema()}, list(BASE))
API = closed({'version': {'const': 1}, 'min_client': {'const': 0},
    'commands': {'type': 'array', 'maxItems': 246, 'items': TEXT},
    'capabilities': {'type': 'array', 'maxItems': 128, 'items': TEXT}})


def overview_schema(profile_schema):
    return closed({'stations': {'type': 'array', 'maxItems': 1, 'items': STATION},
        'version': TEXT, 'default_zone': ZONE, 'api': API,
        'access': closed({'is_admin': BOOL, 'areas': closed({'users': {'enum': ['none', 'view', 'manage']}}), 'revision': COUNT}),
        'profile_policy': {**profile_schema, 'type': ['object', 'null']}},
        ['stations', 'version', 'default_zone', 'api', 'access'])


@dataclass(frozen=True, repr=False)
class OverviewView:
    reference: str
    permission_revision: int
    selection_revision: str
    station_id: str
    sections: frozenset


@dataclass(frozen=True,repr=False)
class OverviewSourceSnapshot:
    payload:object
    owners:tuple


class OverviewSource:
    """Fresh selected metadata from explicit source owners; no broad serializer."""
    def __init__(self,*,station_for,runtime_for,locks_for,camera_for,metadata_for):
        values=(station_for,runtime_for,locks_for,camera_for,metadata_for)
        if not all(callable(v)for v in values):raise ValueError('explicit station source metadata dependencies required')
        self.station,self.runtime,self.locks,self.camera,self.metadata=values

    def __call__(self,request,station_id,sections):
        providers=(self.station,self.runtime,self.locks,self.camera,self.metadata)
        station_for,runtime_for,locks_for,camera_for,metadata_for=providers
        station=station_for(station_id)
        if station is None or station.id!=station_id:raise Refusal('binding_denied')
        runtime=runtime_for(station_id)
        coordinator=None if runtime is None else runtime.coordinator
        if runtime is not None and(runtime.station_id!=station_id or type(runtime.is_closed)is not bool or type(coordinator.last_update_success)is not bool):raise Refusal('binding_denied')
        online=runtime is not None and not runtime.is_closed and coordinator.last_update_success
        seen=None if coordinator is None else coordinator.last_seen
        from datetime import datetime
        if seen is not None and(type(seen)is not datetime or seen.tzinfo is None):raise Refusal('binding_denied')
        locks=locks_for(station_id)
        if type(locks)is not dict or locks.get('owner')is None or type(locks.get('locks'))is not tuple or len(locks['locks'])>2:raise Refusal('binding_denied')
        lock_rows=[{'physical_index':lock.physical_index,'name':lock.name or None}for lock in locks['locks']]
        camera=camera_for(station_id)
        clock=None if runtime is None else runtime.clock
        clock_data=None if clock is None else clock.public()
        row={'id':station_id,'name':station.name,'online':online,'last_seen':None if seen is None else seen.isoformat(),
             'call_state':coordinator.data.normalized if online else'unavailable','sync_state':station.status,
             'lock_enabled':station.lock_enabled,'locks':lock_rows,'lock_count':len(lock_rows),
             'camera_entity':camera,'has_camera':camera is not None,'zone':None if clock_data is None else clock_data['zone']}
        driver=station.driver if 'technical'in sections else None
        caps=None if driver is None else driver.capabilities
        profile=None if runtime is None else runtime.profile
        events=None if runtime is None else runtime.events
        if 'technical'in sections:
            capabilities=None if caps is None else{k:getattr(caps,k)for k in ('max_users','max_cards','cards_per_person','pin_min','pin_max','card_min','card_max','name_max','pin_mode')}
            if capabilities is not None:capabilities.update(pin_writable=caps.pin_field is not None,schedules=False)
            event_data=None if events is None else events.status()
            row.update(loaded=driver is not None,model=None if profile is None else profile.model,firmware=None if profile is None else profile.firmware,
                capabilities=capabilities,clock=clock_data,event_status=event_data,scanned_at=station.scanned_at,
                scanning=station.scan_task is not None,reconciled_at=station.reconciled_at,
                last_poll_ms=None if coordinator is None else coordinator.last_poll_ms)
        if 'errors'in sections:row['last_error']=station.error
        metadata=metadata_for(request,sections)
        if type(metadata)is not dict:raise Refusal('binding_denied')
        payload={key:metadata[key]for key in ('version','default_zone','api','access')}
        if 'editor'in sections:payload['profile_policy']=metadata['profile_policy']
        payload['station']=row
        owners=(*providers,station,runtime,coordinator,driver,caps,profile,clock,events,locks['owner'])
        if clock is not None:owners+=(getattr(clock.public,'__func__',clock.public),)
        if events is not None:owners+=(getattr(events.status,'__func__',events.status),)
        if any(a is not b for a,b in zip(providers,(self.station,self.runtime,self.locks,self.camera,self.metadata))):raise Refusal('binding_denied')
        return OverviewSourceSnapshot(payload,owners)


class SelectedOverview:
    def __init__(self, *, current_source, fresh_view, current_mapping, profile_schema):
        if not all(callable(v) for v in (current_source, fresh_view, current_mapping)): raise ValueError('explicit station metadata and Arx view required')
        Schema(profile_schema).require_closed(projection=True)
        self.source, self.view, self.mapping = current_source, fresh_view, current_mapping
        self._profile_schema = freeze(profile_schema)
        self.result_schema = overview_schema(thaw(self._profile_schema))
        Schema(self.result_schema).require_closed(projection=True,diagnostic=True)
        self._result_definition=freeze(self.result_schema)

    def project(self, source, view):
        snapshot=source if type(source)is OverviewSourceSnapshot else None
        if snapshot is not None and (type(snapshot.owners)is not tuple or len(snapshot.owners)<5):raise Refusal('binding_denied')
        source=snapshot.payload if snapshot is not None else source
        if type(source) is not dict: raise Refusal('binding_denied')
        raw = source['station']
        if type(raw) is not dict or raw['id'] != view.station_id: raise Refusal('binding_denied')
        fields = {**BASE, **(TECH if 'technical' in view.sections else {})}
        row = project_selected(raw, closed(fields)); Schema(closed(fields))(row)
        if len({lock['physical_index'] for lock in row['locks']}) != len(row['locks']): raise Refusal('binding_denied')
        if row['lock_count']!=len(row['locks']):raise Refusal('binding_denied')
        if row['has_camera'] != (row['camera_entity'] is not None): raise Refusal('binding_denied')
        if 'errors' in view.sections:
            code = raw.get('last_error')
            row['last_error'] = next((known for known in PUBLIC_ERRORS if type(code) is str and code == known), None)
        result = {'stations': [row], 'version': source['version'],
            'default_zone': project_selected(source['default_zone'], ZONE), 'api': project_selected(source['api'], API),
            # This is display metadata; never evaluate Arx permissions from it.
            'access': project_selected(source['access'], self.result_schema['properties']['access'])}
        if 'editor' in view.sections:
            policy = source['profile_policy']
            result['profile_policy'] = None if policy is None else project_selected(policy, thaw(self._profile_schema))
        Schema(self.result_schema)(result)
        return result, snapshot.owners if snapshot is not None else (raw, source['api'], source['access'], source['profile_policy'] if 'editor' in view.sections else None)

    async def read(self, params, context):
        if type(context) is not EngineContext or context.request.get('action') != 'overview' or not same_parameters(params, {}) or not same_parameters(params, context.parameters): raise Refusal('binding_denied')
        owners = (self.source, self.view, self.mapping, self._profile_schema, self.result_schema)
        source_for, view_for, mapping, *_ = owners
        held_providers=None
        context.check(); resolved = mapping(context.request); context.check()
        if type(resolved) is not dict or any(type(resolved.get(k)) is not type(v) or resolved.get(k) != v for k, v in thaw(context.request.get('target')).items()): raise Refusal('binding_denied')
        station = reference(resolved.get('config_entry_id')); mapped = freeze(resolved)
        def current():
            context.check()
            if any(a is not b for a, b in zip(owners, (self.source, self.view, self.mapping, self._profile_schema, self.result_schema))) or freeze(self.result_schema)!=self._result_definition or not same_parameters(mapping(context.request), mapped): raise Refusal('binding_denied')
            if held_providers is not None and any(a is not b for a,b in zip(held_providers,(source_for.station,source_for.runtime,source_for.locks,source_for.camera,source_for.metadata))):raise Refusal('binding_denied')
            context.check()
        async def view():
            current(); value = await context.wait(lambda: view_for(context.request)); current()
            if type(value) is not OverviewView or type(value.permission_revision) is not int or value.permission_revision != context.request.get('operation')['permission_revision'] or value.selection_revision != context.request.get('selection_revision') or value.station_id != station or type(value.sections) is not frozenset or not value.sections <= {'technical', 'editor', 'errors'}: raise Refusal('permissions_changed')
            reference(value.reference); return value
        initial = await view(); current()
        def source_value():return source_for(context.request,station,initial.sections)if type(source_for)is OverviewSource else source_for(context.request)
        source = source_value()
        if type(source)is OverviewSourceSnapshot:held_providers=source.owners[:5]
        current()
        result, source_owners = self.project(source, initial); snapshot = freeze(result)
        if await view() != initial: raise Refusal('permissions_changed')
        current()
        fresh_source=source_value();current()
        if type(source)is not OverviewSourceSnapshot and fresh_source is not source: raise Refusal('binding_denied')
        fresh, final_owners = self.project(fresh_source, initial)
        if freeze(fresh) != snapshot or any(a is not b for a, b in zip(source_owners, final_owners)): raise Refusal('binding_denied')
        current(); return fresh
