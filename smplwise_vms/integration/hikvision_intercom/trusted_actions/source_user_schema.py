"""Additive local source-field schema candidate. No classic/DTO/catalog change.

All instances stay in the explicit fake harness. Structural schema is not a
proof of calendar/firmware/resource semantics; original source validators run.
"""
from dataclasses import replace
from .adapters import closed,SourceRef
from .profiles import catalog_profile
from .envelope import thaw,freeze

VERSION='wiskey-local-source-fields.2'

_SOURCE_REFS=(
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/validity_transport.py',15,53,'265711e65c4fe6cce07427c0b9da6e8bc63af016570ca29bbf0be855660e3902'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/clock.py',21,169,'01a751fbb67f5ca364a945858dab978b23610f7ecc4efba2ef82171b5bf51771'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/repository.py',541,562,'d00c51b19f5c8ef3a7ebcca74755a9662290eb2424108162e3b3938c401a2afb'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/group_permissions.py',10,19,'d17e94bff780bc188ba3aec053db852c476ac325d3a6a7375bc9d87b906817f4'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/group_permissions.py',22,28,'d17e94bff780bc188ba3aec053db852c476ac325d3a6a7375bc9d87b906817f4'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/group_permissions.py',31,106,'d17e94bff780bc188ba3aec053db852c476ac325d3a6a7375bc9d87b906817f4'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/profile_settings.py',126,131,'af122f60dabdac5f07c25406ac837637fbd93184e5beaa0149a36fd39895e234'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/profile_settings.py',134,153,'af122f60dabdac5f07c25406ac837637fbd93184e5beaa0149a36fd39895e234'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/profile_settings.py',156,173,'af122f60dabdac5f07c25406ac837637fbd93184e5beaa0149a36fd39895e234'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/profile_conditions.py',15,82,'ea8181df7e9c821ece6a2027e63cd9b4913433458cadd872ca22a2cd9be6a58f'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/profile_uniqueness.py',13,46,'6fd28b1984c2b326015c8a87289e6d333aa493f35ba5ddd41b2799a17b0ac24e'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/profile_settings.py',176,182,'af122f60dabdac5f07c25406ac837637fbd93184e5beaa0149a36fd39895e234'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/user_timing.py',13,59,'691bd15b9edbda047e7662762155eafff57a3658b152d98e4fee2b9743f44a9b'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/timing_policy.py',13,37,'f4eff9c6fdfbb97c75111498656409afb2ac27035be7771c681b2fe2c018c5a4'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/schedules.py',56,62,'b74b51083974f6c988a569389eab1905e3a871debdb8417cc3e57195d8ddcb44'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/schedules.py',65,82,'b74b51083974f6c988a569389eab1905e3a871debdb8417cc3e57195d8ddcb44'),
    SourceRef('3ceae6d0e4c35e27e938be4c6e1f74f50152f873','custom_components/hikvision_intercom/access/schedules.py',85,94,'b74b51083974f6c988a569389eab1905e3a871debdb8417cc3e57195d8ddcb44'),
)

def typed_map(value,limit=100,*,identifier=False):
    keys={'type':'string','minLength':1,'maxLength':64}
    if identifier:keys={'type':'string','pattern':'^[a-z][a-z0-9_]{0,47}$(?![\\s\\S])','maxLength':48}
    return {'type':'object','maxProperties':limit,'propertyNames':keys,'additionalProperties':value}

def timing_schema():
    def variant(mode):
        # Construct each public definition independently. No caller-owned
        # schema, source instance, decision or previous validation is reused.
        day={'enum':['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']}
        clock={'type':'string','pattern':'^(?:[01][0-9]|2[0-3]):[0-5][0-9]$(?![\\s\\S])'}
        end={'type':'string','pattern':'^(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00)$(?![\\s\\S])'}
        value=closed({'mode':{'const':mode},'timezone':{'type':'string','minLength':1,'maxLength':128},
            'days':{'type':'array','items':day,'maxItems':7,'uniqueItems':True},
            'dates':{'type':'array','items':{'type':'string','pattern':'^20(?:[0-2][0-9]|3[0-7])-[0-9]{2}-[0-9]{2}$(?![\\s\\S])'},'maxItems':64,'uniqueItems':True},
            'periods':{'type':'array','items':closed({'start':clock,'end':end}),'minItems':1,'maxItems':8}})
        if mode=='weekly':
            value['properties']['days']['minItems']=1;value['properties']['dates']['maxItems']=0
        else:
            value['properties']['days']['maxItems']=0;value['properties']['dates']['minItems']=1
        return value
    return {'oneOf':[variant('weekly'),variant('dates')]}


def public_data(action,*,include_policy=True):
    props=thaw(freeze(catalog_profile(action).parameters['properties']['data']['properties']))
    if type(include_policy)is not bool:raise ValueError('explicit source definition variant required')
    if include_policy:
        slot={'type':'integer','minimum':1,'maximum':65535}
        bindings=closed({'template':{'type':'integer','minimum':1,'maximum':65532},'weekly':{'type':'integer','minimum':1,'maximum':65532},'holiday_group':{'type':['integer','null'],'minimum':1,'maximum':65535},'holidays':{'type':'array','items':slot,'uniqueItems':True,'maxItems':64}})
        ha=closed({'mode':{'const':'ha'},'schedule':timing_schema(),'bindings':closed({})})
        native=closed({'mode':{'const':'native'},'schedule':timing_schema(),'bindings':typed_map(bindings)})
        policy={'oneOf':[{'oneOf':[ha,native]},{'type':'null'}]}
    else:policy={'type':'null'}

    props.update(access_category={'enum':['staff','visitor','contractor']},
        permission_overrides=typed_map({'enum':['allow','deny']}),
        door_permissions=typed_map({'type':'array','items':{'enum':[1,2]},'uniqueItems':True,'minItems':1,'maxItems':2}),
        access_policy_revision={'type':'integer','minimum':0},
        profile=typed_map({'type':'string','maxLength':100},12,identifier=True),
        access_timing_draft={'oneOf':[timing_schema(),{'type':'null'}]},
        access_timing_policy=policy)
    result=closed(props,['display_name'] if action=='users/create' else [])
    if action=='users/update':result['minProperties']=1
    return result

def parameters(action,*,include_policy=True):
    if action not in {'users/create','users/update'}:return catalog_profile(action).parameters
    original=thaw(freeze(catalog_profile(action).parameters));original['properties']['data']=public_data(action,include_policy=include_policy)
    return original

def _source_spec_base(action):
    base=catalog_profile(action)
    return replace(base,sources=(*base.sources,*_SOURCE_REFS))

def extended_spec(action,*,fake_directory=None):
    import tempfile
    from pathlib import Path
    status='PARTIAL_OFF'
    if fake_directory is not None:
        if type(fake_directory) is not tempfile.TemporaryDirectory or not Path(fake_directory.name).is_dir():raise ValueError('explicit TEMP fake scope required')
        status='CLOSED_LOCAL_FAKE'
    base=_source_spec_base(action)
    definition=parameters(action,include_policy=False)
    # Neither HA/native timing worker branch is closed by a schema parse.
    return replace(base,parameters=definition,schema_id='urn:wiskey:local-source-fields:'+action.replace('/',':'),schema_revision='2',profile_status=status)


def private_patch_spec(action, *, fake_directory=None):
    """Additive OFF local revision, never a change to rev1/rev2 or Arx wire.

    The receiver must require an admitted, nonempty private frame. Empty data
    is not a standalone write, permission, transport or fallback mechanism.
    """
    if action!='users/update':raise ValueError('private update candidate only')
    base=extended_spec(action, fake_directory=fake_directory)
    base.parameters['properties']['data']['minProperties']=0
    return replace(base, schema_id='urn:wiskey:local-private-patch:users:update', schema_revision='3')
