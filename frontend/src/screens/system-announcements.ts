import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-state-panel';
import './system-announce-templates';
import {
  ANNOUNCE_CATEGORIES, ANNOUNCE_LANGS, ANNOUNCE_QUIET_MODES, ANNOUNCE_SCREEN_RANGE, ANNOUNCE_TRANSLATE_TARGETS, announceAreas, announceConfig, announcePutConfig, announceSpeak, announceTest,
  type AnnounceArea, type AnnounceConfigAnswer, type AnnounceConfigPatch, type AnnounceLang, type AnnounceQuietMode, type AnnounceSpeaker,
} from '../api/announcements';
import { describeError } from '../api/client';
import { can, isApi, onRemote } from '../api/session';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { announceLang, announceText } from '../i18n/announce';
import { clampScreenNumber, patchScreen, screenTargets, type ScreenNumberField } from '../announce/model';
import { dateInputLang } from '../api/day-format';
import { applyAnnounceHidden } from '../shell/nav';

const flash = (ms = 3000) => new Promise((r) => setTimeout(r, ms));

/**
 * MU2 הגדרות › מולטימדיה › "הכרזות קוליות" (administrator, `system.configure`; local network only): the switch, the speech engine, the language,
 * the per-minute limit, the speakers allowed to announce (nothing is allowed by default) with a test button on every row, a small
 * "announce now" row for people holding `media.announce`, and the last attempts (a person, a rule or a test). Every change is saved at once and
 * audited server-side (`media.announce.config`). Management lives here only: no operator screen carries a hint or a badge for it.
 */
@customElement('system-announcements')
export class SystemAnnouncements extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @state() private phase: 'loading' | 'ready' | 'error' | 'forbidden' | 'local' = 'loading';
  @state() private err = '';
  @state() private data: AnnounceConfigAnswer | null = null;
  @state() private areas: AnnounceArea[] = [];
  @state() private saved = '';
  @state() private busy = '';
  @state() private room = '';
  @state() private text = '';
  @state() private vol = '';

  static styles = [bubbleChrome, css`
    :host { display: block; }
    .stack { display: flex; flex-direction: column; gap: 14px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 0; border-block-end: 1px solid var(--sw-border); flex-wrap: wrap; }
    .row:last-child { border-block-end: 0; }
    .lbl { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); }
    .muted { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-regular); }
    input[type='text'], input[type='number'], input[type='time'], select {
      box-sizing: border-box; min-block-size: 36px; padding-inline: 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm);
      background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); max-inline-size: 100%;
    }
    input[type='text'] { inline-size: 260px; }
    input[data-ltr] { direction: ltr; text-align: start; }
    input[type='number'], input[type='time'] { inline-size: 90px; }
    .grow { flex: 1; min-inline-size: 200px; inline-size: auto; }
    .inl { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .area { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); color: var(--sw-text-2); padding-block: 10px 2px; }
    .pick { display: inline-flex; align-items: center; gap: 8px; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    .err { padding: 10px 12px; border-radius: var(--sw-r-md); background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface)); color: var(--sw-danger); font-size: var(--sw-fs-sm); }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    th, td { text-align: start; padding: 6px 8px; border-block-end: 1px solid var(--sw-border); }
    td.msg { max-inline-size: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 600px) { input[type='text'] { inline-size: 100%; } }
  `];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    if (!isApi()) {
      this.phase = 'ready';
      return;
    }
    if (onRemote()) {
      this.phase = 'local';
      return;
    }
    if (!can('system.configure')) {
      this.phase = 'forbidden';
      return;
    }
    this.phase = 'loading';
    this.err = '';
    try {
      this.data = await announceConfig();
      this.areas = can('media.announce') ? (await announceAreas()).areas : [];
      if (!this.areas.some((a) => a.area_id === this.room)) this.room = this.areas[0]?.area_id ?? '';
      this.phase = 'ready';
    } catch (err) {
      this.err = describeError(err);
      this.phase = 'error';
    }
  }

  private note(msg: string) {
    this.saved = msg;
    void flash().then(() => {
      if (this.saved === msg) this.saved = '';
    });
  }

  private async save(patch: AnnounceConfigPatch) {
    this.err = '';
    try {
      this.data = await announcePutConfig(patch);
      applyAnnounceHidden(this.data.config.enabled); // FIX2200: the הכרזות tab follows the switch at once
      if (can('media.announce')) this.areas = (await announceAreas()).areas;
      if (!this.areas.some((x) => x.area_id === this.room)) this.room = this.areas[0]?.area_id ?? '';
      this.note(announceText().saved);
    } catch (err) {
      const msg = describeError(err);
      await this.load();
      this.err = msg;
    }
  }

  private async toggleSpeaker(s: AnnounceSpeaker, on: boolean) {
    const cur = new Set(this.data?.config.devices ?? []);
    if (on) cur.add(s.key);
    else cur.delete(s.key);
    await this.save({ devices: [...cur] });
  }

  private pct(e: Event): number | null {
    const v = (e.target as HTMLInputElement).value.trim();
    return v === '' ? null : Number(v);
  }

  /** The emergency languages after ticking / unticking `l`: the canonical order, never empty (the last one stays). */
  private emergencyLangs(l: AnnounceLang, on: boolean): AnnounceLang[] {
    const cur = this.data?.config.emergency_languages ?? [];
    const next = ANNOUNCE_LANGS.filter((x) => (x === l ? on : cur.includes(x)));
    return next.length ? next : [...cur];
  }

  private routeAreas(): { id: string; name: string }[] {
    const seen = new Map<string, string>();
    for (const s of this.data?.speakers ?? []) if (s.allowed && s.area_id) seen.set(s.area_id, [s.floor_name, s.area_name].filter(Boolean).join(' · ') || s.area_id);
    return [...seen].map(([id, name]) => ({ id, name }));
  }

  private extraCards(t: ReturnType<typeof announceText>, cf: AnnounceConfigAnswer['config']) {
    const q = cf.quiet;
    const n = cf.notify;
    const rooms = this.routeAreas();
    return html`
      <sw-card heading=${t.quiet} data-announce-quiet>
        <div class="row"><span class="lbl">${t.quietEnabled}<span class="muted">${t.quietHint}</span></span>
          <sw-toggle label=${t.quietEnabled} labelHidden .checked=${q.enabled} data-announce-quiet-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ quiet: { enabled: e.detail.checked } })}></sw-toggle></div>
        <div class="row"><span class="lbl">${t.from}</span>
          <input type="time" lang=${dateInputLang()} data-announce-quiet-from .value=${q.from} @change=${(e: Event) => void this.save({ quiet: { from: (e.target as HTMLInputElement).value } })} /></div>
        <div class="row"><span class="lbl">${t.to}</span>
          <input type="time" lang=${dateInputLang()} data-announce-quiet-to .value=${q.to} @change=${(e: Event) => void this.save({ quiet: { to: (e.target as HTMLInputElement).value } })} /></div>
        <div class="row"><span class="lbl">${t.mode}</span>
          <select data-announce-quiet-mode aria-label=${t.mode} @change=${(e: Event) => void this.save({ quiet: { mode: (e.target as HTMLSelectElement).value as AnnounceQuietMode } })}>
            ${ANNOUNCE_QUIET_MODES.map((m) => html`<option value=${m} ?selected=${q.mode === m}>${{ suppress: t.modeSuppress, lower: t.modeLower, queue: t.modeQueue, allow: t.modeAllow }[m]}</option>`)}</select></div>
        ${q.mode === 'lower' ? html`<div class="row"><span class="lbl">${t.nightVolume}</span>
          <input type="number" min="0" max="100" data-announce-night-volume .value=${q.night_volume === null ? '' : String(q.night_volume)} @change=${(e: Event) => void this.save({ quiet: { night_volume: this.pct(e) } })} /></div>` : nothing}
      </sw-card>
      <sw-card heading=${t.routing} data-announce-routing>
        <div class="row"><span class="lbl">${t.routingEnabled}<span class="muted">${t.routingHint}</span></span>
          <sw-toggle label=${t.routingEnabled} labelHidden .checked=${n.enabled} data-announce-routing-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ notify: { enabled: e.detail.checked } })}></sw-toggle></div>
        <div class="row"><span class="lbl">${t.routingRoom}</span>
          <select data-announce-routing-room aria-label=${t.routingRoom} @change=${(e: Event) => void this.save({ notify: { scope: 'area', ref: (e.target as HTMLSelectElement).value } })}>
            <option value="" ?selected=${!rooms.some((r) => r.id === n.ref)}>${t.routingNone}</option>
            ${rooms.map((r) => html`<option value=${r.id} ?selected=${n.scope === 'area' && r.id === n.ref}>${r.name}</option>`)}</select></div>
        <div class="row"><span class="lbl">${t.minSeverity}</span>
          <select data-announce-routing-severity aria-label=${t.minSeverity} @change=${(e: Event) => void this.save({ notify: { min_severity: (e.target as HTMLSelectElement).value as 'info' | 'alert' | 'critical' } })}>
            ${(['info', 'alert', 'critical'] as const).map((s) => html`<option value=${s} ?selected=${n.min_severity === s}>${t.severity[s]}</option>`)}</select></div>
        <div class="row"><span class="lbl">${t.categories}</span>
          <span class="inl">${ANNOUNCE_CATEGORIES.map((c) => html`<label class="pick"><input type="checkbox" data-announce-routing-category=${c} .checked=${n.categories.includes(c)}
            @change=${(e: Event) => void this.save({ notify: { categories: ANNOUNCE_CATEGORIES.filter((x) => (x === c ? (e.target as HTMLInputElement).checked : n.categories.includes(x))) } })} />${t.category[c]}</label>`)}</span></div>
      </sw-card>`;
  }

  private screenAreas(): { id: string; name: string }[] {
    const seen = new Map<string, string>();
    for (const s of this.data?.speakers ?? []) if (s.area_id) seen.set(s.area_id, [s.floor_name, s.area_name].filter(Boolean).join(' · ') || s.area_id);
    for (const o of this.data?.screen_options?.screens ?? []) if (o.area_id && !seen.has(o.area_id)) seen.set(o.area_id, o.area_id);
    return [...seen].map(([id, name]) => ({ id, name }));
  }

  private screenNumber(field: ScreenNumberField, e: Event) {
    const v = clampScreenNumber(field, (e.target as HTMLInputElement).value);
    if (v === null) return;
    void this.save({ screens: { [field]: v } });
  }

  /** ANNOUNCEB-295 (stage B): the screens card - the switch, the defaults and times, and the screens allowed to show the text (a display board or a wall display, its room, the media screen it stands for). */
  private screensCard(t: ReturnType<typeof announceText>, d: AnnounceConfigAnswer) {
    const sc = d.config.screens ?? { enabled: false, default_on: true, seconds: 30, critical_seconds: 180, poll_s: 5, targets: [] };
    const opts = d.screen_options?.screens ?? [];
    const devices = d.screen_options?.devices ?? [];
    const rooms = this.screenAreas();
    const apply = (key: string, patch: Parameters<typeof patchScreen>[2]) => void this.save({ screens: { targets: screenTargets(patchScreen(opts, key, patch)) } });
    return html`<sw-card heading=${t.screens} subheading=${t.screensHint} data-announce-screens>
      <div class="row"><span class="lbl">${t.screensEnabled}<span class="muted">${t.screensEnabledHint}</span></span>
        <sw-toggle label=${t.screensEnabled} labelHidden .checked=${sc.enabled} data-announce-screens-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ screens: { enabled: e.detail.checked } })}></sw-toggle></div>
      <div class="row"><span class="lbl">${t.screensDefault}</span>
        <sw-toggle label=${t.screensDefault} labelHidden .checked=${sc.default_on} data-announce-screens-default @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ screens: { default_on: e.detail.checked } })}></sw-toggle></div>
      <div class="row"><span class="lbl">${t.screensSeconds}</span>
        <input type="number" min=${ANNOUNCE_SCREEN_RANGE.seconds[0]} max=${ANNOUNCE_SCREEN_RANGE.seconds[1]} data-announce-screens-seconds aria-label=${t.screensSeconds} .value=${String(sc.seconds)} @change=${(e: Event) => this.screenNumber('seconds', e)} /></div>
      <div class="row"><span class="lbl">${t.screensCriticalSeconds}</span>
        <input type="number" min=${ANNOUNCE_SCREEN_RANGE.critical_seconds[0]} max=${ANNOUNCE_SCREEN_RANGE.critical_seconds[1]} data-announce-screens-critical aria-label=${t.screensCriticalSeconds} .value=${String(sc.critical_seconds)} @change=${(e: Event) => this.screenNumber('critical_seconds', e)} /></div>
      <div class="row"><span class="lbl">${t.screensPoll}</span>
        <input type="number" min=${ANNOUNCE_SCREEN_RANGE.poll_s[0]} max=${ANNOUNCE_SCREEN_RANGE.poll_s[1]} data-announce-screens-poll aria-label=${t.screensPoll} .value=${String(sc.poll_s)} @change=${(e: Event) => this.screenNumber('poll_s', e)} /></div>
      ${sc.critical_close_s !== undefined ? html`<div class="row"><span class="lbl">${t.screensCriticalClose}</span>
        <input type="number" step="1" inputmode="numeric" min=${ANNOUNCE_SCREEN_RANGE.critical_close_s[0]} max=${ANNOUNCE_SCREEN_RANGE.critical_close_s[1]} data-announce-screens-critical-close aria-label=${t.screensCriticalClose} .value=${String(sc.critical_close_s)} @change=${(e: Event) => this.screenNumber('critical_close_s', e)} /></div>` : nothing}
      <div class="area">${t.screensList}</div>
      ${opts.length ? opts.map((o) => html`<div class="row" data-announce-screen=${o.key}>
        <label class="pick"><input type="checkbox" .checked=${o.allowed} data-announce-screen-allow @change=${(e: Event) => apply(o.key, { allowed: (e.target as HTMLInputElement).checked })} />${o.name}
          <span class="muted">${o.kind === 'board' ? t.screensKindBoard : t.screensKindWall}</span></label>
        <span class="inl">
          <select data-announce-screen-area aria-label=${t.screensArea} ?disabled=${!o.allowed} @change=${(e: Event) => apply(o.key, { area_id: (e.target as HTMLSelectElement).value || null })}>
            <option value="" ?selected=${!o.area_id}>${t.screensNoArea}</option>
            ${rooms.map((r) => html`<option value=${r.id} ?selected=${r.id === o.area_id}>${r.name}</option>`)}</select>
          <select data-announce-screen-device aria-label=${t.screensDevice} ?disabled=${!o.allowed} @change=${(e: Event) => apply(o.key, { device_key: (e.target as HTMLSelectElement).value || null })}>
            <option value="" ?selected=${!o.device_key}>${t.screensNoDevice}</option>
            ${devices.map((x) => html`<option value=${x.key} ?selected=${x.key === o.device_key}>${x.name}</option>`)}</select>
        </span></div>`) : html`<div class="muted" data-announce-screens-none>${t.screensNone}</div>`}
    </sw-card>`;
  }

  /** ANNOUNCE-297 (stage C): the automatic translation card - OFF by default; the text goes to an external provider, so switching it on needs the
   * owner's approval recorded first (who and when are kept and audited); the provider key lives in Settings > Connections > Secrets, never here. */
  private translateCard(t: ReturnType<typeof announceText>, d: AnnounceConfigAnswer) {
    const tc = d.config.translate;
    if (!tc) return nothing;
    const approved = !!tc.approval && tc.approval.provider === tc.provider;
    const when = tc.approval ? new Intl.DateTimeFormat(announceLang() === 'en' ? 'en-GB' : 'he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(tc.approval.at)) : '';
    return html`<sw-card heading=${t.translateCard} subheading=${t.translateHint} data-announce-translate-card>
      <div class="row"><span class="lbl">${t.translateProvider}</span>
        <select data-announce-translate-provider aria-label=${t.translateProvider} @change=${(e: Event) => void this.save({ translate: { provider: (e.target as HTMLSelectElement).value, ...(tc.enabled ? { enabled: false } : {}) } })}>
          <option value="off" ?selected=${tc.provider === 'off'}>${t.translateProviderOff}</option>
          <option value="google" ?selected=${tc.provider === 'google'}>${t.translateProviderGoogle}</option>
          <option value="cloud" ?selected=${tc.provider === 'cloud'}>${t.translateProviderCloud}</option></select></div>
      <div class="row"><span class="lbl">${t.translateApprove}${approved ? html`<span class="muted" data-announce-translate-approved>${t.translateApprovedBy} ${tc.approval?.by ?? '—'} · ${when}</span>` : html`<span class="muted">${t.translateNotApproved}</span>`}</span>
        <sw-button size="sm" data-announce-translate-approve ?disabled=${tc.provider === 'off' || approved} @click=${() => void this.save({ translate: { approve: true } })}>${t.translateApproveAction}</sw-button></div>
      <div class="row"><span class="lbl">${t.translateEnabled}${tc.provider === 'cloud' ? html`<span class="muted" data-announce-translate-key>${tc.key_set ? t.cloudKeySet : t.cloudKeyMissing}</span>` : nothing}</span>
        <sw-toggle label=${t.translateEnabled} labelHidden .checked=${tc.enabled} ?disabled=${!approved && !tc.enabled} data-announce-translate-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ translate: { enabled: e.detail.checked } })}></sw-toggle></div>
      <div class="row"><span class="lbl">${t.translateTargets}</span>
        <span class="inl">${ANNOUNCE_TRANSLATE_TARGETS.map((l) => html`<label class="pick"><input type="checkbox" data-announce-translate-target=${l} .checked=${tc.targets.includes(l)}
          @change=${(e: Event) => { const next = ANNOUNCE_TRANSLATE_TARGETS.filter((x) => (x === l ? (e.target as HTMLInputElement).checked : tc.targets.includes(x))); if (next.length) void this.save({ translate: { targets: next } }); else (e.target as HTMLInputElement).checked = true; }} />${t.langName[l]}</label>`)}</span></div>
    </sw-card>`;
  }

  private async run(id: string, fn: () => Promise<unknown>) {
    this.busy = id;
    this.err = '';
    try {
      await fn();
      this.note(announceText().sent);
    } catch (err) {
      this.err = describeError(err);
    } finally {
      this.busy = '';
    }
    try {
      this.data = await announceConfig();
    } catch {
      /* the next load shows it */
    }
  }

  private speakerRows(t: ReturnType<typeof announceText>) {
    const list = this.data?.speakers ?? [];
    if (!list.length) return html`<div class="muted" data-announce-none>${t.none}</div>`;
    const groups = new Map<string, AnnounceSpeaker[]>();
    for (const s of list) {
      const k = [s.floor_name, s.area_name].filter(Boolean).join(' · ') || t.noRoom;
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    const on = !!this.data?.config.enabled && !!this.data?.config.engine;
    return html`${[...groups].map(([k, rows]) => html`<div class="area">${k}</div>${rows.map((s) => html`
      <div class="row" data-announce-speaker=${s.key}>
        <label class="pick"><input type="checkbox" .checked=${s.allowed} data-announce-allow @change=${(e: Event) => void this.toggleSpeaker(s, (e.target as HTMLInputElement).checked)} />${s.name}</label>
        <sw-button size="sm" data-announce-test ?disabled=${!s.allowed || !on || this.busy !== ''} @click=${() => void this.run(`t:${s.key}`, () => announceTest({ scope: 'device', ref: s.key, language: announceLang() }))}>${t.testAction}</sw-button>
      </div>`)}`)}`;
  }

  render() {
    const t = announceText();
    if (this.phase === 'forbidden') return html`<sw-state-panel state="forbidden" heading=${t.forbidden}></sw-state-panel>`;
    if (this.phase === 'local') return html`<sw-state-panel icon="bell" state="empty" heading=${t.local}></sw-state-panel>`;
    if (this.phase === 'loading') return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (this.phase === 'error') return html`<sw-state-panel state="error" heading=${this.err} actionLabel="↻" @action=${() => void this.load()}></sw-state-panel>`;
    const d = this.data;
    if (!d) return html`<sw-state-panel icon="bell" state="empty" heading=${t.none}></sw-state-panel>`;
    const cf = d.config;
    return html`<div class="stack" data-announce>
      ${this.err ? html`<div class="err" role="alert">${this.err}</div>` : nothing}
      <sw-card heading=${t.general}>
        <div class="row"><span class="lbl">${t.enabled}<span class="muted">${t.enabledHint}</span></span>
          <sw-toggle label=${t.enabled} labelHidden .checked=${cf.enabled} data-announce-enabled @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ enabled: e.detail.checked })}></sw-toggle></div>
        <div class="row"><span class="lbl">${t.engine}<span class="muted">${t.engineHint}</span>${(d.engine_info ?? []).some((x) => x.entity_id === cf.engine && x.cloud) ? html`<span class="muted" data-announce-cloud-warn>${t.engineCloudWarn}</span>` : nothing}</span>
          <select data-ltr data-announce-engine aria-label=${t.engine} @change=${(e: Event) => void this.save({ engine: (e.target as HTMLSelectElement).value })}>
            <option value="" ?selected=${cf.engine === ''}>—</option>
            ${[...new Set([...d.engines, ...(cf.engine ? [cf.engine] : [])])].map((x) => html`<option value=${x} ?selected=${x === cf.engine}>${(d.engine_info ?? []).find((i) => i.entity_id === x)?.name ?? x}</option>`)}</select></div>
        <div class="row"><span class="lbl">${t.emergencyLangs}</span>
          <span class="inl">${ANNOUNCE_LANGS.map((l) => html`<label class="pick"><input type="checkbox" data-announce-emergency-lang=${l} .checked=${(cf.emergency_languages ?? []).includes(l)}
            @change=${(e: Event) => void this.save({ emergency_languages: this.emergencyLangs(l, (e.target as HTMLInputElement).checked) })} />${t.langName[l]}</label>`)}</span></div>
        <div class="row"><span class="lbl">${t.language}</span>
          <input type="text" data-ltr data-announce-language style="inline-size:100px" .value=${cf.language} @change=${(e: Event) => void this.save({ language: (e.target as HTMLInputElement).value.trim() })} /></div>
        <div class="row"><span class="lbl">${t.limit}</span>
          <input type="number" min="1" max="30" data-announce-limit .value=${String(cf.max_per_minute)} @change=${(e: Event) => void this.save({ max_per_minute: Number((e.target as HTMLInputElement).value) })} /></div>
        <div class="row"><span class="lbl">${t.volume}<span class="muted">${t.volumeHint}</span></span>
          <input type="number" min="0" max="100" data-announce-volume .value=${cf.volume === null ? '' : String(cf.volume)} @change=${(e: Event) => void this.save({ volume: this.pct(e) })} /></div>
        <div class="row"><span class="lbl">${t.pause}<span class="muted">${t.pauseHint}</span></span>
          <sw-toggle label=${t.pause} labelHidden .checked=${cf.pause_music} data-announce-pause @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ pause_music: e.detail.checked })}></sw-toggle></div>
      </sw-card>
      ${this.extraCards(t, cf)}
      ${this.screensCard(t, d)}
      ${this.translateCard(t, d)}
      <system-announce-templates .templates=${d.templates ?? []} @saved=${(e: CustomEvent<{ templates: AnnounceConfigAnswer['templates'] }>) => { if (this.data) this.data = { ...this.data, templates: e.detail.templates }; this.note(announceText().saved); }}></system-announce-templates>
      <sw-card heading=${t.speakers} subheading=${t.speakersHint}>${this.speakerRows(t)}</sw-card>
      ${this.areas.length ? html`<sw-card heading=${t.say} data-announce-now>
        <div class="row">
          <span class="inl"><select data-announce-room @change=${(e: Event) => (this.room = (e.target as HTMLSelectElement).value)} aria-label=${t.room}>${this.areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.room}>${[a.floor_name, a.name].filter(Boolean).join(' · ')}</option>`)}</select>
          <input type="text" class="grow" maxlength=${cf.max_text} data-announce-text aria-label=${t.text} .value=${this.text} @input=${(e: Event) => (this.text = (e.target as HTMLInputElement).value)} />
          <input type="number" min="0" max="100" data-announce-send-volume aria-label=${t.volume} placeholder="%" .value=${this.vol} @input=${(e: Event) => (this.vol = (e.target as HTMLInputElement).value)} /></span>
          <sw-button size="sm" variant="primary" icon="check" data-announce-send ?disabled=${!this.text.trim() || !this.room || this.busy !== ''}
            @click=${() => void this.run('send', async () => { await announceSpeak({ scope: 'area', ref: this.room, text: this.text, ...(this.vol.trim() === '' ? {} : { volume: Number(this.vol) }) }); this.text = ''; })}>${t.send}</sw-button>
        </div></sw-card>` : nothing}
      <sw-card heading=${t.history}>
        ${d.history.length ? html`<table data-announce-history><tbody>${d.history.map((h) => html`<tr>
          <td>${new Intl.DateTimeFormat(announceLang() === 'en' ? 'en-GB' : 'he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(h.at))}</td>
          <td>${t.src[h.source] ?? h.source}</td><td class="msg">${h.message}</td><td>${t.status[h.status] ?? h.status}</td></tr>`)}</tbody></table>`
          : html`<div class="muted">${t.empty}</div>`}
      </sw-card>
      ${this.saved ? html`<div class="ok" role="status">${this.saved}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-announcements': SystemAnnouncements;
  }
}
