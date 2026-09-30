import { test, expect } from '@playwright/test';
import {
  calendarText, clockParts, configBody, configOf, defaultConfig, forecastCount, gematria, forecastIsDaily, forecastLabel, forecastShown, hasValue, hebrewDate, homeViewOf, moveWidget, NO_DATA, previewData, resolveWidgets,
  sameConfig, sinceText, suggestConfig, timeOfState, untilText, valueText, WIDGET_IDS, widgetOn, widgetSize, PHONE_LAYOUT_DEFAULT,
  type HomeCandidates, type HomeData,
} from '../src/api/home-config';
import { moveId, orderFloors, personalBody, personalIsEmpty, personalOf, PERSONAL_EMPTY, homeSettingsOf, homePatch, HOME_DEFAULT } from '../src/api/home';

// Home redesign (owner decisions 2026-09-30): the widget configuration and what it resolves to - the same module the screen
// uses. Node only.

const DATA: HomeData = {
  weather: {
    entity_id: 'weather.wx', name: 'תחזית', available: true, condition: 'partlycloudy',
    values: { temperature: { v: 27.5, unit: '°C' }, humidity: { v: 61, unit: '%' }, wind: { v: 14, unit: 'km/h' }, pressure: { v: 1012.3, unit: 'hPa' } },
    forecast: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => ({ datetime: `2026-10-${String(d).padStart(2, '0')}T12:00:00+03:00`, condition: 'sunny', temperature: 20 + d, templow: 10 })),
    forecast_len: 10, offers: ['condition', 'temperature', 'humidity', 'wind', 'pressure', 'forecast'],
  },
  sensors: {
    'sensor.parsha': { state: 'נח', name: 'פרשה', unit: null, device_class: null, available: true },
    'sensor.candles': { state: '2026-10-02T14:34:00+00:00', name: 'נרות', unit: null, device_class: 'timestamp', available: true },
    'sensor.gone': { state: '', name: 'נעלם', unit: null, device_class: null, available: false },
  },
  alarm: { entity_id: 'alarm_control_panel.a', name: 'אזעקה', state: 'armed_away', since: null, available: true },
};

function cfg() {
  const c = defaultConfig();
  c.weather.entity = 'weather.wx';
  c.calendar.parsha = 'sensor.parsha';
  c.calendar.candles = 'sensor.candles';
  return c;
}

test.describe('home config', () => {
  test('the default: control centre sizes per direction, every widget on, the order of the mockup', () => {
    const c = defaultConfig();
    expect(c.order).toEqual(['clock', 'weather', 'shabbat', 'alarm', 'quick', 'media']); // media (CR-015) is appended
    expect(WIDGET_IDS.every((w) => c[w].on)).toBe(true);
    expect(c.clock.sizes).toEqual({ a: 'l', b: 'm', c: 'm' });
    expect(c.alarm.sizes).toEqual({ a: 'm', b: 's', c: 'm' });
    expect(c.weather.fields).toEqual(['temperature', 'condition', 'humidity', 'wind', 'forecast']);
    expect(c.calendar).toEqual({ date: '', parsha: '', candles: '', havdalah: '', holiday: '', extras: [] });
  });

  test('configOf takes what the server sent, tolerates anything missing or foreign, and round-trips', () => {
    const c = cfg();
    c.order = ['quick', 'clock', 'weather', 'shabbat', 'alarm', 'media'];
    c.weather.sources = { temperature: 'sensor.outdoor' };
    c.calendar.extras = [{ entity_id: 'binary_sensor.issur', label: 'איסור' }];
    expect(configOf(configBody(c))).toEqual(c);
    expect(sameConfig(configOf(JSON.parse(JSON.stringify(c))), c)).toBe(true);
    // a partial / hand-edited / newer value never breaks: defaults fill in, unknown things are dropped
    const odd = configOf({ order: ['weather', 'nope', 'weather'], clock: { mode: 'analog', sizes: { a: 'huge' } }, weather: { fields: ['humidity', 'sunshine'], forecast: '9', sources: { condition: 'sensor.x', humidity: 'sensor.h' } }, calendar: { extras: [{ entity_id: '' }, 5] } });
    expect(odd.order).toEqual(['weather', 'clock', 'shabbat', 'alarm', 'quick', 'media']);
    expect(odd.clock.mode).toBe('datetime');
    expect(odd.clock.sizes.a).toBe('l');
    expect(odd.weather.fields).toEqual(['humidity']);
    expect(odd.weather.forecast).toBe('5');
    expect(odd.weather.sources).toEqual({ humidity: 'sensor.h' });
    expect(odd.calendar.extras).toEqual([]);
    expect(configOf(null)).toEqual(defaultConfig());
    expect(homeViewOf(null)).toBeNull();
    expect(homeViewOf({ direction: 'z', config: c, data: DATA })?.direction).toBe('a');
  });

  test('resolveWidgets: what is drawn, in the configured order, with the size of the direction', () => {
    const c = cfg();
    const allowed = { lights_off: true, all_off: true };
    let items = resolveWidgets(c, 'a', DATA, { quickAllowed: allowed });
    expect(items.map((i) => `${i.id}:${i.size}`)).toEqual(['clock:l', 'weather:l', 'shabbat:m', 'alarm:m', 'quick:m', 'media:m']);
    items = resolveWidgets(c, 'b', DATA, { quickAllowed: allowed });
    expect(items.map((i) => `${i.id}:${i.size}`)).toEqual(['clock:m', 'weather:m', 'shabbat:m', 'alarm:s', 'quick:s', 'media:s']);
    // order and headings
    c.order = moveWidget(c.order, 'quick', 0);
    c.clock.label = 'שעה בבית';
    items = resolveWidgets(c, 'c', DATA, { quickAllowed: allowed });
    expect(items[0].id).toBe('quick');
    expect(items.find((i) => i.id === 'clock')?.title).toBe('שעה בבית');
    expect(items.find((i) => i.id === 'weather')?.title).toBe('מזג אוויר');
  });

  test('a widget that cannot be shown takes no room; edit mode adds a ghost that says why', () => {
    const c = cfg();
    c.weather.entity = '';
    c.shabbat.on = false;
    const view = resolveWidgets(c, 'a', { ...DATA, alarm: null }, { quickAllowed: {}, mediaAvailable: false });
    expect(view.map((i) => i.id)).toEqual(['clock']); // no weather entity, Shabbat off, no alarm panel, no permitted action, no screen
    const edit = resolveWidgets(c, 'a', { ...DATA, alarm: null }, { editing: true, quickAllowed: {}, mediaAvailable: false });
    expect(edit.map((i) => `${i.id}:${i.avail}`)).toEqual(['clock:ok', 'weather:none', 'shabbat:off', 'alarm:noalarm', 'quick:noaction', 'media:nomedia']);
    // an entity that exists but is not reporting
    const c2 = cfg();
    expect(resolveWidgets(c2, 'a', { ...DATA, weather: { ...DATA.weather!, available: false } }, { editing: true }).find((i) => i.id === 'weather')?.avail).toBe('unavail');
    // Shabbat: nothing chosen vs chosen but every sensor unavailable
    c2.calendar = { ...c2.calendar, parsha: '', candles: '' };
    expect(resolveWidgets(c2, 'a', DATA, { editing: true }).find((i) => i.id === 'shabbat')?.avail).toBe('none');
    c2.calendar.parsha = 'sensor.gone';
    expect(resolveWidgets(c2, 'a', DATA, { editing: true }).find((i) => i.id === 'shabbat')?.avail).toBe('unavail');
    // quick actions: only the permitted, chosen ones count
    const c3 = cfg();
    c3.quick.actions = ['all_off'];
    expect(resolveWidgets(c3, 'a', DATA, { quickAllowed: { lights_off: true } }).some((i) => i.id === 'quick')).toBe(false);
    expect(resolveWidgets(c3, 'a', DATA, { quickAllowed: { all_off: true } }).some((i) => i.id === 'quick')).toBe(true);
  });

  test('moveWidget and moveId keep the list whole and clamp', () => {
    const o = defaultConfig().order;
    expect(moveWidget(o, 'alarm', 0)).toEqual(['alarm', 'clock', 'weather', 'shabbat', 'quick', 'media']);
    expect(moveWidget(o, 'clock', 99)).toEqual(['weather', 'shabbat', 'alarm', 'quick', 'media', 'clock']);
    expect(moveWidget(o, 'clock', -5)).toBe(o);
    expect(moveWidget(o, 'clock', 0)).toBe(o);
    expect(moveId(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(orderFloors([{ floor_id: 'x' }, { floor_id: 'y' }, { floor_id: 'z' }], ['z'])).toEqual([{ floor_id: 'z' }, { floor_id: 'x' }, { floor_id: 'y' }]);
  });

  test('the forecast follows what the entity exposes: 3, 5 or the most it carries', () => {
    const f = DATA.weather!.forecast;
    expect(forecastShown(f, '3')).toHaveLength(3);
    expect(forecastShown(f, '5')).toHaveLength(5);
    expect(forecastShown(f, 'max')).toHaveLength(8); // capped: a card cannot hold ten columns
    expect(forecastShown(f.slice(0, 2), '5')).toHaveLength(2);
    expect(forecastShown([{ datetime: 'garbage', condition: 'sunny', temperature: 1 }, ...f.slice(0, 2)], '5')).toHaveLength(2);
    expect(forecastCount(10, 'max')).toBe(8);
    expect(forecastCount(2, '5')).toBe(2);
    expect(forecastIsDaily(f)).toBe(true);
    const hourly = [14, 15, 16].map((h) => ({ datetime: `2026-10-01T${h}:00:00+03:00`, condition: 'sunny', temperature: 20 }));
    expect(forecastIsDaily(hourly)).toBe(false);
    expect(forecastLabel(hourly[0].datetime, 'Asia/Jerusalem', false)).toBe('14:00');
    expect(forecastLabel(f[0].datetime, 'Asia/Jerusalem', true)).not.toMatch(/^יום/);
    expect(forecastLabel('nope', 'Asia/Jerusalem', true)).toBe('');
  });

  test('previewData: the draft entities show with their state now, from the candidate list', () => {
    const cands: HomeCandidates = {
      weather: [{ entity_id: 'weather.other', name: 'אחר', state: 'sunny', values: { temperature: { v: 30, unit: '°C' } }, forecast: [], forecast_len: 0, offers: ['condition', 'temperature'] }, { entity_id: 'weather.down', name: 'תקוע', state: 'unavailable' }],
      alarms: [{ entity_id: 'alarm_control_panel.b', name: 'ב', state: 'disarmed' }],
      sensors: [{ entity_id: 'sensor.havdalah', name: 'צאת', state: '2026-10-03T15:29:00+00:00', device_class: 'timestamp', suggested: true }, { entity_id: 'sensor.out', name: 'חוץ', state: '31', unit: '°C', device_class: 'temperature', suggested: false }],
    };
    const c = cfg();
    c.weather.entity = 'weather.other';
    c.calendar.havdalah = 'sensor.havdalah';
    c.weather.sources = { temperature: 'sensor.out' };
    c.alarm.entity = 'alarm_control_panel.b';
    const d = previewData(c, DATA, cands);
    expect(d.weather?.entity_id).toBe('weather.other');
    expect(d.weather?.offers).toEqual(['condition', 'temperature']);
    expect(d.sensors['sensor.havdalah'].state).toContain('2026-10-03');
    expect(d.sensors['sensor.parsha'].state).toBe('נח'); // what the server sent for a saved entity is kept
    expect(d.sensors['sensor.out'].unit).toBe('°C');
    expect(d.alarm?.state).toBe('disarmed');
    // "automatic" while the server sent no alarm (the card was off when the tree was read): the most urgent candidate previews
    c.alarm.entity = '';
    expect(previewData(c, { ...DATA, alarm: null }, { ...cands, alarms: [{ entity_id: 'alarm_control_panel.a', name: 'א', state: 'disarmed' }, { entity_id: 'alarm_control_panel.b', name: 'ב', state: 'triggered' }] }).alarm?.entity_id).toBe('alarm_control_panel.b');
    expect(previewData(c, { ...DATA, alarm: null }, null).alarm).toBeNull();
    // the saved entity is used as is; an unavailable candidate is a ghost's "unavail"; no candidates = nothing to preview
    c.weather.entity = 'weather.wx';
    expect(previewData(c, DATA, cands).weather).toBe(DATA.weather);
    c.weather.entity = 'weather.down';
    expect(previewData(c, DATA, cands).weather?.available).toBe(false);
    c.weather.entity = 'weather.other';
    expect(previewData(c, DATA, null).weather).toBeNull();
    expect(previewData(defaultConfig(), NO_DATA, null)).toEqual(NO_DATA);
  });

  test('suggestConfig: the default with the first available weather entity and one sensor per calendar field', () => {
    const c = suggestConfig({
      weather: [{ entity_id: 'weather.z', name: 'z', state: 'sunny' }, { entity_id: 'weather.a', name: 'a', state: 'unavailable' }, { entity_id: 'weather.b', name: 'b', state: 'rainy' }],
      alarms: [], sensors: [], suggested_calendar: { parsha: 'sensor.p', date: 'sensor.d' },
    });
    expect(c.weather.entity).toBe('weather.b');
    expect(c.calendar).toEqual({ date: 'sensor.d', parsha: 'sensor.p', candles: '', havdalah: '', holiday: '', extras: [] });
    expect(suggestConfig(null)).toEqual(defaultConfig());
  });

  test('the Hebrew date is computed in the browser (Intl) and the times / texts read like the screen shows them', () => {
    const d = new Date('2026-10-14T09:00:00Z');
    expect(hebrewDate(d, 'Asia/Jerusalem')).toBe('ג׳ בחשוון התשפ״ז'); // 14 October 2026, in letters like the Jewish Calendar sensors
    expect(hebrewDate(new Date('2026-09-30T09:00:00Z'), 'Asia/Jerusalem')).toBe('י״ט בתשרי התשפ״ז');
    expect([1, 3, 15, 16, 19, 30, 787, 700, 115].map(gematria)).toEqual(['א׳', 'ג׳', 'ט״ו', 'ט״ז', 'י״ט', 'ל׳', 'תשפ״ז', 'ת״ש', 'קט״ו']);
    expect(gematria(0)).toBe('0');
    expect(hebrewDate(d, 'Not/AZone')).not.toBe(''); // a bad zone falls back to the site's
    const p = clockParts(new Date('2026-09-30T11:32:07Z'), 'Asia/Jerusalem'); // 14:32:07 in Jerusalem (UTC+3)
    expect([p.h, p.m, p.s]).toEqual(['14', '32', '07']);
    expect(p.weekdayLong).toBe('יום רביעי');
    expect(clockParts(new Date('2026-09-30T21:05:00Z'), 'Asia/Jerusalem').h).toBe('00'); // midnight is 00, not 24
    expect(timeOfState('2026-10-02T14:34:00+00:00', 'Asia/Jerusalem')).toBe('17:34');
    expect(timeOfState('18:29', 'Asia/Jerusalem')).toBe('18:29');
    expect(timeOfState('unavailable', 'Asia/Jerusalem')).toBe('');
    const S = DATA.sensors;
    expect(calendarText('parsha', S['sensor.parsha'], 'Asia/Jerusalem')).toBe('פרשת נח');
    expect(calendarText('candles', S['sensor.candles'], 'Asia/Jerusalem')).toBe('17:34');
    expect(calendarText('parsha', S['sensor.gone'], 'Asia/Jerusalem')).toBe('');
    expect(calendarText('extra', { state: 'on', name: '', unit: null, device_class: null, available: true }, 'Asia/Jerusalem')).toBe('כן');
    expect(hasValue(undefined)).toBe(false);
    expect(valueText('temperature', { v: 27.5, unit: '°C' })).toBe('28°C');
    expect(valueText('humidity', { v: 61, unit: '%' })).toBe('61%');
    expect(valueText('wind', { v: 14, unit: 'km/h' })).toBe('14 קמ״ש');
    expect(valueText('pressure', { v: 1012.34, unit: 'hPa' })).toBe('1012.3 הקטופסקל');
    expect(valueText('uv', { v: 6, unit: null })).toBe('6');
    const now = new Date('2026-09-30T12:00:00Z');
    expect(untilText('2026-10-02T12:00:00Z', now)).toBe('עוד יומיים');
    expect(untilText('2026-10-02T18:00:00Z', now)).toBe('עוד יומיים ו־6 שעות');
    expect(untilText('2026-09-30T12:20:00Z', now)).toBe('עוד 20 דקות');
    expect(untilText('2026-09-29T12:20:00Z', now)).toBe('');
    expect(untilText('17:34', now)).toBe('');
    expect(sinceText('2026-09-30T09:00:00Z', now)).toBe('שונה לפני 3 שעות');
    expect(sinceText(null, now)).toBe('');
  });

  test('settings: the server settings become the editor state and only what changed is sent', () => {
    const c = cfg();
    const s = homeSettingsOf({ 'home.title': '  הבית ', 'home.floor_order': '["f1","f0"]', 'home.direction': 'b', 'home.side': 'start', 'home.widgets': configBody(c) });
    expect(s.title).toBe('הבית');
    expect(s.floorOrder).toEqual(['f1', 'f0']);
    expect(s.direction).toBe('b');
    expect(s.side).toBe('start');
    expect(s.config).toEqual(c);
    expect(homeSettingsOf(null)).toEqual(HOME_DEFAULT);
    expect(homeSettingsOf({ 'home.direction': 'q', 'home.side': 'up' }).direction).toBe('a');
    expect(homePatch(s, s)).toEqual({});
    const to = { ...s, title: 'חדש', direction: 'c' as const, config: { ...c, order: moveWidget(c.order, 'quick', 0) } };
    expect(Object.keys(homePatch(s, to)).sort()).toEqual(['home.direction', 'home.title', 'home.widgets']);
    expect(homePatch(s, { ...s, floorOrder: ['f0'] })).toEqual({ 'home.floor_order': '["f0"]' });
  });

  test('the personal override: read tolerantly, empty means "follow the installation"', () => {
    expect(personalIsEmpty(personalOf(null))).toBe(true);
    expect(personalIsEmpty(PERSONAL_EMPTY)).toBe(true);
    expect(personalBody(PERSONAL_EMPTY)).toBeNull();
    const p = personalOf({ direction: 'c', order: ['quick', 'nope'], widgets: { clock: { size: 's', on: false }, weather: { size: 'xx' }, nope: { on: true } } });
    expect(p.direction).toBe('c');
    expect(p.order).toEqual(['quick', 'clock', 'weather', 'shabbat', 'alarm', 'media']);
    expect(p.widgets).toEqual({ clock: { size: 's', on: false } });
    expect(personalBody(p)).toEqual({ direction: 'c', phone_layout: null, order: p.order, widgets: p.widgets });
    expect(personalOf({ phone_layout: 'two' }).phone_layout).toBe('two');
    expect(personalOf({ phone_layout: 'grid' }).phone_layout).toBeNull();
    expect(personalIsEmpty(personalOf({ phone_layout: 'snap' }))).toBe(false);
    expect(personalOf({ direction: 'z' }).direction).toBeNull();
  });


  test('the phone: its own layout, on / off and size per widget, defaulting to the desktop capped at medium; old configs read with the defaults', () => {
    const c = cfg();
    expect(c.phone_layout).toBe(PHONE_LAYOUT_DEFAULT);
    expect(PHONE_LAYOUT_DEFAULT).toBe('stack');
    expect(WIDGET_IDS.every((w) => c[w].phone_on === null && c[w].phone_size === null)).toBe(true);
    // an old config (saved before the phone keys) and a foreign value read as the defaults
    const old = configOf({ order: [...WIDGET_IDS], clock: { on: true, sizes: { a: 'l', b: 'm', c: 'm' } } });
    expect(old.phone_layout).toBe('stack');
    expect(old.clock.phone_on).toBeNull();
    expect(configOf({ phone_layout: 'grid', clock: { phone_on: 'yes', phone_size: 'xl' } }).clock.phone_size).toBeNull();
    expect(configOf({ phone_layout: 'two', clock: { phone_on: false, phone_size: 's' } })).toMatchObject({ phone_layout: 'two', clock: { phone_on: false, phone_size: 's' } });
    expect(configOf(configBody({ ...c, phone_layout: 'snap' })).phone_layout).toBe('snap');
    // sizes: the desktop size of the direction, at most medium; an explicit phone size wins
    expect(widgetSize(c.clock, 'a', false)).toBe('l');
    expect(widgetSize(c.clock, 'a', true)).toBe('m'); // large on the desktop band, medium on a phone
    expect(widgetSize(c.alarm, 'b', true)).toBe('s');
    c.clock.phone_size = 'l';
    expect(widgetSize(c.clock, 'a', true)).toBe('l');
    expect(widgetSize(c.clock, 'a', false)).toBe('l');
    c.clock.phone_size = 's';
    expect(widgetSize(c.clock, 'a', true)).toBe('s');
    expect(widgetSize(c.clock, 'a', false)).toBe('l'); // independent of the desktop
    // on / off: the phone follows the desktop until it has its own
    c.weather.on = false;
    expect(widgetOn(c.weather, true)).toBe(false);
    c.weather.phone_on = true;
    expect(widgetOn(c.weather, true)).toBe(true);
    expect(widgetOn(c.weather, false)).toBe(false); // a phone-only widget
    c.alarm.phone_on = false;
    expect(widgetOn(c.alarm, false)).toBe(true);
    expect(widgetOn(c.alarm, true)).toBe(false); // a desktop-only widget
  });

  test('resolveWidgets on a phone: a widget hidden there takes no room, the sizes are the phone\'s, edit mode explains the hidden one', () => {
    const c = cfg();
    c.alarm.phone_on = false;
    c.quick.phone_on = false;
    c.weather.phone_size = 's';
    const allowed = { lights_off: true, all_off: true };
    const desktop = resolveWidgets(c, 'a', DATA, { quickAllowed: allowed });
    expect(desktop.map((i) => `${i.id}:${i.size}`)).toEqual(['clock:l', 'weather:l', 'shabbat:m', 'alarm:m', 'quick:m', 'media:m']);
    const phone = resolveWidgets(c, 'a', DATA, { quickAllowed: allowed, phone: true });
    expect(phone.map((i) => `${i.id}:${i.size}`)).toEqual(['clock:m', 'weather:s', 'shabbat:m', 'media:m']); // no alarm, no quick, weather at its own size
    const edit = resolveWidgets(c, 'a', DATA, { quickAllowed: allowed, phone: true, editing: true });
    expect(edit.map((i) => `${i.id}:${i.avail}`)).toEqual(['clock:ok', 'weather:ok', 'shabbat:ok', 'alarm:off', 'quick:off', 'media:ok']);
    // a widget that is off on the desktop but on for the phone is drawn there only
    c.shabbat.on = false;
    c.shabbat.phone_on = true;
    expect(resolveWidgets(c, 'a', DATA, { phone: true }).some((i) => i.id === 'shabbat')).toBe(true);
    expect(resolveWidgets(c, 'a', DATA, {}).some((i) => i.id === 'shabbat')).toBe(false);
  });

  test('the media widget (CR-015): appended last, the common settings only, absent when the caller has no screen', () => {
    const c = defaultConfig();
    expect(WIDGET_IDS[WIDGET_IDS.length - 1]).toBe('media');
    expect(c.media).toEqual({ on: true, sizes: { a: 'm', b: 's', c: 'm' }, label: '', phone_on: null, phone_size: null });
    // a config saved before the widget existed reads back with it, last, on
    const old = configOf({ order: ['quick', 'clock'], clock: { on: false } });
    expect(old.order).toEqual(['quick', 'clock', 'weather', 'shabbat', 'alarm', 'media']);
    expect(old.media.on).toBe(true);
    // no entity of its own: whatever the server sends beyond the common keys is dropped
    expect(configOf({ media: { on: false, entity: 'media_player.tv', sizes: { b: 'l' } } }).media).toEqual({ ...c.media, on: false, sizes: { a: 'm', b: 'l', c: 'm' } });
    // drawn unless the caller is known to have no screen; edit mode explains the absence
    expect(resolveWidgets(c, 'a', DATA, { quickAllowed: { all_off: true } }).some((i) => i.id === 'media')).toBe(true);
    expect(resolveWidgets(c, 'a', DATA, { mediaAvailable: false }).some((i) => i.id === 'media')).toBe(false);
    expect(resolveWidgets(c, 'a', DATA, { mediaAvailable: false, editing: true }).find((i) => i.id === 'media')?.avail).toBe('nomedia');
    c.media.on = false;
    expect(resolveWidgets(c, 'a', DATA, { editing: true }).find((i) => i.id === 'media')?.avail).toBe('off');
  });
});
