import { test, expect } from '@playwright/test';
import { resetMediaMock } from '../src/api/media-screens-mock';
import {
  DEFAULT_REMOTE, EMPTY_LAYOUT, KeyThrottle, artworkUrl, bulkCandidates, commandOffered, effectiveLayout, moveKey, needsPublic, remoteSections, resolveCards, stateText,
  type MediaLayout, type SourceItem,
} from '../src/api/media-screens';

// CR-015 S0: the typed client's pure helpers and the MOCK adapter (docs/architecture/MEDIA_API.md §4). No browser page.

const req = (n: number) => ({ client_request_id: `req-${n}-abcdefgh`, expires_at: new Date(Date.now() + 15000).toISOString() });

test.describe('media-screens client (mock adapter)', () => {
  test('lists the eight mockup screens, one per physical device, with floors and areas', async () => {
    const m = resetMediaMock();
    const { devices } = await m.list();
    expect(devices).toHaveLength(8);
    expect(new Set(devices.map((d) => d.key)).size).toBe(8);
    expect(devices.every((d) => d.kind === 'screen' && d.floor_id && d.area_id)).toBe(true);
    expect((await m.list({ floor: 'b' })).devices.map((d) => d.key)).toEqual(['md-cinema', 'md-gym']);
    expect(stateText(devices.find((d) => d.key === 'md-pergola')!)).toBe('מצב אמנות');
    expect(stateText(devices.find((d) => d.key === 'md-gym')!)).toBe('לא זמין');
  });

  test('a screen that is off accepts only power-on; keys are refused until it is on', async () => {
    const m = resetMediaMock();
    await expect(m.command('md-parents', { command: 'key', key: 'up', ...req(1) })).rejects.toMatchObject({ code: 'screen_off' });
    const on = await m.command('md-parents', { command: 'power_on', ...req(2) });
    expect(on.status).toBe('accepted');
    const key = await m.command('md-parents', { command: 'key', key: 'up', ...req(3) });
    expect(key).toMatchObject({ status: 'sent', action_id: null, confirm: 'none' });
    expect(m.sent.map((s) => s.command.command)).toEqual(['power_on', 'key']);
  });

  test('the generic profile has no keys; an LG without remote wake cannot be powered on', async () => {
    const m = resetMediaMock();
    const kids = await m.get('md-kids');
    expect(kids.caps.keys).toEqual([]);
    expect(commandOffered(kids, { command: 'key', key: 'ok' })).toBe(false);
    expect(remoteSections(kids).main).not.toContain('dpad');
    const office = await m.get('md-office');
    expect(office.caps.power_on).toBe(false);
    expect(office.caps.power_on_reason).toBe('no_remote_wake');
    await expect(m.command('md-office', { command: 'power_on', ...req(4) })).rejects.toMatchObject({ status: 422 });
  });

  test('the public-screen rule mirrors the server: source / app / text, keys but volume / mute / play / pause, transport stop / next / previous', async () => {
    const m = resetMediaMock();
    const pub = { ...(await m.get('md-pergola')), can: { control: true, power: true, public_ok: false, bulk: true } };
    const on = { ...pub, live: { ...pub.live, power: 'on' as const } };
    expect([
      needsPublic({ command: 'source', source_id: 'TV' }), needsPublic({ command: 'app', app_id: 'Netflix' }), needsPublic({ command: 'text', text: 'a' }),
      needsPublic({ command: 'key', key: 'ok' }), needsPublic({ command: 'transport', action: 'stop' }), needsPublic({ command: 'transport', action: 'next' }),
    ]).toEqual([true, true, true, true, true, true]);
    expect([
      needsPublic({ command: 'key', key: 'volup' }), needsPublic({ command: 'key', key: 'mute' }), needsPublic({ command: 'key', key: 'play' }),
      needsPublic({ command: 'transport', action: 'play_pause' }), needsPublic({ command: 'power_off' }), needsPublic({ command: 'sound_output', output: 'x' }),
    ]).toEqual([false, false, false, false, false, false]);
    expect(commandOffered(on, { command: 'key', key: 'ok' })).toBe(false);
    expect(commandOffered(on, { command: 'key', key: 'volup' })).toBe(true);
    expect(commandOffered({ ...on, can: { ...on.can, public_ok: true } }, { command: 'key', key: 'ok' })).toBe(true);
  });

  test('the artwork path the server sends is resolved against the page, an absolute URL is left alone', () => {
    const base = 'http://127.0.0.1:4401/ingress/abc/';
    (globalThis as { document?: unknown }).document = { baseURI: base };
    expect(artworkUrl('api/v1/multimedia/devices/md-x/artwork?v=3')).toBe(`${base}api/v1/multimedia/devices/md-x/artwork?v=3`);
    expect(artworkUrl('/api/v1/multimedia/devices/md-x/artwork')).toBe(`${base}api/v1/multimedia/devices/md-x/artwork`);
    expect(artworkUrl('https://img.example/a.png')).toBe('https://img.example/a.png');
    delete (globalThis as { document?: unknown }).document;
  });

  test('the curation read keeps hidden items and default names; the ordinary read and a save leave hidden ones out, never un-hiding them', async () => {
    const m = resetMediaMock();
    const before = await m.get('md-living');
    const full0 = await m.get('md-living', { curation: true });
    expect(before.sources.every((s) => s.hidden === undefined && s.default_label === undefined)).toBe(true);
    expect(full0.sources.length).toBe(before.sources.length);
    const edit = (x: SourceItem, hide: boolean) => ({ id: x.id, label: x.id === 'HDMI1' ? 'ממיר' : null, hidden: x.id === 'HDMI2' ? hide : !!x.hidden, kind: x.kind });
    const saved = await m.saveDeviceRemote('md-living', { remote: null, sources: full0.sources.map((s) => edit(s, true)), apps: full0.apps.map((a) => ({ id: a.id, label: null, hidden: false })) });
    expect(saved.sources.map((s) => s.id)).not.toContain('HDMI2');
    expect(saved.sources.find((s) => s.id === 'HDMI1')?.label).toBe('ממיר');
    const full = await m.get('md-living', { curation: true });
    expect(full.sources.find((s) => s.id === 'HDMI2')?.hidden).toBe(true);
    const hdmi1 = full.sources.find((s) => s.id === 'HDMI1');
    expect([hdmi1?.label, hdmi1?.default_label]).toEqual(['ממיר', 'HDMI 1']);
    // the editor's own list goes back unchanged (hidden stays hidden, the custom name stays)
    const again = await m.saveDeviceRemote('md-living', { remote: null, sources: full.sources.map((s) => ({ id: s.id, label: s.label === s.default_label ? null : s.label, hidden: s.hidden === true, kind: s.kind })) });
    expect(again.sources.find((s) => s.id === 'HDMI1')?.label).toBe('ממיר');
    expect((await m.get('md-living', { curation: true })).sources.find((s) => s.id === 'HDMI2')?.hidden).toBe(true);
  });

  test('a duplicate request id is never sent twice; text is capped at 200 characters', async () => {
    const m = resetMediaMock();
    await m.command('md-living', { command: 'mute', muted: true, ...req(5) });
    await m.command('md-living', { command: 'mute', muted: false, ...req(5) });
    expect(m.sent).toHaveLength(1);
    await expect(m.command('md-living', { command: 'text', text: 'x'.repeat(201), ...req(6) })).rejects.toMatchObject({ code: 'validation' });
  });

  test('bulk off skips screens already off and unavailable; art mode is turned off', async () => {
    const m = resetMediaMock();
    const p = await m.bulkPreview('floor', 'b');
    expect(p.counts).toMatchObject({ send: 1, unavailable: 1 });
    const g = await m.bulkPreview('floor', 'g');
    expect(g.devices.filter((d) => d.will === 'off').map((d) => d.key).sort()).toEqual(['md-kitchen', 'md-living', 'md-pergola']);
    expect(bulkCandidates((await m.list({ floor: 'u1' })).devices).map((d) => d.key)).toEqual(['md-kids']);
  });

  test('remote sections follow the config and the capabilities; 5b puts numbers and colours behind "more"', async () => {
    const m = resetMediaMock();
    const living = await m.get('md-living');
    const s = remoteSections(living);
    expect(s.main).toEqual(['recent', 'nav', 'dpad', 'vol', 'ch', 'pbk']);
    expect(s.more).toEqual(['nums', 'colors', 'text', 'xtra']);
    const off = remoteSections({ ...living, remote: { ...DEFAULT_REMOTE, sections: DEFAULT_REMOTE.sections.map((x) => ({ ...x, on: x.id !== 'ch' })) } });
    expect(off.main).not.toContain('ch');
  });

  test('layout: pinned first, floor groups in the floor order, hidden cards dropped, personal override on top', async () => {
    const { devices } = await resetMediaMock().list();
    const layout: MediaLayout = { ...EMPTY_LAYOUT, floor_order: ['b', 'g', 'u1'], pinned: ['md-kids'], cards: { 'md-gym': { on: false, size: 'm', phone_on: null, phone_size: null } } };
    const groups = resolveCards(devices, layout, false);
    expect(groups.map((g) => g.id)).toEqual(['pinned', 'b', 'g', 'u1']);
    expect(groups[1].items.map((i) => i.device.key)).toEqual(['md-cinema']);
    const personal = effectiveLayout(layout, { group_by: 'none', order: null, cards: { 'md-living': { size: 'l' } } });
    const flat = resolveCards(devices, personal, false);
    expect(flat.map((g) => g.id)).toEqual(['pinned', 'all']);
    expect(flat[1].items.find((i) => i.device.key === 'md-living')?.size).toBe('l');
    expect(resolveCards(devices, personal, true)[1].items.find((i) => i.device.key === 'md-living')?.size).toBe('m');
    expect(moveKey(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
  });

  test('layout save is revision-checked', async () => {
    const m = resetMediaMock();
    const l = await m.layout();
    const saved = await m.saveLayout({ ...l.installation, group_by: 'area' }, l.revision);
    expect(saved.installation.group_by).toBe('area');
    await expect(m.saveLayout(l.installation, l.revision)).rejects.toMatchObject({ code: 'revision_conflict' });
  });

  test('the key throttle allows a burst of 8, then 5 per second, and drops the excess', () => {
    const t = new KeyThrottle();
    const burst = Array.from({ length: 10 }, () => t.take(1000));
    expect(burst.filter(Boolean)).toHaveLength(8);
    expect(t.take(1100)).toBe(false);
    expect(t.take(1200)).toBe(true);
  });
});
