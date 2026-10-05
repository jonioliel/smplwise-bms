"""CR-031 GEN1: the generator catalogue - sensor roles, the name / unit patterns that find them, the alert types with the roles each
needs, the default thresholds and the Hebrew message templates. Pure data and small pure functions: no database, no network.

The catalogue is an ASSUMPTION modelled on generic genset controllers (DSE 7x20 / ComAp InteliLite class) until the owner's entity
export fixes the real mapping (CR-031 section 1); the per-installation correction lives in the settings (`generator.role_overrides`)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

# ---------------------------------------------------------------- roles

# role -> (kind, canonical unit, Hebrew label). kind: num | bool | enum | text | ts
ROLES: dict[str, tuple[str, str, str]] = {
    "engine_state": ("enum", "", "מצב מנוע"),
    "controller_mode": ("enum", "", "מצב בקר"),
    "ats_position": ("enum", "", "מתג העברה"),
    "mains_available": ("bool", "", "רשת זמינה"),
    "on_load": ("bool", "", "גנרטור על העומס"),
    "load_on_mains": ("bool", "", "העומס על הרשת"),
    "supply_source": ("enum", "", "מקור אספקה"),
    "generator_running": ("bool", "", "גנרטור פועל"),
    "mains_breaker_closed": ("bool", "", "מפסק רשת סגור"),
    "generator_breaker_closed": ("bool", "", "מפסק גנרטור סגור"),
    "warning_active": ("bool", "", "אזהרה פעילה בבקר"),
    "shutdown_active": ("bool", "", "השבתה פעילה בבקר"),
    "trip_active": ("bool", "", "הפלה חשמלית פעילה"),
    "any_fault": ("bool", "", "תקלה כלשהי בבקר"),
    "monitoring_status": ("text", "", "מצב ניטור הבקר"),
    "last_poll_at": ("ts", "", "תשאול אחרון של הבקר"),
    "rpm": ("num", "rpm", "סל\"ד"),
    "run_hours": ("num", "h", "שעות עבודה"),
    "starts": ("num", "", "מספר התנעות"),
    "coolant_temp": ("num", "°C", "טמפרטורת נוזל קירור"),
    "oil_pressure": ("num", "bar", "לחץ שמן"),
    "battery_v": ("num", "V", "מתח מצבר"),
    "charger_v": ("num", "V", "מתח מטען"),
    "fuel_pct": ("num", "%", "מפלס דלק"),
    "fuel_l": ("num", "L", "דלק בליטרים"),
    "gen_v_l1": ("num", "V", "מתח גנרטור L1"), "gen_v_l2": ("num", "V", "מתח גנרטור L2"), "gen_v_l3": ("num", "V", "מתח גנרטור L3"),
    "gen_a_l1": ("num", "A", "זרם L1"), "gen_a_l2": ("num", "A", "זרם L2"), "gen_a_l3": ("num", "A", "זרם L3"),
    "gen_kw": ("num", "kW", "הספק"),
    "gen_kva": ("num", "kVA", "הספק מדומה"),
    "pf": ("num", "", "מקדם הספק"),
    "gen_hz": ("num", "Hz", "תדר גנרטור"),
    "load_pct": ("num", "%", "עומס"),
    "mains_v_l1": ("num", "V", "מתח רשת L1"), "mains_v_l2": ("num", "V", "מתח רשת L2"), "mains_v_l3": ("num", "V", "מתח רשת L3"),
    "mains_hz": ("num", "Hz", "תדר רשת"),
    "last_start_at": ("ts", "", "התנעה אחרונה"),
    "last_start_reason": ("text", "", "סיבת התנעה אחרונה"),
    "last_test_at": ("ts", "", "מבחן אחרון"),
    "last_test_result": ("text", "", "תוצאת מבחן אחרון"),
    "next_test_at": ("ts", "", "מבחן הבא (לפי הבקר)"),
    "service_hours_left": ("num", "h", "שעות לטיפול הבא"),
    # controller alarm outputs, when the controller exposes them as binary sensors (preferred over thresholds computed here)
    "alarm_fail_to_start": ("bool", "", "אזעקת כשל התנעה"),
    "alarm_low_oil": ("bool", "", "אזעקת לחץ שמן נמוך"),
    "alarm_high_temp": ("bool", "", "אזעקת טמפרטורה גבוהה"),
    "alarm_overspeed": ("bool", "", "אזעקת מהירות יתר"),
    "alarm_emergency_stop": ("bool", "", "אזעקת עצירת חירום"),
    "alarm_low_fuel": ("bool", "", "אזעקת דלק נמוך"),
    "alarm_charger_fail": ("bool", "", "אזעקת כשל מטען"),
    "alarm_ats_fail": ("bool", "", "אזעקת כשל מתג העברה"),
}
GEN_V = ("gen_v_l1", "gen_v_l2", "gen_v_l3")
GEN_A = ("gen_a_l1", "gen_a_l2", "gen_a_l3")
MAINS_V = ("mains_v_l1", "mains_v_l2", "mains_v_l3")


def is_core_met(roles: set[str]) -> bool:
    """Only engine state and at least one generator voltage are core (owner decision 2026-10-05); everything else is optional."""
    return "engine_state" in roles and any(r in roles for r in GEN_V)


def is_core(role: str) -> bool:
    return role == "engine_state" or role in GEN_V


# ---------------------------------------------------------------- patterns

_MAINS = r"mains|grid|utility|רשת"
_GEN_WORDS = r"gen(?:set|erator)?|engine|גנרטור|מנוע|בקר|controller"


def _rx(p: str) -> re.Pattern[str]:
    return re.compile(p, re.I)


PHASE_RES = ((1, _rx(r"(?<![a-z0-9])(l1|ph(?:ase)?[ _-]?(1|a)|פאזה[ _]?(1|א))(?![0-9a-z])")),
             (2, _rx(r"(?<![a-z0-9])(l2|ph(?:ase)?[ _-]?(2|b)|פאזה[ _]?(2|ב))(?![0-9a-z])")),
             (3, _rx(r"(?<![a-z0-9])(l3|ph(?:ase)?[ _-]?(3|c)|פאזה[ _]?(3|ג))(?![0-9a-z])")))
LINE_TO_LINE = _rx(r"l[123][ _/-]?[-_/ ]?l[123]|line[ _-]to[ _-]line|פאזה לפאזה")
MAINS_RX = _rx(_MAINS)
GENERATOR_HINT = _rx(r"gen(?:set|erator)|גנרטור|dse|comap|inteli|deep[ _-]?sea|cummins|kohler|perkins")
KNOWN_DOMAINS = ("dse_8620",)  # integrations with a known profile (Deep Sea DSE 8620 MKII); installation domains are added in `generator.integration_domains`


def phase_of(text: str) -> int | None:
    for n, rx in PHASE_RES:
        if rx.search(text):
            return n
    return None


@dataclass(frozen=True)
class Rule:
    role: str
    domains: tuple[str, ...]
    rx: re.Pattern[str] | None = None
    classes: tuple[str, ...] = ()   # accepted device classes; "" = a missing class is accepted
    units: tuple[str, ...] = ()     # accepted units (case-insensitive); () = any
    score: float = 1.0
    deny: re.Pattern[str] | None = None
    invert: re.Pattern[str] | None = None


S, B, SEL = "sensor", "binary_sensor", "select"
FAILWORD = _rx(r"fail|fault|loss|lost|outage|failure|תקלה|הפסקה|נפילת")
RULES: tuple[Rule, ...] = (
    # state flags and breakers of an auto-mains-failure controller (DSE 8620 profile and generic equivalents)
    Rule("mains_breaker_closed", (B,), _rx(r"mains.{0,8}breaker.{0,8}(closed|position)"), score=3, deny=_rx(r"fail|alarm")),
    Rule("generator_breaker_closed", (B,), _rx(r"gen(?:erator)?.{0,8}breaker.{0,8}(closed|position)"), score=3, deny=_rx(r"fail|alarm")),
    Rule("load_on_mains", (B,), _rx(r"load.{0,6}on.{0,4}mains|mains.{0,6}on.{0,4}load"), score=3),
    Rule("generator_running", (B,), _rx(r"gen(?:erator)?.{0,6}running"), score=3, deny=_rx(r"alarm|fail")),
    Rule("warning_active", (B,), _rx(r"warning[ _-]?active"), score=3),
    Rule("shutdown_active", (B,), _rx(r"shutdown[ _-]?active"), score=3, deny=_rx(r"controlled")),
    Rule("trip_active", (B,), _rx(r"trip[ _-]?active"), score=3),
    Rule("any_fault", (B,), _rx(r"any[ _-]?fault"), score=3),
    Rule("supply_source", (S, SEL), _rx(r"supply[ _-]?source"), score=3),
    Rule("monitoring_status", (S,), _rx(r"monitoring[ _-]?status"), score=3),
    Rule("last_poll_at", (S,), _rx(r"last[ _-]?(successful[ _-]?)?poll"), classes=("timestamp",), score=3),
    # controller alarm outputs (binary) first: they must not be taken for value roles
    Rule("alarm_emergency_stop", (B,), _rx(r"emergency|e[ _-]?stop|עצירת חירום"), score=3),
    Rule("alarm_fail_to_start", (B,), _rx(r"fail[ _-]?to[ _-]?start|start(?:ing)?[ _-]?fail|כשל התנעה"), score=3),
    Rule("alarm_overspeed", (B,), _rx(r"over[ _-]?speed|מהירות יתר"), score=3),
    Rule("alarm_low_oil", (B,), _rx(r"low[ _-]?oil|oil.{0,12}(low|press)|לחץ שמן"), score=3),
    Rule("alarm_high_temp", (B,), _rx(r"high.{0,12}(temp|coolant)|over[ _-]?temp|טמפרטורה גבוהה"), score=3),
    Rule("alarm_low_fuel", (B,), _rx(r"low[ _-]?fuel|fuel.{0,10}low|דלק נמוך"), score=3),
    Rule("alarm_charger_fail", (B,), _rx(r"charg.{0,15}fail|fail.{0,15}charg|כשל מטען"), score=3),
    Rule("alarm_ats_fail", (B,), _rx(r"(ats|transfer|changeover|מתג העברה).{0,20}(fail|fault|error|תקלה|כשל)"), score=3),
    # mains and transfer switch
    Rule("mains_available", (B,), MAINS_RX, classes=("power", "connectivity", "problem", ""), score=2, deny=_rx(r"volt|freq|alarm|breaker|stage|trip|load"), invert=FAILWORD),
    Rule("on_load", (B,), _rx(r"on[ _-]?load|load[ _-]?(on|active|accepted)|עומס"), score=2, deny=_rx(r"over|high|low|יתר|fail|fault|alarm|mains")),
    Rule("ats_position", (S, SEL, B), _rx(r"\bats\b|transfer[ _-]?switch|changeover|מתג העברה|מתג מעבר"), score=2, deny=_rx(r"fail|fault|תקלה|כשל")),
    # engine
    Rule("controller_mode", (S, SEL), _rx(r"(?<!engine )(op(?:erating)?[ _-]?)?mode|מצב (עבודה|הפעלה|בקר)"), score=2, deny=_rx(r"engine[ _-]?(state|status)|test[ _-]?(result|status)")),
    Rule("engine_state", (S, SEL, B), _rx(rf"({_GEN_WORDS}).{{0,24}}(state|status|מצב|סטטוס)|(state|status|מצב).{{0,16}}({_GEN_WORDS})|^(engine|generator|genset)?[ _-]?(state|status)$"),
         score=2, deny=_rx(rf"({_MAINS})|ats|fuel|batt|test|connection|firmware|online|last|reason")),
    Rule("rpm", (S,), _rx(r"rpm|engine[ _-]?speed|סל\"ד|מהירות מנוע"), units=("rpm", "1/min"), score=2),
    Rule("service_hours_left", (S,), _rx(r"(service|maintenance|טיפול).{0,24}(hour|remain|left|due|שעות|עד)|(hour|remain|left).{0,12}(service|maintenance)"), score=3),
    Rule("run_hours", (S,), _rx(r"run[ _-]?(time|hours)|engine[ _-]?hours|hour[ _-]?meter|running[ _-]?hours|שעות (עבודה|מנוע|פעולה)"), units=("h", "hr", "hrs", "hours", ""), score=2, deny=_rx(r"service|next|טיפול")),
    Rule("starts", (S,), _rx(r"(number[ _-]?of|num|total|count)[ _-]?starts|start[ _-]?count|starts[ _-]?(count|total)|^starts$|מספר התנעות|התנעות"), score=2, deny=_rx(r"last|reason|fail")),
    Rule("coolant_temp", (S,), _rx(r"coolant|cooling|water[ _-]?temp|engine[ _-]?temp|נוזל קירור|טמפרטורת מנוע|טמפרטורת מים"), classes=("temperature", ""), score=2),
    Rule("oil_pressure", (S,), _rx(r"oil[ _-]?press|לחץ שמן"), classes=("pressure", ""), score=2),
    Rule("charger_v", (S,), _rx(r"charg|alternator|dynamo|מטען"), classes=("voltage", ""), units=("v",), score=3),
    Rule("battery_v", (S,), _rx(r"batt|מצבר|סוללה"), classes=("voltage", ""), units=("v",), score=2),
    Rule("fuel_l", (S,), _rx(r"fuel|דלק|diesel|סולר"), units=("l", "liter", "litre", "gal"), score=2),
    Rule("fuel_pct", (S,), _rx(r"fuel|דלק|diesel|סולר|tank"), units=("%",), score=2),
    Rule("fuel_pct", (S,), _rx(r"(fuel|diesel|tank)[ _-]?level|מפלס דלק"), units=("%", ""), score=2, deny=_rx(r"alarm|used|usage")),  # a controller that reports the level with no unit (read as percent)
    Rule("last_start_reason", (S,), _rx(r"last[ _-]?start.{0,12}(reason|cause)|start[ _-]?(reason|cause)|סיבת התנעה"), score=3),
    Rule("last_start_at", (S,), _rx(r"last[ _-]?start|התנעה אחרונה"), classes=("timestamp", ""), score=2, deny=_rx(r"reason|cause|סיבה")),
    Rule("last_test_result", (S,), _rx(r"(last[ _-]?)?(test|exercise)[ _-]?(result|status)|תוצאת מבחן"), score=3),
    Rule("last_test_at", (S,), _rx(r"last[ _-]?(test|exercise)|מבחן אחרון"), classes=("timestamp", ""), score=2, deny=_rx(r"result|status|תוצאה")),
    Rule("next_test_at", (S,), _rx(r"next[ _-]?(test|exercise|run)|מבחן הבא"), classes=("timestamp", ""), score=2),
)

ENUM_STATE = (
    ("fault", _rx(r"fault|alarm|shutdown|shut[ _-]?down|error|fail|trip|תקלה|כשל")),
    ("starting", _rx(r"start|crank|prestart|warm|מתניע|התנעה")),
    ("cooling", _rx(r"cool|stopping|מתקרר")),
    ("running", _rx(r"run|on[ _-]?load|generating|loaded|פועל|עובד")),
    ("stopped", _rx(r"stop|off|idle|standby|ready|inactive|רדום|במנוחה|עצור|כבוי")),
)
ENUM_MODE = (("test", _rx(r"test|exercise|מבחן")), ("auto", _rx(r"auto|אוטומט")), ("manual", _rx(r"man|ידני")), ("off", _rx(r"off|stop|כבוי")))
ENUM_ATS = (("generator", _rx(r"gen|emergency|backup|גנרטור|חירום")), ("mains", _rx(r"mains|grid|utility|normal|רשת")), ("open", _rx(r"open|neutral|off|between|פתוח")))
_TRUE = {"on", "true", "yes", "1", "open", "active", "connected", "ok", "present", "home", "פעיל", "כן", "דלוק"}
_FALSE = {"off", "false", "no", "0", "closed", "inactive", "disconnected", "clear", "not_home", "כבוי", "לא", "לא פעיל"}
DEAD = {"unavailable", "unknown", "none", "", None}
FAIL_RESULT = _rx(r"fail|error|abort|לא הצליח|נכשל|כשל")


def norm_enum(role: str, raw: str | None) -> str | None:
    if raw is None or str(raw).strip().lower() in DEAD:
        return None
    t = str(raw).strip()
    table = {"engine_state": ENUM_STATE, "controller_mode": ENUM_MODE, "ats_position": ENUM_ATS, "supply_source": ENUM_ATS}[role]
    for name, rx in table:
        if rx.search(t):
            return name
    return "other"


def norm_bool(raw: str | None, invert: bool = False) -> bool | None:
    if raw is None:
        return None
    t = str(raw).strip().lower()
    if t in DEAD:
        return None
    v = True if t in _TRUE else False if t in _FALSE else None
    return None if v is None else (not v if invert else v)


def to_canonical(role: str, value: float, unit: str | None) -> float:
    """Convert a numeric source value into the role's canonical unit (pressure -> bar, temperature -> C, power -> kW ...)."""
    u = (unit or "").strip().lower()
    want = ROLES[role][1]
    if want == "bar":
        return value / 100 if u == "kpa" else value * 0.0689476 if u == "psi" else value / 1000 if u == "mbar" else value * 10 if u == "mpa" else value
    if want == "°C" and u in ("°f", "f"):
        return (value - 32) * 5 / 9
    if want == "kW":
        return value / 1000 if u == "w" else value * 1000 if u == "mw" else value
    if want == "kVA":
        return value / 1000 if u == "va" else value
    if want == "h":
        return value / 60 if u in ("min", "mins") else value / 3600 if u in ("s", "sec") else value
    if want == "L":
        return value * 3.78541 if u in ("gal", "gallon", "gallons") else value
    return value


# ---------------------------------------------------------------- alert types

SEVERITIES = ("critical", "alert", "info")
GROUPS = (("engine", "מנוע"), ("fuel", "דלק"), ("electrical", "חשמל הגנרטור"), ("mains", "רשת ומתג העברה"), ("maintenance", "תחזוקה ומבחנים"), ("comm", "תקשורת ומצב בקר"))


@dataclass(frozen=True)
class AlertType:
    key: str
    group: str
    title_he: str
    title_en: str
    severity: str
    needs: tuple[str, ...]        # ANY of these roles makes the type available; () = always available
    hold_s: int = 0               # the condition must hold this long before it is raised
    event: bool = False           # a moment, not a state: raised and closed at once (mains restored, test done ...)
    body: str = "{name}."         # the message template (Hebrew); {detail} is filled by the engine


def _t(*a: Any, **k: Any) -> AlertType:
    return AlertType(*a, **k)


ALERT_TYPES: tuple[AlertType, ...] = (
    _t("fail_to_start", "engine", "כשל התנעה", "Failed to start", "critical", ("alarm_fail_to_start", "engine_state"), body="{name}: הגנרטור לא הותנע."),
    _t("low_oil_pressure", "engine", "לחץ שמן נמוך", "Low oil pressure", "critical", ("alarm_low_oil", "oil_pressure"), hold_s=10, body="{name}: {detail}."),
    _t("high_coolant_temp", "engine", "טמפרטורת נוזל קירור גבוהה", "High coolant temperature", "critical", ("alarm_high_temp", "coolant_temp"), hold_s=10, body="{name}: {detail}."),
    _t("overspeed", "engine", "מהירות יתר", "Overspeed", "critical", ("alarm_overspeed", "rpm"), hold_s=3, body="{name}: {detail}."),
    _t("emergency_stop", "engine", "עצירת חירום", "Emergency stop", "critical", ("alarm_emergency_stop", "engine_state"), body="{name}: נלחץ כפתור עצירת חירום."),
    _t("unexpected_stop", "engine", "עצירה לא מתוכננת", "Unexpected stop", "critical", ("engine_state",), body="{name}: הגנרטור נעצר בתקלה."),
    _t("low_fuel", "fuel", "מפלס דלק נמוך", "Low fuel level", "alert", ("alarm_low_fuel", "fuel_pct"), hold_s=60, body="{name}: {detail}."),
    _t("fuel_shutdown", "fuel", "דלק אזל - השבתה", "Out of fuel", "critical", ("fuel_pct",), hold_s=30, body="{name}: {detail}."),
    _t("overload", "electrical", "עומס יתר", "Overload", "alert", ("load_pct", "gen_kw"), hold_s=60, body="{name}: {detail}."),
    _t("gen_voltage", "electrical", "מתח גנרטור חריג", "Abnormal generator voltage", "alert", GEN_V, hold_s=15, body="{name}: {detail}."),
    _t("gen_frequency", "electrical", "תדר חריג", "Abnormal frequency", "alert", ("gen_hz",), hold_s=15, body="{name}: {detail}."),
    _t("battery_low", "electrical", "מתח מצבר נמוך", "Low battery voltage", "alert", ("battery_v",), hold_s=60, body="{name}: {detail}."),
    _t("charger_fail", "electrical", "כשל מטען מצבר", "Battery charger failure", "alert", ("alarm_charger_fail", "charger_v"), hold_s=60, body="{name}: {detail}."),
    _t("mains_lost", "mains", "אובדן רשת חשמל", "Mains lost", "alert", ("mains_available",), hold_s=5, body="{name}: אין מתח ברשת."),
    _t("mains_restored", "mains", "רשת החשמל חזרה", "Mains restored", "info", ("mains_available",), event=True, body="{name}: הרשת חזרה."),
    _t("ats_to_gen", "mains", "מעבר עומס לגנרטור", "Load transferred to generator", "info", ("ats_position", "supply_source"), event=True, body="{name}: העומס עבר לגנרטור."),
    _t("ats_fail", "mains", "כשל מתג העברה", "Transfer switch failure", "critical", ("alarm_ats_fail", "ats_position"), hold_s=90, body="{name}: {detail}."),
    _t("controller_warning", "comm", "אזהרה בבקר הגנרטור", "Controller warning", "alert", ("warning_active",), hold_s=5, body="{name}: הבקר מדווח על אזהרה."),
    _t("controller_shutdown", "engine", "השבתה בבקר הגנרטור", "Controller shutdown", "critical", ("shutdown_active",), body="{name}: הבקר השבית את הגנרטור."),
    _t("controller_trip", "electrical", "הפלה חשמלית", "Electrical trip", "critical", ("trip_active",), body="{name}: הפלה חשמלית של הגנרטור."),
    _t("generator_started", "engine", "הגנרטור הותנע", "Generator started", "info", ("generator_running",), event=True, body="{name}: הגנרטור הותנע."),
    _t("service_due", "maintenance", "טיפול תקופתי", "Service due", "info", ("service_hours_left", "run_hours"), body="{name}: {detail}."),
    _t("test_done", "maintenance", "ריצת מבחן הושלמה", "Test run completed", "info", ("last_test_at", "last_test_result"), event=True, body="{name}: ריצת המבחן הסתיימה."),
    _t("test_failed", "maintenance", "ריצת מבחן נכשלה", "Test run failed", "alert", ("last_test_at", "last_test_result"), event=True, body="{name}: ריצת המבחן נכשלה."),
    _t("controller_offline", "comm", "אין תקשורת עם הבקר", "Controller offline", "alert", (), hold_s=120, body="{name}: אין תקשורת עם הבקר."),
    _t("not_auto", "comm", "הבקר אינו במצב אוטומטי", "Controller not in auto", "alert", ("controller_mode",), hold_s=300, body="{name}: הבקר אינו במצב אוטומטי."),
)
TYPE_BY_KEY = {t.key: t for t in ALERT_TYPES}


def type_available(t: AlertType, roles: set[str]) -> bool:
    return not t.needs or any(r in roles for r in t.needs)


def needs_label(t: AlertType) -> str:
    """Hebrew 'requires sensor' text: the value sensors first, the controller alarm outputs only when no value sensor can do it."""
    value = [ROLES[r][2] for r in t.needs if not r.startswith("alarm_")]
    return ", ".join(value or [ROLES[r][2] for r in t.needs])


DEFAULT_THRESHOLDS: dict[str, float] = {
    "oil_min_bar": 1.0, "coolant_max_c": 95.0, "rpm_max": 1650.0, "fuel_low_pct": 25.0, "fuel_empty_pct": 5.0,
    "overload_pct": 100.0, "v_min": 207.0, "v_max": 253.0, "hz_min": 47.5, "hz_max": 52.5,
    "battery_min_12v": 11.6, "battery_min_24v": 23.2, "service_warn_h": 25.0, "service_every_h": 0.0, "running_rpm": 100.0,
}
THRESHOLD_LIMITS: dict[str, tuple[float, float]] = {
    "oil_min_bar": (0, 10), "coolant_max_c": (40, 150), "rpm_max": (500, 6000), "fuel_low_pct": (1, 90), "fuel_empty_pct": (0, 50),
    "overload_pct": (50, 200), "v_min": (100, 240), "v_max": (200, 300), "hz_min": (40, 60), "hz_max": (40, 70), "battery_min_12v": (8, 14),
    "battery_min_24v": (16, 28), "service_warn_h": (0, 500), "service_every_h": (0, 5000), "running_rpm": (0, 1000),
}
RETENTION_LIMITS = {"alert_retention_days": (30, 1825, 365), "history_retention_days": (7, 90, 35), "stale_after_s": (60, 3600, 300)}
