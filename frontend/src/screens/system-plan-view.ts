import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { CHOICES, CHOICE_HE, DEFAULT_VIEW, DIAL_HE, PERSONAL_DIALS, RANGES, planViewPrefs, setPlanViewPrefs, snapDial, type PersonalDial, type PlanViewDials, type PlanViewPrefs } from '../api/plan-view';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { settingsStyles } from '../styles/settings';
import '../components/sw-icon';
import { HINT_HE, KIOSK_HE, type FlagDial, type SiteDial } from './plan-view-dials';

type Target = 'own' | 'installation';
type ChoiceDial = keyof typeof CHOICES;
type RangeDial = keyof typeof RANGES;

const choiceLabel = (dial: ChoiceDial, v: string | number): string => (dial === 'kiosk_idle_s' ? KIOSK_HE[Number(v)] ?? String(v) : CHOICE_HE[String(v)] ?? String(v));
const fmtRange = (dial: RangeDial, v: number): string => (dial === 'eye_m' ? `${v.toFixed(2)} מ׳` : `×${v.toFixed(2)}`);

/**
 * הגדרות › מפה › תצוגה ריאליסטית (CR-029 ST7 UI; LOOK_SPEC section 10, owner rule 2026-10-09: every look choice stays changeable).
 * Two owners of each value, the pattern of הגדרות › כללי › מראה: the installation's default (`plan.view`, every dial but the
 * default view; a system administrator; saved with the button, together with the site's location) and "ההעדפה שלי" (the person's
 * own dials through /plan-view/prefs, a PARTIAL set: each dial either follows the installation or overrides it; each change saved
 * at once). The 3D view reads `effective` when it opens. The stills (plan.bakes) rows of slice S3 stay in one place, הגדרות ›
 * כללי › וידאו ומדיה (integration 2.4.7, the ADR's option "keep the media-tab rows and remove the slot": docs/design/ST7_UI.md
 * item 8, docs/release/2.4.7-INTEGRATION-NOTES.md).
 */
@customElement('system-plan-view')
export class SystemPlanView extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private target: Target = 'own';
  @state() private prefs: PlanViewPrefs | null = null;
  /** The installation draft: only the dials changed since the load (the patch sends exactly these). */
  @state() private draft: Partial<Record<SiteDial, unknown>> = {};
  /** The stored site location as strings ('' = not set) and the draft of the two fields. */
  @state() private siteStored: { lat: string; lon: string } = { lat: '', lon: '' };
  @state() private siteDraft: { lat: string; lon: string } | null = null;
  @state() private canEdit = !isApi();
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';

  /* SETUPPLAN-POLISH-2331: the card sat on the map settings tab next to cards in the settings vocabulary (styles/settings.ts: the
     well rows, the semibold labels, the filled-accent segment, the .msg result pill) but carried its own older copy - hairline rows,
     a thumb-style segment, an 11 px grey sub-heading and a bare coloured word for "saved". It now takes settingsStyles and keeps only
     what is its own: the 44 px touch dial of the Studio 6 controls (layout-st7-ui measures it), a wrapping segment for the long
     option lists, the range row and the site fields. */
  static styles = [settingsStyles, css`
    :host {
      display: block;
    }
    .row {
      flex-wrap: wrap;
    }
    .row .lbl {
      min-inline-size: 120px;
      flex: 1 1 200px;
    }
    /* the scope switch heads the card: the one choice that changes what every row below means */
    .row.scope {
      background: transparent;
      padding-inline: 0;
      padding-block: 0 var(--sw-s-3);
      border-block-end: 1px solid var(--sw-border);
      border-radius: 0;
    }
    .row.scope + .sub {
      margin-block-start: var(--sw-s-3);
    }
    /* a sub-heading inside the card: the settings group-label scale, one step down (a heading, not a grey caption) */
    .sub {
      margin: var(--sw-s-4) 0 var(--sw-s-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.005em;
    }
    /* the settings segment, wrapping instead of clipping (five kiosk choices at 320 px) and on the 44 px dial */
    .seg {
      flex: 0 1 auto;
      flex-wrap: wrap;
    }
    .seg button {
      min-block-size: var(--sw-touch-desktop, 44px);
      font-weight: var(--sw-fw-medium);
    }
    .seg button[aria-pressed='true'] {
      font-weight: var(--sw-fw-semibold);
    }
    .seg button[disabled] {
      cursor: default;
      opacity: 0.6;
    }
    .dirty {
      font-size: var(--sw-fs-sm);
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-semibold);
    }
    .seg button:focus-visible,
    .range button:focus-visible,
    .range input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .range {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-inline-size: 0;
      flex-wrap: wrap;
    }
    .range input[type='range'] {
      flex: 1 1 140px;
      min-inline-size: 120px;
      accent-color: var(--sw-accent);
      block-size: var(--sw-touch-desktop, 44px);
      margin: 0;
    }
    .range output {
      min-inline-size: 64px;
      padding-inline: 16px; /* clear of the pill's rounded corner in the bubble skin */
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
      direction: ltr;
    }
    .range button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      min-block-size: var(--sw-touch-desktop, 44px);
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      background: var(--sw-surface);
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .range button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    .range button[aria-pressed='true'] {
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
      background: var(--sw-accent);
      font-weight: var(--sw-fw-semibold);
    }
    .range button[disabled] {
      cursor: default;
      opacity: 0.6;
    }
    @media (prefers-reduced-motion: reduce) {
      .range button {
        transition-duration: 0ms;
      }
    }
    .site {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      inline-size: 100%;
      max-inline-size: 320px;
    }
    .site input {
      min-block-size: var(--sw-touch-desktop, 44px);
    }
    .foot {
      margin-block-start: var(--sw-s-4);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (pointer: coarse) {
      .seg button,
      .range button {
        min-block-size: 44px;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.prefs = await planViewPrefs(true);
      if (isApi()) {
        const r = await getSettings();
        this.canEdit = r.can_edit;
        const lat = r.settings['site.latitude'];
        const lon = r.settings['site.longitude'];
        this.siteStored = { lat: lat === null || lat === undefined ? '' : String(lat), lon: lon === null || lon === undefined ? '' : String(lon) };
      }
    } catch (err) {
      this.error = describeError(err);
    }
  }

  /** The installation's value of a dial: the draft first, then the stored one, then the product default. */
  private siteValue<K extends SiteDial>(dial: K): PlanViewDials[K] {
    return (this.draft[dial] ?? this.prefs?.site[dial] ?? DEFAULT_VIEW[dial]) as PlanViewDials[K];
  }

  private get dirty(): boolean {
    return Object.keys(this.draft).length > 0 || (!!this.siteDraft && (this.siteDraft.lat !== this.siteStored.lat || this.siteDraft.lon !== this.siteStored.lon));
  }

  private flash(text: string) {
    this.message = text;
    window.setTimeout(() => (this.message = ''), 2500);
  }

  private setInst<K extends SiteDial>(dial: K, value: PlanViewDials[K]) {
    const next = { ...this.draft };
    if (value === (this.prefs?.site[dial] ?? DEFAULT_VIEW[dial])) delete next[dial];
    else next[dial] = value;
    this.draft = next;
    this.message = '';
  }

  private async saveInstallation() {
    const body: Record<string, unknown> = {};
    if (Object.keys(this.draft).length) body['plan.view'] = { ...this.draft };
    const site = this.siteDraft;
    if (site) {
      if (site.lat !== this.siteStored.lat) body['site.latitude'] = site.lat;
      if (site.lon !== this.siteStored.lon) body['site.longitude'] = site.lon;
      const lat = parseFloat(site.lat);
      const lon = parseFloat(site.lon);
      if ((site.lat && (!Number.isFinite(lat) || Math.abs(lat) > 90)) || (site.lon && (!Number.isFinite(lon) || Math.abs(lon) > 180))) {
        this.error = 'מיקום האתר: קו רוחב בין -90 ל-90, קו אורך בין -180 ל-180.';
        return;
      }
      if ((site.lat === '') !== (site.lon === '')) {
        this.error = 'מיקום האתר: צריך גם קו רוחב וגם קו אורך (או שניהם ריקים).';
        return;
      }
    }
    if (!Object.keys(body).length) return;
    this.busy = true;
    this.error = '';
    try {
      if (isApi()) {
        const r = await patchSettings(body as Partial<Parameters<typeof patchSettings>[0]>);
        invalidateSettings();
        const lat = r.settings['site.latitude'];
        const lon = r.settings['site.longitude'];
        this.siteStored = { lat: lat === null || lat === undefined ? '' : String(lat), lon: lon === null || lon === undefined ? '' : String(lon) };
        this.prefs = await planViewPrefs(true);
      } else {
        // the demo keeps the choice for the page
        const cur = this.prefs ?? (await planViewPrefs());
        this.prefs = { ...cur, site: { ...cur.site, ...(this.draft as Partial<PlanViewPrefs['site']>) }, effective: { ...cur.effective, ...(this.draft as Partial<PlanViewDials>), ...cur.own } };
        if (site) this.siteStored = { ...site };
      }
      this.draft = {};
      this.siteDraft = null;
      this.flash('ברירת המחדל נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** My own dial: a value overrides the installation's, null follows it. Saved at once. */
  private async setOwn(dial: PersonalDial, value: unknown) {
    this.busy = true;
    this.error = '';
    try {
      this.prefs = await setPlanViewPrefs({ [dial]: value } as Partial<Record<PersonalDial, unknown>>);
      this.flash('ההעדפה נשמרה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async clearOwn() {
    const patch = Object.fromEntries(PERSONAL_DIALS.map((d) => [d, null])) as Partial<Record<PersonalDial, unknown>>;
    this.busy = true;
    this.error = '';
    try {
      this.prefs = await setPlanViewPrefs(patch);
      this.flash('ההעדפה נמחקה');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  // ---- rows

  private get instDisabled(): boolean {
    return this.busy || !this.canEdit;
  }

  /** A choice dial as a segmented control. Own target: "לפי ההתקנה" first; the installation target: the draft's value. */
  private choiceRow(dial: ChoiceDial): TemplateResult {
    const own = this.target === 'own';
    const personal = (PERSONAL_DIALS as readonly string[]).includes(dial);
    const values = CHOICES[dial] as readonly (string | number)[];
    const inst = dial === 'default_view' ? 'schematic' : this.siteValue(dial as SiteDial);
    const current = own ? (this.prefs?.own[dial as PersonalDial] ?? null) : inst;
    const disabled = own ? this.busy || !personal : this.instDisabled || dial === 'default_view';
    const hint = own && current === null ? `לפי ההתקנה: ${choiceLabel(dial, inst as string | number)} · ${HINT_HE[dial]}` : HINT_HE[dial];
    return html`<div class="row" data-view-row=${dial}>
      <span class="lbl">${DIAL_HE[dial]}<span class="muted">${hint}</span></span>
      <span class="seg" role="group" aria-label=${DIAL_HE[dial]}>
        ${own && personal ? html`<button type="button" data-view-follow=${dial} aria-pressed=${current === null ? 'true' : 'false'} ?disabled=${disabled} @click=${() => void this.setOwn(dial as PersonalDial, null)}>לפי ההתקנה</button>` : nothing}
        ${values.map((v) => html`<button type="button" data-view-option=${`${dial}:${v}`} aria-pressed=${current === v ? 'true' : 'false'} ?disabled=${disabled}
          @click=${() => (own ? void this.setOwn(dial as PersonalDial, v) : this.setInst(dial as SiteDial, v as never))}>${choiceLabel(dial, v)}</button>`)}
      </span>
    </div>`;
  }

  private flagRow(dial: FlagDial): TemplateResult {
    const own = this.target === 'own';
    const inst = this.siteValue(dial);
    const current = own ? (this.prefs?.own[dial] ?? null) : inst;
    const disabled = own ? this.busy : this.instDisabled;
    const label = (v: boolean) => (v ? 'פעיל' : 'כבוי');
    const hint = own && current === null ? `לפי ההתקנה: ${label(inst)} · ${HINT_HE[dial]}` : HINT_HE[dial];
    return html`<div class="row" data-view-row=${dial}>
      <span class="lbl">${DIAL_HE[dial]}<span class="muted">${hint}</span></span>
      <span class="seg" role="group" aria-label=${DIAL_HE[dial]}>
        ${own ? html`<button type="button" data-view-follow=${dial} aria-pressed=${current === null ? 'true' : 'false'} ?disabled=${disabled} @click=${() => void this.setOwn(dial, null)}>לפי ההתקנה</button>` : nothing}
        ${[true, false].map((v) => html`<button type="button" data-view-option=${`${dial}:${v}`} aria-pressed=${current === v ? 'true' : 'false'} ?disabled=${disabled}
          @click=${() => (own ? void this.setOwn(dial, v) : this.setInst(dial, v))}>${label(v)}</button>`)}
      </span>
    </div>`;
  }

  private rangeRow(dial: RangeDial): TemplateResult {
    const own = this.target === 'own';
    const [lo, hi, step] = RANGES[dial];
    const inst = this.siteValue(dial);
    const ownValue = this.prefs?.own[dial];
    const follows = own && ownValue === undefined;
    const value = own ? (ownValue ?? inst) : inst;
    const disabled = own ? this.busy : this.instDisabled;
    const onChange = (e: Event) => {
      const v = snapDial(dial, Number((e.target as HTMLInputElement).value));
      if (own) void this.setOwn(dial, v);
      else this.setInst(dial, v);
    };
    return html`<div class="row" data-view-row=${dial}>
      <span class="lbl">${DIAL_HE[dial]}<span class="muted">${follows ? `לפי ההתקנה: ${fmtRange(dial, inst)}` : fmtRange(dial, value)} · ${HINT_HE[dial]}</span></span>
      <span class="range">
        ${own ? html`<button type="button" data-view-follow=${dial} aria-pressed=${follows ? 'true' : 'false'} ?disabled=${disabled} @click=${() => void this.setOwn(dial, null)}>לפי ההתקנה</button>` : nothing}
        <input type="range" data-view-range=${dial} min=${lo} max=${hi} step=${step} .value=${String(value)} ?disabled=${disabled} aria-label=${DIAL_HE[dial]} aria-valuetext=${fmtRange(dial, value)} @input=${own ? nothing : onChange} @change=${onChange} />
        <output>${fmtRange(dial, value)}</output>
      </span>
    </div>`;
  }

  private siteRow(): TemplateResult {
    const d = this.siteDraft ?? this.siteStored;
    const set = (patch: Partial<{ lat: string; lon: string }>) => {
      this.siteDraft = { ...(this.siteDraft ?? this.siteStored), ...patch };
      this.message = '';
    };
    return html`<div class="row" data-view-row="site">
      <span class="lbl">מיקום האתר — ידני<span class="muted">קו רוחב וקו אורך במעלות, לחישוב מסלול השמש. חל רק כשמקור המיקום הוא "ידני" (הגדרות ‹ כללי ‹ וידאו ומדיה ‹ מיקום האתר לשמש בתלת־ממד); אחרת השמש לפי מיקום הבית</span></span>
      <span class="site">
        <sw-field label="קו רוחב"><input type="text" inputmode="decimal" data-ltr data-site-lat placeholder="32.08" .value=${d.lat} ?disabled=${this.instDisabled} @input=${(e: Event) => set({ lat: (e.target as HTMLInputElement).value.trim() })} /></sw-field>
        <sw-field label="קו אורך"><input type="text" inputmode="decimal" data-ltr data-site-lon placeholder="34.78" .value=${d.lon} ?disabled=${this.instDisabled} @input=${(e: Event) => set({ lon: (e.target as HTMLInputElement).value.trim() })} /></sw-field>
      </span>
    </div>`;
  }

  render() {
    const own = this.target === 'own';
    return html`<sw-card heading="תצוגה ריאליסטית" subheading="סגנון, תצוגת פתיחה, ריהוט וחומרים, שעה ואור, סיור בגובה עין, מסך קיר ומיקום האתר - לכל ההתקנה ולעצמי" data-plan-view-card>
      <div class="row scope">
        <span class="lbl">למי<span class="muted">${own ? 'ההעדפה שלי: כל שינוי נשמר מיד ותקף בכל מכשיר שלי' : 'ברירת המחדל של ההתקנה: נשמרת בכפתור'}</span></span>
        <span class="seg" role="group" aria-label="למי">
          <button type="button" data-view-target="own" aria-pressed=${own ? 'true' : 'false'} @click=${() => (this.target = 'own')}>ההעדפה שלי</button>
          <button type="button" data-view-target="installation" aria-pressed=${own ? 'false' : 'true'} @click=${() => (this.target = 'installation')}>ברירת המחדל של ההתקנה</button>
        </span>
      </div>
      <h4 class="sub">מראה</h4>
      ${this.choiceRow('style')}
      ${this.choiceRow('backdrop')}
      ${this.choiceRow('default_view')}
      ${own ? nothing : html`${this.choiceRow('furniture')}${this.choiceRow('textures')}${this.choiceRow('floor_finish')}`}
      ${this.flagRow('section_cut')}
      ${this.flagRow('show_temps')}
      ${this.flagRow('motion')}
      <h4 class="sub">שעה ואור</h4>
      ${this.choiceRow('time_source')}
      ${own ? nothing : this.siteRow()}
      <h4 class="sub">סיור בגובה עין</h4>
      ${this.rangeRow('eye_m')}
      ${this.choiceRow('mouse_mode')}
      ${this.flagRow('walk_guard')}
      <h4 class="sub">איכות ומסכים</h4>
      ${this.choiceRow('quality')}
      ${this.rangeRow('dpr_cap')}
      ${own ? nothing : html`${this.choiceRow('wall_display')}${this.choiceRow('kiosk_idle_s')}`}
      <div class="foot">
        ${own
          ? html`<sw-button variant="ghost" size="sm" data-view-clear-own ?disabled=${this.busy || !Object.keys(this.prefs?.own ?? {}).length} @click=${() => void this.clearOwn()}>לפי ההתקנה בכל האפשרויות</sw-button>`
          : html`<sw-button variant="primary" size="sm" icon="check" data-view-save ?disabled=${this.instDisabled || !this.dirty} @click=${() => void this.saveInstallation()}>שמור</sw-button>
              <sw-button variant="ghost" size="sm" data-view-reset ?disabled=${this.instDisabled || !this.dirty} @click=${() => { this.draft = {}; this.siteDraft = null; }}>בטל שינויים</sw-button>
              ${this.dirty && !this.instDisabled ? html`<span class="dirty" data-view-dirty>יש שינויים שלא נשמרו</span>` : nothing}
              ${!this.canEdit && isApi() ? html`<span class="note">שינוי ברירת המחדל דורש הרשאת מנהל מערכת.</span>` : nothing}
              ${!isApi() ? html`<span class="note">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</span>` : nothing}`}
        ${this.message ? html`<span class="msg ok" role="status" data-view-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>` : nothing}
        ${this.error ? html`<span class="msg err" role="alert" data-view-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'system-plan-view': SystemPlanView;
  }
}
