/**
 * CR-038 slice 9 (spec 11A.2 / 11A.5 / 11A.6A / 10.7): the cost-claim step of the public handler page - plain DOM, no framework.
 *
 * Slice 4's page mounts it (see docs/changes/CR-038-S9-PUBLIC-CLAIM-UI.md):
 *     const { mountClaimStep } = await import('./claim/claim-step');
 *     mountClaimStep(host, { fetchJson, uploadFile, lang, dir, onDone, labels, number, timeZone });
 * The I/O is injected: `fetchJson(path, {method, body})` and `uploadFile(path, formData)` add the page's `X-Ticket-Token` /
 * `X-Ticket-Session` headers and answer `{status, body}` (status 0 when no answer came) - they never throw (a throw is read as 0).
 *
 * Rendering rules (spec 16 / text_hygiene): every server or user text is set with `textContent`; no innerHTML, no auto-linkify;
 * no style attributes (style-src 'self'): classes from claim.css only. Touch targets >= 44 px, one column, light / dark by
 * prefers-color-scheme (claim.css).
 */
import './claim.css'; // the lazy chunk carries its own style sheet (a <link> to 'self' - the public CSP allows it)
import {
  type ApiResult,
  type ClaimDocument,
  type ClaimForm,
  type ClaimFormSettings,
  type ClaimInfo,
  type DocsAction,
  type DocsState,
  type FieldError,
  type LineDraft,
  type LineKind,
  type Revision,
  type StepView,
  type StorageLike,
  type SubmitTracker,
  DEFAULT_LIMITS,
  LINE_KINDS,
  beginSubmit,
  buildPayload,
  classify,
  clearDraft,
  computeForm,
  docsFromRevision,
  docsReady,
  docsReduce,
  dropLostPages,
  endSubmit,
  fileCount,
  formFromRevision,
  formatBytes,
  formatMoney,
  formatRate,
  latestRevision,
  loadDraft,
  newDocumentKey,
  newForm,
  newLine,
  newRequestId,
  openDocument,
  runUploads,
  saveDraft,
  validateForm,
  viewOf,
} from './claim-model';
import { type ClaimLang, type ClaimTextKey, type ItemLabels, claimDir, claimLang, ct, errorText, itemLabels } from './claim-text';
import { type PickKind, fileKind, looksInApp, looksIos, pickFile } from './pick';
import type { PageEditor } from './capture-editor';
import type { PrefillExt } from './claim-prefill';

export const CLAIM_PATH = '/t/api/claim';
export const CLAIM_FILE_PATH = '/t/api/claim/file';

export interface ClaimStepOptions {
  fetchJson: (path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }) => Promise<ApiResult>;
  uploadFile: (path: string, form: FormData) => Promise<ApiResult>;
  /** the API's `lang` (he / en / ar / ru) */
  lang: string;
  /** the API's `dir`; derived from the language when absent */
  dir?: 'rtl' | 'ltr';
  /** 'later' - "אשלים אחר כך" was tapped; 'submitted' - a revision was stored (the server's numbers are on screen) */
  onDone?: (e: { kind: 'later' | 'submitted' }) => void;
  /** the API's `labels` (one / many / gender) - the item's configured name */
  labels?: Partial<ItemLabels> | null;
  /** the item's number for the heading */
  number?: string | number | null;
  /** the installation's zone (`time_zone`) for the claim window's end */
  timeZone?: string | null;
  /** 403 code_required: the page shows its own code form, then calls `refresh()` */
  onCodeRequired?: () => void;
  /** sessionStorage by default (every access in try/catch) */
  storage?: StorageLike | null;
  /** the draft's storage key (the page may scope it per link) */
  draftKey?: string;
  /** the lazy editor chunk (tests may inject one) */
  loadEditor?: () => Promise<typeof import('./capture-editor')>;
  userAgent?: string;
  /** TK257: mounted inside the permanent quote / payment card - the card has the heading, so the step shows none */
  embedded?: boolean;
}

export interface ClaimStepHandle {
  /** reload the claim (after a code session, on visibilitychange) */
  refresh(): Promise<void>;
  view(): StepView;
  destroy(): void;
}

type Banner = { tone: 'info' | 'warn' | 'error'; text: string; retry?: boolean } | null;

const DRAFT_KEY = 'sw-claim-draft';
const BLOB_PREFIX = ':page:';
/** a page kept in sessionStorage as base64 for a reload with bad reception - only when it is small enough to fit */
const BLOB_STORE_MAX = 900 * 1024;

function defaultStorage(): StorageLike | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- tiny DOM helpers (text only)

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(label: string, cls: string, onClick: (ev: MouseEvent) => void, aria?: string): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  if (aria) b.setAttribute('aria-label', aria);
  b.addEventListener('click', onClick);
  return b;
}

let idSeq = 0;
function uid(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

// ---------------------------------------------------------------- the step

export function mountClaimStep(container: HTMLElement, opts: ClaimStepOptions): ClaimStepHandle {
  const lang: ClaimLang = claimLang(opts.lang);
  const dir = opts.dir ?? claimDir(lang);
  const labels = itemLabels(lang, opts.labels);
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const draftKey = opts.draftKey ?? DRAFT_KEY;
  const ua = opts.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const loadEditor = opts.loadEditor ?? (() => import('./capture-editor'));
  const t = (key: ClaimTextKey, vars?: Record<string, string | number>) => ct(lang, key, vars, labels);

  let info: ClaimInfo | null = null;
  let view: StepView = 'loading';
  let editing = false; // the form is open (optional card expanded, a correction of a pending submission)
  let form: ClaimForm = newForm(null);
  let docs: DocsState = { docs: [] };
  let submit: SubmitTracker | null = null;
  let errors: FieldError[] = [];
  let showErrors = false;
  let banner: Banner = null;
  let docsNote: string | null = null; // a one-line note in the documents section (camera fallback, a refused file)
  let cameraFallback = false;
  let submitting = false;
  let submitQueued = false;
  let uploading = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = 5;
  let destroyed = false;
  let editor: PageEditor | null = null;
  let editorBusy = false;
  let ext: PrefillExt | null = null; // CR-CLAIM-PREFILL: the lazy chunk, only when the claim carries the approved quote
  const blobs = new Map<string, Blob>();
  const errorNodes = new Map<string, HTMLElement>();

  const root = el('section', 'swc');
  root.setAttribute('dir', dir);
  root.setAttribute('lang', lang);
  root.setAttribute('aria-live', 'polite');
  container.replaceChildren(root);

  // hosts of the form view (re-rendered separately so typing never loses focus)
  let linesHost: HTMLElement | null = null;
  let figuresHost: HTMLElement | null = null;
  let docsHost: HTMLElement | null = null;
  let editorHost: HTMLElement | null = null;
  let bannerHost: HTMLElement | null = null;
  let submitBtn: HTMLButtonElement | null = null;
  let galleryBtn: HTMLButtonElement | null = null;

  const settings = (): ClaimFormSettings | null => info?.form ?? null;
  const limits = () => settings()?.limits ?? DEFAULT_LIMITS;
  const money = (minor: number, currency?: string) => formatMoney(minor, currency ?? form.currency ?? info?.currency ?? 'ILS', lang);

  // ---------------------------------------------------------------- draft

  function persist(): void {
    if (!isFormView()) return;
    saveDraft(storage, draftKey, { form, docs, submit });
  }

  function storeBlob(key: string, blob: Blob): void {
    if (!storage || blob.size > BLOB_STORE_MAX || typeof FileReader === 'undefined') return;
    try {
      const r = new FileReader();
      r.onload = () => {
        try {
          if (typeof r.result === 'string') storage.setItem(draftKey + BLOB_PREFIX + key, r.result);
        } catch {
          /* quota - the page stays in memory only */
        }
      };
      r.readAsDataURL(blob);
    } catch {
      /* no FileReader / storage refused */
    }
  }

  function forgetBlob(key: string): void {
    blobs.delete(key);
    try {
      storage?.removeItem(draftKey + BLOB_PREFIX + key);
    } catch {
      /* storage refused */
    }
  }

  function restoreBlob(key: string): Blob | null {
    try {
      const v = storage?.getItem(draftKey + BLOB_PREFIX + key);
      const m = v ? /^data:([^;,]+);base64,(.*)$/.exec(v) : null;
      if (!m) return null;
      const bin = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: m[1] });
    } catch {
      return null;
    }
  }

  function dropDraft(): void {
    for (const d of docs.docs) for (const p of d.pages) forgetBlob(p.key);
    clearDraft(storage, draftKey);
    submit = null;
  }

  // ---------------------------------------------------------------- loading

  async function load(): Promise<void> {
    let res: ApiResult;
    try {
      res = await opts.fetchJson(CLAIM_PATH, { method: 'GET' });
    } catch {
      res = { status: 0, body: null };
    }
    if (destroyed) return;
    const o = classify(res);
    if (o.kind === 'ok') {
      const b = o.body as unknown as ClaimInfo;
      info ??= b;
      if (b.prefill && !ext) ext = await import('./claim-prefill').then((m) => m.attach({ lang, info: () => info, settings, form: () => form, set: (f) => { form = f; persist(); render(); }, slot: errorSlot, changed: () => showErrors && revalidate() })).catch(() => null);
      if (!destroyed) applyInfo(b);
      return;
    }
    // a reload that fails while the vendor is filling the form (bad reception, a camera round-trip) keeps the form on screen
    if (isFormView() && (o.kind === 'retry' || o.kind === 'refused')) return;
    if (o.kind === 'code_required') {
      setView('code_required');
      opts.onCodeRequired?.();
      return;
    }
    if (o.kind === 'unavailable') return setView('unavailable');
    if (o.kind === 'retry' && o.code === 'busy') return setView('busy');
    setView('error');
  }

  function applyInfo(next: ClaimInfo): void {
    const v = viewOf(next);
    if (isFormView() && v === view) {
      // a refresh (visibilitychange after the camera app, a code session) with nothing new: the form, an open editor and a
      // picker waiting for its file stay exactly as they are
      info = next;
      return;
    }
    info = next;
    if (v === 'approved' || v === 'paid' || v === 'window_closed' || v === 'none') {
      dropDraft();
      editing = false;
    } else {
      prepareForm(v);
    }
    setView(v);
  }

  /** The form's starting point: a stored draft (bad reception, a reload) > the rejected revision > a fresh form. */
  function prepareForm(v: StepView): void {
    const s = settings();
    const draft = loadDraft(storage, draftKey);
    if (draft && (!s || s.currencies.includes(draft.form.currency))) {
      form = draft.form;
      submit = draft.submit;
      for (const d of draft.docs.docs) for (const p of d.pages) if (p.state !== 'uploaded' && !blobs.has(p.key)) {
        const b = restoreBlob(p.key);
        if (b) blobs.set(p.key, b);
      }
      const kept = dropLostPages(draft.docs, (k) => blobs.has(k));
      docs = kept.state;
      if (kept.dropped) docsNote = errorText(lang, 'expired_file');
      editing = v === 'required' || v === 'rejected' || editing || draftHasContent();
      if (docs.docs.some((d) => d.finished && d.pages.some((p) => p.state !== 'uploaded'))) queueMicrotask(() => void pumpUploads());
      if (submit?.pending) {
        banner = { tone: 'warn', text: t('saved_offline'), retry: true };
      }
      return;
    }
    const rev = latestRevision(info);
    if (v === 'rejected' && rev) {
      form = formFromRevision(rev, s);
      docs = docsFromRevision(rev);
    } else if (!editing) {
      form = ext ? ext.form() : newForm(s, info?.currency);
      docs = { docs: [] };
    }
    editing = v === 'required' || v === 'rejected' || editing;
  }

  function draftHasContent(): boolean {
    return form.no_charge || docs.docs.length > 0 || !!form.vendor_ref || !!form.notes || form.lines.some((l) => !!(l.hours || l.amount || l.unit_price || l.description));
  }

  function setView(v: StepView): void {
    view = v;
    render();
  }

  function isFormView(): boolean {
    return editing && (view === 'required' || view === 'optional' || view === 'submitted' || view === 'rejected');
  }

  // ---------------------------------------------------------------- rendering

  function render(): void {
    if (destroyed) return;
    errorNodes.clear();
    linesHost = figuresHost = docsHost = editorHost = bannerHost = null;
    submitBtn = galleryBtn = null;
    if (editor) {
      editor.close();
      editor = null;
    }
    root.replaceChildren();
    container.hidden = view === 'none';
    if (view === 'none') return;
    if (!opts.embedded) {
      const head = el('header', 'swc-head');
      head.appendChild(el('h2', 'swc-title', opts.number !== undefined && opts.number !== null ? t('heading_item', { number: String(opts.number) }) : t('heading')));
      root.appendChild(head);
    }

    switch (view) {
      case 'loading':
        root.appendChild(el('p', 'swc-muted', t('loading')));
        return;
      case 'code_required':
        root.appendChild(el('p', 'swc-note', t('code_required')));
        return;
      case 'unavailable':
        root.appendChild(el('p', 'swc-note', t('unavailable')));
        return;
      case 'busy':
      case 'error': {
        root.appendChild(el('p', 'swc-note swc-warn', view === 'busy' ? t('busy') : t('error_generic')));
        root.appendChild(btn(t('retry'), 'swc-btn', () => void refresh()));
        return;
      }
      case 'window_closed': {
        root.appendChild(el('p', 'swc-note', t('window_closed')));
        const rev = latestRevision(info);
        if (rev) root.appendChild(revisionCard(rev, t('your_submission')));
        return;
      }
      case 'approved':
      case 'paid':
        renderDecided();
        return;
      case 'submitted':
        renderSubmitted();
        return;
      case 'rejected':
        renderRejected();
        return;
      case 'required':
      case 'optional':
        renderOpen();
        return;
      default:
        return;
    }
  }

  function untilLine(): HTMLElement | null {
    const until = info?.claim_until;
    if (!until) return null;
    const d = new Date(until);
    if (Number.isNaN(d.getTime())) return null;
    let text = until;
    try {
      const zone = opts.timeZone || undefined;
      const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
      text = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IL-u-nu-latn' : lang, {
        timeZone: zone,
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: zone && zone !== local ? 'short' : undefined,
      }).format(d);
    } catch {
      /* an unknown zone - the ISO text stays */
    }
    return el('p', 'swc-muted', t('claim_until', { date: text }));
  }

  function renderOpen(): void {
    const required = view === 'required';
    if (!required && !editing) {
      const card = el('div', 'swc-card');
      card.appendChild(el('p', 'swc-card-text', t('card_hint')));
      const u = untilLine();
      if (u) card.appendChild(u);
      card.appendChild(
        btn(t('open_form'), 'swc-btn swc-primary', () => {
          editing = true;
          render();
        }),
      );
      root.appendChild(card);
      return;
    }
    root.appendChild(el('p', 'swc-note', required ? t('required_hint') : t('card_hint')));
    const u = untilLine();
    if (u) root.appendChild(u);
    renderForm();
  }

  function renderSubmitted(): void {
    root.appendChild(el('p', 'swc-status swc-ok', t('submitted_title')));
    const rev = latestRevision(info);
    if (!editing) {
      if (rev) root.appendChild(revisionCard(rev, t('your_submission')));
      if (info?.writable) {
        root.appendChild(el('p', 'swc-muted', t('submitted_hint')));
        const u = untilLine();
        if (u) root.appendChild(u);
        root.appendChild(
          btn(t('revise'), 'swc-btn', () => {
            if (!loadDraft(storage, draftKey) && rev) {
              form = formFromRevision(rev, settings());
              docs = docsFromRevision(rev);
            }
            editing = true;
            render();
          }),
        );
      }
      return;
    }
    root.appendChild(
      btn(t('cancel_revise'), 'swc-btn swc-link', () => {
        editing = false;
        dropDraft();
        render();
      }),
    );
    renderForm();
  }

  function renderRejected(): void {
    root.appendChild(el('p', 'swc-status swc-bad', t('rejected_title')));
    if (info?.rejection_reason) {
      const box = el('div', 'swc-reason');
      box.appendChild(el('span', 'swc-label', t('rejected_reason')));
      box.appendChild(el('p', 'swc-reason-text', info.rejection_reason));
      root.appendChild(box);
    }
    root.appendChild(el('p', 'swc-muted', t('rejected_hint')));
    const u = untilLine();
    if (u) root.appendChild(u);
    renderForm();
  }

  function renderDecided(): void {
    root.appendChild(el('p', 'swc-status swc-ok', view === 'paid' ? t('paid_title') : t('approved_title')));
    const a = info?.approved;
    if (a) {
      const box = el('div', 'swc-card');
      const row = el('div', 'swc-total-row swc-grand');
      row.append(el('span', '', t('approved_total')), amountSpan(money(a.total_minor, a.currency)));
      box.appendChild(row);
      if (a.adjusted && a.reason) {
        box.appendChild(el('span', 'swc-label', t('adjusted_reason')));
        box.appendChild(el('p', 'swc-reason-text', a.reason));
      }
      root.appendChild(box);
    }
    const rev = latestRevision(info);
    if (rev) root.appendChild(revisionCard(rev, t('your_submission')));
  }

  function amountSpan(text: string): HTMLElement {
    const s = el('span', 'swc-amount', text);
    s.setAttribute('dir', 'ltr');
    return s;
  }

  function kindLabel(k: LineKind): string {
    return t(`kind_${k}` as ClaimTextKey);
  }

  /** A read-only revision: lines, the server's figures, the reference and the documents (name and size only - no re-download). */
  function revisionCard(rev: Revision, title: string): HTMLElement {
    const card = el('div', 'swc-card swc-revision');
    card.appendChild(el('h3', 'swc-sub', `${title} · ${t('submission_n', { n: rev.seq })}`));
    if (rev.no_charge) card.appendChild(el('p', 'swc-note', t('no_charge_summary')));
    const list = el('ul', 'swc-rev-lines');
    for (const ln of rev.lines ?? []) {
      const li = el('li', 'swc-rev-line');
      const what = el('span', 'swc-rev-what');
      what.textContent = ln.description ? `${kindLabel(ln.kind)} - ${ln.description}` : kindLabel(ln.kind);
      li.appendChild(what);
      let detail = '';
      if (ln.kind === 'labor' && ln.hours) detail = `${ln.hours} × ${money(ln.rate_minor ?? 0, rev.currency)}`;
      else if (ln.kind === 'parts' && ln.quantity) detail = `${ln.quantity} × ${money(ln.unit_minor ?? 0, rev.currency)}`;
      if (detail) {
        const d = el('span', 'swc-muted', detail);
        d.setAttribute('dir', 'ltr');
        li.appendChild(d);
      }
      li.appendChild(amountSpan(money(ln.total_minor, rev.currency)));
      list.appendChild(li);
    }
    if (rev.lines?.length) card.appendChild(list);
    card.appendChild(totalsBlock(rev.net_minor ?? rev.total_minor - rev.vat_minor, rev.vat_minor, rev.total_minor, rev.vat_mode, rev.vat_rate_bp, rev.currency));
    const delta = ext?.delta(rev);
    if (delta) card.appendChild(delta);
    if (rev.vendor_ref) {
      const p = el('p', 'swc-muted');
      p.textContent = `${t('vendor_ref')}: ${rev.vendor_ref}`;
      card.appendChild(p);
    }
    if (rev.notes) {
      card.appendChild(el('span', 'swc-label', t('notes')));
      card.appendChild(el('p', 'swc-reason-text', rev.notes));
    }
    for (const d of rev.documents ?? []) {
      const p = el('p', 'swc-muted');
      const size = d.pages.reduce((n, x) => n + (x.bytes || 0), 0);
      const name = d.kind === 'pdf' ? d.pages[0]?.name || t('doc_pdf', { n: d.no }) : t('doc_n', { n: d.no });
      p.textContent = `${name} · ${t('files_n', { n: d.pages.length })} · ${formatBytes(size)}`;
      card.appendChild(p);
    }
    return card;
  }

  function totalsBlock(net: number, vat: number, total: number, mode: string, rateBp: number, currency: string): HTMLElement {
    const box = el('div', 'swc-totals');
    const row = (label: string, minor: number, cls = '') => {
      const r = el('div', `swc-total-row ${cls}`.trim());
      r.append(el('span', '', label), amountSpan(money(minor, currency)));
      box.appendChild(r);
    };
    if (mode !== 'none') {
      row(t('net'), net);
      row(t('vat', { rate: formatRate(rateBp) }), vat);
    }
    row(t('total'), total, 'swc-grand');
    return box;
  }

  // ---------------------------------------------------------------- the form

  function renderForm(): void {
    const s = settings();
    const f = el('div', 'swc-form');

    // no charge
    const nc = el('label', 'swc-check');
    const ncBox = el('input');
    ncBox.type = 'checkbox';
    ncBox.checked = form.no_charge;
    ncBox.addEventListener('change', () => {
      form.no_charge = ncBox.checked;
      persist();
      render();
    });
    nc.append(ncBox, el('span', '', t('no_charge')), el('span', 'swc-muted', ` - ${t('no_charge_hint')}`));
    f.appendChild(nc);

    if (!form.no_charge) {
      // currency (only when more than one is allowed)
      if (s && s.currencies.length > 1) {
        const lab = el('label', 'swc-field');
        lab.appendChild(el('span', 'swc-label', t('currency')));
        const sel = el('select', 'swc-input');
        for (const c of s.currencies) {
          const o = el('option', '', c);
          o.value = c;
          o.selected = c === form.currency;
          sel.appendChild(o);
        }
        sel.addEventListener('change', () => {
          form.currency = sel.value;
          persist();
          render();
        });
        lab.appendChild(sel);
        f.appendChild(lab);
      }
      // VAT toggle (an exempt vendor has none)
      if (s?.vat.exempt) {
        f.appendChild(el('p', 'swc-muted', t('vat_none')));
      } else {
        const seg = el('div', 'swc-seg');
        seg.setAttribute('role', 'radiogroup');
        const opt = (include: boolean, label: string) => {
          const b = btn(label, 'swc-seg-btn', () => {
            form.include_vat = include;
            persist();
            for (const x of seg.querySelectorAll('button')) x.setAttribute('aria-checked', String(x === b));
            paintFigures();
          });
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', String(form.include_vat === include));
          seg.appendChild(b);
        };
        opt(true, t('vat_included'));
        opt(false, t('vat_excluded'));
        f.appendChild(seg);
      }
      f.appendChild(el('h3', 'swc-sub', t('lines_title')));
      linesHost = el('div', 'swc-lines');
      f.appendChild(linesHost);
      renderLines();
      const add = el('div', 'swc-row swc-add');
      for (const k of LINE_KINDS) {
        add.appendChild(
          btn(`+ ${kindLabel(k)}`, 'swc-btn swc-small', () => {
            if (form.lines.length >= limits().lines) {
              showBanner({ tone: 'error', text: errorText(lang, 'too_many', { n: limits().lines }) });
              return;
            }
            form.lines.push(newLine(k, s));
            persist();
            renderLines();
            paintFigures();
            const inputs = linesHost?.querySelectorAll<HTMLInputElement>('.swc-line:last-child input');
            inputs?.[0]?.focus();
          }, `${t('line_add')}: ${kindLabel(k)}`),
        );
      }
      f.appendChild(add);
      figuresHost = el('div', 'swc-figures');
      f.appendChild(figuresHost);
      f.appendChild(errorSlot('lines'));
      f.appendChild(errorSlot('total'));
    }

    f.appendChild(textField('vendor_ref', t('vendor_ref'), form.vendor_ref, limits().vendor_ref, false, (v) => (form.vendor_ref = v)));
    f.appendChild(textField('notes', t('notes'), form.notes, limits().notes, true, (v) => (form.notes = v)));

    // documents
    const docsBox = el('div', 'swc-docs');
    docsBox.appendChild(el('h3', 'swc-sub', `${t('docs_title')} ${s?.require_invoice && !form.no_charge ? '' : t('optional')}`.trim()));
    docsBox.appendChild(el('p', 'swc-muted', t('docs_hint', { docs: limits().documents, pages: limits().pages })));
    docsHost = el('div', 'swc-docs-body');
    docsBox.appendChild(docsHost);
    editorHost = el('div', 'swc-editor-host');
    docsBox.appendChild(editorHost);
    docsBox.appendChild(errorSlot('documents'));
    f.appendChild(docsBox);
    renderDocs();

    bannerHost = el('div', 'swc-banner-host');
    f.appendChild(bannerHost);
    paintBanner();

    const actions = el('div', 'swc-row swc-actions');
    submitBtn = btn(submitting ? t('submitting') : t('submit'), 'swc-btn swc-primary', () => void doSubmit());
    submitBtn.disabled = submitting;
    actions.appendChild(submitBtn);
    if (view === 'required' || view === 'optional') {
      actions.appendChild(
        btn(t('later'), 'swc-btn', () => {
          persist();
          if (view === 'optional') {
            editing = false;
            render();
          }
          opts.onDone?.({ kind: 'later' });
        }),
      );
    }
    f.appendChild(actions);
    root.appendChild(f);
    paintFigures();
    paintErrors();
    // fetch the editor chunk early, while the vendor fills the lines - it is then ready when a picture comes back
    void loadEditor().catch(() => undefined);
  }

  function errorSlot(field: string): HTMLElement {
    const p = el('p', 'swc-error');
    p.id = uid('swc-err');
    p.hidden = true;
    errorNodes.set(field, p);
    return p;
  }

  function textField(field: string, label: string, value: string, max: number, multiline: boolean, set: (v: string) => void): HTMLElement {
    const lab = el('label', 'swc-field');
    lab.appendChild(el('span', 'swc-label', `${label} ${t('optional')}`));
    const input = multiline ? el('textarea', 'swc-input swc-area') : el('input', 'swc-input');
    if (input instanceof HTMLInputElement) input.type = 'text';
    input.value = value;
    input.maxLength = max * 2; // the server counts after cleaning; the hard stop is generous, the message is exact
    input.addEventListener('input', () => {
      set(input.value);
      persist();
      if (showErrors) revalidate();
    });
    lab.appendChild(input);
    const slot = errorSlot(field);
    input.setAttribute('aria-describedby', slot.id);
    lab.appendChild(slot);
    return lab;
  }

  function renderLines(): void {
    if (!linesHost) return;
    for (const k of [...errorNodes.keys()]) if (k.startsWith('lines.')) errorNodes.delete(k);
    linesHost.replaceChildren();
    form.lines.forEach((ln, i) => linesHost!.appendChild(lineRow(ln, i)));
    paintErrors();
  }

  function lineRow(ln: LineDraft, i: number): HTMLElement {
    const row = el('div', 'swc-line');
    const top = el('div', 'swc-line-top');
    const sel = el('select', 'swc-input swc-kind');
    sel.setAttribute('aria-label', t('line_kind'));
    for (const k of LINE_KINDS) {
      const o = el('option', '', kindLabel(k));
      o.value = k;
      o.selected = k === ln.kind;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      const next = newLine(sel.value as LineKind, settings(), ln.key);
      next.description = ln.description;
      form.lines[i] = next;
      persist();
      renderLines();
      paintFigures();
    });
    top.appendChild(sel);
    const total = el('span', 'swc-amount swc-line-total');
    total.setAttribute('dir', 'ltr');
    total.dataset.line = String(i);
    top.appendChild(total);
    top.appendChild(
      btn('✕', 'swc-btn swc-icon', () => {
        form.lines.splice(i, 1);
        persist();
        renderLines();
        paintFigures();
      }, t('line_remove')),
    );
    row.appendChild(top);

    const num = (key: 'hours' | 'rate' | 'quantity' | 'unit_price' | 'amount', label: ClaimTextKey) => {
      const lab = el('label', 'swc-field swc-num');
      lab.appendChild(el('span', 'swc-label', t(label)));
      const input = el('input', 'swc-input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.setAttribute('dir', 'ltr');
      input.value = ln[key];
      input.addEventListener('input', () => {
        ln[key] = input.value;
        persist();
        paintFigures();
        if (showErrors) revalidate();
      });
      lab.appendChild(input);
      const slot = errorSlot(`lines.${i}.${key}`);
      input.setAttribute('aria-describedby', slot.id);
      lab.appendChild(slot);
      return lab;
    };
    const nums = el('div', 'swc-nums');
    if (ln.kind === 'labor') nums.append(num('hours', 'f_hours'), num('rate', 'f_rate'));
    else if (ln.kind === 'parts') nums.append(num('quantity', 'f_quantity'), num('unit_price', 'f_unit_price'));
    else nums.append(num('amount', 'f_amount'));
    row.appendChild(nums);

    const dlab = el('label', 'swc-field');
    const needDesc = ln.kind === 'parts' || ln.kind === 'other';
    dlab.appendChild(el('span', 'swc-label', needDesc ? t('f_description') : `${t('f_description')} ${t('optional')}`));
    const d = el('input', 'swc-input');
    d.type = 'text';
    d.value = ln.description;
    d.maxLength = limits().description * 2;
    d.addEventListener('input', () => {
      ln.description = d.value;
      persist();
      if (showErrors) revalidate();
    });
    dlab.appendChild(d);
    const slot = errorSlot(`lines.${i}.description`);
    d.setAttribute('aria-describedby', slot.id);
    dlab.appendChild(slot);
    row.appendChild(dlab);
    return row;
  }

  function paintFigures(): void {
    const s = settings();
    const fig = computeForm(form, s);
    if (linesHost) {
      for (const node of linesHost.querySelectorAll<HTMLElement>('.swc-line-total')) {
        const i = Number(node.dataset.line);
        const v = fig.lines[i];
        node.textContent = v === null || v === undefined ? '' : money(v);
      }
    }
    if (!figuresHost) return;
    figuresHost.replaceChildren(totalsBlock(fig.net, fig.vat, fig.total, fig.vatMode, fig.rateBp, form.currency));
    ext?.paint(figuresHost);
    figuresHost.appendChild(el('p', 'swc-muted swc-small-text', t('estimate_note')));
  }

  function validate(): FieldError[] {
    const e = validateForm(form, { settings: settings(), docs });
    ext?.check(e);
    return e;
  }

  function revalidate(): void {
    errors = validate();
    paintErrors();
  }

  function errorFor(field: string): FieldError | undefined {
    return errors.find((e) => e.field === field) ?? (field === 'documents' ? errors.find((e) => e.field.startsWith('documents')) : undefined);
  }

  function paintErrors(): void {
    for (const [field, node] of errorNodes) {
      const e = showErrors ? errorFor(field) : undefined;
      node.hidden = !e;
      node.textContent = e ? errorMessage(e) : '';
    }
  }

  function errorMessage(e: FieldError): string {
    if (e.field === 'lines' && e.code === 'required') return t('e_lines_required');
    const lim = limits();
    const n = e.code === 'too_many' ? lim.lines : e.code === 'too_many_documents' ? lim.documents : e.code === 'too_many_pages' ? lim.pages : e.code === 'too_many_files' ? lim.files : 0;
    return errorText(lang, e.code, { n });
  }

  // ---------------------------------------------------------------- documents

  function dispatch(a: DocsAction): string | null {
    const r = docsReduce(docs, a, limits());
    docs = r.state;
    persist();
    return r.error;
  }

  function renderDocs(): void {
    if (!docsHost) return;
    docsHost.replaceChildren();
    docs.docs.forEach((d, i) => docsHost!.appendChild(docRow(d, i)));
    if (docsNote) docsHost.appendChild(el('p', 'swc-note swc-warn', docsNote));
    if (editor || editorBusy) {
      if (editorBusy) docsHost.appendChild(el('p', 'swc-muted', t('processing')));
      return;
    }
    const open = openDocument(docs);
    const full = fileCount(docs) >= limits().files;
    const row = el('div', 'swc-row swc-pickers');
    if (open) {
      if (open.pages.length < limits().pages && !full) {
        row.appendChild(btn(t('add_page'), 'swc-btn', () => startPick('camera', open.key)));
        galleryBtn = btn(t('gallery'), 'swc-btn', () => startPick('gallery', open.key));
        row.appendChild(galleryBtn);
      }
      row.appendChild(
        btn(t('finish_doc'), 'swc-btn swc-primary', () => {
          dispatch({ type: 'finish_document', docKey: open.key });
          renderDocs();
          void pumpUploads();
        }),
      );
    } else if (docs.docs.length < limits().documents && !full) {
      row.appendChild(btn(t('capture'), 'swc-btn swc-primary', () => startPick('camera', null)));
      galleryBtn = btn(t('gallery'), 'swc-btn', () => startPick('gallery', null));
      row.appendChild(galleryBtn);
      row.appendChild(btn(t('pdf'), 'swc-btn', () => startPick('pdf', null)));
    }
    docsHost.appendChild(row);
    if (cameraFallback) {
      docsHost.appendChild(el('p', 'swc-note', t('camera_fallback')));
      if (looksInApp(ua)) docsHost.appendChild(el('p', 'swc-muted', t('inapp_hint')));
      if (looksIos(ua)) docsHost.appendChild(el('p', 'swc-muted', t('iphone_hint')));
      galleryBtn?.focus();
    }
  }

  function pageStateText(state: string): string {
    return t(`up_${state}` as ClaimTextKey);
  }

  function docRow(d: ClaimDocument, i: number): HTMLElement {
    const box = el('div', 'swc-doc');
    const head = el('div', 'swc-doc-head');
    head.appendChild(el('span', 'swc-doc-title', d.kind === 'pdf' ? t('doc_pdf', { n: i + 1 }) : t('doc_n', { n: i + 1 })));
    head.appendChild(
      btn('✕', 'swc-btn swc-icon', () => {
        for (const p of d.pages) forgetBlob(p.key);
        dispatch({ type: 'delete_document', docKey: d.key });
        renderDocs();
      }, t('delete_doc')),
    );
    box.appendChild(head);
    const list = el('ol', 'swc-pages');
    d.pages.forEach((p, j) => {
      const li = el('li', 'swc-page');
      const label = el('span', 'swc-page-name');
      label.textContent = `${p.kind === 'pdf' ? p.name || 'PDF' : t('page_n', { n: j + 1 })} · ${formatBytes(p.bytes)}`;
      li.appendChild(label);
      const st = el('span', `swc-page-state swc-${p.state}`, pageStateText(p.state));
      li.appendChild(st);
      if (p.error && (p.state === 'refused' || p.state === 'failed')) li.appendChild(el('span', 'swc-error-inline', errorText(lang, p.error)));
      const tools = el('span', 'swc-page-tools');
      if (d.kind === 'photo' && d.pages.length > 1) {
        const up = btn('↑', 'swc-btn swc-icon', () => {
          dispatch({ type: 'move_page', docKey: d.key, pageKey: p.key, delta: -1 });
          renderDocs();
        }, t('move_up'));
        up.disabled = j === 0;
        const down = btn('↓', 'swc-btn swc-icon', () => {
          dispatch({ type: 'move_page', docKey: d.key, pageKey: p.key, delta: 1 });
          renderDocs();
        }, t('move_down'));
        down.disabled = j === d.pages.length - 1;
        tools.append(up, down);
      }
      if (d.kind === 'photo') tools.appendChild(btn(t('retake'), 'swc-btn swc-small', () => startRetake(d.key, p.key)));
      tools.appendChild(
        btn('✕', 'swc-btn swc-icon', () => {
          forgetBlob(p.key);
          dispatch({ type: 'delete_page', docKey: d.key, pageKey: p.key });
          renderDocs();
        }, t('delete_page')),
      );
      li.appendChild(tools);
      list.appendChild(li);
    });
    box.appendChild(list);
    if (d.pages.some((p) => p.state === 'failed')) {
      box.appendChild(btn(t('retry'), 'swc-btn swc-small', () => void pumpUploads()));
    }
    return box;
  }

  function limitProblem(docKey: string | null, kind: PickKind): string | null {
    const lim = limits();
    if (fileCount(docs) >= lim.files) return errorText(lang, 'too_many_files', { n: lim.files });
    if (docKey) {
      const d = docs.docs.find((x) => x.key === docKey);
      if (d && d.pages.length >= lim.pages) return errorText(lang, 'too_many_pages', { n: lim.pages });
    } else if (docs.docs.length >= lim.documents) return errorText(lang, 'too_many_documents', { n: lim.documents });
    if (kind === 'pdf' && docKey) return errorText(lang, 'mixed_document');
    return null;
  }

  /** A picker for a new page (`docKey` = the open document) or a new document. Must run synchronously inside the tap. */
  function startPick(kind: PickKind, docKey: string | null): void {
    const problem = limitProblem(docKey, kind);
    if (problem) {
      docsNote = problem;
      renderDocs();
      return;
    }
    docsNote = null;
    const p = pickFile(kind, { host: container, onLate: (file) => void accept(file, kind, docKey) });
    void p.then((file) => {
      if (destroyed) return;
      if (!file) {
        if (kind === 'camera') {
          cameraFallback = true;
          renderDocs();
        }
        return;
      }
      void accept(file, kind, docKey);
    });
  }

  async function accept(file: File, kind: PickKind, docKey: string | null): Promise<void> {
    cameraFallback = false;
    const fk = fileKind(file);
    if (fk === 'pdf') {
      if (docKey) {
        docsNote = errorText(lang, 'mixed_document');
        renderDocs();
        return;
      }
      const key = newDocumentKey();
      const pageKey = `p-${newRequestId()}`;
      const err = dispatch({ type: 'add_pdf', docKey: key, page: { key: pageKey, kind: 'pdf', name: cleanName(file.name), bytes: file.size, requestId: newRequestId() } });
      if (err) {
        docsNote = errorText(lang, err, { n: limits().documents });
        renderDocs();
        return;
      }
      blobs.set(pageKey, file);
      renderDocs();
      void pumpUploads();
      return;
    }
    if (fk !== 'photo') {
      docsNote = errorText(lang, 'unsupported_format');
      renderDocs();
      return;
    }
    await openEditor(file, { mode: 'new', docKey: docKey ?? newDocumentKey(), source: kind === 'pdf' ? 'gallery' : kind });
  }

  function cleanName(name: string): string {
    return [...(name || '').replace(/[\p{Cc}\p{Cf}]/gu, '')].slice(0, 80).join('');
  }

  function startRetake(docKey: string, pageKey: string): void {
    const p = pickFile('camera', { host: container, onLate: (file) => void openEditor(file, { mode: 'retake', docKey, pageKey, source: 'camera' }) });
    void p.then((file) => {
      if (destroyed) return;
      if (!file) {
        cameraFallback = true;
        renderDocs();
        return;
      }
      void openEditor(file, { mode: 'retake', docKey, pageKey, source: 'camera' });
    });
  }

  interface EditorCtx {
    mode: 'new' | 'retake';
    docKey: string;
    pageKey?: string;
    source: 'camera' | 'gallery';
  }

  async function openEditor(file: File, ctx: EditorCtx): Promise<void> {
    if (!editorHost) return;
    if (editor) {
      editor.close();
      editor = null;
    }
    editorBusy = true;
    renderDocs();
    let mod: typeof import('./capture-editor');
    try {
      mod = await loadEditor();
    } catch {
      editorBusy = false;
      docsNote = t('error_generic');
      renderDocs();
      return;
    }
    if (destroyed || !editorHost) return;
    const doc = docs.docs.find((d) => d.key === ctx.docKey);
    const pageNo = ctx.mode === 'retake' ? (doc?.pages.findIndex((p) => p.key === ctx.pageKey) ?? 0) + 1 : (doc?.pages.length ?? 0) + 1;
    const canAddMore = () => {
      const d = docs.docs.find((x) => x.key === ctx.docKey);
      return (d?.pages.length ?? 0) + 1 < limits().pages && fileCount(docs) + 1 < limits().files;
    };
    const actions: import('./capture-editor').EditorAction[] = [];
    if (ctx.mode === 'new') {
      if (canAddMore()) {
        actions.push({
          label: t('add_page'),
          run: (ed) => {
            // the next picker opens inside this tap; the current page is saved meanwhile
            const next = pickFile(ctx.source, { host: container, onLate: (f) => void openEditor(f, { ...ctx, mode: 'new' }) });
            void commit(ed, ctx, false).then((ok) => {
              if (!ok) return;
              void next.then((f) => {
                if (destroyed) return;
                if (f) void openEditor(f, { ...ctx, mode: 'new' });
                else if (ctx.source === 'camera') {
                  cameraFallback = true;
                  renderDocs();
                }
              });
            });
          },
        });
      }
      actions.push({ label: t('finish_doc'), primary: true, run: (ed) => void commit(ed, ctx, true) });
    } else {
      actions.push({ label: t('use_page'), primary: true, run: (ed) => void commit(ed, ctx, false) });
    }
    actions.push({
      label: t('retake'),
      run: (ed) => {
        const next = pickFile('camera', { host: container, onLate: (f) => void ed.load(f).catch(() => undefined) });
        void next.then((f) => {
          if (f) void ed.load(f).catch(() => showEditorError());
          else {
            cameraFallback = true;
            renderDocs();
          }
        });
      },
    });
    actions.push({
      label: t('discard'),
      run: (ed) => {
        ed.close();
        editor = null;
        renderDocs();
      },
    });
    try {
      editor = await mod.openPageEditor(editorHost, file, {
        title: t('editor_title', { n: pageNo }),
        text: (k) => t(k),
        actions,
      });
    } catch {
      editorBusy = false;
      showEditorError();
      return;
    }
    editorBusy = false;
    renderDocs();
  }

  function showEditorError(): void {
    docsNote = `${errorText(lang, 'image_invalid')}${looksIos(ua) ? ` - ${t('iphone_hint')}` : ''}`;
    renderDocs();
  }

  /** Save the editor's page into its document (new page or retake); `finish` also finishes the document and starts the uploads. */
  async function commit(ed: PageEditor, ctx: EditorCtx, finish: boolean): Promise<boolean> {
    let blob: Blob;
    try {
      blob = await ed.exportBlob();
    } catch {
      showEditorError();
      return false;
    }
    const pageKey = `p-${newRequestId()}`;
    const page = { key: pageKey, kind: 'photo' as const, name: '', bytes: blob.size, requestId: newRequestId() };
    const err =
      ctx.mode === 'retake' && ctx.pageKey
        ? dispatch({ type: 'retake', docKey: ctx.docKey, pageKey: ctx.pageKey, page })
        : dispatch({ type: 'add_page', docKey: ctx.docKey, page });
    if (err) {
      docsNote = errorText(lang, err, { n: err === 'too_many_pages' ? limits().pages : err === 'too_many_files' ? limits().files : limits().documents });
      ed.close();
      editor = null;
      renderDocs();
      return false;
    }
    if (ctx.mode === 'retake' && ctx.pageKey) forgetBlob(ctx.pageKey);
    blobs.set(pageKey, blob);
    storeBlob(pageKey, blob);
    if (finish) dispatch({ type: 'finish_document', docKey: ctx.docKey });
    ed.close();
    editor = null;
    docsNote = null;
    renderDocs();
    if (showErrors) revalidate();
    void pumpUploads();
    return true;
  }

  // ---------------------------------------------------------------- uploads and the submission

  async function pumpUploads(): Promise<'done' | 'paused' | 'stopped'> {
    if (uploading) return 'paused';
    uploading = true;
    try {
      const r = await runUploads({
        getState: () => docs,
        dispatch: (a) => {
          dispatch(a);
          if (a.type === 'upload_done') {
            const page = docs.docs.flatMap((d) => d.pages).find((p) => p.key === a.pageKey);
            if (page) forgetBlob(page.key);
          }
          renderDocs();
        },
        upload: async (job) => {
          const blob = blobs.get(job.page.key);
          if (!blob) return { status: 422, body: { code: 'invalid', fields: [{ field: 'file', code: 'expired_file' }] } };
          const fd = new FormData();
          const fname = job.page.kind === 'pdf' ? job.page.name || 'invoice.pdf' : `page-${job.pageNo}.jpg`;
          fd.append('file', blob, fname);
          fd.append('client_request_id', job.page.requestId);
          fd.append('document_key', job.doc.key);
          fd.append('page_no', String(Math.min(10, job.pageNo)));
          if (job.page.kind === 'pdf' && job.page.name) fd.append('name', job.page.name);
          return opts.uploadFile(CLAIM_FILE_PATH, fd);
        },
      });
      if (r.kind === 'done') {
        retryDelay = 5;
        if (banner && banner.tone === 'warn' && !submit?.pending) showBanner(null);
        if (submitQueued) {
          submitQueued = false;
          void doSubmit();
        }
        return 'done';
      }
      if (r.kind === 'code_required') {
        setView('code_required');
        opts.onCodeRequired?.();
        return 'stopped';
      }
      if (r.kind === 'unavailable') {
        setView('unavailable');
        return 'stopped';
      }
      showBanner({ tone: 'warn', text: r.code === 'busy' ? t('busy') : t('saved_offline'), retry: true });
      scheduleRetry(r.retryAfterS);
      return 'paused';
    } finally {
      uploading = false;
    }
  }

  function scheduleRetry(afterS: number): void {
    if (retryTimer) clearTimeout(retryTimer);
    const wait = Math.max(afterS || 0, retryDelay);
    retryDelay = Math.min(60, retryDelay * 2);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void resume();
    }, wait * 1000);
  }

  async function resume(): Promise<void> {
    if (destroyed) return;
    const r = await pumpUploads();
    if (r === 'done' && submit?.pending && !submitting) void doSubmit();
  }

  function onOnline(): void {
    retryDelay = 5;
    void resume();
  }
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline);

  function showBanner(b: Banner): void {
    banner = b;
    paintBanner();
  }

  function paintBanner(): void {
    if (!bannerHost) return;
    bannerHost.replaceChildren();
    if (!banner) return;
    const box = el('div', `swc-banner swc-${banner.tone}`);
    box.setAttribute('role', banner.tone === 'error' ? 'alert' : 'status');
    box.appendChild(el('span', '', banner.text));
    if (banner.retry) {
      box.appendChild(
        btn(t('retry'), 'swc-btn swc-small', () => {
          retryDelay = 5;
          void resume();
        }),
      );
    }
    bannerHost.appendChild(box);
  }

  function setSubmitting(on: boolean, label?: ClaimTextKey): void {
    submitting = on;
    if (submitBtn) {
      submitBtn.disabled = on;
      submitBtn.textContent = label ? t(label) : on ? t('submitting') : t('submit');
    }
  }

  async function doSubmit(): Promise<void> {
    if (submitting || destroyed) return;
    // an open photo document is finished by the submission itself
    const open = openDocument(docs);
    if (open) dispatch({ type: 'finish_document', docKey: open.key });
    showErrors = true;
    errors = validate();
    paintErrors();
    renderDocs();
    if (errors.length) {
      showBanner(null);
      focusFirstError();
      return;
    }
    if (!docsReady(docs)) {
      setSubmitting(true, 'waiting_uploads');
      submitQueued = true;
      const r = await pumpUploads();
      setSubmitting(false);
      if (r !== 'done') {
        persist();
        return; // the queue resumes on reception and submits then (submitQueued)
      }
      submitQueued = false;
      if (!docsReady(docs)) {
        errors = validate();
        paintErrors();
        if (!errors.length) showBanner({ tone: 'error', text: errorText(lang, 'refused_page') });
        return;
      }
    }
    submit = beginSubmit(submit);
    persist(); // the id is on the device BEFORE the request leaves (a reload mid-request retries with it)
    const body = buildPayload(form, docs, settings(), submit.crid);
    ext?.payload(body);
    setSubmitting(true);
    let res: ApiResult;
    try {
      res = await opts.fetchJson(CLAIM_PATH, { method: 'POST', body });
    } catch {
      res = { status: 0, body: null };
    }
    setSubmitting(false);
    if (destroyed) return;
    const o = classify(res);
    submit = endSubmit(submit, o);
    persist();
    if (o.kind === 'ok') {
      dropDraft();
      editing = false;
      showErrors = false;
      banner = null;
      const answer = o.body as { status?: string; revision?: Revision | null };
      // the server's numbers are the record: show its revision now, then reload the claim
      if (info) {
        info = { ...info, status: 'submitted', revisions: [...(info.revisions ?? []), ...(answer.revision ? [answer.revision] : [])], rejection_reason: null };
      }
      setView(info ? viewOf(info) : 'submitted');
      opts.onDone?.({ kind: 'submitted' });
      void load();
      return;
    }
    if (o.kind === 'retry') {
      showBanner({ tone: 'warn', text: o.code === 'busy' ? t('busy') : t('saved_offline'), retry: true });
      scheduleRetry(o.retryAfterS);
      return;
    }
    if (o.kind === 'code_required') {
      setView('code_required');
      opts.onCodeRequired?.();
      return;
    }
    if (o.kind === 'unavailable') return setView('unavailable');
    if (o.code === 'claim_closed' || o.code === 'claim_window_closed' || o.code === 'claim_not_open') {
      showBanner({ tone: 'error', text: errorText(lang, o.code) });
      void load();
      return;
    }
    // field problems from the server: shown next to the fields; files the server no longer has are marked for re-attaching
    errors = (o.fields ?? []).length ? (o.fields as FieldError[]) : [{ field: 'body', code: o.code }];
    for (const e of errors) {
      const m = /^documents\.(\d+)$/.exec(e.field);
      if (m && (e.code === 'unknown_file' || e.code === 'expired_file')) {
        const d = docs.docs[Number(m[1])];
        if (d) for (const p of d.pages) if (p.state === 'uploaded' && !blobs.has(p.key)) dispatch({ type: 'upload_failed', pageKey: p.key, code: e.code, retryable: false });
      }
    }
    paintErrors();
    renderDocs();
    const unplaced = errors.filter((e) => !errorNodes.has(e.field) && !e.field.startsWith('documents'));
    showBanner({ tone: 'error', text: unplaced.length ? errorMessage(unplaced[0]) : t('error_generic') });
    focusFirstError();
  }

  function focusFirstError(): void {
    for (const [, node] of errorNodes) {
      if (!node.hidden) {
        const field = node.closest('.swc-field, .swc-docs, .swc-figures, .swc-form');
        const input = field?.querySelector<HTMLElement>('input, select, textarea, button');
        (input ?? node).focus?.();
        node.scrollIntoView?.({ block: 'center' });
        return;
      }
    }
  }

  async function refresh(): Promise<void> {
    if (view !== 'submitted' && view !== 'required' && view !== 'optional' && view !== 'rejected') setView('loading');
    await load();
  }

  // ---------------------------------------------------------------- start

  render();
  void load();

  return {
    refresh,
    view: () => view,
    destroy() {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
      if (editor) editor.close();
      blobs.clear();
      root.remove();
    },
  };
}

/** Forget the claim draft of this tab (the page's "סיום" button clears sessionStorage as a whole; this is the claim's own part). */
export function clearClaimDraft(storage: StorageLike | null = defaultStorage(), key: string = DRAFT_KEY): void {
  clearDraft(storage, key);
  try {
    if (!storage) return;
    const s = storage as Storage;
    if (typeof s.length === 'number' && typeof s.key === 'function') {
      const doomed: string[] = [];
      for (let i = 0; i < s.length; i += 1) {
        const k = s.key(i);
        if (k && k.startsWith(key + BLOB_PREFIX)) doomed.push(k);
      }
      for (const k of doomed) s.removeItem(k);
    }
  } catch {
    /* storage refused */
  }
}
