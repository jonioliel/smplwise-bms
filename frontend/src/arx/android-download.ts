/**
 * Owner request 2026-10-06: the sign-in page offers "download the Android app" to a person on an ANDROID device, and
 * only when an administrator saved a download address (הגדרות › גישה מרחוק). Apple devices and computers never see it.
 *
 * The decision is deliberately conservative: only a user agent that says Android counts. iPadOS and "desktop site"
 * modes report Macintosh / X11 and are therefore not Android; a user agent mixing Android with an Apple or Windows
 * token is treated as spoofed and refused. Inside the Android app itself nothing is offered (it is already installed).
 * No request is made at all on a device that is not Android.
 */

export interface AndroidOffer {
  readonly url: string;
  readonly version: string;
  readonly sha256: string;
}

/** Pure: does this user agent belong to an Android phone or tablet? */
export function isAndroidUserAgent(ua: string | null | undefined): boolean {
  if (typeof ua !== 'string' || !ua) return false;
  if (!/\bAndroid\b/i.test(ua)) return false;
  // never an Apple device or a desktop operating system, whatever else the string claims
  if (/iPhone|iPad|iPod|Macintosh|Mac OS X|Windows|CrOS|Windows Phone/i.test(ua)) return false;
  return true;
}

const SHA = /^[0-9a-f]{64}$/;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._+\- ]{0,31}$/;

/** Pure: the server's answer as an offer, or null (anything that is not a plain https address offers nothing). */
export function parseOffer(body: unknown): AndroidOffer | null {
  const a = (body as { android?: unknown } | null | undefined)?.android as Record<string, unknown> | null | undefined;
  if (!a || typeof a !== 'object' || typeof a.url !== 'string') return null;
  let u: URL;
  try {
    u = new URL(a.url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return null;
  const version = typeof a.version === 'string' && VERSION.test(a.version) ? a.version : '';
  const sha256 = typeof a.sha256 === 'string' && SHA.test(a.sha256) ? a.sha256 : '';
  return { url: u.href, version, sha256 };
}

const TEXT = {
  he: { link: 'הורדת אפליקציית Android', version: 'גרסה', sha: 'SHA-256 לאימות' },
  en: { link: 'Download the Android app', version: 'Version', sha: 'SHA-256 to verify' },
} as const;

/** Pure: the offer's strings in Hebrew (the default) or English (a browser that asks for English). */
export function offerText(lang: string | null | undefined): (typeof TEXT)['he'] {
  return /^en\b/i.test(lang ?? '') ? TEXT.en : TEXT.he;
}

/**
 * The offer for THIS device: null at once (no request) unless the user agent says Android and the page is not inside
 * the Android app; otherwise the public, pre-login `api/v1/auth/app-download` (remote channel). Any failure offers nothing.
 */
export async function loadAndroidOffer(
  ua: string | null | undefined = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  inApp = false,
  fetcher: typeof fetch = (...a) => fetch(...a),
): Promise<AndroidOffer | null> {
  if (inApp || !isAndroidUserAgent(ua)) return null;
  try {
    const res = await fetcher('api/v1/auth/app-download', { credentials: 'same-origin' });
    return res.ok ? parseOffer(await res.json()) : null;
  } catch {
    return null;
  }
}
