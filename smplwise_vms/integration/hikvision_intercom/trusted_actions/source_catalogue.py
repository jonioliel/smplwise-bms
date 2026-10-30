"""Versioned local-source candidate, isolated from the legacy catalogue.

All 45/47 selection names and DTOs remain unchanged. New local schema IDs are
review candidates; they are not adopted Arx contracts or runtime registrations.
A TemporaryDirectory capability and explicit typed source ports are required.
"""
from dataclasses import dataclass,replace
from pathlib import Path
import tempfile
from types import MethodType,MappingProxyType
from .adapters import AdapterSpec,SourceRef,build_adapter,closed
from .envelope import freeze,thaw
from .validation import Refusal
from .producer import PUBLIC_ERRORS
from .profiles import catalog_profile,closed_local_profiles,FROZEN
from .source_mutations import SourceUserMutations
from .event_projection import SelectedEvents,LIST_REQUEST,LIST_RESULT,DETAIL_REQUEST,DETAIL_RESULT,EXPORT_REQUEST,EXPORT_RESULT
from .card_receiver import ManagedCardReceiver
from .sensitive_producers import OpaquePeople
from .messaging import OpaqueMessaging
from .legacy_capture import LegacyCaptureReceiver
from .source_bindings import same_ports,same_identities

VERSION='wiskey-local-source-candidate.1'
DEVELOPMENT_ONLY=True
MUTATIONS=frozenset({'users/create','users/update','users/archive','users/unarchive','users/set_active','users/temporary_cancel'})
EVENTS=frozenset({'events/list','events/detail','events/export'})
CARDS=frozenset({'cards/add','cards/remove'})
SENSITIVE=frozenset({'users/photo_get','users/pin_generate'})
MESSAGING=frozenset({'whatsapp/preview','whatsapp/send'})
CAPTURE=frozenset({'cards/capture_start','cards/capture_status','cards/capture_confirm'})
CAPTURE_LIFETIME=frozenset({'cards/capture_cancel'})
ACTIONS=MUTATIONS|EVENTS|CARDS|SENSITIVE|MESSAGING|CAPTURE
_CAPTURE_ROUTES=CAPTURE|CAPTURE_LIFETIME
# Immutable dispatch definitions only. Instances, inputs, decisions and
# results are never cached; route() still rereads the selected current port.
_ROUTE_DEFINITIONS=MappingProxyType({action:(slot,expected)
    for names,slot,expected in ((MUTATIONS,'mutations',SourceUserMutations),(EVENTS,'events',SelectedEvents),
        (CARDS,'cards',ManagedCardReceiver),(SENSITIVE,'sensitive',OpaquePeople),(MESSAGING,'messaging',OpaqueMessaging),
        (_CAPTURE_ROUTES,'capture',LegacyCaptureReceiver)) for action in names})


def _build_candidate_spec(action):
    if action not in ACTIONS:raise ValueError('not a new source candidate action')
    original=catalog_profile('users/get') if action=='cards/capture_confirm' else catalog_profile(action)
    params,result=original.parameters,original.projection
    if action in EVENTS:
        params,result={'events/list':(LIST_REQUEST,LIST_RESULT),'events/detail':(DETAIL_REQUEST,DETAIL_RESULT),'events/export':(EXPORT_REQUEST,EXPORT_RESULT)}[action]
        params,result=thaw(freeze(params)),thaw(freeze(result))
        if action=='events/list':
            status=result['properties']['stations']['items']['properties']
            # Exact literal assignments in frozen StationEvents, not arbitrary
            # diagnostic strings or evidence of physical/network state.
            status['stream']={'enum':['connecting','connected','disconnected','authentication_failed','unavailable','stopped']}
            status['history']={'enum':['pending','offline','unavailable','recovered','authentication_failed','incomplete']}
    if action=='cards/capture_confirm':
        params=closed({'session_id':{'type':'string','minLength':1,'maxLength':128},'label':{'type':'string','maxLength':64,'pattern':'^[^\\x00-\\x1f]*$(?![\\s\\S])'}})
    spec=replace(original,action=action,schema_id='urn:wiskey:local-source-candidate:'+action.replace('/',':'),schema_revision='1',parameters=params,projection=result,profile_status='CLOSED_LOCAL_FAKE')
    extra=[]
    if action in MUTATIONS|CARDS|CAPTURE:
        extra.extend([SourceRef(FROZEN,'custom_components/hikvision_intercom/access/sync_tracking.py',16,125,'d442a8c711e399004e944069e2ead9c1632c49735b4fa6e72151b28cc07999ea'),
            SourceRef(FROZEN,'custom_components/hikvision_intercom/access/engine.py',37,563,'213ff42a431b834143fb5e84857b6eba9da4280b07701ccfb6f980bb74ed942b')])
    if action in CAPTURE:extra.append(SourceRef(FROZEN,'custom_components/hikvision_intercom/access/enrollment.py',50,236,'d23d1545e6b7c7b346b215a0bc3f60848b549c0c145dfd5e9349f5919b0cf817'))
    if action in EVENTS:extra.extend([SourceRef(FROZEN,'custom_components/hikvision_intercom/events.py',84,178,'4f791aa19c3ee9df772cb4c18a3bb472b257c3122e0515802436965e7443cb08'),
        SourceRef(FROZEN,'custom_components/hikvision_intercom/access/repository.py',976,1041,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb')])
    if action=='users/photo_get':extra.append(SourceRef(FROZEN,'custom_components/hikvision_intercom/access/repository.py',537,539,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb'))
    # catalog_profile already owns both fresh literal trees. Event constants
    # were detached above; capture-confirm is constructed locally. No other
    # owner can retain these trees, so a second freeze/thaw only recopies the
    # same public definitions. Every call still returns independent schemas.
    return replace(spec,sources=(*spec.sources,*extra))


_CANDIDATE_DEFINITIONS = {}


def candidate_spec(action):
    """Only immutable definition code is reused; every schema tree is fresh."""
    if action not in ACTIONS:raise ValueError('not a new source candidate action')
    entry = _CANDIDATE_DEFINITIONS.get(action)
    if entry is None:
        from .profiles import _definition_code
        spec = _build_candidate_spec(action)
        entry = (replace(spec, parameters={}, projection={}),
            _definition_code(spec.parameters), _definition_code(spec.projection))
        _CANDIDATE_DEFINITIONS[action] = entry
    spec, parameters, projection = entry
    return replace(spec, parameters=eval(parameters, {'__builtins__': {}}, {}),
        projection=eval(projection, {'__builtins__': {}}, {}))


@dataclass(repr=False)
class SourcePorts:
    mutations:object=None
    events:object=None
    cards:object=None
    sensitive:object=None
    messaging:object=None
    capture:object=None
    metadata:object=None
    source_error_type:object=None
    def route(self,action):
        definition=_ROUTE_DEFINITIONS.get(action)
        if definition is None:raise ValueError('unselected source action')
        slot,expected=definition;port=getattr(self,slot)
        if type(port) is not expected:raise ValueError('closed typed source port required')
        return port
    async def execute(self,action,params,context):
        from .adapters import EngineContext
        from .source_metadata import SourceMetadataObserver
        from .jobs import same_parameters
        if type(context) is not EngineContext or params is not context.parameters and not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        params=context.parameters
        route=type(self).route;port=route(self,action);observer=self.metadata;error_type=self.source_error_type
        if error_type is not None and (not isinstance(error_type,type) or not issubclass(error_type,Exception)):raise Refusal('binding_denied')
        if observer is not None and type(observer) is not SourceMetadataObserver:raise Refusal('binding_denied')
        method_name='apply' if action in MUTATIONS or action in CARDS else 'execute' if action in _CAPTURE_ROUTES else 'read'
        method=getattr(port,method_name)
        def same_method(left,right):
            if type(left) is MethodType and type(right) is MethodType:return left.__self__ is right.__self__ and left.__func__ is right.__func__
            return left is right
        def current(_):
            context.check()
            try:unchanged=type(self).route is route and route(self,action) is port and self.metadata is observer and self.source_error_type is error_type and same_method(getattr(port,method_name,None),method)
            except ValueError:unchanged=False
            if not unchanged:raise Refusal('binding_denied')
            return True
        scoped=EngineContext.scoped(context,current);scoped.trace=context.trace
        if observer is not None:observer.capture(scoped);scoped.check()
        try:
            if action in MUTATIONS:value=await scoped.wait(lambda:method(action,params,scoped))
            elif action in CARDS:value=await scoped.wait(lambda:method(action,params,scoped))
            elif action in _CAPTURE_ROUTES:value=await scoped.wait(lambda:method(action,params,scoped))
            else:value=await scoped.wait(lambda:method(params,scoped))
            scoped.check();return value
        except Refusal:raise
        except Exception as error:
            scoped.check()
            code='action_failed'
            if error_type is not None and isinstance(error,error_type):
                candidate=getattr(error,'code',None)
                if type(candidate) is str and candidate in PUBLIC_ERRORS:code=candidate
            raise Refusal(code) from None


def _source_lifetimes(source_ports,actions,epoch):
    """Validate injected owners before allocating the candidate's journal."""
    from types import MethodType
    from .source_reconcile import SourceReconcileWorker
    from .source_card_mutations import SourceCardMutations
    from .source_timing import SourcePolicyWorker
    from .source_policy_continuations import SourcePolicyContinuations
    from .source_capture_completion import SourceCaptureCompletion
    ports=[];dependencies=[]
    for action in sorted(actions):
        port=source_ports.route(action)
        if any(port is p for p in ports):continue
        ports.append(port)
        receiver=port.source_receiver if type(port) is ManagedCardReceiver else port
        callbacks=[]
        capture_completion=None;capture_shared_owner=None
        if type(receiver) is LegacyCaptureReceiver:
            try:LegacyCaptureReceiver._check_creation(receiver)
            except Refusal:raise ValueError('original capture source ownership required')from None
        if type(receiver) is LegacyCaptureReceiver and receiver._completion is not None:
            capture_completion=receiver._completion
            if (type(capture_completion) is not SourceCaptureCompletion or capture_completion.closed
                or capture_completion.receiver is not receiver
                or capture_completion.repository is not receiver._source_manager.repository):
                raise ValueError('unowned capture source completion')
            callback=capture_completion.enqueue
            if (type(callback) is not MethodType or type(callback.__self__) is not SourceReconcileWorker
                or callback.__func__ is not SourceReconcileWorker.enqueue):
                raise ValueError('unowned capture source worker')
            if not capture_completion.owns_credentials:
                owners=[]
                if actions&MUTATIONS and type(source_ports.mutations) is SourceUserMutations:owners.append(source_ports.mutations)
                if actions&CARDS and type(source_ports.cards) is ManagedCardReceiver and type(source_ports.cards.source_receiver) is SourceCardMutations:owners.append(source_ports.cards.source_receiver)
                capture_shared_owner=next((owner for owner in owners if owner.repository is capture_completion.repository and owner.credential_resources is capture_completion.credentials
                    and type(owner.enqueue) is MethodType and owner.enqueue.__self__ is callback.__self__ and owner.enqueue.__func__ is callback.__func__),None)
                if capture_shared_owner is None:
                    raise ValueError('selected shared credential and worker owner required')
            callbacks.append(callback)
        if type(receiver) in (SourceUserMutations,SourceCardMutations):callbacks.append(receiver.enqueue)
        if type(receiver) is SourceUserMutations and receiver.policy_worker is not None:
            policy=receiver.policy_worker
            if type(policy) is not SourcePolicyWorker or policy.closed:raise ValueError('unowned source policy worker')
            callbacks.append(policy.run)
            if policy.continuations is not None:
                continuation=policy.continuations
                if type(continuation) is not SourcePolicyContinuations or continuation.worker is not policy or continuation.identities.repository is not receiver.repository or continuation.epoch!=epoch or continuation.closed:
                    raise ValueError('unowned policy continuation')
                if continuation.credential_resources is not None and continuation.credential_resources is not receiver.credential_resources:
                    raise ValueError('same renewal credential source required')
                if not any(continuation is p for p in dependencies):dependencies.append(continuation)
        for callback in callbacks:
            if type(callback) is MethodType and type(callback.__self__) is SourceReconcileWorker:
                dependency=callback.__self__
                source=capture_completion if capture_completion is not None else receiver
                try:SourceReconcileWorker._check_creation(dependency)
                except Refusal:raise ValueError('original source worker ownership required')from None
                if callback.__func__ is not SourceReconcileWorker.enqueue or dependency.repository is not source.repository or dependency.resources is not dependency._owned_resources or dependency.resources.epoch!=epoch or dependency.closed:
                    raise ValueError('unowned source worker')
                credentials=source.credentials if capture_completion is not None else source.credential_resources
                if capture_shared_owner is not None:retirements=capture_shared_owner.retirement_births
                elif capture_completion is not None:retirements=None
                else:retirements=source.retirement_births
                if dependency.credentials is not credentials or dependency.retirement_births is not retirements:
                    raise ValueError('source receiver and worker must share exact birth owners')
                if not any(dependency is p for p in dependencies):dependencies.append(dependency)
    return tuple(ports),tuple(dependencies)


def compose_source_candidate(*,directory,source_ports,actions,legacy_backend,epoch,verifier,prepare,binding_current,clock_sample,current_mapping,policy_actions=frozenset(),field_actions=frozenset(),private_patch_actions=frozenset(),legacy_actions=None,_source_ownership=None,**legacy_options):
    from .host import compose
    if type(directory) is not tempfile.TemporaryDirectory or type(source_ports) is not SourcePorts or type(actions) is not frozenset or not actions<=ACTIONS:
        raise ValueError('explicit temporary source candidate required')
    root=Path(directory.name);journal=root/'source-candidate.sqlite'
    if root.is_symlink() or not root.is_dir() or journal.exists() or journal.is_symlink():raise ValueError('fresh temporary journal required')
    if not callable(current_mapping):raise ValueError('explicit target mapping required')
    if _source_ownership is not None and not callable(_source_ownership):raise ValueError('explicit construction ownership guard required')
    if type(policy_actions) is not frozenset or not policy_actions<=actions&{'users/create','users/update'}:raise ValueError('explicit local policy selection required')
    if type(field_actions) is not frozenset or not field_actions<=actions&{'users/create','users/update'} or field_actions&policy_actions:
        raise ValueError('explicit disjoint local source field selection required')
    if type(private_patch_actions) is not frozenset or not private_patch_actions<=field_actions&{'users/update'}:
        raise ValueError('explicit OFF private patch field selection required')
    if policy_actions:
        from .source_timing import SourcePolicyWorker
        for action in policy_actions:
            worker=source_ports.route(action).policy_worker
            if type(worker) is not SourcePolicyWorker or worker.closed:raise ValueError('owned source policy worker required')
    if set(legacy_options)-{'trace_sink','current_users','fresh_arx_view','enable_csv','audit_store_for'}:
        raise ValueError('unreviewed factory override')
    for action in actions:source_ports.route(action)
    owned,dependencies=_source_lifetimes(source_ports,actions,epoch)
    if legacy_actions is None:legacy_specs=closed_local_profiles()
    else:
        if type(legacy_actions) is not frozenset:raise ValueError('explicit restricted legacy scope required')
        legacy_specs={action:catalog_profile(action) for action in legacy_actions}
        if any(spec is None or spec.profile_status!='CLOSED_LOCAL_FAKE' for spec in legacy_specs.values()):raise ValueError('unclosed legacy action')
    if actions&CAPTURE:legacy_specs.pop('cards/capture_cancel',None)
    def source_binding_current(request):
        # Technical target binding, not another authorization policy. Arx's
        # live decision is still required before and after the source lookup.
        if _source_ownership is not None and not _source_ownership():return False
        if binding_current(request) is not True:return False
        target=request.get('target');resolved=current_mapping(target['logical_target_id'])
        if type(resolved) is not dict or any(type(resolved.get(k)) is not type(v) or resolved.get(k)!=v for k,v in target.items()):return False
        allowed=binding_current(request) is True
        # One synchronous metadata transaction: every owner is reread before
        # the first authority callback and after the last. There is no await,
        # prepare, claim or effect between these reads, and no verdict cache.
        return allowed and (_source_ownership is None or _source_ownership())
    host=compose(journal_path=journal,epoch=epoch,verifier=verifier,prepare=prepare,binding_current=source_binding_current,clock_sample=clock_sample,
        adapter_specs=tuple(legacy_specs.values()),backend=legacy_backend,mapping=current_mapping,require_station_mapping=True,**legacy_options)
    composed=actions|CAPTURE_LIFETIME if actions&CAPTURE else actions
    source_route=type(source_ports).route
    for action in sorted(composed):
        if action in private_patch_actions:
            from .source_user_schema import private_patch_spec
            spec=private_patch_spec(action,fake_directory=directory)
        elif action in policy_actions:
            from .source_policy_schema import policy_spec
            spec=policy_spec(action,fake_directory=directory)
        elif action in field_actions:
            from .source_user_schema import extended_spec
            spec=extended_spec(action,fake_directory=directory)
        else:spec=catalog_profile(action) if action in CAPTURE_LIFETIME else candidate_spec(action)
        def guard(request,selected=action):
            if request.get('action')!=selected or host.closed:return False
            if type(source_ports).route is not source_route:return False
            source_route(source_ports,selected)  # no free receiver fallback
            # build_adapter has just run the producer's exact _ExecutionGuard:
            # fresh Arx decision, clock, resolver, selected adapter and this
            # host's source ownership. This synchronous check has no await or
            # external callback; calling that same authority chain twice here
            # adds no effect boundary. No decision is stored or reused.
            return True
        adapter=build_adapter(spec,source_ports,guard,mapping=current_mapping,require_station_mapping=True)
        # Registry enforces closed request/result/projection and the existing
        # 45/47 selection. No extra action, role, transport or enabled lease.
        host.registry.register(action,adapter)
    for port in owned:
        async def close_source(port=port):
            import inspect
            result=port.close()
            if inspect.isawaitable(result):await result
        host.own_lifetime(close_source,owns_current=getattr(port,'owns_current',None))
    from .source_reconcile import SourceReconcileWorker
    for dependency in dependencies:
        shutdown=dependency.aclose if type(dependency) is SourceReconcileWorker else dependency.close
        host.own_lifetime(shutdown,owns_current=dependency.owns_current)
    host.source_candidate_field_actions=tuple(sorted(field_actions))
    host.source_candidate_private_patch_actions=tuple(sorted(private_patch_actions))
    host.source_candidate_version=VERSION
    host.source_candidate_scope='BOUNDED_LOCAL_SOURCE_FAKE_NOT_FULL_SELECTED_SOURCE_CLOSURE'
    host.source_candidate_legacy_scope=tuple(sorted(legacy_specs))
    return host


def _owned_worker_ports(worker):
    # Fixed construction schema, current attributes on every call. Direct
    # reads avoid repeated dynamic name lookup across the nested guard chain.
    type(worker)._check_creation(worker)
    return (worker.repository,worker.engine,worker.identities,worker.configuration,worker.configuration.repository,worker.configuration.current,worker._station_locks,worker._station_owners,worker._owned_station_locks,worker._owned_station_owners,
        worker.credentials,worker.retirement_births,worker.retirement_for,worker.timing,worker.resources,worker._owned_resources,
        worker.current_driver,worker.targets,worker.mapping,worker.owners,worker.admit,worker.journal,worker.clock)


def compose_owned_source_candidate(**options):
    """Separate OFF assembly; a free callback never certifies source work.

    The earlier bounded factory remains available to its narrow fake fixtures.
    This stricter entry pins the selected source workers for the whole host
    lifetime, before journal allocation and before preparation/claim. It adds
    no authority or wire field and cannot enable a product action.
    """
    from .source_reconcile import SourceReconcileWorker
    from .source_capture_completion import SourceCaptureCompletion
    from .source_card_mutations import SourceCardMutations
    from .source_timing import SourcePolicyWorker
    source_ports=options.get('source_ports');actions=options.get('actions');epoch=options.get('epoch')
    current=options.get('binding_current')
    if type(source_ports) is not SourcePorts or type(actions) is not frozenset or not actions<=ACTIONS or not callable(current):
        raise ValueError('explicit owned source assembly required')
    source_route=type(source_ports).route
    # A construction plan binds existing owners; it never stores a decision,
    # parameter, source result or cross-case fixture. Every port is reread.
    from operator import attrgetter
    plan=[];seen=[];worker_plan=[];callback_plan=[]
    def same(a,b):
        if a is b:return True
        return a.__self__ is b.__self__ and a.__func__ is b.__func__ if type(a) is MethodType and type(b) is MethodType else a is b
    for action in sorted(actions):
        port=source_ports.route(action)
        if any(port is item for item in seen):continue
        seen.append(port)
        slot=next(name for names,name in ((MUTATIONS,'mutations'),(CARDS,'cards'),(CAPTURE,'capture'),(EVENTS,'events'),(SENSITIVE,'sensitive'),(MESSAGING,'messaging')) if action in names)
        source=port.source_receiver if type(port) is ManagedCardReceiver else port
        capture=type(source) is LegacyCaptureReceiver
        if capture:
            source=source._completion
            if type(source) is not SourceCaptureCompletion or source.closed:raise ValueError('owned capture completion required')
        calls=[];source_names=();policy=None;policy_ports=()
        if type(source) in (SourceUserMutations,SourceCardMutations):
            calls.append((source,'enqueue'));source_names=('repository','credential_resources','retirement_births')
            source_names+=('private_inputs','private_preparer') if type(source) is SourceUserMutations else ('inputs','preparer')
        elif capture:
            calls.append((source,'enqueue'));source_names=('repository','credentials','receiver')
        if type(source) in (SourceUserMutations,SourceCardMutations) or capture:
            from .source_configuration import SourceConfigurationRevision
            if type(source.configuration) is not SourceConfigurationRevision or source.configuration.repository is not source.repository:
                raise ValueError('owned source configuration revision required')
            source_names+=('configuration',)
        if type(source) is SourceUserMutations:
            policy=source.policy_worker
            if policy is not None:
                if type(policy) is not SourcePolicyWorker or policy.closed:raise ValueError('owned policy worker required')
                if policy.continuations is not None:
                    from .source_policy_continuations import SourcePolicyContinuations
                    if type(policy.continuations) is not SourcePolicyContinuations or policy.continuations.credential_resources is not source.credential_resources:
                        raise ValueError('same owned renewal credential source required')
                calls.append((policy,'run'));policy_ports=(policy.current_user,policy.owners,policy.continuations)
        for owner,name in calls:
            callback=getattr(owner,name)
            if type(callback) is not MethodType or type(callback.__self__) is not SourceReconcileWorker or callback.__func__ is not SourceReconcileWorker.enqueue:
                raise ValueError('owned reconcile worker required')
            worker=callback.__self__
            try:SourceReconcileWorker._check_creation(worker)
            except Refusal:raise ValueError('original source worker ownership required')from None
            if worker.closed or worker.repository is not source.repository or worker.resources is not worker._owned_resources or worker.resources.epoch!=epoch or worker._station_locks is not worker._owned_station_locks or worker._station_owners is not worker._owned_station_owners:
                raise ValueError('same active source worker required')
            callback_plan.append((owner,name,callback))
            if not any(worker is item[0] for item in worker_plan):
                worker_plan.append((worker,_owned_worker_ports(worker)))
        # Only the fixed attribute accessor is prepared, never its result.
        # Every guard reads the complete current owner tuple again.
        reader=attrgetter(*source_names) if source_names else None
        plan.append((slot,port,source,capture,reader,tuple(getattr(source,key) for key in source_names),policy,policy_ports))
    plan,worker_plan,callback_plan=tuple(plan),tuple(worker_plan),tuple(callback_plan)
    def unchanged():
        if type(source_ports).route is not source_route:return False
        for slot,port,source,capture,reader,values,policy,policy_ports in plan:
            if getattr(source_ports,slot) is not port:return False
            if capture and port._completion is not source or type(port) is ManagedCardReceiver and port.source_receiver is not source:return False
            if reader is not None:
                try:fresh=reader(source)
                except AttributeError:return False
                if not same_identities(values,fresh):return False
            if type(source) is SourceUserMutations:
                if source.policy_worker is not policy:return False
                if policy is not None and (policy.closed or any(not same(a,b) for a,b in zip(policy_ports,(policy.current_user,policy.owners,policy.continuations)))):return False
        # Shared source receivers may own the same worker. Check every
        # callback separately, then each worker's complete current bindings
        # once per guard; this stores identities, never a previous verdict.
        for owner,name,callback in callback_plan:
            if not same(getattr(owner,name,None),callback):return False
        for worker,values in worker_plan:
            if worker.closed:return False
            try:fresh=_owned_worker_ports(worker)
            except (AttributeError,Refusal):return False
            if not same_ports(values,fresh):return False
        return True
    host=compose_source_candidate(**{**options,'binding_current':current,'_source_ownership':unchanged})
    host.source_candidate_worker_scope='OWNED_WORKERS_PINNED_BEFORE_PREPARATION'
    host.source_candidate_admission_scope='EXACT_SOURCE_BIRTH_AND_STAGE_WITH_FRESH_CONTEXT'
    return host
