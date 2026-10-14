import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-toggle';
import '../components/sw-button';
import '../components/sw-state-panel';
import { settingsStyles } from '../styles/settings';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { bidi } from '../i18n/bidi';
import { ApiError, describeError } from '../api/client';
import { messagesApi, type MessageLang, type MessagePurpose, type MessageTemplate, type TemplatePreview, type TemplatesView } from '../api/tickets-messages';
import { ticketSettingsCss } from './settings-styles';
import { mtt, type MessageTextKey } from './messages-text';
import { purposeLabel } from './ticket-messages';

/**
 * CR-038 slice 5b: Settings › the module › "תבניות הודעה" (9.7, D26; tickets.configure - the texts reach outsiders, every save is audited
 * with a diff). One template per purpose x language x department (or the installation); without one the starter text of that language
 * is sent (the module's configured name, D33, through `{module_name}`). The editor validates on the server (allow-listed placeholders,
 * `{link}` in link messages, `{code}` only in the code message, no URL other than `{link}`, no control / bidi characters, 1000
 * rendered characters) and shows a live preview with sample values - the link as a placeholder. Events: `notice` {ok | error}.
 */
@customElement('tickets-message-templates')
export class TicketsMessageTemplates extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private view: TemplatesView | null = null;
  @state() private forbidden = false;
  @state() private failed = '';
  @state() private purpose: MessagePurpose = 'assign';
  @state() private lang: MessageLang = 'he';
  @state() private dept = '';
  @state() private draft: string | null = null;
  @state() private preview: TemplatePreview | null = null;
  @state() private busy = false;
  private timer = 0;
  private seq = 0;

  static styles = [settingsStyles, ticketSettingsCss, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .pick {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2) var(--sw-s-3);
      align-items: center;
    }
    .pick select.in {
      min-inline-size: 10em;
    }
    .text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      padding: var(--sw-s-2) var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    textarea.in {
      inline-size: 100%;
      min-block-size: 9em;
      resize: vertical;
      box-sizing: border-box;
      font: inherit;
      line-height: 1.5;
    }
    .fields {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1);
    }
    .fields button {
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      direction: ltr;
    }
    .problems {
      margin: 0;
      padding-inline-start: 1.2em;
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .badge {
      font-size: var(--sw-fs-xs);
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      color: var(--sw-text-2);
    }
  `, bubbleChrome];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.timer);
  }

  private notice(detail: { ok?: string; error?: string }): void {
    this.dispatchEvent(new CustomEvent('notice', { detail, bubbles: true, composed: true }));
  }

  private async load(): Promise<void> {
    this.failed = '';
    try {
      this.view = await messagesApi().templates();
      void this.refreshPreview(this.current?.body ?? this.starter());
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.failed = describeError(e);
    }
  }

  private get current(): MessageTemplate | undefined {
    return this.view?.items.find((t) => t.purpose === this.purpose && t.lang === this.lang && (t.department_id ?? '') === this.dept);
  }

  private starter(): string {
    return this.view?.starters[this.purpose]?.[this.lang] ?? this.view?.starters[this.purpose]?.he ?? '';
  }

  private choose(patch: { purpose?: MessagePurpose; lang?: MessageLang; dept?: string }): void {
    if (patch.purpose) this.purpose = patch.purpose;
    if (patch.lang) this.lang = patch.lang;
    if (patch.dept !== undefined) this.dept = patch.dept;
    this.draft = null;
    this.preview = null;
    void this.refreshPreview(this.current?.body ?? this.starter());
  }

  private onDraft(text: string): void {
    this.draft = text;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.refreshPreview(text), 350);
  }

  private async refreshPreview(body: string): Promise<void> {
    if (!body.trim()) {
      this.preview = null;
      return;
    }
    const mine = ++this.seq;
    try {
      const p = await messagesApi().previewTemplate({ purpose: this.purpose, lang: this.lang, body });
      if (mine === this.seq) this.preview = p;
    } catch {
      if (mine === this.seq) this.preview = null;
    }
  }

  private insert(field: string): void {
    const area = this.renderRoot.querySelector('textarea') as HTMLTextAreaElement | null;
    const base = this.draft ?? '';
    const token = `{${field}}`;
    if (!area) {
      this.onDraft(base + token);
      return;
    }
    const at = area.selectionStart ?? base.length;
    const next = base.slice(0, at) + token + base.slice(area.selectionEnd ?? at);
    this.onDraft(next);
    void this.updateComplete.then(() => {
      area.focus();
      area.setSelectionRange(at + token.length, at + token.length);
    });
  }

  private async act(fn: () => Promise<unknown>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await fn();
      this.view = await messagesApi().templates();
      this.draft = null;
      this.notice({ ok: mtt('saved') });
      void this.refreshPreview(this.current?.body ?? this.starter());
    } catch (e) {
      this.notice({ error: describeError(e) });
      if (e instanceof ApiError && e.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private save(): void {
    const body = this.draft ?? '';
    const cur = this.current;
    void this.act(() => (cur ? messagesApi().patchTemplate(cur.id, { body, revision: cur.revision })
      : messagesApi().createTemplate({ department_id: this.dept || null, purpose: this.purpose, lang: this.lang, body })));
  }

  private problemText(code: string): string {
    return mtt(`tp_${code}` as MessageTextKey) || code;
  }

  private picker(v: TemplatesView): TemplateResult {
    return html`<div class="pick" data-template-picker>
      <label class="fld">${mtt('tplPurpose')}<select class="in" data-template-purpose @change=${(e: Event) => this.choose({ purpose: (e.target as HTMLSelectElement).value as MessagePurpose })}>
        ${v.purposes.map((p) => html`<option value=${p} ?selected=${p === this.purpose}>${purposeLabel(p)}</option>`)}</select></label>
      <span class="seg" role="radiogroup" aria-label=${mtt('tplLang')}>${v.langs.map((l) => html`<button type="button" role="radio" aria-pressed=${String(l === this.lang)}
        aria-checked=${String(l === this.lang)} data-template-lang=${l} @click=${() => this.choose({ lang: l })}>${mtt(`lang_${l}` as MessageTextKey)}</button>`)}</span>
      <label class="fld">${mtt('tplDept')}<select class="in" data-template-dept @change=${(e: Event) => this.choose({ dept: (e.target as HTMLSelectElement).value })}>
        <option value="" ?selected=${!this.dept}>${mtt('tplAllDepts')}</option>
        ${v.departments.map((d) => html`<option value=${d.id} ?selected=${d.id === this.dept}>${bidi(d.name)}</option>`)}</select></label>
    </div>`;
  }

  private editor(v: TemplatesView): TemplateResult {
    const cur = this.current;
    const text = this.draft ?? cur?.body ?? this.starter();
    const editing = this.draft !== null;
    const dir = this.lang === 'he' || this.lang === 'ar' ? 'rtl' : 'ltr';
    const p = this.preview;
    const problems = editing && p ? p.problems : [];
    return html`<sw-card heading=${`${purposeLabel(this.purpose)} · ${mtt(`lang_${this.lang}` as MessageTextKey)}`} data-card="template-editor"
        data-template-state=${cur ? (cur.active ? 'custom' : 'inactive') : 'starter'}>
      <div class="row"><span class="lbl"><span class="badge">${cur ? (cur.active ? mtt('tplCustom') : mtt('tplInactive')) : mtt('tplStarter')}</span></span>
        ${cur && !editing ? html`<sw-toggle label=${mtt('tplCustom')} labelHidden .checked=${cur.active} ?disabled=${this.busy} data-template-active
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.act(() => messagesApi().patchTemplate(cur.id, { active: e.detail.checked, revision: cur.revision }))}></sw-toggle>` : nothing}</div>
      ${editing ? html`<textarea class="in" dir=${dir} maxlength="1500" data-template-body .value=${text}
            @input=${(e: Event) => this.onDraft((e.target as HTMLTextAreaElement).value)}></textarea>
          <div class="row"><span class="lbl">${mtt('tplFields')}</span></div>
          <div class="fields" data-template-fields>${v.placeholders.filter((f) => (this.purpose === 'code' ? !v.rules.code_forbidden.includes(f) : f !== 'code'))
            .map((f) => html`<button type="button" data-field=${f} @click=${() => this.insert(f)}>{${f}}</button>`)}</div>`
        : html`<div class="text" dir=${dir} data-template-text>${text}</div>`}
      ${problems.length ? html`<ul class="problems" data-template-problems>${problems.map((x) => html`<li data-problem=${x.code}>${this.problemText(x.code)}</li>`)}</ul>` : nothing}
      ${p && p.text ? html`<div class="row"><span class="lbl">${mtt('tplPreview')}<span class="muted">${mtt('tplLength', { n: p.length, max: p.max })}</span></span></div>
        <div class="text" dir=${dir} data-template-preview>${p.text}</div>` : nothing}
      <div class="foot">
        ${editing ? html`<sw-button size="sm" variant="primary" data-template-save ?disabled=${this.busy || !text.trim() || problems.length > 0} @click=${() => this.save()}>${mtt('save')}</sw-button>
          <sw-button size="sm" variant="ghost" data-template-cancel ?disabled=${this.busy} @click=${() => { this.draft = null; void this.refreshPreview(cur?.body ?? this.starter()); }}>${mtt('tplCancel')}</sw-button>`
        : html`<sw-button size="sm" data-template-edit ?disabled=${this.busy} @click=${() => this.onDraft(text)}>${cur ? mtt('tplEdit') : mtt('tplNew')}</sw-button>
          ${cur ? html`<sw-button size="sm" variant="ghost" data-template-delete ?disabled=${this.busy} @click=${() => void this.act(() => messagesApi().deleteTemplate(cur.id))}>${mtt('tplDelete')}</sw-button>` : nothing}`}
      </div>
    </sw-card>`;
  }

  render() {
    if (this.forbidden) return html`<sw-state-panel state="forbidden"></sw-state-panel>`;
    if (this.failed) return html`<sw-state-panel state="error" heading=${this.failed}></sw-state-panel>`;
    const v = this.view;
    if (!v) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    return html`<div class="stack" data-message-templates>${this.picker(v)}${this.editor(v)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-message-templates': TicketsMessageTemplates;
  }
}
