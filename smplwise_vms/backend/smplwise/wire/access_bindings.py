"""Response models of the role bindings (routers/access_bindings.py: `/api/v1/access/bindings`). A binding is
services/rbac_admin._binding_dict, the shape the groups API already models (wire/access_groups.AccessGroupBinding)."""
from __future__ import annotations

from . import WireModel
from .access_groups import AccessGroupBinding

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()


class BindingList(WireModel):
    """The active bindings (a delegated administrator: the ones inside their reach) and the permission revision."""
    bindings: list[AccessGroupBinding]
    revision: int


class BindingCreated(AccessGroupBinding):
    """`POST /access/bindings`: the new binding (`via_group` null) and the permission revision after the change."""
    revision: int


class BindingRevoked(WireModel):
    revoked: str
    revision: int
