"""Response models of the notifications API (routers/notifications.py: `/api/v1/notifications...` for every signed-in user, `/notify/...`
for `notify.manage`; CR-018, docs/architecture/NOTIFICATIONS_API.md section 2). Field order is the order services/notify (`serialize`,
`list_for`, `summary`, `center_state`), services/notify_settings (`load`), services/notify_policy (`row_to_policy`, `default_row`) and
the router's `_delivery` / `_policy_view` build their dicts in. A ticket digest's ticket list (services/tickets/notify_matrix) and the
push worker's counters pass through as built."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from . import WireModel

# routes without a JSON body
NO_JSON = frozenset({"GET /notifications/{nid}/snapshot"})

Severity = Literal["info", "alert", "critical"]
DeliveryStatus = Literal["queued", "sent", "retry", "failed", "gone", "skipped"]


class NotificationSubject(WireModel):
    kind: str
    id: str | None
    area_id: str | None


class NotificationMe(WireModel):
    """The only per-user state of a row."""
    read_at: str | None
    snoozed_until: str | None


class NotificationDoor(WireModel):
    """A doorbell row's deep-link target of "open door": never a token, never an action."""
    id: str
    name: str
    can_open: bool


class NotificationTimelineEntry(WireModel):
    """One row of notification_events; the optional keys only when the event row has them."""
    at: str
    kind: str
    step: int = 0
    count: int = 0
    by_display: str = ""
    channel: str = ""


class NotificationOwnDelivery(WireModel):
    """One of the caller's own delivery rows of this notification."""
    channel: str
    status: DeliveryStatus
    reason: str | None
    at: str


class Notification(WireModel):
    """One inbox row (services/notify.serialize), re-checked against the caller's current visibility."""
    id: str
    source: str
    category: str
    severity: Severity
    title: str
    body: str
    place_name: str | None
    subject: NotificationSubject
    link: str
    count: int
    first_at: str
    last_at: str
    state: Literal["open", "acknowledged", "resolved"]
    acked_at: str | None
    acked_by_display: str | None
    resolved_at: str | None
    me: NotificationMe
    can_ack: bool
    has_snapshot: bool
    door: NotificationDoor | None
    timeline: list[NotificationTimelineEntry]
    my_deliveries: list[NotificationOwnDelivery]
    digest: dict[str, Any] = {}
    """Only on a `ticket.digest` row: {total, hidden, items: [{ticket_id, number, title, event, event_label}]} rendered for this reader."""


class NotificationPage(WireModel):
    """`GET /notifications`: newest first, open critical safety rows pinned on top."""
    notifications: list[Notification]
    next_before: str | None
    """The cursor of the next page (the `last_at` of the last row), null on the last page."""


class NotificationCounts(WireModel):
    """services/notify.summary: visible rows only; a snoozed row is not unread until its time."""
    unread: int
    open_critical: int
    by_category: dict[str, int]


class NotificationSummary(NotificationCounts):
    """`GET /notifications/summary`: the counts plus what the center needs from the installation's settings."""
    center_layout: Literal["sheet", "page"]
    quiet_active: bool
    quiet_until: str | None


class NotificationsReadAll(WireModel):
    """`POST /notifications/read-all`: rows marked, then the fresh counts."""
    marked: int
    unread: int
    open_critical: int
    by_category: dict[str, int]


class NotifyDelivery(WireModel):
    """One delivery row (routers/notifications._delivery): the target is a push host or a masked address, never an endpoint or an address."""
    id: str
    notification_id: str
    title: str
    source: str
    channel: str
    target: str
    status: DeliveryStatus
    reason: str | None
    attempt: int
    at: str
    mode: str
    user_display: str
    """'' in the caller's own list."""


class NotifyDeliveryList(WireModel):
    deliveries: list[NotifyDelivery]


class PushTestResult(WireModel):
    """One registered device of the caller (services/notify_channels.send_test)."""
    id: str
    endpoint_host: str
    status: int
    outcome: str


class PushTestAnswer(WireModel):
    """`POST /notifications/test`."""
    results: list[PushTestResult]
    sent: int


class PushActionAnswer(WireModel):
    """`POST /notifications/action`: a push button's single-use token redeemed."""
    ok: bool
    result: str
    notification_id: str


class QuietHours(WireModel):
    enabled: bool
    from_: str = Field(alias="from")
    to: str
    days: list[str]


class PassThroughRow(WireModel):
    webpush: bool
    email: bool
    ha_mobile: bool
    whatsapp: bool


class PassThrough(WireModel):
    """What is still sent during quiet hours, per severity."""
    info: PassThroughRow
    alert: PassThroughRow
    critical: PassThroughRow


class EscalationSettings(WireModel):
    enabled: bool
    after_min: int
    steps: int
    to: str | list[str]
    """"managers", or named user ids."""


class CompanionSettings(WireModel):
    critical_sound_safety: bool
    critical_sound_types: dict[str, bool]
    resolved_tone: bool


class EmailLastTest(WireModel):
    at: str
    ok: bool
    detail: str


class EmailSettings(WireModel):
    """The outgoing-mail block: never the password (`password_set`)."""
    configured: bool
    host: str
    port: int
    security: Literal["starttls", "tls", "none"]
    user: str
    password_set: bool
    from_: str = Field(alias="from")
    recipients: list[str]
    last_test: EmailLastTest | None


class EmailSettingsView(EmailSettings):
    """`GET / PUT /notify/email`: the block plus the optional link base of the mails."""
    link_base: str


class NotifySettings(WireModel):
    """`GET / PUT /notify/settings` (services/notify_settings.load)."""
    quiet: QuietHours
    pass_through: PassThrough
    escalation: EscalationSettings
    lockscreen: str
    image_in_push: bool
    companion: CompanionSettings
    retention_days: int
    deliveries_retention_days: int
    center_layout: Literal["sheet", "page"]
    failures_audience: Literal["admins", "visible"]
    email: EmailSettings
    revision: int
    updated_at: str | None


class PolicyRecipients(WireModel):
    rule: str
    user_ids: list[str] = []
    """With the `users` rule (or stored ids)."""
    locked_by: str = ""
    """`failures_audience` on the two failure sources whose recipients that setting decides."""


class PolicyChannels(WireModel):
    inbox: bool
    webpush: bool
    email: bool
    app: bool
    announce: bool
    ha_mobile: bool
    whatsapp: bool


class NotifyPolicy(WireModel):
    """One source's policy as the settings tab shows it (routers/notifications._policy_view)."""
    source: str
    enabled: bool
    severity: Severity
    category: str
    after_s: int
    dedupe_window_s: int
    resolve_notice: bool
    recipients: PolicyRecipients
    channels: PolicyChannels
    revision: int
    label: str
    subject_kind: str
    resolves: bool


class NotifyPolicyList(WireModel):
    """`GET /notify/policies`: the catalogue's order; a module's sources only while it is on."""
    policies: list[NotifyPolicy]
    categories: list[str]
    severities: list[str]
    recipient_rules: list[str]


class EmailTestAnswer(WireModel):
    """`POST /notify/email/test`: `detail` is `ok` or the failure class, never a server text."""
    ok: bool
    detail: str
    message: str
    delivered: int
    total: int


class ChannelCounts(WireModel):
    sent: int
    failed: int
    skipped: dict[str, int]


class AppRelayHealth(WireModel):
    """services/mobile_push.relay_health: never the URL or the key."""
    configured: bool
    state: str
    code: str | None
    message: str | None
    config_errors_in_a_row: int
    last_config_error_at: str | None
    last_config_error_status: int | None
    backoff_seconds_left: int
    last_ok_at: str | None


class AppUnifiedPushHealth(WireModel):
    """services/unifiedpush.health (ANDROID-PUSH-2550): never a host name, an endpoint or a key."""
    enabled: bool
    state: str
    message: str | None
    servers: int
    invalid_entries: int
    sent: int
    failed: int
    gone: int
    last_error: str | None
    last_sent_at: str | None


class NotifyStats(WireModel):
    """`GET /notify/stats`: the last 24 hours per channel, the push worker's counters, the volume per source, the push devices."""
    since: str
    channels: dict[str, ChannelCounts]
    worker: dict[str, int]
    by_source: dict[str, int]
    push_devices: int
    app_relay: AppRelayHealth
    app_unifiedpush: AppUnifiedPushHealth | None = None  # ANDROID-PUSH-2550 (additive)
