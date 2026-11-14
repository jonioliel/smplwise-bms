"""Original Arx SQLite/API code with explicit synthetic transport only; no HA or equipment claim."""
import asyncio,time,json
from types import SimpleNamespace
import pytest
from test_wkr5_295_emergency import v2,starts,door_rows
from smplwise.services import door_windows_engine as dwe, door_emergency as de
from smplwise.services import wiskey_call_budget as budget
from smplwise.services.wiskey_direct_join import DirectCommandSession,DirectCapturePort
from smplwise.services.wiskey_capture_port import PortError
from smplwise.services.wiskey_program_direct import DirectProgramPort,SAVE
from smplwise.services import wiskey_direct_catalog as catalog
from smplwise.services import wiskey_direct_discovery as discovery
from test_wkr5_295 import _cap


def test_confirmed_release_survives_business_permit_off_and_preserves_audit(v2,monkeypatch):
    pw=v2
    response=pw.press("open");assert response.status_code==201,response.text
    iid=response.json()["incident"]["id"]
    before=len(starts(pw.port))
    monkeypatch.setattr(dwe,"GO_LIVE_PERMITTED",False)
    result=pw.release(iid,kind="open");assert result.status_code==200,result.text
    later=starts(pw.port)[before:]
    assert later and all(s["policy_snapshot"]["private_input"]["command"]=="release" for s in later)
    assert pw.audit_actions(),"the original human incident/audit path is used"
    # Source software availability is not a permit to begin another incident.
    denied=pw.press("open");assert denied.status_code in (403,409,503),denied.text


def test_missing_human_confirmation_and_unknown_user_do_not_start(v2):
    pw=v2;before=len(starts(pw.port))
    prepared=pw.post("/doors/emergency/prepare",action="start",kind="open",scope_type="installation",scope_id="*",drill=False)
    assert prepared.status_code==200,prepared.text
    response=pw.post("/doors/emergency/incidents",confirm_token=prepared.json()["confirm_token"],confirmed=False,reason="synthetic",client_request_id="synthetic-unconfirmed")
    assert response.status_code in (400,403,409,422),response.text
    assert len(starts(pw.port))==before
    response=pw.press("open",user="never-an-authorized-actor")
    assert response.status_code in (401,403),response.text
    assert len(starts(pw.port))==before


@pytest.mark.parametrize("code,expected",[("revision_conflict","revision_conflict"),("Unauthorized","unknown"),("program_saved_draft_cleanup_unknown","unknown"),("future_signed_error","unknown")])
def test_verified_error_is_classified_by_commit_stage(code,expected):
    class Port:
        def call(self,*args,**kw):raise PortError(code,"refused")
    port=DirectProgramPort(lambda:SimpleNamespace(selected=lambda c:True,capture_port=Port()))
    with pytest.raises(dwe.EngineError) as error:port.call(SAVE,{})
    assert error.value.kind==expected
    assert dwe.EngineError("future_kind","future").kind=="unknown"


def test_absolute_budget_clamps_rpc_and_removes_sync_margin():
    seen=[]
    class Session:
        def call(self,*args,**kw):seen.append(("call",kw["timeout"]));return object()
        def run_sync(self,coro,timeout):seen.append(("wait",timeout));return {}
    with budget.scope(.12):DirectCapturePort(Session()).call("read",{},timeout_s=8)
    assert all(0<row[1]<=.12 for row in seen)
    assert seen[1][1]<=seen[0][1],"no extra 5-second margin inside one absolute budget"


def test_expired_budget_never_schedules_io():
    class Session:
        def call(self,*args,**kw):raise AssertionError("nothing may be scheduled")
    with budget.scope(.001):
        time.sleep(.005)
        with pytest.raises(PortError) as error:DirectCapturePort(Session()).call("write",{},timeout_s=8)
    assert error.value.outcome=="unknown"


def test_real_loop_link_stall_is_bounded_and_no_command_is_dispatched():
    session=DirectCommandSession(None);sent=[]
    async def blocked():await asyncio.sleep(5);sent.append("unreachable")
    session.link=blocked
    started=time.monotonic()
    try:
        with budget.scope(.12):
            with pytest.raises(PortError):DirectCapturePort(session).call("features/start",{},timeout_s=8)
        assert time.monotonic()-started<1
        time.sleep(.15)
        assert not sent
    finally:session.close()


def test_original_outer_deadline_discards_late_answer():
    done=[]
    def late():time.sleep(.08);done.append(True);return dwe.DoorOutcome("acknowledged","late")
    result=de.call_with_deadline(late,.02)
    assert result.state=="unknown" and result.code=="deadline"
    time.sleep(.1);assert done and result.state=="unknown"


def test_additive_catalog_and_two_explicit_discovery_profiles():
    for command in ("features/emergency_event_status_v1","features/emergency_secure_v1"):
        assert catalog.direct_refusal(command) is None
    legacy=_cap();assert discovery.read_capabilities(legacy,"synthetic-conn")
    extra={"business_contracts":{k:{} for k in ["features/start","stations/technical_program_*","peer_query","whatsapp/template_send_v2","whatsapp/template_send_v3","whatsapp/template_enqueue_v1","events/resume_v1"]},"native_service_write":{"contract":"existing","schema_version":1,"commands":[],"metadata_parameter":"service_write","grant_source":"existing","installation_contract":"existing","default_authority":"denied"},"station_talk_audio":{"schema":"existing","transport":"existing","opt_in":"listen","default":False}}
    assert discovery.read_capabilities({**legacy,**extra},"synthetic-conn")
    for bad in ({**legacy,"extra":1},{**legacy,**extra,"extra":1}):
        with pytest.raises(discovery.DiscoveryError):discovery.read_capabilities(bad,"synthetic-conn")


def test_original_database_write_gate_honours_same_absolute_budget(settings):
    import threading
    from smplwise.db import Database
    db=Database(settings.db_path);db.migrate()
    held=threading.Event();release=threading.Event();done=[]
    def holder():
        with db.connection():held.set();release.wait(2)
        done.append(True)
    thread=threading.Thread(target=holder);thread.start();assert held.wait(2)
    started=time.monotonic()
    try:
        with budget.scope(.12):
            with pytest.raises(Exception) as error:
                with db.connection():raise AssertionError('write must not get the held gate')
            assert 'locked' in str(error.value) or isinstance(error.value,budget.DeadlineExpired)
        assert time.monotonic()-started<1
    finally:release.set();thread.join(2);assert done


def test_durable_status_closed_reader_rejects_version_extra_and_wrong_event():
    import json
    from pathlib import Path
    from smplwise.services.wiskey_feature_direct import read_event_status,FeatureWireError
    # WISKEY-RC4-2310: the exact synthetic fixture is staged inside the repository (was parents[4]/contracts/ - a sibling folder of the
    # Mac clone). Its size and SHA-256 are the delivered ones (Mac C03_contract/schemas/event_status.result.v1.valid.json) and are
    # verified before use.
    import hashlib
    path=Path(__file__).resolve().parent/'fixtures/wiskey/event_status.result.v1.valid.json'
    data=path.read_bytes()
    assert len(data)==1090 and hashlib.sha256(data).hexdigest()=='8b6087a4a49c2baad397e9f071ef8d1afe4f92e64d343173e21afbd96e43b02f'
    value=json.loads(data.decode('utf-8'))
    assert read_event_status(value,'synthetic-event')==value
    for bad in ({**value,'schema_version':2},{**value,'unexpected':True},{**value,'event_ref':'other'}):
        with pytest.raises(FeatureWireError):read_event_status(bad,'synthetic-event')


def test_original_installer_detects_same_label_binary_change_delete_and_extra(settings,tmp_path,monkeypatch):
    from smplwise.services import bridge_install as bi
    from smplwise.main import create_app
    import shutil,json
    source=tmp_path/'source';source.mkdir();(source/'manifest.json').write_text(json.dumps({'version':'synthetic-same-label'}));(source/'Heebo.ttf').write_bytes(b'first');(source/'obsolete.ext').write_bytes(b'obsolete')
    cfg=tmp_path/'config';cfg.mkdir();(cfg/'configuration.yaml').write_text('')
    monkeypatch.setenv('SW_INTEGRATION_SRC',str(source));monkeypatch.setenv('SW_HA_CONFIG_DIR',str(cfg))
    app=create_app(settings);db=app.state.db
    assert bi.install(db,settings,announce=False)['installed_now']
    target=cfg/'custom_components/smplwise_bridge';(target/'extra.arbitrary').write_bytes(b'extra')
    (source/'Heebo.ttf').write_bytes(b'same-label-new-bytes');(source/'obsolete.ext').unlink()
    assert bi.install(db,settings,announce=False)['installed_now']
    assert (target/'Heebo.ttf').read_bytes()==b'same-label-new-bytes' and not (target/'obsolete.ext').exists() and not (target/'extra.arbitrary').exists()
    assert not bi.install(db,settings,announce=False)['installed_now']


def test_manual_profile_prevents_original_arx_installer_and_discovery(settings,tmp_path,monkeypatch):
    from smplwise.services import bridge_install as bi,ha_client
    from smplwise.main import create_app
    cfg=tmp_path/'config';cfg.mkdir();(cfg/'configuration.yaml').write_text('');(cfg/'hikvision_intercom_manual_upgrade.json').write_text('{}')
    monkeypatch.setenv('SW_HA_CONFIG_DIR',str(cfg))
    app=create_app(settings);db=app.state.db;posted=[]
    monkeypatch.setattr(ha_client,'post_discovery',lambda *args,**kw:posted.append(args))
    before=sorted(str(p.relative_to(cfg)) for p in cfg.rglob('*'))
    for _ in range(2):
        value=bi.install(db,settings,force=True)
        assert value['last_error']=='manual_owner_upgrade_profile' and not value['installed_now']
        assert bi.announce_discovery(db,settings) is False
    assert not posted and before==sorted(str(p.relative_to(cfg)) for p in cfg.rglob('*'))


def test_readonly_probe_never_invokes_any_effect_or_changes_selection():
    from smplwise.services.wiskey_selected_readonly import probe,COMMANDS,READ_MANUAL
    called=[]
    class Port:
        def call(self,command,params,**kw):
            called.append(command);assert command=='features/status' and params=={}
            return {'host_registered':False}
    discovery=SimpleNamespace(snapshot=lambda:{'ready':True})
    join=SimpleNamespace(selected=lambda name:True,capture_port=Port(),session=SimpleNamespace(transport_refusal=lambda c:None,discovery=discovery))
    expected={'version':'synthetic-version','component_digest':'a'*64,'product_CODE':'b'*40}
    manual={'contract':'wiskey-manual-upgrade-readiness.v1','schema_version':1,'native':{'version':expected['version'],'installed_digest':'a'*64,'loaded_digest':'a'*64},'entry_count':0,'entries':[],'managed_installation':{'availability':'unavailable'}}
    def authorized(command):assert command==READ_MANUAL;called.append(command);return manual
    value=probe(join,authorized,expected)
    assert value['installed_and_loaded_match'] and value['reported_product_CODE'] is None
    assert called==[READ_MANUAL,'features/status']
    assert not value['feature_host']['host_registered']
    def denied(command):raise PermissionError('original HA ACL denied')
    with pytest.raises(PermissionError):probe(join,denied,expected)


def test_emergency_factory_port_rechecks_same_join_selection_before_identity_and_every_call():
    from smplwise.services.wiskey_direct_join import SelectedFeaturePort
    selected=[False];calls=[]
    class Port:
        def identity(self):calls.append('identity');return 'original-identity'
        def call(self,command,params,**kw):calls.append(command);return {}
    joined=SimpleNamespace(selected=lambda name:selected[0],capture_port=Port())
    port=SelectedFeaturePort(joined)
    with pytest.raises(PortError):port.identity()
    with pytest.raises(PortError):port.call('features/start',{},timeout_s=1)
    assert not calls
    selected[0]=True;assert port.identity()=='original-identity';port.call('features/result',{},timeout_s=1)
    selected[0]=False
    with pytest.raises(PortError):port.call('features/start',{},timeout_s=1)
    assert calls==['identity','features/result']



def test_signed_error_after_emergency_admission_is_unknown_not_no_effect(v2,monkeypatch):
    pw=v2;original=pw.port.call
    def late_error(command,parameters,**kwargs):
        value=original(command,parameters,**kwargs)
        if command=="features/start":
            raise PortError("Unauthorized","refused")
        return value
    monkeypatch.setattr(pw.port,"call",late_error)
    response=pw.press("open");assert response.status_code==201,response.text
    assert starts(pw.port)
    assert all(row["state"]=="unknown" for row in door_rows(pw,response.json()["incident"]["id"]).values())
    with pw.db.connection(mode="read") as conn:
        states=[row[0] for row in conn.execute("SELECT state FROM wiskey_feature_intents WHERE feature='emergency_buttons'")]
    assert states and set(states)=={"unknown"}
