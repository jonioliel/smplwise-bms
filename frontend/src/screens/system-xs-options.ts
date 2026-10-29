import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import { describeError } from '../api/client';
import { getSettings, patchSettings } from '../api/media';
import { invalidateSettings } from '../api/prefs';
import { isApi } from '../api/session';
import { applySynopticHidden } from '../shell/nav';
import { xt, type XtKey } from '../i18n/xsection';
import { XS_DEFAULT, XS_THRESHOLDS, normalizeXs, onXsOptions, setXsOptions, xsOptions, type XsOptions } from '../xsection/xs-model';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

type Enum = { key: keyof XsOptions; kind: 'enum'; label: XtKey; options: [string | number, XtKey | string][]; hint?: XtKey };
type Bool = { key: keyof XsOptions; kind: 'bool'; label: XtKey; hint?: XtKey };
type Opt = Enum | Bool;

/** Every option of `ui.xs`, grouped as the owner's decisions (2026-10-29) name them; the first value of each list is the owner's default. */
const GROUPS: { title: XtKey; opts: Opt[] }[] = [
  {
    title: 'grpFloors',
    opts: [
      { key: 'desktop_place', kind: 'enum', label: 'optDesktopPlace', options: [['left', 'optDesktopLeft'], ['right', 'optDesktopRight'], ['off', 'optDesktopOff']] },
      { key: 'phone_place', kind: 'enum', label: 'optPhonePlace', options: [['side', 'optPhoneSide'], ['card', 'optPhoneCard'], ['sheet', 'optPhoneSheet']] },
      { key: 'many', kind: 'enum', label: 'optMany', options: [['steps', 'optManySteps'], ['scroll', 'optManyScroll'], ['near', 'optManyNear']] },
      { key: 'links', kind: 'enum', label: 'optLinks', options: [['fold', 'optLinksFold'], ['full', 'optLinksFull'], ['hide', 'optLinksHide']] },
      { key: 'click', kind: 'enum', label: 'optClick', options: [['select', 'optClickSelect'], ['open', 'optClickOpen']] },
      { key: 'shafts', kind: 'bool', label: 'optShafts' },
      { key: 'animate', kind: 'bool', label: 'optAnimate' },
      { key: 'temp_threshold', kind: 'enum', label: 'optThreshold', options: XS_THRESHOLDS.map((n) => [n, `${n}°`] as [number, string]) },
    ],
  },
  {
    title: 'grpSyn',
    opts: [
      { key: 'syn_tab', kind: 'bool', label: 'optSynTab' },
      { key: 'syn_columns', kind: 'enum', label: 'optSynColumns', options: [['all', 'optSynAll'], ['few', 'optSynFew']] },
      { key: 'syn_events', kind: 'bool', label: 'optSynEvents' },
      { key: 'wall', kind: 'bool', label: 'optWall' },
    ],
  },
  {
    title: 'grpFire',
    opts: [
      { key: 'fire_ui', kind: 'bool', label: 'optFireUi', hint: 'optFireUiHint' },
      { key: 'fire_column', kind: 'enum', label: 'optFireColumn', options: [['hidden', 'optFireHidden'], ['dashed', 'optFireDashed']] },
      { key: 'ack', kind: 'enum', label: 'optAck', options: [['hold', 'optAckHold'], ['confirm', 'optAckConfirm'], ['tap', 'optAckTap']] },
      { key: 'ack_who', kind: 'enum', label: 'optAckWho', options: [['separate', 'optAckWhoSeparate'], ['viewers', 'optAckWhoViewers'], ['admin', 'optAckWhoAdmin']] },
      { key: 'alarm_bar', kind: 'enum', label: 'optAlarmBar', options: [['everywhere', 'optBarEverywhere'], ['home', 'optBarHome']] },
    ],
  },
];

const label = (v: XtKey | string) => (v in XT_LABELS ? xt(v as XtKey) : String(v));
const XT_LABELS: Record<string, true> = {};
for (const g of GROUPS) for (const o of g.opts) if (o.kind === 'enum') for (const [, l] of o.options) if (typeof l === 'string' && l.startsWith('opt')) XT_LABELS[l] = true;

/**
 * הגדרות › כללי › חתך הבניין והמפה הסינופטית (release 2.29.0): every behaviour of the cross-section, the synoptic map and the (off by default) fire-alarm UI as
 * one option, installation-wide (`ui.xs`, backend services/xs_options.py), with the owner's defaults marked. Only who may change settings can edit.
 * Fire detection is not part of the system: the group says so and the switch that turns the alarm UI on is off by default.
 */
@customElement('system-xs-options')
export class SystemXsOptions extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private draft: XsOptions = { ...xsOptions() };
  @state() private canEdit = false;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  private stop?: () => void;

  static styles = [css`
    :host { display: block; }
    h4 { margin: 18px 0 4px; font-size: var(--sw-fs-md); color: var(--sw-heading); }
    h4:first-of-type { margin-block-start: 0; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-block-end: 1px solid var(--sw-border); }
    .row .lbl { font-weight: var(--sw-fw-medium); min-inline-size: 0; }
    .row .lbl small { display: block; color: var(--sw-text-3); font-weight: var(--sw-fw-regular); font-size: var(--sw-fs-xs); }
    select { font: inherit; min-block-size: 36px; max-inline-size: 60%; padding: 0 10px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border-strong); background: var(--sw-surface); color: var(--sw-text); }
    select:disabled { opacity: var(--sw-disabled-opacity, 0.6); }
    .foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-block-start: 12px; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
    .note { color: var(--sw-text-3); font-size: var(--sw-fs-xs); margin-block-start: 8px; }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onXsOptions(() => {
      if (!this.dirty) this.draft = { ...xsOptions() };
    });
    if (isApi()) {
      void getSettings()
        .then((r) => {
          this.canEdit = r.can_edit;
          setXsOptions(r.settings['ui.xs']);
          this.draft = { ...xsOptions() };
        })
        .catch(() => undefined);
    }
  }
  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private get dirty(): boolean {
    const now = xsOptions() as unknown as Record<string, unknown>;
    return (Object.keys(XS_DEFAULT) as (keyof XsOptions)[]).some((k) => (this.draft as unknown as Record<string, unknown>)[k] !== now[k]);
  }

  private set(key: keyof XsOptions, value: unknown) {
    this.draft = normalizeXs({ ...this.draft, [key]: value });
    this.message = '';
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      const r = await patchSettings({ 'ui.xs': this.draft });
      invalidateSettings();
      setXsOptions(r.settings['ui.xs']);
      applySynopticHidden(xsOptions().syn_tab);
      this.draft = { ...xsOptions() };
      this.message = xt('setSaved');
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderOpt(o: Opt, editable: boolean) {
    const cur = (this.draft as unknown as Record<string, unknown>)[o.key];
    const def = (XS_DEFAULT as unknown as Record<string, unknown>)[o.key];
    if (o.kind === 'bool') {
      return html`<div class="row" data-xs-option=${o.key}><span class="lbl">${xt(o.label)}${def === true ? html` <small>${xt('setDefault')}</small>` : nothing}${o.hint ? html`<small>${xt(o.hint)}</small>` : nothing}</span>
        <sw-toggle ?checked=${cur === true} ?disabled=${!editable || this.busy} label=${xt(o.label)} labelHidden data-xs-toggle=${o.key} @change=${(e: CustomEvent<{ checked: boolean }>) => this.set(o.key, e.detail.checked)}></sw-toggle></div>`;
    }
    return html`<div class="row" data-xs-option=${o.key}><span class="lbl">${xt(o.label)}</span>
      <select data-xs-select=${o.key} aria-label=${xt(o.label)} ?disabled=${!editable || this.busy} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; this.set(o.key, typeof def === 'number' ? Number(v) : v); }}>
        ${o.options.map(([v, l]) => html`<option value=${String(v)} ?selected=${cur === v}>${label(l)}${v === def ? ` ${xt('setDefault')}` : ''}</option>`)}
      </select></div>`;
  }

  render() {
    const editable = this.canEdit && isApi();
    return html`<sw-card heading=${xt('setTitle')} subheading=${xt('setSub')} data-xs-options>
      ${GROUPS.map((g) => html`<h4>${xt(g.title)}</h4>${g.opts.map((o) => this.renderOpt(o, editable))}`)}
      ${editable
        ? html`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-xs-save ?disabled=${!this.dirty || this.busy} @click=${() => void this.save()}>${xt('setSave')}</sw-button>
            <sw-button variant="ghost" size="sm" data-xs-reset ?disabled=${this.busy} @click=${() => (this.draft = { ...XS_DEFAULT })}>${xt('setReset')}</sw-button>
            ${this.message ? html`<span class="ok" role="status" data-xs-message>${this.message}</span>` : nothing}
            ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
          </div>`
        : html`<div class="note">${xt('cantEdit')}</div>`}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-xs-options': SystemXsOptions;
  }
}
