"""BACKUP-HASH-ENC (owner decision 2026-10-17): the local accounts' password hashes (and the media HMAC keys) stay in the project
backup but ONLY encrypted with a backup password the administrator types. Negative cases first: no password (omitted, never
plaintext), a weak password, restore without / with a wrong password, a changed ciphertext, a changed header, a truncated archive,
downgrade attempts (header removed, header switched to "omitted", plaintext injected next to an encrypted section), key-derivation
settings out of range; then the good paths: the round trip, "restore without the passwords" (kept current / needs a reset), an
archive from before the rule (plaintext, imported with a warning), and the password never reaching logs, audit rows or answers.
Fakes only: no Home Assistant, no device."""
from __future__ import annotations

import base64
import io
import json
import logging
import zipfile

import pytest

from test_local_identity import GOOD, Lx
from smplwise.services import backup as svc
from smplwise.services import backup_sensitive as sens
from smplwise.services import ha_user_auth as hua

PW = "correct horse battery staple"
ITEM_SECRET = "a1" * 24


@pytest.fixture()
def bx(settings, tmp_path, monkeypatch):
    a = Lx(settings, tmp_path, monkeypatch)
    monkeypatch.setattr(sens, "_kdf_override", sens.Kdf(10, 8, 1))  # cheap derivation in tests (the import range allows it)
    a.enable()
    created, _c = a.ready("maria")
    a.uid = created["user"]["id"]
    with a.db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES ('multimedia.item_secret', ?)", (ITEM_SECRET,))
    yield a
    hua.reset_for_tests()


def _hash(bx) -> str | None:
    rows = bx.rows("SELECT password_hash FROM auth_local_credentials WHERE user_id = ?", (bx.uid,))
    return rows[0]["password_hash"] if rows else None


def _export(bx, password: str | None = PW):
    body = {"note": "t"} if password is None else {"note": "t", "backup_password": password}
    return bx.admin.post("/api/v1/backups", json=body)


def _zip_bytes(bx, name: str) -> bytes:
    return (svc.backups_dir(bx.settings) / name).read_bytes()


def _rewrite(raw: bytes, *, manifest=None, drop=(), replace=None) -> bytes:
    """A copy of an archive with the manifest edited (a function of the dict), members dropped or replaced."""
    replace = replace or {}
    out = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as src, zipfile.ZipFile(out, "w") as dst:
        for n in src.namelist():
            if n in drop:
                continue
            data = src.read(n)
            if n in replace:
                data = replace[n](data)
            if n == "manifest.json" and manifest is not None:
                m = json.loads(data)
                manifest(m)
                data = json.dumps(m).encode("utf-8")
            dst.writestr(n, data)
    return out.getvalue()


def _upload(bx, raw: bytes) -> str:
    r = bx.admin.post("/api/v1/backups/upload", files={"file": ("x.zip", raw, "application/zip")})
    assert r.status_code == 201, r.text
    return r.json()["name"]


def _restore(bx, name: str, **body):
    return bx.admin.post(f"/api/v1/backups/{name}/restore", json={"mode": "replace", "scope": "project+access", "confirm": "RESTORE", **body})


def _wipe_maria(bx):
    with bx.db.connection() as conn:
        conn.execute("DELETE FROM auth_local_credentials WHERE user_id = ?", (bx.uid,))


# ---------------------------------------------------------------- export: never plaintext


def test_export_without_password_omits_the_section_never_plaintext(bx):
    r = _export(bx, None)
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["sensitive"] == {"state": "omitted", "counts": {"password_hashes": 1, "settings": 1}}
    raw = _zip_bytes(bx, e["name"])
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert sens.MEMBER not in z.namelist()
        text = "".join(z.read(n).decode("utf-8", "replace") for n in z.namelist() if n.endswith(".json"))
        creds = json.loads(z.read("data/auth_local_credentials.json"))
    assert "$scrypt$" not in text and ITEM_SECRET not in text and _hash(bx) not in text
    assert creds and all("password_hash" not in r for r in creds)


def test_weak_or_oversized_password_is_refused_and_writes_nothing(bx):
    before = list(svc.backups_dir(bx.settings).glob("*.zip"))
    r = _export(bx, "short")
    assert r.status_code == 422 and r.json()["code"] == "backup_password_weak"
    assert "short" not in r.text
    r = _export(bx, "x" * 1025)
    assert r.status_code == 422 and r.json()["code"] == "backup_password_too_long"
    assert list(svc.backups_dir(bx.settings).glob("*.zip")) == before


def test_export_with_password_seals_the_section(bx):
    r = _export(bx)
    assert r.status_code == 201, r.text
    e = r.json()
    assert e["sensitive"] == {"state": "encrypted", "counts": {"password_hashes": 1, "settings": 1}}
    raw = _zip_bytes(bx, e["name"])
    assert b"$scrypt$" not in raw and ITEM_SECRET.encode() not in raw and PW.encode() not in raw
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        h = json.loads(z.read("manifest.json"))["sensitive"]
        assert sens.MEMBER in z.namelist()
    assert h["aead"] == "AES-256-GCM" and h["kdf"]["name"] == "scrypt" and len(base64.b64decode(h["kdf"]["salt"])) == 16
    assert len(base64.b64decode(h["nonce"])) == 12
    # a second export uses a fresh salt and nonce
    h2 = json.loads(zipfile.ZipFile(io.BytesIO(_zip_bytes(bx, _export(bx).json()["name"]))).read("manifest.json"))["sensitive"]
    assert h2["kdf"]["salt"] != h["kdf"]["salt"] and h2["nonce"] != h["nonce"]


def test_production_kdf_parameters_are_strong():
    assert sens.KDF.log_n >= 17 and sens.KDF.r == 8 and sens.KDF.p >= 1
    assert sens.KDF_LOG_N_RANGE[1] == sens.KDF.log_n  # import never accepts a costlier derivation than this build writes


# ---------------------------------------------------------------- restore: refusals happen before anything is written


def test_restore_without_password_is_refused_and_changes_nothing(bx):
    name = _export(bx).json()["name"]
    _wipe_maria(bx)
    r = _restore(bx, name)
    assert r.status_code == 409 and r.json()["code"] == "backup_password_required" and r.json()["details"]["can_skip"] is True
    assert _hash(bx) is None  # nothing restored


def test_wrong_password_is_refused_and_changes_nothing(bx):
    name = _export(bx).json()["name"]
    _wipe_maria(bx)
    r = _restore(bx, name, backup_password="this is not the password")
    assert r.status_code == 409 and r.json()["code"] == "backup_password_wrong" and r.json()["details"]["can_skip"] is True
    assert "this is not the password" not in r.text
    assert _hash(bx) is None


def test_tampered_ciphertext_is_refused(bx):
    raw = _zip_bytes(bx, _export(bx).json()["name"])
    flip = lambda b: b[:20] + bytes([b[20] ^ 1]) + b[21:]  # noqa: E731
    name = _upload(bx, _rewrite(raw, replace={sens.MEMBER: flip}))
    r = _restore(bx, name, backup_password=PW)
    assert r.status_code == 409 and r.json()["code"] == "backup_password_wrong"


@pytest.mark.parametrize("edit", [
    lambda m: m["sensitive"]["counts"].update(password_hashes=9),     # the header is authenticated
    lambda m: m.update(created_at="2020-01-01T00:00:00Z"),           # so is the archive it belongs to
    lambda m: m.update(schema_version=1),
])
def test_tampered_header_or_binding_is_refused(bx, edit):
    raw = _zip_bytes(bx, _export(bx).json()["name"])
    name = _upload(bx, _rewrite(raw, manifest=edit))
    r = _restore(bx, name, backup_password=PW)
    assert r.status_code == 409 and r.json()["code"] == "backup_password_wrong"


def test_truncated_archive_is_refused_unless_the_operator_skips(bx):
    raw = _zip_bytes(bx, _export(bx).json()["name"])
    name = _upload(bx, _rewrite(raw, drop=(sens.MEMBER,)))
    r = _restore(bx, name, backup_password=PW)
    assert r.status_code == 409 and r.json()["code"] == "backup_sensitive_damaged" and r.json()["details"]["can_skip"] is True
    short = _upload(bx, _rewrite(raw, replace={sens.MEMBER: lambda b: b[: len(b) // 2]}))
    assert _restore(bx, short, backup_password=PW).json()["code"] == "backup_password_wrong"
    ok = _restore(bx, name, backup_password=PW, skip_sensitive=True)
    assert ok.status_code == 200, ok.text
    assert ok.json()["sensitive"]["skipped"] == "backup_sensitive_damaged"


def test_downgrade_header_removed_is_refused_even_with_skip(bx):
    raw = _zip_bytes(bx, _export(bx).json()["name"])
    name = _upload(bx, _rewrite(raw, manifest=lambda m: m.pop("sensitive")))
    for body in ({"backup_password": PW}, {"skip_sensitive": True}):
        r = _restore(bx, name, **body)
        assert r.status_code == 409 and r.json()["code"] == "backup_sensitive_invalid" and r.json()["details"]["can_skip"] is False


def test_downgrade_header_switched_to_omitted_is_refused(bx):
    raw = _zip_bytes(bx, _export(bx).json()["name"])
    name = _upload(bx, _rewrite(raw, manifest=lambda m: m.update(sensitive={"v": 1, "state": "omitted", "counts": {}})))
    r = _restore(bx, name, skip_sensitive=True)
    assert r.status_code == 409 and r.json()["code"] == "backup_sensitive_invalid"


def _inject_plaintext(uid: str, phc: str):
    def edit(b: bytes) -> bytes:
        rows = json.loads(b)
        for r in rows:
            if r["user_id"] == uid:
                r["password_hash"] = phc
        return json.dumps(rows).encode("utf-8")
    return edit


def test_downgrade_plaintext_next_to_an_encrypted_section_is_ignored(bx):
    real = _hash(bx)
    attacker = "$scrypt$ln=10,r=8,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    raw = _zip_bytes(bx, _export(bx).json()["name"])
    name = _upload(bx, _rewrite(raw, replace={"data/auth_local_credentials.json": _inject_plaintext(bx.uid, attacker)}))
    _wipe_maria(bx)
    r = _restore(bx, name, backup_password=PW)
    assert r.status_code == 200, r.text
    assert _hash(bx) == real and r.json()["sensitive"]["plaintext_ignored"] == 1
    # with the section skipped the injected value is still never used: the account needs a reset
    _wipe_maria(bx)
    r = _restore(bx, name, skip_sensitive=True)
    assert r.status_code == 200 and _hash(bx) is None and r.json()["passwords"]["need_reset"] == [bx.uid]


def test_downgrade_omitted_archive_with_injected_plaintext_is_ignored(bx):
    raw = _zip_bytes(bx, _export(bx, None).json()["name"])
    name = _upload(bx, _rewrite(raw, replace={"data/auth_local_credentials.json": _inject_plaintext(bx.uid, "$scrypt$ln=10,r=8,p=1$AA$AA")}))
    _wipe_maria(bx)
    r = _restore(bx, name)
    assert r.status_code == 200 and _hash(bx) is None and r.json()["sensitive"]["plaintext_ignored"] == 1


def test_kdf_settings_out_of_range_are_refused_before_any_derivation(bx, monkeypatch):
    raw = _zip_bytes(bx, _export(bx).json()["name"])
    name = _upload(bx, _rewrite(raw, manifest=lambda m: m["sensitive"]["kdf"].update(ln=30)))
    monkeypatch.setattr(sens, "_derive", lambda *a, **k: pytest.fail("derivation must not run"))
    for body in ({"backup_password": PW}, {"skip_sensitive": True}):
        r = _restore(bx, name, **body)
        assert r.status_code == 409 and r.json()["code"] == "backup_sensitive_invalid"


def test_malformed_payload_under_a_valid_tag_is_refused():
    binding = {"format": 1, "created_at": "2026-10-17T00:00:00Z", "schema_version": 1}
    header, blob = sens.seal({"password_hashes": {"u1": "not-a-phc"}, "settings": {}}, PW, binding)
    with pytest.raises(sens.SensitiveError) as exc:
        sens.unseal(header, blob, PW, binding)
    assert exc.value.code == "backup_sensitive_damaged"
    header, blob = sens.seal({"password_hashes": {}, "settings": {"bridge.secret": "x"}}, PW, binding)
    with pytest.raises(sens.SensitiveError):
        sens.unseal(header, blob, PW, binding)  # only SENSITIVE_SETTINGS keys may come back


# ---------------------------------------------------------------- good paths


def test_round_trip_with_the_password_brings_the_hash_and_the_keys_back(bx):
    real = _hash(bx)
    name = _export(bx).json()["name"]
    _wipe_maria(bx)
    with bx.db.connection() as conn:
        conn.execute("DELETE FROM settings WHERE key = 'multimedia.item_secret'")
    r = _restore(bx, name, backup_password=PW)
    assert r.status_code == 200, r.text
    assert _hash(bx) == real
    assert bx.rows("SELECT value FROM settings WHERE key = 'multimedia.item_secret'") == [{"value": ITEM_SECRET}]
    body = r.json()
    assert body["sensitive"]["state"] == "encrypted" and body["sensitive"]["restored"] is True
    assert body["passwords"]["restored"] == 1 and body["passwords"]["need_reset"] == []
    assert bx.sign_in(bx.remote(), "maria", GOOD).status_code == 200


def test_skip_keeps_the_current_hash_on_the_same_host_and_needs_a_reset_otherwise(bx):
    real = _hash(bx)
    name = _export(bx).json()["name"]
    r = _restore(bx, name, skip_sensitive=True)
    assert r.status_code == 200, r.text
    assert _hash(bx) == real and r.json()["passwords"]["kept_current"] == 1 and r.json()["sensitive"]["skipped"] == "operator_skipped"
    assert bx.rows("SELECT value FROM settings WHERE key = 'multimedia.item_secret'") == [{"value": ITEM_SECRET}]  # kept current
    _wipe_maria(bx)  # as on a new host: no current hash for that account
    r = _restore(bx, name, skip_sensitive=True)
    assert r.status_code == 200 and _hash(bx) is None and r.json()["passwords"]["need_reset"] == [bx.uid]
    assert bx.sign_in(bx.remote(), "maria", GOOD).status_code != 200


def test_wrong_password_with_skip_restores_the_rest(bx):
    name = _export(bx).json()["name"]
    r = _restore(bx, name, backup_password="still not the password", skip_sensitive=True)
    assert r.status_code == 200 and r.json()["sensitive"]["skipped"] == "backup_password_wrong"


def test_old_archive_with_plaintext_hashes_still_imports_with_a_warning(bx, caplog):
    real = _hash(bx)
    raw = _zip_bytes(bx, _export(bx, None).json()["name"])
    legacy = _rewrite(raw, manifest=lambda m: m.pop("sensitive"), replace={"data/auth_local_credentials.json": _inject_plaintext(bx.uid, real)})
    name = _upload(bx, legacy)
    listing = {b["name"]: b for b in bx.admin.get("/api/v1/backups").json()["backups"]}
    assert listing[name]["sensitive"] == {"state": "legacy"}
    _wipe_maria(bx)
    caplog.set_level(logging.WARNING)
    r = _restore(bx, name)
    assert r.status_code == 200, r.text
    assert _hash(bx) == real and r.json()["sensitive"]["state"] == "legacy" and r.json()["passwords"]["legacy_plaintext"] is True
    assert "stored in the clear" in caplog.text


def test_the_password_never_reaches_logs_audit_rows_or_answers(bx, caplog):
    caplog.set_level(logging.DEBUG)
    e = _export(bx)
    name = e.json()["name"]
    answers = [e.text, _restore(bx, name, backup_password="a wrong guess 12345").text, _restore(bx, name, backup_password=PW).text,
               bx.admin.get(f"/api/v1/backups/{name}").text, bx.admin.get("/api/v1/backups").text]
    audit_text = json.dumps(bx.rows("SELECT details_json, reason FROM audit_log WHERE action LIKE 'backup.%'"), ensure_ascii=False)
    for secret in (PW, "a wrong guess 12345"):
        assert secret not in audit_text and secret not in caplog.text and all(secret not in a for a in answers)
    created = [json.loads(r["details_json"]) for r in bx.rows("SELECT details_json FROM audit_log WHERE action = 'backup.create'")]
    assert created[-1]["sensitive"] == "encrypted"


def test_automatic_backups_omit_the_section(bx):
    with bx.db.connection() as conn:
        e = svc.create(bx.settings, conn, "auto-daily", "daily")
    assert e["sensitive"]["state"] == "omitted"
    assert b"$scrypt$" not in _zip_bytes(bx, e["name"])
