"""Explicit source subscription ACK and data-free invalidation ownership.

No websocket/HA registration, session discovery or organizational permission
calculation. An injected source connector owns its own callback timer and
returns an exact ACK/cleanup handle. A callback is a hint, never a grant/result.
"""
from dataclasses import dataclass
import inspect
from uuid import uuid4

from .validation import Refusal
from .source_bindings import same_identities


@dataclass(frozen=True,repr=False)
class SourceAttached:
    acknowledged:bool
    disconnect:object


@dataclass(repr=False)
class _Subscription:
    reference:str
    context:object
    owners:tuple
    disconnect:object=None
    active:bool=True


class SourceSubscriptions:
    def __init__(self,attach_source,emit,*,limit=128):
        if not callable(attach_source) or not callable(emit) or type(limit)is not int or not 1<=limit<=128:raise ValueError('explicit source connector, data-free sink and bound required')
        self.attach_source,self.emit,self.limit=attach_source,emit,limit
        self.closed=False;self._items={};self.cleanup_failures=0
        self._creation=(attach_source,emit,limit,self._items,{},object())

    def _check_owner(self):
        attach,emit,limit,items,_,_=self._creation
        if (type(self.closed)is not bool or self.closed or self.attach_source is not attach
            or self.emit is not emit or type(self.limit)is not int or self.limit!=limit
            or self._items is not items):raise Refusal('binding_denied')

    def _owner(self,item):
        owner=self._creation[4].get(id(item))
        if (type(item)is not _Subscription or type(owner)is not list or len(owner)!=6
            or owner[0] is not item or owner[5] is not self._creation[5]):return None
        return owner

    def _allowed(self,item):
        try:
            self._check_owner();owner=self._owner(item)
            if owner is None:return False
            owner[2].check();self._check_owner()
            return (self._owner(item)is owner and type(item.active)is bool and item.active and self._creation[3].get(owner[1])is item
                and item.reference is owner[1] and item.context is owner[2] and item.owners is owner[3]
                and item.disconnect is owner[4] and same_identities(owner[3],self._creation[:3]))
        except Exception:return False

    def _drop(self,item,owner=None):
        owner=self._owner(item) if owner is None else owner
        if type(owner)is not list or len(owner)!=6 or owner[0] is not item or owner[5] is not self._creation[5]:return
        item.active=False
        items,owners=self._creation[3:5]
        if items.get(owner[1])is item:items.pop(owner[1])
        if owners.get(id(item))is owner:owners.pop(id(item))
        disconnect,owner[4]=owner[4],None
        item.disconnect=None
        if disconnect is not None:
            try:
                result=disconnect()
                if inspect.isawaitable(result):
                    if inspect.iscoroutine(result):result.close()
                    self.cleanup_failures=min(128,self.cleanup_failures+1)
            except Exception:self.cleanup_failures=min(128,self.cleanup_failures+1)

    async def attach(self,context):
        self._check_owner();context.check();self._check_owner()
        attach,emit,limit,items,owners,issuer=self._creation
        for old in tuple(owners.values()):
            if not self._allowed(old[0]):self._drop(old[0],old)
        self._check_owner();context.check();self._check_owner()
        if len(items)>=limit:raise Refusal('binding_denied')
        item=_Subscription('subscription-'+uuid4().hex,context,(attach,emit,limit))
        owner=[item,item.reference,context,item.owners,None,issuer]
        owners[id(item)]=owner;items[item.reference]=item
        def refresh(*_args,**_kwargs):
            # Source callback data is deliberately not read, copied or formatted.
            if not self._allowed(item):self._drop(item,owner);return
            try:emit(owner[1],{'kind':'refresh'})
            except Exception:self._drop(item,owner);return
            if not self._allowed(item):self._drop(item,owner)
        try:
            attached=attach(context,refresh)
            if inspect.iscoroutine(attached):attached.close()
            if type(attached)is SourceAttached and callable(attached.disconnect) and not inspect.iscoroutinefunction(attached.disconnect):
                item.disconnect=owner[4]=attached.disconnect
            if type(attached)is not SourceAttached or attached.acknowledged is not True or not callable(attached.disconnect) or inspect.iscoroutinefunction(attached.disconnect):raise Refusal('binding_denied')
            context.check()
            if not self._allowed(item):raise Refusal('binding_denied')
            return None  # Exact source connection.send_result(id) has no body.
        except BaseException:
            self._drop(item,owner);raise

    def close(self):
        self.closed=True
        for owner in tuple(self._creation[4].values()):self._drop(owner[0],owner)
        self._creation[3].clear()

    async def aclose(self):self.close()


class CoalescedConnector:
    """Source-equivalent data-free connector for the explicit Arx host seam.

    connect(context, callback) and schedule(.25, callback) are injected. No HA
    permissions, security session, registration or client discovery is used.
    Source ACK has no body; all callback authority is the current bound Arx
    context. Generation markers own timers only, never authorization.
    """
    def __init__(self,connect,schedule,*,limit=128):
        if not callable(connect) or not callable(schedule) or type(limit)is not int or not 1<=limit<=128:raise ValueError('explicit source connector and scheduler required')
        self.connect,self.schedule,self.limit=connect,schedule,limit
        self.closed=False;self._items={}
        self._creation=(connect,schedule,limit,self._items,{})

    def _check_owner(self):
        connect,schedule,limit,items,_=self._creation
        if (type(self.closed)is not bool or self.closed or self.connect is not connect
            or self.schedule is not schedule or type(self.limit)is not int or self.limit!=limit
            or self._items is not items):raise Refusal('binding_denied')

    def __call__(self,context,refresh):
        self._check_owner();context.check();self._check_owner()
        connect,schedule,limit,items,owners=self._creation
        if not callable(refresh) or len(items)>=limit:raise Refusal('binding_denied')
        item={'active':True,'disconnect':None,'timer':None,'generation':None,'sending':False}
        owned=dict(item);key=object();items[key]=item
        def cleanup():
            owned['active']=item['active']=False;owned['generation']=item['generation']=None
            if items.get(key)is item:items.pop(key,None)
            if owners.get(key)is owned:owners.pop(key,None)
            timer,owned['timer']=owned['timer'],None;item['timer']=None
            disconnect,owned['disconnect']=owned['disconnect'],None;item['disconnect']=None
            if timer is not None:
                try:timer.cancel()
                except Exception:pass
            if disconnect is not None:
                try:disconnect()
                except Exception:pass
        owned['cleanup']=item['cleanup']=cleanup;owners[key]=owned
        def current():
            context.check();self._check_owner()
            if (not owned['active'] or items.get(key)is not item or owners.get(key)is not owned
                or type(item.get('active'))is not bool or item['active']is not owned['active']
                or type(item.get('sending'))is not bool or item['sending']is not owned['sending']
                or any(item.get(name)is not owned[name] for name in ('disconnect','timer','generation','cleanup'))):raise Refusal('binding_denied')
        def send(generation):
            if owned['generation']is not generation:return
            try:
                current()
                owned['generation']=item['generation']=None;owned['timer']=item['timer']=None
                owned['sending']=item['sending']=True
                refresh();current()
            except Exception:cleanup()
            finally:owned['sending']=item['sending']=False
        def changed(*_args,**_kwargs):
            try:
                current()
                # A refresh sink may synchronously trigger its producer. The
                # same data-free hint already invalidates that state; do not
                # recurse through a synchronous scheduler or create a loop.
                if owned['generation']is not None or owned['sending']:return
                generation=object();owned['generation']=item['generation']=generation
                timer=schedule(.25,lambda:send(generation))
                if not callable(getattr(timer,'cancel',None)):raise Refusal('binding_denied')
                # A synchronous scheduler/cancellation cannot orphan its handle.
                if owned['active'] and owned['generation']is generation:owned['timer']=item['timer']=timer
                else:timer.cancel()
                current()
            except Exception:cleanup()
        try:
            disconnect=connect(context,changed)
            if not callable(disconnect) or inspect.iscoroutinefunction(disconnect):raise Refusal('binding_denied')
            owned['disconnect']=item['disconnect']=disconnect
            current();return SourceAttached(True,cleanup)
        except BaseException:cleanup();raise

    def close(self):
        self.closed=True
        for owned in tuple(self._creation[4].values()):owned['cleanup']()
        self._creation[3].clear()
