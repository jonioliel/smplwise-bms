import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../xsection/sw-floor-home-link';
import './mapping-assistant';
import { describeError } from '../api/client';
import { isApi } from '../api/session';
import { loadTree, type HomeLinks } from '../api/catalog';
import type { Floor } from '../api/types';
import { loadXsData, type XsData } from '../xsection/xs-data';
import { detect, health, itemKey, levelWaiting, MAPPING_SETTING_CHOICES, resolve, summarize, tableRows, type MappingSettings, type Target } from '../api/mapping-engine';
import { loadMapping, restoreVersion, saveSettings, setMultiBuilding, type MappingData, type MappingVersion } from '../api/mapping';
import { MappingAssistant } from './mapping-assistant';

const SETTING_TEXT: { [K in keyof MappingSettings]: { label: string; hint: string; options: Record<MappingSettings[K], string> } } = {
  floor_inherit: { label: 'אזור בלי סימון בקומה של בניין ברור', hint: 'למשל "חדר אשפה" בקומה "א · קרקע"', options: { on: 'לפי הקומה', off: 'לשאול' } },
  auto_insert: { label: 'שם חדש עם סימון מוכר, אחרי ההחלה', hint: 'למשל "ב · חדר אופניים" שנוסף במערכת הבית', options: { off: 'לחכות ל"אשר"', on: 'להכניס לבד' } },
  new_token: { label: 'סימון שאין לו בניין - מה להציע ראשון', hint: 'למשל "ה · קומה 1" כשאין בניין ה', options: { new_first: 'בניין חדש', existing_first: 'בניין קיים', unassigned_first: 'לא משויך' } },
};
const KIND_TEXT: Record<MappingVersion['kind'], string> = { apply: 'החלה מהאשף', confirm: 'אישור שמות חדשים', auto: 'הוכנסו לבד', restore: 'חזרה לגרסה' };

/**
 * MAPPING-ASSIST-2330 `<system-mapping>` - הגדרות › בניינים ומיפוי (owner 31.10): the multi-building switch (OFF by default; the assistant may
 * prepare a mapping while it is off - nothing changes on the home screen until it is on), the buildings as the current mapping reads them,
 * the versions with "חזרה לגרסה זו", the assistant's three changeable behaviours, and the entry to the assistant. A site of one building
 * collapses to the existing per-floor "קישור למערכת הבית" dialog. Editable only with site.content.configure (the server says 403 otherwise).
 * `compact` = the setup wizard's short form (the switch and the assistant entry only).
 */
@customElement('system-mapping')
export class SystemMapping extends LitElement {
  @property({ type: Boolean }) compact = false;
  @state() private data: MappingData | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private busy = false;
  @state() private assistant: { start: 'mark' | 'table' | 'decide' | 'summary'; advanced: boolean } | null = null;
  @state() private confirmRestore: MappingVersion | null = null;
  @state() private floorDialog: Floor | null = null;
  @state() private singleFloors: Floor[] = [];
  @state() private xs: XsData | null = null;
  @state() private message = '';
  /** The single-building view can be left for the assistant ("יש לכם כמה בניינים?"). */
  @state() private forceFull = false;

  static styles = css`
    :host {
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
      gap: var(--sw-gap-lg, 16px);
      align-items: start;
    }
    .col {
      display: grid;
      gap: var(--sw-gap-lg, 16px);
      min-inline-size: 0;
    }
    .head {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      margin-block-end: var(--sw-gap-lg, 16px);
    }
    .head p {
      margin: 0;
      flex: 1 1 320px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      max-inline-size: 75ch;
    }
    .sw {
      display: flex;
      gap: 14px;
      align-items: center;
    }
    .sw .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: grid;
      gap: 4px;
    }
    .sw .t b {
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
    }
    .sw .t span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .toggle {
      flex: none;
      inline-size: 52px;
      block-size: 30px;
      border-radius: var(--sw-r-pill);
      border: 0;
      padding: 3px;
      background: var(--sw-border-strong, var(--sw-border));
      cursor: pointer;
      display: flex;
      transition: background-color 160ms ease;
    }
    .toggle i {
      inline-size: 24px;
      block-size: 24px;
      border-radius: 50%;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      transition: transform 200ms var(--sw-ease-out, ease-out);
    }
    .toggle[aria-checked='true'] {
      background: var(--sw-product-toggle-on, var(--sw-accent));
    }
    .toggle[aria-checked='true'] i {
      transform: translateX(-22px);
    }
    .toggle:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: not-allowed;
    }
    .state {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      font-size: var(--sw-fs-xs);
      padding: 2px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      inline-size: fit-content;
    }
    .state.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .rows {
      display: grid;
      gap: 6px;
    }
    .row {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
    }
    .row .g {
      flex: none;
      inline-size: 32px;
      block-size: 32px;
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      color: var(--sw-heading);
    }
    .row .g.sh {
      background: var(--sw-shared-soft);
      color: var(--sw-shared-text);
    }
    .row .g.un {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-bold);
    }
    .row .t {
      flex: 1 1 auto;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .row .t b {
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .t span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    .vr.cur {
      background: var(--sw-accent-soft);
    }
    .k {
      flex: none;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--sw-surface);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      font-size: var(--sw-fs-xs);
    }
    .pill {
      flex: none;
      font-size: var(--sw-fs-xs);
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .set {
      display: grid;
      gap: 6px;
      padding-block: 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    .set:last-child {
      border-block-end: 0;
    }
    .set .l {
      font-size: var(--sw-fs-sm);
      color: var(--sw-heading);
      font-weight: var(--sw-fw-medium);
    }
    .set .h {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .seg {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 2px;
      padding: 2px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      inline-size: fit-content;
      max-inline-size: 100%;
    }
    .seg button {
      font: inherit;
      font-size: var(--sw-fs-sm);
      border: 0;
      background: none;
      color: var(--sw-text-2);
      padding: 6px 12px;
      min-block-size: 34px;
      border-radius: calc(var(--sw-r-md) - 2px);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-thumb, var(--sw-surface));
      color: var(--sw-heading);
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
      font-weight: var(--sw-fw-semibold);
    }
    .seg button:disabled {
      cursor: not-allowed;
    }
    .msg {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .err {
      color: var(--sw-danger-text, var(--sw-danger));
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .health {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      padding: 12px 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-warning-soft);
      color: var(--sw-text);
    }
    .health.ok {
      background: var(--sw-accent-soft);
    }
    .health > sw-icon {
      color: var(--sw-warning-text);
      flex: none;
    }
    .health.ok > sw-icon {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .health .t {
      flex: 1 1 280px;
      min-inline-size: 0;
      display: grid;
      gap: 2px;
      font-size: var(--sw-fs-sm);
    }
    .health .t b {
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
    }
    .health .t span {
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    @media (max-width: 1100px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const cat = await loadTree();
      const site = cat.sites[0];
      if (!site) {
        this.error = 'אין עדיין אתר. צרו אתר ובניין במפה ‹ אתרים.';
        return;
      }
      this.data = await loadMapping(isApi() ? site.id : 'site1');
      this.singleFloors = (site.buildings ?? []).flatMap((b) => (b as { floors?: Floor[] }).floors ?? []);
      this.error = '';
    } catch (err) {
      const e = err as { status?: number };
      if (e?.status === 403) this.forbidden = true;
      else this.error = describeError(err);
    }
  }

  private get single(): boolean {
    return !!this.data && this.data.buildings.length < 2 && !this.forceFull;
  }

  private async toggleMulti() {
    if (!this.data || this.busy) return;
    this.busy = true;
    this.message = '';
    try {
      const r = await setMultiBuilding(!this.data.multi_building);
      this.data = { ...this.data, multi_building: r.enabled };
      this.message = r.enabled ? 'תצוגת ריבוי הבניינים פעילה במסך הראשי.' : 'תצוגת ריבוי הבניינים כבויה: המסך הראשי מציג בניין אחד, כמו קודם. המיפוי נשמר.';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async setSetting<K extends keyof MappingSettings>(k: K, v: MappingSettings[K]) {
    if (!this.data) return;
    try {
      const r = await saveSettings(this.data.site.id, { [k]: v } as Partial<MappingSettings>);
      this.data = { ...this.data, settings: r.settings };
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async restore(v: MappingVersion) {
    if (!this.data) return;
    this.busy = true;
    try {
      const r = await restoreVersion(this.data.site.id, v.number);
      this.confirmRestore = null;
      this.message = `נוצרה גרסה ${r.version} עם התוכן של גרסה ${v.number}.`;
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private bName(t: Target | null | undefined): string {
    if (!t || t.t === 'none') return 'לא משויך';
    if (t.t === 'new') return t.name;
    return this.data?.buildings.find((b) => b.id === t.id)?.name ?? '';
  }

  /** The buildings as the stored mapping reads the current names; and the health of the last apply (slice 2). */
  private computed() {
    const d = this.data!;
    const refs = d.buildings.map((b) => ({ id: b.id, name: b.name, shared: b.is_shared }));
    const res = resolve(d.mapItems, d.parsed, { buildings: refs, settings: d.settings });
    const det = detect(d.mapItems, d.parsed.spec);
    const sum = summarize(d.mapItems, res, refs, tableRows(det, d.parsed, refs));
    return { res, sum, health: health(d.mapItems, res, d.seen, levelWaiting(d.mapItems, res, refs, d.ourFloors, d.links, d.parsed.levels)) };
  }

  render() {
    if (this.forbidden) return html`<sw-card heading="בניינים ומיפוי"><div class="msg">רק מי שמנהל את תוכן האתר יכול לראות ולשנות את המיפוי.</div></sw-card>`;
    if (!this.data) return this.error ? html`<div class="err" role="alert">${this.error}</div>` : html`<div class="msg">טוען…</div>`;
    const d = this.data;
    const assistant = this.assistant
      ? html`<mapping-assistant .data=${d} start=${this.assistant.start} ?advancedOpen=${this.assistant.advanced}
          @close=${() => { this.assistant = null; void this.load(); }} @applied=${() => void 0}></mapping-assistant>`
      : nothing;
    if (this.single) return html`${this.renderSwitch()}${this.renderSingle()}${assistant}${this.renderFloorDialog()}`;
    const c = this.computed();
    if (this.compact)
      return html`${this.renderSwitch()}<div class="head" style="margin-block-start:12px"><p>${d.versions.length ? `המיפוי הוחל (גרסה ${d.versions[0].number}).` : 'עדיין לא מופה: איזה שם במערכת הבית שייך לאיזה בניין אצלנו.'}</p>
        <sw-button variant="primary" icon="play" data-mapping-open @click=${() => (this.assistant = { start: 'mark', advanced: false })}>${d.versions.length ? 'פתח את האשף מחדש' : 'פתח את אשף המיפוי'}</sw-button></div>${assistant}`;
    return html`
      <div class="head"><p>איזה שם במערכת הבית שייך לאיזה בניין אצלנו. האשף קורא את כל השמות, מציע, ושואל רק על החריגים. שום דבר לא משתנה במערכת הבית עצמה.</p>
        <sw-button variant="primary" icon="play" data-mapping-open @click=${() => (this.assistant = { start: 'mark', advanced: false })}>${d.versions.length ? 'פתח את האשף מחדש' : 'פתח את אשף המיפוי'}</sw-button>
        <sw-button variant="ghost" icon="filter" data-mapping-advanced @click=${() => (this.assistant = { start: 'mark', advanced: true })}>מתקדם</sw-button></div>
      ${this.message ? html`<div class="msg" role="status" style="margin-block-end:12px">${this.message}</div>` : nothing}
      ${this.error ? html`<div class="err" role="alert" style="margin-block-end:12px">${this.error}</div>` : nothing}
      <div class="grid">
        <div class="col">${this.renderHealth(c.health)}${this.renderSwitch()}${this.renderBuildings(c.sum)}</div>
        <div class="col">${this.renderVersions()}${this.renderSettings()}</div>
      </div>
      ${assistant}${this.renderRestoreDialog()}`;
  }

  private renderSwitch() {
    const d = this.data!;
    const on = d.multi_building;
    return html`<sw-card data-mapping-switch><div class="sw">
      <div class="t"><b>הפעל ריבוי בניינים</b>
        <span>${on ? 'פעיל: המסך הראשי מציג את האתר לפי בניינים, עם מעבר בין בניינים ו"כבה הכל" לכל בניין.' : 'כבוי: המסך הראשי מציג בניין אחד, בדיוק כמו היום. אפשר להכין את המיפוי כבר עכשיו - שום דבר לא משתנה במסך הראשי עד שמפעילים.'}</span>
        ${d.can_toggle ? nothing : html`<span class="muted">רק מי שמנהל את התוכן של כל האתרים יכול להפעיל או לכבות.</span>`}
        <span class="state ${on ? 'on' : ''}" data-mapping-switch-state=${on ? 'on' : 'off'}>${on ? 'פעיל' : 'כבוי'}</span></div>
      <button type="button" class="toggle" role="switch" aria-checked=${String(on)} aria-label="ריבוי בניינים" data-mapping-toggle ?disabled=${!d.can_toggle || this.busy} @click=${() => void this.toggleMulti()}><i></i></button>
    </div></sw-card>`;
  }

  private renderHealth(h: ReturnType<typeof health>) {
    if (!SystemMapping.healthCard) return nothing;
    return SystemMapping.healthCard(this, h);
  }

  /** Slice 2 registers the health card here (screens/mapping-health.ts); absent = no card. */
  static healthCard: ((host: SystemMapping, h: ReturnType<typeof health>) => unknown) | null = null;

  /** For the health card: the current data and a reload. */
  get mapping(): MappingData | null {
    return this.data;
  }
  reload() {
    return this.load();
  }
  showError(msg: string) {
    this.error = msg;
  }
  openAssistant(start: 'mark' | 'table' | 'decide' | 'summary') {
    this.assistant = { start, advanced: false };
  }

  private renderBuildings(sum: ReturnType<typeof summarize>) {
    const d = this.data!;
    const applied = d.versions.length > 0;
    return html`<sw-card heading="הבניינים" subheading=${applied ? `לפי המיפוי של גרסה ${d.versions[0].number}` : 'עדיין לא הוחל מיפוי - כך האשף היה קורא את השמות'} data-mapping-buildings>
      <div class="rows">
        ${sum.buildings.filter((b) => b.target.t === 'b').map((b) => {
          const shared = b.target.t === 'b' && d.buildings.find((x) => x.id === (b.target as { id: string }).id)?.is_shared;
          return html`<div class="row"><span class="g ${shared ? 'sh' : ''}"><sw-icon name=${shared ? 'sparkle' : 'building'} size=${16}></sw-icon></span>
            <span class="t"><b>${this.bName(b.target)}</b><span>${b.floors} קומות · ${b.areas} אזורים${b.tokens.length ? ` · ${b.tokens.map((t) => `"${t}"`).join(', ')}` : ''}${b.manual ? ` · ${b.manual} החלטות ידניות` : ''}</span></span></div>`;
        })}
        <div class="row"><span class="g un">?</span><span class="t"><b>לא משויך</b><span>${sum.unassigned.floors} קומות · ${sum.unassigned.areas} אזורים${sum.open ? ` · ${sum.open} מחכים להחלטה` : ''}</span></span>
          ${sum.open ? html`<sw-button size="sm" data-mapping-decide @click=${() => (this.assistant = { start: MappingAssistant.hasDecisions ? 'decide' : 'table', advanced: false })}>החלט עכשיו</sw-button>` : nothing}</div>
      </div></sw-card>`;
  }

  private renderVersions() {
    const d = this.data!;
    const when = (iso: string) => {
      const t = new Date(iso);
      return Number.isNaN(t.getTime()) ? iso : t.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };
    return html`<sw-card heading="גרסאות" subheading="חזרה לגרסה ישנה יוצרת גרסה חדשה עם התוכן שלה. שום דבר לא נמחק." data-mapping-versions>
      ${d.versions.length
        ? html`<div class="rows">${d.versions.slice(0, 8).map((v) => html`<div class="row vr ${v.current ? 'cur' : ''}" data-mapping-version=${v.number}>
            <span class="k">${v.number}</span>
            <span class="t"><b>גרסה ${v.number}${v.current ? ' · נוכחית' : ''}</b><span>${when(v.created_at)}${v.by ? ` · ${v.by}` : ''} · ${KIND_TEXT[v.kind]}${v.restored_from ? ` ${v.restored_from}` : ''}</span></span>
            ${v.current ? html`<span class="pill">פעילה</span>` : html`<sw-button size="sm" icon="history" data-mapping-restore=${v.number} @click=${() => (this.confirmRestore = v)}>חזרה לגרסה זו</sw-button>`}</div>`)}</div>`
        : html`<div class="msg">אין עדיין גרסאות. כל "החל" באשף יוצר גרסה.</div>`}
    </sw-card>`;
  }

  private renderSettings() {
    const d = this.data!;
    const row = <K extends keyof MappingSettings>(k: K) => html`<div class="set" data-mapping-setting=${k}>
      <span class="l">${SETTING_TEXT[k].label}</span><span class="h">${SETTING_TEXT[k].hint}</span>
      <span class="seg" role="group" aria-label=${SETTING_TEXT[k].label}>${(MAPPING_SETTING_CHOICES[k] as readonly MappingSettings[K][]).map((v) => html`<button type="button" aria-pressed=${String(d.settings[k] === v)} data-mapping-option=${v}
        @click=${() => void this.setSetting(k, v)}>${(SETTING_TEXT[k].options as Record<string, string>)[v as string]}</button>`)}</span></div>`;
    return html`<sw-card heading="איך המיפוי מתנהג" data-mapping-settings>${row('floor_inherit')}${row('auto_insert')}${row('new_token')}</sw-card>`;
  }

  private renderRestoreDialog() {
    const v = this.confirmRestore;
    if (!v) return nothing;
    return html`<sw-dialog open heading=${`חזרה לגרסה ${v.number}`} subheading="המיפוי יחזור לשורות של הגרסה הזו" @close=${() => (this.confirmRestore = null)}>
      <div class="msg">תיווצר גרסה חדשה עם התוכן של גרסה ${v.number}. הגרסה הנוכחית נשמרת ואפשר לחזור אליה. בניינים וקומות שנוצרו לא יימחקו, ושום דבר לא משתנה במערכת הבית.</div>
      <sw-button slot="footer" variant="ghost" @click=${() => (this.confirmRestore = null)}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="history" data-mapping-restore-confirm ?disabled=${this.busy} @click=${() => void this.restore(v)}>חזרה לגרסה ${v.number}</sw-button>
    </sw-dialog>`;
  }

  // ---------------------------------------------------------------------------------------------------------------------- one building

  private renderSingle() {
    const d = this.data!;
    const b = d.buildings[0];
    return html`<sw-card heading=${b ? b.name : 'בניין אחד'} subheading="באתר יש בניין אחד: כל קומה מקושרת לקומה במערכת הבית בנפרד" data-mapping-single style="margin-block-start:16px">
      <div class="rows">${this.singleFloors.map((f) => html`<div class="row"><span class="g"><sw-icon name="floor" size=${16}></sw-icon></span>
          <span class="t"><b>${f.name}</b><span>${(d.links.floors.filter((r) => r.floor_id === f.id).length ? 'מקושרת' : 'לפי המפלס או השם')}</span></span>
          <sw-button size="sm" icon="link" data-mapping-floor-link=${f.id} @click=${() => void this.openFloor(f)}>קישור למערכת הבית</sw-button></div>`)}</div>
      <div class="head" style="margin:14px 0 0"><p>יש לכם כמה בניינים באותה מערכת בית? האשף יזהה אותם לפי השמות וייצור אותם.</p>
        <sw-button variant="ghost" icon="play" data-mapping-open @click=${() => { this.forceFull = true; this.assistant = { start: 'mark', advanced: false }; }}>פתח את אשף המיפוי</sw-button></div>
    </sw-card>`;
  }

  private async openFloor(f: Floor) {
    this.xs = await loadXsData();
    this.floorDialog = f;
  }

  private renderFloorDialog() {
    const f = this.floorDialog;
    if (!f) return nothing;
    return html`<sw-floor-home-link .floor=${f} .floors=${this.singleFloors} .floorNames=${new Map(this.singleFloors.map((x) => [x.id, x.name]))} .tree=${this.xs?.tree ?? null} .links=${this.xs?.links ?? null}
      singleBuilding ?demo=${!isApi()} @close=${() => (this.floorDialog = null)}
      @saved=${(e: CustomEvent<{ links: HomeLinks }>) => { this.floorDialog = null; if (this.xs) this.xs = { ...this.xs, links: e.detail.links }; void this.load(); }}></sw-floor-home-link>`;
  }
}

/** Used by tests / the wizard: an item's key (kept here so the import is not tree-shaken by accident). */
export const mappingItemKey = itemKey;

declare global {
  interface HTMLElementTagNameMap {
    'system-mapping': SystemMapping;
  }
}
