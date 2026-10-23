import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { maintApi, type Task } from '../api/maintenance';
import { mt } from '../i18n/maintenance';
import { maintAccess, onMaintAccess, refreshMaintenance, type MaintAccess } from './access';
import { badgeText, certRowOf } from './model';

/**
 * The "certificates and inspections" row of an elevator's or a generator's card (owner review 24.10): the nearest inspection or
 * certificate linked to it - its valid-until date with the state colour - and a link to the ledger. Drawn only while the maintenance
 * module is on and the person may view it; a failed read draws nothing (the card never shows an error for an optional module). Several
 * cards ask once each; the answer is a few rows.
 */
@customElement('maint-cert-row')
export class MaintCertRow extends LitElement {
  @property() kind: 'elevator' | 'generator' = 'elevator';
  @property() subjectId = '';
  @state() private access: MaintAccess = maintAccess();
  @state() private items: Task[] | null = null;
  private stop?: () => void;
  private loadedFor = '';

  static styles = css`
    :host { display: block; min-inline-size: 0; }
    :host([hidden]) { display: none; }
    .r { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding-block-start: 6px; border-block-start: 1px solid var(--sw-border); }
    .r .lbl { display: inline-flex; align-items: center; gap: 6px; font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); }
    .v { font-variant-numeric: tabular-nums; color: var(--sw-text); font-weight: var(--sw-fw-medium); unicode-bidi: isolate; }
    .b { display: inline-block; padding: 1px 8px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); background: var(--c-soft, var(--sw-surface-3)); color: var(--c-text, var(--sw-text-2)); }
    [data-look='ok'] { --c-soft: var(--sw-success-soft); --c-text: var(--sw-success-text); }
    [data-look='warn'] { --c-soft: var(--sw-warning-soft); --c-text: var(--sw-warning-text); }
    [data-look='alarm'] { --c-soft: var(--sw-danger-soft); --c-text: var(--sw-danger-text); }
    [data-look='unk'] { --c-soft: var(--sw-unknown-soft); --c-text: var(--sw-text-2); }
    a { color: var(--sw-accent-text); text-decoration: none; margin-inline-start: auto; }
    a:hover { text-decoration: underline; }
    a:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; border-radius: var(--sw-r-2xs); }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.stop = onMaintAccess((a) => {
      this.access = a;
      void this.load();
    });
    void refreshMaintenance();
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('subjectId') || changed.has('kind')) void this.load();
  }

  private async load() {
    const key = `${this.kind}:${this.subjectId}`;
    if (!this.subjectId || !this.access.enabled || !this.access.view || this.loadedFor === key) return;
    this.loadedFor = key;
    try {
      this.items = (await maintApi.bySubject(this.kind, this.subjectId)).items;
    } catch {
      this.items = null;
      this.loadedFor = '';
    }
  }

  render() {
    if (!this.access.enabled || !this.access.view || this.items === null) return nothing;
    const row = certRowOf(this.items);
    const ledger = row ? `#/tickets/maintenance/ledger?task=${encodeURIComponent(row.task.id)}` : '#/tickets/maintenance/ledger';
    return html`<div class="r" data-maint-cert-row=${this.kind}><span class="lbl"><sw-icon name="shield" size="14"></sw-icon>${mt('certRowTitle')}</span>
      ${row ? html`<span class="v" data-maint-cert-text>${row.text}</span><span class="b" data-look=${row.look}>${badgeText(row.task)}</span>`
        : html`<span class="v" data-maint-cert-none>${mt('certRowNone')}</span>`}
      ${row || this.access.manage ? html`<a href=${ledger} data-maint-cert-link @click=${(e: Event) => e.stopPropagation()}>${row ? mt('certRowOpen') : mt('certRowAdd')}</a>` : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-cert-row': MaintCertRow;
  }
}
