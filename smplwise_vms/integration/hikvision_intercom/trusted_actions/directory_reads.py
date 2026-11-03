"""Bounded query over explicitly authorized public fields/UUIDs only.

Arx alone provides row/field authority. The query function is the injected
source read algorithm; it receives a projection, never private source records.
Empty query prevents phone/card search. Narrow filter/sort support is technical
profile scope, not a second RBAC. No classic repository public/get is called.
"""
from .envelope import thaw,freeze
from .repository_view import RepositoryPublicSource
from .safe_csv import ArxView,FIELDS,public_row,identity
from .validation import Refusal,Schema,reference

DIRECTORY_FIELDS=frozenset((*FIELDS,'active','archived_at'))

class PublicDirectory:
    def __init__(self,current_users,fresh_arx_view,query_users,clock,*,max_scope=2000):
        if not all(callable(v) for v in (current_users,fresh_arx_view,query_users,clock)) or type(max_scope)is not int or not 1<=max_scope<=10000:raise ValueError('explicit bounded public source, Arx view, query and clock required')
        self.current_users,self.fresh_arx_view,self.query_users,self.clock=current_users,fresh_arx_view,query_users,clock
        self.source=RepositoryPublicSource(current_users);self.max_scope=max_scope
    async def read(self,params,context):
        if params.get('query')!='' or params.get('filters',{}).get('sort') not in ('name','name_desc'):raise Refusal('invalid_fields')
        request=context.request;provider,state_provider,query,clock,source,limit=(self.fresh_arx_view,self.current_users,self.query_users,self.clock,self.source,self.max_scope)
        record_reader,row_reader=source._record,source.row
        def current():
            context.check()
            if (self.fresh_arx_view is not provider or self.current_users is not state_provider or self.query_users is not query or self.clock is not clock or
                self.source is not source or source.current_users is not state_provider or source._record!=record_reader or source.row!=row_reader or type(self.max_scope)is not int or self.max_scope!=limit):raise Refusal('binding_denied')
        async def view():
            current();value=await context.wait(lambda:provider(request));current()
            if (type(value)is not ArxView or type(value.permission_revision)is not int or value.permission_revision!=request.get('operation')['permission_revision'] or
                value.selection_revision!=request.get('selection_revision') or value.selection_revision!='rev1' or type(value.allowed_fields)is not frozenset or value.allowed_fields!=DIRECTORY_FIELDS):raise Refusal('permissions_changed')
            reference(value.view_reference)
            ids=value.authorized_person_ids
            if type(ids)is not tuple or len(ids)>limit or len(set(ids))!=len(ids):raise Refusal('binding_denied')
            for person in ids:identity(person)
            return value
        initial=await view();current();state=state_provider()
        if type(state)is not dict:raise Refusal('binding_denied')
        projected=[];bindings=[]
        for person in initial.authorized_person_ids:
            if await view()!=initial:raise Refusal('permissions_changed')
            current();raw=record_reader(person)
            raw_snapshot={k:(type(raw[k]),freeze(raw[k])) for k in (*FIELDS,'active','archived_at')}
            current();row=public_row(await context.wait(lambda:row_reader(initial,person)));current()
            selected={'id':row['person_id'],'revision':row['profile_revision'],**{k:row[k] for k in FIELDS},'active':raw['active'],'archived_at':raw['archived_at']}
            Schema({'type':'object','properties':{'active':{'type':'boolean'},'archived_at':{'type':['string','null'],'format':'date-time'}},'required':['active','archived_at'],'additionalProperties':False})({k:selected[k] for k in ('active','archived_at')})
            projected.append(selected);bindings.append((person,raw,selected,raw_snapshot))
        current();sample=clock();sample.check();request.check_time(sample.now)
        # Source snapshot_token hashes only public UUID/revision pairs. No body,
        # personal value, PIN or value hash is created or recorded here.
        result=query(projected,now=sample.now,permission_context=str(initial.permission_revision),**thaw(params))
        if type(result)is not dict or type(result.get('records'))is not list or type(result.get('limit'))is not int or result['limit']!=params['limit'] or len(result['records'])>params['limit']:raise Refusal('binding_denied')
        allowed={item['id']:item for item in projected}
        if any(type(item)is not dict or allowed.get(item.get('id'))is not item for item in result['records']):raise Refusal('binding_denied')
        if await view()!=initial:raise Refusal('permissions_changed')
        current()
        if state_provider()is not state:raise Refusal('binding_denied')
        for person,raw,selected,raw_snapshot in bindings:
            if state.get(person)is not raw or raw['id']!=selected['id'] or type(raw['revision'])is not int or raw['revision']!=selected['revision']:raise Refusal('binding_denied')
            # No extra source keys, serialization, hashing or private snapshots.
            if any(type(raw[k])is not raw_snapshot[k][0] or raw[k]!=thaw(raw_snapshot[k][1]) for k in (*FIELDS,'active','archived_at')):raise Refusal('binding_denied')
        current();return result
