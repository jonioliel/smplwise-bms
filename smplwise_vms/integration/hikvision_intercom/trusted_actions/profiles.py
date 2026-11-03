"""Bounded local development profiles. No adapter is enabled on import.

These strict profiles reject values outside a proven public shape. They are
not a claim of whole-action/native equivalence or a change to wire contracts.
Complex unclosed fields are not silently replaced by 'any'.
"""
from .adapters import AdapterSpec, SourceRef, closed
from .timing import normalize_schedule
from .validation import Refusal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from dataclasses import replace
import json
from collections.abc import MutableMapping

FROZEN = "3ceae6d0e4c35e27e938be4c6e1f74f50152f873"
PREFIX = "custom_components/hikvision_intercom/"
WS_HASH = "e5a228ea32dfb48bde8186a7a06f165ddc0798946285850f1b1ada0bd4f0b93a"


def text(maximum=128, minimum=0):
    return {"type": "string", "minLength": minimum, "maxLength": maximum, "pattern": "^[^\\x00-\\x1f]*$"}


def nullable(schema):
    result = {**schema, "type": [schema["type"], "null"]}
    if 'enum' in schema:result['enum']=[*schema['enum'],None]
    return result


def array(items, maximum=None):
    result = {"type": "array", "items": items}
    if maximum is not None:result["maxItems"] = maximum
    return result


def source(path, start, end, digest):
    return SourceRef(FROZEN, PREFIX + path, start, end, digest)


def _build_profiles():
    """Fresh independent definitions; host explicitly chooses a reviewed action."""
    station = text(128, 1)
    identifier = {"type": "string", "format": "uuid"}
    revision = {"type": "integer", "minimum": 1}
    integer = {"type": "integer", "minimum": 0}
    boolean = {"type": "boolean"}
    accepted = closed({"accepted": {"const": True}})
    profiles = {}
    def add(action, params, projection, *refs):
        profiles[action] = AdapterSpec(action, "urn:wiskey:local-candidate:" + action.replace("/", ":"), "1",
                                       params, projection, tuple(refs))
    ws = lambda start, end: source("websocket.py", start, end, WS_HASH)
    add("stations/test_unlock", closed({"station_id": station, "lock": {"type": "integer", "enum": [1, 2]}}), accepted, ws(1607, 1634), ws(1686, 1686))
    add("users/delete", closed({"user_id": identifier, "revision": revision}), accepted, ws(1591, 1592), ws(1686, 1686),
        source('access/manager.py',777,783,'65e89afb564e1b5a6587cc90d508e2efd115cd475ce700f65b1ed3013c6038ac'),
        source('access/repository.py',899,900,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb'),
        *[source('access/repository.py',start,end,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb')
          for start,end in ((323,372),(424,426),(529,535),(902,938),(1095,1141),(1184,1220),(1370,1421))],
        *[source('access/engine.py',start,end,'213ff42a431b834143fb5e84857b6eba9da4280b07701ccfb6f980bb74ed942b')
          for start,end in ((40,53),(161,438),(440,525),(527,563))])
    add('users/get',closed({'user_id':identifier}),closed({'id':identifier,'revision':revision,
        'display_name':text(32,1),'valid_from':nullable({'type':'string','format':'date-time'}),
        'valid_until':nullable({'type':'string','format':'date-time'}),
        'group_ids':{**array({'type':'string','pattern':'^[a-z][a-z0-9_]{0,47}$'},64),'uniqueItems':True}}),
        ws(1490,1491),source('access/models.py',172,256,'51d857b8319961a21a91cfb4e9a4cd8c54a1ab2c4542b04de4324cc5ce7e0947'),
        source('access/repository.py',323,373,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb'))
    # Arx sends no query text. Credential/profile/station/right selectors remain
    # outside this bounded public-read subset; no private search fallback.
    directory_person=closed({**profiles['users/get'].projection['properties'],
        'active':boolean,'archived_at':nullable({'type':'string','format':'date-time'})})
    add('users/query',closed({'query':{'const':''},'filters':closed({
        'group':text(128),'station':{'const':''},'rights':{'const':''},
        'state':{'type':'string','enum':['','archived','active','inactive','upcoming','expired']},
        'credential':{'const':''},'profile':closed({}),'sort':{'type':'string','enum':['name','name_desc']}},['sort']),
        'offset':{'type':'integer','minimum':0,'maximum':10000000},
        'limit':{'type':'integer','minimum':1,'maximum':200},'snapshot':text(64)}),
        closed({'records':array(directory_person,200),'total':integer,'total_all':integer,
            'offset':integer,'limit':{'type':'integer','minimum':1,'maximum':200},
            'next_offset':nullable(integer),'previous_offset':nullable(integer),
            'snapshot':{'type':'string','pattern':'^[a-f0-9]{24}$'},'stale':boolean}),ws(1421,1438),
        source('access/user_directory.py',20,214,'a8093dcc5e60d39f125386327436650e40a482b1ef566dc562a07036178b3d02'),
        source('access/models.py',172,256,'51d857b8319961a21a91cfb4e9a4cd8c54a1ab2c4542b04de4324cc5ce7e0947'))
    from .audit_reads import AUDIT_ACTIONS
    audit_row=closed({'sequence':revision,'time':{'type':'string','format':'date-time'},
        'action':{'type':'string','enum':sorted(AUDIT_ACTIONS)},
        'revision_before':nullable(revision),'revision_after':nullable(revision)})
    add('audit/list',closed({'filters':closed({'before':revision,
        'limit':{'type':'integer','minimum':1,'maximum':100},
        'start':{'type':'string','format':'date-time'},'end':{'type':'string','format':'date-time'},
        'action':{'type':'string','enum':['users/create','users/update','users/delete','users/archive','users/unarchive']}},[])}),
        closed({'records':array(audit_row,100),'next_cursor':nullable(revision),'total':integer,
            'retention_days':{'const':30},'retention_limit':{'const':5000}}),ws(896,897),
        source('admin_operations_api.py',60,72,'bac22da3082192629cb9c6c62ada171393288926d4ef46e07805e34e2a341eec'),
        source('access/admin_audit.py',137,204,'8653937b753d656596d2ef3791546da5aaf3f0c0d42c0ae3e072aaaf6a9c9e91'),
        source('access/admin_audit.py',376,436,'8653937b753d656596d2ef3791546da5aaf3f0c0d42c0ae3e072aaaf6a9c9e91'))
    add('subscribe',closed({}),{'type':'null'},ws(1816,1868))
    from .public_snapshots import STATION_ROW,SESSION_SCHEMA,CONFLICT_PERSON
    add('authorization/session',closed({}),SESSION_SCHEMA,ws(815,836),ws(1775,1783),
        source('panel_permissions.py',12,15,'3b0191b681ebe7546ef4941214c4d0d49823083b88e0aff38791540b14451215'),
        source('panel_permissions.py',64,124,'3b0191b681ebe7546ef4941214c4d0d49823083b88e0aff38791540b14451215'),
        source('panel_permissions.py',197,234,'3b0191b681ebe7546ef4941214c4d0d49823083b88e0aff38791540b14451215'),
        source('panel_security.py',50,57,'b0abf37a760383728b59fa13d4567ee332ae221821d2b2af8fc30ea6106991cd'),
        source('access/renewal_portal.py',19,20,'3cab31cdb4a0d3551a137fb2ab42b69eea2e012d2538a3598ad1e6363c9c68f6'),
        source('access/workflows.py',260,272,'a2d3c84276f8ac3161cab08e718e47568abfd61b47704dfbb4a46dc563edcf98'))
    add('overview',closed({}),closed({'stations':array(STATION_ROW,1)}),ws(463,465),ws(507,530),
        source('access/manager.py',836,886,'65e89afb564e1b5a6587cc90d508e2efd115cd475ce700f65b1ed3013c6038ac'))
    add('conflicts/list',closed({}),closed({'users':array(CONFLICT_PERSON,5000)}),ws(1648,1661),
        source('access/models.py',122,142,'51d857b8319961a21a91cfb4e9a4cd8c54a1ab2c4542b04de4324cc5ce7e0947'),
        source('access/models.py',231,256,'51d857b8319961a21a91cfb4e9a4cd8c54a1ab2c4542b04de4324cc5ce7e0947'))
    from .scoped_metadata import EVENT_REQUEST, EVENT_ROW, SYNC_ROW
    add('events/list',EVENT_REQUEST,closed({'records':array(EVENT_ROW,200),
        'next':nullable(text(128,1)),'retention_days':{'type':'integer','minimum':1},
        'capacity':{'type':'integer','minimum':1}}),ws(1217,1243),
        source('events.py',332,419,'4f791aa19c3ee9df772cb4c18a3bb472b257c3122e0515802436965e7443cb08'))
    from .sync_counts import COUNT_RESULT
    add('sync/status',closed({}),COUNT_RESULT,
        ws(1244,1245),source('access/repository.py',465,532,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb'),
        source('access/manager.py',836,886,'65e89afb564e1b5a6587cc90d508e2efd115cd475ce700f65b1ed3013c6038ac'),
        source('access/sync_tracking.py',16,35,'d442a8c711e399004e944069e2ead9c1632c49735b4fa6e72151b28cc07999ea'))
    from .event_reads import DETAIL_REQUEST,EXPORT_REQUEST,EXPORT_RESULT
    add('events/detail',DETAIL_REQUEST,closed({'record':EVENT_ROW}),ws(958,959),
        source('event_manager.py',287,300,'1a6f598d07a0f8cdd2340e2b49df1a013dc0be763b1e309420d2ba9066373357'))
    add('events/export',EXPORT_REQUEST,EXPORT_RESULT,ws(1191,1200),
        source('reporting.py',171,210,'48ee56b2b8a4d1cfab7b87170840e0b696ba57dbec72127f238b6c0ec8936ea5'),
        source('access/csv_transfer.py',41,59,'53fa7f1e368f3ce560a6ba867896d9f4fb4c421d6d1d5d111b4cf95c35519a2a'))
    # Request/result component candidates only. Source repository mutations,
    # audit/public serialization and classic request_user worker derivation are
    # not yet closed. Composition must continue rejecting these PARTIAL_OFF.
    person_projection=profiles['users/get'].projection
    # Opaque component shapes are intentionally PARTIAL_OFF. Their source
    # value/generator/retirement branches have not been replaced by a fake.
    from .sensitive_producers import OPAQUE_RESULT
    add('users/photo_get',closed({'user_id':identifier}),OPAQUE_RESULT,ws(1453,1490))
    add('users/pin_generate',closed({'user_id':{'type':'string','anyOf':[{'const':''},{'type':'string','format':'uuid'}]}}),OPAQUE_RESULT,
        ws(1530,1533),source('access/repository.py',454,463,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb'))
    add('cards/add',closed({'user_id':identifier,'revision':revision}),person_projection,ws(1567,1590))
    add('cards/remove',closed({'user_id':identifier,'revision':revision,'card_id':identifier}),person_projection,ws(1567,1590))
    add('whatsapp/preview',closed({'user_id':identifier,'account':text(128,1),'language':{'type':'string','enum':['he','en']}}),
        closed({'preview_reference':identifier,'consent_revision':revision,'expires_at':{'type':'string','format':'date-time'}}),
        ws(888,891),source('whatsapp_api.py',180,250,'3b6920df7a6f1de11a626b40ba3bfab887370869ef5f4bd8a47a7feabbd5bdd7'))
    add('whatsapp/send',closed({'user_id':identifier,'account':text(128,1),'preview_reference':identifier,'confirmed':{'const':True}}),accepted,
        ws(888,891),source('whatsapp_api.py',251,274,'3b6920df7a6f1de11a626b40ba3bfab887370869ef5f4bd8a47a7feabbd5bdd7'))
    for action in ['users/archive','users/unarchive']:
        add(action,closed({'user_id':identifier,'revision':revision,'confirmed':{'const':True}}),person_projection,
            ws(1503,1509),source('access/manager.py',785,792,'65e89afb564e1b5a6587cc90d508e2efd115cd475ce700f65b1ed3013c6038ac'),
            source('access/repository.py',731,752,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb'))
    add('users/temporary_cancel',closed({'user_id':identifier,'revision':revision,'reason_code':{'type':'string',
        'enum':['visit_cancelled','visit_completed','access_no_longer_needed']}}),person_projection,
        ws(1510,1511),source('access/manager.py',794,800,'65e89afb564e1b5a6587cc90d508e2efd115cd475ce700f65b1ed3013c6038ac'),
        source('access/repository.py',754,769,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb'),
        ws(416,422),ws(1690,1718),source('access/admin_audit.py',66,81,'8653937b753d656596d2ef3791546da5aaf3f0c0d42c0ae3e072aaaf6a9c9e91'))
    public_edit_fields={'display_name':text(32,1),'active':boolean,
        'valid_from':nullable({'type':'string','format':'date-time'}),
        'valid_until':nullable({'type':'string','format':'date-time'}),
        'group_ids':{**array({'type':'string','pattern':'^[a-z][a-z0-9_]{0,47}$'},64),'uniqueItems':True}}
    create_data=closed(public_edit_fields,['display_name'])
    patch_data={**closed(public_edit_fields,[]),'minProperties':1}
    add('users/create',closed({'data':create_data,'sync_now':boolean},['data']),person_projection,
        ws(1551,1560),source('access/manager.py',743,754,'65e89afb564e1b5a6587cc90d508e2efd115cd475ce700f65b1ed3013c6038ac'))
    add('users/update',closed({'user_id':identifier,'revision':revision,'data':patch_data,'sync_now':boolean},['user_id','revision','data']),
        person_projection,ws(1583,1590),source('access/manager.py',756,775,'65e89afb564e1b5a6587cc90d508e2efd115cd475ce700f65b1ed3013c6038ac'))
    add('users/set_active',closed({'user_id':identifier,'revision':revision,'active':boolean}),
        person_projection,ws(1583,1590),source('access/manager.py',756,775,'65e89afb564e1b5a6587cc90d508e2efd115cd475ce700f65b1ed3013c6038ac'))
    from .people import PUBLIC_PEOPLE_SELECTIONS
    profiles['users/get']=replace(profiles['users/get'],selection_revisions=PUBLIC_PEOPLE_SELECTIONS)
    add("cards/capture_cancel", closed({"session_id": text(128, 1)}), closed({"cancelled": {"const": True}}), ws(990, 992),
        source('access/enrollment.py',61,76,'d23d1545e6b7c7b346b215a0bc3f60848b549c0c145dfd5e9349f5919b0cf817'),
        source('access/enrollment.py',174,194,'d23d1545e6b7c7b346b215a0bc3f60848b549c0c145dfd5e9349f5919b0cf817'))
    add("cards/reader_capabilities", closed({"station_id": station}),
        closed({"readers": {**array({"type": "integer", "minimum": 0, "maximum": 8}, 8), "uniqueItems": True, "minItems": 1},
                "card_min": {"type": "integer", "minimum": 1, "maximum": 32}, "card_max": {"type": "integer", "minimum": 1, "maximum": 32}}),
        ws(960, 961), source("client/capture.py", 24, 56, "789e93001850b51afe16115f9570619836ef33dc610a43fcabd0ff53d11b66a3"))
    card = nullable(closed({"masked_number": {"type": "string", "pattern": "^••••(?: [0-9]{4})?$"},
                            "technology": {"type": ["string", "null"], "enum": [None, "TypeA_M1", "TypeA_CPU", "TypeB", "ID_125K", "FelicaCard", "DesfireCard"]},
                            "reader_id": {"type": ["integer", "null"], "minimum": 0, "maximum": 8}}))
    session = closed({"session_id": text(128, 1), "station_id": station, "user_id": identifier, "revision": revision,
                      "state": {"type": "string", "enum": ["preparing", "waiting", "captured", "error", "applying"]},
                      "error": {"type": ["string", "null"], "pattern": "^[a-z][a-z0-9_]{0,63}$"}, "card": card})
    ref = source("access/enrollment.py", 23, 171, "d23d1545e6b7c7b346b215a0bc3f60848b549c0c145dfd5e9349f5919b0cf817")
    add("cards/capture_start", closed({"station_id": station, "user_id": identifier, "revision": revision,
                                      "reader_id": {"type": "integer", "minimum": 0, "maximum": 8}}), session, ref, ws(962, 993))
    add("cards/capture_status", closed({"session_id": text(128, 1)}), session, ref, ws(987, 988))
    record = closed({"revision": integer, "saved_at": nullable({"type": "string", "format": "date-time"}),
                     "action": {"type": "string", "enum": ["baseline", "system", "profiles/settings_update", "bulk/group_policy", "platform/lifecycle_apply"]},
                     "origin": {"type": "string", "enum": ["baseline", "saved"]}, "field_changes": integer, "group_changes": integer})
    add("profiles/versions", closed({"offset": integer, "limit": {"type": "integer", "minimum": 1, "maximum": 50}}),
        closed({"records": array(record, 50), "total": integer, "offset": integer, "next_offset": nullable(integer),
                "previous_offset": nullable(integer), "current_revision": integer, "retained_from_revision": integer}),
        source("access/policy_versions.py", 129, 149, "cc65ea4d2758ae3b855dcaba354388b8c8aa4a2fe1ab3c135c7c896d69284e81"))
    add("tts/engines", closed({}), closed({"default": nullable(text()), "engines": array(closed({
        "engine_id": text(), "name": text(256), "supported_languages": array(text(64),64), "default_language": nullable(text(64))}),64)}),
        source("audio_tts.py", 61, 91, "e0cc1d28220b79e1901fd157b017a426e28ce75ea505f8c5ec283750c46d0849"),
        source("audio_tts.py",263,272,"e0cc1d28220b79e1901fd157b017a426e28ce75ea505f8c5ec283750c46d0849"))
    # The message is transferred once through the existing sensitive reference,
    # not copied into public parameters, projection, audit or exceptions.
    add('tts/start',closed({'station_id':station,'engine_id':text(128,1),'language':nullable(text(64))}),
        {'type':'null'},source('audio_tts.py',50,58,'e0cc1d28220b79e1901fd157b017a426e28ce75ea505f8c5ec283750c46d0849'),
        source('audio_tts.py',130,258,'e0cc1d28220b79e1901fd157b017a426e28ce75ea505f8c5ec283750c46d0849'),
        source('audio_tts.py',275,339,'e0cc1d28220b79e1901fd157b017a426e28ce75ea505f8c5ec283750c46d0849'))
    alert_kind={'type':'string','enum':['offline','sync_stalled','sync_error','sync_conflict','clock_drift','event_gap']}
    alert=closed({'id':text(196,1),'station_id':station,'kind':alert_kind,
        'severity':{'type':'string','enum':['warning','error']},
        'observed_since':nullable({'type':'string','format':'date-time'}),
        'observed_seconds':nullable(integer),'online':boolean,
        'sync_state':{'type':'string','enum':['synced','pending','syncing','offline','conflict','error','delete_pending','unknown']},
        'suppressed':boolean})
    add('fleet/alerts',closed({'offset':integer,'limit':{'type':'integer','minimum':1,'maximum':200},
        'station_id':station,'kind':{'type':'string','enum':['',*alert_kind['enum']]},'include_suppressed':boolean}),
        closed({'revision':integer,'generated_at':{'type':'string','format':'date-time'},'items':array(alert,200),
            'total':integer,'offset':integer,'next_offset':nullable(integer),'active_count':integer,'suppressed_count':integer,
            'evidence_scope':{'const':'observed_health_not_physical_acceptance'}}),ws(1494,1495),
        source('fleet_alerts_api.py',14,49,'5368f06ed9ebdd0efa050a4a7eb173c4247cf64e5753c27d95df07654d129983'),
        source('fleet_alerts.py',19,139,'d5cae5af414581d8e5e357894ba39fe54d45da339105cbb8001473e8c834e6aa'),
        source('fleet_alerts.py',269,327,'d5cae5af414581d8e5e357894ba39fe54d45da339105cbb8001473e8c834e6aa'))
    add('health/get',closed({'station_id':station}),closed({'integration_version':text(64,1),'loaded':boolean,
        'config_schema':closed({'version':integer,'minor_version':integer})}),ws(942,943),
        source('health_api.py',20,27,'65f1d741cefbfc6de03b310945b78421507f7aa26683e823f3ba72d2d6a0b1e8'),
        source('health_api.py',147,153,'65f1d741cefbfc6de03b310945b78421507f7aa26683e823f3ba72d2d6a0b1e8'),
        source('diagnostics.py',15,25,'34d93258932a5a6a2c78391edf5922deee8aac80d3510db3f8bbb4c4f068517a'))
    add('whatsapp/status',closed({}),closed({'available':boolean,'history':boolean}),
        ws(888,889),source('whatsapp_api.py',173,194,'3b6920df7a6f1de11a626b40ba3bfab887370869ef5f4bd8a47a7feabbd5bdd7'))
    definition_id={'type':'string','pattern':'^[a-z][a-z0-9_]{0,47}$'}
    field=closed({'id':definition_id,'label':text(64,1),'enabled':boolean,
        'type':{'type':'string','enum':['text','select','number','date']},'required':boolean,'unique':boolean,
        'options':{**array(text(100,1),100),'uniqueItems':True},
        'depends_on':nullable(closed({'field_id':definition_id,'value':text(100)}))})
    group=closed({'id':definition_id,'label':text(64,1),'enabled':boolean,
        'station_ids':{**array(text(64,1),100),'uniqueItems':True}},['id','label','enabled'])
    # Whole-blob source bindings for definitions are attached below by the same
    # source helper; labels/options are public configuration, not person values.
    add('profiles/settings_get',closed({}),closed({'revision':integer,'photo_enabled':boolean,
        'groups':array(group,64),'fields':array(field,12)}),
        source('profile_settings.py',20,123,'af122f60dabdac5f07c25406ac837637fbd93184e5beaa0149a36fd39895e234'),
        source('profile_settings.py',275,278,'af122f60dabdac5f07c25406ac837637fbd93184e5beaa0149a36fd39895e234'),
        source('profile_conditions.py',15,64,'ea8181df7e9c821ece6a2027e63cd9b4913433458cadd872ca22a2cd9be6a58f'))
    period = closed({'start':{'type':'string','pattern':'^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'},
                     'end':{'type':'string','pattern':'^(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'}})
    periods = array(period,8)
    day = {'type':'string','pattern':'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'}
    schedule = closed({'name':text(32,1),'weekly':closed({d:periods for d in
        ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']}),
        'holidays':array(closed({'name':text(32,1),'start':day,'end':day,'periods':periods}),64)})
    schedule_ref=source('access/schedules.py',69,200,'b74b51083974f6c988a569389eab1905e3a871debdb8417cc3e57195d8ddcb44')
    add('schedules/list',closed({}),array(closed({'id':identifier,'revision':revision,
        'updated_at':{'type':'string','format':'date-time'},**schedule['properties']}),100),schedule_ref)
    policy=closed({'timezone':text(64,1),'schedule':schedule})
    door={'type':'integer','enum':[1,2]}
    draft=closed({'station_id':station,'door':door,'revision':revision,'policy':policy})
    draft_ref=source('access/hold_open.py',20,147,'892b24a9a86e4c9b158727f2998d3b7798a87d24b442e52f72f45a88f5622f77')
    technical_ref=source('technical_api.py',20,126,'0d7c7b473b850d950884a362a022b56605c85319c21856cb2c20d12e5e829717')
    add('stations/technical_hold_get',closed({'station_id':station,'door':door}),
        closed({'draft':nullable(draft),'active':{'const':False},'blocker':{'const':'schedule_writes_unverified'},
                'timezone':text(64,1)}),draft_ref,schedule_ref,technical_ref)
    program=closed({'door':door,'revision':revision,'enabled':boolean,'removing':boolean,'policy':policy,
        'execution':closed({'owned':boolean,'attempted':nullable(text()),'status':{'type':'string','enum':[
            'idle','opening','held_acknowledged','restoring','unknown']}}),
        'error':{'type':['string','null'],'enum':[None,'technical_write_unknown']},'checked_at':nullable(text())})
    add('stations/technical_program_list',closed({'station_id':station}),
        closed({'programs':array(program,2),'saved':array(draft,2),'timezone':text(64,1),'native_supported':{'const':False}}),
        draft_ref,schedule_ref,technical_ref,source('access/hold_programs.py',23,83,'259d44e24af61c25988439def79495740dcd5a54067c30ff6032091a7ca080b8'))
    add('schedules/plan_list',closed({}),array(closed({'id':identifier,'revision':revision,
        'draft_id':identifier,'draft_revision':revision,'can_apply':{'const':False}}),32),
        ws(996,997),source('schedule_plan_api.py',40,45,'92a3732302cf1ff70ba2a32c1f448759d48a49087cb753f4706edd81595b6cdc'),
        source('access/schedule_plans.py',146,260,'bc46812d7391f01c839f0f3b9f6df67667f7371270c9cd9cc9cc5d8c05911fc0'))
    add('schedules/operations_list',closed({}),closed({
        'claims':array(closed({'id':identifier,'revision':revision,'plan_id':identifier}),100),
        'jobs':array(closed({'id':identifier,'revision':revision,'plan_id':identifier,'plan_revision':revision,
            'status':{'type':'string','enum':['pending','checking','queued','ready','blocked','verified','failed','cancelled','interrupted']},
            'ownership':{'type':'string','enum':['not_checked','missing','current','changed']}}),100),
        'writes_enabled':{'const':False}}),ws(994,995),
        source('schedule_operations_api.py',159,166,'d326e8ddc8708d94f6b1021b79db945bf558726b2035567f5c6d1307d68b9ad7'),
        source('access/schedule_operations.py',90,171,'32c41ef6092a5582311665c7c73f65ae4b52202114d69ddbe6061d58755012a2'),
        source('access/schedule_operations.py',242,256,'32c41ef6092a5582311665c7c73f65ae4b52202114d69ddbe6061d58755012a2'))
    public_flags=closed({f'public{i}Configured':{'type':['boolean','null']} for i in range(1,17)})
    add('stations/technical_codes_get',closed({'station_id':station}),closed({
        'status':closed({'states':public_flags,'public_pin_state':{'type':'string','enum':['configured','absent','unknown']},
                         'checked_at':{'type':'string','format':'date-time'}}),
        'capabilities':closed({'advertised':boolean,'slots':array({'type':'integer','minimum':1,'maximum':16},16),
                              'min':{'type':'integer','minimum':0,'maximum':64},'max':{'type':'integer','minimum':0,'maximum':64}})}),
        source('client/public_codes.py',22,66,'63ea4a7b5ea26ad70ca8e1254f80e98fbac0dee88bbead51b7904ec2af9bbd57'),
        source('client/technical.py',153,165,'a61a5a69d3529878440be4dec0cfbc2044324220a255a67ee92d78e9f2165fe0'))
    states={'type':'string','enum':['idle','ringing','in_call','unknown']}
    add('media/signal',closed({'station_id':station,'command':{'type':'string','enum':['answer','reject','hangUp']}}),
        closed({'command':{'type':'string','enum':['answer','reject','hangUp']},'acknowledged':{'type':['boolean','null']},
                'physical_result':{'const':'unverified'},'before_state':states,'observed_state':nullable(states),
                'observation':{'type':'string','enum':['unavailable','state_changed','unchanged']},
                'checked_at':{'type':'string','format':'date-time'}}),
        source('client/media.py',132,190,'fa15989e6cb23ea3b35ea93962e9d8de8ad17ca3d0a467783dc539132df14c41'))
    add('health/history',closed({'station_id':station}),closed({'period_days':{'const':7},
        'records':array(closed({'at':{'type':'string','format':'date-time'},'online':boolean,
            'poll_ms':{'type':['number','null'],'minimum':0,'maximum':120000},
            'sync':{'type':'string','enum':['synced','pending','syncing','offline','conflict','error','delete_pending','unknown']},
            'events':text(32)}),2100),'storage_failed':boolean}),
        source('fleet_health.py',37,137,'b0628ee9fe39b6dd532d47eac3835d119d69d22b00e1f1f7cd1232d299acfa94'))
    def validate_schedule(value):
        normalize_schedule({k:value[k] for k in ('name','weekly','holidays')})
    def validate_policy(value):
        try:ZoneInfo(value['timezone'])
        except (ZoneInfoNotFoundError,ValueError):raise Refusal('invalid_fields') from None
        validate_schedule(value['schedule'])
    def schedules_check(value):
        for item in value:validate_schedule(item)
    def hold_check(value):
        try:ZoneInfo(value['timezone'])
        except (ZoneInfoNotFoundError,ValueError):raise Refusal('invalid_fields') from None
        if value['draft'] is not None:validate_policy(value['draft']['policy'])
    def program_check(value):
        try:ZoneInfo(value['timezone'])
        except (ZoneInfoNotFoundError,ValueError):raise Refusal('invalid_fields') from None
        for item in value['programs']+value['saved']:validate_policy(item['policy'])
    def capabilities_check(value):
        if value['card_min']>value['card_max']:raise Refusal('invalid_fields')
    def settings_check(value):
        for key in ['fields','groups']:
            ids=[item['id'] for item in value[key]]
            if len(ids)!=len(set(ids)):raise Refusal('invalid_fields')
            for item in value[key]:
                if not item['label'].strip():raise Refusal('invalid_fields')
                if key=='fields' and any(not option.strip() for option in item['options']):raise Refusal('invalid_fields')
        definitions={item['id']:item for item in value['fields']}
        visited=set();visiting=set()
        def visit(key):
            if key not in definitions or key in visiting:raise Refusal('invalid_fields')
            if key in visited:return
            visiting.add(key);rule=definitions[key]['depends_on']
            if rule is not None:visit(rule['field_id'])
            visiting.remove(key);visited.add(key)
        for key in definitions:visit(key)
    for action,check in [('schedules/list',schedules_check),('stations/technical_hold_get',hold_check),
                         ('stations/technical_program_list',program_check),('cards/reader_capabilities',capabilities_check),
                         ('profiles/settings_get',settings_check)]:
        profiles[action]=replace(profiles[action],output_check=check)
    from .overview_projection import overview_schema
    from .conflict_projection import RESULT as conflict_result
    def overview_check(value):
        policy=value.get('profile_policy')
        if policy is not None:settings_check(policy)
        def zone_check(zone):
            if zone is None:return
            if zone['kind']=='iana':
                try:ZoneInfo(zone['name'])
                except (ZoneInfoNotFoundError,ValueError):raise Refusal('invalid_fields')from None
            elif abs(zone['standard']+zone['delta'])>50400 or(zone['delta']==0 and(zone['start']is not None or zone['end']is not None))or(zone['delta']>0 and(zone['start']is None or zone['end']is None or zone['start']==zone['end'])):raise Refusal('invalid_fields')
        zone_check(value['default_zone'])
        for row in value['stations']:
            zone_check(row['zone'])
            clock=row.get('clock')
            if clock is not None:zone_check(clock['zone']);zone_check(clock['device_zone'])
    profiles['overview']=replace(profiles['overview'],projection=overview_schema(profiles['profiles/settings_get'].projection),
        output_check=overview_check,
        sources=profiles['overview'].sources+(ws(463,600),
            source('clock_runtime.py',68,89,'46d87480adc4c664e3165af65436ac70dfa5d20ded4cdb8b342ca9516dff6d89'),
            source('clock.py',21,78,'01a751fbb67f5ca364a945858dab978b23610f7ecc4efba2ef82171b5bf51771'),
            source('api_contract.py',5,66,'ea460cd23a85d8d9ca7c5ec25d6bb48f8ff04798b43b899dbe33941ca7b313b8')))
    profiles['conflicts/list']=replace(profiles['conflicts/list'],projection=conflict_result,
        sources=profiles['conflicts/list'].sources+(source('access/repository.py',465,532,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb'),))
    for action in ['stations/test_unlock','users/delete','cards/capture_cancel','cards/reader_capabilities',
                   'profiles/versions','profiles/settings_get','schedules/list','media/signal','stations/technical_codes_get','health/history','users/get','stations/technical_hold_get','stations/technical_program_list','tts/engines','tts/start','whatsapp/status','schedules/plan_list','schedules/operations_list','health/get','fleet/alerts','users/query','audit/list','subscribe','authorization/session','sync/status','overview','conflicts/list']:
        profiles[action]=replace(profiles[action],profile_status='CLOSED_LOCAL_FAKE')
    # Connected metadata-only candidates are not whole-action closure of the
    # delivered Arx maps. Their remaining shapes/branches stay explicitly OFF.
    # JSON Schema patterns use search semantics; '$' alone can match before a
    # final newline. Require the actual end in these local anchored patterns.
    def exact_end(value):
        if type(value) is dict:
            if type(value.get('pattern')) is str and value['pattern'].endswith('$'):
                value['pattern']+='(?![\\s\\S])'
            for child in value.values():exact_end(child)
        elif type(value) is list:
            for child in value:exact_end(child)
    for spec in profiles.values():
        exact_end(spec.parameters)
        exact_end(spec.projection)
    return profiles


_PREPARED_PROFILES = None


def _definition_code(value):
    # Only internal public schema definitions enter this preparation step.
    # JSON round-trip preserves the previous scalar/order/list semantics; repr
    # generates a literal expression, never executable schema text. The code
    # contains no request, actor, private value, permission or result state.
    literal=json.loads(json.dumps(value,separators=(',',':')))
    return compile(repr(literal),'<wiskey-public-profile-definition>','eval')


def _prepared_profiles():
    """Immutable public definition preparation only; no runtime source state."""
    global _PREPARED_PROFILES
    if _PREPARED_PROFILES is None:
        # Keep immutable literal code, source refs and pure semantic check code.
        # Every caller evaluates fresh mutable schemas and receives a new spec.
        from .adapters import _definition_text
        _PREPARED_PROFILES={action:(replace(spec,parameters={},projection={}),
            _definition_code(spec.parameters),_definition_code(spec.projection),
            _definition_text(spec.parameters),_definition_text(spec.projection),tuple(spec.projection.get('properties',{})))
            for action,spec in _build_profiles().items()}
    return _PREPARED_PROFILES


def catalog_profile(action):
    entry=_prepared_profiles().get(action)
    if entry is None:return None
    spec,parameters,projection,*_=entry
    return replace(spec,parameters=eval(parameters,{'__builtins__':{}},{}),projection=eval(projection,{'__builtins__':{}},{}))


def _catalogue_construction_binding(action):
    # Immutable public definition metadata only. The constructor still
    # serializes the current caller-owned schemas and checks every owner.
    # No input, action result, permission or validation verdict is retained.
    entry=_prepared_profiles().get(action)
    return None if entry is None else (entry[0],entry[3],entry[4],entry[5])


def _catalogue_definition_copy(action, role):
    """Fresh public literal tree; caller must attest its current definition."""
    if role not in (1, 2):raise ValueError('closed definition role required')
    return eval(_prepared_profiles()[action][role], {'__builtins__': {}}, {})


def catalog_actions():
    """Immutable public names only; no schema object, instance or authority."""
    return tuple(_prepared_profiles())


_UNLOADED=object()


class _DefinitionMap(MutableMapping):
    """Caller-owned public definitions, materialized only when requested.

    A fresh map owns every schema it resolves. Iterating values/items still
    materializes the complete selection for composition/review. No source
    object, authorization, parameter or action result is shared or cached.
    """
    def __init__(self,names):self._items=dict.fromkeys(names,_UNLOADED)
    def __iter__(self):return iter(self._items)
    def __len__(self):return len(self._items)
    def __getitem__(self,name):
        value=self._items[name]
        if value is _UNLOADED:
            value=catalog_profile(name);self._items[name]=value
        return value
    def __setitem__(self,name,value):self._items[name]=value
    def __delitem__(self,name):del self._items[name]
    def copy(self):return dict(self.items())
    def __deepcopy__(self,memo):
        from copy import deepcopy
        result={};memo[id(self)]=result
        for name,value in self.items():result[deepcopy(name,memo)]=deepcopy(value,memo)
        return result


def local_profiles():
    """Independent definitions; no decision, bound input or result is cached."""
    return _DefinitionMap(_prepared_profiles())


def closed_local_profiles():
    """Local fake/source profiles; neither native activation nor HA proof."""
    return _DefinitionMap(action for action,entry in _prepared_profiles().items() if entry[0].profile_status=='CLOSED_LOCAL_FAKE')
