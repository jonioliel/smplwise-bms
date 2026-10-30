"""Source-shaped engine hooks, exercised only with an injected local fake.

No manager or runtime is discovered here. Composition requires explicit typed
adapters: the presence of a hook never selects a command or proves a result
schema. Every return still passes the producer's safe projector. This port does
not calculate organizational roles and never falls back to classic dispatch.
"""
from .envelope import thaw
from .source_bindings import same_identities
from .validation import Refusal
from .producer import PUBLIC_ERRORS


class SourceEnginePort:
    def __init__(self, *, manager=None, runtime_for=None, public_reads=None,
                 card_edits=None, subscriptions=None, tts=None, media=None, health_history=None, source_error_type=None, mutations=None, sensitive=None, deletions=None):
        self.manager = manager
        self.runtime_for = runtime_for
        self.public_reads = dict(public_reads or {})
        self.card_edits = card_edits
        self.subscriptions = subscriptions
        self.tts = tts
        self.media = media
        self.health_history = health_history
        self.mutations=mutations
        self.sensitive=sensitive
        self.deletions=deletions
        if source_error_type is not None and (not isinstance(source_error_type,type) or not issubclass(source_error_type,Exception)):
            raise ValueError('explicit source error class required')
        self.source_error_type = source_error_type

    async def execute(self, action, params, context):
        from .adapters import EngineContext
        if type(context)is not EngineContext:raise Refusal('binding_denied')
        def identities():
            return (self.manager,getattr(self.manager,'enrollment',None),self.runtime_for,self.card_edits,self.subscriptions,self.tts,self.media,self.health_history,self.public_reads,self.public_reads.get(action),self.source_error_type,self.mutations,self.sensitive,self.deletions)
        before=identities()
        admitted=context
        def current(_):
            admitted.check()
            if not same_identities(before,identities()):raise Refusal('binding_denied')
            return True
        # Container ownership participates at every nested effect, not only
        # after the complete source call has already returned. Replacing a
        # receiver while an await is pending cannot authorize its next effect.
        context=EngineContext.scoped(admitted,current)
        context.trace=admitted.trace
        try:
            result=await self._execute(action,params,context)
            if not same_identities(before,identities()):raise Refusal('binding_denied')
            if action in {'users/update','users/set_active','users/archive','users/unarchive','users/temporary_cancel'}:
                if type(result)is not dict or type(result.get('id'))is not str or result['id']!=params['user_id']:raise Refusal('binding_denied')
            return result
        except Refusal:raise
        except Exception as error:
            if not same_identities(before,identities()):raise Refusal('binding_denied') from None
            # Preserve only public codes from the explicitly injected source
            # exception class. Never inspect arbitrary exception text/objects.
            code='action_failed'
            if self.source_error_type is not None and isinstance(error,self.source_error_type):
                candidate=getattr(error,'code',None)
                if type(candidate) is str and candidate in PUBLIC_ERRORS:code=candidate
            raise Refusal(code) from None

    async def _execute(self, action, params, context):
        context.check()
        if action in {'users/photo_get','users/pin_generate','whatsapp/preview','whatsapp/send'} and self.sensitive is not None:
            return await context.wait(lambda:self.sensitive.read(params,context))
        # The public-read callbacks must already be source-bound public producers,
        # never repository.get/public/private/from_private/snapshot shortcuts.
        if action in self.public_reads:
            return await context.wait(lambda:self.public_reads[action](params,context))
        if action=='health/history' and self.health_history is not None:
            owner=self.health_history()
            context.check()
            result=owner.public(params['station_id'])
            context.check()
            if self.health_history()is not owner:raise Refusal('binding_denied')
            return result
        manager = self.manager
        if action=='users/delete' and self.deletions is not None:
            from .source_deletions import SourceUserDeletion
            if type(self.deletions) is not SourceUserDeletion:raise Refusal('binding_denied')
            return await context.wait(lambda:self.deletions.apply(params,context))
        if action in {'users/create','users/update','users/set_active','users/archive','users/unarchive','users/temporary_cancel'} and self.mutations is not None:
            return await context.wait(lambda:self.mutations.apply(action,params,context))
        if action in {'users/create','users/update','users/set_active','users/delete',
                      'users/archive','users/unarchive','users/temporary_cancel'}:
            if manager is None:raise Refusal('unknown_action')
            if action=='users/create':
                return await context.wait(lambda:manager.async_create(thaw(params['data']),sync_now=params.get('sync_now',True)))
            if action in {'users/update','users/set_active'}:
                patch={'active':params['active']} if action=='users/set_active' else thaw(params['data'])
                return await context.wait(lambda:manager.async_update(params['user_id'],patch,
                    revision=params['revision'],sync_now=params.get('sync_now',True)))
            if action=='users/delete':
                await context.wait(lambda:manager.async_delete(params['user_id'],revision=params['revision']))
                return {'accepted':True}
            if action in {'users/archive','users/unarchive'}:
                # Existing source intent field, not a new WisKey confirmation flow.
                if params['confirmed'] is not True:raise Refusal('invalid_fields')
                return await context.wait(lambda:manager.async_archive(params['user_id'],revision=params['revision'],
                    archived=action=='users/archive'))
            return await context.wait(lambda:manager.async_cancel_temporary(params['user_id'],revision=params['revision']))
        if action in {'cards/add','cards/remove'}:
            if self.card_edits is None:raise Refusal('unknown_action')
            # Dedicated receiver owns ManagedCard conversion. A captured card or
            # a structurally similar dict cannot silently become a ManagedCard.
            return await context.wait(lambda:self.card_edits.apply(action,params,context))
        if action.startswith('cards/capture_') or action=='cards/reader_capabilities':
            if manager is None:raise Refusal('unknown_action')
            enrollment=manager.enrollment
            actor=context.request.get('actor')
            if actor['kind']!='human':raise Refusal('binding_denied')
            actor_id=actor['user_id']
            if action=='cards/reader_capabilities':
                return await context.wait(lambda:enrollment.capabilities(params['station_id']))
            if action=='cards/capture_start':
                def authorize():
                    try:context.check();return True
                    except Exception:return False
                return enrollment.start(params['station_id'],params['user_id'],params['revision'],
                                        params['reader_id'],actor_id,authorize=authorize)
            if action=='cards/capture_status':return enrollment.status(params['session_id'],actor_id)
            if action=='cards/capture_cancel':
                await context.wait(lambda:enrollment.cancel(params['session_id'],actor_id))
                return {'cancelled':True}
            return await context.wait(lambda:enrollment.confirm(params['session_id'],actor_id,params['label']))
        if action=='stations/test_unlock':
            if self.runtime_for is None:raise Refusal('unknown_action')
            runtime=self.runtime_for(params['station_id'])
            if runtime is None:raise Refusal('device_unavailable')
            await context.wait(lambda:runtime.async_unlock(params['lock']))
            if self.runtime_for(params['station_id']) is not runtime:raise Refusal('binding_denied')
            return {'accepted':True}
        if action=='subscribe' and self.subscriptions is not None:
            return await context.wait(lambda:self.subscriptions.attach(context))
        if action=='tts/start' and self.tts is not None:
            return await context.wait(lambda:self.tts.start(params,context))
        if action=='media/signal' and self.media is not None:
            return await context.wait(lambda:self.media.signal(params,context))
        # PG/photo/WhatsApp stay absent without a separately closed opaque flow.
        raise Refusal('unknown_action')
