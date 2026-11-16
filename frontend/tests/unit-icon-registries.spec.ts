import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { ICON_PATHS, iconSvg } from '../src/components/icon-paths';
import { COST_ICONS, LIST_ICONS, RFQ_ICONS, TABLE_ICONS, TICKET_ICONS, cIcon, listIcon, rIcon, tIcon, tbIcon } from '../src/tickets/icons';
import { cIcon as cIconOld } from '../src/tickets/cost-icons';
import { listIcon as listIconOld } from '../src/tickets/list-icons';
import { rIcon as rIconOld } from '../src/tickets/rfq-icons';
import { tbIcon as tbIconOld } from '../src/tickets/table-icons';
import { HOME_ICON_PATHS, hasIcon, hi } from '../src/home/home-icons';
import { AUTOMATION_ICON_PATHS, aIcon } from '../src/components/automation-icons';
import { MEDIA_ICON_PATHS, mIcon } from '../src/components/media-icons';
import { PLAYER_ICON, ic } from '../src/components/media-player-icons';
import { NOTIFY_ICONS, nIcon } from '../src/components/notify-icons';
import { swLogoSvg } from '../src/design/sw-logo-art';
import { MAP_PICK_HEX, STATUS_HEX, statusCss } from '../src/styles/status-palette';
import { GENERATOR_WIDGET_STYLES } from '../src/generator/home-widget';
import { DOORS_WIDGET_STYLES } from '../src/door-windows/home-widget';
import { tempCss } from '../src/temperature/styles';

// CR-ICONS-PALETTE-2440 (review findings 08:F08, 07:F22, 08:F12 step 1): the icon registries share one wrapper and - in the tickets
// module - one file, and the fixed status colours are written once. Nothing may LOOK different, so this spec holds the registries to
// what they were: BEFORE is every icon name of every registry with the SHA-1 (first 10 hex digits) of its path data, taken from
// release/2437-train before the change. Every former name must still resolve, to the same path data.
//   npx playwright test -c playwright.unit.config.ts tests/unit-icon-registries.spec.ts

const sha = (s: string): string => createHash('sha1').update(s, 'utf8').digest('hex').slice(0, 10);

const BEFORE: Record<string, Record<string, string>> = {
  "sw-icon": { "live": 'cff15fc2b2', "explore": 'cd385d59c2', "investigate": 'ed65f02a00', "system": '8fd3734e2f', "camera": '0b22d8a5a3', "search": 'e2077b1b08', "bell": '4d0695c080', "user": 'fb2932f6bc', "play": '6546450f57', "media": '42f84adddf', "cast": '33e970a488', "stopSquare": '365ad71f10', "expand": 'd60fe374de', "close": '6d7cfe02e9', "chevron": '5986bee375', "chevronBack": '47772f0f48', "warning": 'bc8cca3055', "info": 'a3446e1dfd', "lock": 'a1ba290d37', "unlock": '9d73fc1b8e', "offline": '3cf648c834', "refresh": '2b9965571b', "layers": 'b569f9683e', "floor": 'ca19b85ad9', "plus": '083e7f9361', "minus": '9ab79d5312', "fit": '72abace0a9', "door": '943a0ae895', "light": '67cf35beb4', "sensor": '4974db44e3', "check": '095874916c', "clock": '7626fc83e2', "download": 'd28f200d42', "pin": '4c5ac9a097', "more": 'e5d3c880e1', "building": '245ab1713d', "map": '65dbe2899b', "upload": '24620b7aa5', "list": '574ab1a9b9', "history": '274589e597', "target": '2959456c46', "filter": 'a984b88e98', "users": '5f9c1c3e01', "shield": '694a8e842d', "storage": '10d7062fa2', "edit": '0f52a89fb8', "pause": '5e91b240fb', "skip": '131d5b907f', "case": '98ce51a22e', "rule": '93c06ec033', "link": 'd7b2640cce', "grid": 'e6798c90e2', "dashboard": '8e1425c2bd', "home": '548491e8e0', "star": '06bf29d0af', "aperture": '99465d6199', "volume": '08d27397b9', "mic": 'fc1fe06049', "micOff": 'f2f13c0922', "back10": 'c5fe693108', "forward10": '17212253df', "chevronDown": '7657ca7d06', "stairs": 'c822154808', "bolt": 'e00554b679', "power": 'fbe125b1b6', "coverOpen": 'bc2a728836', "coverClose": '6332554465', "wall": '1b2ae31189', "ruler": 'e23b1ad9bd', "scale": 'ab08fa39cd', "elevator": '428312bcff', "menu": '17b3a317d9', "calendar": '2ca51089f8', "trash": '192e297d5d', "eye": '6f3692f198', "eyeOff": '50a3f981d5', "cpu": '2b2532ac1e', "snow": '360f5eb6b2', "flame": 'db8cb7bcc6', "fan": '6e0278c193', "thermometer": 'cf4f90d2ee', "activity": '935b38274c', "image": '4e7a326a59', "wifi": 'a05aeb5ff6', "signal": 'cfc319d7c9', "move": '1d9db84c44', "bookmark": '9ae8360ff6', "route": '5c3892c2d6', "logout": '4d1e35525f', "sparkle": 'e2bdda052c', "cube": '44fd2363f7', "hand": '1b57341dfd', "help": '8028eaa03c', "grip": '463104bb01', "arrowUp": '747e8ad2bc', "arrowDown": '6567426c77', "bellSettings": 'a3a55a4864', "copy": 'e1a20b68c2', "share": '110cce9618', "mail": 'd3ca880867', "ticket": 'c51086cd8d', "doorOpen": '68b7bddf27', "bellOff": '135a8987d7', "wrench": 'b00c053984', "battery": 'eb61c5dd29', "inbox": '60aac56ee8', "qr": 'c81580bf4c', "drop": '674b664650' },
  "tickets": { "plus": '083e7f9361', "edit": '0f52a89fb8', "check": '095874916c', "user": 'fb2932f6bc', "users": '5f9c1c3e01', "refresh": '2b9965571b', "note": 'acf0cb330a', "clock": '7626fc83e2', "image": '4e7a326a59', "trash": '192e297d5d', "copy": 'e1a20b68c2', "lock": 'a1ba290d37', "x": '6d7cfe02e9', "dots": '534da7b1f2', "layers": '52399e750e', "search": 'e2077b1b08', "expand": 'd60fe374de', "shrink": '98acb580ab', "back": '5986bee375', "camera": '0b22d8a5a3', "send": 'dbe394c7cd', "ticket": 'c51086cd8d', "settings": 'b50d170dbf', "warning": 'bc8cca3055', "eye": '6f3692f198', "link": 'd7b2640cce', "flag": '8c8fc9dad1', "chevronDown": '7657ca7d06', "filter": '8f3973027c', "tree": '48ea177343', "grid": 'a7ca2b6b98', "truck": '7e94059826', "up": '4c335b5324', "down": 'a6d4c994a3', "offline": '3cf648c834' },
  "cost": { "coins": '2d063fac7e', "download": '9b841ac721', "file": '2030f17846', "pages": 'ebfeef103c', "rotate": 'fae099e6b0', "zoomIn": '19aac9a847', "zoomOut": '463d3de5e1', "prev": '5986bee375', "next": '47772f0f48', "paid": '37d75009df', "undo": '6c8a4a2a1f', "table": 'd57dc3b787', "list": '2a94efb4b9', "plus": '083e7f9361', "x": '6d7cfe02e9', "check": '095874916c', "edit": '0f52a89fb8', "refresh": '2b9965571b', "warning": 'bc8cca3055', "lock": 'a1ba290d37', "attach": 'b6cc363927' },
  "list": { "coin": '8cf2750469', "hand": '8c484d1ec7', "calendar": '4589440823', "sliders": 'fbb4be682b', "cardsView": 'a7ca2b6b98', "tableView": '522f491b57', "boardView": '4379af0bb7' },
  "rfq": { "columns": 'f818efc710', "bell": '164e92d90b', "mail": 'e77e2af935', "chat": 'dd7cf9cdc9', "coin": 'fa2daed96a', "cal": '2ca51089f8', "history": 'e207498c97', "file": '770ad62dcc', "bolt": 'e00554b679', "hand": '7612f85191', "ban": '192e60b2b7', "clip": 'b6cc363927', "download": '3a6f0fb0dd', "sheet": 'e441bea9da' },
  "table": { "cards": '5319cb3045', "table": '355853da8e', "kanban": '4379af0bb7', "columns": 'cf6b29399f', "density": '4523dab786', "chevron": '7657ca7d06', "up": 'd1e2551d9e', "down": '7657ca7d06', "arrowUp": '747e8ad2bc', "arrowDown": '6567426c77', "download": '3a6f0fb0dd', "bell": '41bf5e2425', "sort": '28c59bf321', "filter": '1f444e62e7', "star": '6e25324ac3', "bookmark": 'bd807d82a2' },
  "home": { "home": '7dd442c838', "rooms": '5319cb3045', "bulb": '8063c4aa41', "thermo": '925413a789', "door": '017974ef81', "lock": '2b387c9f59', "unlock": '909a87214d', "cam": '1404379054', "camoff": '7b80547e8b', "bolt": '35f151005d', "bell": 'eb0fc0f3fd', "sliders": '659925f149', "morning": '757260ab6b', "leave": 'd60da7460c', "evening": 'c9647a8406', "night": 'd1ab788c39', "arrive": '20dc383443', "back": '5986bee375', "fwd": '47772f0f48', "up": 'd1e2551d9e', "down": '7657ca7d06', "plus": '3f8ecca552', "minus": '9ab79d5312', "power": '751f823a23', "shade": 'e40a1436ed', "stop": '568f2763ba', "user": 'dc751a95c3', "check": '40ac3c103a', "x": '0379f62b73', "phone": 'd1f73b51d1', "more": '4861d1d8f0', "drop": '24bb5e9fd0', "battery": '76fa6a0625', "sun": 'daf91f095a', "shield": 'cf58c8e195', "swap": 'f9d0494bba', "layers": '55b7348010', "edit": '4eadf694a7', "search": 'bb237e68d8', "map": 'f7cad5ccaa', "media": '61f319314d', "system": '080b50f9c9', "plug": 'fcea2371d2', "mic": '99d0abf789', "star": '2547d115f8', "heart": 'a5799a14d9', "pulse": '86a895f16f', "scenes": 'b94c12ba3a', "size": 'f843d146f3', "hold": 'f0f32f8e97', "switch": 'd69637780f', "fridge": 'e6ed099fd7', "pump": '61a85c2d40', "palette": '46269b69df', "grid": '995a272790', "cal": '828d126096', "board": 'be6e6fa5df', "wrench": 'a19d835b51', "music": '38bdc49bc6', "horn": '912e77db44', "bill": 'c665954672', "gen": 'bfb061d481', "lift": 'a3f79b5098', "people": '3db9f01f88', "cloud": '4ff6c2456b', "rain": 'cde2db8d2e', "play": '7d98096e03', "pause": 'b340c18280', "next": 'eacce2fe42', "prev": 'c1a910643e', "rew": '68d8415a1d', "ffw": 'e2b53b3a24', "clock": 'f020a32764', "key": '7a71030c19', "film": '84db2df3b4', "vol": '0ea1430fd9', "tv": '61f319314d', "spark": 'd2a525a674', "photo": 'f6492344a6', "guest": '2d7133b5fc', "list": '49bad7c24a', "del": 'f6aede90a6', "ok2": '95f0689a16', "wind": '2316af64ca' },
  "automation": { "plus": '083e7f9361', "minus": '9ab79d5312', "close": '6d7cfe02e9', "check": '095874916c', "chevron": '5986bee375', "chevronBack": '47772f0f48', "chevronDown": '7657ca7d06', "search": 'e2077b1b08', "filter": 'a984b88e98', "dots": 'c029f63107', "play": '6546450f57', "stop": '365ad71f10', "edit": '0f52a89fb8', "copy": 'e1a20b68c2', "trash": '870075aa30', "history": 'c6076c691f', "restore": '5d40d2974b', "lock": '3a9c128d49', "lockOpen": 'eef60c10e8', "eye": '6f3692f198', "eyeOff": '5009dab7af', "star": '06bf29d0af', "layers": '52399e750e', "sparkle": '5e6a57fbac', "camera": '9018e6d96d', "warning": 'bc8cca3055', "shield": 'f2f6cb5d6f', "info": 'a3446e1dfd', "help": 'c211cd2cfd', "flask": '7c29021491', "refresh": '2b9965571b', "wifiOff": 'cb165a8b4b', "bolt": '3e93fe705c', "clock": '7626fc83e2', "timer": 'e29eb4ca96', "calendar": '7b177ce853', "sunset": '5b32ea0f78', "gauge": '5d39544c5a', "power": 'fbe125b1b6', "bulb": 'f7e37e1d97', "walk": '90345b4da5', "door": '94d476f17e', "users": '177246f594', "thermo": '4062d517e5', "cover": '080abaad9b', "tv": '063c599053', "siren": '3c1f99b74a', "drop": '74df289e2e', "fan": '0ef82356a1', "bell": '88b7aba2c0', "script": '68da2aad79', "repeat": '88fe223d16', "branch": 'df17ddb08b', "code": '836035fd61', "key": 'ef4334eed3', "settings": 'fa41bef659', "home": '548491e8e0', "grip": '463104bb01', "arrowUp": '747e8ad2bc', "arrowDown": '6567426c77', "list": '574ab1a9b9', "grid": 'a7ca2b6b98', "rows": 'a5ed19f68d' },
  "media": { "media": '42f84adddf', "tv": '063c599053', "remote": '0ca4d01e4d', "speaker": '3b33b8b66f', "group": '7c6653b6d2', "power": 'fbe125b1b6', "vol": '13adc610fe', "volOff": '00327fc2da', "plus": '083e7f9361', "minus": '9ab79d5312', "up": 'd1e2551d9e', "down": '7657ca7d06', "left": '47772f0f48', "right": '5986bee375', "chevronBack": '47772f0f48', "chevron": '5986bee375', "chevronDown": '7657ca7d06', "back": '84c3cc8f95', "menu": '17b3a317d9', "info": 'a3446e1dfd', "guide": '0b47275630', "tools": '4a9b0fe0f7', "input": 'b6ef389edb', "exit": '577cb8701e', "list": '574ab1a9b9', "settings": 'fa41bef659', "hdmi": '70ea191931', "antenna": '8bac959345', "play": '6546450f57', "pause": 'bb1e099b90', "rew": '1fff74323c', "ff": '427222eb21', "prev": 'f6482b7075', "next": '14d3565d71', "stop": '365ad71f10', "keyboard": '5c6c22962b', "apps": '789cc8d310', "history": 'c6076c691f', "wifiOff": 'cb165a8b4b', "touch": '20c1e9eab8', "film": '9737d39aa8', "playRect": '568addf87c', "music": '0a9a330d53', "ball": '59fc11c81d', "news": '1ea95860a4', "smile": 'ee88fd0fb4', "globe": '1da5e46c3c', "image": '03ce3141b8', "gamepad": '0fbfa4c069', "sparkle": '5e6a57fbac', "frame": 'aa1fc02455', "moon": '71b1277a5f', "search": 'e2077b1b08', "close": '6d7cfe02e9', "check": '095874916c', "edit": '0f52a89fb8', "eye": '6f3692f198', "eyeOff": '5009dab7af', "grip": '463104bb01', "warning": 'bc8cca3055', "home": '548491e8e0', "layers": '52399e750e', "star": '06bf29d0af', "arrowUp": '747e8ad2bc', "arrowDown": '6567426c77', "size": '72abace0a9', "refresh": '2b9965571b', "phone": '4eb916b354', "link": 'd7b2640cce', "unlink": '2e38ea3441', "trash": '870075aa30', "lock": '3a9c128d49' },
  "player": { "shuffle": 'a02119d9a4', "repeat": '65ac0ea37d', "receiver": '30f8a53b94', "bt": '9f2cc44e3a', "radio": '316612f474', "transfer": '4051eea614', "group": '4ea92c16c8', "unlink": '756923f2e7', "trash": 'ee222f239f', "search": '4d08431feb', "playNext": '9ae97dc303', "addQueue": '19c6ba7678' },
  "notify": { "home": '548491e8e0', "door": '943a0ae895', "doorOpen": '340e16d3fd', "bell": '4d0695c080', "bellRing": 'e4e820c9f0', "bellOff": '1449f8d681', "drop": '205425109e', "flame": '1d085540d3', "gas": '9702590fd5', "siren": '5735700255', "cameraOff": 'abe805e81a', "cam": 'ba0519d62d', "hdd": '540572c7f7', "archive": '17d76552ca', "warning": 'bc8cca3055', "download": '154412710d', "clock": '7626fc83e2', "snooze": '84436b74c6', "bolt": 'ec72e7439f', "layers": '52399e750e', "battery": '5cff7e3aab', "key": '0d5f75533d', "user": 'fb2932f6bc', "users": '066c0c6342', "shield": '694a8e842d', "check": '095874916c', "checkAll": 'e24c719756', "close": '6d7cfe02e9', "chevron": '5986bee375', "chevronBack": '47772f0f48', "chevronDown": '7657ca7d06', "more": '8fb2c6a470', "open": 'adf601084b', "moon": '71b1277a5f', "mail": 'e77e2af935', "send": '6ee7b7b277', "settings": 'fa41bef659', "lock": '3a9c128d49', "phone": '2eada44f09', "chat": '98c0994ebb', "filter": '28aec0841b', "refresh": '7190461dd6', "plus": '083e7f9361', "minus": '9ab79d5312', "image": '03ce3141b8', "escal": 'a47fa177c6', "list": '574ab1a9b9', "calendar": '2ca51089f8', "wifiOff": 'cb165a8b4b', "inbox": 'ca371adf14', "flash": '971056c0d2', "eye": '6f3692f198', "trash": '192e297d5d' },
};

const NOW: Record<string, Readonly<Record<string, string>>> = {
  'sw-icon': ICON_PATHS,
  tickets: TICKET_ICONS,
  cost: COST_ICONS,
  list: LIST_ICONS,
  rfq: RFQ_ICONS,
  table: TABLE_ICONS,
  home: HOME_ICON_PATHS,
  automation: AUTOMATION_ICON_PATHS,
  media: MEDIA_ICON_PATHS,
  player: PLAYER_ICON,
  notify: NOTIFY_ICONS,
};

for (const [registry, before] of Object.entries(BEFORE)) {
  test(`${registry}: every former icon name resolves to the same path data (${Object.keys(before).length} icons)`, () => {
    const now = NOW[registry];
    expect(Object.keys(now).sort(), 'the names of the registry').toEqual(Object.keys(before).sort());
    const changed = Object.entries(before).filter(([name, hash]) => typeof now[name] !== 'string' || sha(now[name]) !== hash).map(([name]) => name);
    expect(changed, 'icons whose path data changed').toEqual([]);
  });
}

test('the fixture is complete: 11 registries, 485 icons', () => {
  expect(Object.keys(BEFORE)).toHaveLength(11);
  expect(Object.values(BEFORE).reduce((n, r) => n + Object.keys(r).length, 0)).toBe(485);
});

/** The markup a Lit template would write, with its expressions inlined (attributes and the unsafeSVG payload). */
function markup(t: unknown): string {
  const r = t as { strings: readonly string[]; values: readonly unknown[] };
  const val = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'symbol') return '<nothing>';
    if (typeof v === 'object' && 'values' in (v as object)) return String(((v as { values: unknown[] }).values ?? [])[0] ?? '');
    return String(v);
  };
  return r.strings.reduce((out, s, i) => out + s + (i < r.values.length ? val(r.values[i]) : ''), '');
}

test('the one wrapper writes the markup every registry wrote', () => {
  const p = '<path d="M1 1h2"/>';
  expect(markup(iconSvg(p))).toBe(`<svg class=ic viewBox="0 0 24 24" aria-hidden="true" style=<nothing>>${p}</svg>`);
  expect(markup(iconSvg(p, 'ic big', ''))).toBe(`<svg class=ic big viewBox="0 0 24 24" aria-hidden="true" style=>${p}</svg>`);
  // tickets: class "ic" (+ the caller's class), no style attribute
  expect(markup(tIcon('plus'))).toBe(markup(iconSvg(TICKET_ICONS.plus, 'ic')));
  expect(markup(tIcon('plus', 'lg'))).toBe(markup(iconSvg(TICKET_ICONS.plus, 'ic lg')));
  expect(markup(cIcon('coins', 'x'))).toBe(markup(iconSvg(COST_ICONS.coins, 'ic x')));
  expect(markup(listIcon('coin'))).toBe(markup(iconSvg(LIST_ICONS.coin, 'ic')));
  expect(markup(rIcon('columns'))).toBe(markup(iconSvg(RFQ_ICONS.columns, 'ic')));
  expect(markup(tbIcon('cards'))).toBe(markup(iconSvg(TABLE_ICONS.cards, 'ic')));
  // the four old modules are the same functions
  expect([cIconOld, listIconOld, rIconOld, tbIconOld]).toEqual([cIcon, listIcon, rIcon, tbIcon]);
  // home: class "hi", an unknown name draws an empty icon
  expect(markup(hi('nope'))).toBe(markup(iconSvg('', 'hi')));
  expect(hasIcon('nope')).toBe(false);
  const homeName = Object.keys(HOME_ICON_PATHS)[0];
  expect(markup(hi(homeName, 'sm'))).toBe(markup(iconSvg(HOME_ICON_PATHS[homeName], 'hi sm')));
  // automations / media / notifications: the style attribute is always written ('' without a size)
  expect(markup(aIcon('plus'))).toBe(markup(iconSvg(AUTOMATION_ICON_PATHS.plus, 'ic', '')));
  expect(markup(aIcon('plus', 18, 'k'))).toBe(markup(iconSvg(AUTOMATION_ICON_PATHS.plus, 'ic k', 'font-size:18px')));
  expect(markup(mIcon('power', 22))).toBe(markup(iconSvg(MEDIA_ICON_PATHS.power, 'ic', 'font-size:22px')));
  expect(markup(nIcon('bell'))).toBe(markup(iconSvg(NOTIFY_ICONS.bell, 'ic', '')));
  expect(markup(nIcon('no-such-icon', 16))).toBe(markup(iconSvg(NOTIFY_ICONS.bell, 'ic', 'font-size:16px')));
  expect(markup(ic('shuffle'))).toBe(markup(iconSvg(PLAYER_ICON.shuffle, 'ic')));
  expect(markup(ic('no-such-icon'))).toBe(markup(iconSvg('', 'ic')));
});

test('tickets: a glyph shared with the app set IS the app set\'s path data (one copy)', () => {
  expect(TICKET_ICONS.search).toBe(ICON_PATHS.search);
  expect(TICKET_ICONS.expand).toBe(ICON_PATHS.expand);
  expect(TICKET_ICONS.camera).toBe(ICON_PATHS.camera);
  expect(TICKET_ICONS.warning).toBe(ICON_PATHS.warning);
  expect(TICKET_ICONS.offline).toBe(ICON_PATHS.offline);
  expect(TICKET_ICONS.x).toBe(ICON_PATHS.close);
  // and a name that is a DIFFERENT glyph in two tables stays two glyphs
  expect(TABLE_ICONS.download).not.toBe(COST_ICONS.download);
  expect(RFQ_ICONS.bell).not.toBe(TABLE_ICONS.bell);
});

test('sw-logo-art: alt is escaped inside the attribute; a plain alt and an empty alt are unchanged', () => {
  expect(swLogoSvg('horizontal', 'brand', 'SmplWise')).toContain('role="img" aria-label="SmplWise"');
  expect(swLogoSvg('horizontal', 'brand')).toContain('role="presentation" aria-hidden="true"');
  const hostile = swLogoSvg('symbol', 'white', 'A&B "<x>" onload="1');
  expect(hostile).toContain('aria-label="A&amp;B &quot;&lt;x&gt;&quot; onload=&quot;1"');
  expect(hostile.match(/<svg /g)).toHaveLength(1);
  expect(hostile).not.toContain('"<x>"');
});

test('status palette: the same hex values as before, in the three widgets', () => {
  expect(STATUS_HEX).toEqual({ ok: '#15803d', warn: '#c2410c', fault: '#c81e1e', unknown: '#667085' });
  expect(Object.fromEntries(Object.entries(statusCss).map(([k, v]) => [k, v.cssText]))).toEqual(STATUS_HEX);
  expect(MAP_PICK_HEX).toEqual({ camera: '#2f6bff', entity: '#16a34a', other: '#7b8794', chosen: '#e0443c', ring: '#fff' });
  const gen = GENERATOR_WIDGET_STYLES.cssText;
  for (const d of ['--sw-gw-ok: #15803d;', '--sw-gw-run: #1d4ed8;', '--sw-gw-trans: #0e7490;', '--sw-gw-warn: #c2410c;', '--sw-gw-fault: #c81e1e;', '--sw-gw-unk: #667085;']) expect(gen).toContain(d);
  const doors = DOORS_WIDGET_STYLES.cssText;
  for (const d of ['--sw-dw-err: #c81e1e;', '--sw-dw-warn: #c2410c;', '--sw-dw-ok: #15803d;', '--sw-dw-off: #667085;']) expect(doors).toContain(d);
  const temp = tempCss.cssText;
  for (const d of ['--tc-alarm-solid: #c81e1e;', '--tc-warn-solid: #b45309;']) expect(temp).toContain(d);
});
