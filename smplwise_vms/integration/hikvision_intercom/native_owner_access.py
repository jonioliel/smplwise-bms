"""Explicit paired-bridge owner delegation beside ordinary HA administration.

This verifies the original current command scope. It never returns, constructs
or edits a User/admin identity, human approval, consent or personal account.
"""

from .access.models import AccessError
from .bridge_command_scope import bridge_authorized


def require_owner(hass, user):
    if bridge_authorized(hass):
        return
    if not user or user.is_active is not True or user.is_admin is not True:
        raise AccessError("unauthorized")
