import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import { describeError } from '../api/client';
import { listCameras } from '../api/maps';
import { liveWsUrl } from '../api/media';
import { can, session } from '../api/session';
import type { Camera } from '../api/types';
import { connectionEnv, formatReports, runConnProbe, uaFamily, type ProbeEnv, type ProbeReport, type Profile } from '../api/video-conn-test';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

type Choice = Profile | 'both';

/** The run's browser facts: family and major version only (never the full user-agent string). */
function probeEnv(): ProbeEnv {
  const ua = uaFamily(navigator.userAgent);
  return { browser: ua.browser, os: ua.os, mobile: ua.mobile, remote: session.me?.channel === 'remote', ...connectionEnv() };
}

/**
 * הגדרות › גישה מרחוק › בדיקת חיבור וידאו (owner 2026-10-01): shows what the WebRTC stack of the browser that shows this
 * card does against the live relay - ICE candidates, state transitions, the selected pair, inbound RTP statistics - and
 * one verdict line, as plain text that can be read on a phone and copied. No player is rendered; the run never leaves a
 * socket or a peer connection open (it ends them itself, on "עצור" and when the card leaves the page). A refusal by the
 * remote live-stream cap is shown as text. system.configure only; the logic is api/video-conn-test.ts.
 */
@customElement('system-video-conn-test')
export class SystemVideoConnTest extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private cameras: Camera[] | null = null;
  @state() private cameraId = '';
  @state() private choice: Choice = 'sub';
  @state() private running = false;
  @state() private reports: ProbeReport[] = [];
  @state() private error = '';
  @state() private copied: '' | 'ok' | 'manual' = '';
  private abort: AbortController | null = null;
  private runId = 0;

  static styles = [css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .row .ctl {
      inline-size: 220px;
      flex-shrink: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .acts {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      padding-block-start: 10px;
    }
    .ok {
      color: #15803d;
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .verdicts {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-block-start: 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .verdicts .good {
      color: #15803d;
    }
    .verdicts .bad {
      color: var(--sw-danger);
    }
    pre.report {
      margin: 10px 0 0;
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-surface));
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: 11px;
      line-height: 1.45;
      direction: ltr;
      text-align: left;
      white-space: pre-wrap;
      word-break: break-word;
      max-block-size: 420px;
      overflow: auto;
      user-select: text;
      -webkit-user-select: text;
    }
    @media (max-width: 600px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
      .row .ctl {
        inline-size: auto;
      }
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('pagehide', this.stop);
    void this.loadCameras();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('pagehide', this.stop);
    this.stop();
  }

  private async loadCameras() {
    try {
      const r = await listCameras();
      this.cameras = r.cameras.filter((c) => c.enabled && c.can_view_live !== false);
      if (!this.cameraId && this.cameras.length) this.cameraId = this.cameras[0].id;
    } catch (err) {
      this.cameras = [];
      this.error = describeError(err);
    }
  }

  /** The page is leaving (or the card is removed): ends the run and forgets it - no state is written afterwards. */
  private stop = () => {
    this.runId += 1;
    this.abort?.abort();
    this.abort = null;
  };

  /** "עצור": ends the run now; the report so far stays on screen (its verdict says it was stopped). */
  private cancel() {
    this.abort?.abort();
  }

  private async start() {
    const cam = this.cameras?.find((c) => c.id === this.cameraId);
    if (!cam || this.running) return;
    const run = (this.runId += 1);
    const ctl = new AbortController();
    this.abort = ctl;
    this.running = true;
    this.error = '';
    this.copied = '';
    this.reports = [];
    const env = probeEnv();
    const profiles: Profile[] = this.choice === 'both' ? ['sub', 'main'] : [this.choice];
    try {
      for (const profile of profiles) {
        if (ctl.signal.aborted || run !== this.runId) break;
        const done: ProbeReport[] = [...this.reports];
        const report = await runConnProbe({
          wsUrl: liveWsUrl(cam.id, profile),
          profile,
          cameraLabel: `camera channel ${cam.channel}`,
          env,
          signal: ctl.signal,
          onUpdate: (r) => {
            if (run === this.runId) this.reports = [...done, r];
          },
        });
        if (run !== this.runId) break;
        this.reports = [...done, report];
        // the relay frees the previous session a moment after the socket closes
        if (profile !== profiles[profiles.length - 1]) await new Promise((res) => window.setTimeout(res, 600));
      }
    } finally {
      if (run === this.runId) {
        this.running = false;
        this.abort = null;
      }
    }
  }

  private text(): string {
    return formatReports(this.reports);
  }

  private async copy() {
    const text = this.text();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copied = 'ok';
    } catch {
      this.copied = this.legacyCopy(text) ? 'ok' : 'manual';
    }
    window.setTimeout(() => (this.copied = ''), 4000);
  }

  /** navigator.clipboard is missing outside a secure context and in some webviews: the old selection copy. */
  private legacyCopy(text: string): boolean {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  render() {
    if (!can('system.configure')) return nothing;
    const cams = this.cameras;
    const noCams = cams !== null && cams.length === 0;
    const text = this.text();
    return html`<sw-card heading="בדיקת חיבור וידאו" subheading="מראה מה ה־WebRTC של הדפדפן הזה עושה מול שרת הווידאו: מועמדי ICE, מעברי מצב, הזוג שנבחר וסטטיסטיקת RTP, ושורת מסקנה. בלי נגן; הבדיקה סוגרת את החיבור בסיומה. מומלץ להריץ אותה מהטלפון שבו הווידאו לא עובד." data-card="remote.video-conn-test" data-conn-test>
      <div class="row"><span class="lbl">מצלמה<span class="muted">${noCams ? 'אין מצלמות עם הרשאת צפייה' : 'כל צפייה בבדיקה נספרת במכסת הזרמים החיים של הכניסה'}</span></span>
        <sw-field class="ctl"><select data-conn-camera ?disabled=${this.running || !cams?.length} @change=${(e: Event) => (this.cameraId = (e.target as HTMLSelectElement).value)}>
          ${(cams ?? []).map((c) => html`<option value=${c.id} ?selected=${c.id === this.cameraId}>${c.alias || c.name}</option>`)}
        </select></sw-field></div>
      <div class="row"><span class="lbl">זרם<span class="muted">"שניהם": קודם המשני ואז הראשי, בזה אחר זה</span></span>
        <sw-field class="ctl"><select data-conn-profile ?disabled=${this.running} @change=${(e: Event) => (this.choice = (e.target as HTMLSelectElement).value as Choice)}>
          <option value="sub" ?selected=${this.choice === 'sub'}>משני (sub)</option>
          <option value="main" ?selected=${this.choice === 'main'}>ראשי (main)</option>
          <option value="both" ?selected=${this.choice === 'both'}>שניהם</option>
        </select></sw-field></div>
      <div class="acts">
        ${this.running
          ? html`<sw-button size="sm" variant="ghost" icon="close" data-conn-stop @click=${() => this.cancel()}>עצור</sw-button><span class="muted" data-conn-running>בודק…</span>`
          : html`<sw-button size="sm" variant="primary" icon="activity" data-conn-run ?disabled=${!this.cameraId} @click=${() => void this.start()}>בדוק</sw-button>`}
        <sw-button size="sm" icon="list" data-conn-copy ?disabled=${!text} @click=${() => void this.copy()}>העתק דוח</sw-button>
        ${this.copied === 'ok' ? html`<span class="ok" data-conn-copied>הועתק</span>` : nothing}
        ${this.copied === 'manual' ? html`<span class="err" data-conn-copy-manual>ההעתקה נחסמה בדפדפן: סמן את הטקסט למטה והעתק ידנית</span>` : nothing}
        ${this.error ? html`<span class="err">${this.error}</span>` : nothing}
      </div>
      ${this.reports.length
        ? html`<div class="verdicts" data-conn-verdicts>${this.reports.map((r) => {
            const good = r.firstFrameAt != null;
            return html`<div class=${good ? 'good' : r.verdict ? 'bad' : ''} data-conn-verdict=${r.profile}>${r.profile === 'main' ? 'ראשי' : 'משני'}: ${r.verdict || 'בודק…'}</div>`;
          })}</div>
          <pre class="report" data-conn-report tabindex="0">${text}</pre>`
        : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-video-conn-test': SystemVideoConnTest;
  }
}
