"""Internal source-stage derivation, no additional RBAC or wire fields.

Every effect receives fresh Arx admission with the same immutable action,
actor, target, schema, parameters and revisions. Stage names are fixed source
boundaries, not a free source selector. A used stage cannot retry an unknown
write. The injected version/owner providers supply public metadata only.
"""
from .source_bindings import same_identities

from dataclasses import dataclass,replace
from .adapters import EngineContext
from .envelope import thaw, freeze
from .jobs import Provenance, same_parameters
from .journal import Journal
from .lifetime import raise_if_cancelling as _not_cancelled
from .validation import Refusal, reference

STAGES={
 'users/delete':frozenset({'delete_person','delete_card'}),
 'users/create':frozenset({'create_person','create_card','update_card','timing_weekly','timing_template','timing_holiday_group','timing_holiday'}),
 'users/update':frozenset({'create_person','update_person','delete_person','create_card','update_card','delete_card','timing_weekly','timing_template','timing_holiday_group','timing_holiday'}),
 'users/set_active':frozenset({'create_person','update_person','delete_person','create_card','update_card','delete_card'}),
 'users/archive':frozenset({'delete_person','delete_card'}),
 'users/unarchive':frozenset({'delete_person','delete_card'}),
 'users/temporary_cancel':frozenset({'delete_person','delete_card'}),
 'cards/add':frozenset({'create_person','update_person','delete_person','create_card','update_card','delete_card'}),
 'cards/remove':frozenset({'create_person','update_person','delete_person','create_card','update_card','delete_card'}),
 'cards/capture_confirm':frozenset({'create_person','update_person','create_card','update_card'}),
}

@dataclass(frozen=True,repr=False)
class SourceBirth:
    origin: Provenance
    parameters: object
    person_id: str
    revision: int
    station_id: str
    mapping: object
    owners: tuple
    resource_id: str | None = None
    configuration_revision:int|None=None


@dataclass(frozen=True,repr=False)
class SourceAdmission:
    """Trusted port's exact source association, never a signed wire field.

    The context must still pass every fresh existing authority/binding check.
    This metadata cannot authorize anything or prove a signature by itself.
    It prevents a valid but unrelated child response being adopted for a
    different source birth, station, resource or stage.
    """
    birth:SourceBirth
    stage:str
    context:EngineContext

class SourceEffectSession:
    def __init__(self, parent, *, person_id, revision, station_id, current_mapping, source_version,
                 source_owners, fresh_admission, journal, clock_sample, retirement_owner=None, timing_owner=None, credential_owner=None,require_bound_admission=False,configuration_revision=None):
        if type(parent) is not EngineContext or parent.epoch is None or parent.parameters is None or type(journal) is not Journal:
            raise Refusal('binding_denied')
        if not all(callable(x) for x in (current_mapping,source_version,source_owners,fresh_admission,clock_sample)):
            raise ValueError('explicit source and authority providers required')
        if type(revision) is not int or revision<1:raise Refusal('binding_denied')
        if type(require_bound_admission) is not bool:raise ValueError('explicit source admission binding mode required')
        if configuration_revision is not None and (type(configuration_revision) is not int or configuration_revision<0):raise ValueError('exact nullable source configuration revision required')
        self.require_bound_admission=require_bound_admission
        parent.check();reference(person_id);reference(station_id)
        origin=Provenance.capture(parent.request,parent.epoch)
        if origin.action not in STAGES:raise Refusal('binding_denied')
        mapped=current_mapping(parent.request)
        if type(mapped) is not dict or mapped.get('config_entry_id')!=station_id or any(type(mapped.get(k)) is not type(v) or mapped.get(k)!=v for k,v in thaw(origin.target).items()):
            raise Refusal('binding_denied')
        self.birth=SourceBirth(origin,parent.parameters,person_id,revision,station_id,freeze(mapped),tuple(source_owners()),configuration_revision=configuration_revision)
        self.mapping,self.version,self.owners,self.admit,self.journal,self.clock=current_mapping,source_version,source_owners,fresh_admission,journal,clock_sample
        if retirement_owner is not None:
            from .retirement import RetirementBirths
            if type(retirement_owner) is not RetirementBirths:raise ValueError('sealed retirement source required')
        self.retirement_owner=retirement_owner
        if timing_owner is not None:
            from .source_timing import SourceTimingResources
            if type(timing_owner) is not SourceTimingResources:raise ValueError('sealed timing resource source required')
        self.timing_owner=timing_owner
        if credential_owner is not None:
            from .source_credentials import SourceCredentialResources
            from .source_deletions import SourceDeletionResources
            if type(credential_owner) not in (SourceCredentialResources,SourceDeletionResources):raise ValueError('sealed source credential owner required')
        self.credential_owner=credential_owner
        self._resource_owners=(retirement_owner,timing_owner,credential_owner)
        self.parent=parent;self.closed=False;self._stages=set();self._active=False
        self._source_ports=(self.mapping,self.version,self.owners,self.admit,self.journal,self.clock,self.birth,self.parent,self.require_bound_admission)
        self._birth_binding=self._birth_parts(self.birth)
        self._origin_binding=self._origin_parts(self.birth.origin)
        self._identities={name:{value} for name,value in self._ids(parent.request).items()}
        self.check_source()

    @staticmethod
    def _birth_parts(birth):
        return (birth.origin,birth.parameters,birth.person_id,birth.revision,birth.station_id,
            birth.mapping,birth.owners,birth.resource_id,birth.configuration_revision)

    @staticmethod
    def _origin_parts(origin):
        return (origin.parent_request_id,origin.parent_operation_id,origin.actor,origin.target,
            origin.action,origin.grant,origin.selection_revision,origin.schema,origin.epoch,origin.channel)

    def _birth_current(self):
        birth=self.birth
        return (type(birth) is SourceBirth and type(birth.origin) is Provenance
            and same_identities(self._birth_binding,self._birth_parts(birth))
            and same_identities(self._origin_binding,self._origin_parts(birth.origin)))

    @staticmethod
    def _ids(request):
        return {'request':request.get('request_id'),'operation':request.get('operation_id'),'binding':request.get('operation_binding_ref'),
                'decision':request.get('decision')['decision_id'],'parameters':request.get('operation')['parameter_reference']}

    def check_source(self):
        def ports():return self.mapping,self.version,self.owners,self.admit,self.journal,self.clock,self.birth,self.parent,self.require_bound_admission
        if not same_identities(self._source_ports,ports()) or not self._birth_current():raise Refusal('binding_denied')
        self.parent.check();sample=self.clock();sample.check();self.parent.request.check_time(sample.now)

        # Check the association before using callback-selected source IDs.
        if (not self._birth_current() or not same_identities(self._source_ports,ports())
            or not same_identities(self._resource_owners,(self.retirement_owner,self.timing_owner,self.credential_owner))):raise Refusal('binding_denied')
        b=self.birth
        revision=self.version(b.person_id)
        owners=tuple(self.owners())
        if self.closed or not same_identities(self._resource_owners,(self.retirement_owner,self.timing_owner,self.credential_owner)) or any(owner is not None and owner.closed for owner in self._resource_owners) or type(revision) is not int or revision!=b.revision or len(owners)!=len(b.owners) or any(a is not c for a,c in zip(owners,b.owners)):
            raise Refusal('binding_denied')
        fresh=self.mapping(self.parent.request)
        if not same_parameters(fresh,b.mapping):raise Refusal('binding_denied')
        final_owners=tuple(self.owners());final_revision=self.version(b.person_id)
        if len(final_owners)!=len(b.owners) or any(a is not c for a,c in zip(final_owners,b.owners)) or type(final_revision) is not int or final_revision!=b.revision or not same_identities(self._source_ports,ports()):raise Refusal('binding_denied')
        self.parent.check();sample=self.clock();sample.check();self.parent.request.check_time(sample.now)
        # The final authority/clock callbacks also precede this check. This
        # binds source metadata, never a previous permission verdict/result.
        if (not self._birth_current() or not same_identities(self._source_ports,ports())
            or not same_identities(self._resource_owners,(self.retirement_owner,self.timing_owner,self.credential_owner))):raise Refusal('binding_denied')

    async def dispatch(self, stage, factory, *, retirement=None, timing=None, credential=None):
        from .retirement import RetirementBirth
        if type(stage) is not str:raise Refusal('binding_denied')
        if sum(item is not None for item in (retirement,timing,credential))>1:raise Refusal('binding_denied')
        # Newly closed user/card transitive branches require a post-save public
        # source resource, not just a stage label or a reused parent decision.
        if stage in {'create_card','update_card'} and self.birth.origin.action.startswith('users/') and credential is None:raise Refusal('binding_denied')
        resource_id=None
        if credential is not None:
            from .source_credentials import CredentialBirth
            if type(credential) is not CredentialBirth or self.credential_owner is None or stage not in {'create_card','update_card','delete_card'} or credential.person_id!=self.birth.person_id or credential.revision!=self.birth.revision or credential.parent!=self.birth.origin:
                raise Refusal('binding_denied')
            resource_id=credential.resource_id
        if stage.startswith('timing_'):
            from .source_timing import TimingResourceBirth
            if (retirement is not None or type(timing) is not TimingResourceBirth or self.timing_owner is None
                    or stage!='timing_'+timing.kind or timing.person_id!=self.birth.person_id or timing.revision!=self.birth.revision
                    or timing.parent!=self.birth.origin):raise Refusal('binding_denied')
            resource_id=timing.resource_id
        elif timing is not None:raise Refusal('binding_denied')
        if retirement is not None:
            if (type(retirement) is not RetirementBirth or self.retirement_owner is None or stage!='delete_card' or retirement.kind!='retired_cards'
                    or retirement.person_id!=self.birth.person_id or retirement.revision!=self.birth.revision or retirement.parent!=self.birth.origin):raise Refusal('binding_denied')
            resource_id=retirement.resource_id
        slot=stage if resource_id is None else (stage,resource_id)
        if stage not in STAGES[self.birth.origin.action] or slot in self._stages or self._active or not callable(factory):
            raise Refusal('unproven_duplicate')
        self.check_source();self._active=True;self._stages.add(slot)
        require_bound=self.require_bound_admission
        owners=(self.mapping,self.version,self.owners,self.admit,self.journal,self.clock,self.birth,self.retirement_owner,self.timing_owner,self.credential_owner,require_bound)
        try:
            _not_cancelled()
            if retirement is not None:self.retirement_owner.claim(self.parent,retirement,self.birth.station_id)
            if timing is not None:self.timing_owner.claim(self.parent,timing,self.birth.station_id)
            if credential is not None:self.credential_owner.claim(self.parent,credential,self.birth.station_id,stage)
            admission_birth=replace(self.birth,resource_id=resource_id)
            admission_binding=self._birth_parts(admission_birth)
            admitted=await self.admit(admission_birth,stage)
            if (type(admission_birth) is not SourceBirth or not self._birth_current()
                or not same_identities(admission_binding,self._birth_parts(admission_birth))):raise Refusal('binding_denied')
            if type(admitted) is SourceAdmission:
                if admitted.birth is not admission_birth or type(admitted.stage) is not str or admitted.stage!=stage:
                    raise Refusal('binding_denied')
                child=admitted.context
            elif require_bound:raise Refusal('binding_denied')
            else:child=admitted  # Retained explicitly bounded component seam.
            _not_cancelled()
            if not same_identities(owners,(self.mapping,self.version,self.owners,self.admit,self.journal,self.clock,self.birth,self.retirement_owner,self.timing_owner,self.credential_owner,self.require_bound_admission)) or type(child) is not EngineContext:
                raise Refusal('binding_denied')
            child.check();origin=Provenance.capture(child.request,child.epoch);b=self.birth
            if (origin.actor,origin.target,origin.action,origin.grant,origin.selection_revision,origin.schema,origin.epoch,origin.channel)!=(b.origin.actor,b.origin.target,b.origin.action,b.origin.grant,b.origin.selection_revision,b.origin.schema,b.origin.epoch,b.origin.channel) or not same_parameters(child.parameters,b.parameters):
                raise Refusal('binding_denied')
            ids=self._ids(child.request)
            if any(value in self._identities[name] for name,value in ids.items()):raise Refusal('unproven_duplicate')
            for name,value in ids.items():self._identities[name].add(value)
            def current(_):
                child.check();self.check_source()
                if retirement is not None:self.retirement_owner.check_claim(self.parent,retirement,self.birth.station_id)
                if timing is not None:self.timing_owner.check_claim(self.parent,timing,self.birth.station_id)
                if credential is not None:self.credential_owner.check_claim(self.parent,credential,self.birth.station_id,stage)
                if not same_identities(owners,(self.mapping,self.version,self.owners,self.admit,self.journal,self.clock,self.birth,self.retirement_owner,self.timing_owner,self.credential_owner,self.require_bound_admission)):
                    raise Refusal('binding_denied')
                sample=self.clock();sample.check();child.request.check_time(sample.now)
                _not_cancelled()
                return True
            scoped=EngineContext.scoped(child,current)
            scoped.check();sample=self.clock();sample.check()
            self.journal.reserve(child.request.get('request_id'),child.request.get('operation_id'),sample.now)
            try:return await scoped.wait(lambda:factory(scoped))
            finally:self.journal.finish(child.request.get('request_id'))
        finally:self._active=False

    def close(self):self.closed=True
