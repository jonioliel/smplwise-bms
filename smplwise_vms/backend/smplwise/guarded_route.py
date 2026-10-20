"""A FastAPI route class that runs a guard BEFORE the request body is read or validated (SECFIX2-295, review finding PUB-07).

FastAPI decodes and validates a Pydantic body parameter before the endpoint runs - and so before any check the endpoint makes first. On a
public route that must look absent in some context (the local-identity sign-in routes answer 404 on the local channel), a malformed body
then answers the 422 validation envelope instead: the route is seen to exist. `guarded(guard)` returns an APIRoute subclass whose
request handler calls `guard(request)` first; anything the guard raises (an ApiError) is answered by the app's exception handlers exactly
as when the endpoint raised it, and only a request the guard lets through reaches FastAPI's body parsing, its 422 and the endpoint.

Use: `@guarded_route.post(router, _public_guard, "/path")` in place of `@router.post("/path")` (the route keeps its signature, its
OpenAPI body schema and its place in `router.routes`; only its class changes). The endpoint must NOT run the guard again (one switch read per request). The guard is looked up on the class at request time
(`type(route).guard`), so a test can observe it; it is a plain synchronous callable (it may read the database - the same cost as when the
endpoint called it first)."""
from __future__ import annotations

from typing import Any, Callable, ClassVar, Coroutine

from fastapi import APIRouter, Request, Response
from fastapi.routing import APIRoute

Guard = Callable[[Request], None]


class GuardFirstRoute(APIRoute):
    """Base class: `guard` is set by `guarded()`; a subclass without one is refused at definition time of the route."""

    guard: ClassVar[Guard]

    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        inner = super().get_route_handler()
        cls = type(self)
        if getattr(cls, "guard", None) is None:  # pragma: no cover - a programming error, never a request path
            raise TypeError(f"{cls.__name__} has no guard")

        async def guarded_handler(request: Request) -> Response:
            cls.guard(request)  # raises the guard's refusal before a single body byte is read
            return await inner(request)

        return guarded_handler


def guarded(guard: Guard) -> type[GuardFirstRoute]:
    """A route class that runs `guard` before the body. One class per guard (the routers sharing a guard share the class)."""
    cached = _CLASSES.get(guard)
    if cached is not None:
        return cached
    cls = type(f"GuardFirstRoute_{getattr(guard, '__name__', 'guard')}", (GuardFirstRoute,), {"guard": staticmethod(guard)})
    _CLASSES[guard] = cls
    return cls


_CLASSES: dict[Guard, type[GuardFirstRoute]] = {}


def post(router: APIRouter, guard: Guard, path: str, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """`@router.post(path, **kwargs)` with the guard-first route class for this one route (the router's other routes keep theirs). The
    route stays in `router.routes` itself (no sub-router), so an inventory of the router sees it and its class."""
    cls = guarded(guard)

    def decorator(endpoint: Callable[..., Any]) -> Callable[..., Any]:
        router.add_api_route(path, endpoint, methods=["POST"], route_class_override=cls, **kwargs)
        return endpoint

    return decorator
