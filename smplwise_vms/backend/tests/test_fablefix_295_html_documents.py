"""FABLEFIX-295 D-01 / D-02 (Fable security review 2026-10-21, section 7.1): the HTML document tripwire, the producer-side escape, and
the opaque download.

The probe list is the review's own (section 7.1) plus a few neighbours of each bypass class. Every probe must be refused by the
tripwire; a realistic self-contained report and a report built with `escape_text` from hostile names must be accepted; and the public
file route must hand an HTML document over as application/octet-stream (never `text/html`)."""
from __future__ import annotations

import hashlib
import html

import pytest

from smplwise.services.tickets import out_documents as D, public_documents as PD, settings_doc
from test_vendorq_294_documents import _get, _mint, _token, s4  # noqa: F401 - s4 is the fixture

PROBES = {
    # the four the original filter already blocked (section 7.1) - kept as regressions
    "script tag": "<p>x</p><script>alert(1)</script>",
    "javascript href": "<a href='javascript:alert(1)'>x</a>",
    "remote img": "<img src='https://tracker.example/p.gif'>",
    "meta refresh": "<meta http-equiv='refresh' content='0;url=https://evil.example/'>",
    "protocol-relative background with leading newline": "<td background=\"\n//evil.example/a.png\">x</td>",
    # the fifteen-plus that passed before the fix
    "img onerror handler": "<img src=x onerror=alert(1)>",
    "svg onload handler": "<svg onload=alert(1)></svg>",
    "svg slash onload": "<svg/onload=alert(1)>",
    "body onload": "<body onload=\"alert(1)\">",
    "details ontoggle": "<details open ontoggle=alert(1)><summary>x</summary></details>",
    "entity-encoded javascript scheme": "<a href=\"&#106;avascript:alert(1)\">x</a>",
    "hex-entity javascript scheme": "<a href=\"&#x6a;avascript:alert(1)\">x</a>",
    "entity-encoded colon": "<a href=\"javascript&#58;alert(1)\">x</a>",
    "named-entity colon": "<a href=\"javascript&colon;alert(1)\">x</a>",
    "tab inside scheme": "<a href=\"java\tscript:alert(1)\">x</a>",
    "newline inside scheme": "<a href=\"java\nscript:alert(1)\">x</a>",
    "svg script via data:image/svg+xml in a href": "<a href=\"data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+\">x</a>",
    "svg use with data:image": "<svg><use href=\"data:image/svg+xml,%3Csvg%20id='x'%3E%3C/svg%3E#x\"/></svg>",
    "svg xlink use with data:image": "<svg><use xlink:href=\"data:image/svg+xml;base64,PHN2Zz4=#x\"/></svg>",
    "style tag with expression (IE only)": "<style>td{width:expression(alert(1))}</style>",
    "style attribute behavior": "<div style=\"behavior:url(x.htc)\">x</div>",
    "css url with escape": "<div style=\"background:url(\\6a avascript:alert(1))\">x</div>",
    "input autofocus onfocus": "<input autofocus onfocus=alert(1)>",
    "video poster relative + onloadstart": "<video poster=\"a.png\" onloadstart=alert(1)><source></video>",
    "formaction without form (button)": "<button formaction=\"https://evil.example/\">x</button>",
    "formaction protocol-relative": "<button formaction=//evil.example>x</button>",
    "srcdoc on non-iframe (inert)": "<div srcdoc=\"&lt;b&gt;x&lt;/b&gt;\">x</div>",
    "entity in meta http-equiv": "<meta http&#45;equiv=\"refresh\" content=\"0;url=https://evil.example/\">",
    "meta charset with a refresh tail": "<meta charset=\"utf-8\" http-equiv=\"refresh\" content=\"0\">",
    "svg animate to javascript": "<svg><a><animate attributeName=href values=javascript:alert(1) /><text y=20>x</text></a></svg>",
    "svg set attribute": "<svg><set attributeName=\"onmouseover\" to=\"alert(1)\"/></svg>",
    "math href": "<math href=\"javascript:alert(1)\">x</math>",
    "vbscript scheme": "<a href=\"vbscript:msgbox(1)\">x</a>",
    "unquoted entity scheme": "<a href=&#106;avascript&#58;alert(1)>x</a>",
    "backslash protocol-relative": "<img src=\"\\\\evil.example\\a.png\">",
    "css import": "<style>@import 'https://evil.example/a.css';</style>",
    "nul inside scheme": "<a href=\"java\x00script:alert(1)\">x</a>",
}

GOOD_REPORT = ("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
               "<title>HACCP</title><style>body{font-family:sans-serif}td,th{border:1px solid #ccc;padding:4px}"
               ".bad{color:#b00}</style></head><body><h1>דוח HACCP - ספטמבר</h1>"
               "<table><tr><th>חיישן</th><th>טמפ'</th></tr><tr><td>מקרר 1</td><td class=\"bad\">7.5</td></tr></table>"
               "<a href=\"#top\">top</a><img alt=\"logo\" src=\"data:image/png;base64,iVBORw0KGgo=\"></body></html>")

HOSTILE_NAMES = list(PROBES.values()) + ["O'Brien & Sons \"Ltd\"", "a=b:c(d)", "מקרר <b>ראשי</b> onerror=1", "x\\y//z", "&#106;"]


@pytest.mark.parametrize("name", sorted(PROBES))
def test_every_review_probe_is_refused_by_the_tripwire(name):
    assert D._HTML_FORBIDDEN.search(PROBES[name]), name
    with pytest.raises(D.DocumentRefused) as exc:
        D._check_content("text/html", PROBES[name].encode("utf-8"))
    assert exc.value.code == "document_html_unsafe"


def test_a_realistic_self_contained_report_is_still_accepted():
    D._check_content("text/html", GOOD_REPORT.encode("utf-8"))  # no refusal


def test_escape_text_makes_hostile_names_inert_and_never_trips_the_tripwire():
    for raw in HOSTILE_NAMES:
        out = D.escape_text(raw)
        assert not any(ch in out for ch in "<>\"'=:()/\\`\t\n\x00"), raw
        assert not D._HTML_FORBIDDEN.search(out), raw
        assert html.unescape(out) == raw  # the reader sees exactly the name
        doc = GOOD_REPORT.replace("מקרר 1", out)
        D._check_content("text/html", doc.encode("utf-8"))
    assert D.escape_text("מקרר ראשי 2") == "מקרר ראשי 2" and D.escape_text(None) == ""


def test_an_html_document_is_downloaded_as_opaque_bytes_and_a_pdf_keeps_its_type(s4):  # noqa: F811
    assert PD.file_media_type("text/html") == "application/octet-stream"
    assert PD.file_media_type("application/pdf") == "application/pdf"
    assert PD.file_media_type("anything/else") == "application/octet-stream"
    body = GOOD_REPORT.encode("utf-8")
    doc = _mint(s4, media_type="text/html", filename="haccp-2026-09.html", content=body)
    token = _token(s4, doc["id"])
    client, _app = s4.public()
    meta = _get(client, "doc", token)
    assert meta.status_code == 200 and meta.json()["media_type"] == "text/html"  # the page still names what it is
    got = _get(client, "doc/file", token)
    assert got.status_code == 200 and got.content == body
    assert got.headers["content-type"] == "application/octet-stream"
    assert "text/html" not in got.headers["content-type"]
    assert got.headers["content-disposition"].startswith('attachment; filename="haccp-2026-09.html"')
    assert got.headers["x-content-type-options"] == "nosniff" and got.headers["x-document-digest"] == hashlib.sha256(body).hexdigest()


def test_minting_refuses_a_probe_end_to_end(s4):  # noqa: F811
    with s4.db.connection() as conn:
        settings_doc.apply_patch(conn, {"reports": {"documents": True}})
    with pytest.raises(D.DocumentRefused) as exc:
        _mint(s4, media_type="text/html", filename="r.html", content=PROBES["img onerror handler"].encode("utf-8"))
    assert exc.value.code == "document_html_unsafe"
