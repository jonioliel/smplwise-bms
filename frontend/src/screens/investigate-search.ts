import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-tabs';
import '../components/sw-field';
import '../components/sw-scene';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { isApi } from '../api/session';
import { describeError } from '../api/client';
import { navigate } from '../router';
import { OBJECT_LABEL, searchProviders, semanticSearch, type ProvidersResponse, type SemanticResponse } from '../api/search';

const RESULTS = [
  { scene: 'entrance', when: '14.09.2026 10:14', cam: 'כניסה ראשית', why: 'NVR: זיהוי אדם (Smart)' },
  { scene: 'lobby', when: '14.09.2026 10:13', cam: 'לובי', why: 'NVR: תנועה + סמיכות במפה לכניסה' },
  { scene: 'parking', when: '14.09.2026 06:43', cam: 'חניה מקורה', why: 'NVR: חציית קו' },
  { scene: 'entrance', when: '14.09.2026 08:12', cam: 'כניסה ראשית', why: 'HA: דלת נפתחה + תנועה' },
  { scene: 'corridor', when: '13.09.2026 23:10', cam: 'מסדרון מזרחי', why: 'NVR: זיהוי אדם' },
  { scene: 'backyard', when: '13.09.2026 18:03', cam: 'חצר אחורית', why: 'NVR: תנועה' },
] as const;

/** SC19 — AI search (board 2 screen 9, Beta): search-by pills, "search by person" card, similar matches grid. Metadata filters first; AI only with a real index. */
@customElement('investigate-search')
export class InvestigateSearch extends LitElement {
  @state() private by = 'person';
  // ---- real mode (T063) ----
  @state() private q = '';
  @state() private answer: SemanticResponse | null = null;
  @state() private providers: ProvidersResponse | null = null;
  @state() private busy = false;
  @state() private error = '';

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.loadProviders();
  }

  private async loadProviders() {
    try {
      this.providers = await searchProviders();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async run() {
    const q = this.q.trim();
    if (!q) return;
    this.busy = true;
    this.error = '';
    try {
      this.answer = await semanticSearch(q);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private fmt(iso: string): string {
    try {
      return new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  private renderApi() {
    const a = this.answer;
    const p = this.providers;
    const local = p?.providers.find((x) => x.id === 'local');
    const ext = p?.providers.find((x) => x.id === 'external');
    const typeLabel: Record<string, string> = { person: 'אדם', vehicle: 'רכב', motion: 'תנועה', line: 'חציית קו', field: 'חדירה', door: 'דלת', offline: 'ניתוק', coverage_gap: 'פער כיסוי', other: 'אחר' };
    return html`
      <sw-page heading="חיפוש AI" subheading="שאלה חופשית → מסננים של מרכז האירועים (סוג, מקום, זמן) · baseline מקומי ללא רשת · ספק חיצוני רק ב־opt-in">
        <sw-badge slot="actions" kind=${p?.active === 'local' ? 'live' : 'unknown'} label=${p ? (p.active === 'local' ? `ספק: baseline מקומי · ${local?.model_version ?? ''}` : p.active === 'none' ? 'חיפוש סמנטי כבוי' : `ספק: ${p.active}`) : 'טוען…'}></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" data-semantic-q placeholder="למשל: אדם בלובי אתמול בערב · vehicle near the gate this morning" aria-label="חיפוש" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.run(); }} /></sw-field>
            <sw-button variant="primary" icon="search" data-semantic-run ?disabled=${this.busy || !this.q.trim()} @click=${() => this.run()}>חפש</sw-button>
          </div>
          ${this.error ? html`<div class="note" style="color:var(--sw-danger)">${this.error}</div>` : nothing}
          ${a
            ? html`<sw-card heading="כך פורשה השאלה" subheading=${`${a.provider.name} · ${a.provider.model_version} · ללא רשת`} data-semantic-parsed>
                  <div class="chips">
                    ${a.parsed.objects.map((o) => html`<sw-chip selected icon="target">${OBJECT_LABEL[o] ?? o}</sw-chip>`)}
                    ${a.parsed.places.map((pl) => html`<sw-chip selected icon=${pl.kind === 'camera' ? 'camera' : pl.kind === 'floor' ? 'floor' : 'map'} title=${`התאמה ${pl.match === 'exact' ? 'מדויקת' : 'חלקית'} למונח "${pl.term}"`}>${pl.name}${pl.match === 'partial' ? ' (~)' : ''}</sw-chip>`)}
                    ${a.parsed.window ? html`<sw-chip selected icon="clock">${a.parsed.window.label}</sw-chip>` : nothing}
                    ${!a.parsed.objects.length && !a.parsed.places.length && !a.parsed.window ? html`<span class="note">לא זוהה סוג, מקום או זמן — מוצגים אירועי היום בהיקף שלך.</span>` : nothing}
                  </div>
                  ${a.unsupported.length ? html`<div class="note" style="margin-block-start:6px;color:var(--sw-warning, #b45309)" data-semantic-unsupported>לא נתמך ב־baseline המקומי: ${a.unsupported.map((u) => `"${u.term}" — ${u.reason.startsWith('color') ? 'צבע' : 'מאפיין מראה'} דורש ספק ניתוח ב־opt-in`).join(' · ')}</div>` : nothing}
                  ${a.parsed.leftovers.length ? html`<div class="note" style="margin-block-start:4px">מילים שלא שימשו: ${a.parsed.leftovers.join(', ')}</div>` : nothing}
                </sw-card>
                <div class="head"><span>${a.total} התאמות (לפי metadata)</span><a href="#/investigate/events">מרכז האירועים</a></div>
                ${a.results.length
                  ? html`<div class="list">${a.results.map((r) => html`<div class="row" data-semantic-result data-confidence=${r.match.confidence} @click=${() => navigate(`/investigate/events/${r.id}`)}>
                        <sw-badge kind=${r.match.confidence === 'exact' ? 'live' : 'stale'} label=${r.match.confidence === 'exact' ? 'התאמה מדויקת' : 'התאמה חלקית'}></sw-badge>
                        <div class="body"><strong>${typeLabel[r.type] ?? r.type} · ${r.camera_name ?? '—'}</strong><span class="note">${this.fmt(r.occurred_at)} · ${r.confidence === 'measured' ? 'נמדד במכשיר' : 'משוער'} · ${r.match.basis.join(' · ')}</span></div>
                      </div>`)}</div>`
                  : html`<div class="note">אין אירועים תואמים בהיקף ובחלון הזמן.</div>`}
                <div class="note" data-semantic-note>${a.note}</div>`
            : html`<div class="note">כתוב שאלה חופשית בעברית או באנגלית. ה־baseline מבין סוג (אדם/רכב/תנועה/דלת/חצייה/חדירה), מקומות מהקטלוג (חדרים, קומות, מצלמות) וזמן (היום, אתמול, בערב, 08:00–09:30, השבוע).</div>`}
          <sw-card heading="ספקי ניתוח" subheading="מדיניות פרטיות, גרסת מודל, תקציב ו־opt-in הם חלק מהחוזה של כל ספק" data-semantic-provider>
            ${local ? html`<div class="prov"><strong>${local.name}</strong> · גרסה ${local.model_version} · ${local.network ? 'רשת' : 'ללא רשת'} · תקציב יומי ${local.budget_daily}<div class="note">${local.privacy}</div><div class="note">יכולות: ${local.capabilities.join(', ')}</div></div>` : nothing}
            ${ext ? html`<div class="prov" style="margin-block-start:8px"><strong>${ext.name}</strong> · ${ext.available === false ? 'לא זמין' : 'זמין'} · opt-in נדרש<div class="note">${ext.privacy}</div><div class="note">${ext.reason ?? ''}</div><div class="note">הגדרות: ai.provider=${p?.settings['ai.provider']} · ai.privacy_ack=${p?.settings['ai.privacy_ack']} · ai.budget_daily=${p?.settings['ai.budget_daily']}</div></div>` : nothing}
            <div class="actions" style="margin-block-start:8px"><sw-button size="sm" icon="upload" disabled title="דורש ספק ניתוח חיצוני ב־opt-in">חיפוש לפי תמונה</sw-button><sw-button size="sm" icon="aperture" disabled title="דורש ספק ניתוח חיצוני ב־opt-in">השתמש בפריים הנוכחי</sw-button><span class="note">חיפוש לפי תמונה, צבע ומראה אינו פעיל עד שמוגדר ספק עם הסכמה ותקציב.</span></div>
          </sw-card>
        </div>
      </sw-page>
    `;
  }

  static styles = css`
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      border-radius: 10px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-line);
      cursor: pointer;
    }
    .row .body {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .prov {
      font-size: var(--sw-fs-sm);
    }
    .wrap {
      max-inline-size: 860px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .by {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .by .ref {
      inline-size: 120px;
      block-size: 90px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      position: relative;
    }
    .by .ref sw-scene {
      position: absolute;
      inset: 0;
    }
    .by .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .by b {
      display: block;
      font-size: var(--sw-fs-md);
    }
    .by p {
      margin: 2px 0 10px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .head a {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-xs);
    }
    .results {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .res {
      cursor: pointer;
    }
    .res .pic {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: var(--sw-shadow-1);
    }
    .res .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .res .pic .demo {
      position: absolute;
      inset-inline-end: 6px;
      inset-block-start: 6px;
      font-size: 9.5px;
      background: rgba(17, 24, 39, 0.5);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .res .cap {
      margin-block-start: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      line-height: 1.35;
    }
    .res .cap small {
      display: block;
      color: var(--sw-text-3);
    }
    .searchrow {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .searchrow sw-field {
      flex: 1;
    }
    @media (max-width: 767px) {
      .results {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  render() {
    if (isApi()) return this.renderApi();
    return html`
      <sw-page heading="חיפוש AI" subheading="מצא בדיוק את מה שאתה מחפש · חיפוש סמנטי רק עם אינדקס אמיתי · נתוני הדגמה">
        <sw-badge slot="actions" kind="unknown" label="אין ספק AI מוגדר · רמה 0 (מטא־דאטה NVR)"></sw-badge>
        <div class="wrap">
          <div class="searchrow">
            <sw-field><input type="search" value="אדם בכניסה הראשית היום" aria-label="חיפוש" /></sw-field>
            <sw-button variant="primary" icon="search">חפש</sw-button>
          </div>
          <sw-tabs .items=${[{ id: 'person', label: 'אדם' }, { id: 'vehicle', label: 'רכב' }, { id: 'object', label: 'עצם' }, { id: 'color', label: 'צבע' }, { id: 'time', label: 'זמן' }, { id: 'site', label: 'אתר' }]} .active=${this.by} @change=${(e: CustomEvent<{ id: string }>) => (this.by = e.detail.id)}></sw-tabs>
          <sw-card>
            <div class="by">
              <div class="ref"><sw-scene kind="entrance"></sw-scene></div>
              <div class="txt">
                <b>חיפוש לפי ${this.by === 'person' ? 'אדם' : this.by === 'vehicle' ? 'רכב' : 'מאפיין'}</b>
                <p>מציאת הופעות של אותו אדם בכל המצלמות. פורש כ: סוג = אדם · קומה 0 · היום. זיהוי צבע, פנים או טקסט חופשי אינם פעילים עד שמוגדר ספק ומאושר dataset.</p>
                <div class="actions"><sw-button variant="primary" size="sm" icon="upload" disabled>העלאת תמונה</sw-button><sw-button size="sm" icon="aperture" disabled>השתמש בפריים הנוכחי</sw-button><sw-chip selected icon="target">אדם</sw-chip><sw-chip selected icon="floor">קומה 0</sw-chip><sw-chip selected icon="clock">היום</sw-chip></div>
              </div>
            </div>
          </sw-card>
          <div class="head"><span>התאמות (לפי מטא־דאטה)</span><a href="#/investigate/events">הצג הכל</a></div>
          <div class="results">
            ${RESULTS.map((r) => html`<div class="res" @click=${() => (window.location.hash = '#/investigate/playback')}><div class="pic"><sw-scene kind=${r.scene}></sw-scene><span class="demo">דמו</span></div><div class="cap">${r.when}<small>${r.cam} · ${r.why}</small></div></div>`)}
          </div>
        </div>
      </sw-page>
    `;
  }
}
