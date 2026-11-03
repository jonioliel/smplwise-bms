"""Selected scheduling metadata from injected current source state, read-only.

No report, identity fingerprint, journal, people or resource body is inspected.
These bounded projections intentionally omit unclosed result branches. Existing
program writes/windows/emergency and all scheduling workers remain untouched.
"""
from .validation import Refusal

class ScheduleMetadata:
    def __init__(self,*,current_plans=None,current_operations=None):
        if current_plans is not None and not callable(current_plans):raise ValueError('explicit plans state reader required')
        if current_operations is not None and not callable(current_operations):raise ValueError('explicit operations state reader required')
        self.current_plans,self.current_operations=current_plans,current_operations

    def _read(self,context,attribute,collections):
        provider=getattr(self,attribute)
        if provider is None:raise Refusal('unknown_action')
        context.check();state=provider();context.check()
        if getattr(self,attribute)is not provider or type(state)is not dict:raise Refusal('binding_denied')
        result={};bindings=[]
        for name,(limit,fields) in collections.items():
            values=state[name]
            if type(values)is not dict or len(values)>limit:raise Refusal('invalid_fields')
            result[name]=[]
            for key,item in values.items():
                context.check()
                if type(item)is not dict or item['id']!=key:raise Refusal('invalid_fields')
                result[name].append({field:item[field] for field in fields})
                bindings.append((values,key,item,item['revision']))
        context.check()
        if getattr(self,attribute)is not provider or provider()is not state:raise Refusal('binding_denied')
        for values,key,item,revision in bindings:
            if values.get(key)is not item or type(item['revision'])is not type(revision) or item['revision']!=revision:raise Refusal('binding_denied')
        return result

    async def plans(self,params,context):
        result=self._read(context,'current_plans',{'plans':(32,('id','revision','draft_id','draft_revision'))})
        # Existing public() sets can_apply false; a read is not write admission.
        return [{**row,'can_apply':False} for row in result['plans']]

    async def operations(self,params,context):
        result=self._read(context,'current_operations',{
            'claims':(100,('id','revision','plan_id')),
            'jobs':(100,('id','revision','plan_id','plan_revision','status','ownership'))})
        return {**result,'writes_enabled':False}
