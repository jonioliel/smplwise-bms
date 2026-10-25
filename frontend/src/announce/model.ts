/**
 * ANNOUNCE-295 (stage A, speakers only): the pure logic behind the announce screen (#/devices/announce) and the templates editor in Settings.
 * No DOM and no network: unit specs run it in Node. The server validates everything again; this only decides what the screens offer.
 */
import { ANNOUNCE_LANGS, type AnnounceLang, type AnnounceTemplate, type AnnounceTemplateKind } from '../api/announcements';

export const TEXT_MAX = 200;
export const NAME_MAX = 60;
export const TEMPLATES_MAX = 30;
export const ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
/** The scope value of the whole building (every allowed speaker). */
export const ALL_ROOMS = '*';

export type UiLang = 'he' | 'en' | 'ar' | 'ru';

/** The spoken language that goes with the screen language: Arabic is screen text only, so an Arabic screen announces in Hebrew by default. */
export function spokenLangOf(ui: UiLang): AnnounceLang {
  return ui === 'en' ? 'en' : ui === 'ru' ? 'ru' : 'he';
}

export function templateName(t: AnnounceTemplate, lang: UiLang): string {
  return t.name[spokenLangOf(lang)] || t.name.he || t.id;
}

/** The languages a template has a text for, in the canonical order. */
export function languagesOf(t: AnnounceTemplate): AnnounceLang[] {
  return ANNOUNCE_LANGS.filter((l) => !!t.text[l]);
}

export const routineTemplates = (list: AnnounceTemplate[]): AnnounceTemplate[] => list.filter((t) => t.kind === 'routine');
export const emergencyTemplates = (list: AnnounceTemplate[]): AnnounceTemplate[] => list.filter((t) => t.kind === 'emergency');

export type Texts = Partial<Record<AnnounceLang, string>>;

/** Picking a template fills the text of every selected language it has (a language it lacks keeps what is typed). */
export function applyTemplate(current: Texts, t: AnnounceTemplate, selected: AnnounceLang[]): Texts {
  const out: Texts = { ...current };
  for (const l of selected) if (t.text[l]) out[l] = t.text[l];
  return out;
}

/** The (language, text) parts to send: the selected languages in the canonical order with a non-empty text, each cut to the limit. */
export function partsOf(texts: Texts, selected: AnnounceLang[]): { language: AnnounceLang; text: string }[] {
  return ANNOUNCE_LANGS.filter((l) => selected.includes(l))
    .map((l) => ({ language: l, text: (texts[l] ?? '').trim() }))
    .filter((p) => p.text !== '' && p.text.length <= TEXT_MAX);
}

/** Send is possible with a room, at least one language, and every selected language holding a text within the limit. */
export function canSend(room: string, texts: Texts, selected: AnnounceLang[]): boolean {
  if (!room || selected.length === 0) return false;
  return selected.every((l) => {
    const t = (texts[l] ?? '').trim();
    return t !== '' && t.length <= TEXT_MAX;
  });
}

/** Toggle a language in the selection, keeping the canonical order and never leaving the selection empty. */
export function toggleLang(selected: AnnounceLang[], l: AnnounceLang, on: boolean): AnnounceLang[] {
  const next = ANNOUNCE_LANGS.filter((x) => (x === l ? on : selected.includes(x)));
  return next.length ? next : selected;
}

// ---------------------------------------------------------------- the templates editor

export function blankTemplate(existing: AnnounceTemplate[], kind: AnnounceTemplateKind = 'routine'): AnnounceTemplate {
  let n = existing.length + 1;
  const ids = new Set(existing.map((t) => t.id));
  while (ids.has(`template_${n}`)) n += 1;
  return { id: `template_${n}`, kind, name: { he: '' }, text: { he: '' } };
}

export function setField(list: AnnounceTemplate[], id: string, field: 'name' | 'text', lang: AnnounceLang, value: string): AnnounceTemplate[] {
  return list.map((t) => {
    if (t.id !== id) return t;
    const next = { ...t[field] };
    if (value === '') delete next[lang];
    else next[lang] = value;
    return { ...t, [field]: next };
  });
}

export const setKind = (list: AnnounceTemplate[], id: string, kind: AnnounceTemplateKind): AnnounceTemplate[] => list.map((t) => (t.id === id ? { ...t, kind } : t));
export const removeTemplate = (list: AnnounceTemplate[], id: string): AnnounceTemplate[] => list.filter((t) => t.id !== id);

/** The first reason a list cannot be saved (the server checks the same), or '' when it can. */
export function templatesProblem(list: AnnounceTemplate[]): '' | 'count' | 'id' | 'he' | 'length' {
  if (list.length > TEMPLATES_MAX) return 'count';
  const seen = new Set<string>();
  for (const t of list) {
    if (!ID_RE.test(t.id) || seen.has(t.id)) return 'id';
    seen.add(t.id);
    if (!(t.name.he ?? '').trim() || !(t.text.he ?? '').trim()) return 'he';
    for (const l of ANNOUNCE_LANGS) {
      if ((t.name[l] ?? '').length > NAME_MAX || (t.text[l] ?? '').length > TEXT_MAX) return 'length';
    }
  }
  return '';
}

/** The list as it is sent: trimmed, empty language entries dropped. */
export function cleanTemplates(list: AnnounceTemplate[]): AnnounceTemplate[] {
  return list.map((t) => ({
    id: t.id,
    kind: t.kind,
    name: Object.fromEntries(ANNOUNCE_LANGS.filter((l) => (t.name[l] ?? '').trim()).map((l) => [l, (t.name[l] as string).trim()])),
    text: Object.fromEntries(ANNOUNCE_LANGS.filter((l) => (t.text[l] ?? '').trim()).map((l) => [l, (t.text[l] as string).trim()])),
  }));
}
