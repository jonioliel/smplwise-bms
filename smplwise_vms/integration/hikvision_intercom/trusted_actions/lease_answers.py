"""Closed OFF-only answer validation. Full Draft2020-12; no remote resolver."""
import hashlib
import json
from pathlib import Path
from .lease_experimental import LeaseRejected

PINS={
 'capture_start':'23378fe3cd65ce1e2509ed4a8582840640e48df42e8205a569f25ad97c82ac86',
 'capture_status':'add66c749402c03834b92cacb6f55b429a770445725942903e7d3c33ee8218d8',
 'capture_confirm':'09d38691c816cef0fd77daeaf6e49b49b2770e4f964e5cf444d395d88d8ce99b',
 'capture_cancel':'d563830801861d3b958f7d53135ef959227d65dee98cbb39b2da95afa3d115f8'}

_PREPARED={}

def _validator(schema):
    key=hashlib.sha256(json.dumps(schema,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    if key in _PREPARED:return _PREPARED[key]
    from jsonschema import Draft202012Validator
    from referencing import Registry
    from referencing.exceptions import NoSuchResource
    def deny(uri):raise NoSuchResource(ref=uri)
    Draft202012Validator.check_schema(schema)
    def formats(value):
        if isinstance(value,dict):
            if 'format' in value and value['format'] not in Draft202012Validator.FORMAT_CHECKER.checkers:
                raise ValueError('format validation dependency unavailable')
            for child in value.values():formats(child)
        elif isinstance(value,list):
            for child in value:formats(child)
    formats(schema)
    validator=Draft202012Validator(json.loads(json.dumps(schema)),registry=Registry(retrieve=deny),format_checker=Draft202012Validator.FORMAT_CHECKER)
    if len(_PREPARED)>=16:_PREPARED.clear()
    _PREPARED[key]=validator
    return validator

class LeaseAnswers:
    def __init__(self,event_schema):
        root=Path(__file__).parent/'resources/capture_answers'
        from .envelope import freeze
        raw=(root/'CAPTURE_ANSWER_CODES.json').read_bytes()
        if hashlib.sha256(raw).hexdigest()!='624383caed968e84b62caf11570f39dfed213419b93d23786c161aae34f7e342':raise ValueError('answer code map binding changed')
        self.codes=freeze(json.loads(raw))
        self.schemas={}
        self.validators={}
        for action,digest in PINS.items():
            raw=(root/(action+'.answer.schema.json')).read_bytes()
            if hashlib.sha256(raw).hexdigest()!=digest:raise ValueError('answer schema binding changed')
            schema=json.loads(raw);self.schemas[action]=schema;self.validators[action]=_validator(schema)
        self.validators['lease_event']=_validator({'$defs':event_schema['$defs'],'$ref':'#/$defs/answer_event'})
    def validate(self,action,answer):
        # Never use error.message/instance/context/traceback as diagnostics.
        # No custom mapping/sequence hooks and no retained mutable source
        # dictionary reaches the caller. This does not log or hash any field.
        def detached(value,depth=0):
            if depth>64:raise LeaseRejected('state','storage_unavailable')
            if type(value) is dict:
                if any(type(key) is not str for key in value):raise LeaseRejected('state','storage_unavailable')
                return {key:detached(item,depth+1) for key,item in value.items()}
            if type(value) is list:return [detached(item,depth+1) for item in value]
            if value is None or type(value) in (str,int,bool):return value
            if type(value) is float:
                import math
                if math.isfinite(value):return value
            raise LeaseRejected('state','storage_unavailable')
        result=detached(answer)
        if next(self.validators[action].iter_errors(result),None) is not None:
            raise LeaseRejected('state','storage_unavailable')
        if result.get('result')=='acknowledged' and action=='capture_confirm':
            person=result['person']
            if type(person['revision']) is not int:raise LeaseRejected('state','storage_unavailable')
            for item in person['assignments'].values():
                if type(item['desired_revision']) is not int or item['applied_revision'] is not None and type(item['applied_revision']) is not int:
                    raise LeaseRejected('state','storage_unavailable')
        if result.get('result')=='acknowledged' and action=='capture_status' and result['capture']['card'] is not None:
            reader=result['capture']['card']['reader_id']
            if reader is not None and type(reader) is not int:raise LeaseRejected('state','storage_unavailable')
        return result
