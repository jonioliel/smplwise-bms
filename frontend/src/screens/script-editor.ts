import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ScriptDraft, ScriptField } from '../api/automations';
import { icon } from './automation-builder-icons';
import { AutomationEditorBase } from './automation-editor-base';
import { FIELD_KIND_LABEL, ROOT, clone, fieldSummary, newField, type FieldKind } from './automation-editor-logic';

const FIELD_ICON: Record<string, string> = { number: 'thermo', entity: 'layers', boolean: 'check', select: 'list', text: 'edit', locked: 'lock' };
const FIELD_KINDS: FieldKind[] = ['number', 'boolean', 'select', 'text', 'entity'];

/**
 * CR-017 S4: the script editor (CR §4.4; mockup 44): the name, the fields form definition (the five selector kinds: number, yes/no, choice, text, device;
 * any other selector is shown locked and kept as it is) and the sequence built with the SAME block editor as an automation's actions (one code path:
 * automation-editor-base.ts). "הרץ עכשיו" runs the saved script with the fields' defaults.
 *
 *   <script-editor .itemId=${id} .mode=${'edit' | 'create'} @saved @cancel @deleted></script-editor>
 */
@customElement('script-editor')
export class ScriptEditor extends AutomationEditorBase {
  @state() private openField: number | null = null;
  @state() private adding = false;

  protected get kind() { return 'script' as const; }
  protected get nameLabel() { return 'שם הסקריפט'; }
  protected subtitleNew() { return 'סקריפט חדש'; }
  protected blankDraft(): ScriptDraft {
    return { alias: '', description: '', icon: null, mode: 'single', max: null, fields: [], sequence: [] };
  }

  static styles = [
    ...AutomationEditorBase.styles,
    css`
      .fieldlist {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .frow2 {
        display: flex;
        flex-direction: column;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
      }
      .frow2.open {
        border-color: color-mix(in srgb, var(--dv-accent) 50%, transparent);
        box-shadow: 0 0 0 4px var(--dv-accent-soft);
        background: var(--dv-surface-solid, var(--dv-surface));
      }
      .frow2.bad {
        border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
      }
      .frow2 .h {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px 6px 6px;
        min-block-size: 56px;
      }
      .frow2 .main {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 0;
        background: transparent;
        text-align: start;
        min-block-size: 44px;
      }
      .frow2 .rg {
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        font-size: var(--sw-fs-lg);
        flex: none;
      }
      .frow2 .nm {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: var(--sw-fs-md);
        font-weight: 600;
      }
      .frow2 .nm small {
        font-size: var(--sw-fs-sm);
        font-weight: 500;
        color: var(--dv-text-2);
      }
      .frow2 .x {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        color: var(--dv-text-3);
        display: grid;
        place-items: center;
        font-size: var(--sw-fs-lg);
      }
      .frow2 .x:hover {
        background: var(--dv-surface-3);
        color: var(--dv-danger);
      }
      .frow2 .edit {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 4px 14px 14px;
        border-block-start: 1px solid var(--dv-border);
        padding-block-start: 12px;
      }
    `,
  ];

  protected footerExtras(): TemplateResult | typeof nothing {
    return nothing;
  }

  private setFields(fn: (f: ScriptField[]) => void) {
    if (!this.draft) return;
    const d = clone(this.draft) as ScriptDraft;
    fn(d.fields);
    this.change(d);
  }

  private fieldEditor(f: ScriptField, i: number) {
    const set = (fn: (x: ScriptField) => void) => this.setFields((l) => fn(l[i]));
    const s = f.selector;
    const num = (v: number | undefined, on: (n: number | undefined) => void, attr: string) => html`<label class="inp"><input class="n" type="text" inputmode="decimal" data-fld=${attr} aria-label=${attr} .value=${v === undefined ? '' : String(v)}
      @change=${(e: Event) => { const t = (e.target as HTMLInputElement).value.trim().replace(',', '.'); const n = t === '' ? undefined : Number(t); on(n !== undefined && Number.isFinite(n) ? n : undefined); }} /></label>`;
    return html`<div class="edit" data-field-edit=${i}>
      <div class="frow">
        <div class="fld"><label>שם השדה</label><label class="inp"><input data-fld="field.name" aria-label="שם השדה" dir="auto" .value=${f.name} @input=${(e: Event) => set((x) => { x.name = (e.target as HTMLInputElement).value; })} /></label></div>
        <div class="fld"><label>מפתח (לטינית)</label><label class="inp"><input data-fld="field.key" aria-label="מפתח" dir="ltr" .value=${f.key} @change=${(e: Event) => set((x) => { x.key = (e.target as HTMLInputElement).value.trim(); })} /></label></div>
      </div>
      <div class="frow">
        <div class="fld"><label>סוג</label><select class="selx" data-fld="field.kind" aria-label="סוג" @change=${(e: Event) => { const k = (e.target as HTMLSelectElement).value as FieldKind; set((x) => { x.selector = newField(k, []).selector; x.default = undefined; }); }}>
          ${FIELD_KINDS.map((k) => html`<option value=${k} ?selected=${s.kind === k}>${FIELD_KIND_LABEL[k]}</option>`)}</select></div>
        <div class="fld sm"><label>חובה</label><div class="rolechips"><button type="button" aria-pressed=${f.required} data-field-required @click=${() => set((x) => { x.required = !x.required; })}>${f.required ? 'חובה' : 'לא חובה'}</button></div></div>
      </div>
      ${s.kind === 'number' ? html`<div class="frow"><div class="fld sm"><label>מינימום</label>${num(s.min, (n) => set((x) => { if (x.selector.kind === 'number') x.selector.min = n ?? 0; }), 'field.min')}</div>
        <div class="fld sm"><label>מקסימום</label>${num(s.max, (n) => set((x) => { if (x.selector.kind === 'number') x.selector.max = n ?? 100; }), 'field.max')}</div>
        <div class="fld sm"><label>צעד</label>${num(s.step, (n) => set((x) => { if (x.selector.kind === 'number') { if (n) x.selector.step = n; else delete x.selector.step; } }), 'field.step')}</div>
        <div class="fld sm"><label>ברירת מחדל</label>${num(typeof f.default === 'number' ? f.default : undefined, (n) => set((x) => { x.default = n; }), 'field.default')}</div></div>` : nothing}
      ${s.kind === 'select' ? html`<div class="fld full"><label>אפשרויות (אחת בכל שורה)</label><label class="inp area"><textarea rows="3" data-fld="field.options" aria-label="אפשרויות" .value=${s.options.join('\n')}
        @change=${(e: Event) => set((x) => { if (x.selector.kind === 'select') x.selector.options = (e.target as HTMLTextAreaElement).value.split('\n').map((o) => o.trim()).filter(Boolean); })}></textarea></label></div>` : nothing}
      ${s.kind === 'entity' ? html`<div class="fld full"><label>סוגי מכשיר (לטינית, מופרדים בפסיק; ריק = הכל)</label><label class="inp"><input data-fld="field.domains" aria-label="סוגי מכשיר" dir="ltr" .value=${s.domains.join(', ')}
        @change=${(e: Event) => set((x) => { if (x.selector.kind === 'entity') x.selector.domains = (e.target as HTMLInputElement).value.split(',').map((o) => o.trim()).filter(Boolean); })} /></label></div>` : nothing}
    </div>`;
  }

  protected renderBuilderBody() {
    const d = this.draft as ScriptDraft;
    const by = this.issues;
    return html`${this.renderConflict()}${this.renderBanners()}${this.renderSentence()}${this.renderValidation()}
      <section class="bsec2" data-section="fields">
        <h4><span class="k if">${icon('list', 14)}</span>שדות<small>${d.fields.length ? d.fields.length : 'אין'}</small></h4>
        <div class="fieldlist">${d.fields.map((f, i) => {
          const open = this.openField === i;
          const bad = by.some((x) => x.path === `fields.${i}`);
          return html`<div class="frow2 ${open ? 'open' : ''} ${bad ? 'bad' : ''}" data-field=${f.key}>
            <div class="h">
              <button class="main" type="button" aria-expanded=${open} data-field-main @click=${() => (this.openField = open ? null : i)}>
                <span class="rg">${icon(FIELD_ICON[f.selector.kind] ?? 'list')}</span><span class="nm">${f.name || 'שדה חדש'}<small>${fieldSummary(f)}</small></span><code>${f.key}</code></button>
              ${this.hardReadOnly ? nothing : html`<button class="x" type="button" aria-label="מחיקת השדה" data-field-remove @click=${() => { this.setFields((l) => l.splice(i, 1)); this.openField = null; }}>${icon('close')}</button>`}
            </div>
            ${open && f.selector.kind !== 'locked' ? this.fieldEditor(f, i) : open ? html`<div class="edit"><div class="codenote">${icon('lock')}שדה מתקדם – נשמר כמו שהוא.</div></div>` : nothing}
          </div>`;
        })}</div>
        ${this.hardReadOnly || d.fields.length >= 12 ? nothing : this.adding
          ? html`<div class="rolechips" data-field-kinds>${FIELD_KINDS.map((k) => html`<button type="button" data-field-kind=${k} @click=${() => { this.adding = false; this.setFields((l) => l.push(newField(k, l.map((x) => x.key)))); this.openField = d.fields.length; }}>${FIELD_KIND_LABEL[k]}</button>`)}</div>`
          : html`<button class="addblk" type="button" data-add-field @click=${() => (this.adding = true)}>${icon('plus')}הוסף שדה</button>`}
      </section>
      <section class="bsec2" data-section="action">
        <h4><span class="k then">${icon('play', 14)}</span>אז<small>${d.sequence.length ? `${d.sequence.length} צעדים` : 'מה לעשות'}</small></h4>
        ${this.renderList(ROOT, 'sequence', 'action')}
      </section>
      ${this.renderOptionsBox(this.renderDeleteRow())}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'script-editor': ScriptEditor;
  }
}
