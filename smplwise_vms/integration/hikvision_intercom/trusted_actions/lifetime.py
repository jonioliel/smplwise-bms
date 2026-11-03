"""Await/cancel helpers used by local engine adapters, with no hardware assumptions."""
from __future__ import annotations

import asyncio


def raise_if_cancelling():
    """Do not start new delegated work while task cancellation is pending."""
    task=asyncio.current_task()
    if task is not None and task.cancelling():raise asyncio.CancelledError()


async def join_cleanup(cleanup):
    """Join already-owned cleanup without an authorization/clock prerequisite."""
    cleaning=asyncio.ensure_future(cleanup());cancelled=False
    while not cleaning.done():
        try:await asyncio.shield(cleaning)
        except asyncio.CancelledError:cancelled=True
    result=cleaning.result()
    if cancelled:raise asyncio.CancelledError()
    return result


async def shielded_commit(save, publish):
    """Complete a started save, then publish, then propagate recorded cancellation.

    Successful coroutine completion is not an fsync or device-applied guarantee.
    """
    saving=asyncio.ensure_future(save())
    cancelled=False
    while not saving.done():
        try:
            await asyncio.shield(saving)
        except asyncio.CancelledError:
            cancelled=True
    result=saving.result()
    publish()
    if cancelled:
        raise asyncio.CancelledError()
    return result


class CaptureTasks:
    """Identity-safe collector lifecycle; cancellation is not transport rollback."""
    def __init__(self):
        self._sessions={}
        self.closed=False

    def start(self, key, collector, admit=None, *, timeout=120):
        # This is a technical adapter precondition, never organizational RBAC.
        if self.closed or admit is None or admit() is not True or len(self._sessions)>=128 or key in self._sessions or type(timeout) is not int or not 1<=timeout<=120:
            raise ValueError("capture precondition refused")
        session={"task":None,"card":None,"timer":None,"failed":False}
        self._sessions[key]=session
        async def run():
            try:
                card=await collector()
                if self._sessions.get(key) is session and admit() is True:
                    session['card']=card
            except asyncio.CancelledError:
                raise
            except Exception:
                # Never let a raw collector exception escape to asyncio's logger.
                session['failed']=True
            finally:
                session['task']=None
        session['task']=asyncio.create_task(run())
        session['timer']=asyncio.get_running_loop().call_later(timeout,lambda:asyncio.create_task(self.cancel(key,expected=session)))
        return session

    async def cancel(self,key,*,expected=None):
        session=self._sessions.get(key)
        if expected is not None and session is not expected:return
        session=self._sessions.pop(key,None)
        if session is None:return
        session['card']=None
        session['timer'].cancel()
        task=session['task']
        if task is not None and task is not asyncio.current_task():
            task.cancel()
            joining=asyncio.gather(task,return_exceptions=True)
            cancelled=False
            while not joining.done():
                try:await asyncio.shield(joining)
                except asyncio.CancelledError:cancelled=True
            if cancelled:raise asyncio.CancelledError()

    def consume(self,key,expected,admit):
        """An opaque captured object belongs to exactly this live session."""
        if self._sessions.get(key) is not expected or admit is None or admit() is not True:
            if self._sessions.get(key) is expected:expected['card']=None
            raise ValueError('capture precondition refused')
        result=expected['card']
        expected['card']=None
        if result is None:raise ValueError('capture not ready')
        return result

    async def close(self):
        self.closed=True
        cleaning=asyncio.gather(*(self.cancel(key) for key in tuple(self._sessions)),return_exceptions=True)
        cancelled=False
        while not cleaning.done():
            try:await asyncio.shield(cleaning)
            except asyncio.CancelledError:cancelled=True
        if cancelled:raise asyncio.CancelledError
