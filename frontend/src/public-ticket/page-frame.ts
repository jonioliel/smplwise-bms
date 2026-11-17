/**
 * CR-PUBLIC-FRAME-2440 (review 08:F16) - the frame the public pages share: the theme toggle, the language picker, the message screen
 * (lock / clock / done), the banner and the code gate's card. The ticket page (main.ts) and the request-for-quotation page
 * (rfq/rfq-page.ts) each built these themselves, line for line; both call the builders here now and the DOM they get is the one each
 * built before (same elements, classes, attributes in the same order, text nodes).
 *
 * The public bundle's rules hold here as everywhere in this folder: DOM only through dom.ts `h` (text nodes - no innerHTML, no
 * inline style), no link is ever built, nothing is imported from the app. The builders keep no state: a page hands in its values and
 * what to do on a press, and stays the owner of its language, theme, code session and requests.
 */
import { h, icon } from './dom';
import { LANG_SELF, isLang, LANGS, type Lang } from './strings';
import { nextChoice, prefersDark, saveChoice, type ThemeChoice, type ThemeMode } from './theme';

/** A page's own text function (each page reads its own catalogues behind it). */
export type FrameText = (key: string, vars?: Record<string, string | number>) => string;

/** TK259: one tap flips light / dark and is remembered in this browser (theme.ts). `onChoice` gets the saved choice: the page keeps
 * it, applies it and paints again. */
export function themeToggle(theme: ThemeMode, t: FrameText, onChoice: (choice: ThemeChoice) => void): HTMLElement {
  const dark = theme === 'dark' || (theme === 'auto' && prefersDark());
  return h('button', { class: 'icon-btn', attrs: { type: 'button', 'data-theme-toggle': dark ? 'dark' : 'light', 'aria-label': t(dark ? 'themeToLight' : 'themeToDark') },
    on: { click: () => { const c = nextChoice(theme, prefersDark()); saveChoice(c); onChoice(c); } } }, icon(dark ? 'sun' : 'moon'));
}

/** The language select: every language by its own name; `onPick` gets a language of the page only. */
export function langPicker(lang: Lang, t: FrameText, onPick: (lang: Lang) => void): HTMLElement {
  const sel = h('select', { class: 'lang', attrs: { 'aria-label': t('language'), 'data-lang-picker': true },
    on: { change: (e) => { const value = (e.target as HTMLSelectElement).value; if (isLang(value)) onPick(value); } } });
  for (const l of LANGS) sel.appendChild(h('option', { attrs: { value: l, selected: l === lang, lang: l } }, LANG_SELF[l].langName));
  return sel;
}

/** A page that shows one centred card (loading, a message): `pageClass` is the page's own class list, `head` its header or null. */
export function centerScreen(pageClass: string, head: HTMLElement | null, content: (Node | null)[]): HTMLElement {
  return h('div', { class: pageClass }, head, h('main', { class: 'center' }, h('section', { class: 'card msg' }, ...content)));
}

/** The content of a message card: the icon, the title (its key is the hook the tests read), the body and - when `onRetry` is given -
 * the retry button. */
export function messageContent(t: FrameText, title: string, bodyKey: string, ic: string, onRetry: (() => void) | null): (Node | null)[] {
  return [
    h('div', { class: 'msg-icon' }, icon(ic)),
    h('h1', { class: 'msg-title', attrs: { 'data-state-title': title } }, t(title)),
    h('p', { class: 'msg-body' }, t(bodyKey)),
    onRetry ? h('button', { class: 'btn block', attrs: { type: 'button' }, on: { click: onRetry } }, t('retry')) : null,
  ];
}

export interface FrameBanner { key: string; tone: 'ok' | 'bad' | 'info'; n?: number }

/** The page's one banner (a bad one is an alert, the others a status), or null when there is none. */
export function bannerEl(b: FrameBanner | null, t: FrameText): HTMLElement | null {
  if (!b) return null;
  return h('div', { class: `banner ${b.tone}`, attrs: { role: b.tone === 'bad' ? 'alert' : 'status', 'data-banner': b.key } }, t(b.key, { n: b.n ?? '' }));
}

export interface CodeCard {
  t: FrameText;
  /** the page's code state: `value` is written back on every keystroke */
  code: { sent: boolean; value: string; message: null | { key: string; n?: number } };
  busy: boolean;
  /** the line under the body that says which item this is (the page builds it: a number, or a reference), or null */
  sub: HTMLElement | null;
  onSend: () => void;
  onVerify: () => void;
}

/** The code gate's card: the lock, the words, the page's own line, the last message, the input with "verify" once a code was sent,
 * and send / send again. */
export function codeCard(o: CodeCard): HTMLElement {
  const { t, code } = o;
  const m = code.message;
  const input = h('input', { class: 'input code', attrs: { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 9, 'aria-label': t('codeInput'),
    'data-code-input': true, dir: 'ltr' }, on: { input: (e) => { code.value = (e.target as HTMLInputElement).value; } } });
  input.value = code.value;
  return h('section', { class: 'card code' },
    h('div', { class: 'msg-icon' }, icon('lock')),
    h('h1', { class: 'msg-title' }, t('codeTitle')),
    h('p', { class: 'msg-body' }, t('codeBody')),
    o.sub,
    m ? h('div', { class: `banner ${m.key.startsWith('codeSent') ? 'ok' : 'bad'}`, attrs: { role: 'status', 'data-code-message': m.key } }, t(m.key, { n: m.n ?? '' })) : null,
    code.sent ? h('div', { class: 'row' }, input,
      h('button', { class: 'btn primary', attrs: { type: 'button', disabled: o.busy, 'data-code-verify': true }, on: { click: o.onVerify } }, t('codeVerify'))) : null,
    h('button', { class: `btn ${code.sent ? 'ghost' : 'primary'} block`, attrs: { type: 'button', disabled: o.busy, 'data-code-send': true },
      on: { click: o.onSend } }, t(code.sent ? 'codeResend' : 'codeSend')));
}
