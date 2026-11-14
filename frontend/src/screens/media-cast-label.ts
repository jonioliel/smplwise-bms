/**
 * CR-028 (prep): the words of the "שידור" marking in הגדרות › מולטימדיה - what a device's `cast` capability (api/media-admin.ts `CastCapability`,
 * computed server-side from the registry data already mirrored) reads as: a short chip for the list row and a sentence for the open form.
 * Pure (no DOM, no Lit); unit-tested by tests/unit-media-cast-label.spec.ts. Settings screens may name the technology and the integration
 * (docs/design/UI_COPY_RULES.md); nothing here is shown on an operator screen.
 */
import type { CastCapability, CastConfidence, CastMethod, CastReason } from '../api/media-admin';
import { tr } from '../i18n/msg/media';

export const CAST_METHOD_LABEL: Record<CastMethod, string> = { cast_hls: 'Google Cast', dlna: 'DLNA', airplay: 'AirPlay', browser_url: tr('דפדפן המסך'), none: tr('ללא') };
export const CAST_CONFIDENCE_LABEL: Record<CastConfidence, string> = { confirmed: tr('מאומת'), likely: tr('כנראה'), unknown: tr('לא ידוע') };
/** Why the server decided what it decided (settings screens keep the exact technical names). */
export const CAST_REASON_LABEL: Record<CastReason, string> = {
  cast_video: tr('מקלט Cast לווידאו (Chromecast / Google TV / Nest Hub או מסך עם Cast מובנה)'),
  cast_screen: tr('מקלט Cast על מסך; הדגם לא מזוהה כמקלט של Google'),
  cast_unknown_model: tr('מקלט Cast בדגם לא מזוהה; לא כל מקלט Cast מציג תמונה'),
  cast_audio_only: tr('מקלט Cast לשמע בלבד (רמקול או קבוצת רמקולים)'),
  android_tv_builtin: tr('Android TV: מקלט Cast מובנה; האינטגרציה Google Cast לא מחוברת למסך הזה'),
  apple_tv: tr('Apple TV: AirPlay דרך האינטגרציה apple_tv; לא נבדק בפועל'),
  dlna_renderer: tr('מקלט DLNA שמדווח על ניגון מדיה; ייבדק בפועל לפני הפעלה'),
  dlna_unavailable: tr('מקלט DLNA שאינו זמין כרגע; היכולת תתברר כשיתחבר'),
  samsung_browser: tr('Samsung: פתיחת דף בדפדפן המסך אפשרית בתיאוריה; לא נבדק'),
  no_screen: tr('רמקול ללא מסך'),
  no_path: tr('לא נמצאה דרך ידועה לשדר למסך הזה'),
  kind: tr('סוג ההתקן אינו מציג תמונה'),
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
      ? { kind: 'neutral', label: tr('לא נתמך'), title: reason }
      : { kind: 'unknown', label: tr('לא ידוע'), title: reason };
  }
  const label = CAST_METHOD_LABEL[c.method] ?? c.method;
  if (c.confidence === 'confirmed') return { kind: 'live', label, title: `${CAST_CONFIDENCE_LABEL.confirmed} · ${reason}` };
  if (c.confidence === 'likely') return { kind: 'neutral', label: tr('{label} · כנראה', { label }), title: `${CAST_CONFIDENCE_LABEL.likely} · ${reason}` };
  return { kind: 'unknown', label: tr('{label} · לא ידוע', { label }), title: `${CAST_CONFIDENCE_LABEL.unknown} · ${reason}` };
}

/** The sentence of the open form: the technology, the confidence, the endpoint that would answer and the reason. */
export function castSentence(c: CastCapability | undefined | null): string {
  if (!c) return '—';
  const via = c.via ? tr(' · דרך {via}', { via: c.via.replace(/^ha:/, '') }) : '';
  const reason = CAST_REASON_LABEL[c.reason] ?? c.reason;
  if (c.method === 'none') return `${c.confidence === 'confirmed' ? tr('לא נתמך') : tr('לא ידוע')} · ${reason}`;
  return `${CAST_METHOD_LABEL[c.method] ?? c.method} · ${CAST_CONFIDENCE_LABEL[c.confidence]}${via} · ${reason}`;
}
