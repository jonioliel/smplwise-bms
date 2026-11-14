"""Audit metadata-only source projection; never copies before/after or actors.

The trusted host resolves the current Arx-authorized audit store for this bound
request. Source query receives only approved metadata, not private audit rows.
Person/station/actor selectors and names are outside this bounded profile.
"""
from .envelope import freeze,thaw
from .validation import Refusal

AUDIT_ACTIONS=frozenset({'profiles/settings_update','platform/lifecycle_apply','users/create','users/update','users/delete',
    'users/set_active','users/temporary_cancel','users/archive','users/unarchive','visits/create','visits/decide','cards/add','cards/remove',
    'users/csv_apply','users/adopt','users/delete_unmanaged','users/ignore','cards/capture_confirm','conflicts/resolve',
    'conflicts/resolve_deletion','bulk/renew','workflows/renew_decide','bulk/enable','bulk/disable','bulk/assign','bulk/unassign',
    'bulk/delete','bulk/remove_pin','bulk/remove_cards','bulk/sync','bulk/profile','bulk/group_add','bulk/group_remove',
    'bulk/reset_overrides','bulk/group_policy','bulk/csv_import','system'})
METADATA_FIELDS=('sequence','time','action','revision_before','revision_after')

class AuditMetadata:
    def __init__(self,current_audit,query,clock):
        if not all(callable(v) for v in (current_audit,query,clock)):raise ValueError('explicit scoped source query and clock required')
        self.current_audit,self.query,self.clock=current_audit,query,clock
    async def read(self,params,context):
        provider,query,clock=self.current_audit,self.query,self.clock
        def current():
            context.check()
            if self.current_audit is not provider or self.query is not query or self.clock is not clock:raise Refusal('binding_denied')
        current();source=provider(context.request);current()
        if type(source)is not dict or type(source.get('records'))is not list or len(source['records'])>5000:raise Refusal('binding_denied')
        records=source['records'];next_sequence=source['next'];selected=[];bindings=[]
        for record in records:
            current()
            if type(record)is not dict:raise Refusal('invalid_fields')
            row={k:record[k] for k in METADATA_FIELDS};selected.append(row)
            bindings.append((record,freeze(row)))
        sample=clock();sample.check();context.request.check_time(sample.now);current()
        result=query({'next':next_sequence,'records':selected},thaw(params['filters']))
        current()
        if provider(context.request)is not source or source['records']is not records or source['next']!=next_sequence or len(records)!=len(bindings):raise Refusal('binding_denied')
        for raw,(original,snapshot) in zip(records,bindings):
            if raw is not original:raise Refusal('binding_denied')
            expected=thaw(snapshot)
            if any(type(raw[k])is not type(expected[k]) or raw[k]!=expected[k] for k in METADATA_FIELDS):raise Refusal('binding_denied')
        current();return result
