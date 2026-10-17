/**
 * RFQATT (contract 19.4 / 19.6): the files a manager attached to a request for quotation, as the vendor sees them - on the RFQ page
 * (his personal RFQ link) and, after a work order, on the service request's handler page (the same files, referenced). A lazy chunk
 * of its own (`rfq-files-*`, counted in the RFQ page's budget): the ticket page fetches it only when its answer lists such files.
 *
 * Pictures: thumbnails in a row (the server's 480 px re-encoded JPEG), a tap opens the picture in a native <dialog> lightbox with its
 * caption. Documents (PDF / Word / Excel): one button each that DOWNLOADS the file - never opened, previewed or rendered by this page.
 * Every file is fetched with the link's token in the header (never in an address), shown through a blob: URL (the CSP allows `img-src
 * 'self' blob:` only), and a document is handed to the browser as `application/octet-stream`, so nothing can render it inline.
 *
 * W20 exception, reviewed and limited to `save()` below: ONE anchor element is created to hand a downloaded blob to the browser's
 * save dialog (`download` + a `blob:` address of OUR fetch), never attached to the page, never built from typed text, revoked at once.
 * Text only through dom.ts `h` (text nodes).
 */
import { withBase } from '../base';
import { h, icon, img } from '../dom';

export type FileKind = 'image' | 'pdf' | 'docx' | 'xlsx';
export interface PubFile { id: string; name: string; caption?: string; kind: FileKind; bytes: number; thumb?: boolean }
export interface FilesCreds { token: string | null; session: string | null }
type Lang = 'he' | 'en' | 'ar' | 'ru';

const WORDS: Record<Lang, Record<'files' | 'open' | 'download' | 'close' | 'failed', string>> = {
  he: { files: 'קבצים מצורפים', open: 'הצגת התמונה', download: 'הורדה', close: 'סגירה', failed: 'לא ניתן להוריד את הקובץ כרגע. נסו שוב.' },
  en: { files: 'Attached files', open: 'Show the picture', download: 'Download', close: 'Close', failed: 'The file cannot be downloaded right now. Try again.' },
  ar: { files: 'ملفات مرفقة', open: 'عرض الصورة', download: 'تنزيل', close: 'إغلاق', failed: 'تعذّر تنزيل الملف الآن. حاولوا مرة أخرى.' },
  ru: { files: 'Вложенные файлы', open: 'Показать фото', download: 'Скачать', close: 'Закрыть', failed: 'Сейчас не удалось скачать файл. Попробуйте ещё раз.' },
};

/** "980 KB" / "1.2 MB" in the page's language (units only - the numbers stay Western digits like the rest of the page). */
export function sizeText(n: number, lang: Lang): string {
  const mb = n >= 1024 * 1024;
  const v = mb ? n / (1024 * 1024) : Math.max(1, Math.round(n / 1024));
  const num = mb ? (v < 10 ? v.toFixed(1).replace(/\.0$/, '') : String(Math.round(v))) : String(v);
  const unit = { he: mb ? 'מ״ב' : 'ק״ב', en: mb ? 'MB' : 'KB', ar: mb ? 'م.ب' : 'ك.ب', ru: mb ? 'МБ' : 'КБ' }[lang];
  return `${num} ${unit}`;
}

/** The route of one file: on the vendor's RFQ link, or (a work order) on the service request's handler link. */
export function fileRoute(route: 'rfq' | 'ticket', id: string, thumb = false): string {
  return `${route === 'rfq' ? '/t/api/rfq/file/' : '/t/api/ticket/rfq-file/'}${encodeURIComponent(id)}${thumb ? '/thumb' : ''}`;
}

async function fetchBlob(c: FilesCreds, route: string): Promise<Blob | null> {
  try {
    const res = await fetch(withBase(route), {
      headers: { 'X-Ticket-Token': c.token ?? '', ...(c.session ? { 'X-Ticket-Session': c.session } : {}) },
      credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/** Hand a downloaded document to the browser's save dialog (the W20 exception of the module docstring). */
function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.download = name;
  a.href = url;
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function lightbox(url: string, f: PubFile, w: Record<string, string>): void {
  const dlg = h('dialog', { class: 'card lightbox', attrs: { 'aria-label': f.name, 'data-rfq-lightbox': true } },
    img(url, f.caption || f.name, 'lb-img'),
    f.caption ? h('p', { class: 'msg-body', attrs: { dir: 'auto' } }, f.caption) : null,
    h('button', { class: 'btn ghost block', attrs: { type: 'button', 'data-rfq-lightbox-close': true }, on: { click: () => dlg.close() } }, w.close));
  dlg.addEventListener('close', () => {
    URL.revokeObjectURL(url);
    dlg.remove();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  document.body.appendChild(dlg);
  dlg.showModal();
}

/**
 * The card: the pictures as thumbnails, the documents as download buttons; a failed fetch says so inside the card. Thumbnails load
 * after the card is on the page (one request each; the photo-read window allows far more than ten files).
 */
export function filesCard(files: readonly PubFile[], creds: FilesCreds, route: 'rfq' | 'ticket', lang: Lang): HTMLElement {
  const w = WORDS[lang] ?? WORDS.he;
  const err = h('div', { class: 'banner bad', attrs: { role: 'alert', hidden: true, 'data-rfq-file-error': true } }, w.failed);
  const onError = (): void => {
    err.hidden = false;
  };
  const pics = files.filter((f) => f.kind === 'image');
  const docs = files.filter((f) => f.kind !== 'image');
  const row = h('div', { class: 'photos' });
  for (const f of pics) {
    const b = h('button', { class: 'thumb empty', attrs: { type: 'button', 'aria-label': `${w.open}: ${f.name}`, 'data-rfq-pic': f.id } }, icon('image'));
    b.addEventListener('click', async () => {
      const blob = await fetchBlob(creds, fileRoute(route, f.id));
      if (blob) lightbox(URL.createObjectURL(blob), f, w);
      else onError();
    });
    if (f.thumb) {
      void fetchBlob(creds, fileRoute(route, f.id, true)).then((blob) => {
        if (blob) b.replaceChildren(img(URL.createObjectURL(blob), f.caption || f.name, 'thumb'));
      });
    }
    row.appendChild(b);
  }
  const list = docs.map((f) => h('button', { class: 'btn ghost block rfq-doc', attrs: { type: 'button', 'data-rfq-doc': f.id }, on: { click: async () => {
    const blob = await fetchBlob(creds, fileRoute(route, f.id));
    if (blob) save(blob, f.name);
    else onError();
  } } }, icon('out'), h('span', { attrs: { dir: 'auto' } }, f.name), h('small', null, `${sizeText(f.bytes, lang)} · ${w.download}`)));
  const captions = files.filter((f) => f.caption).map((f) => h('li', { attrs: { dir: 'auto' } }, `${f.name}: ${f.caption}`));
  return h('section', { class: 'card rfq-files', attrs: { 'data-rfq-files': true } }, h('h2', null, w.files),
    pics.length ? row : null,
    captions.length ? h('ul', null, ...captions) : null,
    ...list, err);
}
