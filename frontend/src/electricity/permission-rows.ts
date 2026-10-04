import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { RolesResponse } from '../api/access';
import { electricityCss } from './styles';

/** Hebrew labels of the electricity permissions (CR-023 section 14): the fallback while the server's role catalogue carries none of its own. */
export const ENERGY_PERMISSION_LABELS: Record<string, string> = {
  'energy.view': 'צפייה במונים ובצריכה',
  'energy.bills': 'חיובים: סכומים, לקוחות, הפקה וביטול',
  'energy.manage': 'ניהול מונים, חשבונות, לקוחות ומחירים',
};

interface Row {
  id: string;
  label: string;
  tag: '' | 'sensitive' | 'existing';
}

/**
 * הגדרות › משתמשים והרשאות › תפקידים: the electricity permission rows (mockup "שורות ההרשאות של חשמל") - one row per permission, one column per role, a tick where
 * the role holds it. `energy.bills` is marked sensitive (never implied), the retention row is the existing system permission. Phone: a list.
 * The data is the roles response the screen already loaded; nothing is fetched here.
 */
@customElement('elec-permission-rows')
export class ElecPermissionRows extends LitElement {
  @property({ attribute: false }) roles: RolesResponse | null = null;

  static styles = [
    electricityCss,
    css`
      :host {
        display: block;
        margin-block-start: 14px;
      }
      h3 {
        margin: 0 0 8px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
      }
      th.c,
      td.c {
        text-align: center;
      }
      .code {
        font-family: var(--sw-font-mono, monospace);
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        direction: ltr;
        text-align: start;
        unicode-bidi: isolate;
      }
      .tick {
        display: inline-grid;
        place-items: center;
        inline-size: 22px;
        block-size: 22px;
        border-radius: 6px;
        border: 2px solid var(--sw-border-strong);
        color: var(--sw-text-inverse, #fff);
      }
      .tick.on {
        background: var(--sw-accent);
        border-color: var(--sw-accent);
      }
      .phone {
        display: none;
      }
      @media (max-width: 760px) {
        .wide {
          display: none;
        }
        .phone {
          display: flex;
        }
      }
    `,
  ];

  private rows(): Row[] {
    const sensitive = new Set(this.roles?.sensitive ?? []);
    const label = (id: string) => this.roles?.labels[id] ?? ENERGY_PERMISSION_LABELS[id] ?? id;
    return [
      { id: 'energy.view', label: label('energy.view'), tag: '' },
      { id: 'energy.bills', label: label('energy.bills'), tag: sensitive.has('energy.bills') || !this.roles?.sensitive ? 'sensitive' : '' },
      { id: 'energy.manage', label: label('energy.manage'), tag: '' },
      { id: 'system.configure', label: 'הגדרות שמירת נתונים', tag: 'existing' },
    ];
  }

  private holds(role: RolesResponse['roles'][number], id: string): boolean {
    return role.permissions.includes(id) || role.sensitive_included.includes(id);
  }

  private chip(tag: Row['tag']) {
    if (tag === 'sensitive') return html`<span class="chip warn nodot">רגישה</span>`;
    if (tag === 'existing') return html`<span class="chip nodot">קיימת</span>`;
    return nothing;
  }

  render() {
    const roles = this.roles;
    if (!roles?.roles.length) return nothing;
    const rows = this.rows();
    return html`<section data-energy-permissions aria-label="הרשאות חשמל">
      <h3>חשמל</h3>
      <div class="card flush scrollx wide"><table class="t" data-energy-matrix>
        <thead><tr><th>הרשאה</th>${roles.roles.map((r) => html`<th class="c">${r.name}</th>`)}</tr></thead>
        <tbody>${rows.map((row) => html`<tr data-energy-row=${row.id}><td><b>${row.label}</b> ${this.chip(row.tag)}<div class="code">${row.id}</div></td>
          ${roles.roles.map((r) => html`<td class="c" data-role=${r.id}>${this.holds(r, row.id) ? html`<span class="tick on" aria-label="יש">✓</span>` : html`<span class="tick" aria-label="אין"></span>`}</td>`)}</tr>`)}</tbody></table></div>
      <div class="list phone" style="flex-direction:column">${rows.map((row) => html`<div class="li" style="flex-direction:column;align-items:stretch" data-energy-row-phone=${row.id}>
        <div class="row"><b>${row.label}</b>${this.chip(row.tag)}</div>
        <div class="t2 wrap">${roles.roles.filter((r) => this.holds(r, row.id)).map((r) => r.name).join(', ') || 'אין תפקיד'}</div></div>`)}</div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-permission-rows': ElecPermissionRows;
  }
}
