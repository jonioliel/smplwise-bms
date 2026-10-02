"""Upstream watch (management/upstream_watch.json + scripts/upstream_check.py).

Everything here runs offline: feeds are fixtures written into a temporary directory (the checker's `--offline` mode reads
`fixture_name(url)` files), so no test touches the network. The registry itself is validated for real: schema, URLs,
dependents that must exist in the repository, and pins that must match requirements.txt / package-lock.json.
"""
from __future__ import annotations

import copy
import datetime as dt
import json
import re
import sys
import urllib.error
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

import upstream_check as uc  # noqa: E402

NOW = dt.datetime(2026, 10, 2, 12, 0, tzinfo=dt.timezone.utc)


# ---------------------------------------------------------------------------------------------------------------------
# helpers: build fixtures and a minimal valid registry
# ---------------------------------------------------------------------------------------------------------------------
def put(tmp: Path, url: str, text: str) -> None:
    (tmp / uc.fixture_name(url)).write_text(text, encoding="utf-8")


def gh_atom(repo: str, entries: list[tuple[str, str, str]], page: str = "releases") -> str:
    """entries: (tag, ISO date, body text)."""
    parts = []
    for tag, date, body in entries:
        parts.append(
            f"<entry><id>tag:github.com,2008:Repository/1/{tag}</id><updated>{date}</updated>"
            f'<link rel="alternate" type="text/html" href="https://github.com/{repo}/{page}/tag/{tag}"/>'
            f"<title>{tag}</title><content type=\"html\">&lt;p&gt;{body}&lt;/p&gt;</content></entry>")
    return '<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">' + "".join(parts) + "</feed>"


def details(title: str, body: str) -> str:
    return ('<div class="details-block"><details class="details-block-item"><summary class="details-block-title">'
            f"<span>{title}</span><div class='details-block-arrow'></div></summary>"
            f'<div class="details-block-content"><p>{body}</p></div></details></div>')


def ha_notes_page(bic: list[tuple[str, str]], patches: tuple[str, ...] = ()) -> str:
    patch_html = "".join(f"<h3>{p} - September 27</h3>" for p in patches)
    return ("<h2>Home Assistant Cloud</h2><p>intro</p>" + ("<h2>Patch releases</h2>" + patch_html if patches else "")
            + '<h2>Backward-incompatible changes <a class="title-link" href="#x"></a></h2><p>We do our best.</p>'
            + "".join(details(t, b) for t, b in bic) + "<h2>All changes</h2><p>removed everything here, not part of the section</p>")


def ha_notes_atom(release: str, title: str, page: str, date: str = "2026-09-02T00:00:00+00:00") -> str:
    yyyy, mm = release.split(".")
    return ('<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom">'
            f"<entry><title><![CDATA[{title}]]></title><link href=\"https://www.home-assistant.io/blog/{yyyy}/{int(mm):02d}/02/release-{yyyy}{mm}/\"/>"
            f"<published>{date}</published><content type=\"html\"><![CDATA[{page}]]></content></entry>"
            "<entry><title>Something else</title><link href=\"https://www.openhomefoundation.org/blog/x/\"/><published>2026-08-26T00:00:01+00:00</published>"
            "<content>no</content></entry></feed>")


def rss(entries: list[tuple[str, str, str, str]]) -> str:
    """entries: (title, link, RFC 822 date, text)."""
    body = "".join(f"<item><title>{t}</title><link>{lk}</link><pubDate>{d}</pubDate><description>{x}</description></item>" for t, lk, d, x in entries)
    return f'<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>{body}</channel></rss>'


def mk_item(iid: str = "thing", feeds: list[dict] | None = None, current: str | None = "1.0.0", **kw) -> dict:
    it = {
        "id": iid, "name": iid.title(), "kind": "library", "status": "in-use", "priority": "P1", "owner": "Arx platform lead",
        "urls": {"repo": f"https://github.com/example/{iid}"},
        "feeds": feeds if feeds is not None else [{"type": "github_releases", "repo": f"example/{iid}"}],
        "current": {"version": current, "source": "test", "verify": current is None},
        "dependents": ["README.md"], "watch_keywords": ["custom thing"], "note": "test item",
        "last_checked": None, "last_seen_version": None,
    }
    it.update(kw)
    return it


def mk_reg(*items: dict) -> dict:
    return {"schema_version": 1, "items": list(items)}


def run_one(tmp: Path, item: dict, reg_items: list[dict] | None = None, since_days: int = 45) -> uc.ItemResult:
    fetcher = uc.Fetcher(offline=True, fixtures_dir=tmp, delay=0)
    index = uc.ha_domain_index(reg_items or [item])
    return uc.check_item(item, fetcher, NOW, since_days, index)


# ---------------------------------------------------------------------------------------------------------------------
# versions
# ---------------------------------------------------------------------------------------------------------------------
def test_version_ordering():
    order = ["2.0.0-rc.1", "2.0.0-rc.37", "2.0.0", "2.0.1", "2.1", "10.0"]
    keys = [uc.parse_version(v) for v in order]
    assert all(k is not None for k in keys)
    assert keys == sorted(keys)
    assert uc.compare_versions("2026.10.0b0", "2026.9.4") == 1
    assert uc.compare_versions("2026.10.0", "2026.10.0b3") == 1
    assert uc.compare_versions("2026.10.0b3", "2026.10.0b10") == -1
    assert uc.compare_versions("v1.9.14", "1.9.14") == 0
    assert uc.compare_versions("n9.0.2", "n8.1.3") == 1
    assert uc.compare_versions("1.0", "1.0.0") == 0
    assert uc.compare_versions("2.0.0-beta.2", "2.0.0-alpha.9") == 1
    assert uc.compare_versions("1.14.0", "1.4.0-alpha07") == 1


def test_non_versions_and_dates():
    for bad in (None, "", "latest", "Pre-Release", "2026-10-02"):
        assert uc.parse_version(bad) is None
    assert uc.compare_versions("latest", "1.0") == -1
    assert uc.compare_versions(None, None) == 0
    assert uc.is_prerelease("2026.10.0b0") and uc.is_prerelease("2.0.0-rc.37") and not uc.is_prerelease("2026.9.4")


def test_major_bump_ignores_calendar_versions():
    assert uc.is_major_bump("7.0.2", "5.9.3")
    assert not uc.is_major_bump("5.10.0", "5.9.3")
    assert not uc.is_major_bump("2026.10.0", "2026.9.4")  # calendar versioning has no 'major'
    assert not uc.is_major_bump("20260930.0", "20260826.7")


def test_constraint_check():
    assert uc.violated_constraint("17.1", ">=13,<16") == "<16"
    assert uc.violated_constraint("15.0.1", ">=13,<16") is None
    assert uc.violated_constraint("12", ">=13,<16") == ">=13"
    assert uc.violated_constraint("2.5.3", ">=2.0,<3") is None
    assert uc.violated_constraint("1.0", "default model gpt-image-1.5") is None  # free text is ignored
    assert uc.violated_constraint(None, ">=1") is None


# ---------------------------------------------------------------------------------------------------------------------
# keywords
# ---------------------------------------------------------------------------------------------------------------------
def test_keyword_hits_generic_and_snippets():
    text = "This release has a BREAKING change: the old endpoint was removed and the option renamed. Config migration needed."
    hits = {h["keyword"]: h["snippet"] for h in uc.keyword_hits(text, list(uc.GENERIC_KEYWORDS))}
    assert set(hits) == {"breaking", "removed", "renamed", "migration"}
    assert "old endpoint" in hits["removed"]


def test_keyword_prefix_and_word_boundaries():
    assert [h["keyword"] for h in uc.keyword_hits("Support for X is deprecated since 2.0", ["deprecat"])] == ["deprecat"]
    assert uc.keyword_hits("a ServiceWorker fix", ["ICE"]) == []           # short keyword must be a whole word
    assert uc.keyword_hits("ICE candidates are mDNS now", ["ICE"])
    assert uc.keyword_hits("subremoved", ["removed"]) == []                 # must start a word
    assert uc.keyword_hits("nothing to see", list(uc.GENERIC_KEYWORDS)) == []


# ---------------------------------------------------------------------------------------------------------------------
# registry schema (the real one)
# ---------------------------------------------------------------------------------------------------------------------
@pytest.fixture(scope="module")
def registry() -> dict:
    return uc.load_registry()


def test_real_registry_is_valid(registry):
    assert uc.validate_registry(registry) == []


def test_every_item_has_urls_and_dependents_that_exist(registry):
    for it in registry["items"]:
        assert it["urls"], it["id"]
        assert it["dependents"], it["id"]
        for d in it["dependents"]:
            assert (ROOT / d).exists(), f"{it['id']}: dependent path does not exist: {d}"
        for name, url in it["urls"].items():
            assert re.match(r"https?://", url), f"{it['id']}.urls.{name}"


def test_registry_covers_what_the_owner_handed_us(registry):
    ids = {i["id"] for i in registry["items"]}
    for need in ("ha-core", "ha-supervisor", "ha-addon-spec", "ha-dev-blog", "ha-frontend", "hacs", "go2rtc", "hikvision-isapi-nvr",
                 "wiskey-hikvision-intercom", "music-assistant", "scheduler-component", "ha-int-risco", "cloudflared-addon",
                 "web-push-vapid", "fcm-android-push", "unifiedpush", "bubble-card", "domusui", "frigate-nvr", "provision-isr-nvr",
                 "chrome-webview-webrtc", "ffmpeg", "py-fastapi", "npm-lit", "npm-three", "npm-vite", "npm-playwright-test", "npm-typescript"):
        assert need in ids, need
    by = {i["id"]: i for i in registry["items"]}
    assert by["frigate-nvr"]["status"] == "planned" and by["provision-isr-nvr"]["status"] == "planned" and by["bubble-card"]["status"] == "planned"
    assert by["ha-core"]["status"] == "in-use" and by["ha-core"]["priority"] == "P0"
    assert {i["status"] for i in registry["items"]} == {"in-use", "planned"}


def test_home_assistant_is_fed_from_release_notes_and_beta_notes(registry):
    by = {i["id"]: i for i in registry["items"]}
    types = {f["type"] for f in by["ha-core"]["feeds"]}
    assert {"github_releases", "ha_release_notes", "ha_beta_notes"} <= types
    assert any(f["type"] == "ha_dev_blog" for f in by["ha-dev-blog"]["feeds"])
    assert by["ha-core"]["ha_domains"]


def test_python_pins_match_requirements_txt(registry):
    lines = (ROOT / "smplwise_vms/backend/requirements.txt").read_text(encoding="utf-8").splitlines()
    pins = {}
    for ln in lines:
        m = re.match(r"^([A-Za-z0-9_.\-]+)(?:\[[^\]]*\])?==([^\s;]+)", ln.strip())
        if m:
            pins[m.group(1).lower().replace("_", "-")] = m.group(2)
    checked = 0
    for it in registry["items"]:
        pyp = [f for f in it["feeds"] if f["type"] == "pypi"]
        if not pyp:
            continue
        pkg = pyp[0]["package"].lower()
        if pkg in pins:
            assert it["current"]["version"] == pins[pkg], f"{it['id']}: registry says {it['current']['version']}, requirements.txt pins {pins[pkg]}"
            checked += 1
        else:
            assert it["current"]["version"] is None, f"{it['id']} has a version but requirements.txt has no exact pin"
    assert checked >= 5


def test_npm_pins_match_package_lock(registry):
    lock = json.loads((ROOT / "frontend/package-lock.json").read_text(encoding="utf-8"))["packages"]
    checked = 0
    for it in registry["items"]:
        npm = [f for f in it["feeds"] if f["type"] == "npm"]
        if not npm or it["current"]["version"] is None:
            continue
        entry = lock.get("node_modules/" + npm[0]["package"])
        assert entry, f"{it['id']}: {npm[0]['package']} is not in package-lock.json"
        assert entry["version"] == it["current"]["version"], it["id"]
        checked += 1
    assert checked >= 5


def test_registry_has_no_lab_private_values(registry):
    text = json.dumps(registry)
    assert not re.search(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", text.replace("1.14.0", "")), "an IP-like value is in the registry"
    assert not re.search(r"(?i)\b([0-9a-f]{2}:){5}[0-9a-f]{2}\b", text), "a MAC-like value is in the registry"
    for pattern in (r"(?i)password", r"secrets/", r"\bLLAT\b", r"Bearer ", r"eyJ[A-Za-z0-9_-]{20,}", r"(?i)serial"):
        assert not re.search(pattern, text), pattern


@pytest.mark.parametrize("mutate,expect", [
    (lambda it: it.pop("urls"), "urls"),
    (lambda it: it.update(urls={}), "urls"),
    (lambda it: it.update(urls={"repo": "not a url"}), "urls.repo"),
    (lambda it: it.update(dependents=[]), "dependents"),
    (lambda it: it.pop("dependents"), "dependents"),
    (lambda it: it.update(kind="gadget"), "kind"),
    (lambda it: it.update(status="maybe"), "status"),
    (lambda it: it.update(priority="P9"), "priority"),
    (lambda it: it.update(feeds=[]), "no feeds"),
    (lambda it: it.update(feeds=[{"type": "carrier-pigeon"}]), "unknown feed type"),
    (lambda it: it.update(feeds=[{"type": "github_releases"}]), "needs repo"),
    (lambda it: it.update(current={"version": None, "source": "x", "verify": False}), "verify"),
    (lambda it: it.pop("last_checked"), "last_checked"),
    (lambda it: it.update(last_checked="yesterday"), "last_checked"),
    (lambda it: it.update(watch_keywords=[]), "watch_keywords"),
    (lambda it: it.update(via="nobody"), "via"),
])
def test_validator_rejects_broken_items(mutate, expect):
    good = mk_reg(mk_item())
    assert uc.validate_registry(good) == []
    bad = copy.deepcopy(good)
    mutate(bad["items"][0])
    errs = uc.validate_registry(bad)
    assert errs and any(expect in e for e in errs), errs


def test_validator_rejects_duplicate_ids_and_accepts_manual_or_via_items():
    a, b = mk_item("a"), mk_item("a")
    assert any("duplicate" in e for e in uc.validate_registry(mk_reg(a, b)))
    manual = mk_item("m", feeds=[], manual={"how": "look at the vendor page", "cadence_days": 30})
    via = mk_item("v", feeds=[], via="m")
    assert uc.validate_registry(mk_reg(manual, via)) == []
    assert any("schema_version" in e for e in uc.validate_registry({"schema_version": 2, "items": [mk_item()]}))


# ---------------------------------------------------------------------------------------------------------------------
# checking releases (github atom)
# ---------------------------------------------------------------------------------------------------------------------
def test_new_releases_newer_than_last_seen(tmp_path):
    put(tmp_path, "https://github.com/example/thing/releases.atom", gh_atom("example/thing", [
        ("v1.2.0", "2026-09-28T10:00:00Z", "Adds a feature"),
        ("v1.1.0", "2026-08-01T10:00:00Z", "Older"),
        ("v1.0.0", "2026-06-01T10:00:00Z", "Oldest")]))
    r = run_one(tmp_path, mk_item(last_seen_version="v1.1.0"))
    assert [e["version"] for e in r.new_entries] == ["v1.2.0"]
    assert r.latest_stable == "v1.2.0" and r.verdict == "new" and r.behind


def test_nothing_new_is_ok(tmp_path):
    put(tmp_path, "https://github.com/example/thing/releases.atom", gh_atom("example/thing", [("v1.0.0", "2026-06-01T10:00:00Z", "x")]))
    r = run_one(tmp_path, mk_item(current="1.0.0"))
    assert r.verdict == "ok" and not r.new_entries and not r.behind


def test_breaking_keywords_flag_attention_with_snippet(tmp_path):
    put(tmp_path, "https://github.com/example/thing/releases.atom", gh_atom("example/thing", [
        ("v1.3.0", "2026-09-28T10:00:00Z", "The legacy endpoint was removed. See the migration guide.")]))
    r = run_one(tmp_path, mk_item(current="1.2.0"))
    assert r.verdict == "attention"
    kws = {h["keyword"] for h in r.new_entries[0]["hits"]}
    assert {"removed", "migration"} <= kws


def test_item_specific_keyword_flags(tmp_path):
    put(tmp_path, "https://github.com/example/thing/releases.atom", gh_atom("example/thing", [
        ("v1.3.0", "2026-09-28T10:00:00Z", "Changes how a custom thing is configured")]))
    r = run_one(tmp_path, mk_item(current="1.2.0"))
    assert r.verdict == "attention" and r.new_entries[0]["hits"][0]["keyword"] == "custom thing"


def test_major_bump_is_attention(tmp_path):
    put(tmp_path, "https://github.com/example/thing/releases.atom", gh_atom("example/thing", [("v2.0.0", "2026-09-28T10:00:00Z", "shiny")]))
    r = run_one(tmp_path, mk_item(current="1.9.0"))
    assert r.verdict == "attention" and "MAJOR version bump" in r.flags


def test_prerelease_reported_once_and_only_when_newer(tmp_path):
    put(tmp_path, "https://github.com/example/thing/releases.atom", gh_atom("example/thing", [
        ("v1.1.0-rc.2", "2026-09-30T10:00:00Z", "rc"), ("v1.0.0", "2026-06-01T10:00:00Z", "stable")]))
    r = run_one(tmp_path, mk_item(current="1.0.0"))
    assert r.prerelease == "v1.1.0-rc.2" and any(e["prerelease"] for e in r.new_entries)
    assert any("pre-release" in f for f in r.flags)
    again = run_one(tmp_path, mk_item(current="1.0.0", last_seen_prerelease="v1.1.0-rc.2"))
    assert not again.new_entries
    older = run_one(tmp_path, mk_item(current="1.1.0-rc.2"))  # we already run it: not news
    assert older.prerelease is None


def test_baseline_without_reference_uses_window_then_latest(tmp_path):
    put(tmp_path, "https://github.com/example/thing/releases.atom", gh_atom("example/thing", [
        ("v1.2.0", "2026-09-28T10:00:00Z", "recent"), ("v1.1.0", "2026-01-01T10:00:00Z", "old")]))
    r = run_one(tmp_path, mk_item(current=None))
    assert [e["version"] for e in r.new_entries] == ["v1.2.0"]
    r2 = run_one(tmp_path, mk_item(current=None), since_days=1)  # nothing in the window: still show the latest once
    assert [e["version"] for e in r2.new_entries] == ["v1.2.0"]


def test_tag_filter_keeps_only_matching_series(tmp_path):
    put(tmp_path, "https://github.com/example/thing/tags.atom", gh_atom("example/thing", [
        ("v3.13.1", "2026-09-28T10:00:00Z", ""), ("v3.12.15", "2026-09-27T10:00:00Z", ""), ("v3.12.14", "2026-08-27T10:00:00Z", "")], page="releases"))
    item = mk_item(feeds=[{"type": "github_tags", "repo": "example/thing", "tag_filter": r"^v3\.12\.\d+$"}], current="3.12.14")
    r = run_one(tmp_path, item)
    assert r.latest_stable == "v3.12.15" and [e["version"] for e in r.new_entries] == ["v3.12.15"]


def test_unreachable_feed_is_reported_not_raised(tmp_path):
    r = run_one(tmp_path, mk_item())  # no fixture written
    assert r.verdict == "unreachable" and r.errors and "no-fixture" in r.errors[0]


def test_manual_and_via_items_have_their_own_verdicts(tmp_path):
    manual = mk_item("m", feeds=[], manual={"how": "check the page", "cadence_days": 30})
    via = mk_item("v", feeds=[], via="m")
    assert run_one(tmp_path, manual).verdict == "manual"
    r = run_one(tmp_path, via)
    assert r.verdict == "no-feed" and "tracked through m" in r.flags[0]


# ---------------------------------------------------------------------------------------------------------------------
# other feed types
# ---------------------------------------------------------------------------------------------------------------------
def test_pypi_npm_maven_gradle_and_text_regex(tmp_path):
    put(tmp_path, "https://pypi.org/pypi/foo/json", json.dumps({"info": {"version": "0.28.1", "release_url": "https://pypi.org/project/foo/0.28.1/", "summary": "x"},
                                                              "releases": {"0.28.1": [{"upload_time_iso_8601": "2026-09-01T00:00:00Z"}]}}))
    r = run_one(tmp_path, mk_item("foo", feeds=[{"type": "pypi", "package": "foo"}], current="0.27.2"))
    assert r.latest_stable == "0.28.1" and r.behind and r.verdict == "new"

    put(tmp_path, "https://registry.npmjs.org/@scope%2fbar/latest", json.dumps({"version": "6.1.0", "description": "bar"}))
    r = run_one(tmp_path, mk_item("bar", feeds=[{"type": "npm", "package": "@scope/bar"}], current="5.9.3"))
    assert r.latest_stable == "6.1.0" and "MAJOR version bump" in r.flags

    mvn = ("<metadata><groupId>g</groupId><artifactId>a</artifactId><versioning><versions>"
           "<version>1.1.0</version><version>1.14.0</version><version>1.18.0-alpha02</version></versions></versioning></metadata>")
    put(tmp_path, "https://example.org/m/maven-metadata.xml", mvn)
    r = run_one(tmp_path, mk_item("a", feeds=[{"type": "maven_metadata", "url": "https://example.org/m/maven-metadata.xml"}], current="1.14.0"))
    assert r.latest_stable == "1.14.0" and r.prerelease == "1.18.0-alpha02" and r.behind is False

    put(tmp_path, "https://services.gradle.org/versions/current", json.dumps({"version": "9.8.0", "buildTime": "20260924134000+0000"}))
    r = run_one(tmp_path, mk_item("g", feeds=[{"type": "gradle_current"}], current="8.11.1"))
    assert r.latest_stable == "9.8.0" and r.verdict == "attention"

    put(tmp_path, "https://example.org/config.yaml", "name: x\nversion: 1.9.14-hardware\n")
    r = run_one(tmp_path, mk_item("t", feeds=[{"type": "text_regex", "url": "https://example.org/config.yaml", "pattern": r"^version:\s*([0-9][0-9.]*[0-9])"}], current="1.9.14"))
    assert r.latest_stable == "1.9.14" and r.verdict == "ok"
    put(tmp_path, "https://example.org/config.yaml", "name: x\n")
    r = run_one(tmp_path, mk_item("t", feeds=[{"type": "text_regex", "url": "https://example.org/config.yaml", "pattern": r"^version:\s*(\S+)"}]))
    assert r.verdict == "unreachable" and "bad-data" in r.errors[0]


def test_malformed_json_and_xml_do_not_crash(tmp_path):
    put(tmp_path, "https://pypi.org/pypi/foo/json", "<html>not json</html>")
    assert run_one(tmp_path, mk_item("foo", feeds=[{"type": "pypi", "package": "foo"}])).verdict == "unreachable"
    put(tmp_path, "https://github.com/example/thing/releases.atom", "<feed><entry>")
    assert run_one(tmp_path, mk_item()).verdict == "unreachable"


def test_constraint_flag_for_a_package_outside_its_range(tmp_path):
    put(tmp_path, "https://pypi.org/pypi/websockets/json", json.dumps({"info": {"version": "17.1"}, "releases": {}}))
    item = mk_item("ws", feeds=[{"type": "pypi", "package": "websockets"}], current=None)
    item["current"]["constraint"] = ">=13,<16"
    r = run_one(tmp_path, item)
    assert any("outside our version constraint" in f and "<16" in f for f in r.flags)


# ---------------------------------------------------------------------------------------------------------------------
# dated feeds (HA developer blog)
# ---------------------------------------------------------------------------------------------------------------------
def test_dev_blog_flags_platform_keywords_only(tmp_path):
    url = "https://developers.example.org/blog/atom.xml"
    put(tmp_path, url, rss([
        ("WebSocket API gets a new auth command", "https://d/1", "Tue, 29 Sep 2026 00:00:00 GMT", "The websocket api changes; removed old command."),
        ("Lawn mowers get a stop action", "https://d/2", "Mon, 28 Sep 2026 00:00:00 GMT", "A removed legacy thing, nothing platform related."),
        ("Ancient post about websocket", "https://d/3", "Mon, 01 Jan 2024 00:00:00 GMT", "websocket")]))
    item = mk_item("blog", feeds=[{"type": "ha_dev_blog", "url": url, "use_generic": False}], current=None, watch_keywords=["websocket"])
    r = run_one(tmp_path, item)
    titles = [e["title"] for e in r.new_entries]
    assert "Ancient post about websocket" not in titles and len(titles) == 2          # 45-day baseline window
    assert r.verdict == "attention"
    hit_titles = [e["title"] for e in r.new_entries if e["hits"]]
    assert hit_titles == ["WebSocket API gets a new auth command"]                   # generic 'removed' is off for this feed
    assert r.newest_seen == "2026-09-29"
    # after acknowledging, only newer posts count
    item2 = dict(item, last_seen_version="2026-09-29")
    assert run_one(tmp_path, item2).new_entries == []


# ---------------------------------------------------------------------------------------------------------------------
# Home Assistant: backward-incompatible changes
# ---------------------------------------------------------------------------------------------------------------------
HA_BIC = [("Cast", "The Google Cast <a href=\"/integrations/cast/\">docs</a> volume step is now removed."),
          ("Flexit Nordic (BACnet)", "The fireplace switch was removed. <a href=\"/integrations/flexit_bacnet/\">docs</a>"),
          ("Authentication", "The legacy mode of the authentication provider is gone."),
          ("MQTT", "mqtt.publish now requires an administrator. <a href=\"/integrations/mqtt/\">docs</a>")]


def ha_registry() -> list[dict]:
    ha = mk_item("ha-core", feeds=[{"type": "ha_release_notes", "url": "https://ha.example/atom.xml"},
                                   {"type": "ha_beta_notes", "url": "https://rc.ha.example/latest-release-notes"}],
                 current="2026.9.4", watch_keywords=["authentication", "websocket"], ha_domains=["hassio", "auth"])
    cast = mk_item("ha-int-cast", feeds=[], via="ha-core", ha_domains=["cast"])
    pai = mk_item("paradox-pai", feeds=[], via="ha-core", ha_domains=["mqtt"])
    return [ha, cast, pai]


def test_extract_bic_headings_and_domains():
    items = uc.extract_bic(ha_notes_page(HA_BIC))
    assert [i["title"] for i in items] == ["Cast", "Flexit Nordic (BACnet)", "Authentication", "MQTT"]
    assert items[0]["domains"] == ["cast"] and items[3]["domains"] == ["mqtt"]
    assert uc.extract_bic("<h2>Something else</h2>") == []
    assert "removed everything here" not in " ".join(i["text"] for i in items)    # stops at the next h2


def test_ha_release_notes_bic_matches_registry_items(tmp_path):
    put(tmp_path, "https://ha.example/atom.xml", ha_notes_atom("2026.10", "2026.10: Next", ha_notes_page(HA_BIC, ("2026.10.1", "2026.10.2"))))
    put(tmp_path, "https://rc.ha.example/latest-release-notes", "<html><head><title>2026.11 Beta: x - Home Assistant</title></head><body>"
        + ha_notes_page([("Camera", "<a href=\"/integrations/camera/\">c</a> changed"), ("Cast", "cast <a href=\"/integrations/cast/\">x</a> removed")]) + "</body></html>")
    regs = ha_registry()
    r = run_one(tmp_path, regs[0], regs)
    assert r.latest_stable == "2026.10.2"                                           # patch level read from the notes
    assert r.verdict == "attention"
    bic = {b["release"]: b for b in r.ha["bic"]}
    assert set(bic) == {"2026.10.2", "2026.11.0b0"}                                 # stable notes and the beta notes
    matched = {m["title"]: m for m in bic["2026.10.2"]["matched"]}
    assert matched["Cast"]["affects"] == ["ha-int-cast"]
    assert matched["MQTT"]["affects"] == ["paradox-pai"]
    assert "Authentication" in matched and "authentication" in " ".join(matched["Authentication"]["reasons"])
    assert "Flexit Nordic (BACnet)" not in matched                                  # nothing of ours: stays in the headings only
    assert "Flexit Nordic (BACnet)" in bic["2026.10.2"]["all_titles"]
    assert bic["2026.11.0b0"]["beta_notes"] is True and r.prerelease == "2026.11.0b0"


def test_ha_notes_for_the_version_we_run_are_not_news(tmp_path):
    put(tmp_path, "https://ha.example/atom.xml", ha_notes_atom("2026.9", "2026.9: Bus", ha_notes_page(HA_BIC, ("2026.9.4",))))
    put(tmp_path, "https://rc.ha.example/latest-release-notes", "<title>2026.9 Beta - Home Assistant</title>" + ha_notes_page(HA_BIC))
    regs = ha_registry()
    r = run_one(tmp_path, regs[0], regs)
    assert r.verdict == "ok" and not r.ha and r.prerelease is None


# ---------------------------------------------------------------------------------------------------------------------
# state, report, CLI
# ---------------------------------------------------------------------------------------------------------------------
def test_apply_state_holds_back_flagged_items_until_acknowledged(tmp_path):
    put(tmp_path, "https://github.com/example/quiet/releases.atom", gh_atom("example/quiet", [("v1.1.0", "2026-09-28T10:00:00Z", "small fix")]))
    put(tmp_path, "https://github.com/example/loud/releases.atom", gh_atom("example/loud", [("v1.1.0", "2026-09-28T10:00:00Z", "BREAKING: removed the API")]))
    reg = mk_reg(mk_item("quiet"), mk_item("loud"), mk_item("down", feeds=[{"type": "github_releases", "repo": "example/down"}]))
    results = uc.run_checks(reg, uc.Fetcher(offline=True, fixtures_dir=tmp_path, delay=0), NOW)
    by = {r.id: r.verdict for r in results}
    assert by == {"quiet": "new", "loud": "attention", "down": "unreachable"}
    held = uc.apply_state(reg, results, "2026-10-02")
    items = {i["id"]: i for i in reg["items"]}
    assert held == ["loud"]
    assert items["quiet"]["last_seen_version"] == "v1.1.0" and items["quiet"]["last_checked"] == "2026-10-02"
    assert items["loud"]["last_seen_version"] is None and items["loud"]["last_checked"] == "2026-10-02"
    assert items["down"]["last_checked"] is None and items["down"]["last_seen_version"] is None       # unreachable: nothing recorded
    uc.apply_state(reg, results, "2026-10-02", ack={"loud"})
    assert items["loud"]["last_seen_version"] == "v1.1.0"
    # the acknowledged release is no longer news on the next run
    again = uc.run_checks(reg, uc.Fetcher(offline=True, fixtures_dir=tmp_path, delay=0), NOW)
    assert {r.id: r.verdict for r in again}["quiet"] == "ok"


def test_save_registry_round_trip_is_stable(tmp_path):
    p = tmp_path / "reg.json"
    reg = mk_reg(mk_item())
    uc.save_registry(reg, p)
    first = p.read_text(encoding="utf-8")
    uc.save_registry(uc.load_registry(p), p)
    assert p.read_text(encoding="utf-8") == first and first.endswith("}\n") and "\r" not in first


def test_markdown_report_groups_by_priority_and_lists_problems(tmp_path):
    put(tmp_path, "https://github.com/example/p0/releases.atom", gh_atom("example/p0", [("v2.0.0", "2026-09-28T10:00:00Z", "removed things")]))
    put(tmp_path, "https://github.com/example/p2/releases.atom", gh_atom("example/p2", [("v1.0.0", "2026-06-01T10:00:00Z", "x")]))
    reg = mk_reg(mk_item("p0", current="1.0.0", priority="P0"), mk_item("p2", current="1.0.0", priority="P2"),
                 mk_item("gone", priority="P1", feeds=[{"type": "github_releases", "repo": "example/gone"}]),
                 mk_item("manual-one", feeds=[], priority="P3", manual={"how": "ask the owner", "cadence_days": 90}))
    results = uc.run_checks(reg, uc.Fetcher(offline=True, fixtures_dir=tmp_path, delay=0), NOW)
    md = uc.render_markdown(results, NOW, 4, 3, True)
    assert md.index("## P0") < md.index("## P1") < md.index("## P2") < md.index("## P3")
    assert "### p0 - P0 [in-use] - ATTENTION" in md and "MAJOR version bump" in md and "`removed`" in md
    assert "Up to date: p2 (v1.0.0)" in md
    assert "## Feeds that could not be read" in md and "gone" in md
    assert "## Manual checks" in md and "ask the owner" in md
    assert "## Version drift" in md and "| p0 | 1.0.0 | v2.0.0 |" in md


def test_cli_offline_json_and_write_state(tmp_path, capsys):
    put(tmp_path, "https://github.com/example/a/releases.atom", gh_atom("example/a", [("v1.1.0", "2026-09-28T10:00:00Z", "fine")]))
    regp = tmp_path / "reg.json"
    uc.save_registry(mk_reg(mk_item("a")), regp)
    rc = uc.main(["--registry", str(regp), "--offline", "--fixtures", str(tmp_path), "--json", "--write-state"])
    assert rc == 0
    out = json.loads(capsys.readouterr().out)
    assert out[0]["id"] == "a" and out[0]["latest_stable"] == "v1.1.0"
    saved = uc.load_registry(regp)["items"][0]
    assert saved["last_seen_version"] == "v1.1.0" and re.fullmatch(r"\d{4}-\d\d-\d\d", saved["last_checked"])
    assert uc.main(["--registry", str(regp), "--validate"]) == 0
    assert uc.main(["--registry", str(regp), "--offline", "--fixtures", str(tmp_path), "--only", "a", "--fail-on-attention"]) == 0


def test_cli_rejects_an_invalid_registry(tmp_path, capsys):
    p = tmp_path / "bad.json"
    p.write_text(json.dumps({"schema_version": 1, "items": [{"id": "x"}]}), encoding="utf-8")
    assert uc.main(["--registry", str(p), "--validate"]) == 3
    assert "invalid" in capsys.readouterr().err


# ---------------------------------------------------------------------------------------------------------------------
# network behaviour (urlopen is replaced: nothing leaves the machine)
# ---------------------------------------------------------------------------------------------------------------------
class _Resp:
    def __init__(self, data: bytes):
        self._d = data

    def read(self, n=-1):
        return self._d

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_fetcher_sends_polite_user_agent_and_token_only_to_the_github_api(monkeypatch):
    seen = []

    def fake_urlopen(req, timeout=None):
        seen.append((req.full_url, dict(req.header_items()), timeout))
        return _Resp(b"ok")

    monkeypatch.setattr(uc.urllib.request, "urlopen", fake_urlopen)
    f = uc.Fetcher(token="tok123", delay=0, timeout=7)
    f.get("https://github.com/home-assistant/core/releases.atom")
    f.get("https://api.github.com/repos/home-assistant/core/releases")
    f.get("https://pypi.org/pypi/x/json")
    atom, api, pypi = seen
    assert "smplwise-upstream-watch" in atom[1]["User-agent"] and atom[2] == 7
    assert "Authorization" not in atom[1] and "Authorization" not in pypi[1]
    assert api[1]["Authorization"] == "Bearer tok123"


def test_fetcher_without_token_never_sends_authorization(monkeypatch):
    seen = []
    monkeypatch.setattr(uc.urllib.request, "urlopen", lambda req, timeout=None: seen.append(dict(req.header_items())) or _Resp(b"x"))
    uc.Fetcher(token=None, delay=0).get("https://api.github.com/repos/a/b/releases")
    assert "Authorization" not in seen[0]


def _http_error(code: int, headers: dict[str, str]) -> urllib.error.HTTPError:
    import email.message
    m = email.message.Message()
    for k, v in headers.items():
        m[k] = v
    return urllib.error.HTTPError("https://api.github.com/x", code, "Forbidden", m, None)


def test_github_rate_limit_is_reported_without_retrying_forever(monkeypatch):
    calls = []

    def fake_urlopen(req, timeout=None):
        calls.append(req.full_url)
        raise _http_error(403, {"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1790000000"})

    monkeypatch.setattr(uc.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(uc.FetchError) as ei:
        uc.Fetcher(delay=0).get("https://api.github.com/repos/a/b/releases")
    assert ei.value.kind == "rate-limited" and "GITHUB_TOKEN" in str(ei.value) and len(calls) == 1


def test_not_found_and_network_errors_are_classified(monkeypatch):
    monkeypatch.setattr(uc.time, "sleep", lambda s: None)
    monkeypatch.setattr(uc.urllib.request, "urlopen", lambda req, timeout=None: (_ for _ in ()).throw(_http_error(404, {})))
    with pytest.raises(uc.FetchError) as ei:
        uc.Fetcher(delay=0).get("https://example.org/x")
    assert ei.value.kind == "not-found"
    n = []

    def boom(req, timeout=None):
        n.append(1)
        raise urllib.error.URLError("dns failure")

    monkeypatch.setattr(uc.urllib.request, "urlopen", boom)
    with pytest.raises(uc.FetchError) as ei:
        uc.Fetcher(delay=0).get("https://example.org/y")
    assert ei.value.kind == "unreachable" and len(n) == 2                           # one retry


def test_github_atom_failure_falls_back_to_the_rest_api(monkeypatch):
    api = json.dumps([{"tag_name": "v2.0.0", "name": "Two", "html_url": "https://github.com/example/thing/releases/tag/v2.0.0",
                       "published_at": "2026-09-28T10:00:00Z", "body": "notes", "prerelease": False}])

    def fake_urlopen(req, timeout=None):
        if "releases.atom" in req.full_url:
            raise _http_error(429, {})
        return _Resp(api.encode())

    monkeypatch.setattr(uc.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(uc.time, "sleep", lambda s: None)
    fetcher = uc.Fetcher(delay=0)
    entries = uc.collect_entries({"type": "github_releases", "repo": "example/thing"}, fetcher)
    assert [e.version for e in entries] == ["v2.0.0"]


def test_fixture_name_is_stable_and_filesystem_safe():
    n = uc.fixture_name("https://github.com/home-assistant/core/releases.atom")
    assert n == "github_com_home_assistant_core_releases_atom.txt"
    assert re.fullmatch(r"[A-Za-z0-9_]+\.txt", uc.fixture_name("https://registry.npmjs.org/%40scope%2fbar/latest?x=1&y=2"))
