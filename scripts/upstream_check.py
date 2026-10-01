#!/usr/bin/env python3
"""Upstream watch: check every external dependency in management/upstream_watch.json for new releases.

Reads the canonical registry, fetches each item's feeds with the standard library only (urllib, polite User-Agent,
timeouts, one retry), finds releases newer than what we last saw (or than the version we build against), flags
breaking-change / deprecation keywords and prints a Markdown report grouped by priority. Read-only: the only thing it
ever writes is the registry's last_checked / last_seen_version fields, and only with --write-state.

Home Assistant gets extra treatment: the release-notes feed (home-assistant.io) and the beta notes page
(rc.home-assistant.io) are parsed for their "Backward-incompatible changes" headings, which are matched against the
integrations, domains and keywords our registry says we depend on; the developer blog feed is scanned for
platform-API keywords (WebSocket, Ingress, Supervisor, custom integrations, ...).

Usage:
  python scripts/upstream_check.py                    # Markdown report on stdout
  python scripts/upstream_check.py --json             # machine-readable
  python scripts/upstream_check.py --only ha-core,go2rtc
  python scripts/upstream_check.py --write-state      # record what was reviewed (see UPSTREAM_WATCH.md)
  python scripts/upstream_check.py --ack ha-core      # acknowledge a flagged item (advance last_seen anyway)
  python scripts/upstream_check.py --offline          # read fixtures instead of the network (tests)
  python scripts/upstream_check.py --validate         # schema check of the registry only (no network)

GITHUB_TOKEN (optional, never stored): raises the GitHub API limit when the atom feeds fall back to the API.
No credentials, hosts or serial numbers of any lab device are ever read or sent by this script.
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import email.utils
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "management" / "upstream_watch.json"
FIXTURES_DIR = ROOT / "smplwise_vms" / "backend" / "tests" / "fixtures" / "upstream_watch"
USER_AGENT = "smplwise-upstream-watch/1.0 (read-only release check; contact: joni.oliel@gmail.com)"

GENERIC_KEYWORDS = ("breaking", "removed", "deprecat", "migration", "renamed", "no longer", "incompatible")
KINDS = ("platform", "addon", "integration", "library", "vendor-api", "tool", "design-reference")
STATUSES = ("in-use", "planned")
PRIORITIES = ("P0", "P1", "P2", "P3")
FEED_TYPES = {
    "github_releases": ("repo",),
    "github_tags": ("repo",),
    "github_commits": ("repo",),
    "atom": ("url",),
    "ha_release_notes": ("url",),
    "ha_beta_notes": ("url",),
    "ha_dev_blog": ("url",),
    "pypi": ("package",),
    "npm": ("package",),
    "maven_metadata": ("url",),
    "gradle_current": (),
    "text_regex": ("url", "pattern"),
}
DATED_FEEDS = {"github_commits", "atom", "ha_dev_blog"}  # no version numbers: "new" means newer than a date
MAX_BYTES = 12 * 1024 * 1024
SINCE_DAYS_DEFAULT = 45


# --------------------------------------------------------------------------------------------------------------------
# versions
# --------------------------------------------------------------------------------------------------------------------
_VER = re.compile(r"^[vn]?(\d+(?:\.\d+)*)(?:[-_.]?(dev|snapshot|alpha|a|beta|b|preview|pre|rc)[-_.]?(\d*))?(?:[-+_].*)?$", re.I)
_STAGE = {"dev": 0, "snapshot": 0, "a": 1, "alpha": 1, "b": 2, "beta": 2, "pre": 2, "preview": 2, "rc": 3}
FINAL_RANK = 9


def parse_version(text: str | None) -> tuple[tuple[int, ...], int, int] | None:
    """Comparable key: (numeric parts without trailing zeros, stage rank, stage number); None when not a version.

    A final release sorts above every pre-release of the same number: 2026.10.0b0 < 2026.10.0, 2.0.0-rc.37 < 2.0.0.
    """
    if not text or re.fullmatch(r"\d{4}-\d\d-\d\d", text.strip()):  # an ISO date is not a version
        return None
    m = _VER.match(text.strip())
    if not m:
        return None
    nums = [int(p) for p in m.group(1).split(".")]
    while len(nums) > 1 and nums[-1] == 0:
        nums.pop()
    stage = m.group(2)
    if stage is None:
        return (tuple(nums), FINAL_RANK, 0)
    return (tuple(nums), _STAGE[stage.lower()], int(m.group(3) or 0))


def is_prerelease(text: str | None) -> bool:
    key = parse_version(text)
    return key is not None and key[1] < FINAL_RANK


def compare_versions(a: str | None, b: str | None) -> int:
    """-1 / 0 / 1; None or unparsable sorts below any version (and equal to another None)."""
    ka, kb = parse_version(a), parse_version(b)
    if ka is None and kb is None:
        return 0
    if ka is None:
        return -1
    if kb is None:
        return 1
    return (ka > kb) - (ka < kb)


def is_newer(candidate: str | None, reference: str | None) -> bool:
    return compare_versions(candidate, reference) > 0


_CLAUSE = re.compile(r"^\s*(>=|<=|==|<|>)\s*([0-9][0-9A-Za-z.\-]*)\s*$")


def violated_constraint(version: str | None, constraint: str | None) -> str | None:
    """The first clause of a pip-style constraint (">=13,<16") that `version` breaks; None when it fits or cannot be judged.

    Only constraints written as comma-separated comparisons are understood; anything else (a free-text note) is ignored.
    """
    if not version or not constraint or not parse_version(version):
        return None
    for part in constraint.split(","):
        m = _CLAUSE.match(part)
        if not m:
            return None
        op, bound = m.groups()
        c = compare_versions(version, bound)
        ok = {">=": c >= 0, "<=": c <= 0, "==": c == 0, "<": c < 0, ">": c > 0}[op]
        if not ok:
            return part.strip()
    return None


def major_of(text: str | None) -> int | None:
    key = parse_version(text)
    return key[0][0] if key else None


def is_major_bump(candidate: str | None, reference: str | None) -> bool:
    """A major bump for semver-style versions. Calendar versions (2026.9.4) are never 'major': HA's own notes cover them."""
    mc, mr = major_of(candidate), major_of(reference)
    if mc is None or mr is None or mr >= 1000 or mc >= 1000:
        return False
    return mc > mr


# --------------------------------------------------------------------------------------------------------------------
# text helpers
# --------------------------------------------------------------------------------------------------------------------
_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def html_to_text(raw: str) -> str:
    text = html.unescape(raw or "")
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", text)
    text = _TAG.sub(" ", text)
    return _WS.sub(" ", html.unescape(text)).strip()


def _find_keyword(low: str, k: str) -> int:
    """First index of keyword k in lower-cased text. A keyword that starts with a letter or digit must start a word
    (so "ice" does not match "service"); a short keyword (4 characters or fewer) must also end one. Longer keywords are
    prefixes on purpose: "deprecat" finds "deprecated", "migrat" finds "migration"."""
    pat = ("(?<![a-z0-9])" if k[0].isalnum() else "") + re.escape(k) + ("(?![a-z0-9])" if len(k) <= 4 and k[-1].isalnum() else "")
    m = re.search(pat, low)
    return m.start() if m else -1


def keyword_hits(text: str, keywords: list[str] | tuple[str, ...], width: int = 70) -> list[dict[str, str]]:
    """Case-insensitive substring hits, one snippet per keyword (the first occurrence)."""
    low = text.lower()
    hits: list[dict[str, str]] = []
    seen: set[str] = set()
    for kw in keywords:
        k = kw.lower()
        if not k or k in seen:
            continue
        seen.add(k)
        i = _find_keyword(low, k)
        if i < 0:
            continue
        a, b = max(0, i - width), min(len(text), i + len(k) + width)
        hits.append({"keyword": kw, "snippet": ("..." if a else "") + text[a:b].strip() + ("..." if b < len(text) else "")})
    return hits


def parse_date(text: str | None) -> dt.datetime | None:
    if not text:
        return None
    text = text.strip()
    try:
        d = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            d = email.utils.parsedate_to_datetime(text)
        except (TypeError, ValueError):
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc)


def iso_day(d: dt.datetime | None) -> str | None:
    return d.strftime("%Y-%m-%d") if d else None


# --------------------------------------------------------------------------------------------------------------------
# fetching
# --------------------------------------------------------------------------------------------------------------------
class FetchError(Exception):
    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind  # unreachable | rate-limited | not-found | no-fixture | bad-data


def fixture_name(url: str) -> str:
    """Stable file name for an offline fixture: the URL without its scheme, every non-alphanumeric run as '_'."""
    core = url.split("://", 1)[-1]
    return re.sub(r"[^A-Za-z0-9]+", "_", core).strip("_")[:140] + ".txt"


class Fetcher:
    def __init__(self, offline: bool = False, fixtures_dir: Path | None = None, token: str | None = None,
                 delay: float = 0.4, timeout: float = 25.0):
        self.offline = offline
        self.fixtures_dir = fixtures_dir or FIXTURES_DIR
        self.token = token
        self.delay = delay
        self.timeout = timeout
        self._cache: dict[str, str] = {}
        self._last = 0.0
        self.requests = 0

    def get(self, url: str) -> str:
        if url in self._cache:
            return self._cache[url]
        text = self._read_fixture(url) if self.offline else self._http(url)
        self._cache[url] = text
        return text

    def _read_fixture(self, url: str) -> str:
        p = self.fixtures_dir / fixture_name(url)
        if not p.exists():
            raise FetchError("no-fixture", f"no offline fixture for {url} ({p.name})")
        return p.read_text(encoding="utf-8")

    def _http(self, url: str) -> str:
        headers = {"User-Agent": USER_AGENT, "Accept": "application/atom+xml, application/xml, application/json, text/html;q=0.8, */*;q=0.5"}
        host = urllib.parse.urlsplit(url).netloc
        if self.token and host == "api.github.com":
            headers["Authorization"] = f"Bearer {self.token}"
            headers["X-GitHub-Api-Version"] = "2022-11-28"
        last_err: Exception | None = None
        for attempt in (1, 2):
            wait = self.delay - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            self.requests += 1
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    data = r.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise FetchError("bad-data", f"response larger than {MAX_BYTES // (1024 * 1024)} MB: {url}")
                charset = "utf-8"
                return data.decode(charset, "replace")
            except urllib.error.HTTPError as e:
                if e.code in (403, 429) and (e.headers.get("X-RateLimit-Remaining") == "0" or e.code == 429 or "rate limit" in str(e.reason).lower()):
                    reset = e.headers.get("X-RateLimit-Reset") or e.headers.get("Retry-After") or "?"
                    raise FetchError("rate-limited", f"HTTP {e.code} rate limited ({url}); reset/retry-after {reset}"
                                     + ("" if self.token else "; set GITHUB_TOKEN for a higher limit")) from None
                if e.code == 404:
                    raise FetchError("not-found", f"HTTP 404 {url}") from None
                last_err = e
            except FetchError:
                raise
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last_err = e
            if attempt == 1:
                time.sleep(1.0)
        raise FetchError("unreachable", f"{type(last_err).__name__}: {last_err} ({url})")


# --------------------------------------------------------------------------------------------------------------------
# feed parsing -> Entry
# --------------------------------------------------------------------------------------------------------------------
@dataclasses.dataclass
class Entry:
    version: str | None
    title: str
    link: str
    published: dt.datetime | None
    text: str = ""
    prerelease: bool = False
    extra: dict[str, Any] = dataclasses.field(default_factory=dict)


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(el: ET.Element, name: str) -> str:
    for c in el:
        if _local(c.tag) == name:
            return "".join(c.itertext()).strip()
    return ""


def _atom_link(el: ET.Element) -> str:
    href = ""
    for c in el:
        if _local(c.tag) == "link":
            h = c.attrib.get("href", "")
            if c.attrib.get("rel", "alternate") == "alternate":
                return h
            href = href or h
            if c.text and c.text.strip():
                href = href or c.text.strip()
    return href or _child_text(el, "link")


def parse_feed(text: str) -> list[dict[str, Any]]:
    """Atom <entry> or RSS <item> -> dicts with title, link, published, content (raw, may be HTML)."""
    try:
        root = ET.fromstring(text.encode("utf-8"))
    except ET.ParseError as e:
        raise FetchError("bad-data", f"feed is not XML: {e}") from None
    out: list[dict[str, Any]] = []
    for el in root.iter():
        name = _local(el.tag)
        if name not in ("entry", "item"):
            continue
        content = _child_text(el, "content") or _child_text(el, "encoded") or _child_text(el, "description") or _child_text(el, "summary")
        pub = _child_text(el, "updated") or _child_text(el, "published") or _child_text(el, "pubDate") or _child_text(el, "date")
        out.append({"title": _child_text(el, "title"), "link": _atom_link(el), "published": parse_date(pub), "content": content})
    return out


def _tag_from_link(link: str) -> str:
    m = re.search(r"/releases/tag/([^/?#]+)", link) or re.search(r"/tag/([^/?#]+)", link) or re.search(r"/-/tags/([^/?#]+)", link)
    return urllib.parse.unquote(m.group(1)) if m else ""


def _tag_filter(feed: dict[str, Any]) -> Callable[[str], bool]:
    pat = feed.get("tag_filter")
    if not pat:
        return lambda t: True
    rx = re.compile(pat)
    return lambda t: bool(rx.search(t))


def entries_github(feed: dict[str, Any], fetcher: Fetcher, kind: str) -> list[Entry]:
    repo = feed["repo"]
    page = {"github_releases": "releases.atom", "github_tags": "tags.atom", "github_commits": "commits/master.atom"}[kind]
    keep = _tag_filter(feed)
    try:
        raw = parse_feed(fetcher.get(f"https://github.com/{repo}/{page}"))
    except FetchError as e:
        if kind != "github_releases" or e.kind in ("no-fixture",) or fetcher.offline:
            raise
        # the atom feed is the polite default; the REST API is the fallback (60 requests/hour unauthenticated)
        api = json.loads(fetcher.get(f"https://api.github.com/repos/{repo}/releases?per_page=15"))
        return [Entry(version=r.get("tag_name"), title=r.get("name") or r.get("tag_name") or "", link=r.get("html_url", ""),
                      published=parse_date(r.get("published_at")), text=r.get("body") or "", prerelease=bool(r.get("prerelease")))
                for r in api if keep(r.get("tag_name") or "")]
    out: list[Entry] = []
    for r in raw:
        if kind == "github_commits":
            out.append(Entry(None, r["title"], r["link"], r["published"], html_to_text(r["content"])))
            continue
        tag = _tag_from_link(r["link"]) or r["title"]
        if not keep(tag):
            continue
        out.append(Entry(tag, r["title"] or tag, r["link"], r["published"], html_to_text(r["content"]), is_prerelease(tag)))
    return out


def entries_atom(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    tf = re.compile(feed["title_filter"], re.I) if feed.get("title_filter") else None
    vr = re.compile(feed["version_regex"]) if feed.get("version_regex") else None
    out: list[Entry] = []
    for r in parse_feed(fetcher.get(feed["url"])):
        if tf and not tf.search(r["title"]):
            continue
        ver = None
        if vr:
            m = vr.search(r["title"])
            ver = m.group(1) if m else None
        out.append(Entry(ver, r["title"], r["link"], r["published"], html_to_text(r["content"]), is_prerelease(ver)))
    return out


# ---- Home Assistant release notes ---------------------------------------------------------------------------------
_DETAILS_TITLE = re.compile(r"<summary[^>]*>.*?<span[^>]*>(.*?)</span>", re.S | re.I)


def extract_bic(page_html: str) -> list[dict[str, Any]]:
    """The 'Backward-incompatible changes' section of an HA release-notes page / feed entry.

    Returns [{title, text, domains}] one per <details> block (the title is usually the integration's display name);
    'domains' are the integration domains linked from the block (/integrations/<domain>/). Falls back to h3/h4/strong
    headings when the page does not use details blocks.
    """
    m = re.search(r"<h2[^>]*>\s*Backward[- ]incompatible changes\b.*?</h2>", page_html, re.I | re.S)
    if not m:
        return []
    rest = page_html[m.end():]
    end = re.search(r"<h2[\s>]", rest)
    section = rest[: end.start()] if end else rest
    items: list[dict[str, Any]] = []
    blocks = re.split(r"(?i)(?=<details\b)", section)
    for blk in blocks:
        if not re.match(r"(?i)<details\b", blk):
            continue
        tm = _DETAILS_TITLE.search(blk)
        title = html_to_text(tm.group(1)) if tm else ""
        body = blk[tm.end():] if tm else blk
        items.append({"title": title, "text": html_to_text(body), "domains": sorted(set(re.findall(r"/integrations/([a-z0-9_]+)", blk)))})
    if not items:
        for hm in re.finditer(r"<h[34][^>]*>(.*?)</h[34]>", section, re.S | re.I):
            items.append({"title": html_to_text(hm.group(1)), "text": "", "domains": []})
    return items


def entries_ha_release_notes(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    out: list[Entry] = []
    for r in parse_feed(fetcher.get(feed["url"])):
        m = re.search(r"/blog/\d{4}/\d\d/\d\d/release-(\d{4})(\d+)", r["link"])
        if not m:
            continue
        base = f"{m.group(1)}.{m.group(2)}"
        content = html.unescape(r["content"]) if "&lt;" in r["content"][:400] else r["content"]
        patches = re.findall(r"<h3[^>]*>\s*(\d{4}\.\d+\.\d+)\s*-", content)
        version = max(patches, key=lambda v: parse_version(v) or ((0,), 0, 0)) if patches else base + ".0"
        bic = extract_bic(content)
        out.append(Entry(version, r["title"], r["link"], r["published"], "", False, {"bic": bic, "patches": patches}))
    return out


def entries_ha_beta_notes(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    page = fetcher.get(feed["url"])
    tm = re.search(r"<title>(.*?)</title>", page, re.S | re.I)
    title = html_to_text(tm.group(1)) if tm else "beta release notes"
    vm = re.search(r"(\d{4}\.\d{1,2})", title) or re.search(r"/release-(\d{4})(\d{1,2})", page)
    if vm and vm.lastindex == 2:
        base = f"{vm.group(1)}.{vm.group(2)}"
    else:
        base = vm.group(1) if vm else None
    version = f"{base}.0b0" if base else None
    return [Entry(version, title, feed["url"], None, "", True, {"bic": extract_bic(page), "beta_notes": True})]


def entries_ha_dev_blog(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    return [Entry(None, r["title"], r["link"], r["published"], html_to_text(r["content"])) for r in parse_feed(fetcher.get(feed["url"]))]


# ---- package indexes ----------------------------------------------------------------------------------------------
def entries_pypi(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    pkg = feed["package"]
    data = json.loads(fetcher.get(f"https://pypi.org/pypi/{pkg}/json"))
    info = data.get("info", {})
    ver = info.get("version")
    files = (data.get("releases") or {}).get(ver) or data.get("urls") or []
    pub = parse_date(files[0].get("upload_time_iso_8601")) if files else None
    return [Entry(ver, f"{pkg} {ver}", info.get("release_url") or f"https://pypi.org/project/{pkg}/", pub, info.get("summary") or "", is_prerelease(ver))]


def entries_npm(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    pkg = feed["package"]
    data = json.loads(fetcher.get(f"https://registry.npmjs.org/{pkg.replace('/', '%2f')}/latest"))
    ver = data.get("version")
    return [Entry(ver, f"{pkg} {ver}", f"https://www.npmjs.com/package/{pkg}", None, data.get("description") or "", is_prerelease(ver))]


def entries_maven(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    root = ET.fromstring(fetcher.get(feed["url"]).encode("utf-8"))
    name = f"{root.findtext('groupId') or ''}:{root.findtext('artifactId') or ''}".strip(":")
    versions = [v.text.strip() for v in root.iter("version") if v.text]
    stable = [v for v in versions if not is_prerelease(v) and parse_version(v)]
    pre = [v for v in versions if is_prerelease(v)]
    if feed.get("version_prefix"):
        stable = [v for v in stable if v.startswith(feed["version_prefix"])]
    out: list[Entry] = []
    if stable:
        best = max(stable, key=lambda v: parse_version(v))
        out.append(Entry(best, f"{name} {best}", feed["url"], None, "", False))
    if pre:
        best_pre = max(pre, key=lambda v: parse_version(v) or ((0,), 0, 0))
        if not stable or is_newer(best_pre, max(stable, key=lambda v: parse_version(v))):
            out.append(Entry(best_pre, f"{name} {best_pre} (pre-release)", feed["url"], None, "", True))
    return out


def entries_gradle(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    data = json.loads(fetcher.get("https://services.gradle.org/versions/current"))
    ver = data.get("version")
    return [Entry(ver, f"Gradle {ver}", "https://docs.gradle.org/current/release-notes.html", parse_date(data.get("buildTime")), "")]


def entries_text_regex(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    text = fetcher.get(feed["url"])
    m = re.search(feed["pattern"], text, re.M)
    if not m:
        raise FetchError("bad-data", f"pattern did not match in {feed['url']}")
    ver = m.group(1)
    return [Entry(ver, f"{feed.get('label') or 'version'} {ver}", feed["url"], None, "", is_prerelease(ver))]


def collect_entries(feed: dict[str, Any], fetcher: Fetcher) -> list[Entry]:
    t = feed["type"]
    if t in ("github_releases", "github_tags", "github_commits"):
        return entries_github(feed, fetcher, t)
    return {
        "atom": entries_atom, "ha_release_notes": entries_ha_release_notes, "ha_beta_notes": entries_ha_beta_notes,
        "ha_dev_blog": entries_ha_dev_blog, "pypi": entries_pypi, "npm": entries_npm, "maven_metadata": entries_maven,
        "gradle_current": entries_gradle, "text_regex": entries_text_regex,
    }[t](feed, fetcher)


# --------------------------------------------------------------------------------------------------------------------
# registry
# --------------------------------------------------------------------------------------------------------------------
def load_registry(path: Path = REGISTRY_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_registry(reg: dict[str, Any], path: Path = REGISTRY_PATH) -> None:
    path.write_text(json.dumps(reg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def validate_registry(reg: dict[str, Any]) -> list[str]:
    """Schema problems as readable strings (empty list = valid). Used by --validate and by the tests."""
    errs: list[str] = []
    if reg.get("schema_version") != 1:
        errs.append("schema_version must be 1")
    items = reg.get("items")
    if not isinstance(items, list) or not items:
        return errs + ["items must be a non-empty list"]
    seen: set[str] = set()
    for i, it in enumerate(items):
        iid = it.get("id", f"#{i}")
        where = f"item {iid}"
        if not isinstance(it.get("id"), str) or not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", it.get("id", "")):
            errs.append(f"{where}: id must be a lowercase slug")
        if iid in seen:
            errs.append(f"{where}: duplicate id")
        seen.add(iid)
        for f in ("name", "owner", "note"):
            if not isinstance(it.get(f), str) or not it.get(f).strip():
                errs.append(f"{where}: {f} is required")
        if it.get("kind") not in KINDS:
            errs.append(f"{where}: kind must be one of {KINDS}")
        if it.get("status") not in STATUSES:
            errs.append(f"{where}: status must be one of {STATUSES}")
        if it.get("priority") not in PRIORITIES:
            errs.append(f"{where}: priority must be one of {PRIORITIES}")
        urls = it.get("urls")
        if not isinstance(urls, dict) or not urls:
            errs.append(f"{where}: urls must be a non-empty object")
        else:
            for k, v in urls.items():
                if not (isinstance(v, str) and re.match(r"https?://[^\s]+$", v)):
                    errs.append(f"{where}: urls.{k} is not an http(s) URL")
        deps = it.get("dependents")
        if not isinstance(deps, list) or not deps or not all(isinstance(d, str) and d for d in deps):
            errs.append(f"{where}: dependents must be a non-empty list of repository paths")
        cur = it.get("current")
        if not isinstance(cur, dict) or "version" not in cur or not isinstance(cur.get("source"), str) or not isinstance(cur.get("verify"), bool):
            errs.append(f"{where}: current needs version (string or null), source and verify")
        elif cur["version"] is None and not cur["verify"] and cur.get("applicable") is not False:
            errs.append(f"{where}: an unknown current version must be marked verify=true (or applicable=false when there is no version concept)")
        kws = it.get("watch_keywords")
        if not isinstance(kws, list) or not kws or not all(isinstance(k, str) and k for k in kws):
            errs.append(f"{where}: watch_keywords must be a non-empty list")
        feeds = it.get("feeds")
        if not isinstance(feeds, list):
            errs.append(f"{where}: feeds must be a list (empty when tracked by hand or via another item)")
            feeds = []
        for fd in feeds:
            ft = fd.get("type")
            if ft not in FEED_TYPES:
                errs.append(f"{where}: unknown feed type {ft!r}")
                continue
            for need in FEED_TYPES[ft]:
                if not fd.get(need):
                    errs.append(f"{where}: feed {ft} needs {need}")
        if not feeds and not it.get("manual") and not it.get("via"):
            errs.append(f"{where}: no feeds, so it needs a 'manual' check description or a 'via' item")
        if it.get("manual") is not None and not (isinstance(it["manual"], dict) and it["manual"].get("how")):
            errs.append(f"{where}: manual must be an object with 'how'")
        if it.get("via") is not None and it["via"] not in {x.get("id") for x in items}:
            errs.append(f"{where}: via refers to an unknown item")
        for f in ("last_checked", "last_seen_version"):
            if f not in it:
                errs.append(f"{where}: {f} must be present (null when never checked)")
        lc = it.get("last_checked")
        if lc is not None and not re.fullmatch(r"\d{4}-\d\d-\d\d", str(lc)):
            errs.append(f"{where}: last_checked must be YYYY-MM-DD or null")
    return errs


# --------------------------------------------------------------------------------------------------------------------
# checking
# --------------------------------------------------------------------------------------------------------------------
def ha_domain_index(items: list[dict[str, Any]]) -> dict[str, list[str]]:
    idx: dict[str, list[str]] = {}
    for it in items:
        for d in it.get("ha_domains", []) or []:
            idx.setdefault(d.lower(), []).append(it["id"])
    return idx


GENERIC_DOMAINS = frozenset({"api", "http", "auth", "config", "light", "switch", "lock", "fan", "cover", "climate", "camera", "stream", "history",
                             "frontend", "homeassistant", "discovery", "recorder", "mqtt"})


def match_bic(bic: list[dict[str, Any]], item: dict[str, Any], index: dict[str, list[str]]) -> list[dict[str, Any]]:
    """Which backward-incompatible entries touch something we depend on, and why."""
    kws = list(item.get("watch_keywords", []))
    out: list[dict[str, Any]] = []
    for b in bic:
        reasons: list[str] = []
        affects: set[str] = set()
        for d in b.get("domains", []):
            if d.lower() in index:
                affects.update(index[d.lower()])
                reasons.append(f"integration domain '{d}'")
        title_low = b["title"].lower().strip()
        for dom, ids in index.items():
            if dom in GENERIC_DOMAINS:  # a bare word such as "api" or "light": only an exact heading counts
                hit = title_low == dom
            else:
                hit = bool(re.search(rf"(?<![a-z0-9]){re.escape(dom.replace('_', ' '))}(?![a-z0-9])", title_low.replace("_", " ")))
            if hit:
                affects.update(ids)
                reasons.append(f"title mentions '{dom}'")
        hits = keyword_hits(b["title"] + " " + b.get("text", ""), kws)
        if hits:
            reasons.append("keywords: " + ", ".join(h["keyword"] for h in hits[:6]))
        if reasons:
            out.append({"title": b["title"], "reasons": sorted(set(reasons)), "affects": sorted(affects), "snippet": (hits[0]["snippet"] if hits else b.get("text", "")[:160]), "text": b.get("text", "")[:600]})
    return out


@dataclasses.dataclass
class ItemResult:
    id: str
    name: str
    priority: str
    status: str
    kind: str
    current: str | None
    reference: str | None
    latest: str | None = None
    latest_stable: str | None = None
    newest_seen: str | None = None  # newest stable version or date seen, what --write-state records
    prerelease: str | None = None
    verdict: str = "ok"  # attention | new | ok | manual | unreachable | no-feed
    flags: list[str] = dataclasses.field(default_factory=list)
    new_entries: list[dict[str, Any]] = dataclasses.field(default_factory=list)
    errors: list[str] = dataclasses.field(default_factory=list)
    behind: bool = False
    ha: dict[str, Any] = dataclasses.field(default_factory=dict)
    manual: dict[str, Any] | None = None
    links: dict[str, str] = dataclasses.field(default_factory=dict)
    checked: bool = False


def entry_dict(e: Entry, hits: list[dict[str, str]]) -> dict[str, Any]:
    return {"version": e.version, "title": e.title, "link": e.link, "published": iso_day(e.published), "prerelease": e.prerelease,
            "hits": hits}


def _dedupe(entries: list[Entry]) -> list[Entry]:
    """One entry per version; the one carrying parsed release-note data wins over a bare GitHub tag."""
    best: dict[str, Entry] = {}
    order: list[str] = []
    for e in entries:
        k = e.version or f"{e.title}|{e.link}"
        if k not in best:
            best[k] = e
            order.append(k)
        elif "bic" in e.extra and "bic" not in best[k].extra:
            best[k] = e
    return [best[k] for k in order]


def check_item(item: dict[str, Any], fetcher: Fetcher, now: dt.datetime, since_days: int, index: dict[str, list[str]],
               generic: tuple[str, ...] = GENERIC_KEYWORDS) -> ItemResult:
    cur = (item.get("current") or {}).get("version")
    ref = item.get("last_seen_version") or cur
    res = ItemResult(item["id"], item["name"], item["priority"], item["status"], item["kind"], cur, ref, manual=item.get("manual"),
                     links={k: v for k, v in (item.get("urls") or {}).items()})
    feeds = item.get("feeds") or []
    if not feeds:
        res.verdict = "manual" if item.get("manual") else "no-feed"
        if item.get("via"):
            res.flags.append(f"tracked through {item['via']}")
        return res
    own_keywords = list(item.get("watch_keywords", []))
    baseline_cut = now - dt.timedelta(days=since_days)
    stable_all: list[Entry] = []
    pre_all: list[Entry] = []
    dated_new: list[Entry] = []
    ref_date = parse_date(ref) if ref and not parse_version(ref) else None
    for feed in feeds:
        try:
            entries = collect_entries(feed, fetcher)
        except FetchError as e:
            res.errors.append(f"{feed['type']}: [{e.kind}] {e}")
            continue
        except (ValueError, KeyError, ET.ParseError) as e:  # malformed JSON / XML from an upstream
            res.errors.append(f"{feed['type']}: [bad-data] {type(e).__name__}: {e}")
            continue
        res.checked = True
        for e in entries:
            e.extra["no_generic"] = not feed.get("use_generic", True)
        if feed["type"] in DATED_FEEDS:
            cut = ref_date or baseline_cut
            fresh = [e for e in entries if e.published and e.published > cut]
            fresh.sort(key=lambda e: e.published, reverse=True)
            dated_new.extend(fresh[:10])
            continue
        if feed["type"] == "ha_beta_notes":
            pre_all.extend(e for e in entries if e.version and is_newer(e.version, ref))
            continue
        for e in entries:
            (pre_all if e.prerelease else stable_all).append(e)

    def vkey(e: Entry):
        return parse_version(e.version) or ((0,), 0, 0)

    stable_all = _dedupe(sorted(stable_all, key=vkey, reverse=True))
    pre_all = _dedupe(sorted(pre_all, key=vkey, reverse=True))
    if stable_all:
        res.latest_stable = stable_all[0].version
        res.newest_seen = stable_all[0].version
    elif dated_new:
        res.newest_seen = iso_day(max(e.published for e in dated_new if e.published))
    res.latest = res.latest_stable
    if pre_all and (not stable_all or is_newer(pre_all[0].version, stable_all[0].version)) and not (ref and parse_version(ref) and not is_newer(pre_all[0].version, ref)):
        res.prerelease = pre_all[0].version

    if ref and parse_version(ref):
        new_stable = [e for e in stable_all if is_newer(e.version, ref)][:10]
    else:  # never reviewed and no pinned version: the baseline window, or just the latest release
        new_stable = [e for e in stable_all if e.published and e.published > baseline_cut][:10] or stable_all[:1]
    new_pre: list[Entry] = []
    last_pre = item.get("last_seen_prerelease") or None
    if res.prerelease and (not last_pre or is_newer(res.prerelease, last_pre)):
        new_pre = [pre_all[0]] + [e for e in pre_all[1:] if "bic" in e.extra][:1]

    attention = False
    for e, dated in [(e, False) for e in new_stable + new_pre] + [(e, True) for e in dated_new]:
        kws = own_keywords if e.extra.get("no_generic") else list(dict.fromkeys(own_keywords + list(generic)))
        hits = keyword_hits((e.title + " " + e.text), kws)
        res.new_entries.append(entry_dict(e, hits))
        if hits:
            attention = True
        if "bic" in e.extra:
            matched = match_bic(e.extra["bic"], item, index)
            res.ha.setdefault("bic", []).append({"release": e.version, "link": e.link, "all_titles": [b["title"] for b in e.extra["bic"]],
                                                 "matched": matched, "beta_notes": bool(e.extra.get("beta_notes"))})
            if matched:
                attention = True
    for e in new_stable:
        if is_major_bump(e.version, ref):
            if "MAJOR version bump" not in res.flags:
                res.flags.append("MAJOR version bump")
            attention = True
    if new_pre:
        res.flags.append(f"pre-release {new_pre[0].version} is out")
    if cur and res.latest_stable and is_newer(res.latest_stable, cur):
        res.behind = True
    clause = violated_constraint(res.latest_stable, (item.get("current") or {}).get("constraint"))
    if clause:
        res.flags.append(f"latest {res.latest_stable} is outside our version constraint ({clause}): review before widening it")
    if not res.checked:
        res.verdict = "unreachable"
    elif attention:
        res.verdict = "attention"
    elif res.new_entries:
        res.verdict = "new"
    else:
        res.verdict = "ok"
    if res.errors and res.checked:
        res.flags.append("some feeds unreachable")
    return res


def run_checks(reg: dict[str, Any], fetcher: Fetcher, now: dt.datetime, only: set[str] | None = None,
               since_days: int = SINCE_DAYS_DEFAULT) -> list[ItemResult]:
    items = reg["items"]
    index = ha_domain_index(items)
    generic = tuple(reg.get("generic_keywords") or GENERIC_KEYWORDS)
    out: list[ItemResult] = []
    for it in items:
        if only and it["id"] not in only:
            continue
        out.append(check_item(it, fetcher, now, since_days, index, generic))
    return out


def apply_state(reg: dict[str, Any], results: list[ItemResult], today: str, ack: set[str] | None = None, ack_all: bool = False) -> list[str]:
    """Record what was reviewed. last_checked always moves for an item that answered; last_seen_version only moves for
    items that are not flagged 'attention' (or that were acknowledged explicitly), so a flagged change keeps being
    reported until someone acknowledges it. Returns the ids whose last_seen_version was held back."""
    held: list[str] = []
    by_id = {r.id: r for r in results}
    for it in reg["items"]:
        r = by_id.get(it["id"])
        if not r or not r.checked:
            continue
        it["last_checked"] = today
        acked = ack_all or (ack and it["id"] in ack)
        if r.verdict == "attention" and not acked:
            held.append(it["id"])
            continue
        if r.newest_seen:
            it["last_seen_version"] = r.newest_seen
        if r.prerelease:
            it["last_seen_prerelease"] = r.prerelease
    return held


# --------------------------------------------------------------------------------------------------------------------
# report
# --------------------------------------------------------------------------------------------------------------------
def _cur_str(r: ItemResult) -> str:
    return r.current or "unknown (verify)"


def render_markdown(results: list[ItemResult], now: dt.datetime, registry_items: int, requests: int, offline: bool) -> str:
    n_attn = sum(r.verdict == "attention" for r in results)
    n_new = sum(r.verdict == "new" for r in results)
    n_ok = sum(r.verdict == "ok" for r in results)
    n_manual = sum(r.verdict == "manual" for r in results)
    n_via = sum(r.verdict == "no-feed" for r in results)
    n_bad = sum(bool(r.verdict == "unreachable" or (r.errors and r.checked)) for r in results)
    L: list[str] = []
    L.append(f"# Upstream watch report - {now.strftime('%Y-%m-%d %H:%M')} UTC" + (" (offline fixtures)" if offline else ""))
    L.append("")
    L.append(f"Registry items checked: {len(results)} of {registry_items}; HTTP requests: {requests}.")
    L.append("")
    L.append("| Needs attention | New releases | Up to date | Manual check | Tracked via another item | Feed problems |")
    L.append("|---|---|---|---|---|---|")
    L.append(f"| {n_attn} | {n_new} | {n_ok} | {n_manual} | {n_via} | {n_bad} |")
    L.append("")
    for prio in PRIORITIES:
        group = [r for r in results if r.priority == prio]
        if not group:
            continue
        L.append(f"## {prio}")
        L.append("")
        quiet = []
        for r in group:
            if r.verdict in ("ok",):
                quiet.append(f"{r.id} ({r.latest_stable or r.newest_seen or '-'})")
                continue
            if r.verdict in ("manual", "no-feed"):
                continue
            L += _render_item(r)
        if quiet:
            L.append(f"Up to date: {', '.join(quiet)}")
            L.append("")
    manual = [r for r in results if r.verdict == "manual"]
    if manual:
        L.append("## Manual checks (no machine-readable feed)")
        L.append("")
        for r in manual:
            m = r.manual or {}
            L.append(f"- **{r.id}** ({r.priority}, {r.status}, current {_cur_str(r)}): {m.get('how')} Every {m.get('cadence_days', 30)} days.")
            for k, v in list(r.links.items())[:3]:
                L.append(f"  - {k}: {v}")
        L.append("")
    via = [r for r in results if r.verdict == "no-feed"]
    if via:
        L.append("## Tracked through another item")
        L.append("")
        L.append(", ".join(f"{r.id} -> {r.flags[0].replace('tracked through ', '')}" if r.flags else r.id for r in via))
        L.append("")
    drift = [r for r in results if r.behind and r.status == "in-use"]
    if drift:
        L.append("## Version drift (pinned / lab version is behind the latest stable)")
        L.append("")
        L.append("| Item | We use | Latest stable |")
        L.append("|---|---|---|")
        for r in drift:
            L.append(f"| {r.id} | {r.current} | {r.latest_stable} |")
        L.append("")
    bad = [r for r in results if r.errors]
    if bad:
        L.append("## Feeds that could not be read")
        L.append("")
        for r in bad:
            for e in r.errors:
                L.append(f"- {r.id}: {e}")
        L.append("")
    return "\n".join(L).rstrip() + "\n"


def _render_item(r: ItemResult) -> list[str]:
    L: list[str] = []
    mark = {"attention": "ATTENTION", "new": "new", "unreachable": "UNREACHABLE"}.get(r.verdict, r.verdict)
    head = f"### {r.id} - {r.name} [{r.status}] - {mark}"
    L.append(head)
    L.append(f"- current {_cur_str(r)}; last reviewed {r.reference or 'never'}; latest stable {r.latest_stable or '-'}"
             + (f"; pre-release {r.prerelease}" if r.prerelease else ""))
    if r.flags:
        L.append("- flags: " + "; ".join(r.flags))
    shown = sorted(r.new_entries, key=lambda e: not e["hits"])  # entries with keyword hits first (stable otherwise)
    for e in shown[:6]:
        tag = " (pre-release)" if e["prerelease"] else ""
        ver = e["version"] or e["published"] or ""
        L.append(f"- {ver}{tag}: {e['title'][:90]} - {e['link']}")
        for h in e["hits"][:3]:
            L.append(f"  - `{h['keyword']}`: {h['snippet']}")
    if len(r.new_entries) > 6:
        L.append(f"- ... and {len(r.new_entries) - 6} more")
    for b in r.ha.get("bic", []):
        kind = "beta notes" if b["beta_notes"] else "release notes"
        L.append(f"- Backward-incompatible changes in {b['release']} ({kind}, {len(b['all_titles'])} headings): {b['link']}")
        if b["all_titles"]:
            L.append("  - headings: " + "; ".join(b["all_titles"]))
        for m in b["matched"]:
            aff = f" -> affects {', '.join(m['affects'])}" if m["affects"] else ""
            L.append(f"  - **{m['title']}**{aff} ({'; '.join(m['reasons'])}): {m.get('text') or m['snippet']}")
    for e in r.errors:
        L.append(f"- feed problem: {e}")
    L.append("")
    return L


# --------------------------------------------------------------------------------------------------------------------
# cli
# --------------------------------------------------------------------------------------------------------------------
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--registry", type=Path, default=REGISTRY_PATH)
    ap.add_argument("--json", action="store_true", help="print JSON instead of Markdown")
    ap.add_argument("--only", help="comma-separated item ids")
    ap.add_argument("--since-days", type=int, default=SINCE_DAYS_DEFAULT, help="baseline window for items never reviewed (default 45)")
    ap.add_argument("--write-state", action="store_true", help="update last_checked / last_seen_version in the registry")
    ap.add_argument("--ack", help="comma-separated item ids to acknowledge even when flagged (implies --write-state)")
    ap.add_argument("--ack-all", action="store_true", help="acknowledge every flagged item (implies --write-state)")
    ap.add_argument("--offline", action="store_true", help="read fixtures from --fixtures instead of the network")
    ap.add_argument("--fixtures", type=Path, default=FIXTURES_DIR)
    ap.add_argument("--validate", action="store_true", help="only validate the registry schema")
    ap.add_argument("--fail-on-attention", action="store_true", help="exit 2 when any item needs attention")
    args = ap.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    reg = load_registry(args.registry)
    errs = validate_registry(reg)
    if errs:
        print("Registry is invalid:\n- " + "\n- ".join(errs), file=sys.stderr)
        return 3
    if args.validate:
        print(f"Registry OK: {len(reg['items'])} items")
        return 0
    now = dt.datetime.now(dt.timezone.utc)
    fetcher = Fetcher(offline=args.offline, fixtures_dir=args.fixtures, token=os.environ.get("GITHUB_TOKEN") or None,
                      delay=0.0 if args.offline else 0.4)
    only = {s.strip() for s in args.only.split(",")} if args.only else None
    results = run_checks(reg, fetcher, now, only, args.since_days)
    if args.json:
        print(json.dumps([dataclasses.asdict(r) for r in results], indent=2, ensure_ascii=False))
    else:
        sys.stdout.write(render_markdown(results, now, len(reg["items"]), fetcher.requests, args.offline))
    if args.write_state or args.ack or args.ack_all:
        ack = {s.strip() for s in args.ack.split(",")} if args.ack else None
        held = apply_state(reg, results, now.strftime("%Y-%m-%d"), ack, args.ack_all)
        save_registry(reg, args.registry)
        print(f"\nState written to {args.registry.name}." + (f" Held back (flagged, not acknowledged): {', '.join(held)}." if held else ""),
              file=sys.stderr)
    if args.fail_on_attention and any(r.verdict == "attention" for r in results):
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
