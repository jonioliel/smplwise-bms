"""APPREFRESH3-295 (CR-APPREFRESH295 section 14, APPREFRESH-DEVICEKEY-SPEC section 6a): the device-key PIN. A device registration stays
bound to the last key it bound after the sign-in (family) that bound it ends, so re-registering the device, deleting and re-adding it, or
an administrator ending the sign-in no longer lets the next mint bind a new key without proof. A new key (or none) needs either the old
key's `replaces` signature (over a challenge nonce, now also issued for a pinned device without a live sign-in), the USER's own end of the
old sign-in (owner decision Q296), or an administrator-approved, audited, time-boxed reset that notifies the user (owner decision Q297:
in the app and on the phone, wording from the Settings). Covers: replay, the wrong key, the lost-key path, the audit rows, the notice and
its wording, the authority and channel rules, expiry and withdrawal, the status route, backup. Fakes only: no Home Assistant, no phone."""
from __future__ import annotations

import json

from test_app_refresh_295 import API, ARX, INSTALL, audit_rows, family_row, register, rx, switch  # noqa: F401 - rx is the shared fixture
from test_app_refresh_devicekey_295 import Key, challenge, key_body, keyed, mint, nonce_of, now, prefresh, proof

from smplwise.services import app_refresh as svc
from smplwise.services import app_refresh_key as dk
from smplwise.services import backup
from smplwise.services import notify_policy

INSTALL3 = "33333333-2222-3333-4444-555555555555"
REASON = "הטלפון אבד, המשתמש התקשר"


def replace_body(rx, device_id: str, new: Key | None, old: Key, nonce: str | None = None, ts: int | None = None) -> dict:
    body = key_body(rx, device_id, new or Key())
    nonce = nonce or nonce_of(rx, device_id)
    ts = now(rx) if ts is None else ts
    body["replaces"] = {"nonce": nonce, "ts": ts, "sig": old.sign(dk.replace_message(device_id, nonce, ts, body["public_key"]))}
    return body


def reregistered(rx) -> tuple[dict, dict, Key]:
    """A keyed device whose sign-in ended by re-registration (the weakness this slice closes)."""
    dev, out, old = keyed(rx)
    register(rx)
    assert family_row(rx, out["family_id"])["revoked_reason"] == "device_reregistered"
    return dev, out, old


def pin_row(rx, device_id: str):
    with rx.db.connection(mode="read") as conn:
        return conn.execute("SELECT * FROM app_refresh_device_keys WHERE device_id = ?", (device_id,)).fetchone()


def reset(rx, device_id: str, client=None, prefix: str = API, reason: str = REASON):
    return (client or rx.c).post(f"{prefix}/auth/app/devices/{device_id}/key-reset", json={"reason": reason})


def notices(rx, user_id: str = "u-viewer") -> list[dict]:
    with rx.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(
            """SELECT n.* FROM notifications n JOIN notification_recipients r ON r.notification_id = n.id
               WHERE n.source = 'security.app_device_key_reset' AND r.user_id = ? ORDER BY n.created_at""", (user_id,)).fetchall()]


# ---------------------------------------------------------------- the pin outlives the sign-in

def test_after_re_registration_a_new_key_needs_the_old_keys_proof(rx):
    dev, out, old = reregistered(rx)
    assert pin_row(rx, dev["device_id"])["device_key_fp"] == old.fp
    attacker = Key()
    r = mint(rx, dev["device_id"], attacker)  # a fresh session of the user, the attacker's key, nothing from the phone's key
    assert r.status_code == 409 and r.json()["code"] == "device_key_bound" and r.json()["details"]["reason"] == "missing", r.text
    assert mint(rx, dev["device_id"], None).status_code == 409  # a keyless mint would drop the key: refused the same way
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM app_refresh_families WHERE device_id = ? AND revoked_at IS NULL", (dev["device_id"],)).fetchone()[0] == 0
    # the challenge now stores a nonce for the pinned device (its pin scope) - the same answer shape as ever
    r = challenge(rx, dev["device_id"])
    assert r.status_code == 200 and set(r.json()) == {"nonce", "expires_in", "expires_at", "server_time"}
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT family_id FROM app_refresh_nonces WHERE nonce_hash = ?", (dk.nonce_hash(r.json()["nonce"]),)).fetchone()[0] == svc.pin_scope(dev["device_id"])
    # the phone (it still holds the old key) consents: the new key binds
    new = Key()
    r = mint(rx, dev["device_id"], None, body=replace_body(rx, dev["device_id"], new, old))
    assert r.status_code == 201, r.text
    out2 = r.json()
    assert family_row(rx, out2["family_id"])["device_key_fp"] == new.fp and pin_row(rx, dev["device_id"])["device_key_fp"] == new.fp
    rows = audit_rows(rx, "auth.app_refresh.key_replaced")
    d = json.loads(rows[-1]["details_json"])
    assert d["via"] == "old_key" and d["family"] is None and d["old_key_fp"] == old.fp[:16] and d["new_key_fp"] == new.fp[:16]
    assert prefresh(rx, out2["refresh_token"], dev["device_id"], proof(rx, new, dev["device_id"], out2["refresh_token"])).status_code == 200
    # the same (new) key re-minted after another re-registration needs no proof
    register(rx)
    assert mint(rx, dev["device_id"], new).status_code == 201


def test_a_replayed_replace_proof_is_refused(rx):
    dev, _, old = reregistered(rx)
    body = replace_body(rx, dev["device_id"], Key(), old)
    assert mint(rx, dev["device_id"], None, body=body).status_code == 201
    register(rx)  # and the sign-in ends again: the captured request replayed
    r = mint(rx, dev["device_id"], None, body=body)
    assert r.status_code == 409 and r.json()["details"]["reason"] == "nonce"
    # the captured nonce re-signed by the old key over another new key: still the spent nonce
    again = replace_body(rx, dev["device_id"], Key(), old, nonce=body["replaces"]["nonce"])
    assert mint(rx, dev["device_id"], None, body=again).json()["details"]["reason"] == "nonce"


def test_the_wrong_key_cannot_consent(rx):
    dev, _, old = reregistered(rx)
    new = Key()
    vdev, _, _ = keyed(rx, "vera", install_id=INSTALL3)
    cases = [
        (replace_body(rx, dev["device_id"], new, old=Key()), "invalid"),  # not the pinned key
        (replace_body(rx, dev["device_id"], new, old=new), "invalid"),  # the new key signing for itself
        (replace_body(rx, dev["device_id"], new, old, nonce=nonce_of(rx, vdev["device_id"])), "nonce"),  # another device's nonce
        (replace_body(rx, dev["device_id"], new, old, ts=now(rx) - dk.POP_SKEW_S - 1), "clock"),
    ]
    for body, reason in cases:
        r = mint(rx, dev["device_id"], None, body=body)
        assert r.status_code == 409 and r.json()["details"]["reason"] == reason, (reason, r.text)
    assert pin_row(rx, dev["device_id"])["device_key_fp"] == old.fp
    denied = [json.loads(a["details_json"])["replace"] for a in audit_rows(rx, "auth.app_refresh.issue") if a["reason"] == "device_key_bound"]
    assert denied == ["invalid", "invalid", "nonce", "clock"]


def test_deleting_the_device_or_an_administrators_end_keeps_the_pin(rx):
    dev, out, old = keyed(rx)
    r = rx.user("joni").delete(f"{ARX}/auth/app/families/{out['family_id']}")  # an administrator ends it (remote)
    assert r.status_code == 204 and family_row(rx, out["family_id"])["revoked_reason"] == "revoked_by_admin"
    assert mint(rx, dev["device_id"], Key()).json()["code"] == "device_key_bound"
    assert rx.user("dana").delete(f"{ARX}/presence/devices/{dev['device_id']}").status_code == 204  # deleted ...
    again = register(rx)  # ... and added again: the same install, the same registration row
    assert again["device_id"] == dev["device_id"]
    assert mint(rx, dev["device_id"], Key()).json()["code"] == "device_key_bound"
    r = rx.c.delete(f"{API}/auth/app/families", params={"user_id": "u-viewer"})  # an administrator's "all of them": nothing to end, no release
    assert r.status_code == 200
    assert pin_row(rx, dev["device_id"]) is not None and audit_rows(rx, "auth.app_refresh.key_released") == []


def test_the_users_own_end_releases_the_pin(rx):
    # owner decision Q296: the user ending the old sign-in themselves is a valid way to a new key
    dev, out, old = keyed(rx)
    r = rx.user("dana").delete(f"{ARX}/auth/app/families", params={"user_id": "u-viewer"})  # "sign out everywhere", own account
    assert r.status_code == 200 and r.json()["families_ended"] == 1
    assert pin_row(rx, dev["device_id"]) is None
    rel = audit_rows(rx, "auth.app_refresh.key_released")
    assert [a["reason"] for a in rel] == ["signed_out_everywhere"] and json.loads(rel[0]["details_json"])["key_fp"] == old.fp[:16]
    assert old.text not in rel[0]["details_json"]
    assert mint(rx, dev["device_id"], Key()).status_code == 201


# ---------------------------------------------------------------- the lost-key path: an administrator-approved reset

def test_lost_key_admin_reset_audits_notifies_and_lets_one_new_key_bind(rx):
    dev, out, old = keyed(rx)
    r = reset(rx, dev["device_id"])  # the local channel's system administrator
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["families_ended"] == 1 and body["user_notified"] is True
    assert svc.epoch(body["reset_expires_at"]) == now(rx) + svc.RESET_WINDOW_S
    assert family_row(rx, out["family_id"])["revoked_reason"] == "device_key_reset"  # the old key is no longer trusted
    # the audit row: who approved, for which device and user, the note, a fingerprint prefix - never the key
    rows = audit_rows(rx, "auth.app_refresh.key_reset_approved")
    assert len(rows) == 1 and rows[0]["decision"] == "allowed" and rows[0]["resource_id"] == dev["device_id"]
    d = json.loads(rows[0]["details_json"])
    assert d["user"] == "u-viewer" and d["key_fp"] == old.fp[:16] and d["note"] == REASON and d["channel"] == "local" and d["families_ended"] == 1
    assert old.text not in rows[0]["details_json"] and old.fp not in rows[0]["details_json"]
    # the user is told, in the default wording, with the device's name; never the administrator or the reason
    n = notices(rx)
    assert len(n) == 1
    assert n[0]["title"] == svc.NOTICE_DEFAULTS[svc.NOTICE_TITLE_KEY][0]
    assert dev["name"] in n[0]["body"] and "{device}" not in n[0]["body"] and "{until}" not in n[0]["body"] and REASON not in n[0]["body"]
    # the user's next mint binds a new key without the old key's proof - once
    new = Key()
    r = mint(rx, dev["device_id"], new)
    assert r.status_code == 201, r.text
    assert pin_row(rx, dev["device_id"])["device_key_fp"] == new.fp and pin_row(rx, dev["device_id"])["reset_expires_at"] is None
    rep = json.loads(audit_rows(rx, "auth.app_refresh.key_replaced")[-1]["details_json"])
    assert rep["via"] == "admin_reset" and rep["old_key_fp"] == old.fp[:16] and rep["new_key_fp"] == new.fp[:16] and rep["approved_by"]
    out2 = r.json()
    assert prefresh(rx, out2["refresh_token"], dev["device_id"], proof(rx, new, dev["device_id"], out2["refresh_token"])).status_code == 200
    r = mint(rx, dev["device_id"], Key())  # the approval was spent
    assert r.status_code == 409 and r.json()["code"] == "device_key_bound"


def test_the_notice_goes_to_the_app_and_the_phone_by_default():
    # owner decision Q297: in the app (inbox) and on the phone (push + the phone-app channel)
    row = notify_policy.default_row(notify_policy.BY_KEY["security.app_device_key_reset"])
    assert row["channels"]["inbox"] and row["channels"]["webpush"] and row["channels"]["app"]
    assert row["recipients"] == {"rule": "initiator"} and row["category"] == "security"


def test_the_notice_wording_comes_from_the_settings(rx):
    dev, _, _ = keyed(rx)
    title, body = svc.NOTICE_TITLE_KEY, svc.NOTICE_BODY_KEY
    for bad in ({title: ""}, {title: "x" * 81}, {body: "שלום {user}"}, {body: "סוגר } בודד"}, {body: "{0}"}, {title: 5}, {body: ["a"]}):
        r = rx.c.put(f"{API}/auth/app/settings", json=bad)
        assert r.status_code == 422, (bad, r.text)
    svc.reset_limits()
    st = switch(rx, **{title: "  איפוס   מפתח  ", body: "המפתח במכשיר {device} אופס. היכנסו עד {until}."})["settings"]
    assert st[title] == "איפוס מפתח" and st[body] == "המפתח במכשיר {device} אופס. היכנסו עד {until}."
    assert reset(rx, dev["device_id"]).status_code == 200
    n = notices(rx)[-1]
    assert n["title"] == "איפוס מפתח" and n["body"].startswith(f"המפתח במכשיר {dev['name']} אופס. היכנסו עד ") and "{until}" not in n["body"]
    # null restores the default; the change is audited like every other setting
    st = switch(rx, **{body: None})["settings"]
    assert st[body] == svc.NOTICE_DEFAULTS[body][0]
    assert any(title in json.loads(a["details_json"]) for a in audit_rows(rx, "auth.app_refresh.settings"))
    assert {title, body} <= backup.SETTINGS_KEEP and {title, body} <= set(svc.SETTING_KEYS)


def test_who_may_approve_a_reset(rx):
    dev, out, _ = keyed(rx)
    assert reset(rx, dev["device_id"], client=rx.user("dana"), prefix=ARX).status_code == 403  # the device's own (non-admin) user
    assert reset(rx, dev["device_id"], client=rx.user("vera"), prefix=ARX).status_code == 403
    assert reset(rx, dev["device_id"], reason="x").status_code == 422  # a reason is required
    assert reset(rx, "dev_unknown0000000").status_code == 404
    plain = register(rx, "vera", install_id=INSTALL3, name="הנייד של ורה")  # never bound a key
    r = reset(rx, plain["device_id"])
    assert r.status_code == 409 and r.json()["code"] == "no_device_key"
    # an administrator's own device: only from the local channel (a stolen remote session cannot re-key its own phone)
    jdev, _, _ = keyed(rx, "joni", install_id="44444444-2222-3333-4444-555555555555")
    r = reset(rx, jdev["device_id"], client=rx.user("joni"), prefix=ARX)
    assert r.status_code == 403 and r.json()["code"] == "local_channel_only"
    # another user's device from the remote channel is fine
    assert reset(rx, dev["device_id"], client=rx.user("joni"), prefix=ARX).status_code == 200
    assert family_row(rx, out["family_id"])["revoked_reason"] == "device_key_reset"
    denied = [a["reason"] for a in audit_rows(rx, "auth.app_refresh.key_reset_approved") if a["decision"] == "denied"]
    assert denied == ["not_system_admin", "not_system_admin", "reason_invalid", "device_not_found", "no_device_key", "own_device_remote"]
    assert len(notices(rx)) == 1


def test_a_reset_lapses_and_can_be_withdrawn(rx):
    dev, _, old = keyed(rx)
    assert reset(rx, dev["device_id"]).status_code == 200
    rx.clock.advance(svc.RESET_WINDOW_S + 1)
    assert mint(rx, dev["device_id"], Key()).json()["code"] == "device_key_bound"  # lapsed: the pin holds again
    svc.janitor(rx.db)
    assert pin_row(rx, dev["device_id"])["reset_expires_at"] is None
    assert reset(rx, dev["device_id"]).status_code == 200
    assert rx.c.delete(f"{API}/auth/app/devices/{dev['device_id']}/key-reset").status_code == 204
    assert rx.c.delete(f"{API}/auth/app/devices/{dev['device_id']}/key-reset").status_code == 404  # nothing pending
    assert mint(rx, dev["device_id"], Key()).json()["code"] == "device_key_bound"
    assert len(audit_rows(rx, "auth.app_refresh.key_reset_withdrawn")) == 1
    # the old key still consents after all that (the phone was found)
    assert mint(rx, dev["device_id"], None, body=replace_body(rx, dev["device_id"], Key(), old)).status_code == 201


def test_the_key_status_route_shows_no_key_material(rx):
    dev, _, old = keyed(rx)
    st = rx.user("dana").get(f"{ARX}/auth/app/devices/{dev['device_id']}/key").json()
    assert st["pinned"] is True and st["key_fp"] == old.fp[:16] and st["sign_in_live"] is True and st["reset_pending"] is False
    assert old.text not in json.dumps(st) and old.fp not in json.dumps(st)
    assert rx.user("vera").get(f"{ARX}/auth/app/devices/{dev['device_id']}/key").status_code == 403
    reset(rx, dev["device_id"])
    st = rx.c.get(f"{API}/auth/app/devices/{dev['device_id']}/key").json()
    assert st["reset_pending"] is True and st["sign_in_live"] is False and st["reset_expires_at"]


def test_a_live_keyed_family_without_a_pin_row_is_still_pinned(rx):
    # a family bound before migration 0158 that the backfill did not see: the live family's key is the pin
    dev, out, old = keyed(rx)
    with rx.db.connection() as conn:
        conn.execute("DELETE FROM app_refresh_device_keys")
    assert mint(rx, dev["device_id"], Key()).json()["code"] == "device_key_bound"
    assert reset(rx, dev["device_id"]).status_code == 200  # the reset stores the pin first
    assert pin_row(rx, dev["device_id"])["device_key_fp"] == old.fp


def test_pins_are_never_exported_and_follow_their_registration(rx):
    assert "app_refresh_device_keys" in backup.NEVER_EXPORTED_TABLES
    dev, _, _ = keyed(rx)
    with rx.db.connection() as conn:  # the registration row purged: the janitor drops its pin
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute("DELETE FROM app_refresh_families WHERE device_id = ?", (dev["device_id"],))
        conn.execute("DELETE FROM mobile_devices WHERE id = ?", (dev["device_id"],))
    svc.janitor(rx.db)
    assert pin_row(rx, dev["device_id"]) is None
