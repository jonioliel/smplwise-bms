import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { RolesResponse } from '../api/access';
import { elecCss } from './styles';
import { SkinController } from '../design/skin';
import { ENERGY_PERMISSIONS, energyPermissionLabel } from './access';
import { tr } from '../i18n/msg/electricity';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';

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
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) roles: RolesResponse | null = null;

  static styles = [
    elecCss,
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
      sw-table::part(code) {
        font-family: var(--sw-font-mono, monospace);
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        direction: ltr;
        text-align: start;
        unicode-bidi: isolate;
      }
      sw-table::part(tick) {
        display: inline-grid;
        place-items: center;
        inline-size: 22px;
        block-size: 22px;
        border-radius: var(--sw-r-xs);
        border: 2px solid var(--sw-border-strong);
        color: var(--sw-text-inverse);
      }
      sw-table::part(tick-on) {
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
    const label = (id: string) => this.roles?.labels[id] ?? energyPermissionLabel(id) ?? id;
    return [
      ...ENERGY_PERMISSIONS.map((id): Row => ({ id, label: label(id), tag: id === 'energy.bills' && (sensitive.has(id) || !this.roles?.sensitive) ? 'sensitive' : '' })),
      { id: 'system.configure', label: tr('הגדרות שמירת נתונים'), tag: 'existing' },
    ];
  }

  private holds(role: RolesResponse['roles'][number], id: string): boolean {
    return role.permissions.includes(id) || role.sensitive_included.includes(id);
  }

  private chip(tag: Row['tag']) {
    if (tag === 'sensitive') return html`<span class="chip c-warn nodot">${tr('רגישה')}</span>`;
    if (tag === 'existing') return html`<span class="chip nodot">${tr('קיימת')}</span>`;
    return nothing;
  }

  /** CR-CMP2-TABLES-CONSUMPTION-2450 (owner N10): the matrix as the shared sw-table (read-only): the permission (+ its tag chip in the
   * shared tones and its code, a mono LTR line) and one centred column per role (cell hook `data-role`) holding the tick - its box look
   * reaches the table through the `tick` / `tick-on` parts; the `.tick.on` class stays the specs' hook. */
  private columns(roles: RolesResponse): TableColumn<Row>[] {
    return [
      { key: 'label', label: tr('הרשאה'), render: (row) => html`<b>${row.label}</b> ${this.cellChip(row.tag)}<span class="t2" part="code">${row.id}</span>` },
      ...roles.roles.map(
        (r): TableColumn<Row> => ({
          key: `role-${r.id}`,
          label: r.name,
          align: 'center',
          cellAttrs: () => ({ 'data-role': r.id }),
          render: (row) => (this.holds(r, row.id) ? html`<span class="tick on" part="tick tick-on" aria-label=${tr('יש')}>✓</span>` : html`<span class="tick" part="tick" aria-label=${tr('אין')}></span>`),
        }),
      ),
    ];
  }

  private cellChip(tag: Row['tag']) {
    if (tag === 'sensitive') return html`<span class="chip" data-tone="warn" data-nodot>${tr('רגישה')}</span>`;
    if (tag === 'existing') return html`<span class="chip" data-nodot>${tr('קיימת')}</span>`;
    return nothing;
  }

  render() {
    const roles = this.roles;
    if (!roles?.roles.length) return nothing;
    const rows = this.rows();
    return html`<section data-energy-permissions aria-label=${tr('הרשאות חשמל')}>
      <h3>${tr('חשמל')}</h3>
      <sw-table class="t card flush wide" static-rows data-energy-matrix .columns=${this.columns(roles) as unknown as TableColumn[]} .rows=${rows as unknown as Record<string, unknown>[]}
        .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-energy-row': String(r.id) })}></sw-table>
      <div class="list phone" style="flex-direction:column">${rows.map((row) => html`<div class="li" style="flex-direction:column;align-items:stretch" data-energy-row-phone=${row.id}>
        <div class="row"><b>${row.label}</b>${this.chip(row.tag)}</div>
        <div class="t2 wrap">${roles.roles.filter((r) => this.holds(r, row.id)).map((r) => r.name).join(', ') || tr('אין תפקיד')}</div></div>`)}</div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-permission-rows': ElecPermissionRows;
  }
}
