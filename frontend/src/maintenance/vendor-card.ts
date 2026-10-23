import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { maintApi, type VendorCard, type VendorRow } from '../api/maintenance';
import { mt } from '../i18n/maintenance';
import type { MaintAccess } from './access';
import { badgeText, docTypeText, fmtDate, lookOf, vendorMark } from './model';
import { maintCss } from './styles';

/**
 * The supplier card (mockup v2 "כרטיס ספק"): the supplier's documents with their validity (renew: maintenance.manage), its other tasks,
 * and - while the tickets module is on - how the request handler picker marks the suppliers (owner answer 24.10 q17): red with the
 * expired document, amber while expiring; assigning to a supplier without valid documents needs the approval of a holder of the
 * approvals permission. The marks come from GET /maintenance/vendors (document types and dates only).
 */
@customElement('maint-vendor-card')
export class MaintVendorCard extends LitElement {
  @property() vendorId = '';
  @property({ attribute: false }) access!: MaintAccess;
  @state() private card: VendorCard | null = null;
  @state() private vendors: VendorRow[] = [];
  @state() private error = '';

  static styles = maintCss;

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('vendorId') && this.vendorId) void this.load();
  }

  private async load() {
    try {
      const [c, v] = await Promise.all([maintApi.vendor(this.vendorId), this.access?.ticketsOn ? maintApi.vendors().catch(() => ({ items: [] as VendorRow[] })) : Promise.resolve({ items: [] as VendorRow[] })]);
      this.card = c;
      this.vendors = v.items;
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private open(id: string, mode: 'view' | 'complete', e?: Event) {
    e?.stopPropagation();
    this.dispatchEvent(new CustomEvent('open-task', { detail: { id, mode } }));
  }

  render() {
    const c = this.card;
    const me = this.vendors.find((v) => v.id === this.vendorId);
    const myMark = vendorMark(me);
    return html`<sw-dialog open xl heading=${c?.name ?? ''} subheading=${c ? mt('vendorSub', { n: c.documents.length }) : ''} data-maint-vendor=${this.vendorId} @close=${() => this.dispatchEvent(new CustomEvent('close'))}>
      ${this.error ? html`<sw-state-panel state="error" heading=${this.error} compact></sw-state-panel>` : !c ? html`<div class="skl" aria-busy="true" aria-label=${mt('loading')}></div>` : html`
        <div class="two">
          <div>
            <div class="panel"><div class="hd"><h4>${mt('documents')}</h4><span class="sp"></span>
              ${this.access.manage ? html`<button type="button" class="btn sm" data-maint-new-doc @click=${() => this.dispatchEvent(new CustomEvent('new-document', { detail: this.vendorId }))}><sw-icon name="plus" size="14"></sw-icon>${mt('newDocument')}</button>` : nothing}</div>
              ${c.documents.length ? html`<div class="list" data-maint-docs>${c.documents.map((d) => html`<div class="li" data-look=${lookOf(d)} data-maint-doc=${d.id}>
                  <div class="grow"><div class="t1">${docTypeText(d.doc_type)}${d.title && d.title !== docTypeText(d.doc_type) ? html` <span class="mut">· ${d.title}</span>` : nothing}</div>
                    <div class="t2">${mt('validUntil')} <span class="num">${fmtDate(d.due_date)}</span></div></div>
                  <span class="badge">${badgeText(d)}</span>
                  ${this.access.manage ? html`<button type="button" class="btn sm" data-maint-doc-renew=${d.id} @click=${(e: Event) => this.open(d.id, 'complete', e)}>${mt('renew')}</button>` : html`<button type="button" class="btn sm ghost" @click=${(e: Event) => this.open(d.id, 'view', e)}>${mt('scanOpen')}</button>`}
                </div>`)}</div>` : html`<div class="mut">${mt('noDocuments')}</div>`}
            </div>
            ${c.tasks.length ? html`<div class="panel"><div class="hd"><h4>${mt('vendorTasks')}</h4></div><div class="list">${c.tasks.map((t) => html`<div class="li" data-look=${lookOf(t)}>
                <div class="grow"><div class="t1">${t.title}</div><div class="t2 num">${fmtDate(t.due_date)}</div></div><span class="badge">${badgeText(t)}</span>
                <button type="button" class="btn sm ghost" @click=${(e: Event) => this.open(t.id, 'view', e)}>${mt('scanOpen')}</button></div>`)}</div></div>` : nothing}
          </div>
          ${this.access.ticketsOn && this.vendors.length ? html`<div><div class="panel" data-maint-picker><div class="hd"><h4>${mt('vendorPicker')}</h4></div>
            <div class="list">${this.vendors.slice(0, 8).map((v) => {
              const m = vendorMark(v);
              return html`<div class="li" data-look=${m?.look ?? 'unk'}><div class="grow"><div class="t1">${v.name}</div></div>
                <span class="chip" data-look=${m?.look ?? 'unk'}>${m?.text ?? mt('vendorNoDocs')}</span></div>`;
            })}</div>
            ${myMark?.look === 'alarm' ? html`<div class="alert err" role="note" style="margin-block-start:12px" data-maint-expired-note><sw-icon name="warning" size="18"></sw-icon>
              <div><b>${me?.expired.some((x) => x.doc_type === 'insurance') ? mt('noValidInsurance', { v: c.name }) : mt('noValidDoc', { v: c.name })}</b><div class="mut">${mt('needsApproval')}</div></div></div>` : nothing}
          </div></div>` : nothing}
        </div>`}
      <div class="foot" slot="footer"><span class="sp"></span><button type="button" class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>${mt('close')}</button></div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-vendor-card': MaintVendorCard;
  }
}
