"""Explicit TEST event-service seam. No registration, discovery or capture ACK.

The supplied DRAFT closes event replies. Capture person/state/error shapes are
not closed, so this seam never calls a collector for a lease_request. It raises
an internal refusal; no invented response code or result body is sent to Arx.
"""
from .lease_experimental import ExperimentalLeaseHost,LeaseRejected

class ExperimentalLeaseServices:
    def __init__(self,host):
        if type(host) is not ExperimentalLeaseHost:raise ValueError('explicit experimental host required')
        self.host=host;self._identity=host
    def event(self,payload):
        if self.host is not self._identity or type(payload) is not dict or set(payload)!={'signed_message_json'}:
            raise LeaseRejected('binding','service_payload')
        host=self.host;verifier=host.verifier
        message=verifier.verify('smplwise_bridge.lease_event',payload['signed_message_json'])
        if self.host is not host or host.verifier is not verifier:raise LeaseRejected('binding','receiver_changed')
        return host.event(message)
    def request(self,payload):
        # Deliberately do not consume/dispatch a signed capture request before
        # the missing response contract can be represented without guessing.
        raise LeaseRejected('binding','response_contract_incomplete')


class ClosedLeaseServices:
    """Replacement OFF-only wire adapter. Legacy ExperimentalLeaseServices is
    retained solely to keep its historical assertions reproducible. No runtime
    factory or HA service registration exposes either adapter.
    """
    def __init__(self,host):
        if type(host) is not ExperimentalLeaseHost:raise ValueError('explicit experimental host required')
        from .lease_answers import LeaseAnswers
        self.host=host;self._identity=host
        definition={**host.verifier.definition,'$defs':{k.removeprefix('#/$defs/'):v for k,v in host.verifier.resources.items()}}
        self.answers=LeaseAnswers(definition)
        from .lease_answers import _validator
        self.request_validator=_validator(definition)
        self._answers_identity=self.answers;self._request_validator_identity=self.request_validator
        host.wire_owner=self

    @staticmethod
    def _decode(payload):
        import json
        if type(payload) is not dict or set(payload)!={'signed_message_json'}:
            raise LeaseRejected('transport','transport_shape')
        encoded=payload['signed_message_json']
        if type(encoded) is bytes:
            try:encoded=encoded.decode('utf8','strict')
            except UnicodeError:raise LeaseRejected('encoding','invalid_utf8') from None
        if type(encoded) is not str:raise LeaseRejected('transport','transport_shape')
        try:raw=encoded.encode('utf8','strict')
        except UnicodeError:raise LeaseRejected('encoding','lone_surrogate') from None
        if len(raw)>8192:raise LeaseRejected('encoding','message_too_large')
        if encoded.startswith('\ufeff'):raise LeaseRejected('encoding','invalid_utf8')
        def pairs(items):
            out={}
            for key,value in items:
                if key in out:raise LeaseRejected('parse','duplicate_key')
                out[key]=value
            return out
        def reject_float(_):raise LeaseRejected('parse','non_integer_number')
        def reject_constant(_):raise LeaseRejected('parse','non_json_constant')
        def integer(text):
            try:value=int(text)
            except ValueError:raise LeaseRejected('parse','integer_out_of_range') from None
            if abs(value)>2**53-1:raise LeaseRejected('parse','integer_out_of_range')
            return value
        try:body=json.loads(encoded,object_pairs_hook=pairs,parse_float=reject_float,parse_constant=reject_constant,parse_int=integer)
        except (ValueError,RecursionError):raise LeaseRejected('parse','invalid_json') from None
        if type(body) is not dict:raise LeaseRejected('parse','not_an_object')
        def walk(value):
            if type(value) is str:
                try:value.encode('utf8','strict')
                except UnicodeError:raise LeaseRejected('parse','lone_surrogate') from None
            elif type(value) is dict:
                for key,item in value.items():walk(key);walk(item)
            elif type(value) is list:
                for item in value:walk(item)
        try:walk(body)
        except RecursionError:raise LeaseRejected('parse','invalid_json') from None
        return encoded

    def _verify(self,payload,service):
        encoded=self._decode(payload)
        import json
        body=json.loads(encoded)
        error=next(self._request_validator_identity.iter_errors(body),None)
        if error is not None:
            code={'type':'wrong_type','required':'missing_field','additionalProperties':'unknown_field','pattern':'bad_format','format':'bad_format'}.get(error.validator,'bad_value')
            raise LeaseRejected('schema',code)
        host=self._identity
        if type(host) is not ExperimentalLeaseHost or self.host is not host or self.answers is not self._answers_identity or self.request_validator is not self._request_validator_identity:
            error=LeaseRejected('state','storage_unavailable');error.request_id=body['request_id'];raise error
        verifier=host.verifier
        try:message=verifier.verify(service,encoded)
        except LeaseRejected:raise
        except Exception:
            error=LeaseRejected('state','storage_unavailable');error.request_id=body['request_id'];raise error from None
        if self.host is not host or host.verifier is not verifier:
            host._destroy()
            error=LeaseRejected('state','storage_unavailable');error.request_id=message.body['request_id'];raise error
        return host,message

    @staticmethod
    def _rejected(error,rid=None):
        from .lease_answers import PINS
        stage,code=error.stage,error.code
        if stage not in {'transport','encoding','parse','schema','binding','signature','time','state'}:
            stage,code='state','storage_unavailable'
        if code in {'capacity','replay_unavailable','stream_reused','stream_reused_or_unavailable'}:code='storage_unavailable'
        if code=='expired_or_future':code=getattr(error,'wire_code','expired')
        if code not in {'transport_shape','invalid_utf8','lone_surrogate','message_too_large','invalid_json','duplicate_key','non_json_constant','non_integer_number','integer_out_of_range','not_an_object','unknown_field','missing_field','wrong_type','bad_format','bad_value','ts_mismatch','action_service_mismatch','station_scope_mismatch','lease_window','bad_signature','clock_invalid','lifetime_invalid','not_yet_valid','expired','replay','storage_unavailable'}:
            stage,code='state','storage_unavailable'
        answer={'result':'rejected','stage':stage,'code':code}
        if stage in {'binding','signature','time','state'}:
            identity=rid or error.request_id
            if identity is None:raise LeaseRejected('state','storage_unavailable')
            answer['request_id']=identity
        return answer

    def event(self,payload):
        message=None
        try:
            host,message=self._verify(payload,'smplwise_bridge.lease_event')
            answer=host.event(message)
        except LeaseRejected as error:
            answer=self._rejected(error,None if message is None else message.body['request_id'])
        except Exception:
            if message is None:raise LeaseRejected('state','storage_unavailable') from None
            self.host._destroy()
            answer={'result':'rejected','stage':'state','code':'storage_unavailable','request_id':message.body['request_id']}
        return self.answers.validate('lease_event',answer)

    async def request(self,payload):
        message=None;action=None;host=self.host
        try:
            host,message=self._verify(payload,'smplwise_bridge.lease_request')
            body=message.body;action=body['action'];rid=body['request_id']
            if action=='capture_start':
                sid=await host.start(message)
                answer={'result':'acknowledged','request_id':rid,'session':{'session_id':sid,'state':'preparing'}}
            else:
                value=await host.step(message)
                if action=='capture_cancel' or body['params']['session_id']=='*':
                    # Wildcard status ends authority only; no fabricated capture.
                    if action=='capture_status':answer={'result':'refused','request_id':rid,'code':'capture_not_found'}
                    else:answer={'result':'acknowledged','request_id':rid,'cancelled':True}
                elif action=='capture_status':answer={'result':'acknowledged','request_id':rid,'capture':value}
                elif type(value) is str and value=='sent_unknown':answer={'result':'sent_unknown','request_id':rid}
                else:answer={'result':'acknowledged','request_id':rid,'person':value}
            try:return self.answers.validate(action,answer)
            except LeaseRejected:
                # Malformed post-effect result is not safe evidence of success.
                if action=='capture_confirm':return self.answers.validate(action,{'result':'sent_unknown','request_id':rid})
                host._destroy(lambda s:s.authority.lease_ref==body['params'].get('lease_ref',body['params'].get('lease',{}).get('lease_ref')))
                await host.cleanup()
                return self.answers.validate(action,{'result':'refused','request_id':rid,'code':'capture_failed' if action=='capture_start' else 'lease_gone'})
        except LeaseRejected as error:
            rid=None if message is None else message.body['request_id']
            if action is None:
                # The common rejected variants are identical across request schemas.
                return self.answers.validate('capture_start',self._rejected(error,rid))
            codes={'unverified':'binding_denied','operation_missing':'binding_denied','operation_finished':'binding_denied','admission_mismatch':'binding_denied','actor_mismatch':'binding_denied','session_mismatch':'binding_denied','wildcard_confirm':'binding_denied','stream_or_revision_changed':'lease_gone','authority_changed':'lease_gone','receiver_changed':'lease_gone','lease_gone':'lease_gone'}
            code=codes.get(error.code,error.code)
            import json
            from pathlib import Path
            table=self.answers.codes
            if code in table['refused'][action]:
                if code not in table['refused_liveness']['session_unchanged'] or action=='capture_start':
                    p=message.body['params'];ref=p.get('lease_ref',p.get('lease',{}).get('lease_ref'))
                    host._destroy(lambda s:s.authority.lease_ref==ref);await host.cleanup()
                answer={'result':'refused','request_id':rid,'code':code}
            else:answer=self._rejected(error,rid)
            return self.answers.validate(action,answer)

        except Exception:
            if message is None:raise LeaseRejected('state','storage_unavailable') from None
            p=message.body['params'];ref=p.get('lease_ref',p.get('lease',{}).get('lease_ref'))
            possible=action=='capture_confirm' and any(s.possible_dispatch for s in host.sessions.values() if s.authority.lease_ref==ref)
            host._destroy(lambda s:s.authority.lease_ref==ref);await host.cleanup()
            if possible:answer={'result':'sent_unknown','request_id':message.body['request_id']}
            else:answer={'result':'refused','request_id':message.body['request_id'],'code':'capture_failed' if action=='capture_start' else 'lease_gone'}
            return self.answers.validate(action,answer)
