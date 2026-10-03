"""Colour palettes of the Bubble skin (release 0.1.156): the ten ready palettes (data: docs/design/palettes/palettes.json, loaded
by the frontend from design/palettes.json) and the CUSTOM palettes an administrator saves per installation (`ui.palettes`).

The palette DIAL is part of `ui.look` (services/look.py): `default` (the skin's own colours), one of the ten ids below, or
`custom-<slug>` (a saved custom palette; its existence is the frontend's to resolve - an id with no palette behind it reads as
`default`, so deleting a palette never breaks anybody's override).

A custom palette is a closed set of colour tokens per scheme (light, dark) - the same schema as docs/design/palettes/palettes.schema.json
and the same WCAG 2.x contrast checks as docs/design/palettes/validate_palettes.mjs and frontend/src/design/palette.ts (text 4.5:1,
non-text 3:1, translucent layers composited over the lightest and the darkest wallpaper stop at the minimum glass opacity).

Owner decision 2026-10-02: contrast is a WARNING, not a gate. A custom palette that is structurally valid but fails some contrast pair is
ACCEPTED and stored (the editor warns, lists the worst pairs and offers an auto-fix); only a structurally invalid palette (shape, closed
token set, colour formats, ids, limits) is refused with a 422 and a Hebrew message. `failing_pairs` / `describe_failures` stay here as the
twin of the frontend checks (tests, tooling); they are never a reason to refuse. The dark scheme's accent is derived client-side
(frontend/src/design/palette.ts effectiveScheme), so these checks look at the stored colours. Pure functions, no I/O."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

def _builtin_ids() -> tuple[str, ...]:
    """The ready palettes' ids: read from smplwise/palettes.json, a copy of docs/design/palettes/palettes.json (a test keeps the copies identical),
    so adding a palette is a data-only change (docs/design/palettes/README.md)."""
    data = json.loads((Path(__file__).resolve().parent.parent / "palettes.json").read_text(encoding="utf-8"))
    return tuple(p["id"] for p in data["palettes"])


BUILTIN_IDS: tuple[str, ...] = _builtin_ids()
BASE_ID = "default"  # the base palette (the calm-blue family): the protected fallback; never stored, deleted or replaced by a custom palette
CUSTOM_PREFIX = "custom-"
CUSTOM_ID_RE = re.compile(r"^custom-[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_CUSTOM = 12
MAX_CUSTOM_ID = 40
TEXT_MIN = 4.5
UI_MIN = 3.0

_HEX = re.compile(r"^#[0-9a-f]{6}$", re.I)
_HEXA = re.compile(r"^#([0-9a-f]{6})([0-9a-f]{2})?$", re.I)
_RGBA = re.compile(r"^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$", re.I)

# path -> kind ('hex' | 'color' (hex or rgba) | 'number' | 'hex[]' | 'pairs'); every key is required, unknown keys are an error
SCHEMA: dict[str, str] = {
    "bg": "hex", "surface": "hex", "surface2": "hex", "surfaceElevated": "hex", "text": "hex", "textMuted": "hex", "border": "color",
    "accent": "hex", "accentContrast": "hex", "accentText": "hex",
    "glass.tint": "hex", "glass.opacity.min": "number", "glass.opacity.default": "number", "glass.opacity.max": "number",
    "glass.layer": "color", "glass.overlay": "color", "glass.blurPx": "number",
    "state.on": "hex", "state.off": "hex", "state.unavailable": "hex", "state.success": "hex", "state.warning": "hex", "state.danger": "hex",
    "state.successText": "hex", "state.warningText": "hex", "state.dangerText": "hex",
    "entity.light": "hex", "entity.climate": "hex", "entity.cover": "hex", "entity.media": "hex", "entity.security": "hex", "entity.camera": "hex", "entity.icon": "hex",
    "gradient.pairs": "pairs", "gradient.text": "hex",
    "slider.fill": "hex", "slider.fillCool": "hex", "slider.onFill": "hex", "slider.edge": "hex", "slider.track": "hex",
    "wallpaper.stops": "hex[]", "wallpaper.angle": "number",
}
_KNOWN = set(SCHEMA)

Color = tuple[float, float, float, float]


def parse(v: Any) -> Color:
    if not isinstance(v, str):
        raise ValueError(f"not a colour: {str(v)[:20]!r}")
    v = v.strip()
    m = _HEXA.match(v)
    if m:
        h = m.group(1)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(m.group(2), 16) / 255 if m.group(2) else 1.0)
    m = _RGBA.match(v)
    if m:
        a = 1.0 if m.group(4) is None else float(m.group(4))
        return (float(m.group(1)), float(m.group(2)), float(m.group(3)), a)
    raise ValueError(f"unsupported colour {v[:24]!r}")


def over(fg: Color, bg: Color) -> Color:
    a = fg[3]
    return (fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1.0)


def _lin(c: float) -> float:
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lum(c: Color) -> float:
    return 0.2126 * _lin(c[0]) + 0.7152 * _lin(c[1]) + 0.0722 * _lin(c[2])


def ratio(a: Color, b: Color) -> float:
    x, y = lum(a), lum(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


def to_hex(c: Color) -> str:
    return "#" + "".join(f"{max(0, min(255, round(x))):02x}" for x in c[:3])


def _get(o: Any, path: str) -> Any:
    for k in path.split("."):
        if not isinstance(o, dict) or k not in o:
            return None
        o = o[k]
    return o


def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def schema_errors(pal: Any) -> list[str]:
    """Structural problems of a palette object (English, for logs and tests); empty = well-formed."""
    errs: list[str] = []
    if not isinstance(pal, dict):
        return ["palette must be an object"]
    extra = set(pal) - {"id", "name", "character", "schemes"}
    if extra:
        errs.append("unknown palette keys: " + ", ".join(sorted(str(k)[:20] for k in extra)))
    if not re.match(r"^[a-z][a-z0-9-]{1,40}$", str(pal.get("id") or "")):
        errs.append("id: lower-case kebab id required")
    name = pal.get("name")
    if not isinstance(name, dict) or not all(isinstance(name.get(k), str) and name.get(k).strip() for k in ("he", "en")) or set(name) - {"he", "en"}:
        errs.append("name.he and name.en required")
    elif any(len(name[k]) > 40 for k in ("he", "en")):
        errs.append("name: at most 40 characters")
    if "character" in pal and not (isinstance(pal["character"], str) and len(pal["character"]) <= 200):
        errs.append("character: text up to 200 characters")
    schemes = pal.get("schemes")
    if not isinstance(schemes, dict) or set(schemes) != {"light", "dark"}:
        return errs + ["schemes.light and schemes.dark required"]
    for sc in ("light", "dark"):
        s = schemes[sc]
        if not isinstance(s, dict):
            errs.append(f"schemes.{sc} must be an object")
            continue
        for path, kind in SCHEMA.items():
            v = _get(s, path)
            at = f"schemes.{sc}.{path}"
            if v is None:
                errs.append(f"{at} missing")
                continue
            if kind == "hex" and not (isinstance(v, str) and _HEX.match(v)):
                errs.append(f"{at} must be #rrggbb")
            elif kind == "color":
                try:
                    parse(v)
                except ValueError as exc:
                    errs.append(f"{at}: {exc}")
            elif kind == "number" and not _is_num(v):
                errs.append(f"{at} must be a number")
            elif kind == "hex[]" and not (isinstance(v, list) and 2 <= len(v) <= 5 and all(isinstance(x, str) and _HEX.match(x) for x in v)):
                errs.append(f"{at} must be 2-5 #rrggbb stops")
            elif kind == "pairs" and not (isinstance(v, list) and 2 <= len(v) <= 8 and all(isinstance(p, list) and len(p) == 2 and all(isinstance(x, str) and _HEX.match(x) for x in p) for p in v)):
                errs.append(f"{at} must be 2-8 [#start, #end] pairs")
        o = _get(s, "glass.opacity")
        if isinstance(o, dict) and all(_is_num(o.get(k)) for k in ("min", "default", "max")) and not (0 < o["min"] <= o["default"] <= o["max"] <= 1):
            errs.append(f"schemes.{sc}.glass.opacity: need 0 < min <= default <= max <= 1")
        blur = _get(s, "glass.blurPx")
        if _is_num(blur) and not 0 <= blur <= 60:
            errs.append(f"schemes.{sc}.glass.blurPx: 0..60")

        def walk(x: dict, pre: str) -> None:
            for k, v in x.items():
                p = f"{pre}.{k}" if pre else str(k)
                if isinstance(v, dict) and p not in _KNOWN:
                    walk(v, p)
                elif p not in _KNOWN:
                    errs.append(f"schemes.{sc}.{p[:40]}: unknown token (closed set)")

        walk(s, "")
    return errs


def check_scheme(s: dict[str, Any]) -> list[dict[str, Any]]:
    """Every contrast pair of one scheme (the same pairs as validate_palettes.mjs / design/palette.ts); `ok` is the verdict."""
    def C(p: str) -> Color:
        return parse(_get(s, p))

    rows: list[dict[str, Any]] = []

    def add(group: str, what: str, fg_path: str, fg: Color, bg_name: str, bg: Color, minimum: float, alt_ok: bool = False) -> None:
        r = ratio(fg, bg)
        rows.append({"group": group, "what": what, "fg": fg_path, "bg": bg_name, "ratio": round(r, 2), "min": minimum, "ok": r >= minimum or alt_ok})

    opaque = {"bg": C("bg"), "surface": C("surface"), "surface2": C("surface2"), "surfaceElevated": C("surfaceElevated")}
    for t in ("text", "textMuted"):
        for n, b in opaque.items():
            add("text", f"{t} on {n}", t, C(t), n, b, TEXT_MIN)

    stops = [parse(x) for x in _get(s, "wallpaper.stops")]
    by_lum = sorted(stops, key=lum, reverse=True)
    extremes = {"lightest stop": by_lum[0], "darkest stop": by_lum[-1]}
    a = _get(s, "glass.opacity.min")
    tint = C("glass.tint")
    glass: dict[str, Color] = {}
    pct = round(a * 100)
    for wn, w in extremes.items():
        glass[f"glass card @{pct}% / {wn}"] = over((*tint[:3], a), w)
        sheet = over((*tint[:3], a), over(C("glass.overlay"), w))
        glass[f"pop-up sheet @{pct}% / dimmed {wn}"] = sheet
        glass[f"pill layer in sheet / dimmed {wn}"] = over(C("glass.layer"), sheet)
    for t in ("text", "textMuted"):
        for n, b in glass.items():
            add("glass", f"{t} on {n}", t, C(t), n, b, TEXT_MIN)
    for n, b in glass.items():
        if not n.startswith("pill"):
            add("glass", f"accentText on {n}", "accentText", C("accentText"), n, b, TEXT_MIN)
    for i, w in enumerate(stops):
        add("wallpaper", f"text on wallpaper stop {i + 1}", "text", C("text"), f"wallpaper.stops[{i}]", w, TEXT_MIN)

    add("accent", "accentContrast on accent", "accentContrast", C("accentContrast"), "accent", C("accent"), TEXT_MIN)
    for n in ("bg", "surface", "surfaceElevated"):
        add("accent", f"accentText on {n}", "accentText", C("accentText"), n, opaque[n], TEXT_MIN)
    for n in ("bg", "surface"):
        add("accent", f"accent (toggle, focus) vs {n}", "accent", C("accent"), n, opaque[n], UI_MIN)

    def worst_glass(fg: Color) -> tuple[float, str, Color]:
        w: tuple[float, str, Color] = (99.0, "", fg)
        for n, b in glass.items():
            r = ratio(fg, b)
            if r < w[0]:
                w = (r, n, b)
        return w

    for st in ("on", "off", "unavailable", "success", "warning", "danger"):
        p = f"state.{st}"
        fg = C(p)
        for n in ("bg", "surface", "surfaceElevated"):
            add("state", f"{st} vs {n}", p, fg, n, opaque[n], UI_MIN)
        _, wn, wb = worst_glass(fg)
        add("state", f"{st} vs {wn}", p, fg, wn, wb, UI_MIN)
    for st in ("successText", "warningText", "dangerText"):
        for n in ("surface", "surfaceElevated"):
            add("state", f"{st} on {n}", f"state.{st}", C(f"state.{st}"), n, opaque[n], TEXT_MIN)

    for e in ("light", "climate", "cover", "media", "security", "camera"):
        p = f"entity.{e}"
        for n in ("bg", "surface"):
            add("entity", f"{e} ring vs {n}", p, C(p), n, opaque[n], UI_MIN)
        add("entity", f"icon on {e} ring", "entity.icon", C("entity.icon"), p, C(p), UI_MIN)

    for i, pr in enumerate(_get(s, "gradient.pairs")):
        for j, c in enumerate(pr):
            add("gradient", f"gradient text on pair {i + 1} {'end' if j else 'start'}", "gradient.text", C("gradient.text"), f"gradient.pairs[{i}][{j}]", parse(c), TEXT_MIN)

    for f in ("fill", "fillCool"):
        add("slider", f"onFill on {f}", "slider.onFill", C("slider.onFill"), f"slider.{f}", C(f"slider.{f}"), TEXT_MIN)
        direct = ratio(C(f"slider.{f}"), C("slider.track"))
        e_f = ratio(C("slider.edge"), C(f"slider.{f}"))
        e_t = ratio(C("slider.edge"), C("slider.track"))
        edge_ok = e_f >= UI_MIN and e_t >= UI_MIN
        add("slider", f"{f} vs track (position)", f"slider.{f}", C(f"slider.{f}"), "slider.track", C("slider.track"), UI_MIN, edge_ok)
        if direct < UI_MIN:
            add("slider", f"edge vs {f}", "slider.edge", C("slider.edge"), f"slider.{f}", C(f"slider.{f}"), UI_MIN)
            add("slider", f"edge vs track ({f})", "slider.edge", C("slider.edge"), "slider.track", C("slider.track"), UI_MIN)
    return rows


# ---- the Hebrew message of a refusal ----

_FG_HE = {
    "text": "טקסט", "textMuted": "טקסט משני", "accent": "צבע הדגש", "accentContrast": "טקסט על הדגש", "accentText": "טקסט בצבע הדגש",
    "gradient.text": "טקסט על גוון", "slider.onFill": "טקסט על המילוי", "slider.edge": "קו קצה של מחוון", "slider.fill": "מילוי מחוון", "slider.fillCool": "מילוי מחוון קר",
    "entity.icon": "סמל על טבעת", "state.on": "מצב פעיל", "state.off": "מצב כבוי", "state.unavailable": "לא זמין", "state.success": "הצלחה", "state.warning": "אזהרה",
    "state.danger": "שגיאה", "state.successText": "טקסט הצלחה", "state.warningText": "טקסט אזהרה", "state.dangerText": "טקסט שגיאה",
}
_BG_HE = {"bg": "הרקע", "surface": "המשטח", "surface2": "המשטח המשני", "surfaceElevated": "המשטח המוגבה", "accent": "הדגש", "slider.track": "מסלול המחוון"}


def _fg_he(path: str) -> str:
    if path in _FG_HE:
        return _FG_HE[path]
    if path.startswith("entity."):
        return "טבעת " + path.split(".", 1)[1]
    return path


def _bg_he(name: str) -> str:
    if name in _BG_HE:
        return _BG_HE[name]
    if name.startswith("glass card"):
        return "כרטיס זכוכית"
    if name.startswith("pop-up sheet"):
        return "חלון קופץ"
    if name.startswith("pill layer"):
        return "שכבת כמוסה"
    if name.startswith("wallpaper.stops"):
        return "הרקע המצויר"
    if name.startswith("gradient.pairs"):
        return "גוון"
    if name.startswith("slider."):
        return "מילוי מחוון"
    if name.startswith("entity."):
        return "טבעת " + name.split(".", 1)[1]
    return name


def failing_pairs(pal: dict[str, Any]) -> list[dict[str, Any]]:
    """The failing contrast rows of a well-formed palette, with the scheme."""
    out: list[dict[str, Any]] = []
    for sc in ("light", "dark"):
        for r in check_scheme(pal["schemes"][sc]):
            if not r["ok"]:
                out.append({**r, "scheme": sc})
    return out


def describe_failures(rows: list[dict[str, Any]], limit: int = 3) -> str:
    """A short Hebrew message: how many pairs fail and the first few, worst first."""
    worst = sorted(rows, key=lambda r: r["ratio"])[:limit]
    parts = [f"{'בהיר' if r['scheme'] == 'light' else 'כהה'}: {_fg_he(r['fg'])} על {_bg_he(r['bg'])} - {r['ratio']:.2f}:1 (נדרש {r['min']:g}:1)" for r in worst]
    more = f" ועוד {len(rows) - limit}" if len(rows) > limit else ""
    return f"אזהרה: ניגודיות נמוכה מדי ב־{len(rows)} זוגות. " + "; ".join(parts) + more + "."


def validate_custom(pal: Any) -> dict[str, Any]:
    """A custom palette in its canonical form, or ValueError with a Hebrew message when it is STRUCTURALLY invalid (never stored).
    A palette that only fails contrast checks is accepted (warn-only, owner decision 2026-10-02)."""
    if isinstance(pal, dict) and (pal.get("id") == BASE_ID or pal.get("id") in BUILTIN_IDS):
        # the base palette and the ten ready ones are protected: a custom palette can never take their id (owner decision 2026-10-03)
        raise ValueError(f"המזהה {pal['id']} שמור לערכה מובנית ולא ניתן לדרוס אותה; ערכה מותאמת חייבת מזהה חדש שמתחיל ב־custom-")
    errs = schema_errors(pal)
    if errs:
        raise ValueError("ערכת הצבעים אינה תקינה: " + errs[0])
    if not CUSTOM_ID_RE.match(pal["id"]) or len(pal["id"]) > MAX_CUSTOM_ID:
        raise ValueError("מזהה ערכה מותאמת חייב להתחיל ב־custom- (אותיות קטנות, ספרות ומקפים)")
    out: dict[str, Any] = {"id": pal["id"], "name": {"he": pal["name"]["he"].strip(), "en": pal["name"]["en"].strip()}}
    if pal.get("character"):
        out["character"] = pal["character"]
    out["schemes"] = pal["schemes"]
    return out


def normalize_customs(value: Any) -> list[dict[str, Any]]:
    """The installation's custom palettes (`ui.palettes`): a list, unique ids, each valid; ValueError (Hebrew) otherwise."""
    if not isinstance(value, list):
        raise ValueError("ערכות צבעים מותאמות: רשימה")
    if len(value) > MAX_CUSTOM:
        raise ValueError(f"ערכות צבעים מותאמות: עד {MAX_CUSTOM}")
    out = [validate_custom(p) for p in value]
    ids = [p["id"] for p in out]
    if len(set(ids)) != len(ids):
        raise ValueError("ערכות צבעים מותאמות: מזהה כפול")
    return out


def stored(raw: Any) -> list[dict[str, Any]]:
    """The stored list; a corrupt value, or a palette that is structurally invalid, is dropped (never served, never applied).
    A palette with low contrast is kept: it was saved with a warning."""
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except (ValueError, TypeError):
        return []
    if not isinstance(data, list):
        return []
    out: list[dict[str, Any]] = []
    for p in data[:MAX_CUSTOM]:
        try:
            out.append(validate_custom(p))
        except (ValueError, TypeError, KeyError):
            continue
    return out


def valid_dial_value(value: Any) -> bool:
    """The palette dial of `ui.look`: default, a built-in id, or a (syntactic) custom id."""
    return isinstance(value, str) and (value == "default" or value in BUILTIN_IDS or (len(value) <= MAX_CUSTOM_ID and bool(CUSTOM_ID_RE.match(value))))
