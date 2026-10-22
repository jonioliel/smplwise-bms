"""CR-FLEET215: the receiver's committed schema and signed fixture must equal what the add-on's code produces now.

If this fails, regenerate with `services/fleet-receiver/tools/gen_fixtures.py` (see that folder's README). The fixture is signed with a
THROWAWAY test key enrolled nowhere; it proves the TypeScript verifier accepts what the Python signer produces."""
from __future__ import annotations

import base64
import importlib.util
import json
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric import ed25519

from smplwise.services import fleet_keys
from smplwise.services import fleet_report as fr

RECEIVER = Path(__file__).resolve().parents[3] / "services" / "fleet-receiver"


def _gen():
    spec = importlib.util.spec_from_file_location("gen_fixtures", RECEIVER / "tools" / "gen_fixtures.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _load(rel: str):
    return json.loads((RECEIVER / rel).read_text(encoding="utf-8"))


def test_the_receiver_schema_equals_the_addon_schema():
    assert _load("src/schema.json") == json.loads(json.dumps(fr.schema_json())), "run services/fleet-receiver/tools/gen_fixtures.py"


def test_the_signed_fixture_equals_what_the_signer_produces_now():
    _, fixture = _gen().build()
    assert _load("test/fixtures/signed_report.json") == fixture, "run services/fleet-receiver/tools/gen_fixtures.py"


def test_the_fixture_validates_and_verifies_with_the_published_throwaway_key():
    fx = _load("test/fixtures/signed_report.json")
    fr.validate(json.loads(fx["body"]))
    pub = ed25519.Ed25519PublicKey.from_public_bytes(base64.b64decode(fx["public_key"]))
    pub.verify(base64.b64decode(fx["signature"]), fleet_keys.CONTEXT + fx["body"].encode("ascii"))
    assert fx["context"] == fleet_keys.CONTEXT.decode("ascii")
    assert fx["enrollment_code"].startswith("arx-fleet-1.") and "PRIVATE" not in json.dumps(fx)
