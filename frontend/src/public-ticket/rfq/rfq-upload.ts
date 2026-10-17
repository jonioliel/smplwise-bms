/**
 * RFQ-VENDOR-UPLOAD (owner decision 2026-10-17, contract 19.10): the vendor attaches files and pictures to HIS submitted quote - the
 * card under his quote on the RFQ page. A lazy chunk of its own (`rfq-upload-*`, its own budget): rfq-page.ts fetches it only when the
 * answer carries `uploads` (the installation switch `rfq.vendor_uploads.enabled` is OFF by default - then the server sends null and this
 * file is never loaded).
 *
 * One file at a time (the server allows one upload in flight per link): the picker (several files are sent one after another) or the
 * phone's camera; his files listed with name and size, each removable while the page takes quotes. The picker's checks (kinds, sizes,
 * count, bytes left) are only a courtesy - the server decides by CONTENT (pictures re-encoded, PDF / office structure). Nothing he
 * uploads is ever shown back from the server (there is no public read of a vendor file): the list is text only. The token travels in
 * the header (api.ts rawCall), never in an address; the file's own name is sent as a separate text field and the server cleans it.
 * Text only through dom.ts `h` (text nodes); no link is built.
 */
import { newRequestId, rawCall, type Credentials, type RfqUploads } from '../api';
import { h, icon } from '../dom';
import { sizeText } from './rfq-files';

type Lang = 'he' | 'en' | 'ar' | 'ru';
type W = Record<'title' | 'note' | 'pick' | 'camera' | 'remove' | 'none' | 'sending' | 'limits' | 'type' | 'size' | 'full' | 'failed' | 'closed' | 'busy', string>;

export const WORDS: Record<Lang, W> = {
  he: { title: 'קבצים ותמונות להצעה', note: 'אפשר לצרף להצעה תמונות, מסמכי PDF ועוד. המזמין יראה אותם יחד עם ההצעה.', pick: 'צירוף קובץ', camera: 'צילום',
    remove: 'הסרה', none: 'לא צורפו קבצים.', sending: 'שולח...', limits: 'עד {n} קבצים · {types} · תמונה עד {img}, מסמך עד {doc}',
    type: 'סוג הקובץ אינו נתמך.', size: 'הקובץ גדול מדי.', full: 'הגעתם למספר הקבצים או לנפח המרבי.', failed: 'הקובץ לא נשמר. נסו קובץ אחר או שמרו אותו כ-PDF.',
    closed: 'אי אפשר לצרף קבצים כעת.', busy: 'השרת עמוס. נסו שוב בעוד רגע.' },
  en: { title: 'Files and pictures for your quote', note: 'You can attach pictures, PDF documents and more to your quote. The requester sees them with your quote.',
    pick: 'Attach a file', camera: 'Take a picture', remove: 'Remove', none: 'No files attached.', sending: 'Sending...',
    limits: 'Up to {n} files · {types} · picture up to {img}, document up to {doc}', type: 'This file type is not supported.', size: 'The file is too large.',
    full: 'You reached the maximum number of files or size.', failed: 'The file was not saved. Try another file or save it as PDF.',
    closed: 'Files cannot be attached right now.', busy: 'The server is busy. Try again in a moment.' },
  ar: { title: 'ملفات وصور للعرض', note: 'يمكنكم إرفاق صور ومستندات PDF وغيرها بالعرض. سيراها صاحب الطلب مع العرض.', pick: 'إرفاق ملف', camera: 'تصوير',
    remove: 'إزالة', none: 'لم تُرفق ملفات.', sending: 'جارٍ الإرسال...', limits: 'حتى {n} ملفات · {types} · صورة حتى {img}، مستند حتى {doc}',
    type: 'نوع الملف غير مدعوم.', size: 'الملف كبير جدًا.', full: 'وصلتم إلى الحد الأقصى لعدد الملفات أو حجمها.', failed: 'لم يُحفظ الملف. جربوا ملفًا آخر أو احفظوه بصيغة PDF.',
    closed: 'لا يمكن إرفاق ملفات الآن.', busy: 'الخادم مشغول. حاولوا مرة أخرى بعد لحظة.' },
  ru: { title: 'Файлы и фото к предложению', note: 'К предложению можно приложить фото, документы PDF и другое. Заказчик увидит их вместе с предложением.',
    pick: 'Приложить файл', camera: 'Сфотографировать', remove: 'Удалить', none: 'Файлы не приложены.', sending: 'Отправка...',
    limits: 'До {n} файлов · {types} · фото до {img}, документ до {doc}', type: 'Этот тип файла не поддерживается.', size: 'Файл слишком большой.',
    full: 'Достигнуто максимальное число файлов или объём.', failed: 'Файл не сохранён. Попробуйте другой файл или сохраните его в PDF.',
    closed: 'Сейчас нельзя приложить файлы.', busy: 'Сервер занят. Попробуйте чуть позже.' },
};

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** The kind the picker believes a file is (by its extension; the server decides by content) - null = not offered. */
export function pickedKind(name: string, types: readonly string[]): 'image' | 'doc' | null {
  const ext = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase().replace('jpeg', 'jpg') : '';
  if (!types.includes(ext)) return null;
  return ext === 'jpg' || ext === 'png' ? 'image' : 'doc';
}

/** The refusal code of the server (or of the picker) in the vendor's words. */
export function refusalKey(code: string): keyof W {
  if (code === 'unsupported_format' || code === 'heic_refused' || code === 'office_disabled' || code === 'type') return 'type';
  if (code === 'too_large' || code === 'size') return 'size';
  if (code === 'upload_limit' || code === 'upload_total' || code === 'storage_full') return 'full';
  if (code === 'quote_closed' || code === 'rfq_due_passed' || code === 'read_only' || code === 'code_required') return 'closed';
  if (code === 'busy' || code === 'rate_limited' || code === 'request_in_progress') return 'busy';
  return 'failed';
}

export interface UploadHost {
  uploads: RfqUploads;
  creds: Credentials;
  lang: Lang;
  /** reload the page's answer (the list comes from the server) */
  reload: () => void;
  /** the uniform 404: the link is gone */
  dead: () => void;
}

// the card is rebuilt on every page render: what must survive a render lives here (one page, one vendor)
let busy = false;
let problem: keyof W | null = null;

async function send(host: UploadHost, files: File[]): Promise<void> {
  const u = host.uploads;
  for (const f of files) {
    const kind = pickedKind(f.name, u.limits.types);
    const cap = kind === 'image' ? u.limits.image_bytes : u.limits.document_bytes;
    if (!kind || f.size > cap) {
      problem = kind ? 'size' : 'type';
      continue;
    }
    const form = new FormData();
    form.append('file', f, `upload.${(f.name.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5)}`);
    form.append('quote_id', u.quote_id ?? '');
    form.append('client_request_id', newRequestId());
    form.append('name', f.name.slice(0, 120));
    const r = await rawCall(host.creds, 'POST', '/t/api/rfq/upload', undefined, form);
    if (r.status === 404) return host.dead();
    if (r.status !== 200) {
      problem = refusalKey(String((r.body as { code?: unknown }).code ?? ''));
      break;
    }
  }
}

/** The card (positional arguments: the RFQ page's budget is tight, every byte of its lazy hook counts). */
export function uploadCard(uploads: RfqUploads, creds: Credentials, lang: Lang, reload: () => void, dead: () => void, rerender: () => void): HTMLElement {
  const host: UploadHost = { uploads, creds, lang, reload, dead };
  const w = WORDS[host.lang] ?? WORDS.he;
  const u = host.uploads;
  const l = u.limits;
  const run = async (files: File[]): Promise<void> => {
    if (busy || !files.length) return;
    busy = true;
    problem = null;
    rerender();
    await send(host, files.slice(0, Math.max(0, l.files - u.files.length)));
    busy = false;
    host.reload();
  };
  const input = (camera: boolean) => {
    const i = h('input', { attrs: { type: 'file', hidden: true, multiple: !camera, accept: camera ? 'image/*' : l.types.map((t) => MIME[t] ?? '').join(','),
      capture: camera ? 'environment' : null, disabled: busy, 'data-rfq-upload-input': camera ? 'camera' : 'file' } });
    i.addEventListener('change', () => {
      const files = Array.from(i.files ?? []);
      i.value = '';
      void run(files);
    });
    return h('label', { class: 'swc-btn' }, icon(camera ? 'camera' : 'box'), camera ? w.camera : w.pick, i);
  };
  const remove = async (id: string): Promise<void> => {
    if (busy) return;
    busy = true;
    problem = null;
    rerender();
    const r = await rawCall(host.creds, 'POST', '/t/api/rfq/upload/remove', { file_id: id, client_request_id: newRequestId() });
    busy = false;
    if (r.status === 404) return host.dead();
    if (r.status !== 200) problem = refusalKey(String((r.body as { code?: unknown }).code ?? ''));
    host.reload();
  };
  const list = u.files.map((f) => h('li', { class: 'swc-rev-line', attrs: { 'data-rfq-upload': f.id } },
    h('span', { class: 'swc-rev-what', attrs: { dir: 'auto' } }, f.name), h('small', null, sizeText(f.bytes, host.lang)),
    u.can.remove ? h('button', { class: 'swc-btn', attrs: { type: 'button', disabled: busy, 'data-rfq-upload-remove': f.id }, on: { click: () => void remove(f.id) } }, w.remove) : null));
  const types = l.types.map((t) => t.toUpperCase()).join(', ');
  return h('section', { class: 'swc swq rfq-upload', attrs: { 'data-rfq-uploads': u.files.length } },
    h('header', { class: 'swc-head' }, h('h2', { class: 'swc-title' }, w.title)),
    h('p', { class: 'swc-note' }, w.note),
    list.length ? h('ul', { class: 'swc-rev-lines' }, ...list) : h('p', { class: 'swc-muted' }, w.none),
    problem ? h('div', { class: 'banner bad', attrs: { role: 'alert', 'data-rfq-upload-error': problem } }, w[problem]) : null,
    busy ? h('p', { class: 'swc-muted', attrs: { role: 'status' } }, w.sending) : null,
    u.can.upload ? h('div', { class: 'swc-row swc-actions' }, input(false), input(true)) : null,
    u.can.upload ? h('small', { class: 'swc-muted' }, w.limits.replace('{n}', String(l.files)).replace('{types}', types)
      .replace('{img}', sizeText(l.image_bytes, host.lang)).replace('{doc}', sizeText(l.document_bytes, host.lang))) : null);
}
