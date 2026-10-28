"""Bounded TTS source connector, used only with explicit local fake dependencies.

The connector receives the opaque input exactly once and must use the supplied
context at its source effects. No provider, codec, audio client or HA discovery
is imported. ACK is a null source ACK; even a completed software worker does
not prove audible output. A child requires fresh existing Arx admission.
"""
import asyncio
from dataclasses import dataclass

from .adapters import EngineContext, closed
from .envelope import thaw
from .jobs import DerivedJobs, same_parameters
from .sensitive import SensitiveReferences
from .validation import Refusal, Schema


@dataclass(frozen=True, repr=False)
class TtsStarted:
    acknowledged: bool
    task: object
    cancel: object


class SourceTts:
    def __init__(self, *, epoch, clock_sample, jobs, connect, emit):
        if type(jobs) is not DerivedJobs or not callable(connect) or not callable(emit):
            raise ValueError('explicit admitted jobs, source connector and metadata sink required')
        self.jobs, self.connect, self.emit = jobs, connect, emit
        self.closed = False
        self._active = {}
        self.references = SensitiveReferences(epoch=epoch, clock_sample=clock_sample,
                                              receivers={'tts/start': self._receive})

    async def start(self, params, context):
        if type(context) is not EngineContext or not same_parameters(params, context.parameters):
            raise Refusal('binding_denied')
        return await self.references.transfer(context)

    async def _receive(self, opaque, parent):
        if self.closed or parent.request.get('action') != 'tts/start':
            raise Refusal('binding_denied')
        jobs, connect, emit, references = self.jobs, self.connect, self.emit, self.references
        def stable():
            parent.check()
            if self.closed or self.jobs is not jobs or self.connect is not connect or self.emit is not emit or self.references is not references:
                raise Refusal('binding_denied')
        stable()
        async def worker(effect):
            async def run(child):
                stable()
                def current(_):
                    stable(); child.check()
                    return True
                scoped = EngineContext.scoped(child,current)
                key = child.request.get('operation_id')
                item = {'handle': None, 'cancelled': False}
                self._active[key] = item
                def event(value):
                    scoped.check()
                    # Only metadata for the exact source branches. No payload,
                    # error object, provider body or free serialization path.
                    if type(value) is not dict or value.get('format') != 'hikvision_intercom.tts':
                        raise Refusal('invalid_fields')
                    state = value.get('state')
                    fields = {'format': {'const': 'hikvision_intercom.tts'}, 'state': {'const': state}}
                    number = {'type': 'number', 'minimum': 0, 'maximum': 180}
                    if state == 'speaking':
                        fields.update(duration_seconds=number, packet_count={'type': 'integer', 'minimum': 0, 'maximum': 1800})
                    elif state == 'completed':
                        fields.update(duration_seconds=number, bytes_written={'type': 'integer', 'minimum': 0, 'maximum': 1440000}, physical_result={'const': 'unverified'})
                    elif state == 'closed':
                        fields['reason'] = {'type': 'string', 'enum': ['tts_cancelled', 'tts_engine_unavailable', 'tts_generation_failed', 'tts_audio_format', 'tts_audio_too_long', 'tts_playback_failed', 'audio_connection_lost', 'audio_failed', 'audio_busy']}
                    elif state != 'generating':
                        raise Refusal('invalid_fields')
                    Schema(closed(fields))(value)
                    emit(child.request, dict(value))
                    scoped.check()
                try:
                    handle = await connect(thaw(child.parameters), opaque, scoped, event)
                    if type(handle) is TtsStarted and isinstance(handle.task, asyncio.Task) and callable(handle.cancel):
                        item['handle'] = handle
                    scoped.check()
                    if item['handle'] is None or handle.acknowledged is not True:
                        raise Refusal('binding_denied')
                    await asyncio.shield(handle.task)
                    scoped.check()
                    return None
                finally:
                    handle = item['handle']
                    if handle is not None:
                        if not item['cancelled']:
                            item['cancelled'] = True
                            try: handle.cancel()
                            except Exception:
                                # A broken captured stopper never skips joining
                                # or leaves the source task running unobserved.
                                if not handle.task.done(): handle.task.cancel()
                        joining = asyncio.gather(handle.task, return_exceptions=True)
                        cancelled = False
                        while not joining.done():
                            try: await asyncio.shield(joining)
                            except asyncio.CancelledError: cancelled = True
                    if self._active.get(key) is item:
                        self._active.pop(key)
                    if handle is not None and cancelled: raise asyncio.CancelledError
            return await effect(run)
        task = jobs.start(parent.request.get('operation_id'), parent, worker)
        try:
            return await asyncio.shield(task)
        finally:
            if not task.done(): task.cancel()
            joining = asyncio.gather(task, return_exceptions=True)
            cancelled = False
            while not joining.done():
                try: await asyncio.shield(joining)
                except asyncio.CancelledError: cancelled = True
            if cancelled: raise asyncio.CancelledError

    def owns_current(self): return self.jobs.owns_current()

    async def close(self):
        self.closed = True
        self.references.close()
        await self.jobs.close()
