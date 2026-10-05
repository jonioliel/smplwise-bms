/**
 * CR-028 (prep): the words of the "שידור" marking in הגדרות › מולטימדיה - what a device's `cast` capability (api/media-admin.ts `CastCapability`,
 * computed server-side from the registry data already mirrored) reads as: a short chip for the list row and a sentence for the open form.
 * Pure (no DOM, no Lit); unit-tested by tests/unit-media-cast-label.spec.ts. Settings screens may name the technology and the integration
 * (docs/design/UI_COPY_RULES.md); nothing here is shown on an operator screen.
 */
import type { CastCapability, CastConfidence, CastMethod, CastReason } from '../api/media-admin';

export const CAST_METHOD_LABEL: Record<CastMethod, string> = { cast_hls: 'Google Cast', dlna: 'DLNA', airplay: 'AirPlay', browser_url: 'דפדפן המסך', none: 'ללא' };
export const CAST_CONFIDENCE_LABEL: Record<CastConfidence, string> = { confirmed: 'מאומת', likely: 'כנראה', unknown: 'לא ידוע' };
/** Why the server decided what it decided (settings screens keep the exact technical names). */
export const CAST_REASON_LABEL: Record<CastReason, string> = {
  cast_video: 'מקלט Cast לווידאו (Chromecast / Google TV / Nest Hub או מסך עם Cast מובנה)',
  cast_screen: 'מקלט Cast על מסך; הדגם לא מזוהה כמקלט של Google',
  cast_unknown_model: 'מקלט Cast בדגם לא מזוהה; לא כל מקלט Cast מציג תמונה',
  cast_audio_only: 'מקלט Cast לשמע בלבד (רמקול או קבוצת רמקולים)',
  android_tv_builtin: 'Android TV: מקלט Cast מובנה; האינטגרציה Google Cast לא מחוברת למסך הזה',
  apple_tv: 'Apple TV: AirPlay דרך האינטגרציה apple_tv; לא נבדק בפועל',
  dlna_renderer: 'מקלט DLNA שמדווח על ניגון מדיה; ייבדק בפועל לפני הפעלה',
  dlna_unavailable: 'מקלט DLNA שאינו זמין כרגע; היכולת תתברר כשיתחבר',
  samsung_browser: 'Samsung: פתיחת דף בדפדפן המסך אפשרית בתיאוריה; לא נבדק',
  no_screen: 'רמקול ללא מסך',
  no_path: 'לא נמצאה דרך ידועה לשדר למסך הזה',
  kind: 'סוג ההתקן אינו מציג תמונה',
};

export interface CastChip {
  /** The sw-badge kind. */
  kind: 'live' | 'neutral' | 'unknown';
  label: string;
  /** The tooltip: the confidence and the reason. */
  title: string;
}

/** The chip of a list row: the technology by name when one is known, "לא ידוע" / "לא נתמך" otherwise; the confidence colours it. */
export function castChip(c: CastCapability | undefined | null): CastChip | null {
  if (!c) return null;
  const reason = CAST_REASON_LABEL[c.reason] ?? c.reason;
  if (c.method === 'none') {
    return c.confidence === 'confirmed'
      ? { kind: 'neutral', label: 'לא נתמך', title: reason }
      : { kind: 'unknown', label: 'לא ידוע', title: reason };
  }
  const label = CAST_METHOD_LABEL[c.method] ?? c.method;
  if (c.confidence === 'confirmed') return { kind: 'live', label, title: `${CAST_CONFIDENCE_LABEL.confirmed} · ${reason}` };
  if (c.confidence === 'likely') return { kind: 'neutral', label: `${label} · כנראה`, title: `${CAST_CONFIDENCE_LABEL.likely} · ${reason}` };
  return { kind: 'unknown', label: `${label} · לא ידוע`, title: `${CAST_CONFIDENCE_LABEL.unknown} · ${reason}` };
}

/** The sentence of the open form: the technology, the confidence, the endpoint that would answer and the reason. */
export function castSentence(c: CastCapability | undefined | null): string {
  if (!c) return '—';
  const via = c.via ? ` · דרך ${c.via.replace(/^ha:/, '')}` : '';
  const reason = CAST_REASON_LABEL[c.reason] ?? c.reason;
  if (c.method === 'none') return `${c.confidence === 'confirmed' ? 'לא נתמך' : 'לא ידוע'} · ${reason}`;
  return `${CAST_METHOD_LABEL[c.method] ?? c.method} · ${CAST_CONFIDENCE_LABEL[c.confidence]}${via} · ${reason}`;
}
