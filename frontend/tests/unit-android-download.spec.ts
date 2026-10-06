import { test, expect } from '@playwright/test';
import { BUNDLED_PATH, formatSize, isAndroidUserAgent, loadAndroidOffer, offerText, parseOffer } from '../src/arx/android-download';

// Owner request 2026-10-06: the sign-in page's "download the Android app" offer. The user-agent decision over a table of real
// strings, the parsing of the public answer (an https address, or the add-on's own bundled APK route) and the "no request off Android"
// rule. Node only.

const ANDROID = [
  ['Pixel 7, Chrome', 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'],
  ['Galaxy tablet, Chrome', 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'],
  ['Galaxy S23, Samsung Internet', 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36'],
  ['Firefox for Android', 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0'],
  ['Android WebView', 'Mozilla/5.0 (Linux; Android 12; Pixel 5 Build/SQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.0.0 Mobile Safari/537.36'],
  ['Kindle Fire (Silk)', 'Mozilla/5.0 (Linux; Android 9; KFMAWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/120.4.1 like Chrome/120.0.6099.144 Safari/537.36'],
  ['Chrome Android emulation in devtools', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'],
] as const;

const NOT_ANDROID = [
  ['iPhone, Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'],
  ['iPhone, Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1'],
  ['iPad, old Safari', 'Mozilla/5.0 (iPad; CPU OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1'],
  ['iPadOS 13+ posing as a Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'],
  ['Mac, Chrome', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'],
  ['Windows, Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'],
  ['Windows, Edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'],
  ['Linux desktop, Firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0'],
  ['Android "desktop site" mode (X11 Linux)', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'],
  ['ChromeOS', 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'],
  ['spoof: Android token inside a Mac string', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'],
  ['spoof: Android token inside a Windows string', 'Mozilla/5.0 (Windows NT 10.0; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0'],
  ['empty', ''],
] as const;

for (const [name, ua] of ANDROID) test(`Android: ${name}`, () => expect(isAndroidUserAgent(ua)).toBe(true));
for (const [name, ua] of NOT_ANDROID) test(`not Android: ${name}`, () => expect(isAndroidUserAgent(ua)).toBe(false));
test('not Android: null / undefined / a non-string', () => {
  expect(isAndroidUserAgent(null)).toBe(false);
  expect(isAndroidUserAgent(undefined)).toBe(false);
  expect(isAndroidUserAgent(42 as unknown as string)).toBe(false);
});

const SHA = 'ab'.repeat(32);

test('parseOffer keeps only a plain https address plus a valid version and hash', () => {
  expect(parseOffer({ android: { url: 'https://example.com/arx.apk', version: '0.9.1', sha256: SHA } })).toEqual({ url: 'https://example.com/arx.apk', version: '0.9.1', sha256: SHA, size: 0, bundled: false });
  expect(parseOffer({ android: { url: 'https://example.com/arx.apk', version: '<b>', sha256: 'nothex' } })).toEqual({ url: 'https://example.com/arx.apk', version: '', sha256: '', size: 0, bundled: false });
  for (const bad of [null, undefined, {}, { android: null }, { android: {} }, { android: { url: 5 } }, { android: { url: 'http://example.com/a.apk' } },
    { android: { url: 'javascript:alert(1)' } }, { android: { url: 'https://u:p@example.com/a.apk' } }, { android: { url: 'not a url' } }, 'x']) {
    expect(parseOffer(bad), JSON.stringify(bad)).toBeNull();
  }
});

test('parseOffer accepts the add-on's own bundled route (relative, with its size) and nothing else relative', () => {
  // Node has no document: the relative route resolves against a placeholder origin; in the page it resolves against document.baseURI
  const b = parseOffer({ android: { url: BUNDLED_PATH, bundled: true, version: '1.0.0', sha256: SHA, size: 12_345_678 } });
  expect(b).not.toBeNull();
  expect(b!.bundled).toBe(true);
  expect(b!.url.endsWith('/' + BUNDLED_PATH)).toBe(true);
  expect([b!.version, b!.sha256, b!.size]).toEqual(['1.0.0', SHA, 12_345_678]);
  expect(parseOffer({ android: { url: BUNDLED_PATH, bundled: true, size: -1 } })!.size).toBe(0);
  expect(parseOffer({ android: { url: BUNDLED_PATH, bundled: true, size: 2 ** 40 } })!.size).toBe(0);
  expect(parseOffer({ android: { url: 'https://example.com/arx.apk', size: 99 } })!.size).toBe(0);
  for (const bad of [{ url: BUNDLED_PATH }, { url: 'api/v1/other', bundled: true }, { url: '../' + BUNDLED_PATH, bundled: true }, { url: '/etc/passwd', bundled: true }]) {
    expect(parseOffer({ android: bad }), JSON.stringify(bad)).toBeNull();
  }
  expect(formatSize(12_345_678)).toBe('11.8 MB');
  expect(formatSize(0)).toBe('');
});

test('offerText: Hebrew by default, English for an English browser', () => {
  expect(offerText('he-IL').link).toBe('הורדת אפליקציית Android');
  expect(offerText(undefined).link).toBe('הורדת אפליקציית Android');
  expect(offerText('en-US').link).toBe('Download the Android app');
  expect(offerText('en').sha).toContain('SHA-256');
});

test('loadAndroidOffer makes no request off Android or inside the app, and answers null on any failure', async () => {
  let calls = 0;
  const ok = (async () => {
    calls++;
    return { ok: true, json: async () => ({ android: { url: 'https://example.com/arx.apk', version: '', sha256: '' } }) } as Response;
  }) as typeof fetch;
  const android = ANDROID[0][1];
  expect(await loadAndroidOffer(NOT_ANDROID[0][1], false, ok)).toBeNull();
  expect(await loadAndroidOffer(NOT_ANDROID[5][1], false, ok)).toBeNull();
  expect(await loadAndroidOffer(android, true, ok)).toBeNull();
  expect(calls).toBe(0);
  expect(await loadAndroidOffer(android, false, ok)).toEqual({ url: 'https://example.com/arx.apk', version: '', sha256: '', size: 0, bundled: false });
  expect(calls).toBe(1);
  expect(await loadAndroidOffer(android, false, (async () => ({ ok: false }) as Response) as typeof fetch)).toBeNull();
  expect(await loadAndroidOffer(android, false, (async () => { throw new Error('offline'); }) as typeof fetch)).toBeNull();
});
