"""Bounded <=15s legacy capture receiver; deliberately separate from lease.

Source collector/enrollment/connection and target mapping are injected. No
service registration, hardware client discovery, Arx role or lease is created.
The original start decision never extends beyond its request TTL.
"""
from .source_bindings import same_identities,same_ports

from dataclasses import dataclass
from contextvars import ContextVar,copy_context
import asyncio
from types import MethodType,MappingProxyType
from .adapters import EngineContext
from .envelope import freeze,thaw
from .jobs import same_parameters
from .validation import Refusal,reference
from .lifetime import raise_if_cancelling,join_cleanup

_confirm_scope=ContextVar('wiskey_legacy_confirm_scope',default=None)
_retire_scopes=ContextVar('wiskey_legacy_capture_retire_scopes',default=())

def current_confirm_context(receiver):
    """Internal source hook; child tasks cannot inherit a writing authority."""
    item=_confirm_scope.get()
    if item is None or item[0] is not receiver or item[2] is not asyncio.current_task() or receiver.closed:
        raise Refusal('binding_denied')
    item[1].check();return item[1]

def current_confirm_birth(receiver):
    current_confirm_context(receiver)
    return _confirm_scope.get()[3]

@dataclass(frozen=True,repr=False)
class CaptureReference:
    session_id:str
    actor:object
    epoch:str
    station:str
    person:str
    revision:int
    mapping:object
    owners:tuple
    reader:int
    source_session:object
    authorizer:object
    collector:object
    expiry_timer:object
    dropper:object

def _capture_values(birth):
    return (birth.session_id,birth.actor,birth.epoch,birth.station,birth.person,birth.revision,
        birth.mapping,birth.owners,birth.reader,birth.source_session,birth.authorizer,
        birth.collector,birth.expiry_timer,birth.dropper)

@dataclass(frozen=True,repr=False)
class _CaptureRecord:
    birth:object
    values:tuple
    permission_timer:object
    cleanup:list
    issuer:object

@dataclass(frozen=True,repr=False)
class _CaptureOwner:
    source:object
    manager:object
    maps:tuple
    source_operations:object
    manager_operations:list
    port_reader:object
    mapping:object
    connection:object
    revision:list
    completion:list
    limit:int
    admitted_limit:list
    births:dict
    issuer:object
    life:list

class LegacyCaptureReceiver:
    def __init__(self, *, enrollment, current_mapping, connection_owner, person_revision, limit=128):
        if enrollment is None or not all(callable(x) for x in (current_mapping,connection_owner,person_revision)) or type(limit) is not int or not 1<=limit<=128:
            raise ValueError('explicit bounded legacy capture source ports required')
        self.enrollment,self.mapping,self.connection,self.revision=enrollment,current_mapping,connection_owner,person_revision
        self._source_owner=enrollment
        self._source_manager=enrollment.manager
        self._manager_operations=self._manager_ports()
        self._owned_manager_operations=self._manager_operations
        self._manager_port_reader=self._manager_ports
        self._completion=None;self._bound_completion=None
        self._source_sessions=getattr(enrollment,'sessions',None)
        if type(self._source_sessions) is not dict:raise ValueError('explicit source session pool required')
        self._owned_tasks=set();self._inflight=set();self._closing=None
        self._source_operations=MappingProxyType({name:getattr(enrollment,name,None) for name in ('start','status','confirm','cancel','close_station','_client','_get','_authorized','_collect','_drop','_expire','_check_permission','_retire_birth')})
        native_cleanup=self._source_operations['_retire_birth']
        if native_cleanup is not None and (type(native_cleanup)is not MethodType or native_cleanup.__self__ is not enrollment):
            raise ValueError('original bound native capture cleanup required')
        self._owned_source_operations=self._source_operations
        self.limit,self.closed=limit,False;self._sessions={};self._used=set()
        self._owned_maps=(self._sessions,self._used,self._owned_tasks,self._inflight,self._source_sessions)
        self._creation=_CaptureOwner(enrollment,self._source_manager,self._owned_maps,
            self._source_operations,[self._manager_operations],self._manager_port_reader,
            current_mapping,connection_owner,[person_revision],[None,None],limit,[None],{},object(),[False,None])
    def _maps_current(self):
        o=self._creation
        return (self._owned_maps is o.maps and same_identities(o.maps,(self._sessions,self._used,self._owned_tasks,self._inflight,self._source_sessions))
            and type(self.limit)is int and 1<=self.limit<=o.limit
            and (o.admitted_limit[0] is None or self.limit==o.admitted_limit[0]))
    def _source_bindings_current(self):
        o=self._creation
        return (self.enrollment is o.source and self._source_owner is o.source
            and self._source_manager is o.manager and o.source.manager is o.manager
            and self.mapping is o.mapping and self.connection is o.connection
            and same_ports((self.revision,),(o.revision[0],))
            and self._completion is o.completion[0] and self._bound_completion is o.completion[0]
            and self._source_operations is o.source_operations and self._owned_source_operations is o.source_operations
            and self._manager_operations is o.manager_operations[0] and self._owned_manager_operations is o.manager_operations[0]
            and same_ports((self._manager_port_reader,),(o.port_reader,))
            and same_ports((o.port_reader,),(self._manager_ports,)))
    def _check_creation(self):
        o=self._creation
        if (o.life[0] or self.closed or not self._maps_current() or not self._source_bindings_current()
            or getattr(o.source,'sessions',None)is not o.maps[4]):raise Refusal('binding_denied')
    def _check_birth(self,birth):
        record=self._creation.births.get(id(birth))
        if (type(birth)is not CaptureReference or type(record)is not _CaptureRecord or record.issuer is not self._creation.issuer
            or record.birth is not birth or not same_identities(record.values,_capture_values(birth))):raise Refusal('binding_denied')
        return record
    def _manager_ports(self):
        manager=self.enrollment.manager
        return manager,getattr(manager,'repository',None),getattr(getattr(manager,'repository',None),'get',None),getattr(manager,'async_update',None),getattr(manager,'_station',None),getattr(manager,'_driver',None),getattr(manager,'_task_factory',None)
    def bind_source_completion(self,completion):
        from .source_capture_completion import SourceCaptureCompletion
        o=self._creation
        if o.life[0] or self.closed or not self._maps_current() or not self._source_bindings_current() or self._completion is not None or self._used or self._sessions or type(completion) is not SourceCaptureCompletion or completion.receiver is not None or completion.repository is not self._source_manager.repository:
            raise ValueError('one owned capture source binding before admission required')
        self._completion=completion;self._bound_completion=completion
        o.completion[:]=[completion,SourceCaptureCompletion.close];completion.bind(self)
        self.revision=completion.current_revision
        o.revision[0]=self.revision
        self._source_manager.async_update=completion.update
        self._manager_operations=self._manager_ports()
        self._owned_manager_operations=self._manager_operations
        o.manager_operations[0]=self._manager_operations
    def _ports(self):return self.enrollment,self.mapping,self.connection,self.revision,self.limit,self._source_owner,self._source_operations,self._completion,self._bound_completion,self._manager_operations,self._source_sessions,getattr(self._source_owner,'sessions',None),self._owned_maps
    async def execute(self,action,params,context):
        o=self._creation
        if o.life[0] or not self._maps_current() or not self._source_bindings_current():raise Refusal('binding_denied')
        inflight=o.maps[3];task=asyncio.current_task();inflight.add(task)
        try:return await self._execute(action,params,context)
        finally:inflight.discard(task)

    async def _execute(self, action, params, context):
        if type(context) is not EngineContext or context.parameters is None or params is not context.parameters and not same_parameters(params,context.parameters) or action!=context.request.get('action') or action not in ('cards/capture_start','cards/capture_status','cards/capture_confirm','cards/capture_cancel'):
            raise Refusal('binding_denied')
        context.check();actor=context.request.get('actor')
        if actor['kind']!='human':raise Refusal('binding_denied')
        if self._creation.life[0] or self.closed or not self._maps_current() or not self._source_bindings_current() or self._completion is not self._bound_completion or getattr(self._source_owner,'sessions',None) is not self._source_sessions:raise Refusal('binding_denied')
        if self._creation.admitted_limit[0] is None:self._creation.admitted_limit[0]=self.limit
        sessions,used,tasks,_,source_sessions=self._creation.maps
        if self._bound_completion is not None:self._bound_completion.check_binding()
        # An absent source row releases only its adapter slot. Original owned
        # cleanup still runs; absence is not proof of resource retirement.
        for old_sid,old_birth in tuple(sessions.items()):
            if source_sessions.get(old_sid) is None and sessions.get(old_sid) is old_birth:
                sessions.pop(old_sid,None);await self._retire_source(old_birth)
        context.check()
        self._check_creation()
        ports=self._ports();source,mapping,connection,revision,_,source_owner,operations,*_=ports
        if getattr(source_owner,'sessions',None) is not self._source_sessions:raise Refusal('binding_denied')
        bound=None;allow_missing=False
        manager_ports=self._manager_operations if self._completion is not None else self._manager_ports()
        mapped=mapping(context.request)
        self._check_creation()
        if type(mapped) is not dict or any(type(mapped.get(k)) is not type(v) or mapped.get(k)!=v for k,v in thaw(context.request.get('target')).items()):raise Refusal('binding_denied')
        station=reference(mapped.get('config_entry_id'));owner=tuple(connection(station))
        self._check_creation()
        if not owner or any(x is None for x in owner):raise Refusal('binding_denied')
        target=freeze(mapped);admission=context
        def check():
            admission.check()
            self._check_creation()
            if self._bound_completion is not None:self._bound_completion.check_binding()
            if self._creation.life[0] or self.closed or not self._maps_current() or not self._source_bindings_current() or not same_identities(ports,self._ports()) or not same_parameters(mapping(context.request),target):raise Refusal('binding_denied')
            if source is not source_owner:raise Refusal('binding_denied')
            self._check_creation()
            managers=self._manager_ports()
            if self._source_manager is not source.manager or getattr(self._source_manager,'_closed',None) is not False:raise Refusal('binding_denied')
            if not same_ports(manager_ports,managers):raise Refusal('binding_denied')
            for name,method in operations.items():
                actual=getattr(source,name,None)
                same=method.__self__ is actual.__self__ and method.__func__ is actual.__func__ if type(method) is MethodType and type(actual) is MethodType else method is actual
                if not same:raise Refusal('binding_denied')
            fresh=tuple(connection(station))
            self._check_creation()
            if len(fresh)!=len(owner) or any(a is not b for a,b in zip(fresh,owner)):raise Refusal('binding_denied')
            if bound is not None:self._check_session(bound,allow_missing=allow_missing)
            admission.check()
            self._check_creation()
            if not same_identities(ports,self._ports()) or not same_ports(manager_ports,self._manager_ports()):raise Refusal('binding_denied')
            if bound is not None:self._check_session(bound,allow_missing=allow_missing)
        if action=='cards/capture_start':
            actual_revision=revision(params['user_id'])
            self._check_creation()
            if params['station_id']!=station or type(actual_revision) is not int or actual_revision!=params['revision']:raise Refusal('binding_denied')
            key=context.request.get('operation_binding_ref')
            if key in used or len(used)>=4096 or len(self._creation.births)>=4096 or len(sessions)>=self.limit:raise Refusal('unproven_duplicate')
            used.add(key);check();raise_if_cancelling()
            def authorize():
                try:
                    check();value=revision(params['user_id']);return type(value) is int and value==params['revision']
                except Exception:return False
            value=operations['start'](station,params['user_id'],params['revision'],params['reader_id'],actor['user_id'],authorize=authorize)
            sid=reference(value['session_id']);row=source_sessions.get(sid)
            collector=getattr(row,'task',None);expiry=getattr(row,'timer',None)
            bound=CaptureReference(sid,actor,context.epoch,station,params['user_id'],params['revision'],target,owner,params['reader_id'],row,authorize,collector,expiry,operations['_drop'])
            self._creation.births[id(bound)]=_CaptureRecord(bound,_capture_values(bound),getattr(row,'permission_timer',None),[None],self._creation.issuer)
            if isinstance(collector,asyncio.Task):tasks.add(collector)
            try:
                check();raise_if_cancelling()
                if sid in sessions:raise Refusal('unproven_duplicate')
                sessions[sid]=bound
                return value
            except BaseException:
                # This resource exists before our final admission check. It is
                # cleanup of the just-created collector, never a new write or
                # authority to cancel another caller's station sessions.
                await self._retire_source(bound)
                raise
        sid=reference(params['session_id']);birth=sessions.get(sid)
        LegacyCaptureReceiver._check_birth(self,birth)
        if type(birth) is not CaptureReference or birth.actor!=actor or birth.epoch!=context.epoch or birth.station!=station or not same_parameters(birth.mapping,target) or len(owner)!=len(birth.owners) or any(a is not b for a,b in zip(owner,birth.owners)):
            raise Refusal('binding_denied')
        bound=birth
        try:
            self._check_session(birth)
            actual_revision=revision(birth.person)
            if type(actual_revision) is not int or actual_revision!=birth.revision:raise Refusal('binding_denied')
            check()
        except BaseException:
            # The owned source would drop a stale/unauthorized session in
            # _get(). Our earlier revision guard must retain that cleanup,
            # including joining this exact collector before returning.
            if sessions.get(sid) is birth:sessions.pop(sid,None)
            await self._retire_source(birth)
            raise
        if action=='cards/capture_status':
            result=operations['status'](sid,actor['user_id']);check();return result
        sessions.pop(sid,None)  # never restore authority after possible confirm
        allow_missing=True
        if action=='cards/capture_cancel':
            try:
                await context.wait(lambda:operations['cancel'](sid,actor['user_id']));check();return {'cancelled':True}
            except BaseException:
                await self._retire_source(birth)
                raise
        admitted=context
        def confirm_current(_):check();return True
        context=EngineContext.scoped(admitted,confirm_current);context.trace=admitted.trace
        marker=_confirm_scope.set((self,context,asyncio.current_task(),birth))
        try:
            result=await context.wait(lambda:operations['confirm'](sid,actor['user_id'],params['label']))
        except BaseException:
            # The receiver's authority is already retired. Drop/join this
            # exact source session even when no confirm body was entered.
            await self._retire_source(birth)
            raise
        finally:_confirm_scope.reset(marker)
        check()
        # Only proven public person fields leave this source receiver. Source
        # broad serializers and private card values stay on the source side.
        return {field:result[field] for field in ('id','revision','display_name','valid_from','valid_until','group_ids')}
    def _check_session(self,birth,*,allow_missing=False):
        LegacyCaptureReceiver._check_birth(self,birth)
        pool=self._creation.maps[4]
        if getattr(self._source_owner,'sessions',None) is not pool:raise Refusal('binding_denied')
        row=pool.get(birth.session_id)
        if row is None and allow_missing:return
        if row is not birth.source_session or row is None or getattr(row,'authorize',None) is not birth.authorizer:raise Refusal('binding_denied')
        expected={'id':birth.session_id,'actor':birth.actor['user_id'],'station_id':birth.station,'user_id':birth.person,'revision':birth.revision,'reader_id':birth.reader}
        if any(type(getattr(row,name,None)) is not type(value) or getattr(row,name)!=value for name,value in expected.items()):raise Refusal('binding_denied')
        task=getattr(row,'task',None)
        if not isinstance(birth.collector,asyncio.Task) or task is not birth.collector and not (task is None and birth.collector.done()) or getattr(row,'timer',None) is not birth.expiry_timer:raise Refusal('binding_denied')

    async def _retire_source(self,birth):
        o=self._creation;record=o.births.get(id(birth))
        # Cleanup never adopts a copied/foreign birth or reads its fields.
        if type(record)is not _CaptureRecord or record.issuer is not o.issuer or record.birth is not birth:return
        original=CaptureReference(*record.values);task=original.collector
        if record.cleanup[0] is None:
            async def retire():
                active=[True];marker=_retire_scopes.set((*_retire_scopes.get(),(o,record,active)))
                try:
                    pool=o.maps[4];row=original.source_session
                    if type(pool)is dict and pool.get(original.session_id)is row:pool.pop(original.session_id,None)
                    # The original row may have been detached from every table.
                    # Absence is not proof its private captured value was cleared.
                    if row is not None:row.card=None
                    native_cleanup=o.source_operations.get('_retire_birth')
                    if native_cleanup is not None:
                        # This bound port was captured from the original source
                        # constructor. It owns its private latest timer/card/task;
                        # no copied row fields or callback labels select cleanup.
                        actual=native_cleanup(row)
                        if actual is not None and actual is not task:
                            raise Refusal('binding_denied')
                        if actual is None and isinstance(task,asyncio.Task) and not asyncio.Task.done(task):
                            raise Refusal('binding_denied')
                    else:
                        # Historical injected sources lack the new private birth
                        # receipt. Their successor timer lineage remains OPEN.
                        for timer in (original.expiry_timer,record.permission_timer):
                            if isinstance(timer,asyncio.TimerHandle):timer.cancel()
                    if isinstance(task,asyncio.Task):
                        if native_cleanup is None and not task.done():task.cancel()
                        await asyncio.gather(task,return_exceptions=True)
                        o.maps[2].discard(task)
                finally:
                    active[0]=False;_retire_scopes.reset(marker)
            record.cleanup[0]=asyncio.create_task(retire())
        if asyncio.current_task()is task or any(owner is o and item is record and active[0]for owner,item,active in _retire_scopes.get()):return
        await join_cleanup(lambda:record.cleanup[0])

    def owns_current(self):
        task=asyncio.current_task()
        o=self._creation
        return (task in o.maps[3] or any(type(record)is _CaptureRecord and record.issuer is o.issuer and record.values[11]is task for record in o.births.values())
            or any(owner is o and active[0]for owner,_,active in _retire_scopes.get()))

    async def close(self):
        o=self._creation;o.life[0]=self.closed=True;owned=LegacyCaptureReceiver.owns_current(self)
        if o.life[1] is None:
            records=tuple(record for record in o.births.values()if type(record)is _CaptureRecord and record.issuer is o.issuer);o.maps[0].clear()
            inflight=tuple(o.maps[3])
            async def closing():
                for task in inflight:task.cancel()
                if inflight:await asyncio.gather(*inflight,return_exceptions=True)
                for record in records:await LegacyCaptureReceiver._retire_source(self,record.birth)
                o.maps[2].clear()
                o.births.clear()
                if o.completion[0] is not None:o.completion[1](o.completion[0])
            # A parent must join its records, not inherit one child's deferral.
            scope=copy_context();scope.run(_retire_scopes.set,tuple(item for item in _retire_scopes.get()if item[0]is not o))
            o.life[1]=self._closing=asyncio.create_task(closing(),context=scope)
        if owned:return
        cancelled=False
        while not o.life[1].done():
            try:await asyncio.shield(o.life[1])
            except asyncio.CancelledError:cancelled=True
        o.life[1].result()
        if cancelled:raise asyncio.CancelledError()
