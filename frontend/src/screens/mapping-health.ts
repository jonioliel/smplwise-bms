/**
 * MAPPING-ASSIST-2330 slice 2 - the health of the mapping after an apply (mockup v3 "אחרי ההחלה", answer 3A): names the home system added
 * since the last apply. Those the remembered table / rules / floor place are offered with one "אשר N" (a new version, kind `confirm`); the
 * others wait for a decision in the assistant. With the setting `auto_insert = on` the placed ones go in by themselves (kind `auto`, a
 * version and an audit row like any apply): MAPPING-IMPROVE-2351 moved that to a server background job (services/mapping_auto.py, on every
 * home-system structure refresh and at startup); the card shows "נוספו אוטומטית N אזורים" for what it placed. Only the static demo, which
 * has no server, still auto-inserts from here. A floor still waiting for its level ("קומות ללא מפלס") is never "אשר"-ed: it goes to the
 * assistant.
 *
 *  - the card on הגדרות › בניינים ומיפוי (registered on <system-mapping>);
 *  - <mapping-health-chip> - a quiet chip in the home's site bar ("3 אזורים חדשים - אשר"), only for a configurer, only with something new.
 */
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-icon';
import { describeError } from '../api/client';
import { canAnywhere, isApi } from '../api/session';
import { loadTree } from '../api/catalog';
import { autoNoticeText, buildPlan, health, itemKey, levelWaiting, resolve, subsetPlan, type Health, type MapItem } from '../api/mapping-engine';
import { applyMapping, loadMapping, type MappingData } from '../api/mapping';
import { navigate } from '../router';
import { SystemMapping } from './system-mapping';

const refsOf = (d: MappingData) => d.buildings.map((b) => ({ id: b.id, name: b.name, shared: b.is_shared }));

export function healthOf(d: MappingData): Health {
  const res = resolve(d.mapItems, d.parsed, { buildings: refsOf(d), settings: d.settings });
  return health(d.mapItems, res, d.seen, levelWaiting(d.mapItems, res, refsOf(d), d.ourFloors, d.links, d.parsed.levels));
}

/** "אשר" (or auto-insert): only the given new names, as their own version. */
export async function confirmFresh(d: MappingData, items: MapItem[], kind: 'confirm' | 'auto'): Promise<number> {
  const res = resolve(d.mapItems, d.parsed, { buildings: refsOf(d), settings: d.settings });
  const keys = new Set(items.map(itemKey));
  const plan = subsetPlan(buildPlan(d.mapItems, res, refsOf(d), d.ourFloors, d.links, d.parsed.levels), keys);
  const r = await applyMapping(d.site.id, { state: d.parsed, revision: d.revision, plan: { ...plan, items: [...keys] }, kind, summary: { confirmed: keys.size } });
  return r.version;
}

function where(d: MappingData, it: MapItem): string {
  const res = resolve(d.mapItems, d.parsed, { buildings: refsOf(d), settings: d.settings }).get(itemKey(it));
  const to = res?.to;
  if (!to || to.t === 'none') return '';
  return to.t === 'new' ? to.name : d.buildings.find((b) => b.id === to.id)?.name ?? '';
}

let autoRan = false;

/** Auto-insert (3A, setting on) in the static demo only - with a server the background job does it (MAPPING-IMPROVE-2351). */
async function autoInsert(host: SystemMapping) {
  const d = host.mapping;
  if (isApi() || !d || autoRan || d.settings.auto_insert !== 'on' || !d.seen) return;
  const h = healthOf(d);
  if (!h.ready.length) return;
  autoRan = true;
  try {
    await confirmFresh(d, h.ready, 'auto');
    await host.reload();
  } catch {
    autoRan = false;
  }
}

function autoNotice(d: MappingData) {
  const t = autoNoticeText(d);
  return t
    ? html`<div class="health ok" role="status" data-mapping-auto-notice><sw-icon name="sparkle" size=${22}></sw-icon><div class="t"><b>${t}</b><span>לפי הסימונים והכללים השמורים, בגרסה ${d.versions[0].number}. אפשר לחזור לגרסה קודמת בכל רגע.</span></div></div>`
    : nothing;
}

function card(host: SystemMapping, h: Health) {
  const d = host.mapping;
  if (!d || !d.seen) return nothing;
  return html`${autoNotice(d)}${freshCard(host, d, h)}`;
}

function freshCard(host: SystemMapping, d: NonNullable<SystemMapping['mapping']>, h: Health) {
  if (!h.fresh.length)
    return html`<div class="health ok" data-mapping-health="ok"><sw-icon name="check" size=${22}></sw-icon><div class="t"><b>המיפוי מעודכן</b><span>כל השמות במערכת הבית מוכרים מאז ההחלה האחרונה.</span></div></div>`;
  if (d.settings.auto_insert === 'on' && h.ready.length) void autoInsert(host);
  const sample = h.ready.slice(0, 2).map((it) => `"${it.name}" ← ${where(d, it)}`).join(', ');
  const openNames = h.open.slice(0, 2).map((it) => `"${it.name}"`).join(', ');
  const n = h.fresh.length;
  return html`<div class="health" data-mapping-health="fresh"><sw-icon name="warning" size=${22}></sw-icon>
    <div class="t"><b data-mapping-health-count>${n} ${n === 1 ? 'שם חדש' : 'שמות חדשים'} במערכת הבית</b>
      <span>${h.ready.length ? `לפי הסימון: ${sample}${h.ready.length > 2 ? ` ועוד ${h.ready.length - 2}` : ''}. ` : ''}${h.open.length ? `${openNames}${h.open.length > 2 ? ` ועוד ${h.open.length - 2}` : ''} - צריך החלטה.` : ''}</span></div>
    ${h.ready.length
      ? html`<sw-button size="sm" variant="primary" icon="check" data-mapping-confirm @click=${async (e: Event) => {
          const b = e.currentTarget as HTMLElement & { disabled: boolean };
          b.disabled = true;
          try {
            await confirmFresh(d, h.ready, 'confirm');
            await host.reload();
          } catch (err) {
            b.disabled = false;
            alertError(host, err);
          }
        }}>אשר ${h.ready.length}</sw-button>`
      : nothing}
    ${h.open.length ? html`<sw-button size="sm" data-mapping-health-decide @click=${() => host.openAssistant('decide')}>${h.open.length === 1 ? `החלט על "${h.open[0].name}"` : `החלט על ${h.open.length}`}</sw-button>` : nothing}
  </div>`;
}

function alertError(host: SystemMapping, err: unknown) {
  host.showError(describeError(err))
}

SystemMapping.healthCard = card;

/** The home's site-bar chip: something new since the last apply, for whoever may configure the site. */
@customElement('mapping-health-chip')
export class MappingHealthChip extends LitElement {
  @state() private h: Health | null = null;

  static styles = css`
    :host {
      display: contents;
    }
    button {
      font: inherit;
      font-size: var(--sw-fs-xs);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 32px;
      padding: 0 12px;
      border-radius: var(--sw-r-pill);
      border: 0;
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      cursor: pointer;
      white-space: nowrap;
      transition: transform 140ms var(--sw-ease-out, ease-out);
    }
    button:active {
      transform: scale(0.97);
    }
    b {
      font-weight: var(--sw-fw-bold);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    if (isApi() && !canAnywhere('site.content.configure')) return;
    try {
      const cat = await loadTree();
      const site = cat.sites[0];
      if (!site) return;
      const d = await loadMapping(isApi() ? site.id : 'site1');
      if (!d.seen) return;
      this.h = healthOf(d);
    } catch {
      this.h = null; // 403 or offline: no chip
    }
  }

  render() {
    const h = this.h;
    if (!h || !h.fresh.length) return nothing;
    return html`<button type="button" data-home-mapping-health @click=${() => navigate('/system/diagnostics', { tab: 'buildings' })}><sw-icon name="warning" size=${14}></sw-icon><b>${h.fresh.length}</b> ${h.fresh.length === 1 ? 'אזור חדש' : 'אזורים חדשים'} - ${h.ready.length ? 'אשר' : 'החלט'}</button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mapping-health-chip': MappingHealthChip;
  }
}
