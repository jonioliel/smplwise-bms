# Upstream watch

SmplWise Arx stands on platforms and projects we do not control: Home Assistant (monthly releases), the Supervisor and
Ingress, go2rtc, Hikvision firmware, the owner's WisKey integration, Music Assistant, Cloudflare, browsers and a few dozen
libraries. The upstream watch keeps one registry of all of them and a script that reports what changed upstream, so that
anything that can hurt us is prepared for before it reaches a customer system.

| File | Role |
|---|---|
| `management/upstream_watch.json` | Canonical registry (hand-edited, reviewed like code). One item per dependency. |
| `scripts/upstream_check.py` | Read-only checker (Python standard library only). Prints a Markdown or JSON report. |
| `smplwise_vms/backend/tests/test_upstream_watch.py` | Offline tests for the checker and for the registry itself. |
| this document | How to run it, extend it and react to what it finds. |

Rule of thumb: **whenever the owner hands us an integration, a repository or a URL, add it to the registry in the same
turn.** The registry is also where "what depends on what" is written down, so a change can be traced to our files.

## The registry

Top level: `schema_version` (1), `generic_keywords`, `items`. Each item:

| Field | Meaning |
|---|---|
| `id` | Lowercase slug, unique (`ha-core`, `py-fastapi`, `npm-lit`). |
| `name`, `note` | Human name; one paragraph on how we use it and why a change would hurt. |
| `kind` | `platform`, `addon`, `integration`, `library`, `vendor-api`, `tool` or `design-reference`. |
| `status` | `in-use` (shipped code, a deployed system or an adopted reference depends on it) or `planned` (decided or under evaluation, nothing relies on it yet). |
| `priority` | `P0` breaks the product if it changes (HA core, Supervisor, go2rtc, NVR firmware, WisKey); `P1` important platform pieces and security-relevant libraries; `P2` supporting; `P3` references and low-risk tools. |
| `owner` | Who reacts: the Arx platform lead, the product owner (vendor or hardware matters) or the WisKey developers. |
| `urls` | Non-empty object: `repo`, `releases`, `docs`, `changelog`, `announcements`, `feed`, ... Any key, http(s) values. |
| `feeds` | What the script reads (see below). Empty only when the item has `manual` or `via`. |
| `manual` | `{how, cadence_days}` for sources with no machine-readable feed (firmware pages, vendor policy). Listed in every report. |
| `via` | Id of another item that carries the signal, e.g. the media integrations that arrive through `ha-core`. |
| `current` | `{version, source, verify}`. The version we build against or run in the lab. Unknown is `null` with `verify: true`; `applicable: false` marks things with no version concept (a feed, a SaaS). Optional `constraint` is a pip-style range (`>=13,<16`) or a free-text note. `source` says where the number came from; **lab values are `verify: true` because the lab moves**. |
| `dependents` | Non-empty list of repository paths that depend on the item. Tests fail when a path no longer exists, so the list stays honest. |
| `watch_keywords` | Words that make a release notable for us, in addition to the generic ones (`breaking`, `removed`, `deprecat`, `migration`, `renamed`, `no longer`, `incompatible`). Prefix match (`deprecat` finds "deprecated"); keywords of four letters or fewer must be whole words. Keep them specific: a noisy keyword trains everybody to ignore the report. |
| `ha_domains` | Home Assistant integration domains this item stands for (`cast`, `music_assistant`, `risco`). Used to match the "Backward-incompatible changes" list of HA release notes. |
| `last_checked`, `last_seen_version` | Review state, written by `--write-state`. `last_seen_prerelease` is added for pre-releases. |

### Feed types

| `type` | Source | Notes |
|---|---|---|
| `github_releases` | `https://github.com/<repo>/releases.atom` | Optional `tag_filter` regex. Falls back to the REST API when the atom feed fails. |
| `github_tags` | `.../tags.atom` | For projects without releases (CPython, FFmpeg). Use `tag_filter`. |
| `github_commits` | `.../commits/master.atom` | Dated only, informational. |
| `atom` | Any Atom/RSS URL | `title_filter`, `version_regex`, `use_generic: false` (only the item's own keywords flag). |
| `ha_release_notes` | `https://www.home-assistant.io/atom.xml` | The monthly release notes: latest patch level and the Backward-incompatible changes headings. |
| `ha_beta_notes` | `https://rc.home-assistant.io/latest-release-notes` | The upcoming release's notes while it is in beta: the earliest warning we can get. |
| `ha_dev_blog` | `https://developers.home-assistant.io/blog/atom.xml` | Platform changes for integration developers (custom integration API, WebSocket, frontend, add-ons). |
| `pypi`, `npm` | package index JSON | Latest version only. |
| `maven_metadata` | Google Maven `maven-metadata.xml` | Newest stable and, separately, newest pre-release. |
| `gradle_current` | `services.gradle.org/versions/current` | |
| `text_regex` | A raw file plus a pattern whose group 1 is the version | Used for the go2rtc and Cloudflared add-on `config.yaml`. |

## Running it

```
python scripts/upstream_check.py                       # Markdown report on stdout (about 60 requests, a minute)
python scripts/upstream_check.py --only ha-core,go2rtc
python scripts/upstream_check.py --json > report.json
python scripts/upstream_check.py --validate            # schema check, no network
python scripts/upstream_check.py --write-state         # record what was reviewed
python scripts/upstream_check.py --ack ha-core         # acknowledge a flagged item
python scripts/upstream_check.py --offline --fixtures DIR   # read fixtures instead of the network (tests)
```

Use the workstation Python 3.12 (`%LOCALAPPDATA%\Programs\Python\Python312\python.exe`), never the bare `python` alias.
The script is read-only toward the world: it fetches public feeds with a polite User-Agent, a 25 s timeout, one retry and a
short pause between requests. It never reads `secrets/`, never contacts a lab device and never sends anything about us.
`GITHUB_TOKEN` is optional: it is used only for `api.github.com` (the fallback) to raise the 60 requests/hour limit, and is never
stored. Rate limiting shows up under "Feeds that could not be read".

### Reading the report

Items are grouped by priority. Each has a verdict:

* **ATTENTION**: a new release carries a generic or item keyword, is a major version bump (semver only; calendar versions such
  as HA's are never "major"), or, for Home Assistant, a backward-incompatible change matches something in the registry. Read it.
* **new**: newer releases exist and nothing in their text looks dangerous. Skim.
* **up to date**, **manual** (follow the instructions printed), **tracked via** another item, **UNREACHABLE** (a feed failed; the cause is listed).

"Version drift" lists pinned or lab versions that are behind the latest stable. A pre-release is reported once, only when it is newer
than what we run. For packages with a `constraint`, a latest version outside the range is flagged. For `ha-core` the report prints
every backward-incompatible heading and then the entries that touch us, with the reason (integration domain, keyword). The
heading count is printed so that a change of the HA page layout (0 headings) is noticed instead of silently hiding the section.

### What `--write-state` does

It sets `last_checked` for every item that answered and `last_seen_version` for every item that is **not** flagged ATTENTION. A
flagged item keeps being reported until somebody has dealt with it and runs `--ack <id>` (or `--ack-all`). Items never reviewed
and without a pinned version report the last 45 days (`--since-days`), or just the latest release. Commit the registry after a
review so the next run starts where this one ended.

## Adding an item

1. Find the upstream: repository, releases feed, changelog or announcements page. Fetch the feed once to make sure it answers.
2. Add an object to `items` (copy a similar one). Fill `urls`, `feeds` (or `manual` / `via`), `current` (read it from the repository:
   `requirements.txt`, `package-lock.json`, add-on config, bridge manifest, docs; otherwise `null` + `verify: true`), `dependents`
   (grep the code and `docs/architecture/`; paths must exist), a few specific `watch_keywords`, `priority`, `status`.
3. `python scripts/upstream_check.py --validate` and `--only <id>`; then run the tests (below).
4. For a Home Assistant core or custom integration, add its domain to `ha_domains` and give it `via: "ha-core"` (core) or its own
   feed (custom).
5. Pinned Python and npm versions are checked against `requirements.txt` and `package-lock.json` by the tests: when a dependency
   is upgraded, update its `current.version` in the same change.

## Review routine

* **Weekly** (Monday): run the full report, triage ATTENTION by priority, run `--write-state`, commit the registry.
* **Home Assistant monthly release** (first Wednesday-ish): the beta appears about a week earlier. Run the report when the **beta
  notes** are published (they list backward-incompatible changes before anyone has upgraded), again on release day, and once more
  after the first patch. Also read the heading list yourself: matching is by integration domain and keyword, so a platform change
  worded unexpectedly can slip through. Update `ha-core.current.version` only after the lab really runs the new release.
* **Before every release round**: run `--validate`, the tests, and read ATTENTION items of P0 and P1.
* **Manual items** on their stated cadence (NVR and door-station firmware, push-service changes, OpenAI deprecations, Alpine and
  Android policy). Ask the owner what firmware the NVR runs; never upgrade anything ourselves.

## Response playbook

1. **Classify.** Does a listed dependent use the changed thing? Open the dependents of the item and the quoted text. Outcomes:
   *no impact* (acknowledge with a one-line reason in the task or chat), *needs adaptation*, *needs a decision* (owner), *needs
   proof* (cannot be judged without the real system).
2. **Task card.** For anything but "no impact", ask the lead to open a card in `management/tasks.json` (this document and the
   checker never edit it) with: item id, upstream version and link, what breaks, affected files, deadline (the date the upgrade
   reaches customers: HA release day, or the day the owner would upgrade) and an ETA.
3. **Branch.** `pilot/upstream-<item>-<version>` from the integration branch. Reproduce with the fakes first
   (`frontend/tests/fixtures/*_fake_ha.py`, `fake_ha_core.py`, the media and alarm fakes); add a failing test that encodes the new
   upstream behaviour, then adapt behind a capability check so old and new versions both work (capability discovery beats version
   sniffing; see AGENTS.md).
4. **Real system.** Testing against the new HA in the lab happens **only with the owner's approval** for that upgrade (a lab upgrade
   is an owner action). Read-only checks of the running lab are fine; no writes to the NVR, go2rtc configuration, HA users or network
   settings, and never touch go2rtc streams outside the `smplwise_` namespace.
5. **Ship.** The adaptation goes out in the next release round, ahead of the upstream release where possible, with the usual
   release notes (Hebrew and English). Record the new version in `current`, run `--ack <id>`, commit the registry.
6. **Tell the owner** in Hebrew: what changes upstream, what it means for him, what we did, when, and what he must do (for example,
   postpone updating HA until the release that carries the fix).

Typical triage hints: Supervisor or add-on API renames (add-on to "app") touch `config.yaml`, `/addons/self/*` in
`services/nvr_system.py` and the Ingress headers; HA authentication changes touch `services/ha_user_auth.py`, the bridge directory
push and `bootstrap_admin_username`; go2rtc changes touch `/api/streams`, `/api/ws` and `/api/frame.jpeg` (`services/go2rtc.py`,
`services/relay.py`); WisKey releases touch `services/intercom_client.py` and the embed adapter; scheduler component changes touch
`custom_components/smplwise_bridge/schedule_service.py`.

## Limits

* Closed sources (Hikvision firmware, Provision, vendor policies) are manual items: the script cannot see them.
* Release notes are read as text. A silent behaviour change that nobody wrote down is invisible; the real-system smoke test
  (`scripts/smoke_after_upgrade.py`) stays the safety net after an upgrade.
* Feed layouts are not contracts. A parser that finds nothing is reported (headings count, "pattern did not match", XML errors) rather
  than treated as "no news".
* The registry says what we depend on **today**; keep `status` honest: `planned` items are tracked so a decision can be made against
  current upstream facts, but nothing relies on them.

## Tests

```
cd smplwise_vms/backend
..\..\.venv\Scripts\python.exe -m pytest tests/test_upstream_watch.py -o addopts=""
```

The tests run offline (fixtures are written into a temporary directory and the network layer is replaced). They also validate the
real registry: schema, dependents exist, pins match `requirements.txt` and `package-lock.json`, and no private value (IP, MAC,
serial, secret) is present.
