"""Actual admission trace emitter, bound to the authenticated in-process permit.

The existing bridge authenticates transport. This registry does not sign proofs
or claim independent cryptographic verification outside that trust boundary.
"""
from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from .envelope import Request, thaw
from .validation import aware, Refusal, Schema, resources


@dataclass(repr=False)
class Trace:
    request: Request
    authority: object
    possible: bool = False
    prior_possible: bool = False
    epoch: str | None = None


class ProofEmitter:
    def __init__(self,*,limit=128):
        if type(limit)is not int or not 1<=limit<=4096:raise ValueError('bounded proof limit required')
        self.limit=limit
        self._authority = None
        self._proofs = {}

    def bind(self, authority: object):
        if self._authority is not None:
            raise ValueError("proof authority already bound")
        self._authority=authority

    def refusal(self, trace: Trace, error_code: str) -> dict | None:
        if self._authority is None or trace.authority is not self._authority or trace.possible or trace.prior_possible:
            return None
        if len(self._proofs)>=self.limit:return None  # Missing proof never implies no effect.
        proof_id="proof-"+uuid4().hex
        result={"source_proof_id":proof_id,"origin":"handler","stage":"pre_dispatch",
                "dispatch_certainty":"not_dispatched","outcome":"refused_known"}
        self._proofs[proof_id]=(trace.request.get('request_id'),trace.request.get('operation_id'),trace.request.descriptor,result.copy(),error_code,trace.epoch)
        return result

    def verify(self, metadata, request: Request) -> bool:
        from .validation import resource
        try:Schema.from_resource('ACTION_RESULT.draft3.schema.json')(thaw(metadata))
        except (Refusal,TypeError,AttributeError):return False
        record=self._proofs.get(metadata.get('source_proof_id'))
        if record is None or record[:2] != (request.get('request_id'),request.get('operation_id')) or record[2]!=request.descriptor:
            return False
        return all(metadata.get(k)==v for k,v in record[3].items()) and metadata.get('request_id')==record[0] and metadata.get('operation_id')==record[1] and metadata.get('error',{}).get('code')==record[4]

    def describe(self,proof_id):
        """Public locator of the reached producer boundary, never an old source guard claim."""
        record=self._proofs.get(proof_id)
        if record is None:return None
        return {'registry':'trusted_actions.producer','version':'trusted-core.1','origin':'Producer._execute admission refusal',
                'stage':'pre_dispatch','request_id':record[0],'operation_id':record[1],'error_code':record[4]}

    def clear(self):
        self._proofs.clear()

    def verify_once(self, metadata, request, *, epoch, now):
        """Consume only inside the existing authenticated bridge trust context."""
        proof_id=metadata.get('source_proof_id')
        record=self._proofs.get(proof_id)
        try:request.check_time(now);fresh=True
        except (Refusal,TypeError,AttributeError):fresh=False
        valid=(fresh and record is not None and record[5]==epoch and now<aware(request.get('request_expires_at'))
               and self.verify(metadata,request))
        self._proofs.pop(proof_id,None)
        return valid
