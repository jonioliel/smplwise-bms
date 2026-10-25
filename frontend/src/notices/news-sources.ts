import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { putNewsSources, removeNewsLogo, uploadNewsLogo, type NewsSource, type NewsSourcesAnswer } from '../api/notices';
import { nt } from '../i18n/notices';
import { LOGO_ACCEPT, LOGO_MAX_BYTES, NAME_MAX, SOURCES_MAX, canSave, emptyRow, isDirty, move, payload, rowsOf, validate, type Row } from './news-model';
import { noticesCss } from './styles';

/**
 * NOTICERSS-295: the editor of the notice boards' news (RSS) sources - הגדרות › לוח הודעות › מקורות חדשות. One row per source: logo, display
 * name, address, on / off, reorder and delete. The list scrolls inside its own box (the page never grows with it). A new source is saved
 * with the list; a logo is uploaded straight to a saved source. `@news-sources-change` carries the list the server answered with, so the
 * boards' pickers show the same names and logos; `@ns-message` carries a short confirmation or the server's refusal.
 */
@customElement('notice-news-sources')
export class NoticeNewsSources extends LitElement {
  static styles = [
    noticesCss,
    css`
      .list { display: grid; gap: 8px; max-block-size: min(52vh, 460px); overflow: auto; padding-inline-end: 2px; overscroll-behavior: contain; }
      .row { display: grid; grid-template-columns: 64px minmax(120px, 1fr) minmax(160px, 1.6fr) auto; gap: 8px 10px; align-items: center; padding: 8px 10px;
        border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); background: var(--sw-surface-2); }
      .row[data-off='1'] { opacity: 0.62; }
      .row[data-bad='1'] { border-color: var(--sw-danger); }
      .lg { inline-size: 64px; block-size: 40px; border-radius: var(--sw-r-md); background: #fff; border: 1px solid var(--sw-border); display: grid; place-items: center; overflow: hidden; color: var(--sw-text-3); }
      .lg img { max-inline-size: 100%; max-block-size: 100%; object-fit: contain; }
      .tools { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
      .tools .sp { inline-size: 6px; }
      .ib { font: inherit; border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text-2); border-radius: var(--sw-r-md); inline-size: 30px; block-size: 30px;
        display: inline-grid; place-items: center; cursor: pointer; padding: 0; }
      .ib:hover:not(:disabled) { color: var(--sw-text); border-color: var(--sw-text-3); }
      .ib:disabled { opacity: 0.4; cursor: default; }
      .ib:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 1px; }
      .up sw-icon { transform: rotate(180deg); }
      .err { grid-column: 2 / -1; }
      .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 10px; }
      .foot .sp { flex: 1; }
      .file { display: none; }
      @media (max-width: 767px) {
        .row { grid-template-columns: 64px minmax(0, 1fr); }
        .row .url, .row .tools, .err { grid-column: 1 / -1; }
        .tools { justify-content: flex-start; }
      }
    `,
  ];

  @property({ attribute: false }) sources: NewsSource[] = [];
  @state() private rows: Row[] = [];
  @state() private saved: Row[] = [];
  @state() private busy = false;
  private fromProp: NewsSource[] | null = null;

  protected willUpdate(): void {
    if (this.sources !== this.fromProp) {
      this.fromProp = this.sources;
      this.saved = rowsOf(this.sources);
      if (!isDirty(this.rows, this.saved) || !this.rows.length) this.rows = this.saved.map((r) => ({ ...r }));
    }
  }

  private say(text: string): void {
    this.dispatchEvent(new CustomEvent('ns-message', { detail: text, bubbles: true, composed: true }));
  }

  /** The server's list is the new baseline; the rows the manager is still typing (unsaved edits, new rows) stay as typed. */
  private applyAnswer(a: NewsSourcesAnswer, keepEdits: boolean): void {
    const keep = this.rows;
    this.fromProp = a.sources;
    this.saved = rowsOf(a.sources);
    this.rows = keepEdits
      ? this.saved.map((s) => {
          const k = keep.find((x) => x.id === s.id);
          return k ? { ...k, has_logo: s.has_logo, logo_url: s.logo_url, custom: s.custom } : { ...s };
        }).concat(keep.filter((x) => !x.id))
      : this.saved.map((r) => ({ ...r }));
    this.dispatchEvent(new CustomEvent<NewsSource[]>('news-sources-change', { detail: a.sources, bubbles: true, composed: true }));
  }

  private set(i: number, patch: Partial<Row>): void {
    this.rows = this.rows.map((r, k) => (k === i ? { ...r, ...patch } : r));
  }

  private async save(): Promise<void> {
    if (this.busy || !canSave(this.rows)) return;
    this.busy = true;
    try {
      this.applyAnswer(await putNewsSources(payload(this.rows)), false);
      this.say(nt('nsSaved'));
    } catch (e) {
      this.say(describeError(e));
    } finally {
      this.busy = false;
    }
  }

  private async logo(i: number, file: File | undefined): Promise<void> {
    const r = this.rows[i];
    if (!file || !r?.id || this.busy) return;
    if (file.size > LOGO_MAX_BYTES) {
      this.say(nt('nsLogoFile'));
      return;
    }
    this.busy = true;
    try {
      this.applyAnswer(await uploadNewsLogo(r.id, file), true);
    } catch (e) {
      this.say(e instanceof ApiError && e.status === 422 ? nt('nsLogoFile') : describeError(e));
    } finally {
      this.busy = false;
    }
  }

  private async dropLogo(i: number): Promise<void> {
    const r = this.rows[i];
    if (!r?.id || this.busy) return;
    this.busy = true;
    try {
      this.applyAnswer(await removeNewsLogo(r.id), true);
    } catch (e) {
      this.say(describeError(e));
    } finally {
      this.busy = false;
    }
  }

  private rowHtml(r: Row, i: number, err: string) {
    const last = this.rows.length - 1;
    const canLogo = !!r.id && !this.busy;
    const label = r.has_logo ? nt('nsLogoReplace') : nt('nsLogoUpload');
    return html`<div class="row" data-ns-row=${r.id || 'new'} data-off=${r.enabled ? '0' : '1'} data-bad=${err ? '1' : '0'}>
      <div class="lg" data-ns-logo>${r.has_logo && r.logo_url ? html`<img alt="" src=${r.logo_url}>` : html`<sw-icon name="image" size="18"></sw-icon>`}</div>
      <input class="inp" data-ns-name maxlength=${NAME_MAX} .value=${r.name} placeholder=${nt('nsName')} aria-label=${nt('nsName')} @input=${(e: Event) => this.set(i, { name: (e.target as HTMLInputElement).value })}>
      <input class="inp ltr url" data-ns-url .value=${r.url} placeholder="https://" aria-label=${nt('nsUrl')} @input=${(e: Event) => this.set(i, { url: (e.target as HTMLInputElement).value })}>
      <div class="tools">
        ${r.custom ? html`<span class="chip">${nt('nsCustomTag')}</span>` : nothing}
        <label class="ck"><input type="checkbox" data-ns-on .checked=${r.enabled} @change=${(e: Event) => this.set(i, { enabled: (e.target as HTMLInputElement).checked })}>${nt('nsEnabled')}</label>
        <span class="sp"></span>
        <button class="ib" type="button" data-ns-logo-btn ?disabled=${!canLogo} title=${r.id ? label : nt('nsLogoSaveFirst')} aria-label=${label}
          @click=${(e: Event) => ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement).click()}><sw-icon name="upload" size="14"></sw-icon></button>
        <input class="file" type="file" accept=${LOGO_ACCEPT} @change=${(e: Event) => {
          const el = e.target as HTMLInputElement;
          void this.logo(i, el.files?.[0]);
          el.value = '';
        }}>
        ${r.has_logo ? html`<button class="ib" type="button" data-ns-logo-del ?disabled=${!canLogo} title=${nt('nsLogoRemove')} aria-label=${nt('nsLogoRemove')} @click=${() => this.dropLogo(i)}><sw-icon name="close" size="14"></sw-icon></button>` : nothing}
        <span class="sp"></span>
        <button class="ib up" type="button" data-ns-up ?disabled=${i === 0} title=${nt('nsUp')} aria-label=${nt('nsUp')} @click=${() => (this.rows = move(this.rows, i, i - 1))}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-down ?disabled=${i === last} title=${nt('nsDown')} aria-label=${nt('nsDown')} @click=${() => (this.rows = move(this.rows, i, i + 1))}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-del title=${nt('nsDelete')} aria-label=${nt('nsDelete')} @click=${() => (this.rows = this.rows.filter((_x, k) => k !== i))}><sw-icon name="trash" size="14"></sw-icon></button>
      </div>
      ${err ? html`<span class="err" data-ns-err=${err}>${err === 'name' ? nt('nsErrName', { n: NAME_MAX }) : err === 'url' ? nt('nsErrUrl') : nt('nsErrDup')}</span>` : nothing}
    </div>`;
  }

  render() {
    const errs = validate(this.rows);
    const dirty = isDirty(this.rows, this.saved);
    return html`<div class="panel" data-news-sources-card>
      <div class="hd"><h2>${nt('nsCard')}</h2><span class="chip num">${nt('nsCount', { n: this.rows.length, m: SOURCES_MAX })}</span><span class="sp"></span>
        <sw-button size="sm" icon="plus" data-ns-add ?disabled=${this.rows.length >= SOURCES_MAX} @click=${() => (this.rows = [...this.rows, emptyRow()])}>${nt('nsAdd')}</sw-button></div>
      ${this.rows.length ? html`<div class="list" data-ns-list>${this.rows.map((r, i) => this.rowHtml(r, i, errs[i]))}</div>` : html`<span class="mut">${nt('nsEmpty')}</span>`}
      <div class="foot"><span class="sp"></span>
        ${dirty ? html`<sw-button size="sm" variant="ghost" data-ns-discard @click=${() => (this.rows = this.saved.map((r) => ({ ...r })))}>${nt('nsDiscard')}</sw-button>` : nothing}
        <sw-button size="sm" variant="primary" data-ns-save ?disabled=${!dirty || !canSave(this.rows) || this.busy} @click=${() => this.save()}>${nt('nsSave')}</sw-button></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-news-sources': NoticeNewsSources;
  }
}
