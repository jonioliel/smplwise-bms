"""Response models of the notice board API (routers/notices.py `router`, `/api/v1/notices...`; CR-NOTICE106 and its follow-ups). Only the
module-gated `router` is modelled here: the routes that answer while the module is off (`open_router`: module state, settings, logos,
news sources) and the login-free TV routes (`display_router`, `page_router`) are not part of this family.

Field order is the order the router builds its dicts in. Documents other modules own pass through as `dict[str, Any]` / `Any`: a board's
`display` (services/notices/model.normalize_display), the TV option defaults, a notice's `audience`, the TV feed of the Settings preview
(services/notices/display.build_feed - the payload the TV itself reads) and the bus-times digest (services/transit/digest.build)."""
from __future__ import annotations

from typing import Any, Literal

from . import WireModel

# routes without a JSON body (pictures)
NO_JSON = frozenset({
    "GET /notices/promo-slides/{slide_id}/image",
    "GET /notices/boards/{board_id}/photo",
    "GET /notices/boards/{board_id}/photo-night",
})

NoticeSeverity = Literal["info", "alert", "critical"]
NoticeState = Literal["draft", "scheduled", "active", "expired", "archived"]


class NoticeTvDefaults(WireModel):
    """The installation defaults of the TV options (TVOPT-295) and of the V2 board options (BOARDV2-297), as typed documents."""
    tv_defaults: dict[str, Any]
    tv2_defaults: dict[str, Any]


class NoticeBoardBrief(WireModel):
    """A board as a notice manager without notices.boards sees it (the compose dialog's chips)."""
    id: str
    name: str
    slug: str
    enabled: bool


class NoticeBoard(WireModel):
    """A board as notices.boards sees it (routers/notices._board_out)."""
    id: str
    name: str
    slug: str
    enabled: bool
    display: dict[str, Any]
    has_token: bool
    has_stored_link: bool
    token_rotated_at: str | None
    last_seen_at: str | None
    item_count: int
    created_at: str
    updated_at: str
    news_unset: bool  # NOTICE-NEWS-EMPTY-2500: the news block is on and no source is chosen (the TV shows no news)
    building_id: str | None = None  # MULTI-BUILDING-HOME-2500 (Q68): the board's building (absent = the whole site)


class NoticeBoardListBrief(WireModel):
    """`GET /notices/boards` for a notice manager without notices.boards: the enabled and disabled boards' names only."""
    boards: list[NoticeBoardBrief]
    full: Literal[False]


class NoticeBoardBuilding(WireModel):
    id: str
    name: str
    is_shared: bool


class NoticeBoardListFull(WireModel):
    """`GET /notices/boards` for notices.boards: every board, the installation's limit and whether boards answer remotely."""
    boards: list[NoticeBoard]
    full: Literal[True]
    max: int
    remote: bool
    # MULTI-BUILDING-HOME-2500 (Q68): the buildings a board can belong to - only on a multi-building site (the switch on, two or more)
    buildings: list[NoticeBoardBuilding] | None = None


class NoticeBoardCreated(WireModel):
    """`POST /notices/boards`: the board and its link token (shown once)."""
    board: NoticeBoard
    token: str


class NoticeBoardNewToken(WireModel):
    """A new link token (rotate / issue-link) and the board after the change."""
    token: str
    board: NoticeBoard


class NoticeBoardOnly(WireModel):
    board: NoticeBoard


class NoticeBoardLink(WireModel):
    token: str


class NoticeBoardItem(WireModel):
    """A notice on a board: the brief fields, its state and its position on the board."""
    id: str
    title: str
    severity: NoticeSeverity
    starts_at: str
    ends_at: str | None
    pinned: bool
    state: NoticeState
    position: int


class NoticeBoardDetail(WireModel):
    board: NoticeBoard
    notices: list[NoticeBoardItem]


class NoticeDeleted(WireModel):
    deleted: Literal[True]


class NoticeBoardItems(WireModel):
    notice_ids: list[str]


class NoticeBoardFeed(WireModel):
    """The Settings preview: the TV's own payload (services/notices/display.build_feed through preview_feed). Every block is the TV
    page's document; the optional blocks appear only when the board shows them and there is something to show."""
    board: dict[str, Any]
    now: str
    notices: list[dict[str, Any]]
    sun: Any = None
    weather: Any = None
    news: Any = None
    info: Any = None
    slides: Any = None
    control: Any = None
    announcement: Any = None
    news_unset: bool = False  # NOTICE-NEWS-EMPTY-2500: the preview only (never the TV's own feed) - news on, no source chosen


class NoticeTransitDigest(WireModel):
    """BUSTIMES-295: the bus-times digest of a board (services/transit/digest.build). `state: off` answers alone; the other keys are the
    digest's own values (the screen settings, the cached rows grouped for the TV)."""
    state: Literal["off", "fresh", "cached", "expired"]
    now: Any = None
    fetched_at: Any = None
    age_s: Any = None
    updated_hm: Any = None
    layout: Any = None
    window_min: Any = None
    rows: Any = None
    dwell_s: Any = None
    clock_after_min: Any = None
    stale_grace_min: Any = None
    refresh_s: Any = None
    fresh_s: Any = None
    position_fresh_s: Any = None
    show_distance: Any = None
    stops: Any = None
    multi: Any = None
    realtime: Any = None
    source_down: Any = None
    partial: Any = None
    items: Any = None
    overflow: Any = None
    grouped: Any = None
    next: Any = None
    columns: Any = None


class NoticeBoardControlLease(WireModel):
    seq: int
    cmd: Literal["next", "prev", "pause", "play"]


class NoticeBoardControl(WireModel):
    control: NoticeBoardControlLease


class NoticeRow(WireModel):
    """A notice (routers/notices._notice_out). `read` only in the list; the manager fields (`audience` .. `push_generation`) only for a
    caller who may manage the notice's audience; `reads` only in the managers' list (`scope=all`)."""
    id: str
    title: str
    severity: NoticeSeverity
    starts_at: str
    ends_at: str | None
    pinned: bool
    body: str
    state: NoticeState
    dwell_s: int | None
    when_text: str | None
    published_at: str | None
    updated_at: str
    boards: list[str]
    read: bool = False
    audience: dict[str, Any] = {}
    status: Literal["draft", "published", "archived"] = "draft"
    created_at: str = ""
    push_requested: bool = False
    pushed_at: str | None = None
    push_generation: int = 0
    reads: int = 0


class NoticesCan(WireModel):
    """What the caller may do in the module (routers/notices._can)."""
    view: bool
    manage: bool
    manage_all: bool
    push: bool
    delete: bool
    boards: bool
    configure: bool


class NoticesDefaults(WireModel):
    default_days: int
    default_severity: Literal["info", "alert"]
    push_default: Literal["by_severity", "always", "never"]
    home_empty: Literal["hide", "line"]
    show_places_tree: bool


class NoticesList(WireModel):
    """`GET /notices?scope=mine|all`: the caller's active notices, or (managers) every notice he may manage with the read counts."""
    notices: list[NoticeRow]
    can: NoticesCan
    now: str
    defaults: NoticesDefaults


class NoticeAudiencePreview(WireModel):
    users: int
    in_scope: bool


class NoticeAudienceFloor(WireModel):
    id: str
    name: str
    building: str


class NoticeAudienceArea(WireModel):
    id: str
    name: str
    floor: str


class NoticeAudienceRef(WireModel):
    id: str
    name: str


class NoticeAudienceOptions(WireModel):
    """The floors, named areas, groups and built-in roles the compose dialog offers (names only)."""
    floors: list[NoticeAudienceFloor]
    areas: list[NoticeAudienceArea]
    groups: list[NoticeAudienceRef]
    roles: list[NoticeAudienceRef]


class NoticePush(WireModel):
    """The push of a publish (services/notices/push.send) or of a manual resend (push.resend, with `generation`); `error` only when the
    notification pipeline failed (`emit_failed`)."""
    requested: bool
    sent: bool
    recipients: int
    generation: int = 0
    error: str = ""


class NoticeOne(WireModel):
    notice: NoticeRow


class NoticeCreated(WireModel):
    """`POST /notices`: the notice, and the push result only when it was published at once."""
    notice: NoticeRow
    push: NoticePush = None


class NoticeWithPush(WireModel):
    notice: NoticeRow
    push: NoticePush


class NoticeRead(WireModel):
    read: Literal[True]


class NoticeReader(WireModel):
    user_id: str
    name: str
    place: str
    read_at: str


class NoticeNonReader(WireModel):
    user_id: str
    name: str
    place: str


class NoticeReads(WireModel):
    """Who read: the two counts, and the names only while the installation shows them (`notices.reads_names`)."""
    audience: int
    read: int
    users: list[NoticeReader] = []
    unread: list[NoticeNonReader] = []


class NoticeSlide(WireModel):
    """A promo slide (services/notices/slides._slide) with the boards that show it."""
    id: str
    title: str
    text: str
    seconds: int | None
    has_image: bool
    stamp: str
    updated_at: str
    boards: list[str]


class NoticeSlideRange(WireModel):
    min: int
    max: int


class NoticeBoardPhoto(WireModel):
    has: bool
    stamp: str


class NoticeSlides(WireModel):
    """The promo slides (all, or one board's in its order); a board's answer adds its building photos (day / night)."""
    slides: list[NoticeSlide]
    limit: int
    seconds: NoticeSlideRange
    photo: NoticeBoardPhoto = None
    photo_night: NoticeBoardPhoto = None


class NoticeSlideCreated(WireModel):
    """`POST /notices/promo-slides`: the new slide's id, then every slide."""
    id: str
    slides: list[NoticeSlide]
    limit: int
    seconds: NoticeSlideRange
