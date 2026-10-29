"""Read-only local namespace probe, stored independently of pair readiness."""
import json,shutil,subprocess
from .wiskey_auto_install import InstallationError


def local():
    binary=shutil.which('ffmpeg');version=None
    if binary:
        try:
            result=subprocess.run([binary,'-version'],capture_output=True,text=True,timeout=2)
            if result.returncode==0:version=result.stdout.splitlines()[0][:256]
        except (OSError,subprocess.TimeoutExpired):pass
    return {'namespace':'arx_addon','ffmpeg':{'available':binary is not None,'version':version},'external_go2rtc_namespace':'not_measured'}


def save_preflight(db,native):
    from ..db import set_setting
    if type(native) is not dict or native.get('contract')!='wiskey-capability-preflight.v1' or native.get('global_ha_health')!='not_assessed':
        raise InstallationError('capability_preflight_invalid')
    value={'format':'wiskey-runtime-preflight-observation.v1','schema_version':1,'ha_core':native,'arx_addon':local(),'global_health':'not_assessed'}
    with db.write_aside(label='software dependency observation') as conn:set_setting(conn,'wiskey.installation.preflight.v1',json.dumps(value,sort_keys=True))
