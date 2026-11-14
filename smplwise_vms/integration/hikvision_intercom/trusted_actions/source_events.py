"""Owned selected event normalization and observed-owner source, OFF candidate.

The original normalizer, identity evidence and repository observation oracles
are explicit source ports. This is no event subscription or provider. Raw
payloads and the normalizer's private TEST material never enter snapshots or
diagnostics. A changed observed owner cannot silently retain an old name or
portrait through an otherwise unchanged view.
"""
from .source_bindings import same_ports

from collections import OrderedDict
from dataclasses import dataclass
from types import MethodType
from uuid import uuid4
from .event_projection import EventSource,META_ROW,IDENTITY,EVIDENCE
from .envelope import freeze,thaw
from .jobs import same_parameters
from .validation import Refusal,Schema,reference
from .source_identity import SourceIdentities


def _same(a,b):
    if a is b:return True
    return a.__self__ is b.__self__ and a.__func__ is b.__func__ if type(a) is MethodType and type(b) is MethodType else a is b


@dataclass(frozen=True,repr=False)
class _Observed:
    employee:object
    timestamp:object
    person:object
    portrait:object
    row_owner:object
    identity_owner:object
    evidence_owner:object
    public_row:object
    identity_fields:object
    evidence_fields:object


class SourceEventProducer:
    def __init__(self,*,station_id,repository,normalize,identity_evidence,explain,current_owners,group_catalog,status,zone,limit=5000):
        if repository is None or not all(callable(p) for p in (normalize,identity_evidence,explain,current_owners,group_catalog)) or type(limit) is not int or not 1<=limit<=5000:
            raise ValueError('explicit bounded event source ports required')
        self.station=reference(station_id);self.repository=repository
        self.identities=SourceIdentities(repository)
        self.normalize,self.identity,self.explain=normalize,identity_evidence,explain
        self.owners,self.groups=current_owners,group_catalog
        self.status,self.zone=freeze(status),freeze(zone);self.limit=limit
        self._ports=self.ports();self._owners=tuple(current_owners())
        if not self._owners or any(owner is None for owner in self._owners):raise ValueError('explicit source connection owners required')
        self._rows=OrderedDict();self._identities={};self._evidence={};self._observed={};self._source=None;self._issued_header=None;self.closed=False
        self._generation_maps=(self._rows,self._identities,self._evidence,self._observed)
        self._issued_maps=self._generation_maps
        # This constructor-owned cell advances only after a complete publish.
        # Rewriting both generation aliases cannot transfer cleanup ownership.
        self._generation_owner=[self._generation_maps,None,None]
        self._source=self._snapshot()
        self._issued_header=freeze(self._header(self._source))
        self._generation_owner[1:]=[self._source,self._issued_header]

    def ports(self):
        repo=self.repository
        return (self.station,repo,self.identities,self.identities.repository,self.normalize,self.identity,self.explain,self.owners,self.groups,self.status,self.zone,self.limit,
            repo.get,repo.event_person_ref,repo.event_portrait,repo.event_audience)

    def check(self):
        ports,expected_owners=self._ports,self._owners
        generation=self._generation_owner
        def metadata():
            if (type(self.closed)is not bool or self.closed or self._ports is not ports
                or self._owners is not expected_owners or not same_ports(ports,self.ports())):raise Refusal('cursor_stale')
            maps=generation[0]
            if (self._generation_owner is not generation or self._issued_maps is not maps
                or self._generation_maps is not maps or type(maps) is not tuple or len(maps)!=4
                or any(a is not b for a,b in zip(maps,(self._rows,self._identities,self._evidence,self._observed)))
                or self._source is not generation[1] or self._issued_header is not generation[2]):raise Refusal('cursor_stale')
        metadata()
        owners=tuple(self.owners())
        metadata()
        if len(owners)!=len(expected_owners) or any(a is not b for a,b in zip(owners,expected_owners)):raise Refusal('cursor_stale')

    @staticmethod
    def _person(value):
        if value is not None:Schema({'type':'object','properties':{'user_id':{'type':'string','format':'uuid'},'revision':{'type':'integer','minimum':1}},'required':['user_id','revision'],'additionalProperties':False})(value)
        return freeze(value)

    def publish(self,payload,*,received,selected_api):
        self.check();previous=self._source
        if len(self._rows)>=self.limit:raise Refusal('record_too_large')
        row=self.normalize(payload,self.station,received=received,selected_api=selected_api);self.check()
        if row is None:return None
        if type(row) is not dict or row.get('station_id')!=self.station:raise Refusal('binding_denied')
        key=reference(row.get('id'))
        if key in self._rows:raise Refusal('unproven_duplicate')
        employee,timestamp=row.get('employee_no'),row.get('timestamp')
        person=self._person(self.repository.event_person_ref(self.station,employee,timestamp));self.check()
        portrait=self._person(self.repository.event_portrait(self.station,employee,timestamp));self.check()
        row={**row,'portrait':thaw(portrait),'person_name':None}
        if person is not None:
            row['person_name']=self.identities.display_name(person['user_id'],person['revision']);self.check()
        flags=self.identity(payload,False,row);self.check()
        if type(flags) is not dict:raise Refusal('binding_denied')
        flags={**flags,'central_name_resolved':person is not None}
        evidence=self.explain(row);self.check()
        rows=OrderedDict(self._rows);identities=dict(self._identities);explanations=dict(self._evidence);observations=dict(self._observed)
        rows[key]=row;identities[key]=flags;explanations[key]=evidence
        observations[key]=_Observed(employee,timestamp,person,portrait,row,flags,evidence,
            freeze(self._row_fields(row)),freeze({k:flags[k] for k in IDENTITY['properties'] if k in flags}),
            freeze({k:evidence[k] for k in EVIDENCE['properties']}))
        # Build a complete generation before publishing any row. A failed
        # group/audience callback must not mutate the previous snapshot, and
        # a reentrant publication must not be overwritten by this candidate.
        source=self._snapshot(rows,identities,explanations,observations);self.check()
        if self._source is not previous:raise Refusal('cursor_stale')
        header=freeze(self._header(source))
        self._rows,self._identities,self._evidence,self._observed=rows,identities,explanations,observations
        self._generation_maps=(rows,identities,explanations,observations)
        self._issued_maps=self._generation_maps
        self._source,self._issued_header=source,header
        self._generation_owner[:]=[self._generation_maps,source,header]
        return key

    @staticmethod
    def _row_fields(row):
        # Exact selected metadata only; no card, private source body, raw
        # portrait bytes, unselected field traversal or content digest.
        names=(*META_ROW['properties'],'source','employee_no','person_name','portrait')
        return {k:row[k] for k in names}

    def _audience(self,observations=None):
        source=self.repository.event_audience();self.check()
        observations=self._observed if observations is None else observations
        keys={(self.station,birth.employee) for birth in observations.values()}
        result={}
        for key in keys:
            value=source.get(key)
            if value is not None:
                # Only the current-group selected surface is supported. The
                # private/profile branch is never copied into this snapshot.
                result[key]={'observed_at':value['observed_at'],'group_ids':list(value['group_ids']),'profile':{}}
        return result

    def _snapshot(self,rows=None,identities=None,evidence=None,observations=None):
        return EventSource(str(uuid4()),self._rows if rows is None else rows,thaw(self.status),False,
            self._identities if identities is None else identities,self.groups(),self._audience(observations),
            self._evidence if evidence is None else evidence,thaw(self.zone))

    @staticmethod
    def _header(source):
        return {'revision':source.revision,'status':source.status,
            'storage_failed':source.storage_failed,'zone':source.zone}

    def _check_rows(self):
        """Recheck selected owned metadata without another source callback."""
        if self._source is None:raise Refusal('binding_denied')
        if not same_parameters(self._header(self._source),self._issued_header):raise Refusal('cursor_stale')
        keys=self._observed.keys()
        if self._rows.keys()!=keys or self._identities.keys()!=keys or self._evidence.keys()!=keys:raise Refusal('cursor_stale')
        if self._source.rows is not self._rows or self._source.identities is not self._identities or self._source.evidence is not self._evidence:raise Refusal('cursor_stale')
        for key,birth in self._observed.items():
            row=self._rows.get(key);identity=self._identities.get(key);evidence=self._evidence.get(key)
            if row is not birth.row_owner or identity is not birth.identity_owner or evidence is not birth.evidence_owner:
                raise Refusal('cursor_stale')
            if not same_parameters(self._row_fields(row),birth.public_row) or not same_parameters({k:identity[k] for k in IDENTITY['properties'] if k in identity},birth.identity_fields) or not same_parameters({k:evidence[k] for k in EVIDENCE['properties']},birth.evidence_fields):
                raise Refusal('cursor_stale')

    def current(self,request=None):
        self.check();self._check_rows()
        for key,birth in self._observed.items():
            person=self._person(self.repository.event_person_ref(self.station,birth.employee,birth.timestamp));self.check()
            portrait=self._person(self.repository.event_portrait(self.station,birth.employee,birth.timestamp));self.check()
            if person!=birth.person or portrait!=birth.portrait:raise Refusal('cursor_stale')
            if person is not None:
                name=self.identities.display_name(person['user_id'],person['revision']);self.check()
                if name!=self._rows[key]['person_name']:raise Refusal('cursor_stale')
        if not same_parameters(self._audience(),self._source.audience) or not same_parameters(self.groups(),self._source.groups):raise Refusal('cursor_stale')
        self.check();self._check_rows();return self._source

    def close(self):
        self.closed=True
        # Only a completed publish can advance this cleanup owner. A replaced
        # metadata snapshot never transfers ownership of another map to us.
        for owned in self._generation_owner[0]:owned.clear()
        self._source=None;self._issued_header=None
        self._generation_owner[1:]=[None,None]
