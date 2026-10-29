"""Original installer on disposable synthetic trees; explicit rename fault only."""
from pathlib import Path
import json,hashlib,sys
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arx-candidate/smplwise_vms/backend'))
from smplwise.services import wiskey_auto_install as wai,wiskey_native_projection as projection

def pin(source):
 files=wai._tree_files(source);tree=hashlib.sha256()
 for name in sorted(files):tree.update(name.encode()+b'\0'+files[name].encode()+b'\n')
 (source.parent/wai.PIN_NAME).write_text(json.dumps({'files':files,'tree_sha256':tree.hexdigest(),'product_CODE':'synthetic-transition-only','version':'2.0.0-rc.39'}))

def setup(tmp_path):
 source=tmp_path/'source/hikvision_intercom';source.mkdir(parents=True)
 (source/'manifest.json').write_text(json.dumps({'version':'2.0.0-rc.39'}));(source/'module.py').write_text('SYNTHETIC=True\n');(source/'resource.bin').write_bytes(b'synthetic-resource')
 pin(source);cfg=tmp_path/'ha';cfg.mkdir();return source,cfg

@pytest.mark.parametrize('change',['bytes','delete','new_extension'])
def test_same_label_full_file_set_change_and_identical_reinstall(tmp_path,change):
 source,cfg=setup(tmp_path)
 assert wai.stage_native_bundle(cfg,source)=='staged'
 target=cfg/'custom_components/hikvision_intercom';prior=wai.source_digest(target)
 assert wai.stage_native_bundle(cfg,source,prior)=='up_to_date'
 if change=='bytes':(source/'resource.bin').write_bytes(b'synthetic-changed')
 elif change=='delete':(source/'resource.bin').unlink()
 else:(source/'new.other').write_bytes(b'synthetic-other-extension')
 pin(source)
 assert wai.stage_native_bundle(cfg,source,prior)=='staged'
 assert wai.source_digest(target)==wai.source_digest(source)
 assert wai._tree_files(target)==wai._tree_files(source)


def test_foreign_extra_and_unsupported_downgrade_are_explicit_refusals(tmp_path):
 source,cfg=setup(tmp_path);wai.stage_native_bundle(cfg,source)
 target=cfg/'custom_components/hikvision_intercom';owned=wai.source_digest(target)
 (target/'foreign.extra').write_text('preserve')
 assert wai.stage_native_bundle(cfg,source,owned)=='native_foreign_installed'
 (target/'foreign.extra').unlink();(source/'manifest.json').write_text(json.dumps({'version':'2.0.0-rc.38'}));pin(source)
 assert wai.stage_native_bundle(cfg,source,owned)=='native_newer_installed'
 assert json.loads((target/'manifest.json').read_text())['version']=='2.0.0-rc.39'


def test_interrupted_native_rename_restores_old_tree_and_invalidates_ready(tmp_path,monkeypatch):
 source,cfg=setup(tmp_path);wai.stage_native_bundle(cfg,source)
 target=cfg/'custom_components/hikvision_intercom';owned=wai.source_digest(target)
 projection_file=cfg/projection.RELATIVE;projection_file.parent.mkdir(parents=True,exist_ok=True);projection_file.write_text('previous readiness projection')
 (source/'resource.bin').write_bytes(b'synthetic-upgrade');pin(source)
 rename=Path.rename
 def fail_new_tree(path,destination):
  if path.name=='hikvision_intercom.smplwise-new':raise OSError('synthetic injected rename fault')
  return rename(path,destination)
 with monkeypatch.context() as patch:
  patch.setattr(Path,'rename',fail_new_tree)
  with pytest.raises(OSError,match='synthetic injected'):wai.stage_native_bundle(cfg,source,owned)
 assert wai.source_digest(target)==owned and not projection_file.exists()
 assert wai.stage_native_bundle(cfg,source,owned)=='staged'
 assert wai.source_digest(target)==wai.source_digest(source)


def test_partial_pair_is_observation_not_installed_generation(tmp_path):
 from smplwise.db import Database
 from smplwise.services import wiskey_install_generation as gen
 source,cfg=setup(tmp_path);wai.stage_native_bundle(cfg,source)
 bridge=cfg/'custom_components/smplwise_bridge';bridge.mkdir();(bridge/'manifest.json').write_text('{}')
 expected={name:projection.digest(cfg/'custom_components'/name) for name in projection.NAMES}
 (bridge/'extra.other').write_text('synthetic mixed-generation file')
 db=Database(tmp_path/'db/main.db');db.migrate();digest=projection.pair_digest(expected);g=gen.begin(db,None,digest);claim=gen.claim_restart(db,None,g,digest)
 answer=projection.publish(db,cfg,expected,generation_id=g,claim=claim)
 assert answer['phase']=='installing' and answer['staged']=={} and answer['installed']!=expected
