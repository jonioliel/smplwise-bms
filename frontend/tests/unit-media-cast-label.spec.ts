import { test, expect } from '@playwright/test';
import type { CastCapability } from '../src/api/media-admin';
import { CAST_METHOD_LABEL, CAST_REASON_LABEL, castChip, castSentence } from '../src/screens/media-cast-label';

// CR-028 (prep): the words of the "שידור" marking of הגדרות › מולטימדיה (src/screens/media-cast-label.ts) - the list chip and the form
// sentence for every method x confidence the server can answer. No browser page.

const c = (method: CastCapability['method'], confidence: CastCapability['confidence'], reason: CastCapability['reason'], via: string | null = 'ha:media_player.x'): CastCapability => ({ method, confidence, via, reason });

test.describe('the cast marking', () => {
  test('a confirmed technology is a green chip named after it; likely and unknown say so', () => {
    expect(castChip(c('cast_hls', 'confirmed', 'cast_video'))).toEqual({ kind: 'live', label: 'Google Cast', title: `מאומת · ${CAST_REASON_LABEL.cast_video}` });
    expect(castChip(c('cast_hls', 'likely', 'android_tv_builtin', null))).toMatchObject({ kind: 'neutral', label: 'Google Cast · כנראה' });
    expect(castChip(c('dlna', 'likely', 'dlna_renderer'))).toMatchObject({ kind: 'neutral', label: 'DLNA · כנראה' });
    expect(castChip(c('airplay', 'likely', 'apple_tv'))).toMatchObject({ label: 'AirPlay · כנראה' });
    expect(castChip(c('browser_url', 'unknown', 'samsung_browser'))).toMatchObject({ kind: 'unknown', label: 'דפדפן המסך · לא ידוע' });
  });

  test('no path: "לא נתמך" when the server is sure, "לא ידוע" when it is not; nothing without the field (an older server)', () => {
    expect(castChip(c('none', 'confirmed', 'no_screen', null))).toEqual({ kind: 'neutral', label: 'לא נתמך', title: CAST_REASON_LABEL.no_screen });
    expect(castChip(c('none', 'confirmed', 'cast_audio_only'))).toMatchObject({ label: 'לא נתמך' });
    expect(castChip(c('none', 'unknown', 'no_path', null))).toEqual({ kind: 'unknown', label: 'לא ידוע', title: CAST_REASON_LABEL.no_path });
    expect(castChip(undefined)).toBeNull();
    expect(castChip(null)).toBeNull();
  });

  test('the form sentence names the technology, the confidence, the endpoint and the reason; never a raw code', () => {
    expect(castSentence(c('cast_hls', 'confirmed', 'cast_video', 'ha:media_player.tv_cast'))).toBe(`Google Cast · מאומת · דרך media_player.tv_cast · ${CAST_REASON_LABEL.cast_video}`);
    expect(castSentence(c('cast_hls', 'likely', 'android_tv_builtin', null))).toBe(`Google Cast · כנראה · ${CAST_REASON_LABEL.android_tv_builtin}`);
    expect(castSentence(c('none', 'confirmed', 'kind', null))).toBe(`לא נתמך · ${CAST_REASON_LABEL.kind}`);
    expect(castSentence(c('none', 'unknown', 'no_path', null))).toBe(`לא ידוע · ${CAST_REASON_LABEL.no_path}`);
    expect(castSentence(undefined)).toBe('—');
    for (const r of Object.keys(CAST_REASON_LABEL) as (keyof typeof CAST_REASON_LABEL)[]) expect(castSentence(c('dlna', 'likely', r))).not.toContain(r);
  });

  test('every method has a label and no label names the platform outside its technology', () => {
    for (const m of Object.keys(CAST_METHOD_LABEL) as (keyof typeof CAST_METHOD_LABEL)[]) expect(CAST_METHOD_LABEL[m].length).toBeGreaterThan(0);
    for (const t of Object.values(CAST_REASON_LABEL)) expect(t).not.toMatch(/Home Assistant|Ingress|Supervisor/);
  });
});
