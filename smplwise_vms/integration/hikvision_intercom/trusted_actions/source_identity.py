"""Fresh narrow identity producer over the injected source repository state.

Only id/revision and an explicitly selected display name are read. The original repository/model still performs every
body conversion, save and engine operation. Rebuilding a private ManagedUser
for each nested metadata guard would repeatedly inspect unrelated private
fields. This feed caches neither state, authority, source results nor identity.
"""
from dataclasses import dataclass
from .validation import Refusal,reference
from .jobs import same_parameters


@dataclass(frozen=True,repr=False)
class SourceIdentity:
    id:str
    revision:int


class SourceIdentities:
    def __init__(self,repository):
        if repository is None:raise ValueError('explicit source repository required')
        self.repository=repository;self._owner=repository

    def identity(self,person):
        reference(person);repository=self.repository
        if repository is not self._owner:raise Refusal('binding_denied')
        state=repository._state
        if type(state) is not dict or type(state.get('users')) is not dict:raise Refusal('binding_denied')
        raw=state['users'].get(person)
        if type(raw) is not dict or type(raw.get('id')) is not str or raw['id']!=person or type(raw.get('revision')) is not int or raw['revision']<1:
            raise Refusal('binding_denied')
        value=SourceIdentity(raw['id'],raw['revision'])
        if self.repository is not repository or repository._state is not state:raise Refusal('binding_denied')
        return value

    def check_policy(self,person,revision,station,expected):
        identity=self.identity(person);repository=self.repository;state=repository._state
        raw=state['users'][person];assignments=raw.get('assignments')
        if identity.revision!=revision or raw.get('active') is not True or type(assignments) is not dict or type(assignments.get(station)) is not dict or assignments[station].get('enabled') is not True or not same_parameters(raw.get('access_timing_policy'),expected):
            raise Refusal('binding_denied')
        if repository._state is not state or self.identity(person)!=identity:raise Refusal('binding_denied')
        return identity

    def display_name(self,person,revision):
        identity=self.identity(person);repository=self.repository;state=repository._state
        raw=state['users'][person]
        if type(revision) is not int or revision!=identity.revision:raise Refusal('binding_denied')
        value=raw.get('display_name')
        if type(value) is not str or not 1<=len(value)<=128:raise Refusal('binding_denied')
        if self.repository is not repository or repository._state is not state or state['users'].get(person) is not raw or self.identity(person)!=identity:raise Refusal('binding_denied')
        return value

    def stations(self,person):
        """Fresh assignment keys only, without private ManagedUser rebuilding."""
        identity=self.identity(person);repository=self.repository;state=repository._state
        raw=state['users'][person];assignments=raw.get('assignments')
        if type(assignments) is not dict or len(assignments)>100:raise Refusal('binding_denied')
        result=tuple(assignments)
        for station in result:reference(station)
        if self.repository is not repository or repository._state is not state or state['users'].get(person) is not raw or raw.get('assignments') is not assignments or self.identity(person)!=identity:
            raise Refusal('binding_denied')
        return result
