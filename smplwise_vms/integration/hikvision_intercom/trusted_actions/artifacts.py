"""One-use safe response projections, bound before the internal bridge handoff."""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from .envelope import freeze, thaw
from .validation import Refusal, aware


class Artifacts:
    def __init__(self,*,limit=128):
        if type(limit)is not int or not 1<=limit<=4096:raise ValueError('bounded artifact limit required')
        self._items={};self.limit=limit

    def issue(self,request,epoch,projection,now:datetime):
        expiry=aware(request.get('request_expires_at'))
        if now>=expiry:raise Refusal('binding_denied')
        for key,record in tuple(self._items.items()):
            if now>=record[2]:del self._items[key]
        if len(self._items)>=self.limit:raise Refusal('binding_denied')
        handle='response-'+uuid4().hex
        self._items[handle]=(request.descriptor,epoch,expiry,freeze(thaw(projection)))
        return handle

    def resolve(self,handle,request,epoch,now:datetime):
        # A failed binding consumes the artifact too; no body cache/replay API.
        record=self._items.pop(handle,None)
        if record is None or record[0]!=request.descriptor or record[1]!=epoch or now>=record[2]:raise Refusal('binding_denied')
        return record[3]

    def clear(self):self._items.clear()

    def discard(self,handle):self._items.pop(handle,None)
