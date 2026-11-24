/**
 * MFA-TOKENS-2490 (slice 6 of the MFA train): the user's own access tokens (החשבון שלי › אסימוני גישה). Home Assistant's tokens are
 * shown read-only (Arx never revokes or changes them - they are revoked in Home Assistant › Profile › Security); the tokens Arx issued
 * itself (the phone app's saved sign-ins) can be revoked here. Shapes: generated from smplwise/wire/access_tokens.py.
 */
import { api, get } from './client';
import type { TokenList, TokenRow, TokensRevoked } from './generated/wire-access-tokens';

export type { TokenList, TokenRow };

export const listAccessTokens = () => get<TokenList>('auth/tokens');
/** One token Arx issued (`arf_...`). An HA token answers 409 `token_managed_in_ha`. */
export const revokeAccessToken = (id: string) => api<TokensRevoked>(`auth/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
/** Every token Arx issued to the caller (never an HA token). */
export const revokeAllAccessTokens = () => api<TokensRevoked>('auth/tokens', { method: 'DELETE' });
