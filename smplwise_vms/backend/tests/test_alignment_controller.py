from pathlib import Path
import json,os,sys
import pytest
# WISKEY-R3-2272: WisKey's alignment tests (R3 delivery 00_summary/arx-tests), adapted to the Arx tree: no arx-candidate path, POSIX
# mode bits asserted off Windows only, and the 'automatic policy' tests replaced by the owner decision (switch stays OFF, see
# test_wiskey_r3_2272_owner_switch.py)
POSIX=os.name!='nt'
from smplwise.db import Database,get_setting
from smplwise.services import wiskey_install_generation as gen,wiskey_native_projection as projection,wiskey_auto_install as wai,wiskey_r2_contracts as r2


def test_not_ready_empty_and_partial_maps_follow_original_closed_schema():
 from smplwise.services.wiskey_auto_install import InstallationError
 def ready_reply():
  digests={'smplwise_bridge':'a'*64,'hikvision_intercom':'b'*64}
  return {'contract':'wiskey-installation-readiness.v1','schema_version':1,'state':'ready','reason':None,'generation_id':'synthetic-generation','boot_id':'synthetic-boot','process_id':29,'expected':dict(digests),'staged':dict(digests),'installed':dict(digests),'loaded':dict(digests),'bridge_boot_id':'synthetic-bridge-boot','restart':None,'connection_ref':'synthetic-connection','bridge_entry_id':'synthetic-entry','installation_id':'synthetic-installation','grant_ref':{},'cloud_resources_state':'waiting'}
 value=ready_reply();value.update(state='not_ready',reason='generation_missing',generation_id=None,expected={},staged={},installed={},loaded={},bridge_boot_id=None,restart=None)
 assert r2.read_readiness(value)['state']=='not_ready'
 value['staged']={'hikvision_intercom':'a'*64};assert r2.read_readiness(value)['state']=='not_ready'
 value.update(state='ready',reason=None)
 with pytest.raises(InstallationError):r2.read_readiness(value)


def test_projection_is_derived_from_only_current_sqlite_journal(tmp_path):
 db=Database(tmp_path/'db/main.db');db.migrate();cfg=tmp_path/'ha';cfg.mkdir()
 for name in projection.NAMES:
  path=cfg/'custom_components'/name;path.mkdir(parents=True);(path/'manifest.json').write_text('{}')
 expected={name:projection.digest(cfg/'custom_components'/name) for name in projection.NAMES}
 g=gen.begin(db,None,projection.pair_digest(expected));claim=gen.claim_restart(db,None,g,projection.pair_digest(expected))
 doc=projection.publish(db,cfg,expected,generation_id=g,claim=claim)
 assert doc['generation_id']==g and doc['claim_id']==claim and doc['phase']=='installed'
 assert not POSIX or (cfg/projection.RELATIVE).stat().st_mode&0o777==0o600
 old=gen.read(db);new=gen.begin(db,None,'different-digest')
 assert projection.publish(db,cfg,expected,generation_id=g,claim=claim) is None
 assert gen.read(db)['generation_id']==new and old['claim']==claim


def test_r2_unknown_migration_keeps_original_file_and_prevents_same_source_replay(tmp_path):
 db=Database(tmp_path/'db/main.db');db.migrate();cfg=tmp_path/'ha';base=cfg/Path(projection.RELATIVE).parent;base.mkdir(parents=True)
 expected={'smplwise_bridge':'a'*64,'hikvision_intercom':'b'*64}
 original={'generation_id':'original-generation','expected':expected,'restart':{'state':'unknown','boot_id':'prior'},'native_restart':{'state':'requested'}}
 p=base/'generation.json';p.write_text(json.dumps(original));p.chmod(0o600);before=p.read_bytes()
 projection.migrate_r2(db,None,cfg,expected,'old-native-digest')
 g=gen.begin(db,None,projection.pair_digest(expected));assert gen.claim_restart(db,None,g,projection.pair_digest(expected)) is None
 assert gen.read(db)['state']==gen.UNKNOWN and p.read_bytes()==before
 with db.connection(mode='read') as c:assert json.loads(get_setting(c,projection.HISTORY_KEY))['records'][0]['document']==original


def test_same_original_whatsapp_export_does_not_invent_cloud_assets_or_overwrite_resources(tmp_path):
 from smplwise.services import wiskey_existing_whatsapp_source as source
 db=Database(tmp_path/'db/main.db');db.migrate();cfg=tmp_path/'ha';parent=cfg/'.storage/hikvision_intercom.arx_installation';parent.mkdir(parents=True)
 resources=parent/'resources.json';resources.write_text('original valid source untouched')
 report=source.export(db,cfg)
 assert report['state']=='metadata_missing' and report['accounts_count']==0
 data=json.loads((cfg/source.RELATIVE).read_text());assert data['service']=='whatsapp.send_message' and data['templates']==[]
 assert data['cloud_credentials']=='not_applicable_to_this_service_interface' and resources.read_text()=='original valid source untouched'
 assert not POSIX or (cfg/source.RELATIVE).stat().st_mode&0o777==0o600


def test_current_runtime_catalog_and_approval_business_commands_are_reachable():
 from smplwise.services import wiskey_direct_catalog as catalog
 catalog.load.cache_clear()
 actual=catalog.load()
 assert actual.registered_count==290 and actual.command_count==294
 for command in ["installation/request_restart_v2","installation/capability_preflight_v1","installation/template_source_status_v1","installation/readiness_v1","media/station_snapshot_v1","jobs/approval_request","jobs/approval_decide","whatsapp/template_send_v3"]:
  assert actual.get(command) is not None
 # approvals: reachable on the direct envelope only while the installation switch is on (review M2, owner decision 29.10); every other
 # command of the new catalog is not owner-excluded
 old=catalog.INSTALLATION_SWITCH
 try:
  catalog.INSTALLATION_SWITCH=None
  assert catalog.direct_refusal("jobs/approval_request")=="owner_excluded" and catalog.direct_refusal("jobs/approval_decide")=="owner_excluded"
  catalog.INSTALLATION_SWITCH=lambda:True
  assert catalog.direct_refusal("jobs/approval_request") is None and catalog.direct_refusal("jobs/approval_decide") is None
 finally:catalog.INSTALLATION_SWITCH=old
 for command in ["installation/request_restart_v2","installation/capability_preflight_v1","installation/template_source_status_v1"]:
  assert catalog.direct_refusal(command) is None


def test_new_outcome_reader_preserves_unknown_and_new_restart_refusals():
 assert r2.outcome_known("restart_claim_stale")
 assert not r2.outcome_known("future-unrecognized-synthetic-code")

def test_dependency_missing_binary_in_actual_subprocess_environment():
 import subprocess,os
 backend=Path(__file__).resolve().parents[1]
 command=[sys.executable,"-c","import json;from smplwise.services.wiskey_runtime_preflight import local;print(json.dumps(local()))"]
 result=subprocess.run(command,cwd=backend,env={**os.environ,"PATH":""},capture_output=True,text=True,timeout=10)
 assert result.returncode==0,result.stderr
 value=json.loads(result.stdout)
 assert value["ffmpeg"]=={"available":False,"version":None}
 assert value["external_go2rtc_namespace"]=="not_measured"
