"""Bounded public snapshots under fresh Arx views; no classic permissions.

The host supplies scoped sources explicitly. These producers neither discover
an HA repository nor read its broad public/private serializer. Session role
metadata is diagnostic only. Person counters, last access, credentials and
device addresses are absent from station/person snapshots.
"""
from dataclasses import dataclass
from datetime import datetime

from .adapters import EngineContext,closed,project_selected
from .envelope import freeze,thaw
from .jobs import same_parameters
from .scoped_metadata import MetadataView
from .validation import Refusal,Schema,reference

STATION_ROW=closed({'id':{'type':'string','minLength':1,'maxLength':128},
    'name':{'type':'string','maxLength':128},'online':{'type':'boolean'},
    'last_seen':{'type':['string','null'],'format':'date-time'}})
PERSON_FIELDS=('id','revision','display_name','valid_from','valid_until','group_ids')
CONFLICT_PERSON=closed({'id':{'type':'string','format':'uuid'},'display_name':{'type':'string','minLength':1,'maxLength':32}})
STATES=frozenset({'synced','pending','syncing','offline','conflict','error','delete_pending'})
LEVEL={'type':'string','enum':['none','view','manage']}
SESSION_SCHEMA=closed({'allowed':{'type':'boolean'},'is_admin':{'type':'boolean'},
    'areas':closed({key:LEVEL for key in ('overview','users','events','stations','management')}),
    'fields':closed({key:LEVEL for key in ('phone','photo','credentials','profile','access')}),
    # Source normalization permits 1000 base stations and 64 groups of 1000.
    'station_ids':{'type':['array','null'],'maxItems':65000,'items':{'type':'string','minLength':1,'maxLength':128,'pattern':'^[^\\x00-\\x1f]*$(?![\\s\\S])'}},
    'revision':{'type':'integer','minimum':0},'personal_renewal':{'type':'boolean'},
    'security':closed({'locked':{'type':'boolean'},'idle_minutes':{'type':'integer','minimum':0,'maximum':120},
        'reauth_sensitive':{'type':'boolean'},'elevated':{'type':'boolean'}})},
    ['allowed','is_admin','areas','revision','personal_renewal'])


@dataclass(frozen=True,repr=False)
class SessionDisplay:
    allowed: bool
    revision: int
    view_reference: str
    permission_revision: int
    selection_revision: str
    target: object=None
    policy: object=None


class AuthorityDisplay:
    """Read existing display metadata; Arx alone authorizes the operation.

    The source's display revision is separate from the current Arx permission
    revision. A displayed allowed=false neither calculates nor denies an Arx
    permission. No local role evaluator or HA service actor fallback exists.
    """
    def __init__(self,fresh_display):
        if not callable(fresh_display):raise ValueError('explicit Arx display provider required')
        self.fresh_display=fresh_display
    async def read(self,params,context):
        if type(context)is not EngineContext or context.request.get('action')!='authorization/session' or not same_parameters(params,{}) or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        provider=self.fresh_display
        async def current_display():
            context.check();value=await context.wait(lambda:provider(context.request));context.check()
            if self.fresh_display is not provider or type(value)is not SessionDisplay or type(value.allowed)is not bool or type(value.revision)is not int or value.revision<0 or type(value.permission_revision)is not int or value.permission_revision!=context.request.get('operation')['permission_revision']or value.selection_revision!=context.request.get('selection_revision'):raise Refusal('permissions_changed')
            reference(value.view_reference)
            if not same_parameters(value.target,context.request.get('target')):raise Refusal('binding_denied')
            if type(value.policy)is not dict:raise Refusal('binding_denied')
            selected=project_selected(value.policy,SESSION_SCHEMA);Schema(SESSION_SCHEMA)(selected)
            if selected['allowed']is not value.allowed or selected['revision']!=value.revision:raise Refusal('binding_denied')
            stations=selected.get('station_ids')
            if stations is not None and len(set(stations))!=len(stations):raise Refusal('invalid_fields')
            binding=(value.allowed,value.revision,value.view_reference,value.permission_revision,value.selection_revision,freeze(thaw(value.target)))
            return binding,freeze(selected)
        first=await current_display()
        if await current_display()!=first:raise Refusal('permissions_changed')
        return thaw(first[1])


class PublicSnapshots:
    def __init__(self,*,action,current_rows,fresh_view,current_mapping,person_schema=None):
        if action not in {'overview','conflicts/list'} or not callable(current_rows)or not callable(fresh_view)or not callable(current_mapping):raise ValueError('explicit public snapshot and mapping dependencies required')
        if action=='conflicts/list':
            schema=Schema(CONFLICT_PERSON if person_schema is None else person_schema);schema.require_closed(projection=True)
            if schema.definition!=CONFLICT_PERSON:raise ValueError('exact conflict person projection required')
        self.action,self.current_rows,self.fresh_view=action,current_rows,fresh_view
        self.mapping=current_mapping
        self._schema=freeze(STATION_ROW if action=='overview' else schema.definition)

    def _project(self,raw,identifier,station):
        if type(raw)is not dict:raise Refusal('binding_denied')
        if self.action=='overview':
            owner=raw['station'];runtime=raw['runtime']
            if owner.id!=identifier:raise Refusal('binding_denied')
            name=owner.name
            if runtime is None:online=False;seen=None;coordinator=None
            else:
                if runtime.station_id!=identifier or type(runtime.is_closed)is not bool:raise Refusal('binding_denied')
                coordinator=runtime.coordinator
                if type(coordinator.last_update_success)is not bool:raise Refusal('binding_denied')
                online=not runtime.is_closed and coordinator.last_update_success
                point=coordinator.last_seen
                if point is not None and (type(point)is not datetime or point.tzinfo is None):raise Refusal('binding_denied')
                seen=point.isoformat()if point is not None else None
            return {'id':identifier,'name':name,'online':online,'last_seen':seen},(owner,runtime,coordinator)
        if raw['id']!=identifier:raise Refusal('binding_denied')
        assignments=raw['assignments']
        if type(assignments)is not dict:raise Refusal('binding_denied')
        assignment=assignments.get(station)
        revision=raw['revision']
        if type(revision)is not int or revision<1:raise Refusal('binding_denied')
        if assignment is None:return None,(assignments,None,None,revision)
        if type(assignment)is not dict or type(assignment.get('sync_state'))is not str or assignment['sync_state']not in STATES:raise Refusal('binding_denied')
        if assignment['sync_state']not in {'conflict','error'}:return None,(assignments,assignment,assignment['sync_state'],revision)
        return {key:raw[key]for key in CONFLICT_PERSON['properties']},(assignments,assignment,assignment['sync_state'],revision)

    async def read(self,params,context):
        if type(context)is not EngineContext or context.request.get('action')!=self.action or not same_parameters(params,{}) or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        action,rows,provider,definition=self.action,self.current_rows,self.fresh_view,self._schema
        mapping=self.mapping;context.check();resolved=mapping(context.request);context.check()
        if self.mapping is not mapping or type(resolved)is not dict or any(type(resolved.get(k))is not type(v)or resolved.get(k)!=v for k,v in thaw(context.request.get('target')).items()):raise Refusal('binding_denied')
        station=reference(resolved.get('config_entry_id'));mapped=freeze(resolved)
        def current():
            context.check()
            if self.action!=action or self.current_rows is not rows or self.fresh_view is not provider or self._schema is not definition or self.mapping is not mapping or not same_parameters(mapping(context.request),mapped):raise Refusal('binding_denied')
            context.check()
        async def view():
            current();value=await context.wait(lambda:provider(context.request));current()
            if type(value)is not MetadataView or type(value.permission_revision)is not int or value.permission_revision!=context.request.get('operation')['permission_revision'] or value.selection_revision!=context.request.get('selection_revision') or value.selection_revision!='rev1' or type(value.fields)is not frozenset or value.fields!=frozenset(thaw(definition)['properties'])or type(value.keys)is not tuple or len(value.keys)>5000 or len(set(value.keys))!=len(value.keys):raise Refusal('permissions_changed')
            reference(value.view_reference);reference(value.station_id)
            if value.station_id!=station:raise Refusal('binding_denied')
            for identifier in value.keys:reference(identifier)
            # This bounded producer has one target station; no global selector.
            if action=='overview' and any(identifier!=value.station_id for identifier in value.keys):raise Refusal('binding_denied')
            return value
        initial=await view();current();state=rows(context.request);current()
        if type(state)is not dict:raise Refusal('binding_denied')
        output=[];bindings=[];schema=Schema(thaw(definition))
        for identifier in initial.keys:
            raw=state.get(identifier);result,owners=self._project(raw,identifier,initial.station_id);current()
            if result is not None:schema(result);output.append(result)
            bindings.append((identifier,raw,owners,freeze(result)))
        if await view()!=initial:raise Refusal('permissions_changed')
        current()
        if rows(context.request)is not state:raise Refusal('binding_denied')
        for identifier,raw,owners,bound in bindings:
            if state.get(identifier)is not raw:raise Refusal('binding_denied')
            result,fresh=self._project(raw,identifier,initial.station_id)
            same_owners=all(a is b for a,b in zip(owners,fresh))if action=='overview'else all(a is b for a,b in zip(owners[:2],fresh[:2]))and owners[2:]==fresh[2:]
            if len(owners)!=len(fresh)or not same_owners or freeze(result)!=bound:raise Refusal('binding_denied')
        current();return {'stations'if action=='overview'else'users':output}
