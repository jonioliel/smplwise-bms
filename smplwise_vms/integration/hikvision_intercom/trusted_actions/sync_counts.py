"""Per-station count projection candidate; person arrays never become results.

The injected source exposes repository metadata and an inventory ID set only
for the bound station. The source pending_users function is injected, not a
classic worker. No intent value, credential, private serializer or digest is
read. Proposed normalized field names do not activate the legacy sync route.
"""
from dataclasses import dataclass

from .adapters import EngineContext,closed
from .envelope import freeze,thaw
from .jobs import same_parameters
from .scoped_metadata import MetadataView
from .source_bindings import same_identities
from .validation import Refusal,Schema,reference

COUNT={'type':'integer','minimum':0,'maximum':10000}
COUNT_ROW=closed({'id':{'type':'string','minLength':1,'maxLength':128},
    'pending_users':COUNT,'managed_users':{'type':['integer','null'],'minimum':0,'maximum':10000},
    'operations':closed({state:COUNT for state in ('pending','failed','verified','settled')}),
    'revocations_pending':COUNT,'card_removals_pending':COUNT,'pin_removals_pending':COUNT,'deletions_pending':COUNT})
COUNT_RESULT=closed({'stations':{'type':'array','maxItems':1,'items':COUNT_ROW}})


@dataclass(frozen=True,repr=False)
class InventoryIds:
    station_id:str
    generation:str
    employee_ids:object


class SyncCounts:
    def __init__(self,*,current_state,current_inventory,fresh_view,current_mapping,pending_users):
        if not all(callable(value)for value in (current_state,current_inventory,fresh_view,current_mapping,pending_users)):raise ValueError('explicit bounded source, inventory, Arx and query providers required')
        self.state,self.inventory,self.view,self.mapping,self.pending=current_state,current_inventory,fresh_view,current_mapping,pending_users

    def _project(self,state,station):
        if type(state)is not dict:raise Refusal('binding_denied')
        uuid=Schema({'type':'string','format':'uuid'})
        def collection(name):
            value=state[name]
            if type(value)is not dict or len(value)>10000:raise Refusal('binding_denied')
            return value
        def routes(raw):
            targets,confirmed=raw['targets'],raw['confirmed']
            if type(targets)is not list or type(confirmed)is not list or len(targets)>100 or len(confirmed)>100 or any(type(s)is not str for s in [*targets,*confirmed])or len(set(targets))!=len(targets)or len(set(confirmed))!=len(confirmed)or not set(confirmed)<=set(targets):raise Refusal('binding_denied')
            for value in [*targets,*confirmed]:reference(value)
            return targets,confirmed
        projected={'users':{},'bindings':{},'tombstones':{},'retired_cards':{},'retired_pins':{}}
        for uid,raw in collection('users').items():
            uuid(uid)
            if type(raw)is not dict or type(raw['assignments'])is not dict or len(raw['assignments'])>100:raise Refusal('binding_denied')
            assignment=raw['assignments'].get(station)
            if assignment is None:projected['users'][uid]={'assignments':{}};continue
            if type(assignment)is not dict:raise Refusal('binding_denied')
            row={field:assignment[field]for field in ('sync_state','applied_revision','desired_revision')}
            Schema(closed({'sync_state':{'type':'string','enum':['synced','pending','syncing','offline','conflict','error','delete_pending']},
                'applied_revision':{'type':['integer','null'],'minimum':1},'desired_revision':{'type':'integer','minimum':1}}))(row)
            projected['users'][uid]={'assignments':{station:row}}
        bindings=collection('bindings').get(station,{})
        if type(bindings)is not dict or len(bindings)>10000:raise Refusal('binding_denied')
        public_bindings={};owned=set();revocations=0
        for uid,raw in bindings.items():
            uuid(uid)
            if type(raw)is not dict:raise Refusal('binding_denied')
            sync=raw.get('sync_state','pending')
            if type(sync)is not str or sync not in {'synced','pending','syncing','offline','conflict','error','delete_pending'}:raise Refusal('binding_denied')
            employee=raw['employee_no']
            if type(employee)is not str or not 1<=len(employee)<=32:raise Refusal('binding_denied')
            owned.add(employee)
            public_bindings[uid]={'intent':None if raw.get('intent')is None else True,'sync_state':sync}
            if uid in projected['users']and station not in projected['users'][uid]['assignments']:revocations+=1
        projected['bindings'][station]=public_bindings
        pending={}
        for name in ('tombstones','retired_cards','retired_pins'):
            total=0
            for key,raw in collection(name).items():
                reference(key)
                if type(raw)is not dict:raise Refusal('binding_denied')
                targets,confirmed=routes(raw)
                # Only route metadata is detached. PIN/card/record bodies and
                # intent hashes are never traversed or copied.
                item={'targets':list(targets),'confirmed':list(confirmed)}
                uuid(raw['user_id'])
                if name=='tombstones'and raw['user_id']!=key:raise Refusal('binding_denied')
                item['user_id']=raw['user_id']
                projected[name][key]=item
                if station in targets and station not in confirmed:total+=1
            pending[name]=total
        operations={key:0 for key in ('pending','failed','verified','settled')}
        for raw in collection('sync_operations').values():
            if type(raw)is not dict:raise Refusal('binding_denied')
            if raw['station_id']!=station:continue
            value=raw['state']
            if type(value)is not str or value not in operations:raise Refusal('binding_denied')
            operations[value]+=1
        return projected,owned,revocations,pending,operations

    async def read(self,params,context):
        if type(context)is not EngineContext or context.request.get('action')!='sync/status'or not same_parameters(params,{})or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        owners=(self.state,self.inventory,self.view,self.mapping,self.pending)
        state_for,inventory_for,view_for,mapping,pending_query=owners
        context.check();resolved=mapping(context.request);context.check()
        if type(resolved)is not dict or any(type(resolved.get(k))is not type(v)or resolved.get(k)!=v for k,v in thaw(context.request.get('target')).items()):raise Refusal('binding_denied')
        station=reference(resolved.get('config_entry_id'));mapped=freeze(resolved)
        def current():
            context.check()
            if not same_identities(owners,(self.state,self.inventory,self.view,self.mapping,self.pending))or not same_parameters(mapping(context.request),mapped):raise Refusal('binding_denied')
            context.check()
        async def view():
            current();value=await context.wait(lambda:view_for(context.request));current()
            if type(value)is not MetadataView or value.permission_revision!=context.request.get('operation')['permission_revision']or type(value.permission_revision)is not int or value.selection_revision!=context.request.get('selection_revision')or value.selection_revision!='rev1'or value.keys!=(station,)or value.station_id!=station or type(value.fields)is not frozenset or value.fields!=frozenset(COUNT_ROW['properties']):raise Refusal('permissions_changed')
            reference(value.view_reference);return value
        initial=await view();current();state=state_for(context.request);current()
        projected,owned,revocations,retired,operations=self._project(state,station)
        vector=freeze(projected)
        inventory=inventory_for(context.request);current()
        if type(inventory)is not InventoryIds or inventory.station_id!=station:raise Refusal('binding_denied')
        reference(inventory.generation)
        ids=inventory.employee_ids
        if ids is not None and (type(ids)is not frozenset or len(ids)>10000 or any(type(k)is not str or not 1<=len(k)<=32 for k in ids)):raise Refusal('binding_denied')
        pending=pending_query(projected,station);current()
        if type(pending)is not set or any(type(uid)is not str for uid in pending)or not same_parameters(projected,vector):raise Refusal('binding_denied')
        result={'stations':[{'id':station,'pending_users':len(pending),'managed_users':None if ids is None else len(ids&owned),
            'operations':operations,'revocations_pending':revocations,'card_removals_pending':retired['retired_cards'],
            'pin_removals_pending':retired['retired_pins'],'deletions_pending':retired['tombstones']}]}
        Schema(COUNT_RESULT)(result)
        if await view()!=initial:raise Refusal('permissions_changed')
        current()
        if state_for(context.request)is not state or self._project(state,station)!=(projected,owned,revocations,retired,operations):raise Refusal('binding_denied')
        fresh=inventory_for(context.request);current()
        if type(fresh)is not InventoryIds or fresh!=inventory:raise Refusal('binding_denied')
        current();return result
