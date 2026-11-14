"""PARTNERAPI113-295 (docs/changes/CR-PARTNERAPI113.md): the partner interface - scoped partner tokens for the read API at /p/v1 (served by
the existing public listener) and signed outgoing webhooks. LAB ONLY: both switches are OFF by default and switching either ON is refused
while `core.GO_LIVE_PERMITTED` is False (owner answer 171: nothing on a real installation before the security review of the public surface
and the owner's approval of the first destination)."""
