"""Bounded metadata source reads; never register a transport or native command.

Only explicitly Arx-scoped keys/fields reach the injected source query. This
does not close full overview, event evidence/portraits, export or dispatcher.
events/list can compose the explicitly scoped ten-field metadata profile; the
other fields and filters stay outside that bounded profile. No source bodies,
credential values or sync intent hashes are copied or inspected.
"""
from dataclasses import dataclass
from collections import OrderedDict

from .adapters import EngineContext,closed,project_selected
from .envelope import freeze,thaw
from .jobs import same_parameters
from .source_bindings import same_identities
from .validation import Refusal,Schema,reference


@dataclass(frozen=True,repr=False)
class MetadataView:
    view_reference:str
    permission_revision:int
    selection_revision:str
    fields:frozenset
    keys:tuple
    station_id:str


EVENT_TYPES=['access_denied','access_granted','attempt_limit','contact_closed','contact_open','door_locked','door_not_closed','door_not_opened','door_unlocked','unknown','unlock_exception','unlock_record']
TEXT={'type':'string','minLength':1,'maxLength':128}
STAMP={'type':'string','format':'date-time'}
EVENT_ROW=closed({'id':TEXT,'station_id':TEXT,'timestamp':STAMP,'received_at':STAMP,
    'time_source':{'type':'string','enum':['device','received']},'door':{'type':['integer','null'],'enum':[1,2,None]},
    'authentication':{'type':'string','enum':['card','pin','unknown']},'result':{'type':'string','enum':['granted','denied','unknown']},
    'event_type':{'type':'string','enum':EVENT_TYPES},'recovered':{'type':'boolean'}})
SYNC_ROW=closed({'id':{'type':'string','format':'uuid'},'user_id':{'type':'string','format':'uuid'},'station_id':TEXT,
    'queued_at':{'type':['string','null'],'format':'date-time'},'updated_at':STAMP,
    'state':{'type':'string','enum':['pending','failed','verified','settled']},'verified_at':{'type':['string','null'],'format':'date-time'}})
EVENT_REQUEST=closed({'filters':closed({'station_id':TEXT,'result':EVENT_ROW['properties']['result'],
    'authentication':EVENT_ROW['properties']['authentication'],'event_type':EVENT_ROW['properties']['event_type'],
    'door':{'type':'integer','enum':[1,2]},'start':STAMP,'end':STAMP,'before':TEXT,
    'limit':{'type':'integer','minimum':1,'maximum':200}},['station_id'])})


class ScopedMetadata:
    def __init__(self,*,action,current_rows,fresh_view,current_station,query,clock_sample,source_validation_error=None):
        if action not in {'events/list','sync/status'} or not all(callable(v) for v in (current_rows,fresh_view,current_station,query,clock_sample)):raise ValueError('explicit scoped source read dependencies required')
        if source_validation_error is not None and (not isinstance(source_validation_error,type) or not issubclass(source_validation_error,Exception)):raise ValueError('explicit source validation exception class required')
        self.action=action;self.current_rows,self.fresh_view,self.current_station,self.query,self.clock=current_rows,fresh_view,current_station,query,clock_sample
        self.source_error=source_validation_error;self._row=freeze(EVENT_ROW if action=='events/list' else SYNC_ROW)
        self._request=freeze(EVENT_REQUEST if action=='events/list' else closed({}))

    def _owners(self):return (self.action,self.current_rows,self.fresh_view,self.current_station,self.query,self.clock,getattr(self.clock,'provider',None),self.source_error,self._row,self._request)

    async def read(self,params,context):
        if type(context)is not EngineContext or context.request.get('action')!=self.action or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        Schema(thaw(self._request))(thaw(params));owners=self._owners()
        action,rows,view_provider,station_for,query,clock,_,source_error,row_definition,*_=owners
        schema=Schema(thaw(row_definition));fields=frozenset(schema.definition['properties'])
        def current():
            context.check()
            if not same_identities(owners,self._owners()):raise Refusal('binding_denied')
        async def view():
            current();value=await context.wait(lambda:view_provider(context.request));current()
            if type(value)is not MetadataView or type(value.permission_revision)is not int or value.permission_revision!=context.request.get('operation')['permission_revision'] or value.selection_revision!=context.request.get('selection_revision') or value.selection_revision!='rev1' or type(value.fields)is not frozenset or value.fields!=fields:raise Refusal('binding_denied')
            reference(value.view_reference);reference(value.station_id)
            if type(value.keys)is not tuple or len(value.keys)>5000 or any(type(k)is not str for k in value.keys) or len(set(value.keys))!=len(value.keys):raise Refusal('binding_denied')
            for key in value.keys:reference(key)
            station=station_for(context.request);current()
            if type(station)is not str or station!=value.station_id:raise Refusal('binding_denied')
            target=context.request.get('target')
            if 'config_entry_id'in target and target['config_entry_id']!=station:raise Refusal('binding_denied')
            if action=='events/list' and params['filters']['station_id']!=station:raise Refusal('binding_denied')
            return value
        initial=await view();current();state=rows(context.request);current()
        if type(state)not in (dict,OrderedDict):raise Refusal('binding_denied')
        projected={};bindings=[]
        for key in initial.keys:
            current();raw=state.get(key)
            if type(raw)is not dict:raise Refusal('binding_denied')
            row={field:raw[field] for field in fields};schema(row)
            if row['station_id']!=initial.station_id or (action=='events/list' and row['id']!=key):raise Refusal('binding_denied')
            projected[key]=row;bindings.append((key,raw,freeze(row)))
        current();sample=clock();sample.check();context.request.check_time(sample.now)
        projected_snapshot=freeze(projected)
        try:result=query(projected,thaw(params).get('filters',{}),sample.now)
        except Exception as error:
            if source_error is not None and isinstance(error,source_error):raise Refusal('invalid_fields') from None
            raise
        current()
        if not same_parameters(projected,projected_snapshot):raise Refusal('binding_denied')
        records=result.get('records') if action=='events/list' and type(result)is dict else result
        if type(records)is not list or len(records)>(params['filters'].get('limit',100) if action=='events/list' else 5000):raise Refusal('binding_denied')
        allowed={row['id']:row for row in projected.values()}
        if len(allowed)!=len(projected) or len({row.get('id') for row in records if type(row)is dict})!=len(records):raise Refusal('binding_denied')
        for row in records:
            if type(row)is not dict or row.get('id')not in allowed or not same_parameters(row,allowed[row['id']]):raise Refusal('binding_denied')
        if await view()!=initial:raise Refusal('permissions_changed')
        current()
        if rows(context.request)is not state:raise Refusal('binding_denied')
        for key,raw,snapshot in bindings:
            if state.get(key)is not raw or not same_parameters({field:raw[field] for field in fields},snapshot):raise Refusal('binding_denied')
        if action=='events/list':
            output=closed({'records':{'type':'array','items':schema.definition,'maxItems':200},'next':{'type':['string','null'],'minLength':1,'maxLength':128},'retention_days':{'type':'integer','minimum':1},'capacity':{'type':'integer','minimum':1}})
            result=project_selected(result,output);Schema(output)(result)
        else:result=[project_selected(row,schema.definition) for row in result]
        current();return result

