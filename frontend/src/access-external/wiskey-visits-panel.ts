import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-button';
import { ApiError, describeError } from '../api/client';
import {
  getLinks, getTemplates, getVisits, getVisitsHome, pushInvite, putVisitsSettings, reconcileInvite,
  type GuestTemplate, type VisitLink, type VisitsHome, type WiskeyVisit,
} from '../api/wiskey-visits';
import { capabilityLines, durationText, linkPlan, originText, statusText } from './wiskey-visits-logic';
import { xCss } from './styles';

/**
 * WISKEY-VISITS-2407: the visits block of the external-access settings dialog. One place for guests: Arx's invitations are managed in Arx;
 * the access-control system's own visits are listed read only; its guest templates are shown as presets; each Arx invitation's record in
 * the access-control system can be sent / checked when the capability is there - otherwise the server's Hebrew reason is shown. The block
 * renders nothing while visitors are off (every route answers 404).
 */
@customElement('wiskey-visits-panel')
export class WiskeyVisitsPanel extends LitElement {
  @state() private home: VisitsHome | null = null;
  @state() private off = false;
  @state() private visits: WiskeyVisit[] | null = null;
  @state() private templates: GuestTemplate[] | null = null;
  @state() private links: VisitLink[] = [];
  @state() private error = '';
  @state() private busy = '';

  static styles = [
    xCss,
    css`
      :host { display: block; }
      .lines { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
      .lines li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
      .lines b { font-weight: 600; }
      .lines small { color: var(--ct, var(--sw-text-2)); }
      table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); margin-block-start: 8px; }
      th, td { text-align: start; padding: 4px 6px; border-block-end: 1px solid var(--sw-border); vertical-align: top; }
      .row-actions { display: flex; gap: 6px; }
      .err-line { color: var(--sw-danger-text); margin: 6px 0 0; }
      h5 { margin: 12px 0 4px; font-size: var(--sw-fs-sm); }
      .note { color: var(--sw-text-2); margin: 4px 0 0; font-size: var(--sw-fs-sm); }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.home = await getVisitsHome();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 403)) this.off = true;
      else this.error = describeError(e);
      return;
    }
    const caps = this.home.capabilities;
    const tasks: Promise<unknown>[] = [getLinks().then((r) => (this.links = r.links)).catch(() => (this.links = []))];
    if (caps.visits.available && this.home.can.list) tasks.push(getVisits({ limit: 50 }).then((r) => (this.visits = r.visits?.items ?? [])).catch(() => (this.visits = null)));
    if (caps.templates.available) tasks.push(getTemplates().then((r) => (this.templates = r.templates?.items ?? [])).catch(() => (this.templates = null)));
    await Promise.all(tasks);
  }

  private async run(key: string, fn: () => Promise<unknown>): Promise<void> {
    this.busy = key;
    this.error = '';
    try {
      await fn();
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = '';
      await this.load();
    }
  }

  render(): TemplateResult | typeof nothing {
    if (this.off) return nothing;
    const h = this.home;
    if (!h) return this.error ? html`<p class="err-line" role="alert">${this.error}</p>` : html`<p class="note">טוען…</p>`;
    const push = h.capabilities.push;
    return html`
      <ul class="lines" data-visit-capabilities>
        ${capabilityLines(h.capabilities).map((l) => html`<li data-capability=${l.name} data-tone=${l.tone}><b>${l.label}</b><small>${l.text}</small></li>`)}
      </ul>
      ${h.can.settings && push.offered ? html`<p class="note"><sw-button size="sm" variant="ghost" data-visit-switch ?disabled=${!!this.busy}
          @click=${() => this.run('switch', () => putVisitsSettings(push.switch === 'on' ? 'off' : 'on'))}>${push.switch === 'on' ? 'כיבוי הרישום' : 'הפעלת הרישום'}</sw-button></p>` : nothing}
      ${this.links.length ? this.linksTable(push.available) : nothing}
      ${this.visits ? this.visitsTable(this.visits) : nothing}
      ${this.templates ? this.templatesTable(this.templates) : nothing}
      ${this.error ? html`<p class="err-line" role="alert">${this.error}</p>` : nothing}`;
  }

  private linksTable(pushAvailable: boolean): TemplateResult {
    return html`<h5>הזמנות Arx</h5><table data-visit-links><tbody>${this.links.map((l) => {
      const p = linkPlan(l, pushAvailable);
      return html`<tr data-link=${l.invite_id}><td><span class="chip" data-tone=${p.tone}>${p.text}</span></td><td class="row-actions">
        ${p.action === 'push' ? html`<sw-button size="sm" ?disabled=${!!this.busy} @click=${() => this.run(l.invite_id, () => pushInvite(l.invite_id))}>רישום</sw-button>` : nothing}
        ${p.action === 'reconcile' ? html`<sw-button size="sm" variant="ghost" ?disabled=${!!this.busy} @click=${() => this.run(l.invite_id, () => reconcileInvite(l.invite_id))}>בדיקה מול מערכת בקרת הכניסה</sw-button>` : nothing}
      </td></tr>`;
    })}</tbody></table>`;
  }

  private visitsTable(rows: WiskeyVisit[]): TemplateResult {
    if (!rows.length) return html`<h5>ביקורים במערכת בקרת הכניסה</h5><p class="note">אין ביקורים.</p>`;
    return html`<h5>ביקורים במערכת בקרת הכניסה</h5><table data-visits><tbody>${rows.map((v) => {
      const s = statusText(v.status);
      const o = originText(v);
      return html`<tr data-visit=${v.id}><td>${v.display_name ?? '—'}</td><td><span class="chip" data-tone=${s.tone}>${s.text}</span></td>
        <td><span class="chip" data-tone=${o.tone}>${o.text}</span></td></tr>`;
    })}</tbody></table>`;
  }

  private templatesTable(rows: GuestTemplate[]): TemplateResult {
    if (!rows.length) return html`<h5>תבניות אורחים</h5><p class="note">אין תבניות.</p>`;
    return html`<h5>תבניות אורחים</h5><table data-templates><tbody>${rows.map((t) => html`<tr data-template=${t.id}><td>${t.label}</td>
      <td>${durationText(t.duration_minutes)}</td><td>${Object.keys(t.doors).length} עמדות</td></tr>`)}</tbody></table>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'wiskey-visits-panel': WiskeyVisitsPanel;
  }
}
