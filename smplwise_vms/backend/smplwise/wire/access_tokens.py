"""Response models of the user's own access-token list (routers/access_tokens.py, `/api/v1/auth/tokens...`; MFA-TOKENS-2490, slice 6 of
the MFA train). Never a token, never an HA refresh-token id, never a full address: ids are hashes, addresses are masked (/24, /48)."""
from __future__ import annotations

from typing import Literal

from . import WireModel

# every route answers JSON
NO_JSON: frozenset[str] = frozenset()

Kind = Literal["long_lived", "short_lived", "unknown", "app"]


class TokenRow(WireModel):
    """One token. `source` ha = Home Assistant's own list (read-only in Arx: revoke it in Home Assistant); arx = what Arx itself knows
    (a token Arx issued - `kind` app, revocable - or, when HA could not be asked, an HA token Arx saw on the bearer path). `kind`
    long_lived = a long-lived access token (exempt from step-up, owner decision Q48); short_lived = a normal sign-in; app = the phone
    app's saved sign-in. The `arx_*` fields: when and from where (masked) Arx saw the token used from outside; null when never."""
    id: str
    source: Literal["ha", "arx"]
    kind: Kind
    name: str | None
    client: str | None
    created_at: str | None
    last_used_at: str | None
    expires_at: str | None
    current: bool
    revocable: bool
    used_in_arx: bool
    arx_first_seen_at: str | None
    arx_last_seen_at: str | None
    arx_address: str | None
    arx_agent: str | None


class TokenList(WireModel):
    """`GET /auth/tokens`: the caller's own tokens. `ha_listed`: Home Assistant answered and the HA rows are its own list; otherwise
    `ha_reason` says why not (local_channel: opened through Home Assistant itself, no token held; local_user: an Arx-only identity has
    no HA tokens; no_ha_token: this sign-in holds no HA token; ha_unavailable: HA could not be asked - the rows are what Arx saw).
    `app_enabled`: the phone app's saved sign-ins are switched on (security.app_refresh)."""
    ha_listed: bool
    ha_reason: Literal["local_channel", "local_user", "no_ha_token", "ha_unavailable"] | None
    tokens: list[TokenRow]
    app_enabled: bool


class TokensRevoked(WireModel):
    """`DELETE /auth/tokens/{id}` and `DELETE /auth/tokens`: how many tokens Arx issued were revoked (never an HA token)."""
    revoked: int
