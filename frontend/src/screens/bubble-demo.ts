import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-pill';
import '../components/sw-sheet';
import '../components/sw-icon';
import { LOOK_DIALS, LookController, type Popup } from '../design/look';
import { currentSkin, resolvedTheme } from '../design/apply';

interface DemoDevice {
  id: string;
  kind: 'light' | 'switch' | 'cover' | 'climate' | 'sensor';
  name: string;
  icon: 'light' | 'bolt' | 'coverOpen' | 'snow' | 'thermometer' | 'sensor';
  on?: boolean;
  v?: number;
  hue: number;
  unavailable?: boolean;
  state?: string;
}

/** Fixture only: invented names, no lab data. */
const DEVICES: DemoDevice[] = [
  { id: 'l1', kind: 'light', name: 'תאורה מרכזית', icon: 'light', on: true, v: 0.72, hue: 2 },
  { id: 'l2', kind: 'light', name: 'ספוטים קיר', icon: 'light', on: true, v: 0.4, hue: 1 },
  { id: 'l3', kind: 'light', name: 'פס לד ספרייה ארוך מאוד בשם', icon: 'light', on: true, v: 0.25, hue: 3 },
  { id: 'l4', kind: 'light', name: 'מנורת קריאה', icon: 'light', on: false, v: 0.6, hue: 7 },
  { id: 's1', kind: 'switch', name: 'דוד שמש', icon: 'bolt', on: true, hue: 6 },
  { id: 's2', kind: 'switch', name: 'השקיה', icon: 'bolt', on: false, hue: 3 },
  { id: 'c1', kind: 'cover', name: 'תריס חלון גדול', icon: 'coverOpen', on: true, v: 0.6, hue: 4 },
  { id: 'c2', kind: 'cover', name: 'תריס מרפסת', icon: 'coverOpen', on: false, v: 0, hue: 4 },
  { id: 'k1', kind: 'climate', name: 'מזגן סלון', icon: 'snow', on: true, hue: 4, state: 'קירור · 23°' },
  { id: 'u1', kind: 'light', name: 'מנורת חוץ', icon: 'light', on: false, v: 0, hue: 8, unavailable: true, state: 'לא זמין' },
  { id: 'n1', kind: 'sensor', name: 'טמפרטורה', icon: 'thermometer', hue: 5, state: '25.5°' },
  { id: 'n2', kind: 'sensor', name: 'דלת מרפסת', icon: 'sensor', hue: 1, state: 'סגורה' },
];

const FLOORS = [
  { id: 'g', name: 'קומת קרקע', areas: ['סלון', 'מטבח', 'פינת אוכל', 'חדר עבודה'] },
  { id: 'f1', name: 'קומה א׳', areas: ['חדר שינה הורים', 'חדר ילדים', 'חדר רחצה'] },
  { id: 'out', name: 'חוץ', areas: ['חצר', 'חניה'] },
];

/**
 * `#/styleguide/bubble` - the demo page of the Bubble foundation components (phase B, 2026-10-02): sw-pill in every variant, the
 * list view, sw-sheet in its three kinds (the default follows the look dial), beside a mini floors / areas tree the inline
 * kind never covers. Fixture data; the layout guard (tests/layout-bubble.spec.ts) sweeps this page across widths, densities,
 * surfaces and schemes. `?skin=bubble&scheme=dark&look=density:compact,surface:glass` sets the page's look (design/look.ts).
 */
@customElement('bubble-demo')
export class BubbleDemo extends LitElement {
  @state() private devices = DEVICES.map((d) => ({ ...d }));
  @state() private sheet: '' | 'area' | 'confirm' | 'inline' | 'light' = '';
  @state() private area = 'סלון';
  @state() private collapsed = new Set<string>(['out']);
  private look = new LookController(this);

  static styles = css`
    :host {
      display: block;
      padding: var(--sw-page-pad);
      color: var(--sw-text);
    }
    .frame {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sw-gap-grid);
      align-items: start;
    }
    @media (min-width: 900px) {
      .frame {
        grid-template-columns: var(--sw-tree-w) minmax(0, 1fr);
      }
    }
    h1 {
      font-size: var(--sw-h1);
      margin: 0 0 12px;
      color: var(--sw-heading);
      font-weight: var(--sw-fw-bold);
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 14px 4px 8px;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-text);
    }
    h2::after {
      content: '';
      flex: 1;
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-2);
      opacity: 0.8;
    }
    .grid {
      display: grid;
      gap: var(--sw-gap-grid);
      grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--sw-grid-min)), 1fr));
    }
    .grid.list {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--sw-gap);
    }
    /* the mini building tree (kept in every skin and density) */
    nav.tree {
      border-radius: var(--sw-r-lg);
      padding: 14px 10px;
      background: var(--sw-nav-glass);
      -webkit-backdrop-filter: var(--sw-glass-blur-nav);
      backdrop-filter: var(--sw-glass-blur-nav);
      box-shadow: inset 0 1px 0 var(--sw-highlight);
    }
    nav.tree h3 {
      margin: 4px 10px 10px;
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading);
    }
    .floor-head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
      padding-inline: 4px;
    }
    .floor-head .t {
      flex: 1;
      font-weight: var(--sw-fw-semibold);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sub,
    .chev {
      inline-size: 44px;
      block-size: 44px;
      min-inline-size: 44px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--sw-text);
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
    }
    .sub:hover,
    .chev:hover {
      background: var(--sw-layer-2);
    }
    .chev sw-icon {
      transition: transform var(--sw-t-med) var(--sw-ease);
    }
    .floor[data-collapsed='true'] .chev sw-icon {
      transform: rotate(90deg);
    }
    .floor[data-collapsed='true'] .areas {
      display: none;
    }
    .areas {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-block-start: 4px;
    }
    .tree-row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      padding-inline: 6px 12px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
      inline-size: 100%;
    }
    .tree-row:hover {
      background: var(--sw-layer);
    }
    .tree-row[aria-current='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .tree-row .dot {
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      background: var(--sw-hue-1);
      color: #fff;
      display: grid;
      place-items: center;
      flex: none;
    }
    .tree-row .n {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* sub-buttons inside pills: round, the sub size, 44 px in touch layouts */
    .sb {
      inline-size: var(--sw-sub-size, var(--sw-sub));
      block-size: var(--sw-sub-size, var(--sw-sub));
      min-inline-size: var(--sw-touch-desktop, 44px);
      min-block-size: var(--sw-touch-desktop, 44px);
      border: 0;
      border-radius: 50%;
      background: var(--sw-surface-2);
      color: var(--sw-text);
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
    }
    .sb:hover {
      background: var(--sw-surface-3);
    }
    .sb:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    .chip {
      block-size: var(--sw-sub-size, var(--sw-sub));
      min-block-size: var(--sw-touch-desktop, 44px);
      min-inline-size: var(--sw-touch-desktop, 44px);
      box-sizing: border-box;
      justify-content: center;
      padding: 0 12px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .btn {
      min-block-size: var(--sw-touch-desktop, 44px);
      padding: 0 18px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn.primary {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .btn.danger {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .btn:focus-visible,
    .chip:focus-visible,
    .tree-row:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 8px;
    }
    .status {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-end: 10px;
    }
    @media (max-width: 1100px) {
      .sb,
      .btn,
      .chip {
        min-block-size: 44px;
      }
      .sb,
      .chip {
        min-inline-size: 44px;
      }
    }
    /* the sheet's inside: pills are translucent layers over the sheet */
    sw-sheet sw-pill {
      --pill-base: var(--sw-layer);
    }
    .kv {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
    }
    .kv > div {
      border-radius: var(--sw-r-md);
      background: var(--sw-layer);
      padding: 12px 16px;
    }
    .kv .k {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .kv .v {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
    }
    .big {
      --v: 0.5;
      position: relative;
      block-size: 64px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-layer);
      overflow: hidden;
      display: flex;
      align-items: center;
      padding-inline: 18px;
      font-weight: var(--sw-fw-bold);
    }
    .big::before {
      content: '';
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: calc(var(--v) * 100%);
      background: var(--sw-lit);
      z-index: 0;
    }
    .big > * {
      position: relative;
    }
  `;

  private set(id: string, patch: Partial<DemoDevice>) {
    this.devices = this.devices.map((d) => (d.id === id ? { ...d, ...patch } : d));
  }

  private pill(d: DemoDevice) {
    const pct = Math.round((d.v ?? 0) * 100);
    if (d.kind === 'light') {
      return html`<sw-pill variant="slider" .icon=${d.icon} .label=${d.name} .state=${d.state ?? (d.on ? `דולק · ${pct}%` : 'כבוי')} .value=${d.v ?? 0} ?on=${!!d.on} .hue=${d.hue} ?unavailable=${!!d.unavailable} data-dev=${d.id}
        @toggle=${(e: CustomEvent<{ on: boolean }>) => this.set(d.id, { on: e.detail.on })} @input=${(e: CustomEvent<{ value: number }>) => this.set(d.id, { v: e.detail.value, on: e.detail.value > 0 })}
        @icon-click=${() => (this.sheet = 'light')}></sw-pill>`;
    }
    if (d.kind === 'switch') {
      return html`<sw-pill variant="toggle" .icon=${d.icon} .label=${d.name} .state=${d.on ? 'פועל' : 'כבוי'} ?on=${!!d.on} ?accent=${!!d.on} .hue=${d.hue} data-dev=${d.id} @toggle=${(e: CustomEvent<{ on: boolean }>) => this.set(d.id, { on: e.detail.on })}></sw-pill>`;
    }
    if (d.kind === 'cover') {
      return html`<sw-pill variant="slider" .icon=${d.icon} .label=${d.name} .state=${pct ? `פתוח · ${pct}%` : 'סגור'} .value=${d.v ?? 0} ?on=${(d.v ?? 0) > 0} fill-color="var(--sw-accent-soft)" .hue=${d.hue} data-dev=${d.id}
        @input=${(e: CustomEvent<{ value: number }>) => this.set(d.id, { v: e.detail.value })} @toggle=${() => this.set(d.id, { v: (d.v ?? 0) > 0 ? 0 : 1 })}>
        <button slot="subs" class="sb" aria-label="פתח" @click=${() => this.set(d.id, { v: 1 })}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
        <button slot="subs" class="sb" aria-label="עצור"><sw-icon name="pause" size=${18}></sw-icon></button>
        <button slot="subs" class="sb" aria-label="סגור" @click=${() => this.set(d.id, { v: 0 })}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
      </sw-pill>`;
    }
    if (d.kind === 'climate') {
      return html`<sw-pill variant="plain" .icon=${d.icon} .label=${d.name} .state=${d.state ?? ''} ?on=${!!d.on} fill-color="var(--sw-cool)" .hue=${d.hue} data-dev=${d.id} @activate=${() => (this.sheet = 'light')}>
        <button slot="subs" class="sb" aria-label="הנמך"><sw-icon name="minus" size=${18}></sw-icon></button>
        <button slot="subs" class="chip" aria-label="יעד 23 מעלות">23°</button>
        <button slot="subs" class="sb" aria-label="הגבה"><sw-icon name="plus" size=${18}></sw-icon></button>
      </sw-pill>`;
    }
    return html`<sw-pill variant="plain" .icon=${d.icon} .label=${d.name} .state=${d.state ?? ''} .hue=${d.hue} data-dev=${d.id}></sw-pill>`;
  }

  private tree() {
    return html`<nav class="tree" aria-label="קומות ואזורים" data-demo-tree>
      <h3>הבית</h3>
      ${FLOORS.map((f) => {
        const col = this.collapsed.has(f.id);
        return html`<div class="floor" data-collapsed=${String(col)}>
          <div class="floor-head">
            <button type="button" class="chev" aria-expanded=${String(!col)} aria-label=${`${col ? 'הרחב' : 'כווץ'} ${f.name}`} @click=${() => { const n = new Set(this.collapsed); n.has(f.id) ? n.delete(f.id) : n.add(f.id); this.collapsed = n; }}><sw-icon name="chevronDown" size=${16}></sw-icon></button>
            <span class="t">${f.name}</span>
            <button type="button" class="sub" aria-label=${`תפריט ${f.name}`}><sw-icon name="more" size=${16}></sw-icon></button>
          </div>
          <div class="areas">${f.areas.map((a) => html`<button type="button" class="tree-row" aria-current=${a === this.area ? 'true' : 'false'} tabindex=${col ? -1 : 0} @click=${() => { this.area = a; if (this.sheet === 'inline') this.sheet = ''; }}><span class="dot"><sw-icon name="home" size=${16}></sw-icon></span><span class="n">${a}</span></button>`)}</div>
        </div>`;
      })}
    </nav>`;
  }

  render() {
    const l = this.look.value;
    const popup = l.popup as Popup;
    const lights = this.devices.filter((d) => d.kind === 'light');
    return html`<h1>Bubble · רכיבי היסוד</h1>
      <div class="status" data-demo-status>סקין ${currentSkin()} · ${resolvedTheme()} · ${LOOK_DIALS.density.labelHe[l.density]} · ${LOOK_DIALS.surface.labelHe[l.surface]} · ${LOOK_DIALS.popup.labelHe[popup]} · ${LOOK_DIALS.radius.labelHe[l.radius]} · ${l.transparency}% · ${l.scale}% · ${l.touch}px</div>
      <div class="actions">
        <button type="button" class="btn primary" data-open-area @click=${() => (this.sheet = 'area')}><sw-icon name="home" size=${18}></sw-icon>פתח אזור</button>
        <button type="button" class="btn" data-open-confirm @click=${() => (this.sheet = 'confirm')}>אישור ממורכז</button>
        <button type="button" class="btn" data-open-inline @click=${() => (this.sheet = 'inline')}>פתח בתוך הדף</button>
      </div>
      <div class="frame">
        ${this.tree()}
        <div>
          <sw-sheet kind="inline" heading=${`${this.area} · בתוך הדף`} ?open=${this.sheet === 'inline'} data-sheet-inline @close=${() => (this.sheet = '')}>
            <div class="grid">${lights.slice(0, 2).map((d) => this.pill(d))}</div>
            <button slot="footer" type="button" class="btn" @click=${() => (this.sheet = '')}>סגור</button>
          </sw-sheet>
          <h2>תאורה</h2>
          <div class="grid" data-demo-grid>${this.devices.filter((d) => d.kind === 'light' || d.kind === 'switch').map((d) => this.pill(d))}</div>
          <h2>אקלים ותריסים</h2>
          <div class="grid">${this.devices.filter((d) => d.kind === 'cover' || d.kind === 'climate').map((d) => this.pill(d))}</div>
          <h2>רשימה</h2>
          <div class="grid list" data-demo-list>${this.devices.filter((d) => d.kind === 'sensor' || d.kind === 'switch').map((d) => html`${this.pill({ ...d, id: `r-${d.id}` })}`)}</div>
        </div>
      </div>

      <sw-sheet wide heading=${this.area} ?open=${this.sheet === 'area'} data-sheet-area @close=${() => (this.sheet = '')}>
        <sw-pill slot="head" variant="plain" icon="home" .label=${this.area} state="3 דולקים · 25.5°" .hue=${2}>
          <button slot="subs" class="chip" aria-label="בהירות האזור">72%</button>
          <button slot="subs" class="sb" aria-label="כבה הכול"><sw-icon name="power" size=${18}></sw-icon></button>
        </sw-pill>
        <h2>תאורה</h2>
        <div class="grid">${lights.map((d) => this.pill(d))}</div>
        <h2>תריסים</h2>
        <div class="grid">${this.devices.filter((d) => d.kind === 'cover').map((d) => this.pill(d))}</div>
        <div class="kv"><div><span class="k">טמפרטורה</span><div class="v">25.5°</div></div><div><span class="k">לחות</span><div class="v">48%</div></div><div><span class="k">תנועה</span><div class="v">לפני 2 דק׳</div></div></div>
      </sw-sheet>

      <sw-sheet kind="centred" narrow heading="לכבות את כל התאורה?" ?open=${this.sheet === 'confirm'} data-sheet-confirm @close=${() => (this.sheet = '')}>
        <div>4 מנורות ייכבו ב${this.area}.</div>
        <button slot="footer" type="button" class="btn" @click=${() => (this.sheet = '')}>ביטול</button>
        <button slot="footer" type="button" class="btn danger" data-confirm-off @click=${() => { this.devices = this.devices.map((d) => (d.kind === 'light' ? { ...d, on: false } : d)); this.sheet = ''; }}>כבה</button>
      </sw-sheet>

      <sw-sheet heading="תאורה מרכזית" ?open=${this.sheet === 'light'} data-sheet-light @close=${() => (this.sheet = '')}>
        <div class="big" role="slider" tabindex="0" aria-label="בהירות" aria-valuemin="0" aria-valuemax="100" aria-valuenow="72" style="--v:0.72"><span>בהירות</span><span style="margin-inline-start:auto">72%</span></div>
        <div class="actions"><button type="button" class="chip" aria-pressed="true">חם</button><button type="button" class="chip">ניטרלי</button><button type="button" class="chip">קר</button></div>
        ${nothing}
      </sw-sheet>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bubble-demo': BubbleDemo;
  }
}
