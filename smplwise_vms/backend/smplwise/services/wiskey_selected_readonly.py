"""Owner30 revision-1 cached software probe on EXISTING authenticated interfaces.

The host supplies its current DirectJoin and an already-authorized HA read
callback. This module creates no socket/account/key/grant, installs nothing,
changes no switch and calls no program save/pause or emergency effect/release.
Invoke only in the separately authorized read-only phase after owner install.
"""
from typing import Callable,Any
from . import wiskey_direct_catalog as catalog
READ_MANUAL='hikvision_intercom/upgrade/manual_readiness_v1'
COMMANDS=('stations/technical_program_list','stations/technical_program_save','stations/technical_program_action','features/start','features/emergency_event_status_v1')

def probe(join:Any,read_authorized_ha:Callable[[str],dict],expected:dict)->dict:
    if set(expected)!={'version','component_digest','product_CODE'}:
        raise ValueError('expected_identity_invalid')
    if join is None:
        return {'contract':'wiskey-selected-readonly.v1','state':'unavailable','reason':'existing_join_unavailable','owner_installation':'NOT_MEASURED'}
    manual=read_authorized_ha(READ_MANUAL)  # callback must preserve original HA ACL; no fallback identity
    if manual.get('contract')!='wiskey-manual-upgrade-readiness.v1' or manual.get('schema_version')!=1:
        raise ValueError('manual_readiness_contract_invalid')
    selected={name:join.selected(name) for name in COMMANDS}
    identity=manual.get('native',{})
    match=(identity.get('version')==expected['version'] and identity.get('installed_digest')==identity.get('loaded_digest')==expected['component_digest'])
    host=None
    if join.selected('features/status'):
        host=join.capture_port.call('features/status',{},timeout_s=3)
    return {'contract':'wiskey-selected-readonly.v1','state':'observed','expected':dict(expected),'actual_native':identity,'reported_product_CODE':None,
        'CODE_resolution':'Expected CODE is resolved only through delivered label+full-file digest manifest; Native does not self-report its commit SHA.',
        'installed_and_loaded_match':match,'entry_count':manual.get('entry_count'),'loaded_entry_count':sum(row.get('loaded') is True for row in manual.get('entries',[])),
        'catalog_registered':{name:catalog.load().get(name) is not None for name in COMMANDS},'selected':selected,
        'selection_refusal':{name:join.session.transport_refusal(name) for name in COMMANDS if not selected[name]},
        'discovery':join.session.discovery.snapshot(),'feature_host':host,'managed_installation':manual.get('managed_installation'),
        'read_only_commands':[READ_MANUAL,'direct/capabilities','direct/time','features/status'],
        'physical':'NOT_MEASURED','scope':'software observation only; selection is not active host, adoption, owner installation or measured equipment'}
