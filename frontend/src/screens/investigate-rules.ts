import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-dialog';
import '../components/sw-chip';
import '../components/sw-state-panel';
import { isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { loadTree, type CatalogTree } from '../api/catalog';
import { listCameras } from '../api/maps';
import { listZones, type SpatialZone } from '../api/zones';
import { EVENT_LABEL, type EventKind } from '../api/events';
import { DAY_LABEL, SOURCE_LABEL_RULE, ackAlert, createRule, deleteRule, dryRunRule, emptyRule, listAlerts, listRules, updateRule, type DryRunResult, type Rule, type RuleAlert, type RuleBody, type RuleTrigger } from '../api/rules';
import type { Camera } from '../api/types';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-field';
import '../components/sw-steps';
import '../components/sw-tabs';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { demoRules } from '../fixtures/catalog';
import { navigate } from '../router';

const RULE_ICON: Record<string, { icon: IconName; bg: string; fg: string }> = {
  'r-1': { icon: 'user', bg: '#eaf0ff', fg: '#2f6bff' },
  'r-2': { icon: 'move', bg: '#e8f8ee', fg: '#16a34a' },
  'r-3': { icon: 'door', bg: '#fff4e0', fg: '#d97706' },
  'r-4': { icon: 'offline', bg: '#fdecec', fg: '#ef4444' },
};

/** SC21 — alerts & automation rules (board 3 screen 19): tabs, rule cards with icon square, toggle, Edit, ⋯. */
@customElement('investigate-rules')
export class InvestigateRules extends LitElement {
  @state() private tab = 'rules';
  @state() private rules: Rule[] = [];
  @state() private alerts: RuleAlert[] = [];
  @state() private unacked = 0;
  @state() private meta: { types: string[]; sources: string[]; days: string[] } = { types: [], sources: [], days: [] };
  @state() private error = '';
  @state() private busy = false;
  @state() private loading = false;
  @state() private editing: { id: string | null; revision: number; body: RuleBody } | null = null;
  @state() private dry: DryRunResult | null = null;
  @state() private dryBusy = false;
  @state() private tree: CatalogTree | null = null;
  @state() private cams: Camera[] = [];
  @state() private zones: SpatialZone[] = [];
  @state() private confirmDelete: Rule | null = null;
  private tz = 'Asia/Jerusalem';

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.load();
  }

  private async load() {
    this.loading = true;
    this.error = '';
    try {
      const [r, a] = await Promise.all([listRules(), listAlerts()]);
      this.rules = r.rules;
      this.meta = { types: r.types, sources: r.sources, days: r.days };
      this.alerts = a.alerts;
      this.unacked = a.unacked;
      if (!this.tree) {
        const [tree, cams] = await Promise.all([loadTree(), listCameras()]);
        this.tree = tree;
        this.cams = cams.cameras.filter((c) => c.enabled);
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private fmt(iso: string | null) {
    return iso ? new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';
  }

  private get floors() {
    return (this.tree?.sites ?? []).flatMap((s) => (s.buildings ?? []).flatMap((b) => (b.floors ?? []).map((f) => ({ id: f.id, name: `${b.name} · ${f.name}` }))));
  }

  private async run(action: () => Promise<void>) {
    this.busy = true;
    this.error = '';
    try {
      await action();
      await this.load();
    } catch (err) {
      this.error = describeError(err);
      if (err instanceof ApiError && err.status === 409) await this.load();
    } finally {
      this.busy = false;
    }
  }

  private openEditor(r?: Rule) {
    this.dry = null;
    this.zones = [];
    if (r) {
      const { id, revision, alerts, created_by_username, updated_by_username, created_at, updated_at, last_fired_at, ...body } = r;
      void alerts; void created_by_username; void updated_by_username; void created_at; void updated_at; void last_fired_at;
      this.editing = { id, revision, body: JSON.parse(JSON.stringify(body)) as RuleBody };
      if (body.scope.floor_ids.length === 1) void this.loadZones(body.scope.floor_ids[0]);
    } else {
      this.editing = { id: null, revision: 0, body: emptyRule() };
    }
  }

  private async loadZones(floorId: string) {
    try {
      this.zones = (await listZones(floorId)).zones;
    } catch {
      this.zones = [];
    }
  }

  private edit(mut: (b: RuleBody) => void) {
    if (!this.editing) return;
    const body = JSON.parse(JSON.stringify(this.editing.body)) as RuleBody;
    mut(body);
    this.editing = { ...this.editing, body };
  }

  private toggleIn(list: string[], value: string) {
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1);
    else list.push(value);
  }

  private async dryRun() {
    if (!this.editing) return;
    this.dryBusy = true;
    this.error = '';
    try {
      this.dry = this.editing.id ? await dryRunRule({ ...this.editing.body }, 24) : await dryRunRule(this.editing.body, 24);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.dryBusy = false;
    }
  }

  private save() {
    const e = this.editing;
    if (!e || !e.body.name.trim()) return;
    void this.run(async () => {
      if (e.id) await updateRule(e.id, { ...e.body, revision: e.revision });
      else await createRule(e.body);
      this.editing = null;
      this.dry = null;
    });
  }

  private summary(r: Rule) {
    const t = r.trigger.types.length ? r.trigger.types.map((x) => EVENT_LABEL[x as EventKind] ?? x).join(', ') : 'כל הסוגים';
    const scope = r.scope.floor_ids.length || r.scope.zone_ids.length || r.scope.camera_ids.length || r.scope.building_ids.length || r.scope.site_ids.length
      ? [r.scope.floor_ids.length ? `${r.scope.floor_ids.length} קומות` : '', r.scope.zone_ids.length ? `${r.scope.zone_ids.length} אזורים` : '', r.scope.camera_ids.length ? `${r.scope.camera_ids.length} מצלמות` : ''].filter(Boolean).join(' · ')
      : 'כל המתקן';
    const win = r.window.from || r.window.to || r.window.days.length ? `${r.window.days.map((d) => DAY_LABEL[d] ?? d).join('') || 'כל יום'} ${r.window.from ?? '00:00'}–${r.window.to ?? '24:00'}` : 'תמיד';
    return `${t} · ${scope} · ${win} · השהיה ${r.cooldown_s} שנ׳ · ${r.owner === 'ha' ? `בבעלות HA (${r.ha_automation_id})` : 'התראה במערכת'}`;
  }

  private renderEditor() {
    const e = this.editing;
    if (!e) return nothing;
    const b = e.body;
    const dry = this.dry;
    return html`<sw-dialog open heading=${e.id ? 'עריכת חוק' : 'חוק חדש'} subheading="Trigger → היקף → חלון זמן → השהיה → התראה במערכת · הרצה יבשה לפני שמירה" data-rule-dialog @close=${() => (this.editing = null)}>
      ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
      <sw-field label="שם"><input data-rule-name .value=${b.name} @input=${(ev: Event) => this.edit((x) => (x.name = (ev.target as HTMLInputElement).value))} /></sw-field>
      <sw-field label="סוגי אירועים (ריק = הכל)"><div class="chips">${this.meta.types.map((t) => html`<sw-chip data-rule-type=${t} ?selected=${b.trigger.types.includes(t)} @click=${() => this.edit((x) => this.toggleIn(x.trigger.types, t))}>${EVENT_LABEL[t as EventKind] ?? t}</sw-chip>`)}</div></sw-field>
      <sw-field label="מקורות (ריק = הכל)"><div class="chips">${this.meta.sources.map((s) => html`<sw-chip ?selected=${b.trigger.sources.includes(s)} @click=${() => this.edit((x) => this.toggleIn(x.trigger.sources, s))}>${SOURCE_LABEL_RULE[s] ?? s}</sw-chip>`)}</div></sw-field>
      <div class="two">
        <sw-field label="חומרה מינימלית"><select @change=${(ev: Event) => this.edit((x) => (x.trigger.severity_min = (ev.target as HTMLSelectElement).value as RuleTrigger['severity_min']))}>${(['info', 'alert', 'critical'] as const).map((s) => html`<option value=${s} ?selected=${b.trigger.severity_min === s}>${s === 'info' ? 'מידע' : s === 'alert' ? 'התראה' : 'קריטי'}</option>`)}</select></sw-field>
        <sw-field label="השהיה בין התראות (שניות)"><input type="number" min="0" max="86400" data-rule-cooldown .value=${String(b.cooldown_s)} @input=${(ev: Event) => this.edit((x) => (x.cooldown_s = Math.max(0, Number((ev.target as HTMLInputElement).value) || 0)))} /></sw-field>
      </div>
      <sw-field label="היקף: קומות (ריק = כל המתקן)"><div class="chips">${this.floors.map((f) => html`<sw-chip data-rule-floor=${f.id} ?selected=${b.scope.floor_ids.includes(f.id)} @click=${() => { this.edit((x) => this.toggleIn(x.scope.floor_ids, f.id)); const sel = this.editing?.body.scope.floor_ids ?? []; if (sel.length === 1) void this.loadZones(sel[0]); else this.zones = []; }}>${f.name}</sw-chip>`)}</div></sw-field>
      ${this.zones.length ? html`<sw-field label="חדרים / אזורים בקומה שנבחרה"><div class="chips">${this.zones.map((z) => html`<sw-chip ?selected=${b.scope.zone_ids.includes(z.id)} @click=${() => this.edit((x) => this.toggleIn(x.scope.zone_ids, z.id))}>${z.name}</sw-chip>`)}</div></sw-field>` : nothing}
      <sw-field label="מצלמות ספציפיות (לא חובה)"><div class="chips">${this.cams.map((c) => html`<sw-chip ?selected=${b.scope.camera_ids.includes(c.id)} @click=${() => this.edit((x) => this.toggleIn(x.scope.camera_ids, c.id))}>${c.name}</sw-chip>`)}</div></sw-field>
      <sw-field label="ימים (ריק = כל יום)"><div class="chips">${this.meta.days.map((d) => html`<sw-chip ?selected=${b.window.days.includes(d)} @click=${() => this.edit((x) => this.toggleIn(x.window.days, d))}>${DAY_LABEL[d] ?? d}</sw-chip>`)}</div></sw-field>
      <div class="two">
        <sw-field label="משעה (זמן האתר)"><input type="time" data-ltr .value=${b.window.from ?? ''} @change=${(ev: Event) => this.edit((x) => (x.window.from = (ev.target as HTMLInputElement).value || null))} /></sw-field>
        <sw-field label="עד שעה"><input type="time" data-ltr .value=${b.window.to ?? ''} @change=${(ev: Event) => this.edit((x) => (x.window.to = (ev.target as HTMLInputElement).value || null))} /></sw-field>
      </div>
      <sw-field label="הודעת ההתראה"><input data-rule-message .value=${b.actions[0]?.message ?? ''} @input=${(ev: Event) => this.edit((x) => (x.actions = [{ kind: 'notify', message: (ev.target as HTMLInputElement).value }]))} /></sw-field>
      <div class="two">
        <sw-field label="בעלות"><select @change=${(ev: Event) => this.edit((x) => (x.owner = (ev.target as HTMLSelectElement).value as RuleBody['owner']))}><option value="local" ?selected=${b.owner === 'local'}>מקומי (המערכת מפעילה)</option><option value="ha" ?selected=${b.owner === 'ha'}>Home Assistant (הפניה בלבד)</option></select></sw-field>
        ${b.owner === 'ha' ? html`<sw-field label="מזהה אוטומציה ב־HA"><input .value=${b.ha_automation_id ?? ''} @input=${(ev: Event) => this.edit((x) => (x.ha_automation_id = (ev.target as HTMLInputElement).value || null))} /></sw-field>` : html`<label class="chk"><input type="checkbox" .checked=${b.enabled} @change=${(ev: Event) => this.edit((x) => (x.enabled = (ev.target as HTMLInputElement).checked))} /> פעיל</label>`}
      </div>
      <div class="hint">הפעולה היחידה בפיילוט: התראה במערכת. אין פקודות למכשירים ואין webhooks; התראה אינה אירוע ולכן חוק לא יכול להזין את עצמו. חוק בבעלות HA אינו מופעל כאן (בעלים אחד לכל אוטומציה).</div>
      <div class="dryhead"><sw-button size="sm" icon="refresh" data-rule-dryrun ?disabled=${this.dryBusy} @click=${() => this.dryRun()}>${this.dryBusy ? 'מריץ…' : 'הרצה יבשה על 24 שעות'}</sw-button>${dry ? html`<span class="hint" data-dryrun-result>${dry.evaluated} אירועים נבדקו · <strong>${dry.would_fire.length}</strong> התראות היו נוצרות · ${dry.suppressed.length} נחסמו בהשהיה · ${dry.not_matched} לא תאמו</span>` : nothing}</div>
      ${dry
        ? html`<div class="dry">${[...dry.would_fire.map((r) => ({ ...r, fire: true })), ...dry.suppressed.map((r) => ({ ...r, fire: false }))].sort((a, b2) => a.occurred_at.localeCompare(b2.occurred_at)).slice(0, 40).map((r) => html`<div class="dryrow" data-dryrun-row data-fire=${r.fire ? 'true' : 'false'}><span class="ltr">${this.fmt(r.occurred_at)}</span><span>${EVENT_LABEL[r.type as EventKind] ?? r.type} · ${r.camera_name ?? '—'}</span><span class="hint">${r.fire ? r.reasons.join(' · ') : `נחסם: ${r.suppressed}`}</span></div>`)}${dry.would_fire.length + dry.suppressed.length > 40 ? html`<div class="hint">מוצגות 40 הראשונות</div>` : nothing}<div class="hint">${dry.note}</div></div>`
        : nothing}
      <sw-button slot="footer" variant="ghost" @click=${() => (this.editing = null)}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-rule-save ?disabled=${this.busy || !b.name.trim()} @click=${() => this.save()}>${e.id ? 'שמירה' : 'צור חוק'}</sw-button>
    </sw-dialog>`;
  }

  private renderApi() {
    if (this.error && !this.rules.length && !this.editing) return html`<sw-page heading="התראות וחוקי אוטומציה"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel></sw-page>`;
    return html`
      <sw-page heading="התראות וחוקי אוטומציה" subheading="Trigger → היקף → חלון זמן → השהיה → התראה במערכת · הרצה יבשה לפני הפעלה · אין פקודות למכשירים">
        <sw-button slot="actions" variant="primary" icon="plus" data-rule-new @click=${() => this.openEditor()}>חוק חדש</sw-button>
        <sw-tabs .items=${[{ id: 'rules', label: 'חוקים', count: this.rules.length }, { id: 'alerts', label: 'התראות', count: this.unacked }]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.error && !this.editing ? html`<div class="err">${this.error}</div>` : nothing}
        ${this.tab === 'rules'
          ? this.loading && !this.rules.length
            ? html`<sw-state-panel state="loading"></sw-state-panel>`
            : this.rules.length
              ? html`<div class="list">${this.rules.map((r) => html`<sw-card flush class="rule" data-rule-row data-rule-id=${r.id} style="--bg:#eaf0ff;--fg:#2f6bff">
                    <div class="ic"><sw-icon name=${r.owner === 'ha' ? 'home' : 'bell'} size=${16}></sw-icon></div>
                    <div class="txt"><b>${r.name}</b><small>${this.summary(r)}</small><small>התראות: ${r.alerts.open} פתוחות מתוך ${r.alerts.total} · שונה על ידי ${r.updated_by_username ?? r.created_by_username ?? '—'} ${this.fmt(r.updated_at)}</small></div>
                    <span class="last">הופעל: ${r.last_fired_at ? this.fmt(r.last_fired_at) : '—'}</span>
                    <sw-toggle ?checked=${r.enabled} ?disabled=${this.busy || r.owner === 'ha'} labelHidden label="פעיל" data-rule-toggle @change=${(ev: CustomEvent<{ checked: boolean }>) => void this.run(async () => { const { id, revision, alerts, created_by_username, updated_by_username, created_at, updated_at, last_fired_at, ...body } = r; void alerts; void created_by_username; void updated_by_username; void created_at; void updated_at; void last_fired_at; await updateRule(id, { ...body, enabled: ev.detail.checked, revision }); })}></sw-toggle>
                    <sw-button size="sm" data-rule-edit @click=${() => this.openEditor(r)}>עריכה</sw-button>
                    <sw-button variant="ghost" size="sm" iconOnly icon="trash" label="מחיקה" data-rule-delete @click=${() => (this.confirmDelete = r)}></sw-button>
                  </sw-card>`)}</div>`
              : html`<sw-state-panel state="empty" heading="אין חוקים עדיין" hint="חוק בודק אירועים שכבר נשמרו ומייצר התראה במערכת; הרץ הרצה יבשה לפני שמירה."></sw-state-panel>`
          : html`<div class="list">${this.alerts.length
              ? this.alerts.map((a) => html`<sw-card flush class="rule" data-alert-row data-acked=${a.acked_at ? 'true' : 'false'} style="--bg:${a.acked_at ? '#f1f5f9' : '#fff4e0'};--fg:${a.acked_at ? '#64748b' : '#d97706'}">
                  <div class="ic"><sw-icon name="bell" size=${16}></sw-icon></div>
                  <div class="txt"><b>${a.message || a.rule_name}</b><small>${a.rule_name} · ${a.camera_id ? `מצלמה ${a.camera_id}` : a.entity_id ?? ''} · <span class="ltr">${this.fmt(a.fired_at)}</span></small><small>${a.reasons.join(' · ')}</small></div>
                  <a href=${`#/investigate/events/${a.event_id}`}><sw-button size="sm" variant="ghost" icon="bell">לאירוע</sw-button></a>
                  ${a.acked_at ? html`<span class="last">טופל · ${a.acked_by_username ?? ''}</span>` : html`<sw-button size="sm" icon="check" data-alert-ack ?disabled=${this.busy} @click=${() => void this.run(async () => { await ackAlert(a.id); })}>סמן כטופל</sw-button>`}
                </sw-card>`)
              : html`<sw-state-panel state="empty" heading="אין התראות" hint="התראות נוצרות כשאירוע חדש תואם חוק פעיל."></sw-state-panel>`}</div>`}
        ${this.renderEditor()}
        ${this.confirmDelete
          ? html`<sw-dialog open heading="מחיקת חוק" subheading=${this.confirmDelete.name} @close=${() => (this.confirmDelete = null)}>
              <div class="hint">ההתראות של החוק יימחקו יחד איתו; האירועים עצמם נשארים.</div>
              <sw-button slot="footer" variant="ghost" @click=${() => (this.confirmDelete = null)}>ביטול</sw-button>
              <sw-button slot="footer" variant="danger" icon="trash" data-rule-delete-confirm @click=${() => { const r = this.confirmDelete!; this.confirmDelete = null; void this.run(async () => { await deleteRule(r.id); }); }}>מחק</sw-button>
            </sw-dialog>`
          : nothing}
      </sw-page>
    `;
  }

  static styles = css`
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-inline-size: 860px;
    }
    .rule {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 9px;
      background: var(--bg);
      color: var(--fg);
      flex-shrink: 0;
    }
    .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .txt b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .txt small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .last {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .empty {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      padding: 24px;
      text-align: center;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      align-self: end;
      padding-block-end: 8px;
    }
    .dryhead {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .dry {
      display: flex;
      flex-direction: column;
      max-block-size: 220px;
      overflow: auto;
    }
    .dryrow {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1.4fr);
      gap: 8px;
      padding: 4px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
    }
    .dryrow[data-fire='false'] {
      color: var(--sw-text-3);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    @media (max-width: 767px) {
      .last {
        display: none;
      }
      .two {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    if (isApi()) return this.renderApi();
    return html`
      <sw-page heading="התראות וחוקי אוטומציה" subheading="Trigger → היקף → תנאים → פעולה · בדיקה יבשה לפני הפעלה · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus" @click=${() => navigate('/investigate/rules/new')}>חוק חדש</sw-button>
        <sw-tabs .items=${[{ id: 'rules', label: 'חוקים', count: demoRules.length }, { id: 'notif', label: 'התראות' }, { id: 'sched', label: 'לוחות זמנים' }, { id: 'trig', label: 'Triggers' }]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.tab === 'rules'
          ? html`<div class="list">
              ${demoRules.map((r) => {
                const ic = RULE_ICON[r.id] ?? RULE_ICON['r-1'];
                return html`<sw-card flush class="rule" style="--bg:${ic.bg};--fg:${ic.fg}">
                  <div class="ic"><sw-icon .name=${ic.icon} size=${16}></sw-icon></div>
                  <div class="txt"><b>${r.name}</b><small>${r.trigger} · ${r.scope} · ${r.action}</small></div>
                  <span class="last">הופעל: ${r.last}</span>
                  <sw-toggle ?checked=${r.enabled} label=""></sw-toggle>
                  <sw-button size="sm" @click=${() => navigate(`/investigate/rules/${r.id}`)}>עריכה</sw-button>
                  <sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>
                </sw-card>`;
              })}
            </div>`
          : html`<sw-card><div class="empty">${this.tab === 'notif' ? 'ערוצי התראה: Push דרך HA, מייל (Beta). ההגדרה מגיעה עם T063.' : this.tab === 'sched' ? 'לוחות זמנים בזמן האתר (Asia/Jerusalem), שעון קיץ לפי התאריך.' : 'Triggers זמינים: אירועי NVR (אדם, רכב, תנועה, חציית קו, ניתוק) ושינויי מצב HA (allowlist).'}</div></sw-card>`}
      </sw-page>
    `;
  }
}

/** SC22 — rule editor with dry run and loop prevention. */
@customElement('investigate-rule-editor')
export class InvestigateRuleEditor extends LitElement {
  @property() ruleId = 'r-1';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dry {
      font-size: var(--sw-fs-sm);
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const r = demoRules.find((x) => x.id === this.ruleId) ?? { name: 'חוק חדש', trigger: 'זיהוי אדם', scope: 'חוץ', action: 'התראה' };
    return html`
      <sw-page heading=${r.name} subheading="עורך חוק · גרסה 2 · נתוני הדגמה" crumbs="אירועים | חוקים והתראות">
        <sw-button slot="actions" icon="play">בדיקה יבשה</sw-button>
        <sw-button slot="actions" variant="primary" icon="check">שמירה</sw-button>
        <sw-steps .steps=${['Trigger', 'היקף', 'תנאים', 'פעולה']} .current=${1}></sw-steps>
        <div class="layout">
          <div class="stack">
            <sw-card heading="Trigger">
              <div class="two">
                <sw-field label="מקור"><select><option>אירוע NVR</option><option>שינוי HA</option></select></sw-field>
                <sw-field label="סוג"><select><option>${r.trigger}</option><option>זיהוי רכב</option><option>תנועה</option></select></sw-field>
              </div>
            </sw-card>
            <sw-card heading="היקף">
              <div class="two">
                <sw-field label="היקף"><select><option>${r.scope}</option><option>כל האתר</option></select></sw-field>
                <sw-field label="לוח זמנים (זמן האתר)"><input value="22:00–06:00" data-ltr /></sw-field>
              </div>
            </sw-card>
            <sw-card heading="תנאים">
              <sw-field label="חלון סמיכות"><input value="90 שניות" /></sw-field>
              <div class="hint">״אירועים סמוכים בזמן ובאזור״, לא הוכחה סיבתית. החלון מתחשב באיחור שעון ובזמן קליטה.</div>
            </sw-card>
            <sw-card heading="פעולה">
              <div class="two">
                <sw-field label="פעולה"><select><option>${r.action}</option><option>Push דרך HA</option><option>פתיחת תצוגת מצלמות</option></select></sw-field>
                <sw-field label="Cooldown"><input value="5 דקות" /></sw-field>
              </div>
              <div class="hint">unlock / disarm אינם מופעלים על סמך תוצאת AI. שליטה אוטומטית היא opt-in לפי allowlist.</div>
            </sw-card>
          </div>
          <div class="stack">
            <sw-card heading="בדיקה יבשה על 24 שעות">
              <div class="dry">10:14 · כניסה ראשית · <sw-badge kind="live" label="היה מפעיל"></sw-badge></div>
              <div class="dry">09:42 · חצר · <sw-badge kind="neutral" label="מחוץ ללוח הזמנים"></sw-badge></div>
              <div class="dry">אתמול 23:10 · לובי · <sw-badge kind="live" label="היה מפעיל"></sw-badge></div>
              <div class="hint" style="margin-block-start:8px">2 הפעלות · 0 כפילויות · correlation id לכל אירוע · מניעת לולאה: פעולה שיצרה אירוע לא מפעילה את אותו חוק.</div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}
