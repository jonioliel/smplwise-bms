"""Automatic private source descriptor for the SAME existing ha-whatsapp integration.

Read-only adapter over Arx AccountsService; never a sender, never invents Cloud
secrets or approved template metadata, never overwrites a valid resources.json.
"""
import hashlib,json,os,secrets
from pathlib import Path

RELATIVE='.storage/hikvision_intercom.arx_installation/existing_whatsapp_source.v1.json'
MISSING=['approved_template_reference','template_revision','account_binding','approved_body','language','ordered_parameter_fields','approval_provenance']


def describe(db):
    from .messaging_runtime import accounts_service
    service=accounts_service(db)
    accounts=[]
    for key in sorted(service.all_keys()):
        ref=service.ref(key)
        if ref is None:continue
        accounts.append({'account':'existing-'+hashlib.sha256(key.encode()).hexdigest()[:24],'service_account':ref.value})
    return {'format':'wiskey-existing-whatsapp-source.v1','schema_version':1,'integration':'ha-whatsapp',
            'service':'whatsapp.send_message','service_fields':['account','target','message'],
            'accounts':accounts,'template_metadata':'not_exposed_by_send_service','templates':[],
            'missing_fields':MISSING,'cloud_credentials':'not_applicable_to_this_service_interface'}


def export(db,config_root):
    document=describe(db)  # validate/read genuine upstream BEFORE touching last export
    if any(type(row['service_account']) is not str or not row['service_account'] for row in document['accounts']):
        raise ValueError('existing_whatsapp_account_invalid')
    path=Path(config_root)/RELATIVE;parent=path.parent
    if parent.is_symlink():raise ValueError('private_source_directory_required')
    parent.mkdir(mode=0o700,parents=True,exist_ok=True);os.chmod(parent,0o700)
    tmp=parent/('.existing-whatsapp.'+secrets.token_hex(8)+'.tmp')
    try:
        fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|getattr(os,'O_NOFOLLOW',0),0o600)
        with os.fdopen(fd,'w') as stream:json.dump(document,stream,sort_keys=True);stream.flush();os.fsync(stream.fileno())
        os.replace(tmp,path)
        if os.name!='nt':  # a directory cannot be opened for fsync on Windows (developer workstation only)
            fd=os.open(parent,os.O_RDONLY)
            try:os.fsync(fd)
            finally:os.close(fd)
    finally:tmp.unlink(missing_ok=True)
    return {'state':'metadata_missing','accounts_count':len(document['accounts']),'missing_fields':MISSING}
