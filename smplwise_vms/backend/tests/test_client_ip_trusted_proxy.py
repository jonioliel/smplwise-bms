"""PUB-01 (public review 2026-10-20): the remote channel believes CF-Connecting-IP / X-Forwarded-For only from a trusted
proxy peer (the hassio network, like the public listener's ratelimit.classify_client); any other TCP peer is keyed by itself."""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from smplwise.services import ha_user_auth as hua


def conn(peer: str | None, **headers: str):
    return SimpleNamespace(headers={k.lower(): v for k, v in headers.items()}, client=SimpleNamespace(host=peer) if peer is not None else None)


@pytest.mark.parametrize("peer", ["172.30.32.5", "172.30.33.9"])
def test_a_hassio_network_peer_is_believed_as_before(peer):
    assert hua.client_ip(conn(peer, **{"CF-Connecting-IP": "203.0.113.7"})) == "203.0.113.7"
    assert hua.client_ip(conn(peer, **{"X-Forwarded-For": "198.51.100.1, 172.30.33.2"})) == "198.51.100.1"
    assert hua.client_ip(conn(peer)) == peer


@pytest.mark.parametrize("peer", ["192.168.1.20", "203.0.113.50", "2001:db8::1"])
def test_any_other_tcp_peer_cannot_choose_its_address(peer):
    assert hua.client_ip(conn(peer, **{"CF-Connecting-IP": "198.51.100.99"})) == peer
    assert hua.client_ip(conn(peer, **{"X-Forwarded-For": "198.51.100.99"})) == peer
    a = hua.limit_ip(hua.client_ip(conn(peer, **{"CF-Connecting-IP": "198.51.100.1"})))
    b = hua.limit_ip(hua.client_ip(conn(peer, **{"CF-Connecting-IP": "198.51.100.2"})))
    assert a == b, "rotating the header does not move the limiter bucket"


def test_no_tcp_peer_keeps_the_header_behaviour():
    """An in-process ASGI client (tests) or a unix socket has no peer address; the header is the only source there."""
    assert hua.client_ip(conn(None, **{"CF-Connecting-IP": "203.0.113.7"})) == "203.0.113.7"
    assert hua.client_ip(conn("testclient", **{"CF-Connecting-IP": "203.0.113.7"})) == "203.0.113.7"
