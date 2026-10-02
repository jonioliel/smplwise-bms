"""CR-019 section 6.3: the switch-protection classifier's rules (version 1), data only. The matching itself lives in
services/switch_protection.py.

- English terms match whole tokens (text split on non-alphanumerics, letters apart from digits); a multi-word term matches
  consecutive tokens. Hebrew terms match as substrings (prefix letters attach, and so does any continuation).
- (w) WEAK categories: a text hit is ignored when the same text also holds a lighting word ("Gate light", "תאורת חניה").
- Icons: `mdi:` names; an entry in ICON_FAMILIES also matches its variants (`<name>-...`), an entry in ICON_EXACT only itself.
- Changing anything here that could protect MORE switches is a new CLASSIFIER_VERSION (services/switch_protection.py), so the
  switches judged `allowed` by the older rules are judged again; `was_safe` / `admin_cleared` never are.
"""
from __future__ import annotations

# category id -> the review list's label (Hebrew; "תשתית המערכת" for the add-on switches - no platform branding in the UI)
CATEGORY_LABELS: dict[str, str] = {
    "water_heating": "משאבות ודודים",
    "heat_appliance": "חימום ובישול",
    "access": "שערים, דלתות וחניה",
    "cold": "מקררים ומקפיאים",
    "network": "רשת, שרתים ואל־פסק",
    "security": "אזעקה ומצלמות",
    "pool": "בריכה וג'קוזי",
    "water_valve": "השקיה וברזים",
    "life_support": "ציוד רגיש",
    "energy": "אנרגיה וטעינה",
    "elevator": "מעלית",
    "infrastructure": "תשתית המערכת",
}

# a text hit of these categories is ignored when the same text also names a light
WEAK_CATEGORIES = frozenset({"access", "security", "pool"})

# (category, English terms, Hebrew terms) in the order they are tried on one text
TERMS: tuple[tuple[str, tuple[str, ...], tuple[str, ...]], ...] = (
    ("water_heating",
     ("pump", "boiler", "water heater", "hot water", "geyser", "dhw", "immersion", "circulation", "recirculation", "sump", "booster", "solar heater"),
     ("משאבה", "משאבת", "משאבות", "דוד", "בוילר", "מחמם מים", "חימום מים", "גוף חימום", "סירקולציה", "דוד שמש")),
    ("heat_appliance",
     ("heater", "radiator", "oven", "stove", "cooktop", "hob", "kettle", "hot plate", "hotplate", "urn", "iron"),
     ("תנור", "כיריים", "קומקום", "מיחם", "פלטה", "מפזר חום", "רדיאטור", "מגהץ")),
    ("access",
     ("gate", "garage", "door", "barrier", "boom", "maglock", "mag lock", "strike", "latch", "lock", "intercom", "doorbell", "opener", "buzzer", "turnstile"),
     ("שער", "חניה", "חנייה", "דלת", "מחסום", "זרוע", "מנעול", "אלקטרומגנט", "אינטרקום", "פעמון", "פותחן", "קודן")),
    ("cold",
     ("fridge", "refrigerator", "freezer", "deep freeze", "chiller", "wine cooler"),
     ("מקרר", "מקפיא", "קירור")),
    ("network",
     ("server", "nas", "router", "modem", "ups", "network", "poe", "access point", "wifi", "mesh", "firewall", "gateway", "hub", "bridge", "coordinator",
      "zigbee", "zwave", "z wave", "rack", "nvr", "dvr", "synology", "qnap", "unraid", "proxmox", "unifi", "mikrotik", "starlink", "ont"),
     ("שרת", "ראוטר", "נתב", "מודם", "אל פסק", "אל-פסק", "אלפסק", "מתג רשת", "תקשורת", "רכזת", "אינטרנט", "וויפי", "סיב")),
    ("security",
     ("alarm", "siren", "security", "panic", "smoke", "detector", "camera", "cctv", "recording", "record", "detect", "privacy"),
     ("אזעקה", "צופר", "סירנה", "אבטחה", "פאניקה", "גלאי", "עשן", "מצלמה", "מצלמות", "מקליט", "הקלטה")),
    ("pool",
     ("pool", "spa", "jacuzzi", "hot tub", "chlorinator", "salt cell"),
     ("בריכה", "ג'קוזי", "ספא", "כלור")),
    ("water_valve",
     ("irrigation", "sprinkler", "valve", "drip", "tap", "faucet", "water main", "main water", "shutoff", "shut off", "leak"),
     ("השקיה", "ממטרה", "ממטרות", "טפטוף", "ברז", "מגוף", "שסתום", "מים ראשי", "נזילה")),
    ("life_support",
     ("aquarium", "fish", "terrarium", "incubator", "oxygen", "medical", "cpap"),
     ("אקווריום", "דגים", "טרריום", "חמצן", "רפואי", "מכשיר נשימה")),
    ("energy",
     ("ev", "charger", "charging", "wallbox", "inverter", "battery", "generator", "solar", "pv", "grid", "main breaker", "main power"),
     ("מטען", "טעינה", "רכב חשמלי", "ממיר", "סוללה", "גנרטור", "סולארי", "מפסק ראשי", "חשמל ראשי")),
    ("elevator",
     ("elevator", "lift"),
     ("מעלית",)),
)

# the lighting words that cancel a WEAK category's hit in the same text. Hebrew ones must START a word (after optional prefix
# letters): a lighting word is the one place where a looser match would REMOVE protection ("לד" inside "ילדים").
LIGHT_WORDS_EN = ("light", "lights", "lamp", "led", "spot", "spotlight", "bulb", "chandelier", "sconce", "strip", "lighting")
LIGHT_WORDS_HE = ("תאורה", "תאורת", "מנורה", "מנורת", "נורה", "נורת", "ספוט", "פנס", "לד")
HEBREW_PREFIX_LETTERS = "הובלמשכ"

# icons (the `mdi:` prefix stripped): exact names, and families (the name and every `<name>-...` variant)
ICON_EXACT: dict[str, str] = {
    **dict.fromkeys(("water-pump", "pump", "water-boiler", "water-heater", "water-thermometer"), "water_heating"),
    **dict.fromkeys(("radiator", "stove", "kettle", "toaster-oven", "fire", "heat-wave"), "heat_appliance"),
    **dict.fromkeys(("fridge", "fridge-outline", "snowflake-thermometer"), "cold"),
    **dict.fromkeys(("server", "nas", "router", "router-wireless", "lan", "access-point", "ethernet", "network", "ups", "power-plug-battery"), "network"),
    **dict.fromkeys(("alarm", "alarm-light", "bell-ring", "cctv", "smoke-detector"), "security"),
    **dict.fromkeys(("pool", "hot-tub"), "pool"),
    **dict.fromkeys(("water-pump-off", "pipe-valve"), "water_valve"),
    **dict.fromkeys(("fish", "fishbowl", "medical-bag", "hospital-box"), "life_support"),
    **dict.fromkeys(("ev-station", "car-electric", "solar-power", "solar-panel", "transmission-tower"), "energy"),
}
ICON_FAMILIES: tuple[tuple[str, str], ...] = (
    ("gate", "access"), ("garage", "access"), ("door", "access"), ("lock", "access"), ("doorbell", "access"), ("boom-gate", "access"), ("intercom", "access"),
    ("shield", "security"), ("camera", "security"),
    ("sprinkler", "water_valve"), ("valve", "water_valve"),
    ("ev-plug", "energy"), ("battery", "energy"),
    ("elevator", "elevator"),
)

# integrations (the entity registry's `platform`): every switch of these is protected
PLATFORMS: dict[str, str] = {
    "hassio": "infrastructure",  # add-on start / stop switches - one of them would stop this add-on itself
    **dict.fromkeys(("unifi", "tplink_omada", "mikrotik", "fritz", "netgear", "asuswrt", "openwrt", "luci", "opnsense", "pfsense", "adguard", "pi_hole",
                     "synology_dsm", "qnap", "proxmoxve", "unraid", "wake_on_lan"), "network"),
    **dict.fromkeys(("frigate", "unifiprotect", "reolink", "hikvision", "hikvisioncam", "onvif", "amcrest", "dahua", "blueiris", "motioneye", "alarmo", "risco",
                     "visonic", "pima", "envisalink", "satel_integra", "paradox_alarm", "elkm1", "konnected", "jablotron", "ajax"), "security"),
    **dict.fromkeys(("nuki", "tedee", "akuvox", "doorbird", "ring", "unifi_access"), "access"),
    "switcher_kis": "water_heating",  # Switcher boilers, common in Israel
    **dict.fromkeys(("rainbird", "hydrawise", "rachio", "opensprinkler", "bhyve", "irrigation_unlimited", "gardena_bluetooth"), "water_valve"),
    **dict.fromkeys(("omnilogic", "iaqualink", "screenlogic", "intellicenter"), "pool"),
    **dict.fromkeys(("home_connect", "miele"), "heat_appliance"),
    **dict.fromkeys(("wallbox", "easee", "zaptec", "teslemetry", "tesla_fleet", "enphase_envoy"), "energy"),
}

# the other entities of the same HA device: domain -> category, or (domain, device classes) -> category (strong)
SIBLING_DOMAINS: dict[str, str] = {
    "lock": "access",
    "alarm_control_panel": "security",
    "siren": "security",
    "camera": "security",
    "water_heater": "water_heating",
    "valve": "water_valve",
}
SIBLING_CLASSES: tuple[tuple[str, frozenset[str], str], ...] = (
    ("cover", frozenset({"door", "garage", "gate"}), "access"),
    ("binary_sensor", frozenset({"door", "garage_door"}), "access"),
)

# the HA area (strong, technical rooms only): (Hebrew substrings, English phrases, category). The CR names the rooms, not
# their category: server / communication rooms are `network`; pump, boiler, plant, machine and technical rooms - where
# pumps, boilers and the building's mechanical plant live - are `water_heating`.
AREAS: tuple[tuple[tuple[str, ...], tuple[str, ...], str], ...] = (
    (("חדר שרתים", "ארון תקשורת", "חדר תקשורת"), ("server room", "comms room", "network closet"), "network"),
    (("חדר מכונות", "חדר משאבות", "חדר טכני", "חדר דוודים"), ("plant room", "boiler room", "machine room", "pump room"), "water_heating"),
)
