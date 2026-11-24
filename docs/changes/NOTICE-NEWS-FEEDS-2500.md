# NOTICE-NEWS-FEEDS-2500 - notice board news feeds: compressed bodies, the Calcalist address, source health

Branch `pilot/NOTICE-NEWS-FEEDS-2500`, cut from `origin/main` at v2.49.0 (d0c456399).

## Problem (lab, 24.11)

Of the four curated news sources only ynet and Globes produced titles on the lab notice board:

- **Walla** (`rss.walla.co.il/feed/1`, redirected to `www.walla.co.il/rss/feed/news/israel`): the server answers a gzip body
  (`1f 8b`) although the fetcher sends `Accept-Encoding: identity`, and does not say so in `Content-Encoding`. The bytes reached
  the safe XML parser, which refused them (`UnsafeXml: only UTF-8 device documents are accepted`).
- **Calcalist** (`www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml`): HTTP 404, the feed address is gone (`FetchRefused("status")`).
- A failing source showed nothing on the board and the managers were never told.

## Changes

### 1. Compressed feed bodies (`services/notices/sources.py`)

- `decode_body()` after the guarded read: gzip is recognised by its magic bytes whatever the header says; deflate by
  `Content-Encoding: deflate` (zlib-wrapped, else raw) or by a zlib stream header. A `gzip` header over a plain body passes the
  body as it is. Any other coding (`br`, `zstd`, more than one layer) -> `FetchRefused("encoding")`.
- `_inflate()` stream-inflates with `max_length` on every step: at most `NEWS_MAX_BYTES + 1` bytes are ever produced, so a
  decompression bomb stops at the cap -> `FetchRefused("size")`. Truncated / broken streams -> `FetchRefused("encoding")`.
- Every existing guard is unchanged: the SSRF check of every hop, the pinned address, redirects, the total and per-socket timeouts
  and the wire cap (`NEWS_MAX_BYTES` on the compressed body too). The request still asks for `identity`.
- Non-UTF-8 XML: **left as is.** The product's safe parser (`services/xmlsafe.py`, security review L1) accepts only UTF-8 / ASCII
  and refuses any other declared encoding by design; it does not support one, so the fetcher does not either. All four curated
  feeds are UTF-8.

### 2. Calcalist (`services/notices/model.py`, `services/notices/news_sources.py`)

- The curated seed now uses `https://www.calcalist.co.il/Integration/StoryRss3674.xml` ("calcalist - ערוץ 24/7", the site's own
  feed on the platform ynet's feed also uses). Verified from the test server with the product's `fetch_feed` + `parse_feed`: 8
  titles, items of the same day. The section feed `StoryRss8.xml` ("דף הבית") also answers but its newest item was 5 days old, so the
  24/7 channel was chosen.
- `RETIRED_NEWS_URLS = {old: new}` and `current_news_url()`. Following the NOTICERSS-295 "seed on read" rule (no migration, no
  start-up write): a stored source list and a board's stored feeds read the retired address as its replacement
  (`_clean_stored`, `model._feed` - so the board read, the board save and the feed resolution all see the working address). When
  the stored list already holds the replacement address too, the retired row is left out (never the same address twice, which the
  editor would refuse to save). The next save stores the new address. Only that exact curated address is rewritten; every other
  (custom) address is kept byte for byte.

### 3. Source health for the managers

- `NewsCache` keeps per URL the time of the last good fetch and the reason code of the last failure (`failure_code()`:
  the `FetchRefused` codes - status, size, encoding, timeout, dns, redirect(s), address/name/scheme/port/credentials/syntax -
  plus xml, tls, network, error, and `empty` for a feed with no titles, which now keeps its last good titles). The log line
  carries the code only, never the URL.
- `news_sources.listing()` adds `last_ok_at` (ISO UTC) and `last_error` to every row, so `GET/PUT /notices/news-sources`, the logo
  routes and the settings document (`news_sources`, which the editor reads) carry them. Both are null while no board fetched the
  feed since the add-on started; reading the list never starts a fetch.
- Wire models `NoticeNewsSource` / `NoticeNewsSources` (`wire/notices.py`) on the four JSON news-source routes; generated
  `frontend/src/api/generated/wire-notices.ts` and `contracts/API_INVENTORY.md` regenerated with `scripts/gen_wire_types.py` and
  `scripts/api_inventory.py`; `api/notices.ts` `NewsSource` / `NewsSourcesAnswer` now derive from the generated models.
- The sources editor (`notices/news-sources.ts`, `notices/news-model.ts healthOf`) shows a small `chip[data-look=warn]` "לא עובד ·
  <reason>" / "Not working · <reason>" on a row whose last fetch failed; its title says when it last worked. No chip for a working
  source, one never fetched, a new row, or a row whose address was edited since the result. Hebrew + English strings
  (`i18n/notices.ts`, `i18n/lang/en/i18n/notices.ts`).

Not touched (another agent's area): `frontend/src/screens/system-notices.ts`, the board patch / preview routes of
`routers/notices.py` (only the news-source route decorators and a docstring changed there).

## Tests

Written in the branch:

- `smplwise_vms/backend/tests/test_notice_news_feeds_2500.py` - gzip with header, gzip magic without a header (the Walla case,
  including the old `UnsafeXml`), deflate zlib-wrapped / raw / sniffed, plain body untouched, decompression bomb refused as
  `size` with every inflate step bounded (spy on `zlib.decompressobj`), the inclusive cap, broken / unknown / layered codings
  -> `encoding`, the wire cap and SSRF guard still first, `Accept-Encoding: identity` still sent; the curated seed and the retired
  map; a stored list with the dead address reads the new one (idempotent, nothing written on read, a custom address untouched,
  a duplicate retired row dropped); saving stores the new address; board feeds (load_display, board create, resolve, not listed
  as custom); `failure_code`; the cache's health (never fetched / failure / success / `empty` keeps titles / later failure keeps
  `last_ok_at`, the log has no URL); the API list, the settings document and the PUT answer carry the health, and reading never
  fetches.
- `frontend/tests/unit-notice-news-feeds-2500.spec.ts` - `healthOf` (reasons, unknown code, no chip for working / never fetched /
  new / edited address, an older backend).
- `frontend/tests/evidence-notice-news-feeds-2500.spec.ts` (mocked, desktop + mobile) - the chip and its reason and title in
  Hebrew, English, the chip inside its row on the phone, an edited address hides it until discarded, card shots light + dark.

Results (24.11.2026):

| Check | Where | Result |
| --- | --- | --- |
| `ruff check` of the changed backend files and the new test file | PC | PASS |
| Real feeds with the branch's `fetch_feed` + `parse_feed` (ynet, Globes, Calcalist new address, Walla) | test server, public internet | PASS: 8 titles each; the retired Calcalist address still answers `status` (404) |
| `scripts/gen_wire_types.py`, `scripts/api_inventory.py` (regenerated, committed) | test server | run, output committed |
| backend pytest (notices, wire, error-contract shard, `SW_WIRE_STRICT=1`) | test server | NOT_RUN |
| `gen_wire_types --check`, inventory unchanged, ruff in the job | test server | NOT_RUN |
| tsc, eslint (changed files), vite build | test server | NOT_RUN |
| unit specs (`unit-notice-news-feeds-2500`, `unit-noticerss-295`, `unit-i18n-en-ratchet-2490`) | test server | NOT_RUN |
| evidence spec desktop + mobile, related `evidence-notices` / `evidence-noticedel-295` | test server | NOT_RUN |
| before / after shots for the compare page | test server | NOT_RUN |

NOT_RUN: the combined job was queued in slot B at about 10:28 UTC behind ~15 jobs; at 13:42 UTC it had never started and its
queued process was gone. The job is self-contained (it creates and removes its own worktrees):
`~/work/slotb.sh ~/work/newsfeeds_job.sh` on the test server; results and shots land in `~/work/newsfeeds-results/`.

## Rollback

Revert the branch commits. No migration, no stored data rewritten (the address upgrade happens on read; a list saved after this
change keeps the new Calcalist address, which is also correct on the old code).
