# Public document links: required Cloudflare cache rule (DOCLINKSEC-295, precondition P4)

Source: security review of the public document links, 2026-10-23 (`private/planning/SECURITY_REVIEW_DOCLINKS_2026-10-23.md`,
precondition P4). This note documents a deployment requirement only. It changes no configuration, and the repository cannot check the
Cloudflare dashboard. Until someone verifies the rule live, record it as UNKNOWN.

## Why

Every document link downloads from the same URL, `GET /<prefix>/api/doc/file`. The metadata comes from `GET /<prefix>/api/doc`.
Two downloads differ only by the `X-Ticket-Token` request header. Neither the path nor the query string carries the token. The origin
marks these responses as uncacheable:

- the file response sends `Cache-Control: private, no-store`
- the metadata response sends `no-store`
- the public edge's default is `no-store`
- the origin sends no `ETag`, `Last-Modified` or `Accept-Ranges`, and it strips `Range`

The danger is a CDN rule that ignores these headers. "Cache Everything", or an Edge Cache TTL override on the public hostname, would
key the cache on the URL. The cache would then return one vendor's PDF to the next request, including a request that sends no token.

## Required rule (public hostname of the tickets / documents page)

1. No "Cache Everything" rule and no Edge Cache TTL / Browser Cache TTL override may cover `/<prefix>/*` (default prefix `/support`)
   or `/t/*`.
2. Add a Cache Rule with **Bypass cache** for `/<prefix>/api/*`, or at minimum for `/<prefix>/api/doc*`. Keep "Respect origin
   Cache-Control" on (the default), so `private, no-store` is honoured even if a broader rule is added later.
3. Do not add `X-Ticket-Token` to a custom cache key. The cache must be bypassed, not split by the header.
4. The rules that already exist for the public surface still apply: the rate-limit rule on `/<prefix>/api/*`, and Rocket Loader /
   Email Obfuscation / Bot Fight off for the dedicated hostname (`TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md` 1.8, 5.11).

## Live check before switching `reports.documents` on

- `GET https://<public host>/<prefix>/api/doc/file` with no token must answer `404` with `cf-cache-status: DYNAMIC` or `BYPASS`, or
  with no `cf-cache-status`. It must never answer `HIT`, `MISS` or `EXPIRED`, because `MISS` means the response could be stored.
- Repeat the request twice. The second answer must still not be `HIT`.
- Record the result, with the date and without the host name, in the release's security notes.

`reports.documents` stays OFF by default. This rule is a precondition for turning it on, not a change to the default.
