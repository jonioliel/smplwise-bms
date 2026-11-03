import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { nc } from '../i18n/notice-chips';
import { noticesCss } from './styles';
import { SOURCE_MAX, addSource, offerable, removeSource, sourceName, type SourceEntity, type SourceKind } from './info-chips-model';

/**
 * TV-CHIPS-2381 (owner 03.11, Q4 = A): the sources of the parking and gym chips in Settings › Notice board (the defaults card, next to
 * the boards' weather entity - the same select-of-entities pattern, here with several entities per chip, like a board's news feeds).
 * The candidates come with GET /notices/settings (`info_entities`, filtered by the server to what the chip can read); a picked entity
 * the mirror no longer has is still listed (so it can be removed) as "לא נמצאה". Each change is saved at once:
 *   info-sources-change {parking_entities} | {gym_entities}
 * Read-only towards the devices: picking an entity only tells the TV feed what to read.
 */
@customElement('notice-info-sources')
export class NoticeInfoSources extends LitElement {
  static styles = [noticesCss, css`
    :host { display: block; }
    .srcs { display: grid; gap: 12px; }
    .src { display: grid; gap: 6px; }
    .picked { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .picked li { display: inline-flex; align-items: center; gap: 4px; padding-block: 2px; padding-inline: 10px 4px; border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .picked li.gone { color: var(--sw-text-3); }
    .picked button { font: inherit; font-size: var(--sw-fs-xs); border: 0; background: transparent; color: var(--sw-text-2); cursor: pointer;
      padding: 2px 6px; border-radius: var(--sw-r-md); }
    .picked button:hover:not(:disabled) { color: var(--sw-text); }
    .picked button:focus-visible, .add:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 1px; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .row select { min-inline-size: 0; flex: 1 1 200px; max-inline-size: 360px; }
    .add { font: inherit; font-size: var(--sw-fs-sm); border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); background: var(--sw-surface-2);
      color: var(--sw-text); padding: 5px 12px; cursor: pointer; }
    .add:disabled { opacity: 0.5; cursor: default; }
    .mut { font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
  `];

  @property({ attribute: false }) parking: string[] = [];
  @property({ attribute: false }) gym: string[] = [];
  @property({ attribute: false }) candidates: Partial<Record<SourceKind, SourceEntity[]>> = {};
  @property({ type: Boolean }) disabled = false;
  @state() private pick: Record<SourceKind, string> = { parking: '', gym: '' };

  private emit(kind: SourceKind, list: string[]): void {
    this.dispatchEvent(new CustomEvent(`info-sources-change`, { detail: { [`${kind}_entities`]: list }, bubbles: true, composed: true }));
  }

  private one(kind: SourceKind) {
    const list = kind === 'parking' ? this.parking : this.gym;
    const cands = this.candidates[kind] ?? [];
    const offer = offerable(cands, list);
    const full = list.length >= SOURCE_MAX;
    const label = nc(kind === 'parking' ? 'parkingLabel' : 'gymLabel');
    const sel = `ns-src-${kind}`;
    return html`<div class="src fld" data-info-source=${kind}>
      <label for=${sel}>${label}</label>
      ${list.length ? html`<ul class="picked" data-info-source-list>${list.map((id) => {
        const name = sourceName(cands, id);
        return html`<li class=${name === null ? 'gone' : ''} data-info-source-item=${id}><span>${name ?? nc('gone')}</span>
          <button type="button" aria-label=${nc('removeOne', { n: name ?? nc('gone') })} ?disabled=${this.disabled} @click=${() => this.emit(kind, removeSource(list, id))}>${nc('remove')}</button></li>`;
      })}</ul>` : html`<span class="mut" data-info-source-none>${nc('none')}</span>`}
      <div class="row">
        <select id=${sel} class="inp" data-info-source-pick .value=${this.pick[kind]} ?disabled=${this.disabled || full || !offer.length}
          @change=${(e: Event) => (this.pick = { ...this.pick, [kind]: (e.target as HTMLSelectElement).value })}>
          <option value="">${offer.length ? nc('pick') : nc('noCandidates')}</option>
          ${offer.map((c) => html`<option value=${c.entity_id}>${c.name}</option>`)}</select>
        <button type="button" class="add" data-info-source-add ?disabled=${this.disabled || full || !this.pick[kind]}
          @click=${() => { const id = this.pick[kind]; this.pick = { ...this.pick, [kind]: '' }; this.emit(kind, addSource(list, id)); }}>${nc('add')}</button>
        ${full ? html`<span class="mut">${nc('max', { n: SOURCE_MAX })}</span>` : nothing}
      </div>
      <span class="hint">${nc(kind === 'parking' ? 'parkingHint' : 'gymHint')}</span>
    </div>`;
  }

  render() {
    return html`<div class="srcs" data-info-sources>
      <span class="lbl">${nc('sourcesTitle')}</span>
      <span class="hint">${nc('sourcesHint')}</span>
      ${this.one('parking')}
      ${this.one('gym')}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'notice-info-sources': NoticeInfoSources;
  }
}
