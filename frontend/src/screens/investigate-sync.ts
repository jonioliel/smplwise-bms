import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-field';
import '../components/sw-timeline';
import { minuteLabel } from '../components/sw-timeline';
import { demoEvents, demoScene, demoSegments, demoWall } from '../fixtures/catalog';
import '../components/sw-card';
import '../components/sw-state-panel';
import { isApi } from '../api/session';
import { listCameras } from '../api/maps';
import { snapshotUrl } from '../api/media';
import { navigate } from '../router';
import { describeError } from '../api/client';
import type { Camera } from '../api/types';

interface RecentSet {
  cameras: string[];
  at: string;
  opened: string;
}

const RECENT_KEY = 'sw.sync.recent';

function localInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** SC13 — command center / synchronized playback (board 2 screen 14, Beta): 2×2 pictures, one transport row, one timeline, per-source truth. */
@customElement('investigate-sync')
export class InvestigateSync extends LitElement {
  @state() private cursor = 615;
  @state() private playing = false;
  @state() private cams: Camera[] | null = null;
  @state() private picked: string[] = [];
  @state() private when = localInput(new Date(Date.now() - 10 * 60_000));
  @state() private recent: RecentSet[] = [];
  @state() private error = '';

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    try {
      this.recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    } catch {
      this.recent = [];
    }
    void this.load();
  }

  private async load() {
    try {
      const list = await listCameras();
      this.cams = list.cameras.filter((c) => c.enabled && c.can_view_live !== false);
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
      this.cams = [];
    }
  }

  private toggle(id: string) {
    this.picked = this.picked.includes(id) ? this.picked.filter((x) => x !== id) : this.picked.length >= 4 ? this.picked : [...this.picked, id];
  }

  private launch(cameras = this.picked, atIso?: string) {
    if (cameras.length < 2) return;
    const at = atIso ?? new Date(this.when).toISOString();
    const set: RecentSet = { cameras, at, opened: new Date().toISOString() };
    const rest = this.recent.filter((r) => r.cameras.join(',') !== cameras.join(','));
    this.recent = [set, ...rest].slice(0, 6);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent));
    } catch {
      /* private mode */
    }
    navigate('/investigate/playback', { camera: cameras[0], extra: cameras.slice(1).join(','), t: at });
  }

  private name(id: string): string {
    return this.cams?.find((c) => c.id === id)?.name ?? id;
  }

  private renderApi() {
    const cams = this.cams;
    return html`
      <sw-page heading="ניגון מסונכרן" subheading="בחר 2–4 מצלמות וזמן — ההשוואה נפתחת במסך ההקלטות עם שעון ייחוס אחד ומדידת סטייה בין המקורות" wide>
        ${this.error ? html`<sw-state-panel state="error" heading="המצלמות לא נטענו" hint=${this.error}></sw-state-panel>` : nothing}
        ${cams === null
          ? html`<sw-state-panel state="loading" heading="טוען מצלמות…"></sw-state-panel>`
          : html`
            <sw-card heading="מצלמות להשוואה" subheading=${`${this.picked.length} מתוך 4 · הראשונה שנבחרת היא המובילה (שעון הייחוס)`}>
              <div class="filters" data-sync-cameras>
                ${cams.map((c) => html`<sw-chip ?selected=${this.picked.includes(c.id)} ?disabled=${!this.picked.includes(c.id) && this.picked.length >= 4} data-sync-camera=${c.id} dot=${c.status === 'online' ? '#22c55e' : '#ef4444'} @click=${() => this.toggle(c.id)}>${c.name}</sw-chip>`)}
              </div>
              ${this.picked.length
                ? html`<div class="picks">${this.picked.map((id, i) => html`<div class="pick" data-sync-pick=${id}>
                    <img src=${snapshotUrl(id)} alt="" loading="lazy" @error=${(e: Event) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
                    <div class="cap"><span>${this.name(id)}</span>${i === 0 ? html`<sw-badge kind="live" label="מובילה"></sw-badge>` : nothing}</div>
                  </div>`)}</div>`
                : html`<div class="note">עדיין לא נבחרו מצלמות. אפשר גם להתחיל מהמפה: בחירה מרובה › "ניגון מסונכרן".</div>`}
            </sw-card>
            <sw-card heading="זמן התחלה" subheading="זמן מקומי של הדפדפן; ההקלטה נפתחת מהפריים הקרוב ביותר">
              <div class="transport">
                <sw-field><input type="datetime-local" step="1" data-ltr data-sync-when .value=${this.when} aria-label="זמן" @change=${(e: Event) => (this.when = (e.target as HTMLInputElement).value)} /></sw-field>
                <sw-button size="sm" @click=${() => (this.when = localInput(new Date(Date.now() - 10 * 60_000)))}>לפני 10 דק׳</sw-button>
                <sw-button size="sm" @click=${() => (this.when = localInput(new Date(Date.now() - 60 * 60_000)))}>לפני שעה</sw-button>
                <span class="grow"></span>
                <sw-button variant="primary" icon="play" data-sync-launch ?disabled=${this.picked.length < 2} @click=${() => this.launch()}>פתח השוואה (${this.picked.length})</sw-button>
              </div>
              <div class="note">בהשוואה מהירויות שונות מ־1× כבויות; אריח מאחר מסונכרן מחדש לבד וסטיית ה־p95 מוצגת בחותמת. מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה", לא כמסונכרן.</div>
            </sw-card>
            ${this.recent.length
              ? html`<sw-card heading="השוואות אחרונות" subheading="נשמר בדפדפן הזה בלבד">
                  ${this.recent.map((r) => html`<div class="recent" data-sync-recent>
                    <span>${r.cameras.map((id) => this.name(id)).join(' · ')}</span>
                    <span class="ltr note">${new Date(r.at).toLocaleString('he-IL')}</span>
                    <sw-button size="sm" icon="play" @click=${() => this.launch(r.cameras, r.at)}>פתח</sw-button>
                  </div>`)}
                </sw-card>`
              : nothing}
          `}
      </sw-page>
    `;
  }

  static styles = css`
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .tile {
      position: relative;
    }
    .drift {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-end: 8px;
      z-index: 2;
      font-family: var(--sw-font-mono);
      font-size: 10px;
      background: rgba(17, 24, 39, 0.6);
      color: #fff;
      padding: 1px 7px;
      border-radius: var(--sw-r-pill);
      direction: ltr;
    }
    .transport {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .transport .grow {
      flex: 1;
    }
    .transport sw-field {
      inline-size: 170px;
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .picks {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 10px;
      margin-block-start: 10px;
    }
    .pick img {
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 8px;
      background: var(--sw-surface-3);
      display: block;
    }
    .pick .cap {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      margin-block-start: 4px;
    }
    .recent {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .recent:last-child {
      border-block-end: 0;
    }
    .recent > span:first-child {
      flex: 1;
      min-inline-size: 0;
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    if (isApi()) return this.renderApi();
    const sources = [
      { cam: demoWall[0], drift: '+0.2s', state: 'recorded' },
      { cam: demoWall[9], drift: '-0.4s', state: 'recorded' },
      { cam: demoWall[3], drift: 'gap', state: 'unknown' },
      { cam: demoWall[1], drift: 'buffering', state: 'stale' },
    ] as const;
    return html`
      <sw-page heading="מרכז שליטה" subheading="ניטור חי עם ניגון מסונכרן · 4 מקורות · שעון ייחוס אחד · נתוני הדגמה" wide>
        <sw-field slot="actions"><select aria-label="תצוגה"><option>כל המסכים</option><option>כניסה + חצר</option></select></sw-field>
        <sw-button slot="actions" variant="primary" icon="case">שמור כתיק</sw-button>
        <div class="grid">
          ${sources.map(
            (s) => html`<div class="tile">
              <span class="drift">${s.drift}</span>
              <sw-camera-tile name=${s.cam.name} state=${s.state} scene=${demoScene[s.cam.id] ?? 'lobby'}></sw-camera-tile>
            </div>`,
          )}
        </div>
        <div class="transport">
          <sw-field><input type="datetime-local" value=${`2026-09-14T${minuteLabel(this.cursor)}`} data-ltr aria-label="זמן" @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.split('T')[1] ?? '10:15'; const [h, m] = v.split(':').map(Number); this.cursor = h * 60 + m; }} /></sw-field>
          <sw-button iconOnly icon="mic" label="דיבור"></sw-button>
          <sw-button iconOnly icon="back10" label="אחורה"></sw-button>
          <sw-button variant="primary" iconOnly icon=${this.playing ? 'pause' : 'play'} label=${this.playing ? 'השהה הכל' : 'נגן הכל'} @click=${() => (this.playing = !this.playing)}></sw-button>
          <sw-button iconOnly icon="forward10" label="קדימה"></sw-button>
          <sw-chip selected>1×</sw-chip><sw-chip>2×</sw-chip>
          <span class="grow"></span>
          <sw-badge kind="stale" label="Best effort: אין מיפוי PTS→UTC מאומת"></sw-badge>
          <a href="#/live/wall"><sw-button variant="primary" size="sm" icon="live">Live</sw-button></a>
        </div>
        <sw-timeline .segments=${demoSegments} .events=${demoEvents.slice(0, 4).map((e) => ({ minute: e.minuteOfDay, kind: e.type, label: e.title }))} .cursor=${this.cursor} precision="estimated" @seek=${(e: CustomEvent<{ minute: number }>) => (this.cursor = e.detail.minute)}></sw-timeline>
        <div class="filters">
          <sw-chip selected icon="check">כל המצלמות</sw-chip>
          <sw-chip dot="#ef4444">תנועה</sw-chip><sw-chip dot="#2f6bff">אדם</sw-chip><sw-chip dot="#22c55e">רכב</sw-chip><sw-chip dot="#8b5cf6">אחר</sw-chip>
        </div>
        <div class="note">מקור שאינו מוכן מוצג במפורש (buffering / gap) ואינו מוצג כמסונכרן. יעד הנדסי: סטייה עד שנייה ב־95% מהדגימות, לאחר בדיקה עם אירוע חזותי משותף.</div>
      </sw-page>
    `;
  }
}
