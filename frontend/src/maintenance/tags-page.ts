import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import qrcode from 'qrcode-generator';
import '../components/sw-dialog';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { maintApi, type Tag, type TagMedium, type Task } from '../api/maintenance';
import { mt } from '../i18n/maintenance';
import type { MaintAccess } from './access';
import { fmtDate, fmtInstant, kindText, stickerUrl } from './model';
import { maintCss } from './styles';

/** A sticker's QR code as one inline SVG path (no data: URL - the strict remote CSP stays untouched), like the second-factor enrolment. */
export function qrPath(text: string): { d: string; size: number } {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return { d, size: n + quiet * 2 };
}

const PRINTING = 'maint-printing';
let printSheet: CSSStyleSheet | null = null;

/** The page outside the stickers is hidden while printing (a constructable sheet on the document: no inline style, CSP-safe). */
function setPrinting(on: boolean): void {
  try {
    if (!printSheet) {
      printSheet = new CSSStyleSheet();
      printSheet.replaceSync(`@media print { html.${PRINTING} body { visibility: hidden; } }`);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, printSheet];
    }
  } catch {
    /* an older engine prints the whole page */
  }
  document.documentElement.classList.toggle(PRINTING, on);
}

/**
 * תגי QR/NFC (maintenance.manage only - the server lists tags to managers): the stickers (QR code, label, target, the short in-app path),
 * their printing, the list with the medium, the creation date and the last scan (a time only - never who), revoking, and a new tag
 * for a task or for a device linked to a task. The address on a sticker is Settings' (default: the remote address); a scan always
 * needs a signed-in person who may see the target (owner answer 24.10 q16).
 */
@customElement('maint-tags-page')
export class MaintTagsPage extends LitElement {
  @property({ attribute: false }) access!: MaintAccess;
  @state() private tags: Tag[] | null = null;
  @state() private base = '';
  @state() private error = '';
  @state() private tasks: Task[] = [];
  @state() private creating = false;
  @state() private draft: { target: string; label: string; medium: TagMedium } = { target: '', label: '', medium: 'qr' };
  @state() private revoke: Tag | null = null;
  @state() private busy = false;
  @state() private toast = '';
  @state() private formError = '';

  static styles = [maintCss, css`
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr)); gap: 12px; }
    /* stickers are always light (print) */
    .sticker { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 12px; background: #fff; color: #111; text-align: center; display: grid; justify-items: center; gap: 4px; break-inside: avoid; }
    .sticker svg { inline-size: 120px; block-size: 120px; }
    .sticker .l { font-weight: var(--sw-fw-bold); }
    .sticker .s { font-size: var(--sw-fs-xs); color: #555; }
    .sticker .path { font-family: var(--sw-font-mono); font-size: var(--sw-fs-2xs); color: #555; direction: ltr; unicode-bidi: isolate; }
    .note { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    @media print {
      :host { visibility: visible; }
      .noprint { display: none !important; }
      .grid { visibility: visible; position: absolute; inset-block-start: 0; inset-inline-start: 0; inline-size: 100%; grid-template-columns: repeat(3, 1fr); }
      .sticker { border-color: #999; }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    window.addEventListener('afterprint', this.afterPrint);
  }

  disconnectedCallback() {
    window.removeEventListener('afterprint', this.afterPrint);
    setPrinting(false);
    super.disconnectedCallback();
  }

  private afterPrint = () => setPrinting(false);

  private async load() {
    try {
      const [t, list] = await Promise.all([maintApi.tags(), maintApi.tasks({ include_inactive: false }).catch(() => ({ items: [] as Task[] }))]);
      this.tags = t.items;
      this.base = t.base_url;
      this.tasks = list.items;
      this.error = '';
    } catch (e) {
      if (!this.tags) this.error = describeError(e);
    }
  }

  private flash(msg: string) {
    this.toast = msg;
    window.setTimeout(() => {
      if (this.toast === msg) this.toast = '';
    }, 2600);
  }

  private url(t: Tag): string {
    return stickerUrl(this.base, t.token, { origin: window.location.origin, pathname: window.location.pathname });
  }

  private targetText(t: Tag): string {
    return t.target_kind === 'entity' ? mt('deviceSuffix', { n: t.target_name || t.target_id }) : t.target_name || '';
  }

  private sticker(t: Tag): TemplateResult {
    const q = qrPath(this.url(t));
    const task = this.tasks.find((x) => x.id === t.target_id);
    const sub = t.target_kind === 'entity' ? mt('tagDevice') : [task ? kindText(task.kind) : '', task?.place?.name ?? ''].filter(Boolean).join(' · ');
    return html`<div class="sticker" data-maint-sticker=${t.id}>
      ${svg`<svg viewBox=${`0 0 ${q.size} ${q.size}`} role="img" aria-label=${t.label || this.targetText(t)} shape-rendering="crispEdges"><rect width=${q.size} height=${q.size} fill="#fff"></rect><path d=${q.d} fill="#000"></path></svg>`}
      <div class="l">${t.label || this.targetText(t)}</div><div class="s">${sub || this.targetText(t)}</div><div class="path">#/m/${t.token.slice(0, 4)}…</div></div>`;
  }

  private async create() {
    const [kind, id] = this.draft.target.split(':');
    if (!kind || !id) {
      this.formError = mt('fRequired');
      return;
    }
    this.busy = true;
    this.formError = '';
    try {
      await maintApi.createTag({ target_kind: kind === 'entity' ? 'entity' : 'task', target_id: id, label: this.draft.label.trim() || undefined, medium: this.draft.medium });
      this.creating = false;
      this.flash(mt('tagCreated'));
      await this.load();
    } catch (e) {
      this.formError = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private async doRevoke(t: Tag) {
    this.busy = true;
    try {
      await maintApi.revokeTag(t.id);
      this.revoke = null;
      this.flash(mt('tagRevoked'));
      await this.load();
    } catch (e) {
      this.flash(describeError(e));
    } finally {
      this.busy = false;
    }
  }

  private print() {
    setPrinting(true);
    requestAnimationFrame(() => window.print());
  }

  private createDialog(): TemplateResult {
    const devices = [...new Map(this.tasks.filter((t) => t.entity_id).map((t) => [t.entity_id!, t.entity_name || t.entity_id!])).entries()];
    return html`<sw-dialog open heading=${mt('newTag')} data-maint-tag-form @close=${() => { this.creating = false; }}>
      <div class="form">
        <div class="fld"><label for="tg-t">${mt('tagFor')}</label><select id="tg-t" class="inp" data-maint-tag-target @change=${(e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          const task = this.tasks.find((x) => `task:${x.id}` === v);
          this.draft = { ...this.draft, target: v, label: this.draft.label || task?.title || '' };
        }}>
          <option value="" ?selected=${!this.draft.target} disabled>${mt('tagFor')}</option>
          <optgroup label=${mt('tagTask')}>${this.tasks.map((t) => html`<option value=${`task:${t.id}`}>${t.title} · ${kindText(t.kind)}</option>`)}</optgroup>
          ${devices.length ? html`<optgroup label=${mt('tagDevice')}>${devices.map(([id, name]) => html`<option value=${`entity:${id}`}>${name}</option>`)}</optgroup>` : nothing}
        </select></div>
        <div class="fld"><label for="tg-l">${mt('tagLabel')}</label><input id="tg-l" class="inp" maxlength="120" .value=${this.draft.label} @input=${(e: Event) => { this.draft = { ...this.draft, label: (e.target as HTMLInputElement).value }; }}></div>
        <div class="fld"><span class="lbl">${mt('tagMedium')}</span><div class="seg" role="group" aria-label=${mt('tagMedium')}>
          ${(['qr', 'nfc'] as const).map((m) => html`<button type="button" aria-pressed=${String(this.draft.medium === m)} @click=${() => { this.draft = { ...this.draft, medium: m }; }}>${m.toUpperCase()}</button>`)}</div></div>
        ${this.formError ? html`<div class="alert err" role="alert">${this.formError}</div>` : nothing}
      </div>
      <div class="foot" slot="footer"><span class="sp"></span><button type="button" class="btn" @click=${() => { this.creating = false; }}>${mt('cancel')}</button>
        <button type="button" class="btn pri" ?disabled=${this.busy} data-maint-tag-save @click=${() => void this.create()}>${mt('tagCreate')}</button></div>
    </sw-dialog>`;
  }

  render() {
    if (!this.access.manage) return html`<sw-state-panel state="forbidden" heading=${mt('forbiddenTitle')} hint=${mt('forbiddenTags')} data-state="forbidden"></sw-state-panel>`;
    if (!this.tags) {
      return this.error
        ? html`<sw-state-panel state="error" heading=${mt('errTags')} hint=${mt('errHint')} actionLabel=${mt('retry')} data-state="error" @action=${() => { this.error = ''; void this.load(); }}></sw-state-panel>`
        : html`<div class="skl" aria-busy="true" aria-label=${mt('loading')} data-state="loading"></div>`;
    }
    const live = this.tags.filter((t) => !t.revoked_at);
    const openNew = () => { this.draft = { target: '', label: '', medium: 'qr' }; this.formError = ''; this.creating = true; };
    const top = html`<div class="top noprint"><div><h1>${mt('pageTags')}</h1><p class="sub">${mt('section')} · ${mt('subTags', { n: live.length })}</p></div><span class="sp"></span>
      <div class="meta">${live.length ? html`<button type="button" class="btn" data-maint-print @click=${() => this.print()}><sw-icon name="qr" size="16"></sw-icon>${mt('printStickers')}</button>` : nothing}
        <button type="button" class="btn pri" data-maint-new-tag @click=${openNew}><sw-icon name="plus" size="16"></sw-icon>${mt('newTag')}</button></div></div>`;
    const overlays = html`${this.creating ? this.createDialog() : nothing}
      ${this.revoke ? html`<sw-dialog open heading=${mt('tagRevoke')} @close=${() => { this.revoke = null; }}><p>${mt('tagRevokeConfirm', { l: this.revoke.label || this.targetText(this.revoke) })}</p>
        <div class="foot" slot="footer"><span class="sp"></span><button type="button" class="btn" @click=${() => { this.revoke = null; }}>${mt('cancel')}</button>
          <button type="button" class="btn dng" ?disabled=${this.busy} data-maint-revoke-yes @click=${() => void this.doRevoke(this.revoke!)}>${mt('tagRevoke')}</button></div></sw-dialog>` : nothing}
      ${this.toast ? html`<div class="toast noprint" role="status" aria-live="polite">${this.toast}</div>` : nothing}`;
    if (!live.length) {
      return html`${top}<sw-state-panel icon="qr" state="empty" heading=${mt('emptyTags')} hint=${mt('emptyTagsBody')} data-state="empty">
        <button type="button" class="btn pri" @click=${openNew}><sw-icon name="plus" size="16"></sw-icon>${mt('firstTag')}</button></sw-state-panel>${overlays}`;
    }
    return html`${top}
      <p class="note noprint" data-maint-tag-url>${this.base ? mt('tagUrlHint', { u: this.base }) : mt('tagNoBase')}</p>
      <div class="grid" data-maint-stickers>${live.map((t) => this.sticker(t))}</div>
      <div class="panel flush noprint">
        <div class="scrollx"><table class="t" data-maint-tags-table><thead><tr><th>${mt('colLabel')}</th><th>${mt('colTarget')}</th><th>${mt('colMedium')}</th><th class="hide-tablet">${mt('colCreated')}</th><th>${mt('colLastScan')}</th><th></th></tr></thead><tbody>
          ${live.map((t) => html`<tr data-maint-tag=${t.id}><td><span class="t1">${t.label || this.targetText(t)}</span></td><td>${this.targetText(t)}</td><td><span class="chip" data-look="acc">${t.medium.toUpperCase()}</span></td>
            <td class="date num hide-tablet">${fmtDate(t.created_at.slice(0, 10))}</td><td class="date num">${t.last_scan_at ? fmtInstant(t.last_scan_at) : html`<span class="mut">${mt('neverScanned')}</span>`}</td>
            <td class="act"><button type="button" class="btn sm dng" data-maint-revoke=${t.id} @click=${() => { this.revoke = t; }}>${mt('tagRevoke')}</button></td></tr>`)}
        </tbody></table></div>
        <div class="cards-m">${live.map((t) => html`<div class="c"><div class="r1"><span class="t1">${t.label || this.targetText(t)}</span><span class="chip" data-look="acc">${t.medium.toUpperCase()}</span></div>
          <div class="mut">${this.targetText(t)} · ${t.last_scan_at ? fmtInstant(t.last_scan_at) : mt('neverScanned')}</div>
          <div class="r3"><button type="button" class="btn sm dng" @click=${() => { this.revoke = t; }}>${mt('tagRevoke')}</button></div></div>`)}</div>
      </div>
      ${overlays}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-tags-page': MaintTagsPage;
  }
}
