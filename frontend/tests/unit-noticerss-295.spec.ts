import { test, expect } from '@playwright/test';
import { tickerItemHtml } from '../src/notice-tv/tv-logic';
import { NAME_MAX, SOURCES_MAX, canSave, emptyRow, feedView, isDirty, move, payload, rowsOf, shortName, urlOk, validate, type Row } from '../src/notices/news-model';

// NOTICERSS-295: the ticker item (name + logo, never the address) and the pure rules of the news-sources editor.
//   npx playwright test -c playwright.unit.config.ts tests/unit-noticerss-295.spec.ts

const row = (over: Partial<Row> = {}): Row => ({ ...emptyRow(), name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', ...over });

test('ticker: the source is its NAME, not the address, and the markup without a logo is the 2.19.0 one', () => {
  const h = tickerItemHtml({ source: 'ynet חדשות', title: 'כותרת' }, '');
  expect(h).toBe('<span class="h" dir="rtl">כותרת</span><em dir="auto" title="ynet חדשות">ynet חדשות</em><i class="sep" aria-hidden="true"></i>');
  expect(h).not.toContain('www.');
  expect(h).not.toContain('<img');
});

test('ticker: a loaded logo sits on a light chip before the name; an unloaded one leaves the name alone', () => {
  const n = { source: 'ynet', title: 't', logo: 'api/v1/notices/display/lobby/news-logo/ynet?v=abc' };
  const withLogo = tickerItemHtml(n, 'blob:http://x/1');
  expect(withLogo).toContain('<span class="slg" aria-hidden="true"><img alt="" src="blob:http://x/1"></span><em');
  expect(withLogo.indexOf('slg')).toBeLessThan(withLogo.indexOf('<em'));
  expect(tickerItemHtml(n, '')).not.toContain('<img'); // not loaded yet
  expect(tickerItemHtml({ source: 'ynet', title: 't' }, 'blob:http://x/1')).not.toContain('<img'); // the item names no logo
});

test('ticker: names and titles are escaped, an Arabic / Latin / Hebrew name stays one isolated run', () => {
  const h = tickerItemHtml({ source: '<b>"x"</b> & ערוץ 7', title: '<script>alert(1)</script>', logo: 'u' }, 'blob:"onerror="x');
  expect(h).not.toContain('<script');
  expect(h).not.toContain('<b>');
  expect(h).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; ערוץ 7');
  expect(h).not.toContain('src="blob:"onerror');
  expect(tickerItemHtml({ source: 'الجزيرة', title: 'عنوان' }, '')).toContain('<em dir="auto" title="الجزيرة">الجزيرة</em>');
});

test('urlOk: https only, no credentials, no spaces, no private or local host, port 443 only', () => {
  expect(urlOk('https://www.ynet.co.il/Integration/StoryRss2.xml')).toBe(true);
  expect(urlOk(' https://feeds.example.com/rss ')).toBe(true);
  for (const bad of ['', 'http://feeds.example.com/rss', 'https://u:p@feeds.example.com/rss', 'https://feeds.example.com:8443/x', 'https://localhost/x', 'https://127.0.0.1/x',
    'https://10.1.2.3/x', 'https://192.168.1.1/x', 'https://172.16.0.1/x', 'https://169.254.1.1/x', 'https://printer.local/x', 'https://[::1]/x', 'https://a b.example.com/x',
    'https://nodot/x', 'ftp://feeds.example.com/x', 'https://feeds.example.com/' + 'a'.repeat(400)]) expect(urlOk(bad), bad).toBe(false);
  expect(urlOk('https://8.8.8.8/rss')).toBe(true);
});

test('validate: a name is required on every row, addresses are unique, the first problem wins', () => {
  expect(validate([row(), row({ name: 'walla', url: 'https://rss.walla.co.il/feed/1' })])).toEqual(['', '']);
  expect(validate([row({ name: '' })])).toEqual(['name']);
  expect(validate([row({ name: '   ' })])).toEqual(['name']);
  expect(validate([row({ name: 'x'.repeat(NAME_MAX + 1) })])).toEqual(['name']);
  expect(validate([row({ name: 'x'.repeat(NAME_MAX) })])).toEqual(['']);
  expect(validate([emptyRow()])).toEqual(['name']); // a new row has neither a name nor a real address yet
  expect(validate([row({ url: 'http://x.example.com' })])).toEqual(['url']);
  expect(validate([row(), row({ name: 'again' })])).toEqual(['', 'dup']);
  expect(canSave([row(), row({ name: 'again' })])).toBe(false);
  expect(canSave(Array.from({ length: SOURCES_MAX }, (_x, i) => row({ name: 'n' + i, url: 'https://feeds.example.com/' + i })))).toBe(true);
  expect(canSave(Array.from({ length: SOURCES_MAX + 1 }, (_x, i) => row({ name: 'n' + i, url: 'https://feeds.example.com/' + i })))).toBe(false);
});

test('move: reorders, ignores out-of-range, never mutates', () => {
  const a = ['a', 'b', 'c'];
  expect(move(a, 0, 1)).toEqual(['b', 'a', 'c']);
  expect(move(a, 2, 0)).toEqual(['c', 'a', 'b']);
  expect(move(a, 0, -1)).toBe(a);
  expect(move(a, 2, 3)).toBe(a);
  expect(a).toEqual(['a', 'b', 'c']);
});

test('payload / dirty: trimmed, id only when saved, an unadopted raw URL makes the list dirty', () => {
  const saved = rowsOf([{ id: 'ynet', name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', enabled: true, has_logo: false, logo_url: '' }]);
  expect(isDirty(saved, saved)).toBe(false);
  const edited = saved.map((r) => ({ ...r, name: ' ynet חדשות ' }));
  expect(isDirty(edited, saved)).toBe(true);
  expect(payload([...edited, emptyRow()])).toEqual([
    { id: 'ynet', name: 'ynet חדשות', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', enabled: true },
    { name: '', url: 'https://', enabled: true },
  ]);
  expect(isDirty(rowsOf([{ id: 'c1', name: 'mine', url: 'https://feeds.example.com/r', custom: true }]), rowsOf([{ id: 'c1', name: 'mine', url: 'https://feeds.example.com/r', custom: true }]))).toBe(true);
  expect(isDirty([...saved].reverse().concat(row({ id: 'w', name: 'w', url: 'https://rss.walla.co.il/feed/1' })), saved)).toBe(true);
  expect(rowsOf([{ id: 'a', name: 'a', url: 'https://a.example.com/', enabled: false }])[0].enabled).toBe(false);
  expect(rowsOf([{ id: 'a', name: 'a', url: 'https://a.example.com/' }])[0].enabled).toBe(true); // a list without the flag reads as on
});

test('feedView: a board feed shows the list name and logo (by id, then by address); a raw URL keeps its stored name as custom', () => {
  const list = [{ id: 'ynet', name: 'ynet חדשות', url: 'https://www.ynet.co.il/x', has_logo: true, logo_url: 'api/v1/notices/news-sources/ynet/logo?v=1' },
    { id: 'c1', name: 'mine', url: 'https://feeds.example.com/r', custom: true }];
  expect(feedView({ id: 'ynet', name: 'old', url: 'https://moved.example.com' }, list)).toEqual({ name: 'ynet חדשות', logo: 'api/v1/notices/news-sources/ynet/logo?v=1', known: true });
  expect(feedView({ name: 'www.ynet.co.il', url: 'https://www.ynet.co.il/x' }, list).name).toBe('ynet חדשות');
  expect(feedView({ name: 'mine', url: 'https://feeds.example.com/r' }, list).known).toBe(false);
  expect(feedView({ name: 'gone', url: 'https://gone.example.com/' }, list)).toEqual({ name: 'gone', logo: '', known: false });
});

test('shortName: long names are cut with an ellipsis, short ones stay', () => {
  expect(shortName('ynet')).toBe('ynet');
  expect(shortName('x'.repeat(40)).length).toBe(24);
  expect(shortName('x'.repeat(40)).endsWith('…')).toBe(true);
});
