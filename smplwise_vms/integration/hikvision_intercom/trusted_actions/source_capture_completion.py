"""Owned selected capture save and source-worker completion, locally OFF.

Only the original enrollment callback, in the receiver's current task, can
enter this path. Its person/revision/session come from the sealed start birth,
never from confirm parameters or an inherited job. Private capture data stays
inside the original source build/repository and request-owned RAM resources.
"""
from .source_bindings import same_ports
from .source_commit_guard import source_commit

from dataclasses import dataclass
from types import MethodType
from .adapters import EngineContext
from .envelope import freeze, thaw
from .validation import Refusal


def _same(a,b):
    if a is b:return True
    return a.__self__ is b.__self__ and a.__func__ is b.__func__ if type(a) is MethodType and type(b) is MethodType else a is b


@dataclass(frozen=True,repr=False)
class _CompletionOwner:
    roots:tuple
    ports:tuple
    cleanup:tuple
    stopped:list
    binding:list
    identity:object


class SourceCaptureCompletion:
    def __init__(self,*,repository,build_user,validate,managed_card_type,now,audit_scope,enqueue,changed,credentials,owns_credentials=True,configuration=None):
        from .source_credentials import SourceCredentialResources
        if repository is None or type(owns_credentials) is not bool or not isinstance(managed_card_type,type) or not all(callable(p) for p in (build_user,validate,now,audit_scope,enqueue,changed)):
            raise ValueError('explicit capture source ports required')
        if type(credentials) is not SourceCredentialResources or not _same(credentials.current_user,repository.get) or credentials.card_type is not managed_card_type:
            raise ValueError('same owned credential source required')
        self.repository,self.build,self.validate,self.card_type=repository,build_user,validate,managed_card_type
        if configuration is not None:
            from .source_configuration import SourceConfigurationRevision
            if type(configuration) is not SourceConfigurationRevision or configuration.repository is not repository:raise ValueError('same capture source configuration revision required')
        self.configuration=configuration
        self.now,self.audit,self.enqueue,self.changed,self.credentials=now,audit_scope,enqueue,changed,credentials
        self.owns_credentials=owns_credentials
        self._credential_cleanup=credentials if owns_credentials else None
        from .source_identity import SourceIdentities
        self.identities=SourceIdentities(repository)
        self.receiver=None;self._bound=None;self.closed=False;self._used=set();self._active={}
        self._owned_maps=(self._used,self._active)
        self._cleanup_maps=self._owned_maps
        self._creation_cleanup=(self._owned_maps,self._credential_cleanup)
        self._creation_stopped=[False]
        self._creation_source=_CompletionOwner(self._roots(),self._ports(),
            self._creation_cleanup,self._creation_stopped,[None,None],self.identities.identity)

    def _roots(self):
        # Check direct constructor roots before descending into any current
        # repository/credential object or inspecting its method attributes.
        return (self.repository,self.build,self.validate,self.card_type,self.now,self.audit,self.enqueue,self.changed,
                self.credentials,self.identities,self.owns_credentials,self._credential_cleanup,self.configuration,
                self._owned_maps,self._cleanup_maps,self._used,self._active)

    def _check_source(self,*,metadata=False):
        o=self._creation_source
        if not same_ports(o.roots,self._roots()):raise Refusal('binding_denied')
        if not _same(o.identity,self.identities.identity):raise Refusal('binding_denied')
        receiver,bound=o.binding
        if self.receiver is not receiver or self._bound is not bound:raise Refusal('binding_denied')
        # Revision lookup reads the original narrow identity feed only. It
        # must not inspect or invoke private body getters; writes still require
        # the complete original native-port comparison below.
        if metadata:return
        expected=(*o.ports[:9],receiver,*o.ports[10:])
        if not same_ports(expected,self._ports()):raise Refusal('binding_denied')

    def _check_cleanup(self,*,metadata=False):
        o=self._creation_source
        maps,credentials=o.cleanup
        if (o.stopped[0] or self._creation_stopped is not o.stopped or self._creation_cleanup is not o.cleanup
            or self._owned_maps is not maps or self._cleanup_maps is not maps
            or self._used is not maps[0] or self._active is not maps[1]
            or self._credential_cleanup is not credentials):raise Refusal('binding_denied')
        self._check_source(metadata=metadata)

    def bind(self,receiver):
        self._check_cleanup()
        if self.receiver is not None or self._bound is not None or self.closed:raise ValueError('one capture source owner required')
        self.receiver=receiver;self._bound=self._ports()
        self._creation_source.binding[:]=[receiver,self._bound]

    def check_binding(self):
        self._check_cleanup()
        if self.closed or self._bound is None or not same_ports(self._bound,self._ports()):
            raise Refusal('binding_denied')

    def _ports(self):
        return (self.repository,self.build,self.validate,self.card_type,self.now,self.audit,self.enqueue,self.changed,self.credentials,self.receiver,
                self.repository.get,self.repository.permission_data,self.repository.async_update,self.repository._save,self.repository._lock,
                self.credentials.current_user,self.credentials.card_type,self.identities,self.identities.repository,self.owns_credentials,self._credential_cleanup,self.configuration,getattr(self.configuration,'repository',None),getattr(self.configuration,'current',None),self._owned_maps,self._cleanup_maps,self._used,self._active)

    def current_revision(self,person):
        # A version guard needs id/revision, not the source's private body
        # conversion. Original repository getters still own actual source work.
        self._check_cleanup(metadata=True)
        if self.closed or self.identities.repository is not self.repository:raise Refusal('binding_denied')
        value=self._creation_source.identity(person)
        self._check_cleanup(metadata=True)
        return value.revision

    async def update(self,person,patch,*,revision):
        from .legacy_capture import current_confirm_context,current_confirm_birth
        parent=current_confirm_context(self.receiver);birth=current_confirm_birth(self.receiver)
        self.check_binding()
        credentials=self.credentials
        maps=self._creation_source.cleanup[0]
        if self._owned_maps is not maps or self._used is not maps[0] or self._active is not maps[1]:raise Refusal('binding_denied')
        key=parent.request.get('operation_binding_ref');ports=self._ports()
        if self.closed or self.receiver is None or person!=birth.person or type(revision) is not int or revision!=birth.revision or key in self._used or len(self._used)>=4096:
            raise Refusal('binding_denied')
        self._used.add(key);self._active[key]=parent.request
        configuration=self.configuration;configuration_revision=None
        def current(_=None):
            parent.check()
            self.check_binding()
            if self._owned_maps is not maps or self._used is not maps[0] or self._active is not maps[1] or self.closed or maps[1].get(key) is not parent.request or not same_ports(ports,self._ports()) or self.credentials.closed:
                raise Refusal('binding_denied')
            # The worker explicitly creates owned child tasks. Entry into this
            # callback remains current-task-only; its sealed parent guard may
            # be checked by those children without granting them callback entry.
            if self.receiver._completion is not self:raise Refusal('binding_denied')
            if configuration is not None and configuration.current()!=configuration_revision:raise Refusal('binding_denied')
            parent.check();self.check_binding()
            if (not same_ports(ports,self._ports()) or self.credentials.closed
                or maps[1].get(key) is not parent.request or self.receiver._completion is not self):raise Refusal('binding_denied')
            return True
        context=EngineContext.scoped(parent,current);context.trace=parent.trace
        try:
            configuration_revision=configuration.current() if configuration is not None else None
            current();previous=self.repository.get(person);current()
            if previous.id!=person or type(previous.revision) is not int or previous.revision!=revision:raise Refusal('binding_denied')
            if type(patch) is not dict or set(patch)!={'cards'} or type(patch['cards']) is not list or len(patch['cards'])!=len(previous.cards)+1:
                raise Refusal('invalid_fields')
            old=[{'id':c.id,'label':c.label,'enabled':c.enabled} for c in previous.cards]
            if patch['cards'][:-1]!=old:raise Refusal('binding_denied')
            raw=patch['cards'][-1]
            if type(raw) is not dict or set(raw)!={'card_no','card_type','label','enabled'} or raw['enabled'] is not True:
                raise Refusal('invalid_fields')
            candidate=self.build(self.repository.permission_data(patch,previous),previous=previous,employee_no=previous.employee_no,now=self.now())
            current();self.validate(candidate);current()
            new=[c for c in candidate.cards if c.id not in {c.id for c in previous.cards}]
            if len(new)!=1 or type(new[0]) is not self.card_type:raise Refusal('binding_denied')
            bound=freeze({'cards':[*old,{**raw,'id':new[0].id}]})
            def commit_current():current()
            with self.audit(context.request.get('actor')['user_id'],'cards/capture_confirm'),source_commit(self.repository,commit_current):
                saved=await context.wait(lambda:self.repository.async_update(person,thaw(bound),expected_revision=revision))
            current()
            if saved.id!=person or type(saved.revision) is not int or saved.revision!=revision+1:raise Refusal('binding_denied')
            self.credentials.observe_capture(context,self.receiver,person,saved.revision)
            current();await context.wait(lambda:self.enqueue(person,saved.revision,context));current()
            self.changed();current()
            return {k:getattr(saved,k) for k in ('id','revision','display_name','valid_from','valid_until','group_ids')}
        finally:
            from .source_credentials import SourceCredentialResources
            SourceCredentialResources.discard(credentials,parent.request)
            # Use the admitted original table even if a callback replaced the
            # public snapshot before the next binding check refused.
            active=maps[1]
            if active.get(key) is parent.request:active.pop(key,None)

    def close(self):
        o=self._creation_source
        if o.stopped[0]:return
        o.stopped[0]=True
        self.closed=True
        maps,credentials=o.cleanup
        maps[0].clear();maps[1].clear()
        if credentials is not None:
            from .source_credentials import SourceCredentialResources
            SourceCredentialResources.close(credentials)
