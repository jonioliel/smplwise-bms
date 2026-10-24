# NOTICEGB-295 - notice board: security fixes (slice G) and building-status chips (slice B)

Base: `pilot/NOTICEADD-295` @ 65da82d90. No migration. Everything stays behind `notices.enabled` / the add-on option `notice_boards`.

## Slice G - security (2.16.0 "fix before enable" items 2 and 3)
* `services/notices/sources.py`: the custom-RSS fetch is now `fetch_feed` / `check_feed_url`. https only, port 443 only, no credentials in
  the URL, no local names (`.local`, `.lan`, single-label, ...), decimal/octal/short IPv4 forms refused as syntax. The host is resolved and
  EVERY answer must be globally routable (reuses `partner.ssrf.address_refused`: private, loopback, link-local/metadata, CGNAT, multicast,
  reserved, ULA, mapped/NAT64/6to4 forms; IPv4 and IPv6). The connection goes to the checked address (TLS SNI/certificate and Host stay the
  feed name), so a DNS answer that changes after the check cannot steer the request. Redirects are followed by hand (max 3), each hop
  re-validated. Body cap 512 KB (header and streamed), total time cap 15 s, 8 s per socket operation, `Accept-Encoding: identity`. Failures
  are logged by class only, never the URL. Test seams: `RESOLVE`, `CONNECT`, `fetch_feed(resolve=, connect=, clock=)`.
* `services/notices/listener.py`: `_CappedServer` (32 simultaneous connections; over the cap the socket is closed with no thread) and a 10 s
  socket timeout on every connection.
* `notices.news_custom` now defaults to `false`. A stored value always wins (only a missing row takes the default). While it is off, a
  board saved earlier with a custom feed no longer fetches it (`display.build_feed` keeps curated URLs only); saving a new custom feed
  was already refused. `model._feed` also refuses credentials in a feed URL.

## Slice B - building-status chips
* `services/notices/info.py` (new): `build(conn, kinds, lang)` returns `info[]` items `{kind, label, state, text}` for the kinds a board asked
  for: elevators (enabled `infra_elevators`, worst state wins), generator (`generator_devices`, engine state + availability). Read-only; a
  missing/empty module, a stale mirror or any read error yields no chip or an honest "unavailable" chip, never an error. States only: no
  names, ids, counts of people. `parking` and `gym` are accepted kinds but no module in the product exposes a state for them yet, so they
  produce no chip (register a provider in `info.PROVIDERS` when one exists).
* `model.py`: `DISPLAY_DEFAULTS.blocks.info` = all four kinds (owner answer 258: on where the module exists). Boards created by 2.16.0 stored
  `[]` explicitly and keep it (they never ran in production: the module is OFF).
* `display.py::build_feed`: 3 lines + the import (`info` key only when there is at least one chip).
* Frontend: `notices/display-info.ts` (`<notice-display-info>` picker: מצב הבניין with מעליות / גנרטור / חניה פנויה / חדר כושר, "סמלים בלבד,
  ללא פרטים"), one import and one tag in `displayTab()`, i18n keys. The TV renderer (`notice-tv/main.ts` chips) already matched
  `tv.html` (same `.ch` markup and CSS), so it is unchanged.

## Shared-file edits (kept tiny)
`screens/system-notices.ts`: 1 import + 1 tag in `displayTab()`. `i18n/notices.ts`: 6 new keys (he, en) and `notBuilt` no longer mentions the
building status. `model.py`: the default and one validation line in `_feed`. `display.py`: build_feed hook. `tests/evidence-notices.spec.ts`:
one test appended at the end. `tests/test_notices_106.py`: `info` added to the allowed feed keys.

## Tests
`test_notices_security_295.py` (SSRF cases with a fake resolver/transport incl. DNS rebinding, redirects, caps; listener timeout and cap;
news_custom default and stored-value precedence), `test_notices_info_295.py`, evidence spec `board page: the building-status picker ...`.

## Expected pixel-baseline changes
None: the TV page and `pixel-notice-tv-mock` are untouched. The display-tab evidence screenshot gains one row (not a baseline).
