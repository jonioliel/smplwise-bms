"""CR-NOTIFY-FANOUT-2436 (code review 04:F05, the part outside services/notify.py): one notification to many users must not cost
users x channels x several statements. The planning connection of a dispatch and the maintenance recipient rule are measured with
a statement counter; the targets they produce are compared with a reference copy of the per-user code they replace (same rows,
same filters, same order). FAKES ONLY: no device, no push service is called (the notifier's `attempt` is a stub)."""
from __future__ import annotations

import contextlib
import datetime as dt

import pytest
from notify_world import World, fake_push  # noqa: F401 - fixture

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.rbac import INSTALLATION, authorize, permissions_anywhere
from smplwise.services import notify, notify_channels
from smplwise.services import push as svc
from smplwise.services.notify_visibility import Reach, principal_of
from smplwise.services.timeutil import iso_utc

pytestmark = pytest.mark.usefixtures("daytime_clock")

N_USERS = 200
# Statement counts with this file's fixture (docs/changes/CR-NOTIFY-FANOUT-2436.md). BEFORE = origin/main 665ec8f24, AFTER = this branch.
# The per-user principal, push-subscription and snooze statements are gone; what remains per user is the permission check itself
# (row_scope / authorize in rbac), which this branch does not change. Each bound sits between AFTER and BEFORE.
PLAN_BEFORE, PLAN_AFTER = 2608, 2008            # the whole planning connection of one dispatch, Web Push only, 200 users (+4 world users)
PLAN_BOUND = PLAN_AFTER + 100
WA_RESOLVED_BEFORE, WA_RESOLVED_AFTER = 205, 2  # the WhatsApp plan of a resolve notice for 200 recipients, 5 of them reached before
WA_RESOLVED_BOUND = 10
MAINT_BEFORE, MAINT_AFTER = 1057, 846           # recipient rule `maintenance`, a floor task, 200 users (+ the tickets world)
MAINT_BOUND = MAINT_AFTER + 60


class _Counter:
    """Counts the statements run on the connections opened under one label."""

    def __init__(self, db, monkeypatch, label: str) -> None:
        self.sql: list[str] = []
        orig = db.connection

        @contextlib.contextmanager
        def counted(*a, **kw):
            with orig(*a, **kw) as conn:
                if kw.get("label") != label:
                    yield conn
                    return
                conn.set_trace_callback(self.sql.append)
                try:
                    yield conn
                finally:
                    conn.set_trace_callback(None)

        monkeypatch.setattr(db, "connection", counted)


class _Notifier(svc.PushNotifier):
    def attempt(self, job, key):  # no push service: the test measures planning only
        return "sent"


def _crowd(db, n: int = N_USERS, *, subs: int = 1) -> list[str]:
    """`n` active operators (installation) with `subs` push subscriptions each; every 10th user has two (order by created_at)."""
    ids = [f"crowd-{i:03d}" for i in range(n)]
    now = now_iso()
    with db.connection() as conn:
        rev = permission_revision(conn)
        for i, uid in enumerate(ids):
            conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?,?,?,?,1,?,?)",
                         (uid, uid, f"User {i}", "dev", now, now))
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                         "VALUES (?, 'user', ?, 'operator', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), uid, rev, now))
            for k in range(subs + (1 if i % 10 == 0 else 0)):
                conn.execute("INSERT INTO push_subscriptions(id, user_id, endpoint, p256dh, auth, created_at, last_seen_at, kind) VALUES (?,?,?,?,?,?,?, 'webpush')",
                             (new_id(), uid, f"https://push{k}.example.test/{uid}/{k}", "p", "a", f"2026-10-01T08:00:0{k}Z", now))
    return ids


def _reference_webpush_plan(d: notify_channels.Dispatch, conn) -> list[tuple]:
    """The pre-2436 WebPushChannel.plan, user by user (principal_of, one subscription query and one snooze query per user)."""
    out = []
    key = svc.signing_key(conn)
    for uid in d.users:
        subs = conn.execute("SELECT * FROM push_subscriptions WHERE user_id = ? AND kind = 'webpush' ORDER BY created_at", (uid,)).fetchall()
        p = principal_of(conn, uid)
        reach = Reach(conn, p) if p is not None else None
        if reach is None or not subs:
            continue
        host = svc.endpoint_host(subs[0]["endpoint"])
        if not reach.can_see(d.n):
            out.append((uid, host, "skipped", "no_reach", None))
            continue
        rec = conn.execute("SELECT snoozed_until FROM notification_recipients WHERE notification_id = ? AND user_id = ?", (d.nid, uid)).fetchone()
        if d.mode != "escalate" and rec is not None and rec["snoozed_until"] and rec["snoozed_until"] > iso_utc(d.now):
            out.append((uid, host, "skipped", "snoozed", None))
            continue
        if d.held("webpush"):
            out.append((uid, host, "skipped", d.held_reason("webpush"), None))
            continue
        if key is None:
            out.append((uid, host, "skipped", "no_key", None))
            continue
        if d.severity != "critical" and d.mode != "escalate" and not svc.take_token(uid):
            out.append((uid, host, "skipped", "rate_limited", None))
            continue
        for s in subs:
            out.append((uid, svc.endpoint_host(s["endpoint"]), "queued", None, s["id"]))
    return out


def _as_tuples(targets) -> list[tuple]:
    return [(t.user_id, t.target_ref, t.status, t.reason, t.data["sub"]["id"] if t.status == "queued" else None) for t in targets]


@pytest.fixture()
def w(settings, fake_push) -> World:
    return World(settings)


def test_webpush_plan_for_200_users_is_a_bounded_number_of_statements_with_the_same_targets(w, monkeypatch):
    w.subscribe("ops2")  # through the API: this also makes the installation's signing key, so the crowd's targets are queued
    crowd = _crowd(w.db)
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
    with w.db.connection(mode="read") as conn:
        rec = [r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchall()]
    assert set(crowd) <= set(rec), "every operator of the crowd is a recipient"
    # a few rows that must keep their reasons: snoozed users, an inactive user, a user who can no longer see the camera
    with w.db.connection() as conn:
        later = iso_utc(dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1))
        conn.execute("UPDATE notification_recipients SET snoozed_until = ? WHERE notification_id = ? AND user_id IN (?, ?)", (later, nid, crowd[3], crowd[7]))
        conn.execute("UPDATE notification_recipients SET snoozed_until = ? WHERE notification_id = ? AND user_id = ?", ("2000-01-01T00:00:00Z", nid, crowd[8]))
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (crowd[5],))
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_id = ?", (now_iso(), crowd[9]))

    seen: dict[str, list] = {}
    real_plan = notify_channels.WebPushChannel.plan

    def spy(self, d, conn):
        svc.reset_limits()
        start = len(counter.sql)
        seen["reference"] = _reference_webpush_plan(d, conn)
        seen["reference_sql"] = len(counter.sql) - start
        svc.reset_limits()
        before = len(counter.sql)
        got = real_plan(self, d, conn)
        seen["plan_sql"] = len(counter.sql) - before
        seen["new"] = _as_tuples(got)
        return got

    counter = _Counter(w.db, monkeypatch, "notify.plan")
    monkeypatch.setattr(notify_channels.WebPushChannel, "plan", spy)
    notify_channels.process_outbox(_with_db(_Notifier(), w.db))
    planning = len(counter.sql) - seen["reference_sql"]  # the planning connection without the reference plan's own statements
    print(f"\nwebpush plan statements for {N_USERS} users: {seen['plan_sql']} (reference per-user plan: {seen['reference_sql']}; whole planning connection: {planning})")
    assert seen["new"] == seen["reference"], "same targets, same reasons, same order as the per-user plan"
    by_user = {t[0]: t for t in seen["new"]}
    assert by_user[crowd[3]][3] == "snoozed" and by_user[crowd[7]][3] == "snoozed"
    assert by_user[crowd[8]][3] != "snoozed", "a snooze in the past holds nothing"
    assert crowd[5] not in by_user, "an inactive user is not planned"
    assert by_user[crowd[9]][3] == "no_reach"
    assert [t[2] for t in seen["new"] if t[0] == crowd[0]] == ["queued", "queued"], "both subscriptions of a user, in created_at order"
    assert sum(1 for t in seen["new"] if t[2] == "queued") >= N_USERS, "the crowd is really planned for sending"
    assert planning <= PLAN_BOUND < PLAN_BEFORE, f"the planning connection ran {planning} statements for {N_USERS} users"


def test_principal_batch_matches_principal_of(w):
    from smplwise.services import notify_visibility as nv

    crowd = _crowd(w.db, 30, subs=0)
    with w.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (crowd[2],))
    with w.db.connection(mode="read") as conn:
        ids = crowd + ["no-such-user", crowd[4]]
        got = nv.principals_of(conn, ids)
        for uid in ids:
            assert got.get(uid) == principal_of(conn, uid)
        everyone = [r[0] for r in conn.execute("SELECT id FROM users WHERE active = 1 ORDER BY id").fetchall()]
        assert [p.user_id for p in nv.active_principals(conn)] == everyone
        assert nv.active_principals(conn) == [principal_of(conn, u) for u in everyone]


def test_whatsapp_resolve_notice_filter_is_one_statement_for_200_users(w, monkeypatch):
    from smplwise.services import notify_whatsapp as wa
    from smplwise.services.notify_policy import get_policy

    crowd = _crowd(w.db, subs=0)
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
    with w.db.connection() as conn:
        for uid in crowd[:5]:
            conn.execute("INSERT INTO notification_deliveries(id, notification_id, user_id, channel, target_ref, status, reason, attempt, mode, created_at) "
                         "VALUES (?,?,?,?,?,?,NULL,1,'new',?)", (new_id(), nid, uid, wa.CHANNEL, "x", "sent", now_iso()))
    monkeypatch.setattr(wa, "load_config", lambda conn: {"enabled": True, "dedupe_min": 10, "per_user_hour": 5, "detail": "type_place"})

    class _Doc:
        uses = {wa.USE_KEY: "entry:x"}

    monkeypatch.setattr(wa.mr, "load_doc", lambda conn: _Doc())
    asked: list[str] = []
    monkeypatch.setattr(wa, "resolve_number", lambda conn, uid: asked.append(uid))
    with w.db.connection(mode="read") as conn:
        n = notify._row_note(conn.execute("SELECT * FROM notifications WHERE id = ?", (nid,)).fetchone())
        d = notify_channels.Dispatch(nid, "resolved", n, get_policy(conn, n["source"]), {"lockscreen": "type_place", "pass_through": {}}, "UTC",
                                     notify.now_utc(), False, list(crowd), {})
        d._conn = conn
        sql: list[str] = []
        conn.set_trace_callback(sql.append)
        try:
            assert wa.WhatsAppNotifyChannel().plan(d, conn) == []
        finally:
            conn.set_trace_callback(None)
    assert asked == crowd[:5], "a resolve notice only to whom this channel reached, in the recipients' order"
    print(f"\nwhatsapp resolved-mode plan statements for {N_USERS} users: {len(sql)}")
    assert len(sql) <= WA_RESOLVED_BOUND


def test_snooze_lookup_is_read_once_per_dispatch(w):
    crowd = _crowd(w.db, 20, subs=0)
    nid = w.emit("camera.offline", "camera", w.cam, params={"name": "לובי"}).id
    with w.db.connection() as conn:
        conn.execute("UPDATE notification_recipients SET snoozed_until = 'S' WHERE notification_id = ? AND user_id = ?", (nid, crowd[1]))
    with w.db.connection(mode="read") as conn:
        d = notify_channels.Dispatch(nid, "new", {"severity": "alert"}, {}, {}, "UTC", notify.now_utc(), False, list(crowd), {})
        d._conn = conn
        sql: list[str] = []
        conn.set_trace_callback(sql.append)
        try:
            got = [d.snoozed_until(u) for u in crowd] + [d.snoozed_until("nobody")]
        finally:
            conn.set_trace_callback(None)
    assert got[1] == "S" and all(g is None for i, g in enumerate(got) if i != 1)
    assert len(sql) == 1


def _with_db(n, db):
    n.db = db
    return n


# ---------------------------------------------------------------- maintenance: recipient rule `maintenance`

def _reference_maint_recipients(conn, n) -> list[str]:
    """The pre-2436 recipient_users: principal_of per active user."""
    from smplwise.services.maintenance import access

    row = conn.execute("SELECT * FROM maint_tasks WHERE id = ?", (n.get("subject_id"),)).fetchone()
    if row is None or row["deleted_at"]:
        return []
    target = access.target_of(row)
    out = [row["owner_user_id"]] if row["owner_user_id"] else []
    for (uid,) in conn.execute("SELECT id FROM users WHERE active = 1 ORDER BY id").fetchall():
        p = principal_of(conn, uid)
        if p is None:
            continue
        if (access.MANAGE in permissions_anywhere(conn, p)) if target == INSTALLATION else authorize(conn, p, access.MANAGE, target).allowed:
            out.append(uid)
    return list(dict.fromkeys(out))


def test_maintenance_recipients_for_200_users_same_list_fewer_statements(settings):
    from test_maintenance_215 import MW

    from smplwise.services.maintenance import reminders

    m = MW(settings).on()
    crowd = _crowd(m.db, subs=0)
    with m.db.connection() as conn:  # some of the crowd manage maintenance on floor 2 (site_admin there)
        for uid in crowd[::17]:
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                         "VALUES (?, 'user', ?, 'site_admin', 'floor', ?, 'allow', ?, 'test', ?)", (new_id(), uid, m.floors["floor2"], permission_revision(conn), now_iso()))
    placed = m.task(place=m.floor("floor2"))
    placeless = m.task()
    for t in (placed, placeless):
        n = {"subject_id": t["id"]}
        with m.db.connection(mode="read") as conn:
            ref = _reference_maint_recipients(conn, n)
            sql: list[str] = []
            conn.set_trace_callback(sql.append)
            try:
                got = reminders.recipient_users(conn, n)
            finally:
                conn.set_trace_callback(None)
        assert got == ref, "the same recipients in the same order"
        print(f"\nmaintenance recipient_users statements ({'placed' if t is placed else 'placeless'}, {N_USERS}+ users): {len(sql)}")
        assert len(sql) <= MAINT_BOUND
    with m.db.connection(mode="read") as conn:
        assert set(crowd[::17]) <= set(reminders.recipient_users(conn, {"subject_id": placed["id"]})), "the floor-2 managers of the crowd"
