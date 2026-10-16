/**
 * TK257: the permanent "quote / payment demand" card of the vendor page (owner test of 2.5.5: "I could not find where to enter a cost
 * claim"). It is on the page from the first moment - not only after "done":
 *   - the QUOTE part (before the work): the lines the request allows (work + parts; travel / other only when the request or the
 *     department lists them, "other" needs a description), VAT included / excluded, a note; sent to POST /t/api/quote; shows its
 *     state (sent, approved, a correction asked with the reason). A vendor sees only its own quote.
 *   - the PAYMENT DEMAND part (after the work): before "done" one short line says it comes later; after "done" it hosts the existing
 *     claim step (claim-step.ts, mounted by main.ts into `demandSlot`), against the approved quote.
 * Above both, ONE short sentence says what can be sent now and what comes later. Nothing here is sent automatically.
 *
 * Plain DOM, text via textContent only, no inline styles (CSP), classes from claim.css. The I/O is injected like the claim step's.
 */
import {
  type ApiResult,
  type ClaimForm,
  type ClaimFormSettings,
  type LineDraft,
  type LineKind,
  type RevisionLine,
  DEFAULT_LIMITS,
  LINE_KINDS,
  buildPayload,
  classify,
  computeForm,
  formatMoney,
  formatRate,
  minorToInput,
  newForm,
  newLine,
  newRequestId,
  validateForm,
} from './claim-model';
import { type ClaimLang, type ItemLabels, claimDir, claimLang, ct, errorText, itemLabels } from './claim-text';
import { type QuoteTextKey, qt } from './quote-text';

export const QUOTE_PATH = '/t/api/quote';

export type QuoteState = 'none' | 'submitted' | 'approved' | 'rejected';

export interface QuoteView {
  id: string;
  seq: number;
  state: QuoteState | 'superseded';
  lines: RevisionLine[];
  total_minor: number;
  vat_minor: number;
  net_minor: number;
  vat_mode: 'excluded' | 'included' | 'none';
  vat_rate_bp: number;
  currency: string;
  notes?: string | null;
  reason?: string | null;
  /** TKFIX260 (public-surface review F4): a version the organisation entered on the vendor's behalf (never who entered it) */
  on_behalf?: boolean;
}

export interface QuoteInfo {
  state: QuoteState;
  enabled: boolean;
  writable: boolean;
  allowed_kinds: LineKind[];
  currency: string;
  quote: QuoteView | null;
  form: {
    currencies: string[];
    vat: { exempt: boolean; rate_bp: number; default: 'excluded' | 'included' | 'none' };
    labor_rate_minor: number | null;
    limits: { lines: number; description: number; notes: number; max_total_minor: number };
  };
}

export interface CostCardContext {
  /** the ticket's status on the page (acknowledged, in_progress, waiting_part, done ...) */
  status: string | null;
  /** the `claim` block of GET /t/api/ticket (null before "done") */
  claim: { status: string } | null;
}

export interface CostCardOptions {
  fetchJson: (path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }) => Promise<ApiResult>;
  lang: string;
  dir?: 'rtl' | 'ltr';
  labels?: Partial<ItemLabels> | null;
  /** where the claim step lives (the page mounts it there); shown once a claim exists */
  demandSlot: HTMLElement;
  onCodeRequired?: () => void;
  /** TKUI5: the quote's state became known or changed (the page's status line and primary button follow it, without a full redraw) */
  onState?: (state: QuoteState) => void;
}

export interface CostCardHandle {
  element: HTMLElement;
  update(ctx: CostCardContext): void;
  refresh(): Promise<void>;
  /** resolves after the first load (success or not) */
  ready: Promise<void>;
  approved(): { total_minor: number; currency: string } | null;
  /** TKUI5: the quote's state as the server last said it (null until the first answer) */
  quoteState(): QuoteState | null;
  destroy(): void;
}

/** Which of the six steps of the flow is the current one (0 quote ... 5 payment; 6 = all done). Pure, tested in node. */
export function stepIndex(quote: QuoteState, status: string | null, claimStatus: string | null): number {
  if (claimStatus === 'paid') return 6;
  if (claimStatus === 'approved') return 5;
  if (claimStatus === 'submitted') return 4;
  if (status === 'done' || claimStatus === 'awaiting' || claimStatus === 'rejected') return 3;
  if (quote === 'approved') return 2;
  if (quote === 'submitted') return 1;
  return 0;
}

/** The kinds the editor offers: the server's list, in the fixed order, never empty (work is always there). */
export function offeredKinds(allowed: readonly string[] | null | undefined): LineKind[] {
  const kinds = LINE_KINDS.filter((k) => (allowed ?? []).includes(k));
  return kinds.length ? kinds : ['labor', 'parts'];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(label: string, cls: string, onClick: () => void, aria?: string): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  if (aria) b.setAttribute('aria-label', aria);
  b.addEventListener('click', onClick);
  return b;
}

export function mountCostCard(opts: CostCardOptions): CostCardHandle {
  const lang: ClaimLang = claimLang(opts.lang);
  const dir = opts.dir ?? claimDir(lang);
  const labels = itemLabels(lang, opts.labels);
  const t = (key: QuoteTextKey, vars?: Record<string, string | number>) => qt(lang, key, vars, labels);
  const c = (key: Parameters<typeof ct>[1], vars?: Record<string, string | number>) => ct(lang, key, vars, labels);

  const root = el('section', 'swc swq');
  root.setAttribute('dir', dir);
  root.setAttribute('lang', lang);
  root.dataset.costCard = '';
  root.hidden = true;

  let info: QuoteInfo | null = null;
  let ctx: CostCardContext = { status: null, claim: null };
  let loadFailed = false;
  let editing = false;
  let form: ClaimForm = newForm(null);
  let submitting = false;
  let pendingCrid: string | null = null;
  let banner: { tone: 'error' | 'warn'; text: string } | null = null;
  let showErrors = false;
  let destroyed = false;
  let linesHost: HTMLElement | null = null;
  let figuresHost: HTMLElement | null = null;
  let errorHost: HTMLElement | null = null;
  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });

  const settings = (): ClaimFormSettings | null => {
    if (!info) return null;
    const f = info.form;
    return {
      currencies: f.currencies,
      vat: f.vat,
      labor_rate_minor: f.labor_rate_minor,
      require_invoice: false,
      limits: { ...DEFAULT_LIMITS, lines: f.limits.lines, description: f.limits.description, notes: f.limits.notes, max_total_minor: f.limits.max_total_minor },
    };
  };
  const kinds = (): LineKind[] => offeredKinds(info?.allowed_kinds);
  const money = (minor: number, currency: string) => formatMoney(minor, currency, lang);

  // ---------------------------------------------------------------- loading

  async function load(): Promise<void> {
    let res: ApiResult;
    try {
      res = await opts.fetchJson(QUOTE_PATH, { method: 'GET' });
    } catch {
      res = { status: 0, body: null };
    }
    if (destroyed) return;
    const o = classify(res);
    if (o.kind === 'ok') {
      info = o.body as unknown as QuoteInfo;
      loadFailed = false;
      if (!editing) form = startForm();
    } else if (o.kind === 'code_required') {
      opts.onCodeRequired?.();
      loadFailed = true;
    } else {
      loadFailed = true;
    }
    render();
    resolveReady();
    if (info) opts.onState?.(info.state);
  }

  function startForm(): ClaimForm {
    const s = settings();
    const f = newForm(s, info?.currency);
    f.lines = f.lines.filter((l) => kinds().includes(l.kind));
    const q = info?.quote;
    if (q && (q.state === 'submitted' || q.state === 'rejected')) {
      // a correction starts from what was sent
      const lines: LineDraft[] = [];
      for (const ln of q.lines) {
        const d = newLine(ln.kind, null);
        d.description = ln.description ?? '';
        if (ln.kind === 'labor') {
          d.hours = ln.hours ?? '';
          d.rate = minorToInput(ln.rate_minor);
        } else if (ln.kind === 'parts') {
          d.quantity = ln.quantity ?? '1';
          d.unit_price = minorToInput(ln.unit_minor);
        } else {
          d.amount = minorToInput(ln.amount_minor);
        }
        lines.push(d);
      }
      f.lines = lines;
      f.currency = q.currency;
      f.include_vat = q.vat_mode === 'included';
      f.notes = q.notes ?? '';
    }
    return f;
  }

  // ---------------------------------------------------------------- rendering

  function approvedRef(): { total_minor: number; currency: string } | null {
    const q = info?.quote;
    return q && q.state === 'approved' ? { total_minor: q.total_minor, currency: q.currency } : null;
  }

  function beforeDone(): boolean {
    return !ctx.claim && ctx.status !== 'done' && ctx.status !== 'closed' && ctx.status !== 'returned' && ctx.status !== 'claim';
  }

  function render(): void {
    if (destroyed) return;
    linesHost = figuresHost = errorHost = null;
    root.replaceChildren();
    const hasClaim = !!ctx.claim;
    const visible = hasClaim || (!!info && info.enabled) || loadFailed;
    root.hidden = !visible;
    if (!visible) return;
    const q: QuoteState = info?.state ?? 'none';
    const step = stepIndex(q, ctx.status, ctx.claim?.status ?? null);

    const head = el('header', 'swc-head');
    head.appendChild(el('h2', 'swc-title', t('cost_title')));
    root.appendChild(head);
    const flow = el('ol', 'swq-flow');
    (['step_quote', 'step_approval', 'step_work', 'step_demand', 'step_demand_ok', 'step_paid'] as QuoteTextKey[]).forEach((k, i) => {
      const li = el('li', i < step ? 'swq-done' : i === step ? 'swq-cur' : '', t(k));
      if (i === step) li.setAttribute('aria-current', 'step');
      flow.appendChild(li);
    });
    root.appendChild(flow);

    if (loadFailed && !info) {
      root.appendChild(el('p', 'swc-note swc-warn', t('q_error')));
      root.appendChild(btn(c('retry'), 'swc-btn', () => void refresh()));
      appendDemand(step);
      return;
    }
    if (beforeDone()) {
      const key: QuoteTextKey = q === 'approved' ? 'intro_ok' : q === 'submitted' ? 'intro_sent' : q === 'rejected' ? 'intro_fix' : 'intro_now';
      const intro = el('p', 'swc-note swq-intro', t(key));
      intro.dataset.costIntro = key;
      root.appendChild(intro);
    }
    root.appendChild(quotePart(q));
    appendDemand(step);
    if (lang === 'ar' || lang === 'ru') root.appendChild(el('p', 'swc-muted swq-tr', t('tr_note')));
  }

  function pill(text: string, tone: string): HTMLElement {
    return el('span', `swq-pill ${tone}`.trim(), text);
  }

  function partHead(title: QuoteTextKey, when: QuoteTextKey, pillEl: HTMLElement | null): HTMLElement {
    const h = el('h3', 'swc-sub swq-part-head');
    h.append(el('span', 'swq-part-title', t(title)), el('span', 'swc-muted', ` · ${t(when)}`));
    if (pillEl) h.appendChild(pillEl);
    return h;
  }

  function quotePart(q: QuoteState): HTMLElement {
    const box = el('div', 'swc-card swq-part');
    box.dataset.quotePart = q;
    const writable = !!info?.writable;
    const tone = q === 'approved' ? 'swq-ok' : q === 'rejected' ? 'swq-bad' : q === 'submitted' ? 'swq-acc' : '';
    const label: QuoteTextKey = q === 'approved' ? 'pill_ok' : q === 'rejected' ? 'pill_fix' : q === 'submitted' ? 'pill_sent' : writable ? 'pill_open' : 'pill_none';
    box.appendChild(partHead('q_title', 'q_when', pill(t(label), tone)));
    const quote = info?.quote ?? null;
    if (q === 'rejected' && quote) {
      const why = el('p', 'swc-note swc-warn');
      why.append(el('b', '', t('q_fix_text')), document.createTextNode(' '));
      const reason = el('span', '', quote.reason ?? '');
      reason.setAttribute('dir', 'auto');
      why.appendChild(reason);
      box.appendChild(why);
    } else if (q === 'submitted') box.appendChild(el('p', 'swc-note', t('q_sent_text')));
    else if (q === 'approved') box.appendChild(el('p', 'swc-status swc-ok', t('q_ok_text')));
    else if (!writable) box.appendChild(el('p', 'swc-muted', t('q_none_after')));

    const canEdit = writable && (q === 'none' || q === 'rejected' || q === 'submitted');
    const willEdit = canEdit && (q === 'none' || q === 'rejected' || editing);
    if (quote && q !== 'none' && !willEdit) {
      box.appendChild(summary(quote));
      if (canEdit && q === 'submitted') {
        box.appendChild(btn(t('q_edit'), 'swc-btn', () => {
          editing = true;
          form = startForm();
          render();
        }));
      }
    }
    if (willEdit) {
      editing = true;
      box.appendChild(editor(q));
    }
    return box;
  }

  function summary(quote: QuoteView): HTMLElement {
    const wrap = el('div', 'swq-summary');
    if (quote.on_behalf) {
      const by = el('p', 'swc-muted swq-on-behalf', t('q_on_behalf'));
      by.dataset.quoteOnBehalf = '';
      wrap.appendChild(by);
    }
    const list = el('ul', 'swc-rev-lines');
    for (const ln of quote.lines) {
      const li = el('li', 'swc-rev-line');
      const kind = c(`kind_${ln.kind}` as Parameters<typeof ct>[1]);
      li.appendChild(el('span', 'swc-rev-what', ln.description ? `${kind} - ${ln.description}` : kind));
      const amt = el('span', 'swc-amount', money(ln.total_minor, quote.currency));
      amt.setAttribute('dir', 'ltr');
      li.appendChild(amt);
      list.appendChild(li);
    }
    wrap.appendChild(list);
    const row = el('div', 'swc-total-row swc-grand');
    const total = el('span', 'swc-amount', money(quote.total_minor, quote.currency));
    total.setAttribute('dir', 'ltr');
    row.append(el('span', '', c('total')), total);
    wrap.appendChild(row);
    if (quote.notes) {
      const n = el('p', 'swc-muted', quote.notes);
      n.setAttribute('dir', 'auto');
      wrap.appendChild(n);
    }
    return wrap;
  }

  function appendDemand(step: number): void {
    const box = el('div', ctx.claim ? 'swc-card swq-part' : 'swc-card swq-part swq-dim');
    box.dataset.demandPart = ctx.claim ? 'open' : 'later';
    box.appendChild(partHead('d_title', 'd_when', ctx.claim ? null : pill(t('pill_later'), '')));
    const ref = approvedRef();
    if (ref && (ctx.claim || step >= 3)) {
      const p = el('p', 'swc-muted swq-ref', t('q_ref', { amount: money(ref.total_minor, ref.currency) }));
      p.dataset.quoteRef = String(ref.total_minor);
      box.appendChild(p);
    }
    box.appendChild(opts.demandSlot);
    root.appendChild(box);
  }

  // ---------------------------------------------------------------- the editor

  function editor(q: QuoteState): HTMLElement {
    const s = settings();
    const f = el('div', 'swc-form');
    if (s?.vat.exempt) {
      f.appendChild(el('p', 'swc-muted', c('vat_none')));
    } else {
      const seg = el('div', 'swc-seg');
      seg.setAttribute('role', 'radiogroup');
      const opt = (include: boolean, label: string) => {
        const b = btn(label, 'swc-seg-btn', () => {
          form.include_vat = include;
          for (const x of seg.querySelectorAll('button')) x.setAttribute('aria-checked', String(x === b));
          paintFigures();
        });
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(form.include_vat === include));
        seg.appendChild(b);
      };
      opt(true, c('vat_included'));
      opt(false, c('vat_excluded'));
      f.appendChild(seg);
    }
    f.appendChild(el('h4', 'swc-sub', c('lines_title')));
    linesHost = el('div', 'swc-lines');
    f.appendChild(linesHost);
    renderLines();
    const add = el('div', 'swc-row swc-add');
    for (const k of kinds()) {
      add.appendChild(btn(`+ ${c(`kind_${k}` as Parameters<typeof ct>[1])}`, 'swc-btn swc-small', () => {
        if (form.lines.length >= (s?.limits.lines ?? 30)) return;
        form.lines.push(newLine(k, s));
        renderLines();
        paintFigures();
        linesHost?.querySelectorAll<HTMLInputElement>('.swc-line:last-child input')[0]?.focus();
      }, `${c('line_add')}: ${c(`kind_${k}` as Parameters<typeof ct>[1])}`));
    }
    f.appendChild(add);
    figuresHost = el('div', 'swc-figures');
    f.appendChild(figuresHost);
    errorHost = el('p', 'swc-error');
    errorHost.hidden = true;
    f.appendChild(errorHost);

    const lab = el('label', 'swc-field');
    lab.appendChild(el('span', 'swc-label', `${c('notes')} ${c('optional')}`));
    const notes = el('textarea', 'swc-input swc-area');
    notes.value = form.notes;
    notes.maxLength = s?.limits.notes ?? 1000; // TKFIX260 (public-surface review F7): the server refuses more (quotes.NOTE_MAX)
    notes.addEventListener('input', () => {
      form.notes = notes.value;
    });
    lab.appendChild(notes);
    f.appendChild(lab);

    const bannerEl = el('div', 'swc-banner-host');
    if (banner) {
      const b = el('div', `swc-banner swc-${banner.tone}`);
      b.setAttribute('role', 'alert');
      b.appendChild(el('span', '', banner.text));
      bannerEl.appendChild(b);
    }
    f.appendChild(bannerEl);

    const actions = el('div', 'swc-row swc-actions');
    const send = btn(submitting ? t('q_sending') : q === 'none' ? t('q_send') : t('q_resend'), 'swc-btn swc-primary', () => void doSubmit());
    send.dataset.quoteSend = '';
    send.disabled = submitting;
    actions.appendChild(send);
    if (q === 'submitted') {
      actions.appendChild(btn(t('q_cancel_edit'), 'swc-btn', () => {
        editing = false;
        banner = null;
        render();
      }));
    }
    f.appendChild(actions);
    queueMicrotask(() => {
      paintFigures();
      paintErrors();
    });
    return f;
  }

  function renderLines(): void {
    if (!linesHost) return;
    linesHost.replaceChildren();
    form.lines.forEach((ln, i) => linesHost!.appendChild(lineRow(ln, i)));
  }

  function lineRow(ln: LineDraft, i: number): HTMLElement {
    const row = el('div', 'swc-line');
    const top = el('div', 'swc-line-top');
    const sel = el('select', 'swc-input swc-kind');
    sel.setAttribute('aria-label', c('line_kind'));
    for (const k of kinds()) {
      const o = el('option', '', c(`kind_${k}` as Parameters<typeof ct>[1]));
      o.value = k;
      o.selected = k === ln.kind;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      const next = newLine(sel.value as LineKind, settings(), ln.key);
      next.description = ln.description;
      form.lines[i] = next;
      renderLines();
      paintFigures();
    });
    top.appendChild(sel);
    const total = el('span', 'swc-amount swc-line-total');
    total.setAttribute('dir', 'ltr');
    total.dataset.line = String(i);
    top.appendChild(total);
    top.appendChild(btn('✕', 'swc-btn swc-icon', () => {
      form.lines.splice(i, 1);
      renderLines();
      paintFigures();
    }, c('line_remove')));
    row.appendChild(top);

    const num = (key: 'hours' | 'rate' | 'quantity' | 'unit_price' | 'amount', label: Parameters<typeof ct>[1]) => {
      const lab = el('label', 'swc-field swc-num');
      lab.appendChild(el('span', 'swc-label', c(label)));
      const input = el('input', 'swc-input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.setAttribute('dir', 'ltr');
      input.dataset.quoteField = key;
      input.value = ln[key];
      input.addEventListener('input', () => {
        ln[key] = input.value;
        paintFigures();
        if (showErrors) paintErrors();
      });
      lab.appendChild(input);
      return lab;
    };
    const nums = el('div', 'swc-nums');
    if (ln.kind === 'labor') nums.append(num('hours', 'f_hours'), num('rate', 'f_rate'));
    else if (ln.kind === 'parts') nums.append(num('quantity', 'f_quantity'), num('unit_price', 'f_unit_price'));
    else nums.append(num('amount', 'f_amount'));
    row.appendChild(nums);

    const needDesc = ln.kind === 'parts' || ln.kind === 'other';
    const dlab = el('label', 'swc-field');
    dlab.appendChild(el('span', 'swc-label', needDesc ? c('f_description') : `${c('f_description')} ${c('optional')}`));
    const d = el('input', 'swc-input');
    d.type = 'text';
    d.value = ln.description;
    d.dataset.quoteField = 'description';
    d.maxLength = (settings()?.limits.description ?? 120) * 2;
    d.addEventListener('input', () => {
      ln.description = d.value;
      if (showErrors) paintErrors();
    });
    dlab.appendChild(d);
    row.appendChild(dlab);
    return row;
  }

  function paintFigures(): void {
    const s = settings();
    const fig = computeForm(form, s);
    if (linesHost) {
      for (const node of linesHost.querySelectorAll<HTMLElement>('.swc-line-total')) {
        const v = fig.lines[Number(node.dataset.line)];
        node.textContent = v === null || v === undefined ? '' : money(v, form.currency);
      }
    }
    if (!figuresHost) return;
    figuresHost.replaceChildren();
    const row = (label: string, minor: number, cls = '') => {
      const r = el('div', `swc-total-row ${cls}`.trim());
      const a = el('span', 'swc-amount', money(minor, form.currency));
      a.setAttribute('dir', 'ltr');
      r.append(el('span', '', label), a);
      figuresHost!.appendChild(r);
    };
    if (fig.vatMode !== 'none') {
      row(c('net'), fig.net);
      row(c('vat', { rate: formatRate(fig.rateBp) }), fig.vat);
    }
    row(c('total'), fig.total, 'swc-grand');
    figuresHost.appendChild(el('p', 'swc-muted swc-small-text', c('estimate_note')));
  }

  function paintErrors(): void {
    if (!errorHost) return;
    const errs = showErrors ? validateForm(form, { settings: settings(), docs: { docs: [] } }) : [];
    const first = errs[0];
    errorHost.hidden = !first;
    errorHost.textContent = first ? (first.field === 'lines' && first.code === 'required' ? c('e_lines_required') : errorText(lang, first.code)) : '';
  }

  // ---------------------------------------------------------------- sending

  async function doSubmit(): Promise<void> {
    if (submitting || destroyed) return;
    showErrors = true;
    const errs = validateForm(form, { settings: settings(), docs: { docs: [] } });
    paintErrors();
    if (errs.length) return;
    submitting = true;
    banner = null;
    render();
    pendingCrid = pendingCrid ?? newRequestId(); // the same id while the outcome is unknown: a retry never makes a second quote
    const { documents: _d, vendor_ref: _v, no_charge: _n, ...body } = buildPayload(form, { docs: [] }, settings(), pendingCrid) as unknown as Record<string, unknown>;
    let res: ApiResult;
    try {
      res = await opts.fetchJson(QUOTE_PATH, { method: 'POST', body });
    } catch {
      res = { status: 0, body: null };
    }
    submitting = false;
    if (destroyed) return;
    const o = classify(res);
    if (o.kind === 'retry') {
      banner = { tone: 'warn', text: c('saved_offline') };
      render();
      return;
    }
    pendingCrid = null;
    if (o.kind === 'ok') {
      editing = false;
      showErrors = false;
      await load();
      return;
    }
    if (o.kind === 'code_required') {
      opts.onCodeRequired?.();
      render();
      return;
    }
    const code = o.kind === 'refused' ? o.code : 'error';
    const field = o.kind === 'refused' ? o.fields?.[0]?.code : undefined;
    const text = code === 'quote_closed' ? t('e_quote_closed') : field === 'kind_not_allowed' || code === 'kind_not_allowed' ? t('e_kind_not_allowed') : errorText(lang, field ?? code);
    banner = { tone: 'error', text };
    if (code === 'quote_closed') editing = false;
    if (code === 'quote_closed') await load();
    else render();
  }

  async function refresh(): Promise<void> {
    await load();
  }

  root.appendChild(el('p', 'swc-muted', t('q_loading')));
  void load();

  return {
    element: root,
    update(next) {
      const changed = next.status !== ctx.status || (next.claim?.status ?? null) !== (ctx.claim?.status ?? null) || !!next.claim !== !!ctx.claim;
      ctx = next;
      if (changed && info) {
        // the status moved (e.g. "done"): the quote may have closed - ask the server, then draw
        void load();
      }
    },
    refresh,
    ready,
    approved: approvedRef,
    quoteState: () => info?.state ?? null,
    destroy() {
      destroyed = true;
      root.remove();
    },
  };
}
