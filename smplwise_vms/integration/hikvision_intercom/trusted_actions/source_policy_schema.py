"""Additive OFF local candidate for explicit HA/native source worker proofs.

Revision 2 remains null-policy-only. No DTO, Arx contract, classic command or
runtime catalogue is changed by this review candidate.
"""
from dataclasses import replace
from pathlib import Path
import tempfile
from .source_user_schema import parameters, _source_spec_base
from .source_policy_refs import SOURCE_POLICY_REFS

VERSION = 'wiskey-local-source-policy.3'


def policy_spec(action, *, fake_directory=None):
    if action not in {'users/create', 'users/update'}: raise ValueError('source mutation policy only')
    status = 'PARTIAL_OFF'
    if fake_directory is not None:
        if type(fake_directory) is not tempfile.TemporaryDirectory or not Path(fake_directory.name).is_dir() or Path(fake_directory.name).is_symlink():
            raise ValueError('explicit TEMP fake scope required')
        status = 'CLOSED_LOCAL_FAKE'
    # Inherit the exact source references directly; building and discarding
    # the separate null-policy definition would add no construction check.
    base = _source_spec_base(action)
    return replace(base, parameters=parameters(action),sources=(*base.sources,*SOURCE_POLICY_REFS), schema_id='urn:wiskey:local-source-policy:' + action.replace('/', ':'), schema_revision='3', profile_status=status)
