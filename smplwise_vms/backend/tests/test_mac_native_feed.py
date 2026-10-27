"""Native metadata proof scope; the joint run uses real HA + real Arx."""
import asyncio
from types import SimpleNamespace
import pytest
from smplwise.services import wiskey_native_feed as feed
from smplwise.services.intercom_client import IntercomError


def test_metadata_proof_is_bound_to_real_socket_identity_and_has_fresh_nonce(monkeypatch):
    monkeypatch.setenv(feed.ENV,"1")
    monkeypatch.setattr(feed,"_key",lambda _s:"synthetic-metadata-key")
    sent=[]
    async def call(kind,**fields):
        sent.append((kind,fields))
        if kind=="auth/current_user":
            return {"success":True,"result":{"id":"a"*32}}
        result = ({"kind":feed.SUBSCRIPTION_KIND,"schema_version":1,
            "expires_at":fields["bridge"]["parameters"]["expires_at"]}
            if kind=="hikvision_intercom/subscribe" else {})
        return {"success":True,"result":result}
    async def run():
        bound=await feed.bind_metadata(call,SimpleNamespace())
        await bound("hikvision_intercom/overview")
        await bound("hikvision_intercom/overview")
        await bound("hikvision_intercom/subscribe")
        await bound("subscribe_entities",entity_ids=["sensor.test"])
        await bound("hikvision_intercom/users/create",data={"display_name":"Synthetic"})
    asyncio.run(run())
    proofs=[fields["bridge"] for _kind,fields in sent if "bridge" in fields]
    assert [p["command"] for p in proofs]==["overview","overview","subscribe"]
    assert all(p["query_owner_id"]=="a"*32 for p in proofs)
    assert all(p["parameters"]=={} for p in proofs[:2])
    assert set(proofs[-1]["parameters"])=={"expires_at"}
    assert len({p["nonce"] for p in proofs})==3
    assert sent[-2][1]=={"entity_ids":["sensor.test"]}
    assert sent[-1][1]=={"data":{"display_name":"Synthetic"}}


def test_default_keeps_existing_feed_without_identity_probe(monkeypatch):
    monkeypatch.delenv(feed.ENV,raising=False)
    async def raw(*_a,**_k):
        raise AssertionError("no probe before the opt-in")
    assert asyncio.run(feed.bind_metadata(raw,SimpleNamespace())) is raw


@pytest.mark.parametrize("identity",[None,"", "other",True])
def test_enabled_native_metadata_refuses_unknown_identity(monkeypatch,identity):
    monkeypatch.setenv(feed.ENV,"1")
    async def raw(*_a,**_k):
        return {"success":True,"result":{"id":identity}}
    with pytest.raises(IntercomError):
        asyncio.run(feed.bind_metadata(raw,SimpleNamespace()))


def test_enabled_native_metadata_refuses_missing_key_before_the_read(monkeypatch):
    monkeypatch.setenv(feed.ENV,"1")
    monkeypatch.setattr(feed,"_key",lambda _s:None)
    sent=[]
    async def raw(kind,**fields):
        sent.append(kind)
        return {"success":True,"result":{"id":"b"*32}}
    async def run():
        bound=await feed.bind_metadata(raw,SimpleNamespace())
        with pytest.raises(IntercomError):
            await bound("hikvision_intercom/overview")
    asyncio.run(run())
    assert sent==["auth/current_user"]
