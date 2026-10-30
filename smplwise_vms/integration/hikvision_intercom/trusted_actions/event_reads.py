"""Bounded event detail/export from Arx-scoped metadata, never classic export.

No source credential/person/portrait or raw event serializer is used. The
injected source cache algorithm sees exactly ten metadata fields. Export uses
the source csv_text formatter on eight non-person columns, with a final view
after the formatter's last await. No provider, polling or registration exists.
"""
from collections import OrderedDict
import csv as csv_module
import io

from .adapters import EngineContext,closed
from .envelope import freeze,thaw
from .jobs import same_parameters
from .scoped_metadata import MetadataView,EVENT_ROW,EVENT_REQUEST
from .source_bindings import same_identities
from .validation import Refusal,Schema,reference


COLUMNS=('timestamp','station','event_type','authentication','result','door','recovered','time_source')
DETAIL_REQUEST=closed({'event_id':EVENT_ROW['properties']['id']})
EXPORT_FILTERS={key:value for key,value in EVENT_REQUEST['properties']['filters']['properties'].items() if key not in {'limit','before'}}
EXPORT_REQUEST=closed({'filters':closed(EXPORT_FILTERS,['station_id'])})
EXPORT_RESULT=closed({'csv':{'type':'string','maxLength':1048576}})


class EventSnapshots:
    def __init__(self,*,current_rows,fresh_view,current_station,source_query,format_csv,clock_sample,source_error):
        if not all(callable(v)for v in (current_rows,fresh_view,current_station,source_query,format_csv,clock_sample)):
            raise ValueError('explicit bounded event source and Arx providers required')
        if not isinstance(source_error,type) or not issubclass(source_error,Exception):raise ValueError('explicit source validation error required')
        self.current_rows,self.fresh_view,self.current_station=current_rows,fresh_view,current_station
        self.query,self.format_csv,self.clock,self.source_error=source_query,format_csv,clock_sample,source_error
        self.closed=False;self._active={};self._generation=object()
        self._owned_active=self._active

    def _owners(self):return (self.current_rows,self.fresh_view,self.current_station,self.query,self.format_csv,self.clock,getattr(self.clock,'provider',None),self.source_error)

    def invalidate(self):
        self._generation=object()
        self._owned_active.clear()

    async def read(self,params,context):
        if type(context)is not EngineContext or context.request.get('action')not in {'events/detail','events/export'} or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        action=context.request.get('action')
        Schema(DETAIL_REQUEST if action=='events/detail' else EXPORT_REQUEST)(thaw(params))
        owners=self._owners();rows,view_provider,station_for,query,formatter,clock,_,source_error=owners
        generation=self._generation;key=object();active=self._owned_active
        def current():
            context.check()
            if self.closed or self._generation is not generation or self._owned_active is not active or self._active is not active or active.get(key)is not context or not same_identities(owners,self._owners()):raise Refusal('cursor_stale')
        async def view():
            current();value=await context.wait(lambda:view_provider(context.request));current()
            if (type(value)is not MetadataView or type(value.permission_revision)is not int or value.permission_revision!=context.request.get('operation')['permission_revision'] or
                value.selection_revision!=context.request.get('selection_revision') or value.selection_revision!='rev1' or value.fields!=frozenset(EVENT_ROW['properties']) or type(value.fields)is not frozenset or
                type(value.keys)is not tuple or len(value.keys)>5000 or any(type(k)is not str for k in value.keys) or len(set(value.keys))!=len(value.keys)):raise Refusal('permissions_changed')
            reference(value.view_reference);reference(value.station_id)
            for identifier in value.keys:reference(identifier)
            station=station_for(context.request);current()
            if type(station)is not str or station!=value.station_id or action=='events/export' and params['filters']['station_id']!=station:raise Refusal('binding_denied')
            target=context.request.get('target')
            if 'config_entry_id'in target and target['config_entry_id']!=station:raise Refusal('binding_denied')
            return value
        if self.closed or self._active is not active or len(active)>=128:raise Refusal('binding_denied')
        active[key]=context
        try:
            initial=await view();current()
            identifiers=initial.keys
            if action=='events/detail':
                if params['event_id']not in identifiers:raise Refusal('Unauthorized')
                identifiers=(params['event_id'],)
            state=rows(context.request);current()
            if type(state)not in (dict,OrderedDict):raise Refusal('binding_denied')
            projected={};bindings=[];schema=Schema(EVENT_ROW)
            for identifier in identifiers:
                current();raw=state.get(identifier)
                if type(raw)is not dict:raise Refusal('binding_denied')
                row={field:raw[field]for field in EVENT_ROW['properties']};schema(row)
                if row['id']!=identifier or row['station_id']!=initial.station_id:raise Refusal('binding_denied')
                projected[identifier]=row;bindings.append((identifier,raw,freeze(row)))
            snapshot=freeze(projected);sample=clock();sample.check();context.request.check_time(sample.now)
            try:
                current();page=query(projected,thaw(params).get('filters',{}),sample.now,action);current()
            except source_error:raise Refusal('invalid_fields')from None
            if not same_parameters(projected,snapshot)or type(page)is not list or len(page)>5000:raise Refusal('binding_denied')
            if len({row.get('id')for row in page if type(row)is dict})!=len(page):raise Refusal('binding_denied')
            for row in page:
                if type(row)is not dict or row.get('id')not in projected or not same_parameters(row,projected[row['id']]):raise Refusal('binding_denied')
            if action=='events/detail':
                if len(page)!=1:raise Refusal('invalid_fields')
                result={'record':page[0]}
            else:
                # Construct no person columns, and never call build_report or
                # classic export. Source fallback uses the station's public ID.
                body=[(row['timestamp'],row['station_id'],row['event_type'],row['authentication'],row['result'],row['door'],str(row['recovered']).lower(),row['time_source'])for row in page]
                csv=await context.wait(lambda:formatter(COLUMNS,body));current()
                if type(csv)is not str or len(csv.encode('utf8'))>1048576:raise Refusal('record_too_large')
                def cell(value):
                    value='' if value is None else str(value)
                    return "'"+value if value.lstrip().startswith(('=','+','-','@')) or value.startswith(('\t','\r','\n')) else value
                try:decoded=list(csv_module.reader(io.StringIO(csv.removeprefix('\ufeff'),newline=''),strict=True))
                except csv_module.Error:raise Refusal('invalid_fields')from None
                if decoded!=[list(COLUMNS),*[[cell(v)for v in row]for row in body]]:raise Refusal('binding_denied')
                result={'csv':csv};Schema(EXPORT_RESULT)(result)
            if await view()!=initial:raise Refusal('permissions_changed')
            current()
            if rows(context.request)is not state:raise Refusal('cursor_stale')
            for identifier,raw,bound in bindings:
                if state.get(identifier)is not raw or not same_parameters({field:raw[field]for field in EVENT_ROW['properties']},bound):raise Refusal('cursor_stale')
            current();return result
        except BaseException:
            # A refused/cancelled view cannot leave any concurrent export
            # admitted under the old generation. There are no cached bodies.
            self.invalidate();raise
        finally:active.pop(key,None)

    def close(self):self.closed=True;self.invalidate()
