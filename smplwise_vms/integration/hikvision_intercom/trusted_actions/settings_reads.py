"""OFF selected profile configuration read, before the original public getter.

Only declared public configuration fields reach that getter. No person,
credential, whole-repository serializer, transport, role policy or write runs.
Every call owns a fresh projection and rereads its current source bindings.
"""
from .adapters import EngineContext,project_selected
from .envelope import freeze,thaw
from .jobs import same_parameters
from .source_bindings import same_ports
from .validation import Refusal,Schema


class ProfileSettingsRead:
    def __init__(self,*,current_record,public_transform):
        if not callable(current_record) or not callable(public_transform):raise ValueError('explicit current configuration and original public getter required')
        from .profiles import catalog_profile
        self.record,self.public=current_record,public_transform
        self._definition=freeze(catalog_profile('profiles/settings_get').projection)

    async def read(self,params,context):
        if type(context)is not EngineContext or context.request.get('action')!='profiles/settings_get' or not same_parameters(params,{}) or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        ports=(self.record,self.public,self._definition);read,public,definition=ports
        schema=Schema(thaw(definition));fields=tuple(k for k in schema.definition['properties'] if k!='revision')
        def current():
            context.check()
            if not same_ports(ports,(self.record,self.public,self._definition)):raise Refusal('binding_denied')
        def selected(record):
            if type(record)is not dict or type(record.get('values'))is not dict:raise Refusal('binding_denied')
            values=record['values']
            result=project_selected({'revision':record['revision'],**{field:values[field] for field in fields}},schema.definition)
            schema(result);return result
        current();record=read(context.request);current();values=record.get('values') if type(record)is dict else None
        prepared=selected(record);vector=freeze(prepared)
        # The original public getter sees a detached, approved configuration
        # snapshot. Unknown or private adjacent fields never reach deepcopy.
        detached={'revision':prepared['revision'],'values':{field:prepared[field] for field in fields}}
        result=public(detached);current()
        if read(context.request)is not record or record['values']is not values or not same_parameters(selected(record),vector):raise Refusal('binding_denied')
        result=project_selected(result,schema.definition);schema(result)
        if not same_parameters(result,vector):raise Refusal('binding_denied')
        current();return result


class ProfileVersionsRead:
    """Selected history metadata; actors and unselected values never enter query.

    The original listing/rows functions receive only approved configuration
    snapshots and an explicit null actor placeholder, not the source actor.
    This is read-only metadata, not a settings writer or device result.
    """
    def __init__(self,*,current_record,source_query):
        if not callable(current_record) or not callable(source_query):raise ValueError('explicit configuration history and original listing required')
        from .profiles import catalog_profile
        self.record,self.query=current_record,source_query
        self._request=freeze(catalog_profile('profiles/versions').parameters)
        self._result=freeze(catalog_profile('profiles/versions').projection)
        self._settings=freeze(catalog_profile('profiles/settings_get').projection)

    def _selected(self,record):
        if type(record)is not dict or type(record.get('versions'))is not list or not 1<=len(record['versions'])<=50:raise Refusal('binding_denied')
        setting_schema=Schema(thaw(self._settings));result_schema=Schema(thaw(self._result))
        fields=tuple(k for k in setting_schema.definition['properties']if k!='revision')
        row_schema=Schema({**result_schema.definition['properties']['records']['items'],
            'properties':{k:v for k,v in result_schema.definition['properties']['records']['items']['properties'].items()if k not in {'field_changes','group_changes'}},
            'required':['revision','saved_at','action','origin']})
        owners=[record,record.get('values'),record['versions']]
        def settings(item):
            if type(item)is not dict or type(item.get('values'))is not dict:raise Refusal('binding_denied')
            value=project_selected({'revision':item['revision'],**{field:item['values'][field]for field in fields}},setting_schema.definition)
            setting_schema(value);return {field:value[field]for field in fields}
        output={'revision':record['revision'],'values':settings(record),'versions':[]}
        Schema({'type':'integer','minimum':0})(output['revision'])
        for raw in record['versions']:
            if type(raw)is not dict:raise Refusal('binding_denied')
            metadata={field:raw[field]for field in ('revision','saved_at','action','origin')};row_schema(metadata)
            row={**metadata,'values':settings(raw),'actor':None};output['versions'].append(row)
            owners.extend((raw,raw['values']))
        if len({row['revision']for row in output['versions']})!=len(output['versions']):raise Refusal('binding_denied')
        return output,tuple(owners)

    async def read(self,params,context):
        from .source_bindings import same_identities
        if type(context)is not EngineContext or context.request.get('action')!='profiles/versions'or not same_parameters(params,context.parameters):raise Refusal('binding_denied')
        Schema(thaw(self._request))(thaw(params));ports=(self.record,self.query,self._request,self._result,self._settings)
        read,query,*_=ports
        def current():
            context.check()
            if not same_ports(ports,(self.record,self.query,self._request,self._result,self._settings)):raise Refusal('binding_denied')
        current();record=read(context.request);current();prepared,owners=self._selected(record);vector=freeze(prepared)
        result=query(prepared,params['offset'],params['limit']);current()
        if read(context.request)is not record or not same_parameters(prepared,vector):raise Refusal('binding_denied')
        fresh,fresh_owners=self._selected(record)
        if not same_identities(owners,fresh_owners)or not same_parameters(fresh,vector):raise Refusal('binding_denied')
        schema=Schema(thaw(self._result));result=project_selected(result,schema.definition);schema(result)
        if result['current_revision']!=prepared['revision']or result['total']!=len(prepared['versions'])or result['offset']!=params['offset']or len(result['records'])>params['limit']:raise Refusal('binding_denied')
        allowed={row['revision']:{field:row[field]for field in ('revision','saved_at','action','origin')}for row in prepared['versions']}
        if len({row['revision']for row in result['records']})!=len(result['records']):raise Refusal('binding_denied')
        for row in result['records']:
            if row['revision']not in allowed or not same_parameters({field:row[field]for field in ('revision','saved_at','action','origin')},allowed[row['revision']]):raise Refusal('binding_denied')
        current();return result
