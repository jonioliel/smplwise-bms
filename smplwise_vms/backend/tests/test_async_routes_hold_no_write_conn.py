"""CR-UPLOAD-SYNC-2436 (code review 05:P1-05, 03:F05): an `async def` route runs on the event loop, so one that holds the
request's write connection (`get_conn`: BEGIN IMMEDIATE, SQLite's single write lock) does its SQL, file and image work on
the loop thread - every WebSocket, `/healthz` and every other request waits meanwhile, and `db.unlocked` must never be
used there (its own docstring). Such a route is a plain `def` (FastAPI runs it in the thread pool) or does not depend
on the write connection at all.

The second guard covers the GET routes of the seven upload routers converted by this branch: a GET reads on the read
connection unless it is listed here with the write it makes."""
from __future__ import annotations

import inspect
from typing import Callable

from fastapi.routing import APIRoute

from smplwise import auth

# GETs in the seven routers that write and so stay on the write connection (each with the write it makes)
GET_WRITERS = {
    ("wall", "/wall/config"): "wall.touch_seen records the display's last contact",
    ("notices", "/notices/boards/{board_id}/link"): "audit row notices.board.link_read (an administrator read of the TV link)",
}
# async routes on get_conn outside this branch's files, each with the branch that owns its fix (remove on that merge)
ASYNC_WRITERS_ALLOWED = {
    ("tickets_links", "POST", "/tickets/address/probe"): "tickets area (01); not in CR-UPLOAD-SYNC-2436's file list",
}
UPLOAD_MODULES = {"skins", "floor_images", "plan_bakes", "wall", "notices", "home_interface", "home_v3"}


def _calls(dep) -> list[Callable]:
    out: list[Callable] = []
    for sub in dep.dependencies:
        out.append(sub.call)
        out.extend(_calls(sub))
    return out


def _api_routes() -> list[tuple[str, APIRoute]]:
    from test_plan_routes_unique import _routers

    return [(name, r) for name, router in _routers().items() for r in router.routes if isinstance(r, APIRoute)]


def test_no_async_route_depends_on_the_write_connection():
    offenders: list[str] = []
    allowed_seen: set[tuple[str, str, str]] = set()
    for name, r in _api_routes():
        if not (inspect.iscoroutinefunction(r.endpoint) and auth.get_conn in _calls(r.dependant)):
            continue
        module = r.endpoint.__module__.rsplit(".", 1)[-1]
        hits = {(module, m, r.path) for m in r.methods} & set(ASYNC_WRITERS_ALLOWED)
        if hits:
            allowed_seen |= hits
            continue
        offenders.append(f"{name}: {sorted(r.methods)} {r.path} ({r.endpoint.__name__})")
    assert sorted(offenders) == [], "async def routes on get_conn (make them plain def):\n" + "\n".join(sorted(offenders))
    assert allowed_seen == set(ASYNC_WRITERS_ALLOWED), "an allowed route was fixed or moved: drop it from ASYNC_WRITERS_ALLOWED"


def test_the_ten_upload_handlers_are_plain_functions():
    from smplwise.routers import floor_images, home_interface, home_v3, notices, plan_bakes, skins, wall

    handlers = [skins.upload_control_image, floor_images.upload_floor_image, plan_bakes.upload_bake, wall.photo_upload, notices.put_logo,
                notices.put_news_logo, notices.put_slide_image, notices.put_board_photo, home_interface.put_wallpaper,
                home_v3.put_room_wallpaper_image]
    assert [h.__name__ for h in handlers if inspect.iscoroutinefunction(h)] == []


def test_the_upload_routers_gets_read_on_the_read_connection():
    seen_writers: set[tuple[str, str]] = set()
    offenders: list[str] = []
    for _name, r in _api_routes():
        module = r.endpoint.__module__.rsplit(".", 1)[-1]
        if module not in UPLOAD_MODULES or "GET" not in r.methods:
            continue
        calls = _calls(r.dependant)
        if auth.get_conn not in calls:
            continue
        if (module, r.path) in GET_WRITERS:
            seen_writers.add((module, r.path))
            continue
        offenders.append(f"{module}: GET {r.path} ({r.endpoint.__name__})")
    assert offenders == [], "GET routes still on get_conn:\n" + "\n".join(sorted(offenders))
    assert seen_writers == set(GET_WRITERS), "a listed writer moved: drop it from GET_WRITERS"
