"""C03 experimental candidate only. No registration or legacy schema mutation."""
from copy import deepcopy

CONTRACT = 'wiskey-arx-c03-status-lookup-proposed.1'
SELECTION = 'wiskey-arx-selection-status-lookup-proposed.1'
SCHEMA_ID = 'urn:wiskey:arx:c03:request:proposed:1'
RESPONSE = 'wiskey-arx-c03-status-response-proposed.1'
PREDICATES = ('target_operation_reference', 'original_operation_id', 'original_request_id',
              'original_operation_binding_ref', 'original_action', 'original_actor_reference',
              'logical_target_id', 'binding_revision')


def closed(properties):
    return {'type': 'object', 'properties': properties, 'required': list(properties),
            'additionalProperties': False}


def request_schema():
    text = {'type': 'string', 'minLength': 1, 'maxLength': 128}
    rev = {'type': 'integer', 'minimum': 0}
    binding = {'type': ['string', 'null'], 'minLength': 1, 'maxLength': 128}
    stamp = {'type': 'string', 'format': 'date-time', 'maxLength': 128}
    selection = {'const': SELECTION}
    definition = closed({
        'contract_version': {'const': CONTRACT}, 'action': {'const': 'operations/status_lookup'},
        'selection_revision': selection, 'request_id': text,
        'actor': closed({'kind': {'const': 'human'}, 'user_id': text}),
        'channel': {'const': 'interactive'},
        'target': closed({'logical_target_id': text, 'binding_revision': binding}),
        'grant': closed({'grant_id': text, 'grant_revision': rev, 'permission_revision': rev,
                         'decision_id': text}),
        'operation_id': text, 'operation_binding_ref': text,
        'issued_at': stamp, 'request_expires_at': stamp,
        'operation': closed({'request_schema_id': {'const': SCHEMA_ID},
                             'request_schema_revision': {'const': 'proposed.1'},
                             'public_descriptor_revision': {'const': 1},
                             'permission_revision': rev, 'selection_revision': selection,
                             'parameter_transport': {'const': 'signed_lookup_predicates'}}),
        'decision': closed({'decision_id': text, 'grant_revision': rev, 'permission_revision': rev,
                            'binding_revision': binding, 'selection_revision': selection,
                            'decided_at': stamp, 'request_id': text, 'operation_id': text,
                            'operation_binding_ref': text, 'request_schema_id': text,
                            'request_schema_revision': text}),
        'predicates': closed({name: binding if name == 'binding_revision' else text for name in PREDICATES}),
    })
    return deepcopy(definition)


def response_schema():
    text = {'type': 'string', 'minLength': 1, 'maxLength': 128}
    return closed({'schema_revision': {'const': RESPONSE}, 'request_id': text, 'operation_id': text,
                   'state': {'enum': ['pending', 'not_found_or_expired']}})
