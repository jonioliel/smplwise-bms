/**
 * ANNOUNCE-295 (stage A, speakers only): the pure logic behind the announce screen (#/devices/announce) and the templates editor in Settings.
 * No DOM and no network: unit specs run it in Node. The server validates everything again; this only decides what the screens offer.
 */
import { ANNOUNCE_LANGS, ANNOUNCE_SCREEN_RANGE, type AnnounceLang, type AnnounceScreenOption, type AnnounceScreenTarget, type AnnounceTemplate, type AnnounceTemplateKind } from '../api/announcements';

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

// ---------------------------------------------------------------- ANNOUNCEB-295: the screens (stage B)

/** The allowed screens as the server stores them: key, room and linked media screen (nothing else). */
export function screenTargets(options: AnnounceScreenOption[]): AnnounceScreenTarget[] {
  return options.filter((o) => o.allowed).map((o) => ({ key: o.key, area_id: o.area_id || null, device_key: o.device_key || null }));
}

/** One screen changed in the Settings list: allowed on / off, its room, its linked media screen. */
export function patchScreen(options: AnnounceScreenOption[], key: string, patch: Partial<Pick<AnnounceScreenOption, 'allowed' | 'area_id' | 'device_key'>>): AnnounceScreenOption[] {
  return options.map((o) => (o.key === key ? { ...o, ...patch } : o));
}

export type ScreenNumberField = keyof typeof ANNOUNCE_SCREEN_RANGE;

/** A typed number kept inside what the server accepts (it checks again); '' or garbage gives null = leave the field as it was. */
export function clampScreenNumber(field: ScreenNumberField, raw: string): number | null {
  const v = Number(raw.trim());
  if (raw.trim() === '' || !Number.isFinite(v)) return null;
  const [lo, hi] = ANNOUNCE_SCREEN_RANGE[field];
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Where the operator form sends: the body flags for the chosen channels. Without screens on offer it is the stage A body (no flags added). */
export function channelFlags(speakers: boolean, screens: boolean, screensOffered: boolean): { speakers?: boolean; screens?: boolean } {
  if (!screensOffered) return {};
  return { ...(speakers ? {} : { speakers: false }), screens };
}

/** The send button works with at least one channel chosen. */
export const hasChannel = (speakers: boolean, screens: boolean, screensOffered: boolean): boolean => speakers || (screensOffered && screens);

// ---------------------------------------------------------------- ANNOUNCE-297: the automatic translation (stage C)

/** The languages whose text came from the automatic translation; a language leaves the set when its text is emptied. */
export type MachineSet = ReadonlySet<AnnounceLang>;

/** The translate button is offered while the server says translation is ready and there is a Hebrew text to translate. */
export function canTranslate(enabled: boolean | undefined, texts: Texts): boolean {
  const he = (texts.he ?? '').trim();
  return !!enabled && he !== '' && he.length <= TEXT_MAX;
}

/** The draft translations fill the text of their languages (selected for the sender, in the canonical order) and are marked machine-translated.
 * The Hebrew text is kept; a language the server did not return keeps what was typed. Nothing is sent: the sender reviews and edits first. */
export function applyTranslation(texts: Texts, selected: AnnounceLang[], machine: MachineSet, items: { language: AnnounceLang; text: string }[]):
  { texts: Texts; selected: AnnounceLang[]; machine: Set<AnnounceLang> } {
  const out: Texts = { ...texts };
  const mt = new Set(machine);
  const langs = new Set<AnnounceLang>(selected);
  for (const it of items) {
    if (it.language === 'he' || !ANNOUNCE_LANGS.includes(it.language) || !it.text) continue;
    out[it.language] = it.text.slice(0, TEXT_MAX);
    mt.add(it.language);
    langs.add(it.language);
  }
  return { texts: out, selected: ANNOUNCE_LANGS.filter((l) => langs.has(l)), machine: mt };
}

/** A machine-translated text the sender edits stays marked (it still came from the translation); emptied, the mark goes. */
export function editedMachine(machine: MachineSet, l: AnnounceLang, value: string): Set<AnnounceLang> {
  const mt = new Set(machine);
  if (!value.trim()) mt.delete(l);
  return mt;
}

/** The machine-translated languages that will actually be sent (selected, with a text). */
export function sentMachine(texts: Texts, selected: AnnounceLang[], machine: MachineSet): AnnounceLang[] {
  return partsOf(texts, selected).map((p) => p.language).filter((l) => l !== 'he' && machine.has(l));
}

/** The parts with the machine mark, as `POST /announcements` takes them. */
export function partsWithMachine(texts: Texts, selected: AnnounceLang[], machine: MachineSet): { language: AnnounceLang; text: string; machine?: boolean }[] {
  return partsOf(texts, selected).map((p) => (p.language !== 'he' && machine.has(p.language) ? { ...p, machine: true } : p));
}

/** A machine-translated part is never sent unseen: while any is in the announcement, the sender ticks "I reviewed the translation" first. */
export function reviewOk(texts: Texts, selected: AnnounceLang[], machine: MachineSet, reviewed: boolean): boolean {
  return reviewed || sentMachine(texts, selected, machine).length === 0;
}
