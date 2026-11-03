"""Fresh source configuration revision only; no role or policy calculation.

The injected original repository owns configuration updates. Only its nullable
revision token is observed, never settings values, names, private fields or a
body fingerprint. This is software consistency, not Arx authorization.
"""
from .validation import Refusal


class SourceConfigurationRevision:
    def __init__(self,repository):
        if repository is None:raise ValueError('explicit source repository required')
        self.repository=repository;self._owner=repository

    def current(self):
        repository=self.repository
        if repository is not self._owner:raise Refusal('binding_denied')
        state=repository._state
        if type(state) is not dict or 'profile_settings' not in state:raise Refusal('binding_denied')
        settings=state['profile_settings']
        if settings is None:revision=None
        elif type(settings) is dict and type(settings.get('revision')) is int and settings['revision']>=0:revision=settings['revision']
        else:raise Refusal('binding_denied')
        if self.repository is not repository or repository._state is not state or state['profile_settings'] is not settings:raise Refusal('binding_denied')
        return revision
