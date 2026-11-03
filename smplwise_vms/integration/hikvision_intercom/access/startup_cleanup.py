"""Retire only original resources acquired by one failed access setup.

This owns cleanup callbacks and exact namespace publications, never execution
authority. A failed cleanup retains this owner and blocks a replacement setup.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, MutableMapping
from dataclasses import dataclass, field
from typing import Any


@dataclass(repr=False)
class AccessStartupCleanup:
    steps: list[tuple[int, Callable[[], Awaitable[None]], bool]] = field(default_factory=list)
    publications: list[tuple[MutableMapping[str, Any], str, Any, bool, Any]] = field(
        default_factory=list
    )
    completed: set[int] = field(default_factory=set)
    failed: bool = False

    def defer(
        self, order: int, close: Callable[[], Awaitable[None]], *, after_join: bool = False
    ) -> None:
        self.steps.append((order, close, after_join))

    def publish(self, namespace: MutableMapping[str, Any], key: str, value: Any) -> None:
        self.publications.append((namespace, key, value, key in namespace, namespace.get(key)))
        namespace[key] = value

    def release(self) -> None:
        """Successful setup transfers resources to its original stop owner."""
        self.steps.clear()
        self.publications.clear()
        self.completed.clear()

    async def close(self) -> None:
        first: BaseException | None = None
        for index, (_, step, after_join) in sorted(
            enumerate(self.steps), key=lambda row: row[1][0]
        ):
            if index in self.completed:
                continue
            if first is not None and after_join:
                # Storage remains owned underneath a cleanup that did not join.
                continue
            try:
                await step()
                self.completed.add(index)
            except BaseException as error:
                self.failed = True
                if first is None:
                    first = error
        # Hide partial setup even on cleanup failure. The private retained owner
        # still holds every original resource; a foreign replacement is untouched.
        for namespace, key, value, existed, previous in reversed(self.publications):
            if key in namespace and namespace[key] is value:
                if existed:
                    namespace[key] = previous
                else:
                    del namespace[key]
        if first is not None:
            raise first
        self.release()
