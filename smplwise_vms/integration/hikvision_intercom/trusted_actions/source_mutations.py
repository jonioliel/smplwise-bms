"""Source-shaped user receiver with explicit repository and worker boundaries.

This is PARTIAL_OFF until each injected source dependency is closed. The
repository owns its atomic save/audit/publication, including cancellation. The
receiver never calls ManagedUser.public/private or a classic request_user;
only six proven public fields are projected. No native owner is discovered.
"""
from .source_bindings import same_ports
from .source_commit_guard import source_commit

from .adapters import EngineContext,project_selected
from .envelope import thaw,freeze
from .jobs import same_parameters
from .mutation_boundary import ACTIONS
from .validation import Refusal,Schema
from types import MethodType,MappingProxyType
from asyncio import CancelledError
import json

def _same(a,b):
    if a is b:return True
    if type(a)is MethodType and type(b)is MethodType:return a.__self__ is b.__self__ and a.__func__ is b.__func__
    return a is b


_PARAMETER_TEXT=None

def _parameter_text():
    global _PARAMETER_TEXT
    if _PARAMETER_TEXT is None:
        from .profiles import catalog_profile
        _PARAMETER_TEXT=MappingProxyType({action:json.dumps(catalog_profile(action).parameters,separators=(",",":")) for action in ACTIONS})
    return _PARAMETER_TEXT


_EXTENDED_TEXT=None

def _extended_text():
    global _EXTENDED_TEXT
    if _EXTENDED_TEXT is None:
        from .source_user_schema import extended_spec
        _EXTENDED_TEXT=MappingProxyType({action:json.dumps(extended_spec(action).parameters,separators=(',',':')) for action in ('users/create','users/update')})
    return _EXTENDED_TEXT


_POLICY_TEXT=None
_PRIVATE_PATCH_TEXT=None

def _private_patch_text():
    global _PRIVATE_PATCH_TEXT
    if _PRIVATE_PATCH_TEXT is None:
        from .source_user_schema import private_patch_spec
        _PRIVATE_PATCH_TEXT=MappingProxyType({'users/update':json.dumps(private_patch_spec('users/update').parameters,separators=(',',':'))})
    return _PRIVATE_PATCH_TEXT

def _policy_text():
    global _POLICY_TEXT
    if _POLICY_TEXT is None:
        from .source_user_schema import parameters
        _POLICY_TEXT=MappingProxyType({action:json.dumps(parameters(action),separators=(',',':')) for action in ('users/create','users/update')})
    return _POLICY_TEXT


class SourceUserMutations:
    def __init__(self,*,repository,build_user,validate,now,desired_changed,audit_scope,enqueue,changed,row_schema,limit=128,completed=None,private_inputs=None,private_preparer=None,policy_worker=None,credential_resources=None,retirement_births=None,configuration=None):
        if repository is None or not all(callable(v) for v in (build_user,validate,now,desired_changed,audit_scope,enqueue,changed)) or type(limit)is not int or not 1<=limit<=4096:raise ValueError('explicit source receiver dependencies and bounded limit required')
        self.repository=repository;self.build_user=build_user;self.validate=validate;self.now=now
        if configuration is not None:
            from .source_configuration import SourceConfigurationRevision
            if type(configuration) is not SourceConfigurationRevision or configuration.repository is not repository:raise ValueError('same source configuration revision required')
        self.configuration=configuration
        self.desired_changed,self.audit_scope,self.enqueue,self.changed=desired_changed,audit_scope,enqueue,changed
        if completed is not None and not callable(completed):raise ValueError('explicit source completion observer required')
        self.completed=completed
        if private_inputs is not None:
            from .source_inputs import MemorySourceInputs
            if type(private_inputs) is not MemorySourceInputs:raise ValueError("explicit memory-only private source carrier required")
        if private_preparer is not None:
            from .source_preparer import AdmittedSourcePreparer
            if type(private_preparer) is not AdmittedSourcePreparer or private_preparer.inputs is not private_inputs:
                raise ValueError('same admitted preparer and carrier required')
        self.private_inputs=private_inputs;self.private_preparer=private_preparer
        if policy_worker is not None:
            from .source_timing import SourcePolicyWorker
            if type(policy_worker) is not SourcePolicyWorker:raise ValueError('explicit owned policy source worker required')
        self.policy_worker=policy_worker
        if credential_resources is not None:
            from .source_credentials import SourceCredentialResources, _same
            if type(credential_resources) is not SourceCredentialResources or not _same(credential_resources.current_user,repository.get):raise ValueError('same source credential repository required')
        self.credential_resources=credential_resources
        if retirement_births is not None:
            from .retirement import RetirementBirths
            if type(retirement_births) is not RetirementBirths or not retirement_births.bind_card_values or retirement_births.state() is not repository._state:raise ValueError('same source retirement repository required')
        self.retirement_births=retirement_births
        self._cleanup_resources=tuple((owner,type(owner).close) for owner in (retirement_births,credential_resources,policy_worker,private_inputs) if owner is not None)
        self._cleanup_admitted=False
        schema=Schema(row_schema);schema.require_closed(projection=True)
        if set(schema.definition.get('properties',{}))!={'id','revision','display_name','valid_from','valid_until','group_ids'}:raise ValueError('exact six-field public person projection required')
        self._row_definition=freeze(schema.definition)
        from .profiles import catalog_profile
        # Fresh definitions for these six actions only. No authority, source
        # instance, result or mutable schema is shared between receivers.
        self._parameter_definitions=_parameter_text();self._source_parameter_definitions=_extended_text()
        self._private_parameter_definitions=_private_patch_text()
        self.limit=limit;self.closed=False;self._used=set();self._active=set()
        self._scope_maps=(self._used,self._active)
        self._owned_scope_maps=self._scope_maps
        self._creation_scope=(limit,self._scope_maps)
        self._creation_cleanup=[self._cleanup_resources,False,False]

    def _check_scope(self):
        limit,maps=self._creation_scope
        if (self._creation_cleanup[2] or type(self.closed)is not bool or self.closed or type(self.limit)is not int or self.limit!=limit
            or self._used is not maps[0] or self._active is not maps[1]
            or self._scope_maps is not maps or self._owned_scope_maps is not maps
            or self._cleanup_resources is not self._creation_cleanup[0]
            or type(self._cleanup_admitted)is not bool or self._cleanup_admitted is not self._creation_cleanup[1]):raise Refusal('binding_denied')

    def _owners(self):
        repo=self.repository;private_provider=None
        if self.private_inputs is not None:
            from .source_inputs import MemorySourceInputs
            if type(self.private_inputs) is MemorySourceInputs:private_provider=self.private_inputs.current_owner
        return (repo,self.build_user,self.validate,self.now,self.desired_changed,self.audit_scope,self.enqueue,self.changed,
                self._row_definition,self._parameter_definitions,self.limit,getattr(repo,'_save',None),getattr(repo,'_lock',None),self.configuration,getattr(self.configuration,'repository',None),getattr(self.configuration,'current',None),
                *(getattr(repo,name,None) for name in ('get','permission_data','async_create','async_update','async_archive','async_cancel_temporary','_commit','_update_user','_archive_user','_validate_collisions','_retire_pin')),self.completed,self.private_inputs,private_provider,self.private_preparer,self._source_parameter_definitions,self.policy_worker,self.credential_resources,getattr(self.policy_worker,'continuations',None),self.retirement_births,getattr(self.retirement_births,'state',None),getattr(self.retirement_births,'revision',None),getattr(self.retirement_births,'bind_card_values',None),self._private_parameter_definitions,self._used,self._active,self._scope_maps,self._owned_scope_maps)

    async def apply(self,action,params,context):
        if type(context)is not EngineContext or context.parameters is None or context.epoch is None or action not in ACTIONS or action!=context.request.get('action') or params is not context.parameters and not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        params=context.parameters
        self._check_scope();context.check();self._check_scope()
        scope_maps=self._creation_scope[1]
        if self._scope_maps is not scope_maps or self._used is not scope_maps[0] or self._active is not scope_maps[1]:raise Refusal('binding_denied')
        if self.private_inputs is not None:
            from .source_inputs import MemorySourceInputs
            if type(self.private_inputs) is not MemorySourceInputs:raise Refusal('binding_denied')
        if self.private_preparer is not None:
            from .source_preparer import AdmittedSourcePreparer
            if type(self.private_preparer) is not AdmittedSourcePreparer or self.private_preparer.inputs is not self.private_inputs:raise Refusal('binding_denied')
        actor=context.request.get('actor')
        if actor['kind']!='human':raise Refusal('binding_denied')
        if context.request.get('selection_revision')!='rev1':raise Refusal('binding_denied')
        operation=context.request.get('operation')
        private_patch=(action=='users/update' and operation['request_schema_id']=='urn:wiskey:local-private-patch:users:update' and operation['request_schema_revision']=='3')
        if private_patch and operation['parameter_transport']!='agreed_sensitive_opaque_reference':raise Refusal('binding_denied')
        policy_candidate=(action in {'users/create','users/update'} and operation['request_schema_id']=='urn:wiskey:local-source-policy:'+action.replace('/',':') and operation['request_schema_revision']=='3')
        if policy_candidate:
            from .source_timing import SourcePolicyWorker
            if type(self.policy_worker) is not SourcePolicyWorker or self.policy_worker.closed:raise Refusal('binding_denied')
        extended=(policy_candidate or action in {'users/create','users/update'} and operation['request_schema_id']=='urn:wiskey:local-source-fields:'+action.replace('/',':') and operation['request_schema_revision']=='2')
        definitions=self._private_parameter_definitions if private_patch else _policy_text() if policy_candidate else self._source_parameter_definitions if extended else self._parameter_definitions
        Schema.from_json(definitions[action])(thaw(params))
        key=context.request.get('operation_binding_ref')
        if self.closed or key in self._used or len(self._used)>=self.limit:raise Refusal('binding_denied')
        if not self._cleanup_admitted:
            from .source_bindings import retain_cleanup_owners
            self._cleanup_resources=retain_cleanup_owners(self._cleanup_resources,(self.retirement_births,self.credential_resources,self.policy_worker,self.private_inputs))
            self._cleanup_admitted=True
            self._creation_cleanup[:2]=[self._cleanup_resources,True]
        owners=self._owners();self._used.add(key);self._active.add(key)
        private_inputs,private_preparer,policy_worker=self.private_inputs,self.private_preparer,self.policy_worker
        credentials=self.credential_resources
        retirements=self.retirement_births
        configuration=self.configuration
        configuration_revision=None
        original_request=context.request
        repo,build,validate,now,desired_changed,audit_scope,enqueue,changed,definition,*_=owners
        def current():
            context.check();self._check_scope()
            # Bound source methods compare by bound self/function, not the
            # ephemeral Python method wrapper allocated on attribute access.
            if self.closed or not same_ports(owners,self._owners()):raise Refusal('binding_denied')
            if configuration is not None and configuration.current()!=configuration_revision:raise Refusal('binding_denied')
            # The configuration/authority callbacks cannot replace the source
            # after our final comparison, or reopen an originally stopped owner.
            context.check();self._check_scope()
            if not same_ports(owners,self._owners()):raise Refusal('binding_denied')
        def public(user):
            # Access only declared public attributes, never a broad serializer.
            raw={name:getattr(user,name) for name in definition['properties']}
            # thaw creates this validator's exclusive JSON definition tree.
            schema=object.__new__(Schema);schema.definition=thaw(definition);schema.resources={}
            result=project_selected(raw,schema.definition);schema(result)
            if action!='users/create' and result['id']!=params['user_id']:raise Refusal('binding_denied')
            expected=1 if action=='users/create' else params['revision']+1
            if type(result['revision'])is not int or result['revision']!=expected:raise Refusal('binding_denied')
            return result
        def native(method,*args,**kwargs):
            # EngineContext.wait checks admission immediately before this
            # factory. Recheck original source ports after that callback too.
            current();return method(*args,**kwargs)
        try:
            configuration_revision=configuration.current() if configuration is not None else None
            current();previous=None
            if action in {'users/create','users/update','users/set_active'}:
                patch={'active':params['active']} if action=='users/set_active' else thaw(params['data'])
                if action in {'users/create','users/update'} and set(patch)&{'employee_no','phone','pin','cards','photo','responsible_person','access_purpose'}:raise Refusal('invalid_fields')
                private_transport=(action in {'users/create','users/update'} and context.request.get('operation')['parameter_transport']=='agreed_sensitive_opaque_reference')
                if private_transport and self.private_inputs is None:raise Refusal('binding_denied')
                if not private_transport and self.private_inputs is not None:
                    from .source_inputs import MemorySourceInputs
                    from .source_preparer import AdmittedSourcePreparer
                    parameter=context.request.get('operation')['parameter_reference']
                    if MemorySourceInputs.has_reference(self.private_inputs,parameter) or self.private_preparer is not None and AdmittedSourcePreparer.has_reference(self.private_preparer,parameter):raise Refusal('binding_denied')
                    current()
                if private_transport:
                    if self.private_preparer is not None:self.private_preparer.issue(context);current()
                    private=self.private_inputs.consume(context);current()
                    # Source-side input only. These exact existing field names
                    # are validated by original build/manager/repository code.
                    # No JSON/wire key, value hash or result field is added.
                    allowed={'employee_no','phone','pin','cards','photo','responsible_person','access_purpose'}
                    if type(private) is not dict or not private or not set(private)<=allowed or set(private)&set(patch):raise Refusal('invalid_fields')
                    patch.update(private)
                    private=None
                if action!='users/create':previous=repo.get(params['user_id']);current()
                permission=repo.permission_data(patch,previous) if previous is not None else repo.permission_data(patch)
                current()
                args={'employee_no':previous.employee_no if previous is not None else '100000000','now':now()}
                if previous is not None:args['previous']=previous
                candidate=build(permission,**args);current();validate(candidate);current()
            # Current selection permits user mutations only through an actual
            # human actor. The bridge/Arx supplies authority; no service fallback.
            audit_arguments={'reason_code':params['reason_code']}if action=='users/temporary_cancel'else{}
            before={kind:retirements.snapshot(kind,context) for kind in ('retired_cards','retired_pins')} if retirements is not None and action!='users/create' else {}
            with audit_scope(actor['user_id'],action,**audit_arguments),source_commit(repo,current):
                current()
                if action=='users/create':user=await context.wait(lambda:native(repo.async_create,patch))
                elif action in {'users/update','users/set_active'}:user=await context.wait(lambda:native(repo.async_update,params['user_id'],patch,expected_revision=params['revision']))
                elif action in {'users/archive','users/unarchive'}:
                    if params.get('confirmed')is not True:raise Refusal('invalid_fields')
                    user=await context.wait(lambda:native(repo.async_archive,params['user_id'],expected_revision=params['revision'],archived=action=='users/archive'))
                else:user=await context.wait(lambda:native(repo.async_cancel_temporary,params['user_id'],expected_revision=params['revision']))
            current();result=public(user);current()
            for kind,checkpoint in before.items():
                retirements.observe(context,kind,result['id'],result['revision'],checkpoint);current()
            continuation=getattr(policy_worker,'continuations',None)
            if continuation is not None:
                from .source_policy_continuations import SourcePolicyContinuations
                if type(continuation) is not SourcePolicyContinuations or continuation.identities.repository is not repo:raise Refusal('binding_denied')
                continuation.invalidate_person(result['id'],result['revision']);current()
            if credentials is not None:
                credentials.observe(context,result['id'],result['revision']);current()
            if self.completed is not None:
                import inspect
                observed=self.completed(context,action,result['id'],result['revision'])
                if inspect.isawaitable(observed):
                    if inspect.iscoroutine(observed):observed.close()
                    raise Refusal('binding_denied')
                current()
            should_enqueue=action in {'users/archive','users/unarchive','users/temporary_cancel'} or params.get('sync_now',True)
            if should_enqueue and action in {'users/update','users/set_active'}:
                should_enqueue=desired_changed(previous,user)
                if type(should_enqueue)is not bool:raise Refusal('binding_denied')
                current()
            if should_enqueue:
                # Carry source-port ownership through every nested worker await,
                # not only the outer call's return. A replacement after the
                # save cannot authorize its next station/resource effect.
                def worker_current(_):current();return True
                worker_context=EngineContext.scoped(context,worker_current)
                worker_context.trace=context.trace
                if policy_candidate:await worker_context.wait(lambda:policy_worker.enqueue(user.id,user.revision,worker_context))
                else:await worker_context.wait(lambda:enqueue(user.id,user.revision,worker_context))
                current()
            # A data-free source notification cannot authorize a worker.
            changed();current();return result
        finally:
            # issue may have stored a private frame before the next current()
            # refuses. Always retire this exact request's frame, including
            # cancellation and exceptions. Capture the admitted owners above;
            # a replacement carrier must not be touched or trusted for cleanup.
            if private_inputs is not None:
                from .source_inputs import MemorySourceInputs
                MemorySourceInputs.discard(private_inputs,context)
            if private_preparer is not None:
                from .source_preparer import AdmittedSourcePreparer
                AdmittedSourcePreparer.discard(private_preparer,original_request)
            if credentials is not None:
                from .source_credentials import SourceCredentialResources
                SourceCredentialResources.discard(credentials,original_request)
            if retirements is not None:
                from .retirement import RetirementBirths
                RetirementBirths.discard(retirements,original_request)
            # Always retire the admitted original slot. A source callback may
            # replace a public attribute before current() refuses; that never
            # transfers ownership of cleanup to its replacement set/snapshot.
            scope_maps[1].discard(key)
            if self._creation_cleanup[2] and not scope_maps[1]:scope_maps[0].clear()

    def close(self):
        held=self._creation_cleanup
        if held[2]:return
        held[2]=True
        self.closed=True
        maps=self._creation_scope[1]
        first=None
        for owner,close in held[0]:
            try:close(owner)
            except (Exception,CancelledError) as error:
                if first is None:first=error
        if not maps[1]:maps[0].clear()
        if first is not None:raise first
