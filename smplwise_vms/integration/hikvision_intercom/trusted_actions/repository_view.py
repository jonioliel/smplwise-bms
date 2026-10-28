"""Read selected public fields directly, never users/get/public/from_private/export.

The trusted engine host injects current_users=lambda: repository._state['users'].
No provider is installed automatically. Arx supplies the authorized UUID set in
its internal authenticated view; WisKey does not decide record membership.
"""
from .safe_csv import CsvRefusal, identity
from .validation import Refusal, integer


class RepositoryPublicSource:
    def __init__(self,current_users):self.current_users=current_users

    def _ids(self,view):
        ids=view.authorized_person_ids
        if type(ids) is not tuple:raise CsvRefusal('cursor_stale')
        for person in ids:identity(person)
        if len(set(ids))!=len(ids):raise CsvRefusal('cursor_stale')
        return ids

    def _record(self,person):
        state=self.current_users()
        if type(state) is not dict or person not in state:raise CsvRefusal('cursor_stale')
        raw=state[person]
        if type(raw) is not dict or raw.get('id')!=person:raise CsvRefusal('cursor_stale')
        return raw

    async def vector(self,view):
        result=[]
        for person in self._ids(view):
            raw=self._record(person)
            try:revision=integer(raw['revision'],1)
            except (KeyError,Refusal):raise CsvRefusal('cursor_stale') from None
            result.append((person,revision))
        return result

    async def row(self,view,person):
        if person not in self._ids(view):raise CsvRefusal('cursor_stale')
        raw=self._record(person)
        try:
            # Exact source aliases only; no reading/iterating/hashing other values.
            return {'person_id':raw['id'],'profile_revision':raw['revision'],'display_name':raw['display_name'],
                    'valid_from':raw['valid_from'],'valid_until':raw['valid_until'],'group_ids':raw['group_ids']}
        except KeyError:raise CsvRefusal('cursor_stale') from None
