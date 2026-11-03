"""Read only source job-ownership metadata before the injected jobs algorithm.

No repository.snapshot/private/user serializer or credential value is read.
The result is internal derivation data, never an Arx row-permission decision or
public result. The source SyncEngine.jobs algorithm is injected explicitly.
"""
from .envelope import freeze
from .validation import Refusal,reference,Schema


class JobMetadata:
    def __init__(self,current_state,query_jobs,*,limit=10000,reference_limit=65536):
        if not callable(current_state) or not callable(query_jobs) or type(limit)is not int or not 1<=limit<=10000:raise ValueError('explicit bounded source metadata and query required')
        if type(reference_limit)is not int or not 1<=reference_limit<=65536:raise ValueError('bounded metadata references required')
        self.current_state,self.query_jobs,self.limit,self.reference_limit=current_state,query_jobs,limit,reference_limit

    def _projection(self,state):
        if type(state)is not dict:raise Refusal('binding_denied')
        out={}
        used=0
        def charge(count):
            nonlocal used
            used+=count
            if used>self.reference_limit:raise Refusal('binding_denied')
        uuid=Schema({'type':'string','format':'uuid'})
        def mapping(name):
            value=state[name]
            if type(value)is not dict or len(value)>self.limit:raise Refusal('binding_denied')
            charge(len(value))
            return value
        def targets(value):
            if type(value)is not list or len(value)>100 or any(type(v)is not str for v in value) or len(set(value))!=len(value):raise Refusal('binding_denied')
            charge(len(value))
            return [reference(v) for v in value]
        out['users']={}
        for uid,raw in mapping('users').items():
            uuid(uid)
            if type(raw)is not dict:raise Refusal('binding_denied')
            assignments=raw['assignments']
            if type(assignments)is not dict or len(assignments)>100:raise Refusal('binding_denied')
            charge(len(assignments))
            out['users'][uid]={'assignments':{reference(station):None for station in assignments}}
        out['bindings']={}
        for station,rows in mapping('bindings').items():
            reference(station)
            if type(rows)is not dict or len(rows)>self.limit:raise Refusal('binding_denied')
            charge(len(rows))
            for uid in rows:uuid(uid)
            out['bindings'][station]={uid:None for uid in rows}
        for collection in ('tombstones','retired_cards','retired_pins'):
            out[collection]={}
            for key,raw in mapping(collection).items():
                reference(key)
                if type(raw)is not dict:raise Refusal('binding_denied')
                target,confirmed=targets(raw['targets']),targets(raw['confirmed'])
                if not set(confirmed)<=set(target):raise Refusal('binding_denied')
                row={'targets':target,'confirmed':confirmed}
                if collection!='tombstones':uuid(raw['user_id']);row['user_id']=raw['user_id']
                else:uuid(key)
                out[collection][key]=row
        return out

    def jobs(self,station):
        reference(station);provider,query,limit,budget=self.current_state,self.query_jobs,self.limit,self.reference_limit
        raw=provider();projected=self._projection(raw);snapshot=freeze(projected)
        result=query(projected,station)
        if self.current_state is not provider or self.query_jobs is not query or self.limit is not limit or self.reference_limit is not budget or provider()is not raw or self._projection(raw)!=projected or freeze(projected)!=snapshot:raise Refusal('binding_denied')
        if type(result)is not list or len(result)>limit or any(type(uid)is not str for uid in result) or len(set(result))!=len(result):raise Refusal('binding_denied')
        allowed={uid for uid,row in projected['users'].items() if station in row['assignments']}|set(projected['bindings'].get(station,{}))|{uid for uid,row in projected['tombstones'].items() if station in row['targets'] and station not in row['confirmed']}|{r['user_id'] for c in ('retired_cards','retired_pins') for r in projected[c].values() if station in r['targets'] and station not in r['confirmed']}
        if any(uid not in allowed for uid in result):raise Refusal('binding_denied')
        return result

    def revision(self,station,user_id):
        """Current user revision only; tombstone/cleanup is a separate frontier."""
        reference(station);Schema({'type':'string','format':'uuid'})(user_id)
        provider=self.current_state;state=provider()
        if type(state)is not dict or type(state.get('users'))is not dict:raise Refusal('binding_denied')
        users=state['users'];raw=users.get(user_id)
        if raw is None:return None
        if type(raw)is not dict:raise Refusal('binding_denied')
        revision=raw.get('revision')
        if type(revision)is not int or revision<1:raise Refusal('binding_denied')
        if self.current_state is not provider or provider()is not state or state['users']is not users or users.get(user_id)is not raw or type(raw.get('revision'))is not int or raw['revision']!=revision:raise Refusal('binding_denied')
        return revision
