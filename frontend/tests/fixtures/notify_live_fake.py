"""Fixture backend for tests/evidence-notify-live.spec.ts (CR-018 S5): the REAL SMPLWISE backend - the real notification pipeline
(sources, policies, recipients x visibility, quiet hours, escalation, channels, delivery log), the real routes with their permission
gates, the real WisKey feed hook and the real release route - whose only fakes are the outside world:

  * Home Assistant and WisKey: the in-process fake of tests/fixtures/wiskey_fake_ha.py (imported, not copied): the WisKey `hikvision_intercom/*`
    WebSocket answers, `stations/test_unlock` and the `refresh` pushes. A doorbell is a station that starts to ring (control `POST /station`).
    HA_URL is forced to a `.test` host that never resolves; the launcher refuses to run inside the add-on. HA entity states reach the product
    through the SAME function the HA WebSocket sync calls for a `state_changed` push (`ha_sync.handle_state_event`, so the instant sources and
    the rule hook run exactly as in production); the registries (areas, entities) come from the developer route POST /ha/dev/registry.
  * The push service: an `httpx.MockTransport` installed as `services.push.TRANSPORT` (what the unit tests do too). Every request is recorded
    and DECRYPTED with the receiving side of RFC 8291 (tests/test_push.py's `Browser`), so the spec reads the exact payload a phone would get.
  * SMTP: tests/fake_smtp.py on 127.0.0.1:<SW_PORT + 3> (no mail leaves the machine).

Run it (a fresh data dir each time; the ports are yours - the agent range 4771-4780 is used by default):

    SW_PORT=4771 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <venv-python> frontend/tests/fixtures/notify_live_fake.py

then, from frontend/ (`npm run build` first; the preview proxies /api to the backend):

    SW_API_PORT=4771 SW_BASE_URL=http://127.0.0.1:4776/ SW_LIVE=1 SW_NOTIFY_FIXTURE=1 \
        npx playwright test tests/evidence-notify-live.spec.ts --project=desktop --workers=1

Ports (default SW_PORT = 4771):  SW_PORT backend  ·  +1 this control server  ·  +2 the WisKey fake's own control server  ·  +3 the fake SMTP.

Control server (JSON, 127.0.0.1 only):
    GET  /status                      {ok, version, smtp_port, clock}
    POST /ha-state {entity_id, state, attributes?}      one `state_changed` push through ha_sync.handle_state_event (old state = the mirror's;
                                      `last_changed` is stamped with the movable clock below)
    POST /push/browser {user}         a fake browser for `user`: answers its subscription body ({endpoint, keys}) for POST /push/subscriptions
    GET  /push/log[?since=n]          every push the fake service received, decrypted: {n, user, status, urgency, ttl, payload}
    GET  /smtp/messages               the mail the fake SMTP server received: {n, from, to, subject, text, tls}
    POST /smtp/reset                  forget them
    POST /emit/camera-offline {camera_id, times}   `camera.offline` signals through the monitor thread's queue (notify_sources.submit), the path
                                      the sources use for a thread that holds no transaction - folded into one row
    POST /camera/status {camera_id, status}   what the camera discovery writes (`offline` keeps the monitor pass from resolving the row)
    POST /emit/backup-failed          the hook the daily backup calls when it raised (notify_sources.backup_failed)
    POST /clock/advance {seconds}     moves `notify.now_utc` (escalation timer, quiet hours, fold window) forward; GET /clock reads it
    GET  /clock                       {now, local_hhmm, weekday}  in the installation's zone
The WisKey fake's own control API (/station, /sent, /reset, ...) is served on +2 (see wiskey_fake_ha.py).
"""
from __future__ import annotations

import datetime as dt
import email
import email.policy
import json
import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("notify_live_fake: refusing to run inside the Home Assistant add-on")

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BACKEND = ROOT / "smplwise_vms" / "backend"
sys.path.insert(0, str(BACKEND))
sys.path.insert(1, str(BACKEND / "tests"))
sys.path.insert(2, str(HERE))

PORT = int(os.environ.get("SW_PORT", "4771"))
CONTROL_PORT = int(os.environ.get("SW_NOTIFY_CONTROL_PORT", str(PORT + 1)))
WISKEY_CONTROL_PORT = int(os.environ.get("SW_WISKEY_CONTROL_PORT", str(PORT + 2)))
SMTP_PORT = int(os.environ.get("SW_FAKE_SMTP_PORT", str(PORT + 3)))
os.environ.setdefault("SW_DEV_USER", "joni")
os.environ.setdefault("SW_BOOTSTRAP_ADMIN", "joni")
os.environ.setdefault("SW_LOG_LEVEL", "warning")
if not os.environ.get("SW_DATA_DIR"):
    os.environ["SW_DATA_DIR"] = tempfile.mkdtemp(prefix="notify-live-")
os.environ["SW_PORT"] = str(PORT)

# the WisKey / HA fake FIRST: it replaces websockets.connect and the httpx transport before the backend is imported
import wiskey_fake_ha as wk  # noqa: E402  (sets HA_URL / HA_TOKEN / GO2RTC_URL to reserved `.test` hosts)

import fake_smtp  # noqa: E402
import httpx  # noqa: E402
from test_push import Browser, FakePushService  # noqa: E402

from smplwise.config import load_settings  # noqa: E402
from smplwise.db import Database  # noqa: E402
from smplwise.routers.settings import read_settings  # noqa: E402
from smplwise.services import ha_sync, notify, notify_sources, timeutil  # noqa: E402
from smplwise.services import push as push_svc  # noqa: E402

# the doorbell scenario starts the doorbell by hand: the gate is quiet at start (the WisKey fixture rings it by default)
for _s in wk.WORLD.stations:
    if _s["id"] == "gate":
        _s["call_state"] = "idle"

# ------------------------------------------------------------------------------------------------ the clock

_OFFSET = {"s": 0.0}
_real_now = notify.now_utc


def _shifted_now() -> dt.datetime:
    return _real_now() + dt.timedelta(seconds=_OFFSET["s"])


notify.now_utc = _shifted_now  # type: ignore[assignment]

# ------------------------------------------------------------------------------------------------ the push service

PUSH_LOG: list[dict[str, Any]] = []
BROWSERS: dict[str, Browser] = {}
_push_lock = threading.Lock()


class RecordingPush(FakePushService):
    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        user = next((u for u, b in BROWSERS.items() if b.endpoint == url), None)
        entry: dict[str, Any] = {"user": user, "urgency": request.headers.get("urgency"), "ttl": request.headers.get("ttl"), "status": 201, "payload": None}
        try:
            if user is not None:
                entry["payload"] = BROWSERS[user].decrypt(request.read())
        except Exception as exc:  # noqa: BLE001 - recorded, never raised into the notifier
            entry["payload"] = {"_decrypt_error": type(exc).__name__}
        with _push_lock:
            entry["n"] = len(PUSH_LOG) + 1
            PUSH_LOG.append(entry)
        return super().handler(request)


FAKE_PUSH = RecordingPush()
push_svc.TRANSPORT = httpx.MockTransport(FAKE_PUSH.handler)  # type: ignore[assignment]

# ------------------------------------------------------------------------------------------------ the SMTP server

fake_smtp.PORTS = range(SMTP_PORT, SMTP_PORT + 1)
SMTP = fake_smtp.FakeSMTP(Path(tempfile.mkdtemp(prefix="notify-live-smtp-")), mode="none")


def smtp_messages() -> list[dict[str, Any]]:
    out = []
    for i, m in enumerate(list(SMTP.messages), 1):
        msg = email.message_from_bytes(m["data"], policy=email.policy.default)
        body = msg.get_body(preferencelist=("plain",))
        out.append({"n": i, "from": m["from"], "to": m["to"], "subject": str(msg["Subject"] or ""), "text": (body.get_content() if body is not None else "")[:4000], "tls": bool(m.get("tls"))})
    return out


# ------------------------------------------------------------------------------------------------ the control server

DB: Database | None = None
SETTINGS = None


def _db() -> Database:
    global DB, SETTINGS
    if DB is None:
        SETTINGS = load_settings()
        DB = Database(SETTINGS.db_path)
    return DB


def ha_state(entity_id: str, state: str, attributes: dict[str, Any]) -> dict[str, Any]:
    db = _db()
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT state, attributes_json FROM ha_entities WHERE entity_id = ?", (entity_id,)).fetchone()
    old = {"entity_id": entity_id, "state": row["state"], "attributes": json.loads(row["attributes_json"] or "{}")} if row else None
    stamp = _shifted_now().isoformat().replace("+00:00", "Z")  # the mirror's last_changed follows the movable clock, so a hold (a door open for N s) is judged on one clock
    new = {"entity_id": entity_id, "state": state, "attributes": attributes, "last_changed": stamp, "last_updated": stamp}
    ha_sync.handle_state_event(db, {"old_state": old, "new_state": new}, attempts=3)
    return {"ok": True, "old": old["state"] if old else None}


class Control(BaseHTTPRequestHandler):
    def _json(self, status: int, body: Any) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self) -> dict[str, Any]:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def do_GET(self) -> None:  # noqa: N802
        path, _, query = self.path.partition("?")
        since = int(dict(p.split("=", 1) for p in query.split("&") if "=" in p).get("since", "0") or 0)
        if path == "/status":
            return self._json(200, {"ok": True, "version": "notify-live-fake", "smtp_port": SMTP.port, "clock": _shifted_now().isoformat()})
        if path == "/clock":
            with _db().connection(mode="read") as conn:
                tz = read_settings(conn)["time.zone"]
            now = _shifted_now()
            local = now.astimezone(timeutil.zone(tz))
            return self._json(200, {"now": now.isoformat(), "local_hhmm": local.strftime("%H:%M"), "weekday": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][local.weekday()], "offset_s": _OFFSET["s"]})
        if path == "/push/log":
            with _push_lock:
                return self._json(200, {"entries": [e for e in PUSH_LOG if e["n"] > since], "next": len(PUSH_LOG)})
        if path == "/smtp/messages":
            return self._json(200, {"messages": smtp_messages()})
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        try:
            body = self._body()
            if self.path == "/ha-state":
                return self._json(200, ha_state(str(body["entity_id"]), str(body["state"]), dict(body.get("attributes") or {})))
            if self.path == "/push/browser":
                user = str(body["user"])
                BROWSERS[user] = Browser(f"{user}-{len(BROWSERS)}")
                return self._json(200, BROWSERS[user].body())
            if self.path == "/smtp/reset":
                SMTP.messages.clear()
                return self._json(200, {"ok": True})
            if self.path == "/emit/camera-offline":
                cid, times = str(body["camera_id"]), int(body.get("times", 1))
                db = _db()
                with db.connection(mode="read") as conn:
                    r = conn.execute("SELECT alias, name_source, channel FROM cameras WHERE id = ?", (cid,)).fetchone()
                name = str((r["alias"] or r["name_source"] or f"ערוץ {r['channel']}") if r else cid)
                for _ in range(times):
                    sig = notify.Signal("camera.offline", "camera", cid, params={"name": name, "place": name}, origin={"camera_id": cid, "event_id": None})
                    if not notify_sources.submit(sig):
                        return self._json(503, {"error": "queue_full"})
                return self._json(200, {"ok": True, "submitted": times})
            if self.path == "/camera/status":  # what the camera discovery writes: the monitor pass reads it (an offline camera keeps its row open)
                stamp = _real_now().isoformat().replace("+00:00", "Z")
                with _db().connection() as conn:
                    conn.execute("UPDATE cameras SET status = ?, last_seen_at = ? WHERE id = ?", (str(body["status"]), stamp, str(body["camera_id"])))
                return self._json(200, {"ok": True})
            if self.path == "/emit/backup-failed":
                notify_sources.backup_failed(_db())
                return self._json(200, {"ok": True})
            if self.path == "/clock/advance":
                _OFFSET["s"] += float(body["seconds"])
                notify.wake()
                return self._json(200, {"ok": True, "offset_s": _OFFSET["s"]})
        except KeyError as exc:
            return self._json(422, {"error": f"missing {exc}"})
        self._json(404, {"error": "not_found"})

    def log_message(self, *_args: Any) -> None:
        pass


def main() -> None:
    SMTP.start()
    if SMTP.port != SMTP_PORT:
        sys.exit(f"notify_live_fake: the fake SMTP server could not bind port {SMTP_PORT}")
    server = ThreadingHTTPServer(("127.0.0.1", CONTROL_PORT), Control)
    threading.Thread(target=server.serve_forever, name="notify-live-control", daemon=True).start()
    wk_server = ThreadingHTTPServer(("127.0.0.1", WISKEY_CONTROL_PORT), wk.Control)
    threading.Thread(target=wk_server.serve_forever, name="wiskey-fixture-control", daemon=True).start()
    print(f"notify_live_fake: backend {PORT} · control {CONTROL_PORT} · WisKey fake {WISKEY_CONTROL_PORT} · SMTP {SMTP.port}", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
