"""Selected-field source producer for users/get; no private serializer fallback.

The current source state and fresh Arx view are injected. This bounded profile
uses the existing person field names; it neither implements a new endpoint nor
infers field/row permissions. Other person/query/mutation fields stay OFF.
"""
from .repository_view import RepositoryPublicSource
from .safe_csv import ArxView,FIELDS,public_row,identity
from .validation import Refusal,integer,reference

PUBLIC_PEOPLE_SELECTIONS=frozenset({'rev1','rev2'})

class PublicPeople:
    def __init__(self,current_users,fresh_arx_view):
        if not callable(current_users) or not callable(fresh_arx_view):raise ValueError('explicit source and Arx providers required')
        self.current_users=current_users;self.fresh_arx_view=fresh_arx_view
        self.source=RepositoryPublicSource(current_users)

    async def get(self,params,context):
        request=context.request;person=identity(params['user_id'])
        provider=self.fresh_arx_view;state_provider=self.current_users;source=self.source
        record_reader=source._record;row_reader=source.row
        def current():
            context.check()
            if (request.get('selection_revision') not in PUBLIC_PEOPLE_SELECTIONS or
                self.fresh_arx_view is not provider or self.current_users is not state_provider or
                self.source is not source or source.current_users is not state_provider or
                source._record!=record_reader or source.row!=row_reader):raise Refusal('permissions_changed')
        def check(view):
            current()
            if type(view)is not ArxView or type(view.permission_revision)is not int or view.permission_revision!=request.get('operation')['permission_revision'] or type(view.selection_revision)is not str or view.selection_revision!=request.get('selection_revision') or type(view.allowed_fields)is not frozenset or view.allowed_fields!=frozenset(FIELDS):raise Refusal('permissions_changed')
            reference(view.view_reference)
            if type(view.authorized_person_ids)is not tuple or person not in view.authorized_person_ids:raise Refusal('Unauthorized')
            return view
        current()
        view=check(await context.wait(lambda:provider(request)))
        current();state=state_provider()
        current();raw=record_reader(person)
        current()
        result=public_row(await context.wait(lambda:row_reader(view,person)))
        fresh=check(await context.wait(lambda:provider(request)))
        if fresh!=view or self.fresh_arx_view is not provider or self.current_users is not state_provider or state_provider()is not state or state.get(person)is not raw or integer(raw['revision'],1)!=result['profile_revision']:
            raise Refusal('permissions_changed')
        context.check()
        return {'id':result['person_id'],'revision':result['profile_revision'],**{key:result[key] for key in FIELDS}}
