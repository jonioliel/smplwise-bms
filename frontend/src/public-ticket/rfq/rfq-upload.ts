/**
 * RFQ-VENDOR-UPLOAD (owner decisions 2026-10-17, contract 19.10): the vendor attaches files and pictures to HIS submitted quote, or -
 * with or without a quote - sends a QUESTION with files. The card on the RFQ page. A lazy chunk of its own (`rfq-upload-*`, its own
 * budget): rfq-page.ts fetches it only when the answer carries `uploads` (the installation switch `rfq.vendor_uploads.enabled` is OFF by
 * default - then the server sends null and this file is never loaded). All the UI of this feature lives here: the RFQ page itself has
 * only the lazy hook (its budget is tight).
 *
 * One file at a time (the server allows one upload in flight per link): the picker (several files are sent one after another) or the
 * phone's camera; his files listed with name and size, each removable while the page takes quotes. A question with files: the
 * question is sent first (the existing message route), then each file is bound to it (`message_id`). The picker's checks (kinds, sizes
 * by the administrator's limits) are only a courtesy - the server decides by CONTENT. Nothing he uploads is ever shown back from the
 * server (there is no public read of a vendor file): the list is text only. The token travels in the header (api.ts rawCall), never
 * in an address; the file's own name is sent as a separate text field and the server cleans it. Text only through dom.ts `h`.
 */
import { newRequestId, rawCall, type Credentials, type RfqUploads } from '../api';
import { h, icon } from '../dom';
import { sizeText } from './rfq-files';

type Lang = 'he' | 'en' | 'ar' | 'ru';
type W = Record<'title' | 'note' | 'pick' | 'camera' | 'remove' | 'none' | 'sending' | 'limits' | 'type' | 'size' | 'full' | 'failed' | 'closed' | 'busy'
  | 'qTitle' | 'qHint' | 'qSend' | 'qOn' | 'qEmpty', string>;

export const WORDS: Record<Lang, W> = {
  he: { title: 'קבצים ותמונות', note: 'אפשר לצרף להצעה תמונות, מסמכי PDF ועוד. המזמין יראה אותם יחד עם ההצעה.', pick: 'צירוף קובץ', camera: 'צילום',
    remove: 'הסרה', none: 'לא צורפו קבצים.', sending: 'שולח...', limits: 'עד {n} קבצים · {types} · תמונה עד {img}, מסמך עד {doc}',
    type: 'סוג הקובץ אינו נתמך.', size: 'הקובץ גדול מדי.', full: 'הגעתם למספר הקבצים או לנפח המרבי.', failed: 'הקובץ לא נשמר. נסו קובץ אחר או שמרו אותו כ-PDF.',
    closed: 'אי אפשר לצרף קבצים כעת.', busy: 'השרת עמוס. נסו שוב בעוד רגע.',
    qTitle: 'שאלה עם קבצים', qHint: 'כתבו את השאלה ובחרו קבצים', qSend: 'שליחת השאלה והקבצים', qOn: 'לשאלה', qEmpty: 'כתבו שאלה ובחרו לפחות קובץ אחד.' },
  en: { title: 'Files and pictures', note: 'You can attach pictures, PDF documents and more to your quote. The requester sees them with your quote.',
    pick: 'Attach a file', camera: 'Take a picture', remove: 'Remove', none: 'No files attached.', sending: 'Sending...',
    limits: 'Up to {n} files · {types} · picture up to {img}, document up to {doc}', type: 'This file type is not supported.', size: 'The file is too large.',
    full: 'You reached the maximum number of files or size.', failed: 'The file was not saved. Try another file or save it as PDF.',
    closed: 'Files cannot be attached right now.', busy: 'The server is busy. Try again in a moment.',
    qTitle: 'A question with files', qHint: 'Write your question and pick files', qSend: 'Send the question and files', qOn: 'question',
    qEmpty: 'Write a question and pick at least one file.' },
  // Arabic - initial, needs native review
  ar: { title: 'ملفات وصور', note: 'يمكنكم إرفاق صور ومستندات PDF وغيرها بالعرض. سيراها صاحب الطلب مع العرض.', pick: 'إرفاق ملف', camera: 'تصوير',
    remove: 'إزالة', none: 'لم تُرفق ملفات.', sending: 'جارٍ الإرسال...', limits: 'حتى {n} ملفات · {types} · صورة حتى {img}، مستند حتى {doc}',
    type: 'نوع الملف غير مدعوم.', size: 'الملف كبير جدًا.', full: 'وصلتم إلى الحد الأقصى لعدد الملفات أو حجمها.', failed: 'لم يُحفظ الملف. جربوا ملفًا آخر أو احفظوه بصيغة PDF.',
    closed: 'لا يمكن إرفاق ملفات الآن.', busy: 'الخادم مشغول. حاولوا مرة أخرى بعد لحظة.',
    qTitle: 'سؤال مع ملفات', qHint: 'اكتبوا السؤال واختاروا الملفات', qSend: 'إرسال السؤال والملفات', qOn: 'للسؤال', qEmpty: 'اكتبوا سؤالاً واختاروا ملفًا واحدًا على الأقل.' },
  // Russian - initial, needs native review
  ru: { title: 'Файлы и фото', note: 'К предложению можно приложить фото, документы PDF и другое. Заказчик увидит их вместе с предложением.',
    pick: 'Приложить файл', camera: 'Сфотографировать', remove: 'Удалить', none: 'Файлы не приложены.', sending: 'Отправка...',
    limits: 'До {n} файлов · {types} · фото до {img}, документ до {doc}', type: 'Этот тип файла не поддерживается.', size: 'Файл слишком большой.',
    full: 'Достигнуто максимальное число файлов или объём.', failed: 'Файл не сохранён. Попробуйте другой файл или сохраните его в PDF.',
    closed: 'Сейчас нельзя приложить файлы.', busy: 'Сервер занят. Попробуйте чуть позже.',
    qTitle: 'Вопрос с файлами', qHint: 'Напишите вопрос и выберите файлы', qSend: 'Отправить вопрос и файлы', qOn: 'к вопросу',
    qEmpty: 'Напишите вопрос и выберите хотя бы один файл.' },
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
  if (code === 'quote_closed' || code === 'question_not_found' || code === 'rfq_due_passed' || code === 'read_only' || code === 'code_required'
    || code === 'message_limit') return 'closed';
  if (code === 'busy' || code === 'rate_limited' || code === 'request_in_progress') return 'busy';
  return 'failed';
}

/** What a file is bound to: his submitted quote or one of his questions (exactly one - the server refuses anything else). */
export type Target = { quote_id: string } | { message_id: string };

/** The upload form of one file (the multipart filename is a fixed `upload.<ext>`; the real name only as the cleaned `name` field). */
export function uploadForm(f: File, target: Target): FormData {
  const form = new FormData();
  form.append('file', f, `upload.${(f.name.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5)}`);
  if ('quote_id' in target) form.append('quote_id', target.quote_id);
  else form.append('message_id', target.message_id);
  form.append('client_request_id', newRequestId());
  form.append('name', f.name.slice(0, 120));
  return form;
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
let qText = '';
let qFiles: File[] = [];

/** The files the picker would refuse anyway (kind / the administrator's size) are dropped with a word; true = all of them fit. */
function fits(u: RfqUploads, files: File[]): File[] {
  return files.filter((f) => {
    const kind = pickedKind(f.name, u.limits.types);
    const ok = !!kind && f.size <= (kind === 'image' ? u.limits.image_bytes : u.limits.document_bytes);
    if (!ok) problem = kind ? 'size' : 'type';
    return ok;
  });
}

async function send(host: UploadHost, files: File[], target: Target): Promise<boolean> {
  for (const f of files) {
    const r = await rawCall(host.creds, 'POST', '/t/api/rfq/upload', undefined, uploadForm(f, target));
    if (r.status === 404) {
      // the uniform 404: the link is gone. The caller's reload that follows must not load the forgotten request again
      // (2.7.0 gate: it put the page back on screen) - it now repeats "unavailable" instead. Kept tiny: the public budget.
      host.reload = host.dead;
      host.dead();
      return false;
    }
    if (r.status !== 200) {
      problem = refusalKey(String((r.body as { code?: unknown }).code ?? ''));
      return false;
    }
  }
  return true;
}

/** The card (positional arguments: the RFQ page's budget is tight, every byte of its lazy hook counts). */
export function uploadCard(uploads: RfqUploads, creds: Credentials, lang: Lang, reload: () => void, dead: () => void, rerender: () => void): HTMLElement {
  const host: UploadHost = { uploads, creds, lang, reload, dead };
  const w = WORDS[host.lang] ?? WORDS.he;
  const u = host.uploads;
  const l = u.limits;
  const room = Math.max(0, l.files - u.files.length);
  const begin = (): boolean => {
    if (busy) return false;
    busy = true;
    problem = null;
    rerender();
    return true;
  };
  const toQuote = async (files: File[]): Promise<void> => {
    if (!files.length || !u.quote_id || !begin()) return;
    await send(host, fits(u, files).slice(0, room), { quote_id: u.quote_id });
    busy = false;
    host.reload();
  };
  const askWithFiles = async (): Promise<void> => {
    const text = qText.trim();
    if (!text || !qFiles.length) {
      problem = 'qEmpty';
      rerender();
      return;
    }
    if (!begin()) return;
    const r = await rawCall(host.creds, 'POST', '/t/api/rfq/message', { text, client_request_id: newRequestId() });
    if (r.status === 404) return host.dead();
    const mid = (r.body as { message?: { id?: unknown } }).message?.id;
    if (r.status !== 200 || typeof mid !== 'string') problem = refusalKey(String((r.body as { code?: unknown }).code ?? ''));
    else if (await send(host, qFiles.slice(0, room), { message_id: mid })) {
      qText = '';
      qFiles = [];
    } else qText = ''; // the question itself is stored: only the files that failed are kept to try again
    busy = false;
    host.reload();
  };
  const input = (camera: boolean, onPick: (files: File[]) => void, tag: string) => {
    const i = h('input', { attrs: { type: 'file', hidden: true, multiple: !camera, accept: camera ? 'image/*' : l.types.map((t) => MIME[t] ?? '').join(','),
      capture: camera ? 'environment' : null, disabled: busy, 'data-rfq-upload-input': `${tag}-${camera ? 'camera' : 'file'}` } });
    i.addEventListener('change', () => {
      const files = Array.from(i.files ?? []);
      i.value = '';
      onPick(files);
    });
    return h('label', { class: 'swc-btn' }, icon(camera ? 'camera' : 'box'), camera ? w.camera : w.pick, i);
  };
  const remove = async (id: string): Promise<void> => {
    if (!begin()) return;
    const r = await rawCall(host.creds, 'POST', '/t/api/rfq/upload/remove', { file_id: id, client_request_id: newRequestId() });
    busy = false;
    if (r.status === 404) return host.dead();
    if (r.status !== 200) problem = refusalKey(String((r.body as { code?: unknown }).code ?? ''));
    host.reload();
  };
  const list = u.files.map((f) => h('li', { class: 'swc-rev-line', attrs: { 'data-rfq-upload': f.id, 'data-on': f.on ?? 'quote' } },
    h('span', { class: 'swc-rev-what', attrs: { dir: 'auto' } }, f.on === 'question' ? `${f.name} · ${w.qOn}` : f.name), h('small', null, sizeText(f.bytes, host.lang)),
    u.can.remove ? h('button', { class: 'swc-btn', attrs: { type: 'button', disabled: busy, 'data-rfq-upload-remove': f.id }, on: { click: () => void remove(f.id) } }, w.remove) : null));
  const types = l.types.map((t) => t.toUpperCase()).join(', ');
  const limitsLine = h('small', { class: 'swc-muted' }, w.limits.replace('{n}', String(l.files)).replace('{types}', types)
    .replace('{img}', sizeText(l.image_bytes, host.lang)).replace('{doc}', sizeText(l.document_bytes, host.lang)));
  const question = u.can.question ? (() => {
    const box = h('textarea', { class: 'swc-input swc-area', attrs: { rows: 3, maxlength: 2000, dir: 'auto', 'aria-label': w.qTitle, placeholder: w.qHint, disabled: busy,
      'data-rfq-upload-question': true } });
    box.value = qText;
    box.addEventListener('input', () => { qText = box.value; });
    const pick = (files: File[]) => { qFiles = [...qFiles, ...fits(u, files)].slice(0, room); rerender(); };
    return h('div', { class: 'swc-card rfq-upload-q', attrs: { 'data-rfq-upload-q': qFiles.length } },
      h('h3', { class: 'swc-sub' }, w.qTitle), box,
      qFiles.length ? h('ul', { class: 'swc-rev-lines' }, ...qFiles.map((f) => h('li', { class: 'swc-rev-line' }, h('span', { class: 'swc-rev-what', attrs: { dir: 'auto' } }, f.name),
        h('small', null, sizeText(f.size, host.lang))))) : null,
      h('div', { class: 'swc-row swc-actions' }, input(false, pick, 'q'), input(true, pick, 'q'),
        h('button', { class: 'swc-btn swc-primary', attrs: { type: 'button', disabled: busy, 'data-rfq-upload-ask': true }, on: { click: () => void askWithFiles() } }, w.qSend)));
  })() : null;
  return h('section', { class: 'swc swq rfq-upload', attrs: { 'data-rfq-uploads': u.files.length } },
    h('header', { class: 'swc-head' }, h('h2', { class: 'swc-title' }, w.title)),
    u.can.upload ? h('p', { class: 'swc-note' }, w.note) : null,
    list.length ? h('ul', { class: 'swc-rev-lines' }, ...list) : h('p', { class: 'swc-muted' }, w.none),
    problem ? h('div', { class: 'banner bad', attrs: { role: 'alert', 'data-rfq-upload-error': problem } }, w[problem]) : null,
    busy ? h('p', { class: 'swc-muted', attrs: { role: 'status' } }, w.sending) : null,
    u.can.upload ? h('div', { class: 'swc-row swc-actions' }, input(false, (f) => void toQuote(f), 'quote'), input(true, (f) => void toQuote(f), 'quote')) : null,
    question,
    u.can.upload || u.can.question ? limitsLine : null);
}
