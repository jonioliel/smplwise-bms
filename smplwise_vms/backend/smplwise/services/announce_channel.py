"""ANN2: the `announce` notification channel - a notification the administrator's policy routes to a speaker is SPOKEN in a room.

It plugs into the same channel interface as the phone app (services/mobile_push.py, CR-027): the source policy switches the channel on
(`channels.announce`), the planner (READ phase, no I/O) decides, and `send` runs on the notifier thread outside every lock. Everything else
is the announcements service's: the master switch and the engine, the allowed speakers, the text rules, the per-minute limit and the
per-speaker cooldown, the volume and pause-music handling, the quiet hours, and one `announcements` row + one `media.announce` audit row per
attempt (source `notification`, linked to the notification). Nothing is on by default: the policy channel is off, `announce.notify.enabled`
is off, and the target (a room or a speaker) must be named by the administrator.

ROUTING (`announce.notify`): `categories` (empty = every category) and `min_severity` pick which notifications of the policy are spoken;
the target is one room or one speaker (`scope` + `ref`) - never derived from the notification. A notification is spoken when it is NEW or
ESCALATES (a renotify or a resolve notice is never spoken). The spoken text follows the administrator's lock-screen level like a push does:
`generic` says only that there is a new notification, anything else the title and the place. A critical notification, and an escalation,
bypass the announcement quiet hours (the same rule the notification centre applies to its own quiet hours).
"""
from __future__ import annotations

import logging
from typing import Any

from ..db import unlocked
from . import announcements as ann
from . import notify_channels as nc
from . import push
from .notify_policy import SEVERITY_RANK

log = logging.getLogger("smplwise.announce")

CHANNEL = "announce"
GENERIC = {"he": "התראה חדשה", "en": "New notification"}


def spoken_text(d: nc.Dispatch, language: str) -> str:
    if d.settings.get("lockscreen") == "generic":
        return GENERIC["en" if language.lower().startswith("en") else "he"]
    n = d.n
    place = n.get("place")
    return f"{n['title']}, {place}" if place and place not in n["title"] else str(n["title"])


class AnnounceChannel(nc.Channel):
    name = CHANNEL

    def plan(self, d: nc.Dispatch, conn: Any) -> list[nc.Target]:
        if d.mode not in ("new", "escalate"):
            return []
        cfg = ann.config(conn)
        route = cfg["notify"]
        ref = f"announce:{route['scope']}"
        if not route["enabled"]:
            return [nc.Target(self.name, None, ref, "skipped", "channel_unavailable")]
        if route["categories"] and d.n["category"] not in route["categories"]:
            return []
        if SEVERITY_RANK[d.severity] < SEVERITY_RANK[route["min_severity"]]:
            return []
        if not cfg["enabled"] or not cfg["engine"] or not route["ref"]:
            return [nc.Target(self.name, None, ref, "skipped", "channel_unavailable")]
        exempt = d.severity == "critical" or d.mode == "escalate"
        if not exempt and cfg["quiet"]["mode"] == "suppress" and ann.quiet_active(conn, d.now, cfg):
            return [nc.Target(self.name, None, ref, "skipped", "quiet_hours")]
        return [nc.Target(self.name, None, ref, "queued", None, {"scope": route["scope"], "ref": route["ref"], "text": spoken_text(d, cfg["language"]),
                                                                 "critical": exempt, "nid": d.nid})]

    def send(self, notifier: "push.PushNotifier", d: nc.Dispatch, targets: list[nc.Target]) -> None:
        assert notifier.db is not None
        for t in targets:
            if t.status != "queued":
                continue
            status, reason = "sent", None
            try:
                with notifier.db.connection(label="announce.notify") as conn:
                    ann.announce(conn, ann._SETTINGS[0] if ann._SETTINGS else None, None, None, source="notification", scope=t.data["scope"], ref=t.data["ref"],  # type: ignore[arg-type]
                                 text=t.data["text"], critical=t.data["critical"], notification_id=t.data["nid"], unlock=lambda: unlocked(conn))
            except ann.ApiError as exc:
                # a refusal of the announcements' own rules is a skip of this delivery (limits, quiet hours, switched off, no allowed speaker);
                # only the engine not speaking is a failure
                status, reason = ("failed", exc.code) if exc.code == "speak_failed" else ("skipped", exc.code)
            except Exception as exc:  # noqa: BLE001 - one channel failing never stops the others
                log.exception("announce channel failed for notification %s", t.data["nid"])
                status, reason = "failed", type(exc).__name__
            nc.record_outcome(notifier.db, [t.delivery_id], status, reason, 1, notification_id=d.nid, channel=self.name)


nc.register(AnnounceChannel())
