"""The vendor page photographs through <input capture>, never a live getUserMedia stream, so the public
Permissions-Policy must stay exactly as restrictive as before (camera=() included)."""
from __future__ import annotations

from smplwise.services.tickets import public_http


def test_public_permissions_policy_unchanged_and_camera_denied():
    headers = dict(public_http.SECURITY_HEADERS)
    assert headers[b"permissions-policy"] == b"camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    assert b"camera=(self)" not in headers[b"permissions-policy"]
