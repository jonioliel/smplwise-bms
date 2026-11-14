"""Data-only native candidate copy; exact builtin graph semantics, no serializer.

Schema16 keeps its original deepcopy calls. A schema17 candidate can copy plain
dict/list/str/int/bool/None graphs with less generic dispatch. Any unsupported
type/key anywhere discards the tentative copy and invokes ONE full original
deepcopy, preserving cross-branch aliases and custom behavior. This helper
neither validates storage nor creates/caches authority.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any


class _OriginalCopyRequired(Exception):
    pass


def copy_image(value: Any) -> Any:
    memo: dict[int, Any] = {}

    def clone(item: Any) -> Any:
        kind = type(item)
        if item is None or kind is str or kind is int or kind is bool:
            return item
        if kind is not dict and kind is not list:
            raise _OriginalCopyRequired
        identity = id(item)
        previous = memo.get(identity)
        if previous is not None:
            return previous
        result: Any = {} if kind is dict else []
        memo[identity] = result
        if kind is dict:
            for key, child in item.items():
                if type(key) is not str:
                    raise _OriginalCopyRequired
                child_kind = type(child)
                result[key] = (
                    child
                    if child is None or child_kind is str or child_kind is int or child_kind is bool
                    else clone(child)
                )
        else:
            for child in item:
                child_kind = type(child)
                result.append(
                    child
                    if child is None or child_kind is str or child_kind is int or child_kind is bool
                    else clone(child)
                )
        return result

    try:
        return clone(value)
    except (_OriginalCopyRequired, RecursionError):
        # No user method ran in the tentative exact-builtin traversal. Do not
        # mix copied prefixes with fallback branches: one fresh original memo
        # owns the complete fallback graph and all its custom semantics.
        return deepcopy(value)
