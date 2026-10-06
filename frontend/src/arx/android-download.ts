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
  /** The file's size in bytes when the add-on itself hosts the APK (bundled in its image), else 0. */
  readonly size: number;
  /** True when the link points at the add-on's own public route (the APK ships inside the add-on image). */
  readonly bundled: boolean;
}

/** The only relative address accepted: the add-on's own public download route (resolved against the Arx page). */
export const BUNDLED_PATH = 'api/v1/auth/app-download/file';

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

/** Pure: the server's answer as an offer, or null (anything that is neither a plain https address nor the add-on's own download route offers nothing). */
export function parseOffer(body: unknown): AndroidOffer | null {
  const a = (body as { android?: unknown } | null | undefined)?.android as Record<string, unknown> | null | undefined;
  if (!a || typeof a !== 'object' || typeof a.url !== 'string') return null;
  const bundled = a.bundled === true && a.url === BUNDLED_PATH;
  let u: URL;
  try {
    u = new URL(a.url, bundled ? (typeof document === 'undefined' ? 'https://arx.invalid/' : document.baseURI) : undefined);
  } catch {
    return null;
  }
  if (!u.hostname || u.username || u.password) return null;
  if (!bundled && u.protocol !== 'https:') return null;
  if (bundled && !u.pathname.endsWith('/' + BUNDLED_PATH)) return null;
  const version = typeof a.version === 'string' && VERSION.test(a.version) ? a.version : '';
  const sha256 = typeof a.sha256 === 'string' && SHA.test(a.sha256) ? a.sha256 : '';
  const size = bundled && typeof a.size === 'number' && Number.isInteger(a.size) && a.size > 0 && a.size <= 2 ** 31 ? a.size : 0;
  return { url: u.href, version, sha256, size, bundled };
}

const TEXT = {
  he: { link: 'הורדת אפליקציית Android', version: 'גרסה', sha: 'SHA-256 לאימות' },
  en: { link: 'Download the Android app', version: 'Version', sha: 'SHA-256 to verify' },
} as const;

/** Pure: a file size as megabytes with one decimal ("12.3 MB"), '' for an unknown size. */
export function formatSize(bytes: number): string {
  return bytes > 0 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : '';
}

/** Pure: the offer's strings in Hebrew (the default) or English (a browser that asks for English). */
export function offerText(lang: string | null | undefined): { readonly link: string; readonly version: string; readonly sha: string } {
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
