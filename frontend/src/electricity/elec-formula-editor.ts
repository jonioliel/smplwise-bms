/**
 * CR-023 §6 / owner decision 1: the friendly formula editor of the account wizard (step 2). Presets (sum, main minus sub-meters,
 * a percentage of one meter, free formula) produce a formula the person keeps editing; a token builder (meter chips with their
 * last-period value, the "+ מונה" menu, + − × % ( ), the number-entry dialog, delete) and a text mode for power users
 * (`[לוח סטודיו] + 30% * [תאורת לובי]`, parsed by the same grammar); a readable sentence; a live check on the last full period
 * (each meter's consumption and the result). Errors block "הבא": unbalanced parentheses, an unknown meter name, a meter times a
 * meter, a negative result. Emits `change` with `{tokens, ast, valid, preset}`.
 */
import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { elec, elecErrorText, type ElecMeter, type FormulaPreview } from '../api/electricity-billing';
import { SkinController } from '../design/skin';
import { elecCss } from './elec-css';
import './elec-ui';
import { alertBox, n } from './elec-ui';
import { f2, fmtDate } from './elec-format';
import { PRESETS, detectPreset, parseTokens, presetTokens, sentence, textToTokens, tokensToText, type Issue, type PresetId, type Tok, type Op } from './elec-formula';

export interface FormulaChange {
  tokens: Tok[];
  ast: ReturnType<typeof parseTokens>['ast'];
  valid: boolean;
  preset: PresetId;
}

@customElement('elec-formula-editor')
export class ElecFormulaEditor extends LitElement {
  /** the meters the account uses (step 1) */
  @property({ attribute: false }) meters: ElecMeter[] = [];
  @property({ attribute: false }) tokens: Tok[] = [];
  @state() private preset: PresetId = 'custom';
  @state() private mode: 'builder' | 'text' = 'builder';
  @state() private text = '';
  @state() private textIssues: Issue[] = [];
  @state() private selected = -1;
  @state() private menu = false;
  @state() private numOpen = false;
  @state() private numVal = '';
  @state() private numPct = true;
  @state() private numErr = '';
  @state() private mainId = '';
  @state() private pctVal = '30';
  @state() private preview: FormulaPreview | null = null;
  @state() private previewErr = '';
  protected skin = new SkinController(this);
  private seq = 0;
  private timer = 0;
  private lastKey = '';

  static styles = [
    elecCss,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      textarea.code {
        min-block-size: 76px;
        font-size: 15px;
      }
    `,
  ];

  private nameOf = (id: string): string => this.meters.find((m) => m.id === id)?.name ?? id;
  private idOf = (name: string): string | null => this.meters.find((m) => m.name.trim() === name.trim())?.id ?? null;
  private lastOf = (id: string): number | null => this.meters.find((m) => m.id === id)?.last_period_kwh ?? null;

  willUpdate(ch: PropertyValues) {
    if (ch.has('meters') && !this.mainId) this.mainId = this.meters[0]?.id ?? '';
    if (ch.has('tokens') && this.tokens.length) this.preset = detectPreset(this.tokens, this.meters.map((m) => m.id));
  }

  updated(ch: PropertyValues) {
    if (ch.has('tokens')) {
      // a change from outside (the parent seeds a preset, or the wizard re-enters): keep the preset highlight honest and re-check
      this.selected = Math.min(this.selected, this.tokens.length - 1);
      if (this.mode === 'text' && !this.textIssues.length) this.text = tokensToText(this.tokens, this.nameOf);
      this.scheduleCheck();
    }
  }

  private parse() {
    return parseTokens(this.tokens);
  }

  private emit(tokens: Tok[], preset: PresetId = this.preset) {
    this.preset = preset;
    this.tokens = tokens;
    this.selected = -1;
    const r = parseTokens(tokens);
    const detail: FormulaChange = { tokens, ast: r.ast, valid: !r.issues.length && !!r.ast, preset };
    this.dispatchEvent(new CustomEvent<FormulaChange>('change', { detail, bubbles: true, composed: true }));
  }
  private edit(tokens: Tok[]) {
    this.emit(tokens, detectPreset(tokens, this.meters.map((m) => m.id)));
  }

  /** the live check on the last full period: the server's answer (the mock imitates it) once the grammar is fine */
  private scheduleCheck() {
    window.clearTimeout(this.timer);
    const r = this.parse();
    const key = JSON.stringify(r.ast);
    if (!r.ast || r.issues.length) {
      this.preview = null;
      this.previewErr = '';
      this.lastKey = '';
      return;
    }
    if (key === this.lastKey) {
      this.emitChecked();
      return;
    }
    this.timer = window.setTimeout(() => void this.runCheck(r.ast as NonNullable<typeof r.ast>, key), 150);
  }
  private async runCheck(ast: NonNullable<ReturnType<typeof parseTokens>['ast']>, key: string) {
    const id = ++this.seq;
    try {
      const p = await elec().checkFormula(ast);
      if (id !== this.seq) return;
      this.lastKey = key;
      this.preview = p;
      this.previewErr = '';
    } catch (e) {
      if (id !== this.seq) return;
      this.preview = null;
      this.previewErr = elecErrorText(e);
    }
    this.emitChecked();
  }
  private emitChecked() {
    const ok = !!this.preview && !this.preview.negative && !this.previewErr;
    this.dispatchEvent(new CustomEvent('checked', { detail: { ok, result: this.preview?.result_kwh ?? null, negative: this.preview?.negative ?? false, error: this.previewErr }, bubbles: true, composed: true }));
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.timer);
  }

  // ---------------------------------------------------------------- presets
  private applyPreset(p: PresetId) {
    const ids = this.meters.map((m) => m.id);
    if (p === 'custom') {
      this.preset = 'custom';
      return;
    }
    const toks = p === 'pct' ? presetTokens('pct', [this.mainId || ids[0]], { pct: this.pctVal }) : presetTokens(p, ids, { main: this.mainId });
    this.emit(toks, p);
  }

  // ---------------------------------------------------------------- builder actions
  private add(t: Tok) {
    const toks = [...this.tokens];
    const at = this.selected >= 0 ? this.selected + 1 : toks.length;
    toks.splice(at, 0, t);
    this.edit(toks);
    this.selected = at;
  }
  private addMeter(id: string) {
    this.menu = false;
    this.add({ t: 'm', id });
  }
  private addOp(v: Op) {
    this.add({ t: 'op', v });
  }
  private togglePercent() {
    const i = this.selected >= 0 ? this.selected : this.tokens.length - 1;
    const t = this.tokens[i];
    if (t?.t !== 'n') return;
    const toks = [...this.tokens];
    toks[i] = { ...t, pct: !t.pct };
    this.edit(toks);
    this.selected = i;
  }
  private backspace() {
    const toks = [...this.tokens];
    const i = this.selected >= 0 ? this.selected : toks.length - 1;
    if (i < 0) return;
    toks.splice(i, 1);
    this.edit(toks);
    this.selected = Math.min(i - 1, toks.length - 1);
  }
  private confirmNumber() {
    const raw = this.numVal.trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(raw) || Number(raw) <= 0) {
      this.numErr = 'צריך להקליד מספר גדול מאפס';
      return;
    }
    if (this.numPct && Number(raw) > 1000) {
      this.numErr = 'האחוז גדול מדי';
      return;
    }
    this.numOpen = false;
    this.numErr = '';
    this.add({ t: 'n', v: raw, pct: this.numPct });
    this.numVal = '';
  }

  // ---------------------------------------------------------------- text mode
  private setMode(m: 'builder' | 'text') {
    if (m === this.mode) return;
    if (m === 'text') {
      this.text = tokensToText(this.tokens, this.nameOf);
      this.textIssues = [];
    } else if (this.textIssues.length) {
      // leaving text mode with an unparsed text: keep the last good tokens
      this.textIssues = [];
    }
    this.mode = m;
  }
  private onText(e: Event) {
    this.text = (e.target as HTMLTextAreaElement).value;
    const r = textToTokens(this.text, this.idOf);
    this.textIssues = r.issues;
    if (!r.issues.length) this.edit(r.toks);
    else {
      // a text that does not resolve is not a valid formula: tell the parent
      const detail: FormulaChange = { tokens: this.tokens, ast: null, valid: false, preset: this.preset };
      this.dispatchEvent(new CustomEvent<FormulaChange>('change', { detail, bubbles: true, composed: true }));
    }
  }

  // ---------------------------------------------------------------- render
  private tok(t: Tok, i: number, bad: Set<number>) {
    const cls = `tok ${t.t === 'm' ? 'm' : t.t === 'op' ? 'op' : 'k'} ${bad.has(i) ? 'bad' : ''} ${this.selected === i ? 'sel' : ''}`;
    const click = () => (this.selected = this.selected === i ? -1 : i);
    if (t.t === 'm') {
      const last = this.lastOf(t.id);
      return html`<button type="button" class=${cls} data-tok="meter" aria-pressed=${this.selected === i} @click=${click}>${this.nameOf(t.id)}${last !== null ? html`<small class="num">${f2(last)}</small>` : nothing}</button>`;
    }
    if (t.t === 'op') return html`<button type="button" class=${cls} data-tok="op" aria-pressed=${this.selected === i} aria-label=${t.v === '*' ? 'כפל' : t.v === '-' ? 'מינוס' : t.v === '+' ? 'פלוס' : t.v === '/' ? 'חילוק' : t.v} @click=${click}>${t.v === '*' ? '×' : t.v === '-' ? '−' : t.v === '/' ? '÷' : t.v}</button>`;
    return html`<button type="button" class=${cls} data-tok="num" aria-pressed=${this.selected === i} @click=${click}><span class="num">${t.v}${t.pct ? '%' : ''}</span></button>`;
  }

  render() {
    const r = this.parse();
    const bad = new Set(r.issues.map((x) => x.at).filter((x) => x >= 0));
    const pv = this.preview;
    const negative = !!pv?.negative;
    const issues: string[] = this.mode === 'text' && this.textIssues.length ? this.textIssues.map((i) => i.message) : r.issues.map((i) => i.message);
    const wrongErr = issues.length || negative || this.previewErr;
    const ok = !issues.length && !negative && !this.previewErr && !!r.ast && !!pv;
    const sent = this.tokens.length ? sentence(this.tokens, this.nameOf) : '';
    const dup = r.warnings;
    return html`<div data-elec="formula-editor" data-formula-state=${wrongErr ? 'error' : ok ? 'ok' : 'pending'} data-preset=${this.preset}>
      <div class="presets" role="group" aria-label="תבנית נוסחה">
        ${PRESETS.map((p) => html`<button type="button" class="preset" data-preset-btn=${p.id} aria-pressed=${this.preset === p.id} @click=${() => this.applyPreset(p.id)}><b>${p.label}</b><span>${p.hint}</span></button>`)}
      </div>
      ${this.preset === 'mainsub' || this.preset === 'pct'
        ? html`<div class="row">
            <div class="fld" style="min-inline-size:200px"><label for="main">${this.preset === 'pct' ? 'מונה' : 'מונה ראשי'}</label>
              <select id="main" data-preset-main @change=${(e: Event) => { this.mainId = (e.target as HTMLSelectElement).value; this.applyPreset(this.preset); }}>
                ${this.meters.map((m) => html`<option value=${m.id} ?selected=${m.id === this.mainId}>${m.name}</option>`)}
              </select></div>
            ${this.preset === 'pct'
              ? html`<div class="fld" style="inline-size:120px"><label for="pct">אחוז</label><input id="pct" class="ltr" data-preset-pct inputmode="decimal" .value=${this.pctVal} @input=${(e: Event) => { this.pctVal = (e.target as HTMLInputElement).value; if (Number(this.pctVal) > 0) this.applyPreset('pct'); }} /></div>`
              : nothing}
          </div>`
        : nothing}
      <div class="row"><b class="h3">הנוסחה</b><span class="sp"></span>
        <div class="seg" role="group" aria-label="מצב עריכה">
          <button type="button" data-mode="builder" aria-pressed=${this.mode === 'builder'} @click=${() => this.setMode('builder')}>בונה</button>
          <button type="button" data-mode="text" aria-pressed=${this.mode === 'text'} @click=${() => this.setMode('text')}>טקסט</button>
        </div>
      </div>
      ${this.mode === 'text'
        ? html`<textarea class="code ${this.textIssues.length ? 'err' : ''}" data-text aria-label="נוסחה בטקסט" dir="ltr" spellcheck="false" .value=${this.text} @input=${this.onText}></textarea>
            <div class="mut">שמות מונים בסוגריים מרובעים. פעולות: + − × ( ) ומספרים או אחוזים.</div>`
        : html`<div class="expr ${issues.length || negative ? 'err' : ''}" data-expr>
              ${this.tokens.length ? this.tokens.map((t, i) => this.tok(t, i, bad)) : html`<span class="mut">הוסיפו מונה או בחרו תבנית</span>`}
            </div>
            <div class="pal">
              <div class="menu">
                <button type="button" class="btn" data-add-meter aria-expanded=${this.menu} aria-haspopup="listbox" @click=${() => (this.menu = !this.menu)}>+ מונה ▾</button>
                ${this.menu
                  ? html`<div class="pop" role="listbox" data-meter-menu>
                      ${this.meters.map((m) => html`<button type="button" role="option" data-meter-option=${m.id} @click=${() => this.addMeter(m.id)}><span>${m.name}</span>${m.last_period_kwh !== null ? html`<span class="mut num">${f2(m.last_period_kwh)}</span>` : nothing}</button>`)}
                    </div>`
                  : nothing}
              </div>
              ${(['+', '-', '*'] as Op[]).map((v) => html`<button type="button" class="btn" data-op=${v} aria-label=${v === '+' ? 'פלוס' : v === '-' ? 'מינוס' : 'כפל'} @click=${() => this.addOp(v)}>${v === '*' ? '×' : v === '-' ? '−' : v}</button>`)}
              <button type="button" class="btn" data-op="percent" aria-label="אחוז" @click=${() => this.togglePercent()}>%</button>
              <button type="button" class="btn" data-op="(" aria-label="סוגר פותח" @click=${() => this.addOp('(')}>(</button>
              <button type="button" class="btn" data-op=")" aria-label="סוגר סוגר" @click=${() => this.addOp(')')}>)</button>
              <button type="button" class="btn" data-number-btn @click=${() => { this.numOpen = true; this.numErr = ''; }}>מספר</button>
              <span class="sp"></span>
              <button type="button" class="btn ghost" data-backspace @click=${() => this.backspace()}>⌫ מחיקה</button>
            </div>`}
      ${sent ? html`<div class="mut" data-sentence>${sent}</div>` : nothing}
      ${issues.map((m) => alertBox('err', m))}
      ${dup.map((m) => alertBox('warn', m))}
      ${negative && pv ? alertBox('err', html`התוצאה שלילית בתקופה האחרונה (${n(f2(pv.result_kwh ?? 0))} קוט״ש). בדקו את הסימנים בנוסחה.`) : nothing}
      ${this.previewErr ? alertBox('err', this.previewErr) : nothing}
      ${ok ? alertBox('ok', 'הנוסחה תקינה') : nothing}
      ${pv && !issues.length ? this.renderPreview(pv) : nothing}
      <elec-dialog heading="הוספת מספר" ?open=${this.numOpen} data-number-dialog @close=${() => (this.numOpen = false)}>
        <div class="fld"><label for="numv">ערך</label>
          <input id="numv" class="ltr ${this.numErr ? 'err' : ''}" data-number-input inputmode="decimal" .value=${this.numVal} @input=${(e: Event) => { this.numVal = (e.target as HTMLInputElement).value; this.numErr = ''; }} @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.confirmNumber()} />
          ${this.numErr ? html`<div class="msg" role="alert">${this.numErr}</div>` : nothing}</div>
        <div class="seg" role="group" aria-label="סוג">
          <button type="button" data-number-kind="pct" aria-pressed=${this.numPct} @click=${() => (this.numPct = true)}>אחוז</button>
          <button type="button" data-number-kind="num" aria-pressed=${!this.numPct} @click=${() => (this.numPct = false)}>מספר</button>
        </div>
        <button slot="actions" type="button" class="btn pri" data-number-ok @click=${() => this.confirmNumber()}>הוספה</button>
        <button slot="actions" type="button" class="btn" @click=${() => (this.numOpen = false)}>ביטול</button>
      </elec-dialog>
    </div>`;
  }

  private renderPreview(pv: FormulaPreview) {
    return html`<div class="card soft" data-formula-preview>
      <div class="hd"><b class="h3">בדיקה על ${pv.period_from ? `${fmtDate(pv.period_from)} - ${fmtDate(pv.period_to)}` : 'התקופה האחרונה'}</b></div>
      <div class="scrollx"><table class="t"><thead><tr><th>מונה</th><th class="num">צריכה (קוט״ש)</th></tr></thead>
        <tbody>${pv.rows.map((r) => html`<tr><td>${r.name}</td><td class="num">${f2(r.kwh)}</td></tr>`)}</tbody>
        <tfoot><tr><td>צריכת החשבון</td><td class="num ${pv.negative ? 'bad' : ''}" data-formula-result>${f2(pv.result_kwh ?? 0)}</td></tr></tfoot></table></div>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-formula-editor': ElecFormulaEditor;
  }
}
