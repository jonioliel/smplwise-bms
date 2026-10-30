"""Full selected event shapes, with detached source metadata and final views.

This is a PARTIAL_OFF receiver candidate, not a registration. Normalized event
creation, observed-owner membership and portraits still have source boundaries
which this module does not replace with a fabricated fingerprint. Source query,
audience filtering, evidence and CSV formatting are explicit dependencies.
"""
from dataclasses import dataclass
from collections import OrderedDict
from datetime import datetime
import csv
import io

from .adapters import EngineContext, closed, project_selected
from .envelope import freeze, thaw
from .jobs import same_parameters
from .scoped_metadata import EVENT_ROW, EVENT_REQUEST
from .source_bindings import same_identities
from .validation import Refusal, Schema, reference
from .overview_projection import ZONE

TEXT = {'type': ['string', 'null'], 'minLength': 1, 'maxLength': 128, 'pattern': '^[^\\x00-\\x1f]*$(?![\\s\\S])'}
FLAG = {'type': 'string', 'enum': ['missing', 'empty', 'provided', 'invalid_type']}
META_ROW = closed({**EVENT_ROW['properties'], 'id': {'type': 'string', 'pattern': '^[a-f0-9]{64}$(?![\\s\\S])'},
    'event_type': {'enum': [*EVENT_ROW['properties']['event_type']['enum'], 'ring']}})
ROW = closed({**META_ROW['properties'], 'person_name': TEXT, 'employee_no': TEXT,
              'portrait': {'type': 'boolean'}})
EVIDENCE = closed({
    'identity_state': {'type': 'string', 'enum': ['identified', 'id_only', 'identity_unavailable']},
    'origin': {'type': 'string', 'enum': ['history_query', 'call_poll', 'device_time_missing',
        'device_time_ahead', 'delayed_stream', 'device_not_current', 'live_stream']},
    'arrival_delay_seconds': {'type': ['number', 'null']},
    'time_source': EVENT_ROW['properties']['time_source'], 'live_automation': {'type': 'boolean'}})
IDENTITY = closed({'source_fields': closed({key: FLAG for key in ('employeeNoString', 'employeeNo', 'name')}),
    'normalized': {'type': 'boolean'},
    'time_interpretation': {'type': 'string', 'enum': ['verified_device_zone', 'source_timestamp']},
    'central_name_resolved': {'type': 'boolean'}},
    ['source_fields', 'normalized', 'time_interpretation'])
STATUS = closed({'id': EVENT_ROW['properties']['station_id'],
    # Existing StationEvents state strings are bounded diagnostic metadata;
    # neither connected nor streaming is physical feedback.
    'stream': {'type': 'string', 'minLength': 1, 'maxLength': 64},
    'history': {'type': 'string', 'minLength': 1, 'maxLength': 64}})
LIST_RESULT = closed({'records': {'type': 'array', 'maxItems': 200, 'items': ROW},
    'next': {'type': ['string', 'null'], 'minLength': 1, 'maxLength': 128},
    'retention_days': {'type': 'integer', 'minimum': 1}, 'capacity': {'type': 'integer', 'minimum': 1},
    'membership_basis': {'enum': [None, 'current_observed_owner']}, 'storage_failed': {'type': 'boolean'},
    'stations': {'type': 'array', 'maxItems': 1, 'items': STATUS}})
DETAIL_RESULT = closed({'record': ROW, 'evidence': EVIDENCE,
    'source_identity': {**IDENTITY, 'type': ['object', 'null']}})
FILTERS = {**EVENT_REQUEST['properties']['filters']['properties'],
    'person': {'type': 'string', 'minLength': 1, 'maxLength': 128},
    'current_group': {'type': 'string', 'pattern': '^[a-z][a-z0-9_]{0,47}$'}}
LIST_REQUEST = closed({'filters': closed(FILTERS, ['station_id'])})
DETAIL_REQUEST = closed({'event_id': EVENT_ROW['properties']['id']})
EXPORT_REQUEST = closed({'filters': closed({k: v for k, v in FILTERS.items() if k not in {'limit', 'before'}}, ['station_id'])})
EXPORT_RESULT = closed({'csv': {'type': 'string', 'maxLength': 1048576}})
COLUMNS = ('timestamp', 'station', 'employee_no', 'person_name', 'event_type', 'authentication',
           'result', 'door', 'recovered', 'time_source', 'display_timestamp', 'display_timezone')
VISIBLE = frozenset({'person_name', 'employee_no', 'portrait'})


@dataclass(frozen=True, repr=False)
class EventView:
    reference: str
    permission_revision: int
    selection_revision: str
    station_id: str
    keys: tuple
    fields: frozenset


@dataclass(frozen=True, repr=False)
class EventSource:
    revision: str
    rows: object
    status: object
    storage_failed: bool
    identities: object
    groups: object
    audience: object
    evidence: object
    zone: object


class SelectedEvents:
    def __init__(self, *, current_source, fresh_view, current_mapping, source_query,
                 source_audience, source_evidence, format_csv, clock_sample, source_error, source_localize):
        values = (current_source, fresh_view, current_mapping, source_query, source_audience,
                  source_evidence, format_csv, clock_sample)
        if not all(callable(value) for value in (*values, source_localize)) or not isinstance(source_error, type) or not issubclass(source_error, Exception):
            raise ValueError('explicit source algorithms and current Arx views required')
        self.source, self.view, self.mapping, self.query, self.audience, self.evidence, self.csv, self.clock = values
        self.source_error = source_error
        self.localize = source_localize
        self._generation = object(); self._active = {}; self.closed = False
        self._owned_active = self._active

    def owners(self):
        return (self.source, self.view, self.mapping, self.query, self.audience, self.evidence,
                self.csv, self.clock, getattr(self.clock, 'provider', None), self.source_error, self.localize)

    def invalidate(self):
        self._generation = object(); self._owned_active.clear()

    def close(self):
        self.closed = True; self.invalidate()

    def detach(self, source, view):
        if type(source) is not EventSource or type(source.storage_failed) is not bool or type(source.rows) not in (dict, OrderedDict):
            raise Refusal('binding_denied')
        reference(source.revision)
        # Only selected rows are visited. No copying of arbitrary cache bodies,
        # portrait values, private trace payloads or out-of-view person records.
        rows = {}
        for key in view.keys:
            raw = source.rows.get(key)
            if type(raw) is not dict: raise Refusal('binding_denied')
            row = {name: raw[name] for name in META_ROW['properties']}
            for field in ('person_name', 'employee_no'):
                row[field] = raw[field] if field in view.fields else None
                Schema(TEXT)(row[field])
            Schema(META_ROW)({k: row[k] for k in META_ROW['properties']})
            if row['id'] != key or row['station_id'] != view.station_id: raise Refusal('binding_denied')
            # The origin enum is used only by the exact source explain_event;
            # no raw source object or major/minor/card enters this dictionary.
            origin = raw['source']
            if type(origin) is not str or origin not in {'stream', 'query', 'call_status'}: raise Refusal('binding_denied')
            row['source'] = origin
            rows[key] = row
        if type(source.identities) is not dict or type(source.evidence) is not dict or type(source.status) is not dict or set(source.status) != {view.station_id}: raise Refusal('binding_denied')
        status = project_selected({'id': view.station_id, **source.status[view.station_id]}, STATUS); Schema(STATUS)(status)
        return rows, status

    def selected_metadata(self, source, view, action, filters):
        portraits = {}; identities = {}; evidence = {}
        for key in view.keys:
            if 'portrait' in view.fields:
                raw = source.rows[key].get('portrait')
                if raw is not None:
                    Schema(closed({'user_id': {'type': 'string', 'format': 'uuid'}, 'revision': {'type': 'integer', 'minimum': 1}}))(raw)
                    portraits[key] = dict(raw)  # one freeze of the complete metadata snapshot below
            if action == 'events/detail' and key == filters.get('event_id'):
                raw = source.identities.get(key)
                identities[key] = None if raw is None else project_selected(raw, IDENTITY)
                if identities[key] is not None: Schema(IDENTITY)(identities[key])
                evidence[key] = project_selected(self.evidence(source.evidence[key]), EVIDENCE)
                Schema(EVIDENCE)(evidence[key])
        groups, audience = {}, {}
        if 'current_group' in filters:
            group_schema = closed({'groups': {'type': 'array', 'maxItems': 64, 'items': closed({
                'id': {'type': 'string', 'pattern': '^[a-z][a-z0-9_]{0,47}$'}})}})
            groups = project_selected(source.groups, group_schema); Schema(group_schema)(groups)
            if type(source.audience) is not dict or len(source.audience) > 5000: raise Refusal('binding_denied')
            member_schema = closed({'observed_at': {'type': 'string', 'format': 'date-time'},
                'group_ids': {'type': 'array', 'maxItems': 64, 'items': {'type': 'string', 'pattern': '^[a-z][a-z0-9_]{0,47}$'}}})
            for key, value in source.audience.items():
                if type(key) is not tuple or len(key) != 2: raise Refusal('binding_denied')
                station, employee = key; reference(station); Schema(TEXT)(employee)
                if station != view.station_id: continue
                member = project_selected(value, member_schema); Schema(member_schema)(member)
                # current_profile is excluded by this selected request schema.
                audience[key] = {**member, 'profile': {}}
        zone = project_selected(source.zone, ZONE) if action == 'events/export' else None
        if zone is not None: Schema(ZONE)(zone)
        return freeze({'portraits': portraits, 'identities': identities, 'evidence': evidence,
                       'groups': groups, 'zone': zone}), audience

    async def read(self, params, context):
        if type(context) is not EngineContext or not same_parameters(params, context.parameters): raise Refusal('binding_denied')
        action = context.request.get('action')
        schemas = {'events/list': LIST_REQUEST, 'events/detail': DETAIL_REQUEST, 'events/export': EXPORT_REQUEST}
        if action not in schemas: raise Refusal('binding_denied')
        Schema(schemas[action])(thaw(params))
        owners, generation, token = self.owners(), self._generation, object()
        active = self._owned_active
        source_for, view_for, mapping, query, audience, evidence, formatter, clock, _, source_error, localize = owners
        context.check(); resolved = mapping(context.request); context.check()
        if type(resolved) is not dict or any(type(resolved.get(k)) is not type(v) or resolved.get(k) != v for k, v in thaw(context.request.get('target')).items()): raise Refusal('binding_denied')
        station = reference(resolved.get('config_entry_id')); mapped = freeze(resolved)
        def current():
            context.check()
            if self.closed or self._generation is not generation or self._owned_active is not active or self._active is not active or active.get(token) is not context or not same_identities(owners,self.owners()) or not same_parameters(mapping(context.request), mapped): raise Refusal('cursor_stale')
            context.check()
        async def view():
            current(); value = await context.wait(lambda: view_for(context.request)); current()
            if type(value) is not EventView or type(value.permission_revision) is not int or value.permission_revision != context.request.get('operation')['permission_revision'] or value.selection_revision != context.request.get('selection_revision') or value.selection_revision != 'rev1' or value.station_id != station or type(value.fields) is not frozenset or not value.fields <= VISIBLE or type(value.keys) is not tuple or len(value.keys) > 5000 or len(set(value.keys)) != len(value.keys): raise Refusal('permissions_changed')
            reference(value.reference)
            for key in value.keys: reference(key)
            return value
        if self.closed or self._active is not active or len(active) >= 128: raise Refusal('binding_denied')
        active[token] = context
        try:
            initial = await view(); current(); source = source_for(context.request); current()
            if type(source) is not EventSource:raise Refusal('binding_denied')
            source_revision,storage_failed=source.revision,source.storage_failed
            rows, status = self.detach(source, initial); snapshot = freeze(rows)
            source_owners = (source.rows, source.status, source.identities, source.groups, source.audience, source.evidence)
            row_owners = tuple(source.rows[key] for key in initial.keys)
            filters = thaw(params).get('filters', {})
            if action != 'events/detail' and filters['station_id'] != station: raise Refusal('binding_denied')
            if 'person' in filters and not {'person_name', 'employee_no'} <= initial.fields: raise Refusal('Unauthorized')
            meta, audience_snapshot = self.selected_metadata(source, initial, action, thaw(params) if action == 'events/detail' else filters)
            group_snapshot = thaw(meta)['groups']
            audience_bound = tuple((key, freeze(value)) for key, value in sorted(audience_snapshot.items()))
            sample = clock(); sample.check(); context.request.check_time(sample.now)
            # Membership is an explicit detached source dependency, never a
            # guessed group or a name-based owner. Its observed-owner creation
            # remains a separately reported source boundary.
            try:
                base, match = audience(filters, group_snapshot, audience_snapshot)
                current(); page = query(rows, base, sample.now, action != 'events/list', match); current()
            except source_error: raise Refusal('invalid_fields') from None
            if not same_parameters(rows, snapshot) or type(page) is not dict: raise Refusal('binding_denied')
            records = page.get('records')
            if type(records) is not list or len(records) > (filters.get('limit', 100) if action == 'events/list' else 5000): raise Refusal('binding_denied')
            seen = set()
            for row in records:
                if type(row) is not dict or row.get('id') not in rows or row['id'] in seen or not same_parameters(row, rows[row['id']]): raise Refusal('binding_denied')
                seen.add(row['id'])
            def projected(row):
                result = {k: row[k] for k in META_ROW['properties']}
                result.update(person_name=row['person_name'], employee_no=row['employee_no'], portrait=False)
                if 'portrait' in initial.fields:
                    # Only a typed existing descriptor is accepted. No image,
                    # body, URL, value hash or length is accessed.
                    result['portrait'] = row['id'] in meta['portraits']
                Schema(ROW)(result); return result
            if action == 'events/detail':
                identifier = params['event_id']
                if identifier not in rows: raise Refusal('Unauthorized')
                row = next((r for r in records if r['id'] == identifier), None)
                if row is None: raise Refusal('event_not_found')
                detail = thaw(meta['evidence'][identifier])
                identity = thaw(meta['identities'][identifier])
                result = {'record': projected(row), 'evidence': detail, 'source_identity': identity}
                Schema(DETAIL_RESULT)(result)
            elif action == 'events/list':
                result = {k: page[k] for k in ('next', 'retention_days', 'capacity')}
                result.update(records=[projected(row) for row in records],
                    membership_basis='current_observed_owner' if 'current_group' in filters else None,
                    storage_failed=storage_failed, stations=[status])
                Schema(LIST_RESULT)(result)
            else:
                # The bridge produces the agreed clean CSV projection, not a
                # classic CSV with masked cards followed by a filtering guess.
                if not callable(localize): raise Refusal('binding_denied')
                zone = thaw(meta['zone'])
                body = [(r['timestamp'], r['station_id'], r['employee_no'], r['person_name'],
                    r['event_type'], r['authentication'], r['result'], r['door'], str(r['recovered']).lower(),
                    r['time_source'], localize(datetime.fromisoformat(r['timestamp']), zone).isoformat(), zone['name']) for r in records]
                encoded = await context.wait(lambda: formatter(COLUMNS, body)); current()
                if type(encoded) is not str or len(encoded.encode('utf8')) > 1048576: raise Refusal('record_too_large')
                def cell(v):
                    v = '' if v is None else str(v)
                    return "'" + v if v.lstrip().startswith(('=', '+', '-', '@')) or v.startswith(('\t', '\r', '\n')) else v
                try: decoded = list(csv.reader(io.StringIO(encoded.removeprefix('\ufeff'), newline=''), strict=True))
                except csv.Error: raise Refusal('invalid_fields') from None
                if decoded != [list(COLUMNS), *[[cell(v) for v in r] for r in body]]: raise Refusal('binding_denied')
                result = {'csv': encoded}; Schema(EXPORT_RESULT)(result)
            # Authority and row membership are checked after the *last* await,
            # including export formatting. A change invalidates every pending
            # operation under that generation, never just the current cursor.
            if await view() != initial: raise Refusal('permissions_changed')
            current(); fresh = source_for(context.request); current()
            if fresh is not source or type(fresh.revision) is not type(source_revision) or fresh.revision!=source_revision or type(fresh.storage_failed) is not type(storage_failed) or fresh.storage_failed!=storage_failed or self.detach(fresh, initial) != (thaw(snapshot), status): raise Refusal('cursor_stale')
            if not same_identities(source_owners,(fresh.rows,fresh.status,fresh.identities,fresh.groups,fresh.audience,fresh.evidence)) or any(a is not fresh.rows[key] for a, key in zip(row_owners, initial.keys)): raise Refusal('cursor_stale')
            fresh_meta, fresh_audience = self.selected_metadata(fresh, initial, action, thaw(params) if action == 'events/detail' else filters)
            if fresh_meta != meta or tuple((key, freeze(value)) for key, value in sorted(fresh_audience.items())) != audience_bound: raise Refusal('cursor_stale')
            current(); return result
        except BaseException:
            self.invalidate(); raise
        finally:
            # A pending read owns this original map even if a callback replaces
            # the public tracking attribute before final admission or close.
            active.pop(token, None)
