"""Closed safe CSV producer. No classic export, credential or device API is read.

PublicSource and ArxView are injected trusted capabilities. A view is a fresh Arx
decision, not a WisKey permission calculation. No global provider is supplied.
"""
from __future__ import annotations

import json
import re
import unicodedata
from types import MethodType
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from .envelope import Request, freeze, thaw
from .producer import Adapter
from .validation import Refusal, Schema, aware, integer, reference, resources

VERSION='wiskey-arx-safe-csv-draft.3'
FIELDS=('display_name','valid_from','valid_until','group_ids')
METADATA=('person_id','profile_revision')
TTL_SECONDS=600
MAX_SLOTS=500
MAX_BYTES=1048576


class CsvRefusal(Refusal):
    def public(self):
        result={'kind':'csv_refusal','code':self.code}
        if self.code=='invalid_field':result['field']=self.field
        return result


def identity(value):
    try:
        if type(value) is not str or str(UUID(value))!=value:raise ValueError
    except (ValueError,AttributeError):raise CsvRefusal('invalid_field','person_id') from None
    return value


def validity(start,end):
    if start is None and end is None:return None,None
    if start is None or end is None:raise CsvRefusal('invalid_field','valid_until' if end is None else 'valid_from')
    parsed=[]
    for field,value in [('valid_from',start),('valid_until',end)]:
        try:
            point=aware(value)
            if not datetime(1970,1,1,tzinfo=UTC)<=point<=datetime(2037,12,31,23,59,59,tzinfo=UTC):raise Refusal()
            parsed.append(point)
        except Refusal:raise CsvRefusal('invalid_field',field) from None
    if parsed[1]<=parsed[0]:raise CsvRefusal('invalid_field','valid_until')
    # Keep microseconds when needed; never collapse distinct instants into equal seconds.
    precision='microseconds' if any(p.microsecond for p in parsed) else 'seconds'
    return tuple(p.isoformat(timespec=precision) for p in parsed)


def public_row(source):
    """Access exactly six approved keys, not __dict__/asdict/classic export."""
    def get(field):
        try:return source[field]
        except (KeyError,TypeError):raise CsvRefusal('invalid_field',field) from None
    person=identity(get('person_id'))
    try:revision=integer(get('profile_revision'),1)
    except Refusal:raise CsvRefusal('invalid_field','profile_revision') from None
    name=get('display_name')
    if type(name) is not str or not 1<=len(name)<=32 or any(ord(c)<32 for c in name) or unicodedata.normalize('NFC',name)!=name or not name.strip():
        raise CsvRefusal('invalid_field','display_name')
    name=name.strip()
    start,end=validity(get('valid_from'),get('valid_until'))
    groups=get('group_ids')
    if type(groups) is not list or len(groups)>64 or any(type(g) is not str or re.fullmatch('[a-z][a-z0-9_]{0,47}',g) is None for g in groups) or len(set(groups))!=len(groups):
        raise CsvRefusal('invalid_field','group_ids')
    return {'person_id':person,'profile_revision':revision,'display_name':name,'valid_from':start,'valid_until':end,'group_ids':sorted(groups)}


@dataclass(frozen=True,repr=False)
class ArxView:
    """Only the trusted Arx decision provider constructs this internal view."""
    view_reference: str
    permission_revision: int
    selection_revision: str
    allowed_fields: frozenset[str]
    authorized_person_ids: tuple[str,...]|None=None


@dataclass(repr=False)
class _Export:
    snapshot_id: str
    export_revision: str
    created: datetime
    binding: object
    vector: tuple
    offset: int=0
    next_cursor: str|None=None
    invalid: bool=False
    last_observed: datetime|None=None
    owners: tuple=()
    issuer: object=None


class SafeCsv:
    """Source contract: async vector(view) -> [(public UUID, revision)], row(view,id).

    Both calls operate only on the authorized public set. This class never scans
    unauthorized classic users or computes roles. Without both injected providers
    registration/use is impossible. Cursors store public vector metadata only.
    """
    def __init__(self, source, fresh_arx_view, clock):
        self.source=source;self.fresh_arx_view=fresh_arx_view;self.clock=clock
        self._cursors={}
        self._exports={}
        self._session_owners={}
        self._table_owners=(self._cursors,self._exports,object(),self._session_owners)
        self._creation_tables=self._table_owners
        self.schemas=resources()

    def _check_namespace(self):
        tables=self._creation_tables
        if (self._table_owners is not tables or self._cursors is not tables[0]
            or self._exports is not tables[1] or self._session_owners is not tables[3]):
            self.clear();raise CsvRefusal('cursor_stale')

    def _owns(self,session):
        # Cleanup ownership cannot depend on writable session metadata. The
        # bounded registry contains only this instance's live resource objects,
        # not action results, permissions or source fixtures from other cases.
        if type(session) is not _Export:return False
        record=self._creation_tables[3].get(id(session))
        return type(record) is tuple and len(record)==2 and record[0] is session and type(record[1]) is tuple and len(record[1])==10

    @staticmethod
    def _session_state(session):
        return (session.snapshot_id,session.export_revision,session.created,session.binding,session.vector,
                session.offset,session.next_cursor,session.last_observed,session.owners,session.issuer)

    def _require_session(self,session,state):
        if not self._owns(session) or type(session.invalid) is not bool or session.invalid or session.issuer is not self._creation_tables[2] or self._creation_tables[1].get(state[0]) is not session:raise CsvRefusal('cursor_stale')
        current=self._session_state(session)
        if type(current[5]) is not int or current[5]!=state[5] or any(a is not b for index,(a,b) in enumerate(zip(current,state)) if index!=5):raise CsvRefusal('cursor_stale')

    def _schema(self,name,*,with_resources=False):
        # Decode the current owned JSON definitions each time, not an earlier
        # validator/verdict. This retains checks after schema mutation while
        # avoiding recursive Python deepcopy of every resource on each page.
        return Schema.from_json(json.dumps(self.schemas[name],ensure_ascii=True,allow_nan=False),
            resources_text=json.dumps(self.schemas,ensure_ascii=True,allow_nan=False) if with_resources else None)

    def _owners(self):
        self._check_namespace()
        def method_id(value):
            return (value.__self__,value.__func__) if type(value)is MethodType else (value,)
        source=self.source
        return (source,*method_id(getattr(source,'vector',None)),*method_id(getattr(source,'row',None)),self.fresh_arx_view,
                self.clock,getattr(self.clock,'provider',None),getattr(source,'current_users',None),*self._creation_tables)

    def _owned_guard(self,check,expected=None):
        expected=self._owners() if expected is None else expected
        def same():
            current=self._owners()
            if len(current)!=len(expected) or any(a is not b for a,b in zip(expected,current)):raise CsvRefusal('cursor_stale')
        def owned():
            same();allowed=check() if check is not None else False;same();return allowed
        return owned

    def _now(self,request=None):
        sample=self.clock();sample.check()
        if request is not None and sample.now>=aware(request.get('request_expires_at')):
            raise CsvRefusal('cursor_stale')
        return sample.now

    def clear(self):
        for record in tuple(self._creation_tables[3].values()):
            if type(record) is tuple and len(record)==2:self._invalidate(record[0])

    def _checkpoint(self,request,check):
        if check is None or check() is not True:raise Refusal('binding_denied')
        now=self._now(request)
        if check() is not True:raise Refusal('binding_denied')
        return now

    async def _view(self,request,check):
        self._checkpoint(request,check)
        view=await self.fresh_arx_view(request)
        self._checkpoint(request,check)
        if type(view) is not ArxView:raise CsvRefusal('cursor_stale')
        if view.permission_revision!=request.get('operation')['permission_revision'] or view.selection_revision!='rev2' or view.allowed_fields!=frozenset(FIELDS):
            raise CsvRefusal('cursor_stale')
        integer(view.permission_revision);reference(view.view_reference)
        return view

    def _binding(self,request):
        return freeze({'actor':thaw(request.get('actor')),'grant_id':request.get('grant')['grant_id'],
                       'grant_revision':request.get('grant')['grant_revision'],'permission_revision':request.get('operation')['permission_revision'],
                       'selection_revision':request.get('selection_revision'),'target':thaw(request.get('target'))})

    async def _vector(self,view):
        raw=await self.source.vector(view)
        if type(raw) not in (tuple,list):raise CsvRefusal('cursor_stale')
        pairs=[]
        for entry in raw:
            if type(entry) not in (tuple,list) or len(entry)!=2:raise CsvRefusal('cursor_stale')
            try:pairs.append((identity(entry[0]),integer(entry[1],1)))
            except Refusal:raise CsvRefusal('cursor_stale') from None
        if len({p[0] for p in pairs})!=len(pairs):raise CsvRefusal('cursor_stale')
        return tuple(sorted(pairs))

    def _invalidate(self,session):
        if not self._owns(session):return
        session.invalid=True
        cursors,exports,_,registry=self._creation_tables
        for table in (cursors,exports):
            for key,owner in tuple(table.items()):
                if owner is session:del table[key]
        registry.pop(id(session),None)

    def _prune(self,now):
        for record in tuple(self._creation_tables[3].values()):
            if type(record) is not tuple or len(record)!=2:self.clear();raise CsvRefusal('cursor_stale')
            session,state=record
            try:self._require_session(session,state)
            except CsvRefusal:self.clear();raise
            if (now-session.created).total_seconds()>=TTL_SECONDS or now<session.created:self._invalidate(session)

    async def inspect(self,parameters,request,check=None):
        check=self._owned_guard(check)
        params=thaw(parameters)
        self._schema('SAFE_CSV_INSPECT.draft3.schema.json')(params)
        self._checkpoint(request,check);view=await self._view(request,check)
        result={'profile_schema_version':VERSION,'headers':list(params['headers']),
                'field_mapping':{h:h for h in params['headers']},'permission_revision':view.permission_revision,'selection_revision':'rev2'}
        self._schema('SAFE_CSV_INSPECT_RESULT.draft3.schema.json')(result)
        fresh=await self._view(request,check)
        if fresh!=view:raise CsvRefusal('cursor_stale')
        self._checkpoint(request,check);return result

    async def export(self,parameters,request,check=None):
        params=thaw(parameters)
        self._schema('SAFE_CSV_EXPORT.draft3.schema.json')(params)
        # Capture the referenced owner before a guard/time failure, so that a
        # refused continuation cannot leave its old export/cursors usable.
        session=self._creation_tables[0].get(params.get('cursor_reference'));state=None
        try:
            if session is not None:
                if not self._owns(session):self.clear();session=None;raise CsvRefusal('cursor_stale')
                state=self._creation_tables[3][id(session)][1]
            base_check=self._owned_guard(check,session.owners if session is not None else None)
            def current():
                allowed=base_check()
                if session is not None and state is not None:self._require_session(session,state)
                return allowed
            check=current
            now=self._checkpoint(request,check);self._prune(now)
            binding=self._binding(request)
            if 'cursor_reference' in params:
                if session is None or self._cursors.get(params['cursor_reference']) is not session:raise CsvRefusal('cursor_stale')
                if session.invalid or session.binding!=binding or now<session.last_observed or (now-session.created).total_seconds()>=TTL_SECONDS:raise CsvRefusal('cursor_stale')
                # Single-consumption cursor; never cache or redispatch a previous page.
                del self._cursors[params['cursor_reference']]
            view=await self._view(request,check)
            vector=await self._vector(view)
            self._checkpoint(request,check)
            if session is None:
                if len(self._creation_tables[3])>=128:raise CsvRefusal('cursor_stale')
                session=_Export('snapshot-'+uuid4().hex,'export-'+uuid4().hex,now,binding,vector,last_observed=now,owners=self._owners(),issuer=self._creation_tables[2])
                self._creation_tables[3][id(session)]=(session,self._session_state(session))
                self._exports[session.snapshot_id]=session
                state=self._session_state(session)
            if session.vector!=vector:raise CsvRefusal('cursor_stale')
            batch=vector[session.offset:session.offset+params['page_size']]
            rows=[]
            for person,revision in batch:
                row_view=await self._view(request,check)
                if row_view!=view:raise CsvRefusal('cursor_stale')
                row=public_row(await self.source.row(view,person))
                self._checkpoint(request,check)
                if await self._view(request,check)!=view:raise CsvRefusal('cursor_stale')
                if row['person_id']!=person or row['profile_revision']!=revision:raise CsvRefusal('cursor_stale')
                rows.append(row)
            # Recheck fresh Arx authorization and whole public vector after awaits.
            fresh=await self._view(request,check)
            if fresh!=view or await self._vector(fresh)!=session.vector:raise CsvRefusal('cursor_stale')
            # The vector provider awaited above may outlive the Arx decision.
            # The trusted view provider must sample its decision at return, with
            # no further await between this comparison and exposing the page.
            final_view=await self._view(request,check)
            if final_view!=view:raise CsvRefusal('cursor_stale')
            end=self._checkpoint(request,check)
            if end<now or (end-session.created).total_seconds()>=TTL_SECONDS:raise CsvRefusal('cursor_stale')
            offset=session.offset+len(batch);more=offset<len(vector)
            page={'schema_version':VERSION,'generated_at':end.isoformat(),'snapshot_id':session.snapshot_id,
                  'export_revision':session.export_revision,'permission_revision':final_view.permission_revision,'selection_revision':'rev2',
                  'snapshot_mode':'revision_checked','records':rows,'rejected_records':[],
                  'page_record_count':len(rows),'export_complete':not more,'has_more':more}
            if more:page['next_cursor_reference']='cursor-'+uuid4().hex
            self._schema('SAFE_CSV_EXPORT_PAGE.draft3.schema.json',with_resources=True)(page)
            # Budget includes all metadata/cursor/UTF-8 bytes, never compressed size or body hash.
            if len(json.dumps(page,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode('utf8'))>MAX_BYTES:raise CsvRefusal('record_too_large')
            if len(rows)+len(page['rejected_records'])>MAX_SLOTS:raise CsvRefusal('record_too_large')
            session.offset=offset;session.last_observed=end
            if more:
                session.next_cursor=page['next_cursor_reference'];self._cursors[session.next_cursor]=session
                # Only this successful publication advances the owned public
                # metadata seal. It is not an authority/result cache, and an
                # idle cursor cannot silently acquire a different offset/birth.
                self._creation_tables[3][id(session)]=(session,self._session_state(session))
            else:self._invalidate(session)
            return page
        except CsvRefusal as err:
            if session is not None:self._invalidate(session)
            result=err.public();self._schema('CSV_FAILURE.draft3.schema.json')(result);return result
        except BaseException:
            if session is not None:self._invalidate(session)
            raise

    def register(self,registry):
        # Current public JSON definitions, not source/request/decision state.
        # Each validator decodes a separate resources tree; no owner can mutate
        # a sibling's definitions. General Schema(deepcopy) semantics stay intact.
        resource_text=json.dumps(self.schemas,ensure_ascii=True,allow_nan=False)
        for action,param_name,result_name,delegate in [
            ('users/csv_inspect','SAFE_CSV_INSPECT.draft3.schema.json','SAFE_CSV_INSPECT_RESULT.draft3.schema.json',self.inspect),
            ('users/csv_export','SAFE_CSV_EXPORT.draft3.schema.json','SAFE_CSV_EXPORT_PAGE.draft3.schema.json',self.export)]:
            definition=self.schemas[param_name]
            output={'oneOf':[self.schemas[result_name],self.schemas['CSV_FAILURE.draft3.schema.json']]}
            fields=tuple(self.schemas[result_name]['properties'])+tuple(k for k in self.schemas['CSV_FAILURE.draft3.schema.json']['properties'] if k not in self.schemas[result_name]['properties'])
            registry.register(action,Adapter(definition['$id'],'3',Schema.from_json(json.dumps(definition),resources_text=resource_text),Schema.from_json(json.dumps(output),resources_text=resource_text),delegate,fields,with_request=True,with_guard=True))
